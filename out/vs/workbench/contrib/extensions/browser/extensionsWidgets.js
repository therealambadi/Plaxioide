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
import "./media/extensionsWidgets.css";
import * as semver from "../../../../base/common/semver/semver.js";
import { Disposable, toDisposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { IExtensionsWorkbenchService, ExtensionState, ExtensionEditorTab } from "../common/extensions.js";
import { append, $, reset, addDisposableListener, EventType, finalHandler } from "../../../../base/browser/dom.js";
import * as platform from "../../../../base/common/platform.js";
import { localize } from "../../../../nls.js";
import { IExtensionManagementServerService } from "../../../services/extensionManagement/common/extensionManagement.js";
import { IExtensionIgnoredRecommendationsService, IExtensionRecommendationsService } from "../../../services/extensionRecommendations/common/extensionRecommendations.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { extensionButtonProminentBackground } from "./extensionsActions.js";
import { IThemeService, registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { EXTENSION_BADGE_REMOTE_BACKGROUND, EXTENSION_BADGE_REMOTE_FOREGROUND } from "../../../common/theme.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { CountBadge } from "../../../../base/browser/ui/countBadge/countBadge.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IUserDataSyncEnablementService } from "../../../../platform/userDataSync/common/userDataSync.js";
import { activationTimeIcon, errorIcon, infoIcon, installCountIcon, preReleaseIcon, privateExtensionIcon, ratingIcon, remoteIcon, sponsorIcon, starEmptyIcon, starFullIcon, starHalfIcon, syncIgnoredIcon, warningIcon } from "./extensionsIcons.js";
import { registerColor, textLinkForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { URI } from "../../../../base/common/uri.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { areSameExtensions } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import Severity from "../../../../base/common/severity.js";
import { Color } from "../../../../base/common/color.js";
import { renderMarkdown } from "../../../../base/browser/markdownRenderer.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { renderIcon } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { defaultCountBadgeStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions, IExtensionFeaturesManagementService } from "../../../services/extensionManagement/common/extensionFeatures.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { extensionVerifiedPublisherIconColor, verifiedPublisherIcon } from "../../../services/extensionManagement/common/extensionsIcons.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IExplorerService } from "../../files/browser/files.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { VIEW_ID as EXPLORER_VIEW_ID } from "../../files/common/files.js";
class ExtensionWidget extends Disposable {
  constructor() {
    super(...arguments);
    this._extension = null;
  }
  get extension() {
    return this._extension;
  }
  set extension(extension) {
    this._extension = extension;
    this.update();
  }
  update() {
    this.render();
  }
}
function onClick(element, callback) {
  const disposables = new DisposableStore();
  disposables.add(addDisposableListener(element, EventType.CLICK, finalHandler(callback)));
  disposables.add(addDisposableListener(element, EventType.KEY_UP, (e) => {
    const keyboardEvent = new StandardKeyboardEvent(e);
    if (keyboardEvent.equals(KeyCode.Space) || keyboardEvent.equals(KeyCode.Enter)) {
      e.preventDefault();
      e.stopPropagation();
      callback();
    }
  }));
  return disposables;
}
let InstallCountWidget = class extends ExtensionWidget {
  constructor(container, small, hoverService) {
    super();
    this.container = container;
    this.small = small;
    this.hoverService = hoverService;
    this.disposables = this._register(new DisposableStore());
    this.render();
    this._register(toDisposable(() => this.clear()));
  }
  clear() {
    this.container.innerText = "";
    this.disposables.clear();
  }
  render() {
    this.clear();
    if (!this.extension) {
      return;
    }
    if (this.small && this.extension.state !== ExtensionState.Uninstalled) {
      return;
    }
    const installLabel = InstallCountWidget.getInstallLabel(this.extension, this.small);
    if (!installLabel) {
      return;
    }
    const parent = this.small ? this.container : append(this.container, $("span.install", { tabIndex: 0 }));
    append(parent, $("span" + ThemeIcon.asCSSSelector(installCountIcon)));
    const count = append(parent, $("span.count"));
    count.textContent = installLabel;
    if (!this.small) {
      this.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.container, localize("install count", "Install count")));
    }
  }
  static getInstallLabel(extension, small) {
    const installCount = extension.installCount;
    if (!installCount) {
      return void 0;
    }
    let installLabel;
    if (small) {
      if (installCount > 1e6) {
        installLabel = `${Math.floor(installCount / 1e5) / 10}M`;
      } else if (installCount > 1e3) {
        installLabel = `${Math.floor(installCount / 1e3)}K`;
      } else {
        installLabel = String(installCount);
      }
    } else {
      installLabel = installCount.toLocaleString(platform.language);
    }
    return installLabel;
  }
};
InstallCountWidget = __decorateClass([
  __decorateParam(2, IHoverService)
], InstallCountWidget);
let RatingsWidget = class extends ExtensionWidget {
  constructor(container, small, hoverService, openerService) {
    super();
    this.container = container;
    this.small = small;
    this.hoverService = hoverService;
    this.openerService = openerService;
    this.disposables = this._register(new DisposableStore());
    container.classList.add("extension-ratings");
    if (this.small) {
      container.classList.add("small");
    }
    this.render();
    this._register(toDisposable(() => this.clear()));
  }
  clear() {
    this.container.innerText = "";
    this.disposables.clear();
  }
  render() {
    this.clear();
    if (!this.extension) {
      return;
    }
    if (this.small && this.extension.state !== ExtensionState.Uninstalled) {
      return;
    }
    if (this.extension.rating === void 0) {
      return;
    }
    if (this.small && !this.extension.ratingCount) {
      return;
    }
    if (!this.extension.url) {
      return;
    }
    const rating = Math.round(this.extension.rating * 2) / 2;
    if (this.small) {
      append(this.container, $("span" + ThemeIcon.asCSSSelector(starFullIcon)));
      const count = append(this.container, $("span.count"));
      count.textContent = String(rating);
    } else {
      const element = append(this.container, $("span.rating.clickable", { tabIndex: 0 }));
      for (let i = 1; i <= 5; i++) {
        if (rating >= i) {
          append(element, $("span" + ThemeIcon.asCSSSelector(starFullIcon)));
        } else if (rating >= i - 0.5) {
          append(element, $("span" + ThemeIcon.asCSSSelector(starHalfIcon)));
        } else {
          append(element, $("span" + ThemeIcon.asCSSSelector(starEmptyIcon)));
        }
      }
      if (this.extension.ratingCount) {
        const ratingCountElemet = append(element, $("span", void 0, ` (${this.extension.ratingCount})`));
        ratingCountElemet.style.paddingLeft = "1px";
      }
      this.containerHover = this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), element, ""));
      this.containerHover.update(localize("ratedLabel", "Average rating: {0} out of 5", rating));
      element.setAttribute("role", "link");
      if (this.extension.ratingUrl) {
        this.disposables.add(onClick(element, () => this.openerService.open(URI.parse(this.extension.ratingUrl))));
      }
    }
  }
};
RatingsWidget = __decorateClass([
  __decorateParam(2, IHoverService),
  __decorateParam(3, IOpenerService)
], RatingsWidget);
let PublisherWidget = class extends ExtensionWidget {
  constructor(container, small, extensionsWorkbenchService, hoverService, openerService) {
    super();
    this.container = container;
    this.small = small;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.hoverService = hoverService;
    this.openerService = openerService;
    this.disposables = this._register(new DisposableStore());
    this.render();
    this._register(toDisposable(() => this.clear()));
  }
  clear() {
    this.element?.remove();
    this.disposables.clear();
  }
  render() {
    this.clear();
    if (!this.extension) {
      return;
    }
    if (this.extension.resourceExtension) {
      return;
    }
    if (this.extension.local?.source === "resource") {
      return;
    }
    this.element = append(this.container, $(".publisher"));
    const publisherDisplayName = $(".publisher-name.ellipsis");
    publisherDisplayName.textContent = this.extension.publisherDisplayName;
    const verifiedPublisher = $(".verified-publisher");
    append(verifiedPublisher, $("span.extension-verified-publisher.clickable"), renderIcon(verifiedPublisherIcon));
    if (this.small) {
      if (this.extension.publisherDomain) {
        append(this.element, verifiedPublisher);
      }
      append(this.element, publisherDisplayName);
    } else {
      this.element.classList.toggle("clickable", !!this.extension.url);
      this.element.setAttribute("role", "button");
      this.element.tabIndex = 0;
      this.containerHover = this.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.element, localize("publisher", "Publisher ({0})", this.extension.publisherDisplayName)));
      append(this.element, publisherDisplayName);
      if (this.extension.publisherDomain) {
        append(this.element, verifiedPublisher);
        const publisherDomainLink = URI.parse(this.extension.publisherDomain.link);
        verifiedPublisher.tabIndex = 0;
        verifiedPublisher.setAttribute("role", "button");
        this.containerHover.update(localize("verified publisher", "This publisher has verified ownership of {0}", this.extension.publisherDomain.link));
        verifiedPublisher.setAttribute("role", "link");
        append(verifiedPublisher, $("span.extension-verified-publisher-domain", void 0, publisherDomainLink.authority.startsWith("www.") ? publisherDomainLink.authority.substring(4) : publisherDomainLink.authority));
        this.disposables.add(onClick(verifiedPublisher, () => this.openerService.open(publisherDomainLink)));
      }
      if (this.extension.url) {
        this.disposables.add(onClick(this.element, () => this.extensionsWorkbenchService.openSearch(`publisher:"${this.extension?.publisherDisplayName}"`)));
      }
    }
  }
};
PublisherWidget = __decorateClass([
  __decorateParam(2, IExtensionsWorkbenchService),
  __decorateParam(3, IHoverService),
  __decorateParam(4, IOpenerService)
], PublisherWidget);
let SponsorWidget = class extends ExtensionWidget {
  constructor(container, hoverService, openerService) {
    super();
    this.container = container;
    this.hoverService = hoverService;
    this.openerService = openerService;
    this.disposables = this._register(new DisposableStore());
    this.render();
  }
  render() {
    reset(this.container);
    this.disposables.clear();
    if (!this.extension?.publisherSponsorLink) {
      return;
    }
    const sponsor = append(this.container, $("span.sponsor.clickable", { tabIndex: 0 }));
    this.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), sponsor, this.extension?.publisherSponsorLink.toString() ?? ""));
    sponsor.setAttribute("role", "link");
    const sponsorIconElement = renderIcon(sponsorIcon);
    const label = $("span", void 0, localize("sponsor", "Sponsor"));
    append(sponsor, sponsorIconElement, label);
    this.disposables.add(onClick(sponsor, () => {
      this.openerService.open(this.extension.publisherSponsorLink);
    }));
  }
};
SponsorWidget = __decorateClass([
  __decorateParam(1, IHoverService),
  __decorateParam(2, IOpenerService)
], SponsorWidget);
let RecommendationWidget = class extends ExtensionWidget {
  constructor(parent, extensionRecommendationsService) {
    super();
    this.parent = parent;
    this.extensionRecommendationsService = extensionRecommendationsService;
    this.disposables = this._register(new DisposableStore());
    this.render();
    this._register(toDisposable(() => this.clear()));
    this._register(this.extensionRecommendationsService.onDidChangeRecommendations(() => this.render()));
  }
  clear() {
    this.element?.remove();
    this.element = void 0;
    this.disposables.clear();
  }
  render() {
    this.clear();
    if (!this.extension || this.extension.state === ExtensionState.Installed || this.extension.deprecationInfo) {
      return;
    }
    const extRecommendations = this.extensionRecommendationsService.getAllRecommendationsWithReason();
    if (extRecommendations[this.extension.identifier.id.toLowerCase()]) {
      this.element = append(this.parent, $("div.extension-bookmark"));
      const recommendation = append(this.element, $(".recommendation"));
      append(recommendation, $("span" + ThemeIcon.asCSSSelector(ratingIcon)));
    }
  }
};
RecommendationWidget = __decorateClass([
  __decorateParam(1, IExtensionRecommendationsService)
], RecommendationWidget);
class PreReleaseBookmarkWidget extends ExtensionWidget {
  constructor(parent) {
    super();
    this.parent = parent;
    this.disposables = this._register(new DisposableStore());
    this.render();
    this._register(toDisposable(() => this.clear()));
  }
  clear() {
    this.element?.remove();
    this.element = void 0;
    this.disposables.clear();
  }
  render() {
    this.clear();
    if (this.extension?.state === ExtensionState.Installed ? this.extension.preRelease : this.extension?.hasPreReleaseVersion) {
      this.element = append(this.parent, $("div.extension-bookmark"));
      const preRelease = append(this.element, $(".pre-release"));
      append(preRelease, $("span" + ThemeIcon.asCSSSelector(preReleaseIcon)));
    }
  }
}
let RemoteBadgeWidget = class extends ExtensionWidget {
  constructor(parent, tooltip, extensionManagementServerService, instantiationService) {
    super();
    this.tooltip = tooltip;
    this.extensionManagementServerService = extensionManagementServerService;
    this.instantiationService = instantiationService;
    this.remoteBadge = this._register(new MutableDisposable());
    this.element = append(parent, $(".extension-remote-badge-container"));
    this.render();
    this._register(toDisposable(() => this.clear()));
  }
  clear() {
    this.remoteBadge.value?.element.remove();
    this.remoteBadge.clear();
  }
  render() {
    this.clear();
    if (!this.extension || !this.extension.local || !this.extension.server || !(this.extensionManagementServerService.localExtensionManagementServer && this.extensionManagementServerService.remoteExtensionManagementServer) || this.extension.server !== this.extensionManagementServerService.remoteExtensionManagementServer) {
      return;
    }
    this.remoteBadge.value = this.instantiationService.createInstance(RemoteBadge, this.tooltip);
    append(this.element, this.remoteBadge.value.element);
  }
};
RemoteBadgeWidget = __decorateClass([
  __decorateParam(2, IExtensionManagementServerService),
  __decorateParam(3, IInstantiationService)
], RemoteBadgeWidget);
let RemoteBadge = class extends Disposable {
  constructor(tooltip, hoverService, labelService, themeService, extensionManagementServerService) {
    super();
    this.tooltip = tooltip;
    this.labelService = labelService;
    this.themeService = themeService;
    this.extensionManagementServerService = extensionManagementServerService;
    this.element = $("div.extension-badge.extension-remote-badge");
    this.elementHover = this._register(hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.element, ""));
    this.render();
  }
  render() {
    append(this.element, $("span" + ThemeIcon.asCSSSelector(remoteIcon)));
    const applyBadgeStyle = () => {
      if (!this.element) {
        return;
      }
      const bgColor = this.themeService.getColorTheme().getColor(EXTENSION_BADGE_REMOTE_BACKGROUND);
      const fgColor = this.themeService.getColorTheme().getColor(EXTENSION_BADGE_REMOTE_FOREGROUND);
      this.element.style.backgroundColor = bgColor ? bgColor.toString() : "";
      this.element.style.color = fgColor ? fgColor.toString() : "";
    };
    applyBadgeStyle();
    this._register(this.themeService.onDidColorThemeChange(() => applyBadgeStyle()));
    if (this.tooltip) {
      const updateTitle = () => {
        if (this.element && this.extensionManagementServerService.remoteExtensionManagementServer) {
          this.elementHover.update(localize("remote extension title", "Extension in {0}", this.extensionManagementServerService.remoteExtensionManagementServer.label));
        }
      };
      this._register(this.labelService.onDidChangeFormatters(() => updateTitle()));
      updateTitle();
    }
  }
};
RemoteBadge = __decorateClass([
  __decorateParam(1, IHoverService),
  __decorateParam(2, ILabelService),
  __decorateParam(3, IThemeService),
  __decorateParam(4, IExtensionManagementServerService)
], RemoteBadge);
class ExtensionPackCountWidget extends ExtensionWidget {
  constructor(parent) {
    super();
    this.parent = parent;
    this.render();
    this._register(toDisposable(() => this.clear()));
  }
  clear() {
    this.element?.remove();
    this.countBadge?.dispose();
    this.countBadge = void 0;
  }
  render() {
    this.clear();
    if (!this.extension || !this.extension.categories?.some((category) => category.toLowerCase() === "extension packs") || !this.extension.extensionPack.length) {
      return;
    }
    this.element = append(this.parent, $(".extension-badge.extension-pack-badge"));
    this.countBadge = new CountBadge(this.element, {}, defaultCountBadgeStyles);
    this.countBadge.setCount(this.extension.extensionPack.length);
  }
}
let ExtensionKindIndicatorWidget = class extends ExtensionWidget {
  constructor(container, small, hoverService, contextService, uriIdentityService, explorerService, viewsService) {
    super();
    this.container = container;
    this.small = small;
    this.hoverService = hoverService;
    this.contextService = contextService;
    this.uriIdentityService = uriIdentityService;
    this.explorerService = explorerService;
    this.viewsService = viewsService;
    this.disposables = this._register(new DisposableStore());
    this.render();
    this._register(toDisposable(() => this.clear()));
  }
  clear() {
    this.element?.remove();
    this.disposables.clear();
  }
  render() {
    this.clear();
    if (this.small) {
      return;
    }
    if (!this.extension) {
      return;
    }
    if (this.extension?.private) {
      this.element = append(this.container, $(".extension-kind-indicator"));
      append(this.element, $("span" + ThemeIcon.asCSSSelector(privateExtensionIcon)));
      if (!this.small) {
        append(this.element, $("span.private-extension-label", void 0, localize("privateExtension", "Private Extension")));
      }
      return;
    }
    const location = this.extension.resourceExtension?.location ?? (this.extension.local?.source === "resource" ? this.extension.local?.location : void 0);
    if (!location) {
      return;
    }
    this.element = append(this.container, $(".extension-kind-indicator"));
    const workspaceFolder = this.contextService.getWorkspaceFolder(location);
    if (workspaceFolder && this.extension.isWorkspaceScoped) {
      this.element.textContent = localize("workspace extension", "Workspace Extension");
      this.element.classList.add("clickable");
      this.element.setAttribute("role", "button");
      this.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.element, this.uriIdentityService.extUri.relativePath(workspaceFolder.uri, location)));
      this.disposables.add(onClick(this.element, () => {
        this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true));
      }));
    } else {
      this.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.element, location.path));
      this.element.textContent = localize("local extension", "Local Extension");
    }
  }
};
ExtensionKindIndicatorWidget = __decorateClass([
  __decorateParam(2, IHoverService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, IUriIdentityService),
  __decorateParam(5, IExplorerService),
  __decorateParam(6, IViewsService)
], ExtensionKindIndicatorWidget);
let SyncIgnoredWidget = class extends ExtensionWidget {
  constructor(container, configurationService, extensionsWorkbenchService, hoverService, userDataSyncEnablementService) {
    super();
    this.container = container;
    this.configurationService = configurationService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.hoverService = hoverService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this.disposables = this._register(new DisposableStore());
    this._register(Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("settingsSync.ignoredExtensions"))(() => this.render()));
    this._register(userDataSyncEnablementService.onDidChangeEnablement(() => this.update()));
    this.render();
  }
  render() {
    this.disposables.clear();
    this.container.innerText = "";
    if (this.extension && this.extension.state === ExtensionState.Installed && this.userDataSyncEnablementService.isEnabled() && this.extensionsWorkbenchService.isExtensionIgnoredToSync(this.extension)) {
      const element = append(this.container, $("span.extension-sync-ignored" + ThemeIcon.asCSSSelector(syncIgnoredIcon)));
      this.disposables.add(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), element, localize("syncingore.label", "This extension is ignored during sync.")));
      element.classList.add(...ThemeIcon.asClassNameArray(syncIgnoredIcon));
    }
  }
};
SyncIgnoredWidget = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IExtensionsWorkbenchService),
  __decorateParam(3, IHoverService),
  __decorateParam(4, IUserDataSyncEnablementService)
], SyncIgnoredWidget);
let ExtensionRuntimeStatusWidget = class extends ExtensionWidget {
  constructor(extensionViewState, container, extensionService, extensionFeaturesManagementService, extensionsWorkbenchService) {
    super();
    this.extensionViewState = extensionViewState;
    this.container = container;
    this.extensionFeaturesManagementService = extensionFeaturesManagementService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this._register(extensionService.onDidChangeExtensionsStatus((extensions) => {
      if (this.extension && extensions.some((e) => areSameExtensions({ id: e.value }, this.extension.identifier))) {
        this.update();
      }
    }));
    this._register(extensionFeaturesManagementService.onDidChangeAccessData((e) => {
      if (this.extension && ExtensionIdentifier.equals(this.extension.identifier.id, e.extension)) {
        this.update();
      }
    }));
  }
  render() {
    this.container.innerText = "";
    if (!this.extension) {
      return;
    }
    if (this.extensionViewState.filters.featureId && this.extension.state === ExtensionState.Installed) {
      const accessData = this.extensionFeaturesManagementService.getAllAccessDataForExtension(new ExtensionIdentifier(this.extension.identifier.id)).get(this.extensionViewState.filters.featureId);
      const feature = Registry.as(Extensions.ExtensionFeaturesRegistry).getExtensionFeature(this.extensionViewState.filters.featureId);
      if (feature?.icon && accessData) {
        const featureAccessTimeElement = append(this.container, $("span.activationTime"));
        featureAccessTimeElement.textContent = localize("feature access label", "{0} reqs", accessData.accessTimes.length);
        const iconElement = append(this.container, $("span" + ThemeIcon.asCSSSelector(feature.icon)));
        iconElement.style.paddingLeft = "4px";
        return;
      }
    }
    const extensionStatus = this.extensionsWorkbenchService.getExtensionRuntimeStatus(this.extension);
    if (extensionStatus?.activationTimes) {
      const activationTime = extensionStatus.activationTimes.codeLoadingTime + extensionStatus.activationTimes.activateCallTime;
      append(this.container, $("span" + ThemeIcon.asCSSSelector(activationTimeIcon)));
      const activationTimeElement = append(this.container, $("span.activationTime"));
      activationTimeElement.textContent = `${activationTime}ms`;
    }
  }
};
ExtensionRuntimeStatusWidget = __decorateClass([
  __decorateParam(2, IExtensionService),
  __decorateParam(3, IExtensionFeaturesManagementService),
  __decorateParam(4, IExtensionsWorkbenchService)
], ExtensionRuntimeStatusWidget);
let ExtensionHoverWidget = class extends ExtensionWidget {
  constructor(options, extensionStatusAction, extensionsWorkbenchService, extensionFeaturesManagementService, hoverService, configurationService, extensionRecommendationsService, themeService, contextService) {
    super();
    this.options = options;
    this.extensionStatusAction = extensionStatusAction;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionFeaturesManagementService = extensionFeaturesManagementService;
    this.hoverService = hoverService;
    this.configurationService = configurationService;
    this.extensionRecommendationsService = extensionRecommendationsService;
    this.themeService = themeService;
    this.contextService = contextService;
    this.hover = this._register(new MutableDisposable());
  }
  render() {
    this.hover.value = void 0;
    if (this.extension) {
      this.hover.value = this.hoverService.setupManagedHover(
        {
          delay: this.configurationService.getValue("workbench.hover.delay"),
          showHover: (options, focus) => {
            return this.hoverService.showInstantHover({
              ...options,
              additionalClasses: ["extension-hover"],
              position: {
                hoverPosition: this.options.position(),
                forcePosition: true
              },
              persistence: {
                hideOnKeyDown: true
              }
            }, focus);
          },
          placement: "element"
        },
        this.options.target,
        {
          markdown: () => Promise.resolve(this.getHoverMarkdown()),
          markdownNotSupportedFallback: void 0
        },
        {
          appearance: {
            showHoverHint: true
          }
        }
      );
    }
  }
  getHoverMarkdown() {
    if (!this.extension) {
      return void 0;
    }
    const markdown = new MarkdownString("", { isTrusted: true, supportThemeIcons: true });
    markdown.appendMarkdown(`**${this.extension.displayName}**`);
    if (semver.valid(this.extension.version)) {
      markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">**&nbsp;_v${this.extension.version}${this.extension.isPreReleaseVersion ? " (pre-release)" : ""}_**&nbsp;</span>`);
    }
    markdown.appendText(`
`);
    let addSeparator = false;
    if (this.extension.private) {
      markdown.appendMarkdown(`$(${privateExtensionIcon.id}) ${localize("privateExtension", "Private Extension")}`);
      addSeparator = true;
    }
    if (this.extension.state === ExtensionState.Installed) {
      const installLabel = InstallCountWidget.getInstallLabel(this.extension, true);
      if (installLabel) {
        if (addSeparator) {
          markdown.appendText(`  |  `);
        }
        markdown.appendMarkdown(`$(${installCountIcon.id}) ${installLabel}`);
        addSeparator = true;
      }
      if (this.extension.rating) {
        if (addSeparator) {
          markdown.appendText(`  |  `);
        }
        const rating = Math.round(this.extension.rating * 2) / 2;
        markdown.appendMarkdown(`$(${starFullIcon.id}) [${rating}](${this.extension.url}&ssr=false#review-details)`);
        addSeparator = true;
      }
      if (this.extension.publisherSponsorLink) {
        if (addSeparator) {
          markdown.appendText(`  |  `);
        }
        markdown.appendMarkdown(`$(${sponsorIcon.id}) [${localize("sponsor", "Sponsor")}](${this.extension.publisherSponsorLink})`);
        addSeparator = true;
      }
    }
    if (addSeparator) {
      markdown.appendText(`
`);
    }
    const location = this.extension.resourceExtension?.location ?? (this.extension.local?.source === "resource" ? this.extension.local?.location : void 0);
    if (location) {
      if (this.extension.isWorkspaceScoped && this.contextService.isInsideWorkspace(location)) {
        markdown.appendMarkdown(localize("workspace extension", "Workspace Extension"));
      } else {
        markdown.appendMarkdown(localize("local extension", "Local Extension"));
      }
      markdown.appendText(`
`);
    }
    if (this.extension.description) {
      markdown.appendMarkdown(`${this.extension.description}`);
      markdown.appendText(`
`);
    }
    if (this.extension.publisherDomain?.verified) {
      const bgColor = this.themeService.getColorTheme().getColor(extensionVerifiedPublisherIconColor);
      const publisherVerifiedTooltip = localize("publisher verified tooltip", "This publisher has verified ownership of {0}", `[${URI.parse(this.extension.publisherDomain.link).authority}](${this.extension.publisherDomain.link})`);
      markdown.appendMarkdown(`<span style="color:${bgColor ? Color.Format.CSS.formatHex(bgColor) : "#ffffff"};">$(${verifiedPublisherIcon.id})</span>&nbsp;${publisherVerifiedTooltip}`);
      markdown.appendText(`
`);
    }
    if (this.extension.outdated) {
      markdown.appendMarkdown(localize("updateRequired", "Latest version:"));
      markdown.appendMarkdown(`&nbsp;<span style="background-color:#8080802B;">**&nbsp;_v${this.extension.latestVersion}_**&nbsp;</span>`);
      markdown.appendText(`
`);
    }
    const preReleaseMessage = ExtensionHoverWidget.getPreReleaseMessage(this.extension);
    const extensionRuntimeStatus = this.extensionsWorkbenchService.getExtensionRuntimeStatus(this.extension);
    const extensionFeaturesAccessData = this.extensionFeaturesManagementService.getAllAccessDataForExtension(new ExtensionIdentifier(this.extension.identifier.id));
    const extensionStatus = this.extensionStatusAction.status;
    const runtimeState = this.extension.runtimeState;
    const recommendationMessage = this.getRecommendationMessage(this.extension);
    if (extensionRuntimeStatus || extensionFeaturesAccessData.size || extensionStatus.length || runtimeState || recommendationMessage || preReleaseMessage) {
      markdown.appendMarkdown(`---`);
      markdown.appendText(`
`);
      if (extensionRuntimeStatus) {
        if (extensionRuntimeStatus.activationTimes) {
          const activationTime = extensionRuntimeStatus.activationTimes.codeLoadingTime + extensionRuntimeStatus.activationTimes.activateCallTime;
          markdown.appendMarkdown(`${localize("activation", "Activation time")}${extensionRuntimeStatus.activationTimes.activationReason.startup ? ` (${localize("startup", "Startup")})` : ""}: \`${activationTime}ms\``);
          markdown.appendText(`
`);
        }
        if (extensionRuntimeStatus.runtimeErrors.length || extensionRuntimeStatus.messages.length) {
          const hasErrors = extensionRuntimeStatus.runtimeErrors.length || extensionRuntimeStatus.messages.some((message) => message.type === Severity.Error);
          const hasWarnings = extensionRuntimeStatus.messages.some((message) => message.type === Severity.Warning);
          const errorsLink = extensionRuntimeStatus.runtimeErrors.length ? `[${extensionRuntimeStatus.runtimeErrors.length === 1 ? localize("uncaught error", "1 uncaught error") : localize("uncaught errors", "{0} uncaught errors", extensionRuntimeStatus.runtimeErrors.length)}](${URI.parse(`command:extension.open?${encodeURIComponent(JSON.stringify([this.extension.identifier.id, ExtensionEditorTab.Features]))}`)})` : void 0;
          const messageLink = extensionRuntimeStatus.messages.length ? `[${extensionRuntimeStatus.messages.length === 1 ? localize("message", "1 message") : localize("messages", "{0} messages", extensionRuntimeStatus.messages.length)}](${URI.parse(`command:extension.open?${encodeURIComponent(JSON.stringify([this.extension.identifier.id, ExtensionEditorTab.Features]))}`)})` : void 0;
          markdown.appendMarkdown(`$(${hasErrors ? errorIcon.id : hasWarnings ? warningIcon.id : infoIcon.id}) This extension has reported `);
          if (errorsLink && messageLink) {
            markdown.appendMarkdown(`${errorsLink} and ${messageLink}`);
          } else {
            markdown.appendMarkdown(`${errorsLink || messageLink}`);
          }
          markdown.appendText(`
`);
        }
      }
      if (extensionFeaturesAccessData.size) {
        const registry = Registry.as(Extensions.ExtensionFeaturesRegistry);
        for (const [featureId, accessData] of extensionFeaturesAccessData) {
          if (accessData?.accessTimes.length) {
            const feature = registry.getExtensionFeature(featureId);
            if (feature) {
              markdown.appendMarkdown(localize("feature usage label", "{0} usage", feature.label));
              markdown.appendMarkdown(`: [${localize("total", "{0} {1} requests in last 30 days", accessData.accessTimes.length, feature.accessDataLabel ?? feature.label)}](${URI.parse(`command:extension.open?${encodeURIComponent(JSON.stringify([this.extension.identifier.id, ExtensionEditorTab.Features]))}`)})`);
              markdown.appendText(`
`);
            }
          }
        }
      }
      for (const status of extensionStatus) {
        if (status.icon) {
          markdown.appendMarkdown(`$(${status.icon.id})&nbsp;`);
        }
        markdown.appendMarkdown(status.message.value);
        markdown.appendText(`
`);
      }
      if (runtimeState) {
        markdown.appendMarkdown(`$(${infoIcon.id})&nbsp;`);
        markdown.appendMarkdown(`${runtimeState.reason}`);
        markdown.appendText(`
`);
      }
      if (preReleaseMessage) {
        const extensionPreReleaseIcon = this.themeService.getColorTheme().getColor(extensionPreReleaseIconColor);
        markdown.appendMarkdown(`<span style="color:${extensionPreReleaseIcon ? Color.Format.CSS.formatHex(extensionPreReleaseIcon) : "#ffffff"};">$(${preReleaseIcon.id})</span>&nbsp;${preReleaseMessage}`);
        markdown.appendText(`
`);
      }
      if (recommendationMessage) {
        markdown.appendMarkdown(recommendationMessage);
        markdown.appendText(`
`);
      }
    }
    return markdown;
  }
  getRecommendationMessage(extension) {
    if (extension.state === ExtensionState.Installed) {
      return void 0;
    }
    if (extension.deprecationInfo) {
      return void 0;
    }
    const recommendation = this.extensionRecommendationsService.getAllRecommendationsWithReason()[extension.identifier.id.toLowerCase()];
    if (!recommendation?.reasonText) {
      return void 0;
    }
    const bgColor = this.themeService.getColorTheme().getColor(extensionButtonProminentBackground);
    return `<span style="color:${bgColor ? Color.Format.CSS.formatHex(bgColor) : "#ffffff"};">$(${starEmptyIcon.id})</span>&nbsp;${recommendation.reasonText}`;
  }
  static getPreReleaseMessage(extension) {
    if (!extension.hasPreReleaseVersion) {
      return void 0;
    }
    if (extension.isBuiltin) {
      return void 0;
    }
    if (extension.isPreReleaseVersion) {
      return void 0;
    }
    if (extension.preRelease) {
      return void 0;
    }
    const preReleaseVersionLink = `[${localize("Show prerelease version", "Pre-Release version")}](${URI.parse(`command:workbench.extensions.action.showPreReleaseVersion?${encodeURIComponent(JSON.stringify([extension.identifier.id]))}`)})`;
    return localize("has prerelease", "This extension has a {0} available", preReleaseVersionLink);
  }
};
ExtensionHoverWidget = __decorateClass([
  __decorateParam(2, IExtensionsWorkbenchService),
  __decorateParam(3, IExtensionFeaturesManagementService),
  __decorateParam(4, IHoverService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IExtensionRecommendationsService),
  __decorateParam(7, IThemeService),
  __decorateParam(8, IWorkspaceContextService)
], ExtensionHoverWidget);
let ExtensionStatusWidget = class extends ExtensionWidget {
  constructor(container, extensionStatusAction, openerService) {
    super();
    this.container = container;
    this.extensionStatusAction = extensionStatusAction;
    this.openerService = openerService;
    this.renderDisposables = this._register(new MutableDisposable());
    this._onDidRender = this._register(new Emitter());
    this.onDidRender = this._onDidRender.event;
    this.render();
    this._register(extensionStatusAction.onDidChangeStatus(() => this.render()));
  }
  render() {
    reset(this.container);
    this.renderDisposables.value = void 0;
    const disposables = new DisposableStore();
    this.renderDisposables.value = disposables;
    const extensionStatus = this.extensionStatusAction.status;
    if (extensionStatus.length) {
      const markdown = new MarkdownString("", { isTrusted: true, supportThemeIcons: true });
      for (let i = 0; i < extensionStatus.length; i++) {
        const status = extensionStatus[i];
        if (status.icon) {
          markdown.appendMarkdown(`$(${status.icon.id})&nbsp;`);
        }
        markdown.appendMarkdown(status.message.value);
        if (i < extensionStatus.length - 1) {
          markdown.appendText(`
`);
        }
      }
      const rendered = disposables.add(renderMarkdown(markdown, {
        actionHandler: {
          callback: (content) => {
            this.openerService.open(content, { allowCommands: true }).catch(onUnexpectedError);
          },
          disposables
        }
      }));
      append(this.container, rendered.element);
    }
    this._onDidRender.fire();
  }
};
ExtensionStatusWidget = __decorateClass([
  __decorateParam(2, IOpenerService)
], ExtensionStatusWidget);
let ExtensionRecommendationWidget = class extends ExtensionWidget {
  constructor(container, extensionRecommendationsService, extensionIgnoredRecommendationsService) {
    super();
    this.container = container;
    this.extensionRecommendationsService = extensionRecommendationsService;
    this.extensionIgnoredRecommendationsService = extensionIgnoredRecommendationsService;
    this._onDidRender = this._register(new Emitter());
    this.onDidRender = this._onDidRender.event;
    this.render();
    this._register(this.extensionRecommendationsService.onDidChangeRecommendations(() => this.render()));
  }
  render() {
    reset(this.container);
    const recommendationStatus = this.getRecommendationStatus();
    if (recommendationStatus) {
      if (recommendationStatus.icon) {
        append(this.container, $(`div${ThemeIcon.asCSSSelector(recommendationStatus.icon)}`));
      }
      append(this.container, $(`div.recommendation-text`, void 0, recommendationStatus.message));
    }
    this._onDidRender.fire();
  }
  getRecommendationStatus() {
    if (!this.extension || this.extension.deprecationInfo || this.extension.state === ExtensionState.Installed) {
      return void 0;
    }
    const extRecommendations = this.extensionRecommendationsService.getAllRecommendationsWithReason();
    if (extRecommendations[this.extension.identifier.id.toLowerCase()]) {
      const reasonText = extRecommendations[this.extension.identifier.id.toLowerCase()].reasonText;
      if (reasonText) {
        return { icon: starEmptyIcon, message: reasonText };
      }
    } else if (this.extensionIgnoredRecommendationsService.globalIgnoredRecommendations.indexOf(this.extension.identifier.id.toLowerCase()) !== -1) {
      return { icon: void 0, message: localize("recommendationHasBeenIgnored", "You have chosen not to receive recommendations for this extension.") };
    }
    return void 0;
  }
};
ExtensionRecommendationWidget = __decorateClass([
  __decorateParam(1, IExtensionRecommendationsService),
  __decorateParam(2, IExtensionIgnoredRecommendationsService)
], ExtensionRecommendationWidget);
const extensionRatingIconColor = registerColor("extensionIcon.starForeground", { light: "#DF6100", dark: "#FF8E00", hcDark: "#FF8E00", hcLight: textLinkForeground }, localize("extensionIconStarForeground", "The icon color for extension ratings."), false);
const extensionPreReleaseIconColor = registerColor("extensionIcon.preReleaseForeground", { dark: "#1d9271", light: "#1d9271", hcDark: "#1d9271", hcLight: textLinkForeground }, localize("extensionPreReleaseForeground", "The icon color for pre-release extension."), false);
const extensionSponsorIconColor = registerColor("extensionIcon.sponsorForeground", { light: "#B51E78", dark: "#D758B3", hcDark: null, hcLight: "#B51E78" }, localize("extensionIcon.sponsorForeground", "The icon color for extension sponsor."), false);
const extensionPrivateBadgeBackground = registerColor("extensionIcon.privateForeground", { dark: "#ffffff60", light: "#00000060", hcDark: "#ffffff60", hcLight: "#00000060" }, localize("extensionIcon.private", "The icon color for private extensions."));
registerThemingParticipant((theme, collector) => {
  const extensionRatingIcon = theme.getColor(extensionRatingIconColor);
  if (extensionRatingIcon) {
    collector.addRule(`.extension-ratings .codicon-extensions-star-full, .extension-ratings .codicon-extensions-star-half { color: ${extensionRatingIcon}; }`);
    collector.addRule(`.monaco-hover.extension-hover .markdown-hover .hover-contents ${ThemeIcon.asCSSSelector(starFullIcon)} { color: ${extensionRatingIcon}; }`);
  }
  const extensionVerifiedPublisherIcon = theme.getColor(extensionVerifiedPublisherIconColor);
  if (extensionVerifiedPublisherIcon) {
    collector.addRule(`${ThemeIcon.asCSSSelector(verifiedPublisherIcon)} { color: ${extensionVerifiedPublisherIcon}; }`);
  }
  collector.addRule(`.monaco-hover.extension-hover .markdown-hover .hover-contents ${ThemeIcon.asCSSSelector(sponsorIcon)} { color: var(--vscode-extensionIcon-sponsorForeground); }`);
  collector.addRule(`.extension-editor > .header > .details > .subtitle .sponsor ${ThemeIcon.asCSSSelector(sponsorIcon)} { color: var(--vscode-extensionIcon-sponsorForeground); }`);
  const privateBadgeBackground = theme.getColor(extensionPrivateBadgeBackground);
  if (privateBadgeBackground) {
    collector.addRule(`.extension-private-badge { color: ${privateBadgeBackground}; }`);
  }
});
export {
  ExtensionHoverWidget,
  ExtensionKindIndicatorWidget,
  ExtensionPackCountWidget,
  ExtensionRecommendationWidget,
  ExtensionRuntimeStatusWidget,
  ExtensionStatusWidget,
  ExtensionWidget,
  InstallCountWidget,
  PreReleaseBookmarkWidget,
  PublisherWidget,
  RatingsWidget,
  RecommendationWidget,
  RemoteBadgeWidget,
  SponsorWidget,
  SyncIgnoredWidget,
  extensionPreReleaseIconColor,
  extensionPrivateBadgeBackground,
  extensionRatingIconColor,
  extensionSponsorIconColor,
  onClick
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2Jyb3dzZXIvZXh0ZW5zaW9uc1dpZGdldHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvZXh0ZW5zaW9uc1dpZGdldHMuY3NzJztcbmltcG9ydCAqIGFzIHNlbXZlciBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZW12ZXIvc2VtdmVyLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBNdXRhYmxlRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbiwgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLCBJRXh0ZW5zaW9uQ29udGFpbmVyLCBFeHRlbnNpb25TdGF0ZSwgRXh0ZW5zaW9uRWRpdG9yVGFiLCBJRXh0ZW5zaW9uc1ZpZXdTdGF0ZSB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGFwcGVuZCwgJCwgcmVzZXQsIGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgRXZlbnRUeXBlLCBmaW5hbEhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCAqIGFzIHBsYXRmb3JtIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbklnbm9yZWRSZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLCBJRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvblJlY29tbWVuZGF0aW9ucy9jb21tb24vZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgZXh0ZW5zaW9uQnV0dG9uUHJvbWluZW50QmFja2dyb3VuZCwgRXh0ZW5zaW9uU3RhdHVzQWN0aW9uIH0gZnJvbSAnLi9leHRlbnNpb25zQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlLCByZWdpc3RlclRoZW1pbmdQYXJ0aWNpcGFudCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IEVYVEVOU0lPTl9CQURHRV9SRU1PVEVfQkFDS0dST1VORCwgRVhURU5TSU9OX0JBREdFX1JFTU9URV9GT1JFR1JPVU5EIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb3VudEJhZGdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2NvdW50QmFkZ2UvY291bnRCYWRnZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhU3luYy9jb21tb24vdXNlckRhdGFTeW5jLmpzJztcbmltcG9ydCB7IGFjdGl2YXRpb25UaW1lSWNvbiwgZXJyb3JJY29uLCBpbmZvSWNvbiwgaW5zdGFsbENvdW50SWNvbiwgcHJlUmVsZWFzZUljb24sIHByaXZhdGVFeHRlbnNpb25JY29uLCByYXRpbmdJY29uLCByZW1vdGVJY29uLCBzcG9uc29ySWNvbiwgc3RhckVtcHR5SWNvbiwgc3RhckZ1bGxJY29uLCBzdGFySGFsZkljb24sIHN5bmNJZ25vcmVkSWNvbiwgd2FybmluZ0ljb24gfSBmcm9tICcuL2V4dGVuc2lvbnNJY29ucy5qcyc7XG5pbXBvcnQgeyByZWdpc3RlckNvbG9yLCB0ZXh0TGlua0ZvcmVncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBIb3ZlclBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyV2lkZ2V0LmpzJztcbmltcG9ydCB7IE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBhcmVTYW1lRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnRVdGlsLmpzJztcbmltcG9ydCBTZXZlcml0eSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXZlcml0eS5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IHJlbmRlck1hcmtkb3duIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL21hcmtkb3duUmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyByZW5kZXJJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2ljb25MYWJlbC9pY29uTGFiZWxzLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBkZWZhdWx0Q291bnRCYWRnZVN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2Jyb3dzZXIvZGVmYXVsdFN0eWxlcy5qcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgdHlwZSB7IElNYW5hZ2VkSG92ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucywgSUV4dGVuc2lvbkZlYXR1cmVzTWFuYWdlbWVudFNlcnZpY2UsIElFeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgZXh0ZW5zaW9uVmVyaWZpZWRQdWJsaXNoZXJJY29uQ29sb3IsIHZlcmlmaWVkUHVibGlzaGVySWNvbiB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbnNJY29ucy5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElFeHBsb3JlclNlcnZpY2UgfSBmcm9tICcuLi8uLi9maWxlcy9icm93c2VyL2ZpbGVzLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFZJRVdfSUQgYXMgRVhQTE9SRVJfVklFV19JRCB9IGZyb20gJy4uLy4uL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBFeHRlbnNpb25XaWRnZXQgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUV4dGVuc2lvbkNvbnRhaW5lciB7XG5cdHByaXZhdGUgX2V4dGVuc2lvbjogSUV4dGVuc2lvbiB8IG51bGwgPSBudWxsO1xuXHRnZXQgZXh0ZW5zaW9uKCk6IElFeHRlbnNpb24gfCBudWxsIHsgcmV0dXJuIHRoaXMuX2V4dGVuc2lvbjsgfVxuXHRzZXQgZXh0ZW5zaW9uKGV4dGVuc2lvbjogSUV4dGVuc2lvbiB8IG51bGwpIHsgdGhpcy5fZXh0ZW5zaW9uID0gZXh0ZW5zaW9uOyB0aGlzLnVwZGF0ZSgpOyB9XG5cdHVwZGF0ZSgpOiB2b2lkIHsgdGhpcy5yZW5kZXIoKTsgfVxuXHRhYnN0cmFjdCByZW5kZXIoKTogdm9pZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG9uQ2xpY2soZWxlbWVudDogSFRNTEVsZW1lbnQsIGNhbGxiYWNrOiAoKSA9PiB2b2lkKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRkaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGVsZW1lbnQsIEV2ZW50VHlwZS5DTElDSywgZmluYWxIYW5kbGVyKGNhbGxiYWNrKSkpO1xuXHRkaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGVsZW1lbnQsIEV2ZW50VHlwZS5LRVlfVVAsIGUgPT4ge1xuXHRcdGNvbnN0IGtleWJvYXJkRXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXHRcdGlmIChrZXlib2FyZEV2ZW50LmVxdWFscyhLZXlDb2RlLlNwYWNlKSB8fCBrZXlib2FyZEV2ZW50LmVxdWFscyhLZXlDb2RlLkVudGVyKSkge1xuXHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdGNhbGxiYWNrKCk7XG5cdFx0fVxuXHR9KSk7XG5cdHJldHVybiBkaXNwb3NhYmxlcztcbn1cblxuZXhwb3J0IGNsYXNzIEluc3RhbGxDb3VudFdpZGdldCBleHRlbmRzIEV4dGVuc2lvbldpZGdldCB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRwcml2YXRlIHNtYWxsOiBib29sZWFuLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5jbGVhcigpKSk7XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyKCk6IHZvaWQge1xuXHRcdHRoaXMuY29udGFpbmVyLmlubmVyVGV4dCA9ICcnO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fVxuXG5cdHJlbmRlcigpOiB2b2lkIHtcblx0XHR0aGlzLmNsZWFyKCk7XG5cblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc21hbGwgJiYgdGhpcy5leHRlbnNpb24uc3RhdGUgIT09IEV4dGVuc2lvblN0YXRlLlVuaW5zdGFsbGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5zdGFsbExhYmVsID0gSW5zdGFsbENvdW50V2lkZ2V0LmdldEluc3RhbGxMYWJlbCh0aGlzLmV4dGVuc2lvbiwgdGhpcy5zbWFsbCk7XG5cdFx0aWYgKCFpbnN0YWxsTGFiZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwYXJlbnQgPSB0aGlzLnNtYWxsID8gdGhpcy5jb250YWluZXIgOiBhcHBlbmQodGhpcy5jb250YWluZXIsICQoJ3NwYW4uaW5zdGFsbCcsIHsgdGFiSW5kZXg6IDAgfSkpO1xuXHRcdGFwcGVuZChwYXJlbnQsICQoJ3NwYW4nICsgVGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoaW5zdGFsbENvdW50SWNvbikpKTtcblx0XHRjb25zdCBjb3VudCA9IGFwcGVuZChwYXJlbnQsICQoJ3NwYW4uY291bnQnKSk7XG5cdFx0Y291bnQudGV4dENvbnRlbnQgPSBpbnN0YWxsTGFiZWw7XG5cblx0XHRpZiAoIXRoaXMuc21hbGwpIHtcblx0XHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCB0aGlzLmNvbnRhaW5lciwgbG9jYWxpemUoJ2luc3RhbGwgY291bnQnLCBcIkluc3RhbGwgY291bnRcIikpKTtcblx0XHR9XG5cdH1cblxuXHRzdGF0aWMgZ2V0SW5zdGFsbExhYmVsKGV4dGVuc2lvbjogSUV4dGVuc2lvbiwgc21hbGw6IGJvb2xlYW4pOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGluc3RhbGxDb3VudCA9IGV4dGVuc2lvbi5pbnN0YWxsQ291bnQ7XG5cblx0XHRpZiAoIWluc3RhbGxDb3VudCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRsZXQgaW5zdGFsbExhYmVsOiBzdHJpbmc7XG5cblx0XHRpZiAoc21hbGwpIHtcblx0XHRcdGlmIChpbnN0YWxsQ291bnQgPiAxMDAwMDAwKSB7XG5cdFx0XHRcdGluc3RhbGxMYWJlbCA9IGAke01hdGguZmxvb3IoaW5zdGFsbENvdW50IC8gMTAwMDAwKSAvIDEwfU1gO1xuXHRcdFx0fSBlbHNlIGlmIChpbnN0YWxsQ291bnQgPiAxMDAwKSB7XG5cdFx0XHRcdGluc3RhbGxMYWJlbCA9IGAke01hdGguZmxvb3IoaW5zdGFsbENvdW50IC8gMTAwMCl9S2A7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpbnN0YWxsTGFiZWwgPSBTdHJpbmcoaW5zdGFsbENvdW50KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0ZWxzZSB7XG5cdFx0XHRpbnN0YWxsTGFiZWwgPSBpbnN0YWxsQ291bnQudG9Mb2NhbGVTdHJpbmcocGxhdGZvcm0ubGFuZ3VhZ2UpO1xuXHRcdH1cblxuXHRcdHJldHVybiBpbnN0YWxsTGFiZWw7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFJhdGluZ3NXaWRnZXQgZXh0ZW5kcyBFeHRlbnNpb25XaWRnZXQge1xuXG5cdHByaXZhdGUgY29udGFpbmVySG92ZXI6IElNYW5hZ2VkSG92ZXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSBzbWFsbDogYm9vbGVhbixcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnZXh0ZW5zaW9uLXJhdGluZ3MnKTtcblxuXHRcdGlmICh0aGlzLnNtYWxsKSB7XG5cdFx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnc21hbGwnKTtcblx0XHR9XG5cblx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLmNsZWFyKCkpKTtcblx0fVxuXG5cdHByaXZhdGUgY2xlYXIoKTogdm9pZCB7XG5cdFx0dGhpcy5jb250YWluZXIuaW5uZXJUZXh0ID0gJyc7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9XG5cblx0cmVuZGVyKCk6IHZvaWQge1xuXHRcdHRoaXMuY2xlYXIoKTtcblxuXHRcdGlmICghdGhpcy5leHRlbnNpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5zbWFsbCAmJiB0aGlzLmV4dGVuc2lvbi5zdGF0ZSAhPT0gRXh0ZW5zaW9uU3RhdGUuVW5pbnN0YWxsZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5leHRlbnNpb24ucmF0aW5nID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5zbWFsbCAmJiAhdGhpcy5leHRlbnNpb24ucmF0aW5nQ291bnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uLnVybCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJhdGluZyA9IE1hdGgucm91bmQodGhpcy5leHRlbnNpb24ucmF0aW5nICogMikgLyAyO1xuXHRcdGlmICh0aGlzLnNtYWxsKSB7XG5cdFx0XHRhcHBlbmQodGhpcy5jb250YWluZXIsICQoJ3NwYW4nICsgVGhlbWVJY29uLmFzQ1NTU2VsZWN0b3Ioc3RhckZ1bGxJY29uKSkpO1xuXG5cdFx0XHRjb25zdCBjb3VudCA9IGFwcGVuZCh0aGlzLmNvbnRhaW5lciwgJCgnc3Bhbi5jb3VudCcpKTtcblx0XHRcdGNvdW50LnRleHRDb250ZW50ID0gU3RyaW5nKHJhdGluZyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGVsZW1lbnQgPSBhcHBlbmQodGhpcy5jb250YWluZXIsICQoJ3NwYW4ucmF0aW5nLmNsaWNrYWJsZScsIHsgdGFiSW5kZXg6IDAgfSkpO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDE7IGkgPD0gNTsgaSsrKSB7XG5cdFx0XHRcdGlmIChyYXRpbmcgPj0gaSkge1xuXHRcdFx0XHRcdGFwcGVuZChlbGVtZW50LCAkKCdzcGFuJyArIFRoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKHN0YXJGdWxsSWNvbikpKTtcblx0XHRcdFx0fSBlbHNlIGlmIChyYXRpbmcgPj0gaSAtIDAuNSkge1xuXHRcdFx0XHRcdGFwcGVuZChlbGVtZW50LCAkKCdzcGFuJyArIFRoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKHN0YXJIYWxmSWNvbikpKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhcHBlbmQoZWxlbWVudCwgJCgnc3BhbicgKyBUaGVtZUljb24uYXNDU1NTZWxlY3RvcihzdGFyRW1wdHlJY29uKSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5leHRlbnNpb24ucmF0aW5nQ291bnQpIHtcblx0XHRcdFx0Y29uc3QgcmF0aW5nQ291bnRFbGVtZXQgPSBhcHBlbmQoZWxlbWVudCwgJCgnc3BhbicsIHVuZGVmaW5lZCwgYCAoJHt0aGlzLmV4dGVuc2lvbi5yYXRpbmdDb3VudH0pYCkpO1xuXHRcdFx0XHRyYXRpbmdDb3VudEVsZW1ldC5zdHlsZS5wYWRkaW5nTGVmdCA9ICcxcHgnO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmNvbnRhaW5lckhvdmVyID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ21vdXNlJyksIGVsZW1lbnQsICcnKSk7XG5cdFx0XHR0aGlzLmNvbnRhaW5lckhvdmVyLnVwZGF0ZShsb2NhbGl6ZSgncmF0ZWRMYWJlbCcsIFwiQXZlcmFnZSByYXRpbmc6IHswfSBvdXQgb2YgNVwiLCByYXRpbmcpKTtcblx0XHRcdGVsZW1lbnQuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2xpbmsnKTtcblx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbi5yYXRpbmdVcmwpIHtcblx0XHRcdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQob25DbGljayhlbGVtZW50LCAoKSA9PiB0aGlzLm9wZW5lclNlcnZpY2Uub3BlbihVUkkucGFyc2UodGhpcy5leHRlbnNpb24hLnJhdGluZ1VybCEpKSkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG59XG5cbmV4cG9ydCBjbGFzcyBQdWJsaXNoZXJXaWRnZXQgZXh0ZW5kcyBFeHRlbnNpb25XaWRnZXQge1xuXG5cdHByaXZhdGUgZWxlbWVudDogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgY29udGFpbmVySG92ZXI6IElNYW5hZ2VkSG92ZXIgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBkaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRwcml2YXRlIHNtYWxsOiBib29sZWFuLFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5jbGVhcigpKSk7XG5cdH1cblxuXHRwcml2YXRlIGNsZWFyKCk6IHZvaWQge1xuXHRcdHRoaXMuZWxlbWVudD8ucmVtb3ZlKCk7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9XG5cblx0cmVuZGVyKCk6IHZvaWQge1xuXHRcdHRoaXMuY2xlYXIoKTtcblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uLnJlc291cmNlRXh0ZW5zaW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uLmxvY2FsPy5zb3VyY2UgPT09ICdyZXNvdXJjZScpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmVsZW1lbnQgPSBhcHBlbmQodGhpcy5jb250YWluZXIsICQoJy5wdWJsaXNoZXInKSk7XG5cdFx0Y29uc3QgcHVibGlzaGVyRGlzcGxheU5hbWUgPSAkKCcucHVibGlzaGVyLW5hbWUuZWxsaXBzaXMnKTtcblx0XHRwdWJsaXNoZXJEaXNwbGF5TmFtZS50ZXh0Q29udGVudCA9IHRoaXMuZXh0ZW5zaW9uLnB1Ymxpc2hlckRpc3BsYXlOYW1lO1xuXG5cdFx0Y29uc3QgdmVyaWZpZWRQdWJsaXNoZXIgPSAkKCcudmVyaWZpZWQtcHVibGlzaGVyJyk7XG5cdFx0YXBwZW5kKHZlcmlmaWVkUHVibGlzaGVyLCAkKCdzcGFuLmV4dGVuc2lvbi12ZXJpZmllZC1wdWJsaXNoZXIuY2xpY2thYmxlJyksIHJlbmRlckljb24odmVyaWZpZWRQdWJsaXNoZXJJY29uKSk7XG5cblx0XHRpZiAodGhpcy5zbWFsbCkge1xuXHRcdFx0aWYgKHRoaXMuZXh0ZW5zaW9uLnB1Ymxpc2hlckRvbWFpbikge1xuXHRcdFx0XHRhcHBlbmQodGhpcy5lbGVtZW50LCB2ZXJpZmllZFB1Ymxpc2hlcik7XG5cdFx0XHR9XG5cdFx0XHRhcHBlbmQodGhpcy5lbGVtZW50LCBwdWJsaXNoZXJEaXNwbGF5TmFtZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCdjbGlja2FibGUnLCAhIXRoaXMuZXh0ZW5zaW9uLnVybCk7XG5cdFx0XHR0aGlzLmVsZW1lbnQuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2J1dHRvbicpO1xuXHRcdFx0dGhpcy5lbGVtZW50LnRhYkluZGV4ID0gMDtcblxuXHRcdFx0dGhpcy5jb250YWluZXJIb3ZlciA9IHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCB0aGlzLmVsZW1lbnQsIGxvY2FsaXplKCdwdWJsaXNoZXInLCBcIlB1Ymxpc2hlciAoezB9KVwiLCB0aGlzLmV4dGVuc2lvbi5wdWJsaXNoZXJEaXNwbGF5TmFtZSkpKTtcblx0XHRcdGFwcGVuZCh0aGlzLmVsZW1lbnQsIHB1Ymxpc2hlckRpc3BsYXlOYW1lKTtcblxuXHRcdFx0aWYgKHRoaXMuZXh0ZW5zaW9uLnB1Ymxpc2hlckRvbWFpbikge1xuXHRcdFx0XHRhcHBlbmQodGhpcy5lbGVtZW50LCB2ZXJpZmllZFB1Ymxpc2hlcik7XG5cdFx0XHRcdGNvbnN0IHB1Ymxpc2hlckRvbWFpbkxpbmsgPSBVUkkucGFyc2UodGhpcy5leHRlbnNpb24ucHVibGlzaGVyRG9tYWluLmxpbmspO1xuXHRcdFx0XHR2ZXJpZmllZFB1Ymxpc2hlci50YWJJbmRleCA9IDA7XG5cdFx0XHRcdHZlcmlmaWVkUHVibGlzaGVyLnNldEF0dHJpYnV0ZSgncm9sZScsICdidXR0b24nKTtcblx0XHRcdFx0dGhpcy5jb250YWluZXJIb3Zlci51cGRhdGUobG9jYWxpemUoJ3ZlcmlmaWVkIHB1Ymxpc2hlcicsIFwiVGhpcyBwdWJsaXNoZXIgaGFzIHZlcmlmaWVkIG93bmVyc2hpcCBvZiB7MH1cIiwgdGhpcy5leHRlbnNpb24ucHVibGlzaGVyRG9tYWluLmxpbmspKTtcblx0XHRcdFx0dmVyaWZpZWRQdWJsaXNoZXIuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2xpbmsnKTtcblxuXHRcdFx0XHRhcHBlbmQodmVyaWZpZWRQdWJsaXNoZXIsICQoJ3NwYW4uZXh0ZW5zaW9uLXZlcmlmaWVkLXB1Ymxpc2hlci1kb21haW4nLCB1bmRlZmluZWQsIHB1Ymxpc2hlckRvbWFpbkxpbmsuYXV0aG9yaXR5LnN0YXJ0c1dpdGgoJ3d3dy4nKSA/IHB1Ymxpc2hlckRvbWFpbkxpbmsuYXV0aG9yaXR5LnN1YnN0cmluZyg0KSA6IHB1Ymxpc2hlckRvbWFpbkxpbmsuYXV0aG9yaXR5KSk7XG5cdFx0XHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKG9uQ2xpY2sodmVyaWZpZWRQdWJsaXNoZXIsICgpID0+IHRoaXMub3BlbmVyU2VydmljZS5vcGVuKHB1Ymxpc2hlckRvbWFpbkxpbmspKSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbi51cmwpIHtcblx0XHRcdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQob25DbGljayh0aGlzLmVsZW1lbnQsICgpID0+IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub3BlblNlYXJjaChgcHVibGlzaGVyOlwiJHt0aGlzLmV4dGVuc2lvbj8ucHVibGlzaGVyRGlzcGxheU5hbWV9XCJgKSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIFNwb25zb3JXaWRnZXQgZXh0ZW5kcyBFeHRlbnNpb25XaWRnZXQge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXG5cdHJlbmRlcigpOiB2b2lkIHtcblx0XHRyZXNldCh0aGlzLmNvbnRhaW5lcik7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdGlmICghdGhpcy5leHRlbnNpb24/LnB1Ymxpc2hlclNwb25zb3JMaW5rKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3BvbnNvciA9IGFwcGVuZCh0aGlzLmNvbnRhaW5lciwgJCgnc3Bhbi5zcG9uc29yLmNsaWNrYWJsZScsIHsgdGFiSW5kZXg6IDAgfSkpO1xuXHRcdHRoaXMuZGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCBzcG9uc29yLCB0aGlzLmV4dGVuc2lvbj8ucHVibGlzaGVyU3BvbnNvckxpbmsudG9TdHJpbmcoKSA/PyAnJykpO1xuXHRcdHNwb25zb3Iuc2V0QXR0cmlidXRlKCdyb2xlJywgJ2xpbmsnKTsgLy8gIzEzMjY0NVxuXHRcdGNvbnN0IHNwb25zb3JJY29uRWxlbWVudCA9IHJlbmRlckljb24oc3BvbnNvckljb24pO1xuXHRcdGNvbnN0IGxhYmVsID0gJCgnc3BhbicsIHVuZGVmaW5lZCwgbG9jYWxpemUoJ3Nwb25zb3InLCBcIlNwb25zb3JcIikpO1xuXHRcdGFwcGVuZChzcG9uc29yLCBzcG9uc29ySWNvbkVsZW1lbnQsIGxhYmVsKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZChvbkNsaWNrKHNwb25zb3IsICgpID0+IHtcblx0XHRcdHRoaXMub3BlbmVyU2VydmljZS5vcGVuKHRoaXMuZXh0ZW5zaW9uIS5wdWJsaXNoZXJTcG9uc29yTGluayEpO1xuXHRcdH0pKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUmVjb21tZW5kYXRpb25XaWRnZXQgZXh0ZW5kcyBFeHRlbnNpb25XaWRnZXQge1xuXG5cdHByaXZhdGUgZWxlbWVudD86IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IGRpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHBhcmVudDogSFRNTEVsZW1lbnQsXG5cdFx0QElFeHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZTogSUV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLmNsZWFyKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2Uub25EaWRDaGFuZ2VSZWNvbW1lbmRhdGlvbnMoKCkgPT4gdGhpcy5yZW5kZXIoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhcigpOiB2b2lkIHtcblx0XHR0aGlzLmVsZW1lbnQ/LnJlbW92ZSgpO1xuXHRcdHRoaXMuZWxlbWVudCA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH1cblxuXHRyZW5kZXIoKTogdm9pZCB7XG5cdFx0dGhpcy5jbGVhcigpO1xuXHRcdGlmICghdGhpcy5leHRlbnNpb24gfHwgdGhpcy5leHRlbnNpb24uc3RhdGUgPT09IEV4dGVuc2lvblN0YXRlLkluc3RhbGxlZCB8fCB0aGlzLmV4dGVuc2lvbi5kZXByZWNhdGlvbkluZm8pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZXh0UmVjb21tZW5kYXRpb25zID0gdGhpcy5leHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLmdldEFsbFJlY29tbWVuZGF0aW9uc1dpdGhSZWFzb24oKTtcblx0XHRpZiAoZXh0UmVjb21tZW5kYXRpb25zW3RoaXMuZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKV0pIHtcblx0XHRcdHRoaXMuZWxlbWVudCA9IGFwcGVuZCh0aGlzLnBhcmVudCwgJCgnZGl2LmV4dGVuc2lvbi1ib29rbWFyaycpKTtcblx0XHRcdGNvbnN0IHJlY29tbWVuZGF0aW9uID0gYXBwZW5kKHRoaXMuZWxlbWVudCwgJCgnLnJlY29tbWVuZGF0aW9uJykpO1xuXHRcdFx0YXBwZW5kKHJlY29tbWVuZGF0aW9uLCAkKCdzcGFuJyArIFRoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKHJhdGluZ0ljb24pKSk7XG5cdFx0fVxuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIFByZVJlbGVhc2VCb29rbWFya1dpZGdldCBleHRlbmRzIEV4dGVuc2lvbldpZGdldCB7XG5cblx0cHJpdmF0ZSBlbGVtZW50PzogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcGFyZW50OiBIVE1MRWxlbWVudCxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLmNsZWFyKCkpKTtcblx0fVxuXG5cdHByaXZhdGUgY2xlYXIoKTogdm9pZCB7XG5cdFx0dGhpcy5lbGVtZW50Py5yZW1vdmUoKTtcblx0XHR0aGlzLmVsZW1lbnQgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9XG5cblx0cmVuZGVyKCk6IHZvaWQge1xuXHRcdHRoaXMuY2xlYXIoKTtcblx0XHRpZiAodGhpcy5leHRlbnNpb24/LnN0YXRlID09PSBFeHRlbnNpb25TdGF0ZS5JbnN0YWxsZWQgPyB0aGlzLmV4dGVuc2lvbi5wcmVSZWxlYXNlIDogdGhpcy5leHRlbnNpb24/Lmhhc1ByZVJlbGVhc2VWZXJzaW9uKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSBhcHBlbmQodGhpcy5wYXJlbnQsICQoJ2Rpdi5leHRlbnNpb24tYm9va21hcmsnKSk7XG5cdFx0XHRjb25zdCBwcmVSZWxlYXNlID0gYXBwZW5kKHRoaXMuZWxlbWVudCwgJCgnLnByZS1yZWxlYXNlJykpO1xuXHRcdFx0YXBwZW5kKHByZVJlbGVhc2UsICQoJ3NwYW4nICsgVGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IocHJlUmVsZWFzZUljb24pKSk7XG5cdFx0fVxuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIFJlbW90ZUJhZGdlV2lkZ2V0IGV4dGVuZHMgRXh0ZW5zaW9uV2lkZ2V0IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHJlbW90ZUJhZGdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPFJlbW90ZUJhZGdlPigpKTtcblxuXHRwcml2YXRlIGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHBhcmVudDogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB0b29sdGlwOiBib29sZWFuLFxuXHRcdEBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5lbGVtZW50ID0gYXBwZW5kKHBhcmVudCwgJCgnLmV4dGVuc2lvbi1yZW1vdGUtYmFkZ2UtY29udGFpbmVyJykpO1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMuY2xlYXIoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhcigpOiB2b2lkIHtcblx0XHR0aGlzLnJlbW90ZUJhZGdlLnZhbHVlPy5lbGVtZW50LnJlbW92ZSgpO1xuXHRcdHRoaXMucmVtb3RlQmFkZ2UuY2xlYXIoKTtcblx0fVxuXG5cdHJlbmRlcigpOiB2b2lkIHtcblx0XHR0aGlzLmNsZWFyKCk7XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbiB8fCAhdGhpcy5leHRlbnNpb24ubG9jYWwgfHwgIXRoaXMuZXh0ZW5zaW9uLnNlcnZlciB8fCAhKHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyICYmIHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcikgfHwgdGhpcy5leHRlbnNpb24uc2VydmVyICE9PSB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLnJlbW90ZUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5yZW1vdGVCYWRnZS52YWx1ZSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVtb3RlQmFkZ2UsIHRoaXMudG9vbHRpcCk7XG5cdFx0YXBwZW5kKHRoaXMuZWxlbWVudCwgdGhpcy5yZW1vdGVCYWRnZS52YWx1ZS5lbGVtZW50KTtcblx0fVxufVxuXG5jbGFzcyBSZW1vdGVCYWRnZSBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHJlYWRvbmx5IGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXHRyZWFkb25seSBlbGVtZW50SG92ZXI6IElNYW5hZ2VkSG92ZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSB0b29sdGlwOiBib29sZWFuLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2U6IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuZWxlbWVudCA9ICQoJ2Rpdi5leHRlbnNpb24tYmFkZ2UuZXh0ZW5zaW9uLXJlbW90ZS1iYWRnZScpO1xuXHRcdHRoaXMuZWxlbWVudEhvdmVyID0gdGhpcy5fcmVnaXN0ZXIoaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCB0aGlzLmVsZW1lbnQsICcnKSk7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyKCk6IHZvaWQge1xuXHRcdGFwcGVuZCh0aGlzLmVsZW1lbnQsICQoJ3NwYW4nICsgVGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IocmVtb3RlSWNvbikpKTtcblxuXHRcdGNvbnN0IGFwcGx5QmFkZ2VTdHlsZSA9ICgpID0+IHtcblx0XHRcdGlmICghdGhpcy5lbGVtZW50KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGJnQ29sb3IgPSB0aGlzLnRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkuZ2V0Q29sb3IoRVhURU5TSU9OX0JBREdFX1JFTU9URV9CQUNLR1JPVU5EKTtcblx0XHRcdGNvbnN0IGZnQ29sb3IgPSB0aGlzLnRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkuZ2V0Q29sb3IoRVhURU5TSU9OX0JBREdFX1JFTU9URV9GT1JFR1JPVU5EKTtcblx0XHRcdHRoaXMuZWxlbWVudC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBiZ0NvbG9yID8gYmdDb2xvci50b1N0cmluZygpIDogJyc7XG5cdFx0XHR0aGlzLmVsZW1lbnQuc3R5bGUuY29sb3IgPSBmZ0NvbG9yID8gZmdDb2xvci50b1N0cmluZygpIDogJyc7XG5cdFx0fTtcblx0XHRhcHBseUJhZGdlU3R5bGUoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnRoZW1lU2VydmljZS5vbkRpZENvbG9yVGhlbWVDaGFuZ2UoKCkgPT4gYXBwbHlCYWRnZVN0eWxlKCkpKTtcblxuXHRcdGlmICh0aGlzLnRvb2x0aXApIHtcblx0XHRcdGNvbnN0IHVwZGF0ZVRpdGxlID0gKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5lbGVtZW50ICYmIHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcikge1xuXHRcdFx0XHRcdHRoaXMuZWxlbWVudEhvdmVyLnVwZGF0ZShsb2NhbGl6ZSgncmVtb3RlIGV4dGVuc2lvbiB0aXRsZScsIFwiRXh0ZW5zaW9uIGluIHswfVwiLCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLnJlbW90ZUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIubGFiZWwpKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGFiZWxTZXJ2aWNlLm9uRGlkQ2hhbmdlRm9ybWF0dGVycygoKSA9PiB1cGRhdGVUaXRsZSgpKSk7XG5cdFx0XHR1cGRhdGVUaXRsZSgpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRXh0ZW5zaW9uUGFja0NvdW50V2lkZ2V0IGV4dGVuZHMgRXh0ZW5zaW9uV2lkZ2V0IHtcblxuXHRwcml2YXRlIGVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGNvdW50QmFkZ2U6IENvdW50QmFkZ2UgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBwYXJlbnQ6IEhUTUxFbGVtZW50LFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMuY2xlYXIoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhcigpOiB2b2lkIHtcblx0XHR0aGlzLmVsZW1lbnQ/LnJlbW92ZSgpO1xuXHRcdHRoaXMuY291bnRCYWRnZT8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuY291bnRCYWRnZSA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdHJlbmRlcigpOiB2b2lkIHtcblx0XHR0aGlzLmNsZWFyKCk7XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbiB8fCAhKHRoaXMuZXh0ZW5zaW9uLmNhdGVnb3JpZXM/LnNvbWUoY2F0ZWdvcnkgPT4gY2F0ZWdvcnkudG9Mb3dlckNhc2UoKSA9PT0gJ2V4dGVuc2lvbiBwYWNrcycpKSB8fCAhdGhpcy5leHRlbnNpb24uZXh0ZW5zaW9uUGFjay5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5lbGVtZW50ID0gYXBwZW5kKHRoaXMucGFyZW50LCAkKCcuZXh0ZW5zaW9uLWJhZGdlLmV4dGVuc2lvbi1wYWNrLWJhZGdlJykpO1xuXHRcdHRoaXMuY291bnRCYWRnZSA9IG5ldyBDb3VudEJhZGdlKHRoaXMuZWxlbWVudCwge30sIGRlZmF1bHRDb3VudEJhZGdlU3R5bGVzKTtcblx0XHR0aGlzLmNvdW50QmFkZ2Uuc2V0Q291bnQodGhpcy5leHRlbnNpb24uZXh0ZW5zaW9uUGFjay5sZW5ndGgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25LaW5kSW5kaWNhdG9yV2lkZ2V0IGV4dGVuZHMgRXh0ZW5zaW9uV2lkZ2V0IHtcblxuXHRwcml2YXRlIGVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsXG5cdFx0cHJpdmF0ZSBzbWFsbDogYm9vbGVhbixcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASUV4cGxvcmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4cGxvcmVyU2VydmljZTogSUV4cGxvcmVyU2VydmljZSxcblx0XHRASVZpZXdzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHZpZXdzU2VydmljZTogSVZpZXdzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnJlbmRlcigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLmNsZWFyKCkpKTtcblx0fVxuXG5cdHByaXZhdGUgY2xlYXIoKTogdm9pZCB7XG5cdFx0dGhpcy5lbGVtZW50Py5yZW1vdmUoKTtcblx0XHR0aGlzLmRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH1cblxuXHRyZW5kZXIoKTogdm9pZCB7XG5cdFx0dGhpcy5jbGVhcigpO1xuXG5cdFx0aWYgKHRoaXMuc21hbGwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uPy5wcml2YXRlKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQgPSBhcHBlbmQodGhpcy5jb250YWluZXIsICQoJy5leHRlbnNpb24ta2luZC1pbmRpY2F0b3InKSk7XG5cdFx0XHRhcHBlbmQodGhpcy5lbGVtZW50LCAkKCdzcGFuJyArIFRoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKHByaXZhdGVFeHRlbnNpb25JY29uKSkpO1xuXHRcdFx0aWYgKCF0aGlzLnNtYWxsKSB7XG5cdFx0XHRcdGFwcGVuZCh0aGlzLmVsZW1lbnQsICQoJ3NwYW4ucHJpdmF0ZS1leHRlbnNpb24tbGFiZWwnLCB1bmRlZmluZWQsIGxvY2FsaXplKCdwcml2YXRlRXh0ZW5zaW9uJywgXCJQcml2YXRlIEV4dGVuc2lvblwiKSkpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxvY2F0aW9uID0gdGhpcy5leHRlbnNpb24ucmVzb3VyY2VFeHRlbnNpb24/LmxvY2F0aW9uID8/ICh0aGlzLmV4dGVuc2lvbi5sb2NhbD8uc291cmNlID09PSAncmVzb3VyY2UnID8gdGhpcy5leHRlbnNpb24ubG9jYWw/LmxvY2F0aW9uIDogdW5kZWZpbmVkKTtcblx0XHRpZiAoIWxvY2F0aW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5lbGVtZW50ID0gYXBwZW5kKHRoaXMuY29udGFpbmVyLCAkKCcuZXh0ZW5zaW9uLWtpbmQtaW5kaWNhdG9yJykpO1xuXHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlciA9IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlRm9sZGVyKGxvY2F0aW9uKTtcblx0XHRpZiAod29ya3NwYWNlRm9sZGVyICYmIHRoaXMuZXh0ZW5zaW9uLmlzV29ya3NwYWNlU2NvcGVkKSB7XG5cdFx0XHR0aGlzLmVsZW1lbnQudGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgnd29ya3NwYWNlIGV4dGVuc2lvbicsIFwiV29ya3NwYWNlIEV4dGVuc2lvblwiKTtcblx0XHRcdHRoaXMuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdjbGlja2FibGUnKTtcblx0XHRcdHRoaXMuZWxlbWVudC5zZXRBdHRyaWJ1dGUoJ3JvbGUnLCAnYnV0dG9uJyk7XG5cdFx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgdGhpcy5lbGVtZW50LCB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkucmVsYXRpdmVQYXRoKHdvcmtzcGFjZUZvbGRlci51cmksIGxvY2F0aW9uKSkpO1xuXHRcdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQob25DbGljayh0aGlzLmVsZW1lbnQsICgpID0+IHtcblx0XHRcdFx0dGhpcy52aWV3c1NlcnZpY2Uub3BlblZpZXcoRVhQTE9SRVJfVklFV19JRCwgdHJ1ZSkudGhlbigoKSA9PiB0aGlzLmV4cGxvcmVyU2VydmljZS5zZWxlY3QobG9jYXRpb24sIHRydWUpKTtcblx0XHRcdH0pKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5kaXNwb3NhYmxlcy5hZGQodGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ21vdXNlJyksIHRoaXMuZWxlbWVudCwgbG9jYXRpb24ucGF0aCkpO1xuXHRcdFx0dGhpcy5lbGVtZW50LnRleHRDb250ZW50ID0gbG9jYWxpemUoJ2xvY2FsIGV4dGVuc2lvbicsIFwiTG9jYWwgRXh0ZW5zaW9uXCIpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU3luY0lnbm9yZWRXaWRnZXQgZXh0ZW5kcyBFeHRlbnNpb25XaWRnZXQge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2U6IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2U6IElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5maWx0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24sIGUgPT4gZS5hZmZlY3RzQ29uZmlndXJhdGlvbignc2V0dGluZ3NTeW5jLmlnbm9yZWRFeHRlbnNpb25zJykpKCgpID0+IHRoaXMucmVuZGVyKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih1c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5vbkRpZENoYW5nZUVuYWJsZW1lbnQoKCkgPT4gdGhpcy51cGRhdGUoKSkpO1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cdH1cblxuXHRyZW5kZXIoKTogdm9pZCB7XG5cdFx0dGhpcy5kaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdHRoaXMuY29udGFpbmVyLmlubmVyVGV4dCA9ICcnO1xuXG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uICYmIHRoaXMuZXh0ZW5zaW9uLnN0YXRlID09PSBFeHRlbnNpb25TdGF0ZS5JbnN0YWxsZWQgJiYgdGhpcy51c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5pc0VuYWJsZWQoKSAmJiB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmlzRXh0ZW5zaW9uSWdub3JlZFRvU3luYyh0aGlzLmV4dGVuc2lvbikpIHtcblx0XHRcdGNvbnN0IGVsZW1lbnQgPSBhcHBlbmQodGhpcy5jb250YWluZXIsICQoJ3NwYW4uZXh0ZW5zaW9uLXN5bmMtaWdub3JlZCcgKyBUaGVtZUljb24uYXNDU1NTZWxlY3RvcihzeW5jSWdub3JlZEljb24pKSk7XG5cdFx0XHR0aGlzLmRpc3Bvc2FibGVzLmFkZCh0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgZWxlbWVudCwgbG9jYWxpemUoJ3N5bmNpbmdvcmUubGFiZWwnLCBcIlRoaXMgZXh0ZW5zaW9uIGlzIGlnbm9yZWQgZHVyaW5nIHN5bmMuXCIpKSk7XG5cdFx0XHRlbGVtZW50LmNsYXNzTGlzdC5hZGQoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoc3luY0lnbm9yZWRJY29uKSk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25SdW50aW1lU3RhdHVzV2lkZ2V0IGV4dGVuZHMgRXh0ZW5zaW9uV2lkZ2V0IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblZpZXdTdGF0ZTogSUV4dGVuc2lvbnNWaWV3U3RhdGUsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASUV4dGVuc2lvbkZlYXR1cmVzTWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlOiBJRXh0ZW5zaW9uRmVhdHVyZXNNYW5hZ2VtZW50U2VydmljZSxcblx0XHRASUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2U6IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9yZWdpc3RlcihleHRlbnNpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlRXh0ZW5zaW9uc1N0YXR1cyhleHRlbnNpb25zID0+IHtcblx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbiAmJiBleHRlbnNpb25zLnNvbWUoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyh7IGlkOiBlLnZhbHVlIH0sIHRoaXMuZXh0ZW5zaW9uIS5pZGVudGlmaWVyKSkpIHtcblx0XHRcdFx0dGhpcy51cGRhdGUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZXh0ZW5zaW9uRmVhdHVyZXNNYW5hZ2VtZW50U2VydmljZS5vbkRpZENoYW5nZUFjY2Vzc0RhdGEoZSA9PiB7XG5cdFx0XHRpZiAodGhpcy5leHRlbnNpb24gJiYgRXh0ZW5zaW9uSWRlbnRpZmllci5lcXVhbHModGhpcy5leHRlbnNpb24uaWRlbnRpZmllci5pZCwgZS5leHRlbnNpb24pKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cmVuZGVyKCk6IHZvaWQge1xuXHRcdHRoaXMuY29udGFpbmVyLmlubmVyVGV4dCA9ICcnO1xuXG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmV4dGVuc2lvblZpZXdTdGF0ZS5maWx0ZXJzLmZlYXR1cmVJZCAmJiB0aGlzLmV4dGVuc2lvbi5zdGF0ZSA9PT0gRXh0ZW5zaW9uU3RhdGUuSW5zdGFsbGVkKSB7XG5cdFx0XHRjb25zdCBhY2Nlc3NEYXRhID0gdGhpcy5leHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlLmdldEFsbEFjY2Vzc0RhdGFGb3JFeHRlbnNpb24obmV3IEV4dGVuc2lvbklkZW50aWZpZXIodGhpcy5leHRlbnNpb24uaWRlbnRpZmllci5pZCkpLmdldCh0aGlzLmV4dGVuc2lvblZpZXdTdGF0ZS5maWx0ZXJzLmZlYXR1cmVJZCk7XG5cdFx0XHRjb25zdCBmZWF0dXJlID0gUmVnaXN0cnkuYXM8SUV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnk+KEV4dGVuc2lvbnMuRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeSkuZ2V0RXh0ZW5zaW9uRmVhdHVyZSh0aGlzLmV4dGVuc2lvblZpZXdTdGF0ZS5maWx0ZXJzLmZlYXR1cmVJZCk7XG5cdFx0XHRpZiAoZmVhdHVyZT8uaWNvbiAmJiBhY2Nlc3NEYXRhKSB7XG5cdFx0XHRcdGNvbnN0IGZlYXR1cmVBY2Nlc3NUaW1lRWxlbWVudCA9IGFwcGVuZCh0aGlzLmNvbnRhaW5lciwgJCgnc3Bhbi5hY3RpdmF0aW9uVGltZScpKTtcblx0XHRcdFx0ZmVhdHVyZUFjY2Vzc1RpbWVFbGVtZW50LnRleHRDb250ZW50ID0gbG9jYWxpemUoJ2ZlYXR1cmUgYWNjZXNzIGxhYmVsJywgXCJ7MH0gcmVxc1wiLCBhY2Nlc3NEYXRhLmFjY2Vzc1RpbWVzLmxlbmd0aCk7XG5cdFx0XHRcdGNvbnN0IGljb25FbGVtZW50ID0gYXBwZW5kKHRoaXMuY29udGFpbmVyLCAkKCdzcGFuJyArIFRoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGZlYXR1cmUuaWNvbikpKTtcblx0XHRcdFx0aWNvbkVsZW1lbnQuc3R5bGUucGFkZGluZ0xlZnQgPSAnNHB4Jztcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGV4dGVuc2lvblN0YXR1cyA9IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuZ2V0RXh0ZW5zaW9uUnVudGltZVN0YXR1cyh0aGlzLmV4dGVuc2lvbik7XG5cdFx0aWYgKGV4dGVuc2lvblN0YXR1cz8uYWN0aXZhdGlvblRpbWVzKSB7XG5cdFx0XHRjb25zdCBhY3RpdmF0aW9uVGltZSA9IGV4dGVuc2lvblN0YXR1cy5hY3RpdmF0aW9uVGltZXMuY29kZUxvYWRpbmdUaW1lICsgZXh0ZW5zaW9uU3RhdHVzLmFjdGl2YXRpb25UaW1lcy5hY3RpdmF0ZUNhbGxUaW1lO1xuXHRcdFx0YXBwZW5kKHRoaXMuY29udGFpbmVyLCAkKCdzcGFuJyArIFRoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGFjdGl2YXRpb25UaW1lSWNvbikpKTtcblx0XHRcdGNvbnN0IGFjdGl2YXRpb25UaW1lRWxlbWVudCA9IGFwcGVuZCh0aGlzLmNvbnRhaW5lciwgJCgnc3Bhbi5hY3RpdmF0aW9uVGltZScpKTtcblx0XHRcdGFjdGl2YXRpb25UaW1lRWxlbWVudC50ZXh0Q29udGVudCA9IGAke2FjdGl2YXRpb25UaW1lfW1zYDtcblx0XHR9XG5cdH1cblxufVxuXG5leHBvcnQgdHlwZSBFeHRlbnNpb25Ib3Zlck9wdGlvbnMgPSB7XG5cdHBvc2l0aW9uOiAoKSA9PiBIb3ZlclBvc2l0aW9uO1xuXHRyZWFkb25seSB0YXJnZXQ6IEhUTUxFbGVtZW50O1xufTtcblxuZXhwb3J0IGNsYXNzIEV4dGVuc2lvbkhvdmVyV2lkZ2V0IGV4dGVuZHMgRXh0ZW5zaW9uV2lkZ2V0IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGhvdmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPElEaXNwb3NhYmxlPigpKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IG9wdGlvbnM6IEV4dGVuc2lvbkhvdmVyT3B0aW9ucyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblN0YXR1c0FjdGlvbjogRXh0ZW5zaW9uU3RhdHVzQWN0aW9uLFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uRmVhdHVyZXNNYW5hZ2VtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbkZlYXR1cmVzTWFuYWdlbWVudFNlcnZpY2U6IElFeHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2U6IElFeHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cmVuZGVyKCk6IHZvaWQge1xuXHRcdHRoaXMuaG92ZXIudmFsdWUgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uKSB7XG5cdFx0XHR0aGlzLmhvdmVyLnZhbHVlID0gdGhpcy5ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoe1xuXHRcdFx0XHRkZWxheTogdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxudW1iZXI+KCd3b3JrYmVuY2guaG92ZXIuZGVsYXknKSxcblx0XHRcdFx0c2hvd0hvdmVyOiAob3B0aW9ucywgZm9jdXMpID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5ob3ZlclNlcnZpY2Uuc2hvd0luc3RhbnRIb3Zlcih7XG5cdFx0XHRcdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0XHRcdFx0YWRkaXRpb25hbENsYXNzZXM6IFsnZXh0ZW5zaW9uLWhvdmVyJ10sXG5cdFx0XHRcdFx0XHRwb3NpdGlvbjoge1xuXHRcdFx0XHRcdFx0XHRob3ZlclBvc2l0aW9uOiB0aGlzLm9wdGlvbnMucG9zaXRpb24oKSxcblx0XHRcdFx0XHRcdFx0Zm9yY2VQb3NpdGlvbjogdHJ1ZSxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRwZXJzaXN0ZW5jZToge1xuXHRcdFx0XHRcdFx0XHRoaWRlT25LZXlEb3duOiB0cnVlLFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sIGZvY3VzKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0cGxhY2VtZW50OiAnZWxlbWVudCdcblx0XHRcdH0sXG5cdFx0XHRcdHRoaXMub3B0aW9ucy50YXJnZXQsXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRtYXJrZG93bjogKCkgPT4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuZ2V0SG92ZXJNYXJrZG93bigpKSxcblx0XHRcdFx0XHRtYXJrZG93bk5vdFN1cHBvcnRlZEZhbGxiYWNrOiB1bmRlZmluZWRcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGFwcGVhcmFuY2U6IHtcblx0XHRcdFx0XHRcdHNob3dIb3ZlckhpbnQ6IHRydWVcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRIb3Zlck1hcmtkb3duKCk6IE1hcmtkb3duU3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBtYXJrZG93biA9IG5ldyBNYXJrZG93blN0cmluZygnJywgeyBpc1RydXN0ZWQ6IHRydWUsIHN1cHBvcnRUaGVtZUljb25zOiB0cnVlIH0pO1xuXG5cdFx0bWFya2Rvd24uYXBwZW5kTWFya2Rvd24oYCoqJHt0aGlzLmV4dGVuc2lvbi5kaXNwbGF5TmFtZX0qKmApO1xuXHRcdGlmIChzZW12ZXIudmFsaWQodGhpcy5leHRlbnNpb24udmVyc2lvbikpIHtcblx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGAmbmJzcDs8c3BhbiBzdHlsZT1cImJhY2tncm91bmQtY29sb3I6IzgwODA4MDJCO1wiPioqJm5ic3A7X3Yke3RoaXMuZXh0ZW5zaW9uLnZlcnNpb259JHsodGhpcy5leHRlbnNpb24uaXNQcmVSZWxlYXNlVmVyc2lvbiA/ICcgKHByZS1yZWxlYXNlKScgOiAnJyl9XyoqJm5ic3A7PC9zcGFuPmApO1xuXHRcdH1cblx0XHRtYXJrZG93bi5hcHBlbmRUZXh0KGBcXG5gKTtcblxuXHRcdGxldCBhZGRTZXBhcmF0b3IgPSBmYWxzZTtcblx0XHRpZiAodGhpcy5leHRlbnNpb24ucHJpdmF0ZSkge1xuXHRcdFx0bWFya2Rvd24uYXBwZW5kTWFya2Rvd24oYCQoJHtwcml2YXRlRXh0ZW5zaW9uSWNvbi5pZH0pICR7bG9jYWxpemUoJ3ByaXZhdGVFeHRlbnNpb24nLCBcIlByaXZhdGUgRXh0ZW5zaW9uXCIpfWApO1xuXHRcdFx0YWRkU2VwYXJhdG9yID0gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uLnN0YXRlID09PSBFeHRlbnNpb25TdGF0ZS5JbnN0YWxsZWQpIHtcblx0XHRcdGNvbnN0IGluc3RhbGxMYWJlbCA9IEluc3RhbGxDb3VudFdpZGdldC5nZXRJbnN0YWxsTGFiZWwodGhpcy5leHRlbnNpb24sIHRydWUpO1xuXHRcdFx0aWYgKGluc3RhbGxMYWJlbCkge1xuXHRcdFx0XHRpZiAoYWRkU2VwYXJhdG9yKSB7XG5cdFx0XHRcdFx0bWFya2Rvd24uYXBwZW5kVGV4dChgICB8ICBgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRtYXJrZG93bi5hcHBlbmRNYXJrZG93bihgJCgke2luc3RhbGxDb3VudEljb24uaWR9KSAke2luc3RhbGxMYWJlbH1gKTtcblx0XHRcdFx0YWRkU2VwYXJhdG9yID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbi5yYXRpbmcpIHtcblx0XHRcdFx0aWYgKGFkZFNlcGFyYXRvcikge1xuXHRcdFx0XHRcdG1hcmtkb3duLmFwcGVuZFRleHQoYCAgfCAgYCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgcmF0aW5nID0gTWF0aC5yb3VuZCh0aGlzLmV4dGVuc2lvbi5yYXRpbmcgKiAyKSAvIDI7XG5cdFx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGAkKCR7c3RhckZ1bGxJY29uLmlkfSkgWyR7cmF0aW5nfV0oJHt0aGlzLmV4dGVuc2lvbi51cmx9JnNzcj1mYWxzZSNyZXZpZXctZGV0YWlscylgKTtcblx0XHRcdFx0YWRkU2VwYXJhdG9yID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbi5wdWJsaXNoZXJTcG9uc29yTGluaykge1xuXHRcdFx0XHRpZiAoYWRkU2VwYXJhdG9yKSB7XG5cdFx0XHRcdFx0bWFya2Rvd24uYXBwZW5kVGV4dChgICB8ICBgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRtYXJrZG93bi5hcHBlbmRNYXJrZG93bihgJCgke3Nwb25zb3JJY29uLmlkfSkgWyR7bG9jYWxpemUoJ3Nwb25zb3InLCBcIlNwb25zb3JcIil9XSgke3RoaXMuZXh0ZW5zaW9uLnB1Ymxpc2hlclNwb25zb3JMaW5rfSlgKTtcblx0XHRcdFx0YWRkU2VwYXJhdG9yID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKGFkZFNlcGFyYXRvcikge1xuXHRcdFx0bWFya2Rvd24uYXBwZW5kVGV4dChgXFxuYCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbG9jYXRpb24gPSB0aGlzLmV4dGVuc2lvbi5yZXNvdXJjZUV4dGVuc2lvbj8ubG9jYXRpb24gPz8gKHRoaXMuZXh0ZW5zaW9uLmxvY2FsPy5zb3VyY2UgPT09ICdyZXNvdXJjZScgPyB0aGlzLmV4dGVuc2lvbi5sb2NhbD8ubG9jYXRpb24gOiB1bmRlZmluZWQpO1xuXHRcdGlmIChsb2NhdGlvbikge1xuXHRcdFx0aWYgKHRoaXMuZXh0ZW5zaW9uLmlzV29ya3NwYWNlU2NvcGVkICYmIHRoaXMuY29udGV4dFNlcnZpY2UuaXNJbnNpZGVXb3Jrc3BhY2UobG9jYXRpb24pKSB7XG5cdFx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGxvY2FsaXplKCd3b3Jrc3BhY2UgZXh0ZW5zaW9uJywgXCJXb3Jrc3BhY2UgRXh0ZW5zaW9uXCIpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGxvY2FsaXplKCdsb2NhbCBleHRlbnNpb24nLCBcIkxvY2FsIEV4dGVuc2lvblwiKSk7XG5cdFx0XHR9XG5cdFx0XHRtYXJrZG93bi5hcHBlbmRUZXh0KGBcXG5gKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5leHRlbnNpb24uZGVzY3JpcHRpb24pIHtcblx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGAke3RoaXMuZXh0ZW5zaW9uLmRlc2NyaXB0aW9ufWApO1xuXHRcdFx0bWFya2Rvd24uYXBwZW5kVGV4dChgXFxuYCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uLnB1Ymxpc2hlckRvbWFpbj8udmVyaWZpZWQpIHtcblx0XHRcdGNvbnN0IGJnQ29sb3IgPSB0aGlzLnRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkuZ2V0Q29sb3IoZXh0ZW5zaW9uVmVyaWZpZWRQdWJsaXNoZXJJY29uQ29sb3IpO1xuXHRcdFx0Y29uc3QgcHVibGlzaGVyVmVyaWZpZWRUb29sdGlwID0gbG9jYWxpemUoJ3B1Ymxpc2hlciB2ZXJpZmllZCB0b29sdGlwJywgXCJUaGlzIHB1Ymxpc2hlciBoYXMgdmVyaWZpZWQgb3duZXJzaGlwIG9mIHswfVwiLCBgWyR7VVJJLnBhcnNlKHRoaXMuZXh0ZW5zaW9uLnB1Ymxpc2hlckRvbWFpbi5saW5rKS5hdXRob3JpdHl9XSgke3RoaXMuZXh0ZW5zaW9uLnB1Ymxpc2hlckRvbWFpbi5saW5rfSlgKTtcblx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGA8c3BhbiBzdHlsZT1cImNvbG9yOiR7YmdDb2xvciA/IENvbG9yLkZvcm1hdC5DU1MuZm9ybWF0SGV4KGJnQ29sb3IpIDogJyNmZmZmZmYnfTtcIj4kKCR7dmVyaWZpZWRQdWJsaXNoZXJJY29uLmlkfSk8L3NwYW4+Jm5ic3A7JHtwdWJsaXNoZXJWZXJpZmllZFRvb2x0aXB9YCk7XG5cdFx0XHRtYXJrZG93bi5hcHBlbmRUZXh0KGBcXG5gKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5leHRlbnNpb24ub3V0ZGF0ZWQpIHtcblx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGxvY2FsaXplKCd1cGRhdGVSZXF1aXJlZCcsIFwiTGF0ZXN0IHZlcnNpb246XCIpKTtcblx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGAmbmJzcDs8c3BhbiBzdHlsZT1cImJhY2tncm91bmQtY29sb3I6IzgwODA4MDJCO1wiPioqJm5ic3A7X3Yke3RoaXMuZXh0ZW5zaW9uLmxhdGVzdFZlcnNpb259XyoqJm5ic3A7PC9zcGFuPmApO1xuXHRcdFx0bWFya2Rvd24uYXBwZW5kVGV4dChgXFxuYCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcHJlUmVsZWFzZU1lc3NhZ2UgPSBFeHRlbnNpb25Ib3ZlcldpZGdldC5nZXRQcmVSZWxlYXNlTWVzc2FnZSh0aGlzLmV4dGVuc2lvbik7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uUnVudGltZVN0YXR1cyA9IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuZ2V0RXh0ZW5zaW9uUnVudGltZVN0YXR1cyh0aGlzLmV4dGVuc2lvbik7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uRmVhdHVyZXNBY2Nlc3NEYXRhID0gdGhpcy5leHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlLmdldEFsbEFjY2Vzc0RhdGFGb3JFeHRlbnNpb24obmV3IEV4dGVuc2lvbklkZW50aWZpZXIodGhpcy5leHRlbnNpb24uaWRlbnRpZmllci5pZCkpO1xuXHRcdGNvbnN0IGV4dGVuc2lvblN0YXR1cyA9IHRoaXMuZXh0ZW5zaW9uU3RhdHVzQWN0aW9uLnN0YXR1cztcblx0XHRjb25zdCBydW50aW1lU3RhdGUgPSB0aGlzLmV4dGVuc2lvbi5ydW50aW1lU3RhdGU7XG5cdFx0Y29uc3QgcmVjb21tZW5kYXRpb25NZXNzYWdlID0gdGhpcy5nZXRSZWNvbW1lbmRhdGlvbk1lc3NhZ2UodGhpcy5leHRlbnNpb24pO1xuXG5cdFx0aWYgKGV4dGVuc2lvblJ1bnRpbWVTdGF0dXMgfHwgZXh0ZW5zaW9uRmVhdHVyZXNBY2Nlc3NEYXRhLnNpemUgfHwgZXh0ZW5zaW9uU3RhdHVzLmxlbmd0aCB8fCBydW50aW1lU3RhdGUgfHwgcmVjb21tZW5kYXRpb25NZXNzYWdlIHx8IHByZVJlbGVhc2VNZXNzYWdlKSB7XG5cblx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGAtLS1gKTtcblx0XHRcdG1hcmtkb3duLmFwcGVuZFRleHQoYFxcbmApO1xuXG5cdFx0XHRpZiAoZXh0ZW5zaW9uUnVudGltZVN0YXR1cykge1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uUnVudGltZVN0YXR1cy5hY3RpdmF0aW9uVGltZXMpIHtcblx0XHRcdFx0XHRjb25zdCBhY3RpdmF0aW9uVGltZSA9IGV4dGVuc2lvblJ1bnRpbWVTdGF0dXMuYWN0aXZhdGlvblRpbWVzLmNvZGVMb2FkaW5nVGltZSArIGV4dGVuc2lvblJ1bnRpbWVTdGF0dXMuYWN0aXZhdGlvblRpbWVzLmFjdGl2YXRlQ2FsbFRpbWU7XG5cdFx0XHRcdFx0bWFya2Rvd24uYXBwZW5kTWFya2Rvd24oYCR7bG9jYWxpemUoJ2FjdGl2YXRpb24nLCBcIkFjdGl2YXRpb24gdGltZVwiKX0ke2V4dGVuc2lvblJ1bnRpbWVTdGF0dXMuYWN0aXZhdGlvblRpbWVzLmFjdGl2YXRpb25SZWFzb24uc3RhcnR1cCA/IGAgKCR7bG9jYWxpemUoJ3N0YXJ0dXAnLCBcIlN0YXJ0dXBcIil9KWAgOiAnJ306IFxcYCR7YWN0aXZhdGlvblRpbWV9bXNcXGBgKTtcblx0XHRcdFx0XHRtYXJrZG93bi5hcHBlbmRUZXh0KGBcXG5gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uUnVudGltZVN0YXR1cy5ydW50aW1lRXJyb3JzLmxlbmd0aCB8fCBleHRlbnNpb25SdW50aW1lU3RhdHVzLm1lc3NhZ2VzLmxlbmd0aCkge1xuXHRcdFx0XHRcdGNvbnN0IGhhc0Vycm9ycyA9IGV4dGVuc2lvblJ1bnRpbWVTdGF0dXMucnVudGltZUVycm9ycy5sZW5ndGggfHwgZXh0ZW5zaW9uUnVudGltZVN0YXR1cy5tZXNzYWdlcy5zb21lKG1lc3NhZ2UgPT4gbWVzc2FnZS50eXBlID09PSBTZXZlcml0eS5FcnJvcik7XG5cdFx0XHRcdFx0Y29uc3QgaGFzV2FybmluZ3MgPSBleHRlbnNpb25SdW50aW1lU3RhdHVzLm1lc3NhZ2VzLnNvbWUobWVzc2FnZSA9PiBtZXNzYWdlLnR5cGUgPT09IFNldmVyaXR5Lldhcm5pbmcpO1xuXHRcdFx0XHRcdGNvbnN0IGVycm9yc0xpbmsgPSBleHRlbnNpb25SdW50aW1lU3RhdHVzLnJ1bnRpbWVFcnJvcnMubGVuZ3RoID8gYFske2V4dGVuc2lvblJ1bnRpbWVTdGF0dXMucnVudGltZUVycm9ycy5sZW5ndGggPT09IDEgPyBsb2NhbGl6ZSgndW5jYXVnaHQgZXJyb3InLCAnMSB1bmNhdWdodCBlcnJvcicpIDogbG9jYWxpemUoJ3VuY2F1Z2h0IGVycm9ycycsICd7MH0gdW5jYXVnaHQgZXJyb3JzJywgZXh0ZW5zaW9uUnVudGltZVN0YXR1cy5ydW50aW1lRXJyb3JzLmxlbmd0aCl9XSgke1VSSS5wYXJzZShgY29tbWFuZDpleHRlbnNpb24ub3Blbj8ke2VuY29kZVVSSUNvbXBvbmVudChKU09OLnN0cmluZ2lmeShbdGhpcy5leHRlbnNpb24uaWRlbnRpZmllci5pZCwgRXh0ZW5zaW9uRWRpdG9yVGFiLkZlYXR1cmVzXSkpfWApfSlgIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRcdGNvbnN0IG1lc3NhZ2VMaW5rID0gZXh0ZW5zaW9uUnVudGltZVN0YXR1cy5tZXNzYWdlcy5sZW5ndGggPyBgWyR7ZXh0ZW5zaW9uUnVudGltZVN0YXR1cy5tZXNzYWdlcy5sZW5ndGggPT09IDEgPyBsb2NhbGl6ZSgnbWVzc2FnZScsICcxIG1lc3NhZ2UnKSA6IGxvY2FsaXplKCdtZXNzYWdlcycsICd7MH0gbWVzc2FnZXMnLCBleHRlbnNpb25SdW50aW1lU3RhdHVzLm1lc3NhZ2VzLmxlbmd0aCl9XSgke1VSSS5wYXJzZShgY29tbWFuZDpleHRlbnNpb24ub3Blbj8ke2VuY29kZVVSSUNvbXBvbmVudChKU09OLnN0cmluZ2lmeShbdGhpcy5leHRlbnNpb24uaWRlbnRpZmllci5pZCwgRXh0ZW5zaW9uRWRpdG9yVGFiLkZlYXR1cmVzXSkpfWApfSlgIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGAkKCR7aGFzRXJyb3JzID8gZXJyb3JJY29uLmlkIDogaGFzV2FybmluZ3MgPyB3YXJuaW5nSWNvbi5pZCA6IGluZm9JY29uLmlkfSkgVGhpcyBleHRlbnNpb24gaGFzIHJlcG9ydGVkIGApO1xuXHRcdFx0XHRcdGlmIChlcnJvcnNMaW5rICYmIG1lc3NhZ2VMaW5rKSB7XG5cdFx0XHRcdFx0XHRtYXJrZG93bi5hcHBlbmRNYXJrZG93bihgJHtlcnJvcnNMaW5rfSBhbmQgJHttZXNzYWdlTGlua31gKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0bWFya2Rvd24uYXBwZW5kTWFya2Rvd24oYCR7ZXJyb3JzTGluayB8fCBtZXNzYWdlTGlua31gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bWFya2Rvd24uYXBwZW5kVGV4dChgXFxuYCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKGV4dGVuc2lvbkZlYXR1cmVzQWNjZXNzRGF0YS5zaXplKSB7XG5cdFx0XHRcdGNvbnN0IHJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnk+KEV4dGVuc2lvbnMuRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeSk7XG5cdFx0XHRcdGZvciAoY29uc3QgW2ZlYXR1cmVJZCwgYWNjZXNzRGF0YV0gb2YgZXh0ZW5zaW9uRmVhdHVyZXNBY2Nlc3NEYXRhKSB7XG5cdFx0XHRcdFx0aWYgKGFjY2Vzc0RhdGE/LmFjY2Vzc1RpbWVzLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgZmVhdHVyZSA9IHJlZ2lzdHJ5LmdldEV4dGVuc2lvbkZlYXR1cmUoZmVhdHVyZUlkKTtcblx0XHRcdFx0XHRcdGlmIChmZWF0dXJlKSB7XG5cdFx0XHRcdFx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGxvY2FsaXplKCdmZWF0dXJlIHVzYWdlIGxhYmVsJywgXCJ7MH0gdXNhZ2VcIiwgZmVhdHVyZS5sYWJlbCkpO1xuXHRcdFx0XHRcdFx0XHRtYXJrZG93bi5hcHBlbmRNYXJrZG93bihgOiBbJHtsb2NhbGl6ZSgndG90YWwnLCBcInswfSB7MX0gcmVxdWVzdHMgaW4gbGFzdCAzMCBkYXlzXCIsIGFjY2Vzc0RhdGEuYWNjZXNzVGltZXMubGVuZ3RoLCBmZWF0dXJlLmFjY2Vzc0RhdGFMYWJlbCA/PyBmZWF0dXJlLmxhYmVsKX1dKCR7VVJJLnBhcnNlKGBjb21tYW5kOmV4dGVuc2lvbi5vcGVuPyR7ZW5jb2RlVVJJQ29tcG9uZW50KEpTT04uc3RyaW5naWZ5KFt0aGlzLmV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLCBFeHRlbnNpb25FZGl0b3JUYWIuRmVhdHVyZXNdKSl9YCl9KWApO1xuXHRcdFx0XHRcdFx0XHRtYXJrZG93bi5hcHBlbmRUZXh0KGBcXG5gKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBzdGF0dXMgb2YgZXh0ZW5zaW9uU3RhdHVzKSB7XG5cdFx0XHRcdGlmIChzdGF0dXMuaWNvbikge1xuXHRcdFx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGAkKCR7c3RhdHVzLmljb24uaWR9KSZuYnNwO2ApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKHN0YXR1cy5tZXNzYWdlLnZhbHVlKTtcblx0XHRcdFx0bWFya2Rvd24uYXBwZW5kVGV4dChgXFxuYCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChydW50aW1lU3RhdGUpIHtcblx0XHRcdFx0bWFya2Rvd24uYXBwZW5kTWFya2Rvd24oYCQoJHtpbmZvSWNvbi5pZH0pJm5ic3A7YCk7XG5cdFx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGAke3J1bnRpbWVTdGF0ZS5yZWFzb259YCk7XG5cdFx0XHRcdG1hcmtkb3duLmFwcGVuZFRleHQoYFxcbmApO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocHJlUmVsZWFzZU1lc3NhZ2UpIHtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uUHJlUmVsZWFzZUljb24gPSB0aGlzLnRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkuZ2V0Q29sb3IoZXh0ZW5zaW9uUHJlUmVsZWFzZUljb25Db2xvcik7XG5cdFx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGA8c3BhbiBzdHlsZT1cImNvbG9yOiR7ZXh0ZW5zaW9uUHJlUmVsZWFzZUljb24gPyBDb2xvci5Gb3JtYXQuQ1NTLmZvcm1hdEhleChleHRlbnNpb25QcmVSZWxlYXNlSWNvbikgOiAnI2ZmZmZmZid9O1wiPiQoJHtwcmVSZWxlYXNlSWNvbi5pZH0pPC9zcGFuPiZuYnNwOyR7cHJlUmVsZWFzZU1lc3NhZ2V9YCk7XG5cdFx0XHRcdG1hcmtkb3duLmFwcGVuZFRleHQoYFxcbmApO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmVjb21tZW5kYXRpb25NZXNzYWdlKSB7XG5cdFx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKHJlY29tbWVuZGF0aW9uTWVzc2FnZSk7XG5cdFx0XHRcdG1hcmtkb3duLmFwcGVuZFRleHQoYFxcbmApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBtYXJrZG93bjtcblx0fVxuXG5cdHByaXZhdGUgZ2V0UmVjb21tZW5kYXRpb25NZXNzYWdlKGV4dGVuc2lvbjogSUV4dGVuc2lvbik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKGV4dGVuc2lvbi5zdGF0ZSA9PT0gRXh0ZW5zaW9uU3RhdGUuSW5zdGFsbGVkKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAoZXh0ZW5zaW9uLmRlcHJlY2F0aW9uSW5mbykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgcmVjb21tZW5kYXRpb24gPSB0aGlzLmV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UuZ2V0QWxsUmVjb21tZW5kYXRpb25zV2l0aFJlYXNvbigpW2V4dGVuc2lvbi5pZGVudGlmaWVyLmlkLnRvTG93ZXJDYXNlKCldO1xuXHRcdGlmICghcmVjb21tZW5kYXRpb24/LnJlYXNvblRleHQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IGJnQ29sb3IgPSB0aGlzLnRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCkuZ2V0Q29sb3IoZXh0ZW5zaW9uQnV0dG9uUHJvbWluZW50QmFja2dyb3VuZCk7XG5cdFx0cmV0dXJuIGA8c3BhbiBzdHlsZT1cImNvbG9yOiR7YmdDb2xvciA/IENvbG9yLkZvcm1hdC5DU1MuZm9ybWF0SGV4KGJnQ29sb3IpIDogJyNmZmZmZmYnfTtcIj4kKCR7c3RhckVtcHR5SWNvbi5pZH0pPC9zcGFuPiZuYnNwOyR7cmVjb21tZW5kYXRpb24ucmVhc29uVGV4dH1gO1xuXHR9XG5cblx0c3RhdGljIGdldFByZVJlbGVhc2VNZXNzYWdlKGV4dGVuc2lvbjogSUV4dGVuc2lvbik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCFleHRlbnNpb24uaGFzUHJlUmVsZWFzZVZlcnNpb24pIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmIChleHRlbnNpb24uaXNCdWlsdGluKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAoZXh0ZW5zaW9uLmlzUHJlUmVsZWFzZVZlcnNpb24pIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmIChleHRlbnNpb24ucHJlUmVsZWFzZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgcHJlUmVsZWFzZVZlcnNpb25MaW5rID0gYFske2xvY2FsaXplKCdTaG93IHByZXJlbGVhc2UgdmVyc2lvbicsIFwiUHJlLVJlbGVhc2UgdmVyc2lvblwiKX1dKCR7VVJJLnBhcnNlKGBjb21tYW5kOndvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5zaG93UHJlUmVsZWFzZVZlcnNpb24/JHtlbmNvZGVVUklDb21wb25lbnQoSlNPTi5zdHJpbmdpZnkoW2V4dGVuc2lvbi5pZGVudGlmaWVyLmlkXSkpfWApfSlgO1xuXHRcdHJldHVybiBsb2NhbGl6ZSgnaGFzIHByZXJlbGVhc2UnLCBcIlRoaXMgZXh0ZW5zaW9uIGhhcyBhIHswfSBhdmFpbGFibGVcIiwgcHJlUmVsZWFzZVZlcnNpb25MaW5rKTtcblx0fVxuXG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25TdGF0dXNXaWRnZXQgZXh0ZW5kcyBFeHRlbnNpb25XaWRnZXQge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgcmVuZGVyRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZW5kZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRSZW5kZXI6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRSZW5kZXIuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uU3RhdHVzQWN0aW9uOiBFeHRlbnNpb25TdGF0dXNBY3Rpb24sXG5cdFx0QElPcGVuZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5yZW5kZXIoKTtcblx0XHR0aGlzLl9yZWdpc3RlcihleHRlbnNpb25TdGF0dXNBY3Rpb24ub25EaWRDaGFuZ2VTdGF0dXMoKCkgPT4gdGhpcy5yZW5kZXIoKSkpO1xuXHR9XG5cblx0cmVuZGVyKCk6IHZvaWQge1xuXHRcdHJlc2V0KHRoaXMuY29udGFpbmVyKTtcblx0XHR0aGlzLnJlbmRlckRpc3Bvc2FibGVzLnZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHRoaXMucmVuZGVyRGlzcG9zYWJsZXMudmFsdWUgPSBkaXNwb3NhYmxlcztcblx0XHRjb25zdCBleHRlbnNpb25TdGF0dXMgPSB0aGlzLmV4dGVuc2lvblN0YXR1c0FjdGlvbi5zdGF0dXM7XG5cdFx0aWYgKGV4dGVuc2lvblN0YXR1cy5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IG1hcmtkb3duID0gbmV3IE1hcmtkb3duU3RyaW5nKCcnLCB7IGlzVHJ1c3RlZDogdHJ1ZSwgc3VwcG9ydFRoZW1lSWNvbnM6IHRydWUgfSk7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGV4dGVuc2lvblN0YXR1cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBzdGF0dXMgPSBleHRlbnNpb25TdGF0dXNbaV07XG5cdFx0XHRcdGlmIChzdGF0dXMuaWNvbikge1xuXHRcdFx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGAkKCR7c3RhdHVzLmljb24uaWR9KSZuYnNwO2ApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKHN0YXR1cy5tZXNzYWdlLnZhbHVlKTtcblx0XHRcdFx0aWYgKGkgPCBleHRlbnNpb25TdGF0dXMubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRcdG1hcmtkb3duLmFwcGVuZFRleHQoYFxcbmApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjb25zdCByZW5kZXJlZCA9IGRpc3Bvc2FibGVzLmFkZChyZW5kZXJNYXJrZG93bihtYXJrZG93biwge1xuXHRcdFx0XHRhY3Rpb25IYW5kbGVyOiB7XG5cdFx0XHRcdFx0Y2FsbGJhY2s6IChjb250ZW50KSA9PiB7XG5cdFx0XHRcdFx0XHR0aGlzLm9wZW5lclNlcnZpY2Uub3Blbihjb250ZW50LCB7IGFsbG93Q29tbWFuZHM6IHRydWUgfSkuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXNcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdFx0YXBwZW5kKHRoaXMuY29udGFpbmVyLCByZW5kZXJlZC5lbGVtZW50KTtcblx0XHR9XG5cdFx0dGhpcy5fb25EaWRSZW5kZXIuZmlyZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25SZWNvbW1lbmRhdGlvbldpZGdldCBleHRlbmRzIEV4dGVuc2lvbldpZGdldCB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZW5kZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRSZW5kZXI6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRSZW5kZXIuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdEBJRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2U6IElFeHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uSWdub3JlZFJlY29tbWVuZGF0aW9uc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25JZ25vcmVkUmVjb21tZW5kYXRpb25zU2VydmljZTogSUV4dGVuc2lvbklnbm9yZWRSZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5leHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLm9uRGlkQ2hhbmdlUmVjb21tZW5kYXRpb25zKCgpID0+IHRoaXMucmVuZGVyKCkpKTtcblx0fVxuXG5cdHJlbmRlcigpOiB2b2lkIHtcblx0XHRyZXNldCh0aGlzLmNvbnRhaW5lcik7XG5cdFx0Y29uc3QgcmVjb21tZW5kYXRpb25TdGF0dXMgPSB0aGlzLmdldFJlY29tbWVuZGF0aW9uU3RhdHVzKCk7XG5cdFx0aWYgKHJlY29tbWVuZGF0aW9uU3RhdHVzKSB7XG5cdFx0XHRpZiAocmVjb21tZW5kYXRpb25TdGF0dXMuaWNvbikge1xuXHRcdFx0XHRhcHBlbmQodGhpcy5jb250YWluZXIsICQoYGRpdiR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IocmVjb21tZW5kYXRpb25TdGF0dXMuaWNvbil9YCkpO1xuXHRcdFx0fVxuXHRcdFx0YXBwZW5kKHRoaXMuY29udGFpbmVyLCAkKGBkaXYucmVjb21tZW5kYXRpb24tdGV4dGAsIHVuZGVmaW5lZCwgcmVjb21tZW5kYXRpb25TdGF0dXMubWVzc2FnZSkpO1xuXHRcdH1cblx0XHR0aGlzLl9vbkRpZFJlbmRlci5maXJlKCk7XG5cdH1cblxuXHRwcml2YXRlIGdldFJlY29tbWVuZGF0aW9uU3RhdHVzKCk6IHsgaWNvbjogVGhlbWVJY29uIHwgdW5kZWZpbmVkOyBtZXNzYWdlOiBzdHJpbmcgfSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvblxuXHRcdFx0fHwgdGhpcy5leHRlbnNpb24uZGVwcmVjYXRpb25JbmZvXG5cdFx0XHR8fCB0aGlzLmV4dGVuc2lvbi5zdGF0ZSA9PT0gRXh0ZW5zaW9uU3RhdGUuSW5zdGFsbGVkXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBleHRSZWNvbW1lbmRhdGlvbnMgPSB0aGlzLmV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UuZ2V0QWxsUmVjb21tZW5kYXRpb25zV2l0aFJlYXNvbigpO1xuXHRcdGlmIChleHRSZWNvbW1lbmRhdGlvbnNbdGhpcy5leHRlbnNpb24uaWRlbnRpZmllci5pZC50b0xvd2VyQ2FzZSgpXSkge1xuXHRcdFx0Y29uc3QgcmVhc29uVGV4dCA9IGV4dFJlY29tbWVuZGF0aW9uc1t0aGlzLmV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLnRvTG93ZXJDYXNlKCldLnJlYXNvblRleHQ7XG5cdFx0XHRpZiAocmVhc29uVGV4dCkge1xuXHRcdFx0XHRyZXR1cm4geyBpY29uOiBzdGFyRW1wdHlJY29uLCBtZXNzYWdlOiByZWFzb25UZXh0IH07XG5cdFx0XHR9XG5cdFx0fSBlbHNlIGlmICh0aGlzLmV4dGVuc2lvbklnbm9yZWRSZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLmdsb2JhbElnbm9yZWRSZWNvbW1lbmRhdGlvbnMuaW5kZXhPZih0aGlzLmV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLnRvTG93ZXJDYXNlKCkpICE9PSAtMSkge1xuXHRcdFx0cmV0dXJuIHsgaWNvbjogdW5kZWZpbmVkLCBtZXNzYWdlOiBsb2NhbGl6ZSgncmVjb21tZW5kYXRpb25IYXNCZWVuSWdub3JlZCcsIFwiWW91IGhhdmUgY2hvc2VuIG5vdCB0byByZWNlaXZlIHJlY29tbWVuZGF0aW9ucyBmb3IgdGhpcyBleHRlbnNpb24uXCIpIH07XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IGV4dGVuc2lvblJhdGluZ0ljb25Db2xvciA9IHJlZ2lzdGVyQ29sb3IoJ2V4dGVuc2lvbkljb24uc3RhckZvcmVncm91bmQnLCB7IGxpZ2h0OiAnI0RGNjEwMCcsIGRhcms6ICcjRkY4RTAwJywgaGNEYXJrOiAnI0ZGOEUwMCcsIGhjTGlnaHQ6IHRleHRMaW5rRm9yZWdyb3VuZCB9LCBsb2NhbGl6ZSgnZXh0ZW5zaW9uSWNvblN0YXJGb3JlZ3JvdW5kJywgXCJUaGUgaWNvbiBjb2xvciBmb3IgZXh0ZW5zaW9uIHJhdGluZ3MuXCIpLCBmYWxzZSk7XG5leHBvcnQgY29uc3QgZXh0ZW5zaW9uUHJlUmVsZWFzZUljb25Db2xvciA9IHJlZ2lzdGVyQ29sb3IoJ2V4dGVuc2lvbkljb24ucHJlUmVsZWFzZUZvcmVncm91bmQnLCB7IGRhcms6ICcjMWQ5MjcxJywgbGlnaHQ6ICcjMWQ5MjcxJywgaGNEYXJrOiAnIzFkOTI3MScsIGhjTGlnaHQ6IHRleHRMaW5rRm9yZWdyb3VuZCB9LCBsb2NhbGl6ZSgnZXh0ZW5zaW9uUHJlUmVsZWFzZUZvcmVncm91bmQnLCBcIlRoZSBpY29uIGNvbG9yIGZvciBwcmUtcmVsZWFzZSBleHRlbnNpb24uXCIpLCBmYWxzZSk7XG5leHBvcnQgY29uc3QgZXh0ZW5zaW9uU3BvbnNvckljb25Db2xvciA9IHJlZ2lzdGVyQ29sb3IoJ2V4dGVuc2lvbkljb24uc3BvbnNvckZvcmVncm91bmQnLCB7IGxpZ2h0OiAnI0I1MUU3OCcsIGRhcms6ICcjRDc1OEIzJywgaGNEYXJrOiBudWxsLCBoY0xpZ2h0OiAnI0I1MUU3OCcgfSwgbG9jYWxpemUoJ2V4dGVuc2lvbkljb24uc3BvbnNvckZvcmVncm91bmQnLCBcIlRoZSBpY29uIGNvbG9yIGZvciBleHRlbnNpb24gc3BvbnNvci5cIiksIGZhbHNlKTtcbmV4cG9ydCBjb25zdCBleHRlbnNpb25Qcml2YXRlQmFkZ2VCYWNrZ3JvdW5kID0gcmVnaXN0ZXJDb2xvcignZXh0ZW5zaW9uSWNvbi5wcml2YXRlRm9yZWdyb3VuZCcsIHsgZGFyazogJyNmZmZmZmY2MCcsIGxpZ2h0OiAnIzAwMDAwMDYwJywgaGNEYXJrOiAnI2ZmZmZmZjYwJywgaGNMaWdodDogJyMwMDAwMDA2MCcgfSwgbG9jYWxpemUoJ2V4dGVuc2lvbkljb24ucHJpdmF0ZScsIFwiVGhlIGljb24gY29sb3IgZm9yIHByaXZhdGUgZXh0ZW5zaW9ucy5cIikpO1xuXG5yZWdpc3RlclRoZW1pbmdQYXJ0aWNpcGFudCgodGhlbWUsIGNvbGxlY3RvcikgPT4ge1xuXHRjb25zdCBleHRlbnNpb25SYXRpbmdJY29uID0gdGhlbWUuZ2V0Q29sb3IoZXh0ZW5zaW9uUmF0aW5nSWNvbkNvbG9yKTtcblx0aWYgKGV4dGVuc2lvblJhdGluZ0ljb24pIHtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLmV4dGVuc2lvbi1yYXRpbmdzIC5jb2RpY29uLWV4dGVuc2lvbnMtc3Rhci1mdWxsLCAuZXh0ZW5zaW9uLXJhdGluZ3MgLmNvZGljb24tZXh0ZW5zaW9ucy1zdGFyLWhhbGYgeyBjb2xvcjogJHtleHRlbnNpb25SYXRpbmdJY29ufTsgfWApO1xuXHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAubW9uYWNvLWhvdmVyLmV4dGVuc2lvbi1ob3ZlciAubWFya2Rvd24taG92ZXIgLmhvdmVyLWNvbnRlbnRzICR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3Ioc3RhckZ1bGxJY29uKX0geyBjb2xvcjogJHtleHRlbnNpb25SYXRpbmdJY29ufTsgfWApO1xuXHR9XG5cblx0Y29uc3QgZXh0ZW5zaW9uVmVyaWZpZWRQdWJsaXNoZXJJY29uID0gdGhlbWUuZ2V0Q29sb3IoZXh0ZW5zaW9uVmVyaWZpZWRQdWJsaXNoZXJJY29uQ29sb3IpO1xuXHRpZiAoZXh0ZW5zaW9uVmVyaWZpZWRQdWJsaXNoZXJJY29uKSB7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYCR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IodmVyaWZpZWRQdWJsaXNoZXJJY29uKX0geyBjb2xvcjogJHtleHRlbnNpb25WZXJpZmllZFB1Ymxpc2hlckljb259OyB9YCk7XG5cdH1cblxuXHRjb2xsZWN0b3IuYWRkUnVsZShgLm1vbmFjby1ob3Zlci5leHRlbnNpb24taG92ZXIgLm1hcmtkb3duLWhvdmVyIC5ob3Zlci1jb250ZW50cyAke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKHNwb25zb3JJY29uKX0geyBjb2xvcjogdmFyKC0tdnNjb2RlLWV4dGVuc2lvbkljb24tc3BvbnNvckZvcmVncm91bmQpOyB9YCk7XG5cdGNvbGxlY3Rvci5hZGRSdWxlKGAuZXh0ZW5zaW9uLWVkaXRvciA+IC5oZWFkZXIgPiAuZGV0YWlscyA+IC5zdWJ0aXRsZSAuc3BvbnNvciAke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKHNwb25zb3JJY29uKX0geyBjb2xvcjogdmFyKC0tdnNjb2RlLWV4dGVuc2lvbkljb24tc3BvbnNvckZvcmVncm91bmQpOyB9YCk7XG5cblx0Y29uc3QgcHJpdmF0ZUJhZGdlQmFja2dyb3VuZCA9IHRoZW1lLmdldENvbG9yKGV4dGVuc2lvblByaXZhdGVCYWRnZUJhY2tncm91bmQpO1xuXHRpZiAocHJpdmF0ZUJhZGdlQmFja2dyb3VuZCkge1xuXHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAuZXh0ZW5zaW9uLXByaXZhdGUtYmFkZ2UgeyBjb2xvcjogJHtwcml2YXRlQmFkZ2VCYWNrZ3JvdW5kfTsgfWApO1xuXHR9XG59KTtcbiJdLAogICJt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
