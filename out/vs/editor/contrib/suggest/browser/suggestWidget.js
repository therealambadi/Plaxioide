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
import "../../../../base/browser/ui/codicons/codiconStyles.js";
import { List } from "../../../../base/browser/ui/list/listWidget.js";
import { createCancelablePromise, disposableTimeout, TimeoutTimer } from "../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Emitter, PauseableEmitter } from "../../../../base/common/event.js";
import { DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { clamp } from "../../../../base/common/numbers.js";
import * as strings from "../../../../base/common/strings.js";
import "./media/suggest.css";
import { ContentWidgetPositionPreference } from "../../../browser/editorBrowser.js";
import { EmbeddedCodeEditorWidget } from "../../../browser/widget/codeEditor/embeddedCodeEditorWidget.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { SuggestWidgetStatus } from "./suggestWidgetStatus.js";
import "../../symbolIcons/browser/symbolIcons.js";
import * as nls from "../../../../nls.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { activeContrastBorder, editorForeground, editorWidgetBackground, editorWidgetBorder, listFocusHighlightForeground, listHighlightForeground, quickInputListFocusBackground, quickInputListFocusForeground, quickInputListFocusIconForeground, registerColor, transparent } from "../../../../platform/theme/common/colorRegistry.js";
import { isHighContrast } from "../../../../platform/theme/common/theme.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ResizableHTMLElement } from "../../../../base/browser/ui/resizable/resizable.js";
import { Context as SuggestContext, suggestWidgetStatusbarMenu } from "./suggest.js";
import { canExpandCompletionItem, SuggestDetailsOverlay, SuggestDetailsWidget } from "./suggestWidgetDetails.js";
import { ItemRenderer } from "./suggestWidgetRenderer.js";
import { getListStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { status } from "../../../../base/browser/ui/aria/aria.js";
import { CompletionItemKinds } from "../../../common/languages.js";
registerColor("editorSuggestWidget.background", editorWidgetBackground, nls.localize("editorSuggestWidgetBackground", "Background color of the suggest widget."));
registerColor("editorSuggestWidget.border", editorWidgetBorder, nls.localize("editorSuggestWidgetBorder", "Border color of the suggest widget."));
const editorSuggestWidgetForeground = registerColor("editorSuggestWidget.foreground", editorForeground, nls.localize("editorSuggestWidgetForeground", "Foreground color of the suggest widget."));
registerColor("editorSuggestWidget.selectedForeground", quickInputListFocusForeground, nls.localize("editorSuggestWidgetSelectedForeground", "Foreground color of the selected entry in the suggest widget."));
registerColor("editorSuggestWidget.selectedIconForeground", quickInputListFocusIconForeground, nls.localize("editorSuggestWidgetSelectedIconForeground", "Icon foreground color of the selected entry in the suggest widget."));
const editorSuggestWidgetSelectedBackground = registerColor("editorSuggestWidget.selectedBackground", quickInputListFocusBackground, nls.localize("editorSuggestWidgetSelectedBackground", "Background color of the selected entry in the suggest widget."));
registerColor("editorSuggestWidget.highlightForeground", listHighlightForeground, nls.localize("editorSuggestWidgetHighlightForeground", "Color of the match highlights in the suggest widget."));
registerColor("editorSuggestWidget.focusHighlightForeground", listFocusHighlightForeground, nls.localize("editorSuggestWidgetFocusHighlightForeground", "Color of the match highlights in the suggest widget when an item is focused."));
registerColor("editorSuggestWidgetStatus.foreground", transparent(editorSuggestWidgetForeground, 0.5), nls.localize("editorSuggestWidgetStatusForeground", "Foreground color of the suggest widget status."));
var State = /* @__PURE__ */ ((State2) => {
  State2[State2["Hidden"] = 0] = "Hidden";
  State2[State2["Loading"] = 1] = "Loading";
  State2[State2["Empty"] = 2] = "Empty";
  State2[State2["Open"] = 3] = "Open";
  State2[State2["Frozen"] = 4] = "Frozen";
  State2[State2["Details"] = 5] = "Details";
  State2[State2["onDetailsKeyDown"] = 6] = "onDetailsKeyDown";
  return State2;
})(State || {});
class PersistedWidgetSize {
  constructor(_service, editor) {
    this._service = _service;
    this._key = `suggestWidget.size/${editor.getEditorType()}/${editor instanceof EmbeddedCodeEditorWidget}`;
  }
  restore() {
    const raw = this._service.get(this._key, StorageScope.PROFILE) ?? "";
    try {
      const obj = JSON.parse(raw);
      if (dom.Dimension.is(obj)) {
        return dom.Dimension.lift(obj);
      }
    } catch {
    }
    return void 0;
  }
  store(size) {
    this._service.store(this._key, JSON.stringify(size), StorageScope.PROFILE, StorageTarget.MACHINE);
  }
  reset() {
    this._service.remove(this._key, StorageScope.PROFILE);
  }
}
let SuggestWidget = class {
  constructor(editor, _storageService, _contextKeyService, _themeService, instantiationService) {
    this.editor = editor;
    this._storageService = _storageService;
    this._state = 0 /* Hidden */;
    this._isAuto = false;
    this._pendingLayout = new MutableDisposable();
    this._pendingShowDetails = new MutableDisposable();
    this._ignoreFocusEvents = false;
    this._forceRenderingAbove = false;
    this._explainMode = false;
    this._showTimeout = new TimeoutTimer();
    this._disposables = new DisposableStore();
    this._onDidSelect = new PauseableEmitter();
    this._onDidFocus = new PauseableEmitter();
    this._onDidHide = new Emitter();
    this._onDidShow = new Emitter();
    this.onDidSelect = this._onDidSelect.event;
    this.onDidFocus = this._onDidFocus.event;
    this.onDidHide = this._onDidHide.event;
    this.onDidShow = this._onDidShow.event;
    this._onDetailsKeydown = new Emitter();
    this.onDetailsKeyDown = this._onDetailsKeydown.event;
    this.element = new ResizableHTMLElement();
    this.element.domNode.classList.add("editor-widget", "suggest-widget");
    this._contentWidget = new SuggestContentWidget(this, editor);
    this._persistedSize = new PersistedWidgetSize(_storageService, editor);
    class ResizeState {
      constructor(persistedSize, currentSize, persistHeight = false, persistWidth = false) {
        this.persistedSize = persistedSize;
        this.currentSize = currentSize;
        this.persistHeight = persistHeight;
        this.persistWidth = persistWidth;
      }
    }
    let state;
    this._disposables.add(this.element.onDidWillResize(() => {
      this._contentWidget.lockPreference();
      state = new ResizeState(this._persistedSize.restore(), this.element.size);
    }));
    this._disposables.add(this.element.onDidResize((e) => {
      this._resize(e.dimension.width, e.dimension.height);
      if (state) {
        state.persistHeight = state.persistHeight || !!e.north || !!e.south;
        state.persistWidth = state.persistWidth || !!e.east || !!e.west;
      }
      if (!e.done) {
        return;
      }
      if (state) {
        const { itemHeight, defaultSize } = this.getLayoutInfo();
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
      this._contentWidget.unlockPreference();
      state = void 0;
    }));
    this._messageElement = dom.append(this.element.domNode, dom.$(".message"));
    this._listElement = dom.append(this.element.domNode, dom.$(".tree"));
    const details = this._disposables.add(instantiationService.createInstance(SuggestDetailsWidget, this.editor));
    details.onDidClose(() => this.toggleDetails(), this, this._disposables);
    this._details = new SuggestDetailsOverlay(details, this.editor);
    const applyIconStyle = () => this.element.domNode.classList.toggle("no-icons", !this.editor.getOption(EditorOption.suggest).showIcons);
    applyIconStyle();
    const renderer = instantiationService.createInstance(ItemRenderer, this.editor);
    this._disposables.add(renderer);
    this._disposables.add(renderer.onDidToggleDetails(() => this.toggleDetails()));
    this._list = new List("SuggestWidget", this._listElement, {
      getHeight: (_element) => this.getLayoutInfo().itemHeight,
      getTemplateId: (_element) => "suggestion"
    }, [renderer], {
      alwaysConsumeMouseWheel: true,
      useShadows: false,
      mouseSupport: false,
      multipleSelectionSupport: false,
      accessibilityProvider: {
        getRole: () => "listitem",
        getWidgetAriaLabel: () => nls.localize("suggest", "Suggest"),
        getWidgetRole: () => "listbox",
        getAriaLabel: (item) => {
          let label = item.textLabel;
          const kindLabel = CompletionItemKinds.toLabel(item.completion.kind);
          if (typeof item.completion.label !== "string") {
            const { detail: detail2, description } = item.completion.label;
            if (detail2 && description) {
              label = nls.localize("label.full", "{0} {1}, {2}, {3}", label, detail2, description, kindLabel);
            } else if (detail2) {
              label = nls.localize("label.detail", "{0} {1}, {2}", label, detail2, kindLabel);
            } else if (description) {
              label = nls.localize("label.desc", "{0}, {1}, {2}", label, description, kindLabel);
            }
          } else {
            label = nls.localize("label", "{0}, {1}", label, kindLabel);
          }
          if (!item.isResolved || !this._isDetailsVisible()) {
            return label;
          }
          const { documentation, detail } = item.completion;
          const docs = strings.format(
            "{0}{1}",
            detail || "",
            documentation ? typeof documentation === "string" ? documentation : documentation.value : ""
          );
          return nls.localize("ariaCurrenttSuggestionReadDetails", "{0}, docs: {1}", label, docs);
        }
      }
    });
    this._list.style(getListStyles({
      listInactiveFocusBackground: editorSuggestWidgetSelectedBackground,
      listInactiveFocusOutline: activeContrastBorder
    }));
    this._status = instantiationService.createInstance(SuggestWidgetStatus, this.element.domNode, suggestWidgetStatusbarMenu);
    const applyStatusBarStyle = () => this.element.domNode.classList.toggle("with-status-bar", this.editor.getOption(EditorOption.suggest).showStatusBar);
    applyStatusBarStyle();
    this._disposables.add(_themeService.onDidColorThemeChange((t) => this._onThemeChange(t)));
    this._onThemeChange(_themeService.getColorTheme());
    this._disposables.add(this._list.onMouseDown((e) => this._onListMouseDownOrTap(e)));
    this._disposables.add(this._list.onTap((e) => this._onListMouseDownOrTap(e)));
    this._disposables.add(this._list.onDidChangeSelection((e) => this._onListSelection(e)));
    this._disposables.add(this._list.onDidChangeFocus((e) => this._onListFocus(e)));
    this._disposables.add(this.editor.onDidChangeCursorSelection(() => this._onCursorSelectionChanged()));
    this._disposables.add(this.editor.onDidChangeConfiguration((e) => {
      if (e.hasChanged(EditorOption.suggest)) {
        applyStatusBarStyle();
        applyIconStyle();
      }
      if (this._completionModel && (e.hasChanged(EditorOption.fontInfo) || e.hasChanged(EditorOption.suggestFontSize) || e.hasChanged(EditorOption.suggestLineHeight))) {
        this._list.splice(0, this._list.length, this._completionModel.items);
      }
    }));
    this._ctxSuggestWidgetVisible = SuggestContext.Visible.bindTo(_contextKeyService);
    this._ctxSuggestWidgetDetailsVisible = SuggestContext.DetailsVisible.bindTo(_contextKeyService);
    this._ctxSuggestWidgetMultipleSuggestions = SuggestContext.MultipleSuggestions.bindTo(_contextKeyService);
    this._ctxSuggestWidgetHasFocusedSuggestion = SuggestContext.HasFocusedSuggestion.bindTo(_contextKeyService);
    this._disposables.add(dom.addStandardDisposableListener(this._details.widget.domNode, "keydown", (e) => {
      this._onDetailsKeydown.fire(e);
    }));
    this._disposables.add(this.editor.onMouseDown((e) => this._onEditorMouseDown(e)));
  }
  dispose() {
    this._details.widget.dispose();
    this._details.dispose();
    this._list.dispose();
    this._status.dispose();
    this._disposables.dispose();
    this._loadingTimeout?.dispose();
    this._pendingLayout.dispose();
    this._pendingShowDetails.dispose();
    this._showTimeout.dispose();
    this._contentWidget.dispose();
    this.element.dispose();
  }
  _onEditorMouseDown(mouseEvent) {
    if (this._details.widget.domNode.contains(mouseEvent.target.element)) {
      this._details.widget.domNode.focus();
    } else {
      if (this.element.domNode.contains(mouseEvent.target.element)) {
        this.editor.focus();
      }
    }
  }
  _onCursorSelectionChanged() {
    if (this._state !== 0 /* Hidden */) {
      this._contentWidget.layout();
    }
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
      this.editor.focus();
    }
  }
  _onThemeChange(theme) {
    this._details.widget.borderWidth = isHighContrast(theme.type) ? 2 : 1;
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
      }
      this.editor.setAriaOptions({ activeDescendant: void 0 });
      this._ctxSuggestWidgetHasFocusedSuggestion.set(false);
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
      this._currentSuggestionDetails = createCancelablePromise(async (token) => {
        const loading = disposableTimeout(() => {
          if (this._isDetailsVisible()) {
            this._showDetails(true, false);
          }
        }, 250);
        const sub = token.onCancellationRequested(() => loading.dispose());
        try {
          return await item.resolve(token);
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
        this.editor.setAriaOptions({ activeDescendant: this._list.getElementID(index) });
      }).catch(onUnexpectedError);
    }
    this._onDidFocus.fire({ item, index, model: this._completionModel });
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
        dom.hide(this._messageElement, this._listElement, this._status.element);
        this._details.hide(true);
        this._status.hide();
        this._contentWidget.hide();
        this._ctxSuggestWidgetVisible.reset();
        this._ctxSuggestWidgetMultipleSuggestions.reset();
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
        this._messageElement.textContent = SuggestWidget.LOADING_MESSAGE;
        dom.hide(this._listElement, this._status.element);
        dom.show(this._messageElement);
        this._details.hide();
        this._show();
        this._focusedItem = void 0;
        status(SuggestWidget.LOADING_MESSAGE);
        break;
      case 2 /* Empty */:
        this.element.domNode.classList.add("message");
        this._messageElement.textContent = SuggestWidget.NO_SUGGESTIONS_MESSAGE;
        dom.hide(this._listElement, this._status.element);
        dom.show(this._messageElement);
        this._details.hide();
        this._show();
        this._focusedItem = void 0;
        status(SuggestWidget.NO_SUGGESTIONS_MESSAGE);
        break;
      case 3 /* Open */:
        dom.hide(this._messageElement);
        dom.show(this._listElement, this._status.element);
        this._show();
        break;
      case 4 /* Frozen */:
        dom.hide(this._messageElement);
        dom.show(this._listElement, this._status.element);
        this._show();
        break;
      case 5 /* Details */:
        dom.hide(this._messageElement);
        dom.show(this._listElement, this._status.element);
        this._details.show();
        this._show();
        this._details.widget.focus();
        break;
    }
  }
  _show() {
    this._status.show();
    this._contentWidget.show();
    this._layout(this._persistedSize.restore());
    this._ctxSuggestWidgetVisible.set(true);
    this._showTimeout.cancelAndSet(() => {
      this.element.domNode.classList.add("visible");
      this._onDidShow.fire(this);
    }, 100);
  }
  showTriggered(auto, delay) {
    if (this._state !== 0 /* Hidden */) {
      return;
    }
    this._contentWidget.setPosition(this.editor.getPosition());
    this._isAuto = !!auto;
    if (!this._isAuto) {
      this._loadingTimeout = disposableTimeout(() => this._setState(1 /* Loading */), delay);
    }
  }
  showSuggestions(completionModel, selectionIndex, isFrozen, isAuto, noFocus) {
    this._contentWidget.setPosition(this.editor.getPosition());
    this._loadingTimeout?.dispose();
    this._currentSuggestionDetails?.cancel();
    this._currentSuggestionDetails = void 0;
    if (this._completionModel !== completionModel) {
      this._completionModel = completionModel;
    }
    if (isFrozen && this._state !== 2 /* Empty */ && this._state !== 0 /* Hidden */) {
      this._setState(4 /* Frozen */);
      return;
    }
    const visibleCount = this._completionModel.items.length;
    const isEmpty = visibleCount === 0;
    this._ctxSuggestWidgetMultipleSuggestions.set(visibleCount > 1);
    if (isEmpty) {
      this._setState(isAuto ? 0 /* Hidden */ : 2 /* Empty */);
      this._completionModel = void 0;
      return;
    }
    this._focusedItem = void 0;
    this._onDidFocus.pause();
    this._onDidSelect.pause();
    try {
      this._list.splice(0, this._list.length, this._completionModel.items);
      this._setState(isFrozen ? 4 /* Frozen */ : 3 /* Open */);
      this._list.reveal(selectionIndex, 0, selectionIndex === 0 ? 0 : this.getLayoutInfo().itemHeight * 0.33);
      this._list.setFocus(noFocus ? [] : [selectionIndex]);
    } finally {
      this._onDidFocus.resume();
      this._onDidSelect.resume();
    }
    this._pendingLayout.value = dom.runAtThisOrScheduleAtNextAnimationFrame(dom.getWindow(this.element.domNode), () => {
      this._pendingLayout.clear();
      this._layout(this.element.size);
      this._details.widget.domNode.classList.remove("focused");
    });
  }
  focusSelected() {
    if (this._list.length > 0) {
      this._list.setFocus([0]);
    }
  }
  selectNextPage() {
    switch (this._state) {
      case 0 /* Hidden */:
        return false;
      case 5 /* Details */:
        this._details.widget.pageDown();
        return true;
      case 1 /* Loading */:
        return !this._isAuto;
      default:
        this._list.focusNextPage();
        return true;
    }
  }
  selectNext() {
    switch (this._state) {
      case 0 /* Hidden */:
        return false;
      case 1 /* Loading */:
        return !this._isAuto;
      default:
        this._list.focusNext(1, true);
        return true;
    }
  }
  selectLast() {
    switch (this._state) {
      case 0 /* Hidden */:
        return false;
      case 5 /* Details */:
        this._details.widget.scrollBottom();
        return true;
      case 1 /* Loading */:
        return !this._isAuto;
      default:
        this._list.focusLast();
        return true;
    }
  }
  selectPreviousPage() {
    switch (this._state) {
      case 0 /* Hidden */:
        return false;
      case 5 /* Details */:
        this._details.widget.pageUp();
        return true;
      case 1 /* Loading */:
        return !this._isAuto;
      default:
        this._list.focusPreviousPage();
        return true;
    }
  }
  selectPrevious() {
    switch (this._state) {
      case 0 /* Hidden */:
        return false;
      case 1 /* Loading */:
        return !this._isAuto;
      default:
        this._list.focusPrevious(1, true);
        return false;
    }
  }
  selectFirst() {
    switch (this._state) {
      case 0 /* Hidden */:
        return false;
      case 5 /* Details */:
        this._details.widget.scrollTop();
        return true;
      case 1 /* Loading */:
        return !this._isAuto;
      default:
        this._list.focusFirst();
        return true;
    }
  }
  getFocusedItem() {
    if (this._state !== 0 /* Hidden */ && this._state !== 2 /* Empty */ && this._state !== 1 /* Loading */ && this._completionModel && this._list.getFocus().length > 0) {
      return {
        item: this._list.getFocusedElements()[0],
        index: this._list.getFocus()[0],
        model: this._completionModel
      };
    }
    return void 0;
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
      this._ctxSuggestWidgetDetailsVisible.set(false);
      this._setDetailsVisible(false);
      this._details.hide();
      this.element.domNode.classList.remove("shows-details");
    } else if ((canExpandCompletionItem(this._list.getFocusedElements()[0]) || this._explainMode) && (this._state === 3 /* Open */ || this._state === 5 /* Details */ || this._state === 4 /* Frozen */)) {
      this._ctxSuggestWidgetDetailsVisible.set(true);
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
        this.editor.focus();
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
  resetPersistedSize() {
    this._persistedSize.reset();
  }
  hideWidget() {
    this._pendingLayout.clear();
    this._pendingShowDetails.clear();
    this._loadingTimeout?.dispose();
    this._setState(0 /* Hidden */);
    this._onDidHide.fire(this);
    this.element.clearSashHoverState();
    const dim = this._persistedSize.restore();
    const minPersistedHeight = Math.ceil(this.getLayoutInfo().itemHeight * 4.3);
    if (dim && dim.height < minPersistedHeight) {
      this._persistedSize.store(dim.with(void 0, minPersistedHeight));
    }
  }
  isFrozen() {
    return this._state === 4 /* Frozen */;
  }
  _afterRender(position) {
    if (position === null) {
      if (this._isDetailsVisible()) {
        this._details.hide();
      }
      return;
    }
    if (this._state === 2 /* Empty */ || this._state === 1 /* Loading */) {
      return;
    }
    if (this._isDetailsVisible() && !this._details.widget.isEmpty) {
      this._details.show();
    }
    this._positionDetails();
  }
  _layout(size) {
    if (!this.editor.hasModel()) {
      return;
    }
    if (!this.editor.getDomNode()) {
      return;
    }
    const bodyBox = dom.getClientArea(this.element.domNode.ownerDocument.body);
    const info = this.getLayoutInfo();
    if (!size) {
      size = info.defaultSize;
    }
    let height = size.height;
    let width = size.width;
    this._status.element.style.height = `${info.itemHeight}px`;
    if (this._state === 2 /* Empty */ || this._state === 1 /* Loading */) {
      height = info.itemHeight + info.borderHeight;
      width = info.defaultSize.width / 2;
      this.element.enableSashes(false, false, false, false);
      this.element.minSize = this.element.maxSize = new dom.Dimension(width, height);
      this._contentWidget.setPreference(ContentWidgetPositionPreference.BELOW);
    } else {
      const maxWidth = bodyBox.width - info.borderHeight - 2 * info.horizontalPadding;
      if (width > maxWidth) {
        width = maxWidth;
      }
      const preferredWidth = this._completionModel ? this._completionModel.stats.pLabelLen * info.typicalHalfwidthCharacterWidth : width;
      const fullHeight = info.statusBarHeight + this._list.contentHeight + info.borderHeight;
      const minHeight = info.itemHeight + info.statusBarHeight;
      const editorBox = dom.getDomNodePagePosition(this.editor.getDomNode());
      const cursorBox = this.editor.getScrolledVisiblePosition(this.editor.getPosition());
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
        this._contentWidget.setPreference(ContentWidgetPositionPreference.ABOVE);
        this.element.enableSashes(true, true, false, false);
        maxHeight = maxHeightAbove;
      } else {
        this._contentWidget.setPreference(ContentWidgetPositionPreference.BELOW);
        this.element.enableSashes(false, true, true, false);
        maxHeight = maxHeightBelow;
      }
      this.element.preferredSize = new dom.Dimension(preferredWidth, info.defaultSize.height);
      this.element.maxSize = new dom.Dimension(maxWidth, maxHeight);
      this.element.minSize = new dom.Dimension(220, minHeight);
      this._cappedHeight = height === fullHeight ? { wanted: this._cappedHeight?.wanted ?? size.height, capped: height } : void 0;
    }
    this._resize(width, height);
  }
  _resize(width, height) {
    const { width: maxWidth, height: maxHeight } = this.element.maxSize;
    width = Math.min(maxWidth, width);
    height = Math.min(maxHeight, height);
    const { statusBarHeight } = this.getLayoutInfo();
    this._list.layout(height - statusBarHeight, width);
    this._listElement.style.height = `${height - statusBarHeight}px`;
    this.element.layout(height, width);
    this._contentWidget.layout();
    this._positionDetails();
  }
  _positionDetails() {
    if (this._isDetailsVisible()) {
      this._details.placeAtAnchor(this.element.domNode, this._contentWidget.getPosition()?.preference[0] === ContentWidgetPositionPreference.BELOW);
    }
  }
  getLayoutInfo() {
    const fontInfo = this.editor.getOption(EditorOption.fontInfo);
    const itemHeight = clamp(this.editor.getOption(EditorOption.suggestLineHeight) || fontInfo.lineHeight, 8, 1e3);
    const statusBarHeight = !this.editor.getOption(EditorOption.suggest).showStatusBar || this._state === 2 /* Empty */ || this._state === 1 /* Loading */ ? 0 : itemHeight;
    const borderWidth = this._details.widget.borderWidth;
    const borderHeight = 2 * borderWidth;
    return {
      itemHeight,
      statusBarHeight,
      borderWidth,
      borderHeight,
      typicalHalfwidthCharacterWidth: fontInfo.typicalHalfwidthCharacterWidth,
      verticalPadding: 22,
      horizontalPadding: 14,
      defaultSize: new dom.Dimension(430, statusBarHeight + 12 * itemHeight)
    };
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
SuggestWidget.LOADING_MESSAGE = nls.localize("suggestWidget.loading", "Loading...");
SuggestWidget.NO_SUGGESTIONS_MESSAGE = nls.localize("suggestWidget.noSuggestions", "No suggestions.");
SuggestWidget = __decorateClass([
  __decorateParam(1, IStorageService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IThemeService),
  __decorateParam(4, IInstantiationService)
], SuggestWidget);
class SuggestContentWidget {
  constructor(_widget, _editor) {
    this._widget = _widget;
    this._editor = _editor;
    this.allowEditorOverflow = true;
    this.suppressMouseDown = false;
    this._preferenceLocked = false;
    this._added = false;
    this._hidden = false;
  }
  dispose() {
    if (this._added) {
      this._added = false;
      this._editor.removeContentWidget(this);
    }
  }
  getId() {
    return "editor.widget.suggestWidget";
  }
  getDomNode() {
    return this._widget.element.domNode;
  }
  show() {
    this._hidden = false;
    if (!this._added) {
      this._added = true;
      this._editor.addContentWidget(this);
    }
  }
  hide() {
    if (!this._hidden) {
      this._hidden = true;
      this.layout();
    }
  }
  layout() {
    this._editor.layoutContentWidget(this);
  }
  getPosition() {
    if (this._hidden || !this._position || !this._preference) {
      return null;
    }
    return {
      position: this._position,
      preference: [this._preference]
    };
  }
  beforeRender() {
    const { height, width } = this._widget.element.size;
    const { borderWidth, horizontalPadding } = this._widget.getLayoutInfo();
    return new dom.Dimension(width + 2 * borderWidth + horizontalPadding, height + 2 * borderWidth);
  }
  afterRender(position) {
    this._widget._afterRender(position);
  }
  setPreference(preference) {
    if (!this._preferenceLocked) {
      this._preference = preference;
    }
  }
  lockPreference() {
    this._preferenceLocked = true;
  }
  unlockPreference() {
    this._preferenceLocked = false;
  }
  setPosition(position) {
    this._position = position;
  }
}
export {
  SuggestContentWidget,
  SuggestWidget,
  editorSuggestWidgetSelectedBackground
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvc3VnZ2VzdFdpZGdldC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0ICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvY29kaWNvbnMvY29kaWNvblN0eWxlcy5qcyc7IC8vIFRoZSBjb2RpY29uIHN5bWJvbCBzdHlsZXMgYXJlIGRlZmluZWQgaGVyZSBhbmQgbXVzdCBiZSBsb2FkZWRcbmltcG9ydCB7IElMaXN0RXZlbnQsIElMaXN0R2VzdHVyZUV2ZW50LCBJTGlzdE1vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IExpc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0V2lkZ2V0LmpzJztcbmltcG9ydCB7IENhbmNlbGFibGVQcm9taXNlLCBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSwgZGlzcG9zYWJsZVRpbWVvdXQsIFRpbWVvdXRUaW1lciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50LCBQYXVzZWFibGVFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgY2xhbXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9udW1iZXJzLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgJy4vbWVkaWEvc3VnZ2VzdC5jc3MnO1xuaW1wb3J0IHsgQ29udGVudFdpZGdldFBvc2l0aW9uUHJlZmVyZW5jZSwgSUNvZGVFZGl0b3IsIElDb250ZW50V2lkZ2V0LCBJQ29udGVudFdpZGdldFBvc2l0aW9uLCBJRWRpdG9yTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFbWJlZGRlZENvZGVFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yL2VtYmVkZGVkQ29kZUVkaXRvcldpZGdldC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSVBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgU3VnZ2VzdFdpZGdldFN0YXR1cyB9IGZyb20gJy4vc3VnZ2VzdFdpZGdldFN0YXR1cy5qcyc7XG5pbXBvcnQgJy4uLy4uL3N5bWJvbEljb25zL2Jyb3dzZXIvc3ltYm9sSWNvbnMuanMnOyAvLyBUaGUgY29kaWNvbiBzeW1ib2wgY29sb3JzIGFyZSBkZWZpbmVkIGhlcmUgYW5kIG11c3QgYmUgbG9hZGVkIHRvIGdldCBjb2xvcnNcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgYWN0aXZlQ29udHJhc3RCb3JkZXIsIGVkaXRvckZvcmVncm91bmQsIGVkaXRvcldpZGdldEJhY2tncm91bmQsIGVkaXRvcldpZGdldEJvcmRlciwgbGlzdEZvY3VzSGlnaGxpZ2h0Rm9yZWdyb3VuZCwgbGlzdEhpZ2hsaWdodEZvcmVncm91bmQsIHF1aWNrSW5wdXRMaXN0Rm9jdXNCYWNrZ3JvdW5kLCBxdWlja0lucHV0TGlzdEZvY3VzRm9yZWdyb3VuZCwgcXVpY2tJbnB1dExpc3RGb2N1c0ljb25Gb3JlZ3JvdW5kLCByZWdpc3RlckNvbG9yLCB0cmFuc3BhcmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGlzSGlnaENvbnRyYXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IElDb2xvclRoZW1lLCBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb21wbGV0aW9uTW9kZWwgfSBmcm9tICcuL2NvbXBsZXRpb25Nb2RlbC5qcyc7XG5pbXBvcnQgeyBSZXNpemFibGVIVE1MRWxlbWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9yZXNpemFibGUvcmVzaXphYmxlLmpzJztcbmltcG9ydCB7IENvbXBsZXRpb25JdGVtLCBDb250ZXh0IGFzIFN1Z2dlc3RDb250ZXh0LCBzdWdnZXN0V2lkZ2V0U3RhdHVzYmFyTWVudSB9IGZyb20gJy4vc3VnZ2VzdC5qcyc7XG5pbXBvcnQgeyBjYW5FeHBhbmRDb21wbGV0aW9uSXRlbSwgU3VnZ2VzdERldGFpbHNPdmVybGF5LCBTdWdnZXN0RGV0YWlsc1dpZGdldCB9IGZyb20gJy4vc3VnZ2VzdFdpZGdldERldGFpbHMuanMnO1xuaW1wb3J0IHsgSXRlbVJlbmRlcmVyIH0gZnJvbSAnLi9zdWdnZXN0V2lkZ2V0UmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgZ2V0TGlzdFN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2Jyb3dzZXIvZGVmYXVsdFN0eWxlcy5qcyc7XG5pbXBvcnQgeyBzdGF0dXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYXJpYS9hcmlhLmpzJztcbmltcG9ydCB7IENvbXBsZXRpb25JdGVtS2luZHMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcblxuLyoqXG4gKiBTdWdnZXN0IHdpZGdldCBjb2xvcnNcbiAqL1xucmVnaXN0ZXJDb2xvcignZWRpdG9yU3VnZ2VzdFdpZGdldC5iYWNrZ3JvdW5kJywgZWRpdG9yV2lkZ2V0QmFja2dyb3VuZCwgbmxzLmxvY2FsaXplKCdlZGl0b3JTdWdnZXN0V2lkZ2V0QmFja2dyb3VuZCcsICdCYWNrZ3JvdW5kIGNvbG9yIG9mIHRoZSBzdWdnZXN0IHdpZGdldC4nKSk7XG5yZWdpc3RlckNvbG9yKCdlZGl0b3JTdWdnZXN0V2lkZ2V0LmJvcmRlcicsIGVkaXRvcldpZGdldEJvcmRlciwgbmxzLmxvY2FsaXplKCdlZGl0b3JTdWdnZXN0V2lkZ2V0Qm9yZGVyJywgJ0JvcmRlciBjb2xvciBvZiB0aGUgc3VnZ2VzdCB3aWRnZXQuJykpO1xuY29uc3QgZWRpdG9yU3VnZ2VzdFdpZGdldEZvcmVncm91bmQgPSByZWdpc3RlckNvbG9yKCdlZGl0b3JTdWdnZXN0V2lkZ2V0LmZvcmVncm91bmQnLCBlZGl0b3JGb3JlZ3JvdW5kLCBubHMubG9jYWxpemUoJ2VkaXRvclN1Z2dlc3RXaWRnZXRGb3JlZ3JvdW5kJywgJ0ZvcmVncm91bmQgY29sb3Igb2YgdGhlIHN1Z2dlc3Qgd2lkZ2V0LicpKTtcbnJlZ2lzdGVyQ29sb3IoJ2VkaXRvclN1Z2dlc3RXaWRnZXQuc2VsZWN0ZWRGb3JlZ3JvdW5kJywgcXVpY2tJbnB1dExpc3RGb2N1c0ZvcmVncm91bmQsIG5scy5sb2NhbGl6ZSgnZWRpdG9yU3VnZ2VzdFdpZGdldFNlbGVjdGVkRm9yZWdyb3VuZCcsICdGb3JlZ3JvdW5kIGNvbG9yIG9mIHRoZSBzZWxlY3RlZCBlbnRyeSBpbiB0aGUgc3VnZ2VzdCB3aWRnZXQuJykpO1xucmVnaXN0ZXJDb2xvcignZWRpdG9yU3VnZ2VzdFdpZGdldC5zZWxlY3RlZEljb25Gb3JlZ3JvdW5kJywgcXVpY2tJbnB1dExpc3RGb2N1c0ljb25Gb3JlZ3JvdW5kLCBubHMubG9jYWxpemUoJ2VkaXRvclN1Z2dlc3RXaWRnZXRTZWxlY3RlZEljb25Gb3JlZ3JvdW5kJywgJ0ljb24gZm9yZWdyb3VuZCBjb2xvciBvZiB0aGUgc2VsZWN0ZWQgZW50cnkgaW4gdGhlIHN1Z2dlc3Qgd2lkZ2V0LicpKTtcbmV4cG9ydCBjb25zdCBlZGl0b3JTdWdnZXN0V2lkZ2V0U2VsZWN0ZWRCYWNrZ3JvdW5kID0gcmVnaXN0ZXJDb2xvcignZWRpdG9yU3VnZ2VzdFdpZGdldC5zZWxlY3RlZEJhY2tncm91bmQnLCBxdWlja0lucHV0TGlzdEZvY3VzQmFja2dyb3VuZCwgbmxzLmxvY2FsaXplKCdlZGl0b3JTdWdnZXN0V2lkZ2V0U2VsZWN0ZWRCYWNrZ3JvdW5kJywgJ0JhY2tncm91bmQgY29sb3Igb2YgdGhlIHNlbGVjdGVkIGVudHJ5IGluIHRoZSBzdWdnZXN0IHdpZGdldC4nKSk7XG5yZWdpc3RlckNvbG9yKCdlZGl0b3JTdWdnZXN0V2lkZ2V0LmhpZ2hsaWdodEZvcmVncm91bmQnLCBsaXN0SGlnaGxpZ2h0Rm9yZWdyb3VuZCwgbmxzLmxvY2FsaXplKCdlZGl0b3JTdWdnZXN0V2lkZ2V0SGlnaGxpZ2h0Rm9yZWdyb3VuZCcsICdDb2xvciBvZiB0aGUgbWF0Y2ggaGlnaGxpZ2h0cyBpbiB0aGUgc3VnZ2VzdCB3aWRnZXQuJykpO1xucmVnaXN0ZXJDb2xvcignZWRpdG9yU3VnZ2VzdFdpZGdldC5mb2N1c0hpZ2hsaWdodEZvcmVncm91bmQnLCBsaXN0Rm9jdXNIaWdobGlnaHRGb3JlZ3JvdW5kLCBubHMubG9jYWxpemUoJ2VkaXRvclN1Z2dlc3RXaWRnZXRGb2N1c0hpZ2hsaWdodEZvcmVncm91bmQnLCAnQ29sb3Igb2YgdGhlIG1hdGNoIGhpZ2hsaWdodHMgaW4gdGhlIHN1Z2dlc3Qgd2lkZ2V0IHdoZW4gYW4gaXRlbSBpcyBmb2N1c2VkLicpKTtcbnJlZ2lzdGVyQ29sb3IoJ2VkaXRvclN1Z2dlc3RXaWRnZXRTdGF0dXMuZm9yZWdyb3VuZCcsIHRyYW5zcGFyZW50KGVkaXRvclN1Z2dlc3RXaWRnZXRGb3JlZ3JvdW5kLCAuNSksIG5scy5sb2NhbGl6ZSgnZWRpdG9yU3VnZ2VzdFdpZGdldFN0YXR1c0ZvcmVncm91bmQnLCAnRm9yZWdyb3VuZCBjb2xvciBvZiB0aGUgc3VnZ2VzdCB3aWRnZXQgc3RhdHVzLicpKTtcblxuY29uc3QgZW51bSBTdGF0ZSB7XG5cdEhpZGRlbixcblx0TG9hZGluZyxcblx0RW1wdHksXG5cdE9wZW4sXG5cdEZyb3plbixcblx0RGV0YWlscyxcblx0b25EZXRhaWxzS2V5RG93blxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTZWxlY3RlZFN1Z2dlc3Rpb24ge1xuXHRpdGVtOiBDb21wbGV0aW9uSXRlbTtcblx0aW5kZXg6IG51bWJlcjtcblx0bW9kZWw6IENvbXBsZXRpb25Nb2RlbDtcbn1cblxuY2xhc3MgUGVyc2lzdGVkV2lkZ2V0U2l6ZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfa2V5OiBzdHJpbmc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfc2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdGVkaXRvcjogSUNvZGVFZGl0b3Jcblx0KSB7XG5cdFx0dGhpcy5fa2V5ID0gYHN1Z2dlc3RXaWRnZXQuc2l6ZS8ke2VkaXRvci5nZXRFZGl0b3JUeXBlKCl9LyR7ZWRpdG9yIGluc3RhbmNlb2YgRW1iZWRkZWRDb2RlRWRpdG9yV2lkZ2V0fWA7XG5cdH1cblxuXHRyZXN0b3JlKCk6IGRvbS5EaW1lbnNpb24gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHJhdyA9IHRoaXMuX3NlcnZpY2UuZ2V0KHRoaXMuX2tleSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUpID8/ICcnO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBvYmogPSBKU09OLnBhcnNlKHJhdyk7XG5cdFx0XHRpZiAoZG9tLkRpbWVuc2lvbi5pcyhvYmopKSB7XG5cdFx0XHRcdHJldHVybiBkb20uRGltZW5zaW9uLmxpZnQob2JqKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIHtcblx0XHRcdC8vIGlnbm9yZVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0c3RvcmUoc2l6ZTogZG9tLkRpbWVuc2lvbikge1xuXHRcdHRoaXMuX3NlcnZpY2Uuc3RvcmUodGhpcy5fa2V5LCBKU09OLnN0cmluZ2lmeShzaXplKSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdH1cblxuXHRyZXNldCgpOiB2b2lkIHtcblx0XHR0aGlzLl9zZXJ2aWNlLnJlbW92ZSh0aGlzLl9rZXksIFN0b3JhZ2VTY29wZS5QUk9GSUxFKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU3VnZ2VzdFdpZGdldCBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHN0YXRpYyBMT0FESU5HX01FU1NBR0U6IHN0cmluZyA9IG5scy5sb2NhbGl6ZSgnc3VnZ2VzdFdpZGdldC5sb2FkaW5nJywgXCJMb2FkaW5nLi4uXCIpO1xuXHRwcml2YXRlIHN0YXRpYyBOT19TVUdHRVNUSU9OU19NRVNTQUdFOiBzdHJpbmcgPSBubHMubG9jYWxpemUoJ3N1Z2dlc3RXaWRnZXQubm9TdWdnZXN0aW9ucycsIFwiTm8gc3VnZ2VzdGlvbnMuXCIpO1xuXG5cdHByaXZhdGUgX3N0YXRlOiBTdGF0ZSA9IFN0YXRlLkhpZGRlbjtcblx0cHJpdmF0ZSBfaXNBdXRvOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX2xvYWRpbmdUaW1lb3V0PzogSURpc3Bvc2FibGU7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3BlbmRpbmdMYXlvdXQgPSBuZXcgTXV0YWJsZURpc3Bvc2FibGUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcGVuZGluZ1Nob3dEZXRhaWxzID0gbmV3IE11dGFibGVEaXNwb3NhYmxlKCk7XG5cdHByaXZhdGUgX2N1cnJlbnRTdWdnZXN0aW9uRGV0YWlscz86IENhbmNlbGFibGVQcm9taXNlPHZvaWQ+O1xuXHRwcml2YXRlIF9mb2N1c2VkSXRlbT86IENvbXBsZXRpb25JdGVtO1xuXHRwcml2YXRlIF9pZ25vcmVGb2N1c0V2ZW50czogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIF9jb21wbGV0aW9uTW9kZWw/OiBDb21wbGV0aW9uTW9kZWw7XG5cdHByaXZhdGUgX2NhcHBlZEhlaWdodD86IHsgd2FudGVkOiBudW1iZXI7IGNhcHBlZDogbnVtYmVyIH07XG5cdHByaXZhdGUgX2ZvcmNlUmVuZGVyaW5nQWJvdmU6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfZXhwbGFpbk1vZGU6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRyZWFkb25seSBlbGVtZW50OiBSZXNpemFibGVIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfbWVzc2FnZUVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9saXN0RWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2xpc3Q6IExpc3Q8Q29tcGxldGlvbkl0ZW0+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zdGF0dXM6IFN1Z2dlc3RXaWRnZXRTdGF0dXM7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RldGFpbHM6IFN1Z2dlc3REZXRhaWxzT3ZlcmxheTtcblx0cHJpdmF0ZSByZWFkb25seSBfY29udGVudFdpZGdldDogU3VnZ2VzdENvbnRlbnRXaWRnZXQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3BlcnNpc3RlZFNpemU6IFBlcnNpc3RlZFdpZGdldFNpemU7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY3R4U3VnZ2VzdFdpZGdldFZpc2libGU6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jdHhTdWdnZXN0V2lkZ2V0RGV0YWlsc1Zpc2libGU6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jdHhTdWdnZXN0V2lkZ2V0TXVsdGlwbGVTdWdnZXN0aW9uczogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2N0eFN1Z2dlc3RXaWRnZXRIYXNGb2N1c2VkU3VnZ2VzdGlvbjogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc2hvd1RpbWVvdXQgPSBuZXcgVGltZW91dFRpbWVyKCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2Rpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTZWxlY3QgPSBuZXcgUGF1c2VhYmxlRW1pdHRlcjxJU2VsZWN0ZWRTdWdnZXN0aW9uPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEZvY3VzID0gbmV3IFBhdXNlYWJsZUVtaXR0ZXI8SVNlbGVjdGVkU3VnZ2VzdGlvbj4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRIaWRlID0gbmV3IEVtaXR0ZXI8dGhpcz4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTaG93ID0gbmV3IEVtaXR0ZXI8dGhpcz4oKTtcblxuXHRyZWFkb25seSBvbkRpZFNlbGVjdDogRXZlbnQ8SVNlbGVjdGVkU3VnZ2VzdGlvbj4gPSB0aGlzLl9vbkRpZFNlbGVjdC5ldmVudDtcblx0cmVhZG9ubHkgb25EaWRGb2N1czogRXZlbnQ8SVNlbGVjdGVkU3VnZ2VzdGlvbj4gPSB0aGlzLl9vbkRpZEZvY3VzLmV2ZW50O1xuXHRyZWFkb25seSBvbkRpZEhpZGU6IEV2ZW50PHRoaXM+ID0gdGhpcy5fb25EaWRIaWRlLmV2ZW50O1xuXHRyZWFkb25seSBvbkRpZFNob3c6IEV2ZW50PHRoaXM+ID0gdGhpcy5fb25EaWRTaG93LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGV0YWlsc0tleWRvd24gPSBuZXcgRW1pdHRlcjxJS2V5Ym9hcmRFdmVudD4oKTtcblx0cmVhZG9ubHkgb25EZXRhaWxzS2V5RG93bjogRXZlbnQ8SUtleWJvYXJkRXZlbnQ+ID0gdGhpcy5fb25EZXRhaWxzS2V5ZG93bi5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGVkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9zdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgX2NvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgX3RoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuZWxlbWVudCA9IG5ldyBSZXNpemFibGVIVE1MRWxlbWVudCgpO1xuXHRcdHRoaXMuZWxlbWVudC5kb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ2VkaXRvci13aWRnZXQnLCAnc3VnZ2VzdC13aWRnZXQnKTtcblxuXHRcdHRoaXMuX2NvbnRlbnRXaWRnZXQgPSBuZXcgU3VnZ2VzdENvbnRlbnRXaWRnZXQodGhpcywgZWRpdG9yKTtcblx0XHR0aGlzLl9wZXJzaXN0ZWRTaXplID0gbmV3IFBlcnNpc3RlZFdpZGdldFNpemUoX3N0b3JhZ2VTZXJ2aWNlLCBlZGl0b3IpO1xuXG5cdFx0Y2xhc3MgUmVzaXplU3RhdGUge1xuXHRcdFx0Y29uc3RydWN0b3IoXG5cdFx0XHRcdHJlYWRvbmx5IHBlcnNpc3RlZFNpemU6IGRvbS5EaW1lbnNpb24gfCB1bmRlZmluZWQsXG5cdFx0XHRcdHJlYWRvbmx5IGN1cnJlbnRTaXplOiBkb20uRGltZW5zaW9uLFxuXHRcdFx0XHRwdWJsaWMgcGVyc2lzdEhlaWdodCA9IGZhbHNlLFxuXHRcdFx0XHRwdWJsaWMgcGVyc2lzdFdpZHRoID0gZmFsc2UsXG5cdFx0XHQpIHsgfVxuXHRcdH1cblxuXHRcdGxldCBzdGF0ZTogUmVzaXplU3RhdGUgfCB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuZWxlbWVudC5vbkRpZFdpbGxSZXNpemUoKCkgPT4ge1xuXHRcdFx0dGhpcy5fY29udGVudFdpZGdldC5sb2NrUHJlZmVyZW5jZSgpO1xuXHRcdFx0c3RhdGUgPSBuZXcgUmVzaXplU3RhdGUodGhpcy5fcGVyc2lzdGVkU2l6ZS5yZXN0b3JlKCksIHRoaXMuZWxlbWVudC5zaXplKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuZWxlbWVudC5vbkRpZFJlc2l6ZShlID0+IHtcblxuXHRcdFx0dGhpcy5fcmVzaXplKGUuZGltZW5zaW9uLndpZHRoLCBlLmRpbWVuc2lvbi5oZWlnaHQpO1xuXG5cdFx0XHRpZiAoc3RhdGUpIHtcblx0XHRcdFx0c3RhdGUucGVyc2lzdEhlaWdodCA9IHN0YXRlLnBlcnNpc3RIZWlnaHQgfHwgISFlLm5vcnRoIHx8ICEhZS5zb3V0aDtcblx0XHRcdFx0c3RhdGUucGVyc2lzdFdpZHRoID0gc3RhdGUucGVyc2lzdFdpZHRoIHx8ICEhZS5lYXN0IHx8ICEhZS53ZXN0O1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWUuZG9uZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzdGF0ZSkge1xuXHRcdFx0XHQvLyBvbmx5IHN0b3JlIHdpZHRoIG9yIGhlaWdodCB2YWx1ZSB0aGF0IGhhdmUgY2hhbmdlZCBhbmQgYWxzb1xuXHRcdFx0XHQvLyBvbmx5IHN0b3JlIGNoYW5nZXMgdGhhdCBhcmUgYWJvdmUgYSBjZXJ0YWluIHRocmVzaG9sZFxuXHRcdFx0XHRjb25zdCB7IGl0ZW1IZWlnaHQsIGRlZmF1bHRTaXplIH0gPSB0aGlzLmdldExheW91dEluZm8oKTtcblx0XHRcdFx0Y29uc3QgdGhyZXNob2xkID0gTWF0aC5yb3VuZChpdGVtSGVpZ2h0IC8gMik7XG5cdFx0XHRcdGxldCB7IHdpZHRoLCBoZWlnaHQgfSA9IHRoaXMuZWxlbWVudC5zaXplO1xuXHRcdFx0XHRpZiAoIXN0YXRlLnBlcnNpc3RIZWlnaHQgfHwgTWF0aC5hYnMoc3RhdGUuY3VycmVudFNpemUuaGVpZ2h0IC0gaGVpZ2h0KSA8PSB0aHJlc2hvbGQpIHtcblx0XHRcdFx0XHRoZWlnaHQgPSBzdGF0ZS5wZXJzaXN0ZWRTaXplPy5oZWlnaHQgPz8gZGVmYXVsdFNpemUuaGVpZ2h0O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghc3RhdGUucGVyc2lzdFdpZHRoIHx8IE1hdGguYWJzKHN0YXRlLmN1cnJlbnRTaXplLndpZHRoIC0gd2lkdGgpIDw9IHRocmVzaG9sZCkge1xuXHRcdFx0XHRcdHdpZHRoID0gc3RhdGUucGVyc2lzdGVkU2l6ZT8ud2lkdGggPz8gZGVmYXVsdFNpemUud2lkdGg7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fcGVyc2lzdGVkU2l6ZS5zdG9yZShuZXcgZG9tLkRpbWVuc2lvbih3aWR0aCwgaGVpZ2h0KSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHJlc2V0IHdvcmtpbmcgc3RhdGVcblx0XHRcdHRoaXMuX2NvbnRlbnRXaWRnZXQudW5sb2NrUHJlZmVyZW5jZSgpO1xuXHRcdFx0c3RhdGUgPSB1bmRlZmluZWQ7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fbWVzc2FnZUVsZW1lbnQgPSBkb20uYXBwZW5kKHRoaXMuZWxlbWVudC5kb21Ob2RlLCBkb20uJCgnLm1lc3NhZ2UnKSk7XG5cdFx0dGhpcy5fbGlzdEVsZW1lbnQgPSBkb20uYXBwZW5kKHRoaXMuZWxlbWVudC5kb21Ob2RlLCBkb20uJCgnLnRyZWUnKSk7XG5cblx0XHRjb25zdCBkZXRhaWxzID0gdGhpcy5fZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFN1Z2dlc3REZXRhaWxzV2lkZ2V0LCB0aGlzLmVkaXRvcikpO1xuXHRcdGRldGFpbHMub25EaWRDbG9zZSgoKSA9PiB0aGlzLnRvZ2dsZURldGFpbHMoKSwgdGhpcywgdGhpcy5fZGlzcG9zYWJsZXMpO1xuXHRcdHRoaXMuX2RldGFpbHMgPSBuZXcgU3VnZ2VzdERldGFpbHNPdmVybGF5KGRldGFpbHMsIHRoaXMuZWRpdG9yKTtcblxuXHRcdGNvbnN0IGFwcGx5SWNvblN0eWxlID0gKCkgPT4gdGhpcy5lbGVtZW50LmRvbU5vZGUuY2xhc3NMaXN0LnRvZ2dsZSgnbm8taWNvbnMnLCAhdGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5zdWdnZXN0KS5zaG93SWNvbnMpO1xuXHRcdGFwcGx5SWNvblN0eWxlKCk7XG5cblx0XHRjb25zdCByZW5kZXJlciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEl0ZW1SZW5kZXJlciwgdGhpcy5lZGl0b3IpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChyZW5kZXJlcik7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHJlbmRlcmVyLm9uRGlkVG9nZ2xlRGV0YWlscygoKSA9PiB0aGlzLnRvZ2dsZURldGFpbHMoKSkpO1xuXG5cdFx0dGhpcy5fbGlzdCA9IG5ldyBMaXN0KCdTdWdnZXN0V2lkZ2V0JywgdGhpcy5fbGlzdEVsZW1lbnQsIHtcblx0XHRcdGdldEhlaWdodDogKF9lbGVtZW50OiBDb21wbGV0aW9uSXRlbSk6IG51bWJlciA9PiB0aGlzLmdldExheW91dEluZm8oKS5pdGVtSGVpZ2h0LFxuXHRcdFx0Z2V0VGVtcGxhdGVJZDogKF9lbGVtZW50OiBDb21wbGV0aW9uSXRlbSk6IHN0cmluZyA9PiAnc3VnZ2VzdGlvbidcblx0XHR9LCBbcmVuZGVyZXJdLCB7XG5cdFx0XHRhbHdheXNDb25zdW1lTW91c2VXaGVlbDogdHJ1ZSxcblx0XHRcdHVzZVNoYWRvd3M6IGZhbHNlLFxuXHRcdFx0bW91c2VTdXBwb3J0OiBmYWxzZSxcblx0XHRcdG11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRhY2Nlc3NpYmlsaXR5UHJvdmlkZXI6IHtcblx0XHRcdFx0Z2V0Um9sZTogKCkgPT4gJ2xpc3RpdGVtJyxcblx0XHRcdFx0Z2V0V2lkZ2V0QXJpYUxhYmVsOiAoKSA9PiBubHMubG9jYWxpemUoJ3N1Z2dlc3QnLCBcIlN1Z2dlc3RcIiksXG5cdFx0XHRcdGdldFdpZGdldFJvbGU6ICgpID0+ICdsaXN0Ym94Jyxcblx0XHRcdFx0Z2V0QXJpYUxhYmVsOiAoaXRlbTogQ29tcGxldGlvbkl0ZW0pID0+IHtcblxuXHRcdFx0XHRcdGxldCBsYWJlbCA9IGl0ZW0udGV4dExhYmVsO1xuXHRcdFx0XHRcdGNvbnN0IGtpbmRMYWJlbCA9IENvbXBsZXRpb25JdGVtS2luZHMudG9MYWJlbChpdGVtLmNvbXBsZXRpb24ua2luZCk7XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBpdGVtLmNvbXBsZXRpb24ubGFiZWwgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0XHRjb25zdCB7IGRldGFpbCwgZGVzY3JpcHRpb24gfSA9IGl0ZW0uY29tcGxldGlvbi5sYWJlbDtcblx0XHRcdFx0XHRcdGlmIChkZXRhaWwgJiYgZGVzY3JpcHRpb24pIHtcblx0XHRcdFx0XHRcdFx0bGFiZWwgPSBubHMubG9jYWxpemUoJ2xhYmVsLmZ1bGwnLCAnezB9IHsxfSwgezJ9LCB7M30nLCBsYWJlbCwgZGV0YWlsLCBkZXNjcmlwdGlvbiwga2luZExhYmVsKTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoZGV0YWlsKSB7XG5cdFx0XHRcdFx0XHRcdGxhYmVsID0gbmxzLmxvY2FsaXplKCdsYWJlbC5kZXRhaWwnLCAnezB9IHsxfSwgezJ9JywgbGFiZWwsIGRldGFpbCwga2luZExhYmVsKTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoZGVzY3JpcHRpb24pIHtcblx0XHRcdFx0XHRcdFx0bGFiZWwgPSBubHMubG9jYWxpemUoJ2xhYmVsLmRlc2MnLCAnezB9LCB7MX0sIHsyfScsIGxhYmVsLCBkZXNjcmlwdGlvbiwga2luZExhYmVsKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0bGFiZWwgPSBubHMubG9jYWxpemUoJ2xhYmVsJywgJ3swfSwgezF9JywgbGFiZWwsIGtpbmRMYWJlbCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICghaXRlbS5pc1Jlc29sdmVkIHx8ICF0aGlzLl9pc0RldGFpbHNWaXNpYmxlKCkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBsYWJlbDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCB7IGRvY3VtZW50YXRpb24sIGRldGFpbCB9ID0gaXRlbS5jb21wbGV0aW9uO1xuXHRcdFx0XHRcdGNvbnN0IGRvY3MgPSBzdHJpbmdzLmZvcm1hdChcblx0XHRcdFx0XHRcdCd7MH17MX0nLFxuXHRcdFx0XHRcdFx0ZGV0YWlsIHx8ICcnLFxuXHRcdFx0XHRcdFx0ZG9jdW1lbnRhdGlvbiA/ICh0eXBlb2YgZG9jdW1lbnRhdGlvbiA9PT0gJ3N0cmluZycgPyBkb2N1bWVudGF0aW9uIDogZG9jdW1lbnRhdGlvbi52YWx1ZSkgOiAnJyk7XG5cblx0XHRcdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdhcmlhQ3VycmVudHRTdWdnZXN0aW9uUmVhZERldGFpbHMnLCBcInswfSwgZG9jczogezF9XCIsIGxhYmVsLCBkb2NzKTtcblx0XHRcdFx0fSxcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLl9saXN0LnN0eWxlKGdldExpc3RTdHlsZXMoe1xuXHRcdFx0bGlzdEluYWN0aXZlRm9jdXNCYWNrZ3JvdW5kOiBlZGl0b3JTdWdnZXN0V2lkZ2V0U2VsZWN0ZWRCYWNrZ3JvdW5kLFxuXHRcdFx0bGlzdEluYWN0aXZlRm9jdXNPdXRsaW5lOiBhY3RpdmVDb250cmFzdEJvcmRlclxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3N0YXR1cyA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFN1Z2dlc3RXaWRnZXRTdGF0dXMsIHRoaXMuZWxlbWVudC5kb21Ob2RlLCBzdWdnZXN0V2lkZ2V0U3RhdHVzYmFyTWVudSk7XG5cdFx0Y29uc3QgYXBwbHlTdGF0dXNCYXJTdHlsZSA9ICgpID0+IHRoaXMuZWxlbWVudC5kb21Ob2RlLmNsYXNzTGlzdC50b2dnbGUoJ3dpdGgtc3RhdHVzLWJhcicsIHRoaXMuZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uc3VnZ2VzdCkuc2hvd1N0YXR1c0Jhcik7XG5cdFx0YXBwbHlTdGF0dXNCYXJTdHlsZSgpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKF90aGVtZVNlcnZpY2Uub25EaWRDb2xvclRoZW1lQ2hhbmdlKHQgPT4gdGhpcy5fb25UaGVtZUNoYW5nZSh0KSkpO1xuXHRcdHRoaXMuX29uVGhlbWVDaGFuZ2UoX3RoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX2xpc3Qub25Nb3VzZURvd24oZSA9PiB0aGlzLl9vbkxpc3RNb3VzZURvd25PclRhcChlKSkpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl9saXN0Lm9uVGFwKGUgPT4gdGhpcy5fb25MaXN0TW91c2VEb3duT3JUYXAoZSkpKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fbGlzdC5vbkRpZENoYW5nZVNlbGVjdGlvbihlID0+IHRoaXMuX29uTGlzdFNlbGVjdGlvbihlKSkpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl9saXN0Lm9uRGlkQ2hhbmdlRm9jdXMoZSA9PiB0aGlzLl9vbkxpc3RGb2N1cyhlKSkpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLmVkaXRvci5vbkRpZENoYW5nZUN1cnNvclNlbGVjdGlvbigoKSA9PiB0aGlzLl9vbkN1cnNvclNlbGVjdGlvbkNoYW5nZWQoKSkpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLmVkaXRvci5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5zdWdnZXN0KSkge1xuXHRcdFx0XHRhcHBseVN0YXR1c0JhclN0eWxlKCk7XG5cdFx0XHRcdGFwcGx5SWNvblN0eWxlKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5fY29tcGxldGlvbk1vZGVsICYmIChlLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLmZvbnRJbmZvKSB8fCBlLmhhc0NoYW5nZWQoRWRpdG9yT3B0aW9uLnN1Z2dlc3RGb250U2l6ZSkgfHwgZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi5zdWdnZXN0TGluZUhlaWdodCkpKSB7XG5cdFx0XHRcdHRoaXMuX2xpc3Quc3BsaWNlKDAsIHRoaXMuX2xpc3QubGVuZ3RoLCB0aGlzLl9jb21wbGV0aW9uTW9kZWwuaXRlbXMpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2N0eFN1Z2dlc3RXaWRnZXRWaXNpYmxlID0gU3VnZ2VzdENvbnRleHQuVmlzaWJsZS5iaW5kVG8oX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9jdHhTdWdnZXN0V2lkZ2V0RGV0YWlsc1Zpc2libGUgPSBTdWdnZXN0Q29udGV4dC5EZXRhaWxzVmlzaWJsZS5iaW5kVG8oX2NvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9jdHhTdWdnZXN0V2lkZ2V0TXVsdGlwbGVTdWdnZXN0aW9ucyA9IFN1Z2dlc3RDb250ZXh0Lk11bHRpcGxlU3VnZ2VzdGlvbnMuYmluZFRvKF9jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fY3R4U3VnZ2VzdFdpZGdldEhhc0ZvY3VzZWRTdWdnZXN0aW9uID0gU3VnZ2VzdENvbnRleHQuSGFzRm9jdXNlZFN1Z2dlc3Rpb24uYmluZFRvKF9jb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQoZG9tLmFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuX2RldGFpbHMud2lkZ2V0LmRvbU5vZGUsICdrZXlkb3duJywgZSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRldGFpbHNLZXlkb3duLmZpcmUoZSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuZWRpdG9yLm9uTW91c2VEb3duKChlOiBJRWRpdG9yTW91c2VFdmVudCkgPT4gdGhpcy5fb25FZGl0b3JNb3VzZURvd24oZSkpKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGV0YWlscy53aWRnZXQuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2RldGFpbHMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2xpc3QuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3N0YXR1cy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2xvYWRpbmdUaW1lb3V0Py5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fcGVuZGluZ0xheW91dC5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fcGVuZGluZ1Nob3dEZXRhaWxzLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9zaG93VGltZW91dC5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fY29udGVudFdpZGdldC5kaXNwb3NlKCk7XG5cdFx0dGhpcy5lbGVtZW50LmRpc3Bvc2UoKTtcblx0fVxuXG5cdHByaXZhdGUgX29uRWRpdG9yTW91c2VEb3duKG1vdXNlRXZlbnQ6IElFZGl0b3JNb3VzZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2RldGFpbHMud2lkZ2V0LmRvbU5vZGUuY29udGFpbnMobW91c2VFdmVudC50YXJnZXQuZWxlbWVudCkpIHtcblx0XHRcdC8vIENsaWNraW5nIGluc2lkZSBkZXRhaWxzXG5cdFx0XHR0aGlzLl9kZXRhaWxzLndpZGdldC5kb21Ob2RlLmZvY3VzKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIENsaWNraW5nIG91dHNpZGUgZGV0YWlscyBhbmQgaW5zaWRlIHN1Z2dlc3Rcblx0XHRcdGlmICh0aGlzLmVsZW1lbnQuZG9tTm9kZS5jb250YWlucyhtb3VzZUV2ZW50LnRhcmdldC5lbGVtZW50KSkge1xuXHRcdFx0XHR0aGlzLmVkaXRvci5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX29uQ3Vyc29yU2VsZWN0aW9uQ2hhbmdlZCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fc3RhdGUgIT09IFN0YXRlLkhpZGRlbikge1xuXHRcdFx0dGhpcy5fY29udGVudFdpZGdldC5sYXlvdXQoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9vbkxpc3RNb3VzZURvd25PclRhcChlOiBJTGlzdE1vdXNlRXZlbnQ8Q29tcGxldGlvbkl0ZW0+IHwgSUxpc3RHZXN0dXJlRXZlbnQ8Q29tcGxldGlvbkl0ZW0+KTogdm9pZCB7XG5cdFx0aWYgKHR5cGVvZiBlLmVsZW1lbnQgPT09ICd1bmRlZmluZWQnIHx8IHR5cGVvZiBlLmluZGV4ID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIHByZXZlbnQgc3RlYWxpbmcgYnJvd3NlciBmb2N1cyBmcm9tIHRoZSBlZGl0b3Jcblx0XHRlLmJyb3dzZXJFdmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGUuYnJvd3NlckV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cdFx0dGhpcy5fc2VsZWN0KGUuZWxlbWVudCwgZS5pbmRleCk7XG5cdH1cblxuXHRwcml2YXRlIF9vbkxpc3RTZWxlY3Rpb24oZTogSUxpc3RFdmVudDxDb21wbGV0aW9uSXRlbT4pOiB2b2lkIHtcblx0XHRpZiAoZS5lbGVtZW50cy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuX3NlbGVjdChlLmVsZW1lbnRzWzBdLCBlLmluZGV4ZXNbMF0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3NlbGVjdChpdGVtOiBDb21wbGV0aW9uSXRlbSwgaW5kZXg6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IGNvbXBsZXRpb25Nb2RlbCA9IHRoaXMuX2NvbXBsZXRpb25Nb2RlbDtcblx0XHRpZiAoY29tcGxldGlvbk1vZGVsKSB7XG5cdFx0XHR0aGlzLl9vbkRpZFNlbGVjdC5maXJlKHsgaXRlbSwgaW5kZXgsIG1vZGVsOiBjb21wbGV0aW9uTW9kZWwgfSk7XG5cdFx0XHR0aGlzLmVkaXRvci5mb2N1cygpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX29uVGhlbWVDaGFuZ2UodGhlbWU6IElDb2xvclRoZW1lKSB7XG5cdFx0dGhpcy5fZGV0YWlscy53aWRnZXQuYm9yZGVyV2lkdGggPSBpc0hpZ2hDb250cmFzdCh0aGVtZS50eXBlKSA/IDIgOiAxO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25MaXN0Rm9jdXMoZTogSUxpc3RFdmVudDxDb21wbGV0aW9uSXRlbT4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faWdub3JlRm9jdXNFdmVudHMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fc3RhdGUgPT09IFN0YXRlLkRldGFpbHMpIHtcblx0XHRcdC8vIFRoaXMgY2FuIGhhcHBlbiB3aGVuIGZvY3VzIGlzIGluIHRoZSBkZXRhaWxzLXBhbmVsIGFuZCB3aGVuXG5cdFx0XHQvLyBhcnJvdyBrZXlzIGFyZSBwcmVzc2VkIHRvIHNlbGVjdCBuZXh0L3ByZXYgaXRlbXNcblx0XHRcdHRoaXMuX3NldFN0YXRlKFN0YXRlLk9wZW4pO1xuXHRcdH1cblxuXHRcdGlmICghZS5lbGVtZW50cy5sZW5ndGgpIHtcblx0XHRcdGlmICh0aGlzLl9jdXJyZW50U3VnZ2VzdGlvbkRldGFpbHMpIHtcblx0XHRcdFx0dGhpcy5fY3VycmVudFN1Z2dlc3Rpb25EZXRhaWxzLmNhbmNlbCgpO1xuXHRcdFx0XHR0aGlzLl9jdXJyZW50U3VnZ2VzdGlvbkRldGFpbHMgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMuX2ZvY3VzZWRJdGVtID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmVkaXRvci5zZXRBcmlhT3B0aW9ucyh7IGFjdGl2ZURlc2NlbmRhbnQ6IHVuZGVmaW5lZCB9KTtcblx0XHRcdHRoaXMuX2N0eFN1Z2dlc3RXaWRnZXRIYXNGb2N1c2VkU3VnZ2VzdGlvbi5zZXQoZmFsc2UpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fY29tcGxldGlvbk1vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fY3R4U3VnZ2VzdFdpZGdldEhhc0ZvY3VzZWRTdWdnZXN0aW9uLnNldCh0cnVlKTtcblx0XHRjb25zdCBpdGVtID0gZS5lbGVtZW50c1swXTtcblx0XHRjb25zdCBpbmRleCA9IGUuaW5kZXhlc1swXTtcblxuXHRcdGlmIChpdGVtICE9PSB0aGlzLl9mb2N1c2VkSXRlbSkge1xuXG5cdFx0XHR0aGlzLl9jdXJyZW50U3VnZ2VzdGlvbkRldGFpbHM/LmNhbmNlbCgpO1xuXHRcdFx0dGhpcy5fY3VycmVudFN1Z2dlc3Rpb25EZXRhaWxzID0gdW5kZWZpbmVkO1xuXG5cdFx0XHR0aGlzLl9mb2N1c2VkSXRlbSA9IGl0ZW07XG5cblx0XHRcdHRoaXMuX2xpc3QucmV2ZWFsKGluZGV4KTtcblxuXHRcdFx0dGhpcy5fY3VycmVudFN1Z2dlc3Rpb25EZXRhaWxzID0gY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UoYXN5bmMgdG9rZW4gPT4ge1xuXHRcdFx0XHRjb25zdCBsb2FkaW5nID0gZGlzcG9zYWJsZVRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdGlmICh0aGlzLl9pc0RldGFpbHNWaXNpYmxlKCkpIHtcblx0XHRcdFx0XHRcdHRoaXMuX3Nob3dEZXRhaWxzKHRydWUsIGZhbHNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sIDI1MCk7XG5cdFx0XHRcdGNvbnN0IHN1YiA9IHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IGxvYWRpbmcuZGlzcG9zZSgpKTtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRyZXR1cm4gYXdhaXQgaXRlbS5yZXNvbHZlKHRva2VuKTtcblx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHRsb2FkaW5nLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRzdWIuZGlzcG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5fY3VycmVudFN1Z2dlc3Rpb25EZXRhaWxzLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRpZiAoaW5kZXggPj0gdGhpcy5fbGlzdC5sZW5ndGggfHwgaXRlbSAhPT0gdGhpcy5fbGlzdC5lbGVtZW50KGluZGV4KSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIGl0ZW0gY2FuIGhhdmUgZXh0cmEgaW5mb3JtYXRpb24sIHNvIHJlLXJlbmRlclxuXHRcdFx0XHR0aGlzLl9pZ25vcmVGb2N1c0V2ZW50cyA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX2xpc3Quc3BsaWNlKGluZGV4LCAxLCBbaXRlbV0pO1xuXHRcdFx0XHR0aGlzLl9saXN0LnNldEZvY3VzKFtpbmRleF0pO1xuXHRcdFx0XHR0aGlzLl9pZ25vcmVGb2N1c0V2ZW50cyA9IGZhbHNlO1xuXG5cdFx0XHRcdGlmICh0aGlzLl9pc0RldGFpbHNWaXNpYmxlKCkpIHtcblx0XHRcdFx0XHR0aGlzLl9zaG93RGV0YWlscyhmYWxzZSwgZmFsc2UpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuZWxlbWVudC5kb21Ob2RlLmNsYXNzTGlzdC5yZW1vdmUoJ2RvY3Mtc2lkZScpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5lZGl0b3Iuc2V0QXJpYU9wdGlvbnMoeyBhY3RpdmVEZXNjZW5kYW50OiB0aGlzLl9saXN0LmdldEVsZW1lbnRJRChpbmRleCkgfSk7XG5cdFx0XHR9KS5jYXRjaChvblVuZXhwZWN0ZWRFcnJvcik7XG5cdFx0fVxuXG5cdFx0Ly8gZW1pdCBhbiBldmVudFxuXHRcdHRoaXMuX29uRGlkRm9jdXMuZmlyZSh7IGl0ZW0sIGluZGV4LCBtb2RlbDogdGhpcy5fY29tcGxldGlvbk1vZGVsIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0U3RhdGUoc3RhdGU6IFN0YXRlKTogdm9pZCB7XG5cblx0XHRpZiAodGhpcy5fc3RhdGUgPT09IHN0YXRlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3N0YXRlID0gc3RhdGU7XG5cblx0XHR0aGlzLmVsZW1lbnQuZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdmcm96ZW4nLCBzdGF0ZSA9PT0gU3RhdGUuRnJvemVuKTtcblx0XHR0aGlzLmVsZW1lbnQuZG9tTm9kZS5jbGFzc0xpc3QucmVtb3ZlKCdtZXNzYWdlJyk7XG5cblx0XHRzd2l0Y2ggKHN0YXRlKSB7XG5cdFx0XHRjYXNlIFN0YXRlLkhpZGRlbjpcblx0XHRcdFx0ZG9tLmhpZGUodGhpcy5fbWVzc2FnZUVsZW1lbnQsIHRoaXMuX2xpc3RFbGVtZW50LCB0aGlzLl9zdGF0dXMuZWxlbWVudCk7XG5cdFx0XHRcdHRoaXMuX2RldGFpbHMuaGlkZSh0cnVlKTtcblx0XHRcdFx0dGhpcy5fc3RhdHVzLmhpZGUoKTtcblx0XHRcdFx0dGhpcy5fY29udGVudFdpZGdldC5oaWRlKCk7XG5cdFx0XHRcdHRoaXMuX2N0eFN1Z2dlc3RXaWRnZXRWaXNpYmxlLnJlc2V0KCk7XG5cdFx0XHRcdHRoaXMuX2N0eFN1Z2dlc3RXaWRnZXRNdWx0aXBsZVN1Z2dlc3Rpb25zLnJlc2V0KCk7XG5cdFx0XHRcdHRoaXMuX2N0eFN1Z2dlc3RXaWRnZXRIYXNGb2N1c2VkU3VnZ2VzdGlvbi5yZXNldCgpO1xuXHRcdFx0XHR0aGlzLl9zaG93VGltZW91dC5jYW5jZWwoKTtcblx0XHRcdFx0dGhpcy5lbGVtZW50LmRvbU5vZGUuY2xhc3NMaXN0LnJlbW92ZSgndmlzaWJsZScpO1xuXHRcdFx0XHR0aGlzLl9saXN0LnNwbGljZSgwLCB0aGlzLl9saXN0Lmxlbmd0aCk7XG5cdFx0XHRcdHRoaXMuX2ZvY3VzZWRJdGVtID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR0aGlzLl9jYXBwZWRIZWlnaHQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoaXMuX2V4cGxhaW5Nb2RlID0gZmFsc2U7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBTdGF0ZS5Mb2FkaW5nOlxuXHRcdFx0XHR0aGlzLmVsZW1lbnQuZG9tTm9kZS5jbGFzc0xpc3QuYWRkKCdtZXNzYWdlJyk7XG5cdFx0XHRcdHRoaXMuX21lc3NhZ2VFbGVtZW50LnRleHRDb250ZW50ID0gU3VnZ2VzdFdpZGdldC5MT0FESU5HX01FU1NBR0U7XG5cdFx0XHRcdGRvbS5oaWRlKHRoaXMuX2xpc3RFbGVtZW50LCB0aGlzLl9zdGF0dXMuZWxlbWVudCk7XG5cdFx0XHRcdGRvbS5zaG93KHRoaXMuX21lc3NhZ2VFbGVtZW50KTtcblx0XHRcdFx0dGhpcy5fZGV0YWlscy5oaWRlKCk7XG5cdFx0XHRcdHRoaXMuX3Nob3coKTtcblx0XHRcdFx0dGhpcy5fZm9jdXNlZEl0ZW0gPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHN0YXR1cyhTdWdnZXN0V2lkZ2V0LkxPQURJTkdfTUVTU0FHRSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBTdGF0ZS5FbXB0eTpcblx0XHRcdFx0dGhpcy5lbGVtZW50LmRvbU5vZGUuY2xhc3NMaXN0LmFkZCgnbWVzc2FnZScpO1xuXHRcdFx0XHR0aGlzLl9tZXNzYWdlRWxlbWVudC50ZXh0Q29udGVudCA9IFN1Z2dlc3RXaWRnZXQuTk9fU1VHR0VTVElPTlNfTUVTU0FHRTtcblx0XHRcdFx0ZG9tLmhpZGUodGhpcy5fbGlzdEVsZW1lbnQsIHRoaXMuX3N0YXR1cy5lbGVtZW50KTtcblx0XHRcdFx0ZG9tLnNob3codGhpcy5fbWVzc2FnZUVsZW1lbnQpO1xuXHRcdFx0XHR0aGlzLl9kZXRhaWxzLmhpZGUoKTtcblx0XHRcdFx0dGhpcy5fc2hvdygpO1xuXHRcdFx0XHR0aGlzLl9mb2N1c2VkSXRlbSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0c3RhdHVzKFN1Z2dlc3RXaWRnZXQuTk9fU1VHR0VTVElPTlNfTUVTU0FHRSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBTdGF0ZS5PcGVuOlxuXHRcdFx0XHRkb20uaGlkZSh0aGlzLl9tZXNzYWdlRWxlbWVudCk7XG5cdFx0XHRcdGRvbS5zaG93KHRoaXMuX2xpc3RFbGVtZW50LCB0aGlzLl9zdGF0dXMuZWxlbWVudCk7XG5cdFx0XHRcdHRoaXMuX3Nob3coKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFN0YXRlLkZyb3plbjpcblx0XHRcdFx0ZG9tLmhpZGUodGhpcy5fbWVzc2FnZUVsZW1lbnQpO1xuXHRcdFx0XHRkb20uc2hvdyh0aGlzLl9saXN0RWxlbWVudCwgdGhpcy5fc3RhdHVzLmVsZW1lbnQpO1xuXHRcdFx0XHR0aGlzLl9zaG93KCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBTdGF0ZS5EZXRhaWxzOlxuXHRcdFx0XHRkb20uaGlkZSh0aGlzLl9tZXNzYWdlRWxlbWVudCk7XG5cdFx0XHRcdGRvbS5zaG93KHRoaXMuX2xpc3RFbGVtZW50LCB0aGlzLl9zdGF0dXMuZWxlbWVudCk7XG5cdFx0XHRcdHRoaXMuX2RldGFpbHMuc2hvdygpO1xuXHRcdFx0XHR0aGlzLl9zaG93KCk7XG5cdFx0XHRcdHRoaXMuX2RldGFpbHMud2lkZ2V0LmZvY3VzKCk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3Nob3coKTogdm9pZCB7XG5cdFx0dGhpcy5fc3RhdHVzLnNob3coKTtcblx0XHR0aGlzLl9jb250ZW50V2lkZ2V0LnNob3coKTtcblx0XHR0aGlzLl9sYXlvdXQodGhpcy5fcGVyc2lzdGVkU2l6ZS5yZXN0b3JlKCkpO1xuXHRcdHRoaXMuX2N0eFN1Z2dlc3RXaWRnZXRWaXNpYmxlLnNldCh0cnVlKTtcblxuXHRcdHRoaXMuX3Nob3dUaW1lb3V0LmNhbmNlbEFuZFNldCgoKSA9PiB7XG5cdFx0XHR0aGlzLmVsZW1lbnQuZG9tTm9kZS5jbGFzc0xpc3QuYWRkKCd2aXNpYmxlJyk7XG5cdFx0XHR0aGlzLl9vbkRpZFNob3cuZmlyZSh0aGlzKTtcblx0XHR9LCAxMDApO1xuXHR9XG5cblx0c2hvd1RyaWdnZXJlZChhdXRvOiBib29sZWFuLCBkZWxheTogbnVtYmVyKSB7XG5cdFx0aWYgKHRoaXMuX3N0YXRlICE9PSBTdGF0ZS5IaWRkZW4pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fY29udGVudFdpZGdldC5zZXRQb3NpdGlvbih0aGlzLmVkaXRvci5nZXRQb3NpdGlvbigpKTtcblx0XHR0aGlzLl9pc0F1dG8gPSAhIWF1dG87XG5cblx0XHRpZiAoIXRoaXMuX2lzQXV0bykge1xuXHRcdFx0dGhpcy5fbG9hZGluZ1RpbWVvdXQgPSBkaXNwb3NhYmxlVGltZW91dCgoKSA9PiB0aGlzLl9zZXRTdGF0ZShTdGF0ZS5Mb2FkaW5nKSwgZGVsYXkpO1xuXHRcdH1cblx0fVxuXG5cdHNob3dTdWdnZXN0aW9ucyhjb21wbGV0aW9uTW9kZWw6IENvbXBsZXRpb25Nb2RlbCwgc2VsZWN0aW9uSW5kZXg6IG51bWJlciwgaXNGcm96ZW46IGJvb2xlYW4sIGlzQXV0bzogYm9vbGVhbiwgbm9Gb2N1czogYm9vbGVhbik6IHZvaWQge1xuXG5cdFx0dGhpcy5fY29udGVudFdpZGdldC5zZXRQb3NpdGlvbih0aGlzLmVkaXRvci5nZXRQb3NpdGlvbigpKTtcblx0XHR0aGlzLl9sb2FkaW5nVGltZW91dD8uZGlzcG9zZSgpO1xuXG5cdFx0dGhpcy5fY3VycmVudFN1Z2dlc3Rpb25EZXRhaWxzPy5jYW5jZWwoKTtcblx0XHR0aGlzLl9jdXJyZW50U3VnZ2VzdGlvbkRldGFpbHMgPSB1bmRlZmluZWQ7XG5cblx0XHRpZiAodGhpcy5fY29tcGxldGlvbk1vZGVsICE9PSBjb21wbGV0aW9uTW9kZWwpIHtcblx0XHRcdHRoaXMuX2NvbXBsZXRpb25Nb2RlbCA9IGNvbXBsZXRpb25Nb2RlbDtcblx0XHR9XG5cblx0XHRpZiAoaXNGcm96ZW4gJiYgdGhpcy5fc3RhdGUgIT09IFN0YXRlLkVtcHR5ICYmIHRoaXMuX3N0YXRlICE9PSBTdGF0ZS5IaWRkZW4pIHtcblx0XHRcdHRoaXMuX3NldFN0YXRlKFN0YXRlLkZyb3plbik7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdmlzaWJsZUNvdW50ID0gdGhpcy5fY29tcGxldGlvbk1vZGVsLml0ZW1zLmxlbmd0aDtcblx0XHRjb25zdCBpc0VtcHR5ID0gdmlzaWJsZUNvdW50ID09PSAwO1xuXHRcdHRoaXMuX2N0eFN1Z2dlc3RXaWRnZXRNdWx0aXBsZVN1Z2dlc3Rpb25zLnNldCh2aXNpYmxlQ291bnQgPiAxKTtcblxuXHRcdGlmIChpc0VtcHR5KSB7XG5cdFx0XHR0aGlzLl9zZXRTdGF0ZShpc0F1dG8gPyBTdGF0ZS5IaWRkZW4gOiBTdGF0ZS5FbXB0eSk7XG5cdFx0XHR0aGlzLl9jb21wbGV0aW9uTW9kZWwgPSB1bmRlZmluZWQ7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fZm9jdXNlZEl0ZW0gPSB1bmRlZmluZWQ7XG5cblx0XHQvLyBjYWxsaW5nIGxpc3Quc3BsaWNlIHRyaWdnZXJzIGZvY3VzIGV2ZW50IHdoaWNoIHRoaXMgd2lkZ2V0IGZvcndhcmRzLiBUaGF0IGNhbiBsZWFkIHRvXG5cdFx0Ly8gc3VnZ2VzdGlvbnMgYmVpbmcgY2FuY2VsbGVkIGFuZCB0aGUgd2lkZ2V0IGJlaW5nIGNsZWFyZWQgKGFuZCBoaWRkZW4pLiBBbGwgdGhpcyBoYXBwZW5zXG5cdFx0Ly8gYmVmb3JlIHJldmVhbGluZyBhbmQgZm9jdXNpbmcgaXMgZG9uZSB3aGljaCBtZWFucyByZXZlYWxpbmcgYW5kIGZvY3VzaW5nIHdpbGwgZmFpbCB3aGVuXG5cdFx0Ly8gdGhleSBnZXQgcnVuLlxuXHRcdHRoaXMuX29uRGlkRm9jdXMucGF1c2UoKTtcblx0XHR0aGlzLl9vbkRpZFNlbGVjdC5wYXVzZSgpO1xuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLl9saXN0LnNwbGljZSgwLCB0aGlzLl9saXN0Lmxlbmd0aCwgdGhpcy5fY29tcGxldGlvbk1vZGVsLml0ZW1zKTtcblx0XHRcdHRoaXMuX3NldFN0YXRlKGlzRnJvemVuID8gU3RhdGUuRnJvemVuIDogU3RhdGUuT3Blbik7XG5cdFx0XHR0aGlzLl9saXN0LnJldmVhbChzZWxlY3Rpb25JbmRleCwgMCwgc2VsZWN0aW9uSW5kZXggPT09IDAgPyAwIDogdGhpcy5nZXRMYXlvdXRJbmZvKCkuaXRlbUhlaWdodCAqIDAuMzMpO1xuXHRcdFx0dGhpcy5fbGlzdC5zZXRGb2N1cyhub0ZvY3VzID8gW10gOiBbc2VsZWN0aW9uSW5kZXhdKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5fb25EaWRGb2N1cy5yZXN1bWUoKTtcblx0XHRcdHRoaXMuX29uRGlkU2VsZWN0LnJlc3VtZSgpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3BlbmRpbmdMYXlvdXQudmFsdWUgPSBkb20ucnVuQXRUaGlzT3JTY2hlZHVsZUF0TmV4dEFuaW1hdGlvbkZyYW1lKGRvbS5nZXRXaW5kb3codGhpcy5lbGVtZW50LmRvbU5vZGUpLCAoKSA9PiB7XG5cdFx0XHR0aGlzLl9wZW5kaW5nTGF5b3V0LmNsZWFyKCk7XG5cdFx0XHR0aGlzLl9sYXlvdXQodGhpcy5lbGVtZW50LnNpemUpO1xuXHRcdFx0Ly8gUmVzZXQgZm9jdXMgYm9yZGVyXG5cdFx0XHR0aGlzLl9kZXRhaWxzLndpZGdldC5kb21Ob2RlLmNsYXNzTGlzdC5yZW1vdmUoJ2ZvY3VzZWQnKTtcblx0XHR9KTtcblx0fVxuXG5cdGZvY3VzU2VsZWN0ZWQoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2xpc3QubGVuZ3RoID4gMCkge1xuXHRcdFx0dGhpcy5fbGlzdC5zZXRGb2N1cyhbMF0pO1xuXHRcdH1cblx0fVxuXG5cdHNlbGVjdE5leHRQYWdlKCk6IGJvb2xlYW4ge1xuXHRcdHN3aXRjaCAodGhpcy5fc3RhdGUpIHtcblx0XHRcdGNhc2UgU3RhdGUuSGlkZGVuOlxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRjYXNlIFN0YXRlLkRldGFpbHM6XG5cdFx0XHRcdHRoaXMuX2RldGFpbHMud2lkZ2V0LnBhZ2VEb3duKCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSBTdGF0ZS5Mb2FkaW5nOlxuXHRcdFx0XHRyZXR1cm4gIXRoaXMuX2lzQXV0bztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHRoaXMuX2xpc3QuZm9jdXNOZXh0UGFnZSgpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRzZWxlY3ROZXh0KCk6IGJvb2xlYW4ge1xuXHRcdHN3aXRjaCAodGhpcy5fc3RhdGUpIHtcblx0XHRcdGNhc2UgU3RhdGUuSGlkZGVuOlxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRjYXNlIFN0YXRlLkxvYWRpbmc6XG5cdFx0XHRcdHJldHVybiAhdGhpcy5faXNBdXRvO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGhpcy5fbGlzdC5mb2N1c05leHQoMSwgdHJ1ZSk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdHNlbGVjdExhc3QoKTogYm9vbGVhbiB7XG5cdFx0c3dpdGNoICh0aGlzLl9zdGF0ZSkge1xuXHRcdFx0Y2FzZSBTdGF0ZS5IaWRkZW46XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdGNhc2UgU3RhdGUuRGV0YWlsczpcblx0XHRcdFx0dGhpcy5fZGV0YWlscy53aWRnZXQuc2Nyb2xsQm90dG9tKCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0Y2FzZSBTdGF0ZS5Mb2FkaW5nOlxuXHRcdFx0XHRyZXR1cm4gIXRoaXMuX2lzQXV0bztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHRoaXMuX2xpc3QuZm9jdXNMYXN0KCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdHNlbGVjdFByZXZpb3VzUGFnZSgpOiBib29sZWFuIHtcblx0XHRzd2l0Y2ggKHRoaXMuX3N0YXRlKSB7XG5cdFx0XHRjYXNlIFN0YXRlLkhpZGRlbjpcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0Y2FzZSBTdGF0ZS5EZXRhaWxzOlxuXHRcdFx0XHR0aGlzLl9kZXRhaWxzLndpZGdldC5wYWdlVXAoKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRjYXNlIFN0YXRlLkxvYWRpbmc6XG5cdFx0XHRcdHJldHVybiAhdGhpcy5faXNBdXRvO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGhpcy5fbGlzdC5mb2N1c1ByZXZpb3VzUGFnZSgpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRzZWxlY3RQcmV2aW91cygpOiBib29sZWFuIHtcblx0XHRzd2l0Y2ggKHRoaXMuX3N0YXRlKSB7XG5cdFx0XHRjYXNlIFN0YXRlLkhpZGRlbjpcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0Y2FzZSBTdGF0ZS5Mb2FkaW5nOlxuXHRcdFx0XHRyZXR1cm4gIXRoaXMuX2lzQXV0bztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHRoaXMuX2xpc3QuZm9jdXNQcmV2aW91cygxLCB0cnVlKTtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHNlbGVjdEZpcnN0KCk6IGJvb2xlYW4ge1xuXHRcdHN3aXRjaCAodGhpcy5fc3RhdGUpIHtcblx0XHRcdGNhc2UgU3RhdGUuSGlkZGVuOlxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRjYXNlIFN0YXRlLkRldGFpbHM6XG5cdFx0XHRcdHRoaXMuX2RldGFpbHMud2lkZ2V0LnNjcm9sbFRvcCgpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgU3RhdGUuTG9hZGluZzpcblx0XHRcdFx0cmV0dXJuICF0aGlzLl9pc0F1dG87XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHR0aGlzLl9saXN0LmZvY3VzRmlyc3QoKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHR9XG5cblx0Z2V0Rm9jdXNlZEl0ZW0oKTogSVNlbGVjdGVkU3VnZ2VzdGlvbiB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuX3N0YXRlICE9PSBTdGF0ZS5IaWRkZW5cblx0XHRcdCYmIHRoaXMuX3N0YXRlICE9PSBTdGF0ZS5FbXB0eVxuXHRcdFx0JiYgdGhpcy5fc3RhdGUgIT09IFN0YXRlLkxvYWRpbmdcblx0XHRcdCYmIHRoaXMuX2NvbXBsZXRpb25Nb2RlbFxuXHRcdFx0JiYgdGhpcy5fbGlzdC5nZXRGb2N1cygpLmxlbmd0aCA+IDBcblx0XHQpIHtcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0aXRlbTogdGhpcy5fbGlzdC5nZXRGb2N1c2VkRWxlbWVudHMoKVswXSxcblx0XHRcdFx0aW5kZXg6IHRoaXMuX2xpc3QuZ2V0Rm9jdXMoKVswXSxcblx0XHRcdFx0bW9kZWw6IHRoaXMuX2NvbXBsZXRpb25Nb2RlbFxuXHRcdFx0fTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHRvZ2dsZURldGFpbHNGb2N1cygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fc3RhdGUgPT09IFN0YXRlLkRldGFpbHMpIHtcblx0XHRcdC8vIFNob3VsZCByZXR1cm4gdGhlIGZvY3VzIHRvIHRoZSBsaXN0IGl0ZW0uXG5cdFx0XHR0aGlzLl9saXN0LnNldEZvY3VzKHRoaXMuX2xpc3QuZ2V0Rm9jdXMoKSk7XG5cdFx0XHR0aGlzLl9zZXRTdGF0ZShTdGF0ZS5PcGVuKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX3N0YXRlID09PSBTdGF0ZS5PcGVuKSB7XG5cdFx0XHR0aGlzLl9zZXRTdGF0ZShTdGF0ZS5EZXRhaWxzKTtcblx0XHRcdGlmICghdGhpcy5faXNEZXRhaWxzVmlzaWJsZSgpKSB7XG5cdFx0XHRcdHRoaXMudG9nZ2xlRGV0YWlscyh0cnVlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2RldGFpbHMud2lkZ2V0LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0dG9nZ2xlRGV0YWlscyhmb2N1c2VkOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNEZXRhaWxzVmlzaWJsZSgpKSB7XG5cdFx0XHQvLyBoaWRlIGRldGFpbHMgd2lkZ2V0XG5cdFx0XHR0aGlzLl9wZW5kaW5nU2hvd0RldGFpbHMuY2xlYXIoKTtcblx0XHRcdHRoaXMuX2N0eFN1Z2dlc3RXaWRnZXREZXRhaWxzVmlzaWJsZS5zZXQoZmFsc2UpO1xuXHRcdFx0dGhpcy5fc2V0RGV0YWlsc1Zpc2libGUoZmFsc2UpO1xuXHRcdFx0dGhpcy5fZGV0YWlscy5oaWRlKCk7XG5cdFx0XHR0aGlzLmVsZW1lbnQuZG9tTm9kZS5jbGFzc0xpc3QucmVtb3ZlKCdzaG93cy1kZXRhaWxzJyk7XG5cblx0XHR9IGVsc2UgaWYgKChjYW5FeHBhbmRDb21wbGV0aW9uSXRlbSh0aGlzLl9saXN0LmdldEZvY3VzZWRFbGVtZW50cygpWzBdKSB8fCB0aGlzLl9leHBsYWluTW9kZSkgJiYgKHRoaXMuX3N0YXRlID09PSBTdGF0ZS5PcGVuIHx8IHRoaXMuX3N0YXRlID09PSBTdGF0ZS5EZXRhaWxzIHx8IHRoaXMuX3N0YXRlID09PSBTdGF0ZS5Gcm96ZW4pKSB7XG5cdFx0XHQvLyBzaG93IGRldGFpbHMgd2lkZ2V0IChpZmYgcG9zc2libGUpXG5cdFx0XHR0aGlzLl9jdHhTdWdnZXN0V2lkZ2V0RGV0YWlsc1Zpc2libGUuc2V0KHRydWUpO1xuXHRcdFx0dGhpcy5fc2V0RGV0YWlsc1Zpc2libGUodHJ1ZSk7XG5cdFx0XHR0aGlzLl9zaG93RGV0YWlscyhmYWxzZSwgZm9jdXNlZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfc2hvd0RldGFpbHMobG9hZGluZzogYm9vbGVhbiwgZm9jdXNlZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX3BlbmRpbmdTaG93RGV0YWlscy52YWx1ZSA9IGRvbS5ydW5BdFRoaXNPclNjaGVkdWxlQXROZXh0QW5pbWF0aW9uRnJhbWUoZG9tLmdldFdpbmRvdyh0aGlzLmVsZW1lbnQuZG9tTm9kZSksICgpID0+IHtcblx0XHRcdHRoaXMuX3BlbmRpbmdTaG93RGV0YWlscy5jbGVhcigpO1xuXHRcdFx0dGhpcy5fZGV0YWlscy5zaG93KCk7XG5cdFx0XHRsZXQgZGlkRm9jdXNEZXRhaWxzID0gZmFsc2U7XG5cdFx0XHRpZiAobG9hZGluZykge1xuXHRcdFx0XHR0aGlzLl9kZXRhaWxzLndpZGdldC5yZW5kZXJMb2FkaW5nKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9kZXRhaWxzLndpZGdldC5yZW5kZXJJdGVtKHRoaXMuX2xpc3QuZ2V0Rm9jdXNlZEVsZW1lbnRzKClbMF0sIHRoaXMuX2V4cGxhaW5Nb2RlKTtcblx0XHRcdH1cblx0XHRcdGlmICghdGhpcy5fZGV0YWlscy53aWRnZXQuaXNFbXB0eSkge1xuXHRcdFx0XHR0aGlzLl9wb3NpdGlvbkRldGFpbHMoKTtcblx0XHRcdFx0dGhpcy5lbGVtZW50LmRvbU5vZGUuY2xhc3NMaXN0LmFkZCgnc2hvd3MtZGV0YWlscycpO1xuXHRcdFx0XHRpZiAoZm9jdXNlZCkge1xuXHRcdFx0XHRcdHRoaXMuX2RldGFpbHMud2lkZ2V0LmZvY3VzKCk7XG5cdFx0XHRcdFx0ZGlkRm9jdXNEZXRhaWxzID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fZGV0YWlscy5oaWRlKCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIWRpZEZvY3VzRGV0YWlscykge1xuXHRcdFx0XHR0aGlzLmVkaXRvci5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0dG9nZ2xlRXhwbGFpbk1vZGUoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2xpc3QuZ2V0Rm9jdXNlZEVsZW1lbnRzKClbMF0pIHtcblx0XHRcdHRoaXMuX2V4cGxhaW5Nb2RlID0gIXRoaXMuX2V4cGxhaW5Nb2RlO1xuXHRcdFx0aWYgKCF0aGlzLl9pc0RldGFpbHNWaXNpYmxlKCkpIHtcblx0XHRcdFx0dGhpcy50b2dnbGVEZXRhaWxzKCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLl9zaG93RGV0YWlscyhmYWxzZSwgZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHJlc2V0UGVyc2lzdGVkU2l6ZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9wZXJzaXN0ZWRTaXplLnJlc2V0KCk7XG5cdH1cblxuXHRoaWRlV2lkZ2V0KCk6IHZvaWQge1xuXHRcdHRoaXMuX3BlbmRpbmdMYXlvdXQuY2xlYXIoKTtcblx0XHR0aGlzLl9wZW5kaW5nU2hvd0RldGFpbHMuY2xlYXIoKTtcblx0XHR0aGlzLl9sb2FkaW5nVGltZW91dD8uZGlzcG9zZSgpO1xuXG5cdFx0dGhpcy5fc2V0U3RhdGUoU3RhdGUuSGlkZGVuKTtcblx0XHR0aGlzLl9vbkRpZEhpZGUuZmlyZSh0aGlzKTtcblx0XHR0aGlzLmVsZW1lbnQuY2xlYXJTYXNoSG92ZXJTdGF0ZSgpO1xuXG5cdFx0Ly8gZW5zdXJlIHRoYXQgYSByZWFzb25hYmxlIHdpZGdldCBoZWlnaHQgaXMgcGVyc2lzdGVkIHNvIHRoYXRcblx0XHQvLyBhY2NpZGVudGlhbCBcInJlc2l6ZS10by1zaW5nbGUtaXRlbXNcIiBjYXNlcyBhcmVuJ3QgaGFwcGVuaW5nXG5cdFx0Y29uc3QgZGltID0gdGhpcy5fcGVyc2lzdGVkU2l6ZS5yZXN0b3JlKCk7XG5cdFx0Y29uc3QgbWluUGVyc2lzdGVkSGVpZ2h0ID0gTWF0aC5jZWlsKHRoaXMuZ2V0TGF5b3V0SW5mbygpLml0ZW1IZWlnaHQgKiA0LjMpO1xuXHRcdGlmIChkaW0gJiYgZGltLmhlaWdodCA8IG1pblBlcnNpc3RlZEhlaWdodCkge1xuXHRcdFx0dGhpcy5fcGVyc2lzdGVkU2l6ZS5zdG9yZShkaW0ud2l0aCh1bmRlZmluZWQsIG1pblBlcnNpc3RlZEhlaWdodCkpO1xuXHRcdH1cblx0fVxuXG5cdGlzRnJvemVuKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9zdGF0ZSA9PT0gU3RhdGUuRnJvemVuO1xuXHR9XG5cblx0X2FmdGVyUmVuZGVyKHBvc2l0aW9uOiBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlIHwgbnVsbCkge1xuXHRcdGlmIChwb3NpdGlvbiA9PT0gbnVsbCkge1xuXHRcdFx0aWYgKHRoaXMuX2lzRGV0YWlsc1Zpc2libGUoKSkge1xuXHRcdFx0XHR0aGlzLl9kZXRhaWxzLmhpZGUoKTsgLy90b2RvQGpyaWVrZW4gc29mdC1oaWRlXG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9zdGF0ZSA9PT0gU3RhdGUuRW1wdHkgfHwgdGhpcy5fc3RhdGUgPT09IFN0YXRlLkxvYWRpbmcpIHtcblx0XHRcdC8vIG5vIHNwZWNpYWwgcG9zaXRpb25pbmcgd2hlbiB3aWRnZXQgaXNuJ3Qgc2hvd2luZyBsaXN0XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9pc0RldGFpbHNWaXNpYmxlKCkgJiYgIXRoaXMuX2RldGFpbHMud2lkZ2V0LmlzRW1wdHkpIHtcblx0XHRcdHRoaXMuX2RldGFpbHMuc2hvdygpO1xuXHRcdH1cblx0XHR0aGlzLl9wb3NpdGlvbkRldGFpbHMoKTtcblx0fVxuXG5cdHByaXZhdGUgX2xheW91dChzaXplOiBkb20uRGltZW5zaW9uIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICghdGhpcy5lZGl0b3IuZ2V0RG9tTm9kZSgpKSB7XG5cdFx0XHQvLyBoYXBwZW5zIHdoZW4gcnVubmluZyB0ZXN0c1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGJvZHlCb3ggPSBkb20uZ2V0Q2xpZW50QXJlYSh0aGlzLmVsZW1lbnQuZG9tTm9kZS5vd25lckRvY3VtZW50LmJvZHkpO1xuXHRcdGNvbnN0IGluZm8gPSB0aGlzLmdldExheW91dEluZm8oKTtcblxuXHRcdGlmICghc2l6ZSkge1xuXHRcdFx0c2l6ZSA9IGluZm8uZGVmYXVsdFNpemU7XG5cdFx0fVxuXG5cdFx0bGV0IGhlaWdodCA9IHNpemUuaGVpZ2h0O1xuXHRcdGxldCB3aWR0aCA9IHNpemUud2lkdGg7XG5cblx0XHQvLyBzdGF0dXMgYmFyXG5cdFx0dGhpcy5fc3RhdHVzLmVsZW1lbnQuc3R5bGUuaGVpZ2h0ID0gYCR7aW5mby5pdGVtSGVpZ2h0fXB4YDtcblxuXHRcdGlmICh0aGlzLl9zdGF0ZSA9PT0gU3RhdGUuRW1wdHkgfHwgdGhpcy5fc3RhdGUgPT09IFN0YXRlLkxvYWRpbmcpIHtcblx0XHRcdC8vIHNob3dpbmcgYSBtZXNzYWdlIG9ubHlcblx0XHRcdGhlaWdodCA9IGluZm8uaXRlbUhlaWdodCArIGluZm8uYm9yZGVySGVpZ2h0O1xuXHRcdFx0d2lkdGggPSBpbmZvLmRlZmF1bHRTaXplLndpZHRoIC8gMjtcblx0XHRcdHRoaXMuZWxlbWVudC5lbmFibGVTYXNoZXMoZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuXHRcdFx0dGhpcy5lbGVtZW50Lm1pblNpemUgPSB0aGlzLmVsZW1lbnQubWF4U2l6ZSA9IG5ldyBkb20uRGltZW5zaW9uKHdpZHRoLCBoZWlnaHQpO1xuXHRcdFx0dGhpcy5fY29udGVudFdpZGdldC5zZXRQcmVmZXJlbmNlKENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuQkVMT1cpO1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIHNob3dpbmcgaXRlbXNcblxuXHRcdFx0Ly8gd2lkdGggbWF0aFxuXHRcdFx0Y29uc3QgbWF4V2lkdGggPSBib2R5Qm94LndpZHRoIC0gaW5mby5ib3JkZXJIZWlnaHQgLSAyICogaW5mby5ob3Jpem9udGFsUGFkZGluZztcblx0XHRcdGlmICh3aWR0aCA+IG1heFdpZHRoKSB7XG5cdFx0XHRcdHdpZHRoID0gbWF4V2lkdGg7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBwcmVmZXJyZWRXaWR0aCA9IHRoaXMuX2NvbXBsZXRpb25Nb2RlbCA/IHRoaXMuX2NvbXBsZXRpb25Nb2RlbC5zdGF0cy5wTGFiZWxMZW4gKiBpbmZvLnR5cGljYWxIYWxmd2lkdGhDaGFyYWN0ZXJXaWR0aCA6IHdpZHRoO1xuXG5cdFx0XHQvLyBoZWlnaHQgbWF0aFxuXHRcdFx0Y29uc3QgZnVsbEhlaWdodCA9IGluZm8uc3RhdHVzQmFySGVpZ2h0ICsgdGhpcy5fbGlzdC5jb250ZW50SGVpZ2h0ICsgaW5mby5ib3JkZXJIZWlnaHQ7XG5cdFx0XHRjb25zdCBtaW5IZWlnaHQgPSBpbmZvLml0ZW1IZWlnaHQgKyBpbmZvLnN0YXR1c0JhckhlaWdodDtcblx0XHRcdGNvbnN0IGVkaXRvckJveCA9IGRvbS5nZXREb21Ob2RlUGFnZVBvc2l0aW9uKHRoaXMuZWRpdG9yLmdldERvbU5vZGUoKSk7XG5cdFx0XHRjb25zdCBjdXJzb3JCb3ggPSB0aGlzLmVkaXRvci5nZXRTY3JvbGxlZFZpc2libGVQb3NpdGlvbih0aGlzLmVkaXRvci5nZXRQb3NpdGlvbigpKTtcblx0XHRcdGNvbnN0IGN1cnNvckJvdHRvbSA9IGVkaXRvckJveC50b3AgKyBjdXJzb3JCb3gudG9wICsgY3Vyc29yQm94LmhlaWdodDtcblx0XHRcdGNvbnN0IG1heEhlaWdodEJlbG93ID0gTWF0aC5taW4oYm9keUJveC5oZWlnaHQgLSBjdXJzb3JCb3R0b20gLSBpbmZvLnZlcnRpY2FsUGFkZGluZywgZnVsbEhlaWdodCk7XG5cdFx0XHRjb25zdCBhdmFpbGFibGVTcGFjZUFib3ZlID0gZWRpdG9yQm94LnRvcCArIGN1cnNvckJveC50b3AgLSBpbmZvLnZlcnRpY2FsUGFkZGluZztcblx0XHRcdGNvbnN0IG1heEhlaWdodEFib3ZlID0gTWF0aC5taW4oYXZhaWxhYmxlU3BhY2VBYm92ZSwgZnVsbEhlaWdodCk7XG5cdFx0XHRsZXQgbWF4SGVpZ2h0ID0gTWF0aC5taW4oTWF0aC5tYXgobWF4SGVpZ2h0QWJvdmUsIG1heEhlaWdodEJlbG93KSArIGluZm8uYm9yZGVySGVpZ2h0LCBmdWxsSGVpZ2h0KTtcblxuXHRcdFx0aWYgKGhlaWdodCA9PT0gdGhpcy5fY2FwcGVkSGVpZ2h0Py5jYXBwZWQpIHtcblx0XHRcdFx0Ly8gUmVzdG9yZSB0aGUgb2xkICh3YW50ZWQpIGhlaWdodCB3aGVuIHRoZSBjdXJyZW50XG5cdFx0XHRcdC8vIGhlaWdodCBpcyBjYXBwZWQgdG8gZml0XG5cdFx0XHRcdGhlaWdodCA9IHRoaXMuX2NhcHBlZEhlaWdodC53YW50ZWQ7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChoZWlnaHQgPCBtaW5IZWlnaHQpIHtcblx0XHRcdFx0aGVpZ2h0ID0gbWluSGVpZ2h0O1xuXHRcdFx0fVxuXHRcdFx0aWYgKGhlaWdodCA+IG1heEhlaWdodCkge1xuXHRcdFx0XHRoZWlnaHQgPSBtYXhIZWlnaHQ7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGZvcmNlUmVuZGVyaW5nQWJvdmVSZXF1aXJlZFNwYWNlID0gMTUwO1xuXHRcdFx0aWYgKGhlaWdodCA+IG1heEhlaWdodEJlbG93IHx8ICh0aGlzLl9mb3JjZVJlbmRlcmluZ0Fib3ZlICYmIGF2YWlsYWJsZVNwYWNlQWJvdmUgPiBmb3JjZVJlbmRlcmluZ0Fib3ZlUmVxdWlyZWRTcGFjZSkpIHtcblx0XHRcdFx0dGhpcy5fY29udGVudFdpZGdldC5zZXRQcmVmZXJlbmNlKENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuQUJPVkUpO1xuXHRcdFx0XHR0aGlzLmVsZW1lbnQuZW5hYmxlU2FzaGVzKHRydWUsIHRydWUsIGZhbHNlLCBmYWxzZSk7XG5cdFx0XHRcdG1heEhlaWdodCA9IG1heEhlaWdodEFib3ZlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fY29udGVudFdpZGdldC5zZXRQcmVmZXJlbmNlKENvbnRlbnRXaWRnZXRQb3NpdGlvblByZWZlcmVuY2UuQkVMT1cpO1xuXHRcdFx0XHR0aGlzLmVsZW1lbnQuZW5hYmxlU2FzaGVzKGZhbHNlLCB0cnVlLCB0cnVlLCBmYWxzZSk7XG5cdFx0XHRcdG1heEhlaWdodCA9IG1heEhlaWdodEJlbG93O1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5lbGVtZW50LnByZWZlcnJlZFNpemUgPSBuZXcgZG9tLkRpbWVuc2lvbihwcmVmZXJyZWRXaWR0aCwgaW5mby5kZWZhdWx0U2l6ZS5oZWlnaHQpO1xuXHRcdFx0dGhpcy5lbGVtZW50Lm1heFNpemUgPSBuZXcgZG9tLkRpbWVuc2lvbihtYXhXaWR0aCwgbWF4SGVpZ2h0KTtcblx0XHRcdHRoaXMuZWxlbWVudC5taW5TaXplID0gbmV3IGRvbS5EaW1lbnNpb24oMjIwLCBtaW5IZWlnaHQpO1xuXG5cdFx0XHQvLyBLbm93IHdoZW4gdGhlIGhlaWdodCB3YXMgY2FwcGVkIHRvIGZpdCBhbmQgcmVtZW1iZXJcblx0XHRcdC8vIHRoZSB3YW50ZWQgaGVpZ2h0IGZvciBsYXRlci4gVGhpcyBpcyByZXF1aXJlZCB3aGVuIGdvaW5nXG5cdFx0XHQvLyBsZWZ0IHRvIHdpZGVuIHN1Z2dlc3Rpb25zLlxuXHRcdFx0dGhpcy5fY2FwcGVkSGVpZ2h0ID0gaGVpZ2h0ID09PSBmdWxsSGVpZ2h0XG5cdFx0XHRcdD8geyB3YW50ZWQ6IHRoaXMuX2NhcHBlZEhlaWdodD8ud2FudGVkID8/IHNpemUuaGVpZ2h0LCBjYXBwZWQ6IGhlaWdodCB9XG5cdFx0XHRcdDogdW5kZWZpbmVkO1xuXHRcdH1cblx0XHR0aGlzLl9yZXNpemUod2lkdGgsIGhlaWdodCk7XG5cdH1cblxuXHRwcml2YXRlIF9yZXNpemUod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpOiB2b2lkIHtcblxuXHRcdGNvbnN0IHsgd2lkdGg6IG1heFdpZHRoLCBoZWlnaHQ6IG1heEhlaWdodCB9ID0gdGhpcy5lbGVtZW50Lm1heFNpemU7XG5cdFx0d2lkdGggPSBNYXRoLm1pbihtYXhXaWR0aCwgd2lkdGgpO1xuXHRcdGhlaWdodCA9IE1hdGgubWluKG1heEhlaWdodCwgaGVpZ2h0KTtcblxuXHRcdGNvbnN0IHsgc3RhdHVzQmFySGVpZ2h0IH0gPSB0aGlzLmdldExheW91dEluZm8oKTtcblx0XHR0aGlzLl9saXN0LmxheW91dChoZWlnaHQgLSBzdGF0dXNCYXJIZWlnaHQsIHdpZHRoKTtcblx0XHR0aGlzLl9saXN0RWxlbWVudC5zdHlsZS5oZWlnaHQgPSBgJHtoZWlnaHQgLSBzdGF0dXNCYXJIZWlnaHR9cHhgO1xuXHRcdHRoaXMuZWxlbWVudC5sYXlvdXQoaGVpZ2h0LCB3aWR0aCk7XG5cdFx0dGhpcy5fY29udGVudFdpZGdldC5sYXlvdXQoKTtcblxuXHRcdHRoaXMuX3Bvc2l0aW9uRGV0YWlscygpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcG9zaXRpb25EZXRhaWxzKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9pc0RldGFpbHNWaXNpYmxlKCkpIHtcblx0XHRcdHRoaXMuX2RldGFpbHMucGxhY2VBdEFuY2hvcih0aGlzLmVsZW1lbnQuZG9tTm9kZSwgdGhpcy5fY29udGVudFdpZGdldC5nZXRQb3NpdGlvbigpPy5wcmVmZXJlbmNlWzBdID09PSBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlLkJFTE9XKTtcblx0XHR9XG5cdH1cblxuXHRnZXRMYXlvdXRJbmZvKCkge1xuXHRcdGNvbnN0IGZvbnRJbmZvID0gdGhpcy5lZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5mb250SW5mbyk7XG5cdFx0Y29uc3QgaXRlbUhlaWdodCA9IGNsYW1wKHRoaXMuZWRpdG9yLmdldE9wdGlvbihFZGl0b3JPcHRpb24uc3VnZ2VzdExpbmVIZWlnaHQpIHx8IGZvbnRJbmZvLmxpbmVIZWlnaHQsIDgsIDEwMDApO1xuXHRcdGNvbnN0IHN0YXR1c0JhckhlaWdodCA9ICF0aGlzLmVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnN1Z2dlc3QpLnNob3dTdGF0dXNCYXIgfHwgdGhpcy5fc3RhdGUgPT09IFN0YXRlLkVtcHR5IHx8IHRoaXMuX3N0YXRlID09PSBTdGF0ZS5Mb2FkaW5nID8gMCA6IGl0ZW1IZWlnaHQ7XG5cdFx0Y29uc3QgYm9yZGVyV2lkdGggPSB0aGlzLl9kZXRhaWxzLndpZGdldC5ib3JkZXJXaWR0aDtcblx0XHRjb25zdCBib3JkZXJIZWlnaHQgPSAyICogYm9yZGVyV2lkdGg7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0aXRlbUhlaWdodCxcblx0XHRcdHN0YXR1c0JhckhlaWdodCxcblx0XHRcdGJvcmRlcldpZHRoLFxuXHRcdFx0Ym9yZGVySGVpZ2h0LFxuXHRcdFx0dHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoOiBmb250SW5mby50eXBpY2FsSGFsZndpZHRoQ2hhcmFjdGVyV2lkdGgsXG5cdFx0XHR2ZXJ0aWNhbFBhZGRpbmc6IDIyLFxuXHRcdFx0aG9yaXpvbnRhbFBhZGRpbmc6IDE0LFxuXHRcdFx0ZGVmYXVsdFNpemU6IG5ldyBkb20uRGltZW5zaW9uKDQzMCwgc3RhdHVzQmFySGVpZ2h0ICsgMTIgKiBpdGVtSGVpZ2h0KVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIF9pc0RldGFpbHNWaXNpYmxlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9zdG9yYWdlU2VydmljZS5nZXRCb29sZWFuKCdleHBhbmRTdWdnZXN0aW9uRG9jcycsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBmYWxzZSk7XG5cdH1cblxuXHRwcml2YXRlIF9zZXREZXRhaWxzVmlzaWJsZSh2YWx1ZTogYm9vbGVhbikge1xuXHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnN0b3JlKCdleHBhbmRTdWdnZXN0aW9uRG9jcycsIHZhbHVlLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0fVxuXG5cdGZvcmNlUmVuZGVyaW5nQWJvdmUoKSB7XG5cdFx0aWYgKCF0aGlzLl9mb3JjZVJlbmRlcmluZ0Fib3ZlKSB7XG5cdFx0XHR0aGlzLl9mb3JjZVJlbmRlcmluZ0Fib3ZlID0gdHJ1ZTtcblx0XHRcdHRoaXMuX2xheW91dCh0aGlzLl9wZXJzaXN0ZWRTaXplLnJlc3RvcmUoKSk7XG5cdFx0fVxuXHR9XG5cblx0c3RvcEZvcmNlUmVuZGVyaW5nQWJvdmUoKSB7XG5cdFx0dGhpcy5fZm9yY2VSZW5kZXJpbmdBYm92ZSA9IGZhbHNlO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTdWdnZXN0Q29udGVudFdpZGdldCBpbXBsZW1lbnRzIElDb250ZW50V2lkZ2V0IHtcblxuXHRyZWFkb25seSBhbGxvd0VkaXRvck92ZXJmbG93ID0gdHJ1ZTtcblx0cmVhZG9ubHkgc3VwcHJlc3NNb3VzZURvd24gPSBmYWxzZTtcblxuXHRwcml2YXRlIF9wb3NpdGlvbj86IElQb3NpdGlvbiB8IG51bGw7XG5cdHByaXZhdGUgX3ByZWZlcmVuY2U/OiBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlO1xuXHRwcml2YXRlIF9wcmVmZXJlbmNlTG9ja2VkID0gZmFsc2U7XG5cblx0cHJpdmF0ZSBfYWRkZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfaGlkZGVuOiBib29sZWFuID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfd2lkZ2V0OiBTdWdnZXN0V2lkZ2V0LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3Jcblx0KSB7IH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9hZGRlZCkge1xuXHRcdFx0dGhpcy5fYWRkZWQgPSBmYWxzZTtcblx0XHRcdHRoaXMuX2VkaXRvci5yZW1vdmVDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHRcdH1cblx0fVxuXG5cdGdldElkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuICdlZGl0b3Iud2lkZ2V0LnN1Z2dlc3RXaWRnZXQnO1xuXHR9XG5cblx0Z2V0RG9tTm9kZSgpOiBIVE1MRWxlbWVudCB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpZGdldC5lbGVtZW50LmRvbU5vZGU7XG5cdH1cblxuXHRzaG93KCk6IHZvaWQge1xuXHRcdHRoaXMuX2hpZGRlbiA9IGZhbHNlO1xuXHRcdGlmICghdGhpcy5fYWRkZWQpIHtcblx0XHRcdHRoaXMuX2FkZGVkID0gdHJ1ZTtcblx0XHRcdHRoaXMuX2VkaXRvci5hZGRDb250ZW50V2lkZ2V0KHRoaXMpO1xuXHRcdH1cblx0fVxuXG5cdGhpZGUoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9oaWRkZW4pIHtcblx0XHRcdHRoaXMuX2hpZGRlbiA9IHRydWU7XG5cdFx0XHR0aGlzLmxheW91dCgpO1xuXHRcdH1cblx0fVxuXG5cdGxheW91dCgpOiB2b2lkIHtcblx0XHR0aGlzLl9lZGl0b3IubGF5b3V0Q29udGVudFdpZGdldCh0aGlzKTtcblx0fVxuXG5cdGdldFBvc2l0aW9uKCk6IElDb250ZW50V2lkZ2V0UG9zaXRpb24gfCBudWxsIHtcblx0XHRpZiAodGhpcy5faGlkZGVuIHx8ICF0aGlzLl9wb3NpdGlvbiB8fCAhdGhpcy5fcHJlZmVyZW5jZSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRwb3NpdGlvbjogdGhpcy5fcG9zaXRpb24sXG5cdFx0XHRwcmVmZXJlbmNlOiBbdGhpcy5fcHJlZmVyZW5jZV1cblx0XHR9O1xuXHR9XG5cblx0YmVmb3JlUmVuZGVyKCkge1xuXHRcdGNvbnN0IHsgaGVpZ2h0LCB3aWR0aCB9ID0gdGhpcy5fd2lkZ2V0LmVsZW1lbnQuc2l6ZTtcblx0XHRjb25zdCB7IGJvcmRlcldpZHRoLCBob3Jpem9udGFsUGFkZGluZyB9ID0gdGhpcy5fd2lkZ2V0LmdldExheW91dEluZm8oKTtcblx0XHRyZXR1cm4gbmV3IGRvbS5EaW1lbnNpb24od2lkdGggKyAyICogYm9yZGVyV2lkdGggKyBob3Jpem9udGFsUGFkZGluZywgaGVpZ2h0ICsgMiAqIGJvcmRlcldpZHRoKTtcblx0fVxuXG5cdGFmdGVyUmVuZGVyKHBvc2l0aW9uOiBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlIHwgbnVsbCkge1xuXHRcdHRoaXMuX3dpZGdldC5fYWZ0ZXJSZW5kZXIocG9zaXRpb24pO1xuXHR9XG5cblx0c2V0UHJlZmVyZW5jZShwcmVmZXJlbmNlOiBDb250ZW50V2lkZ2V0UG9zaXRpb25QcmVmZXJlbmNlKSB7XG5cdFx0aWYgKCF0aGlzLl9wcmVmZXJlbmNlTG9ja2VkKSB7XG5cdFx0XHR0aGlzLl9wcmVmZXJlbmNlID0gcHJlZmVyZW5jZTtcblx0XHR9XG5cdH1cblxuXHRsb2NrUHJlZmVyZW5jZSgpIHtcblx0XHR0aGlzLl9wcmVmZXJlbmNlTG9ja2VkID0gdHJ1ZTtcblx0fVxuXG5cdHVubG9ja1ByZWZlcmVuY2UoKSB7XG5cdFx0dGhpcy5fcHJlZmVyZW5jZUxvY2tlZCA9IGZhbHNlO1xuXHR9XG5cblx0c2V0UG9zaXRpb24ocG9zaXRpb246IElQb3NpdGlvbiB8IG51bGwpOiB2b2lkIHtcblx0XHR0aGlzLl9wb3NpdGlvbiA9IHBvc2l0aW9uO1xuXHR9XG59XG5cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBRXJCLE9BQU87QUFFUCxTQUFTLFlBQVk7QUFDckIsU0FBNEIseUJBQXlCLG1CQUFtQixvQkFBb0I7QUFDNUYsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxTQUFnQix3QkFBd0I7QUFDakQsU0FBUyxpQkFBOEIseUJBQXlCO0FBQ2hFLFNBQVMsYUFBYTtBQUN0QixZQUFZLGFBQWE7QUFDekIsT0FBTztBQUNQLFNBQVMsdUNBQStHO0FBQ3hILFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsMkJBQTJCO0FBQ3BDLE9BQU87QUFDUCxZQUFZLFNBQVM7QUFDckIsU0FBc0IsMEJBQTBCO0FBQ2hELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMsc0JBQXNCLGtCQUFrQix3QkFBd0Isb0JBQW9CLDhCQUE4Qix5QkFBeUIsK0JBQStCLCtCQUErQixtQ0FBbUMsZUFBZSxtQkFBbUI7QUFDdlIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBc0IscUJBQXFCO0FBRTNDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQXlCLFdBQVcsZ0JBQWdCLGtDQUFrQztBQUN0RixTQUFTLHlCQUF5Qix1QkFBdUIsNEJBQTRCO0FBQ3JGLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsY0FBYztBQUN2QixTQUFTLDJCQUEyQjtBQUtwQyxjQUFjLGtDQUFrQyx3QkFBd0IsSUFBSSxTQUFTLGlDQUFpQyx5Q0FBeUMsQ0FBQztBQUNoSyxjQUFjLDhCQUE4QixvQkFBb0IsSUFBSSxTQUFTLDZCQUE2QixxQ0FBcUMsQ0FBQztBQUNoSixNQUFNLGdDQUFnQyxjQUFjLGtDQUFrQyxr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
