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
import "./media/scm.css";
import * as platform from "../../../../base/common/platform.js";
import { $, append, h, reset } from "../../../../base/browser/dom.js";
import { IconLabel } from "../../../../base/browser/ui/iconLabel/iconLabel.js";
import { fromNow, safeIntl } from "../../../../base/common/date.js";
import { createMatches } from "../../../../base/common/filters.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { autorun, autorunWithStore, derived, observableValue, waitForState, constObservable, latestChangedValue, observableFromEvent, runOnChange, observableSignal } from "../../../../base/common/observable.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IHoverService, WorkbenchHoverDelegate } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { WorkbenchAsyncDataTree } from "../../../../platform/list/browser/listService.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { asCssVariable, foreground } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ViewAction, ViewPane, ViewPaneShowActions } from "../../../browser/parts/views/viewPane.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../common/views.js";
import { renderSCMHistoryItemGraph, toISCMHistoryItemViewModelArray, SWIMLANE_WIDTH, renderSCMHistoryGraphPlaceholder, historyItemHoverDeletionsForeground, historyItemHoverLabelForeground, historyItemHoverAdditionsForeground, historyItemHoverDefaultLabelForeground, historyItemHoverDefaultLabelBackground } from "./scmHistory.js";
import { getHistoryItemEditorTitle, getProviderKey, isSCMHistoryItemLoadMoreTreeElement, isSCMHistoryItemViewModelTreeElement, isSCMRepository } from "./util.js";
import { HISTORY_VIEW_PANE_ID, ISCMService, ISCMViewService } from "../common/scm.js";
import { stripIcons } from "../../../../base/common/iconLabels.js";
import { IWorkbenchLayoutService, Position } from "../../../services/layout/browser/layoutService.js";
import { HoverPosition } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { Action2, IMenuService, isIMenuItem, MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { Sequencer, Throttler } from "../../../../base/common/async.js";
import { URI } from "../../../../base/common/uri.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ActionRunner } from "../../../../base/common/actions.js";
import { delta, groupBy } from "../../../../base/common/arrays.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { IProgressService } from "../../../../platform/progress/common/progress.js";
import { ContextKeys } from "./scmViewPane.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { Event } from "../../../../base/common/event.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { clamp } from "../../../../base/common/numbers.js";
import { observableConfigValue } from "../../../../platform/observable/common/platformObservableUtils.js";
import { compare } from "../../../../base/common/strings.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { groupBy as groupBy2 } from "../../../../base/common/collections.js";
import { getFlatContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
const PICK_REPOSITORY_ACTION_ID = "workbench.scm.action.graph.pickRepository";
const PICK_HISTORY_ITEM_REFS_ACTION_ID = "workbench.scm.action.graph.pickHistoryItemRefs";
class SCMRepositoryActionViewItem extends ActionViewItem {
  constructor(_repository, action, options) {
    super(null, action, { ...options, icon: false, label: true });
    this._repository = _repository;
  }
  updateLabel() {
    if (this.options.label && this.label) {
      this.label.classList.add("scm-graph-repository-picker");
      const icon = $(".icon");
      icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.repo));
      const name = $(".name");
      name.textContent = this._repository.provider.name;
      reset(this.label, icon, name);
    }
  }
  getTooltip() {
    return this._repository.provider.name;
  }
}
class SCMHistoryItemRefsActionViewItem extends ActionViewItem {
  constructor(_repository, _historyItemsFilter, action, options) {
    super(null, action, { ...options, icon: false, label: true });
    this._repository = _repository;
    this._historyItemsFilter = _historyItemsFilter;
  }
  updateLabel() {
    if (this.options.label && this.label) {
      this.label.classList.add("scm-graph-history-item-picker");
      const icon = $(".icon");
      icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.gitBranch));
      const name = $(".name");
      if (this._historyItemsFilter === "all") {
        name.textContent = localize("all", "All");
      } else if (this._historyItemsFilter === "auto") {
        name.textContent = localize("auto", "Auto");
      } else if (this._historyItemsFilter.length === 1) {
        name.textContent = this._historyItemsFilter[0].name;
      } else {
        name.textContent = localize("items", "{0} Items", this._historyItemsFilter.length);
      }
      reset(this.label, icon, name);
    }
  }
  getTooltip() {
    if (this._historyItemsFilter === "all") {
      return localize("allHistoryItemRefs", "All history item references");
    } else if (this._historyItemsFilter === "auto") {
      const historyProvider = this._repository.provider.historyProvider.get();
      return [
        historyProvider?.historyItemRef.get()?.name,
        historyProvider?.historyItemRemoteRef.get()?.name,
        historyProvider?.historyItemBaseRef.get()?.name
      ].filter((ref) => !!ref).join(", ");
    } else if (this._historyItemsFilter.length === 1) {
      return this._historyItemsFilter[0].name;
    } else {
      return this._historyItemsFilter.map((ref) => ref.name).join(", ");
    }
  }
}
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: PICK_REPOSITORY_ACTION_ID,
      title: localize("repositoryPicker", "Repository Picker"),
      viewId: HISTORY_VIEW_PANE_ID,
      f1: false,
      menu: {
        id: MenuId.SCMHistoryTitle,
        when: ContextKeyExpr.and(ContextKeyExpr.has("scm.providerCount"), ContextKeyExpr.greater("scm.providerCount", 1)),
        group: "navigation",
        order: 0
      }
    });
  }
  async runInView(_, view) {
    view.pickRepository();
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: PICK_HISTORY_ITEM_REFS_ACTION_ID,
      title: localize("referencePicker", "History Item Reference Picker"),
      icon: Codicon.gitBranch,
      viewId: HISTORY_VIEW_PANE_ID,
      precondition: ContextKeys.SCMHistoryItemCount.notEqualsTo(0),
      f1: false,
      menu: {
        id: MenuId.SCMHistoryTitle,
        group: "navigation",
        order: 1
      }
    });
  }
  async runInView(_, view) {
    view.pickHistoryItemRef();
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "workbench.scm.action.graph.revealCurrentHistoryItem",
      title: localize("goToCurrentHistoryItem", "Go to Current History Item"),
      icon: Codicon.target,
      viewId: HISTORY_VIEW_PANE_ID,
      precondition: ContextKeyExpr.and(
        ContextKeys.SCMHistoryItemCount.notEqualsTo(0),
        ContextKeys.SCMCurrentHistoryItemRefInFilter.isEqualTo(true)
      ),
      f1: false,
      menu: {
        id: MenuId.SCMHistoryTitle,
        group: "navigation",
        order: 2
      }
    });
  }
  async runInView(_, view) {
    view.revealCurrentHistoryItem();
  }
});
registerAction2(class extends ViewAction {
  constructor() {
    super({
      id: "workbench.scm.action.graph.refresh",
      title: localize("refreshGraph", "Refresh"),
      viewId: HISTORY_VIEW_PANE_ID,
      f1: false,
      icon: Codicon.refresh,
      menu: {
        id: MenuId.SCMHistoryTitle,
        group: "navigation",
        order: 1e3
      }
    });
  }
  async runInView(_, view) {
    view.refresh();
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.scm.action.graph.viewChanges",
      title: localize("openChanges", "Open Changes"),
      f1: false,
      menu: [
        {
          id: MenuId.SCMHistoryItemContext,
          when: ContextKeyExpr.equals("config.multiDiffEditor.experimental.enabled", true),
          group: "0_view",
          order: 1
        }
      ]
    });
  }
  async run(accessor, provider, ...historyItems) {
    const commandService = accessor.get(ICommandService);
    if (!provider || historyItems.length === 0) {
      return;
    }
    const historyItem = historyItems[0];
    const historyItemLast = historyItems[historyItems.length - 1];
    const historyProvider = provider.historyProvider.get();
    if (historyItems.length > 1) {
      const ancestor = await historyProvider?.resolveHistoryItemRefsCommonAncestor([historyItem.id, historyItemLast.id]);
      if (!ancestor || ancestor !== historyItem.id && ancestor !== historyItemLast.id) {
        return;
      }
    }
    const historyItemParentId = historyItemLast.parentIds.length > 0 ? historyItemLast.parentIds[0] : void 0;
    const historyItemChanges = await historyProvider?.provideHistoryItemChanges(historyItem.id, historyItemParentId);
    if (!historyItemChanges?.length) {
      return;
    }
    const title = historyItems.length === 1 ? getHistoryItemEditorTitle(historyItem) : localize("historyItemChangesEditorTitle", "All Changes ({0} \u2194 {1})", historyItemLast.displayId ?? historyItemLast.id, historyItem.displayId ?? historyItem.id);
    const rootUri = provider.rootUri;
    const path = rootUri ? rootUri.path : provider.label;
    const multiDiffSourceUri = URI.from({ scheme: "scm-history-item", path: `${path}/${historyItemParentId}..${historyItem.id}` }, true);
    commandService.executeCommand("_workbench.openMultiDiffEditor", { title, multiDiffSourceUri, resources: historyItemChanges });
  }
});
class ListDelegate {
  getHeight() {
    return 22;
  }
  getTemplateId(element) {
    if (isSCMHistoryItemViewModelTreeElement(element)) {
      return HistoryItemRenderer.TEMPLATE_ID;
    } else if (isSCMHistoryItemLoadMoreTreeElement(element)) {
      return HistoryItemLoadMoreRenderer.TEMPLATE_ID;
    } else {
      throw new Error("Unknown element");
    }
  }
}
let HistoryItemRenderer = class {
  constructor(hoverDelegate, _clipboardService, _configurationService, _contextKeyService, _hoverService, _menuService, _themeService) {
    this.hoverDelegate = hoverDelegate;
    this._clipboardService = _clipboardService;
    this._configurationService = _configurationService;
    this._contextKeyService = _contextKeyService;
    this._hoverService = _hoverService;
    this._menuService = _menuService;
    this._themeService = _themeService;
    this._badgesConfig = observableConfigValue("scm.graph.badges", "filter", this._configurationService);
  }
  get templateId() {
    return HistoryItemRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    container.parentElement.parentElement.querySelector(".monaco-tl-twistie").classList.add("force-no-twistie");
    const element = append(container, $(".history-item"));
    const graphContainer = append(element, $(".graph-container"));
    const iconLabel = new IconLabel(element, { supportIcons: true, supportHighlights: true, supportDescriptionHighlights: true });
    const labelContainer = append(element, $(".label-container"));
    element.appendChild(labelContainer);
    return { element, graphContainer, label: iconLabel, labelContainer, elementDisposables: new DisposableStore(), disposables: new DisposableStore() };
  }
  renderElement(node, index, templateData, height) {
    const provider = node.element.repository.provider;
    const historyItemViewModel = node.element.historyItemViewModel;
    const historyItem = historyItemViewModel.historyItem;
    const historyItemHover = this._hoverService.setupManagedHover(this.hoverDelegate, templateData.element, this._getHoverContent(node.element), {
      actions: this._getHoverActions(provider, historyItem)
    });
    templateData.elementDisposables.add(historyItemHover);
    templateData.graphContainer.textContent = "";
    templateData.graphContainer.classList.toggle("current", historyItemViewModel.isCurrent);
    templateData.graphContainer.appendChild(renderSCMHistoryItemGraph(historyItemViewModel));
    const historyItemRef = provider.historyProvider.get()?.historyItemRef?.get();
    const extraClasses = historyItemRef?.revision === historyItem.id ? ["history-item-current"] : [];
    const [matches, descriptionMatches] = this._processMatches(historyItemViewModel, node.filterData);
    templateData.label.setLabel(historyItem.subject, historyItem.author, { matches, descriptionMatches, extraClasses });
    this._renderBadges(historyItem, templateData);
  }
  _renderBadges(historyItem, templateData) {
    templateData.elementDisposables.add(autorun((reader) => {
      const labelConfig = this._badgesConfig.read(reader);
      templateData.labelContainer.textContent = "";
      const references = historyItem.references ? historyItem.references.slice(0) : [];
      if (references.length > 0 && references[0].color) {
        this._renderBadge([references[0]], true, templateData);
        references.splice(0, 1);
      }
      const historyItemRefsByColor = groupBy2(references, (ref) => ref.color ? ref.color : "");
      for (const [key, historyItemRefs] of Object.entries(historyItemRefsByColor)) {
        if (key === "" && labelConfig !== "all") {
          continue;
        }
        const historyItemRefByIconId = groupBy2(historyItemRefs, (ref) => ThemeIcon.isThemeIcon(ref.icon) ? ref.icon.id : "");
        for (const [key2, historyItemRefs2] of Object.entries(historyItemRefByIconId)) {
          if (key2 === "") {
            continue;
          }
          this._renderBadge(historyItemRefs2, false, templateData);
        }
      }
    }));
  }
  _renderBadge(historyItemRefs, showDescription, templateData) {
    if (historyItemRefs.length === 0 || !ThemeIcon.isThemeIcon(historyItemRefs[0].icon)) {
      return;
    }
    const elements = h("div.label", {
      style: {
        color: historyItemRefs[0].color ? asCssVariable(historyItemHoverLabelForeground) : asCssVariable(foreground),
        backgroundColor: historyItemRefs[0].color ? asCssVariable(historyItemRefs[0].color) : asCssVariable(historyItemHoverDefaultLabelBackground)
      }
    }, [
      h("div.count@count", {
        style: {
          display: historyItemRefs.length > 1 ? "" : "none"
        }
      }),
      h("div.icon@icon"),
      h("div.description@description", {
        style: {
          display: showDescription ? "" : "none"
        }
      })
    ]);
    elements.count.textContent = historyItemRefs.length > 1 ? historyItemRefs.length.toString() : "";
    elements.icon.classList.add(...ThemeIcon.asClassNameArray(historyItemRefs[0].icon));
    elements.description.textContent = showDescription ? historyItemRefs[0].name : "";
    append(templateData.labelContainer, elements.root);
  }
  _getHoverActions(provider, historyItem) {
    const actions = this._menuService.getMenuActions(MenuId.SCMHistoryItemHover, this._contextKeyService, {
      arg: provider,
      shouldForwardArgs: true
    }).flatMap((item) => item[1]);
    return [
      {
        commandId: "workbench.scm.action.graph.copyHistoryItemId",
        iconClass: "codicon.codicon-copy",
        label: historyItem.displayId ?? historyItem.id,
        run: () => this._clipboardService.writeText(historyItem.id)
      },
      ...actions.map((action) => {
        const iconClass = ThemeIcon.isThemeIcon(action.item.icon) ? ThemeIcon.asClassNameArray(action.item.icon).join(".") : void 0;
        return {
          commandId: action.id,
          label: action.label,
          iconClass,
          run: () => action.run(historyItem)
        };
      })
    ];
  }
  _getHoverContent(element) {
    const colorTheme = this._themeService.getColorTheme();
    const historyItem = element.historyItemViewModel.historyItem;
    const markdown = new MarkdownString("", { isTrusted: true, supportThemeIcons: true });
    if (historyItem.author) {
      const icon = URI.isUri(historyItem.authorIcon) ? `![${historyItem.author}](${historyItem.authorIcon.toString()}|width=20,height=20)` : ThemeIcon.isThemeIcon(historyItem.authorIcon) ? `$(${historyItem.authorIcon.id})` : "$(account)";
      if (historyItem.authorEmail) {
        const emailTitle = localize("emailLinkTitle", "Email");
        markdown.appendMarkdown(`${icon} [**${historyItem.author}**](mailto:${historyItem.authorEmail} "${emailTitle} ${historyItem.author}")`);
      } else {
        markdown.appendMarkdown(`${icon} **${historyItem.author}**`);
      }
      if (historyItem.timestamp) {
        const dateFormatter = safeIntl.DateTimeFormat(platform.language, { year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "numeric" });
        markdown.appendMarkdown(`, $(history) ${fromNow(historyItem.timestamp, true, true)} (${dateFormatter.format(historyItem.timestamp)})`);
      }
      markdown.appendMarkdown("\n\n");
    }
    markdown.appendMarkdown(`${historyItem.message}

`);
    if (historyItem.statistics) {
      markdown.appendMarkdown(`---

`);
      markdown.appendMarkdown(`<span>${historyItem.statistics.files === 1 ? localize("fileChanged", "{0} file changed", historyItem.statistics.files) : localize("filesChanged", "{0} files changed", historyItem.statistics.files)}</span>`);
      if (historyItem.statistics.insertions) {
        const additionsForegroundColor = colorTheme.getColor(historyItemHoverAdditionsForeground);
        markdown.appendMarkdown(`,&nbsp;<span style="color:${additionsForegroundColor};">${historyItem.statistics.insertions === 1 ? localize("insertion", "{0} insertion{1}", historyItem.statistics.insertions, "(+)") : localize("insertions", "{0} insertions{1}", historyItem.statistics.insertions, "(+)")}</span>`);
      }
      if (historyItem.statistics.deletions) {
        const deletionsForegroundColor = colorTheme.getColor(historyItemHoverDeletionsForeground);
        markdown.appendMarkdown(`,&nbsp;<span style="color:${deletionsForegroundColor};">${historyItem.statistics.deletions === 1 ? localize("deletion", "{0} deletion{1}", historyItem.statistics.deletions, "(-)") : localize("deletions", "{0} deletions{1}", historyItem.statistics.deletions, "(-)")}</span>`);
      }
    }
    if ((historyItem.references ?? []).length > 0) {
      markdown.appendMarkdown(`

---

`);
      markdown.appendMarkdown((historyItem.references ?? []).map((ref) => {
        const labelIconId = ThemeIcon.isThemeIcon(ref.icon) ? ref.icon.id : "";
        const labelBackgroundColor = ref.color ? asCssVariable(ref.color) : asCssVariable(historyItemHoverDefaultLabelBackground);
        const labelForegroundColor = ref.color ? asCssVariable(historyItemHoverLabelForeground) : asCssVariable(historyItemHoverDefaultLabelForeground);
        return `<span style="color:${labelForegroundColor};background-color:${labelBackgroundColor};border-radius:10px;">&nbsp;$(${labelIconId})&nbsp;${ref.name}&nbsp;&nbsp;</span>`;
      }).join("&nbsp;&nbsp;"));
    }
    return { markdown, markdownNotSupportedFallback: historyItem.message };
  }
  _processMatches(historyItemViewModel, filterData) {
    if (!filterData) {
      return [void 0, void 0];
    }
    return [
      historyItemViewModel.historyItem.message === filterData.label ? createMatches(filterData.score) : void 0,
      historyItemViewModel.historyItem.author === filterData.label ? createMatches(filterData.score) : void 0
    ];
  }
  disposeElement(element, index, templateData, height) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
};
HistoryItemRenderer.TEMPLATE_ID = "history-item";
HistoryItemRenderer = __decorateClass([
  __decorateParam(1, IClipboardService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, IMenuService),
  __decorateParam(6, IThemeService)
], HistoryItemRenderer);
let HistoryItemLoadMoreRenderer = class {
  constructor(_isLoadingMore, _loadMoreCallback, _configurationService) {
    this._isLoadingMore = _isLoadingMore;
    this._loadMoreCallback = _loadMoreCallback;
    this._configurationService = _configurationService;
  }
  get templateId() {
    return HistoryItemLoadMoreRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    container.parentElement.parentElement.querySelector(".monaco-tl-twistie").classList.add("force-no-twistie");
    const element = append(container, $(".history-item-load-more"));
    const graphPlaceholder = append(element, $(".graph-placeholder"));
    const historyItemPlaceholderContainer = append(element, $(".history-item-placeholder"));
    const historyItemPlaceholderLabel = new IconLabel(historyItemPlaceholderContainer, { supportIcons: true });
    return { element, graphPlaceholder, historyItemPlaceholderContainer, historyItemPlaceholderLabel, elementDisposables: new DisposableStore(), disposables: new DisposableStore() };
  }
  renderElement(element, index, templateData, height) {
    templateData.graphPlaceholder.textContent = "";
    templateData.graphPlaceholder.style.width = `${SWIMLANE_WIDTH * (element.element.graphColumns.length + 1)}px`;
    templateData.graphPlaceholder.appendChild(renderSCMHistoryGraphPlaceholder(element.element.graphColumns));
    const pageOnScroll = this._configurationService.getValue("scm.graph.pageOnScroll") === true;
    templateData.historyItemPlaceholderContainer.classList.toggle("shimmer", pageOnScroll);
    if (pageOnScroll) {
      templateData.historyItemPlaceholderLabel.setLabel("");
      this._loadMoreCallback();
    } else {
      templateData.elementDisposables.add(autorun((reader) => {
        const isLoadingMore = this._isLoadingMore.read(reader);
        const icon = `$(${isLoadingMore ? "loading~spin" : "fold-down"})`;
        templateData.historyItemPlaceholderLabel.setLabel(localize("loadMore", "{0} Load More...", icon));
      }));
    }
  }
  disposeElement(element, index, templateData, height) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
};
HistoryItemLoadMoreRenderer.TEMPLATE_ID = "historyItemLoadMore";
HistoryItemLoadMoreRenderer = __decorateClass([
  __decorateParam(2, IConfigurationService)
], HistoryItemLoadMoreRenderer);
let HistoryItemHoverDelegate = class extends WorkbenchHoverDelegate {
  constructor(_viewContainerLocation, layoutService, configurationService, hoverService) {
    super("element", { instantHover: true }, () => this.getHoverOptions(), configurationService, hoverService);
    this._viewContainerLocation = _viewContainerLocation;
    this.layoutService = layoutService;
  }
  getHoverOptions() {
    const sideBarPosition = this.layoutService.getSideBarPosition();
    let hoverPosition;
    if (this._viewContainerLocation === ViewContainerLocation.Sidebar) {
      hoverPosition = sideBarPosition === Position.LEFT ? HoverPosition.RIGHT : HoverPosition.LEFT;
    } else if (this._viewContainerLocation === ViewContainerLocation.AuxiliaryBar) {
      hoverPosition = sideBarPosition === Position.LEFT ? HoverPosition.LEFT : HoverPosition.RIGHT;
    } else {
      hoverPosition = HoverPosition.RIGHT;
    }
    return { additionalClasses: ["history-item-hover"], position: { hoverPosition, forcePosition: true } };
  }
};
HistoryItemHoverDelegate = __decorateClass([
  __decorateParam(1, IWorkbenchLayoutService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IHoverService)
], HistoryItemHoverDelegate);
let SCMHistoryViewPaneActionRunner = class extends ActionRunner {
  constructor(_progressService) {
    super();
    this._progressService = _progressService;
  }
  runAction(action, context) {
    return this._progressService.withProgress(
      { location: HISTORY_VIEW_PANE_ID },
      async () => await super.runAction(action, context)
    );
  }
};
SCMHistoryViewPaneActionRunner = __decorateClass([
  __decorateParam(0, IProgressService)
], SCMHistoryViewPaneActionRunner);
class SCMHistoryTreeAccessibilityProvider {
  getWidgetAriaLabel() {
    return localize("scm history", "Source Control History");
  }
  getAriaLabel(element) {
    if (isSCMRepository(element)) {
      return `${element.provider.name} ${element.provider.label}`;
    } else if (isSCMHistoryItemViewModelTreeElement(element)) {
      const historyItem = element.historyItemViewModel.historyItem;
      return `${stripIcons(historyItem.message).trim()}${historyItem.author ? `, ${historyItem.author}` : ""}`;
    } else {
      return "";
    }
  }
}
class SCMHistoryTreeIdentityProvider {
  getId(element) {
    if (isSCMRepository(element)) {
      const provider = element.provider;
      return `repo:${provider.id}`;
    } else if (isSCMHistoryItemViewModelTreeElement(element)) {
      const provider = element.repository.provider;
      const historyItem = element.historyItemViewModel.historyItem;
      return `historyItem:${provider.id}/${historyItem.id}/${historyItem.parentIds.join(",")}`;
    } else if (isSCMHistoryItemLoadMoreTreeElement(element)) {
      const provider = element.repository.provider;
      return `historyItemLoadMore:${provider.id}}`;
    } else {
      throw new Error("Invalid tree element");
    }
  }
}
class SCMHistoryTreeKeyboardNavigationLabelProvider {
  getKeyboardNavigationLabel(element) {
    if (isSCMRepository(element)) {
      return void 0;
    } else if (isSCMHistoryItemViewModelTreeElement(element)) {
      return [element.historyItemViewModel.historyItem.message, element.historyItemViewModel.historyItem.author];
    } else if (isSCMHistoryItemLoadMoreTreeElement(element)) {
      return "";
    } else {
      throw new Error("Invalid tree element");
    }
  }
}
class SCMHistoryTreeDataSource extends Disposable {
  async getChildren(inputOrElement) {
    if (!(inputOrElement instanceof SCMHistoryViewModel)) {
      return [];
    }
    const children = [];
    const historyItems = await inputOrElement.getHistoryItems();
    children.push(...historyItems);
    const repository = inputOrElement.repository.get();
    const lastHistoryItem = historyItems.at(-1);
    if (repository && lastHistoryItem && lastHistoryItem.historyItemViewModel.outputSwimlanes.length > 0) {
      children.push({
        repository,
        graphColumns: lastHistoryItem.historyItemViewModel.outputSwimlanes,
        type: "historyItemLoadMore"
      });
    }
    return children;
  }
  hasChildren(inputOrElement) {
    return inputOrElement instanceof SCMHistoryViewModel;
  }
}
let SCMHistoryViewModel = class extends Disposable {
  constructor(_configurationService, _contextKeyService, _extensionService, _scmService, _scmViewService, _storageService) {
    super();
    this._configurationService = _configurationService;
    this._contextKeyService = _contextKeyService;
    this._extensionService = _extensionService;
    this._scmService = _scmService;
    this._scmViewService = _scmViewService;
    this._storageService = _storageService;
    this._selectedRepository = observableValue(this, "auto");
    this.onDidChangeHistoryItemsFilter = observableSignal(this);
    this.isViewModelEmpty = observableValue(this, false);
    this._repositoryState = /* @__PURE__ */ new Map();
    this._repositoryFilterState = /* @__PURE__ */ new Map();
    this._repositoryFilterState = this._loadHistoryItemsFilterState();
    this._extensionService.onWillStop(this._saveHistoryItemsFilterState, this, this._store);
    this._storageService.onWillSaveState(this._saveHistoryItemsFilterState, this, this._store);
    this._scmHistoryItemCountCtx = ContextKeys.SCMHistoryItemCount.bindTo(this._contextKeyService);
    const firstRepository = this._scmService.repositoryCount > 0 ? constObservable(Iterable.first(this._scmService.repositories)) : observableFromEvent(
      this,
      Event.once(this._scmService.onDidAddRepository),
      (repository) => repository
    );
    const graphRepository = derived((reader) => {
      const selectedRepository = this._selectedRepository.read(reader);
      if (selectedRepository !== "auto") {
        return selectedRepository;
      }
      return this._scmViewService.activeRepository.read(reader);
    });
    this.repository = latestChangedValue(this, [firstRepository, graphRepository]);
    const closedRepository = observableFromEvent(
      this,
      this._scmService.onDidRemoveRepository,
      (repository) => repository
    );
    this._register(autorun((reader) => {
      const repository = closedRepository.read(reader);
      if (!repository) {
        return;
      }
      if (this.repository.get() === repository) {
        this._selectedRepository.set(Iterable.first(this._scmService.repositories) ?? "auto", void 0);
      }
      this._repositoryState.delete(repository);
    }));
  }
  clearRepositoryState() {
    const repository = this.repository.get();
    if (!repository) {
      return;
    }
    this._repositoryState.delete(repository);
  }
  getHistoryItemsFilter() {
    const repository = this.repository.get();
    if (!repository) {
      return;
    }
    const filterState = this._repositoryFilterState.get(getProviderKey(repository.provider)) ?? "auto";
    if (filterState === "all" || filterState === "auto") {
      return filterState;
    }
    const repositoryState = this._repositoryState.get(repository);
    return repositoryState?.historyItemsFilter;
  }
  getCurrentHistoryItemTreeElement() {
    const repository = this.repository.get();
    if (!repository) {
      return void 0;
    }
    const state = this._repositoryState.get(repository);
    if (!state) {
      return void 0;
    }
    const historyProvider = repository?.provider.historyProvider.get();
    const historyItemRef = historyProvider?.historyItemRef.get();
    return state.viewModels.find((viewModel) => viewModel.historyItemViewModel.historyItem.id === historyItemRef?.revision);
  }
  loadMore(cursor) {
    const repository = this.repository.get();
    if (!repository) {
      return;
    }
    const state = this._repositoryState.get(repository);
    if (!state) {
      return;
    }
    this._repositoryState.set(repository, { ...state, loadMore: cursor ?? true });
  }
  async getHistoryItems() {
    const repository = this.repository.get();
    const historyProvider = repository?.provider.historyProvider.get();
    if (!repository || !historyProvider) {
      this._scmHistoryItemCountCtx.set(0);
      this.isViewModelEmpty.set(true, void 0);
      return [];
    }
    let state = this._repositoryState.get(repository);
    if (!state || state.loadMore !== false) {
      const historyItems = state?.viewModels.map((vm) => vm.historyItemViewModel.historyItem) ?? [];
      const historyItemRefs = state?.historyItemsFilter ?? await this._resolveHistoryItemFilter(repository, historyProvider);
      const limit = clamp(this._configurationService.getValue("scm.graph.pageSize"), 1, 1e3);
      const historyItemRefIds = historyItemRefs.map((ref) => ref.revision ?? ref.id);
      do {
        historyItems.push(...await historyProvider.provideHistoryItems({
          historyItemRefs: historyItemRefIds,
          limit,
          skip: historyItems.length
        }) ?? []);
      } while (typeof state?.loadMore === "string" && !historyItems.find((item) => item.id === state?.loadMore));
      const colorMap = this._getGraphColorMap(historyItemRefs);
      const viewModels = toISCMHistoryItemViewModelArray(historyItems, colorMap, historyProvider.historyItemRef.get()).map((historyItemViewModel) => ({
        repository,
        historyItemViewModel,
        type: "historyItemViewModel"
      }));
      state = { historyItemsFilter: historyItemRefs, viewModels, loadMore: false };
      this._repositoryState.set(repository, state);
      this._scmHistoryItemCountCtx.set(viewModels.length);
      this.isViewModelEmpty.set(viewModels.length === 0, void 0);
    }
    return state.viewModels;
  }
  setRepository(repository) {
    this._selectedRepository.set(repository, void 0);
  }
  setHistoryItemsFilter(filter) {
    const repository = this.repository.get();
    if (!repository) {
      return;
    }
    if (filter !== "auto") {
      this._repositoryFilterState.set(getProviderKey(repository.provider), filter);
    } else {
      this._repositoryFilterState.delete(getProviderKey(repository.provider));
    }
    this._saveHistoryItemsFilterState();
    this.onDidChangeHistoryItemsFilter.trigger(void 0);
  }
  _getGraphColorMap(historyItemRefs) {
    const repository = this.repository.get();
    const historyProvider = repository?.provider.historyProvider.get();
    const historyItemRef = historyProvider?.historyItemRef.get();
    const historyItemRemoteRef = historyProvider?.historyItemRemoteRef.get();
    const historyItemBaseRef = historyProvider?.historyItemBaseRef.get();
    const colorMap = /* @__PURE__ */ new Map();
    if (historyItemRef) {
      colorMap.set(historyItemRef.id, historyItemRef.color);
      if (historyItemRemoteRef) {
        colorMap.set(historyItemRemoteRef.id, historyItemRemoteRef.color);
      }
      if (historyItemBaseRef) {
        colorMap.set(historyItemBaseRef.id, historyItemBaseRef.color);
      }
    }
    for (const ref of historyItemRefs) {
      if (!colorMap.has(ref.id)) {
        colorMap.set(ref.id, void 0);
      }
    }
    return colorMap;
  }
  async _resolveHistoryItemFilter(repository, historyProvider) {
    const historyItemRefs = [];
    const historyItemsFilter = this._repositoryFilterState.get(getProviderKey(repository.provider)) ?? "auto";
    switch (historyItemsFilter) {
      case "all":
        historyItemRefs.push(...await historyProvider.provideHistoryItemRefs() ?? []);
        break;
      case "auto":
        historyItemRefs.push(...[
          historyProvider.historyItemRef.get(),
          historyProvider.historyItemRemoteRef.get(),
          historyProvider.historyItemBaseRef.get()
        ].filter((ref) => !!ref));
        break;
      default: {
        const refs = (await historyProvider.provideHistoryItemRefs(historyItemsFilter) ?? []).filter((ref) => historyItemsFilter.some((filter) => filter === ref.id));
        if (refs.length === 0) {
          historyItemRefs.push(...[
            historyProvider.historyItemRef.get(),
            historyProvider.historyItemRemoteRef.get(),
            historyProvider.historyItemBaseRef.get()
          ].filter((ref) => !!ref));
          this._repositoryFilterState.delete(getProviderKey(repository.provider));
        } else {
          historyItemRefs.push(...refs);
          this._repositoryFilterState.set(getProviderKey(repository.provider), refs.map((ref) => ref.id));
        }
        this._saveHistoryItemsFilterState();
        break;
      }
    }
    return historyItemRefs;
  }
  _loadHistoryItemsFilterState() {
    try {
      const filterData = this._storageService.get("scm.graphView.referencesFilter", StorageScope.WORKSPACE);
      if (filterData) {
        return new Map(JSON.parse(filterData));
      }
    } catch {
    }
    return /* @__PURE__ */ new Map();
  }
  _saveHistoryItemsFilterState() {
    const filter = Array.from(this._repositoryFilterState.entries());
    this._storageService.store("scm.graphView.referencesFilter", JSON.stringify(filter), StorageScope.WORKSPACE, StorageTarget.USER);
  }
  dispose() {
    this._repositoryState.clear();
    super.dispose();
  }
};
SCMHistoryViewModel = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IExtensionService),
  __decorateParam(3, ISCMService),
  __decorateParam(4, ISCMViewService),
  __decorateParam(5, IStorageService)
], SCMHistoryViewModel);
let RepositoryPicker = class {
  constructor(_quickInputService, _scmViewService) {
    this._quickInputService = _quickInputService;
    this._scmViewService = _scmViewService;
    this._autoQuickPickItem = {
      label: localize("auto", "Auto"),
      description: localize("activeRepository", "Show the source control graph for the active repository"),
      repository: "auto"
    };
  }
  async pickRepository() {
    const picks = [
      this._autoQuickPickItem,
      { type: "separator" }
    ];
    picks.push(...this._scmViewService.repositories.map((r) => ({
      label: r.provider.name,
      description: r.provider.rootUri?.fsPath,
      iconClass: ThemeIcon.asClassName(Codicon.repo),
      repository: r
    })));
    return this._quickInputService.pick(picks, {
      placeHolder: localize("scmGraphRepository", "Select the repository to view, type to filter all repositories")
    });
  }
};
RepositoryPicker = __decorateClass([
  __decorateParam(0, IQuickInputService),
  __decorateParam(1, ISCMViewService)
], RepositoryPicker);
let HistoryItemRefPicker = class extends Disposable {
  constructor(_historyProvider, _historyItemsFilter, _quickInputService) {
    super();
    this._historyProvider = _historyProvider;
    this._historyItemsFilter = _historyItemsFilter;
    this._quickInputService = _quickInputService;
    this._allQuickPickItem = {
      id: "all",
      label: localize("all", "All"),
      description: localize("allHistoryItemRefs", "All history item references"),
      historyItemRef: "all"
    };
    this._autoQuickPickItem = {
      id: "auto",
      label: localize("auto", "Auto"),
      description: localize("currentHistoryItemRef", "Current history item reference(s)"),
      historyItemRef: "auto"
    };
  }
  async pickHistoryItemRef() {
    const quickPick = this._quickInputService.createQuickPick({ useSeparators: true });
    this._store.add(quickPick);
    quickPick.placeholder = localize("scmGraphHistoryItemRef", "Select one/more history item references to view, type to filter");
    quickPick.canSelectMany = true;
    quickPick.hideCheckAll = true;
    quickPick.busy = true;
    quickPick.show();
    const items = await this._createQuickPickItems();
    let selectedItems = [];
    if (this._historyItemsFilter === "all") {
      selectedItems.push(this._allQuickPickItem);
    } else if (this._historyItemsFilter === "auto") {
      selectedItems.push(this._autoQuickPickItem);
    } else {
      let index = 0;
      while (index < items.length) {
        if (items[index].type === "separator") {
          index++;
          continue;
        }
        if (this._historyItemsFilter.some((ref) => ref.id === items[index].id)) {
          const item = items.splice(index, 1);
          selectedItems.push(...item);
        } else {
          index++;
        }
      }
      items.splice(2, 0, { type: "separator" }, ...selectedItems);
    }
    quickPick.items = items;
    quickPick.selectedItems = selectedItems;
    quickPick.busy = false;
    return new Promise((resolve) => {
      this._store.add(quickPick.onDidChangeSelection((items2) => {
        const { added } = delta(selectedItems, items2, (a, b) => compare(a.id ?? "", b.id ?? ""));
        if (added.length > 0) {
          if (added[0].historyItemRef === "all" || added[0].historyItemRef === "auto") {
            quickPick.selectedItems = [added[0]];
          } else {
            quickPick.selectedItems = [...quickPick.selectedItems.filter((i) => i.historyItemRef !== "all" && i.historyItemRef !== "auto")];
          }
        }
        selectedItems = [...quickPick.selectedItems];
      }));
      this._store.add(quickPick.onDidAccept(() => {
        if (selectedItems.length === 0) {
          resolve(void 0);
        } else if (selectedItems.length === 1 && selectedItems[0].historyItemRef === "all") {
          resolve("all");
        } else if (selectedItems.length === 1 && selectedItems[0].historyItemRef === "auto") {
          resolve("auto");
        } else {
          resolve(selectedItems.map((item) => item.historyItemRef.id));
        }
        quickPick.hide();
      }));
      this._store.add(quickPick.onDidHide(() => {
        resolve(void 0);
        this.dispose();
      }));
    });
  }
  async _createQuickPickItems() {
    const picks = [
      this._allQuickPickItem,
      this._autoQuickPickItem
    ];
    const historyItemRefs = await this._historyProvider.provideHistoryItemRefs() ?? [];
    const historyItemRefsByCategory = groupBy(historyItemRefs, (a, b) => compare(a.category ?? "", b.category ?? ""));
    for (const refs of historyItemRefsByCategory) {
      if (refs.length === 0) {
        continue;
      }
      picks.push({ type: "separator", label: refs[0].category });
      picks.push(...refs.map((ref) => {
        return {
          id: ref.id,
          label: ref.name,
          description: ref.description,
          iconClass: ThemeIcon.isThemeIcon(ref.icon) ? ThemeIcon.asClassName(ref.icon) : void 0,
          historyItemRef: ref
        };
      }));
    }
    return picks;
  }
};
HistoryItemRefPicker = __decorateClass([
  __decorateParam(2, IQuickInputService)
], HistoryItemRefPicker);
let SCMHistoryViewPane = class extends ViewPane {
  constructor(options, _commandService, _instantiationService, _menuService, _progressService, configurationService, contextMenuService, keybindingService, instantiationService, viewDescriptorService, contextKeyService, openerService, themeService, hoverService) {
    super({
      ...options,
      titleMenuId: MenuId.SCMHistoryTitle,
      showActions: ViewPaneShowActions.WhenExpanded
    }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this._commandService = _commandService;
    this._instantiationService = _instantiationService;
    this._menuService = _menuService;
    this._progressService = _progressService;
    this._repositoryIsLoadingMore = observableValue(this, false);
    this._repositoryOutdated = observableValue(this, false);
    this._visibilityDisposables = new DisposableStore();
    this._treeOperationSequencer = new Sequencer();
    this._treeLoadMoreSequencer = new Sequencer();
    this._updateChildrenThrottler = new Throttler();
    this._contextMenuDisposables = new MutableDisposable();
    this._scmProviderCtx = ContextKeys.SCMProvider.bindTo(this.scopedContextKeyService);
    this._scmCurrentHistoryItemRefHasRemote = ContextKeys.SCMCurrentHistoryItemRefHasRemote.bindTo(this.scopedContextKeyService);
    this._scmCurrentHistoryItemRefInFilter = ContextKeys.SCMCurrentHistoryItemRefInFilter.bindTo(this.scopedContextKeyService);
    this._actionRunner = this.instantiationService.createInstance(SCMHistoryViewPaneActionRunner);
    this._register(this._actionRunner);
    this._register(this._updateChildrenThrottler);
  }
  renderHeaderTitle(container) {
    super.renderHeaderTitle(container, this.title);
    const element = h("div.scm-graph-view-badge-container", [
      h("div.scm-graph-view-badge.monaco-count-badge.long@badge")
    ]);
    element.badge.textContent = "Outdated";
    container.appendChild(element.root);
    this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), element.root, {
      markdown: {
        value: localize("scmGraphViewOutdated", "Please refresh the graph using the refresh action ($(refresh))."),
        supportThemeIcons: true
      },
      markdownNotSupportedFallback: void 0
    }));
    this._register(autorun((reader) => {
      const outdated = this._repositoryOutdated.read(reader);
      element.root.style.display = outdated ? "" : "none";
    }));
  }
  renderBody(container) {
    super.renderBody(container);
    this._treeContainer = append(container, $(".scm-view.scm-history-view"));
    this._treeContainer.classList.add("file-icon-themable-tree");
    this._createTree(this._treeContainer);
    this.onDidChangeBodyVisibility(async (visible) => {
      if (!visible) {
        this._visibilityDisposables.clear();
        return;
      }
      this._treeViewModel = this.instantiationService.createInstance(SCMHistoryViewModel);
      this._visibilityDisposables.add(this._treeViewModel);
      const firstRepositoryInitialized = derived(this, (reader) => {
        const repository = this._treeViewModel.repository.read(reader);
        const historyProvider = repository?.provider.historyProvider.read(reader);
        const historyItemRef = historyProvider?.historyItemRef.read(reader);
        return historyItemRef !== void 0 ? true : void 0;
      });
      await waitForState(firstRepositoryInitialized);
      await this._progressService.withProgress({ location: this.id }, async () => {
        await this._treeOperationSequencer.queue(async () => {
          await this._tree.setInput(this._treeViewModel);
          this._tree.scrollTop = 0;
        });
      });
      this._visibilityDisposables.add(autorun((reader) => {
        this._treeViewModel.isViewModelEmpty.read(reader);
        this._onDidChangeViewWelcomeState.fire();
      }));
      let isFirstRun = true;
      this._visibilityDisposables.add(autorunWithStore((reader, store) => {
        const repository = this._treeViewModel.repository.read(reader);
        const historyProvider = repository?.provider.historyProvider.read(reader);
        if (!repository || !historyProvider) {
          return;
        }
        const historyItemRefId = derived((reader2) => {
          return historyProvider.historyItemRef.read(reader2)?.id;
        });
        store.add(runOnChange(historyItemRefId, async (historyItemRefIdValue) => {
          await this.refresh();
          this._scmCurrentHistoryItemRefInFilter.set(this._isCurrentHistoryItemInFilter(historyItemRefIdValue));
        }));
        store.add(runOnChange(historyProvider.historyItemRefChanges, (changes) => {
          if (changes.silent) {
            if (this._tree.scrollTop === 0) {
              this.refresh();
              return;
            }
            this._repositoryOutdated.set(true, void 0);
            return;
          }
          this.refresh();
        }));
        store.add(runOnChange(this._treeViewModel.onDidChangeHistoryItemsFilter, async () => {
          await this.refresh();
          this._scmCurrentHistoryItemRefInFilter.set(this._isCurrentHistoryItemInFilter(historyItemRefId.get()));
        }));
        store.add(autorun((reader2) => {
          this._scmCurrentHistoryItemRefHasRemote.set(!!historyProvider.historyItemRemoteRef.read(reader2));
        }));
        this._scmProviderCtx.set(repository.provider.contextValue);
        this._scmCurrentHistoryItemRefInFilter.set(this._isCurrentHistoryItemInFilter(historyItemRefId.get()));
        if (!isFirstRun) {
          this.refresh();
        }
        isFirstRun = false;
      }));
    }, this, this._store);
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this._tree.layout(height, width);
  }
  getActionRunner() {
    return this._actionRunner;
  }
  getActionsContext() {
    return this._treeViewModel?.repository.get()?.provider;
  }
  createActionViewItem(action, options) {
    if (action.id === PICK_REPOSITORY_ACTION_ID) {
      const repository = this._treeViewModel?.repository.get();
      if (repository) {
        return new SCMRepositoryActionViewItem(repository, action, options);
      }
    } else if (action.id === PICK_HISTORY_ITEM_REFS_ACTION_ID) {
      const repository = this._treeViewModel?.repository.get();
      const historyItemsFilter = this._treeViewModel?.getHistoryItemsFilter();
      if (repository && historyItemsFilter) {
        return new SCMHistoryItemRefsActionViewItem(repository, historyItemsFilter, action, options);
      }
    }
    return super.createActionViewItem(action, options);
  }
  focus() {
    super.focus();
    const fakeKeyboardEvent = new KeyboardEvent("keydown");
    this._tree.focusFirst(fakeKeyboardEvent);
    this._tree.domFocus();
  }
  shouldShowWelcome() {
    return this._treeViewModel?.isViewModelEmpty.get() === true;
  }
  async refresh() {
    this._treeViewModel.clearRepositoryState();
    await this._updateChildren();
    this.updateActions();
    this._repositoryOutdated.set(false, void 0);
    this._tree.scrollTop = 0;
  }
  async pickRepository() {
    const picker = this._instantiationService.createInstance(RepositoryPicker);
    const result = await picker.pickRepository();
    if (result) {
      this._treeViewModel.setRepository(result.repository);
    }
  }
  async pickHistoryItemRef() {
    const repository = this._treeViewModel.repository.get();
    const historyProvider = repository?.provider.historyProvider.get();
    const historyItemsFilter = this._treeViewModel.getHistoryItemsFilter();
    if (!historyProvider || !historyItemsFilter) {
      return;
    }
    const picker = this._instantiationService.createInstance(HistoryItemRefPicker, historyProvider, historyItemsFilter);
    const result = await picker.pickHistoryItemRef();
    if (result) {
      this._treeViewModel.setHistoryItemsFilter(result);
    }
  }
  async revealCurrentHistoryItem() {
    const repository = this._treeViewModel.repository.get();
    const historyProvider = repository?.provider.historyProvider.get();
    const historyItemRef = historyProvider?.historyItemRef.get();
    if (!repository || !historyItemRef?.id || !historyItemRef?.revision) {
      return;
    }
    if (!this._isCurrentHistoryItemInFilter(historyItemRef.id)) {
      return;
    }
    const revealTreeNode = () => {
      const historyItemTreeElement = this._treeViewModel.getCurrentHistoryItemTreeElement();
      if (historyItemTreeElement && this._tree.hasNode(historyItemTreeElement)) {
        this._tree.reveal(historyItemTreeElement, 0.5);
        this._tree.setSelection([historyItemTreeElement]);
        this._tree.setFocus([historyItemTreeElement]);
        return true;
      }
      return false;
    };
    if (revealTreeNode()) {
      return;
    }
    await this._loadMore(historyItemRef.revision);
    revealTreeNode();
  }
  _createTree(container) {
    this._treeIdentityProvider = new SCMHistoryTreeIdentityProvider();
    const historyItemHoverDelegate = this.instantiationService.createInstance(HistoryItemHoverDelegate, this.viewDescriptorService.getViewLocationById(this.id));
    this._register(historyItemHoverDelegate);
    this._treeDataSource = this.instantiationService.createInstance(SCMHistoryTreeDataSource);
    this._register(this._treeDataSource);
    this._tree = this.instantiationService.createInstance(
      WorkbenchAsyncDataTree,
      "SCM History Tree",
      container,
      new ListDelegate(),
      [
        this.instantiationService.createInstance(HistoryItemRenderer, historyItemHoverDelegate),
        this.instantiationService.createInstance(
          HistoryItemLoadMoreRenderer,
          this._repositoryIsLoadingMore,
          () => this._loadMore()
        )
      ],
      this._treeDataSource,
      {
        accessibilityProvider: new SCMHistoryTreeAccessibilityProvider(),
        identityProvider: this._treeIdentityProvider,
        collapseByDefault: (e) => false,
        keyboardNavigationLabelProvider: new SCMHistoryTreeKeyboardNavigationLabelProvider(),
        horizontalScrolling: false,
        multipleSelectionSupport: false
      }
    );
    this._register(this._tree);
    this._tree.onDidOpen(this._onDidOpen, this, this._store);
    this._tree.onContextMenu(this._onContextMenu, this, this._store);
  }
  _isCurrentHistoryItemInFilter(historyItemRefId) {
    if (!historyItemRefId) {
      return false;
    }
    const historyItemFilter = this._treeViewModel.getHistoryItemsFilter();
    if (historyItemFilter === "all" || historyItemFilter === "auto") {
      return true;
    }
    return Array.isArray(historyItemFilter) && !!historyItemFilter.find((ref) => ref.id === historyItemRefId);
  }
  async _onDidOpen(e) {
    if (!e.element) {
      return;
    } else if (isSCMHistoryItemViewModelTreeElement(e.element)) {
      const historyItem = e.element.historyItemViewModel.historyItem;
      const historyItemParentId = historyItem.parentIds.length > 0 ? historyItem.parentIds[0] : void 0;
      const historyProvider = e.element.repository.provider.historyProvider.get();
      const historyItemChanges = await historyProvider?.provideHistoryItemChanges(historyItem.id, historyItemParentId);
      if (historyItemChanges) {
        const title = getHistoryItemEditorTitle(historyItem);
        const rootUri = e.element.repository.provider.rootUri;
        const path = rootUri ? rootUri.path : e.element.repository.provider.label;
        const multiDiffSourceUri = URI.from({ scheme: "scm-history-item", path: `${path}/${historyItemParentId}..${historyItem.id}` }, true);
        await this._commandService.executeCommand("_workbench.openMultiDiffEditor", { title, multiDiffSourceUri, resources: historyItemChanges });
      }
    } else if (isSCMHistoryItemLoadMoreTreeElement(e.element)) {
      const pageOnScroll = this.configurationService.getValue("scm.graph.pageOnScroll") === true;
      if (!pageOnScroll) {
        this._loadMore();
        this._tree.setSelection([]);
      }
    }
  }
  _onContextMenu(e) {
    const element = e.element;
    if (!element || !isSCMHistoryItemViewModelTreeElement(element)) {
      return;
    }
    this._contextMenuDisposables.value = new DisposableStore();
    const historyItemRefMenuItems = MenuRegistry.getMenuItems(MenuId.SCMHistoryItemRefContext).filter((item) => isIMenuItem(item));
    if (historyItemRefMenuItems.length > 0 && element.historyItemViewModel.historyItem.references?.length) {
      const historyItemRefActions = /* @__PURE__ */ new Map();
      for (const ref of element.historyItemViewModel.historyItem.references) {
        const contextKeyService = this.scopedContextKeyService.createOverlay([
          ["scmHistoryItemRef", ref.id]
        ]);
        const menuActions = this._menuService.getMenuActions(
          MenuId.SCMHistoryItemRefContext,
          contextKeyService
        );
        for (const action of menuActions.flatMap((a) => a[1])) {
          if (!historyItemRefActions.has(action.id)) {
            historyItemRefActions.set(action.id, []);
          }
          historyItemRefActions.get(action.id).push(ref);
        }
      }
      for (const historyItemRefMenuItem of historyItemRefMenuItems) {
        const actionId = historyItemRefMenuItem.command.id;
        if (!historyItemRefActions.has(actionId)) {
          continue;
        }
        this._contextMenuDisposables.value.add(MenuRegistry.appendMenuItem(MenuId.SCMHistoryItemContext, {
          title: historyItemRefMenuItem.command.title,
          submenu: MenuId.for(actionId),
          group: historyItemRefMenuItem?.group,
          order: historyItemRefMenuItem?.order
        }));
        for (const historyItemRef of historyItemRefActions.get(actionId) ?? []) {
          this._contextMenuDisposables.value.add(registerAction2(class extends Action2 {
            constructor() {
              super({
                id: `${actionId}.${historyItemRef.id}`,
                title: historyItemRef.name,
                menu: {
                  id: MenuId.for(actionId),
                  group: historyItemRef.category
                }
              });
            }
            run(accessor, ...args) {
              const commandService = accessor.get(ICommandService);
              commandService.executeCommand(actionId, ...args, historyItemRef.id);
            }
          }));
        }
      }
    }
    const historyItemMenuActions = this._menuService.getMenuActions(MenuId.SCMHistoryItemContext, this.scopedContextKeyService, {
      arg: element.repository.provider,
      shouldForwardArgs: true
    });
    this.contextMenuService.showContextMenu({
      contextKeyService: this.scopedContextKeyService,
      getAnchor: () => e.anchor,
      getActions: () => getFlatContextMenuActions(historyItemMenuActions),
      getActionsContext: () => element.historyItemViewModel.historyItem
    });
  }
  async _loadMore(cursor) {
    return this._treeLoadMoreSequencer.queue(async () => {
      if (this._repositoryIsLoadingMore.get()) {
        return;
      }
      this._repositoryIsLoadingMore.set(true, void 0);
      this._treeViewModel.loadMore(cursor);
      await this._updateChildren();
      this._repositoryIsLoadingMore.set(false, void 0);
    });
  }
  _updateChildren() {
    return this._updateChildrenThrottler.queue(
      () => this._treeOperationSequencer.queue(
        async () => {
          await this._progressService.withProgress(
            { location: this.id },
            async () => {
              await this._tree.updateChildren(void 0, void 0, void 0, {
                // diffIdentityProvider: this._treeIdentityProvider
              });
            }
          );
        }
      )
    );
  }
  dispose() {
    this._contextMenuDisposables.dispose();
    this._visibilityDisposables.dispose();
    super.dispose();
  }
};
SCMHistoryViewPane = __decorateClass([
  __decorateParam(1, ICommandService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IMenuService),
  __decorateParam(4, IProgressService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IKeybindingService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, IViewDescriptorService),
  __decorateParam(10, IContextKeyService),
  __decorateParam(11, IOpenerService),
  __decorateParam(12, IThemeService),
  __decorateParam(13, IHoverService)
], SCMHistoryViewPane);
export {
  SCMHistoryViewPane
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zY20vYnJvd3Nlci9zY21IaXN0b3J5Vmlld1BhbmUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvc2NtLmNzcyc7XG5pbXBvcnQgKiBhcyBwbGF0Zm9ybSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyAkLCBhcHBlbmQsIGgsIHJlc2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJSG92ZXJBY3Rpb24sIElIb3Zlck9wdGlvbnMsIElNYW5hZ2VkSG92ZXJUb29sdGlwTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSUhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZS5qcyc7XG5pbXBvcnQgeyBJY29uTGFiZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaWNvbkxhYmVsL2ljb25MYWJlbC5qcyc7XG5pbXBvcnQgeyBJSWRlbnRpdHlQcm92aWRlciwgSUtleWJvYXJkTmF2aWdhdGlvbkxhYmVsUHJvdmlkZXIsIElMaXN0VmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBMYWJlbEZ1enp5U2NvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS9hYnN0cmFjdFRyZWUuanMnO1xuaW1wb3J0IHsgSUFzeW5jRGF0YVNvdXJjZSwgSVRyZWVDb250ZXh0TWVudUV2ZW50LCBJVHJlZU5vZGUsIElUcmVlUmVuZGVyZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS90cmVlLmpzJztcbmltcG9ydCB7IGZyb21Ob3csIHNhZmVJbnRsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZGF0ZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVNYXRjaGVzLCBGdXp6eVNjb3JlLCBJTWF0Y2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXV0b3J1biwgYXV0b3J1bldpdGhTdG9yZSwgZGVyaXZlZCwgSU9ic2VydmFibGUsIG9ic2VydmFibGVWYWx1ZSwgd2FpdEZvclN0YXRlLCBjb25zdE9ic2VydmFibGUsIGxhdGVzdENoYW5nZWRWYWx1ZSwgb2JzZXJ2YWJsZUZyb21FdmVudCwgcnVuT25DaGFuZ2UsIG9ic2VydmFibGVTaWduYWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlLCBXb3JrYmVuY2hIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSU9wZW5FdmVudCwgV29ya2JlbmNoQXN5bmNEYXRhVHJlZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IGFzQ3NzVmFyaWFibGUsIENvbG9ySWRlbnRpZmllciwgZm9yZWdyb3VuZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElWaWV3UGFuZU9wdGlvbnMsIFZpZXdBY3Rpb24sIFZpZXdQYW5lLCBWaWV3UGFuZVNob3dBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3UGFuZS5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBWaWV3Q29udGFpbmVyTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgcmVuZGVyU0NNSGlzdG9yeUl0ZW1HcmFwaCwgdG9JU0NNSGlzdG9yeUl0ZW1WaWV3TW9kZWxBcnJheSwgU1dJTUxBTkVfV0lEVEgsIHJlbmRlclNDTUhpc3RvcnlHcmFwaFBsYWNlaG9sZGVyLCBoaXN0b3J5SXRlbUhvdmVyRGVsZXRpb25zRm9yZWdyb3VuZCwgaGlzdG9yeUl0ZW1Ib3ZlckxhYmVsRm9yZWdyb3VuZCwgaGlzdG9yeUl0ZW1Ib3ZlckFkZGl0aW9uc0ZvcmVncm91bmQsIGhpc3RvcnlJdGVtSG92ZXJEZWZhdWx0TGFiZWxGb3JlZ3JvdW5kLCBoaXN0b3J5SXRlbUhvdmVyRGVmYXVsdExhYmVsQmFja2dyb3VuZCB9IGZyb20gJy4vc2NtSGlzdG9yeS5qcyc7XG5pbXBvcnQgeyBnZXRIaXN0b3J5SXRlbUVkaXRvclRpdGxlLCBnZXRQcm92aWRlcktleSwgaXNTQ01IaXN0b3J5SXRlbUxvYWRNb3JlVHJlZUVsZW1lbnQsIGlzU0NNSGlzdG9yeUl0ZW1WaWV3TW9kZWxUcmVlRWxlbWVudCwgaXNTQ01SZXBvc2l0b3J5IH0gZnJvbSAnLi91dGlsLmpzJztcbmltcG9ydCB7IElTQ01IaXN0b3J5SXRlbSwgSVNDTUhpc3RvcnlJdGVtUmVmLCBJU0NNSGlzdG9yeUl0ZW1WaWV3TW9kZWwsIElTQ01IaXN0b3J5UHJvdmlkZXIsIFNDTUhpc3RvcnlJdGVtTG9hZE1vcmVUcmVlRWxlbWVudCwgU0NNSGlzdG9yeUl0ZW1WaWV3TW9kZWxUcmVlRWxlbWVudCB9IGZyb20gJy4uL2NvbW1vbi9oaXN0b3J5LmpzJztcbmltcG9ydCB7IEhJU1RPUllfVklFV19QQU5FX0lELCBJU0NNUHJvdmlkZXIsIElTQ01SZXBvc2l0b3J5LCBJU0NNU2VydmljZSwgSVNDTVZpZXdTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3NjbS5qcyc7XG5pbXBvcnQgeyBJTGlzdEFjY2Vzc2liaWxpdHlQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3RXaWRnZXQuanMnO1xuaW1wb3J0IHsgc3RyaXBJY29ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2ljb25MYWJlbHMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaExheW91dFNlcnZpY2UsIFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBIb3ZlclBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyV2lkZ2V0LmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIElNZW51U2VydmljZSwgaXNJTWVudUl0ZW0sIE1lbnVJZCwgTWVudVJlZ2lzdHJ5LCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IFNlcXVlbmNlciwgVGhyb3R0bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBBY3Rpb25SdW5uZXIsIElBY3Rpb24sIElBY3Rpb25SdW5uZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IGRlbHRhLCBncm91cEJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBJUHJvZ3Jlc3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlzIH0gZnJvbSAnLi9zY21WaWV3UGFuZS5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBJRHJvcGRvd25NZW51QWN0aW9uVmlld0l0ZW1PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2Ryb3Bkb3duL2Ryb3Bkb3duQWN0aW9uVmlld0l0ZW0uanMnO1xuaW1wb3J0IHsgQWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvblZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja1BpY2tJdGVtLCBJUXVpY2tQaWNrU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgY2xhbXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9udW1iZXJzLmpzJztcbmltcG9ydCB7IG9ic2VydmFibGVDb25maWdWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29ic2VydmFibGUvY29tbW9uL3BsYXRmb3JtT2JzZXJ2YWJsZVV0aWxzLmpzJztcbmltcG9ydCB7IGNvbXBhcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IElDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2NvbW1vbi9jbGlwYm9hcmRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGdldERlZmF1bHRIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGVGYWN0b3J5LmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgZ3JvdXBCeSBhcyBncm91cEJ5MiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbGxlY3Rpb25zLmpzJztcbmltcG9ydCB7IGdldEZsYXRDb250ZXh0TWVudUFjdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvbWVudUVudHJ5QWN0aW9uVmlld0l0ZW0uanMnO1xuXG5jb25zdCBQSUNLX1JFUE9TSVRPUllfQUNUSU9OX0lEID0gJ3dvcmtiZW5jaC5zY20uYWN0aW9uLmdyYXBoLnBpY2tSZXBvc2l0b3J5JztcbmNvbnN0IFBJQ0tfSElTVE9SWV9JVEVNX1JFRlNfQUNUSU9OX0lEID0gJ3dvcmtiZW5jaC5zY20uYWN0aW9uLmdyYXBoLnBpY2tIaXN0b3J5SXRlbVJlZnMnO1xuXG50eXBlIFRyZWVFbGVtZW50ID0gU0NNSGlzdG9yeUl0ZW1WaWV3TW9kZWxUcmVlRWxlbWVudCB8IFNDTUhpc3RvcnlJdGVtTG9hZE1vcmVUcmVlRWxlbWVudDtcblxuY2xhc3MgU0NNUmVwb3NpdG9yeUFjdGlvblZpZXdJdGVtIGV4dGVuZHMgQWN0aW9uVmlld0l0ZW0ge1xuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IF9yZXBvc2l0b3J5OiBJU0NNUmVwb3NpdG9yeSwgYWN0aW9uOiBJQWN0aW9uLCBvcHRpb25zPzogSURyb3Bkb3duTWVudUFjdGlvblZpZXdJdGVtT3B0aW9ucykge1xuXHRcdHN1cGVyKG51bGwsIGFjdGlvbiwgeyAuLi5vcHRpb25zLCBpY29uOiBmYWxzZSwgbGFiZWw6IHRydWUgfSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgdXBkYXRlTGFiZWwoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMub3B0aW9ucy5sYWJlbCAmJiB0aGlzLmxhYmVsKSB7XG5cdFx0XHR0aGlzLmxhYmVsLmNsYXNzTGlzdC5hZGQoJ3NjbS1ncmFwaC1yZXBvc2l0b3J5LXBpY2tlcicpO1xuXG5cdFx0XHRjb25zdCBpY29uID0gJCgnLmljb24nKTtcblx0XHRcdGljb24uY2xhc3NMaXN0LmFkZCguLi5UaGVtZUljb24uYXNDbGFzc05hbWVBcnJheShDb2RpY29uLnJlcG8pKTtcblxuXHRcdFx0Y29uc3QgbmFtZSA9ICQoJy5uYW1lJyk7XG5cdFx0XHRuYW1lLnRleHRDb250ZW50ID0gdGhpcy5fcmVwb3NpdG9yeS5wcm92aWRlci5uYW1lO1xuXG5cblx0XHRcdHJlc2V0KHRoaXMubGFiZWwsIGljb24sIG5hbWUpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBnZXRUb29sdGlwKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3JlcG9zaXRvcnkucHJvdmlkZXIubmFtZTtcblx0fVxufVxuXG5jbGFzcyBTQ01IaXN0b3J5SXRlbVJlZnNBY3Rpb25WaWV3SXRlbSBleHRlbmRzIEFjdGlvblZpZXdJdGVtIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcmVwb3NpdG9yeTogSVNDTVJlcG9zaXRvcnksXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaGlzdG9yeUl0ZW1zRmlsdGVyOiAnYWxsJyB8ICdhdXRvJyB8IElTQ01IaXN0b3J5SXRlbVJlZltdLFxuXHRcdGFjdGlvbjogSUFjdGlvbixcblx0XHRvcHRpb25zPzogSURyb3Bkb3duTWVudUFjdGlvblZpZXdJdGVtT3B0aW9uc1xuXHQpIHtcblx0XHRzdXBlcihudWxsLCBhY3Rpb24sIHsgLi4ub3B0aW9ucywgaWNvbjogZmFsc2UsIGxhYmVsOiB0cnVlIH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHVwZGF0ZUxhYmVsKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLm9wdGlvbnMubGFiZWwgJiYgdGhpcy5sYWJlbCkge1xuXHRcdFx0dGhpcy5sYWJlbC5jbGFzc0xpc3QuYWRkKCdzY20tZ3JhcGgtaGlzdG9yeS1pdGVtLXBpY2tlcicpO1xuXG5cdFx0XHRjb25zdCBpY29uID0gJCgnLmljb24nKTtcblx0XHRcdGljb24uY2xhc3NMaXN0LmFkZCguLi5UaGVtZUljb24uYXNDbGFzc05hbWVBcnJheShDb2RpY29uLmdpdEJyYW5jaCkpO1xuXG5cdFx0XHRjb25zdCBuYW1lID0gJCgnLm5hbWUnKTtcblx0XHRcdGlmICh0aGlzLl9oaXN0b3J5SXRlbXNGaWx0ZXIgPT09ICdhbGwnKSB7XG5cdFx0XHRcdG5hbWUudGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgnYWxsJywgXCJBbGxcIik7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuX2hpc3RvcnlJdGVtc0ZpbHRlciA9PT0gJ2F1dG8nKSB7XG5cdFx0XHRcdG5hbWUudGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgnYXV0bycsIFwiQXV0b1wiKTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5faGlzdG9yeUl0ZW1zRmlsdGVyLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRuYW1lLnRleHRDb250ZW50ID0gdGhpcy5faGlzdG9yeUl0ZW1zRmlsdGVyWzBdLm5hbWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuYW1lLnRleHRDb250ZW50ID0gbG9jYWxpemUoJ2l0ZW1zJywgXCJ7MH0gSXRlbXNcIiwgdGhpcy5faGlzdG9yeUl0ZW1zRmlsdGVyLmxlbmd0aCk7XG5cdFx0XHR9XG5cblx0XHRcdHJlc2V0KHRoaXMubGFiZWwsIGljb24sIG5hbWUpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBnZXRUb29sdGlwKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuX2hpc3RvcnlJdGVtc0ZpbHRlciA9PT0gJ2FsbCcpIHtcblx0XHRcdHJldHVybiBsb2NhbGl6ZSgnYWxsSGlzdG9yeUl0ZW1SZWZzJywgXCJBbGwgaGlzdG9yeSBpdGVtIHJlZmVyZW5jZXNcIik7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9oaXN0b3J5SXRlbXNGaWx0ZXIgPT09ICdhdXRvJykge1xuXHRcdFx0Y29uc3QgaGlzdG9yeVByb3ZpZGVyID0gdGhpcy5fcmVwb3NpdG9yeS5wcm92aWRlci5oaXN0b3J5UHJvdmlkZXIuZ2V0KCk7XG5cblx0XHRcdHJldHVybiBbXG5cdFx0XHRcdGhpc3RvcnlQcm92aWRlcj8uaGlzdG9yeUl0ZW1SZWYuZ2V0KCk/Lm5hbWUsXG5cdFx0XHRcdGhpc3RvcnlQcm92aWRlcj8uaGlzdG9yeUl0ZW1SZW1vdGVSZWYuZ2V0KCk/Lm5hbWUsXG5cdFx0XHRcdGhpc3RvcnlQcm92aWRlcj8uaGlzdG9yeUl0ZW1CYXNlUmVmLmdldCgpPy5uYW1lXG5cdFx0XHRdLmZpbHRlcihyZWYgPT4gISFyZWYpLmpvaW4oJywgJyk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9oaXN0b3J5SXRlbXNGaWx0ZXIubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5faGlzdG9yeUl0ZW1zRmlsdGVyWzBdLm5hbWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLl9oaXN0b3J5SXRlbXNGaWx0ZXIubWFwKHJlZiA9PiByZWYubmFtZSkuam9pbignLCAnKTtcblx0XHR9XG5cdH1cbn1cblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld0FjdGlvbjxTQ01IaXN0b3J5Vmlld1BhbmU+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFBJQ0tfUkVQT1NJVE9SWV9BQ1RJT05fSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ3JlcG9zaXRvcnlQaWNrZXInLCBcIlJlcG9zaXRvcnkgUGlja2VyXCIpLFxuXHRcdFx0dmlld0lkOiBISVNUT1JZX1ZJRVdfUEFORV9JRCxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5TQ01IaXN0b3J5VGl0bGUsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5oYXMoJ3NjbS5wcm92aWRlckNvdW50JyksIENvbnRleHRLZXlFeHByLmdyZWF0ZXIoJ3NjbS5wcm92aWRlckNvdW50JywgMSkpLFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRvcmRlcjogMFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuSW5WaWV3KF86IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IFNDTUhpc3RvcnlWaWV3UGFuZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHZpZXcucGlja1JlcG9zaXRvcnkoKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIFZpZXdBY3Rpb248U0NNSGlzdG9yeVZpZXdQYW5lPiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBQSUNLX0hJU1RPUllfSVRFTV9SRUZTX0FDVElPTl9JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgncmVmZXJlbmNlUGlja2VyJywgXCJIaXN0b3J5IEl0ZW0gUmVmZXJlbmNlIFBpY2tlclwiKSxcblx0XHRcdGljb246IENvZGljb24uZ2l0QnJhbmNoLFxuXHRcdFx0dmlld0lkOiBISVNUT1JZX1ZJRVdfUEFORV9JRCxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleXMuU0NNSGlzdG9yeUl0ZW1Db3VudC5ub3RFcXVhbHNUbygwKSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5TQ01IaXN0b3J5VGl0bGUsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiAxXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5JblZpZXcoXzogU2VydmljZXNBY2Nlc3NvciwgdmlldzogU0NNSGlzdG9yeVZpZXdQYW5lKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dmlldy5waWNrSGlzdG9yeUl0ZW1SZWYoKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIFZpZXdBY3Rpb248U0NNSGlzdG9yeVZpZXdQYW5lPiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLnNjbS5hY3Rpb24uZ3JhcGgucmV2ZWFsQ3VycmVudEhpc3RvcnlJdGVtJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZ29Ub0N1cnJlbnRIaXN0b3J5SXRlbScsIFwiR28gdG8gQ3VycmVudCBIaXN0b3J5IEl0ZW1cIiksXG5cdFx0XHRpY29uOiBDb2RpY29uLnRhcmdldCxcblx0XHRcdHZpZXdJZDogSElTVE9SWV9WSUVXX1BBTkVfSUQsXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0Q29udGV4dEtleXMuU0NNSGlzdG9yeUl0ZW1Db3VudC5ub3RFcXVhbHNUbygwKSxcblx0XHRcdFx0Q29udGV4dEtleXMuU0NNQ3VycmVudEhpc3RvcnlJdGVtUmVmSW5GaWx0ZXIuaXNFcXVhbFRvKHRydWUpKSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5TQ01IaXN0b3J5VGl0bGUsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiAyXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5JblZpZXcoXzogU2VydmljZXNBY2Nlc3NvciwgdmlldzogU0NNSGlzdG9yeVZpZXdQYW5lKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dmlldy5yZXZlYWxDdXJyZW50SGlzdG9yeUl0ZW0oKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIFZpZXdBY3Rpb248U0NNSGlzdG9yeVZpZXdQYW5lPiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLnNjbS5hY3Rpb24uZ3JhcGgucmVmcmVzaCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ3JlZnJlc2hHcmFwaCcsIFwiUmVmcmVzaFwiKSxcblx0XHRcdHZpZXdJZDogSElTVE9SWV9WSUVXX1BBTkVfSUQsXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRpY29uOiBDb2RpY29uLnJlZnJlc2gsXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuU0NNSGlzdG9yeVRpdGxlLFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRvcmRlcjogMTAwMFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuSW5WaWV3KF86IFNlcnZpY2VzQWNjZXNzb3IsIHZpZXc6IFNDTUhpc3RvcnlWaWV3UGFuZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHZpZXcucmVmcmVzaCgpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLnNjbS5hY3Rpb24uZ3JhcGgudmlld0NoYW5nZXMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdvcGVuQ2hhbmdlcycsIFwiT3BlbiBDaGFuZ2VzXCIpLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0bWVudTogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5TQ01IaXN0b3J5SXRlbUNvbnRleHQsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCdjb25maWcubXVsdGlEaWZmRWRpdG9yLmV4cGVyaW1lbnRhbC5lbmFibGVkJywgdHJ1ZSksXG5cdFx0XHRcdFx0Z3JvdXA6ICcwX3ZpZXcnLFxuXHRcdFx0XHRcdG9yZGVyOiAxXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgcHJvdmlkZXI6IElTQ01Qcm92aWRlciwgLi4uaGlzdG9yeUl0ZW1zOiBJU0NNSGlzdG9yeUl0ZW1bXSkge1xuXHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cblx0XHRpZiAoIXByb3ZpZGVyIHx8IGhpc3RvcnlJdGVtcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBoaXN0b3J5SXRlbSA9IGhpc3RvcnlJdGVtc1swXTtcblx0XHRjb25zdCBoaXN0b3J5SXRlbUxhc3QgPSBoaXN0b3J5SXRlbXNbaGlzdG9yeUl0ZW1zLmxlbmd0aCAtIDFdO1xuXHRcdGNvbnN0IGhpc3RvcnlQcm92aWRlciA9IHByb3ZpZGVyLmhpc3RvcnlQcm92aWRlci5nZXQoKTtcblxuXHRcdGlmIChoaXN0b3J5SXRlbXMubGVuZ3RoID4gMSkge1xuXHRcdFx0Y29uc3QgYW5jZXN0b3IgPSBhd2FpdCBoaXN0b3J5UHJvdmlkZXI/LnJlc29sdmVIaXN0b3J5SXRlbVJlZnNDb21tb25BbmNlc3RvcihbaGlzdG9yeUl0ZW0uaWQsIGhpc3RvcnlJdGVtTGFzdC5pZF0pO1xuXHRcdFx0aWYgKCFhbmNlc3RvciB8fCAoYW5jZXN0b3IgIT09IGhpc3RvcnlJdGVtLmlkICYmIGFuY2VzdG9yICE9PSBoaXN0b3J5SXRlbUxhc3QuaWQpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBoaXN0b3J5SXRlbVBhcmVudElkID0gaGlzdG9yeUl0ZW1MYXN0LnBhcmVudElkcy5sZW5ndGggPiAwID8gaGlzdG9yeUl0ZW1MYXN0LnBhcmVudElkc1swXSA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCBoaXN0b3J5SXRlbUNoYW5nZXMgPSBhd2FpdCBoaXN0b3J5UHJvdmlkZXI/LnByb3ZpZGVIaXN0b3J5SXRlbUNoYW5nZXMoaGlzdG9yeUl0ZW0uaWQsIGhpc3RvcnlJdGVtUGFyZW50SWQpO1xuXG5cdFx0aWYgKCFoaXN0b3J5SXRlbUNoYW5nZXM/Lmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRpdGxlID0gaGlzdG9yeUl0ZW1zLmxlbmd0aCA9PT0gMSA/XG5cdFx0XHRnZXRIaXN0b3J5SXRlbUVkaXRvclRpdGxlKGhpc3RvcnlJdGVtKSA6XG5cdFx0XHRsb2NhbGl6ZSgnaGlzdG9yeUl0ZW1DaGFuZ2VzRWRpdG9yVGl0bGUnLCBcIkFsbCBDaGFuZ2VzICh7MH0gXHUyMTk0IHsxfSlcIiwgaGlzdG9yeUl0ZW1MYXN0LmRpc3BsYXlJZCA/PyBoaXN0b3J5SXRlbUxhc3QuaWQsIGhpc3RvcnlJdGVtLmRpc3BsYXlJZCA/PyBoaXN0b3J5SXRlbS5pZCk7XG5cblx0XHRjb25zdCByb290VXJpID0gcHJvdmlkZXIucm9vdFVyaTtcblx0XHRjb25zdCBwYXRoID0gcm9vdFVyaSA/IHJvb3RVcmkucGF0aCA6IHByb3ZpZGVyLmxhYmVsO1xuXHRcdGNvbnN0IG11bHRpRGlmZlNvdXJjZVVyaSA9IFVSSS5mcm9tKHsgc2NoZW1lOiAnc2NtLWhpc3RvcnktaXRlbScsIHBhdGg6IGAke3BhdGh9LyR7aGlzdG9yeUl0ZW1QYXJlbnRJZH0uLiR7aGlzdG9yeUl0ZW0uaWR9YCB9LCB0cnVlKTtcblxuXHRcdGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCdfd29ya2JlbmNoLm9wZW5NdWx0aURpZmZFZGl0b3InLCB7IHRpdGxlLCBtdWx0aURpZmZTb3VyY2VVcmksIHJlc291cmNlczogaGlzdG9yeUl0ZW1DaGFuZ2VzIH0pO1xuXHR9XG59KTtcblxuY2xhc3MgTGlzdERlbGVnYXRlIGltcGxlbWVudHMgSUxpc3RWaXJ0dWFsRGVsZWdhdGU8VHJlZUVsZW1lbnQ+IHtcblxuXHRnZXRIZWlnaHQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gMjI7XG5cdH1cblxuXHRnZXRUZW1wbGF0ZUlkKGVsZW1lbnQ6IFRyZWVFbGVtZW50KTogc3RyaW5nIHtcblx0XHRpZiAoaXNTQ01IaXN0b3J5SXRlbVZpZXdNb2RlbFRyZWVFbGVtZW50KGVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gSGlzdG9yeUl0ZW1SZW5kZXJlci5URU1QTEFURV9JRDtcblx0XHR9IGVsc2UgaWYgKGlzU0NNSGlzdG9yeUl0ZW1Mb2FkTW9yZVRyZWVFbGVtZW50KGVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm4gSGlzdG9yeUl0ZW1Mb2FkTW9yZVJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZWxlbWVudCcpO1xuXHRcdH1cblx0fVxufVxuXG5pbnRlcmZhY2UgSGlzdG9yeUl0ZW1UZW1wbGF0ZSB7XG5cdHJlYWRvbmx5IGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXHRyZWFkb25seSBsYWJlbDogSWNvbkxhYmVsO1xuXHRyZWFkb25seSBncmFwaENvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IGxhYmVsQ29udGFpbmVyOiBIVE1MRWxlbWVudDtcblx0cmVhZG9ubHkgZWxlbWVudERpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdHJlYWRvbmx5IGRpc3Bvc2FibGVzOiBJRGlzcG9zYWJsZTtcbn1cblxuY2xhc3MgSGlzdG9yeUl0ZW1SZW5kZXJlciBpbXBsZW1lbnRzIElUcmVlUmVuZGVyZXI8U0NNSGlzdG9yeUl0ZW1WaWV3TW9kZWxUcmVlRWxlbWVudCwgTGFiZWxGdXp6eVNjb3JlLCBIaXN0b3J5SXRlbVRlbXBsYXRlPiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IFRFTVBMQVRFX0lEID0gJ2hpc3RvcnktaXRlbSc7XG5cdGdldCB0ZW1wbGF0ZUlkKCk6IHN0cmluZyB7IHJldHVybiBIaXN0b3J5SXRlbVJlbmRlcmVyLlRFTVBMQVRFX0lEOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYmFkZ2VzQ29uZmlnOiBJT2JzZXJ2YWJsZTwnYWxsJyB8ICdmaWx0ZXInPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGhvdmVyRGVsZWdhdGU6IElIb3ZlckRlbGVnYXRlLFxuXHRcdEBJQ2xpcGJvYXJkU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jbGlwYm9hcmRTZXJ2aWNlOiBJQ2xpcGJvYXJkU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX21lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuX2JhZGdlc0NvbmZpZyA9IG9ic2VydmFibGVDb25maWdWYWx1ZTwnYWxsJyB8ICdmaWx0ZXInPignc2NtLmdyYXBoLmJhZGdlcycsICdmaWx0ZXInLCB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZSk7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSGlzdG9yeUl0ZW1UZW1wbGF0ZSB7XG5cdFx0Ly8gaGFja1xuXHRcdChjb250YWluZXIucGFyZW50RWxlbWVudCEucGFyZW50RWxlbWVudCEucXVlcnlTZWxlY3RvcignLm1vbmFjby10bC10d2lzdGllJykhIGFzIEhUTUxFbGVtZW50KS5jbGFzc0xpc3QuYWRkKCdmb3JjZS1uby10d2lzdGllJyk7XG5cblx0XHRjb25zdCBlbGVtZW50ID0gYXBwZW5kKGNvbnRhaW5lciwgJCgnLmhpc3RvcnktaXRlbScpKTtcblx0XHRjb25zdCBncmFwaENvbnRhaW5lciA9IGFwcGVuZChlbGVtZW50LCAkKCcuZ3JhcGgtY29udGFpbmVyJykpO1xuXHRcdGNvbnN0IGljb25MYWJlbCA9IG5ldyBJY29uTGFiZWwoZWxlbWVudCwgeyBzdXBwb3J0SWNvbnM6IHRydWUsIHN1cHBvcnRIaWdobGlnaHRzOiB0cnVlLCBzdXBwb3J0RGVzY3JpcHRpb25IaWdobGlnaHRzOiB0cnVlIH0pO1xuXG5cdFx0Y29uc3QgbGFiZWxDb250YWluZXIgPSBhcHBlbmQoZWxlbWVudCwgJCgnLmxhYmVsLWNvbnRhaW5lcicpKTtcblx0XHRlbGVtZW50LmFwcGVuZENoaWxkKGxhYmVsQ29udGFpbmVyKTtcblxuXHRcdHJldHVybiB7IGVsZW1lbnQsIGdyYXBoQ29udGFpbmVyLCBsYWJlbDogaWNvbkxhYmVsLCBsYWJlbENvbnRhaW5lciwgZWxlbWVudERpc3Bvc2FibGVzOiBuZXcgRGlzcG9zYWJsZVN0b3JlKCksIGRpc3Bvc2FibGVzOiBuZXcgRGlzcG9zYWJsZVN0b3JlKCkgfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQobm9kZTogSVRyZWVOb2RlPFNDTUhpc3RvcnlJdGVtVmlld01vZGVsVHJlZUVsZW1lbnQsIExhYmVsRnV6enlTY29yZT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSGlzdG9yeUl0ZW1UZW1wbGF0ZSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCBwcm92aWRlciA9IG5vZGUuZWxlbWVudC5yZXBvc2l0b3J5LnByb3ZpZGVyO1xuXHRcdGNvbnN0IGhpc3RvcnlJdGVtVmlld01vZGVsID0gbm9kZS5lbGVtZW50Lmhpc3RvcnlJdGVtVmlld01vZGVsO1xuXHRcdGNvbnN0IGhpc3RvcnlJdGVtID0gaGlzdG9yeUl0ZW1WaWV3TW9kZWwuaGlzdG9yeUl0ZW07XG5cblx0XHRjb25zdCBoaXN0b3J5SXRlbUhvdmVyID0gdGhpcy5faG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKHRoaXMuaG92ZXJEZWxlZ2F0ZSwgdGVtcGxhdGVEYXRhLmVsZW1lbnQsIHRoaXMuX2dldEhvdmVyQ29udGVudChub2RlLmVsZW1lbnQpLCB7XG5cdFx0XHRhY3Rpb25zOiB0aGlzLl9nZXRIb3ZlckFjdGlvbnMocHJvdmlkZXIsIGhpc3RvcnlJdGVtKSxcblx0XHR9KTtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmFkZChoaXN0b3J5SXRlbUhvdmVyKTtcblxuXHRcdHRlbXBsYXRlRGF0YS5ncmFwaENvbnRhaW5lci50ZXh0Q29udGVudCA9ICcnO1xuXHRcdHRlbXBsYXRlRGF0YS5ncmFwaENvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdjdXJyZW50JywgaGlzdG9yeUl0ZW1WaWV3TW9kZWwuaXNDdXJyZW50KTtcblx0XHR0ZW1wbGF0ZURhdGEuZ3JhcGhDb250YWluZXIuYXBwZW5kQ2hpbGQocmVuZGVyU0NNSGlzdG9yeUl0ZW1HcmFwaChoaXN0b3J5SXRlbVZpZXdNb2RlbCkpO1xuXG5cdFx0Y29uc3QgaGlzdG9yeUl0ZW1SZWYgPSBwcm92aWRlci5oaXN0b3J5UHJvdmlkZXIuZ2V0KCk/Lmhpc3RvcnlJdGVtUmVmPy5nZXQoKTtcblx0XHRjb25zdCBleHRyYUNsYXNzZXMgPSBoaXN0b3J5SXRlbVJlZj8ucmV2aXNpb24gPT09IGhpc3RvcnlJdGVtLmlkID8gWydoaXN0b3J5LWl0ZW0tY3VycmVudCddIDogW107XG5cdFx0Y29uc3QgW21hdGNoZXMsIGRlc2NyaXB0aW9uTWF0Y2hlc10gPSB0aGlzLl9wcm9jZXNzTWF0Y2hlcyhoaXN0b3J5SXRlbVZpZXdNb2RlbCwgbm9kZS5maWx0ZXJEYXRhKTtcblx0XHR0ZW1wbGF0ZURhdGEubGFiZWwuc2V0TGFiZWwoaGlzdG9yeUl0ZW0uc3ViamVjdCwgaGlzdG9yeUl0ZW0uYXV0aG9yLCB7IG1hdGNoZXMsIGRlc2NyaXB0aW9uTWF0Y2hlcywgZXh0cmFDbGFzc2VzIH0pO1xuXG5cdFx0dGhpcy5fcmVuZGVyQmFkZ2VzKGhpc3RvcnlJdGVtLCB0ZW1wbGF0ZURhdGEpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyQmFkZ2VzKGhpc3RvcnlJdGVtOiBJU0NNSGlzdG9yeUl0ZW0sIHRlbXBsYXRlRGF0YTogSGlzdG9yeUl0ZW1UZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdGNvbnN0IGxhYmVsQ29uZmlnID0gdGhpcy5fYmFkZ2VzQ29uZmlnLnJlYWQocmVhZGVyKTtcblxuXHRcdFx0dGVtcGxhdGVEYXRhLmxhYmVsQ29udGFpbmVyLnRleHRDb250ZW50ID0gJyc7XG5cblx0XHRcdGNvbnN0IHJlZmVyZW5jZXMgPSBoaXN0b3J5SXRlbS5yZWZlcmVuY2VzID9cblx0XHRcdFx0aGlzdG9yeUl0ZW0ucmVmZXJlbmNlcy5zbGljZSgwKSA6IFtdO1xuXG5cdFx0XHQvLyBJZiB0aGUgZmlyc3QgcmVmZXJlbmNlIGlzIGNvbG9yZWQsIHdlIHJlbmRlciBpdFxuXHRcdFx0Ly8gc2VwYXJhdGVseSBzaW5jZSB3ZSBoYXZlIHRvIHNob3cgdGhlIGRlc2NyaXB0aW9uXG5cdFx0XHQvLyBmb3IgdGhlIGZpcnN0IGNvbG9yZWQgcmVmZXJlbmNlLlxuXHRcdFx0aWYgKHJlZmVyZW5jZXMubGVuZ3RoID4gMCAmJiByZWZlcmVuY2VzWzBdLmNvbG9yKSB7XG5cdFx0XHRcdHRoaXMuX3JlbmRlckJhZGdlKFtyZWZlcmVuY2VzWzBdXSwgdHJ1ZSwgdGVtcGxhdGVEYXRhKTtcblxuXHRcdFx0XHQvLyBSZW1vdmUgdGhlIHJlbmRlcmVkIHJlZmVyZW5jZSBmcm9tIHRoZSBjb2xsZWN0aW9uXG5cdFx0XHRcdHJlZmVyZW5jZXMuc3BsaWNlKDAsIDEpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBHcm91cCBoaXN0b3J5IGl0ZW0gcmVmZXJlbmNlcyBieSBjb2xvclxuXHRcdFx0Y29uc3QgaGlzdG9yeUl0ZW1SZWZzQnlDb2xvciA9IGdyb3VwQnkyKHJlZmVyZW5jZXMsIHJlZiA9PiByZWYuY29sb3IgPyByZWYuY29sb3IgOiAnJyk7XG5cblx0XHRcdGZvciAoY29uc3QgW2tleSwgaGlzdG9yeUl0ZW1SZWZzXSBvZiBPYmplY3QuZW50cmllcyhoaXN0b3J5SXRlbVJlZnNCeUNvbG9yKSkge1xuXHRcdFx0XHQvLyBJZiBuZWVkZWQgc2tpcCBiYWRnZXMgd2l0aG91dCBhIGNvbG9yXG5cdFx0XHRcdGlmIChrZXkgPT09ICcnICYmIGxhYmVsQ29uZmlnICE9PSAnYWxsJykge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gR3JvdXAgaGlzdG9yeSBpdGVtIHJlZmVyZW5jZXMgYnkgaWNvblxuXHRcdFx0XHRjb25zdCBoaXN0b3J5SXRlbVJlZkJ5SWNvbklkID0gZ3JvdXBCeTIoaGlzdG9yeUl0ZW1SZWZzLCByZWYgPT4gVGhlbWVJY29uLmlzVGhlbWVJY29uKHJlZi5pY29uKSA/IHJlZi5pY29uLmlkIDogJycpO1xuXHRcdFx0XHRmb3IgKGNvbnN0IFtrZXksIGhpc3RvcnlJdGVtUmVmc10gb2YgT2JqZWN0LmVudHJpZXMoaGlzdG9yeUl0ZW1SZWZCeUljb25JZCkpIHtcblx0XHRcdFx0XHQvLyBTa2lwIGJhZGdlcyB3aXRob3V0IGFuIGljb25cblx0XHRcdFx0XHRpZiAoa2V5ID09PSAnJykge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGhpcy5fcmVuZGVyQmFkZ2UoaGlzdG9yeUl0ZW1SZWZzLCBmYWxzZSwgdGVtcGxhdGVEYXRhKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlbmRlckJhZGdlKGhpc3RvcnlJdGVtUmVmczogSVNDTUhpc3RvcnlJdGVtUmVmW10sIHNob3dEZXNjcmlwdGlvbjogYm9vbGVhbiwgdGVtcGxhdGVEYXRhOiBIaXN0b3J5SXRlbVRlbXBsYXRlKTogdm9pZCB7XG5cdFx0aWYgKGhpc3RvcnlJdGVtUmVmcy5sZW5ndGggPT09IDAgfHwgIVRoZW1lSWNvbi5pc1RoZW1lSWNvbihoaXN0b3J5SXRlbVJlZnNbMF0uaWNvbikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlbGVtZW50cyA9IGgoJ2Rpdi5sYWJlbCcsIHtcblx0XHRcdHN0eWxlOiB7XG5cdFx0XHRcdGNvbG9yOiBoaXN0b3J5SXRlbVJlZnNbMF0uY29sb3IgPyBhc0Nzc1ZhcmlhYmxlKGhpc3RvcnlJdGVtSG92ZXJMYWJlbEZvcmVncm91bmQpIDogYXNDc3NWYXJpYWJsZShmb3JlZ3JvdW5kKSxcblx0XHRcdFx0YmFja2dyb3VuZENvbG9yOiBoaXN0b3J5SXRlbVJlZnNbMF0uY29sb3IgPyBhc0Nzc1ZhcmlhYmxlKGhpc3RvcnlJdGVtUmVmc1swXS5jb2xvcikgOiBhc0Nzc1ZhcmlhYmxlKGhpc3RvcnlJdGVtSG92ZXJEZWZhdWx0TGFiZWxCYWNrZ3JvdW5kKVxuXHRcdFx0fVxuXHRcdH0sIFtcblx0XHRcdGgoJ2Rpdi5jb3VudEBjb3VudCcsIHtcblx0XHRcdFx0c3R5bGU6IHtcblx0XHRcdFx0XHRkaXNwbGF5OiBoaXN0b3J5SXRlbVJlZnMubGVuZ3RoID4gMSA/ICcnIDogJ25vbmUnXG5cdFx0XHRcdH1cblx0XHRcdH0pLFxuXHRcdFx0aCgnZGl2Lmljb25AaWNvbicpLFxuXHRcdFx0aCgnZGl2LmRlc2NyaXB0aW9uQGRlc2NyaXB0aW9uJywge1xuXHRcdFx0XHRzdHlsZToge1xuXHRcdFx0XHRcdGRpc3BsYXk6IHNob3dEZXNjcmlwdGlvbiA/ICcnIDogJ25vbmUnXG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0XSk7XG5cblx0XHRlbGVtZW50cy5jb3VudC50ZXh0Q29udGVudCA9IGhpc3RvcnlJdGVtUmVmcy5sZW5ndGggPiAxID8gaGlzdG9yeUl0ZW1SZWZzLmxlbmd0aC50b1N0cmluZygpIDogJyc7XG5cdFx0ZWxlbWVudHMuaWNvbi5jbGFzc0xpc3QuYWRkKC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KGhpc3RvcnlJdGVtUmVmc1swXS5pY29uKSk7XG5cdFx0ZWxlbWVudHMuZGVzY3JpcHRpb24udGV4dENvbnRlbnQgPSBzaG93RGVzY3JpcHRpb24gPyBoaXN0b3J5SXRlbVJlZnNbMF0ubmFtZSA6ICcnO1xuXG5cdFx0YXBwZW5kKHRlbXBsYXRlRGF0YS5sYWJlbENvbnRhaW5lciwgZWxlbWVudHMucm9vdCk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRIb3ZlckFjdGlvbnMocHJvdmlkZXI6IElTQ01Qcm92aWRlciwgaGlzdG9yeUl0ZW06IElTQ01IaXN0b3J5SXRlbSk6IElIb3ZlckFjdGlvbltdIHtcblx0XHRjb25zdCBhY3Rpb25zID0gdGhpcy5fbWVudVNlcnZpY2UuZ2V0TWVudUFjdGlvbnMoTWVudUlkLlNDTUhpc3RvcnlJdGVtSG92ZXIsIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlLCB7XG5cdFx0XHRhcmc6IHByb3ZpZGVyLFxuXHRcdFx0c2hvdWxkRm9yd2FyZEFyZ3M6IHRydWVcblx0XHR9KS5mbGF0TWFwKGl0ZW0gPT4gaXRlbVsxXSk7XG5cblx0XHRyZXR1cm4gW1xuXHRcdFx0e1xuXHRcdFx0XHRjb21tYW5kSWQ6ICd3b3JrYmVuY2guc2NtLmFjdGlvbi5ncmFwaC5jb3B5SGlzdG9yeUl0ZW1JZCcsXG5cdFx0XHRcdGljb25DbGFzczogJ2NvZGljb24uY29kaWNvbi1jb3B5Jyxcblx0XHRcdFx0bGFiZWw6IGhpc3RvcnlJdGVtLmRpc3BsYXlJZCA/PyBoaXN0b3J5SXRlbS5pZCxcblx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLl9jbGlwYm9hcmRTZXJ2aWNlLndyaXRlVGV4dChoaXN0b3J5SXRlbS5pZClcblx0XHRcdH0sXG5cdFx0XHQuLi5hY3Rpb25zLm1hcChhY3Rpb24gPT4ge1xuXHRcdFx0XHRjb25zdCBpY29uQ2xhc3MgPSBUaGVtZUljb24uaXNUaGVtZUljb24oYWN0aW9uLml0ZW0uaWNvbilcblx0XHRcdFx0XHQ/IFRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KGFjdGlvbi5pdGVtLmljb24pLmpvaW4oJy4nKVxuXHRcdFx0XHRcdDogdW5kZWZpbmVkO1xuXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0Y29tbWFuZElkOiBhY3Rpb24uaWQsXG5cdFx0XHRcdFx0bGFiZWw6IGFjdGlvbi5sYWJlbCxcblx0XHRcdFx0XHRpY29uQ2xhc3MsXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiBhY3Rpb24ucnVuKGhpc3RvcnlJdGVtKVxuXHRcdFx0XHR9O1xuXHRcdFx0fSkgc2F0aXNmaWVzIElIb3ZlckFjdGlvbltdXG5cdFx0XTtcblx0fVxuXG5cdHByaXZhdGUgX2dldEhvdmVyQ29udGVudChlbGVtZW50OiBTQ01IaXN0b3J5SXRlbVZpZXdNb2RlbFRyZWVFbGVtZW50KTogSU1hbmFnZWRIb3ZlclRvb2x0aXBNYXJrZG93blN0cmluZyB7XG5cdFx0Y29uc3QgY29sb3JUaGVtZSA9IHRoaXMuX3RoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCk7XG5cdFx0Y29uc3QgaGlzdG9yeUl0ZW0gPSBlbGVtZW50Lmhpc3RvcnlJdGVtVmlld01vZGVsLmhpc3RvcnlJdGVtO1xuXG5cdFx0Y29uc3QgbWFya2Rvd24gPSBuZXcgTWFya2Rvd25TdHJpbmcoJycsIHsgaXNUcnVzdGVkOiB0cnVlLCBzdXBwb3J0VGhlbWVJY29uczogdHJ1ZSB9KTtcblxuXHRcdGlmIChoaXN0b3J5SXRlbS5hdXRob3IpIHtcblx0XHRcdGNvbnN0IGljb24gPSBVUkkuaXNVcmkoaGlzdG9yeUl0ZW0uYXV0aG9ySWNvbilcblx0XHRcdFx0PyBgIVske2hpc3RvcnlJdGVtLmF1dGhvcn1dKCR7aGlzdG9yeUl0ZW0uYXV0aG9ySWNvbi50b1N0cmluZygpfXx3aWR0aD0yMCxoZWlnaHQ9MjApYFxuXHRcdFx0XHQ6IFRoZW1lSWNvbi5pc1RoZW1lSWNvbihoaXN0b3J5SXRlbS5hdXRob3JJY29uKVxuXHRcdFx0XHRcdD8gYCQoJHtoaXN0b3J5SXRlbS5hdXRob3JJY29uLmlkfSlgXG5cdFx0XHRcdFx0OiAnJChhY2NvdW50KSc7XG5cblx0XHRcdGlmIChoaXN0b3J5SXRlbS5hdXRob3JFbWFpbCkge1xuXHRcdFx0XHRjb25zdCBlbWFpbFRpdGxlID0gbG9jYWxpemUoJ2VtYWlsTGlua1RpdGxlJywgXCJFbWFpbFwiKTtcblx0XHRcdFx0bWFya2Rvd24uYXBwZW5kTWFya2Rvd24oYCR7aWNvbn0gWyoqJHtoaXN0b3J5SXRlbS5hdXRob3J9KipdKG1haWx0bzoke2hpc3RvcnlJdGVtLmF1dGhvckVtYWlsfSBcIiR7ZW1haWxUaXRsZX0gJHtoaXN0b3J5SXRlbS5hdXRob3J9XCIpYCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtYXJrZG93bi5hcHBlbmRNYXJrZG93bihgJHtpY29ufSAqKiR7aGlzdG9yeUl0ZW0uYXV0aG9yfSoqYCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChoaXN0b3J5SXRlbS50aW1lc3RhbXApIHtcblx0XHRcdFx0Y29uc3QgZGF0ZUZvcm1hdHRlciA9IHNhZmVJbnRsLkRhdGVUaW1lRm9ybWF0KHBsYXRmb3JtLmxhbmd1YWdlLCB7IHllYXI6ICdudW1lcmljJywgbW9udGg6ICdsb25nJywgZGF5OiAnbnVtZXJpYycsIGhvdXI6ICdudW1lcmljJywgbWludXRlOiAnbnVtZXJpYycgfSk7XG5cdFx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGAsICQoaGlzdG9yeSkgJHtmcm9tTm93KGhpc3RvcnlJdGVtLnRpbWVzdGFtcCwgdHJ1ZSwgdHJ1ZSl9ICgke2RhdGVGb3JtYXR0ZXIuZm9ybWF0KGhpc3RvcnlJdGVtLnRpbWVzdGFtcCl9KWApO1xuXHRcdFx0fVxuXG5cdFx0XHRtYXJrZG93bi5hcHBlbmRNYXJrZG93bignXFxuXFxuJyk7XG5cdFx0fVxuXG5cdFx0bWFya2Rvd24uYXBwZW5kTWFya2Rvd24oYCR7aGlzdG9yeUl0ZW0ubWVzc2FnZX1cXG5cXG5gKTtcblxuXHRcdGlmIChoaXN0b3J5SXRlbS5zdGF0aXN0aWNzKSB7XG5cdFx0XHRtYXJrZG93bi5hcHBlbmRNYXJrZG93bihgLS0tXFxuXFxuYCk7XG5cblx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGA8c3Bhbj4ke2hpc3RvcnlJdGVtLnN0YXRpc3RpY3MuZmlsZXMgPT09IDEgP1xuXHRcdFx0XHRsb2NhbGl6ZSgnZmlsZUNoYW5nZWQnLCBcInswfSBmaWxlIGNoYW5nZWRcIiwgaGlzdG9yeUl0ZW0uc3RhdGlzdGljcy5maWxlcykgOlxuXHRcdFx0XHRsb2NhbGl6ZSgnZmlsZXNDaGFuZ2VkJywgXCJ7MH0gZmlsZXMgY2hhbmdlZFwiLCBoaXN0b3J5SXRlbS5zdGF0aXN0aWNzLmZpbGVzKX08L3NwYW4+YCk7XG5cblx0XHRcdGlmIChoaXN0b3J5SXRlbS5zdGF0aXN0aWNzLmluc2VydGlvbnMpIHtcblx0XHRcdFx0Y29uc3QgYWRkaXRpb25zRm9yZWdyb3VuZENvbG9yID0gY29sb3JUaGVtZS5nZXRDb2xvcihoaXN0b3J5SXRlbUhvdmVyQWRkaXRpb25zRm9yZWdyb3VuZCk7XG5cdFx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGAsJm5ic3A7PHNwYW4gc3R5bGU9XCJjb2xvcjoke2FkZGl0aW9uc0ZvcmVncm91bmRDb2xvcn07XCI+JHtoaXN0b3J5SXRlbS5zdGF0aXN0aWNzLmluc2VydGlvbnMgPT09IDEgP1xuXHRcdFx0XHRcdGxvY2FsaXplKCdpbnNlcnRpb24nLCBcInswfSBpbnNlcnRpb257MX1cIiwgaGlzdG9yeUl0ZW0uc3RhdGlzdGljcy5pbnNlcnRpb25zLCAnKCspJykgOlxuXHRcdFx0XHRcdGxvY2FsaXplKCdpbnNlcnRpb25zJywgXCJ7MH0gaW5zZXJ0aW9uc3sxfVwiLCBoaXN0b3J5SXRlbS5zdGF0aXN0aWNzLmluc2VydGlvbnMsICcoKyknKX08L3NwYW4+YCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChoaXN0b3J5SXRlbS5zdGF0aXN0aWNzLmRlbGV0aW9ucykge1xuXHRcdFx0XHRjb25zdCBkZWxldGlvbnNGb3JlZ3JvdW5kQ29sb3IgPSBjb2xvclRoZW1lLmdldENvbG9yKGhpc3RvcnlJdGVtSG92ZXJEZWxldGlvbnNGb3JlZ3JvdW5kKTtcblx0XHRcdFx0bWFya2Rvd24uYXBwZW5kTWFya2Rvd24oYCwmbmJzcDs8c3BhbiBzdHlsZT1cImNvbG9yOiR7ZGVsZXRpb25zRm9yZWdyb3VuZENvbG9yfTtcIj4ke2hpc3RvcnlJdGVtLnN0YXRpc3RpY3MuZGVsZXRpb25zID09PSAxID9cblx0XHRcdFx0XHRsb2NhbGl6ZSgnZGVsZXRpb24nLCBcInswfSBkZWxldGlvbnsxfVwiLCBoaXN0b3J5SXRlbS5zdGF0aXN0aWNzLmRlbGV0aW9ucywgJygtKScpIDpcblx0XHRcdFx0XHRsb2NhbGl6ZSgnZGVsZXRpb25zJywgXCJ7MH0gZGVsZXRpb25zezF9XCIsIGhpc3RvcnlJdGVtLnN0YXRpc3RpY3MuZGVsZXRpb25zLCAnKC0pJyl9PC9zcGFuPmApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICgoaGlzdG9yeUl0ZW0ucmVmZXJlbmNlcyA/PyBbXSkubGVuZ3RoID4gMCkge1xuXHRcdFx0bWFya2Rvd24uYXBwZW5kTWFya2Rvd24oYFxcblxcbi0tLVxcblxcbmApO1xuXHRcdFx0bWFya2Rvd24uYXBwZW5kTWFya2Rvd24oKGhpc3RvcnlJdGVtLnJlZmVyZW5jZXMgPz8gW10pLm1hcChyZWYgPT4ge1xuXHRcdFx0XHRjb25zdCBsYWJlbEljb25JZCA9IFRoZW1lSWNvbi5pc1RoZW1lSWNvbihyZWYuaWNvbikgPyByZWYuaWNvbi5pZCA6ICcnO1xuXG5cdFx0XHRcdGNvbnN0IGxhYmVsQmFja2dyb3VuZENvbG9yID0gcmVmLmNvbG9yID8gYXNDc3NWYXJpYWJsZShyZWYuY29sb3IpIDogYXNDc3NWYXJpYWJsZShoaXN0b3J5SXRlbUhvdmVyRGVmYXVsdExhYmVsQmFja2dyb3VuZCk7XG5cdFx0XHRcdGNvbnN0IGxhYmVsRm9yZWdyb3VuZENvbG9yID0gcmVmLmNvbG9yID8gYXNDc3NWYXJpYWJsZShoaXN0b3J5SXRlbUhvdmVyTGFiZWxGb3JlZ3JvdW5kKSA6IGFzQ3NzVmFyaWFibGUoaGlzdG9yeUl0ZW1Ib3ZlckRlZmF1bHRMYWJlbEZvcmVncm91bmQpO1xuXG5cdFx0XHRcdHJldHVybiBgPHNwYW4gc3R5bGU9XCJjb2xvcjoke2xhYmVsRm9yZWdyb3VuZENvbG9yfTtiYWNrZ3JvdW5kLWNvbG9yOiR7bGFiZWxCYWNrZ3JvdW5kQ29sb3J9O2JvcmRlci1yYWRpdXM6MTBweDtcIj4mbmJzcDskKCR7bGFiZWxJY29uSWR9KSZuYnNwOyR7cmVmLm5hbWV9Jm5ic3A7Jm5ic3A7PC9zcGFuPmA7XG5cdFx0XHR9KS5qb2luKCcmbmJzcDsmbmJzcDsnKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgbWFya2Rvd24sIG1hcmtkb3duTm90U3VwcG9ydGVkRmFsbGJhY2s6IGhpc3RvcnlJdGVtLm1lc3NhZ2UgfTtcblx0fVxuXG5cdHByaXZhdGUgX3Byb2Nlc3NNYXRjaGVzKGhpc3RvcnlJdGVtVmlld01vZGVsOiBJU0NNSGlzdG9yeUl0ZW1WaWV3TW9kZWwsIGZpbHRlckRhdGE6IExhYmVsRnV6enlTY29yZSB8IHVuZGVmaW5lZCk6IFtJTWF0Y2hbXSB8IHVuZGVmaW5lZCwgSU1hdGNoW10gfCB1bmRlZmluZWRdIHtcblx0XHRpZiAoIWZpbHRlckRhdGEpIHtcblx0XHRcdHJldHVybiBbdW5kZWZpbmVkLCB1bmRlZmluZWRdO1xuXHRcdH1cblxuXHRcdHJldHVybiBbXG5cdFx0XHRoaXN0b3J5SXRlbVZpZXdNb2RlbC5oaXN0b3J5SXRlbS5tZXNzYWdlID09PSBmaWx0ZXJEYXRhLmxhYmVsID8gY3JlYXRlTWF0Y2hlcyhmaWx0ZXJEYXRhLnNjb3JlKSA6IHVuZGVmaW5lZCxcblx0XHRcdGhpc3RvcnlJdGVtVmlld01vZGVsLmhpc3RvcnlJdGVtLmF1dGhvciA9PT0gZmlsdGVyRGF0YS5sYWJlbCA/IGNyZWF0ZU1hdGNoZXMoZmlsdGVyRGF0YS5zY29yZSkgOiB1bmRlZmluZWRcblx0XHRdO1xuXHR9XG5cblx0ZGlzcG9zZUVsZW1lbnQoZWxlbWVudDogSVRyZWVOb2RlPFNDTUhpc3RvcnlJdGVtVmlld01vZGVsVHJlZUVsZW1lbnQsIExhYmVsRnV6enlTY29yZT4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSGlzdG9yeUl0ZW1UZW1wbGF0ZSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBIaXN0b3J5SXRlbVRlbXBsYXRlKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5pbnRlcmZhY2UgTG9hZE1vcmVUZW1wbGF0ZSB7XG5cdHJlYWRvbmx5IGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXHRyZWFkb25seSBncmFwaFBsYWNlaG9sZGVyOiBIVE1MRWxlbWVudDtcblx0cmVhZG9ubHkgaGlzdG9yeUl0ZW1QbGFjZWhvbGRlckNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IGhpc3RvcnlJdGVtUGxhY2Vob2xkZXJMYWJlbDogSWNvbkxhYmVsO1xuXHRyZWFkb25seSBlbGVtZW50RGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0cmVhZG9ubHkgZGlzcG9zYWJsZXM6IElEaXNwb3NhYmxlO1xufVxuXG5jbGFzcyBIaXN0b3J5SXRlbUxvYWRNb3JlUmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPFNDTUhpc3RvcnlJdGVtTG9hZE1vcmVUcmVlRWxlbWVudCwgdm9pZCwgTG9hZE1vcmVUZW1wbGF0ZT4ge1xuXG5cdHN0YXRpYyByZWFkb25seSBURU1QTEFURV9JRCA9ICdoaXN0b3J5SXRlbUxvYWRNb3JlJztcblx0Z2V0IHRlbXBsYXRlSWQoKTogc3RyaW5nIHsgcmV0dXJuIEhpc3RvcnlJdGVtTG9hZE1vcmVSZW5kZXJlci5URU1QTEFURV9JRDsgfVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2lzTG9hZGluZ01vcmU6IElPYnNlcnZhYmxlPGJvb2xlYW4+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xvYWRNb3JlQ2FsbGJhY2s6ICgpID0+IHZvaWQsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkgeyB9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IExvYWRNb3JlVGVtcGxhdGUge1xuXHRcdC8vIGhhY2tcblx0XHQoY29udGFpbmVyLnBhcmVudEVsZW1lbnQhLnBhcmVudEVsZW1lbnQhLnF1ZXJ5U2VsZWN0b3IoJy5tb25hY28tdGwtdHdpc3RpZScpISBhcyBIVE1MRWxlbWVudCkuY2xhc3NMaXN0LmFkZCgnZm9yY2Utbm8tdHdpc3RpZScpO1xuXG5cdFx0Y29uc3QgZWxlbWVudCA9IGFwcGVuZChjb250YWluZXIsICQoJy5oaXN0b3J5LWl0ZW0tbG9hZC1tb3JlJykpO1xuXHRcdGNvbnN0IGdyYXBoUGxhY2Vob2xkZXIgPSBhcHBlbmQoZWxlbWVudCwgJCgnLmdyYXBoLXBsYWNlaG9sZGVyJykpO1xuXHRcdGNvbnN0IGhpc3RvcnlJdGVtUGxhY2Vob2xkZXJDb250YWluZXIgPSBhcHBlbmQoZWxlbWVudCwgJCgnLmhpc3RvcnktaXRlbS1wbGFjZWhvbGRlcicpKTtcblx0XHRjb25zdCBoaXN0b3J5SXRlbVBsYWNlaG9sZGVyTGFiZWwgPSBuZXcgSWNvbkxhYmVsKGhpc3RvcnlJdGVtUGxhY2Vob2xkZXJDb250YWluZXIsIHsgc3VwcG9ydEljb25zOiB0cnVlIH0pO1xuXG5cdFx0cmV0dXJuIHsgZWxlbWVudCwgZ3JhcGhQbGFjZWhvbGRlciwgaGlzdG9yeUl0ZW1QbGFjZWhvbGRlckNvbnRhaW5lciwgaGlzdG9yeUl0ZW1QbGFjZWhvbGRlckxhYmVsLCBlbGVtZW50RGlzcG9zYWJsZXM6IG5ldyBEaXNwb3NhYmxlU3RvcmUoKSwgZGlzcG9zYWJsZXM6IG5ldyBEaXNwb3NhYmxlU3RvcmUoKSB9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBJVHJlZU5vZGU8U0NNSGlzdG9yeUl0ZW1Mb2FkTW9yZVRyZWVFbGVtZW50LCB2b2lkPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBMb2FkTW9yZVRlbXBsYXRlLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5ncmFwaFBsYWNlaG9sZGVyLnRleHRDb250ZW50ID0gJyc7XG5cdFx0dGVtcGxhdGVEYXRhLmdyYXBoUGxhY2Vob2xkZXIuc3R5bGUud2lkdGggPSBgJHtTV0lNTEFORV9XSURUSCAqIChlbGVtZW50LmVsZW1lbnQuZ3JhcGhDb2x1bW5zLmxlbmd0aCArIDEpfXB4YDtcblx0XHR0ZW1wbGF0ZURhdGEuZ3JhcGhQbGFjZWhvbGRlci5hcHBlbmRDaGlsZChyZW5kZXJTQ01IaXN0b3J5R3JhcGhQbGFjZWhvbGRlcihlbGVtZW50LmVsZW1lbnQuZ3JhcGhDb2x1bW5zKSk7XG5cblx0XHRjb25zdCBwYWdlT25TY3JvbGwgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignc2NtLmdyYXBoLnBhZ2VPblNjcm9sbCcpID09PSB0cnVlO1xuXHRcdHRlbXBsYXRlRGF0YS5oaXN0b3J5SXRlbVBsYWNlaG9sZGVyQ29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ3NoaW1tZXInLCBwYWdlT25TY3JvbGwpO1xuXG5cdFx0aWYgKHBhZ2VPblNjcm9sbCkge1xuXHRcdFx0dGVtcGxhdGVEYXRhLmhpc3RvcnlJdGVtUGxhY2Vob2xkZXJMYWJlbC5zZXRMYWJlbCgnJyk7XG5cdFx0XHR0aGlzLl9sb2FkTW9yZUNhbGxiYWNrKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdFx0Y29uc3QgaXNMb2FkaW5nTW9yZSA9IHRoaXMuX2lzTG9hZGluZ01vcmUucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCBpY29uID0gYCQoJHtpc0xvYWRpbmdNb3JlID8gJ2xvYWRpbmd+c3BpbicgOiAnZm9sZC1kb3duJ30pYDtcblxuXHRcdFx0XHR0ZW1wbGF0ZURhdGEuaGlzdG9yeUl0ZW1QbGFjZWhvbGRlckxhYmVsLnNldExhYmVsKGxvY2FsaXplKCdsb2FkTW9yZScsIFwiezB9IExvYWQgTW9yZS4uLlwiLCBpY29uKSk7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG5cblx0ZGlzcG9zZUVsZW1lbnQoZWxlbWVudDogSVRyZWVOb2RlPFNDTUhpc3RvcnlJdGVtTG9hZE1vcmVUcmVlRWxlbWVudCwgdm9pZD4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogTG9hZE1vcmVUZW1wbGF0ZSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBMb2FkTW9yZVRlbXBsYXRlKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBIaXN0b3J5SXRlbUhvdmVyRGVsZWdhdGUgZXh0ZW5kcyBXb3JrYmVuY2hIb3ZlckRlbGVnYXRlIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdmlld0NvbnRhaW5lckxvY2F0aW9uOiBWaWV3Q29udGFpbmVyTG9jYXRpb24gfCBudWxsLFxuXHRcdEBJV29ya2JlbmNoTGF5b3V0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxheW91dFNlcnZpY2U6IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cblx0KSB7XG5cdFx0c3VwZXIoJ2VsZW1lbnQnLCB7IGluc3RhbnRIb3ZlcjogdHJ1ZSB9LCAoKSA9PiB0aGlzLmdldEhvdmVyT3B0aW9ucygpLCBjb25maWd1cmF0aW9uU2VydmljZSwgaG92ZXJTZXJ2aWNlKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0SG92ZXJPcHRpb25zKCk6IFBhcnRpYWw8SUhvdmVyT3B0aW9ucz4ge1xuXHRcdGNvbnN0IHNpZGVCYXJQb3NpdGlvbiA9IHRoaXMubGF5b3V0U2VydmljZS5nZXRTaWRlQmFyUG9zaXRpb24oKTtcblxuXHRcdGxldCBob3ZlclBvc2l0aW9uOiBIb3ZlclBvc2l0aW9uO1xuXHRcdGlmICh0aGlzLl92aWV3Q29udGFpbmVyTG9jYXRpb24gPT09IFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyKSB7XG5cdFx0XHRob3ZlclBvc2l0aW9uID0gc2lkZUJhclBvc2l0aW9uID09PSBQb3NpdGlvbi5MRUZUID8gSG92ZXJQb3NpdGlvbi5SSUdIVCA6IEhvdmVyUG9zaXRpb24uTEVGVDtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX3ZpZXdDb250YWluZXJMb2NhdGlvbiA9PT0gVmlld0NvbnRhaW5lckxvY2F0aW9uLkF1eGlsaWFyeUJhcikge1xuXHRcdFx0aG92ZXJQb3NpdGlvbiA9IHNpZGVCYXJQb3NpdGlvbiA9PT0gUG9zaXRpb24uTEVGVCA/IEhvdmVyUG9zaXRpb24uTEVGVCA6IEhvdmVyUG9zaXRpb24uUklHSFQ7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGhvdmVyUG9zaXRpb24gPSBIb3ZlclBvc2l0aW9uLlJJR0hUO1xuXHRcdH1cblxuXHRcdHJldHVybiB7IGFkZGl0aW9uYWxDbGFzc2VzOiBbJ2hpc3RvcnktaXRlbS1ob3ZlciddLCBwb3NpdGlvbjogeyBob3ZlclBvc2l0aW9uLCBmb3JjZVBvc2l0aW9uOiB0cnVlIH0gfTtcblx0fVxufVxuXG5jbGFzcyBTQ01IaXN0b3J5Vmlld1BhbmVBY3Rpb25SdW5uZXIgZXh0ZW5kcyBBY3Rpb25SdW5uZXIge1xuXHRjb25zdHJ1Y3RvcihASVByb2dyZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9wcm9ncmVzc1NlcnZpY2U6IElQcm9ncmVzc1NlcnZpY2UpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJ1bkFjdGlvbihhY3Rpb246IElBY3Rpb24sIGNvbnRleHQ/OiB1bmtub3duKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3MoeyBsb2NhdGlvbjogSElTVE9SWV9WSUVXX1BBTkVfSUQgfSxcblx0XHRcdGFzeW5jICgpID0+IGF3YWl0IHN1cGVyLnJ1bkFjdGlvbihhY3Rpb24sIGNvbnRleHQpKTtcblx0fVxufVxuXG5jbGFzcyBTQ01IaXN0b3J5VHJlZUFjY2Vzc2liaWxpdHlQcm92aWRlciBpbXBsZW1lbnRzIElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyPFRyZWVFbGVtZW50PiB7XG5cblx0Z2V0V2lkZ2V0QXJpYUxhYmVsKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGxvY2FsaXplKCdzY20gaGlzdG9yeScsIFwiU291cmNlIENvbnRyb2wgSGlzdG9yeVwiKTtcblx0fVxuXG5cdGdldEFyaWFMYWJlbChlbGVtZW50OiBUcmVlRWxlbWVudCk6IHN0cmluZyB7XG5cdFx0aWYgKGlzU0NNUmVwb3NpdG9yeShlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIGAke2VsZW1lbnQucHJvdmlkZXIubmFtZX0gJHtlbGVtZW50LnByb3ZpZGVyLmxhYmVsfWA7XG5cdFx0fSBlbHNlIGlmIChpc1NDTUhpc3RvcnlJdGVtVmlld01vZGVsVHJlZUVsZW1lbnQoZWxlbWVudCkpIHtcblx0XHRcdGNvbnN0IGhpc3RvcnlJdGVtID0gZWxlbWVudC5oaXN0b3J5SXRlbVZpZXdNb2RlbC5oaXN0b3J5SXRlbTtcblx0XHRcdHJldHVybiBgJHtzdHJpcEljb25zKGhpc3RvcnlJdGVtLm1lc3NhZ2UpLnRyaW0oKX0ke2hpc3RvcnlJdGVtLmF1dGhvciA/IGAsICR7aGlzdG9yeUl0ZW0uYXV0aG9yfWAgOiAnJ31gO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIFNDTUhpc3RvcnlUcmVlSWRlbnRpdHlQcm92aWRlciBpbXBsZW1lbnRzIElJZGVudGl0eVByb3ZpZGVyPFRyZWVFbGVtZW50PiB7XG5cblx0Z2V0SWQoZWxlbWVudDogVHJlZUVsZW1lbnQpOiBzdHJpbmcge1xuXHRcdGlmIChpc1NDTVJlcG9zaXRvcnkoZWxlbWVudCkpIHtcblx0XHRcdGNvbnN0IHByb3ZpZGVyID0gZWxlbWVudC5wcm92aWRlcjtcblx0XHRcdHJldHVybiBgcmVwbzoke3Byb3ZpZGVyLmlkfWA7XG5cdFx0fSBlbHNlIGlmIChpc1NDTUhpc3RvcnlJdGVtVmlld01vZGVsVHJlZUVsZW1lbnQoZWxlbWVudCkpIHtcblx0XHRcdGNvbnN0IHByb3ZpZGVyID0gZWxlbWVudC5yZXBvc2l0b3J5LnByb3ZpZGVyO1xuXHRcdFx0Y29uc3QgaGlzdG9yeUl0ZW0gPSBlbGVtZW50Lmhpc3RvcnlJdGVtVmlld01vZGVsLmhpc3RvcnlJdGVtO1xuXHRcdFx0cmV0dXJuIGBoaXN0b3J5SXRlbToke3Byb3ZpZGVyLmlkfS8ke2hpc3RvcnlJdGVtLmlkfS8ke2hpc3RvcnlJdGVtLnBhcmVudElkcy5qb2luKCcsJyl9YDtcblx0XHR9IGVsc2UgaWYgKGlzU0NNSGlzdG9yeUl0ZW1Mb2FkTW9yZVRyZWVFbGVtZW50KGVsZW1lbnQpKSB7XG5cdFx0XHRjb25zdCBwcm92aWRlciA9IGVsZW1lbnQucmVwb3NpdG9yeS5wcm92aWRlcjtcblx0XHRcdHJldHVybiBgaGlzdG9yeUl0ZW1Mb2FkTW9yZToke3Byb3ZpZGVyLmlkfX1gO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgdHJlZSBlbGVtZW50Jyk7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIFNDTUhpc3RvcnlUcmVlS2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWxQcm92aWRlciBpbXBsZW1lbnRzIElLZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyPFRyZWVFbGVtZW50PiB7XG5cdGdldEtleWJvYXJkTmF2aWdhdGlvbkxhYmVsKGVsZW1lbnQ6IFRyZWVFbGVtZW50KTogeyB0b1N0cmluZygpOiBzdHJpbmcgfSB8IHsgdG9TdHJpbmcoKTogc3RyaW5nIH1bXSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKGlzU0NNUmVwb3NpdG9yeShlbGVtZW50KSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9IGVsc2UgaWYgKGlzU0NNSGlzdG9yeUl0ZW1WaWV3TW9kZWxUcmVlRWxlbWVudChlbGVtZW50KSkge1xuXHRcdFx0Ly8gRm9yIGEgaGlzdG9yeSBpdGVtIHdlIHdhbnQgdG8gbWF0Y2ggYm90aCB0aGUgbWVzc2FnZSBhbmRcblx0XHRcdC8vIHRoZSBhdXRob3IuIEEgbWF0Y2ggaW4gdGhlIG1lc3NhZ2UgdGFrZXMgcHJlY2VkZW5jZSBvdmVyXG5cdFx0XHQvLyBhIG1hdGNoIGluIHRoZSBhdXRob3IuXG5cdFx0XHRyZXR1cm4gW2VsZW1lbnQuaGlzdG9yeUl0ZW1WaWV3TW9kZWwuaGlzdG9yeUl0ZW0ubWVzc2FnZSwgZWxlbWVudC5oaXN0b3J5SXRlbVZpZXdNb2RlbC5oaXN0b3J5SXRlbS5hdXRob3JdO1xuXHRcdH0gZWxzZSBpZiAoaXNTQ01IaXN0b3J5SXRlbUxvYWRNb3JlVHJlZUVsZW1lbnQoZWxlbWVudCkpIHtcblx0XHRcdC8vIFdlIGRvbid0IHdhbnQgdG8gbWF0Y2ggdGhlIGxvYWQgbW9yZSBlbGVtZW50XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCB0cmVlIGVsZW1lbnQnKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgU0NNSGlzdG9yeVRyZWVEYXRhU291cmNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElBc3luY0RhdGFTb3VyY2U8U0NNSGlzdG9yeVZpZXdNb2RlbCwgVHJlZUVsZW1lbnQ+IHtcblxuXHRhc3luYyBnZXRDaGlsZHJlbihpbnB1dE9yRWxlbWVudDogU0NNSGlzdG9yeVZpZXdNb2RlbCB8IFRyZWVFbGVtZW50KTogUHJvbWlzZTxJdGVyYWJsZTxUcmVlRWxlbWVudD4+IHtcblx0XHRpZiAoIShpbnB1dE9yRWxlbWVudCBpbnN0YW5jZW9mIFNDTUhpc3RvcnlWaWV3TW9kZWwpKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Ly8gSGlzdG9yeSBpdGVtc1xuXHRcdGNvbnN0IGNoaWxkcmVuOiBUcmVlRWxlbWVudFtdID0gW107XG5cdFx0Y29uc3QgaGlzdG9yeUl0ZW1zID0gYXdhaXQgaW5wdXRPckVsZW1lbnQuZ2V0SGlzdG9yeUl0ZW1zKCk7XG5cdFx0Y2hpbGRyZW4ucHVzaCguLi5oaXN0b3J5SXRlbXMpO1xuXG5cdFx0Ly8gTG9hZCBNb3JlIGVsZW1lbnRcblx0XHRjb25zdCByZXBvc2l0b3J5ID0gaW5wdXRPckVsZW1lbnQucmVwb3NpdG9yeS5nZXQoKTtcblx0XHRjb25zdCBsYXN0SGlzdG9yeUl0ZW0gPSBoaXN0b3J5SXRlbXMuYXQoLTEpO1xuXHRcdGlmIChyZXBvc2l0b3J5ICYmIGxhc3RIaXN0b3J5SXRlbSAmJiBsYXN0SGlzdG9yeUl0ZW0uaGlzdG9yeUl0ZW1WaWV3TW9kZWwub3V0cHV0U3dpbWxhbmVzLmxlbmd0aCA+IDApIHtcblx0XHRcdGNoaWxkcmVuLnB1c2goe1xuXHRcdFx0XHRyZXBvc2l0b3J5LFxuXHRcdFx0XHRncmFwaENvbHVtbnM6IGxhc3RIaXN0b3J5SXRlbS5oaXN0b3J5SXRlbVZpZXdNb2RlbC5vdXRwdXRTd2ltbGFuZXMsXG5cdFx0XHRcdHR5cGU6ICdoaXN0b3J5SXRlbUxvYWRNb3JlJ1xuXHRcdFx0fSBzYXRpc2ZpZXMgU0NNSGlzdG9yeUl0ZW1Mb2FkTW9yZVRyZWVFbGVtZW50KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gY2hpbGRyZW47XG5cdH1cblxuXHRoYXNDaGlsZHJlbihpbnB1dE9yRWxlbWVudDogU0NNSGlzdG9yeVZpZXdNb2RlbCB8IFRyZWVFbGVtZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGlucHV0T3JFbGVtZW50IGluc3RhbmNlb2YgU0NNSGlzdG9yeVZpZXdNb2RlbDtcblx0fVxufVxuXG50eXBlIEhpc3RvcnlJdGVtUmVmc0ZpbHRlciA9ICdhbGwnIHwgJ2F1dG8nIHwgc3RyaW5nW107XG5cbnR5cGUgUmVwb3NpdG9yeVN0YXRlID0ge1xuXHR2aWV3TW9kZWxzOiBTQ01IaXN0b3J5SXRlbVZpZXdNb2RlbFRyZWVFbGVtZW50W107XG5cdGhpc3RvcnlJdGVtc0ZpbHRlcjogSVNDTUhpc3RvcnlJdGVtUmVmW107XG5cdGxvYWRNb3JlOiBib29sZWFuIHwgc3RyaW5nO1xufTtcblxuY2xhc3MgU0NNSGlzdG9yeVZpZXdNb2RlbCBleHRlbmRzIERpc3Bvc2FibGUge1xuXHQvKipcblx0ICogVGhlIGFjdGl2ZSB8IHNlbGVjdGVkIHJlcG9zaXRvcnkgdGFrZXMgcHJlY2VkZW5jZSBvdmVyIHRoZSBmaXJzdCByZXBvc2l0b3J5IHdoZW4gdGhlIG9ic2VydmFibGVcblx0ICogdmFsdWVzIGFyZSB1cGRhdGVkIGluIHRoZSBzYW1lIHRyYW5zYWN0aW9uIChvciBkdXJpbmcgdGhlIGluaXRpYWwgcmVhZCBvZiB0aGUgb2JzZXJ2YWJsZSB2YWx1ZSkuXG5cdCAqL1xuXHRyZWFkb25seSByZXBvc2l0b3J5OiBJT2JzZXJ2YWJsZTxJU0NNUmVwb3NpdG9yeSB8IHVuZGVmaW5lZD47XG5cdHByaXZhdGUgcmVhZG9ubHkgX3NlbGVjdGVkUmVwb3NpdG9yeSA9IG9ic2VydmFibGVWYWx1ZTwnYXV0bycgfCBJU0NNUmVwb3NpdG9yeT4odGhpcywgJ2F1dG8nKTtcblxuXHRyZWFkb25seSBvbkRpZENoYW5nZUhpc3RvcnlJdGVtc0ZpbHRlciA9IG9ic2VydmFibGVTaWduYWwodGhpcyk7XG5cdHJlYWRvbmx5IGlzVmlld01vZGVsRW1wdHkgPSBvYnNlcnZhYmxlVmFsdWUodGhpcywgZmFsc2UpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3JlcG9zaXRvcnlTdGF0ZSA9IG5ldyBNYXA8SVNDTVJlcG9zaXRvcnksIFJlcG9zaXRvcnlTdGF0ZT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVwb3NpdG9yeUZpbHRlclN0YXRlID0gbmV3IE1hcDxzdHJpbmcsIEhpc3RvcnlJdGVtUmVmc0ZpbHRlcj4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zY21IaXN0b3J5SXRlbUNvdW50Q3R4OiBJQ29udGV4dEtleTxudW1iZXI+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJU0NNU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9zY21TZXJ2aWNlOiBJU0NNU2VydmljZSxcblx0XHRASVNDTVZpZXdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3NjbVZpZXdTZXJ2aWNlOiBJU0NNVmlld1NlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9zdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZXBvc2l0b3J5RmlsdGVyU3RhdGUgPSB0aGlzLl9sb2FkSGlzdG9yeUl0ZW1zRmlsdGVyU3RhdGUoKTtcblxuXHRcdHRoaXMuX2V4dGVuc2lvblNlcnZpY2Uub25XaWxsU3RvcCh0aGlzLl9zYXZlSGlzdG9yeUl0ZW1zRmlsdGVyU3RhdGUsIHRoaXMsIHRoaXMuX3N0b3JlKTtcblx0XHR0aGlzLl9zdG9yYWdlU2VydmljZS5vbldpbGxTYXZlU3RhdGUodGhpcy5fc2F2ZUhpc3RvcnlJdGVtc0ZpbHRlclN0YXRlLCB0aGlzLCB0aGlzLl9zdG9yZSk7XG5cblx0XHR0aGlzLl9zY21IaXN0b3J5SXRlbUNvdW50Q3R4ID0gQ29udGV4dEtleXMuU0NNSGlzdG9yeUl0ZW1Db3VudC5iaW5kVG8odGhpcy5fY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgZmlyc3RSZXBvc2l0b3J5ID0gdGhpcy5fc2NtU2VydmljZS5yZXBvc2l0b3J5Q291bnQgPiAwXG5cdFx0XHQ/IGNvbnN0T2JzZXJ2YWJsZShJdGVyYWJsZS5maXJzdCh0aGlzLl9zY21TZXJ2aWNlLnJlcG9zaXRvcmllcykpXG5cdFx0XHQ6IG9ic2VydmFibGVGcm9tRXZlbnQodGhpcyxcblx0XHRcdFx0RXZlbnQub25jZSh0aGlzLl9zY21TZXJ2aWNlLm9uRGlkQWRkUmVwb3NpdG9yeSksXG5cdFx0XHRcdHJlcG9zaXRvcnkgPT4gcmVwb3NpdG9yeSk7XG5cblx0XHRjb25zdCBncmFwaFJlcG9zaXRvcnkgPSBkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCBzZWxlY3RlZFJlcG9zaXRvcnkgPSB0aGlzLl9zZWxlY3RlZFJlcG9zaXRvcnkucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKHNlbGVjdGVkUmVwb3NpdG9yeSAhPT0gJ2F1dG8nKSB7XG5cdFx0XHRcdHJldHVybiBzZWxlY3RlZFJlcG9zaXRvcnk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0aGlzLl9zY21WaWV3U2VydmljZS5hY3RpdmVSZXBvc2l0b3J5LnJlYWQocmVhZGVyKTtcblx0XHR9KTtcblxuXHRcdHRoaXMucmVwb3NpdG9yeSA9IGxhdGVzdENoYW5nZWRWYWx1ZSh0aGlzLCBbZmlyc3RSZXBvc2l0b3J5LCBncmFwaFJlcG9zaXRvcnldKTtcblxuXHRcdGNvbnN0IGNsb3NlZFJlcG9zaXRvcnkgPSBvYnNlcnZhYmxlRnJvbUV2ZW50KHRoaXMsXG5cdFx0XHR0aGlzLl9zY21TZXJ2aWNlLm9uRGlkUmVtb3ZlUmVwb3NpdG9yeSxcblx0XHRcdHJlcG9zaXRvcnkgPT4gcmVwb3NpdG9yeSk7XG5cblx0XHQvLyBDbG9zZWQgcmVwb3NpdG9yeSBjbGVhbnVwXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0Y29uc3QgcmVwb3NpdG9yeSA9IGNsb3NlZFJlcG9zaXRvcnkucmVhZChyZWFkZXIpO1xuXHRcdFx0aWYgKCFyZXBvc2l0b3J5KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMucmVwb3NpdG9yeS5nZXQoKSA9PT0gcmVwb3NpdG9yeSkge1xuXHRcdFx0XHR0aGlzLl9zZWxlY3RlZFJlcG9zaXRvcnkuc2V0KEl0ZXJhYmxlLmZpcnN0KHRoaXMuX3NjbVNlcnZpY2UucmVwb3NpdG9yaWVzKSA/PyAnYXV0bycsIHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX3JlcG9zaXRvcnlTdGF0ZS5kZWxldGUocmVwb3NpdG9yeSk7XG5cdFx0fSkpO1xuXHR9XG5cblx0Y2xlYXJSZXBvc2l0b3J5U3RhdGUoKTogdm9pZCB7XG5cdFx0Y29uc3QgcmVwb3NpdG9yeSA9IHRoaXMucmVwb3NpdG9yeS5nZXQoKTtcblx0XHRpZiAoIXJlcG9zaXRvcnkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9yZXBvc2l0b3J5U3RhdGUuZGVsZXRlKHJlcG9zaXRvcnkpO1xuXHR9XG5cblx0Z2V0SGlzdG9yeUl0ZW1zRmlsdGVyKCk6ICdhbGwnIHwgJ2F1dG8nIHwgSVNDTUhpc3RvcnlJdGVtUmVmW10gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHJlcG9zaXRvcnkgPSB0aGlzLnJlcG9zaXRvcnkuZ2V0KCk7XG5cdFx0aWYgKCFyZXBvc2l0b3J5KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmlsdGVyU3RhdGUgPSB0aGlzLl9yZXBvc2l0b3J5RmlsdGVyU3RhdGUuZ2V0KGdldFByb3ZpZGVyS2V5KHJlcG9zaXRvcnkucHJvdmlkZXIpKSA/PyAnYXV0byc7XG5cdFx0aWYgKGZpbHRlclN0YXRlID09PSAnYWxsJyB8fCBmaWx0ZXJTdGF0ZSA9PT0gJ2F1dG8nKSB7XG5cdFx0XHRyZXR1cm4gZmlsdGVyU3RhdGU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVwb3NpdG9yeVN0YXRlID0gdGhpcy5fcmVwb3NpdG9yeVN0YXRlLmdldChyZXBvc2l0b3J5KTtcblx0XHRyZXR1cm4gcmVwb3NpdG9yeVN0YXRlPy5oaXN0b3J5SXRlbXNGaWx0ZXI7XG5cdH1cblxuXHRnZXRDdXJyZW50SGlzdG9yeUl0ZW1UcmVlRWxlbWVudCgpOiBTQ01IaXN0b3J5SXRlbVZpZXdNb2RlbFRyZWVFbGVtZW50IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCByZXBvc2l0b3J5ID0gdGhpcy5yZXBvc2l0b3J5LmdldCgpO1xuXHRcdGlmICghcmVwb3NpdG9yeSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuX3JlcG9zaXRvcnlTdGF0ZS5nZXQocmVwb3NpdG9yeSk7XG5cdFx0aWYgKCFzdGF0ZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBoaXN0b3J5UHJvdmlkZXIgPSByZXBvc2l0b3J5Py5wcm92aWRlci5oaXN0b3J5UHJvdmlkZXIuZ2V0KCk7XG5cdFx0Y29uc3QgaGlzdG9yeUl0ZW1SZWYgPSBoaXN0b3J5UHJvdmlkZXI/Lmhpc3RvcnlJdGVtUmVmLmdldCgpO1xuXG5cdFx0cmV0dXJuIHN0YXRlLnZpZXdNb2RlbHNcblx0XHRcdC5maW5kKHZpZXdNb2RlbCA9PiB2aWV3TW9kZWwuaGlzdG9yeUl0ZW1WaWV3TW9kZWwuaGlzdG9yeUl0ZW0uaWQgPT09IGhpc3RvcnlJdGVtUmVmPy5yZXZpc2lvbik7XG5cdH1cblxuXHRsb2FkTW9yZShjdXJzb3I/OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCByZXBvc2l0b3J5ID0gdGhpcy5yZXBvc2l0b3J5LmdldCgpO1xuXHRcdGlmICghcmVwb3NpdG9yeSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0YXRlID0gdGhpcy5fcmVwb3NpdG9yeVN0YXRlLmdldChyZXBvc2l0b3J5KTtcblx0XHRpZiAoIXN0YXRlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVwb3NpdG9yeVN0YXRlLnNldChyZXBvc2l0b3J5LCB7IC4uLnN0YXRlLCBsb2FkTW9yZTogY3Vyc29yID8/IHRydWUgfSk7XG5cdH1cblxuXHRhc3luYyBnZXRIaXN0b3J5SXRlbXMoKTogUHJvbWlzZTxTQ01IaXN0b3J5SXRlbVZpZXdNb2RlbFRyZWVFbGVtZW50W10+IHtcblx0XHRjb25zdCByZXBvc2l0b3J5ID0gdGhpcy5yZXBvc2l0b3J5LmdldCgpO1xuXHRcdGNvbnN0IGhpc3RvcnlQcm92aWRlciA9IHJlcG9zaXRvcnk/LnByb3ZpZGVyLmhpc3RvcnlQcm92aWRlci5nZXQoKTtcblxuXHRcdGlmICghcmVwb3NpdG9yeSB8fCAhaGlzdG9yeVByb3ZpZGVyKSB7XG5cdFx0XHR0aGlzLl9zY21IaXN0b3J5SXRlbUNvdW50Q3R4LnNldCgwKTtcblx0XHRcdHRoaXMuaXNWaWV3TW9kZWxFbXB0eS5zZXQodHJ1ZSwgdW5kZWZpbmVkKTtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRsZXQgc3RhdGUgPSB0aGlzLl9yZXBvc2l0b3J5U3RhdGUuZ2V0KHJlcG9zaXRvcnkpO1xuXG5cdFx0aWYgKCFzdGF0ZSB8fCBzdGF0ZS5sb2FkTW9yZSAhPT0gZmFsc2UpIHtcblx0XHRcdGNvbnN0IGhpc3RvcnlJdGVtcyA9IHN0YXRlPy52aWV3TW9kZWxzXG5cdFx0XHRcdC5tYXAodm0gPT4gdm0uaGlzdG9yeUl0ZW1WaWV3TW9kZWwuaGlzdG9yeUl0ZW0pID8/IFtdO1xuXG5cdFx0XHRjb25zdCBoaXN0b3J5SXRlbVJlZnMgPSBzdGF0ZT8uaGlzdG9yeUl0ZW1zRmlsdGVyID8/XG5cdFx0XHRcdGF3YWl0IHRoaXMuX3Jlc29sdmVIaXN0b3J5SXRlbUZpbHRlcihyZXBvc2l0b3J5LCBoaXN0b3J5UHJvdmlkZXIpO1xuXG5cdFx0XHRjb25zdCBsaW1pdCA9IGNsYW1wKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPG51bWJlcj4oJ3NjbS5ncmFwaC5wYWdlU2l6ZScpLCAxLCAxMDAwKTtcblx0XHRcdGNvbnN0IGhpc3RvcnlJdGVtUmVmSWRzID0gaGlzdG9yeUl0ZW1SZWZzLm1hcChyZWYgPT4gcmVmLnJldmlzaW9uID8/IHJlZi5pZCk7XG5cblx0XHRcdGRvIHtcblx0XHRcdFx0Ly8gRmV0Y2ggdGhlIG5leHQgcGFnZSBvZiBoaXN0b3J5IGl0ZW1zXG5cdFx0XHRcdGhpc3RvcnlJdGVtcy5wdXNoKC4uLihhd2FpdCBoaXN0b3J5UHJvdmlkZXIucHJvdmlkZUhpc3RvcnlJdGVtcyh7XG5cdFx0XHRcdFx0aGlzdG9yeUl0ZW1SZWZzOiBoaXN0b3J5SXRlbVJlZklkcywgbGltaXQsIHNraXA6IGhpc3RvcnlJdGVtcy5sZW5ndGhcblx0XHRcdFx0fSkgPz8gW10pKTtcblx0XHRcdH0gd2hpbGUgKHR5cGVvZiBzdGF0ZT8ubG9hZE1vcmUgPT09ICdzdHJpbmcnICYmICFoaXN0b3J5SXRlbXMuZmluZChpdGVtID0+IGl0ZW0uaWQgPT09IHN0YXRlPy5sb2FkTW9yZSkpO1xuXG5cdFx0XHQvLyBDcmVhdGUgdGhlIGNvbG9yIG1hcFxuXHRcdFx0Y29uc3QgY29sb3JNYXAgPSB0aGlzLl9nZXRHcmFwaENvbG9yTWFwKGhpc3RvcnlJdGVtUmVmcyk7XG5cblx0XHRcdGNvbnN0IHZpZXdNb2RlbHMgPSB0b0lTQ01IaXN0b3J5SXRlbVZpZXdNb2RlbEFycmF5KGhpc3RvcnlJdGVtcywgY29sb3JNYXAsIGhpc3RvcnlQcm92aWRlci5oaXN0b3J5SXRlbVJlZi5nZXQoKSlcblx0XHRcdFx0Lm1hcChoaXN0b3J5SXRlbVZpZXdNb2RlbCA9PiAoe1xuXHRcdFx0XHRcdHJlcG9zaXRvcnksXG5cdFx0XHRcdFx0aGlzdG9yeUl0ZW1WaWV3TW9kZWwsXG5cdFx0XHRcdFx0dHlwZTogJ2hpc3RvcnlJdGVtVmlld01vZGVsJ1xuXHRcdFx0XHR9KSBzYXRpc2ZpZXMgU0NNSGlzdG9yeUl0ZW1WaWV3TW9kZWxUcmVlRWxlbWVudCk7XG5cblx0XHRcdHN0YXRlID0geyBoaXN0b3J5SXRlbXNGaWx0ZXI6IGhpc3RvcnlJdGVtUmVmcywgdmlld01vZGVscywgbG9hZE1vcmU6IGZhbHNlIH07XG5cdFx0XHR0aGlzLl9yZXBvc2l0b3J5U3RhdGUuc2V0KHJlcG9zaXRvcnksIHN0YXRlKTtcblxuXHRcdFx0dGhpcy5fc2NtSGlzdG9yeUl0ZW1Db3VudEN0eC5zZXQodmlld01vZGVscy5sZW5ndGgpO1xuXHRcdFx0dGhpcy5pc1ZpZXdNb2RlbEVtcHR5LnNldCh2aWV3TW9kZWxzLmxlbmd0aCA9PT0gMCwgdW5kZWZpbmVkKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gc3RhdGUudmlld01vZGVscztcblx0fVxuXG5cdHNldFJlcG9zaXRvcnkocmVwb3NpdG9yeTogSVNDTVJlcG9zaXRvcnkgfCAnYXV0bycpOiB2b2lkIHtcblx0XHR0aGlzLl9zZWxlY3RlZFJlcG9zaXRvcnkuc2V0KHJlcG9zaXRvcnksIHVuZGVmaW5lZCk7XG5cdH1cblxuXHRzZXRIaXN0b3J5SXRlbXNGaWx0ZXIoZmlsdGVyOiBIaXN0b3J5SXRlbVJlZnNGaWx0ZXIpOiB2b2lkIHtcblx0XHRjb25zdCByZXBvc2l0b3J5ID0gdGhpcy5yZXBvc2l0b3J5LmdldCgpO1xuXHRcdGlmICghcmVwb3NpdG9yeSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChmaWx0ZXIgIT09ICdhdXRvJykge1xuXHRcdFx0dGhpcy5fcmVwb3NpdG9yeUZpbHRlclN0YXRlLnNldChnZXRQcm92aWRlcktleShyZXBvc2l0b3J5LnByb3ZpZGVyKSwgZmlsdGVyKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fcmVwb3NpdG9yeUZpbHRlclN0YXRlLmRlbGV0ZShnZXRQcm92aWRlcktleShyZXBvc2l0b3J5LnByb3ZpZGVyKSk7XG5cdFx0fVxuXHRcdHRoaXMuX3NhdmVIaXN0b3J5SXRlbXNGaWx0ZXJTdGF0ZSgpO1xuXG5cdFx0dGhpcy5vbkRpZENoYW5nZUhpc3RvcnlJdGVtc0ZpbHRlci50cmlnZ2VyKHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRHcmFwaENvbG9yTWFwKGhpc3RvcnlJdGVtUmVmczogSVNDTUhpc3RvcnlJdGVtUmVmW10pOiBNYXA8c3RyaW5nLCBDb2xvcklkZW50aWZpZXIgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCByZXBvc2l0b3J5ID0gdGhpcy5yZXBvc2l0b3J5LmdldCgpO1xuXHRcdGNvbnN0IGhpc3RvcnlQcm92aWRlciA9IHJlcG9zaXRvcnk/LnByb3ZpZGVyLmhpc3RvcnlQcm92aWRlci5nZXQoKTtcblx0XHRjb25zdCBoaXN0b3J5SXRlbVJlZiA9IGhpc3RvcnlQcm92aWRlcj8uaGlzdG9yeUl0ZW1SZWYuZ2V0KCk7XG5cdFx0Y29uc3QgaGlzdG9yeUl0ZW1SZW1vdGVSZWYgPSBoaXN0b3J5UHJvdmlkZXI/Lmhpc3RvcnlJdGVtUmVtb3RlUmVmLmdldCgpO1xuXHRcdGNvbnN0IGhpc3RvcnlJdGVtQmFzZVJlZiA9IGhpc3RvcnlQcm92aWRlcj8uaGlzdG9yeUl0ZW1CYXNlUmVmLmdldCgpO1xuXG5cdFx0Y29uc3QgY29sb3JNYXAgPSBuZXcgTWFwPHN0cmluZywgQ29sb3JJZGVudGlmaWVyIHwgdW5kZWZpbmVkPigpO1xuXG5cdFx0aWYgKGhpc3RvcnlJdGVtUmVmKSB7XG5cdFx0XHRjb2xvck1hcC5zZXQoaGlzdG9yeUl0ZW1SZWYuaWQsIGhpc3RvcnlJdGVtUmVmLmNvbG9yKTtcblxuXHRcdFx0aWYgKGhpc3RvcnlJdGVtUmVtb3RlUmVmKSB7XG5cdFx0XHRcdGNvbG9yTWFwLnNldChoaXN0b3J5SXRlbVJlbW90ZVJlZi5pZCwgaGlzdG9yeUl0ZW1SZW1vdGVSZWYuY29sb3IpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGhpc3RvcnlJdGVtQmFzZVJlZikge1xuXHRcdFx0XHRjb2xvck1hcC5zZXQoaGlzdG9yeUl0ZW1CYXNlUmVmLmlkLCBoaXN0b3J5SXRlbUJhc2VSZWYuY29sb3IpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEFkZCB0aGUgcmVtYWluaW5nIGhpc3RvcnkgaXRlbSByZWZlcmVuY2VzIHRvIHRoZSBjb2xvciBtYXBcblx0XHQvLyBpZiBub3QgYWxyZWFkeSBwcmVzZW50LiBUaGVzZSBoaXN0b3J5IGl0ZW0gcmVmZXJlbmNlcyB3aWxsXG5cdFx0Ly8gYmUgY29sb3JlZCB1c2luZyB0aGUgY29sb3Igb2YgdGhlIGhpc3RvcnkgaXRlbSB0byB3aGljaCB0aGV5XG5cdFx0Ly8gcG9pbnQgdG8uXG5cdFx0Zm9yIChjb25zdCByZWYgb2YgaGlzdG9yeUl0ZW1SZWZzKSB7XG5cdFx0XHRpZiAoIWNvbG9yTWFwLmhhcyhyZWYuaWQpKSB7XG5cdFx0XHRcdGNvbG9yTWFwLnNldChyZWYuaWQsIHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNvbG9yTWFwO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcmVzb2x2ZUhpc3RvcnlJdGVtRmlsdGVyKHJlcG9zaXRvcnk6IElTQ01SZXBvc2l0b3J5LCBoaXN0b3J5UHJvdmlkZXI6IElTQ01IaXN0b3J5UHJvdmlkZXIpOiBQcm9taXNlPElTQ01IaXN0b3J5SXRlbVJlZltdPiB7XG5cdFx0Y29uc3QgaGlzdG9yeUl0ZW1SZWZzOiBJU0NNSGlzdG9yeUl0ZW1SZWZbXSA9IFtdO1xuXHRcdGNvbnN0IGhpc3RvcnlJdGVtc0ZpbHRlciA9IHRoaXMuX3JlcG9zaXRvcnlGaWx0ZXJTdGF0ZS5nZXQoZ2V0UHJvdmlkZXJLZXkocmVwb3NpdG9yeS5wcm92aWRlcikpID8/ICdhdXRvJztcblxuXHRcdHN3aXRjaCAoaGlzdG9yeUl0ZW1zRmlsdGVyKSB7XG5cdFx0XHRjYXNlICdhbGwnOlxuXHRcdFx0XHRoaXN0b3J5SXRlbVJlZnMucHVzaCguLi4oYXdhaXQgaGlzdG9yeVByb3ZpZGVyLnByb3ZpZGVIaXN0b3J5SXRlbVJlZnMoKSA/PyBbXSkpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ2F1dG8nOlxuXHRcdFx0XHRoaXN0b3J5SXRlbVJlZnMucHVzaCguLi5bXG5cdFx0XHRcdFx0aGlzdG9yeVByb3ZpZGVyLmhpc3RvcnlJdGVtUmVmLmdldCgpLFxuXHRcdFx0XHRcdGhpc3RvcnlQcm92aWRlci5oaXN0b3J5SXRlbVJlbW90ZVJlZi5nZXQoKSxcblx0XHRcdFx0XHRoaXN0b3J5UHJvdmlkZXIuaGlzdG9yeUl0ZW1CYXNlUmVmLmdldCgpLFxuXHRcdFx0XHRdLmZpbHRlcihyZWYgPT4gISFyZWYpKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdC8vIEdldCB0aGUgbGF0ZXN0IHJldmlzaW9ucyBmb3IgdGhlIGhpc3RvcnkgaXRlbXMgcmVmZXJlbmNlcyBpbiB0aGUgZmlsZXJcblx0XHRcdFx0Y29uc3QgcmVmcyA9IChhd2FpdCBoaXN0b3J5UHJvdmlkZXIucHJvdmlkZUhpc3RvcnlJdGVtUmVmcyhoaXN0b3J5SXRlbXNGaWx0ZXIpID8/IFtdKVxuXHRcdFx0XHRcdC5maWx0ZXIocmVmID0+IGhpc3RvcnlJdGVtc0ZpbHRlci5zb21lKGZpbHRlciA9PiBmaWx0ZXIgPT09IHJlZi5pZCkpO1xuXG5cdFx0XHRcdGlmIChyZWZzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdC8vIFJlc2V0IHRoZSBmaWx0ZXJcblx0XHRcdFx0XHRoaXN0b3J5SXRlbVJlZnMucHVzaCguLi5bXG5cdFx0XHRcdFx0XHRoaXN0b3J5UHJvdmlkZXIuaGlzdG9yeUl0ZW1SZWYuZ2V0KCksXG5cdFx0XHRcdFx0XHRoaXN0b3J5UHJvdmlkZXIuaGlzdG9yeUl0ZW1SZW1vdGVSZWYuZ2V0KCksXG5cdFx0XHRcdFx0XHRoaXN0b3J5UHJvdmlkZXIuaGlzdG9yeUl0ZW1CYXNlUmVmLmdldCgpLFxuXHRcdFx0XHRcdF0uZmlsdGVyKHJlZiA9PiAhIXJlZikpO1xuXHRcdFx0XHRcdHRoaXMuX3JlcG9zaXRvcnlGaWx0ZXJTdGF0ZS5kZWxldGUoZ2V0UHJvdmlkZXJLZXkocmVwb3NpdG9yeS5wcm92aWRlcikpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIFVwZGF0ZSBmaWx0ZXJcblx0XHRcdFx0XHRoaXN0b3J5SXRlbVJlZnMucHVzaCguLi5yZWZzKTtcblx0XHRcdFx0XHR0aGlzLl9yZXBvc2l0b3J5RmlsdGVyU3RhdGUuc2V0KGdldFByb3ZpZGVyS2V5KHJlcG9zaXRvcnkucHJvdmlkZXIpLCByZWZzLm1hcChyZWYgPT4gcmVmLmlkKSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLl9zYXZlSGlzdG9yeUl0ZW1zRmlsdGVyU3RhdGUoKTtcblxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gaGlzdG9yeUl0ZW1SZWZzO1xuXHR9XG5cblx0cHJpdmF0ZSBfbG9hZEhpc3RvcnlJdGVtc0ZpbHRlclN0YXRlKCkge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBmaWx0ZXJEYXRhID0gdGhpcy5fc3RvcmFnZVNlcnZpY2UuZ2V0KCdzY20uZ3JhcGhWaWV3LnJlZmVyZW5jZXNGaWx0ZXInLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKTtcblx0XHRcdGlmIChmaWx0ZXJEYXRhKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgTWFwPHN0cmluZywgSGlzdG9yeUl0ZW1SZWZzRmlsdGVyPihKU09OLnBhcnNlKGZpbHRlckRhdGEpKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIHsgfVxuXG5cdFx0cmV0dXJuIG5ldyBNYXA8c3RyaW5nLCBIaXN0b3J5SXRlbVJlZnNGaWx0ZXI+KCk7XG5cdH1cblxuXHRwcml2YXRlIF9zYXZlSGlzdG9yeUl0ZW1zRmlsdGVyU3RhdGUoKTogdm9pZCB7XG5cdFx0Y29uc3QgZmlsdGVyID0gQXJyYXkuZnJvbSh0aGlzLl9yZXBvc2l0b3J5RmlsdGVyU3RhdGUuZW50cmllcygpKTtcblx0XHR0aGlzLl9zdG9yYWdlU2VydmljZS5zdG9yZSgnc2NtLmdyYXBoVmlldy5yZWZlcmVuY2VzRmlsdGVyJywgSlNPTi5zdHJpbmdpZnkoZmlsdGVyKSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVwb3NpdG9yeVN0YXRlLmNsZWFyKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbnR5cGUgUmVwb3NpdG9yeVF1aWNrUGlja0l0ZW0gPSBJUXVpY2tQaWNrSXRlbSAmIHsgcmVwb3NpdG9yeTogJ2F1dG8nIHwgSVNDTVJlcG9zaXRvcnkgfTtcblxuY2xhc3MgUmVwb3NpdG9yeVBpY2tlciB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2F1dG9RdWlja1BpY2tJdGVtOiBSZXBvc2l0b3J5UXVpY2tQaWNrSXRlbSA9IHtcblx0XHRsYWJlbDogbG9jYWxpemUoJ2F1dG8nLCBcIkF1dG9cIiksXG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdhY3RpdmVSZXBvc2l0b3J5JywgXCJTaG93IHRoZSBzb3VyY2UgY29udHJvbCBncmFwaCBmb3IgdGhlIGFjdGl2ZSByZXBvc2l0b3J5XCIpLFxuXHRcdHJlcG9zaXRvcnk6ICdhdXRvJ1xuXHR9O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASVNDTVZpZXdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3NjbVZpZXdTZXJ2aWNlOiBJU0NNVmlld1NlcnZpY2Vcblx0KSB7IH1cblxuXHRhc3luYyBwaWNrUmVwb3NpdG9yeSgpOiBQcm9taXNlPFJlcG9zaXRvcnlRdWlja1BpY2tJdGVtIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgcGlja3M6IChSZXBvc2l0b3J5UXVpY2tQaWNrSXRlbSB8IElRdWlja1BpY2tTZXBhcmF0b3IpW10gPSBbXG5cdFx0XHR0aGlzLl9hdXRvUXVpY2tQaWNrSXRlbSxcblx0XHRcdHsgdHlwZTogJ3NlcGFyYXRvcicgfV07XG5cblx0XHRwaWNrcy5wdXNoKC4uLnRoaXMuX3NjbVZpZXdTZXJ2aWNlLnJlcG9zaXRvcmllcy5tYXAociA9PiAoe1xuXHRcdFx0bGFiZWw6IHIucHJvdmlkZXIubmFtZSxcblx0XHRcdGRlc2NyaXB0aW9uOiByLnByb3ZpZGVyLnJvb3RVcmk/LmZzUGF0aCxcblx0XHRcdGljb25DbGFzczogVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24ucmVwbyksXG5cdFx0XHRyZXBvc2l0b3J5OiByXG5cdFx0fSkpKTtcblxuXHRcdHJldHVybiB0aGlzLl9xdWlja0lucHV0U2VydmljZS5waWNrKHBpY2tzLCB7XG5cdFx0XHRwbGFjZUhvbGRlcjogbG9jYWxpemUoJ3NjbUdyYXBoUmVwb3NpdG9yeScsIFwiU2VsZWN0IHRoZSByZXBvc2l0b3J5IHRvIHZpZXcsIHR5cGUgdG8gZmlsdGVyIGFsbCByZXBvc2l0b3JpZXNcIilcblx0XHR9KTtcblx0fVxufVxuXG50eXBlIEhpc3RvcnlJdGVtUmVmUXVpY2tQaWNrSXRlbSA9IElRdWlja1BpY2tJdGVtICYgeyBoaXN0b3J5SXRlbVJlZjogJ2FsbCcgfCAnYXV0bycgfCBJU0NNSGlzdG9yeUl0ZW1SZWYgfTtcblxuY2xhc3MgSGlzdG9yeUl0ZW1SZWZQaWNrZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBfYWxsUXVpY2tQaWNrSXRlbTogSGlzdG9yeUl0ZW1SZWZRdWlja1BpY2tJdGVtID0ge1xuXHRcdGlkOiAnYWxsJyxcblx0XHRsYWJlbDogbG9jYWxpemUoJ2FsbCcsIFwiQWxsXCIpLFxuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnYWxsSGlzdG9yeUl0ZW1SZWZzJywgXCJBbGwgaGlzdG9yeSBpdGVtIHJlZmVyZW5jZXNcIiksXG5cdFx0aGlzdG9yeUl0ZW1SZWY6ICdhbGwnXG5cdH07XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYXV0b1F1aWNrUGlja0l0ZW06IEhpc3RvcnlJdGVtUmVmUXVpY2tQaWNrSXRlbSA9IHtcblx0XHRpZDogJ2F1dG8nLFxuXHRcdGxhYmVsOiBsb2NhbGl6ZSgnYXV0bycsIFwiQXV0b1wiKSxcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2N1cnJlbnRIaXN0b3J5SXRlbVJlZicsIFwiQ3VycmVudCBoaXN0b3J5IGl0ZW0gcmVmZXJlbmNlKHMpXCIpLFxuXHRcdGhpc3RvcnlJdGVtUmVmOiAnYXV0bydcblx0fTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9oaXN0b3J5UHJvdmlkZXI6IElTQ01IaXN0b3J5UHJvdmlkZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaGlzdG9yeUl0ZW1zRmlsdGVyOiAnYWxsJyB8ICdhdXRvJyB8IElTQ01IaXN0b3J5SXRlbVJlZltdLFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdGFzeW5jIHBpY2tIaXN0b3J5SXRlbVJlZigpOiBQcm9taXNlPEhpc3RvcnlJdGVtUmVmc0ZpbHRlciB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHF1aWNrUGljayA9IHRoaXMuX3F1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZVF1aWNrUGljazxIaXN0b3J5SXRlbVJlZlF1aWNrUGlja0l0ZW0+KHsgdXNlU2VwYXJhdG9yczogdHJ1ZSB9KTtcblx0XHR0aGlzLl9zdG9yZS5hZGQocXVpY2tQaWNrKTtcblxuXHRcdHF1aWNrUGljay5wbGFjZWhvbGRlciA9IGxvY2FsaXplKCdzY21HcmFwaEhpc3RvcnlJdGVtUmVmJywgXCJTZWxlY3Qgb25lL21vcmUgaGlzdG9yeSBpdGVtIHJlZmVyZW5jZXMgdG8gdmlldywgdHlwZSB0byBmaWx0ZXJcIik7XG5cdFx0cXVpY2tQaWNrLmNhblNlbGVjdE1hbnkgPSB0cnVlO1xuXHRcdHF1aWNrUGljay5oaWRlQ2hlY2tBbGwgPSB0cnVlO1xuXHRcdHF1aWNrUGljay5idXN5ID0gdHJ1ZTtcblx0XHRxdWlja1BpY2suc2hvdygpO1xuXG5cdFx0Y29uc3QgaXRlbXMgPSBhd2FpdCB0aGlzLl9jcmVhdGVRdWlja1BpY2tJdGVtcygpO1xuXG5cdFx0Ly8gU2V0IGluaXRpYWwgc2VsZWN0aW9uXG5cdFx0bGV0IHNlbGVjdGVkSXRlbXM6IEhpc3RvcnlJdGVtUmVmUXVpY2tQaWNrSXRlbVtdID0gW107XG5cdFx0aWYgKHRoaXMuX2hpc3RvcnlJdGVtc0ZpbHRlciA9PT0gJ2FsbCcpIHtcblx0XHRcdHNlbGVjdGVkSXRlbXMucHVzaCh0aGlzLl9hbGxRdWlja1BpY2tJdGVtKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX2hpc3RvcnlJdGVtc0ZpbHRlciA9PT0gJ2F1dG8nKSB7XG5cdFx0XHRzZWxlY3RlZEl0ZW1zLnB1c2godGhpcy5fYXV0b1F1aWNrUGlja0l0ZW0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRsZXQgaW5kZXggPSAwO1xuXHRcdFx0d2hpbGUgKGluZGV4IDwgaXRlbXMubGVuZ3RoKSB7XG5cdFx0XHRcdGlmIChpdGVtc1tpbmRleF0udHlwZSA9PT0gJ3NlcGFyYXRvcicpIHtcblx0XHRcdFx0XHRpbmRleCsrO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRoaXMuX2hpc3RvcnlJdGVtc0ZpbHRlci5zb21lKHJlZiA9PiByZWYuaWQgPT09IGl0ZW1zW2luZGV4XS5pZCkpIHtcblx0XHRcdFx0XHRjb25zdCBpdGVtID0gaXRlbXMuc3BsaWNlKGluZGV4LCAxKSBhcyBIaXN0b3J5SXRlbVJlZlF1aWNrUGlja0l0ZW1bXTtcblx0XHRcdFx0XHRzZWxlY3RlZEl0ZW1zLnB1c2goLi4uaXRlbSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aW5kZXgrKztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBJbnNlcnQgdGhlIHNlbGVjdGVkIGl0ZW1zIGFmdGVyIGBBbGxgIGFuZCBgQXV0b2Bcblx0XHRcdGl0ZW1zLnNwbGljZSgyLCAwLCB7IHR5cGU6ICdzZXBhcmF0b3InIH0sIC4uLnNlbGVjdGVkSXRlbXMpO1xuXHRcdH1cblxuXHRcdHF1aWNrUGljay5pdGVtcyA9IGl0ZW1zO1xuXHRcdHF1aWNrUGljay5zZWxlY3RlZEl0ZW1zID0gc2VsZWN0ZWRJdGVtcztcblx0XHRxdWlja1BpY2suYnVzeSA9IGZhbHNlO1xuXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlPEhpc3RvcnlJdGVtUmVmc0ZpbHRlciB8IHVuZGVmaW5lZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHR0aGlzLl9zdG9yZS5hZGQocXVpY2tQaWNrLm9uRGlkQ2hhbmdlU2VsZWN0aW9uKGl0ZW1zID0+IHtcblx0XHRcdFx0Y29uc3QgeyBhZGRlZCB9ID0gZGVsdGEoc2VsZWN0ZWRJdGVtcywgaXRlbXMsIChhLCBiKSA9PiBjb21wYXJlKGEuaWQgPz8gJycsIGIuaWQgPz8gJycpKTtcblx0XHRcdFx0aWYgKGFkZGVkLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRpZiAoYWRkZWRbMF0uaGlzdG9yeUl0ZW1SZWYgPT09ICdhbGwnIHx8IGFkZGVkWzBdLmhpc3RvcnlJdGVtUmVmID09PSAnYXV0bycpIHtcblx0XHRcdFx0XHRcdHF1aWNrUGljay5zZWxlY3RlZEl0ZW1zID0gW2FkZGVkWzBdXTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gUmVtb3ZlICdhbGwnIGFuZCAnYXV0bycgaXRlbXMgaWYgcHJlc2VudFxuXHRcdFx0XHRcdFx0cXVpY2tQaWNrLnNlbGVjdGVkSXRlbXMgPSBbLi4ucXVpY2tQaWNrLnNlbGVjdGVkSXRlbXNcblx0XHRcdFx0XHRcdFx0LmZpbHRlcihpID0+IGkuaGlzdG9yeUl0ZW1SZWYgIT09ICdhbGwnICYmIGkuaGlzdG9yeUl0ZW1SZWYgIT09ICdhdXRvJyldO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHNlbGVjdGVkSXRlbXMgPSBbLi4ucXVpY2tQaWNrLnNlbGVjdGVkSXRlbXNdO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHR0aGlzLl9zdG9yZS5hZGQocXVpY2tQaWNrLm9uRGlkQWNjZXB0KCgpID0+IHtcblx0XHRcdFx0aWYgKHNlbGVjdGVkSXRlbXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0cmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHNlbGVjdGVkSXRlbXMubGVuZ3RoID09PSAxICYmIHNlbGVjdGVkSXRlbXNbMF0uaGlzdG9yeUl0ZW1SZWYgPT09ICdhbGwnKSB7XG5cdFx0XHRcdFx0cmVzb2x2ZSgnYWxsJyk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoc2VsZWN0ZWRJdGVtcy5sZW5ndGggPT09IDEgJiYgc2VsZWN0ZWRJdGVtc1swXS5oaXN0b3J5SXRlbVJlZiA9PT0gJ2F1dG8nKSB7XG5cdFx0XHRcdFx0cmVzb2x2ZSgnYXV0bycpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc29sdmUoc2VsZWN0ZWRJdGVtcy5tYXAoaXRlbSA9PiAoaXRlbS5oaXN0b3J5SXRlbVJlZiBhcyBJU0NNSGlzdG9yeUl0ZW1SZWYpLmlkKSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRxdWlja1BpY2suaGlkZSgpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHR0aGlzLl9zdG9yZS5hZGQocXVpY2tQaWNrLm9uRGlkSGlkZSgoKSA9PiB7XG5cdFx0XHRcdHJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdFx0dGhpcy5kaXNwb3NlKCk7XG5cdFx0XHR9KSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9jcmVhdGVRdWlja1BpY2tJdGVtcygpOiBQcm9taXNlPChIaXN0b3J5SXRlbVJlZlF1aWNrUGlja0l0ZW0gfCBJUXVpY2tQaWNrU2VwYXJhdG9yKVtdPiB7XG5cdFx0Y29uc3QgcGlja3M6IChIaXN0b3J5SXRlbVJlZlF1aWNrUGlja0l0ZW0gfCBJUXVpY2tQaWNrU2VwYXJhdG9yKVtdID0gW1xuXHRcdFx0dGhpcy5fYWxsUXVpY2tQaWNrSXRlbSwgdGhpcy5fYXV0b1F1aWNrUGlja0l0ZW1cblx0XHRdO1xuXG5cdFx0Y29uc3QgaGlzdG9yeUl0ZW1SZWZzID0gYXdhaXQgdGhpcy5faGlzdG9yeVByb3ZpZGVyLnByb3ZpZGVIaXN0b3J5SXRlbVJlZnMoKSA/PyBbXTtcblx0XHRjb25zdCBoaXN0b3J5SXRlbVJlZnNCeUNhdGVnb3J5ID0gZ3JvdXBCeShoaXN0b3J5SXRlbVJlZnMsIChhLCBiKSA9PiBjb21wYXJlKGEuY2F0ZWdvcnkgPz8gJycsIGIuY2F0ZWdvcnkgPz8gJycpKTtcblxuXHRcdGZvciAoY29uc3QgcmVmcyBvZiBoaXN0b3J5SXRlbVJlZnNCeUNhdGVnb3J5KSB7XG5cdFx0XHRpZiAocmVmcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdHBpY2tzLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IHJlZnNbMF0uY2F0ZWdvcnkgfSk7XG5cblx0XHRcdHBpY2tzLnB1c2goLi4ucmVmcy5tYXAocmVmID0+IHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRpZDogcmVmLmlkLFxuXHRcdFx0XHRcdGxhYmVsOiByZWYubmFtZSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogcmVmLmRlc2NyaXB0aW9uLFxuXHRcdFx0XHRcdGljb25DbGFzczogVGhlbWVJY29uLmlzVGhlbWVJY29uKHJlZi5pY29uKSA/XG5cdFx0XHRcdFx0XHRUaGVtZUljb24uYXNDbGFzc05hbWUocmVmLmljb24pIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdGhpc3RvcnlJdGVtUmVmOiByZWZcblx0XHRcdFx0fTtcblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcGlja3M7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNDTUhpc3RvcnlWaWV3UGFuZSBleHRlbmRzIFZpZXdQYW5lIHtcblxuXHRwcml2YXRlIF90cmVlQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgX3RyZWUhOiBXb3JrYmVuY2hBc3luY0RhdGFUcmVlPFNDTUhpc3RvcnlWaWV3TW9kZWwsIFRyZWVFbGVtZW50LCBGdXp6eVNjb3JlPjtcblx0cHJpdmF0ZSBfdHJlZVZpZXdNb2RlbCE6IFNDTUhpc3RvcnlWaWV3TW9kZWw7XG5cdHByaXZhdGUgX3RyZWVEYXRhU291cmNlITogU0NNSGlzdG9yeVRyZWVEYXRhU291cmNlO1xuXHRwcml2YXRlIF90cmVlSWRlbnRpdHlQcm92aWRlciE6IFNDTUhpc3RvcnlUcmVlSWRlbnRpdHlQcm92aWRlcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9yZXBvc2l0b3J5SXNMb2FkaW5nTW9yZSA9IG9ic2VydmFibGVWYWx1ZSh0aGlzLCBmYWxzZSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3JlcG9zaXRvcnlPdXRkYXRlZCA9IG9ic2VydmFibGVWYWx1ZSh0aGlzLCBmYWxzZSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYWN0aW9uUnVubmVyOiBJQWN0aW9uUnVubmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF92aXNpYmlsaXR5RGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdHJlZU9wZXJhdGlvblNlcXVlbmNlciA9IG5ldyBTZXF1ZW5jZXIoKTtcblx0cHJpdmF0ZSByZWFkb25seSBfdHJlZUxvYWRNb3JlU2VxdWVuY2VyID0gbmV3IFNlcXVlbmNlcigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF91cGRhdGVDaGlsZHJlblRocm90dGxlciA9IG5ldyBUaHJvdHRsZXIoKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zY21Qcm92aWRlckN0eDogSUNvbnRleHRLZXk8c3RyaW5nIHwgdW5kZWZpbmVkPjtcblx0cHJpdmF0ZSByZWFkb25seSBfc2NtQ3VycmVudEhpc3RvcnlJdGVtUmVmSGFzUmVtb3RlOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfc2NtQ3VycmVudEhpc3RvcnlJdGVtUmVmSW5GaWx0ZXI6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRNZW51RGlzcG9zYWJsZXMgPSBuZXcgTXV0YWJsZURpc3Bvc2FibGU8RGlzcG9zYWJsZVN0b3JlPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG9wdGlvbnM6IElWaWV3UGFuZU9wdGlvbnMsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX21lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElQcm9ncmVzc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcHJvZ3Jlc3NTZXJ2aWNlOiBJUHJvZ3Jlc3NTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVZpZXdEZXNjcmlwdG9yU2VydmljZSB2aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHR0aXRsZU1lbnVJZDogTWVudUlkLlNDTUhpc3RvcnlUaXRsZSxcblx0XHRcdHNob3dBY3Rpb25zOiBWaWV3UGFuZVNob3dBY3Rpb25zLldoZW5FeHBhbmRlZFxuXHRcdH0sIGtleWJpbmRpbmdTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgb3BlbmVyU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBob3ZlclNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fc2NtUHJvdmlkZXJDdHggPSBDb250ZXh0S2V5cy5TQ01Qcm92aWRlci5iaW5kVG8odGhpcy5zY29wZWRDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fc2NtQ3VycmVudEhpc3RvcnlJdGVtUmVmSGFzUmVtb3RlID0gQ29udGV4dEtleXMuU0NNQ3VycmVudEhpc3RvcnlJdGVtUmVmSGFzUmVtb3RlLmJpbmRUbyh0aGlzLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9zY21DdXJyZW50SGlzdG9yeUl0ZW1SZWZJbkZpbHRlciA9IENvbnRleHRLZXlzLlNDTUN1cnJlbnRIaXN0b3J5SXRlbVJlZkluRmlsdGVyLmJpbmRUbyh0aGlzLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdHRoaXMuX2FjdGlvblJ1bm5lciA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU0NNSGlzdG9yeVZpZXdQYW5lQWN0aW9uUnVubmVyKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9hY3Rpb25SdW5uZXIpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdXBkYXRlQ2hpbGRyZW5UaHJvdHRsZXIpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlbmRlckhlYWRlclRpdGxlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJIZWFkZXJUaXRsZShjb250YWluZXIsIHRoaXMudGl0bGUpO1xuXG5cdFx0Y29uc3QgZWxlbWVudCA9IGgoJ2Rpdi5zY20tZ3JhcGgtdmlldy1iYWRnZS1jb250YWluZXInLCBbXG5cdFx0XHRoKCdkaXYuc2NtLWdyYXBoLXZpZXctYmFkZ2UubW9uYWNvLWNvdW50LWJhZGdlLmxvbmdAYmFkZ2UnKVxuXHRcdF0pO1xuXG5cdFx0ZWxlbWVudC5iYWRnZS50ZXh0Q29udGVudCA9ICdPdXRkYXRlZCc7XG5cdFx0Y29udGFpbmVyLmFwcGVuZENoaWxkKGVsZW1lbnQucm9vdCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgZWxlbWVudC5yb290LCB7XG5cdFx0XHRtYXJrZG93bjoge1xuXHRcdFx0XHR2YWx1ZTogbG9jYWxpemUoJ3NjbUdyYXBoVmlld091dGRhdGVkJywgXCJQbGVhc2UgcmVmcmVzaCB0aGUgZ3JhcGggdXNpbmcgdGhlIHJlZnJlc2ggYWN0aW9uICgkKHJlZnJlc2gpKS5cIiksXG5cdFx0XHRcdHN1cHBvcnRUaGVtZUljb25zOiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0bWFya2Rvd25Ob3RTdXBwb3J0ZWRGYWxsYmFjazogdW5kZWZpbmVkXG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0Y29uc3Qgb3V0ZGF0ZWQgPSB0aGlzLl9yZXBvc2l0b3J5T3V0ZGF0ZWQucmVhZChyZWFkZXIpO1xuXHRcdFx0ZWxlbWVudC5yb290LnN0eWxlLmRpc3BsYXkgPSBvdXRkYXRlZCA/ICcnIDogJ25vbmUnO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSByZW5kZXJCb2R5KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJCb2R5KGNvbnRhaW5lcik7XG5cblx0XHR0aGlzLl90cmVlQ29udGFpbmVyID0gYXBwZW5kKGNvbnRhaW5lciwgJCgnLnNjbS12aWV3LnNjbS1oaXN0b3J5LXZpZXcnKSk7XG5cdFx0dGhpcy5fdHJlZUNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdmaWxlLWljb24tdGhlbWFibGUtdHJlZScpO1xuXG5cdFx0dGhpcy5fY3JlYXRlVHJlZSh0aGlzLl90cmVlQ29udGFpbmVyKTtcblxuXHRcdHRoaXMub25EaWRDaGFuZ2VCb2R5VmlzaWJpbGl0eShhc3luYyB2aXNpYmxlID0+IHtcblx0XHRcdGlmICghdmlzaWJsZSkge1xuXHRcdFx0XHR0aGlzLl92aXNpYmlsaXR5RGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBDcmVhdGUgdmlldyBtb2RlbFxuXHRcdFx0dGhpcy5fdHJlZVZpZXdNb2RlbCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU0NNSGlzdG9yeVZpZXdNb2RlbCk7XG5cdFx0XHR0aGlzLl92aXNpYmlsaXR5RGlzcG9zYWJsZXMuYWRkKHRoaXMuX3RyZWVWaWV3TW9kZWwpO1xuXG5cdFx0XHQvLyBXYWl0IGZvciBmaXJzdCByZXBvc2l0b3J5IHRvIGJlIGluaXRpYWxpemVkXG5cdFx0XHRjb25zdCBmaXJzdFJlcG9zaXRvcnlJbml0aWFsaXplZCA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHtcblx0XHRcdFx0Y29uc3QgcmVwb3NpdG9yeSA9IHRoaXMuX3RyZWVWaWV3TW9kZWwucmVwb3NpdG9yeS5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdGNvbnN0IGhpc3RvcnlQcm92aWRlciA9IHJlcG9zaXRvcnk/LnByb3ZpZGVyLmhpc3RvcnlQcm92aWRlci5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdGNvbnN0IGhpc3RvcnlJdGVtUmVmID0gaGlzdG9yeVByb3ZpZGVyPy5oaXN0b3J5SXRlbVJlZi5yZWFkKHJlYWRlcik7XG5cblx0XHRcdFx0cmV0dXJuIGhpc3RvcnlJdGVtUmVmICE9PSB1bmRlZmluZWQgPyB0cnVlIDogdW5kZWZpbmVkO1xuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCB3YWl0Rm9yU3RhdGUoZmlyc3RSZXBvc2l0b3J5SW5pdGlhbGl6ZWQpO1xuXG5cdFx0XHQvLyBJbml0aWFsIHJlbmRlcmluZ1xuXHRcdFx0YXdhaXQgdGhpcy5fcHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyh7IGxvY2F0aW9uOiB0aGlzLmlkIH0sIGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5fdHJlZU9wZXJhdGlvblNlcXVlbmNlci5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5fdHJlZS5zZXRJbnB1dCh0aGlzLl90cmVlVmlld01vZGVsKTtcblx0XHRcdFx0XHR0aGlzLl90cmVlLnNjcm9sbFRvcCA9IDA7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRoaXMuX3Zpc2liaWxpdHlEaXNwb3NhYmxlcy5hZGQoYXV0b3J1bihyZWFkZXIgPT4ge1xuXHRcdFx0XHR0aGlzLl90cmVlVmlld01vZGVsLmlzVmlld01vZGVsRW1wdHkucmVhZChyZWFkZXIpO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVZpZXdXZWxjb21lU3RhdGUuZmlyZSgpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHQvLyBSZXBvc2l0b3J5IGNoYW5nZVxuXHRcdFx0bGV0IGlzRmlyc3RSdW4gPSB0cnVlO1xuXHRcdFx0dGhpcy5fdmlzaWJpbGl0eURpc3Bvc2FibGVzLmFkZChhdXRvcnVuV2l0aFN0b3JlKChyZWFkZXIsIHN0b3JlKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlcG9zaXRvcnkgPSB0aGlzLl90cmVlVmlld01vZGVsLnJlcG9zaXRvcnkucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRjb25zdCBoaXN0b3J5UHJvdmlkZXIgPSByZXBvc2l0b3J5Py5wcm92aWRlci5oaXN0b3J5UHJvdmlkZXIucmVhZChyZWFkZXIpO1xuXHRcdFx0XHRpZiAoIXJlcG9zaXRvcnkgfHwgIWhpc3RvcnlQcm92aWRlcikge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEhpc3RvcnlJdGVtSWQgY2hhbmdlZCAoY2hlY2tvdXQpXG5cdFx0XHRcdGNvbnN0IGhpc3RvcnlJdGVtUmVmSWQgPSBkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIGhpc3RvcnlQcm92aWRlci5oaXN0b3J5SXRlbVJlZi5yZWFkKHJlYWRlcik/LmlkO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0c3RvcmUuYWRkKHJ1bk9uQ2hhbmdlKGhpc3RvcnlJdGVtUmVmSWQsIGFzeW5jIGhpc3RvcnlJdGVtUmVmSWRWYWx1ZSA9PiB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5yZWZyZXNoKCk7XG5cblx0XHRcdFx0XHQvLyBVcGRhdGUgY29udGV4dCBrZXkgKG5lZWRzIHRvIGJlIGRvbmUgYWZ0ZXIgdGhlIHJlZnJlc2ggY2FsbClcblx0XHRcdFx0XHR0aGlzLl9zY21DdXJyZW50SGlzdG9yeUl0ZW1SZWZJbkZpbHRlci5zZXQodGhpcy5faXNDdXJyZW50SGlzdG9yeUl0ZW1JbkZpbHRlcihoaXN0b3J5SXRlbVJlZklkVmFsdWUpKTtcblx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdC8vIEhpc3RvcnlJdGVtUmVmcyBjaGFuZ2VkXG5cdFx0XHRcdHN0b3JlLmFkZChydW5PbkNoYW5nZShoaXN0b3J5UHJvdmlkZXIuaGlzdG9yeUl0ZW1SZWZDaGFuZ2VzLCBjaGFuZ2VzID0+IHtcblx0XHRcdFx0XHRpZiAoY2hhbmdlcy5zaWxlbnQpIHtcblx0XHRcdFx0XHRcdC8vIFRoZSBoaXN0b3J5IGl0ZW0gcmVmZXJlbmNlIGNoYW5nZXMgb2NjdXJyZWQgaW4gdGhlIGJhY2tncm91bmQgKGV4OiBBdXRvIEZldGNoKVxuXHRcdFx0XHRcdFx0Ly8gSWYgdHJlZSBpcyBzY3JvbGxlZCB0byB0aGUgdG9wLCB3ZSBjYW4gc2FmZWx5IHJlZnJlc2ggdGhlIHRyZWUsIG90aGVyd2lzZSB3ZVxuXHRcdFx0XHRcdFx0Ly8gd2lsbCBzaG93IGEgdmlzdWFsIGN1ZSB0aGF0IHRoZSB2aWV3IGlzIG91dGRhdGVkLlxuXHRcdFx0XHRcdFx0aWYgKHRoaXMuX3RyZWUuc2Nyb2xsVG9wID09PSAwKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMucmVmcmVzaCgpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8vIFNob3cgdGhlIFwiT3V0ZGF0ZWRcIiBiYWRnZSBvbiB0aGUgdmlld1xuXHRcdFx0XHRcdFx0dGhpcy5fcmVwb3NpdG9yeU91dGRhdGVkLnNldCh0cnVlLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRoaXMucmVmcmVzaCgpO1xuXHRcdFx0XHR9KSk7XG5cblx0XHRcdFx0Ly8gSGlzdG9yeUl0ZW1SZWZzIGZpbHRlciBjaGFuZ2VkXG5cdFx0XHRcdHN0b3JlLmFkZChydW5PbkNoYW5nZSh0aGlzLl90cmVlVmlld01vZGVsLm9uRGlkQ2hhbmdlSGlzdG9yeUl0ZW1zRmlsdGVyLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5yZWZyZXNoKCk7XG5cblx0XHRcdFx0XHQvLyBVcGRhdGUgY29udGV4dCBrZXkgKG5lZWRzIHRvIGJlIGRvbmUgYWZ0ZXIgdGhlIHJlZnJlc2ggY2FsbClcblx0XHRcdFx0XHR0aGlzLl9zY21DdXJyZW50SGlzdG9yeUl0ZW1SZWZJbkZpbHRlci5zZXQodGhpcy5faXNDdXJyZW50SGlzdG9yeUl0ZW1JbkZpbHRlcihoaXN0b3J5SXRlbVJlZklkLmdldCgpKSk7XG5cdFx0XHRcdH0pKTtcblxuXHRcdFx0XHQvLyBIaXN0b3J5SXRlbVJlbW90ZVJlZiBjaGFuZ2VkXG5cdFx0XHRcdHN0b3JlLmFkZChhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fc2NtQ3VycmVudEhpc3RvcnlJdGVtUmVmSGFzUmVtb3RlLnNldCghIWhpc3RvcnlQcm92aWRlci5oaXN0b3J5SXRlbVJlbW90ZVJlZi5yZWFkKHJlYWRlcikpO1xuXHRcdFx0XHR9KSk7XG5cblx0XHRcdFx0Ly8gVXBkYXRlIGNvbnRleHRcblx0XHRcdFx0dGhpcy5fc2NtUHJvdmlkZXJDdHguc2V0KHJlcG9zaXRvcnkucHJvdmlkZXIuY29udGV4dFZhbHVlKTtcblx0XHRcdFx0dGhpcy5fc2NtQ3VycmVudEhpc3RvcnlJdGVtUmVmSW5GaWx0ZXIuc2V0KHRoaXMuX2lzQ3VycmVudEhpc3RvcnlJdGVtSW5GaWx0ZXIoaGlzdG9yeUl0ZW1SZWZJZC5nZXQoKSkpO1xuXG5cdFx0XHRcdC8vIFdlIHNraXAgcmVmcmVzaGluZyB0aGUgZ3JhcGggb24gdGhlIGZpcnN0IGV4ZWN1dGlvbiBvZiB0aGUgYXV0b3J1blxuXHRcdFx0XHQvLyBzaW5jZSB0aGUgZ3JhcGggZm9yIHRoZSBmaXJzdCByZXBvc2l0b3J5IGlzIHJlbmRlcmVkIHdoZW4gdGhlIHRyZWVcblx0XHRcdFx0Ly8gaW5wdXQgaXMgc2V0LlxuXHRcdFx0XHRpZiAoIWlzRmlyc3RSdW4pIHtcblx0XHRcdFx0XHR0aGlzLnJlZnJlc2goKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpc0ZpcnN0UnVuID0gZmFsc2U7XG5cdFx0XHR9KSk7XG5cdFx0fSwgdGhpcywgdGhpcy5fc3RvcmUpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGxheW91dEJvZHkoaGVpZ2h0OiBudW1iZXIsIHdpZHRoOiBudW1iZXIpOiB2b2lkIHtcblx0XHRzdXBlci5sYXlvdXRCb2R5KGhlaWdodCwgd2lkdGgpO1xuXHRcdHRoaXMuX3RyZWUubGF5b3V0KGhlaWdodCwgd2lkdGgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0QWN0aW9uUnVubmVyKCk6IElBY3Rpb25SdW5uZXIgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9hY3Rpb25SdW5uZXI7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRBY3Rpb25zQ29udGV4dCgpOiBJU0NNUHJvdmlkZXIgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl90cmVlVmlld01vZGVsPy5yZXBvc2l0b3J5LmdldCgpPy5wcm92aWRlcjtcblx0fVxuXG5cdG92ZXJyaWRlIGNyZWF0ZUFjdGlvblZpZXdJdGVtKGFjdGlvbjogSUFjdGlvbiwgb3B0aW9ucz86IElEcm9wZG93bk1lbnVBY3Rpb25WaWV3SXRlbU9wdGlvbnMpOiBJQWN0aW9uVmlld0l0ZW0gfCB1bmRlZmluZWQge1xuXHRcdGlmIChhY3Rpb24uaWQgPT09IFBJQ0tfUkVQT1NJVE9SWV9BQ1RJT05fSUQpIHtcblx0XHRcdGNvbnN0IHJlcG9zaXRvcnkgPSB0aGlzLl90cmVlVmlld01vZGVsPy5yZXBvc2l0b3J5LmdldCgpO1xuXHRcdFx0aWYgKHJlcG9zaXRvcnkpIHtcblx0XHRcdFx0cmV0dXJuIG5ldyBTQ01SZXBvc2l0b3J5QWN0aW9uVmlld0l0ZW0ocmVwb3NpdG9yeSwgYWN0aW9uLCBvcHRpb25zKTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKGFjdGlvbi5pZCA9PT0gUElDS19ISVNUT1JZX0lURU1fUkVGU19BQ1RJT05fSUQpIHtcblx0XHRcdGNvbnN0IHJlcG9zaXRvcnkgPSB0aGlzLl90cmVlVmlld01vZGVsPy5yZXBvc2l0b3J5LmdldCgpO1xuXHRcdFx0Y29uc3QgaGlzdG9yeUl0ZW1zRmlsdGVyID0gdGhpcy5fdHJlZVZpZXdNb2RlbD8uZ2V0SGlzdG9yeUl0ZW1zRmlsdGVyKCk7XG5cdFx0XHRpZiAocmVwb3NpdG9yeSAmJiBoaXN0b3J5SXRlbXNGaWx0ZXIpIHtcblx0XHRcdFx0cmV0dXJuIG5ldyBTQ01IaXN0b3J5SXRlbVJlZnNBY3Rpb25WaWV3SXRlbShyZXBvc2l0b3J5LCBoaXN0b3J5SXRlbXNGaWx0ZXIsIGFjdGlvbiwgb3B0aW9ucyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN1cGVyLmNyZWF0ZUFjdGlvblZpZXdJdGVtKGFjdGlvbiwgb3B0aW9ucyk7XG5cdH1cblxuXHRvdmVycmlkZSBmb2N1cygpOiB2b2lkIHtcblx0XHRzdXBlci5mb2N1cygpO1xuXG5cdFx0Y29uc3QgZmFrZUtleWJvYXJkRXZlbnQgPSBuZXcgS2V5Ym9hcmRFdmVudCgna2V5ZG93bicpO1xuXHRcdHRoaXMuX3RyZWUuZm9jdXNGaXJzdChmYWtlS2V5Ym9hcmRFdmVudCk7XG5cdFx0dGhpcy5fdHJlZS5kb21Gb2N1cygpO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2hvdWxkU2hvd1dlbGNvbWUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3RyZWVWaWV3TW9kZWw/LmlzVmlld01vZGVsRW1wdHkuZ2V0KCkgPT09IHRydWU7XG5cdH1cblxuXHRhc3luYyByZWZyZXNoKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3RyZWVWaWV3TW9kZWwuY2xlYXJSZXBvc2l0b3J5U3RhdGUoKTtcblx0XHRhd2FpdCB0aGlzLl91cGRhdGVDaGlsZHJlbigpO1xuXG5cdFx0dGhpcy51cGRhdGVBY3Rpb25zKCk7XG5cdFx0dGhpcy5fcmVwb3NpdG9yeU91dGRhdGVkLnNldChmYWxzZSwgdW5kZWZpbmVkKTtcblx0XHR0aGlzLl90cmVlLnNjcm9sbFRvcCA9IDA7XG5cdH1cblxuXHRhc3luYyBwaWNrUmVwb3NpdG9yeSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBwaWNrZXIgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZXBvc2l0b3J5UGlja2VyKTtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBwaWNrZXIucGlja1JlcG9zaXRvcnkoKTtcblxuXHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdHRoaXMuX3RyZWVWaWV3TW9kZWwuc2V0UmVwb3NpdG9yeShyZXN1bHQucmVwb3NpdG9yeSk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcGlja0hpc3RvcnlJdGVtUmVmKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHJlcG9zaXRvcnkgPSB0aGlzLl90cmVlVmlld01vZGVsLnJlcG9zaXRvcnkuZ2V0KCk7XG5cdFx0Y29uc3QgaGlzdG9yeVByb3ZpZGVyID0gcmVwb3NpdG9yeT8ucHJvdmlkZXIuaGlzdG9yeVByb3ZpZGVyLmdldCgpO1xuXHRcdGNvbnN0IGhpc3RvcnlJdGVtc0ZpbHRlciA9IHRoaXMuX3RyZWVWaWV3TW9kZWwuZ2V0SGlzdG9yeUl0ZW1zRmlsdGVyKCk7XG5cblx0XHRpZiAoIWhpc3RvcnlQcm92aWRlciB8fCAhaGlzdG9yeUl0ZW1zRmlsdGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGlja2VyID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSGlzdG9yeUl0ZW1SZWZQaWNrZXIsIGhpc3RvcnlQcm92aWRlciwgaGlzdG9yeUl0ZW1zRmlsdGVyKTtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBwaWNrZXIucGlja0hpc3RvcnlJdGVtUmVmKCk7XG5cblx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHR0aGlzLl90cmVlVmlld01vZGVsLnNldEhpc3RvcnlJdGVtc0ZpbHRlcihyZXN1bHQpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHJldmVhbEN1cnJlbnRIaXN0b3J5SXRlbSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCByZXBvc2l0b3J5ID0gdGhpcy5fdHJlZVZpZXdNb2RlbC5yZXBvc2l0b3J5LmdldCgpO1xuXHRcdGNvbnN0IGhpc3RvcnlQcm92aWRlciA9IHJlcG9zaXRvcnk/LnByb3ZpZGVyLmhpc3RvcnlQcm92aWRlci5nZXQoKTtcblx0XHRjb25zdCBoaXN0b3J5SXRlbVJlZiA9IGhpc3RvcnlQcm92aWRlcj8uaGlzdG9yeUl0ZW1SZWYuZ2V0KCk7XG5cdFx0aWYgKCFyZXBvc2l0b3J5IHx8ICFoaXN0b3J5SXRlbVJlZj8uaWQgfHwgIWhpc3RvcnlJdGVtUmVmPy5yZXZpc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5faXNDdXJyZW50SGlzdG9yeUl0ZW1JbkZpbHRlcihoaXN0b3J5SXRlbVJlZi5pZCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCByZXZlYWxUcmVlTm9kZSA9ICgpOiBib29sZWFuID0+IHtcblx0XHRcdGNvbnN0IGhpc3RvcnlJdGVtVHJlZUVsZW1lbnQgPSB0aGlzLl90cmVlVmlld01vZGVsLmdldEN1cnJlbnRIaXN0b3J5SXRlbVRyZWVFbGVtZW50KCk7XG5cblx0XHRcdGlmIChoaXN0b3J5SXRlbVRyZWVFbGVtZW50ICYmIHRoaXMuX3RyZWUuaGFzTm9kZShoaXN0b3J5SXRlbVRyZWVFbGVtZW50KSkge1xuXHRcdFx0XHR0aGlzLl90cmVlLnJldmVhbChoaXN0b3J5SXRlbVRyZWVFbGVtZW50LCAwLjUpO1xuXG5cdFx0XHRcdHRoaXMuX3RyZWUuc2V0U2VsZWN0aW9uKFtoaXN0b3J5SXRlbVRyZWVFbGVtZW50XSk7XG5cdFx0XHRcdHRoaXMuX3RyZWUuc2V0Rm9jdXMoW2hpc3RvcnlJdGVtVHJlZUVsZW1lbnRdKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9O1xuXG5cdFx0aWYgKHJldmVhbFRyZWVOb2RlKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBGZXRjaCBjdXJyZW50IGhpc3RvcnkgaXRlbVxuXHRcdGF3YWl0IHRoaXMuX2xvYWRNb3JlKGhpc3RvcnlJdGVtUmVmLnJldmlzaW9uKTtcblxuXHRcdC8vIFJldmVhbCBub2RlXG5cdFx0cmV2ZWFsVHJlZU5vZGUoKTtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZVRyZWUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuX3RyZWVJZGVudGl0eVByb3ZpZGVyID0gbmV3IFNDTUhpc3RvcnlUcmVlSWRlbnRpdHlQcm92aWRlcigpO1xuXG5cdFx0Y29uc3QgaGlzdG9yeUl0ZW1Ib3ZlckRlbGVnYXRlID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShIaXN0b3J5SXRlbUhvdmVyRGVsZWdhdGUsIHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdMb2NhdGlvbkJ5SWQodGhpcy5pZCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGhpc3RvcnlJdGVtSG92ZXJEZWxlZ2F0ZSk7XG5cblx0XHR0aGlzLl90cmVlRGF0YVNvdXJjZSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU0NNSGlzdG9yeVRyZWVEYXRhU291cmNlKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90cmVlRGF0YVNvdXJjZSk7XG5cblx0XHR0aGlzLl90cmVlID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFdvcmtiZW5jaEFzeW5jRGF0YVRyZWUsXG5cdFx0XHQnU0NNIEhpc3RvcnkgVHJlZScsXG5cdFx0XHRjb250YWluZXIsXG5cdFx0XHRuZXcgTGlzdERlbGVnYXRlKCksXG5cdFx0XHRbXG5cdFx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSGlzdG9yeUl0ZW1SZW5kZXJlciwgaGlzdG9yeUl0ZW1Ib3ZlckRlbGVnYXRlKSxcblx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFx0XHRIaXN0b3J5SXRlbUxvYWRNb3JlUmVuZGVyZXIsXG5cdFx0XHRcdFx0dGhpcy5fcmVwb3NpdG9yeUlzTG9hZGluZ01vcmUsXG5cdFx0XHRcdFx0KCkgPT4gdGhpcy5fbG9hZE1vcmUoKSksXG5cdFx0XHRdLFxuXHRcdFx0dGhpcy5fdHJlZURhdGFTb3VyY2UsXG5cdFx0XHR7XG5cdFx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjogbmV3IFNDTUhpc3RvcnlUcmVlQWNjZXNzaWJpbGl0eVByb3ZpZGVyKCksXG5cdFx0XHRcdGlkZW50aXR5UHJvdmlkZXI6IHRoaXMuX3RyZWVJZGVudGl0eVByb3ZpZGVyLFxuXHRcdFx0XHRjb2xsYXBzZUJ5RGVmYXVsdDogKGU6IHVua25vd24pID0+IGZhbHNlLFxuXHRcdFx0XHRrZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyOiBuZXcgU0NNSGlzdG9yeVRyZWVLZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyKCksXG5cdFx0XHRcdGhvcml6b250YWxTY3JvbGxpbmc6IGZhbHNlLFxuXHRcdFx0XHRtdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ6IGZhbHNlLFxuXHRcdFx0fVxuXHRcdCkgYXMgV29ya2JlbmNoQXN5bmNEYXRhVHJlZTxTQ01IaXN0b3J5Vmlld01vZGVsLCBUcmVlRWxlbWVudCwgRnV6enlTY29yZT47XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdHJlZSk7XG5cblx0XHR0aGlzLl90cmVlLm9uRGlkT3Blbih0aGlzLl9vbkRpZE9wZW4sIHRoaXMsIHRoaXMuX3N0b3JlKTtcblx0XHR0aGlzLl90cmVlLm9uQ29udGV4dE1lbnUodGhpcy5fb25Db250ZXh0TWVudSwgdGhpcywgdGhpcy5fc3RvcmUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXNDdXJyZW50SGlzdG9yeUl0ZW1JbkZpbHRlcihoaXN0b3J5SXRlbVJlZklkOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0XHRpZiAoIWhpc3RvcnlJdGVtUmVmSWQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBoaXN0b3J5SXRlbUZpbHRlciA9IHRoaXMuX3RyZWVWaWV3TW9kZWwuZ2V0SGlzdG9yeUl0ZW1zRmlsdGVyKCk7XG5cdFx0aWYgKGhpc3RvcnlJdGVtRmlsdGVyID09PSAnYWxsJyB8fCBoaXN0b3J5SXRlbUZpbHRlciA9PT0gJ2F1dG8nKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gQXJyYXkuaXNBcnJheShoaXN0b3J5SXRlbUZpbHRlcikgJiYgISFoaXN0b3J5SXRlbUZpbHRlci5maW5kKHJlZiA9PiByZWYuaWQgPT09IGhpc3RvcnlJdGVtUmVmSWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfb25EaWRPcGVuKGU6IElPcGVuRXZlbnQ8VHJlZUVsZW1lbnQgfCB1bmRlZmluZWQ+KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCFlLmVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9IGVsc2UgaWYgKGlzU0NNSGlzdG9yeUl0ZW1WaWV3TW9kZWxUcmVlRWxlbWVudChlLmVsZW1lbnQpKSB7XG5cdFx0XHRjb25zdCBoaXN0b3J5SXRlbSA9IGUuZWxlbWVudC5oaXN0b3J5SXRlbVZpZXdNb2RlbC5oaXN0b3J5SXRlbTtcblx0XHRcdGNvbnN0IGhpc3RvcnlJdGVtUGFyZW50SWQgPSBoaXN0b3J5SXRlbS5wYXJlbnRJZHMubGVuZ3RoID4gMCA/IGhpc3RvcnlJdGVtLnBhcmVudElkc1swXSA6IHVuZGVmaW5lZDtcblxuXHRcdFx0Y29uc3QgaGlzdG9yeVByb3ZpZGVyID0gZS5lbGVtZW50LnJlcG9zaXRvcnkucHJvdmlkZXIuaGlzdG9yeVByb3ZpZGVyLmdldCgpO1xuXHRcdFx0Y29uc3QgaGlzdG9yeUl0ZW1DaGFuZ2VzID0gYXdhaXQgaGlzdG9yeVByb3ZpZGVyPy5wcm92aWRlSGlzdG9yeUl0ZW1DaGFuZ2VzKGhpc3RvcnlJdGVtLmlkLCBoaXN0b3J5SXRlbVBhcmVudElkKTtcblx0XHRcdGlmIChoaXN0b3J5SXRlbUNoYW5nZXMpIHtcblx0XHRcdFx0Y29uc3QgdGl0bGUgPSBnZXRIaXN0b3J5SXRlbUVkaXRvclRpdGxlKGhpc3RvcnlJdGVtKTtcblx0XHRcdFx0Y29uc3Qgcm9vdFVyaSA9IGUuZWxlbWVudC5yZXBvc2l0b3J5LnByb3ZpZGVyLnJvb3RVcmk7XG5cdFx0XHRcdGNvbnN0IHBhdGggPSByb290VXJpID8gcm9vdFVyaS5wYXRoIDogZS5lbGVtZW50LnJlcG9zaXRvcnkucHJvdmlkZXIubGFiZWw7XG5cdFx0XHRcdGNvbnN0IG11bHRpRGlmZlNvdXJjZVVyaSA9IFVSSS5mcm9tKHsgc2NoZW1lOiAnc2NtLWhpc3RvcnktaXRlbScsIHBhdGg6IGAke3BhdGh9LyR7aGlzdG9yeUl0ZW1QYXJlbnRJZH0uLiR7aGlzdG9yeUl0ZW0uaWR9YCB9LCB0cnVlKTtcblxuXHRcdFx0XHRhd2FpdCB0aGlzLl9jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnX3dvcmtiZW5jaC5vcGVuTXVsdGlEaWZmRWRpdG9yJywgeyB0aXRsZSwgbXVsdGlEaWZmU291cmNlVXJpLCByZXNvdXJjZXM6IGhpc3RvcnlJdGVtQ2hhbmdlcyB9KTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKGlzU0NNSGlzdG9yeUl0ZW1Mb2FkTW9yZVRyZWVFbGVtZW50KGUuZWxlbWVudCkpIHtcblx0XHRcdGNvbnN0IHBhZ2VPblNjcm9sbCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ3NjbS5ncmFwaC5wYWdlT25TY3JvbGwnKSA9PT0gdHJ1ZTtcblx0XHRcdGlmICghcGFnZU9uU2Nyb2xsKSB7XG5cdFx0XHRcdHRoaXMuX2xvYWRNb3JlKCk7XG5cdFx0XHRcdHRoaXMuX3RyZWUuc2V0U2VsZWN0aW9uKFtdKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9vbkNvbnRleHRNZW51KGU6IElUcmVlQ29udGV4dE1lbnVFdmVudDxUcmVlRWxlbWVudCB8IG51bGw+KTogdm9pZCB7XG5cdFx0Y29uc3QgZWxlbWVudCA9IGUuZWxlbWVudDtcblxuXHRcdGlmICghZWxlbWVudCB8fCAhaXNTQ01IaXN0b3J5SXRlbVZpZXdNb2RlbFRyZWVFbGVtZW50KGVsZW1lbnQpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fY29udGV4dE1lbnVEaXNwb3NhYmxlcy52YWx1ZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdGNvbnN0IGhpc3RvcnlJdGVtUmVmTWVudUl0ZW1zID0gTWVudVJlZ2lzdHJ5LmdldE1lbnVJdGVtcyhNZW51SWQuU0NNSGlzdG9yeUl0ZW1SZWZDb250ZXh0KS5maWx0ZXIoaXRlbSA9PiBpc0lNZW51SXRlbShpdGVtKSk7XG5cblx0XHQvLyBJZiB0aGVyZSBhcmUgYW55IGhpc3RvcnkgaXRlbSByZWZlcmVuY2VzIHdlIGhhdmUgdG8gYWRkIGEgc3VibWVudSBpdGVtIGZvciBlYWNoIG9yaWduYWwgYWN0aW9uLFxuXHRcdC8vIGFuZCBhIG1lbnUgaXRlbSBmb3IgZWFjaCBoaXN0b3J5IGl0ZW0gcmVmIHRoYXQgbWF0Y2hlcyB0aGUgYHdoZW5gIGNsYXVzZSBvZiB0aGUgb3JpZ2luYWwgYWN0aW9uLlxuXHRcdGlmIChoaXN0b3J5SXRlbVJlZk1lbnVJdGVtcy5sZW5ndGggPiAwICYmIGVsZW1lbnQuaGlzdG9yeUl0ZW1WaWV3TW9kZWwuaGlzdG9yeUl0ZW0ucmVmZXJlbmNlcz8ubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBoaXN0b3J5SXRlbVJlZkFjdGlvbnMgPSBuZXcgTWFwPHN0cmluZywgSVNDTUhpc3RvcnlJdGVtUmVmW10+KCk7XG5cblx0XHRcdGZvciAoY29uc3QgcmVmIG9mIGVsZW1lbnQuaGlzdG9yeUl0ZW1WaWV3TW9kZWwuaGlzdG9yeUl0ZW0ucmVmZXJlbmNlcykge1xuXHRcdFx0XHRjb25zdCBjb250ZXh0S2V5U2VydmljZSA9IHRoaXMuc2NvcGVkQ29udGV4dEtleVNlcnZpY2UuY3JlYXRlT3ZlcmxheShbXG5cdFx0XHRcdFx0WydzY21IaXN0b3J5SXRlbVJlZicsIHJlZi5pZF1cblx0XHRcdFx0XSk7XG5cblx0XHRcdFx0Y29uc3QgbWVudUFjdGlvbnMgPSB0aGlzLl9tZW51U2VydmljZS5nZXRNZW51QWN0aW9ucyhcblx0XHRcdFx0XHRNZW51SWQuU0NNSGlzdG9yeUl0ZW1SZWZDb250ZXh0LCBjb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHRcdFx0Zm9yIChjb25zdCBhY3Rpb24gb2YgbWVudUFjdGlvbnMuZmxhdE1hcChhID0+IGFbMV0pKSB7XG5cdFx0XHRcdFx0aWYgKCFoaXN0b3J5SXRlbVJlZkFjdGlvbnMuaGFzKGFjdGlvbi5pZCkpIHtcblx0XHRcdFx0XHRcdGhpc3RvcnlJdGVtUmVmQWN0aW9ucy5zZXQoYWN0aW9uLmlkLCBbXSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aGlzdG9yeUl0ZW1SZWZBY3Rpb25zLmdldChhY3Rpb24uaWQpIS5wdXNoKHJlZik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVnaXN0ZXIgc3VibWVudSwgbWVudSBpdGVtc1xuXHRcdFx0Zm9yIChjb25zdCBoaXN0b3J5SXRlbVJlZk1lbnVJdGVtIG9mIGhpc3RvcnlJdGVtUmVmTWVudUl0ZW1zKSB7XG5cdFx0XHRcdGNvbnN0IGFjdGlvbklkID0gaGlzdG9yeUl0ZW1SZWZNZW51SXRlbS5jb21tYW5kLmlkO1xuXG5cdFx0XHRcdGlmICghaGlzdG9yeUl0ZW1SZWZBY3Rpb25zLmhhcyhhY3Rpb25JZCkpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFJlZ2lzdGVyIHRoZSBzdWJtZW51IGZvciB0aGUgb3JpZ2luYWwgYWN0aW9uXG5cdFx0XHRcdHRoaXMuX2NvbnRleHRNZW51RGlzcG9zYWJsZXMudmFsdWUuYWRkKE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuU0NNSGlzdG9yeUl0ZW1Db250ZXh0LCB7XG5cdFx0XHRcdFx0dGl0bGU6IGhpc3RvcnlJdGVtUmVmTWVudUl0ZW0uY29tbWFuZC50aXRsZSxcblx0XHRcdFx0XHRzdWJtZW51OiBNZW51SWQuZm9yKGFjdGlvbklkKSxcblx0XHRcdFx0XHRncm91cDogaGlzdG9yeUl0ZW1SZWZNZW51SXRlbT8uZ3JvdXAsXG5cdFx0XHRcdFx0b3JkZXI6IGhpc3RvcnlJdGVtUmVmTWVudUl0ZW0/Lm9yZGVyXG5cdFx0XHRcdH0pKTtcblxuXHRcdFx0XHQvLyBSZWdpc3RlciB0aGUgYWN0aW9uIGZvciB0aGUgaGlzdG9yeSBpdGVtIHJlZlxuXHRcdFx0XHRmb3IgKGNvbnN0IGhpc3RvcnlJdGVtUmVmIG9mIGhpc3RvcnlJdGVtUmVmQWN0aW9ucy5nZXQoYWN0aW9uSWQpID8/IFtdKSB7XG5cdFx0XHRcdFx0dGhpcy5fY29udGV4dE1lbnVEaXNwb3NhYmxlcy52YWx1ZS5hZGQocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRcdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdFx0XHRcdGlkOiBgJHthY3Rpb25JZH0uJHtoaXN0b3J5SXRlbVJlZi5pZH1gLFxuXHRcdFx0XHRcdFx0XHRcdHRpdGxlOiBoaXN0b3J5SXRlbVJlZi5uYW1lLFxuXHRcdFx0XHRcdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRcdFx0XHRcdGlkOiBNZW51SWQuZm9yKGFjdGlvbklkKSxcblx0XHRcdFx0XHRcdFx0XHRcdGdyb3VwOiBoaXN0b3J5SXRlbVJlZi5jYXRlZ29yeVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRvdmVycmlkZSBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cdFx0XHRcdFx0XHRcdGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGFjdGlvbklkLCAuLi5hcmdzLCBoaXN0b3J5SXRlbVJlZi5pZCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGlzdG9yeUl0ZW1NZW51QWN0aW9ucyA9IHRoaXMuX21lbnVTZXJ2aWNlLmdldE1lbnVBY3Rpb25zKE1lbnVJZC5TQ01IaXN0b3J5SXRlbUNvbnRleHQsIHRoaXMuc2NvcGVkQ29udGV4dEtleVNlcnZpY2UsIHtcblx0XHRcdGFyZzogZWxlbWVudC5yZXBvc2l0b3J5LnByb3ZpZGVyLFxuXHRcdFx0c2hvdWxkRm9yd2FyZEFyZ3M6IHRydWVcblx0XHR9KTtcblxuXHRcdHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRjb250ZXh0S2V5U2VydmljZTogdGhpcy5zY29wZWRDb250ZXh0S2V5U2VydmljZSxcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gZS5hbmNob3IsXG5cdFx0XHRnZXRBY3Rpb25zOiAoKSA9PiBnZXRGbGF0Q29udGV4dE1lbnVBY3Rpb25zKGhpc3RvcnlJdGVtTWVudUFjdGlvbnMpLFxuXHRcdFx0Z2V0QWN0aW9uc0NvbnRleHQ6ICgpID0+IGVsZW1lbnQuaGlzdG9yeUl0ZW1WaWV3TW9kZWwuaGlzdG9yeUl0ZW1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2xvYWRNb3JlKGN1cnNvcj86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl90cmVlTG9hZE1vcmVTZXF1ZW5jZXIucXVldWUoYXN5bmMgKCkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuX3JlcG9zaXRvcnlJc0xvYWRpbmdNb3JlLmdldCgpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fcmVwb3NpdG9yeUlzTG9hZGluZ01vcmUuc2V0KHRydWUsIHVuZGVmaW5lZCk7XG5cdFx0XHR0aGlzLl90cmVlVmlld01vZGVsLmxvYWRNb3JlKGN1cnNvcik7XG5cblx0XHRcdGF3YWl0IHRoaXMuX3VwZGF0ZUNoaWxkcmVuKCk7XG5cdFx0XHR0aGlzLl9yZXBvc2l0b3J5SXNMb2FkaW5nTW9yZS5zZXQoZmFsc2UsIHVuZGVmaW5lZCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVDaGlsZHJlbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fdXBkYXRlQ2hpbGRyZW5UaHJvdHRsZXIucXVldWUoXG5cdFx0XHQoKSA9PiB0aGlzLl90cmVlT3BlcmF0aW9uU2VxdWVuY2VyLnF1ZXVlKFxuXHRcdFx0XHRhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5fcHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyh7IGxvY2F0aW9uOiB0aGlzLmlkIH0sXG5cdFx0XHRcdFx0XHRhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuX3RyZWUudXBkYXRlQ2hpbGRyZW4odW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwge1xuXHRcdFx0XHRcdFx0XHRcdC8vIGRpZmZJZGVudGl0eVByb3ZpZGVyOiB0aGlzLl90cmVlSWRlbnRpdHlQcm92aWRlclxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KSk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2NvbnRleHRNZW51RGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX3Zpc2liaWxpdHlEaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLE9B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
