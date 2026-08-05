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
import { localize } from "../../../../nls.js";
import { Disposable, DisposableStore, isDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { isCancellationError, getErrorMessage, CancellationError } from "../../../../base/common/errors.js";
import { createErrorWithActions } from "../../../../base/common/errorMessage.js";
import { PagedModel, DelayedPagedModel } from "../../../../base/common/paging.js";
import { SortOrder, SortBy as GallerySortBy, ExtensionGalleryErrorCode, ExtensionGalleryError } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IExtensionManagementServerService, EnablementState, IWorkbenchExtensionManagementService, IWorkbenchExtensionEnablementService } from "../../../services/extensionManagement/common/extensionManagement.js";
import { IExtensionRecommendationsService } from "../../../services/extensionRecommendations/common/extensionRecommendations.js";
import { areSameExtensions, getExtensionDependencies } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { append, $ } from "../../../../base/browser/dom.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Delegate, Renderer } from "./extensionsList.js";
import { ExtensionResultsListFocused, ExtensionState, IExtensionsWorkbenchService } from "../common/extensions.js";
import { Query } from "../common/extensionQuery.js";
import { IExtensionService, toExtension } from "../../../services/extensions/common/extensions.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { CountBadge } from "../../../../base/browser/ui/countBadge/countBadge.js";
import { ManageExtensionAction, getContextMenuActions, ExtensionAction } from "./extensionsActions.js";
import { WorkbenchPagedList } from "../../../../platform/list/browser/listService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { ViewPane, ViewPaneShowActions } from "../../../browser/parts/views/viewPane.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { coalesce, distinct, range } from "../../../../base/common/arrays.js";
import { alert } from "../../../../base/browser/ui/aria/aria.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Action, Separator, ActionRunner } from "../../../../base/common/actions.js";
import { ExtensionIdentifier, ExtensionIdentifierMap, isLanguagePackExtension } from "../../../../platform/extensions/common/extensions.js";
import { createCancelablePromise, ThrottledDelayer } from "../../../../base/common/async.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { SeverityIcon } from "../../../../base/browser/ui/severityIcon/severityIcon.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IViewDescriptorService, ViewContainerLocation } from "../../../common/views.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IExtensionManifestPropertiesService } from "../../../services/extensions/common/extensionManifestPropertiesService.js";
import { isVirtualWorkspace } from "../../../../platform/workspace/common/virtualWorkspace.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { IWorkbenchLayoutService, Position } from "../../../services/layout/browser/layoutService.js";
import { HoverPosition } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { isOfflineError } from "../../../../base/parts/request/common/request.js";
import { defaultCountBadgeStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions, IExtensionFeaturesManagementService } from "../../../services/extensionManagement/common/extensionFeatures.js";
import { isString } from "../../../../base/common/types.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
const NONE_CATEGORY = "none";
class ExtensionsViewState extends Disposable {
  constructor() {
    super(...arguments);
    this._onFocus = this._register(new Emitter());
    this.onFocus = this._onFocus.event;
    this._onBlur = this._register(new Emitter());
    this.onBlur = this._onBlur.event;
    this.currentlyFocusedItems = [];
    this.filters = {};
  }
  onFocusChange(extensions) {
    this.currentlyFocusedItems.forEach((extension) => this._onBlur.fire(extension));
    this.currentlyFocusedItems = extensions;
    this.currentlyFocusedItems.forEach((extension) => this._onFocus.fire(extension));
  }
}
var LocalSortBy = /* @__PURE__ */ ((LocalSortBy2) => {
  LocalSortBy2["UpdateDate"] = "UpdateDate";
  return LocalSortBy2;
})(LocalSortBy || {});
function isLocalSortBy(value) {
  switch (value) {
    case "UpdateDate" /* UpdateDate */:
      return true;
  }
}
let ExtensionsListView = class extends ViewPane {
  constructor(options, viewletViewOptions, notificationService, keybindingService, contextMenuService, instantiationService, themeService, extensionService, extensionsWorkbenchService, extensionRecommendationsService, telemetryService, hoverService, configurationService, contextService, extensionManagementServerService, extensionManifestPropertiesService, extensionManagementService, workspaceService, productService, contextKeyService, viewDescriptorService, openerService, preferencesService, storageService, workspaceTrustManagementService, extensionEnablementService, layoutService, extensionFeaturesManagementService, uriIdentityService, logService) {
    super({
      ...viewletViewOptions,
      showActions: ViewPaneShowActions.Always,
      maximumBodySize: options.flexibleHeight ? storageService.getNumber(`${viewletViewOptions.id}.size`, StorageScope.PROFILE, 0) ? void 0 : 0 : void 0
    }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.options = options;
    this.notificationService = notificationService;
    this.extensionService = extensionService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionRecommendationsService = extensionRecommendationsService;
    this.telemetryService = telemetryService;
    this.contextService = contextService;
    this.extensionManagementServerService = extensionManagementServerService;
    this.extensionManifestPropertiesService = extensionManifestPropertiesService;
    this.extensionManagementService = extensionManagementService;
    this.workspaceService = workspaceService;
    this.productService = productService;
    this.preferencesService = preferencesService;
    this.storageService = storageService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.extensionEnablementService = extensionEnablementService;
    this.layoutService = layoutService;
    this.extensionFeaturesManagementService = extensionFeaturesManagementService;
    this.uriIdentityService = uriIdentityService;
    this.logService = logService;
    this.list = null;
    this.queryRequest = null;
    this.contextMenuActionRunner = this._register(new ActionRunner());
    if (this.options.onDidChangeTitle) {
      this._register(this.options.onDidChangeTitle((title) => this.updateTitle(title)));
    }
    this._register(this.contextMenuActionRunner.onDidRun(({ error }) => error && this.notificationService.error(error)));
    this.registerActions();
  }
  registerActions() {
  }
  renderHeader(container) {
    container.classList.add("extension-view-header");
    super.renderHeader(container);
    if (!this.options.hideBadge) {
      this.badge = this._register(new CountBadge(append(container, $(".count-badge-wrapper")), {}, defaultCountBadgeStyles));
    }
  }
  renderBody(container) {
    super.renderBody(container);
    const messageContainer = append(container, $(".message-container"));
    const messageSeverityIcon = append(messageContainer, $(""));
    const messageBox = append(messageContainer, $(".message"));
    const extensionsList = append(container, $(".extensions-list"));
    const delegate = new Delegate();
    this.extensionsViewState = new ExtensionsViewState();
    const renderer = this.instantiationService.createInstance(Renderer, this.extensionsViewState, {
      hoverOptions: {
        position: () => {
          const viewLocation = this.viewDescriptorService.getViewLocationById(this.id);
          if (viewLocation === ViewContainerLocation.Sidebar) {
            return this.layoutService.getSideBarPosition() === Position.LEFT ? HoverPosition.RIGHT : HoverPosition.LEFT;
          }
          if (viewLocation === ViewContainerLocation.AuxiliaryBar) {
            return this.layoutService.getSideBarPosition() === Position.LEFT ? HoverPosition.LEFT : HoverPosition.RIGHT;
          }
          return HoverPosition.RIGHT;
        }
      }
    });
    this.list = this.instantiationService.createInstance(WorkbenchPagedList, "Extensions", extensionsList, delegate, [renderer], {
      multipleSelectionSupport: false,
      setRowLineHeight: false,
      horizontalScrolling: false,
      accessibilityProvider: {
        getAriaLabel(extension) {
          return getAriaLabelForExtension(extension);
        },
        getWidgetAriaLabel() {
          return localize("extensions", "Extensions");
        }
      },
      overrideStyles: this.getLocationBasedColors().listOverrideStyles,
      openOnSingleClick: true
    });
    ExtensionResultsListFocused.bindTo(this.list.contextKeyService);
    this._register(this.list.onContextMenu((e) => this.onContextMenu(e), this));
    this._register(this.list.onDidChangeFocus((e) => this.extensionsViewState?.onFocusChange(coalesce(e.elements)), this));
    this._register(this.list);
    this._register(this.extensionsViewState);
    this._register(Event.debounce(Event.filter(this.list.onDidOpen, (e) => e.element !== null), (_, event) => event, 75, true)((options) => {
      this.openExtension(options.element, { sideByside: options.sideBySide, ...options.editorOptions });
    }));
    this.bodyTemplate = {
      extensionsList,
      messageBox,
      messageContainer,
      messageSeverityIcon
    };
    if (this.queryResult) {
      this.setModel(this.queryResult.model);
    }
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    if (this.bodyTemplate) {
      this.bodyTemplate.extensionsList.style.height = height + "px";
    }
    this.list?.layout(height, width);
  }
  async show(query, refresh) {
    if (this.queryRequest) {
      if (!refresh && this.queryRequest.query === query) {
        return this.queryRequest.request;
      }
      this.queryRequest.request.cancel();
      this.queryRequest = null;
    }
    if (this.queryResult) {
      this.queryResult.disposables.dispose();
      this.queryResult = void 0;
      if (this.extensionsViewState) {
        this.extensionsViewState.filters = {};
      }
    }
    const parsedQuery = Query.parse(query);
    const options = {
      sortOrder: SortOrder.Default
    };
    switch (parsedQuery.sortBy) {
      case "installs":
        options.sortBy = GallerySortBy.InstallCount;
        break;
      case "rating":
        options.sortBy = GallerySortBy.WeightedRating;
        break;
      case "name":
        options.sortBy = GallerySortBy.Title;
        break;
      case "publishedDate":
        options.sortBy = GallerySortBy.PublishedDate;
        break;
      case "updateDate":
        options.sortBy = "UpdateDate" /* UpdateDate */;
        break;
    }
    const request = createCancelablePromise(async (token) => {
      try {
        this.queryResult = await this.query(parsedQuery, options, token);
        const model = this.queryResult.model;
        this.setModel(model, this.queryResult.description ? { text: this.queryResult.description, severity: Severity.Info } : void 0);
        if (this.queryResult.onDidChangeModel) {
          this.queryResult.disposables.add(this.queryResult.onDidChangeModel((model2) => {
            if (this.queryResult) {
              this.queryResult.model = model2;
              this.updateModel(model2);
            }
          }));
        }
        return model;
      } catch (e) {
        const model = new PagedModel([]);
        if (!isCancellationError(e)) {
          this.logService.error(e);
          this.setModel(model, this.getMessage(e));
        }
        return this.list ? this.list.model : model;
      }
    });
    request.finally(() => this.queryRequest = null);
    this.queryRequest = { query, request };
    return request;
  }
  count() {
    return this.queryResult?.model.length ?? 0;
  }
  showEmptyModel() {
    const emptyModel = new PagedModel([]);
    this.setModel(emptyModel);
    return Promise.resolve(emptyModel);
  }
  async onContextMenu(e) {
    if (e.element) {
      const disposables = new DisposableStore();
      const manageExtensionAction = disposables.add(this.instantiationService.createInstance(ManageExtensionAction));
      const extension = e.element ? this.extensionsWorkbenchService.local.find((local) => areSameExtensions(local.identifier, e.element.identifier) && (!e.element.server || e.element.server === local.server)) || e.element : e.element;
      manageExtensionAction.extension = extension;
      let groups = [];
      if (manageExtensionAction.enabled) {
        groups = await manageExtensionAction.getActionGroups();
      } else if (extension) {
        groups = await getContextMenuActions(extension, this.contextKeyService, this.instantiationService);
        groups.forEach((group) => group.forEach((extensionAction) => {
          if (extensionAction instanceof ExtensionAction) {
            extensionAction.extension = extension;
          }
        }));
      }
      const actions = [];
      for (const menuActions of groups) {
        for (const menuAction of menuActions) {
          actions.push(menuAction);
          if (isDisposable(menuAction)) {
            disposables.add(menuAction);
          }
        }
        actions.push(new Separator());
      }
      actions.pop();
      this.contextMenuService.showContextMenu({
        getAnchor: () => e.anchor,
        getActions: () => actions,
        actionRunner: this.contextMenuActionRunner,
        onHide: () => disposables.dispose()
      });
    }
  }
  async query(query, options, token) {
    const idRegex = /@id:(([a-z0-9A-Z][a-z0-9\-A-Z]*)\.([a-z0-9A-Z][a-z0-9\-A-Z]*))/g;
    const ids = [];
    let idMatch;
    while ((idMatch = idRegex.exec(query.value)) !== null) {
      const name = idMatch[1];
      ids.push(name);
    }
    if (ids.length) {
      const model2 = await this.queryByIds(ids, options, token);
      return { model: model2, disposables: new DisposableStore() };
    }
    if (ExtensionsListView.isLocalExtensionsQuery(query.value, query.sortBy)) {
      return this.queryLocal(query, options);
    }
    if (ExtensionsListView.isSearchPopularQuery(query.value)) {
      query.value = query.value.replace("@popular", "");
      options.sortBy = !options.sortBy ? GallerySortBy.InstallCount : options.sortBy;
    } else if (ExtensionsListView.isSearchRecentlyPublishedQuery(query.value)) {
      query.value = query.value.replace("@recentlyPublished", "");
      options.sortBy = !options.sortBy ? GallerySortBy.PublishedDate : options.sortBy;
    }
    const galleryQueryOptions = { ...options, sortBy: isLocalSortBy(options.sortBy) ? void 0 : options.sortBy };
    const model = await this.queryGallery(query, galleryQueryOptions, token);
    return { model, disposables: new DisposableStore() };
  }
  async queryByIds(ids, options, token) {
    const idsSet = ids.reduce((result2, id) => {
      result2.add(id.toLowerCase());
      return result2;
    }, /* @__PURE__ */ new Set());
    const result = (await this.extensionsWorkbenchService.queryLocal(this.options.server)).filter((e) => idsSet.has(e.identifier.id.toLowerCase()));
    const galleryIds = result.length ? ids.filter((id) => result.every((r) => !areSameExtensions(r.identifier, { id }))) : ids;
    if (galleryIds.length) {
      const galleryResult = await this.extensionsWorkbenchService.getExtensions(galleryIds.map((id) => ({ id })), { source: "queryById" }, token);
      result.push(...galleryResult);
    }
    return new PagedModel(result);
  }
  async queryLocal(query, options) {
    const local = await this.extensionsWorkbenchService.queryLocal(this.options.server);
    let { extensions, canIncludeInstalledExtensions, description } = await this.filterLocal(local, this.extensionService.extensions, query, options);
    const disposables = new DisposableStore();
    const onDidChangeModel = disposables.add(new Emitter());
    if (canIncludeInstalledExtensions) {
      let isDisposed = false;
      disposables.add(toDisposable(() => isDisposed = true));
      disposables.add(Event.debounce(Event.any(
        Event.filter(this.extensionsWorkbenchService.onChange, (e) => e?.state === ExtensionState.Installed),
        this.extensionService.onDidChangeExtensions
      ), () => void 0)(async () => {
        const local2 = this.options.server ? this.extensionsWorkbenchService.installed.filter((e) => e.server === this.options.server) : this.extensionsWorkbenchService.local;
        const { extensions: newExtensions } = await this.filterLocal(local2, this.extensionService.extensions, query, options);
        if (!isDisposed) {
          const mergedExtensions = this.mergeAddedExtensions(extensions, newExtensions);
          if (mergedExtensions) {
            extensions = mergedExtensions;
            onDidChangeModel.fire(new PagedModel(extensions));
          }
        }
      }));
    }
    return {
      model: new PagedModel(extensions),
      description,
      onDidChangeModel: onDidChangeModel.event,
      disposables
    };
  }
  async filterLocal(local, runningExtensions, query, options) {
    const value = query.value;
    let extensions = [];
    let canIncludeInstalledExtensions = true;
    let description;
    if (/@builtin/i.test(value)) {
      extensions = this.filterBuiltinExtensions(local, query, options);
      canIncludeInstalledExtensions = false;
    } else if (/@installed/i.test(value)) {
      extensions = this.filterInstalledExtensions(local, runningExtensions, query, options);
    } else if (/@outdated/i.test(value)) {
      extensions = this.filterOutdatedExtensions(local, query, options);
    } else if (/@disabled/i.test(value)) {
      extensions = this.filterDisabledExtensions(local, runningExtensions, query, options);
    } else if (/@enabled/i.test(value)) {
      extensions = this.filterEnabledExtensions(local, runningExtensions, query, options);
    } else if (/@workspaceUnsupported/i.test(value)) {
      extensions = this.filterWorkspaceUnsupportedExtensions(local, query, options);
    } else if (/@deprecated/i.test(query.value)) {
      extensions = await this.filterDeprecatedExtensions(local, query, options);
    } else if (/@recentlyUpdated/i.test(query.value)) {
      extensions = this.filterRecentlyUpdatedExtensions(local, query, options);
    } else if (/@feature:/i.test(query.value)) {
      const result = this.filterExtensionsByFeature(local, query);
      if (result) {
        extensions = result.extensions;
        description = result.description;
      }
    }
    return { extensions, canIncludeInstalledExtensions, description };
  }
  filterBuiltinExtensions(local, query, options) {
    let { value, includedCategories, excludedCategories } = this.parseCategories(query.value);
    value = value.replace(/@builtin/g, "").replace(/@sort:(\w+)(-\w*)?/g, "").trim().toLowerCase();
    const result = local.filter((e) => e.isBuiltin && (e.name.toLowerCase().indexOf(value) > -1 || e.displayName.toLowerCase().indexOf(value) > -1) && this.filterExtensionByCategory(e, includedCategories, excludedCategories));
    return this.sortExtensions(result, options);
  }
  filterExtensionByCategory(e, includedCategories, excludedCategories) {
    if (!includedCategories.length && !excludedCategories.length) {
      return true;
    }
    if (e.categories.length) {
      if (excludedCategories.length && e.categories.some((category) => excludedCategories.includes(category.toLowerCase()))) {
        return false;
      }
      return e.categories.some((category) => includedCategories.includes(category.toLowerCase()));
    } else {
      return includedCategories.includes(NONE_CATEGORY);
    }
  }
  parseCategories(value) {
    const includedCategories = [];
    const excludedCategories = [];
    value = value.replace(/\bcategory:("([^"]*)"|([^"]\S*))(\s+|\b|$)/g, (_, quotedCategory, category) => {
      const entry = (category || quotedCategory || "").toLowerCase();
      if (entry.startsWith("-")) {
        if (excludedCategories.indexOf(entry) === -1) {
          excludedCategories.push(entry);
        }
      } else {
        if (includedCategories.indexOf(entry) === -1) {
          includedCategories.push(entry);
        }
      }
      return "";
    });
    return { value, includedCategories, excludedCategories };
  }
  filterInstalledExtensions(local, runningExtensions, query, options) {
    let { value, includedCategories, excludedCategories } = this.parseCategories(query.value);
    value = value.replace(/@installed/g, "").replace(/@sort:(\w+)(-\w*)?/g, "").trim().toLowerCase();
    const matchingText = (e) => (e.name.toLowerCase().indexOf(value) > -1 || e.displayName.toLowerCase().indexOf(value) > -1 || e.description.toLowerCase().indexOf(value) > -1) && this.filterExtensionByCategory(e, includedCategories, excludedCategories);
    let result;
    if (options.sortBy !== void 0) {
      result = local.filter((e) => !e.isBuiltin && matchingText(e));
      result = this.sortExtensions(result, options);
    } else {
      result = local.filter((e) => (!e.isBuiltin || e.outdated || e.runtimeState !== void 0) && matchingText(e));
      const runningExtensionsById = runningExtensions.reduce((result2, e) => {
        result2.set(e.identifier.value, e);
        return result2;
      }, new ExtensionIdentifierMap());
      const defaultSort = (e1, e2) => {
        const running1 = runningExtensionsById.get(e1.identifier.id);
        const isE1Running = !!running1 && this.extensionManagementServerService.getExtensionManagementServer(toExtension(running1)) === e1.server;
        const running2 = runningExtensionsById.get(e2.identifier.id);
        const isE2Running = running2 && this.extensionManagementServerService.getExtensionManagementServer(toExtension(running2)) === e2.server;
        if (isE1Running && isE2Running) {
          return e1.displayName.localeCompare(e2.displayName);
        }
        const isE1LanguagePackExtension = e1.local && isLanguagePackExtension(e1.local.manifest);
        const isE2LanguagePackExtension = e2.local && isLanguagePackExtension(e2.local.manifest);
        if (!isE1Running && !isE2Running) {
          if (isE1LanguagePackExtension) {
            return -1;
          }
          if (isE2LanguagePackExtension) {
            return 1;
          }
          return e1.displayName.localeCompare(e2.displayName);
        }
        if (isE1Running && isE2LanguagePackExtension || isE2Running && isE1LanguagePackExtension) {
          return e1.displayName.localeCompare(e2.displayName);
        }
        return isE1Running ? -1 : 1;
      };
      const incompatible = [];
      const deprecated = [];
      const outdated = [];
      const actionRequired = [];
      const noActionRequired = [];
      for (const e of result) {
        if (e.enablementState === EnablementState.DisabledByInvalidExtension) {
          incompatible.push(e);
        } else if (e.deprecationInfo) {
          deprecated.push(e);
        } else if (e.outdated && this.extensionEnablementService.isEnabledEnablementState(e.enablementState)) {
          outdated.push(e);
        } else if (e.runtimeState) {
          actionRequired.push(e);
        } else {
          noActionRequired.push(e);
        }
      }
      result = [
        ...incompatible.sort(defaultSort),
        ...deprecated.sort(defaultSort),
        ...outdated.sort(defaultSort),
        ...actionRequired.sort(defaultSort),
        ...noActionRequired.sort(defaultSort)
      ];
    }
    return result;
  }
  filterOutdatedExtensions(local, query, options) {
    let { value, includedCategories, excludedCategories } = this.parseCategories(query.value);
    value = value.replace(/@outdated/g, "").replace(/@sort:(\w+)(-\w*)?/g, "").trim().toLowerCase();
    const result = local.sort((e1, e2) => e1.displayName.localeCompare(e2.displayName)).filter((extension) => extension.outdated && (extension.name.toLowerCase().indexOf(value) > -1 || extension.displayName.toLowerCase().indexOf(value) > -1) && this.filterExtensionByCategory(extension, includedCategories, excludedCategories));
    return this.sortExtensions(result, options);
  }
  filterDisabledExtensions(local, runningExtensions, query, options) {
    let { value, includedCategories, excludedCategories } = this.parseCategories(query.value);
    value = value.replace(/@disabled/g, "").replace(/@sort:(\w+)(-\w*)?/g, "").trim().toLowerCase();
    const result = local.sort((e1, e2) => e1.displayName.localeCompare(e2.displayName)).filter((e) => runningExtensions.every((r) => !areSameExtensions({ id: r.identifier.value, uuid: r.uuid }, e.identifier)) && (e.name.toLowerCase().indexOf(value) > -1 || e.displayName.toLowerCase().indexOf(value) > -1) && this.filterExtensionByCategory(e, includedCategories, excludedCategories));
    return this.sortExtensions(result, options);
  }
  filterEnabledExtensions(local, runningExtensions, query, options) {
    let { value, includedCategories, excludedCategories } = this.parseCategories(query.value);
    value = value ? value.replace(/@enabled/g, "").replace(/@sort:(\w+)(-\w*)?/g, "").trim().toLowerCase() : "";
    local = local.filter((e) => !e.isBuiltin);
    const result = local.sort((e1, e2) => e1.displayName.localeCompare(e2.displayName)).filter((e) => runningExtensions.some((r) => areSameExtensions({ id: r.identifier.value, uuid: r.uuid }, e.identifier)) && (e.name.toLowerCase().indexOf(value) > -1 || e.displayName.toLowerCase().indexOf(value) > -1) && this.filterExtensionByCategory(e, includedCategories, excludedCategories));
    return this.sortExtensions(result, options);
  }
  filterWorkspaceUnsupportedExtensions(local, query, options) {
    const queryString = query.value;
    const match = queryString.match(/^\s*@workspaceUnsupported(?::(untrusted|virtual)(Partial)?)?(?:\s+([^\s]*))?/i);
    if (!match) {
      return [];
    }
    const type = match[1]?.toLowerCase();
    const partial = !!match[2];
    const nameFilter = match[3]?.toLowerCase();
    if (nameFilter) {
      local = local.filter((extension) => extension.name.toLowerCase().indexOf(nameFilter) > -1 || extension.displayName.toLowerCase().indexOf(nameFilter) > -1);
    }
    const hasVirtualSupportType = (extension, supportType) => {
      return extension.local && this.extensionManifestPropertiesService.getExtensionVirtualWorkspaceSupportType(extension.local.manifest) === supportType;
    };
    const hasRestrictedSupportType = (extension, supportType) => {
      if (!extension.local) {
        return false;
      }
      const enablementState = this.extensionEnablementService.getEnablementState(extension.local);
      if (enablementState !== EnablementState.EnabledGlobally && enablementState !== EnablementState.EnabledWorkspace && enablementState !== EnablementState.DisabledByTrustRequirement && enablementState !== EnablementState.DisabledByExtensionDependency) {
        return false;
      }
      if (this.extensionManifestPropertiesService.getExtensionUntrustedWorkspaceSupportType(extension.local.manifest) === supportType) {
        return true;
      }
      if (supportType === false) {
        const dependencies = getExtensionDependencies(local.map((ext) => ext.local), extension.local);
        return dependencies.some((ext) => this.extensionManifestPropertiesService.getExtensionUntrustedWorkspaceSupportType(ext.manifest) === supportType);
      }
      return false;
    };
    const inVirtualWorkspace = isVirtualWorkspace(this.workspaceService.getWorkspace());
    const inRestrictedWorkspace = !this.workspaceTrustManagementService.isWorkspaceTrusted();
    if (type === "virtual") {
      local = local.filter((extension) => inVirtualWorkspace && hasVirtualSupportType(extension, partial ? "limited" : false) && !(inRestrictedWorkspace && hasRestrictedSupportType(extension, false)));
    } else if (type === "untrusted") {
      local = local.filter((extension) => hasRestrictedSupportType(extension, partial ? "limited" : false) && !(inVirtualWorkspace && hasVirtualSupportType(extension, false)));
    } else {
      local = local.filter((extension) => inVirtualWorkspace && !hasVirtualSupportType(extension, true) || inRestrictedWorkspace && !hasRestrictedSupportType(extension, true));
    }
    return this.sortExtensions(local, options);
  }
  async filterDeprecatedExtensions(local, query, options) {
    const value = query.value.replace(/@deprecated/g, "").replace(/@sort:(\w+)(-\w*)?/g, "").trim().toLowerCase();
    const extensionsControlManifest = await this.extensionManagementService.getExtensionsControlManifest();
    const deprecatedExtensionIds = Object.keys(extensionsControlManifest.deprecated);
    local = local.filter((e) => deprecatedExtensionIds.includes(e.identifier.id) && (!value || e.name.toLowerCase().indexOf(value) > -1 || e.displayName.toLowerCase().indexOf(value) > -1));
    return this.sortExtensions(local, options);
  }
  filterRecentlyUpdatedExtensions(local, query, options) {
    let { value, includedCategories, excludedCategories } = this.parseCategories(query.value);
    const currentTime = Date.now();
    local = local.filter((e) => !e.isBuiltin && !e.outdated && e.local?.updated && e.local?.installedTimestamp !== void 0 && currentTime - e.local.installedTimestamp < ExtensionsListView.RECENT_UPDATE_DURATION);
    value = value.replace(/@recentlyUpdated/g, "").replace(/@sort:(\w+)(-\w*)?/g, "").trim().toLowerCase();
    const result = local.filter((e) => (e.name.toLowerCase().indexOf(value) > -1 || e.displayName.toLowerCase().indexOf(value) > -1) && this.filterExtensionByCategory(e, includedCategories, excludedCategories));
    options.sortBy = options.sortBy ?? "UpdateDate" /* UpdateDate */;
    return this.sortExtensions(result, options);
  }
  filterExtensionsByFeature(local, query) {
    const value = query.value.replace(/@feature:/g, "").trim();
    const featureId = value.split(" ")[0];
    const feature = Registry.as(Extensions.ExtensionFeaturesRegistry).getExtensionFeature(featureId);
    if (!feature) {
      return void 0;
    }
    if (this.extensionsViewState) {
      this.extensionsViewState.filters.featureId = featureId;
    }
    const renderer = feature.renderer ? this.instantiationService.createInstance(feature.renderer) : void 0;
    try {
      const result = [];
      for (const e of local) {
        if (!e.local) {
          continue;
        }
        const accessData = this.extensionFeaturesManagementService.getAccessData(new ExtensionIdentifier(e.identifier.id), featureId);
        const shouldRender = renderer?.shouldRender(e.local.manifest);
        if (accessData || shouldRender) {
          result.push([e, accessData?.accessTimes.length ?? 0]);
        }
      }
      return {
        extensions: result.sort(([, a], [, b]) => b - a).map(([e]) => e),
        description: localize("showingExtensionsForFeature", "Extensions using {0} in the last 30 days", feature.label)
      };
    } finally {
      renderer?.dispose();
    }
  }
  mergeAddedExtensions(extensions, newExtensions) {
    const oldExtensions = [...extensions];
    const findPreviousExtensionIndex = (from) => {
      let index = -1;
      const previousExtensionInNew = newExtensions[from];
      if (previousExtensionInNew) {
        index = oldExtensions.findIndex((e) => areSameExtensions(e.identifier, previousExtensionInNew.identifier));
        if (index === -1) {
          return findPreviousExtensionIndex(from - 1);
        }
      }
      return index;
    };
    let hasChanged = false;
    for (let index = 0; index < newExtensions.length; index++) {
      const extension = newExtensions[index];
      if (extensions.every((r) => !areSameExtensions(r.identifier, extension.identifier))) {
        hasChanged = true;
        extensions.splice(findPreviousExtensionIndex(index - 1) + 1, 0, extension);
      }
    }
    return hasChanged ? extensions : void 0;
  }
  async queryGallery(query, options, token) {
    const hasUserDefinedSortOrder = options.sortBy !== void 0;
    if (!hasUserDefinedSortOrder && !query.value.trim()) {
      options.sortBy = GallerySortBy.InstallCount;
    }
    if (this.isRecommendationsQuery(query)) {
      return this.queryRecommendations(query, options, token);
    }
    const text = query.value;
    if (!text) {
      options.source = "viewlet";
      const pager2 = await this.extensionsWorkbenchService.queryGallery(options, token);
      return new PagedModel(pager2);
    }
    if (/\bext:([^\s]+)\b/g.test(text)) {
      options.text = text;
      options.source = "file-extension-tags";
      const pager2 = await this.extensionsWorkbenchService.queryGallery(options, token);
      return new PagedModel(pager2);
    }
    options.text = text.substring(0, 350);
    options.source = "searchText";
    if (hasUserDefinedSortOrder || /\b(category|tag):([^\s]+)\b/gi.test(text) || /\bfeatured(\s+|\b|$)/gi.test(text)) {
      const pager2 = await this.extensionsWorkbenchService.queryGallery(options, token);
      return new PagedModel(pager2);
    }
    const [pager, preferredExtensions] = await Promise.all([
      this.extensionsWorkbenchService.queryGallery(options, token),
      this.getPreferredExtensions(options.text.toLowerCase(), token).catch(() => [])
    ]);
    return preferredExtensions.length ? new PreferredExtensionsPagedModel(preferredExtensions, pager) : new PagedModel(pager);
  }
  async getPreferredExtensions(searchText, token) {
    const preferredExtensions = this.extensionsWorkbenchService.local.filter((e) => !e.isBuiltin && (e.name.toLowerCase().indexOf(searchText) > -1 || e.displayName.toLowerCase().indexOf(searchText) > -1 || e.description.toLowerCase().indexOf(searchText) > -1));
    const preferredExtensionUUIDs = /* @__PURE__ */ new Set();
    if (preferredExtensions.length) {
      const extesionsToFetch = [];
      for (const extension of preferredExtensions) {
        if (extension.identifier.uuid) {
          preferredExtensionUUIDs.add(extension.identifier.uuid);
        }
        if (!extension.gallery && extension.identifier.uuid) {
          extesionsToFetch.push(extension.identifier);
        }
      }
      if (extesionsToFetch.length) {
        this.extensionsWorkbenchService.getExtensions(extesionsToFetch, CancellationToken.None).catch(
          (e) => null
          /*ignore error*/
        );
      }
    }
    const preferredResults = [];
    try {
      const manifest = await this.extensionManagementService.getExtensionsControlManifest();
      if (Array.isArray(manifest.search)) {
        for (const s of manifest.search) {
          if (s.query && s.query.toLowerCase() === searchText && Array.isArray(s.preferredResults)) {
            preferredResults.push(...s.preferredResults);
            break;
          }
        }
      }
      if (preferredResults.length) {
        const result = await this.extensionsWorkbenchService.getExtensions(preferredResults.map((id) => ({ id })), token);
        for (const extension of result) {
          if (extension.identifier.uuid && !preferredExtensionUUIDs.has(extension.identifier.uuid)) {
            preferredExtensions.push(extension);
          }
        }
      }
    } catch (e) {
      this.logService.warn("Failed to get preferred results from the extensions control manifest.", e);
    }
    return preferredExtensions;
  }
  sortExtensions(extensions, options) {
    switch (options.sortBy) {
      case GallerySortBy.InstallCount:
        extensions = extensions.sort((e1, e2) => typeof e2.installCount === "number" && typeof e1.installCount === "number" ? e2.installCount - e1.installCount : NaN);
        break;
      case "UpdateDate" /* UpdateDate */:
        extensions = extensions.sort((e1, e2) => typeof e2.local?.installedTimestamp === "number" && typeof e1.local?.installedTimestamp === "number" ? e2.local.installedTimestamp - e1.local.installedTimestamp : typeof e2.local?.installedTimestamp === "number" ? 1 : typeof e1.local?.installedTimestamp === "number" ? -1 : NaN);
        break;
      case GallerySortBy.AverageRating:
      case GallerySortBy.WeightedRating:
        extensions = extensions.sort((e1, e2) => typeof e2.rating === "number" && typeof e1.rating === "number" ? e2.rating - e1.rating : NaN);
        break;
      default:
        extensions = extensions.sort((e1, e2) => e1.displayName.localeCompare(e2.displayName));
        break;
    }
    if (options.sortOrder === SortOrder.Descending) {
      extensions = extensions.reverse();
    }
    return extensions;
  }
  isRecommendationsQuery(query) {
    return ExtensionsListView.isWorkspaceRecommendedExtensionsQuery(query.value) || ExtensionsListView.isKeymapsRecommendedExtensionsQuery(query.value) || ExtensionsListView.isLanguageRecommendedExtensionsQuery(query.value) || ExtensionsListView.isExeRecommendedExtensionsQuery(query.value) || ExtensionsListView.isRemoteRecommendedExtensionsQuery(query.value) || /@recommended:all/i.test(query.value) || ExtensionsListView.isSearchRecommendedExtensionsQuery(query.value) || ExtensionsListView.isRecommendedExtensionsQuery(query.value);
  }
  async queryRecommendations(query, options, token) {
    if (ExtensionsListView.isWorkspaceRecommendedExtensionsQuery(query.value)) {
      return this.getWorkspaceRecommendationsModel(query, options, token);
    }
    if (ExtensionsListView.isKeymapsRecommendedExtensionsQuery(query.value)) {
      return this.getKeymapRecommendationsModel(query, options, token);
    }
    if (ExtensionsListView.isLanguageRecommendedExtensionsQuery(query.value)) {
      return this.getLanguageRecommendationsModel(query, options, token);
    }
    if (ExtensionsListView.isExeRecommendedExtensionsQuery(query.value)) {
      return this.getExeRecommendationsModel(query, options, token);
    }
    if (ExtensionsListView.isRemoteRecommendedExtensionsQuery(query.value)) {
      return this.getRemoteRecommendationsModel(query, options, token);
    }
    if (/@recommended:all/i.test(query.value)) {
      return this.getAllRecommendationsModel(options, token);
    }
    if (ExtensionsListView.isSearchRecommendedExtensionsQuery(query.value) || ExtensionsListView.isRecommendedExtensionsQuery(query.value) && options.sortBy !== void 0) {
      return this.searchRecommendations(query, options, token);
    }
    if (ExtensionsListView.isRecommendedExtensionsQuery(query.value)) {
      return this.getOtherRecommendationsModel(query, options, token);
    }
    return new PagedModel([]);
  }
  async getInstallableRecommendations(recommendations, options, token) {
    const result = [];
    if (recommendations.length) {
      const galleryExtensions = [];
      const resourceExtensions = [];
      for (const recommendation of recommendations) {
        if (typeof recommendation === "string") {
          galleryExtensions.push(recommendation);
        } else {
          resourceExtensions.push(recommendation);
        }
      }
      if (galleryExtensions.length) {
        try {
          const extensions = await this.extensionsWorkbenchService.getExtensions(galleryExtensions.map((id) => ({ id })), { source: options.source }, token);
          for (const extension of extensions) {
            if (extension.gallery && !extension.deprecationInfo && await this.extensionManagementService.canInstall(extension.gallery) === true) {
              result.push(extension);
            }
          }
        } catch (error) {
          if (!resourceExtensions.length || !this.isOfflineError(error)) {
            throw error;
          }
        }
      }
      if (resourceExtensions.length) {
        const extensions = await this.extensionsWorkbenchService.getResourceExtensions(resourceExtensions, true);
        for (const extension of extensions) {
          if (await this.extensionsWorkbenchService.canInstall(extension) === true) {
            result.push(extension);
          }
        }
      }
    }
    return result;
  }
  async getWorkspaceRecommendations() {
    const recommendations = await this.extensionRecommendationsService.getWorkspaceRecommendations();
    const { important } = await this.extensionRecommendationsService.getConfigBasedRecommendations();
    for (const configBasedRecommendation of important) {
      if (!recommendations.find((extensionId) => extensionId === configBasedRecommendation)) {
        recommendations.push(configBasedRecommendation);
      }
    }
    return recommendations;
  }
  async getWorkspaceRecommendationsModel(query, options, token) {
    const recommendations = await this.getWorkspaceRecommendations();
    const installableRecommendations = await this.getInstallableRecommendations(recommendations, { ...options, source: "recommendations-workspace" }, token);
    return new PagedModel(installableRecommendations);
  }
  async getKeymapRecommendationsModel(query, options, token) {
    const value = query.value.replace(/@recommended:keymaps/g, "").trim().toLowerCase();
    const recommendations = this.extensionRecommendationsService.getKeymapRecommendations();
    const installableRecommendations = (await this.getInstallableRecommendations(recommendations, { ...options, source: "recommendations-keymaps" }, token)).filter((extension) => extension.identifier.id.toLowerCase().indexOf(value) > -1);
    return new PagedModel(installableRecommendations);
  }
  async getLanguageRecommendationsModel(query, options, token) {
    const value = query.value.replace(/@recommended:languages/g, "").trim().toLowerCase();
    const recommendations = this.extensionRecommendationsService.getLanguageRecommendations();
    const installableRecommendations = (await this.getInstallableRecommendations(recommendations, { ...options, source: "recommendations-languages" }, token)).filter((extension) => extension.identifier.id.toLowerCase().indexOf(value) > -1);
    return new PagedModel(installableRecommendations);
  }
  async getRemoteRecommendationsModel(query, options, token) {
    const value = query.value.replace(/@recommended:remotes/g, "").trim().toLowerCase();
    const recommendations = this.extensionRecommendationsService.getRemoteRecommendations();
    const installableRecommendations = (await this.getInstallableRecommendations(recommendations, { ...options, source: "recommendations-remotes" }, token)).filter((extension) => extension.identifier.id.toLowerCase().indexOf(value) > -1);
    return new PagedModel(installableRecommendations);
  }
  async getExeRecommendationsModel(query, options, token) {
    const exe = query.value.replace(/@exe:/g, "").trim().toLowerCase();
    const { important, others } = await this.extensionRecommendationsService.getExeBasedRecommendations(exe.startsWith('"') ? exe.substring(1, exe.length - 1) : exe);
    const installableRecommendations = await this.getInstallableRecommendations([...important, ...others], { ...options, source: "recommendations-exe" }, token);
    return new PagedModel(installableRecommendations);
  }
  async getOtherRecommendationsModel(query, options, token) {
    const otherRecommendations = await this.getOtherRecommendations();
    const installableRecommendations = await this.getInstallableRecommendations(otherRecommendations, { ...options, source: "recommendations-other", sortBy: void 0 }, token);
    const result = coalesce(otherRecommendations.map((id) => installableRecommendations.find((i) => areSameExtensions(i.identifier, { id }))));
    return new PagedModel(result);
  }
  async getOtherRecommendations() {
    const local = (await this.extensionsWorkbenchService.queryLocal(this.options.server)).map((e) => e.identifier.id.toLowerCase());
    const workspaceRecommendations = (await this.getWorkspaceRecommendations()).map((extensionId) => isString(extensionId) ? extensionId.toLowerCase() : extensionId);
    return distinct(
      (await Promise.all([
        // Order is important
        this.extensionRecommendationsService.getImportantRecommendations(),
        this.extensionRecommendationsService.getFileBasedRecommendations(),
        this.extensionRecommendationsService.getOtherRecommendations()
      ])).flat().filter(
        (extensionId) => !local.includes(extensionId.toLowerCase()) && !workspaceRecommendations.includes(extensionId.toLowerCase())
      ),
      (extensionId) => extensionId.toLowerCase()
    );
  }
  // Get All types of recommendations, trimmed to show a max of 8 at any given time
  async getAllRecommendationsModel(options, token) {
    const localExtensions = await this.extensionsWorkbenchService.queryLocal(this.options.server);
    const localExtensionIds = localExtensions.map((e) => e.identifier.id.toLowerCase());
    const allRecommendations = distinct(
      (await Promise.all([
        // Order is important
        this.getWorkspaceRecommendations(),
        this.extensionRecommendationsService.getImportantRecommendations(),
        this.extensionRecommendationsService.getFileBasedRecommendations(),
        this.extensionRecommendationsService.getOtherRecommendations()
      ])).flat().filter((extensionId) => {
        if (isString(extensionId)) {
          return !localExtensionIds.includes(extensionId.toLowerCase());
        }
        return !localExtensions.some((localExtension) => localExtension.local && this.uriIdentityService.extUri.isEqual(localExtension.local.location, extensionId));
      })
    );
    const installableRecommendations = await this.getInstallableRecommendations(allRecommendations, { ...options, source: "recommendations-all", sortBy: void 0 }, token);
    const result = [];
    for (let i = 0; i < installableRecommendations.length && result.length < 8; i++) {
      const recommendation = allRecommendations[i];
      if (isString(recommendation)) {
        const extension = installableRecommendations.find((extension2) => areSameExtensions(extension2.identifier, { id: recommendation }));
        if (extension) {
          result.push(extension);
        }
      } else {
        const extension = installableRecommendations.find((extension2) => extension2.resourceExtension && this.uriIdentityService.extUri.isEqual(extension2.resourceExtension.location, recommendation));
        if (extension) {
          result.push(extension);
        }
      }
    }
    return new PagedModel(result);
  }
  async searchRecommendations(query, options, token) {
    const value = query.value.replace(/@recommended/g, "").trim().toLowerCase();
    const recommendations = distinct([...await this.getWorkspaceRecommendations(), ...await this.getOtherRecommendations()]);
    const installableRecommendations = (await this.getInstallableRecommendations(recommendations, { ...options, source: "recommendations", sortBy: void 0 }, token)).filter((extension) => extension.identifier.id.toLowerCase().indexOf(value) > -1);
    return new PagedModel(this.sortExtensions(installableRecommendations, options));
  }
  setModel(model, message, donotResetScrollTop) {
    if (this.list) {
      this.list.model = new DelayedPagedModel(model);
      this.updateBody(message);
      if (!donotResetScrollTop) {
        this.list.scrollTop = 0;
      }
    }
    if (this.badge) {
      this.badge.setCount(this.count());
    }
  }
  updateModel(model) {
    if (this.list) {
      this.list.model = new DelayedPagedModel(model);
      this.updateBody();
    }
    if (this.badge) {
      this.badge.setCount(this.count());
    }
  }
  updateBody(message) {
    if (this.bodyTemplate) {
      const count = this.count();
      this.bodyTemplate.extensionsList.classList.toggle("hidden", count === 0);
      this.bodyTemplate.messageContainer.classList.toggle("hidden", !message && count > 0);
      if (this.isBodyVisible()) {
        if (message) {
          this.bodyTemplate.messageSeverityIcon.className = SeverityIcon.className(message.severity);
          this.bodyTemplate.messageBox.textContent = message.text;
        } else if (this.count() === 0) {
          this.bodyTemplate.messageSeverityIcon.className = "";
          this.bodyTemplate.messageBox.textContent = localize("no extensions found", "No extensions found.");
        }
        if (this.bodyTemplate.messageBox.textContent) {
          alert(this.bodyTemplate.messageBox.textContent);
        }
      }
    }
    this.updateSize();
  }
  getMessage(error) {
    if (this.isOfflineError(error)) {
      return { text: localize("offline error", "Unable to search the Marketplace when offline, please check your network connection."), severity: Severity.Warning };
    } else {
      return { text: localize("error", "Error while fetching extensions. {0}", getErrorMessage(error)), severity: Severity.Error };
    }
  }
  isOfflineError(error) {
    if (error instanceof ExtensionGalleryError) {
      return error.code === ExtensionGalleryErrorCode.Offline;
    }
    return isOfflineError(error);
  }
  updateSize() {
    if (this.options.flexibleHeight) {
      this.maximumBodySize = this.list?.model.length ? Number.POSITIVE_INFINITY : 0;
      this.storageService.store(`${this.id}.size`, this.list?.model.length || 0, StorageScope.PROFILE, StorageTarget.MACHINE);
    }
  }
  openExtension(extension, options) {
    extension = this.extensionsWorkbenchService.local.filter((e) => areSameExtensions(e.identifier, extension.identifier))[0] || extension;
    this.extensionsWorkbenchService.open(extension, options).then(void 0, (err) => this.onError(err));
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
  dispose() {
    super.dispose();
    if (this.queryRequest) {
      this.queryRequest.request.cancel();
      this.queryRequest = null;
    }
    if (this.queryResult) {
      this.queryResult.disposables.dispose();
      this.queryResult = void 0;
    }
    this.list = null;
  }
  static isLocalExtensionsQuery(query, sortBy) {
    return this.isInstalledExtensionsQuery(query) || this.isSearchInstalledExtensionsQuery(query) || this.isOutdatedExtensionsQuery(query) || this.isEnabledExtensionsQuery(query) || this.isDisabledExtensionsQuery(query) || this.isBuiltInExtensionsQuery(query) || this.isSearchBuiltInExtensionsQuery(query) || this.isBuiltInGroupExtensionsQuery(query) || this.isSearchDeprecatedExtensionsQuery(query) || this.isSearchWorkspaceUnsupportedExtensionsQuery(query) || this.isSearchRecentlyUpdatedQuery(query) || this.isSearchExtensionUpdatesQuery(query) || this.isSortInstalledExtensionsQuery(query, sortBy) || this.isFeatureExtensionsQuery(query);
  }
  static isSearchBuiltInExtensionsQuery(query) {
    return /@builtin\s.+/i.test(query);
  }
  static isBuiltInExtensionsQuery(query) {
    return /^\s*@builtin$/i.test(query.trim());
  }
  static isBuiltInGroupExtensionsQuery(query) {
    return /^\s*@builtin:.+$/i.test(query.trim());
  }
  static isSearchWorkspaceUnsupportedExtensionsQuery(query) {
    return /^\s*@workspaceUnsupported(:(untrusted|virtual)(Partial)?)?(\s|$)/i.test(query);
  }
  static isInstalledExtensionsQuery(query) {
    return /@installed$/i.test(query);
  }
  static isSearchInstalledExtensionsQuery(query) {
    return /@installed\s./i.test(query) || this.isFeatureExtensionsQuery(query);
  }
  static isOutdatedExtensionsQuery(query) {
    return /@outdated/i.test(query);
  }
  static isEnabledExtensionsQuery(query) {
    return /@enabled/i.test(query);
  }
  static isDisabledExtensionsQuery(query) {
    return /@disabled/i.test(query);
  }
  static isSearchDeprecatedExtensionsQuery(query) {
    return /@deprecated\s?.*/i.test(query);
  }
  static isRecommendedExtensionsQuery(query) {
    return /^@recommended$/i.test(query.trim());
  }
  static isSearchRecommendedExtensionsQuery(query) {
    return /@recommended\s.+/i.test(query);
  }
  static isWorkspaceRecommendedExtensionsQuery(query) {
    return /@recommended:workspace/i.test(query);
  }
  static isExeRecommendedExtensionsQuery(query) {
    return /@exe:.+/i.test(query);
  }
  static isRemoteRecommendedExtensionsQuery(query) {
    return /@recommended:remotes/i.test(query);
  }
  static isKeymapsRecommendedExtensionsQuery(query) {
    return /@recommended:keymaps/i.test(query);
  }
  static isLanguageRecommendedExtensionsQuery(query) {
    return /@recommended:languages/i.test(query);
  }
  static isSortInstalledExtensionsQuery(query, sortBy) {
    return sortBy !== void 0 && sortBy !== "" && query === "" || !sortBy && /^@sort:\S*$/i.test(query);
  }
  static isSearchPopularQuery(query) {
    return /@popular/i.test(query);
  }
  static isSearchRecentlyPublishedQuery(query) {
    return /@recentlyPublished/i.test(query);
  }
  static isSearchRecentlyUpdatedQuery(query) {
    return /@recentlyUpdated/i.test(query);
  }
  static isSearchExtensionUpdatesQuery(query) {
    return /@updates/i.test(query);
  }
  static isSortUpdateDateQuery(query) {
    return /@sort:updateDate/i.test(query);
  }
  static isFeatureExtensionsQuery(query) {
    return /@feature:/i.test(query);
  }
  focus() {
    super.focus();
    if (!this.list) {
      return;
    }
    if (!(this.list.getFocus().length || this.list.getSelection().length)) {
      this.list.focusNext();
    }
    this.list.domFocus();
  }
};
ExtensionsListView.RECENT_UPDATE_DURATION = 7 * 24 * 60 * 60 * 1e3;
ExtensionsListView = __decorateClass([
  __decorateParam(2, INotificationService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IThemeService),
  __decorateParam(7, IExtensionService),
  __decorateParam(8, IExtensionsWorkbenchService),
  __decorateParam(9, IExtensionRecommendationsService),
  __decorateParam(10, ITelemetryService),
  __decorateParam(11, IHoverService),
  __decorateParam(12, IConfigurationService),
  __decorateParam(13, IWorkspaceContextService),
  __decorateParam(14, IExtensionManagementServerService),
  __decorateParam(15, IExtensionManifestPropertiesService),
  __decorateParam(16, IWorkbenchExtensionManagementService),
  __decorateParam(17, IWorkspaceContextService),
  __decorateParam(18, IProductService),
  __decorateParam(19, IContextKeyService),
  __decorateParam(20, IViewDescriptorService),
  __decorateParam(21, IOpenerService),
  __decorateParam(22, IPreferencesService),
  __decorateParam(23, IStorageService),
  __decorateParam(24, IWorkspaceTrustManagementService),
  __decorateParam(25, IWorkbenchExtensionEnablementService),
  __decorateParam(26, IWorkbenchLayoutService),
  __decorateParam(27, IExtensionFeaturesManagementService),
  __decorateParam(28, IUriIdentityService),
  __decorateParam(29, ILogService)
], ExtensionsListView);
class DefaultPopularExtensionsView extends ExtensionsListView {
  async show() {
    const query = this.extensionManagementServerService.webExtensionManagementServer && !this.extensionManagementServerService.localExtensionManagementServer && !this.extensionManagementServerService.remoteExtensionManagementServer ? "@web" : "";
    return super.show(query);
  }
}
class ServerInstalledExtensionsView extends ExtensionsListView {
  async show(query) {
    query = query ? query : "@installed";
    if (!ExtensionsListView.isLocalExtensionsQuery(query) || ExtensionsListView.isSortInstalledExtensionsQuery(query)) {
      query = query += " @installed";
    }
    return super.show(query.trim());
  }
}
class EnabledExtensionsView extends ExtensionsListView {
  async show(query) {
    query = query || "@enabled";
    return ExtensionsListView.isEnabledExtensionsQuery(query) ? super.show(query) : ExtensionsListView.isSortInstalledExtensionsQuery(query) ? super.show("@enabled " + query) : this.showEmptyModel();
  }
}
class DisabledExtensionsView extends ExtensionsListView {
  async show(query) {
    query = query || "@disabled";
    return ExtensionsListView.isDisabledExtensionsQuery(query) ? super.show(query) : ExtensionsListView.isSortInstalledExtensionsQuery(query) ? super.show("@disabled " + query) : this.showEmptyModel();
  }
}
class OutdatedExtensionsView extends ExtensionsListView {
  async show(query) {
    query = query ? query : "@outdated";
    if (ExtensionsListView.isSearchExtensionUpdatesQuery(query)) {
      query = query.replace("@updates", "@outdated");
    }
    return super.show(query.trim());
  }
  updateSize() {
    super.updateSize();
    this.setExpanded(this.count() > 0);
  }
}
class RecentlyUpdatedExtensionsView extends ExtensionsListView {
  async show(query) {
    query = query ? query : "@recentlyUpdated";
    if (ExtensionsListView.isSearchExtensionUpdatesQuery(query)) {
      query = query.replace("@updates", "@recentlyUpdated");
    }
    return super.show(query.trim());
  }
}
let StaticQueryExtensionsView = class extends ExtensionsListView {
  constructor(options, viewletViewOptions, notificationService, keybindingService, contextMenuService, instantiationService, themeService, extensionService, extensionsWorkbenchService, extensionRecommendationsService, telemetryService, hoverService, configurationService, contextService, extensionManagementServerService, extensionManifestPropertiesService, extensionManagementService, workspaceService, productService, contextKeyService, viewDescriptorService, openerService, preferencesService, storageService, workspaceTrustManagementService, extensionEnablementService, layoutService, extensionFeaturesManagementService, uriIdentityService, logService) {
    super(
      options,
      viewletViewOptions,
      notificationService,
      keybindingService,
      contextMenuService,
      instantiationService,
      themeService,
      extensionService,
      extensionsWorkbenchService,
      extensionRecommendationsService,
      telemetryService,
      hoverService,
      configurationService,
      contextService,
      extensionManagementServerService,
      extensionManifestPropertiesService,
      extensionManagementService,
      workspaceService,
      productService,
      contextKeyService,
      viewDescriptorService,
      openerService,
      preferencesService,
      storageService,
      workspaceTrustManagementService,
      extensionEnablementService,
      layoutService,
      extensionFeaturesManagementService,
      uriIdentityService,
      logService
    );
    this.options = options;
  }
  show() {
    return super.show(this.options.query);
  }
};
StaticQueryExtensionsView = __decorateClass([
  __decorateParam(2, INotificationService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IContextMenuService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IThemeService),
  __decorateParam(7, IExtensionService),
  __decorateParam(8, IExtensionsWorkbenchService),
  __decorateParam(9, IExtensionRecommendationsService),
  __decorateParam(10, ITelemetryService),
  __decorateParam(11, IHoverService),
  __decorateParam(12, IConfigurationService),
  __decorateParam(13, IWorkspaceContextService),
  __decorateParam(14, IExtensionManagementServerService),
  __decorateParam(15, IExtensionManifestPropertiesService),
  __decorateParam(16, IWorkbenchExtensionManagementService),
  __decorateParam(17, IWorkspaceContextService),
  __decorateParam(18, IProductService),
  __decorateParam(19, IContextKeyService),
  __decorateParam(20, IViewDescriptorService),
  __decorateParam(21, IOpenerService),
  __decorateParam(22, IPreferencesService),
  __decorateParam(23, IStorageService),
  __decorateParam(24, IWorkspaceTrustManagementService),
  __decorateParam(25, IWorkbenchExtensionEnablementService),
  __decorateParam(26, IWorkbenchLayoutService),
  __decorateParam(27, IExtensionFeaturesManagementService),
  __decorateParam(28, IUriIdentityService),
  __decorateParam(29, ILogService)
], StaticQueryExtensionsView);
function toSpecificWorkspaceUnsupportedQuery(query, qualifier) {
  if (!query) {
    return "@workspaceUnsupported:" + qualifier;
  }
  const match = query.match(new RegExp(`@workspaceUnsupported(:${qualifier})?(\\s|$)`, "i"));
  if (match) {
    if (!match[1]) {
      return query.replace(/@workspaceUnsupported/gi, "@workspaceUnsupported:" + qualifier);
    }
    return query;
  }
  return void 0;
}
class UntrustedWorkspaceUnsupportedExtensionsView extends ExtensionsListView {
  async show(query) {
    const updatedQuery = toSpecificWorkspaceUnsupportedQuery(query, "untrusted");
    return updatedQuery ? super.show(updatedQuery) : this.showEmptyModel();
  }
}
class UntrustedWorkspacePartiallySupportedExtensionsView extends ExtensionsListView {
  async show(query) {
    const updatedQuery = toSpecificWorkspaceUnsupportedQuery(query, "untrustedPartial");
    return updatedQuery ? super.show(updatedQuery) : this.showEmptyModel();
  }
}
class VirtualWorkspaceUnsupportedExtensionsView extends ExtensionsListView {
  async show(query) {
    const updatedQuery = toSpecificWorkspaceUnsupportedQuery(query, "virtual");
    return updatedQuery ? super.show(updatedQuery) : this.showEmptyModel();
  }
}
class VirtualWorkspacePartiallySupportedExtensionsView extends ExtensionsListView {
  async show(query) {
    const updatedQuery = toSpecificWorkspaceUnsupportedQuery(query, "virtualPartial");
    return updatedQuery ? super.show(updatedQuery) : this.showEmptyModel();
  }
}
class DeprecatedExtensionsView extends ExtensionsListView {
  async show(query) {
    return ExtensionsListView.isSearchDeprecatedExtensionsQuery(query) ? super.show(query) : this.showEmptyModel();
  }
}
class SearchMarketplaceExtensionsView extends ExtensionsListView {
  constructor() {
    super(...arguments);
    this.reportSearchFinishedDelayer = this._register(new ThrottledDelayer(2e3));
    this.searchWaitPromise = Promise.resolve();
  }
  async show(query) {
    const queryPromise = super.show(query);
    this.reportSearchFinishedDelayer.trigger(() => this.reportSearchFinished());
    this.searchWaitPromise = queryPromise.then(null, null);
    return queryPromise;
  }
  async reportSearchFinished() {
    await this.searchWaitPromise;
    this.telemetryService.publicLog2("extensionsView:MarketplaceSearchFinished");
  }
}
class DefaultRecommendedExtensionsView extends ExtensionsListView {
  constructor() {
    super(...arguments);
    this.recommendedExtensionsQuery = "@recommended:all";
  }
  renderBody(container) {
    super.renderBody(container);
    this._register(this.extensionRecommendationsService.onDidChangeRecommendations(() => {
      this.show("");
    }));
  }
  async show(query) {
    if (query && query.trim() !== this.recommendedExtensionsQuery) {
      return this.showEmptyModel();
    }
    const model = await super.show(this.recommendedExtensionsQuery);
    if (!this.extensionsWorkbenchService.local.some((e) => !e.isBuiltin)) {
      this.setExpanded(model.length > 0);
    }
    return model;
  }
}
class RecommendedExtensionsView extends ExtensionsListView {
  constructor() {
    super(...arguments);
    this.recommendedExtensionsQuery = "@recommended";
  }
  renderBody(container) {
    super.renderBody(container);
    this._register(this.extensionRecommendationsService.onDidChangeRecommendations(() => {
      this.show("");
    }));
  }
  async show(query) {
    return query && query.trim() !== this.recommendedExtensionsQuery ? this.showEmptyModel() : super.show(this.recommendedExtensionsQuery);
  }
}
class WorkspaceRecommendedExtensionsView extends ExtensionsListView {
  constructor() {
    super(...arguments);
    this.recommendedExtensionsQuery = "@recommended:workspace";
  }
  renderBody(container) {
    super.renderBody(container);
    this._register(this.extensionRecommendationsService.onDidChangeRecommendations(() => this.show(this.recommendedExtensionsQuery)));
    this._register(this.contextService.onDidChangeWorkbenchState(() => this.show(this.recommendedExtensionsQuery)));
  }
  async show(query) {
    const shouldShowEmptyView = query && query.trim() !== "@recommended" && query.trim() !== "@recommended:workspace";
    const model = await (shouldShowEmptyView ? this.showEmptyModel() : super.show(this.recommendedExtensionsQuery));
    this.setExpanded(model.length > 0);
    return model;
  }
  async getInstallableWorkspaceRecommendations() {
    const installed = (await this.extensionsWorkbenchService.queryLocal()).filter((l) => l.enablementState !== EnablementState.DisabledByExtensionKind);
    const recommendations = (await this.getWorkspaceRecommendations()).filter((recommendation) => installed.every((local) => isString(recommendation) ? !areSameExtensions({ id: recommendation }, local.identifier) : !this.uriIdentityService.extUri.isEqual(recommendation, local.local?.location)));
    return this.getInstallableRecommendations(recommendations, { source: "install-all-workspace-recommendations" }, CancellationToken.None);
  }
  async installWorkspaceRecommendations() {
    const installableRecommendations = await this.getInstallableWorkspaceRecommendations();
    if (installableRecommendations.length) {
      const galleryExtensions = [];
      const resourceExtensions = [];
      for (const recommendation of installableRecommendations) {
        if (recommendation.gallery) {
          galleryExtensions.push({ extension: recommendation.gallery, options: {} });
        } else {
          resourceExtensions.push(recommendation);
        }
      }
      await Promise.all([
        this.extensionManagementService.installGalleryExtensions(galleryExtensions),
        ...resourceExtensions.map((extension) => this.extensionsWorkbenchService.install(extension))
      ]);
    } else {
      this.notificationService.notify({
        severity: Severity.Info,
        message: localize("no local extensions", "There are no extensions to install.")
      });
    }
  }
}
function getAriaLabelForExtension(extension) {
  if (!extension) {
    return "";
  }
  const publisher = extension.publisherDomain?.verified ? localize("extension.arialabel.verifiedPublisher", "Verified Publisher {0}", extension.publisherDisplayName) : localize("extension.arialabel.publisher", "Publisher {0}", extension.publisherDisplayName);
  const deprecated = extension?.deprecationInfo ? localize("extension.arialabel.deprecated", "Deprecated") : "";
  const rating = extension?.rating ? localize("extension.arialabel.rating", "Rated {0} out of 5 stars by {1} users", extension.rating.toFixed(2), extension.ratingCount) : "";
  return `${extension.displayName}, ${deprecated ? `${deprecated}, ` : ""}${extension.version}, ${publisher}, ${extension.description} ${rating ? `, ${rating}` : ""}`;
}
class PreferredExtensionsPagedModel {
  constructor(preferredExtensions, pager) {
    this.preferredExtensions = preferredExtensions;
    this.pager = pager;
    this.resolved = /* @__PURE__ */ new Map();
    this.preferredGalleryExtensions = /* @__PURE__ */ new Set();
    this.resolvedGalleryExtensionsFromQuery = [];
    for (let i = 0; i < this.preferredExtensions.length; i++) {
      this.resolved.set(i, this.preferredExtensions[i]);
    }
    for (const e of preferredExtensions) {
      if (e.identifier.uuid) {
        this.preferredGalleryExtensions.add(e.identifier.uuid);
      }
    }
    this.length = preferredExtensions.length - this.preferredGalleryExtensions.size + this.pager.total;
    const totalPages = Math.ceil(this.pager.total / this.pager.pageSize);
    this.populateResolvedExtensions(0, this.pager.firstPage);
    this.pages = range(totalPages - 1).map(() => ({
      promise: null,
      cts: null,
      promiseIndexes: /* @__PURE__ */ new Set()
    }));
  }
  isResolved(index) {
    return this.resolved.has(index);
  }
  get(index) {
    return this.resolved.get(index);
  }
  async resolve(index, cancellationToken) {
    if (cancellationToken.isCancellationRequested) {
      throw new CancellationError();
    }
    if (this.isResolved(index)) {
      return this.get(index);
    }
    const indexInPagedModel = index - this.preferredExtensions.length + this.resolvedGalleryExtensionsFromQuery.length;
    const pageIndex = Math.floor(indexInPagedModel / this.pager.pageSize);
    const page = this.pages[pageIndex];
    if (!page.promise) {
      page.cts = new CancellationTokenSource();
      page.promise = this.pager.getPage(pageIndex, page.cts.token).then((extensions) => this.populateResolvedExtensions(pageIndex, extensions)).catch((e) => {
        page.promise = null;
        throw e;
      }).finally(() => page.cts = null);
    }
    const listener = cancellationToken.onCancellationRequested(() => {
      if (!page.cts) {
        return;
      }
      page.promiseIndexes.delete(index);
      if (page.promiseIndexes.size === 0) {
        page.cts.cancel();
      }
    });
    page.promiseIndexes.add(index);
    try {
      await page.promise;
    } finally {
      listener.dispose();
    }
    return this.get(index);
  }
  populateResolvedExtensions(pageIndex, extensions) {
    let adjustIndexOfNextPagesBy = 0;
    const pageStartIndex = pageIndex * this.pager.pageSize;
    for (let i = 0; i < extensions.length; i++) {
      const e = extensions[i];
      if (e.gallery?.identifier.uuid && this.preferredGalleryExtensions.has(e.gallery.identifier.uuid)) {
        this.resolvedGalleryExtensionsFromQuery.push(e);
        adjustIndexOfNextPagesBy++;
      } else {
        this.resolved.set(this.preferredExtensions.length - this.resolvedGalleryExtensionsFromQuery.length + pageStartIndex + i, e);
      }
    }
    if (pageIndex !== 0 && adjustIndexOfNextPagesBy) {
      const nextPageStartIndex = (pageIndex + 1) * this.pager.pageSize;
      const indices = [...this.resolved.keys()].sort();
      for (const index of indices) {
        if (index >= nextPageStartIndex) {
          const e = this.resolved.get(index);
          if (e) {
            this.resolved.delete(index);
            this.resolved.set(index - adjustIndexOfNextPagesBy, e);
          }
        }
      }
    }
  }
}
export {
  DefaultPopularExtensionsView,
  DefaultRecommendedExtensionsView,
  DeprecatedExtensionsView,
  DisabledExtensionsView,
  EnabledExtensionsView,
  ExtensionsListView,
  NONE_CATEGORY,
  OutdatedExtensionsView,
  PreferredExtensionsPagedModel,
  RecentlyUpdatedExtensionsView,
  RecommendedExtensionsView,
  SearchMarketplaceExtensionsView,
  ServerInstalledExtensionsView,
  StaticQueryExtensionsView,
  UntrustedWorkspacePartiallySupportedExtensionsView,
  UntrustedWorkspaceUnsupportedExtensionsView,
  VirtualWorkspacePartiallySupportedExtensionsView,
  VirtualWorkspaceUnsupportedExtensionsView,
  WorkspaceRecommendedExtensionsView,
  getAriaLabelForExtension
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2Jyb3dzZXIvZXh0ZW5zaW9uc1ZpZXdzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBpc0Rpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBFdmVudCwgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGlzQ2FuY2VsbGF0aW9uRXJyb3IsIGdldEVycm9yTWVzc2FnZSwgQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgY3JlYXRlRXJyb3JXaXRoQWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9yTWVzc2FnZS5qcyc7XG5pbXBvcnQgeyBQYWdlZE1vZGVsLCBJUGFnZWRNb2RlbCwgRGVsYXllZFBhZ2VkTW9kZWwsIElQYWdlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhZ2luZy5qcyc7XG5pbXBvcnQgeyBTb3J0T3JkZXIsIElRdWVyeU9wdGlvbnMgYXMgSUdhbGxlcnlRdWVyeU9wdGlvbnMsIFNvcnRCeSBhcyBHYWxsZXJ5U29ydEJ5LCBJbnN0YWxsRXh0ZW5zaW9uSW5mbywgRXh0ZW5zaW9uR2FsbGVyeUVycm9yQ29kZSwgRXh0ZW5zaW9uR2FsbGVyeUVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciwgSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLCBFbmFibGVtZW50U3RhdGUsIElXb3JrYmVuY2hFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSwgSVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvblJlY29tbWVuZGF0aW9ucy9jb21tb24vZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zLmpzJztcbmltcG9ydCB7IGFyZVNhbWVFeHRlbnNpb25zLCBnZXRFeHRlbnNpb25EZXBlbmRlbmNpZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50VXRpbC5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IGFwcGVuZCwgJCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBEZWxlZ2F0ZSwgUmVuZGVyZXIgfSBmcm9tICcuL2V4dGVuc2lvbnNMaXN0LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblJlc3VsdHNMaXN0Rm9jdXNlZCwgRXh0ZW5zaW9uU3RhdGUsIElFeHRlbnNpb24sIElFeHRlbnNpb25zVmlld1N0YXRlLCBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsIElXb3Jrc3BhY2VSZWNvbW1lbmRlZEV4dGVuc2lvbnNWaWV3IH0gZnJvbSAnLi4vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgUXVlcnkgfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9uUXVlcnkuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UsIHRvRXh0ZW5zaW9uIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVmlld2xldFZpZXdPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3c1ZpZXdsZXQuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBDb3VudEJhZGdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2NvdW50QmFkZ2UvY291bnRCYWRnZS5qcyc7XG5pbXBvcnQgeyBNYW5hZ2VFeHRlbnNpb25BY3Rpb24sIGdldENvbnRleHRNZW51QWN0aW9ucywgRXh0ZW5zaW9uQWN0aW9uIH0gZnJvbSAnLi9leHRlbnNpb25zQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hQYWdlZExpc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBWaWV3UGFuZSwgSVZpZXdQYW5lT3B0aW9ucywgVmlld1BhbmVTaG93QWN0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmUuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgY29hbGVzY2UsIGRpc3RpbmN0LCByYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBhbGVydCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hcmlhL2FyaWEuanMnO1xuaW1wb3J0IHsgSUxpc3RDb250ZXh0TWVudUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSUFjdGlvbiwgQWN0aW9uLCBTZXBhcmF0b3IsIEFjdGlvblJ1bm5lciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciwgRXh0ZW5zaW9uSWRlbnRpZmllck1hcCwgRXh0ZW5zaW9uVW50cnVzdGVkV29ya3NwYWNlU3VwcG9ydFR5cGUsIEV4dGVuc2lvblZpcnR1YWxXb3Jrc3BhY2VTdXBwb3J0VHlwZSwgSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBJRXh0ZW5zaW9uSWRlbnRpZmllciwgaXNMYW5ndWFnZVBhY2tFeHRlbnNpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IENhbmNlbGFibGVQcm9taXNlLCBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSwgVGhyb3R0bGVkRGVsYXllciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFNldmVyaXR5SWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zZXZlcml0eUljb24vc2V2ZXJpdHlJY29uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSVZpZXdEZXNjcmlwdG9yU2VydmljZSwgVmlld0NvbnRhaW5lckxvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSVByZWZlcmVuY2VzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ByZWZlcmVuY2VzL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGlzVmlydHVhbFdvcmtzcGFjZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vdmlydHVhbFdvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlVHJ1c3QuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaExheW91dFNlcnZpY2UsIFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBIb3ZlclBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyV2lkZ2V0LmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgaXNPZmZsaW5lRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3BhcnRzL3JlcXVlc3QvY29tbW9uL3JlcXVlc3QuanMnO1xuaW1wb3J0IHsgZGVmYXVsdENvdW50QmFkZ2VTdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucywgSUV4dGVuc2lvbkZlYXR1cmVSZW5kZXJlciwgSUV4dGVuc2lvbkZlYXR1cmVzTWFuYWdlbWVudFNlcnZpY2UsIElFeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGlzU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5cbmV4cG9ydCBjb25zdCBOT05FX0NBVEVHT1JZID0gJ25vbmUnO1xuXG50eXBlIE1lc3NhZ2UgPSB7XG5cdHJlYWRvbmx5IHRleHQ6IHN0cmluZztcblx0cmVhZG9ubHkgc2V2ZXJpdHk6IFNldmVyaXR5O1xufTtcblxuY2xhc3MgRXh0ZW5zaW9uc1ZpZXdTdGF0ZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRXh0ZW5zaW9uc1ZpZXdTdGF0ZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25Gb2N1czogRW1pdHRlcjxJRXh0ZW5zaW9uPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElFeHRlbnNpb24+KCkpO1xuXHRyZWFkb25seSBvbkZvY3VzOiBFdmVudDxJRXh0ZW5zaW9uPiA9IHRoaXMuX29uRm9jdXMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25CbHVyOiBFbWl0dGVyPElFeHRlbnNpb24+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUV4dGVuc2lvbj4oKSk7XG5cdHJlYWRvbmx5IG9uQmx1cjogRXZlbnQ8SUV4dGVuc2lvbj4gPSB0aGlzLl9vbkJsdXIuZXZlbnQ7XG5cblx0cHJpdmF0ZSBjdXJyZW50bHlGb2N1c2VkSXRlbXM6IElFeHRlbnNpb25bXSA9IFtdO1xuXG5cdGZpbHRlcnM6IHtcblx0XHRmZWF0dXJlSWQ/OiBzdHJpbmc7XG5cdH0gPSB7fTtcblxuXHRvbkZvY3VzQ2hhbmdlKGV4dGVuc2lvbnM6IElFeHRlbnNpb25bXSk6IHZvaWQge1xuXHRcdHRoaXMuY3VycmVudGx5Rm9jdXNlZEl0ZW1zLmZvckVhY2goZXh0ZW5zaW9uID0+IHRoaXMuX29uQmx1ci5maXJlKGV4dGVuc2lvbikpO1xuXHRcdHRoaXMuY3VycmVudGx5Rm9jdXNlZEl0ZW1zID0gZXh0ZW5zaW9ucztcblx0XHR0aGlzLmN1cnJlbnRseUZvY3VzZWRJdGVtcy5mb3JFYWNoKGV4dGVuc2lvbiA9PiB0aGlzLl9vbkZvY3VzLmZpcmUoZXh0ZW5zaW9uKSk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBFeHRlbnNpb25zTGlzdFZpZXdPcHRpb25zIHtcblx0c2VydmVyPzogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXI7XG5cdGZsZXhpYmxlSGVpZ2h0PzogYm9vbGVhbjtcblx0b25EaWRDaGFuZ2VUaXRsZT86IEV2ZW50PHN0cmluZz47XG5cdGhpZGVCYWRnZT86IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBJUXVlcnlSZXN1bHQge1xuXHRtb2RlbDogSVBhZ2VkTW9kZWw8SUV4dGVuc2lvbj47XG5cdGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZU1vZGVsPzogRXZlbnQ8SVBhZ2VkTW9kZWw8SUV4dGVuc2lvbj4+O1xuXHRyZWFkb25seSBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xufVxuXG5jb25zdCBlbnVtIExvY2FsU29ydEJ5IHtcblx0VXBkYXRlRGF0ZSA9ICdVcGRhdGVEYXRlJyxcbn1cblxuZnVuY3Rpb24gaXNMb2NhbFNvcnRCeSh2YWx1ZTogYW55KTogdmFsdWUgaXMgTG9jYWxTb3J0Qnkge1xuXHRzd2l0Y2ggKHZhbHVlIGFzIExvY2FsU29ydEJ5KSB7XG5cdFx0Y2FzZSBMb2NhbFNvcnRCeS5VcGRhdGVEYXRlOiByZXR1cm4gdHJ1ZTtcblx0fVxufVxuXG50eXBlIFNvcnRCeSA9IExvY2FsU29ydEJ5IHwgR2FsbGVyeVNvcnRCeTtcbnR5cGUgSVF1ZXJ5T3B0aW9ucyA9IE9taXQ8SUdhbGxlcnlRdWVyeU9wdGlvbnMsICdzb3J0QnknPiAmIHsgc29ydEJ5PzogU29ydEJ5IH07XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25zTGlzdFZpZXcgZXh0ZW5kcyBWaWV3UGFuZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgUkVDRU5UX1VQREFURV9EVVJBVElPTiA9IDcgKiAyNCAqIDYwICogNjAgKiAxMDAwOyAvLyA3IGRheXNcblxuXHRwcml2YXRlIGJvZHlUZW1wbGF0ZToge1xuXHRcdG1lc3NhZ2VDb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRcdG1lc3NhZ2VTZXZlcml0eUljb246IEhUTUxFbGVtZW50O1xuXHRcdG1lc3NhZ2VCb3g6IEhUTUxFbGVtZW50O1xuXHRcdGV4dGVuc2lvbnNMaXN0OiBIVE1MRWxlbWVudDtcblx0fSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBiYWRnZTogQ291bnRCYWRnZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBsaXN0OiBXb3JrYmVuY2hQYWdlZExpc3Q8SUV4dGVuc2lvbj4gfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBxdWVyeVJlcXVlc3Q6IHsgcXVlcnk6IHN0cmluZzsgcmVxdWVzdDogQ2FuY2VsYWJsZVByb21pc2U8SVBhZ2VkTW9kZWw8SUV4dGVuc2lvbj4+IH0gfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBxdWVyeVJlc3VsdDogSVF1ZXJ5UmVzdWx0IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGV4dGVuc2lvbnNWaWV3U3RhdGU6IEV4dGVuc2lvbnNWaWV3U3RhdGUgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBjb250ZXh0TWVudUFjdGlvblJ1bm5lciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBBY3Rpb25SdW5uZXIoKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IG9wdGlvbnM6IEV4dGVuc2lvbnNMaXN0Vmlld09wdGlvbnMsXG5cdFx0dmlld2xldFZpZXdPcHRpb25zOiBJVmlld2xldFZpZXdPcHRpb25zLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcm90ZWN0ZWQgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJvdGVjdGVkIGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlOiBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlIHByb3RlY3RlZCBleHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlOiBJRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcm90ZWN0ZWQgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBleHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2U6IElFeHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgd29ya3NwYWNlU2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElQcmVmZXJlbmNlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcmVmZXJlbmNlc1NlcnZpY2U6IElQcmVmZXJlbmNlc1NlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZTogSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGF5b3V0U2VydmljZTogSVdvcmtiZW5jaExheW91dFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uRmVhdHVyZXNNYW5hZ2VtZW50U2VydmljZTogSUV4dGVuc2lvbkZlYXR1cmVzTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcih7XG5cdFx0XHQuLi4odmlld2xldFZpZXdPcHRpb25zIGFzIElWaWV3UGFuZU9wdGlvbnMpLFxuXHRcdFx0c2hvd0FjdGlvbnM6IFZpZXdQYW5lU2hvd0FjdGlvbnMuQWx3YXlzLFxuXHRcdFx0bWF4aW11bUJvZHlTaXplOiBvcHRpb25zLmZsZXhpYmxlSGVpZ2h0ID8gKHN0b3JhZ2VTZXJ2aWNlLmdldE51bWJlcihgJHt2aWV3bGV0Vmlld09wdGlvbnMuaWR9LnNpemVgLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgMCkgPyB1bmRlZmluZWQgOiAwKSA6IHVuZGVmaW5lZFxuXHRcdH0sIGtleWJpbmRpbmdTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgb3BlbmVyU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBob3ZlclNlcnZpY2UpO1xuXHRcdGlmICh0aGlzLm9wdGlvbnMub25EaWRDaGFuZ2VUaXRsZSkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vcHRpb25zLm9uRGlkQ2hhbmdlVGl0bGUodGl0bGUgPT4gdGhpcy51cGRhdGVUaXRsZSh0aXRsZSkpKTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbnRleHRNZW51QWN0aW9uUnVubmVyLm9uRGlkUnVuKCh7IGVycm9yIH0pID0+IGVycm9yICYmIHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihlcnJvcikpKTtcblx0XHR0aGlzLnJlZ2lzdGVyQWN0aW9ucygpO1xuXHR9XG5cblx0cHJvdGVjdGVkIHJlZ2lzdGVyQWN0aW9ucygpOiB2b2lkIHsgfVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSByZW5kZXJIZWFkZXIoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdleHRlbnNpb24tdmlldy1oZWFkZXInKTtcblx0XHRzdXBlci5yZW5kZXJIZWFkZXIoY29udGFpbmVyKTtcblxuXHRcdGlmICghdGhpcy5vcHRpb25zLmhpZGVCYWRnZSkge1xuXHRcdFx0dGhpcy5iYWRnZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBDb3VudEJhZGdlKGFwcGVuZChjb250YWluZXIsICQoJy5jb3VudC1iYWRnZS13cmFwcGVyJykpLCB7fSwgZGVmYXVsdENvdW50QmFkZ2VTdHlsZXMpKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVuZGVyQm9keShjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyQm9keShjb250YWluZXIpO1xuXG5cdFx0Y29uc3QgbWVzc2FnZUNvbnRhaW5lciA9IGFwcGVuZChjb250YWluZXIsICQoJy5tZXNzYWdlLWNvbnRhaW5lcicpKTtcblx0XHRjb25zdCBtZXNzYWdlU2V2ZXJpdHlJY29uID0gYXBwZW5kKG1lc3NhZ2VDb250YWluZXIsICQoJycpKTtcblx0XHRjb25zdCBtZXNzYWdlQm94ID0gYXBwZW5kKG1lc3NhZ2VDb250YWluZXIsICQoJy5tZXNzYWdlJykpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbnNMaXN0ID0gYXBwZW5kKGNvbnRhaW5lciwgJCgnLmV4dGVuc2lvbnMtbGlzdCcpKTtcblx0XHRjb25zdCBkZWxlZ2F0ZSA9IG5ldyBEZWxlZ2F0ZSgpO1xuXHRcdHRoaXMuZXh0ZW5zaW9uc1ZpZXdTdGF0ZSA9IG5ldyBFeHRlbnNpb25zVmlld1N0YXRlKCk7XG5cdFx0Y29uc3QgcmVuZGVyZXIgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlbmRlcmVyLCB0aGlzLmV4dGVuc2lvbnNWaWV3U3RhdGUsIHtcblx0XHRcdGhvdmVyT3B0aW9uczoge1xuXHRcdFx0XHRwb3NpdGlvbjogKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHZpZXdMb2NhdGlvbiA9IHRoaXMudmlld0Rlc2NyaXB0b3JTZXJ2aWNlLmdldFZpZXdMb2NhdGlvbkJ5SWQodGhpcy5pZCk7XG5cdFx0XHRcdFx0aWYgKHZpZXdMb2NhdGlvbiA9PT0gVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLmxheW91dFNlcnZpY2UuZ2V0U2lkZUJhclBvc2l0aW9uKCkgPT09IFBvc2l0aW9uLkxFRlQgPyBIb3ZlclBvc2l0aW9uLlJJR0hUIDogSG92ZXJQb3NpdGlvbi5MRUZUO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAodmlld0xvY2F0aW9uID09PSBWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5sYXlvdXRTZXJ2aWNlLmdldFNpZGVCYXJQb3NpdGlvbigpID09PSBQb3NpdGlvbi5MRUZUID8gSG92ZXJQb3NpdGlvbi5MRUZUIDogSG92ZXJQb3NpdGlvbi5SSUdIVDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIEhvdmVyUG9zaXRpb24uUklHSFQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLmxpc3QgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdvcmtiZW5jaFBhZ2VkTGlzdCwgJ0V4dGVuc2lvbnMnLCBleHRlbnNpb25zTGlzdCwgZGVsZWdhdGUsIFtyZW5kZXJlcl0sIHtcblx0XHRcdG11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRzZXRSb3dMaW5lSGVpZ2h0OiBmYWxzZSxcblx0XHRcdGhvcml6b250YWxTY3JvbGxpbmc6IGZhbHNlLFxuXHRcdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyOiB7XG5cdFx0XHRcdGdldEFyaWFMYWJlbChleHRlbnNpb246IElFeHRlbnNpb24gfCBudWxsKTogc3RyaW5nIHtcblx0XHRcdFx0XHRyZXR1cm4gZ2V0QXJpYUxhYmVsRm9yRXh0ZW5zaW9uKGV4dGVuc2lvbik7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldFdpZGdldEFyaWFMYWJlbCgpOiBzdHJpbmcge1xuXHRcdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgnZXh0ZW5zaW9ucycsIFwiRXh0ZW5zaW9uc1wiKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdG92ZXJyaWRlU3R5bGVzOiB0aGlzLmdldExvY2F0aW9uQmFzZWRDb2xvcnMoKS5saXN0T3ZlcnJpZGVTdHlsZXMsXG5cdFx0XHRvcGVuT25TaW5nbGVDbGljazogdHJ1ZVxuXHRcdH0pIGFzIFdvcmtiZW5jaFBhZ2VkTGlzdDxJRXh0ZW5zaW9uPjtcblx0XHRFeHRlbnNpb25SZXN1bHRzTGlzdEZvY3VzZWQuYmluZFRvKHRoaXMubGlzdC5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5saXN0Lm9uQ29udGV4dE1lbnUoZSA9PiB0aGlzLm9uQ29udGV4dE1lbnUoZSksIHRoaXMpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmxpc3Qub25EaWRDaGFuZ2VGb2N1cyhlID0+IHRoaXMuZXh0ZW5zaW9uc1ZpZXdTdGF0ZT8ub25Gb2N1c0NoYW5nZShjb2FsZXNjZShlLmVsZW1lbnRzKSksIHRoaXMpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmxpc3QpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZXh0ZW5zaW9uc1ZpZXdTdGF0ZSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5kZWJvdW5jZShFdmVudC5maWx0ZXIodGhpcy5saXN0Lm9uRGlkT3BlbiwgZSA9PiBlLmVsZW1lbnQgIT09IG51bGwpLCAoXywgZXZlbnQpID0+IGV2ZW50LCA3NSwgdHJ1ZSkob3B0aW9ucyA9PiB7XG5cdFx0XHR0aGlzLm9wZW5FeHRlbnNpb24ob3B0aW9ucy5lbGVtZW50ISwgeyBzaWRlQnlzaWRlOiBvcHRpb25zLnNpZGVCeVNpZGUsIC4uLm9wdGlvbnMuZWRpdG9yT3B0aW9ucyB9KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLmJvZHlUZW1wbGF0ZSA9IHtcblx0XHRcdGV4dGVuc2lvbnNMaXN0LFxuXHRcdFx0bWVzc2FnZUJveCxcblx0XHRcdG1lc3NhZ2VDb250YWluZXIsXG5cdFx0XHRtZXNzYWdlU2V2ZXJpdHlJY29uXG5cdFx0fTtcblxuXHRcdGlmICh0aGlzLnF1ZXJ5UmVzdWx0KSB7XG5cdFx0XHR0aGlzLnNldE1vZGVsKHRoaXMucXVlcnlSZXN1bHQubW9kZWwpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBsYXlvdXRCb2R5KGhlaWdodDogbnVtYmVyLCB3aWR0aDogbnVtYmVyKTogdm9pZCB7XG5cdFx0c3VwZXIubGF5b3V0Qm9keShoZWlnaHQsIHdpZHRoKTtcblx0XHRpZiAodGhpcy5ib2R5VGVtcGxhdGUpIHtcblx0XHRcdHRoaXMuYm9keVRlbXBsYXRlLmV4dGVuc2lvbnNMaXN0LnN0eWxlLmhlaWdodCA9IGhlaWdodCArICdweCc7XG5cdFx0fVxuXHRcdHRoaXMubGlzdD8ubGF5b3V0KGhlaWdodCwgd2lkdGgpO1xuXHR9XG5cblx0YXN5bmMgc2hvdyhxdWVyeTogc3RyaW5nLCByZWZyZXNoPzogYm9vbGVhbik6IFByb21pc2U8SVBhZ2VkTW9kZWw8SUV4dGVuc2lvbj4+IHtcblx0XHRpZiAodGhpcy5xdWVyeVJlcXVlc3QpIHtcblx0XHRcdGlmICghcmVmcmVzaCAmJiB0aGlzLnF1ZXJ5UmVxdWVzdC5xdWVyeSA9PT0gcXVlcnkpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMucXVlcnlSZXF1ZXN0LnJlcXVlc3Q7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnF1ZXJ5UmVxdWVzdC5yZXF1ZXN0LmNhbmNlbCgpO1xuXHRcdFx0dGhpcy5xdWVyeVJlcXVlc3QgPSBudWxsO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnF1ZXJ5UmVzdWx0KSB7XG5cdFx0XHR0aGlzLnF1ZXJ5UmVzdWx0LmRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMucXVlcnlSZXN1bHQgPSB1bmRlZmluZWQ7XG5cdFx0XHRpZiAodGhpcy5leHRlbnNpb25zVmlld1N0YXRlKSB7XG5cdFx0XHRcdHRoaXMuZXh0ZW5zaW9uc1ZpZXdTdGF0ZS5maWx0ZXJzID0ge307XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGFyc2VkUXVlcnkgPSBRdWVyeS5wYXJzZShxdWVyeSk7XG5cblx0XHRjb25zdCBvcHRpb25zOiBJUXVlcnlPcHRpb25zID0ge1xuXHRcdFx0c29ydE9yZGVyOiBTb3J0T3JkZXIuRGVmYXVsdFxuXHRcdH07XG5cblx0XHRzd2l0Y2ggKHBhcnNlZFF1ZXJ5LnNvcnRCeSkge1xuXHRcdFx0Y2FzZSAnaW5zdGFsbHMnOiBvcHRpb25zLnNvcnRCeSA9IEdhbGxlcnlTb3J0QnkuSW5zdGFsbENvdW50OyBicmVhaztcblx0XHRcdGNhc2UgJ3JhdGluZyc6IG9wdGlvbnMuc29ydEJ5ID0gR2FsbGVyeVNvcnRCeS5XZWlnaHRlZFJhdGluZzsgYnJlYWs7XG5cdFx0XHRjYXNlICduYW1lJzogb3B0aW9ucy5zb3J0QnkgPSBHYWxsZXJ5U29ydEJ5LlRpdGxlOyBicmVhaztcblx0XHRcdGNhc2UgJ3B1Ymxpc2hlZERhdGUnOiBvcHRpb25zLnNvcnRCeSA9IEdhbGxlcnlTb3J0QnkuUHVibGlzaGVkRGF0ZTsgYnJlYWs7XG5cdFx0XHRjYXNlICd1cGRhdGVEYXRlJzogb3B0aW9ucy5zb3J0QnkgPSBMb2NhbFNvcnRCeS5VcGRhdGVEYXRlOyBicmVhaztcblx0XHR9XG5cblx0XHRjb25zdCByZXF1ZXN0ID0gY3JlYXRlQ2FuY2VsYWJsZVByb21pc2UoYXN5bmMgdG9rZW4gPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhpcy5xdWVyeVJlc3VsdCA9IGF3YWl0IHRoaXMucXVlcnkocGFyc2VkUXVlcnksIG9wdGlvbnMsIHRva2VuKTtcblx0XHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLnF1ZXJ5UmVzdWx0Lm1vZGVsO1xuXHRcdFx0XHR0aGlzLnNldE1vZGVsKG1vZGVsLCB0aGlzLnF1ZXJ5UmVzdWx0LmRlc2NyaXB0aW9uID8geyB0ZXh0OiB0aGlzLnF1ZXJ5UmVzdWx0LmRlc2NyaXB0aW9uLCBzZXZlcml0eTogU2V2ZXJpdHkuSW5mbyB9IDogdW5kZWZpbmVkKTtcblx0XHRcdFx0aWYgKHRoaXMucXVlcnlSZXN1bHQub25EaWRDaGFuZ2VNb2RlbCkge1xuXHRcdFx0XHRcdHRoaXMucXVlcnlSZXN1bHQuZGlzcG9zYWJsZXMuYWRkKHRoaXMucXVlcnlSZXN1bHQub25EaWRDaGFuZ2VNb2RlbChtb2RlbCA9PiB7XG5cdFx0XHRcdFx0XHRpZiAodGhpcy5xdWVyeVJlc3VsdCkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLnF1ZXJ5UmVzdWx0Lm1vZGVsID0gbW9kZWw7XG5cdFx0XHRcdFx0XHRcdHRoaXMudXBkYXRlTW9kZWwobW9kZWwpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbW9kZWw7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gbmV3IFBhZ2VkTW9kZWwoW10pO1xuXHRcdFx0XHRpZiAoIWlzQ2FuY2VsbGF0aW9uRXJyb3IoZSkpIHtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZSk7XG5cdFx0XHRcdFx0dGhpcy5zZXRNb2RlbChtb2RlbCwgdGhpcy5nZXRNZXNzYWdlKGUpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdGhpcy5saXN0ID8gdGhpcy5saXN0Lm1vZGVsIDogbW9kZWw7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXF1ZXN0LmZpbmFsbHkoKCkgPT4gdGhpcy5xdWVyeVJlcXVlc3QgPSBudWxsKTtcblx0XHR0aGlzLnF1ZXJ5UmVxdWVzdCA9IHsgcXVlcnksIHJlcXVlc3QgfTtcblx0XHRyZXR1cm4gcmVxdWVzdDtcblx0fVxuXG5cdGNvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMucXVlcnlSZXN1bHQ/Lm1vZGVsLmxlbmd0aCA/PyAwO1xuXHR9XG5cblx0cHJvdGVjdGVkIHNob3dFbXB0eU1vZGVsKCk6IFByb21pc2U8SVBhZ2VkTW9kZWw8SUV4dGVuc2lvbj4+IHtcblx0XHRjb25zdCBlbXB0eU1vZGVsID0gbmV3IFBhZ2VkTW9kZWwoW10pO1xuXHRcdHRoaXMuc2V0TW9kZWwoZW1wdHlNb2RlbCk7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShlbXB0eU1vZGVsKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb25Db250ZXh0TWVudShlOiBJTGlzdENvbnRleHRNZW51RXZlbnQ8SUV4dGVuc2lvbj4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoZS5lbGVtZW50KSB7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdGNvbnN0IG1hbmFnZUV4dGVuc2lvbkFjdGlvbiA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1hbmFnZUV4dGVuc2lvbkFjdGlvbikpO1xuXHRcdFx0Y29uc3QgZXh0ZW5zaW9uID0gZS5lbGVtZW50ID8gdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5sb2NhbC5maW5kKGxvY2FsID0+IGFyZVNhbWVFeHRlbnNpb25zKGxvY2FsLmlkZW50aWZpZXIsIGUuZWxlbWVudCEuaWRlbnRpZmllcikgJiYgKCFlLmVsZW1lbnQhLnNlcnZlciB8fCBlLmVsZW1lbnQhLnNlcnZlciA9PT0gbG9jYWwuc2VydmVyKSkgfHwgZS5lbGVtZW50XG5cdFx0XHRcdDogZS5lbGVtZW50O1xuXHRcdFx0bWFuYWdlRXh0ZW5zaW9uQWN0aW9uLmV4dGVuc2lvbiA9IGV4dGVuc2lvbjtcblx0XHRcdGxldCBncm91cHM6IElBY3Rpb25bXVtdID0gW107XG5cdFx0XHRpZiAobWFuYWdlRXh0ZW5zaW9uQWN0aW9uLmVuYWJsZWQpIHtcblx0XHRcdFx0Z3JvdXBzID0gYXdhaXQgbWFuYWdlRXh0ZW5zaW9uQWN0aW9uLmdldEFjdGlvbkdyb3VwcygpO1xuXHRcdFx0fSBlbHNlIGlmIChleHRlbnNpb24pIHtcblx0XHRcdFx0Z3JvdXBzID0gYXdhaXQgZ2V0Q29udGV4dE1lbnVBY3Rpb25zKGV4dGVuc2lvbiwgdGhpcy5jb250ZXh0S2V5U2VydmljZSwgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0XHRcdGdyb3Vwcy5mb3JFYWNoKGdyb3VwID0+IGdyb3VwLmZvckVhY2goZXh0ZW5zaW9uQWN0aW9uID0+IHtcblx0XHRcdFx0XHRpZiAoZXh0ZW5zaW9uQWN0aW9uIGluc3RhbmNlb2YgRXh0ZW5zaW9uQWN0aW9uKSB7XG5cdFx0XHRcdFx0XHRleHRlbnNpb25BY3Rpb24uZXh0ZW5zaW9uID0gZXh0ZW5zaW9uO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgYWN0aW9uczogSUFjdGlvbltdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IG1lbnVBY3Rpb25zIG9mIGdyb3Vwcykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IG1lbnVBY3Rpb24gb2YgbWVudUFjdGlvbnMpIHtcblx0XHRcdFx0XHRhY3Rpb25zLnB1c2gobWVudUFjdGlvbik7XG5cdFx0XHRcdFx0aWYgKGlzRGlzcG9zYWJsZShtZW51QWN0aW9uKSkge1xuXHRcdFx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKG1lbnVBY3Rpb24pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRhY3Rpb25zLnB1c2gobmV3IFNlcGFyYXRvcigpKTtcblx0XHRcdH1cblx0XHRcdGFjdGlvbnMucG9wKCk7XG5cdFx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0XHRnZXRBbmNob3I6ICgpID0+IGUuYW5jaG9yLFxuXHRcdFx0XHRnZXRBY3Rpb25zOiAoKSA9PiBhY3Rpb25zLFxuXHRcdFx0XHRhY3Rpb25SdW5uZXI6IHRoaXMuY29udGV4dE1lbnVBY3Rpb25SdW5uZXIsXG5cdFx0XHRcdG9uSGlkZTogKCkgPT4gZGlzcG9zYWJsZXMuZGlzcG9zZSgpXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHF1ZXJ5KHF1ZXJ5OiBRdWVyeSwgb3B0aW9uczogSVF1ZXJ5T3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJUXVlcnlSZXN1bHQ+IHtcblx0XHRjb25zdCBpZFJlZ2V4ID0gL0BpZDooKFthLXowLTlBLVpdW2EtejAtOVxcLUEtWl0qKVxcLihbYS16MC05QS1aXVthLXowLTlcXC1BLVpdKikpL2c7XG5cdFx0Y29uc3QgaWRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGxldCBpZE1hdGNoO1xuXHRcdHdoaWxlICgoaWRNYXRjaCA9IGlkUmVnZXguZXhlYyhxdWVyeS52YWx1ZSkpICE9PSBudWxsKSB7XG5cdFx0XHRjb25zdCBuYW1lID0gaWRNYXRjaFsxXTtcblx0XHRcdGlkcy5wdXNoKG5hbWUpO1xuXHRcdH1cblx0XHRpZiAoaWRzLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCB0aGlzLnF1ZXJ5QnlJZHMoaWRzLCBvcHRpb25zLCB0b2tlbik7XG5cdFx0XHRyZXR1cm4geyBtb2RlbCwgZGlzcG9zYWJsZXM6IG5ldyBEaXNwb3NhYmxlU3RvcmUoKSB9O1xuXHRcdH1cblxuXHRcdGlmIChFeHRlbnNpb25zTGlzdFZpZXcuaXNMb2NhbEV4dGVuc2lvbnNRdWVyeShxdWVyeS52YWx1ZSwgcXVlcnkuc29ydEJ5KSkge1xuXHRcdFx0cmV0dXJuIHRoaXMucXVlcnlMb2NhbChxdWVyeSwgb3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0aWYgKEV4dGVuc2lvbnNMaXN0Vmlldy5pc1NlYXJjaFBvcHVsYXJRdWVyeShxdWVyeS52YWx1ZSkpIHtcblx0XHRcdHF1ZXJ5LnZhbHVlID0gcXVlcnkudmFsdWUucmVwbGFjZSgnQHBvcHVsYXInLCAnJyk7XG5cdFx0XHRvcHRpb25zLnNvcnRCeSA9ICFvcHRpb25zLnNvcnRCeSA/IEdhbGxlcnlTb3J0QnkuSW5zdGFsbENvdW50IDogb3B0aW9ucy5zb3J0Qnk7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKEV4dGVuc2lvbnNMaXN0Vmlldy5pc1NlYXJjaFJlY2VudGx5UHVibGlzaGVkUXVlcnkocXVlcnkudmFsdWUpKSB7XG5cdFx0XHRxdWVyeS52YWx1ZSA9IHF1ZXJ5LnZhbHVlLnJlcGxhY2UoJ0ByZWNlbnRseVB1Ymxpc2hlZCcsICcnKTtcblx0XHRcdG9wdGlvbnMuc29ydEJ5ID0gIW9wdGlvbnMuc29ydEJ5ID8gR2FsbGVyeVNvcnRCeS5QdWJsaXNoZWREYXRlIDogb3B0aW9ucy5zb3J0Qnk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZ2FsbGVyeVF1ZXJ5T3B0aW9uczogSUdhbGxlcnlRdWVyeU9wdGlvbnMgPSB7IC4uLm9wdGlvbnMsIHNvcnRCeTogaXNMb2NhbFNvcnRCeShvcHRpb25zLnNvcnRCeSkgPyB1bmRlZmluZWQgOiBvcHRpb25zLnNvcnRCeSB9O1xuXHRcdGNvbnN0IG1vZGVsID0gYXdhaXQgdGhpcy5xdWVyeUdhbGxlcnkocXVlcnksIGdhbGxlcnlRdWVyeU9wdGlvbnMsIHRva2VuKTtcblx0XHRyZXR1cm4geyBtb2RlbCwgZGlzcG9zYWJsZXM6IG5ldyBEaXNwb3NhYmxlU3RvcmUoKSB9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBxdWVyeUJ5SWRzKGlkczogc3RyaW5nW10sIG9wdGlvbnM6IElRdWVyeU9wdGlvbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVBhZ2VkTW9kZWw8SUV4dGVuc2lvbj4+IHtcblx0XHRjb25zdCBpZHNTZXQ6IFNldDxzdHJpbmc+ID0gaWRzLnJlZHVjZSgocmVzdWx0LCBpZCkgPT4geyByZXN1bHQuYWRkKGlkLnRvTG93ZXJDYXNlKCkpOyByZXR1cm4gcmVzdWx0OyB9LCBuZXcgU2V0PHN0cmluZz4oKSk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gKGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UucXVlcnlMb2NhbCh0aGlzLm9wdGlvbnMuc2VydmVyKSlcblx0XHRcdC5maWx0ZXIoZSA9PiBpZHNTZXQuaGFzKGUuaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpKSk7XG5cblx0XHRjb25zdCBnYWxsZXJ5SWRzID0gcmVzdWx0Lmxlbmd0aCA/IGlkcy5maWx0ZXIoaWQgPT4gcmVzdWx0LmV2ZXJ5KHIgPT4gIWFyZVNhbWVFeHRlbnNpb25zKHIuaWRlbnRpZmllciwgeyBpZCB9KSkpIDogaWRzO1xuXG5cdFx0aWYgKGdhbGxlcnlJZHMubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBnYWxsZXJ5UmVzdWx0ID0gYXdhaXQgdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5nZXRFeHRlbnNpb25zKGdhbGxlcnlJZHMubWFwKGlkID0+ICh7IGlkIH0pKSwgeyBzb3VyY2U6ICdxdWVyeUJ5SWQnIH0sIHRva2VuKTtcblx0XHRcdHJlc3VsdC5wdXNoKC4uLmdhbGxlcnlSZXN1bHQpO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgUGFnZWRNb2RlbChyZXN1bHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBxdWVyeUxvY2FsKHF1ZXJ5OiBRdWVyeSwgb3B0aW9uczogSVF1ZXJ5T3B0aW9ucyk6IFByb21pc2U8SVF1ZXJ5UmVzdWx0PiB7XG5cdFx0Y29uc3QgbG9jYWwgPSBhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnF1ZXJ5TG9jYWwodGhpcy5vcHRpb25zLnNlcnZlcik7XG5cdFx0bGV0IHsgZXh0ZW5zaW9ucywgY2FuSW5jbHVkZUluc3RhbGxlZEV4dGVuc2lvbnMsIGRlc2NyaXB0aW9uIH0gPSBhd2FpdCB0aGlzLmZpbHRlckxvY2FsKGxvY2FsLCB0aGlzLmV4dGVuc2lvblNlcnZpY2UuZXh0ZW5zaW9ucywgcXVlcnksIG9wdGlvbnMpO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IG9uRGlkQ2hhbmdlTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEVtaXR0ZXI8SVBhZ2VkTW9kZWw8SUV4dGVuc2lvbj4+KCkpO1xuXG5cdFx0aWYgKGNhbkluY2x1ZGVJbnN0YWxsZWRFeHRlbnNpb25zKSB7XG5cdFx0XHRsZXQgaXNEaXNwb3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBpc0Rpc3Bvc2VkID0gdHJ1ZSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKEV2ZW50LmRlYm91bmNlKEV2ZW50LmFueShcblx0XHRcdFx0RXZlbnQuZmlsdGVyKHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub25DaGFuZ2UsIGUgPT4gZT8uc3RhdGUgPT09IEV4dGVuc2lvblN0YXRlLkluc3RhbGxlZCksXG5cdFx0XHRcdHRoaXMuZXh0ZW5zaW9uU2VydmljZS5vbkRpZENoYW5nZUV4dGVuc2lvbnNcblx0XHRcdCksICgpID0+IHVuZGVmaW5lZCkoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBsb2NhbCA9IHRoaXMub3B0aW9ucy5zZXJ2ZXIgPyB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmluc3RhbGxlZC5maWx0ZXIoZSA9PiBlLnNlcnZlciA9PT0gdGhpcy5vcHRpb25zLnNlcnZlcikgOiB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmxvY2FsO1xuXHRcdFx0XHRjb25zdCB7IGV4dGVuc2lvbnM6IG5ld0V4dGVuc2lvbnMgfSA9IGF3YWl0IHRoaXMuZmlsdGVyTG9jYWwobG9jYWwsIHRoaXMuZXh0ZW5zaW9uU2VydmljZS5leHRlbnNpb25zLCBxdWVyeSwgb3B0aW9ucyk7XG5cdFx0XHRcdGlmICghaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRcdGNvbnN0IG1lcmdlZEV4dGVuc2lvbnMgPSB0aGlzLm1lcmdlQWRkZWRFeHRlbnNpb25zKGV4dGVuc2lvbnMsIG5ld0V4dGVuc2lvbnMpO1xuXHRcdFx0XHRcdGlmIChtZXJnZWRFeHRlbnNpb25zKSB7XG5cdFx0XHRcdFx0XHRleHRlbnNpb25zID0gbWVyZ2VkRXh0ZW5zaW9ucztcblx0XHRcdFx0XHRcdG9uRGlkQ2hhbmdlTW9kZWwuZmlyZShuZXcgUGFnZWRNb2RlbChleHRlbnNpb25zKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdG1vZGVsOiBuZXcgUGFnZWRNb2RlbChleHRlbnNpb25zKSxcblx0XHRcdGRlc2NyaXB0aW9uLFxuXHRcdFx0b25EaWRDaGFuZ2VNb2RlbDogb25EaWRDaGFuZ2VNb2RlbC5ldmVudCxcblx0XHRcdGRpc3Bvc2FibGVzXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZmlsdGVyTG9jYWwobG9jYWw6IElFeHRlbnNpb25bXSwgcnVubmluZ0V4dGVuc2lvbnM6IHJlYWRvbmx5IElFeHRlbnNpb25EZXNjcmlwdGlvbltdLCBxdWVyeTogUXVlcnksIG9wdGlvbnM6IElRdWVyeU9wdGlvbnMpOiBQcm9taXNlPHsgZXh0ZW5zaW9uczogSUV4dGVuc2lvbltdOyBjYW5JbmNsdWRlSW5zdGFsbGVkRXh0ZW5zaW9uczogYm9vbGVhbjsgZGVzY3JpcHRpb24/OiBzdHJpbmcgfT4ge1xuXHRcdGNvbnN0IHZhbHVlID0gcXVlcnkudmFsdWU7XG5cdFx0bGV0IGV4dGVuc2lvbnM6IElFeHRlbnNpb25bXSA9IFtdO1xuXHRcdGxldCBjYW5JbmNsdWRlSW5zdGFsbGVkRXh0ZW5zaW9ucyA9IHRydWU7XG5cdFx0bGV0IGRlc2NyaXB0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0XHRpZiAoL0BidWlsdGluL2kudGVzdCh2YWx1ZSkpIHtcblx0XHRcdGV4dGVuc2lvbnMgPSB0aGlzLmZpbHRlckJ1aWx0aW5FeHRlbnNpb25zKGxvY2FsLCBxdWVyeSwgb3B0aW9ucyk7XG5cdFx0XHRjYW5JbmNsdWRlSW5zdGFsbGVkRXh0ZW5zaW9ucyA9IGZhbHNlO1xuXHRcdH1cblxuXHRcdGVsc2UgaWYgKC9AaW5zdGFsbGVkL2kudGVzdCh2YWx1ZSkpIHtcblx0XHRcdGV4dGVuc2lvbnMgPSB0aGlzLmZpbHRlckluc3RhbGxlZEV4dGVuc2lvbnMobG9jYWwsIHJ1bm5pbmdFeHRlbnNpb25zLCBxdWVyeSwgb3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0ZWxzZSBpZiAoL0BvdXRkYXRlZC9pLnRlc3QodmFsdWUpKSB7XG5cdFx0XHRleHRlbnNpb25zID0gdGhpcy5maWx0ZXJPdXRkYXRlZEV4dGVuc2lvbnMobG9jYWwsIHF1ZXJ5LCBvcHRpb25zKTtcblx0XHR9XG5cblx0XHRlbHNlIGlmICgvQGRpc2FibGVkL2kudGVzdCh2YWx1ZSkpIHtcblx0XHRcdGV4dGVuc2lvbnMgPSB0aGlzLmZpbHRlckRpc2FibGVkRXh0ZW5zaW9ucyhsb2NhbCwgcnVubmluZ0V4dGVuc2lvbnMsIHF1ZXJ5LCBvcHRpb25zKTtcblx0XHR9XG5cblx0XHRlbHNlIGlmICgvQGVuYWJsZWQvaS50ZXN0KHZhbHVlKSkge1xuXHRcdFx0ZXh0ZW5zaW9ucyA9IHRoaXMuZmlsdGVyRW5hYmxlZEV4dGVuc2lvbnMobG9jYWwsIHJ1bm5pbmdFeHRlbnNpb25zLCBxdWVyeSwgb3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0ZWxzZSBpZiAoL0B3b3Jrc3BhY2VVbnN1cHBvcnRlZC9pLnRlc3QodmFsdWUpKSB7XG5cdFx0XHRleHRlbnNpb25zID0gdGhpcy5maWx0ZXJXb3Jrc3BhY2VVbnN1cHBvcnRlZEV4dGVuc2lvbnMobG9jYWwsIHF1ZXJ5LCBvcHRpb25zKTtcblx0XHR9XG5cblx0XHRlbHNlIGlmICgvQGRlcHJlY2F0ZWQvaS50ZXN0KHF1ZXJ5LnZhbHVlKSkge1xuXHRcdFx0ZXh0ZW5zaW9ucyA9IGF3YWl0IHRoaXMuZmlsdGVyRGVwcmVjYXRlZEV4dGVuc2lvbnMobG9jYWwsIHF1ZXJ5LCBvcHRpb25zKTtcblx0XHR9XG5cblx0XHRlbHNlIGlmICgvQHJlY2VudGx5VXBkYXRlZC9pLnRlc3QocXVlcnkudmFsdWUpKSB7XG5cdFx0XHRleHRlbnNpb25zID0gdGhpcy5maWx0ZXJSZWNlbnRseVVwZGF0ZWRFeHRlbnNpb25zKGxvY2FsLCBxdWVyeSwgb3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0ZWxzZSBpZiAoL0BmZWF0dXJlOi9pLnRlc3QocXVlcnkudmFsdWUpKSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSB0aGlzLmZpbHRlckV4dGVuc2lvbnNCeUZlYXR1cmUobG9jYWwsIHF1ZXJ5KTtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0ZXh0ZW5zaW9ucyA9IHJlc3VsdC5leHRlbnNpb25zO1xuXHRcdFx0XHRkZXNjcmlwdGlvbiA9IHJlc3VsdC5kZXNjcmlwdGlvbjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4geyBleHRlbnNpb25zLCBjYW5JbmNsdWRlSW5zdGFsbGVkRXh0ZW5zaW9ucywgZGVzY3JpcHRpb24gfTtcblx0fVxuXG5cdHByaXZhdGUgZmlsdGVyQnVpbHRpbkV4dGVuc2lvbnMobG9jYWw6IElFeHRlbnNpb25bXSwgcXVlcnk6IFF1ZXJ5LCBvcHRpb25zOiBJUXVlcnlPcHRpb25zKTogSUV4dGVuc2lvbltdIHtcblx0XHRsZXQgeyB2YWx1ZSwgaW5jbHVkZWRDYXRlZ29yaWVzLCBleGNsdWRlZENhdGVnb3JpZXMgfSA9IHRoaXMucGFyc2VDYXRlZ29yaWVzKHF1ZXJ5LnZhbHVlKTtcblx0XHR2YWx1ZSA9IHZhbHVlLnJlcGxhY2UoL0BidWlsdGluL2csICcnKS5yZXBsYWNlKC9Ac29ydDooXFx3KykoLVxcdyopPy9nLCAnJykudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG5cblx0XHRjb25zdCByZXN1bHQgPSBsb2NhbFxuXHRcdFx0LmZpbHRlcihlID0+IGUuaXNCdWlsdGluICYmIChlLm5hbWUudG9Mb3dlckNhc2UoKS5pbmRleE9mKHZhbHVlKSA+IC0xIHx8IGUuZGlzcGxheU5hbWUudG9Mb3dlckNhc2UoKS5pbmRleE9mKHZhbHVlKSA+IC0xKVxuXHRcdFx0XHQmJiB0aGlzLmZpbHRlckV4dGVuc2lvbkJ5Q2F0ZWdvcnkoZSwgaW5jbHVkZWRDYXRlZ29yaWVzLCBleGNsdWRlZENhdGVnb3JpZXMpKTtcblxuXHRcdHJldHVybiB0aGlzLnNvcnRFeHRlbnNpb25zKHJlc3VsdCwgb3B0aW9ucyk7XG5cdH1cblxuXHRwcml2YXRlIGZpbHRlckV4dGVuc2lvbkJ5Q2F0ZWdvcnkoZTogSUV4dGVuc2lvbiwgaW5jbHVkZWRDYXRlZ29yaWVzOiBzdHJpbmdbXSwgZXhjbHVkZWRDYXRlZ29yaWVzOiBzdHJpbmdbXSk6IGJvb2xlYW4ge1xuXHRcdGlmICghaW5jbHVkZWRDYXRlZ29yaWVzLmxlbmd0aCAmJiAhZXhjbHVkZWRDYXRlZ29yaWVzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmIChlLmNhdGVnb3JpZXMubGVuZ3RoKSB7XG5cdFx0XHRpZiAoZXhjbHVkZWRDYXRlZ29yaWVzLmxlbmd0aCAmJiBlLmNhdGVnb3JpZXMuc29tZShjYXRlZ29yeSA9PiBleGNsdWRlZENhdGVnb3JpZXMuaW5jbHVkZXMoY2F0ZWdvcnkudG9Mb3dlckNhc2UoKSkpKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBlLmNhdGVnb3JpZXMuc29tZShjYXRlZ29yeSA9PiBpbmNsdWRlZENhdGVnb3JpZXMuaW5jbHVkZXMoY2F0ZWdvcnkudG9Mb3dlckNhc2UoKSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gaW5jbHVkZWRDYXRlZ29yaWVzLmluY2x1ZGVzKE5PTkVfQ0FURUdPUlkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcGFyc2VDYXRlZ29yaWVzKHZhbHVlOiBzdHJpbmcpOiB7IHZhbHVlOiBzdHJpbmc7IGluY2x1ZGVkQ2F0ZWdvcmllczogc3RyaW5nW107IGV4Y2x1ZGVkQ2F0ZWdvcmllczogc3RyaW5nW10gfSB7XG5cdFx0Y29uc3QgaW5jbHVkZWRDYXRlZ29yaWVzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IGV4Y2x1ZGVkQ2F0ZWdvcmllczogc3RyaW5nW10gPSBbXTtcblx0XHR2YWx1ZSA9IHZhbHVlLnJlcGxhY2UoL1xcYmNhdGVnb3J5OihcIihbXlwiXSopXCJ8KFteXCJdXFxTKikpKFxccyt8XFxifCQpL2csIChfLCBxdW90ZWRDYXRlZ29yeSwgY2F0ZWdvcnkpID0+IHtcblx0XHRcdGNvbnN0IGVudHJ5ID0gKGNhdGVnb3J5IHx8IHF1b3RlZENhdGVnb3J5IHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0aWYgKGVudHJ5LnN0YXJ0c1dpdGgoJy0nKSkge1xuXHRcdFx0XHRpZiAoZXhjbHVkZWRDYXRlZ29yaWVzLmluZGV4T2YoZW50cnkpID09PSAtMSkge1xuXHRcdFx0XHRcdGV4Y2x1ZGVkQ2F0ZWdvcmllcy5wdXNoKGVudHJ5KTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGluY2x1ZGVkQ2F0ZWdvcmllcy5pbmRleE9mKGVudHJ5KSA9PT0gLTEpIHtcblx0XHRcdFx0XHRpbmNsdWRlZENhdGVnb3JpZXMucHVzaChlbnRyeSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiAnJztcblx0XHR9KTtcblx0XHRyZXR1cm4geyB2YWx1ZSwgaW5jbHVkZWRDYXRlZ29yaWVzLCBleGNsdWRlZENhdGVnb3JpZXMgfTtcblx0fVxuXG5cdHByaXZhdGUgZmlsdGVySW5zdGFsbGVkRXh0ZW5zaW9ucyhsb2NhbDogSUV4dGVuc2lvbltdLCBydW5uaW5nRXh0ZW5zaW9uczogcmVhZG9ubHkgSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10sIHF1ZXJ5OiBRdWVyeSwgb3B0aW9uczogSVF1ZXJ5T3B0aW9ucyk6IElFeHRlbnNpb25bXSB7XG5cdFx0bGV0IHsgdmFsdWUsIGluY2x1ZGVkQ2F0ZWdvcmllcywgZXhjbHVkZWRDYXRlZ29yaWVzIH0gPSB0aGlzLnBhcnNlQ2F0ZWdvcmllcyhxdWVyeS52YWx1ZSk7XG5cblx0XHR2YWx1ZSA9IHZhbHVlLnJlcGxhY2UoL0BpbnN0YWxsZWQvZywgJycpLnJlcGxhY2UoL0Bzb3J0OihcXHcrKSgtXFx3Kik/L2csICcnKS50cmltKCkudG9Mb3dlckNhc2UoKTtcblxuXHRcdGNvbnN0IG1hdGNoaW5nVGV4dCA9IChlOiBJRXh0ZW5zaW9uKSA9PiAoZS5uYW1lLnRvTG93ZXJDYXNlKCkuaW5kZXhPZih2YWx1ZSkgPiAtMSB8fCBlLmRpc3BsYXlOYW1lLnRvTG93ZXJDYXNlKCkuaW5kZXhPZih2YWx1ZSkgPiAtMSB8fCBlLmRlc2NyaXB0aW9uLnRvTG93ZXJDYXNlKCkuaW5kZXhPZih2YWx1ZSkgPiAtMSlcblx0XHRcdCYmIHRoaXMuZmlsdGVyRXh0ZW5zaW9uQnlDYXRlZ29yeShlLCBpbmNsdWRlZENhdGVnb3JpZXMsIGV4Y2x1ZGVkQ2F0ZWdvcmllcyk7XG5cdFx0bGV0IHJlc3VsdDtcblxuXHRcdGlmIChvcHRpb25zLnNvcnRCeSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXN1bHQgPSBsb2NhbC5maWx0ZXIoZSA9PiAhZS5pc0J1aWx0aW4gJiYgbWF0Y2hpbmdUZXh0KGUpKTtcblx0XHRcdHJlc3VsdCA9IHRoaXMuc29ydEV4dGVuc2lvbnMocmVzdWx0LCBvcHRpb25zKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzdWx0ID0gbG9jYWwuZmlsdGVyKGUgPT4gKCFlLmlzQnVpbHRpbiB8fCBlLm91dGRhdGVkIHx8IGUucnVudGltZVN0YXRlICE9PSB1bmRlZmluZWQpICYmIG1hdGNoaW5nVGV4dChlKSk7XG5cdFx0XHRjb25zdCBydW5uaW5nRXh0ZW5zaW9uc0J5SWQgPSBydW5uaW5nRXh0ZW5zaW9ucy5yZWR1Y2UoKHJlc3VsdCwgZSkgPT4geyByZXN1bHQuc2V0KGUuaWRlbnRpZmllci52YWx1ZSwgZSk7IHJldHVybiByZXN1bHQ7IH0sIG5ldyBFeHRlbnNpb25JZGVudGlmaWVyTWFwPElFeHRlbnNpb25EZXNjcmlwdGlvbj4oKSk7XG5cblx0XHRcdGNvbnN0IGRlZmF1bHRTb3J0ID0gKGUxOiBJRXh0ZW5zaW9uLCBlMjogSUV4dGVuc2lvbikgPT4ge1xuXHRcdFx0XHRjb25zdCBydW5uaW5nMSA9IHJ1bm5pbmdFeHRlbnNpb25zQnlJZC5nZXQoZTEuaWRlbnRpZmllci5pZCk7XG5cdFx0XHRcdGNvbnN0IGlzRTFSdW5uaW5nID0gISFydW5uaW5nMSAmJiB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLmdldEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIodG9FeHRlbnNpb24ocnVubmluZzEpKSA9PT0gZTEuc2VydmVyO1xuXHRcdFx0XHRjb25zdCBydW5uaW5nMiA9IHJ1bm5pbmdFeHRlbnNpb25zQnlJZC5nZXQoZTIuaWRlbnRpZmllci5pZCk7XG5cdFx0XHRcdGNvbnN0IGlzRTJSdW5uaW5nID0gcnVubmluZzIgJiYgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5nZXRFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyKHRvRXh0ZW5zaW9uKHJ1bm5pbmcyKSkgPT09IGUyLnNlcnZlcjtcblx0XHRcdFx0aWYgKChpc0UxUnVubmluZyAmJiBpc0UyUnVubmluZykpIHtcblx0XHRcdFx0XHRyZXR1cm4gZTEuZGlzcGxheU5hbWUubG9jYWxlQ29tcGFyZShlMi5kaXNwbGF5TmFtZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgaXNFMUxhbmd1YWdlUGFja0V4dGVuc2lvbiA9IGUxLmxvY2FsICYmIGlzTGFuZ3VhZ2VQYWNrRXh0ZW5zaW9uKGUxLmxvY2FsLm1hbmlmZXN0KTtcblx0XHRcdFx0Y29uc3QgaXNFMkxhbmd1YWdlUGFja0V4dGVuc2lvbiA9IGUyLmxvY2FsICYmIGlzTGFuZ3VhZ2VQYWNrRXh0ZW5zaW9uKGUyLmxvY2FsLm1hbmlmZXN0KTtcblx0XHRcdFx0aWYgKCFpc0UxUnVubmluZyAmJiAhaXNFMlJ1bm5pbmcpIHtcblx0XHRcdFx0XHRpZiAoaXNFMUxhbmd1YWdlUGFja0V4dGVuc2lvbikge1xuXHRcdFx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoaXNFMkxhbmd1YWdlUGFja0V4dGVuc2lvbikge1xuXHRcdFx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBlMS5kaXNwbGF5TmFtZS5sb2NhbGVDb21wYXJlKGUyLmRpc3BsYXlOYW1lKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoKGlzRTFSdW5uaW5nICYmIGlzRTJMYW5ndWFnZVBhY2tFeHRlbnNpb24pIHx8IChpc0UyUnVubmluZyAmJiBpc0UxTGFuZ3VhZ2VQYWNrRXh0ZW5zaW9uKSkge1xuXHRcdFx0XHRcdHJldHVybiBlMS5kaXNwbGF5TmFtZS5sb2NhbGVDb21wYXJlKGUyLmRpc3BsYXlOYW1lKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gaXNFMVJ1bm5pbmcgPyAtMSA6IDE7XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBpbmNvbXBhdGlibGU6IElFeHRlbnNpb25bXSA9IFtdO1xuXHRcdFx0Y29uc3QgZGVwcmVjYXRlZDogSUV4dGVuc2lvbltdID0gW107XG5cdFx0XHRjb25zdCBvdXRkYXRlZDogSUV4dGVuc2lvbltdID0gW107XG5cdFx0XHRjb25zdCBhY3Rpb25SZXF1aXJlZDogSUV4dGVuc2lvbltdID0gW107XG5cdFx0XHRjb25zdCBub0FjdGlvblJlcXVpcmVkOiBJRXh0ZW5zaW9uW10gPSBbXTtcblxuXHRcdFx0Zm9yIChjb25zdCBlIG9mIHJlc3VsdCkge1xuXHRcdFx0XHRpZiAoZS5lbmFibGVtZW50U3RhdGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5SW52YWxpZEV4dGVuc2lvbikge1xuXHRcdFx0XHRcdGluY29tcGF0aWJsZS5wdXNoKGUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2UgaWYgKGUuZGVwcmVjYXRpb25JbmZvKSB7XG5cdFx0XHRcdFx0ZGVwcmVjYXRlZC5wdXNoKGUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2UgaWYgKGUub3V0ZGF0ZWQgJiYgdGhpcy5leHRlbnNpb25FbmFibGVtZW50U2VydmljZS5pc0VuYWJsZWRFbmFibGVtZW50U3RhdGUoZS5lbmFibGVtZW50U3RhdGUpKSB7XG5cdFx0XHRcdFx0b3V0ZGF0ZWQucHVzaChlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIGlmIChlLnJ1bnRpbWVTdGF0ZSkge1xuXHRcdFx0XHRcdGFjdGlvblJlcXVpcmVkLnB1c2goZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0bm9BY3Rpb25SZXF1aXJlZC5wdXNoKGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJlc3VsdCA9IFtcblx0XHRcdFx0Li4uaW5jb21wYXRpYmxlLnNvcnQoZGVmYXVsdFNvcnQpLFxuXHRcdFx0XHQuLi5kZXByZWNhdGVkLnNvcnQoZGVmYXVsdFNvcnQpLFxuXHRcdFx0XHQuLi5vdXRkYXRlZC5zb3J0KGRlZmF1bHRTb3J0KSxcblx0XHRcdFx0Li4uYWN0aW9uUmVxdWlyZWQuc29ydChkZWZhdWx0U29ydCksXG5cdFx0XHRcdC4uLm5vQWN0aW9uUmVxdWlyZWQuc29ydChkZWZhdWx0U29ydClcblx0XHRcdF07XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIGZpbHRlck91dGRhdGVkRXh0ZW5zaW9ucyhsb2NhbDogSUV4dGVuc2lvbltdLCBxdWVyeTogUXVlcnksIG9wdGlvbnM6IElRdWVyeU9wdGlvbnMpOiBJRXh0ZW5zaW9uW10ge1xuXHRcdGxldCB7IHZhbHVlLCBpbmNsdWRlZENhdGVnb3JpZXMsIGV4Y2x1ZGVkQ2F0ZWdvcmllcyB9ID0gdGhpcy5wYXJzZUNhdGVnb3JpZXMocXVlcnkudmFsdWUpO1xuXG5cdFx0dmFsdWUgPSB2YWx1ZS5yZXBsYWNlKC9Ab3V0ZGF0ZWQvZywgJycpLnJlcGxhY2UoL0Bzb3J0OihcXHcrKSgtXFx3Kik/L2csICcnKS50cmltKCkudG9Mb3dlckNhc2UoKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGxvY2FsXG5cdFx0XHQuc29ydCgoZTEsIGUyKSA9PiBlMS5kaXNwbGF5TmFtZS5sb2NhbGVDb21wYXJlKGUyLmRpc3BsYXlOYW1lKSlcblx0XHRcdC5maWx0ZXIoZXh0ZW5zaW9uID0+IGV4dGVuc2lvbi5vdXRkYXRlZFxuXHRcdFx0XHQmJiAoZXh0ZW5zaW9uLm5hbWUudG9Mb3dlckNhc2UoKS5pbmRleE9mKHZhbHVlKSA+IC0xIHx8IGV4dGVuc2lvbi5kaXNwbGF5TmFtZS50b0xvd2VyQ2FzZSgpLmluZGV4T2YodmFsdWUpID4gLTEpXG5cdFx0XHRcdCYmIHRoaXMuZmlsdGVyRXh0ZW5zaW9uQnlDYXRlZ29yeShleHRlbnNpb24sIGluY2x1ZGVkQ2F0ZWdvcmllcywgZXhjbHVkZWRDYXRlZ29yaWVzKSk7XG5cblx0XHRyZXR1cm4gdGhpcy5zb3J0RXh0ZW5zaW9ucyhyZXN1bHQsIG9wdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBmaWx0ZXJEaXNhYmxlZEV4dGVuc2lvbnMobG9jYWw6IElFeHRlbnNpb25bXSwgcnVubmluZ0V4dGVuc2lvbnM6IHJlYWRvbmx5IElFeHRlbnNpb25EZXNjcmlwdGlvbltdLCBxdWVyeTogUXVlcnksIG9wdGlvbnM6IElRdWVyeU9wdGlvbnMpOiBJRXh0ZW5zaW9uW10ge1xuXHRcdGxldCB7IHZhbHVlLCBpbmNsdWRlZENhdGVnb3JpZXMsIGV4Y2x1ZGVkQ2F0ZWdvcmllcyB9ID0gdGhpcy5wYXJzZUNhdGVnb3JpZXMocXVlcnkudmFsdWUpO1xuXG5cdFx0dmFsdWUgPSB2YWx1ZS5yZXBsYWNlKC9AZGlzYWJsZWQvZywgJycpLnJlcGxhY2UoL0Bzb3J0OihcXHcrKSgtXFx3Kik/L2csICcnKS50cmltKCkudG9Mb3dlckNhc2UoKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGxvY2FsXG5cdFx0XHQuc29ydCgoZTEsIGUyKSA9PiBlMS5kaXNwbGF5TmFtZS5sb2NhbGVDb21wYXJlKGUyLmRpc3BsYXlOYW1lKSlcblx0XHRcdC5maWx0ZXIoZSA9PiBydW5uaW5nRXh0ZW5zaW9ucy5ldmVyeShyID0+ICFhcmVTYW1lRXh0ZW5zaW9ucyh7IGlkOiByLmlkZW50aWZpZXIudmFsdWUsIHV1aWQ6IHIudXVpZCB9LCBlLmlkZW50aWZpZXIpKVxuXHRcdFx0XHQmJiAoZS5uYW1lLnRvTG93ZXJDYXNlKCkuaW5kZXhPZih2YWx1ZSkgPiAtMSB8fCBlLmRpc3BsYXlOYW1lLnRvTG93ZXJDYXNlKCkuaW5kZXhPZih2YWx1ZSkgPiAtMSlcblx0XHRcdFx0JiYgdGhpcy5maWx0ZXJFeHRlbnNpb25CeUNhdGVnb3J5KGUsIGluY2x1ZGVkQ2F0ZWdvcmllcywgZXhjbHVkZWRDYXRlZ29yaWVzKSk7XG5cblx0XHRyZXR1cm4gdGhpcy5zb3J0RXh0ZW5zaW9ucyhyZXN1bHQsIG9wdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBmaWx0ZXJFbmFibGVkRXh0ZW5zaW9ucyhsb2NhbDogSUV4dGVuc2lvbltdLCBydW5uaW5nRXh0ZW5zaW9uczogcmVhZG9ubHkgSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10sIHF1ZXJ5OiBRdWVyeSwgb3B0aW9uczogSVF1ZXJ5T3B0aW9ucyk6IElFeHRlbnNpb25bXSB7XG5cdFx0bGV0IHsgdmFsdWUsIGluY2x1ZGVkQ2F0ZWdvcmllcywgZXhjbHVkZWRDYXRlZ29yaWVzIH0gPSB0aGlzLnBhcnNlQ2F0ZWdvcmllcyhxdWVyeS52YWx1ZSk7XG5cblx0XHR2YWx1ZSA9IHZhbHVlID8gdmFsdWUucmVwbGFjZSgvQGVuYWJsZWQvZywgJycpLnJlcGxhY2UoL0Bzb3J0OihcXHcrKSgtXFx3Kik/L2csICcnKS50cmltKCkudG9Mb3dlckNhc2UoKSA6ICcnO1xuXG5cdFx0bG9jYWwgPSBsb2NhbC5maWx0ZXIoZSA9PiAhZS5pc0J1aWx0aW4pO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGxvY2FsXG5cdFx0XHQuc29ydCgoZTEsIGUyKSA9PiBlMS5kaXNwbGF5TmFtZS5sb2NhbGVDb21wYXJlKGUyLmRpc3BsYXlOYW1lKSlcblx0XHRcdC5maWx0ZXIoZSA9PiBydW5uaW5nRXh0ZW5zaW9ucy5zb21lKHIgPT4gYXJlU2FtZUV4dGVuc2lvbnMoeyBpZDogci5pZGVudGlmaWVyLnZhbHVlLCB1dWlkOiByLnV1aWQgfSwgZS5pZGVudGlmaWVyKSlcblx0XHRcdFx0JiYgKGUubmFtZS50b0xvd2VyQ2FzZSgpLmluZGV4T2YodmFsdWUpID4gLTEgfHwgZS5kaXNwbGF5TmFtZS50b0xvd2VyQ2FzZSgpLmluZGV4T2YodmFsdWUpID4gLTEpXG5cdFx0XHRcdCYmIHRoaXMuZmlsdGVyRXh0ZW5zaW9uQnlDYXRlZ29yeShlLCBpbmNsdWRlZENhdGVnb3JpZXMsIGV4Y2x1ZGVkQ2F0ZWdvcmllcykpO1xuXG5cdFx0cmV0dXJuIHRoaXMuc29ydEV4dGVuc2lvbnMocmVzdWx0LCBvcHRpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgZmlsdGVyV29ya3NwYWNlVW5zdXBwb3J0ZWRFeHRlbnNpb25zKGxvY2FsOiBJRXh0ZW5zaW9uW10sIHF1ZXJ5OiBRdWVyeSwgb3B0aW9uczogSVF1ZXJ5T3B0aW9ucyk6IElFeHRlbnNpb25bXSB7XG5cdFx0Ly8gc2hvd3MgbG9jYWwgZXh0ZW5zaW9ucyB3aGljaCBhcmUgcmVzdHJpY3RlZCBvciBkaXNhYmxlZCBpbiB0aGUgY3VycmVudCB3b3Jrc3BhY2UgYmVjYXVzZSBvZiB0aGUgZXh0ZW5zaW9uJ3MgY2FwYWJpbGl0eVxuXG5cdFx0Y29uc3QgcXVlcnlTdHJpbmcgPSBxdWVyeS52YWx1ZTsgLy8gQHNvcnRieSBpcyBhbHJlYWR5IGZpbHRlcmVkIG91dFxuXG5cdFx0Y29uc3QgbWF0Y2ggPSBxdWVyeVN0cmluZy5tYXRjaCgvXlxccypAd29ya3NwYWNlVW5zdXBwb3J0ZWQoPzo6KHVudHJ1c3RlZHx2aXJ0dWFsKShQYXJ0aWFsKT8pPyg/OlxccysoW15cXHNdKikpPy9pKTtcblx0XHRpZiAoIW1hdGNoKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHRcdGNvbnN0IHR5cGUgPSBtYXRjaFsxXT8udG9Mb3dlckNhc2UoKTtcblx0XHRjb25zdCBwYXJ0aWFsID0gISFtYXRjaFsyXTtcblx0XHRjb25zdCBuYW1lRmlsdGVyID0gbWF0Y2hbM10/LnRvTG93ZXJDYXNlKCk7XG5cblx0XHRpZiAobmFtZUZpbHRlcikge1xuXHRcdFx0bG9jYWwgPSBsb2NhbC5maWx0ZXIoZXh0ZW5zaW9uID0+IGV4dGVuc2lvbi5uYW1lLnRvTG93ZXJDYXNlKCkuaW5kZXhPZihuYW1lRmlsdGVyKSA+IC0xIHx8IGV4dGVuc2lvbi5kaXNwbGF5TmFtZS50b0xvd2VyQ2FzZSgpLmluZGV4T2YobmFtZUZpbHRlcikgPiAtMSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGFzVmlydHVhbFN1cHBvcnRUeXBlID0gKGV4dGVuc2lvbjogSUV4dGVuc2lvbiwgc3VwcG9ydFR5cGU6IEV4dGVuc2lvblZpcnR1YWxXb3Jrc3BhY2VTdXBwb3J0VHlwZSkgPT4ge1xuXHRcdFx0cmV0dXJuIGV4dGVuc2lvbi5sb2NhbCAmJiB0aGlzLmV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UuZ2V0RXh0ZW5zaW9uVmlydHVhbFdvcmtzcGFjZVN1cHBvcnRUeXBlKGV4dGVuc2lvbi5sb2NhbC5tYW5pZmVzdCkgPT09IHN1cHBvcnRUeXBlO1xuXHRcdH07XG5cblx0XHRjb25zdCBoYXNSZXN0cmljdGVkU3VwcG9ydFR5cGUgPSAoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uLCBzdXBwb3J0VHlwZTogRXh0ZW5zaW9uVW50cnVzdGVkV29ya3NwYWNlU3VwcG9ydFR5cGUpID0+IHtcblx0XHRcdGlmICghZXh0ZW5zaW9uLmxvY2FsKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZW5hYmxlbWVudFN0YXRlID0gdGhpcy5leHRlbnNpb25FbmFibGVtZW50U2VydmljZS5nZXRFbmFibGVtZW50U3RhdGUoZXh0ZW5zaW9uLmxvY2FsKTtcblx0XHRcdGlmIChlbmFibGVtZW50U3RhdGUgIT09IEVuYWJsZW1lbnRTdGF0ZS5FbmFibGVkR2xvYmFsbHkgJiYgZW5hYmxlbWVudFN0YXRlICE9PSBFbmFibGVtZW50U3RhdGUuRW5hYmxlZFdvcmtzcGFjZSAmJlxuXHRcdFx0XHRlbmFibGVtZW50U3RhdGUgIT09IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5VHJ1c3RSZXF1aXJlbWVudCAmJiBlbmFibGVtZW50U3RhdGUgIT09IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5RXh0ZW5zaW9uRGVwZW5kZW5jeSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UuZ2V0RXh0ZW5zaW9uVW50cnVzdGVkV29ya3NwYWNlU3VwcG9ydFR5cGUoZXh0ZW5zaW9uLmxvY2FsLm1hbmlmZXN0KSA9PT0gc3VwcG9ydFR5cGUpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzdXBwb3J0VHlwZSA9PT0gZmFsc2UpIHtcblx0XHRcdFx0Y29uc3QgZGVwZW5kZW5jaWVzID0gZ2V0RXh0ZW5zaW9uRGVwZW5kZW5jaWVzKGxvY2FsLm1hcChleHQgPT4gZXh0LmxvY2FsISksIGV4dGVuc2lvbi5sb2NhbCk7XG5cdFx0XHRcdHJldHVybiBkZXBlbmRlbmNpZXMuc29tZShleHQgPT4gdGhpcy5leHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLmdldEV4dGVuc2lvblVudHJ1c3RlZFdvcmtzcGFjZVN1cHBvcnRUeXBlKGV4dC5tYW5pZmVzdCkgPT09IHN1cHBvcnRUeXBlKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH07XG5cblx0XHRjb25zdCBpblZpcnR1YWxXb3Jrc3BhY2UgPSBpc1ZpcnR1YWxXb3Jrc3BhY2UodGhpcy53b3Jrc3BhY2VTZXJ2aWNlLmdldFdvcmtzcGFjZSgpKTtcblx0XHRjb25zdCBpblJlc3RyaWN0ZWRXb3Jrc3BhY2UgPSAhdGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLmlzV29ya3NwYWNlVHJ1c3RlZCgpO1xuXG5cdFx0aWYgKHR5cGUgPT09ICd2aXJ0dWFsJykge1xuXHRcdFx0Ly8gc2hvdyBsaW1pdGVkIGFuZCBkaXNhYmxlZCBleHRlbnNpb25zIHVubGVzcyBkaXNhYmxlZCBiZWNhdXNlIG9mIGEgdW50cnVzdGVkIHdvcmtzcGFjZVxuXHRcdFx0bG9jYWwgPSBsb2NhbC5maWx0ZXIoZXh0ZW5zaW9uID0+IGluVmlydHVhbFdvcmtzcGFjZSAmJiBoYXNWaXJ0dWFsU3VwcG9ydFR5cGUoZXh0ZW5zaW9uLCBwYXJ0aWFsID8gJ2xpbWl0ZWQnIDogZmFsc2UpICYmICEoaW5SZXN0cmljdGVkV29ya3NwYWNlICYmIGhhc1Jlc3RyaWN0ZWRTdXBwb3J0VHlwZShleHRlbnNpb24sIGZhbHNlKSkpO1xuXHRcdH0gZWxzZSBpZiAodHlwZSA9PT0gJ3VudHJ1c3RlZCcpIHtcblx0XHRcdC8vIHNob3cgbGltaXRlZCBhbmQgZGlzYWJsZWQgZXh0ZW5zaW9ucyB1bmxlc3MgZGlzYWJsZWQgYmVjYXVzZSBvZiBhIHZpcnR1YWwgd29ya3NwYWNlXG5cdFx0XHRsb2NhbCA9IGxvY2FsLmZpbHRlcihleHRlbnNpb24gPT4gaGFzUmVzdHJpY3RlZFN1cHBvcnRUeXBlKGV4dGVuc2lvbiwgcGFydGlhbCA/ICdsaW1pdGVkJyA6IGZhbHNlKSAmJiAhKGluVmlydHVhbFdvcmtzcGFjZSAmJiBoYXNWaXJ0dWFsU3VwcG9ydFR5cGUoZXh0ZW5zaW9uLCBmYWxzZSkpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gc2hvdyBleHRlbnNpb25zIHRoYXQgYXJlIHJlc3RyaWN0ZWQgb3IgZGlzYWJsZWQgaW4gdGhlIGN1cnJlbnQgd29ya3NwYWNlXG5cdFx0XHRsb2NhbCA9IGxvY2FsLmZpbHRlcihleHRlbnNpb24gPT4gaW5WaXJ0dWFsV29ya3NwYWNlICYmICFoYXNWaXJ0dWFsU3VwcG9ydFR5cGUoZXh0ZW5zaW9uLCB0cnVlKSB8fCBpblJlc3RyaWN0ZWRXb3Jrc3BhY2UgJiYgIWhhc1Jlc3RyaWN0ZWRTdXBwb3J0VHlwZShleHRlbnNpb24sIHRydWUpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuc29ydEV4dGVuc2lvbnMobG9jYWwsIG9wdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBmaWx0ZXJEZXByZWNhdGVkRXh0ZW5zaW9ucyhsb2NhbDogSUV4dGVuc2lvbltdLCBxdWVyeTogUXVlcnksIG9wdGlvbnM6IElRdWVyeU9wdGlvbnMpOiBQcm9taXNlPElFeHRlbnNpb25bXT4ge1xuXHRcdGNvbnN0IHZhbHVlID0gcXVlcnkudmFsdWUucmVwbGFjZSgvQGRlcHJlY2F0ZWQvZywgJycpLnJlcGxhY2UoL0Bzb3J0OihcXHcrKSgtXFx3Kik/L2csICcnKS50cmltKCkudG9Mb3dlckNhc2UoKTtcblx0XHRjb25zdCBleHRlbnNpb25zQ29udHJvbE1hbmlmZXN0ID0gYXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0KCk7XG5cdFx0Y29uc3QgZGVwcmVjYXRlZEV4dGVuc2lvbklkcyA9IE9iamVjdC5rZXlzKGV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3QuZGVwcmVjYXRlZCk7XG5cdFx0bG9jYWwgPSBsb2NhbC5maWx0ZXIoZSA9PiBkZXByZWNhdGVkRXh0ZW5zaW9uSWRzLmluY2x1ZGVzKGUuaWRlbnRpZmllci5pZCkgJiYgKCF2YWx1ZSB8fCBlLm5hbWUudG9Mb3dlckNhc2UoKS5pbmRleE9mKHZhbHVlKSA+IC0xIHx8IGUuZGlzcGxheU5hbWUudG9Mb3dlckNhc2UoKS5pbmRleE9mKHZhbHVlKSA+IC0xKSk7XG5cdFx0cmV0dXJuIHRoaXMuc29ydEV4dGVuc2lvbnMobG9jYWwsIG9wdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBmaWx0ZXJSZWNlbnRseVVwZGF0ZWRFeHRlbnNpb25zKGxvY2FsOiBJRXh0ZW5zaW9uW10sIHF1ZXJ5OiBRdWVyeSwgb3B0aW9uczogSVF1ZXJ5T3B0aW9ucyk6IElFeHRlbnNpb25bXSB7XG5cdFx0bGV0IHsgdmFsdWUsIGluY2x1ZGVkQ2F0ZWdvcmllcywgZXhjbHVkZWRDYXRlZ29yaWVzIH0gPSB0aGlzLnBhcnNlQ2F0ZWdvcmllcyhxdWVyeS52YWx1ZSk7XG5cdFx0Y29uc3QgY3VycmVudFRpbWUgPSBEYXRlLm5vdygpO1xuXHRcdGxvY2FsID0gbG9jYWwuZmlsdGVyKGUgPT4gIWUuaXNCdWlsdGluICYmICFlLm91dGRhdGVkICYmIGUubG9jYWw/LnVwZGF0ZWQgJiYgZS5sb2NhbD8uaW5zdGFsbGVkVGltZXN0YW1wICE9PSB1bmRlZmluZWQgJiYgY3VycmVudFRpbWUgLSBlLmxvY2FsLmluc3RhbGxlZFRpbWVzdGFtcCA8IEV4dGVuc2lvbnNMaXN0Vmlldy5SRUNFTlRfVVBEQVRFX0RVUkFUSU9OKTtcblxuXHRcdHZhbHVlID0gdmFsdWUucmVwbGFjZSgvQHJlY2VudGx5VXBkYXRlZC9nLCAnJykucmVwbGFjZSgvQHNvcnQ6KFxcdyspKC1cXHcqKT8vZywgJycpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gbG9jYWwuZmlsdGVyKGUgPT5cblx0XHRcdChlLm5hbWUudG9Mb3dlckNhc2UoKS5pbmRleE9mKHZhbHVlKSA+IC0xIHx8IGUuZGlzcGxheU5hbWUudG9Mb3dlckNhc2UoKS5pbmRleE9mKHZhbHVlKSA+IC0xKVxuXHRcdFx0JiYgdGhpcy5maWx0ZXJFeHRlbnNpb25CeUNhdGVnb3J5KGUsIGluY2x1ZGVkQ2F0ZWdvcmllcywgZXhjbHVkZWRDYXRlZ29yaWVzKSk7XG5cblx0XHRvcHRpb25zLnNvcnRCeSA9IG9wdGlvbnMuc29ydEJ5ID8/IExvY2FsU29ydEJ5LlVwZGF0ZURhdGU7XG5cblx0XHRyZXR1cm4gdGhpcy5zb3J0RXh0ZW5zaW9ucyhyZXN1bHQsIG9wdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBmaWx0ZXJFeHRlbnNpb25zQnlGZWF0dXJlKGxvY2FsOiBJRXh0ZW5zaW9uW10sIHF1ZXJ5OiBRdWVyeSk6IHsgZXh0ZW5zaW9uczogSUV4dGVuc2lvbltdOyBkZXNjcmlwdGlvbjogc3RyaW5nIH0gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHZhbHVlID0gcXVlcnkudmFsdWUucmVwbGFjZSgvQGZlYXR1cmU6L2csICcnKS50cmltKCk7XG5cdFx0Y29uc3QgZmVhdHVyZUlkID0gdmFsdWUuc3BsaXQoJyAnKVswXTtcblx0XHRjb25zdCBmZWF0dXJlID0gUmVnaXN0cnkuYXM8SUV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnk+KEV4dGVuc2lvbnMuRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeSkuZ2V0RXh0ZW5zaW9uRmVhdHVyZShmZWF0dXJlSWQpO1xuXHRcdGlmICghZmVhdHVyZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uc1ZpZXdTdGF0ZSkge1xuXHRcdFx0dGhpcy5leHRlbnNpb25zVmlld1N0YXRlLmZpbHRlcnMuZmVhdHVyZUlkID0gZmVhdHVyZUlkO1xuXHRcdH1cblx0XHRjb25zdCByZW5kZXJlciA9IGZlYXR1cmUucmVuZGVyZXIgPyB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlPElFeHRlbnNpb25GZWF0dXJlUmVuZGVyZXI+KGZlYXR1cmUucmVuZGVyZXIpIDogdW5kZWZpbmVkO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCByZXN1bHQ6IFtJRXh0ZW5zaW9uLCBudW1iZXJdW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgZSBvZiBsb2NhbCkge1xuXHRcdFx0XHRpZiAoIWUubG9jYWwpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBhY2Nlc3NEYXRhID0gdGhpcy5leHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlLmdldEFjY2Vzc0RhdGEobmV3IEV4dGVuc2lvbklkZW50aWZpZXIoZS5pZGVudGlmaWVyLmlkKSwgZmVhdHVyZUlkKTtcblx0XHRcdFx0Y29uc3Qgc2hvdWxkUmVuZGVyID0gcmVuZGVyZXI/LnNob3VsZFJlbmRlcihlLmxvY2FsLm1hbmlmZXN0KTtcblx0XHRcdFx0aWYgKGFjY2Vzc0RhdGEgfHwgc2hvdWxkUmVuZGVyKSB7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2goW2UsIGFjY2Vzc0RhdGE/LmFjY2Vzc1RpbWVzLmxlbmd0aCA/PyAwXSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGV4dGVuc2lvbnM6IHJlc3VsdC5zb3J0KChbLCBhXSwgWywgYl0pID0+IGIgLSBhKS5tYXAoKFtlXSkgPT4gZSksXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnc2hvd2luZ0V4dGVuc2lvbnNGb3JGZWF0dXJlJywgXCJFeHRlbnNpb25zIHVzaW5nIHswfSBpbiB0aGUgbGFzdCAzMCBkYXlzXCIsIGZlYXR1cmUubGFiZWwpXG5cdFx0XHR9O1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRyZW5kZXJlcj8uZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgbWVyZ2VBZGRlZEV4dGVuc2lvbnMoZXh0ZW5zaW9uczogSUV4dGVuc2lvbltdLCBuZXdFeHRlbnNpb25zOiBJRXh0ZW5zaW9uW10pOiBJRXh0ZW5zaW9uW10gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IG9sZEV4dGVuc2lvbnMgPSBbLi4uZXh0ZW5zaW9uc107XG5cdFx0Y29uc3QgZmluZFByZXZpb3VzRXh0ZW5zaW9uSW5kZXggPSAoZnJvbTogbnVtYmVyKTogbnVtYmVyID0+IHtcblx0XHRcdGxldCBpbmRleCA9IC0xO1xuXHRcdFx0Y29uc3QgcHJldmlvdXNFeHRlbnNpb25Jbk5ldyA9IG5ld0V4dGVuc2lvbnNbZnJvbV07XG5cdFx0XHRpZiAocHJldmlvdXNFeHRlbnNpb25Jbk5ldykge1xuXHRcdFx0XHRpbmRleCA9IG9sZEV4dGVuc2lvbnMuZmluZEluZGV4KGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5pZGVudGlmaWVyLCBwcmV2aW91c0V4dGVuc2lvbkluTmV3LmlkZW50aWZpZXIpKTtcblx0XHRcdFx0aWYgKGluZGV4ID09PSAtMSkge1xuXHRcdFx0XHRcdHJldHVybiBmaW5kUHJldmlvdXNFeHRlbnNpb25JbmRleChmcm9tIC0gMSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiBpbmRleDtcblx0XHR9O1xuXG5cdFx0bGV0IGhhc0NoYW5nZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0XHRmb3IgKGxldCBpbmRleCA9IDA7IGluZGV4IDwgbmV3RXh0ZW5zaW9ucy5sZW5ndGg7IGluZGV4KyspIHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IG5ld0V4dGVuc2lvbnNbaW5kZXhdO1xuXHRcdFx0aWYgKGV4dGVuc2lvbnMuZXZlcnkociA9PiAhYXJlU2FtZUV4dGVuc2lvbnMoci5pZGVudGlmaWVyLCBleHRlbnNpb24uaWRlbnRpZmllcikpKSB7XG5cdFx0XHRcdGhhc0NoYW5nZWQgPSB0cnVlO1xuXHRcdFx0XHRleHRlbnNpb25zLnNwbGljZShmaW5kUHJldmlvdXNFeHRlbnNpb25JbmRleChpbmRleCAtIDEpICsgMSwgMCwgZXh0ZW5zaW9uKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gaGFzQ2hhbmdlZCA/IGV4dGVuc2lvbnMgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHF1ZXJ5R2FsbGVyeShxdWVyeTogUXVlcnksIG9wdGlvbnM6IElHYWxsZXJ5UXVlcnlPcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElQYWdlZE1vZGVsPElFeHRlbnNpb24+PiB7XG5cdFx0Y29uc3QgaGFzVXNlckRlZmluZWRTb3J0T3JkZXIgPSBvcHRpb25zLnNvcnRCeSAhPT0gdW5kZWZpbmVkO1xuXHRcdGlmICghaGFzVXNlckRlZmluZWRTb3J0T3JkZXIgJiYgIXF1ZXJ5LnZhbHVlLnRyaW0oKSkge1xuXHRcdFx0b3B0aW9ucy5zb3J0QnkgPSBHYWxsZXJ5U29ydEJ5Lkluc3RhbGxDb3VudDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5pc1JlY29tbWVuZGF0aW9uc1F1ZXJ5KHF1ZXJ5KSkge1xuXHRcdFx0cmV0dXJuIHRoaXMucXVlcnlSZWNvbW1lbmRhdGlvbnMocXVlcnksIG9wdGlvbnMsIHRva2VuKTtcblx0XHR9XG5cblx0XHRjb25zdCB0ZXh0ID0gcXVlcnkudmFsdWU7XG5cblx0XHRpZiAoIXRleHQpIHtcblx0XHRcdG9wdGlvbnMuc291cmNlID0gJ3ZpZXdsZXQnO1xuXHRcdFx0Y29uc3QgcGFnZXIgPSBhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnF1ZXJ5R2FsbGVyeShvcHRpb25zLCB0b2tlbik7XG5cdFx0XHRyZXR1cm4gbmV3IFBhZ2VkTW9kZWwocGFnZXIpO1xuXHRcdH1cblxuXHRcdGlmICgvXFxiZXh0OihbXlxcc10rKVxcYi9nLnRlc3QodGV4dCkpIHtcblx0XHRcdG9wdGlvbnMudGV4dCA9IHRleHQ7XG5cdFx0XHRvcHRpb25zLnNvdXJjZSA9ICdmaWxlLWV4dGVuc2lvbi10YWdzJztcblx0XHRcdGNvbnN0IHBhZ2VyID0gYXdhaXQgdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5xdWVyeUdhbGxlcnkob3B0aW9ucywgdG9rZW4pO1xuXHRcdFx0cmV0dXJuIG5ldyBQYWdlZE1vZGVsKHBhZ2VyKTtcblx0XHR9XG5cblx0XHRvcHRpb25zLnRleHQgPSB0ZXh0LnN1YnN0cmluZygwLCAzNTApO1xuXHRcdG9wdGlvbnMuc291cmNlID0gJ3NlYXJjaFRleHQnO1xuXG5cdFx0aWYgKGhhc1VzZXJEZWZpbmVkU29ydE9yZGVyIHx8IC9cXGIoY2F0ZWdvcnl8dGFnKTooW15cXHNdKylcXGIvZ2kudGVzdCh0ZXh0KSB8fCAvXFxiZmVhdHVyZWQoXFxzK3xcXGJ8JCkvZ2kudGVzdCh0ZXh0KSkge1xuXHRcdFx0Y29uc3QgcGFnZXIgPSBhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnF1ZXJ5R2FsbGVyeShvcHRpb25zLCB0b2tlbik7XG5cdFx0XHRyZXR1cm4gbmV3IFBhZ2VkTW9kZWwocGFnZXIpO1xuXHRcdH1cblxuXHRcdGNvbnN0IFtwYWdlciwgcHJlZmVycmVkRXh0ZW5zaW9uc10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHR0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnF1ZXJ5R2FsbGVyeShvcHRpb25zLCB0b2tlbiksXG5cdFx0XHR0aGlzLmdldFByZWZlcnJlZEV4dGVuc2lvbnMob3B0aW9ucy50ZXh0LnRvTG93ZXJDYXNlKCksIHRva2VuKS5jYXRjaCgoKSA9PiBbXSlcblx0XHRdKTtcblxuXHRcdHJldHVybiBwcmVmZXJyZWRFeHRlbnNpb25zLmxlbmd0aCA/IG5ldyBQcmVmZXJyZWRFeHRlbnNpb25zUGFnZWRNb2RlbChwcmVmZXJyZWRFeHRlbnNpb25zLCBwYWdlcikgOiBuZXcgUGFnZWRNb2RlbChwYWdlcik7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldFByZWZlcnJlZEV4dGVuc2lvbnMoc2VhcmNoVGV4dDogc3RyaW5nLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElFeHRlbnNpb25bXT4ge1xuXHRcdGNvbnN0IHByZWZlcnJlZEV4dGVuc2lvbnMgPSB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmxvY2FsLmZpbHRlcihlID0+ICFlLmlzQnVpbHRpbiAmJiAoZS5uYW1lLnRvTG93ZXJDYXNlKCkuaW5kZXhPZihzZWFyY2hUZXh0KSA+IC0xIHx8IGUuZGlzcGxheU5hbWUudG9Mb3dlckNhc2UoKS5pbmRleE9mKHNlYXJjaFRleHQpID4gLTEgfHwgZS5kZXNjcmlwdGlvbi50b0xvd2VyQ2FzZSgpLmluZGV4T2Yoc2VhcmNoVGV4dCkgPiAtMSkpO1xuXHRcdGNvbnN0IHByZWZlcnJlZEV4dGVuc2lvblVVSURzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cblx0XHRpZiAocHJlZmVycmVkRXh0ZW5zaW9ucy5sZW5ndGgpIHtcblx0XHRcdC8vIFVwZGF0ZSBnYWxsZXJ5IGRhdGEgZm9yIHByZWZlcnJlZCBleHRlbnNpb25zIGlmIHRoZXkgYXJlIG5vdCB5ZXQgZmV0Y2hlZFxuXHRcdFx0Y29uc3QgZXh0ZXNpb25zVG9GZXRjaDogSUV4dGVuc2lvbklkZW50aWZpZXJbXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgcHJlZmVycmVkRXh0ZW5zaW9ucykge1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uLmlkZW50aWZpZXIudXVpZCkge1xuXHRcdFx0XHRcdHByZWZlcnJlZEV4dGVuc2lvblVVSURzLmFkZChleHRlbnNpb24uaWRlbnRpZmllci51dWlkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIWV4dGVuc2lvbi5nYWxsZXJ5ICYmIGV4dGVuc2lvbi5pZGVudGlmaWVyLnV1aWQpIHtcblx0XHRcdFx0XHRleHRlc2lvbnNUb0ZldGNoLnB1c2goZXh0ZW5zaW9uLmlkZW50aWZpZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoZXh0ZXNpb25zVG9GZXRjaC5sZW5ndGgpIHtcblx0XHRcdFx0dGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5nZXRFeHRlbnNpb25zKGV4dGVzaW9uc1RvRmV0Y2gsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpLmNhdGNoKGUgPT4gbnVsbC8qaWdub3JlIGVycm9yKi8pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHByZWZlcnJlZFJlc3VsdHM6IHN0cmluZ1tdID0gW107XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IG1hbmlmZXN0ID0gYXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0KCk7XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShtYW5pZmVzdC5zZWFyY2gpKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgcyBvZiBtYW5pZmVzdC5zZWFyY2gpIHtcblx0XHRcdFx0XHRpZiAocy5xdWVyeSAmJiBzLnF1ZXJ5LnRvTG93ZXJDYXNlKCkgPT09IHNlYXJjaFRleHQgJiYgQXJyYXkuaXNBcnJheShzLnByZWZlcnJlZFJlc3VsdHMpKSB7XG5cdFx0XHRcdFx0XHRwcmVmZXJyZWRSZXN1bHRzLnB1c2goLi4ucy5wcmVmZXJyZWRSZXN1bHRzKTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKHByZWZlcnJlZFJlc3VsdHMubGVuZ3RoKSB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhwcmVmZXJyZWRSZXN1bHRzLm1hcChpZCA9PiAoeyBpZCB9KSksIHRva2VuKTtcblx0XHRcdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgcmVzdWx0KSB7XG5cdFx0XHRcdFx0aWYgKGV4dGVuc2lvbi5pZGVudGlmaWVyLnV1aWQgJiYgIXByZWZlcnJlZEV4dGVuc2lvblVVSURzLmhhcyhleHRlbnNpb24uaWRlbnRpZmllci51dWlkKSkge1xuXHRcdFx0XHRcdFx0cHJlZmVycmVkRXh0ZW5zaW9ucy5wdXNoKGV4dGVuc2lvbik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLndhcm4oJ0ZhaWxlZCB0byBnZXQgcHJlZmVycmVkIHJlc3VsdHMgZnJvbSB0aGUgZXh0ZW5zaW9ucyBjb250cm9sIG1hbmlmZXN0LicsIGUpO1xuXHRcdH1cblxuXHRcdHJldHVybiBwcmVmZXJyZWRFeHRlbnNpb25zO1xuXHR9XG5cblx0cHJpdmF0ZSBzb3J0RXh0ZW5zaW9ucyhleHRlbnNpb25zOiBJRXh0ZW5zaW9uW10sIG9wdGlvbnM6IElRdWVyeU9wdGlvbnMpOiBJRXh0ZW5zaW9uW10ge1xuXHRcdHN3aXRjaCAob3B0aW9ucy5zb3J0QnkpIHtcblx0XHRcdGNhc2UgR2FsbGVyeVNvcnRCeS5JbnN0YWxsQ291bnQ6XG5cdFx0XHRcdGV4dGVuc2lvbnMgPSBleHRlbnNpb25zLnNvcnQoKGUxLCBlMikgPT4gdHlwZW9mIGUyLmluc3RhbGxDb3VudCA9PT0gJ251bWJlcicgJiYgdHlwZW9mIGUxLmluc3RhbGxDb3VudCA9PT0gJ251bWJlcicgPyBlMi5pbnN0YWxsQ291bnQgLSBlMS5pbnN0YWxsQ291bnQgOiBOYU4pO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgTG9jYWxTb3J0QnkuVXBkYXRlRGF0ZTpcblx0XHRcdFx0ZXh0ZW5zaW9ucyA9IGV4dGVuc2lvbnMuc29ydCgoZTEsIGUyKSA9PlxuXHRcdFx0XHRcdHR5cGVvZiBlMi5sb2NhbD8uaW5zdGFsbGVkVGltZXN0YW1wID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgZTEubG9jYWw/Lmluc3RhbGxlZFRpbWVzdGFtcCA9PT0gJ251bWJlcicgPyBlMi5sb2NhbC5pbnN0YWxsZWRUaW1lc3RhbXAgLSBlMS5sb2NhbC5pbnN0YWxsZWRUaW1lc3RhbXAgOlxuXHRcdFx0XHRcdFx0dHlwZW9mIGUyLmxvY2FsPy5pbnN0YWxsZWRUaW1lc3RhbXAgPT09ICdudW1iZXInID8gMSA6XG5cdFx0XHRcdFx0XHRcdHR5cGVvZiBlMS5sb2NhbD8uaW5zdGFsbGVkVGltZXN0YW1wID09PSAnbnVtYmVyJyA/IC0xIDogTmFOKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIEdhbGxlcnlTb3J0QnkuQXZlcmFnZVJhdGluZzpcblx0XHRcdGNhc2UgR2FsbGVyeVNvcnRCeS5XZWlnaHRlZFJhdGluZzpcblx0XHRcdFx0ZXh0ZW5zaW9ucyA9IGV4dGVuc2lvbnMuc29ydCgoZTEsIGUyKSA9PiB0eXBlb2YgZTIucmF0aW5nID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgZTEucmF0aW5nID09PSAnbnVtYmVyJyA/IGUyLnJhdGluZyAtIGUxLnJhdGluZyA6IE5hTik7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0ZXh0ZW5zaW9ucyA9IGV4dGVuc2lvbnMuc29ydCgoZTEsIGUyKSA9PiBlMS5kaXNwbGF5TmFtZS5sb2NhbGVDb21wYXJlKGUyLmRpc3BsYXlOYW1lKSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblx0XHRpZiAob3B0aW9ucy5zb3J0T3JkZXIgPT09IFNvcnRPcmRlci5EZXNjZW5kaW5nKSB7XG5cdFx0XHRleHRlbnNpb25zID0gZXh0ZW5zaW9ucy5yZXZlcnNlKCk7XG5cdFx0fVxuXHRcdHJldHVybiBleHRlbnNpb25zO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1JlY29tbWVuZGF0aW9uc1F1ZXJ5KHF1ZXJ5OiBRdWVyeSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBFeHRlbnNpb25zTGlzdFZpZXcuaXNXb3Jrc3BhY2VSZWNvbW1lbmRlZEV4dGVuc2lvbnNRdWVyeShxdWVyeS52YWx1ZSlcblx0XHRcdHx8IEV4dGVuc2lvbnNMaXN0Vmlldy5pc0tleW1hcHNSZWNvbW1lbmRlZEV4dGVuc2lvbnNRdWVyeShxdWVyeS52YWx1ZSlcblx0XHRcdHx8IEV4dGVuc2lvbnNMaXN0Vmlldy5pc0xhbmd1YWdlUmVjb21tZW5kZWRFeHRlbnNpb25zUXVlcnkocXVlcnkudmFsdWUpXG5cdFx0XHR8fCBFeHRlbnNpb25zTGlzdFZpZXcuaXNFeGVSZWNvbW1lbmRlZEV4dGVuc2lvbnNRdWVyeShxdWVyeS52YWx1ZSlcblx0XHRcdHx8IEV4dGVuc2lvbnNMaXN0Vmlldy5pc1JlbW90ZVJlY29tbWVuZGVkRXh0ZW5zaW9uc1F1ZXJ5KHF1ZXJ5LnZhbHVlKVxuXHRcdFx0fHwgL0ByZWNvbW1lbmRlZDphbGwvaS50ZXN0KHF1ZXJ5LnZhbHVlKVxuXHRcdFx0fHwgRXh0ZW5zaW9uc0xpc3RWaWV3LmlzU2VhcmNoUmVjb21tZW5kZWRFeHRlbnNpb25zUXVlcnkocXVlcnkudmFsdWUpXG5cdFx0XHR8fCBFeHRlbnNpb25zTGlzdFZpZXcuaXNSZWNvbW1lbmRlZEV4dGVuc2lvbnNRdWVyeShxdWVyeS52YWx1ZSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHF1ZXJ5UmVjb21tZW5kYXRpb25zKHF1ZXJ5OiBRdWVyeSwgb3B0aW9uczogSVF1ZXJ5T3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJUGFnZWRNb2RlbDxJRXh0ZW5zaW9uPj4ge1xuXHRcdC8vIFdvcmtzcGFjZSByZWNvbW1lbmRhdGlvbnNcblx0XHRpZiAoRXh0ZW5zaW9uc0xpc3RWaWV3LmlzV29ya3NwYWNlUmVjb21tZW5kZWRFeHRlbnNpb25zUXVlcnkocXVlcnkudmFsdWUpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5nZXRXb3Jrc3BhY2VSZWNvbW1lbmRhdGlvbnNNb2RlbChxdWVyeSwgb3B0aW9ucywgdG9rZW4pO1xuXHRcdH1cblxuXHRcdC8vIEtleW1hcCByZWNvbW1lbmRhdGlvbnNcblx0XHRpZiAoRXh0ZW5zaW9uc0xpc3RWaWV3LmlzS2V5bWFwc1JlY29tbWVuZGVkRXh0ZW5zaW9uc1F1ZXJ5KHF1ZXJ5LnZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0S2V5bWFwUmVjb21tZW5kYXRpb25zTW9kZWwocXVlcnksIG9wdGlvbnMsIHRva2VuKTtcblx0XHR9XG5cblx0XHQvLyBMYW5ndWFnZSByZWNvbW1lbmRhdGlvbnNcblx0XHRpZiAoRXh0ZW5zaW9uc0xpc3RWaWV3LmlzTGFuZ3VhZ2VSZWNvbW1lbmRlZEV4dGVuc2lvbnNRdWVyeShxdWVyeS52YWx1ZSkpIHtcblx0XHRcdHJldHVybiB0aGlzLmdldExhbmd1YWdlUmVjb21tZW5kYXRpb25zTW9kZWwocXVlcnksIG9wdGlvbnMsIHRva2VuKTtcblx0XHR9XG5cblx0XHQvLyBFeGUgcmVjb21tZW5kYXRpb25zXG5cdFx0aWYgKEV4dGVuc2lvbnNMaXN0Vmlldy5pc0V4ZVJlY29tbWVuZGVkRXh0ZW5zaW9uc1F1ZXJ5KHF1ZXJ5LnZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0RXhlUmVjb21tZW5kYXRpb25zTW9kZWwocXVlcnksIG9wdGlvbnMsIHRva2VuKTtcblx0XHR9XG5cblx0XHQvLyBSZW1vdGUgcmVjb21tZW5kYXRpb25zXG5cdFx0aWYgKEV4dGVuc2lvbnNMaXN0Vmlldy5pc1JlbW90ZVJlY29tbWVuZGVkRXh0ZW5zaW9uc1F1ZXJ5KHF1ZXJ5LnZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0UmVtb3RlUmVjb21tZW5kYXRpb25zTW9kZWwocXVlcnksIG9wdGlvbnMsIHRva2VuKTtcblx0XHR9XG5cblx0XHQvLyBBbGwgcmVjb21tZW5kYXRpb25zXG5cdFx0aWYgKC9AcmVjb21tZW5kZWQ6YWxsL2kudGVzdChxdWVyeS52YWx1ZSkpIHtcblx0XHRcdHJldHVybiB0aGlzLmdldEFsbFJlY29tbWVuZGF0aW9uc01vZGVsKG9wdGlvbnMsIHRva2VuKTtcblx0XHR9XG5cblx0XHQvLyBTZWFyY2ggcmVjb21tZW5kYXRpb25zXG5cdFx0aWYgKEV4dGVuc2lvbnNMaXN0Vmlldy5pc1NlYXJjaFJlY29tbWVuZGVkRXh0ZW5zaW9uc1F1ZXJ5KHF1ZXJ5LnZhbHVlKSB8fFxuXHRcdFx0KEV4dGVuc2lvbnNMaXN0Vmlldy5pc1JlY29tbWVuZGVkRXh0ZW5zaW9uc1F1ZXJ5KHF1ZXJ5LnZhbHVlKSAmJiBvcHRpb25zLnNvcnRCeSAhPT0gdW5kZWZpbmVkKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuc2VhcmNoUmVjb21tZW5kYXRpb25zKHF1ZXJ5LCBvcHRpb25zLCB0b2tlbik7XG5cdFx0fVxuXG5cdFx0Ly8gT3RoZXIgcmVjb21tZW5kYXRpb25zXG5cdFx0aWYgKEV4dGVuc2lvbnNMaXN0Vmlldy5pc1JlY29tbWVuZGVkRXh0ZW5zaW9uc1F1ZXJ5KHF1ZXJ5LnZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0T3RoZXJSZWNvbW1lbmRhdGlvbnNNb2RlbChxdWVyeSwgb3B0aW9ucywgdG9rZW4pO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgUGFnZWRNb2RlbChbXSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgZ2V0SW5zdGFsbGFibGVSZWNvbW1lbmRhdGlvbnMocmVjb21tZW5kYXRpb25zOiBBcnJheTxzdHJpbmcgfCBVUkk+LCBvcHRpb25zOiBJUXVlcnlPcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElFeHRlbnNpb25bXT4ge1xuXHRcdGNvbnN0IHJlc3VsdDogSUV4dGVuc2lvbltdID0gW107XG5cdFx0aWYgKHJlY29tbWVuZGF0aW9ucy5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IGdhbGxlcnlFeHRlbnNpb25zOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VFeHRlbnNpb25zOiBVUklbXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCByZWNvbW1lbmRhdGlvbiBvZiByZWNvbW1lbmRhdGlvbnMpIHtcblx0XHRcdFx0aWYgKHR5cGVvZiByZWNvbW1lbmRhdGlvbiA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRnYWxsZXJ5RXh0ZW5zaW9ucy5wdXNoKHJlY29tbWVuZGF0aW9uKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXNvdXJjZUV4dGVuc2lvbnMucHVzaChyZWNvbW1lbmRhdGlvbik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChnYWxsZXJ5RXh0ZW5zaW9ucy5sZW5ndGgpIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCBleHRlbnNpb25zID0gYXdhaXQgdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5nZXRFeHRlbnNpb25zKGdhbGxlcnlFeHRlbnNpb25zLm1hcChpZCA9PiAoeyBpZCB9KSksIHsgc291cmNlOiBvcHRpb25zLnNvdXJjZSB9LCB0b2tlbik7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgZXh0ZW5zaW9ucykge1xuXHRcdFx0XHRcdFx0aWYgKGV4dGVuc2lvbi5nYWxsZXJ5ICYmICFleHRlbnNpb24uZGVwcmVjYXRpb25JbmZvXG5cdFx0XHRcdFx0XHRcdCYmIGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuY2FuSW5zdGFsbChleHRlbnNpb24uZ2FsbGVyeSkgPT09IHRydWUpIHtcblx0XHRcdFx0XHRcdFx0cmVzdWx0LnB1c2goZXh0ZW5zaW9uKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0aWYgKCFyZXNvdXJjZUV4dGVuc2lvbnMubGVuZ3RoIHx8ICF0aGlzLmlzT2ZmbGluZUVycm9yKGVycm9yKSkge1xuXHRcdFx0XHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAocmVzb3VyY2VFeHRlbnNpb25zLmxlbmd0aCkge1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25zID0gYXdhaXQgdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5nZXRSZXNvdXJjZUV4dGVuc2lvbnMocmVzb3VyY2VFeHRlbnNpb25zLCB0cnVlKTtcblx0XHRcdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgZXh0ZW5zaW9ucykge1xuXHRcdFx0XHRcdGlmIChhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmNhbkluc3RhbGwoZXh0ZW5zaW9uKSA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRcdFx0cmVzdWx0LnB1c2goZXh0ZW5zaW9uKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBnZXRXb3Jrc3BhY2VSZWNvbW1lbmRhdGlvbnMoKTogUHJvbWlzZTxBcnJheTxzdHJpbmcgfCBVUkk+PiB7XG5cdFx0Y29uc3QgcmVjb21tZW5kYXRpb25zID0gYXdhaXQgdGhpcy5leHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLmdldFdvcmtzcGFjZVJlY29tbWVuZGF0aW9ucygpO1xuXHRcdGNvbnN0IHsgaW1wb3J0YW50IH0gPSBhd2FpdCB0aGlzLmV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UuZ2V0Q29uZmlnQmFzZWRSZWNvbW1lbmRhdGlvbnMoKTtcblx0XHRmb3IgKGNvbnN0IGNvbmZpZ0Jhc2VkUmVjb21tZW5kYXRpb24gb2YgaW1wb3J0YW50KSB7XG5cdFx0XHRpZiAoIXJlY29tbWVuZGF0aW9ucy5maW5kKGV4dGVuc2lvbklkID0+IGV4dGVuc2lvbklkID09PSBjb25maWdCYXNlZFJlY29tbWVuZGF0aW9uKSkge1xuXHRcdFx0XHRyZWNvbW1lbmRhdGlvbnMucHVzaChjb25maWdCYXNlZFJlY29tbWVuZGF0aW9uKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlY29tbWVuZGF0aW9ucztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0V29ya3NwYWNlUmVjb21tZW5kYXRpb25zTW9kZWwocXVlcnk6IFF1ZXJ5LCBvcHRpb25zOiBJUXVlcnlPcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElQYWdlZE1vZGVsPElFeHRlbnNpb24+PiB7XG5cdFx0Y29uc3QgcmVjb21tZW5kYXRpb25zID0gYXdhaXQgdGhpcy5nZXRXb3Jrc3BhY2VSZWNvbW1lbmRhdGlvbnMoKTtcblx0XHRjb25zdCBpbnN0YWxsYWJsZVJlY29tbWVuZGF0aW9ucyA9IChhd2FpdCB0aGlzLmdldEluc3RhbGxhYmxlUmVjb21tZW5kYXRpb25zKHJlY29tbWVuZGF0aW9ucywgeyAuLi5vcHRpb25zLCBzb3VyY2U6ICdyZWNvbW1lbmRhdGlvbnMtd29ya3NwYWNlJyB9LCB0b2tlbikpO1xuXHRcdHJldHVybiBuZXcgUGFnZWRNb2RlbChpbnN0YWxsYWJsZVJlY29tbWVuZGF0aW9ucyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldEtleW1hcFJlY29tbWVuZGF0aW9uc01vZGVsKHF1ZXJ5OiBRdWVyeSwgb3B0aW9uczogSVF1ZXJ5T3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJUGFnZWRNb2RlbDxJRXh0ZW5zaW9uPj4ge1xuXHRcdGNvbnN0IHZhbHVlID0gcXVlcnkudmFsdWUucmVwbGFjZSgvQHJlY29tbWVuZGVkOmtleW1hcHMvZywgJycpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuXHRcdGNvbnN0IHJlY29tbWVuZGF0aW9ucyA9IHRoaXMuZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZS5nZXRLZXltYXBSZWNvbW1lbmRhdGlvbnMoKTtcblx0XHRjb25zdCBpbnN0YWxsYWJsZVJlY29tbWVuZGF0aW9ucyA9IChhd2FpdCB0aGlzLmdldEluc3RhbGxhYmxlUmVjb21tZW5kYXRpb25zKHJlY29tbWVuZGF0aW9ucywgeyAuLi5vcHRpb25zLCBzb3VyY2U6ICdyZWNvbW1lbmRhdGlvbnMta2V5bWFwcycgfSwgdG9rZW4pKVxuXHRcdFx0LmZpbHRlcihleHRlbnNpb24gPT4gZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKS5pbmRleE9mKHZhbHVlKSA+IC0xKTtcblx0XHRyZXR1cm4gbmV3IFBhZ2VkTW9kZWwoaW5zdGFsbGFibGVSZWNvbW1lbmRhdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRMYW5ndWFnZVJlY29tbWVuZGF0aW9uc01vZGVsKHF1ZXJ5OiBRdWVyeSwgb3B0aW9uczogSVF1ZXJ5T3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJUGFnZWRNb2RlbDxJRXh0ZW5zaW9uPj4ge1xuXHRcdGNvbnN0IHZhbHVlID0gcXVlcnkudmFsdWUucmVwbGFjZSgvQHJlY29tbWVuZGVkOmxhbmd1YWdlcy9nLCAnJykudHJpbSgpLnRvTG93ZXJDYXNlKCk7XG5cdFx0Y29uc3QgcmVjb21tZW5kYXRpb25zID0gdGhpcy5leHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLmdldExhbmd1YWdlUmVjb21tZW5kYXRpb25zKCk7XG5cdFx0Y29uc3QgaW5zdGFsbGFibGVSZWNvbW1lbmRhdGlvbnMgPSAoYXdhaXQgdGhpcy5nZXRJbnN0YWxsYWJsZVJlY29tbWVuZGF0aW9ucyhyZWNvbW1lbmRhdGlvbnMsIHsgLi4ub3B0aW9ucywgc291cmNlOiAncmVjb21tZW5kYXRpb25zLWxhbmd1YWdlcycgfSwgdG9rZW4pKVxuXHRcdFx0LmZpbHRlcihleHRlbnNpb24gPT4gZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKS5pbmRleE9mKHZhbHVlKSA+IC0xKTtcblx0XHRyZXR1cm4gbmV3IFBhZ2VkTW9kZWwoaW5zdGFsbGFibGVSZWNvbW1lbmRhdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRSZW1vdGVSZWNvbW1lbmRhdGlvbnNNb2RlbChxdWVyeTogUXVlcnksIG9wdGlvbnM6IElRdWVyeU9wdGlvbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVBhZ2VkTW9kZWw8SUV4dGVuc2lvbj4+IHtcblx0XHRjb25zdCB2YWx1ZSA9IHF1ZXJ5LnZhbHVlLnJlcGxhY2UoL0ByZWNvbW1lbmRlZDpyZW1vdGVzL2csICcnKS50cmltKCkudG9Mb3dlckNhc2UoKTtcblx0XHRjb25zdCByZWNvbW1lbmRhdGlvbnMgPSB0aGlzLmV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UuZ2V0UmVtb3RlUmVjb21tZW5kYXRpb25zKCk7XG5cdFx0Y29uc3QgaW5zdGFsbGFibGVSZWNvbW1lbmRhdGlvbnMgPSAoYXdhaXQgdGhpcy5nZXRJbnN0YWxsYWJsZVJlY29tbWVuZGF0aW9ucyhyZWNvbW1lbmRhdGlvbnMsIHsgLi4ub3B0aW9ucywgc291cmNlOiAncmVjb21tZW5kYXRpb25zLXJlbW90ZXMnIH0sIHRva2VuKSlcblx0XHRcdC5maWx0ZXIoZXh0ZW5zaW9uID0+IGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLnRvTG93ZXJDYXNlKCkuaW5kZXhPZih2YWx1ZSkgPiAtMSk7XG5cdFx0cmV0dXJuIG5ldyBQYWdlZE1vZGVsKGluc3RhbGxhYmxlUmVjb21tZW5kYXRpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0RXhlUmVjb21tZW5kYXRpb25zTW9kZWwocXVlcnk6IFF1ZXJ5LCBvcHRpb25zOiBJUXVlcnlPcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElQYWdlZE1vZGVsPElFeHRlbnNpb24+PiB7XG5cdFx0Y29uc3QgZXhlID0gcXVlcnkudmFsdWUucmVwbGFjZSgvQGV4ZTovZywgJycpLnRyaW0oKS50b0xvd2VyQ2FzZSgpO1xuXHRcdGNvbnN0IHsgaW1wb3J0YW50LCBvdGhlcnMgfSA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZS5nZXRFeGVCYXNlZFJlY29tbWVuZGF0aW9ucyhleGUuc3RhcnRzV2l0aCgnXCInKSA/IGV4ZS5zdWJzdHJpbmcoMSwgZXhlLmxlbmd0aCAtIDEpIDogZXhlKTtcblx0XHRjb25zdCBpbnN0YWxsYWJsZVJlY29tbWVuZGF0aW9ucyA9IGF3YWl0IHRoaXMuZ2V0SW5zdGFsbGFibGVSZWNvbW1lbmRhdGlvbnMoWy4uLmltcG9ydGFudCwgLi4ub3RoZXJzXSwgeyAuLi5vcHRpb25zLCBzb3VyY2U6ICdyZWNvbW1lbmRhdGlvbnMtZXhlJyB9LCB0b2tlbik7XG5cdFx0cmV0dXJuIG5ldyBQYWdlZE1vZGVsKGluc3RhbGxhYmxlUmVjb21tZW5kYXRpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0T3RoZXJSZWNvbW1lbmRhdGlvbnNNb2RlbChxdWVyeTogUXVlcnksIG9wdGlvbnM6IElRdWVyeU9wdGlvbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVBhZ2VkTW9kZWw8SUV4dGVuc2lvbj4+IHtcblx0XHRjb25zdCBvdGhlclJlY29tbWVuZGF0aW9ucyA9IGF3YWl0IHRoaXMuZ2V0T3RoZXJSZWNvbW1lbmRhdGlvbnMoKTtcblx0XHRjb25zdCBpbnN0YWxsYWJsZVJlY29tbWVuZGF0aW9ucyA9IGF3YWl0IHRoaXMuZ2V0SW5zdGFsbGFibGVSZWNvbW1lbmRhdGlvbnMob3RoZXJSZWNvbW1lbmRhdGlvbnMsIHsgLi4ub3B0aW9ucywgc291cmNlOiAncmVjb21tZW5kYXRpb25zLW90aGVyJywgc29ydEJ5OiB1bmRlZmluZWQgfSwgdG9rZW4pO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGNvYWxlc2NlKG90aGVyUmVjb21tZW5kYXRpb25zLm1hcChpZCA9PiBpbnN0YWxsYWJsZVJlY29tbWVuZGF0aW9ucy5maW5kKGkgPT4gYXJlU2FtZUV4dGVuc2lvbnMoaS5pZGVudGlmaWVyLCB7IGlkIH0pKSkpO1xuXHRcdHJldHVybiBuZXcgUGFnZWRNb2RlbChyZXN1bHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRPdGhlclJlY29tbWVuZGF0aW9ucygpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG5cdFx0Y29uc3QgbG9jYWwgPSAoYXdhaXQgdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5xdWVyeUxvY2FsKHRoaXMub3B0aW9ucy5zZXJ2ZXIpKVxuXHRcdFx0Lm1hcChlID0+IGUuaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpKTtcblx0XHRjb25zdCB3b3Jrc3BhY2VSZWNvbW1lbmRhdGlvbnMgPSAoYXdhaXQgdGhpcy5nZXRXb3Jrc3BhY2VSZWNvbW1lbmRhdGlvbnMoKSlcblx0XHRcdC5tYXAoZXh0ZW5zaW9uSWQgPT4gaXNTdHJpbmcoZXh0ZW5zaW9uSWQpID8gZXh0ZW5zaW9uSWQudG9Mb3dlckNhc2UoKSA6IGV4dGVuc2lvbklkKTtcblxuXHRcdHJldHVybiBkaXN0aW5jdChcblx0XHRcdChhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHRcdC8vIE9yZGVyIGlzIGltcG9ydGFudFxuXHRcdFx0XHR0aGlzLmV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UuZ2V0SW1wb3J0YW50UmVjb21tZW5kYXRpb25zKCksXG5cdFx0XHRcdHRoaXMuZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZS5nZXRGaWxlQmFzZWRSZWNvbW1lbmRhdGlvbnMoKSxcblx0XHRcdFx0dGhpcy5leHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLmdldE90aGVyUmVjb21tZW5kYXRpb25zKClcblx0XHRcdF0pKS5mbGF0KCkuZmlsdGVyKGV4dGVuc2lvbklkID0+ICFsb2NhbC5pbmNsdWRlcyhleHRlbnNpb25JZC50b0xvd2VyQ2FzZSgpKSAmJiAhd29ya3NwYWNlUmVjb21tZW5kYXRpb25zLmluY2x1ZGVzKGV4dGVuc2lvbklkLnRvTG93ZXJDYXNlKCkpXG5cdFx0XHQpLCBleHRlbnNpb25JZCA9PiBleHRlbnNpb25JZC50b0xvd2VyQ2FzZSgpKTtcblx0fVxuXG5cdC8vIEdldCBBbGwgdHlwZXMgb2YgcmVjb21tZW5kYXRpb25zLCB0cmltbWVkIHRvIHNob3cgYSBtYXggb2YgOCBhdCBhbnkgZ2l2ZW4gdGltZVxuXHRwcml2YXRlIGFzeW5jIGdldEFsbFJlY29tbWVuZGF0aW9uc01vZGVsKG9wdGlvbnM6IElRdWVyeU9wdGlvbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVBhZ2VkTW9kZWw8SUV4dGVuc2lvbj4+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnF1ZXJ5TG9jYWwodGhpcy5vcHRpb25zLnNlcnZlcik7XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25JZHMgPSBsb2NhbEV4dGVuc2lvbnMubWFwKGUgPT4gZS5pZGVudGlmaWVyLmlkLnRvTG93ZXJDYXNlKCkpO1xuXG5cdFx0Y29uc3QgYWxsUmVjb21tZW5kYXRpb25zID0gZGlzdGluY3QoXG5cdFx0XHQoYXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0XHQvLyBPcmRlciBpcyBpbXBvcnRhbnRcblx0XHRcdFx0dGhpcy5nZXRXb3Jrc3BhY2VSZWNvbW1lbmRhdGlvbnMoKSxcblx0XHRcdFx0dGhpcy5leHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLmdldEltcG9ydGFudFJlY29tbWVuZGF0aW9ucygpLFxuXHRcdFx0XHR0aGlzLmV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UuZ2V0RmlsZUJhc2VkUmVjb21tZW5kYXRpb25zKCksXG5cdFx0XHRcdHRoaXMuZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZS5nZXRPdGhlclJlY29tbWVuZGF0aW9ucygpXG5cdFx0XHRdKSkuZmxhdCgpLmZpbHRlcihleHRlbnNpb25JZCA9PiB7XG5cdFx0XHRcdGlmIChpc1N0cmluZyhleHRlbnNpb25JZCkpIHtcblx0XHRcdFx0XHRyZXR1cm4gIWxvY2FsRXh0ZW5zaW9uSWRzLmluY2x1ZGVzKGV4dGVuc2lvbklkLnRvTG93ZXJDYXNlKCkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiAhbG9jYWxFeHRlbnNpb25zLnNvbWUobG9jYWxFeHRlbnNpb24gPT4gbG9jYWxFeHRlbnNpb24ubG9jYWwgJiYgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwobG9jYWxFeHRlbnNpb24ubG9jYWwubG9jYXRpb24sIGV4dGVuc2lvbklkKSk7XG5cdFx0XHR9KSk7XG5cblx0XHRjb25zdCBpbnN0YWxsYWJsZVJlY29tbWVuZGF0aW9ucyA9IGF3YWl0IHRoaXMuZ2V0SW5zdGFsbGFibGVSZWNvbW1lbmRhdGlvbnMoYWxsUmVjb21tZW5kYXRpb25zLCB7IC4uLm9wdGlvbnMsIHNvdXJjZTogJ3JlY29tbWVuZGF0aW9ucy1hbGwnLCBzb3J0Qnk6IHVuZGVmaW5lZCB9LCB0b2tlbik7XG5cblx0XHRjb25zdCByZXN1bHQ6IElFeHRlbnNpb25bXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgaW5zdGFsbGFibGVSZWNvbW1lbmRhdGlvbnMubGVuZ3RoICYmIHJlc3VsdC5sZW5ndGggPCA4OyBpKyspIHtcblx0XHRcdGNvbnN0IHJlY29tbWVuZGF0aW9uID0gYWxsUmVjb21tZW5kYXRpb25zW2ldO1xuXHRcdFx0aWYgKGlzU3RyaW5nKHJlY29tbWVuZGF0aW9uKSkge1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb24gPSBpbnN0YWxsYWJsZVJlY29tbWVuZGF0aW9ucy5maW5kKGV4dGVuc2lvbiA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhleHRlbnNpb24uaWRlbnRpZmllciwgeyBpZDogcmVjb21tZW5kYXRpb24gfSkpO1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2goZXh0ZW5zaW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uID0gaW5zdGFsbGFibGVSZWNvbW1lbmRhdGlvbnMuZmluZChleHRlbnNpb24gPT4gZXh0ZW5zaW9uLnJlc291cmNlRXh0ZW5zaW9uICYmIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKGV4dGVuc2lvbi5yZXNvdXJjZUV4dGVuc2lvbi5sb2NhdGlvbiwgcmVjb21tZW5kYXRpb24pKTtcblx0XHRcdFx0aWYgKGV4dGVuc2lvbikge1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKGV4dGVuc2lvbik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IFBhZ2VkTW9kZWwocmVzdWx0KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2VhcmNoUmVjb21tZW5kYXRpb25zKHF1ZXJ5OiBRdWVyeSwgb3B0aW9uczogSVF1ZXJ5T3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJUGFnZWRNb2RlbDxJRXh0ZW5zaW9uPj4ge1xuXHRcdGNvbnN0IHZhbHVlID0gcXVlcnkudmFsdWUucmVwbGFjZSgvQHJlY29tbWVuZGVkL2csICcnKS50cmltKCkudG9Mb3dlckNhc2UoKTtcblx0XHRjb25zdCByZWNvbW1lbmRhdGlvbnMgPSBkaXN0aW5jdChbLi4uYXdhaXQgdGhpcy5nZXRXb3Jrc3BhY2VSZWNvbW1lbmRhdGlvbnMoKSwgLi4uYXdhaXQgdGhpcy5nZXRPdGhlclJlY29tbWVuZGF0aW9ucygpXSk7XG5cdFx0Y29uc3QgaW5zdGFsbGFibGVSZWNvbW1lbmRhdGlvbnMgPSAoYXdhaXQgdGhpcy5nZXRJbnN0YWxsYWJsZVJlY29tbWVuZGF0aW9ucyhyZWNvbW1lbmRhdGlvbnMsIHsgLi4ub3B0aW9ucywgc291cmNlOiAncmVjb21tZW5kYXRpb25zJywgc29ydEJ5OiB1bmRlZmluZWQgfSwgdG9rZW4pKVxuXHRcdFx0LmZpbHRlcihleHRlbnNpb24gPT4gZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKS5pbmRleE9mKHZhbHVlKSA+IC0xKTtcblx0XHRyZXR1cm4gbmV3IFBhZ2VkTW9kZWwodGhpcy5zb3J0RXh0ZW5zaW9ucyhpbnN0YWxsYWJsZVJlY29tbWVuZGF0aW9ucywgb3B0aW9ucykpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXRNb2RlbChtb2RlbDogSVBhZ2VkTW9kZWw8SUV4dGVuc2lvbj4sIG1lc3NhZ2U/OiBNZXNzYWdlLCBkb25vdFJlc2V0U2Nyb2xsVG9wPzogYm9vbGVhbikge1xuXHRcdGlmICh0aGlzLmxpc3QpIHtcblx0XHRcdHRoaXMubGlzdC5tb2RlbCA9IG5ldyBEZWxheWVkUGFnZWRNb2RlbChtb2RlbCk7XG5cdFx0XHR0aGlzLnVwZGF0ZUJvZHkobWVzc2FnZSk7XG5cdFx0XHRpZiAoIWRvbm90UmVzZXRTY3JvbGxUb3ApIHtcblx0XHRcdFx0dGhpcy5saXN0LnNjcm9sbFRvcCA9IDA7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICh0aGlzLmJhZGdlKSB7XG5cdFx0XHR0aGlzLmJhZGdlLnNldENvdW50KHRoaXMuY291bnQoKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVNb2RlbChtb2RlbDogSVBhZ2VkTW9kZWw8SUV4dGVuc2lvbj4pIHtcblx0XHRpZiAodGhpcy5saXN0KSB7XG5cdFx0XHR0aGlzLmxpc3QubW9kZWwgPSBuZXcgRGVsYXllZFBhZ2VkTW9kZWwobW9kZWwpO1xuXHRcdFx0dGhpcy51cGRhdGVCb2R5KCk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLmJhZGdlKSB7XG5cdFx0XHR0aGlzLmJhZGdlLnNldENvdW50KHRoaXMuY291bnQoKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVCb2R5KG1lc3NhZ2U/OiBNZXNzYWdlKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuYm9keVRlbXBsYXRlKSB7XG5cblx0XHRcdGNvbnN0IGNvdW50ID0gdGhpcy5jb3VudCgpO1xuXHRcdFx0dGhpcy5ib2R5VGVtcGxhdGUuZXh0ZW5zaW9uc0xpc3QuY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZGVuJywgY291bnQgPT09IDApO1xuXHRcdFx0dGhpcy5ib2R5VGVtcGxhdGUubWVzc2FnZUNvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdoaWRkZW4nLCAhbWVzc2FnZSAmJiBjb3VudCA+IDApO1xuXG5cdFx0XHRpZiAodGhpcy5pc0JvZHlWaXNpYmxlKCkpIHtcblx0XHRcdFx0aWYgKG1lc3NhZ2UpIHtcblx0XHRcdFx0XHR0aGlzLmJvZHlUZW1wbGF0ZS5tZXNzYWdlU2V2ZXJpdHlJY29uLmNsYXNzTmFtZSA9IFNldmVyaXR5SWNvbi5jbGFzc05hbWUobWVzc2FnZS5zZXZlcml0eSk7XG5cdFx0XHRcdFx0dGhpcy5ib2R5VGVtcGxhdGUubWVzc2FnZUJveC50ZXh0Q29udGVudCA9IG1lc3NhZ2UudGV4dDtcblx0XHRcdFx0fSBlbHNlIGlmICh0aGlzLmNvdW50KCkgPT09IDApIHtcblx0XHRcdFx0XHR0aGlzLmJvZHlUZW1wbGF0ZS5tZXNzYWdlU2V2ZXJpdHlJY29uLmNsYXNzTmFtZSA9ICcnO1xuXHRcdFx0XHRcdHRoaXMuYm9keVRlbXBsYXRlLm1lc3NhZ2VCb3gudGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgnbm8gZXh0ZW5zaW9ucyBmb3VuZCcsIFwiTm8gZXh0ZW5zaW9ucyBmb3VuZC5cIik7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRoaXMuYm9keVRlbXBsYXRlLm1lc3NhZ2VCb3gudGV4dENvbnRlbnQpIHtcblx0XHRcdFx0XHRhbGVydCh0aGlzLmJvZHlUZW1wbGF0ZS5tZXNzYWdlQm94LnRleHRDb250ZW50KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMudXBkYXRlU2l6ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRNZXNzYWdlKGVycm9yOiBhbnkpOiBNZXNzYWdlIHtcblx0XHRpZiAodGhpcy5pc09mZmxpbmVFcnJvcihlcnJvcikpIHtcblx0XHRcdHJldHVybiB7IHRleHQ6IGxvY2FsaXplKCdvZmZsaW5lIGVycm9yJywgXCJVbmFibGUgdG8gc2VhcmNoIHRoZSBNYXJrZXRwbGFjZSB3aGVuIG9mZmxpbmUsIHBsZWFzZSBjaGVjayB5b3VyIG5ldHdvcmsgY29ubmVjdGlvbi5cIiksIHNldmVyaXR5OiBTZXZlcml0eS5XYXJuaW5nIH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB7IHRleHQ6IGxvY2FsaXplKCdlcnJvcicsIFwiRXJyb3Igd2hpbGUgZmV0Y2hpbmcgZXh0ZW5zaW9ucy4gezB9XCIsIGdldEVycm9yTWVzc2FnZShlcnJvcikpLCBzZXZlcml0eTogU2V2ZXJpdHkuRXJyb3IgfTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGlzT2ZmbGluZUVycm9yKGVycm9yOiBFcnJvcik6IGJvb2xlYW4ge1xuXHRcdGlmIChlcnJvciBpbnN0YW5jZW9mIEV4dGVuc2lvbkdhbGxlcnlFcnJvcikge1xuXHRcdFx0cmV0dXJuIGVycm9yLmNvZGUgPT09IEV4dGVuc2lvbkdhbGxlcnlFcnJvckNvZGUuT2ZmbGluZTtcblx0XHR9XG5cdFx0cmV0dXJuIGlzT2ZmbGluZUVycm9yKGVycm9yKTtcblx0fVxuXG5cdHByb3RlY3RlZCB1cGRhdGVTaXplKCkge1xuXHRcdGlmICh0aGlzLm9wdGlvbnMuZmxleGlibGVIZWlnaHQpIHtcblx0XHRcdHRoaXMubWF4aW11bUJvZHlTaXplID0gdGhpcy5saXN0Py5tb2RlbC5sZW5ndGggPyBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkgOiAwO1xuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShgJHt0aGlzLmlkfS5zaXplYCwgdGhpcy5saXN0Py5tb2RlbC5sZW5ndGggfHwgMCwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvcGVuRXh0ZW5zaW9uKGV4dGVuc2lvbjogSUV4dGVuc2lvbiwgb3B0aW9uczogeyBzaWRlQnlzaWRlPzogYm9vbGVhbjsgcHJlc2VydmVGb2N1cz86IGJvb2xlYW47IHBpbm5lZD86IGJvb2xlYW4gfSk6IHZvaWQge1xuXHRcdGV4dGVuc2lvbiA9IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UubG9jYWwuZmlsdGVyKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5pZGVudGlmaWVyLCBleHRlbnNpb24uaWRlbnRpZmllcikpWzBdIHx8IGV4dGVuc2lvbjtcblx0XHR0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLm9wZW4oZXh0ZW5zaW9uLCBvcHRpb25zKS50aGVuKHVuZGVmaW5lZCwgZXJyID0+IHRoaXMub25FcnJvcihlcnIpKTtcblx0fVxuXG5cdHByaXZhdGUgb25FcnJvcihlcnI6IGFueSk6IHZvaWQge1xuXHRcdGlmIChpc0NhbmNlbGxhdGlvbkVycm9yKGVycikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtZXNzYWdlID0gZXJyICYmIGVyci5tZXNzYWdlIHx8ICcnO1xuXG5cdFx0aWYgKC9FQ09OTlJFRlVTRUQvLnRlc3QobWVzc2FnZSkpIHtcblx0XHRcdGNvbnN0IGVycm9yID0gY3JlYXRlRXJyb3JXaXRoQWN0aW9ucyhsb2NhbGl6ZSgnc3VnZ2VzdFByb3h5RXJyb3InLCBcIk1hcmtldHBsYWNlIHJldHVybmVkICdFQ09OTlJFRlVTRUQnLiBQbGVhc2UgY2hlY2sgdGhlICdodHRwLnByb3h5JyBzZXR0aW5nLlwiKSwgW1xuXHRcdFx0XHRuZXcgQWN0aW9uKCdvcGVuIHVzZXIgc2V0dGluZ3MnLCBsb2NhbGl6ZSgnb3BlbiB1c2VyIHNldHRpbmdzJywgXCJPcGVuIFVzZXIgU2V0dGluZ3NcIiksIHVuZGVmaW5lZCwgdHJ1ZSwgKCkgPT4gdGhpcy5wcmVmZXJlbmNlc1NlcnZpY2Uub3BlblVzZXJTZXR0aW5ncygpKVxuXHRcdFx0XSk7XG5cblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGVycik7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHRpZiAodGhpcy5xdWVyeVJlcXVlc3QpIHtcblx0XHRcdHRoaXMucXVlcnlSZXF1ZXN0LnJlcXVlc3QuY2FuY2VsKCk7XG5cdFx0XHR0aGlzLnF1ZXJ5UmVxdWVzdCA9IG51bGw7XG5cdFx0fVxuXHRcdGlmICh0aGlzLnF1ZXJ5UmVzdWx0KSB7XG5cdFx0XHR0aGlzLnF1ZXJ5UmVzdWx0LmRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMucXVlcnlSZXN1bHQgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHRoaXMubGlzdCA9IG51bGw7XG5cdH1cblxuXHRzdGF0aWMgaXNMb2NhbEV4dGVuc2lvbnNRdWVyeShxdWVyeTogc3RyaW5nLCBzb3J0Qnk/OiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5pc0luc3RhbGxlZEV4dGVuc2lvbnNRdWVyeShxdWVyeSlcblx0XHRcdHx8IHRoaXMuaXNTZWFyY2hJbnN0YWxsZWRFeHRlbnNpb25zUXVlcnkocXVlcnkpXG5cdFx0XHR8fCB0aGlzLmlzT3V0ZGF0ZWRFeHRlbnNpb25zUXVlcnkocXVlcnkpXG5cdFx0XHR8fCB0aGlzLmlzRW5hYmxlZEV4dGVuc2lvbnNRdWVyeShxdWVyeSlcblx0XHRcdHx8IHRoaXMuaXNEaXNhYmxlZEV4dGVuc2lvbnNRdWVyeShxdWVyeSlcblx0XHRcdHx8IHRoaXMuaXNCdWlsdEluRXh0ZW5zaW9uc1F1ZXJ5KHF1ZXJ5KVxuXHRcdFx0fHwgdGhpcy5pc1NlYXJjaEJ1aWx0SW5FeHRlbnNpb25zUXVlcnkocXVlcnkpXG5cdFx0XHR8fCB0aGlzLmlzQnVpbHRJbkdyb3VwRXh0ZW5zaW9uc1F1ZXJ5KHF1ZXJ5KVxuXHRcdFx0fHwgdGhpcy5pc1NlYXJjaERlcHJlY2F0ZWRFeHRlbnNpb25zUXVlcnkocXVlcnkpXG5cdFx0XHR8fCB0aGlzLmlzU2VhcmNoV29ya3NwYWNlVW5zdXBwb3J0ZWRFeHRlbnNpb25zUXVlcnkocXVlcnkpXG5cdFx0XHR8fCB0aGlzLmlzU2VhcmNoUmVjZW50bHlVcGRhdGVkUXVlcnkocXVlcnkpXG5cdFx0XHR8fCB0aGlzLmlzU2VhcmNoRXh0ZW5zaW9uVXBkYXRlc1F1ZXJ5KHF1ZXJ5KVxuXHRcdFx0fHwgdGhpcy5pc1NvcnRJbnN0YWxsZWRFeHRlbnNpb25zUXVlcnkocXVlcnksIHNvcnRCeSlcblx0XHRcdHx8IHRoaXMuaXNGZWF0dXJlRXh0ZW5zaW9uc1F1ZXJ5KHF1ZXJ5KTtcblx0fVxuXG5cdHN0YXRpYyBpc1NlYXJjaEJ1aWx0SW5FeHRlbnNpb25zUXVlcnkocXVlcnk6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAvQGJ1aWx0aW5cXHMuKy9pLnRlc3QocXVlcnkpO1xuXHR9XG5cblx0c3RhdGljIGlzQnVpbHRJbkV4dGVuc2lvbnNRdWVyeShxdWVyeTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIC9eXFxzKkBidWlsdGluJC9pLnRlc3QocXVlcnkudHJpbSgpKTtcblx0fVxuXG5cdHN0YXRpYyBpc0J1aWx0SW5Hcm91cEV4dGVuc2lvbnNRdWVyeShxdWVyeTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIC9eXFxzKkBidWlsdGluOi4rJC9pLnRlc3QocXVlcnkudHJpbSgpKTtcblx0fVxuXG5cdHN0YXRpYyBpc1NlYXJjaFdvcmtzcGFjZVVuc3VwcG9ydGVkRXh0ZW5zaW9uc1F1ZXJ5KHF1ZXJ5OiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gL15cXHMqQHdvcmtzcGFjZVVuc3VwcG9ydGVkKDoodW50cnVzdGVkfHZpcnR1YWwpKFBhcnRpYWwpPyk/KFxcc3wkKS9pLnRlc3QocXVlcnkpO1xuXHR9XG5cblx0c3RhdGljIGlzSW5zdGFsbGVkRXh0ZW5zaW9uc1F1ZXJ5KHF1ZXJ5OiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gL0BpbnN0YWxsZWQkL2kudGVzdChxdWVyeSk7XG5cdH1cblxuXHRzdGF0aWMgaXNTZWFyY2hJbnN0YWxsZWRFeHRlbnNpb25zUXVlcnkocXVlcnk6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAvQGluc3RhbGxlZFxccy4vaS50ZXN0KHF1ZXJ5KSB8fCB0aGlzLmlzRmVhdHVyZUV4dGVuc2lvbnNRdWVyeShxdWVyeSk7XG5cdH1cblxuXHRzdGF0aWMgaXNPdXRkYXRlZEV4dGVuc2lvbnNRdWVyeShxdWVyeTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIC9Ab3V0ZGF0ZWQvaS50ZXN0KHF1ZXJ5KTtcblx0fVxuXG5cdHN0YXRpYyBpc0VuYWJsZWRFeHRlbnNpb25zUXVlcnkocXVlcnk6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAvQGVuYWJsZWQvaS50ZXN0KHF1ZXJ5KTtcblx0fVxuXG5cdHN0YXRpYyBpc0Rpc2FibGVkRXh0ZW5zaW9uc1F1ZXJ5KHF1ZXJ5OiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gL0BkaXNhYmxlZC9pLnRlc3QocXVlcnkpO1xuXHR9XG5cblx0c3RhdGljIGlzU2VhcmNoRGVwcmVjYXRlZEV4dGVuc2lvbnNRdWVyeShxdWVyeTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIC9AZGVwcmVjYXRlZFxccz8uKi9pLnRlc3QocXVlcnkpO1xuXHR9XG5cblx0c3RhdGljIGlzUmVjb21tZW5kZWRFeHRlbnNpb25zUXVlcnkocXVlcnk6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAvXkByZWNvbW1lbmRlZCQvaS50ZXN0KHF1ZXJ5LnRyaW0oKSk7XG5cdH1cblxuXHRzdGF0aWMgaXNTZWFyY2hSZWNvbW1lbmRlZEV4dGVuc2lvbnNRdWVyeShxdWVyeTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIC9AcmVjb21tZW5kZWRcXHMuKy9pLnRlc3QocXVlcnkpO1xuXHR9XG5cblx0c3RhdGljIGlzV29ya3NwYWNlUmVjb21tZW5kZWRFeHRlbnNpb25zUXVlcnkocXVlcnk6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAvQHJlY29tbWVuZGVkOndvcmtzcGFjZS9pLnRlc3QocXVlcnkpO1xuXHR9XG5cblx0c3RhdGljIGlzRXhlUmVjb21tZW5kZWRFeHRlbnNpb25zUXVlcnkocXVlcnk6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAvQGV4ZTouKy9pLnRlc3QocXVlcnkpO1xuXHR9XG5cblx0c3RhdGljIGlzUmVtb3RlUmVjb21tZW5kZWRFeHRlbnNpb25zUXVlcnkocXVlcnk6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAvQHJlY29tbWVuZGVkOnJlbW90ZXMvaS50ZXN0KHF1ZXJ5KTtcblx0fVxuXG5cdHN0YXRpYyBpc0tleW1hcHNSZWNvbW1lbmRlZEV4dGVuc2lvbnNRdWVyeShxdWVyeTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIC9AcmVjb21tZW5kZWQ6a2V5bWFwcy9pLnRlc3QocXVlcnkpO1xuXHR9XG5cblx0c3RhdGljIGlzTGFuZ3VhZ2VSZWNvbW1lbmRlZEV4dGVuc2lvbnNRdWVyeShxdWVyeTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIC9AcmVjb21tZW5kZWQ6bGFuZ3VhZ2VzL2kudGVzdChxdWVyeSk7XG5cdH1cblxuXHRzdGF0aWMgaXNTb3J0SW5zdGFsbGVkRXh0ZW5zaW9uc1F1ZXJ5KHF1ZXJ5OiBzdHJpbmcsIHNvcnRCeT86IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAoc29ydEJ5ICE9PSB1bmRlZmluZWQgJiYgc29ydEJ5ICE9PSAnJyAmJiBxdWVyeSA9PT0gJycpIHx8ICghc29ydEJ5ICYmIC9eQHNvcnQ6XFxTKiQvaS50ZXN0KHF1ZXJ5KSk7XG5cdH1cblxuXHRzdGF0aWMgaXNTZWFyY2hQb3B1bGFyUXVlcnkocXVlcnk6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAvQHBvcHVsYXIvaS50ZXN0KHF1ZXJ5KTtcblx0fVxuXG5cdHN0YXRpYyBpc1NlYXJjaFJlY2VudGx5UHVibGlzaGVkUXVlcnkocXVlcnk6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAvQHJlY2VudGx5UHVibGlzaGVkL2kudGVzdChxdWVyeSk7XG5cdH1cblxuXHRzdGF0aWMgaXNTZWFyY2hSZWNlbnRseVVwZGF0ZWRRdWVyeShxdWVyeTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIC9AcmVjZW50bHlVcGRhdGVkL2kudGVzdChxdWVyeSk7XG5cdH1cblxuXHRzdGF0aWMgaXNTZWFyY2hFeHRlbnNpb25VcGRhdGVzUXVlcnkocXVlcnk6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAvQHVwZGF0ZXMvaS50ZXN0KHF1ZXJ5KTtcblx0fVxuXG5cdHN0YXRpYyBpc1NvcnRVcGRhdGVEYXRlUXVlcnkocXVlcnk6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAvQHNvcnQ6dXBkYXRlRGF0ZS9pLnRlc3QocXVlcnkpO1xuXHR9XG5cblx0c3RhdGljIGlzRmVhdHVyZUV4dGVuc2lvbnNRdWVyeShxdWVyeTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIC9AZmVhdHVyZTovaS50ZXN0KHF1ZXJ5KTtcblx0fVxuXG5cdG92ZXJyaWRlIGZvY3VzKCk6IHZvaWQge1xuXHRcdHN1cGVyLmZvY3VzKCk7XG5cdFx0aWYgKCF0aGlzLmxpc3QpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoISh0aGlzLmxpc3QuZ2V0Rm9jdXMoKS5sZW5ndGggfHwgdGhpcy5saXN0LmdldFNlbGVjdGlvbigpLmxlbmd0aCkpIHtcblx0XHRcdHRoaXMubGlzdC5mb2N1c05leHQoKTtcblx0XHR9XG5cdFx0dGhpcy5saXN0LmRvbUZvY3VzKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERlZmF1bHRQb3B1bGFyRXh0ZW5zaW9uc1ZpZXcgZXh0ZW5kcyBFeHRlbnNpb25zTGlzdFZpZXcge1xuXG5cdG92ZXJyaWRlIGFzeW5jIHNob3coKTogUHJvbWlzZTxJUGFnZWRNb2RlbDxJRXh0ZW5zaW9uPj4ge1xuXHRcdGNvbnN0IHF1ZXJ5ID0gdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS53ZWJFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyICYmICF0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLmxvY2FsRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciAmJiAhdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5yZW1vdGVFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyID8gJ0B3ZWInIDogJyc7XG5cdFx0cmV0dXJuIHN1cGVyLnNob3cocXVlcnkpO1xuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIFNlcnZlckluc3RhbGxlZEV4dGVuc2lvbnNWaWV3IGV4dGVuZHMgRXh0ZW5zaW9uc0xpc3RWaWV3IHtcblxuXHRvdmVycmlkZSBhc3luYyBzaG93KHF1ZXJ5OiBzdHJpbmcpOiBQcm9taXNlPElQYWdlZE1vZGVsPElFeHRlbnNpb24+PiB7XG5cdFx0cXVlcnkgPSBxdWVyeSA/IHF1ZXJ5IDogJ0BpbnN0YWxsZWQnO1xuXHRcdGlmICghRXh0ZW5zaW9uc0xpc3RWaWV3LmlzTG9jYWxFeHRlbnNpb25zUXVlcnkocXVlcnkpIHx8IEV4dGVuc2lvbnNMaXN0Vmlldy5pc1NvcnRJbnN0YWxsZWRFeHRlbnNpb25zUXVlcnkocXVlcnkpKSB7XG5cdFx0XHRxdWVyeSA9IHF1ZXJ5ICs9ICcgQGluc3RhbGxlZCc7XG5cdFx0fVxuXHRcdHJldHVybiBzdXBlci5zaG93KHF1ZXJ5LnRyaW0oKSk7XG5cdH1cblxufVxuXG5leHBvcnQgY2xhc3MgRW5hYmxlZEV4dGVuc2lvbnNWaWV3IGV4dGVuZHMgRXh0ZW5zaW9uc0xpc3RWaWV3IHtcblxuXHRvdmVycmlkZSBhc3luYyBzaG93KHF1ZXJ5OiBzdHJpbmcpOiBQcm9taXNlPElQYWdlZE1vZGVsPElFeHRlbnNpb24+PiB7XG5cdFx0cXVlcnkgPSBxdWVyeSB8fCAnQGVuYWJsZWQnO1xuXHRcdHJldHVybiBFeHRlbnNpb25zTGlzdFZpZXcuaXNFbmFibGVkRXh0ZW5zaW9uc1F1ZXJ5KHF1ZXJ5KSA/IHN1cGVyLnNob3cocXVlcnkpIDpcblx0XHRcdEV4dGVuc2lvbnNMaXN0Vmlldy5pc1NvcnRJbnN0YWxsZWRFeHRlbnNpb25zUXVlcnkocXVlcnkpID8gc3VwZXIuc2hvdygnQGVuYWJsZWQgJyArIHF1ZXJ5KSA6IHRoaXMuc2hvd0VtcHR5TW9kZWwoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRGlzYWJsZWRFeHRlbnNpb25zVmlldyBleHRlbmRzIEV4dGVuc2lvbnNMaXN0VmlldyB7XG5cblx0b3ZlcnJpZGUgYXN5bmMgc2hvdyhxdWVyeTogc3RyaW5nKTogUHJvbWlzZTxJUGFnZWRNb2RlbDxJRXh0ZW5zaW9uPj4ge1xuXHRcdHF1ZXJ5ID0gcXVlcnkgfHwgJ0BkaXNhYmxlZCc7XG5cdFx0cmV0dXJuIEV4dGVuc2lvbnNMaXN0Vmlldy5pc0Rpc2FibGVkRXh0ZW5zaW9uc1F1ZXJ5KHF1ZXJ5KSA/IHN1cGVyLnNob3cocXVlcnkpIDpcblx0XHRcdEV4dGVuc2lvbnNMaXN0Vmlldy5pc1NvcnRJbnN0YWxsZWRFeHRlbnNpb25zUXVlcnkocXVlcnkpID8gc3VwZXIuc2hvdygnQGRpc2FibGVkICcgKyBxdWVyeSkgOiB0aGlzLnNob3dFbXB0eU1vZGVsKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE91dGRhdGVkRXh0ZW5zaW9uc1ZpZXcgZXh0ZW5kcyBFeHRlbnNpb25zTGlzdFZpZXcge1xuXG5cdG92ZXJyaWRlIGFzeW5jIHNob3cocXVlcnk6IHN0cmluZyk6IFByb21pc2U8SVBhZ2VkTW9kZWw8SUV4dGVuc2lvbj4+IHtcblx0XHRxdWVyeSA9IHF1ZXJ5ID8gcXVlcnkgOiAnQG91dGRhdGVkJztcblx0XHRpZiAoRXh0ZW5zaW9uc0xpc3RWaWV3LmlzU2VhcmNoRXh0ZW5zaW9uVXBkYXRlc1F1ZXJ5KHF1ZXJ5KSkge1xuXHRcdFx0cXVlcnkgPSBxdWVyeS5yZXBsYWNlKCdAdXBkYXRlcycsICdAb3V0ZGF0ZWQnKTtcblx0XHR9XG5cdFx0cmV0dXJuIHN1cGVyLnNob3cocXVlcnkudHJpbSgpKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB1cGRhdGVTaXplKCkge1xuXHRcdHN1cGVyLnVwZGF0ZVNpemUoKTtcblx0XHR0aGlzLnNldEV4cGFuZGVkKHRoaXMuY291bnQoKSA+IDApO1xuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIFJlY2VudGx5VXBkYXRlZEV4dGVuc2lvbnNWaWV3IGV4dGVuZHMgRXh0ZW5zaW9uc0xpc3RWaWV3IHtcblxuXHRvdmVycmlkZSBhc3luYyBzaG93KHF1ZXJ5OiBzdHJpbmcpOiBQcm9taXNlPElQYWdlZE1vZGVsPElFeHRlbnNpb24+PiB7XG5cdFx0cXVlcnkgPSBxdWVyeSA/IHF1ZXJ5IDogJ0ByZWNlbnRseVVwZGF0ZWQnO1xuXHRcdGlmIChFeHRlbnNpb25zTGlzdFZpZXcuaXNTZWFyY2hFeHRlbnNpb25VcGRhdGVzUXVlcnkocXVlcnkpKSB7XG5cdFx0XHRxdWVyeSA9IHF1ZXJ5LnJlcGxhY2UoJ0B1cGRhdGVzJywgJ0ByZWNlbnRseVVwZGF0ZWQnKTtcblx0XHR9XG5cdFx0cmV0dXJuIHN1cGVyLnNob3cocXVlcnkudHJpbSgpKTtcblx0fVxuXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3RhdGljUXVlcnlFeHRlbnNpb25zVmlld09wdGlvbnMgZXh0ZW5kcyBFeHRlbnNpb25zTGlzdFZpZXdPcHRpb25zIHtcblx0cmVhZG9ubHkgcXVlcnk6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFN0YXRpY1F1ZXJ5RXh0ZW5zaW9uc1ZpZXcgZXh0ZW5kcyBFeHRlbnNpb25zTGlzdFZpZXcge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByb3RlY3RlZCBvdmVycmlkZSByZWFkb25seSBvcHRpb25zOiBTdGF0aWNRdWVyeUV4dGVuc2lvbnNWaWV3T3B0aW9ucyxcblx0XHR2aWV3bGV0Vmlld09wdGlvbnM6IElWaWV3bGV0Vmlld09wdGlvbnMsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2Uga2V5YmluZGluZ1NlcnZpY2U6IElLZXliaW5kaW5nU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZSBleHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlOiBJRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZSBleHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZSBleHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlOiBJRXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB3b3Jrc3BhY2VTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASVZpZXdEZXNjcmlwdG9yU2VydmljZSB2aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJUHJlZmVyZW5jZXNTZXJ2aWNlIHByZWZlcmVuY2VzU2VydmljZTogSVByZWZlcmVuY2VzU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlIHdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2U6IElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UgZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSxcblx0XHRASVdvcmtiZW5jaExheW91dFNlcnZpY2UgbGF5b3V0U2VydmljZTogSVdvcmtiZW5jaExheW91dFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlIGV4dGVuc2lvbkZlYXR1cmVzTWFuYWdlbWVudFNlcnZpY2U6IElFeHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIob3B0aW9ucywgdmlld2xldFZpZXdPcHRpb25zLCBub3RpZmljYXRpb25TZXJ2aWNlLCBrZXliaW5kaW5nU2VydmljZSwgY29udGV4dE1lbnVTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBleHRlbnNpb25TZXJ2aWNlLFxuXHRcdFx0ZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsIGV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UsIHRlbGVtZXRyeVNlcnZpY2UsIGhvdmVyU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGNvbnRleHRTZXJ2aWNlLCBleHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZSxcblx0XHRcdGV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UsIGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLCB3b3Jrc3BhY2VTZXJ2aWNlLCBwcm9kdWN0U2VydmljZSwgY29udGV4dEtleVNlcnZpY2UsIHZpZXdEZXNjcmlwdG9yU2VydmljZSwgb3BlbmVyU2VydmljZSxcblx0XHRcdHByZWZlcmVuY2VzU2VydmljZSwgc3RvcmFnZVNlcnZpY2UsIHdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UsIGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLCBsYXlvdXRTZXJ2aWNlLCBleHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdFx0dXJpSWRlbnRpdHlTZXJ2aWNlLCBsb2dTZXJ2aWNlKTtcblx0fVxuXG5cdG92ZXJyaWRlIHNob3coKTogUHJvbWlzZTxJUGFnZWRNb2RlbDxJRXh0ZW5zaW9uPj4ge1xuXHRcdHJldHVybiBzdXBlci5zaG93KHRoaXMub3B0aW9ucy5xdWVyeSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gdG9TcGVjaWZpY1dvcmtzcGFjZVVuc3VwcG9ydGVkUXVlcnkocXVlcnk6IHN0cmluZywgcXVhbGlmaWVyOiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRpZiAoIXF1ZXJ5KSB7XG5cdFx0cmV0dXJuICdAd29ya3NwYWNlVW5zdXBwb3J0ZWQ6JyArIHF1YWxpZmllcjtcblx0fVxuXHRjb25zdCBtYXRjaCA9IHF1ZXJ5Lm1hdGNoKG5ldyBSZWdFeHAoYEB3b3Jrc3BhY2VVbnN1cHBvcnRlZCg6JHtxdWFsaWZpZXJ9KT8oXFxcXHN8JClgLCAnaScpKTtcblx0aWYgKG1hdGNoKSB7XG5cdFx0aWYgKCFtYXRjaFsxXSkge1xuXHRcdFx0cmV0dXJuIHF1ZXJ5LnJlcGxhY2UoL0B3b3Jrc3BhY2VVbnN1cHBvcnRlZC9naSwgJ0B3b3Jrc3BhY2VVbnN1cHBvcnRlZDonICsgcXVhbGlmaWVyKTtcblx0XHR9XG5cdFx0cmV0dXJuIHF1ZXJ5O1xuXHR9XG5cdHJldHVybiB1bmRlZmluZWQ7XG59XG5cblxuZXhwb3J0IGNsYXNzIFVudHJ1c3RlZFdvcmtzcGFjZVVuc3VwcG9ydGVkRXh0ZW5zaW9uc1ZpZXcgZXh0ZW5kcyBFeHRlbnNpb25zTGlzdFZpZXcge1xuXHRvdmVycmlkZSBhc3luYyBzaG93KHF1ZXJ5OiBzdHJpbmcpOiBQcm9taXNlPElQYWdlZE1vZGVsPElFeHRlbnNpb24+PiB7XG5cdFx0Y29uc3QgdXBkYXRlZFF1ZXJ5ID0gdG9TcGVjaWZpY1dvcmtzcGFjZVVuc3VwcG9ydGVkUXVlcnkocXVlcnksICd1bnRydXN0ZWQnKTtcblx0XHRyZXR1cm4gdXBkYXRlZFF1ZXJ5ID8gc3VwZXIuc2hvdyh1cGRhdGVkUXVlcnkpIDogdGhpcy5zaG93RW1wdHlNb2RlbCgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBVbnRydXN0ZWRXb3Jrc3BhY2VQYXJ0aWFsbHlTdXBwb3J0ZWRFeHRlbnNpb25zVmlldyBleHRlbmRzIEV4dGVuc2lvbnNMaXN0VmlldyB7XG5cdG92ZXJyaWRlIGFzeW5jIHNob3cocXVlcnk6IHN0cmluZyk6IFByb21pc2U8SVBhZ2VkTW9kZWw8SUV4dGVuc2lvbj4+IHtcblx0XHRjb25zdCB1cGRhdGVkUXVlcnkgPSB0b1NwZWNpZmljV29ya3NwYWNlVW5zdXBwb3J0ZWRRdWVyeShxdWVyeSwgJ3VudHJ1c3RlZFBhcnRpYWwnKTtcblx0XHRyZXR1cm4gdXBkYXRlZFF1ZXJ5ID8gc3VwZXIuc2hvdyh1cGRhdGVkUXVlcnkpIDogdGhpcy5zaG93RW1wdHlNb2RlbCgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBWaXJ0dWFsV29ya3NwYWNlVW5zdXBwb3J0ZWRFeHRlbnNpb25zVmlldyBleHRlbmRzIEV4dGVuc2lvbnNMaXN0VmlldyB7XG5cdG92ZXJyaWRlIGFzeW5jIHNob3cocXVlcnk6IHN0cmluZyk6IFByb21pc2U8SVBhZ2VkTW9kZWw8SUV4dGVuc2lvbj4+IHtcblx0XHRjb25zdCB1cGRhdGVkUXVlcnkgPSB0b1NwZWNpZmljV29ya3NwYWNlVW5zdXBwb3J0ZWRRdWVyeShxdWVyeSwgJ3ZpcnR1YWwnKTtcblx0XHRyZXR1cm4gdXBkYXRlZFF1ZXJ5ID8gc3VwZXIuc2hvdyh1cGRhdGVkUXVlcnkpIDogdGhpcy5zaG93RW1wdHlNb2RlbCgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBWaXJ0dWFsV29ya3NwYWNlUGFydGlhbGx5U3VwcG9ydGVkRXh0ZW5zaW9uc1ZpZXcgZXh0ZW5kcyBFeHRlbnNpb25zTGlzdFZpZXcge1xuXHRvdmVycmlkZSBhc3luYyBzaG93KHF1ZXJ5OiBzdHJpbmcpOiBQcm9taXNlPElQYWdlZE1vZGVsPElFeHRlbnNpb24+PiB7XG5cdFx0Y29uc3QgdXBkYXRlZFF1ZXJ5ID0gdG9TcGVjaWZpY1dvcmtzcGFjZVVuc3VwcG9ydGVkUXVlcnkocXVlcnksICd2aXJ0dWFsUGFydGlhbCcpO1xuXHRcdHJldHVybiB1cGRhdGVkUXVlcnkgPyBzdXBlci5zaG93KHVwZGF0ZWRRdWVyeSkgOiB0aGlzLnNob3dFbXB0eU1vZGVsKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERlcHJlY2F0ZWRFeHRlbnNpb25zVmlldyBleHRlbmRzIEV4dGVuc2lvbnNMaXN0VmlldyB7XG5cdG92ZXJyaWRlIGFzeW5jIHNob3cocXVlcnk6IHN0cmluZyk6IFByb21pc2U8SVBhZ2VkTW9kZWw8SUV4dGVuc2lvbj4+IHtcblx0XHRyZXR1cm4gRXh0ZW5zaW9uc0xpc3RWaWV3LmlzU2VhcmNoRGVwcmVjYXRlZEV4dGVuc2lvbnNRdWVyeShxdWVyeSkgPyBzdXBlci5zaG93KHF1ZXJ5KSA6IHRoaXMuc2hvd0VtcHR5TW9kZWwoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2VhcmNoTWFya2V0cGxhY2VFeHRlbnNpb25zVmlldyBleHRlbmRzIEV4dGVuc2lvbnNMaXN0VmlldyB7XG5cblx0cHJpdmF0ZSByZWFkb25seSByZXBvcnRTZWFyY2hGaW5pc2hlZERlbGF5ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgVGhyb3R0bGVkRGVsYXllcigyMDAwKSk7XG5cdHByaXZhdGUgc2VhcmNoV2FpdFByb21pc2U6IFByb21pc2U8dm9pZD4gPSBQcm9taXNlLnJlc29sdmUoKTtcblxuXHRvdmVycmlkZSBhc3luYyBzaG93KHF1ZXJ5OiBzdHJpbmcpOiBQcm9taXNlPElQYWdlZE1vZGVsPElFeHRlbnNpb24+PiB7XG5cdFx0Y29uc3QgcXVlcnlQcm9taXNlID0gc3VwZXIuc2hvdyhxdWVyeSk7XG5cdFx0dGhpcy5yZXBvcnRTZWFyY2hGaW5pc2hlZERlbGF5ZXIudHJpZ2dlcigoKSA9PiB0aGlzLnJlcG9ydFNlYXJjaEZpbmlzaGVkKCkpO1xuXHRcdHRoaXMuc2VhcmNoV2FpdFByb21pc2UgPSBxdWVyeVByb21pc2UudGhlbihudWxsLCBudWxsKTtcblx0XHRyZXR1cm4gcXVlcnlQcm9taXNlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXBvcnRTZWFyY2hGaW5pc2hlZCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLnNlYXJjaFdhaXRQcm9taXNlO1xuXHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyKCdleHRlbnNpb25zVmlldzpNYXJrZXRwbGFjZVNlYXJjaEZpbmlzaGVkJyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERlZmF1bHRSZWNvbW1lbmRlZEV4dGVuc2lvbnNWaWV3IGV4dGVuZHMgRXh0ZW5zaW9uc0xpc3RWaWV3IHtcblx0cHJpdmF0ZSByZWFkb25seSByZWNvbW1lbmRlZEV4dGVuc2lvbnNRdWVyeSA9ICdAcmVjb21tZW5kZWQ6YWxsJztcblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVuZGVyQm9keShjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyQm9keShjb250YWluZXIpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5leHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLm9uRGlkQ2hhbmdlUmVjb21tZW5kYXRpb25zKCgpID0+IHtcblx0XHRcdHRoaXMuc2hvdygnJyk7XG5cdFx0fSkpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgc2hvdyhxdWVyeTogc3RyaW5nKTogUHJvbWlzZTxJUGFnZWRNb2RlbDxJRXh0ZW5zaW9uPj4ge1xuXHRcdGlmIChxdWVyeSAmJiBxdWVyeS50cmltKCkgIT09IHRoaXMucmVjb21tZW5kZWRFeHRlbnNpb25zUXVlcnkpIHtcblx0XHRcdHJldHVybiB0aGlzLnNob3dFbXB0eU1vZGVsKCk7XG5cdFx0fVxuXHRcdGNvbnN0IG1vZGVsID0gYXdhaXQgc3VwZXIuc2hvdyh0aGlzLnJlY29tbWVuZGVkRXh0ZW5zaW9uc1F1ZXJ5KTtcblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UubG9jYWwuc29tZShlID0+ICFlLmlzQnVpbHRpbikpIHtcblx0XHRcdC8vIFRoaXMgaXMgcGFydCBvZiBwb3B1bGFyIGV4dGVuc2lvbnMgdmlldy4gQ29sbGFwc2UgaWYgbm8gaW5zdGFsbGVkIGV4dGVuc2lvbnMuXG5cdFx0XHR0aGlzLnNldEV4cGFuZGVkKG1vZGVsLmxlbmd0aCA+IDApO1xuXHRcdH1cblx0XHRyZXR1cm4gbW9kZWw7XG5cdH1cblxufVxuXG5leHBvcnQgY2xhc3MgUmVjb21tZW5kZWRFeHRlbnNpb25zVmlldyBleHRlbmRzIEV4dGVuc2lvbnNMaXN0VmlldyB7XG5cdHByaXZhdGUgcmVhZG9ubHkgcmVjb21tZW5kZWRFeHRlbnNpb25zUXVlcnkgPSAnQHJlY29tbWVuZGVkJztcblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVuZGVyQm9keShjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyQm9keShjb250YWluZXIpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5leHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLm9uRGlkQ2hhbmdlUmVjb21tZW5kYXRpb25zKCgpID0+IHtcblx0XHRcdHRoaXMuc2hvdygnJyk7XG5cdFx0fSkpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgc2hvdyhxdWVyeTogc3RyaW5nKTogUHJvbWlzZTxJUGFnZWRNb2RlbDxJRXh0ZW5zaW9uPj4ge1xuXHRcdHJldHVybiAocXVlcnkgJiYgcXVlcnkudHJpbSgpICE9PSB0aGlzLnJlY29tbWVuZGVkRXh0ZW5zaW9uc1F1ZXJ5KSA/IHRoaXMuc2hvd0VtcHR5TW9kZWwoKSA6IHN1cGVyLnNob3codGhpcy5yZWNvbW1lbmRlZEV4dGVuc2lvbnNRdWVyeSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFdvcmtzcGFjZVJlY29tbWVuZGVkRXh0ZW5zaW9uc1ZpZXcgZXh0ZW5kcyBFeHRlbnNpb25zTGlzdFZpZXcgaW1wbGVtZW50cyBJV29ya3NwYWNlUmVjb21tZW5kZWRFeHRlbnNpb25zVmlldyB7XG5cdHByaXZhdGUgcmVhZG9ubHkgcmVjb21tZW5kZWRFeHRlbnNpb25zUXVlcnkgPSAnQHJlY29tbWVuZGVkOndvcmtzcGFjZSc7XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlbmRlckJvZHkoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlckJvZHkoY29udGFpbmVyKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZS5vbkRpZENoYW5nZVJlY29tbWVuZGF0aW9ucygoKSA9PiB0aGlzLnNob3codGhpcy5yZWNvbW1lbmRlZEV4dGVuc2lvbnNRdWVyeSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbnRleHRTZXJ2aWNlLm9uRGlkQ2hhbmdlV29ya2JlbmNoU3RhdGUoKCkgPT4gdGhpcy5zaG93KHRoaXMucmVjb21tZW5kZWRFeHRlbnNpb25zUXVlcnkpKSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBzaG93KHF1ZXJ5OiBzdHJpbmcpOiBQcm9taXNlPElQYWdlZE1vZGVsPElFeHRlbnNpb24+PiB7XG5cdFx0Y29uc3Qgc2hvdWxkU2hvd0VtcHR5VmlldyA9IHF1ZXJ5ICYmIHF1ZXJ5LnRyaW0oKSAhPT0gJ0ByZWNvbW1lbmRlZCcgJiYgcXVlcnkudHJpbSgpICE9PSAnQHJlY29tbWVuZGVkOndvcmtzcGFjZSc7XG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCAoc2hvdWxkU2hvd0VtcHR5VmlldyA/IHRoaXMuc2hvd0VtcHR5TW9kZWwoKSA6IHN1cGVyLnNob3codGhpcy5yZWNvbW1lbmRlZEV4dGVuc2lvbnNRdWVyeSkpO1xuXHRcdHRoaXMuc2V0RXhwYW5kZWQobW9kZWwubGVuZ3RoID4gMCk7XG5cdFx0cmV0dXJuIG1vZGVsO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRJbnN0YWxsYWJsZVdvcmtzcGFjZVJlY29tbWVuZGF0aW9ucygpOiBQcm9taXNlPElFeHRlbnNpb25bXT4ge1xuXHRcdGNvbnN0IGluc3RhbGxlZCA9IChhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnF1ZXJ5TG9jYWwoKSlcblx0XHRcdC5maWx0ZXIobCA9PiBsLmVuYWJsZW1lbnRTdGF0ZSAhPT0gRW5hYmxlbWVudFN0YXRlLkRpc2FibGVkQnlFeHRlbnNpb25LaW5kKTsgLy8gRmlsdGVyIGV4dGVuc2lvbnMgZGlzYWJsZWQgYnkga2luZFxuXHRcdGNvbnN0IHJlY29tbWVuZGF0aW9ucyA9IChhd2FpdCB0aGlzLmdldFdvcmtzcGFjZVJlY29tbWVuZGF0aW9ucygpKVxuXHRcdFx0LmZpbHRlcihyZWNvbW1lbmRhdGlvbiA9PiBpbnN0YWxsZWQuZXZlcnkobG9jYWwgPT4gaXNTdHJpbmcocmVjb21tZW5kYXRpb24pID8gIWFyZVNhbWVFeHRlbnNpb25zKHsgaWQ6IHJlY29tbWVuZGF0aW9uIH0sIGxvY2FsLmlkZW50aWZpZXIpIDogIXRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKHJlY29tbWVuZGF0aW9uLCBsb2NhbC5sb2NhbD8ubG9jYXRpb24pKSk7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0SW5zdGFsbGFibGVSZWNvbW1lbmRhdGlvbnMocmVjb21tZW5kYXRpb25zLCB7IHNvdXJjZTogJ2luc3RhbGwtYWxsLXdvcmtzcGFjZS1yZWNvbW1lbmRhdGlvbnMnIH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHR9XG5cblx0YXN5bmMgaW5zdGFsbFdvcmtzcGFjZVJlY29tbWVuZGF0aW9ucygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBpbnN0YWxsYWJsZVJlY29tbWVuZGF0aW9ucyA9IGF3YWl0IHRoaXMuZ2V0SW5zdGFsbGFibGVXb3Jrc3BhY2VSZWNvbW1lbmRhdGlvbnMoKTtcblx0XHRpZiAoaW5zdGFsbGFibGVSZWNvbW1lbmRhdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBnYWxsZXJ5RXh0ZW5zaW9uczogSW5zdGFsbEV4dGVuc2lvbkluZm9bXSA9IFtdO1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VFeHRlbnNpb25zOiBJRXh0ZW5zaW9uW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgcmVjb21tZW5kYXRpb24gb2YgaW5zdGFsbGFibGVSZWNvbW1lbmRhdGlvbnMpIHtcblx0XHRcdFx0aWYgKHJlY29tbWVuZGF0aW9uLmdhbGxlcnkpIHtcblx0XHRcdFx0XHRnYWxsZXJ5RXh0ZW5zaW9ucy5wdXNoKHsgZXh0ZW5zaW9uOiByZWNvbW1lbmRhdGlvbi5nYWxsZXJ5LCBvcHRpb25zOiB7fSB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXNvdXJjZUV4dGVuc2lvbnMucHVzaChyZWNvbW1lbmRhdGlvbik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKFtcblx0XHRcdFx0dGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5pbnN0YWxsR2FsbGVyeUV4dGVuc2lvbnMoZ2FsbGVyeUV4dGVuc2lvbnMpLFxuXHRcdFx0XHQuLi5yZXNvdXJjZUV4dGVuc2lvbnMubWFwKGV4dGVuc2lvbiA9PiB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmluc3RhbGwoZXh0ZW5zaW9uKSlcblx0XHRcdF0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHtcblx0XHRcdFx0c2V2ZXJpdHk6IFNldmVyaXR5LkluZm8sXG5cdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCdubyBsb2NhbCBleHRlbnNpb25zJywgXCJUaGVyZSBhcmUgbm8gZXh0ZW5zaW9ucyB0byBpbnN0YWxsLlwiKVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEFyaWFMYWJlbEZvckV4dGVuc2lvbihleHRlbnNpb246IElFeHRlbnNpb24gfCBudWxsKTogc3RyaW5nIHtcblx0aWYgKCFleHRlbnNpb24pIHtcblx0XHRyZXR1cm4gJyc7XG5cdH1cblx0Y29uc3QgcHVibGlzaGVyID0gZXh0ZW5zaW9uLnB1Ymxpc2hlckRvbWFpbj8udmVyaWZpZWQgPyBsb2NhbGl6ZSgnZXh0ZW5zaW9uLmFyaWFsYWJlbC52ZXJpZmllZFB1Ymxpc2hlcicsIFwiVmVyaWZpZWQgUHVibGlzaGVyIHswfVwiLCBleHRlbnNpb24ucHVibGlzaGVyRGlzcGxheU5hbWUpIDogbG9jYWxpemUoJ2V4dGVuc2lvbi5hcmlhbGFiZWwucHVibGlzaGVyJywgXCJQdWJsaXNoZXIgezB9XCIsIGV4dGVuc2lvbi5wdWJsaXNoZXJEaXNwbGF5TmFtZSk7XG5cdGNvbnN0IGRlcHJlY2F0ZWQgPSBleHRlbnNpb24/LmRlcHJlY2F0aW9uSW5mbyA/IGxvY2FsaXplKCdleHRlbnNpb24uYXJpYWxhYmVsLmRlcHJlY2F0ZWQnLCBcIkRlcHJlY2F0ZWRcIikgOiAnJztcblx0Y29uc3QgcmF0aW5nID0gZXh0ZW5zaW9uPy5yYXRpbmcgPyBsb2NhbGl6ZSgnZXh0ZW5zaW9uLmFyaWFsYWJlbC5yYXRpbmcnLCBcIlJhdGVkIHswfSBvdXQgb2YgNSBzdGFycyBieSB7MX0gdXNlcnNcIiwgZXh0ZW5zaW9uLnJhdGluZy50b0ZpeGVkKDIpLCBleHRlbnNpb24ucmF0aW5nQ291bnQpIDogJyc7XG5cdHJldHVybiBgJHtleHRlbnNpb24uZGlzcGxheU5hbWV9LCAke2RlcHJlY2F0ZWQgPyBgJHtkZXByZWNhdGVkfSwgYCA6ICcnfSR7ZXh0ZW5zaW9uLnZlcnNpb259LCAke3B1Ymxpc2hlcn0sICR7ZXh0ZW5zaW9uLmRlc2NyaXB0aW9ufSAke3JhdGluZyA/IGAsICR7cmF0aW5nfWAgOiAnJ31gO1xufVxuXG5leHBvcnQgY2xhc3MgUHJlZmVycmVkRXh0ZW5zaW9uc1BhZ2VkTW9kZWwgaW1wbGVtZW50cyBJUGFnZWRNb2RlbDxJRXh0ZW5zaW9uPiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSByZXNvbHZlZCA9IG5ldyBNYXA8bnVtYmVyLCBJRXh0ZW5zaW9uPigpO1xuXHRwcml2YXRlIHByZWZlcnJlZEdhbGxlcnlFeHRlbnNpb25zID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdHByaXZhdGUgcmVzb2x2ZWRHYWxsZXJ5RXh0ZW5zaW9uc0Zyb21RdWVyeTogSUV4dGVuc2lvbltdID0gW107XG5cdHByaXZhdGUgcmVhZG9ubHkgcGFnZXM6IEFycmF5PHtcblx0XHRwcm9taXNlOiBQcm9taXNlPHZvaWQ+IHwgbnVsbDtcblx0XHRjdHM6IENhbmNlbGxhdGlvblRva2VuU291cmNlIHwgbnVsbDtcblx0XHRwcm9taXNlSW5kZXhlczogU2V0PG51bWJlcj47XG5cdH0+O1xuXG5cdHB1YmxpYyByZWFkb25seSBsZW5ndGg6IG51bWJlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHByZWZlcnJlZEV4dGVuc2lvbnM6IElFeHRlbnNpb25bXSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHBhZ2VyOiBJUGFnZXI8SUV4dGVuc2lvbj4sXG5cdCkge1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5wcmVmZXJyZWRFeHRlbnNpb25zLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHR0aGlzLnJlc29sdmVkLnNldChpLCB0aGlzLnByZWZlcnJlZEV4dGVuc2lvbnNbaV0pO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgZSBvZiBwcmVmZXJyZWRFeHRlbnNpb25zKSB7XG5cdFx0XHRpZiAoZS5pZGVudGlmaWVyLnV1aWQpIHtcblx0XHRcdFx0dGhpcy5wcmVmZXJyZWRHYWxsZXJ5RXh0ZW5zaW9ucy5hZGQoZS5pZGVudGlmaWVyLnV1aWQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIGV4cGVjdGVkIHRoYXQgYWxsIHByZWZlcnJlZCBnYWxsZXJ5IGV4dGVuc2lvbnMgd2lsbCBiZSBwYXJ0IG9mIHRoZSBxdWVyeSByZXN1bHRzXG5cdFx0dGhpcy5sZW5ndGggPSAocHJlZmVycmVkRXh0ZW5zaW9ucy5sZW5ndGggLSB0aGlzLnByZWZlcnJlZEdhbGxlcnlFeHRlbnNpb25zLnNpemUpICsgdGhpcy5wYWdlci50b3RhbDtcblxuXHRcdGNvbnN0IHRvdGFsUGFnZXMgPSBNYXRoLmNlaWwodGhpcy5wYWdlci50b3RhbCAvIHRoaXMucGFnZXIucGFnZVNpemUpO1xuXHRcdHRoaXMucG9wdWxhdGVSZXNvbHZlZEV4dGVuc2lvbnMoMCwgdGhpcy5wYWdlci5maXJzdFBhZ2UpO1xuXHRcdHRoaXMucGFnZXMgPSByYW5nZSh0b3RhbFBhZ2VzIC0gMSkubWFwKCgpID0+ICh7XG5cdFx0XHRwcm9taXNlOiBudWxsLFxuXHRcdFx0Y3RzOiBudWxsLFxuXHRcdFx0cHJvbWlzZUluZGV4ZXM6IG5ldyBTZXQ8bnVtYmVyPigpLFxuXHRcdH0pKTtcblx0fVxuXG5cdGlzUmVzb2x2ZWQoaW5kZXg6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnJlc29sdmVkLmhhcyhpbmRleCk7XG5cdH1cblxuXHRnZXQoaW5kZXg6IG51bWJlcik6IElFeHRlbnNpb24ge1xuXHRcdHJldHVybiB0aGlzLnJlc29sdmVkLmdldChpbmRleCkhO1xuXHR9XG5cblx0YXN5bmMgcmVzb2x2ZShpbmRleDogbnVtYmVyLCBjYW5jZWxsYXRpb25Ub2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElFeHRlbnNpb24+IHtcblx0XHRpZiAoY2FuY2VsbGF0aW9uVG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHRocm93IG5ldyBDYW5jZWxsYXRpb25FcnJvcigpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmlzUmVzb2x2ZWQoaW5kZXgpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5nZXQoaW5kZXgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluZGV4SW5QYWdlZE1vZGVsID0gaW5kZXggLSB0aGlzLnByZWZlcnJlZEV4dGVuc2lvbnMubGVuZ3RoICsgdGhpcy5yZXNvbHZlZEdhbGxlcnlFeHRlbnNpb25zRnJvbVF1ZXJ5Lmxlbmd0aDtcblx0XHRjb25zdCBwYWdlSW5kZXggPSBNYXRoLmZsb29yKGluZGV4SW5QYWdlZE1vZGVsIC8gdGhpcy5wYWdlci5wYWdlU2l6ZSk7XG5cdFx0Y29uc3QgcGFnZSA9IHRoaXMucGFnZXNbcGFnZUluZGV4XTtcblxuXHRcdGlmICghcGFnZS5wcm9taXNlKSB7XG5cdFx0XHRwYWdlLmN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdFx0cGFnZS5wcm9taXNlID0gdGhpcy5wYWdlci5nZXRQYWdlKHBhZ2VJbmRleCwgcGFnZS5jdHMudG9rZW4pXG5cdFx0XHRcdC50aGVuKGV4dGVuc2lvbnMgPT4gdGhpcy5wb3B1bGF0ZVJlc29sdmVkRXh0ZW5zaW9ucyhwYWdlSW5kZXgsIGV4dGVuc2lvbnMpKVxuXHRcdFx0XHQuY2F0Y2goZSA9PiB7IHBhZ2UucHJvbWlzZSA9IG51bGw7IHRocm93IGU7IH0pXG5cdFx0XHRcdC5maW5hbGx5KCgpID0+IHBhZ2UuY3RzID0gbnVsbCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGlzdGVuZXIgPSBjYW5jZWxsYXRpb25Ub2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiB7XG5cdFx0XHRpZiAoIXBhZ2UuY3RzKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHBhZ2UucHJvbWlzZUluZGV4ZXMuZGVsZXRlKGluZGV4KTtcblx0XHRcdGlmIChwYWdlLnByb21pc2VJbmRleGVzLnNpemUgPT09IDApIHtcblx0XHRcdFx0cGFnZS5jdHMuY2FuY2VsKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRwYWdlLnByb21pc2VJbmRleGVzLmFkZChpbmRleCk7XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgcGFnZS5wcm9taXNlO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRsaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuZ2V0KGluZGV4KTtcblx0fVxuXG5cdHByaXZhdGUgcG9wdWxhdGVSZXNvbHZlZEV4dGVuc2lvbnMocGFnZUluZGV4OiBudW1iZXIsIGV4dGVuc2lvbnM6IElFeHRlbnNpb25bXSk6IHZvaWQge1xuXHRcdGxldCBhZGp1c3RJbmRleE9mTmV4dFBhZ2VzQnkgPSAwO1xuXHRcdGNvbnN0IHBhZ2VTdGFydEluZGV4ID0gcGFnZUluZGV4ICogdGhpcy5wYWdlci5wYWdlU2l6ZTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGV4dGVuc2lvbnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IGUgPSBleHRlbnNpb25zW2ldO1xuXHRcdFx0aWYgKGUuZ2FsbGVyeT8uaWRlbnRpZmllci51dWlkICYmIHRoaXMucHJlZmVycmVkR2FsbGVyeUV4dGVuc2lvbnMuaGFzKGUuZ2FsbGVyeS5pZGVudGlmaWVyLnV1aWQpKSB7XG5cdFx0XHRcdHRoaXMucmVzb2x2ZWRHYWxsZXJ5RXh0ZW5zaW9uc0Zyb21RdWVyeS5wdXNoKGUpO1xuXHRcdFx0XHRhZGp1c3RJbmRleE9mTmV4dFBhZ2VzQnkrKztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMucmVzb2x2ZWQuc2V0KHRoaXMucHJlZmVycmVkRXh0ZW5zaW9ucy5sZW5ndGggLSB0aGlzLnJlc29sdmVkR2FsbGVyeUV4dGVuc2lvbnNGcm9tUXVlcnkubGVuZ3RoICsgcGFnZVN0YXJ0SW5kZXggKyBpLCBlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0Ly8gSWYgdGhpcyBwYWdlIGhhcyBwcmVmZXJyZWQgZ2FsbGVyeSBleHRlbnNpb25zLCB0aGVuIGFkanVzdCB0aGUgaW5kZXggb2YgdGhlIG5leHQgcGFnZXNcblx0XHQvLyBieSB0aGUgbnVtYmVyIG9mIHByZWZlcnJlZCBnYWxsZXJ5IGV4dGVuc2lvbnMgZm91bmQgaW4gdGhpcyBwYWdlLiBCZWNhdXNlIHRoZXNlIHByZWZlcnJlZCBleHRlbnNpb25zXG5cdFx0Ly8gYXJlIGFscmVhZHkgaW4gdGhlIHJlc29sdmVkIGxpc3QgYW5kIHNpbmNlIHdlIGRpZCBub3QgYWRkIHRoZW0gbm93LCB3ZSBuZWVkIHRvIGFkanVzdCB0aGUgaW5kaWNlcyBvZiB0aGUgbmV4dCBwYWdlcy5cblx0XHQvLyBTa2lwIGZpcnN0IHBhZ2UgYXMgdGhlIHByZWZlcnJlZCBleHRlbnNpb25zIGFyZSBhbHdheXMgaW4gdGhlIGZpcnN0IHBhZ2Vcblx0XHRpZiAocGFnZUluZGV4ICE9PSAwICYmIGFkanVzdEluZGV4T2ZOZXh0UGFnZXNCeSkge1xuXHRcdFx0Y29uc3QgbmV4dFBhZ2VTdGFydEluZGV4ID0gKHBhZ2VJbmRleCArIDEpICogdGhpcy5wYWdlci5wYWdlU2l6ZTtcblx0XHRcdGNvbnN0IGluZGljZXMgPSBbLi4udGhpcy5yZXNvbHZlZC5rZXlzKCldLnNvcnQoKTtcblx0XHRcdGZvciAoY29uc3QgaW5kZXggb2YgaW5kaWNlcykge1xuXHRcdFx0XHRpZiAoaW5kZXggPj0gbmV4dFBhZ2VTdGFydEluZGV4KSB7XG5cdFx0XHRcdFx0Y29uc3QgZSA9IHRoaXMucmVzb2x2ZWQuZ2V0KGluZGV4KTtcblx0XHRcdFx0XHRpZiAoZSkge1xuXHRcdFx0XHRcdFx0dGhpcy5yZXNvbHZlZC5kZWxldGUoaW5kZXgpO1xuXHRcdFx0XHRcdFx0dGhpcy5yZXNvbHZlZC5zZXQoaW5kZXggLSBhZGp1c3RJbmRleE9mTmV4dFBhZ2VzQnksIGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFlBQVksaUJBQWlCLGNBQWMsb0JBQW9CO0FBQ3hFLFNBQVMsT0FBTyxlQUFlO0FBQy9CLFNBQVMscUJBQXFCLGlCQUFpQix5QkFBeUI7QUFDeEUsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxZQUF5Qix5QkFBaUM7QUFDbkUsU0FBUyxXQUFrRCxVQUFVLGVBQXFDLDJCQUEyQiw2QkFBNkI7QUFDbEssU0FBcUMsbUNBQW1DLGlCQUFpQixzQ0FBc0MsNENBQTRDO0FBQzNLLFNBQVMsd0NBQXdDO0FBQ2pELFNBQVMsbUJBQW1CLGdDQUFnQztBQUM1RCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLFFBQVEsU0FBUztBQUMxQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLFVBQVUsZ0JBQWdCO0FBQ25DLFNBQVMsNkJBQTZCLGdCQUFrRCxtQ0FBd0U7QUFDaEssU0FBUyxhQUFhO0FBQ3RCLFNBQVMsbUJBQW1CLG1CQUFtQjtBQUMvQyxTQUFTLHFCQUFxQjtBQUU5QixTQUFT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S0FBSyxnQkFBYyxLQUFLLDJCQUEyQixXQUFXLFVBQVUsQ0FBQyxFQUN6RSxNQUFNLE9BQUs7QUFBRSxhQUFLLFVBQVU7QUFBTSxjQUFNO0FBQUEsTUFBRyxDQUFDLEVBQzVDLFFBQVEsTUFBTSxLQUFLLE1BQU0sSUFBSTtBQUFBLElBQ2hDO0FBRUEsVUFBTSxXQUFXLGtCQUFrQix3QkFBd0IsTUFBTTtBQUNoRSxVQUFJLENBQUMsS0FBSyxLQUFLO0FBQ2Q7QUFBQSxNQUNEO0FBQ0EsV0FBSyxlQUFlLE9BQU8sS0FBSztBQUNoQyxVQUFJLEtBQUssZUFBZSxTQUFTLEdBQUc7QUFDbkMsYUFBSyxJQUFJLE9BQU87QUFBQSxNQUNqQjtBQUFBLElBQ0QsQ0FBQztBQUVELFNBQUssZUFBZSxJQUFJLEtBQUs7QUFFN0IsUUFBSTtBQUNILFlBQU0sS0FBSztBQUFBLElBQ1osVUFBRTtBQUNELGVBQVMsUUFBUTtBQUFBLElBQ2xCO0FBRUEsV0FBTyxLQUFLLElBQUksS0FBSztBQUFBLEVBQ3RCO0FBQUEsRUFFUSwyQkFBMkIsV0FBbUIsWUFBZ0M7QUFDckYsUUFBSSwyQkFBMkI7QUFDL0IsVUFBTSxpQkFBaUIsWUFBWSxLQUFLLE1BQU07QUFDOUMsYUFBUyxJQUFJLEdBQUcsSUFBSSxXQUFXLFFBQVEsS0FBSztBQUMzQyxZQUFNLElBQUksV0FBVyxDQUFDO0FBQ3RCLFVBQUksRUFBRSxTQUFTLFdBQVcsUUFBUSxLQUFLLDJCQUEyQixJQUFJLEVBQUUsUUFBUSxXQUFXLElBQUksR0FBRztBQUNqRyxhQUFLLG1DQUFtQyxLQUFLLENBQUM7QUFDOUM7QUFBQSxNQUNELE9BQU87QUFDTixhQUFLLFNBQVMsSUFBSSxLQUFLLG9CQUFvQixTQUFTLEtBQUssbUNBQW1DLFNBQVMsaUJBQWlCLEdBQUcsQ0FBQztBQUFBLE1BQzNIO0FBQUEsSUFDRDtBQUtBLFFBQUksY0FBYyxLQUFLLDBCQUEwQjtBQUNoRCxZQUFNLHNCQUFzQixZQUFZLEtBQUssS0FBSyxNQUFNO0FBQ3hELFlBQU0sVUFBVSxDQUFDLEdBQUcsS0FBSyxTQUFTLEtBQUssQ0FBQyxFQUFFLEtBQUs7QUFDL0MsaUJBQVcsU0FBUyxTQUFTO0FBQzVCLFlBQUksU0FBUyxvQkFBb0I7QUFDaEMsZ0JBQU0sSUFBSSxLQUFLLFNBQVMsSUFBSSxLQUFLO0FBQ2pDLGNBQUksR0FBRztBQUNOLGlCQUFLLFNBQVMsT0FBTyxLQUFLO0FBQzFCLGlCQUFLLFNBQVMsSUFBSSxRQUFRLDBCQUEwQixDQUFDO0FBQUEsVUFDdEQ7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0Q7IiwKICAibmFtZXMiOiBbIkxvY2FsU29ydEJ5IiwgIm1vZGVsIiwgInJlc3VsdCIsICJsb2NhbCIsICJwYWdlciIsICJleHRlbnNpb24iXQp9Cg==
