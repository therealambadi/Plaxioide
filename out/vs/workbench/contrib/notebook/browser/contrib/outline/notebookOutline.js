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
import { localize } from "../../../../../../nls.js";
import * as DOM from "../../../../../../base/browser/dom.js";
import { ToolBar } from "../../../../../../base/browser/ui/toolbar/toolbar.js";
import { IconLabel } from "../../../../../../base/browser/ui/iconLabel/iconLabel.js";
import { Emitter } from "../../../../../../base/common/event.js";
import { createMatches } from "../../../../../../base/common/filters.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../../base/common/themables.js";
import { getIconClassesForLanguageId } from "../../../../../../editor/common/services/getIconClasses.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { Extensions as ConfigurationExtensions } from "../../../../../../platform/configuration/common/configurationRegistry.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { MarkerSeverity } from "../../../../../../platform/markers/common/markers.js";
import { Registry } from "../../../../../../platform/registry/common/platform.js";
import { listErrorForeground, listWarningForeground } from "../../../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../../../platform/theme/common/themeService.js";
import { Extensions as WorkbenchExtensions } from "../../../../../common/contributions.js";
import { CellFoldingState, CellRevealType } from "../../notebookBrowser.js";
import { NotebookEditor } from "../../notebookEditor.js";
import { CellKind, NotebookCellsChangeType, NotebookSetting } from "../../../common/notebookCommon.js";
import { IEditorService, SIDE_GROUP } from "../../../../../services/editor/common/editorService.js";
import { LifecyclePhase } from "../../../../../services/lifecycle/common/lifecycle.js";
import { IOutlineService, OutlineConfigCollapseItemsValues, OutlineConfigKeys, OutlineTarget } from "../../../../../services/outline/browser/outline.js";
import { CancellationToken } from "../../../../../../base/common/cancellation.js";
import { Range } from "../../../../../../editor/common/core/range.js";
import { mainWindow } from "../../../../../../base/browser/window.js";
import { IContextMenuService } from "../../../../../../platform/contextview/browser/contextView.js";
import { Action2, IMenuService, MenuId, MenuItemAction, MenuRegistry, registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../../../platform/contextkey/common/contextkey.js";
import { MenuEntryActionViewItem, getActionBarActions } from "../../../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Delayer, disposableTimeout } from "../../../../../../base/common/async.js";
import { IOutlinePane } from "../../../../outline/browser/outline.js";
import { Codicon } from "../../../../../../base/common/codicons.js";
import { NOTEBOOK_IS_ACTIVE_EDITOR } from "../../../common/notebookContextKeys.js";
import { NotebookOutlineConstants } from "../../viewModel/notebookOutlineEntryFactory.js";
import { INotebookCellOutlineDataSourceFactory } from "../../viewModel/notebookOutlineDataSourceFactory.js";
import { INotebookExecutionStateService, NotebookExecutionType } from "../../../common/notebookExecutionStateService.js";
import { ILanguageFeaturesService } from "../../../../../../editor/common/services/languageFeatures.js";
class NotebookOutlineTemplate {
  constructor(container, iconClass, iconLabel, decoration, actionMenu, elementDisposables) {
    this.container = container;
    this.iconClass = iconClass;
    this.iconLabel = iconLabel;
    this.decoration = decoration;
    this.actionMenu = actionMenu;
    this.elementDisposables = elementDisposables;
  }
}
NotebookOutlineTemplate.templateId = "NotebookOutlineRenderer";
let NotebookOutlineRenderer = class {
  constructor(_editor, _target, _themeService, _configurationService, _contextMenuService, _contextKeyService, _menuService, _instantiationService) {
    this._editor = _editor;
    this._target = _target;
    this._themeService = _themeService;
    this._configurationService = _configurationService;
    this._contextMenuService = _contextMenuService;
    this._contextKeyService = _contextKeyService;
    this._menuService = _menuService;
    this._instantiationService = _instantiationService;
    this.templateId = NotebookOutlineTemplate.templateId;
  }
  renderTemplate(container) {
    const elementDisposables = new DisposableStore();
    container.classList.add("notebook-outline-element", "show-file-icons");
    const iconClass = document.createElement("div");
    container.append(iconClass);
    const iconLabel = new IconLabel(container, { supportHighlights: true });
    const decoration = document.createElement("div");
    decoration.className = "element-decoration";
    container.append(decoration);
    const actionMenu = document.createElement("div");
    actionMenu.className = "action-menu";
    container.append(actionMenu);
    return new NotebookOutlineTemplate(container, iconClass, iconLabel, decoration, actionMenu, elementDisposables);
  }
  renderElement(node, _index, template, _height) {
    const extraClasses = [];
    const options = {
      matches: createMatches(node.filterData),
      labelEscapeNewLines: true,
      extraClasses
    };
    const isCodeCell = node.element.cell.cellKind === CellKind.Code;
    if (node.element.level >= 8) {
      template.iconClass.className = "element-icon " + ThemeIcon.asClassNameArray(node.element.icon).join(" ");
    } else if (isCodeCell && this._themeService.getFileIconTheme().hasFileIcons && !node.element.isExecuting) {
      template.iconClass.className = "";
      extraClasses.push(...getIconClassesForLanguageId(node.element.cell.language ?? ""));
    } else {
      template.iconClass.className = "element-icon " + ThemeIcon.asClassNameArray(node.element.icon).join(" ");
    }
    template.iconLabel.setLabel(" " + node.element.label, void 0, options);
    const { markerInfo } = node.element;
    template.container.style.removeProperty("--outline-element-color");
    template.decoration.innerText = "";
    if (markerInfo) {
      const problem = this._configurationService.getValue("problems.visibility");
      const useBadges = this._configurationService.getValue(OutlineConfigKeys.problemsBadges);
      if (!useBadges || !problem) {
        template.decoration.classList.remove("bubble");
        template.decoration.innerText = "";
      } else if (markerInfo.count === 0) {
        template.decoration.classList.add("bubble");
        template.decoration.innerText = "\uEA71";
      } else {
        template.decoration.classList.remove("bubble");
        template.decoration.innerText = markerInfo.count > 9 ? "9+" : String(markerInfo.count);
      }
      const color = this._themeService.getColorTheme().getColor(markerInfo.topSev === MarkerSeverity.Error ? listErrorForeground : listWarningForeground);
      if (problem === void 0) {
        return;
      }
      const useColors = this._configurationService.getValue(OutlineConfigKeys.problemsColors);
      if (!useColors || !problem) {
        template.container.style.removeProperty("--outline-element-color");
        template.decoration.style.setProperty("--outline-element-color", color?.toString() ?? "inherit");
      } else {
        template.container.style.setProperty("--outline-element-color", color?.toString() ?? "inherit");
      }
    }
    if (this._target === OutlineTarget.OutlinePane) {
      if (!this._editor) {
        return;
      }
      const nbCell = node.element.cell;
      const nbViewModel = this._editor.getViewModel();
      if (!nbViewModel) {
        return;
      }
      const idx = nbViewModel.getCellIndex(nbCell);
      const length = isCodeCell ? 0 : nbViewModel.getFoldedLength(idx);
      const scopedContextKeyService = template.elementDisposables.add(this._contextKeyService.createScoped(template.container));
      NotebookOutlineContext.CellKind.bindTo(scopedContextKeyService).set(isCodeCell ? CellKind.Code : CellKind.Markup);
      NotebookOutlineContext.CellHasChildren.bindTo(scopedContextKeyService).set(length > 0);
      NotebookOutlineContext.CellHasHeader.bindTo(scopedContextKeyService).set(node.element.level !== NotebookOutlineConstants.NonHeaderOutlineLevel);
      NotebookOutlineContext.OutlineElementTarget.bindTo(scopedContextKeyService).set(this._target);
      this.setupFolding(isCodeCell, nbViewModel, scopedContextKeyService, template, nbCell);
      const outlineEntryToolbar = template.elementDisposables.add(new ToolBar(template.actionMenu, this._contextMenuService, {
        actionViewItemProvider: (action) => {
          if (action instanceof MenuItemAction) {
            return this._instantiationService.createInstance(MenuEntryActionViewItem, action, void 0);
          }
          return void 0;
        }
      }));
      const menu = template.elementDisposables.add(this._menuService.createMenu(MenuId.NotebookOutlineActionMenu, scopedContextKeyService));
      const actions = getOutlineToolbarActions(menu, { notebookEditor: this._editor, outlineEntry: node.element });
      outlineEntryToolbar.setActions(actions.primary, actions.secondary);
      this.setupToolbarListeners(this._editor, outlineEntryToolbar, menu, actions, node.element, template);
      template.actionMenu.style.padding = "0 0.8em 0 0.4em";
    }
  }
  disposeTemplate(templateData) {
    templateData.iconLabel.dispose();
    templateData.elementDisposables.dispose();
  }
  disposeElement(element, index, templateData, height) {
    templateData.elementDisposables.clear();
    DOM.clearNode(templateData.actionMenu);
  }
  setupFolding(isCodeCell, nbViewModel, scopedContextKeyService, template, nbCell) {
    const foldingState = isCodeCell ? CellFoldingState.None : nbCell.foldingState;
    const foldingStateCtx = NotebookOutlineContext.CellFoldingState.bindTo(scopedContextKeyService);
    foldingStateCtx.set(foldingState);
    if (!isCodeCell) {
      template.elementDisposables.add(nbViewModel.onDidFoldingStateChanged(() => {
        const foldingState2 = nbCell.foldingState;
        NotebookOutlineContext.CellFoldingState.bindTo(scopedContextKeyService).set(foldingState2);
        foldingStateCtx.set(foldingState2);
      }));
    }
  }
  setupToolbarListeners(editor, toolbar, menu, initActions, entry, templateData) {
    let dropdownIsVisible = false;
    let deferredUpdate;
    toolbar.setActions(initActions.primary, initActions.secondary);
    templateData.elementDisposables.add(menu.onDidChange(() => {
      if (dropdownIsVisible) {
        const actions2 = getOutlineToolbarActions(menu, { notebookEditor: editor, outlineEntry: entry });
        deferredUpdate = () => toolbar.setActions(actions2.primary, actions2.secondary);
        return;
      }
      const actions = getOutlineToolbarActions(menu, { notebookEditor: editor, outlineEntry: entry });
      toolbar.setActions(actions.primary, actions.secondary);
    }));
    templateData.container.classList.remove("notebook-outline-toolbar-dropdown-active");
    templateData.elementDisposables.add(toolbar.onDidChangeDropdownVisibility((visible) => {
      dropdownIsVisible = visible;
      if (visible) {
        templateData.container.classList.add("notebook-outline-toolbar-dropdown-active");
      } else {
        templateData.container.classList.remove("notebook-outline-toolbar-dropdown-active");
      }
      if (deferredUpdate && !visible) {
        disposableTimeout(() => {
          deferredUpdate?.();
        }, 0, templateData.elementDisposables);
        deferredUpdate = void 0;
      }
    }));
  }
};
NotebookOutlineRenderer = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IContextKeyService),
  __decorateParam(6, IMenuService),
  __decorateParam(7, IInstantiationService)
], NotebookOutlineRenderer);
function getOutlineToolbarActions(menu, args) {
  return getActionBarActions(menu.getActions({ shouldForwardArgs: true, arg: args }), (g) => /^inline/.test(g));
}
class NotebookOutlineAccessibility {
  getAriaLabel(element) {
    return element.label;
  }
  getWidgetAriaLabel() {
    return "";
  }
}
class NotebookNavigationLabelProvider {
  getKeyboardNavigationLabel(element) {
    return element.label;
  }
}
class NotebookOutlineVirtualDelegate {
  getHeight(_element) {
    return 22;
  }
  getTemplateId(_element) {
    return NotebookOutlineTemplate.templateId;
  }
}
let NotebookQuickPickProvider = class {
  constructor(notebookCellOutlineDataSourceRef, _configurationService, _themeService) {
    this.notebookCellOutlineDataSourceRef = notebookCellOutlineDataSourceRef;
    this._configurationService = _configurationService;
    this._themeService = _themeService;
    this._disposables = new DisposableStore();
    this.gotoShowCodeCellSymbols = this._configurationService.getValue(NotebookSetting.gotoSymbolsAllSymbols);
    this._disposables.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(NotebookSetting.gotoSymbolsAllSymbols)) {
        this.gotoShowCodeCellSymbols = this._configurationService.getValue(NotebookSetting.gotoSymbolsAllSymbols);
      }
    }));
  }
  getQuickPickElements() {
    const bucket = [];
    for (const entry of this.notebookCellOutlineDataSourceRef?.object?.entries ?? []) {
      entry.asFlatList(bucket);
    }
    const result = [];
    const { hasFileIcons } = this._themeService.getFileIconTheme();
    const isSymbol = (element) => !!element.symbolKind;
    const isCodeCell = (element) => element.cell.cellKind === CellKind.Code && element.level === NotebookOutlineConstants.NonHeaderOutlineLevel;
    for (let i = 0; i < bucket.length; i++) {
      const element = bucket[i];
      const nextElement = bucket[i + 1];
      if (!this.gotoShowCodeCellSymbols && isSymbol(element)) {
        continue;
      }
      if (this.gotoShowCodeCellSymbols && isCodeCell(element) && nextElement && isSymbol(nextElement)) {
        continue;
      }
      const useFileIcon = hasFileIcons && !element.symbolKind;
      result.push({
        element,
        label: useFileIcon ? element.label : `$(${element.icon.id}) ${element.label}`,
        ariaLabel: element.label,
        iconClasses: useFileIcon ? getIconClassesForLanguageId(element.cell.language ?? "") : void 0
      });
    }
    return result;
  }
  dispose() {
    this._disposables.dispose();
  }
};
NotebookQuickPickProvider = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IThemeService)
], NotebookQuickPickProvider);
function filterEntry(entry, showMarkdownHeadersOnly, showCodeCells, showCodeCellSymbols) {
  if (showMarkdownHeadersOnly && entry.cell.cellKind === CellKind.Markup && entry.level === NotebookOutlineConstants.NonHeaderOutlineLevel || // show headers only   + cell is mkdn + is level 7 (not header)
  !showCodeCells && entry.cell.cellKind === CellKind.Code || // show code cells off + cell is code
  !showCodeCellSymbols && entry.cell.cellKind === CellKind.Code && entry.level > NotebookOutlineConstants.NonHeaderOutlineLevel) {
    return true;
  }
  return false;
}
let NotebookOutlinePaneProvider = class {
  constructor(outlineDataSourceRef, _configurationService) {
    this.outlineDataSourceRef = outlineDataSourceRef;
    this._configurationService = _configurationService;
    this._disposables = new DisposableStore();
    this.showCodeCells = this._configurationService.getValue(NotebookSetting.outlineShowCodeCells);
    this.showCodeCellSymbols = this._configurationService.getValue(NotebookSetting.outlineShowCodeCellSymbols);
    this.showMarkdownHeadersOnly = this._configurationService.getValue(NotebookSetting.outlineShowMarkdownHeadersOnly);
    this._disposables.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(NotebookSetting.outlineShowCodeCells)) {
        this.showCodeCells = this._configurationService.getValue(NotebookSetting.outlineShowCodeCells);
      }
      if (e.affectsConfiguration(NotebookSetting.outlineShowCodeCellSymbols)) {
        this.showCodeCellSymbols = this._configurationService.getValue(NotebookSetting.outlineShowCodeCellSymbols);
      }
      if (e.affectsConfiguration(NotebookSetting.outlineShowMarkdownHeadersOnly)) {
        this.showMarkdownHeadersOnly = this._configurationService.getValue(NotebookSetting.outlineShowMarkdownHeadersOnly);
      }
    }));
  }
  getActiveEntry() {
    const newActive = this.outlineDataSourceRef?.object?.activeElement;
    if (!newActive) {
      return void 0;
    }
    if (!filterEntry(newActive, this.showMarkdownHeadersOnly, this.showCodeCells, this.showCodeCellSymbols)) {
      return newActive;
    }
    let parent = newActive.parent;
    while (parent) {
      if (filterEntry(parent, this.showMarkdownHeadersOnly, this.showCodeCells, this.showCodeCellSymbols)) {
        parent = parent.parent;
      } else {
        return parent;
      }
    }
    return void 0;
  }
  *getChildren(element) {
    const isOutline = element instanceof NotebookCellOutline;
    const entries = isOutline ? this.outlineDataSourceRef?.object?.entries ?? [] : element.children;
    for (const entry of entries) {
      if (entry.cell.cellKind === CellKind.Markup) {
        if (!this.showMarkdownHeadersOnly) {
          yield entry;
        } else if (entry.level < NotebookOutlineConstants.NonHeaderOutlineLevel) {
          yield entry;
        }
      } else if (this.showCodeCells && entry.cell.cellKind === CellKind.Code) {
        if (this.showCodeCellSymbols) {
          yield entry;
        } else if (entry.level === NotebookOutlineConstants.NonHeaderOutlineLevel) {
          yield entry;
        }
      }
    }
  }
  dispose() {
    this._disposables.dispose();
  }
};
NotebookOutlinePaneProvider = __decorateClass([
  __decorateParam(1, IConfigurationService)
], NotebookOutlinePaneProvider);
let NotebookBreadcrumbsProvider = class {
  constructor(outlineDataSourceRef, _configurationService) {
    this.outlineDataSourceRef = outlineDataSourceRef;
    this._configurationService = _configurationService;
    this._disposables = new DisposableStore();
    this.showCodeCells = this._configurationService.getValue(NotebookSetting.breadcrumbsShowCodeCells);
    this._disposables.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(NotebookSetting.breadcrumbsShowCodeCells)) {
        this.showCodeCells = this._configurationService.getValue(NotebookSetting.breadcrumbsShowCodeCells);
      }
    }));
  }
  getBreadcrumbElements() {
    const result = [];
    let candidate = this.outlineDataSourceRef?.object?.activeElement;
    while (candidate) {
      if (this.showCodeCells || candidate.cell.cellKind !== CellKind.Code) {
        result.unshift(candidate);
      }
      candidate = candidate.parent;
    }
    return result;
  }
  dispose() {
    this._disposables.dispose();
  }
};
NotebookBreadcrumbsProvider = __decorateClass([
  __decorateParam(1, IConfigurationService)
], NotebookBreadcrumbsProvider);
class NotebookComparator {
  constructor() {
    this._collator = new DOM.WindowIdleValue(mainWindow, () => new Intl.Collator(void 0, { numeric: true }));
  }
  compareByPosition(a, b) {
    return a.index - b.index;
  }
  compareByType(a, b) {
    return a.cell.cellKind - b.cell.cellKind || this._collator.value.compare(a.label, b.label);
  }
  compareByName(a, b) {
    return this._collator.value.compare(a.label, b.label);
  }
}
let NotebookCellOutline = class {
  constructor(_editor, _target, _themeService, _editorService, _instantiationService, _configurationService, _languageFeaturesService, _notebookExecutionStateService) {
    this._editor = _editor;
    this._target = _target;
    this._themeService = _themeService;
    this._editorService = _editorService;
    this._instantiationService = _instantiationService;
    this._configurationService = _configurationService;
    this._languageFeaturesService = _languageFeaturesService;
    this._notebookExecutionStateService = _notebookExecutionStateService;
    this.outlineKind = "notebookCells";
    this._disposables = new DisposableStore();
    this._modelDisposables = new DisposableStore();
    this._dataSourceDisposables = new DisposableStore();
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this.delayerRecomputeState = this._disposables.add(new Delayer(300));
    this.delayerRecomputeActive = this._disposables.add(new Delayer(200));
    // this can be long, because it will force a recompute at the end, so ideally we only do this once all nb language features are registered
    this.delayerRecomputeSymbols = this._disposables.add(new Delayer(2e3));
    this.outlineShowCodeCells = this._configurationService.getValue(NotebookSetting.outlineShowCodeCells);
    this.outlineShowCodeCellSymbols = this._configurationService.getValue(NotebookSetting.outlineShowCodeCellSymbols);
    this.outlineShowMarkdownHeadersOnly = this._configurationService.getValue(NotebookSetting.outlineShowMarkdownHeadersOnly);
    this.initializeOutline();
    const delegate = new NotebookOutlineVirtualDelegate();
    const renderers = [this._instantiationService.createInstance(NotebookOutlineRenderer, this._editor.getControl(), this._target)];
    const comparator = new NotebookComparator();
    const options = {
      collapseByDefault: this._target === OutlineTarget.Breadcrumbs || this._target === OutlineTarget.OutlinePane && this._configurationService.getValue(OutlineConfigKeys.collapseItems) === OutlineConfigCollapseItemsValues.Collapsed,
      expandOnlyOnTwistieClick: true,
      multipleSelectionSupport: false,
      accessibilityProvider: new NotebookOutlineAccessibility(),
      identityProvider: { getId: (element) => element.cell.uri.toString() },
      keyboardNavigationLabelProvider: new NotebookNavigationLabelProvider()
    };
    this.config = {
      treeDataSource: this._treeDataSource,
      quickPickDataSource: this._quickPickDataSource,
      breadcrumbsDataSource: this._breadcrumbsDataSource,
      delegate,
      renderers,
      comparator,
      options
    };
  }
  // getters
  get activeElement() {
    this.checkDelayer();
    if (this._target === OutlineTarget.OutlinePane) {
      return this.config.treeDataSource.getActiveEntry();
    } else {
      console.error("activeElement should not be called outside of the OutlinePane");
      return void 0;
    }
  }
  get entries() {
    this.checkDelayer();
    return this._outlineDataSourceReference?.object?.entries ?? [];
  }
  get uri() {
    return this._outlineDataSourceReference?.object?.uri;
  }
  get isEmpty() {
    if (!this._outlineDataSourceReference?.object?.entries) {
      return true;
    }
    return !this._outlineDataSourceReference.object.entries.some((entry) => {
      return !filterEntry(entry, this.outlineShowMarkdownHeadersOnly, this.outlineShowCodeCells, this.outlineShowCodeCellSymbols);
    });
  }
  checkDelayer() {
    if (this.delayerRecomputeState.isTriggered()) {
      this.delayerRecomputeState.cancel();
      this.recomputeState();
    }
  }
  initializeOutline() {
    this.setDataSources();
    this.setModelListeners();
    this._disposables.add(this._editor.onDidChangeModel(() => {
      this.setDataSources();
      this.setModelListeners();
      this.computeSymbols();
    }));
    this._disposables.add(this._languageFeaturesService.documentSymbolProvider.onDidChange(() => {
      this.delayedComputeSymbols();
    }));
    this._disposables.add(this._editor.onDidChangeSelection(() => {
      this.delayedRecomputeActive();
    }));
    this._disposables.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(NotebookSetting.outlineShowMarkdownHeadersOnly) || e.affectsConfiguration(NotebookSetting.outlineShowCodeCells) || e.affectsConfiguration(NotebookSetting.outlineShowCodeCellSymbols) || e.affectsConfiguration(NotebookSetting.breadcrumbsShowCodeCells)) {
        this.outlineShowCodeCells = this._configurationService.getValue(NotebookSetting.outlineShowCodeCells);
        this.outlineShowCodeCellSymbols = this._configurationService.getValue(NotebookSetting.outlineShowCodeCellSymbols);
        this.outlineShowMarkdownHeadersOnly = this._configurationService.getValue(NotebookSetting.outlineShowMarkdownHeadersOnly);
        this.delayedRecomputeState();
      }
    }));
    this._disposables.add(this._notebookExecutionStateService.onDidChangeExecution((e) => {
      if (e.type === NotebookExecutionType.cell && !!this._editor.textModel && e.affectsNotebook(this._editor.textModel?.uri)) {
        this.delayedRecomputeState();
      }
    }));
    this._disposables.add(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(NotebookSetting.outlineShowCodeCellSymbols)) {
        this.outlineShowCodeCellSymbols = this._configurationService.getValue(NotebookSetting.outlineShowCodeCellSymbols);
        this.computeSymbols();
      }
    }));
    this._disposables.add(this._themeService.onDidFileIconThemeChange(() => {
      this._onDidChange.fire({});
    }));
    this.recomputeState();
  }
  /**
   * set up the primary data source + three viewing sources for the various outline views
   */
  setDataSources() {
    const notebookEditor = this._editor.getControl();
    this._outlineDataSourceReference?.dispose();
    this._dataSourceDisposables.clear();
    if (!notebookEditor?.hasModel()) {
      this._outlineDataSourceReference = void 0;
    } else {
      this._outlineDataSourceReference = this._dataSourceDisposables.add(this._instantiationService.invokeFunction((accessor) => accessor.get(INotebookCellOutlineDataSourceFactory).getOrCreate(notebookEditor)));
      this._dataSourceDisposables.add(this._outlineDataSourceReference.object.onDidChange(() => {
        this._onDidChange.fire({});
      }));
    }
    this._treeDataSource = this._dataSourceDisposables.add(this._instantiationService.createInstance(NotebookOutlinePaneProvider, this._outlineDataSourceReference));
    this._quickPickDataSource = this._dataSourceDisposables.add(this._instantiationService.createInstance(NotebookQuickPickProvider, this._outlineDataSourceReference));
    this._breadcrumbsDataSource = this._dataSourceDisposables.add(this._instantiationService.createInstance(NotebookBreadcrumbsProvider, this._outlineDataSourceReference));
  }
  /**
   * set up the listeners for the outline content, these respond to model changes in the notebook
   */
  setModelListeners() {
    this._modelDisposables.clear();
    if (!this._editor.textModel) {
      return;
    }
    if (!this.entries.length) {
      this.computeSymbols();
    }
    this._modelDisposables.add(this._editor.textModel.onDidChangeContent((contentChanges) => {
      if (contentChanges.rawEvents.some((c) => c.kind === NotebookCellsChangeType.ChangeCellContent || c.kind === NotebookCellsChangeType.ChangeCellInternalMetadata || c.kind === NotebookCellsChangeType.Move || c.kind === NotebookCellsChangeType.ModelChange)) {
        this.delayedRecomputeState();
      }
    }));
  }
  async computeSymbols(cancelToken = CancellationToken.None) {
    if (this._target === OutlineTarget.OutlinePane && this.outlineShowCodeCellSymbols) {
      void this.doComputeSymbols(cancelToken);
    }
  }
  async doComputeSymbols(cancelToken) {
    await this._outlineDataSourceReference?.object?.computeFullSymbols(cancelToken);
  }
  async delayedComputeSymbols() {
    this.delayerRecomputeState.cancel();
    this.delayerRecomputeActive.cancel();
    this.delayerRecomputeSymbols.trigger(() => {
      this.computeSymbols();
    });
  }
  recomputeState() {
    this._outlineDataSourceReference?.object?.recomputeState();
  }
  delayedRecomputeState() {
    this.delayerRecomputeActive.cancel();
    this.delayerRecomputeState.trigger(() => {
      this.recomputeState();
    });
  }
  recomputeActive() {
    this._outlineDataSourceReference?.object?.recomputeActive();
  }
  delayedRecomputeActive() {
    this.delayerRecomputeActive.trigger(() => {
      this.recomputeActive();
    });
  }
  async reveal(entry, options, sideBySide) {
    const notebookEditorOptions = {
      ...options,
      override: this._editor.input?.editorId,
      cellRevealType: CellRevealType.NearTopIfOutsideViewport,
      selection: entry.position,
      viewState: void 0
    };
    await this._editorService.openEditor({
      resource: entry.cell.uri,
      options: notebookEditorOptions
    }, sideBySide ? SIDE_GROUP : void 0);
  }
  preview(entry) {
    const widget = this._editor.getControl();
    if (!widget) {
      return Disposable.None;
    }
    if (entry.range) {
      const range = Range.lift(entry.range);
      widget.revealRangeInCenterIfOutsideViewportAsync(entry.cell, range);
    } else {
      widget.revealInCenterIfOutsideViewport(entry.cell);
    }
    const ids = widget.deltaCellDecorations([], [{
      handle: entry.cell.handle,
      options: { className: "nb-symbolHighlight", outputClassName: "nb-symbolHighlight" }
    }]);
    let editorDecorations;
    widget.changeModelDecorations((accessor) => {
      if (entry.range) {
        const decorations = [
          {
            range: entry.range,
            options: {
              description: "document-symbols-outline-range-highlight",
              className: "rangeHighlight",
              isWholeLine: true
            }
          }
        ];
        const deltaDecoration = {
          ownerId: entry.cell.handle,
          decorations
        };
        editorDecorations = accessor.deltaDecorations([], [deltaDecoration]);
      }
    });
    return toDisposable(() => {
      widget.deltaCellDecorations(ids, []);
      if (editorDecorations?.length) {
        widget.changeModelDecorations((accessor) => {
          accessor.deltaDecorations(editorDecorations, []);
        });
      }
    });
  }
  captureViewState() {
    const widget = this._editor.getControl();
    const viewState = widget?.getEditorViewState();
    return toDisposable(() => {
      if (viewState) {
        widget?.restoreListViewState(viewState);
      }
    });
  }
  dispose() {
    this._onDidChange.dispose();
    this._disposables.dispose();
    this._modelDisposables.dispose();
    this._dataSourceDisposables.dispose();
    this._outlineDataSourceReference?.dispose();
  }
};
NotebookCellOutline = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, ILanguageFeaturesService),
  __decorateParam(7, INotebookExecutionStateService)
], NotebookCellOutline);
let NotebookOutlineCreator = class {
  constructor(outlineService, _instantiationService) {
    this._instantiationService = _instantiationService;
    const reg = outlineService.registerOutlineCreator(this);
    this.dispose = () => reg.dispose();
  }
  matches(candidate) {
    return candidate.getId() === NotebookEditor.ID;
  }
  async createOutline(editor, target, cancelToken) {
    const outline = this._instantiationService.createInstance(NotebookCellOutline, editor, target);
    if (target === OutlineTarget.QuickPick) {
      await outline.doComputeSymbols(cancelToken);
    }
    return outline;
  }
};
NotebookOutlineCreator = __decorateClass([
  __decorateParam(0, IOutlineService),
  __decorateParam(1, IInstantiationService)
], NotebookOutlineCreator);
const NotebookOutlineContext = {
  CellKind: new RawContextKey("notebookCellKind", void 0),
  CellHasChildren: new RawContextKey("notebookCellHasChildren", false),
  CellHasHeader: new RawContextKey("notebookCellHasHeader", false),
  CellFoldingState: new RawContextKey("notebookCellFoldingState", CellFoldingState.None),
  OutlineElementTarget: new RawContextKey("notebookOutlineElementTarget", void 0)
};
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(NotebookOutlineCreator, LifecyclePhase.Eventually);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  id: "notebook",
  order: 100,
  type: "object",
  "properties": {
    [NotebookSetting.outlineShowMarkdownHeadersOnly]: {
      type: "boolean",
      default: true,
      markdownDescription: localize("outline.showMarkdownHeadersOnly", "When enabled, notebook outline will show only markdown cells containing a header.")
    },
    [NotebookSetting.outlineShowCodeCells]: {
      type: "boolean",
      default: false,
      markdownDescription: localize("outline.showCodeCells", "When enabled, notebook outline shows code cells.")
    },
    [NotebookSetting.outlineShowCodeCellSymbols]: {
      type: "boolean",
      default: true,
      markdownDescription: localize("outline.showCodeCellSymbols", "When enabled, notebook outline shows code cell symbols. Relies on `notebook.outline.showCodeCells` being enabled.")
    },
    [NotebookSetting.breadcrumbsShowCodeCells]: {
      type: "boolean",
      default: true,
      markdownDescription: localize("breadcrumbs.showCodeCells", "When enabled, notebook breadcrumbs contain code cells.")
    },
    [NotebookSetting.gotoSymbolsAllSymbols]: {
      type: "boolean",
      default: true,
      markdownDescription: localize("notebook.gotoSymbols.showAllSymbols", "When enabled, the Go to Symbol Quick Pick will display full code symbols from the notebook, as well as Markdown headers.")
    }
  }
});
MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
  submenu: MenuId.NotebookOutlineFilter,
  title: localize("filter", "Filter Entries"),
  icon: Codicon.filter,
  group: "navigation",
  order: -1,
  when: ContextKeyExpr.and(ContextKeyExpr.equals("view", IOutlinePane.Id), NOTEBOOK_IS_ACTIVE_EDITOR)
});
registerAction2(class ToggleShowMarkdownHeadersOnly extends Action2 {
  constructor() {
    super({
      id: "notebook.outline.toggleShowMarkdownHeadersOnly",
      title: localize("toggleShowMarkdownHeadersOnly", "Markdown Headers Only"),
      f1: false,
      toggled: {
        condition: ContextKeyExpr.equals("config.notebook.outline.showMarkdownHeadersOnly", true)
      },
      menu: {
        id: MenuId.NotebookOutlineFilter,
        group: "0_markdown_cells"
      }
    });
  }
  run(accessor, ...args) {
    const configurationService = accessor.get(IConfigurationService);
    const showMarkdownHeadersOnly = configurationService.getValue(NotebookSetting.outlineShowMarkdownHeadersOnly);
    configurationService.updateValue(NotebookSetting.outlineShowMarkdownHeadersOnly, !showMarkdownHeadersOnly);
  }
});
registerAction2(class ToggleCodeCellEntries extends Action2 {
  constructor() {
    super({
      id: "notebook.outline.toggleCodeCells",
      title: localize("toggleCodeCells", "Code Cells"),
      f1: false,
      toggled: {
        condition: ContextKeyExpr.equals("config.notebook.outline.showCodeCells", true)
      },
      menu: {
        id: MenuId.NotebookOutlineFilter,
        order: 1,
        group: "1_code_cells"
      }
    });
  }
  run(accessor, ...args) {
    const configurationService = accessor.get(IConfigurationService);
    const showCodeCells = configurationService.getValue(NotebookSetting.outlineShowCodeCells);
    configurationService.updateValue(NotebookSetting.outlineShowCodeCells, !showCodeCells);
  }
});
registerAction2(class ToggleCodeCellSymbolEntries extends Action2 {
  constructor() {
    super({
      id: "notebook.outline.toggleCodeCellSymbols",
      title: localize("toggleCodeCellSymbols", "Code Cell Symbols"),
      f1: false,
      toggled: {
        condition: ContextKeyExpr.equals("config.notebook.outline.showCodeCellSymbols", true)
      },
      menu: {
        id: MenuId.NotebookOutlineFilter,
        order: 2,
        group: "1_code_cells"
      }
    });
  }
  run(accessor, ...args) {
    const configurationService = accessor.get(IConfigurationService);
    const showCodeCellSymbols = configurationService.getValue(NotebookSetting.outlineShowCodeCellSymbols);
    configurationService.updateValue(NotebookSetting.outlineShowCodeCellSymbols, !showCodeCellSymbols);
  }
});
export {
  NotebookBreadcrumbsProvider,
  NotebookCellOutline,
  NotebookOutlineContext,
  NotebookOutlineCreator,
  NotebookOutlinePaneProvider,
  NotebookQuickPickProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyaWIvb3V0bGluZS9ub3RlYm9va091dGxpbmUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgKiBhcyBET00gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBUb29sQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Rvb2xiYXIvdG9vbGJhci5qcyc7XG5pbXBvcnQgeyBJSWNvbkxhYmVsVmFsdWVPcHRpb25zLCBJY29uTGFiZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaWNvbkxhYmVsL2ljb25MYWJlbC5qcyc7XG5pbXBvcnQgeyBJS2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlciwgSUxpc3RWaXJ0dWFsRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdFdpZGdldC5qcyc7XG5pbXBvcnQgeyBJRGF0YVNvdXJjZSwgSVRyZWVOb2RlLCBJVHJlZVJlbmRlcmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RyZWUvdHJlZS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEZ1enp5U2NvcmUsIGNyZWF0ZU1hdGNoZXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSwgdHlwZSBJUmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZ2V0SWNvbkNsYXNzZXNGb3JMYW5ndWFnZUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9nZXRJY29uQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMgYXMgQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMsIElDb25maWd1cmF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hEYXRhVHJlZU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTWFya2VyU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9tYXJrZXJzL2NvbW1vbi9tYXJrZXJzLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGxpc3RFcnJvckZvcmVncm91bmQsIGxpc3RXYXJuaW5nRm9yZWdyb3VuZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgV29ya2JlbmNoRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElFZGl0b3JQYW5lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBDZWxsRm9sZGluZ1N0YXRlLCBDZWxsUmV2ZWFsVHlwZSwgSUNlbGxNb2RlbERlY29yYXRpb25zLCBJQ2VsbE1vZGVsRGVsdGFEZWNvcmF0aW9ucywgSUNlbGxWaWV3TW9kZWwsIElOb3RlYm9va0VkaXRvciwgSU5vdGVib29rRWRpdG9yT3B0aW9ucywgSU5vdGVib29rRWRpdG9yUGFuZSwgSU5vdGVib29rVmlld01vZGVsIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2tCcm93c2VyLmpzJztcbmltcG9ydCB7IE5vdGVib29rRWRpdG9yIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2tFZGl0b3IuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rQ2VsbE91dGxpbmVEYXRhU291cmNlLCBOb3RlYm9va0NlbGxPdXRsaW5lRGF0YVNvdXJjZSB9IGZyb20gJy4uLy4uL3ZpZXdNb2RlbC9ub3RlYm9va091dGxpbmVEYXRhU291cmNlLmpzJztcbmltcG9ydCB7IENlbGxLaW5kLCBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZSwgTm90ZWJvb2tTZXR0aW5nIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlLCBTSURFX0dST1VQIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUJyZWFkY3J1bWJzRGF0YVNvdXJjZSwgSU91dGxpbmUsIElPdXRsaW5lQ29tcGFyYXRvciwgSU91dGxpbmVDcmVhdG9yLCBJT3V0bGluZUxpc3RDb25maWcsIElPdXRsaW5lU2VydmljZSwgSVF1aWNrUGlja0RhdGFTb3VyY2UsIElRdWlja1BpY2tPdXRsaW5lRWxlbWVudCwgT3V0bGluZUNoYW5nZUV2ZW50LCBPdXRsaW5lQ29uZmlnQ29sbGFwc2VJdGVtc1ZhbHVlcywgT3V0bGluZUNvbmZpZ0tleXMsIE91dGxpbmVUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9zZXJ2aWNlcy9vdXRsaW5lL2Jyb3dzZXIvb3V0bGluZS5qcyc7XG5pbXBvcnQgeyBPdXRsaW5lRW50cnkgfSBmcm9tICcuLi8uLi92aWV3TW9kZWwvT3V0bGluZUVudHJ5LmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElNb2RlbERlbHRhRGVjb3JhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgbWFpbldpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci93aW5kb3cuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgSU1lbnUsIElNZW51U2VydmljZSwgTWVudUlkLCBNZW51SXRlbUFjdGlvbiwgTWVudVJlZ2lzdHJ5LCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IE1lbnVFbnRyeUFjdGlvblZpZXdJdGVtLCBnZXRBY3Rpb25CYXJBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IElBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IE5vdGVib29rT3V0bGluZUVudHJ5QXJncyB9IGZyb20gJy4uLy4uL2NvbnRyb2xsZXIvc2VjdGlvbkFjdGlvbnMuanMnO1xuaW1wb3J0IHsgTWFya3VwQ2VsbFZpZXdNb2RlbCB9IGZyb20gJy4uLy4uL3ZpZXdNb2RlbC9tYXJrdXBDZWxsVmlld01vZGVsLmpzJztcbmltcG9ydCB7IERlbGF5ZXIsIGRpc3Bvc2FibGVUaW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgSU91dGxpbmVQYW5lIH0gZnJvbSAnLi4vLi4vLi4vLi4vb3V0bGluZS9icm93c2VyL291dGxpbmUuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IE5PVEVCT09LX0lTX0FDVElWRV9FRElUT1IgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbm90ZWJvb2tDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va091dGxpbmVDb25zdGFudHMgfSBmcm9tICcuLi8uLi92aWV3TW9kZWwvbm90ZWJvb2tPdXRsaW5lRW50cnlGYWN0b3J5LmpzJztcbmltcG9ydCB7IElOb3RlYm9va0NlbGxPdXRsaW5lRGF0YVNvdXJjZUZhY3RvcnkgfSBmcm9tICcuLi8uLi92aWV3TW9kZWwvbm90ZWJvb2tPdXRsaW5lRGF0YVNvdXJjZUZhY3RvcnkuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLCBOb3RlYm9va0V4ZWN1dGlvblR5cGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcblxuY2xhc3MgTm90ZWJvb2tPdXRsaW5lVGVtcGxhdGUge1xuXG5cdHN0YXRpYyByZWFkb25seSB0ZW1wbGF0ZUlkID0gJ05vdGVib29rT3V0bGluZVJlbmRlcmVyJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdHJlYWRvbmx5IGljb25DbGFzczogSFRNTEVsZW1lbnQsXG5cdFx0cmVhZG9ubHkgaWNvbkxhYmVsOiBJY29uTGFiZWwsXG5cdFx0cmVhZG9ubHkgZGVjb3JhdGlvbjogSFRNTEVsZW1lbnQsXG5cdFx0cmVhZG9ubHkgYWN0aW9uTWVudTogSFRNTEVsZW1lbnQsXG5cdFx0cmVhZG9ubHkgZWxlbWVudERpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUsXG5cdCkgeyB9XG59XG5cbmNsYXNzIE5vdGVib29rT3V0bGluZVJlbmRlcmVyIGltcGxlbWVudHMgSVRyZWVSZW5kZXJlcjxPdXRsaW5lRW50cnksIEZ1enp5U2NvcmUsIE5vdGVib29rT3V0bGluZVRlbXBsYXRlPiB7XG5cblx0dGVtcGxhdGVJZDogc3RyaW5nID0gTm90ZWJvb2tPdXRsaW5lVGVtcGxhdGUudGVtcGxhdGVJZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElOb3RlYm9va0VkaXRvciB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF90YXJnZXQ6IE91dGxpbmVUYXJnZXQsXG5cdFx0QElUaGVtZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJTWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkgeyB9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IE5vdGVib29rT3V0bGluZVRlbXBsYXRlIHtcblx0XHRjb25zdCBlbGVtZW50RGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnbm90ZWJvb2stb3V0bGluZS1lbGVtZW50JywgJ3Nob3ctZmlsZS1pY29ucycpO1xuXHRcdGNvbnN0IGljb25DbGFzcyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdGNvbnRhaW5lci5hcHBlbmQoaWNvbkNsYXNzKTtcblx0XHRjb25zdCBpY29uTGFiZWwgPSBuZXcgSWNvbkxhYmVsKGNvbnRhaW5lciwgeyBzdXBwb3J0SGlnaGxpZ2h0czogdHJ1ZSB9KTtcblx0XHRjb25zdCBkZWNvcmF0aW9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG5cdFx0ZGVjb3JhdGlvbi5jbGFzc05hbWUgPSAnZWxlbWVudC1kZWNvcmF0aW9uJztcblx0XHRjb250YWluZXIuYXBwZW5kKGRlY29yYXRpb24pO1xuXHRcdGNvbnN0IGFjdGlvbk1lbnUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcblx0XHRhY3Rpb25NZW51LmNsYXNzTmFtZSA9ICdhY3Rpb24tbWVudSc7XG5cdFx0Y29udGFpbmVyLmFwcGVuZChhY3Rpb25NZW51KTtcblxuXHRcdHJldHVybiBuZXcgTm90ZWJvb2tPdXRsaW5lVGVtcGxhdGUoY29udGFpbmVyLCBpY29uQ2xhc3MsIGljb25MYWJlbCwgZGVjb3JhdGlvbiwgYWN0aW9uTWVudSwgZWxlbWVudERpc3Bvc2FibGVzKTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQobm9kZTogSVRyZWVOb2RlPE91dGxpbmVFbnRyeSwgRnV6enlTY29yZT4sIF9pbmRleDogbnVtYmVyLCB0ZW1wbGF0ZTogTm90ZWJvb2tPdXRsaW5lVGVtcGxhdGUsIF9oZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IGV4dHJhQ2xhc3Nlczogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBvcHRpb25zOiBJSWNvbkxhYmVsVmFsdWVPcHRpb25zID0ge1xuXHRcdFx0bWF0Y2hlczogY3JlYXRlTWF0Y2hlcyhub2RlLmZpbHRlckRhdGEpLFxuXHRcdFx0bGFiZWxFc2NhcGVOZXdMaW5lczogdHJ1ZSxcblx0XHRcdGV4dHJhQ2xhc3Nlcyxcblx0XHR9O1xuXG5cdFx0Y29uc3QgaXNDb2RlQ2VsbCA9IG5vZGUuZWxlbWVudC5jZWxsLmNlbGxLaW5kID09PSBDZWxsS2luZC5Db2RlO1xuXHRcdGlmIChub2RlLmVsZW1lbnQubGV2ZWwgPj0gOCkgeyAvLyBzeW1ib2xcblx0XHRcdHRlbXBsYXRlLmljb25DbGFzcy5jbGFzc05hbWUgPSAnZWxlbWVudC1pY29uICcgKyBUaGVtZUljb24uYXNDbGFzc05hbWVBcnJheShub2RlLmVsZW1lbnQuaWNvbikuam9pbignICcpO1xuXHRcdH0gZWxzZSBpZiAoaXNDb2RlQ2VsbCAmJiB0aGlzLl90aGVtZVNlcnZpY2UuZ2V0RmlsZUljb25UaGVtZSgpLmhhc0ZpbGVJY29ucyAmJiAhbm9kZS5lbGVtZW50LmlzRXhlY3V0aW5nKSB7XG5cdFx0XHR0ZW1wbGF0ZS5pY29uQ2xhc3MuY2xhc3NOYW1lID0gJyc7XG5cdFx0XHRleHRyYUNsYXNzZXMucHVzaCguLi5nZXRJY29uQ2xhc3Nlc0Zvckxhbmd1YWdlSWQobm9kZS5lbGVtZW50LmNlbGwubGFuZ3VhZ2UgPz8gJycpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGVtcGxhdGUuaWNvbkNsYXNzLmNsYXNzTmFtZSA9ICdlbGVtZW50LWljb24gJyArIFRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KG5vZGUuZWxlbWVudC5pY29uKS5qb2luKCcgJyk7XG5cdFx0fVxuXG5cdFx0dGVtcGxhdGUuaWNvbkxhYmVsLnNldExhYmVsKCcgJyArIG5vZGUuZWxlbWVudC5sYWJlbCwgdW5kZWZpbmVkLCBvcHRpb25zKTtcblxuXHRcdGNvbnN0IHsgbWFya2VySW5mbyB9ID0gbm9kZS5lbGVtZW50O1xuXG5cdFx0dGVtcGxhdGUuY29udGFpbmVyLnN0eWxlLnJlbW92ZVByb3BlcnR5KCctLW91dGxpbmUtZWxlbWVudC1jb2xvcicpO1xuXHRcdHRlbXBsYXRlLmRlY29yYXRpb24uaW5uZXJUZXh0ID0gJyc7XG5cdFx0aWYgKG1hcmtlckluZm8pIHtcblx0XHRcdGNvbnN0IHByb2JsZW0gPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgncHJvYmxlbXMudmlzaWJpbGl0eScpO1xuXHRcdFx0Y29uc3QgdXNlQmFkZ2VzID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoT3V0bGluZUNvbmZpZ0tleXMucHJvYmxlbXNCYWRnZXMpO1xuXG5cdFx0XHRpZiAoIXVzZUJhZGdlcyB8fCAhcHJvYmxlbSkge1xuXHRcdFx0XHR0ZW1wbGF0ZS5kZWNvcmF0aW9uLmNsYXNzTGlzdC5yZW1vdmUoJ2J1YmJsZScpO1xuXHRcdFx0XHR0ZW1wbGF0ZS5kZWNvcmF0aW9uLmlubmVyVGV4dCA9ICcnO1xuXHRcdFx0fSBlbHNlIGlmIChtYXJrZXJJbmZvLmNvdW50ID09PSAwKSB7XG5cdFx0XHRcdHRlbXBsYXRlLmRlY29yYXRpb24uY2xhc3NMaXN0LmFkZCgnYnViYmxlJyk7XG5cdFx0XHRcdHRlbXBsYXRlLmRlY29yYXRpb24uaW5uZXJUZXh0ID0gJ1xcdWVhNzEnO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGVtcGxhdGUuZGVjb3JhdGlvbi5jbGFzc0xpc3QucmVtb3ZlKCdidWJibGUnKTtcblx0XHRcdFx0dGVtcGxhdGUuZGVjb3JhdGlvbi5pbm5lclRleHQgPSBtYXJrZXJJbmZvLmNvdW50ID4gOSA/ICc5KycgOiBTdHJpbmcobWFya2VySW5mby5jb3VudCk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBjb2xvciA9IHRoaXMuX3RoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkuZ2V0Q29sb3IobWFya2VySW5mby50b3BTZXYgPT09IE1hcmtlclNldmVyaXR5LkVycm9yID8gbGlzdEVycm9yRm9yZWdyb3VuZCA6IGxpc3RXYXJuaW5nRm9yZWdyb3VuZCk7XG5cdFx0XHRpZiAocHJvYmxlbSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHVzZUNvbG9ycyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKE91dGxpbmVDb25maWdLZXlzLnByb2JsZW1zQ29sb3JzKTtcblx0XHRcdGlmICghdXNlQ29sb3JzIHx8ICFwcm9ibGVtKSB7XG5cdFx0XHRcdHRlbXBsYXRlLmNvbnRhaW5lci5zdHlsZS5yZW1vdmVQcm9wZXJ0eSgnLS1vdXRsaW5lLWVsZW1lbnQtY29sb3InKTtcblx0XHRcdFx0dGVtcGxhdGUuZGVjb3JhdGlvbi5zdHlsZS5zZXRQcm9wZXJ0eSgnLS1vdXRsaW5lLWVsZW1lbnQtY29sb3InLCBjb2xvcj8udG9TdHJpbmcoKSA/PyAnaW5oZXJpdCcpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGVtcGxhdGUuY29udGFpbmVyLnN0eWxlLnNldFByb3BlcnR5KCctLW91dGxpbmUtZWxlbWVudC1jb2xvcicsIGNvbG9yPy50b1N0cmluZygpID8/ICdpbmhlcml0Jyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX3RhcmdldCA9PT0gT3V0bGluZVRhcmdldC5PdXRsaW5lUGFuZSkge1xuXHRcdFx0aWYgKCF0aGlzLl9lZGl0b3IpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBuYkNlbGwgPSBub2RlLmVsZW1lbnQuY2VsbDtcblx0XHRcdGNvbnN0IG5iVmlld01vZGVsID0gdGhpcy5fZWRpdG9yLmdldFZpZXdNb2RlbCgpO1xuXHRcdFx0aWYgKCFuYlZpZXdNb2RlbCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBpZHggPSBuYlZpZXdNb2RlbC5nZXRDZWxsSW5kZXgobmJDZWxsKTtcblx0XHRcdGNvbnN0IGxlbmd0aCA9IGlzQ29kZUNlbGwgPyAwIDogbmJWaWV3TW9kZWwuZ2V0Rm9sZGVkTGVuZ3RoKGlkeCk7XG5cblx0XHRcdGNvbnN0IHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlID0gdGVtcGxhdGUuZWxlbWVudERpc3Bvc2FibGVzLmFkZCh0aGlzLl9jb250ZXh0S2V5U2VydmljZS5jcmVhdGVTY29wZWQodGVtcGxhdGUuY29udGFpbmVyKSk7XG5cdFx0XHROb3RlYm9va091dGxpbmVDb250ZXh0LkNlbGxLaW5kLmJpbmRUbyhzY29wZWRDb250ZXh0S2V5U2VydmljZSkuc2V0KGlzQ29kZUNlbGwgPyBDZWxsS2luZC5Db2RlIDogQ2VsbEtpbmQuTWFya3VwKTtcblx0XHRcdE5vdGVib29rT3V0bGluZUNvbnRleHQuQ2VsbEhhc0NoaWxkcmVuLmJpbmRUbyhzY29wZWRDb250ZXh0S2V5U2VydmljZSkuc2V0KGxlbmd0aCA+IDApO1xuXHRcdFx0Tm90ZWJvb2tPdXRsaW5lQ29udGV4dC5DZWxsSGFzSGVhZGVyLmJpbmRUbyhzY29wZWRDb250ZXh0S2V5U2VydmljZSkuc2V0KG5vZGUuZWxlbWVudC5sZXZlbCAhPT0gTm90ZWJvb2tPdXRsaW5lQ29uc3RhbnRzLk5vbkhlYWRlck91dGxpbmVMZXZlbCk7XG5cdFx0XHROb3RlYm9va091dGxpbmVDb250ZXh0Lk91dGxpbmVFbGVtZW50VGFyZ2V0LmJpbmRUbyhzY29wZWRDb250ZXh0S2V5U2VydmljZSkuc2V0KHRoaXMuX3RhcmdldCk7XG5cdFx0XHR0aGlzLnNldHVwRm9sZGluZyhpc0NvZGVDZWxsLCBuYlZpZXdNb2RlbCwgc2NvcGVkQ29udGV4dEtleVNlcnZpY2UsIHRlbXBsYXRlLCBuYkNlbGwpO1xuXG5cdFx0XHRjb25zdCBvdXRsaW5lRW50cnlUb29sYmFyID0gdGVtcGxhdGUuZWxlbWVudERpc3Bvc2FibGVzLmFkZChuZXcgVG9vbEJhcih0ZW1wbGF0ZS5hY3Rpb25NZW51LCB0aGlzLl9jb250ZXh0TWVudVNlcnZpY2UsIHtcblx0XHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogYWN0aW9uID0+IHtcblx0XHRcdFx0XHRpZiAoYWN0aW9uIGluc3RhbmNlb2YgTWVudUl0ZW1BY3Rpb24pIHtcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51RW50cnlBY3Rpb25WaWV3SXRlbSwgYWN0aW9uLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9LFxuXHRcdFx0fSkpO1xuXG5cdFx0XHRjb25zdCBtZW51ID0gdGVtcGxhdGUuZWxlbWVudERpc3Bvc2FibGVzLmFkZCh0aGlzLl9tZW51U2VydmljZS5jcmVhdGVNZW51KE1lbnVJZC5Ob3RlYm9va091dGxpbmVBY3Rpb25NZW51LCBzY29wZWRDb250ZXh0S2V5U2VydmljZSkpO1xuXHRcdFx0Y29uc3QgYWN0aW9ucyA9IGdldE91dGxpbmVUb29sYmFyQWN0aW9ucyhtZW51LCB7IG5vdGVib29rRWRpdG9yOiB0aGlzLl9lZGl0b3IsIG91dGxpbmVFbnRyeTogbm9kZS5lbGVtZW50IH0pO1xuXHRcdFx0b3V0bGluZUVudHJ5VG9vbGJhci5zZXRBY3Rpb25zKGFjdGlvbnMucHJpbWFyeSwgYWN0aW9ucy5zZWNvbmRhcnkpO1xuXG5cdFx0XHR0aGlzLnNldHVwVG9vbGJhckxpc3RlbmVycyh0aGlzLl9lZGl0b3IsIG91dGxpbmVFbnRyeVRvb2xiYXIsIG1lbnUsIGFjdGlvbnMsIG5vZGUuZWxlbWVudCwgdGVtcGxhdGUpO1xuXHRcdFx0dGVtcGxhdGUuYWN0aW9uTWVudS5zdHlsZS5wYWRkaW5nID0gJzAgMC44ZW0gMCAwLjRlbSc7XG5cdFx0fVxuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogTm90ZWJvb2tPdXRsaW5lVGVtcGxhdGUpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuaWNvbkxhYmVsLmRpc3Bvc2UoKTtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGRpc3Bvc2VFbGVtZW50KGVsZW1lbnQ6IElUcmVlTm9kZTxPdXRsaW5lRW50cnksIEZ1enp5U2NvcmU+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IE5vdGVib29rT3V0bGluZVRlbXBsYXRlLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRET00uY2xlYXJOb2RlKHRlbXBsYXRlRGF0YS5hY3Rpb25NZW51KTtcblx0fVxuXG5cdHByaXZhdGUgc2V0dXBGb2xkaW5nKGlzQ29kZUNlbGw6IGJvb2xlYW4sIG5iVmlld01vZGVsOiBJTm90ZWJvb2tWaWV3TW9kZWwsIHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsIHRlbXBsYXRlOiBOb3RlYm9va091dGxpbmVUZW1wbGF0ZSwgbmJDZWxsOiBJQ2VsbFZpZXdNb2RlbCkge1xuXHRcdGNvbnN0IGZvbGRpbmdTdGF0ZSA9IGlzQ29kZUNlbGwgPyBDZWxsRm9sZGluZ1N0YXRlLk5vbmUgOiAoKG5iQ2VsbCBhcyBNYXJrdXBDZWxsVmlld01vZGVsKS5mb2xkaW5nU3RhdGUpO1xuXHRcdGNvbnN0IGZvbGRpbmdTdGF0ZUN0eCA9IE5vdGVib29rT3V0bGluZUNvbnRleHQuQ2VsbEZvbGRpbmdTdGF0ZS5iaW5kVG8oc2NvcGVkQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGZvbGRpbmdTdGF0ZUN0eC5zZXQoZm9sZGluZ1N0YXRlKTtcblxuXHRcdGlmICghaXNDb2RlQ2VsbCkge1xuXHRcdFx0dGVtcGxhdGUuZWxlbWVudERpc3Bvc2FibGVzLmFkZChuYlZpZXdNb2RlbC5vbkRpZEZvbGRpbmdTdGF0ZUNoYW5nZWQoKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBmb2xkaW5nU3RhdGUgPSAobmJDZWxsIGFzIE1hcmt1cENlbGxWaWV3TW9kZWwpLmZvbGRpbmdTdGF0ZTtcblx0XHRcdFx0Tm90ZWJvb2tPdXRsaW5lQ29udGV4dC5DZWxsRm9sZGluZ1N0YXRlLmJpbmRUbyhzY29wZWRDb250ZXh0S2V5U2VydmljZSkuc2V0KGZvbGRpbmdTdGF0ZSk7XG5cdFx0XHRcdGZvbGRpbmdTdGF0ZUN0eC5zZXQoZm9sZGluZ1N0YXRlKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldHVwVG9vbGJhckxpc3RlbmVycyhlZGl0b3I6IElOb3RlYm9va0VkaXRvciwgdG9vbGJhcjogVG9vbEJhciwgbWVudTogSU1lbnUsIGluaXRBY3Rpb25zOiB7IHByaW1hcnk6IElBY3Rpb25bXTsgc2Vjb25kYXJ5OiBJQWN0aW9uW10gfSwgZW50cnk6IE91dGxpbmVFbnRyeSwgdGVtcGxhdGVEYXRhOiBOb3RlYm9va091dGxpbmVUZW1wbGF0ZSk6IHZvaWQge1xuXHRcdC8vIHNhbWUgZml4IGFzIGluIGNlbGxUb29sYmFycyBzZXR1cExpc3RlbmVycyByZSAjMTAzOTI2XG5cdFx0bGV0IGRyb3Bkb3duSXNWaXNpYmxlID0gZmFsc2U7XG5cdFx0bGV0IGRlZmVycmVkVXBkYXRlOiAoKCkgPT4gdm9pZCkgfCB1bmRlZmluZWQ7XG5cblx0XHR0b29sYmFyLnNldEFjdGlvbnMoaW5pdEFjdGlvbnMucHJpbWFyeSwgaW5pdEFjdGlvbnMuc2Vjb25kYXJ5KTtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmFkZChtZW51Lm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdGlmIChkcm9wZG93bklzVmlzaWJsZSkge1xuXHRcdFx0XHRjb25zdCBhY3Rpb25zID0gZ2V0T3V0bGluZVRvb2xiYXJBY3Rpb25zKG1lbnUsIHsgbm90ZWJvb2tFZGl0b3I6IGVkaXRvciwgb3V0bGluZUVudHJ5OiBlbnRyeSB9KTtcblx0XHRcdFx0ZGVmZXJyZWRVcGRhdGUgPSAoKSA9PiB0b29sYmFyLnNldEFjdGlvbnMoYWN0aW9ucy5wcmltYXJ5LCBhY3Rpb25zLnNlY29uZGFyeSk7XG5cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBhY3Rpb25zID0gZ2V0T3V0bGluZVRvb2xiYXJBY3Rpb25zKG1lbnUsIHsgbm90ZWJvb2tFZGl0b3I6IGVkaXRvciwgb3V0bGluZUVudHJ5OiBlbnRyeSB9KTtcblx0XHRcdHRvb2xiYXIuc2V0QWN0aW9ucyhhY3Rpb25zLnByaW1hcnksIGFjdGlvbnMuc2Vjb25kYXJ5KTtcblx0XHR9KSk7XG5cblx0XHR0ZW1wbGF0ZURhdGEuY29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ25vdGVib29rLW91dGxpbmUtdG9vbGJhci1kcm9wZG93bi1hY3RpdmUnKTtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmFkZCh0b29sYmFyLm9uRGlkQ2hhbmdlRHJvcGRvd25WaXNpYmlsaXR5KHZpc2libGUgPT4ge1xuXHRcdFx0ZHJvcGRvd25Jc1Zpc2libGUgPSB2aXNpYmxlO1xuXHRcdFx0aWYgKHZpc2libGUpIHtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLmNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdub3RlYm9vay1vdXRsaW5lLXRvb2xiYXItZHJvcGRvd24tYWN0aXZlJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEuY29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ25vdGVib29rLW91dGxpbmUtdG9vbGJhci1kcm9wZG93bi1hY3RpdmUnKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGRlZmVycmVkVXBkYXRlICYmICF2aXNpYmxlKSB7XG5cdFx0XHRcdGRpc3Bvc2FibGVUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHRkZWZlcnJlZFVwZGF0ZT8uKCk7XG5cdFx0XHRcdH0sIDAsIHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMpO1xuXG5cdFx0XHRcdGRlZmVycmVkVXBkYXRlID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHR9XG59XG5cbmZ1bmN0aW9uIGdldE91dGxpbmVUb29sYmFyQWN0aW9ucyhtZW51OiBJTWVudSwgYXJncz86IE5vdGVib29rT3V0bGluZUVudHJ5QXJncyk6IHsgcHJpbWFyeTogSUFjdGlvbltdOyBzZWNvbmRhcnk6IElBY3Rpb25bXSB9IHtcblx0cmV0dXJuIGdldEFjdGlvbkJhckFjdGlvbnMobWVudS5nZXRBY3Rpb25zKHsgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUsIGFyZzogYXJncyB9KSwgZyA9PiAvXmlubGluZS8udGVzdChnKSk7XG59XG5cbmNsYXNzIE5vdGVib29rT3V0bGluZUFjY2Vzc2liaWxpdHkgaW1wbGVtZW50cyBJTGlzdEFjY2Vzc2liaWxpdHlQcm92aWRlcjxPdXRsaW5lRW50cnk+IHtcblx0Z2V0QXJpYUxhYmVsKGVsZW1lbnQ6IE91dGxpbmVFbnRyeSk6IHN0cmluZyB8IG51bGwge1xuXHRcdHJldHVybiBlbGVtZW50LmxhYmVsO1xuXHR9XG5cdGdldFdpZGdldEFyaWFMYWJlbCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiAnJztcblx0fVxufVxuXG5jbGFzcyBOb3RlYm9va05hdmlnYXRpb25MYWJlbFByb3ZpZGVyIGltcGxlbWVudHMgSUtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXI8T3V0bGluZUVudHJ5PiB7XG5cdGdldEtleWJvYXJkTmF2aWdhdGlvbkxhYmVsKGVsZW1lbnQ6IE91dGxpbmVFbnRyeSk6IHsgdG9TdHJpbmcoKTogc3RyaW5nIHwgdW5kZWZpbmVkIH0gfCB7IHRvU3RyaW5nKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB9W10gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBlbGVtZW50LmxhYmVsO1xuXHR9XG59XG5cbmNsYXNzIE5vdGVib29rT3V0bGluZVZpcnR1YWxEZWxlZ2F0ZSBpbXBsZW1lbnRzIElMaXN0VmlydHVhbERlbGVnYXRlPE91dGxpbmVFbnRyeT4ge1xuXG5cdGdldEhlaWdodChfZWxlbWVudDogT3V0bGluZUVudHJ5KTogbnVtYmVyIHtcblx0XHRyZXR1cm4gMjI7XG5cdH1cblxuXHRnZXRUZW1wbGF0ZUlkKF9lbGVtZW50OiBPdXRsaW5lRW50cnkpOiBzdHJpbmcge1xuXHRcdHJldHVybiBOb3RlYm9va091dGxpbmVUZW1wbGF0ZS50ZW1wbGF0ZUlkO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9va1F1aWNrUGlja1Byb3ZpZGVyIGltcGxlbWVudHMgSVF1aWNrUGlja0RhdGFTb3VyY2U8T3V0bGluZUVudHJ5PiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSBnb3RvU2hvd0NvZGVDZWxsU3ltYm9sczogYm9vbGVhbjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IG5vdGVib29rQ2VsbE91dGxpbmVEYXRhU291cmNlUmVmOiBJUmVmZXJlbmNlPElOb3RlYm9va0NlbGxPdXRsaW5lRGF0YVNvdXJjZT4gfCB1bmRlZmluZWQsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RoZW1lU2VydmljZTogSVRoZW1lU2VydmljZVxuXHQpIHtcblx0XHR0aGlzLmdvdG9TaG93Q29kZUNlbGxTeW1ib2xzID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oTm90ZWJvb2tTZXR0aW5nLmdvdG9TeW1ib2xzQWxsU3ltYm9scyk7XG5cblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTm90ZWJvb2tTZXR0aW5nLmdvdG9TeW1ib2xzQWxsU3ltYm9scykpIHtcblx0XHRcdFx0dGhpcy5nb3RvU2hvd0NvZGVDZWxsU3ltYm9scyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KE5vdGVib29rU2V0dGluZy5nb3RvU3ltYm9sc0FsbFN5bWJvbHMpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdGdldFF1aWNrUGlja0VsZW1lbnRzKCk6IElRdWlja1BpY2tPdXRsaW5lRWxlbWVudDxPdXRsaW5lRW50cnk+W10ge1xuXHRcdGNvbnN0IGJ1Y2tldDogT3V0bGluZUVudHJ5W10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMubm90ZWJvb2tDZWxsT3V0bGluZURhdGFTb3VyY2VSZWY/Lm9iamVjdD8uZW50cmllcyA/PyBbXSkge1xuXHRcdFx0ZW50cnkuYXNGbGF0TGlzdChidWNrZXQpO1xuXHRcdH1cblx0XHRjb25zdCByZXN1bHQ6IElRdWlja1BpY2tPdXRsaW5lRWxlbWVudDxPdXRsaW5lRW50cnk+W10gPSBbXTtcblx0XHRjb25zdCB7IGhhc0ZpbGVJY29ucyB9ID0gdGhpcy5fdGhlbWVTZXJ2aWNlLmdldEZpbGVJY29uVGhlbWUoKTtcblxuXHRcdGNvbnN0IGlzU3ltYm9sID0gKGVsZW1lbnQ6IE91dGxpbmVFbnRyeSkgPT4gISFlbGVtZW50LnN5bWJvbEtpbmQ7XG5cdFx0Y29uc3QgaXNDb2RlQ2VsbCA9IChlbGVtZW50OiBPdXRsaW5lRW50cnkpID0+IChlbGVtZW50LmNlbGwuY2VsbEtpbmQgPT09IENlbGxLaW5kLkNvZGUgJiYgZWxlbWVudC5sZXZlbCA9PT0gTm90ZWJvb2tPdXRsaW5lQ29uc3RhbnRzLk5vbkhlYWRlck91dGxpbmVMZXZlbCk7IC8vIGNvZGUgY2VsbCBlbnRyaWVzIGFyZSBleGFjdGx5IGxldmVsIDcgYnkgdGhpcyBjb25zdGFudFxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYnVja2V0Lmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBlbGVtZW50ID0gYnVja2V0W2ldO1xuXHRcdFx0Y29uc3QgbmV4dEVsZW1lbnQgPSBidWNrZXRbaSArIDFdOyAvLyBjYW4gYmUgdW5kZWZpbmVkXG5cblx0XHRcdGlmICghdGhpcy5nb3RvU2hvd0NvZGVDZWxsU3ltYm9sc1xuXHRcdFx0XHQmJiBpc1N5bWJvbChlbGVtZW50KSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuZ290b1Nob3dDb2RlQ2VsbFN5bWJvbHNcblx0XHRcdFx0JiYgaXNDb2RlQ2VsbChlbGVtZW50KVxuXHRcdFx0XHQmJiBuZXh0RWxlbWVudCAmJiBpc1N5bWJvbChuZXh0RWxlbWVudCkpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHVzZUZpbGVJY29uID0gaGFzRmlsZUljb25zICYmICFlbGVtZW50LnN5bWJvbEtpbmQ7XG5cdFx0XHQvLyB0b2RvQGpyaWVrZW4gaXQgaXMgZmlzaHkgdGhhdCBjb2RpY29ucyBjYW5ub3QgYmUgdXNlZCB3aXRoIGljb25DbGFzc2VzXG5cdFx0XHQvLyBidXQgZmlsZSBpY29ucyBjYW4uLi5cblx0XHRcdHJlc3VsdC5wdXNoKHtcblx0XHRcdFx0ZWxlbWVudCxcblx0XHRcdFx0bGFiZWw6IHVzZUZpbGVJY29uID8gZWxlbWVudC5sYWJlbCA6IGAkKCR7ZWxlbWVudC5pY29uLmlkfSkgJHtlbGVtZW50LmxhYmVsfWAsXG5cdFx0XHRcdGFyaWFMYWJlbDogZWxlbWVudC5sYWJlbCxcblx0XHRcdFx0aWNvbkNsYXNzZXM6IHVzZUZpbGVJY29uID8gZ2V0SWNvbkNsYXNzZXNGb3JMYW5ndWFnZUlkKGVsZW1lbnQuY2VsbC5sYW5ndWFnZSA/PyAnJykgOiB1bmRlZmluZWQsXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG5cbi8qKlxuICogQ2hlY2tzIGlmIHRoZSBnaXZlbiBvdXRsaW5lIGVudHJ5IHNob3VsZCBiZSBmaWx0ZXJlZCBvdXQgb2YgdGhlIG91dGxpbmVQYW5lXG4gKlxuICogQHBhcmFtIGVudHJ5IHRoZSBPdXRsaW5lRW50cnkgdG8gY2hlY2tcbiAqIEBwYXJhbSBzaG93TWFya2Rvd25IZWFkZXJzT25seSB3aGV0aGVyIHRvIHNob3cgb25seSBtYXJrZG93biBoZWFkZXJzXG4gKiBAcGFyYW0gc2hvd0NvZGVDZWxscyB3aGV0aGVyIHRvIHNob3cgY29kZSBjZWxsc1xuICogQHBhcmFtIHNob3dDb2RlQ2VsbFN5bWJvbHMgd2hldGhlciB0byBzaG93IGNvZGUgY2VsbCBzeW1ib2xzXG4gKiBAcmV0dXJucyB0cnVlIGlmIHRoZSBlbnRyeSBzaG91bGQgYmUgZmlsdGVyZWQgb3V0IG9mIHRoZSBvdXRsaW5lUGFuZSwgZmFsc2UgaWYgdGhlIGVudHJ5IHNob3VsZCBiZSB2aXNpYmxlLlxuICovXG5mdW5jdGlvbiBmaWx0ZXJFbnRyeShlbnRyeTogT3V0bGluZUVudHJ5LCBzaG93TWFya2Rvd25IZWFkZXJzT25seTogYm9vbGVhbiwgc2hvd0NvZGVDZWxsczogYm9vbGVhbiwgc2hvd0NvZGVDZWxsU3ltYm9sczogYm9vbGVhbik6IGJvb2xlYW4ge1xuXHQvLyBpZiBhbnkgYXJlIHRydWUsIHJldHVybiB0cnVlLCB0aGlzIGVudHJ5IHNob3VsZCBOT1QgYmUgaW5jbHVkZWQgaW4gdGhlIG91dGxpbmVcblx0aWYgKFxuXHRcdChzaG93TWFya2Rvd25IZWFkZXJzT25seSAmJiBlbnRyeS5jZWxsLmNlbGxLaW5kID09PSBDZWxsS2luZC5NYXJrdXAgJiYgZW50cnkubGV2ZWwgPT09IE5vdGVib29rT3V0bGluZUNvbnN0YW50cy5Ob25IZWFkZXJPdXRsaW5lTGV2ZWwpIHx8XHQvLyBzaG93IGhlYWRlcnMgb25seSAgICsgY2VsbCBpcyBta2RuICsgaXMgbGV2ZWwgNyAobm90IGhlYWRlcilcblx0XHQoIXNob3dDb2RlQ2VsbHMgJiYgZW50cnkuY2VsbC5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuQ29kZSkgfHxcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gc2hvdyBjb2RlIGNlbGxzIG9mZiArIGNlbGwgaXMgY29kZVxuXHRcdCghc2hvd0NvZGVDZWxsU3ltYm9scyAmJiBlbnRyeS5jZWxsLmNlbGxLaW5kID09PSBDZWxsS2luZC5Db2RlICYmIGVudHJ5LmxldmVsID4gTm90ZWJvb2tPdXRsaW5lQ29uc3RhbnRzLk5vbkhlYWRlck91dGxpbmVMZXZlbClcdFx0XHRcdC8vIHNob3cgc3ltYm9scyBvZmYgICAgKyBjZWxsIGlzIGNvZGUgKyBpcyBsZXZlbCA+NyAobmIgc3ltYm9sIGxldmVscylcblx0KSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRyZXR1cm4gZmFsc2U7XG59XG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9va091dGxpbmVQYW5lUHJvdmlkZXIgaW1wbGVtZW50cyBJRGF0YVNvdXJjZTxOb3RlYm9va0NlbGxPdXRsaW5lLCBPdXRsaW5lRW50cnk+IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRwcml2YXRlIHNob3dDb2RlQ2VsbHM6IGJvb2xlYW47XG5cdHByaXZhdGUgc2hvd0NvZGVDZWxsU3ltYm9sczogYm9vbGVhbjtcblx0cHJpdmF0ZSBzaG93TWFya2Rvd25IZWFkZXJzT25seTogYm9vbGVhbjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IG91dGxpbmVEYXRhU291cmNlUmVmOiBJUmVmZXJlbmNlPElOb3RlYm9va0NlbGxPdXRsaW5lRGF0YVNvdXJjZT4gfCB1bmRlZmluZWQsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLnNob3dDb2RlQ2VsbHMgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihOb3RlYm9va1NldHRpbmcub3V0bGluZVNob3dDb2RlQ2VsbHMpO1xuXHRcdHRoaXMuc2hvd0NvZGVDZWxsU3ltYm9scyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KE5vdGVib29rU2V0dGluZy5vdXRsaW5lU2hvd0NvZGVDZWxsU3ltYm9scyk7XG5cdFx0dGhpcy5zaG93TWFya2Rvd25IZWFkZXJzT25seSA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KE5vdGVib29rU2V0dGluZy5vdXRsaW5lU2hvd01hcmtkb3duSGVhZGVyc09ubHkpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKE5vdGVib29rU2V0dGluZy5vdXRsaW5lU2hvd0NvZGVDZWxscykpIHtcblx0XHRcdFx0dGhpcy5zaG93Q29kZUNlbGxzID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oTm90ZWJvb2tTZXR0aW5nLm91dGxpbmVTaG93Q29kZUNlbGxzKTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKE5vdGVib29rU2V0dGluZy5vdXRsaW5lU2hvd0NvZGVDZWxsU3ltYm9scykpIHtcblx0XHRcdFx0dGhpcy5zaG93Q29kZUNlbGxTeW1ib2xzID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oTm90ZWJvb2tTZXR0aW5nLm91dGxpbmVTaG93Q29kZUNlbGxTeW1ib2xzKTtcblx0XHRcdH1cblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKE5vdGVib29rU2V0dGluZy5vdXRsaW5lU2hvd01hcmtkb3duSGVhZGVyc09ubHkpKSB7XG5cdFx0XHRcdHRoaXMuc2hvd01hcmtkb3duSGVhZGVyc09ubHkgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihOb3RlYm9va1NldHRpbmcub3V0bGluZVNob3dNYXJrZG93bkhlYWRlcnNPbmx5KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0QWN0aXZlRW50cnkoKTogT3V0bGluZUVudHJ5IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBuZXdBY3RpdmUgPSB0aGlzLm91dGxpbmVEYXRhU291cmNlUmVmPy5vYmplY3Q/LmFjdGl2ZUVsZW1lbnQ7XG5cdFx0aWYgKCFuZXdBY3RpdmUpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKCFmaWx0ZXJFbnRyeShuZXdBY3RpdmUsIHRoaXMuc2hvd01hcmtkb3duSGVhZGVyc09ubHksIHRoaXMuc2hvd0NvZGVDZWxscywgdGhpcy5zaG93Q29kZUNlbGxTeW1ib2xzKSkge1xuXHRcdFx0cmV0dXJuIG5ld0FjdGl2ZTtcblx0XHR9XG5cblx0XHQvLyBmaW5kIGEgdmFsaWQgcGFyZW50XG5cdFx0bGV0IHBhcmVudCA9IG5ld0FjdGl2ZS5wYXJlbnQ7XG5cdFx0d2hpbGUgKHBhcmVudCkge1xuXHRcdFx0aWYgKGZpbHRlckVudHJ5KHBhcmVudCwgdGhpcy5zaG93TWFya2Rvd25IZWFkZXJzT25seSwgdGhpcy5zaG93Q29kZUNlbGxzLCB0aGlzLnNob3dDb2RlQ2VsbFN5bWJvbHMpKSB7XG5cdFx0XHRcdHBhcmVudCA9IHBhcmVudC5wYXJlbnQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gcGFyZW50O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIG5vIHZhbGlkIHBhcmVudCBmb3VuZCwgcmV0dXJuIHVuZGVmaW5lZFxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHQqZ2V0Q2hpbGRyZW4oZWxlbWVudDogTm90ZWJvb2tDZWxsT3V0bGluZSB8IE91dGxpbmVFbnRyeSk6IEl0ZXJhYmxlPE91dGxpbmVFbnRyeT4ge1xuXHRcdGNvbnN0IGlzT3V0bGluZSA9IGVsZW1lbnQgaW5zdGFuY2VvZiBOb3RlYm9va0NlbGxPdXRsaW5lO1xuXHRcdGNvbnN0IGVudHJpZXMgPSBpc091dGxpbmUgPyB0aGlzLm91dGxpbmVEYXRhU291cmNlUmVmPy5vYmplY3Q/LmVudHJpZXMgPz8gW10gOiBlbGVtZW50LmNoaWxkcmVuO1xuXG5cdFx0Zm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG5cdFx0XHRpZiAoZW50cnkuY2VsbC5jZWxsS2luZCA9PT0gQ2VsbEtpbmQuTWFya3VwKSB7XG5cdFx0XHRcdGlmICghdGhpcy5zaG93TWFya2Rvd25IZWFkZXJzT25seSkge1xuXHRcdFx0XHRcdHlpZWxkIGVudHJ5O1xuXHRcdFx0XHR9IGVsc2UgaWYgKGVudHJ5LmxldmVsIDwgTm90ZWJvb2tPdXRsaW5lQ29uc3RhbnRzLk5vbkhlYWRlck91dGxpbmVMZXZlbCkge1xuXHRcdFx0XHRcdHlpZWxkIGVudHJ5O1xuXHRcdFx0XHR9XG5cblx0XHRcdH0gZWxzZSBpZiAodGhpcy5zaG93Q29kZUNlbGxzICYmIGVudHJ5LmNlbGwuY2VsbEtpbmQgPT09IENlbGxLaW5kLkNvZGUpIHtcblx0XHRcdFx0aWYgKHRoaXMuc2hvd0NvZGVDZWxsU3ltYm9scykge1xuXHRcdFx0XHRcdHlpZWxkIGVudHJ5O1xuXHRcdFx0XHR9IGVsc2UgaWYgKGVudHJ5LmxldmVsID09PSBOb3RlYm9va091dGxpbmVDb25zdGFudHMuTm9uSGVhZGVyT3V0bGluZUxldmVsKSB7XG5cdFx0XHRcdFx0eWllbGQgZW50cnk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tCcmVhZGNydW1ic1Byb3ZpZGVyIGltcGxlbWVudHMgSUJyZWFkY3J1bWJzRGF0YVNvdXJjZTxPdXRsaW5lRW50cnk+IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRwcml2YXRlIHNob3dDb2RlQ2VsbHM6IGJvb2xlYW47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBvdXRsaW5lRGF0YVNvdXJjZVJlZjogSVJlZmVyZW5jZTxJTm90ZWJvb2tDZWxsT3V0bGluZURhdGFTb3VyY2U+IHwgdW5kZWZpbmVkLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5zaG93Q29kZUNlbGxzID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oTm90ZWJvb2tTZXR0aW5nLmJyZWFkY3J1bWJzU2hvd0NvZGVDZWxscyk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKE5vdGVib29rU2V0dGluZy5icmVhZGNydW1ic1Nob3dDb2RlQ2VsbHMpKSB7XG5cdFx0XHRcdHRoaXMuc2hvd0NvZGVDZWxscyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KE5vdGVib29rU2V0dGluZy5icmVhZGNydW1ic1Nob3dDb2RlQ2VsbHMpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdGdldEJyZWFkY3J1bWJFbGVtZW50cygpOiByZWFkb25seSBPdXRsaW5lRW50cnlbXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBPdXRsaW5lRW50cnlbXSA9IFtdO1xuXHRcdGxldCBjYW5kaWRhdGUgPSB0aGlzLm91dGxpbmVEYXRhU291cmNlUmVmPy5vYmplY3Q/LmFjdGl2ZUVsZW1lbnQ7XG5cdFx0d2hpbGUgKGNhbmRpZGF0ZSkge1xuXHRcdFx0aWYgKHRoaXMuc2hvd0NvZGVDZWxscyB8fCBjYW5kaWRhdGUuY2VsbC5jZWxsS2luZCAhPT0gQ2VsbEtpbmQuQ29kZSkge1xuXHRcdFx0XHRyZXN1bHQudW5zaGlmdChjYW5kaWRhdGUpO1xuXHRcdFx0fVxuXHRcdFx0Y2FuZGlkYXRlID0gY2FuZGlkYXRlLnBhcmVudDtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIE5vdGVib29rQ29tcGFyYXRvciBpbXBsZW1lbnRzIElPdXRsaW5lQ29tcGFyYXRvcjxPdXRsaW5lRW50cnk+IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jb2xsYXRvciA9IG5ldyBET00uV2luZG93SWRsZVZhbHVlPEludGwuQ29sbGF0b3I+KG1haW5XaW5kb3csICgpID0+IG5ldyBJbnRsLkNvbGxhdG9yKHVuZGVmaW5lZCwgeyBudW1lcmljOiB0cnVlIH0pKTtcblxuXHRjb21wYXJlQnlQb3NpdGlvbihhOiBPdXRsaW5lRW50cnksIGI6IE91dGxpbmVFbnRyeSk6IG51bWJlciB7XG5cdFx0cmV0dXJuIGEuaW5kZXggLSBiLmluZGV4O1xuXHR9XG5cdGNvbXBhcmVCeVR5cGUoYTogT3V0bGluZUVudHJ5LCBiOiBPdXRsaW5lRW50cnkpOiBudW1iZXIge1xuXHRcdHJldHVybiBhLmNlbGwuY2VsbEtpbmQgLSBiLmNlbGwuY2VsbEtpbmQgfHwgdGhpcy5fY29sbGF0b3IudmFsdWUuY29tcGFyZShhLmxhYmVsLCBiLmxhYmVsKTtcblx0fVxuXHRjb21wYXJlQnlOYW1lKGE6IE91dGxpbmVFbnRyeSwgYjogT3V0bGluZUVudHJ5KTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fY29sbGF0b3IudmFsdWUuY29tcGFyZShhLmxhYmVsLCBiLmxhYmVsKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tDZWxsT3V0bGluZSBpbXBsZW1lbnRzIElPdXRsaW5lPE91dGxpbmVFbnRyeT4ge1xuXHRyZWFkb25seSBvdXRsaW5lS2luZCA9ICdub3RlYm9va0NlbGxzJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWxEaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZGF0YVNvdXJjZURpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlID0gbmV3IEVtaXR0ZXI8T3V0bGluZUNoYW5nZUV2ZW50PigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8T3V0bGluZUNoYW5nZUV2ZW50PiA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZGVsYXllclJlY29tcHV0ZVN0YXRlOiBEZWxheWVyPHZvaWQ+ID0gdGhpcy5fZGlzcG9zYWJsZXMuYWRkKG5ldyBEZWxheWVyPHZvaWQ+KDMwMCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGRlbGF5ZXJSZWNvbXB1dGVBY3RpdmU6IERlbGF5ZXI8dm9pZD4gPSB0aGlzLl9kaXNwb3NhYmxlcy5hZGQobmV3IERlbGF5ZXI8dm9pZD4oMjAwKSk7XG5cdC8vIHRoaXMgY2FuIGJlIGxvbmcsIGJlY2F1c2UgaXQgd2lsbCBmb3JjZSBhIHJlY29tcHV0ZSBhdCB0aGUgZW5kLCBzbyBpZGVhbGx5IHdlIG9ubHkgZG8gdGhpcyBvbmNlIGFsbCBuYiBsYW5ndWFnZSBmZWF0dXJlcyBhcmUgcmVnaXN0ZXJlZFxuXHRwcml2YXRlIHJlYWRvbmx5IGRlbGF5ZXJSZWNvbXB1dGVTeW1ib2xzOiBEZWxheWVyPHZvaWQ+ID0gdGhpcy5fZGlzcG9zYWJsZXMuYWRkKG5ldyBEZWxheWVyPHZvaWQ+KDIwMDApKTtcblxuXHRyZWFkb25seSBjb25maWc6IElPdXRsaW5lTGlzdENvbmZpZzxPdXRsaW5lRW50cnk+O1xuXHRwcml2YXRlIF9vdXRsaW5lRGF0YVNvdXJjZVJlZmVyZW5jZTogSVJlZmVyZW5jZTxOb3RlYm9va0NlbGxPdXRsaW5lRGF0YVNvdXJjZT4gfCB1bmRlZmluZWQ7XG5cdC8vIFRoZXNlIHRocmVlIGZpZWxkcyB3aWxsIGFsd2F5cyBiZSBzZXQgdmlhIHNldERhdGFTb3VyY2VzKCkgb24gTDQ3NVxuXHRwcml2YXRlIF90cmVlRGF0YVNvdXJjZSE6IElEYXRhU291cmNlPE5vdGVib29rQ2VsbE91dGxpbmUsIE91dGxpbmVFbnRyeT47XG5cdHByaXZhdGUgX3F1aWNrUGlja0RhdGFTb3VyY2UhOiBJUXVpY2tQaWNrRGF0YVNvdXJjZTxPdXRsaW5lRW50cnk+O1xuXHRwcml2YXRlIF9icmVhZGNydW1ic0RhdGFTb3VyY2UhOiBJQnJlYWRjcnVtYnNEYXRhU291cmNlPE91dGxpbmVFbnRyeT47XG5cblx0Ly8gdmlldyBzZXR0aW5nc1xuXHRwcml2YXRlIG91dGxpbmVTaG93Q29kZUNlbGxzOiBib29sZWFuO1xuXHRwcml2YXRlIG91dGxpbmVTaG93Q29kZUNlbGxTeW1ib2xzOiBib29sZWFuO1xuXHRwcml2YXRlIG91dGxpbmVTaG93TWFya2Rvd25IZWFkZXJzT25seTogYm9vbGVhbjtcblxuXHQvLyBnZXR0ZXJzXG5cdGdldCBhY3RpdmVFbGVtZW50KCk6IE91dGxpbmVFbnRyeSB8IHVuZGVmaW5lZCB7XG5cdFx0dGhpcy5jaGVja0RlbGF5ZXIoKTtcblx0XHRpZiAodGhpcy5fdGFyZ2V0ID09PSBPdXRsaW5lVGFyZ2V0Lk91dGxpbmVQYW5lKSB7XG5cdFx0XHRyZXR1cm4gKHRoaXMuY29uZmlnLnRyZWVEYXRhU291cmNlIGFzIE5vdGVib29rT3V0bGluZVBhbmVQcm92aWRlcikuZ2V0QWN0aXZlRW50cnkoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc29sZS5lcnJvcignYWN0aXZlRWxlbWVudCBzaG91bGQgbm90IGJlIGNhbGxlZCBvdXRzaWRlIG9mIHRoZSBPdXRsaW5lUGFuZScpO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblx0Z2V0IGVudHJpZXMoKTogT3V0bGluZUVudHJ5W10ge1xuXHRcdHRoaXMuY2hlY2tEZWxheWVyKCk7XG5cdFx0cmV0dXJuIHRoaXMuX291dGxpbmVEYXRhU291cmNlUmVmZXJlbmNlPy5vYmplY3Q/LmVudHJpZXMgPz8gW107XG5cdH1cblx0Z2V0IHVyaSgpOiBVUkkgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9vdXRsaW5lRGF0YVNvdXJjZVJlZmVyZW5jZT8ub2JqZWN0Py51cmk7XG5cdH1cblx0Z2V0IGlzRW1wdHkoKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLl9vdXRsaW5lRGF0YVNvdXJjZVJlZmVyZW5jZT8ub2JqZWN0Py5lbnRyaWVzKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gIXRoaXMuX291dGxpbmVEYXRhU291cmNlUmVmZXJlbmNlLm9iamVjdC5lbnRyaWVzLnNvbWUoZW50cnkgPT4ge1xuXHRcdFx0cmV0dXJuICFmaWx0ZXJFbnRyeShlbnRyeSwgdGhpcy5vdXRsaW5lU2hvd01hcmtkb3duSGVhZGVyc09ubHksIHRoaXMub3V0bGluZVNob3dDb2RlQ2VsbHMsIHRoaXMub3V0bGluZVNob3dDb2RlQ2VsbFN5bWJvbHMpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBjaGVja0RlbGF5ZXIoKSB7XG5cdFx0aWYgKHRoaXMuZGVsYXllclJlY29tcHV0ZVN0YXRlLmlzVHJpZ2dlcmVkKCkpIHtcblx0XHRcdHRoaXMuZGVsYXllclJlY29tcHV0ZVN0YXRlLmNhbmNlbCgpO1xuXHRcdFx0dGhpcy5yZWNvbXB1dGVTdGF0ZSgpO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSU5vdGVib29rRWRpdG9yUGFuZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF90YXJnZXQ6IE91dGxpbmVUYXJnZXQsXG5cdFx0QElUaGVtZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSxcblx0XHRASU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlOiBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMub3V0bGluZVNob3dDb2RlQ2VsbHMgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihOb3RlYm9va1NldHRpbmcub3V0bGluZVNob3dDb2RlQ2VsbHMpO1xuXHRcdHRoaXMub3V0bGluZVNob3dDb2RlQ2VsbFN5bWJvbHMgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihOb3RlYm9va1NldHRpbmcub3V0bGluZVNob3dDb2RlQ2VsbFN5bWJvbHMpO1xuXHRcdHRoaXMub3V0bGluZVNob3dNYXJrZG93bkhlYWRlcnNPbmx5ID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oTm90ZWJvb2tTZXR0aW5nLm91dGxpbmVTaG93TWFya2Rvd25IZWFkZXJzT25seSk7XG5cblx0XHR0aGlzLmluaXRpYWxpemVPdXRsaW5lKCk7XG5cblx0XHRjb25zdCBkZWxlZ2F0ZSA9IG5ldyBOb3RlYm9va091dGxpbmVWaXJ0dWFsRGVsZWdhdGUoKTtcblx0XHRjb25zdCByZW5kZXJlcnMgPSBbdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90ZWJvb2tPdXRsaW5lUmVuZGVyZXIsIHRoaXMuX2VkaXRvci5nZXRDb250cm9sKCksIHRoaXMuX3RhcmdldCldO1xuXHRcdGNvbnN0IGNvbXBhcmF0b3IgPSBuZXcgTm90ZWJvb2tDb21wYXJhdG9yKCk7XG5cblx0XHRjb25zdCBvcHRpb25zOiBJV29ya2JlbmNoRGF0YVRyZWVPcHRpb25zPE91dGxpbmVFbnRyeSwgRnV6enlTY29yZT4gPSB7XG5cdFx0XHRjb2xsYXBzZUJ5RGVmYXVsdDogdGhpcy5fdGFyZ2V0ID09PSBPdXRsaW5lVGFyZ2V0LkJyZWFkY3J1bWJzIHx8ICh0aGlzLl90YXJnZXQgPT09IE91dGxpbmVUYXJnZXQuT3V0bGluZVBhbmUgJiYgdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoT3V0bGluZUNvbmZpZ0tleXMuY29sbGFwc2VJdGVtcykgPT09IE91dGxpbmVDb25maWdDb2xsYXBzZUl0ZW1zVmFsdWVzLkNvbGxhcHNlZCksXG5cdFx0XHRleHBhbmRPbmx5T25Ud2lzdGllQ2xpY2s6IHRydWUsXG5cdFx0XHRtdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ6IGZhbHNlLFxuXHRcdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyOiBuZXcgTm90ZWJvb2tPdXRsaW5lQWNjZXNzaWJpbGl0eSgpLFxuXHRcdFx0aWRlbnRpdHlQcm92aWRlcjogeyBnZXRJZDogZWxlbWVudCA9PiBlbGVtZW50LmNlbGwudXJpLnRvU3RyaW5nKCkgfSxcblx0XHRcdGtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXI6IG5ldyBOb3RlYm9va05hdmlnYXRpb25MYWJlbFByb3ZpZGVyKClcblx0XHR9O1xuXG5cdFx0dGhpcy5jb25maWcgPSB7XG5cdFx0XHR0cmVlRGF0YVNvdXJjZTogdGhpcy5fdHJlZURhdGFTb3VyY2UsXG5cdFx0XHRxdWlja1BpY2tEYXRhU291cmNlOiB0aGlzLl9xdWlja1BpY2tEYXRhU291cmNlLFxuXHRcdFx0YnJlYWRjcnVtYnNEYXRhU291cmNlOiB0aGlzLl9icmVhZGNydW1ic0RhdGFTb3VyY2UsXG5cdFx0XHRkZWxlZ2F0ZSxcblx0XHRcdHJlbmRlcmVycyxcblx0XHRcdGNvbXBhcmF0b3IsXG5cdFx0XHRvcHRpb25zXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgaW5pdGlhbGl6ZU91dGxpbmUoKSB7XG5cdFx0Ly8gaW5pdGlhbCBzZXR1cFxuXHRcdHRoaXMuc2V0RGF0YVNvdXJjZXMoKTtcblx0XHR0aGlzLnNldE1vZGVsTGlzdGVuZXJzKCk7XG5cblx0XHQvLyByZXNldCB0aGUgZGF0YSBzb3VyY2VzICsgbW9kZWwgbGlzdGVuZXJzIHdoZW4gd2UgZ2V0IGEgbmV3IG5vdGVib29rIG1vZGVsXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX2VkaXRvci5vbkRpZENoYW5nZU1vZGVsKCgpID0+IHtcblx0XHRcdHRoaXMuc2V0RGF0YVNvdXJjZXMoKTtcblx0XHRcdHRoaXMuc2V0TW9kZWxMaXN0ZW5lcnMoKTtcblx0XHRcdHRoaXMuY29tcHV0ZVN5bWJvbHMoKTtcblx0XHR9KSk7XG5cblx0XHQvLyByZWNvbXB1dGUgc3ltYm9scyBhcyBkb2N1bWVudCBzeW1ib2wgcHJvdmlkZXJzIGFyZSB1cGRhdGVkIGluIHRoZSBsYW5ndWFnZSBmZWF0dXJlcyByZWdpc3RyeVxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFN5bWJvbFByb3ZpZGVyLm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdHRoaXMuZGVsYXllZENvbXB1dGVTeW1ib2xzKCk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gcmVjb21wdXRlIGFjdGl2ZSB3aGVuIHRoZSBzZWxlY3Rpb24gY2hhbmdlc1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZCh0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VTZWxlY3Rpb24oKCkgPT4ge1xuXHRcdFx0dGhpcy5kZWxheWVkUmVjb21wdXRlQWN0aXZlKCk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gcmVjb21wdXRlIHN0YXRlIHdoZW4gZmlsdGVyIGNvbmZpZyBjaGFuZ2VzXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKE5vdGVib29rU2V0dGluZy5vdXRsaW5lU2hvd01hcmtkb3duSGVhZGVyc09ubHkpIHx8XG5cdFx0XHRcdGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oTm90ZWJvb2tTZXR0aW5nLm91dGxpbmVTaG93Q29kZUNlbGxzKSB8fFxuXHRcdFx0XHRlLmFmZmVjdHNDb25maWd1cmF0aW9uKE5vdGVib29rU2V0dGluZy5vdXRsaW5lU2hvd0NvZGVDZWxsU3ltYm9scykgfHxcblx0XHRcdFx0ZS5hZmZlY3RzQ29uZmlndXJhdGlvbihOb3RlYm9va1NldHRpbmcuYnJlYWRjcnVtYnNTaG93Q29kZUNlbGxzKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHRoaXMub3V0bGluZVNob3dDb2RlQ2VsbHMgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihOb3RlYm9va1NldHRpbmcub3V0bGluZVNob3dDb2RlQ2VsbHMpO1xuXHRcdFx0XHR0aGlzLm91dGxpbmVTaG93Q29kZUNlbGxTeW1ib2xzID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oTm90ZWJvb2tTZXR0aW5nLm91dGxpbmVTaG93Q29kZUNlbGxTeW1ib2xzKTtcblx0XHRcdFx0dGhpcy5vdXRsaW5lU2hvd01hcmtkb3duSGVhZGVyc09ubHkgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihOb3RlYm9va1NldHRpbmcub3V0bGluZVNob3dNYXJrZG93bkhlYWRlcnNPbmx5KTtcblxuXHRcdFx0XHR0aGlzLmRlbGF5ZWRSZWNvbXB1dGVTdGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIHJlY29tcHV0ZSBzdGF0ZSB3aGVuIGV4ZWN1dGlvbiBzdGF0ZXMgY2hhbmdlXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX25vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlLm9uRGlkQ2hhbmdlRXhlY3V0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUudHlwZSA9PT0gTm90ZWJvb2tFeGVjdXRpb25UeXBlLmNlbGwgJiYgISF0aGlzLl9lZGl0b3IudGV4dE1vZGVsICYmIGUuYWZmZWN0c05vdGVib29rKHRoaXMuX2VkaXRvci50ZXh0TW9kZWw/LnVyaSkpIHtcblx0XHRcdFx0dGhpcy5kZWxheWVkUmVjb21wdXRlU3RhdGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyByZWNvbXB1dGUgc3ltYm9scyB3aGVuIHRoZSBjb25maWd1cmF0aW9uIGNoYW5nZXMgKHJlY29tcHV0ZSBzdGF0ZSAtIGFuZCB0aGVyZWZvcmUgcmVjb21wdXRlIGFjdGl2ZSAtIGlzIGFsc28gY2FsbGVkIHdpdGhpbiBjb21wdXRlIHN5bWJvbHMpXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKE5vdGVib29rU2V0dGluZy5vdXRsaW5lU2hvd0NvZGVDZWxsU3ltYm9scykpIHtcblx0XHRcdFx0dGhpcy5vdXRsaW5lU2hvd0NvZGVDZWxsU3ltYm9scyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KE5vdGVib29rU2V0dGluZy5vdXRsaW5lU2hvd0NvZGVDZWxsU3ltYm9scyk7XG5cdFx0XHRcdHRoaXMuY29tcHV0ZVN5bWJvbHMoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBmaXJlIGEgY2hhbmdlIGV2ZW50IHdoZW4gdGhlIHRoZW1lIGNoYW5nZXNcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQodGhpcy5fdGhlbWVTZXJ2aWNlLm9uRGlkRmlsZUljb25UaGVtZUNoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHt9KTtcblx0XHR9KSk7XG5cblx0XHQvLyBmaW5pc2ggd2l0aCBhIHJlY29tcHV0ZSBzdGF0ZVxuXHRcdHRoaXMucmVjb21wdXRlU3RhdGUoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBzZXQgdXAgdGhlIHByaW1hcnkgZGF0YSBzb3VyY2UgKyB0aHJlZSB2aWV3aW5nIHNvdXJjZXMgZm9yIHRoZSB2YXJpb3VzIG91dGxpbmUgdmlld3Ncblx0ICovXG5cdHByaXZhdGUgc2V0RGF0YVNvdXJjZXMoKTogdm9pZCB7XG5cdFx0Y29uc3Qgbm90ZWJvb2tFZGl0b3IgPSB0aGlzLl9lZGl0b3IuZ2V0Q29udHJvbCgpO1xuXHRcdHRoaXMuX291dGxpbmVEYXRhU291cmNlUmVmZXJlbmNlPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fZGF0YVNvdXJjZURpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHRpZiAoIW5vdGVib29rRWRpdG9yPy5oYXNNb2RlbCgpKSB7XG5cdFx0XHR0aGlzLl9vdXRsaW5lRGF0YVNvdXJjZVJlZmVyZW5jZSA9IHVuZGVmaW5lZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fb3V0bGluZURhdGFTb3VyY2VSZWZlcmVuY2UgPSB0aGlzLl9kYXRhU291cmNlRGlzcG9zYWJsZXMuYWRkKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKChhY2Nlc3NvcikgPT4gYWNjZXNzb3IuZ2V0KElOb3RlYm9va0NlbGxPdXRsaW5lRGF0YVNvdXJjZUZhY3RvcnkpLmdldE9yQ3JlYXRlKG5vdGVib29rRWRpdG9yKSkpO1xuXHRcdFx0Ly8gZXNjYWxhdGUgb3V0bGluZSBkYXRhIHNvdXJjZSBjaGFuZ2UgZXZlbnRzXG5cdFx0XHR0aGlzLl9kYXRhU291cmNlRGlzcG9zYWJsZXMuYWRkKHRoaXMuX291dGxpbmVEYXRhU291cmNlUmVmZXJlbmNlLm9iamVjdC5vbkRpZENoYW5nZSgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoe30pO1xuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdC8vIHRoZXNlIGZpZWxkcyBjYW4gYmUgcGFzc2VkIHVuZGVmaW5lZCBvdXRsaW5lRGF0YVNvdXJjZXMuIFZpZXcgUHJvdmlkZXJzIGFsbCBoYW5kbGUgaXQgYWNjb3JkaW5nbHlcblx0XHR0aGlzLl90cmVlRGF0YVNvdXJjZSA9IHRoaXMuX2RhdGFTb3VyY2VEaXNwb3NhYmxlcy5hZGQodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90ZWJvb2tPdXRsaW5lUGFuZVByb3ZpZGVyLCB0aGlzLl9vdXRsaW5lRGF0YVNvdXJjZVJlZmVyZW5jZSkpO1xuXHRcdHRoaXMuX3F1aWNrUGlja0RhdGFTb3VyY2UgPSB0aGlzLl9kYXRhU291cmNlRGlzcG9zYWJsZXMuYWRkKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGVib29rUXVpY2tQaWNrUHJvdmlkZXIsIHRoaXMuX291dGxpbmVEYXRhU291cmNlUmVmZXJlbmNlKSk7XG5cdFx0dGhpcy5fYnJlYWRjcnVtYnNEYXRhU291cmNlID0gdGhpcy5fZGF0YVNvdXJjZURpc3Bvc2FibGVzLmFkZCh0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShOb3RlYm9va0JyZWFkY3J1bWJzUHJvdmlkZXIsIHRoaXMuX291dGxpbmVEYXRhU291cmNlUmVmZXJlbmNlKSk7XG5cdH1cblxuXHQvKipcblx0ICogc2V0IHVwIHRoZSBsaXN0ZW5lcnMgZm9yIHRoZSBvdXRsaW5lIGNvbnRlbnQsIHRoZXNlIHJlc3BvbmQgdG8gbW9kZWwgY2hhbmdlcyBpbiB0aGUgbm90ZWJvb2tcblx0ICovXG5cdHByaXZhdGUgc2V0TW9kZWxMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fbW9kZWxEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdGlmICghdGhpcy5fZWRpdG9yLnRleHRNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIFBlcmhhcHMgdGhpcyBpcyB0aGUgZmlyc3QgdGltZSB3ZSdyZSBidWlsZGluZyB0aGUgb3V0bGluZVxuXHRcdGlmICghdGhpcy5lbnRyaWVzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5jb21wdXRlU3ltYm9scygpO1xuXHRcdH1cblxuXHRcdC8vIHJlY29tcHV0ZSBzdGF0ZSB3aGVuIHRoZXJlIGFyZSBub3RlYm9vayBjb250ZW50IGNoYW5nZXNcblx0XHR0aGlzLl9tb2RlbERpc3Bvc2FibGVzLmFkZCh0aGlzLl9lZGl0b3IudGV4dE1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudChjb250ZW50Q2hhbmdlcyA9PiB7XG5cdFx0XHRpZiAoY29udGVudENoYW5nZXMucmF3RXZlbnRzLnNvbWUoYyA9PlxuXHRcdFx0XHRjLmtpbmQgPT09IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLkNoYW5nZUNlbGxDb250ZW50IHx8XG5cdFx0XHRcdGMua2luZCA9PT0gTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuQ2hhbmdlQ2VsbEludGVybmFsTWV0YWRhdGEgfHxcblx0XHRcdFx0Yy5raW5kID09PSBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5Nb3ZlIHx8XG5cdFx0XHRcdGMua2luZCA9PT0gTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuTW9kZWxDaGFuZ2UpKSB7XG5cdFx0XHRcdHRoaXMuZGVsYXllZFJlY29tcHV0ZVN0YXRlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjb21wdXRlU3ltYm9scyhjYW5jZWxUb2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4gPSBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSB7XG5cdFx0aWYgKHRoaXMuX3RhcmdldCA9PT0gT3V0bGluZVRhcmdldC5PdXRsaW5lUGFuZSAmJiB0aGlzLm91dGxpbmVTaG93Q29kZUNlbGxTeW1ib2xzKSB7XG5cdFx0XHQvLyBObyBuZWVkIHRvIHdhaXQgZm9yIHRoaXMsIHdlIHdhbnQgdGhlIG91dGxpbmUgdG8gc2hvdyB1cCBxdWlja2x5LlxuXHRcdFx0dm9pZCB0aGlzLmRvQ29tcHV0ZVN5bWJvbHMoY2FuY2VsVG9rZW4pO1xuXHRcdH1cblx0fVxuXHRwdWJsaWMgYXN5bmMgZG9Db21wdXRlU3ltYm9scyhjYW5jZWxUb2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLl9vdXRsaW5lRGF0YVNvdXJjZVJlZmVyZW5jZT8ub2JqZWN0Py5jb21wdXRlRnVsbFN5bWJvbHMoY2FuY2VsVG9rZW4pO1xuXHR9XG5cdHByaXZhdGUgYXN5bmMgZGVsYXllZENvbXB1dGVTeW1ib2xzKCkge1xuXHRcdHRoaXMuZGVsYXllclJlY29tcHV0ZVN0YXRlLmNhbmNlbCgpO1xuXHRcdHRoaXMuZGVsYXllclJlY29tcHV0ZUFjdGl2ZS5jYW5jZWwoKTtcblx0XHR0aGlzLmRlbGF5ZXJSZWNvbXB1dGVTeW1ib2xzLnRyaWdnZXIoKCkgPT4geyB0aGlzLmNvbXB1dGVTeW1ib2xzKCk7IH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZWNvbXB1dGVTdGF0ZSgpIHsgdGhpcy5fb3V0bGluZURhdGFTb3VyY2VSZWZlcmVuY2U/Lm9iamVjdD8ucmVjb21wdXRlU3RhdGUoKTsgfVxuXHRwcml2YXRlIGRlbGF5ZWRSZWNvbXB1dGVTdGF0ZSgpIHtcblx0XHR0aGlzLmRlbGF5ZXJSZWNvbXB1dGVBY3RpdmUuY2FuY2VsKCk7IC8vIEFjdGl2ZSBpcyBhbHdheXMgcmVjb21wdXRlZCBhZnRlciBhIHJlY29tcHV0aW5nIHRoZSBTdGF0ZS5cblx0XHR0aGlzLmRlbGF5ZXJSZWNvbXB1dGVTdGF0ZS50cmlnZ2VyKCgpID0+IHsgdGhpcy5yZWNvbXB1dGVTdGF0ZSgpOyB9KTtcblx0fVxuXG5cdHByaXZhdGUgcmVjb21wdXRlQWN0aXZlKCkgeyB0aGlzLl9vdXRsaW5lRGF0YVNvdXJjZVJlZmVyZW5jZT8ub2JqZWN0Py5yZWNvbXB1dGVBY3RpdmUoKTsgfVxuXHRwcml2YXRlIGRlbGF5ZWRSZWNvbXB1dGVBY3RpdmUoKSB7XG5cdFx0dGhpcy5kZWxheWVyUmVjb21wdXRlQWN0aXZlLnRyaWdnZXIoKCkgPT4geyB0aGlzLnJlY29tcHV0ZUFjdGl2ZSgpOyB9KTtcblx0fVxuXG5cdGFzeW5jIHJldmVhbChlbnRyeTogT3V0bGluZUVudHJ5LCBvcHRpb25zOiBJRWRpdG9yT3B0aW9ucywgc2lkZUJ5U2lkZTogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IG5vdGVib29rRWRpdG9yT3B0aW9uczogSU5vdGVib29rRWRpdG9yT3B0aW9ucyA9IHtcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRvdmVycmlkZTogdGhpcy5fZWRpdG9yLmlucHV0Py5lZGl0b3JJZCxcblx0XHRcdGNlbGxSZXZlYWxUeXBlOiBDZWxsUmV2ZWFsVHlwZS5OZWFyVG9wSWZPdXRzaWRlVmlld3BvcnQsXG5cdFx0XHRzZWxlY3Rpb246IGVudHJ5LnBvc2l0aW9uLFxuXHRcdFx0dmlld1N0YXRlOiB1bmRlZmluZWQsXG5cdFx0fTtcblx0XHRhd2FpdCB0aGlzLl9lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0cmVzb3VyY2U6IGVudHJ5LmNlbGwudXJpLFxuXHRcdFx0b3B0aW9uczogbm90ZWJvb2tFZGl0b3JPcHRpb25zLFxuXHRcdH0sIHNpZGVCeVNpZGUgPyBTSURFX0dST1VQIDogdW5kZWZpbmVkKTtcblx0fVxuXG5cdHByZXZpZXcoZW50cnk6IE91dGxpbmVFbnRyeSk6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCB3aWRnZXQgPSB0aGlzLl9lZGl0b3IuZ2V0Q29udHJvbCgpO1xuXHRcdGlmICghd2lkZ2V0KSB7XG5cdFx0XHRyZXR1cm4gRGlzcG9zYWJsZS5Ob25lO1xuXHRcdH1cblxuXG5cdFx0aWYgKGVudHJ5LnJhbmdlKSB7XG5cdFx0XHRjb25zdCByYW5nZSA9IFJhbmdlLmxpZnQoZW50cnkucmFuZ2UpO1xuXHRcdFx0d2lkZ2V0LnJldmVhbFJhbmdlSW5DZW50ZXJJZk91dHNpZGVWaWV3cG9ydEFzeW5jKGVudHJ5LmNlbGwsIHJhbmdlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0d2lkZ2V0LnJldmVhbEluQ2VudGVySWZPdXRzaWRlVmlld3BvcnQoZW50cnkuY2VsbCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaWRzID0gd2lkZ2V0LmRlbHRhQ2VsbERlY29yYXRpb25zKFtdLCBbe1xuXHRcdFx0aGFuZGxlOiBlbnRyeS5jZWxsLmhhbmRsZSxcblx0XHRcdG9wdGlvbnM6IHsgY2xhc3NOYW1lOiAnbmItc3ltYm9sSGlnaGxpZ2h0Jywgb3V0cHV0Q2xhc3NOYW1lOiAnbmItc3ltYm9sSGlnaGxpZ2h0JyB9XG5cdFx0fV0pO1xuXG5cdFx0bGV0IGVkaXRvckRlY29yYXRpb25zOiBJQ2VsbE1vZGVsRGVjb3JhdGlvbnNbXTtcblx0XHR3aWRnZXQuY2hhbmdlTW9kZWxEZWNvcmF0aW9ucyhhY2Nlc3NvciA9PiB7XG5cdFx0XHRpZiAoZW50cnkucmFuZ2UpIHtcblx0XHRcdFx0Y29uc3QgZGVjb3JhdGlvbnM6IElNb2RlbERlbHRhRGVjb3JhdGlvbltdID0gW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHJhbmdlOiBlbnRyeS5yYW5nZSwgb3B0aW9uczoge1xuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ2RvY3VtZW50LXN5bWJvbHMtb3V0bGluZS1yYW5nZS1oaWdobGlnaHQnLFxuXHRcdFx0XHRcdFx0XHRjbGFzc05hbWU6ICdyYW5nZUhpZ2hsaWdodCcsXG5cdFx0XHRcdFx0XHRcdGlzV2hvbGVMaW5lOiB0cnVlXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdO1xuXHRcdFx0XHRjb25zdCBkZWx0YURlY29yYXRpb246IElDZWxsTW9kZWxEZWx0YURlY29yYXRpb25zID0ge1xuXHRcdFx0XHRcdG93bmVySWQ6IGVudHJ5LmNlbGwuaGFuZGxlLFxuXHRcdFx0XHRcdGRlY29yYXRpb25zOiBkZWNvcmF0aW9uc1xuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdGVkaXRvckRlY29yYXRpb25zID0gYWNjZXNzb3IuZGVsdGFEZWNvcmF0aW9ucyhbXSwgW2RlbHRhRGVjb3JhdGlvbl0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR3aWRnZXQuZGVsdGFDZWxsRGVjb3JhdGlvbnMoaWRzLCBbXSk7XG5cdFx0XHRpZiAoZWRpdG9yRGVjb3JhdGlvbnM/Lmxlbmd0aCkge1xuXHRcdFx0XHR3aWRnZXQuY2hhbmdlTW9kZWxEZWNvcmF0aW9ucyhhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdFx0YWNjZXNzb3IuZGVsdGFEZWNvcmF0aW9ucyhlZGl0b3JEZWNvcmF0aW9ucywgW10pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHR9XG5cblx0Y2FwdHVyZVZpZXdTdGF0ZSgpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3Qgd2lkZ2V0ID0gdGhpcy5fZWRpdG9yLmdldENvbnRyb2woKTtcblx0XHRjb25zdCB2aWV3U3RhdGUgPSB3aWRnZXQ/LmdldEVkaXRvclZpZXdTdGF0ZSgpO1xuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0aWYgKHZpZXdTdGF0ZSkge1xuXHRcdFx0XHR3aWRnZXQ/LnJlc3RvcmVMaXN0Vmlld1N0YXRlKHZpZXdTdGF0ZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fbW9kZWxEaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fZGF0YVNvdXJjZURpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9vdXRsaW5lRGF0YVNvdXJjZVJlZmVyZW5jZT8uZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9va091dGxpbmVDcmVhdG9yIGltcGxlbWVudHMgSU91dGxpbmVDcmVhdG9yPE5vdGVib29rRWRpdG9yLCBPdXRsaW5lRW50cnk+IHtcblxuXHRyZWFkb25seSBkaXNwb3NlOiAoKSA9PiB2b2lkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJT3V0bGluZVNlcnZpY2Ugb3V0bGluZVNlcnZpY2U6IElPdXRsaW5lU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0Y29uc3QgcmVnID0gb3V0bGluZVNlcnZpY2UucmVnaXN0ZXJPdXRsaW5lQ3JlYXRvcih0aGlzKTtcblx0XHR0aGlzLmRpc3Bvc2UgPSAoKSA9PiByZWcuZGlzcG9zZSgpO1xuXHR9XG5cblx0bWF0Y2hlcyhjYW5kaWRhdGU6IElFZGl0b3JQYW5lKTogY2FuZGlkYXRlIGlzIE5vdGVib29rRWRpdG9yIHtcblx0XHRyZXR1cm4gY2FuZGlkYXRlLmdldElkKCkgPT09IE5vdGVib29rRWRpdG9yLklEO1xuXHR9XG5cblx0YXN5bmMgY3JlYXRlT3V0bGluZShlZGl0b3I6IElOb3RlYm9va0VkaXRvclBhbmUsIHRhcmdldDogT3V0bGluZVRhcmdldCwgY2FuY2VsVG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJT3V0bGluZTxPdXRsaW5lRW50cnk+IHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3Qgb3V0bGluZSA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGVib29rQ2VsbE91dGxpbmUsIGVkaXRvciwgdGFyZ2V0KTtcblx0XHRpZiAodGFyZ2V0ID09PSBPdXRsaW5lVGFyZ2V0LlF1aWNrUGljaykge1xuXHRcdFx0Ly8gVGhlIHF1aWNrcGljayBjcmVhdGVzIHRoZSBvdXRsaW5lIG9uIGRlbWFuZFxuXHRcdFx0Ly8gc28gd2UgbmVlZCB0byBlbnN1cmUgdGhlIHN5bWJvbHMgYXJlIHByZS1jYWNoZWQgYmVmb3JlIHRoZSBlbnRyaWVzIGFyZSBzeW5jcm9ub3VzbHkgcmVxdWVzdGVkXG5cdFx0XHRhd2FpdCBvdXRsaW5lLmRvQ29tcHV0ZVN5bWJvbHMoY2FuY2VsVG9rZW4pO1xuXHRcdH1cblx0XHRyZXR1cm4gb3V0bGluZTtcblx0fVxufVxuXG5leHBvcnQgY29uc3QgTm90ZWJvb2tPdXRsaW5lQ29udGV4dCA9IHtcblx0Q2VsbEtpbmQ6IG5ldyBSYXdDb250ZXh0S2V5PENlbGxLaW5kPignbm90ZWJvb2tDZWxsS2luZCcsIHVuZGVmaW5lZCksXG5cdENlbGxIYXNDaGlsZHJlbjogbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ25vdGVib29rQ2VsbEhhc0NoaWxkcmVuJywgZmFsc2UpLFxuXHRDZWxsSGFzSGVhZGVyOiBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignbm90ZWJvb2tDZWxsSGFzSGVhZGVyJywgZmFsc2UpLFxuXHRDZWxsRm9sZGluZ1N0YXRlOiBuZXcgUmF3Q29udGV4dEtleTxDZWxsRm9sZGluZ1N0YXRlPignbm90ZWJvb2tDZWxsRm9sZGluZ1N0YXRlJywgQ2VsbEZvbGRpbmdTdGF0ZS5Ob25lKSxcblx0T3V0bGluZUVsZW1lbnRUYXJnZXQ6IG5ldyBSYXdDb250ZXh0S2V5PE91dGxpbmVUYXJnZXQ+KCdub3RlYm9va091dGxpbmVFbGVtZW50VGFyZ2V0JywgdW5kZWZpbmVkKSxcbn07XG5cblJlZ2lzdHJ5LmFzPElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnk+KFdvcmtiZW5jaEV4dGVuc2lvbnMuV29ya2JlbmNoKS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihOb3RlYm9va091dGxpbmVDcmVhdG9yLCBMaWZlY3ljbGVQaGFzZS5FdmVudHVhbGx5KTtcblxuUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbikucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0aWQ6ICdub3RlYm9vaycsXG5cdG9yZGVyOiAxMDAsXG5cdHR5cGU6ICdvYmplY3QnLFxuXHQncHJvcGVydGllcyc6IHtcblx0XHRbTm90ZWJvb2tTZXR0aW5nLm91dGxpbmVTaG93TWFya2Rvd25IZWFkZXJzT25seV06IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnb3V0bGluZS5zaG93TWFya2Rvd25IZWFkZXJzT25seScsIFwiV2hlbiBlbmFibGVkLCBub3RlYm9vayBvdXRsaW5lIHdpbGwgc2hvdyBvbmx5IG1hcmtkb3duIGNlbGxzIGNvbnRhaW5pbmcgYSBoZWFkZXIuXCIpXG5cdFx0fSxcblx0XHRbTm90ZWJvb2tTZXR0aW5nLm91dGxpbmVTaG93Q29kZUNlbGxzXToge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnb3V0bGluZS5zaG93Q29kZUNlbGxzJywgXCJXaGVuIGVuYWJsZWQsIG5vdGVib29rIG91dGxpbmUgc2hvd3MgY29kZSBjZWxscy5cIilcblx0XHR9LFxuXHRcdFtOb3RlYm9va1NldHRpbmcub3V0bGluZVNob3dDb2RlQ2VsbFN5bWJvbHNdOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ291dGxpbmUuc2hvd0NvZGVDZWxsU3ltYm9scycsIFwiV2hlbiBlbmFibGVkLCBub3RlYm9vayBvdXRsaW5lIHNob3dzIGNvZGUgY2VsbCBzeW1ib2xzLiBSZWxpZXMgb24gYG5vdGVib29rLm91dGxpbmUuc2hvd0NvZGVDZWxsc2AgYmVpbmcgZW5hYmxlZC5cIilcblx0XHR9LFxuXHRcdFtOb3RlYm9va1NldHRpbmcuYnJlYWRjcnVtYnNTaG93Q29kZUNlbGxzXToge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdicmVhZGNydW1icy5zaG93Q29kZUNlbGxzJywgXCJXaGVuIGVuYWJsZWQsIG5vdGVib29rIGJyZWFkY3J1bWJzIGNvbnRhaW4gY29kZSBjZWxscy5cIilcblx0XHR9LFxuXHRcdFtOb3RlYm9va1NldHRpbmcuZ290b1N5bWJvbHNBbGxTeW1ib2xzXToge1xuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdub3RlYm9vay5nb3RvU3ltYm9scy5zaG93QWxsU3ltYm9scycsIFwiV2hlbiBlbmFibGVkLCB0aGUgR28gdG8gU3ltYm9sIFF1aWNrIFBpY2sgd2lsbCBkaXNwbGF5IGZ1bGwgY29kZSBzeW1ib2xzIGZyb20gdGhlIG5vdGVib29rLCBhcyB3ZWxsIGFzIE1hcmtkb3duIGhlYWRlcnMuXCIpXG5cdFx0fSxcblx0fVxufSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuVmlld1RpdGxlLCB7XG5cdHN1Ym1lbnU6IE1lbnVJZC5Ob3RlYm9va091dGxpbmVGaWx0ZXIsXG5cdHRpdGxlOiBsb2NhbGl6ZSgnZmlsdGVyJywgXCJGaWx0ZXIgRW50cmllc1wiKSxcblx0aWNvbjogQ29kaWNvbi5maWx0ZXIsXG5cdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdG9yZGVyOiAtMSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIElPdXRsaW5lUGFuZS5JZCksIE5PVEVCT09LX0lTX0FDVElWRV9FRElUT1IpLFxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBUb2dnbGVTaG93TWFya2Rvd25IZWFkZXJzT25seSBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ25vdGVib29rLm91dGxpbmUudG9nZ2xlU2hvd01hcmtkb3duSGVhZGVyc09ubHknLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCd0b2dnbGVTaG93TWFya2Rvd25IZWFkZXJzT25seScsIFwiTWFya2Rvd24gSGVhZGVycyBPbmx5XCIpLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0dG9nZ2xlZDoge1xuXHRcdFx0XHRjb25kaXRpb246IENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLm5vdGVib29rLm91dGxpbmUuc2hvd01hcmtkb3duSGVhZGVyc09ubHknLCB0cnVlKVxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5Ob3RlYm9va091dGxpbmVGaWx0ZXIsXG5cdFx0XHRcdGdyb3VwOiAnMF9tYXJrZG93bl9jZWxscycsXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBzaG93TWFya2Rvd25IZWFkZXJzT25seSA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KE5vdGVib29rU2V0dGluZy5vdXRsaW5lU2hvd01hcmtkb3duSGVhZGVyc09ubHkpO1xuXHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKE5vdGVib29rU2V0dGluZy5vdXRsaW5lU2hvd01hcmtkb3duSGVhZGVyc09ubHksICFzaG93TWFya2Rvd25IZWFkZXJzT25seSk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgVG9nZ2xlQ29kZUNlbGxFbnRyaWVzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnbm90ZWJvb2sub3V0bGluZS50b2dnbGVDb2RlQ2VsbHMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCd0b2dnbGVDb2RlQ2VsbHMnLCBcIkNvZGUgQ2VsbHNcIiksXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHR0b2dnbGVkOiB7XG5cdFx0XHRcdGNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcubm90ZWJvb2sub3V0bGluZS5zaG93Q29kZUNlbGxzJywgdHJ1ZSlcblx0XHRcdH0sXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuTm90ZWJvb2tPdXRsaW5lRmlsdGVyLFxuXHRcdFx0XHRvcmRlcjogMSxcblx0XHRcdFx0Z3JvdXA6ICcxX2NvZGVfY2VsbHMnLFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSkge1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3Qgc2hvd0NvZGVDZWxscyA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KE5vdGVib29rU2V0dGluZy5vdXRsaW5lU2hvd0NvZGVDZWxscyk7XG5cdFx0Y29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoTm90ZWJvb2tTZXR0aW5nLm91dGxpbmVTaG93Q29kZUNlbGxzLCAhc2hvd0NvZGVDZWxscyk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgVG9nZ2xlQ29kZUNlbGxTeW1ib2xFbnRyaWVzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnbm90ZWJvb2sub3V0bGluZS50b2dnbGVDb2RlQ2VsbFN5bWJvbHMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCd0b2dnbGVDb2RlQ2VsbFN5bWJvbHMnLCBcIkNvZGUgQ2VsbCBTeW1ib2xzXCIpLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0dG9nZ2xlZDoge1xuXHRcdFx0XHRjb25kaXRpb246IENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLm5vdGVib29rLm91dGxpbmUuc2hvd0NvZGVDZWxsU3ltYm9scycsIHRydWUpXG5cdFx0XHR9LFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLk5vdGVib29rT3V0bGluZUZpbHRlcixcblx0XHRcdFx0b3JkZXI6IDIsXG5cdFx0XHRcdGdyb3VwOiAnMV9jb2RlX2NlbGxzJyxcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IHNob3dDb2RlQ2VsbFN5bWJvbHMgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihOb3RlYm9va1NldHRpbmcub3V0bGluZVNob3dDb2RlQ2VsbFN5bWJvbHMpO1xuXHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKE5vdGVib29rU2V0dGluZy5vdXRsaW5lU2hvd0NvZGVDZWxsU3ltYm9scywgIXNob3dDb2RlQ2VsbFN5bWJvbHMpO1xuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsZUFBZTtBQUN4QixTQUFpQyxpQkFBaUI7QUFJbEQsU0FBUyxlQUFzQjtBQUMv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
