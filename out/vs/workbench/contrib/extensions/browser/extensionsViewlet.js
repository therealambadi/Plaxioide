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
import "./media/extensionsViewlet.css";
import { localize, localize2 } from "../../../../nls.js";
import { timeout, Delayer } from "../../../../base/common/async.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { createErrorWithActions } from "../../../../base/common/errorMessage.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { Event } from "../../../../base/common/event.js";
import { Action } from "../../../../base/common/actions.js";
import { append, $, Dimension, hide, show, DragAndDropObserver, trackFocus, addDisposableListener, EventType, clearNode } from "../../../../base/browser/dom.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IExtensionsWorkbenchService, VIEWLET_ID, CloseExtensionDetailsOnViewChangeKey, INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID, WORKSPACE_RECOMMENDATIONS_VIEW_ID, AutoCheckUpdatesConfigurationKey, OUTDATED_EXTENSIONS_VIEW_ID, CONTEXT_HAS_GALLERY, extensionsSearchActionsMenu, AutoRestartConfigurationKey, ExtensionRuntimeActionType } from "../common/extensions.js";
import { InstallLocalExtensionsInRemoteAction, InstallRemoteExtensionsInLocalAction } from "./extensionsActions.js";
import { IExtensionManagementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IWorkbenchExtensionEnablementService, IExtensionManagementServerService } from "../../../services/extensionManagement/common/extensionManagement.js";
import { ExtensionsInput } from "../common/extensionsInput.js";
import { ExtensionsListView, EnabledExtensionsView, DisabledExtensionsView, RecommendedExtensionsView, WorkspaceRecommendedExtensionsView, ServerInstalledExtensionsView, DefaultRecommendedExtensionsView, UntrustedWorkspaceUnsupportedExtensionsView, UntrustedWorkspacePartiallySupportedExtensionsView, VirtualWorkspaceUnsupportedExtensionsView, VirtualWorkspacePartiallySupportedExtensionsView, DefaultPopularExtensionsView, DeprecatedExtensionsView, SearchMarketplaceExtensionsView, RecentlyUpdatedExtensionsView, OutdatedExtensionsView, StaticQueryExtensionsView, NONE_CATEGORY } from "./extensionsViews.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import Severity from "../../../../base/common/severity.js";
import { IActivityService, NumberBadge, WarningBadge } from "../../../services/activity/common/activity.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Extensions, IViewDescriptorService, ViewContainerLocation } from "../../../common/views.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IContextKeyService, ContextKeyExpr, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService, NotificationPriority } from "../../../../platform/notification/common/notification.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IWorkbenchLayoutService } from "../../../services/layout/browser/layoutService.js";
import { ViewPaneContainer } from "../../../browser/parts/views/viewPaneContainer.js";
import { Query } from "../common/extensionQuery.js";
import { SuggestEnabledInput } from "../../codeEditor/browser/suggestEnabledInput/suggestEnabledInput.js";
import { alert } from "../../../../base/browser/ui/aria/aria.js";
import { EXTENSION_CATEGORIES } from "../../../../platform/extensions/common/extensions.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { SIDE_BAR_DRAG_AND_DROP_BACKGROUND } from "../../../common/theme.js";
import { VirtualWorkspaceContext, WorkbenchStateContext } from "../../../common/contextkeys.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { installLocalInRemoteIcon } from "./extensionsIcons.js";
import { registerAction2, Action2, MenuId } from "../../../../platform/actions/common/actions.js";
import { IPaneCompositePartService } from "../../../services/panecomposite/browser/panecomposite.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { extractEditorsAndFilesDropData } from "../../../../platform/dnd/browser/dnd.js";
import { extname } from "../../../../base/common/resources.js";
import { registerNavigableContainer } from "../../../browser/actions/widgetNavigationCommands.js";
import { MenuWorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { createActionViewItem } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { SeverityIcon } from "../../../../base/browser/ui/severityIcon/severityIcon.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { IExtensionGalleryManifestService } from "../../../../platform/extensionManagement/common/extensionGalleryManifest.js";
const DefaultViewsContext = new RawContextKey("defaultExtensionViews", true);
const ExtensionsSortByContext = new RawContextKey("extensionsSortByValue", "");
const SearchMarketplaceExtensionsContext = new RawContextKey("searchMarketplaceExtensions", false);
const SearchHasTextContext = new RawContextKey("extensionSearchHasText", false);
const InstalledExtensionsContext = new RawContextKey("installedExtensions", false);
const SearchInstalledExtensionsContext = new RawContextKey("searchInstalledExtensions", false);
const SearchRecentlyUpdatedExtensionsContext = new RawContextKey("searchRecentlyUpdatedExtensions", false);
const SearchExtensionUpdatesContext = new RawContextKey("searchExtensionUpdates", false);
const SearchOutdatedExtensionsContext = new RawContextKey("searchOutdatedExtensions", false);
const SearchEnabledExtensionsContext = new RawContextKey("searchEnabledExtensions", false);
const SearchDisabledExtensionsContext = new RawContextKey("searchDisabledExtensions", false);
const HasInstalledExtensionsContext = new RawContextKey("hasInstalledExtensions", true);
const BuiltInExtensionsContext = new RawContextKey("builtInExtensions", false);
const SearchBuiltInExtensionsContext = new RawContextKey("searchBuiltInExtensions", false);
const SearchUnsupportedWorkspaceExtensionsContext = new RawContextKey("searchUnsupportedWorkspaceExtensions", false);
const SearchDeprecatedExtensionsContext = new RawContextKey("searchDeprecatedExtensions", false);
const RecommendedExtensionsContext = new RawContextKey("recommendedExtensions", false);
const SortByUpdateDateContext = new RawContextKey("sortByUpdateDate", false);
const ExtensionsSearchValueContext = new RawContextKey("extensionsSearchValue", "");
const REMOTE_CATEGORY = localize2({ key: "remote", comment: ["Remote as in remote machine"] }, "Remote");
let ExtensionsViewletViewsContribution = class extends Disposable {
  constructor(extensionManagementServerService, labelService, viewDescriptorService, contextKeyService) {
    super();
    this.extensionManagementServerService = extensionManagementServerService;
    this.labelService = labelService;
    this.contextKeyService = contextKeyService;
    this.container = viewDescriptorService.getViewContainerById(VIEWLET_ID);
    this.registerViews();
  }
  registerViews() {
    const viewDescriptors = [];
    viewDescriptors.push(...this.createDefaultExtensionsViewDescriptors());
    viewDescriptors.push(...this.createSearchExtensionsViewDescriptors());
    viewDescriptors.push(...this.createRecommendedExtensionsViewDescriptors());
    viewDescriptors.push(...this.createBuiltinExtensionsViewDescriptors());
    viewDescriptors.push(...this.createUnsupportedWorkspaceExtensionsViewDescriptors());
    viewDescriptors.push(...this.createOtherLocalFilteredExtensionsViewDescriptors());
    Registry.as(Extensions.ViewsRegistry).registerViews(viewDescriptors, this.container);
  }
  createDefaultExtensionsViewDescriptors() {
    const viewDescriptors = [];
    const servers = [];
    if (this.extensionManagementServerService.localExtensionManagementServer) {
      servers.push(this.extensionManagementServerService.localExtensionManagementServer);
    }
    if (this.extensionManagementServerService.remoteExtensionManagementServer) {
      servers.push(this.extensionManagementServerService.remoteExtensionManagementServer);
    }
    if (this.extensionManagementServerService.webExtensionManagementServer) {
      servers.push(this.extensionManagementServerService.webExtensionManagementServer);
    }
    const getViewName = (viewTitle, server) => {
      return servers.length > 1 ? `${server.label} - ${viewTitle}` : viewTitle;
    };
    let installedWebExtensionsContextChangeEvent = Event.None;
    if (this.extensionManagementServerService.webExtensionManagementServer && this.extensionManagementServerService.remoteExtensionManagementServer) {
      const interestingContextKeys = /* @__PURE__ */ new Set();
      interestingContextKeys.add("hasInstalledWebExtensions");
      installedWebExtensionsContextChangeEvent = Event.filter(this.contextKeyService.onDidChangeContext, (e) => e.affectsSome(interestingContextKeys));
    }
    const serverLabelChangeEvent = Event.any(this.labelService.onDidChangeFormatters, installedWebExtensionsContextChangeEvent);
    for (const server of servers) {
      const getInstalledViewName = () => getViewName(localize("installed", "Installed"), server);
      const onDidChangeTitle = Event.map(serverLabelChangeEvent, () => getInstalledViewName());
      const id = servers.length > 1 ? `workbench.views.extensions.${server.id}.installed` : `workbench.views.extensions.installed`;
      viewDescriptors.push({
        id,
        get name() {
          return {
            value: getInstalledViewName(),
            original: getViewName("Installed", server)
          };
        },
        weight: 100,
        order: 1,
        when: ContextKeyExpr.and(DefaultViewsContext),
        ctorDescriptor: new SyncDescriptor(ServerInstalledExtensionsView, [{ server, flexibleHeight: true, onDidChangeTitle }]),
        /* Installed extensions views shall not be allowed to hidden when there are more than one server */
        canToggleVisibility: servers.length === 1
      });
      if (server === this.extensionManagementServerService.remoteExtensionManagementServer && this.extensionManagementServerService.localExtensionManagementServer) {
        this._register(registerAction2(class InstallLocalExtensionsInRemoteAction2 extends Action2 {
          constructor() {
            super({
              id: "workbench.extensions.installLocalExtensions",
              get title() {
                return localize2("select and install local extensions", "Install Local Extensions in '{0}'...", server.label);
              },
              category: REMOTE_CATEGORY,
              icon: installLocalInRemoteIcon,
              f1: true,
              menu: {
                id: MenuId.ViewTitle,
                when: ContextKeyExpr.equals("view", id),
                group: "navigation"
              }
            });
          }
          run(accessor) {
            return accessor.get(IInstantiationService).createInstance(InstallLocalExtensionsInRemoteAction).run();
          }
        }));
      }
    }
    if (this.extensionManagementServerService.localExtensionManagementServer && this.extensionManagementServerService.remoteExtensionManagementServer) {
      this._register(registerAction2(class InstallRemoteExtensionsInLocalAction2 extends Action2 {
        constructor() {
          super({
            id: "workbench.extensions.actions.installLocalExtensionsInRemote",
            title: localize2("install remote in local", "Install Remote Extensions Locally..."),
            category: REMOTE_CATEGORY,
            f1: true
          });
        }
        run(accessor) {
          return accessor.get(IInstantiationService).createInstance(InstallRemoteExtensionsInLocalAction, "workbench.extensions.actions.installLocalExtensionsInRemote").run();
        }
      }));
    }
    viewDescriptors.push({
      id: "workbench.views.extensions.popular",
      name: localize2("popularExtensions", "Popular"),
      ctorDescriptor: new SyncDescriptor(DefaultPopularExtensionsView, [{ hideBadge: true }]),
      when: ContextKeyExpr.and(DefaultViewsContext, ContextKeyExpr.not("hasInstalledExtensions"), CONTEXT_HAS_GALLERY),
      weight: 60,
      order: 2,
      canToggleVisibility: false
    });
    viewDescriptors.push({
      id: "extensions.recommendedList",
      name: localize2("recommendedExtensions", "Recommended"),
      ctorDescriptor: new SyncDescriptor(DefaultRecommendedExtensionsView, [{ flexibleHeight: true }]),
      when: ContextKeyExpr.and(DefaultViewsContext, SortByUpdateDateContext.negate(), ContextKeyExpr.not("config.extensions.showRecommendationsOnlyOnDemand"), CONTEXT_HAS_GALLERY),
      weight: 40,
      order: 3,
      canToggleVisibility: true
    });
    if (servers.length === 1) {
      viewDescriptors.push({
        id: "workbench.views.extensions.enabled",
        name: localize2("enabledExtensions", "Enabled"),
        ctorDescriptor: new SyncDescriptor(EnabledExtensionsView, [{}]),
        when: ContextKeyExpr.and(DefaultViewsContext, ContextKeyExpr.has("hasInstalledExtensions")),
        hideByDefault: true,
        weight: 40,
        order: 4,
        canToggleVisibility: true
      });
      viewDescriptors.push({
        id: "workbench.views.extensions.disabled",
        name: localize2("disabledExtensions", "Disabled"),
        ctorDescriptor: new SyncDescriptor(DisabledExtensionsView, [{}]),
        when: ContextKeyExpr.and(DefaultViewsContext, ContextKeyExpr.has("hasInstalledExtensions")),
        hideByDefault: true,
        weight: 10,
        order: 5,
        canToggleVisibility: true
      });
    }
    return viewDescriptors;
  }
  createSearchExtensionsViewDescriptors() {
    const viewDescriptors = [];
    viewDescriptors.push({
      id: "workbench.views.extensions.marketplace",
      name: localize2("marketPlace", "Marketplace"),
      ctorDescriptor: new SyncDescriptor(SearchMarketplaceExtensionsView, [{}]),
      when: ContextKeyExpr.and(ContextKeyExpr.has("searchMarketplaceExtensions"))
    });
    viewDescriptors.push({
      id: "workbench.views.extensions.searchInstalled",
      name: localize2("installed", "Installed"),
      ctorDescriptor: new SyncDescriptor(ExtensionsListView, [{}]),
      when: ContextKeyExpr.or(ContextKeyExpr.has("searchInstalledExtensions"), ContextKeyExpr.has("installedExtensions"))
    });
    viewDescriptors.push({
      id: "workbench.views.extensions.searchRecentlyUpdated",
      name: localize2("recently updated", "Recently Updated"),
      ctorDescriptor: new SyncDescriptor(RecentlyUpdatedExtensionsView, [{}]),
      when: ContextKeyExpr.or(SearchExtensionUpdatesContext, ContextKeyExpr.has("searchRecentlyUpdatedExtensions")),
      order: 2
    });
    viewDescriptors.push({
      id: "workbench.views.extensions.searchEnabled",
      name: localize2("enabled", "Enabled"),
      ctorDescriptor: new SyncDescriptor(ExtensionsListView, [{}]),
      when: ContextKeyExpr.and(ContextKeyExpr.has("searchEnabledExtensions"))
    });
    viewDescriptors.push({
      id: "workbench.views.extensions.searchDisabled",
      name: localize2("disabled", "Disabled"),
      ctorDescriptor: new SyncDescriptor(ExtensionsListView, [{}]),
      when: ContextKeyExpr.and(ContextKeyExpr.has("searchDisabledExtensions"))
    });
    viewDescriptors.push({
      id: OUTDATED_EXTENSIONS_VIEW_ID,
      name: localize2("availableUpdates", "Available Updates"),
      ctorDescriptor: new SyncDescriptor(OutdatedExtensionsView, [{}]),
      when: ContextKeyExpr.or(SearchExtensionUpdatesContext, ContextKeyExpr.has("searchOutdatedExtensions")),
      order: 1
    });
    viewDescriptors.push({
      id: "workbench.views.extensions.searchBuiltin",
      name: localize2("builtin", "Builtin"),
      ctorDescriptor: new SyncDescriptor(ExtensionsListView, [{}]),
      when: ContextKeyExpr.and(ContextKeyExpr.has("searchBuiltInExtensions"))
    });
    viewDescriptors.push({
      id: "workbench.views.extensions.searchWorkspaceUnsupported",
      name: localize2("workspaceUnsupported", "Workspace Unsupported"),
      ctorDescriptor: new SyncDescriptor(ExtensionsListView, [{}]),
      when: ContextKeyExpr.and(ContextKeyExpr.has("searchWorkspaceUnsupportedExtensions"))
    });
    return viewDescriptors;
  }
  createRecommendedExtensionsViewDescriptors() {
    const viewDescriptors = [];
    viewDescriptors.push({
      id: WORKSPACE_RECOMMENDATIONS_VIEW_ID,
      name: localize2("workspaceRecommendedExtensions", "Workspace Recommendations"),
      ctorDescriptor: new SyncDescriptor(WorkspaceRecommendedExtensionsView, [{}]),
      when: ContextKeyExpr.and(ContextKeyExpr.has("recommendedExtensions"), WorkbenchStateContext.notEqualsTo("empty")),
      order: 1
    });
    viewDescriptors.push({
      id: "workbench.views.extensions.otherRecommendations",
      name: localize2("otherRecommendedExtensions", "Other Recommendations"),
      ctorDescriptor: new SyncDescriptor(RecommendedExtensionsView, [{}]),
      when: ContextKeyExpr.has("recommendedExtensions"),
      order: 2
    });
    return viewDescriptors;
  }
  createBuiltinExtensionsViewDescriptors() {
    const viewDescriptors = [];
    const configuredCategories = ["themes", "programming languages"];
    const otherCategories = EXTENSION_CATEGORIES.filter((c) => !configuredCategories.includes(c.toLowerCase()));
    otherCategories.push(NONE_CATEGORY);
    const otherCategoriesQuery = `${otherCategories.map((c) => `category:"${c}"`).join(" ")} ${configuredCategories.map((c) => `category:"-${c}"`).join(" ")}`;
    viewDescriptors.push({
      id: "workbench.views.extensions.builtinFeatureExtensions",
      name: localize2("builtinFeatureExtensions", "Features"),
      ctorDescriptor: new SyncDescriptor(StaticQueryExtensionsView, [{ query: `@builtin ${otherCategoriesQuery}` }]),
      when: ContextKeyExpr.has("builtInExtensions")
    });
    viewDescriptors.push({
      id: "workbench.views.extensions.builtinThemeExtensions",
      name: localize2("builtInThemesExtensions", "Themes"),
      ctorDescriptor: new SyncDescriptor(StaticQueryExtensionsView, [{ query: `@builtin category:themes` }]),
      when: ContextKeyExpr.has("builtInExtensions")
    });
    viewDescriptors.push({
      id: "workbench.views.extensions.builtinProgrammingLanguageExtensions",
      name: localize2("builtinProgrammingLanguageExtensions", "Programming Languages"),
      ctorDescriptor: new SyncDescriptor(StaticQueryExtensionsView, [{ query: `@builtin category:"programming languages"` }]),
      when: ContextKeyExpr.has("builtInExtensions")
    });
    return viewDescriptors;
  }
  createUnsupportedWorkspaceExtensionsViewDescriptors() {
    const viewDescriptors = [];
    viewDescriptors.push({
      id: "workbench.views.extensions.untrustedUnsupportedExtensions",
      name: localize2("untrustedUnsupportedExtensions", "Disabled in Restricted Mode"),
      ctorDescriptor: new SyncDescriptor(UntrustedWorkspaceUnsupportedExtensionsView, [{}]),
      when: ContextKeyExpr.and(SearchUnsupportedWorkspaceExtensionsContext)
    });
    viewDescriptors.push({
      id: "workbench.views.extensions.untrustedPartiallySupportedExtensions",
      name: localize2("untrustedPartiallySupportedExtensions", "Limited in Restricted Mode"),
      ctorDescriptor: new SyncDescriptor(UntrustedWorkspacePartiallySupportedExtensionsView, [{}]),
      when: ContextKeyExpr.and(SearchUnsupportedWorkspaceExtensionsContext)
    });
    viewDescriptors.push({
      id: "workbench.views.extensions.virtualUnsupportedExtensions",
      name: localize2("virtualUnsupportedExtensions", "Disabled in Virtual Workspaces"),
      ctorDescriptor: new SyncDescriptor(VirtualWorkspaceUnsupportedExtensionsView, [{}]),
      when: ContextKeyExpr.and(VirtualWorkspaceContext, SearchUnsupportedWorkspaceExtensionsContext)
    });
    viewDescriptors.push({
      id: "workbench.views.extensions.virtualPartiallySupportedExtensions",
      name: localize2("virtualPartiallySupportedExtensions", "Limited in Virtual Workspaces"),
      ctorDescriptor: new SyncDescriptor(VirtualWorkspacePartiallySupportedExtensionsView, [{}]),
      when: ContextKeyExpr.and(VirtualWorkspaceContext, SearchUnsupportedWorkspaceExtensionsContext)
    });
    return viewDescriptors;
  }
  createOtherLocalFilteredExtensionsViewDescriptors() {
    const viewDescriptors = [];
    viewDescriptors.push({
      id: "workbench.views.extensions.deprecatedExtensions",
      name: localize2("deprecated", "Deprecated"),
      ctorDescriptor: new SyncDescriptor(DeprecatedExtensionsView, [{}]),
      when: ContextKeyExpr.and(SearchDeprecatedExtensionsContext)
    });
    return viewDescriptors;
  }
};
ExtensionsViewletViewsContribution = __decorateClass([
  __decorateParam(0, IExtensionManagementServerService),
  __decorateParam(1, ILabelService),
  __decorateParam(2, IViewDescriptorService),
  __decorateParam(3, IContextKeyService)
], ExtensionsViewletViewsContribution);
let ExtensionsViewPaneContainer = class extends ViewPaneContainer {
  constructor(layoutService, telemetryService, progressService, instantiationService, editorGroupService, extensionGalleryManifestService, extensionsWorkbenchService, extensionManagementServerService, notificationService, paneCompositeService, themeService, configurationService, storageService, contextService, contextKeyService, contextMenuService, extensionService, viewDescriptorService, preferencesService, commandService, logService) {
    super(VIEWLET_ID, { mergeViewWithContainerWhenSingleView: true }, instantiationService, configurationService, layoutService, contextMenuService, telemetryService, extensionService, themeService, storageService, contextService, viewDescriptorService, logService);
    this.progressService = progressService;
    this.editorGroupService = editorGroupService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionManagementServerService = extensionManagementServerService;
    this.notificationService = notificationService;
    this.paneCompositeService = paneCompositeService;
    this.contextKeyService = contextKeyService;
    this.preferencesService = preferencesService;
    this.commandService = commandService;
    this.extensionGalleryManifest = null;
    this.notificationDisposables = this._register(new MutableDisposable());
    this.searchDelayer = new Delayer(500);
    this.extensionsSearchValueContextKey = ExtensionsSearchValueContext.bindTo(contextKeyService);
    this.defaultViewsContextKey = DefaultViewsContext.bindTo(contextKeyService);
    this.sortByContextKey = ExtensionsSortByContext.bindTo(contextKeyService);
    this.searchMarketplaceExtensionsContextKey = SearchMarketplaceExtensionsContext.bindTo(contextKeyService);
    this.searchHasTextContextKey = SearchHasTextContext.bindTo(contextKeyService);
    this.sortByUpdateDateContextKey = SortByUpdateDateContext.bindTo(contextKeyService);
    this.installedExtensionsContextKey = InstalledExtensionsContext.bindTo(contextKeyService);
    this.searchInstalledExtensionsContextKey = SearchInstalledExtensionsContext.bindTo(contextKeyService);
    this.searchRecentlyUpdatedExtensionsContextKey = SearchRecentlyUpdatedExtensionsContext.bindTo(contextKeyService);
    this.searchExtensionUpdatesContextKey = SearchExtensionUpdatesContext.bindTo(contextKeyService);
    this.searchWorkspaceUnsupportedExtensionsContextKey = SearchUnsupportedWorkspaceExtensionsContext.bindTo(contextKeyService);
    this.searchDeprecatedExtensionsContextKey = SearchDeprecatedExtensionsContext.bindTo(contextKeyService);
    this.searchOutdatedExtensionsContextKey = SearchOutdatedExtensionsContext.bindTo(contextKeyService);
    this.searchEnabledExtensionsContextKey = SearchEnabledExtensionsContext.bindTo(contextKeyService);
    this.searchDisabledExtensionsContextKey = SearchDisabledExtensionsContext.bindTo(contextKeyService);
    this.hasInstalledExtensionsContextKey = HasInstalledExtensionsContext.bindTo(contextKeyService);
    this.builtInExtensionsContextKey = BuiltInExtensionsContext.bindTo(contextKeyService);
    this.searchBuiltInExtensionsContextKey = SearchBuiltInExtensionsContext.bindTo(contextKeyService);
    this.recommendedExtensionsContextKey = RecommendedExtensionsContext.bindTo(contextKeyService);
    this._register(this.paneCompositeService.onDidPaneCompositeOpen((e) => {
      if (e.viewContainerLocation === ViewContainerLocation.Sidebar) {
        this.onViewletOpen(e.composite);
      }
    }, this));
    this._register(extensionsWorkbenchService.onReset(() => this.refresh()));
    this.searchViewletState = this.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
    extensionGalleryManifestService.getExtensionGalleryManifest().then((galleryManifest) => {
      this.extensionGalleryManifest = galleryManifest;
      this._register(extensionGalleryManifestService.onDidChangeExtensionGalleryManifest((galleryManifest2) => {
        this.extensionGalleryManifest = galleryManifest2;
        this.refresh();
      }));
    });
  }
  get searchValue() {
    return this.searchBox?.getValue();
  }
  create(parent) {
    parent.classList.add("extensions-viewlet");
    this.root = parent;
    const overlay = append(this.root, $(".overlay"));
    const overlayBackgroundColor = this.getColor(SIDE_BAR_DRAG_AND_DROP_BACKGROUND) ?? "";
    overlay.style.backgroundColor = overlayBackgroundColor;
    hide(overlay);
    this.header = append(this.root, $(".header"));
    const placeholder = localize("searchExtensions", "Search Extensions in Marketplace");
    const searchValue = this.searchViewletState["query.value"] ? this.searchViewletState["query.value"] : "";
    const searchContainer = append(this.header, $(".extensions-search-container"));
    this.searchBox = this._register(this.instantiationService.createInstance(SuggestEnabledInput, `${VIEWLET_ID}.searchbox`, searchContainer, {
      triggerCharacters: ["@"],
      sortKey: (item) => {
        if (item.indexOf(":") === -1) {
          return "a";
        } else if (/ext:/.test(item) || /id:/.test(item) || /tag:/.test(item)) {
          return "b";
        } else if (/sort:/.test(item)) {
          return "c";
        } else {
          return "d";
        }
      },
      provideResults: (query) => Query.suggestions(query, this.extensionGalleryManifest)
    }, placeholder, "extensions:searchinput", { placeholderText: placeholder, value: searchValue }));
    this.notificationContainer = append(this.header, $(".notification-container.hidden", { "tabindex": "0" }));
    this.renderNotificaiton();
    this._register(this.extensionsWorkbenchService.onDidChangeExtensionsNotification(() => this.renderNotificaiton()));
    this.updateInstalledExtensionsContexts();
    if (this.searchBox.getValue()) {
      this.triggerSearch();
    }
    this._register(this.searchBox.onInputDidChange(() => {
      this.sortByContextKey.set(Query.parse(this.searchBox?.getValue() ?? "").sortBy);
      this.triggerSearch();
    }, this));
    this._register(this.searchBox.onShouldFocusResults(() => this.focusListView(), this));
    const controlElement = append(searchContainer, $(".extensions-search-actions-container"));
    this._register(this.instantiationService.createInstance(MenuWorkbenchToolBar, controlElement, extensionsSearchActionsMenu, {
      toolbarOptions: {
        primaryGroup: () => true
      },
      actionViewItemProvider: (action, options) => createActionViewItem(this.instantiationService, action, options)
    }));
    this._register(new DragAndDropObserver(this.root, {
      onDragEnter: (e) => {
        if (this.isSupportedDragElement(e)) {
          show(overlay);
        }
      },
      onDragLeave: (e) => {
        if (this.isSupportedDragElement(e)) {
          hide(overlay);
        }
      },
      onDragOver: (e) => {
        if (this.isSupportedDragElement(e)) {
          e.dataTransfer.dropEffect = "copy";
        }
      },
      onDrop: async (e) => {
        if (this.isSupportedDragElement(e)) {
          hide(overlay);
          const vsixs = coalesce((await this.instantiationService.invokeFunction((accessor) => extractEditorsAndFilesDropData(accessor, e))).map((editor) => editor.resource && extname(editor.resource) === ".vsix" ? editor.resource : void 0));
          if (vsixs.length > 0) {
            try {
              await this.commandService.executeCommand(INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID, vsixs);
            } catch (err) {
              this.notificationService.error(err);
            }
          }
        }
      }
    }));
    super.create(append(this.root, $(".extensions")));
    const focusTracker = this._register(trackFocus(this.root));
    const isSearchBoxFocused = () => this.searchBox?.inputWidget.hasWidgetFocus();
    this._register(registerNavigableContainer({
      name: "extensionsView",
      focusNotifiers: [focusTracker],
      focusNextWidget: () => {
        if (isSearchBoxFocused()) {
          this.focusListView();
        }
      },
      focusPreviousWidget: () => {
        if (!isSearchBoxFocused()) {
          this.searchBox?.focus();
        }
      }
    }));
  }
  focus() {
    super.focus();
    this.searchBox?.focus();
  }
  layout(dimension) {
    this._dimension = dimension;
    if (this.root) {
      this.root.classList.toggle("narrow", dimension.width <= 250);
      this.root.classList.toggle("mini", dimension.width <= 200);
    }
    this.searchBox?.layout(new Dimension(dimension.width - 34 - /*padding*/
    8 - 24 * 2, 20));
    const searchBoxHeight = 20 + 21;
    const headerHeight = this.header && !!this.notificationContainer?.childNodes.length ? this.notificationContainer.clientHeight + searchBoxHeight + 10 : searchBoxHeight;
    this.header.style.height = `${headerHeight}px`;
    super.layout(new Dimension(dimension.width, dimension.height - headerHeight));
  }
  getOptimalWidth() {
    return 400;
  }
  search(value) {
    if (this.searchBox && this.searchBox.getValue() !== value) {
      this.searchBox.setValue(value);
    }
  }
  async refresh() {
    await this.updateInstalledExtensionsContexts();
    this.doSearch(true);
    if (this.configurationService.getValue(AutoCheckUpdatesConfigurationKey)) {
      this.extensionsWorkbenchService.checkForUpdates();
    }
  }
  renderNotificaiton() {
    if (!this.notificationContainer) {
      return;
    }
    clearNode(this.notificationContainer);
    this.notificationDisposables.value = new DisposableStore();
    const status = this.extensionsWorkbenchService.getExtensionsNotification();
    const query = status?.extensions.map((extension) => `@id:${extension.identifier.id}`).join(" ");
    if (status && (query === this.searchBox?.getValue() || !this.searchMarketplaceExtensionsContextKey.get())) {
      this.notificationContainer.setAttribute("aria-label", status.message);
      this.notificationContainer.classList.remove("hidden");
      const messageContainer = append(this.notificationContainer, $(".message-container"));
      append(messageContainer, $("span")).className = SeverityIcon.className(status.severity);
      append(messageContainer, $("span.message", void 0, status.message));
      const showAction = append(
        messageContainer,
        $("span.message-text-action", {
          "tabindex": "0",
          "role": "button",
          "aria-label": `${status.message}. ${localize("click show", "Click to Show")}`
        }, localize("show", "Show"))
      );
      this.notificationDisposables.value.add(addDisposableListener(showAction, EventType.CLICK, () => this.search(query ?? "")));
      this.notificationDisposables.value.add(addDisposableListener(showAction, EventType.KEY_DOWN, (e) => {
        const standardKeyboardEvent = new StandardKeyboardEvent(e);
        if (standardKeyboardEvent.keyCode === KeyCode.Enter || standardKeyboardEvent.keyCode === KeyCode.Space) {
          this.search(query ?? "");
        }
        standardKeyboardEvent.stopPropagation();
      }));
      const dismissAction = append(
        this.notificationContainer,
        $(`span.message-action${ThemeIcon.asCSSSelector(Codicon.close)}`, {
          "tabindex": "0",
          "role": "button",
          "aria-label": localize("dismiss", "Dismiss"),
          "title": localize("dismiss", "Dismiss")
        })
      );
      this.notificationDisposables.value.add(addDisposableListener(dismissAction, EventType.CLICK, () => status.dismiss()));
      this.notificationDisposables.value.add(addDisposableListener(dismissAction, EventType.KEY_DOWN, (e) => {
        const standardKeyboardEvent = new StandardKeyboardEvent(e);
        if (standardKeyboardEvent.keyCode === KeyCode.Enter || standardKeyboardEvent.keyCode === KeyCode.Space) {
          status.dismiss();
        }
        standardKeyboardEvent.stopPropagation();
      }));
    } else {
      this.notificationContainer.removeAttribute("aria-label");
      this.notificationContainer.classList.add("hidden");
    }
    if (this._dimension) {
      this.layout(this._dimension);
    }
  }
  async updateInstalledExtensionsContexts() {
    const result = await this.extensionsWorkbenchService.queryLocal();
    this.hasInstalledExtensionsContextKey.set(result.some((r) => !r.isBuiltin));
  }
  triggerSearch() {
    this.searchDelayer.trigger(() => this.doSearch(), this.searchBox && this.searchBox.getValue() ? 500 : 0).then(void 0, (err) => this.onError(err));
  }
  normalizedQuery() {
    return this.searchBox ? this.searchBox.getValue().trim().replace(/@category/g, "category").replace(/@tag:/g, "tag:").replace(/@ext:/g, "ext:").replace(/@featured/g, "featured").replace(/@popular/g, this.extensionManagementServerService.webExtensionManagementServer && !this.extensionManagementServerService.localExtensionManagementServer && !this.extensionManagementServerService.remoteExtensionManagementServer ? "@web" : "@popular") : "";
  }
  saveState() {
    const value = this.searchBox ? this.searchBox.getValue() : "";
    if (ExtensionsListView.isLocalExtensionsQuery(value)) {
      this.searchViewletState["query.value"] = value;
    } else {
      this.searchViewletState["query.value"] = "";
    }
    super.saveState();
  }
  doSearch(refresh) {
    const value = this.normalizedQuery();
    this.contextKeyService.bufferChangeEvents(() => {
      const isRecommendedExtensionsQuery = ExtensionsListView.isRecommendedExtensionsQuery(value);
      this.searchHasTextContextKey.set(value.trim() !== "");
      this.extensionsSearchValueContextKey.set(value);
      this.installedExtensionsContextKey.set(ExtensionsListView.isInstalledExtensionsQuery(value));
      this.searchInstalledExtensionsContextKey.set(ExtensionsListView.isSearchInstalledExtensionsQuery(value));
      this.searchRecentlyUpdatedExtensionsContextKey.set(ExtensionsListView.isSearchRecentlyUpdatedQuery(value) && !ExtensionsListView.isSearchExtensionUpdatesQuery(value));
      this.searchOutdatedExtensionsContextKey.set(ExtensionsListView.isOutdatedExtensionsQuery(value) && !ExtensionsListView.isSearchExtensionUpdatesQuery(value));
      this.searchExtensionUpdatesContextKey.set(ExtensionsListView.isSearchExtensionUpdatesQuery(value));
      this.searchEnabledExtensionsContextKey.set(ExtensionsListView.isEnabledExtensionsQuery(value));
      this.searchDisabledExtensionsContextKey.set(ExtensionsListView.isDisabledExtensionsQuery(value));
      this.searchBuiltInExtensionsContextKey.set(ExtensionsListView.isSearchBuiltInExtensionsQuery(value));
      this.searchWorkspaceUnsupportedExtensionsContextKey.set(ExtensionsListView.isSearchWorkspaceUnsupportedExtensionsQuery(value));
      this.searchDeprecatedExtensionsContextKey.set(ExtensionsListView.isSearchDeprecatedExtensionsQuery(value));
      this.builtInExtensionsContextKey.set(ExtensionsListView.isBuiltInExtensionsQuery(value));
      this.recommendedExtensionsContextKey.set(isRecommendedExtensionsQuery);
      this.searchMarketplaceExtensionsContextKey.set(!!value && !ExtensionsListView.isLocalExtensionsQuery(value) && !isRecommendedExtensionsQuery);
      this.sortByUpdateDateContextKey.set(ExtensionsListView.isSortUpdateDateQuery(value));
      this.defaultViewsContextKey.set(!value || ExtensionsListView.isSortInstalledExtensionsQuery(value));
    });
    this.renderNotificaiton();
    return this.progress(Promise.all(this.panes.map(
      (view) => view.show(this.normalizedQuery(), refresh).then((model) => this.alertSearchResult(model.length, view.id))
    ))).then(() => void 0);
  }
  onDidAddViewDescriptors(added) {
    const addedViews = super.onDidAddViewDescriptors(added);
    this.progress(Promise.all(addedViews.map(
      (addedView) => addedView.show(this.normalizedQuery()).then((model) => this.alertSearchResult(model.length, addedView.id))
    )));
    return addedViews;
  }
  alertSearchResult(count, viewId) {
    const view = this.viewContainerModel.visibleViewDescriptors.find((view2) => view2.id === viewId);
    switch (count) {
      case 0:
        break;
      case 1:
        if (view) {
          alert(localize("extensionFoundInSection", "1 extension found in the {0} section.", view.name.value));
        } else {
          alert(localize("extensionFound", "1 extension found."));
        }
        break;
      default:
        if (view) {
          alert(localize("extensionsFoundInSection", "{0} extensions found in the {1} section.", count, view.name.value));
        } else {
          alert(localize("extensionsFound", "{0} extensions found.", count));
        }
        break;
    }
  }
  getFirstExpandedPane() {
    for (const pane of this.panes) {
      if (pane.isExpanded() && pane instanceof ExtensionsListView) {
        return pane;
      }
    }
    return void 0;
  }
  focusListView() {
    const pane = this.getFirstExpandedPane();
    if (pane && pane.count() > 0) {
      pane.focus();
    }
  }
  onViewletOpen(viewlet) {
    if (!viewlet || viewlet.getId() === VIEWLET_ID) {
      return;
    }
    if (this.configurationService.getValue(CloseExtensionDetailsOnViewChangeKey)) {
      const promises = this.editorGroupService.groups.map((group) => {
        const editors = group.editors.filter((input) => input instanceof ExtensionsInput);
        return group.closeEditors(editors);
      });
      Promise.all(promises);
    }
  }
  progress(promise) {
    return this.progressService.withProgress({ location: ProgressLocation.Extensions }, () => promise);
  }
  onError(err) {
    if (isCancellationError(err)) {
      return;
    }
    const message = err && err.message || "";
    if (/ECONNREFUSED/.test(message)) {
      const error = createErrorWithActions(localize("suggestProxyError", "Marketplace returned 'ECONNREFUSED'. Please check the 'http.proxy' setting."), [
        new Action("open user settings", localize("open user settings", "Open User Settings"), void 0, true, () => this.preferencesService.openUserSettings())
      ]);
      this.notificationService.error(error);
      return;
    }
    this.notificationService.error(err);
  }
  isSupportedDragElement(e) {
    if (e.dataTransfer) {
      const typesLowerCase = e.dataTransfer.types.map((t) => t.toLocaleLowerCase());
      return typesLowerCase.indexOf("files") !== -1;
    }
    return false;
  }
};
ExtensionsViewPaneContainer = __decorateClass([
  __decorateParam(0, IWorkbenchLayoutService),
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IProgressService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IEditorGroupsService),
  __decorateParam(5, IExtensionGalleryManifestService),
  __decorateParam(6, IExtensionsWorkbenchService),
  __decorateParam(7, IExtensionManagementServerService),
  __decorateParam(8, INotificationService),
  __decorateParam(9, IPaneCompositePartService),
  __decorateParam(10, IThemeService),
  __decorateParam(11, IConfigurationService),
  __decorateParam(12, IStorageService),
  __decorateParam(13, IWorkspaceContextService),
  __decorateParam(14, IContextKeyService),
  __decorateParam(15, IContextMenuService),
  __decorateParam(16, IExtensionService),
  __decorateParam(17, IViewDescriptorService),
  __decorateParam(18, IPreferencesService),
  __decorateParam(19, ICommandService),
  __decorateParam(20, ILogService)
], ExtensionsViewPaneContainer);
let StatusUpdater = class extends Disposable {
  constructor(activityService, extensionsWorkbenchService, extensionEnablementService, configurationService) {
    super();
    this.activityService = activityService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionEnablementService = extensionEnablementService;
    this.configurationService = configurationService;
    this.badgeHandle = this._register(new MutableDisposable());
    this.onServiceChange();
    this._register(Event.any(Event.debounce(extensionsWorkbenchService.onChange, () => void 0, 100, void 0, void 0, void 0, this._store), extensionsWorkbenchService.onDidChangeExtensionsNotification)(this.onServiceChange, this));
  }
  onServiceChange() {
    this.badgeHandle.clear();
    let badge;
    const extensionsNotification = this.extensionsWorkbenchService.getExtensionsNotification();
    if (extensionsNotification) {
      if (extensionsNotification.severity === Severity.Warning) {
        badge = new WarningBadge(() => extensionsNotification.message);
      }
    } else {
      const actionRequired = this.configurationService.getValue(AutoRestartConfigurationKey) === true ? [] : this.extensionsWorkbenchService.installed.filter((e) => e.runtimeState !== void 0);
      const outdated = this.extensionsWorkbenchService.outdated.reduce((r, e) => r + (this.extensionEnablementService.isEnabled(e.local) && !actionRequired.includes(e) ? 1 : 0), 0);
      const newBadgeNumber = outdated + actionRequired.length;
      if (newBadgeNumber > 0) {
        let msg = "";
        if (outdated) {
          msg += outdated === 1 ? localize("extensionToUpdate", "{0} requires update", outdated) : localize("extensionsToUpdate", "{0} require update", outdated);
        }
        if (outdated > 0 && actionRequired.length > 0) {
          msg += ", ";
        }
        if (actionRequired.length) {
          msg += actionRequired.length === 1 ? localize("extensionToReload", "{0} requires restart", actionRequired.length) : localize("extensionsToReload", "{0} require restart", actionRequired.length);
        }
        badge = new NumberBadge(newBadgeNumber, () => msg);
      }
    }
    if (badge) {
      this.badgeHandle.value = this.activityService.showViewContainerActivity(VIEWLET_ID, { badge });
    }
  }
};
StatusUpdater = __decorateClass([
  __decorateParam(0, IActivityService),
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IWorkbenchExtensionEnablementService),
  __decorateParam(3, IConfigurationService)
], StatusUpdater);
let MaliciousExtensionChecker = class {
  constructor(extensionsManagementService, extensionsWorkbenchService, hostService, logService, notificationService) {
    this.extensionsManagementService = extensionsManagementService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.hostService = hostService;
    this.logService = logService;
    this.notificationService = notificationService;
    this.loopCheckForMaliciousExtensions();
  }
  loopCheckForMaliciousExtensions() {
    this.checkForMaliciousExtensions().then(() => timeout(1e3 * 60 * 5)).then(() => this.loopCheckForMaliciousExtensions());
  }
  async checkForMaliciousExtensions() {
    try {
      const maliciousExtensions = [];
      let shouldRestartExtensions = false;
      let shouldReloadWindow = false;
      for (const extension of this.extensionsWorkbenchService.installed) {
        if (extension.isMalicious && extension.local) {
          maliciousExtensions.push(extension.local);
          shouldRestartExtensions = shouldRestartExtensions || extension.runtimeState?.action === ExtensionRuntimeActionType.RestartExtensions;
          shouldReloadWindow = shouldReloadWindow || extension.runtimeState?.action === ExtensionRuntimeActionType.ReloadWindow;
        }
      }
      if (maliciousExtensions.length) {
        await this.extensionsManagementService.uninstallExtensions(maliciousExtensions.map((e) => ({ extension: e, options: { remove: true } })));
        this.notificationService.prompt(
          Severity.Warning,
          localize("malicious warning", "The following extensions were found to be problematic and have been uninstalled: {0}", maliciousExtensions.map((e) => e.identifier.id).join(", ")),
          shouldRestartExtensions || shouldReloadWindow ? [{
            label: shouldRestartExtensions ? localize("restartNow", "Restart Extensions") : localize("reloadNow", "Reload Now"),
            run: () => shouldRestartExtensions ? this.extensionsWorkbenchService.updateRunningExtensions() : this.hostService.reload()
          }] : [],
          {
            sticky: true,
            priority: NotificationPriority.URGENT
          }
        );
      }
    } catch (err) {
      this.logService.error(err);
    }
  }
};
MaliciousExtensionChecker = __decorateClass([
  __decorateParam(0, IExtensionManagementService),
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IHostService),
  __decorateParam(3, ILogService),
  __decorateParam(4, INotificationService)
], MaliciousExtensionChecker);
export {
  BuiltInExtensionsContext,
  DefaultViewsContext,
  ExtensionsSearchValueContext,
  ExtensionsSortByContext,
  ExtensionsViewPaneContainer,
  ExtensionsViewletViewsContribution,
  MaliciousExtensionChecker,
  RecommendedExtensionsContext,
  SearchHasTextContext,
  SearchMarketplaceExtensionsContext,
  StatusUpdater
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2Jyb3dzZXIvZXh0ZW5zaW9uc1ZpZXdsZXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvZXh0ZW5zaW9uc1ZpZXdsZXQuY3NzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgdGltZW91dCwgRGVsYXllciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IGlzQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgY3JlYXRlRXJyb3JXaXRoQWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9yTWVzc2FnZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgYXBwZW5kLCAkLCBEaW1lbnNpb24sIGhpZGUsIHNob3csIERyYWdBbmREcm9wT2JzZXJ2ZXIsIHRyYWNrRm9jdXMsIGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgRXZlbnRUeXBlLCBjbGVhck5vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLCBJRXh0ZW5zaW9uc1ZpZXdQYW5lQ29udGFpbmVyLCBWSUVXTEVUX0lELCBDbG9zZUV4dGVuc2lvbkRldGFpbHNPblZpZXdDaGFuZ2VLZXksIElOU1RBTExfRVhURU5TSU9OX0ZST01fVlNJWF9DT01NQU5EX0lELCBXT1JLU1BBQ0VfUkVDT01NRU5EQVRJT05TX1ZJRVdfSUQsIEF1dG9DaGVja1VwZGF0ZXNDb25maWd1cmF0aW9uS2V5LCBPVVREQVRFRF9FWFRFTlNJT05TX1ZJRVdfSUQsIENPTlRFWFRfSEFTX0dBTExFUlksIGV4dGVuc2lvbnNTZWFyY2hBY3Rpb25zTWVudSwgQXV0b1Jlc3RhcnRDb25maWd1cmF0aW9uS2V5LCBFeHRlbnNpb25SdW50aW1lQWN0aW9uVHlwZSB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEluc3RhbGxMb2NhbEV4dGVuc2lvbnNJblJlbW90ZUFjdGlvbiwgSW5zdGFsbFJlbW90ZUV4dGVuc2lvbnNJbkxvY2FsQWN0aW9uIH0gZnJvbSAnLi9leHRlbnNpb25zQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UsIElMb2NhbEV4dGVuc2lvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLCBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UsIElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zSW5wdXQgfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9uc0lucHV0LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnNMaXN0VmlldywgRW5hYmxlZEV4dGVuc2lvbnNWaWV3LCBEaXNhYmxlZEV4dGVuc2lvbnNWaWV3LCBSZWNvbW1lbmRlZEV4dGVuc2lvbnNWaWV3LCBXb3Jrc3BhY2VSZWNvbW1lbmRlZEV4dGVuc2lvbnNWaWV3LCBTZXJ2ZXJJbnN0YWxsZWRFeHRlbnNpb25zVmlldywgRGVmYXVsdFJlY29tbWVuZGVkRXh0ZW5zaW9uc1ZpZXcsIFVudHJ1c3RlZFdvcmtzcGFjZVVuc3VwcG9ydGVkRXh0ZW5zaW9uc1ZpZXcsIFVudHJ1c3RlZFdvcmtzcGFjZVBhcnRpYWxseVN1cHBvcnRlZEV4dGVuc2lvbnNWaWV3LCBWaXJ0dWFsV29ya3NwYWNlVW5zdXBwb3J0ZWRFeHRlbnNpb25zVmlldywgVmlydHVhbFdvcmtzcGFjZVBhcnRpYWxseVN1cHBvcnRlZEV4dGVuc2lvbnNWaWV3LCBEZWZhdWx0UG9wdWxhckV4dGVuc2lvbnNWaWV3LCBEZXByZWNhdGVkRXh0ZW5zaW9uc1ZpZXcsIFNlYXJjaE1hcmtldHBsYWNlRXh0ZW5zaW9uc1ZpZXcsIFJlY2VudGx5VXBkYXRlZEV4dGVuc2lvbnNWaWV3LCBPdXRkYXRlZEV4dGVuc2lvbnNWaWV3LCBTdGF0aWNRdWVyeUV4dGVuc2lvbnNWaWV3LCBOT05FX0NBVEVHT1JZIH0gZnJvbSAnLi9leHRlbnNpb25zVmlld3MuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzU2VydmljZSwgUHJvZ3Jlc3NMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0IHsgSUFjdGl2aXR5U2VydmljZSwgSUJhZGdlLCBOdW1iZXJCYWRnZSwgV2FybmluZ0JhZGdlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvYWN0aXZpdHkvY29tbW9uL2FjdGl2aXR5LmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSVZpZXdzUmVnaXN0cnksIElWaWV3RGVzY3JpcHRvciwgRXh0ZW5zaW9ucywgVmlld0NvbnRhaW5lciwgSVZpZXdEZXNjcmlwdG9yU2VydmljZSwgSUFkZGVkVmlld0Rlc2NyaXB0b3JSZWYsIFZpZXdDb250YWluZXJMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlLCBDb250ZXh0S2V5RXhwciwgUmF3Q29udGV4dEtleSwgSUNvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UsIE5vdGlmaWNhdGlvblByaW9yaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaExheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFZpZXdQYW5lQ29udGFpbmVyIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3UGFuZUNvbnRhaW5lci5qcyc7XG5pbXBvcnQgeyBWaWV3UGFuZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmUuanMnO1xuaW1wb3J0IHsgUXVlcnkgfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9uUXVlcnkuanMnO1xuaW1wb3J0IHsgU3VnZ2VzdEVuYWJsZWRJbnB1dCB9IGZyb20gJy4uLy4uL2NvZGVFZGl0b3IvYnJvd3Nlci9zdWdnZXN0RW5hYmxlZElucHV0L3N1Z2dlc3RFbmFibGVkSW5wdXQuanMnO1xuaW1wb3J0IHsgYWxlcnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYXJpYS9hcmlhLmpzJztcbmltcG9ydCB7IEVYVEVOU0lPTl9DQVRFR09SSUVTIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IE1lbWVudG9PYmplY3QgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbWVtZW50by5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IElQcmVmZXJlbmNlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXMuanMnO1xuaW1wb3J0IHsgU0lERV9CQVJfRFJBR19BTkRfRFJPUF9CQUNLR1JPVU5EIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IFZpcnR1YWxXb3Jrc3BhY2VDb250ZXh0LCBXb3JrYmVuY2hTdGF0ZUNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IGluc3RhbGxMb2NhbEluUmVtb3RlSWNvbiB9IGZyb20gJy4vZXh0ZW5zaW9uc0ljb25zLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyQWN0aW9uMiwgQWN0aW9uMiwgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJUGFuZUNvbXBvc2l0ZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9wYW5lY29tcG9zaXRlLmpzJztcbmltcG9ydCB7IElQYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wYW5lY29tcG9zaXRlL2Jyb3dzZXIvcGFuZWNvbXBvc2l0ZS5qcyc7XG5pbXBvcnQgeyBjb2FsZXNjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBleHRyYWN0RWRpdG9yc0FuZEZpbGVzRHJvcERhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kbmQvYnJvd3Nlci9kbmQuanMnO1xuaW1wb3J0IHsgZXh0bmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBJTG9jYWxpemVkU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb24uanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJOYXZpZ2FibGVDb250YWluZXIgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2FjdGlvbnMvd2lkZ2V0TmF2aWdhdGlvbkNvbW1hbmRzLmpzJztcbmltcG9ydCB7IE1lbnVXb3JrYmVuY2hUb29sQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL3Rvb2xiYXIuanMnO1xuaW1wb3J0IHsgY3JlYXRlQWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvbWVudUVudHJ5QWN0aW9uVmlld0l0ZW0uanMnO1xuaW1wb3J0IHsgU2V2ZXJpdHlJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3NldmVyaXR5SWNvbi9zZXZlcml0eUljb24uanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRLZXlib2FyZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2tleWJvYXJkRXZlbnQuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCwgSUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QuanMnO1xuXG5leHBvcnQgY29uc3QgRGVmYXVsdFZpZXdzQ29udGV4dCA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdkZWZhdWx0RXh0ZW5zaW9uVmlld3MnLCB0cnVlKTtcbmV4cG9ydCBjb25zdCBFeHRlbnNpb25zU29ydEJ5Q29udGV4dCA9IG5ldyBSYXdDb250ZXh0S2V5PHN0cmluZz4oJ2V4dGVuc2lvbnNTb3J0QnlWYWx1ZScsICcnKTtcbmV4cG9ydCBjb25zdCBTZWFyY2hNYXJrZXRwbGFjZUV4dGVuc2lvbnNDb250ZXh0ID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ3NlYXJjaE1hcmtldHBsYWNlRXh0ZW5zaW9ucycsIGZhbHNlKTtcbmV4cG9ydCBjb25zdCBTZWFyY2hIYXNUZXh0Q29udGV4dCA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdleHRlbnNpb25TZWFyY2hIYXNUZXh0JywgZmFsc2UpO1xuY29uc3QgSW5zdGFsbGVkRXh0ZW5zaW9uc0NvbnRleHQgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignaW5zdGFsbGVkRXh0ZW5zaW9ucycsIGZhbHNlKTtcbmNvbnN0IFNlYXJjaEluc3RhbGxlZEV4dGVuc2lvbnNDb250ZXh0ID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ3NlYXJjaEluc3RhbGxlZEV4dGVuc2lvbnMnLCBmYWxzZSk7XG5jb25zdCBTZWFyY2hSZWNlbnRseVVwZGF0ZWRFeHRlbnNpb25zQ29udGV4dCA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdzZWFyY2hSZWNlbnRseVVwZGF0ZWRFeHRlbnNpb25zJywgZmFsc2UpO1xuY29uc3QgU2VhcmNoRXh0ZW5zaW9uVXBkYXRlc0NvbnRleHQgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignc2VhcmNoRXh0ZW5zaW9uVXBkYXRlcycsIGZhbHNlKTtcbmNvbnN0IFNlYXJjaE91dGRhdGVkRXh0ZW5zaW9uc0NvbnRleHQgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignc2VhcmNoT3V0ZGF0ZWRFeHRlbnNpb25zJywgZmFsc2UpO1xuY29uc3QgU2VhcmNoRW5hYmxlZEV4dGVuc2lvbnNDb250ZXh0ID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ3NlYXJjaEVuYWJsZWRFeHRlbnNpb25zJywgZmFsc2UpO1xuY29uc3QgU2VhcmNoRGlzYWJsZWRFeHRlbnNpb25zQ29udGV4dCA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdzZWFyY2hEaXNhYmxlZEV4dGVuc2lvbnMnLCBmYWxzZSk7XG5jb25zdCBIYXNJbnN0YWxsZWRFeHRlbnNpb25zQ29udGV4dCA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdoYXNJbnN0YWxsZWRFeHRlbnNpb25zJywgdHJ1ZSk7XG5leHBvcnQgY29uc3QgQnVpbHRJbkV4dGVuc2lvbnNDb250ZXh0ID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ2J1aWx0SW5FeHRlbnNpb25zJywgZmFsc2UpO1xuY29uc3QgU2VhcmNoQnVpbHRJbkV4dGVuc2lvbnNDb250ZXh0ID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ3NlYXJjaEJ1aWx0SW5FeHRlbnNpb25zJywgZmFsc2UpO1xuY29uc3QgU2VhcmNoVW5zdXBwb3J0ZWRXb3Jrc3BhY2VFeHRlbnNpb25zQ29udGV4dCA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdzZWFyY2hVbnN1cHBvcnRlZFdvcmtzcGFjZUV4dGVuc2lvbnMnLCBmYWxzZSk7XG5jb25zdCBTZWFyY2hEZXByZWNhdGVkRXh0ZW5zaW9uc0NvbnRleHQgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignc2VhcmNoRGVwcmVjYXRlZEV4dGVuc2lvbnMnLCBmYWxzZSk7XG5leHBvcnQgY29uc3QgUmVjb21tZW5kZWRFeHRlbnNpb25zQ29udGV4dCA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdyZWNvbW1lbmRlZEV4dGVuc2lvbnMnLCBmYWxzZSk7XG5jb25zdCBTb3J0QnlVcGRhdGVEYXRlQ29udGV4dCA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdzb3J0QnlVcGRhdGVEYXRlJywgZmFsc2UpO1xuZXhwb3J0IGNvbnN0IEV4dGVuc2lvbnNTZWFyY2hWYWx1ZUNvbnRleHQgPSBuZXcgUmF3Q29udGV4dEtleTxzdHJpbmc+KCdleHRlbnNpb25zU2VhcmNoVmFsdWUnLCAnJyk7XG5cbmNvbnN0IFJFTU9URV9DQVRFR09SWTogSUxvY2FsaXplZFN0cmluZyA9IGxvY2FsaXplMih7IGtleTogJ3JlbW90ZScsIGNvbW1lbnQ6IFsnUmVtb3RlIGFzIGluIHJlbW90ZSBtYWNoaW5lJ10gfSwgXCJSZW1vdGVcIik7XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25zVmlld2xldFZpZXdzQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgY29udGFpbmVyOiBWaWV3Q29udGFpbmVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5jb250YWluZXIgPSB2aWV3RGVzY3JpcHRvclNlcnZpY2UuZ2V0Vmlld0NvbnRhaW5lckJ5SWQoVklFV0xFVF9JRCkhO1xuXHRcdHRoaXMucmVnaXN0ZXJWaWV3cygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlclZpZXdzKCk6IHZvaWQge1xuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9yczogSVZpZXdEZXNjcmlwdG9yW10gPSBbXTtcblxuXHRcdC8qIERlZmF1bHQgdmlld3MgKi9cblx0XHR2aWV3RGVzY3JpcHRvcnMucHVzaCguLi50aGlzLmNyZWF0ZURlZmF1bHRFeHRlbnNpb25zVmlld0Rlc2NyaXB0b3JzKCkpO1xuXG5cdFx0LyogU2VhcmNoIHZpZXdzICovXG5cdFx0dmlld0Rlc2NyaXB0b3JzLnB1c2goLi4udGhpcy5jcmVhdGVTZWFyY2hFeHRlbnNpb25zVmlld0Rlc2NyaXB0b3JzKCkpO1xuXG5cdFx0LyogUmVjb21tZW5kYXRpb25zIHZpZXdzICovXG5cdFx0dmlld0Rlc2NyaXB0b3JzLnB1c2goLi4udGhpcy5jcmVhdGVSZWNvbW1lbmRlZEV4dGVuc2lvbnNWaWV3RGVzY3JpcHRvcnMoKSk7XG5cblx0XHQvKiBCdWlsdC1pbiBleHRlbnNpb25zIHZpZXdzICovXG5cdFx0dmlld0Rlc2NyaXB0b3JzLnB1c2goLi4udGhpcy5jcmVhdGVCdWlsdGluRXh0ZW5zaW9uc1ZpZXdEZXNjcmlwdG9ycygpKTtcblxuXHRcdC8qIFRydXN0IFJlcXVpcmVkIGV4dGVuc2lvbnMgdmlld3MgKi9cblx0XHR2aWV3RGVzY3JpcHRvcnMucHVzaCguLi50aGlzLmNyZWF0ZVVuc3VwcG9ydGVkV29ya3NwYWNlRXh0ZW5zaW9uc1ZpZXdEZXNjcmlwdG9ycygpKTtcblxuXHRcdC8qIE90aGVyIExvY2FsIEZpbHRlcmVkIGV4dGVuc2lvbnMgdmlld3MgKi9cblx0XHR2aWV3RGVzY3JpcHRvcnMucHVzaCguLi50aGlzLmNyZWF0ZU90aGVyTG9jYWxGaWx0ZXJlZEV4dGVuc2lvbnNWaWV3RGVzY3JpcHRvcnMoKSk7XG5cblx0XHRSZWdpc3RyeS5hczxJVmlld3NSZWdpc3RyeT4oRXh0ZW5zaW9ucy5WaWV3c1JlZ2lzdHJ5KS5yZWdpc3RlclZpZXdzKHZpZXdEZXNjcmlwdG9ycywgdGhpcy5jb250YWluZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVEZWZhdWx0RXh0ZW5zaW9uc1ZpZXdEZXNjcmlwdG9ycygpOiBJVmlld0Rlc2NyaXB0b3JbXSB7XG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3JzOiBJVmlld0Rlc2NyaXB0b3JbXSA9IFtdO1xuXG5cdFx0Lypcblx0XHQgKiBEZWZhdWx0IGluc3RhbGxlZCBleHRlbnNpb25zIHZpZXdzIC0gU2hvd3MgYWxsIHVzZXIgaW5zdGFsbGVkIGV4dGVuc2lvbnMuXG5cdFx0ICovXG5cdFx0Y29uc3Qgc2VydmVyczogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJbXSA9IFtdO1xuXHRcdGlmICh0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLmxvY2FsRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcikge1xuXHRcdFx0c2VydmVycy5wdXNoKHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcikge1xuXHRcdFx0c2VydmVycy5wdXNoKHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcik7XG5cdFx0fVxuXHRcdGlmICh0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLndlYkV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdHNlcnZlcnMucHVzaCh0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLndlYkV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpO1xuXHRcdH1cblx0XHRjb25zdCBnZXRWaWV3TmFtZSA9ICh2aWV3VGl0bGU6IHN0cmluZywgc2VydmVyOiBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcik6IHN0cmluZyA9PiB7XG5cdFx0XHRyZXR1cm4gc2VydmVycy5sZW5ndGggPiAxID8gYCR7c2VydmVyLmxhYmVsfSAtICR7dmlld1RpdGxlfWAgOiB2aWV3VGl0bGU7XG5cdFx0fTtcblx0XHRsZXQgaW5zdGFsbGVkV2ViRXh0ZW5zaW9uc0NvbnRleHRDaGFuZ2VFdmVudCA9IEV2ZW50Lk5vbmU7XG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2Uud2ViRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciAmJiB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLnJlbW90ZUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdGNvbnN0IGludGVyZXN0aW5nQ29udGV4dEtleXMgPSBuZXcgU2V0KCk7XG5cdFx0XHRpbnRlcmVzdGluZ0NvbnRleHRLZXlzLmFkZCgnaGFzSW5zdGFsbGVkV2ViRXh0ZW5zaW9ucycpO1xuXHRcdFx0aW5zdGFsbGVkV2ViRXh0ZW5zaW9uc0NvbnRleHRDaGFuZ2VFdmVudCA9IEV2ZW50LmZpbHRlcih0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLm9uRGlkQ2hhbmdlQ29udGV4dCwgZSA9PiBlLmFmZmVjdHNTb21lKGludGVyZXN0aW5nQ29udGV4dEtleXMpKTtcblx0XHR9XG5cdFx0Y29uc3Qgc2VydmVyTGFiZWxDaGFuZ2VFdmVudCA9IEV2ZW50LmFueSh0aGlzLmxhYmVsU2VydmljZS5vbkRpZENoYW5nZUZvcm1hdHRlcnMsIGluc3RhbGxlZFdlYkV4dGVuc2lvbnNDb250ZXh0Q2hhbmdlRXZlbnQpO1xuXHRcdGZvciAoY29uc3Qgc2VydmVyIG9mIHNlcnZlcnMpIHtcblx0XHRcdGNvbnN0IGdldEluc3RhbGxlZFZpZXdOYW1lID0gKCk6IHN0cmluZyA9PiBnZXRWaWV3TmFtZShsb2NhbGl6ZSgnaW5zdGFsbGVkJywgXCJJbnN0YWxsZWRcIiksIHNlcnZlcik7XG5cdFx0XHRjb25zdCBvbkRpZENoYW5nZVRpdGxlID0gRXZlbnQubWFwPHZvaWQsIHN0cmluZz4oc2VydmVyTGFiZWxDaGFuZ2VFdmVudCwgKCkgPT4gZ2V0SW5zdGFsbGVkVmlld05hbWUoKSk7XG5cdFx0XHRjb25zdCBpZCA9IHNlcnZlcnMubGVuZ3RoID4gMSA/IGB3b3JrYmVuY2gudmlld3MuZXh0ZW5zaW9ucy4ke3NlcnZlci5pZH0uaW5zdGFsbGVkYCA6IGB3b3JrYmVuY2gudmlld3MuZXh0ZW5zaW9ucy5pbnN0YWxsZWRgO1xuXHRcdFx0LyogSW5zdGFsbGVkIGV4dGVuc2lvbnMgdmlldyAqL1xuXHRcdFx0dmlld0Rlc2NyaXB0b3JzLnB1c2goe1xuXHRcdFx0XHRpZCxcblx0XHRcdFx0Z2V0IG5hbWUoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHZhbHVlOiBnZXRJbnN0YWxsZWRWaWV3TmFtZSgpLFxuXHRcdFx0XHRcdFx0b3JpZ2luYWw6IGdldFZpZXdOYW1lKCdJbnN0YWxsZWQnLCBzZXJ2ZXIpXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fSxcblx0XHRcdFx0d2VpZ2h0OiAxMDAsXG5cdFx0XHRcdG9yZGVyOiAxLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoRGVmYXVsdFZpZXdzQ29udGV4dCksXG5cdFx0XHRcdGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoU2VydmVySW5zdGFsbGVkRXh0ZW5zaW9uc1ZpZXcsIFt7IHNlcnZlciwgZmxleGlibGVIZWlnaHQ6IHRydWUsIG9uRGlkQ2hhbmdlVGl0bGUgfV0pLFxuXHRcdFx0XHQvKiBJbnN0YWxsZWQgZXh0ZW5zaW9ucyB2aWV3cyBzaGFsbCBub3QgYmUgYWxsb3dlZCB0byBoaWRkZW4gd2hlbiB0aGVyZSBhcmUgbW9yZSB0aGFuIG9uZSBzZXJ2ZXIgKi9cblx0XHRcdFx0Y2FuVG9nZ2xlVmlzaWJpbGl0eTogc2VydmVycy5sZW5ndGggPT09IDFcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoc2VydmVyID09PSB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLnJlbW90ZUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIgJiYgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5sb2NhbEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEluc3RhbGxMb2NhbEV4dGVuc2lvbnNJblJlbW90ZUFjdGlvbjIgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5pbnN0YWxsTG9jYWxFeHRlbnNpb25zJyxcblx0XHRcdFx0XHRcdFx0Z2V0IHRpdGxlKCkge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBsb2NhbGl6ZTIoJ3NlbGVjdCBhbmQgaW5zdGFsbCBsb2NhbCBleHRlbnNpb25zJywgXCJJbnN0YWxsIExvY2FsIEV4dGVuc2lvbnMgaW4gJ3swfScuLi5cIiwgc2VydmVyLmxhYmVsKTtcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0Y2F0ZWdvcnk6IFJFTU9URV9DQVRFR09SWSxcblx0XHRcdFx0XHRcdFx0aWNvbjogaW5zdGFsbExvY2FsSW5SZW1vdGVJY29uLFxuXHRcdFx0XHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0bWVudToge1xuXHRcdFx0XHRcdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIGlkKSxcblx0XHRcdFx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSkuY3JlYXRlSW5zdGFuY2UoSW5zdGFsbExvY2FsRXh0ZW5zaW9uc0luUmVtb3RlQWN0aW9uKS5ydW4oKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5sb2NhbEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIgJiYgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5yZW1vdGVFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgSW5zdGFsbFJlbW90ZUV4dGVuc2lvbnNJbkxvY2FsQWN0aW9uMiBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbnMuaW5zdGFsbExvY2FsRXh0ZW5zaW9uc0luUmVtb3RlJyxcblx0XHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2luc3RhbGwgcmVtb3RlIGluIGxvY2FsJywgJ0luc3RhbGwgUmVtb3RlIEV4dGVuc2lvbnMgTG9jYWxseS4uLicpLFxuXHRcdFx0XHRcdFx0Y2F0ZWdvcnk6IFJFTU9URV9DQVRFR09SWSxcblx0XHRcdFx0XHRcdGYxOiB0cnVlXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdFx0cmV0dXJuIGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpLmNyZWF0ZUluc3RhbmNlKEluc3RhbGxSZW1vdGVFeHRlbnNpb25zSW5Mb2NhbEFjdGlvbiwgJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbnMuaW5zdGFsbExvY2FsRXh0ZW5zaW9uc0luUmVtb3RlJykucnVuKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHQvKlxuXHRcdCAqIERlZmF1bHQgcG9wdWxhciBleHRlbnNpb25zIHZpZXdcblx0XHQgKiBTZXBhcmF0ZSB2aWV3IGZvciBwb3B1bGFyIGV4dGVuc2lvbnMgcmVxdWlyZWQgYXMgd2UgbmVlZCB0byBzaG93IHBvcHVsYXIgYW5kIHJlY29tbWVuZGVkIHNlY3Rpb25zXG5cdFx0ICogaW4gdGhlIGRlZmF1bHQgdmlldyB3aGVuIHRoZXJlIGlzIG5vIHNlYXJjaCB0ZXh0LCBhbmQgdXNlciBoYXMgbm8gaW5zdGFsbGVkIGV4dGVuc2lvbnMuXG5cdFx0ICovXG5cdFx0dmlld0Rlc2NyaXB0b3JzLnB1c2goe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2gudmlld3MuZXh0ZW5zaW9ucy5wb3B1bGFyJyxcblx0XHRcdG5hbWU6IGxvY2FsaXplMigncG9wdWxhckV4dGVuc2lvbnMnLCBcIlBvcHVsYXJcIiksXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKERlZmF1bHRQb3B1bGFyRXh0ZW5zaW9uc1ZpZXcsIFt7IGhpZGVCYWRnZTogdHJ1ZSB9XSksXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoRGVmYXVsdFZpZXdzQ29udGV4dCwgQ29udGV4dEtleUV4cHIubm90KCdoYXNJbnN0YWxsZWRFeHRlbnNpb25zJyksIENPTlRFWFRfSEFTX0dBTExFUlkpLFxuXHRcdFx0d2VpZ2h0OiA2MCxcblx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0Y2FuVG9nZ2xlVmlzaWJpbGl0eTogZmFsc2Vcblx0XHR9KTtcblxuXHRcdC8qXG5cdFx0ICogRGVmYXVsdCByZWNvbW1lbmRlZCBleHRlbnNpb25zIHZpZXdcblx0XHQgKiBXaGVuIHVzZXIgaGFzIGluc3RhbGxlZCBleHRlbnNpb25zLCB0aGlzIGlzIHNob3duIGFsb25nIHdpdGggdGhlIHZpZXdzIGZvciBlbmFibGVkICYgZGlzYWJsZWQgZXh0ZW5zaW9uc1xuXHRcdCAqIFdoZW4gdXNlciBoYXMgbm8gaW5zdGFsbGVkIGV4dGVuc2lvbnMsIHRoaXMgaXMgc2hvd24gYWxvbmcgd2l0aCB0aGUgdmlldyBmb3IgcG9wdWxhciBleHRlbnNpb25zXG5cdFx0ICovXG5cdFx0dmlld0Rlc2NyaXB0b3JzLnB1c2goe1xuXHRcdFx0aWQ6ICdleHRlbnNpb25zLnJlY29tbWVuZGVkTGlzdCcsXG5cdFx0XHRuYW1lOiBsb2NhbGl6ZTIoJ3JlY29tbWVuZGVkRXh0ZW5zaW9ucycsIFwiUmVjb21tZW5kZWRcIiksXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKERlZmF1bHRSZWNvbW1lbmRlZEV4dGVuc2lvbnNWaWV3LCBbeyBmbGV4aWJsZUhlaWdodDogdHJ1ZSB9XSksXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoRGVmYXVsdFZpZXdzQ29udGV4dCwgU29ydEJ5VXBkYXRlRGF0ZUNvbnRleHQubmVnYXRlKCksIENvbnRleHRLZXlFeHByLm5vdCgnY29uZmlnLmV4dGVuc2lvbnMuc2hvd1JlY29tbWVuZGF0aW9uc09ubHlPbkRlbWFuZCcpLCBDT05URVhUX0hBU19HQUxMRVJZKSxcblx0XHRcdHdlaWdodDogNDAsXG5cdFx0XHRvcmRlcjogMyxcblx0XHRcdGNhblRvZ2dsZVZpc2liaWxpdHk6IHRydWVcblx0XHR9KTtcblxuXHRcdC8qIEluc3RhbGxlZCB2aWV3cyBzaGFsbCBiZSBkZWZhdWx0IGluIG11bHRpIHNlcnZlciB3aW5kb3cgICovXG5cdFx0aWYgKHNlcnZlcnMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHQvKlxuXHRcdFx0ICogRGVmYXVsdCBlbmFibGVkIGV4dGVuc2lvbnMgdmlldyAtIFNob3dzIGFsbCB1c2VyIGluc3RhbGxlZCBlbmFibGVkIGV4dGVuc2lvbnMuXG5cdFx0XHQgKiBIaWRkZW4gYnkgZGVmYXVsdFxuXHRcdFx0ICovXG5cdFx0XHR2aWV3RGVzY3JpcHRvcnMucHVzaCh7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLnZpZXdzLmV4dGVuc2lvbnMuZW5hYmxlZCcsXG5cdFx0XHRcdG5hbWU6IGxvY2FsaXplMignZW5hYmxlZEV4dGVuc2lvbnMnLCBcIkVuYWJsZWRcIiksXG5cdFx0XHRcdGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoRW5hYmxlZEV4dGVuc2lvbnNWaWV3LCBbe31dKSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKERlZmF1bHRWaWV3c0NvbnRleHQsIENvbnRleHRLZXlFeHByLmhhcygnaGFzSW5zdGFsbGVkRXh0ZW5zaW9ucycpKSxcblx0XHRcdFx0aGlkZUJ5RGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0d2VpZ2h0OiA0MCxcblx0XHRcdFx0b3JkZXI6IDQsXG5cdFx0XHRcdGNhblRvZ2dsZVZpc2liaWxpdHk6IHRydWVcblx0XHRcdH0pO1xuXG5cdFx0XHQvKlxuXHRcdFx0ICogRGVmYXVsdCBkaXNhYmxlZCBleHRlbnNpb25zIHZpZXcgLSBTaG93cyBhbGwgZGlzYWJsZWQgZXh0ZW5zaW9ucy5cblx0XHRcdCAqIEhpZGRlbiBieSBkZWZhdWx0XG5cdFx0XHQgKi9cblx0XHRcdHZpZXdEZXNjcmlwdG9ycy5wdXNoKHtcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2gudmlld3MuZXh0ZW5zaW9ucy5kaXNhYmxlZCcsXG5cdFx0XHRcdG5hbWU6IGxvY2FsaXplMignZGlzYWJsZWRFeHRlbnNpb25zJywgXCJEaXNhYmxlZFwiKSxcblx0XHRcdFx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihEaXNhYmxlZEV4dGVuc2lvbnNWaWV3LCBbe31dKSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKERlZmF1bHRWaWV3c0NvbnRleHQsIENvbnRleHRLZXlFeHByLmhhcygnaGFzSW5zdGFsbGVkRXh0ZW5zaW9ucycpKSxcblx0XHRcdFx0aGlkZUJ5RGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0d2VpZ2h0OiAxMCxcblx0XHRcdFx0b3JkZXI6IDUsXG5cdFx0XHRcdGNhblRvZ2dsZVZpc2liaWxpdHk6IHRydWVcblx0XHRcdH0pO1xuXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHZpZXdEZXNjcmlwdG9ycztcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlU2VhcmNoRXh0ZW5zaW9uc1ZpZXdEZXNjcmlwdG9ycygpOiBJVmlld0Rlc2NyaXB0b3JbXSB7XG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3JzOiBJVmlld0Rlc2NyaXB0b3JbXSA9IFtdO1xuXG5cdFx0Lypcblx0XHQgKiBWaWV3IHVzZWQgZm9yIHNlYXJjaGluZyBNYXJrZXRwbGFjZVxuXHRcdCAqL1xuXHRcdHZpZXdEZXNjcmlwdG9ycy5wdXNoKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLnZpZXdzLmV4dGVuc2lvbnMubWFya2V0cGxhY2UnLFxuXHRcdFx0bmFtZTogbG9jYWxpemUyKCdtYXJrZXRQbGFjZScsIFwiTWFya2V0cGxhY2VcIiksXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKFNlYXJjaE1hcmtldHBsYWNlRXh0ZW5zaW9uc1ZpZXcsIFt7fV0pLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmhhcygnc2VhcmNoTWFya2V0cGxhY2VFeHRlbnNpb25zJykpLFxuXHRcdH0pO1xuXG5cdFx0Lypcblx0XHQgKiBWaWV3IHVzZWQgZm9yIHNlYXJjaGluZyBhbGwgaW5zdGFsbGVkIGV4dGVuc2lvbnNcblx0XHQgKi9cblx0XHR2aWV3RGVzY3JpcHRvcnMucHVzaCh7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC52aWV3cy5leHRlbnNpb25zLnNlYXJjaEluc3RhbGxlZCcsXG5cdFx0XHRuYW1lOiBsb2NhbGl6ZTIoJ2luc3RhbGxlZCcsIFwiSW5zdGFsbGVkXCIpLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihFeHRlbnNpb25zTGlzdFZpZXcsIFt7fV0pLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoQ29udGV4dEtleUV4cHIuaGFzKCdzZWFyY2hJbnN0YWxsZWRFeHRlbnNpb25zJyksIENvbnRleHRLZXlFeHByLmhhcygnaW5zdGFsbGVkRXh0ZW5zaW9ucycpKSxcblx0XHR9KTtcblxuXHRcdC8qXG5cdFx0ICogVmlldyB1c2VkIGZvciBzZWFyY2hpbmcgcmVjZW50bHkgdXBkYXRlZCBleHRlbnNpb25zXG5cdFx0ICovXG5cdFx0dmlld0Rlc2NyaXB0b3JzLnB1c2goe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2gudmlld3MuZXh0ZW5zaW9ucy5zZWFyY2hSZWNlbnRseVVwZGF0ZWQnLFxuXHRcdFx0bmFtZTogbG9jYWxpemUyKCdyZWNlbnRseSB1cGRhdGVkJywgXCJSZWNlbnRseSBVcGRhdGVkXCIpLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihSZWNlbnRseVVwZGF0ZWRFeHRlbnNpb25zVmlldywgW3t9XSksXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5vcihTZWFyY2hFeHRlbnNpb25VcGRhdGVzQ29udGV4dCwgQ29udGV4dEtleUV4cHIuaGFzKCdzZWFyY2hSZWNlbnRseVVwZGF0ZWRFeHRlbnNpb25zJykpLFxuXHRcdFx0b3JkZXI6IDIsXG5cdFx0fSk7XG5cblx0XHQvKlxuXHRcdCAqIFZpZXcgdXNlZCBmb3Igc2VhcmNoaW5nIGVuYWJsZWQgZXh0ZW5zaW9uc1xuXHRcdCAqL1xuXHRcdHZpZXdEZXNjcmlwdG9ycy5wdXNoKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLnZpZXdzLmV4dGVuc2lvbnMuc2VhcmNoRW5hYmxlZCcsXG5cdFx0XHRuYW1lOiBsb2NhbGl6ZTIoJ2VuYWJsZWQnLCBcIkVuYWJsZWRcIiksXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKEV4dGVuc2lvbnNMaXN0VmlldywgW3t9XSksXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuaGFzKCdzZWFyY2hFbmFibGVkRXh0ZW5zaW9ucycpKSxcblx0XHR9KTtcblxuXHRcdC8qXG5cdFx0ICogVmlldyB1c2VkIGZvciBzZWFyY2hpbmcgZGlzYWJsZWQgZXh0ZW5zaW9uc1xuXHRcdCAqL1xuXHRcdHZpZXdEZXNjcmlwdG9ycy5wdXNoKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLnZpZXdzLmV4dGVuc2lvbnMuc2VhcmNoRGlzYWJsZWQnLFxuXHRcdFx0bmFtZTogbG9jYWxpemUyKCdkaXNhYmxlZCcsIFwiRGlzYWJsZWRcIiksXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKEV4dGVuc2lvbnNMaXN0VmlldywgW3t9XSksXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuaGFzKCdzZWFyY2hEaXNhYmxlZEV4dGVuc2lvbnMnKSksXG5cdFx0fSk7XG5cblx0XHQvKlxuXHRcdCAqIFZpZXcgdXNlZCBmb3Igc2VhcmNoaW5nIG91dGRhdGVkIGV4dGVuc2lvbnNcblx0XHQgKi9cblx0XHR2aWV3RGVzY3JpcHRvcnMucHVzaCh7XG5cdFx0XHRpZDogT1VUREFURURfRVhURU5TSU9OU19WSUVXX0lELFxuXHRcdFx0bmFtZTogbG9jYWxpemUyKCdhdmFpbGFibGVVcGRhdGVzJywgXCJBdmFpbGFibGUgVXBkYXRlc1wiKSxcblx0XHRcdGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoT3V0ZGF0ZWRFeHRlbnNpb25zVmlldywgW3t9XSksXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5vcihTZWFyY2hFeHRlbnNpb25VcGRhdGVzQ29udGV4dCwgQ29udGV4dEtleUV4cHIuaGFzKCdzZWFyY2hPdXRkYXRlZEV4dGVuc2lvbnMnKSksXG5cdFx0XHRvcmRlcjogMSxcblx0XHR9KTtcblxuXHRcdC8qXG5cdFx0ICogVmlldyB1c2VkIGZvciBzZWFyY2hpbmcgYnVpbHRpbiBleHRlbnNpb25zXG5cdFx0ICovXG5cdFx0dmlld0Rlc2NyaXB0b3JzLnB1c2goe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2gudmlld3MuZXh0ZW5zaW9ucy5zZWFyY2hCdWlsdGluJyxcblx0XHRcdG5hbWU6IGxvY2FsaXplMignYnVpbHRpbicsIFwiQnVpbHRpblwiKSxcblx0XHRcdGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoRXh0ZW5zaW9uc0xpc3RWaWV3LCBbe31dKSxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5oYXMoJ3NlYXJjaEJ1aWx0SW5FeHRlbnNpb25zJykpLFxuXHRcdH0pO1xuXG5cdFx0Lypcblx0XHQgKiBWaWV3IHVzZWQgZm9yIHNlYXJjaGluZyB3b3Jrc3BhY2UgdW5zdXBwb3J0ZWQgZXh0ZW5zaW9uc1xuXHRcdCAqL1xuXHRcdHZpZXdEZXNjcmlwdG9ycy5wdXNoKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLnZpZXdzLmV4dGVuc2lvbnMuc2VhcmNoV29ya3NwYWNlVW5zdXBwb3J0ZWQnLFxuXHRcdFx0bmFtZTogbG9jYWxpemUyKCd3b3Jrc3BhY2VVbnN1cHBvcnRlZCcsIFwiV29ya3NwYWNlIFVuc3VwcG9ydGVkXCIpLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihFeHRlbnNpb25zTGlzdFZpZXcsIFt7fV0pLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmhhcygnc2VhcmNoV29ya3NwYWNlVW5zdXBwb3J0ZWRFeHRlbnNpb25zJykpLFxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHZpZXdEZXNjcmlwdG9ycztcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlUmVjb21tZW5kZWRFeHRlbnNpb25zVmlld0Rlc2NyaXB0b3JzKCk6IElWaWV3RGVzY3JpcHRvcltdIHtcblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcnM6IElWaWV3RGVzY3JpcHRvcltdID0gW107XG5cblx0XHR2aWV3RGVzY3JpcHRvcnMucHVzaCh7XG5cdFx0XHRpZDogV09SS1NQQUNFX1JFQ09NTUVOREFUSU9OU19WSUVXX0lELFxuXHRcdFx0bmFtZTogbG9jYWxpemUyKCd3b3Jrc3BhY2VSZWNvbW1lbmRlZEV4dGVuc2lvbnMnLCBcIldvcmtzcGFjZSBSZWNvbW1lbmRhdGlvbnNcIiksXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKFdvcmtzcGFjZVJlY29tbWVuZGVkRXh0ZW5zaW9uc1ZpZXcsIFt7fV0pLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmhhcygncmVjb21tZW5kZWRFeHRlbnNpb25zJyksIFdvcmtiZW5jaFN0YXRlQ29udGV4dC5ub3RFcXVhbHNUbygnZW1wdHknKSksXG5cdFx0XHRvcmRlcjogMVxuXHRcdH0pO1xuXG5cdFx0dmlld0Rlc2NyaXB0b3JzLnB1c2goe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2gudmlld3MuZXh0ZW5zaW9ucy5vdGhlclJlY29tbWVuZGF0aW9ucycsXG5cdFx0XHRuYW1lOiBsb2NhbGl6ZTIoJ290aGVyUmVjb21tZW5kZWRFeHRlbnNpb25zJywgXCJPdGhlciBSZWNvbW1lbmRhdGlvbnNcIiksXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKFJlY29tbWVuZGVkRXh0ZW5zaW9uc1ZpZXcsIFt7fV0pLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuaGFzKCdyZWNvbW1lbmRlZEV4dGVuc2lvbnMnKSxcblx0XHRcdG9yZGVyOiAyXG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gdmlld0Rlc2NyaXB0b3JzO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVCdWlsdGluRXh0ZW5zaW9uc1ZpZXdEZXNjcmlwdG9ycygpOiBJVmlld0Rlc2NyaXB0b3JbXSB7XG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3JzOiBJVmlld0Rlc2NyaXB0b3JbXSA9IFtdO1xuXG5cdFx0Y29uc3QgY29uZmlndXJlZENhdGVnb3JpZXMgPSBbJ3RoZW1lcycsICdwcm9ncmFtbWluZyBsYW5ndWFnZXMnXTtcblx0XHRjb25zdCBvdGhlckNhdGVnb3JpZXMgPSBFWFRFTlNJT05fQ0FURUdPUklFUy5maWx0ZXIoYyA9PiAhY29uZmlndXJlZENhdGVnb3JpZXMuaW5jbHVkZXMoYy50b0xvd2VyQ2FzZSgpKSk7XG5cdFx0b3RoZXJDYXRlZ29yaWVzLnB1c2goTk9ORV9DQVRFR09SWSk7XG5cdFx0Y29uc3Qgb3RoZXJDYXRlZ29yaWVzUXVlcnkgPSBgJHtvdGhlckNhdGVnb3JpZXMubWFwKGMgPT4gYGNhdGVnb3J5OlwiJHtjfVwiYCkuam9pbignICcpfSAke2NvbmZpZ3VyZWRDYXRlZ29yaWVzLm1hcChjID0+IGBjYXRlZ29yeTpcIi0ke2N9XCJgKS5qb2luKCcgJyl9YDtcblx0XHR2aWV3RGVzY3JpcHRvcnMucHVzaCh7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC52aWV3cy5leHRlbnNpb25zLmJ1aWx0aW5GZWF0dXJlRXh0ZW5zaW9ucycsXG5cdFx0XHRuYW1lOiBsb2NhbGl6ZTIoJ2J1aWx0aW5GZWF0dXJlRXh0ZW5zaW9ucycsIFwiRmVhdHVyZXNcIiksXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKFN0YXRpY1F1ZXJ5RXh0ZW5zaW9uc1ZpZXcsIFt7IHF1ZXJ5OiBgQGJ1aWx0aW4gJHtvdGhlckNhdGVnb3JpZXNRdWVyeX1gIH1dKSxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmhhcygnYnVpbHRJbkV4dGVuc2lvbnMnKSxcblx0XHR9KTtcblxuXHRcdHZpZXdEZXNjcmlwdG9ycy5wdXNoKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLnZpZXdzLmV4dGVuc2lvbnMuYnVpbHRpblRoZW1lRXh0ZW5zaW9ucycsXG5cdFx0XHRuYW1lOiBsb2NhbGl6ZTIoJ2J1aWx0SW5UaGVtZXNFeHRlbnNpb25zJywgXCJUaGVtZXNcIiksXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKFN0YXRpY1F1ZXJ5RXh0ZW5zaW9uc1ZpZXcsIFt7IHF1ZXJ5OiBgQGJ1aWx0aW4gY2F0ZWdvcnk6dGhlbWVzYCB9XSksXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5oYXMoJ2J1aWx0SW5FeHRlbnNpb25zJyksXG5cdFx0fSk7XG5cblx0XHR2aWV3RGVzY3JpcHRvcnMucHVzaCh7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC52aWV3cy5leHRlbnNpb25zLmJ1aWx0aW5Qcm9ncmFtbWluZ0xhbmd1YWdlRXh0ZW5zaW9ucycsXG5cdFx0XHRuYW1lOiBsb2NhbGl6ZTIoJ2J1aWx0aW5Qcm9ncmFtbWluZ0xhbmd1YWdlRXh0ZW5zaW9ucycsIFwiUHJvZ3JhbW1pbmcgTGFuZ3VhZ2VzXCIpLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihTdGF0aWNRdWVyeUV4dGVuc2lvbnNWaWV3LCBbeyBxdWVyeTogYEBidWlsdGluIGNhdGVnb3J5OlwicHJvZ3JhbW1pbmcgbGFuZ3VhZ2VzXCJgIH1dKSxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmhhcygnYnVpbHRJbkV4dGVuc2lvbnMnKSxcblx0XHR9KTtcblxuXHRcdHJldHVybiB2aWV3RGVzY3JpcHRvcnM7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVVuc3VwcG9ydGVkV29ya3NwYWNlRXh0ZW5zaW9uc1ZpZXdEZXNjcmlwdG9ycygpOiBJVmlld0Rlc2NyaXB0b3JbXSB7XG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3JzOiBJVmlld0Rlc2NyaXB0b3JbXSA9IFtdO1xuXG5cdFx0dmlld0Rlc2NyaXB0b3JzLnB1c2goe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2gudmlld3MuZXh0ZW5zaW9ucy51bnRydXN0ZWRVbnN1cHBvcnRlZEV4dGVuc2lvbnMnLFxuXHRcdFx0bmFtZTogbG9jYWxpemUyKCd1bnRydXN0ZWRVbnN1cHBvcnRlZEV4dGVuc2lvbnMnLCBcIkRpc2FibGVkIGluIFJlc3RyaWN0ZWQgTW9kZVwiKSxcblx0XHRcdGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoVW50cnVzdGVkV29ya3NwYWNlVW5zdXBwb3J0ZWRFeHRlbnNpb25zVmlldywgW3t9XSksXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoU2VhcmNoVW5zdXBwb3J0ZWRXb3Jrc3BhY2VFeHRlbnNpb25zQ29udGV4dCksXG5cdFx0fSk7XG5cblx0XHR2aWV3RGVzY3JpcHRvcnMucHVzaCh7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC52aWV3cy5leHRlbnNpb25zLnVudHJ1c3RlZFBhcnRpYWxseVN1cHBvcnRlZEV4dGVuc2lvbnMnLFxuXHRcdFx0bmFtZTogbG9jYWxpemUyKCd1bnRydXN0ZWRQYXJ0aWFsbHlTdXBwb3J0ZWRFeHRlbnNpb25zJywgXCJMaW1pdGVkIGluIFJlc3RyaWN0ZWQgTW9kZVwiKSxcblx0XHRcdGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoVW50cnVzdGVkV29ya3NwYWNlUGFydGlhbGx5U3VwcG9ydGVkRXh0ZW5zaW9uc1ZpZXcsIFt7fV0pLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFNlYXJjaFVuc3VwcG9ydGVkV29ya3NwYWNlRXh0ZW5zaW9uc0NvbnRleHQpLFxuXHRcdH0pO1xuXG5cdFx0dmlld0Rlc2NyaXB0b3JzLnB1c2goe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2gudmlld3MuZXh0ZW5zaW9ucy52aXJ0dWFsVW5zdXBwb3J0ZWRFeHRlbnNpb25zJyxcblx0XHRcdG5hbWU6IGxvY2FsaXplMigndmlydHVhbFVuc3VwcG9ydGVkRXh0ZW5zaW9ucycsIFwiRGlzYWJsZWQgaW4gVmlydHVhbCBXb3Jrc3BhY2VzXCIpLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihWaXJ0dWFsV29ya3NwYWNlVW5zdXBwb3J0ZWRFeHRlbnNpb25zVmlldywgW3t9XSksXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoVmlydHVhbFdvcmtzcGFjZUNvbnRleHQsIFNlYXJjaFVuc3VwcG9ydGVkV29ya3NwYWNlRXh0ZW5zaW9uc0NvbnRleHQpLFxuXHRcdH0pO1xuXG5cdFx0dmlld0Rlc2NyaXB0b3JzLnB1c2goe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2gudmlld3MuZXh0ZW5zaW9ucy52aXJ0dWFsUGFydGlhbGx5U3VwcG9ydGVkRXh0ZW5zaW9ucycsXG5cdFx0XHRuYW1lOiBsb2NhbGl6ZTIoJ3ZpcnR1YWxQYXJ0aWFsbHlTdXBwb3J0ZWRFeHRlbnNpb25zJywgXCJMaW1pdGVkIGluIFZpcnR1YWwgV29ya3NwYWNlc1wiKSxcblx0XHRcdGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoVmlydHVhbFdvcmtzcGFjZVBhcnRpYWxseVN1cHBvcnRlZEV4dGVuc2lvbnNWaWV3LCBbe31dKSxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChWaXJ0dWFsV29ya3NwYWNlQ29udGV4dCwgU2VhcmNoVW5zdXBwb3J0ZWRXb3Jrc3BhY2VFeHRlbnNpb25zQ29udGV4dCksXG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gdmlld0Rlc2NyaXB0b3JzO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVPdGhlckxvY2FsRmlsdGVyZWRFeHRlbnNpb25zVmlld0Rlc2NyaXB0b3JzKCk6IElWaWV3RGVzY3JpcHRvcltdIHtcblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcnM6IElWaWV3RGVzY3JpcHRvcltdID0gW107XG5cblx0XHR2aWV3RGVzY3JpcHRvcnMucHVzaCh7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC52aWV3cy5leHRlbnNpb25zLmRlcHJlY2F0ZWRFeHRlbnNpb25zJyxcblx0XHRcdG5hbWU6IGxvY2FsaXplMignZGVwcmVjYXRlZCcsIFwiRGVwcmVjYXRlZFwiKSxcblx0XHRcdGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoRGVwcmVjYXRlZEV4dGVuc2lvbnNWaWV3LCBbe31dKSxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChTZWFyY2hEZXByZWNhdGVkRXh0ZW5zaW9uc0NvbnRleHQpLFxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHZpZXdEZXNjcmlwdG9ycztcblx0fVxuXG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25zVmlld1BhbmVDb250YWluZXIgZXh0ZW5kcyBWaWV3UGFuZUNvbnRhaW5lciBpbXBsZW1lbnRzIElFeHRlbnNpb25zVmlld1BhbmVDb250YWluZXIge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc1NlYXJjaFZhbHVlQ29udGV4dEtleTogSUNvbnRleHRLZXk8c3RyaW5nPjtcblx0cHJpdmF0ZSByZWFkb25seSBkZWZhdWx0Vmlld3NDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBzb3J0QnlDb250ZXh0S2V5OiBJQ29udGV4dEtleTxzdHJpbmc+O1xuXHRwcml2YXRlIHJlYWRvbmx5IHNlYXJjaE1hcmtldHBsYWNlRXh0ZW5zaW9uc0NvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IHNlYXJjaEhhc1RleHRDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBzb3J0QnlVcGRhdGVEYXRlQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgaW5zdGFsbGVkRXh0ZW5zaW9uc0NvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IHNlYXJjaEluc3RhbGxlZEV4dGVuc2lvbnNDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBzZWFyY2hSZWNlbnRseVVwZGF0ZWRFeHRlbnNpb25zQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgc2VhcmNoRXh0ZW5zaW9uVXBkYXRlc0NvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IHNlYXJjaE91dGRhdGVkRXh0ZW5zaW9uc0NvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IHNlYXJjaEVuYWJsZWRFeHRlbnNpb25zQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgc2VhcmNoRGlzYWJsZWRFeHRlbnNpb25zQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgaGFzSW5zdGFsbGVkRXh0ZW5zaW9uc0NvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGJ1aWx0SW5FeHRlbnNpb25zQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgc2VhcmNoQnVpbHRJbkV4dGVuc2lvbnNDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBzZWFyY2hXb3Jrc3BhY2VVbnN1cHBvcnRlZEV4dGVuc2lvbnNDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBzZWFyY2hEZXByZWNhdGVkRXh0ZW5zaW9uc0NvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IHJlY29tbWVuZGVkRXh0ZW5zaW9uc0NvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgc2VhcmNoRGVsYXllcjogRGVsYXllcjx2b2lkPjtcblx0cHJpdmF0ZSByb290OiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBoZWFkZXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHNlYXJjaEJveDogU3VnZ2VzdEVuYWJsZWRJbnB1dCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBub3RpZmljYXRpb25Db250YWluZXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IHNlYXJjaFZpZXdsZXRTdGF0ZTogTWVtZW50b09iamVjdDtcblx0cHJpdmF0ZSBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3Q6IElFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QgfCBudWxsID0gbnVsbDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVdvcmtiZW5jaExheW91dFNlcnZpY2UgbGF5b3V0U2VydmljZTogSVdvcmtiZW5jaExheW91dFNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJUHJvZ3Jlc3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZ3Jlc3NTZXJ2aWNlOiBJUHJvZ3Jlc3NTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUVkaXRvckdyb3Vwc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JHcm91cFNlcnZpY2U6IElFZGl0b3JHcm91cHNTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZSBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlOiBJRXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZSxcblx0XHRASUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2U6IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSxcblx0XHRASUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2U6IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHBhbmVDb21wb3NpdGVTZXJ2aWNlOiBJUGFuZUNvbXBvc2l0ZVBhcnRTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASVByZWZlcmVuY2VzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByZWZlcmVuY2VzU2VydmljZTogSVByZWZlcmVuY2VzU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKFZJRVdMRVRfSUQsIHsgbWVyZ2VWaWV3V2l0aENvbnRhaW5lcldoZW5TaW5nbGVWaWV3OiB0cnVlIH0sIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgbGF5b3V0U2VydmljZSwgY29udGV4dE1lbnVTZXJ2aWNlLCB0ZWxlbWV0cnlTZXJ2aWNlLCBleHRlbnNpb25TZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlLCBjb250ZXh0U2VydmljZSwgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBsb2dTZXJ2aWNlKTtcblxuXHRcdHRoaXMuc2VhcmNoRGVsYXllciA9IG5ldyBEZWxheWVyKDUwMCk7XG5cdFx0dGhpcy5leHRlbnNpb25zU2VhcmNoVmFsdWVDb250ZXh0S2V5ID0gRXh0ZW5zaW9uc1NlYXJjaFZhbHVlQ29udGV4dC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuZGVmYXVsdFZpZXdzQ29udGV4dEtleSA9IERlZmF1bHRWaWV3c0NvbnRleHQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnNvcnRCeUNvbnRleHRLZXkgPSBFeHRlbnNpb25zU29ydEJ5Q29udGV4dC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuc2VhcmNoTWFya2V0cGxhY2VFeHRlbnNpb25zQ29udGV4dEtleSA9IFNlYXJjaE1hcmtldHBsYWNlRXh0ZW5zaW9uc0NvbnRleHQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnNlYXJjaEhhc1RleHRDb250ZXh0S2V5ID0gU2VhcmNoSGFzVGV4dENvbnRleHQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnNvcnRCeVVwZGF0ZURhdGVDb250ZXh0S2V5ID0gU29ydEJ5VXBkYXRlRGF0ZUNvbnRleHQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmluc3RhbGxlZEV4dGVuc2lvbnNDb250ZXh0S2V5ID0gSW5zdGFsbGVkRXh0ZW5zaW9uc0NvbnRleHQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnNlYXJjaEluc3RhbGxlZEV4dGVuc2lvbnNDb250ZXh0S2V5ID0gU2VhcmNoSW5zdGFsbGVkRXh0ZW5zaW9uc0NvbnRleHQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnNlYXJjaFJlY2VudGx5VXBkYXRlZEV4dGVuc2lvbnNDb250ZXh0S2V5ID0gU2VhcmNoUmVjZW50bHlVcGRhdGVkRXh0ZW5zaW9uc0NvbnRleHQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnNlYXJjaEV4dGVuc2lvblVwZGF0ZXNDb250ZXh0S2V5ID0gU2VhcmNoRXh0ZW5zaW9uVXBkYXRlc0NvbnRleHQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnNlYXJjaFdvcmtzcGFjZVVuc3VwcG9ydGVkRXh0ZW5zaW9uc0NvbnRleHRLZXkgPSBTZWFyY2hVbnN1cHBvcnRlZFdvcmtzcGFjZUV4dGVuc2lvbnNDb250ZXh0LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5zZWFyY2hEZXByZWNhdGVkRXh0ZW5zaW9uc0NvbnRleHRLZXkgPSBTZWFyY2hEZXByZWNhdGVkRXh0ZW5zaW9uc0NvbnRleHQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnNlYXJjaE91dGRhdGVkRXh0ZW5zaW9uc0NvbnRleHRLZXkgPSBTZWFyY2hPdXRkYXRlZEV4dGVuc2lvbnNDb250ZXh0LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5zZWFyY2hFbmFibGVkRXh0ZW5zaW9uc0NvbnRleHRLZXkgPSBTZWFyY2hFbmFibGVkRXh0ZW5zaW9uc0NvbnRleHQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnNlYXJjaERpc2FibGVkRXh0ZW5zaW9uc0NvbnRleHRLZXkgPSBTZWFyY2hEaXNhYmxlZEV4dGVuc2lvbnNDb250ZXh0LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5oYXNJbnN0YWxsZWRFeHRlbnNpb25zQ29udGV4dEtleSA9IEhhc0luc3RhbGxlZEV4dGVuc2lvbnNDb250ZXh0LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5idWlsdEluRXh0ZW5zaW9uc0NvbnRleHRLZXkgPSBCdWlsdEluRXh0ZW5zaW9uc0NvbnRleHQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnNlYXJjaEJ1aWx0SW5FeHRlbnNpb25zQ29udGV4dEtleSA9IFNlYXJjaEJ1aWx0SW5FeHRlbnNpb25zQ29udGV4dC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMucmVjb21tZW5kZWRFeHRlbnNpb25zQ29udGV4dEtleSA9IFJlY29tbWVuZGVkRXh0ZW5zaW9uc0NvbnRleHQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnBhbmVDb21wb3NpdGVTZXJ2aWNlLm9uRGlkUGFuZUNvbXBvc2l0ZU9wZW4oZSA9PiB7IGlmIChlLnZpZXdDb250YWluZXJMb2NhdGlvbiA9PT0gVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpIHsgdGhpcy5vblZpZXdsZXRPcGVuKGUuY29tcG9zaXRlKTsgfSB9LCB0aGlzKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub25SZXNldCgoKSA9PiB0aGlzLnJlZnJlc2goKSkpO1xuXHRcdHRoaXMuc2VhcmNoVmlld2xldFN0YXRlID0gdGhpcy5nZXRNZW1lbnRvKFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cblx0XHRleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlLmdldEV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCgpXG5cdFx0XHQudGhlbihnYWxsZXJ5TWFuaWZlc3QgPT4ge1xuXHRcdFx0XHR0aGlzLmV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCA9IGdhbGxlcnlNYW5pZmVzdDtcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIoZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZS5vbkRpZENoYW5nZUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdChnYWxsZXJ5TWFuaWZlc3QgPT4ge1xuXHRcdFx0XHRcdHRoaXMuZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0ID0gZ2FsbGVyeU1hbmlmZXN0O1xuXHRcdFx0XHRcdHRoaXMucmVmcmVzaCgpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHR9KTtcblx0fVxuXG5cdGdldCBzZWFyY2hWYWx1ZSgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnNlYXJjaEJveD8uZ2V0VmFsdWUoKTtcblx0fVxuXG5cdG92ZXJyaWRlIGNyZWF0ZShwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0cGFyZW50LmNsYXNzTGlzdC5hZGQoJ2V4dGVuc2lvbnMtdmlld2xldCcpO1xuXHRcdHRoaXMucm9vdCA9IHBhcmVudDtcblxuXHRcdGNvbnN0IG92ZXJsYXkgPSBhcHBlbmQodGhpcy5yb290LCAkKCcub3ZlcmxheScpKTtcblx0XHRjb25zdCBvdmVybGF5QmFja2dyb3VuZENvbG9yID0gdGhpcy5nZXRDb2xvcihTSURFX0JBUl9EUkFHX0FORF9EUk9QX0JBQ0tHUk9VTkQpID8/ICcnO1xuXHRcdG92ZXJsYXkuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gb3ZlcmxheUJhY2tncm91bmRDb2xvcjtcblx0XHRoaWRlKG92ZXJsYXkpO1xuXG5cdFx0dGhpcy5oZWFkZXIgPSBhcHBlbmQodGhpcy5yb290LCAkKCcuaGVhZGVyJykpO1xuXHRcdGNvbnN0IHBsYWNlaG9sZGVyID0gbG9jYWxpemUoJ3NlYXJjaEV4dGVuc2lvbnMnLCBcIlNlYXJjaCBFeHRlbnNpb25zIGluIE1hcmtldHBsYWNlXCIpO1xuXG5cdFx0Y29uc3Qgc2VhcmNoVmFsdWUgPSB0aGlzLnNlYXJjaFZpZXdsZXRTdGF0ZVsncXVlcnkudmFsdWUnXSA/IHRoaXMuc2VhcmNoVmlld2xldFN0YXRlWydxdWVyeS52YWx1ZSddIDogJyc7XG5cblx0XHRjb25zdCBzZWFyY2hDb250YWluZXIgPSBhcHBlbmQodGhpcy5oZWFkZXIsICQoJy5leHRlbnNpb25zLXNlYXJjaC1jb250YWluZXInKSk7XG5cblx0XHR0aGlzLnNlYXJjaEJveCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU3VnZ2VzdEVuYWJsZWRJbnB1dCwgYCR7VklFV0xFVF9JRH0uc2VhcmNoYm94YCwgc2VhcmNoQ29udGFpbmVyLCB7XG5cdFx0XHR0cmlnZ2VyQ2hhcmFjdGVyczogWydAJ10sXG5cdFx0XHRzb3J0S2V5OiAoaXRlbTogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdGlmIChpdGVtLmluZGV4T2YoJzonKSA9PT0gLTEpIHsgcmV0dXJuICdhJzsgfVxuXHRcdFx0XHRlbHNlIGlmICgvZXh0Oi8udGVzdChpdGVtKSB8fCAvaWQ6Ly50ZXN0KGl0ZW0pIHx8IC90YWc6Ly50ZXN0KGl0ZW0pKSB7IHJldHVybiAnYic7IH1cblx0XHRcdFx0ZWxzZSBpZiAoL3NvcnQ6Ly50ZXN0KGl0ZW0pKSB7IHJldHVybiAnYyc7IH1cblx0XHRcdFx0ZWxzZSB7IHJldHVybiAnZCc7IH1cblx0XHRcdH0sXG5cdFx0XHRwcm92aWRlUmVzdWx0czogKHF1ZXJ5OiBzdHJpbmcpID0+IFF1ZXJ5LnN1Z2dlc3Rpb25zKHF1ZXJ5LCB0aGlzLmV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdClcblx0XHR9LCBwbGFjZWhvbGRlciwgJ2V4dGVuc2lvbnM6c2VhcmNoaW5wdXQnLCB7IHBsYWNlaG9sZGVyVGV4dDogcGxhY2Vob2xkZXIsIHZhbHVlOiBzZWFyY2hWYWx1ZSB9KSk7XG5cblx0XHR0aGlzLm5vdGlmaWNhdGlvbkNvbnRhaW5lciA9IGFwcGVuZCh0aGlzLmhlYWRlciwgJCgnLm5vdGlmaWNhdGlvbi1jb250YWluZXIuaGlkZGVuJywgeyAndGFiaW5kZXgnOiAnMCcgfSkpO1xuXHRcdHRoaXMucmVuZGVyTm90aWZpY2FpdG9uKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5vbkRpZENoYW5nZUV4dGVuc2lvbnNOb3RpZmljYXRpb24oKCkgPT4gdGhpcy5yZW5kZXJOb3RpZmljYWl0b24oKSkpO1xuXG5cdFx0dGhpcy51cGRhdGVJbnN0YWxsZWRFeHRlbnNpb25zQ29udGV4dHMoKTtcblx0XHRpZiAodGhpcy5zZWFyY2hCb3guZ2V0VmFsdWUoKSkge1xuXHRcdFx0dGhpcy50cmlnZ2VyU2VhcmNoKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZWFyY2hCb3gub25JbnB1dERpZENoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLnNvcnRCeUNvbnRleHRLZXkuc2V0KFF1ZXJ5LnBhcnNlKHRoaXMuc2VhcmNoQm94Py5nZXRWYWx1ZSgpID8/ICcnKS5zb3J0QnkpO1xuXHRcdFx0dGhpcy50cmlnZ2VyU2VhcmNoKCk7XG5cdFx0fSwgdGhpcykpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zZWFyY2hCb3gub25TaG91bGRGb2N1c1Jlc3VsdHMoKCkgPT4gdGhpcy5mb2N1c0xpc3RWaWV3KCksIHRoaXMpKTtcblxuXHRcdGNvbnN0IGNvbnRyb2xFbGVtZW50ID0gYXBwZW5kKHNlYXJjaENvbnRhaW5lciwgJCgnLmV4dGVuc2lvbnMtc2VhcmNoLWFjdGlvbnMtY29udGFpbmVyJykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWVudVdvcmtiZW5jaFRvb2xCYXIsIGNvbnRyb2xFbGVtZW50LCBleHRlbnNpb25zU2VhcmNoQWN0aW9uc01lbnUsIHtcblx0XHRcdHRvb2xiYXJPcHRpb25zOiB7XG5cdFx0XHRcdHByaW1hcnlHcm91cDogKCkgPT4gdHJ1ZSxcblx0XHRcdH0sXG5cdFx0XHRhY3Rpb25WaWV3SXRlbVByb3ZpZGVyOiAoYWN0aW9uLCBvcHRpb25zKSA9PiBjcmVhdGVBY3Rpb25WaWV3SXRlbSh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLCBhY3Rpb24sIG9wdGlvbnMpXG5cdFx0fSkpO1xuXG5cdFx0Ly8gUmVnaXN0ZXIgRHJhZ0FuZERyb3Agc3VwcG9ydFxuXHRcdHRoaXMuX3JlZ2lzdGVyKG5ldyBEcmFnQW5kRHJvcE9ic2VydmVyKHRoaXMucm9vdCwge1xuXHRcdFx0b25EcmFnRW50ZXI6IChlOiBEcmFnRXZlbnQpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuaXNTdXBwb3J0ZWREcmFnRWxlbWVudChlKSkge1xuXHRcdFx0XHRcdHNob3cob3ZlcmxheSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRvbkRyYWdMZWF2ZTogKGU6IERyYWdFdmVudCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5pc1N1cHBvcnRlZERyYWdFbGVtZW50KGUpKSB7XG5cdFx0XHRcdFx0aGlkZShvdmVybGF5KTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdG9uRHJhZ092ZXI6IChlOiBEcmFnRXZlbnQpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuaXNTdXBwb3J0ZWREcmFnRWxlbWVudChlKSkge1xuXHRcdFx0XHRcdGUuZGF0YVRyYW5zZmVyIS5kcm9wRWZmZWN0ID0gJ2NvcHknO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0b25Ecm9wOiBhc3luYyAoZTogRHJhZ0V2ZW50KSA9PiB7XG5cdFx0XHRcdGlmICh0aGlzLmlzU3VwcG9ydGVkRHJhZ0VsZW1lbnQoZSkpIHtcblx0XHRcdFx0XHRoaWRlKG92ZXJsYXkpO1xuXG5cdFx0XHRcdFx0Y29uc3QgdnNpeHMgPSBjb2FsZXNjZSgoYXdhaXQgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBleHRyYWN0RWRpdG9yc0FuZEZpbGVzRHJvcERhdGEoYWNjZXNzb3IsIGUpKSlcblx0XHRcdFx0XHRcdC5tYXAoZWRpdG9yID0+IGVkaXRvci5yZXNvdXJjZSAmJiBleHRuYW1lKGVkaXRvci5yZXNvdXJjZSkgPT09ICcudnNpeCcgPyBlZGl0b3IucmVzb3VyY2UgOiB1bmRlZmluZWQpKTtcblxuXHRcdFx0XHRcdGlmICh2c2l4cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHQvLyBBdHRlbXB0IHRvIGluc3RhbGwgdGhlIGV4dGVuc2lvbihzKVxuXHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKElOU1RBTExfRVhURU5TSU9OX0ZST01fVlNJWF9DT01NQU5EX0lELCB2c2l4cyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihlcnIpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHN1cGVyLmNyZWF0ZShhcHBlbmQodGhpcy5yb290LCAkKCcuZXh0ZW5zaW9ucycpKSk7XG5cblx0XHRjb25zdCBmb2N1c1RyYWNrZXIgPSB0aGlzLl9yZWdpc3Rlcih0cmFja0ZvY3VzKHRoaXMucm9vdCkpO1xuXHRcdGNvbnN0IGlzU2VhcmNoQm94Rm9jdXNlZCA9ICgpID0+IHRoaXMuc2VhcmNoQm94Py5pbnB1dFdpZGdldC5oYXNXaWRnZXRGb2N1cygpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyTmF2aWdhYmxlQ29udGFpbmVyKHtcblx0XHRcdG5hbWU6ICdleHRlbnNpb25zVmlldycsXG5cdFx0XHRmb2N1c05vdGlmaWVyczogW2ZvY3VzVHJhY2tlcl0sXG5cdFx0XHRmb2N1c05leHRXaWRnZXQ6ICgpID0+IHtcblx0XHRcdFx0aWYgKGlzU2VhcmNoQm94Rm9jdXNlZCgpKSB7XG5cdFx0XHRcdFx0dGhpcy5mb2N1c0xpc3RWaWV3KCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRmb2N1c1ByZXZpb3VzV2lkZ2V0OiAoKSA9PiB7XG5cdFx0XHRcdGlmICghaXNTZWFyY2hCb3hGb2N1c2VkKCkpIHtcblx0XHRcdFx0XHR0aGlzLnNlYXJjaEJveD8uZm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdG92ZXJyaWRlIGZvY3VzKCk6IHZvaWQge1xuXHRcdHN1cGVyLmZvY3VzKCk7XG5cdFx0dGhpcy5zZWFyY2hCb3g/LmZvY3VzKCk7XG5cdH1cblxuXHRwcml2YXRlIF9kaW1lbnNpb246IERpbWVuc2lvbiB8IHVuZGVmaW5lZDtcblx0b3ZlcnJpZGUgbGF5b3V0KGRpbWVuc2lvbjogRGltZW5zaW9uKTogdm9pZCB7XG5cdFx0dGhpcy5fZGltZW5zaW9uID0gZGltZW5zaW9uO1xuXHRcdGlmICh0aGlzLnJvb3QpIHtcblx0XHRcdHRoaXMucm9vdC5jbGFzc0xpc3QudG9nZ2xlKCduYXJyb3cnLCBkaW1lbnNpb24ud2lkdGggPD0gMjUwKTtcblx0XHRcdHRoaXMucm9vdC5jbGFzc0xpc3QudG9nZ2xlKCdtaW5pJywgZGltZW5zaW9uLndpZHRoIDw9IDIwMCk7XG5cdFx0fVxuXHRcdHRoaXMuc2VhcmNoQm94Py5sYXlvdXQobmV3IERpbWVuc2lvbihkaW1lbnNpb24ud2lkdGggLSAzNCAtIC8qcGFkZGluZyovOCAtICgyNCAqIDIpLCAyMCkpO1xuXHRcdGNvbnN0IHNlYXJjaEJveEhlaWdodCA9IDIwICsgMjEgLyptYXJnaW4qLztcblx0XHRjb25zdCBoZWFkZXJIZWlnaHQgPSB0aGlzLmhlYWRlciAmJiAhIXRoaXMubm90aWZpY2F0aW9uQ29udGFpbmVyPy5jaGlsZE5vZGVzLmxlbmd0aCA/IHRoaXMubm90aWZpY2F0aW9uQ29udGFpbmVyLmNsaWVudEhlaWdodCArIHNlYXJjaEJveEhlaWdodCArIDEwIC8qbWFyZ2luKi8gOiBzZWFyY2hCb3hIZWlnaHQ7XG5cdFx0dGhpcy5oZWFkZXIhLnN0eWxlLmhlaWdodCA9IGAke2hlYWRlckhlaWdodH1weGA7XG5cdFx0c3VwZXIubGF5b3V0KG5ldyBEaW1lbnNpb24oZGltZW5zaW9uLndpZHRoLCBkaW1lbnNpb24uaGVpZ2h0IC0gaGVhZGVySGVpZ2h0KSk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRPcHRpbWFsV2lkdGgoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gNDAwO1xuXHR9XG5cblx0c2VhcmNoKHZhbHVlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zZWFyY2hCb3ggJiYgdGhpcy5zZWFyY2hCb3guZ2V0VmFsdWUoKSAhPT0gdmFsdWUpIHtcblx0XHRcdHRoaXMuc2VhcmNoQm94LnNldFZhbHVlKHZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyByZWZyZXNoKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMudXBkYXRlSW5zdGFsbGVkRXh0ZW5zaW9uc0NvbnRleHRzKCk7XG5cdFx0dGhpcy5kb1NlYXJjaCh0cnVlKTtcblx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShBdXRvQ2hlY2tVcGRhdGVzQ29uZmlndXJhdGlvbktleSkpIHtcblx0XHRcdHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuY2hlY2tGb3JVcGRhdGVzKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25EaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxEaXNwb3NhYmxlU3RvcmU+KCkpO1xuXHRwcml2YXRlIHJlbmRlck5vdGlmaWNhaXRvbigpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMubm90aWZpY2F0aW9uQ29udGFpbmVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y2xlYXJOb2RlKHRoaXMubm90aWZpY2F0aW9uQ29udGFpbmVyKTtcblx0XHR0aGlzLm5vdGlmaWNhdGlvbkRpc3Bvc2FibGVzLnZhbHVlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHN0YXR1cyA9IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuZ2V0RXh0ZW5zaW9uc05vdGlmaWNhdGlvbigpO1xuXHRcdGNvbnN0IHF1ZXJ5ID0gc3RhdHVzPy5leHRlbnNpb25zLm1hcChleHRlbnNpb24gPT4gYEBpZDoke2V4dGVuc2lvbi5pZGVudGlmaWVyLmlkfWApLmpvaW4oJyAnKTtcblx0XHRpZiAoc3RhdHVzICYmIChxdWVyeSA9PT0gdGhpcy5zZWFyY2hCb3g/LmdldFZhbHVlKCkgfHwgIXRoaXMuc2VhcmNoTWFya2V0cGxhY2VFeHRlbnNpb25zQ29udGV4dEtleS5nZXQoKSkpIHtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uQ29udGFpbmVyLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIHN0YXR1cy5tZXNzYWdlKTtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uQ29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpO1xuXHRcdFx0Y29uc3QgbWVzc2FnZUNvbnRhaW5lciA9IGFwcGVuZCh0aGlzLm5vdGlmaWNhdGlvbkNvbnRhaW5lciwgJCgnLm1lc3NhZ2UtY29udGFpbmVyJykpO1xuXHRcdFx0YXBwZW5kKG1lc3NhZ2VDb250YWluZXIsICQoJ3NwYW4nKSkuY2xhc3NOYW1lID0gU2V2ZXJpdHlJY29uLmNsYXNzTmFtZShzdGF0dXMuc2V2ZXJpdHkpO1xuXHRcdFx0YXBwZW5kKG1lc3NhZ2VDb250YWluZXIsICQoJ3NwYW4ubWVzc2FnZScsIHVuZGVmaW5lZCwgc3RhdHVzLm1lc3NhZ2UpKTtcblx0XHRcdGNvbnN0IHNob3dBY3Rpb24gPSBhcHBlbmQobWVzc2FnZUNvbnRhaW5lcixcblx0XHRcdFx0JCgnc3Bhbi5tZXNzYWdlLXRleHQtYWN0aW9uJywge1xuXHRcdFx0XHRcdCd0YWJpbmRleCc6ICcwJyxcblx0XHRcdFx0XHQncm9sZSc6ICdidXR0b24nLFxuXHRcdFx0XHRcdCdhcmlhLWxhYmVsJzogYCR7c3RhdHVzLm1lc3NhZ2V9LiAke2xvY2FsaXplKCdjbGljayBzaG93JywgXCJDbGljayB0byBTaG93XCIpfWBcblx0XHRcdFx0fSwgbG9jYWxpemUoJ3Nob3cnLCBcIlNob3dcIikpKTtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uRGlzcG9zYWJsZXMudmFsdWUuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihzaG93QWN0aW9uLCBFdmVudFR5cGUuQ0xJQ0ssICgpID0+IHRoaXMuc2VhcmNoKHF1ZXJ5ID8/ICcnKSkpO1xuXHRcdFx0dGhpcy5ub3RpZmljYXRpb25EaXNwb3NhYmxlcy52YWx1ZS5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHNob3dBY3Rpb24sIEV2ZW50VHlwZS5LRVlfRE9XTiwgKGU6IEtleWJvYXJkRXZlbnQpID0+IHtcblx0XHRcdFx0Y29uc3Qgc3RhbmRhcmRLZXlib2FyZEV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRcdFx0aWYgKHN0YW5kYXJkS2V5Ym9hcmRFdmVudC5rZXlDb2RlID09PSBLZXlDb2RlLkVudGVyIHx8IHN0YW5kYXJkS2V5Ym9hcmRFdmVudC5rZXlDb2RlID09PSBLZXlDb2RlLlNwYWNlKSB7XG5cdFx0XHRcdFx0dGhpcy5zZWFyY2gocXVlcnkgPz8gJycpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN0YW5kYXJkS2V5Ym9hcmRFdmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdH0pKTtcblx0XHRcdGNvbnN0IGRpc21pc3NBY3Rpb24gPSBhcHBlbmQodGhpcy5ub3RpZmljYXRpb25Db250YWluZXIsXG5cdFx0XHRcdCQoYHNwYW4ubWVzc2FnZS1hY3Rpb24ke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKENvZGljb24uY2xvc2UpfWAsIHtcblx0XHRcdFx0XHQndGFiaW5kZXgnOiAnMCcsXG5cdFx0XHRcdFx0J3JvbGUnOiAnYnV0dG9uJyxcblx0XHRcdFx0XHQnYXJpYS1sYWJlbCc6IGxvY2FsaXplKCdkaXNtaXNzJywgXCJEaXNtaXNzXCIpLFxuXHRcdFx0XHRcdCd0aXRsZSc6IGxvY2FsaXplKCdkaXNtaXNzJywgXCJEaXNtaXNzXCIpXG5cdFx0XHRcdH0pKTtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uRGlzcG9zYWJsZXMudmFsdWUuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihkaXNtaXNzQWN0aW9uLCBFdmVudFR5cGUuQ0xJQ0ssICgpID0+IHN0YXR1cy5kaXNtaXNzKCkpKTtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uRGlzcG9zYWJsZXMudmFsdWUuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihkaXNtaXNzQWN0aW9uLCBFdmVudFR5cGUuS0VZX0RPV04sIChlOiBLZXlib2FyZEV2ZW50KSA9PiB7XG5cdFx0XHRcdGNvbnN0IHN0YW5kYXJkS2V5Ym9hcmRFdmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cdFx0XHRcdGlmIChzdGFuZGFyZEtleWJvYXJkRXZlbnQua2V5Q29kZSA9PT0gS2V5Q29kZS5FbnRlciB8fCBzdGFuZGFyZEtleWJvYXJkRXZlbnQua2V5Q29kZSA9PT0gS2V5Q29kZS5TcGFjZSkge1xuXHRcdFx0XHRcdHN0YXR1cy5kaXNtaXNzKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0c3RhbmRhcmRLZXlib2FyZEV2ZW50LnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0fSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm5vdGlmaWNhdGlvbkNvbnRhaW5lci5yZW1vdmVBdHRyaWJ1dGUoJ2FyaWEtbGFiZWwnKTtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9kaW1lbnNpb24pIHtcblx0XHRcdHRoaXMubGF5b3V0KHRoaXMuX2RpbWVuc2lvbik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVJbnN0YWxsZWRFeHRlbnNpb25zQ29udGV4dHMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5xdWVyeUxvY2FsKCk7XG5cdFx0dGhpcy5oYXNJbnN0YWxsZWRFeHRlbnNpb25zQ29udGV4dEtleS5zZXQocmVzdWx0LnNvbWUociA9PiAhci5pc0J1aWx0aW4pKTtcblx0fVxuXG5cdHByaXZhdGUgdHJpZ2dlclNlYXJjaCgpOiB2b2lkIHtcblx0XHR0aGlzLnNlYXJjaERlbGF5ZXIudHJpZ2dlcigoKSA9PiB0aGlzLmRvU2VhcmNoKCksIHRoaXMuc2VhcmNoQm94ICYmIHRoaXMuc2VhcmNoQm94LmdldFZhbHVlKCkgPyA1MDAgOiAwKS50aGVuKHVuZGVmaW5lZCwgZXJyID0+IHRoaXMub25FcnJvcihlcnIpKTtcblx0fVxuXG5cdHByaXZhdGUgbm9ybWFsaXplZFF1ZXJ5KCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuc2VhcmNoQm94XG5cdFx0XHQ/IHRoaXMuc2VhcmNoQm94LmdldFZhbHVlKClcblx0XHRcdFx0LnRyaW0oKVxuXHRcdFx0XHQucmVwbGFjZSgvQGNhdGVnb3J5L2csICdjYXRlZ29yeScpXG5cdFx0XHRcdC5yZXBsYWNlKC9AdGFnOi9nLCAndGFnOicpXG5cdFx0XHRcdC5yZXBsYWNlKC9AZXh0Oi9nLCAnZXh0OicpXG5cdFx0XHRcdC5yZXBsYWNlKC9AZmVhdHVyZWQvZywgJ2ZlYXR1cmVkJylcblx0XHRcdFx0LnJlcGxhY2UoL0Bwb3B1bGFyL2csIHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2Uud2ViRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciAmJiAhdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5sb2NhbEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIgJiYgIXRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciA/ICdAd2ViJyA6ICdAcG9wdWxhcicpXG5cdFx0XHQ6ICcnO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHNhdmVTdGF0ZSgpOiB2b2lkIHtcblx0XHRjb25zdCB2YWx1ZSA9IHRoaXMuc2VhcmNoQm94ID8gdGhpcy5zZWFyY2hCb3guZ2V0VmFsdWUoKSA6ICcnO1xuXHRcdGlmIChFeHRlbnNpb25zTGlzdFZpZXcuaXNMb2NhbEV4dGVuc2lvbnNRdWVyeSh2YWx1ZSkpIHtcblx0XHRcdHRoaXMuc2VhcmNoVmlld2xldFN0YXRlWydxdWVyeS52YWx1ZSddID0gdmFsdWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc2VhcmNoVmlld2xldFN0YXRlWydxdWVyeS52YWx1ZSddID0gJyc7XG5cdFx0fVxuXHRcdHN1cGVyLnNhdmVTdGF0ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBkb1NlYXJjaChyZWZyZXNoPzogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHZhbHVlID0gdGhpcy5ub3JtYWxpemVkUXVlcnkoKTtcblx0XHR0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmJ1ZmZlckNoYW5nZUV2ZW50cygoKSA9PiB7XG5cdFx0XHRjb25zdCBpc1JlY29tbWVuZGVkRXh0ZW5zaW9uc1F1ZXJ5ID0gRXh0ZW5zaW9uc0xpc3RWaWV3LmlzUmVjb21tZW5kZWRFeHRlbnNpb25zUXVlcnkodmFsdWUpO1xuXHRcdFx0dGhpcy5zZWFyY2hIYXNUZXh0Q29udGV4dEtleS5zZXQodmFsdWUudHJpbSgpICE9PSAnJyk7XG5cdFx0XHR0aGlzLmV4dGVuc2lvbnNTZWFyY2hWYWx1ZUNvbnRleHRLZXkuc2V0KHZhbHVlKTtcblx0XHRcdHRoaXMuaW5zdGFsbGVkRXh0ZW5zaW9uc0NvbnRleHRLZXkuc2V0KEV4dGVuc2lvbnNMaXN0Vmlldy5pc0luc3RhbGxlZEV4dGVuc2lvbnNRdWVyeSh2YWx1ZSkpO1xuXHRcdFx0dGhpcy5zZWFyY2hJbnN0YWxsZWRFeHRlbnNpb25zQ29udGV4dEtleS5zZXQoRXh0ZW5zaW9uc0xpc3RWaWV3LmlzU2VhcmNoSW5zdGFsbGVkRXh0ZW5zaW9uc1F1ZXJ5KHZhbHVlKSk7XG5cdFx0XHR0aGlzLnNlYXJjaFJlY2VudGx5VXBkYXRlZEV4dGVuc2lvbnNDb250ZXh0S2V5LnNldChFeHRlbnNpb25zTGlzdFZpZXcuaXNTZWFyY2hSZWNlbnRseVVwZGF0ZWRRdWVyeSh2YWx1ZSkgJiYgIUV4dGVuc2lvbnNMaXN0Vmlldy5pc1NlYXJjaEV4dGVuc2lvblVwZGF0ZXNRdWVyeSh2YWx1ZSkpO1xuXHRcdFx0dGhpcy5zZWFyY2hPdXRkYXRlZEV4dGVuc2lvbnNDb250ZXh0S2V5LnNldChFeHRlbnNpb25zTGlzdFZpZXcuaXNPdXRkYXRlZEV4dGVuc2lvbnNRdWVyeSh2YWx1ZSkgJiYgIUV4dGVuc2lvbnNMaXN0Vmlldy5pc1NlYXJjaEV4dGVuc2lvblVwZGF0ZXNRdWVyeSh2YWx1ZSkpO1xuXHRcdFx0dGhpcy5zZWFyY2hFeHRlbnNpb25VcGRhdGVzQ29udGV4dEtleS5zZXQoRXh0ZW5zaW9uc0xpc3RWaWV3LmlzU2VhcmNoRXh0ZW5zaW9uVXBkYXRlc1F1ZXJ5KHZhbHVlKSk7XG5cdFx0XHR0aGlzLnNlYXJjaEVuYWJsZWRFeHRlbnNpb25zQ29udGV4dEtleS5zZXQoRXh0ZW5zaW9uc0xpc3RWaWV3LmlzRW5hYmxlZEV4dGVuc2lvbnNRdWVyeSh2YWx1ZSkpO1xuXHRcdFx0dGhpcy5zZWFyY2hEaXNhYmxlZEV4dGVuc2lvbnNDb250ZXh0S2V5LnNldChFeHRlbnNpb25zTGlzdFZpZXcuaXNEaXNhYmxlZEV4dGVuc2lvbnNRdWVyeSh2YWx1ZSkpO1xuXHRcdFx0dGhpcy5zZWFyY2hCdWlsdEluRXh0ZW5zaW9uc0NvbnRleHRLZXkuc2V0KEV4dGVuc2lvbnNMaXN0Vmlldy5pc1NlYXJjaEJ1aWx0SW5FeHRlbnNpb25zUXVlcnkodmFsdWUpKTtcblx0XHRcdHRoaXMuc2VhcmNoV29ya3NwYWNlVW5zdXBwb3J0ZWRFeHRlbnNpb25zQ29udGV4dEtleS5zZXQoRXh0ZW5zaW9uc0xpc3RWaWV3LmlzU2VhcmNoV29ya3NwYWNlVW5zdXBwb3J0ZWRFeHRlbnNpb25zUXVlcnkodmFsdWUpKTtcblx0XHRcdHRoaXMuc2VhcmNoRGVwcmVjYXRlZEV4dGVuc2lvbnNDb250ZXh0S2V5LnNldChFeHRlbnNpb25zTGlzdFZpZXcuaXNTZWFyY2hEZXByZWNhdGVkRXh0ZW5zaW9uc1F1ZXJ5KHZhbHVlKSk7XG5cdFx0XHR0aGlzLmJ1aWx0SW5FeHRlbnNpb25zQ29udGV4dEtleS5zZXQoRXh0ZW5zaW9uc0xpc3RWaWV3LmlzQnVpbHRJbkV4dGVuc2lvbnNRdWVyeSh2YWx1ZSkpO1xuXHRcdFx0dGhpcy5yZWNvbW1lbmRlZEV4dGVuc2lvbnNDb250ZXh0S2V5LnNldChpc1JlY29tbWVuZGVkRXh0ZW5zaW9uc1F1ZXJ5KTtcblx0XHRcdHRoaXMuc2VhcmNoTWFya2V0cGxhY2VFeHRlbnNpb25zQ29udGV4dEtleS5zZXQoISF2YWx1ZSAmJiAhRXh0ZW5zaW9uc0xpc3RWaWV3LmlzTG9jYWxFeHRlbnNpb25zUXVlcnkodmFsdWUpICYmICFpc1JlY29tbWVuZGVkRXh0ZW5zaW9uc1F1ZXJ5KTtcblx0XHRcdHRoaXMuc29ydEJ5VXBkYXRlRGF0ZUNvbnRleHRLZXkuc2V0KEV4dGVuc2lvbnNMaXN0Vmlldy5pc1NvcnRVcGRhdGVEYXRlUXVlcnkodmFsdWUpKTtcblx0XHRcdHRoaXMuZGVmYXVsdFZpZXdzQ29udGV4dEtleS5zZXQoIXZhbHVlIHx8IEV4dGVuc2lvbnNMaXN0Vmlldy5pc1NvcnRJbnN0YWxsZWRFeHRlbnNpb25zUXVlcnkodmFsdWUpKTtcblx0XHR9KTtcblxuXHRcdHRoaXMucmVuZGVyTm90aWZpY2FpdG9uKCk7XG5cblx0XHRyZXR1cm4gdGhpcy5wcm9ncmVzcyhQcm9taXNlLmFsbCh0aGlzLnBhbmVzLm1hcCh2aWV3ID0+XG5cdFx0XHQoPEV4dGVuc2lvbnNMaXN0Vmlldz52aWV3KS5zaG93KHRoaXMubm9ybWFsaXplZFF1ZXJ5KCksIHJlZnJlc2gpXG5cdFx0XHRcdC50aGVuKG1vZGVsID0+IHRoaXMuYWxlcnRTZWFyY2hSZXN1bHQobW9kZWwubGVuZ3RoLCB2aWV3LmlkKSlcblx0XHQpKSkudGhlbigoKSA9PiB1bmRlZmluZWQpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIG9uRGlkQWRkVmlld0Rlc2NyaXB0b3JzKGFkZGVkOiBJQWRkZWRWaWV3RGVzY3JpcHRvclJlZltdKTogVmlld1BhbmVbXSB7XG5cdFx0Y29uc3QgYWRkZWRWaWV3cyA9IHN1cGVyLm9uRGlkQWRkVmlld0Rlc2NyaXB0b3JzKGFkZGVkKTtcblx0XHR0aGlzLnByb2dyZXNzKFByb21pc2UuYWxsKGFkZGVkVmlld3MubWFwKGFkZGVkVmlldyA9PlxuXHRcdFx0KDxFeHRlbnNpb25zTGlzdFZpZXc+YWRkZWRWaWV3KS5zaG93KHRoaXMubm9ybWFsaXplZFF1ZXJ5KCkpXG5cdFx0XHRcdC50aGVuKG1vZGVsID0+IHRoaXMuYWxlcnRTZWFyY2hSZXN1bHQobW9kZWwubGVuZ3RoLCBhZGRlZFZpZXcuaWQpKVxuXHRcdCkpKTtcblx0XHRyZXR1cm4gYWRkZWRWaWV3cztcblx0fVxuXG5cdHByaXZhdGUgYWxlcnRTZWFyY2hSZXN1bHQoY291bnQ6IG51bWJlciwgdmlld0lkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCB2aWV3ID0gdGhpcy52aWV3Q29udGFpbmVyTW9kZWwudmlzaWJsZVZpZXdEZXNjcmlwdG9ycy5maW5kKHZpZXcgPT4gdmlldy5pZCA9PT0gdmlld0lkKTtcblx0XHRzd2l0Y2ggKGNvdW50KSB7XG5cdFx0XHRjYXNlIDA6XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAxOlxuXHRcdFx0XHRpZiAodmlldykge1xuXHRcdFx0XHRcdGFsZXJ0KGxvY2FsaXplKCdleHRlbnNpb25Gb3VuZEluU2VjdGlvbicsIFwiMSBleHRlbnNpb24gZm91bmQgaW4gdGhlIHswfSBzZWN0aW9uLlwiLCB2aWV3Lm5hbWUudmFsdWUpKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhbGVydChsb2NhbGl6ZSgnZXh0ZW5zaW9uRm91bmQnLCBcIjEgZXh0ZW5zaW9uIGZvdW5kLlwiKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRpZiAodmlldykge1xuXHRcdFx0XHRcdGFsZXJ0KGxvY2FsaXplKCdleHRlbnNpb25zRm91bmRJblNlY3Rpb24nLCBcInswfSBleHRlbnNpb25zIGZvdW5kIGluIHRoZSB7MX0gc2VjdGlvbi5cIiwgY291bnQsIHZpZXcubmFtZS52YWx1ZSkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGFsZXJ0KGxvY2FsaXplKCdleHRlbnNpb25zRm91bmQnLCBcInswfSBleHRlbnNpb25zIGZvdW5kLlwiLCBjb3VudCkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0Rmlyc3RFeHBhbmRlZFBhbmUoKTogRXh0ZW5zaW9uc0xpc3RWaWV3IHwgdW5kZWZpbmVkIHtcblx0XHRmb3IgKGNvbnN0IHBhbmUgb2YgdGhpcy5wYW5lcykge1xuXHRcdFx0aWYgKHBhbmUuaXNFeHBhbmRlZCgpICYmIHBhbmUgaW5zdGFuY2VvZiBFeHRlbnNpb25zTGlzdFZpZXcpIHtcblx0XHRcdFx0cmV0dXJuIHBhbmU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGZvY3VzTGlzdFZpZXcoKTogdm9pZCB7XG5cdFx0Y29uc3QgcGFuZSA9IHRoaXMuZ2V0Rmlyc3RFeHBhbmRlZFBhbmUoKTtcblx0XHRpZiAocGFuZSAmJiBwYW5lLmNvdW50KCkgPiAwKSB7XG5cdFx0XHRwYW5lLmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvblZpZXdsZXRPcGVuKHZpZXdsZXQ6IElQYW5lQ29tcG9zaXRlKTogdm9pZCB7XG5cdFx0aWYgKCF2aWV3bGV0IHx8IHZpZXdsZXQuZ2V0SWQoKSA9PT0gVklFV0xFVF9JRCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KENsb3NlRXh0ZW5zaW9uRGV0YWlsc09uVmlld0NoYW5nZUtleSkpIHtcblx0XHRcdGNvbnN0IHByb21pc2VzID0gdGhpcy5lZGl0b3JHcm91cFNlcnZpY2UuZ3JvdXBzLm1hcChncm91cCA9PiB7XG5cdFx0XHRcdGNvbnN0IGVkaXRvcnMgPSBncm91cC5lZGl0b3JzLmZpbHRlcihpbnB1dCA9PiBpbnB1dCBpbnN0YW5jZW9mIEV4dGVuc2lvbnNJbnB1dCk7XG5cblx0XHRcdFx0cmV0dXJuIGdyb3VwLmNsb3NlRWRpdG9ycyhlZGl0b3JzKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRQcm9taXNlLmFsbChwcm9taXNlcyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBwcm9ncmVzczxUPihwcm9taXNlOiBQcm9taXNlPFQ+KTogUHJvbWlzZTxUPiB7XG5cdFx0cmV0dXJuIHRoaXMucHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyh7IGxvY2F0aW9uOiBQcm9ncmVzc0xvY2F0aW9uLkV4dGVuc2lvbnMgfSwgKCkgPT4gcHJvbWlzZSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRXJyb3IoZXJyOiBFcnJvcik6IHZvaWQge1xuXHRcdGlmIChpc0NhbmNlbGxhdGlvbkVycm9yKGVycikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtZXNzYWdlID0gZXJyICYmIGVyci5tZXNzYWdlIHx8ICcnO1xuXG5cdFx0aWYgKC9FQ09OTlJFRlVTRUQvLnRlc3QobWVzc2FnZSkpIHtcblx0XHRcdGNvbnN0IGVycm9yID0gY3JlYXRlRXJyb3JXaXRoQWN0aW9ucyhsb2NhbGl6ZSgnc3VnZ2VzdFByb3h5RXJyb3InLCBcIk1hcmtldHBsYWNlIHJldHVybmVkICdFQ09OTlJFRlVTRUQnLiBQbGVhc2UgY2hlY2sgdGhlICdodHRwLnByb3h5JyBzZXR0aW5nLlwiKSwgW1xuXHRcdFx0XHRuZXcgQWN0aW9uKCdvcGVuIHVzZXIgc2V0dGluZ3MnLCBsb2NhbGl6ZSgnb3BlbiB1c2VyIHNldHRpbmdzJywgXCJPcGVuIFVzZXIgU2V0dGluZ3NcIiksIHVuZGVmaW5lZCwgdHJ1ZSwgKCkgPT4gdGhpcy5wcmVmZXJlbmNlc1NlcnZpY2Uub3BlblVzZXJTZXR0aW5ncygpKVxuXHRcdFx0XSk7XG5cblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGVycik7XG5cdH1cblxuXHRwcml2YXRlIGlzU3VwcG9ydGVkRHJhZ0VsZW1lbnQoZTogRHJhZ0V2ZW50KTogYm9vbGVhbiB7XG5cdFx0aWYgKGUuZGF0YVRyYW5zZmVyKSB7XG5cdFx0XHRjb25zdCB0eXBlc0xvd2VyQ2FzZSA9IGUuZGF0YVRyYW5zZmVyLnR5cGVzLm1hcCh0ID0+IHQudG9Mb2NhbGVMb3dlckNhc2UoKSk7XG5cdFx0XHRyZXR1cm4gdHlwZXNMb3dlckNhc2UuaW5kZXhPZignZmlsZXMnKSAhPT0gLTE7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTdGF0dXNVcGRhdGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgYmFkZ2VIYW5kbGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElBY3Rpdml0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhY3Rpdml0eVNlcnZpY2U6IElBY3Rpdml0eVNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlOiBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLm9uU2VydmljZUNoYW5nZSgpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmFueShFdmVudC5kZWJvdW5jZShleHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5vbkNoYW5nZSwgKCkgPT4gdW5kZWZpbmVkLCAxMDAsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRoaXMuX3N0b3JlKSwgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub25EaWRDaGFuZ2VFeHRlbnNpb25zTm90aWZpY2F0aW9uKSh0aGlzLm9uU2VydmljZUNoYW5nZSwgdGhpcykpO1xuXHR9XG5cblx0cHJpdmF0ZSBvblNlcnZpY2VDaGFuZ2UoKTogdm9pZCB7XG5cdFx0dGhpcy5iYWRnZUhhbmRsZS5jbGVhcigpO1xuXHRcdGxldCBiYWRnZTogSUJhZGdlIHwgdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgZXh0ZW5zaW9uc05vdGlmaWNhdGlvbiA9IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuZ2V0RXh0ZW5zaW9uc05vdGlmaWNhdGlvbigpO1xuXHRcdGlmIChleHRlbnNpb25zTm90aWZpY2F0aW9uKSB7XG5cdFx0XHRpZiAoZXh0ZW5zaW9uc05vdGlmaWNhdGlvbi5zZXZlcml0eSA9PT0gU2V2ZXJpdHkuV2FybmluZykge1xuXHRcdFx0XHRiYWRnZSA9IG5ldyBXYXJuaW5nQmFkZ2UoKCkgPT4gZXh0ZW5zaW9uc05vdGlmaWNhdGlvbi5tZXNzYWdlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRlbHNlIHtcblx0XHRcdGNvbnN0IGFjdGlvblJlcXVpcmVkID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShBdXRvUmVzdGFydENvbmZpZ3VyYXRpb25LZXkpID09PSB0cnVlID8gW10gOiB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmluc3RhbGxlZC5maWx0ZXIoZSA9PiBlLnJ1bnRpbWVTdGF0ZSAhPT0gdW5kZWZpbmVkKTtcblx0XHRcdGNvbnN0IG91dGRhdGVkID0gdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5vdXRkYXRlZC5yZWR1Y2UoKHIsIGUpID0+IHIgKyAodGhpcy5leHRlbnNpb25FbmFibGVtZW50U2VydmljZS5pc0VuYWJsZWQoZS5sb2NhbCEpICYmICFhY3Rpb25SZXF1aXJlZC5pbmNsdWRlcyhlKSA/IDEgOiAwKSwgMCk7XG5cdFx0XHRjb25zdCBuZXdCYWRnZU51bWJlciA9IG91dGRhdGVkICsgYWN0aW9uUmVxdWlyZWQubGVuZ3RoO1xuXHRcdFx0aWYgKG5ld0JhZGdlTnVtYmVyID4gMCkge1xuXHRcdFx0XHRsZXQgbXNnID0gJyc7XG5cdFx0XHRcdGlmIChvdXRkYXRlZCkge1xuXHRcdFx0XHRcdG1zZyArPSBvdXRkYXRlZCA9PT0gMSA/IGxvY2FsaXplKCdleHRlbnNpb25Ub1VwZGF0ZScsICd7MH0gcmVxdWlyZXMgdXBkYXRlJywgb3V0ZGF0ZWQpIDogbG9jYWxpemUoJ2V4dGVuc2lvbnNUb1VwZGF0ZScsICd7MH0gcmVxdWlyZSB1cGRhdGUnLCBvdXRkYXRlZCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG91dGRhdGVkID4gMCAmJiBhY3Rpb25SZXF1aXJlZC5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0bXNnICs9ICcsICc7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGFjdGlvblJlcXVpcmVkLmxlbmd0aCkge1xuXHRcdFx0XHRcdG1zZyArPSBhY3Rpb25SZXF1aXJlZC5sZW5ndGggPT09IDEgPyBsb2NhbGl6ZSgnZXh0ZW5zaW9uVG9SZWxvYWQnLCAnezB9IHJlcXVpcmVzIHJlc3RhcnQnLCBhY3Rpb25SZXF1aXJlZC5sZW5ndGgpIDogbG9jYWxpemUoJ2V4dGVuc2lvbnNUb1JlbG9hZCcsICd7MH0gcmVxdWlyZSByZXN0YXJ0JywgYWN0aW9uUmVxdWlyZWQubGVuZ3RoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRiYWRnZSA9IG5ldyBOdW1iZXJCYWRnZShuZXdCYWRnZU51bWJlciwgKCkgPT4gbXNnKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoYmFkZ2UpIHtcblx0XHRcdHRoaXMuYmFkZ2VIYW5kbGUudmFsdWUgPSB0aGlzLmFjdGl2aXR5U2VydmljZS5zaG93Vmlld0NvbnRhaW5lckFjdGl2aXR5KFZJRVdMRVRfSUQsIHsgYmFkZ2UgfSk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNYWxpY2lvdXNFeHRlbnNpb25DaGVja2VyIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbnNNYW5hZ2VtZW50U2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLmxvb3BDaGVja0Zvck1hbGljaW91c0V4dGVuc2lvbnMoKTtcblx0fVxuXG5cdHByaXZhdGUgbG9vcENoZWNrRm9yTWFsaWNpb3VzRXh0ZW5zaW9ucygpOiB2b2lkIHtcblx0XHR0aGlzLmNoZWNrRm9yTWFsaWNpb3VzRXh0ZW5zaW9ucygpXG5cdFx0XHQudGhlbigoKSA9PiB0aW1lb3V0KDEwMDAgKiA2MCAqIDUpKSAvLyBldmVyeSBmaXZlIG1pbnV0ZXNcblx0XHRcdC50aGVuKCgpID0+IHRoaXMubG9vcENoZWNrRm9yTWFsaWNpb3VzRXh0ZW5zaW9ucygpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY2hlY2tGb3JNYWxpY2lvdXNFeHRlbnNpb25zKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBtYWxpY2lvdXNFeHRlbnNpb25zOiBJTG9jYWxFeHRlbnNpb25bXSA9IFtdO1xuXHRcdFx0bGV0IHNob3VsZFJlc3RhcnRFeHRlbnNpb25zID0gZmFsc2U7XG5cdFx0XHRsZXQgc2hvdWxkUmVsb2FkV2luZG93ID0gZmFsc2U7XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmluc3RhbGxlZCkge1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uLmlzTWFsaWNpb3VzICYmIGV4dGVuc2lvbi5sb2NhbCkge1xuXHRcdFx0XHRcdG1hbGljaW91c0V4dGVuc2lvbnMucHVzaChleHRlbnNpb24ubG9jYWwpO1xuXHRcdFx0XHRcdHNob3VsZFJlc3RhcnRFeHRlbnNpb25zID0gc2hvdWxkUmVzdGFydEV4dGVuc2lvbnMgfHwgZXh0ZW5zaW9uLnJ1bnRpbWVTdGF0ZT8uYWN0aW9uID09PSBFeHRlbnNpb25SdW50aW1lQWN0aW9uVHlwZS5SZXN0YXJ0RXh0ZW5zaW9ucztcblx0XHRcdFx0XHRzaG91bGRSZWxvYWRXaW5kb3cgPSBzaG91bGRSZWxvYWRXaW5kb3cgfHwgZXh0ZW5zaW9uLnJ1bnRpbWVTdGF0ZT8uYWN0aW9uID09PSBFeHRlbnNpb25SdW50aW1lQWN0aW9uVHlwZS5SZWxvYWRXaW5kb3c7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChtYWxpY2lvdXNFeHRlbnNpb25zLmxlbmd0aCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbnNNYW5hZ2VtZW50U2VydmljZS51bmluc3RhbGxFeHRlbnNpb25zKG1hbGljaW91c0V4dGVuc2lvbnMubWFwKGUgPT4gKHsgZXh0ZW5zaW9uOiBlLCBvcHRpb25zOiB7IHJlbW92ZTogdHJ1ZSB9IH0pKSk7XG5cdFx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoXG5cdFx0XHRcdFx0U2V2ZXJpdHkuV2FybmluZyxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnbWFsaWNpb3VzIHdhcm5pbmcnLCBcIlRoZSBmb2xsb3dpbmcgZXh0ZW5zaW9ucyB3ZXJlIGZvdW5kIHRvIGJlIHByb2JsZW1hdGljIGFuZCBoYXZlIGJlZW4gdW5pbnN0YWxsZWQ6IHswfVwiLCBtYWxpY2lvdXNFeHRlbnNpb25zLm1hcChlID0+IGUuaWRlbnRpZmllci5pZCkuam9pbignLCAnKSksXG5cdFx0XHRcdFx0c2hvdWxkUmVzdGFydEV4dGVuc2lvbnMgfHwgc2hvdWxkUmVsb2FkV2luZG93ID8gW3tcblx0XHRcdFx0XHRcdGxhYmVsOiBzaG91bGRSZXN0YXJ0RXh0ZW5zaW9ucyA/IGxvY2FsaXplKCdyZXN0YXJ0Tm93JywgXCJSZXN0YXJ0IEV4dGVuc2lvbnNcIikgOiBsb2NhbGl6ZSgncmVsb2FkTm93JywgXCJSZWxvYWQgTm93XCIpLFxuXHRcdFx0XHRcdFx0cnVuOiAoKSA9PiBzaG91bGRSZXN0YXJ0RXh0ZW5zaW9ucyA/IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UudXBkYXRlUnVubmluZ0V4dGVuc2lvbnMoKSA6IHRoaXMuaG9zdFNlcnZpY2UucmVsb2FkKClcblx0XHRcdFx0XHR9XSA6IFtdLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHN0aWNreTogdHJ1ZSxcblx0XHRcdFx0XHRcdHByaW9yaXR5OiBOb3RpZmljYXRpb25Qcmlvcml0eS5VUkdFTlRcblx0XHRcdFx0XHR9XG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlcnIpO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLFNBQVMsZUFBZTtBQUNqQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDhCQUE4QjtBQUV2QyxTQUFTLFlBQVksaUJBQWlCLHlCQUF5QjtBQUMvRCxTQUFTLGFBQWE7QUFDdEIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsUUFBUSxHQUFHLFdBQVcsTUFBTSxNQUFNLHFCQUFxQixZQUFZLHVCQUF1QixXQUFXLGlCQUFpQjtBQUMvSCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDZCQUErQztBQUN4RCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDZCQUEyRCxZQUFZLHNDQUFzQyx3Q0FBd0MsbUNBQW1DLGtDQUFrQyw2QkFBNkIscUJBQXFCLDZCQUE2Qiw2QkFBNkIsa0NBQWtDO0FBQ2pYLFNBQVMsc0NBQXNDLDRDQUE0QztBQUMzRixTQUFTLG1DQUFvRDtBQUM3RCxTQUFTLHNDQUFzQyx5Q0FBcUU7QUFDcEgsU0FBUyx1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QUNTO0FBRXZDLFNBQUssZ0NBQWdDO0FBQUEsRUFDdEM7QUFBQSxFQUVRLGtDQUF3QztBQUMvQyxTQUFLLDRCQUE0QixFQUMvQixLQUFLLE1BQU0sUUFBUSxNQUFPLEtBQUssQ0FBQyxDQUFDLEVBQ2pDLEtBQUssTUFBTSxLQUFLLGdDQUFnQyxDQUFDO0FBQUEsRUFDcEQ7QUFBQSxFQUVBLE1BQWMsOEJBQTZDO0FBQzFELFFBQUk7QUFDSCxZQUFNLHNCQUF5QyxDQUFDO0FBQ2hELFVBQUksMEJBQTBCO0FBQzlCLFVBQUkscUJBQXFCO0FBQ3pCLGlCQUFXLGFBQWEsS0FBSywyQkFBMkIsV0FBVztBQUNsRSxZQUFJLFVBQVUsZUFBZSxVQUFVLE9BQU87QUFDN0MsOEJBQW9CLEtBQUssVUFBVSxLQUFLO0FBQ3hDLG9DQUEwQiwyQkFBMkIsVUFBVSxjQUFjLFdBQVcsMkJBQTJCO0FBQ25ILCtCQUFxQixzQkFBc0IsVUFBVSxjQUFjLFdBQVcsMkJBQTJCO0FBQUEsUUFDMUc7QUFBQSxNQUNEO0FBQ0EsVUFBSSxvQkFBb0IsUUFBUTtBQUMvQixjQUFNLEtBQUssNEJBQTRCLG9CQUFvQixvQkFBb0IsSUFBSSxRQUFNLEVBQUUsV0FBVyxHQUFHLFNBQVMsRUFBRSxRQUFRLEtBQUssRUFBRSxFQUFFLENBQUM7QUFDdEksYUFBSyxvQkFBb0I7QUFBQSxVQUN4QixTQUFTO0FBQUEsVUFDVCxTQUFTLHFCQUFxQix3RkFBd0Ysb0JBQW9CLElBQUksT0FBSyxFQUFFLFdBQVcsRUFBRSxFQUFFLEtBQUssSUFBSSxDQUFDO0FBQUEsVUFDOUssMkJBQTJCLHFCQUFxQixDQUFDO0FBQUEsWUFDaEQsT0FBTywwQkFBMEIsU0FBUyxjQUFjLG9CQUFvQixJQUFJLFNBQVMsYUFBYSxZQUFZO0FBQUEsWUFDbEgsS0FBSyxNQUFNLDBCQUEwQixLQUFLLDJCQUEyQix3QkFBd0IsSUFBSSxLQUFLLFlBQVksT0FBTztBQUFBLFVBQzFILENBQUMsSUFBSSxDQUFDO0FBQUEsVUFDTjtBQUFBLFlBQ0MsUUFBUTtBQUFBLFlBQ1IsVUFBVSxxQkFBcUI7QUFBQSxVQUNoQztBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFFRCxTQUFTLEtBQUs7QUFDYixXQUFLLFdBQVcsTUFBTSxHQUFHO0FBQUEsSUFDMUI7QUFBQSxFQUNEO0FBQ0Q7QUFsRGEsNEJBQU47QUFBQSxFQUdKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBUFU7IiwKICAibmFtZXMiOiBbImdhbGxlcnlNYW5pZmVzdCIsICJ2aWV3Il0KfQo=
