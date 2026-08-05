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
import "./media/paneviewlet.css";
import * as nls from "../../../../nls.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { asCssVariable, foreground } from "../../../../platform/theme/common/colorRegistry.js";
import { after, append, $, trackFocus, EventType, addDisposableListener, Dimension, reset, isAncestorOfActiveElement, isActiveElement } from "../../../../base/browser/dom.js";
import { createCSSRule } from "../../../../base/browser/domStylesheets.js";
import { asCssValueWithDefault, asCSSUrl } from "../../../../base/browser/cssValue.js";
import { DisposableMap, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { Action } from "../../../../base/common/actions.js";
import { ActionsOrientation, prepareActions } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Pane } from "../../../../base/browser/ui/splitview/paneview.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Extensions as ViewContainerExtensions, IViewDescriptorService, ViewContainerLocation, defaultViewIcon, ViewContainerLocationToString } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { assertIsDefined } from "../../../../base/common/types.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { MenuId, Action2, SubmenuItemAction } from "../../../../platform/actions/common/actions.js";
import { createActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { parseLinkedText } from "../../../../base/common/linkedText.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { Link } from "../../../../platform/opener/browser/link.js";
import { Orientation } from "../../../../base/browser/ui/sash/sash.js";
import { ProgressBar } from "../../../../base/browser/ui/progressbar/progressbar.js";
import { AbstractProgressScope, ScopedProgressIndicator } from "../../../services/progress/browser/progressIndicator.js";
import { DomScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { ScrollbarVisibility } from "../../../../base/common/scrollable.js";
import { URI } from "../../../../base/common/uri.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { CompositeMenuActions } from "../../actions.js";
import { WorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { FilterWidget } from "./viewFilter.js";
import { BaseActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { defaultButtonStyles, defaultProgressBarStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { PANEL_BACKGROUND, PANEL_SECTION_DRAG_AND_DROP_BACKGROUND, PANEL_STICKY_SCROLL_BACKGROUND, PANEL_STICKY_SCROLL_BORDER, PANEL_STICKY_SCROLL_SHADOW, SIDE_BAR_BACKGROUND, SIDE_BAR_DRAG_AND_DROP_BACKGROUND, SIDE_BAR_STICKY_SCROLL_BACKGROUND, SIDE_BAR_STICKY_SCROLL_BORDER, SIDE_BAR_STICKY_SCROLL_SHADOW } from "../../../common/theme.js";
import { renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
var ViewPaneShowActions = /* @__PURE__ */ ((ViewPaneShowActions2) => {
  ViewPaneShowActions2[ViewPaneShowActions2["Default"] = 0] = "Default";
  ViewPaneShowActions2[ViewPaneShowActions2["WhenExpanded"] = 1] = "WhenExpanded";
  ViewPaneShowActions2[ViewPaneShowActions2["Always"] = 2] = "Always";
  return ViewPaneShowActions2;
})(ViewPaneShowActions || {});
const VIEWPANE_FILTER_ACTION = new Action("viewpane.action.filter");
const viewPaneContainerExpandedIcon = registerIcon("view-pane-container-expanded", Codicon.chevronDown, nls.localize("viewPaneContainerExpandedIcon", "Icon for an expanded view pane container."));
const viewPaneContainerCollapsedIcon = registerIcon("view-pane-container-collapsed", Codicon.chevronRight, nls.localize("viewPaneContainerCollapsedIcon", "Icon for a collapsed view pane container."));
const viewsRegistry = Registry.as(ViewContainerExtensions.ViewsRegistry);
let ViewWelcomeController = class {
  constructor(container, delegate, instantiationService, openerService, contextKeyService, lifecycleService) {
    this.container = container;
    this.delegate = delegate;
    this.instantiationService = instantiationService;
    this.openerService = openerService;
    this.contextKeyService = contextKeyService;
    this.items = [];
    this._enabled = false;
    this.disposables = new DisposableStore();
    this.enabledDisposables = this.disposables.add(new DisposableStore());
    this.renderDisposables = this.disposables.add(new DisposableStore());
    this.disposables.add(Event.runAndSubscribe(this.delegate.onDidChangeViewWelcomeState, () => this.onDidChangeViewWelcomeState()));
    this.disposables.add(lifecycleService.onWillShutdown(() => this.dispose()));
  }
  get enabled() {
    return this._enabled;
  }
  layout(height, width) {
    if (!this._enabled) {
      return;
    }
    this.element.style.height = `${height}px`;
    this.element.style.width = `${width}px`;
    this.element.classList.toggle("wide", width > 640);
    this.scrollableElement.scanDomNode();
  }
  focus() {
    if (!this._enabled) {
      return;
    }
    this.element.focus();
  }
  onDidChangeViewWelcomeState() {
    const enabled = this.delegate.shouldShowWelcome();
    if (this._enabled === enabled) {
      return;
    }
    this._enabled = enabled;
    if (!enabled) {
      this.enabledDisposables.clear();
      return;
    }
    this.container.classList.add("welcome");
    const viewWelcomeContainer = append(this.container, $(".welcome-view"));
    this.element = $(".welcome-view-content", { tabIndex: 0 });
    this.scrollableElement = new DomScrollableElement(this.element, { alwaysConsumeMouseWheel: true, horizontal: ScrollbarVisibility.Hidden, vertical: ScrollbarVisibility.Visible });
    append(viewWelcomeContainer, this.scrollableElement.getDomNode());
    this.enabledDisposables.add(toDisposable(() => {
      this.container.classList.remove("welcome");
      this.scrollableElement.dispose();
      viewWelcomeContainer.remove();
      this.scrollableElement = void 0;
      this.element = void 0;
    }));
    this.contextKeyService.onDidChangeContext(this.onDidChangeContext, this, this.enabledDisposables);
    Event.chain(viewsRegistry.onDidChangeViewWelcomeContent, ($2) => $2.filter((id) => id === this.delegate.id))(this.onDidChangeViewWelcomeContent, this, this.enabledDisposables);
    this.onDidChangeViewWelcomeContent();
  }
  onDidChangeViewWelcomeContent() {
    const descriptors = viewsRegistry.getViewWelcomeContent(this.delegate.id);
    this.items = [];
    for (const descriptor of descriptors) {
      if (descriptor.when === "default") {
        this.defaultItem = { descriptor, visible: true };
      } else {
        const visible = descriptor.when ? this.contextKeyService.contextMatchesRules(descriptor.when) : true;
        this.items.push({ descriptor, visible });
      }
    }
    this.render();
  }
  onDidChangeContext() {
    let didChange = false;
    for (const item of this.items) {
      if (!item.descriptor.when || item.descriptor.when === "default") {
        continue;
      }
      const visible = this.contextKeyService.contextMatchesRules(item.descriptor.when);
      if (item.visible === visible) {
        continue;
      }
      item.visible = visible;
      didChange = true;
    }
    if (didChange) {
      this.render();
    }
  }
  render() {
    this.renderDisposables.clear();
    this.element.innerText = "";
    const contents = this.getContentDescriptors();
    if (contents.length === 0) {
      this.container.classList.remove("welcome");
      this.scrollableElement.scanDomNode();
      return;
    }
    let buttonsCount = 0;
    for (const { content, precondition, renderSecondaryButtons } of contents) {
      const lines = content.split("\n");
      for (let line of lines) {
        line = line.trim();
        if (!line) {
          continue;
        }
        const linkedText = parseLinkedText(line);
        if (linkedText.nodes.length === 1 && typeof linkedText.nodes[0] !== "string") {
          const node = linkedText.nodes[0];
          const buttonContainer = append(this.element, $(".button-container"));
          const button = new Button(buttonContainer, { title: node.title, supportIcons: true, secondary: renderSecondaryButtons && buttonsCount > 0 ? true : false, ...defaultButtonStyles });
          button.label = node.label;
          button.onDidClick((_) => {
            this.openerService.open(node.href, { allowCommands: true });
          }, null, this.renderDisposables);
          this.renderDisposables.add(button);
          buttonsCount++;
          if (precondition) {
            const updateEnablement = () => button.enabled = this.contextKeyService.contextMatchesRules(precondition);
            updateEnablement();
            const keys = new Set(precondition.keys());
            const onDidChangeContext = Event.filter(this.contextKeyService.onDidChangeContext, (e) => e.affectsSome(keys));
            onDidChangeContext(updateEnablement, null, this.renderDisposables);
          }
        } else {
          const p = append(this.element, $("p"));
          for (const node of linkedText.nodes) {
            if (typeof node === "string") {
              append(p, ...renderLabelWithIcons(node));
            } else {
              const link = this.renderDisposables.add(this.instantiationService.createInstance(Link, p, node, {}));
              if (precondition && node.href.startsWith("command:")) {
                const updateEnablement = () => link.enabled = this.contextKeyService.contextMatchesRules(precondition);
                updateEnablement();
                const keys = new Set(precondition.keys());
                const onDidChangeContext = Event.filter(this.contextKeyService.onDidChangeContext, (e) => e.affectsSome(keys));
                onDidChangeContext(updateEnablement, null, this.renderDisposables);
              }
            }
          }
        }
      }
    }
    this.container.classList.add("welcome");
    this.scrollableElement.scanDomNode();
  }
  getContentDescriptors() {
    const visibleItems = this.items.filter((v) => v.visible);
    if (visibleItems.length === 0 && this.defaultItem) {
      return [this.defaultItem.descriptor];
    }
    return visibleItems.map((v) => v.descriptor);
  }
  dispose() {
    this.disposables.dispose();
  }
};
ViewWelcomeController = __decorateClass([
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IOpenerService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, ILifecycleService)
], ViewWelcomeController);
let ViewPane = class extends Pane {
  constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, accessibleViewInformationService) {
    super({ ...options, ...{ orientation: viewDescriptorService.getViewLocationById(options.id) === ViewContainerLocation.Panel ? Orientation.HORIZONTAL : Orientation.VERTICAL } });
    this.keybindingService = keybindingService;
    this.contextMenuService = contextMenuService;
    this.configurationService = configurationService;
    this.contextKeyService = contextKeyService;
    this.viewDescriptorService = viewDescriptorService;
    this.instantiationService = instantiationService;
    this.openerService = openerService;
    this.themeService = themeService;
    this.hoverService = hoverService;
    this.accessibleViewInformationService = accessibleViewInformationService;
    this._onDidFocus = this._register(new Emitter());
    this.onDidFocus = this._onDidFocus.event;
    this._onDidBlur = this._register(new Emitter());
    this.onDidBlur = this._onDidBlur.event;
    this._onDidChangeBodyVisibility = this._register(new Emitter());
    this.onDidChangeBodyVisibility = this._onDidChangeBodyVisibility.event;
    this._onDidChangeTitleArea = this._register(new Emitter());
    this.onDidChangeTitleArea = this._onDidChangeTitleArea.event;
    this._onDidChangeViewWelcomeState = this._register(new Emitter());
    this.onDidChangeViewWelcomeState = this._onDidChangeViewWelcomeState.event;
    this._isVisible = false;
    this.headerActionViewItems = this._register(new DisposableMap());
    this.id = options.id;
    this._title = options.title;
    this._titleDescription = options.titleDescription;
    this._singleViewPaneContainerTitle = options.singleViewPaneContainerTitle;
    this.showActions = options.showActions ?? 0 /* Default */;
    this.scopedContextKeyService = this._register(contextKeyService.createScoped(this.element));
    this.scopedContextKeyService.createKey("view", this.id);
    const viewLocationKey = this.scopedContextKeyService.createKey("viewLocation", ViewContainerLocationToString(viewDescriptorService.getViewLocationById(this.id)));
    this._register(Event.filter(viewDescriptorService.onDidChangeLocation, (e) => e.views.some((view) => view.id === this.id))(() => viewLocationKey.set(ViewContainerLocationToString(viewDescriptorService.getViewLocationById(this.id)))));
    const childInstantiationService = this._register(this.instantiationService.createChild(new ServiceCollection([IContextKeyService, this.scopedContextKeyService])));
    this.menuActions = this._register(childInstantiationService.createInstance(CompositeMenuActions, options.titleMenuId ?? MenuId.ViewTitle, MenuId.ViewTitleContext, { shouldForwardArgs: !options.donotForwardArgs, renderShortTitle: true }));
    this._register(this.menuActions.onDidChange(() => this.updateActions()));
  }
  get title() {
    return this._title;
  }
  get titleDescription() {
    return this._titleDescription;
  }
  get singleViewPaneContainerTitle() {
    return this._singleViewPaneContainerTitle;
  }
  get headerVisible() {
    return super.headerVisible;
  }
  set headerVisible(visible) {
    super.headerVisible = visible;
    this.element.classList.toggle("merged-header", !visible);
  }
  setVisible(visible) {
    if (this._isVisible !== visible) {
      this._isVisible = visible;
      if (this.isExpanded()) {
        this._onDidChangeBodyVisibility.fire(visible);
      }
    }
  }
  isVisible() {
    return this._isVisible;
  }
  isBodyVisible() {
    return this._isVisible && this.isExpanded();
  }
  setExpanded(expanded) {
    const changed = super.setExpanded(expanded);
    if (changed) {
      this._onDidChangeBodyVisibility.fire(expanded);
    }
    this.updateTwistyIcon();
    return changed;
  }
  render() {
    super.render();
    const focusTracker = trackFocus(this.element);
    this._register(focusTracker);
    this._register(focusTracker.onDidFocus(() => this._onDidFocus.fire()));
    this._register(focusTracker.onDidBlur(() => this._onDidBlur.fire()));
  }
  renderHeader(container) {
    this.headerContainer = container;
    this.twistiesContainer = append(container, $(`.twisty-container${ThemeIcon.asCSSSelector(this.getTwistyIcon(this.isExpanded()))}`));
    this.renderHeaderTitle(container, this.title);
    const actions = append(container, $(".actions"));
    actions.classList.toggle("show-always", this.showActions === 2 /* Always */);
    actions.classList.toggle("show-expanded", this.showActions === 1 /* WhenExpanded */);
    this.toolbar = this.instantiationService.createInstance(WorkbenchToolBar, actions, {
      orientation: ActionsOrientation.HORIZONTAL,
      actionViewItemProvider: (action, options) => {
        const item = this.createActionViewItem(action, options);
        if (item) {
          this.headerActionViewItems.set(item.action.id, item);
        }
        return item;
      },
      ariaLabel: nls.localize("viewToolbarAriaLabel", "{0} actions", this.title),
      getKeyBinding: (action) => this.keybindingService.lookupKeybinding(action.id),
      renderDropdownAsChildElement: true,
      actionRunner: this.getActionRunner(),
      resetMenu: this.menuActions.menuId
    });
    this._register(this.toolbar);
    this.setActions();
    this._register(addDisposableListener(actions, EventType.CLICK, (e) => e.preventDefault()));
    const viewContainerModel = this.viewDescriptorService.getViewContainerByViewId(this.id);
    if (viewContainerModel) {
      this._register(this.viewDescriptorService.getViewContainerModel(viewContainerModel).onDidChangeContainerInfo(({ title }) => this.updateTitle(this.title)));
    } else {
      console.error(`View container model not found for view ${this.id}`);
    }
    const onDidRelevantConfigurationChange = Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration(ViewPane.AlwaysShowActionsConfig));
    this._register(onDidRelevantConfigurationChange(this.updateActionsVisibility, this));
    this.updateActionsVisibility();
  }
  updateHeader() {
    super.updateHeader();
    this.updateTwistyIcon();
  }
  updateTwistyIcon() {
    if (this.twistiesContainer) {
      this.twistiesContainer.classList.remove(...ThemeIcon.asClassNameArray(this.getTwistyIcon(!this._expanded)));
      this.twistiesContainer.classList.add(...ThemeIcon.asClassNameArray(this.getTwistyIcon(this._expanded)));
    }
  }
  getTwistyIcon(expanded) {
    return expanded ? viewPaneContainerExpandedIcon : viewPaneContainerCollapsedIcon;
  }
  style(styles) {
    super.style(styles);
    const icon = this.getIcon();
    if (this.iconContainer) {
      const fgColor = asCssValueWithDefault(styles.headerForeground, asCssVariable(foreground));
      if (URI.isUri(icon)) {
        this.iconContainer.style.backgroundColor = fgColor;
        this.iconContainer.style.color = "";
      } else {
        this.iconContainer.style.color = fgColor;
        this.iconContainer.style.backgroundColor = "";
      }
    }
  }
  getIcon() {
    return this.viewDescriptorService.getViewDescriptorById(this.id)?.containerIcon || defaultViewIcon;
  }
  renderHeaderTitle(container, title) {
    this.iconContainer = append(container, $(".icon", void 0));
    const icon = this.getIcon();
    let cssClass = void 0;
    if (URI.isUri(icon)) {
      cssClass = `view-${this.id.replace(/[\.\:]/g, "-")}`;
      const iconClass = `.pane-header .icon.${cssClass}`;
      createCSSRule(iconClass, `
				mask: ${asCSSUrl(icon)} no-repeat 50% 50%;
				mask-size: 24px;
				-webkit-mask: ${asCSSUrl(icon)} no-repeat 50% 50%;
				-webkit-mask-size: 16px;
			`);
    } else if (ThemeIcon.isThemeIcon(icon)) {
      cssClass = ThemeIcon.asClassName(icon);
    }
    if (cssClass) {
      this.iconContainer.classList.add(...cssClass.split(" "));
    }
    const calculatedTitle = this.calculateTitle(title);
    this.titleContainer = append(container, $("h3.title", {}, calculatedTitle));
    this.titleContainerHover = this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.titleContainer, calculatedTitle));
    if (this._titleDescription) {
      this.setTitleDescription(this._titleDescription);
    }
    this.iconContainerHover = this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.iconContainer, calculatedTitle));
    this.iconContainer.setAttribute("aria-label", this._getAriaLabel(calculatedTitle, this._titleDescription));
  }
  _getAriaLabel(title, description) {
    const viewHasAccessibilityHelpContent = this.viewDescriptorService.getViewDescriptorById(this.id)?.accessibilityHelpContent;
    const accessibleViewHasShownForView = this.accessibleViewInformationService?.hasShownAccessibleView(this.id);
    if (!viewHasAccessibilityHelpContent || accessibleViewHasShownForView) {
      if (description) {
        return `${title} - ${description}`;
      } else {
        return title;
      }
    }
    return nls.localize("viewAccessibilityHelp", "Use Alt+F1 for accessibility help {0}", title);
  }
  updateTitle(title) {
    const calculatedTitle = this.calculateTitle(title);
    if (this.titleContainer) {
      this.titleContainer.textContent = calculatedTitle;
      this.titleContainerHover?.update(calculatedTitle);
    }
    this.updateAriaHeaderLabel(calculatedTitle, this._titleDescription);
    this._title = title;
    this._onDidChangeTitleArea.fire();
  }
  updateAriaHeaderLabel(title, description) {
    const ariaLabel = this._getAriaLabel(title, description);
    if (this.iconContainer) {
      this.iconContainerHover?.update(title);
      this.iconContainer.setAttribute("aria-label", ariaLabel);
    }
    this.ariaHeaderLabel = this.getAriaHeaderLabel(ariaLabel);
  }
  setTitleDescription(description) {
    if (this.titleDescriptionContainer) {
      this.titleDescriptionContainer.textContent = description ?? "";
      this.titleDescriptionContainerHover?.update(description ?? "");
    } else if (description && this.titleContainer) {
      this.titleDescriptionContainer = after(this.titleContainer, $("span.description", {}, description));
      this.titleDescriptionContainerHover = this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.titleDescriptionContainer, description));
    }
  }
  updateTitleDescription(description) {
    this.setTitleDescription(description);
    this.updateAriaHeaderLabel(this._title, description);
    this._titleDescription = description;
    this._onDidChangeTitleArea.fire();
  }
  calculateTitle(title) {
    const viewContainer = this.viewDescriptorService.getViewContainerByViewId(this.id);
    const model = this.viewDescriptorService.getViewContainerModel(viewContainer);
    const viewDescriptor = this.viewDescriptorService.getViewDescriptorById(this.id);
    const isDefault = this.viewDescriptorService.getDefaultContainerById(this.id) === viewContainer;
    if (!isDefault && viewDescriptor?.containerTitle && model.title !== viewDescriptor.containerTitle) {
      return `${viewDescriptor.containerTitle}: ${title}`;
    }
    return title;
  }
  renderBody(container) {
    this.viewWelcomeController = this._register(this.instantiationService.createInstance(ViewWelcomeController, container, this));
  }
  layoutBody(height, width) {
    this.viewWelcomeController.layout(height, width);
  }
  onDidScrollRoot() {
  }
  getProgressIndicator() {
    if (this.progressBar === void 0) {
      this.progressBar = this._register(new ProgressBar(this.element, defaultProgressBarStyles));
      this.progressBar.hide();
    }
    if (this.progressIndicator === void 0) {
      const that = this;
      this.progressIndicator = this._register(new ScopedProgressIndicator(assertIsDefined(this.progressBar), new class extends AbstractProgressScope {
        constructor() {
          super(that.id, that.isBodyVisible());
          this._register(that.onDidChangeBodyVisibility((isVisible) => isVisible ? this.onScopeOpened(that.id) : this.onScopeClosed(that.id)));
        }
      }()));
    }
    return this.progressIndicator;
  }
  getProgressLocation() {
    return this.viewDescriptorService.getViewContainerByViewId(this.id).id;
  }
  getLocationBasedColors() {
    return getLocationBasedViewColors(this.viewDescriptorService.getViewLocationById(this.id));
  }
  focus() {
    if (this.viewWelcomeController.enabled) {
      this.viewWelcomeController.focus();
    } else if (this.element) {
      this.element.focus();
    }
    if (isActiveElement(this.element) || isAncestorOfActiveElement(this.element)) {
      this._onDidFocus.fire();
    }
  }
  setActions() {
    if (this.toolbar) {
      const primaryActions = [...this.menuActions.getPrimaryActions()];
      if (this.shouldShowFilterInHeader()) {
        primaryActions.unshift(VIEWPANE_FILTER_ACTION);
      }
      this.toolbar.setActions(prepareActions(primaryActions), prepareActions(this.menuActions.getSecondaryActions()));
      this.toolbar.context = this.getActionsContext();
    }
  }
  updateActionsVisibility() {
    if (!this.headerContainer) {
      return;
    }
    const shouldAlwaysShowActions = this.configurationService.getValue("workbench.view.alwaysShowHeaderActions");
    this.headerContainer.classList.toggle("actions-always-visible", shouldAlwaysShowActions);
  }
  updateActions() {
    this.setActions();
    this._onDidChangeTitleArea.fire();
  }
  createActionViewItem(action, options) {
    if (action.id === VIEWPANE_FILTER_ACTION.id) {
      const that = this;
      return new class extends BaseActionViewItem {
        constructor() {
          super(null, action);
        }
        setFocusable() {
        }
        get trapsArrowNavigation() {
          return true;
        }
        render(container) {
          container.classList.add("viewpane-filter-container");
          const filter = that.getFilterWidget();
          append(container, filter.element);
          filter.relayout();
        }
      }();
    }
    return createActionViewItem(this.instantiationService, action, { ...options, ...{ menuAsChild: action instanceof SubmenuItemAction } });
  }
  getActionsContext() {
    return void 0;
  }
  getActionRunner() {
    return void 0;
  }
  getOptimalWidth() {
    return 0;
  }
  saveState() {
  }
  shouldShowWelcome() {
    return false;
  }
  getFilterWidget() {
    return void 0;
  }
  shouldShowFilterInHeader() {
    return false;
  }
};
ViewPane.AlwaysShowActionsConfig = "workbench.view.alwaysShowHeaderActions";
ViewPane = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IHoverService)
], ViewPane);
let FilterViewPane = class extends ViewPane {
  constructor(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, accessibleViewService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService, accessibleViewService);
    const childInstantiationService = this._register(instantiationService.createChild(new ServiceCollection([IContextKeyService, this.scopedContextKeyService])));
    this.filterWidget = this._register(childInstantiationService.createInstance(FilterWidget, options.filterOptions));
  }
  getFilterWidget() {
    return this.filterWidget;
  }
  renderBody(container) {
    super.renderBody(container);
    this.filterContainer = append(container, $(".viewpane-filter-container"));
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.dimension = new Dimension(width, height);
    const wasFilterShownInHeader = !this.filterContainer?.hasChildNodes();
    const shouldShowFilterInHeader = this.shouldShowFilterInHeader();
    if (wasFilterShownInHeader !== shouldShowFilterInHeader) {
      if (shouldShowFilterInHeader) {
        reset(this.filterContainer);
      }
      this.updateActions();
      if (!shouldShowFilterInHeader) {
        append(this.filterContainer, this.filterWidget.element);
      }
    }
    if (!shouldShowFilterInHeader) {
      height = height - 44;
    }
    this.filterWidget.layout(width);
    this.layoutBodyContent(height, width);
  }
  shouldShowFilterInHeader() {
    return !(this.dimension && this.dimension.width < 600 && this.dimension.height > 100);
  }
};
FilterViewPane = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IViewDescriptorService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IThemeService),
  __decorateParam(9, IHoverService)
], FilterViewPane);
function getLocationBasedViewColors(location) {
  let background, overlayBackground, stickyScrollBackground, stickyScrollBorder, stickyScrollShadow;
  switch (location) {
    case ViewContainerLocation.Panel:
      background = PANEL_BACKGROUND;
      overlayBackground = PANEL_SECTION_DRAG_AND_DROP_BACKGROUND;
      stickyScrollBackground = PANEL_STICKY_SCROLL_BACKGROUND;
      stickyScrollBorder = PANEL_STICKY_SCROLL_BORDER;
      stickyScrollShadow = PANEL_STICKY_SCROLL_SHADOW;
      break;
    case ViewContainerLocation.Sidebar:
    case ViewContainerLocation.AuxiliaryBar:
    default:
      background = SIDE_BAR_BACKGROUND;
      overlayBackground = SIDE_BAR_DRAG_AND_DROP_BACKGROUND;
      stickyScrollBackground = SIDE_BAR_STICKY_SCROLL_BACKGROUND;
      stickyScrollBorder = SIDE_BAR_STICKY_SCROLL_BORDER;
      stickyScrollShadow = SIDE_BAR_STICKY_SCROLL_SHADOW;
  }
  return {
    background,
    overlayBackground,
    listOverrideStyles: {
      listBackground: background,
      treeStickyScrollBackground: stickyScrollBackground,
      treeStickyScrollBorder: stickyScrollBorder,
      treeStickyScrollShadow: stickyScrollShadow
    }
  };
}
class ViewAction extends Action2 {
  constructor(desc) {
    super(desc);
    this.desc = desc;
  }
  run(accessor, ...args) {
    const view = accessor.get(IViewsService).getActiveViewWithId(this.desc.viewId);
    if (view) {
      return this.runInView(accessor, view, ...args);
    }
    return void 0;
  }
}
export {
  FilterViewPane,
  VIEWPANE_FILTER_ACTION,
  ViewAction,
  ViewPane,
  ViewPaneShowActions,
  getLocationBasedViewColors
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3UGFuZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9tZWRpYS9wYW5ldmlld2xldC5jc3MnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBFdmVudCwgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGFzQ3NzVmFyaWFibGUsIGZvcmVncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBhZnRlciwgYXBwZW5kLCAkLCB0cmFja0ZvY3VzLCBFdmVudFR5cGUsIGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgRGltZW5zaW9uLCByZXNldCwgaXNBbmNlc3Rvck9mQWN0aXZlRWxlbWVudCwgaXNBY3RpdmVFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVDU1NSdWxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbVN0eWxlc2hlZXRzLmpzJztcbmltcG9ydCB7IGFzQ3NzVmFsdWVXaXRoRGVmYXVsdCwgYXNDU1NVcmwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvY3NzVmFsdWUuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZU1hcCwgRGlzcG9zYWJsZVN0b3JlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgQWN0aW9uLCBJQWN0aW9uLCBJQWN0aW9uUnVubmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBBY3Rpb25zT3JpZW50YXRpb24sIElBY3Rpb25WaWV3SXRlbSwgcHJlcGFyZUFjdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBJUGFuZU9wdGlvbnMsIFBhbmUsIElQYW5lU3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3NwbGl0dmlldy9wYW5ldmlldy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMgYXMgVmlld0NvbnRhaW5lckV4dGVuc2lvbnMsIElWaWV3LCBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBWaWV3Q29udGFpbmVyTG9jYXRpb24sIElWaWV3c1JlZ2lzdHJ5LCBJVmlld0NvbnRlbnREZXNjcmlwdG9yLCBkZWZhdWx0Vmlld0ljb24sIFZpZXdDb250YWluZXJMb2NhdGlvblRvU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNEZWZpbmVkLCBQYXJ0aWFsRXhjZXB0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBNZW51SWQsIEFjdGlvbjIsIElBY3Rpb24yT3B0aW9ucywgU3VibWVudUl0ZW1BY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IGNyZWF0ZUFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IHBhcnNlTGlua2VkVGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpbmtlZFRleHQuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYnV0dG9uL2J1dHRvbi5qcyc7XG5pbXBvcnQgeyBMaW5rIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2Jyb3dzZXIvbGluay5qcyc7XG5pbXBvcnQgeyBPcmllbnRhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zYXNoL3Nhc2guanMnO1xuaW1wb3J0IHsgUHJvZ3Jlc3NCYXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvcHJvZ3Jlc3NiYXIvcHJvZ3Jlc3NiYXIuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RQcm9ncmVzc1Njb3BlLCBTY29wZWRQcm9ncmVzc0luZGljYXRvciB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3Byb2dyZXNzL2Jyb3dzZXIvcHJvZ3Jlc3NJbmRpY2F0b3IuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzSW5kaWNhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IERvbVNjcm9sbGFibGVFbGVtZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3Njcm9sbGJhci9zY3JvbGxhYmxlRWxlbWVudC5qcyc7XG5pbXBvcnQgeyBTY3JvbGxiYXJWaXNpYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2Nyb2xsYWJsZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2ljb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgQ29tcG9zaXRlTWVudUFjdGlvbnMgfSBmcm9tICcuLi8uLi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElEcm9wZG93bk1lbnVBY3Rpb25WaWV3SXRlbU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvZHJvcGRvd24vZHJvcGRvd25BY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hUb29sQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL3Rvb2xiYXIuanMnO1xuaW1wb3J0IHsgRmlsdGVyV2lkZ2V0LCBJRmlsdGVyV2lkZ2V0T3B0aW9ucyB9IGZyb20gJy4vdmlld0ZpbHRlci5qcyc7XG5pbXBvcnQgeyBCYXNlQWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvblZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IGRlZmF1bHRCdXR0b25TdHlsZXMsIGRlZmF1bHRQcm9ncmVzc0JhclN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2Jyb3dzZXIvZGVmYXVsdFN0eWxlcy5qcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB0eXBlIHsgSU1hbmFnZWRIb3ZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBJTGlzdFN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9saXN0L2xpc3RXaWRnZXQuanMnO1xuaW1wb3J0IHsgUEFORUxfQkFDS0dST1VORCwgUEFORUxfU0VDVElPTl9EUkFHX0FORF9EUk9QX0JBQ0tHUk9VTkQsIFBBTkVMX1NUSUNLWV9TQ1JPTExfQkFDS0dST1VORCwgUEFORUxfU1RJQ0tZX1NDUk9MTF9CT1JERVIsIFBBTkVMX1NUSUNLWV9TQ1JPTExfU0hBRE9XLCBTSURFX0JBUl9CQUNLR1JPVU5ELCBTSURFX0JBUl9EUkFHX0FORF9EUk9QX0JBQ0tHUk9VTkQsIFNJREVfQkFSX1NUSUNLWV9TQ1JPTExfQkFDS0dST1VORCwgU0lERV9CQVJfU1RJQ0tZX1NDUk9MTF9CT1JERVIsIFNJREVfQkFSX1NUSUNLWV9TQ1JPTExfU0hBRE9XIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmxlVmlld0luZm9ybWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2libGVWaWV3SW5mb3JtYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IHJlbmRlckxhYmVsV2l0aEljb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ljb25MYWJlbC9pY29uTGFiZWxzLmpzJztcblxuZXhwb3J0IGVudW0gVmlld1BhbmVTaG93QWN0aW9ucyB7XG5cdC8qKiBTaG93IHRoZSBhY3Rpb25zIHdoZW4gdGhlIHZpZXcgaXMgaG92ZXJlZC4gVGhpcyBpcyB0aGUgZGVmYXVsdCBiZWhhdmlvci4gKi9cblx0RGVmYXVsdCxcblxuXHQvKiogQWx3YXlzIHNob3dzIHRoZSBhY3Rpb25zIHdoZW4gdGhlIHZpZXcgaXMgZXhwYW5kZWQgKi9cblx0V2hlbkV4cGFuZGVkLFxuXG5cdC8qKiBBbHdheXMgc2hvd3MgdGhlIGFjdGlvbnMgKi9cblx0QWx3YXlzLFxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElWaWV3UGFuZU9wdGlvbnMgZXh0ZW5kcyBJUGFuZU9wdGlvbnMge1xuXHRyZWFkb25seSBpZDogc3RyaW5nO1xuXHRyZWFkb25seSBzaG93QWN0aW9ucz86IFZpZXdQYW5lU2hvd0FjdGlvbnM7XG5cdHJlYWRvbmx5IHRpdGxlTWVudUlkPzogTWVudUlkO1xuXHRyZWFkb25seSBkb25vdEZvcndhcmRBcmdzPzogYm9vbGVhbjtcblx0Ly8gVGhlIHRpdGxlIG9mIHRoZSBjb250YWluZXIgcGFuZSB3aGVuIGl0IGlzIG1lcmdlZCB3aXRoIHRoZSB2aWV3IGNvbnRhaW5lclxuXHRyZWFkb25seSBzaW5nbGVWaWV3UGFuZUNvbnRhaW5lclRpdGxlPzogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWx0ZXJWaWV3UGFuZU9wdGlvbnMgZXh0ZW5kcyBJVmlld1BhbmVPcHRpb25zIHtcblx0ZmlsdGVyT3B0aW9uczogSUZpbHRlcldpZGdldE9wdGlvbnM7XG59XG5cbmV4cG9ydCBjb25zdCBWSUVXUEFORV9GSUxURVJfQUNUSU9OID0gbmV3IEFjdGlvbigndmlld3BhbmUuYWN0aW9uLmZpbHRlcicpO1xuXG5jb25zdCB2aWV3UGFuZUNvbnRhaW5lckV4cGFuZGVkSWNvbiA9IHJlZ2lzdGVySWNvbigndmlldy1wYW5lLWNvbnRhaW5lci1leHBhbmRlZCcsIENvZGljb24uY2hldnJvbkRvd24sIG5scy5sb2NhbGl6ZSgndmlld1BhbmVDb250YWluZXJFeHBhbmRlZEljb24nLCAnSWNvbiBmb3IgYW4gZXhwYW5kZWQgdmlldyBwYW5lIGNvbnRhaW5lci4nKSk7XG5jb25zdCB2aWV3UGFuZUNvbnRhaW5lckNvbGxhcHNlZEljb24gPSByZWdpc3Rlckljb24oJ3ZpZXctcGFuZS1jb250YWluZXItY29sbGFwc2VkJywgQ29kaWNvbi5jaGV2cm9uUmlnaHQsIG5scy5sb2NhbGl6ZSgndmlld1BhbmVDb250YWluZXJDb2xsYXBzZWRJY29uJywgJ0ljb24gZm9yIGEgY29sbGFwc2VkIHZpZXcgcGFuZSBjb250YWluZXIuJykpO1xuXG5jb25zdCB2aWV3c1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVZpZXdzUmVnaXN0cnk+KFZpZXdDb250YWluZXJFeHRlbnNpb25zLlZpZXdzUmVnaXN0cnkpO1xuXG5pbnRlcmZhY2UgSUl0ZW0ge1xuXHRyZWFkb25seSBkZXNjcmlwdG9yOiBJVmlld0NvbnRlbnREZXNjcmlwdG9yO1xuXHR2aXNpYmxlOiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgSVZpZXdXZWxjb21lRGVsZWdhdGUge1xuXHRyZWFkb25seSBpZDogc3RyaW5nO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVZpZXdXZWxjb21lU3RhdGU6IEV2ZW50PHZvaWQ+O1xuXHRzaG91bGRTaG93V2VsY29tZSgpOiBib29sZWFuO1xufVxuXG5jbGFzcyBWaWV3V2VsY29tZUNvbnRyb2xsZXIge1xuXG5cdHByaXZhdGUgZGVmYXVsdEl0ZW06IElJdGVtIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGl0ZW1zOiBJSXRlbVtdID0gW107XG5cblx0Z2V0IGVuYWJsZWQoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9lbmFibGVkOyB9XG5cdHByaXZhdGUgX2VuYWJsZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBlbGVtZW50OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBzY3JvbGxhYmxlRWxlbWVudDogRG9tU2Nyb2xsYWJsZUVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0cHJpdmF0ZSByZWFkb25seSBlbmFibGVkRGlzcG9zYWJsZXMgPSB0aGlzLmRpc3Bvc2FibGVzLmFkZChuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IHJlbmRlckRpc3Bvc2FibGVzID0gdGhpcy5kaXNwb3NhYmxlcy5hZGQobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBkZWxlZ2F0ZTogSVZpZXdXZWxjb21lRGVsZWdhdGUsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIHByb3RlY3RlZCBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUxpZmVjeWNsZVNlcnZpY2UgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2Vcblx0KSB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQoRXZlbnQucnVuQW5kU3Vic2NyaWJlKHRoaXMuZGVsZWdhdGUub25EaWRDaGFuZ2VWaWV3V2VsY29tZVN0YXRlLCAoKSA9PiB0aGlzLm9uRGlkQ2hhbmdlVmlld1dlbGNvbWVTdGF0ZSgpKSk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQobGlmZWN5Y2xlU2VydmljZS5vbldpbGxTaHV0ZG93bigoKSA9PiB0aGlzLmRpc3Bvc2UoKSkpOyAvLyBGaXhlcyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjA4ODc4XG5cdH1cblxuXHRsYXlvdXQoaGVpZ2h0OiBudW1iZXIsIHdpZHRoOiBudW1iZXIpIHtcblx0XHRpZiAoIXRoaXMuX2VuYWJsZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmVsZW1lbnQhLnN0eWxlLmhlaWdodCA9IGAke2hlaWdodH1weGA7XG5cdFx0dGhpcy5lbGVtZW50IS5zdHlsZS53aWR0aCA9IGAke3dpZHRofXB4YDtcblx0XHR0aGlzLmVsZW1lbnQhLmNsYXNzTGlzdC50b2dnbGUoJ3dpZGUnLCB3aWR0aCA+IDY0MCk7XG5cdFx0dGhpcy5zY3JvbGxhYmxlRWxlbWVudCEuc2NhbkRvbU5vZGUoKTtcblx0fVxuXG5cdGZvY3VzKCkge1xuXHRcdGlmICghdGhpcy5fZW5hYmxlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuZWxlbWVudCEuZm9jdXMoKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VWaWV3V2VsY29tZVN0YXRlKCk6IHZvaWQge1xuXHRcdGNvbnN0IGVuYWJsZWQgPSB0aGlzLmRlbGVnYXRlLnNob3VsZFNob3dXZWxjb21lKCk7XG5cblx0XHRpZiAodGhpcy5fZW5hYmxlZCA9PT0gZW5hYmxlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2VuYWJsZWQgPSBlbmFibGVkO1xuXG5cdFx0aWYgKCFlbmFibGVkKSB7XG5cdFx0XHR0aGlzLmVuYWJsZWREaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3dlbGNvbWUnKTtcblx0XHRjb25zdCB2aWV3V2VsY29tZUNvbnRhaW5lciA9IGFwcGVuZCh0aGlzLmNvbnRhaW5lciwgJCgnLndlbGNvbWUtdmlldycpKTtcblx0XHR0aGlzLmVsZW1lbnQgPSAkKCcud2VsY29tZS12aWV3LWNvbnRlbnQnLCB7IHRhYkluZGV4OiAwIH0pO1xuXHRcdHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQgPSBuZXcgRG9tU2Nyb2xsYWJsZUVsZW1lbnQodGhpcy5lbGVtZW50LCB7IGFsd2F5c0NvbnN1bWVNb3VzZVdoZWVsOiB0cnVlLCBob3Jpem9udGFsOiBTY3JvbGxiYXJWaXNpYmlsaXR5LkhpZGRlbiwgdmVydGljYWw6IFNjcm9sbGJhclZpc2liaWxpdHkuVmlzaWJsZSwgfSk7XG5cdFx0YXBwZW5kKHZpZXdXZWxjb21lQ29udGFpbmVyLCB0aGlzLnNjcm9sbGFibGVFbGVtZW50LmdldERvbU5vZGUoKSk7XG5cblx0XHR0aGlzLmVuYWJsZWREaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ3dlbGNvbWUnKTtcblx0XHRcdHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQhLmRpc3Bvc2UoKTtcblx0XHRcdHZpZXdXZWxjb21lQ29udGFpbmVyLnJlbW92ZSgpO1xuXHRcdFx0dGhpcy5zY3JvbGxhYmxlRWxlbWVudCA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMuZWxlbWVudCA9IHVuZGVmaW5lZDtcblx0XHR9KSk7XG5cblx0XHR0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLm9uRGlkQ2hhbmdlQ29udGV4dCh0aGlzLm9uRGlkQ2hhbmdlQ29udGV4dCwgdGhpcywgdGhpcy5lbmFibGVkRGlzcG9zYWJsZXMpO1xuXHRcdEV2ZW50LmNoYWluKHZpZXdzUmVnaXN0cnkub25EaWRDaGFuZ2VWaWV3V2VsY29tZUNvbnRlbnQsICQgPT4gJC5maWx0ZXIoaWQgPT4gaWQgPT09IHRoaXMuZGVsZWdhdGUuaWQpKVxuXHRcdFx0KHRoaXMub25EaWRDaGFuZ2VWaWV3V2VsY29tZUNvbnRlbnQsIHRoaXMsIHRoaXMuZW5hYmxlZERpc3Bvc2FibGVzKTtcblx0XHR0aGlzLm9uRGlkQ2hhbmdlVmlld1dlbGNvbWVDb250ZW50KCk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlVmlld1dlbGNvbWVDb250ZW50KCk6IHZvaWQge1xuXHRcdGNvbnN0IGRlc2NyaXB0b3JzID0gdmlld3NSZWdpc3RyeS5nZXRWaWV3V2VsY29tZUNvbnRlbnQodGhpcy5kZWxlZ2F0ZS5pZCk7XG5cblx0XHR0aGlzLml0ZW1zID0gW107XG5cblx0XHRmb3IgKGNvbnN0IGRlc2NyaXB0b3Igb2YgZGVzY3JpcHRvcnMpIHtcblx0XHRcdGlmIChkZXNjcmlwdG9yLndoZW4gPT09ICdkZWZhdWx0Jykge1xuXHRcdFx0XHR0aGlzLmRlZmF1bHRJdGVtID0geyBkZXNjcmlwdG9yLCB2aXNpYmxlOiB0cnVlIH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCB2aXNpYmxlID0gZGVzY3JpcHRvci53aGVuID8gdGhpcy5jb250ZXh0S2V5U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKGRlc2NyaXB0b3Iud2hlbikgOiB0cnVlO1xuXHRcdFx0XHR0aGlzLml0ZW1zLnB1c2goeyBkZXNjcmlwdG9yLCB2aXNpYmxlIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMucmVuZGVyKCk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlQ29udGV4dCgpOiB2b2lkIHtcblx0XHRsZXQgZGlkQ2hhbmdlID0gZmFsc2U7XG5cblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5pdGVtcykge1xuXHRcdFx0aWYgKCFpdGVtLmRlc2NyaXB0b3Iud2hlbiB8fCBpdGVtLmRlc2NyaXB0b3Iud2hlbiA9PT0gJ2RlZmF1bHQnKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB2aXNpYmxlID0gdGhpcy5jb250ZXh0S2V5U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKGl0ZW0uZGVzY3JpcHRvci53aGVuKTtcblxuXHRcdFx0aWYgKGl0ZW0udmlzaWJsZSA9PT0gdmlzaWJsZSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aXRlbS52aXNpYmxlID0gdmlzaWJsZTtcblx0XHRcdGRpZENoYW5nZSA9IHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKGRpZENoYW5nZSkge1xuXHRcdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlcigpOiB2b2lkIHtcblx0XHR0aGlzLnJlbmRlckRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5lbGVtZW50IS5pbm5lclRleHQgPSAnJztcblxuXHRcdGNvbnN0IGNvbnRlbnRzID0gdGhpcy5nZXRDb250ZW50RGVzY3JpcHRvcnMoKTtcblxuXHRcdGlmIChjb250ZW50cy5sZW5ndGggPT09IDApIHtcblx0XHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ3dlbGNvbWUnKTtcblx0XHRcdHRoaXMuc2Nyb2xsYWJsZUVsZW1lbnQhLnNjYW5Eb21Ob2RlKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IGJ1dHRvbnNDb3VudCA9IDA7XG5cdFx0Zm9yIChjb25zdCB7IGNvbnRlbnQsIHByZWNvbmRpdGlvbiwgcmVuZGVyU2Vjb25kYXJ5QnV0dG9ucyB9IG9mIGNvbnRlbnRzKSB7XG5cdFx0XHRjb25zdCBsaW5lcyA9IGNvbnRlbnQuc3BsaXQoJ1xcbicpO1xuXG5cdFx0XHRmb3IgKGxldCBsaW5lIG9mIGxpbmVzKSB7XG5cdFx0XHRcdGxpbmUgPSBsaW5lLnRyaW0oKTtcblxuXHRcdFx0XHRpZiAoIWxpbmUpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGxpbmtlZFRleHQgPSBwYXJzZUxpbmtlZFRleHQobGluZSk7XG5cblx0XHRcdFx0aWYgKGxpbmtlZFRleHQubm9kZXMubGVuZ3RoID09PSAxICYmIHR5cGVvZiBsaW5rZWRUZXh0Lm5vZGVzWzBdICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdGNvbnN0IG5vZGUgPSBsaW5rZWRUZXh0Lm5vZGVzWzBdO1xuXHRcdFx0XHRcdGNvbnN0IGJ1dHRvbkNvbnRhaW5lciA9IGFwcGVuZCh0aGlzLmVsZW1lbnQhLCAkKCcuYnV0dG9uLWNvbnRhaW5lcicpKTtcblx0XHRcdFx0XHRjb25zdCBidXR0b24gPSBuZXcgQnV0dG9uKGJ1dHRvbkNvbnRhaW5lciwgeyB0aXRsZTogbm9kZS50aXRsZSwgc3VwcG9ydEljb25zOiB0cnVlLCBzZWNvbmRhcnk6IHJlbmRlclNlY29uZGFyeUJ1dHRvbnMgJiYgYnV0dG9uc0NvdW50ID4gMCA/IHRydWUgOiBmYWxzZSwgLi4uZGVmYXVsdEJ1dHRvblN0eWxlcywgfSk7XG5cdFx0XHRcdFx0YnV0dG9uLmxhYmVsID0gbm9kZS5sYWJlbDtcblx0XHRcdFx0XHRidXR0b24ub25EaWRDbGljayhfID0+IHtcblx0XHRcdFx0XHRcdHRoaXMub3BlbmVyU2VydmljZS5vcGVuKG5vZGUuaHJlZiwgeyBhbGxvd0NvbW1hbmRzOiB0cnVlIH0pO1xuXHRcdFx0XHRcdH0sIG51bGwsIHRoaXMucmVuZGVyRGlzcG9zYWJsZXMpO1xuXHRcdFx0XHRcdHRoaXMucmVuZGVyRGlzcG9zYWJsZXMuYWRkKGJ1dHRvbik7XG5cdFx0XHRcdFx0YnV0dG9uc0NvdW50Kys7XG5cblx0XHRcdFx0XHRpZiAocHJlY29uZGl0aW9uKSB7XG5cdFx0XHRcdFx0XHRjb25zdCB1cGRhdGVFbmFibGVtZW50ID0gKCkgPT4gYnV0dG9uLmVuYWJsZWQgPSB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNvbnRleHRNYXRjaGVzUnVsZXMocHJlY29uZGl0aW9uKTtcblx0XHRcdFx0XHRcdHVwZGF0ZUVuYWJsZW1lbnQoKTtcblxuXHRcdFx0XHRcdFx0Y29uc3Qga2V5cyA9IG5ldyBTZXQocHJlY29uZGl0aW9uLmtleXMoKSk7XG5cdFx0XHRcdFx0XHRjb25zdCBvbkRpZENoYW5nZUNvbnRleHQgPSBFdmVudC5maWx0ZXIodGhpcy5jb250ZXh0S2V5U2VydmljZS5vbkRpZENoYW5nZUNvbnRleHQsIGUgPT4gZS5hZmZlY3RzU29tZShrZXlzKSk7XG5cdFx0XHRcdFx0XHRvbkRpZENoYW5nZUNvbnRleHQodXBkYXRlRW5hYmxlbWVudCwgbnVsbCwgdGhpcy5yZW5kZXJEaXNwb3NhYmxlcyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IHAgPSBhcHBlbmQodGhpcy5lbGVtZW50ISwgJCgncCcpKTtcblxuXHRcdFx0XHRcdGZvciAoY29uc3Qgbm9kZSBvZiBsaW5rZWRUZXh0Lm5vZGVzKSB7XG5cdFx0XHRcdFx0XHRpZiAodHlwZW9mIG5vZGUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0XHRcdGFwcGVuZChwLCAuLi5yZW5kZXJMYWJlbFdpdGhJY29ucyhub2RlKSk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBsaW5rID0gdGhpcy5yZW5kZXJEaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShMaW5rLCBwLCBub2RlLCB7fSkpO1xuXG5cdFx0XHRcdFx0XHRcdGlmIChwcmVjb25kaXRpb24gJiYgbm9kZS5ocmVmLnN0YXJ0c1dpdGgoJ2NvbW1hbmQ6JykpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCB1cGRhdGVFbmFibGVtZW50ID0gKCkgPT4gbGluay5lbmFibGVkID0gdGhpcy5jb250ZXh0S2V5U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKHByZWNvbmRpdGlvbik7XG5cdFx0XHRcdFx0XHRcdFx0dXBkYXRlRW5hYmxlbWVudCgpO1xuXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3Qga2V5cyA9IG5ldyBTZXQocHJlY29uZGl0aW9uLmtleXMoKSk7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3Qgb25EaWRDaGFuZ2VDb250ZXh0ID0gRXZlbnQuZmlsdGVyKHRoaXMuY29udGV4dEtleVNlcnZpY2Uub25EaWRDaGFuZ2VDb250ZXh0LCBlID0+IGUuYWZmZWN0c1NvbWUoa2V5cykpO1xuXHRcdFx0XHRcdFx0XHRcdG9uRGlkQ2hhbmdlQ29udGV4dCh1cGRhdGVFbmFibGVtZW50LCBudWxsLCB0aGlzLnJlbmRlckRpc3Bvc2FibGVzKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuY29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3dlbGNvbWUnKTtcblx0XHR0aGlzLnNjcm9sbGFibGVFbGVtZW50IS5zY2FuRG9tTm9kZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRDb250ZW50RGVzY3JpcHRvcnMoKTogSVZpZXdDb250ZW50RGVzY3JpcHRvcltdIHtcblx0XHRjb25zdCB2aXNpYmxlSXRlbXMgPSB0aGlzLml0ZW1zLmZpbHRlcih2ID0+IHYudmlzaWJsZSk7XG5cblx0XHRpZiAodmlzaWJsZUl0ZW1zLmxlbmd0aCA9PT0gMCAmJiB0aGlzLmRlZmF1bHRJdGVtKSB7XG5cdFx0XHRyZXR1cm4gW3RoaXMuZGVmYXVsdEl0ZW0uZGVzY3JpcHRvcl07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHZpc2libGVJdGVtcy5tYXAodiA9PiB2LmRlc2NyaXB0b3IpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgVmlld1BhbmUgZXh0ZW5kcyBQYW5lIGltcGxlbWVudHMgSVZpZXcge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEFsd2F5c1Nob3dBY3Rpb25zQ29uZmlnID0gJ3dvcmtiZW5jaC52aWV3LmFsd2F5c1Nob3dIZWFkZXJBY3Rpb25zJztcblxuXHRwcml2YXRlIF9vbkRpZEZvY3VzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRm9jdXM6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRGb2N1cy5ldmVudDtcblxuXHRwcml2YXRlIF9vbkRpZEJsdXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRCbHVyOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQmx1ci5ldmVudDtcblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZUJvZHlWaXNpYmlsaXR5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8Ym9vbGVhbj4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQm9keVZpc2liaWxpdHk6IEV2ZW50PGJvb2xlYW4+ID0gdGhpcy5fb25EaWRDaGFuZ2VCb2R5VmlzaWJpbGl0eS5ldmVudDtcblxuXHRwcm90ZWN0ZWQgX29uRGlkQ2hhbmdlVGl0bGVBcmVhID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVGl0bGVBcmVhOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlVGl0bGVBcmVhLmV2ZW50O1xuXG5cdHByb3RlY3RlZCBfb25EaWRDaGFuZ2VWaWV3V2VsY29tZVN0YXRlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVmlld1dlbGNvbWVTdGF0ZTogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZVZpZXdXZWxjb21lU3RhdGUuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfaXNWaXNpYmxlOiBib29sZWFuID0gZmFsc2U7XG5cdHJlYWRvbmx5IGlkOiBzdHJpbmc7XG5cblx0cHJpdmF0ZSBfdGl0bGU6IHN0cmluZztcblx0cHVibGljIGdldCB0aXRsZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl90aXRsZTtcblx0fVxuXG5cdHByaXZhdGUgX3RpdGxlRGVzY3JpcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHVibGljIGdldCB0aXRsZURlc2NyaXB0aW9uKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3RpdGxlRGVzY3JpcHRpb247XG5cdH1cblxuXHRwcml2YXRlIF9zaW5nbGVWaWV3UGFuZUNvbnRhaW5lclRpdGxlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHB1YmxpYyBnZXQgc2luZ2xlVmlld1BhbmVDb250YWluZXJUaXRsZSgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9zaW5nbGVWaWV3UGFuZUNvbnRhaW5lclRpdGxlO1xuXHR9XG5cblx0cmVhZG9ubHkgbWVudUFjdGlvbnM6IENvbXBvc2l0ZU1lbnVBY3Rpb25zO1xuXG5cdHByaXZhdGUgcHJvZ3Jlc3NCYXIhOiBQcm9ncmVzc0Jhcjtcblx0cHJpdmF0ZSBwcm9ncmVzc0luZGljYXRvciE6IElQcm9ncmVzc0luZGljYXRvcjtcblxuXHRwcml2YXRlIHRvb2xiYXI/OiBXb3JrYmVuY2hUb29sQmFyO1xuXHRwcml2YXRlIHJlYWRvbmx5IHNob3dBY3Rpb25zOiBWaWV3UGFuZVNob3dBY3Rpb25zO1xuXHRwcml2YXRlIGhlYWRlckNvbnRhaW5lcj86IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHRpdGxlQ29udGFpbmVyPzogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgdGl0bGVDb250YWluZXJIb3Zlcj86IElNYW5hZ2VkSG92ZXI7XG5cdHByaXZhdGUgdGl0bGVEZXNjcmlwdGlvbkNvbnRhaW5lcj86IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHRpdGxlRGVzY3JpcHRpb25Db250YWluZXJIb3Zlcj86IElNYW5hZ2VkSG92ZXI7XG5cdHByaXZhdGUgaWNvbkNvbnRhaW5lcj86IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIGljb25Db250YWluZXJIb3Zlcj86IElNYW5hZ2VkSG92ZXI7XG5cdHByb3RlY3RlZCB0d2lzdGllc0NvbnRhaW5lcj86IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHZpZXdXZWxjb21lQ29udHJvbGxlciE6IFZpZXdXZWxjb21lQ29udHJvbGxlcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGhlYWRlckFjdGlvblZpZXdJdGVtczogRGlzcG9zYWJsZU1hcDxzdHJpbmcsIElBY3Rpb25WaWV3SXRlbT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZU1hcCgpKTtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgc2NvcGVkQ29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRvcHRpb25zOiBJVmlld1BhbmVPcHRpb25zLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJvdGVjdGVkIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJvdGVjdGVkIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJvdGVjdGVkIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2UgcHJvdGVjdGVkIHZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByb3RlY3RlZCBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcm90ZWN0ZWQgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgcHJvdGVjdGVkIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBhY2Nlc3NpYmxlVmlld0luZm9ybWF0aW9uU2VydmljZT86IElBY2Nlc3NpYmxlVmlld0luZm9ybWF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcih7IC4uLm9wdGlvbnMsIC4uLnsgb3JpZW50YXRpb246IHZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3TG9jYXRpb25CeUlkKG9wdGlvbnMuaWQpID09PSBWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwgPyBPcmllbnRhdGlvbi5IT1JJWk9OVEFMIDogT3JpZW50YXRpb24uVkVSVElDQUwgfSB9KTtcblxuXHRcdHRoaXMuaWQgPSBvcHRpb25zLmlkO1xuXHRcdHRoaXMuX3RpdGxlID0gb3B0aW9ucy50aXRsZTtcblx0XHR0aGlzLl90aXRsZURlc2NyaXB0aW9uID0gb3B0aW9ucy50aXRsZURlc2NyaXB0aW9uO1xuXHRcdHRoaXMuX3NpbmdsZVZpZXdQYW5lQ29udGFpbmVyVGl0bGUgPSBvcHRpb25zLnNpbmdsZVZpZXdQYW5lQ29udGFpbmVyVGl0bGU7XG5cdFx0dGhpcy5zaG93QWN0aW9ucyA9IG9wdGlvbnMuc2hvd0FjdGlvbnMgPz8gVmlld1BhbmVTaG93QWN0aW9ucy5EZWZhdWx0O1xuXG5cdFx0dGhpcy5zY29wZWRDb250ZXh0S2V5U2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKGNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZCh0aGlzLmVsZW1lbnQpKTtcblx0XHR0aGlzLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZUtleSgndmlldycsIHRoaXMuaWQpO1xuXHRcdGNvbnN0IHZpZXdMb2NhdGlvbktleSA9IHRoaXMuc2NvcGVkQ29udGV4dEtleVNlcnZpY2UuY3JlYXRlS2V5KCd2aWV3TG9jYXRpb24nLCBWaWV3Q29udGFpbmVyTG9jYXRpb25Ub1N0cmluZyh2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0xvY2F0aW9uQnlJZCh0aGlzLmlkKSEpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5maWx0ZXIodmlld0Rlc2NyaXB0b3JTZXJ2aWNlLm9uRGlkQ2hhbmdlTG9jYXRpb24sIGUgPT4gZS52aWV3cy5zb21lKHZpZXcgPT4gdmlldy5pZCA9PT0gdGhpcy5pZCkpKCgpID0+IHZpZXdMb2NhdGlvbktleS5zZXQoVmlld0NvbnRhaW5lckxvY2F0aW9uVG9TdHJpbmcodmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdMb2NhdGlvbkJ5SWQodGhpcy5pZCkhKSkpKTtcblxuXHRcdGNvbnN0IGNoaWxkSW5zdGFudGlhdGlvblNlcnZpY2UgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUNoaWxkKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihbSUNvbnRleHRLZXlTZXJ2aWNlLCB0aGlzLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlXSkpKTtcblx0XHR0aGlzLm1lbnVBY3Rpb25zID0gdGhpcy5fcmVnaXN0ZXIoY2hpbGRJbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb21wb3NpdGVNZW51QWN0aW9ucywgb3B0aW9ucy50aXRsZU1lbnVJZCA/PyBNZW51SWQuVmlld1RpdGxlLCBNZW51SWQuVmlld1RpdGxlQ29udGV4dCwgeyBzaG91bGRGb3J3YXJkQXJnczogIW9wdGlvbnMuZG9ub3RGb3J3YXJkQXJncywgcmVuZGVyU2hvcnRUaXRsZTogdHJ1ZSB9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5tZW51QWN0aW9ucy5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLnVwZGF0ZUFjdGlvbnMoKSkpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0IGhlYWRlclZpc2libGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHN1cGVyLmhlYWRlclZpc2libGU7XG5cdH1cblxuXHRvdmVycmlkZSBzZXQgaGVhZGVyVmlzaWJsZSh2aXNpYmxlOiBib29sZWFuKSB7XG5cdFx0c3VwZXIuaGVhZGVyVmlzaWJsZSA9IHZpc2libGU7XG5cdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ21lcmdlZC1oZWFkZXInLCAhdmlzaWJsZSk7XG5cdH1cblxuXHRzZXRWaXNpYmxlKHZpc2libGU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNWaXNpYmxlICE9PSB2aXNpYmxlKSB7XG5cdFx0XHR0aGlzLl9pc1Zpc2libGUgPSB2aXNpYmxlO1xuXG5cdFx0XHRpZiAodGhpcy5pc0V4cGFuZGVkKCkpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VCb2R5VmlzaWJpbGl0eS5maXJlKHZpc2libGUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGlzVmlzaWJsZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faXNWaXNpYmxlO1xuXHR9XG5cblx0aXNCb2R5VmlzaWJsZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faXNWaXNpYmxlICYmIHRoaXMuaXNFeHBhbmRlZCgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2V0RXhwYW5kZWQoZXhwYW5kZWQ6IGJvb2xlYW4pOiBib29sZWFuIHtcblx0XHRjb25zdCBjaGFuZ2VkID0gc3VwZXIuc2V0RXhwYW5kZWQoZXhwYW5kZWQpO1xuXHRcdGlmIChjaGFuZ2VkKSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUJvZHlWaXNpYmlsaXR5LmZpcmUoZXhwYW5kZWQpO1xuXHRcdH1cblx0XHR0aGlzLnVwZGF0ZVR3aXN0eUljb24oKTtcblx0XHRyZXR1cm4gY2hhbmdlZDtcblx0fVxuXG5cdG92ZXJyaWRlIHJlbmRlcigpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXIoKTtcblxuXHRcdGNvbnN0IGZvY3VzVHJhY2tlciA9IHRyYWNrRm9jdXModGhpcy5lbGVtZW50KTtcblx0XHR0aGlzLl9yZWdpc3Rlcihmb2N1c1RyYWNrZXIpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGZvY3VzVHJhY2tlci5vbkRpZEZvY3VzKCgpID0+IHRoaXMuX29uRGlkRm9jdXMuZmlyZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZm9jdXNUcmFja2VyLm9uRGlkQmx1cigoKSA9PiB0aGlzLl9vbkRpZEJsdXIuZmlyZSgpKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgcmVuZGVySGVhZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLmhlYWRlckNvbnRhaW5lciA9IGNvbnRhaW5lcjtcblxuXHRcdHRoaXMudHdpc3RpZXNDb250YWluZXIgPSBhcHBlbmQoY29udGFpbmVyLCAkKGAudHdpc3R5LWNvbnRhaW5lciR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IodGhpcy5nZXRUd2lzdHlJY29uKHRoaXMuaXNFeHBhbmRlZCgpKSl9YCkpO1xuXG5cdFx0dGhpcy5yZW5kZXJIZWFkZXJUaXRsZShjb250YWluZXIsIHRoaXMudGl0bGUpO1xuXG5cdFx0Y29uc3QgYWN0aW9ucyA9IGFwcGVuZChjb250YWluZXIsICQoJy5hY3Rpb25zJykpO1xuXHRcdGFjdGlvbnMuY2xhc3NMaXN0LnRvZ2dsZSgnc2hvdy1hbHdheXMnLCB0aGlzLnNob3dBY3Rpb25zID09PSBWaWV3UGFuZVNob3dBY3Rpb25zLkFsd2F5cyk7XG5cdFx0YWN0aW9ucy5jbGFzc0xpc3QudG9nZ2xlKCdzaG93LWV4cGFuZGVkJywgdGhpcy5zaG93QWN0aW9ucyA9PT0gVmlld1BhbmVTaG93QWN0aW9ucy5XaGVuRXhwYW5kZWQpO1xuXHRcdHRoaXMudG9vbGJhciA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya2JlbmNoVG9vbEJhciwgYWN0aW9ucywge1xuXHRcdFx0b3JpZW50YXRpb246IEFjdGlvbnNPcmllbnRhdGlvbi5IT1JJWk9OVEFMLFxuXHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogKGFjdGlvbiwgb3B0aW9ucykgPT4ge1xuXHRcdFx0XHRjb25zdCBpdGVtID0gdGhpcy5jcmVhdGVBY3Rpb25WaWV3SXRlbShhY3Rpb24sIG9wdGlvbnMpO1xuXHRcdFx0XHRpZiAoaXRlbSkge1xuXHRcdFx0XHRcdHRoaXMuaGVhZGVyQWN0aW9uVmlld0l0ZW1zLnNldChpdGVtLmFjdGlvbi5pZCwgaXRlbSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGl0ZW07XG5cdFx0XHR9LFxuXHRcdFx0YXJpYUxhYmVsOiBubHMubG9jYWxpemUoJ3ZpZXdUb29sYmFyQXJpYUxhYmVsJywgXCJ7MH0gYWN0aW9uc1wiLCB0aGlzLnRpdGxlKSxcblx0XHRcdGdldEtleUJpbmRpbmc6IGFjdGlvbiA9PiB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoYWN0aW9uLmlkKSxcblx0XHRcdHJlbmRlckRyb3Bkb3duQXNDaGlsZEVsZW1lbnQ6IHRydWUsXG5cdFx0XHRhY3Rpb25SdW5uZXI6IHRoaXMuZ2V0QWN0aW9uUnVubmVyKCksXG5cdFx0XHRyZXNldE1lbnU6IHRoaXMubWVudUFjdGlvbnMubWVudUlkXG5cdFx0fSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRvb2xiYXIpO1xuXHRcdHRoaXMuc2V0QWN0aW9ucygpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGFjdGlvbnMsIEV2ZW50VHlwZS5DTElDSywgZSA9PiBlLnByZXZlbnREZWZhdWx0KCkpKTtcblxuXHRcdGNvbnN0IHZpZXdDb250YWluZXJNb2RlbCA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJCeVZpZXdJZCh0aGlzLmlkKTtcblx0XHRpZiAodmlld0NvbnRhaW5lck1vZGVsKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyTW9kZWwodmlld0NvbnRhaW5lck1vZGVsKS5vbkRpZENoYW5nZUNvbnRhaW5lckluZm8oKHsgdGl0bGUgfSkgPT4gdGhpcy51cGRhdGVUaXRsZSh0aGlzLnRpdGxlKSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKGBWaWV3IGNvbnRhaW5lciBtb2RlbCBub3QgZm91bmQgZm9yIHZpZXcgJHt0aGlzLmlkfWApO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9uRGlkUmVsZXZhbnRDb25maWd1cmF0aW9uQ2hhbmdlID0gRXZlbnQuZmlsdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLCBlID0+IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVmlld1BhbmUuQWx3YXlzU2hvd0FjdGlvbnNDb25maWcpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihvbkRpZFJlbGV2YW50Q29uZmlndXJhdGlvbkNoYW5nZSh0aGlzLnVwZGF0ZUFjdGlvbnNWaXNpYmlsaXR5LCB0aGlzKSk7XG5cdFx0dGhpcy51cGRhdGVBY3Rpb25zVmlzaWJpbGl0eSgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHVwZGF0ZUhlYWRlcigpOiB2b2lkIHtcblx0XHRzdXBlci51cGRhdGVIZWFkZXIoKTtcblx0XHR0aGlzLnVwZGF0ZVR3aXN0eUljb24oKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlVHdpc3R5SWNvbigpOiB2b2lkIHtcblx0XHRpZiAodGhpcy50d2lzdGllc0NvbnRhaW5lcikge1xuXHRcdFx0dGhpcy50d2lzdGllc0NvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KHRoaXMuZ2V0VHdpc3R5SWNvbighdGhpcy5fZXhwYW5kZWQpKSk7XG5cdFx0XHR0aGlzLnR3aXN0aWVzQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkodGhpcy5nZXRUd2lzdHlJY29uKHRoaXMuX2V4cGFuZGVkKSkpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBnZXRUd2lzdHlJY29uKGV4cGFuZGVkOiBib29sZWFuKTogVGhlbWVJY29uIHtcblx0XHRyZXR1cm4gZXhwYW5kZWQgPyB2aWV3UGFuZUNvbnRhaW5lckV4cGFuZGVkSWNvbiA6IHZpZXdQYW5lQ29udGFpbmVyQ29sbGFwc2VkSWNvbjtcblx0fVxuXG5cdG92ZXJyaWRlIHN0eWxlKHN0eWxlczogSVBhbmVTdHlsZXMpOiB2b2lkIHtcblx0XHRzdXBlci5zdHlsZShzdHlsZXMpO1xuXG5cdFx0Y29uc3QgaWNvbiA9IHRoaXMuZ2V0SWNvbigpO1xuXHRcdGlmICh0aGlzLmljb25Db250YWluZXIpIHtcblx0XHRcdGNvbnN0IGZnQ29sb3IgPSBhc0Nzc1ZhbHVlV2l0aERlZmF1bHQoc3R5bGVzLmhlYWRlckZvcmVncm91bmQsIGFzQ3NzVmFyaWFibGUoZm9yZWdyb3VuZCkpO1xuXHRcdFx0aWYgKFVSSS5pc1VyaShpY29uKSkge1xuXHRcdFx0XHQvLyBBcHBseSBiYWNrZ3JvdW5kIGNvbG9yIHRvIGFjdGl2aXR5IGJhciBpdGVtIHByb3ZpZGVkIHdpdGggaWNvblVybHNcblx0XHRcdFx0dGhpcy5pY29uQ29udGFpbmVyLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGZnQ29sb3I7XG5cdFx0XHRcdHRoaXMuaWNvbkNvbnRhaW5lci5zdHlsZS5jb2xvciA9ICcnO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gQXBwbHkgZm9yZWdyb3VuZCBjb2xvciB0byBhY3Rpdml0eSBiYXIgaXRlbXMgcHJvdmlkZWQgd2l0aCBjb2RpY29uc1xuXHRcdFx0XHR0aGlzLmljb25Db250YWluZXIuc3R5bGUuY29sb3IgPSBmZ0NvbG9yO1xuXHRcdFx0XHR0aGlzLmljb25Db250YWluZXIuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyc7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRJY29uKCk6IFRoZW1lSWNvbiB8IFVSSSB7XG5cdFx0cmV0dXJuIHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdEZXNjcmlwdG9yQnlJZCh0aGlzLmlkKT8uY29udGFpbmVySWNvbiB8fCBkZWZhdWx0Vmlld0ljb247XG5cdH1cblxuXHRwcm90ZWN0ZWQgcmVuZGVySGVhZGVyVGl0bGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgdGl0bGU6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuaWNvbkNvbnRhaW5lciA9IGFwcGVuZChjb250YWluZXIsICQoJy5pY29uJywgdW5kZWZpbmVkKSk7XG5cdFx0Y29uc3QgaWNvbiA9IHRoaXMuZ2V0SWNvbigpO1xuXG5cdFx0bGV0IGNzc0NsYXNzOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKFVSSS5pc1VyaShpY29uKSkge1xuXHRcdFx0Y3NzQ2xhc3MgPSBgdmlldy0ke3RoaXMuaWQucmVwbGFjZSgvW1xcLlxcOl0vZywgJy0nKX1gO1xuXHRcdFx0Y29uc3QgaWNvbkNsYXNzID0gYC5wYW5lLWhlYWRlciAuaWNvbi4ke2Nzc0NsYXNzfWA7XG5cblx0XHRcdGNyZWF0ZUNTU1J1bGUoaWNvbkNsYXNzLCBgXG5cdFx0XHRcdG1hc2s6ICR7YXNDU1NVcmwoaWNvbil9IG5vLXJlcGVhdCA1MCUgNTAlO1xuXHRcdFx0XHRtYXNrLXNpemU6IDI0cHg7XG5cdFx0XHRcdC13ZWJraXQtbWFzazogJHthc0NTU1VybChpY29uKX0gbm8tcmVwZWF0IDUwJSA1MCU7XG5cdFx0XHRcdC13ZWJraXQtbWFzay1zaXplOiAxNnB4O1xuXHRcdFx0YCk7XG5cdFx0fSBlbHNlIGlmIChUaGVtZUljb24uaXNUaGVtZUljb24oaWNvbikpIHtcblx0XHRcdGNzc0NsYXNzID0gVGhlbWVJY29uLmFzQ2xhc3NOYW1lKGljb24pO1xuXHRcdH1cblxuXHRcdGlmIChjc3NDbGFzcykge1xuXHRcdFx0dGhpcy5pY29uQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoLi4uY3NzQ2xhc3Muc3BsaXQoJyAnKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2FsY3VsYXRlZFRpdGxlID0gdGhpcy5jYWxjdWxhdGVUaXRsZSh0aXRsZSk7XG5cdFx0dGhpcy50aXRsZUNvbnRhaW5lciA9IGFwcGVuZChjb250YWluZXIsICQoJ2gzLnRpdGxlJywge30sIGNhbGN1bGF0ZWRUaXRsZSkpO1xuXHRcdHRoaXMudGl0bGVDb250YWluZXJIb3ZlciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCB0aGlzLnRpdGxlQ29udGFpbmVyLCBjYWxjdWxhdGVkVGl0bGUpKTtcblxuXHRcdGlmICh0aGlzLl90aXRsZURlc2NyaXB0aW9uKSB7XG5cdFx0XHR0aGlzLnNldFRpdGxlRGVzY3JpcHRpb24odGhpcy5fdGl0bGVEZXNjcmlwdGlvbik7XG5cdFx0fVxuXG5cdFx0dGhpcy5pY29uQ29udGFpbmVySG92ZXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgdGhpcy5pY29uQ29udGFpbmVyLCBjYWxjdWxhdGVkVGl0bGUpKTtcblx0XHR0aGlzLmljb25Db250YWluZXIuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgdGhpcy5fZ2V0QXJpYUxhYmVsKGNhbGN1bGF0ZWRUaXRsZSwgdGhpcy5fdGl0bGVEZXNjcmlwdGlvbikpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0QXJpYUxhYmVsKHRpdGxlOiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBzdHJpbmcge1xuXHRcdGNvbnN0IHZpZXdIYXNBY2Nlc3NpYmlsaXR5SGVscENvbnRlbnQgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3RGVzY3JpcHRvckJ5SWQodGhpcy5pZCk/LmFjY2Vzc2liaWxpdHlIZWxwQ29udGVudDtcblx0XHRjb25zdCBhY2Nlc3NpYmxlVmlld0hhc1Nob3duRm9yVmlldyA9IHRoaXMuYWNjZXNzaWJsZVZpZXdJbmZvcm1hdGlvblNlcnZpY2U/Lmhhc1Nob3duQWNjZXNzaWJsZVZpZXcodGhpcy5pZCk7XG5cdFx0aWYgKCF2aWV3SGFzQWNjZXNzaWJpbGl0eUhlbHBDb250ZW50IHx8IGFjY2Vzc2libGVWaWV3SGFzU2hvd25Gb3JWaWV3KSB7XG5cdFx0XHRpZiAoZGVzY3JpcHRpb24pIHtcblx0XHRcdFx0cmV0dXJuIGAke3RpdGxlfSAtICR7ZGVzY3JpcHRpb259YDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiB0aXRsZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCd2aWV3QWNjZXNzaWJpbGl0eUhlbHAnLCAnVXNlIEFsdCtGMSBmb3IgYWNjZXNzaWJpbGl0eSBoZWxwIHswfScsIHRpdGxlKTtcblx0fVxuXG5cdHByb3RlY3RlZCB1cGRhdGVUaXRsZSh0aXRsZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgY2FsY3VsYXRlZFRpdGxlID0gdGhpcy5jYWxjdWxhdGVUaXRsZSh0aXRsZSk7XG5cdFx0aWYgKHRoaXMudGl0bGVDb250YWluZXIpIHtcblx0XHRcdHRoaXMudGl0bGVDb250YWluZXIudGV4dENvbnRlbnQgPSBjYWxjdWxhdGVkVGl0bGU7XG5cdFx0XHR0aGlzLnRpdGxlQ29udGFpbmVySG92ZXI/LnVwZGF0ZShjYWxjdWxhdGVkVGl0bGUpO1xuXHRcdH1cblxuXHRcdHRoaXMudXBkYXRlQXJpYUhlYWRlckxhYmVsKGNhbGN1bGF0ZWRUaXRsZSwgdGhpcy5fdGl0bGVEZXNjcmlwdGlvbik7XG5cblx0XHR0aGlzLl90aXRsZSA9IHRpdGxlO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlVGl0bGVBcmVhLmZpcmUoKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQXJpYUhlYWRlckxhYmVsKHRpdGxlOiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQpIHtcblx0XHRjb25zdCBhcmlhTGFiZWwgPSB0aGlzLl9nZXRBcmlhTGFiZWwodGl0bGUsIGRlc2NyaXB0aW9uKTtcblx0XHRpZiAodGhpcy5pY29uQ29udGFpbmVyKSB7XG5cdFx0XHR0aGlzLmljb25Db250YWluZXJIb3Zlcj8udXBkYXRlKHRpdGxlKTtcblx0XHRcdHRoaXMuaWNvbkNvbnRhaW5lci5zZXRBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnLCBhcmlhTGFiZWwpO1xuXHRcdH1cblx0XHR0aGlzLmFyaWFIZWFkZXJMYWJlbCA9IHRoaXMuZ2V0QXJpYUhlYWRlckxhYmVsKGFyaWFMYWJlbCk7XG5cdH1cblxuXHRwcml2YXRlIHNldFRpdGxlRGVzY3JpcHRpb24oZGVzY3JpcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdGlmICh0aGlzLnRpdGxlRGVzY3JpcHRpb25Db250YWluZXIpIHtcblx0XHRcdHRoaXMudGl0bGVEZXNjcmlwdGlvbkNvbnRhaW5lci50ZXh0Q29udGVudCA9IGRlc2NyaXB0aW9uID8/ICcnO1xuXHRcdFx0dGhpcy50aXRsZURlc2NyaXB0aW9uQ29udGFpbmVySG92ZXI/LnVwZGF0ZShkZXNjcmlwdGlvbiA/PyAnJyk7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKGRlc2NyaXB0aW9uICYmIHRoaXMudGl0bGVDb250YWluZXIpIHtcblx0XHRcdHRoaXMudGl0bGVEZXNjcmlwdGlvbkNvbnRhaW5lciA9IGFmdGVyKHRoaXMudGl0bGVDb250YWluZXIsICQoJ3NwYW4uZGVzY3JpcHRpb24nLCB7fSwgZGVzY3JpcHRpb24pKTtcblx0XHRcdHRoaXMudGl0bGVEZXNjcmlwdGlvbkNvbnRhaW5lckhvdmVyID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ21vdXNlJyksIHRoaXMudGl0bGVEZXNjcmlwdGlvbkNvbnRhaW5lciwgZGVzY3JpcHRpb24pKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgdXBkYXRlVGl0bGVEZXNjcmlwdGlvbihkZXNjcmlwdGlvbj86IHN0cmluZyB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuc2V0VGl0bGVEZXNjcmlwdGlvbihkZXNjcmlwdGlvbik7XG5cdFx0dGhpcy51cGRhdGVBcmlhSGVhZGVyTGFiZWwodGhpcy5fdGl0bGUsIGRlc2NyaXB0aW9uKTtcblx0XHR0aGlzLl90aXRsZURlc2NyaXB0aW9uID0gZGVzY3JpcHRpb247XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VUaXRsZUFyZWEuZmlyZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBjYWxjdWxhdGVUaXRsZSh0aXRsZTogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRjb25zdCB2aWV3Q29udGFpbmVyID0gdGhpcy52aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5Vmlld0lkKHRoaXMuaWQpITtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdDb250YWluZXJNb2RlbCh2aWV3Q29udGFpbmVyKTtcblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvciA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdEZXNjcmlwdG9yQnlJZCh0aGlzLmlkKTtcblx0XHRjb25zdCBpc0RlZmF1bHQgPSB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXREZWZhdWx0Q29udGFpbmVyQnlJZCh0aGlzLmlkKSA9PT0gdmlld0NvbnRhaW5lcjtcblxuXHRcdGlmICghaXNEZWZhdWx0ICYmIHZpZXdEZXNjcmlwdG9yPy5jb250YWluZXJUaXRsZSAmJiBtb2RlbC50aXRsZSAhPT0gdmlld0Rlc2NyaXB0b3IuY29udGFpbmVyVGl0bGUpIHtcblx0XHRcdHJldHVybiBgJHt2aWV3RGVzY3JpcHRvci5jb250YWluZXJUaXRsZX06ICR7dGl0bGV9YDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGl0bGU7XG5cdH1cblxuXHRwcm90ZWN0ZWQgcmVuZGVyQm9keShjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy52aWV3V2VsY29tZUNvbnRyb2xsZXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFZpZXdXZWxjb21lQ29udHJvbGxlciwgY29udGFpbmVyLCB0aGlzKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgbGF5b3V0Qm9keShoZWlnaHQ6IG51bWJlciwgd2lkdGg6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMudmlld1dlbGNvbWVDb250cm9sbGVyLmxheW91dChoZWlnaHQsIHdpZHRoKTtcblx0fVxuXG5cdG9uRGlkU2Nyb2xsUm9vdCgpIHtcblx0XHQvLyBub29wXG5cdH1cblxuXHRnZXRQcm9ncmVzc0luZGljYXRvcigpIHtcblx0XHRpZiAodGhpcy5wcm9ncmVzc0JhciA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHQvLyBQcm9ncmVzcyBiYXJcblx0XHRcdHRoaXMucHJvZ3Jlc3NCYXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgUHJvZ3Jlc3NCYXIodGhpcy5lbGVtZW50LCBkZWZhdWx0UHJvZ3Jlc3NCYXJTdHlsZXMpKTtcblx0XHRcdHRoaXMucHJvZ3Jlc3NCYXIuaGlkZSgpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnByb2dyZXNzSW5kaWNhdG9yID09PSB1bmRlZmluZWQpIHtcblx0XHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdFx0dGhpcy5wcm9ncmVzc0luZGljYXRvciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBTY29wZWRQcm9ncmVzc0luZGljYXRvcihhc3NlcnRJc0RlZmluZWQodGhpcy5wcm9ncmVzc0JhciksIG5ldyBjbGFzcyBleHRlbmRzIEFic3RyYWN0UHJvZ3Jlc3NTY29wZSB7XG5cdFx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRcdHN1cGVyKHRoYXQuaWQsIHRoYXQuaXNCb2R5VmlzaWJsZSgpKTtcblx0XHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGF0Lm9uRGlkQ2hhbmdlQm9keVZpc2liaWxpdHkoaXNWaXNpYmxlID0+IGlzVmlzaWJsZSA/IHRoaXMub25TY29wZU9wZW5lZCh0aGF0LmlkKSA6IHRoaXMub25TY29wZUNsb3NlZCh0aGF0LmlkKSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KCkpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMucHJvZ3Jlc3NJbmRpY2F0b3I7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0UHJvZ3Jlc3NMb2NhdGlvbigpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3Q29udGFpbmVyQnlWaWV3SWQodGhpcy5pZCkhLmlkO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldExvY2F0aW9uQmFzZWRDb2xvcnMoKTogSVZpZXdQYW5lTG9jYXRpb25Db2xvcnMge1xuXHRcdHJldHVybiBnZXRMb2NhdGlvbkJhc2VkVmlld0NvbG9ycyh0aGlzLnZpZXdEZXNjcmlwdG9yU2VydmljZS5nZXRWaWV3TG9jYXRpb25CeUlkKHRoaXMuaWQpKTtcblx0fVxuXG5cdGZvY3VzKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnZpZXdXZWxjb21lQ29udHJvbGxlci5lbmFibGVkKSB7XG5cdFx0XHR0aGlzLnZpZXdXZWxjb21lQ29udHJvbGxlci5mb2N1cygpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5lbGVtZW50KSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQuZm9jdXMoKTtcblx0XHR9XG5cdFx0aWYgKGlzQWN0aXZlRWxlbWVudCh0aGlzLmVsZW1lbnQpIHx8IGlzQW5jZXN0b3JPZkFjdGl2ZUVsZW1lbnQodGhpcy5lbGVtZW50KSkge1xuXHRcdFx0dGhpcy5fb25EaWRGb2N1cy5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzZXRBY3Rpb25zKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnRvb2xiYXIpIHtcblx0XHRcdGNvbnN0IHByaW1hcnlBY3Rpb25zID0gWy4uLnRoaXMubWVudUFjdGlvbnMuZ2V0UHJpbWFyeUFjdGlvbnMoKV07XG5cdFx0XHRpZiAodGhpcy5zaG91bGRTaG93RmlsdGVySW5IZWFkZXIoKSkge1xuXHRcdFx0XHRwcmltYXJ5QWN0aW9ucy51bnNoaWZ0KFZJRVdQQU5FX0ZJTFRFUl9BQ1RJT04pO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy50b29sYmFyLnNldEFjdGlvbnMocHJlcGFyZUFjdGlvbnMocHJpbWFyeUFjdGlvbnMpLCBwcmVwYXJlQWN0aW9ucyh0aGlzLm1lbnVBY3Rpb25zLmdldFNlY29uZGFyeUFjdGlvbnMoKSkpO1xuXHRcdFx0dGhpcy50b29sYmFyLmNvbnRleHQgPSB0aGlzLmdldEFjdGlvbnNDb250ZXh0KCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVBY3Rpb25zVmlzaWJpbGl0eSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuaGVhZGVyQ29udGFpbmVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHNob3VsZEFsd2F5c1Nob3dBY3Rpb25zID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignd29ya2JlbmNoLnZpZXcuYWx3YXlzU2hvd0hlYWRlckFjdGlvbnMnKTtcblx0XHR0aGlzLmhlYWRlckNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdhY3Rpb25zLWFsd2F5cy12aXNpYmxlJywgc2hvdWxkQWx3YXlzU2hvd0FjdGlvbnMpO1xuXHR9XG5cblx0cHJvdGVjdGVkIHVwZGF0ZUFjdGlvbnMoKTogdm9pZCB7XG5cdFx0dGhpcy5zZXRBY3Rpb25zKCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VUaXRsZUFyZWEuZmlyZSgpO1xuXHR9XG5cblx0Y3JlYXRlQWN0aW9uVmlld0l0ZW0oYWN0aW9uOiBJQWN0aW9uLCBvcHRpb25zPzogSURyb3Bkb3duTWVudUFjdGlvblZpZXdJdGVtT3B0aW9ucyk6IElBY3Rpb25WaWV3SXRlbSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKGFjdGlvbi5pZCA9PT0gVklFV1BBTkVfRklMVEVSX0FDVElPTi5pZCkge1xuXHRcdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0XHRyZXR1cm4gbmV3IGNsYXNzIGV4dGVuZHMgQmFzZUFjdGlvblZpZXdJdGVtIHtcblx0XHRcdFx0Y29uc3RydWN0b3IoKSB7IHN1cGVyKG51bGwsIGFjdGlvbik7IH1cblx0XHRcdFx0b3ZlcnJpZGUgc2V0Rm9jdXNhYmxlKCk6IHZvaWQgeyAvKiBub29wIGlucHV0IGVsZW1lbnRzIGFyZSBmb2N1c2FibGUgYnkgZGVmYXVsdCAqLyB9XG5cdFx0XHRcdG92ZXJyaWRlIGdldCB0cmFwc0Fycm93TmF2aWdhdGlvbigpOiBib29sZWFuIHsgcmV0dXJuIHRydWU7IH1cblx0XHRcdFx0b3ZlcnJpZGUgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRcdFx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgndmlld3BhbmUtZmlsdGVyLWNvbnRhaW5lcicpO1xuXHRcdFx0XHRcdGNvbnN0IGZpbHRlciA9IHRoYXQuZ2V0RmlsdGVyV2lkZ2V0KCkhO1xuXHRcdFx0XHRcdGFwcGVuZChjb250YWluZXIsIGZpbHRlci5lbGVtZW50KTtcblx0XHRcdFx0XHRmaWx0ZXIucmVsYXlvdXQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cdFx0cmV0dXJuIGNyZWF0ZUFjdGlvblZpZXdJdGVtKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UsIGFjdGlvbiwgeyAuLi5vcHRpb25zLCAuLi57IG1lbnVBc0NoaWxkOiBhY3Rpb24gaW5zdGFuY2VvZiBTdWJtZW51SXRlbUFjdGlvbiB9IH0pO1xuXHR9XG5cblx0Z2V0QWN0aW9uc0NvbnRleHQoKTogdW5rbm93biB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGdldEFjdGlvblJ1bm5lcigpOiBJQWN0aW9uUnVubmVyIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0T3B0aW1hbFdpZHRoKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIDA7XG5cdH1cblxuXHRzYXZlU3RhdGUoKTogdm9pZCB7XG5cdFx0Ly8gU3ViY2xhc3NlcyB0byBpbXBsZW1lbnQgZm9yIHNhdmluZyBzdGF0ZVxuXHR9XG5cblx0c2hvdWxkU2hvd1dlbGNvbWUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Z2V0RmlsdGVyV2lkZ2V0KCk6IEZpbHRlcldpZGdldCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHNob3VsZFNob3dGaWx0ZXJJbkhlYWRlcigpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEZpbHRlclZpZXdQYW5lIGV4dGVuZHMgVmlld1BhbmUge1xuXG5cdHJlYWRvbmx5IGZpbHRlcldpZGdldDogRmlsdGVyV2lkZ2V0O1xuXHRwcml2YXRlIGRpbWVuc2lvbjogRGltZW5zaW9uIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGZpbHRlckNvbnRhaW5lcjogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0b3B0aW9uczogSUZpbHRlclZpZXdQYW5lT3B0aW9ucyxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2Ugdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRhY2Nlc3NpYmxlVmlld1NlcnZpY2U/OiBJQWNjZXNzaWJsZVZpZXdJbmZvcm1hdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIob3B0aW9ucywga2V5YmluZGluZ1NlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCB2aWV3RGVzY3JpcHRvclNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIGhvdmVyU2VydmljZSwgYWNjZXNzaWJsZVZpZXdTZXJ2aWNlKTtcblx0XHRjb25zdCBjaGlsZEluc3RhbnRpYXRpb25TZXJ2aWNlID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlQ2hpbGQobmV3IFNlcnZpY2VDb2xsZWN0aW9uKFtJQ29udGV4dEtleVNlcnZpY2UsIHRoaXMuc2NvcGVkQ29udGV4dEtleVNlcnZpY2VdKSkpO1xuXHRcdHRoaXMuZmlsdGVyV2lkZ2V0ID0gdGhpcy5fcmVnaXN0ZXIoY2hpbGRJbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShGaWx0ZXJXaWRnZXQsIG9wdGlvbnMuZmlsdGVyT3B0aW9ucykpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0RmlsdGVyV2lkZ2V0KCk6IEZpbHRlcldpZGdldCB7XG5cdFx0cmV0dXJuIHRoaXMuZmlsdGVyV2lkZ2V0O1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlbmRlckJvZHkoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlckJvZHkoY29udGFpbmVyKTtcblx0XHR0aGlzLmZpbHRlckNvbnRhaW5lciA9IGFwcGVuZChjb250YWluZXIsICQoJy52aWV3cGFuZS1maWx0ZXItY29udGFpbmVyJykpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGxheW91dEJvZHkoaGVpZ2h0OiBudW1iZXIsIHdpZHRoOiBudW1iZXIpOiB2b2lkIHtcblx0XHRzdXBlci5sYXlvdXRCb2R5KGhlaWdodCwgd2lkdGgpO1xuXG5cdFx0dGhpcy5kaW1lbnNpb24gPSBuZXcgRGltZW5zaW9uKHdpZHRoLCBoZWlnaHQpO1xuXHRcdGNvbnN0IHdhc0ZpbHRlclNob3duSW5IZWFkZXIgPSAhdGhpcy5maWx0ZXJDb250YWluZXI/Lmhhc0NoaWxkTm9kZXMoKTtcblx0XHRjb25zdCBzaG91bGRTaG93RmlsdGVySW5IZWFkZXIgPSB0aGlzLnNob3VsZFNob3dGaWx0ZXJJbkhlYWRlcigpO1xuXHRcdGlmICh3YXNGaWx0ZXJTaG93bkluSGVhZGVyICE9PSBzaG91bGRTaG93RmlsdGVySW5IZWFkZXIpIHtcblx0XHRcdGlmIChzaG91bGRTaG93RmlsdGVySW5IZWFkZXIpIHtcblx0XHRcdFx0cmVzZXQodGhpcy5maWx0ZXJDb250YWluZXIhKTtcblx0XHRcdH1cblx0XHRcdHRoaXMudXBkYXRlQWN0aW9ucygpO1xuXHRcdFx0aWYgKCFzaG91bGRTaG93RmlsdGVySW5IZWFkZXIpIHtcblx0XHRcdFx0YXBwZW5kKHRoaXMuZmlsdGVyQ29udGFpbmVyISwgdGhpcy5maWx0ZXJXaWRnZXQuZWxlbWVudCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICghc2hvdWxkU2hvd0ZpbHRlckluSGVhZGVyKSB7XG5cdFx0XHRoZWlnaHQgPSBoZWlnaHQgLSA0NDtcblx0XHR9XG5cdFx0dGhpcy5maWx0ZXJXaWRnZXQubGF5b3V0KHdpZHRoKTtcblx0XHR0aGlzLmxheW91dEJvZHlDb250ZW50KGhlaWdodCwgd2lkdGgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2hvdWxkU2hvd0ZpbHRlckluSGVhZGVyKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhKHRoaXMuZGltZW5zaW9uICYmIHRoaXMuZGltZW5zaW9uLndpZHRoIDwgNjAwICYmIHRoaXMuZGltZW5zaW9uLmhlaWdodCA+IDEwMCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgbGF5b3V0Qm9keUNvbnRlbnQoaGVpZ2h0OiBudW1iZXIsIHdpZHRoOiBudW1iZXIpOiB2b2lkO1xuXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVZpZXdQYW5lTG9jYXRpb25Db2xvcnMge1xuXHRiYWNrZ3JvdW5kOiBzdHJpbmc7XG5cdG92ZXJsYXlCYWNrZ3JvdW5kOiBzdHJpbmc7XG5cdGxpc3RPdmVycmlkZVN0eWxlczogUGFydGlhbEV4Y2VwdDxJTGlzdFN0eWxlcywgJ2xpc3RCYWNrZ3JvdW5kJyB8ICd0cmVlU3RpY2t5U2Nyb2xsQmFja2dyb3VuZCc+O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0TG9jYXRpb25CYXNlZFZpZXdDb2xvcnMobG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbiB8IG51bGwpOiBJVmlld1BhbmVMb2NhdGlvbkNvbG9ycyB7XG5cdGxldCBiYWNrZ3JvdW5kLCBvdmVybGF5QmFja2dyb3VuZCwgc3RpY2t5U2Nyb2xsQmFja2dyb3VuZCwgc3RpY2t5U2Nyb2xsQm9yZGVyLCBzdGlja3lTY3JvbGxTaGFkb3c7XG5cblx0c3dpdGNoIChsb2NhdGlvbikge1xuXHRcdGNhc2UgVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsOlxuXHRcdFx0YmFja2dyb3VuZCA9IFBBTkVMX0JBQ0tHUk9VTkQ7XG5cdFx0XHRvdmVybGF5QmFja2dyb3VuZCA9IFBBTkVMX1NFQ1RJT05fRFJBR19BTkRfRFJPUF9CQUNLR1JPVU5EO1xuXHRcdFx0c3RpY2t5U2Nyb2xsQmFja2dyb3VuZCA9IFBBTkVMX1NUSUNLWV9TQ1JPTExfQkFDS0dST1VORDtcblx0XHRcdHN0aWNreVNjcm9sbEJvcmRlciA9IFBBTkVMX1NUSUNLWV9TQ1JPTExfQk9SREVSO1xuXHRcdFx0c3RpY2t5U2Nyb2xsU2hhZG93ID0gUEFORUxfU1RJQ0tZX1NDUk9MTF9TSEFET1c7XG5cdFx0XHRicmVhaztcblxuXHRcdGNhc2UgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXI6XG5cdFx0Y2FzZSBWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyOlxuXHRcdGRlZmF1bHQ6XG5cdFx0XHRiYWNrZ3JvdW5kID0gU0lERV9CQVJfQkFDS0dST1VORDtcblx0XHRcdG92ZXJsYXlCYWNrZ3JvdW5kID0gU0lERV9CQVJfRFJBR19BTkRfRFJPUF9CQUNLR1JPVU5EO1xuXHRcdFx0c3RpY2t5U2Nyb2xsQmFja2dyb3VuZCA9IFNJREVfQkFSX1NUSUNLWV9TQ1JPTExfQkFDS0dST1VORDtcblx0XHRcdHN0aWNreVNjcm9sbEJvcmRlciA9IFNJREVfQkFSX1NUSUNLWV9TQ1JPTExfQk9SREVSO1xuXHRcdFx0c3RpY2t5U2Nyb2xsU2hhZG93ID0gU0lERV9CQVJfU1RJQ0tZX1NDUk9MTF9TSEFET1c7XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdGJhY2tncm91bmQsXG5cdFx0b3ZlcmxheUJhY2tncm91bmQsXG5cdFx0bGlzdE92ZXJyaWRlU3R5bGVzOiB7XG5cdFx0XHRsaXN0QmFja2dyb3VuZDogYmFja2dyb3VuZCxcblx0XHRcdHRyZWVTdGlja3lTY3JvbGxCYWNrZ3JvdW5kOiBzdGlja3lTY3JvbGxCYWNrZ3JvdW5kLFxuXHRcdFx0dHJlZVN0aWNreVNjcm9sbEJvcmRlcjogc3RpY2t5U2Nyb2xsQm9yZGVyLFxuXHRcdFx0dHJlZVN0aWNreVNjcm9sbFNoYWRvdzogc3RpY2t5U2Nyb2xsU2hhZG93XG5cdFx0fVxuXHR9O1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgVmlld0FjdGlvbjxUIGV4dGVuZHMgSVZpZXc+IGV4dGVuZHMgQWN0aW9uMiB7XG5cdG92ZXJyaWRlIHJlYWRvbmx5IGRlc2M6IFJlYWRvbmx5PElBY3Rpb24yT3B0aW9ucz4gJiB7IHZpZXdJZDogc3RyaW5nIH07XG5cdGNvbnN0cnVjdG9yKGRlc2M6IFJlYWRvbmx5PElBY3Rpb24yT3B0aW9ucz4gJiB7IHZpZXdJZDogc3RyaW5nIH0pIHtcblx0XHRzdXBlcihkZXNjKTtcblx0XHR0aGlzLmRlc2MgPSBkZXNjO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSk6IHVua25vd24ge1xuXHRcdGNvbnN0IHZpZXcgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSkuZ2V0QWN0aXZlVmlld1dpdGhJZCh0aGlzLmRlc2Mudmlld0lkKTtcblx0XHRpZiAodmlldykge1xuXHRcdFx0cmV0dXJuIHRoaXMucnVuSW5WaWV3KGFjY2Vzc29yLCA8VD52aWV3LCAuLi5hcmdzKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGFic3RyYWN0IHJ1bkluVmlldyhhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgdmlldzogVCwgLi4uYXJnczogYW55W10pOiB1bmtub3duO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsT0FBTyxlQUFlO0FBQy9CLFNBQVMsZUFBZSxrQkFBa0I7QUFDMUMsU0FBUyxPQUFPLFFBQVEsR0FBRyxZQUFZLFdBQVcsdUJBQXVCLFdBQVcsT0FBTywyQkFBMkIsdUJBQXVCO0FBQzdJLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsdUJBQXVCLGdCQUFnQjtBQUNoRCxTQUFTLGVBQWUsaUJBQWlCLG9CQUFvQjtBQUM3RCxTQUFTLGNBQXNDO0FBQy9DLFNBQVMsb0JBQXFDLHNCQUFzQjtBQUNwRSxTQUFT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
