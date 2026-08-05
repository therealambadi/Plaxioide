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
import { StandardMouseEvent } from "../../../../base/browser/mouseEvent.js";
import { PixelRatio } from "../../../../base/browser/pixelRatio.js";
import { BreadcrumbsItem, BreadcrumbsWidget } from "../../../../base/browser/ui/breadcrumbs/breadcrumbsWidget.js";
import { applyDragImage } from "../../../../base/browser/ui/dnd/dnd.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { timeout } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { combinedDisposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { basename, extUri } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { OutlineElement } from "../../../../editor/contrib/documentSymbols/browser/outlineModel.js";
import { localize, localize2 } from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { fillInSymbolsDragData, LocalSelectionTransfer } from "../../../../platform/dnd/browser/dnd.js";
import { FileKind, IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IListService, WorkbenchAsyncDataTree, WorkbenchDataTree, WorkbenchListFocusContextKey } from "../../../../platform/list/browser/listService.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { defaultBreadcrumbsWidgetStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../common/editor.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { DraggedEditorIdentifier, fillEditorsDragData } from "../../dnd.js";
import { DEFAULT_LABELS_CONTAINER, ResourceLabels } from "../../labels.js";
import { BreadcrumbsConfig, IBreadcrumbsService } from "./breadcrumbs.js";
import { BreadcrumbsModel, FileElement, OutlineElement2 } from "./breadcrumbsModel.js";
import { BreadcrumbsFilePicker, BreadcrumbsOutlinePicker } from "./breadcrumbsPicker.js";
import "./media/breadcrumbscontrol.css";
let OutlineItem = class extends BreadcrumbsItem {
  constructor(model, element, options, _instantiationService) {
    super();
    this.model = model;
    this.element = element;
    this.options = options;
    this._instantiationService = _instantiationService;
    this._disposables = new DisposableStore();
  }
  dispose() {
    this._disposables.dispose();
  }
  equals(other) {
    if (!(other instanceof OutlineItem)) {
      return false;
    }
    return this.element.element === other.element.element && this.options.showFileIcons === other.options.showFileIcons && this.options.showSymbolIcons === other.options.showSymbolIcons;
  }
  render(container) {
    const { element, outline } = this.element;
    if (element === outline) {
      const element2 = dom.$("span", void 0, "\u2026");
      container.appendChild(element2);
      return;
    }
    const templateId = outline.config.delegate.getTemplateId(element);
    const renderer = outline.config.renderers.find((renderer2) => renderer2.templateId === templateId);
    if (!renderer) {
      container.innerText = "<<NO RENDERER>>";
      return;
    }
    const template = renderer.renderTemplate(container);
    renderer.renderElement({
      element,
      children: [],
      depth: 0,
      visibleChildrenCount: 0,
      visibleChildIndex: 0,
      collapsible: false,
      collapsed: false,
      visible: true,
      filterData: void 0
    }, 0, template, void 0);
    this._disposables.add(toDisposable(() => {
      renderer.disposeTemplate(template);
    }));
    if (element instanceof OutlineElement && outline.uri) {
      this._disposables.add(this._instantiationService.invokeFunction((accessor) => createBreadcrumbDndObserver(accessor, container, element.symbol.name, { symbol: element.symbol, uri: outline.uri }, this.model, this.options.dragEditor)));
    }
  }
};
OutlineItem = __decorateClass([
  __decorateParam(3, IInstantiationService)
], OutlineItem);
let FileItem = class extends BreadcrumbsItem {
  constructor(model, element, options, _labels, _hoverDelegate, _instantiationService) {
    super();
    this.model = model;
    this.element = element;
    this.options = options;
    this._labels = _labels;
    this._hoverDelegate = _hoverDelegate;
    this._instantiationService = _instantiationService;
    this._disposables = new DisposableStore();
  }
  dispose() {
    this._disposables.dispose();
  }
  equals(other) {
    if (!(other instanceof FileItem)) {
      return false;
    }
    return extUri.isEqual(this.element.uri, other.element.uri) && this.options.showFileIcons === other.options.showFileIcons && this.options.showSymbolIcons === other.options.showSymbolIcons;
  }
  render(container) {
    const label = this._labels.create(container, { hoverDelegate: this._hoverDelegate });
    label.setFile(this.element.uri, {
      hidePath: true,
      hideIcon: this.element.kind === FileKind.FOLDER || !this.options.showFileIcons,
      fileKind: this.element.kind,
      fileDecorations: { colors: this.options.showDecorationColors, badges: false }
    });
    container.classList.add(FileKind[this.element.kind].toLowerCase());
    this._disposables.add(label);
    this._disposables.add(this._instantiationService.invokeFunction((accessor) => createBreadcrumbDndObserver(accessor, container, basename(this.element.uri), this.element.uri, this.model, this.options.dragEditor)));
  }
};
FileItem = __decorateClass([
  __decorateParam(5, IInstantiationService)
], FileItem);
function createBreadcrumbDndObserver(accessor, container, label, item, model, dragEditor) {
  const instantiationService = accessor.get(IInstantiationService);
  container.draggable = true;
  return new dom.DragAndDropObserver(container, {
    onDragStart: (event) => {
      if (!event.dataTransfer) {
        return;
      }
      event.dataTransfer.effectAllowed = "copyMove";
      instantiationService.invokeFunction((accessor2) => {
        if (URI.isUri(item)) {
          fillEditorsDragData(accessor2, [item], event);
        } else {
          fillEditorsDragData(accessor2, [{ resource: item.uri, selection: item.symbol.range }], event);
          fillInSymbolsDragData([{
            name: item.symbol.name,
            fsPath: item.uri.fsPath,
            range: item.symbol.range,
            kind: item.symbol.kind
          }], event);
        }
        if (dragEditor && model.editor && model.editor?.input) {
          const editorTransfer = LocalSelectionTransfer.getInstance();
          editorTransfer.setData([new DraggedEditorIdentifier({ editor: model.editor.input, groupId: model.editor.group.id })], DraggedEditorIdentifier.prototype);
        }
      });
      applyDragImage(event, container, label);
    }
  });
}
const separatorIcon = registerIcon("breadcrumb-separator", Codicon.chevronRight, localize("separatorIcon", "Icon for the separator in the breadcrumbs."));
let BreadcrumbsControl = class {
  constructor(container, _options, _editorGroup, _contextKeyService, _contextViewService, _instantiationService, _quickInputService, _fileService, _editorService, _labelService, configurationService, breadcrumbsService) {
    this._options = _options;
    this._editorGroup = _editorGroup;
    this._contextKeyService = _contextKeyService;
    this._contextViewService = _contextViewService;
    this._instantiationService = _instantiationService;
    this._quickInputService = _quickInputService;
    this._fileService = _fileService;
    this._editorService = _editorService;
    this._labelService = _labelService;
    this._disposables = new DisposableStore();
    this._breadcrumbsDisposables = new DisposableStore();
    this._model = new MutableDisposable();
    this._breadcrumbsPickerShowing = false;
    this._onDidVisibilityChange = this._disposables.add(new Emitter());
    this.domNode = document.createElement("div");
    this.domNode.classList.add("breadcrumbs-control");
    dom.append(container, this.domNode);
    this._cfUseQuickPick = BreadcrumbsConfig.UseQuickPick.bindTo(configurationService);
    this._cfShowIcons = BreadcrumbsConfig.Icons.bindTo(configurationService);
    this._cfTitleScrollbarSizing = BreadcrumbsConfig.TitleScrollbarSizing.bindTo(configurationService);
    this._labels = this._instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER);
    const sizing = this._cfTitleScrollbarSizing.getValue() ?? "default";
    const styles = _options.widgetStyles ?? defaultBreadcrumbsWidgetStyles;
    this._widget = new BreadcrumbsWidget(this.domNode, BreadcrumbsControl.SCROLLBAR_SIZES[sizing], separatorIcon, styles);
    this._widget.onDidSelectItem(this._onSelectEvent, this, this._disposables);
    this._widget.onDidFocusItem(this._onFocusEvent, this, this._disposables);
    this._widget.onDidChangeFocus(this._updateCkBreadcrumbsActive, this, this._disposables);
    this._ckBreadcrumbsPossible = BreadcrumbsControl.CK_BreadcrumbsPossible.bindTo(this._contextKeyService);
    this._ckBreadcrumbsVisible = BreadcrumbsControl.CK_BreadcrumbsVisible.bindTo(this._contextKeyService);
    this._ckBreadcrumbsActive = BreadcrumbsControl.CK_BreadcrumbsActive.bindTo(this._contextKeyService);
    this._hoverDelegate = getDefaultHoverDelegate("mouse");
    this._disposables.add(breadcrumbsService.register(this._editorGroup.id, this._widget));
    this.hide();
  }
  get onDidVisibilityChange() {
    return this._onDidVisibilityChange.event;
  }
  dispose() {
    this._disposables.dispose();
    this._breadcrumbsDisposables.dispose();
    this._ckBreadcrumbsPossible.reset();
    this._ckBreadcrumbsVisible.reset();
    this._ckBreadcrumbsActive.reset();
    this._cfUseQuickPick.dispose();
    this._cfShowIcons.dispose();
    this._widget.dispose();
    this._labels.dispose();
    this.domNode.remove();
  }
  get model() {
    return this._model.value;
  }
  layout(dim) {
    this._widget.layout(dim);
  }
  isHidden() {
    return this.domNode.classList.contains("hidden");
  }
  hide() {
    const wasHidden = this.isHidden();
    this._breadcrumbsDisposables.clear();
    this._ckBreadcrumbsVisible.set(false);
    this.domNode.classList.toggle("hidden", true);
    if (!wasHidden) {
      this._onDidVisibilityChange.fire();
    }
  }
  show() {
    const wasHidden = this.isHidden();
    this._ckBreadcrumbsVisible.set(true);
    this.domNode.classList.toggle("hidden", false);
    if (wasHidden) {
      this._onDidVisibilityChange.fire();
    }
  }
  revealLast() {
    this._widget.revealLast();
  }
  update() {
    this._breadcrumbsDisposables.clear();
    const uri = EditorResourceAccessor.getCanonicalUri(this._editorGroup.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    const wasHidden = this.isHidden();
    if (!uri || !this._fileService.hasProvider(uri)) {
      this._ckBreadcrumbsPossible.set(false);
      if (!wasHidden) {
        this.hide();
        return true;
      } else {
        return false;
      }
    }
    const fileInfoUri = EditorResourceAccessor.getOriginalUri(this._editorGroup.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    this.show();
    this._ckBreadcrumbsPossible.set(true);
    const model = this._instantiationService.createInstance(
      BreadcrumbsModel,
      fileInfoUri ?? uri,
      this._editorGroup.activeEditorPane
    );
    this._model.value = model;
    this.domNode.classList.toggle("backslash-path", this._labelService.getSeparator(uri.scheme, uri.authority) === "\\");
    const updateBreadcrumbs = () => {
      this.domNode.classList.toggle("relative-path", model.isRelative());
      const showIcons = this._cfShowIcons.getValue();
      const options = {
        ...this._options,
        showFileIcons: this._options.showFileIcons && showIcons,
        showSymbolIcons: this._options.showSymbolIcons && showIcons
      };
      const items = model.getElements().map((element) => element instanceof FileElement ? this._instantiationService.createInstance(FileItem, model, element, options, this._labels, this._hoverDelegate) : this._instantiationService.createInstance(OutlineItem, model, element, options));
      if (items.length === 0) {
        this._widget.setEnabled(false);
        this._widget.setItems([new class extends BreadcrumbsItem {
          render(container) {
            container.innerText = localize("empty", "no elements");
          }
          equals(other) {
            return other === this;
          }
          dispose() {
          }
        }()]);
      } else {
        this._widget.setEnabled(true);
        this._widget.setItems(items);
        this._widget.reveal(items[items.length - 1]);
      }
    };
    const listener = model.onDidUpdate(updateBreadcrumbs);
    const configListener = this._cfShowIcons.onDidChange(updateBreadcrumbs);
    updateBreadcrumbs();
    this._breadcrumbsDisposables.clear();
    this._breadcrumbsDisposables.add(listener);
    this._breadcrumbsDisposables.add(toDisposable(() => this._model.clear()));
    this._breadcrumbsDisposables.add(configListener);
    this._breadcrumbsDisposables.add(toDisposable(() => this._widget.setItems([])));
    const updateScrollbarSizing = () => {
      const sizing = this._cfTitleScrollbarSizing.getValue() ?? "default";
      this._widget.setHorizontalScrollbarSize(BreadcrumbsControl.SCROLLBAR_SIZES[sizing]);
    };
    updateScrollbarSizing();
    const updateScrollbarSizeListener = this._cfTitleScrollbarSizing.onDidChange(updateScrollbarSizing);
    this._breadcrumbsDisposables.add(updateScrollbarSizeListener);
    this._breadcrumbsDisposables.add({
      dispose: () => {
        if (this._breadcrumbsPickerShowing) {
          this._contextViewService.hideContextView({ source: this });
        }
      }
    });
    return wasHidden !== this.isHidden();
  }
  _onFocusEvent(event) {
    if (event.item && this._breadcrumbsPickerShowing) {
      this._breadcrumbsPickerIgnoreOnceItem = void 0;
      this._widget.setSelection(event.item);
    }
  }
  _onSelectEvent(event) {
    if (!event.item) {
      return;
    }
    if (event.item === this._breadcrumbsPickerIgnoreOnceItem) {
      this._breadcrumbsPickerIgnoreOnceItem = void 0;
      this._widget.setFocused(void 0);
      this._widget.setSelection(void 0);
      return;
    }
    const { element } = event.item;
    this._editorGroup.focus();
    const group = this._getEditorGroup(event.payload);
    if (group !== void 0) {
      this._widget.setFocused(void 0);
      this._widget.setSelection(void 0);
      this._revealInEditor(event, element, group);
      return;
    }
    if (this._cfUseQuickPick.getValue()) {
      this._widget.setFocused(void 0);
      this._widget.setSelection(void 0);
      this._quickInputService.quickAccess.show(element instanceof OutlineElement2 ? "@" : "");
      return;
    }
    let picker;
    let pickerAnchor;
    this._contextViewService.showContextView({
      render: (parent) => {
        if (event.item instanceof FileItem) {
          picker = this._instantiationService.createInstance(BreadcrumbsFilePicker, parent, event.item.model.resource);
        } else if (event.item instanceof OutlineItem) {
          picker = this._instantiationService.createInstance(BreadcrumbsOutlinePicker, parent, event.item.model.resource);
        }
        const selectListener = picker.onWillPickElement(() => this._contextViewService.hideContextView({ source: this, didPick: true }));
        const zoomListener = PixelRatio.getInstance(dom.getWindow(this.domNode)).onDidChange(() => this._contextViewService.hideContextView({ source: this }));
        const focusTracker = dom.trackFocus(parent);
        const blurListener = focusTracker.onDidBlur(() => {
          this._breadcrumbsPickerIgnoreOnceItem = this._widget.isDOMFocused() ? event.item : void 0;
          this._contextViewService.hideContextView({ source: this });
        });
        this._breadcrumbsPickerShowing = true;
        this._updateCkBreadcrumbsActive();
        return combinedDisposable(
          picker,
          selectListener,
          zoomListener,
          focusTracker,
          blurListener
        );
      },
      getAnchor: () => {
        if (!pickerAnchor) {
          const window = dom.getWindow(this.domNode);
          const maxInnerWidth = window.innerWidth - 8;
          let maxHeight = Math.min(window.innerHeight * 0.7, 300);
          const pickerWidth = Math.min(maxInnerWidth, Math.max(240, maxInnerWidth / 4.17));
          const pickerArrowSize = 8;
          let pickerArrowOffset;
          const data = dom.getDomNodePagePosition(event.node.firstChild);
          const y = data.top + data.height + pickerArrowSize;
          if (y + maxHeight >= window.innerHeight) {
            maxHeight = window.innerHeight - y - 30;
          }
          let x = data.left;
          if (x + pickerWidth >= maxInnerWidth) {
            x = maxInnerWidth - pickerWidth;
          }
          if (event.payload instanceof StandardMouseEvent) {
            const maxPickerArrowOffset = pickerWidth - 2 * pickerArrowSize;
            pickerArrowOffset = event.payload.posx - x;
            if (pickerArrowOffset > maxPickerArrowOffset) {
              x = Math.min(maxInnerWidth - pickerWidth, x + pickerArrowOffset - maxPickerArrowOffset);
              pickerArrowOffset = maxPickerArrowOffset;
            }
          } else {
            pickerArrowOffset = data.left + data.width * 0.3 - x;
          }
          picker.show(element, maxHeight, pickerWidth, pickerArrowSize, Math.max(0, pickerArrowOffset));
          pickerAnchor = { x, y };
        }
        return pickerAnchor;
      },
      onHide: (data) => {
        if (!data?.didPick) {
          picker.restoreViewState();
        }
        this._breadcrumbsPickerShowing = false;
        this._updateCkBreadcrumbsActive();
        if (data?.source === this) {
          this._widget.setFocused(void 0);
          this._widget.setSelection(void 0);
        }
        picker.dispose();
      }
    });
  }
  _updateCkBreadcrumbsActive() {
    const value = this._widget.isDOMFocused() || this._breadcrumbsPickerShowing;
    this._ckBreadcrumbsActive.set(value);
  }
  async _revealInEditor(event, element, group, pinned = false) {
    if (element instanceof FileElement) {
      if (element.kind === FileKind.FILE) {
        await this._editorService.openEditor({ resource: element.uri, options: { pinned } }, group);
      } else {
        const items = this._widget.getItems();
        const idx = items.indexOf(event.item);
        this._widget.setFocused(items[idx + 1]);
        this._widget.setSelection(items[idx + 1], BreadcrumbsControl.Payload_Pick);
      }
    } else {
      element.outline.reveal(element, { pinned }, group === SIDE_GROUP, false);
    }
  }
  _getEditorGroup(data) {
    if (data === BreadcrumbsControl.Payload_RevealAside) {
      return SIDE_GROUP;
    } else if (data === BreadcrumbsControl.Payload_Reveal) {
      return ACTIVE_GROUP;
    } else {
      return void 0;
    }
  }
};
BreadcrumbsControl.HEIGHT = 22;
BreadcrumbsControl.SCROLLBAR_SIZES = {
  default: 3,
  large: 8
};
BreadcrumbsControl.Payload_Reveal = {};
BreadcrumbsControl.Payload_RevealAside = {};
BreadcrumbsControl.Payload_Pick = {};
BreadcrumbsControl.CK_BreadcrumbsPossible = new RawContextKey("breadcrumbsPossible", false, localize("breadcrumbsPossible", "Whether the editor can show breadcrumbs"));
BreadcrumbsControl.CK_BreadcrumbsVisible = new RawContextKey("breadcrumbsVisible", false, localize("breadcrumbsVisible", "Whether breadcrumbs are currently visible"));
BreadcrumbsControl.CK_BreadcrumbsActive = new RawContextKey("breadcrumbsActive", false, localize("breadcrumbsActive", "Whether breadcrumbs have focus"));
BreadcrumbsControl = __decorateClass([
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IContextViewService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IQuickInputService),
  __decorateParam(7, IFileService),
  __decorateParam(8, IEditorService),
  __decorateParam(9, ILabelService),
  __decorateParam(10, IConfigurationService),
  __decorateParam(11, IBreadcrumbsService)
], BreadcrumbsControl);
let BreadcrumbsControlFactory = class {
  constructor(_container, _editorGroup, _options, configurationService, _instantiationService, fileService) {
    this._container = _container;
    this._editorGroup = _editorGroup;
    this._options = _options;
    this._instantiationService = _instantiationService;
    this._disposables = new DisposableStore();
    this._controlDisposables = new DisposableStore();
    this._onDidEnablementChange = this._disposables.add(new Emitter());
    this._onDidVisibilityChange = this._disposables.add(new Emitter());
    const config = this._disposables.add(BreadcrumbsConfig.IsEnabled.bindTo(configurationService));
    this._disposables.add(config.onDidChange(() => {
      const value = config.getValue();
      if (!value && this._control) {
        this._controlDisposables.clear();
        this._control = void 0;
        this._onDidEnablementChange.fire();
      } else if (value && !this._control) {
        this._control = this.createControl();
        this._control.update();
        this._onDidEnablementChange.fire();
      }
    }));
    if (config.getValue()) {
      this._control = this.createControl();
    }
    this._disposables.add(fileService.onDidChangeFileSystemProviderRegistrations((e) => {
      if (this._control?.model && this._control.model.resource.scheme !== e.scheme) {
        return;
      }
      if (this._control?.update()) {
        this._onDidEnablementChange.fire();
      }
    }));
  }
  get control() {
    return this._control;
  }
  get onDidEnablementChange() {
    return this._onDidEnablementChange.event;
  }
  get onDidVisibilityChange() {
    return this._onDidVisibilityChange.event;
  }
  createControl() {
    const control = this._controlDisposables.add(this._instantiationService.createInstance(BreadcrumbsControl, this._container, this._options, this._editorGroup));
    this._controlDisposables.add(control.onDidVisibilityChange(() => this._onDidVisibilityChange.fire()));
    return control;
  }
  dispose() {
    this._disposables.dispose();
    this._controlDisposables.dispose();
  }
};
BreadcrumbsControlFactory = __decorateClass([
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IFileService)
], BreadcrumbsControlFactory);
registerAction2(class ToggleBreadcrumb extends Action2 {
  constructor() {
    super({
      id: "breadcrumbs.toggle",
      title: {
        ...localize2("cmd.toggle", "Toggle Breadcrumbs"),
        mnemonicTitle: localize({ key: "miBreadcrumbs", comment: ["&& denotes a mnemonic"] }, "Toggle &&Breadcrumbs")
      },
      category: Categories.View,
      toggled: {
        condition: ContextKeyExpr.equals("config.breadcrumbs.enabled", true),
        title: localize("cmd.toggle2", "Toggle Breadcrumbs"),
        mnemonicTitle: localize({ key: "miBreadcrumbs2", comment: ["&& denotes a mnemonic"] }, "Toggle &&Breadcrumbs")
      },
      menu: [
        { id: MenuId.CommandPalette },
        { id: MenuId.MenubarAppearanceMenu, group: "4_editor", order: 2 },
        { id: MenuId.NotebookToolbar, group: "notebookLayout", order: 2 },
        { id: MenuId.StickyScrollContext },
        { id: MenuId.NotebookStickyScrollContext, group: "notebookView", order: 2 },
        { id: MenuId.NotebookToolbarContext, group: "notebookView", order: 2 }
      ]
    });
  }
  run(accessor) {
    const config = accessor.get(IConfigurationService);
    const value = BreadcrumbsConfig.IsEnabled.bindTo(config).getValue();
    BreadcrumbsConfig.IsEnabled.bindTo(config).updateValue(!value);
  }
});
function focusAndSelectHandler(accessor, select) {
  const groups = accessor.get(IEditorGroupsService);
  const breadcrumbs = accessor.get(IBreadcrumbsService);
  const widget = breadcrumbs.getWidget(groups.activeGroup.id);
  if (widget) {
    const item = widget.getItems().at(-1);
    widget.setFocused(item);
    if (select) {
      widget.setSelection(item, BreadcrumbsControl.Payload_Pick);
    }
  }
}
registerAction2(class FocusAndSelectBreadcrumbs extends Action2 {
  constructor() {
    super({
      id: "breadcrumbs.focusAndSelect",
      title: localize2("cmd.focusAndSelect", "Focus and Select Breadcrumbs"),
      precondition: BreadcrumbsControl.CK_BreadcrumbsVisible,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Period,
        when: BreadcrumbsControl.CK_BreadcrumbsPossible
      },
      f1: true
    });
  }
  run(accessor, ...args) {
    focusAndSelectHandler(accessor, true);
  }
});
registerAction2(class FocusBreadcrumbs extends Action2 {
  constructor() {
    super({
      id: "breadcrumbs.focus",
      title: localize2("cmd.focus", "Focus Breadcrumbs"),
      precondition: BreadcrumbsControl.CK_BreadcrumbsVisible,
      keybinding: {
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Semicolon,
        when: BreadcrumbsControl.CK_BreadcrumbsPossible
      },
      f1: true
    });
  }
  run(accessor, ...args) {
    focusAndSelectHandler(accessor, false);
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "breadcrumbs.toggleToOn",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Period,
  when: ContextKeyExpr.not("config.breadcrumbs.enabled"),
  handler: async (accessor) => {
    const instant = accessor.get(IInstantiationService);
    const config = accessor.get(IConfigurationService);
    const isEnabled = BreadcrumbsConfig.IsEnabled.bindTo(config);
    if (!isEnabled.getValue()) {
      await isEnabled.updateValue(true);
      await timeout(50);
    }
    return instant.invokeFunction(focusAndSelectHandler, true);
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "breadcrumbs.focusNext",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.RightArrow,
  secondary: [KeyMod.CtrlCmd | KeyCode.RightArrow],
  mac: {
    primary: KeyCode.RightArrow,
    secondary: [KeyMod.Alt | KeyCode.RightArrow]
  },
  when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive),
  handler(accessor) {
    const groups = accessor.get(IEditorGroupsService);
    const breadcrumbs = accessor.get(IBreadcrumbsService);
    const widget = breadcrumbs.getWidget(groups.activeGroup.id);
    if (!widget) {
      return;
    }
    widget.focusNext();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "breadcrumbs.focusPrevious",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.LeftArrow,
  secondary: [KeyMod.CtrlCmd | KeyCode.LeftArrow],
  mac: {
    primary: KeyCode.LeftArrow,
    secondary: [KeyMod.Alt | KeyCode.LeftArrow]
  },
  when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive),
  handler(accessor) {
    const groups = accessor.get(IEditorGroupsService);
    const breadcrumbs = accessor.get(IBreadcrumbsService);
    const widget = breadcrumbs.getWidget(groups.activeGroup.id);
    if (!widget) {
      return;
    }
    widget.focusPrev();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "breadcrumbs.focusNextWithPicker",
  weight: KeybindingWeight.WorkbenchContrib + 1,
  primary: KeyMod.CtrlCmd | KeyCode.RightArrow,
  mac: {
    primary: KeyMod.Alt | KeyCode.RightArrow
  },
  when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive, WorkbenchListFocusContextKey),
  handler(accessor) {
    const groups = accessor.get(IEditorGroupsService);
    const breadcrumbs = accessor.get(IBreadcrumbsService);
    const widget = breadcrumbs.getWidget(groups.activeGroup.id);
    if (!widget) {
      return;
    }
    widget.focusNext();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "breadcrumbs.focusPreviousWithPicker",
  weight: KeybindingWeight.WorkbenchContrib + 1,
  primary: KeyMod.CtrlCmd | KeyCode.LeftArrow,
  mac: {
    primary: KeyMod.Alt | KeyCode.LeftArrow
  },
  when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive, WorkbenchListFocusContextKey),
  handler(accessor) {
    const groups = accessor.get(IEditorGroupsService);
    const breadcrumbs = accessor.get(IBreadcrumbsService);
    const widget = breadcrumbs.getWidget(groups.activeGroup.id);
    if (!widget) {
      return;
    }
    widget.focusPrev();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "breadcrumbs.selectFocused",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.Enter,
  secondary: [KeyCode.DownArrow],
  when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive),
  handler(accessor) {
    const groups = accessor.get(IEditorGroupsService);
    const breadcrumbs = accessor.get(IBreadcrumbsService);
    const widget = breadcrumbs.getWidget(groups.activeGroup.id);
    if (!widget) {
      return;
    }
    widget.setSelection(widget.getFocused(), BreadcrumbsControl.Payload_Pick);
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "breadcrumbs.revealFocused",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyCode.Space,
  secondary: [KeyMod.CtrlCmd | KeyCode.Enter],
  when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive),
  handler(accessor) {
    const groups = accessor.get(IEditorGroupsService);
    const breadcrumbs = accessor.get(IBreadcrumbsService);
    const widget = breadcrumbs.getWidget(groups.activeGroup.id);
    if (!widget) {
      return;
    }
    widget.setSelection(widget.getFocused(), BreadcrumbsControl.Payload_Reveal);
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "breadcrumbs.selectEditor",
  weight: KeybindingWeight.WorkbenchContrib + 1,
  primary: KeyCode.Escape,
  when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive),
  handler(accessor) {
    const groups = accessor.get(IEditorGroupsService);
    const breadcrumbs = accessor.get(IBreadcrumbsService);
    const widget = breadcrumbs.getWidget(groups.activeGroup.id);
    if (!widget) {
      return;
    }
    widget.setFocused(void 0);
    widget.setSelection(void 0);
    groups.activeGroup.activeEditorPane?.focus();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: "breadcrumbs.revealFocusedFromTreeAside",
  weight: KeybindingWeight.WorkbenchContrib,
  primary: KeyMod.CtrlCmd | KeyCode.Enter,
  when: ContextKeyExpr.and(BreadcrumbsControl.CK_BreadcrumbsVisible, BreadcrumbsControl.CK_BreadcrumbsActive, WorkbenchListFocusContextKey),
  handler(accessor) {
    const editors = accessor.get(IEditorService);
    const lists = accessor.get(IListService);
    const tree = lists.lastFocusedList;
    if (!(tree instanceof WorkbenchDataTree) && !(tree instanceof WorkbenchAsyncDataTree)) {
      return;
    }
    const element = tree.getFocus()[0];
    if (URI.isUri(element?.resource)) {
      return editors.openEditor({
        resource: element.resource,
        options: { pinned: true }
      }, SIDE_GROUP);
    }
    const input = tree.getInput();
    if (input && typeof input.outlineKind === "string") {
      return input.reveal(element, {
        pinned: true,
        preserveFocus: false
      }, true, false);
    }
  }
});
export {
  BreadcrumbsControl,
  BreadcrumbsControlFactory
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9lZGl0b3IvYnJlYWRjcnVtYnNDb250cm9sLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRNb3VzZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL21vdXNlRXZlbnQuanMnO1xuaW1wb3J0IHsgUGl4ZWxSYXRpbyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9waXhlbFJhdGlvLmpzJztcbmltcG9ydCB7IEJyZWFkY3J1bWJzSXRlbSwgQnJlYWRjcnVtYnNXaWRnZXQsIElCcmVhZGNydW1ic0l0ZW1FdmVudCwgSUJyZWFkY3J1bWJzV2lkZ2V0U3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2JyZWFkY3J1bWJzL2JyZWFkY3J1bWJzV2lkZ2V0LmpzJztcbmltcG9ydCB7IGFwcGx5RHJhZ0ltYWdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2RuZC9kbmQuanMnO1xuaW1wb3J0IHsgSUhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZS5qcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBjb21iaW5lZERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGV4dFVyaSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRG9jdW1lbnRTeW1ib2wgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBPdXRsaW5lRWxlbWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2RvY3VtZW50U3ltYm9scy9icm93c2VyL291dGxpbmVNb2RlbC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENhdGVnb3JpZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbkNvbW1vbkNhdGVnb3JpZXMuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgTWVudUlkLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIsIElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0Vmlld1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IGZpbGxJblN5bWJvbHNEcmFnRGF0YSwgTG9jYWxTZWxlY3Rpb25UcmFuc2ZlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RuZC9icm93c2VyL2RuZC5qcyc7XG5pbXBvcnQgeyBGaWxlS2luZCwgSUZpbGVTZXJ2aWNlLCBJRmlsZVN0YXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzUmVnaXN0cnksIEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSUxpc3RTZXJ2aWNlLCBXb3JrYmVuY2hBc3luY0RhdGFUcmVlLCBXb3JrYmVuY2hEYXRhVHJlZSwgV29ya2JlbmNoTGlzdEZvY3VzQ29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IGRlZmF1bHRCcmVhZGNydW1ic1dpZGdldFN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2Jyb3dzZXIvZGVmYXVsdFN0eWxlcy5qcyc7XG5pbXBvcnQgeyByZWdpc3Rlckljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEVkaXRvclJlc291cmNlQWNjZXNzb3IsIElFZGl0b3JQYXJ0T3B0aW9ucywgU2lkZUJ5U2lkZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3Vwc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQUNUSVZFX0dST1VQLCBBQ1RJVkVfR1JPVVBfVFlQRSwgSUVkaXRvclNlcnZpY2UsIFNJREVfR1JPVVAsIFNJREVfR1JPVVBfVFlQRSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJT3V0bGluZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL291dGxpbmUvYnJvd3Nlci9vdXRsaW5lLmpzJztcbmltcG9ydCB7IERyYWdnZWRFZGl0b3JJZGVudGlmaWVyLCBmaWxsRWRpdG9yc0RyYWdEYXRhIH0gZnJvbSAnLi4vLi4vZG5kLmpzJztcbmltcG9ydCB7IERFRkFVTFRfTEFCRUxTX0NPTlRBSU5FUiwgUmVzb3VyY2VMYWJlbHMgfSBmcm9tICcuLi8uLi9sYWJlbHMuanMnO1xuaW1wb3J0IHsgQnJlYWRjcnVtYnNDb25maWcsIElCcmVhZGNydW1ic1NlcnZpY2UgfSBmcm9tICcuL2JyZWFkY3J1bWJzLmpzJztcbmltcG9ydCB7IEJyZWFkY3J1bWJzTW9kZWwsIEZpbGVFbGVtZW50LCBPdXRsaW5lRWxlbWVudDIgfSBmcm9tICcuL2JyZWFkY3J1bWJzTW9kZWwuanMnO1xuaW1wb3J0IHsgQnJlYWRjcnVtYnNGaWxlUGlja2VyLCBCcmVhZGNydW1ic091dGxpbmVQaWNrZXIsIEJyZWFkY3J1bWJzUGlja2VyIH0gZnJvbSAnLi9icmVhZGNydW1ic1BpY2tlci5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBWaWV3IH0gZnJvbSAnLi9lZGl0b3IuanMnO1xuaW1wb3J0ICcuL21lZGlhL2JyZWFkY3J1bWJzY29udHJvbC5jc3MnO1xuXG5jbGFzcyBPdXRsaW5lSXRlbSBleHRlbmRzIEJyZWFkY3J1bWJzSXRlbSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgbW9kZWw6IEJyZWFkY3J1bWJzTW9kZWwsXG5cdFx0cmVhZG9ubHkgZWxlbWVudDogT3V0bGluZUVsZW1lbnQyLFxuXHRcdHJlYWRvbmx5IG9wdGlvbnM6IElCcmVhZGNydW1ic0NvbnRyb2xPcHRpb25zLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IEluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cblxuXHRlcXVhbHMob3RoZXI6IEJyZWFkY3J1bWJzSXRlbSk6IGJvb2xlYW4ge1xuXHRcdGlmICghKG90aGVyIGluc3RhbmNlb2YgT3V0bGluZUl0ZW0pKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmVsZW1lbnQuZWxlbWVudCA9PT0gb3RoZXIuZWxlbWVudC5lbGVtZW50ICYmXG5cdFx0XHR0aGlzLm9wdGlvbnMuc2hvd0ZpbGVJY29ucyA9PT0gb3RoZXIub3B0aW9ucy5zaG93RmlsZUljb25zICYmXG5cdFx0XHR0aGlzLm9wdGlvbnMuc2hvd1N5bWJvbEljb25zID09PSBvdGhlci5vcHRpb25zLnNob3dTeW1ib2xJY29ucztcblx0fVxuXG5cdHJlbmRlcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgeyBlbGVtZW50LCBvdXRsaW5lIH0gPSB0aGlzLmVsZW1lbnQ7XG5cblx0XHRpZiAoZWxlbWVudCA9PT0gb3V0bGluZSkge1xuXHRcdFx0Y29uc3QgZWxlbWVudCA9IGRvbS4kKCdzcGFuJywgdW5kZWZpbmVkLCAnXHUyMDI2Jyk7XG5cdFx0XHRjb250YWluZXIuYXBwZW5kQ2hpbGQoZWxlbWVudCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGVtcGxhdGVJZCA9IG91dGxpbmUuY29uZmlnLmRlbGVnYXRlLmdldFRlbXBsYXRlSWQoZWxlbWVudCk7XG5cdFx0Y29uc3QgcmVuZGVyZXIgPSBvdXRsaW5lLmNvbmZpZy5yZW5kZXJlcnMuZmluZChyZW5kZXJlciA9PiByZW5kZXJlci50ZW1wbGF0ZUlkID09PSB0ZW1wbGF0ZUlkKTtcblx0XHRpZiAoIXJlbmRlcmVyKSB7XG5cdFx0XHRjb250YWluZXIuaW5uZXJUZXh0ID0gJzw8Tk8gUkVOREVSRVI+Pic7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGVtcGxhdGUgPSByZW5kZXJlci5yZW5kZXJUZW1wbGF0ZShjb250YWluZXIpO1xuXHRcdHJlbmRlcmVyLnJlbmRlckVsZW1lbnQoe1xuXHRcdFx0ZWxlbWVudCxcblx0XHRcdGNoaWxkcmVuOiBbXSxcblx0XHRcdGRlcHRoOiAwLFxuXHRcdFx0dmlzaWJsZUNoaWxkcmVuQ291bnQ6IDAsXG5cdFx0XHR2aXNpYmxlQ2hpbGRJbmRleDogMCxcblx0XHRcdGNvbGxhcHNpYmxlOiBmYWxzZSxcblx0XHRcdGNvbGxhcHNlZDogZmFsc2UsXG5cdFx0XHR2aXNpYmxlOiB0cnVlLFxuXHRcdFx0ZmlsdGVyRGF0YTogdW5kZWZpbmVkXG5cdFx0fSwgMCwgdGVtcGxhdGUsIHVuZGVmaW5lZCk7XG5cblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHsgcmVuZGVyZXIuZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlKTsgfSkpO1xuXG5cdFx0aWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBPdXRsaW5lRWxlbWVudCAmJiBvdXRsaW5lLnVyaSkge1xuXHRcdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IGNyZWF0ZUJyZWFkY3J1bWJEbmRPYnNlcnZlcihhY2Nlc3NvciwgY29udGFpbmVyLCBlbGVtZW50LnN5bWJvbC5uYW1lLCB7IHN5bWJvbDogZWxlbWVudC5zeW1ib2wsIHVyaTogb3V0bGluZS51cmkhIH0sIHRoaXMubW9kZWwsIHRoaXMub3B0aW9ucy5kcmFnRWRpdG9yKSkpO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBGaWxlSXRlbSBleHRlbmRzIEJyZWFkY3J1bWJzSXRlbSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgbW9kZWw6IEJyZWFkY3J1bWJzTW9kZWwsXG5cdFx0cmVhZG9ubHkgZWxlbWVudDogRmlsZUVsZW1lbnQsXG5cdFx0cmVhZG9ubHkgb3B0aW9uczogSUJyZWFkY3J1bWJzQ29udHJvbE9wdGlvbnMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbGFiZWxzOiBSZXNvdXJjZUxhYmVscyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9ob3ZlckRlbGVnYXRlOiBJSG92ZXJEZWxlZ2F0ZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG5cblx0ZXF1YWxzKG90aGVyOiBCcmVhZGNydW1ic0l0ZW0pOiBib29sZWFuIHtcblx0XHRpZiAoIShvdGhlciBpbnN0YW5jZW9mIEZpbGVJdGVtKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gKGV4dFVyaS5pc0VxdWFsKHRoaXMuZWxlbWVudC51cmksIG90aGVyLmVsZW1lbnQudXJpKSAmJlxuXHRcdFx0dGhpcy5vcHRpb25zLnNob3dGaWxlSWNvbnMgPT09IG90aGVyLm9wdGlvbnMuc2hvd0ZpbGVJY29ucyAmJlxuXHRcdFx0dGhpcy5vcHRpb25zLnNob3dTeW1ib2xJY29ucyA9PT0gb3RoZXIub3B0aW9ucy5zaG93U3ltYm9sSWNvbnMpO1xuXG5cdH1cblxuXHRyZW5kZXIoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdC8vIGZpbGUvZm9sZGVyXG5cdFx0Y29uc3QgbGFiZWwgPSB0aGlzLl9sYWJlbHMuY3JlYXRlKGNvbnRhaW5lciwgeyBob3ZlckRlbGVnYXRlOiB0aGlzLl9ob3ZlckRlbGVnYXRlIH0pO1xuXHRcdGxhYmVsLnNldEZpbGUodGhpcy5lbGVtZW50LnVyaSwge1xuXHRcdFx0aGlkZVBhdGg6IHRydWUsXG5cdFx0XHRoaWRlSWNvbjogdGhpcy5lbGVtZW50LmtpbmQgPT09IEZpbGVLaW5kLkZPTERFUiB8fCAhdGhpcy5vcHRpb25zLnNob3dGaWxlSWNvbnMsXG5cdFx0XHRmaWxlS2luZDogdGhpcy5lbGVtZW50LmtpbmQsXG5cdFx0XHRmaWxlRGVjb3JhdGlvbnM6IHsgY29sb3JzOiB0aGlzLm9wdGlvbnMuc2hvd0RlY29yYXRpb25Db2xvcnMsIGJhZGdlczogZmFsc2UgfSxcblx0XHR9KTtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZChGaWxlS2luZFt0aGlzLmVsZW1lbnQua2luZF0udG9Mb3dlckNhc2UoKSk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKGxhYmVsKTtcblxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBjcmVhdGVCcmVhZGNydW1iRG5kT2JzZXJ2ZXIoYWNjZXNzb3IsIGNvbnRhaW5lciwgYmFzZW5hbWUodGhpcy5lbGVtZW50LnVyaSksIHRoaXMuZWxlbWVudC51cmksIHRoaXMubW9kZWwsIHRoaXMub3B0aW9ucy5kcmFnRWRpdG9yKSkpO1xuXHR9XG59XG5cblxuZnVuY3Rpb24gY3JlYXRlQnJlYWRjcnVtYkRuZE9ic2VydmVyKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250YWluZXI6IEhUTUxFbGVtZW50LCBsYWJlbDogc3RyaW5nLCBpdGVtOiBVUkkgfCB7IHN5bWJvbDogRG9jdW1lbnRTeW1ib2w7IHVyaTogVVJJIH0sIG1vZGVsOiBCcmVhZGNydW1ic01vZGVsLCBkcmFnRWRpdG9yOiBib29sZWFuKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXG5cdGNvbnRhaW5lci5kcmFnZ2FibGUgPSB0cnVlO1xuXG5cdHJldHVybiBuZXcgZG9tLkRyYWdBbmREcm9wT2JzZXJ2ZXIoY29udGFpbmVyLCB7XG5cdFx0b25EcmFnU3RhcnQ6IGV2ZW50ID0+IHtcblx0XHRcdGlmICghZXZlbnQuZGF0YVRyYW5zZmVyKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2V0IGRhdGEgdHJhbnNmZXJcblx0XHRcdGV2ZW50LmRhdGFUcmFuc2Zlci5lZmZlY3RBbGxvd2VkID0gJ2NvcHlNb3ZlJztcblxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRpZiAoVVJJLmlzVXJpKGl0ZW0pKSB7XG5cdFx0XHRcdFx0ZmlsbEVkaXRvcnNEcmFnRGF0YShhY2Nlc3NvciwgW2l0ZW1dLCBldmVudCk7XG5cdFx0XHRcdH0gZWxzZSB7IC8vIFN5bWJvbFxuXHRcdFx0XHRcdGZpbGxFZGl0b3JzRHJhZ0RhdGEoYWNjZXNzb3IsIFt7IHJlc291cmNlOiBpdGVtLnVyaSwgc2VsZWN0aW9uOiBpdGVtLnN5bWJvbC5yYW5nZSB9XSwgZXZlbnQpO1xuXG5cdFx0XHRcdFx0ZmlsbEluU3ltYm9sc0RyYWdEYXRhKFt7XG5cdFx0XHRcdFx0XHRuYW1lOiBpdGVtLnN5bWJvbC5uYW1lLFxuXHRcdFx0XHRcdFx0ZnNQYXRoOiBpdGVtLnVyaS5mc1BhdGgsXG5cdFx0XHRcdFx0XHRyYW5nZTogaXRlbS5zeW1ib2wucmFuZ2UsXG5cdFx0XHRcdFx0XHRraW5kOiBpdGVtLnN5bWJvbC5raW5kXG5cdFx0XHRcdFx0fV0sIGV2ZW50KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChkcmFnRWRpdG9yICYmIG1vZGVsLmVkaXRvciAmJiBtb2RlbC5lZGl0b3I/LmlucHV0KSB7XG5cdFx0XHRcdFx0Y29uc3QgZWRpdG9yVHJhbnNmZXIgPSBMb2NhbFNlbGVjdGlvblRyYW5zZmVyLmdldEluc3RhbmNlPERyYWdnZWRFZGl0b3JJZGVudGlmaWVyPigpO1xuXHRcdFx0XHRcdGVkaXRvclRyYW5zZmVyLnNldERhdGEoW25ldyBEcmFnZ2VkRWRpdG9ySWRlbnRpZmllcih7IGVkaXRvcjogbW9kZWwuZWRpdG9yLmlucHV0LCBncm91cElkOiBtb2RlbC5lZGl0b3IuZ3JvdXAuaWQgfSldLCBEcmFnZ2VkRWRpdG9ySWRlbnRpZmllci5wcm90b3R5cGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0YXBwbHlEcmFnSW1hZ2UoZXZlbnQsIGNvbnRhaW5lciwgbGFiZWwpO1xuXHRcdH1cblx0fSk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUJyZWFkY3J1bWJzQ29udHJvbE9wdGlvbnMge1xuXHRyZWFkb25seSBzaG93RmlsZUljb25zOiBib29sZWFuO1xuXHRyZWFkb25seSBzaG93U3ltYm9sSWNvbnM6IGJvb2xlYW47XG5cdHJlYWRvbmx5IHNob3dEZWNvcmF0aW9uQ29sb3JzOiBib29sZWFuO1xuXHRyZWFkb25seSBzaG93UGxhY2Vob2xkZXI6IGJvb2xlYW47XG5cdHJlYWRvbmx5IGRyYWdFZGl0b3I6IGJvb2xlYW47XG5cdHJlYWRvbmx5IHdpZGdldFN0eWxlcz86IElCcmVhZGNydW1ic1dpZGdldFN0eWxlcztcbn1cblxuY29uc3Qgc2VwYXJhdG9ySWNvbiA9IHJlZ2lzdGVySWNvbignYnJlYWRjcnVtYi1zZXBhcmF0b3InLCBDb2RpY29uLmNoZXZyb25SaWdodCwgbG9jYWxpemUoJ3NlcGFyYXRvckljb24nLCAnSWNvbiBmb3IgdGhlIHNlcGFyYXRvciBpbiB0aGUgYnJlYWRjcnVtYnMuJykpO1xuXG5leHBvcnQgY2xhc3MgQnJlYWRjcnVtYnNDb250cm9sIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSEVJR0hUID0gMjI7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgU0NST0xMQkFSX1NJWkVTID0ge1xuXHRcdGRlZmF1bHQ6IDMsXG5cdFx0bGFyZ2U6IDhcblx0fTtcblxuXHRzdGF0aWMgcmVhZG9ubHkgUGF5bG9hZF9SZXZlYWwgPSB7fTtcblx0c3RhdGljIHJlYWRvbmx5IFBheWxvYWRfUmV2ZWFsQXNpZGUgPSB7fTtcblx0c3RhdGljIHJlYWRvbmx5IFBheWxvYWRfUGljayA9IHt9O1xuXG5cdHN0YXRpYyByZWFkb25seSBDS19CcmVhZGNydW1ic1Bvc3NpYmxlID0gbmV3IFJhd0NvbnRleHRLZXkoJ2JyZWFkY3J1bWJzUG9zc2libGUnLCBmYWxzZSwgbG9jYWxpemUoJ2JyZWFkY3J1bWJzUG9zc2libGUnLCBcIldoZXRoZXIgdGhlIGVkaXRvciBjYW4gc2hvdyBicmVhZGNydW1ic1wiKSk7XG5cdHN0YXRpYyByZWFkb25seSBDS19CcmVhZGNydW1ic1Zpc2libGUgPSBuZXcgUmF3Q29udGV4dEtleSgnYnJlYWRjcnVtYnNWaXNpYmxlJywgZmFsc2UsIGxvY2FsaXplKCdicmVhZGNydW1ic1Zpc2libGUnLCBcIldoZXRoZXIgYnJlYWRjcnVtYnMgYXJlIGN1cnJlbnRseSB2aXNpYmxlXCIpKTtcblx0c3RhdGljIHJlYWRvbmx5IENLX0JyZWFkY3J1bWJzQWN0aXZlID0gbmV3IFJhd0NvbnRleHRLZXkoJ2JyZWFkY3J1bWJzQWN0aXZlJywgZmFsc2UsIGxvY2FsaXplKCdicmVhZGNydW1ic0FjdGl2ZScsIFwiV2hldGhlciBicmVhZGNydW1icyBoYXZlIGZvY3VzXCIpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9ja0JyZWFkY3J1bWJzUG9zc2libGU6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9ja0JyZWFkY3J1bWJzVmlzaWJsZTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NrQnJlYWRjcnVtYnNBY3RpdmU6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2NmVXNlUXVpY2tQaWNrOiBCcmVhZGNydW1ic0NvbmZpZzxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfY2ZTaG93SWNvbnM6IEJyZWFkY3J1bWJzQ29uZmlnPGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jZlRpdGxlU2Nyb2xsYmFyU2l6aW5nOiBCcmVhZGNydW1ic0NvbmZpZzxJRWRpdG9yUGFydE9wdGlvbnNbJ3RpdGxlU2Nyb2xsYmFyU2l6aW5nJ10+O1xuXG5cdHJlYWRvbmx5IGRvbU5vZGU6IEhUTUxEaXZFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF93aWRnZXQ6IEJyZWFkY3J1bWJzV2lkZ2V0O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2Rpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9icmVhZGNydW1ic0Rpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9sYWJlbHM6IFJlc291cmNlTGFiZWxzO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9tb2RlbCA9IG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxCcmVhZGNydW1ic01vZGVsPigpO1xuXHRwcml2YXRlIF9icmVhZGNydW1ic1BpY2tlclNob3dpbmcgPSBmYWxzZTtcblx0cHJpdmF0ZSBfYnJlYWRjcnVtYnNQaWNrZXJJZ25vcmVPbmNlSXRlbTogQnJlYWRjcnVtYnNJdGVtIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyRGVsZWdhdGU6IElIb3ZlckRlbGVnYXRlO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkVmlzaWJpbGl0eUNoYW5nZSA9IHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0Z2V0IG9uRGlkVmlzaWJpbGl0eUNoYW5nZSgpIHsgcmV0dXJuIHRoaXMuX29uRGlkVmlzaWJpbGl0eUNoYW5nZS5ldmVudDsgfVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb3B0aW9uczogSUJyZWFkY3J1bWJzQ29udHJvbE9wdGlvbnMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yR3JvdXA6IElFZGl0b3JHcm91cFZpZXcsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dFZpZXdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRWaWV3U2VydmljZTogSUNvbnRleHRWaWV3U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9xdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUJyZWFkY3J1bWJzU2VydmljZSBicmVhZGNydW1ic1NlcnZpY2U6IElCcmVhZGNydW1ic1NlcnZpY2Vcblx0KSB7XG5cdFx0dGhpcy5kb21Ob2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0dGhpcy5kb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ2JyZWFkY3J1bWJzLWNvbnRyb2wnKTtcblx0XHRkb20uYXBwZW5kKGNvbnRhaW5lciwgdGhpcy5kb21Ob2RlKTtcblxuXHRcdHRoaXMuX2NmVXNlUXVpY2tQaWNrID0gQnJlYWRjcnVtYnNDb25maWcuVXNlUXVpY2tQaWNrLmJpbmRUbyhjb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0dGhpcy5fY2ZTaG93SWNvbnMgPSBCcmVhZGNydW1ic0NvbmZpZy5JY29ucy5iaW5kVG8oY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHRoaXMuX2NmVGl0bGVTY3JvbGxiYXJTaXppbmcgPSBCcmVhZGNydW1ic0NvbmZpZy5UaXRsZVNjcm9sbGJhclNpemluZy5iaW5kVG8oY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fbGFiZWxzID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVzb3VyY2VMYWJlbHMsIERFRkFVTFRfTEFCRUxTX0NPTlRBSU5FUik7XG5cblx0XHRjb25zdCBzaXppbmcgPSB0aGlzLl9jZlRpdGxlU2Nyb2xsYmFyU2l6aW5nLmdldFZhbHVlKCkgPz8gJ2RlZmF1bHQnO1xuXHRcdGNvbnN0IHN0eWxlcyA9IF9vcHRpb25zLndpZGdldFN0eWxlcyA/PyBkZWZhdWx0QnJlYWRjcnVtYnNXaWRnZXRTdHlsZXM7XG5cdFx0dGhpcy5fd2lkZ2V0ID0gbmV3IEJyZWFkY3J1bWJzV2lkZ2V0KHRoaXMuZG9tTm9kZSwgQnJlYWRjcnVtYnNDb250cm9sLlNDUk9MTEJBUl9TSVpFU1tzaXppbmddLCBzZXBhcmF0b3JJY29uLCBzdHlsZXMpO1xuXHRcdHRoaXMuX3dpZGdldC5vbkRpZFNlbGVjdEl0ZW0odGhpcy5fb25TZWxlY3RFdmVudCwgdGhpcywgdGhpcy5fZGlzcG9zYWJsZXMpO1xuXHRcdHRoaXMuX3dpZGdldC5vbkRpZEZvY3VzSXRlbSh0aGlzLl9vbkZvY3VzRXZlbnQsIHRoaXMsIHRoaXMuX2Rpc3Bvc2FibGVzKTtcblx0XHR0aGlzLl93aWRnZXQub25EaWRDaGFuZ2VGb2N1cyh0aGlzLl91cGRhdGVDa0JyZWFkY3J1bWJzQWN0aXZlLCB0aGlzLCB0aGlzLl9kaXNwb3NhYmxlcyk7XG5cblx0XHR0aGlzLl9ja0JyZWFkY3J1bWJzUG9zc2libGUgPSBCcmVhZGNydW1ic0NvbnRyb2wuQ0tfQnJlYWRjcnVtYnNQb3NzaWJsZS5iaW5kVG8odGhpcy5fY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX2NrQnJlYWRjcnVtYnNWaXNpYmxlID0gQnJlYWRjcnVtYnNDb250cm9sLkNLX0JyZWFkY3J1bWJzVmlzaWJsZS5iaW5kVG8odGhpcy5fY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX2NrQnJlYWRjcnVtYnNBY3RpdmUgPSBCcmVhZGNydW1ic0NvbnRyb2wuQ0tfQnJlYWRjcnVtYnNBY3RpdmUuYmluZFRvKHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMuX2hvdmVyRGVsZWdhdGUgPSBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKTtcblxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChicmVhZGNydW1ic1NlcnZpY2UucmVnaXN0ZXIodGhpcy5fZWRpdG9yR3JvdXAuaWQsIHRoaXMuX3dpZGdldCkpO1xuXHRcdHRoaXMuaGlkZSgpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fYnJlYWRjcnVtYnNEaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fY2tCcmVhZGNydW1ic1Bvc3NpYmxlLnJlc2V0KCk7XG5cdFx0dGhpcy5fY2tCcmVhZGNydW1ic1Zpc2libGUucmVzZXQoKTtcblx0XHR0aGlzLl9ja0JyZWFkY3J1bWJzQWN0aXZlLnJlc2V0KCk7XG5cdFx0dGhpcy5fY2ZVc2VRdWlja1BpY2suZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2NmU2hvd0ljb25zLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl93aWRnZXQuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2xhYmVscy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5kb21Ob2RlLnJlbW92ZSgpO1xuXHR9XG5cblx0Z2V0IG1vZGVsKCk6IEJyZWFkY3J1bWJzTW9kZWwgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbC52YWx1ZTtcblx0fVxuXG5cdGxheW91dChkaW06IGRvbS5EaW1lbnNpb24gfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLl93aWRnZXQubGF5b3V0KGRpbSk7XG5cdH1cblxuXHRpc0hpZGRlbigpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5kb21Ob2RlLmNsYXNzTGlzdC5jb250YWlucygnaGlkZGVuJyk7XG5cdH1cblxuXHRoaWRlKCk6IHZvaWQge1xuXHRcdGNvbnN0IHdhc0hpZGRlbiA9IHRoaXMuaXNIaWRkZW4oKTtcblxuXHRcdHRoaXMuX2JyZWFkY3J1bWJzRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHR0aGlzLl9ja0JyZWFkY3J1bWJzVmlzaWJsZS5zZXQoZmFsc2UpO1xuXHRcdHRoaXMuZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdoaWRkZW4nLCB0cnVlKTtcblxuXHRcdGlmICghd2FzSGlkZGVuKSB7XG5cdFx0XHR0aGlzLl9vbkRpZFZpc2liaWxpdHlDaGFuZ2UuZmlyZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc2hvdygpOiB2b2lkIHtcblx0XHRjb25zdCB3YXNIaWRkZW4gPSB0aGlzLmlzSGlkZGVuKCk7XG5cblx0XHR0aGlzLl9ja0JyZWFkY3J1bWJzVmlzaWJsZS5zZXQodHJ1ZSk7XG5cdFx0dGhpcy5kb21Ob2RlLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGRlbicsIGZhbHNlKTtcblxuXHRcdGlmICh3YXNIaWRkZW4pIHtcblx0XHRcdHRoaXMuX29uRGlkVmlzaWJpbGl0eUNoYW5nZS5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0cmV2ZWFsTGFzdCgpOiB2b2lkIHtcblx0XHR0aGlzLl93aWRnZXQucmV2ZWFsTGFzdCgpO1xuXHR9XG5cblx0dXBkYXRlKCk6IGJvb2xlYW4ge1xuXHRcdHRoaXMuX2JyZWFkY3J1bWJzRGlzcG9zYWJsZXMuY2xlYXIoKTtcblxuXHRcdC8vIGhvbm9yIGRpZmYgZWRpdG9ycyBhbmQgc3VjaFxuXHRcdGNvbnN0IHVyaSA9IEVkaXRvclJlc291cmNlQWNjZXNzb3IuZ2V0Q2Fub25pY2FsVXJpKHRoaXMuX2VkaXRvckdyb3VwLmFjdGl2ZUVkaXRvciwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5QUklNQVJZIH0pO1xuXHRcdGNvbnN0IHdhc0hpZGRlbiA9IHRoaXMuaXNIaWRkZW4oKTtcblxuXHRcdGlmICghdXJpIHx8ICF0aGlzLl9maWxlU2VydmljZS5oYXNQcm92aWRlcih1cmkpKSB7XG5cdFx0XHQvLyBjbGVhbnVwIGFuZCByZXR1cm4gd2hlbiB0aGVyZSBpcyBubyBpbnB1dCBvciB3aGVuXG5cdFx0XHQvLyB3ZSBjYW5ub3QgaGFuZGxlIHRoaXMgaW5wdXRcblx0XHRcdHRoaXMuX2NrQnJlYWRjcnVtYnNQb3NzaWJsZS5zZXQoZmFsc2UpO1xuXHRcdFx0aWYgKCF3YXNIaWRkZW4pIHtcblx0XHRcdFx0dGhpcy5oaWRlKCk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIGRpc3BsYXkgdXJpIHdoaWNoIGNhbiBiZSBkZXJpdmVkIGZyb20gY2VydGFpbiBpbnB1dHNcblx0XHRjb25zdCBmaWxlSW5mb1VyaSA9IEVkaXRvclJlc291cmNlQWNjZXNzb3IuZ2V0T3JpZ2luYWxVcmkodGhpcy5fZWRpdG9yR3JvdXAuYWN0aXZlRWRpdG9yLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLlBSSU1BUlkgfSk7XG5cblx0XHR0aGlzLnNob3coKTtcblx0XHR0aGlzLl9ja0JyZWFkY3J1bWJzUG9zc2libGUuc2V0KHRydWUpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShCcmVhZGNydW1ic01vZGVsLFxuXHRcdFx0ZmlsZUluZm9VcmkgPz8gdXJpLFxuXHRcdFx0dGhpcy5fZWRpdG9yR3JvdXAuYWN0aXZlRWRpdG9yUGFuZVxuXHRcdCk7XG5cdFx0dGhpcy5fbW9kZWwudmFsdWUgPSBtb2RlbDtcblxuXHRcdHRoaXMuZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdiYWNrc2xhc2gtcGF0aCcsIHRoaXMuX2xhYmVsU2VydmljZS5nZXRTZXBhcmF0b3IodXJpLnNjaGVtZSwgdXJpLmF1dGhvcml0eSkgPT09ICdcXFxcJyk7XG5cblx0XHRjb25zdCB1cGRhdGVCcmVhZGNydW1icyA9ICgpID0+IHtcblx0XHRcdHRoaXMuZG9tTm9kZS5jbGFzc0xpc3QudG9nZ2xlKCdyZWxhdGl2ZS1wYXRoJywgbW9kZWwuaXNSZWxhdGl2ZSgpKTtcblx0XHRcdGNvbnN0IHNob3dJY29ucyA9IHRoaXMuX2NmU2hvd0ljb25zLmdldFZhbHVlKCk7XG5cdFx0XHRjb25zdCBvcHRpb25zOiBJQnJlYWRjcnVtYnNDb250cm9sT3B0aW9ucyA9IHtcblx0XHRcdFx0Li4udGhpcy5fb3B0aW9ucyxcblx0XHRcdFx0c2hvd0ZpbGVJY29uczogdGhpcy5fb3B0aW9ucy5zaG93RmlsZUljb25zICYmIHNob3dJY29ucyxcblx0XHRcdFx0c2hvd1N5bWJvbEljb25zOiB0aGlzLl9vcHRpb25zLnNob3dTeW1ib2xJY29ucyAmJiBzaG93SWNvbnNcblx0XHRcdH07XG5cdFx0XHRjb25zdCBpdGVtcyA9IG1vZGVsLmdldEVsZW1lbnRzKCkubWFwKGVsZW1lbnQgPT4gZWxlbWVudCBpbnN0YW5jZW9mIEZpbGVFbGVtZW50XG5cdFx0XHRcdD8gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRmlsZUl0ZW0sIG1vZGVsLCBlbGVtZW50LCBvcHRpb25zLCB0aGlzLl9sYWJlbHMsIHRoaXMuX2hvdmVyRGVsZWdhdGUpXG5cdFx0XHRcdDogdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoT3V0bGluZUl0ZW0sIG1vZGVsLCBlbGVtZW50LCBvcHRpb25zKSk7XG5cdFx0XHRpZiAoaXRlbXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHRoaXMuX3dpZGdldC5zZXRFbmFibGVkKGZhbHNlKTtcblx0XHRcdFx0dGhpcy5fd2lkZ2V0LnNldEl0ZW1zKFtuZXcgY2xhc3MgZXh0ZW5kcyBCcmVhZGNydW1ic0l0ZW0ge1xuXHRcdFx0XHRcdHJlbmRlcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0XHRcdFx0XHRjb250YWluZXIuaW5uZXJUZXh0ID0gbG9jYWxpemUoJ2VtcHR5JywgXCJubyBlbGVtZW50c1wiKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZXF1YWxzKG90aGVyOiBCcmVhZGNydW1ic0l0ZW0pOiBib29sZWFuIHtcblx0XHRcdFx0XHRcdHJldHVybiBvdGhlciA9PT0gdGhpcztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZGlzcG9zZSgpOiB2b2lkIHtcblxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fV0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fd2lkZ2V0LnNldEVuYWJsZWQodHJ1ZSk7XG5cdFx0XHRcdHRoaXMuX3dpZGdldC5zZXRJdGVtcyhpdGVtcyk7XG5cdFx0XHRcdHRoaXMuX3dpZGdldC5yZXZlYWwoaXRlbXNbaXRlbXMubGVuZ3RoIC0gMV0pO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Y29uc3QgbGlzdGVuZXIgPSBtb2RlbC5vbkRpZFVwZGF0ZSh1cGRhdGVCcmVhZGNydW1icyk7XG5cdFx0Y29uc3QgY29uZmlnTGlzdGVuZXIgPSB0aGlzLl9jZlNob3dJY29ucy5vbkRpZENoYW5nZSh1cGRhdGVCcmVhZGNydW1icyk7XG5cdFx0dXBkYXRlQnJlYWRjcnVtYnMoKTtcblx0XHR0aGlzLl9icmVhZGNydW1ic0Rpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5fYnJlYWRjcnVtYnNEaXNwb3NhYmxlcy5hZGQobGlzdGVuZXIpO1xuXHRcdHRoaXMuX2JyZWFkY3J1bWJzRGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLl9tb2RlbC5jbGVhcigpKSk7XG5cdFx0dGhpcy5fYnJlYWRjcnVtYnNEaXNwb3NhYmxlcy5hZGQoY29uZmlnTGlzdGVuZXIpO1xuXHRcdHRoaXMuX2JyZWFkY3J1bWJzRGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLl93aWRnZXQuc2V0SXRlbXMoW10pKSk7XG5cblx0XHRjb25zdCB1cGRhdGVTY3JvbGxiYXJTaXppbmcgPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBzaXppbmcgPSB0aGlzLl9jZlRpdGxlU2Nyb2xsYmFyU2l6aW5nLmdldFZhbHVlKCkgPz8gJ2RlZmF1bHQnO1xuXHRcdFx0dGhpcy5fd2lkZ2V0LnNldEhvcml6b250YWxTY3JvbGxiYXJTaXplKEJyZWFkY3J1bWJzQ29udHJvbC5TQ1JPTExCQVJfU0laRVNbc2l6aW5nXSk7XG5cdFx0fTtcblx0XHR1cGRhdGVTY3JvbGxiYXJTaXppbmcoKTtcblx0XHRjb25zdCB1cGRhdGVTY3JvbGxiYXJTaXplTGlzdGVuZXIgPSB0aGlzLl9jZlRpdGxlU2Nyb2xsYmFyU2l6aW5nLm9uRGlkQ2hhbmdlKHVwZGF0ZVNjcm9sbGJhclNpemluZyk7XG5cdFx0dGhpcy5fYnJlYWRjcnVtYnNEaXNwb3NhYmxlcy5hZGQodXBkYXRlU2Nyb2xsYmFyU2l6ZUxpc3RlbmVyKTtcblxuXHRcdC8vIGNsb3NlIHBpY2tlciBvbiBoaWRlL3VwZGF0ZVxuXHRcdHRoaXMuX2JyZWFkY3J1bWJzRGlzcG9zYWJsZXMuYWRkKHtcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuX2JyZWFkY3J1bWJzUGlja2VyU2hvd2luZykge1xuXHRcdFx0XHRcdHRoaXMuX2NvbnRleHRWaWV3U2VydmljZS5oaWRlQ29udGV4dFZpZXcoeyBzb3VyY2U6IHRoaXMgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHJldHVybiB3YXNIaWRkZW4gIT09IHRoaXMuaXNIaWRkZW4oKTtcblx0fVxuXG5cdHByaXZhdGUgX29uRm9jdXNFdmVudChldmVudDogSUJyZWFkY3J1bWJzSXRlbUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKGV2ZW50Lml0ZW0gJiYgdGhpcy5fYnJlYWRjcnVtYnNQaWNrZXJTaG93aW5nKSB7XG5cdFx0XHR0aGlzLl9icmVhZGNydW1ic1BpY2tlcklnbm9yZU9uY2VJdGVtID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5fd2lkZ2V0LnNldFNlbGVjdGlvbihldmVudC5pdGVtKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9vblNlbGVjdEV2ZW50KGV2ZW50OiBJQnJlYWRjcnVtYnNJdGVtRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoIWV2ZW50Lml0ZW0pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoZXZlbnQuaXRlbSA9PT0gdGhpcy5fYnJlYWRjcnVtYnNQaWNrZXJJZ25vcmVPbmNlSXRlbSkge1xuXHRcdFx0dGhpcy5fYnJlYWRjcnVtYnNQaWNrZXJJZ25vcmVPbmNlSXRlbSA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuX3dpZGdldC5zZXRGb2N1c2VkKHVuZGVmaW5lZCk7XG5cdFx0XHR0aGlzLl93aWRnZXQuc2V0U2VsZWN0aW9uKHVuZGVmaW5lZCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBlbGVtZW50IH0gPSBldmVudC5pdGVtIGFzIEZpbGVJdGVtIHwgT3V0bGluZUl0ZW07XG5cdFx0dGhpcy5fZWRpdG9yR3JvdXAuZm9jdXMoKTtcblxuXHRcdGNvbnN0IGdyb3VwID0gdGhpcy5fZ2V0RWRpdG9yR3JvdXAoZXZlbnQucGF5bG9hZCk7XG5cdFx0aWYgKGdyb3VwICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdC8vIHJldmVhbCB0aGUgaXRlbVxuXHRcdFx0dGhpcy5fd2lkZ2V0LnNldEZvY3VzZWQodW5kZWZpbmVkKTtcblx0XHRcdHRoaXMuX3dpZGdldC5zZXRTZWxlY3Rpb24odW5kZWZpbmVkKTtcblx0XHRcdHRoaXMuX3JldmVhbEluRWRpdG9yKGV2ZW50LCBlbGVtZW50LCBncm91cCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2NmVXNlUXVpY2tQaWNrLmdldFZhbHVlKCkpIHtcblx0XHRcdC8vIHVzaW5nIHF1aWNrIHBpY2tcblx0XHRcdHRoaXMuX3dpZGdldC5zZXRGb2N1c2VkKHVuZGVmaW5lZCk7XG5cdFx0XHR0aGlzLl93aWRnZXQuc2V0U2VsZWN0aW9uKHVuZGVmaW5lZCk7XG5cdFx0XHR0aGlzLl9xdWlja0lucHV0U2VydmljZS5xdWlja0FjY2Vzcy5zaG93KGVsZW1lbnQgaW5zdGFuY2VvZiBPdXRsaW5lRWxlbWVudDIgPyAnQCcgOiAnJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gc2hvdyBwaWNrZXJcblx0XHRsZXQgcGlja2VyOiBCcmVhZGNydW1ic1BpY2tlcjtcblx0XHRsZXQgcGlja2VyQW5jaG9yOiB7IHg6IG51bWJlcjsgeTogbnVtYmVyIH07XG5cblx0XHRpbnRlcmZhY2UgSUhpZGVEYXRhIHsgZGlkUGljaz86IGJvb2xlYW47IHNvdXJjZT86IEJyZWFkY3J1bWJzQ29udHJvbCB9XG5cblx0XHR0aGlzLl9jb250ZXh0Vmlld1NlcnZpY2Uuc2hvd0NvbnRleHRWaWV3KHtcblx0XHRcdHJlbmRlcjogKHBhcmVudDogSFRNTEVsZW1lbnQpID0+IHtcblx0XHRcdFx0aWYgKGV2ZW50Lml0ZW0gaW5zdGFuY2VvZiBGaWxlSXRlbSkge1xuXHRcdFx0XHRcdHBpY2tlciA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEJyZWFkY3J1bWJzRmlsZVBpY2tlciwgcGFyZW50LCBldmVudC5pdGVtLm1vZGVsLnJlc291cmNlKTtcblx0XHRcdFx0fSBlbHNlIGlmIChldmVudC5pdGVtIGluc3RhbmNlb2YgT3V0bGluZUl0ZW0pIHtcblx0XHRcdFx0XHRwaWNrZXIgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShCcmVhZGNydW1ic091dGxpbmVQaWNrZXIsIHBhcmVudCwgZXZlbnQuaXRlbS5tb2RlbC5yZXNvdXJjZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBzZWxlY3RMaXN0ZW5lciA9IHBpY2tlci5vbldpbGxQaWNrRWxlbWVudCgoKSA9PiB0aGlzLl9jb250ZXh0Vmlld1NlcnZpY2UuaGlkZUNvbnRleHRWaWV3KHsgc291cmNlOiB0aGlzLCBkaWRQaWNrOiB0cnVlIH0pKTtcblx0XHRcdFx0Y29uc3Qgem9vbUxpc3RlbmVyID0gUGl4ZWxSYXRpby5nZXRJbnN0YW5jZShkb20uZ2V0V2luZG93KHRoaXMuZG9tTm9kZSkpLm9uRGlkQ2hhbmdlKCgpID0+IHRoaXMuX2NvbnRleHRWaWV3U2VydmljZS5oaWRlQ29udGV4dFZpZXcoeyBzb3VyY2U6IHRoaXMgfSkpO1xuXG5cdFx0XHRcdGNvbnN0IGZvY3VzVHJhY2tlciA9IGRvbS50cmFja0ZvY3VzKHBhcmVudCk7XG5cdFx0XHRcdGNvbnN0IGJsdXJMaXN0ZW5lciA9IGZvY3VzVHJhY2tlci5vbkRpZEJsdXIoKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMuX2JyZWFkY3J1bWJzUGlja2VySWdub3JlT25jZUl0ZW0gPSB0aGlzLl93aWRnZXQuaXNET01Gb2N1c2VkKCkgPyBldmVudC5pdGVtIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRcdHRoaXMuX2NvbnRleHRWaWV3U2VydmljZS5oaWRlQ29udGV4dFZpZXcoeyBzb3VyY2U6IHRoaXMgfSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRoaXMuX2JyZWFkY3J1bWJzUGlja2VyU2hvd2luZyA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZUNrQnJlYWRjcnVtYnNBY3RpdmUoKTtcblxuXHRcdFx0XHRyZXR1cm4gY29tYmluZWREaXNwb3NhYmxlKFxuXHRcdFx0XHRcdHBpY2tlcixcblx0XHRcdFx0XHRzZWxlY3RMaXN0ZW5lcixcblx0XHRcdFx0XHR6b29tTGlzdGVuZXIsXG5cdFx0XHRcdFx0Zm9jdXNUcmFja2VyLFxuXHRcdFx0XHRcdGJsdXJMaXN0ZW5lclxuXHRcdFx0XHQpO1xuXHRcdFx0fSxcblx0XHRcdGdldEFuY2hvcjogKCkgPT4ge1xuXHRcdFx0XHRpZiAoIXBpY2tlckFuY2hvcikge1xuXHRcdFx0XHRcdGNvbnN0IHdpbmRvdyA9IGRvbS5nZXRXaW5kb3codGhpcy5kb21Ob2RlKTtcblx0XHRcdFx0XHRjb25zdCBtYXhJbm5lcldpZHRoID0gd2luZG93LmlubmVyV2lkdGggLSA4IC8qYSBsaXR0bGUgbGVzcyB0aGUgZnVsbCB3aWRnZXQqLztcblx0XHRcdFx0XHRsZXQgbWF4SGVpZ2h0ID0gTWF0aC5taW4od2luZG93LmlubmVySGVpZ2h0ICogMC43LCAzMDApO1xuXG5cdFx0XHRcdFx0Y29uc3QgcGlja2VyV2lkdGggPSBNYXRoLm1pbihtYXhJbm5lcldpZHRoLCBNYXRoLm1heCgyNDAsIG1heElubmVyV2lkdGggLyA0LjE3KSk7XG5cdFx0XHRcdFx0Y29uc3QgcGlja2VyQXJyb3dTaXplID0gODtcblx0XHRcdFx0XHRsZXQgcGlja2VyQXJyb3dPZmZzZXQ6IG51bWJlcjtcblxuXHRcdFx0XHRcdGNvbnN0IGRhdGEgPSBkb20uZ2V0RG9tTm9kZVBhZ2VQb3NpdGlvbihldmVudC5ub2RlLmZpcnN0Q2hpbGQgYXMgSFRNTEVsZW1lbnQpO1xuXHRcdFx0XHRcdGNvbnN0IHkgPSBkYXRhLnRvcCArIGRhdGEuaGVpZ2h0ICsgcGlja2VyQXJyb3dTaXplO1xuXHRcdFx0XHRcdGlmICh5ICsgbWF4SGVpZ2h0ID49IHdpbmRvdy5pbm5lckhlaWdodCkge1xuXHRcdFx0XHRcdFx0bWF4SGVpZ2h0ID0gd2luZG93LmlubmVySGVpZ2h0IC0geSAtIDMwIC8qIHJvb20gZm9yIHNoYWRvdyBhbmQgc3RhdHVzIGJhciovO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRsZXQgeCA9IGRhdGEubGVmdDtcblx0XHRcdFx0XHRpZiAoeCArIHBpY2tlcldpZHRoID49IG1heElubmVyV2lkdGgpIHtcblx0XHRcdFx0XHRcdHggPSBtYXhJbm5lcldpZHRoIC0gcGlja2VyV2lkdGg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChldmVudC5wYXlsb2FkIGluc3RhbmNlb2YgU3RhbmRhcmRNb3VzZUV2ZW50KSB7XG5cdFx0XHRcdFx0XHRjb25zdCBtYXhQaWNrZXJBcnJvd09mZnNldCA9IHBpY2tlcldpZHRoIC0gMiAqIHBpY2tlckFycm93U2l6ZTtcblx0XHRcdFx0XHRcdHBpY2tlckFycm93T2Zmc2V0ID0gZXZlbnQucGF5bG9hZC5wb3N4IC0geDtcblx0XHRcdFx0XHRcdGlmIChwaWNrZXJBcnJvd09mZnNldCA+IG1heFBpY2tlckFycm93T2Zmc2V0KSB7XG5cdFx0XHRcdFx0XHRcdHggPSBNYXRoLm1pbihtYXhJbm5lcldpZHRoIC0gcGlja2VyV2lkdGgsIHggKyBwaWNrZXJBcnJvd09mZnNldCAtIG1heFBpY2tlckFycm93T2Zmc2V0KTtcblx0XHRcdFx0XHRcdFx0cGlja2VyQXJyb3dPZmZzZXQgPSBtYXhQaWNrZXJBcnJvd09mZnNldDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cGlja2VyQXJyb3dPZmZzZXQgPSAoZGF0YS5sZWZ0ICsgKGRhdGEud2lkdGggKiAwLjMpKSAtIHg7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHBpY2tlci5zaG93KGVsZW1lbnQsIG1heEhlaWdodCwgcGlja2VyV2lkdGgsIHBpY2tlckFycm93U2l6ZSwgTWF0aC5tYXgoMCwgcGlja2VyQXJyb3dPZmZzZXQpKTtcblx0XHRcdFx0XHRwaWNrZXJBbmNob3IgPSB7IHgsIHkgfTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcGlja2VyQW5jaG9yO1xuXHRcdFx0fSxcblx0XHRcdG9uSGlkZTogKGRhdGE/OiBJSGlkZURhdGEpID0+IHtcblx0XHRcdFx0aWYgKCFkYXRhPy5kaWRQaWNrKSB7XG5cdFx0XHRcdFx0cGlja2VyLnJlc3RvcmVWaWV3U3RhdGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9icmVhZGNydW1ic1BpY2tlclNob3dpbmcgPSBmYWxzZTtcblx0XHRcdFx0dGhpcy5fdXBkYXRlQ2tCcmVhZGNydW1ic0FjdGl2ZSgpO1xuXHRcdFx0XHRpZiAoZGF0YT8uc291cmNlID09PSB0aGlzKSB7XG5cdFx0XHRcdFx0dGhpcy5fd2lkZ2V0LnNldEZvY3VzZWQodW5kZWZpbmVkKTtcblx0XHRcdFx0XHR0aGlzLl93aWRnZXQuc2V0U2VsZWN0aW9uKHVuZGVmaW5lZCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cGlja2VyLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUNrQnJlYWRjcnVtYnNBY3RpdmUoKTogdm9pZCB7XG5cdFx0Y29uc3QgdmFsdWUgPSB0aGlzLl93aWRnZXQuaXNET01Gb2N1c2VkKCkgfHwgdGhpcy5fYnJlYWRjcnVtYnNQaWNrZXJTaG93aW5nO1xuXHRcdHRoaXMuX2NrQnJlYWRjcnVtYnNBY3RpdmUuc2V0KHZhbHVlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3JldmVhbEluRWRpdG9yKGV2ZW50OiBJQnJlYWRjcnVtYnNJdGVtRXZlbnQsIGVsZW1lbnQ6IEZpbGVFbGVtZW50IHwgT3V0bGluZUVsZW1lbnQyLCBncm91cDogU0lERV9HUk9VUF9UWVBFIHwgQUNUSVZFX0dST1VQX1RZUEUgfCB1bmRlZmluZWQsIHBpbm5lZDogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEZpbGVFbGVtZW50KSB7XG5cdFx0XHRpZiAoZWxlbWVudC5raW5kID09PSBGaWxlS2luZC5GSUxFKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuX2VkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7IHJlc291cmNlOiBlbGVtZW50LnVyaSwgb3B0aW9uczogeyBwaW5uZWQgfSB9LCBncm91cCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBzaG93IG5leHQgcGlja2VyXG5cdFx0XHRcdGNvbnN0IGl0ZW1zID0gdGhpcy5fd2lkZ2V0LmdldEl0ZW1zKCk7XG5cdFx0XHRcdGNvbnN0IGlkeCA9IGl0ZW1zLmluZGV4T2YoZXZlbnQuaXRlbSk7XG5cdFx0XHRcdHRoaXMuX3dpZGdldC5zZXRGb2N1c2VkKGl0ZW1zW2lkeCArIDFdKTtcblx0XHRcdFx0dGhpcy5fd2lkZ2V0LnNldFNlbGVjdGlvbihpdGVtc1tpZHggKyAxXSwgQnJlYWRjcnVtYnNDb250cm9sLlBheWxvYWRfUGljayk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGVsZW1lbnQub3V0bGluZS5yZXZlYWwoZWxlbWVudCwgeyBwaW5uZWQgfSwgZ3JvdXAgPT09IFNJREVfR1JPVVAsIGZhbHNlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9nZXRFZGl0b3JHcm91cChkYXRhOiBvYmplY3QpOiBTSURFX0dST1VQX1RZUEUgfCBBQ1RJVkVfR1JPVVBfVFlQRSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKGRhdGEgPT09IEJyZWFkY3J1bWJzQ29udHJvbC5QYXlsb2FkX1JldmVhbEFzaWRlKSB7XG5cdFx0XHRyZXR1cm4gU0lERV9HUk9VUDtcblx0XHR9IGVsc2UgaWYgKGRhdGEgPT09IEJyZWFkY3J1bWJzQ29udHJvbC5QYXlsb2FkX1JldmVhbCkge1xuXHRcdFx0cmV0dXJuIEFDVElWRV9HUk9VUDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEJyZWFkY3J1bWJzQ29udHJvbEZhY3Rvcnkge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2Rpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jb250cm9sRGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSBfY29udHJvbDogQnJlYWRjcnVtYnNDb250cm9sIHwgdW5kZWZpbmVkO1xuXHRnZXQgY29udHJvbCgpIHsgcmV0dXJuIHRoaXMuX2NvbnRyb2w7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEVuYWJsZW1lbnRDaGFuZ2UgPSB0aGlzLl9kaXNwb3NhYmxlcy5hZGQobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdGdldCBvbkRpZEVuYWJsZW1lbnRDaGFuZ2UoKSB7IHJldHVybiB0aGlzLl9vbkRpZEVuYWJsZW1lbnRDaGFuZ2UuZXZlbnQ7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFZpc2liaWxpdHlDaGFuZ2UgPSB0aGlzLl9kaXNwb3NhYmxlcy5hZGQobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdGdldCBvbkRpZFZpc2liaWxpdHlDaGFuZ2UoKSB7IHJldHVybiB0aGlzLl9vbkRpZFZpc2liaWxpdHlDaGFuZ2UuZXZlbnQ7IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvckdyb3VwOiBJRWRpdG9yR3JvdXBWaWV3LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29wdGlvbnM6IElCcmVhZGNydW1ic0NvbnRyb2xPcHRpb25zLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlXG5cdCkge1xuXHRcdGNvbnN0IGNvbmZpZyA9IHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChCcmVhZGNydW1ic0NvbmZpZy5Jc0VuYWJsZWQuYmluZFRvKGNvbmZpZ3VyYXRpb25TZXJ2aWNlKSk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKGNvbmZpZy5vbkRpZENoYW5nZSgoKSA9PiB7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IGNvbmZpZy5nZXRWYWx1ZSgpO1xuXHRcdFx0aWYgKCF2YWx1ZSAmJiB0aGlzLl9jb250cm9sKSB7XG5cdFx0XHRcdHRoaXMuX2NvbnRyb2xEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdFx0XHR0aGlzLl9jb250cm9sID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR0aGlzLl9vbkRpZEVuYWJsZW1lbnRDaGFuZ2UuZmlyZSgpO1xuXHRcdFx0fSBlbHNlIGlmICh2YWx1ZSAmJiAhdGhpcy5fY29udHJvbCkge1xuXHRcdFx0XHR0aGlzLl9jb250cm9sID0gdGhpcy5jcmVhdGVDb250cm9sKCk7XG5cdFx0XHRcdHRoaXMuX2NvbnRyb2wudXBkYXRlKCk7XG5cdFx0XHRcdHRoaXMuX29uRGlkRW5hYmxlbWVudENoYW5nZS5maXJlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0aWYgKGNvbmZpZy5nZXRWYWx1ZSgpKSB7XG5cdFx0XHR0aGlzLl9jb250cm9sID0gdGhpcy5jcmVhdGVDb250cm9sKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKGZpbGVTZXJ2aWNlLm9uRGlkQ2hhbmdlRmlsZVN5c3RlbVByb3ZpZGVyUmVnaXN0cmF0aW9ucyhlID0+IHtcblx0XHRcdGlmICh0aGlzLl9jb250cm9sPy5tb2RlbCAmJiB0aGlzLl9jb250cm9sLm1vZGVsLnJlc291cmNlLnNjaGVtZSAhPT0gZS5zY2hlbWUpIHtcblx0XHRcdFx0Ly8gaWdub3JlIGlmIHRoZSBzY2hlbWUgb2YgdGhlIGJyZWFkY3J1bWJzIHJlc291cmNlIGlzIG5vdCBhZmZlY3RlZFxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5fY29udHJvbD8udXBkYXRlKCkpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRFbmFibGVtZW50Q2hhbmdlLmZpcmUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUNvbnRyb2woKTogQnJlYWRjcnVtYnNDb250cm9sIHtcblx0XHRjb25zdCBjb250cm9sID0gdGhpcy5fY29udHJvbERpc3Bvc2FibGVzLmFkZCh0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShCcmVhZGNydW1ic0NvbnRyb2wsIHRoaXMuX2NvbnRhaW5lciwgdGhpcy5fb3B0aW9ucywgdGhpcy5fZWRpdG9yR3JvdXApKTtcblx0XHR0aGlzLl9jb250cm9sRGlzcG9zYWJsZXMuYWRkKGNvbnRyb2wub25EaWRWaXNpYmlsaXR5Q2hhbmdlKCgpID0+IHRoaXMuX29uRGlkVmlzaWJpbGl0eUNoYW5nZS5maXJlKCkpKTtcblxuXHRcdHJldHVybiBjb250cm9sO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fY29udHJvbERpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxufVxuXG4vLyNyZWdpb24gY29tbWFuZHNcblxuLy8gdG9nZ2xlIGNvbW1hbmRcbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBUb2dnbGVCcmVhZGNydW1iIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdicmVhZGNydW1icy50b2dnbGUnLFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0Li4ubG9jYWxpemUyKCdjbWQudG9nZ2xlJywgXCJUb2dnbGUgQnJlYWRjcnVtYnNcIiksXG5cdFx0XHRcdG1uZW1vbmljVGl0bGU6IGxvY2FsaXplKHsga2V5OiAnbWlCcmVhZGNydW1icycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJUb2dnbGUgJiZCcmVhZGNydW1ic1wiKSxcblx0XHRcdH0sXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0dG9nZ2xlZDoge1xuXHRcdFx0XHRjb25kaXRpb246IENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLmJyZWFkY3J1bWJzLmVuYWJsZWQnLCB0cnVlKSxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdjbWQudG9nZ2xlMicsIFwiVG9nZ2xlIEJyZWFkY3J1bWJzXCIpLFxuXHRcdFx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pQnJlYWRjcnVtYnMyJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIlRvZ2dsZSAmJkJyZWFkY3J1bWJzXCIpXG5cdFx0XHR9LFxuXHRcdFx0bWVudTogW1xuXHRcdFx0XHR7IGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUgfSxcblx0XHRcdFx0eyBpZDogTWVudUlkLk1lbnViYXJBcHBlYXJhbmNlTWVudSwgZ3JvdXA6ICc0X2VkaXRvcicsIG9yZGVyOiAyIH0sXG5cdFx0XHRcdHsgaWQ6IE1lbnVJZC5Ob3RlYm9va1Rvb2xiYXIsIGdyb3VwOiAnbm90ZWJvb2tMYXlvdXQnLCBvcmRlcjogMiB9LFxuXHRcdFx0XHR7IGlkOiBNZW51SWQuU3RpY2t5U2Nyb2xsQ29udGV4dCB9LFxuXHRcdFx0XHR7IGlkOiBNZW51SWQuTm90ZWJvb2tTdGlja3lTY3JvbGxDb250ZXh0LCBncm91cDogJ25vdGVib29rVmlldycsIG9yZGVyOiAyIH0sXG5cdFx0XHRcdHsgaWQ6IE1lbnVJZC5Ob3RlYm9va1Rvb2xiYXJDb250ZXh0LCBncm91cDogJ25vdGVib29rVmlldycsIG9yZGVyOiAyIH1cblx0XHRcdF1cblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGNvbnN0IGNvbmZpZyA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IHZhbHVlID0gQnJlYWRjcnVtYnNDb25maWcuSXNFbmFibGVkLmJpbmRUbyhjb25maWcpLmdldFZhbHVlKCk7XG5cdFx0QnJlYWRjcnVtYnNDb25maWcuSXNFbmFibGVkLmJpbmRUbyhjb25maWcpLnVwZGF0ZVZhbHVlKCF2YWx1ZSk7XG5cdH1cblxufSk7XG5cbi8vIGZvY3VzL2ZvY3VzLWFuZC1zZWxlY3RcbmZ1bmN0aW9uIGZvY3VzQW5kU2VsZWN0SGFuZGxlcihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgc2VsZWN0OiBib29sZWFuKTogdm9pZCB7XG5cdC8vIGZpbmQgd2lkZ2V0IGFuZCBmb2N1cy9zZWxlY3Rcblx0Y29uc3QgZ3JvdXBzID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblx0Y29uc3QgYnJlYWRjcnVtYnMgPSBhY2Nlc3Nvci5nZXQoSUJyZWFkY3J1bWJzU2VydmljZSk7XG5cdGNvbnN0IHdpZGdldCA9IGJyZWFkY3J1bWJzLmdldFdpZGdldChncm91cHMuYWN0aXZlR3JvdXAuaWQpO1xuXHRpZiAod2lkZ2V0KSB7XG5cdFx0Y29uc3QgaXRlbSA9IHdpZGdldC5nZXRJdGVtcygpLmF0KC0xKTtcblx0XHR3aWRnZXQuc2V0Rm9jdXNlZChpdGVtKTtcblx0XHRpZiAoc2VsZWN0KSB7XG5cdFx0XHR3aWRnZXQuc2V0U2VsZWN0aW9uKGl0ZW0sIEJyZWFkY3J1bWJzQ29udHJvbC5QYXlsb2FkX1BpY2spO1xuXHRcdH1cblx0fVxufVxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEZvY3VzQW5kU2VsZWN0QnJlYWRjcnVtYnMgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdicmVhZGNydW1icy5mb2N1c0FuZFNlbGVjdCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdjbWQuZm9jdXNBbmRTZWxlY3QnLCBcIkZvY3VzIGFuZCBTZWxlY3QgQnJlYWRjcnVtYnNcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IEJyZWFkY3J1bWJzQ29udHJvbC5DS19CcmVhZGNydW1ic1Zpc2libGUsXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuUGVyaW9kLFxuXHRcdFx0XHR3aGVuOiBCcmVhZGNydW1ic0NvbnRyb2wuQ0tfQnJlYWRjcnVtYnNQb3NzaWJsZSxcblx0XHRcdH0sXG5cdFx0XHRmMTogdHJ1ZVxuXHRcdH0pO1xuXHR9XG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pOiB2b2lkIHtcblx0XHRmb2N1c0FuZFNlbGVjdEhhbmRsZXIoYWNjZXNzb3IsIHRydWUpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEZvY3VzQnJlYWRjcnVtYnMgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdicmVhZGNydW1icy5mb2N1cycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdjbWQuZm9jdXMnLCBcIkZvY3VzIEJyZWFkY3J1bWJzXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBCcmVhZGNydW1ic0NvbnRyb2wuQ0tfQnJlYWRjcnVtYnNWaXNpYmxlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLlNlbWljb2xvbixcblx0XHRcdFx0d2hlbjogQnJlYWRjcnVtYnNDb250cm9sLkNLX0JyZWFkY3J1bWJzUG9zc2libGUsXG5cdFx0XHR9LFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0Zm9jdXNBbmRTZWxlY3RIYW5kbGVyKGFjY2Vzc29yLCBmYWxzZSk7XG5cdH1cbn0pO1xuXG4vLyB0aGlzIGNvbW1hbmRzIGlzIG9ubHkgZW5hYmxlZCB3aGVuIGJyZWFkY3J1bWJzIGFyZVxuLy8gZGlzYWJsZWQgd2hpY2ggaXQgdGhlbiBlbmFibGVzIGFuZCBmb2N1c2VzXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6ICdicmVhZGNydW1icy50b2dnbGVUb09uJyxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5QZXJpb2QsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLm5vdCgnY29uZmlnLmJyZWFkY3J1bWJzLmVuYWJsZWQnKSxcblx0aGFuZGxlcjogYXN5bmMgYWNjZXNzb3IgPT4ge1xuXHRcdGNvbnN0IGluc3RhbnQgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBjb25maWcgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHQvLyBjaGVjayBpZiBlbmFibGVkIGFuZCBpZmYgbm90IGVuYWJsZVxuXHRcdGNvbnN0IGlzRW5hYmxlZCA9IEJyZWFkY3J1bWJzQ29uZmlnLklzRW5hYmxlZC5iaW5kVG8oY29uZmlnKTtcblx0XHRpZiAoIWlzRW5hYmxlZC5nZXRWYWx1ZSgpKSB7XG5cdFx0XHRhd2FpdCBpc0VuYWJsZWQudXBkYXRlVmFsdWUodHJ1ZSk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwKTsgLy8gaGFja3kgLSB0aGUgd2lkZ2V0IG1pZ2h0IG5vdCBiZSByZWFkeSB5ZXQuLi5cblx0XHR9XG5cdFx0cmV0dXJuIGluc3RhbnQuaW52b2tlRnVuY3Rpb24oZm9jdXNBbmRTZWxlY3RIYW5kbGVyLCB0cnVlKTtcblx0fVxufSk7XG5cbi8vIG5hdmlnYXRpb25cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogJ2JyZWFkY3J1bWJzLmZvY3VzTmV4dCcsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRwcmltYXJ5OiBLZXlDb2RlLlJpZ2h0QXJyb3csXG5cdHNlY29uZGFyeTogW0tleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5SaWdodEFycm93XSxcblx0bWFjOiB7XG5cdFx0cHJpbWFyeTogS2V5Q29kZS5SaWdodEFycm93LFxuXHRcdHNlY29uZGFyeTogW0tleU1vZC5BbHQgfCBLZXlDb2RlLlJpZ2h0QXJyb3ddLFxuXHR9LFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQnJlYWRjcnVtYnNDb250cm9sLkNLX0JyZWFkY3J1bWJzVmlzaWJsZSwgQnJlYWRjcnVtYnNDb250cm9sLkNLX0JyZWFkY3J1bWJzQWN0aXZlKSxcblx0aGFuZGxlcihhY2Nlc3Nvcikge1xuXHRcdGNvbnN0IGdyb3VwcyA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cdFx0Y29uc3QgYnJlYWRjcnVtYnMgPSBhY2Nlc3Nvci5nZXQoSUJyZWFkY3J1bWJzU2VydmljZSk7XG5cdFx0Y29uc3Qgd2lkZ2V0ID0gYnJlYWRjcnVtYnMuZ2V0V2lkZ2V0KGdyb3Vwcy5hY3RpdmVHcm91cC5pZCk7XG5cdFx0aWYgKCF3aWRnZXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0d2lkZ2V0LmZvY3VzTmV4dCgpO1xuXHR9XG59KTtcbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogJ2JyZWFkY3J1bWJzLmZvY3VzUHJldmlvdXMnLFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0cHJpbWFyeTogS2V5Q29kZS5MZWZ0QXJyb3csXG5cdHNlY29uZGFyeTogW0tleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5MZWZ0QXJyb3ddLFxuXHRtYWM6IHtcblx0XHRwcmltYXJ5OiBLZXlDb2RlLkxlZnRBcnJvdyxcblx0XHRzZWNvbmRhcnk6IFtLZXlNb2QuQWx0IHwgS2V5Q29kZS5MZWZ0QXJyb3ddLFxuXHR9LFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQnJlYWRjcnVtYnNDb250cm9sLkNLX0JyZWFkY3J1bWJzVmlzaWJsZSwgQnJlYWRjcnVtYnNDb250cm9sLkNLX0JyZWFkY3J1bWJzQWN0aXZlKSxcblx0aGFuZGxlcihhY2Nlc3Nvcikge1xuXHRcdGNvbnN0IGdyb3VwcyA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cdFx0Y29uc3QgYnJlYWRjcnVtYnMgPSBhY2Nlc3Nvci5nZXQoSUJyZWFkY3J1bWJzU2VydmljZSk7XG5cdFx0Y29uc3Qgd2lkZ2V0ID0gYnJlYWRjcnVtYnMuZ2V0V2lkZ2V0KGdyb3Vwcy5hY3RpdmVHcm91cC5pZCk7XG5cdFx0aWYgKCF3aWRnZXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0d2lkZ2V0LmZvY3VzUHJldigpO1xuXHR9XG59KTtcbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogJ2JyZWFkY3J1bWJzLmZvY3VzTmV4dFdpdGhQaWNrZXInLFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIDEsXG5cdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5SaWdodEFycm93LFxuXHRtYWM6IHtcblx0XHRwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5Q29kZS5SaWdodEFycm93LFxuXHR9LFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQnJlYWRjcnVtYnNDb250cm9sLkNLX0JyZWFkY3J1bWJzVmlzaWJsZSwgQnJlYWRjcnVtYnNDb250cm9sLkNLX0JyZWFkY3J1bWJzQWN0aXZlLCBXb3JrYmVuY2hMaXN0Rm9jdXNDb250ZXh0S2V5KSxcblx0aGFuZGxlcihhY2Nlc3Nvcikge1xuXHRcdGNvbnN0IGdyb3VwcyA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cdFx0Y29uc3QgYnJlYWRjcnVtYnMgPSBhY2Nlc3Nvci5nZXQoSUJyZWFkY3J1bWJzU2VydmljZSk7XG5cdFx0Y29uc3Qgd2lkZ2V0ID0gYnJlYWRjcnVtYnMuZ2V0V2lkZ2V0KGdyb3Vwcy5hY3RpdmVHcm91cC5pZCk7XG5cdFx0aWYgKCF3aWRnZXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0d2lkZ2V0LmZvY3VzTmV4dCgpO1xuXHR9XG59KTtcbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogJ2JyZWFkY3J1bWJzLmZvY3VzUHJldmlvdXNXaXRoUGlja2VyJyxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIgKyAxLFxuXHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuTGVmdEFycm93LFxuXHRtYWM6IHtcblx0XHRwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5Q29kZS5MZWZ0QXJyb3csXG5cdH0sXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChCcmVhZGNydW1ic0NvbnRyb2wuQ0tfQnJlYWRjcnVtYnNWaXNpYmxlLCBCcmVhZGNydW1ic0NvbnRyb2wuQ0tfQnJlYWRjcnVtYnNBY3RpdmUsIFdvcmtiZW5jaExpc3RGb2N1c0NvbnRleHRLZXkpLFxuXHRoYW5kbGVyKGFjY2Vzc29yKSB7XG5cdFx0Y29uc3QgZ3JvdXBzID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblx0XHRjb25zdCBicmVhZGNydW1icyA9IGFjY2Vzc29yLmdldChJQnJlYWRjcnVtYnNTZXJ2aWNlKTtcblx0XHRjb25zdCB3aWRnZXQgPSBicmVhZGNydW1icy5nZXRXaWRnZXQoZ3JvdXBzLmFjdGl2ZUdyb3VwLmlkKTtcblx0XHRpZiAoIXdpZGdldCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR3aWRnZXQuZm9jdXNQcmV2KCk7XG5cdH1cbn0pO1xuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiAnYnJlYWRjcnVtYnMuc2VsZWN0Rm9jdXNlZCcsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRwcmltYXJ5OiBLZXlDb2RlLkVudGVyLFxuXHRzZWNvbmRhcnk6IFtLZXlDb2RlLkRvd25BcnJvd10sXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChCcmVhZGNydW1ic0NvbnRyb2wuQ0tfQnJlYWRjcnVtYnNWaXNpYmxlLCBCcmVhZGNydW1ic0NvbnRyb2wuQ0tfQnJlYWRjcnVtYnNBY3RpdmUpLFxuXHRoYW5kbGVyKGFjY2Vzc29yKSB7XG5cdFx0Y29uc3QgZ3JvdXBzID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblx0XHRjb25zdCBicmVhZGNydW1icyA9IGFjY2Vzc29yLmdldChJQnJlYWRjcnVtYnNTZXJ2aWNlKTtcblx0XHRjb25zdCB3aWRnZXQgPSBicmVhZGNydW1icy5nZXRXaWRnZXQoZ3JvdXBzLmFjdGl2ZUdyb3VwLmlkKTtcblx0XHRpZiAoIXdpZGdldCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR3aWRnZXQuc2V0U2VsZWN0aW9uKHdpZGdldC5nZXRGb2N1c2VkKCksIEJyZWFkY3J1bWJzQ29udHJvbC5QYXlsb2FkX1BpY2spO1xuXHR9XG59KTtcbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogJ2JyZWFkY3J1bWJzLnJldmVhbEZvY3VzZWQnLFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0cHJpbWFyeTogS2V5Q29kZS5TcGFjZSxcblx0c2Vjb25kYXJ5OiBbS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkVudGVyXSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKEJyZWFkY3J1bWJzQ29udHJvbC5DS19CcmVhZGNydW1ic1Zpc2libGUsIEJyZWFkY3J1bWJzQ29udHJvbC5DS19CcmVhZGNydW1ic0FjdGl2ZSksXG5cdGhhbmRsZXIoYWNjZXNzb3IpIHtcblx0XHRjb25zdCBncm91cHMgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpO1xuXHRcdGNvbnN0IGJyZWFkY3J1bWJzID0gYWNjZXNzb3IuZ2V0KElCcmVhZGNydW1ic1NlcnZpY2UpO1xuXHRcdGNvbnN0IHdpZGdldCA9IGJyZWFkY3J1bWJzLmdldFdpZGdldChncm91cHMuYWN0aXZlR3JvdXAuaWQpO1xuXHRcdGlmICghd2lkZ2V0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHdpZGdldC5zZXRTZWxlY3Rpb24od2lkZ2V0LmdldEZvY3VzZWQoKSwgQnJlYWRjcnVtYnNDb250cm9sLlBheWxvYWRfUmV2ZWFsKTtcblx0fVxufSk7XG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6ICdicmVhZGNydW1icy5zZWxlY3RFZGl0b3InLFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIDEsXG5cdHByaW1hcnk6IEtleUNvZGUuRXNjYXBlLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQnJlYWRjcnVtYnNDb250cm9sLkNLX0JyZWFkY3J1bWJzVmlzaWJsZSwgQnJlYWRjcnVtYnNDb250cm9sLkNLX0JyZWFkY3J1bWJzQWN0aXZlKSxcblx0aGFuZGxlcihhY2Nlc3Nvcikge1xuXHRcdGNvbnN0IGdyb3VwcyA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cdFx0Y29uc3QgYnJlYWRjcnVtYnMgPSBhY2Nlc3Nvci5nZXQoSUJyZWFkY3J1bWJzU2VydmljZSk7XG5cdFx0Y29uc3Qgd2lkZ2V0ID0gYnJlYWRjcnVtYnMuZ2V0V2lkZ2V0KGdyb3Vwcy5hY3RpdmVHcm91cC5pZCk7XG5cdFx0aWYgKCF3aWRnZXQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0d2lkZ2V0LnNldEZvY3VzZWQodW5kZWZpbmVkKTtcblx0XHR3aWRnZXQuc2V0U2VsZWN0aW9uKHVuZGVmaW5lZCk7XG5cdFx0Z3JvdXBzLmFjdGl2ZUdyb3VwLmFjdGl2ZUVkaXRvclBhbmU/LmZvY3VzKCk7XG5cdH1cbn0pO1xuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiAnYnJlYWRjcnVtYnMucmV2ZWFsRm9jdXNlZEZyb21UcmVlQXNpZGUnLFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkVudGVyLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQnJlYWRjcnVtYnNDb250cm9sLkNLX0JyZWFkY3J1bWJzVmlzaWJsZSwgQnJlYWRjcnVtYnNDb250cm9sLkNLX0JyZWFkY3J1bWJzQWN0aXZlLCBXb3JrYmVuY2hMaXN0Rm9jdXNDb250ZXh0S2V5KSxcblx0aGFuZGxlcihhY2Nlc3Nvcikge1xuXHRcdGNvbnN0IGVkaXRvcnMgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGxpc3RzID0gYWNjZXNzb3IuZ2V0KElMaXN0U2VydmljZSk7XG5cblx0XHRjb25zdCB0cmVlID0gbGlzdHMubGFzdEZvY3VzZWRMaXN0O1xuXHRcdGlmICghKHRyZWUgaW5zdGFuY2VvZiBXb3JrYmVuY2hEYXRhVHJlZSkgJiYgISh0cmVlIGluc3RhbmNlb2YgV29ya2JlbmNoQXN5bmNEYXRhVHJlZSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlbGVtZW50ID0gPElGaWxlU3RhdCB8IHVua25vd24+dHJlZS5nZXRGb2N1cygpWzBdO1xuXG5cdFx0aWYgKFVSSS5pc1VyaSgoPElGaWxlU3RhdD5lbGVtZW50KT8ucmVzb3VyY2UpKSB7XG5cdFx0XHQvLyBJRmlsZVN0YXQ6IG9wZW4gZmlsZSBpbiBlZGl0b3Jcblx0XHRcdHJldHVybiBlZGl0b3JzLm9wZW5FZGl0b3Ioe1xuXHRcdFx0XHRyZXNvdXJjZTogKDxJRmlsZVN0YXQ+ZWxlbWVudCkucmVzb3VyY2UsXG5cdFx0XHRcdG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH1cblx0XHRcdH0sIFNJREVfR1JPVVApO1xuXHRcdH1cblxuXHRcdC8vIElPdXRsaW5lOiBjaGVjayBpZiB0aGlzIHRoZSBvdXRsaW5lIGFuZCBpZmYgc28gcmV2ZWFsIGVsZW1lbnRcblx0XHRjb25zdCBpbnB1dCA9IHRyZWUuZ2V0SW5wdXQoKTtcblx0XHRpZiAoaW5wdXQgJiYgdHlwZW9mICg8SU91dGxpbmU8YW55Pj5pbnB1dCkub3V0bGluZUtpbmQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gKDxJT3V0bGluZTxhbnk+PmlucHV0KS5yZXZlYWwoZWxlbWVudCwge1xuXHRcdFx0XHRwaW5uZWQ6IHRydWUsXG5cdFx0XHRcdHByZXNlcnZlRm9jdXM6IGZhbHNlXG5cdFx0XHR9LCB0cnVlLCBmYWxzZSk7XG5cdFx0fVxuXHR9XG59KTtcbi8vI2VuZHJlZ2lvblxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxpQkFBaUIseUJBQTBFO0FBQ3BHLFNBQVMsc0JBQXNCO0FBRS9CLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsZUFBZTtBQUN4QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsU0FBUyxjQUFjO0FBQ2hDLFNBQVMsb0JBQW9CLGlCQUE4QixtQkFBbUIsb0JBQW9CO0FBQ2xHLFNBQVMsVUFBVSxjQUFjO0FBQ2pDLFNBQVMsV0FBVztBQUVwQixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFVBQVUsaUJBQWlCO0FBQ3BDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsU0FBUyxRQUFRLHVCQUF1QjtBQUNqRCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdCQUE2QixvQkFBb0IscUJBQXFCO0FBQy9FLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsdUJBQXVCLDhCQUE4QjtBQUM5RCxTQUFTLFVBQVUsb0JBQStCO0FBQ2xELFNBQVMsNkJBQStDO0FBRXhELFNBQVMscUJBQXFCLHdCQUF3QjtBQUN0RCxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGNBQWMsd0JBQXdCLG1CQUFtQixvQ0FBb0M7QUFDdEcsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyx3QkFBNEMsd0JBQXdCO0FBQzdFLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsY0FBaUMsZ0JBQWdCLGtCQUFtQztBQUU3RixTQUFTLHlCQUF5QiwyQkFBMkI7QUFDN0QsU0FBUywwQkFBMEIsc0JBQXNCO0FBQ3pELFNBQVMsbUJBQW1CLDJCQUEyQjtBQUN2RCxTQUFTLGtCQUFrQixhQUFhLHVCQUF1QjtBQUMvRCxTQUFT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
