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
import "./media/suggest.css";
import * as dom from "../../../../base/browser/dom.js";
import { List } from "../../../../base/browser/ui/list/listWidget.js";
import { ResizableHTMLElement } from "../../../../base/browser/ui/resizable/resizable.js";
import { getAriaId, SimpleSuggestWidgetItemRenderer } from "./simpleSuggestWidgetRenderer.js";
import { createCancelablePromise, disposableTimeout, TimeoutTimer } from "../../../../base/common/async.js";
import { Emitter, PauseableEmitter } from "../../../../base/common/event.js";
import { MutableDisposable, Disposable } from "../../../../base/common/lifecycle.js";
import { clamp } from "../../../../base/common/numbers.js";
import { localize } from "../../../../nls.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { SuggestWidgetStatus } from "../../../../editor/contrib/suggest/browser/suggestWidgetStatus.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { canExpandCompletionItem, SimpleSuggestDetailsOverlay, SimpleSuggestDetailsWidget } from "./simpleSuggestWidgetDetails.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import * as strings from "../../../../base/common/strings.js";
import { status } from "../../../../base/browser/ui/aria/aria.js";
const $ = dom.$;
var State = /* @__PURE__ */ ((State2) => {
  State2[State2["Hidden"] = 0] = "Hidden";
  State2[State2["Loading"] = 1] = "Loading";
  State2[State2["Empty"] = 2] = "Empty";
  State2[State2["Open"] = 3] = "Open";
  State2[State2["Frozen"] = 4] = "Frozen";
  State2[State2["Details"] = 5] = "Details";
  return State2;
})(State || {});
var WidgetPositionPreference = /* @__PURE__ */ ((WidgetPositionPreference2) => {
  WidgetPositionPreference2[WidgetPositionPreference2["Above"] = 0] = "Above";
  WidgetPositionPreference2[WidgetPositionPreference2["Below"] = 1] = "Below";
  return WidgetPositionPreference2;
})(WidgetPositionPreference || {});
const SimpleSuggestContext = {
  HasFocusedSuggestion: new RawContextKey("simpleSuggestWidgetHasFocusedSuggestion", false, localize("simpleSuggestWidgetHasFocusedSuggestion", "Whether any simple suggestion is focused")),
  HasNavigated: new RawContextKey("simpleSuggestWidgetHasNavigated", false, localize("simpleSuggestWidgetHasNavigated", "Whether the simple suggestion widget has been navigated downwards"))
};
let SimpleSuggestWidget = class extends Disposable {
  constructor(_container, _persistedSize, _options, _getFontInfo, _onDidFontConfigurationChange, _getAdvancedExplainModeDetails, _instantiationService, _configurationService, _storageService, _contextKeyService) {
    super();
    this._container = _container;
    this._persistedSize = _persistedSize;
    this._options = _options;
    this._getFontInfo = _getFontInfo;
    this._onDidFontConfigurationChange = _onDidFontConfigurationChange;
    this._getAdvancedExplainModeDetails = _getAdvancedExplainModeDetails;
    this._instantiationService = _instantiationService;
    this._configurationService = _configurationService;
    this._storageService = _storageService;
    this._state = 0 /* Hidden */;
    this._forceRenderingAbove = false;
    this._explainMode = false;
    this._pendingShowDetails = this._register(new MutableDisposable());
    this._pendingLayout = this._register(new MutableDisposable());
    this._ignoreFocusEvents = false;
    this._showTimeout = this._register(new TimeoutTimer());
    this._onDidSelect = this._register(new Emitter());
    this.onDidSelect = this._onDidSelect.event;
    this._onDidHide = this._register(new Emitter());
    this.onDidHide = this._onDidHide.event;
    this._onDidShow = this._register(new Emitter());
    this.onDidShow = this._onDidShow.event;
    this._onDidFocus = new PauseableEmitter();
    this.onDidFocus = this._onDidFocus.event;
    this._onDidBlurDetails = this._register(new Emitter());
    this.onDidBlurDetails = this._onDidBlurDetails.event;
    this.element = this._register(new ResizableHTMLElement());
    this.element.domNode.classList.add("workbench-suggest-widget");
    this._container.appendChild(this.element.domNode);
    this._ctxSuggestWidgetHasFocusedSuggestion = SimpleSuggestContext.HasFocusedSuggestion.bindTo(_contextKeyService);
    this._ctxSuggestWidgetHasBeenNavigated = SimpleSuggestContext.HasNavigated.bindTo(_contextKeyService);
    class ResizeState {
      constructor(persistedSize, currentSize, persistHeight = false, persistWidth = false) {
        this.persistedSize = persistedSize;
        this.currentSize = currentSize;
        this.persistHeight = persistHeight;
        this.persistWidth = persistWidth;
      }
    }
    let state;
    this._register(this.element.onDidWillResize(() => {
      state = new ResizeState(this._persistedSize.restore(), this.element.size);
    }));
    this._register(this.element.onDidResize((e) => {
      this._resize(e.dimension.width, e.dimension.height);
      if (state) {
        state.persistHeight = state.persistHeight || !!e.north || !!e.south;
        state.persistWidth = state.persistWidth || !!e.east || !!e.west;
      }
      if (!e.done) {
        return;
      }
      if (state) {
        const { itemHeight, defaultSize } = this._getLayoutInfo();
        const threshold = Math.round(itemHeight / 2);
        let { width, height } = this.element.size;
        if (!state.persistHeight || Math.abs(state.currentSize.height - height) <= threshold) {
          height = state.persistedSize?.height ?? defaultSize.height;
        }
        if (!state.persistWidth || Math.abs(state.currentSize.width - width) <= threshold) {
          width = state.persistedSize?.width ?? defaultSize.width;
        }
        this._persistedSize.store(new dom.Dimension(width, height));
      }
      state = void 0;
    }));
    const applyIconStyle = () => this.element.domNode.classList.toggle("no-icons", !_configurationService.getValue("editor.suggest.showIcons"));
    applyIconStyle();
    const renderer = this._instantiationService.createInstance(SimpleSuggestWidgetItemRenderer, this._getFontInfo.bind(this), this._onDidFontConfigurationChange.bind(this));
    this._register(renderer);
    this._listElement = dom.append(this.element.domNode, $(".tree"));
    this._list = this._register(new List("SuggestWidget", this._listElement, {
      getHeight: () => this._getLayoutInfo().itemHeight,
      getTemplateId: () => "suggestion"
    }, [renderer], {
      alwaysConsumeMouseWheel: true,
      useShadows: false,
      mouseSupport: false,
      multipleSelectionSupport: false,
      accessibilityProvider: {
        getRole: () => "listitem",
        getWidgetAriaLabel: () => localize("suggest", "Suggest"),
        getWidgetRole: () => "listbox",
        getAriaLabel: (item) => {
          let label = item.textLabel;
          const kindLabel = item.completion.kindLabel ?? "";
          if (typeof item.completion.label !== "string") {
            const { detail: detail2, description } = item.completion.label;
            if (detail2 && description) {
              label = localize("label.full", "{0}{1}, {2} {3}", label, detail2, description, kindLabel);
            } else if (detail2) {
              label = localize("label.detail", "{0}{1} {2}", label, detail2, kindLabel);
            } else if (description) {
              label = localize("label.desc", "{0}, {1} {2}", label, description, kindLabel);
            }
          } else {
            label = localize("label", "{0}, {1}", label, kindLabel);
          }
          const { documentation, detail } = item.completion;
          const docs = strings.format(
            "{0}{1}",
            detail || "",
            documentation ? typeof documentation === "string" ? documentation : documentation.value : ""
          );
          return localize("ariaCurrenttSuggestionReadDetails", "{0}, docs: {1}", label, docs);
        }
      }
    }));
    this._register(this._list.onDidChangeFocus((e) => {
      if (e.indexes.length && e.indexes[0] !== 0) {
        this._ctxSuggestWidgetHasBeenNavigated.set(true);
      }
    }));
    this._messageElement = dom.append(this.element.domNode, dom.$(".message"));
    const details = this._register(_instantiationService.createInstance(SimpleSuggestDetailsWidget, this._getFontInfo.bind(this), this._onDidFontConfigurationChange.bind(this), this._getAdvancedExplainModeDetails.bind(this)));
    this._register(details.onDidClose(() => this.toggleDetails()));
    this._details = this._register(new SimpleSuggestDetailsOverlay(details, this._listElement));
    this._register(dom.addDisposableListener(this._details.widget.domNode, "blur", (e) => this._onDidBlurDetails.fire(e)));
    if (_options.statusBarMenuId && _options.showStatusBarSettingId && _configurationService.getValue(_options.showStatusBarSettingId)) {
      this._status = this._register(_instantiationService.createInstance(SuggestWidgetStatus, this.element.domNode, _options.statusBarMenuId));
      this.element.domNode.classList.toggle("with-status-bar", true);
    }
    this._register(this._list.onMouseDown((e) => this._onListMouseDownOrTap(e)));
    this._register(this._list.onTap((e) => this._onListMouseDownOrTap(e)));
    this._register(this._list.onDidChangeFocus((e) => this._onListFocus(e)));
    this._register(this._list.onDidChangeSelection((e) => this._onListSelection(e)));
    this._register(this._onDidFontConfigurationChange(() => {
      if (this._completionModel) {
        this._list.splice(0, this._completionModel.items.length, this._completionModel.items);
      }
    }));
    this._register(_configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("editor.suggest.showIcons")) {
        applyIconStyle();
      }
      if (_options.statusBarMenuId && _options.showStatusBarSettingId && e.affectsConfiguration(_options.showStatusBarSettingId)) {
        const showStatusBar = _configurationService.getValue(_options.showStatusBarSettingId);
        if (showStatusBar && !this._status) {
          this._status = this._register(_instantiationService.createInstance(SuggestWidgetStatus, this.element.domNode, _options.statusBarMenuId));
          this._status.show();
        } else if (showStatusBar && this._status) {
          this._status.show();
        } else if (this._status) {
          this._status.element.remove();
          this._status.dispose();
          this._status = void 0;
          this._layout(void 0);
        }
        this.element.domNode.classList.toggle("with-status-bar", showStatusBar);
      }
    }));
  }
  get list() {
    return this._list;
  }
  _onListFocus(e) {
    if (this._ignoreFocusEvents) {
      return;
    }
    if (this._state === 5 /* Details */) {
      this._setState(3 /* Open */);
    }
    if (!e.elements.length) {
      if (this._currentSuggestionDetails) {
        this._currentSuggestionDetails.cancel();
        this._currentSuggestionDetails = void 0;
        this._focusedItem = void 0;
        this._ctxSuggestWidgetHasFocusedSuggestion.set(false);
      }
      this._clearAriaActiveDescendant();
      return;
    }
    if (!this._completionModel) {
      return;
    }
    this._ctxSuggestWidgetHasFocusedSuggestion.set(true);
    const item = e.elements[0];
    const index = e.indexes[0];
    if (item !== this._focusedItem) {
      this._currentSuggestionDetails?.cancel();
      this._currentSuggestionDetails = void 0;
      this._focusedItem = item;
      this._list.reveal(index);
      const id = getAriaId(index);
      const node = dom.getActiveWindow().document.activeElement;
      if (node && id) {
        node.setAttribute("aria-haspopup", "true");
        node.setAttribute("aria-autocomplete", "list");
        node.setAttribute("aria-activedescendant", id);
      } else {
        this._clearAriaActiveDescendant();
      }
      this._currentSuggestionDetails = createCancelablePromise(async (token) => {
        const loading = disposableTimeout(() => {
          if (this._isDetailsVisible()) {
            this._showDetails(true, false);
          }
        }, 250);
        const sub = token.onCancellationRequested(() => loading.dispose());
        try {
          return await Promise.resolve();
        } finally {
          loading.dispose();
          sub.dispose();
        }
      });
      this._currentSuggestionDetails.then(() => {
        if (index >= this._list.length || item !== this._list.element(index)) {
          return;
        }
        this._ignoreFocusEvents = true;
        this._list.splice(index, 1, [item]);
        this._list.setFocus([index]);
        this._ignoreFocusEvents = false;
        if (this._isDetailsVisible()) {
          this._showDetails(false, false);
        } else {
          this.element.domNode.classList.remove("docs-side");
        }
      }).catch();
    }
    this._onDidFocus.fire({ item, index, model: this._completionModel });
  }
  _clearAriaActiveDescendant() {
    const node = dom.getActiveWindow().document.activeElement;
    if (!node) {
      return;
    }
    node.setAttribute("aria-haspopup", "false");
    node.setAttribute("aria-autocomplete", "both");
    node.removeAttribute("aria-activedescendant");
  }
  setCompletionModel(completionModel) {
    this._completionModel = completionModel;
  }
  hasCompletions() {
    return this._completionModel?.items.length !== 0;
  }
  resetWidgetSize() {
    this._persistedSize.reset();
  }
  showSuggestions(selectionIndex, isFrozen, isAuto, cursorPosition) {
    this._cursorPosition = cursorPosition;
    if (isFrozen && this._state !== 2 /* Empty */ && this._state !== 0 /* Hidden */) {
      this._setState(4 /* Frozen */);
      return;
    }
    const visibleCount = this._completionModel?.items.length ?? 0;
    const isEmpty = visibleCount === 0;
    if (isEmpty) {
      this._setState(isAuto ? 0 /* Hidden */ : 2 /* Empty */);
      this._completionModel = void 0;
      return;
    }
    try {
      this._list.splice(0, this._list.length, this._completionModel?.items ?? []);
      this._setState(isFrozen ? 4 /* Frozen */ : 3 /* Open */);
      this._list.reveal(selectionIndex, 0);
      this._list.setFocus([selectionIndex]);
    } finally {
    }
    this._pendingLayout.value = dom.runAtThisOrScheduleAtNextAnimationFrame(dom.getWindow(this.element.domNode), () => {
      this._pendingLayout.clear();
      this._layout(this.element.size);
    });
    this._afterRender();
  }
  setLineContext(lineContext) {
    if (this._completionModel) {
      this._completionModel.lineContext = lineContext;
    }
  }
  _setState(state) {
    if (this._state === state) {
      return;
    }
    this._state = state;
    this.element.domNode.classList.toggle("frozen", state === 4 /* Frozen */);
    this.element.domNode.classList.remove("message");
    switch (state) {
      case 0 /* Hidden */:
        if (this._status) {
          dom.hide(this._status.element);
        }
        dom.hide(this._listElement);
        dom.hide(this._messageElement);
        dom.hide(this.element.domNode);
        this._details.hide(true);
        this._status?.hide();
        this._ctxSuggestWidgetHasFocusedSuggestion.reset();
        this._showTimeout.cancel();
        this.element.domNode.classList.remove("visible");
        this._list.splice(0, this._list.length);
        this._focusedItem = void 0;
        this._cappedHeight = void 0;
        this._explainMode = false;
        break;
      case 1 /* Loading */:
        this.element.domNode.classList.add("message");
        this._messageElement.textContent = SimpleSuggestWidget.LOADING_MESSAGE;
        dom.hide(this._listElement);
        if (this._status) {
          dom.hide(this._status.element);
        }
        dom.show(this._messageElement);
        this._details.hide();
        this._show();
        this._focusedItem = void 0;
        break;
      case 2 /* Empty */:
        this.element.domNode.classList.add("message");
        this._messageElement.textContent = SimpleSuggestWidget.NO_SUGGESTIONS_MESSAGE;
        dom.hide(this._listElement);
        if (this._status) {
          dom.hide(this._status.element);
        }
        dom.show(this._messageElement);
        this._details.hide();
        this._show();
        this._focusedItem = void 0;
        status(SimpleSuggestWidget.NO_SUGGESTIONS_MESSAGE);
        break;
      case 3 /* Open */:
        dom.hide(this._messageElement);
        this._showListAndStatus();
        this._show();
        break;
      case 4 /* Frozen */:
        dom.hide(this._messageElement);
        this._showListAndStatus();
        this._show();
        break;
      case 5 /* Details */:
        dom.hide(this._messageElement);
        this._showListAndStatus();
        this._details.show();
        this._show();
        break;
    }
  }
  _showListAndStatus() {
    if (this._status) {
      dom.show(this._listElement, this._status.element);
    } else {
      dom.show(this._listElement);
    }
  }
  _show() {
    this._status?.show();
    dom.show(this.element.domNode);
    this._layout(this._persistedSize.restore());
    this._onDidShow.fire(this);
    this._showTimeout.cancelAndSet(() => {
      this.element.domNode.classList.add("visible");
    }, 100);
  }
  toggleDetailsFocus() {
    if (this._state === 5 /* Details */) {
      this._list.setFocus(this._list.getFocus());
      this._setState(3 /* Open */);
    } else if (this._state === 3 /* Open */) {
      this._setState(5 /* Details */);
      if (!this._isDetailsVisible()) {
        this.toggleDetails(true);
      } else {
        this._details.widget.focus();
      }
    }
  }
  toggleDetails(focused = false) {
    if (this._isDetailsVisible()) {
      this._pendingShowDetails.clear();
      this._setDetailsVisible(false);
      this._details.hide();
      this.element.domNode.classList.remove("shows-details");
    } else if ((canExpandCompletionItem(this._list.getFocusedElements()[0]) || this._explainMode) && (this._state === 3 /* Open */ || this._state === 5 /* Details */ || this._state === 4 /* Frozen */)) {
      this._setDetailsVisible(true);
      this._showDetails(false, focused);
    }
  }
  _showDetails(loading, focused) {
    this._pendingShowDetails.value = dom.runAtThisOrScheduleAtNextAnimationFrame(dom.getWindow(this.element.domNode), () => {
      this._pendingShowDetails.clear();
      this._details.show();
      let didFocusDetails = false;
      if (loading) {
        this._details.widget.renderLoading();
      } else {
        this._details.widget.renderItem(this._list.getFocusedElements()[0], this._explainMode);
      }
      if (!this._details.widget.isEmpty) {
        this._positionDetails();
        this.element.domNode.classList.add("shows-details");
        if (focused) {
          this._details.widget.focus();
          didFocusDetails = true;
        }
      } else {
        this._details.hide();
      }
      if (!didFocusDetails) {
      }
    });
  }
  toggleExplainMode() {
    if (this._list.getFocusedElements()[0]) {
      this._explainMode = !this._explainMode;
      if (!this._isDetailsVisible()) {
        this.toggleDetails();
      } else {
        this._showDetails(false, false);
      }
    }
  }
  hide() {
    this._pendingLayout.clear();
    this._pendingShowDetails.clear();
    this._ctxSuggestWidgetHasBeenNavigated.reset();
    this._setState(0 /* Hidden */);
    this._onDidHide.fire(this);
    dom.hide(this.element.domNode);
    this.element.clearSashHoverState();
    const dim = this._persistedSize.restore();
    const minPersistedHeight = Math.ceil(this._getLayoutInfo().itemHeight * 4.3);
    if (dim && dim.height < minPersistedHeight) {
      this._persistedSize.store(dim.with(void 0, minPersistedHeight));
    }
  }
  _layout(size) {
    if (!this._cursorPosition) {
      return;
    }
    const bodyBox = dom.getClientArea(this._container.ownerDocument.body);
    const info = this._getLayoutInfo();
    if (!size) {
      size = info.defaultSize;
    }
    let height = size.height;
    let width = size.width;
    if (this._status) {
      this._status.element.style.height = `${info.itemHeight}px`;
    }
    const maxWidth = bodyBox.width - info.borderHeight - 2 * info.horizontalPadding;
    if (width > maxWidth) {
      width = maxWidth;
    }
    const preferredWidth = this._completionModel ? this._completionModel.stats.pLabelLen * info.typicalHalfwidthCharacterWidth : width;
    const fullHeight = info.statusBarHeight + this._list.contentHeight + this._messageElement.clientHeight + info.borderHeight;
    const minHeight = info.itemHeight + info.statusBarHeight;
    const editorBox = dom.getDomNodePagePosition(this._container);
    const cursorBox = this._cursorPosition;
    const cursorBottom = editorBox.top + cursorBox.top + cursorBox.height;
    const maxHeightBelow = Math.min(bodyBox.height - cursorBottom - info.verticalPadding, fullHeight);
    const availableSpaceAbove = editorBox.top + cursorBox.top - info.verticalPadding;
    const maxHeightAbove = Math.min(availableSpaceAbove, fullHeight);
    let maxHeight = Math.min(Math.max(maxHeightAbove, maxHeightBelow) + info.borderHeight, fullHeight);
    if (height === this._cappedHeight?.capped) {
      height = this._cappedHeight.wanted;
    }
    if (height < minHeight) {
      height = minHeight;
    }
    if (height > maxHeight) {
      height = maxHeight;
    }
    const forceRenderingAboveRequiredSpace = 150;
    if (height > maxHeightBelow || this._forceRenderingAbove && availableSpaceAbove > forceRenderingAboveRequiredSpace) {
      this._preference = 0 /* Above */;
      this.element.enableSashes(true, true, false, false);
      maxHeight = maxHeightAbove;
    } else {
      this._preference = 1 /* Below */;
      this.element.enableSashes(false, true, true, false);
      maxHeight = maxHeightBelow;
    }
    this.element.preferredSize = new dom.Dimension(preferredWidth, info.defaultSize.height);
    this.element.maxSize = new dom.Dimension(maxWidth, maxHeight);
    this.element.minSize = new dom.Dimension(220, minHeight);
    this._cappedHeight = height === fullHeight ? { wanted: this._cappedHeight?.wanted ?? size.height, capped: height } : void 0;
    this.element.domNode.style.left = `${this._cursorPosition.left}px`;
    if (this._preference === 0 /* Above */) {
      this.element.domNode.style.top = `${this._cursorPosition.top - height - info.borderHeight}px`;
    } else {
      this.element.domNode.style.top = `${this._cursorPosition.top + this._cursorPosition.height}px`;
    }
    this._resize(width, height);
  }
  _afterRender() {
    if (this._state === 2 /* Empty */ || this._state === 1 /* Loading */) {
      return;
    }
    if (this._isDetailsVisible() && !this._details.widget.isEmpty) {
      this._details.show();
    }
    this._positionDetails();
  }
  _resize(width, height) {
    const { width: maxWidth, height: maxHeight } = this.element.maxSize;
    width = Math.min(maxWidth, width);
    if (maxHeight) {
      height = Math.min(maxHeight, height);
    }
    const { statusBarHeight } = this._getLayoutInfo();
    this._list.layout(height - statusBarHeight, width);
    this._listElement.style.height = `${height - statusBarHeight}px`;
    this._listElement.style.width = `${width}px`;
    this.element.layout(height, width);
    if (this._cursorPosition && this._preference === 0 /* Above */) {
      this.element.domNode.style.top = `${this._cursorPosition.top - height}px`;
    }
    this._positionDetails();
  }
  _positionDetails() {
    if (this._isDetailsVisible()) {
      this._details.placeAtAnchor(this.element.domNode);
    }
  }
  _getLayoutInfo() {
    const fontInfo = this._getFontInfo();
    const itemHeight = clamp(fontInfo.lineHeight, 8, 1e3);
    const statusBarHeight = !this._options.statusBarMenuId || !this._options.showStatusBarSettingId || !this._configurationService.getValue(this._options.showStatusBarSettingId) || this._state === 2 /* Empty */ || this._state === 1 /* Loading */ ? 0 : itemHeight;
    const borderWidth = this._details.widget.borderWidth;
    const borderHeight = 2 * borderWidth;
    return {
      itemHeight,
      statusBarHeight,
      borderWidth,
      borderHeight,
      typicalHalfwidthCharacterWidth: 10,
      verticalPadding: 22,
      horizontalPadding: 14,
      defaultSize: new dom.Dimension(430, statusBarHeight + 12 * itemHeight + borderHeight)
    };
  }
  _onListMouseDownOrTap(e) {
    if (typeof e.element === "undefined" || typeof e.index === "undefined") {
      return;
    }
    e.browserEvent.preventDefault();
    e.browserEvent.stopPropagation();
    this._select(e.element, e.index);
  }
  _onListSelection(e) {
    if (e.elements.length) {
      this._select(e.elements[0], e.indexes[0]);
    }
  }
  _select(item, index) {
    const completionModel = this._completionModel;
    if (completionModel) {
      this._onDidSelect.fire({ item, index, model: completionModel });
    }
  }
  selectNext() {
    this._list.focusNext(1, true);
    const focus = this._list.getFocus();
    if (focus.length > 0) {
      this._list.reveal(focus[0]);
    }
    return true;
  }
  selectNextPage() {
    this._list.focusNextPage();
    const focus = this._list.getFocus();
    if (focus.length > 0) {
      this._list.reveal(focus[0]);
    }
    return true;
  }
  selectPrevious() {
    this._list.focusPrevious(1, true);
    const focus = this._list.getFocus();
    if (focus.length > 0) {
      this._list.reveal(focus[0]);
    }
    return true;
  }
  selectPreviousPage() {
    this._list.focusPreviousPage();
    const focus = this._list.getFocus();
    if (focus.length > 0) {
      this._list.reveal(focus[0]);
    }
    return true;
  }
  getFocusedItem() {
    if (this._completionModel) {
      return {
        item: this._list.getFocusedElements()[0],
        index: this._list.getFocus()[0],
        model: this._completionModel
      };
    }
    return void 0;
  }
  _isDetailsVisible() {
    return this._storageService.getBoolean("expandSuggestionDocs", StorageScope.PROFILE, false);
  }
  _setDetailsVisible(value) {
    this._storageService.store("expandSuggestionDocs", value, StorageScope.PROFILE, StorageTarget.USER);
  }
  forceRenderingAbove() {
    if (!this._forceRenderingAbove) {
      this._forceRenderingAbove = true;
      this._layout(this._persistedSize.restore());
    }
  }
  stopForceRenderingAbove() {
    this._forceRenderingAbove = false;
  }
};
SimpleSuggestWidget.LOADING_MESSAGE = localize("suggestWidget.loading", "Loading...");
SimpleSuggestWidget.NO_SUGGESTIONS_MESSAGE = localize("suggestWidget.noSuggestions", "No suggestions.");
SimpleSuggestWidget = __decorateClass([
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IStorageService),
  __decorateParam(9, IContextKeyService)
], SimpleSuggestWidget);
export {
  SimpleSuggestContext,
  SimpleSuggestWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc3VnZ2VzdC9icm93c2VyL3NpbXBsZVN1Z2dlc3RXaWRnZXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvc3VnZ2VzdC5jc3MnO1xuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSUxpc3RFdmVudCwgSUxpc3RHZXN0dXJlRXZlbnQsIElMaXN0TW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3QuanMnO1xuaW1wb3J0IHsgTGlzdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3RXaWRnZXQuanMnO1xuaW1wb3J0IHsgUmVzaXphYmxlSFRNTEVsZW1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvcmVzaXphYmxlL3Jlc2l6YWJsZS5qcyc7XG5pbXBvcnQgeyBTaW1wbGVDb21wbGV0aW9uSXRlbSB9IGZyb20gJy4vc2ltcGxlQ29tcGxldGlvbkl0ZW0uanMnO1xuaW1wb3J0IHsgTGluZUNvbnRleHQsIFNpbXBsZUNvbXBsZXRpb25Nb2RlbCB9IGZyb20gJy4vc2ltcGxlQ29tcGxldGlvbk1vZGVsLmpzJztcbmltcG9ydCB7IGdldEFyaWFJZCwgU2ltcGxlU3VnZ2VzdFdpZGdldEl0ZW1SZW5kZXJlciwgdHlwZSBJU2ltcGxlU3VnZ2VzdFdpZGdldEZvbnRJbmZvIH0gZnJvbSAnLi9zaW1wbGVTdWdnZXN0V2lkZ2V0UmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgQ2FuY2VsYWJsZVByb21pc2UsIGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlLCBkaXNwb3NhYmxlVGltZW91dCwgVGltZW91dFRpbWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQsIFBhdXNlYWJsZUVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBNdXRhYmxlRGlzcG9zYWJsZSwgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBjbGFtcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL251bWJlcnMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBTdWdnZXN0V2lkZ2V0U3RhdHVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvc3VnZ2VzdC9icm93c2VyL3N1Z2dlc3RXaWRnZXRTdGF0dXMuanMnO1xuaW1wb3J0IHsgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBjYW5FeHBhbmRDb21wbGV0aW9uSXRlbSwgU2ltcGxlU3VnZ2VzdERldGFpbHNPdmVybGF5LCBTaW1wbGVTdWdnZXN0RGV0YWlsc1dpZGdldCB9IGZyb20gJy4vc2ltcGxlU3VnZ2VzdFdpZGdldERldGFpbHMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSwgUmF3Q29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0ICogYXMgc3RyaW5ncyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IHN0YXR1cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hcmlhL2FyaWEuanMnO1xuXG5jb25zdCAkID0gZG9tLiQ7XG5cbmNvbnN0IGVudW0gU3RhdGUge1xuXHRIaWRkZW4sXG5cdExvYWRpbmcsXG5cdEVtcHR5LFxuXHRPcGVuLFxuXHRGcm96ZW4sXG5cdERldGFpbHNcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU2ltcGxlU2VsZWN0ZWRTdWdnZXN0aW9uPFQgZXh0ZW5kcyBTaW1wbGVDb21wbGV0aW9uSXRlbT4ge1xuXHRpdGVtOiBUO1xuXHRpbmRleDogbnVtYmVyO1xuXHRtb2RlbDogU2ltcGxlQ29tcGxldGlvbk1vZGVsPFQ+O1xufVxuXG5pbnRlcmZhY2UgSVBlcnNpc3RlZFdpZGdldFNpemVEZWxlZ2F0ZSB7XG5cdHJlc3RvcmUoKTogZG9tLkRpbWVuc2lvbiB8IHVuZGVmaW5lZDtcblx0c3RvcmUoc2l6ZTogZG9tLkRpbWVuc2lvbik6IHZvaWQ7XG5cdHJlc2V0KCk6IHZvaWQ7XG59XG5cbmNvbnN0IGVudW0gV2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlIHtcblx0QWJvdmUsXG5cdEJlbG93XG59XG5cbmV4cG9ydCBjb25zdCBTaW1wbGVTdWdnZXN0Q29udGV4dCA9IHtcblx0SGFzRm9jdXNlZFN1Z2dlc3Rpb246IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdzaW1wbGVTdWdnZXN0V2lkZ2V0SGFzRm9jdXNlZFN1Z2dlc3Rpb24nLCBmYWxzZSwgbG9jYWxpemUoJ3NpbXBsZVN1Z2dlc3RXaWRnZXRIYXNGb2N1c2VkU3VnZ2VzdGlvbicsIFwiV2hldGhlciBhbnkgc2ltcGxlIHN1Z2dlc3Rpb24gaXMgZm9jdXNlZFwiKSksXG5cdEhhc05hdmlnYXRlZDogbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ3NpbXBsZVN1Z2dlc3RXaWRnZXRIYXNOYXZpZ2F0ZWQnLCBmYWxzZSwgbG9jYWxpemUoJ3NpbXBsZVN1Z2dlc3RXaWRnZXRIYXNOYXZpZ2F0ZWQnLCBcIldoZXRoZXIgdGhlIHNpbXBsZSBzdWdnZXN0aW9uIHdpZGdldCBoYXMgYmVlbiBuYXZpZ2F0ZWQgZG93bndhcmRzXCIpKSxcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdvcmtiZW5jaFN1Z2dlc3RXaWRnZXRPcHRpb25zIHtcblx0LyoqXG5cdCAqIFRoZSB7QGxpbmsgTWVudUlkfSB0byB1c2UgZm9yIHRoZSBzdGF0dXMgYmFyLiBJdGVtcyBvbiB0aGUgbWVudSBtdXN0IHVzZSB0aGUgZ3JvdXBzIGAnbGVmdCdgXG5cdCAqIGFuZCBgJ3JpZ2h0J2AuXG5cdCAqL1xuXHRzdGF0dXNCYXJNZW51SWQ/OiBNZW51SWQ7XG5cblx0LyoqXG5cdCAqIFRoZSBzZXR0aW5nIGZvciBzaG93aW5nIHRoZSBzdGF0dXMgYmFyLlxuXHQgKi9cblx0c2hvd1N0YXR1c0JhclNldHRpbmdJZD86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFNpbXBsZVN1Z2dlc3RXaWRnZXQ8VE1vZGVsIGV4dGVuZHMgU2ltcGxlQ29tcGxldGlvbk1vZGVsPFRJdGVtPiwgVEl0ZW0gZXh0ZW5kcyBTaW1wbGVDb21wbGV0aW9uSXRlbT4gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHN0YXRpYyBMT0FESU5HX01FU1NBR0U6IHN0cmluZyA9IGxvY2FsaXplKCdzdWdnZXN0V2lkZ2V0LmxvYWRpbmcnLCBcIkxvYWRpbmcuLi5cIik7XG5cdHByaXZhdGUgc3RhdGljIE5PX1NVR0dFU1RJT05TX01FU1NBR0U6IHN0cmluZyA9IGxvY2FsaXplKCdzdWdnZXN0V2lkZ2V0Lm5vU3VnZ2VzdGlvbnMnLCBcIk5vIHN1Z2dlc3Rpb25zLlwiKTtcblxuXHRwcml2YXRlIF9zdGF0ZTogU3RhdGUgPSBTdGF0ZS5IaWRkZW47XG5cdHByaXZhdGUgX2NvbXBsZXRpb25Nb2RlbD86IFRNb2RlbDtcblx0cHJpdmF0ZSBfY2FwcGVkSGVpZ2h0PzogeyB3YW50ZWQ6IG51bWJlcjsgY2FwcGVkOiBudW1iZXIgfTtcblx0cHJpdmF0ZSBfZm9yY2VSZW5kZXJpbmdBYm92ZTogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIF9leHBsYWluTW9kZTogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdHByaXZhdGUgX3ByZWZlcmVuY2U/OiBXaWRnZXRQb3NpdGlvblByZWZlcmVuY2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3BlbmRpbmdTaG93RGV0YWlscyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcGVuZGluZ0xheW91dCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0cHJpdmF0ZSBfY3VycmVudFN1Z2dlc3Rpb25EZXRhaWxzPzogQ2FuY2VsYWJsZVByb21pc2U8dm9pZD47XG5cdHByaXZhdGUgX2ZvY3VzZWRJdGVtPzogVEl0ZW07XG5cdHByaXZhdGUgX2lnbm9yZUZvY3VzRXZlbnRzOiBib29sZWFuID0gZmFsc2U7XG5cdHJlYWRvbmx5IGVsZW1lbnQ6IFJlc2l6YWJsZUhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9tZXNzYWdlRWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2xpc3RFbGVtZW50OiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfbGlzdDogTGlzdDxUSXRlbT47XG5cdHByaXZhdGUgX3N0YXR1cz86IFN1Z2dlc3RXaWRnZXRTdGF0dXM7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RldGFpbHM6IFNpbXBsZVN1Z2dlc3REZXRhaWxzT3ZlcmxheTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zaG93VGltZW91dCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBUaW1lb3V0VGltZXIoKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTZWxlY3QgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJU2ltcGxlU2VsZWN0ZWRTdWdnZXN0aW9uPFRJdGVtPj4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkU2VsZWN0OiBFdmVudDxJU2ltcGxlU2VsZWN0ZWRTdWdnZXN0aW9uPFRJdGVtPj4gPSB0aGlzLl9vbkRpZFNlbGVjdC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRIaWRlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dGhpcz4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkSGlkZTogRXZlbnQ8dGhpcz4gPSB0aGlzLl9vbkRpZEhpZGUuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkU2hvdyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHRoaXM+KCkpO1xuXHRyZWFkb25seSBvbkRpZFNob3c6IEV2ZW50PHRoaXM+ID0gdGhpcy5fb25EaWRTaG93LmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEZvY3VzID0gbmV3IFBhdXNlYWJsZUVtaXR0ZXI8SVNpbXBsZVNlbGVjdGVkU3VnZ2VzdGlvbjxUSXRlbT4+KCk7XG5cdHJlYWRvbmx5IG9uRGlkRm9jdXM6IEV2ZW50PElTaW1wbGVTZWxlY3RlZFN1Z2dlc3Rpb248VEl0ZW0+PiA9IHRoaXMuX29uRGlkRm9jdXMuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQmx1ckRldGFpbHMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxGb2N1c0V2ZW50PigpKTtcblx0cmVhZG9ubHkgb25EaWRCbHVyRGV0YWlscyA9IHRoaXMuX29uRGlkQmx1ckRldGFpbHMuZXZlbnQ7XG5cblx0Z2V0IGxpc3QoKTogTGlzdDxUSXRlbT4geyByZXR1cm4gdGhpcy5fbGlzdDsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2N0eFN1Z2dlc3RXaWRnZXRIYXNGb2N1c2VkU3VnZ2VzdGlvbjogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2N0eFN1Z2dlc3RXaWRnZXRIYXNCZWVuTmF2aWdhdGVkOiBJQ29udGV4dEtleTxib29sZWFuPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3BlcnNpc3RlZFNpemU6IElQZXJzaXN0ZWRXaWRnZXRTaXplRGVsZWdhdGUsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb3B0aW9uczogSVdvcmtiZW5jaFN1Z2dlc3RXaWRnZXRPcHRpb25zLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2dldEZvbnRJbmZvOiAoKSA9PiBJU2ltcGxlU3VnZ2VzdFdpZGdldEZvbnRJbmZvLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRm9udENvbmZpZ3VyYXRpb25DaGFuZ2U6IEV2ZW50PHZvaWQ+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2dldEFkdmFuY2VkRXhwbGFpbk1vZGVEZXRhaWxzOiAoKSA9PiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3N0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBfY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5lbGVtZW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJlc2l6YWJsZUhUTUxFbGVtZW50KCkpO1xuXHRcdHRoaXMuZWxlbWVudC5kb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ3dvcmtiZW5jaC1zdWdnZXN0LXdpZGdldCcpO1xuXHRcdHRoaXMuX2NvbnRhaW5lci5hcHBlbmRDaGlsZCh0aGlzLmVsZW1lbnQuZG9tTm9kZSk7XG5cdFx0dGhpcy5fY3R4U3VnZ2VzdFdpZGdldEhhc0ZvY3VzZWRTdWdnZXN0aW9uID0gU2ltcGxlU3VnZ2VzdENvbnRleHQuSGFzRm9jdXNlZFN1Z2dlc3Rpb24uYmluZFRvKF9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fY3R4U3VnZ2VzdFdpZGdldEhhc0JlZW5OYXZpZ2F0ZWQgPSBTaW1wbGVTdWdnZXN0Q29udGV4dC5IYXNOYXZpZ2F0ZWQuYmluZFRvKF9jb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHRjbGFzcyBSZXNpemVTdGF0ZSB7XG5cdFx0XHRjb25zdHJ1Y3Rvcihcblx0XHRcdFx0cmVhZG9ubHkgcGVyc2lzdGVkU2l6ZTogZG9tLkRpbWVuc2lvbiB8IHVuZGVmaW5lZCxcblx0XHRcdFx0cmVhZG9ubHkgY3VycmVudFNpemU6IGRvbS5EaW1lbnNpb24sXG5cdFx0XHRcdHB1YmxpYyBwZXJzaXN0SGVpZ2h0ID0gZmFsc2UsXG5cdFx0XHRcdHB1YmxpYyBwZXJzaXN0V2lkdGggPSBmYWxzZSxcblx0XHRcdCkgeyB9XG5cdFx0fVxuXG5cdFx0bGV0IHN0YXRlOiBSZXNpemVTdGF0ZSB8IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVsZW1lbnQub25EaWRXaWxsUmVzaXplKCgpID0+IHtcblx0XHRcdC8vIHRoaXMuX3ByZWZlcmVuY2VMb2NrZWQgPSB0cnVlO1xuXHRcdFx0c3RhdGUgPSBuZXcgUmVzaXplU3RhdGUodGhpcy5fcGVyc2lzdGVkU2l6ZS5yZXN0b3JlKCksIHRoaXMuZWxlbWVudC5zaXplKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lbGVtZW50Lm9uRGlkUmVzaXplKGUgPT4ge1xuXG5cdFx0XHR0aGlzLl9yZXNpemUoZS5kaW1lbnNpb24ud2lkdGgsIGUuZGltZW5zaW9uLmhlaWdodCk7XG5cblx0XHRcdGlmIChzdGF0ZSkge1xuXHRcdFx0XHRzdGF0ZS5wZXJzaXN0SGVpZ2h0ID0gc3RhdGUucGVyc2lzdEhlaWdodCB8fCAhIWUubm9ydGggfHwgISFlLnNvdXRoO1xuXHRcdFx0XHRzdGF0ZS5wZXJzaXN0V2lkdGggPSBzdGF0ZS5wZXJzaXN0V2lkdGggfHwgISFlLmVhc3QgfHwgISFlLndlc3Q7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghZS5kb25lKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHN0YXRlKSB7XG5cdFx0XHRcdC8vIG9ubHkgc3RvcmUgd2lkdGggb3IgaGVpZ2h0IHZhbHVlIHRoYXQgaGF2ZSBjaGFuZ2VkIGFuZCBhbHNvXG5cdFx0XHRcdC8vIG9ubHkgc3RvcmUgY2hhbmdlcyB0aGF0IGFyZSBhYm92ZSBhIGNlcnRhaW4gdGhyZXNob2xkXG5cdFx0XHRcdGNvbnN0IHsgaXRlbUhlaWdodCwgZGVmYXVsdFNpemUgfSA9IHRoaXMuX2dldExheW91dEluZm8oKTtcblx0XHRcdFx0Y29uc3QgdGhyZXNob2xkID0gTWF0aC5yb3VuZChpdGVtSGVpZ2h0IC8gMik7XG5cdFx0XHRcdGxldCB7IHdpZHRoLCBoZWlnaHQgfSA9IHRoaXMuZWxlbWVudC5zaXplO1xuXHRcdFx0XHRpZiAoIXN0YXRlLnBlcnNpc3RIZWlnaHQgfHwgTWF0aC5hYnMoc3RhdGUuY3VycmVudFNpemUuaGVpZ2h0IC0gaGVpZ2h0KSA8PSB0aHJlc2hvbGQpIHtcblx0XHRcdFx0XHRoZWlnaHQgPSBzdGF0ZS5wZXJzaXN0ZWRTaXplPy5oZWlnaHQgPz8gZGVmYXVsdFNpemUuaGVpZ2h0O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghc3RhdGUucGVyc2lzdFdpZHRoIHx8IE1hdGguYWJzKHN0YXRlLmN1cnJlbnRTaXplLndpZHRoIC0gd2lkdGgpIDw9IHRocmVzaG9sZCkge1xuXHRcdFx0XHRcdHdpZHRoID0gc3RhdGUucGVyc2lzdGVkU2l6ZT8ud2lkdGggPz8gZGVmYXVsdFNpemUud2lkdGg7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fcGVyc2lzdGVkU2l6ZS5zdG9yZShuZXcgZG9tLkRpbWVuc2lvbih3aWR0aCwgaGVpZ2h0KSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHJlc2V0IHdvcmtpbmcgc3RhdGVcblx0XHRcdC8vIHRoaXMuX3ByZWZlcmVuY2VMb2NrZWQgPSBmYWxzZTtcblx0XHRcdHN0YXRlID0gdW5kZWZpbmVkO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGFwcGx5SWNvblN0eWxlID0gKCkgPT4gdGhpcy5lbGVtZW50LmRvbU5vZGUuY2xhc3NMaXN0LnRvZ2dsZSgnbm8taWNvbnMnLCAhX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdlZGl0b3Iuc3VnZ2VzdC5zaG93SWNvbnMnKSk7XG5cdFx0YXBwbHlJY29uU3R5bGUoKTtcblxuXHRcdGNvbnN0IHJlbmRlcmVyID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2ltcGxlU3VnZ2VzdFdpZGdldEl0ZW1SZW5kZXJlciwgdGhpcy5fZ2V0Rm9udEluZm8uYmluZCh0aGlzKSwgdGhpcy5fb25EaWRGb250Q29uZmlndXJhdGlvbkNoYW5nZS5iaW5kKHRoaXMpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihyZW5kZXJlcik7XG5cdFx0dGhpcy5fbGlzdEVsZW1lbnQgPSBkb20uYXBwZW5kKHRoaXMuZWxlbWVudC5kb21Ob2RlLCAkKCcudHJlZScpKTtcblx0XHR0aGlzLl9saXN0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IExpc3Q8VEl0ZW0+KCdTdWdnZXN0V2lkZ2V0JywgdGhpcy5fbGlzdEVsZW1lbnQsIHtcblx0XHRcdGdldEhlaWdodDogKCk6IG51bWJlciA9PiB0aGlzLl9nZXRMYXlvdXRJbmZvKCkuaXRlbUhlaWdodCxcblx0XHRcdGdldFRlbXBsYXRlSWQ6ICgpOiBzdHJpbmcgPT4gJ3N1Z2dlc3Rpb24nXG5cdFx0fSwgW3JlbmRlcmVyXSwge1xuXHRcdFx0YWx3YXlzQ29uc3VtZU1vdXNlV2hlZWw6IHRydWUsXG5cdFx0XHR1c2VTaGFkb3dzOiBmYWxzZSxcblx0XHRcdG1vdXNlU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRtdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ6IGZhbHNlLFxuXHRcdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyOiB7XG5cdFx0XHRcdGdldFJvbGU6ICgpID0+ICdsaXN0aXRlbScsXG5cdFx0XHRcdGdldFdpZGdldEFyaWFMYWJlbDogKCkgPT4gbG9jYWxpemUoJ3N1Z2dlc3QnLCBcIlN1Z2dlc3RcIiksXG5cdFx0XHRcdGdldFdpZGdldFJvbGU6ICgpID0+ICdsaXN0Ym94Jyxcblx0XHRcdFx0Z2V0QXJpYUxhYmVsOiAoaXRlbTogU2ltcGxlQ29tcGxldGlvbkl0ZW0pID0+IHtcblx0XHRcdFx0XHRsZXQgbGFiZWwgPSBpdGVtLnRleHRMYWJlbDtcblx0XHRcdFx0XHRjb25zdCBraW5kTGFiZWwgPSBpdGVtLmNvbXBsZXRpb24ua2luZExhYmVsID8/ICcnO1xuXHRcdFx0XHRcdGlmICh0eXBlb2YgaXRlbS5jb21wbGV0aW9uLmxhYmVsICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0Y29uc3QgeyBkZXRhaWwsIGRlc2NyaXB0aW9uIH0gPSBpdGVtLmNvbXBsZXRpb24ubGFiZWw7XG5cdFx0XHRcdFx0XHRpZiAoZGV0YWlsICYmIGRlc2NyaXB0aW9uKSB7XG5cdFx0XHRcdFx0XHRcdGxhYmVsID0gbG9jYWxpemUoJ2xhYmVsLmZ1bGwnLCAnezB9ezF9LCB7Mn0gezN9JywgbGFiZWwsIGRldGFpbCwgZGVzY3JpcHRpb24sIGtpbmRMYWJlbCk7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGRldGFpbCkge1xuXHRcdFx0XHRcdFx0XHRsYWJlbCA9IGxvY2FsaXplKCdsYWJlbC5kZXRhaWwnLCAnezB9ezF9IHsyfScsIGxhYmVsLCBkZXRhaWwsIGtpbmRMYWJlbCk7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKGRlc2NyaXB0aW9uKSB7XG5cdFx0XHRcdFx0XHRcdGxhYmVsID0gbG9jYWxpemUoJ2xhYmVsLmRlc2MnLCAnezB9LCB7MX0gezJ9JywgbGFiZWwsIGRlc2NyaXB0aW9uLCBraW5kTGFiZWwpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRsYWJlbCA9IGxvY2FsaXplKCdsYWJlbCcsICd7MH0sIHsxfScsIGxhYmVsLCBraW5kTGFiZWwpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCB7IGRvY3VtZW50YXRpb24sIGRldGFpbCB9ID0gaXRlbS5jb21wbGV0aW9uO1xuXHRcdFx0XHRcdGNvbnN0IGRvY3MgPSBzdHJpbmdzLmZvcm1hdChcblx0XHRcdFx0XHRcdCd7MH17MX0nLFxuXHRcdFx0XHRcdFx0ZGV0YWlsIHx8ICcnLFxuXHRcdFx0XHRcdFx0ZG9jdW1lbnRhdGlvbiA/ICh0eXBlb2YgZG9jdW1lbnRhdGlvbiA9PT0gJ3N0cmluZycgPyBkb2N1bWVudGF0aW9uIDogZG9jdW1lbnRhdGlvbi52YWx1ZSkgOiAnJyk7XG5cblx0XHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoJ2FyaWFDdXJyZW50dFN1Z2dlc3Rpb25SZWFkRGV0YWlscycsIFwiezB9LCBkb2NzOiB7MX1cIiwgbGFiZWwsIGRvY3MpO1xuXHRcdFx0XHR9LFxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9saXN0Lm9uRGlkQ2hhbmdlRm9jdXMoZSA9PiB7XG5cdFx0XHRpZiAoZS5pbmRleGVzLmxlbmd0aCAmJiBlLmluZGV4ZXNbMF0gIT09IDApIHtcblx0XHRcdFx0dGhpcy5fY3R4U3VnZ2VzdFdpZGdldEhhc0JlZW5OYXZpZ2F0ZWQuc2V0KHRydWUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9tZXNzYWdlRWxlbWVudCA9IGRvbS5hcHBlbmQodGhpcy5lbGVtZW50LmRvbU5vZGUsIGRvbS4kKCcubWVzc2FnZScpKTtcblxuXHRcdGNvbnN0IGRldGFpbHM6IFNpbXBsZVN1Z2dlc3REZXRhaWxzV2lkZ2V0ID0gdGhpcy5fcmVnaXN0ZXIoX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNpbXBsZVN1Z2dlc3REZXRhaWxzV2lkZ2V0LCB0aGlzLl9nZXRGb250SW5mby5iaW5kKHRoaXMpLCB0aGlzLl9vbkRpZEZvbnRDb25maWd1cmF0aW9uQ2hhbmdlLmJpbmQodGhpcyksIHRoaXMuX2dldEFkdmFuY2VkRXhwbGFpbk1vZGVEZXRhaWxzLmJpbmQodGhpcykpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihkZXRhaWxzLm9uRGlkQ2xvc2UoKCkgPT4gdGhpcy50b2dnbGVEZXRhaWxzKCkpKTtcblx0XHR0aGlzLl9kZXRhaWxzID0gdGhpcy5fcmVnaXN0ZXIobmV3IFNpbXBsZVN1Z2dlc3REZXRhaWxzT3ZlcmxheShkZXRhaWxzLCB0aGlzLl9saXN0RWxlbWVudCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5fZGV0YWlscy53aWRnZXQuZG9tTm9kZSwgJ2JsdXInLCAoZSkgPT4gdGhpcy5fb25EaWRCbHVyRGV0YWlscy5maXJlKGUpKSk7XG5cblx0XHRpZiAoX29wdGlvbnMuc3RhdHVzQmFyTWVudUlkICYmIF9vcHRpb25zLnNob3dTdGF0dXNCYXJTZXR0aW5nSWQgJiYgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKF9vcHRpb25zLnNob3dTdGF0dXNCYXJTZXR0aW5nSWQpKSB7XG5cdFx0XHR0aGlzLl9zdGF0dXMgPSB0aGlzLl9yZWdpc3RlcihfaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU3VnZ2VzdFdpZGdldFN0YXR1cywgdGhpcy5lbGVtZW50LmRvbU5vZGUsIF9vcHRpb25zLnN0YXR1c0Jhck1lbnVJZCkpO1xuXHRcdFx0dGhpcy5lbGVtZW50LmRvbU5vZGUuY2xhc3NMaXN0LnRvZ2dsZSgnd2l0aC1zdGF0dXMtYmFyJywgdHJ1ZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbGlzdC5vbk1vdXNlRG93bihlID0+IHRoaXMuX29uTGlzdE1vdXNlRG93bk9yVGFwKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbGlzdC5vblRhcChlID0+IHRoaXMuX29uTGlzdE1vdXNlRG93bk9yVGFwKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbGlzdC5vbkRpZENoYW5nZUZvY3VzKGUgPT4gdGhpcy5fb25MaXN0Rm9jdXMoZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9saXN0Lm9uRGlkQ2hhbmdlU2VsZWN0aW9uKGUgPT4gdGhpcy5fb25MaXN0U2VsZWN0aW9uKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fb25EaWRGb250Q29uZmlndXJhdGlvbkNoYW5nZSgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fY29tcGxldGlvbk1vZGVsKSB7XG5cdFx0XHRcdHRoaXMuX2xpc3Quc3BsaWNlKDAsIHRoaXMuX2NvbXBsZXRpb25Nb2RlbC5pdGVtcy5sZW5ndGgsIHRoaXMuX2NvbXBsZXRpb25Nb2RlbCEuaXRlbXMpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihfY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2VkaXRvci5zdWdnZXN0LnNob3dJY29ucycpKSB7XG5cdFx0XHRcdGFwcGx5SWNvblN0eWxlKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoX29wdGlvbnMuc3RhdHVzQmFyTWVudUlkICYmIF9vcHRpb25zLnNob3dTdGF0dXNCYXJTZXR0aW5nSWQgJiYgZS5hZmZlY3RzQ29uZmlndXJhdGlvbihfb3B0aW9ucy5zaG93U3RhdHVzQmFyU2V0dGluZ0lkKSkge1xuXHRcdFx0XHRjb25zdCBzaG93U3RhdHVzQmFyOiBib29sZWFuID0gX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKF9vcHRpb25zLnNob3dTdGF0dXNCYXJTZXR0aW5nSWQpO1xuXHRcdFx0XHRpZiAoc2hvd1N0YXR1c0JhciAmJiAhdGhpcy5fc3RhdHVzKSB7XG5cdFx0XHRcdFx0dGhpcy5fc3RhdHVzID0gdGhpcy5fcmVnaXN0ZXIoX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFN1Z2dlc3RXaWRnZXRTdGF0dXMsIHRoaXMuZWxlbWVudC5kb21Ob2RlLCBfb3B0aW9ucy5zdGF0dXNCYXJNZW51SWQpKTtcblx0XHRcdFx0XHR0aGlzLl9zdGF0dXMuc2hvdygpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHNob3dTdGF0dXNCYXIgJiYgdGhpcy5fc3RhdHVzKSB7XG5cdFx0XHRcdFx0dGhpcy5fc3RhdHVzLnNob3coKTtcblx0XHRcdFx0fSBlbHNlIGlmICh0aGlzLl9zdGF0dXMpIHtcblx0XHRcdFx0XHR0aGlzLl9zdGF0dXMuZWxlbWVudC5yZW1vdmUoKTtcblx0XHRcdFx0XHR0aGlzLl9zdGF0dXMuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHRoaXMuX3N0YXR1cyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR0aGlzLl9sYXlvdXQodW5kZWZpbmVkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmVsZW1lbnQuZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCd3aXRoLXN0YXR1cy1iYXInLCBzaG93U3RhdHVzQmFyKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF9vbkxpc3RGb2N1cyhlOiBJTGlzdEV2ZW50PFRJdGVtPik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9pZ25vcmVGb2N1c0V2ZW50cykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9zdGF0ZSA9PT0gU3RhdGUuRGV0YWlscykge1xuXHRcdFx0Ly8gVGhpcyBjYW4gaGFwcGVuIHdoZW4gZm9jdXMgaXMgaW4gdGhlIGRldGFpbHMtcGFuZWwgYW5kIHdoZW5cblx0XHRcdC8vIGFycm93IGtleXMgYXJlIHByZXNzZWQgdG8gc2VsZWN0IG5leHQvcHJldiBpdGVtc1xuXHRcdFx0dGhpcy5fc2V0U3RhdGUoU3RhdGUuT3Blbik7XG5cdFx0fVxuXG5cdFx0aWYgKCFlLmVsZW1lbnRzLmxlbmd0aCkge1xuXHRcdFx0aWYgKHRoaXMuX2N1cnJlbnRTdWdnZXN0aW9uRGV0YWlscykge1xuXHRcdFx0XHR0aGlzLl9jdXJyZW50U3VnZ2VzdGlvbkRldGFpbHMuY2FuY2VsKCk7XG5cdFx0XHRcdHRoaXMuX2N1cnJlbnRTdWdnZXN0aW9uRGV0YWlscyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0dGhpcy5fZm9jdXNlZEl0ZW0gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMuX2N0eFN1Z2dlc3RXaWRnZXRIYXNGb2N1c2VkU3VnZ2VzdGlvbi5zZXQoZmFsc2UpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fY2xlYXJBcmlhQWN0aXZlRGVzY2VuZGFudCgpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fY29tcGxldGlvbk1vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fY3R4U3VnZ2VzdFdpZGdldEhhc0ZvY3VzZWRTdWdnZXN0aW9uLnNldCh0cnVlKTtcblx0XHRjb25zdCBpdGVtID0gZS5lbGVtZW50c1swXTtcblx0XHRjb25zdCBpbmRleCA9IGUuaW5kZXhlc1swXTtcblxuXHRcdGlmIChpdGVtICE9PSB0aGlzLl9mb2N1c2VkSXRlbSkge1xuXG5cdFx0XHR0aGlzLl9jdXJyZW50U3VnZ2VzdGlvbkRldGFpbHM/LmNhbmNlbCgpO1xuXHRcdFx0dGhpcy5fY3VycmVudFN1Z2dlc3Rpb25EZXRhaWxzID0gdW5kZWZpbmVkO1xuXG5cdFx0XHR0aGlzLl9mb2N1c2VkSXRlbSA9IGl0ZW07XG5cblx0XHRcdHRoaXMuX2xpc3QucmV2ZWFsKGluZGV4KTtcblxuXHRcdFx0Y29uc3QgaWQgPSBnZXRBcmlhSWQoaW5kZXgpO1xuXHRcdFx0Y29uc3Qgbm9kZSA9IGRvbS5nZXRBY3RpdmVXaW5kb3coKS5kb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXHRcdFx0aWYgKG5vZGUgJiYgaWQpIHtcblx0XHRcdFx0bm9kZS5zZXRBdHRyaWJ1dGUoJ2FyaWEtaGFzcG9wdXAnLCAndHJ1ZScpO1xuXHRcdFx0XHRub2RlLnNldEF0dHJpYnV0ZSgnYXJpYS1hdXRvY29tcGxldGUnLCAnbGlzdCcpO1xuXHRcdFx0XHRub2RlLnNldEF0dHJpYnV0ZSgnYXJpYS1hY3RpdmVkZXNjZW5kYW50JywgaWQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fY2xlYXJBcmlhQWN0aXZlRGVzY2VuZGFudCgpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9jdXJyZW50U3VnZ2VzdGlvbkRldGFpbHMgPSBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZShhc3luYyB0b2tlbiA9PiB7XG5cdFx0XHRcdGNvbnN0IGxvYWRpbmcgPSBkaXNwb3NhYmxlVGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuX2lzRGV0YWlsc1Zpc2libGUoKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fc2hvd0RldGFpbHModHJ1ZSwgZmFsc2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSwgMjUwKTtcblx0XHRcdFx0Y29uc3Qgc3ViID0gdG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoKCkgPT4gbG9hZGluZy5kaXNwb3NlKCkpO1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHJldHVybiBhd2FpdCBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHRsb2FkaW5nLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRzdWIuZGlzcG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5fY3VycmVudFN1Z2dlc3Rpb25EZXRhaWxzLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRpZiAoaW5kZXggPj0gdGhpcy5fbGlzdC5sZW5ndGggfHwgaXRlbSAhPT0gdGhpcy5fbGlzdC5lbGVtZW50KGluZGV4KSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIGl0ZW0gY2FuIGhhdmUgZXh0cmEgaW5mb3JtYXRpb24sIHNvIHJlLXJlbmRlclxuXHRcdFx0XHR0aGlzLl9pZ25vcmVGb2N1c0V2ZW50cyA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX2xpc3Quc3BsaWNlKGluZGV4LCAxLCBbaXRlbV0pO1xuXHRcdFx0XHR0aGlzLl9saXN0LnNldEZvY3VzKFtpbmRleF0pO1xuXHRcdFx0XHR0aGlzLl9pZ25vcmVGb2N1c0V2ZW50cyA9IGZhbHNlO1xuXG5cdFx0XHRcdGlmICh0aGlzLl9pc0RldGFpbHNWaXNpYmxlKCkpIHtcblx0XHRcdFx0XHR0aGlzLl9zaG93RGV0YWlscyhmYWxzZSwgZmFsc2UpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuZWxlbWVudC5kb21Ob2RlLmNsYXNzTGlzdC5yZW1vdmUoJ2RvY3Mtc2lkZScpO1xuXHRcdFx0XHR9XG5cblx0XHRcdH0pLmNhdGNoKCk7XG5cdFx0fVxuXHRcdC8vIGVtaXQgYW4gZXZlbnRcblx0XHR0aGlzLl9vbkRpZEZvY3VzLmZpcmUoeyBpdGVtLCBpbmRleCwgbW9kZWw6IHRoaXMuX2NvbXBsZXRpb25Nb2RlbCB9KTtcblx0fVxuXG5cdHByaXZhdGUgX2NsZWFyQXJpYUFjdGl2ZURlc2NlbmRhbnQoKTogdm9pZCB7XG5cdFx0Y29uc3Qgbm9kZSA9IGRvbS5nZXRBY3RpdmVXaW5kb3coKS5kb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuXHRcdGlmICghbm9kZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRub2RlLnNldEF0dHJpYnV0ZSgnYXJpYS1oYXNwb3B1cCcsICdmYWxzZScpO1xuXHRcdG5vZGUuc2V0QXR0cmlidXRlKCdhcmlhLWF1dG9jb21wbGV0ZScsICdib3RoJyk7XG5cdFx0bm9kZS5yZW1vdmVBdHRyaWJ1dGUoJ2FyaWEtYWN0aXZlZGVzY2VuZGFudCcpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3Vyc29yUG9zaXRpb24/OiB7IHRvcDogbnVtYmVyOyBsZWZ0OiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH07XG5cblx0c2V0Q29tcGxldGlvbk1vZGVsKGNvbXBsZXRpb25Nb2RlbDogVE1vZGVsKSB7XG5cdFx0dGhpcy5fY29tcGxldGlvbk1vZGVsID0gY29tcGxldGlvbk1vZGVsO1xuXHR9XG5cblx0aGFzQ29tcGxldGlvbnMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbXBsZXRpb25Nb2RlbD8uaXRlbXMubGVuZ3RoICE9PSAwO1xuXHR9XG5cblx0cmVzZXRXaWRnZXRTaXplKCk6IHZvaWQge1xuXHRcdHRoaXMuX3BlcnNpc3RlZFNpemUucmVzZXQoKTtcblx0fVxuXG5cdHNob3dTdWdnZXN0aW9ucyhzZWxlY3Rpb25JbmRleDogbnVtYmVyLCBpc0Zyb3plbjogYm9vbGVhbiwgaXNBdXRvOiBib29sZWFuLCBjdXJzb3JQb3NpdGlvbjogeyB0b3A6IG51bWJlcjsgbGVmdDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9KTogdm9pZCB7XG5cdFx0dGhpcy5fY3Vyc29yUG9zaXRpb24gPSBjdXJzb3JQb3NpdGlvbjtcblxuXHRcdC8vIHRoaXMuX2NvbnRlbnRXaWRnZXQuc2V0UG9zaXRpb24odGhpcy5lZGl0b3IuZ2V0UG9zaXRpb24oKSk7XG5cdFx0Ly8gdGhpcy5fbG9hZGluZ1RpbWVvdXQ/LmRpc3Bvc2UoKTtcblxuXHRcdC8vIHRoaXMuX2N1cnJlbnRTdWdnZXN0aW9uRGV0YWlscz8uY2FuY2VsKCk7XG5cdFx0Ly8gdGhpcy5fY3VycmVudFN1Z2dlc3Rpb25EZXRhaWxzID0gdW5kZWZpbmVkO1xuXG5cdFx0aWYgKGlzRnJvemVuICYmIHRoaXMuX3N0YXRlICE9PSBTdGF0ZS5FbXB0eSAmJiB0aGlzLl9zdGF0ZSAhPT0gU3RhdGUuSGlkZGVuKSB7XG5cdFx0XHR0aGlzLl9zZXRTdGF0ZShTdGF0ZS5Gcm96ZW4pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHZpc2libGVDb3VudCA9IHRoaXMuX2NvbXBsZXRpb25Nb2RlbD8uaXRlbXMubGVuZ3RoID8/IDA7XG5cdFx0Y29uc3QgaXNFbXB0eSA9IHZpc2libGVDb3VudCA9PT0gMDtcblx0XHQvLyB0aGlzLl9jdHhTdWdnZXN0V2lkZ2V0TXVsdGlwbGVTdWdnZXN0aW9ucy5zZXQodmlzaWJsZUNvdW50ID4gMSk7XG5cblx0XHRpZiAoaXNFbXB0eSkge1xuXHRcdFx0dGhpcy5fc2V0U3RhdGUoaXNBdXRvID8gU3RhdGUuSGlkZGVuIDogU3RhdGUuRW1wdHkpO1xuXHRcdFx0dGhpcy5fY29tcGxldGlvbk1vZGVsID0gdW5kZWZpbmVkO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIHRoaXMuX2ZvY3VzZWRJdGVtID0gdW5kZWZpbmVkO1xuXG5cdFx0Ly8gY2FsbGluZyBsaXN0LnNwbGljZSB0cmlnZ2VycyBmb2N1cyBldmVudCB3aGljaCB0aGlzIHdpZGdldCBmb3J3YXJkcy4gVGhhdCBjYW4gbGVhZCB0b1xuXHRcdC8vIHN1Z2dlc3Rpb25zIGJlaW5nIGNhbmNlbGxlZCBhbmQgdGhlIHdpZGdldCBiZWluZyBjbGVhcmVkIChhbmQgaGlkZGVuKS4gQWxsIHRoaXMgaGFwcGVuc1xuXHRcdC8vIGJlZm9yZSByZXZlYWxpbmcgYW5kIGZvY3VzaW5nIGlzIGRvbmUgd2hpY2ggbWVhbnMgcmV2ZWFsaW5nIGFuZCBmb2N1c2luZyB3aWxsIGZhaWwgd2hlblxuXHRcdC8vIHRoZXkgZ2V0IHJ1bi5cblx0XHQvLyB0aGlzLl9vbkRpZEZvY3VzLnBhdXNlKCk7XG5cdFx0Ly8gdGhpcy5fb25EaWRTZWxlY3QucGF1c2UoKTtcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5fbGlzdC5zcGxpY2UoMCwgdGhpcy5fbGlzdC5sZW5ndGgsIHRoaXMuX2NvbXBsZXRpb25Nb2RlbD8uaXRlbXMgPz8gW10pO1xuXHRcdFx0dGhpcy5fc2V0U3RhdGUoaXNGcm96ZW4gPyBTdGF0ZS5Gcm96ZW4gOiBTdGF0ZS5PcGVuKTtcblx0XHRcdHRoaXMuX2xpc3QucmV2ZWFsKHNlbGVjdGlvbkluZGV4LCAwKTtcblx0XHRcdHRoaXMuX2xpc3Quc2V0Rm9jdXMoW3NlbGVjdGlvbkluZGV4XSk7XG5cdFx0XHQvLyB0aGlzLl9saXN0LnNldEZvY3VzKG5vRm9jdXMgPyBbXSA6IFtzZWxlY3Rpb25JbmRleF0pO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHQvLyB0aGlzLl9vbkRpZEZvY3VzLnJlc3VtZSgpO1xuXHRcdFx0Ly8gdGhpcy5fb25EaWRTZWxlY3QucmVzdW1lKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcGVuZGluZ0xheW91dC52YWx1ZSA9IGRvbS5ydW5BdFRoaXNPclNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUoZG9tLmdldFdpbmRvdyh0aGlzLmVsZW1lbnQuZG9tTm9kZSksICgpID0+IHtcblx0XHRcdHRoaXMuX3BlbmRpbmdMYXlvdXQuY2xlYXIoKTtcblx0XHRcdHRoaXMuX2xheW91dCh0aGlzLmVsZW1lbnQuc2l6ZSk7XG5cdFx0XHQvLyBSZXNldCBmb2N1cyBib3JkZXJcblx0XHRcdC8vIHRoaXMuX2RldGFpbHMud2lkZ2V0LmRvbU5vZGUuY2xhc3NMaXN0LnJlbW92ZSgnZm9jdXNlZCcpO1xuXHRcdH0pO1xuXHRcdHRoaXMuX2FmdGVyUmVuZGVyKCk7XG5cdH1cblxuXHRzZXRMaW5lQ29udGV4dChsaW5lQ29udGV4dDogTGluZUNvbnRleHQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fY29tcGxldGlvbk1vZGVsKSB7XG5cdFx0XHR0aGlzLl9jb21wbGV0aW9uTW9kZWwubGluZUNvbnRleHQgPSBsaW5lQ29udGV4dDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9zZXRTdGF0ZShzdGF0ZTogU3RhdGUpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fc3RhdGUgPT09IHN0YXRlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3N0YXRlID0gc3RhdGU7XG5cblx0XHR0aGlzLmVsZW1lbnQuZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdmcm96ZW4nLCBzdGF0ZSA9PT0gU3RhdGUuRnJvemVuKTtcblx0XHR0aGlzLmVsZW1lbnQuZG9tTm9kZS5jbGFzc0xpc3QucmVtb3ZlKCdtZXNzYWdlJyk7XG5cblx0XHRzd2l0Y2ggKHN0YXRlKSB7XG5cdFx0XHRjYXNlIFN0YXRlLkhpZGRlbjpcblx0XHRcdFx0aWYgKHRoaXMuX3N0YXR1cykge1xuXHRcdFx0XHRcdGRvbS5oaWRlKHRoaXMuX3N0YXR1cy5lbGVtZW50KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRkb20uaGlkZSh0aGlzLl9saXN0RWxlbWVudCk7XG5cdFx0XHRcdGRvbS5oaWRlKHRoaXMuX21lc3NhZ2VFbGVtZW50KTtcblx0XHRcdFx0ZG9tLmhpZGUodGhpcy5lbGVtZW50LmRvbU5vZGUpO1xuXHRcdFx0XHR0aGlzLl9kZXRhaWxzLmhpZGUodHJ1ZSk7XG5cdFx0XHRcdHRoaXMuX3N0YXR1cz8uaGlkZSgpO1xuXHRcdFx0XHQvLyB0aGlzLl9jb250ZW50V2lkZ2V0LmhpZGUoKTtcblx0XHRcdFx0Ly8gdGhpcy5fY3R4U3VnZ2VzdFdpZGdldFZpc2libGUucmVzZXQoKTtcblx0XHRcdFx0Ly8gdGhpcy5fY3R4U3VnZ2VzdFdpZGdldE11bHRpcGxlU3VnZ2VzdGlvbnMucmVzZXQoKTtcblx0XHRcdFx0dGhpcy5fY3R4U3VnZ2VzdFdpZGdldEhhc0ZvY3VzZWRTdWdnZXN0aW9uLnJlc2V0KCk7XG5cdFx0XHRcdHRoaXMuX3Nob3dUaW1lb3V0LmNhbmNlbCgpO1xuXHRcdFx0XHR0aGlzLmVsZW1lbnQuZG9tTm9kZS5jbGFzc0xpc3QucmVtb3ZlKCd2aXNpYmxlJyk7XG5cdFx0XHRcdHRoaXMuX2xpc3Quc3BsaWNlKDAsIHRoaXMuX2xpc3QubGVuZ3RoKTtcblx0XHRcdFx0dGhpcy5fZm9jdXNlZEl0ZW0gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMuX2NhcHBlZEhlaWdodCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0dGhpcy5fZXhwbGFpbk1vZGUgPSBmYWxzZTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFN0YXRlLkxvYWRpbmc6XG5cdFx0XHRcdHRoaXMuZWxlbWVudC5kb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ21lc3NhZ2UnKTtcblx0XHRcdFx0dGhpcy5fbWVzc2FnZUVsZW1lbnQudGV4dENvbnRlbnQgPSBTaW1wbGVTdWdnZXN0V2lkZ2V0LkxPQURJTkdfTUVTU0FHRTtcblx0XHRcdFx0ZG9tLmhpZGUodGhpcy5fbGlzdEVsZW1lbnQpO1xuXHRcdFx0XHRpZiAodGhpcy5fc3RhdHVzKSB7XG5cdFx0XHRcdFx0ZG9tLmhpZGUodGhpcy5fc3RhdHVzLmVsZW1lbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRvbS5zaG93KHRoaXMuX21lc3NhZ2VFbGVtZW50KTtcblx0XHRcdFx0dGhpcy5fZGV0YWlscy5oaWRlKCk7XG5cdFx0XHRcdHRoaXMuX3Nob3coKTtcblx0XHRcdFx0dGhpcy5fZm9jdXNlZEl0ZW0gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBTdGF0ZS5FbXB0eTpcblx0XHRcdFx0dGhpcy5lbGVtZW50LmRvbU5vZGUuY2xhc3NMaXN0LmFkZCgnbWVzc2FnZScpO1xuXHRcdFx0XHR0aGlzLl9tZXNzYWdlRWxlbWVudC50ZXh0Q29udGVudCA9IFNpbXBsZVN1Z2dlc3RXaWRnZXQuTk9fU1VHR0VTVElPTlNfTUVTU0FHRTtcblx0XHRcdFx0ZG9tLmhpZGUodGhpcy5fbGlzdEVsZW1lbnQpO1xuXHRcdFx0XHRpZiAodGhpcy5fc3RhdHVzKSB7XG5cdFx0XHRcdFx0ZG9tLmhpZGUodGhpcy5fc3RhdHVzLmVsZW1lbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRvbS5zaG93KHRoaXMuX21lc3NhZ2VFbGVtZW50KTtcblx0XHRcdFx0dGhpcy5fZGV0YWlscy5oaWRlKCk7XG5cdFx0XHRcdHRoaXMuX3Nob3coKTtcblx0XHRcdFx0dGhpcy5fZm9jdXNlZEl0ZW0gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHN0YXR1cyhTaW1wbGVTdWdnZXN0V2lkZ2V0Lk5PX1NVR0dFU1RJT05TX01FU1NBR0UpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgU3RhdGUuT3Blbjpcblx0XHRcdFx0ZG9tLmhpZGUodGhpcy5fbWVzc2FnZUVsZW1lbnQpO1xuXHRcdFx0XHR0aGlzLl9zaG93TGlzdEFuZFN0YXR1cygpO1xuXHRcdFx0XHR0aGlzLl9zaG93KCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBTdGF0ZS5Gcm96ZW46XG5cdFx0XHRcdGRvbS5oaWRlKHRoaXMuX21lc3NhZ2VFbGVtZW50KTtcblx0XHRcdFx0dGhpcy5fc2hvd0xpc3RBbmRTdGF0dXMoKTtcblx0XHRcdFx0dGhpcy5fc2hvdygpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgU3RhdGUuRGV0YWlsczpcblx0XHRcdFx0ZG9tLmhpZGUodGhpcy5fbWVzc2FnZUVsZW1lbnQpO1xuXHRcdFx0XHR0aGlzLl9zaG93TGlzdEFuZFN0YXR1cygpO1xuXHRcdFx0XHR0aGlzLl9kZXRhaWxzLnNob3coKTtcblx0XHRcdFx0dGhpcy5fc2hvdygpO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9zaG93TGlzdEFuZFN0YXR1cygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fc3RhdHVzKSB7XG5cdFx0XHRkb20uc2hvdyh0aGlzLl9saXN0RWxlbWVudCwgdGhpcy5fc3RhdHVzLmVsZW1lbnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkb20uc2hvdyh0aGlzLl9saXN0RWxlbWVudCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfc2hvdygpOiB2b2lkIHtcblx0XHQvLyB0aGlzLl9sYXlvdXQodGhpcy5fcGVyc2lzdGVkU2l6ZS5yZXN0b3JlKCkpO1xuXHRcdC8vIGRvbS5zaG93KHRoaXMuZWxlbWVudC5kb21Ob2RlKTtcblx0XHQvLyB0aGlzLl9vbkRpZFNob3cuZmlyZSgpO1xuXG5cblx0XHR0aGlzLl9zdGF0dXM/LnNob3coKTtcblx0XHQvLyB0aGlzLl9jb250ZW50V2lkZ2V0LnNob3coKTtcblx0XHRkb20uc2hvdyh0aGlzLmVsZW1lbnQuZG9tTm9kZSk7XG5cdFx0dGhpcy5fbGF5b3V0KHRoaXMuX3BlcnNpc3RlZFNpemUucmVzdG9yZSgpKTtcblx0XHQvLyB0aGlzLl9jdHhTdWdnZXN0V2lkZ2V0VmlzaWJsZS5zZXQodHJ1ZSk7XG5cblx0XHR0aGlzLl9vbkRpZFNob3cuZmlyZSh0aGlzKTtcblx0XHR0aGlzLl9zaG93VGltZW91dC5jYW5jZWxBbmRTZXQoKCkgPT4ge1xuXHRcdFx0dGhpcy5lbGVtZW50LmRvbU5vZGUuY2xhc3NMaXN0LmFkZCgndmlzaWJsZScpO1xuXHRcdH0sIDEwMCk7XG5cdH1cblxuXG5cdHRvZ2dsZURldGFpbHNGb2N1cygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fc3RhdGUgPT09IFN0YXRlLkRldGFpbHMpIHtcblx0XHRcdC8vIFNob3VsZCByZXR1cm4gdGhlIGZvY3VzIHRvIHRoZSBsaXN0IGl0ZW0uXG5cdFx0XHR0aGlzLl9saXN0LnNldEZvY3VzKHRoaXMuX2xpc3QuZ2V0Rm9jdXMoKSk7XG5cdFx0XHR0aGlzLl9zZXRTdGF0ZShTdGF0ZS5PcGVuKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX3N0YXRlID09PSBTdGF0ZS5PcGVuKSB7XG5cdFx0XHR0aGlzLl9zZXRTdGF0ZShTdGF0ZS5EZXRhaWxzKTtcblx0XHRcdGlmICghdGhpcy5faXNEZXRhaWxzVmlzaWJsZSgpKSB7XG5cdFx0XHRcdHRoaXMudG9nZ2xlRGV0YWlscyh0cnVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2RldGFpbHMud2lkZ2V0LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0dG9nZ2xlRGV0YWlscyhmb2N1c2VkOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNEZXRhaWxzVmlzaWJsZSgpKSB7XG5cdFx0XHQvLyBoaWRlIGRldGFpbHMgd2lkZ2V0XG5cdFx0XHR0aGlzLl9wZW5kaW5nU2hvd0RldGFpbHMuY2xlYXIoKTtcblx0XHRcdC8vIHRoaXMuX2N0eFN1Z2dlc3RXaWRnZXREZXRhaWxzVmlzaWJsZS5zZXQoZmFsc2UpO1xuXG5cdFx0XHR0aGlzLl9zZXREZXRhaWxzVmlzaWJsZShmYWxzZSk7XG5cdFx0XHR0aGlzLl9kZXRhaWxzLmhpZGUoKTtcblx0XHRcdHRoaXMuZWxlbWVudC5kb21Ob2RlLmNsYXNzTGlzdC5yZW1vdmUoJ3Nob3dzLWRldGFpbHMnKTtcblxuXHRcdH0gZWxzZSBpZiAoKGNhbkV4cGFuZENvbXBsZXRpb25JdGVtKHRoaXMuX2xpc3QuZ2V0Rm9jdXNlZEVsZW1lbnRzKClbMF0pIHx8IHRoaXMuX2V4cGxhaW5Nb2RlKSAmJiAodGhpcy5fc3RhdGUgPT09IFN0YXRlLk9wZW4gfHwgdGhpcy5fc3RhdGUgPT09IFN0YXRlLkRldGFpbHMgfHwgdGhpcy5fc3RhdGUgPT09IFN0YXRlLkZyb3plbikpIHtcblx0XHRcdC8vIHNob3cgZGV0YWlscyB3aWRnZXQgKGlmZiBwb3NzaWJsZSlcblx0XHRcdC8vIHRoaXMuX2N0eFN1Z2dlc3RXaWRnZXREZXRhaWxzVmlzaWJsZS5zZXQodHJ1ZSk7XG5cblx0XHRcdHRoaXMuX3NldERldGFpbHNWaXNpYmxlKHRydWUpO1xuXHRcdFx0dGhpcy5fc2hvd0RldGFpbHMoZmFsc2UsIGZvY3VzZWQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3Nob3dEZXRhaWxzKGxvYWRpbmc6IGJvb2xlYW4sIGZvY3VzZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHR0aGlzLl9wZW5kaW5nU2hvd0RldGFpbHMudmFsdWUgPSBkb20ucnVuQXRUaGlzT3JTY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lKGRvbS5nZXRXaW5kb3codGhpcy5lbGVtZW50LmRvbU5vZGUpLCAoKSA9PiB7XG5cdFx0XHR0aGlzLl9wZW5kaW5nU2hvd0RldGFpbHMuY2xlYXIoKTtcblx0XHRcdHRoaXMuX2RldGFpbHMuc2hvdygpO1xuXHRcdFx0bGV0IGRpZEZvY3VzRGV0YWlscyA9IGZhbHNlO1xuXHRcdFx0aWYgKGxvYWRpbmcpIHtcblx0XHRcdFx0dGhpcy5fZGV0YWlscy53aWRnZXQucmVuZGVyTG9hZGluZygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fZGV0YWlscy53aWRnZXQucmVuZGVySXRlbSh0aGlzLl9saXN0LmdldEZvY3VzZWRFbGVtZW50cygpWzBdLCB0aGlzLl9leHBsYWluTW9kZSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXRoaXMuX2RldGFpbHMud2lkZ2V0LmlzRW1wdHkpIHtcblx0XHRcdFx0dGhpcy5fcG9zaXRpb25EZXRhaWxzKCk7XG5cdFx0XHRcdHRoaXMuZWxlbWVudC5kb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ3Nob3dzLWRldGFpbHMnKTtcblx0XHRcdFx0aWYgKGZvY3VzZWQpIHtcblx0XHRcdFx0XHR0aGlzLl9kZXRhaWxzLndpZGdldC5mb2N1cygpO1xuXHRcdFx0XHRcdGRpZEZvY3VzRGV0YWlscyA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2RldGFpbHMuaGlkZSgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFkaWRGb2N1c0RldGFpbHMpIHtcblx0XHRcdFx0Ly8gdGhpcy5lZGl0b3IuZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHRvZ2dsZUV4cGxhaW5Nb2RlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9saXN0LmdldEZvY3VzZWRFbGVtZW50cygpWzBdKSB7XG5cdFx0XHR0aGlzLl9leHBsYWluTW9kZSA9ICF0aGlzLl9leHBsYWluTW9kZTtcblx0XHRcdGlmICghdGhpcy5faXNEZXRhaWxzVmlzaWJsZSgpKSB7XG5cdFx0XHRcdHRoaXMudG9nZ2xlRGV0YWlscygpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fc2hvd0RldGFpbHMoZmFsc2UsIGZhbHNlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRoaWRlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3BlbmRpbmdMYXlvdXQuY2xlYXIoKTtcblx0XHR0aGlzLl9wZW5kaW5nU2hvd0RldGFpbHMuY2xlYXIoKTtcblx0XHQvLyB0aGlzLl9sb2FkaW5nVGltZW91dD8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2N0eFN1Z2dlc3RXaWRnZXRIYXNCZWVuTmF2aWdhdGVkLnJlc2V0KCk7XG5cdFx0dGhpcy5fc2V0U3RhdGUoU3RhdGUuSGlkZGVuKTtcblx0XHR0aGlzLl9vbkRpZEhpZGUuZmlyZSh0aGlzKTtcblx0XHRkb20uaGlkZSh0aGlzLmVsZW1lbnQuZG9tTm9kZSk7XG5cdFx0dGhpcy5lbGVtZW50LmNsZWFyU2FzaEhvdmVyU3RhdGUoKTtcblx0XHQvLyBlbnN1cmUgdGhhdCBhIHJlYXNvbmFibGUgd2lkZ2V0IGhlaWdodCBpcyBwZXJzaXN0ZWQgc28gdGhhdFxuXHRcdC8vIGFjY2lkZW50aWFsIFwicmVzaXplLXRvLXNpbmdsZS1pdGVtc1wiIGNhc2VzIGFyZW4ndCBoYXBwZW5pbmdcblx0XHRjb25zdCBkaW0gPSB0aGlzLl9wZXJzaXN0ZWRTaXplLnJlc3RvcmUoKTtcblx0XHRjb25zdCBtaW5QZXJzaXN0ZWRIZWlnaHQgPSBNYXRoLmNlaWwodGhpcy5fZ2V0TGF5b3V0SW5mbygpLml0ZW1IZWlnaHQgKiA0LjMpO1xuXHRcdGlmIChkaW0gJiYgZGltLmhlaWdodCA8IG1pblBlcnNpc3RlZEhlaWdodCkge1xuXHRcdFx0dGhpcy5fcGVyc2lzdGVkU2l6ZS5zdG9yZShkaW0ud2l0aCh1bmRlZmluZWQsIG1pblBlcnNpc3RlZEhlaWdodCkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2xheW91dChzaXplOiBkb20uRGltZW5zaW9uIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9jdXJzb3JQb3NpdGlvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHQvLyBpZiAoIXRoaXMuZWRpdG9yLmhhc01vZGVsKCkpIHtcblx0XHQvLyBcdHJldHVybjtcblx0XHQvLyB9XG5cdFx0Ly8gaWYgKCF0aGlzLmVkaXRvci5nZXREb21Ob2RlKCkpIHtcblx0XHQvLyBcdC8vIGhhcHBlbnMgd2hlbiBydW5uaW5nIHRlc3RzXG5cdFx0Ly8gXHRyZXR1cm47XG5cdFx0Ly8gfVxuXG5cdFx0Y29uc3QgYm9keUJveCA9IGRvbS5nZXRDbGllbnRBcmVhKHRoaXMuX2NvbnRhaW5lci5vd25lckRvY3VtZW50LmJvZHkpO1xuXHRcdGNvbnN0IGluZm8gPSB0aGlzLl9nZXRMYXlvdXRJbmZvKCk7XG5cblx0XHRpZiAoIXNpemUpIHtcblx0XHRcdHNpemUgPSBpbmZvLmRlZmF1bHRTaXplO1xuXHRcdH1cblxuXHRcdGxldCBoZWlnaHQgPSBzaXplLmhlaWdodDtcblx0XHRsZXQgd2lkdGggPSBzaXplLndpZHRoO1xuXG5cdFx0Ly8gc3RhdHVzIGJhclxuXHRcdGlmICh0aGlzLl9zdGF0dXMpIHtcblx0XHRcdHRoaXMuX3N0YXR1cy5lbGVtZW50LnN0eWxlLmhlaWdodCA9IGAke2luZm8uaXRlbUhlaWdodH1weGA7XG5cdFx0fVxuXG5cdFx0Ly8gaWYgKHRoaXMuX3N0YXRlID09PSBTdGF0ZS5FbXB0eSB8fCB0aGlzLl9zdGF0ZSA9PT0gU3RhdGUuTG9hZGluZykge1xuXHRcdC8vIFx0Ly8gc2hvd2luZyBhIG1lc3NhZ2Ugb25seVxuXHRcdC8vIFx0aGVpZ2h0ID0gaW5mby5pdGVtSGVpZ2h0ICsgaW5mby5ib3JkZXJIZWlnaHQ7XG5cdFx0Ly8gXHR3aWR0aCA9IGluZm8uZGVmYXVsdFNpemUud2lkdGggLyAyO1xuXHRcdC8vIFx0dGhpcy5lbGVtZW50LmVuYWJsZVNhc2hlcyhmYWxzZSwgZmFsc2UsIGZhbHNlLCBmYWxzZSk7XG5cdFx0Ly8gXHR0aGlzLmVsZW1lbnQubWluU2l6ZSA9IHRoaXMuZWxlbWVudC5tYXhTaXplID0gbmV3IGRvbS5EaW1lbnNpb24od2lkdGgsIGhlaWdodCk7XG5cdFx0Ly8gXHR0aGlzLl9jb250ZW50V2lkZ2V0LnNldFByZWZlcmVuY2UoQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZS5CRUxPVyk7XG5cblx0XHQvLyB9IGVsc2Uge1xuXHRcdC8vIHNob3dpbmcgaXRlbXNcblxuXHRcdC8vIHdpZHRoIG1hdGhcblx0XHRjb25zdCBtYXhXaWR0aCA9IGJvZHlCb3gud2lkdGggLSBpbmZvLmJvcmRlckhlaWdodCAtIDIgKiBpbmZvLmhvcml6b250YWxQYWRkaW5nO1xuXHRcdGlmICh3aWR0aCA+IG1heFdpZHRoKSB7XG5cdFx0XHR3aWR0aCA9IG1heFdpZHRoO1xuXHRcdH1cblx0XHRjb25zdCBwcmVmZXJyZWRXaWR0aCA9IHRoaXMuX2NvbXBsZXRpb25Nb2RlbCA/IHRoaXMuX2NvbXBsZXRpb25Nb2RlbC5zdGF0cy5wTGFiZWxMZW4gKiBpbmZvLnR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aCA6IHdpZHRoO1xuXG5cdFx0Ly8gaGVpZ2h0IG1hdGhcblx0XHRjb25zdCBmdWxsSGVpZ2h0ID0gaW5mby5zdGF0dXNCYXJIZWlnaHQgKyB0aGlzLl9saXN0LmNvbnRlbnRIZWlnaHQgKyB0aGlzLl9tZXNzYWdlRWxlbWVudC5jbGllbnRIZWlnaHQgKyBpbmZvLmJvcmRlckhlaWdodDtcblx0XHRjb25zdCBtaW5IZWlnaHQgPSBpbmZvLml0ZW1IZWlnaHQgKyBpbmZvLnN0YXR1c0JhckhlaWdodDtcblx0XHQvLyBjb25zdCBlZGl0b3JCb3ggPSBkb20uZ2V0RG9tTm9kZVBhZ2VQb3NpdGlvbih0aGlzLmVkaXRvci5nZXREb21Ob2RlKCkpO1xuXHRcdC8vIGNvbnN0IGN1cnNvckJveCA9IHRoaXMuZWRpdG9yLmdldFNjcm9sbGVkVmlzaWJsZVBvc2l0aW9uKHRoaXMuZWRpdG9yLmdldFBvc2l0aW9uKCkpO1xuXHRcdGNvbnN0IGVkaXRvckJveCA9IGRvbS5nZXREb21Ob2RlUGFnZVBvc2l0aW9uKHRoaXMuX2NvbnRhaW5lcik7XG5cdFx0Y29uc3QgY3Vyc29yQm94ID0gdGhpcy5fY3Vyc29yUG9zaXRpb247IC8vdGhpcy5lZGl0b3IuZ2V0U2Nyb2xsZWRWaXNpYmxlUG9zaXRpb24odGhpcy5lZGl0b3IuZ2V0UG9zaXRpb24oKSk7XG5cdFx0Y29uc3QgY3Vyc29yQm90dG9tID0gZWRpdG9yQm94LnRvcCArIGN1cnNvckJveC50b3AgKyBjdXJzb3JCb3guaGVpZ2h0O1xuXHRcdGNvbnN0IG1heEhlaWdodEJlbG93ID0gTWF0aC5taW4oYm9keUJveC5oZWlnaHQgLSBjdXJzb3JCb3R0b20gLSBpbmZvLnZlcnRpY2FsUGFkZGluZywgZnVsbEhlaWdodCk7XG5cdFx0Y29uc3QgYXZhaWxhYmxlU3BhY2VBYm92ZSA9IGVkaXRvckJveC50b3AgKyBjdXJzb3JCb3gudG9wIC0gaW5mby52ZXJ0aWNhbFBhZGRpbmc7XG5cdFx0Y29uc3QgbWF4SGVpZ2h0QWJvdmUgPSBNYXRoLm1pbihhdmFpbGFibGVTcGFjZUFib3ZlLCBmdWxsSGVpZ2h0KTtcblx0XHRsZXQgbWF4SGVpZ2h0ID0gTWF0aC5taW4oTWF0aC5tYXgobWF4SGVpZ2h0QWJvdmUsIG1heEhlaWdodEJlbG93KSArIGluZm8uYm9yZGVySGVpZ2h0LCBmdWxsSGVpZ2h0KTtcblxuXHRcdGlmIChoZWlnaHQgPT09IHRoaXMuX2NhcHBlZEhlaWdodD8uY2FwcGVkKSB7XG5cdFx0XHQvLyBSZXN0b3JlIHRoZSBvbGQgKHdhbnRlZCkgaGVpZ2h0IHdoZW4gdGhlIGN1cnJlbnRcblx0XHRcdC8vIGhlaWdodCBpcyBjYXBwZWQgdG8gZml0XG5cdFx0XHRoZWlnaHQgPSB0aGlzLl9jYXBwZWRIZWlnaHQud2FudGVkO1xuXHRcdH1cblxuXHRcdGlmIChoZWlnaHQgPCBtaW5IZWlnaHQpIHtcblx0XHRcdGhlaWdodCA9IG1pbkhlaWdodDtcblx0XHR9XG5cdFx0aWYgKGhlaWdodCA+IG1heEhlaWdodCkge1xuXHRcdFx0aGVpZ2h0ID0gbWF4SGVpZ2h0O1xuXHRcdH1cblxuXHRcdGNvbnN0IGZvcmNlUmVuZGVyaW5nQWJvdmVSZXF1aXJlZFNwYWNlID0gMTUwO1xuXHRcdGlmIChoZWlnaHQgPiBtYXhIZWlnaHRCZWxvdyB8fCAodGhpcy5fZm9yY2VSZW5kZXJpbmdBYm92ZSAmJiBhdmFpbGFibGVTcGFjZUFib3ZlID4gZm9yY2VSZW5kZXJpbmdBYm92ZVJlcXVpcmVkU3BhY2UpKSB7XG5cdFx0XHR0aGlzLl9wcmVmZXJlbmNlID0gV2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlLkFib3ZlO1xuXHRcdFx0dGhpcy5lbGVtZW50LmVuYWJsZVNhc2hlcyh0cnVlLCB0cnVlLCBmYWxzZSwgZmFsc2UpO1xuXHRcdFx0bWF4SGVpZ2h0ID0gbWF4SGVpZ2h0QWJvdmU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3ByZWZlcmVuY2UgPSBXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuQmVsb3c7XG5cdFx0XHR0aGlzLmVsZW1lbnQuZW5hYmxlU2FzaGVzKGZhbHNlLCB0cnVlLCB0cnVlLCBmYWxzZSk7XG5cdFx0XHRtYXhIZWlnaHQgPSBtYXhIZWlnaHRCZWxvdztcblx0XHR9XG5cdFx0dGhpcy5lbGVtZW50LnByZWZlcnJlZFNpemUgPSBuZXcgZG9tLkRpbWVuc2lvbihwcmVmZXJyZWRXaWR0aCwgaW5mby5kZWZhdWx0U2l6ZS5oZWlnaHQpO1xuXHRcdHRoaXMuZWxlbWVudC5tYXhTaXplID0gbmV3IGRvbS5EaW1lbnNpb24obWF4V2lkdGgsIG1heEhlaWdodCk7XG5cdFx0dGhpcy5lbGVtZW50Lm1pblNpemUgPSBuZXcgZG9tLkRpbWVuc2lvbigyMjAsIG1pbkhlaWdodCk7XG5cblx0XHQvLyBLbm93IHdoZW4gdGhlIGhlaWdodCB3YXMgY2FwcGVkIHRvIGZpdCBhbmQgcmVtZW1iZXJcblx0XHQvLyB0aGUgd2FudGVkIGhlaWdodCBmb3IgbGF0ZXIuIFRoaXMgaXMgcmVxdWlyZWQgd2hlbiBnb2luZ1xuXHRcdC8vIGxlZnQgdG8gd2lkZW4gc3VnZ2VzdGlvbnMuXG5cdFx0dGhpcy5fY2FwcGVkSGVpZ2h0ID0gaGVpZ2h0ID09PSBmdWxsSGVpZ2h0XG5cdFx0XHQ/IHsgd2FudGVkOiB0aGlzLl9jYXBwZWRIZWlnaHQ/LndhbnRlZCA/PyBzaXplLmhlaWdodCwgY2FwcGVkOiBoZWlnaHQgfVxuXHRcdFx0OiB1bmRlZmluZWQ7XG5cdFx0Ly8gfVxuXHRcdHRoaXMuZWxlbWVudC5kb21Ob2RlLnN0eWxlLmxlZnQgPSBgJHt0aGlzLl9jdXJzb3JQb3NpdGlvbi5sZWZ0fXB4YDtcblx0XHRpZiAodGhpcy5fcHJlZmVyZW5jZSA9PT0gV2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlLkFib3ZlKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQuZG9tTm9kZS5zdHlsZS50b3AgPSBgJHt0aGlzLl9jdXJzb3JQb3NpdGlvbi50b3AgLSBoZWlnaHQgLSBpbmZvLmJvcmRlckhlaWdodH1weGA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZWxlbWVudC5kb21Ob2RlLnN0eWxlLnRvcCA9IGAke3RoaXMuX2N1cnNvclBvc2l0aW9uLnRvcCArIHRoaXMuX2N1cnNvclBvc2l0aW9uLmhlaWdodH1weGA7XG5cdFx0fVxuXHRcdHRoaXMuX3Jlc2l6ZSh3aWR0aCwgaGVpZ2h0KTtcblx0fVxuXG5cdF9hZnRlclJlbmRlcigpIHtcblx0XHQvLyBpZiAocG9zaXRpb24gPT09IG51bGwpIHtcblx0XHQvLyBcdGlmICh0aGlzLl9pc0RldGFpbHNWaXNpYmxlKCkpIHtcblx0XHQvLyBcdFx0dGhpcy5fZGV0YWlscy5oaWRlKCk7IC8vdG9kb0Bqcmlla2VuIHNvZnQtaGlkZVxuXHRcdC8vIFx0fVxuXHRcdC8vIFx0cmV0dXJuO1xuXHRcdC8vIH1cblx0XHRpZiAodGhpcy5fc3RhdGUgPT09IFN0YXRlLkVtcHR5IHx8IHRoaXMuX3N0YXRlID09PSBTdGF0ZS5Mb2FkaW5nKSB7XG5cdFx0XHQvLyBubyBzcGVjaWFsIHBvc2l0aW9uaW5nIHdoZW4gd2lkZ2V0IGlzbid0IHNob3dpbmcgbGlzdFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5faXNEZXRhaWxzVmlzaWJsZSgpICYmICF0aGlzLl9kZXRhaWxzLndpZGdldC5pc0VtcHR5KSB7XG5cdFx0XHR0aGlzLl9kZXRhaWxzLnNob3coKTtcblx0XHR9XG5cdFx0dGhpcy5fcG9zaXRpb25EZXRhaWxzKCk7XG5cdH1cblxuXHRwcml2YXRlIF9yZXNpemUod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpOiB2b2lkIHtcblx0XHRjb25zdCB7IHdpZHRoOiBtYXhXaWR0aCwgaGVpZ2h0OiBtYXhIZWlnaHQgfSA9IHRoaXMuZWxlbWVudC5tYXhTaXplO1xuXHRcdHdpZHRoID0gTWF0aC5taW4obWF4V2lkdGgsIHdpZHRoKTtcblx0XHRpZiAobWF4SGVpZ2h0KSB7XG5cdFx0XHRoZWlnaHQgPSBNYXRoLm1pbihtYXhIZWlnaHQsIGhlaWdodCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBzdGF0dXNCYXJIZWlnaHQgfSA9IHRoaXMuX2dldExheW91dEluZm8oKTtcblx0XHR0aGlzLl9saXN0LmxheW91dChoZWlnaHQgLSBzdGF0dXNCYXJIZWlnaHQsIHdpZHRoKTtcblx0XHR0aGlzLl9saXN0RWxlbWVudC5zdHlsZS5oZWlnaHQgPSBgJHtoZWlnaHQgLSBzdGF0dXNCYXJIZWlnaHR9cHhgO1xuXG5cdFx0dGhpcy5fbGlzdEVsZW1lbnQuc3R5bGUud2lkdGggPSBgJHt3aWR0aH1weGA7XG5cdFx0dGhpcy5lbGVtZW50LmxheW91dChoZWlnaHQsIHdpZHRoKTtcblx0XHRpZiAodGhpcy5fY3Vyc29yUG9zaXRpb24gJiYgdGhpcy5fcHJlZmVyZW5jZSA9PT0gV2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlLkFib3ZlKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQuZG9tTm9kZS5zdHlsZS50b3AgPSBgJHt0aGlzLl9jdXJzb3JQb3NpdGlvbi50b3AgLSBoZWlnaHR9cHhgO1xuXHRcdH1cblx0XHR0aGlzLl9wb3NpdGlvbkRldGFpbHMoKTtcblx0fVxuXG5cdHByaXZhdGUgX3Bvc2l0aW9uRGV0YWlscygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNEZXRhaWxzVmlzaWJsZSgpKSB7XG5cdFx0XHR0aGlzLl9kZXRhaWxzLnBsYWNlQXRBbmNob3IodGhpcy5lbGVtZW50LmRvbU5vZGUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2dldExheW91dEluZm8oKSB7XG5cdFx0Y29uc3QgZm9udEluZm8gPSB0aGlzLl9nZXRGb250SW5mbygpO1xuXHRcdGNvbnN0IGl0ZW1IZWlnaHQgPSBjbGFtcChmb250SW5mby5saW5lSGVpZ2h0LCA4LCAxMDAwKTtcblx0XHRjb25zdCBzdGF0dXNCYXJIZWlnaHQgPSAhdGhpcy5fb3B0aW9ucy5zdGF0dXNCYXJNZW51SWQgfHwgIXRoaXMuX29wdGlvbnMuc2hvd1N0YXR1c0JhclNldHRpbmdJZCB8fCAhdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUodGhpcy5fb3B0aW9ucy5zaG93U3RhdHVzQmFyU2V0dGluZ0lkKSB8fCB0aGlzLl9zdGF0ZSA9PT0gU3RhdGUuRW1wdHkgfHwgdGhpcy5fc3RhdGUgPT09IFN0YXRlLkxvYWRpbmcgPyAwIDogaXRlbUhlaWdodDtcblx0XHRjb25zdCBib3JkZXJXaWR0aCA9IHRoaXMuX2RldGFpbHMud2lkZ2V0LmJvcmRlcldpZHRoO1xuXHRcdGNvbnN0IGJvcmRlckhlaWdodCA9IDIgKiBib3JkZXJXaWR0aDtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRpdGVtSGVpZ2h0LFxuXHRcdFx0c3RhdHVzQmFySGVpZ2h0LFxuXHRcdFx0Ym9yZGVyV2lkdGgsXG5cdFx0XHRib3JkZXJIZWlnaHQsXG5cdFx0XHR0eXBpY2FsSGFsZndpZHRoQ2hhcmFjdGVyV2lkdGg6IDEwLFxuXHRcdFx0dmVydGljYWxQYWRkaW5nOiAyMixcblx0XHRcdGhvcml6b250YWxQYWRkaW5nOiAxNCxcblx0XHRcdGRlZmF1bHRTaXplOiBuZXcgZG9tLkRpbWVuc2lvbig0MzAsIHN0YXR1c0JhckhlaWdodCArIDEyICogaXRlbUhlaWdodCArIGJvcmRlckhlaWdodClcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBfb25MaXN0TW91c2VEb3duT3JUYXAoZTogSUxpc3RNb3VzZUV2ZW50PFRJdGVtPiB8IElMaXN0R2VzdHVyZUV2ZW50PFRJdGVtPik6IHZvaWQge1xuXHRcdGlmICh0eXBlb2YgZS5lbGVtZW50ID09PSAndW5kZWZpbmVkJyB8fCB0eXBlb2YgZS5pbmRleCA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBwcmV2ZW50IHN0ZWFsaW5nIGJyb3dzZXIgZm9jdXMgZnJvbSB0aGUgdGVybWluYWxcblx0XHRlLmJyb3dzZXJFdmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGUuYnJvd3NlckV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cdFx0dGhpcy5fc2VsZWN0KGUuZWxlbWVudCwgZS5pbmRleCk7XG5cdH1cblxuXHRwcml2YXRlIF9vbkxpc3RTZWxlY3Rpb24oZTogSUxpc3RFdmVudDxUSXRlbT4pOiB2b2lkIHtcblx0XHRpZiAoZS5lbGVtZW50cy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuX3NlbGVjdChlLmVsZW1lbnRzWzBdLCBlLmluZGV4ZXNbMF0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3NlbGVjdChpdGVtOiBUSXRlbSwgaW5kZXg6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IGNvbXBsZXRpb25Nb2RlbCA9IHRoaXMuX2NvbXBsZXRpb25Nb2RlbDtcblx0XHRpZiAoY29tcGxldGlvbk1vZGVsKSB7XG5cdFx0XHR0aGlzLl9vbkRpZFNlbGVjdC5maXJlKHsgaXRlbSwgaW5kZXgsIG1vZGVsOiBjb21wbGV0aW9uTW9kZWwgfSk7XG5cdFx0fVxuXHR9XG5cblx0c2VsZWN0TmV4dCgpOiBib29sZWFuIHtcblx0XHR0aGlzLl9saXN0LmZvY3VzTmV4dCgxLCB0cnVlKTtcblx0XHRjb25zdCBmb2N1cyA9IHRoaXMuX2xpc3QuZ2V0Rm9jdXMoKTtcblx0XHRpZiAoZm9jdXMubGVuZ3RoID4gMCkge1xuXHRcdFx0dGhpcy5fbGlzdC5yZXZlYWwoZm9jdXNbMF0pO1xuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHNlbGVjdE5leHRQYWdlKCk6IGJvb2xlYW4ge1xuXHRcdHRoaXMuX2xpc3QuZm9jdXNOZXh0UGFnZSgpO1xuXHRcdGNvbnN0IGZvY3VzID0gdGhpcy5fbGlzdC5nZXRGb2N1cygpO1xuXHRcdGlmIChmb2N1cy5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLl9saXN0LnJldmVhbChmb2N1c1swXSk7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0c2VsZWN0UHJldmlvdXMoKTogYm9vbGVhbiB7XG5cdFx0dGhpcy5fbGlzdC5mb2N1c1ByZXZpb3VzKDEsIHRydWUpO1xuXHRcdGNvbnN0IGZvY3VzID0gdGhpcy5fbGlzdC5nZXRGb2N1cygpO1xuXHRcdGlmIChmb2N1cy5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLl9saXN0LnJldmVhbChmb2N1c1swXSk7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0c2VsZWN0UHJldmlvdXNQYWdlKCk6IGJvb2xlYW4ge1xuXHRcdHRoaXMuX2xpc3QuZm9jdXNQcmV2aW91c1BhZ2UoKTtcblx0XHRjb25zdCBmb2N1cyA9IHRoaXMuX2xpc3QuZ2V0Rm9jdXMoKTtcblx0XHRpZiAoZm9jdXMubGVuZ3RoID4gMCkge1xuXHRcdFx0dGhpcy5fbGlzdC5yZXZlYWwoZm9jdXNbMF0pO1xuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGdldEZvY3VzZWRJdGVtKCk6IElTaW1wbGVTZWxlY3RlZFN1Z2dlc3Rpb248VEl0ZW0+IHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGhpcy5fY29tcGxldGlvbk1vZGVsKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRpdGVtOiB0aGlzLl9saXN0LmdldEZvY3VzZWRFbGVtZW50cygpWzBdLFxuXHRcdFx0XHRpbmRleDogdGhpcy5fbGlzdC5nZXRGb2N1cygpWzBdLFxuXHRcdFx0XHRtb2RlbDogdGhpcy5fY29tcGxldGlvbk1vZGVsXG5cdFx0XHR9O1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXNEZXRhaWxzVmlzaWJsZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RvcmFnZVNlcnZpY2UuZ2V0Qm9vbGVhbignZXhwYW5kU3VnZ2VzdGlvbkRvY3MnLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgZmFsc2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0RGV0YWlsc1Zpc2libGUodmFsdWU6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9zdG9yYWdlU2VydmljZS5zdG9yZSgnZXhwYW5kU3VnZ2VzdGlvbkRvY3MnLCB2YWx1ZSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cdH1cblxuXHRmb3JjZVJlbmRlcmluZ0Fib3ZlKCkge1xuXHRcdGlmICghdGhpcy5fZm9yY2VSZW5kZXJpbmdBYm92ZSkge1xuXHRcdFx0dGhpcy5fZm9yY2VSZW5kZXJpbmdBYm92ZSA9IHRydWU7XG5cdFx0XHR0aGlzLl9sYXlvdXQodGhpcy5fcGVyc2lzdGVkU2l6ZS5yZXN0b3JlKCkpO1xuXHRcdH1cblx0fVxuXG5cdHN0b3BGb3JjZVJlbmRlcmluZ0Fib3ZlKCkge1xuXHRcdHRoaXMuX2ZvcmNlUmVuZGVyaW5nQWJvdmUgPSBmYWxzZTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsWUFBWSxTQUFTO0FBRXJCLFNBQVMsWUFBWTtBQUNyQixTQUFTLDRCQUE0QjtBQUdyQyxTQUFTLFdBQVcsdUNBQTBFO0FBQzlGLFNBQTRCLHlCQUF5QixtQkFBbUIsb0JBQW9CO0FBQzVGLFNBQVMsU0FBZ0Isd0JBQXdCO0FBQ2pELFNBQVMsbUJBQW1CLGtCQUFrQjtBQUM5QyxTQUFTLGFBQWE7QUFDdEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywyQkFBMkI7QUFFcEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxpQkFBaUIsY0FBYyxxQkFBcUI7QUFDN0QsU0FBUyx5QkFBeUIsNkJBQTZCLGtDQUFrQztBQUNqRyxTQUFzQixvQkFBb0IscUJBQXFCO0FBQy9ELFlBQVksYUFBYTtBQUN6QixTQUFTLGNBQWM7QUFFdkIsTUFBTSxJQUFJLElBQUk7QUFFZCxJQUFXLFFBQVgsa0JBQVdBLFdBQVg7QUFDQyxFQUFBQSxjQUFBO0FBQ0EsRUFBQUEsY0FBQTtBQUNBLEVBQUFBLGNBQUE7QUFDQSxFQUFBQSxjQUFBO0FBQ0EsRUFBQUEsY0FBQTtBQUNBLEVBQUFBLGNBQUE7QUFOVSxTQUFBQTtBQUFBLEdBQUE7QUFxQlgsSUFBVywyQkFBWCxrQkFBV0MsOEJBQVg7QUFDQyxFQUFBQSxvREFBQTtBQUNBLEVBQUFBLG9EQUFBO0FBRlUsU0FBQUE7QUFBQSxHQUFBO0FBS0osTUFBTSx1QkFBdUI7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QUM7QUFBQSxRQUM5QixPQUFPLEtBQUs7QUFBQSxNQUNiO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxvQkFBNkI7QUFDcEMsV0FBTyxLQUFLLGdCQUFnQixXQUFXLHdCQUF3QixhQUFhLFNBQVMsS0FBSztBQUFBLEVBQzNGO0FBQUEsRUFFUSxtQkFBbUIsT0FBZ0I7QUFDMUMsU0FBSyxnQkFBZ0IsTUFBTSx3QkFBd0IsT0FBTyxhQUFhLFNBQVMsY0FBYyxJQUFJO0FBQUEsRUFDbkc7QUFBQSxFQUVBLHNCQUFzQjtBQUNyQixRQUFJLENBQUMsS0FBSyxzQkFBc0I7QUFDL0IsV0FBSyx1QkFBdUI7QUFDNUIsV0FBSyxRQUFRLEtBQUssZUFBZSxRQUFRLENBQUM7QUFBQSxJQUMzQztBQUFBLEVBQ0Q7QUFBQSxFQUVBLDBCQUEwQjtBQUN6QixTQUFLLHVCQUF1QjtBQUFBLEVBQzdCO0FBQ0Q7QUEzeUJhLG9CQUVHLGtCQUEwQixTQUFTLHlCQUF5QixZQUFZO0FBRjNFLG9CQUdHLHlCQUFpQyxTQUFTLCtCQUErQixpQkFBaUI7QUFIN0Ysc0JBQU47QUFBQSxFQWlESjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBcERVOyIsCiAgIm5hbWVzIjogWyJTdGF0ZSIsICJXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UiLCAiZGV0YWlsIl0KfQo=
