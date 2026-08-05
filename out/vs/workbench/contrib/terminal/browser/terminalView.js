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
import * as nls from "../../../../nls.js";
import * as dom from "../../../../base/browser/dom.js";
import * as domStylesheetsJs from "../../../../base/browser/domStylesheets.js";
import * as cssJs from "../../../../base/browser/cssValue.js";
import { Action } from "../../../../base/common/actions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextMenuService, IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IThemeService, Themable } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { switchTerminalActionViewItemSeparator, switchTerminalShowTabsTitle } from "./terminalActions.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { ITerminalConfigurationService, ITerminalGroupService, ITerminalService, TerminalConnectionState, TerminalDataTransfers } from "./terminal.js";
import { ViewPane } from "../../../browser/parts/views/viewPane.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IMenuService, MenuId, MenuItemAction } from "../../../../platform/actions/common/actions.js";
import { ITerminalProfileResolverService, ITerminalProfileService, TerminalCommandId } from "../common/terminal.js";
import { TerminalSettingId, TerminalLocation } from "../../../../platform/terminal/common/terminal.js";
import { ActionViewItem, SelectActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { asCssVariable, selectBorder } from "../../../../platform/theme/common/colorRegistry.js";
import { TerminalTabbedView } from "./terminalTabbedView.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { getColorForSeverity } from "./terminalStatusList.js";
import { getFlatContextMenuActions, MenuEntryActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { DropdownWithPrimaryActionViewItem } from "../../../../platform/actions/browser/dropdownWithPrimaryActionViewItem.js";
import { DisposableMap, DisposableStore, dispose, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { ColorScheme } from "../../../../platform/theme/common/theme.js";
import { getColorClass, getUriClasses } from "./terminalIcon.js";
import { getTerminalActionBarArgs } from "./terminalMenus.js";
import { TerminalContextKeys } from "../common/terminalContextKey.js";
import { getInstanceHoverInfo } from "./terminalTooltip.js";
import { TerminalCapability } from "../../../../platform/terminal/common/capabilities/capabilities.js";
import { defaultSelectBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { Event } from "../../../../base/common/event.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { InstanceContext, TerminalContextActionRunner } from "./terminalContextMenu.js";
import { MicrotaskDelay } from "../../../../base/common/symbols.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
let TerminalViewPane = class extends ViewPane {
  constructor(options, keybindingService, _contextKeyService, viewDescriptorService, _configurationService, _contextMenuService, _instantiationService, _terminalService, _terminalConfigurationService, _terminalGroupService, themeService, hoverService, _notificationService, _keybindingService, openerService, _menuService, _terminalProfileService, _terminalProfileResolverService, _themeService, _accessibilityService) {
    super(options, keybindingService, _contextMenuService, _configurationService, _contextKeyService, viewDescriptorService, _instantiationService, openerService, themeService, hoverService);
    this._contextKeyService = _contextKeyService;
    this._configurationService = _configurationService;
    this._contextMenuService = _contextMenuService;
    this._instantiationService = _instantiationService;
    this._terminalService = _terminalService;
    this._terminalConfigurationService = _terminalConfigurationService;
    this._terminalGroupService = _terminalGroupService;
    this._notificationService = _notificationService;
    this._keybindingService = _keybindingService;
    this._menuService = _menuService;
    this._terminalProfileService = _terminalProfileService;
    this._terminalProfileResolverService = _terminalProfileResolverService;
    this._themeService = _themeService;
    this._accessibilityService = _accessibilityService;
    this._isInitialized = false;
    /**
     * Tracks an active promise of terminal creation requested by this component. This helps prevent
     * double creation for example when toggling a terminal's visibility and focusing it.
     */
    this._isTerminalBeingCreated = false;
    this._newDropdown = this._register(new MutableDisposable());
    this._disposableStore = this._register(new DisposableStore());
    this._actionDisposables = this._register(new DisposableMap());
    this._register(this._terminalService.onDidRegisterProcessSupport(() => {
      this._onDidChangeViewWelcomeState.fire();
    }));
    this._register(this._terminalService.onDidChangeInstances(() => {
      if (this._hasWelcomeScreen() && this._terminalGroupService.instances.length <= 1) {
        this._onDidChangeViewWelcomeState.fire();
      }
      if (!this._parentDomElement) {
        return;
      }
      if (!this._terminalTabbedView) {
        this._createTabsView();
      }
      if (this._terminalGroupService.instances.length === 1) {
        this.layoutBody(this._parentDomElement.offsetHeight, this._parentDomElement.offsetWidth);
      }
    }));
    this._dropdownMenu = this._register(this._menuService.createMenu(MenuId.TerminalNewDropdownContext, this._contextKeyService));
    this._singleTabMenu = this._register(this._menuService.createMenu(MenuId.TerminalTabContext, this._contextKeyService));
    this._register(this._terminalProfileService.onDidChangeAvailableProfiles((profiles) => this._updateTabActionBar(profiles)));
    this._viewShowing = TerminalContextKeys.viewShowing.bindTo(this._contextKeyService);
    this._register(this.onDidChangeBodyVisibility((e) => {
      if (e) {
        this._terminalTabbedView?.rerenderTabs();
      }
    }));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (this._parentDomElement && (e.affectsConfiguration(TerminalSettingId.ShellIntegrationDecorationsEnabled) || e.affectsConfiguration(TerminalSettingId.ShellIntegrationEnabled))) {
        this._updateForShellIntegration(this._parentDomElement);
      }
    }));
    const shellIntegrationDisposable = this._register(new MutableDisposable());
    shellIntegrationDisposable.value = this._terminalService.onAnyInstanceAddedCapabilityType((c) => {
      if (c === TerminalCapability.CommandDetection && this._gutterDecorationsEnabled()) {
        this._parentDomElement?.classList.add("shell-integration");
        shellIntegrationDisposable.clear();
      }
    });
  }
  get terminalTabbedView() {
    return this._terminalTabbedView;
  }
  _updateForShellIntegration(container) {
    container.classList.toggle("shell-integration", this._gutterDecorationsEnabled());
  }
  _gutterDecorationsEnabled() {
    const decorationsEnabled = this._configurationService.getValue(TerminalSettingId.ShellIntegrationDecorationsEnabled);
    return (decorationsEnabled === "both" || decorationsEnabled === "gutter") && this._configurationService.getValue(TerminalSettingId.ShellIntegrationEnabled);
  }
  _initializeTerminal(checkRestoredTerminals) {
    if (this.isBodyVisible() && this._terminalService.isProcessSupportRegistered && this._terminalService.connectionState === TerminalConnectionState.Connected) {
      const wasInitialized = this._isInitialized;
      this._isInitialized = true;
      let hideOnStartup = "never";
      if (!wasInitialized) {
        hideOnStartup = this._configurationService.getValue(TerminalSettingId.HideOnStartup);
        if (hideOnStartup === "always") {
          this._terminalGroupService.hidePanel();
        }
      }
      let shouldCreate = this._terminalGroupService.groups.length === 0;
      if (checkRestoredTerminals) {
        shouldCreate &&= this._terminalService.restoredGroupCount === 0;
      }
      if (!shouldCreate) {
        return;
      }
      if (!wasInitialized) {
        switch (hideOnStartup) {
          case "never":
            this._isTerminalBeingCreated = true;
            this._terminalService.createTerminal({ location: TerminalLocation.Panel }).finally(() => this._isTerminalBeingCreated = false);
            break;
          case "whenEmpty":
            if (this._terminalService.restoredGroupCount === 0) {
              this._terminalGroupService.hidePanel();
            }
            break;
        }
        return;
      }
      if (!this._isTerminalBeingCreated) {
        this._isTerminalBeingCreated = true;
        this._terminalService.createTerminal({ location: TerminalLocation.Panel }).finally(() => this._isTerminalBeingCreated = false);
      }
    }
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  renderBody(container) {
    super.renderBody(container);
    if (!this._parentDomElement) {
      this._updateForShellIntegration(container);
    }
    this._parentDomElement = container;
    this._parentDomElement.classList.add("integrated-terminal");
    domStylesheetsJs.createStyleSheet(this._parentDomElement);
    this._instantiationService.createInstance(TerminalThemeIconStyle, this._parentDomElement);
    if (!this.shouldShowWelcome()) {
      this._createTabsView();
    }
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalSettingId.FontFamily) || e.affectsConfiguration("editor.fontFamily")) {
        if (!this._terminalConfigurationService.configFontIsMonospace()) {
          const choices = [{
            label: nls.localize("terminal.useMonospace", "Use 'monospace'"),
            run: () => this.configurationService.updateValue(TerminalSettingId.FontFamily, "monospace")
          }];
          this._notificationService.prompt(Severity.Warning, nls.localize("terminal.monospaceOnly", "The terminal only supports monospace fonts. Be sure to restart VS Code if this is a newly installed font."), choices);
        }
      }
    }));
    this._register(this.onDidChangeBodyVisibility(async (visible) => {
      this._viewShowing.set(visible);
      if (visible) {
        if (this._hasWelcomeScreen()) {
          this._onDidChangeViewWelcomeState.fire();
        }
        this._initializeTerminal(false);
        this._terminalGroupService.showPanel(false);
      } else {
        for (const instance of this._terminalGroupService.instances) {
          instance.resetFocusContextKey();
        }
      }
      this._terminalGroupService.updateVisibility();
    }));
    this._register(this._terminalService.onDidChangeConnectionState(() => this._initializeTerminal(true)));
    this.layoutBody(this._parentDomElement.offsetHeight, this._parentDomElement.offsetWidth);
  }
  _createTabsView() {
    if (!this._parentDomElement) {
      return;
    }
    this._terminalTabbedView = this._register(this.instantiationService.createInstance(TerminalTabbedView, this._parentDomElement));
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this._terminalTabbedView?.layout(width, height);
  }
  createActionViewItem(action, options) {
    switch (action.id) {
      case TerminalCommandId.Split: {
        const that = this;
        const store = new DisposableStore();
        const panelOnlySplitAction = store.add(new class extends Action {
          constructor() {
            super(action.id, action.label, action.class, action.enabled);
            this.checked = action.checked;
            this.tooltip = action.tooltip;
          }
          async run() {
            const instance = that._terminalGroupService.activeInstance;
            if (instance) {
              const newInstance = await that._terminalService.createTerminal({ location: { parentTerminal: instance } });
              return newInstance?.focusWhenReady();
            }
            return;
          }
        }());
        const item = store.add(new ActionViewItem(action, panelOnlySplitAction, { ...options, icon: true, label: false, keybinding: this._getKeybindingLabel(action) }));
        this._actionDisposables.set(action.id, store);
        return item;
      }
      case TerminalCommandId.SwitchTerminal: {
        const item = this._instantiationService.createInstance(SwitchTerminalActionViewItem, action);
        this._actionDisposables.set(action.id, item);
        return item;
      }
      case TerminalCommandId.Focus: {
        if (action instanceof MenuItemAction) {
          const actions = getFlatContextMenuActions(this._singleTabMenu.getActions({ shouldForwardArgs: true }));
          const item = this._instantiationService.createInstance(SingleTerminalTabActionViewItem, action, actions);
          this._actionDisposables.set(action.id, item);
          return item;
        }
        break;
      }
      case TerminalCommandId.New: {
        if (action instanceof MenuItemAction) {
          const actions = getTerminalActionBarArgs(TerminalLocation.Panel, this._terminalProfileService.availableProfiles, this._getDefaultProfileName(), this._terminalProfileService.contributedProfiles, this._terminalService, this._dropdownMenu, this._disposableStore);
          this._newDropdown.value = new DropdownWithPrimaryActionViewItem(action, actions.dropdownAction, actions.dropdownMenuActions, actions.className, { hoverDelegate: options.hoverDelegate }, this._contextMenuService, this._keybindingService, this._notificationService, this._contextKeyService, this._themeService, this._accessibilityService);
          this._newDropdown.value?.update(actions.dropdownAction, actions.dropdownMenuActions);
          return this._newDropdown.value;
        }
      }
    }
    return super.createActionViewItem(action, options);
  }
  _getDefaultProfileName() {
    let defaultProfileName;
    try {
      defaultProfileName = this._terminalProfileService.getDefaultProfileName();
    } catch (e) {
      defaultProfileName = this._terminalProfileResolverService.defaultProfileName;
    }
    return defaultProfileName;
  }
  _getKeybindingLabel(action) {
    return this._keybindingService.lookupKeybinding(action.id)?.getLabel() ?? void 0;
  }
  _updateTabActionBar(profiles) {
    const actions = getTerminalActionBarArgs(TerminalLocation.Panel, profiles, this._getDefaultProfileName(), this._terminalProfileService.contributedProfiles, this._terminalService, this._dropdownMenu, this._disposableStore);
    this._newDropdown.value?.update(actions.dropdownAction, actions.dropdownMenuActions);
  }
  focus() {
    super.focus();
    if (this._terminalService.connectionState === TerminalConnectionState.Connected) {
      if (this._terminalGroupService.instances.length === 0 && !this._isTerminalBeingCreated) {
        this._isTerminalBeingCreated = true;
        this._terminalService.createTerminal({ location: TerminalLocation.Panel }).finally(() => this._isTerminalBeingCreated = false);
      }
      this._terminalGroupService.showPanel(true);
      return;
    }
    const previousActiveElement = this.element.ownerDocument.activeElement;
    if (previousActiveElement) {
      this._register(this._terminalService.onDidChangeConnectionState(() => {
        if (previousActiveElement && dom.isActiveElement(previousActiveElement)) {
          this._terminalGroupService.showPanel(true);
        }
      }));
    }
  }
  _hasWelcomeScreen() {
    return !this._terminalService.isProcessSupportRegistered;
  }
  shouldShowWelcome() {
    return this._hasWelcomeScreen() && this._terminalService.instances.length === 0;
  }
};
TerminalViewPane = __decorateClass([
  __decorateParam(1, IKeybindingService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IViewDescriptorService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, ITerminalService),
  __decorateParam(8, ITerminalConfigurationService),
  __decorateParam(9, ITerminalGroupService),
  __decorateParam(10, IThemeService),
  __decorateParam(11, IHoverService),
  __decorateParam(12, INotificationService),
  __decorateParam(13, IKeybindingService),
  __decorateParam(14, IOpenerService),
  __decorateParam(15, IMenuService),
  __decorateParam(16, ITerminalProfileService),
  __decorateParam(17, ITerminalProfileResolverService),
  __decorateParam(18, IThemeService),
  __decorateParam(19, IAccessibilityService)
], TerminalViewPane);
let SwitchTerminalActionViewItem = class extends SelectActionViewItem {
  constructor(action, _terminalService, _terminalGroupService, contextViewService, terminalProfileService) {
    super(null, action, getTerminalSelectOpenItems(_terminalService, _terminalGroupService), _terminalGroupService.activeGroupIndex, contextViewService, defaultSelectBoxStyles, { ariaLabel: nls.localize("terminals", "Open Terminals."), optionsAsChildren: true });
    this._terminalService = _terminalService;
    this._terminalGroupService = _terminalGroupService;
    this._register(_terminalService.onDidChangeInstances(() => this._updateItems(), this));
    this._register(_terminalService.onDidChangeActiveGroup(() => this._updateItems(), this));
    this._register(_terminalService.onDidChangeActiveInstance(() => this._updateItems(), this));
    this._register(_terminalService.onAnyInstanceTitleChange(() => this._updateItems(), this));
    this._register(_terminalGroupService.onDidChangeGroups(() => this._updateItems(), this));
    this._register(_terminalService.onDidChangeConnectionState(() => this._updateItems(), this));
    this._register(terminalProfileService.onDidChangeAvailableProfiles(() => this._updateItems(), this));
    this._register(_terminalService.onAnyInstancePrimaryStatusChange(() => this._updateItems(), this));
  }
  render(container) {
    super.render(container);
    container.classList.add("switch-terminal");
    container.style.borderColor = asCssVariable(selectBorder);
  }
  _updateItems() {
    const options = getTerminalSelectOpenItems(this._terminalService, this._terminalGroupService);
    this.setOptions(options, this._terminalGroupService.activeGroupIndex);
  }
};
SwitchTerminalActionViewItem = __decorateClass([
  __decorateParam(1, ITerminalService),
  __decorateParam(2, ITerminalGroupService),
  __decorateParam(3, IContextViewService),
  __decorateParam(4, ITerminalProfileService)
], SwitchTerminalActionViewItem);
function getTerminalSelectOpenItems(terminalService, terminalGroupService) {
  let items;
  if (terminalService.connectionState === TerminalConnectionState.Connected) {
    items = terminalGroupService.getGroupLabels().map((label) => {
      return { text: label };
    });
  } else {
    items = [{ text: nls.localize("terminalConnectingLabel", "Starting...") }];
  }
  items.push({ text: switchTerminalActionViewItemSeparator, isDisabled: true });
  items.push({ text: switchTerminalShowTabsTitle });
  return items;
}
let SingleTerminalTabActionViewItem = class extends MenuEntryActionViewItem {
  constructor(action, _actions, keybindingService, notificationService, contextKeyService, themeService, _terminalService, _terminaConfigurationService, _terminalGroupService, contextMenuService, _commandService, _instantiationService, _accessibilityService) {
    super(action, {
      draggable: true,
      hoverDelegate: _instantiationService.createInstance(SingleTabHoverDelegate)
    }, keybindingService, notificationService, contextKeyService, themeService, contextMenuService, _accessibilityService);
    this._actions = _actions;
    this._terminalService = _terminalService;
    this._terminaConfigurationService = _terminaConfigurationService;
    this._terminalGroupService = _terminalGroupService;
    this._commandService = _commandService;
    this._instantiationService = _instantiationService;
    this._elementDisposables = [];
    this._register(Event.debounce(Event.any(
      this._terminalService.onAnyInstancePrimaryStatusChange,
      this._terminalGroupService.onDidChangeActiveInstance,
      Event.map(this._terminalService.onAnyInstanceIconChange, (e) => e.instance),
      this._terminalService.onAnyInstanceTitleChange,
      this._terminalService.onDidChangeInstanceCapability
    ), (last, e) => {
      if (!last) {
        last = /* @__PURE__ */ new Set();
      }
      if (e) {
        last.add(e);
      }
      return last;
    }, MicrotaskDelay)((merged) => {
      for (const e of merged) {
        this.updateLabel(e);
      }
    }));
    this._register(toDisposable(() => dispose(this._elementDisposables)));
  }
  async onClick(event) {
    this._terminalGroupService.lastAccessedMenu = "inline-tab";
    if (event.altKey && this._menuItemAction.alt) {
      this._commandService.executeCommand(this._menuItemAction.alt.id, { location: TerminalLocation.Panel });
    } else {
      this._openContextMenu();
    }
  }
  // eslint-disable-next-line @typescript-eslint/naming-convention
  updateLabel(e) {
    if (e && e !== this._terminalGroupService.activeInstance) {
      return;
    }
    if (this._elementDisposables.length === 0 && this.element && this.label) {
      this._elementDisposables.push(dom.addDisposableListener(this.element, dom.EventType.CONTEXT_MENU, (e2) => {
        if (e2.button === 2) {
          this._openContextMenu();
          e2.preventDefault();
        }
      }));
      this._elementDisposables.push(dom.addDisposableListener(this.element, dom.EventType.AUXCLICK, (e2) => {
        if (e2.button === 1) {
          const instance = this._terminalGroupService.activeInstance;
          if (instance) {
            this._terminalService.safeDisposeTerminal(instance);
          }
          e2.preventDefault();
        }
      }));
      this._elementDisposables.push(dom.addDisposableListener(this.element, dom.EventType.DRAG_START, (e2) => {
        const instance = this._terminalGroupService.activeInstance;
        if (e2.dataTransfer && instance) {
          e2.dataTransfer.setData(TerminalDataTransfers.Terminals, JSON.stringify([instance.resource.toString()]));
        }
      }));
    }
    if (this.label) {
      const label = this.label;
      const instance = this._terminalGroupService.activeInstance;
      if (!instance) {
        dom.reset(label, "");
        return;
      }
      label.classList.add("single-terminal-tab");
      let colorStyle = "";
      const primaryStatus = instance.statusList.primary;
      if (primaryStatus) {
        const colorKey = getColorForSeverity(primaryStatus.severity);
        this._themeService.getColorTheme();
        const foundColor = this._themeService.getColorTheme().getColor(colorKey);
        if (foundColor) {
          colorStyle = foundColor.toString();
        }
      }
      label.style.color = colorStyle;
      dom.reset(label, ...renderLabelWithIcons(this._instantiationService.invokeFunction(getSingleTabLabel, instance, this._terminaConfigurationService.config.tabs.separator, ThemeIcon.isThemeIcon(this._commandAction.item.icon) ? this._commandAction.item.icon : void 0)));
      if (this._altCommand) {
        label.classList.remove(this._altCommand);
        this._altCommand = void 0;
      }
      if (this._color) {
        label.classList.remove(this._color);
        this._color = void 0;
      }
      if (this._class) {
        label.classList.remove(this._class);
        label.classList.remove("terminal-uri-icon");
        this._class = void 0;
      }
      const colorClass = getColorClass(instance);
      if (colorClass) {
        this._color = colorClass;
        label.classList.add(colorClass);
      }
      const uriClasses = getUriClasses(instance, this._themeService.getColorTheme().type);
      if (uriClasses) {
        this._class = uriClasses?.[0];
        label.classList.add(...uriClasses);
      }
      if (this._commandAction.item.icon) {
        this._altCommand = `alt-command`;
        label.classList.add(this._altCommand);
      }
      this.updateTooltip();
    }
  }
  _openContextMenu() {
    const actionRunner = new TerminalContextActionRunner();
    this._contextMenuService.showContextMenu({
      actionRunner,
      getAnchor: () => this.element,
      getActions: () => this._actions,
      // The context is always the active instance in the terminal view
      getActionsContext: () => {
        const instance = this._terminalGroupService.activeInstance;
        return instance ? [new InstanceContext(instance)] : [];
      },
      onHide: () => actionRunner.dispose()
    });
  }
};
SingleTerminalTabActionViewItem = __decorateClass([
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, ITerminalService),
  __decorateParam(7, ITerminalConfigurationService),
  __decorateParam(8, ITerminalGroupService),
  __decorateParam(9, IContextMenuService),
  __decorateParam(10, ICommandService),
  __decorateParam(11, IInstantiationService),
  __decorateParam(12, IAccessibilityService)
], SingleTerminalTabActionViewItem);
function getSingleTabLabel(accessor, instance, separator, icon) {
  if (!instance || !instance.title) {
    return "";
  }
  const iconId = ThemeIcon.isThemeIcon(instance.icon) ? instance.icon.id : accessor.get(ITerminalProfileResolverService).getDefaultIcon().id;
  const label = `$(${icon?.id || iconId}) ${getSingleTabTitle(instance, separator)}`;
  const primaryStatus = instance.statusList.primary;
  if (!primaryStatus?.icon) {
    return label;
  }
  return `${label} $(${primaryStatus.icon.id})`;
}
function getSingleTabTitle(instance, separator) {
  if (!instance) {
    return "";
  }
  return !instance.description ? instance.title : `${instance.title} ${separator} ${instance.description}`;
}
let TerminalThemeIconStyle = class extends Themable {
  constructor(container, _themeService, _terminalService, _terminalGroupService) {
    super(_themeService);
    this._themeService = _themeService;
    this._terminalService = _terminalService;
    this._terminalGroupService = _terminalGroupService;
    this._registerListeners();
    this._styleElement = domStylesheetsJs.createStyleSheet(container);
    this._register(toDisposable(() => this._styleElement.remove()));
    this.updateStyles();
  }
  _registerListeners() {
    this._register(this._terminalService.onAnyInstanceIconChange(() => this.updateStyles()));
    this._register(this._terminalService.onDidChangeInstances(() => this.updateStyles()));
    this._register(this._terminalGroupService.onDidChangeGroups(() => this.updateStyles()));
  }
  updateStyles() {
    super.updateStyles();
    const colorTheme = this._themeService.getColorTheme();
    let css = "";
    for (const instance of this._terminalService.instances) {
      const icon = instance.icon;
      if (!icon) {
        continue;
      }
      let uri = void 0;
      if (icon instanceof URI) {
        uri = icon;
      } else if (icon instanceof Object && "light" in icon && "dark" in icon) {
        uri = colorTheme.type === ColorScheme.LIGHT ? icon.light : icon.dark;
      }
      const iconClasses = getUriClasses(instance, colorTheme.type);
      if (uri instanceof URI && iconClasses && iconClasses.length > 1) {
        css += `.monaco-workbench .${iconClasses[0]} .monaco-highlighted-label .codicon, .monaco-action-bar .terminal-uri-icon.single-terminal-tab.action-label:not(.alt-command) .codicon{background-image: ${cssJs.asCSSUrl(uri)};}`;
      }
    }
    for (const instance of this._terminalService.instances) {
      const colorClass = getColorClass(instance);
      if (!colorClass || !instance.color) {
        continue;
      }
      const color = colorTheme.getColor(instance.color);
      if (color) {
        css += `.monaco-workbench .${colorClass} .codicon:first-child:not(.codicon-split-horizontal):not(.codicon-trashcan):not(.file-icon):not(.codicon-rerun-task){ color: ${color} !important; }`;
      }
    }
    this._styleElement.textContent = css;
  }
};
TerminalThemeIconStyle = __decorateClass([
  __decorateParam(1, IThemeService),
  __decorateParam(2, ITerminalService),
  __decorateParam(3, ITerminalGroupService)
], TerminalThemeIconStyle);
let SingleTabHoverDelegate = class {
  constructor(_configurationService, _hoverService, _storageService, _terminalGroupService) {
    this._configurationService = _configurationService;
    this._hoverService = _hoverService;
    this._storageService = _storageService;
    this._terminalGroupService = _terminalGroupService;
    this._lastHoverHideTime = 0;
    this.placement = "element";
  }
  get delay() {
    return Date.now() - this._lastHoverHideTime < 200 ? 0 : this._configurationService.getValue("workbench.hover.delay");
  }
  showHover(options, focus) {
    const instance = this._terminalGroupService.activeInstance;
    if (!instance) {
      return;
    }
    const hoverInfo = getInstanceHoverInfo(instance, this._storageService);
    return this._hoverService.showInstantHover({
      ...options,
      content: hoverInfo.content,
      actions: hoverInfo.actions
    }, focus);
  }
  onDidHideHover() {
    this._lastHoverHideTime = Date.now();
  }
};
SingleTabHoverDelegate = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IHoverService),
  __decorateParam(2, IStorageService),
  __decorateParam(3, ITerminalGroupService)
], SingleTabHoverDelegate);
export {
  TerminalViewPane
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsVmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0ICogYXMgZG9tU3R5bGVzaGVldHNKcyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tU3R5bGVzaGVldHMuanMnO1xuaW1wb3J0ICogYXMgY3NzSnMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2Nzc1ZhbHVlLmpzJztcbmltcG9ydCB7IEFjdGlvbiwgSUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlLCBJQ29udGV4dFZpZXdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UsIFRoZW1hYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgc3dpdGNoVGVybWluYWxBY3Rpb25WaWV3SXRlbVNlcGFyYXRvciwgc3dpdGNoVGVybWluYWxTaG93VGFic1RpdGxlIH0gZnJvbSAnLi90ZXJtaW5hbEFjdGlvbnMuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UsIElQcm9tcHRDaG9pY2UsIFNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSUNyZWF0ZVRlcm1pbmFsT3B0aW9ucywgSVRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UsIElUZXJtaW5hbEdyb3VwU2VydmljZSwgSVRlcm1pbmFsSW5zdGFuY2UsIElUZXJtaW5hbFNlcnZpY2UsIFRlcm1pbmFsQ29ubmVjdGlvblN0YXRlLCBUZXJtaW5hbERhdGFUcmFuc2ZlcnMgfSBmcm9tICcuL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IFZpZXdQYW5lLCBJVmlld1BhbmVPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3UGFuZS5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElWaWV3RGVzY3JpcHRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJTWVudSwgSU1lbnVTZXJ2aWNlLCBNZW51SWQsIE1lbnVJdGVtQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlLCBJVGVybWluYWxQcm9maWxlU2VydmljZSwgVGVybWluYWxDb21tYW5kSWQgfSBmcm9tICcuLi9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgVGVybWluYWxTZXR0aW5nSWQsIElUZXJtaW5hbFByb2ZpbGUsIFRlcm1pbmFsTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgQWN0aW9uVmlld0l0ZW0sIElCYXNlQWN0aW9uVmlld0l0ZW1PcHRpb25zLCBTZWxlY3RBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uVmlld0l0ZW1zLmpzJztcbmltcG9ydCB7IGFzQ3NzVmFyaWFibGUsIHNlbGVjdEJvcmRlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElTZWxlY3RPcHRpb25JdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3NlbGVjdEJveC9zZWxlY3RCb3guanMnO1xuaW1wb3J0IHsgSUFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgVGVybWluYWxUYWJiZWRWaWV3IH0gZnJvbSAnLi90ZXJtaW5hbFRhYmJlZFZpZXcuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IHJlbmRlckxhYmVsV2l0aEljb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ljb25MYWJlbC9pY29uTGFiZWxzLmpzJztcbmltcG9ydCB7IGdldENvbG9yRm9yU2V2ZXJpdHkgfSBmcm9tICcuL3Rlcm1pbmFsU3RhdHVzTGlzdC5qcyc7XG5pbXBvcnQgeyBnZXRGbGF0Q29udGV4dE1lbnVBY3Rpb25zLCBNZW51RW50cnlBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBEcm9wZG93bldpdGhQcmltYXJ5QWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvZHJvcGRvd25XaXRoUHJpbWFyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVNYXAsIERpc3Bvc2FibGVTdG9yZSwgZGlzcG9zZSwgSURpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IENvbG9yU2NoZW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IGdldENvbG9yQ2xhc3MsIGdldFVyaUNsYXNzZXMgfSBmcm9tICcuL3Rlcm1pbmFsSWNvbi5qcyc7XG5pbXBvcnQgeyBnZXRUZXJtaW5hbEFjdGlvbkJhckFyZ3MgfSBmcm9tICcuL3Rlcm1pbmFsTWVudXMuanMnO1xuaW1wb3J0IHsgVGVybWluYWxDb250ZXh0S2V5cyB9IGZyb20gJy4uL2NvbW1vbi90ZXJtaW5hbENvbnRleHRLZXkuanMnO1xuaW1wb3J0IHsgZ2V0SW5zdGFuY2VIb3ZlckluZm8gfSBmcm9tICcuL3Rlcm1pbmFsVG9vbHRpcC5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbENhcGFiaWxpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NhcGFiaWxpdGllcy5qcyc7XG5pbXBvcnQgeyBkZWZhdWx0U2VsZWN0Qm94U3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvYnJvd3Nlci9kZWZhdWx0U3R5bGVzLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSUhvdmVyRGVsZWdhdGUsIElIb3ZlckRlbGVnYXRlT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmlsaXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgSW5zdGFuY2VDb250ZXh0LCBUZXJtaW5hbENvbnRleHRBY3Rpb25SdW5uZXIgfSBmcm9tICcuL3Rlcm1pbmFsQ29udGV4dE1lbnUuanMnO1xuaW1wb3J0IHsgTWljcm90YXNrRGVsYXkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zeW1ib2xzLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuXG5leHBvcnQgY2xhc3MgVGVybWluYWxWaWV3UGFuZSBleHRlbmRzIFZpZXdQYW5lIHtcblx0cHJpdmF0ZSBfcGFyZW50RG9tRWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3Rlcm1pbmFsVGFiYmVkVmlldz86IFRlcm1pbmFsVGFiYmVkVmlldztcblx0Z2V0IHRlcm1pbmFsVGFiYmVkVmlldygpOiBUZXJtaW5hbFRhYmJlZFZpZXcgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5fdGVybWluYWxUYWJiZWRWaWV3OyB9XG5cdHByaXZhdGUgX2lzSW5pdGlhbGl6ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0LyoqXG5cdCAqIFRyYWNrcyBhbiBhY3RpdmUgcHJvbWlzZSBvZiB0ZXJtaW5hbCBjcmVhdGlvbiByZXF1ZXN0ZWQgYnkgdGhpcyBjb21wb25lbnQuIFRoaXMgaGVscHMgcHJldmVudFxuXHQgKiBkb3VibGUgY3JlYXRpb24gZm9yIGV4YW1wbGUgd2hlbiB0b2dnbGluZyBhIHRlcm1pbmFsJ3MgdmlzaWJpbGl0eSBhbmQgZm9jdXNpbmcgaXQuXG5cdCAqL1xuXHRwcml2YXRlIF9pc1Rlcm1pbmFsQmVpbmdDcmVhdGVkOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgX25ld0Ryb3Bkb3duOiBNdXRhYmxlRGlzcG9zYWJsZTxEcm9wZG93bldpdGhQcmltYXJ5QWN0aW9uVmlld0l0ZW0+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kcm9wZG93bk1lbnU6IElNZW51O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zaW5nbGVUYWJNZW51OiBJTWVudTtcblx0cHJpdmF0ZSBfdmlld1Nob3dpbmc6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlU3RvcmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hY3Rpb25EaXNwb3NhYmxlczogRGlzcG9zYWJsZU1hcDxUZXJtaW5hbENvbW1hbmRJZD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZU1hcCgpKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRvcHRpb25zOiBJVmlld1BhbmVPcHRpb25zLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2Ugdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsU2VydmljZTogSVRlcm1pbmFsU2VydmljZSxcblx0XHRASVRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZTogSVRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbEdyb3VwU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbEdyb3VwU2VydmljZTogSVRlcm1pbmFsR3JvdXBTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfa2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9tZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxQcm9maWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlOiBJVGVybWluYWxQcm9maWxlU2VydmljZSxcblx0XHRASVRlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2U6IElUZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYWNjZXNzaWJpbGl0eVNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihvcHRpb25zLCBrZXliaW5kaW5nU2VydmljZSwgX2NvbnRleHRNZW51U2VydmljZSwgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLCBfY29udGV4dEtleVNlcnZpY2UsIHZpZXdEZXNjcmlwdG9yU2VydmljZSwgX2luc3RhbnRpYXRpb25TZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIGhvdmVyU2VydmljZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGVybWluYWxTZXJ2aWNlLm9uRGlkUmVnaXN0ZXJQcm9jZXNzU3VwcG9ydCgoKSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVZpZXdXZWxjb21lU3RhdGUuZmlyZSgpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Rlcm1pbmFsU2VydmljZS5vbkRpZENoYW5nZUluc3RhbmNlcygoKSA9PiB7XG5cdFx0XHQvLyBJZiB0aGUgZmlyc3QgdGVybWluYWwgaXMgb3BlbmVkLCBoaWRlIHRoZSB3ZWxjb21lIHZpZXdcblx0XHRcdC8vIGFuZCBpZiB0aGUgbGFzdCBvbmUgaXMgY2xvc2VkLCBzaG93IGl0IGFnYWluXG5cdFx0XHRpZiAodGhpcy5faGFzV2VsY29tZVNjcmVlbigpICYmIHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLmluc3RhbmNlcy5sZW5ndGggPD0gMSkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVZpZXdXZWxjb21lU3RhdGUuZmlyZSgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCF0aGlzLl9wYXJlbnREb21FbGVtZW50KSB7IHJldHVybjsgfVxuXHRcdFx0Ly8gSWYgd2UgZG8gbm90IGhhdmUgdGhlIHRhYiB2aWV3IHlldCwgY3JlYXRlIGl0IG5vdy5cblx0XHRcdGlmICghdGhpcy5fdGVybWluYWxUYWJiZWRWaWV3KSB7XG5cdFx0XHRcdHRoaXMuX2NyZWF0ZVRhYnNWaWV3KCk7XG5cdFx0XHR9XG5cdFx0XHQvLyBJZiB3ZSBqdXN0IG9wZW5lZCBvdXIgZmlyc3QgdGVybWluYWwsIGxheW91dFxuXHRcdFx0aWYgKHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLmluc3RhbmNlcy5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0dGhpcy5sYXlvdXRCb2R5KHRoaXMuX3BhcmVudERvbUVsZW1lbnQub2Zmc2V0SGVpZ2h0LCB0aGlzLl9wYXJlbnREb21FbGVtZW50Lm9mZnNldFdpZHRoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fZHJvcGRvd25NZW51ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5fbWVudVNlcnZpY2UuY3JlYXRlTWVudShNZW51SWQuVGVybWluYWxOZXdEcm9wZG93bkNvbnRleHQsIHRoaXMuX2NvbnRleHRLZXlTZXJ2aWNlKSk7XG5cdFx0dGhpcy5fc2luZ2xlVGFiTWVudSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX21lbnVTZXJ2aWNlLmNyZWF0ZU1lbnUoTWVudUlkLlRlcm1pbmFsVGFiQ29udGV4dCwgdGhpcy5fY29udGV4dEtleVNlcnZpY2UpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLm9uRGlkQ2hhbmdlQXZhaWxhYmxlUHJvZmlsZXMocHJvZmlsZXMgPT4gdGhpcy5fdXBkYXRlVGFiQWN0aW9uQmFyKHByb2ZpbGVzKSkpO1xuXHRcdHRoaXMuX3ZpZXdTaG93aW5nID0gVGVybWluYWxDb250ZXh0S2V5cy52aWV3U2hvd2luZy5iaW5kVG8odGhpcy5fY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25EaWRDaGFuZ2VCb2R5VmlzaWJpbGl0eShlID0+IHtcblx0XHRcdGlmIChlKSB7XG5cdFx0XHRcdHRoaXMuX3Rlcm1pbmFsVGFiYmVkVmlldz8ucmVyZW5kZXJUYWJzKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmICh0aGlzLl9wYXJlbnREb21FbGVtZW50ICYmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKFRlcm1pbmFsU2V0dGluZ0lkLlNoZWxsSW50ZWdyYXRpb25EZWNvcmF0aW9uc0VuYWJsZWQpIHx8IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGVybWluYWxTZXR0aW5nSWQuU2hlbGxJbnRlZ3JhdGlvbkVuYWJsZWQpKSkge1xuXHRcdFx0XHR0aGlzLl91cGRhdGVGb3JTaGVsbEludGVncmF0aW9uKHRoaXMuX3BhcmVudERvbUVsZW1lbnQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRjb25zdCBzaGVsbEludGVncmF0aW9uRGlzcG9zYWJsZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblx0XHRzaGVsbEludGVncmF0aW9uRGlzcG9zYWJsZS52YWx1ZSA9IHRoaXMuX3Rlcm1pbmFsU2VydmljZS5vbkFueUluc3RhbmNlQWRkZWRDYXBhYmlsaXR5VHlwZShjID0+IHtcblx0XHRcdGlmIChjID09PSBUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbiAmJiB0aGlzLl9ndXR0ZXJEZWNvcmF0aW9uc0VuYWJsZWQoKSkge1xuXHRcdFx0XHR0aGlzLl9wYXJlbnREb21FbGVtZW50Py5jbGFzc0xpc3QuYWRkKCdzaGVsbC1pbnRlZ3JhdGlvbicpO1xuXHRcdFx0XHRzaGVsbEludGVncmF0aW9uRGlzcG9zYWJsZS5jbGVhcigpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlRm9yU2hlbGxJbnRlZ3JhdGlvbihjb250YWluZXI6IEhUTUxFbGVtZW50KSB7XG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC50b2dnbGUoJ3NoZWxsLWludGVncmF0aW9uJywgdGhpcy5fZ3V0dGVyRGVjb3JhdGlvbnNFbmFibGVkKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ3V0dGVyRGVjb3JhdGlvbnNFbmFibGVkKCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGRlY29yYXRpb25zRW5hYmxlZCA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsU2V0dGluZ0lkLlNoZWxsSW50ZWdyYXRpb25EZWNvcmF0aW9uc0VuYWJsZWQpO1xuXHRcdHJldHVybiAoZGVjb3JhdGlvbnNFbmFibGVkID09PSAnYm90aCcgfHwgZGVjb3JhdGlvbnNFbmFibGVkID09PSAnZ3V0dGVyJykgJiYgdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGVybWluYWxTZXR0aW5nSWQuU2hlbGxJbnRlZ3JhdGlvbkVuYWJsZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaW5pdGlhbGl6ZVRlcm1pbmFsKGNoZWNrUmVzdG9yZWRUZXJtaW5hbHM6IGJvb2xlYW4pIHtcblx0XHRpZiAodGhpcy5pc0JvZHlWaXNpYmxlKCkgJiYgdGhpcy5fdGVybWluYWxTZXJ2aWNlLmlzUHJvY2Vzc1N1cHBvcnRSZWdpc3RlcmVkICYmIHRoaXMuX3Rlcm1pbmFsU2VydmljZS5jb25uZWN0aW9uU3RhdGUgPT09IFRlcm1pbmFsQ29ubmVjdGlvblN0YXRlLkNvbm5lY3RlZCkge1xuXHRcdFx0Y29uc3Qgd2FzSW5pdGlhbGl6ZWQgPSB0aGlzLl9pc0luaXRpYWxpemVkO1xuXHRcdFx0dGhpcy5faXNJbml0aWFsaXplZCA9IHRydWU7XG5cblx0XHRcdGxldCBoaWRlT25TdGFydHVwOiAnbmV2ZXInIHwgJ3doZW5FbXB0eScgfCAnYWx3YXlzJyA9ICduZXZlcic7XG5cdFx0XHRpZiAoIXdhc0luaXRpYWxpemVkKSB7XG5cdFx0XHRcdGhpZGVPblN0YXJ0dXAgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShUZXJtaW5hbFNldHRpbmdJZC5IaWRlT25TdGFydHVwKTtcblx0XHRcdFx0aWYgKGhpZGVPblN0YXJ0dXAgPT09ICdhbHdheXMnKSB7XG5cdFx0XHRcdFx0dGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuaGlkZVBhbmVsKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0bGV0IHNob3VsZENyZWF0ZSA9IHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLmdyb3Vwcy5sZW5ndGggPT09IDA7XG5cdFx0XHQvLyBXaGVuIHRyaWdnZXJlZCBqdXN0IGFmdGVyIHJlY29ubmVjdGlvbiwgYWxzbyBjaGVjayB0aGVyZSBhcmUgbm8gZ3JvdXBzIHRoYXQgY291bGQgYmVcblx0XHRcdC8vIGdldHRpbmcgcmVzdG9yZWQgY3VycmVudGx5XG5cdFx0XHRpZiAoY2hlY2tSZXN0b3JlZFRlcm1pbmFscykge1xuXHRcdFx0XHRzaG91bGRDcmVhdGUgJiY9IHRoaXMuX3Rlcm1pbmFsU2VydmljZS5yZXN0b3JlZEdyb3VwQ291bnQgPT09IDA7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXNob3VsZENyZWF0ZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXdhc0luaXRpYWxpemVkKSB7XG5cdFx0XHRcdHN3aXRjaCAoaGlkZU9uU3RhcnR1cCkge1xuXHRcdFx0XHRcdGNhc2UgJ25ldmVyJzpcblx0XHRcdFx0XHRcdHRoaXMuX2lzVGVybWluYWxCZWluZ0NyZWF0ZWQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0dGhpcy5fdGVybWluYWxTZXJ2aWNlLmNyZWF0ZVRlcm1pbmFsKHsgbG9jYXRpb246IFRlcm1pbmFsTG9jYXRpb24uUGFuZWwgfSkuZmluYWxseSgoKSA9PiB0aGlzLl9pc1Rlcm1pbmFsQmVpbmdDcmVhdGVkID0gZmFsc2UpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnd2hlbkVtcHR5Jzpcblx0XHRcdFx0XHRcdGlmICh0aGlzLl90ZXJtaW5hbFNlcnZpY2UucmVzdG9yZWRHcm91cENvdW50ID09PSAwKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLmhpZGVQYW5lbCgpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXRoaXMuX2lzVGVybWluYWxCZWluZ0NyZWF0ZWQpIHtcblx0XHRcdFx0dGhpcy5faXNUZXJtaW5hbEJlaW5nQ3JlYXRlZCA9IHRydWU7XG5cdFx0XHRcdHRoaXMuX3Rlcm1pbmFsU2VydmljZS5jcmVhdGVUZXJtaW5hbCh7IGxvY2F0aW9uOiBUZXJtaW5hbExvY2F0aW9uLlBhbmVsIH0pLmZpbmFsbHkoKCkgPT4gdGhpcy5faXNUZXJtaW5hbEJlaW5nQ3JlYXRlZCA9IGZhbHNlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uXG5cdHByb3RlY3RlZCBvdmVycmlkZSByZW5kZXJCb2R5KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJCb2R5KGNvbnRhaW5lcik7XG5cblx0XHRpZiAoIXRoaXMuX3BhcmVudERvbUVsZW1lbnQpIHtcblx0XHRcdHRoaXMuX3VwZGF0ZUZvclNoZWxsSW50ZWdyYXRpb24oY29udGFpbmVyKTtcblx0XHR9XG5cdFx0dGhpcy5fcGFyZW50RG9tRWxlbWVudCA9IGNvbnRhaW5lcjtcblx0XHR0aGlzLl9wYXJlbnREb21FbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2ludGVncmF0ZWQtdGVybWluYWwnKTtcblx0XHRkb21TdHlsZXNoZWV0c0pzLmNyZWF0ZVN0eWxlU2hlZXQodGhpcy5fcGFyZW50RG9tRWxlbWVudCk7XG5cdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxUaGVtZUljb25TdHlsZSwgdGhpcy5fcGFyZW50RG9tRWxlbWVudCk7XG5cblx0XHRpZiAoIXRoaXMuc2hvdWxkU2hvd1dlbGNvbWUoKSkge1xuXHRcdFx0dGhpcy5fY3JlYXRlVGFic1ZpZXcoKTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKFRlcm1pbmFsU2V0dGluZ0lkLkZvbnRGYW1pbHkpIHx8IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2VkaXRvci5mb250RmFtaWx5JykpIHtcblx0XHRcdFx0aWYgKCF0aGlzLl90ZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZ0ZvbnRJc01vbm9zcGFjZSgpKSB7XG5cdFx0XHRcdFx0Y29uc3QgY2hvaWNlczogSVByb21wdENob2ljZVtdID0gW3tcblx0XHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ3Rlcm1pbmFsLnVzZU1vbm9zcGFjZScsIFwiVXNlICdtb25vc3BhY2UnXCIpLFxuXHRcdFx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKFRlcm1pbmFsU2V0dGluZ0lkLkZvbnRGYW1pbHksICdtb25vc3BhY2UnKSxcblx0XHRcdFx0XHR9XTtcblx0XHRcdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLnByb21wdChTZXZlcml0eS5XYXJuaW5nLCBubHMubG9jYWxpemUoJ3Rlcm1pbmFsLm1vbm9zcGFjZU9ubHknLCBcIlRoZSB0ZXJtaW5hbCBvbmx5IHN1cHBvcnRzIG1vbm9zcGFjZSBmb250cy4gQmUgc3VyZSB0byByZXN0YXJ0IFZTIENvZGUgaWYgdGhpcyBpcyBhIG5ld2x5IGluc3RhbGxlZCBmb250LlwiKSwgY2hvaWNlcyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZENoYW5nZUJvZHlWaXNpYmlsaXR5KGFzeW5jIHZpc2libGUgPT4ge1xuXHRcdFx0dGhpcy5fdmlld1Nob3dpbmcuc2V0KHZpc2libGUpO1xuXHRcdFx0aWYgKHZpc2libGUpIHtcblx0XHRcdFx0aWYgKHRoaXMuX2hhc1dlbGNvbWVTY3JlZW4oKSkge1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVmlld1dlbGNvbWVTdGF0ZS5maXJlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5faW5pdGlhbGl6ZVRlcm1pbmFsKGZhbHNlKTtcblx0XHRcdFx0Ly8gd2UgZG9uJ3Qga25vdyBoZXJlIHdoZXRoZXIgb3Igbm90IGl0IHNob3VsZCBiZSBmb2N1c2VkLCBzb1xuXHRcdFx0XHQvLyBkZWZlciBmb2N1c2luZyB0aGUgcGFuZWwgdG8gdGhlIGZvY3VzKCkgY2FsbFxuXHRcdFx0XHQvLyB0byBwcmV2ZW50IG92ZXJyaWRpbmcgcHJlc2VydmVGb2N1cyBmb3IgZXh0ZW5zaW9uc1xuXHRcdFx0XHR0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5zaG93UGFuZWwoZmFsc2UpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Zm9yIChjb25zdCBpbnN0YW5jZSBvZiB0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5pbnN0YW5jZXMpIHtcblx0XHRcdFx0XHRpbnN0YW5jZS5yZXNldEZvY3VzQ29udGV4dEtleSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS51cGRhdGVWaXNpYmlsaXR5KCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Rlcm1pbmFsU2VydmljZS5vbkRpZENoYW5nZUNvbm5lY3Rpb25TdGF0ZSgoKSA9PiB0aGlzLl9pbml0aWFsaXplVGVybWluYWwodHJ1ZSkpKTtcblx0XHR0aGlzLmxheW91dEJvZHkodGhpcy5fcGFyZW50RG9tRWxlbWVudC5vZmZzZXRIZWlnaHQsIHRoaXMuX3BhcmVudERvbUVsZW1lbnQub2Zmc2V0V2lkdGgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlVGFic1ZpZXcoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9wYXJlbnREb21FbGVtZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3Rlcm1pbmFsVGFiYmVkVmlldyA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxUYWJiZWRWaWV3LCB0aGlzLl9wYXJlbnREb21FbGVtZW50KSk7XG5cdH1cblxuXHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgQHR5cGVzY3JpcHQtZXNsaW50L25hbWluZy1jb252ZW50aW9uXG5cdHByb3RlY3RlZCBvdmVycmlkZSBsYXlvdXRCb2R5KGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKTogdm9pZCB7XG5cdFx0c3VwZXIubGF5b3V0Qm9keShoZWlnaHQsIHdpZHRoKTtcblx0XHR0aGlzLl90ZXJtaW5hbFRhYmJlZFZpZXc/LmxheW91dCh3aWR0aCwgaGVpZ2h0KTtcblx0fVxuXG5cdG92ZXJyaWRlIGNyZWF0ZUFjdGlvblZpZXdJdGVtKGFjdGlvbjogQWN0aW9uLCBvcHRpb25zOiBJQmFzZUFjdGlvblZpZXdJdGVtT3B0aW9ucyk6IElBY3Rpb25WaWV3SXRlbSB8IHVuZGVmaW5lZCB7XG5cdFx0c3dpdGNoIChhY3Rpb24uaWQpIHtcblx0XHRcdGNhc2UgVGVybWluYWxDb21tYW5kSWQuU3BsaXQ6IHtcblx0XHRcdFx0Ly8gU3BsaXQgbmVlZHMgdG8gYmUgc3BlY2lhbCBjYXNlZCB0byBmb3JjZSBzcGxpdHRpbmcgd2l0aGluIHRoZSBwYW5lbCwgbm90IHRoZSBlZGl0b3Jcblx0XHRcdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0XHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0XHRjb25zdCBwYW5lbE9ubHlTcGxpdEFjdGlvbiA9IHN0b3JlLmFkZChuZXcgY2xhc3MgZXh0ZW5kcyBBY3Rpb24ge1xuXHRcdFx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRcdFx0c3VwZXIoYWN0aW9uLmlkLCBhY3Rpb24ubGFiZWwsIGFjdGlvbi5jbGFzcywgYWN0aW9uLmVuYWJsZWQpO1xuXHRcdFx0XHRcdFx0dGhpcy5jaGVja2VkID0gYWN0aW9uLmNoZWNrZWQ7XG5cdFx0XHRcdFx0XHR0aGlzLnRvb2x0aXAgPSBhY3Rpb24udG9vbHRpcDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0b3ZlcnJpZGUgYXN5bmMgcnVuKCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgaW5zdGFuY2UgPSB0aGF0Ll90ZXJtaW5hbEdyb3VwU2VydmljZS5hY3RpdmVJbnN0YW5jZTtcblx0XHRcdFx0XHRcdGlmIChpbnN0YW5jZSkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBuZXdJbnN0YW5jZSA9IGF3YWl0IHRoYXQuX3Rlcm1pbmFsU2VydmljZS5jcmVhdGVUZXJtaW5hbCh7IGxvY2F0aW9uOiB7IHBhcmVudFRlcm1pbmFsOiBpbnN0YW5jZSB9IH0pO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gbmV3SW5zdGFuY2U/LmZvY3VzV2hlblJlYWR5KCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0Y29uc3QgaXRlbSA9IHN0b3JlLmFkZChuZXcgQWN0aW9uVmlld0l0ZW0oYWN0aW9uLCBwYW5lbE9ubHlTcGxpdEFjdGlvbiwgeyAuLi5vcHRpb25zLCBpY29uOiB0cnVlLCBsYWJlbDogZmFsc2UsIGtleWJpbmRpbmc6IHRoaXMuX2dldEtleWJpbmRpbmdMYWJlbChhY3Rpb24pIH0pKTtcblx0XHRcdFx0dGhpcy5fYWN0aW9uRGlzcG9zYWJsZXMuc2V0KGFjdGlvbi5pZCwgc3RvcmUpO1xuXHRcdFx0XHRyZXR1cm4gaXRlbTtcblx0XHRcdH1cblx0XHRcdGNhc2UgVGVybWluYWxDb21tYW5kSWQuU3dpdGNoVGVybWluYWw6IHtcblx0XHRcdFx0Y29uc3QgaXRlbSA9IHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFN3aXRjaFRlcm1pbmFsQWN0aW9uVmlld0l0ZW0sIGFjdGlvbik7XG5cdFx0XHRcdHRoaXMuX2FjdGlvbkRpc3Bvc2FibGVzLnNldChhY3Rpb24uaWQsIGl0ZW0pO1xuXHRcdFx0XHRyZXR1cm4gaXRlbTtcblx0XHRcdH1cblx0XHRcdGNhc2UgVGVybWluYWxDb21tYW5kSWQuRm9jdXM6IHtcblx0XHRcdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uKSB7XG5cdFx0XHRcdFx0Y29uc3QgYWN0aW9ucyA9IGdldEZsYXRDb250ZXh0TWVudUFjdGlvbnModGhpcy5fc2luZ2xlVGFiTWVudS5nZXRBY3Rpb25zKHsgc2hvdWxkRm9yd2FyZEFyZ3M6IHRydWUgfSkpO1xuXHRcdFx0XHRcdGNvbnN0IGl0ZW0gPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTaW5nbGVUZXJtaW5hbFRhYkFjdGlvblZpZXdJdGVtLCBhY3Rpb24sIGFjdGlvbnMpO1xuXHRcdFx0XHRcdHRoaXMuX2FjdGlvbkRpc3Bvc2FibGVzLnNldChhY3Rpb24uaWQsIGl0ZW0pO1xuXHRcdFx0XHRcdHJldHVybiBpdGVtO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBUZXJtaW5hbENvbW1hbmRJZC5OZXc6IHtcblx0XHRcdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIE1lbnVJdGVtQWN0aW9uKSB7XG5cdFx0XHRcdFx0Y29uc3QgYWN0aW9ucyA9IGdldFRlcm1pbmFsQWN0aW9uQmFyQXJncyhUZXJtaW5hbExvY2F0aW9uLlBhbmVsLCB0aGlzLl90ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLmF2YWlsYWJsZVByb2ZpbGVzLCB0aGlzLl9nZXREZWZhdWx0UHJvZmlsZU5hbWUoKSwgdGhpcy5fdGVybWluYWxQcm9maWxlU2VydmljZS5jb250cmlidXRlZFByb2ZpbGVzLCB0aGlzLl90ZXJtaW5hbFNlcnZpY2UsIHRoaXMuX2Ryb3Bkb3duTWVudSwgdGhpcy5fZGlzcG9zYWJsZVN0b3JlKTtcblx0XHRcdFx0XHR0aGlzLl9uZXdEcm9wZG93bi52YWx1ZSA9IG5ldyBEcm9wZG93bldpdGhQcmltYXJ5QWN0aW9uVmlld0l0ZW0oYWN0aW9uLCBhY3Rpb25zLmRyb3Bkb3duQWN0aW9uLCBhY3Rpb25zLmRyb3Bkb3duTWVudUFjdGlvbnMsIGFjdGlvbnMuY2xhc3NOYW1lLCB7IGhvdmVyRGVsZWdhdGU6IG9wdGlvbnMuaG92ZXJEZWxlZ2F0ZSB9LCB0aGlzLl9jb250ZXh0TWVudVNlcnZpY2UsIHRoaXMuX2tleWJpbmRpbmdTZXJ2aWNlLCB0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLCB0aGlzLl9jb250ZXh0S2V5U2VydmljZSwgdGhpcy5fdGhlbWVTZXJ2aWNlLCB0aGlzLl9hY2Nlc3NpYmlsaXR5U2VydmljZSk7XG5cdFx0XHRcdFx0dGhpcy5fbmV3RHJvcGRvd24udmFsdWU/LnVwZGF0ZShhY3Rpb25zLmRyb3Bkb3duQWN0aW9uLCBhY3Rpb25zLmRyb3Bkb3duTWVudUFjdGlvbnMpO1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9uZXdEcm9wZG93bi52YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gc3VwZXIuY3JlYXRlQWN0aW9uVmlld0l0ZW0oYWN0aW9uLCBvcHRpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldERlZmF1bHRQcm9maWxlTmFtZSgpOiBzdHJpbmcge1xuXHRcdGxldCBkZWZhdWx0UHJvZmlsZU5hbWU7XG5cdFx0dHJ5IHtcblx0XHRcdGRlZmF1bHRQcm9maWxlTmFtZSA9IHRoaXMuX3Rlcm1pbmFsUHJvZmlsZVNlcnZpY2UuZ2V0RGVmYXVsdFByb2ZpbGVOYW1lKCk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0ZGVmYXVsdFByb2ZpbGVOYW1lID0gdGhpcy5fdGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlLmRlZmF1bHRQcm9maWxlTmFtZTtcblx0XHR9XG5cdFx0cmV0dXJuIGRlZmF1bHRQcm9maWxlTmFtZSE7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRLZXliaW5kaW5nTGFiZWwoYWN0aW9uOiBJQWN0aW9uKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fa2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhhY3Rpb24uaWQpPy5nZXRMYWJlbCgpID8/IHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZVRhYkFjdGlvbkJhcihwcm9maWxlczogSVRlcm1pbmFsUHJvZmlsZVtdKTogdm9pZCB7XG5cdFx0Y29uc3QgYWN0aW9ucyA9IGdldFRlcm1pbmFsQWN0aW9uQmFyQXJncyhUZXJtaW5hbExvY2F0aW9uLlBhbmVsLCBwcm9maWxlcywgdGhpcy5fZ2V0RGVmYXVsdFByb2ZpbGVOYW1lKCksIHRoaXMuX3Rlcm1pbmFsUHJvZmlsZVNlcnZpY2UuY29udHJpYnV0ZWRQcm9maWxlcywgdGhpcy5fdGVybWluYWxTZXJ2aWNlLCB0aGlzLl9kcm9wZG93bk1lbnUsIHRoaXMuX2Rpc3Bvc2FibGVTdG9yZSk7XG5cdFx0dGhpcy5fbmV3RHJvcGRvd24udmFsdWU/LnVwZGF0ZShhY3Rpb25zLmRyb3Bkb3duQWN0aW9uLCBhY3Rpb25zLmRyb3Bkb3duTWVudUFjdGlvbnMpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZm9jdXMoKSB7XG5cdFx0c3VwZXIuZm9jdXMoKTtcblx0XHRpZiAodGhpcy5fdGVybWluYWxTZXJ2aWNlLmNvbm5lY3Rpb25TdGF0ZSA9PT0gVGVybWluYWxDb25uZWN0aW9uU3RhdGUuQ29ubmVjdGVkKSB7XG5cdFx0XHRpZiAodGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuaW5zdGFuY2VzLmxlbmd0aCA9PT0gMCAmJiAhdGhpcy5faXNUZXJtaW5hbEJlaW5nQ3JlYXRlZCkge1xuXHRcdFx0XHR0aGlzLl9pc1Rlcm1pbmFsQmVpbmdDcmVhdGVkID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5fdGVybWluYWxTZXJ2aWNlLmNyZWF0ZVRlcm1pbmFsKHsgbG9jYXRpb246IFRlcm1pbmFsTG9jYXRpb24uUGFuZWwgfSkuZmluYWxseSgoKSA9PiB0aGlzLl9pc1Rlcm1pbmFsQmVpbmdDcmVhdGVkID0gZmFsc2UpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2Uuc2hvd1BhbmVsKHRydWUpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIElmIHRoZSB0ZXJtaW5hbCBpcyB3YWl0aW5nIHRvIHJlY29ubmVjdCB0byByZW1vdGUgdGVybWluYWxzLCB0aGVuIHRoZXJlIGlzIG5vIFRlcm1pbmFsSW5zdGFuY2UgeWV0IHRoYXQgY2FuXG5cdFx0Ly8gYmUgZm9jdXNlZC4gU28gd2FpdCBmb3IgY29ubmVjdGlvbiB0byBmaW5pc2gsIHRoZW4gZm9jdXMuXG5cdFx0Y29uc3QgcHJldmlvdXNBY3RpdmVFbGVtZW50ID0gdGhpcy5lbGVtZW50Lm93bmVyRG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcblx0XHRpZiAocHJldmlvdXNBY3RpdmVFbGVtZW50KSB7XG5cdFx0XHQvLyBUT0RPOiBJbXByb3ZlIGxpZmVjeWNsZSBtYW5hZ2VtZW50IHRoaXMgZXZlbnQgc2hvdWxkIGJlIGRpc3Bvc2VkIGFmdGVyIGZpcnN0IGZpcmVcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Rlcm1pbmFsU2VydmljZS5vbkRpZENoYW5nZUNvbm5lY3Rpb25TdGF0ZSgoKSA9PiB7XG5cdFx0XHRcdC8vIE9ubHkgZm9jdXMgdGhlIHRlcm1pbmFsIGlmIHRoZSBhY3RpdmVFbGVtZW50IGhhcyBub3QgY2hhbmdlZCBzaW5jZSBmb2N1cygpIHdhcyBjYWxsZWRcblx0XHRcdFx0Ly8gVE9ETzogSGFja1xuXHRcdFx0XHRpZiAocHJldmlvdXNBY3RpdmVFbGVtZW50ICYmIGRvbS5pc0FjdGl2ZUVsZW1lbnQocHJldmlvdXNBY3RpdmVFbGVtZW50KSkge1xuXHRcdFx0XHRcdHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLnNob3dQYW5lbCh0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2hhc1dlbGNvbWVTY3JlZW4oKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICF0aGlzLl90ZXJtaW5hbFNlcnZpY2UuaXNQcm9jZXNzU3VwcG9ydFJlZ2lzdGVyZWQ7XG5cdH1cblxuXHRvdmVycmlkZSBzaG91bGRTaG93V2VsY29tZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faGFzV2VsY29tZVNjcmVlbigpICYmIHRoaXMuX3Rlcm1pbmFsU2VydmljZS5pbnN0YW5jZXMubGVuZ3RoID09PSAwO1xuXHR9XG59XG5cbmNsYXNzIFN3aXRjaFRlcm1pbmFsQWN0aW9uVmlld0l0ZW0gZXh0ZW5kcyBTZWxlY3RBY3Rpb25WaWV3SXRlbSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdGFjdGlvbjogSUFjdGlvbixcblx0XHRASVRlcm1pbmFsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbFNlcnZpY2U6IElUZXJtaW5hbFNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbEdyb3VwU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbEdyb3VwU2VydmljZTogSVRlcm1pbmFsR3JvdXBTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dFZpZXdTZXJ2aWNlIGNvbnRleHRWaWV3U2VydmljZTogSUNvbnRleHRWaWV3U2VydmljZSxcblx0XHRASVRlcm1pbmFsUHJvZmlsZVNlcnZpY2UgdGVybWluYWxQcm9maWxlU2VydmljZTogSVRlcm1pbmFsUHJvZmlsZVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIobnVsbCwgYWN0aW9uLCBnZXRUZXJtaW5hbFNlbGVjdE9wZW5JdGVtcyhfdGVybWluYWxTZXJ2aWNlLCBfdGVybWluYWxHcm91cFNlcnZpY2UpLCBfdGVybWluYWxHcm91cFNlcnZpY2UuYWN0aXZlR3JvdXBJbmRleCwgY29udGV4dFZpZXdTZXJ2aWNlLCBkZWZhdWx0U2VsZWN0Qm94U3R5bGVzLCB7IGFyaWFMYWJlbDogbmxzLmxvY2FsaXplKCd0ZXJtaW5hbHMnLCAnT3BlbiBUZXJtaW5hbHMuJyksIG9wdGlvbnNBc0NoaWxkcmVuOiB0cnVlIH0pO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKF90ZXJtaW5hbFNlcnZpY2Uub25EaWRDaGFuZ2VJbnN0YW5jZXMoKCkgPT4gdGhpcy5fdXBkYXRlSXRlbXMoKSwgdGhpcykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKF90ZXJtaW5hbFNlcnZpY2Uub25EaWRDaGFuZ2VBY3RpdmVHcm91cCgoKSA9PiB0aGlzLl91cGRhdGVJdGVtcygpLCB0aGlzKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoX3Rlcm1pbmFsU2VydmljZS5vbkRpZENoYW5nZUFjdGl2ZUluc3RhbmNlKCgpID0+IHRoaXMuX3VwZGF0ZUl0ZW1zKCksIHRoaXMpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihfdGVybWluYWxTZXJ2aWNlLm9uQW55SW5zdGFuY2VUaXRsZUNoYW5nZSgoKSA9PiB0aGlzLl91cGRhdGVJdGVtcygpLCB0aGlzKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLm9uRGlkQ2hhbmdlR3JvdXBzKCgpID0+IHRoaXMuX3VwZGF0ZUl0ZW1zKCksIHRoaXMpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihfdGVybWluYWxTZXJ2aWNlLm9uRGlkQ2hhbmdlQ29ubmVjdGlvblN0YXRlKCgpID0+IHRoaXMuX3VwZGF0ZUl0ZW1zKCksIHRoaXMpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0ZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLm9uRGlkQ2hhbmdlQXZhaWxhYmxlUHJvZmlsZXMoKCkgPT4gdGhpcy5fdXBkYXRlSXRlbXMoKSwgdGhpcykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKF90ZXJtaW5hbFNlcnZpY2Uub25BbnlJbnN0YW5jZVByaW1hcnlTdGF0dXNDaGFuZ2UoKCkgPT4gdGhpcy5fdXBkYXRlSXRlbXMoKSwgdGhpcykpO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXIoY29udGFpbmVyKTtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnc3dpdGNoLXRlcm1pbmFsJyk7XG5cdFx0Y29udGFpbmVyLnN0eWxlLmJvcmRlckNvbG9yID0gYXNDc3NWYXJpYWJsZShzZWxlY3RCb3JkZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlSXRlbXMoKTogdm9pZCB7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IGdldFRlcm1pbmFsU2VsZWN0T3Blbkl0ZW1zKHRoaXMuX3Rlcm1pbmFsU2VydmljZSwgdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UpO1xuXHRcdHRoaXMuc2V0T3B0aW9ucyhvcHRpb25zLCB0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5hY3RpdmVHcm91cEluZGV4KTtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRUZXJtaW5hbFNlbGVjdE9wZW5JdGVtcyh0ZXJtaW5hbFNlcnZpY2U6IElUZXJtaW5hbFNlcnZpY2UsIHRlcm1pbmFsR3JvdXBTZXJ2aWNlOiBJVGVybWluYWxHcm91cFNlcnZpY2UpOiBJU2VsZWN0T3B0aW9uSXRlbVtdIHtcblx0bGV0IGl0ZW1zOiBJU2VsZWN0T3B0aW9uSXRlbVtdO1xuXHRpZiAodGVybWluYWxTZXJ2aWNlLmNvbm5lY3Rpb25TdGF0ZSA9PT0gVGVybWluYWxDb25uZWN0aW9uU3RhdGUuQ29ubmVjdGVkKSB7XG5cdFx0aXRlbXMgPSB0ZXJtaW5hbEdyb3VwU2VydmljZS5nZXRHcm91cExhYmVscygpLm1hcChsYWJlbCA9PiB7XG5cdFx0XHRyZXR1cm4geyB0ZXh0OiBsYWJlbCB9O1xuXHRcdH0pO1xuXHR9IGVsc2Uge1xuXHRcdGl0ZW1zID0gW3sgdGV4dDogbmxzLmxvY2FsaXplKCd0ZXJtaW5hbENvbm5lY3RpbmdMYWJlbCcsIFwiU3RhcnRpbmcuLi5cIikgfV07XG5cdH1cblx0aXRlbXMucHVzaCh7IHRleHQ6IHN3aXRjaFRlcm1pbmFsQWN0aW9uVmlld0l0ZW1TZXBhcmF0b3IsIGlzRGlzYWJsZWQ6IHRydWUgfSk7XG5cdGl0ZW1zLnB1c2goeyB0ZXh0OiBzd2l0Y2hUZXJtaW5hbFNob3dUYWJzVGl0bGUgfSk7XG5cdHJldHVybiBpdGVtcztcbn1cblxuY2xhc3MgU2luZ2xlVGVybWluYWxUYWJBY3Rpb25WaWV3SXRlbSBleHRlbmRzIE1lbnVFbnRyeUFjdGlvblZpZXdJdGVtIHtcblx0cHJpdmF0ZSBfY29sb3I6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfYWx0Q29tbWFuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9jbGFzczogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9lbGVtZW50RGlzcG9zYWJsZXM6IElEaXNwb3NhYmxlW10gPSBbXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRhY3Rpb246IE1lbnVJdGVtQWN0aW9uLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2FjdGlvbnM6IElBY3Rpb25bXSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxTZXJ2aWNlOiBJVGVybWluYWxTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hQ29uZmlndXJhdGlvblNlcnZpY2U6IElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxHcm91cFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxHcm91cFNlcnZpY2U6IElUZXJtaW5hbEdyb3VwU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTZXJ2aWNlIF9hY2Nlc3NpYmlsaXR5U2VydmljZTogSUFjY2Vzc2liaWxpdHlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKGFjdGlvbiwge1xuXHRcdFx0ZHJhZ2dhYmxlOiB0cnVlLFxuXHRcdFx0aG92ZXJEZWxlZ2F0ZTogX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNpbmdsZVRhYkhvdmVyRGVsZWdhdGUpXG5cdFx0fSwga2V5YmluZGluZ1NlcnZpY2UsIG5vdGlmaWNhdGlvblNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwgX2FjY2Vzc2liaWxpdHlTZXJ2aWNlKTtcblxuXHRcdC8vIFJlZ2lzdGVyIGxpc3RlbmVycyB0byB1cGRhdGUgdGhlIHRhYlxuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmRlYm91bmNlPElUZXJtaW5hbEluc3RhbmNlIHwgdW5kZWZpbmVkLCBTZXQ8SVRlcm1pbmFsSW5zdGFuY2U+PihFdmVudC5hbnkoXG5cdFx0XHR0aGlzLl90ZXJtaW5hbFNlcnZpY2Uub25BbnlJbnN0YW5jZVByaW1hcnlTdGF0dXNDaGFuZ2UsXG5cdFx0XHR0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5vbkRpZENoYW5nZUFjdGl2ZUluc3RhbmNlLFxuXHRcdFx0RXZlbnQubWFwKHRoaXMuX3Rlcm1pbmFsU2VydmljZS5vbkFueUluc3RhbmNlSWNvbkNoYW5nZSwgZSA9PiBlLmluc3RhbmNlKSxcblx0XHRcdHRoaXMuX3Rlcm1pbmFsU2VydmljZS5vbkFueUluc3RhbmNlVGl0bGVDaGFuZ2UsXG5cdFx0XHR0aGlzLl90ZXJtaW5hbFNlcnZpY2Uub25EaWRDaGFuZ2VJbnN0YW5jZUNhcGFiaWxpdHksXG5cdFx0KSwgKGxhc3QsIGUpID0+IHtcblx0XHRcdGlmICghbGFzdCkge1xuXHRcdFx0XHRsYXN0ID0gbmV3IFNldCgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUpIHtcblx0XHRcdFx0bGFzdC5hZGQoZSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbGFzdDtcblx0XHR9LCBNaWNyb3Rhc2tEZWxheSkobWVyZ2VkID0+IHtcblx0XHRcdGZvciAoY29uc3QgZSBvZiBtZXJnZWQpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVMYWJlbChlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBDbGVhbiB1cCBvbiBkaXNwb3NlXG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IGRpc3Bvc2UodGhpcy5fZWxlbWVudERpc3Bvc2FibGVzKSkpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgb25DbGljayhldmVudDogTW91c2VFdmVudCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLmxhc3RBY2Nlc3NlZE1lbnUgPSAnaW5saW5lLXRhYic7XG5cdFx0aWYgKGV2ZW50LmFsdEtleSAmJiB0aGlzLl9tZW51SXRlbUFjdGlvbi5hbHQpIHtcblx0XHRcdHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKHRoaXMuX21lbnVJdGVtQWN0aW9uLmFsdC5pZCwgeyBsb2NhdGlvbjogVGVybWluYWxMb2NhdGlvbi5QYW5lbCB9IHNhdGlzZmllcyBJQ3JlYXRlVGVybWluYWxPcHRpb25zKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fb3BlbkNvbnRleHRNZW51KCk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIEB0eXBlc2NyaXB0LWVzbGludC9uYW1pbmctY29udmVudGlvblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgdXBkYXRlTGFiZWwoZT86IElUZXJtaW5hbEluc3RhbmNlKTogdm9pZCB7XG5cdFx0Ly8gT25seSB1cGRhdGUgaWYgaXQncyB0aGUgYWN0aXZlIGluc3RhbmNlXG5cdFx0aWYgKGUgJiYgZSAhPT0gdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuYWN0aXZlSW5zdGFuY2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fZWxlbWVudERpc3Bvc2FibGVzLmxlbmd0aCA9PT0gMCAmJiB0aGlzLmVsZW1lbnQgJiYgdGhpcy5sYWJlbCkge1xuXHRcdFx0Ly8gUmlnaHQgY2xpY2sgb3BlbnMgY29udGV4dCBtZW51XG5cdFx0XHR0aGlzLl9lbGVtZW50RGlzcG9zYWJsZXMucHVzaChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuZWxlbWVudCwgZG9tLkV2ZW50VHlwZS5DT05URVhUX01FTlUsIGUgPT4ge1xuXHRcdFx0XHRpZiAoZS5idXR0b24gPT09IDIpIHtcblx0XHRcdFx0XHR0aGlzLl9vcGVuQ29udGV4dE1lbnUoKTtcblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHRcdC8vIE1pZGRsZSBjbGljayBraWxsc1xuXHRcdFx0dGhpcy5fZWxlbWVudERpc3Bvc2FibGVzLnB1c2goZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmVsZW1lbnQsIGRvbS5FdmVudFR5cGUuQVVYQ0xJQ0ssIGUgPT4ge1xuXHRcdFx0XHRpZiAoZS5idXR0b24gPT09IDEpIHtcblx0XHRcdFx0XHRjb25zdCBpbnN0YW5jZSA9IHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLmFjdGl2ZUluc3RhbmNlO1xuXHRcdFx0XHRcdGlmIChpbnN0YW5jZSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fdGVybWluYWxTZXJ2aWNlLnNhZmVEaXNwb3NlVGVybWluYWwoaW5zdGFuY2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHRcdC8vIERyYWcgYW5kIGRyb3Bcblx0XHRcdHRoaXMuX2VsZW1lbnREaXNwb3NhYmxlcy5wdXNoKGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5lbGVtZW50LCBkb20uRXZlbnRUeXBlLkRSQUdfU1RBUlQsIGUgPT4ge1xuXHRcdFx0XHRjb25zdCBpbnN0YW5jZSA9IHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLmFjdGl2ZUluc3RhbmNlO1xuXHRcdFx0XHRpZiAoZS5kYXRhVHJhbnNmZXIgJiYgaW5zdGFuY2UpIHtcblx0XHRcdFx0XHRlLmRhdGFUcmFuc2Zlci5zZXREYXRhKFRlcm1pbmFsRGF0YVRyYW5zZmVycy5UZXJtaW5hbHMsIEpTT04uc3RyaW5naWZ5KFtpbnN0YW5jZS5yZXNvdXJjZS50b1N0cmluZygpXSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLmxhYmVsKSB7XG5cdFx0XHRjb25zdCBsYWJlbCA9IHRoaXMubGFiZWw7XG5cdFx0XHRjb25zdCBpbnN0YW5jZSA9IHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLmFjdGl2ZUluc3RhbmNlO1xuXHRcdFx0aWYgKCFpbnN0YW5jZSkge1xuXHRcdFx0XHRkb20ucmVzZXQobGFiZWwsICcnKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0bGFiZWwuY2xhc3NMaXN0LmFkZCgnc2luZ2xlLXRlcm1pbmFsLXRhYicpO1xuXHRcdFx0bGV0IGNvbG9yU3R5bGUgPSAnJztcblx0XHRcdGNvbnN0IHByaW1hcnlTdGF0dXMgPSBpbnN0YW5jZS5zdGF0dXNMaXN0LnByaW1hcnk7XG5cdFx0XHRpZiAocHJpbWFyeVN0YXR1cykge1xuXHRcdFx0XHRjb25zdCBjb2xvcktleSA9IGdldENvbG9yRm9yU2V2ZXJpdHkocHJpbWFyeVN0YXR1cy5zZXZlcml0eSk7XG5cdFx0XHRcdHRoaXMuX3RoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCk7XG5cdFx0XHRcdGNvbnN0IGZvdW5kQ29sb3IgPSB0aGlzLl90aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpLmdldENvbG9yKGNvbG9yS2V5KTtcblx0XHRcdFx0aWYgKGZvdW5kQ29sb3IpIHtcblx0XHRcdFx0XHRjb2xvclN0eWxlID0gZm91bmRDb2xvci50b1N0cmluZygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRsYWJlbC5zdHlsZS5jb2xvciA9IGNvbG9yU3R5bGU7XG5cdFx0XHRkb20ucmVzZXQobGFiZWwsIC4uLnJlbmRlckxhYmVsV2l0aEljb25zKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGdldFNpbmdsZVRhYkxhYmVsLCBpbnN0YW5jZSwgdGhpcy5fdGVybWluYUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmNvbmZpZy50YWJzLnNlcGFyYXRvciwgVGhlbWVJY29uLmlzVGhlbWVJY29uKHRoaXMuX2NvbW1hbmRBY3Rpb24uaXRlbS5pY29uKSA/IHRoaXMuX2NvbW1hbmRBY3Rpb24uaXRlbS5pY29uIDogdW5kZWZpbmVkKSkpO1xuXG5cdFx0XHRpZiAodGhpcy5fYWx0Q29tbWFuZCkge1xuXHRcdFx0XHRsYWJlbC5jbGFzc0xpc3QucmVtb3ZlKHRoaXMuX2FsdENvbW1hbmQpO1xuXHRcdFx0XHR0aGlzLl9hbHRDb21tYW5kID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuX2NvbG9yKSB7XG5cdFx0XHRcdGxhYmVsLmNsYXNzTGlzdC5yZW1vdmUodGhpcy5fY29sb3IpO1xuXHRcdFx0XHR0aGlzLl9jb2xvciA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLl9jbGFzcykge1xuXHRcdFx0XHRsYWJlbC5jbGFzc0xpc3QucmVtb3ZlKHRoaXMuX2NsYXNzKTtcblx0XHRcdFx0bGFiZWwuY2xhc3NMaXN0LnJlbW92ZSgndGVybWluYWwtdXJpLWljb24nKTtcblx0XHRcdFx0dGhpcy5fY2xhc3MgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBjb2xvckNsYXNzID0gZ2V0Q29sb3JDbGFzcyhpbnN0YW5jZSk7XG5cdFx0XHRpZiAoY29sb3JDbGFzcykge1xuXHRcdFx0XHR0aGlzLl9jb2xvciA9IGNvbG9yQ2xhc3M7XG5cdFx0XHRcdGxhYmVsLmNsYXNzTGlzdC5hZGQoY29sb3JDbGFzcyk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB1cmlDbGFzc2VzID0gZ2V0VXJpQ2xhc3NlcyhpbnN0YW5jZSwgdGhpcy5fdGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKS50eXBlKTtcblx0XHRcdGlmICh1cmlDbGFzc2VzKSB7XG5cdFx0XHRcdHRoaXMuX2NsYXNzID0gdXJpQ2xhc3Nlcz8uWzBdO1xuXHRcdFx0XHRsYWJlbC5jbGFzc0xpc3QuYWRkKC4uLnVyaUNsYXNzZXMpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuX2NvbW1hbmRBY3Rpb24uaXRlbS5pY29uKSB7XG5cdFx0XHRcdHRoaXMuX2FsdENvbW1hbmQgPSBgYWx0LWNvbW1hbmRgO1xuXHRcdFx0XHRsYWJlbC5jbGFzc0xpc3QuYWRkKHRoaXMuX2FsdENvbW1hbmQpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy51cGRhdGVUb29sdGlwKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfb3BlbkNvbnRleHRNZW51KCkge1xuXHRcdGNvbnN0IGFjdGlvblJ1bm5lciA9IG5ldyBUZXJtaW5hbENvbnRleHRBY3Rpb25SdW5uZXIoKTtcblx0XHR0aGlzLl9jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdGFjdGlvblJ1bm5lcixcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gdGhpcy5lbGVtZW50ISxcblx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHRoaXMuX2FjdGlvbnMsXG5cdFx0XHQvLyBUaGUgY29udGV4dCBpcyBhbHdheXMgdGhlIGFjdGl2ZSBpbnN0YW5jZSBpbiB0aGUgdGVybWluYWwgdmlld1xuXHRcdFx0Z2V0QWN0aW9uc0NvbnRleHQ6ICgpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5zdGFuY2UgPSB0aGlzLl90ZXJtaW5hbEdyb3VwU2VydmljZS5hY3RpdmVJbnN0YW5jZTtcblx0XHRcdFx0cmV0dXJuIGluc3RhbmNlID8gW25ldyBJbnN0YW5jZUNvbnRleHQoaW5zdGFuY2UpXSA6IFtdO1xuXHRcdFx0fSxcblx0XHRcdG9uSGlkZTogKCkgPT4gYWN0aW9uUnVubmVyLmRpc3Bvc2UoKVxuXHRcdH0pO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGdldFNpbmdsZVRhYkxhYmVsKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UgfCB1bmRlZmluZWQsIHNlcGFyYXRvcjogc3RyaW5nLCBpY29uPzogVGhlbWVJY29uKSB7XG5cdC8vIERvbid0IGV2ZW4gc2hvdyB0aGUgaWNvbiBpZiB0aGVyZSBpcyBubyB0aXRsZSBhcyB0aGUgaWNvbiB3b3VsZCBzaGlmdCBhcm91bmQgd2hlbiB0aGUgdGl0bGVcblx0Ly8gaXMgYWRkZWRcblx0aWYgKCFpbnN0YW5jZSB8fCAhaW5zdGFuY2UudGl0bGUpIHtcblx0XHRyZXR1cm4gJyc7XG5cdH1cblx0Y29uc3QgaWNvbklkID0gVGhlbWVJY29uLmlzVGhlbWVJY29uKGluc3RhbmNlLmljb24pID8gaW5zdGFuY2UuaWNvbi5pZCA6IGFjY2Vzc29yLmdldChJVGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlKS5nZXREZWZhdWx0SWNvbigpLmlkO1xuXHRjb25zdCBsYWJlbCA9IGAkKCR7aWNvbj8uaWQgfHwgaWNvbklkfSkgJHtnZXRTaW5nbGVUYWJUaXRsZShpbnN0YW5jZSwgc2VwYXJhdG9yKX1gO1xuXG5cdGNvbnN0IHByaW1hcnlTdGF0dXMgPSBpbnN0YW5jZS5zdGF0dXNMaXN0LnByaW1hcnk7XG5cdGlmICghcHJpbWFyeVN0YXR1cz8uaWNvbikge1xuXHRcdHJldHVybiBsYWJlbDtcblx0fVxuXHRyZXR1cm4gYCR7bGFiZWx9ICQoJHtwcmltYXJ5U3RhdHVzLmljb24uaWR9KWA7XG59XG5cbmZ1bmN0aW9uIGdldFNpbmdsZVRhYlRpdGxlKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSB8IHVuZGVmaW5lZCwgc2VwYXJhdG9yOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRpZiAoIWluc3RhbmNlKSB7XG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cdHJldHVybiAhaW5zdGFuY2UuZGVzY3JpcHRpb24gPyBpbnN0YW5jZS50aXRsZSA6IGAke2luc3RhbmNlLnRpdGxlfSAke3NlcGFyYXRvcn0gJHtpbnN0YW5jZS5kZXNjcmlwdGlvbn1gO1xufVxuXG5jbGFzcyBUZXJtaW5hbFRoZW1lSWNvblN0eWxlIGV4dGVuZHMgVGhlbWFibGUge1xuXHRwcml2YXRlIF9zdHlsZUVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASVRlcm1pbmFsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbFNlcnZpY2U6IElUZXJtaW5hbFNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbEdyb3VwU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbEdyb3VwU2VydmljZTogSVRlcm1pbmFsR3JvdXBTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKF90aGVtZVNlcnZpY2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdFx0dGhpcy5fc3R5bGVFbGVtZW50ID0gZG9tU3R5bGVzaGVldHNKcy5jcmVhdGVTdHlsZVNoZWV0KGNvbnRhaW5lcik7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMuX3N0eWxlRWxlbWVudC5yZW1vdmUoKSkpO1xuXHRcdHRoaXMudXBkYXRlU3R5bGVzKCk7XG5cdH1cblxuXHRwcml2YXRlIF9yZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90ZXJtaW5hbFNlcnZpY2Uub25BbnlJbnN0YW5jZUljb25DaGFuZ2UoKCkgPT4gdGhpcy51cGRhdGVTdHlsZXMoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Rlcm1pbmFsU2VydmljZS5vbkRpZENoYW5nZUluc3RhbmNlcygoKSA9PiB0aGlzLnVwZGF0ZVN0eWxlcygpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2Uub25EaWRDaGFuZ2VHcm91cHMoKCkgPT4gdGhpcy51cGRhdGVTdHlsZXMoKSkpO1xuXHR9XG5cblx0b3ZlcnJpZGUgdXBkYXRlU3R5bGVzKCk6IHZvaWQge1xuXHRcdHN1cGVyLnVwZGF0ZVN0eWxlcygpO1xuXHRcdGNvbnN0IGNvbG9yVGhlbWUgPSB0aGlzLl90aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpO1xuXG5cdFx0Ly8gVE9ETzogYWRkIGEgcnVsZSBjb2xsZWN0b3IgdG8gYXZvaWQgZHVwbGljYXRpb25cblx0XHRsZXQgY3NzID0gJyc7XG5cblx0XHQvLyBBZGQgaWNvbnNcblx0XHRmb3IgKGNvbnN0IGluc3RhbmNlIG9mIHRoaXMuX3Rlcm1pbmFsU2VydmljZS5pbnN0YW5jZXMpIHtcblx0XHRcdGNvbnN0IGljb24gPSBpbnN0YW5jZS5pY29uO1xuXHRcdFx0aWYgKCFpY29uKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0bGV0IHVyaSA9IHVuZGVmaW5lZDtcblx0XHRcdGlmIChpY29uIGluc3RhbmNlb2YgVVJJKSB7XG5cdFx0XHRcdHVyaSA9IGljb247XG5cdFx0XHR9IGVsc2UgaWYgKGljb24gaW5zdGFuY2VvZiBPYmplY3QgJiYgJ2xpZ2h0JyBpbiBpY29uICYmICdkYXJrJyBpbiBpY29uKSB7XG5cdFx0XHRcdHVyaSA9IGNvbG9yVGhlbWUudHlwZSA9PT0gQ29sb3JTY2hlbWUuTElHSFQgPyBpY29uLmxpZ2h0IDogaWNvbi5kYXJrO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaWNvbkNsYXNzZXMgPSBnZXRVcmlDbGFzc2VzKGluc3RhbmNlLCBjb2xvclRoZW1lLnR5cGUpO1xuXHRcdFx0aWYgKHVyaSBpbnN0YW5jZW9mIFVSSSAmJiBpY29uQ2xhc3NlcyAmJiBpY29uQ2xhc3Nlcy5sZW5ndGggPiAxKSB7XG5cdFx0XHRcdGNzcyArPSAoXG5cdFx0XHRcdFx0YC5tb25hY28td29ya2JlbmNoIC4ke2ljb25DbGFzc2VzWzBdfSAubW9uYWNvLWhpZ2hsaWdodGVkLWxhYmVsIC5jb2RpY29uLCAubW9uYWNvLWFjdGlvbi1iYXIgLnRlcm1pbmFsLXVyaS1pY29uLnNpbmdsZS10ZXJtaW5hbC10YWIuYWN0aW9uLWxhYmVsOm5vdCguYWx0LWNvbW1hbmQpIC5jb2RpY29uYCArXG5cdFx0XHRcdFx0YHtiYWNrZ3JvdW5kLWltYWdlOiAke2Nzc0pzLmFzQ1NTVXJsKHVyaSl9O31gXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQWRkIGNvbG9yc1xuXHRcdGZvciAoY29uc3QgaW5zdGFuY2Ugb2YgdGhpcy5fdGVybWluYWxTZXJ2aWNlLmluc3RhbmNlcykge1xuXHRcdFx0Y29uc3QgY29sb3JDbGFzcyA9IGdldENvbG9yQ2xhc3MoaW5zdGFuY2UpO1xuXHRcdFx0aWYgKCFjb2xvckNsYXNzIHx8ICFpbnN0YW5jZS5jb2xvcikge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGNvbG9yID0gY29sb3JUaGVtZS5nZXRDb2xvcihpbnN0YW5jZS5jb2xvcik7XG5cdFx0XHRpZiAoY29sb3IpIHtcblx0XHRcdFx0Ly8gZXhjbHVkZSBzdGF0dXMgaWNvbnMgKGZpbGUtaWNvbikgYW5kIGlubGluZSBhY3Rpb24gaWNvbnMgKHRyYXNoY2FuLCBob3Jpem9udGFsU3BsaXQsIHJlcnVuVGFzaylcblx0XHRcdFx0Y3NzICs9IChcblx0XHRcdFx0XHRgLm1vbmFjby13b3JrYmVuY2ggLiR7Y29sb3JDbGFzc30gLmNvZGljb246Zmlyc3QtY2hpbGQ6bm90KC5jb2RpY29uLXNwbGl0LWhvcml6b250YWwpOm5vdCguY29kaWNvbi10cmFzaGNhbik6bm90KC5maWxlLWljb24pOm5vdCguY29kaWNvbi1yZXJ1bi10YXNrKWAgK1xuXHRcdFx0XHRcdGB7IGNvbG9yOiAke2NvbG9yfSAhaW1wb3J0YW50OyB9YFxuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX3N0eWxlRWxlbWVudC50ZXh0Q29udGVudCA9IGNzcztcblx0fVxufVxuXG5jbGFzcyBTaW5nbGVUYWJIb3ZlckRlbGVnYXRlIGltcGxlbWVudHMgSUhvdmVyRGVsZWdhdGUge1xuXHRwcml2YXRlIF9sYXN0SG92ZXJIaWRlVGltZTogbnVtYmVyID0gMDtcblxuXHRyZWFkb25seSBwbGFjZW1lbnQgPSAnZWxlbWVudCc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3N0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbEdyb3VwU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbEdyb3VwU2VydmljZTogSVRlcm1pbmFsR3JvdXBTZXJ2aWNlLFxuXHQpIHtcblx0fVxuXG5cdGdldCBkZWxheSgpOiBudW1iZXIge1xuXHRcdHJldHVybiBEYXRlLm5vdygpIC0gdGhpcy5fbGFzdEhvdmVySGlkZVRpbWUgPCAyMDBcblx0XHRcdD8gMCAgLy8gc2hvdyBpbnN0YW50bHkgd2hlbiBhIGhvdmVyIHdhcyByZWNlbnRseSBzaG93blxuXHRcdFx0OiB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KCd3b3JrYmVuY2guaG92ZXIuZGVsYXknKTtcblx0fVxuXG5cdHNob3dIb3ZlcihvcHRpb25zOiBJSG92ZXJEZWxlZ2F0ZU9wdGlvbnMsIGZvY3VzPzogYm9vbGVhbikge1xuXHRcdGNvbnN0IGluc3RhbmNlID0gdGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuYWN0aXZlSW5zdGFuY2U7XG5cdFx0aWYgKCFpbnN0YW5jZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBob3ZlckluZm8gPSBnZXRJbnN0YW5jZUhvdmVySW5mbyhpbnN0YW5jZSwgdGhpcy5fc3RvcmFnZVNlcnZpY2UpO1xuXHRcdHJldHVybiB0aGlzLl9ob3ZlclNlcnZpY2Uuc2hvd0luc3RhbnRIb3Zlcih7XG5cdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0Y29udGVudDogaG92ZXJJbmZvLmNvbnRlbnQsXG5cdFx0XHRhY3Rpb25zOiBob3ZlckluZm8uYWN0aW9uc1xuXHRcdH0sIGZvY3VzKTtcblx0fVxuXG5cdG9uRGlkSGlkZUhvdmVyKCkge1xuXHRcdHRoaXMuX2xhc3RIb3ZlckhpZGVUaW1lID0gRGF0ZS5ub3coKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsWUFBWSxTQUFTO0FBQ3JCLFlBQVksc0JBQXNCO0FBQ2xDLFlBQVksV0FBVztBQUN2QixTQUFTLGNBQXVCO0FBQ2hDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMscUJBQXFCLDJCQUEyQjtBQUN6RCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGVBQWUsZ0JBQWdCO0FBQ3hDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsdUNBQXVDLG1DQUFtQztBQUNuRixTQUFTLHNCQUFxQyxnQkFBZ0I7QUFDOUQsU0FBaUMsK0JBQStCLHVCQUEwQyxrQkFBa0IseUJBQXlCLDZCQUE2QjtBQUNsTCxTQUFTLGdCQUFrQztBQUMzQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFzQiwwQkFBMEI7QUFDaEQsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBZ0IsY0FBYyxRQUFRLHNCQUFzQjtBQUM1RCxTQUFTLGlDQUFpQyx5QkFBeUIseUJBQXlCO0FBQzVGLFNBQVMsbUJBQXFDLHdCQUF3QjtBQUN0RSxTQUFTLGdCQUE0Qyw0QkFBNEI7QUFDakYsU0FBUyxlQUFlLG9CQUFvQjtBQUc1QyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDJCQUEyQiwrQkFBK0I7QUFDbkUsU0FBUyx5Q0FBeUM7QUFDbEQsU0FBUyxlQUFlLGlCQUFpQixTQUFzQixtQkFBbUIsb0JBQW9CO0FBQ3RHLFNBQVMsV0FBVztBQUNwQixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGVBQWUscUJBQXFCO0FBQzdDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsMkJBQTJCO0FB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
