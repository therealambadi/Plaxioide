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
import { isActiveElement, isKeyboardEvent } from "../../../base/browser/dom.js";
import { PagedList } from "../../../base/browser/ui/list/listPaging.js";
import { isSelectionRangeChangeEvent, isSelectionSingleChangeEvent, List, TypeNavigationMode } from "../../../base/browser/ui/list/listWidget.js";
import { Table } from "../../../base/browser/ui/table/tableWidget.js";
import { TreeFindMatchType, TreeFindMode } from "../../../base/browser/ui/tree/abstractTree.js";
import { AsyncDataTree, CompressibleAsyncDataTree } from "../../../base/browser/ui/tree/asyncDataTree.js";
import { DataTree } from "../../../base/browser/ui/tree/dataTree.js";
import { CompressibleObjectTree, ObjectTree } from "../../../base/browser/ui/tree/objectTree.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { combinedDisposable, Disposable, DisposableStore, dispose, toDisposable } from "../../../base/common/lifecycle.js";
import { localize } from "../../../nls.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { Extensions as ConfigurationExtensions } from "../../configuration/common/configurationRegistry.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../contextkey/common/contextkey.js";
import { InputFocusedContextKey } from "../../contextkey/common/contextkeys.js";
import { IContextViewService } from "../../contextview/browser/contextView.js";
import { createDecorator, IInstantiationService } from "../../instantiation/common/instantiation.js";
import { IKeybindingService } from "../../keybinding/common/keybinding.js";
import { ResultKind } from "../../keybinding/common/keybindingResolver.js";
import { Registry } from "../../registry/common/platform.js";
import { defaultFindWidgetStyles, defaultListStyles, getListStyles } from "../../theme/browser/defaultStyles.js";
const IListService = createDecorator("listService");
class ListService {
  constructor() {
    this.disposables = new DisposableStore();
    this.lists = [];
    this._lastFocusedWidget = void 0;
  }
  get lastFocusedList() {
    return this._lastFocusedWidget;
  }
  setLastFocusedList(widget) {
    if (widget === this._lastFocusedWidget) {
      return;
    }
    this._lastFocusedWidget?.getHTMLElement().classList.remove("last-focused");
    this._lastFocusedWidget = widget;
    this._lastFocusedWidget?.getHTMLElement().classList.add("last-focused");
  }
  register(widget, extraContextKeys) {
    if (this.lists.some((l) => l.widget === widget)) {
      throw new Error("Cannot register the same widget multiple times");
    }
    const registeredList = { widget, extraContextKeys };
    this.lists.push(registeredList);
    if (isActiveElement(widget.getHTMLElement())) {
      this.setLastFocusedList(widget);
    }
    return combinedDisposable(
      widget.onDidFocus(() => this.setLastFocusedList(widget)),
      toDisposable(() => this.lists.splice(this.lists.indexOf(registeredList), 1)),
      widget.onDidDispose(() => {
        this.lists = this.lists.filter((l) => l !== registeredList);
        if (this._lastFocusedWidget === widget) {
          this.setLastFocusedList(void 0);
        }
      })
    );
  }
  dispose() {
    this.disposables.dispose();
  }
}
const RawWorkbenchListScrollAtBoundaryContextKey = new RawContextKey("listScrollAtBoundary", "none");
const WorkbenchListScrollAtTopContextKey = ContextKeyExpr.or(
  RawWorkbenchListScrollAtBoundaryContextKey.isEqualTo("top"),
  RawWorkbenchListScrollAtBoundaryContextKey.isEqualTo("both")
);
const WorkbenchListScrollAtBottomContextKey = ContextKeyExpr.or(
  RawWorkbenchListScrollAtBoundaryContextKey.isEqualTo("bottom"),
  RawWorkbenchListScrollAtBoundaryContextKey.isEqualTo("both")
);
const RawWorkbenchListFocusContextKey = new RawContextKey("listFocus", true);
const WorkbenchTreeStickyScrollFocused = new RawContextKey("treestickyScrollFocused", false);
const WorkbenchListSupportsMultiSelectContextKey = new RawContextKey("listSupportsMultiselect", true);
const WorkbenchListFocusContextKey = ContextKeyExpr.and(RawWorkbenchListFocusContextKey, ContextKeyExpr.not(InputFocusedContextKey), WorkbenchTreeStickyScrollFocused.negate());
const WorkbenchListHasSelectionOrFocus = new RawContextKey("listHasSelectionOrFocus", false);
const WorkbenchListDoubleSelection = new RawContextKey("listDoubleSelection", false);
const WorkbenchListMultiSelection = new RawContextKey("listMultiSelection", false);
const WorkbenchListSelectionNavigation = new RawContextKey("listSelectionNavigation", false);
const WorkbenchListSupportsFind = new RawContextKey("listSupportsFind", true);
const WorkbenchTreeElementCanCollapse = new RawContextKey("treeElementCanCollapse", false);
const WorkbenchTreeElementHasParent = new RawContextKey("treeElementHasParent", false);
const WorkbenchTreeElementCanExpand = new RawContextKey("treeElementCanExpand", false);
const WorkbenchTreeElementHasChild = new RawContextKey("treeElementHasChild", false);
const WorkbenchTreeFindOpen = new RawContextKey("treeFindOpen", false);
const WorkbenchListTypeNavigationModeKey = "listTypeNavigationMode";
const WorkbenchListAutomaticKeyboardNavigationLegacyKey = "listAutomaticKeyboardNavigation";
function createScopedContextKeyService(contextKeyService, widget) {
  const result = contextKeyService.createScoped(widget.getHTMLElement());
  RawWorkbenchListFocusContextKey.bindTo(result);
  return result;
}
function createScrollObserver(contextKeyService, widget) {
  const listScrollAt = RawWorkbenchListScrollAtBoundaryContextKey.bindTo(contextKeyService);
  const update = () => {
    const atTop = widget.scrollTop === 0;
    const atBottom = widget.scrollHeight - widget.renderHeight - widget.scrollTop < 1;
    if (atTop && atBottom) {
      listScrollAt.set("both");
    } else if (atTop) {
      listScrollAt.set("top");
    } else if (atBottom) {
      listScrollAt.set("bottom");
    } else {
      listScrollAt.set("none");
    }
  };
  update();
  return widget.onDidScroll(update);
}
const multiSelectModifierSettingKey = "workbench.list.multiSelectModifier";
const openModeSettingKey = "workbench.list.openMode";
const horizontalScrollingKey = "workbench.list.horizontalScrolling";
const defaultFindModeSettingKey = "workbench.list.defaultFindMode";
const typeNavigationModeSettingKey = "workbench.list.typeNavigationMode";
const keyboardNavigationSettingKey = "workbench.list.keyboardNavigation";
const scrollByPageKey = "workbench.list.scrollByPage";
const defaultFindMatchTypeSettingKey = "workbench.list.defaultFindMatchType";
const treeIndentKey = "workbench.tree.indent";
const treeRenderIndentGuidesKey = "workbench.tree.renderIndentGuides";
const listSmoothScrolling = "workbench.list.smoothScrolling";
const mouseWheelScrollSensitivityKey = "workbench.list.mouseWheelScrollSensitivity";
const fastScrollSensitivityKey = "workbench.list.fastScrollSensitivity";
const treeExpandMode = "workbench.tree.expandMode";
const treeStickyScroll = "workbench.tree.enableStickyScroll";
const treeStickyScrollMaxElements = "workbench.tree.stickyScrollMaxItemCount";
function useAltAsMultipleSelectionModifier(configurationService) {
  return configurationService.getValue(multiSelectModifierSettingKey) === "alt";
}
class MultipleSelectionController extends Disposable {
  constructor(configurationService) {
    super();
    this.configurationService = configurationService;
    this.useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(multiSelectModifierSettingKey)) {
        this.useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(this.configurationService);
      }
    }));
  }
  isSelectionSingleChangeEvent(event) {
    if (this.useAltAsMultipleSelectionModifier) {
      return event.browserEvent.altKey;
    }
    return isSelectionSingleChangeEvent(event);
  }
  isSelectionRangeChangeEvent(event) {
    return isSelectionRangeChangeEvent(event);
  }
}
function toWorkbenchListOptions(accessor, options) {
  const configurationService = accessor.get(IConfigurationService);
  const keybindingService = accessor.get(IKeybindingService);
  const disposables = new DisposableStore();
  const result = {
    ...options,
    keyboardNavigationDelegate: { mightProducePrintableCharacter(e) {
      return keybindingService.mightProducePrintableCharacter(e);
    } },
    smoothScrolling: Boolean(configurationService.getValue(listSmoothScrolling)),
    mouseWheelScrollSensitivity: configurationService.getValue(mouseWheelScrollSensitivityKey),
    fastScrollSensitivity: configurationService.getValue(fastScrollSensitivityKey),
    multipleSelectionController: options.multipleSelectionController ?? disposables.add(new MultipleSelectionController(configurationService)),
    keyboardNavigationEventFilter: createKeyboardNavigationEventFilter(keybindingService),
    scrollByPage: Boolean(configurationService.getValue(scrollByPageKey))
  };
  return [result, disposables];
}
let WorkbenchList = class extends List {
  get onDidOpen() {
    return this.navigator.onDidOpen;
  }
  constructor(user, container, delegate, renderers, options, contextKeyService, listService, configurationService, instantiationService) {
    const horizontalScrolling = typeof options.horizontalScrolling !== "undefined" ? options.horizontalScrolling : Boolean(configurationService.getValue(horizontalScrollingKey));
    const [workbenchListOptions, workbenchListOptionsDisposable] = instantiationService.invokeFunction(toWorkbenchListOptions, options);
    super(
      user,
      container,
      delegate,
      renderers,
      {
        keyboardSupport: false,
        ...workbenchListOptions,
        horizontalScrolling
      }
    );
    this.disposables.add(workbenchListOptionsDisposable);
    this.contextKeyService = createScopedContextKeyService(contextKeyService, this);
    this.disposables.add(createScrollObserver(this.contextKeyService, this));
    this.listSupportsMultiSelect = WorkbenchListSupportsMultiSelectContextKey.bindTo(this.contextKeyService);
    this.listSupportsMultiSelect.set(options.multipleSelectionSupport !== false);
    const listSelectionNavigation = WorkbenchListSelectionNavigation.bindTo(this.contextKeyService);
    listSelectionNavigation.set(Boolean(options.selectionNavigation));
    this.listHasSelectionOrFocus = WorkbenchListHasSelectionOrFocus.bindTo(this.contextKeyService);
    this.listDoubleSelection = WorkbenchListDoubleSelection.bindTo(this.contextKeyService);
    this.listMultiSelection = WorkbenchListMultiSelection.bindTo(this.contextKeyService);
    this.horizontalScrolling = options.horizontalScrolling;
    this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
    this.disposables.add(this.contextKeyService);
    this.disposables.add(listService.register(this));
    this.updateStyles(options.overrideStyles);
    this.disposables.add(this.onDidChangeSelection(() => {
      const selection = this.getSelection();
      const focus = this.getFocus();
      this.contextKeyService.bufferChangeEvents(() => {
        this.listHasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
        this.listMultiSelection.set(selection.length > 1);
        this.listDoubleSelection.set(selection.length === 2);
      });
    }));
    this.disposables.add(this.onDidChangeFocus(() => {
      const selection = this.getSelection();
      const focus = this.getFocus();
      this.listHasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
    }));
    this.disposables.add(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(multiSelectModifierSettingKey)) {
        this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
      }
      let options2 = {};
      if (e.affectsConfiguration(horizontalScrollingKey) && this.horizontalScrolling === void 0) {
        const horizontalScrolling2 = Boolean(configurationService.getValue(horizontalScrollingKey));
        options2 = { ...options2, horizontalScrolling: horizontalScrolling2 };
      }
      if (e.affectsConfiguration(scrollByPageKey)) {
        const scrollByPage = Boolean(configurationService.getValue(scrollByPageKey));
        options2 = { ...options2, scrollByPage };
      }
      if (e.affectsConfiguration(listSmoothScrolling)) {
        const smoothScrolling = Boolean(configurationService.getValue(listSmoothScrolling));
        options2 = { ...options2, smoothScrolling };
      }
      if (e.affectsConfiguration(mouseWheelScrollSensitivityKey)) {
        const mouseWheelScrollSensitivity = configurationService.getValue(mouseWheelScrollSensitivityKey);
        options2 = { ...options2, mouseWheelScrollSensitivity };
      }
      if (e.affectsConfiguration(fastScrollSensitivityKey)) {
        const fastScrollSensitivity = configurationService.getValue(fastScrollSensitivityKey);
        options2 = { ...options2, fastScrollSensitivity };
      }
      if (Object.keys(options2).length > 0) {
        this.updateOptions(options2);
      }
    }));
    this.navigator = new ListResourceNavigator(this, { configurationService, ...options });
    this.disposables.add(this.navigator);
  }
  updateOptions(options) {
    super.updateOptions(options);
    if (options.overrideStyles !== void 0) {
      this.updateStyles(options.overrideStyles);
    }
    if (options.multipleSelectionSupport !== void 0) {
      this.listSupportsMultiSelect.set(!!options.multipleSelectionSupport);
    }
  }
  updateStyles(styles) {
    this.style(styles ? getListStyles(styles) : defaultListStyles);
  }
  get useAltAsMultipleSelectionModifier() {
    return this._useAltAsMultipleSelectionModifier;
  }
};
WorkbenchList = __decorateClass([
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IListService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IInstantiationService)
], WorkbenchList);
let WorkbenchPagedList = class extends PagedList {
  get onDidOpen() {
    return this.navigator.onDidOpen;
  }
  constructor(user, container, delegate, renderers, options, contextKeyService, listService, configurationService, instantiationService) {
    const horizontalScrolling = typeof options.horizontalScrolling !== "undefined" ? options.horizontalScrolling : Boolean(configurationService.getValue(horizontalScrollingKey));
    const [workbenchListOptions, workbenchListOptionsDisposable] = instantiationService.invokeFunction(toWorkbenchListOptions, options);
    super(
      user,
      container,
      delegate,
      renderers,
      {
        keyboardSupport: false,
        ...workbenchListOptions,
        horizontalScrolling
      }
    );
    this.disposables = new DisposableStore();
    this.disposables.add(workbenchListOptionsDisposable);
    this.contextKeyService = createScopedContextKeyService(contextKeyService, this);
    this.disposables.add(createScrollObserver(this.contextKeyService, this.widget));
    this.horizontalScrolling = options.horizontalScrolling;
    this.listSupportsMultiSelect = WorkbenchListSupportsMultiSelectContextKey.bindTo(this.contextKeyService);
    this.listSupportsMultiSelect.set(options.multipleSelectionSupport !== false);
    const listSelectionNavigation = WorkbenchListSelectionNavigation.bindTo(this.contextKeyService);
    listSelectionNavigation.set(Boolean(options.selectionNavigation));
    this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
    this.disposables.add(this.contextKeyService);
    this.disposables.add(listService.register(this));
    this.updateStyles(options.overrideStyles);
    this.disposables.add(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(multiSelectModifierSettingKey)) {
        this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
      }
      let options2 = {};
      if (e.affectsConfiguration(horizontalScrollingKey) && this.horizontalScrolling === void 0) {
        const horizontalScrolling2 = Boolean(configurationService.getValue(horizontalScrollingKey));
        options2 = { ...options2, horizontalScrolling: horizontalScrolling2 };
      }
      if (e.affectsConfiguration(scrollByPageKey)) {
        const scrollByPage = Boolean(configurationService.getValue(scrollByPageKey));
        options2 = { ...options2, scrollByPage };
      }
      if (e.affectsConfiguration(listSmoothScrolling)) {
        const smoothScrolling = Boolean(configurationService.getValue(listSmoothScrolling));
        options2 = { ...options2, smoothScrolling };
      }
      if (e.affectsConfiguration(mouseWheelScrollSensitivityKey)) {
        const mouseWheelScrollSensitivity = configurationService.getValue(mouseWheelScrollSensitivityKey);
        options2 = { ...options2, mouseWheelScrollSensitivity };
      }
      if (e.affectsConfiguration(fastScrollSensitivityKey)) {
        const fastScrollSensitivity = configurationService.getValue(fastScrollSensitivityKey);
        options2 = { ...options2, fastScrollSensitivity };
      }
      if (Object.keys(options2).length > 0) {
        this.updateOptions(options2);
      }
    }));
    this.navigator = new ListResourceNavigator(this, { configurationService, ...options });
    this.disposables.add(this.navigator);
  }
  updateOptions(options) {
    super.updateOptions(options);
    if (options.overrideStyles !== void 0) {
      this.updateStyles(options.overrideStyles);
    }
    if (options.multipleSelectionSupport !== void 0) {
      this.listSupportsMultiSelect.set(!!options.multipleSelectionSupport);
    }
  }
  updateStyles(styles) {
    this.style(styles ? getListStyles(styles) : defaultListStyles);
  }
  get useAltAsMultipleSelectionModifier() {
    return this._useAltAsMultipleSelectionModifier;
  }
  dispose() {
    this.disposables.dispose();
    super.dispose();
  }
};
WorkbenchPagedList = __decorateClass([
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IListService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IInstantiationService)
], WorkbenchPagedList);
let WorkbenchTable = class extends Table {
  get onDidOpen() {
    return this.navigator.onDidOpen;
  }
  constructor(user, container, delegate, columns, renderers, options, contextKeyService, listService, configurationService, instantiationService) {
    const horizontalScrolling = typeof options.horizontalScrolling !== "undefined" ? options.horizontalScrolling : Boolean(configurationService.getValue(horizontalScrollingKey));
    const [workbenchListOptions, workbenchListOptionsDisposable] = instantiationService.invokeFunction(toWorkbenchListOptions, options);
    super(
      user,
      container,
      delegate,
      columns,
      renderers,
      {
        keyboardSupport: false,
        ...workbenchListOptions,
        horizontalScrolling
      }
    );
    this.disposables.add(workbenchListOptionsDisposable);
    this.contextKeyService = createScopedContextKeyService(contextKeyService, this);
    this.disposables.add(createScrollObserver(this.contextKeyService, this));
    this.listSupportsMultiSelect = WorkbenchListSupportsMultiSelectContextKey.bindTo(this.contextKeyService);
    this.listSupportsMultiSelect.set(options.multipleSelectionSupport !== false);
    const listSelectionNavigation = WorkbenchListSelectionNavigation.bindTo(this.contextKeyService);
    listSelectionNavigation.set(Boolean(options.selectionNavigation));
    this.listHasSelectionOrFocus = WorkbenchListHasSelectionOrFocus.bindTo(this.contextKeyService);
    this.listDoubleSelection = WorkbenchListDoubleSelection.bindTo(this.contextKeyService);
    this.listMultiSelection = WorkbenchListMultiSelection.bindTo(this.contextKeyService);
    this.horizontalScrolling = options.horizontalScrolling;
    this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
    this.disposables.add(this.contextKeyService);
    this.disposables.add(listService.register(this));
    this.updateStyles(options.overrideStyles);
    this.disposables.add(this.onDidChangeSelection(() => {
      const selection = this.getSelection();
      const focus = this.getFocus();
      this.contextKeyService.bufferChangeEvents(() => {
        this.listHasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
        this.listMultiSelection.set(selection.length > 1);
        this.listDoubleSelection.set(selection.length === 2);
      });
    }));
    this.disposables.add(this.onDidChangeFocus(() => {
      const selection = this.getSelection();
      const focus = this.getFocus();
      this.listHasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
    }));
    this.disposables.add(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(multiSelectModifierSettingKey)) {
        this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
      }
      let options2 = {};
      if (e.affectsConfiguration(horizontalScrollingKey) && this.horizontalScrolling === void 0) {
        const horizontalScrolling2 = Boolean(configurationService.getValue(horizontalScrollingKey));
        options2 = { ...options2, horizontalScrolling: horizontalScrolling2 };
      }
      if (e.affectsConfiguration(scrollByPageKey)) {
        const scrollByPage = Boolean(configurationService.getValue(scrollByPageKey));
        options2 = { ...options2, scrollByPage };
      }
      if (e.affectsConfiguration(listSmoothScrolling)) {
        const smoothScrolling = Boolean(configurationService.getValue(listSmoothScrolling));
        options2 = { ...options2, smoothScrolling };
      }
      if (e.affectsConfiguration(mouseWheelScrollSensitivityKey)) {
        const mouseWheelScrollSensitivity = configurationService.getValue(mouseWheelScrollSensitivityKey);
        options2 = { ...options2, mouseWheelScrollSensitivity };
      }
      if (e.affectsConfiguration(fastScrollSensitivityKey)) {
        const fastScrollSensitivity = configurationService.getValue(fastScrollSensitivityKey);
        options2 = { ...options2, fastScrollSensitivity };
      }
      if (Object.keys(options2).length > 0) {
        this.updateOptions(options2);
      }
    }));
    this.navigator = new TableResourceNavigator(this, { configurationService, ...options });
    this.disposables.add(this.navigator);
  }
  updateOptions(options) {
    super.updateOptions(options);
    if (options.overrideStyles !== void 0) {
      this.updateStyles(options.overrideStyles);
    }
    if (options.multipleSelectionSupport !== void 0) {
      this.listSupportsMultiSelect.set(!!options.multipleSelectionSupport);
    }
  }
  updateStyles(styles) {
    this.style(styles ? getListStyles(styles) : defaultListStyles);
  }
  get useAltAsMultipleSelectionModifier() {
    return this._useAltAsMultipleSelectionModifier;
  }
  dispose() {
    this.disposables.dispose();
    super.dispose();
  }
};
WorkbenchTable = __decorateClass([
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IListService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IInstantiationService)
], WorkbenchTable);
function getSelectionKeyboardEvent(typeArg = "keydown", preserveFocus, pinned) {
  const e = new KeyboardEvent(typeArg);
  e.preserveFocus = preserveFocus;
  e.pinned = pinned;
  e.__forceEvent = true;
  return e;
}
class ResourceNavigator extends Disposable {
  constructor(widget, options) {
    super();
    this.widget = widget;
    this._onDidOpen = this._register(new Emitter());
    this.onDidOpen = this._onDidOpen.event;
    this._register(Event.filter(this.widget.onDidChangeSelection, (e) => isKeyboardEvent(e.browserEvent))((e) => this.onSelectionFromKeyboard(e)));
    this._register(this.widget.onPointer((e) => this.onPointer(e.element, e.browserEvent)));
    this._register(this.widget.onMouseDblClick((e) => this.onMouseDblClick(e.element, e.browserEvent)));
    if (typeof options?.openOnSingleClick !== "boolean" && options?.configurationService) {
      this.openOnSingleClick = options?.configurationService.getValue(openModeSettingKey) !== "doubleClick";
      this._register(options?.configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(openModeSettingKey)) {
          this.openOnSingleClick = options?.configurationService.getValue(openModeSettingKey) !== "doubleClick";
        }
      }));
    } else {
      this.openOnSingleClick = options?.openOnSingleClick ?? true;
    }
  }
  onSelectionFromKeyboard(event) {
    if (event.elements.length !== 1) {
      return;
    }
    const selectionKeyboardEvent = event.browserEvent;
    const preserveFocus = typeof selectionKeyboardEvent.preserveFocus === "boolean" ? selectionKeyboardEvent.preserveFocus : true;
    const pinned = typeof selectionKeyboardEvent.pinned === "boolean" ? selectionKeyboardEvent.pinned : !preserveFocus;
    const sideBySide = false;
    this._open(this.getSelectedElement(), preserveFocus, pinned, sideBySide, event.browserEvent);
  }
  onPointer(element, browserEvent) {
    if (!this.openOnSingleClick) {
      return;
    }
    const isDoubleClick = browserEvent.detail === 2;
    if (isDoubleClick) {
      return;
    }
    const isMiddleClick = browserEvent.button === 1;
    const preserveFocus = true;
    const pinned = isMiddleClick;
    const sideBySide = browserEvent.ctrlKey || browserEvent.metaKey || browserEvent.altKey;
    this._open(element, preserveFocus, pinned, sideBySide, browserEvent);
  }
  onMouseDblClick(element, browserEvent) {
    if (!browserEvent) {
      return;
    }
    const target = browserEvent.target;
    const onTwistie = target.classList.contains("monaco-tl-twistie") || target.classList.contains("monaco-icon-label") && target.classList.contains("folder-icon") && browserEvent.offsetX < 16;
    if (onTwistie) {
      return;
    }
    const preserveFocus = false;
    const pinned = true;
    const sideBySide = browserEvent.ctrlKey || browserEvent.metaKey || browserEvent.altKey;
    this._open(element, preserveFocus, pinned, sideBySide, browserEvent);
  }
  _open(element, preserveFocus, pinned, sideBySide, browserEvent) {
    if (!element) {
      return;
    }
    this._onDidOpen.fire({
      editorOptions: {
        preserveFocus,
        pinned,
        revealIfVisible: true
      },
      sideBySide,
      element,
      browserEvent
    });
  }
}
class ListResourceNavigator extends ResourceNavigator {
  constructor(widget, options) {
    super(widget, options);
    this.widget = widget;
  }
  getSelectedElement() {
    return this.widget.getSelectedElements()[0];
  }
}
class TableResourceNavigator extends ResourceNavigator {
  constructor(widget, options) {
    super(widget, options);
  }
  getSelectedElement() {
    return this.widget.getSelectedElements()[0];
  }
}
class TreeResourceNavigator extends ResourceNavigator {
  constructor(widget, options) {
    super(widget, options);
  }
  getSelectedElement() {
    return this.widget.getSelection()[0] ?? void 0;
  }
}
function createKeyboardNavigationEventFilter(keybindingService) {
  let inMultiChord = false;
  return (event) => {
    if (event.toKeyCodeChord().isModifierKey()) {
      return false;
    }
    if (inMultiChord) {
      inMultiChord = false;
      return false;
    }
    const result = keybindingService.softDispatch(event, event.target);
    if (result.kind === ResultKind.MoreChordsNeeded) {
      inMultiChord = true;
      return false;
    }
    inMultiChord = false;
    return result.kind === ResultKind.NoMatchingKb;
  };
}
let WorkbenchObjectTree = class extends ObjectTree {
  get contextKeyService() {
    return this.internals.contextKeyService;
  }
  get useAltAsMultipleSelectionModifier() {
    return this.internals.useAltAsMultipleSelectionModifier;
  }
  get onDidOpen() {
    return this.internals.onDidOpen;
  }
  constructor(user, container, delegate, renderers, options, instantiationService, contextKeyService, listService, configurationService) {
    const { options: treeOptions, getTypeNavigationMode, disposable } = instantiationService.invokeFunction(workbenchTreeDataPreamble, options);
    super(user, container, delegate, renderers, treeOptions);
    this.disposables.add(disposable);
    this.internals = new WorkbenchTreeInternals(this, options, getTypeNavigationMode, options.overrideStyles, contextKeyService, listService, configurationService);
    this.disposables.add(this.internals);
  }
  updateOptions(options) {
    super.updateOptions(options);
    this.internals.updateOptions(options);
  }
};
WorkbenchObjectTree = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IListService),
  __decorateParam(8, IConfigurationService)
], WorkbenchObjectTree);
let WorkbenchCompressibleObjectTree = class extends CompressibleObjectTree {
  get contextKeyService() {
    return this.internals.contextKeyService;
  }
  get useAltAsMultipleSelectionModifier() {
    return this.internals.useAltAsMultipleSelectionModifier;
  }
  get onDidOpen() {
    return this.internals.onDidOpen;
  }
  constructor(user, container, delegate, renderers, options, instantiationService, contextKeyService, listService, configurationService) {
    const { options: treeOptions, getTypeNavigationMode, disposable } = instantiationService.invokeFunction(workbenchTreeDataPreamble, options);
    super(user, container, delegate, renderers, treeOptions);
    this.disposables.add(disposable);
    this.internals = new WorkbenchTreeInternals(this, options, getTypeNavigationMode, options.overrideStyles, contextKeyService, listService, configurationService);
    this.disposables.add(this.internals);
  }
  updateOptions(options = {}) {
    super.updateOptions(options);
    if (options.overrideStyles) {
      this.internals.updateStyleOverrides(options.overrideStyles);
    }
    this.internals.updateOptions(options);
  }
};
WorkbenchCompressibleObjectTree = __decorateClass([
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IListService),
  __decorateParam(8, IConfigurationService)
], WorkbenchCompressibleObjectTree);
let WorkbenchDataTree = class extends DataTree {
  get contextKeyService() {
    return this.internals.contextKeyService;
  }
  get useAltAsMultipleSelectionModifier() {
    return this.internals.useAltAsMultipleSelectionModifier;
  }
  get onDidOpen() {
    return this.internals.onDidOpen;
  }
  constructor(user, container, delegate, renderers, dataSource, options, instantiationService, contextKeyService, listService, configurationService) {
    const { options: treeOptions, getTypeNavigationMode, disposable } = instantiationService.invokeFunction(workbenchTreeDataPreamble, options);
    super(user, container, delegate, renderers, dataSource, treeOptions);
    this.disposables.add(disposable);
    this.internals = new WorkbenchTreeInternals(this, options, getTypeNavigationMode, options.overrideStyles, contextKeyService, listService, configurationService);
    this.disposables.add(this.internals);
  }
  updateOptions(options = {}) {
    super.updateOptions(options);
    if (options.overrideStyles !== void 0) {
      this.internals.updateStyleOverrides(options.overrideStyles);
    }
    this.internals.updateOptions(options);
  }
};
WorkbenchDataTree = __decorateClass([
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IListService),
  __decorateParam(9, IConfigurationService)
], WorkbenchDataTree);
let WorkbenchAsyncDataTree = class extends AsyncDataTree {
  get contextKeyService() {
    return this.internals.contextKeyService;
  }
  get useAltAsMultipleSelectionModifier() {
    return this.internals.useAltAsMultipleSelectionModifier;
  }
  get onDidOpen() {
    return this.internals.onDidOpen;
  }
  constructor(user, container, delegate, renderers, dataSource, options, instantiationService, contextKeyService, listService, configurationService) {
    const { options: treeOptions, getTypeNavigationMode, disposable } = instantiationService.invokeFunction(workbenchTreeDataPreamble, options);
    super(user, container, delegate, renderers, dataSource, treeOptions);
    this.disposables.add(disposable);
    this.internals = new WorkbenchTreeInternals(this, options, getTypeNavigationMode, options.overrideStyles, contextKeyService, listService, configurationService);
    this.disposables.add(this.internals);
  }
  updateOptions(options = {}) {
    super.updateOptions(options);
    if (options.overrideStyles) {
      this.internals.updateStyleOverrides(options.overrideStyles);
    }
    this.internals.updateOptions(options);
  }
};
WorkbenchAsyncDataTree = __decorateClass([
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IListService),
  __decorateParam(9, IConfigurationService)
], WorkbenchAsyncDataTree);
let WorkbenchCompressibleAsyncDataTree = class extends CompressibleAsyncDataTree {
  get contextKeyService() {
    return this.internals.contextKeyService;
  }
  get useAltAsMultipleSelectionModifier() {
    return this.internals.useAltAsMultipleSelectionModifier;
  }
  get onDidOpen() {
    return this.internals.onDidOpen;
  }
  constructor(user, container, virtualDelegate, compressionDelegate, renderers, dataSource, options, instantiationService, contextKeyService, listService, configurationService) {
    const { options: treeOptions, getTypeNavigationMode, disposable } = instantiationService.invokeFunction(workbenchTreeDataPreamble, options);
    super(user, container, virtualDelegate, compressionDelegate, renderers, dataSource, treeOptions);
    this.disposables.add(disposable);
    this.internals = new WorkbenchTreeInternals(this, options, getTypeNavigationMode, options.overrideStyles, contextKeyService, listService, configurationService);
    this.disposables.add(this.internals);
  }
  updateOptions(options) {
    super.updateOptions(options);
    this.internals.updateOptions(options);
  }
};
WorkbenchCompressibleAsyncDataTree = __decorateClass([
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IListService),
  __decorateParam(10, IConfigurationService)
], WorkbenchCompressibleAsyncDataTree);
function getDefaultTreeFindMode(configurationService) {
  const value = configurationService.getValue(defaultFindModeSettingKey);
  if (value === "highlight") {
    return TreeFindMode.Highlight;
  } else if (value === "filter") {
    return TreeFindMode.Filter;
  }
  const deprecatedValue = configurationService.getValue(keyboardNavigationSettingKey);
  if (deprecatedValue === "simple" || deprecatedValue === "highlight") {
    return TreeFindMode.Highlight;
  } else if (deprecatedValue === "filter") {
    return TreeFindMode.Filter;
  }
  return void 0;
}
function getDefaultTreeFindMatchType(configurationService) {
  const value = configurationService.getValue(defaultFindMatchTypeSettingKey);
  if (value === "fuzzy") {
    return TreeFindMatchType.Fuzzy;
  } else if (value === "contiguous") {
    return TreeFindMatchType.Contiguous;
  }
  return void 0;
}
function workbenchTreeDataPreamble(accessor, options) {
  const configurationService = accessor.get(IConfigurationService);
  const contextViewService = accessor.get(IContextViewService);
  const contextKeyService = accessor.get(IContextKeyService);
  const instantiationService = accessor.get(IInstantiationService);
  const getTypeNavigationMode = () => {
    const modeString = contextKeyService.getContextKeyValue(WorkbenchListTypeNavigationModeKey);
    if (modeString === "automatic") {
      return TypeNavigationMode.Automatic;
    } else if (modeString === "trigger") {
      return TypeNavigationMode.Trigger;
    }
    const modeBoolean = contextKeyService.getContextKeyValue(WorkbenchListAutomaticKeyboardNavigationLegacyKey);
    if (modeBoolean === false) {
      return TypeNavigationMode.Trigger;
    }
    const configString = configurationService.getValue(typeNavigationModeSettingKey);
    if (configString === "automatic") {
      return TypeNavigationMode.Automatic;
    } else if (configString === "trigger") {
      return TypeNavigationMode.Trigger;
    }
    return void 0;
  };
  const horizontalScrolling = options.horizontalScrolling !== void 0 ? options.horizontalScrolling : Boolean(configurationService.getValue(horizontalScrollingKey));
  const [workbenchListOptions, disposable] = instantiationService.invokeFunction(toWorkbenchListOptions, options);
  const paddingBottom = options.paddingBottom;
  const renderIndentGuides = options.renderIndentGuides !== void 0 ? options.renderIndentGuides : configurationService.getValue(treeRenderIndentGuidesKey);
  return {
    getTypeNavigationMode,
    disposable,
    // eslint-disable-next-line local/code-no-dangerous-type-assertions
    options: {
      // ...options, // TODO@Joao why is this not splatted here?
      keyboardSupport: false,
      ...workbenchListOptions,
      indent: typeof configurationService.getValue(treeIndentKey) === "number" ? configurationService.getValue(treeIndentKey) : void 0,
      renderIndentGuides,
      smoothScrolling: Boolean(configurationService.getValue(listSmoothScrolling)),
      defaultFindMode: getDefaultTreeFindMode(configurationService),
      defaultFindMatchType: getDefaultTreeFindMatchType(configurationService),
      horizontalScrolling,
      scrollByPage: Boolean(configurationService.getValue(scrollByPageKey)),
      paddingBottom,
      hideTwistiesOfChildlessElements: options.hideTwistiesOfChildlessElements,
      expandOnlyOnTwistieClick: options.expandOnlyOnTwistieClick ?? configurationService.getValue(treeExpandMode) === "doubleClick",
      contextViewProvider: contextViewService,
      findWidgetStyles: defaultFindWidgetStyles,
      enableStickyScroll: Boolean(configurationService.getValue(treeStickyScroll)),
      stickyScrollMaxItemCount: Number(configurationService.getValue(treeStickyScrollMaxElements))
    }
  };
}
let WorkbenchTreeInternals = class {
  constructor(tree, options, getTypeNavigationMode, overrideStyles, contextKeyService, listService, configurationService) {
    this.tree = tree;
    this.disposables = [];
    this.contextKeyService = createScopedContextKeyService(contextKeyService, tree);
    this.disposables.push(createScrollObserver(this.contextKeyService, tree));
    this.listSupportsMultiSelect = WorkbenchListSupportsMultiSelectContextKey.bindTo(this.contextKeyService);
    this.listSupportsMultiSelect.set(options.multipleSelectionSupport !== false);
    const listSelectionNavigation = WorkbenchListSelectionNavigation.bindTo(this.contextKeyService);
    listSelectionNavigation.set(Boolean(options.selectionNavigation));
    this.listSupportFindWidget = WorkbenchListSupportsFind.bindTo(this.contextKeyService);
    this.listSupportFindWidget.set(options.findWidgetEnabled ?? true);
    this.hasSelectionOrFocus = WorkbenchListHasSelectionOrFocus.bindTo(this.contextKeyService);
    this.hasDoubleSelection = WorkbenchListDoubleSelection.bindTo(this.contextKeyService);
    this.hasMultiSelection = WorkbenchListMultiSelection.bindTo(this.contextKeyService);
    this.treeElementCanCollapse = WorkbenchTreeElementCanCollapse.bindTo(this.contextKeyService);
    this.treeElementHasParent = WorkbenchTreeElementHasParent.bindTo(this.contextKeyService);
    this.treeElementCanExpand = WorkbenchTreeElementCanExpand.bindTo(this.contextKeyService);
    this.treeElementHasChild = WorkbenchTreeElementHasChild.bindTo(this.contextKeyService);
    this.treeFindOpen = WorkbenchTreeFindOpen.bindTo(this.contextKeyService);
    this.treeStickyScrollFocused = WorkbenchTreeStickyScrollFocused.bindTo(this.contextKeyService);
    this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
    this.updateStyleOverrides(overrideStyles);
    const updateCollapseContextKeys = () => {
      const focus = tree.getFocus()[0];
      if (!focus) {
        return;
      }
      const node = tree.getNode(focus);
      this.treeElementCanCollapse.set(node.collapsible && !node.collapsed);
      this.treeElementHasParent.set(!!tree.getParentElement(focus));
      this.treeElementCanExpand.set(node.collapsible && node.collapsed);
      this.treeElementHasChild.set(!!tree.getFirstElementChild(focus));
    };
    const interestingContextKeys = /* @__PURE__ */ new Set();
    interestingContextKeys.add(WorkbenchListTypeNavigationModeKey);
    interestingContextKeys.add(WorkbenchListAutomaticKeyboardNavigationLegacyKey);
    this.disposables.push(
      this.contextKeyService,
      listService.register(tree),
      tree.onDidChangeSelection(() => {
        const selection = tree.getSelection();
        const focus = tree.getFocus();
        this.contextKeyService.bufferChangeEvents(() => {
          this.hasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
          this.hasMultiSelection.set(selection.length > 1);
          this.hasDoubleSelection.set(selection.length === 2);
        });
      }),
      tree.onDidChangeFocus(() => {
        const selection = tree.getSelection();
        const focus = tree.getFocus();
        this.hasSelectionOrFocus.set(selection.length > 0 || focus.length > 0);
        updateCollapseContextKeys();
      }),
      tree.onDidChangeCollapseState(updateCollapseContextKeys),
      tree.onDidChangeModel(updateCollapseContextKeys),
      tree.onDidChangeFindOpenState((enabled) => this.treeFindOpen.set(enabled)),
      tree.onDidChangeStickyScrollFocused((focused) => this.treeStickyScrollFocused.set(focused)),
      configurationService.onDidChangeConfiguration((e) => {
        let newOptions = {};
        if (e.affectsConfiguration(multiSelectModifierSettingKey)) {
          this._useAltAsMultipleSelectionModifier = useAltAsMultipleSelectionModifier(configurationService);
        }
        if (e.affectsConfiguration(treeIndentKey)) {
          const indent = configurationService.getValue(treeIndentKey);
          newOptions = { ...newOptions, indent };
        }
        if (e.affectsConfiguration(treeRenderIndentGuidesKey) && options.renderIndentGuides === void 0) {
          const renderIndentGuides = configurationService.getValue(treeRenderIndentGuidesKey);
          newOptions = { ...newOptions, renderIndentGuides };
        }
        if (e.affectsConfiguration(listSmoothScrolling)) {
          const smoothScrolling = Boolean(configurationService.getValue(listSmoothScrolling));
          newOptions = { ...newOptions, smoothScrolling };
        }
        if (e.affectsConfiguration(defaultFindModeSettingKey) || e.affectsConfiguration(keyboardNavigationSettingKey)) {
          const defaultFindMode = getDefaultTreeFindMode(configurationService);
          newOptions = { ...newOptions, defaultFindMode };
        }
        if (e.affectsConfiguration(typeNavigationModeSettingKey) || e.affectsConfiguration(keyboardNavigationSettingKey)) {
          const typeNavigationMode = getTypeNavigationMode();
          newOptions = { ...newOptions, typeNavigationMode };
        }
        if (e.affectsConfiguration(defaultFindMatchTypeSettingKey)) {
          const defaultFindMatchType = getDefaultTreeFindMatchType(configurationService);
          newOptions = { ...newOptions, defaultFindMatchType };
        }
        if (e.affectsConfiguration(horizontalScrollingKey) && options.horizontalScrolling === void 0) {
          const horizontalScrolling = Boolean(configurationService.getValue(horizontalScrollingKey));
          newOptions = { ...newOptions, horizontalScrolling };
        }
        if (e.affectsConfiguration(scrollByPageKey)) {
          const scrollByPage = Boolean(configurationService.getValue(scrollByPageKey));
          newOptions = { ...newOptions, scrollByPage };
        }
        if (e.affectsConfiguration(treeExpandMode) && options.expandOnlyOnTwistieClick === void 0) {
          newOptions = { ...newOptions, expandOnlyOnTwistieClick: configurationService.getValue(treeExpandMode) === "doubleClick" };
        }
        if (e.affectsConfiguration(treeStickyScroll)) {
          const enableStickyScroll = configurationService.getValue(treeStickyScroll);
          newOptions = { ...newOptions, enableStickyScroll };
        }
        if (e.affectsConfiguration(treeStickyScrollMaxElements)) {
          const stickyScrollMaxItemCount = Math.max(1, configurationService.getValue(treeStickyScrollMaxElements));
          newOptions = { ...newOptions, stickyScrollMaxItemCount };
        }
        if (e.affectsConfiguration(mouseWheelScrollSensitivityKey)) {
          const mouseWheelScrollSensitivity = configurationService.getValue(mouseWheelScrollSensitivityKey);
          newOptions = { ...newOptions, mouseWheelScrollSensitivity };
        }
        if (e.affectsConfiguration(fastScrollSensitivityKey)) {
          const fastScrollSensitivity = configurationService.getValue(fastScrollSensitivityKey);
          newOptions = { ...newOptions, fastScrollSensitivity };
        }
        if (Object.keys(newOptions).length > 0) {
          tree.updateOptions(newOptions);
        }
      }),
      this.contextKeyService.onDidChangeContext((e) => {
        if (e.affectsSome(interestingContextKeys)) {
          tree.updateOptions({ typeNavigationMode: getTypeNavigationMode() });
        }
      })
    );
    this.navigator = new TreeResourceNavigator(tree, { configurationService, ...options });
    this.disposables.push(this.navigator);
  }
  get onDidOpen() {
    return this.navigator.onDidOpen;
  }
  get useAltAsMultipleSelectionModifier() {
    return this._useAltAsMultipleSelectionModifier;
  }
  updateOptions(options) {
    if (options.multipleSelectionSupport !== void 0) {
      this.listSupportsMultiSelect.set(!!options.multipleSelectionSupport);
    }
  }
  updateStyleOverrides(overrideStyles) {
    this.tree.style(overrideStyles ? getListStyles(overrideStyles) : defaultListStyles);
  }
  dispose() {
    this.disposables = dispose(this.disposables);
  }
};
WorkbenchTreeInternals = __decorateClass([
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IListService),
  __decorateParam(6, IConfigurationService)
], WorkbenchTreeInternals);
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
  id: "workbench",
  order: 7,
  title: localize("workbenchConfigurationTitle", "Workbench"),
  type: "object",
  properties: {
    [multiSelectModifierSettingKey]: {
      type: "string",
      enum: ["ctrlCmd", "alt"],
      markdownEnumDescriptions: [
        localize("multiSelectModifier.ctrlCmd", "Maps to `Control` on Windows and Linux and to `Command` on macOS."),
        localize("multiSelectModifier.alt", "Maps to `Alt` on Windows and Linux and to `Option` on macOS.")
      ],
      default: "ctrlCmd",
      description: localize({
        key: "multiSelectModifier",
        comment: [
          "- `ctrlCmd` refers to a value the setting can take and should not be localized.",
          "- `Control` and `Command` refer to the modifier keys Ctrl or Cmd on the keyboard and can be localized."
        ]
      }, "The modifier to be used to add an item in trees and lists to a multi-selection with the mouse (for example in the explorer, open editors and scm view). The 'Open to Side' mouse gestures - if supported - will adapt such that they do not conflict with the multiselect modifier.")
    },
    [openModeSettingKey]: {
      type: "string",
      enum: ["singleClick", "doubleClick"],
      default: "singleClick",
      description: localize({
        key: "openModeModifier",
        comment: ["`singleClick` and `doubleClick` refers to a value the setting can take and should not be localized."]
      }, "Controls how to open items in trees and lists using the mouse (if supported). Note that some trees and lists might choose to ignore this setting if it is not applicable.")
    },
    [horizontalScrollingKey]: {
      type: "boolean",
      default: false,
      description: localize("horizontalScrolling setting", "Controls whether lists and trees support horizontal scrolling in the workbench. Warning: turning on this setting has a performance implication.")
    },
    [scrollByPageKey]: {
      type: "boolean",
      default: false,
      description: localize("list.scrollByPage", "Controls whether clicks in the scrollbar scroll page by page.")
    },
    [treeIndentKey]: {
      type: "number",
      default: 8,
      minimum: 4,
      maximum: 40,
      description: localize("tree indent setting", "Controls tree indentation in pixels.")
    },
    [treeRenderIndentGuidesKey]: {
      type: "string",
      enum: ["none", "onHover", "always"],
      default: "onHover",
      description: localize("render tree indent guides", "Controls whether the tree should render indent guides.")
    },
    [listSmoothScrolling]: {
      type: "boolean",
      default: false,
      description: localize("list smoothScrolling setting", "Controls whether lists and trees have smooth scrolling.")
    },
    [mouseWheelScrollSensitivityKey]: {
      type: "number",
      default: 1,
      markdownDescription: localize("Mouse Wheel Scroll Sensitivity", "A multiplier to be used on the `deltaX` and `deltaY` of mouse wheel scroll events.")
    },
    [fastScrollSensitivityKey]: {
      type: "number",
      default: 5,
      markdownDescription: localize("Fast Scroll Sensitivity", "Scrolling speed multiplier when pressing `Alt`.")
    },
    [defaultFindModeSettingKey]: {
      type: "string",
      enum: ["highlight", "filter"],
      enumDescriptions: [
        localize("defaultFindModeSettingKey.highlight", "Highlight elements when searching. Further up and down navigation will traverse only the highlighted elements."),
        localize("defaultFindModeSettingKey.filter", "Filter elements when searching.")
      ],
      default: "highlight",
      description: localize("defaultFindModeSettingKey", "Controls the default find mode for lists and trees in the workbench.")
    },
    [keyboardNavigationSettingKey]: {
      type: "string",
      enum: ["simple", "highlight", "filter"],
      enumDescriptions: [
        localize("keyboardNavigationSettingKey.simple", "Simple keyboard navigation focuses elements which match the keyboard input. Matching is done only on prefixes."),
        localize("keyboardNavigationSettingKey.highlight", "Highlight keyboard navigation highlights elements which match the keyboard input. Further up and down navigation will traverse only the highlighted elements."),
        localize("keyboardNavigationSettingKey.filter", "Filter keyboard navigation will filter out and hide all the elements which do not match the keyboard input.")
      ],
      default: "highlight",
      description: localize("keyboardNavigationSettingKey", "Controls the keyboard navigation style for lists and trees in the workbench. Can be simple, highlight and filter."),
      deprecated: true,
      deprecationMessage: localize("keyboardNavigationSettingKeyDeprecated", "Please use 'workbench.list.defaultFindMode' and	'workbench.list.typeNavigationMode' instead.")
    },
    [defaultFindMatchTypeSettingKey]: {
      type: "string",
      enum: ["fuzzy", "contiguous"],
      enumDescriptions: [
        localize("defaultFindMatchTypeSettingKey.fuzzy", "Use fuzzy matching when searching."),
        localize("defaultFindMatchTypeSettingKey.contiguous", "Use contiguous matching when searching.")
      ],
      default: "fuzzy",
      description: localize("defaultFindMatchTypeSettingKey", "Controls the type of matching used when searching lists and trees in the workbench.")
    },
    [treeExpandMode]: {
      type: "string",
      enum: ["singleClick", "doubleClick"],
      default: "singleClick",
      description: localize("expand mode", "Controls how tree folders are expanded when clicking the folder names. Note that some trees and lists might choose to ignore this setting if it is not applicable.")
    },
    [treeStickyScroll]: {
      type: "boolean",
      default: true,
      description: localize("sticky scroll", "Controls whether sticky scrolling is enabled in trees.")
    },
    [treeStickyScrollMaxElements]: {
      type: "number",
      minimum: 1,
      default: 7,
      markdownDescription: localize("sticky scroll maximum items", "Controls the number of sticky elements displayed in the tree when {0} is enabled.", "`#workbench.tree.enableStickyScroll#`")
    },
    [typeNavigationModeSettingKey]: {
      type: "string",
      enum: ["automatic", "trigger"],
      default: "automatic",
      markdownDescription: localize("typeNavigationMode2", "Controls how type navigation works in lists and trees in the workbench. When set to `trigger`, type navigation begins once the `list.triggerTypeNavigation` command is run.")
    }
  }
});
export {
  IListService,
  ListService,
  RawWorkbenchListFocusContextKey,
  RawWorkbenchListScrollAtBoundaryContextKey,
  WorkbenchAsyncDataTree,
  WorkbenchCompressibleAsyncDataTree,
  WorkbenchCompressibleObjectTree,
  WorkbenchDataTree,
  WorkbenchList,
  WorkbenchListDoubleSelection,
  WorkbenchListFocusContextKey,
  WorkbenchListHasSelectionOrFocus,
  WorkbenchListMultiSelection,
  WorkbenchListScrollAtBottomContextKey,
  WorkbenchListScrollAtTopContextKey,
  WorkbenchListSelectionNavigation,
  WorkbenchListSupportsFind,
  WorkbenchListSupportsMultiSelectContextKey,
  WorkbenchObjectTree,
  WorkbenchPagedList,
  WorkbenchTable,
  WorkbenchTreeElementCanCollapse,
  WorkbenchTreeElementCanExpand,
  WorkbenchTreeElementHasChild,
  WorkbenchTreeElementHasParent,
  WorkbenchTreeFindOpen,
  WorkbenchTreeStickyScrollFocused,
  getSelectionKeyboardEvent
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBpc0FjdGl2ZUVsZW1lbnQsIGlzS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRWaWV3UHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvY29udGV4dHZpZXcvY29udGV4dHZpZXcuanMnO1xuaW1wb3J0IHsgSUxpc3RNb3VzZUV2ZW50LCBJTGlzdFJlbmRlcmVyLCBJTGlzdFRvdWNoRXZlbnQsIElMaXN0VmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBJUGFnZWRMaXN0T3B0aW9ucywgSVBhZ2VkUmVuZGVyZXIsIFBhZ2VkTGlzdCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3RQYWdpbmcuanMnO1xuaW1wb3J0IHsgSUtleWJvYXJkTmF2aWdhdGlvbkV2ZW50RmlsdGVyLCBJTGlzdEFjY2Vzc2liaWxpdHlQcm92aWRlciwgSUxpc3RPcHRpb25zLCBJTGlzdE9wdGlvbnNVcGRhdGUsIElMaXN0U3R5bGVzLCBJTXVsdGlwbGVTZWxlY3Rpb25Db250cm9sbGVyLCBpc1NlbGVjdGlvblJhbmdlQ2hhbmdlRXZlbnQsIGlzU2VsZWN0aW9uU2luZ2xlQ2hhbmdlRXZlbnQsIExpc3QsIFR5cGVOYXZpZ2F0aW9uTW9kZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3RXaWRnZXQuanMnO1xuaW1wb3J0IHsgSVRhYmxlQ29sdW1uLCBJVGFibGVSZW5kZXJlciwgSVRhYmxlVmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RhYmxlL3RhYmxlLmpzJztcbmltcG9ydCB7IElUYWJsZU9wdGlvbnMsIElUYWJsZU9wdGlvbnNVcGRhdGUsIElUYWJsZVN0eWxlcywgVGFibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdGFibGUvdGFibGVXaWRnZXQuanMnO1xuaW1wb3J0IHsgSUFic3RyYWN0VHJlZU9wdGlvbnMsIElBYnN0cmFjdFRyZWVPcHRpb25zVXBkYXRlLCBSZW5kZXJJbmRlbnRHdWlkZXMsIFRyZWVGaW5kTWF0Y2hUeXBlLCBUcmVlRmluZE1vZGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9hYnN0cmFjdFRyZWUuanMnO1xuaW1wb3J0IHsgQXN5bmNEYXRhVHJlZSwgQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZSwgSUFzeW5jRGF0YVRyZWVPcHRpb25zLCBJQXN5bmNEYXRhVHJlZU9wdGlvbnNVcGRhdGUsIElDb21wcmVzc2libGVBc3luY0RhdGFUcmVlT3B0aW9ucywgSUNvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWVPcHRpb25zVXBkYXRlLCBJVHJlZUNvbXByZXNzaW9uRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9hc3luY0RhdGFUcmVlLmpzJztcbmltcG9ydCB7IERhdGFUcmVlLCBJRGF0YVRyZWVPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvZGF0YVRyZWUuanMnO1xuaW1wb3J0IHsgQ29tcHJlc3NpYmxlT2JqZWN0VHJlZSwgSUNvbXByZXNzaWJsZU9iamVjdFRyZWVPcHRpb25zLCBJQ29tcHJlc3NpYmxlT2JqZWN0VHJlZU9wdGlvbnNVcGRhdGUsIElDb21wcmVzc2libGVUcmVlUmVuZGVyZXIsIElPYmplY3RUcmVlT3B0aW9ucywgT2JqZWN0VHJlZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL29iamVjdFRyZWUuanMnO1xuaW1wb3J0IHsgSUFzeW5jRGF0YVNvdXJjZSwgSURhdGFTb3VyY2UsIElUcmVlRXZlbnQsIElUcmVlUmVuZGVyZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS90cmVlLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgY29tYmluZWREaXNwb3NhYmxlLCBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zIGFzIENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLCBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlLCBJU2NvcGVkQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElucHV0Rm9jdXNlZENvbnRleHRLZXkgfSBmcm9tICcuLi8uLi9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dFZpZXdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IGNyZWF0ZURlY29yYXRvciwgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IFJlc3VsdEtpbmQgfSBmcm9tICcuLi8uLi9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nUmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgZGVmYXVsdEZpbmRXaWRnZXRTdHlsZXMsIGRlZmF1bHRMaXN0U3R5bGVzLCBnZXRMaXN0U3R5bGVzLCBJU3R5bGVPdmVycmlkZSB9IGZyb20gJy4uLy4uL3RoZW1lL2Jyb3dzZXIvZGVmYXVsdFN0eWxlcy5qcyc7XG5cbmV4cG9ydCB0eXBlIExpc3RXaWRnZXQgPSBMaXN0PGFueT4gfCBQYWdlZExpc3Q8YW55PiB8IE9iamVjdFRyZWU8YW55LCBhbnk+IHwgRGF0YVRyZWU8YW55LCBhbnksIGFueT4gfCBBc3luY0RhdGFUcmVlPGFueSwgYW55LCBhbnk+IHwgVGFibGU8YW55PjtcbmV4cG9ydCB0eXBlIFdvcmtiZW5jaExpc3RXaWRnZXQgPSBXb3JrYmVuY2hMaXN0PGFueT4gfCBXb3JrYmVuY2hQYWdlZExpc3Q8YW55PiB8IFdvcmtiZW5jaE9iamVjdFRyZWU8YW55LCBhbnk+IHwgV29ya2JlbmNoQ29tcHJlc3NpYmxlT2JqZWN0VHJlZTxhbnksIGFueT4gfCBXb3JrYmVuY2hEYXRhVHJlZTxhbnksIGFueSwgYW55PiB8IFdvcmtiZW5jaEFzeW5jRGF0YVRyZWU8YW55LCBhbnksIGFueT4gfCBXb3JrYmVuY2hDb21wcmVzc2libGVBc3luY0RhdGFUcmVlPGFueSwgYW55LCBhbnk+IHwgV29ya2JlbmNoVGFibGU8YW55PjtcblxuZXhwb3J0IGNvbnN0IElMaXN0U2VydmljZSA9IGNyZWF0ZURlY29yYXRvcjxJTGlzdFNlcnZpY2U+KCdsaXN0U2VydmljZScpO1xuXG5leHBvcnQgaW50ZXJmYWNlIElMaXN0U2VydmljZSB7XG5cblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRoZSBjdXJyZW50bHkgZm9jdXNlZCBsaXN0IHdpZGdldCBpZiBhbnkuXG5cdCAqL1xuXHRyZWFkb25seSBsYXN0Rm9jdXNlZExpc3Q6IFdvcmtiZW5jaExpc3RXaWRnZXQgfCB1bmRlZmluZWQ7XG59XG5cbmludGVyZmFjZSBJUmVnaXN0ZXJlZExpc3Qge1xuXHR3aWRnZXQ6IFdvcmtiZW5jaExpc3RXaWRnZXQ7XG5cdGV4dHJhQ29udGV4dEtleXM/OiAoSUNvbnRleHRLZXk8Ym9vbGVhbj4pW107XG59XG5cbmV4cG9ydCBjbGFzcyBMaXN0U2VydmljZSBpbXBsZW1lbnRzIElMaXN0U2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSBsaXN0czogSVJlZ2lzdGVyZWRMaXN0W10gPSBbXTtcblx0cHJpdmF0ZSBfbGFzdEZvY3VzZWRXaWRnZXQ6IFdvcmtiZW5jaExpc3RXaWRnZXQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0Z2V0IGxhc3RGb2N1c2VkTGlzdCgpOiBXb3JrYmVuY2hMaXN0V2lkZ2V0IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fbGFzdEZvY3VzZWRXaWRnZXQ7XG5cdH1cblxuXHRjb25zdHJ1Y3RvcigpIHsgfVxuXG5cdHByaXZhdGUgc2V0TGFzdEZvY3VzZWRMaXN0KHdpZGdldDogV29ya2JlbmNoTGlzdFdpZGdldCB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmICh3aWRnZXQgPT09IHRoaXMuX2xhc3RGb2N1c2VkV2lkZ2V0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fbGFzdEZvY3VzZWRXaWRnZXQ/LmdldEhUTUxFbGVtZW50KCkuY2xhc3NMaXN0LnJlbW92ZSgnbGFzdC1mb2N1c2VkJyk7XG5cdFx0dGhpcy5fbGFzdEZvY3VzZWRXaWRnZXQgPSB3aWRnZXQ7XG5cdFx0dGhpcy5fbGFzdEZvY3VzZWRXaWRnZXQ/LmdldEhUTUxFbGVtZW50KCkuY2xhc3NMaXN0LmFkZCgnbGFzdC1mb2N1c2VkJyk7XG5cdH1cblxuXHRyZWdpc3Rlcih3aWRnZXQ6IFdvcmtiZW5jaExpc3RXaWRnZXQsIGV4dHJhQ29udGV4dEtleXM/OiAoSUNvbnRleHRLZXk8Ym9vbGVhbj4pW10pOiBJRGlzcG9zYWJsZSB7XG5cdFx0aWYgKHRoaXMubGlzdHMuc29tZShsID0+IGwud2lkZ2V0ID09PSB3aWRnZXQpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCByZWdpc3RlciB0aGUgc2FtZSB3aWRnZXQgbXVsdGlwbGUgdGltZXMnKTtcblx0XHR9XG5cblx0XHQvLyBLZWVwIGluIG91ciBsaXN0cyBsaXN0XG5cdFx0Y29uc3QgcmVnaXN0ZXJlZExpc3Q6IElSZWdpc3RlcmVkTGlzdCA9IHsgd2lkZ2V0LCBleHRyYUNvbnRleHRLZXlzIH07XG5cdFx0dGhpcy5saXN0cy5wdXNoKHJlZ2lzdGVyZWRMaXN0KTtcblxuXHRcdC8vIENoZWNrIGZvciBjdXJyZW50bHkgYmVpbmcgZm9jdXNlZFxuXHRcdGlmIChpc0FjdGl2ZUVsZW1lbnQod2lkZ2V0LmdldEhUTUxFbGVtZW50KCkpKSB7XG5cdFx0XHR0aGlzLnNldExhc3RGb2N1c2VkTGlzdCh3aWRnZXQpO1xuXHRcdH1cblxuXHRcdHJldHVybiBjb21iaW5lZERpc3Bvc2FibGUoXG5cdFx0XHR3aWRnZXQub25EaWRGb2N1cygoKSA9PiB0aGlzLnNldExhc3RGb2N1c2VkTGlzdCh3aWRnZXQpKSxcblx0XHRcdHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLmxpc3RzLnNwbGljZSh0aGlzLmxpc3RzLmluZGV4T2YocmVnaXN0ZXJlZExpc3QpLCAxKSksXG5cdFx0XHR3aWRnZXQub25EaWREaXNwb3NlKCgpID0+IHtcblx0XHRcdFx0dGhpcy5saXN0cyA9IHRoaXMubGlzdHMuZmlsdGVyKGwgPT4gbCAhPT0gcmVnaXN0ZXJlZExpc3QpO1xuXHRcdFx0XHRpZiAodGhpcy5fbGFzdEZvY3VzZWRXaWRnZXQgPT09IHdpZGdldCkge1xuXHRcdFx0XHRcdHRoaXMuc2V0TGFzdEZvY3VzZWRMaXN0KHVuZGVmaW5lZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0KTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IFJhd1dvcmtiZW5jaExpc3RTY3JvbGxBdEJvdW5kYXJ5Q29udGV4dEtleSA9IG5ldyBSYXdDb250ZXh0S2V5PCdub25lJyB8ICd0b3AnIHwgJ2JvdHRvbScgfCAnYm90aCc+KCdsaXN0U2Nyb2xsQXRCb3VuZGFyeScsICdub25lJyk7XG5leHBvcnQgY29uc3QgV29ya2JlbmNoTGlzdFNjcm9sbEF0VG9wQ29udGV4dEtleSA9IENvbnRleHRLZXlFeHByLm9yKFxuXHRSYXdXb3JrYmVuY2hMaXN0U2Nyb2xsQXRCb3VuZGFyeUNvbnRleHRLZXkuaXNFcXVhbFRvKCd0b3AnKSxcblx0UmF3V29ya2JlbmNoTGlzdFNjcm9sbEF0Qm91bmRhcnlDb250ZXh0S2V5LmlzRXF1YWxUbygnYm90aCcpKTtcbmV4cG9ydCBjb25zdCBXb3JrYmVuY2hMaXN0U2Nyb2xsQXRCb3R0b21Db250ZXh0S2V5ID0gQ29udGV4dEtleUV4cHIub3IoXG5cdFJhd1dvcmtiZW5jaExpc3RTY3JvbGxBdEJvdW5kYXJ5Q29udGV4dEtleS5pc0VxdWFsVG8oJ2JvdHRvbScpLFxuXHRSYXdXb3JrYmVuY2hMaXN0U2Nyb2xsQXRCb3VuZGFyeUNvbnRleHRLZXkuaXNFcXVhbFRvKCdib3RoJykpO1xuXG5leHBvcnQgY29uc3QgUmF3V29ya2JlbmNoTGlzdEZvY3VzQ29udGV4dEtleSA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdsaXN0Rm9jdXMnLCB0cnVlKTtcbmV4cG9ydCBjb25zdCBXb3JrYmVuY2hUcmVlU3RpY2t5U2Nyb2xsRm9jdXNlZCA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCd0cmVlc3RpY2t5U2Nyb2xsRm9jdXNlZCcsIGZhbHNlKTtcbmV4cG9ydCBjb25zdCBXb3JrYmVuY2hMaXN0U3VwcG9ydHNNdWx0aVNlbGVjdENvbnRleHRLZXkgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignbGlzdFN1cHBvcnRzTXVsdGlzZWxlY3QnLCB0cnVlKTtcbmV4cG9ydCBjb25zdCBXb3JrYmVuY2hMaXN0Rm9jdXNDb250ZXh0S2V5ID0gQ29udGV4dEtleUV4cHIuYW5kKFJhd1dvcmtiZW5jaExpc3RGb2N1c0NvbnRleHRLZXksIENvbnRleHRLZXlFeHByLm5vdChJbnB1dEZvY3VzZWRDb250ZXh0S2V5KSwgV29ya2JlbmNoVHJlZVN0aWNreVNjcm9sbEZvY3VzZWQubmVnYXRlKCkpO1xuZXhwb3J0IGNvbnN0IFdvcmtiZW5jaExpc3RIYXNTZWxlY3Rpb25PckZvY3VzID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ2xpc3RIYXNTZWxlY3Rpb25PckZvY3VzJywgZmFsc2UpO1xuZXhwb3J0IGNvbnN0IFdvcmtiZW5jaExpc3REb3VibGVTZWxlY3Rpb24gPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignbGlzdERvdWJsZVNlbGVjdGlvbicsIGZhbHNlKTtcbmV4cG9ydCBjb25zdCBXb3JrYmVuY2hMaXN0TXVsdGlTZWxlY3Rpb24gPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignbGlzdE11bHRpU2VsZWN0aW9uJywgZmFsc2UpO1xuZXhwb3J0IGNvbnN0IFdvcmtiZW5jaExpc3RTZWxlY3Rpb25OYXZpZ2F0aW9uID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ2xpc3RTZWxlY3Rpb25OYXZpZ2F0aW9uJywgZmFsc2UpO1xuZXhwb3J0IGNvbnN0IFdvcmtiZW5jaExpc3RTdXBwb3J0c0ZpbmQgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignbGlzdFN1cHBvcnRzRmluZCcsIHRydWUpO1xuZXhwb3J0IGNvbnN0IFdvcmtiZW5jaFRyZWVFbGVtZW50Q2FuQ29sbGFwc2UgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPigndHJlZUVsZW1lbnRDYW5Db2xsYXBzZScsIGZhbHNlKTtcbmV4cG9ydCBjb25zdCBXb3JrYmVuY2hUcmVlRWxlbWVudEhhc1BhcmVudCA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCd0cmVlRWxlbWVudEhhc1BhcmVudCcsIGZhbHNlKTtcbmV4cG9ydCBjb25zdCBXb3JrYmVuY2hUcmVlRWxlbWVudENhbkV4cGFuZCA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCd0cmVlRWxlbWVudENhbkV4cGFuZCcsIGZhbHNlKTtcbmV4cG9ydCBjb25zdCBXb3JrYmVuY2hUcmVlRWxlbWVudEhhc0NoaWxkID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ3RyZWVFbGVtZW50SGFzQ2hpbGQnLCBmYWxzZSk7XG5leHBvcnQgY29uc3QgV29ya2JlbmNoVHJlZUZpbmRPcGVuID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ3RyZWVGaW5kT3BlbicsIGZhbHNlKTtcbmNvbnN0IFdvcmtiZW5jaExpc3RUeXBlTmF2aWdhdGlvbk1vZGVLZXkgPSAnbGlzdFR5cGVOYXZpZ2F0aW9uTW9kZSc7XG5cbi8qKlxuICogQGRlcHJlY2F0ZWQgaW4gZmF2b3Igb2YgV29ya2JlbmNoTGlzdFR5cGVOYXZpZ2F0aW9uTW9kZUtleVxuICovXG5jb25zdCBXb3JrYmVuY2hMaXN0QXV0b21hdGljS2V5Ym9hcmROYXZpZ2F0aW9uTGVnYWN5S2V5ID0gJ2xpc3RBdXRvbWF0aWNLZXlib2FyZE5hdmlnYXRpb24nO1xuXG5mdW5jdGlvbiBjcmVhdGVTY29wZWRDb250ZXh0S2V5U2VydmljZShjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLCB3aWRnZXQ6IExpc3RXaWRnZXQpOiBJU2NvcGVkQ29udGV4dEtleVNlcnZpY2Uge1xuXHRjb25zdCByZXN1bHQgPSBjb250ZXh0S2V5U2VydmljZS5jcmVhdGVTY29wZWQod2lkZ2V0LmdldEhUTUxFbGVtZW50KCkpO1xuXHRSYXdXb3JrYmVuY2hMaXN0Rm9jdXNDb250ZXh0S2V5LmJpbmRUbyhyZXN1bHQpO1xuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG4vLyBOb3RlOiBXZSBtdXN0IGRlY2xhcmUgSVNjcm9sbE9ic2VydmFyYWJsZSBhcyB0aGUgYXJpdGhtZXRpYyBvZiBjb25jcmV0ZSBjbGFzc2VzLFxuLy8gaW5zdGVhZCBvZiBvYmplY3QgdHlwZSBsaWtlIHsgb25EaWRTY3JvbGw6IEV2ZW50PGFueT47IC4uLiB9LiBUaGUgbGF0dGVyIHdpbGwgbm90IG1hcmtcbi8vIHRob3NlIHByb3BlcnRpZXMgYXMgcmVmZXJlbmNlZCBkdXJpbmcgdHJlZS1zaGFraW5nLCBjYXVzaW5nIHRoZW0gdG8gYmUgc2hha2VkIGF3YXkuXG50eXBlIElTY3JvbGxPYnNlcnZhcmFibGUgPSBFeGNsdWRlPFdvcmtiZW5jaExpc3RXaWRnZXQsIFdvcmtiZW5jaFBhZ2VkTGlzdDxhbnk+PiB8IExpc3Q8YW55PjtcblxuZnVuY3Rpb24gY3JlYXRlU2Nyb2xsT2JzZXJ2ZXIoY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSwgd2lkZ2V0OiBJU2Nyb2xsT2JzZXJ2YXJhYmxlKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBsaXN0U2Nyb2xsQXQgPSBSYXdXb3JrYmVuY2hMaXN0U2Nyb2xsQXRCb3VuZGFyeUNvbnRleHRLZXkuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0Y29uc3QgdXBkYXRlID0gKCkgPT4ge1xuXHRcdGNvbnN0IGF0VG9wID0gd2lkZ2V0LnNjcm9sbFRvcCA9PT0gMDtcblxuXHRcdC8vIFdlIG5lZWQgYSB0aHJlc2hvbGQgYDFgIHNpbmNlIHNjcm9sbEhlaWdodCBpcyByb3VuZGVkLlxuXHRcdC8vIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9FbGVtZW50L3Njcm9sbEhlaWdodCNkZXRlcm1pbmVfaWZfYW5fZWxlbWVudF9oYXNfYmVlbl90b3RhbGx5X3Njcm9sbGVkXG5cdFx0Y29uc3QgYXRCb3R0b20gPSB3aWRnZXQuc2Nyb2xsSGVpZ2h0IC0gd2lkZ2V0LnJlbmRlckhlaWdodCAtIHdpZGdldC5zY3JvbGxUb3AgPCAxO1xuXHRcdGlmIChhdFRvcCAmJiBhdEJvdHRvbSkge1xuXHRcdFx0bGlzdFNjcm9sbEF0LnNldCgnYm90aCcpO1xuXHRcdH0gZWxzZSBpZiAoYXRUb3ApIHtcblx0XHRcdGxpc3RTY3JvbGxBdC5zZXQoJ3RvcCcpO1xuXHRcdH0gZWxzZSBpZiAoYXRCb3R0b20pIHtcblx0XHRcdGxpc3RTY3JvbGxBdC5zZXQoJ2JvdHRvbScpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRsaXN0U2Nyb2xsQXQuc2V0KCdub25lJyk7XG5cdFx0fVxuXHR9O1xuXHR1cGRhdGUoKTtcblx0cmV0dXJuIHdpZGdldC5vbkRpZFNjcm9sbCh1cGRhdGUpO1xufVxuXG5jb25zdCBtdWx0aVNlbGVjdE1vZGlmaWVyU2V0dGluZ0tleSA9ICd3b3JrYmVuY2gubGlzdC5tdWx0aVNlbGVjdE1vZGlmaWVyJztcbmNvbnN0IG9wZW5Nb2RlU2V0dGluZ0tleSA9ICd3b3JrYmVuY2gubGlzdC5vcGVuTW9kZSc7XG5jb25zdCBob3Jpem9udGFsU2Nyb2xsaW5nS2V5ID0gJ3dvcmtiZW5jaC5saXN0Lmhvcml6b250YWxTY3JvbGxpbmcnO1xuY29uc3QgZGVmYXVsdEZpbmRNb2RlU2V0dGluZ0tleSA9ICd3b3JrYmVuY2gubGlzdC5kZWZhdWx0RmluZE1vZGUnO1xuY29uc3QgdHlwZU5hdmlnYXRpb25Nb2RlU2V0dGluZ0tleSA9ICd3b3JrYmVuY2gubGlzdC50eXBlTmF2aWdhdGlvbk1vZGUnO1xuLyoqIEBkZXByZWNhdGVkIGluIGZhdm9yIG9mIGB3b3JrYmVuY2gubGlzdC5kZWZhdWx0RmluZE1vZGVgIGFuZCBgd29ya2JlbmNoLmxpc3QudHlwZU5hdmlnYXRpb25Nb2RlYCAqL1xuY29uc3Qga2V5Ym9hcmROYXZpZ2F0aW9uU2V0dGluZ0tleSA9ICd3b3JrYmVuY2gubGlzdC5rZXlib2FyZE5hdmlnYXRpb24nO1xuY29uc3Qgc2Nyb2xsQnlQYWdlS2V5ID0gJ3dvcmtiZW5jaC5saXN0LnNjcm9sbEJ5UGFnZSc7XG5jb25zdCBkZWZhdWx0RmluZE1hdGNoVHlwZVNldHRpbmdLZXkgPSAnd29ya2JlbmNoLmxpc3QuZGVmYXVsdEZpbmRNYXRjaFR5cGUnO1xuY29uc3QgdHJlZUluZGVudEtleSA9ICd3b3JrYmVuY2gudHJlZS5pbmRlbnQnO1xuY29uc3QgdHJlZVJlbmRlckluZGVudEd1aWRlc0tleSA9ICd3b3JrYmVuY2gudHJlZS5yZW5kZXJJbmRlbnRHdWlkZXMnO1xuY29uc3QgbGlzdFNtb290aFNjcm9sbGluZyA9ICd3b3JrYmVuY2gubGlzdC5zbW9vdGhTY3JvbGxpbmcnO1xuY29uc3QgbW91c2VXaGVlbFNjcm9sbFNlbnNpdGl2aXR5S2V5ID0gJ3dvcmtiZW5jaC5saXN0Lm1vdXNlV2hlZWxTY3JvbGxTZW5zaXRpdml0eSc7XG5jb25zdCBmYXN0U2Nyb2xsU2Vuc2l0aXZpdHlLZXkgPSAnd29ya2JlbmNoLmxpc3QuZmFzdFNjcm9sbFNlbnNpdGl2aXR5JztcbmNvbnN0IHRyZWVFeHBhbmRNb2RlID0gJ3dvcmtiZW5jaC50cmVlLmV4cGFuZE1vZGUnO1xuY29uc3QgdHJlZVN0aWNreVNjcm9sbCA9ICd3b3JrYmVuY2gudHJlZS5lbmFibGVTdGlja3lTY3JvbGwnO1xuY29uc3QgdHJlZVN0aWNreVNjcm9sbE1heEVsZW1lbnRzID0gJ3dvcmtiZW5jaC50cmVlLnN0aWNreVNjcm9sbE1heEl0ZW1Db3VudCc7XG5cbmZ1bmN0aW9uIHVzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllcihjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTogYm9vbGVhbiB7XG5cdHJldHVybiBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShtdWx0aVNlbGVjdE1vZGlmaWVyU2V0dGluZ0tleSkgPT09ICdhbHQnO1xufVxuXG5jbGFzcyBNdWx0aXBsZVNlbGVjdGlvbkNvbnRyb2xsZXI8VD4gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSU11bHRpcGxlU2VsZWN0aW9uQ29udHJvbGxlcjxUPiB7XG5cdHByaXZhdGUgdXNlQWx0QXNNdWx0aXBsZVNlbGVjdGlvbk1vZGlmaWVyOiBib29sZWFuO1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnVzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllciA9IHVzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllcihjb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24obXVsdGlTZWxlY3RNb2RpZmllclNldHRpbmdLZXkpKSB7XG5cdFx0XHRcdHRoaXMudXNlQWx0QXNNdWx0aXBsZVNlbGVjdGlvbk1vZGlmaWVyID0gdXNlQWx0QXNNdWx0aXBsZVNlbGVjdGlvbk1vZGlmaWVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdGlzU2VsZWN0aW9uU2luZ2xlQ2hhbmdlRXZlbnQoZXZlbnQ6IElMaXN0TW91c2VFdmVudDxUPiB8IElMaXN0VG91Y2hFdmVudDxUPik6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLnVzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllcikge1xuXHRcdFx0cmV0dXJuIGV2ZW50LmJyb3dzZXJFdmVudC5hbHRLZXk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGlzU2VsZWN0aW9uU2luZ2xlQ2hhbmdlRXZlbnQoZXZlbnQpO1xuXHR9XG5cblx0aXNTZWxlY3Rpb25SYW5nZUNoYW5nZUV2ZW50KGV2ZW50OiBJTGlzdE1vdXNlRXZlbnQ8VD4gfCBJTGlzdFRvdWNoRXZlbnQ8VD4pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gaXNTZWxlY3Rpb25SYW5nZUNoYW5nZUV2ZW50KGV2ZW50KTtcblx0fVxufVxuXG5mdW5jdGlvbiB0b1dvcmtiZW5jaExpc3RPcHRpb25zPFQ+KFxuXHRhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcixcblx0b3B0aW9uczogSUxpc3RPcHRpb25zPFQ+LFxuKTogW0lMaXN0T3B0aW9uczxUPiwgSURpc3Bvc2FibGVdIHtcblx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0Y29uc3Qga2V5YmluZGluZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUtleWJpbmRpbmdTZXJ2aWNlKTtcblxuXHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0Y29uc3QgcmVzdWx0OiBJTGlzdE9wdGlvbnM8VD4gPSB7XG5cdFx0Li4ub3B0aW9ucyxcblx0XHRrZXlib2FyZE5hdmlnYXRpb25EZWxlZ2F0ZTogeyBtaWdodFByb2R1Y2VQcmludGFibGVDaGFyYWN0ZXIoZSkgeyByZXR1cm4ga2V5YmluZGluZ1NlcnZpY2UubWlnaHRQcm9kdWNlUHJpbnRhYmxlQ2hhcmFjdGVyKGUpOyB9IH0sXG5cdFx0c21vb3RoU2Nyb2xsaW5nOiBCb29sZWFuKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKGxpc3RTbW9vdGhTY3JvbGxpbmcpKSxcblx0XHRtb3VzZVdoZWVsU2Nyb2xsU2Vuc2l0aXZpdHk6IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPG51bWJlcj4obW91c2VXaGVlbFNjcm9sbFNlbnNpdGl2aXR5S2V5KSxcblx0XHRmYXN0U2Nyb2xsU2Vuc2l0aXZpdHk6IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPG51bWJlcj4oZmFzdFNjcm9sbFNlbnNpdGl2aXR5S2V5KSxcblx0XHRtdWx0aXBsZVNlbGVjdGlvbkNvbnRyb2xsZXI6IG9wdGlvbnMubXVsdGlwbGVTZWxlY3Rpb25Db250cm9sbGVyID8/IGRpc3Bvc2FibGVzLmFkZChuZXcgTXVsdGlwbGVTZWxlY3Rpb25Db250cm9sbGVyKGNvbmZpZ3VyYXRpb25TZXJ2aWNlKSksXG5cdFx0a2V5Ym9hcmROYXZpZ2F0aW9uRXZlbnRGaWx0ZXI6IGNyZWF0ZUtleWJvYXJkTmF2aWdhdGlvbkV2ZW50RmlsdGVyKGtleWJpbmRpbmdTZXJ2aWNlKSxcblx0XHRzY3JvbGxCeVBhZ2U6IEJvb2xlYW4oY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoc2Nyb2xsQnlQYWdlS2V5KSlcblx0fTtcblxuXHRyZXR1cm4gW3Jlc3VsdCwgZGlzcG9zYWJsZXNdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElXb3JrYmVuY2hMaXN0T3B0aW9uc1VwZGF0ZSBleHRlbmRzIElMaXN0T3B0aW9uc1VwZGF0ZSB7XG5cdHJlYWRvbmx5IG92ZXJyaWRlU3R5bGVzPzogSVN0eWxlT3ZlcnJpZGU8SUxpc3RTdHlsZXM+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElXb3JrYmVuY2hMaXN0T3B0aW9uczxUPiBleHRlbmRzIElXb3JrYmVuY2hMaXN0T3B0aW9uc1VwZGF0ZSwgSVJlc291cmNlTmF2aWdhdG9yT3B0aW9ucywgSUxpc3RPcHRpb25zPFQ+IHtcblx0cmVhZG9ubHkgc2VsZWN0aW9uTmF2aWdhdGlvbj86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBXb3JrYmVuY2hMaXN0PFQ+IGV4dGVuZHMgTGlzdDxUPiB7XG5cblx0cmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElTY29wZWRDb250ZXh0S2V5U2VydmljZTtcblx0cHJpdmF0ZSBsaXN0U3VwcG9ydHNNdWx0aVNlbGVjdDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgbGlzdEhhc1NlbGVjdGlvbk9yRm9jdXM6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGxpc3REb3VibGVTZWxlY3Rpb246IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGxpc3RNdWx0aVNlbGVjdGlvbjogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgaG9yaXpvbnRhbFNjcm9sbGluZzogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfdXNlQWx0QXNNdWx0aXBsZVNlbGVjdGlvbk1vZGlmaWVyOiBib29sZWFuO1xuXHRwcml2YXRlIG5hdmlnYXRvcjogTGlzdFJlc291cmNlTmF2aWdhdG9yPFQ+O1xuXHRnZXQgb25EaWRPcGVuKCk6IEV2ZW50PElPcGVuRXZlbnQ8VCB8IHVuZGVmaW5lZD4+IHsgcmV0dXJuIHRoaXMubmF2aWdhdG9yLm9uRGlkT3BlbjsgfVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHVzZXI6IHN0cmluZyxcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdGRlbGVnYXRlOiBJTGlzdFZpcnR1YWxEZWxlZ2F0ZTxUPixcblx0XHRyZW5kZXJlcnM6IElMaXN0UmVuZGVyZXI8VCwgYW55PltdLFxuXHRcdG9wdGlvbnM6IElXb3JrYmVuY2hMaXN0T3B0aW9uczxUPixcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElMaXN0U2VydmljZSBsaXN0U2VydmljZTogSUxpc3RTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0Y29uc3QgaG9yaXpvbnRhbFNjcm9sbGluZyA9IHR5cGVvZiBvcHRpb25zLmhvcml6b250YWxTY3JvbGxpbmcgIT09ICd1bmRlZmluZWQnID8gb3B0aW9ucy5ob3Jpem9udGFsU2Nyb2xsaW5nIDogQm9vbGVhbihjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShob3Jpem9udGFsU2Nyb2xsaW5nS2V5KSk7XG5cdFx0Y29uc3QgW3dvcmtiZW5jaExpc3RPcHRpb25zLCB3b3JrYmVuY2hMaXN0T3B0aW9uc0Rpc3Bvc2FibGVdID0gaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24odG9Xb3JrYmVuY2hMaXN0T3B0aW9ucywgb3B0aW9ucyk7XG5cblx0XHRzdXBlcih1c2VyLCBjb250YWluZXIsIGRlbGVnYXRlLCByZW5kZXJlcnMsXG5cdFx0XHR7XG5cdFx0XHRcdGtleWJvYXJkU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRcdC4uLndvcmtiZW5jaExpc3RPcHRpb25zLFxuXHRcdFx0XHRob3Jpem9udGFsU2Nyb2xsaW5nLFxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh3b3JrYmVuY2hMaXN0T3B0aW9uc0Rpc3Bvc2FibGUpO1xuXG5cdFx0dGhpcy5jb250ZXh0S2V5U2VydmljZSA9IGNyZWF0ZVNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKGNvbnRleHRLZXlTZXJ2aWNlLCB0aGlzKTtcblxuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZVNjcm9sbE9ic2VydmVyKHRoaXMuY29udGV4dEtleVNlcnZpY2UsIHRoaXMpKTtcblxuXHRcdHRoaXMubGlzdFN1cHBvcnRzTXVsdGlTZWxlY3QgPSBXb3JrYmVuY2hMaXN0U3VwcG9ydHNNdWx0aVNlbGVjdENvbnRleHRLZXkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMubGlzdFN1cHBvcnRzTXVsdGlTZWxlY3Quc2V0KG9wdGlvbnMubXVsdGlwbGVTZWxlY3Rpb25TdXBwb3J0ICE9PSBmYWxzZSk7XG5cblx0XHRjb25zdCBsaXN0U2VsZWN0aW9uTmF2aWdhdGlvbiA9IFdvcmtiZW5jaExpc3RTZWxlY3Rpb25OYXZpZ2F0aW9uLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRsaXN0U2VsZWN0aW9uTmF2aWdhdGlvbi5zZXQoQm9vbGVhbihvcHRpb25zLnNlbGVjdGlvbk5hdmlnYXRpb24pKTtcblxuXHRcdHRoaXMubGlzdEhhc1NlbGVjdGlvbk9yRm9jdXMgPSBXb3JrYmVuY2hMaXN0SGFzU2VsZWN0aW9uT3JGb2N1cy5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5saXN0RG91YmxlU2VsZWN0aW9uID0gV29ya2JlbmNoTGlzdERvdWJsZVNlbGVjdGlvbi5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5saXN0TXVsdGlTZWxlY3Rpb24gPSBXb3JrYmVuY2hMaXN0TXVsdGlTZWxlY3Rpb24uYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuaG9yaXpvbnRhbFNjcm9sbGluZyA9IG9wdGlvbnMuaG9yaXpvbnRhbFNjcm9sbGluZztcblxuXHRcdHRoaXMuX3VzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllciA9IHVzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllcihjb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCgobGlzdFNlcnZpY2UgYXMgTGlzdFNlcnZpY2UpLnJlZ2lzdGVyKHRoaXMpKTtcblxuXHRcdHRoaXMudXBkYXRlU3R5bGVzKG9wdGlvbnMub3ZlcnJpZGVTdHlsZXMpO1xuXG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5vbkRpZENoYW5nZVNlbGVjdGlvbigoKSA9PiB7XG5cdFx0XHRjb25zdCBzZWxlY3Rpb24gPSB0aGlzLmdldFNlbGVjdGlvbigpO1xuXHRcdFx0Y29uc3QgZm9jdXMgPSB0aGlzLmdldEZvY3VzKCk7XG5cblx0XHRcdHRoaXMuY29udGV4dEtleVNlcnZpY2UuYnVmZmVyQ2hhbmdlRXZlbnRzKCgpID0+IHtcblx0XHRcdFx0dGhpcy5saXN0SGFzU2VsZWN0aW9uT3JGb2N1cy5zZXQoc2VsZWN0aW9uLmxlbmd0aCA+IDAgfHwgZm9jdXMubGVuZ3RoID4gMCk7XG5cdFx0XHRcdHRoaXMubGlzdE11bHRpU2VsZWN0aW9uLnNldChzZWxlY3Rpb24ubGVuZ3RoID4gMSk7XG5cdFx0XHRcdHRoaXMubGlzdERvdWJsZVNlbGVjdGlvbi5zZXQoc2VsZWN0aW9uLmxlbmd0aCA9PT0gMik7XG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5vbkRpZENoYW5nZUZvY3VzKCgpID0+IHtcblx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRjb25zdCBmb2N1cyA9IHRoaXMuZ2V0Rm9jdXMoKTtcblxuXHRcdFx0dGhpcy5saXN0SGFzU2VsZWN0aW9uT3JGb2N1cy5zZXQoc2VsZWN0aW9uLmxlbmd0aCA+IDAgfHwgZm9jdXMubGVuZ3RoID4gMCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKG11bHRpU2VsZWN0TW9kaWZpZXJTZXR0aW5nS2V5KSkge1xuXHRcdFx0XHR0aGlzLl91c2VBbHRBc011bHRpcGxlU2VsZWN0aW9uTW9kaWZpZXIgPSB1c2VBbHRBc011bHRpcGxlU2VsZWN0aW9uTW9kaWZpZXIoY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgb3B0aW9uczogSUxpc3RPcHRpb25zVXBkYXRlID0ge307XG5cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKGhvcml6b250YWxTY3JvbGxpbmdLZXkpICYmIHRoaXMuaG9yaXpvbnRhbFNjcm9sbGluZyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGNvbnN0IGhvcml6b250YWxTY3JvbGxpbmcgPSBCb29sZWFuKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKGhvcml6b250YWxTY3JvbGxpbmdLZXkpKTtcblx0XHRcdFx0b3B0aW9ucyA9IHsgLi4ub3B0aW9ucywgaG9yaXpvbnRhbFNjcm9sbGluZyB9O1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oc2Nyb2xsQnlQYWdlS2V5KSkge1xuXHRcdFx0XHRjb25zdCBzY3JvbGxCeVBhZ2UgPSBCb29sZWFuKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKHNjcm9sbEJ5UGFnZUtleSkpO1xuXHRcdFx0XHRvcHRpb25zID0geyAuLi5vcHRpb25zLCBzY3JvbGxCeVBhZ2UgfTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKGxpc3RTbW9vdGhTY3JvbGxpbmcpKSB7XG5cdFx0XHRcdGNvbnN0IHNtb290aFNjcm9sbGluZyA9IEJvb2xlYW4oY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUobGlzdFNtb290aFNjcm9sbGluZykpO1xuXHRcdFx0XHRvcHRpb25zID0geyAuLi5vcHRpb25zLCBzbW9vdGhTY3JvbGxpbmcgfTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKG1vdXNlV2hlZWxTY3JvbGxTZW5zaXRpdml0eUtleSkpIHtcblx0XHRcdFx0Y29uc3QgbW91c2VXaGVlbFNjcm9sbFNlbnNpdGl2aXR5ID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPihtb3VzZVdoZWVsU2Nyb2xsU2Vuc2l0aXZpdHlLZXkpO1xuXHRcdFx0XHRvcHRpb25zID0geyAuLi5vcHRpb25zLCBtb3VzZVdoZWVsU2Nyb2xsU2Vuc2l0aXZpdHkgfTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKGZhc3RTY3JvbGxTZW5zaXRpdml0eUtleSkpIHtcblx0XHRcdFx0Y29uc3QgZmFzdFNjcm9sbFNlbnNpdGl2aXR5ID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPihmYXN0U2Nyb2xsU2Vuc2l0aXZpdHlLZXkpO1xuXHRcdFx0XHRvcHRpb25zID0geyAuLi5vcHRpb25zLCBmYXN0U2Nyb2xsU2Vuc2l0aXZpdHkgfTtcblx0XHRcdH1cblx0XHRcdGlmIChPYmplY3Qua2V5cyhvcHRpb25zKS5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlT3B0aW9ucyhvcHRpb25zKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLm5hdmlnYXRvciA9IG5ldyBMaXN0UmVzb3VyY2VOYXZpZ2F0b3IodGhpcywgeyBjb25maWd1cmF0aW9uU2VydmljZSwgLi4ub3B0aW9ucyB9KTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLm5hdmlnYXRvcik7XG5cdH1cblxuXHRvdmVycmlkZSB1cGRhdGVPcHRpb25zKG9wdGlvbnM6IElXb3JrYmVuY2hMaXN0T3B0aW9uc1VwZGF0ZSk6IHZvaWQge1xuXHRcdHN1cGVyLnVwZGF0ZU9wdGlvbnMob3B0aW9ucyk7XG5cblx0XHRpZiAob3B0aW9ucy5vdmVycmlkZVN0eWxlcyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVN0eWxlcyhvcHRpb25zLm92ZXJyaWRlU3R5bGVzKTtcblx0XHR9XG5cblx0XHRpZiAob3B0aW9ucy5tdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5saXN0U3VwcG9ydHNNdWx0aVNlbGVjdC5zZXQoISFvcHRpb25zLm11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVTdHlsZXMoc3R5bGVzOiBJU3R5bGVPdmVycmlkZTxJTGlzdFN0eWxlcz4gfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLnN0eWxlKHN0eWxlcyA/IGdldExpc3RTdHlsZXMoc3R5bGVzKSA6IGRlZmF1bHRMaXN0U3R5bGVzKTtcblx0fVxuXG5cdGdldCB1c2VBbHRBc011bHRpcGxlU2VsZWN0aW9uTW9kaWZpZXIoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3VzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllcjtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElXb3JrYmVuY2hQYWdlZExpc3RPcHRpb25zPFQ+IGV4dGVuZHMgSVdvcmtiZW5jaExpc3RPcHRpb25zVXBkYXRlLCBJUmVzb3VyY2VOYXZpZ2F0b3JPcHRpb25zLCBJUGFnZWRMaXN0T3B0aW9uczxUPiB7XG5cdHJlYWRvbmx5IHNlbGVjdGlvbk5hdmlnYXRpb24/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgV29ya2JlbmNoUGFnZWRMaXN0PFQ+IGV4dGVuZHMgUGFnZWRMaXN0PFQ+IHtcblxuXHRyZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSVNjb3BlZENvbnRleHRLZXlTZXJ2aWNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdHByaXZhdGUgbGlzdFN1cHBvcnRzTXVsdGlTZWxlY3Q6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIF91c2VBbHRBc011bHRpcGxlU2VsZWN0aW9uTW9kaWZpZXI6IGJvb2xlYW47XG5cdHByaXZhdGUgaG9yaXpvbnRhbFNjcm9sbGluZzogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBuYXZpZ2F0b3I6IExpc3RSZXNvdXJjZU5hdmlnYXRvcjxUPjtcblx0Z2V0IG9uRGlkT3BlbigpOiBFdmVudDxJT3BlbkV2ZW50PFQgfCB1bmRlZmluZWQ+PiB7IHJldHVybiB0aGlzLm5hdmlnYXRvci5vbkRpZE9wZW47IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHR1c2VyOiBzdHJpbmcsXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRkZWxlZ2F0ZTogSUxpc3RWaXJ0dWFsRGVsZWdhdGU8bnVtYmVyPixcblx0XHRyZW5kZXJlcnM6IElQYWdlZFJlbmRlcmVyPFQsIGFueT5bXSxcblx0XHRvcHRpb25zOiBJV29ya2JlbmNoUGFnZWRMaXN0T3B0aW9uczxUPixcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElMaXN0U2VydmljZSBsaXN0U2VydmljZTogSUxpc3RTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0Y29uc3QgaG9yaXpvbnRhbFNjcm9sbGluZyA9IHR5cGVvZiBvcHRpb25zLmhvcml6b250YWxTY3JvbGxpbmcgIT09ICd1bmRlZmluZWQnID8gb3B0aW9ucy5ob3Jpem9udGFsU2Nyb2xsaW5nIDogQm9vbGVhbihjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShob3Jpem9udGFsU2Nyb2xsaW5nS2V5KSk7XG5cdFx0Y29uc3QgW3dvcmtiZW5jaExpc3RPcHRpb25zLCB3b3JrYmVuY2hMaXN0T3B0aW9uc0Rpc3Bvc2FibGVdID0gaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24odG9Xb3JrYmVuY2hMaXN0T3B0aW9ucywgb3B0aW9ucyk7XG5cdFx0c3VwZXIodXNlciwgY29udGFpbmVyLCBkZWxlZ2F0ZSwgcmVuZGVyZXJzLFxuXHRcdFx0e1xuXHRcdFx0XHRrZXlib2FyZFN1cHBvcnQ6IGZhbHNlLFxuXHRcdFx0XHQuLi53b3JrYmVuY2hMaXN0T3B0aW9ucyxcblx0XHRcdFx0aG9yaXpvbnRhbFNjcm9sbGluZyxcblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0dGhpcy5kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh3b3JrYmVuY2hMaXN0T3B0aW9uc0Rpc3Bvc2FibGUpO1xuXG5cdFx0dGhpcy5jb250ZXh0S2V5U2VydmljZSA9IGNyZWF0ZVNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKGNvbnRleHRLZXlTZXJ2aWNlLCB0aGlzKTtcblxuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZVNjcm9sbE9ic2VydmVyKHRoaXMuY29udGV4dEtleVNlcnZpY2UsIHRoaXMud2lkZ2V0KSk7XG5cblx0XHR0aGlzLmhvcml6b250YWxTY3JvbGxpbmcgPSBvcHRpb25zLmhvcml6b250YWxTY3JvbGxpbmc7XG5cblx0XHR0aGlzLmxpc3RTdXBwb3J0c011bHRpU2VsZWN0ID0gV29ya2JlbmNoTGlzdFN1cHBvcnRzTXVsdGlTZWxlY3RDb250ZXh0S2V5LmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmxpc3RTdXBwb3J0c011bHRpU2VsZWN0LnNldChvcHRpb25zLm11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydCAhPT0gZmFsc2UpO1xuXG5cdFx0Y29uc3QgbGlzdFNlbGVjdGlvbk5hdmlnYXRpb24gPSBXb3JrYmVuY2hMaXN0U2VsZWN0aW9uTmF2aWdhdGlvbi5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0bGlzdFNlbGVjdGlvbk5hdmlnYXRpb24uc2V0KEJvb2xlYW4ob3B0aW9ucy5zZWxlY3Rpb25OYXZpZ2F0aW9uKSk7XG5cblx0XHR0aGlzLl91c2VBbHRBc011bHRpcGxlU2VsZWN0aW9uTW9kaWZpZXIgPSB1c2VBbHRBc011bHRpcGxlU2VsZWN0aW9uTW9kaWZpZXIoY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQoKGxpc3RTZXJ2aWNlIGFzIExpc3RTZXJ2aWNlKS5yZWdpc3Rlcih0aGlzKSk7XG5cblx0XHR0aGlzLnVwZGF0ZVN0eWxlcyhvcHRpb25zLm92ZXJyaWRlU3R5bGVzKTtcblxuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKG11bHRpU2VsZWN0TW9kaWZpZXJTZXR0aW5nS2V5KSkge1xuXHRcdFx0XHR0aGlzLl91c2VBbHRBc011bHRpcGxlU2VsZWN0aW9uTW9kaWZpZXIgPSB1c2VBbHRBc011bHRpcGxlU2VsZWN0aW9uTW9kaWZpZXIoY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgb3B0aW9uczogSUxpc3RPcHRpb25zVXBkYXRlID0ge307XG5cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKGhvcml6b250YWxTY3JvbGxpbmdLZXkpICYmIHRoaXMuaG9yaXpvbnRhbFNjcm9sbGluZyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGNvbnN0IGhvcml6b250YWxTY3JvbGxpbmcgPSBCb29sZWFuKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKGhvcml6b250YWxTY3JvbGxpbmdLZXkpKTtcblx0XHRcdFx0b3B0aW9ucyA9IHsgLi4ub3B0aW9ucywgaG9yaXpvbnRhbFNjcm9sbGluZyB9O1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oc2Nyb2xsQnlQYWdlS2V5KSkge1xuXHRcdFx0XHRjb25zdCBzY3JvbGxCeVBhZ2UgPSBCb29sZWFuKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKHNjcm9sbEJ5UGFnZUtleSkpO1xuXHRcdFx0XHRvcHRpb25zID0geyAuLi5vcHRpb25zLCBzY3JvbGxCeVBhZ2UgfTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKGxpc3RTbW9vdGhTY3JvbGxpbmcpKSB7XG5cdFx0XHRcdGNvbnN0IHNtb290aFNjcm9sbGluZyA9IEJvb2xlYW4oY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUobGlzdFNtb290aFNjcm9sbGluZykpO1xuXHRcdFx0XHRvcHRpb25zID0geyAuLi5vcHRpb25zLCBzbW9vdGhTY3JvbGxpbmcgfTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKG1vdXNlV2hlZWxTY3JvbGxTZW5zaXRpdml0eUtleSkpIHtcblx0XHRcdFx0Y29uc3QgbW91c2VXaGVlbFNjcm9sbFNlbnNpdGl2aXR5ID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPihtb3VzZVdoZWVsU2Nyb2xsU2Vuc2l0aXZpdHlLZXkpO1xuXHRcdFx0XHRvcHRpb25zID0geyAuLi5vcHRpb25zLCBtb3VzZVdoZWVsU2Nyb2xsU2Vuc2l0aXZpdHkgfTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKGZhc3RTY3JvbGxTZW5zaXRpdml0eUtleSkpIHtcblx0XHRcdFx0Y29uc3QgZmFzdFNjcm9sbFNlbnNpdGl2aXR5ID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPihmYXN0U2Nyb2xsU2Vuc2l0aXZpdHlLZXkpO1xuXHRcdFx0XHRvcHRpb25zID0geyAuLi5vcHRpb25zLCBmYXN0U2Nyb2xsU2Vuc2l0aXZpdHkgfTtcblx0XHRcdH1cblx0XHRcdGlmIChPYmplY3Qua2V5cyhvcHRpb25zKS5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlT3B0aW9ucyhvcHRpb25zKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLm5hdmlnYXRvciA9IG5ldyBMaXN0UmVzb3VyY2VOYXZpZ2F0b3IodGhpcywgeyBjb25maWd1cmF0aW9uU2VydmljZSwgLi4ub3B0aW9ucyB9KTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLm5hdmlnYXRvcik7XG5cdH1cblxuXHRvdmVycmlkZSB1cGRhdGVPcHRpb25zKG9wdGlvbnM6IElXb3JrYmVuY2hMaXN0T3B0aW9uc1VwZGF0ZSk6IHZvaWQge1xuXHRcdHN1cGVyLnVwZGF0ZU9wdGlvbnMob3B0aW9ucyk7XG5cblx0XHRpZiAob3B0aW9ucy5vdmVycmlkZVN0eWxlcyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVN0eWxlcyhvcHRpb25zLm92ZXJyaWRlU3R5bGVzKTtcblx0XHR9XG5cblx0XHRpZiAob3B0aW9ucy5tdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5saXN0U3VwcG9ydHNNdWx0aVNlbGVjdC5zZXQoISFvcHRpb25zLm11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVTdHlsZXMoc3R5bGVzOiBJU3R5bGVPdmVycmlkZTxJTGlzdFN0eWxlcz4gfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLnN0eWxlKHN0eWxlcyA/IGdldExpc3RTdHlsZXMoc3R5bGVzKSA6IGRlZmF1bHRMaXN0U3R5bGVzKTtcblx0fVxuXG5cdGdldCB1c2VBbHRBc011bHRpcGxlU2VsZWN0aW9uTW9kaWZpZXIoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3VzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllcjtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdvcmtiZW5jaFRhYmxlT3B0aW9uc1VwZGF0ZSBleHRlbmRzIElUYWJsZU9wdGlvbnNVcGRhdGUge1xuXHRyZWFkb25seSBvdmVycmlkZVN0eWxlcz86IElTdHlsZU92ZXJyaWRlPElMaXN0U3R5bGVzPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJV29ya2JlbmNoVGFibGVPcHRpb25zPFQ+IGV4dGVuZHMgSVdvcmtiZW5jaFRhYmxlT3B0aW9uc1VwZGF0ZSwgSVJlc291cmNlTmF2aWdhdG9yT3B0aW9ucywgSVRhYmxlT3B0aW9uczxUPiB7XG5cdHJlYWRvbmx5IHNlbGVjdGlvbk5hdmlnYXRpb24/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY2xhc3MgV29ya2JlbmNoVGFibGU8VFJvdz4gZXh0ZW5kcyBUYWJsZTxUUm93PiB7XG5cblx0cmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElTY29wZWRDb250ZXh0S2V5U2VydmljZTtcblx0cHJpdmF0ZSBsaXN0U3VwcG9ydHNNdWx0aVNlbGVjdDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgbGlzdEhhc1NlbGVjdGlvbk9yRm9jdXM6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGxpc3REb3VibGVTZWxlY3Rpb246IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGxpc3RNdWx0aVNlbGVjdGlvbjogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgaG9yaXpvbnRhbFNjcm9sbGluZzogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfdXNlQWx0QXNNdWx0aXBsZVNlbGVjdGlvbk1vZGlmaWVyOiBib29sZWFuO1xuXHRwcml2YXRlIG5hdmlnYXRvcjogVGFibGVSZXNvdXJjZU5hdmlnYXRvcjxUUm93Pjtcblx0Z2V0IG9uRGlkT3BlbigpOiBFdmVudDxJT3BlbkV2ZW50PFRSb3cgfCB1bmRlZmluZWQ+PiB7IHJldHVybiB0aGlzLm5hdmlnYXRvci5vbkRpZE9wZW47IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHR1c2VyOiBzdHJpbmcsXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRkZWxlZ2F0ZTogSVRhYmxlVmlydHVhbERlbGVnYXRlPFRSb3c+LFxuXHRcdGNvbHVtbnM6IElUYWJsZUNvbHVtbjxUUm93LCBhbnk+W10sXG5cdFx0cmVuZGVyZXJzOiBJVGFibGVSZW5kZXJlcjxUUm93LCBhbnk+W10sXG5cdFx0b3B0aW9uczogSVdvcmtiZW5jaFRhYmxlT3B0aW9uczxUUm93Pixcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElMaXN0U2VydmljZSBsaXN0U2VydmljZTogSUxpc3RTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0Y29uc3QgaG9yaXpvbnRhbFNjcm9sbGluZyA9IHR5cGVvZiBvcHRpb25zLmhvcml6b250YWxTY3JvbGxpbmcgIT09ICd1bmRlZmluZWQnID8gb3B0aW9ucy5ob3Jpem9udGFsU2Nyb2xsaW5nIDogQm9vbGVhbihjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShob3Jpem9udGFsU2Nyb2xsaW5nS2V5KSk7XG5cdFx0Y29uc3QgW3dvcmtiZW5jaExpc3RPcHRpb25zLCB3b3JrYmVuY2hMaXN0T3B0aW9uc0Rpc3Bvc2FibGVdID0gaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24odG9Xb3JrYmVuY2hMaXN0T3B0aW9ucywgb3B0aW9ucyk7XG5cblx0XHRzdXBlcih1c2VyLCBjb250YWluZXIsIGRlbGVnYXRlLCBjb2x1bW5zLCByZW5kZXJlcnMsXG5cdFx0XHR7XG5cdFx0XHRcdGtleWJvYXJkU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRcdC4uLndvcmtiZW5jaExpc3RPcHRpb25zLFxuXHRcdFx0XHRob3Jpem9udGFsU2Nyb2xsaW5nLFxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh3b3JrYmVuY2hMaXN0T3B0aW9uc0Rpc3Bvc2FibGUpO1xuXG5cdFx0dGhpcy5jb250ZXh0S2V5U2VydmljZSA9IGNyZWF0ZVNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKGNvbnRleHRLZXlTZXJ2aWNlLCB0aGlzKTtcblxuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZVNjcm9sbE9ic2VydmVyKHRoaXMuY29udGV4dEtleVNlcnZpY2UsIHRoaXMpKTtcblxuXHRcdHRoaXMubGlzdFN1cHBvcnRzTXVsdGlTZWxlY3QgPSBXb3JrYmVuY2hMaXN0U3VwcG9ydHNNdWx0aVNlbGVjdENvbnRleHRLZXkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMubGlzdFN1cHBvcnRzTXVsdGlTZWxlY3Quc2V0KG9wdGlvbnMubXVsdGlwbGVTZWxlY3Rpb25TdXBwb3J0ICE9PSBmYWxzZSk7XG5cblx0XHRjb25zdCBsaXN0U2VsZWN0aW9uTmF2aWdhdGlvbiA9IFdvcmtiZW5jaExpc3RTZWxlY3Rpb25OYXZpZ2F0aW9uLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRsaXN0U2VsZWN0aW9uTmF2aWdhdGlvbi5zZXQoQm9vbGVhbihvcHRpb25zLnNlbGVjdGlvbk5hdmlnYXRpb24pKTtcblxuXHRcdHRoaXMubGlzdEhhc1NlbGVjdGlvbk9yRm9jdXMgPSBXb3JrYmVuY2hMaXN0SGFzU2VsZWN0aW9uT3JGb2N1cy5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5saXN0RG91YmxlU2VsZWN0aW9uID0gV29ya2JlbmNoTGlzdERvdWJsZVNlbGVjdGlvbi5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5saXN0TXVsdGlTZWxlY3Rpb24gPSBXb3JrYmVuY2hMaXN0TXVsdGlTZWxlY3Rpb24uYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuaG9yaXpvbnRhbFNjcm9sbGluZyA9IG9wdGlvbnMuaG9yaXpvbnRhbFNjcm9sbGluZztcblxuXHRcdHRoaXMuX3VzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllciA9IHVzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllcihjb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCgobGlzdFNlcnZpY2UgYXMgTGlzdFNlcnZpY2UpLnJlZ2lzdGVyKHRoaXMpKTtcblxuXHRcdHRoaXMudXBkYXRlU3R5bGVzKG9wdGlvbnMub3ZlcnJpZGVTdHlsZXMpO1xuXG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5vbkRpZENoYW5nZVNlbGVjdGlvbigoKSA9PiB7XG5cdFx0XHRjb25zdCBzZWxlY3Rpb24gPSB0aGlzLmdldFNlbGVjdGlvbigpO1xuXHRcdFx0Y29uc3QgZm9jdXMgPSB0aGlzLmdldEZvY3VzKCk7XG5cblx0XHRcdHRoaXMuY29udGV4dEtleVNlcnZpY2UuYnVmZmVyQ2hhbmdlRXZlbnRzKCgpID0+IHtcblx0XHRcdFx0dGhpcy5saXN0SGFzU2VsZWN0aW9uT3JGb2N1cy5zZXQoc2VsZWN0aW9uLmxlbmd0aCA+IDAgfHwgZm9jdXMubGVuZ3RoID4gMCk7XG5cdFx0XHRcdHRoaXMubGlzdE11bHRpU2VsZWN0aW9uLnNldChzZWxlY3Rpb24ubGVuZ3RoID4gMSk7XG5cdFx0XHRcdHRoaXMubGlzdERvdWJsZVNlbGVjdGlvbi5zZXQoc2VsZWN0aW9uLmxlbmd0aCA9PT0gMik7XG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5vbkRpZENoYW5nZUZvY3VzKCgpID0+IHtcblx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRjb25zdCBmb2N1cyA9IHRoaXMuZ2V0Rm9jdXMoKTtcblxuXHRcdFx0dGhpcy5saXN0SGFzU2VsZWN0aW9uT3JGb2N1cy5zZXQoc2VsZWN0aW9uLmxlbmd0aCA+IDAgfHwgZm9jdXMubGVuZ3RoID4gMCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKG11bHRpU2VsZWN0TW9kaWZpZXJTZXR0aW5nS2V5KSkge1xuXHRcdFx0XHR0aGlzLl91c2VBbHRBc011bHRpcGxlU2VsZWN0aW9uTW9kaWZpZXIgPSB1c2VBbHRBc011bHRpcGxlU2VsZWN0aW9uTW9kaWZpZXIoY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgb3B0aW9uczogSUxpc3RPcHRpb25zVXBkYXRlID0ge307XG5cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKGhvcml6b250YWxTY3JvbGxpbmdLZXkpICYmIHRoaXMuaG9yaXpvbnRhbFNjcm9sbGluZyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGNvbnN0IGhvcml6b250YWxTY3JvbGxpbmcgPSBCb29sZWFuKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKGhvcml6b250YWxTY3JvbGxpbmdLZXkpKTtcblx0XHRcdFx0b3B0aW9ucyA9IHsgLi4ub3B0aW9ucywgaG9yaXpvbnRhbFNjcm9sbGluZyB9O1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oc2Nyb2xsQnlQYWdlS2V5KSkge1xuXHRcdFx0XHRjb25zdCBzY3JvbGxCeVBhZ2UgPSBCb29sZWFuKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKHNjcm9sbEJ5UGFnZUtleSkpO1xuXHRcdFx0XHRvcHRpb25zID0geyAuLi5vcHRpb25zLCBzY3JvbGxCeVBhZ2UgfTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKGxpc3RTbW9vdGhTY3JvbGxpbmcpKSB7XG5cdFx0XHRcdGNvbnN0IHNtb290aFNjcm9sbGluZyA9IEJvb2xlYW4oY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUobGlzdFNtb290aFNjcm9sbGluZykpO1xuXHRcdFx0XHRvcHRpb25zID0geyAuLi5vcHRpb25zLCBzbW9vdGhTY3JvbGxpbmcgfTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKG1vdXNlV2hlZWxTY3JvbGxTZW5zaXRpdml0eUtleSkpIHtcblx0XHRcdFx0Y29uc3QgbW91c2VXaGVlbFNjcm9sbFNlbnNpdGl2aXR5ID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPihtb3VzZVdoZWVsU2Nyb2xsU2Vuc2l0aXZpdHlLZXkpO1xuXHRcdFx0XHRvcHRpb25zID0geyAuLi5vcHRpb25zLCBtb3VzZVdoZWVsU2Nyb2xsU2Vuc2l0aXZpdHkgfTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKGZhc3RTY3JvbGxTZW5zaXRpdml0eUtleSkpIHtcblx0XHRcdFx0Y29uc3QgZmFzdFNjcm9sbFNlbnNpdGl2aXR5ID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPihmYXN0U2Nyb2xsU2Vuc2l0aXZpdHlLZXkpO1xuXHRcdFx0XHRvcHRpb25zID0geyAuLi5vcHRpb25zLCBmYXN0U2Nyb2xsU2Vuc2l0aXZpdHkgfTtcblx0XHRcdH1cblx0XHRcdGlmIChPYmplY3Qua2V5cyhvcHRpb25zKS5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlT3B0aW9ucyhvcHRpb25zKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLm5hdmlnYXRvciA9IG5ldyBUYWJsZVJlc291cmNlTmF2aWdhdG9yKHRoaXMsIHsgY29uZmlndXJhdGlvblNlcnZpY2UsIC4uLm9wdGlvbnMgfSk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5uYXZpZ2F0b3IpO1xuXHR9XG5cblx0b3ZlcnJpZGUgdXBkYXRlT3B0aW9ucyhvcHRpb25zOiBJV29ya2JlbmNoVGFibGVPcHRpb25zVXBkYXRlKTogdm9pZCB7XG5cdFx0c3VwZXIudXBkYXRlT3B0aW9ucyhvcHRpb25zKTtcblxuXHRcdGlmIChvcHRpb25zLm92ZXJyaWRlU3R5bGVzICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMudXBkYXRlU3R5bGVzKG9wdGlvbnMub3ZlcnJpZGVTdHlsZXMpO1xuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zLm11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLmxpc3RTdXBwb3J0c011bHRpU2VsZWN0LnNldCghIW9wdGlvbnMubXVsdGlwbGVTZWxlY3Rpb25TdXBwb3J0KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVN0eWxlcyhzdHlsZXM6IElTdHlsZU92ZXJyaWRlPElUYWJsZVN0eWxlcz4gfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLnN0eWxlKHN0eWxlcyA/IGdldExpc3RTdHlsZXMoc3R5bGVzKSA6IGRlZmF1bHRMaXN0U3R5bGVzKTtcblx0fVxuXG5cdGdldCB1c2VBbHRBc011bHRpcGxlU2VsZWN0aW9uTW9kaWZpZXIoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3VzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllcjtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU9wZW5SZXNvdXJjZU9wdGlvbnMge1xuXHRlZGl0b3JPcHRpb25zOiBJRWRpdG9yT3B0aW9ucztcblx0c2lkZUJ5U2lkZTogYm9vbGVhbjtcblx0ZWxlbWVudDogYW55O1xuXHRwYXlsb2FkOiBhbnk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU9wZW5FdmVudDxUPiB7XG5cdGVkaXRvck9wdGlvbnM6IElFZGl0b3JPcHRpb25zO1xuXHRzaWRlQnlTaWRlOiBib29sZWFuO1xuXHRlbGVtZW50OiBUO1xuXHRicm93c2VyRXZlbnQ/OiBVSUV2ZW50O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElSZXNvdXJjZU5hdmlnYXRvck9wdGlvbnMge1xuXHRyZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZT86IElDb25maWd1cmF0aW9uU2VydmljZTtcblx0cmVhZG9ubHkgb3Blbk9uU2luZ2xlQ2xpY2s/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFNlbGVjdGlvbktleWJvYXJkRXZlbnQgZXh0ZW5kcyBLZXlib2FyZEV2ZW50IHtcblx0cHJlc2VydmVGb2N1cz86IGJvb2xlYW47XG5cdHBpbm5lZD86IGJvb2xlYW47XG5cdF9fZm9yY2VFdmVudD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTZWxlY3Rpb25LZXlib2FyZEV2ZW50KHR5cGVBcmcgPSAna2V5ZG93bicsIHByZXNlcnZlRm9jdXM/OiBib29sZWFuLCBwaW5uZWQ/OiBib29sZWFuKTogU2VsZWN0aW9uS2V5Ym9hcmRFdmVudCB7XG5cdGNvbnN0IGUgPSBuZXcgS2V5Ym9hcmRFdmVudCh0eXBlQXJnKTtcblx0KDxTZWxlY3Rpb25LZXlib2FyZEV2ZW50PmUpLnByZXNlcnZlRm9jdXMgPSBwcmVzZXJ2ZUZvY3VzO1xuXHQoPFNlbGVjdGlvbktleWJvYXJkRXZlbnQ+ZSkucGlubmVkID0gcGlubmVkO1xuXHQoPFNlbGVjdGlvbktleWJvYXJkRXZlbnQ+ZSkuX19mb3JjZUV2ZW50ID0gdHJ1ZTtcblxuXHRyZXR1cm4gZTtcbn1cblxuYWJzdHJhY3QgY2xhc3MgUmVzb3VyY2VOYXZpZ2F0b3I8VD4gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIG9wZW5PblNpbmdsZUNsaWNrOiBib29sZWFuO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkT3BlbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElPcGVuRXZlbnQ8VCB8IHVuZGVmaW5lZD4+KCkpO1xuXHRyZWFkb25seSBvbkRpZE9wZW46IEV2ZW50PElPcGVuRXZlbnQ8VCB8IHVuZGVmaW5lZD4+ID0gdGhpcy5fb25EaWRPcGVuLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByb3RlY3RlZCByZWFkb25seSB3aWRnZXQ6IExpc3RXaWRnZXQsXG5cdFx0b3B0aW9ucz86IElSZXNvdXJjZU5hdmlnYXRvck9wdGlvbnNcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmZpbHRlcih0aGlzLndpZGdldC5vbkRpZENoYW5nZVNlbGVjdGlvbiwgZSA9PiBpc0tleWJvYXJkRXZlbnQoZS5icm93c2VyRXZlbnQpKShlID0+IHRoaXMub25TZWxlY3Rpb25Gcm9tS2V5Ym9hcmQoZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndpZGdldC5vblBvaW50ZXIoKGU6IHsgYnJvd3NlckV2ZW50OiBNb3VzZUV2ZW50OyBlbGVtZW50OiBUIHwgdW5kZWZpbmVkIH0pID0+IHRoaXMub25Qb2ludGVyKGUuZWxlbWVudCwgZS5icm93c2VyRXZlbnQpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53aWRnZXQub25Nb3VzZURibENsaWNrKChlOiB7IGJyb3dzZXJFdmVudDogTW91c2VFdmVudDsgZWxlbWVudDogVCB8IHVuZGVmaW5lZCB9KSA9PiB0aGlzLm9uTW91c2VEYmxDbGljayhlLmVsZW1lbnQsIGUuYnJvd3NlckV2ZW50KSkpO1xuXG5cdFx0aWYgKHR5cGVvZiBvcHRpb25zPy5vcGVuT25TaW5nbGVDbGljayAhPT0gJ2Jvb2xlYW4nICYmIG9wdGlvbnM/LmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSB7XG5cdFx0XHR0aGlzLm9wZW5PblNpbmdsZUNsaWNrID0gb3B0aW9ucz8uY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUob3Blbk1vZGVTZXR0aW5nS2V5KSAhPT0gJ2RvdWJsZUNsaWNrJztcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKG9wdGlvbnM/LmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24ob3Blbk1vZGVTZXR0aW5nS2V5KSkge1xuXHRcdFx0XHRcdHRoaXMub3Blbk9uU2luZ2xlQ2xpY2sgPSBvcHRpb25zPy5jb25maWd1cmF0aW9uU2VydmljZSEuZ2V0VmFsdWUob3Blbk1vZGVTZXR0aW5nS2V5KSAhPT0gJ2RvdWJsZUNsaWNrJztcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm9wZW5PblNpbmdsZUNsaWNrID0gb3B0aW9ucz8ub3Blbk9uU2luZ2xlQ2xpY2sgPz8gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uU2VsZWN0aW9uRnJvbUtleWJvYXJkKGV2ZW50OiBJVHJlZUV2ZW50PGFueT4pOiB2b2lkIHtcblx0XHRpZiAoZXZlbnQuZWxlbWVudHMubGVuZ3RoICE9PSAxKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VsZWN0aW9uS2V5Ym9hcmRFdmVudCA9IGV2ZW50LmJyb3dzZXJFdmVudCBhcyBTZWxlY3Rpb25LZXlib2FyZEV2ZW50O1xuXHRcdGNvbnN0IHByZXNlcnZlRm9jdXMgPSB0eXBlb2Ygc2VsZWN0aW9uS2V5Ym9hcmRFdmVudC5wcmVzZXJ2ZUZvY3VzID09PSAnYm9vbGVhbicgPyBzZWxlY3Rpb25LZXlib2FyZEV2ZW50LnByZXNlcnZlRm9jdXMgOiB0cnVlO1xuXHRcdGNvbnN0IHBpbm5lZCA9IHR5cGVvZiBzZWxlY3Rpb25LZXlib2FyZEV2ZW50LnBpbm5lZCA9PT0gJ2Jvb2xlYW4nID8gc2VsZWN0aW9uS2V5Ym9hcmRFdmVudC5waW5uZWQgOiAhcHJlc2VydmVGb2N1cztcblx0XHRjb25zdCBzaWRlQnlTaWRlID0gZmFsc2U7XG5cblx0XHR0aGlzLl9vcGVuKHRoaXMuZ2V0U2VsZWN0ZWRFbGVtZW50KCksIHByZXNlcnZlRm9jdXMsIHBpbm5lZCwgc2lkZUJ5U2lkZSwgZXZlbnQuYnJvd3NlckV2ZW50KTtcblx0fVxuXG5cdHByaXZhdGUgb25Qb2ludGVyKGVsZW1lbnQ6IFQgfCB1bmRlZmluZWQsIGJyb3dzZXJFdmVudDogTW91c2VFdmVudCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5vcGVuT25TaW5nbGVDbGljaykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlzRG91YmxlQ2xpY2sgPSBicm93c2VyRXZlbnQuZGV0YWlsID09PSAyO1xuXG5cdFx0aWYgKGlzRG91YmxlQ2xpY2spIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBpc01pZGRsZUNsaWNrID0gYnJvd3NlckV2ZW50LmJ1dHRvbiA9PT0gMTtcblx0XHRjb25zdCBwcmVzZXJ2ZUZvY3VzID0gdHJ1ZTtcblx0XHRjb25zdCBwaW5uZWQgPSBpc01pZGRsZUNsaWNrO1xuXHRcdGNvbnN0IHNpZGVCeVNpZGUgPSBicm93c2VyRXZlbnQuY3RybEtleSB8fCBicm93c2VyRXZlbnQubWV0YUtleSB8fCBicm93c2VyRXZlbnQuYWx0S2V5O1xuXG5cdFx0dGhpcy5fb3BlbihlbGVtZW50LCBwcmVzZXJ2ZUZvY3VzLCBwaW5uZWQsIHNpZGVCeVNpZGUsIGJyb3dzZXJFdmVudCk7XG5cdH1cblxuXHRwcml2YXRlIG9uTW91c2VEYmxDbGljayhlbGVtZW50OiBUIHwgdW5kZWZpbmVkLCBicm93c2VyRXZlbnQ/OiBNb3VzZUV2ZW50KTogdm9pZCB7XG5cdFx0aWYgKCFicm93c2VyRXZlbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBjb3BpZWQgZnJvbSBBYnN0cmFjdFRyZWVcblx0XHRjb25zdCB0YXJnZXQgPSBicm93c2VyRXZlbnQudGFyZ2V0IGFzIEhUTUxFbGVtZW50O1xuXHRcdGNvbnN0IG9uVHdpc3RpZSA9IHRhcmdldC5jbGFzc0xpc3QuY29udGFpbnMoJ21vbmFjby10bC10d2lzdGllJylcblx0XHRcdHx8ICh0YXJnZXQuY2xhc3NMaXN0LmNvbnRhaW5zKCdtb25hY28taWNvbi1sYWJlbCcpICYmIHRhcmdldC5jbGFzc0xpc3QuY29udGFpbnMoJ2ZvbGRlci1pY29uJykgJiYgYnJvd3NlckV2ZW50Lm9mZnNldFggPCAxNik7XG5cblx0XHRpZiAob25Ud2lzdGllKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJlc2VydmVGb2N1cyA9IGZhbHNlO1xuXHRcdGNvbnN0IHBpbm5lZCA9IHRydWU7XG5cdFx0Y29uc3Qgc2lkZUJ5U2lkZSA9IChicm93c2VyRXZlbnQuY3RybEtleSB8fCBicm93c2VyRXZlbnQubWV0YUtleSB8fCBicm93c2VyRXZlbnQuYWx0S2V5KTtcblxuXHRcdHRoaXMuX29wZW4oZWxlbWVudCwgcHJlc2VydmVGb2N1cywgcGlubmVkLCBzaWRlQnlTaWRlLCBicm93c2VyRXZlbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfb3BlbihlbGVtZW50OiBUIHwgdW5kZWZpbmVkLCBwcmVzZXJ2ZUZvY3VzOiBib29sZWFuLCBwaW5uZWQ6IGJvb2xlYW4sIHNpZGVCeVNpZGU6IGJvb2xlYW4sIGJyb3dzZXJFdmVudD86IFVJRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoIWVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9vbkRpZE9wZW4uZmlyZSh7XG5cdFx0XHRlZGl0b3JPcHRpb25zOiB7XG5cdFx0XHRcdHByZXNlcnZlRm9jdXMsXG5cdFx0XHRcdHBpbm5lZCxcblx0XHRcdFx0cmV2ZWFsSWZWaXNpYmxlOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0c2lkZUJ5U2lkZSxcblx0XHRcdGVsZW1lbnQsXG5cdFx0XHRicm93c2VyRXZlbnRcblx0XHR9KTtcblx0fVxuXG5cdGFic3RyYWN0IGdldFNlbGVjdGVkRWxlbWVudCgpOiBUIHwgdW5kZWZpbmVkO1xufVxuXG5jbGFzcyBMaXN0UmVzb3VyY2VOYXZpZ2F0b3I8VD4gZXh0ZW5kcyBSZXNvdXJjZU5hdmlnYXRvcjxUPiB7XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlYWRvbmx5IHdpZGdldDogTGlzdDxUPiB8IFBhZ2VkTGlzdDxUPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHR3aWRnZXQ6IExpc3Q8VD4gfCBQYWdlZExpc3Q8VD4sXG5cdFx0b3B0aW9uczogSVJlc291cmNlTmF2aWdhdG9yT3B0aW9uc1xuXHQpIHtcblx0XHRzdXBlcih3aWRnZXQsIG9wdGlvbnMpO1xuXHRcdHRoaXMud2lkZ2V0ID0gd2lkZ2V0O1xuXHR9XG5cblx0Z2V0U2VsZWN0ZWRFbGVtZW50KCk6IFQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLndpZGdldC5nZXRTZWxlY3RlZEVsZW1lbnRzKClbMF07XG5cdH1cbn1cblxuY2xhc3MgVGFibGVSZXNvdXJjZU5hdmlnYXRvcjxUUm93PiBleHRlbmRzIFJlc291cmNlTmF2aWdhdG9yPFRSb3c+IHtcblxuXHRwcm90ZWN0ZWQgZGVjbGFyZSByZWFkb25seSB3aWRnZXQ6IFRhYmxlPFRSb3c+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHdpZGdldDogVGFibGU8VFJvdz4sXG5cdFx0b3B0aW9uczogSVJlc291cmNlTmF2aWdhdG9yT3B0aW9uc1xuXHQpIHtcblx0XHRzdXBlcih3aWRnZXQsIG9wdGlvbnMpO1xuXHR9XG5cblx0Z2V0U2VsZWN0ZWRFbGVtZW50KCk6IFRSb3cgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLndpZGdldC5nZXRTZWxlY3RlZEVsZW1lbnRzKClbMF07XG5cdH1cbn1cblxuY2xhc3MgVHJlZVJlc291cmNlTmF2aWdhdG9yPFQsIFRGaWx0ZXJEYXRhPiBleHRlbmRzIFJlc291cmNlTmF2aWdhdG9yPFQ+IHtcblxuXHRwcm90ZWN0ZWQgZGVjbGFyZSByZWFkb25seSB3aWRnZXQ6IE9iamVjdFRyZWU8VCwgVEZpbHRlckRhdGE+IHwgQ29tcHJlc3NpYmxlT2JqZWN0VHJlZTxULCBURmlsdGVyRGF0YT4gfCBEYXRhVHJlZTxhbnksIFQsIFRGaWx0ZXJEYXRhPiB8IEFzeW5jRGF0YVRyZWU8YW55LCBULCBURmlsdGVyRGF0YT4gfCBDb21wcmVzc2libGVBc3luY0RhdGFUcmVlPGFueSwgVCwgVEZpbHRlckRhdGE+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHdpZGdldDogT2JqZWN0VHJlZTxULCBURmlsdGVyRGF0YT4gfCBDb21wcmVzc2libGVPYmplY3RUcmVlPFQsIFRGaWx0ZXJEYXRhPiB8IERhdGFUcmVlPGFueSwgVCwgVEZpbHRlckRhdGE+IHwgQXN5bmNEYXRhVHJlZTxhbnksIFQsIFRGaWx0ZXJEYXRhPiB8IENvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWU8YW55LCBULCBURmlsdGVyRGF0YT4sXG5cdFx0b3B0aW9uczogSVJlc291cmNlTmF2aWdhdG9yT3B0aW9uc1xuXHQpIHtcblx0XHRzdXBlcih3aWRnZXQsIG9wdGlvbnMpO1xuXHR9XG5cblx0Z2V0U2VsZWN0ZWRFbGVtZW50KCk6IFQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLndpZGdldC5nZXRTZWxlY3Rpb24oKVswXSA/PyB1bmRlZmluZWQ7XG5cdH1cbn1cblxuZnVuY3Rpb24gY3JlYXRlS2V5Ym9hcmROYXZpZ2F0aW9uRXZlbnRGaWx0ZXIoa2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSk6IElLZXlib2FyZE5hdmlnYXRpb25FdmVudEZpbHRlciB7XG5cdGxldCBpbk11bHRpQ2hvcmQgPSBmYWxzZTtcblxuXHRyZXR1cm4gZXZlbnQgPT4ge1xuXHRcdGlmIChldmVudC50b0tleUNvZGVDaG9yZCgpLmlzTW9kaWZpZXJLZXkoKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmIChpbk11bHRpQ2hvcmQpIHtcblx0XHRcdGluTXVsdGlDaG9yZCA9IGZhbHNlO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdCA9IGtleWJpbmRpbmdTZXJ2aWNlLnNvZnREaXNwYXRjaChldmVudCwgZXZlbnQudGFyZ2V0KTtcblxuXHRcdGlmIChyZXN1bHQua2luZCA9PT0gUmVzdWx0S2luZC5Nb3JlQ2hvcmRzTmVlZGVkKSB7XG5cdFx0XHRpbk11bHRpQ2hvcmQgPSB0cnVlO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGluTXVsdGlDaG9yZCA9IGZhbHNlO1xuXHRcdHJldHVybiByZXN1bHQua2luZCA9PT0gUmVzdWx0S2luZC5Ob01hdGNoaW5nS2I7XG5cdH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdvcmtiZW5jaE9iamVjdFRyZWVPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPiBleHRlbmRzIElPYmplY3RUcmVlT3B0aW9uczxULCBURmlsdGVyRGF0YT4sIElSZXNvdXJjZU5hdmlnYXRvck9wdGlvbnMge1xuXHRyZWFkb25seSBhY2Nlc3NpYmlsaXR5UHJvdmlkZXI6IElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyPFQ+O1xuXHRyZWFkb25seSBvdmVycmlkZVN0eWxlcz86IElTdHlsZU92ZXJyaWRlPElMaXN0U3R5bGVzPjtcblx0cmVhZG9ubHkgc2VsZWN0aW9uTmF2aWdhdGlvbj86IGJvb2xlYW47XG5cdHJlYWRvbmx5IHNjcm9sbFRvQWN0aXZlRWxlbWVudD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBXb3JrYmVuY2hPYmplY3RUcmVlPFQgZXh0ZW5kcyBOb25OdWxsYWJsZTxhbnk+LCBURmlsdGVyRGF0YSA9IHZvaWQ+IGV4dGVuZHMgT2JqZWN0VHJlZTxULCBURmlsdGVyRGF0YT4ge1xuXG5cdHByaXZhdGUgaW50ZXJuYWxzOiBXb3JrYmVuY2hUcmVlSW50ZXJuYWxzPGFueSwgVCwgVEZpbHRlckRhdGE+O1xuXHRnZXQgY29udGV4dEtleVNlcnZpY2UoKTogSUNvbnRleHRLZXlTZXJ2aWNlIHsgcmV0dXJuIHRoaXMuaW50ZXJuYWxzLmNvbnRleHRLZXlTZXJ2aWNlOyB9XG5cdGdldCB1c2VBbHRBc011bHRpcGxlU2VsZWN0aW9uTW9kaWZpZXIoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLmludGVybmFscy51c2VBbHRBc011bHRpcGxlU2VsZWN0aW9uTW9kaWZpZXI7IH1cblx0Z2V0IG9uRGlkT3BlbigpOiBFdmVudDxJT3BlbkV2ZW50PFQgfCB1bmRlZmluZWQ+PiB7IHJldHVybiB0aGlzLmludGVybmFscy5vbkRpZE9wZW47IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHR1c2VyOiBzdHJpbmcsXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRkZWxlZ2F0ZTogSUxpc3RWaXJ0dWFsRGVsZWdhdGU8VD4sXG5cdFx0cmVuZGVyZXJzOiBJVHJlZVJlbmRlcmVyPFQsIFRGaWx0ZXJEYXRhLCBhbnk+W10sXG5cdFx0b3B0aW9uczogSVdvcmtiZW5jaE9iamVjdFRyZWVPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJTGlzdFNlcnZpY2UgbGlzdFNlcnZpY2U6IElMaXN0U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0Y29uc3QgeyBvcHRpb25zOiB0cmVlT3B0aW9ucywgZ2V0VHlwZU5hdmlnYXRpb25Nb2RlLCBkaXNwb3NhYmxlIH0gPSBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbih3b3JrYmVuY2hUcmVlRGF0YVByZWFtYmxlLCBvcHRpb25zIGFzIGFueSk7XG5cdFx0c3VwZXIodXNlciwgY29udGFpbmVyLCBkZWxlZ2F0ZSwgcmVuZGVyZXJzLCB0cmVlT3B0aW9ucyk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQoZGlzcG9zYWJsZSk7XG5cdFx0dGhpcy5pbnRlcm5hbHMgPSBuZXcgV29ya2JlbmNoVHJlZUludGVybmFscyh0aGlzLCBvcHRpb25zLCBnZXRUeXBlTmF2aWdhdGlvbk1vZGUsIG9wdGlvbnMub3ZlcnJpZGVTdHlsZXMsIGNvbnRleHRLZXlTZXJ2aWNlLCBsaXN0U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuaW50ZXJuYWxzKTtcblx0fVxuXG5cdG92ZXJyaWRlIHVwZGF0ZU9wdGlvbnMob3B0aW9uczogSUFic3RyYWN0VHJlZU9wdGlvbnNVcGRhdGUpOiB2b2lkIHtcblx0XHRzdXBlci51cGRhdGVPcHRpb25zKG9wdGlvbnMpO1xuXHRcdHRoaXMuaW50ZXJuYWxzLnVwZGF0ZU9wdGlvbnMob3B0aW9ucyk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJV29ya2JlbmNoQ29tcHJlc3NpYmxlT2JqZWN0VHJlZU9wdGlvbnNVcGRhdGUgZXh0ZW5kcyBJQ29tcHJlc3NpYmxlT2JqZWN0VHJlZU9wdGlvbnNVcGRhdGUge1xuXHRyZWFkb25seSBvdmVycmlkZVN0eWxlcz86IElTdHlsZU92ZXJyaWRlPElMaXN0U3R5bGVzPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJV29ya2JlbmNoQ29tcHJlc3NpYmxlT2JqZWN0VHJlZU9wdGlvbnM8VCwgVEZpbHRlckRhdGE+IGV4dGVuZHMgSVdvcmtiZW5jaENvbXByZXNzaWJsZU9iamVjdFRyZWVPcHRpb25zVXBkYXRlLCBJQ29tcHJlc3NpYmxlT2JqZWN0VHJlZU9wdGlvbnM8VCwgVEZpbHRlckRhdGE+LCBJUmVzb3VyY2VOYXZpZ2F0b3JPcHRpb25zIHtcblx0cmVhZG9ubHkgYWNjZXNzaWJpbGl0eVByb3ZpZGVyOiBJTGlzdEFjY2Vzc2liaWxpdHlQcm92aWRlcjxUPjtcblx0cmVhZG9ubHkgc2VsZWN0aW9uTmF2aWdhdGlvbj86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBXb3JrYmVuY2hDb21wcmVzc2libGVPYmplY3RUcmVlPFQgZXh0ZW5kcyBOb25OdWxsYWJsZTxhbnk+LCBURmlsdGVyRGF0YSA9IHZvaWQ+IGV4dGVuZHMgQ29tcHJlc3NpYmxlT2JqZWN0VHJlZTxULCBURmlsdGVyRGF0YT4ge1xuXG5cdHByaXZhdGUgaW50ZXJuYWxzOiBXb3JrYmVuY2hUcmVlSW50ZXJuYWxzPGFueSwgVCwgVEZpbHRlckRhdGE+O1xuXHRnZXQgY29udGV4dEtleVNlcnZpY2UoKTogSUNvbnRleHRLZXlTZXJ2aWNlIHsgcmV0dXJuIHRoaXMuaW50ZXJuYWxzLmNvbnRleHRLZXlTZXJ2aWNlOyB9XG5cdGdldCB1c2VBbHRBc011bHRpcGxlU2VsZWN0aW9uTW9kaWZpZXIoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLmludGVybmFscy51c2VBbHRBc011bHRpcGxlU2VsZWN0aW9uTW9kaWZpZXI7IH1cblx0Z2V0IG9uRGlkT3BlbigpOiBFdmVudDxJT3BlbkV2ZW50PFQgfCB1bmRlZmluZWQ+PiB7IHJldHVybiB0aGlzLmludGVybmFscy5vbkRpZE9wZW47IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHR1c2VyOiBzdHJpbmcsXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRkZWxlZ2F0ZTogSUxpc3RWaXJ0dWFsRGVsZWdhdGU8VD4sXG5cdFx0cmVuZGVyZXJzOiBJQ29tcHJlc3NpYmxlVHJlZVJlbmRlcmVyPFQsIFRGaWx0ZXJEYXRhLCBhbnk+W10sXG5cdFx0b3B0aW9uczogSVdvcmtiZW5jaENvbXByZXNzaWJsZU9iamVjdFRyZWVPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJTGlzdFNlcnZpY2UgbGlzdFNlcnZpY2U6IElMaXN0U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0Y29uc3QgeyBvcHRpb25zOiB0cmVlT3B0aW9ucywgZ2V0VHlwZU5hdmlnYXRpb25Nb2RlLCBkaXNwb3NhYmxlIH0gPSBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbih3b3JrYmVuY2hUcmVlRGF0YVByZWFtYmxlLCBvcHRpb25zIGFzIGFueSk7XG5cdFx0c3VwZXIodXNlciwgY29udGFpbmVyLCBkZWxlZ2F0ZSwgcmVuZGVyZXJzLCB0cmVlT3B0aW9ucyk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQoZGlzcG9zYWJsZSk7XG5cdFx0dGhpcy5pbnRlcm5hbHMgPSBuZXcgV29ya2JlbmNoVHJlZUludGVybmFscyh0aGlzLCBvcHRpb25zLCBnZXRUeXBlTmF2aWdhdGlvbk1vZGUsIG9wdGlvbnMub3ZlcnJpZGVTdHlsZXMsIGNvbnRleHRLZXlTZXJ2aWNlLCBsaXN0U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuaW50ZXJuYWxzKTtcblx0fVxuXG5cdG92ZXJyaWRlIHVwZGF0ZU9wdGlvbnMob3B0aW9uczogSVdvcmtiZW5jaENvbXByZXNzaWJsZU9iamVjdFRyZWVPcHRpb25zVXBkYXRlID0ge30pOiB2b2lkIHtcblx0XHRzdXBlci51cGRhdGVPcHRpb25zKG9wdGlvbnMpO1xuXG5cdFx0aWYgKG9wdGlvbnMub3ZlcnJpZGVTdHlsZXMpIHtcblx0XHRcdHRoaXMuaW50ZXJuYWxzLnVwZGF0ZVN0eWxlT3ZlcnJpZGVzKG9wdGlvbnMub3ZlcnJpZGVTdHlsZXMpO1xuXHRcdH1cblxuXHRcdHRoaXMuaW50ZXJuYWxzLnVwZGF0ZU9wdGlvbnMob3B0aW9ucyk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJV29ya2JlbmNoRGF0YVRyZWVPcHRpb25zVXBkYXRlIGV4dGVuZHMgSUFic3RyYWN0VHJlZU9wdGlvbnNVcGRhdGUge1xuXHRyZWFkb25seSBvdmVycmlkZVN0eWxlcz86IElTdHlsZU92ZXJyaWRlPElMaXN0U3R5bGVzPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJV29ya2JlbmNoRGF0YVRyZWVPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPiBleHRlbmRzIElXb3JrYmVuY2hEYXRhVHJlZU9wdGlvbnNVcGRhdGUsIElEYXRhVHJlZU9wdGlvbnM8VCwgVEZpbHRlckRhdGE+LCBJUmVzb3VyY2VOYXZpZ2F0b3JPcHRpb25zIHtcblx0cmVhZG9ubHkgYWNjZXNzaWJpbGl0eVByb3ZpZGVyOiBJTGlzdEFjY2Vzc2liaWxpdHlQcm92aWRlcjxUPjtcblx0cmVhZG9ubHkgc2VsZWN0aW9uTmF2aWdhdGlvbj86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBXb3JrYmVuY2hEYXRhVHJlZTxUSW5wdXQsIFQsIFRGaWx0ZXJEYXRhID0gdm9pZD4gZXh0ZW5kcyBEYXRhVHJlZTxUSW5wdXQsIFQsIFRGaWx0ZXJEYXRhPiB7XG5cblx0cHJpdmF0ZSBpbnRlcm5hbHM6IFdvcmtiZW5jaFRyZWVJbnRlcm5hbHM8VElucHV0LCBULCBURmlsdGVyRGF0YT47XG5cdGdldCBjb250ZXh0S2V5U2VydmljZSgpOiBJQ29udGV4dEtleVNlcnZpY2UgeyByZXR1cm4gdGhpcy5pbnRlcm5hbHMuY29udGV4dEtleVNlcnZpY2U7IH1cblx0Z2V0IHVzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllcigpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuaW50ZXJuYWxzLnVzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllcjsgfVxuXHRnZXQgb25EaWRPcGVuKCk6IEV2ZW50PElPcGVuRXZlbnQ8VCB8IHVuZGVmaW5lZD4+IHsgcmV0dXJuIHRoaXMuaW50ZXJuYWxzLm9uRGlkT3BlbjsgfVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHVzZXI6IHN0cmluZyxcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdGRlbGVnYXRlOiBJTGlzdFZpcnR1YWxEZWxlZ2F0ZTxUPixcblx0XHRyZW5kZXJlcnM6IElUcmVlUmVuZGVyZXI8VCwgVEZpbHRlckRhdGEsIGFueT5bXSxcblx0XHRkYXRhU291cmNlOiBJRGF0YVNvdXJjZTxUSW5wdXQsIFQ+LFxuXHRcdG9wdGlvbnM6IElXb3JrYmVuY2hEYXRhVHJlZU9wdGlvbnM8VCwgVEZpbHRlckRhdGE+LFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElMaXN0U2VydmljZSBsaXN0U2VydmljZTogSUxpc3RTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRjb25zdCB7IG9wdGlvbnM6IHRyZWVPcHRpb25zLCBnZXRUeXBlTmF2aWdhdGlvbk1vZGUsIGRpc3Bvc2FibGUgfSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKHdvcmtiZW5jaFRyZWVEYXRhUHJlYW1ibGUsIG9wdGlvbnMgYXMgYW55KTtcblx0XHRzdXBlcih1c2VyLCBjb250YWluZXIsIGRlbGVnYXRlLCByZW5kZXJlcnMsIGRhdGFTb3VyY2UsIHRyZWVPcHRpb25zKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZChkaXNwb3NhYmxlKTtcblx0XHR0aGlzLmludGVybmFscyA9IG5ldyBXb3JrYmVuY2hUcmVlSW50ZXJuYWxzKHRoaXMsIG9wdGlvbnMsIGdldFR5cGVOYXZpZ2F0aW9uTW9kZSwgb3B0aW9ucy5vdmVycmlkZVN0eWxlcywgY29udGV4dEtleVNlcnZpY2UsIGxpc3RTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5pbnRlcm5hbHMpO1xuXHR9XG5cblx0b3ZlcnJpZGUgdXBkYXRlT3B0aW9ucyhvcHRpb25zOiBJV29ya2JlbmNoRGF0YVRyZWVPcHRpb25zVXBkYXRlID0ge30pOiB2b2lkIHtcblx0XHRzdXBlci51cGRhdGVPcHRpb25zKG9wdGlvbnMpO1xuXG5cdFx0aWYgKG9wdGlvbnMub3ZlcnJpZGVTdHlsZXMgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5pbnRlcm5hbHMudXBkYXRlU3R5bGVPdmVycmlkZXMob3B0aW9ucy5vdmVycmlkZVN0eWxlcyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5pbnRlcm5hbHMudXBkYXRlT3B0aW9ucyhvcHRpb25zKTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElXb3JrYmVuY2hBc3luY0RhdGFUcmVlT3B0aW9uc1VwZGF0ZSBleHRlbmRzIElBc3luY0RhdGFUcmVlT3B0aW9uc1VwZGF0ZSB7XG5cdHJlYWRvbmx5IG92ZXJyaWRlU3R5bGVzPzogSVN0eWxlT3ZlcnJpZGU8SUxpc3RTdHlsZXM+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElXb3JrYmVuY2hBc3luY0RhdGFUcmVlT3B0aW9uczxULCBURmlsdGVyRGF0YT4gZXh0ZW5kcyBJV29ya2JlbmNoQXN5bmNEYXRhVHJlZU9wdGlvbnNVcGRhdGUsIElBc3luY0RhdGFUcmVlT3B0aW9uczxULCBURmlsdGVyRGF0YT4sIElSZXNvdXJjZU5hdmlnYXRvck9wdGlvbnMge1xuXHRyZWFkb25seSBhY2Nlc3NpYmlsaXR5UHJvdmlkZXI6IElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyPFQ+O1xuXHRyZWFkb25seSBzZWxlY3Rpb25OYXZpZ2F0aW9uPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIFdvcmtiZW5jaEFzeW5jRGF0YVRyZWU8VElucHV0LCBULCBURmlsdGVyRGF0YSA9IHZvaWQ+IGV4dGVuZHMgQXN5bmNEYXRhVHJlZTxUSW5wdXQsIFQsIFRGaWx0ZXJEYXRhPiB7XG5cblx0cHJpdmF0ZSBpbnRlcm5hbHM6IFdvcmtiZW5jaFRyZWVJbnRlcm5hbHM8VElucHV0LCBULCBURmlsdGVyRGF0YT47XG5cdGdldCBjb250ZXh0S2V5U2VydmljZSgpOiBJQ29udGV4dEtleVNlcnZpY2UgeyByZXR1cm4gdGhpcy5pbnRlcm5hbHMuY29udGV4dEtleVNlcnZpY2U7IH1cblx0Z2V0IHVzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllcigpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuaW50ZXJuYWxzLnVzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllcjsgfVxuXHRnZXQgb25EaWRPcGVuKCk6IEV2ZW50PElPcGVuRXZlbnQ8VCB8IHVuZGVmaW5lZD4+IHsgcmV0dXJuIHRoaXMuaW50ZXJuYWxzLm9uRGlkT3BlbjsgfVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHVzZXI6IHN0cmluZyxcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdGRlbGVnYXRlOiBJTGlzdFZpcnR1YWxEZWxlZ2F0ZTxUPixcblx0XHRyZW5kZXJlcnM6IElUcmVlUmVuZGVyZXI8VCwgVEZpbHRlckRhdGEsIGFueT5bXSxcblx0XHRkYXRhU291cmNlOiBJQXN5bmNEYXRhU291cmNlPFRJbnB1dCwgVD4sXG5cdFx0b3B0aW9uczogSVdvcmtiZW5jaEFzeW5jRGF0YVRyZWVPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPixcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJTGlzdFNlcnZpY2UgbGlzdFNlcnZpY2U6IElMaXN0U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0Y29uc3QgeyBvcHRpb25zOiB0cmVlT3B0aW9ucywgZ2V0VHlwZU5hdmlnYXRpb25Nb2RlLCBkaXNwb3NhYmxlIH0gPSBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbih3b3JrYmVuY2hUcmVlRGF0YVByZWFtYmxlLCBvcHRpb25zIGFzIGFueSk7XG5cdFx0c3VwZXIodXNlciwgY29udGFpbmVyLCBkZWxlZ2F0ZSwgcmVuZGVyZXJzLCBkYXRhU291cmNlLCB0cmVlT3B0aW9ucyk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQoZGlzcG9zYWJsZSk7XG5cdFx0dGhpcy5pbnRlcm5hbHMgPSBuZXcgV29ya2JlbmNoVHJlZUludGVybmFscyh0aGlzLCBvcHRpb25zLCBnZXRUeXBlTmF2aWdhdGlvbk1vZGUsIG9wdGlvbnMub3ZlcnJpZGVTdHlsZXMsIGNvbnRleHRLZXlTZXJ2aWNlLCBsaXN0U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuaW50ZXJuYWxzKTtcblx0fVxuXG5cdG92ZXJyaWRlIHVwZGF0ZU9wdGlvbnMob3B0aW9uczogSVdvcmtiZW5jaEFzeW5jRGF0YVRyZWVPcHRpb25zVXBkYXRlID0ge30pOiB2b2lkIHtcblx0XHRzdXBlci51cGRhdGVPcHRpb25zKG9wdGlvbnMpO1xuXG5cdFx0aWYgKG9wdGlvbnMub3ZlcnJpZGVTdHlsZXMpIHtcblx0XHRcdHRoaXMuaW50ZXJuYWxzLnVwZGF0ZVN0eWxlT3ZlcnJpZGVzKG9wdGlvbnMub3ZlcnJpZGVTdHlsZXMpO1xuXHRcdH1cblxuXHRcdHRoaXMuaW50ZXJuYWxzLnVwZGF0ZU9wdGlvbnMob3B0aW9ucyk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJV29ya2JlbmNoQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZU9wdGlvbnM8VCwgVEZpbHRlckRhdGE+IGV4dGVuZHMgSUNvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWVPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPiwgSVJlc291cmNlTmF2aWdhdG9yT3B0aW9ucyB7XG5cdHJlYWRvbmx5IGFjY2Vzc2liaWxpdHlQcm92aWRlcjogSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8VD47XG5cdHJlYWRvbmx5IG92ZXJyaWRlU3R5bGVzPzogSVN0eWxlT3ZlcnJpZGU8SUxpc3RTdHlsZXM+O1xuXHRyZWFkb25seSBzZWxlY3Rpb25OYXZpZ2F0aW9uPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIFdvcmtiZW5jaENvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWU8VElucHV0LCBULCBURmlsdGVyRGF0YSA9IHZvaWQ+IGV4dGVuZHMgQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZTxUSW5wdXQsIFQsIFRGaWx0ZXJEYXRhPiB7XG5cblx0cHJpdmF0ZSBpbnRlcm5hbHM6IFdvcmtiZW5jaFRyZWVJbnRlcm5hbHM8VElucHV0LCBULCBURmlsdGVyRGF0YT47XG5cdGdldCBjb250ZXh0S2V5U2VydmljZSgpOiBJQ29udGV4dEtleVNlcnZpY2UgeyByZXR1cm4gdGhpcy5pbnRlcm5hbHMuY29udGV4dEtleVNlcnZpY2U7IH1cblx0Z2V0IHVzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllcigpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuaW50ZXJuYWxzLnVzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllcjsgfVxuXHRnZXQgb25EaWRPcGVuKCk6IEV2ZW50PElPcGVuRXZlbnQ8VCB8IHVuZGVmaW5lZD4+IHsgcmV0dXJuIHRoaXMuaW50ZXJuYWxzLm9uRGlkT3BlbjsgfVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHVzZXI6IHN0cmluZyxcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdHZpcnR1YWxEZWxlZ2F0ZTogSUxpc3RWaXJ0dWFsRGVsZWdhdGU8VD4sXG5cdFx0Y29tcHJlc3Npb25EZWxlZ2F0ZTogSVRyZWVDb21wcmVzc2lvbkRlbGVnYXRlPFQ+LFxuXHRcdHJlbmRlcmVyczogSUNvbXByZXNzaWJsZVRyZWVSZW5kZXJlcjxULCBURmlsdGVyRGF0YSwgYW55PltdLFxuXHRcdGRhdGFTb3VyY2U6IElBc3luY0RhdGFTb3VyY2U8VElucHV0LCBUPixcblx0XHRvcHRpb25zOiBJV29ya2JlbmNoQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZU9wdGlvbnM8VCwgVEZpbHRlckRhdGE+LFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElMaXN0U2VydmljZSBsaXN0U2VydmljZTogSUxpc3RTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRjb25zdCB7IG9wdGlvbnM6IHRyZWVPcHRpb25zLCBnZXRUeXBlTmF2aWdhdGlvbk1vZGUsIGRpc3Bvc2FibGUgfSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKHdvcmtiZW5jaFRyZWVEYXRhUHJlYW1ibGUsIG9wdGlvbnMgYXMgYW55KTtcblx0XHRzdXBlcih1c2VyLCBjb250YWluZXIsIHZpcnR1YWxEZWxlZ2F0ZSwgY29tcHJlc3Npb25EZWxlZ2F0ZSwgcmVuZGVyZXJzLCBkYXRhU291cmNlLCB0cmVlT3B0aW9ucyk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQoZGlzcG9zYWJsZSk7XG5cdFx0dGhpcy5pbnRlcm5hbHMgPSBuZXcgV29ya2JlbmNoVHJlZUludGVybmFscyh0aGlzLCBvcHRpb25zLCBnZXRUeXBlTmF2aWdhdGlvbk1vZGUsIG9wdGlvbnMub3ZlcnJpZGVTdHlsZXMsIGNvbnRleHRLZXlTZXJ2aWNlLCBsaXN0U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuaW50ZXJuYWxzKTtcblx0fVxuXG5cdG92ZXJyaWRlIHVwZGF0ZU9wdGlvbnMob3B0aW9uczogSUNvbXByZXNzaWJsZUFzeW5jRGF0YVRyZWVPcHRpb25zVXBkYXRlKTogdm9pZCB7XG5cdFx0c3VwZXIudXBkYXRlT3B0aW9ucyhvcHRpb25zKTtcblx0XHR0aGlzLmludGVybmFscy51cGRhdGVPcHRpb25zKG9wdGlvbnMpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGdldERlZmF1bHRUcmVlRmluZE1vZGUoY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSkge1xuXHRjb25zdCB2YWx1ZSA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPCdoaWdobGlnaHQnIHwgJ2ZpbHRlcic+KGRlZmF1bHRGaW5kTW9kZVNldHRpbmdLZXkpO1xuXG5cdGlmICh2YWx1ZSA9PT0gJ2hpZ2hsaWdodCcpIHtcblx0XHRyZXR1cm4gVHJlZUZpbmRNb2RlLkhpZ2hsaWdodDtcblx0fSBlbHNlIGlmICh2YWx1ZSA9PT0gJ2ZpbHRlcicpIHtcblx0XHRyZXR1cm4gVHJlZUZpbmRNb2RlLkZpbHRlcjtcblx0fVxuXG5cdGNvbnN0IGRlcHJlY2F0ZWRWYWx1ZSA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPCdzaW1wbGUnIHwgJ2hpZ2hsaWdodCcgfCAnZmlsdGVyJz4oa2V5Ym9hcmROYXZpZ2F0aW9uU2V0dGluZ0tleSk7XG5cblx0aWYgKGRlcHJlY2F0ZWRWYWx1ZSA9PT0gJ3NpbXBsZScgfHwgZGVwcmVjYXRlZFZhbHVlID09PSAnaGlnaGxpZ2h0Jykge1xuXHRcdHJldHVybiBUcmVlRmluZE1vZGUuSGlnaGxpZ2h0O1xuXHR9IGVsc2UgaWYgKGRlcHJlY2F0ZWRWYWx1ZSA9PT0gJ2ZpbHRlcicpIHtcblx0XHRyZXR1cm4gVHJlZUZpbmRNb2RlLkZpbHRlcjtcblx0fVxuXG5cdHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIGdldERlZmF1bHRUcmVlRmluZE1hdGNoVHlwZShjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSB7XG5cdGNvbnN0IHZhbHVlID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8J2Z1enp5JyB8ICdjb250aWd1b3VzJz4oZGVmYXVsdEZpbmRNYXRjaFR5cGVTZXR0aW5nS2V5KTtcblxuXHRpZiAodmFsdWUgPT09ICdmdXp6eScpIHtcblx0XHRyZXR1cm4gVHJlZUZpbmRNYXRjaFR5cGUuRnV6enk7XG5cdH0gZWxzZSBpZiAodmFsdWUgPT09ICdjb250aWd1b3VzJykge1xuXHRcdHJldHVybiBUcmVlRmluZE1hdGNoVHlwZS5Db250aWd1b3VzO1xuXHR9XG5cdHJldHVybiB1bmRlZmluZWQ7XG59XG5cbmZ1bmN0aW9uIHdvcmtiZW5jaFRyZWVEYXRhUHJlYW1ibGU8VCwgVEZpbHRlckRhdGEsIFRPcHRpb25zIGV4dGVuZHMgSUFic3RyYWN0VHJlZU9wdGlvbnM8VCwgVEZpbHRlckRhdGE+IHwgSUFzeW5jRGF0YVRyZWVPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPj4oXG5cdGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLFxuXHRvcHRpb25zOiBUT3B0aW9ucyxcbik6IHsgb3B0aW9uczogVE9wdGlvbnM7IGdldFR5cGVOYXZpZ2F0aW9uTW9kZTogKCkgPT4gVHlwZU5hdmlnYXRpb25Nb2RlIHwgdW5kZWZpbmVkOyBkaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSB9IHtcblx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0Y29uc3QgY29udGV4dFZpZXdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb250ZXh0Vmlld1NlcnZpY2UpO1xuXHRjb25zdCBjb250ZXh0S2V5U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29udGV4dEtleVNlcnZpY2UpO1xuXHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXG5cdGNvbnN0IGdldFR5cGVOYXZpZ2F0aW9uTW9kZSA9ICgpID0+IHtcblx0XHQvLyBnaXZlIHByaW9yaXR5IHRvIHRoZSBjb250ZXh0IGtleSB2YWx1ZSB0byBzcGVjaWZ5IGEgdmFsdWVcblx0XHRjb25zdCBtb2RlU3RyaW5nID0gY29udGV4dEtleVNlcnZpY2UuZ2V0Q29udGV4dEtleVZhbHVlPCdhdXRvbWF0aWMnIHwgJ3RyaWdnZXInPihXb3JrYmVuY2hMaXN0VHlwZU5hdmlnYXRpb25Nb2RlS2V5KTtcblxuXHRcdGlmIChtb2RlU3RyaW5nID09PSAnYXV0b21hdGljJykge1xuXHRcdFx0cmV0dXJuIFR5cGVOYXZpZ2F0aW9uTW9kZS5BdXRvbWF0aWM7XG5cdFx0fSBlbHNlIGlmIChtb2RlU3RyaW5nID09PSAndHJpZ2dlcicpIHtcblx0XHRcdHJldHVybiBUeXBlTmF2aWdhdGlvbk1vZGUuVHJpZ2dlcjtcblx0XHR9XG5cblx0XHQvLyBhbHNvIGNoZWNrIHRoZSBkZXByZWNhdGVkIGNvbnRleHQga2V5IHRvIHNldCB0aGUgbW9kZSB0byAndHJpZ2dlcidcblx0XHRjb25zdCBtb2RlQm9vbGVhbiA9IGNvbnRleHRLZXlTZXJ2aWNlLmdldENvbnRleHRLZXlWYWx1ZTxib29sZWFuPihXb3JrYmVuY2hMaXN0QXV0b21hdGljS2V5Ym9hcmROYXZpZ2F0aW9uTGVnYWN5S2V5KTtcblxuXHRcdGlmIChtb2RlQm9vbGVhbiA9PT0gZmFsc2UpIHtcblx0XHRcdHJldHVybiBUeXBlTmF2aWdhdGlvbk1vZGUuVHJpZ2dlcjtcblx0XHR9XG5cblx0XHQvLyBmaW5hbGx5LCBjaGVjayB0aGUgc2V0dGluZ1xuXHRcdGNvbnN0IGNvbmZpZ1N0cmluZyA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPCdhdXRvbWF0aWMnIHwgJ3RyaWdnZXInPih0eXBlTmF2aWdhdGlvbk1vZGVTZXR0aW5nS2V5KTtcblxuXHRcdGlmIChjb25maWdTdHJpbmcgPT09ICdhdXRvbWF0aWMnKSB7XG5cdFx0XHRyZXR1cm4gVHlwZU5hdmlnYXRpb25Nb2RlLkF1dG9tYXRpYztcblx0XHR9IGVsc2UgaWYgKGNvbmZpZ1N0cmluZyA9PT0gJ3RyaWdnZXInKSB7XG5cdFx0XHRyZXR1cm4gVHlwZU5hdmlnYXRpb25Nb2RlLlRyaWdnZXI7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fTtcblxuXHRjb25zdCBob3Jpem9udGFsU2Nyb2xsaW5nID0gb3B0aW9ucy5ob3Jpem9udGFsU2Nyb2xsaW5nICE9PSB1bmRlZmluZWQgPyBvcHRpb25zLmhvcml6b250YWxTY3JvbGxpbmcgOiBCb29sZWFuKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKGhvcml6b250YWxTY3JvbGxpbmdLZXkpKTtcblx0Y29uc3QgW3dvcmtiZW5jaExpc3RPcHRpb25zLCBkaXNwb3NhYmxlXSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKHRvV29ya2JlbmNoTGlzdE9wdGlvbnMsIG9wdGlvbnMpO1xuXHRjb25zdCBwYWRkaW5nQm90dG9tID0gb3B0aW9ucy5wYWRkaW5nQm90dG9tO1xuXHRjb25zdCByZW5kZXJJbmRlbnRHdWlkZXMgPSBvcHRpb25zLnJlbmRlckluZGVudEd1aWRlcyAhPT0gdW5kZWZpbmVkID8gb3B0aW9ucy5yZW5kZXJJbmRlbnRHdWlkZXMgOiBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxSZW5kZXJJbmRlbnRHdWlkZXM+KHRyZWVSZW5kZXJJbmRlbnRHdWlkZXNLZXkpO1xuXG5cdHJldHVybiB7XG5cdFx0Z2V0VHlwZU5hdmlnYXRpb25Nb2RlLFxuXHRcdGRpc3Bvc2FibGUsXG5cdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGxvY2FsL2NvZGUtbm8tZGFuZ2Vyb3VzLXR5cGUtYXNzZXJ0aW9uc1xuXHRcdG9wdGlvbnM6IHtcblx0XHRcdC8vIC4uLm9wdGlvbnMsIC8vIFRPRE9ASm9hbyB3aHkgaXMgdGhpcyBub3Qgc3BsYXR0ZWQgaGVyZT9cblx0XHRcdGtleWJvYXJkU3VwcG9ydDogZmFsc2UsXG5cdFx0XHQuLi53b3JrYmVuY2hMaXN0T3B0aW9ucyxcblx0XHRcdGluZGVudDogdHlwZW9mIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKHRyZWVJbmRlbnRLZXkpID09PSAnbnVtYmVyJyA/IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKHRyZWVJbmRlbnRLZXkpIDogdW5kZWZpbmVkLFxuXHRcdFx0cmVuZGVySW5kZW50R3VpZGVzLFxuXHRcdFx0c21vb3RoU2Nyb2xsaW5nOiBCb29sZWFuKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKGxpc3RTbW9vdGhTY3JvbGxpbmcpKSxcblx0XHRcdGRlZmF1bHRGaW5kTW9kZTogZ2V0RGVmYXVsdFRyZWVGaW5kTW9kZShjb25maWd1cmF0aW9uU2VydmljZSksXG5cdFx0XHRkZWZhdWx0RmluZE1hdGNoVHlwZTogZ2V0RGVmYXVsdFRyZWVGaW5kTWF0Y2hUeXBlKGNvbmZpZ3VyYXRpb25TZXJ2aWNlKSxcblx0XHRcdGhvcml6b250YWxTY3JvbGxpbmcsXG5cdFx0XHRzY3JvbGxCeVBhZ2U6IEJvb2xlYW4oY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoc2Nyb2xsQnlQYWdlS2V5KSksXG5cdFx0XHRwYWRkaW5nQm90dG9tOiBwYWRkaW5nQm90dG9tLFxuXHRcdFx0aGlkZVR3aXN0aWVzT2ZDaGlsZGxlc3NFbGVtZW50czogb3B0aW9ucy5oaWRlVHdpc3RpZXNPZkNoaWxkbGVzc0VsZW1lbnRzLFxuXHRcdFx0ZXhwYW5kT25seU9uVHdpc3RpZUNsaWNrOiBvcHRpb25zLmV4cGFuZE9ubHlPblR3aXN0aWVDbGljayA/PyAoY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8J3NpbmdsZUNsaWNrJyB8ICdkb3VibGVDbGljayc+KHRyZWVFeHBhbmRNb2RlKSA9PT0gJ2RvdWJsZUNsaWNrJyksXG5cdFx0XHRjb250ZXh0Vmlld1Byb3ZpZGVyOiBjb250ZXh0Vmlld1NlcnZpY2UgYXMgSUNvbnRleHRWaWV3UHJvdmlkZXIsXG5cdFx0XHRmaW5kV2lkZ2V0U3R5bGVzOiBkZWZhdWx0RmluZFdpZGdldFN0eWxlcyxcblx0XHRcdGVuYWJsZVN0aWNreVNjcm9sbDogQm9vbGVhbihjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSh0cmVlU3RpY2t5U2Nyb2xsKSksXG5cdFx0XHRzdGlja3lTY3JvbGxNYXhJdGVtQ291bnQ6IE51bWJlcihjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSh0cmVlU3RpY2t5U2Nyb2xsTWF4RWxlbWVudHMpKSxcblx0XHR9IGFzIFRPcHRpb25zXG5cdH07XG59XG5cbmludGVyZmFjZSBJV29ya2JlbmNoVHJlZUludGVybmFsc09wdGlvbnNVcGRhdGUge1xuXHRyZWFkb25seSBtdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ/OiBib29sZWFuO1xufVxuXG5jbGFzcyBXb3JrYmVuY2hUcmVlSW50ZXJuYWxzPFRJbnB1dCwgVCwgVEZpbHRlckRhdGE+IHtcblxuXHRyZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSVNjb3BlZENvbnRleHRLZXlTZXJ2aWNlO1xuXHRwcml2YXRlIGxpc3RTdXBwb3J0c011bHRpU2VsZWN0OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBsaXN0U3VwcG9ydEZpbmRXaWRnZXQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGhhc1NlbGVjdGlvbk9yRm9jdXM6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIGhhc0RvdWJsZVNlbGVjdGlvbjogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgaGFzTXVsdGlTZWxlY3Rpb246IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHRyZWVFbGVtZW50Q2FuQ29sbGFwc2U6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHRyZWVFbGVtZW50SGFzUGFyZW50OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSB0cmVlRWxlbWVudENhbkV4cGFuZDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgdHJlZUVsZW1lbnRIYXNDaGlsZDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgdHJlZUZpbmRPcGVuOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSB0cmVlU3RpY2t5U2Nyb2xsRm9jdXNlZDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgX3VzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllcjogYm9vbGVhbjtcblx0cHJpdmF0ZSBkaXNwb3NhYmxlczogSURpc3Bvc2FibGVbXSA9IFtdO1xuXG5cdHByaXZhdGUgbmF2aWdhdG9yOiBUcmVlUmVzb3VyY2VOYXZpZ2F0b3I8VCwgVEZpbHRlckRhdGE+O1xuXG5cdGdldCBvbkRpZE9wZW4oKTogRXZlbnQ8SU9wZW5FdmVudDxUIHwgdW5kZWZpbmVkPj4geyByZXR1cm4gdGhpcy5uYXZpZ2F0b3Iub25EaWRPcGVuOyB9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSB0cmVlOiBXb3JrYmVuY2hPYmplY3RUcmVlPFQsIFRGaWx0ZXJEYXRhPiB8IFdvcmtiZW5jaENvbXByZXNzaWJsZU9iamVjdFRyZWU8VCwgVEZpbHRlckRhdGE+IHwgV29ya2JlbmNoRGF0YVRyZWU8VElucHV0LCBULCBURmlsdGVyRGF0YT4gfCBXb3JrYmVuY2hBc3luY0RhdGFUcmVlPFRJbnB1dCwgVCwgVEZpbHRlckRhdGE+IHwgV29ya2JlbmNoQ29tcHJlc3NpYmxlQXN5bmNEYXRhVHJlZTxUSW5wdXQsIFQsIFRGaWx0ZXJEYXRhPixcblx0XHRvcHRpb25zOiBJV29ya2JlbmNoT2JqZWN0VHJlZU9wdGlvbnM8VCwgVEZpbHRlckRhdGE+IHwgSVdvcmtiZW5jaENvbXByZXNzaWJsZU9iamVjdFRyZWVPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPiB8IElXb3JrYmVuY2hEYXRhVHJlZU9wdGlvbnM8VCwgVEZpbHRlckRhdGE+IHwgSVdvcmtiZW5jaEFzeW5jRGF0YVRyZWVPcHRpb25zPFQsIFRGaWx0ZXJEYXRhPiB8IElXb3JrYmVuY2hDb21wcmVzc2libGVBc3luY0RhdGFUcmVlT3B0aW9uczxULCBURmlsdGVyRGF0YT4sXG5cdFx0Z2V0VHlwZU5hdmlnYXRpb25Nb2RlOiAoKSA9PiBUeXBlTmF2aWdhdGlvbk1vZGUgfCB1bmRlZmluZWQsXG5cdFx0b3ZlcnJpZGVTdHlsZXM6IElTdHlsZU92ZXJyaWRlPElMaXN0U3R5bGVzPiB8IHVuZGVmaW5lZCxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElMaXN0U2VydmljZSBsaXN0U2VydmljZTogSUxpc3RTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZVxuXHQpIHtcblx0XHR0aGlzLmNvbnRleHRLZXlTZXJ2aWNlID0gY3JlYXRlU2NvcGVkQ29udGV4dEtleVNlcnZpY2UoY29udGV4dEtleVNlcnZpY2UsIHRyZWUpO1xuXG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5wdXNoKGNyZWF0ZVNjcm9sbE9ic2VydmVyKHRoaXMuY29udGV4dEtleVNlcnZpY2UsIHRyZWUpKTtcblxuXHRcdHRoaXMubGlzdFN1cHBvcnRzTXVsdGlTZWxlY3QgPSBXb3JrYmVuY2hMaXN0U3VwcG9ydHNNdWx0aVNlbGVjdENvbnRleHRLZXkuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMubGlzdFN1cHBvcnRzTXVsdGlTZWxlY3Quc2V0KG9wdGlvbnMubXVsdGlwbGVTZWxlY3Rpb25TdXBwb3J0ICE9PSBmYWxzZSk7XG5cblx0XHRjb25zdCBsaXN0U2VsZWN0aW9uTmF2aWdhdGlvbiA9IFdvcmtiZW5jaExpc3RTZWxlY3Rpb25OYXZpZ2F0aW9uLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRsaXN0U2VsZWN0aW9uTmF2aWdhdGlvbi5zZXQoQm9vbGVhbihvcHRpb25zLnNlbGVjdGlvbk5hdmlnYXRpb24pKTtcblxuXHRcdHRoaXMubGlzdFN1cHBvcnRGaW5kV2lkZ2V0ID0gV29ya2JlbmNoTGlzdFN1cHBvcnRzRmluZC5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5saXN0U3VwcG9ydEZpbmRXaWRnZXQuc2V0KG9wdGlvbnMuZmluZFdpZGdldEVuYWJsZWQgPz8gdHJ1ZSk7XG5cblx0XHR0aGlzLmhhc1NlbGVjdGlvbk9yRm9jdXMgPSBXb3JrYmVuY2hMaXN0SGFzU2VsZWN0aW9uT3JGb2N1cy5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5oYXNEb3VibGVTZWxlY3Rpb24gPSBXb3JrYmVuY2hMaXN0RG91YmxlU2VsZWN0aW9uLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmhhc011bHRpU2VsZWN0aW9uID0gV29ya2JlbmNoTGlzdE11bHRpU2VsZWN0aW9uLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMudHJlZUVsZW1lbnRDYW5Db2xsYXBzZSA9IFdvcmtiZW5jaFRyZWVFbGVtZW50Q2FuQ29sbGFwc2UuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMudHJlZUVsZW1lbnRIYXNQYXJlbnQgPSBXb3JrYmVuY2hUcmVlRWxlbWVudEhhc1BhcmVudC5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy50cmVlRWxlbWVudENhbkV4cGFuZCA9IFdvcmtiZW5jaFRyZWVFbGVtZW50Q2FuRXhwYW5kLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnRyZWVFbGVtZW50SGFzQ2hpbGQgPSBXb3JrYmVuY2hUcmVlRWxlbWVudEhhc0NoaWxkLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMudHJlZUZpbmRPcGVuID0gV29ya2JlbmNoVHJlZUZpbmRPcGVuLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnRyZWVTdGlja3lTY3JvbGxGb2N1c2VkID0gV29ya2JlbmNoVHJlZVN0aWNreVNjcm9sbEZvY3VzZWQuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fdXNlQWx0QXNNdWx0aXBsZVNlbGVjdGlvbk1vZGlmaWVyID0gdXNlQWx0QXNNdWx0aXBsZVNlbGVjdGlvbk1vZGlmaWVyKGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRcdHRoaXMudXBkYXRlU3R5bGVPdmVycmlkZXMob3ZlcnJpZGVTdHlsZXMpO1xuXG5cdFx0Y29uc3QgdXBkYXRlQ29sbGFwc2VDb250ZXh0S2V5cyA9ICgpID0+IHtcblx0XHRcdGNvbnN0IGZvY3VzID0gdHJlZS5nZXRGb2N1cygpWzBdO1xuXG5cdFx0XHRpZiAoIWZvY3VzKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgbm9kZSA9IHRyZWUuZ2V0Tm9kZShmb2N1cyk7XG5cdFx0XHR0aGlzLnRyZWVFbGVtZW50Q2FuQ29sbGFwc2Uuc2V0KG5vZGUuY29sbGFwc2libGUgJiYgIW5vZGUuY29sbGFwc2VkKTtcblx0XHRcdHRoaXMudHJlZUVsZW1lbnRIYXNQYXJlbnQuc2V0KCEhdHJlZS5nZXRQYXJlbnRFbGVtZW50KGZvY3VzKSk7XG5cdFx0XHR0aGlzLnRyZWVFbGVtZW50Q2FuRXhwYW5kLnNldChub2RlLmNvbGxhcHNpYmxlICYmIG5vZGUuY29sbGFwc2VkKTtcblx0XHRcdHRoaXMudHJlZUVsZW1lbnRIYXNDaGlsZC5zZXQoISF0cmVlLmdldEZpcnN0RWxlbWVudENoaWxkKGZvY3VzKSk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGludGVyZXN0aW5nQ29udGV4dEtleXMgPSBuZXcgU2V0KCk7XG5cdFx0aW50ZXJlc3RpbmdDb250ZXh0S2V5cy5hZGQoV29ya2JlbmNoTGlzdFR5cGVOYXZpZ2F0aW9uTW9kZUtleSk7XG5cdFx0aW50ZXJlc3RpbmdDb250ZXh0S2V5cy5hZGQoV29ya2JlbmNoTGlzdEF1dG9tYXRpY0tleWJvYXJkTmF2aWdhdGlvbkxlZ2FjeUtleSk7XG5cblx0XHR0aGlzLmRpc3Bvc2FibGVzLnB1c2goXG5cdFx0XHR0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0KGxpc3RTZXJ2aWNlIGFzIExpc3RTZXJ2aWNlKS5yZWdpc3Rlcih0cmVlKSxcblx0XHRcdHRyZWUub25EaWRDaGFuZ2VTZWxlY3Rpb24oKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBzZWxlY3Rpb24gPSB0cmVlLmdldFNlbGVjdGlvbigpO1xuXHRcdFx0XHRjb25zdCBmb2N1cyA9IHRyZWUuZ2V0Rm9jdXMoKTtcblxuXHRcdFx0XHR0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmJ1ZmZlckNoYW5nZUV2ZW50cygoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5oYXNTZWxlY3Rpb25PckZvY3VzLnNldChzZWxlY3Rpb24ubGVuZ3RoID4gMCB8fCBmb2N1cy5sZW5ndGggPiAwKTtcblx0XHRcdFx0XHR0aGlzLmhhc011bHRpU2VsZWN0aW9uLnNldChzZWxlY3Rpb24ubGVuZ3RoID4gMSk7XG5cdFx0XHRcdFx0dGhpcy5oYXNEb3VibGVTZWxlY3Rpb24uc2V0KHNlbGVjdGlvbi5sZW5ndGggPT09IDIpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pLFxuXHRcdFx0dHJlZS5vbkRpZENoYW5nZUZvY3VzKCgpID0+IHtcblx0XHRcdFx0Y29uc3Qgc2VsZWN0aW9uID0gdHJlZS5nZXRTZWxlY3Rpb24oKTtcblx0XHRcdFx0Y29uc3QgZm9jdXMgPSB0cmVlLmdldEZvY3VzKCk7XG5cblx0XHRcdFx0dGhpcy5oYXNTZWxlY3Rpb25PckZvY3VzLnNldChzZWxlY3Rpb24ubGVuZ3RoID4gMCB8fCBmb2N1cy5sZW5ndGggPiAwKTtcblx0XHRcdFx0dXBkYXRlQ29sbGFwc2VDb250ZXh0S2V5cygpO1xuXHRcdFx0fSksXG5cdFx0XHR0cmVlLm9uRGlkQ2hhbmdlQ29sbGFwc2VTdGF0ZSh1cGRhdGVDb2xsYXBzZUNvbnRleHRLZXlzKSxcblx0XHRcdHRyZWUub25EaWRDaGFuZ2VNb2RlbCh1cGRhdGVDb2xsYXBzZUNvbnRleHRLZXlzKSxcblx0XHRcdHRyZWUub25EaWRDaGFuZ2VGaW5kT3BlblN0YXRlKGVuYWJsZWQgPT4gdGhpcy50cmVlRmluZE9wZW4uc2V0KGVuYWJsZWQpKSxcblx0XHRcdHRyZWUub25EaWRDaGFuZ2VTdGlja3lTY3JvbGxGb2N1c2VkKGZvY3VzZWQgPT4gdGhpcy50cmVlU3RpY2t5U2Nyb2xsRm9jdXNlZC5zZXQoZm9jdXNlZCkpLFxuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0XHRsZXQgbmV3T3B0aW9uczogSUFic3RyYWN0VHJlZU9wdGlvbnNVcGRhdGUgPSB7fTtcblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24obXVsdGlTZWxlY3RNb2RpZmllclNldHRpbmdLZXkpKSB7XG5cdFx0XHRcdFx0dGhpcy5fdXNlQWx0QXNNdWx0aXBsZVNlbGVjdGlvbk1vZGlmaWVyID0gdXNlQWx0QXNNdWx0aXBsZVNlbGVjdGlvbk1vZGlmaWVyKGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbih0cmVlSW5kZW50S2V5KSkge1xuXHRcdFx0XHRcdGNvbnN0IGluZGVudCA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPG51bWJlcj4odHJlZUluZGVudEtleSk7XG5cdFx0XHRcdFx0bmV3T3B0aW9ucyA9IHsgLi4ubmV3T3B0aW9ucywgaW5kZW50IH07XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24odHJlZVJlbmRlckluZGVudEd1aWRlc0tleSkgJiYgb3B0aW9ucy5yZW5kZXJJbmRlbnRHdWlkZXMgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGNvbnN0IHJlbmRlckluZGVudEd1aWRlcyA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPFJlbmRlckluZGVudEd1aWRlcz4odHJlZVJlbmRlckluZGVudEd1aWRlc0tleSk7XG5cdFx0XHRcdFx0bmV3T3B0aW9ucyA9IHsgLi4ubmV3T3B0aW9ucywgcmVuZGVySW5kZW50R3VpZGVzIH07XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24obGlzdFNtb290aFNjcm9sbGluZykpIHtcblx0XHRcdFx0XHRjb25zdCBzbW9vdGhTY3JvbGxpbmcgPSBCb29sZWFuKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKGxpc3RTbW9vdGhTY3JvbGxpbmcpKTtcblx0XHRcdFx0XHRuZXdPcHRpb25zID0geyAuLi5uZXdPcHRpb25zLCBzbW9vdGhTY3JvbGxpbmcgfTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihkZWZhdWx0RmluZE1vZGVTZXR0aW5nS2V5KSB8fCBlLmFmZmVjdHNDb25maWd1cmF0aW9uKGtleWJvYXJkTmF2aWdhdGlvblNldHRpbmdLZXkpKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGVmYXVsdEZpbmRNb2RlID0gZ2V0RGVmYXVsdFRyZWVGaW5kTW9kZShjb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0XHRcdFx0bmV3T3B0aW9ucyA9IHsgLi4ubmV3T3B0aW9ucywgZGVmYXVsdEZpbmRNb2RlIH07XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24odHlwZU5hdmlnYXRpb25Nb2RlU2V0dGluZ0tleSkgfHwgZS5hZmZlY3RzQ29uZmlndXJhdGlvbihrZXlib2FyZE5hdmlnYXRpb25TZXR0aW5nS2V5KSkge1xuXHRcdFx0XHRcdGNvbnN0IHR5cGVOYXZpZ2F0aW9uTW9kZSA9IGdldFR5cGVOYXZpZ2F0aW9uTW9kZSgpO1xuXHRcdFx0XHRcdG5ld09wdGlvbnMgPSB7IC4uLm5ld09wdGlvbnMsIHR5cGVOYXZpZ2F0aW9uTW9kZSB9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKGRlZmF1bHRGaW5kTWF0Y2hUeXBlU2V0dGluZ0tleSkpIHtcblx0XHRcdFx0XHRjb25zdCBkZWZhdWx0RmluZE1hdGNoVHlwZSA9IGdldERlZmF1bHRUcmVlRmluZE1hdGNoVHlwZShjb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0XHRcdFx0bmV3T3B0aW9ucyA9IHsgLi4ubmV3T3B0aW9ucywgZGVmYXVsdEZpbmRNYXRjaFR5cGUgfTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihob3Jpem9udGFsU2Nyb2xsaW5nS2V5KSAmJiBvcHRpb25zLmhvcml6b250YWxTY3JvbGxpbmcgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdGNvbnN0IGhvcml6b250YWxTY3JvbGxpbmcgPSBCb29sZWFuKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKGhvcml6b250YWxTY3JvbGxpbmdLZXkpKTtcblx0XHRcdFx0XHRuZXdPcHRpb25zID0geyAuLi5uZXdPcHRpb25zLCBob3Jpem9udGFsU2Nyb2xsaW5nIH07XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oc2Nyb2xsQnlQYWdlS2V5KSkge1xuXHRcdFx0XHRcdGNvbnN0IHNjcm9sbEJ5UGFnZSA9IEJvb2xlYW4oY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoc2Nyb2xsQnlQYWdlS2V5KSk7XG5cdFx0XHRcdFx0bmV3T3B0aW9ucyA9IHsgLi4ubmV3T3B0aW9ucywgc2Nyb2xsQnlQYWdlIH07XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24odHJlZUV4cGFuZE1vZGUpICYmIG9wdGlvbnMuZXhwYW5kT25seU9uVHdpc3RpZUNsaWNrID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRuZXdPcHRpb25zID0geyAuLi5uZXdPcHRpb25zLCBleHBhbmRPbmx5T25Ud2lzdGllQ2xpY2s6IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPCdzaW5nbGVDbGljaycgfCAnZG91YmxlQ2xpY2snPih0cmVlRXhwYW5kTW9kZSkgPT09ICdkb3VibGVDbGljaycgfTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbih0cmVlU3RpY2t5U2Nyb2xsKSkge1xuXHRcdFx0XHRcdGNvbnN0IGVuYWJsZVN0aWNreVNjcm9sbCA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KHRyZWVTdGlja3lTY3JvbGwpO1xuXHRcdFx0XHRcdG5ld09wdGlvbnMgPSB7IC4uLm5ld09wdGlvbnMsIGVuYWJsZVN0aWNreVNjcm9sbCB9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKHRyZWVTdGlja3lTY3JvbGxNYXhFbGVtZW50cykpIHtcblx0XHRcdFx0XHRjb25zdCBzdGlja3lTY3JvbGxNYXhJdGVtQ291bnQgPSBNYXRoLm1heCgxLCBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KHRyZWVTdGlja3lTY3JvbGxNYXhFbGVtZW50cykpO1xuXHRcdFx0XHRcdG5ld09wdGlvbnMgPSB7IC4uLm5ld09wdGlvbnMsIHN0aWNreVNjcm9sbE1heEl0ZW1Db3VudCB9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKG1vdXNlV2hlZWxTY3JvbGxTZW5zaXRpdml0eUtleSkpIHtcblx0XHRcdFx0XHRjb25zdCBtb3VzZVdoZWVsU2Nyb2xsU2Vuc2l0aXZpdHkgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KG1vdXNlV2hlZWxTY3JvbGxTZW5zaXRpdml0eUtleSk7XG5cdFx0XHRcdFx0bmV3T3B0aW9ucyA9IHsgLi4ubmV3T3B0aW9ucywgbW91c2VXaGVlbFNjcm9sbFNlbnNpdGl2aXR5IH07XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oZmFzdFNjcm9sbFNlbnNpdGl2aXR5S2V5KSkge1xuXHRcdFx0XHRcdGNvbnN0IGZhc3RTY3JvbGxTZW5zaXRpdml0eSA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPG51bWJlcj4oZmFzdFNjcm9sbFNlbnNpdGl2aXR5S2V5KTtcblx0XHRcdFx0XHRuZXdPcHRpb25zID0geyAuLi5uZXdPcHRpb25zLCBmYXN0U2Nyb2xsU2Vuc2l0aXZpdHkgfTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoT2JqZWN0LmtleXMobmV3T3B0aW9ucykubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdHRyZWUudXBkYXRlT3B0aW9ucyhuZXdPcHRpb25zKTtcblx0XHRcdFx0fVxuXHRcdFx0fSksXG5cdFx0XHR0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLm9uRGlkQ2hhbmdlQ29udGV4dChlID0+IHtcblx0XHRcdFx0aWYgKGUuYWZmZWN0c1NvbWUoaW50ZXJlc3RpbmdDb250ZXh0S2V5cykpIHtcblx0XHRcdFx0XHR0cmVlLnVwZGF0ZU9wdGlvbnMoeyB0eXBlTmF2aWdhdGlvbk1vZGU6IGdldFR5cGVOYXZpZ2F0aW9uTW9kZSgpIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KVxuXHRcdCk7XG5cblx0XHR0aGlzLm5hdmlnYXRvciA9IG5ldyBUcmVlUmVzb3VyY2VOYXZpZ2F0b3IodHJlZSwgeyBjb25maWd1cmF0aW9uU2VydmljZSwgLi4ub3B0aW9ucyB9KTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLnB1c2godGhpcy5uYXZpZ2F0b3IpO1xuXHR9XG5cblx0Z2V0IHVzZUFsdEFzTXVsdGlwbGVTZWxlY3Rpb25Nb2RpZmllcigpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fdXNlQWx0QXNNdWx0aXBsZVNlbGVjdGlvbk1vZGlmaWVyO1xuXHR9XG5cblx0dXBkYXRlT3B0aW9ucyhvcHRpb25zOiBJV29ya2JlbmNoVHJlZUludGVybmFsc09wdGlvbnNVcGRhdGUpOiB2b2lkIHtcblx0XHRpZiAob3B0aW9ucy5tdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5saXN0U3VwcG9ydHNNdWx0aVNlbGVjdC5zZXQoISFvcHRpb25zLm11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydCk7XG5cdFx0fVxuXHR9XG5cblx0dXBkYXRlU3R5bGVPdmVycmlkZXMob3ZlcnJpZGVTdHlsZXM/OiBJU3R5bGVPdmVycmlkZTxJTGlzdFN0eWxlcz4pOiB2b2lkIHtcblx0XHR0aGlzLnRyZWUuc3R5bGUob3ZlcnJpZGVTdHlsZXMgPyBnZXRMaXN0U3R5bGVzKG92ZXJyaWRlU3R5bGVzKSA6IGRlZmF1bHRMaXN0U3R5bGVzKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcyA9IGRpc3Bvc2UodGhpcy5kaXNwb3NhYmxlcyk7XG5cdH1cbn1cblxuY29uc3QgY29uZmlndXJhdGlvblJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbik7XG5cbmNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRpZDogJ3dvcmtiZW5jaCcsXG5cdG9yZGVyOiA3LFxuXHR0aXRsZTogbG9jYWxpemUoJ3dvcmtiZW5jaENvbmZpZ3VyYXRpb25UaXRsZScsIFwiV29ya2JlbmNoXCIpLFxuXHR0eXBlOiAnb2JqZWN0Jyxcblx0cHJvcGVydGllczoge1xuXHRcdFttdWx0aVNlbGVjdE1vZGlmaWVyU2V0dGluZ0tleV06IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydjdHJsQ21kJywgJ2FsdCddLFxuXHRcdFx0bWFya2Rvd25FbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKCdtdWx0aVNlbGVjdE1vZGlmaWVyLmN0cmxDbWQnLCBcIk1hcHMgdG8gYENvbnRyb2xgIG9uIFdpbmRvd3MgYW5kIExpbnV4IGFuZCB0byBgQ29tbWFuZGAgb24gbWFjT1MuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgnbXVsdGlTZWxlY3RNb2RpZmllci5hbHQnLCBcIk1hcHMgdG8gYEFsdGAgb24gV2luZG93cyBhbmQgTGludXggYW5kIHRvIGBPcHRpb25gIG9uIG1hY09TLlwiKVxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6ICdjdHJsQ21kJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSh7XG5cdFx0XHRcdGtleTogJ211bHRpU2VsZWN0TW9kaWZpZXInLFxuXHRcdFx0XHRjb21tZW50OiBbXG5cdFx0XHRcdFx0Jy0gYGN0cmxDbWRgIHJlZmVycyB0byBhIHZhbHVlIHRoZSBzZXR0aW5nIGNhbiB0YWtlIGFuZCBzaG91bGQgbm90IGJlIGxvY2FsaXplZC4nLFxuXHRcdFx0XHRcdCctIGBDb250cm9sYCBhbmQgYENvbW1hbmRgIHJlZmVyIHRvIHRoZSBtb2RpZmllciBrZXlzIEN0cmwgb3IgQ21kIG9uIHRoZSBrZXlib2FyZCBhbmQgY2FuIGJlIGxvY2FsaXplZC4nXG5cdFx0XHRcdF1cblx0XHRcdH0sIFwiVGhlIG1vZGlmaWVyIHRvIGJlIHVzZWQgdG8gYWRkIGFuIGl0ZW0gaW4gdHJlZXMgYW5kIGxpc3RzIHRvIGEgbXVsdGktc2VsZWN0aW9uIHdpdGggdGhlIG1vdXNlIChmb3IgZXhhbXBsZSBpbiB0aGUgZXhwbG9yZXIsIG9wZW4gZWRpdG9ycyBhbmQgc2NtIHZpZXcpLiBUaGUgJ09wZW4gdG8gU2lkZScgbW91c2UgZ2VzdHVyZXMgLSBpZiBzdXBwb3J0ZWQgLSB3aWxsIGFkYXB0IHN1Y2ggdGhhdCB0aGV5IGRvIG5vdCBjb25mbGljdCB3aXRoIHRoZSBtdWx0aXNlbGVjdCBtb2RpZmllci5cIilcblx0XHR9LFxuXHRcdFtvcGVuTW9kZVNldHRpbmdLZXldOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnc2luZ2xlQ2xpY2snLCAnZG91YmxlQ2xpY2snXSxcblx0XHRcdGRlZmF1bHQ6ICdzaW5nbGVDbGljaycsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoe1xuXHRcdFx0XHRrZXk6ICdvcGVuTW9kZU1vZGlmaWVyJyxcblx0XHRcdFx0Y29tbWVudDogWydgc2luZ2xlQ2xpY2tgIGFuZCBgZG91YmxlQ2xpY2tgIHJlZmVycyB0byBhIHZhbHVlIHRoZSBzZXR0aW5nIGNhbiB0YWtlIGFuZCBzaG91bGQgbm90IGJlIGxvY2FsaXplZC4nXVxuXHRcdFx0fSwgXCJDb250cm9scyBob3cgdG8gb3BlbiBpdGVtcyBpbiB0cmVlcyBhbmQgbGlzdHMgdXNpbmcgdGhlIG1vdXNlIChpZiBzdXBwb3J0ZWQpLiBOb3RlIHRoYXQgc29tZSB0cmVlcyBhbmQgbGlzdHMgbWlnaHQgY2hvb3NlIHRvIGlnbm9yZSB0aGlzIHNldHRpbmcgaWYgaXQgaXMgbm90IGFwcGxpY2FibGUuXCIpXG5cdFx0fSxcblx0XHRbaG9yaXpvbnRhbFNjcm9sbGluZ0tleV06IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlLFxuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdob3Jpem9udGFsU2Nyb2xsaW5nIHNldHRpbmcnLCBcIkNvbnRyb2xzIHdoZXRoZXIgbGlzdHMgYW5kIHRyZWVzIHN1cHBvcnQgaG9yaXpvbnRhbCBzY3JvbGxpbmcgaW4gdGhlIHdvcmtiZW5jaC4gV2FybmluZzogdHVybmluZyBvbiB0aGlzIHNldHRpbmcgaGFzIGEgcGVyZm9ybWFuY2UgaW1wbGljYXRpb24uXCIpXG5cdFx0fSxcblx0XHRbc2Nyb2xsQnlQYWdlS2V5XToge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2xpc3Quc2Nyb2xsQnlQYWdlJywgXCJDb250cm9scyB3aGV0aGVyIGNsaWNrcyBpbiB0aGUgc2Nyb2xsYmFyIHNjcm9sbCBwYWdlIGJ5IHBhZ2UuXCIpXG5cdFx0fSxcblx0XHRbdHJlZUluZGVudEtleV06IHtcblx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0ZGVmYXVsdDogOCxcblx0XHRcdG1pbmltdW06IDQsXG5cdFx0XHRtYXhpbXVtOiA0MCxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndHJlZSBpbmRlbnQgc2V0dGluZycsIFwiQ29udHJvbHMgdHJlZSBpbmRlbnRhdGlvbiBpbiBwaXhlbHMuXCIpXG5cdFx0fSxcblx0XHRbdHJlZVJlbmRlckluZGVudEd1aWRlc0tleV06IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydub25lJywgJ29uSG92ZXInLCAnYWx3YXlzJ10sXG5cdFx0XHRkZWZhdWx0OiAnb25Ib3ZlcicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3JlbmRlciB0cmVlIGluZGVudCBndWlkZXMnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIHRyZWUgc2hvdWxkIHJlbmRlciBpbmRlbnQgZ3VpZGVzLlwiKVxuXHRcdH0sXG5cdFx0W2xpc3RTbW9vdGhTY3JvbGxpbmddOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZSxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbGlzdCBzbW9vdGhTY3JvbGxpbmcgc2V0dGluZycsIFwiQ29udHJvbHMgd2hldGhlciBsaXN0cyBhbmQgdHJlZXMgaGF2ZSBzbW9vdGggc2Nyb2xsaW5nLlwiKSxcblx0XHR9LFxuXHRcdFttb3VzZVdoZWVsU2Nyb2xsU2Vuc2l0aXZpdHlLZXldOiB7XG5cdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdGRlZmF1bHQ6IDEsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnTW91c2UgV2hlZWwgU2Nyb2xsIFNlbnNpdGl2aXR5JywgXCJBIG11bHRpcGxpZXIgdG8gYmUgdXNlZCBvbiB0aGUgYGRlbHRhWGAgYW5kIGBkZWx0YVlgIG9mIG1vdXNlIHdoZWVsIHNjcm9sbCBldmVudHMuXCIpXG5cdFx0fSxcblx0XHRbZmFzdFNjcm9sbFNlbnNpdGl2aXR5S2V5XToge1xuXHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRkZWZhdWx0OiA1LFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ0Zhc3QgU2Nyb2xsIFNlbnNpdGl2aXR5JywgXCJTY3JvbGxpbmcgc3BlZWQgbXVsdGlwbGllciB3aGVuIHByZXNzaW5nIGBBbHRgLlwiKVxuXHRcdH0sXG5cdFx0W2RlZmF1bHRGaW5kTW9kZVNldHRpbmdLZXldOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnaGlnaGxpZ2h0JywgJ2ZpbHRlciddLFxuXHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRsb2NhbGl6ZSgnZGVmYXVsdEZpbmRNb2RlU2V0dGluZ0tleS5oaWdobGlnaHQnLCBcIkhpZ2hsaWdodCBlbGVtZW50cyB3aGVuIHNlYXJjaGluZy4gRnVydGhlciB1cCBhbmQgZG93biBuYXZpZ2F0aW9uIHdpbGwgdHJhdmVyc2Ugb25seSB0aGUgaGlnaGxpZ2h0ZWQgZWxlbWVudHMuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgnZGVmYXVsdEZpbmRNb2RlU2V0dGluZ0tleS5maWx0ZXInLCBcIkZpbHRlciBlbGVtZW50cyB3aGVuIHNlYXJjaGluZy5cIilcblx0XHRcdF0sXG5cdFx0XHRkZWZhdWx0OiAnaGlnaGxpZ2h0Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZGVmYXVsdEZpbmRNb2RlU2V0dGluZ0tleScsIFwiQ29udHJvbHMgdGhlIGRlZmF1bHQgZmluZCBtb2RlIGZvciBsaXN0cyBhbmQgdHJlZXMgaW4gdGhlIHdvcmtiZW5jaC5cIilcblx0XHR9LFxuXHRcdFtrZXlib2FyZE5hdmlnYXRpb25TZXR0aW5nS2V5XToge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ3NpbXBsZScsICdoaWdobGlnaHQnLCAnZmlsdGVyJ10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdGxvY2FsaXplKCdrZXlib2FyZE5hdmlnYXRpb25TZXR0aW5nS2V5LnNpbXBsZScsIFwiU2ltcGxlIGtleWJvYXJkIG5hdmlnYXRpb24gZm9jdXNlcyBlbGVtZW50cyB3aGljaCBtYXRjaCB0aGUga2V5Ym9hcmQgaW5wdXQuIE1hdGNoaW5nIGlzIGRvbmUgb25seSBvbiBwcmVmaXhlcy5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCdrZXlib2FyZE5hdmlnYXRpb25TZXR0aW5nS2V5LmhpZ2hsaWdodCcsIFwiSGlnaGxpZ2h0IGtleWJvYXJkIG5hdmlnYXRpb24gaGlnaGxpZ2h0cyBlbGVtZW50cyB3aGljaCBtYXRjaCB0aGUga2V5Ym9hcmQgaW5wdXQuIEZ1cnRoZXIgdXAgYW5kIGRvd24gbmF2aWdhdGlvbiB3aWxsIHRyYXZlcnNlIG9ubHkgdGhlIGhpZ2hsaWdodGVkIGVsZW1lbnRzLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ2tleWJvYXJkTmF2aWdhdGlvblNldHRpbmdLZXkuZmlsdGVyJywgXCJGaWx0ZXIga2V5Ym9hcmQgbmF2aWdhdGlvbiB3aWxsIGZpbHRlciBvdXQgYW5kIGhpZGUgYWxsIHRoZSBlbGVtZW50cyB3aGljaCBkbyBub3QgbWF0Y2ggdGhlIGtleWJvYXJkIGlucHV0LlwiKVxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6ICdoaWdobGlnaHQnLFxuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdrZXlib2FyZE5hdmlnYXRpb25TZXR0aW5nS2V5JywgXCJDb250cm9scyB0aGUga2V5Ym9hcmQgbmF2aWdhdGlvbiBzdHlsZSBmb3IgbGlzdHMgYW5kIHRyZWVzIGluIHRoZSB3b3JrYmVuY2guIENhbiBiZSBzaW1wbGUsIGhpZ2hsaWdodCBhbmQgZmlsdGVyLlwiKSxcblx0XHRcdGRlcHJlY2F0ZWQ6IHRydWUsXG5cdFx0XHRkZXByZWNhdGlvbk1lc3NhZ2U6IGxvY2FsaXplKCdrZXlib2FyZE5hdmlnYXRpb25TZXR0aW5nS2V5RGVwcmVjYXRlZCcsIFwiUGxlYXNlIHVzZSAnd29ya2JlbmNoLmxpc3QuZGVmYXVsdEZpbmRNb2RlJyBhbmRcdCd3b3JrYmVuY2gubGlzdC50eXBlTmF2aWdhdGlvbk1vZGUnIGluc3RlYWQuXCIpXG5cdFx0fSxcblx0XHRbZGVmYXVsdEZpbmRNYXRjaFR5cGVTZXR0aW5nS2V5XToge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ2Z1enp5JywgJ2NvbnRpZ3VvdXMnXSxcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bG9jYWxpemUoJ2RlZmF1bHRGaW5kTWF0Y2hUeXBlU2V0dGluZ0tleS5mdXp6eScsIFwiVXNlIGZ1enp5IG1hdGNoaW5nIHdoZW4gc2VhcmNoaW5nLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ2RlZmF1bHRGaW5kTWF0Y2hUeXBlU2V0dGluZ0tleS5jb250aWd1b3VzJywgXCJVc2UgY29udGlndW91cyBtYXRjaGluZyB3aGVuIHNlYXJjaGluZy5cIilcblx0XHRcdF0sXG5cdFx0XHRkZWZhdWx0OiAnZnV6enknLFxuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdkZWZhdWx0RmluZE1hdGNoVHlwZVNldHRpbmdLZXknLCBcIkNvbnRyb2xzIHRoZSB0eXBlIG9mIG1hdGNoaW5nIHVzZWQgd2hlbiBzZWFyY2hpbmcgbGlzdHMgYW5kIHRyZWVzIGluIHRoZSB3b3JrYmVuY2guXCIpXG5cdFx0fSxcblx0XHRbdHJlZUV4cGFuZE1vZGVdOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnc2luZ2xlQ2xpY2snLCAnZG91YmxlQ2xpY2snXSxcblx0XHRcdGRlZmF1bHQ6ICdzaW5nbGVDbGljaycsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2V4cGFuZCBtb2RlJywgXCJDb250cm9scyBob3cgdHJlZSBmb2xkZXJzIGFyZSBleHBhbmRlZCB3aGVuIGNsaWNraW5nIHRoZSBmb2xkZXIgbmFtZXMuIE5vdGUgdGhhdCBzb21lIHRyZWVzIGFuZCBsaXN0cyBtaWdodCBjaG9vc2UgdG8gaWdub3JlIHRoaXMgc2V0dGluZyBpZiBpdCBpcyBub3QgYXBwbGljYWJsZS5cIiksXG5cdFx0fSxcblx0XHRbdHJlZVN0aWNreVNjcm9sbF06IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3N0aWNreSBzY3JvbGwnLCBcIkNvbnRyb2xzIHdoZXRoZXIgc3RpY2t5IHNjcm9sbGluZyBpcyBlbmFibGVkIGluIHRyZWVzLlwiKSxcblx0XHR9LFxuXHRcdFt0cmVlU3RpY2t5U2Nyb2xsTWF4RWxlbWVudHNdOiB7XG5cdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdG1pbmltdW06IDEsXG5cdFx0XHRkZWZhdWx0OiA3LFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3N0aWNreSBzY3JvbGwgbWF4aW11bSBpdGVtcycsIFwiQ29udHJvbHMgdGhlIG51bWJlciBvZiBzdGlja3kgZWxlbWVudHMgZGlzcGxheWVkIGluIHRoZSB0cmVlIHdoZW4gezB9IGlzIGVuYWJsZWQuXCIsICdgI3dvcmtiZW5jaC50cmVlLmVuYWJsZVN0aWNreVNjcm9sbCNgJyksXG5cdFx0fSxcblx0XHRbdHlwZU5hdmlnYXRpb25Nb2RlU2V0dGluZ0tleV06IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydhdXRvbWF0aWMnLCAndHJpZ2dlciddLFxuXHRcdFx0ZGVmYXVsdDogJ2F1dG9tYXRpYycsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndHlwZU5hdmlnYXRpb25Nb2RlMicsIFwiQ29udHJvbHMgaG93IHR5cGUgbmF2aWdhdGlvbiB3b3JrcyBpbiBsaXN0cyBhbmQgdHJlZXMgaW4gdGhlIHdvcmtiZW5jaC4gV2hlbiBzZXQgdG8gYHRyaWdnZXJgLCB0eXBlIG5hdmlnYXRpb24gYmVnaW5zIG9uY2UgdGhlIGBsaXN0LnRyaWdnZXJUeXBlTmF2aWdhdGlvbmAgY29tbWFuZCBpcyBydW4uXCIpLFxuXHRcdH1cblx0fVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsaUJBQWlCLHVCQUF1QjtBQUdqRCxTQUE0QyxpQkFBaUI7QUFDN0QsU0FBa0osNkJBQTZCLDhCQUE4QixNQUFNLDBCQUEwQjtBQUU3TyxTQUEyRCxhQUFhO0FBQ3hFLFNBQStFLG1CQUFtQixvQkFBb0I7QUFDdEgsU0FBUyxlQUFlLGlDQUEyTDtBQUNuTixTQUFTLGdCQUFrQztBQUMzQyxTQUFTLHdCQUE2SSxrQkFBa0I7QUFFeEssU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxvQkFBb0IsWUFBWSxpQkFBaUIsU0FBc0Isb0JBQW9CO0FBQ3BHLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsY0FBYywrQkFBdUQ7QUFDOUUsU0FBUyxnQkFBNkIsb0JBQThDLHFCQUFxQjtBQUN6RyxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLDJCQUEyQjtBQUVwQyxTQUFTLGlCQUFpQiw2QkFBK0M7QUFDekUsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx5QkFBeUIsbUJBQW1CLHFCQUFxQztBQUtuRixNQUFNLGVBQWUsZ0JBQThCLGFBQWE7QUFpQmhFLE1BQU0sWUFBb0M7QUFBQSxFQVloRCxjQUFjO0FBUmQsU0FBaUIsY0FBYyxJQUFJLGdCQUFnQjtBQUNuRCxTQUFRLFFBQTJCLENBQUM7QUFDcEMsU0FBUSxxQkFBc0Q7QUFBQSxFQU05QztBQUFBLEVBSmhCLElBQUksa0JBQW1EO0FBQ3RELFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUlRLG1CQUFtQixRQUErQztBQUN6RSxRQUFJLFdBQVcsS0FBSyxvQkFBb0I7QUFDdkM7QUFBQSxJQUNEO0FBRUEsU0FBSyxvQkFBb0IsZUFBZSxFQUFFLFVBQVUsT0FBTyxjQUFjO0FB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
