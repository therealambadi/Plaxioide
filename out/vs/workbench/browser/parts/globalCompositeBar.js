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
import { localize } from "../../../nls.js";
import { ActionBar, ActionsOrientation } from "../../../base/browser/ui/actionbar/actionbar.js";
import { ACCOUNTS_ACTIVITY_ID, GLOBAL_ACTIVITY_ID } from "../../common/activity.js";
import { IActivityService } from "../../services/activity/common/activity.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { DisposableStore, Disposable } from "../../../base/common/lifecycle.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../platform/storage/common/storage.js";
import { IExtensionService } from "../../services/extensions/common/extensions.js";
import { CompositeBarActionViewItem, CompositeBarAction } from "./compositeBarActions.js";
import { Codicon } from "../../../base/common/codicons.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { registerIcon } from "../../../platform/theme/common/iconRegistry.js";
import { Action, Separator, SubmenuAction, toAction } from "../../../base/common/actions.js";
import { IMenuService, MenuId } from "../../../platform/actions/common/actions.js";
import { addDisposableListener, EventType, append, clearNode, hide, show, EventHelper, $, runWhenWindowIdle, getWindow } from "../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../base/browser/keyboardEvent.js";
import { StandardMouseEvent } from "../../../base/browser/mouseEvent.js";
import { EventType as TouchEventType } from "../../../base/browser/touch.js";
import { AnchorAlignment, AnchorAxisAlignment } from "../../../base/browser/ui/contextview/contextview.js";
import { Lazy } from "../../../base/common/lazy.js";
import { getActionBarActions } from "../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../platform/keybinding/common/keybinding.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { IProductService } from "../../../platform/product/common/productService.js";
import { ISecretStorageService } from "../../../platform/secrets/common/secrets.js";
import { getCurrentAuthenticationSessionInfo } from "../../services/authentication/browser/authenticationService.js";
import { IAuthenticationService } from "../../services/authentication/common/authentication.js";
import { IWorkbenchEnvironmentService } from "../../services/environment/common/environmentService.js";
import { IHoverService } from "../../../platform/hover/browser/hover.js";
import { ILifecycleService, LifecyclePhase } from "../../services/lifecycle/common/lifecycle.js";
import { IUserDataProfileService } from "../../services/userDataProfile/common/userDataProfile.js";
import { DEFAULT_ICON } from "../../services/userDataProfile/common/userDataProfileIcons.js";
import { isString } from "../../../base/common/types.js";
import { KeyCode } from "../../../base/common/keyCodes.js";
import { ACTIVITY_BAR_BADGE_BACKGROUND, ACTIVITY_BAR_BADGE_FOREGROUND } from "../../common/theme.js";
import { ICommandService } from "../../../platform/commands/common/commands.js";
let GlobalCompositeBar = class extends Disposable {
  constructor(contextMenuActionsProvider, colors, activityHoverOptions, configurationService, instantiationService, storageService, extensionService) {
    super();
    this.contextMenuActionsProvider = contextMenuActionsProvider;
    this.colors = colors;
    this.activityHoverOptions = activityHoverOptions;
    this.instantiationService = instantiationService;
    this.storageService = storageService;
    this.extensionService = extensionService;
    this.globalActivityAction = this._register(new Action(GLOBAL_ACTIVITY_ID));
    this.accountAction = this._register(new Action(ACCOUNTS_ACTIVITY_ID));
    this.element = $("div");
    const contextMenuAlignmentOptions = () => ({
      anchorAlignment: configurationService.getValue("workbench.sideBar.location") === "left" ? AnchorAlignment.RIGHT : AnchorAlignment.LEFT,
      anchorAxisAlignment: AnchorAxisAlignment.HORIZONTAL
    });
    this.globalActivityActionBar = this._register(new ActionBar(this.element, {
      actionViewItemProvider: (action, options) => {
        if (action.id === GLOBAL_ACTIVITY_ID) {
          return this.instantiationService.createInstance(GlobalActivityActionViewItem, this.contextMenuActionsProvider, { ...options, colors: this.colors, hoverOptions: this.activityHoverOptions }, contextMenuAlignmentOptions);
        }
        if (action.id === ACCOUNTS_ACTIVITY_ID) {
          return this.instantiationService.createInstance(
            AccountsActivityActionViewItem,
            this.contextMenuActionsProvider,
            {
              ...options,
              colors: this.colors,
              hoverOptions: this.activityHoverOptions
            },
            contextMenuAlignmentOptions,
            (actions) => {
              actions.unshift(...[
                toAction({ id: "hideAccounts", label: localize("hideAccounts", "Hide Accounts"), run: () => setAccountsActionVisible(storageService, false) }),
                new Separator()
              ]);
            }
          );
        }
        throw new Error(`No view item for action '${action.id}'`);
      },
      orientation: ActionsOrientation.VERTICAL,
      ariaLabel: localize("manage", "Manage"),
      preventLoopNavigation: true
    }));
    if (this.accountsVisibilityPreference) {
      this.globalActivityActionBar.push(this.accountAction, { index: GlobalCompositeBar.ACCOUNTS_ACTION_INDEX });
    }
    this.globalActivityActionBar.push(this.globalActivityAction);
    this.registerListeners();
  }
  registerListeners() {
    this.extensionService.whenInstalledExtensionsRegistered().then(() => {
      if (!this._store.isDisposed) {
        this._register(this.storageService.onDidChangeValue(StorageScope.PROFILE, AccountsActivityActionViewItem.ACCOUNTS_VISIBILITY_PREFERENCE_KEY, this._store)(() => this.toggleAccountsActivity()));
      }
    });
  }
  create(parent) {
    parent.appendChild(this.element);
  }
  focus() {
    this.globalActivityActionBar.focus(true);
  }
  size() {
    return this.globalActivityActionBar.viewItems.length;
  }
  getContextMenuActions() {
    return [toAction({ id: "toggleAccountsVisibility", label: localize("accounts", "Accounts"), checked: this.accountsVisibilityPreference, run: () => this.accountsVisibilityPreference = !this.accountsVisibilityPreference })];
  }
  toggleAccountsActivity() {
    if (this.globalActivityActionBar.length() === 2 && this.accountsVisibilityPreference) {
      return;
    }
    if (this.globalActivityActionBar.length() === 2) {
      this.globalActivityActionBar.pull(GlobalCompositeBar.ACCOUNTS_ACTION_INDEX);
    } else {
      this.globalActivityActionBar.push(this.accountAction, { index: GlobalCompositeBar.ACCOUNTS_ACTION_INDEX });
    }
  }
  get accountsVisibilityPreference() {
    return isAccountsActionVisible(this.storageService);
  }
  set accountsVisibilityPreference(value) {
    setAccountsActionVisible(this.storageService, value);
  }
};
GlobalCompositeBar.ACCOUNTS_ACTION_INDEX = 0;
GlobalCompositeBar.ACCOUNTS_ICON = registerIcon("accounts-view-bar-icon", Codicon.account, localize("accountsViewBarIcon", "Accounts icon in the view bar."));
GlobalCompositeBar = __decorateClass([
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IExtensionService)
], GlobalCompositeBar);
let AbstractGlobalActivityActionViewItem = class extends CompositeBarActionViewItem {
  constructor(menuId, action, options, contextMenuActionsProvider, contextMenuAlignmentOptions, themeService, hoverService, menuService, contextMenuService, contextKeyService, configurationService, keybindingService, activityService) {
    super(action, { draggable: false, icon: true, hasPopup: true, ...options }, () => true, themeService, hoverService, configurationService, keybindingService);
    this.menuId = menuId;
    this.contextMenuActionsProvider = contextMenuActionsProvider;
    this.contextMenuAlignmentOptions = contextMenuAlignmentOptions;
    this.menuService = menuService;
    this.contextMenuService = contextMenuService;
    this.contextKeyService = contextKeyService;
    this.activityService = activityService;
    this.updateItemActivity();
    this._register(this.activityService.onDidChangeActivity((viewContainerOrAction) => {
      if (isString(viewContainerOrAction) && viewContainerOrAction === this.compositeBarActionItem.id) {
        this.updateItemActivity();
      }
    }));
  }
  updateItemActivity() {
    this.action.activities = this.activityService.getActivity(this.compositeBarActionItem.id);
  }
  render(container) {
    super.render(container);
    this._register(addDisposableListener(this.container, EventType.MOUSE_DOWN, async (e) => {
      EventHelper.stop(e, true);
      const isLeftClick = e?.button !== 2;
      if (isLeftClick) {
        this.run();
      }
    }));
    this._register(addDisposableListener(this.container, EventType.CONTEXT_MENU, async (e) => {
      e.stopPropagation();
      const disposables = new DisposableStore();
      const actions = await this.resolveContextMenuActions(disposables);
      const event = new StandardMouseEvent(getWindow(this.container), e);
      this.contextMenuService.showContextMenu({
        getAnchor: () => event,
        getActions: () => actions,
        onHide: () => disposables.dispose()
      });
    }));
    this._register(addDisposableListener(this.container, EventType.KEY_UP, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
        EventHelper.stop(e, true);
        this.run();
      }
    }));
    this._register(addDisposableListener(this.container, TouchEventType.Tap, (e) => {
      EventHelper.stop(e, true);
      this.run();
    }));
  }
  async resolveContextMenuActions(disposables) {
    return this.contextMenuActionsProvider();
  }
  async run() {
    const disposables = new DisposableStore();
    const menu = disposables.add(this.menuService.createMenu(this.menuId, this.contextKeyService));
    const actions = await this.resolveMainMenuActions(menu, disposables);
    const { anchorAlignment, anchorAxisAlignment } = this.contextMenuAlignmentOptions() ?? { anchorAlignment: void 0, anchorAxisAlignment: void 0 };
    this.contextMenuService.showContextMenu({
      getAnchor: () => this.label,
      anchorAlignment,
      anchorAxisAlignment,
      getActions: () => actions,
      onHide: () => disposables.dispose(),
      menuActionOptions: { renderShortTitle: true }
    });
  }
  async resolveMainMenuActions(menu, _disposable) {
    return getActionBarActions(menu.getActions({ renderShortTitle: true })).secondary;
  }
};
AbstractGlobalActivityActionViewItem = __decorateClass([
  __decorateParam(5, IThemeService),
  __decorateParam(6, IHoverService),
  __decorateParam(7, IMenuService),
  __decorateParam(8, IContextMenuService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IConfigurationService),
  __decorateParam(11, IKeybindingService),
  __decorateParam(12, IActivityService)
], AbstractGlobalActivityActionViewItem);
let AccountsActivityActionViewItem = class extends AbstractGlobalActivityActionViewItem {
  constructor(contextMenuActionsProvider, options, contextMenuAlignmentOptions, fillContextMenuActions, themeService, lifecycleService, hoverService, contextMenuService, menuService, contextKeyService, authenticationService, environmentService, productService, configurationService, keybindingService, secretStorageService, logService, activityService, instantiationService, commandService) {
    const action = instantiationService.createInstance(CompositeBarAction, {
      id: ACCOUNTS_ACTIVITY_ID,
      name: localize("accounts", "Accounts"),
      classNames: ThemeIcon.asClassNameArray(GlobalCompositeBar.ACCOUNTS_ICON)
    });
    super(MenuId.AccountsContext, action, options, contextMenuActionsProvider, contextMenuAlignmentOptions, themeService, hoverService, menuService, contextMenuService, contextKeyService, configurationService, keybindingService, activityService);
    this.fillContextMenuActions = fillContextMenuActions;
    this.lifecycleService = lifecycleService;
    this.authenticationService = authenticationService;
    this.productService = productService;
    this.secretStorageService = secretStorageService;
    this.logService = logService;
    this.commandService = commandService;
    this.groupedAccounts = /* @__PURE__ */ new Map();
    this.problematicProviders = /* @__PURE__ */ new Set();
    this.initialized = false;
    this.sessionFromEmbedder = new Lazy(() => getCurrentAuthenticationSessionInfo(this.secretStorageService, this.productService));
    this._register(action);
    this.registerListeners();
    this.initialize();
  }
  registerListeners() {
    this._register(this.authenticationService.onDidRegisterAuthenticationProvider(async (e) => {
      await this.addAccountsFromProvider(e.id);
    }));
    this._register(this.authenticationService.onDidUnregisterAuthenticationProvider((e) => {
      this.groupedAccounts.delete(e.id);
      this.problematicProviders.delete(e.id);
    }));
    this._register(this.authenticationService.onDidChangeSessions(async (e) => {
      if (e.event.removed) {
        for (const removed of e.event.removed) {
          this.removeAccount(e.providerId, removed.account);
        }
      }
      for (const changed of [...e.event.changed ?? [], ...e.event.added ?? []]) {
        try {
          await this.addOrUpdateAccount(e.providerId, changed.account);
        } catch (e2) {
          this.logService.error(e2);
        }
      }
    }));
  }
  // This function exists to ensure that the accounts are added for auth providers that had already been registered
  // before the menu was created.
  async initialize() {
    await this.lifecycleService.when(LifecyclePhase.Restored);
    if (this._store.isDisposed) {
      return;
    }
    const disposable = this._register(runWhenWindowIdle(getWindow(this.element), async () => {
      await this.doInitialize();
      disposable.dispose();
    }));
  }
  async doInitialize() {
    const providerIds = this.authenticationService.getProviderIds();
    const results = await Promise.allSettled(providerIds.map((providerId) => this.addAccountsFromProvider(providerId)));
    for (const result of results) {
      if (result.status === "rejected") {
        this.logService.error(result.reason);
      }
    }
    this.initialized = true;
  }
  //#region overrides
  async resolveMainMenuActions(accountsMenu, disposables) {
    await super.resolveMainMenuActions(accountsMenu, disposables);
    const providers = this.authenticationService.getProviderIds();
    const otherCommands = accountsMenu.getActions();
    let menus = [];
    for (const providerId of providers) {
      if (!this.initialized) {
        const noAccountsAvailableAction = disposables.add(new Action("noAccountsAvailable", localize("loading", "Loading..."), void 0, false));
        menus.push(noAccountsAvailableAction);
        break;
      }
      const providerLabel = this.authenticationService.getProvider(providerId).label;
      const accounts = this.groupedAccounts.get(providerId);
      if (!accounts) {
        if (this.problematicProviders.has(providerId)) {
          const providerUnavailableAction = disposables.add(new Action("providerUnavailable", localize("authProviderUnavailable", "{0} is currently unavailable", providerLabel), void 0, false));
          menus.push(providerUnavailableAction);
          try {
            await this.addAccountsFromProvider(providerId);
          } catch (e) {
            this.logService.error(e);
          }
        }
        continue;
      }
      for (const account of accounts) {
        const manageExtensionsAction = toAction({
          id: `configureSessions${account.label}`,
          label: localize("manageTrustedExtensions", "Manage Trusted Extensions"),
          enabled: true,
          run: () => this.commandService.executeCommand("_manageTrustedExtensionsForAccount", { providerId, accountLabel: account.label })
        });
        const providerSubMenuActions = [manageExtensionsAction];
        if (account.canSignOut) {
          providerSubMenuActions.push(toAction({
            id: "signOut",
            label: localize("signOut", "Sign Out"),
            enabled: true,
            run: () => this.commandService.executeCommand("_signOutOfAccount", { providerId, accountLabel: account.label })
          }));
        }
        const providerSubMenu = new SubmenuAction("activitybar.submenu", `${account.label} (${providerLabel})`, providerSubMenuActions);
        menus.push(providerSubMenu);
      }
    }
    if (providers.length && !menus.length) {
      const noAccountsAvailableAction = disposables.add(new Action("noAccountsAvailable", localize("noAccounts", "You are not signed in to any accounts"), void 0, false));
      menus.push(noAccountsAvailableAction);
    }
    if (menus.length && otherCommands.length) {
      menus.push(new Separator());
    }
    otherCommands.forEach((group, i) => {
      const actions = group[1];
      menus = menus.concat(actions);
      if (i !== otherCommands.length - 1) {
        menus.push(new Separator());
      }
    });
    return menus;
  }
  async resolveContextMenuActions(disposables) {
    const actions = await super.resolveContextMenuActions(disposables);
    this.fillContextMenuActions(actions);
    return actions;
  }
  //#endregion
  //#region groupedAccounts helpers
  async addOrUpdateAccount(providerId, account) {
    let accounts = this.groupedAccounts.get(providerId);
    if (!accounts) {
      accounts = [];
      this.groupedAccounts.set(providerId, accounts);
    }
    const sessionFromEmbedder = await this.sessionFromEmbedder.value;
    let canSignOut = true;
    if (sessionFromEmbedder && !sessionFromEmbedder.canSignOut && (await this.authenticationService.getSessions(providerId)).some(
      (s) => s.id === sessionFromEmbedder.id && s.account.id === account.id
    )) {
      canSignOut = false;
    }
    const existingAccount = accounts.find((a) => a.label === account.label);
    if (existingAccount) {
      if (!canSignOut) {
        existingAccount.canSignOut = canSignOut;
      }
    } else {
      accounts.push({ ...account, canSignOut });
    }
  }
  removeAccount(providerId, account) {
    const accounts = this.groupedAccounts.get(providerId);
    if (!accounts) {
      return;
    }
    const index = accounts.findIndex((a) => a.id === account.id);
    if (index === -1) {
      return;
    }
    accounts.splice(index, 1);
    if (accounts.length === 0) {
      this.groupedAccounts.delete(providerId);
    }
  }
  async addAccountsFromProvider(providerId) {
    try {
      const sessions = await this.authenticationService.getSessions(providerId);
      this.problematicProviders.delete(providerId);
      for (const session of sessions) {
        try {
          await this.addOrUpdateAccount(providerId, session.account);
        } catch (e) {
          this.logService.error(e);
        }
      }
    } catch (e) {
      this.logService.error(e);
      this.problematicProviders.add(providerId);
    }
  }
  //#endregion
};
AccountsActivityActionViewItem.ACCOUNTS_VISIBILITY_PREFERENCE_KEY = "workbench.activity.showAccounts";
AccountsActivityActionViewItem = __decorateClass([
  __decorateParam(4, IThemeService),
  __decorateParam(5, ILifecycleService),
  __decorateParam(6, IHoverService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IMenuService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IAuthenticationService),
  __decorateParam(11, IWorkbenchEnvironmentService),
  __decorateParam(12, IProductService),
  __decorateParam(13, IConfigurationService),
  __decorateParam(14, IKeybindingService),
  __decorateParam(15, ISecretStorageService),
  __decorateParam(16, ILogService),
  __decorateParam(17, IActivityService),
  __decorateParam(18, IInstantiationService),
  __decorateParam(19, ICommandService)
], AccountsActivityActionViewItem);
let GlobalActivityActionViewItem = class extends AbstractGlobalActivityActionViewItem {
  constructor(contextMenuActionsProvider, options, contextMenuAlignmentOptions, userDataProfileService, themeService, hoverService, menuService, contextMenuService, contextKeyService, configurationService, environmentService, keybindingService, instantiationService, activityService) {
    const action = instantiationService.createInstance(CompositeBarAction, {
      id: GLOBAL_ACTIVITY_ID,
      name: localize("manage", "Manage"),
      classNames: ThemeIcon.asClassNameArray(userDataProfileService.currentProfile.icon ? ThemeIcon.fromId(userDataProfileService.currentProfile.icon) : DEFAULT_ICON)
    });
    super(MenuId.GlobalActivity, action, options, contextMenuActionsProvider, contextMenuAlignmentOptions, themeService, hoverService, menuService, contextMenuService, contextKeyService, configurationService, keybindingService, activityService);
    this.userDataProfileService = userDataProfileService;
    this._register(action);
    this._register(this.userDataProfileService.onDidChangeCurrentProfile((e) => {
      action.compositeBarActionItem = {
        ...action.compositeBarActionItem,
        classNames: ThemeIcon.asClassNameArray(userDataProfileService.currentProfile.icon ? ThemeIcon.fromId(userDataProfileService.currentProfile.icon) : DEFAULT_ICON)
      };
    }));
  }
  render(container) {
    super.render(container);
    this.profileBadge = append(container, $(".profile-badge"));
    this.profileBadgeContent = append(this.profileBadge, $(".profile-badge-content"));
    this.updateProfileBadge();
  }
  updateProfileBadge() {
    if (!this.profileBadge || !this.profileBadgeContent) {
      return;
    }
    clearNode(this.profileBadgeContent);
    hide(this.profileBadge);
    if (this.userDataProfileService.currentProfile.isDefault) {
      return;
    }
    if (this.userDataProfileService.currentProfile.icon && this.userDataProfileService.currentProfile.icon !== DEFAULT_ICON.id) {
      return;
    }
    if (this.action.activities.length > 0) {
      return;
    }
    show(this.profileBadge);
    this.profileBadgeContent.classList.add("profile-text-overlay");
    this.profileBadgeContent.textContent = this.userDataProfileService.currentProfile.name.substring(0, 2).toUpperCase();
  }
  updateActivity() {
    super.updateActivity();
    this.updateProfileBadge();
  }
  computeTitle() {
    return this.userDataProfileService.currentProfile.isDefault ? super.computeTitle() : localize("manage profile", "Manage {0} (Profile)", this.userDataProfileService.currentProfile.name);
  }
};
GlobalActivityActionViewItem = __decorateClass([
  __decorateParam(3, IUserDataProfileService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, IMenuService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IContextKeyService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IWorkbenchEnvironmentService),
  __decorateParam(11, IKeybindingService),
  __decorateParam(12, IInstantiationService),
  __decorateParam(13, IActivityService)
], GlobalActivityActionViewItem);
let SimpleAccountActivityActionViewItem = class extends AccountsActivityActionViewItem {
  constructor(hoverOptions, options, themeService, lifecycleService, hoverService, contextMenuService, menuService, contextKeyService, authenticationService, environmentService, productService, configurationService, keybindingService, secretStorageService, storageService, logService, activityService, instantiationService, commandService) {
    super(
      () => simpleActivityContextMenuActions(storageService, true),
      {
        ...options,
        colors: (theme) => ({
          badgeBackground: theme.getColor(ACTIVITY_BAR_BADGE_BACKGROUND),
          badgeForeground: theme.getColor(ACTIVITY_BAR_BADGE_FOREGROUND)
        }),
        hoverOptions,
        compact: true
      },
      () => void 0,
      (actions) => actions,
      themeService,
      lifecycleService,
      hoverService,
      contextMenuService,
      menuService,
      contextKeyService,
      authenticationService,
      environmentService,
      productService,
      configurationService,
      keybindingService,
      secretStorageService,
      logService,
      activityService,
      instantiationService,
      commandService
    );
  }
};
SimpleAccountActivityActionViewItem = __decorateClass([
  __decorateParam(2, IThemeService),
  __decorateParam(3, ILifecycleService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, IMenuService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IAuthenticationService),
  __decorateParam(9, IWorkbenchEnvironmentService),
  __decorateParam(10, IProductService),
  __decorateParam(11, IConfigurationService),
  __decorateParam(12, IKeybindingService),
  __decorateParam(13, ISecretStorageService),
  __decorateParam(14, IStorageService),
  __decorateParam(15, ILogService),
  __decorateParam(16, IActivityService),
  __decorateParam(17, IInstantiationService),
  __decorateParam(18, ICommandService)
], SimpleAccountActivityActionViewItem);
let SimpleGlobalActivityActionViewItem = class extends GlobalActivityActionViewItem {
  constructor(hoverOptions, options, userDataProfileService, themeService, hoverService, menuService, contextMenuService, contextKeyService, configurationService, environmentService, keybindingService, instantiationService, activityService, storageService) {
    super(
      () => simpleActivityContextMenuActions(storageService, false),
      {
        ...options,
        colors: (theme) => ({
          badgeBackground: theme.getColor(ACTIVITY_BAR_BADGE_BACKGROUND),
          badgeForeground: theme.getColor(ACTIVITY_BAR_BADGE_FOREGROUND)
        }),
        hoverOptions,
        compact: true
      },
      () => void 0,
      userDataProfileService,
      themeService,
      hoverService,
      menuService,
      contextMenuService,
      contextKeyService,
      configurationService,
      environmentService,
      keybindingService,
      instantiationService,
      activityService
    );
  }
};
SimpleGlobalActivityActionViewItem = __decorateClass([
  __decorateParam(2, IUserDataProfileService),
  __decorateParam(3, IThemeService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, IMenuService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IContextKeyService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IWorkbenchEnvironmentService),
  __decorateParam(10, IKeybindingService),
  __decorateParam(11, IInstantiationService),
  __decorateParam(12, IActivityService),
  __decorateParam(13, IStorageService)
], SimpleGlobalActivityActionViewItem);
function simpleActivityContextMenuActions(storageService, isAccount) {
  const currentElementContextMenuActions = [];
  if (isAccount) {
    currentElementContextMenuActions.push(
      toAction({ id: "hideAccounts", label: localize("hideAccounts", "Hide Accounts"), run: () => setAccountsActionVisible(storageService, false) }),
      new Separator()
    );
  }
  return [
    ...currentElementContextMenuActions,
    toAction({ id: "toggle.hideAccounts", label: localize("accounts", "Accounts"), checked: isAccountsActionVisible(storageService), run: () => setAccountsActionVisible(storageService, !isAccountsActionVisible(storageService)) }),
    toAction({ id: "toggle.hideManage", label: localize("manage", "Manage"), checked: true, enabled: false, run: () => {
      throw new Error('"Manage" can not be hidden');
    } })
  ];
}
function isAccountsActionVisible(storageService) {
  return storageService.getBoolean(AccountsActivityActionViewItem.ACCOUNTS_VISIBILITY_PREFERENCE_KEY, StorageScope.PROFILE, false);
}
function setAccountsActionVisible(storageService, visible) {
  storageService.store(AccountsActivityActionViewItem.ACCOUNTS_VISIBILITY_PREFERENCE_KEY, visible, StorageScope.PROFILE, StorageTarget.USER);
}
export {
  AccountsActivityActionViewItem,
  GlobalActivityActionViewItem,
  GlobalCompositeBar,
  SimpleAccountActivityActionViewItem,
  SimpleGlobalActivityActionViewItem,
  isAccountsActionVisible
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYnJvd3Nlci9wYXJ0cy9nbG9iYWxDb21wb3NpdGVCYXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBBY3Rpb25CYXIsIEFjdGlvbnNPcmllbnRhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uYmFyLmpzJztcbmltcG9ydCB7IEFDQ09VTlRTX0FDVElWSVRZX0lELCBHTE9CQUxfQUNUSVZJVFlfSUQgfSBmcm9tICcuLi8uLi9jb21tb24vYWN0aXZpdHkuanMnO1xuaW1wb3J0IHsgSUFjdGl2aXR5U2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2FjdGl2aXR5L2NvbW1vbi9hY3Rpdml0eS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJQ29sb3JUaGVtZSwgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBDb21wb3NpdGVCYXJBY3Rpb25WaWV3SXRlbSwgQ29tcG9zaXRlQmFyQWN0aW9uLCBJQWN0aXZpdHlIb3Zlck9wdGlvbnMsIElDb21wb3NpdGVCYXJBY3Rpb25WaWV3SXRlbU9wdGlvbnMsIElDb21wb3NpdGVCYXJDb2xvcnMgfSBmcm9tICcuL2NvbXBvc2l0ZUJhckFjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyByZWdpc3Rlckljb24gfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEFjdGlvbiwgSUFjdGlvbiwgU2VwYXJhdG9yLCBTdWJtZW51QWN0aW9uLCB0b0FjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSU1lbnUsIElNZW51U2VydmljZSwgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIEV2ZW50VHlwZSwgYXBwZW5kLCBjbGVhck5vZGUsIGhpZGUsIHNob3csIEV2ZW50SGVscGVyLCAkLCBydW5XaGVuV2luZG93SWRsZSwgZ2V0V2luZG93IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIva2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZE1vdXNlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvbW91c2VFdmVudC5qcyc7XG5pbXBvcnQgeyBFdmVudFR5cGUgYXMgVG91Y2hFdmVudFR5cGUsIEdlc3R1cmVFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci90b3VjaC5qcyc7XG5pbXBvcnQgeyBBbmNob3JBbGlnbm1lbnQsIEFuY2hvckF4aXNBbGlnbm1lbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvY29udGV4dHZpZXcvY29udGV4dHZpZXcuanMnO1xuaW1wb3J0IHsgTGF6eSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xhenkuanMnO1xuaW1wb3J0IHsgZ2V0QWN0aW9uQmFyQWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvYnJvd3Nlci9tZW51RW50cnlBY3Rpb25WaWV3SXRlbS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElTZWNyZXRTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3NlY3JldHMvY29tbW9uL3NlY3JldHMuanMnO1xuaW1wb3J0IHsgQXV0aGVudGljYXRpb25TZXNzaW9uSW5mbywgZ2V0Q3VycmVudEF1dGhlbnRpY2F0aW9uU2Vzc2lvbkluZm8gfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9hdXRoZW50aWNhdGlvbi9icm93c2VyL2F1dGhlbnRpY2F0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBBdXRoZW50aWNhdGlvblNlc3Npb25BY2NvdW50LCBJQXV0aGVudGljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvYXV0aGVudGljYXRpb24vY29tbW9uL2F1dGhlbnRpY2F0aW9uLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVTZXJ2aWNlLCBMaWZlY3ljbGVQaGFzZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgREVGQVVMVF9JQ09OIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGVJY29ucy5qcyc7XG5pbXBvcnQgeyBpc1N0cmluZyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBBQ1RJVklUWV9CQVJfQkFER0VfQkFDS0dST1VORCwgQUNUSVZJVFlfQkFSX0JBREdFX0ZPUkVHUk9VTkQgfSBmcm9tICcuLi8uLi9jb21tb24vdGhlbWUuanMnO1xuaW1wb3J0IHsgSUJhc2VBY3Rpb25WaWV3SXRlbU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvblZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuXG5leHBvcnQgY2xhc3MgR2xvYmFsQ29tcG9zaXRlQmFyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgQUNDT1VOVFNfQUNUSU9OX0lOREVYID0gMDtcblx0c3RhdGljIHJlYWRvbmx5IEFDQ09VTlRTX0lDT04gPSByZWdpc3Rlckljb24oJ2FjY291bnRzLXZpZXctYmFyLWljb24nLCBDb2RpY29uLmFjY291bnQsIGxvY2FsaXplKCdhY2NvdW50c1ZpZXdCYXJJY29uJywgXCJBY2NvdW50cyBpY29uIGluIHRoZSB2aWV3IGJhci5cIikpO1xuXG5cdHJlYWRvbmx5IGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZ2xvYmFsQWN0aXZpdHlBY3Rpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgQWN0aW9uKEdMT0JBTF9BQ1RJVklUWV9JRCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGFjY291bnRBY3Rpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgQWN0aW9uKEFDQ09VTlRTX0FDVElWSVRZX0lEKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZ2xvYmFsQWN0aXZpdHlBY3Rpb25CYXI6IEFjdGlvbkJhcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRNZW51QWN0aW9uc1Byb3ZpZGVyOiAoKSA9PiBJQWN0aW9uW10sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb2xvcnM6ICh0aGVtZTogSUNvbG9yVGhlbWUpID0+IElDb21wb3NpdGVCYXJDb2xvcnMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBhY3Rpdml0eUhvdmVyT3B0aW9uczogSUFjdGl2aXR5SG92ZXJPcHRpb25zLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuZWxlbWVudCA9ICQoJ2RpdicpO1xuXHRcdGNvbnN0IGNvbnRleHRNZW51QWxpZ25tZW50T3B0aW9ucyA9ICgpID0+ICh7XG5cdFx0XHRhbmNob3JBbGlnbm1lbnQ6IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCd3b3JrYmVuY2guc2lkZUJhci5sb2NhdGlvbicpID09PSAnbGVmdCcgPyBBbmNob3JBbGlnbm1lbnQuUklHSFQgOiBBbmNob3JBbGlnbm1lbnQuTEVGVCxcblx0XHRcdGFuY2hvckF4aXNBbGlnbm1lbnQ6IEFuY2hvckF4aXNBbGlnbm1lbnQuSE9SSVpPTlRBTFxuXHRcdH0pO1xuXHRcdHRoaXMuZ2xvYmFsQWN0aXZpdHlBY3Rpb25CYXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgQWN0aW9uQmFyKHRoaXMuZWxlbWVudCwge1xuXHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogKGFjdGlvbiwgb3B0aW9ucykgPT4ge1xuXHRcdFx0XHRpZiAoYWN0aW9uLmlkID09PSBHTE9CQUxfQUNUSVZJVFlfSUQpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShHbG9iYWxBY3Rpdml0eUFjdGlvblZpZXdJdGVtLCB0aGlzLmNvbnRleHRNZW51QWN0aW9uc1Byb3ZpZGVyLCB7IC4uLm9wdGlvbnMsIGNvbG9yczogdGhpcy5jb2xvcnMsIGhvdmVyT3B0aW9uczogdGhpcy5hY3Rpdml0eUhvdmVyT3B0aW9ucyB9LCBjb250ZXh0TWVudUFsaWdubWVudE9wdGlvbnMpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGFjdGlvbi5pZCA9PT0gQUNDT1VOVFNfQUNUSVZJVFlfSUQpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShBY2NvdW50c0FjdGl2aXR5QWN0aW9uVmlld0l0ZW0sXG5cdFx0XHRcdFx0XHR0aGlzLmNvbnRleHRNZW51QWN0aW9uc1Byb3ZpZGVyLFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0XHRcdFx0XHRjb2xvcnM6IHRoaXMuY29sb3JzLFxuXHRcdFx0XHRcdFx0XHRob3Zlck9wdGlvbnM6IHRoaXMuYWN0aXZpdHlIb3Zlck9wdGlvbnNcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRjb250ZXh0TWVudUFsaWdubWVudE9wdGlvbnMsXG5cdFx0XHRcdFx0XHQoYWN0aW9uczogSUFjdGlvbltdKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGFjdGlvbnMudW5zaGlmdCguLi5bXG5cdFx0XHRcdFx0XHRcdFx0dG9BY3Rpb24oeyBpZDogJ2hpZGVBY2NvdW50cycsIGxhYmVsOiBsb2NhbGl6ZSgnaGlkZUFjY291bnRzJywgXCJIaWRlIEFjY291bnRzXCIpLCBydW46ICgpID0+IHNldEFjY291bnRzQWN0aW9uVmlzaWJsZShzdG9yYWdlU2VydmljZSwgZmFsc2UpIH0pLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBTZXBhcmF0b3IoKVxuXHRcdFx0XHRcdFx0XHRdKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBObyB2aWV3IGl0ZW0gZm9yIGFjdGlvbiAnJHthY3Rpb24uaWR9J2ApO1xuXHRcdFx0fSxcblx0XHRcdG9yaWVudGF0aW9uOiBBY3Rpb25zT3JpZW50YXRpb24uVkVSVElDQUwsXG5cdFx0XHRhcmlhTGFiZWw6IGxvY2FsaXplKCdtYW5hZ2UnLCBcIk1hbmFnZVwiKSxcblx0XHRcdHByZXZlbnRMb29wTmF2aWdhdGlvbjogdHJ1ZVxuXHRcdH0pKTtcblxuXHRcdGlmICh0aGlzLmFjY291bnRzVmlzaWJpbGl0eVByZWZlcmVuY2UpIHtcblx0XHRcdHRoaXMuZ2xvYmFsQWN0aXZpdHlBY3Rpb25CYXIucHVzaCh0aGlzLmFjY291bnRBY3Rpb24sIHsgaW5kZXg6IEdsb2JhbENvbXBvc2l0ZUJhci5BQ0NPVU5UU19BQ1RJT05fSU5ERVggfSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5nbG9iYWxBY3Rpdml0eUFjdGlvbkJhci5wdXNoKHRoaXMuZ2xvYmFsQWN0aXZpdHlBY3Rpb24pO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHR0aGlzLmV4dGVuc2lvblNlcnZpY2Uud2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCkudGhlbigoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuX3N0b3JlLmlzRGlzcG9zZWQpIHtcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zdG9yYWdlU2VydmljZS5vbkRpZENoYW5nZVZhbHVlKFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBBY2NvdW50c0FjdGl2aXR5QWN0aW9uVmlld0l0ZW0uQUNDT1VOVFNfVklTSUJJTElUWV9QUkVGRVJFTkNFX0tFWSwgdGhpcy5fc3RvcmUpKCgpID0+IHRoaXMudG9nZ2xlQWNjb3VudHNBY3Rpdml0eSgpKSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRjcmVhdGUocGFyZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHBhcmVudC5hcHBlbmRDaGlsZCh0aGlzLmVsZW1lbnQpO1xuXHR9XG5cblx0Zm9jdXMoKTogdm9pZCB7XG5cdFx0dGhpcy5nbG9iYWxBY3Rpdml0eUFjdGlvbkJhci5mb2N1cyh0cnVlKTtcblx0fVxuXG5cdHNpemUoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5nbG9iYWxBY3Rpdml0eUFjdGlvbkJhci52aWV3SXRlbXMubGVuZ3RoO1xuXHR9XG5cblx0Z2V0Q29udGV4dE1lbnVBY3Rpb25zKCk6IElBY3Rpb25bXSB7XG5cdFx0cmV0dXJuIFt0b0FjdGlvbih7IGlkOiAndG9nZ2xlQWNjb3VudHNWaXNpYmlsaXR5JywgbGFiZWw6IGxvY2FsaXplKCdhY2NvdW50cycsIFwiQWNjb3VudHNcIiksIGNoZWNrZWQ6IHRoaXMuYWNjb3VudHNWaXNpYmlsaXR5UHJlZmVyZW5jZSwgcnVuOiAoKSA9PiB0aGlzLmFjY291bnRzVmlzaWJpbGl0eVByZWZlcmVuY2UgPSAhdGhpcy5hY2NvdW50c1Zpc2liaWxpdHlQcmVmZXJlbmNlIH0pXTtcblx0fVxuXG5cdHByaXZhdGUgdG9nZ2xlQWNjb3VudHNBY3Rpdml0eSgpIHtcblx0XHRpZiAodGhpcy5nbG9iYWxBY3Rpdml0eUFjdGlvbkJhci5sZW5ndGgoKSA9PT0gMiAmJiB0aGlzLmFjY291bnRzVmlzaWJpbGl0eVByZWZlcmVuY2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuZ2xvYmFsQWN0aXZpdHlBY3Rpb25CYXIubGVuZ3RoKCkgPT09IDIpIHtcblx0XHRcdHRoaXMuZ2xvYmFsQWN0aXZpdHlBY3Rpb25CYXIucHVsbChHbG9iYWxDb21wb3NpdGVCYXIuQUNDT1VOVFNfQUNUSU9OX0lOREVYKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5nbG9iYWxBY3Rpdml0eUFjdGlvbkJhci5wdXNoKHRoaXMuYWNjb3VudEFjdGlvbiwgeyBpbmRleDogR2xvYmFsQ29tcG9zaXRlQmFyLkFDQ09VTlRTX0FDVElPTl9JTkRFWCB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldCBhY2NvdW50c1Zpc2liaWxpdHlQcmVmZXJlbmNlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBpc0FjY291bnRzQWN0aW9uVmlzaWJsZSh0aGlzLnN0b3JhZ2VTZXJ2aWNlKTtcblx0fVxuXG5cdHByaXZhdGUgc2V0IGFjY291bnRzVmlzaWJpbGl0eVByZWZlcmVuY2UodmFsdWU6IGJvb2xlYW4pIHtcblx0XHRzZXRBY2NvdW50c0FjdGlvblZpc2libGUodGhpcy5zdG9yYWdlU2VydmljZSwgdmFsdWUpO1xuXHR9XG59XG5cbmFic3RyYWN0IGNsYXNzIEFic3RyYWN0R2xvYmFsQWN0aXZpdHlBY3Rpb25WaWV3SXRlbSBleHRlbmRzIENvbXBvc2l0ZUJhckFjdGlvblZpZXdJdGVtIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IG1lbnVJZDogTWVudUlkLFxuXHRcdGFjdGlvbjogQ29tcG9zaXRlQmFyQWN0aW9uLFxuXHRcdG9wdGlvbnM6IElDb21wb3NpdGVCYXJBY3Rpb25WaWV3SXRlbU9wdGlvbnMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb250ZXh0TWVudUFjdGlvbnNQcm92aWRlcjogKCkgPT4gSUFjdGlvbltdLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29udGV4dE1lbnVBbGlnbm1lbnRPcHRpb25zOiAoKSA9PiBSZWFkb25seTx7IGFuY2hvckFsaWdubWVudDogQW5jaG9yQWxpZ25tZW50OyBhbmNob3JBeGlzQWxpZ25tZW50OiBBbmNob3JBeGlzQWxpZ25tZW50IH0+IHwgdW5kZWZpbmVkLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUFjdGl2aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGFjdGl2aXR5U2VydmljZTogSUFjdGl2aXR5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoYWN0aW9uLCB7IGRyYWdnYWJsZTogZmFsc2UsIGljb246IHRydWUsIGhhc1BvcHVwOiB0cnVlLCAuLi5vcHRpb25zIH0sICgpID0+IHRydWUsIHRoZW1lU2VydmljZSwgaG92ZXJTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwga2V5YmluZGluZ1NlcnZpY2UpO1xuXG5cdFx0dGhpcy51cGRhdGVJdGVtQWN0aXZpdHkoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmFjdGl2aXR5U2VydmljZS5vbkRpZENoYW5nZUFjdGl2aXR5KHZpZXdDb250YWluZXJPckFjdGlvbiA9PiB7XG5cdFx0XHRpZiAoaXNTdHJpbmcodmlld0NvbnRhaW5lck9yQWN0aW9uKSAmJiB2aWV3Q29udGFpbmVyT3JBY3Rpb24gPT09IHRoaXMuY29tcG9zaXRlQmFyQWN0aW9uSXRlbS5pZCkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUl0ZW1BY3Rpdml0eSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlSXRlbUFjdGl2aXR5KCk6IHZvaWQge1xuXHRcdCh0aGlzLmFjdGlvbiBhcyBDb21wb3NpdGVCYXJBY3Rpb24pLmFjdGl2aXRpZXMgPSB0aGlzLmFjdGl2aXR5U2VydmljZS5nZXRBY3Rpdml0eSh0aGlzLmNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0uaWQpO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXIoY29udGFpbmVyKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmNvbnRhaW5lciwgRXZlbnRUeXBlLk1PVVNFX0RPV04sIGFzeW5jIChlOiBNb3VzZUV2ZW50KSA9PiB7XG5cdFx0XHRFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpO1xuXHRcdFx0Y29uc3QgaXNMZWZ0Q2xpY2sgPSBlPy5idXR0b24gIT09IDI7XG5cdFx0XHQvLyBMZWZ0LWNsaWNrIHJ1blxuXHRcdFx0aWYgKGlzTGVmdENsaWNrKSB7XG5cdFx0XHRcdHRoaXMucnVuKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gVGhlIHJlc3Qgb2YgdGhlIGFjdGl2aXR5IGJhciB1c2VzIGNvbnRleHQgbWVudSBldmVudCBmb3IgdGhlIGNvbnRleHQgbWVudSwgc28gd2UgbWF0Y2ggdGhpc1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmNvbnRhaW5lciwgRXZlbnRUeXBlLkNPTlRFWFRfTUVOVSwgYXN5bmMgKGU6IE1vdXNlRXZlbnQpID0+IHtcblx0XHRcdC8vIExldCB0aGUgaXRlbSBkZWNpZGUgb24gdGhlIGNvbnRleHQgbWVudSBpbnN0ZWFkIG9mIHRoZSB0b29sYmFyXG5cdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdGNvbnN0IGFjdGlvbnMgPSBhd2FpdCB0aGlzLnJlc29sdmVDb250ZXh0TWVudUFjdGlvbnMoZGlzcG9zYWJsZXMpO1xuXG5cdFx0XHRjb25zdCBldmVudCA9IG5ldyBTdGFuZGFyZE1vdXNlRXZlbnQoZ2V0V2luZG93KHRoaXMuY29udGFpbmVyKSwgZSk7XG5cblx0XHRcdHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRcdGdldEFuY2hvcjogKCkgPT4gZXZlbnQsXG5cdFx0XHRcdGdldEFjdGlvbnM6ICgpID0+IGFjdGlvbnMsXG5cdFx0XHRcdG9uSGlkZTogKCkgPT4gZGlzcG9zYWJsZXMuZGlzcG9zZSgpXG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihhZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5jb250YWluZXIsIEV2ZW50VHlwZS5LRVlfVVAsIChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRjb25zdCBldmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cdFx0XHRpZiAoZXZlbnQuZXF1YWxzKEtleUNvZGUuRW50ZXIpIHx8IGV2ZW50LmVxdWFscyhLZXlDb2RlLlNwYWNlKSkge1xuXHRcdFx0XHRFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpO1xuXHRcdFx0XHR0aGlzLnJ1bigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmNvbnRhaW5lciwgVG91Y2hFdmVudFR5cGUuVGFwLCAoZTogR2VzdHVyZUV2ZW50KSA9PiB7XG5cdFx0XHRFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpO1xuXHRcdFx0dGhpcy5ydW4oKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgcmVzb2x2ZUNvbnRleHRNZW51QWN0aW9ucyhkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlKTogUHJvbWlzZTxJQWN0aW9uW10+IHtcblx0XHRyZXR1cm4gdGhpcy5jb250ZXh0TWVudUFjdGlvbnNQcm92aWRlcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBydW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgbWVudSA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLm1lbnVTZXJ2aWNlLmNyZWF0ZU1lbnUodGhpcy5tZW51SWQsIHRoaXMuY29udGV4dEtleVNlcnZpY2UpKTtcblx0XHRjb25zdCBhY3Rpb25zID0gYXdhaXQgdGhpcy5yZXNvbHZlTWFpbk1lbnVBY3Rpb25zKG1lbnUsIGRpc3Bvc2FibGVzKTtcblx0XHRjb25zdCB7IGFuY2hvckFsaWdubWVudCwgYW5jaG9yQXhpc0FsaWdubWVudCB9ID0gdGhpcy5jb250ZXh0TWVudUFsaWdubWVudE9wdGlvbnMoKSA/PyB7IGFuY2hvckFsaWdubWVudDogdW5kZWZpbmVkLCBhbmNob3JBeGlzQWxpZ25tZW50OiB1bmRlZmluZWQgfTtcblxuXHRcdHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRnZXRBbmNob3I6ICgpID0+IHRoaXMubGFiZWwsXG5cdFx0XHRhbmNob3JBbGlnbm1lbnQsXG5cdFx0XHRhbmNob3JBeGlzQWxpZ25tZW50LFxuXHRcdFx0Z2V0QWN0aW9uczogKCkgPT4gYWN0aW9ucyxcblx0XHRcdG9uSGlkZTogKCkgPT4gZGlzcG9zYWJsZXMuZGlzcG9zZSgpLFxuXHRcdFx0bWVudUFjdGlvbk9wdGlvbnM6IHsgcmVuZGVyU2hvcnRUaXRsZTogdHJ1ZSB9LFxuXHRcdH0pO1xuXG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgcmVzb2x2ZU1haW5NZW51QWN0aW9ucyhtZW51OiBJTWVudSwgX2Rpc3Bvc2FibGU6IERpc3Bvc2FibGVTdG9yZSk6IFByb21pc2U8SUFjdGlvbltdPiB7XG5cdFx0cmV0dXJuIGdldEFjdGlvbkJhckFjdGlvbnMobWVudS5nZXRBY3Rpb25zKHsgcmVuZGVyU2hvcnRUaXRsZTogdHJ1ZSB9KSkuc2Vjb25kYXJ5O1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBBY2NvdW50c0FjdGl2aXR5QWN0aW9uVmlld0l0ZW0gZXh0ZW5kcyBBYnN0cmFjdEdsb2JhbEFjdGl2aXR5QWN0aW9uVmlld0l0ZW0ge1xuXG5cdHN0YXRpYyByZWFkb25seSBBQ0NPVU5UU19WSVNJQklMSVRZX1BSRUZFUkVOQ0VfS0VZID0gJ3dvcmtiZW5jaC5hY3Rpdml0eS5zaG93QWNjb3VudHMnO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZ3JvdXBlZEFjY291bnRzOiBNYXA8c3RyaW5nLCAoQXV0aGVudGljYXRpb25TZXNzaW9uQWNjb3VudCAmIHsgY2FuU2lnbk91dDogYm9vbGVhbiB9KVtdPiA9IG5ldyBNYXAoKTtcblx0cHJpdmF0ZSByZWFkb25seSBwcm9ibGVtYXRpY1Byb3ZpZGVyczogU2V0PHN0cmluZz4gPSBuZXcgU2V0KCk7XG5cblx0cHJpdmF0ZSBpbml0aWFsaXplZCA9IGZhbHNlO1xuXHRwcml2YXRlIHNlc3Npb25Gcm9tRW1iZWRkZXIgPSBuZXcgTGF6eTxQcm9taXNlPEF1dGhlbnRpY2F0aW9uU2Vzc2lvbkluZm8gfCB1bmRlZmluZWQ+PigoKSA9PiBnZXRDdXJyZW50QXV0aGVudGljYXRpb25TZXNzaW9uSW5mbyh0aGlzLnNlY3JldFN0b3JhZ2VTZXJ2aWNlLCB0aGlzLnByb2R1Y3RTZXJ2aWNlKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Y29udGV4dE1lbnVBY3Rpb25zUHJvdmlkZXI6ICgpID0+IElBY3Rpb25bXSxcblx0XHRvcHRpb25zOiBJQ29tcG9zaXRlQmFyQWN0aW9uVmlld0l0ZW1PcHRpb25zLFxuXHRcdGNvbnRleHRNZW51QWxpZ25tZW50T3B0aW9uczogKCkgPT4gUmVhZG9ubHk8eyBhbmNob3JBbGlnbm1lbnQ6IEFuY2hvckFsaWdubWVudDsgYW5jaG9yQXhpc0FsaWdubWVudDogQW5jaG9yQXhpc0FsaWdubWVudCB9PiB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGZpbGxDb250ZXh0TWVudUFjdGlvbnM6IChhY3Rpb25zOiBJQWN0aW9uW10pID0+IHZvaWQsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxpZmVjeWNsZVNlcnZpY2U6IElMaWZlY3ljbGVTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUF1dGhlbnRpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGF1dGhlbnRpY2F0aW9uU2VydmljZTogSUF1dGhlbnRpY2F0aW9uU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASVNlY3JldFN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc2VjcmV0U3RvcmFnZVNlcnZpY2U6IElTZWNyZXRTdG9yYWdlU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUFjdGl2aXR5U2VydmljZSBhY3Rpdml0eVNlcnZpY2U6IElBY3Rpdml0eVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlXG5cdCkge1xuXHRcdGNvbnN0IGFjdGlvbiA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvbXBvc2l0ZUJhckFjdGlvbiwge1xuXHRcdFx0aWQ6IEFDQ09VTlRTX0FDVElWSVRZX0lELFxuXHRcdFx0bmFtZTogbG9jYWxpemUoJ2FjY291bnRzJywgXCJBY2NvdW50c1wiKSxcblx0XHRcdGNsYXNzTmFtZXM6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KEdsb2JhbENvbXBvc2l0ZUJhci5BQ0NPVU5UU19JQ09OKVxuXHRcdH0pO1xuXHRcdHN1cGVyKE1lbnVJZC5BY2NvdW50c0NvbnRleHQsIGFjdGlvbiwgb3B0aW9ucywgY29udGV4dE1lbnVBY3Rpb25zUHJvdmlkZXIsIGNvbnRleHRNZW51QWxpZ25tZW50T3B0aW9ucywgdGhlbWVTZXJ2aWNlLCBob3ZlclNlcnZpY2UsIG1lbnVTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwga2V5YmluZGluZ1NlcnZpY2UsIGFjdGl2aXR5U2VydmljZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWN0aW9uKTtcblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdFx0dGhpcy5pbml0aWFsaXplKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuYXV0aGVudGljYXRpb25TZXJ2aWNlLm9uRGlkUmVnaXN0ZXJBdXRoZW50aWNhdGlvblByb3ZpZGVyKGFzeW5jIChlKSA9PiB7XG5cdFx0XHRhd2FpdCB0aGlzLmFkZEFjY291bnRzRnJvbVByb3ZpZGVyKGUuaWQpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuYXV0aGVudGljYXRpb25TZXJ2aWNlLm9uRGlkVW5yZWdpc3RlckF1dGhlbnRpY2F0aW9uUHJvdmlkZXIoKGUpID0+IHtcblx0XHRcdHRoaXMuZ3JvdXBlZEFjY291bnRzLmRlbGV0ZShlLmlkKTtcblx0XHRcdHRoaXMucHJvYmxlbWF0aWNQcm92aWRlcnMuZGVsZXRlKGUuaWQpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuYXV0aGVudGljYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlU2Vzc2lvbnMoYXN5bmMgZSA9PiB7XG5cdFx0XHRpZiAoZS5ldmVudC5yZW1vdmVkKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgcmVtb3ZlZCBvZiBlLmV2ZW50LnJlbW92ZWQpIHtcblx0XHRcdFx0XHR0aGlzLnJlbW92ZUFjY291bnQoZS5wcm92aWRlcklkLCByZW1vdmVkLmFjY291bnQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IGNoYW5nZWQgb2YgWy4uLihlLmV2ZW50LmNoYW5nZWQgPz8gW10pLCAuLi4oZS5ldmVudC5hZGRlZCA/PyBbXSldKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5hZGRPclVwZGF0ZUFjY291bnQoZS5wcm92aWRlcklkLCBjaGFuZ2VkLmFjY291bnQpO1xuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0Ly8gVGhpcyBmdW5jdGlvbiBleGlzdHMgdG8gZW5zdXJlIHRoYXQgdGhlIGFjY291bnRzIGFyZSBhZGRlZCBmb3IgYXV0aCBwcm92aWRlcnMgdGhhdCBoYWQgYWxyZWFkeSBiZWVuIHJlZ2lzdGVyZWRcblx0Ly8gYmVmb3JlIHRoZSBtZW51IHdhcyBjcmVhdGVkLlxuXHRwcml2YXRlIGFzeW5jIGluaXRpYWxpemUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gUmVzb2x2aW5nIHRoZSBtZW51IGRvZXNuJ3QgbmVlZCB0byBoYXBwZW4gaW1tZWRpYXRlbHksIHNvIHdlIGNhbiB3YWl0IHVudGlsIGFmdGVyIHRoZSB3b3JrYmVuY2ggaGFzIGJlZW4gcmVzdG9yZWRcblx0XHQvLyBhbmQgb25seSBydW4gdGhpcyB3aGVuIHRoZSBzeXN0ZW0gaXMgaWRsZS5cblx0XHRhd2FpdCB0aGlzLmxpZmVjeWNsZVNlcnZpY2Uud2hlbihMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCk7XG5cdFx0aWYgKHRoaXMuX3N0b3JlLmlzRGlzcG9zZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHRoaXMuX3JlZ2lzdGVyKHJ1bldoZW5XaW5kb3dJZGxlKGdldFdpbmRvdyh0aGlzLmVsZW1lbnQpLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB0aGlzLmRvSW5pdGlhbGl6ZSgpO1xuXHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb0luaXRpYWxpemUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcHJvdmlkZXJJZHMgPSB0aGlzLmF1dGhlbnRpY2F0aW9uU2VydmljZS5nZXRQcm92aWRlcklkcygpO1xuXHRcdGNvbnN0IHJlc3VsdHMgPSBhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQocHJvdmlkZXJJZHMubWFwKHByb3ZpZGVySWQgPT4gdGhpcy5hZGRBY2NvdW50c0Zyb21Qcm92aWRlcihwcm92aWRlcklkKSkpO1xuXG5cdFx0Ly8gTG9nIGFueSBlcnJvcnMgdGhhdCBvY2N1cnJlZCB3aGlsZSBpbml0aWFsaXppbmcuIFdlIHRyeSB0byBiZSBiZXN0IGVmZm9ydCBoZXJlIHRvIHNob3cgdGhlIG1vc3QgYW1vdW50IG9mIGFjY291bnRzXG5cdFx0Zm9yIChjb25zdCByZXN1bHQgb2YgcmVzdWx0cykge1xuXHRcdFx0aWYgKHJlc3VsdC5zdGF0dXMgPT09ICdyZWplY3RlZCcpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKHJlc3VsdC5yZWFzb24pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuaW5pdGlhbGl6ZWQgPSB0cnVlO1xuXHR9XG5cblx0Ly8jcmVnaW9uIG92ZXJyaWRlc1xuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBhc3luYyByZXNvbHZlTWFpbk1lbnVBY3Rpb25zKGFjY291bnRzTWVudTogSU1lbnUsIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpOiBQcm9taXNlPElBY3Rpb25bXT4ge1xuXHRcdGF3YWl0IHN1cGVyLnJlc29sdmVNYWluTWVudUFjdGlvbnMoYWNjb3VudHNNZW51LCBkaXNwb3NhYmxlcyk7XG5cblx0XHRjb25zdCBwcm92aWRlcnMgPSB0aGlzLmF1dGhlbnRpY2F0aW9uU2VydmljZS5nZXRQcm92aWRlcklkcygpO1xuXHRcdGNvbnN0IG90aGVyQ29tbWFuZHMgPSBhY2NvdW50c01lbnUuZ2V0QWN0aW9ucygpO1xuXHRcdGxldCBtZW51czogSUFjdGlvbltdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IHByb3ZpZGVySWQgb2YgcHJvdmlkZXJzKSB7XG5cdFx0XHRpZiAoIXRoaXMuaW5pdGlhbGl6ZWQpIHtcblx0XHRcdFx0Y29uc3Qgbm9BY2NvdW50c0F2YWlsYWJsZUFjdGlvbiA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQWN0aW9uKCdub0FjY291bnRzQXZhaWxhYmxlJywgbG9jYWxpemUoJ2xvYWRpbmcnLCBcIkxvYWRpbmcuLi5cIiksIHVuZGVmaW5lZCwgZmFsc2UpKTtcblx0XHRcdFx0bWVudXMucHVzaChub0FjY291bnRzQXZhaWxhYmxlQWN0aW9uKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBwcm92aWRlckxhYmVsID0gdGhpcy5hdXRoZW50aWNhdGlvblNlcnZpY2UuZ2V0UHJvdmlkZXIocHJvdmlkZXJJZCkubGFiZWw7XG5cdFx0XHRjb25zdCBhY2NvdW50cyA9IHRoaXMuZ3JvdXBlZEFjY291bnRzLmdldChwcm92aWRlcklkKTtcblx0XHRcdGlmICghYWNjb3VudHMpIHtcblx0XHRcdFx0aWYgKHRoaXMucHJvYmxlbWF0aWNQcm92aWRlcnMuaGFzKHByb3ZpZGVySWQpKSB7XG5cdFx0XHRcdFx0Y29uc3QgcHJvdmlkZXJVbmF2YWlsYWJsZUFjdGlvbiA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQWN0aW9uKCdwcm92aWRlclVuYXZhaWxhYmxlJywgbG9jYWxpemUoJ2F1dGhQcm92aWRlclVuYXZhaWxhYmxlJywgJ3swfSBpcyBjdXJyZW50bHkgdW5hdmFpbGFibGUnLCBwcm92aWRlckxhYmVsKSwgdW5kZWZpbmVkLCBmYWxzZSkpO1xuXHRcdFx0XHRcdG1lbnVzLnB1c2gocHJvdmlkZXJVbmF2YWlsYWJsZUFjdGlvbik7XG5cdFx0XHRcdFx0Ly8gdHJ5IGFnYWluIGluIHRoZSBiYWNrZ3JvdW5kIHNvIHRoYXQgaWYgdGhlIGZhaWx1cmUgd2FzIGludGVybWl0dGVudCwgd2UgY2FuIHJlc29sdmUgaXQgb24gdGhlIG5leHQgc2hvd2luZyBvZiB0aGUgbWVudVxuXHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmFkZEFjY291bnRzRnJvbVByb3ZpZGVyKHByb3ZpZGVySWQpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3QgYWNjb3VudCBvZiBhY2NvdW50cykge1xuXHRcdFx0XHRjb25zdCBtYW5hZ2VFeHRlbnNpb25zQWN0aW9uID0gdG9BY3Rpb24oe1xuXHRcdFx0XHRcdGlkOiBgY29uZmlndXJlU2Vzc2lvbnMke2FjY291bnQubGFiZWx9YCxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ21hbmFnZVRydXN0ZWRFeHRlbnNpb25zJywgXCJNYW5hZ2UgVHJ1c3RlZCBFeHRlbnNpb25zXCIpLFxuXHRcdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCdfbWFuYWdlVHJ1c3RlZEV4dGVuc2lvbnNGb3JBY2NvdW50JywgeyBwcm92aWRlcklkLCBhY2NvdW50TGFiZWw6IGFjY291bnQubGFiZWwgfSlcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Y29uc3QgcHJvdmlkZXJTdWJNZW51QWN0aW9uczogSUFjdGlvbltdID0gW21hbmFnZUV4dGVuc2lvbnNBY3Rpb25dO1xuXG5cdFx0XHRcdGlmIChhY2NvdW50LmNhblNpZ25PdXQpIHtcblx0XHRcdFx0XHRwcm92aWRlclN1Yk1lbnVBY3Rpb25zLnB1c2godG9BY3Rpb24oe1xuXHRcdFx0XHRcdFx0aWQ6ICdzaWduT3V0Jyxcblx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnc2lnbk91dCcsIFwiU2lnbiBPdXRcIiksXG5cdFx0XHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCdfc2lnbk91dE9mQWNjb3VudCcsIHsgcHJvdmlkZXJJZCwgYWNjb3VudExhYmVsOiBhY2NvdW50LmxhYmVsIH0pXG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgcHJvdmlkZXJTdWJNZW51ID0gbmV3IFN1Ym1lbnVBY3Rpb24oJ2FjdGl2aXR5YmFyLnN1Ym1lbnUnLCBgJHthY2NvdW50LmxhYmVsfSAoJHtwcm92aWRlckxhYmVsfSlgLCBwcm92aWRlclN1Yk1lbnVBY3Rpb25zKTtcblx0XHRcdFx0bWVudXMucHVzaChwcm92aWRlclN1Yk1lbnUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChwcm92aWRlcnMubGVuZ3RoICYmICFtZW51cy5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IG5vQWNjb3VudHNBdmFpbGFibGVBY3Rpb24gPSBkaXNwb3NhYmxlcy5hZGQobmV3IEFjdGlvbignbm9BY2NvdW50c0F2YWlsYWJsZScsIGxvY2FsaXplKCdub0FjY291bnRzJywgXCJZb3UgYXJlIG5vdCBzaWduZWQgaW4gdG8gYW55IGFjY291bnRzXCIpLCB1bmRlZmluZWQsIGZhbHNlKSk7XG5cdFx0XHRtZW51cy5wdXNoKG5vQWNjb3VudHNBdmFpbGFibGVBY3Rpb24pO1xuXHRcdH1cblxuXHRcdGlmIChtZW51cy5sZW5ndGggJiYgb3RoZXJDb21tYW5kcy5sZW5ndGgpIHtcblx0XHRcdG1lbnVzLnB1c2gobmV3IFNlcGFyYXRvcigpKTtcblx0XHR9XG5cblx0XHRvdGhlckNvbW1hbmRzLmZvckVhY2goKGdyb3VwLCBpKSA9PiB7XG5cdFx0XHRjb25zdCBhY3Rpb25zID0gZ3JvdXBbMV07XG5cdFx0XHRtZW51cyA9IG1lbnVzLmNvbmNhdChhY3Rpb25zKTtcblx0XHRcdGlmIChpICE9PSBvdGhlckNvbW1hbmRzLmxlbmd0aCAtIDEpIHtcblx0XHRcdFx0bWVudXMucHVzaChuZXcgU2VwYXJhdG9yKCkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIG1lbnVzO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGFzeW5jIHJlc29sdmVDb250ZXh0TWVudUFjdGlvbnMoZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSk6IFByb21pc2U8SUFjdGlvbltdPiB7XG5cdFx0Y29uc3QgYWN0aW9ucyA9IGF3YWl0IHN1cGVyLnJlc29sdmVDb250ZXh0TWVudUFjdGlvbnMoZGlzcG9zYWJsZXMpO1xuXHRcdHRoaXMuZmlsbENvbnRleHRNZW51QWN0aW9ucyhhY3Rpb25zKTtcblx0XHRyZXR1cm4gYWN0aW9ucztcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBncm91cGVkQWNjb3VudHMgaGVscGVyc1xuXG5cdHByaXZhdGUgYXN5bmMgYWRkT3JVcGRhdGVBY2NvdW50KHByb3ZpZGVySWQ6IHN0cmluZywgYWNjb3VudDogQXV0aGVudGljYXRpb25TZXNzaW9uQWNjb3VudCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCBhY2NvdW50cyA9IHRoaXMuZ3JvdXBlZEFjY291bnRzLmdldChwcm92aWRlcklkKTtcblx0XHRpZiAoIWFjY291bnRzKSB7XG5cdFx0XHRhY2NvdW50cyA9IFtdO1xuXHRcdFx0dGhpcy5ncm91cGVkQWNjb3VudHMuc2V0KHByb3ZpZGVySWQsIGFjY291bnRzKTtcblx0XHR9XG5cblx0XHRjb25zdCBzZXNzaW9uRnJvbUVtYmVkZGVyID0gYXdhaXQgdGhpcy5zZXNzaW9uRnJvbUVtYmVkZGVyLnZhbHVlO1xuXHRcdGxldCBjYW5TaWduT3V0ID0gdHJ1ZTtcblx0XHRpZiAoXG5cdFx0XHRzZXNzaW9uRnJvbUVtYmVkZGVyXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gaWYgd2UgaGF2ZSBhIHNlc3Npb24gZnJvbSB0aGUgZW1iZWRkZXJcblx0XHRcdCYmICFzZXNzaW9uRnJvbUVtYmVkZGVyLmNhblNpZ25PdXRcdFx0XHRcdFx0XHRcdFx0Ly8gYW5kIHRoYXQgc2Vzc2lvbiBzYXlzIHdlIGNhbid0IHNpZ24gb3V0XG5cdFx0XHQmJiAoYXdhaXQgdGhpcy5hdXRoZW50aWNhdGlvblNlcnZpY2UuZ2V0U2Vzc2lvbnMocHJvdmlkZXJJZCkpXHQvLyBhbmQgdGhhdCBzZXNzaW9uIGlzIGFzc29jaWF0ZWQgd2l0aCB0aGUgYWNjb3VudCB3ZSBhcmUgYWRkaW5nL3VwZGF0aW5nXG5cdFx0XHRcdC5zb21lKHMgPT5cblx0XHRcdFx0XHRzLmlkID09PSBzZXNzaW9uRnJvbUVtYmVkZGVyLmlkXG5cdFx0XHRcdFx0JiYgcy5hY2NvdW50LmlkID09PSBhY2NvdW50LmlkXG5cdFx0XHRcdClcblx0XHQpIHtcblx0XHRcdGNhblNpZ25PdXQgPSBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBleGlzdGluZ0FjY291bnQgPSBhY2NvdW50cy5maW5kKGEgPT4gYS5sYWJlbCA9PT0gYWNjb3VudC5sYWJlbCk7XG5cdFx0aWYgKGV4aXN0aW5nQWNjb3VudCkge1xuXHRcdFx0Ly8gaWYgd2UgaGF2ZSBhbiBleGlzdGluZyBhY2NvdW50IGFuZCB3ZSBkaXNjb3ZlciB0aGF0IHdlXG5cdFx0XHQvLyBjYW4ndCBzaWduIG91dCBvZiBpdCwgdXBkYXRlIHRoZSBhY2NvdW50IHRvIG1hcmsgaXQgYXMgXCJjYW4ndCBzaWduIG91dFwiXG5cdFx0XHRpZiAoIWNhblNpZ25PdXQpIHtcblx0XHRcdFx0ZXhpc3RpbmdBY2NvdW50LmNhblNpZ25PdXQgPSBjYW5TaWduT3V0O1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRhY2NvdW50cy5wdXNoKHsgLi4uYWNjb3VudCwgY2FuU2lnbk91dCB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbW92ZUFjY291bnQocHJvdmlkZXJJZDogc3RyaW5nLCBhY2NvdW50OiBBdXRoZW50aWNhdGlvblNlc3Npb25BY2NvdW50KTogdm9pZCB7XG5cdFx0Y29uc3QgYWNjb3VudHMgPSB0aGlzLmdyb3VwZWRBY2NvdW50cy5nZXQocHJvdmlkZXJJZCk7XG5cdFx0aWYgKCFhY2NvdW50cykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluZGV4ID0gYWNjb3VudHMuZmluZEluZGV4KGEgPT4gYS5pZCA9PT0gYWNjb3VudC5pZCk7XG5cdFx0aWYgKGluZGV4ID09PSAtMSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGFjY291bnRzLnNwbGljZShpbmRleCwgMSk7XG5cdFx0aWYgKGFjY291bnRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhpcy5ncm91cGVkQWNjb3VudHMuZGVsZXRlKHByb3ZpZGVySWQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgYWRkQWNjb3VudHNGcm9tUHJvdmlkZXIocHJvdmlkZXJJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHNlc3Npb25zID0gYXdhaXQgdGhpcy5hdXRoZW50aWNhdGlvblNlcnZpY2UuZ2V0U2Vzc2lvbnMocHJvdmlkZXJJZCk7XG5cdFx0XHR0aGlzLnByb2JsZW1hdGljUHJvdmlkZXJzLmRlbGV0ZShwcm92aWRlcklkKTtcblxuXHRcdFx0Zm9yIChjb25zdCBzZXNzaW9uIG9mIHNlc3Npb25zKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5hZGRPclVwZGF0ZUFjY291bnQocHJvdmlkZXJJZCwgc2Vzc2lvbi5hY2NvdW50KTtcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlKTtcblx0XHRcdHRoaXMucHJvYmxlbWF0aWNQcm92aWRlcnMuYWRkKHByb3ZpZGVySWQpO1xuXHRcdH1cblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxufVxuXG5leHBvcnQgY2xhc3MgR2xvYmFsQWN0aXZpdHlBY3Rpb25WaWV3SXRlbSBleHRlbmRzIEFic3RyYWN0R2xvYmFsQWN0aXZpdHlBY3Rpb25WaWV3SXRlbSB7XG5cblx0cHJpdmF0ZSBwcm9maWxlQmFkZ2U6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHByb2ZpbGVCYWRnZUNvbnRlbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRleHRNZW51QWN0aW9uc1Byb3ZpZGVyOiAoKSA9PiBJQWN0aW9uW10sXG5cdFx0b3B0aW9uczogSUNvbXBvc2l0ZUJhckFjdGlvblZpZXdJdGVtT3B0aW9ucyxcblx0XHRjb250ZXh0TWVudUFsaWdubWVudE9wdGlvbnM6ICgpID0+IFJlYWRvbmx5PHsgYW5jaG9yQWxpZ25tZW50OiBBbmNob3JBbGlnbm1lbnQ7IGFuY2hvckF4aXNBbGlnbm1lbnQ6IEFuY2hvckF4aXNBbGlnbm1lbnQgfT4gfCB1bmRlZmluZWQsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElBY3Rpdml0eVNlcnZpY2UgYWN0aXZpdHlTZXJ2aWNlOiBJQWN0aXZpdHlTZXJ2aWNlLFxuXHQpIHtcblx0XHRjb25zdCBhY3Rpb24gPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb21wb3NpdGVCYXJBY3Rpb24sIHtcblx0XHRcdGlkOiBHTE9CQUxfQUNUSVZJVFlfSUQsXG5cdFx0XHRuYW1lOiBsb2NhbGl6ZSgnbWFuYWdlJywgXCJNYW5hZ2VcIiksXG5cdFx0XHRjbGFzc05hbWVzOiBUaGVtZUljb24uYXNDbGFzc05hbWVBcnJheSh1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLmljb24gPyBUaGVtZUljb24uZnJvbUlkKHVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUuaWNvbikgOiBERUZBVUxUX0lDT04pXG5cdFx0fSk7XG5cdFx0c3VwZXIoTWVudUlkLkdsb2JhbEFjdGl2aXR5LCBhY3Rpb24sIG9wdGlvbnMsIGNvbnRleHRNZW51QWN0aW9uc1Byb3ZpZGVyLCBjb250ZXh0TWVudUFsaWdubWVudE9wdGlvbnMsIHRoZW1lU2VydmljZSwgaG92ZXJTZXJ2aWNlLCBtZW51U2VydmljZSwgY29udGV4dE1lbnVTZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGtleWJpbmRpbmdTZXJ2aWNlLCBhY3Rpdml0eVNlcnZpY2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFjdGlvbik7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLm9uRGlkQ2hhbmdlQ3VycmVudFByb2ZpbGUoZSA9PiB7XG5cdFx0XHRhY3Rpb24uY29tcG9zaXRlQmFyQWN0aW9uSXRlbSA9IHtcblx0XHRcdFx0Li4uYWN0aW9uLmNvbXBvc2l0ZUJhckFjdGlvbkl0ZW0sXG5cdFx0XHRcdGNsYXNzTmFtZXM6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KHVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUuaWNvbiA/IFRoZW1lSWNvbi5mcm9tSWQodXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5pY29uKSA6IERFRkFVTFRfSUNPTilcblx0XHRcdH07XG5cdFx0fSkpO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXIoY29udGFpbmVyKTtcblxuXHRcdHRoaXMucHJvZmlsZUJhZGdlID0gYXBwZW5kKGNvbnRhaW5lciwgJCgnLnByb2ZpbGUtYmFkZ2UnKSk7XG5cdFx0dGhpcy5wcm9maWxlQmFkZ2VDb250ZW50ID0gYXBwZW5kKHRoaXMucHJvZmlsZUJhZGdlLCAkKCcucHJvZmlsZS1iYWRnZS1jb250ZW50JykpO1xuXHRcdHRoaXMudXBkYXRlUHJvZmlsZUJhZGdlKCk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVByb2ZpbGVCYWRnZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMucHJvZmlsZUJhZGdlIHx8ICF0aGlzLnByb2ZpbGVCYWRnZUNvbnRlbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjbGVhck5vZGUodGhpcy5wcm9maWxlQmFkZ2VDb250ZW50KTtcblx0XHRoaWRlKHRoaXMucHJvZmlsZUJhZGdlKTtcblxuXHRcdGlmICh0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUuaXNEZWZhdWx0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMudXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5pY29uICYmIHRoaXMudXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5pY29uICE9PSBERUZBVUxUX0lDT04uaWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoKHRoaXMuYWN0aW9uIGFzIENvbXBvc2l0ZUJhckFjdGlvbikuYWN0aXZpdGllcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0c2hvdyh0aGlzLnByb2ZpbGVCYWRnZSk7XG5cdFx0dGhpcy5wcm9maWxlQmFkZ2VDb250ZW50LmNsYXNzTGlzdC5hZGQoJ3Byb2ZpbGUtdGV4dC1vdmVybGF5Jyk7XG5cdFx0dGhpcy5wcm9maWxlQmFkZ2VDb250ZW50LnRleHRDb250ZW50ID0gdGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLm5hbWUuc3Vic3RyaW5nKDAsIDIpLnRvVXBwZXJDYXNlKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgdXBkYXRlQWN0aXZpdHkoKTogdm9pZCB7XG5cdFx0c3VwZXIudXBkYXRlQWN0aXZpdHkoKTtcblx0XHR0aGlzLnVwZGF0ZVByb2ZpbGVCYWRnZSgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGNvbXB1dGVUaXRsZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUuaXNEZWZhdWx0ID8gc3VwZXIuY29tcHV0ZVRpdGxlKCkgOiBsb2NhbGl6ZSgnbWFuYWdlIHByb2ZpbGUnLCBcIk1hbmFnZSB7MH0gKFByb2ZpbGUpXCIsIHRoaXMudXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5uYW1lKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2ltcGxlQWNjb3VudEFjdGl2aXR5QWN0aW9uVmlld0l0ZW0gZXh0ZW5kcyBBY2NvdW50c0FjdGl2aXR5QWN0aW9uVmlld0l0ZW0ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGhvdmVyT3B0aW9uczogSUFjdGl2aXR5SG92ZXJPcHRpb25zLFxuXHRcdG9wdGlvbnM6IElCYXNlQWN0aW9uVmlld0l0ZW1PcHRpb25zLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUxpZmVjeWNsZVNlcnZpY2UgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASU1lbnVTZXJ2aWNlIG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJQXV0aGVudGljYXRpb25TZXJ2aWNlIGF1dGhlbnRpY2F0aW9uU2VydmljZTogSUF1dGhlbnRpY2F0aW9uU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElTZWNyZXRTdG9yYWdlU2VydmljZSBzZWNyZXRTdG9yYWdlU2VydmljZTogSVNlY3JldFN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2Ugc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElBY3Rpdml0eVNlcnZpY2UgYWN0aXZpdHlTZXJ2aWNlOiBJQWN0aXZpdHlTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKCkgPT4gc2ltcGxlQWN0aXZpdHlDb250ZXh0TWVudUFjdGlvbnMoc3RvcmFnZVNlcnZpY2UsIHRydWUpLFxuXHRcdFx0e1xuXHRcdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0XHRjb2xvcnM6IHRoZW1lID0+ICh7XG5cdFx0XHRcdFx0YmFkZ2VCYWNrZ3JvdW5kOiB0aGVtZS5nZXRDb2xvcihBQ1RJVklUWV9CQVJfQkFER0VfQkFDS0dST1VORCksXG5cdFx0XHRcdFx0YmFkZ2VGb3JlZ3JvdW5kOiB0aGVtZS5nZXRDb2xvcihBQ1RJVklUWV9CQVJfQkFER0VfRk9SRUdST1VORCksXG5cdFx0XHRcdH0pLFxuXHRcdFx0XHRob3Zlck9wdGlvbnMsXG5cdFx0XHRcdGNvbXBhY3Q6IHRydWUsXG5cdFx0XHR9LCAoKSA9PiB1bmRlZmluZWQsIGFjdGlvbnMgPT4gYWN0aW9ucywgdGhlbWVTZXJ2aWNlLCBsaWZlY3ljbGVTZXJ2aWNlLCBob3ZlclNlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwgbWVudVNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCBhdXRoZW50aWNhdGlvblNlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSwgcHJvZHVjdFNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBrZXliaW5kaW5nU2VydmljZSwgc2VjcmV0U3RvcmFnZVNlcnZpY2UsIGxvZ1NlcnZpY2UsIGFjdGl2aXR5U2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UsIGNvbW1hbmRTZXJ2aWNlKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2ltcGxlR2xvYmFsQWN0aXZpdHlBY3Rpb25WaWV3SXRlbSBleHRlbmRzIEdsb2JhbEFjdGl2aXR5QWN0aW9uVmlld0l0ZW0ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGhvdmVyT3B0aW9uczogSUFjdGl2aXR5SG92ZXJPcHRpb25zLFxuXHRcdG9wdGlvbnM6IElCYXNlQWN0aW9uVmlld0l0ZW1PcHRpb25zLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlU2VydmljZSB1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJTWVudVNlcnZpY2UgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUFjdGl2aXR5U2VydmljZSBhY3Rpdml0eVNlcnZpY2U6IElBY3Rpdml0eVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCgpID0+IHNpbXBsZUFjdGl2aXR5Q29udGV4dE1lbnVBY3Rpb25zKHN0b3JhZ2VTZXJ2aWNlLCBmYWxzZSksXG5cdFx0XHR7XG5cdFx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHRcdGNvbG9yczogdGhlbWUgPT4gKHtcblx0XHRcdFx0XHRiYWRnZUJhY2tncm91bmQ6IHRoZW1lLmdldENvbG9yKEFDVElWSVRZX0JBUl9CQURHRV9CQUNLR1JPVU5EKSxcblx0XHRcdFx0XHRiYWRnZUZvcmVncm91bmQ6IHRoZW1lLmdldENvbG9yKEFDVElWSVRZX0JBUl9CQURHRV9GT1JFR1JPVU5EKSxcblx0XHRcdFx0fSksXG5cdFx0XHRcdGhvdmVyT3B0aW9ucyxcblx0XHRcdFx0Y29tcGFjdDogdHJ1ZSxcblx0XHRcdH0sICgpID0+IHVuZGVmaW5lZCwgdXNlckRhdGFQcm9maWxlU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBob3ZlclNlcnZpY2UsIG1lbnVTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgZW52aXJvbm1lbnRTZXJ2aWNlLCBrZXliaW5kaW5nU2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UsIGFjdGl2aXR5U2VydmljZSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gc2ltcGxlQWN0aXZpdHlDb250ZXh0TWVudUFjdGlvbnMoc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSwgaXNBY2NvdW50OiBib29sZWFuKTogSUFjdGlvbltdIHtcblx0Y29uc3QgY3VycmVudEVsZW1lbnRDb250ZXh0TWVudUFjdGlvbnM6IElBY3Rpb25bXSA9IFtdO1xuXHRpZiAoaXNBY2NvdW50KSB7XG5cdFx0Y3VycmVudEVsZW1lbnRDb250ZXh0TWVudUFjdGlvbnMucHVzaChcblx0XHRcdHRvQWN0aW9uKHsgaWQ6ICdoaWRlQWNjb3VudHMnLCBsYWJlbDogbG9jYWxpemUoJ2hpZGVBY2NvdW50cycsIFwiSGlkZSBBY2NvdW50c1wiKSwgcnVuOiAoKSA9PiBzZXRBY2NvdW50c0FjdGlvblZpc2libGUoc3RvcmFnZVNlcnZpY2UsIGZhbHNlKSB9KSxcblx0XHRcdG5ldyBTZXBhcmF0b3IoKVxuXHRcdCk7XG5cdH1cblx0cmV0dXJuIFtcblx0XHQuLi5jdXJyZW50RWxlbWVudENvbnRleHRNZW51QWN0aW9ucyxcblx0XHR0b0FjdGlvbih7IGlkOiAndG9nZ2xlLmhpZGVBY2NvdW50cycsIGxhYmVsOiBsb2NhbGl6ZSgnYWNjb3VudHMnLCBcIkFjY291bnRzXCIpLCBjaGVja2VkOiBpc0FjY291bnRzQWN0aW9uVmlzaWJsZShzdG9yYWdlU2VydmljZSksIHJ1bjogKCkgPT4gc2V0QWNjb3VudHNBY3Rpb25WaXNpYmxlKHN0b3JhZ2VTZXJ2aWNlLCAhaXNBY2NvdW50c0FjdGlvblZpc2libGUoc3RvcmFnZVNlcnZpY2UpKSB9KSxcblx0XHR0b0FjdGlvbih7IGlkOiAndG9nZ2xlLmhpZGVNYW5hZ2UnLCBsYWJlbDogbG9jYWxpemUoJ21hbmFnZScsIFwiTWFuYWdlXCIpLCBjaGVja2VkOiB0cnVlLCBlbmFibGVkOiBmYWxzZSwgcnVuOiAoKSA9PiB7IHRocm93IG5ldyBFcnJvcignXCJNYW5hZ2VcIiBjYW4gbm90IGJlIGhpZGRlbicpOyB9IH0pXG5cdF07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0FjY291bnRzQWN0aW9uVmlzaWJsZShzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlKTogYm9vbGVhbiB7XG5cdHJldHVybiBzdG9yYWdlU2VydmljZS5nZXRCb29sZWFuKEFjY291bnRzQWN0aXZpdHlBY3Rpb25WaWV3SXRlbS5BQ0NPVU5UU19WSVNJQklMSVRZX1BSRUZFUkVOQ0VfS0VZLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgdHJ1ZSk7XG59XG5cbmZ1bmN0aW9uIHNldEFjY291bnRzQWN0aW9uVmlzaWJsZShzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLCB2aXNpYmxlOiBib29sZWFuKSB7XG5cdHN0b3JhZ2VTZXJ2aWNlLnN0b3JlKEFjY291bnRzQWN0aXZpdHlBY3Rpb25WaWV3SXRlbS5BQ0NPVU5UU19WSVNJQklMSVRZX1BSRUZFUkVOQ0VfS0VZLCB2aXNpYmxlLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxXQUFXLDBCQUEwQjtBQUM5QyxTQUFTLHNCQUFzQiwwQkFBMEI7QUFDekQsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxpQkFBaUIsa0JBQWtCO0FBQzVDLFNBQXNCLHFCQUFxQjtBQUMzQyxTQUFTLGlCQUFpQixjQUFjLHFCQUFxQjtBQUM3RCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDRCQUE0QiwwQkFBMEc7QUFDL0ksU0FBUyxlQUFlO0FBQ3hCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsUUFBaUIsV0FBVyxlQUFlLGdCQUFnQjtBQUNwRSxTQUFnQixjQUFjLGNBQWM7QUFDNUMsU0FBUyx1QkFBdUIsV0FBVyxRQUFRLFdBQVcsTUFBTSxNQUFNLGFB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
