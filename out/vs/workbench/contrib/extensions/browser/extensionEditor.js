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
import { $, addDisposableListener, append, hide, setParentFlowTo, show } from "../../../../base/browser/dom.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { DomScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { CheckboxActionViewItem } from "../../../../base/browser/ui/toggle/toggle.js";
import { Action } from "../../../../base/common/actions.js";
import * as arrays from "../../../../base/common/arrays.js";
import { Cache } from "../../../../base/common/cache.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { Schemas, matchesScheme } from "../../../../base/common/network.js";
import { isNative, language } from "../../../../base/common/platform.js";
import { isUndefined } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import "./media/extensionEditor.css";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { TokenizationRegistry } from "../../../../editor/common/languages.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { generateTokensCSSForColorMap } from "../../../../editor/common/languages/supports/tokenization.js";
import { localize } from "../../../../nls.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { computeSize, FilterType, IExtensionGalleryService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { areSameExtensions } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { ExtensionType } from "../../../../platform/extensions/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { defaultCheckboxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { buttonForeground, buttonHoverBackground, editorBackground, textLinkActiveForeground, textLinkForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService, registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { ExtensionFeaturesTab } from "./extensionFeaturesTab.js";
import {
  ButtonWithDropDownExtensionAction,
  ClearLanguageAction,
  DisableDropDownAction,
  EnableDropDownAction,
  ButtonWithDropdownExtensionActionViewItem,
  DropDownExtensionAction,
  ExtensionEditorManageExtensionAction,
  ExtensionStatusAction,
  ExtensionStatusLabelAction,
  InstallAnotherVersionAction,
  InstallDropdownAction,
  InstallingLabelAction,
  LocalInstallAction,
  MigrateDeprecatedExtensionAction,
  ExtensionRuntimeStateAction,
  RemoteInstallAction,
  SetColorThemeAction,
  SetFileIconThemeAction,
  SetLanguageAction,
  SetProductIconThemeAction,
  ToggleAutoUpdateForExtensionAction,
  UninstallAction,
  UpdateAction,
  WebInstallAction,
  TogglePreReleaseExtensionAction
} from "./extensionsActions.js";
import { Delegate } from "./extensionsList.js";
import { ExtensionData, ExtensionsGridView, ExtensionsTree, getExtensions } from "./extensionsViewer.js";
import { ExtensionRecommendationWidget, ExtensionStatusWidget, ExtensionWidget, InstallCountWidget, RatingsWidget, RemoteBadgeWidget, SponsorWidget, PublisherWidget, onClick, ExtensionKindIndicatorWidget } from "./extensionsWidgets.js";
import { ExtensionContainers, ExtensionEditorTab, ExtensionState, IExtensionsWorkbenchService } from "../common/extensions.js";
import { DEFAULT_MARKDOWN_STYLES, renderMarkdownDocument } from "../../markdown/browser/markdownDocumentRenderer.js";
import { IWebviewService, KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED } from "../../webview/browser/webview.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IExtensionRecommendationsService } from "../../../services/extensionRecommendations/common/extensionRecommendations.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { ByteSize, IFileService } from "../../../../platform/files/common/files.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { IExtensionGalleryManifestService } from "../../../../platform/extensionManagement/common/extensionGalleryManifest.js";
function toDateString(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}, ${date.toLocaleTimeString(language, { hourCycle: "h23" })}`;
}
class NavBar extends Disposable {
  constructor(container) {
    super();
    this._onChange = this._register(new Emitter());
    this._currentId = null;
    const element = append(container, $(".navbar"));
    this.actions = [];
    this.actionbar = this._register(new ActionBar(element));
  }
  get onChange() {
    return this._onChange.event;
  }
  get currentId() {
    return this._currentId;
  }
  push(id, label, tooltip) {
    const action = new Action(id, label, void 0, true, () => this.update(id, true));
    action.tooltip = tooltip;
    this.actions.push(action);
    this.actionbar.push(action);
    if (this.actions.length === 1) {
      this.update(id);
    }
  }
  clear() {
    this.actions = dispose(this.actions);
    this.actionbar.clear();
  }
  switch(id) {
    const action = this.actions.find((action2) => action2.id === id);
    if (action) {
      action.run();
      return true;
    }
    return false;
  }
  update(id, focus) {
    this._currentId = id;
    this._onChange.fire({ id, focus: !!focus });
    this.actions.forEach((a) => a.checked = a.id === id);
  }
}
var WebviewIndex = /* @__PURE__ */ ((WebviewIndex2) => {
  WebviewIndex2[WebviewIndex2["Readme"] = 0] = "Readme";
  WebviewIndex2[WebviewIndex2["Changelog"] = 1] = "Changelog";
  return WebviewIndex2;
})(WebviewIndex || {});
const CONTEXT_SHOW_PRE_RELEASE_VERSION = new RawContextKey("showPreReleaseVersion", false);
class ExtensionWithDifferentGalleryVersionWidget extends ExtensionWidget {
  constructor() {
    super(...arguments);
    this._gallery = null;
  }
  get gallery() {
    return this._gallery;
  }
  set gallery(gallery) {
    if (this.extension && gallery && !areSameExtensions(this.extension.identifier, gallery.identifier)) {
      return;
    }
    this._gallery = gallery;
    this.update();
  }
}
class VersionWidget extends ExtensionWithDifferentGalleryVersionWidget {
  constructor(container, hoverService) {
    super();
    this.element = append(container, $("code.version", void 0, "pre-release"));
    this._register(hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.element, localize("extension version", "Extension Version")));
    this.render();
  }
  render() {
    if (this.extension?.preRelease) {
      show(this.element);
    } else {
      hide(this.element);
    }
  }
}
let ExtensionEditor = class extends EditorPane {
  constructor(group, telemetryService, instantiationService, extensionsWorkbenchService, extensionGalleryService, themeService, notificationService, openerService, extensionRecommendationsService, storageService, extensionService, webviewService, languageService, contextMenuService, contextKeyService, hoverService) {
    super(ExtensionEditor.ID, group, telemetryService, themeService, storageService);
    this.instantiationService = instantiationService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionGalleryService = extensionGalleryService;
    this.notificationService = notificationService;
    this.openerService = openerService;
    this.extensionRecommendationsService = extensionRecommendationsService;
    this.extensionService = extensionService;
    this.webviewService = webviewService;
    this.languageService = languageService;
    this.contextMenuService = contextMenuService;
    this.contextKeyService = contextKeyService;
    this.hoverService = hoverService;
    this._scopedContextKeyService = this._register(new MutableDisposable());
    // Some action bar items use a webview whose vertical scroll position we track in this map
    this.initialScrollProgress = /* @__PURE__ */ new Map();
    // Spot when an ExtensionEditor instance gets reused for a different extension, in which case the vertical scroll positions must be zeroed
    this.currentIdentifier = "";
    this.layoutParticipants = [];
    this.contentDisposables = this._register(new DisposableStore());
    this.transientDisposables = this._register(new DisposableStore());
    this.activeElement = null;
    this.extensionReadme = null;
    this.extensionChangelog = null;
    this.extensionManifest = null;
  }
  get scopedContextKeyService() {
    return this._scopedContextKeyService.value;
  }
  createEditor(parent) {
    const root = append(parent, $(".extension-editor"));
    this._scopedContextKeyService.value = this.contextKeyService.createScoped(root);
    this._scopedContextKeyService.value.createKey("inExtensionEditor", true);
    this.showPreReleaseVersionContextKey = CONTEXT_SHOW_PRE_RELEASE_VERSION.bindTo(this._scopedContextKeyService.value);
    root.tabIndex = 0;
    root.style.outline = "none";
    root.setAttribute("role", "document");
    const header = append(root, $(".header"));
    const iconContainer = append(header, $(".icon-container"));
    const icon = append(iconContainer, $("img.icon", { draggable: false, alt: "" }));
    const remoteBadge = this.instantiationService.createInstance(RemoteBadgeWidget, iconContainer, true);
    const details = append(header, $(".details"));
    const title = append(details, $(".title"));
    const name = append(title, $("span.name.clickable", { role: "heading", tabIndex: 0 }));
    this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), name, localize("name", "Extension name")));
    const versionWidget = new VersionWidget(title, this.hoverService);
    const preview = append(title, $("span.preview"));
    this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), preview, localize("preview", "Preview")));
    preview.textContent = localize("preview", "Preview");
    const builtin = append(title, $("span.builtin"));
    builtin.textContent = localize("builtin", "Built-in");
    const subtitle = append(details, $(".subtitle"));
    const subTitleEntryContainers = [];
    const publisherContainer = append(subtitle, $(".subtitle-entry"));
    subTitleEntryContainers.push(publisherContainer);
    const publisherWidget = this.instantiationService.createInstance(PublisherWidget, publisherContainer, false);
    const extensionKindContainer = append(subtitle, $(".subtitle-entry"));
    subTitleEntryContainers.push(extensionKindContainer);
    const extensionKindWidget = this.instantiationService.createInstance(ExtensionKindIndicatorWidget, extensionKindContainer, false);
    const installCountContainer = append(subtitle, $(".subtitle-entry"));
    subTitleEntryContainers.push(installCountContainer);
    const installCountWidget = this.instantiationService.createInstance(InstallCountWidget, installCountContainer, false);
    const ratingsContainer = append(subtitle, $(".subtitle-entry"));
    subTitleEntryContainers.push(ratingsContainer);
    const ratingsWidget = this.instantiationService.createInstance(RatingsWidget, ratingsContainer, false);
    const sponsorContainer = append(subtitle, $(".subtitle-entry"));
    subTitleEntryContainers.push(sponsorContainer);
    const sponsorWidget = this.instantiationService.createInstance(SponsorWidget, sponsorContainer);
    const widgets = [
      remoteBadge,
      versionWidget,
      publisherWidget,
      extensionKindWidget,
      installCountWidget,
      ratingsWidget,
      sponsorWidget
    ];
    const description = append(details, $(".description"));
    const installAction = this.instantiationService.createInstance(InstallDropdownAction);
    const actions = [
      this.instantiationService.createInstance(ExtensionRuntimeStateAction),
      this.instantiationService.createInstance(ExtensionStatusLabelAction),
      this.instantiationService.createInstance(UpdateAction, true),
      this.instantiationService.createInstance(SetColorThemeAction),
      this.instantiationService.createInstance(SetFileIconThemeAction),
      this.instantiationService.createInstance(SetProductIconThemeAction),
      this.instantiationService.createInstance(SetLanguageAction),
      this.instantiationService.createInstance(ClearLanguageAction),
      this.instantiationService.createInstance(EnableDropDownAction),
      this.instantiationService.createInstance(DisableDropDownAction),
      this.instantiationService.createInstance(RemoteInstallAction, false),
      this.instantiationService.createInstance(LocalInstallAction),
      this.instantiationService.createInstance(WebInstallAction),
      installAction,
      this.instantiationService.createInstance(InstallingLabelAction),
      this.instantiationService.createInstance(ButtonWithDropDownExtensionAction, "extensions.uninstall", UninstallAction.UninstallClass, [
        [
          this.instantiationService.createInstance(MigrateDeprecatedExtensionAction, false),
          this.instantiationService.createInstance(UninstallAction),
          this.instantiationService.createInstance(InstallAnotherVersionAction, null, true)
        ]
      ]),
      this.instantiationService.createInstance(TogglePreReleaseExtensionAction),
      this.instantiationService.createInstance(ToggleAutoUpdateForExtensionAction),
      new ExtensionEditorManageExtensionAction(this.scopedContextKeyService || this.contextKeyService, this.instantiationService)
    ];
    const actionsAndStatusContainer = append(details, $(".actions-status-container"));
    const extensionActionBar = this._register(new ActionBar(actionsAndStatusContainer, {
      actionViewItemProvider: (action, options) => {
        if (action instanceof DropDownExtensionAction) {
          return action.createActionViewItem(options);
        }
        if (action instanceof ButtonWithDropDownExtensionAction) {
          return new ButtonWithDropdownExtensionActionViewItem(
            action,
            {
              ...options,
              icon: true,
              label: true,
              menuActionsOrProvider: { getActions: () => action.menuActions },
              menuActionClassNames: action.menuActionClassNames
            },
            this.contextMenuService
          );
        }
        if (action instanceof ToggleAutoUpdateForExtensionAction) {
          return new CheckboxActionViewItem(void 0, action, { ...options, icon: true, label: true, checkboxStyles: defaultCheckboxStyles });
        }
        return void 0;
      },
      focusOnlyEnabledItems: true
    }));
    extensionActionBar.push(actions, { icon: true, label: true });
    extensionActionBar.setFocusable(true);
    this._register(Event.any(...actions.map((a) => Event.filter(a.onDidChange, (e) => e.enabled !== void 0)))(() => {
      extensionActionBar.setFocusable(false);
      extensionActionBar.setFocusable(true);
    }));
    const otherExtensionContainers = [];
    const extensionStatusAction = this.instantiationService.createInstance(ExtensionStatusAction);
    const extensionStatusWidget = this._register(this.instantiationService.createInstance(ExtensionStatusWidget, append(actionsAndStatusContainer, $(".status")), extensionStatusAction));
    otherExtensionContainers.push(extensionStatusAction, new class extends ExtensionWidget {
      render() {
        actionsAndStatusContainer.classList.toggle("list-layout", this.extension?.state === ExtensionState.Installed);
      }
    }());
    const recommendationWidget = this.instantiationService.createInstance(ExtensionRecommendationWidget, append(details, $(".recommendation")));
    widgets.push(recommendationWidget);
    this._register(Event.any(extensionStatusWidget.onDidRender, recommendationWidget.onDidRender)(() => {
      if (this.dimension) {
        this.layout(this.dimension);
      }
    }));
    const extensionContainers = this.instantiationService.createInstance(ExtensionContainers, [...actions, ...widgets, ...otherExtensionContainers]);
    for (const disposable of [...actions, ...widgets, ...otherExtensionContainers, extensionContainers]) {
      this._register(disposable);
    }
    const onError = Event.chain(
      extensionActionBar.onDidRun,
      ($2) => $2.map(({ error }) => error).filter((error) => !!error)
    );
    this._register(onError(this.onError, this));
    const body = append(root, $(".body"));
    const navbar = new NavBar(body);
    const content = append(body, $(".content"));
    content.id = generateUuid();
    this.template = {
      builtin,
      content,
      description,
      header,
      icon,
      iconContainer,
      name,
      navbar,
      preview,
      actionsAndStatusContainer,
      extensionActionBar,
      set extension(extension) {
        extensionContainers.extension = extension;
        let lastNonEmptySubtitleEntryContainer;
        for (const subTitleEntryElement of subTitleEntryContainers) {
          subTitleEntryElement.classList.remove("last-non-empty");
          if (subTitleEntryElement.children.length > 0) {
            lastNonEmptySubtitleEntryContainer = subTitleEntryElement;
          }
        }
        if (lastNonEmptySubtitleEntryContainer) {
          lastNonEmptySubtitleEntryContainer.classList.add("last-non-empty");
        }
      },
      set gallery(gallery) {
        versionWidget.gallery = gallery;
      },
      set manifest(manifest) {
        installAction.manifest = manifest;
      }
    };
  }
  async setInput(input, options, context, token) {
    await super.setInput(input, options, context, token);
    this.updatePreReleaseVersionContext();
    if (this.template) {
      await this.render(input.extension, this.template, !!options?.preserveFocus);
    }
  }
  setOptions(options) {
    const currentOptions = this.options;
    super.setOptions(options);
    this.updatePreReleaseVersionContext();
    if (this.input && this.template && currentOptions?.showPreReleaseVersion !== options?.showPreReleaseVersion) {
      this.render(this.input.extension, this.template, !!options?.preserveFocus);
      return;
    }
    if (options?.tab) {
      this.template?.navbar.switch(options.tab);
    }
  }
  updatePreReleaseVersionContext() {
    let showPreReleaseVersion = this.options?.showPreReleaseVersion;
    if (isUndefined(showPreReleaseVersion)) {
      showPreReleaseVersion = !!this.input.extension.gallery?.properties.isPreReleaseVersion;
    }
    this.showPreReleaseVersionContextKey?.set(showPreReleaseVersion);
  }
  async openTab(tab) {
    if (!this.input || !this.template) {
      return;
    }
    if (this.template.navbar.switch(tab)) {
      return;
    }
    if (tab === ExtensionEditorTab.ExtensionPack) {
      this.template.navbar.switch(ExtensionEditorTab.Readme);
    }
  }
  async getGalleryVersionToShow(extension, preRelease) {
    if (extension.resourceExtension) {
      return null;
    }
    if (extension.local?.source === "resource") {
      return null;
    }
    if (isUndefined(preRelease)) {
      return null;
    }
    if (preRelease === extension.gallery?.properties.isPreReleaseVersion) {
      return null;
    }
    if (preRelease && !extension.hasPreReleaseVersion) {
      return null;
    }
    if (!preRelease && !extension.hasReleaseVersion) {
      return null;
    }
    return (await this.extensionGalleryService.getExtensions([{ ...extension.identifier, preRelease, hasPreRelease: extension.hasPreReleaseVersion }], CancellationToken.None))[0] || null;
  }
  async render(extension, template, preserveFocus) {
    this.activeElement = null;
    this.transientDisposables.clear();
    const token = this.transientDisposables.add(new CancellationTokenSource()).token;
    const gallery = await this.getGalleryVersionToShow(extension, this.options?.showPreReleaseVersion);
    if (token.isCancellationRequested) {
      return;
    }
    this.extensionReadme = new Cache(() => gallery ? this.extensionGalleryService.getReadme(gallery, token) : extension.getReadme(token));
    this.extensionChangelog = new Cache(() => gallery ? this.extensionGalleryService.getChangelog(gallery, token) : extension.getChangelog(token));
    this.extensionManifest = new Cache(() => gallery ? this.extensionGalleryService.getManifest(gallery, token) : extension.getManifest(token));
    template.extension = extension;
    template.gallery = gallery;
    template.manifest = null;
    this.transientDisposables.add(addDisposableListener(template.icon, "error", () => template.icon.src = extension.iconUrlFallback, { once: true }));
    template.icon.src = extension.iconUrl;
    template.name.textContent = extension.displayName;
    template.name.classList.toggle("clickable", !!extension.url);
    template.name.classList.toggle("deprecated", !!extension.deprecationInfo);
    template.preview.style.display = extension.preview ? "inherit" : "none";
    template.builtin.style.display = extension.isBuiltin ? "inherit" : "none";
    template.description.textContent = extension.description;
    if (extension.url) {
      this.transientDisposables.add(onClick(template.name, () => this.openerService.open(URI.parse(extension.url))));
    }
    const manifest = await this.extensionManifest.get().promise;
    if (token.isCancellationRequested) {
      return;
    }
    if (manifest) {
      template.manifest = manifest;
    }
    this.renderNavbar(extension, manifest, template, preserveFocus);
    const extRecommendations = this.extensionRecommendationsService.getAllRecommendationsWithReason();
    let recommendationsData = {};
    if (extRecommendations[extension.identifier.id.toLowerCase()]) {
      recommendationsData = { recommendationReason: extRecommendations[extension.identifier.id.toLowerCase()].reasonId };
    }
    this.telemetryService.publicLog("extensionGallery:openExtension", { ...extension.telemetryData, ...recommendationsData });
  }
  renderNavbar(extension, manifest, template, preserveFocus) {
    template.content.innerText = "";
    template.navbar.clear();
    if (this.currentIdentifier !== extension.identifier.id) {
      this.initialScrollProgress.clear();
      this.currentIdentifier = extension.identifier.id;
    }
    template.navbar.push(ExtensionEditorTab.Readme, localize("details", "Details"), localize("detailstooltip", "Extension details, rendered from the extension's 'README.md' file"));
    if (manifest) {
      template.navbar.push(ExtensionEditorTab.Features, localize("features", "Features"), localize("featurestooltip", "Lists features contributed by this extension"));
    }
    if (extension.hasChangelog()) {
      template.navbar.push(ExtensionEditorTab.Changelog, localize("changelog", "Changelog"), localize("changelogtooltip", "Extension update history, rendered from the extension's 'CHANGELOG.md' file"));
    }
    if (extension.dependencies.length) {
      template.navbar.push(ExtensionEditorTab.Dependencies, localize("dependencies", "Dependencies"), localize("dependenciestooltip", "Lists extensions this extension depends on"));
    }
    if (manifest && manifest.extensionPack?.length && !this.shallRenderAsExtensionPack(manifest)) {
      template.navbar.push(ExtensionEditorTab.ExtensionPack, localize("extensionpack", "Extension Pack"), localize("extensionpacktooltip", "Lists extensions those will be installed together with this extension"));
    }
    if (this.options?.tab) {
      template.navbar.switch(this.options.tab);
    }
    if (template.navbar.currentId) {
      this.onNavbarChange(extension, { id: template.navbar.currentId, focus: !preserveFocus }, template);
    }
    template.navbar.onChange((e) => this.onNavbarChange(extension, e, template), this, this.transientDisposables);
  }
  clearInput() {
    this.contentDisposables.clear();
    this.transientDisposables.clear();
    super.clearInput();
  }
  focus() {
    super.focus();
    this.activeElement?.focus();
  }
  showFind() {
    this.activeWebview?.showFind();
  }
  runFindAction(previous) {
    this.activeWebview?.runFindAction(previous);
  }
  get activeWebview() {
    if (!this.activeElement || !this.activeElement.runFindAction) {
      return void 0;
    }
    return this.activeElement;
  }
  onNavbarChange(extension, { id, focus }, template) {
    this.contentDisposables.clear();
    template.content.innerText = "";
    this.activeElement = null;
    if (id) {
      const cts = new CancellationTokenSource();
      this.contentDisposables.add(toDisposable(() => cts.dispose(true)));
      this.open(id, extension, template, cts.token).then((activeElement) => {
        if (cts.token.isCancellationRequested) {
          return;
        }
        this.activeElement = activeElement;
        if (focus) {
          this.focus();
        }
      });
    }
  }
  open(id, extension, template, token) {
    switch (id) {
      case ExtensionEditorTab.Readme:
        return this.openDetails(extension, template, token);
      case ExtensionEditorTab.Features:
        return this.openFeatures(template, token);
      case ExtensionEditorTab.Changelog:
        return this.openChangelog(extension, template, token);
      case ExtensionEditorTab.Dependencies:
        return this.openExtensionDependencies(extension, template, token);
      case ExtensionEditorTab.ExtensionPack:
        return this.openExtensionPack(extension, template, token);
    }
    return Promise.resolve(null);
  }
  async openMarkdown(extension, cacheResult, noContentCopy, container, webviewIndex, title, token) {
    try {
      const body = await this.renderMarkdown(extension, cacheResult, container, token);
      if (token.isCancellationRequested) {
        return Promise.resolve(null);
      }
      const webview = this.contentDisposables.add(this.webviewService.createWebviewOverlay({
        title,
        options: {
          enableFindWidget: true,
          tryRestoreScrollPosition: true,
          disableServiceWorker: true
        },
        contentOptions: {},
        extension: void 0
      }));
      webview.initialScrollProgress = this.initialScrollProgress.get(webviewIndex) || 0;
      webview.claim(this, this.window, this.scopedContextKeyService);
      setParentFlowTo(webview.container, container);
      webview.layoutWebviewOverElement(container);
      webview.setHtml(body);
      webview.claim(this, this.window, void 0);
      this.contentDisposables.add(webview.onDidFocus(() => this._onDidFocus?.fire()));
      this.contentDisposables.add(webview.onDidScroll(() => this.initialScrollProgress.set(webviewIndex, webview.initialScrollProgress)));
      const removeLayoutParticipant = arrays.insert(this.layoutParticipants, {
        layout: () => {
          webview.layoutWebviewOverElement(container);
        }
      });
      this.contentDisposables.add(toDisposable(removeLayoutParticipant));
      let isDisposed = false;
      this.contentDisposables.add(toDisposable(() => {
        isDisposed = true;
      }));
      this.contentDisposables.add(this.themeService.onDidColorThemeChange(async () => {
        const body2 = await this.renderMarkdown(extension, cacheResult, container);
        if (!isDisposed) {
          webview.setHtml(body2);
        }
      }));
      this.contentDisposables.add(webview.onDidClickLink((link) => {
        if (!link) {
          return;
        }
        if (matchesScheme(link, Schemas.http) || matchesScheme(link, Schemas.https) || matchesScheme(link, Schemas.mailto)) {
          this.openerService.open(link);
        }
        if (matchesScheme(link, Schemas.command) && extension.type === ExtensionType.System) {
          this.openerService.open(link, { allowCommands: true });
        }
      }));
      return webview;
    } catch (e) {
      const p = append(container, $("p.nocontent"));
      p.textContent = noContentCopy;
      return p;
    }
  }
  async renderMarkdown(extension, cacheResult, container, token) {
    const contents = await this.loadContents(() => cacheResult, container);
    if (token?.isCancellationRequested) {
      return "";
    }
    const content = await renderMarkdownDocument(contents, this.extensionService, this.languageService, { shouldSanitize: extension.type !== ExtensionType.System, token });
    if (token?.isCancellationRequested) {
      return "";
    }
    return this.renderBody(content);
  }
  renderBody(body) {
    const nonce = generateUuid();
    const colorMap = TokenizationRegistry.getColorMap();
    const css = colorMap ? generateTokensCSSForColorMap(colorMap) : "";
    return `<!DOCTYPE html>
		<html>
			<head>
				<meta http-equiv="Content-type" content="text/html;charset=UTF-8">
				<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; media-src https:; script-src 'none'; style-src 'nonce-${nonce}';">
				<style nonce="${nonce}">
					${DEFAULT_MARKDOWN_STYLES}

					/* prevent scroll-to-top button from blocking the body text */
					body {
						padding-bottom: 75px;
					}

					#scroll-to-top {
						position: fixed;
						width: 32px;
						height: 32px;
						right: 25px;
						bottom: 25px;
						background-color: var(--vscode-button-secondaryBackground);
						border-color: var(--vscode-button-border);
						border-radius: 50%;
						cursor: pointer;
						box-shadow: 1px 1px 1px rgba(0,0,0,.25);
						outline: none;
						display: flex;
						justify-content: center;
						align-items: center;
					}

					#scroll-to-top:hover {
						background-color: var(--vscode-button-secondaryHoverBackground);
						box-shadow: 2px 2px 2px rgba(0,0,0,.25);
					}

					body.vscode-high-contrast #scroll-to-top {
						border-width: 2px;
						border-style: solid;
						box-shadow: none;
					}

					#scroll-to-top span.icon::before {
						content: "";
						display: block;
						background: var(--vscode-button-secondaryForeground);
						/* Chevron up icon */
						webkit-mask-image: url('data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDE5LjIuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCAxNiAxNiIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgMTYgMTY7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KPHN0eWxlIHR5cGU9InRleHQvY3NzIj4KCS5zdDB7ZmlsbDojRkZGRkZGO30KCS5zdDF7ZmlsbDpub25lO30KPC9zdHlsZT4KPHRpdGxlPnVwY2hldnJvbjwvdGl0bGU+CjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik04LDUuMWwtNy4zLDcuM0wwLDExLjZsOC04bDgsOGwtMC43LDAuN0w4LDUuMXoiLz4KPHJlY3QgY2xhc3M9InN0MSIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ii8+Cjwvc3ZnPgo=');
						-webkit-mask-image: url('data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0idXRmLTgiPz4KPCEtLSBHZW5lcmF0b3I6IEFkb2JlIElsbHVzdHJhdG9yIDE5LjIuMCwgU1ZHIEV4cG9ydCBQbHVnLUluIC4gU1ZHIFZlcnNpb246IDYuMDAgQnVpbGQgMCkgIC0tPgo8c3ZnIHZlcnNpb249IjEuMSIgaWQ9IkxheWVyXzEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiIHg9IjBweCIgeT0iMHB4IgoJIHZpZXdCb3g9IjAgMCAxNiAxNiIgc3R5bGU9ImVuYWJsZS1iYWNrZ3JvdW5kOm5ldyAwIDAgMTYgMTY7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KPHN0eWxlIHR5cGU9InRleHQvY3NzIj4KCS5zdDB7ZmlsbDojRkZGRkZGO30KCS5zdDF7ZmlsbDpub25lO30KPC9zdHlsZT4KPHRpdGxlPnVwY2hldnJvbjwvdGl0bGU+CjxwYXRoIGNsYXNzPSJzdDAiIGQ9Ik04LDUuMWwtNy4zLDcuM0wwLDExLjZsOC04bDgsOGwtMC43LDAuN0w4LDUuMXoiLz4KPHJlY3QgY2xhc3M9InN0MSIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ii8+Cjwvc3ZnPgo=');
						width: 16px;
						height: 16px;
					}
					${css}
				</style>
			</head>
			<body>
				<a id="scroll-to-top" role="button" aria-label="scroll to top" href="#"><span class="icon"></span></a>
				${body}
			</body>
		</html>`;
  }
  async openDetails(extension, template, token) {
    const details = append(template.content, $(".details"));
    const readmeContainer = append(details, $(".readme-container"));
    const additionalDetailsContainer = append(details, $(".additional-details-container"));
    const layout = () => details.classList.toggle("narrow", this.dimension && this.dimension.width < 500);
    layout();
    this.contentDisposables.add(toDisposable(arrays.insert(this.layoutParticipants, { layout })));
    let activeElement = null;
    const manifest = await this.extensionManifest.get().promise;
    if (manifest && manifest.extensionPack?.length && this.shallRenderAsExtensionPack(manifest)) {
      activeElement = await this.openExtensionPackReadme(extension, manifest, readmeContainer, token);
    } else {
      activeElement = await this.openMarkdown(extension, this.extensionReadme.get(), localize("noReadme", "No README available."), readmeContainer, 0 /* Readme */, localize("Readme title", "Readme"), token);
    }
    this.renderAdditionalDetails(additionalDetailsContainer, extension);
    return activeElement;
  }
  shallRenderAsExtensionPack(manifest) {
    return !!manifest.categories?.some((category) => category.toLowerCase() === "extension packs");
  }
  async openExtensionPackReadme(extension, manifest, container, token) {
    if (token.isCancellationRequested) {
      return Promise.resolve(null);
    }
    const extensionPackReadme = append(container, $("div", { class: "extension-pack-readme" }));
    extensionPackReadme.style.margin = "0 auto";
    extensionPackReadme.style.maxWidth = "882px";
    const extensionPack = append(extensionPackReadme, $("div", { class: "extension-pack" }));
    if (manifest.extensionPack.length <= 3) {
      extensionPackReadme.classList.add("one-row");
    } else if (manifest.extensionPack.length <= 6) {
      extensionPackReadme.classList.add("two-rows");
    } else if (manifest.extensionPack.length <= 9) {
      extensionPackReadme.classList.add("three-rows");
    } else {
      extensionPackReadme.classList.add("more-rows");
    }
    const extensionPackHeader = append(extensionPack, $("div.header"));
    extensionPackHeader.textContent = localize("extension pack", "Extension Pack ({0})", manifest.extensionPack.length);
    const extensionPackContent = append(extensionPack, $("div", { class: "extension-pack-content" }));
    extensionPackContent.setAttribute("tabindex", "0");
    append(extensionPack, $("div.footer"));
    const readmeContent = append(extensionPackReadme, $("div.readme-content"));
    await Promise.all([
      this.renderExtensionPack(manifest, extensionPackContent, token),
      this.openMarkdown(extension, this.extensionReadme.get(), localize("noReadme", "No README available."), readmeContent, 0 /* Readme */, localize("Readme title", "Readme"), token)
    ]);
    return { focus: () => extensionPackContent.focus() };
  }
  renderAdditionalDetails(container, extension) {
    const content = $("div", { class: "additional-details-content", tabindex: "0" });
    const scrollableContent = new DomScrollableElement(content, {});
    const layout = () => scrollableContent.scanDomNode();
    const removeLayoutParticipant = arrays.insert(this.layoutParticipants, { layout });
    this.contentDisposables.add(toDisposable(removeLayoutParticipant));
    this.contentDisposables.add(scrollableContent);
    this.contentDisposables.add(this.instantiationService.createInstance(AdditionalDetailsWidget, content, extension));
    append(container, scrollableContent.getDomNode());
    scrollableContent.scanDomNode();
  }
  openChangelog(extension, template, token) {
    return this.openMarkdown(extension, this.extensionChangelog.get(), localize("noChangelog", "No Changelog available."), template.content, 1 /* Changelog */, localize("Changelog title", "Changelog"), token);
  }
  async openFeatures(template, token) {
    const manifest = await this.loadContents(() => this.extensionManifest.get(), template.content);
    if (token.isCancellationRequested) {
      return null;
    }
    if (!manifest) {
      return null;
    }
    const extensionFeaturesTab = this.contentDisposables.add(this.instantiationService.createInstance(ExtensionFeaturesTab, manifest, this.options?.feature));
    const layout = () => extensionFeaturesTab.layout(template.content.clientHeight, template.content.clientWidth);
    const removeLayoutParticipant = arrays.insert(this.layoutParticipants, { layout });
    this.contentDisposables.add(toDisposable(removeLayoutParticipant));
    append(template.content, extensionFeaturesTab.domNode);
    layout();
    return extensionFeaturesTab.domNode;
  }
  openExtensionDependencies(extension, template, token) {
    if (token.isCancellationRequested) {
      return Promise.resolve(null);
    }
    if (arrays.isFalsyOrEmpty(extension.dependencies)) {
      append(template.content, $("p.nocontent")).textContent = localize("noDependencies", "No Dependencies");
      return Promise.resolve(template.content);
    }
    const content = $("div", { class: "subcontent" });
    const scrollableContent = new DomScrollableElement(content, {});
    append(template.content, scrollableContent.getDomNode());
    this.contentDisposables.add(scrollableContent);
    const dependenciesTree = this.instantiationService.createInstance(
      ExtensionsTree,
      new ExtensionData(extension, null, (extension2) => extension2.dependencies || [], this.extensionsWorkbenchService),
      content,
      {
        listBackground: editorBackground
      }
    );
    const layout = () => {
      scrollableContent.scanDomNode();
      const scrollDimensions = scrollableContent.getScrollDimensions();
      dependenciesTree.layout(scrollDimensions.height);
    };
    const removeLayoutParticipant = arrays.insert(this.layoutParticipants, { layout });
    this.contentDisposables.add(toDisposable(removeLayoutParticipant));
    this.contentDisposables.add(dependenciesTree);
    scrollableContent.scanDomNode();
    return Promise.resolve({ focus() {
      dependenciesTree.domFocus();
    } });
  }
  async openExtensionPack(extension, template, token) {
    if (token.isCancellationRequested) {
      return Promise.resolve(null);
    }
    const manifest = await this.loadContents(() => this.extensionManifest.get(), template.content);
    if (token.isCancellationRequested) {
      return null;
    }
    if (!manifest) {
      return null;
    }
    return this.renderExtensionPack(manifest, template.content, token);
  }
  async renderExtensionPack(manifest, parent, token) {
    if (token.isCancellationRequested) {
      return null;
    }
    const content = $("div", { class: "subcontent" });
    const scrollableContent = new DomScrollableElement(content, { useShadows: false });
    append(parent, scrollableContent.getDomNode());
    const extensionsGridView = this.instantiationService.createInstance(ExtensionsGridView, content, new Delegate());
    const extensions = await getExtensions(manifest.extensionPack, this.extensionsWorkbenchService);
    extensionsGridView.setExtensions(extensions);
    scrollableContent.scanDomNode();
    this.contentDisposables.add(scrollableContent);
    this.contentDisposables.add(extensionsGridView);
    this.contentDisposables.add(toDisposable(arrays.insert(this.layoutParticipants, { layout: () => scrollableContent.scanDomNode() })));
    return content;
  }
  loadContents(loadingTask, container) {
    container.classList.add("loading");
    const result = this.contentDisposables.add(loadingTask());
    const onDone = () => container.classList.remove("loading");
    result.promise.then(onDone, onDone);
    return result.promise;
  }
  layout(dimension) {
    this.dimension = dimension;
    this.layoutParticipants.forEach((p) => p.layout());
  }
  onError(err) {
    if (isCancellationError(err)) {
      return;
    }
    this.notificationService.error(err);
  }
};
ExtensionEditor.ID = "workbench.editor.extension";
ExtensionEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IExtensionsWorkbenchService),
  __decorateParam(4, IExtensionGalleryService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, INotificationService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IExtensionRecommendationsService),
  __decorateParam(9, IStorageService),
  __decorateParam(10, IExtensionService),
  __decorateParam(11, IWebviewService),
  __decorateParam(12, ILanguageService),
  __decorateParam(13, IContextMenuService),
  __decorateParam(14, IContextKeyService),
  __decorateParam(15, IHoverService)
], ExtensionEditor);
let AdditionalDetailsWidget = class extends Disposable {
  constructor(container, extension, hoverService, openerService, userDataProfilesService, remoteAgentService, fileService, uriIdentityService, extensionsWorkbenchService, extensionGalleryManifestService) {
    super();
    this.container = container;
    this.hoverService = hoverService;
    this.openerService = openerService;
    this.userDataProfilesService = userDataProfilesService;
    this.remoteAgentService = remoteAgentService;
    this.fileService = fileService;
    this.uriIdentityService = uriIdentityService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionGalleryManifestService = extensionGalleryManifestService;
    this.disposables = this._register(new DisposableStore());
    this.render(extension);
    this._register(this.extensionsWorkbenchService.onChange((e) => {
      if (e && areSameExtensions(e.identifier, extension.identifier) && e.server === extension.server) {
        this.render(e);
      }
    }));
  }
  render(extension) {
    this.container.innerText = "";
    this.disposables.clear();
    if (extension.local) {
      this.renderInstallInfo(this.container, extension.local);
    }
    if (extension.gallery) {
      this.renderMarketplaceInfo(this.container, extension);
    }
    this.renderCategories(this.container, extension);
    this.renderExtensionResources(this.container, extension);
  }
  renderCategories(container, extension) {
    if (extension.categories.length) {
      const categoriesContainer = append(container, $(".categories-container.additional-details-element"));
      append(categoriesContainer, $(".additional-details-title", void 0, localize("categories", "Categories")));
      const categoriesElement = append(categoriesContainer, $(".categories"));
      this.extensionGalleryManifestService.getExtensionGalleryManifest().then((manifest) => {
        const hasCategoryFilter = manifest?.capabilities.extensionQuery.filtering?.some(({ name }) => name === FilterType.Category);
        for (const category of extension.categories) {
          const categoryElement = append(categoriesElement, $("span.category", { tabindex: "0" }, category));
          if (hasCategoryFilter) {
            categoryElement.classList.add("clickable");
            this.disposables.add(onClick(categoryElement, () => this.extensionsWorkbenchService.openSearch(`@category:"${category}"`)));
          }
        }
      });
    }
  }
  renderExtensionResources(container, extension) {
    const resources = [];
    if (extension.url) {
      resources.push([localize("Marketplace", "Marketplace"), URI.parse(extension.url)]);
    }
    if (extension.supportUrl) {
      try {
        resources.push([localize("issues", "Issues"), URI.parse(extension.supportUrl)]);
      } catch (error) {
      }
    }
    if (extension.repository) {
      try {
        resources.push([localize("repository", "Repository"), URI.parse(extension.repository)]);
      } catch (error) {
      }
    }
    if (extension.licenseUrl) {
      try {
        resources.push([localize("license", "License"), URI.parse(extension.licenseUrl)]);
      } catch (error) {
      }
    }
    if (extension.publisherUrl) {
      resources.push([extension.publisherDisplayName, extension.publisherUrl]);
    }
    if (resources.length || extension.publisherSponsorLink) {
      const extensionResourcesContainer = append(container, $(".resources-container.additional-details-element"));
      append(extensionResourcesContainer, $(".additional-details-title", void 0, localize("resources", "Resources")));
      const resourcesElement = append(extensionResourcesContainer, $(".resources"));
      for (const [label, uri] of resources) {
        const resource = append(resourcesElement, $("a.resource", { tabindex: "0" }, label));
        this.disposables.add(onClick(resource, () => this.openerService.open(uri)));
        this.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), resource, uri.toString()));
      }
    }
  }
  renderInstallInfo(container, extension) {
    const installInfoContainer = append(container, $(".more-info-container.additional-details-element"));
    append(installInfoContainer, $(".additional-details-title", void 0, localize("Install Info", "Installation")));
    const installInfo = append(installInfoContainer, $(".more-info"));
    append(
      installInfo,
      $(
        ".more-info-entry",
        void 0,
        $("div.more-info-entry-name", void 0, localize("id", "Identifier")),
        $("code", void 0, extension.identifier.id)
      )
    );
    if (extension.type !== ExtensionType.System) {
      append(
        installInfo,
        $(
          ".more-info-entry",
          void 0,
          $("div.more-info-entry-name", void 0, localize("Version", "Version")),
          $("code", void 0, extension.manifest.version)
        )
      );
    }
    if (extension.installedTimestamp) {
      append(
        installInfo,
        $(
          ".more-info-entry",
          void 0,
          $("div.more-info-entry-name", void 0, localize("last updated", "Last Updated")),
          $("div", void 0, toDateString(new Date(extension.installedTimestamp)))
        )
      );
    }
    if (!extension.isBuiltin && extension.source !== "gallery") {
      const element = $("div", void 0, extension.source === "vsix" ? localize("vsix", "VSIX") : localize("other", "Local"));
      append(
        installInfo,
        $(
          ".more-info-entry",
          void 0,
          $("div.more-info-entry-name", void 0, localize("source", "Source")),
          element
        )
      );
      if (isNative && extension.source === "resource" && extension.location.scheme === Schemas.file) {
        element.classList.add("link");
        element.title = extension.location.fsPath;
        this.disposables.add(onClick(element, () => this.openerService.open(extension.location, { openExternal: true })));
      }
    }
    if (extension.size) {
      const element = $("div", void 0, ByteSize.formatSize(extension.size));
      append(
        installInfo,
        $(
          ".more-info-entry",
          void 0,
          $("div.more-info-entry-name", { title: localize("size when installed", "Size when installed") }, localize("size", "Size")),
          element
        )
      );
      if (isNative && extension.location.scheme === Schemas.file) {
        element.classList.add("link");
        element.title = extension.location.fsPath;
        this.disposables.add(onClick(element, () => this.openerService.open(extension.location, { openExternal: true })));
      }
    }
    this.getCacheLocation(extension).then((cacheLocation) => {
      if (!cacheLocation) {
        return;
      }
      computeSize(cacheLocation, this.fileService).then((cacheSize) => {
        if (!cacheSize) {
          return;
        }
        const element = $("div", void 0, ByteSize.formatSize(cacheSize));
        append(
          installInfo,
          $(
            ".more-info-entry",
            void 0,
            $("div.more-info-entry-name", { title: localize("disk space used", "Cache size") }, localize("cache size", "Cache")),
            element
          )
        );
        if (isNative && extension.location.scheme === Schemas.file) {
          element.classList.add("link");
          element.title = cacheLocation.fsPath;
          this.disposables.add(onClick(element, () => this.openerService.open(cacheLocation.with({ scheme: Schemas.file }), { openExternal: true })));
        }
      });
    });
  }
  async getCacheLocation(extension) {
    let extensionCacheLocation = this.uriIdentityService.extUri.joinPath(this.userDataProfilesService.defaultProfile.globalStorageHome, extension.identifier.id.toLowerCase());
    if (extension.location.scheme === Schemas.vscodeRemote) {
      const environment = await this.remoteAgentService.getEnvironment();
      if (!environment) {
        return void 0;
      }
      extensionCacheLocation = this.uriIdentityService.extUri.joinPath(environment.globalStorageHome, extension.identifier.id.toLowerCase());
    }
    return extensionCacheLocation;
  }
  renderMarketplaceInfo(container, extension) {
    const gallery = extension.gallery;
    const moreInfoContainer = append(container, $(".more-info-container.additional-details-element"));
    append(moreInfoContainer, $(".additional-details-title", void 0, localize("Marketplace Info", "Marketplace")));
    const moreInfo = append(moreInfoContainer, $(".more-info"));
    if (gallery) {
      if (!extension.local) {
        append(
          moreInfo,
          $(
            ".more-info-entry",
            void 0,
            $("div.more-info-entry-name", void 0, localize("id", "Identifier")),
            $("code", void 0, extension.identifier.id)
          )
        );
        append(
          moreInfo,
          $(
            ".more-info-entry",
            void 0,
            $("div.more-info-entry-name", void 0, localize("Version", "Version")),
            $("code", void 0, gallery.version)
          )
        );
      }
      append(
        moreInfo,
        $(
          ".more-info-entry",
          void 0,
          $("div.more-info-entry-name", void 0, localize("published", "Published")),
          $("div", void 0, toDateString(new Date(gallery.releaseDate)))
        ),
        $(
          ".more-info-entry",
          void 0,
          $("div.more-info-entry-name", void 0, localize("last released", "Last Released")),
          $("div", void 0, toDateString(new Date(gallery.lastUpdated)))
        )
      );
    }
  }
};
AdditionalDetailsWidget = __decorateClass([
  __decorateParam(2, IHoverService),
  __decorateParam(3, IOpenerService),
  __decorateParam(4, IUserDataProfilesService),
  __decorateParam(5, IRemoteAgentService),
  __decorateParam(6, IFileService),
  __decorateParam(7, IUriIdentityService),
  __decorateParam(8, IExtensionsWorkbenchService),
  __decorateParam(9, IExtensionGalleryManifestService)
], AdditionalDetailsWidget);
const contextKeyExpr = ContextKeyExpr.and(ContextKeyExpr.equals("activeEditor", ExtensionEditor.ID), EditorContextKeys.focus.toNegated());
registerAction2(class ShowExtensionEditorFindAction extends Action2 {
  constructor() {
    super({
      id: "editor.action.extensioneditor.showfind",
      title: localize("find", "Find"),
      keybinding: {
        when: contextKeyExpr,
        weight: KeybindingWeight.EditorContrib,
        primary: KeyMod.CtrlCmd | KeyCode.KeyF
      }
    });
  }
  run(accessor) {
    const extensionEditor = getExtensionEditor(accessor);
    extensionEditor?.showFind();
  }
});
registerAction2(class StartExtensionEditorFindNextAction extends Action2 {
  constructor() {
    super({
      id: "editor.action.extensioneditor.findNext",
      title: localize("find next", "Find Next"),
      keybinding: {
        when: ContextKeyExpr.and(
          contextKeyExpr,
          KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED
        ),
        primary: KeyCode.Enter,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor) {
    const extensionEditor = getExtensionEditor(accessor);
    extensionEditor?.runFindAction(false);
  }
});
registerAction2(class StartExtensionEditorFindPreviousAction extends Action2 {
  constructor() {
    super({
      id: "editor.action.extensioneditor.findPrevious",
      title: localize("find previous", "Find Previous"),
      keybinding: {
        when: ContextKeyExpr.and(
          contextKeyExpr,
          KEYBINDING_CONTEXT_WEBVIEW_FIND_WIDGET_FOCUSED
        ),
        primary: KeyMod.Shift | KeyCode.Enter,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor) {
    const extensionEditor = getExtensionEditor(accessor);
    extensionEditor?.runFindAction(true);
  }
});
registerThemingParticipant((theme, collector) => {
  const link = theme.getColor(textLinkForeground);
  if (link) {
    collector.addRule(`.monaco-workbench .extension-editor .content .details .additional-details-container .resources-container a.resource { color: ${link}; }`);
    collector.addRule(`.monaco-workbench .extension-editor .content .feature-contributions a { color: ${link}; }`);
  }
  const activeLink = theme.getColor(textLinkActiveForeground);
  if (activeLink) {
    collector.addRule(`.monaco-workbench .extension-editor .content .details .additional-details-container .resources-container a.resource:hover,
			.monaco-workbench .extension-editor .content .details .additional-details-container .resources-container a.resource:active { color: ${activeLink}; }`);
    collector.addRule(`.monaco-workbench .extension-editor .content .feature-contributions a:hover,
			.monaco-workbench .extension-editor .content .feature-contributions a:active { color: ${activeLink}; }`);
  }
  const buttonHoverBackgroundColor = theme.getColor(buttonHoverBackground);
  if (buttonHoverBackgroundColor) {
    collector.addRule(`.monaco-workbench .extension-editor .content > .details > .additional-details-container .categories-container > .categories > .category.clickable:hover { background-color: ${buttonHoverBackgroundColor}; border-color: ${buttonHoverBackgroundColor}; }`);
  }
  const buttonForegroundColor = theme.getColor(buttonForeground);
  if (buttonForegroundColor) {
    collector.addRule(`.monaco-workbench .extension-editor .content > .details > .additional-details-container .categories-container > .categories > .category.clickable:hover { color: ${buttonForegroundColor}; }`);
  }
});
function getExtensionEditor(accessor) {
  const activeEditorPane = accessor.get(IEditorService).activeEditorPane;
  if (activeEditorPane instanceof ExtensionEditor) {
    return activeEditorPane;
  }
  return null;
}
export {
  ExtensionEditor
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2Jyb3dzZXIvZXh0ZW5zaW9uRWRpdG9yLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgJCwgRGltZW5zaW9uLCBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIGFwcGVuZCwgaGlkZSwgc2V0UGFyZW50Rmxvd1RvLCBzaG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBBY3Rpb25CYXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgeyBEb21TY3JvbGxhYmxlRWxlbWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zY3JvbGxiYXIvc2Nyb2xsYWJsZUVsZW1lbnQuanMnO1xuaW1wb3J0IHsgQ2hlY2tib3hBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90b2dnbGUvdG9nZ2xlLmpzJztcbmltcG9ydCB7IEFjdGlvbiwgSUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0ICogYXMgYXJyYXlzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBDYWNoZSwgQ2FjaGVSZXN1bHQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYWNoZS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgaXNDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgTXV0YWJsZURpc3Bvc2FibGUsIGRpc3Bvc2UsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzLCBtYXRjaGVzU2NoZW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBpc05hdGl2ZSwgbGFuZ3VhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBpc1VuZGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCAnLi9tZWRpYS9leHRlbnNpb25FZGl0b3IuY3NzJztcbmltcG9ydCB7IEVkaXRvckNvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBUb2tlbml6YXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVRva2Vuc0NTU0ZvckNvbG9yTWFwIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvc3VwcG9ydHMvdG9rZW5pemF0aW9uLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIsIElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UsIElTY29wZWRDb250ZXh0S2V5U2VydmljZSwgUmF3Q29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgY29tcHV0ZVNpemUsIEZpbHRlclR5cGUsIElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSwgSUdhbGxlcnlFeHRlbnNpb24sIElMb2NhbEV4dGVuc2lvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgYXJlU2FtZUV4dGVuc2lvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50VXRpbC5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25UeXBlLCBJRXh0ZW5zaW9uTWFuaWZlc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBkZWZhdWx0Q2hlY2tib3hTdHlsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9icm93c2VyL2RlZmF1bHRTdHlsZXMuanMnO1xuaW1wb3J0IHsgYnV0dG9uRm9yZWdyb3VuZCwgYnV0dG9uSG92ZXJCYWNrZ3JvdW5kLCBlZGl0b3JCYWNrZ3JvdW5kLCB0ZXh0TGlua0FjdGl2ZUZvcmVncm91bmQsIHRleHRMaW5rRm9yZWdyb3VuZCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElDb2xvclRoZW1lLCBJQ3NzU3R5bGVDb2xsZWN0b3IsIElUaGVtZVNlcnZpY2UsIHJlZ2lzdGVyVGhlbWluZ1BhcnRpY2lwYW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JQYW5lIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yUGFuZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yT3BlbkNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkZlYXR1cmVzVGFiIH0gZnJvbSAnLi9leHRlbnNpb25GZWF0dXJlc1RhYi5qcyc7XG5pbXBvcnQge1xuXHRCdXR0b25XaXRoRHJvcERvd25FeHRlbnNpb25BY3Rpb24sXG5cdENsZWFyTGFuZ3VhZ2VBY3Rpb24sXG5cdERpc2FibGVEcm9wRG93bkFjdGlvbixcblx0RW5hYmxlRHJvcERvd25BY3Rpb24sXG5cdEJ1dHRvbldpdGhEcm9wZG93bkV4dGVuc2lvbkFjdGlvblZpZXdJdGVtLCBEcm9wRG93bkV4dGVuc2lvbkFjdGlvbixcblx0RXh0ZW5zaW9uRWRpdG9yTWFuYWdlRXh0ZW5zaW9uQWN0aW9uLFxuXHRFeHRlbnNpb25TdGF0dXNBY3Rpb24sXG5cdEV4dGVuc2lvblN0YXR1c0xhYmVsQWN0aW9uLFxuXHRJbnN0YWxsQW5vdGhlclZlcnNpb25BY3Rpb24sXG5cdEluc3RhbGxEcm9wZG93bkFjdGlvbiwgSW5zdGFsbGluZ0xhYmVsQWN0aW9uLFxuXHRMb2NhbEluc3RhbGxBY3Rpb24sXG5cdE1pZ3JhdGVEZXByZWNhdGVkRXh0ZW5zaW9uQWN0aW9uLFxuXHRFeHRlbnNpb25SdW50aW1lU3RhdGVBY3Rpb24sXG5cdFJlbW90ZUluc3RhbGxBY3Rpb24sXG5cdFNldENvbG9yVGhlbWVBY3Rpb24sXG5cdFNldEZpbGVJY29uVGhlbWVBY3Rpb24sXG5cdFNldExhbmd1YWdlQWN0aW9uLFxuXHRTZXRQcm9kdWN0SWNvblRoZW1lQWN0aW9uLFxuXHRUb2dnbGVBdXRvVXBkYXRlRm9yRXh0ZW5zaW9uQWN0aW9uLFxuXHRVbmluc3RhbGxBY3Rpb24sXG5cdFVwZGF0ZUFjdGlvbixcblx0V2ViSW5zdGFsbEFjdGlvbixcblx0VG9nZ2xlUHJlUmVsZWFzZUV4dGVuc2lvbkFjdGlvbixcbn0gZnJvbSAnLi9leHRlbnNpb25zQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBEZWxlZ2F0ZSB9IGZyb20gJy4vZXh0ZW5zaW9uc0xpc3QuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uRGF0YSwgRXh0ZW5zaW9uc0dyaWRWaWV3LCBFeHRlbnNpb25zVHJlZSwgZ2V0RXh0ZW5zaW9ucyB9IGZyb20gJy4vZXh0ZW5zaW9uc1ZpZXdlci5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25SZWNvbW1lbmRhdGlvbldpZGdldCwgRXh0ZW5zaW9uU3RhdHVzV2lkZ2V0LCBFeHRlbnNpb25XaWRnZXQsIEluc3RhbGxDb3VudFdpZGdldCwgUmF0aW5nc1dpZGdldCwgUmVtb3RlQmFkZ2VXaWRnZXQsIFNwb25zb3JXaWRnZXQsIFB1Ymxpc2hlcldpZGdldCwgb25DbGljaywgRXh0ZW5zaW9uS2luZEluZGljYXRvcldpZGdldCB9IGZyb20gJy4vZXh0ZW5zaW9uc1dpZGdldHMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uQ29udGFpbmVycywgRXh0ZW5zaW9uRWRpdG9yVGFiLCBFeHRlbnNpb25TdGF0ZSwgSUV4dGVuc2lvbiwgSUV4dGVuc2lvbkNvbnRhaW5lciwgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uc0lucHV0LCBJRXh0ZW5zaW9uRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25zSW5wdXQuanMnO1xuaW1wb3J0IHsgREVGQVVMVF9NQVJLRE9XTl9TVFlMRVMsIHJlbmRlck1hcmtkb3duRG9jdW1lbnQgfSBmcm9tICcuLi8uLi9tYXJrZG93bi9icm93c2VyL21hcmtkb3duRG9jdW1lbnRSZW5kZXJlci5qcyc7XG5pbXBvcnQgeyBJV2VidmlldywgSVdlYnZpZXdTZXJ2aWNlLCBLRVlCSU5ESU5HX0NPTlRFWFRfV0VCVklFV19GSU5EX1dJREdFVF9GT0NVU0VEIH0gZnJvbSAnLi4vLi4vd2Vidmlldy9icm93c2VyL3dlYnZpZXcuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zL2NvbW1vbi9leHRlbnNpb25SZWNvbW1lbmRhdGlvbnMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgQnl0ZVNpemUsIElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlQWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QuanMnO1xuXG5mdW5jdGlvbiB0b0RhdGVTdHJpbmcoZGF0ZTogRGF0ZSkge1xuXHRyZXR1cm4gYCR7ZGF0ZS5nZXRGdWxsWWVhcigpfS0ke1N0cmluZyhkYXRlLmdldE1vbnRoKCkgKyAxKS5wYWRTdGFydCgyLCAnMCcpfS0ke1N0cmluZyhkYXRlLmdldERhdGUoKSkucGFkU3RhcnQoMiwgJzAnKX0sICR7ZGF0ZS50b0xvY2FsZVRpbWVTdHJpbmcobGFuZ3VhZ2UsIHsgaG91ckN5Y2xlOiAnaDIzJyB9KX1gO1xufVxuXG5jbGFzcyBOYXZCYXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIF9vbkNoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgaWQ6IHN0cmluZyB8IG51bGw7IGZvY3VzOiBib29sZWFuIH0+KCkpO1xuXHRnZXQgb25DaGFuZ2UoKTogRXZlbnQ8eyBpZDogc3RyaW5nIHwgbnVsbDsgZm9jdXM6IGJvb2xlYW4gfT4geyByZXR1cm4gdGhpcy5fb25DaGFuZ2UuZXZlbnQ7IH1cblxuXHRwcml2YXRlIF9jdXJyZW50SWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRnZXQgY3VycmVudElkKCk6IHN0cmluZyB8IG51bGwgeyByZXR1cm4gdGhpcy5fY3VycmVudElkOyB9XG5cblx0cHJpdmF0ZSBhY3Rpb25zOiBBY3Rpb25bXTtcblx0cHJpdmF0ZSBhY3Rpb25iYXI6IEFjdGlvbkJhcjtcblxuXHRjb25zdHJ1Y3Rvcihjb250YWluZXI6IEhUTUxFbGVtZW50KSB7XG5cdFx0c3VwZXIoKTtcblx0XHRjb25zdCBlbGVtZW50ID0gYXBwZW5kKGNvbnRhaW5lciwgJCgnLm5hdmJhcicpKTtcblx0XHR0aGlzLmFjdGlvbnMgPSBbXTtcblx0XHR0aGlzLmFjdGlvbmJhciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBBY3Rpb25CYXIoZWxlbWVudCkpO1xuXHR9XG5cblx0cHVzaChpZDogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCB0b29sdGlwOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBhY3Rpb24gPSBuZXcgQWN0aW9uKGlkLCBsYWJlbCwgdW5kZWZpbmVkLCB0cnVlLCAoKSA9PiB0aGlzLnVwZGF0ZShpZCwgdHJ1ZSkpO1xuXG5cdFx0YWN0aW9uLnRvb2x0aXAgPSB0b29sdGlwO1xuXG5cdFx0dGhpcy5hY3Rpb25zLnB1c2goYWN0aW9uKTtcblx0XHR0aGlzLmFjdGlvbmJhci5wdXNoKGFjdGlvbik7XG5cblx0XHRpZiAodGhpcy5hY3Rpb25zLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0dGhpcy51cGRhdGUoaWQpO1xuXHRcdH1cblx0fVxuXG5cdGNsZWFyKCk6IHZvaWQge1xuXHRcdHRoaXMuYWN0aW9ucyA9IGRpc3Bvc2UodGhpcy5hY3Rpb25zKTtcblx0XHR0aGlzLmFjdGlvbmJhci5jbGVhcigpO1xuXHR9XG5cblx0c3dpdGNoKGlkOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRjb25zdCBhY3Rpb24gPSB0aGlzLmFjdGlvbnMuZmluZChhY3Rpb24gPT4gYWN0aW9uLmlkID09PSBpZCk7XG5cdFx0aWYgKGFjdGlvbikge1xuXHRcdFx0YWN0aW9uLnJ1bigpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlKGlkOiBzdHJpbmcsIGZvY3VzPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX2N1cnJlbnRJZCA9IGlkO1xuXHRcdHRoaXMuX29uQ2hhbmdlLmZpcmUoeyBpZCwgZm9jdXM6ICEhZm9jdXMgfSk7XG5cdFx0dGhpcy5hY3Rpb25zLmZvckVhY2goYSA9PiBhLmNoZWNrZWQgPSBhLmlkID09PSBpZCk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElMYXlvdXRQYXJ0aWNpcGFudCB7XG5cdGxheW91dCgpOiB2b2lkO1xufVxuXG5pbnRlcmZhY2UgSUFjdGl2ZUVsZW1lbnQge1xuXHRmb2N1cygpOiB2b2lkO1xufVxuXG5pbnRlcmZhY2UgSUV4dGVuc2lvbkVkaXRvclRlbXBsYXRlIHtcblx0aWNvbkNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdGljb246IEhUTUxJbWFnZUVsZW1lbnQ7XG5cdG5hbWU6IEhUTUxFbGVtZW50O1xuXHRwcmV2aWV3OiBIVE1MRWxlbWVudDtcblx0YnVpbHRpbjogSFRNTEVsZW1lbnQ7XG5cdGRlc2NyaXB0aW9uOiBIVE1MRWxlbWVudDtcblx0YWN0aW9uc0FuZFN0YXR1c0NvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdGV4dGVuc2lvbkFjdGlvbkJhcjogQWN0aW9uQmFyO1xuXHRuYXZiYXI6IE5hdkJhcjtcblx0Y29udGVudDogSFRNTEVsZW1lbnQ7XG5cdGhlYWRlcjogSFRNTEVsZW1lbnQ7XG5cdGV4dGVuc2lvbjogSUV4dGVuc2lvbjtcblx0Z2FsbGVyeTogSUdhbGxlcnlFeHRlbnNpb24gfCBudWxsO1xuXHRtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0IHwgbnVsbDtcbn1cblxuY29uc3QgZW51bSBXZWJ2aWV3SW5kZXgge1xuXHRSZWFkbWUsXG5cdENoYW5nZWxvZ1xufVxuXG5jb25zdCBDT05URVhUX1NIT1dfUFJFX1JFTEVBU0VfVkVSU0lPTiA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdzaG93UHJlUmVsZWFzZVZlcnNpb24nLCBmYWxzZSk7XG5cbmFic3RyYWN0IGNsYXNzIEV4dGVuc2lvbldpdGhEaWZmZXJlbnRHYWxsZXJ5VmVyc2lvbldpZGdldCBleHRlbmRzIEV4dGVuc2lvbldpZGdldCB7XG5cdHByaXZhdGUgX2dhbGxlcnk6IElHYWxsZXJ5RXh0ZW5zaW9uIHwgbnVsbCA9IG51bGw7XG5cdGdldCBnYWxsZXJ5KCk6IElHYWxsZXJ5RXh0ZW5zaW9uIHwgbnVsbCB7IHJldHVybiB0aGlzLl9nYWxsZXJ5OyB9XG5cdHNldCBnYWxsZXJ5KGdhbGxlcnk6IElHYWxsZXJ5RXh0ZW5zaW9uIHwgbnVsbCkge1xuXHRcdGlmICh0aGlzLmV4dGVuc2lvbiAmJiBnYWxsZXJ5ICYmICFhcmVTYW1lRXh0ZW5zaW9ucyh0aGlzLmV4dGVuc2lvbi5pZGVudGlmaWVyLCBnYWxsZXJ5LmlkZW50aWZpZXIpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2dhbGxlcnkgPSBnYWxsZXJ5O1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cbn1cblxuY2xhc3MgVmVyc2lvbldpZGdldCBleHRlbmRzIEV4dGVuc2lvbldpdGhEaWZmZXJlbnRHYWxsZXJ5VmVyc2lvbldpZGdldCB7XG5cdHByaXZhdGUgcmVhZG9ubHkgZWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0aG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5lbGVtZW50ID0gYXBwZW5kKGNvbnRhaW5lciwgJCgnY29kZS52ZXJzaW9uJywgdW5kZWZpbmVkLCAncHJlLXJlbGVhc2UnKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCB0aGlzLmVsZW1lbnQsIGxvY2FsaXplKCdleHRlbnNpb24gdmVyc2lvbicsIFwiRXh0ZW5zaW9uIFZlcnNpb25cIikpKTtcblx0XHR0aGlzLnJlbmRlcigpO1xuXHR9XG5cdHJlbmRlcigpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5leHRlbnNpb24/LnByZVJlbGVhc2UpIHtcblx0XHRcdHNob3codGhpcy5lbGVtZW50KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0aGlkZSh0aGlzLmVsZW1lbnQpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRXh0ZW5zaW9uRWRpdG9yIGV4dGVuZHMgRWRpdG9yUGFuZSB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEOiBzdHJpbmcgPSAnd29ya2JlbmNoLmVkaXRvci5leHRlbnNpb24nO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Njb3BlZENvbnRleHRLZXlTZXJ2aWNlID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPElTY29wZWRDb250ZXh0S2V5U2VydmljZT4oKSk7XG5cdHByaXZhdGUgdGVtcGxhdGU6IElFeHRlbnNpb25FZGl0b3JUZW1wbGF0ZSB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIGV4dGVuc2lvblJlYWRtZTogQ2FjaGU8c3RyaW5nPiB8IG51bGw7XG5cdHByaXZhdGUgZXh0ZW5zaW9uQ2hhbmdlbG9nOiBDYWNoZTxzdHJpbmc+IHwgbnVsbDtcblx0cHJpdmF0ZSBleHRlbnNpb25NYW5pZmVzdDogQ2FjaGU8SUV4dGVuc2lvbk1hbmlmZXN0IHwgbnVsbD4gfCBudWxsO1xuXG5cdC8vIFNvbWUgYWN0aW9uIGJhciBpdGVtcyB1c2UgYSB3ZWJ2aWV3IHdob3NlIHZlcnRpY2FsIHNjcm9sbCBwb3NpdGlvbiB3ZSB0cmFjayBpbiB0aGlzIG1hcFxuXHRwcml2YXRlIGluaXRpYWxTY3JvbGxQcm9ncmVzczogTWFwPFdlYnZpZXdJbmRleCwgbnVtYmVyPiA9IG5ldyBNYXAoKTtcblxuXHQvLyBTcG90IHdoZW4gYW4gRXh0ZW5zaW9uRWRpdG9yIGluc3RhbmNlIGdldHMgcmV1c2VkIGZvciBhIGRpZmZlcmVudCBleHRlbnNpb24sIGluIHdoaWNoIGNhc2UgdGhlIHZlcnRpY2FsIHNjcm9sbCBwb3NpdGlvbnMgbXVzdCBiZSB6ZXJvZWRcblx0cHJpdmF0ZSBjdXJyZW50SWRlbnRpZmllcjogc3RyaW5nID0gJyc7XG5cblx0cHJpdmF0ZSBsYXlvdXRQYXJ0aWNpcGFudHM6IElMYXlvdXRQYXJ0aWNpcGFudFtdID0gW107XG5cdHByaXZhdGUgcmVhZG9ubHkgY29udGVudERpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSByZWFkb25seSB0cmFuc2llbnREaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdHByaXZhdGUgYWN0aXZlRWxlbWVudDogSUFjdGl2ZUVsZW1lbnQgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBkaW1lbnNpb246IERpbWVuc2lvbiB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHNob3dQcmVSZWxlYXNlVmVyc2lvbkNvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+IHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGdyb3VwOiBJRWRpdG9yR3JvdXAsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25HYWxsZXJ5U2VydmljZTogSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASUV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlOiBJRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElXZWJ2aWV3U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdlYnZpZXdTZXJ2aWNlOiBJV2Vidmlld1NlcnZpY2UsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKEV4dGVuc2lvbkVkaXRvci5JRCwgZ3JvdXAsIHRlbGVtZXRyeVNlcnZpY2UsIHRoZW1lU2VydmljZSwgc3RvcmFnZVNlcnZpY2UpO1xuXHRcdHRoaXMuZXh0ZW5zaW9uUmVhZG1lID0gbnVsbDtcblx0XHR0aGlzLmV4dGVuc2lvbkNoYW5nZWxvZyA9IG51bGw7XG5cdFx0dGhpcy5leHRlbnNpb25NYW5pZmVzdCA9IG51bGw7XG5cdH1cblxuXHRvdmVycmlkZSBnZXQgc2NvcGVkQ29udGV4dEtleVNlcnZpY2UoKTogSUNvbnRleHRLZXlTZXJ2aWNlIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fc2NvcGVkQ29udGV4dEtleVNlcnZpY2UudmFsdWU7XG5cdH1cblxuXHRwcm90ZWN0ZWQgY3JlYXRlRWRpdG9yKHBhcmVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRjb25zdCByb290ID0gYXBwZW5kKHBhcmVudCwgJCgnLmV4dGVuc2lvbi1lZGl0b3InKSk7XG5cdFx0dGhpcy5fc2NvcGVkQ29udGV4dEtleVNlcnZpY2UudmFsdWUgPSB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZVNjb3BlZChyb290KTtcblx0XHR0aGlzLl9zY29wZWRDb250ZXh0S2V5U2VydmljZS52YWx1ZS5jcmVhdGVLZXkoJ2luRXh0ZW5zaW9uRWRpdG9yJywgdHJ1ZSk7XG5cdFx0dGhpcy5zaG93UHJlUmVsZWFzZVZlcnNpb25Db250ZXh0S2V5ID0gQ09OVEVYVF9TSE9XX1BSRV9SRUxFQVNFX1ZFUlNJT04uYmluZFRvKHRoaXMuX3Njb3BlZENvbnRleHRLZXlTZXJ2aWNlLnZhbHVlKTtcblxuXHRcdHJvb3QudGFiSW5kZXggPSAwOyAvLyB0aGlzIGlzIHJlcXVpcmVkIGZvciB0aGUgZm9jdXMgdHJhY2tlciBvbiB0aGUgZWRpdG9yXG5cdFx0cm9vdC5zdHlsZS5vdXRsaW5lID0gJ25vbmUnO1xuXHRcdHJvb3Quc2V0QXR0cmlidXRlKCdyb2xlJywgJ2RvY3VtZW50Jyk7XG5cdFx0Y29uc3QgaGVhZGVyID0gYXBwZW5kKHJvb3QsICQoJy5oZWFkZXInKSk7XG5cblx0XHRjb25zdCBpY29uQ29udGFpbmVyID0gYXBwZW5kKGhlYWRlciwgJCgnLmljb24tY29udGFpbmVyJykpO1xuXHRcdGNvbnN0IGljb24gPSBhcHBlbmQoaWNvbkNvbnRhaW5lciwgJDxIVE1MSW1hZ2VFbGVtZW50PignaW1nLmljb24nLCB7IGRyYWdnYWJsZTogZmFsc2UsIGFsdDogJycgfSkpO1xuXHRcdGNvbnN0IHJlbW90ZUJhZGdlID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSZW1vdGVCYWRnZVdpZGdldCwgaWNvbkNvbnRhaW5lciwgdHJ1ZSk7XG5cblx0XHRjb25zdCBkZXRhaWxzID0gYXBwZW5kKGhlYWRlciwgJCgnLmRldGFpbHMnKSk7XG5cdFx0Y29uc3QgdGl0bGUgPSBhcHBlbmQoZGV0YWlscywgJCgnLnRpdGxlJykpO1xuXHRcdGNvbnN0IG5hbWUgPSBhcHBlbmQodGl0bGUsICQoJ3NwYW4ubmFtZS5jbGlja2FibGUnLCB7IHJvbGU6ICdoZWFkaW5nJywgdGFiSW5kZXg6IDAgfSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCBuYW1lLCBsb2NhbGl6ZSgnbmFtZScsIFwiRXh0ZW5zaW9uIG5hbWVcIikpKTtcblx0XHRjb25zdCB2ZXJzaW9uV2lkZ2V0ID0gbmV3IFZlcnNpb25XaWRnZXQodGl0bGUsIHRoaXMuaG92ZXJTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHByZXZpZXcgPSBhcHBlbmQodGl0bGUsICQoJ3NwYW4ucHJldmlldycpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgcHJldmlldywgbG9jYWxpemUoJ3ByZXZpZXcnLCBcIlByZXZpZXdcIikpKTtcblx0XHRwcmV2aWV3LnRleHRDb250ZW50ID0gbG9jYWxpemUoJ3ByZXZpZXcnLCBcIlByZXZpZXdcIik7XG5cblx0XHRjb25zdCBidWlsdGluID0gYXBwZW5kKHRpdGxlLCAkKCdzcGFuLmJ1aWx0aW4nKSk7XG5cdFx0YnVpbHRpbi50ZXh0Q29udGVudCA9IGxvY2FsaXplKCdidWlsdGluJywgXCJCdWlsdC1pblwiKTtcblxuXHRcdGNvbnN0IHN1YnRpdGxlID0gYXBwZW5kKGRldGFpbHMsICQoJy5zdWJ0aXRsZScpKTtcblx0XHRjb25zdCBzdWJUaXRsZUVudHJ5Q29udGFpbmVyczogSFRNTEVsZW1lbnRbXSA9IFtdO1xuXG5cdFx0Y29uc3QgcHVibGlzaGVyQ29udGFpbmVyID0gYXBwZW5kKHN1YnRpdGxlLCAkKCcuc3VidGl0bGUtZW50cnknKSk7XG5cdFx0c3ViVGl0bGVFbnRyeUNvbnRhaW5lcnMucHVzaChwdWJsaXNoZXJDb250YWluZXIpO1xuXHRcdGNvbnN0IHB1Ymxpc2hlcldpZGdldCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUHVibGlzaGVyV2lkZ2V0LCBwdWJsaXNoZXJDb250YWluZXIsIGZhbHNlKTtcblxuXHRcdGNvbnN0IGV4dGVuc2lvbktpbmRDb250YWluZXIgPSBhcHBlbmQoc3VidGl0bGUsICQoJy5zdWJ0aXRsZS1lbnRyeScpKTtcblx0XHRzdWJUaXRsZUVudHJ5Q29udGFpbmVycy5wdXNoKGV4dGVuc2lvbktpbmRDb250YWluZXIpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbktpbmRXaWRnZXQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvbktpbmRJbmRpY2F0b3JXaWRnZXQsIGV4dGVuc2lvbktpbmRDb250YWluZXIsIGZhbHNlKTtcblxuXHRcdGNvbnN0IGluc3RhbGxDb3VudENvbnRhaW5lciA9IGFwcGVuZChzdWJ0aXRsZSwgJCgnLnN1YnRpdGxlLWVudHJ5JykpO1xuXHRcdHN1YlRpdGxlRW50cnlDb250YWluZXJzLnB1c2goaW5zdGFsbENvdW50Q29udGFpbmVyKTtcblx0XHRjb25zdCBpbnN0YWxsQ291bnRXaWRnZXQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEluc3RhbGxDb3VudFdpZGdldCwgaW5zdGFsbENvdW50Q29udGFpbmVyLCBmYWxzZSk7XG5cblx0XHRjb25zdCByYXRpbmdzQ29udGFpbmVyID0gYXBwZW5kKHN1YnRpdGxlLCAkKCcuc3VidGl0bGUtZW50cnknKSk7XG5cdFx0c3ViVGl0bGVFbnRyeUNvbnRhaW5lcnMucHVzaChyYXRpbmdzQ29udGFpbmVyKTtcblx0XHRjb25zdCByYXRpbmdzV2lkZ2V0ID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShSYXRpbmdzV2lkZ2V0LCByYXRpbmdzQ29udGFpbmVyLCBmYWxzZSk7XG5cblx0XHRjb25zdCBzcG9uc29yQ29udGFpbmVyID0gYXBwZW5kKHN1YnRpdGxlLCAkKCcuc3VidGl0bGUtZW50cnknKSk7XG5cdFx0c3ViVGl0bGVFbnRyeUNvbnRhaW5lcnMucHVzaChzcG9uc29yQ29udGFpbmVyKTtcblx0XHRjb25zdCBzcG9uc29yV2lkZ2V0ID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTcG9uc29yV2lkZ2V0LCBzcG9uc29yQ29udGFpbmVyKTtcblxuXHRcdGNvbnN0IHdpZGdldHM6IEV4dGVuc2lvbldpZGdldFtdID0gW1xuXHRcdFx0cmVtb3RlQmFkZ2UsXG5cdFx0XHR2ZXJzaW9uV2lkZ2V0LFxuXHRcdFx0cHVibGlzaGVyV2lkZ2V0LFxuXHRcdFx0ZXh0ZW5zaW9uS2luZFdpZGdldCxcblx0XHRcdGluc3RhbGxDb3VudFdpZGdldCxcblx0XHRcdHJhdGluZ3NXaWRnZXQsXG5cdFx0XHRzcG9uc29yV2lkZ2V0LFxuXHRcdF07XG5cblx0XHRjb25zdCBkZXNjcmlwdGlvbiA9IGFwcGVuZChkZXRhaWxzLCAkKCcuZGVzY3JpcHRpb24nKSk7XG5cblx0XHRjb25zdCBpbnN0YWxsQWN0aW9uID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbnN0YWxsRHJvcGRvd25BY3Rpb24pO1xuXHRcdGNvbnN0IGFjdGlvbnMgPSBbXG5cdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvblJ1bnRpbWVTdGF0ZUFjdGlvbiksXG5cdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvblN0YXR1c0xhYmVsQWN0aW9uKSxcblx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVXBkYXRlQWN0aW9uLCB0cnVlKSxcblx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0Q29sb3JUaGVtZUFjdGlvbiksXG5cdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNldEZpbGVJY29uVGhlbWVBY3Rpb24pLFxuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZXRQcm9kdWN0SWNvblRoZW1lQWN0aW9uKSxcblx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0TGFuZ3VhZ2VBY3Rpb24pLFxuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDbGVhckxhbmd1YWdlQWN0aW9uKSxcblxuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFbmFibGVEcm9wRG93bkFjdGlvbiksXG5cdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERpc2FibGVEcm9wRG93bkFjdGlvbiksXG5cdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlbW90ZUluc3RhbGxBY3Rpb24sIGZhbHNlKSxcblx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTG9jYWxJbnN0YWxsQWN0aW9uKSxcblx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV2ViSW5zdGFsbEFjdGlvbiksXG5cdFx0XHRpbnN0YWxsQWN0aW9uLFxuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbnN0YWxsaW5nTGFiZWxBY3Rpb24pLFxuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShCdXR0b25XaXRoRHJvcERvd25FeHRlbnNpb25BY3Rpb24sICdleHRlbnNpb25zLnVuaW5zdGFsbCcsIFVuaW5zdGFsbEFjdGlvbi5Vbmluc3RhbGxDbGFzcywgW1xuXHRcdFx0XHRbXG5cdFx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNaWdyYXRlRGVwcmVjYXRlZEV4dGVuc2lvbkFjdGlvbiwgZmFsc2UpLFxuXHRcdFx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVW5pbnN0YWxsQWN0aW9uKSxcblx0XHRcdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEluc3RhbGxBbm90aGVyVmVyc2lvbkFjdGlvbiwgbnVsbCwgdHJ1ZSksXG5cdFx0XHRcdF1cblx0XHRcdF0pLFxuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUb2dnbGVQcmVSZWxlYXNlRXh0ZW5zaW9uQWN0aW9uKSxcblx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVG9nZ2xlQXV0b1VwZGF0ZUZvckV4dGVuc2lvbkFjdGlvbiksXG5cdFx0XHRuZXcgRXh0ZW5zaW9uRWRpdG9yTWFuYWdlRXh0ZW5zaW9uQWN0aW9uKHRoaXMuc2NvcGVkQ29udGV4dEtleVNlcnZpY2UgfHwgdGhpcy5jb250ZXh0S2V5U2VydmljZSwgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdGlvbnNBbmRTdGF0dXNDb250YWluZXIgPSBhcHBlbmQoZGV0YWlscywgJCgnLmFjdGlvbnMtc3RhdHVzLWNvbnRhaW5lcicpKTtcblx0XHRjb25zdCBleHRlbnNpb25BY3Rpb25CYXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgQWN0aW9uQmFyKGFjdGlvbnNBbmRTdGF0dXNDb250YWluZXIsIHtcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb246IElBY3Rpb24sIG9wdGlvbnMpID0+IHtcblx0XHRcdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIERyb3BEb3duRXh0ZW5zaW9uQWN0aW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGFjdGlvbi5jcmVhdGVBY3Rpb25WaWV3SXRlbShvcHRpb25zKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoYWN0aW9uIGluc3RhbmNlb2YgQnV0dG9uV2l0aERyb3BEb3duRXh0ZW5zaW9uQWN0aW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBCdXR0b25XaXRoRHJvcGRvd25FeHRlbnNpb25BY3Rpb25WaWV3SXRlbShcblx0XHRcdFx0XHRcdGFjdGlvbixcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0Li4ub3B0aW9ucyxcblx0XHRcdFx0XHRcdFx0aWNvbjogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0bGFiZWw6IHRydWUsXG5cdFx0XHRcdFx0XHRcdG1lbnVBY3Rpb25zT3JQcm92aWRlcjogeyBnZXRBY3Rpb25zOiAoKSA9PiBhY3Rpb24ubWVudUFjdGlvbnMgfSxcblx0XHRcdFx0XHRcdFx0bWVudUFjdGlvbkNsYXNzTmFtZXM6IGFjdGlvbi5tZW51QWN0aW9uQ2xhc3NOYW1lc1xuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoYWN0aW9uIGluc3RhbmNlb2YgVG9nZ2xlQXV0b1VwZGF0ZUZvckV4dGVuc2lvbkFjdGlvbikge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgQ2hlY2tib3hBY3Rpb25WaWV3SXRlbSh1bmRlZmluZWQsIGFjdGlvbiwgeyAuLi5vcHRpb25zLCBpY29uOiB0cnVlLCBsYWJlbDogdHJ1ZSwgY2hlY2tib3hTdHlsZXM6IGRlZmF1bHRDaGVja2JveFN0eWxlcyB9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSxcblx0XHRcdGZvY3VzT25seUVuYWJsZWRJdGVtczogdHJ1ZVxuXHRcdH0pKTtcblxuXHRcdGV4dGVuc2lvbkFjdGlvbkJhci5wdXNoKGFjdGlvbnMsIHsgaWNvbjogdHJ1ZSwgbGFiZWw6IHRydWUgfSk7XG5cdFx0ZXh0ZW5zaW9uQWN0aW9uQmFyLnNldEZvY3VzYWJsZSh0cnVlKTtcblx0XHQvLyB1cGRhdGUgZm9jdXNhYmxlIGVsZW1lbnRzIHdoZW4gdGhlIGVuYWJsZW1lbnQgb2YgYW4gYWN0aW9uIGNoYW5nZXNcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5hbnkoLi4uYWN0aW9ucy5tYXAoYSA9PiBFdmVudC5maWx0ZXIoYS5vbkRpZENoYW5nZSwgZSA9PiBlLmVuYWJsZWQgIT09IHVuZGVmaW5lZCkpKSgoKSA9PiB7XG5cdFx0XHRleHRlbnNpb25BY3Rpb25CYXIuc2V0Rm9jdXNhYmxlKGZhbHNlKTtcblx0XHRcdGV4dGVuc2lvbkFjdGlvbkJhci5zZXRGb2N1c2FibGUodHJ1ZSk7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3Qgb3RoZXJFeHRlbnNpb25Db250YWluZXJzOiBJRXh0ZW5zaW9uQ29udGFpbmVyW10gPSBbXTtcblx0XHRjb25zdCBleHRlbnNpb25TdGF0dXNBY3Rpb24gPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvblN0YXR1c0FjdGlvbik7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uU3RhdHVzV2lkZ2V0ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHRlbnNpb25TdGF0dXNXaWRnZXQsIGFwcGVuZChhY3Rpb25zQW5kU3RhdHVzQ29udGFpbmVyLCAkKCcuc3RhdHVzJykpLCBleHRlbnNpb25TdGF0dXNBY3Rpb24pKTtcblxuXHRcdG90aGVyRXh0ZW5zaW9uQ29udGFpbmVycy5wdXNoKGV4dGVuc2lvblN0YXR1c0FjdGlvbiwgbmV3IGNsYXNzIGV4dGVuZHMgRXh0ZW5zaW9uV2lkZ2V0IHtcblx0XHRcdHJlbmRlcigpIHtcblx0XHRcdFx0YWN0aW9uc0FuZFN0YXR1c0NvbnRhaW5lci5jbGFzc0xpc3QudG9nZ2xlKCdsaXN0LWxheW91dCcsIHRoaXMuZXh0ZW5zaW9uPy5zdGF0ZSA9PT0gRXh0ZW5zaW9uU3RhdGUuSW5zdGFsbGVkKTtcblx0XHRcdH1cblx0XHR9KCkpO1xuXG5cdFx0Y29uc3QgcmVjb21tZW5kYXRpb25XaWRnZXQgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvblJlY29tbWVuZGF0aW9uV2lkZ2V0LCBhcHBlbmQoZGV0YWlscywgJCgnLnJlY29tbWVuZGF0aW9uJykpKTtcblx0XHR3aWRnZXRzLnB1c2gocmVjb21tZW5kYXRpb25XaWRnZXQpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuYW55KGV4dGVuc2lvblN0YXR1c1dpZGdldC5vbkRpZFJlbmRlciwgcmVjb21tZW5kYXRpb25XaWRnZXQub25EaWRSZW5kZXIpKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLmRpbWVuc2lvbikge1xuXHRcdFx0XHR0aGlzLmxheW91dCh0aGlzLmRpbWVuc2lvbik7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgZXh0ZW5zaW9uQ29udGFpbmVyczogRXh0ZW5zaW9uQ29udGFpbmVycyA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXh0ZW5zaW9uQ29udGFpbmVycywgWy4uLmFjdGlvbnMsIC4uLndpZGdldHMsIC4uLm90aGVyRXh0ZW5zaW9uQ29udGFpbmVyc10pO1xuXHRcdGZvciAoY29uc3QgZGlzcG9zYWJsZSBvZiBbLi4uYWN0aW9ucywgLi4ud2lkZ2V0cywgLi4ub3RoZXJFeHRlbnNpb25Db250YWluZXJzLCBleHRlbnNpb25Db250YWluZXJzXSkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoZGlzcG9zYWJsZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb25FcnJvciA9IEV2ZW50LmNoYWluKGV4dGVuc2lvbkFjdGlvbkJhci5vbkRpZFJ1biwgJCA9PlxuXHRcdFx0JC5tYXAoKHsgZXJyb3IgfSkgPT4gZXJyb3IpXG5cdFx0XHRcdC5maWx0ZXIoZXJyb3IgPT4gISFlcnJvcilcblx0XHQpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIob25FcnJvcih0aGlzLm9uRXJyb3IsIHRoaXMpKTtcblxuXHRcdGNvbnN0IGJvZHkgPSBhcHBlbmQocm9vdCwgJCgnLmJvZHknKSk7XG5cdFx0Y29uc3QgbmF2YmFyID0gbmV3IE5hdkJhcihib2R5KTtcblxuXHRcdGNvbnN0IGNvbnRlbnQgPSBhcHBlbmQoYm9keSwgJCgnLmNvbnRlbnQnKSk7XG5cdFx0Y29udGVudC5pZCA9IGdlbmVyYXRlVXVpZCgpOyAvLyBBbiBpZCBpcyBuZWVkZWQgZm9yIHRoZSB3ZWJ2aWV3IHBhcmVudCBmbG93IHRvXG5cblx0XHR0aGlzLnRlbXBsYXRlID0ge1xuXHRcdFx0YnVpbHRpbixcblx0XHRcdGNvbnRlbnQsXG5cdFx0XHRkZXNjcmlwdGlvbixcblx0XHRcdGhlYWRlcixcblx0XHRcdGljb24sXG5cdFx0XHRpY29uQ29udGFpbmVyLFxuXHRcdFx0bmFtZSxcblx0XHRcdG5hdmJhcixcblx0XHRcdHByZXZpZXcsXG5cdFx0XHRhY3Rpb25zQW5kU3RhdHVzQ29udGFpbmVyLFxuXHRcdFx0ZXh0ZW5zaW9uQWN0aW9uQmFyLFxuXHRcdFx0c2V0IGV4dGVuc2lvbihleHRlbnNpb246IElFeHRlbnNpb24pIHtcblx0XHRcdFx0ZXh0ZW5zaW9uQ29udGFpbmVycy5leHRlbnNpb24gPSBleHRlbnNpb247XG5cdFx0XHRcdGxldCBsYXN0Tm9uRW1wdHlTdWJ0aXRsZUVudHJ5Q29udGFpbmVyO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHN1YlRpdGxlRW50cnlFbGVtZW50IG9mIHN1YlRpdGxlRW50cnlDb250YWluZXJzKSB7XG5cdFx0XHRcdFx0c3ViVGl0bGVFbnRyeUVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnbGFzdC1ub24tZW1wdHknKTtcblx0XHRcdFx0XHRpZiAoc3ViVGl0bGVFbnRyeUVsZW1lbnQuY2hpbGRyZW4ubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdFx0bGFzdE5vbkVtcHR5U3VidGl0bGVFbnRyeUNvbnRhaW5lciA9IHN1YlRpdGxlRW50cnlFbGVtZW50O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAobGFzdE5vbkVtcHR5U3VidGl0bGVFbnRyeUNvbnRhaW5lcikge1xuXHRcdFx0XHRcdGxhc3ROb25FbXB0eVN1YnRpdGxlRW50cnlDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnbGFzdC1ub24tZW1wdHknKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHNldCBnYWxsZXJ5KGdhbGxlcnk6IElHYWxsZXJ5RXh0ZW5zaW9uIHwgbnVsbCkge1xuXHRcdFx0XHR2ZXJzaW9uV2lkZ2V0LmdhbGxlcnkgPSBnYWxsZXJ5O1xuXHRcdFx0fSxcblx0XHRcdHNldCBtYW5pZmVzdChtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0IHwgbnVsbCkge1xuXHRcdFx0XHRpbnN0YWxsQWN0aW9uLm1hbmlmZXN0ID0gbWFuaWZlc3Q7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHNldElucHV0KGlucHV0OiBFeHRlbnNpb25zSW5wdXQsIG9wdGlvbnM6IElFeHRlbnNpb25FZGl0b3JPcHRpb25zIHwgdW5kZWZpbmVkLCBjb250ZXh0OiBJRWRpdG9yT3BlbkNvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHN1cGVyLnNldElucHV0KGlucHV0LCBvcHRpb25zLCBjb250ZXh0LCB0b2tlbik7XG5cdFx0dGhpcy51cGRhdGVQcmVSZWxlYXNlVmVyc2lvbkNvbnRleHQoKTtcblx0XHRpZiAodGhpcy50ZW1wbGF0ZSkge1xuXHRcdFx0YXdhaXQgdGhpcy5yZW5kZXIoaW5wdXQuZXh0ZW5zaW9uLCB0aGlzLnRlbXBsYXRlLCAhIW9wdGlvbnM/LnByZXNlcnZlRm9jdXMpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIHNldE9wdGlvbnMob3B0aW9uczogSUV4dGVuc2lvbkVkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCBjdXJyZW50T3B0aW9uczogSUV4dGVuc2lvbkVkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQgPSB0aGlzLm9wdGlvbnM7XG5cdFx0c3VwZXIuc2V0T3B0aW9ucyhvcHRpb25zKTtcblx0XHR0aGlzLnVwZGF0ZVByZVJlbGVhc2VWZXJzaW9uQ29udGV4dCgpO1xuXG5cdFx0aWYgKHRoaXMuaW5wdXQgJiYgdGhpcy50ZW1wbGF0ZSAmJiBjdXJyZW50T3B0aW9ucz8uc2hvd1ByZVJlbGVhc2VWZXJzaW9uICE9PSBvcHRpb25zPy5zaG93UHJlUmVsZWFzZVZlcnNpb24pIHtcblx0XHRcdHRoaXMucmVuZGVyKCh0aGlzLmlucHV0IGFzIEV4dGVuc2lvbnNJbnB1dCkuZXh0ZW5zaW9uLCB0aGlzLnRlbXBsYXRlLCAhIW9wdGlvbnM/LnByZXNlcnZlRm9jdXMpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zPy50YWIpIHtcblx0XHRcdHRoaXMudGVtcGxhdGU/Lm5hdmJhci5zd2l0Y2gob3B0aW9ucy50YWIpO1xuXHRcdH1cblxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVQcmVSZWxlYXNlVmVyc2lvbkNvbnRleHQoKTogdm9pZCB7XG5cdFx0bGV0IHNob3dQcmVSZWxlYXNlVmVyc2lvbiA9ICg8SUV4dGVuc2lvbkVkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQ+dGhpcy5vcHRpb25zKT8uc2hvd1ByZVJlbGVhc2VWZXJzaW9uO1xuXHRcdGlmIChpc1VuZGVmaW5lZChzaG93UHJlUmVsZWFzZVZlcnNpb24pKSB7XG5cdFx0XHRzaG93UHJlUmVsZWFzZVZlcnNpb24gPSAhISg8RXh0ZW5zaW9uc0lucHV0PnRoaXMuaW5wdXQpLmV4dGVuc2lvbi5nYWxsZXJ5Py5wcm9wZXJ0aWVzLmlzUHJlUmVsZWFzZVZlcnNpb247XG5cdFx0fVxuXHRcdHRoaXMuc2hvd1ByZVJlbGVhc2VWZXJzaW9uQ29udGV4dEtleT8uc2V0KHNob3dQcmVSZWxlYXNlVmVyc2lvbik7XG5cdH1cblxuXHRhc3luYyBvcGVuVGFiKHRhYjogRXh0ZW5zaW9uRWRpdG9yVGFiKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLmlucHV0IHx8ICF0aGlzLnRlbXBsYXRlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLnRlbXBsYXRlLm5hdmJhci5zd2l0Y2godGFiKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHQvLyBGYWxsYmFjayB0byBSZWFkbWUgdGFiIGlmIEV4dGVuc2lvblBhY2sgdGFiIGRvZXMgbm90IGV4aXN0XG5cdFx0aWYgKHRhYiA9PT0gRXh0ZW5zaW9uRWRpdG9yVGFiLkV4dGVuc2lvblBhY2spIHtcblx0XHRcdHRoaXMudGVtcGxhdGUubmF2YmFyLnN3aXRjaChFeHRlbnNpb25FZGl0b3JUYWIuUmVhZG1lKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldEdhbGxlcnlWZXJzaW9uVG9TaG93KGV4dGVuc2lvbjogSUV4dGVuc2lvbiwgcHJlUmVsZWFzZT86IGJvb2xlYW4pOiBQcm9taXNlPElHYWxsZXJ5RXh0ZW5zaW9uIHwgbnVsbD4ge1xuXHRcdGlmIChleHRlbnNpb24ucmVzb3VyY2VFeHRlbnNpb24pIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRpZiAoZXh0ZW5zaW9uLmxvY2FsPy5zb3VyY2UgPT09ICdyZXNvdXJjZScpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRpZiAoaXNVbmRlZmluZWQocHJlUmVsZWFzZSkpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRpZiAocHJlUmVsZWFzZSA9PT0gZXh0ZW5zaW9uLmdhbGxlcnk/LnByb3BlcnRpZXMuaXNQcmVSZWxlYXNlVmVyc2lvbikge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGlmIChwcmVSZWxlYXNlICYmICFleHRlbnNpb24uaGFzUHJlUmVsZWFzZVZlcnNpb24pIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRpZiAoIXByZVJlbGVhc2UgJiYgIWV4dGVuc2lvbi5oYXNSZWxlYXNlVmVyc2lvbikge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiAoYXdhaXQgdGhpcy5leHRlbnNpb25HYWxsZXJ5U2VydmljZS5nZXRFeHRlbnNpb25zKFt7IC4uLmV4dGVuc2lvbi5pZGVudGlmaWVyLCBwcmVSZWxlYXNlLCBoYXNQcmVSZWxlYXNlOiBleHRlbnNpb24uaGFzUHJlUmVsZWFzZVZlcnNpb24gfV0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKVswXSB8fCBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZW5kZXIoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uLCB0ZW1wbGF0ZTogSUV4dGVuc2lvbkVkaXRvclRlbXBsYXRlLCBwcmVzZXJ2ZUZvY3VzOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5hY3RpdmVFbGVtZW50ID0gbnVsbDtcblx0XHR0aGlzLnRyYW5zaWVudERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHRjb25zdCB0b2tlbiA9IHRoaXMudHJhbnNpZW50RGlzcG9zYWJsZXMuYWRkKG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpKS50b2tlbjtcblxuXHRcdGNvbnN0IGdhbGxlcnkgPSBhd2FpdCB0aGlzLmdldEdhbGxlcnlWZXJzaW9uVG9TaG93KGV4dGVuc2lvbiwgKHRoaXMub3B0aW9ucyBhcyBJRXh0ZW5zaW9uRWRpdG9yT3B0aW9ucyk/LnNob3dQcmVSZWxlYXNlVmVyc2lvbik7XG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5leHRlbnNpb25SZWFkbWUgPSBuZXcgQ2FjaGUoKCkgPT4gZ2FsbGVyeSA/IHRoaXMuZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UuZ2V0UmVhZG1lKGdhbGxlcnksIHRva2VuKSA6IGV4dGVuc2lvbi5nZXRSZWFkbWUodG9rZW4pKTtcblx0XHR0aGlzLmV4dGVuc2lvbkNoYW5nZWxvZyA9IG5ldyBDYWNoZSgoKSA9PiBnYWxsZXJ5ID8gdGhpcy5leHRlbnNpb25HYWxsZXJ5U2VydmljZS5nZXRDaGFuZ2Vsb2coZ2FsbGVyeSwgdG9rZW4pIDogZXh0ZW5zaW9uLmdldENoYW5nZWxvZyh0b2tlbikpO1xuXHRcdHRoaXMuZXh0ZW5zaW9uTWFuaWZlc3QgPSBuZXcgQ2FjaGUoKCkgPT4gZ2FsbGVyeSA/IHRoaXMuZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UuZ2V0TWFuaWZlc3QoZ2FsbGVyeSwgdG9rZW4pIDogZXh0ZW5zaW9uLmdldE1hbmlmZXN0KHRva2VuKSk7XG5cblx0XHR0ZW1wbGF0ZS5leHRlbnNpb24gPSBleHRlbnNpb247XG5cdFx0dGVtcGxhdGUuZ2FsbGVyeSA9IGdhbGxlcnk7XG5cdFx0dGVtcGxhdGUubWFuaWZlc3QgPSBudWxsO1xuXG5cdFx0dGhpcy50cmFuc2llbnREaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRlbXBsYXRlLmljb24sICdlcnJvcicsICgpID0+IHRlbXBsYXRlLmljb24uc3JjID0gZXh0ZW5zaW9uLmljb25VcmxGYWxsYmFjaywgeyBvbmNlOiB0cnVlIH0pKTtcblx0XHR0ZW1wbGF0ZS5pY29uLnNyYyA9IGV4dGVuc2lvbi5pY29uVXJsO1xuXG5cdFx0dGVtcGxhdGUubmFtZS50ZXh0Q29udGVudCA9IGV4dGVuc2lvbi5kaXNwbGF5TmFtZTtcblx0XHR0ZW1wbGF0ZS5uYW1lLmNsYXNzTGlzdC50b2dnbGUoJ2NsaWNrYWJsZScsICEhZXh0ZW5zaW9uLnVybCk7XG5cdFx0dGVtcGxhdGUubmFtZS5jbGFzc0xpc3QudG9nZ2xlKCdkZXByZWNhdGVkJywgISFleHRlbnNpb24uZGVwcmVjYXRpb25JbmZvKTtcblx0XHR0ZW1wbGF0ZS5wcmV2aWV3LnN0eWxlLmRpc3BsYXkgPSBleHRlbnNpb24ucHJldmlldyA/ICdpbmhlcml0JyA6ICdub25lJztcblx0XHR0ZW1wbGF0ZS5idWlsdGluLnN0eWxlLmRpc3BsYXkgPSBleHRlbnNpb24uaXNCdWlsdGluID8gJ2luaGVyaXQnIDogJ25vbmUnO1xuXG5cdFx0dGVtcGxhdGUuZGVzY3JpcHRpb24udGV4dENvbnRlbnQgPSBleHRlbnNpb24uZGVzY3JpcHRpb247XG5cblx0XHRpZiAoZXh0ZW5zaW9uLnVybCkge1xuXHRcdFx0dGhpcy50cmFuc2llbnREaXNwb3NhYmxlcy5hZGQob25DbGljayh0ZW1wbGF0ZS5uYW1lLCAoKSA9PiB0aGlzLm9wZW5lclNlcnZpY2Uub3BlbihVUkkucGFyc2UoZXh0ZW5zaW9uLnVybCEpKSkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1hbmlmZXN0ID0gYXdhaXQgdGhpcy5leHRlbnNpb25NYW5pZmVzdC5nZXQoKS5wcm9taXNlO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChtYW5pZmVzdCkge1xuXHRcdFx0dGVtcGxhdGUubWFuaWZlc3QgPSBtYW5pZmVzdDtcblx0XHR9XG5cblx0XHR0aGlzLnJlbmRlck5hdmJhcihleHRlbnNpb24sIG1hbmlmZXN0LCB0ZW1wbGF0ZSwgcHJlc2VydmVGb2N1cyk7XG5cblx0XHQvLyByZXBvcnQgdGVsZW1ldHJ5XG5cdFx0Y29uc3QgZXh0UmVjb21tZW5kYXRpb25zID0gdGhpcy5leHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLmdldEFsbFJlY29tbWVuZGF0aW9uc1dpdGhSZWFzb24oKTtcblx0XHRsZXQgcmVjb21tZW5kYXRpb25zRGF0YSA9IHt9O1xuXHRcdGlmIChleHRSZWNvbW1lbmRhdGlvbnNbZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKV0pIHtcblx0XHRcdHJlY29tbWVuZGF0aW9uc0RhdGEgPSB7IHJlY29tbWVuZGF0aW9uUmVhc29uOiBleHRSZWNvbW1lbmRhdGlvbnNbZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKV0ucmVhc29uSWQgfTtcblx0XHR9XG5cdFx0LyogX19HRFBSX19cblx0XHRcImV4dGVuc2lvbkdhbGxlcnk6b3BlbkV4dGVuc2lvblwiIDoge1xuXHRcdFx0XCJvd25lclwiOiBcInNhbmR5MDgxXCIsXG5cdFx0XHRcInJlY29tbWVuZGF0aW9uUmVhc29uXCI6IHsgXCJjbGFzc2lmaWNhdGlvblwiOiBcIlN5c3RlbU1ldGFEYXRhXCIsIFwicHVycG9zZVwiOiBcIkZlYXR1cmVJbnNpZ2h0XCIsIFwiaXNNZWFzdXJlbWVudFwiOiB0cnVlIH0sXG5cdFx0XHRcIiR7aW5jbHVkZX1cIjogW1xuXHRcdFx0XHRcIiR7R2FsbGVyeUV4dGVuc2lvblRlbGVtZXRyeURhdGF9XCJcblx0XHRcdF1cblx0XHR9XG5cdFx0Ki9cblx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nKCdleHRlbnNpb25HYWxsZXJ5Om9wZW5FeHRlbnNpb24nLCB7IC4uLmV4dGVuc2lvbi50ZWxlbWV0cnlEYXRhLCAuLi5yZWNvbW1lbmRhdGlvbnNEYXRhIH0pO1xuXG5cdH1cblxuXHRwcml2YXRlIHJlbmRlck5hdmJhcihleHRlbnNpb246IElFeHRlbnNpb24sIG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QgfCBudWxsLCB0ZW1wbGF0ZTogSUV4dGVuc2lvbkVkaXRvclRlbXBsYXRlLCBwcmVzZXJ2ZUZvY3VzOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGVtcGxhdGUuY29udGVudC5pbm5lclRleHQgPSAnJztcblx0XHR0ZW1wbGF0ZS5uYXZiYXIuY2xlYXIoKTtcblxuXHRcdGlmICh0aGlzLmN1cnJlbnRJZGVudGlmaWVyICE9PSBleHRlbnNpb24uaWRlbnRpZmllci5pZCkge1xuXHRcdFx0dGhpcy5pbml0aWFsU2Nyb2xsUHJvZ3Jlc3MuY2xlYXIoKTtcblx0XHRcdHRoaXMuY3VycmVudElkZW50aWZpZXIgPSBleHRlbnNpb24uaWRlbnRpZmllci5pZDtcblx0XHR9XG5cblx0XHR0ZW1wbGF0ZS5uYXZiYXIucHVzaChFeHRlbnNpb25FZGl0b3JUYWIuUmVhZG1lLCBsb2NhbGl6ZSgnZGV0YWlscycsIFwiRGV0YWlsc1wiKSwgbG9jYWxpemUoJ2RldGFpbHN0b29sdGlwJywgXCJFeHRlbnNpb24gZGV0YWlscywgcmVuZGVyZWQgZnJvbSB0aGUgZXh0ZW5zaW9uJ3MgJ1JFQURNRS5tZCcgZmlsZVwiKSk7XG5cdFx0aWYgKG1hbmlmZXN0KSB7XG5cdFx0XHR0ZW1wbGF0ZS5uYXZiYXIucHVzaChFeHRlbnNpb25FZGl0b3JUYWIuRmVhdHVyZXMsIGxvY2FsaXplKCdmZWF0dXJlcycsIFwiRmVhdHVyZXNcIiksIGxvY2FsaXplKCdmZWF0dXJlc3Rvb2x0aXAnLCBcIkxpc3RzIGZlYXR1cmVzIGNvbnRyaWJ1dGVkIGJ5IHRoaXMgZXh0ZW5zaW9uXCIpKTtcblx0XHR9XG5cdFx0aWYgKGV4dGVuc2lvbi5oYXNDaGFuZ2Vsb2coKSkge1xuXHRcdFx0dGVtcGxhdGUubmF2YmFyLnB1c2goRXh0ZW5zaW9uRWRpdG9yVGFiLkNoYW5nZWxvZywgbG9jYWxpemUoJ2NoYW5nZWxvZycsIFwiQ2hhbmdlbG9nXCIpLCBsb2NhbGl6ZSgnY2hhbmdlbG9ndG9vbHRpcCcsIFwiRXh0ZW5zaW9uIHVwZGF0ZSBoaXN0b3J5LCByZW5kZXJlZCBmcm9tIHRoZSBleHRlbnNpb24ncyAnQ0hBTkdFTE9HLm1kJyBmaWxlXCIpKTtcblx0XHR9XG5cdFx0aWYgKGV4dGVuc2lvbi5kZXBlbmRlbmNpZXMubGVuZ3RoKSB7XG5cdFx0XHR0ZW1wbGF0ZS5uYXZiYXIucHVzaChFeHRlbnNpb25FZGl0b3JUYWIuRGVwZW5kZW5jaWVzLCBsb2NhbGl6ZSgnZGVwZW5kZW5jaWVzJywgXCJEZXBlbmRlbmNpZXNcIiksIGxvY2FsaXplKCdkZXBlbmRlbmNpZXN0b29sdGlwJywgXCJMaXN0cyBleHRlbnNpb25zIHRoaXMgZXh0ZW5zaW9uIGRlcGVuZHMgb25cIikpO1xuXHRcdH1cblx0XHRpZiAobWFuaWZlc3QgJiYgbWFuaWZlc3QuZXh0ZW5zaW9uUGFjaz8ubGVuZ3RoICYmICF0aGlzLnNoYWxsUmVuZGVyQXNFeHRlbnNpb25QYWNrKG1hbmlmZXN0KSkge1xuXHRcdFx0dGVtcGxhdGUubmF2YmFyLnB1c2goRXh0ZW5zaW9uRWRpdG9yVGFiLkV4dGVuc2lvblBhY2ssIGxvY2FsaXplKCdleHRlbnNpb25wYWNrJywgXCJFeHRlbnNpb24gUGFja1wiKSwgbG9jYWxpemUoJ2V4dGVuc2lvbnBhY2t0b29sdGlwJywgXCJMaXN0cyBleHRlbnNpb25zIHRob3NlIHdpbGwgYmUgaW5zdGFsbGVkIHRvZ2V0aGVyIHdpdGggdGhpcyBleHRlbnNpb25cIikpO1xuXHRcdH1cblxuXHRcdGlmICgoPElFeHRlbnNpb25FZGl0b3JPcHRpb25zIHwgdW5kZWZpbmVkPnRoaXMub3B0aW9ucyk/LnRhYikge1xuXHRcdFx0dGVtcGxhdGUubmF2YmFyLnN3aXRjaCgoPElFeHRlbnNpb25FZGl0b3JPcHRpb25zPnRoaXMub3B0aW9ucykudGFiISk7XG5cdFx0fVxuXHRcdGlmICh0ZW1wbGF0ZS5uYXZiYXIuY3VycmVudElkKSB7XG5cdFx0XHR0aGlzLm9uTmF2YmFyQ2hhbmdlKGV4dGVuc2lvbiwgeyBpZDogdGVtcGxhdGUubmF2YmFyLmN1cnJlbnRJZCwgZm9jdXM6ICFwcmVzZXJ2ZUZvY3VzIH0sIHRlbXBsYXRlKTtcblx0XHR9XG5cdFx0dGVtcGxhdGUubmF2YmFyLm9uQ2hhbmdlKGUgPT4gdGhpcy5vbk5hdmJhckNoYW5nZShleHRlbnNpb24sIGUsIHRlbXBsYXRlKSwgdGhpcywgdGhpcy50cmFuc2llbnREaXNwb3NhYmxlcyk7XG5cdH1cblxuXHRvdmVycmlkZSBjbGVhcklucHV0KCk6IHZvaWQge1xuXHRcdHRoaXMuY29udGVudERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0dGhpcy50cmFuc2llbnREaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0c3VwZXIuY2xlYXJJbnB1dCgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZm9jdXMoKTogdm9pZCB7XG5cdFx0c3VwZXIuZm9jdXMoKTtcblx0XHR0aGlzLmFjdGl2ZUVsZW1lbnQ/LmZvY3VzKCk7XG5cdH1cblxuXHRzaG93RmluZCgpOiB2b2lkIHtcblx0XHR0aGlzLmFjdGl2ZVdlYnZpZXc/LnNob3dGaW5kKCk7XG5cdH1cblxuXHRydW5GaW5kQWN0aW9uKHByZXZpb3VzOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5hY3RpdmVXZWJ2aWV3Py5ydW5GaW5kQWN0aW9uKHByZXZpb3VzKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgYWN0aXZlV2VidmlldygpOiBJV2VidmlldyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCF0aGlzLmFjdGl2ZUVsZW1lbnQgfHwgISh0aGlzLmFjdGl2ZUVsZW1lbnQgYXMgSVdlYnZpZXcpLnJ1bkZpbmRBY3Rpb24pIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmFjdGl2ZUVsZW1lbnQgYXMgSVdlYnZpZXc7XG5cdH1cblxuXHRwcml2YXRlIG9uTmF2YmFyQ2hhbmdlKGV4dGVuc2lvbjogSUV4dGVuc2lvbiwgeyBpZCwgZm9jdXMgfTogeyBpZDogc3RyaW5nIHwgbnVsbDsgZm9jdXM6IGJvb2xlYW4gfSwgdGVtcGxhdGU6IElFeHRlbnNpb25FZGl0b3JUZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHRoaXMuY29udGVudERpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0dGVtcGxhdGUuY29udGVudC5pbm5lclRleHQgPSAnJztcblx0XHR0aGlzLmFjdGl2ZUVsZW1lbnQgPSBudWxsO1xuXHRcdGlmIChpZCkge1xuXHRcdFx0Y29uc3QgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0XHR0aGlzLmNvbnRlbnREaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IGN0cy5kaXNwb3NlKHRydWUpKSk7XG5cdFx0XHR0aGlzLm9wZW4oaWQsIGV4dGVuc2lvbiwgdGVtcGxhdGUsIGN0cy50b2tlbilcblx0XHRcdFx0LnRoZW4oYWN0aXZlRWxlbWVudCA9PiB7XG5cdFx0XHRcdFx0aWYgKGN0cy50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGlzLmFjdGl2ZUVsZW1lbnQgPSBhY3RpdmVFbGVtZW50O1xuXHRcdFx0XHRcdGlmIChmb2N1cykge1xuXHRcdFx0XHRcdFx0dGhpcy5mb2N1cygpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvcGVuKGlkOiBzdHJpbmcsIGV4dGVuc2lvbjogSUV4dGVuc2lvbiwgdGVtcGxhdGU6IElFeHRlbnNpb25FZGl0b3JUZW1wbGF0ZSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJQWN0aXZlRWxlbWVudCB8IG51bGw+IHtcblx0XHRzd2l0Y2ggKGlkKSB7XG5cdFx0XHRjYXNlIEV4dGVuc2lvbkVkaXRvclRhYi5SZWFkbWU6IHJldHVybiB0aGlzLm9wZW5EZXRhaWxzKGV4dGVuc2lvbiwgdGVtcGxhdGUsIHRva2VuKTtcblx0XHRcdGNhc2UgRXh0ZW5zaW9uRWRpdG9yVGFiLkZlYXR1cmVzOiByZXR1cm4gdGhpcy5vcGVuRmVhdHVyZXModGVtcGxhdGUsIHRva2VuKTtcblx0XHRcdGNhc2UgRXh0ZW5zaW9uRWRpdG9yVGFiLkNoYW5nZWxvZzogcmV0dXJuIHRoaXMub3BlbkNoYW5nZWxvZyhleHRlbnNpb24sIHRlbXBsYXRlLCB0b2tlbik7XG5cdFx0XHRjYXNlIEV4dGVuc2lvbkVkaXRvclRhYi5EZXBlbmRlbmNpZXM6IHJldHVybiB0aGlzLm9wZW5FeHRlbnNpb25EZXBlbmRlbmNpZXMoZXh0ZW5zaW9uLCB0ZW1wbGF0ZSwgdG9rZW4pO1xuXHRcdFx0Y2FzZSBFeHRlbnNpb25FZGl0b3JUYWIuRXh0ZW5zaW9uUGFjazogcmV0dXJuIHRoaXMub3BlbkV4dGVuc2lvblBhY2soZXh0ZW5zaW9uLCB0ZW1wbGF0ZSwgdG9rZW4pO1xuXHRcdH1cblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvcGVuTWFya2Rvd24oZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uLCBjYWNoZVJlc3VsdDogQ2FjaGVSZXN1bHQ8c3RyaW5nPiwgbm9Db250ZW50Q29weTogc3RyaW5nLCBjb250YWluZXI6IEhUTUxFbGVtZW50LCB3ZWJ2aWV3SW5kZXg6IFdlYnZpZXdJbmRleCwgdGl0bGU6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJQWN0aXZlRWxlbWVudCB8IG51bGw+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgYm9keSA9IGF3YWl0IHRoaXMucmVuZGVyTWFya2Rvd24oZXh0ZW5zaW9uLCBjYWNoZVJlc3VsdCwgY29udGFpbmVyLCB0b2tlbik7XG5cdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShudWxsKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgd2VidmlldyA9IHRoaXMuY29udGVudERpc3Bvc2FibGVzLmFkZCh0aGlzLndlYnZpZXdTZXJ2aWNlLmNyZWF0ZVdlYnZpZXdPdmVybGF5KHtcblx0XHRcdFx0dGl0bGUsXG5cdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRlbmFibGVGaW5kV2lkZ2V0OiB0cnVlLFxuXHRcdFx0XHRcdHRyeVJlc3RvcmVTY3JvbGxQb3NpdGlvbjogdHJ1ZSxcblx0XHRcdFx0XHRkaXNhYmxlU2VydmljZVdvcmtlcjogdHJ1ZSxcblx0XHRcdFx0fSxcblx0XHRcdFx0Y29udGVudE9wdGlvbnM6IHt9LFxuXHRcdFx0XHRleHRlbnNpb246IHVuZGVmaW5lZCxcblx0XHRcdH0pKTtcblxuXHRcdFx0d2Vidmlldy5pbml0aWFsU2Nyb2xsUHJvZ3Jlc3MgPSB0aGlzLmluaXRpYWxTY3JvbGxQcm9ncmVzcy5nZXQod2Vidmlld0luZGV4KSB8fCAwO1xuXG5cdFx0XHR3ZWJ2aWV3LmNsYWltKHRoaXMsIHRoaXMud2luZG93LCB0aGlzLnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRcdHNldFBhcmVudEZsb3dUbyh3ZWJ2aWV3LmNvbnRhaW5lciwgY29udGFpbmVyKTtcblx0XHRcdHdlYnZpZXcubGF5b3V0V2Vidmlld092ZXJFbGVtZW50KGNvbnRhaW5lcik7XG5cblx0XHRcdHdlYnZpZXcuc2V0SHRtbChib2R5KTtcblx0XHRcdHdlYnZpZXcuY2xhaW0odGhpcywgdGhpcy53aW5kb3csIHVuZGVmaW5lZCk7XG5cblx0XHRcdHRoaXMuY29udGVudERpc3Bvc2FibGVzLmFkZCh3ZWJ2aWV3Lm9uRGlkRm9jdXMoKCkgPT4gdGhpcy5fb25EaWRGb2N1cz8uZmlyZSgpKSk7XG5cblx0XHRcdHRoaXMuY29udGVudERpc3Bvc2FibGVzLmFkZCh3ZWJ2aWV3Lm9uRGlkU2Nyb2xsKCgpID0+IHRoaXMuaW5pdGlhbFNjcm9sbFByb2dyZXNzLnNldCh3ZWJ2aWV3SW5kZXgsIHdlYnZpZXcuaW5pdGlhbFNjcm9sbFByb2dyZXNzKSkpO1xuXG5cdFx0XHRjb25zdCByZW1vdmVMYXlvdXRQYXJ0aWNpcGFudCA9IGFycmF5cy5pbnNlcnQodGhpcy5sYXlvdXRQYXJ0aWNpcGFudHMsIHtcblx0XHRcdFx0bGF5b3V0OiAoKSA9PiB7XG5cdFx0XHRcdFx0d2Vidmlldy5sYXlvdXRXZWJ2aWV3T3ZlckVsZW1lbnQoY29udGFpbmVyKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLmNvbnRlbnREaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKHJlbW92ZUxheW91dFBhcnRpY2lwYW50KSk7XG5cblx0XHRcdGxldCBpc0Rpc3Bvc2VkID0gZmFsc2U7XG5cdFx0XHR0aGlzLmNvbnRlbnREaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHsgaXNEaXNwb3NlZCA9IHRydWU7IH0pKTtcblxuXHRcdFx0dGhpcy5jb250ZW50RGlzcG9zYWJsZXMuYWRkKHRoaXMudGhlbWVTZXJ2aWNlLm9uRGlkQ29sb3JUaGVtZUNoYW5nZShhc3luYyAoKSA9PiB7XG5cdFx0XHRcdC8vIFJlbmRlciBhZ2FpbiBzaW5jZSBzeW50YXggaGlnaGxpZ2h0aW5nIG9mIGNvZGUgYmxvY2tzIG1heSBoYXZlIGNoYW5nZWRcblx0XHRcdFx0Y29uc3QgYm9keSA9IGF3YWl0IHRoaXMucmVuZGVyTWFya2Rvd24oZXh0ZW5zaW9uLCBjYWNoZVJlc3VsdCwgY29udGFpbmVyKTtcblx0XHRcdFx0aWYgKCFpc0Rpc3Bvc2VkKSB7IC8vIE1ha2Ugc3VyZSB3ZSB3ZXJlbid0IGRpc3Bvc2VkIG9mIGluIHRoZSBtZWFudGltZVxuXHRcdFx0XHRcdHdlYnZpZXcuc2V0SHRtbChib2R5KTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHR0aGlzLmNvbnRlbnREaXNwb3NhYmxlcy5hZGQod2Vidmlldy5vbkRpZENsaWNrTGluayhsaW5rID0+IHtcblx0XHRcdFx0aWYgKCFsaW5rKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIE9ubHkgYWxsb3cgbGlua3Mgd2l0aCBzcGVjaWZpYyBzY2hlbWVzXG5cdFx0XHRcdGlmIChtYXRjaGVzU2NoZW1lKGxpbmssIFNjaGVtYXMuaHR0cCkgfHwgbWF0Y2hlc1NjaGVtZShsaW5rLCBTY2hlbWFzLmh0dHBzKSB8fCBtYXRjaGVzU2NoZW1lKGxpbmssIFNjaGVtYXMubWFpbHRvKSkge1xuXHRcdFx0XHRcdHRoaXMub3BlbmVyU2VydmljZS5vcGVuKGxpbmspO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChtYXRjaGVzU2NoZW1lKGxpbmssIFNjaGVtYXMuY29tbWFuZCkgJiYgZXh0ZW5zaW9uLnR5cGUgPT09IEV4dGVuc2lvblR5cGUuU3lzdGVtKSB7XG5cdFx0XHRcdFx0dGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4obGluaywgeyBhbGxvd0NvbW1hbmRzOiB0cnVlIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdHJldHVybiB3ZWJ2aWV3O1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnN0IHAgPSBhcHBlbmQoY29udGFpbmVyLCAkKCdwLm5vY29udGVudCcpKTtcblx0XHRcdHAudGV4dENvbnRlbnQgPSBub0NvbnRlbnRDb3B5O1xuXHRcdFx0cmV0dXJuIHA7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZW5kZXJNYXJrZG93bihleHRlbnNpb246IElFeHRlbnNpb24sIGNhY2hlUmVzdWx0OiBDYWNoZVJlc3VsdDxzdHJpbmc+LCBjb250YWluZXI6IEhUTUxFbGVtZW50LCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRjb25zdCBjb250ZW50cyA9IGF3YWl0IHRoaXMubG9hZENvbnRlbnRzKCgpID0+IGNhY2hlUmVzdWx0LCBjb250YWluZXIpO1xuXHRcdGlmICh0b2tlbj8uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cblx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgcmVuZGVyTWFya2Rvd25Eb2N1bWVudChjb250ZW50cywgdGhpcy5leHRlbnNpb25TZXJ2aWNlLCB0aGlzLmxhbmd1YWdlU2VydmljZSwgeyBzaG91bGRTYW5pdGl6ZTogZXh0ZW5zaW9uLnR5cGUgIT09IEV4dGVuc2lvblR5cGUuU3lzdGVtLCB0b2tlbiB9KTtcblx0XHRpZiAodG9rZW4/LmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gJyc7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMucmVuZGVyQm9keShjb250ZW50KTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyQm9keShib2R5OiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdGNvbnN0IG5vbmNlID0gZ2VuZXJhdGVVdWlkKCk7XG5cdFx0Y29uc3QgY29sb3JNYXAgPSBUb2tlbml6YXRpb25SZWdpc3RyeS5nZXRDb2xvck1hcCgpO1xuXHRcdGNvbnN0IGNzcyA9IGNvbG9yTWFwID8gZ2VuZXJhdGVUb2tlbnNDU1NGb3JDb2xvck1hcChjb2xvck1hcCkgOiAnJztcblx0XHRyZXR1cm4gYDwhRE9DVFlQRSBodG1sPlxuXHRcdDxodG1sPlxuXHRcdFx0PGhlYWQ+XG5cdFx0XHRcdDxtZXRhIGh0dHAtZXF1aXY9XCJDb250ZW50LXR5cGVcIiBjb250ZW50PVwidGV4dC9odG1sO2NoYXJzZXQ9VVRGLThcIj5cblx0XHRcdFx0PG1ldGEgaHR0cC1lcXVpdj1cIkNvbnRlbnQtU2VjdXJpdHktUG9saWN5XCIgY29udGVudD1cImRlZmF1bHQtc3JjICdub25lJzsgaW1nLXNyYyBodHRwczogZGF0YTo7IG1lZGlhLXNyYyBodHRwczo7IHNjcmlwdC1zcmMgJ25vbmUnOyBzdHlsZS1zcmMgJ25vbmNlLSR7bm9uY2V9JztcIj5cblx0XHRcdFx0PHN0eWxlIG5vbmNlPVwiJHtub25jZX1cIj5cblx0XHRcdFx0XHQke0RFRkFVTFRfTUFSS0RPV05fU1RZTEVTfVxuXG5cdFx0XHRcdFx0LyogcHJldmVudCBzY3JvbGwtdG8tdG9wIGJ1dHRvbiBmcm9tIGJsb2NraW5nIHRoZSBib2R5IHRleHQgKi9cblx0XHRcdFx0XHRib2R5IHtcblx0XHRcdFx0XHRcdHBhZGRpbmctYm90dG9tOiA3NXB4O1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdCNzY3JvbGwtdG8tdG9wIHtcblx0XHRcdFx0XHRcdHBvc2l0aW9uOiBmaXhlZDtcblx0XHRcdFx0XHRcdHdpZHRoOiAzMnB4O1xuXHRcdFx0XHRcdFx0aGVpZ2h0OiAzMnB4O1xuXHRcdFx0XHRcdFx0cmlnaHQ6IDI1cHg7XG5cdFx0XHRcdFx0XHRib3R0b206IDI1cHg7XG5cdFx0XHRcdFx0XHRiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS12c2NvZGUtYnV0dG9uLXNlY29uZGFyeUJhY2tncm91bmQpO1xuXHRcdFx0XHRcdFx0Ym9yZGVyLWNvbG9yOiB2YXIoLS12c2NvZGUtYnV0dG9uLWJvcmRlcik7XG5cdFx0XHRcdFx0XHRib3JkZXItcmFkaXVzOiA1MCU7XG5cdFx0XHRcdFx0XHRjdXJzb3I6IHBvaW50ZXI7XG5cdFx0XHRcdFx0XHRib3gtc2hhZG93OiAxcHggMXB4IDFweCByZ2JhKDAsMCwwLC4yNSk7XG5cdFx0XHRcdFx0XHRvdXRsaW5lOiBub25lO1xuXHRcdFx0XHRcdFx0ZGlzcGxheTogZmxleDtcblx0XHRcdFx0XHRcdGp1c3RpZnktY29udGVudDogY2VudGVyO1xuXHRcdFx0XHRcdFx0YWxpZ24taXRlbXM6IGNlbnRlcjtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQjc2Nyb2xsLXRvLXRvcDpob3ZlciB7XG5cdFx0XHRcdFx0XHRiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS12c2NvZGUtYnV0dG9uLXNlY29uZGFyeUhvdmVyQmFja2dyb3VuZCk7XG5cdFx0XHRcdFx0XHRib3gtc2hhZG93OiAycHggMnB4IDJweCByZ2JhKDAsMCwwLC4yNSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ym9keS52c2NvZGUtaGlnaC1jb250cmFzdCAjc2Nyb2xsLXRvLXRvcCB7XG5cdFx0XHRcdFx0XHRib3JkZXItd2lkdGg6IDJweDtcblx0XHRcdFx0XHRcdGJvcmRlci1zdHlsZTogc29saWQ7XG5cdFx0XHRcdFx0XHRib3gtc2hhZG93OiBub25lO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdCNzY3JvbGwtdG8tdG9wIHNwYW4uaWNvbjo6YmVmb3JlIHtcblx0XHRcdFx0XHRcdGNvbnRlbnQ6IFwiXCI7XG5cdFx0XHRcdFx0XHRkaXNwbGF5OiBibG9jaztcblx0XHRcdFx0XHRcdGJhY2tncm91bmQ6IHZhcigtLXZzY29kZS1idXR0b24tc2Vjb25kYXJ5Rm9yZWdyb3VuZCk7XG5cdFx0XHRcdFx0XHQvKiBDaGV2cm9uIHVwIGljb24gKi9cblx0XHRcdFx0XHRcdHdlYmtpdC1tYXNrLWltYWdlOiB1cmwoJ2RhdGE6aW1hZ2Uvc3ZnK3htbDtiYXNlNjQsUEQ5NGJXd2dkbVZ5YzJsdmJqMGlNUzR3SWlCbGJtTnZaR2x1WnowaWRYUm1MVGdpUHo0S1BDRXRMU0JIWlc1bGNtRjBiM0k2SUVGa2IySmxJRWxzYkhWemRISmhkRzl5SURFNUxqSXVNQ3dnVTFaSElFVjRjRzl5ZENCUWJIVm5MVWx1SUM0Z1UxWkhJRlpsY25OcGIyNDZJRFl1TURBZ1FuVnBiR1FnTUNrZ0lDMHRQZ284YzNabklIWmxjbk5wYjI0OUlqRXVNU0lnYVdROUlreGhlV1Z5WHpFaUlIaHRiRzV6UFNKb2RIUndPaTh2ZDNkM0xuY3pMbTl5Wnk4eU1EQXdMM04yWnlJZ2VHMXNibk02ZUd4cGJtczlJbWgwZEhBNkx5OTNkM2N1ZHpNdWIzSm5MekU1T1RrdmVHeHBibXNpSUhnOUlqQndlQ0lnZVQwaU1IQjRJZ29KSUhacFpYZENiM2c5SWpBZ01DQXhOaUF4TmlJZ2MzUjViR1U5SW1WdVlXSnNaUzFpWVdOclozSnZkVzVrT201bGR5QXdJREFnTVRZZ01UWTdJaUI0Yld3NmMzQmhZMlU5SW5CeVpYTmxjblpsSWo0S1BITjBlV3hsSUhSNWNHVTlJblJsZUhRdlkzTnpJajRLQ1M1emREQjdabWxzYkRvalJrWkdSa1pHTzMwS0NTNXpkREY3Wm1sc2JEcHViMjVsTzMwS1BDOXpkSGxzWlQ0S1BIUnBkR3hsUG5Wd1kyaGxkbkp2Ymp3dmRHbDBiR1UrQ2p4d1lYUm9JR05zWVhOelBTSnpkREFpSUdROUlrMDRMRFV1TVd3dE55NHpMRGN1TTB3d0xERXhMalpzT0MwNGJEZ3NPR3d0TUM0M0xEQXVOMHc0TERVdU1Yb2lMejRLUEhKbFkzUWdZMnhoYzNNOUluTjBNU0lnZDJsa2RHZzlJakUySWlCb1pXbG5hSFE5SWpFMklpOCtDand2YzNablBnbz0nKTtcblx0XHRcdFx0XHRcdC13ZWJraXQtbWFzay1pbWFnZTogdXJsKCdkYXRhOmltYWdlL3N2Zyt4bWw7YmFzZTY0LFBEOTRiV3dnZG1WeWMybHZiajBpTVM0d0lpQmxibU52WkdsdVp6MGlkWFJtTFRnaVB6NEtQQ0V0TFNCSFpXNWxjbUYwYjNJNklFRmtiMkpsSUVsc2JIVnpkSEpoZEc5eUlERTVMakl1TUN3Z1UxWkhJRVY0Y0c5eWRDQlFiSFZuTFVsdUlDNGdVMVpISUZabGNuTnBiMjQ2SURZdU1EQWdRblZwYkdRZ01Da2dJQzB0UGdvOGMzWm5JSFpsY25OcGIyNDlJakV1TVNJZ2FXUTlJa3hoZVdWeVh6RWlJSGh0Ykc1elBTSm9kSFJ3T2k4dmQzZDNMbmN6TG05eVp5OHlNREF3TDNOMlp5SWdlRzFzYm5NNmVHeHBibXM5SW1oMGRIQTZMeTkzZDNjdWR6TXViM0puTHpFNU9Ua3ZlR3hwYm1zaUlIZzlJakJ3ZUNJZ2VUMGlNSEI0SWdvSklIWnBaWGRDYjNnOUlqQWdNQ0F4TmlBeE5pSWdjM1I1YkdVOUltVnVZV0pzWlMxaVlXTnJaM0p2ZFc1a09tNWxkeUF3SURBZ01UWWdNVFk3SWlCNGJXdzZjM0JoWTJVOUluQnlaWE5sY25abElqNEtQSE4wZVd4bElIUjVjR1U5SW5SbGVIUXZZM056SWo0S0NTNXpkREI3Wm1sc2JEb2pSa1pHUmtaR08zMEtDUzV6ZERGN1ptbHNiRHB1YjI1bE8zMEtQQzl6ZEhsc1pUNEtQSFJwZEd4bFBuVndZMmhsZG5KdmJqd3ZkR2wwYkdVK0NqeHdZWFJvSUdOc1lYTnpQU0p6ZERBaUlHUTlJazA0TERVdU1Xd3ROeTR6TERjdU0wd3dMREV4TGpac09DMDRiRGdzT0d3dE1DNDNMREF1TjB3NExEVXVNWG9pTHo0S1BISmxZM1FnWTJ4aGMzTTlJbk4wTVNJZ2QybGtkR2c5SWpFMklpQm9aV2xuYUhROUlqRTJJaTgrQ2p3dmMzWm5QZ289Jyk7XG5cdFx0XHRcdFx0XHR3aWR0aDogMTZweDtcblx0XHRcdFx0XHRcdGhlaWdodDogMTZweDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0JHtjc3N9XG5cdFx0XHRcdDwvc3R5bGU+XG5cdFx0XHQ8L2hlYWQ+XG5cdFx0XHQ8Ym9keT5cblx0XHRcdFx0PGEgaWQ9XCJzY3JvbGwtdG8tdG9wXCIgcm9sZT1cImJ1dHRvblwiIGFyaWEtbGFiZWw9XCJzY3JvbGwgdG8gdG9wXCIgaHJlZj1cIiNcIj48c3BhbiBjbGFzcz1cImljb25cIj48L3NwYW4+PC9hPlxuXHRcdFx0XHQke2JvZHl9XG5cdFx0XHQ8L2JvZHk+XG5cdFx0PC9odG1sPmA7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9wZW5EZXRhaWxzKGV4dGVuc2lvbjogSUV4dGVuc2lvbiwgdGVtcGxhdGU6IElFeHRlbnNpb25FZGl0b3JUZW1wbGF0ZSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJQWN0aXZlRWxlbWVudCB8IG51bGw+IHtcblx0XHRjb25zdCBkZXRhaWxzID0gYXBwZW5kKHRlbXBsYXRlLmNvbnRlbnQsICQoJy5kZXRhaWxzJykpO1xuXHRcdGNvbnN0IHJlYWRtZUNvbnRhaW5lciA9IGFwcGVuZChkZXRhaWxzLCAkKCcucmVhZG1lLWNvbnRhaW5lcicpKTtcblx0XHRjb25zdCBhZGRpdGlvbmFsRGV0YWlsc0NvbnRhaW5lciA9IGFwcGVuZChkZXRhaWxzLCAkKCcuYWRkaXRpb25hbC1kZXRhaWxzLWNvbnRhaW5lcicpKTtcblxuXHRcdGNvbnN0IGxheW91dCA9ICgpID0+IGRldGFpbHMuY2xhc3NMaXN0LnRvZ2dsZSgnbmFycm93JywgdGhpcy5kaW1lbnNpb24gJiYgdGhpcy5kaW1lbnNpb24ud2lkdGggPCA1MDApO1xuXHRcdGxheW91dCgpO1xuXHRcdHRoaXMuY29udGVudERpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoYXJyYXlzLmluc2VydCh0aGlzLmxheW91dFBhcnRpY2lwYW50cywgeyBsYXlvdXQgfSkpKTtcblxuXHRcdGxldCBhY3RpdmVFbGVtZW50OiBJQWN0aXZlRWxlbWVudCB8IG51bGwgPSBudWxsO1xuXHRcdGNvbnN0IG1hbmlmZXN0ID0gYXdhaXQgdGhpcy5leHRlbnNpb25NYW5pZmVzdCEuZ2V0KCkucHJvbWlzZTtcblx0XHRpZiAobWFuaWZlc3QgJiYgbWFuaWZlc3QuZXh0ZW5zaW9uUGFjaz8ubGVuZ3RoICYmIHRoaXMuc2hhbGxSZW5kZXJBc0V4dGVuc2lvblBhY2sobWFuaWZlc3QpKSB7XG5cdFx0XHRhY3RpdmVFbGVtZW50ID0gYXdhaXQgdGhpcy5vcGVuRXh0ZW5zaW9uUGFja1JlYWRtZShleHRlbnNpb24sIG1hbmlmZXN0LCByZWFkbWVDb250YWluZXIsIHRva2VuKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YWN0aXZlRWxlbWVudCA9IGF3YWl0IHRoaXMub3Blbk1hcmtkb3duKGV4dGVuc2lvbiwgdGhpcy5leHRlbnNpb25SZWFkbWUhLmdldCgpLCBsb2NhbGl6ZSgnbm9SZWFkbWUnLCBcIk5vIFJFQURNRSBhdmFpbGFibGUuXCIpLCByZWFkbWVDb250YWluZXIsIFdlYnZpZXdJbmRleC5SZWFkbWUsIGxvY2FsaXplKCdSZWFkbWUgdGl0bGUnLCBcIlJlYWRtZVwiKSwgdG9rZW4pO1xuXHRcdH1cblxuXHRcdHRoaXMucmVuZGVyQWRkaXRpb25hbERldGFpbHMoYWRkaXRpb25hbERldGFpbHNDb250YWluZXIsIGV4dGVuc2lvbik7XG5cdFx0cmV0dXJuIGFjdGl2ZUVsZW1lbnQ7XG5cdH1cblxuXHRwcml2YXRlIHNoYWxsUmVuZGVyQXNFeHRlbnNpb25QYWNrKG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISEobWFuaWZlc3QuY2F0ZWdvcmllcz8uc29tZShjYXRlZ29yeSA9PiBjYXRlZ29yeS50b0xvd2VyQ2FzZSgpID09PSAnZXh0ZW5zaW9uIHBhY2tzJykpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvcGVuRXh0ZW5zaW9uUGFja1JlYWRtZShleHRlbnNpb246IElFeHRlbnNpb24sIG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QsIGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUFjdGl2ZUVsZW1lbnQgfCBudWxsPiB7XG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4dGVuc2lvblBhY2tSZWFkbWUgPSBhcHBlbmQoY29udGFpbmVyLCAkKCdkaXYnLCB7IGNsYXNzOiAnZXh0ZW5zaW9uLXBhY2stcmVhZG1lJyB9KSk7XG5cdFx0ZXh0ZW5zaW9uUGFja1JlYWRtZS5zdHlsZS5tYXJnaW4gPSAnMCBhdXRvJztcblx0XHRleHRlbnNpb25QYWNrUmVhZG1lLnN0eWxlLm1heFdpZHRoID0gJzg4MnB4JztcblxuXHRcdGNvbnN0IGV4dGVuc2lvblBhY2sgPSBhcHBlbmQoZXh0ZW5zaW9uUGFja1JlYWRtZSwgJCgnZGl2JywgeyBjbGFzczogJ2V4dGVuc2lvbi1wYWNrJyB9KSk7XG5cdFx0aWYgKG1hbmlmZXN0LmV4dGVuc2lvblBhY2shLmxlbmd0aCA8PSAzKSB7XG5cdFx0XHRleHRlbnNpb25QYWNrUmVhZG1lLmNsYXNzTGlzdC5hZGQoJ29uZS1yb3cnKTtcblx0XHR9IGVsc2UgaWYgKG1hbmlmZXN0LmV4dGVuc2lvblBhY2shLmxlbmd0aCA8PSA2KSB7XG5cdFx0XHRleHRlbnNpb25QYWNrUmVhZG1lLmNsYXNzTGlzdC5hZGQoJ3R3by1yb3dzJyk7XG5cdFx0fSBlbHNlIGlmIChtYW5pZmVzdC5leHRlbnNpb25QYWNrIS5sZW5ndGggPD0gOSkge1xuXHRcdFx0ZXh0ZW5zaW9uUGFja1JlYWRtZS5jbGFzc0xpc3QuYWRkKCd0aHJlZS1yb3dzJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGV4dGVuc2lvblBhY2tSZWFkbWUuY2xhc3NMaXN0LmFkZCgnbW9yZS1yb3dzJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXh0ZW5zaW9uUGFja0hlYWRlciA9IGFwcGVuZChleHRlbnNpb25QYWNrLCAkKCdkaXYuaGVhZGVyJykpO1xuXHRcdGV4dGVuc2lvblBhY2tIZWFkZXIudGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgnZXh0ZW5zaW9uIHBhY2snLCBcIkV4dGVuc2lvbiBQYWNrICh7MH0pXCIsIG1hbmlmZXN0LmV4dGVuc2lvblBhY2shLmxlbmd0aCk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uUGFja0NvbnRlbnQgPSBhcHBlbmQoZXh0ZW5zaW9uUGFjaywgJCgnZGl2JywgeyBjbGFzczogJ2V4dGVuc2lvbi1wYWNrLWNvbnRlbnQnIH0pKTtcblx0XHRleHRlbnNpb25QYWNrQ29udGVudC5zZXRBdHRyaWJ1dGUoJ3RhYmluZGV4JywgJzAnKTtcblx0XHRhcHBlbmQoZXh0ZW5zaW9uUGFjaywgJCgnZGl2LmZvb3RlcicpKTtcblx0XHRjb25zdCByZWFkbWVDb250ZW50ID0gYXBwZW5kKGV4dGVuc2lvblBhY2tSZWFkbWUsICQoJ2Rpdi5yZWFkbWUtY29udGVudCcpKTtcblxuXHRcdGF3YWl0IFByb21pc2UuYWxsKFtcblx0XHRcdHRoaXMucmVuZGVyRXh0ZW5zaW9uUGFjayhtYW5pZmVzdCwgZXh0ZW5zaW9uUGFja0NvbnRlbnQsIHRva2VuKSxcblx0XHRcdHRoaXMub3Blbk1hcmtkb3duKGV4dGVuc2lvbiwgdGhpcy5leHRlbnNpb25SZWFkbWUhLmdldCgpLCBsb2NhbGl6ZSgnbm9SZWFkbWUnLCBcIk5vIFJFQURNRSBhdmFpbGFibGUuXCIpLCByZWFkbWVDb250ZW50LCBXZWJ2aWV3SW5kZXguUmVhZG1lLCBsb2NhbGl6ZSgnUmVhZG1lIHRpdGxlJywgXCJSZWFkbWVcIiksIHRva2VuKSxcblx0XHRdKTtcblxuXHRcdHJldHVybiB7IGZvY3VzOiAoKSA9PiBleHRlbnNpb25QYWNrQ29udGVudC5mb2N1cygpIH07XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckFkZGl0aW9uYWxEZXRhaWxzKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGV4dGVuc2lvbjogSUV4dGVuc2lvbik6IHZvaWQge1xuXHRcdGNvbnN0IGNvbnRlbnQgPSAkKCdkaXYnLCB7IGNsYXNzOiAnYWRkaXRpb25hbC1kZXRhaWxzLWNvbnRlbnQnLCB0YWJpbmRleDogJzAnIH0pO1xuXHRcdGNvbnN0IHNjcm9sbGFibGVDb250ZW50ID0gbmV3IERvbVNjcm9sbGFibGVFbGVtZW50KGNvbnRlbnQsIHt9KTtcblx0XHRjb25zdCBsYXlvdXQgPSAoKSA9PiBzY3JvbGxhYmxlQ29udGVudC5zY2FuRG9tTm9kZSgpO1xuXHRcdGNvbnN0IHJlbW92ZUxheW91dFBhcnRpY2lwYW50ID0gYXJyYXlzLmluc2VydCh0aGlzLmxheW91dFBhcnRpY2lwYW50cywgeyBsYXlvdXQgfSk7XG5cdFx0dGhpcy5jb250ZW50RGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZShyZW1vdmVMYXlvdXRQYXJ0aWNpcGFudCkpO1xuXHRcdHRoaXMuY29udGVudERpc3Bvc2FibGVzLmFkZChzY3JvbGxhYmxlQ29udGVudCk7XG5cblx0XHR0aGlzLmNvbnRlbnREaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShBZGRpdGlvbmFsRGV0YWlsc1dpZGdldCwgY29udGVudCwgZXh0ZW5zaW9uKSk7XG5cblx0XHRhcHBlbmQoY29udGFpbmVyLCBzY3JvbGxhYmxlQ29udGVudC5nZXREb21Ob2RlKCkpO1xuXHRcdHNjcm9sbGFibGVDb250ZW50LnNjYW5Eb21Ob2RlKCk7XG5cdH1cblxuXHRwcml2YXRlIG9wZW5DaGFuZ2Vsb2coZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uLCB0ZW1wbGF0ZTogSUV4dGVuc2lvbkVkaXRvclRlbXBsYXRlLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElBY3RpdmVFbGVtZW50IHwgbnVsbD4ge1xuXHRcdHJldHVybiB0aGlzLm9wZW5NYXJrZG93bihleHRlbnNpb24sIHRoaXMuZXh0ZW5zaW9uQ2hhbmdlbG9nIS5nZXQoKSwgbG9jYWxpemUoJ25vQ2hhbmdlbG9nJywgXCJObyBDaGFuZ2Vsb2cgYXZhaWxhYmxlLlwiKSwgdGVtcGxhdGUuY29udGVudCwgV2Vidmlld0luZGV4LkNoYW5nZWxvZywgbG9jYWxpemUoJ0NoYW5nZWxvZyB0aXRsZScsIFwiQ2hhbmdlbG9nXCIpLCB0b2tlbik7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9wZW5GZWF0dXJlcyh0ZW1wbGF0ZTogSUV4dGVuc2lvbkVkaXRvclRlbXBsYXRlLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElBY3RpdmVFbGVtZW50IHwgbnVsbD4ge1xuXHRcdGNvbnN0IG1hbmlmZXN0ID0gYXdhaXQgdGhpcy5sb2FkQ29udGVudHMoKCkgPT4gdGhpcy5leHRlbnNpb25NYW5pZmVzdCEuZ2V0KCksIHRlbXBsYXRlLmNvbnRlbnQpO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGlmICghbWFuaWZlc3QpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4dGVuc2lvbkZlYXR1cmVzVGFiID0gdGhpcy5jb250ZW50RGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXh0ZW5zaW9uRmVhdHVyZXNUYWIsIG1hbmlmZXN0LCAoPElFeHRlbnNpb25FZGl0b3JPcHRpb25zIHwgdW5kZWZpbmVkPnRoaXMub3B0aW9ucyk/LmZlYXR1cmUpKTtcblx0XHRjb25zdCBsYXlvdXQgPSAoKSA9PiBleHRlbnNpb25GZWF0dXJlc1RhYi5sYXlvdXQodGVtcGxhdGUuY29udGVudC5jbGllbnRIZWlnaHQsIHRlbXBsYXRlLmNvbnRlbnQuY2xpZW50V2lkdGgpO1xuXHRcdGNvbnN0IHJlbW92ZUxheW91dFBhcnRpY2lwYW50ID0gYXJyYXlzLmluc2VydCh0aGlzLmxheW91dFBhcnRpY2lwYW50cywgeyBsYXlvdXQgfSk7XG5cdFx0dGhpcy5jb250ZW50RGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZShyZW1vdmVMYXlvdXRQYXJ0aWNpcGFudCkpO1xuXHRcdGFwcGVuZCh0ZW1wbGF0ZS5jb250ZW50LCBleHRlbnNpb25GZWF0dXJlc1RhYi5kb21Ob2RlKTtcblx0XHRsYXlvdXQoKTtcblx0XHRyZXR1cm4gZXh0ZW5zaW9uRmVhdHVyZXNUYWIuZG9tTm9kZTtcblx0fVxuXG5cdHByaXZhdGUgb3BlbkV4dGVuc2lvbkRlcGVuZGVuY2llcyhleHRlbnNpb246IElFeHRlbnNpb24sIHRlbXBsYXRlOiBJRXh0ZW5zaW9uRWRpdG9yVGVtcGxhdGUsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUFjdGl2ZUVsZW1lbnQgfCBudWxsPiB7XG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwpO1xuXHRcdH1cblxuXHRcdGlmIChhcnJheXMuaXNGYWxzeU9yRW1wdHkoZXh0ZW5zaW9uLmRlcGVuZGVuY2llcykpIHtcblx0XHRcdGFwcGVuZCh0ZW1wbGF0ZS5jb250ZW50LCAkKCdwLm5vY29udGVudCcpKS50ZXh0Q29udGVudCA9IGxvY2FsaXplKCdub0RlcGVuZGVuY2llcycsIFwiTm8gRGVwZW5kZW5jaWVzXCIpO1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0ZW1wbGF0ZS5jb250ZW50KTtcblx0XHR9XG5cblx0XHRjb25zdCBjb250ZW50ID0gJCgnZGl2JywgeyBjbGFzczogJ3N1YmNvbnRlbnQnIH0pO1xuXHRcdGNvbnN0IHNjcm9sbGFibGVDb250ZW50ID0gbmV3IERvbVNjcm9sbGFibGVFbGVtZW50KGNvbnRlbnQsIHt9KTtcblx0XHRhcHBlbmQodGVtcGxhdGUuY29udGVudCwgc2Nyb2xsYWJsZUNvbnRlbnQuZ2V0RG9tTm9kZSgpKTtcblx0XHR0aGlzLmNvbnRlbnREaXNwb3NhYmxlcy5hZGQoc2Nyb2xsYWJsZUNvbnRlbnQpO1xuXG5cdFx0Y29uc3QgZGVwZW5kZW5jaWVzVHJlZSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRXh0ZW5zaW9uc1RyZWUsXG5cdFx0XHRuZXcgRXh0ZW5zaW9uRGF0YShleHRlbnNpb24sIG51bGwsIGV4dGVuc2lvbiA9PiBleHRlbnNpb24uZGVwZW5kZW5jaWVzIHx8IFtdLCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlKSwgY29udGVudCxcblx0XHRcdHtcblx0XHRcdFx0bGlzdEJhY2tncm91bmQ6IGVkaXRvckJhY2tncm91bmRcblx0XHRcdH0pO1xuXHRcdGNvbnN0IGxheW91dCA9ICgpID0+IHtcblx0XHRcdHNjcm9sbGFibGVDb250ZW50LnNjYW5Eb21Ob2RlKCk7XG5cdFx0XHRjb25zdCBzY3JvbGxEaW1lbnNpb25zID0gc2Nyb2xsYWJsZUNvbnRlbnQuZ2V0U2Nyb2xsRGltZW5zaW9ucygpO1xuXHRcdFx0ZGVwZW5kZW5jaWVzVHJlZS5sYXlvdXQoc2Nyb2xsRGltZW5zaW9ucy5oZWlnaHQpO1xuXHRcdH07XG5cdFx0Y29uc3QgcmVtb3ZlTGF5b3V0UGFydGljaXBhbnQgPSBhcnJheXMuaW5zZXJ0KHRoaXMubGF5b3V0UGFydGljaXBhbnRzLCB7IGxheW91dCB9KTtcblx0XHR0aGlzLmNvbnRlbnREaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKHJlbW92ZUxheW91dFBhcnRpY2lwYW50KSk7XG5cblx0XHR0aGlzLmNvbnRlbnREaXNwb3NhYmxlcy5hZGQoZGVwZW5kZW5jaWVzVHJlZSk7XG5cdFx0c2Nyb2xsYWJsZUNvbnRlbnQuc2NhbkRvbU5vZGUoKTtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHsgZm9jdXMoKSB7IGRlcGVuZGVuY2llc1RyZWUuZG9tRm9jdXMoKTsgfSB9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb3BlbkV4dGVuc2lvblBhY2soZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uLCB0ZW1wbGF0ZTogSUV4dGVuc2lvbkVkaXRvclRlbXBsYXRlLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElBY3RpdmVFbGVtZW50IHwgbnVsbD4ge1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShudWxsKTtcblx0XHR9XG5cdFx0Y29uc3QgbWFuaWZlc3QgPSBhd2FpdCB0aGlzLmxvYWRDb250ZW50cygoKSA9PiB0aGlzLmV4dGVuc2lvbk1hbmlmZXN0IS5nZXQoKSwgdGVtcGxhdGUuY29udGVudCk7XG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0aWYgKCFtYW5pZmVzdCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnJlbmRlckV4dGVuc2lvblBhY2sobWFuaWZlc3QsIHRlbXBsYXRlLmNvbnRlbnQsIHRva2VuKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVuZGVyRXh0ZW5zaW9uUGFjayhtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0LCBwYXJlbnQ6IEhUTUxFbGVtZW50LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElBY3RpdmVFbGVtZW50IHwgbnVsbD4ge1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udGVudCA9ICQoJ2RpdicsIHsgY2xhc3M6ICdzdWJjb250ZW50JyB9KTtcblx0XHRjb25zdCBzY3JvbGxhYmxlQ29udGVudCA9IG5ldyBEb21TY3JvbGxhYmxlRWxlbWVudChjb250ZW50LCB7IHVzZVNoYWRvd3M6IGZhbHNlIH0pO1xuXHRcdGFwcGVuZChwYXJlbnQsIHNjcm9sbGFibGVDb250ZW50LmdldERvbU5vZGUoKSk7XG5cblx0XHRjb25zdCBleHRlbnNpb25zR3JpZFZpZXcgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvbnNHcmlkVmlldywgY29udGVudCwgbmV3IERlbGVnYXRlKCkpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbnM6IElFeHRlbnNpb25bXSA9IGF3YWl0IGdldEV4dGVuc2lvbnMobWFuaWZlc3QuZXh0ZW5zaW9uUGFjayEsIHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UpO1xuXHRcdGV4dGVuc2lvbnNHcmlkVmlldy5zZXRFeHRlbnNpb25zKGV4dGVuc2lvbnMpO1xuXHRcdHNjcm9sbGFibGVDb250ZW50LnNjYW5Eb21Ob2RlKCk7XG5cblx0XHR0aGlzLmNvbnRlbnREaXNwb3NhYmxlcy5hZGQoc2Nyb2xsYWJsZUNvbnRlbnQpO1xuXHRcdHRoaXMuY29udGVudERpc3Bvc2FibGVzLmFkZChleHRlbnNpb25zR3JpZFZpZXcpO1xuXHRcdHRoaXMuY29udGVudERpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoYXJyYXlzLmluc2VydCh0aGlzLmxheW91dFBhcnRpY2lwYW50cywgeyBsYXlvdXQ6ICgpID0+IHNjcm9sbGFibGVDb250ZW50LnNjYW5Eb21Ob2RlKCkgfSkpKTtcblxuXHRcdHJldHVybiBjb250ZW50O1xuXHR9XG5cblx0cHJpdmF0ZSBsb2FkQ29udGVudHM8VD4obG9hZGluZ1Rhc2s6ICgpID0+IENhY2hlUmVzdWx0PFQ+LCBjb250YWluZXI6IEhUTUxFbGVtZW50KTogUHJvbWlzZTxUPiB7XG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2xvYWRpbmcnKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuY29udGVudERpc3Bvc2FibGVzLmFkZChsb2FkaW5nVGFzaygpKTtcblx0XHRjb25zdCBvbkRvbmUgPSAoKSA9PiBjb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZSgnbG9hZGluZycpO1xuXHRcdHJlc3VsdC5wcm9taXNlLnRoZW4ob25Eb25lLCBvbkRvbmUpO1xuXG5cdFx0cmV0dXJuIHJlc3VsdC5wcm9taXNlO1xuXHR9XG5cblx0bGF5b3V0KGRpbWVuc2lvbjogRGltZW5zaW9uKTogdm9pZCB7XG5cdFx0dGhpcy5kaW1lbnNpb24gPSBkaW1lbnNpb247XG5cdFx0dGhpcy5sYXlvdXRQYXJ0aWNpcGFudHMuZm9yRWFjaChwID0+IHAubGF5b3V0KCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkVycm9yKGVycjogYW55KTogdm9pZCB7XG5cdFx0aWYgKGlzQ2FuY2VsbGF0aW9uRXJyb3IoZXJyKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihlcnIpO1xuXHR9XG59XG5cbmNsYXNzIEFkZGl0aW9uYWxEZXRhaWxzV2lkZ2V0IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdGV4dGVuc2lvbjogSUV4dGVuc2lvbixcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlc1NlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSxcblx0XHRASVJlbW90ZUFnZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHJlbW90ZUFnZW50U2VydmljZTogSVJlbW90ZUFnZW50U2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2U6IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSxcblx0XHRASUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlOiBJRXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnJlbmRlcihleHRlbnNpb24pO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub25DaGFuZ2UoZSA9PiB7XG5cdFx0XHRpZiAoZSAmJiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIGV4dGVuc2lvbi5pZGVudGlmaWVyKSAmJiBlLnNlcnZlciA9PT0gZXh0ZW5zaW9uLnNlcnZlcikge1xuXHRcdFx0XHR0aGlzLnJlbmRlcihlKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlcihleHRlbnNpb246IElFeHRlbnNpb24pOiB2b2lkIHtcblx0XHR0aGlzLmNvbnRhaW5lci5pbm5lclRleHQgPSAnJztcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHRpZiAoZXh0ZW5zaW9uLmxvY2FsKSB7XG5cdFx0XHR0aGlzLnJlbmRlckluc3RhbGxJbmZvKHRoaXMuY29udGFpbmVyLCBleHRlbnNpb24ubG9jYWwpO1xuXHRcdH1cblx0XHRpZiAoZXh0ZW5zaW9uLmdhbGxlcnkpIHtcblx0XHRcdHRoaXMucmVuZGVyTWFya2V0cGxhY2VJbmZvKHRoaXMuY29udGFpbmVyLCBleHRlbnNpb24pO1xuXHRcdH1cblx0XHR0aGlzLnJlbmRlckNhdGVnb3JpZXModGhpcy5jb250YWluZXIsIGV4dGVuc2lvbik7XG5cdFx0dGhpcy5yZW5kZXJFeHRlbnNpb25SZXNvdXJjZXModGhpcy5jb250YWluZXIsIGV4dGVuc2lvbik7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckNhdGVnb3JpZXMoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uKTogdm9pZCB7XG5cdFx0aWYgKGV4dGVuc2lvbi5jYXRlZ29yaWVzLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgY2F0ZWdvcmllc0NvbnRhaW5lciA9IGFwcGVuZChjb250YWluZXIsICQoJy5jYXRlZ29yaWVzLWNvbnRhaW5lci5hZGRpdGlvbmFsLWRldGFpbHMtZWxlbWVudCcpKTtcblx0XHRcdGFwcGVuZChjYXRlZ29yaWVzQ29udGFpbmVyLCAkKCcuYWRkaXRpb25hbC1kZXRhaWxzLXRpdGxlJywgdW5kZWZpbmVkLCBsb2NhbGl6ZSgnY2F0ZWdvcmllcycsIFwiQ2F0ZWdvcmllc1wiKSkpO1xuXHRcdFx0Y29uc3QgY2F0ZWdvcmllc0VsZW1lbnQgPSBhcHBlbmQoY2F0ZWdvcmllc0NvbnRhaW5lciwgJCgnLmNhdGVnb3JpZXMnKSk7XG5cdFx0XHR0aGlzLmV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UuZ2V0RXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0KClcblx0XHRcdFx0LnRoZW4obWFuaWZlc3QgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGhhc0NhdGVnb3J5RmlsdGVyID0gbWFuaWZlc3Q/LmNhcGFiaWxpdGllcy5leHRlbnNpb25RdWVyeS5maWx0ZXJpbmc/LnNvbWUoKHsgbmFtZSB9KSA9PiBuYW1lID09PSBGaWx0ZXJUeXBlLkNhdGVnb3J5KTtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGNhdGVnb3J5IG9mIGV4dGVuc2lvbi5jYXRlZ29yaWVzKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBjYXRlZ29yeUVsZW1lbnQgPSBhcHBlbmQoY2F0ZWdvcmllc0VsZW1lbnQsICQoJ3NwYW4uY2F0ZWdvcnknLCB7IHRhYmluZGV4OiAnMCcgfSwgY2F0ZWdvcnkpKTtcblx0XHRcdFx0XHRcdGlmIChoYXNDYXRlZ29yeUZpbHRlcikge1xuXHRcdFx0XHRcdFx0XHRjYXRlZ29yeUVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnY2xpY2thYmxlJyk7XG5cdFx0XHRcdFx0XHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKG9uQ2xpY2soY2F0ZWdvcnlFbGVtZW50LCAoKSA9PiB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLm9wZW5TZWFyY2goYEBjYXRlZ29yeTpcIiR7Y2F0ZWdvcnl9XCJgKSkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJFeHRlbnNpb25SZXNvdXJjZXMoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uKTogdm9pZCB7XG5cdFx0Y29uc3QgcmVzb3VyY2VzOiBbc3RyaW5nLCBVUkldW10gPSBbXTtcblx0XHRpZiAoZXh0ZW5zaW9uLnVybCkge1xuXHRcdFx0cmVzb3VyY2VzLnB1c2goW2xvY2FsaXplKCdNYXJrZXRwbGFjZScsIFwiTWFya2V0cGxhY2VcIiksIFVSSS5wYXJzZShleHRlbnNpb24udXJsKV0pO1xuXHRcdH1cblx0XHRpZiAoZXh0ZW5zaW9uLnN1cHBvcnRVcmwpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHJlc291cmNlcy5wdXNoKFtsb2NhbGl6ZSgnaXNzdWVzJywgXCJJc3N1ZXNcIiksIFVSSS5wYXJzZShleHRlbnNpb24uc3VwcG9ydFVybCldKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7LyogSWdub3JlICovIH1cblx0XHR9XG5cdFx0aWYgKGV4dGVuc2lvbi5yZXBvc2l0b3J5KSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRyZXNvdXJjZXMucHVzaChbbG9jYWxpemUoJ3JlcG9zaXRvcnknLCBcIlJlcG9zaXRvcnlcIiksIFVSSS5wYXJzZShleHRlbnNpb24ucmVwb3NpdG9yeSldKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7LyogSWdub3JlICovIH1cblx0XHR9XG5cdFx0aWYgKGV4dGVuc2lvbi5saWNlbnNlVXJsKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRyZXNvdXJjZXMucHVzaChbbG9jYWxpemUoJ2xpY2Vuc2UnLCBcIkxpY2Vuc2VcIiksIFVSSS5wYXJzZShleHRlbnNpb24ubGljZW5zZVVybCldKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7LyogSWdub3JlICovIH1cblx0XHR9XG5cdFx0aWYgKGV4dGVuc2lvbi5wdWJsaXNoZXJVcmwpIHtcblx0XHRcdHJlc291cmNlcy5wdXNoKFtleHRlbnNpb24ucHVibGlzaGVyRGlzcGxheU5hbWUsIGV4dGVuc2lvbi5wdWJsaXNoZXJVcmxdKTtcblx0XHR9XG5cdFx0aWYgKHJlc291cmNlcy5sZW5ndGggfHwgZXh0ZW5zaW9uLnB1Ymxpc2hlclNwb25zb3JMaW5rKSB7XG5cdFx0XHRjb25zdCBleHRlbnNpb25SZXNvdXJjZXNDb250YWluZXIgPSBhcHBlbmQoY29udGFpbmVyLCAkKCcucmVzb3VyY2VzLWNvbnRhaW5lci5hZGRpdGlvbmFsLWRldGFpbHMtZWxlbWVudCcpKTtcblx0XHRcdGFwcGVuZChleHRlbnNpb25SZXNvdXJjZXNDb250YWluZXIsICQoJy5hZGRpdGlvbmFsLWRldGFpbHMtdGl0bGUnLCB1bmRlZmluZWQsIGxvY2FsaXplKCdyZXNvdXJjZXMnLCBcIlJlc291cmNlc1wiKSkpO1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VzRWxlbWVudCA9IGFwcGVuZChleHRlbnNpb25SZXNvdXJjZXNDb250YWluZXIsICQoJy5yZXNvdXJjZXMnKSk7XG5cdFx0XHRmb3IgKGNvbnN0IFtsYWJlbCwgdXJpXSBvZiByZXNvdXJjZXMpIHtcblx0XHRcdFx0Y29uc3QgcmVzb3VyY2UgPSBhcHBlbmQocmVzb3VyY2VzRWxlbWVudCwgJCgnYS5yZXNvdXJjZScsIHsgdGFiaW5kZXg6ICcwJyB9LCBsYWJlbCkpO1xuXHRcdFx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZChvbkNsaWNrKHJlc291cmNlLCAoKSA9PiB0aGlzLm9wZW5lclNlcnZpY2Uub3Blbih1cmkpKSk7XG5cdFx0XHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCByZXNvdXJjZSwgdXJpLnRvU3RyaW5nKCkpKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckluc3RhbGxJbmZvKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uKTogdm9pZCB7XG5cdFx0Y29uc3QgaW5zdGFsbEluZm9Db250YWluZXIgPSBhcHBlbmQoY29udGFpbmVyLCAkKCcubW9yZS1pbmZvLWNvbnRhaW5lci5hZGRpdGlvbmFsLWRldGFpbHMtZWxlbWVudCcpKTtcblx0XHRhcHBlbmQoaW5zdGFsbEluZm9Db250YWluZXIsICQoJy5hZGRpdGlvbmFsLWRldGFpbHMtdGl0bGUnLCB1bmRlZmluZWQsIGxvY2FsaXplKCdJbnN0YWxsIEluZm8nLCBcIkluc3RhbGxhdGlvblwiKSkpO1xuXHRcdGNvbnN0IGluc3RhbGxJbmZvID0gYXBwZW5kKGluc3RhbGxJbmZvQ29udGFpbmVyLCAkKCcubW9yZS1pbmZvJykpO1xuXHRcdGFwcGVuZChpbnN0YWxsSW5mbyxcblx0XHRcdCQoJy5tb3JlLWluZm8tZW50cnknLCB1bmRlZmluZWQsXG5cdFx0XHRcdCQoJ2Rpdi5tb3JlLWluZm8tZW50cnktbmFtZScsIHVuZGVmaW5lZCwgbG9jYWxpemUoJ2lkJywgXCJJZGVudGlmaWVyXCIpKSxcblx0XHRcdFx0JCgnY29kZScsIHVuZGVmaW5lZCwgZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQpXG5cdFx0XHQpKTtcblx0XHRpZiAoZXh0ZW5zaW9uLnR5cGUgIT09IEV4dGVuc2lvblR5cGUuU3lzdGVtKSB7XG5cdFx0XHRhcHBlbmQoaW5zdGFsbEluZm8sXG5cdFx0XHRcdCQoJy5tb3JlLWluZm8tZW50cnknLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0JCgnZGl2Lm1vcmUtaW5mby1lbnRyeS1uYW1lJywgdW5kZWZpbmVkLCBsb2NhbGl6ZSgnVmVyc2lvbicsIFwiVmVyc2lvblwiKSksXG5cdFx0XHRcdFx0JCgnY29kZScsIHVuZGVmaW5lZCwgZXh0ZW5zaW9uLm1hbmlmZXN0LnZlcnNpb24pXG5cdFx0XHRcdClcblx0XHRcdCk7XG5cdFx0fVxuXHRcdGlmIChleHRlbnNpb24uaW5zdGFsbGVkVGltZXN0YW1wKSB7XG5cdFx0XHRhcHBlbmQoaW5zdGFsbEluZm8sXG5cdFx0XHRcdCQoJy5tb3JlLWluZm8tZW50cnknLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0JCgnZGl2Lm1vcmUtaW5mby1lbnRyeS1uYW1lJywgdW5kZWZpbmVkLCBsb2NhbGl6ZSgnbGFzdCB1cGRhdGVkJywgXCJMYXN0IFVwZGF0ZWRcIikpLFxuXHRcdFx0XHRcdCQoJ2RpdicsIHVuZGVmaW5lZCwgdG9EYXRlU3RyaW5nKG5ldyBEYXRlKGV4dGVuc2lvbi5pbnN0YWxsZWRUaW1lc3RhbXApKSlcblx0XHRcdFx0KVxuXHRcdFx0KTtcblx0XHR9XG5cdFx0aWYgKCFleHRlbnNpb24uaXNCdWlsdGluICYmIGV4dGVuc2lvbi5zb3VyY2UgIT09ICdnYWxsZXJ5Jykge1xuXHRcdFx0Y29uc3QgZWxlbWVudCA9ICQoJ2RpdicsIHVuZGVmaW5lZCwgZXh0ZW5zaW9uLnNvdXJjZSA9PT0gJ3ZzaXgnID8gbG9jYWxpemUoJ3ZzaXgnLCBcIlZTSVhcIikgOiBsb2NhbGl6ZSgnb3RoZXInLCBcIkxvY2FsXCIpKTtcblx0XHRcdGFwcGVuZChpbnN0YWxsSW5mbyxcblx0XHRcdFx0JCgnLm1vcmUtaW5mby1lbnRyeScsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHQkKCdkaXYubW9yZS1pbmZvLWVudHJ5LW5hbWUnLCB1bmRlZmluZWQsIGxvY2FsaXplKCdzb3VyY2UnLCBcIlNvdXJjZVwiKSksXG5cdFx0XHRcdFx0ZWxlbWVudFxuXHRcdFx0XHQpXG5cdFx0XHQpO1xuXHRcdFx0aWYgKGlzTmF0aXZlICYmIGV4dGVuc2lvbi5zb3VyY2UgPT09ICdyZXNvdXJjZScgJiYgZXh0ZW5zaW9uLmxvY2F0aW9uLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHRcdGVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnbGluaycpO1xuXHRcdFx0XHRlbGVtZW50LnRpdGxlID0gZXh0ZW5zaW9uLmxvY2F0aW9uLmZzUGF0aDtcblx0XHRcdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQob25DbGljayhlbGVtZW50LCAoKSA9PiB0aGlzLm9wZW5lclNlcnZpY2Uub3BlbihleHRlbnNpb24ubG9jYXRpb24sIHsgb3BlbkV4dGVybmFsOiB0cnVlIH0pKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChleHRlbnNpb24uc2l6ZSkge1xuXHRcdFx0Y29uc3QgZWxlbWVudCA9ICQoJ2RpdicsIHVuZGVmaW5lZCwgQnl0ZVNpemUuZm9ybWF0U2l6ZShleHRlbnNpb24uc2l6ZSkpO1xuXHRcdFx0YXBwZW5kKGluc3RhbGxJbmZvLFxuXHRcdFx0XHQkKCcubW9yZS1pbmZvLWVudHJ5JywgdW5kZWZpbmVkLFxuXHRcdFx0XHRcdCQoJ2Rpdi5tb3JlLWluZm8tZW50cnktbmFtZScsIHsgdGl0bGU6IGxvY2FsaXplKCdzaXplIHdoZW4gaW5zdGFsbGVkJywgXCJTaXplIHdoZW4gaW5zdGFsbGVkXCIpIH0sIGxvY2FsaXplKCdzaXplJywgXCJTaXplXCIpKSxcblx0XHRcdFx0XHRlbGVtZW50XG5cdFx0XHRcdClcblx0XHRcdCk7XG5cdFx0XHRpZiAoaXNOYXRpdmUgJiYgZXh0ZW5zaW9uLmxvY2F0aW9uLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHRcdGVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnbGluaycpO1xuXHRcdFx0XHRlbGVtZW50LnRpdGxlID0gZXh0ZW5zaW9uLmxvY2F0aW9uLmZzUGF0aDtcblx0XHRcdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQob25DbGljayhlbGVtZW50LCAoKSA9PiB0aGlzLm9wZW5lclNlcnZpY2Uub3BlbihleHRlbnNpb24ubG9jYXRpb24sIHsgb3BlbkV4dGVybmFsOiB0cnVlIH0pKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuZ2V0Q2FjaGVMb2NhdGlvbihleHRlbnNpb24pLnRoZW4oY2FjaGVMb2NhdGlvbiA9PiB7XG5cdFx0XHRpZiAoIWNhY2hlTG9jYXRpb24pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0Y29tcHV0ZVNpemUoY2FjaGVMb2NhdGlvbiwgdGhpcy5maWxlU2VydmljZSkudGhlbihjYWNoZVNpemUgPT4ge1xuXHRcdFx0XHRpZiAoIWNhY2hlU2l6ZSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBlbGVtZW50ID0gJCgnZGl2JywgdW5kZWZpbmVkLCBCeXRlU2l6ZS5mb3JtYXRTaXplKGNhY2hlU2l6ZSkpO1xuXHRcdFx0XHRhcHBlbmQoaW5zdGFsbEluZm8sXG5cdFx0XHRcdFx0JCgnLm1vcmUtaW5mby1lbnRyeScsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdCQoJ2Rpdi5tb3JlLWluZm8tZW50cnktbmFtZScsIHsgdGl0bGU6IGxvY2FsaXplKCdkaXNrIHNwYWNlIHVzZWQnLCBcIkNhY2hlIHNpemVcIikgfSwgbG9jYWxpemUoJ2NhY2hlIHNpemUnLCBcIkNhY2hlXCIpKSxcblx0XHRcdFx0XHRcdGVsZW1lbnQpXG5cdFx0XHRcdCk7XG5cdFx0XHRcdGlmIChpc05hdGl2ZSAmJiBleHRlbnNpb24ubG9jYXRpb24uc2NoZW1lID09PSBTY2hlbWFzLmZpbGUpIHtcblx0XHRcdFx0XHRlbGVtZW50LmNsYXNzTGlzdC5hZGQoJ2xpbmsnKTtcblx0XHRcdFx0XHRlbGVtZW50LnRpdGxlID0gY2FjaGVMb2NhdGlvbi5mc1BhdGg7XG5cdFx0XHRcdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQob25DbGljayhlbGVtZW50LCAoKSA9PiB0aGlzLm9wZW5lclNlcnZpY2Uub3BlbihjYWNoZUxvY2F0aW9uLndpdGgoeyBzY2hlbWU6IFNjaGVtYXMuZmlsZSB9KSwgeyBvcGVuRXh0ZXJuYWw6IHRydWUgfSkpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldENhY2hlTG9jYXRpb24oZXh0ZW5zaW9uOiBJTG9jYWxFeHRlbnNpb24pOiBQcm9taXNlPFVSSSB8IHVuZGVmaW5lZD4ge1xuXHRcdGxldCBleHRlbnNpb25DYWNoZUxvY2F0aW9uID0gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmpvaW5QYXRoKHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuZ2xvYmFsU3RvcmFnZUhvbWUsIGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLnRvTG93ZXJDYXNlKCkpO1xuXHRcdGlmIChleHRlbnNpb24ubG9jYXRpb24uc2NoZW1lID09PSBTY2hlbWFzLnZzY29kZVJlbW90ZSkge1xuXHRcdFx0Y29uc3QgZW52aXJvbm1lbnQgPSBhd2FpdCB0aGlzLnJlbW90ZUFnZW50U2VydmljZS5nZXRFbnZpcm9ubWVudCgpO1xuXHRcdFx0aWYgKCFlbnZpcm9ubWVudCkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0ZXh0ZW5zaW9uQ2FjaGVMb2NhdGlvbiA9IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5qb2luUGF0aChlbnZpcm9ubWVudC5nbG9iYWxTdG9yYWdlSG9tZSwgZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKSk7XG5cdFx0fVxuXHRcdHJldHVybiBleHRlbnNpb25DYWNoZUxvY2F0aW9uO1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJNYXJrZXRwbGFjZUluZm8oY29udGFpbmVyOiBIVE1MRWxlbWVudCwgZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uKTogdm9pZCB7XG5cdFx0Y29uc3QgZ2FsbGVyeSA9IGV4dGVuc2lvbi5nYWxsZXJ5O1xuXHRcdGNvbnN0IG1vcmVJbmZvQ29udGFpbmVyID0gYXBwZW5kKGNvbnRhaW5lciwgJCgnLm1vcmUtaW5mby1jb250YWluZXIuYWRkaXRpb25hbC1kZXRhaWxzLWVsZW1lbnQnKSk7XG5cdFx0YXBwZW5kKG1vcmVJbmZvQ29udGFpbmVyLCAkKCcuYWRkaXRpb25hbC1kZXRhaWxzLXRpdGxlJywgdW5kZWZpbmVkLCBsb2NhbGl6ZSgnTWFya2V0cGxhY2UgSW5mbycsIFwiTWFya2V0cGxhY2VcIikpKTtcblx0XHRjb25zdCBtb3JlSW5mbyA9IGFwcGVuZChtb3JlSW5mb0NvbnRhaW5lciwgJCgnLm1vcmUtaW5mbycpKTtcblx0XHRpZiAoZ2FsbGVyeSkge1xuXHRcdFx0aWYgKCFleHRlbnNpb24ubG9jYWwpIHtcblx0XHRcdFx0YXBwZW5kKG1vcmVJbmZvLFxuXHRcdFx0XHRcdCQoJy5tb3JlLWluZm8tZW50cnknLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHQkKCdkaXYubW9yZS1pbmZvLWVudHJ5LW5hbWUnLCB1bmRlZmluZWQsIGxvY2FsaXplKCdpZCcsIFwiSWRlbnRpZmllclwiKSksXG5cdFx0XHRcdFx0XHQkKCdjb2RlJywgdW5kZWZpbmVkLCBleHRlbnNpb24uaWRlbnRpZmllci5pZClcblx0XHRcdFx0XHQpKTtcblx0XHRcdFx0YXBwZW5kKG1vcmVJbmZvLFxuXHRcdFx0XHRcdCQoJy5tb3JlLWluZm8tZW50cnknLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHQkKCdkaXYubW9yZS1pbmZvLWVudHJ5LW5hbWUnLCB1bmRlZmluZWQsIGxvY2FsaXplKCdWZXJzaW9uJywgXCJWZXJzaW9uXCIpKSxcblx0XHRcdFx0XHRcdCQoJ2NvZGUnLCB1bmRlZmluZWQsIGdhbGxlcnkudmVyc2lvbilcblx0XHRcdFx0XHQpXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0XHRhcHBlbmQobW9yZUluZm8sXG5cdFx0XHRcdCQoJy5tb3JlLWluZm8tZW50cnknLCB1bmRlZmluZWQsXG5cdFx0XHRcdFx0JCgnZGl2Lm1vcmUtaW5mby1lbnRyeS1uYW1lJywgdW5kZWZpbmVkLCBsb2NhbGl6ZSgncHVibGlzaGVkJywgXCJQdWJsaXNoZWRcIikpLFxuXHRcdFx0XHRcdCQoJ2RpdicsIHVuZGVmaW5lZCwgdG9EYXRlU3RyaW5nKG5ldyBEYXRlKGdhbGxlcnkucmVsZWFzZURhdGUpKSlcblx0XHRcdFx0KSxcblx0XHRcdFx0JCgnLm1vcmUtaW5mby1lbnRyeScsIHVuZGVmaW5lZCxcblx0XHRcdFx0XHQkKCdkaXYubW9yZS1pbmZvLWVudHJ5LW5hbWUnLCB1bmRlZmluZWQsIGxvY2FsaXplKCdsYXN0IHJlbGVhc2VkJywgXCJMYXN0IFJlbGVhc2VkXCIpKSxcblx0XHRcdFx0XHQkKCdkaXYnLCB1bmRlZmluZWQsIHRvRGF0ZVN0cmluZyhuZXcgRGF0ZShnYWxsZXJ5Lmxhc3RVcGRhdGVkKSkpXG5cdFx0XHRcdClcblx0XHRcdCk7XG5cdFx0fVxuXHR9XG59XG5cbmNvbnN0IGNvbnRleHRLZXlFeHByID0gQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygnYWN0aXZlRWRpdG9yJywgRXh0ZW5zaW9uRWRpdG9yLklEKSwgRWRpdG9yQ29udGV4dEtleXMuZm9jdXMudG9OZWdhdGVkKCkpO1xucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFNob3dFeHRlbnNpb25FZGl0b3JGaW5kQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5leHRlbnNpb25lZGl0b3Iuc2hvd2ZpbmQnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdmaW5kJywgXCJGaW5kXCIpLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3aGVuOiBjb250ZXh0S2V5RXhwcixcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlGLFxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGNvbnN0IGV4dGVuc2lvbkVkaXRvciA9IGdldEV4dGVuc2lvbkVkaXRvcihhY2Nlc3Nvcik7XG5cdFx0ZXh0ZW5zaW9uRWRpdG9yPy5zaG93RmluZCgpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFN0YXJ0RXh0ZW5zaW9uRWRpdG9yRmluZE5leHRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLmV4dGVuc2lvbmVkaXRvci5maW5kTmV4dCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2ZpbmQgbmV4dCcsIFwiRmluZCBOZXh0XCIpLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0Y29udGV4dEtleUV4cHIsXG5cdFx0XHRcdFx0S0VZQklORElOR19DT05URVhUX1dFQlZJRVdfRklORF9XSURHRVRfRk9DVVNFRCksXG5cdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRW50ZXIsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uRWRpdG9yID0gZ2V0RXh0ZW5zaW9uRWRpdG9yKGFjY2Vzc29yKTtcblx0XHRleHRlbnNpb25FZGl0b3I/LnJ1bkZpbmRBY3Rpb24oZmFsc2UpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFN0YXJ0RXh0ZW5zaW9uRWRpdG9yRmluZFByZXZpb3VzQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5leHRlbnNpb25lZGl0b3IuZmluZFByZXZpb3VzJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZmluZCBwcmV2aW91cycsIFwiRmluZCBQcmV2aW91c1wiKSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdGNvbnRleHRLZXlFeHByLFxuXHRcdFx0XHRcdEtFWUJJTkRJTkdfQ09OVEVYVF9XRUJWSUVXX0ZJTkRfV0lER0VUX0ZPQ1VTRUQpLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkVudGVyLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGNvbnN0IGV4dGVuc2lvbkVkaXRvciA9IGdldEV4dGVuc2lvbkVkaXRvcihhY2Nlc3Nvcik7XG5cdFx0ZXh0ZW5zaW9uRWRpdG9yPy5ydW5GaW5kQWN0aW9uKHRydWUpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJUaGVtaW5nUGFydGljaXBhbnQoKHRoZW1lOiBJQ29sb3JUaGVtZSwgY29sbGVjdG9yOiBJQ3NzU3R5bGVDb2xsZWN0b3IpID0+IHtcblxuXHRjb25zdCBsaW5rID0gdGhlbWUuZ2V0Q29sb3IodGV4dExpbmtGb3JlZ3JvdW5kKTtcblx0aWYgKGxpbmspIHtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLm1vbmFjby13b3JrYmVuY2ggLmV4dGVuc2lvbi1lZGl0b3IgLmNvbnRlbnQgLmRldGFpbHMgLmFkZGl0aW9uYWwtZGV0YWlscy1jb250YWluZXIgLnJlc291cmNlcy1jb250YWluZXIgYS5yZXNvdXJjZSB7IGNvbG9yOiAke2xpbmt9OyB9YCk7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYC5tb25hY28td29ya2JlbmNoIC5leHRlbnNpb24tZWRpdG9yIC5jb250ZW50IC5mZWF0dXJlLWNvbnRyaWJ1dGlvbnMgYSB7IGNvbG9yOiAke2xpbmt9OyB9YCk7XG5cdH1cblxuXHRjb25zdCBhY3RpdmVMaW5rID0gdGhlbWUuZ2V0Q29sb3IodGV4dExpbmtBY3RpdmVGb3JlZ3JvdW5kKTtcblx0aWYgKGFjdGl2ZUxpbmspIHtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLm1vbmFjby13b3JrYmVuY2ggLmV4dGVuc2lvbi1lZGl0b3IgLmNvbnRlbnQgLmRldGFpbHMgLmFkZGl0aW9uYWwtZGV0YWlscy1jb250YWluZXIgLnJlc291cmNlcy1jb250YWluZXIgYS5yZXNvdXJjZTpob3Zlcixcblx0XHRcdC5tb25hY28td29ya2JlbmNoIC5leHRlbnNpb24tZWRpdG9yIC5jb250ZW50IC5kZXRhaWxzIC5hZGRpdGlvbmFsLWRldGFpbHMtY29udGFpbmVyIC5yZXNvdXJjZXMtY29udGFpbmVyIGEucmVzb3VyY2U6YWN0aXZlIHsgY29sb3I6ICR7YWN0aXZlTGlua307IH1gKTtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLm1vbmFjby13b3JrYmVuY2ggLmV4dGVuc2lvbi1lZGl0b3IgLmNvbnRlbnQgLmZlYXR1cmUtY29udHJpYnV0aW9ucyBhOmhvdmVyLFxuXHRcdFx0Lm1vbmFjby13b3JrYmVuY2ggLmV4dGVuc2lvbi1lZGl0b3IgLmNvbnRlbnQgLmZlYXR1cmUtY29udHJpYnV0aW9ucyBhOmFjdGl2ZSB7IGNvbG9yOiAke2FjdGl2ZUxpbmt9OyB9YCk7XG5cdH1cblxuXHRjb25zdCBidXR0b25Ib3ZlckJhY2tncm91bmRDb2xvciA9IHRoZW1lLmdldENvbG9yKGJ1dHRvbkhvdmVyQmFja2dyb3VuZCk7XG5cdGlmIChidXR0b25Ib3ZlckJhY2tncm91bmRDb2xvcikge1xuXHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAubW9uYWNvLXdvcmtiZW5jaCAuZXh0ZW5zaW9uLWVkaXRvciAuY29udGVudCA+IC5kZXRhaWxzID4gLmFkZGl0aW9uYWwtZGV0YWlscy1jb250YWluZXIgLmNhdGVnb3JpZXMtY29udGFpbmVyID4gLmNhdGVnb3JpZXMgPiAuY2F0ZWdvcnkuY2xpY2thYmxlOmhvdmVyIHsgYmFja2dyb3VuZC1jb2xvcjogJHtidXR0b25Ib3ZlckJhY2tncm91bmRDb2xvcn07IGJvcmRlci1jb2xvcjogJHtidXR0b25Ib3ZlckJhY2tncm91bmRDb2xvcn07IH1gKTtcblx0fVxuXG5cdGNvbnN0IGJ1dHRvbkZvcmVncm91bmRDb2xvciA9IHRoZW1lLmdldENvbG9yKGJ1dHRvbkZvcmVncm91bmQpO1xuXHRpZiAoYnV0dG9uRm9yZWdyb3VuZENvbG9yKSB7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYC5tb25hY28td29ya2JlbmNoIC5leHRlbnNpb24tZWRpdG9yIC5jb250ZW50ID4gLmRldGFpbHMgPiAuYWRkaXRpb25hbC1kZXRhaWxzLWNvbnRhaW5lciAuY2F0ZWdvcmllcy1jb250YWluZXIgPiAuY2F0ZWdvcmllcyA+IC5jYXRlZ29yeS5jbGlja2FibGU6aG92ZXIgeyBjb2xvcjogJHtidXR0b25Gb3JlZ3JvdW5kQ29sb3J9OyB9YCk7XG5cdH1cblxufSk7XG5cbmZ1bmN0aW9uIGdldEV4dGVuc2lvbkVkaXRvcihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IEV4dGVuc2lvbkVkaXRvciB8IG51bGwge1xuXHRjb25zdCBhY3RpdmVFZGl0b3JQYW5lID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKS5hY3RpdmVFZGl0b3JQYW5lO1xuXHRpZiAoYWN0aXZlRWRpdG9yUGFuZSBpbnN0YW5jZW9mIEV4dGVuc2lvbkVkaXRvcikge1xuXHRcdHJldHVybiBhY3RpdmVFZGl0b3JQYW5lO1xuXHR9XG5cdHJldHVybiBudWxsO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLEdBQWMsdUJBQXVCLFFBQVEsTUFBTSxpQkFBaUIsWUFBWTtBQUN6RixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLCtCQUErQjtBQUN4QyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLGNBQXVCO0FBQ2hDLFlBQVksWUFBWTtBQUN4QixTQUFTLGFBQTBCO0FBQ25DLFNBQVMsbUJBQW1CLCtCQUErQjtBQUMzRCxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLFNBQVMsY0FBYztBQUNoQyxTQUFTLFlBQVksaUJBQWlCLG1CQUFtQixTQUFTLG9CQUFvQjtBQUN0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O0FBQUEsTUFDeEMsWUFBWTtBQUFBLFFBQ1gsTUFBTSxlQUFlO0FBQUEsVUFDcEI7QUFBQSxVQUNBO0FBQUEsUUFBOEM7QUFBQSxRQUMvQyxTQUFTLFFBQVE7QUFBQSxRQUNqQixRQUFRLGlCQUFpQjtBQUFBLE1BQzFCO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBQ0EsSUFBSSxVQUFrQztBQUNyQyxVQUFNLGtCQUFrQixtQkFBbUIsUUFBUTtBQUNuRCxxQkFBaUIsY0FBYyxLQUFLO0FBQUEsRUFDckM7QUFDRCxDQUFDO0FBRUQsZ0JBQWdCLE1BQU0sK0NBQStDLFFBQVE7QUFBQSxFQUM1RSxjQUFjO0FBQ2IsVUFBTTtBQUFBLE1BQ0wsSUFBSTtBQUFBLE1BQ0osT0FBTyxTQUFTLGlCQUFpQixlQUFlO0FBQUEsTUFDaEQsWUFBWTtBQUFBLFFBQ1gsTUFBTSxlQUFlO0FBQUEsVUFDcEI7QUFBQSxVQUNBO0FBQUEsUUFBOEM7QUFBQSxRQUMvQyxTQUFTLE9BQU8sUUFBUSxRQUFRO0FBQUEsUUFDaEMsUUFBUSxpQkFBaUI7QUFBQSxNQUMxQjtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUNBLElBQUksVUFBa0M7QUFDckMsVUFBTSxrQkFBa0IsbUJBQW1CLFFBQVE7QUFDbkQscUJBQWlCLGNBQWMsSUFBSTtBQUFBLEVBQ3BDO0FBQ0QsQ0FBQztBQUVELDJCQUEyQixDQUFDLE9BQW9CLGNBQWtDO0FBRWpGLFFBQU0sT0FBTyxNQUFNLFNBQVMsa0JBQWtCO0FBQzlDLE1BQUksTUFBTTtBQUNULGNBQVUsUUFBUSxnSUFBZ0ksSUFBSSxLQUFLO0FBQzNKLGNBQVUsUUFBUSxrRkFBa0YsSUFBSSxLQUFLO0FBQUEsRUFDOUc7QUFFQSxRQUFNLGFBQWEsTUFBTSxTQUFTLHdCQUF3QjtBQUMxRCxNQUFJLFlBQVk7QUFDZixjQUFVLFFBQVE7QUFBQSx5SUFDcUgsVUFBVSxLQUFLO0FBQ3RKLGNBQVUsUUFBUTtBQUFBLDJGQUN1RSxVQUFVLEtBQUs7QUFBQSxFQUN6RztBQUVBLFFBQU0sNkJBQTZCLE1BQU0sU0FBUyxxQkFBcUI7QUFDdkUsTUFBSSw0QkFBNEI7QUFDL0IsY0FBVSxRQUFRLCtLQUErSywwQkFBMEIsbUJBQW1CLDBCQUEwQixLQUFLO0FBQUEsRUFDOVE7QUFFQSxRQUFNLHdCQUF3QixNQUFNLFNBQVMsZ0JBQWdCO0FBQzdELE1BQUksdUJBQXVCO0FBQzFCLGNBQVUsUUFBUSxvS0FBb0sscUJBQXFCLEtBQUs7QUFBQSxFQUNqTjtBQUVELENBQUM7QUFFRCxTQUFTLG1CQUFtQixVQUFvRDtBQUMvRSxRQUFNLG1CQUFtQixTQUFTLElBQUksY0FBYyxFQUFFO0FBQ3RELE1BQUksNEJBQTRCLGlCQUFpQjtBQUNoRCxXQUFPO0FBQUEsRUFDUjtBQUNBLFNBQU87QUFDUjsiLAogICJuYW1lcyI6IFsiYWN0aW9uIiwgIldlYnZpZXdJbmRleCIsICIkIiwgImJvZHkiLCAiZXh0ZW5zaW9uIl0KfQo=
