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
import * as domStylesheetsJs from "../../../base/browser/domStylesheets.js";
import { ActionBar } from "../../../base/browser/ui/actionbar/actionbar.js";
import { Button } from "../../../base/browser/ui/button/button.js";
import { CountBadge } from "../../../base/browser/ui/countBadge/countBadge.js";
import { ProgressBar } from "../../../base/browser/ui/progressbar/progressbar.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { KeyCode } from "../../../base/common/keyCodes.js";
import { Disposable, dispose } from "../../../base/common/lifecycle.js";
import Severity from "../../../base/common/severity.js";
import { isString } from "../../../base/common/types.js";
import { localize } from "../../../nls.js";
import { QuickInputHideReason, QuickPickFocus } from "../common/quickInput.js";
import { QuickInputBox } from "./quickInputBox.js";
import { QuickPick, backButton, InputBox, QuickWidget, InQuickInputContextKey, QuickInputTypeContextKey, EndOfQuickInputBoxContextKey, QuickInputAlignmentContextKey } from "./quickInput.js";
import { ILayoutService } from "../../layout/browser/layoutService.js";
import { mainWindow } from "../../../base/browser/window.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { QuickInputTree } from "./quickInputTree.js";
import { IContextKeyService } from "../../contextkey/common/contextkey.js";
import "./quickInputActions.js";
import { autorun, observableValue } from "../../../base/common/observable.js";
import { StandardMouseEvent } from "../../../base/browser/mouseEvent.js";
import { IStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { Platform, platform } from "../../../base/common/platform.js";
import { getWindowControlsStyle, WindowControlsStyle } from "../../window/common/window.js";
import { getZoomFactor } from "../../../base/browser/browser.js";
const $ = dom.$;
const VIEWSTATE_STORAGE_KEY = "workbench.quickInput.viewState";
let QuickInputController = class extends Disposable {
  constructor(options, layoutService, instantiationService, contextKeyService, storageService) {
    super();
    this.options = options;
    this.layoutService = layoutService;
    this.instantiationService = instantiationService;
    this.storageService = storageService;
    this.enabled = true;
    this.onDidAcceptEmitter = this._register(new Emitter());
    this.onDidCustomEmitter = this._register(new Emitter());
    this.onDidTriggerButtonEmitter = this._register(new Emitter());
    this.keyMods = { ctrlCmd: false, alt: false };
    this.controller = null;
    this.onShowEmitter = this._register(new Emitter());
    this.onShow = this.onShowEmitter.event;
    this.onHideEmitter = this._register(new Emitter());
    this.onHide = this.onHideEmitter.event;
    this.backButton = backButton;
    this.inQuickInputContext = InQuickInputContextKey.bindTo(contextKeyService);
    this.quickInputTypeContext = QuickInputTypeContextKey.bindTo(contextKeyService);
    this.endOfQuickInputBoxContext = EndOfQuickInputBoxContextKey.bindTo(contextKeyService);
    this.idPrefix = options.idPrefix;
    this._container = options.container;
    this.styles = options.styles;
    this._register(Event.runAndSubscribe(dom.onDidRegisterWindow, ({ window, disposables }) => this.registerKeyModsListeners(window, disposables), { window: mainWindow, disposables: this._store }));
    this._register(dom.onWillUnregisterWindow((window) => {
      if (this.ui && dom.getWindow(this.ui.container) === window) {
        this.reparentUI(this.layoutService.mainContainer);
        this.layout(this.layoutService.mainContainerDimension, this.layoutService.mainContainerOffset.quickPickTop);
      }
    }));
    this.viewState = this.loadViewState();
  }
  get currentQuickInput() {
    return this.controller ?? void 0;
  }
  get container() {
    return this._container;
  }
  registerKeyModsListeners(window, disposables) {
    const listener = (e) => {
      this.keyMods.ctrlCmd = e.ctrlKey || e.metaKey;
      this.keyMods.alt = e.altKey;
    };
    for (const event of [dom.EventType.KEY_DOWN, dom.EventType.KEY_UP, dom.EventType.MOUSE_DOWN]) {
      disposables.add(dom.addDisposableListener(window, event, listener, true));
    }
  }
  getUI(showInActiveContainer) {
    if (this.ui) {
      if (showInActiveContainer) {
        if (dom.getWindow(this._container) !== dom.getWindow(this.layoutService.activeContainer)) {
          this.reparentUI(this.layoutService.activeContainer);
          this.layout(this.layoutService.activeContainerDimension, this.layoutService.activeContainerOffset.quickPickTop);
        }
      }
      return this.ui;
    }
    const container = dom.append(this._container, $(".quick-input-widget.show-file-icons"));
    container.tabIndex = -1;
    container.style.display = "none";
    const styleSheet = domStylesheetsJs.createStyleSheet(container);
    const titleBar = dom.append(container, $(".quick-input-titlebar"));
    const leftActionBar = this._register(new ActionBar(titleBar, { hoverDelegate: this.options.hoverDelegate }));
    leftActionBar.domNode.classList.add("quick-input-left-action-bar");
    const title = dom.append(titleBar, $(".quick-input-title"));
    const rightActionBar = this._register(new ActionBar(titleBar, { hoverDelegate: this.options.hoverDelegate }));
    rightActionBar.domNode.classList.add("quick-input-right-action-bar");
    const headerContainer = dom.append(container, $(".quick-input-header"));
    const checkAll = dom.append(headerContainer, $("input.quick-input-check-all"));
    checkAll.type = "checkbox";
    checkAll.setAttribute("aria-label", localize("quickInput.checkAll", "Toggle all checkboxes"));
    this._register(dom.addStandardDisposableListener(checkAll, dom.EventType.CHANGE, (e) => {
      const checked = checkAll.checked;
      list.setAllVisibleChecked(checked);
    }));
    this._register(dom.addDisposableListener(checkAll, dom.EventType.CLICK, (e) => {
      if (e.x || e.y) {
        inputBox.setFocus();
      }
    }));
    const description2 = dom.append(headerContainer, $(".quick-input-description"));
    const inputContainer = dom.append(headerContainer, $(".quick-input-and-message"));
    const filterContainer = dom.append(inputContainer, $(".quick-input-filter"));
    const inputBox = this._register(new QuickInputBox(filterContainer, this.styles.inputBox, this.styles.toggle));
    inputBox.setAttribute("aria-describedby", `${this.idPrefix}message`);
    const visibleCountContainer = dom.append(filterContainer, $(".quick-input-visible-count"));
    visibleCountContainer.setAttribute("aria-live", "polite");
    visibleCountContainer.setAttribute("aria-atomic", "true");
    const visibleCount = this._register(new CountBadge(visibleCountContainer, { countFormat: localize({ key: "quickInput.visibleCount", comment: ["This tells the user how many items are shown in a list of items to select from. The items can be anything. Currently not visible, but read by screen readers."] }, "{0} Results") }, this.styles.countBadge));
    const countContainer = dom.append(filterContainer, $(".quick-input-count"));
    countContainer.setAttribute("aria-live", "polite");
    const count = this._register(new CountBadge(countContainer, { countFormat: localize({ key: "quickInput.countSelected", comment: ["This tells the user how many items are selected in a list of items to select from. The items can be anything."] }, "{0} Selected") }, this.styles.countBadge));
    const inlineActionBar = this._register(new ActionBar(headerContainer, { hoverDelegate: this.options.hoverDelegate }));
    inlineActionBar.domNode.classList.add("quick-input-inline-action-bar");
    const okContainer = dom.append(headerContainer, $(".quick-input-action"));
    const ok = this._register(new Button(okContainer, this.styles.button));
    ok.label = localize("ok", "OK");
    this._register(ok.onDidClick((e) => {
      this.onDidAcceptEmitter.fire();
    }));
    const customButtonContainer = dom.append(headerContainer, $(".quick-input-action"));
    const customButton = this._register(new Button(customButtonContainer, { ...this.styles.button, supportIcons: true }));
    customButton.label = localize("custom", "Custom");
    this._register(customButton.onDidClick((e) => {
      this.onDidCustomEmitter.fire();
    }));
    const message = dom.append(inputContainer, $(`#${this.idPrefix}message.quick-input-message`));
    const progressBar = this._register(new ProgressBar(container, this.styles.progressBar));
    progressBar.getContainer().classList.add("quick-input-progress");
    const widget = dom.append(container, $(".quick-input-html-widget"));
    widget.tabIndex = -1;
    const description1 = dom.append(container, $(".quick-input-description"));
    const listId = this.idPrefix + "list";
    const list = this._register(this.instantiationService.createInstance(QuickInputTree, container, this.options.hoverDelegate, this.options.linkOpenerDelegate, listId));
    inputBox.setAttribute("aria-controls", listId);
    this._register(list.onDidChangeFocus(() => {
      inputBox.setAttribute("aria-activedescendant", list.getActiveDescendant() ?? "");
    }));
    this._register(list.onChangedAllVisibleChecked((checked) => {
      checkAll.checked = checked;
    }));
    this._register(list.onChangedVisibleCount((c) => {
      visibleCount.setCount(c);
    }));
    this._register(list.onChangedCheckedCount((c) => {
      count.setCount(c);
    }));
    this._register(list.onLeave(() => {
      setTimeout(() => {
        if (!this.controller) {
          return;
        }
        inputBox.setFocus();
        if (this.controller instanceof QuickPick && this.controller.canSelectMany) {
          list.clearFocus();
        }
      }, 0);
    }));
    const focusTracker = dom.trackFocus(container);
    this._register(focusTracker);
    this._register(dom.addDisposableListener(container, dom.EventType.FOCUS, (e) => {
      const ui = this.getUI();
      if (dom.isAncestor(e.relatedTarget, ui.inputContainer)) {
        const value = ui.inputBox.isSelectionAtEnd();
        if (this.endOfQuickInputBoxContext.get() !== value) {
          this.endOfQuickInputBoxContext.set(value);
        }
      }
      if (dom.isAncestor(e.relatedTarget, ui.container)) {
        return;
      }
      this.inQuickInputContext.set(true);
      this.previousFocusElement = dom.isHTMLElement(e.relatedTarget) ? e.relatedTarget : void 0;
    }, true));
    this._register(focusTracker.onDidBlur(() => {
      if (!this.getUI().ignoreFocusOut && !this.options.ignoreFocusOut()) {
        this.hide(QuickInputHideReason.Blur);
      }
      this.inQuickInputContext.set(false);
      this.endOfQuickInputBoxContext.set(false);
      this.previousFocusElement = void 0;
    }));
    this._register(inputBox.onKeyDown((_) => {
      const value = this.getUI().inputBox.isSelectionAtEnd();
      if (this.endOfQuickInputBoxContext.get() !== value) {
        this.endOfQuickInputBoxContext.set(value);
      }
      inputBox.removeAttribute("aria-activedescendant");
    }));
    this._register(dom.addDisposableListener(container, dom.EventType.FOCUS, (e) => {
      inputBox.setFocus();
    }));
    this._register(dom.addStandardDisposableListener(container, dom.EventType.KEY_DOWN, (event) => {
      if (dom.isAncestor(event.target, widget)) {
        return;
      }
      switch (event.keyCode) {
        case KeyCode.Enter:
          dom.EventHelper.stop(event, true);
          if (this.enabled) {
            this.onDidAcceptEmitter.fire();
          }
          break;
        case KeyCode.Escape:
          dom.EventHelper.stop(event, true);
          this.hide(QuickInputHideReason.Gesture);
          break;
        case KeyCode.Tab:
          if (!event.altKey && !event.ctrlKey && !event.metaKey) {
            const selectors = [
              ".quick-input-list .monaco-action-bar .always-visible",
              ".quick-input-list-entry:hover .monaco-action-bar",
              ".monaco-list-row.focused .monaco-action-bar"
            ];
            if (container.classList.contains("show-checkboxes")) {
              selectors.push("input");
            } else {
              selectors.push("input[type=text]");
            }
            if (this.getUI().list.displayed) {
              selectors.push(".monaco-list");
            }
            if (this.getUI().message) {
              selectors.push(".quick-input-message a");
            }
            if (this.getUI().widget) {
              if (dom.isAncestor(event.target, this.getUI().widget)) {
                break;
              }
              selectors.push(".quick-input-html-widget");
            }
            const stops = container.querySelectorAll(selectors.join(", "));
            if (!event.shiftKey && dom.isAncestor(event.target, stops[stops.length - 1])) {
              dom.EventHelper.stop(event, true);
              stops[0].focus();
            }
            if (event.shiftKey && dom.isAncestor(event.target, stops[0])) {
              dom.EventHelper.stop(event, true);
              stops[stops.length - 1].focus();
            }
          }
          break;
      }
    }));
    this.dndController = this._register(this.instantiationService.createInstance(
      QuickInputDragAndDropController,
      this._container,
      container,
      [
        {
          node: titleBar,
          includeChildren: true
        },
        {
          node: headerContainer,
          includeChildren: false
        }
      ],
      this.viewState
    ));
    this._register(autorun((reader) => {
      const dndViewState = this.dndController?.dndViewState.read(reader);
      if (!dndViewState) {
        return;
      }
      if (dndViewState.top !== void 0 && dndViewState.left !== void 0) {
        this.viewState = {
          ...this.viewState,
          top: dndViewState.top,
          left: dndViewState.left
        };
      } else {
        this.viewState = void 0;
      }
      this.updateLayout();
      if (dndViewState.done) {
        this.saveViewState(this.viewState);
      }
    }));
    this.ui = {
      container,
      styleSheet,
      leftActionBar,
      titleBar,
      title,
      description1,
      description2,
      widget,
      rightActionBar,
      inlineActionBar,
      checkAll,
      inputContainer,
      filterContainer,
      inputBox,
      visibleCountContainer,
      visibleCount,
      countContainer,
      count,
      okContainer,
      ok,
      message,
      customButtonContainer,
      customButton,
      list,
      progressBar,
      onDidAccept: this.onDidAcceptEmitter.event,
      onDidCustom: this.onDidCustomEmitter.event,
      onDidTriggerButton: this.onDidTriggerButtonEmitter.event,
      ignoreFocusOut: false,
      keyMods: this.keyMods,
      show: (controller) => this.show(controller),
      hide: () => this.hide(),
      setVisibilities: (visibilities) => this.setVisibilities(visibilities),
      setEnabled: (enabled) => this.setEnabled(enabled),
      setContextKey: (contextKey) => this.options.setContextKey(contextKey),
      linkOpenerDelegate: (content) => this.options.linkOpenerDelegate(content)
    };
    this.updateStyles();
    return this.ui;
  }
  reparentUI(container) {
    if (this.ui) {
      this._container = container;
      dom.append(this._container, this.ui.container);
      this.dndController?.reparentUI(this._container);
    }
  }
  pick(picks, options = {}, token = CancellationToken.None) {
    return new Promise((doResolve, reject) => {
      let resolve = (result) => {
        resolve = doResolve;
        options.onKeyMods?.(input.keyMods);
        doResolve(result);
      };
      if (token.isCancellationRequested) {
        resolve(void 0);
        return;
      }
      const input = this.createQuickPick({ useSeparators: true });
      let activeItem;
      const disposables = [
        input,
        input.onDidAccept(() => {
          if (input.canSelectMany) {
            resolve(input.selectedItems.slice());
            input.hide();
          } else {
            const result = input.activeItems[0];
            if (result) {
              resolve(result);
              input.hide();
            }
          }
        }),
        input.onDidChangeActive((items) => {
          const focused = items[0];
          if (focused && options.onDidFocus) {
            options.onDidFocus(focused);
          }
        }),
        input.onDidChangeSelection((items) => {
          if (!input.canSelectMany) {
            const result = items[0];
            if (result) {
              resolve(result);
              input.hide();
            }
          }
        }),
        input.onDidTriggerItemButton((event) => options.onDidTriggerItemButton && options.onDidTriggerItemButton({
          ...event,
          removeItem: () => {
            const index = input.items.indexOf(event.item);
            if (index !== -1) {
              const items = input.items.slice();
              const removed = items.splice(index, 1);
              const activeItems = input.activeItems.filter((activeItem2) => activeItem2 !== removed[0]);
              const keepScrollPositionBefore = input.keepScrollPosition;
              input.keepScrollPosition = true;
              input.items = items;
              if (activeItems) {
                input.activeItems = activeItems;
              }
              input.keepScrollPosition = keepScrollPositionBefore;
            }
          }
        })),
        input.onDidTriggerSeparatorButton((event) => options.onDidTriggerSeparatorButton?.(event)),
        input.onDidChangeValue((value) => {
          if (activeItem && !value && (input.activeItems.length !== 1 || input.activeItems[0] !== activeItem)) {
            input.activeItems = [activeItem];
          }
        }),
        token.onCancellationRequested(() => {
          input.hide();
        }),
        input.onDidHide(() => {
          dispose(disposables);
          resolve(void 0);
        })
      ];
      input.title = options.title;
      if (options.value) {
        input.value = options.value;
      }
      input.canSelectMany = !!options.canPickMany;
      input.placeholder = options.placeHolder;
      input.ignoreFocusOut = !!options.ignoreFocusLost;
      input.matchOnDescription = !!options.matchOnDescription;
      input.matchOnDetail = !!options.matchOnDetail;
      input.matchOnLabel = options.matchOnLabel === void 0 || options.matchOnLabel;
      input.quickNavigate = options.quickNavigate;
      input.hideInput = !!options.hideInput;
      input.contextKey = options.contextKey;
      input.busy = true;
      Promise.all([picks, options.activeItem]).then(([items, _activeItem]) => {
        activeItem = _activeItem;
        input.busy = false;
        input.items = items;
        if (input.canSelectMany) {
          input.selectedItems = items.filter((item) => item.type !== "separator" && item.picked);
        }
        if (activeItem) {
          input.activeItems = [activeItem];
        }
      });
      input.show();
      Promise.resolve(picks).then(void 0, (err) => {
        reject(err);
        input.hide();
      });
    });
  }
  setValidationOnInput(input, validationResult) {
    if (validationResult && isString(validationResult)) {
      input.severity = Severity.Error;
      input.validationMessage = validationResult;
    } else if (validationResult && !isString(validationResult)) {
      input.severity = validationResult.severity;
      input.validationMessage = validationResult.content;
    } else {
      input.severity = Severity.Ignore;
      input.validationMessage = void 0;
    }
  }
  input(options = {}, token = CancellationToken.None) {
    return new Promise((resolve) => {
      if (token.isCancellationRequested) {
        resolve(void 0);
        return;
      }
      const input = this.createInputBox();
      const validateInput = options.validateInput || (() => Promise.resolve(void 0));
      const onDidValueChange = Event.debounce(input.onDidChangeValue, (last, cur) => cur, 100);
      let validationValue = options.value || "";
      let validation = Promise.resolve(validateInput(validationValue));
      const disposables = [
        input,
        onDidValueChange((value) => {
          if (value !== validationValue) {
            validation = Promise.resolve(validateInput(value));
            validationValue = value;
          }
          validation.then((result) => {
            if (value === validationValue) {
              this.setValidationOnInput(input, result);
            }
          });
        }),
        input.onDidAccept(() => {
          const value = input.value;
          if (value !== validationValue) {
            validation = Promise.resolve(validateInput(value));
            validationValue = value;
          }
          validation.then((result) => {
            if (!result || !isString(result) && result.severity !== Severity.Error) {
              resolve(value);
              input.hide();
            } else if (value === validationValue) {
              this.setValidationOnInput(input, result);
            }
          });
        }),
        token.onCancellationRequested(() => {
          input.hide();
        }),
        input.onDidHide(() => {
          dispose(disposables);
          resolve(void 0);
        })
      ];
      input.title = options.title;
      input.value = options.value || "";
      input.valueSelection = options.valueSelection;
      input.prompt = options.prompt;
      input.placeholder = options.placeHolder;
      input.password = !!options.password;
      input.ignoreFocusOut = !!options.ignoreFocusLost;
      input.show();
    });
  }
  createQuickPick(options = { useSeparators: false }) {
    const ui = this.getUI(true);
    return new QuickPick(ui);
  }
  createInputBox() {
    const ui = this.getUI(true);
    return new InputBox(ui);
  }
  setAlignment(alignment) {
    this.dndController?.setAlignment(alignment);
  }
  createQuickWidget() {
    const ui = this.getUI(true);
    return new QuickWidget(ui);
  }
  show(controller) {
    const ui = this.getUI(true);
    this.onShowEmitter.fire();
    const oldController = this.controller;
    this.controller = controller;
    oldController?.didHide();
    this.setEnabled(true);
    ui.leftActionBar.clear();
    ui.title.textContent = "";
    ui.description1.textContent = "";
    ui.description2.textContent = "";
    dom.reset(ui.widget);
    ui.rightActionBar.clear();
    ui.inlineActionBar.clear();
    ui.checkAll.checked = false;
    ui.inputBox.placeholder = "";
    ui.inputBox.password = false;
    ui.inputBox.showDecoration(Severity.Ignore);
    ui.visibleCount.setCount(0);
    ui.count.setCount(0);
    dom.reset(ui.message);
    ui.progressBar.stop();
    ui.list.setElements([]);
    ui.list.matchOnDescription = false;
    ui.list.matchOnDetail = false;
    ui.list.matchOnLabel = true;
    ui.list.sortByLabel = true;
    ui.ignoreFocusOut = false;
    ui.inputBox.toggles = void 0;
    const backKeybindingLabel = this.options.backKeybindingLabel();
    backButton.tooltip = backKeybindingLabel ? localize("quickInput.backWithKeybinding", "Back ({0})", backKeybindingLabel) : localize("quickInput.back", "Back");
    ui.container.style.display = "";
    this.updateLayout();
    this.dndController?.layoutContainer();
    ui.inputBox.setFocus();
    this.quickInputTypeContext.set(controller.type);
  }
  isVisible() {
    return !!this.ui && this.ui.container.style.display !== "none";
  }
  setVisibilities(visibilities) {
    const ui = this.getUI();
    ui.title.style.display = visibilities.title ? "" : "none";
    ui.description1.style.display = visibilities.description && (visibilities.inputBox || visibilities.checkAll) ? "" : "none";
    ui.description2.style.display = visibilities.description && !(visibilities.inputBox || visibilities.checkAll) ? "" : "none";
    ui.checkAll.style.display = visibilities.checkAll ? "" : "none";
    ui.inputContainer.style.display = visibilities.inputBox ? "" : "none";
    ui.filterContainer.style.display = visibilities.inputBox ? "" : "none";
    ui.visibleCountContainer.style.display = visibilities.visibleCount ? "" : "none";
    ui.countContainer.style.display = visibilities.count ? "" : "none";
    ui.okContainer.style.display = visibilities.ok ? "" : "none";
    ui.customButtonContainer.style.display = visibilities.customButton ? "" : "none";
    ui.message.style.display = visibilities.message ? "" : "none";
    ui.progressBar.getContainer().style.display = visibilities.progressBar ? "" : "none";
    ui.list.displayed = !!visibilities.list;
    ui.container.classList.toggle("show-checkboxes", !!visibilities.checkBox);
    ui.container.classList.toggle("hidden-input", !visibilities.inputBox && !visibilities.description);
    this.updateLayout();
  }
  setEnabled(enabled) {
    if (enabled !== this.enabled) {
      this.enabled = enabled;
      for (const item of this.getUI().leftActionBar.viewItems) {
        item.action.enabled = enabled;
      }
      for (const item of this.getUI().rightActionBar.viewItems) {
        item.action.enabled = enabled;
      }
      this.getUI().checkAll.disabled = !enabled;
      this.getUI().inputBox.enabled = enabled;
      this.getUI().ok.enabled = enabled;
      this.getUI().list.enabled = enabled;
    }
  }
  hide(reason) {
    const controller = this.controller;
    if (!controller) {
      return;
    }
    controller.willHide(reason);
    const container = this.ui?.container;
    const focusChanged = container && !dom.isAncestorOfActiveElement(container);
    this.controller = null;
    this.onHideEmitter.fire();
    if (container) {
      container.style.display = "none";
    }
    if (!focusChanged) {
      let currentElement = this.previousFocusElement;
      while (currentElement && !currentElement.offsetParent) {
        currentElement = currentElement.parentElement ?? void 0;
      }
      if (currentElement?.offsetParent) {
        currentElement.focus();
        this.previousFocusElement = void 0;
      } else {
        this.options.returnFocus();
      }
    }
    controller.didHide(reason);
  }
  focus() {
    if (this.isVisible()) {
      const ui = this.getUI();
      if (ui.inputBox.enabled) {
        ui.inputBox.setFocus();
      } else {
        ui.list.domFocus();
      }
    }
  }
  toggle() {
    if (this.isVisible() && this.controller instanceof QuickPick && this.controller.canSelectMany) {
      this.getUI().list.toggleCheckbox();
    }
  }
  toggleHover() {
    if (this.isVisible() && this.controller instanceof QuickPick) {
      this.getUI().list.toggleHover();
    }
  }
  navigate(next, quickNavigate) {
    if (this.isVisible() && this.getUI().list.displayed) {
      this.getUI().list.focus(next ? QuickPickFocus.Next : QuickPickFocus.Previous);
      if (quickNavigate && this.controller instanceof QuickPick) {
        this.controller.quickNavigate = quickNavigate;
      }
    }
  }
  async accept(keyMods = { alt: false, ctrlCmd: false }) {
    this.keyMods.alt = keyMods.alt;
    this.keyMods.ctrlCmd = keyMods.ctrlCmd;
    this.onDidAcceptEmitter.fire();
  }
  async back() {
    this.onDidTriggerButtonEmitter.fire(this.backButton);
  }
  async cancel() {
    this.hide();
  }
  layout(dimension, titleBarOffset) {
    this.dimension = dimension;
    this.titleBarOffset = titleBarOffset;
    this.updateLayout();
  }
  updateLayout() {
    if (this.ui && this.isVisible()) {
      const style = this.ui.container.style;
      const width = Math.min(this.dimension.width * 0.62, QuickInputController.MAX_WIDTH);
      style.width = width + "px";
      style.top = `${this.viewState?.top ? Math.round(this.dimension.height * this.viewState.top) : this.titleBarOffset}px`;
      style.left = `${Math.round(this.dimension.width * (this.viewState?.left ?? 0.5) - width / 2)}px`;
      this.ui.inputBox.layout();
      this.ui.list.layout(this.dimension && this.dimension.height * 0.4);
    }
  }
  applyStyles(styles) {
    this.styles = styles;
    this.updateStyles();
  }
  updateStyles() {
    if (this.ui) {
      const {
        quickInputTitleBackground,
        quickInputBackground,
        quickInputForeground,
        widgetBorder,
        widgetShadow
      } = this.styles.widget;
      this.ui.titleBar.style.backgroundColor = quickInputTitleBackground ?? "";
      this.ui.container.style.backgroundColor = quickInputBackground ?? "";
      this.ui.container.style.color = quickInputForeground ?? "";
      this.ui.container.style.border = widgetBorder ? `1px solid ${widgetBorder}` : "";
      this.ui.container.style.boxShadow = widgetShadow ? `0 0 8px 2px ${widgetShadow}` : "";
      this.ui.list.style(this.styles.list);
      const content = [];
      if (this.styles.pickerGroup.pickerGroupBorder) {
        content.push(`.quick-input-list .quick-input-list-entry { border-top-color:  ${this.styles.pickerGroup.pickerGroupBorder}; }`);
      }
      if (this.styles.pickerGroup.pickerGroupForeground) {
        content.push(`.quick-input-list .quick-input-list-separator { color:  ${this.styles.pickerGroup.pickerGroupForeground}; }`);
      }
      if (this.styles.pickerGroup.pickerGroupForeground) {
        content.push(`.quick-input-list .quick-input-list-separator-as-item { color: var(--vscode-descriptionForeground); }`);
      }
      if (this.styles.keybindingLabel.keybindingLabelBackground || this.styles.keybindingLabel.keybindingLabelBorder || this.styles.keybindingLabel.keybindingLabelBottomBorder || this.styles.keybindingLabel.keybindingLabelShadow || this.styles.keybindingLabel.keybindingLabelForeground) {
        content.push(".quick-input-list .monaco-keybinding > .monaco-keybinding-key {");
        if (this.styles.keybindingLabel.keybindingLabelBackground) {
          content.push(`background-color: ${this.styles.keybindingLabel.keybindingLabelBackground};`);
        }
        if (this.styles.keybindingLabel.keybindingLabelBorder) {
          content.push(`border-color: ${this.styles.keybindingLabel.keybindingLabelBorder};`);
        }
        if (this.styles.keybindingLabel.keybindingLabelBottomBorder) {
          content.push(`border-bottom-color: ${this.styles.keybindingLabel.keybindingLabelBottomBorder};`);
        }
        if (this.styles.keybindingLabel.keybindingLabelShadow) {
          content.push(`box-shadow: inset 0 -1px 0 ${this.styles.keybindingLabel.keybindingLabelShadow};`);
        }
        if (this.styles.keybindingLabel.keybindingLabelForeground) {
          content.push(`color: ${this.styles.keybindingLabel.keybindingLabelForeground};`);
        }
        content.push("}");
      }
      const newStyles = content.join("\n");
      if (newStyles !== this.ui.styleSheet.textContent) {
        this.ui.styleSheet.textContent = newStyles;
      }
    }
  }
  loadViewState() {
    try {
      const data = JSON.parse(this.storageService.get(VIEWSTATE_STORAGE_KEY, StorageScope.APPLICATION, "{}"));
      if (data.top !== void 0 || data.left !== void 0) {
        return data;
      }
    } catch {
    }
    return void 0;
  }
  saveViewState(viewState) {
    const isMainWindow = this.layoutService.activeContainer === this.layoutService.mainContainer;
    if (!isMainWindow) {
      return;
    }
    if (viewState !== void 0) {
      this.storageService.store(VIEWSTATE_STORAGE_KEY, JSON.stringify(viewState), StorageScope.APPLICATION, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(VIEWSTATE_STORAGE_KEY, StorageScope.APPLICATION);
    }
  }
};
QuickInputController.MAX_WIDTH = 600;
QuickInputController = __decorateClass([
  __decorateParam(1, ILayoutService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IStorageService)
], QuickInputController);
let QuickInputDragAndDropController = class extends Disposable {
  constructor(_container, _quickInputContainer, _quickInputDragAreas, initialViewState, _layoutService, contextKeyService, configurationService) {
    super();
    this._container = _container;
    this._quickInputContainer = _quickInputContainer;
    this._quickInputDragAreas = _quickInputDragAreas;
    this._layoutService = _layoutService;
    this.configurationService = configurationService;
    this.dndViewState = observableValue(this, void 0);
    this._snapThreshold = 20;
    this._snapLineHorizontalRatio = 0.25;
    this._quickInputAlignmentContext = QuickInputAlignmentContextKey.bindTo(contextKeyService);
    const customWindowControls = getWindowControlsStyle(this.configurationService) === WindowControlsStyle.CUSTOM;
    this._controlsOnLeft = customWindowControls && platform === Platform.Mac;
    this._controlsOnRight = customWindowControls && (platform === Platform.Windows || platform === Platform.Linux);
    this._registerLayoutListener();
    this.registerMouseListeners();
    this.dndViewState.set({ ...initialViewState, done: true }, void 0);
  }
  reparentUI(container) {
    this._container = container;
  }
  layoutContainer(dimension = this._layoutService.activeContainerDimension) {
    const state = this.dndViewState.get();
    const dragAreaRect = this._quickInputContainer.getBoundingClientRect();
    if (state?.top && state?.left) {
      const a = Math.round(state.left * 100) / 100;
      const b = dimension.width;
      const c = dragAreaRect.width;
      const d = a * b - c / 2;
      this._layout(state.top * dimension.height, d);
    }
  }
  setAlignment(alignment, done = true) {
    if (alignment === "top") {
      this.dndViewState.set({
        top: this._getTopSnapValue() / this._container.clientHeight,
        left: (this._getCenterXSnapValue() + this._quickInputContainer.clientWidth / 2) / this._container.clientWidth,
        done
      }, void 0);
      this._quickInputAlignmentContext.set("top");
    } else if (alignment === "center") {
      this.dndViewState.set({
        top: this._getCenterYSnapValue() / this._container.clientHeight,
        left: (this._getCenterXSnapValue() + this._quickInputContainer.clientWidth / 2) / this._container.clientWidth,
        done
      }, void 0);
      this._quickInputAlignmentContext.set("center");
    } else {
      this.dndViewState.set({ top: alignment.top, left: alignment.left, done }, void 0);
      this._quickInputAlignmentContext.set(void 0);
    }
  }
  _registerLayoutListener() {
    this._register(Event.filter(this._layoutService.onDidLayoutContainer, (e) => e.container === this._container)((e) => this.layoutContainer(e.dimension)));
  }
  registerMouseListeners() {
    const dragArea = this._quickInputContainer;
    this._register(dom.addDisposableGenericMouseUpListener(dragArea, (event) => {
      const originEvent = new StandardMouseEvent(dom.getWindow(dragArea), event);
      if (originEvent.detail !== 2) {
        return;
      }
      if (!this._quickInputDragAreas.some(({ node, includeChildren }) => includeChildren ? dom.isAncestor(originEvent.target, node) : originEvent.target === node)) {
        return;
      }
      this.dndViewState.set({ top: void 0, left: void 0, done: true }, void 0);
    }));
    this._register(dom.addDisposableGenericMouseDownListener(dragArea, (e) => {
      const activeWindow = dom.getWindow(this._layoutService.activeContainer);
      const originEvent = new StandardMouseEvent(activeWindow, e);
      if (!this._quickInputDragAreas.some(({ node, includeChildren }) => includeChildren ? dom.isAncestor(originEvent.target, node) : originEvent.target === node)) {
        return;
      }
      const dragAreaRect = this._quickInputContainer.getBoundingClientRect();
      const dragOffsetX = originEvent.browserEvent.clientX - dragAreaRect.left;
      const dragOffsetY = originEvent.browserEvent.clientY - dragAreaRect.top;
      let isMovingQuickInput = false;
      const mouseMoveListener = dom.addDisposableGenericMouseMoveListener(activeWindow, (e2) => {
        const mouseMoveEvent = new StandardMouseEvent(activeWindow, e2);
        mouseMoveEvent.preventDefault();
        if (!isMovingQuickInput) {
          isMovingQuickInput = true;
        }
        this._layout(e2.clientY - dragOffsetY, e2.clientX - dragOffsetX);
      });
      const mouseUpListener = dom.addDisposableGenericMouseUpListener(activeWindow, (e2) => {
        if (isMovingQuickInput) {
          const state = this.dndViewState.get();
          this.dndViewState.set({ top: state?.top, left: state?.left, done: true }, void 0);
        }
        mouseMoveListener.dispose();
        mouseUpListener.dispose();
      });
    }));
  }
  _layout(topCoordinate, leftCoordinate) {
    const snapCoordinateYTop = this._getTopSnapValue();
    const snapCoordinateY = this._getCenterYSnapValue();
    const snapCoordinateX = this._getCenterXSnapValue();
    topCoordinate = Math.max(0, Math.min(topCoordinate, this._container.clientHeight - this._quickInputContainer.clientHeight));
    if (topCoordinate < this._layoutService.activeContainerOffset.top) {
      if (this._controlsOnLeft) {
        leftCoordinate = Math.max(leftCoordinate, 80 / getZoomFactor(dom.getActiveWindow()));
      } else if (this._controlsOnRight) {
        leftCoordinate = Math.min(leftCoordinate, this._container.clientWidth - this._quickInputContainer.clientWidth - 140 / getZoomFactor(dom.getActiveWindow()));
      }
    }
    const snappingToTop = Math.abs(topCoordinate - snapCoordinateYTop) < this._snapThreshold;
    topCoordinate = snappingToTop ? snapCoordinateYTop : topCoordinate;
    const snappingToCenter = Math.abs(topCoordinate - snapCoordinateY) < this._snapThreshold;
    topCoordinate = snappingToCenter ? snapCoordinateY : topCoordinate;
    const top = topCoordinate / this._container.clientHeight;
    leftCoordinate = Math.max(0, Math.min(leftCoordinate, this._container.clientWidth - this._quickInputContainer.clientWidth));
    const snappingToCenterX = Math.abs(leftCoordinate - snapCoordinateX) < this._snapThreshold;
    leftCoordinate = snappingToCenterX ? snapCoordinateX : leftCoordinate;
    const b = this._container.clientWidth;
    const c = this._quickInputContainer.clientWidth;
    const d = leftCoordinate;
    const left = (d + c / 2) / b;
    this.dndViewState.set({ top, left, done: false }, void 0);
    if (snappingToCenterX) {
      if (snappingToTop) {
        this._quickInputAlignmentContext.set("top");
        return;
      } else if (snappingToCenter) {
        this._quickInputAlignmentContext.set("center");
        return;
      }
    }
    this._quickInputAlignmentContext.set(void 0);
  }
  _getTopSnapValue() {
    return this._layoutService.activeContainerOffset.quickPickTop;
  }
  _getCenterYSnapValue() {
    return Math.round(this._container.clientHeight * this._snapLineHorizontalRatio);
  }
  _getCenterXSnapValue() {
    return Math.round(this._container.clientWidth / 2) - Math.round(this._quickInputContainer.clientWidth / 2);
  }
};
QuickInputDragAndDropController = __decorateClass([
  __decorateParam(4, ILayoutService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IConfigurationService)
], QuickInputDragAndDropController);
export {
  QuickInputController
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9xdWlja2lucHV0L2Jyb3dzZXIvcXVpY2tJbnB1dENvbnRyb2xsZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgKiBhcyBkb21TdHlsZXNoZWV0c0pzIGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb21TdHlsZXNoZWV0cy5qcyc7XG5pbXBvcnQgeyBBY3Rpb25CYXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uVmlld0l0ZW1zLmpzJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9idXR0b24vYnV0dG9uLmpzJztcbmltcG9ydCB7IENvdW50QmFkZ2UgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvY291bnRCYWRnZS9jb3VudEJhZGdlLmpzJztcbmltcG9ydCB7IFByb2dyZXNzQmFyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Byb2dyZXNzYmFyL3Byb2dyZXNzYmFyLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgZGlzcG9zZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0IHsgaXNTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJSW5wdXRCb3gsIElJbnB1dE9wdGlvbnMsIElLZXlNb2RzLCBJUGlja09wdGlvbnMsIElRdWlja0lucHV0LCBJUXVpY2tJbnB1dEJ1dHRvbiwgSVF1aWNrTmF2aWdhdGVDb25maWd1cmF0aW9uLCBJUXVpY2tQaWNrLCBJUXVpY2tQaWNrSXRlbSwgSVF1aWNrV2lkZ2V0LCBRdWlja0lucHV0SGlkZVJlYXNvbiwgUXVpY2tQaWNrSW5wdXQsIFF1aWNrUGlja0ZvY3VzLCBRdWlja0lucHV0VHlwZSB9IGZyb20gJy4uL2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IFF1aWNrSW5wdXRCb3ggfSBmcm9tICcuL3F1aWNrSW5wdXRCb3guanMnO1xuaW1wb3J0IHsgUXVpY2tJbnB1dFVJLCBXcml0ZWFibGUsIElRdWlja0lucHV0U3R5bGVzLCBJUXVpY2tJbnB1dE9wdGlvbnMsIFF1aWNrUGljaywgYmFja0J1dHRvbiwgSW5wdXRCb3gsIFZpc2liaWxpdGllcywgUXVpY2tXaWRnZXQsIEluUXVpY2tJbnB1dENvbnRleHRLZXksIFF1aWNrSW5wdXRUeXBlQ29udGV4dEtleSwgRW5kT2ZRdWlja0lucHV0Qm94Q29udGV4dEtleSwgUXVpY2tJbnB1dEFsaWdubWVudENvbnRleHRLZXkgfSBmcm9tICcuL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgSUxheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgUXVpY2tJbnB1dFRyZWUgfSBmcm9tICcuL3F1aWNrSW5wdXRUcmVlLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCAnLi9xdWlja0lucHV0QWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBhdXRvcnVuLCBvYnNlcnZhYmxlVmFsdWUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9tb3VzZUV2ZW50LmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFBsYXRmb3JtLCBwbGF0Zm9ybSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGdldFdpbmRvd0NvbnRyb2xzU3R5bGUsIFdpbmRvd0NvbnRyb2xzU3R5bGUgfSBmcm9tICcuLi8uLi93aW5kb3cvY29tbW9uL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBnZXRab29tRmFjdG9yIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL2Jyb3dzZXIuanMnO1xuXG5jb25zdCAkID0gZG9tLiQ7XG5cbmNvbnN0IFZJRVdTVEFURV9TVE9SQUdFX0tFWSA9ICd3b3JrYmVuY2gucXVpY2tJbnB1dC52aWV3U3RhdGUnO1xuXG50eXBlIFF1aWNrSW5wdXRWaWV3U3RhdGUgPSB7XG5cdHJlYWRvbmx5IHRvcD86IG51bWJlcjtcblx0cmVhZG9ubHkgbGVmdD86IG51bWJlcjtcbn07XG5cbmV4cG9ydCBjbGFzcyBRdWlja0lucHV0Q29udHJvbGxlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBNQVhfV0lEVEggPSA2MDA7IC8vIE1heCB0b3RhbCB3aWR0aCBvZiBxdWljayBpbnB1dCB3aWRnZXRcblxuXHRwcml2YXRlIGlkUHJlZml4OiBzdHJpbmc7XG5cdHByaXZhdGUgdWk6IFF1aWNrSW5wdXRVSSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBkaW1lbnNpb24/OiBkb20uSURpbWVuc2lvbjtcblx0cHJpdmF0ZSB0aXRsZUJhck9mZnNldD86IG51bWJlcjtcblx0cHJpdmF0ZSBlbmFibGVkID0gdHJ1ZTtcblx0cHJpdmF0ZSByZWFkb25seSBvbkRpZEFjY2VwdEVtaXR0ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBvbkRpZEN1c3RvbUVtaXR0ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBvbkRpZFRyaWdnZXJCdXR0b25FbWl0dGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVF1aWNrSW5wdXRCdXR0b24+KCkpO1xuXHRwcml2YXRlIGtleU1vZHM6IFdyaXRlYWJsZTxJS2V5TW9kcz4gPSB7IGN0cmxDbWQ6IGZhbHNlLCBhbHQ6IGZhbHNlIH07XG5cblx0cHJpdmF0ZSBjb250cm9sbGVyOiBJUXVpY2tJbnB1dCB8IG51bGwgPSBudWxsO1xuXHRnZXQgY3VycmVudFF1aWNrSW5wdXQoKSB7IHJldHVybiB0aGlzLmNvbnRyb2xsZXIgPz8gdW5kZWZpbmVkOyB9XG5cblx0cHJpdmF0ZSBfY29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0Z2V0IGNvbnRhaW5lcigpIHsgcmV0dXJuIHRoaXMuX2NvbnRhaW5lcjsgfVxuXG5cdHByaXZhdGUgc3R5bGVzOiBJUXVpY2tJbnB1dFN0eWxlcztcblxuXHRwcml2YXRlIG9uU2hvd0VtaXR0ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25TaG93ID0gdGhpcy5vblNob3dFbWl0dGVyLmV2ZW50O1xuXG5cdHByaXZhdGUgb25IaWRlRW1pdHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkhpZGUgPSB0aGlzLm9uSGlkZUVtaXR0ZXIuZXZlbnQ7XG5cblx0cHJpdmF0ZSBwcmV2aW91c0ZvY3VzRWxlbWVudD86IEhUTUxFbGVtZW50O1xuXG5cdHByaXZhdGUgdmlld1N0YXRlOiBRdWlja0lucHV0Vmlld1N0YXRlIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGRuZENvbnRyb2xsZXI6IFF1aWNrSW5wdXREcmFnQW5kRHJvcENvbnRyb2xsZXIgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBpblF1aWNrSW5wdXRDb250ZXh0OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBxdWlja0lucHV0VHlwZUNvbnRleHQ6IElDb250ZXh0S2V5PFF1aWNrSW5wdXRUeXBlPjtcblx0cHJpdmF0ZSByZWFkb25seSBlbmRPZlF1aWNrSW5wdXRCb3hDb250ZXh0OiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIG9wdGlvbnM6IElRdWlja0lucHV0T3B0aW9ucyxcblx0XHRASUxheW91dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYXlvdXRTZXJ2aWNlOiBJTGF5b3V0U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuaW5RdWlja0lucHV0Q29udGV4dCA9IEluUXVpY2tJbnB1dENvbnRleHRLZXkuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnF1aWNrSW5wdXRUeXBlQ29udGV4dCA9IFF1aWNrSW5wdXRUeXBlQ29udGV4dEtleS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuZW5kT2ZRdWlja0lucHV0Qm94Q29udGV4dCA9IEVuZE9mUXVpY2tJbnB1dEJveENvbnRleHRLZXkuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMuaWRQcmVmaXggPSBvcHRpb25zLmlkUHJlZml4O1xuXHRcdHRoaXMuX2NvbnRhaW5lciA9IG9wdGlvbnMuY29udGFpbmVyO1xuXHRcdHRoaXMuc3R5bGVzID0gb3B0aW9ucy5zdHlsZXM7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQucnVuQW5kU3Vic2NyaWJlKGRvbS5vbkRpZFJlZ2lzdGVyV2luZG93LCAoeyB3aW5kb3csIGRpc3Bvc2FibGVzIH0pID0+IHRoaXMucmVnaXN0ZXJLZXlNb2RzTGlzdGVuZXJzKHdpbmRvdywgZGlzcG9zYWJsZXMpLCB7IHdpbmRvdzogbWFpbldpbmRvdywgZGlzcG9zYWJsZXM6IHRoaXMuX3N0b3JlIH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihkb20ub25XaWxsVW5yZWdpc3RlcldpbmRvdyh3aW5kb3cgPT4ge1xuXHRcdFx0aWYgKHRoaXMudWkgJiYgZG9tLmdldFdpbmRvdyh0aGlzLnVpLmNvbnRhaW5lcikgPT09IHdpbmRvdykge1xuXHRcdFx0XHQvLyBUaGUgd2luZG93IHRoaXMgcXVpY2sgaW5wdXQgaXMgY29udGFpbmVkIGluIGlzIGFib3V0IHRvXG5cdFx0XHRcdC8vIGNsb3NlLCBzbyB3ZSBoYXZlIHRvIG1ha2Ugc3VyZSB0byByZXBhcmVudCBpdCBiYWNrIHRvIGFuXG5cdFx0XHRcdC8vIGV4aXN0aW5nIHBhcmVudCB0byBub3QgbG9vc2UgZnVuY3Rpb25hbGl0eS5cblx0XHRcdFx0Ly8gKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xOTU4NzApXG5cdFx0XHRcdHRoaXMucmVwYXJlbnRVSSh0aGlzLmxheW91dFNlcnZpY2UubWFpbkNvbnRhaW5lcik7XG5cdFx0XHRcdHRoaXMubGF5b3V0KHRoaXMubGF5b3V0U2VydmljZS5tYWluQ29udGFpbmVyRGltZW5zaW9uLCB0aGlzLmxheW91dFNlcnZpY2UubWFpbkNvbnRhaW5lck9mZnNldC5xdWlja1BpY2tUb3ApO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLnZpZXdTdGF0ZSA9IHRoaXMubG9hZFZpZXdTdGF0ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlcktleU1vZHNMaXN0ZW5lcnMod2luZG93OiBXaW5kb3csIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpOiB2b2lkIHtcblx0XHRjb25zdCBsaXN0ZW5lciA9IChlOiBLZXlib2FyZEV2ZW50IHwgTW91c2VFdmVudCkgPT4ge1xuXHRcdFx0dGhpcy5rZXlNb2RzLmN0cmxDbWQgPSBlLmN0cmxLZXkgfHwgZS5tZXRhS2V5O1xuXHRcdFx0dGhpcy5rZXlNb2RzLmFsdCA9IGUuYWx0S2V5O1xuXHRcdH07XG5cblx0XHRmb3IgKGNvbnN0IGV2ZW50IG9mIFtkb20uRXZlbnRUeXBlLktFWV9ET1dOLCBkb20uRXZlbnRUeXBlLktFWV9VUCwgZG9tLkV2ZW50VHlwZS5NT1VTRV9ET1dOXSkge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIod2luZG93LCBldmVudCwgbGlzdGVuZXIsIHRydWUpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldFVJKHNob3dJbkFjdGl2ZUNvbnRhaW5lcj86IGJvb2xlYW4pIHtcblx0XHRpZiAodGhpcy51aSkge1xuXHRcdFx0Ly8gSW4gb3JkZXIgdG8gc3VwcG9ydCBhdXggd2luZG93cywgcmUtcGFyZW50IHRoZSBjb250cm9sbGVyXG5cdFx0XHQvLyBpZiB0aGUgb3JpZ2luYWwgZXZlbnQgaXMgZnJvbSBhIGRpZmZlcmVudCBkb2N1bWVudFxuXHRcdFx0aWYgKHNob3dJbkFjdGl2ZUNvbnRhaW5lcikge1xuXHRcdFx0XHRpZiAoZG9tLmdldFdpbmRvdyh0aGlzLl9jb250YWluZXIpICE9PSBkb20uZ2V0V2luZG93KHRoaXMubGF5b3V0U2VydmljZS5hY3RpdmVDb250YWluZXIpKSB7XG5cdFx0XHRcdFx0dGhpcy5yZXBhcmVudFVJKHRoaXMubGF5b3V0U2VydmljZS5hY3RpdmVDb250YWluZXIpO1xuXHRcdFx0XHRcdHRoaXMubGF5b3V0KHRoaXMubGF5b3V0U2VydmljZS5hY3RpdmVDb250YWluZXJEaW1lbnNpb24sIHRoaXMubGF5b3V0U2VydmljZS5hY3RpdmVDb250YWluZXJPZmZzZXQucXVpY2tQaWNrVG9wKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdGhpcy51aTtcblx0XHR9XG5cblx0XHRjb25zdCBjb250YWluZXIgPSBkb20uYXBwZW5kKHRoaXMuX2NvbnRhaW5lciwgJCgnLnF1aWNrLWlucHV0LXdpZGdldC5zaG93LWZpbGUtaWNvbnMnKSk7XG5cdFx0Y29udGFpbmVyLnRhYkluZGV4ID0gLTE7XG5cdFx0Y29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cblx0XHRjb25zdCBzdHlsZVNoZWV0ID0gZG9tU3R5bGVzaGVldHNKcy5jcmVhdGVTdHlsZVNoZWV0KGNvbnRhaW5lcik7XG5cblx0XHRjb25zdCB0aXRsZUJhciA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCAkKCcucXVpY2staW5wdXQtdGl0bGViYXInKSk7XG5cblx0XHRjb25zdCBsZWZ0QWN0aW9uQmFyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEFjdGlvbkJhcih0aXRsZUJhciwgeyBob3ZlckRlbGVnYXRlOiB0aGlzLm9wdGlvbnMuaG92ZXJEZWxlZ2F0ZSB9KSk7XG5cdFx0bGVmdEFjdGlvbkJhci5kb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ3F1aWNrLWlucHV0LWxlZnQtYWN0aW9uLWJhcicpO1xuXG5cdFx0Y29uc3QgdGl0bGUgPSBkb20uYXBwZW5kKHRpdGxlQmFyLCAkKCcucXVpY2staW5wdXQtdGl0bGUnKSk7XG5cblx0XHRjb25zdCByaWdodEFjdGlvbkJhciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBBY3Rpb25CYXIodGl0bGVCYXIsIHsgaG92ZXJEZWxlZ2F0ZTogdGhpcy5vcHRpb25zLmhvdmVyRGVsZWdhdGUgfSkpO1xuXHRcdHJpZ2h0QWN0aW9uQmFyLmRvbU5vZGUuY2xhc3NMaXN0LmFkZCgncXVpY2staW5wdXQtcmlnaHQtYWN0aW9uLWJhcicpO1xuXG5cdFx0Y29uc3QgaGVhZGVyQ29udGFpbmVyID0gZG9tLmFwcGVuZChjb250YWluZXIsICQoJy5xdWljay1pbnB1dC1oZWFkZXInKSk7XG5cblx0XHRjb25zdCBjaGVja0FsbCA9IDxIVE1MSW5wdXRFbGVtZW50PmRvbS5hcHBlbmQoaGVhZGVyQ29udGFpbmVyLCAkKCdpbnB1dC5xdWljay1pbnB1dC1jaGVjay1hbGwnKSk7XG5cdFx0Y2hlY2tBbGwudHlwZSA9ICdjaGVja2JveCc7XG5cdFx0Y2hlY2tBbGwuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgbG9jYWxpemUoJ3F1aWNrSW5wdXQuY2hlY2tBbGwnLCBcIlRvZ2dsZSBhbGwgY2hlY2tib3hlc1wiKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyKGNoZWNrQWxsLCBkb20uRXZlbnRUeXBlLkNIQU5HRSwgZSA9PiB7XG5cdFx0XHRjb25zdCBjaGVja2VkID0gY2hlY2tBbGwuY2hlY2tlZDtcblx0XHRcdGxpc3Quc2V0QWxsVmlzaWJsZUNoZWNrZWQoY2hlY2tlZCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoY2hlY2tBbGwsIGRvbS5FdmVudFR5cGUuQ0xJQ0ssIGUgPT4ge1xuXHRcdFx0aWYgKGUueCB8fCBlLnkpIHsgLy8gQXZvaWQgJ2NsaWNrJyB0cmlnZ2VyZWQgYnkgJ3NwYWNlJy4uLlxuXHRcdFx0XHRpbnB1dEJveC5zZXRGb2N1cygpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGRlc2NyaXB0aW9uMiA9IGRvbS5hcHBlbmQoaGVhZGVyQ29udGFpbmVyLCAkKCcucXVpY2staW5wdXQtZGVzY3JpcHRpb24nKSk7XG5cdFx0Y29uc3QgaW5wdXRDb250YWluZXIgPSBkb20uYXBwZW5kKGhlYWRlckNvbnRhaW5lciwgJCgnLnF1aWNrLWlucHV0LWFuZC1tZXNzYWdlJykpO1xuXHRcdGNvbnN0IGZpbHRlckNvbnRhaW5lciA9IGRvbS5hcHBlbmQoaW5wdXRDb250YWluZXIsICQoJy5xdWljay1pbnB1dC1maWx0ZXInKSk7XG5cblx0XHRjb25zdCBpbnB1dEJveCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBRdWlja0lucHV0Qm94KGZpbHRlckNvbnRhaW5lciwgdGhpcy5zdHlsZXMuaW5wdXRCb3gsIHRoaXMuc3R5bGVzLnRvZ2dsZSkpO1xuXHRcdGlucHV0Qm94LnNldEF0dHJpYnV0ZSgnYXJpYS1kZXNjcmliZWRieScsIGAke3RoaXMuaWRQcmVmaXh9bWVzc2FnZWApO1xuXG5cdFx0Y29uc3QgdmlzaWJsZUNvdW50Q29udGFpbmVyID0gZG9tLmFwcGVuZChmaWx0ZXJDb250YWluZXIsICQoJy5xdWljay1pbnB1dC12aXNpYmxlLWNvdW50JykpO1xuXHRcdHZpc2libGVDb3VudENvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGl2ZScsICdwb2xpdGUnKTtcblx0XHR2aXNpYmxlQ291bnRDb250YWluZXIuc2V0QXR0cmlidXRlKCdhcmlhLWF0b21pYycsICd0cnVlJyk7XG5cdFx0Y29uc3QgdmlzaWJsZUNvdW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IENvdW50QmFkZ2UodmlzaWJsZUNvdW50Q29udGFpbmVyLCB7IGNvdW50Rm9ybWF0OiBsb2NhbGl6ZSh7IGtleTogJ3F1aWNrSW5wdXQudmlzaWJsZUNvdW50JywgY29tbWVudDogWydUaGlzIHRlbGxzIHRoZSB1c2VyIGhvdyBtYW55IGl0ZW1zIGFyZSBzaG93biBpbiBhIGxpc3Qgb2YgaXRlbXMgdG8gc2VsZWN0IGZyb20uIFRoZSBpdGVtcyBjYW4gYmUgYW55dGhpbmcuIEN1cnJlbnRseSBub3QgdmlzaWJsZSwgYnV0IHJlYWQgYnkgc2NyZWVuIHJlYWRlcnMuJ10gfSwgXCJ7MH0gUmVzdWx0c1wiKSB9LCB0aGlzLnN0eWxlcy5jb3VudEJhZGdlKSk7XG5cblx0XHRjb25zdCBjb3VudENvbnRhaW5lciA9IGRvbS5hcHBlbmQoZmlsdGVyQ29udGFpbmVyLCAkKCcucXVpY2staW5wdXQtY291bnQnKSk7XG5cdFx0Y291bnRDb250YWluZXIuc2V0QXR0cmlidXRlKCdhcmlhLWxpdmUnLCAncG9saXRlJyk7XG5cdFx0Y29uc3QgY291bnQgPSB0aGlzLl9yZWdpc3RlcihuZXcgQ291bnRCYWRnZShjb3VudENvbnRhaW5lciwgeyBjb3VudEZvcm1hdDogbG9jYWxpemUoeyBrZXk6ICdxdWlja0lucHV0LmNvdW50U2VsZWN0ZWQnLCBjb21tZW50OiBbJ1RoaXMgdGVsbHMgdGhlIHVzZXIgaG93IG1hbnkgaXRlbXMgYXJlIHNlbGVjdGVkIGluIGEgbGlzdCBvZiBpdGVtcyB0byBzZWxlY3QgZnJvbS4gVGhlIGl0ZW1zIGNhbiBiZSBhbnl0aGluZy4nXSB9LCBcInswfSBTZWxlY3RlZFwiKSB9LCB0aGlzLnN0eWxlcy5jb3VudEJhZGdlKSk7XG5cblx0XHRjb25zdCBpbmxpbmVBY3Rpb25CYXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgQWN0aW9uQmFyKGhlYWRlckNvbnRhaW5lciwgeyBob3ZlckRlbGVnYXRlOiB0aGlzLm9wdGlvbnMuaG92ZXJEZWxlZ2F0ZSB9KSk7XG5cdFx0aW5saW5lQWN0aW9uQmFyLmRvbU5vZGUuY2xhc3NMaXN0LmFkZCgncXVpY2staW5wdXQtaW5saW5lLWFjdGlvbi1iYXInKTtcblxuXHRcdGNvbnN0IG9rQ29udGFpbmVyID0gZG9tLmFwcGVuZChoZWFkZXJDb250YWluZXIsICQoJy5xdWljay1pbnB1dC1hY3Rpb24nKSk7XG5cdFx0Y29uc3Qgb2sgPSB0aGlzLl9yZWdpc3RlcihuZXcgQnV0dG9uKG9rQ29udGFpbmVyLCB0aGlzLnN0eWxlcy5idXR0b24pKTtcblx0XHRvay5sYWJlbCA9IGxvY2FsaXplKCdvaycsIFwiT0tcIik7XG5cdFx0dGhpcy5fcmVnaXN0ZXIob2sub25EaWRDbGljayhlID0+IHtcblx0XHRcdHRoaXMub25EaWRBY2NlcHRFbWl0dGVyLmZpcmUoKTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCBjdXN0b21CdXR0b25Db250YWluZXIgPSBkb20uYXBwZW5kKGhlYWRlckNvbnRhaW5lciwgJCgnLnF1aWNrLWlucHV0LWFjdGlvbicpKTtcblx0XHRjb25zdCBjdXN0b21CdXR0b24gPSB0aGlzLl9yZWdpc3RlcihuZXcgQnV0dG9uKGN1c3RvbUJ1dHRvbkNvbnRhaW5lciwgeyAuLi50aGlzLnN0eWxlcy5idXR0b24sIHN1cHBvcnRJY29uczogdHJ1ZSB9KSk7XG5cdFx0Y3VzdG9tQnV0dG9uLmxhYmVsID0gbG9jYWxpemUoJ2N1c3RvbScsIFwiQ3VzdG9tXCIpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGN1c3RvbUJ1dHRvbi5vbkRpZENsaWNrKGUgPT4ge1xuXHRcdFx0dGhpcy5vbkRpZEN1c3RvbUVtaXR0ZXIuZmlyZSgpO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IG1lc3NhZ2UgPSBkb20uYXBwZW5kKGlucHV0Q29udGFpbmVyLCAkKGAjJHt0aGlzLmlkUHJlZml4fW1lc3NhZ2UucXVpY2staW5wdXQtbWVzc2FnZWApKTtcblxuXHRcdGNvbnN0IHByb2dyZXNzQmFyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFByb2dyZXNzQmFyKGNvbnRhaW5lciwgdGhpcy5zdHlsZXMucHJvZ3Jlc3NCYXIpKTtcblx0XHRwcm9ncmVzc0Jhci5nZXRDb250YWluZXIoKS5jbGFzc0xpc3QuYWRkKCdxdWljay1pbnB1dC1wcm9ncmVzcycpO1xuXG5cdFx0Y29uc3Qgd2lkZ2V0ID0gZG9tLmFwcGVuZChjb250YWluZXIsICQoJy5xdWljay1pbnB1dC1odG1sLXdpZGdldCcpKTtcblx0XHR3aWRnZXQudGFiSW5kZXggPSAtMTtcblxuXHRcdGNvbnN0IGRlc2NyaXB0aW9uMSA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCAkKCcucXVpY2staW5wdXQtZGVzY3JpcHRpb24nKSk7XG5cblx0XHRjb25zdCBsaXN0SWQgPSB0aGlzLmlkUHJlZml4ICsgJ2xpc3QnO1xuXHRcdGNvbnN0IGxpc3QgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFF1aWNrSW5wdXRUcmVlLCBjb250YWluZXIsIHRoaXMub3B0aW9ucy5ob3ZlckRlbGVnYXRlLCB0aGlzLm9wdGlvbnMubGlua09wZW5lckRlbGVnYXRlLCBsaXN0SWQpKTtcblx0XHRpbnB1dEJveC5zZXRBdHRyaWJ1dGUoJ2FyaWEtY29udHJvbHMnLCBsaXN0SWQpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGxpc3Qub25EaWRDaGFuZ2VGb2N1cygoKSA9PiB7XG5cdFx0XHRpbnB1dEJveC5zZXRBdHRyaWJ1dGUoJ2FyaWEtYWN0aXZlZGVzY2VuZGFudCcsIGxpc3QuZ2V0QWN0aXZlRGVzY2VuZGFudCgpID8/ICcnKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIobGlzdC5vbkNoYW5nZWRBbGxWaXNpYmxlQ2hlY2tlZChjaGVja2VkID0+IHtcblx0XHRcdGNoZWNrQWxsLmNoZWNrZWQgPSBjaGVja2VkO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihsaXN0Lm9uQ2hhbmdlZFZpc2libGVDb3VudChjID0+IHtcblx0XHRcdHZpc2libGVDb3VudC5zZXRDb3VudChjKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIobGlzdC5vbkNoYW5nZWRDaGVja2VkQ291bnQoYyA9PiB7XG5cdFx0XHRjb3VudC5zZXRDb3VudChjKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIobGlzdC5vbkxlYXZlKCgpID0+IHtcblx0XHRcdC8vIERlZmVyIHRvIGF2b2lkIHRoZSBpbnB1dCBmaWVsZCByZWFjdGluZyB0byB0aGUgdHJpZ2dlcmluZyBrZXkuXG5cdFx0XHQvLyBUT0RPQFR5bGVyTGVvbmhhcmR0IGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8yMDM2NzVcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRpZiAoIXRoaXMuY29udHJvbGxlcikge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRpbnB1dEJveC5zZXRGb2N1cygpO1xuXHRcdFx0XHRpZiAodGhpcy5jb250cm9sbGVyIGluc3RhbmNlb2YgUXVpY2tQaWNrICYmIHRoaXMuY29udHJvbGxlci5jYW5TZWxlY3RNYW55KSB7XG5cdFx0XHRcdFx0bGlzdC5jbGVhckZvY3VzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIDApO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGZvY3VzVHJhY2tlciA9IGRvbS50cmFja0ZvY3VzKGNvbnRhaW5lcik7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZm9jdXNUcmFja2VyKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGNvbnRhaW5lciwgZG9tLkV2ZW50VHlwZS5GT0NVUywgZSA9PiB7XG5cdFx0XHRjb25zdCB1aSA9IHRoaXMuZ2V0VUkoKTtcblx0XHRcdGlmIChkb20uaXNBbmNlc3RvcihlLnJlbGF0ZWRUYXJnZXQgYXMgSFRNTEVsZW1lbnQsIHVpLmlucHV0Q29udGFpbmVyKSkge1xuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IHVpLmlucHV0Qm94LmlzU2VsZWN0aW9uQXRFbmQoKTtcblx0XHRcdFx0aWYgKHRoaXMuZW5kT2ZRdWlja0lucHV0Qm94Q29udGV4dC5nZXQoKSAhPT0gdmFsdWUpIHtcblx0XHRcdFx0XHR0aGlzLmVuZE9mUXVpY2tJbnB1dEJveENvbnRleHQuc2V0KHZhbHVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Ly8gSWdub3JlIGZvY3VzIGV2ZW50cyB3aXRoaW4gY29udGFpbmVyXG5cdFx0XHRpZiAoZG9tLmlzQW5jZXN0b3IoZS5yZWxhdGVkVGFyZ2V0IGFzIEhUTUxFbGVtZW50LCB1aS5jb250YWluZXIpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuaW5RdWlja0lucHV0Q29udGV4dC5zZXQodHJ1ZSk7XG5cdFx0XHR0aGlzLnByZXZpb3VzRm9jdXNFbGVtZW50ID0gZG9tLmlzSFRNTEVsZW1lbnQoZS5yZWxhdGVkVGFyZ2V0KSA/IGUucmVsYXRlZFRhcmdldCA6IHVuZGVmaW5lZDtcblx0XHR9LCB0cnVlKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZm9jdXNUcmFja2VyLm9uRGlkQmx1cigoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuZ2V0VUkoKS5pZ25vcmVGb2N1c091dCAmJiAhdGhpcy5vcHRpb25zLmlnbm9yZUZvY3VzT3V0KCkpIHtcblx0XHRcdFx0dGhpcy5oaWRlKFF1aWNrSW5wdXRIaWRlUmVhc29uLkJsdXIpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5pblF1aWNrSW5wdXRDb250ZXh0LnNldChmYWxzZSk7XG5cdFx0XHR0aGlzLmVuZE9mUXVpY2tJbnB1dEJveENvbnRleHQuc2V0KGZhbHNlKTtcblx0XHRcdHRoaXMucHJldmlvdXNGb2N1c0VsZW1lbnQgPSB1bmRlZmluZWQ7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGlucHV0Qm94Lm9uS2V5RG93bihfID0+IHtcblx0XHRcdGNvbnN0IHZhbHVlID0gdGhpcy5nZXRVSSgpLmlucHV0Qm94LmlzU2VsZWN0aW9uQXRFbmQoKTtcblx0XHRcdGlmICh0aGlzLmVuZE9mUXVpY2tJbnB1dEJveENvbnRleHQuZ2V0KCkgIT09IHZhbHVlKSB7XG5cdFx0XHRcdHRoaXMuZW5kT2ZRdWlja0lucHV0Qm94Q29udGV4dC5zZXQodmFsdWUpO1xuXHRcdFx0fVxuXHRcdFx0Ly8gQWxsb3cgc2NyZWVucmVhZGVycyB0byByZWFkIHdoYXQncyBpbiB0aGUgaW5wdXRcblx0XHRcdC8vIE5vdGU6IHRoaXMgd29ya3MgZm9yIGFycm93IGtleXMgYW5kIHNlbGVjdGlvbiBjaGFuZ2VzLFxuXHRcdFx0Ly8gYnV0IG5vdCBmb3IgZGVsZXRpb25zIHNpbmNlIHRoYXQgb2Z0ZW4gdHJpZ2dlcnMgYVxuXHRcdFx0Ly8gY2hhbmdlIGluIHRoZSBsaXN0LlxuXHRcdFx0aW5wdXRCb3gucmVtb3ZlQXR0cmlidXRlKCdhcmlhLWFjdGl2ZWRlc2NlbmRhbnQnKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihjb250YWluZXIsIGRvbS5FdmVudFR5cGUuRk9DVVMsIChlOiBGb2N1c0V2ZW50KSA9PiB7XG5cdFx0XHRpbnB1dEJveC5zZXRGb2N1cygpO1xuXHRcdH0pKTtcblx0XHQvLyBUT0RPOiBUdXJuIGludG8gY29tbWFuZHMgaW5zdGVhZCBvZiBoYW5kbGluZyBLRVlfRE9XTlxuXHRcdC8vIEtleWJpbmRpbmdzIGZvciB0aGUgcXVpY2tpbnB1dCB3aWRnZXQgYXMgYSB3aG9sZVxuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcihjb250YWluZXIsIGRvbS5FdmVudFR5cGUuS0VZX0RPV04sIChldmVudCkgPT4ge1xuXHRcdFx0aWYgKGRvbS5pc0FuY2VzdG9yKGV2ZW50LnRhcmdldCwgd2lkZ2V0KSkge1xuXHRcdFx0XHRyZXR1cm47IC8vIElnbm9yZSBldmVudCBpZiB0YXJnZXQgaXMgaW5zaWRlIHdpZGdldCB0byBhbGxvdyB0aGUgd2lkZ2V0IHRvIGhhbmRsZSB0aGUgZXZlbnQuXG5cdFx0XHR9XG5cdFx0XHRzd2l0Y2ggKGV2ZW50LmtleUNvZGUpIHtcblx0XHRcdFx0Y2FzZSBLZXlDb2RlLkVudGVyOlxuXHRcdFx0XHRcdGRvbS5FdmVudEhlbHBlci5zdG9wKGV2ZW50LCB0cnVlKTtcblx0XHRcdFx0XHRpZiAodGhpcy5lbmFibGVkKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm9uRGlkQWNjZXB0RW1pdHRlci5maXJlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIEtleUNvZGUuRXNjYXBlOlxuXHRcdFx0XHRcdGRvbS5FdmVudEhlbHBlci5zdG9wKGV2ZW50LCB0cnVlKTtcblx0XHRcdFx0XHR0aGlzLmhpZGUoUXVpY2tJbnB1dEhpZGVSZWFzb24uR2VzdHVyZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgS2V5Q29kZS5UYWI6XG5cdFx0XHRcdFx0aWYgKCFldmVudC5hbHRLZXkgJiYgIWV2ZW50LmN0cmxLZXkgJiYgIWV2ZW50Lm1ldGFLZXkpIHtcblx0XHRcdFx0XHRcdC8vIGRldGVjdCBvbmx5IHZpc2libGUgYWN0aW9uc1xuXHRcdFx0XHRcdFx0Y29uc3Qgc2VsZWN0b3JzID0gW1xuXHRcdFx0XHRcdFx0XHQnLnF1aWNrLWlucHV0LWxpc3QgLm1vbmFjby1hY3Rpb24tYmFyIC5hbHdheXMtdmlzaWJsZScsXG5cdFx0XHRcdFx0XHRcdCcucXVpY2staW5wdXQtbGlzdC1lbnRyeTpob3ZlciAubW9uYWNvLWFjdGlvbi1iYXInLFxuXHRcdFx0XHRcdFx0XHQnLm1vbmFjby1saXN0LXJvdy5mb2N1c2VkIC5tb25hY28tYWN0aW9uLWJhcidcblx0XHRcdFx0XHRcdF07XG5cblx0XHRcdFx0XHRcdGlmIChjb250YWluZXIuY2xhc3NMaXN0LmNvbnRhaW5zKCdzaG93LWNoZWNrYm94ZXMnKSkge1xuXHRcdFx0XHRcdFx0XHRzZWxlY3RvcnMucHVzaCgnaW5wdXQnKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHNlbGVjdG9ycy5wdXNoKCdpbnB1dFt0eXBlPXRleHRdJyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAodGhpcy5nZXRVSSgpLmxpc3QuZGlzcGxheWVkKSB7XG5cdFx0XHRcdFx0XHRcdHNlbGVjdG9ycy5wdXNoKCcubW9uYWNvLWxpc3QnKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdC8vIGZvY3VzIGxpbmtzIGlmIHRoZXJlIGFyZSBhbnlcblx0XHRcdFx0XHRcdGlmICh0aGlzLmdldFVJKCkubWVzc2FnZSkge1xuXHRcdFx0XHRcdFx0XHRzZWxlY3RvcnMucHVzaCgnLnF1aWNrLWlucHV0LW1lc3NhZ2UgYScpO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRpZiAodGhpcy5nZXRVSSgpLndpZGdldCkge1xuXHRcdFx0XHRcdFx0XHRpZiAoZG9tLmlzQW5jZXN0b3IoZXZlbnQudGFyZ2V0LCB0aGlzLmdldFVJKCkud2lkZ2V0KSkge1xuXHRcdFx0XHRcdFx0XHRcdC8vIGxldCB0aGUgd2lkZ2V0IGNvbnRyb2wgdGFiXG5cdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0c2VsZWN0b3JzLnB1c2goJy5xdWljay1pbnB1dC1odG1sLXdpZGdldCcpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y29uc3Qgc3RvcHMgPSBjb250YWluZXIucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oc2VsZWN0b3JzLmpvaW4oJywgJykpO1xuXHRcdFx0XHRcdFx0aWYgKCFldmVudC5zaGlmdEtleSAmJiBkb20uaXNBbmNlc3RvcihldmVudC50YXJnZXQsIHN0b3BzW3N0b3BzLmxlbmd0aCAtIDFdKSkge1xuXHRcdFx0XHRcdFx0XHRkb20uRXZlbnRIZWxwZXIuc3RvcChldmVudCwgdHJ1ZSk7XG5cdFx0XHRcdFx0XHRcdHN0b3BzWzBdLmZvY3VzKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoZXZlbnQuc2hpZnRLZXkgJiYgZG9tLmlzQW5jZXN0b3IoZXZlbnQudGFyZ2V0LCBzdG9wc1swXSkpIHtcblx0XHRcdFx0XHRcdFx0ZG9tLkV2ZW50SGVscGVyLnN0b3AoZXZlbnQsIHRydWUpO1xuXHRcdFx0XHRcdFx0XHRzdG9wc1tzdG9wcy5sZW5ndGggLSAxXS5mb2N1cygpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBEcmFnIGFuZCBEcm9wIHN1cHBvcnRcblx0XHR0aGlzLmRuZENvbnRyb2xsZXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0UXVpY2tJbnB1dERyYWdBbmREcm9wQ29udHJvbGxlcixcblx0XHRcdHRoaXMuX2NvbnRhaW5lcixcblx0XHRcdGNvbnRhaW5lcixcblx0XHRcdFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG5vZGU6IHRpdGxlQmFyLFxuXHRcdFx0XHRcdGluY2x1ZGVDaGlsZHJlbjogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bm9kZTogaGVhZGVyQ29udGFpbmVyLFxuXHRcdFx0XHRcdGluY2x1ZGVDaGlsZHJlbjogZmFsc2Vcblx0XHRcdFx0fVxuXHRcdFx0XSxcblx0XHRcdHRoaXMudmlld1N0YXRlXG5cdFx0KSk7XG5cblx0XHQvLyBEbkQgdXBkYXRlIGxheW91dFxuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdGNvbnN0IGRuZFZpZXdTdGF0ZSA9IHRoaXMuZG5kQ29udHJvbGxlcj8uZG5kVmlld1N0YXRlLnJlYWQocmVhZGVyKTtcblx0XHRcdGlmICghZG5kVmlld1N0YXRlKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGRuZFZpZXdTdGF0ZS50b3AgIT09IHVuZGVmaW5lZCAmJiBkbmRWaWV3U3RhdGUubGVmdCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHRoaXMudmlld1N0YXRlID0ge1xuXHRcdFx0XHRcdC4uLnRoaXMudmlld1N0YXRlLFxuXHRcdFx0XHRcdHRvcDogZG5kVmlld1N0YXRlLnRvcCxcblx0XHRcdFx0XHRsZWZ0OiBkbmRWaWV3U3RhdGUubGVmdFxuXHRcdFx0XHR9O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gUmVzZXQgcG9zaXRpb24vc2l6ZVxuXHRcdFx0XHR0aGlzLnZpZXdTdGF0ZSA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy51cGRhdGVMYXlvdXQoKTtcblxuXHRcdFx0Ly8gU2F2ZSBwb3NpdGlvblxuXHRcdFx0aWYgKGRuZFZpZXdTdGF0ZS5kb25lKSB7XG5cdFx0XHRcdHRoaXMuc2F2ZVZpZXdTdGF0ZSh0aGlzLnZpZXdTdGF0ZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy51aSA9IHtcblx0XHRcdGNvbnRhaW5lcixcblx0XHRcdHN0eWxlU2hlZXQsXG5cdFx0XHRsZWZ0QWN0aW9uQmFyLFxuXHRcdFx0dGl0bGVCYXIsXG5cdFx0XHR0aXRsZSxcblx0XHRcdGRlc2NyaXB0aW9uMSxcblx0XHRcdGRlc2NyaXB0aW9uMixcblx0XHRcdHdpZGdldCxcblx0XHRcdHJpZ2h0QWN0aW9uQmFyLFxuXHRcdFx0aW5saW5lQWN0aW9uQmFyLFxuXHRcdFx0Y2hlY2tBbGwsXG5cdFx0XHRpbnB1dENvbnRhaW5lcixcblx0XHRcdGZpbHRlckNvbnRhaW5lcixcblx0XHRcdGlucHV0Qm94LFxuXHRcdFx0dmlzaWJsZUNvdW50Q29udGFpbmVyLFxuXHRcdFx0dmlzaWJsZUNvdW50LFxuXHRcdFx0Y291bnRDb250YWluZXIsXG5cdFx0XHRjb3VudCxcblx0XHRcdG9rQ29udGFpbmVyLFxuXHRcdFx0b2ssXG5cdFx0XHRtZXNzYWdlLFxuXHRcdFx0Y3VzdG9tQnV0dG9uQ29udGFpbmVyLFxuXHRcdFx0Y3VzdG9tQnV0dG9uLFxuXHRcdFx0bGlzdCxcblx0XHRcdHByb2dyZXNzQmFyLFxuXHRcdFx0b25EaWRBY2NlcHQ6IHRoaXMub25EaWRBY2NlcHRFbWl0dGVyLmV2ZW50LFxuXHRcdFx0b25EaWRDdXN0b206IHRoaXMub25EaWRDdXN0b21FbWl0dGVyLmV2ZW50LFxuXHRcdFx0b25EaWRUcmlnZ2VyQnV0dG9uOiB0aGlzLm9uRGlkVHJpZ2dlckJ1dHRvbkVtaXR0ZXIuZXZlbnQsXG5cdFx0XHRpZ25vcmVGb2N1c091dDogZmFsc2UsXG5cdFx0XHRrZXlNb2RzOiB0aGlzLmtleU1vZHMsXG5cdFx0XHRzaG93OiBjb250cm9sbGVyID0+IHRoaXMuc2hvdyhjb250cm9sbGVyKSxcblx0XHRcdGhpZGU6ICgpID0+IHRoaXMuaGlkZSgpLFxuXHRcdFx0c2V0VmlzaWJpbGl0aWVzOiB2aXNpYmlsaXRpZXMgPT4gdGhpcy5zZXRWaXNpYmlsaXRpZXModmlzaWJpbGl0aWVzKSxcblx0XHRcdHNldEVuYWJsZWQ6IGVuYWJsZWQgPT4gdGhpcy5zZXRFbmFibGVkKGVuYWJsZWQpLFxuXHRcdFx0c2V0Q29udGV4dEtleTogY29udGV4dEtleSA9PiB0aGlzLm9wdGlvbnMuc2V0Q29udGV4dEtleShjb250ZXh0S2V5KSxcblx0XHRcdGxpbmtPcGVuZXJEZWxlZ2F0ZTogY29udGVudCA9PiB0aGlzLm9wdGlvbnMubGlua09wZW5lckRlbGVnYXRlKGNvbnRlbnQpXG5cdFx0fTtcblx0XHR0aGlzLnVwZGF0ZVN0eWxlcygpO1xuXHRcdHJldHVybiB0aGlzLnVpO1xuXHR9XG5cblx0cHJpdmF0ZSByZXBhcmVudFVJKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy51aSkge1xuXHRcdFx0dGhpcy5fY29udGFpbmVyID0gY29udGFpbmVyO1xuXHRcdFx0ZG9tLmFwcGVuZCh0aGlzLl9jb250YWluZXIsIHRoaXMudWkuY29udGFpbmVyKTtcblx0XHRcdHRoaXMuZG5kQ29udHJvbGxlcj8ucmVwYXJlbnRVSSh0aGlzLl9jb250YWluZXIpO1xuXHRcdH1cblx0fVxuXG5cdHBpY2s8VCBleHRlbmRzIElRdWlja1BpY2tJdGVtLCBPIGV4dGVuZHMgSVBpY2tPcHRpb25zPFQ+PihwaWNrczogUHJvbWlzZTxRdWlja1BpY2tJbnB1dDxUPltdPiB8IFF1aWNrUGlja0lucHV0PFQ+W10sIG9wdGlvbnM6IElQaWNrT3B0aW9uczxUPiA9IHt9LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4gPSBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTogUHJvbWlzZTwoTyBleHRlbmRzIHsgY2FuUGlja01hbnk6IHRydWUgfSA/IFRbXSA6IFQpIHwgdW5kZWZpbmVkPiB7XG5cdFx0dHlwZSBSID0gKE8gZXh0ZW5kcyB7IGNhblBpY2tNYW55OiB0cnVlIH0gPyBUW10gOiBUKSB8IHVuZGVmaW5lZDtcblx0XHRyZXR1cm4gbmV3IFByb21pc2U8Uj4oKGRvUmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRsZXQgcmVzb2x2ZSA9IChyZXN1bHQ6IFIpID0+IHtcblx0XHRcdFx0cmVzb2x2ZSA9IGRvUmVzb2x2ZTtcblx0XHRcdFx0b3B0aW9ucy5vbktleU1vZHM/LihpbnB1dC5rZXlNb2RzKTtcblx0XHRcdFx0ZG9SZXNvbHZlKHJlc3VsdCk7XG5cdFx0XHR9O1xuXHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdHJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaW5wdXQgPSB0aGlzLmNyZWF0ZVF1aWNrUGljazxUPih7IHVzZVNlcGFyYXRvcnM6IHRydWUgfSk7XG5cdFx0XHRsZXQgYWN0aXZlSXRlbTogVCB8IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gW1xuXHRcdFx0XHRpbnB1dCxcblx0XHRcdFx0aW5wdXQub25EaWRBY2NlcHQoKCkgPT4ge1xuXHRcdFx0XHRcdGlmIChpbnB1dC5jYW5TZWxlY3RNYW55KSB7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKDxSPmlucHV0LnNlbGVjdGVkSXRlbXMuc2xpY2UoKSk7XG5cdFx0XHRcdFx0XHRpbnB1dC5oaWRlKCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGlucHV0LmFjdGl2ZUl0ZW1zWzBdO1xuXHRcdFx0XHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRcdFx0XHRyZXNvbHZlKDxSPnJlc3VsdCk7XG5cdFx0XHRcdFx0XHRcdGlucHV0LmhpZGUoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pLFxuXHRcdFx0XHRpbnB1dC5vbkRpZENoYW5nZUFjdGl2ZShpdGVtcyA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgZm9jdXNlZCA9IGl0ZW1zWzBdO1xuXHRcdFx0XHRcdGlmIChmb2N1c2VkICYmIG9wdGlvbnMub25EaWRGb2N1cykge1xuXHRcdFx0XHRcdFx0b3B0aW9ucy5vbkRpZEZvY3VzKGZvY3VzZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSksXG5cdFx0XHRcdGlucHV0Lm9uRGlkQ2hhbmdlU2VsZWN0aW9uKGl0ZW1zID0+IHtcblx0XHRcdFx0XHRpZiAoIWlucHV0LmNhblNlbGVjdE1hbnkpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGl0ZW1zWzBdO1xuXHRcdFx0XHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRcdFx0XHRyZXNvbHZlKDxSPnJlc3VsdCk7XG5cdFx0XHRcdFx0XHRcdGlucHV0LmhpZGUoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pLFxuXHRcdFx0XHRpbnB1dC5vbkRpZFRyaWdnZXJJdGVtQnV0dG9uKGV2ZW50ID0+IG9wdGlvbnMub25EaWRUcmlnZ2VySXRlbUJ1dHRvbiAmJiBvcHRpb25zLm9uRGlkVHJpZ2dlckl0ZW1CdXR0b24oe1xuXHRcdFx0XHRcdC4uLmV2ZW50LFxuXHRcdFx0XHRcdHJlbW92ZUl0ZW06ICgpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGluZGV4ID0gaW5wdXQuaXRlbXMuaW5kZXhPZihldmVudC5pdGVtKTtcblx0XHRcdFx0XHRcdGlmIChpbmRleCAhPT0gLTEpIHtcblx0XHRcdFx0XHRcdFx0Y29uc3QgaXRlbXMgPSBpbnB1dC5pdGVtcy5zbGljZSgpO1xuXHRcdFx0XHRcdFx0XHRjb25zdCByZW1vdmVkID0gaXRlbXMuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdFx0XHRcdFx0Y29uc3QgYWN0aXZlSXRlbXMgPSBpbnB1dC5hY3RpdmVJdGVtcy5maWx0ZXIoYWN0aXZlSXRlbSA9PiBhY3RpdmVJdGVtICE9PSByZW1vdmVkWzBdKTtcblx0XHRcdFx0XHRcdFx0Y29uc3Qga2VlcFNjcm9sbFBvc2l0aW9uQmVmb3JlID0gaW5wdXQua2VlcFNjcm9sbFBvc2l0aW9uO1xuXHRcdFx0XHRcdFx0XHRpbnB1dC5rZWVwU2Nyb2xsUG9zaXRpb24gPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRpbnB1dC5pdGVtcyA9IGl0ZW1zO1xuXHRcdFx0XHRcdFx0XHRpZiAoYWN0aXZlSXRlbXMpIHtcblx0XHRcdFx0XHRcdFx0XHRpbnB1dC5hY3RpdmVJdGVtcyA9IGFjdGl2ZUl0ZW1zO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGlucHV0LmtlZXBTY3JvbGxQb3NpdGlvbiA9IGtlZXBTY3JvbGxQb3NpdGlvbkJlZm9yZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKSxcblx0XHRcdFx0aW5wdXQub25EaWRUcmlnZ2VyU2VwYXJhdG9yQnV0dG9uKGV2ZW50ID0+IG9wdGlvbnMub25EaWRUcmlnZ2VyU2VwYXJhdG9yQnV0dG9uPy4oZXZlbnQpKSxcblx0XHRcdFx0aW5wdXQub25EaWRDaGFuZ2VWYWx1ZSh2YWx1ZSA9PiB7XG5cdFx0XHRcdFx0aWYgKGFjdGl2ZUl0ZW0gJiYgIXZhbHVlICYmIChpbnB1dC5hY3RpdmVJdGVtcy5sZW5ndGggIT09IDEgfHwgaW5wdXQuYWN0aXZlSXRlbXNbMF0gIT09IGFjdGl2ZUl0ZW0pKSB7XG5cdFx0XHRcdFx0XHRpbnB1dC5hY3RpdmVJdGVtcyA9IFthY3RpdmVJdGVtXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pLFxuXHRcdFx0XHR0b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiB7XG5cdFx0XHRcdFx0aW5wdXQuaGlkZSgpO1xuXHRcdFx0XHR9KSxcblx0XHRcdFx0aW5wdXQub25EaWRIaWRlKCgpID0+IHtcblx0XHRcdFx0XHRkaXNwb3NlKGRpc3Bvc2FibGVzKTtcblx0XHRcdFx0XHRyZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0XHRcdH0pLFxuXHRcdFx0XTtcblx0XHRcdGlucHV0LnRpdGxlID0gb3B0aW9ucy50aXRsZTtcblx0XHRcdGlmIChvcHRpb25zLnZhbHVlKSB7XG5cdFx0XHRcdGlucHV0LnZhbHVlID0gb3B0aW9ucy52YWx1ZTtcblx0XHRcdH1cblx0XHRcdGlucHV0LmNhblNlbGVjdE1hbnkgPSAhIW9wdGlvbnMuY2FuUGlja01hbnk7XG5cdFx0XHRpbnB1dC5wbGFjZWhvbGRlciA9IG9wdGlvbnMucGxhY2VIb2xkZXI7XG5cdFx0XHRpbnB1dC5pZ25vcmVGb2N1c091dCA9ICEhb3B0aW9ucy5pZ25vcmVGb2N1c0xvc3Q7XG5cdFx0XHRpbnB1dC5tYXRjaE9uRGVzY3JpcHRpb24gPSAhIW9wdGlvbnMubWF0Y2hPbkRlc2NyaXB0aW9uO1xuXHRcdFx0aW5wdXQubWF0Y2hPbkRldGFpbCA9ICEhb3B0aW9ucy5tYXRjaE9uRGV0YWlsO1xuXHRcdFx0aW5wdXQubWF0Y2hPbkxhYmVsID0gKG9wdGlvbnMubWF0Y2hPbkxhYmVsID09PSB1bmRlZmluZWQpIHx8IG9wdGlvbnMubWF0Y2hPbkxhYmVsOyAvLyBkZWZhdWx0IHRvIHRydWVcblx0XHRcdGlucHV0LnF1aWNrTmF2aWdhdGUgPSBvcHRpb25zLnF1aWNrTmF2aWdhdGU7XG5cdFx0XHRpbnB1dC5oaWRlSW5wdXQgPSAhIW9wdGlvbnMuaGlkZUlucHV0O1xuXHRcdFx0aW5wdXQuY29udGV4dEtleSA9IG9wdGlvbnMuY29udGV4dEtleTtcblx0XHRcdGlucHV0LmJ1c3kgPSB0cnVlO1xuXHRcdFx0UHJvbWlzZS5hbGwoW3BpY2tzLCBvcHRpb25zLmFjdGl2ZUl0ZW1dKVxuXHRcdFx0XHQudGhlbigoW2l0ZW1zLCBfYWN0aXZlSXRlbV0pID0+IHtcblx0XHRcdFx0XHRhY3RpdmVJdGVtID0gX2FjdGl2ZUl0ZW07XG5cdFx0XHRcdFx0aW5wdXQuYnVzeSA9IGZhbHNlO1xuXHRcdFx0XHRcdGlucHV0Lml0ZW1zID0gaXRlbXM7XG5cdFx0XHRcdFx0aWYgKGlucHV0LmNhblNlbGVjdE1hbnkpIHtcblx0XHRcdFx0XHRcdGlucHV0LnNlbGVjdGVkSXRlbXMgPSBpdGVtcy5maWx0ZXIoaXRlbSA9PiBpdGVtLnR5cGUgIT09ICdzZXBhcmF0b3InICYmIGl0ZW0ucGlja2VkKSBhcyBUW107XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChhY3RpdmVJdGVtKSB7XG5cdFx0XHRcdFx0XHRpbnB1dC5hY3RpdmVJdGVtcyA9IFthY3RpdmVJdGVtXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0aW5wdXQuc2hvdygpO1xuXHRcdFx0UHJvbWlzZS5yZXNvbHZlKHBpY2tzKS50aGVuKHVuZGVmaW5lZCwgZXJyID0+IHtcblx0XHRcdFx0cmVqZWN0KGVycik7XG5cdFx0XHRcdGlucHV0LmhpZGUoKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRWYWxpZGF0aW9uT25JbnB1dChpbnB1dDogSUlucHV0Qm94LCB2YWxpZGF0aW9uUmVzdWx0OiBzdHJpbmcgfCB7XG5cdFx0Y29udGVudDogc3RyaW5nO1xuXHRcdHNldmVyaXR5OiBTZXZlcml0eTtcblx0fSB8IG51bGwgfCB1bmRlZmluZWQpIHtcblx0XHRpZiAodmFsaWRhdGlvblJlc3VsdCAmJiBpc1N0cmluZyh2YWxpZGF0aW9uUmVzdWx0KSkge1xuXHRcdFx0aW5wdXQuc2V2ZXJpdHkgPSBTZXZlcml0eS5FcnJvcjtcblx0XHRcdGlucHV0LnZhbGlkYXRpb25NZXNzYWdlID0gdmFsaWRhdGlvblJlc3VsdDtcblx0XHR9IGVsc2UgaWYgKHZhbGlkYXRpb25SZXN1bHQgJiYgIWlzU3RyaW5nKHZhbGlkYXRpb25SZXN1bHQpKSB7XG5cdFx0XHRpbnB1dC5zZXZlcml0eSA9IHZhbGlkYXRpb25SZXN1bHQuc2V2ZXJpdHk7XG5cdFx0XHRpbnB1dC52YWxpZGF0aW9uTWVzc2FnZSA9IHZhbGlkYXRpb25SZXN1bHQuY29udGVudDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aW5wdXQuc2V2ZXJpdHkgPSBTZXZlcml0eS5JZ25vcmU7XG5cdFx0XHRpbnB1dC52YWxpZGF0aW9uTWVzc2FnZSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRpbnB1dChvcHRpb25zOiBJSW5wdXRPcHRpb25zID0ge30sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiA9IENhbmNlbGxhdGlvblRva2VuLk5vbmUpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+KChyZXNvbHZlKSA9PiB7XG5cdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBpbnB1dCA9IHRoaXMuY3JlYXRlSW5wdXRCb3goKTtcblx0XHRcdGNvbnN0IHZhbGlkYXRlSW5wdXQgPSBvcHRpb25zLnZhbGlkYXRlSW5wdXQgfHwgKCgpID0+IDxQcm9taXNlPHVuZGVmaW5lZD4+UHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCkpO1xuXHRcdFx0Y29uc3Qgb25EaWRWYWx1ZUNoYW5nZSA9IEV2ZW50LmRlYm91bmNlKGlucHV0Lm9uRGlkQ2hhbmdlVmFsdWUsIChsYXN0LCBjdXIpID0+IGN1ciwgMTAwKTtcblx0XHRcdGxldCB2YWxpZGF0aW9uVmFsdWUgPSBvcHRpb25zLnZhbHVlIHx8ICcnO1xuXHRcdFx0bGV0IHZhbGlkYXRpb24gPSBQcm9taXNlLnJlc29sdmUodmFsaWRhdGVJbnB1dCh2YWxpZGF0aW9uVmFsdWUpKTtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gW1xuXHRcdFx0XHRpbnB1dCxcblx0XHRcdFx0b25EaWRWYWx1ZUNoYW5nZSh2YWx1ZSA9PiB7XG5cdFx0XHRcdFx0aWYgKHZhbHVlICE9PSB2YWxpZGF0aW9uVmFsdWUpIHtcblx0XHRcdFx0XHRcdHZhbGlkYXRpb24gPSBQcm9taXNlLnJlc29sdmUodmFsaWRhdGVJbnB1dCh2YWx1ZSkpO1xuXHRcdFx0XHRcdFx0dmFsaWRhdGlvblZhbHVlID0gdmFsdWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHZhbGlkYXRpb24udGhlbihyZXN1bHQgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKHZhbHVlID09PSB2YWxpZGF0aW9uVmFsdWUpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5zZXRWYWxpZGF0aW9uT25JbnB1dChpbnB1dCwgcmVzdWx0KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSksXG5cdFx0XHRcdGlucHV0Lm9uRGlkQWNjZXB0KCgpID0+IHtcblx0XHRcdFx0XHRjb25zdCB2YWx1ZSA9IGlucHV0LnZhbHVlO1xuXHRcdFx0XHRcdGlmICh2YWx1ZSAhPT0gdmFsaWRhdGlvblZhbHVlKSB7XG5cdFx0XHRcdFx0XHR2YWxpZGF0aW9uID0gUHJvbWlzZS5yZXNvbHZlKHZhbGlkYXRlSW5wdXQodmFsdWUpKTtcblx0XHRcdFx0XHRcdHZhbGlkYXRpb25WYWx1ZSA9IHZhbHVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR2YWxpZGF0aW9uLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdFx0XHRcdGlmICghcmVzdWx0IHx8ICghaXNTdHJpbmcocmVzdWx0KSAmJiByZXN1bHQuc2V2ZXJpdHkgIT09IFNldmVyaXR5LkVycm9yKSkge1xuXHRcdFx0XHRcdFx0XHRyZXNvbHZlKHZhbHVlKTtcblx0XHRcdFx0XHRcdFx0aW5wdXQuaGlkZSgpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIGlmICh2YWx1ZSA9PT0gdmFsaWRhdGlvblZhbHVlKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuc2V0VmFsaWRhdGlvbk9uSW5wdXQoaW5wdXQsIHJlc3VsdCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pLFxuXHRcdFx0XHR0b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiB7XG5cdFx0XHRcdFx0aW5wdXQuaGlkZSgpO1xuXHRcdFx0XHR9KSxcblx0XHRcdFx0aW5wdXQub25EaWRIaWRlKCgpID0+IHtcblx0XHRcdFx0XHRkaXNwb3NlKGRpc3Bvc2FibGVzKTtcblx0XHRcdFx0XHRyZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0XHRcdH0pLFxuXHRcdFx0XTtcblxuXHRcdFx0aW5wdXQudGl0bGUgPSBvcHRpb25zLnRpdGxlO1xuXHRcdFx0aW5wdXQudmFsdWUgPSBvcHRpb25zLnZhbHVlIHx8ICcnO1xuXHRcdFx0aW5wdXQudmFsdWVTZWxlY3Rpb24gPSBvcHRpb25zLnZhbHVlU2VsZWN0aW9uO1xuXHRcdFx0aW5wdXQucHJvbXB0ID0gb3B0aW9ucy5wcm9tcHQ7XG5cdFx0XHRpbnB1dC5wbGFjZWhvbGRlciA9IG9wdGlvbnMucGxhY2VIb2xkZXI7XG5cdFx0XHRpbnB1dC5wYXNzd29yZCA9ICEhb3B0aW9ucy5wYXNzd29yZDtcblx0XHRcdGlucHV0Lmlnbm9yZUZvY3VzT3V0ID0gISFvcHRpb25zLmlnbm9yZUZvY3VzTG9zdDtcblx0XHRcdGlucHV0LnNob3coKTtcblx0XHR9KTtcblx0fVxuXG5cdGJhY2tCdXR0b24gPSBiYWNrQnV0dG9uO1xuXG5cdGNyZWF0ZVF1aWNrUGljazxUIGV4dGVuZHMgSVF1aWNrUGlja0l0ZW0+KG9wdGlvbnM6IHsgdXNlU2VwYXJhdG9yczogdHJ1ZSB9KTogSVF1aWNrUGljazxULCB7IHVzZVNlcGFyYXRvcnM6IHRydWUgfT47XG5cdGNyZWF0ZVF1aWNrUGljazxUIGV4dGVuZHMgSVF1aWNrUGlja0l0ZW0+KG9wdGlvbnM/OiB7IHVzZVNlcGFyYXRvcnM6IGJvb2xlYW4gfSk6IElRdWlja1BpY2s8VCwgeyB1c2VTZXBhcmF0b3JzOiBmYWxzZSB9Pjtcblx0Y3JlYXRlUXVpY2tQaWNrPFQgZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbT4ob3B0aW9uczogeyB1c2VTZXBhcmF0b3JzOiBib29sZWFuIH0gPSB7IHVzZVNlcGFyYXRvcnM6IGZhbHNlIH0pOiBJUXVpY2tQaWNrPFQsIHsgdXNlU2VwYXJhdG9yczogYm9vbGVhbiB9PiB7XG5cdFx0Y29uc3QgdWkgPSB0aGlzLmdldFVJKHRydWUpO1xuXHRcdHJldHVybiBuZXcgUXVpY2tQaWNrPFQsIHR5cGVvZiBvcHRpb25zPih1aSk7XG5cdH1cblxuXHRjcmVhdGVJbnB1dEJveCgpOiBJSW5wdXRCb3gge1xuXHRcdGNvbnN0IHVpID0gdGhpcy5nZXRVSSh0cnVlKTtcblx0XHRyZXR1cm4gbmV3IElucHV0Qm94KHVpKTtcblx0fVxuXG5cdHNldEFsaWdubWVudChhbGlnbm1lbnQ6ICd0b3AnIHwgJ2NlbnRlcicgfCB7IHRvcDogbnVtYmVyOyBsZWZ0OiBudW1iZXIgfSk6IHZvaWQge1xuXHRcdHRoaXMuZG5kQ29udHJvbGxlcj8uc2V0QWxpZ25tZW50KGFsaWdubWVudCk7XG5cdH1cblxuXHRjcmVhdGVRdWlja1dpZGdldCgpOiBJUXVpY2tXaWRnZXQge1xuXHRcdGNvbnN0IHVpID0gdGhpcy5nZXRVSSh0cnVlKTtcblx0XHRyZXR1cm4gbmV3IFF1aWNrV2lkZ2V0KHVpKTtcblx0fVxuXG5cdHByaXZhdGUgc2hvdyhjb250cm9sbGVyOiBJUXVpY2tJbnB1dCkge1xuXHRcdGNvbnN0IHVpID0gdGhpcy5nZXRVSSh0cnVlKTtcblx0XHR0aGlzLm9uU2hvd0VtaXR0ZXIuZmlyZSgpO1xuXHRcdGNvbnN0IG9sZENvbnRyb2xsZXIgPSB0aGlzLmNvbnRyb2xsZXI7XG5cdFx0dGhpcy5jb250cm9sbGVyID0gY29udHJvbGxlcjtcblx0XHRvbGRDb250cm9sbGVyPy5kaWRIaWRlKCk7XG5cblx0XHR0aGlzLnNldEVuYWJsZWQodHJ1ZSk7XG5cdFx0dWkubGVmdEFjdGlvbkJhci5jbGVhcigpO1xuXHRcdHVpLnRpdGxlLnRleHRDb250ZW50ID0gJyc7XG5cdFx0dWkuZGVzY3JpcHRpb24xLnRleHRDb250ZW50ID0gJyc7XG5cdFx0dWkuZGVzY3JpcHRpb24yLnRleHRDb250ZW50ID0gJyc7XG5cdFx0ZG9tLnJlc2V0KHVpLndpZGdldCk7XG5cdFx0dWkucmlnaHRBY3Rpb25CYXIuY2xlYXIoKTtcblx0XHR1aS5pbmxpbmVBY3Rpb25CYXIuY2xlYXIoKTtcblx0XHR1aS5jaGVja0FsbC5jaGVja2VkID0gZmFsc2U7XG5cdFx0Ly8gdWkuaW5wdXRCb3gudmFsdWUgPSAnJzsgQXZvaWQgdHJpZ2dlcmluZyBhbiBldmVudC5cblx0XHR1aS5pbnB1dEJveC5wbGFjZWhvbGRlciA9ICcnO1xuXHRcdHVpLmlucHV0Qm94LnBhc3N3b3JkID0gZmFsc2U7XG5cdFx0dWkuaW5wdXRCb3guc2hvd0RlY29yYXRpb24oU2V2ZXJpdHkuSWdub3JlKTtcblx0XHR1aS52aXNpYmxlQ291bnQuc2V0Q291bnQoMCk7XG5cdFx0dWkuY291bnQuc2V0Q291bnQoMCk7XG5cdFx0ZG9tLnJlc2V0KHVpLm1lc3NhZ2UpO1xuXHRcdHVpLnByb2dyZXNzQmFyLnN0b3AoKTtcblx0XHR1aS5saXN0LnNldEVsZW1lbnRzKFtdKTtcblx0XHR1aS5saXN0Lm1hdGNoT25EZXNjcmlwdGlvbiA9IGZhbHNlO1xuXHRcdHVpLmxpc3QubWF0Y2hPbkRldGFpbCA9IGZhbHNlO1xuXHRcdHVpLmxpc3QubWF0Y2hPbkxhYmVsID0gdHJ1ZTtcblx0XHR1aS5saXN0LnNvcnRCeUxhYmVsID0gdHJ1ZTtcblx0XHR1aS5pZ25vcmVGb2N1c091dCA9IGZhbHNlO1xuXHRcdHVpLmlucHV0Qm94LnRvZ2dsZXMgPSB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBiYWNrS2V5YmluZGluZ0xhYmVsID0gdGhpcy5vcHRpb25zLmJhY2tLZXliaW5kaW5nTGFiZWwoKTtcblx0XHRiYWNrQnV0dG9uLnRvb2x0aXAgPSBiYWNrS2V5YmluZGluZ0xhYmVsID8gbG9jYWxpemUoJ3F1aWNrSW5wdXQuYmFja1dpdGhLZXliaW5kaW5nJywgXCJCYWNrICh7MH0pXCIsIGJhY2tLZXliaW5kaW5nTGFiZWwpIDogbG9jYWxpemUoJ3F1aWNrSW5wdXQuYmFjaycsIFwiQmFja1wiKTtcblxuXHRcdHVpLmNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJyc7XG5cdFx0dGhpcy51cGRhdGVMYXlvdXQoKTtcblx0XHR0aGlzLmRuZENvbnRyb2xsZXI/LmxheW91dENvbnRhaW5lcigpO1xuXHRcdHVpLmlucHV0Qm94LnNldEZvY3VzKCk7XG5cdFx0dGhpcy5xdWlja0lucHV0VHlwZUNvbnRleHQuc2V0KGNvbnRyb2xsZXIudHlwZSk7XG5cdH1cblxuXHRpc1Zpc2libGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy51aSAmJiB0aGlzLnVpLmNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ICE9PSAnbm9uZSc7XG5cdH1cblxuXHRwcml2YXRlIHNldFZpc2liaWxpdGllcyh2aXNpYmlsaXRpZXM6IFZpc2liaWxpdGllcykge1xuXHRcdGNvbnN0IHVpID0gdGhpcy5nZXRVSSgpO1xuXHRcdHVpLnRpdGxlLnN0eWxlLmRpc3BsYXkgPSB2aXNpYmlsaXRpZXMudGl0bGUgPyAnJyA6ICdub25lJztcblx0XHR1aS5kZXNjcmlwdGlvbjEuc3R5bGUuZGlzcGxheSA9IHZpc2liaWxpdGllcy5kZXNjcmlwdGlvbiAmJiAodmlzaWJpbGl0aWVzLmlucHV0Qm94IHx8IHZpc2liaWxpdGllcy5jaGVja0FsbCkgPyAnJyA6ICdub25lJztcblx0XHR1aS5kZXNjcmlwdGlvbjIuc3R5bGUuZGlzcGxheSA9IHZpc2liaWxpdGllcy5kZXNjcmlwdGlvbiAmJiAhKHZpc2liaWxpdGllcy5pbnB1dEJveCB8fCB2aXNpYmlsaXRpZXMuY2hlY2tBbGwpID8gJycgOiAnbm9uZSc7XG5cdFx0dWkuY2hlY2tBbGwuc3R5bGUuZGlzcGxheSA9IHZpc2liaWxpdGllcy5jaGVja0FsbCA/ICcnIDogJ25vbmUnO1xuXHRcdHVpLmlucHV0Q29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSB2aXNpYmlsaXRpZXMuaW5wdXRCb3ggPyAnJyA6ICdub25lJztcblx0XHR1aS5maWx0ZXJDb250YWluZXIuc3R5bGUuZGlzcGxheSA9IHZpc2liaWxpdGllcy5pbnB1dEJveCA/ICcnIDogJ25vbmUnO1xuXHRcdHVpLnZpc2libGVDb3VudENvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gdmlzaWJpbGl0aWVzLnZpc2libGVDb3VudCA/ICcnIDogJ25vbmUnO1xuXHRcdHVpLmNvdW50Q29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSB2aXNpYmlsaXRpZXMuY291bnQgPyAnJyA6ICdub25lJztcblx0XHR1aS5va0NvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gdmlzaWJpbGl0aWVzLm9rID8gJycgOiAnbm9uZSc7XG5cdFx0dWkuY3VzdG9tQnV0dG9uQ29udGFpbmVyLnN0eWxlLmRpc3BsYXkgPSB2aXNpYmlsaXRpZXMuY3VzdG9tQnV0dG9uID8gJycgOiAnbm9uZSc7XG5cdFx0dWkubWVzc2FnZS5zdHlsZS5kaXNwbGF5ID0gdmlzaWJpbGl0aWVzLm1lc3NhZ2UgPyAnJyA6ICdub25lJztcblx0XHR1aS5wcm9ncmVzc0Jhci5nZXRDb250YWluZXIoKS5zdHlsZS5kaXNwbGF5ID0gdmlzaWJpbGl0aWVzLnByb2dyZXNzQmFyID8gJycgOiAnbm9uZSc7XG5cdFx0dWkubGlzdC5kaXNwbGF5ZWQgPSAhIXZpc2liaWxpdGllcy5saXN0O1xuXHRcdHVpLmNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdzaG93LWNoZWNrYm94ZXMnLCAhIXZpc2liaWxpdGllcy5jaGVja0JveCk7XG5cdFx0dWkuY29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGRlbi1pbnB1dCcsICF2aXNpYmlsaXRpZXMuaW5wdXRCb3ggJiYgIXZpc2liaWxpdGllcy5kZXNjcmlwdGlvbik7XG5cdFx0dGhpcy51cGRhdGVMYXlvdXQoKTsgLy8gVE9ET1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRFbmFibGVkKGVuYWJsZWQ6IGJvb2xlYW4pIHtcblx0XHRpZiAoZW5hYmxlZCAhPT0gdGhpcy5lbmFibGVkKSB7XG5cdFx0XHR0aGlzLmVuYWJsZWQgPSBlbmFibGVkO1xuXHRcdFx0Zm9yIChjb25zdCBpdGVtIG9mIHRoaXMuZ2V0VUkoKS5sZWZ0QWN0aW9uQmFyLnZpZXdJdGVtcykge1xuXHRcdFx0XHQoaXRlbSBhcyBBY3Rpb25WaWV3SXRlbSkuYWN0aW9uLmVuYWJsZWQgPSBlbmFibGVkO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChjb25zdCBpdGVtIG9mIHRoaXMuZ2V0VUkoKS5yaWdodEFjdGlvbkJhci52aWV3SXRlbXMpIHtcblx0XHRcdFx0KGl0ZW0gYXMgQWN0aW9uVmlld0l0ZW0pLmFjdGlvbi5lbmFibGVkID0gZW5hYmxlZDtcblx0XHRcdH1cblx0XHRcdHRoaXMuZ2V0VUkoKS5jaGVja0FsbC5kaXNhYmxlZCA9ICFlbmFibGVkO1xuXHRcdFx0dGhpcy5nZXRVSSgpLmlucHV0Qm94LmVuYWJsZWQgPSBlbmFibGVkO1xuXHRcdFx0dGhpcy5nZXRVSSgpLm9rLmVuYWJsZWQgPSBlbmFibGVkO1xuXHRcdFx0dGhpcy5nZXRVSSgpLmxpc3QuZW5hYmxlZCA9IGVuYWJsZWQ7XG5cdFx0fVxuXHR9XG5cblx0aGlkZShyZWFzb24/OiBRdWlja0lucHV0SGlkZVJlYXNvbikge1xuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSB0aGlzLmNvbnRyb2xsZXI7XG5cdFx0aWYgKCFjb250cm9sbGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnRyb2xsZXIud2lsbEhpZGUocmVhc29uKTtcblxuXHRcdGNvbnN0IGNvbnRhaW5lciA9IHRoaXMudWk/LmNvbnRhaW5lcjtcblx0XHRjb25zdCBmb2N1c0NoYW5nZWQgPSBjb250YWluZXIgJiYgIWRvbS5pc0FuY2VzdG9yT2ZBY3RpdmVFbGVtZW50KGNvbnRhaW5lcik7XG5cdFx0dGhpcy5jb250cm9sbGVyID0gbnVsbDtcblx0XHR0aGlzLm9uSGlkZUVtaXR0ZXIuZmlyZSgpO1xuXHRcdGlmIChjb250YWluZXIpIHtcblx0XHRcdGNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdH1cblx0XHRpZiAoIWZvY3VzQ2hhbmdlZCkge1xuXHRcdFx0bGV0IGN1cnJlbnRFbGVtZW50ID0gdGhpcy5wcmV2aW91c0ZvY3VzRWxlbWVudDtcblx0XHRcdHdoaWxlIChjdXJyZW50RWxlbWVudCAmJiAhY3VycmVudEVsZW1lbnQub2Zmc2V0UGFyZW50KSB7XG5cdFx0XHRcdGN1cnJlbnRFbGVtZW50ID0gY3VycmVudEVsZW1lbnQucGFyZW50RWxlbWVudCA/PyB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAoY3VycmVudEVsZW1lbnQ/Lm9mZnNldFBhcmVudCkge1xuXHRcdFx0XHRjdXJyZW50RWxlbWVudC5mb2N1cygpO1xuXHRcdFx0XHR0aGlzLnByZXZpb3VzRm9jdXNFbGVtZW50ID0gdW5kZWZpbmVkO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5vcHRpb25zLnJldHVybkZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnRyb2xsZXIuZGlkSGlkZShyZWFzb24pO1xuXHR9XG5cblx0Zm9jdXMoKSB7XG5cdFx0aWYgKHRoaXMuaXNWaXNpYmxlKCkpIHtcblx0XHRcdGNvbnN0IHVpID0gdGhpcy5nZXRVSSgpO1xuXHRcdFx0aWYgKHVpLmlucHV0Qm94LmVuYWJsZWQpIHtcblx0XHRcdFx0dWkuaW5wdXRCb3guc2V0Rm9jdXMoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHVpLmxpc3QuZG9tRm9jdXMoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHR0b2dnbGUoKSB7XG5cdFx0aWYgKHRoaXMuaXNWaXNpYmxlKCkgJiYgdGhpcy5jb250cm9sbGVyIGluc3RhbmNlb2YgUXVpY2tQaWNrICYmIHRoaXMuY29udHJvbGxlci5jYW5TZWxlY3RNYW55KSB7XG5cdFx0XHR0aGlzLmdldFVJKCkubGlzdC50b2dnbGVDaGVja2JveCgpO1xuXHRcdH1cblx0fVxuXG5cdHRvZ2dsZUhvdmVyKCkge1xuXHRcdGlmICh0aGlzLmlzVmlzaWJsZSgpICYmIHRoaXMuY29udHJvbGxlciBpbnN0YW5jZW9mIFF1aWNrUGljaykge1xuXHRcdFx0dGhpcy5nZXRVSSgpLmxpc3QudG9nZ2xlSG92ZXIoKTtcblx0XHR9XG5cdH1cblxuXHRuYXZpZ2F0ZShuZXh0OiBib29sZWFuLCBxdWlja05hdmlnYXRlPzogSVF1aWNrTmF2aWdhdGVDb25maWd1cmF0aW9uKSB7XG5cdFx0aWYgKHRoaXMuaXNWaXNpYmxlKCkgJiYgdGhpcy5nZXRVSSgpLmxpc3QuZGlzcGxheWVkKSB7XG5cdFx0XHR0aGlzLmdldFVJKCkubGlzdC5mb2N1cyhuZXh0ID8gUXVpY2tQaWNrRm9jdXMuTmV4dCA6IFF1aWNrUGlja0ZvY3VzLlByZXZpb3VzKTtcblx0XHRcdGlmIChxdWlja05hdmlnYXRlICYmIHRoaXMuY29udHJvbGxlciBpbnN0YW5jZW9mIFF1aWNrUGljaykge1xuXHRcdFx0XHR0aGlzLmNvbnRyb2xsZXIucXVpY2tOYXZpZ2F0ZSA9IHF1aWNrTmF2aWdhdGU7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgYWNjZXB0KGtleU1vZHM6IElLZXlNb2RzID0geyBhbHQ6IGZhbHNlLCBjdHJsQ21kOiBmYWxzZSB9KSB7XG5cdFx0Ly8gV2hlbiBhY2NlcHRpbmcgdGhlIGl0ZW0gcHJvZ3JhbW1hdGljYWxseSwgaXQgaXMgaW1wb3J0YW50IHRoYXRcblx0XHQvLyB3ZSB1cGRhdGUgYGtleU1vZHNgIGVpdGhlciBmcm9tIHRoZSBwcm92aWRlZCBzZXQgb3IgdW5zZXQgaXRcblx0XHQvLyBiZWNhdXNlIHRoZSBhY2NlcHQgZGlkIG5vdCBoYXBwZW4gZnJvbSBtb3VzZSBvciBrZXlib2FyZFxuXHRcdC8vIGludGVyYWN0aW9uIG9uIHRoZSBsaXN0IGl0c2VsZlxuXHRcdHRoaXMua2V5TW9kcy5hbHQgPSBrZXlNb2RzLmFsdDtcblx0XHR0aGlzLmtleU1vZHMuY3RybENtZCA9IGtleU1vZHMuY3RybENtZDtcblxuXHRcdHRoaXMub25EaWRBY2NlcHRFbWl0dGVyLmZpcmUoKTtcblx0fVxuXG5cdGFzeW5jIGJhY2soKSB7XG5cdFx0dGhpcy5vbkRpZFRyaWdnZXJCdXR0b25FbWl0dGVyLmZpcmUodGhpcy5iYWNrQnV0dG9uKTtcblx0fVxuXG5cdGFzeW5jIGNhbmNlbCgpIHtcblx0XHR0aGlzLmhpZGUoKTtcblx0fVxuXG5cdGxheW91dChkaW1lbnNpb246IGRvbS5JRGltZW5zaW9uLCB0aXRsZUJhck9mZnNldDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5kaW1lbnNpb24gPSBkaW1lbnNpb247XG5cdFx0dGhpcy50aXRsZUJhck9mZnNldCA9IHRpdGxlQmFyT2Zmc2V0O1xuXHRcdHRoaXMudXBkYXRlTGF5b3V0KCk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUxheW91dCgpIHtcblx0XHRpZiAodGhpcy51aSAmJiB0aGlzLmlzVmlzaWJsZSgpKSB7XG5cdFx0XHRjb25zdCBzdHlsZSA9IHRoaXMudWkuY29udGFpbmVyLnN0eWxlO1xuXHRcdFx0Y29uc3Qgd2lkdGggPSBNYXRoLm1pbih0aGlzLmRpbWVuc2lvbiEud2lkdGggKiAwLjYyIC8qIGdvbGRlbiBjdXQgKi8sIFF1aWNrSW5wdXRDb250cm9sbGVyLk1BWF9XSURUSCk7XG5cdFx0XHRzdHlsZS53aWR0aCA9IHdpZHRoICsgJ3B4JztcblxuXHRcdFx0Ly8gUG9zaXRpb25cblx0XHRcdHN0eWxlLnRvcCA9IGAke3RoaXMudmlld1N0YXRlPy50b3AgPyBNYXRoLnJvdW5kKHRoaXMuZGltZW5zaW9uIS5oZWlnaHQgKiB0aGlzLnZpZXdTdGF0ZS50b3ApIDogdGhpcy50aXRsZUJhck9mZnNldH1weGA7XG5cdFx0XHRzdHlsZS5sZWZ0ID0gYCR7TWF0aC5yb3VuZCgodGhpcy5kaW1lbnNpb24hLndpZHRoICogKHRoaXMudmlld1N0YXRlPy5sZWZ0ID8/IDAuNSAvKiBjZW50ZXIgKi8pKSAtICh3aWR0aCAvIDIpKX1weGA7XG5cblx0XHRcdHRoaXMudWkuaW5wdXRCb3gubGF5b3V0KCk7XG5cdFx0XHR0aGlzLnVpLmxpc3QubGF5b3V0KHRoaXMuZGltZW5zaW9uICYmIHRoaXMuZGltZW5zaW9uLmhlaWdodCAqIDAuNCk7XG5cdFx0fVxuXHR9XG5cblx0YXBwbHlTdHlsZXMoc3R5bGVzOiBJUXVpY2tJbnB1dFN0eWxlcykge1xuXHRcdHRoaXMuc3R5bGVzID0gc3R5bGVzO1xuXHRcdHRoaXMudXBkYXRlU3R5bGVzKCk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVN0eWxlcygpIHtcblx0XHRpZiAodGhpcy51aSkge1xuXHRcdFx0Y29uc3Qge1xuXHRcdFx0XHRxdWlja0lucHV0VGl0bGVCYWNrZ3JvdW5kLCBxdWlja0lucHV0QmFja2dyb3VuZCwgcXVpY2tJbnB1dEZvcmVncm91bmQsIHdpZGdldEJvcmRlciwgd2lkZ2V0U2hhZG93LFxuXHRcdFx0fSA9IHRoaXMuc3R5bGVzLndpZGdldDtcblx0XHRcdHRoaXMudWkudGl0bGVCYXIuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gcXVpY2tJbnB1dFRpdGxlQmFja2dyb3VuZCA/PyAnJztcblx0XHRcdHRoaXMudWkuY29udGFpbmVyLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IHF1aWNrSW5wdXRCYWNrZ3JvdW5kID8/ICcnO1xuXHRcdFx0dGhpcy51aS5jb250YWluZXIuc3R5bGUuY29sb3IgPSBxdWlja0lucHV0Rm9yZWdyb3VuZCA/PyAnJztcblx0XHRcdHRoaXMudWkuY29udGFpbmVyLnN0eWxlLmJvcmRlciA9IHdpZGdldEJvcmRlciA/IGAxcHggc29saWQgJHt3aWRnZXRCb3JkZXJ9YCA6ICcnO1xuXHRcdFx0dGhpcy51aS5jb250YWluZXIuc3R5bGUuYm94U2hhZG93ID0gd2lkZ2V0U2hhZG93ID8gYDAgMCA4cHggMnB4ICR7d2lkZ2V0U2hhZG93fWAgOiAnJztcblx0XHRcdHRoaXMudWkubGlzdC5zdHlsZSh0aGlzLnN0eWxlcy5saXN0KTtcblxuXHRcdFx0Y29uc3QgY29udGVudDogc3RyaW5nW10gPSBbXTtcblx0XHRcdGlmICh0aGlzLnN0eWxlcy5waWNrZXJHcm91cC5waWNrZXJHcm91cEJvcmRlcikge1xuXHRcdFx0XHRjb250ZW50LnB1c2goYC5xdWljay1pbnB1dC1saXN0IC5xdWljay1pbnB1dC1saXN0LWVudHJ5IHsgYm9yZGVyLXRvcC1jb2xvcjogICR7dGhpcy5zdHlsZXMucGlja2VyR3JvdXAucGlja2VyR3JvdXBCb3JkZXJ9OyB9YCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5zdHlsZXMucGlja2VyR3JvdXAucGlja2VyR3JvdXBGb3JlZ3JvdW5kKSB7XG5cdFx0XHRcdGNvbnRlbnQucHVzaChgLnF1aWNrLWlucHV0LWxpc3QgLnF1aWNrLWlucHV0LWxpc3Qtc2VwYXJhdG9yIHsgY29sb3I6ICAke3RoaXMuc3R5bGVzLnBpY2tlckdyb3VwLnBpY2tlckdyb3VwRm9yZWdyb3VuZH07IH1gKTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLnN0eWxlcy5waWNrZXJHcm91cC5waWNrZXJHcm91cEZvcmVncm91bmQpIHtcblx0XHRcdFx0Y29udGVudC5wdXNoKGAucXVpY2staW5wdXQtbGlzdCAucXVpY2staW5wdXQtbGlzdC1zZXBhcmF0b3ItYXMtaXRlbSB7IGNvbG9yOiB2YXIoLS12c2NvZGUtZGVzY3JpcHRpb25Gb3JlZ3JvdW5kKTsgfWApO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5zdHlsZXMua2V5YmluZGluZ0xhYmVsLmtleWJpbmRpbmdMYWJlbEJhY2tncm91bmQgfHxcblx0XHRcdFx0dGhpcy5zdHlsZXMua2V5YmluZGluZ0xhYmVsLmtleWJpbmRpbmdMYWJlbEJvcmRlciB8fFxuXHRcdFx0XHR0aGlzLnN0eWxlcy5rZXliaW5kaW5nTGFiZWwua2V5YmluZGluZ0xhYmVsQm90dG9tQm9yZGVyIHx8XG5cdFx0XHRcdHRoaXMuc3R5bGVzLmtleWJpbmRpbmdMYWJlbC5rZXliaW5kaW5nTGFiZWxTaGFkb3cgfHxcblx0XHRcdFx0dGhpcy5zdHlsZXMua2V5YmluZGluZ0xhYmVsLmtleWJpbmRpbmdMYWJlbEZvcmVncm91bmQpIHtcblx0XHRcdFx0Y29udGVudC5wdXNoKCcucXVpY2staW5wdXQtbGlzdCAubW9uYWNvLWtleWJpbmRpbmcgPiAubW9uYWNvLWtleWJpbmRpbmcta2V5IHsnKTtcblx0XHRcdFx0aWYgKHRoaXMuc3R5bGVzLmtleWJpbmRpbmdMYWJlbC5rZXliaW5kaW5nTGFiZWxCYWNrZ3JvdW5kKSB7XG5cdFx0XHRcdFx0Y29udGVudC5wdXNoKGBiYWNrZ3JvdW5kLWNvbG9yOiAke3RoaXMuc3R5bGVzLmtleWJpbmRpbmdMYWJlbC5rZXliaW5kaW5nTGFiZWxCYWNrZ3JvdW5kfTtgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodGhpcy5zdHlsZXMua2V5YmluZGluZ0xhYmVsLmtleWJpbmRpbmdMYWJlbEJvcmRlcikge1xuXHRcdFx0XHRcdC8vIE9yZGVyIG1hdHRlcnMgaGVyZS4gYGJvcmRlci1jb2xvcmAgbXVzdCBjb21lIGJlZm9yZSBgYm9yZGVyLWJvdHRvbS1jb2xvcmAuXG5cdFx0XHRcdFx0Y29udGVudC5wdXNoKGBib3JkZXItY29sb3I6ICR7dGhpcy5zdHlsZXMua2V5YmluZGluZ0xhYmVsLmtleWJpbmRpbmdMYWJlbEJvcmRlcn07YCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRoaXMuc3R5bGVzLmtleWJpbmRpbmdMYWJlbC5rZXliaW5kaW5nTGFiZWxCb3R0b21Cb3JkZXIpIHtcblx0XHRcdFx0XHRjb250ZW50LnB1c2goYGJvcmRlci1ib3R0b20tY29sb3I6ICR7dGhpcy5zdHlsZXMua2V5YmluZGluZ0xhYmVsLmtleWJpbmRpbmdMYWJlbEJvdHRvbUJvcmRlcn07YCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRoaXMuc3R5bGVzLmtleWJpbmRpbmdMYWJlbC5rZXliaW5kaW5nTGFiZWxTaGFkb3cpIHtcblx0XHRcdFx0XHRjb250ZW50LnB1c2goYGJveC1zaGFkb3c6IGluc2V0IDAgLTFweCAwICR7dGhpcy5zdHlsZXMua2V5YmluZGluZ0xhYmVsLmtleWJpbmRpbmdMYWJlbFNoYWRvd307YCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRoaXMuc3R5bGVzLmtleWJpbmRpbmdMYWJlbC5rZXliaW5kaW5nTGFiZWxGb3JlZ3JvdW5kKSB7XG5cdFx0XHRcdFx0Y29udGVudC5wdXNoKGBjb2xvcjogJHt0aGlzLnN0eWxlcy5rZXliaW5kaW5nTGFiZWwua2V5YmluZGluZ0xhYmVsRm9yZWdyb3VuZH07YCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29udGVudC5wdXNoKCd9Jyk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG5ld1N0eWxlcyA9IGNvbnRlbnQuam9pbignXFxuJyk7XG5cdFx0XHRpZiAobmV3U3R5bGVzICE9PSB0aGlzLnVpLnN0eWxlU2hlZXQudGV4dENvbnRlbnQpIHtcblx0XHRcdFx0dGhpcy51aS5zdHlsZVNoZWV0LnRleHRDb250ZW50ID0gbmV3U3R5bGVzO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgbG9hZFZpZXdTdGF0ZSgpOiBRdWlja0lucHV0Vmlld1N0YXRlIHwgdW5kZWZpbmVkIHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZGF0YSA9IEpTT04ucGFyc2UodGhpcy5zdG9yYWdlU2VydmljZS5nZXQoVklFV1NUQVRFX1NUT1JBR0VfS0VZLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sICd7fScpKTtcblx0XHRcdGlmIChkYXRhLnRvcCAhPT0gdW5kZWZpbmVkIHx8IGRhdGEubGVmdCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHJldHVybiBkYXRhO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggeyB9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBzYXZlVmlld1N0YXRlKHZpZXdTdGF0ZTogUXVpY2tJbnB1dFZpZXdTdGF0ZSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IGlzTWFpbldpbmRvdyA9IHRoaXMubGF5b3V0U2VydmljZS5hY3RpdmVDb250YWluZXIgPT09IHRoaXMubGF5b3V0U2VydmljZS5tYWluQ29udGFpbmVyO1xuXHRcdGlmICghaXNNYWluV2luZG93KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHZpZXdTdGF0ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKFZJRVdTVEFURV9TVE9SQUdFX0tFWSwgSlNPTi5zdHJpbmdpZnkodmlld1N0YXRlKSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShWSUVXU1RBVEVfU1RPUkFHRV9LRVksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVF1aWNrSW5wdXRDb250cm9sbGVySG9zdCBleHRlbmRzIElMYXlvdXRTZXJ2aWNlIHsgfVxuXG5jbGFzcyBRdWlja0lucHV0RHJhZ0FuZERyb3BDb250cm9sbGVyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHJlYWRvbmx5IGRuZFZpZXdTdGF0ZSA9IG9ic2VydmFibGVWYWx1ZTx7IHRvcD86IG51bWJlcjsgbGVmdD86IG51bWJlcjsgZG9uZTogYm9vbGVhbiB9IHwgdW5kZWZpbmVkPih0aGlzLCB1bmRlZmluZWQpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3NuYXBUaHJlc2hvbGQgPSAyMDtcblx0cHJpdmF0ZSByZWFkb25seSBfc25hcExpbmVIb3Jpem9udGFsUmF0aW8gPSAwLjI1O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbnRyb2xzT25MZWZ0OiBib29sZWFuO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jb250cm9sc09uUmlnaHQ6IGJvb2xlYW47XG5cblx0cHJpdmF0ZSBfcXVpY2tJbnB1dEFsaWdubWVudENvbnRleHQ6IElDb250ZXh0S2V5PCdjZW50ZXInIHwgJ3RvcCcgfCB1bmRlZmluZWQ+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgX2NvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcXVpY2tJbnB1dENvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSBfcXVpY2tJbnB1dERyYWdBcmVhczogeyBub2RlOiBIVE1MRWxlbWVudDsgaW5jbHVkZUNoaWxkcmVuOiBib29sZWFuIH1bXSxcblx0XHRpbml0aWFsVmlld1N0YXRlOiBRdWlja0lucHV0Vmlld1N0YXRlIHwgdW5kZWZpbmVkLFxuXHRcdEBJTGF5b3V0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYXlvdXRTZXJ2aWNlOiBJTGF5b3V0U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9xdWlja0lucHV0QWxpZ25tZW50Q29udGV4dCA9IFF1aWNrSW5wdXRBbGlnbm1lbnRDb250ZXh0S2V5LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y29uc3QgY3VzdG9tV2luZG93Q29udHJvbHMgPSBnZXRXaW5kb3dDb250cm9sc1N0eWxlKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpID09PSBXaW5kb3dDb250cm9sc1N0eWxlLkNVU1RPTTtcblxuXHRcdC8vIERvIG5vdCBhbGxvdyB0aGUgd2lkZ2V0IHRvIG92ZXJmbG93IG9yIHVuZGVyZmxvdyB3aW5kb3cgY29udHJvbHMuXG5cdFx0Ly8gVXNlIENTUyBjYWxjdWxhdGlvbnMgdG8gYXZvaWQgaGF2aW5nIHRvIGZvcmNlIGxheW91dCB3aXRoIGAuY2xpZW50V2lkdGhgXG5cdFx0dGhpcy5fY29udHJvbHNPbkxlZnQgPSBjdXN0b21XaW5kb3dDb250cm9scyAmJiBwbGF0Zm9ybSA9PT0gUGxhdGZvcm0uTWFjO1xuXHRcdHRoaXMuX2NvbnRyb2xzT25SaWdodCA9IGN1c3RvbVdpbmRvd0NvbnRyb2xzICYmIChwbGF0Zm9ybSA9PT0gUGxhdGZvcm0uV2luZG93cyB8fCBwbGF0Zm9ybSA9PT0gUGxhdGZvcm0uTGludXgpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyTGF5b3V0TGlzdGVuZXIoKTtcblx0XHR0aGlzLnJlZ2lzdGVyTW91c2VMaXN0ZW5lcnMoKTtcblx0XHR0aGlzLmRuZFZpZXdTdGF0ZS5zZXQoeyAuLi5pbml0aWFsVmlld1N0YXRlLCBkb25lOiB0cnVlIH0sIHVuZGVmaW5lZCk7XG5cdH1cblxuXHRyZXBhcmVudFVJKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLl9jb250YWluZXIgPSBjb250YWluZXI7XG5cdH1cblxuXHRsYXlvdXRDb250YWluZXIoZGltZW5zaW9uID0gdGhpcy5fbGF5b3V0U2VydmljZS5hY3RpdmVDb250YWluZXJEaW1lbnNpb24pOiB2b2lkIHtcblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuZG5kVmlld1N0YXRlLmdldCgpO1xuXHRcdGNvbnN0IGRyYWdBcmVhUmVjdCA9IHRoaXMuX3F1aWNrSW5wdXRDb250YWluZXIuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0aWYgKHN0YXRlPy50b3AgJiYgc3RhdGU/LmxlZnQpIHtcblx0XHRcdGNvbnN0IGEgPSBNYXRoLnJvdW5kKHN0YXRlLmxlZnQgKiAxZTIpIC8gMWUyO1xuXHRcdFx0Y29uc3QgYiA9IGRpbWVuc2lvbi53aWR0aDtcblx0XHRcdGNvbnN0IGMgPSBkcmFnQXJlYVJlY3Qud2lkdGg7XG5cdFx0XHRjb25zdCBkID0gYSAqIGIgLSBjIC8gMjtcblx0XHRcdHRoaXMuX2xheW91dChzdGF0ZS50b3AgKiBkaW1lbnNpb24uaGVpZ2h0LCBkKTtcblx0XHR9XG5cdH1cblxuXHRzZXRBbGlnbm1lbnQoYWxpZ25tZW50OiAndG9wJyB8ICdjZW50ZXInIHwgeyB0b3A6IG51bWJlcjsgbGVmdDogbnVtYmVyIH0sIGRvbmUgPSB0cnVlKTogdm9pZCB7XG5cdFx0aWYgKGFsaWdubWVudCA9PT0gJ3RvcCcpIHtcblx0XHRcdHRoaXMuZG5kVmlld1N0YXRlLnNldCh7XG5cdFx0XHRcdHRvcDogdGhpcy5fZ2V0VG9wU25hcFZhbHVlKCkgLyB0aGlzLl9jb250YWluZXIuY2xpZW50SGVpZ2h0LFxuXHRcdFx0XHRsZWZ0OiAodGhpcy5fZ2V0Q2VudGVyWFNuYXBWYWx1ZSgpICsgKHRoaXMuX3F1aWNrSW5wdXRDb250YWluZXIuY2xpZW50V2lkdGggLyAyKSkgLyB0aGlzLl9jb250YWluZXIuY2xpZW50V2lkdGgsXG5cdFx0XHRcdGRvbmVcblx0XHRcdH0sIHVuZGVmaW5lZCk7XG5cdFx0XHR0aGlzLl9xdWlja0lucHV0QWxpZ25tZW50Q29udGV4dC5zZXQoJ3RvcCcpO1xuXHRcdH0gZWxzZSBpZiAoYWxpZ25tZW50ID09PSAnY2VudGVyJykge1xuXHRcdFx0dGhpcy5kbmRWaWV3U3RhdGUuc2V0KHtcblx0XHRcdFx0dG9wOiB0aGlzLl9nZXRDZW50ZXJZU25hcFZhbHVlKCkgLyB0aGlzLl9jb250YWluZXIuY2xpZW50SGVpZ2h0LFxuXHRcdFx0XHRsZWZ0OiAodGhpcy5fZ2V0Q2VudGVyWFNuYXBWYWx1ZSgpICsgKHRoaXMuX3F1aWNrSW5wdXRDb250YWluZXIuY2xpZW50V2lkdGggLyAyKSkgLyB0aGlzLl9jb250YWluZXIuY2xpZW50V2lkdGgsXG5cdFx0XHRcdGRvbmVcblx0XHRcdH0sIHVuZGVmaW5lZCk7XG5cdFx0XHR0aGlzLl9xdWlja0lucHV0QWxpZ25tZW50Q29udGV4dC5zZXQoJ2NlbnRlcicpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmRuZFZpZXdTdGF0ZS5zZXQoeyB0b3A6IGFsaWdubWVudC50b3AsIGxlZnQ6IGFsaWdubWVudC5sZWZ0LCBkb25lIH0sIHVuZGVmaW5lZCk7XG5cdFx0XHR0aGlzLl9xdWlja0lucHV0QWxpZ25tZW50Q29udGV4dC5zZXQodW5kZWZpbmVkKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9yZWdpc3RlckxheW91dExpc3RlbmVyKCkge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmZpbHRlcih0aGlzLl9sYXlvdXRTZXJ2aWNlLm9uRGlkTGF5b3V0Q29udGFpbmVyLCBlID0+IGUuY29udGFpbmVyID09PSB0aGlzLl9jb250YWluZXIpKChlKSA9PiB0aGlzLmxheW91dENvbnRhaW5lcihlLmRpbWVuc2lvbikpKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJNb3VzZUxpc3RlbmVycygpOiB2b2lkIHtcblx0XHRjb25zdCBkcmFnQXJlYSA9IHRoaXMuX3F1aWNrSW5wdXRDb250YWluZXI7XG5cblx0XHQvLyBEb3VibGUgY2xpY2tcblx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUdlbmVyaWNNb3VzZVVwTGlzdGVuZXIoZHJhZ0FyZWEsIChldmVudDogTW91c2VFdmVudCkgPT4ge1xuXHRcdFx0Y29uc3Qgb3JpZ2luRXZlbnQgPSBuZXcgU3RhbmRhcmRNb3VzZUV2ZW50KGRvbS5nZXRXaW5kb3coZHJhZ0FyZWEpLCBldmVudCk7XG5cdFx0XHRpZiAob3JpZ2luRXZlbnQuZGV0YWlsICE9PSAyKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSWdub3JlIGV2ZW50IGlmIHRoZSB0YXJnZXQgaXMgbm90IHRoZSBkcmFnIGFyZWFcblx0XHRcdGlmICghdGhpcy5fcXVpY2tJbnB1dERyYWdBcmVhcy5zb21lKCh7IG5vZGUsIGluY2x1ZGVDaGlsZHJlbiB9KSA9PiBpbmNsdWRlQ2hpbGRyZW4gPyBkb20uaXNBbmNlc3RvcihvcmlnaW5FdmVudC50YXJnZXQgYXMgSFRNTEVsZW1lbnQsIG5vZGUpIDogb3JpZ2luRXZlbnQudGFyZ2V0ID09PSBub2RlKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuZG5kVmlld1N0YXRlLnNldCh7IHRvcDogdW5kZWZpbmVkLCBsZWZ0OiB1bmRlZmluZWQsIGRvbmU6IHRydWUgfSwgdW5kZWZpbmVkKTtcblx0XHR9KSk7XG5cblx0XHQvLyBNb3VzZSBkb3duXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZG9tLmFkZERpc3Bvc2FibGVHZW5lcmljTW91c2VEb3duTGlzdGVuZXIoZHJhZ0FyZWEsIChlOiBNb3VzZUV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBhY3RpdmVXaW5kb3cgPSBkb20uZ2V0V2luZG93KHRoaXMuX2xheW91dFNlcnZpY2UuYWN0aXZlQ29udGFpbmVyKTtcblx0XHRcdGNvbnN0IG9yaWdpbkV2ZW50ID0gbmV3IFN0YW5kYXJkTW91c2VFdmVudChhY3RpdmVXaW5kb3csIGUpO1xuXG5cdFx0XHQvLyBJZ25vcmUgZXZlbnQgaWYgdGhlIHRhcmdldCBpcyBub3QgdGhlIGRyYWcgYXJlYVxuXHRcdFx0aWYgKCF0aGlzLl9xdWlja0lucHV0RHJhZ0FyZWFzLnNvbWUoKHsgbm9kZSwgaW5jbHVkZUNoaWxkcmVuIH0pID0+IGluY2x1ZGVDaGlsZHJlbiA/IGRvbS5pc0FuY2VzdG9yKG9yaWdpbkV2ZW50LnRhcmdldCBhcyBIVE1MRWxlbWVudCwgbm9kZSkgOiBvcmlnaW5FdmVudC50YXJnZXQgPT09IG5vZGUpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gTW91c2UgcG9zaXRpb24gb2Zmc2V0IHJlbGF0aXZlIHRvIGRyYWdBcmVhXG5cdFx0XHRjb25zdCBkcmFnQXJlYVJlY3QgPSB0aGlzLl9xdWlja0lucHV0Q29udGFpbmVyLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuXHRcdFx0Y29uc3QgZHJhZ09mZnNldFggPSBvcmlnaW5FdmVudC5icm93c2VyRXZlbnQuY2xpZW50WCAtIGRyYWdBcmVhUmVjdC5sZWZ0O1xuXHRcdFx0Y29uc3QgZHJhZ09mZnNldFkgPSBvcmlnaW5FdmVudC5icm93c2VyRXZlbnQuY2xpZW50WSAtIGRyYWdBcmVhUmVjdC50b3A7XG5cblx0XHRcdGxldCBpc01vdmluZ1F1aWNrSW5wdXQgPSBmYWxzZTtcblx0XHRcdGNvbnN0IG1vdXNlTW92ZUxpc3RlbmVyID0gZG9tLmFkZERpc3Bvc2FibGVHZW5lcmljTW91c2VNb3ZlTGlzdGVuZXIoYWN0aXZlV2luZG93LCAoZTogTW91c2VFdmVudCkgPT4ge1xuXHRcdFx0XHRjb25zdCBtb3VzZU1vdmVFdmVudCA9IG5ldyBTdGFuZGFyZE1vdXNlRXZlbnQoYWN0aXZlV2luZG93LCBlKTtcblx0XHRcdFx0bW91c2VNb3ZlRXZlbnQucHJldmVudERlZmF1bHQoKTtcblxuXHRcdFx0XHRpZiAoIWlzTW92aW5nUXVpY2tJbnB1dCkge1xuXHRcdFx0XHRcdGlzTW92aW5nUXVpY2tJbnB1dCA9IHRydWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLl9sYXlvdXQoZS5jbGllbnRZIC0gZHJhZ09mZnNldFksIGUuY2xpZW50WCAtIGRyYWdPZmZzZXRYKTtcblx0XHRcdH0pO1xuXHRcdFx0Y29uc3QgbW91c2VVcExpc3RlbmVyID0gZG9tLmFkZERpc3Bvc2FibGVHZW5lcmljTW91c2VVcExpc3RlbmVyKGFjdGl2ZVdpbmRvdywgKGU6IE1vdXNlRXZlbnQpID0+IHtcblx0XHRcdFx0aWYgKGlzTW92aW5nUXVpY2tJbnB1dCkge1xuXHRcdFx0XHRcdC8vIFNhdmUgcG9zaXRpb25cblx0XHRcdFx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuZG5kVmlld1N0YXRlLmdldCgpO1xuXHRcdFx0XHRcdHRoaXMuZG5kVmlld1N0YXRlLnNldCh7IHRvcDogc3RhdGU/LnRvcCwgbGVmdDogc3RhdGU/LmxlZnQsIGRvbmU6IHRydWUgfSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIERpc3Bvc2UgbGlzdGVuZXJzXG5cdFx0XHRcdG1vdXNlTW92ZUxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0bW91c2VVcExpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdH0pO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgX2xheW91dCh0b3BDb29yZGluYXRlOiBudW1iZXIsIGxlZnRDb29yZGluYXRlOiBudW1iZXIpIHtcblx0XHRjb25zdCBzbmFwQ29vcmRpbmF0ZVlUb3AgPSB0aGlzLl9nZXRUb3BTbmFwVmFsdWUoKTtcblx0XHRjb25zdCBzbmFwQ29vcmRpbmF0ZVkgPSB0aGlzLl9nZXRDZW50ZXJZU25hcFZhbHVlKCk7XG5cdFx0Y29uc3Qgc25hcENvb3JkaW5hdGVYID0gdGhpcy5fZ2V0Q2VudGVyWFNuYXBWYWx1ZSgpO1xuXHRcdC8vIE1ha2Ugc3VyZSB0aGUgcXVpY2sgaW5wdXQgaXMgbm90IG1vdmVkIG91dHNpZGUgdGhlIGNvbnRhaW5lclxuXHRcdHRvcENvb3JkaW5hdGUgPSBNYXRoLm1heCgwLCBNYXRoLm1pbih0b3BDb29yZGluYXRlLCB0aGlzLl9jb250YWluZXIuY2xpZW50SGVpZ2h0IC0gdGhpcy5fcXVpY2tJbnB1dENvbnRhaW5lci5jbGllbnRIZWlnaHQpKTtcblxuXHRcdGlmICh0b3BDb29yZGluYXRlIDwgdGhpcy5fbGF5b3V0U2VydmljZS5hY3RpdmVDb250YWluZXJPZmZzZXQudG9wKSB7XG5cdFx0XHRpZiAodGhpcy5fY29udHJvbHNPbkxlZnQpIHtcblx0XHRcdFx0bGVmdENvb3JkaW5hdGUgPSBNYXRoLm1heChsZWZ0Q29vcmRpbmF0ZSwgODAgLyBnZXRab29tRmFjdG9yKGRvbS5nZXRBY3RpdmVXaW5kb3coKSkpO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLl9jb250cm9sc09uUmlnaHQpIHtcblx0XHRcdFx0bGVmdENvb3JkaW5hdGUgPSBNYXRoLm1pbihsZWZ0Q29vcmRpbmF0ZSwgdGhpcy5fY29udGFpbmVyLmNsaWVudFdpZHRoIC0gdGhpcy5fcXVpY2tJbnB1dENvbnRhaW5lci5jbGllbnRXaWR0aCAtICgxNDAgLyBnZXRab29tRmFjdG9yKGRvbS5nZXRBY3RpdmVXaW5kb3coKSkpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBzbmFwcGluZ1RvVG9wID0gTWF0aC5hYnModG9wQ29vcmRpbmF0ZSAtIHNuYXBDb29yZGluYXRlWVRvcCkgPCB0aGlzLl9zbmFwVGhyZXNob2xkO1xuXHRcdHRvcENvb3JkaW5hdGUgPSBzbmFwcGluZ1RvVG9wID8gc25hcENvb3JkaW5hdGVZVG9wIDogdG9wQ29vcmRpbmF0ZTtcblx0XHRjb25zdCBzbmFwcGluZ1RvQ2VudGVyID0gTWF0aC5hYnModG9wQ29vcmRpbmF0ZSAtIHNuYXBDb29yZGluYXRlWSkgPCB0aGlzLl9zbmFwVGhyZXNob2xkO1xuXHRcdHRvcENvb3JkaW5hdGUgPSBzbmFwcGluZ1RvQ2VudGVyID8gc25hcENvb3JkaW5hdGVZIDogdG9wQ29vcmRpbmF0ZTtcblx0XHRjb25zdCB0b3AgPSB0b3BDb29yZGluYXRlIC8gdGhpcy5fY29udGFpbmVyLmNsaWVudEhlaWdodDtcblxuXHRcdC8vIE1ha2Ugc3VyZSB0aGUgcXVpY2sgaW5wdXQgaXMgbm90IG1vdmVkIG91dHNpZGUgdGhlIGNvbnRhaW5lclxuXHRcdGxlZnRDb29yZGluYXRlID0gTWF0aC5tYXgoMCwgTWF0aC5taW4obGVmdENvb3JkaW5hdGUsIHRoaXMuX2NvbnRhaW5lci5jbGllbnRXaWR0aCAtIHRoaXMuX3F1aWNrSW5wdXRDb250YWluZXIuY2xpZW50V2lkdGgpKTtcblx0XHRjb25zdCBzbmFwcGluZ1RvQ2VudGVyWCA9IE1hdGguYWJzKGxlZnRDb29yZGluYXRlIC0gc25hcENvb3JkaW5hdGVYKSA8IHRoaXMuX3NuYXBUaHJlc2hvbGQ7XG5cdFx0bGVmdENvb3JkaW5hdGUgPSBzbmFwcGluZ1RvQ2VudGVyWCA/IHNuYXBDb29yZGluYXRlWCA6IGxlZnRDb29yZGluYXRlO1xuXG5cdFx0Y29uc3QgYiA9IHRoaXMuX2NvbnRhaW5lci5jbGllbnRXaWR0aDtcblx0XHRjb25zdCBjID0gdGhpcy5fcXVpY2tJbnB1dENvbnRhaW5lci5jbGllbnRXaWR0aDtcblx0XHRjb25zdCBkID0gbGVmdENvb3JkaW5hdGU7XG5cdFx0Y29uc3QgbGVmdCA9IChkICsgYyAvIDIpIC8gYjtcblxuXHRcdHRoaXMuZG5kVmlld1N0YXRlLnNldCh7IHRvcCwgbGVmdCwgZG9uZTogZmFsc2UgfSwgdW5kZWZpbmVkKTtcblx0XHRpZiAoc25hcHBpbmdUb0NlbnRlclgpIHtcblx0XHRcdGlmIChzbmFwcGluZ1RvVG9wKSB7XG5cdFx0XHRcdHRoaXMuX3F1aWNrSW5wdXRBbGlnbm1lbnRDb250ZXh0LnNldCgndG9wJyk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH0gZWxzZSBpZiAoc25hcHBpbmdUb0NlbnRlcikge1xuXHRcdFx0XHR0aGlzLl9xdWlja0lucHV0QWxpZ25tZW50Q29udGV4dC5zZXQoJ2NlbnRlcicpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX3F1aWNrSW5wdXRBbGlnbm1lbnRDb250ZXh0LnNldCh1bmRlZmluZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0VG9wU25hcFZhbHVlKCkge1xuXHRcdHJldHVybiB0aGlzLl9sYXlvdXRTZXJ2aWNlLmFjdGl2ZUNvbnRhaW5lck9mZnNldC5xdWlja1BpY2tUb3A7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRDZW50ZXJZU25hcFZhbHVlKCkge1xuXHRcdHJldHVybiBNYXRoLnJvdW5kKHRoaXMuX2NvbnRhaW5lci5jbGllbnRIZWlnaHQgKiB0aGlzLl9zbmFwTGluZUhvcml6b250YWxSYXRpbyk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRDZW50ZXJYU25hcFZhbHVlKCkge1xuXHRcdHJldHVybiBNYXRoLnJvdW5kKHRoaXMuX2NvbnRhaW5lci5jbGllbnRXaWR0aCAvIDIpIC0gTWF0aC5yb3VuZCh0aGlzLl9xdWlja0lucHV0Q29udGFpbmVyLmNsaWVudFdpZHRoIC8gMik7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFlBQVksc0JBQXNCO0FBQ2xDLFNBQVMsaUJBQWlCO0FBRTFCLFNBQVMsY0FBYztBQUN2QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxZQUE2QixlQUFlO0FBQ3JELE9BQU8sY0FBYztBQUNyQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGdCQUFnQjtBQUN6QixTQUFrSyxzQkFBc0Msc0JBQXNDO0FBQzlPLFNBQVMs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
