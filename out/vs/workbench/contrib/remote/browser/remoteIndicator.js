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
import { IRemoteAgentService, remoteConnectionLatencyMeasurer } from "../../../services/remote/common/remoteAgentService.js";
import { RunOnceScheduler, retry } from "../../../../base/common/async.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { MenuId, IMenuService, MenuItemAction, MenuRegistry, registerAction2, Action2 } from "../../../../platform/actions/common/actions.js";
import { StatusbarAlignment, IStatusbarService } from "../../../services/statusbar/browser/statusbar.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { Schemas } from "../../../../base/common/network.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IBrowserWorkbenchEnvironmentService } from "../../../services/environment/browser/environmentService.js";
import { PersistentConnectionEventType } from "../../../../platform/remote/common/remoteAgentConnection.js";
import { IRemoteAuthorityResolverService } from "../../../../platform/remote/common/remoteAuthorityResolver.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { PlatformToString, isWeb, platform } from "../../../../base/common/platform.js";
import { truncate } from "../../../../base/common/strings.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { getRemoteName } from "../../../../platform/remote/common/remoteHosts.js";
import { getVirtualWorkspaceLocation } from "../../../../platform/workspace/common/virtualWorkspace.js";
import { getCodiconAriaLabel } from "../../../../base/common/iconLabels.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { ReloadWindowAction } from "../../../browser/actions/windowActions.js";
import { EXTENSION_INSTALL_SKIP_WALKTHROUGH_CONTEXT, IExtensionGalleryService, IExtensionManagementService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IExtensionsWorkbenchService, LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID } from "../../extensions/common/extensions.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { RemoteNameContext, VirtualWorkspaceContext } from "../../../common/contextkeys.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { DomEmitter } from "../../../../base/browser/event.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { infoIcon } from "../../extensions/browser/extensionsIcons.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { URI } from "../../../../base/common/uri.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { workbenchConfigurationNodeBase } from "../../../common/configuration.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import Severity from "../../../../base/common/severity.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
let RemoteStatusIndicator = class extends Disposable {
  constructor(statusbarService, environmentService, labelService, contextKeyService, menuService, quickInputService, commandService, extensionService, remoteAgentService, remoteAuthorityResolverService, hostService, workspaceContextService, logService, extensionGalleryService, telemetryService, productService, extensionManagementService, extensionsWorkbenchService, dialogService, lifecycleService, openerService, configurationService) {
    super();
    this.statusbarService = statusbarService;
    this.environmentService = environmentService;
    this.labelService = labelService;
    this.contextKeyService = contextKeyService;
    this.menuService = menuService;
    this.quickInputService = quickInputService;
    this.commandService = commandService;
    this.extensionService = extensionService;
    this.remoteAgentService = remoteAgentService;
    this.remoteAuthorityResolverService = remoteAuthorityResolverService;
    this.hostService = hostService;
    this.workspaceContextService = workspaceContextService;
    this.logService = logService;
    this.extensionGalleryService = extensionGalleryService;
    this.telemetryService = telemetryService;
    this.productService = productService;
    this.extensionManagementService = extensionManagementService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.dialogService = dialogService;
    this.lifecycleService = lifecycleService;
    this.openerService = openerService;
    this.configurationService = configurationService;
    this.virtualWorkspaceLocation = void 0;
    this.connectionState = void 0;
    this.connectionToken = void 0;
    this.networkState = void 0;
    this.measureNetworkConnectionLatencyScheduler = void 0;
    this.loggedInvalidGroupNames = /* @__PURE__ */ Object.create(null);
    this._remoteExtensionMetadata = void 0;
    this.remoteMetadataInitialized = false;
    this._onDidChangeEntries = this._register(new Emitter());
    this.onDidChangeEntries = this._onDidChangeEntries.event;
    this.legacyIndicatorMenu = this._register(this.menuService.createMenu(MenuId.StatusBarWindowIndicatorMenu, this.contextKeyService));
    this.remoteIndicatorMenu = this._register(this.menuService.createMenu(MenuId.StatusBarRemoteIndicatorMenu, this.contextKeyService));
    this.connectionStateContextKey = new RawContextKey("remoteConnectionState", "").bindTo(this.contextKeyService);
    if (this.remoteAuthority) {
      this.connectionState = "initializing";
      this.connectionStateContextKey.set(this.connectionState);
    } else {
      this.updateVirtualWorkspaceLocation();
    }
    this.registerActions();
    this.registerListeners();
    this.updateWhenInstalledExtensionsRegistered();
    this.updateRemoteStatusIndicator();
  }
  get remoteExtensionMetadata() {
    if (!this._remoteExtensionMetadata) {
      const remoteExtensionTips = { ...this.productService.remoteExtensionTips, ...this.productService.virtualWorkspaceExtensionTips };
      this._remoteExtensionMetadata = Object.values(remoteExtensionTips).filter((value) => value.startEntry !== void 0).map((value) => {
        return {
          id: value.extensionId,
          installed: false,
          friendlyName: value.friendlyName,
          isPlatformCompatible: false,
          dependencies: [],
          helpLink: value.startEntry?.helpLink ?? "",
          startConnectLabel: value.startEntry?.startConnectLabel ?? "",
          startCommand: value.startEntry?.startCommand ?? "",
          priority: value.startEntry?.priority ?? 10,
          supportedPlatforms: value.supportedPlatforms
        };
      });
      this.remoteExtensionMetadata.sort((ext1, ext2) => ext1.priority - ext2.priority);
    }
    return this._remoteExtensionMetadata;
  }
  get remoteAuthority() {
    return this.environmentService.remoteAuthority;
  }
  registerActions() {
    const category = nls.localize2("remote.category", "Remote");
    const that = this;
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: RemoteStatusIndicator.REMOTE_ACTIONS_COMMAND_ID,
          category,
          title: nls.localize2("remote.showMenu", "Show Remote Menu"),
          f1: true,
          keybinding: {
            weight: KeybindingWeight.WorkbenchContrib,
            primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyO
          }
        });
        this.run = () => that.showRemoteMenu();
      }
    }));
    if (RemoteStatusIndicator.SHOW_CLOSE_REMOTE_COMMAND_ID) {
      this._register(registerAction2(class extends Action2 {
        constructor() {
          super({
            id: RemoteStatusIndicator.CLOSE_REMOTE_COMMAND_ID,
            category,
            title: nls.localize2("remote.close", "Close Remote Connection"),
            f1: true,
            precondition: ContextKeyExpr.or(RemoteNameContext, VirtualWorkspaceContext)
          });
          this.run = () => that.hostService.openWindow({ forceReuseWindow: true, remoteAuthority: null });
        }
      }));
      if (this.remoteAuthority) {
        MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
          group: "6_close",
          command: {
            id: RemoteStatusIndicator.CLOSE_REMOTE_COMMAND_ID,
            title: nls.localize({ key: "miCloseRemote", comment: ["&& denotes a mnemonic"] }, "Close Re&&mote Connection")
          },
          order: 3.5
        });
      }
    }
    if (this.extensionGalleryService.isEnabled()) {
      this._register(registerAction2(class extends Action2 {
        constructor() {
          super({
            id: RemoteStatusIndicator.INSTALL_REMOTE_EXTENSIONS_ID,
            category,
            title: nls.localize2("remote.install", "Install Remote Development Extensions"),
            f1: true
          });
          this.run = (accessor, input) => {
            const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
            return extensionsWorkbenchService.openSearch(`@recommended:remotes`);
          };
        }
      }));
    }
  }
  registerListeners() {
    const updateRemoteActions = () => {
      this.remoteMenuActionsGroups = void 0;
      this.updateRemoteStatusIndicator();
    };
    this._register(this.legacyIndicatorMenu.onDidChange(updateRemoteActions));
    this._register(this.remoteIndicatorMenu.onDidChange(updateRemoteActions));
    this._register(this.labelService.onDidChangeFormatters(() => this.updateRemoteStatusIndicator()));
    const remoteIndicator = this.environmentService.options?.windowIndicator;
    if (remoteIndicator && remoteIndicator.onDidChange) {
      this._register(remoteIndicator.onDidChange(() => this.updateRemoteStatusIndicator()));
    }
    if (this.remoteAuthority) {
      const connection = this.remoteAgentService.getConnection();
      if (connection) {
        this._register(connection.onDidStateChange((e) => {
          switch (e.type) {
            case PersistentConnectionEventType.ConnectionLost:
            case PersistentConnectionEventType.ReconnectionRunning:
            case PersistentConnectionEventType.ReconnectionWait:
              this.setConnectionState("reconnecting");
              break;
            case PersistentConnectionEventType.ReconnectionPermanentFailure:
              this.setConnectionState("disconnected");
              break;
            case PersistentConnectionEventType.ConnectionGain:
              this.setConnectionState("connected");
              break;
          }
        }));
      }
    } else {
      this._register(this.workspaceContextService.onDidChangeWorkbenchState(() => {
        this.updateVirtualWorkspaceLocation();
        this.updateRemoteStatusIndicator();
      }));
    }
    if (isWeb) {
      this._register(Event.any(
        this._register(new DomEmitter(mainWindow, "online")).event,
        this._register(new DomEmitter(mainWindow, "offline")).event
      )(() => this.setNetworkState(navigator.onLine ? "online" : "offline")));
    }
    this._register(this.extensionService.onDidChangeExtensions(async (result) => {
      for (const ext of result.added) {
        const index = this.remoteExtensionMetadata.findIndex((value) => ExtensionIdentifier.equals(value.id, ext.identifier));
        if (index > -1) {
          this.remoteExtensionMetadata[index].installed = true;
        }
      }
    }));
    this._register(this.extensionManagementService.onDidUninstallExtension(async (result) => {
      const index = this.remoteExtensionMetadata.findIndex((value) => ExtensionIdentifier.equals(value.id, result.identifier.id));
      if (index > -1) {
        this.remoteExtensionMetadata[index].installed = false;
      }
    }));
  }
  async initializeRemoteMetadata() {
    if (this.remoteMetadataInitialized) {
      return;
    }
    const currentPlatform = PlatformToString(platform);
    for (let i = 0; i < this.remoteExtensionMetadata.length; i++) {
      const extensionId = this.remoteExtensionMetadata[i].id;
      const supportedPlatforms = this.remoteExtensionMetadata[i].supportedPlatforms;
      const isInstalled = (await this.extensionManagementService.getInstalled()).find((value) => ExtensionIdentifier.equals(value.identifier.id, extensionId)) ? true : false;
      this.remoteExtensionMetadata[i].installed = isInstalled;
      if (isInstalled) {
        this.remoteExtensionMetadata[i].isPlatformCompatible = true;
      } else if (supportedPlatforms && !supportedPlatforms.includes(currentPlatform)) {
        this.remoteExtensionMetadata[i].isPlatformCompatible = false;
      } else {
        this.remoteExtensionMetadata[i].isPlatformCompatible = true;
      }
    }
    this.remoteMetadataInitialized = true;
    this._onDidChangeEntries.fire();
    this.updateRemoteStatusIndicator();
  }
  updateVirtualWorkspaceLocation() {
    this.virtualWorkspaceLocation = getVirtualWorkspaceLocation(this.workspaceContextService.getWorkspace());
  }
  async updateWhenInstalledExtensionsRegistered() {
    await this.extensionService.whenInstalledExtensionsRegistered();
    const remoteAuthority = this.remoteAuthority;
    if (remoteAuthority) {
      (async () => {
        try {
          const { authority } = await this.remoteAuthorityResolverService.resolveAuthority(remoteAuthority);
          this.connectionToken = authority.connectionToken;
          this.setConnectionState("connected");
        } catch (error) {
          this.setConnectionState("disconnected");
        }
      })();
    }
    this.updateRemoteStatusIndicator();
    this.initializeRemoteMetadata();
  }
  setConnectionState(newState) {
    if (this.connectionState !== newState) {
      this.connectionState = newState;
      if (this.connectionState === "reconnecting") {
        this.connectionStateContextKey.set("disconnected");
      } else {
        this.connectionStateContextKey.set(this.connectionState);
      }
      this.updateRemoteStatusIndicator();
      if (newState === "connected") {
        this.scheduleMeasureNetworkConnectionLatency();
      }
    }
  }
  scheduleMeasureNetworkConnectionLatency() {
    if (!this.remoteAuthority || // only when having a remote connection
    this.measureNetworkConnectionLatencyScheduler) {
      return;
    }
    this.measureNetworkConnectionLatencyScheduler = this._register(new RunOnceScheduler(() => this.measureNetworkConnectionLatency(), RemoteStatusIndicator.REMOTE_CONNECTION_LATENCY_SCHEDULER_DELAY));
    this.measureNetworkConnectionLatencyScheduler.schedule(RemoteStatusIndicator.REMOTE_CONNECTION_LATENCY_SCHEDULER_FIRST_RUN_DELAY);
  }
  async measureNetworkConnectionLatency() {
    if (this.hostService.hasFocus && this.networkState !== "offline") {
      const measurement = await remoteConnectionLatencyMeasurer.measure(this.remoteAgentService);
      if (measurement) {
        if (measurement.high) {
          this.setNetworkState("high-latency");
        } else if (this.networkState === "high-latency") {
          this.setNetworkState("online");
        }
      }
    }
    this.measureNetworkConnectionLatencyScheduler?.schedule();
  }
  setNetworkState(newState) {
    if (this.networkState !== newState) {
      const oldState = this.networkState;
      this.networkState = newState;
      if (newState === "high-latency") {
        this.logService.warn(`Remote network connection appears to have high latency (${remoteConnectionLatencyMeasurer.latency?.current?.toFixed(2)}ms last, ${remoteConnectionLatencyMeasurer.latency?.average?.toFixed(2)}ms average)`);
      }
      if (this.connectionToken) {
        if (newState === "online" && oldState === "high-latency") {
          this.logNetworkConnectionHealthTelemetry(this.connectionToken, "good");
        } else if (newState === "high-latency" && oldState === "online") {
          this.logNetworkConnectionHealthTelemetry(this.connectionToken, "poor");
        }
      }
      this.updateRemoteStatusIndicator();
    }
  }
  logNetworkConnectionHealthTelemetry(connectionToken, connectionHealth) {
    this.telemetryService.publicLog2("remoteConnectionHealth", {
      remoteName: getRemoteName(this.remoteAuthority),
      reconnectionToken: connectionToken,
      connectionHealth
    });
  }
  validatedGroup(group) {
    if (!group.match(/^(remote|virtualfs)_(\d\d)_(([a-z][a-z0-9+.-]*)_(.*))$/)) {
      if (!this.loggedInvalidGroupNames[group]) {
        this.loggedInvalidGroupNames[group] = true;
        this.logService.warn(`Invalid group name used in "statusBar/remoteIndicator" menu contribution: ${group}. Entries ignored. Expected format: 'remote_$ORDER_$REMOTENAME_$GROUPING or 'virtualfs_$ORDER_$FILESCHEME_$GROUPING.`);
      }
      return false;
    }
    return true;
  }
  getRemoteMenuActions(doNotUseCache) {
    if (!this.remoteMenuActionsGroups || doNotUseCache) {
      this.remoteMenuActionsGroups = this.remoteIndicatorMenu.getActions().filter((a) => this.validatedGroup(a[0])).concat(this.legacyIndicatorMenu.getActions());
    }
    return this.remoteMenuActionsGroups;
  }
  updateRemoteStatusIndicator() {
    const remoteIndicator = this.environmentService.options?.windowIndicator;
    if (remoteIndicator) {
      let remoteIndicatorLabel = remoteIndicator.label.trim();
      if (!remoteIndicatorLabel.startsWith("$(")) {
        remoteIndicatorLabel = `$(remote) ${remoteIndicatorLabel}`;
      }
      this.renderRemoteStatusIndicator(truncate(remoteIndicatorLabel, RemoteStatusIndicator.REMOTE_STATUS_LABEL_MAX_LENGTH), remoteIndicator.tooltip, remoteIndicator.command);
      return;
    }
    if (this.remoteAuthority) {
      const hostLabel = this.labelService.getHostLabel(Schemas.vscodeRemote, this.remoteAuthority) || this.remoteAuthority;
      switch (this.connectionState) {
        case "initializing":
          this.renderRemoteStatusIndicator(
            nls.localize("host.open", "Opening Remote..."),
            nls.localize("host.open", "Opening Remote..."),
            void 0,
            true
            /* progress */
          );
          break;
        case "reconnecting":
          this.renderRemoteStatusIndicator(
            `${nls.localize("host.reconnecting", "Reconnecting to {0}...", truncate(hostLabel, RemoteStatusIndicator.REMOTE_STATUS_LABEL_MAX_LENGTH))}`,
            void 0,
            void 0,
            true
            /* progress */
          );
          break;
        case "disconnected":
          this.renderRemoteStatusIndicator(`$(alert) ${nls.localize("disconnectedFrom", "Disconnected from {0}", truncate(hostLabel, RemoteStatusIndicator.REMOTE_STATUS_LABEL_MAX_LENGTH))}`);
          break;
        default: {
          const tooltip = new MarkdownString("", { isTrusted: true, supportThemeIcons: true });
          const hostNameTooltip = this.labelService.getHostTooltip(Schemas.vscodeRemote, this.remoteAuthority);
          if (hostNameTooltip) {
            tooltip.appendMarkdown(hostNameTooltip);
          } else {
            tooltip.appendText(nls.localize({ key: "host.tooltip", comment: ["{0} is a remote host name, e.g. Dev Container"] }, "Editing on {0}", hostLabel));
          }
          this.renderRemoteStatusIndicator(`$(remote) ${truncate(hostLabel, RemoteStatusIndicator.REMOTE_STATUS_LABEL_MAX_LENGTH)}`, tooltip);
        }
      }
      return;
    }
    if (this.virtualWorkspaceLocation) {
      const workspaceLabel = this.labelService.getHostLabel(this.virtualWorkspaceLocation.scheme, this.virtualWorkspaceLocation.authority);
      if (workspaceLabel) {
        const tooltip = new MarkdownString("", { isTrusted: true, supportThemeIcons: true });
        const hostNameTooltip = this.labelService.getHostTooltip(this.virtualWorkspaceLocation.scheme, this.virtualWorkspaceLocation.authority);
        if (hostNameTooltip) {
          tooltip.appendMarkdown(hostNameTooltip);
        } else {
          tooltip.appendText(nls.localize({ key: "workspace.tooltip", comment: ["{0} is a remote workspace name, e.g. GitHub"] }, "Editing on {0}", workspaceLabel));
        }
        if (!isWeb || this.remoteAuthority) {
          tooltip.appendMarkdown("\n\n");
          tooltip.appendMarkdown(nls.localize(
            { key: "workspace.tooltip2", comment: ["[features are not available]({1}) is a link. Only translate `features are not available`. Do not change brackets and parentheses or {0}"] },
            "Some [features are not available]({0}) for resources located on a virtual file system.",
            `command:${LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID}`
          ));
        }
        this.renderRemoteStatusIndicator(`$(remote) ${truncate(workspaceLabel, RemoteStatusIndicator.REMOTE_STATUS_LABEL_MAX_LENGTH)}`, tooltip);
        return;
      }
    }
    this.renderRemoteStatusIndicator(`$(remote)`, nls.localize("noHost.tooltip", "Open a Remote Window"));
    return;
  }
  renderRemoteStatusIndicator(initialText, initialTooltip, command, showProgress) {
    const { text, tooltip, ariaLabel } = this.withNetworkStatus(initialText, initialTooltip, showProgress);
    const properties = {
      name: nls.localize("remoteHost", "Remote Host"),
      kind: this.networkState === "offline" ? "offline" : "remote",
      ariaLabel,
      text,
      showProgress,
      tooltip,
      command: command ?? RemoteStatusIndicator.REMOTE_ACTIONS_COMMAND_ID
    };
    if (this.remoteStatusEntry) {
      this.remoteStatusEntry.update(properties);
    } else {
      this.remoteStatusEntry = this.statusbarService.addEntry(
        properties,
        "status.host",
        StatusbarAlignment.LEFT,
        Number.POSITIVE_INFINITY
        /* first entry */
      );
    }
  }
  withNetworkStatus(initialText, initialTooltip, showProgress) {
    let text = initialText;
    let tooltip = initialTooltip;
    let ariaLabel = getCodiconAriaLabel(text);
    function textWithAlert() {
      if (!showProgress && initialText.startsWith("$(remote)")) {
        return initialText.replace("$(remote)", "$(alert)");
      }
      return initialText;
    }
    switch (this.networkState) {
      case "offline": {
        const offlineMessage = nls.localize("networkStatusOfflineTooltip", "Network appears to be offline, certain features might be unavailable.");
        text = textWithAlert();
        tooltip = this.appendTooltipLine(tooltip, offlineMessage);
        ariaLabel = `${ariaLabel}, ${offlineMessage}`;
        break;
      }
      case "high-latency":
        text = textWithAlert();
        tooltip = this.appendTooltipLine(tooltip, nls.localize("networkStatusHighLatencyTooltip", "Network appears to have high latency ({0}ms last, {1}ms average), certain features may be slow to respond.", remoteConnectionLatencyMeasurer.latency?.current?.toFixed(2), remoteConnectionLatencyMeasurer.latency?.average?.toFixed(2)));
        break;
    }
    return { text, tooltip, ariaLabel };
  }
  appendTooltipLine(tooltip, line) {
    let markdownTooltip;
    if (typeof tooltip === "string") {
      markdownTooltip = new MarkdownString(tooltip, { isTrusted: true, supportThemeIcons: true });
    } else {
      markdownTooltip = tooltip ?? new MarkdownString("", { isTrusted: true, supportThemeIcons: true });
    }
    if (markdownTooltip.value.length > 0) {
      markdownTooltip.appendMarkdown("\n\n");
    }
    markdownTooltip.appendMarkdown(line);
    return markdownTooltip;
  }
  async installExtension(extensionId, remoteLabel) {
    try {
      await this.extensionsWorkbenchService.install(extensionId, {
        isMachineScoped: false,
        donotIncludePackAndDependencies: false,
        context: { [EXTENSION_INSTALL_SKIP_WALKTHROUGH_CONTEXT]: true }
      });
    } catch (error) {
      if (!this.lifecycleService.willShutdown) {
        const { confirmed } = await this.dialogService.confirm({
          type: Severity.Error,
          message: nls.localize("unknownSetupError", "An error occurred while setting up {0}. Would you like to try again?", remoteLabel),
          detail: error && !isCancellationError(error) ? toErrorMessage(error) : void 0,
          primaryButton: nls.localize("retry", "Retry")
        });
        if (confirmed) {
          return this.installExtension(extensionId, remoteLabel);
        }
      }
      throw error;
    }
  }
  async runRemoteStartCommand(extensionId, startCommand) {
    await retry(async () => {
      const ext = await this.extensionService.getExtension(extensionId);
      if (!ext) {
        throw Error("Failed to find installed remote extension");
      }
      return ext;
    }, 300, 10);
    this.commandService.executeCommand(startCommand);
    this.telemetryService.publicLog2("workbenchActionExecuted", {
      id: "remoteInstallAndRun",
      detail: extensionId,
      from: "remote indicator"
    });
  }
  showRemoteMenu() {
    const getCategoryLabel = (action) => {
      if (action.item.category) {
        return typeof action.item.category === "string" ? action.item.category : action.item.category.value;
      }
      return void 0;
    };
    const matchCurrentRemote = () => {
      if (this.remoteAuthority) {
        return new RegExp(`^remote_\\d\\d_${getRemoteName(this.remoteAuthority)}_`);
      } else if (this.virtualWorkspaceLocation) {
        return new RegExp(`^virtualfs_\\d\\d_${this.virtualWorkspaceLocation.scheme}_`);
      }
      return void 0;
    };
    const computeItems = () => {
      let actionGroups = this.getRemoteMenuActions(true);
      const items = [];
      const currentRemoteMatcher = matchCurrentRemote();
      if (currentRemoteMatcher) {
        actionGroups = actionGroups.sort((g1, g2) => {
          const isCurrentRemote1 = currentRemoteMatcher.test(g1[0]);
          const isCurrentRemote2 = currentRemoteMatcher.test(g2[0]);
          if (isCurrentRemote1 !== isCurrentRemote2) {
            return isCurrentRemote1 ? -1 : 1;
          }
          if (g1[0] !== "" && g2[0] === "") {
            return -1;
          } else if (g1[0] === "" && g2[0] !== "") {
            return 1;
          }
          return g1[0].localeCompare(g2[0]);
        });
      }
      let lastCategoryName = void 0;
      for (const actionGroup of actionGroups) {
        let hasGroupCategory = false;
        for (const action of actionGroup[1]) {
          if (action instanceof MenuItemAction) {
            if (!hasGroupCategory) {
              const category = getCategoryLabel(action);
              if (category !== lastCategoryName) {
                items.push({ type: "separator", label: category });
                lastCategoryName = category;
              }
              hasGroupCategory = true;
            }
            const label = typeof action.item.title === "string" ? action.item.title : action.item.title.value;
            items.push({
              type: "item",
              id: action.item.id,
              label
            });
          }
        }
      }
      const showExtensionRecommendations = this.configurationService.getValue("workbench.remoteIndicator.showExtensionRecommendations");
      if (showExtensionRecommendations && this.extensionGalleryService.isEnabled() && this.remoteMetadataInitialized) {
        const notInstalledItems = [];
        for (const metadata of this.remoteExtensionMetadata) {
          if (!metadata.installed && metadata.isPlatformCompatible) {
            const label = metadata.startConnectLabel;
            const buttons = [{
              iconClass: ThemeIcon.asClassName(infoIcon),
              tooltip: nls.localize("remote.startActions.help", "Learn More")
            }];
            notInstalledItems.push({ type: "item", id: metadata.id, label, buttons });
          }
        }
        items.push({
          type: "separator",
          label: nls.localize("remote.startActions.install", "Install")
        });
        items.push(...notInstalledItems);
      }
      items.push({
        type: "separator"
      });
      const entriesBeforeConfig = items.length;
      if (RemoteStatusIndicator.SHOW_CLOSE_REMOTE_COMMAND_ID) {
        if (this.remoteAuthority) {
          items.push({
            type: "item",
            id: RemoteStatusIndicator.CLOSE_REMOTE_COMMAND_ID,
            label: nls.localize("closeRemoteConnection.title", "Close Remote Connection")
          });
          if (this.connectionState === "disconnected") {
            items.push({
              type: "item",
              id: ReloadWindowAction.ID,
              label: nls.localize("reloadWindow", "Reload Window")
            });
          }
        } else if (this.virtualWorkspaceLocation) {
          items.push({
            type: "item",
            id: RemoteStatusIndicator.CLOSE_REMOTE_COMMAND_ID,
            label: nls.localize("closeVirtualWorkspace.title", "Close Remote Workspace")
          });
        }
      }
      if (items.length === entriesBeforeConfig) {
        items.pop();
      }
      return items;
    };
    const disposables = new DisposableStore();
    const quickPick = disposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
    quickPick.placeholder = nls.localize("remoteActions", "Select an option to open a Remote Window");
    quickPick.items = computeItems();
    quickPick.sortByLabel = false;
    quickPick.canSelectMany = false;
    disposables.add(Event.once(quickPick.onDidAccept)(async (_) => {
      const selectedItems = quickPick.selectedItems;
      if (selectedItems.length === 1) {
        const commandId = selectedItems[0].id;
        const remoteExtension = this.remoteExtensionMetadata.find((value) => ExtensionIdentifier.equals(value.id, commandId));
        if (remoteExtension) {
          quickPick.items = [];
          quickPick.busy = true;
          quickPick.placeholder = nls.localize("remote.startActions.installingExtension", "Installing extension... ");
          try {
            await this.installExtension(remoteExtension.id, selectedItems[0].label);
          } catch (error) {
            return;
          } finally {
            quickPick.hide();
          }
          await this.runRemoteStartCommand(remoteExtension.id, remoteExtension.startCommand);
        } else {
          this.telemetryService.publicLog2("workbenchActionExecuted", {
            id: commandId,
            from: "remote indicator"
          });
          this.commandService.executeCommand(commandId);
          quickPick.hide();
        }
      }
    }));
    disposables.add(Event.once(quickPick.onDidTriggerItemButton)(async (e) => {
      const remoteExtension = this.remoteExtensionMetadata.find((value) => ExtensionIdentifier.equals(value.id, e.item.id));
      if (remoteExtension) {
        await this.openerService.open(URI.parse(remoteExtension.helpLink));
      }
    }));
    disposables.add(this.legacyIndicatorMenu.onDidChange(() => quickPick.items = computeItems()));
    disposables.add(this.remoteIndicatorMenu.onDidChange(() => quickPick.items = computeItems()));
    disposables.add(quickPick.onDidHide(() => disposables.dispose()));
    if (!this.remoteMetadataInitialized) {
      quickPick.busy = true;
      this._register(this.onDidChangeEntries(() => {
        quickPick.busy = false;
        quickPick.items = computeItems();
      }));
    }
    quickPick.show();
  }
};
RemoteStatusIndicator.ID = "workbench.contrib.remoteStatusIndicator";
RemoteStatusIndicator.REMOTE_ACTIONS_COMMAND_ID = "workbench.action.remote.showMenu";
RemoteStatusIndicator.CLOSE_REMOTE_COMMAND_ID = "workbench.action.remote.close";
RemoteStatusIndicator.SHOW_CLOSE_REMOTE_COMMAND_ID = !isWeb;
// web does not have a "Close Remote" command
RemoteStatusIndicator.INSTALL_REMOTE_EXTENSIONS_ID = "workbench.action.remote.extensions";
RemoteStatusIndicator.REMOTE_STATUS_LABEL_MAX_LENGTH = 40;
RemoteStatusIndicator.REMOTE_CONNECTION_LATENCY_SCHEDULER_DELAY = 60 * 1e3;
RemoteStatusIndicator.REMOTE_CONNECTION_LATENCY_SCHEDULER_FIRST_RUN_DELAY = 10 * 1e3;
RemoteStatusIndicator = __decorateClass([
  __decorateParam(0, IStatusbarService),
  __decorateParam(1, IBrowserWorkbenchEnvironmentService),
  __decorateParam(2, ILabelService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IMenuService),
  __decorateParam(5, IQuickInputService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IExtensionService),
  __decorateParam(8, IRemoteAgentService),
  __decorateParam(9, IRemoteAuthorityResolverService),
  __decorateParam(10, IHostService),
  __decorateParam(11, IWorkspaceContextService),
  __decorateParam(12, ILogService),
  __decorateParam(13, IExtensionGalleryService),
  __decorateParam(14, ITelemetryService),
  __decorateParam(15, IProductService),
  __decorateParam(16, IExtensionManagementService),
  __decorateParam(17, IExtensionsWorkbenchService),
  __decorateParam(18, IDialogService),
  __decorateParam(19, ILifecycleService),
  __decorateParam(20, IOpenerService),
  __decorateParam(21, IConfigurationService)
], RemoteStatusIndicator);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  ...workbenchConfigurationNodeBase,
  properties: {
    "workbench.remoteIndicator.showExtensionRecommendations": {
      type: "boolean",
      markdownDescription: nls.localize("remote.showExtensionRecommendations", "When enabled, remote extensions recommendations will be shown in the Remote Indicator menu."),
      default: true
    }
  }
});
export {
  RemoteStatusIndicator
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9yZW1vdGUvYnJvd3Nlci9yZW1vdGVJbmRpY2F0b3IudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElSZW1vdGVBZ2VudFNlcnZpY2UsIHJlbW90ZUNvbm5lY3Rpb25MYXRlbmN5TWVhc3VyZXIgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyLCByZXRyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IE1lbnVJZCwgSU1lbnVTZXJ2aWNlLCBNZW51SXRlbUFjdGlvbiwgTWVudVJlZ2lzdHJ5LCByZWdpc3RlckFjdGlvbjIsIEFjdGlvbjIsIFN1Ym1lbnVJdGVtQWN0aW9uLCBJTWVudSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IFN0YXR1c2JhckFsaWdubWVudCwgSVN0YXR1c2JhclNlcnZpY2UsIElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yLCBJU3RhdHVzYmFyRW50cnkgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9zdGF0dXNiYXIvYnJvd3Nlci9zdGF0dXNiYXIuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSwgUmF3Q29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBRdWlja1BpY2tJdGVtLCBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja0lucHV0QnV0dG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2Jyb3dzZXIvZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFBlcnNpc3RlbnRDb25uZWN0aW9uRXZlbnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudENvbm5lY3Rpb24uanMnO1xuaW1wb3J0IHsgSVJlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlbW90ZS9jb21tb24vcmVtb3RlQXV0aG9yaXR5UmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgUGxhdGZvcm1OYW1lLCBQbGF0Zm9ybVRvU3RyaW5nLCBpc1dlYiwgcGxhdGZvcm0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyB0cnVuY2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgZ2V0UmVtb3RlTmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlbW90ZS9jb21tb24vcmVtb3RlSG9zdHMuanMnO1xuaW1wb3J0IHsgZ2V0VmlydHVhbFdvcmtzcGFjZUxvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi92aXJ0dWFsV29ya3NwYWNlLmpzJztcbmltcG9ydCB7IGdldENvZGljb25BcmlhTGFiZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pY29uTGFiZWxzLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgUmVsb2FkV2luZG93QWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9hY3Rpb25zL3dpbmRvd0FjdGlvbnMuanMnO1xuaW1wb3J0IHsgRVhURU5TSU9OX0lOU1RBTExfU0tJUF9XQUxLVEhST1VHSF9DT05URVhULCBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UsIElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLCBMSVNUX1dPUktTUEFDRV9VTlNVUFBPUlRFRF9FWFRFTlNJT05TX0NPTU1BTkRfSUQgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElNYXJrZG93blN0cmluZywgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBSZW1vdGVOYW1lQ29udGV4dCwgVmlydHVhbFdvcmtzcGFjZUNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uLCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBEb21FbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2V2ZW50LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbklkZW50aWZpZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBpbmZvSWNvbiB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvYnJvd3Nlci9leHRlbnNpb25zSWNvbnMuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgbWFpbldpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci93aW5kb3cuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25SZWdpc3RyeSwgRXh0ZW5zaW9ucyBhcyBDb25maWd1cmF0aW9uRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyB3b3JrYmVuY2hDb25maWd1cmF0aW9uTm9kZUJhc2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0IHsgaXNDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyB0b0Vycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9yTWVzc2FnZS5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcblxudHlwZSBBY3Rpb25Hcm91cCA9IFtzdHJpbmcsIEFycmF5PE1lbnVJdGVtQWN0aW9uIHwgU3VibWVudUl0ZW1BY3Rpb24+XTtcblxuaW50ZXJmYWNlIFJlbW90ZUV4dGVuc2lvbk1ldGFkYXRhIHtcblx0aWQ6IHN0cmluZztcblx0aW5zdGFsbGVkOiBib29sZWFuO1xuXHRkZXBlbmRlbmNpZXM6IHN0cmluZ1tdO1xuXHRpc1BsYXRmb3JtQ29tcGF0aWJsZTogYm9vbGVhbjtcblx0aGVscExpbms6IHN0cmluZztcblx0c3RhcnRDb25uZWN0TGFiZWw6IHN0cmluZztcblx0c3RhcnRDb21tYW5kOiBzdHJpbmc7XG5cdHByaW9yaXR5OiBudW1iZXI7XG5cdHN1cHBvcnRlZFBsYXRmb3Jtcz86IFBsYXRmb3JtTmFtZVtdO1xufVxuXG5leHBvcnQgY2xhc3MgUmVtb3RlU3RhdHVzSW5kaWNhdG9yIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi5yZW1vdGVTdGF0dXNJbmRpY2F0b3InO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFJFTU9URV9BQ1RJT05TX0NPTU1BTkRfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5yZW1vdGUuc2hvd01lbnUnO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBDTE9TRV9SRU1PVEVfQ09NTUFORF9JRCA9ICd3b3JrYmVuY2guYWN0aW9uLnJlbW90ZS5jbG9zZSc7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFNIT1dfQ0xPU0VfUkVNT1RFX0NPTU1BTkRfSUQgPSAhaXNXZWI7IC8vIHdlYiBkb2VzIG5vdCBoYXZlIGEgXCJDbG9zZSBSZW1vdGVcIiBjb21tYW5kXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IElOU1RBTExfUkVNT1RFX0VYVEVOU0lPTlNfSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5yZW1vdGUuZXh0ZW5zaW9ucyc7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgUkVNT1RFX1NUQVRVU19MQUJFTF9NQVhfTEVOR1RIID0gNDA7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgUkVNT1RFX0NPTk5FQ1RJT05fTEFURU5DWV9TQ0hFRFVMRVJfREVMQVkgPSA2MCAqIDEwMDA7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFJFTU9URV9DT05ORUNUSU9OX0xBVEVOQ1lfU0NIRURVTEVSX0ZJUlNUX1JVTl9ERUxBWSA9IDEwICogMTAwMDtcblxuXHRwcml2YXRlIHJlbW90ZVN0YXR1c0VudHJ5OiBJU3RhdHVzYmFyRW50cnlBY2Nlc3NvciB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGxlZ2FjeUluZGljYXRvck1lbnU6IElNZW51OyAvLyB0byBiZSByZW1vdmVkIG9uY2UgbWlncmF0aW9uIGNvbXBsZXRlZFxuXHRwcml2YXRlIHJlYWRvbmx5IHJlbW90ZUluZGljYXRvck1lbnU6IElNZW51O1xuXG5cdHByaXZhdGUgcmVtb3RlTWVudUFjdGlvbnNHcm91cHM6IEFjdGlvbkdyb3VwW10gfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSB2aXJ0dWFsV29ya3NwYWNlTG9jYXRpb246IHsgc2NoZW1lOiBzdHJpbmc7IGF1dGhvcml0eTogc3RyaW5nIH0gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBjb25uZWN0aW9uU3RhdGU6ICdpbml0aWFsaXppbmcnIHwgJ2Nvbm5lY3RlZCcgfCAncmVjb25uZWN0aW5nJyB8ICdkaXNjb25uZWN0ZWQnIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIGNvbm5lY3Rpb25Ub2tlbjogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IGNvbm5lY3Rpb25TdGF0ZUNvbnRleHRLZXk6IElDb250ZXh0S2V5PCcnIHwgJ2luaXRpYWxpemluZycgfCAnZGlzY29ubmVjdGVkJyB8ICdjb25uZWN0ZWQnPjtcblxuXHRwcml2YXRlIG5ldHdvcmtTdGF0ZTogJ29ubGluZScgfCAnb2ZmbGluZScgfCAnaGlnaC1sYXRlbmN5JyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBtZWFzdXJlTmV0d29ya0Nvbm5lY3Rpb25MYXRlbmN5U2NoZWR1bGVyOiBSdW5PbmNlU2NoZWR1bGVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgbG9nZ2VkSW52YWxpZEdyb3VwTmFtZXM6IHsgW2dyb3VwOiBzdHJpbmddOiBib29sZWFuIH0gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG5cdHByaXZhdGUgX3JlbW90ZUV4dGVuc2lvbk1ldGFkYXRhOiBSZW1vdGVFeHRlbnNpb25NZXRhZGF0YVtdIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIGdldCByZW1vdGVFeHRlbnNpb25NZXRhZGF0YSgpOiBSZW1vdGVFeHRlbnNpb25NZXRhZGF0YVtdIHtcblx0XHRpZiAoIXRoaXMuX3JlbW90ZUV4dGVuc2lvbk1ldGFkYXRhKSB7XG5cdFx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25UaXBzID0geyAuLi50aGlzLnByb2R1Y3RTZXJ2aWNlLnJlbW90ZUV4dGVuc2lvblRpcHMsIC4uLnRoaXMucHJvZHVjdFNlcnZpY2UudmlydHVhbFdvcmtzcGFjZUV4dGVuc2lvblRpcHMgfTtcblx0XHRcdHRoaXMuX3JlbW90ZUV4dGVuc2lvbk1ldGFkYXRhID0gT2JqZWN0LnZhbHVlcyhyZW1vdGVFeHRlbnNpb25UaXBzKS5maWx0ZXIodmFsdWUgPT4gdmFsdWUuc3RhcnRFbnRyeSAhPT0gdW5kZWZpbmVkKS5tYXAodmFsdWUgPT4ge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGlkOiB2YWx1ZS5leHRlbnNpb25JZCxcblx0XHRcdFx0XHRpbnN0YWxsZWQ6IGZhbHNlLFxuXHRcdFx0XHRcdGZyaWVuZGx5TmFtZTogdmFsdWUuZnJpZW5kbHlOYW1lLFxuXHRcdFx0XHRcdGlzUGxhdGZvcm1Db21wYXRpYmxlOiBmYWxzZSxcblx0XHRcdFx0XHRkZXBlbmRlbmNpZXM6IFtdLFxuXHRcdFx0XHRcdGhlbHBMaW5rOiB2YWx1ZS5zdGFydEVudHJ5Py5oZWxwTGluayA/PyAnJyxcblx0XHRcdFx0XHRzdGFydENvbm5lY3RMYWJlbDogdmFsdWUuc3RhcnRFbnRyeT8uc3RhcnRDb25uZWN0TGFiZWwgPz8gJycsXG5cdFx0XHRcdFx0c3RhcnRDb21tYW5kOiB2YWx1ZS5zdGFydEVudHJ5Py5zdGFydENvbW1hbmQgPz8gJycsXG5cdFx0XHRcdFx0cHJpb3JpdHk6IHZhbHVlLnN0YXJ0RW50cnk/LnByaW9yaXR5ID8/IDEwLFxuXHRcdFx0XHRcdHN1cHBvcnRlZFBsYXRmb3JtczogdmFsdWUuc3VwcG9ydGVkUGxhdGZvcm1zXG5cdFx0XHRcdH07XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5yZW1vdGVFeHRlbnNpb25NZXRhZGF0YS5zb3J0KChleHQxLCBleHQyKSA9PiBleHQxLnByaW9yaXR5IC0gZXh0Mi5wcmlvcml0eSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3JlbW90ZUV4dGVuc2lvbk1ldGFkYXRhO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgcmVtb3RlQXV0aG9yaXR5KCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eTtcblx0fVxuXG5cdHByaXZhdGUgcmVtb3RlTWV0YWRhdGFJbml0aWFsaXplZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUVudHJpZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBvbkRpZENoYW5nZUVudHJpZXM6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VFbnRyaWVzLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJU3RhdHVzYmFyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0YXR1c2JhclNlcnZpY2U6IElTdGF0dXNiYXJTZXJ2aWNlLFxuXHRcdEBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVudmlyb25tZW50U2VydmljZTogSUJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElSZW1vdGVBZ2VudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSByZW1vdGVBZ2VudFNlcnZpY2U6IElSZW1vdGVBZ2VudFNlcnZpY2UsXG5cdFx0QElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSByZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2U6IElSZW1vdGVBdXRob3JpdHlSZXNvbHZlclNlcnZpY2UsXG5cdFx0QElIb3N0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvc3RTZXJ2aWNlOiBJSG9zdFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlOiBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlOiBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlOiBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmxlZ2FjeUluZGljYXRvck1lbnUgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLm1lbnVTZXJ2aWNlLmNyZWF0ZU1lbnUoTWVudUlkLlN0YXR1c0JhcldpbmRvd0luZGljYXRvck1lbnUsIHRoaXMuY29udGV4dEtleVNlcnZpY2UpKTsgLy8gdG8gYmUgcmVtb3ZlZCBvbmNlIG1pZ3JhdGlvbiBjb21wbGV0ZWRcblx0XHR0aGlzLnJlbW90ZUluZGljYXRvck1lbnUgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLm1lbnVTZXJ2aWNlLmNyZWF0ZU1lbnUoTWVudUlkLlN0YXR1c0JhclJlbW90ZUluZGljYXRvck1lbnUsIHRoaXMuY29udGV4dEtleVNlcnZpY2UpKTtcblxuXHRcdHRoaXMuY29ubmVjdGlvblN0YXRlQ29udGV4dEtleSA9IG5ldyBSYXdDb250ZXh0S2V5PCcnIHwgJ2luaXRpYWxpemluZycgfCAnZGlzY29ubmVjdGVkJyB8ICdjb25uZWN0ZWQnPigncmVtb3RlQ29ubmVjdGlvblN0YXRlJywgJycpLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdC8vIFNldCBpbml0aWFsIGNvbm5lY3Rpb24gc3RhdGVcblx0XHRpZiAodGhpcy5yZW1vdGVBdXRob3JpdHkpIHtcblx0XHRcdHRoaXMuY29ubmVjdGlvblN0YXRlID0gJ2luaXRpYWxpemluZyc7XG5cdFx0XHR0aGlzLmNvbm5lY3Rpb25TdGF0ZUNvbnRleHRLZXkuc2V0KHRoaXMuY29ubmVjdGlvblN0YXRlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy51cGRhdGVWaXJ0dWFsV29ya3NwYWNlTG9jYXRpb24oKTtcblx0XHR9XG5cblx0XHR0aGlzLnJlZ2lzdGVyQWN0aW9ucygpO1xuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblxuXHRcdHRoaXMudXBkYXRlV2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCk7XG5cdFx0dGhpcy51cGRhdGVSZW1vdGVTdGF0dXNJbmRpY2F0b3IoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJBY3Rpb25zKCk6IHZvaWQge1xuXHRcdGNvbnN0IGNhdGVnb3J5ID0gbmxzLmxvY2FsaXplMigncmVtb3RlLmNhdGVnb3J5JywgXCJSZW1vdGVcIik7XG5cblx0XHQvLyBTaG93IFJlbW90ZSBNZW51XG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBSZW1vdGVTdGF0dXNJbmRpY2F0b3IuUkVNT1RFX0FDVElPTlNfQ09NTUFORF9JRCxcblx0XHRcdFx0XHRjYXRlZ29yeSxcblx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMigncmVtb3RlLnNob3dNZW51JywgXCJTaG93IFJlbW90ZSBNZW51XCIpLFxuXHRcdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5LZXlPLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRydW4gPSAoKSA9PiB0aGF0LnNob3dSZW1vdGVNZW51KCk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gQ2xvc2UgUmVtb3RlIENvbm5lY3Rpb25cblx0XHRpZiAoUmVtb3RlU3RhdHVzSW5kaWNhdG9yLlNIT1dfQ0xPU0VfUkVNT1RFX0NPTU1BTkRfSUQpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0XHRpZDogUmVtb3RlU3RhdHVzSW5kaWNhdG9yLkNMT1NFX1JFTU9URV9DT01NQU5EX0lELFxuXHRcdFx0XHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMigncmVtb3RlLmNsb3NlJywgXCJDbG9zZSBSZW1vdGUgQ29ubmVjdGlvblwiKSxcblx0XHRcdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0XHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5vcihSZW1vdGVOYW1lQ29udGV4dCwgVmlydHVhbFdvcmtzcGFjZUNvbnRleHQpXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cnVuID0gKCkgPT4gdGhhdC5ob3N0U2VydmljZS5vcGVuV2luZG93KHsgZm9yY2VSZXVzZVdpbmRvdzogdHJ1ZSwgcmVtb3RlQXV0aG9yaXR5OiBudWxsIH0pO1xuXHRcdFx0fSkpO1xuXHRcdFx0aWYgKHRoaXMucmVtb3RlQXV0aG9yaXR5KSB7XG5cdFx0XHRcdE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhckZpbGVNZW51LCB7XG5cdFx0XHRcdFx0Z3JvdXA6ICc2X2Nsb3NlJyxcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogUmVtb3RlU3RhdHVzSW5kaWNhdG9yLkNMT1NFX1JFTU9URV9DT01NQU5EX0lELFxuXHRcdFx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pQ2xvc2VSZW1vdGUnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiQ2xvc2UgUmUmJm1vdGUgQ29ubmVjdGlvblwiKVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0b3JkZXI6IDMuNVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodGhpcy5leHRlbnNpb25HYWxsZXJ5U2VydmljZS5pc0VuYWJsZWQoKSkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRcdGlkOiBSZW1vdGVTdGF0dXNJbmRpY2F0b3IuSU5TVEFMTF9SRU1PVEVfRVhURU5TSU9OU19JRCxcblx0XHRcdFx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3JlbW90ZS5pbnN0YWxsJywgXCJJbnN0YWxsIFJlbW90ZSBEZXZlbG9wbWVudCBFeHRlbnNpb25zXCIpLFxuXHRcdFx0XHRcdFx0ZjE6IHRydWVcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRydW4gPSAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGlucHV0OiBzdHJpbmcpID0+IHtcblx0XHRcdFx0XHRjb25zdCBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZSA9IGFjY2Vzc29yLmdldChJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UpO1xuXHRcdFx0XHRcdHJldHVybiBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5vcGVuU2VhcmNoKGBAcmVjb21tZW5kZWQ6cmVtb3Rlc2ApO1xuXHRcdFx0XHR9O1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cblx0XHQvLyBNZW51IGNoYW5nZXNcblx0XHRjb25zdCB1cGRhdGVSZW1vdGVBY3Rpb25zID0gKCkgPT4ge1xuXHRcdFx0dGhpcy5yZW1vdGVNZW51QWN0aW9uc0dyb3VwcyA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMudXBkYXRlUmVtb3RlU3RhdHVzSW5kaWNhdG9yKCk7XG5cdFx0fTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGVnYWN5SW5kaWNhdG9yTWVudS5vbkRpZENoYW5nZSh1cGRhdGVSZW1vdGVBY3Rpb25zKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5yZW1vdGVJbmRpY2F0b3JNZW51Lm9uRGlkQ2hhbmdlKHVwZGF0ZVJlbW90ZUFjdGlvbnMpKTtcblxuXHRcdC8vIFVwZGF0ZSBpbmRpY2F0b3Igd2hlbiBmb3JtYXR0ZXIgY2hhbmdlcyBhcyBpdCBtYXkgaGF2ZSBhbiBpbXBhY3Qgb24gdGhlIHJlbW90ZSBsYWJlbFxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGFiZWxTZXJ2aWNlLm9uRGlkQ2hhbmdlRm9ybWF0dGVycygoKSA9PiB0aGlzLnVwZGF0ZVJlbW90ZVN0YXR1c0luZGljYXRvcigpKSk7XG5cblx0XHQvLyBVcGRhdGUgYmFzZWQgb24gcmVtb3RlIGluZGljYXRvciBjaGFuZ2VzIGlmIGFueVxuXHRcdGNvbnN0IHJlbW90ZUluZGljYXRvciA9IHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLm9wdGlvbnM/LndpbmRvd0luZGljYXRvcjtcblx0XHRpZiAocmVtb3RlSW5kaWNhdG9yICYmIHJlbW90ZUluZGljYXRvci5vbkRpZENoYW5nZSkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIocmVtb3RlSW5kaWNhdG9yLm9uRGlkQ2hhbmdlKCgpID0+IHRoaXMudXBkYXRlUmVtb3RlU3RhdHVzSW5kaWNhdG9yKCkpKTtcblx0XHR9XG5cblx0XHQvLyBMaXN0ZW4gdG8gY2hhbmdlcyBvZiB0aGUgY29ubmVjdGlvblxuXHRcdGlmICh0aGlzLnJlbW90ZUF1dGhvcml0eSkge1xuXHRcdFx0Y29uc3QgY29ubmVjdGlvbiA9IHRoaXMucmVtb3RlQWdlbnRTZXJ2aWNlLmdldENvbm5lY3Rpb24oKTtcblx0XHRcdGlmIChjb25uZWN0aW9uKSB7XG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKGNvbm5lY3Rpb24ub25EaWRTdGF0ZUNoYW5nZSgoZSkgPT4ge1xuXHRcdFx0XHRcdHN3aXRjaCAoZS50eXBlKSB7XG5cdFx0XHRcdFx0XHRjYXNlIFBlcnNpc3RlbnRDb25uZWN0aW9uRXZlbnRUeXBlLkNvbm5lY3Rpb25Mb3N0OlxuXHRcdFx0XHRcdFx0Y2FzZSBQZXJzaXN0ZW50Q29ubmVjdGlvbkV2ZW50VHlwZS5SZWNvbm5lY3Rpb25SdW5uaW5nOlxuXHRcdFx0XHRcdFx0Y2FzZSBQZXJzaXN0ZW50Q29ubmVjdGlvbkV2ZW50VHlwZS5SZWNvbm5lY3Rpb25XYWl0OlxuXHRcdFx0XHRcdFx0XHR0aGlzLnNldENvbm5lY3Rpb25TdGF0ZSgncmVjb25uZWN0aW5nJyk7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0Y2FzZSBQZXJzaXN0ZW50Q29ubmVjdGlvbkV2ZW50VHlwZS5SZWNvbm5lY3Rpb25QZXJtYW5lbnRGYWlsdXJlOlxuXHRcdFx0XHRcdFx0XHR0aGlzLnNldENvbm5lY3Rpb25TdGF0ZSgnZGlzY29ubmVjdGVkJyk7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0Y2FzZSBQZXJzaXN0ZW50Q29ubmVjdGlvbkV2ZW50VHlwZS5Db25uZWN0aW9uR2Fpbjpcblx0XHRcdFx0XHRcdFx0dGhpcy5zZXRDb25uZWN0aW9uU3RhdGUoJ2Nvbm5lY3RlZCcpO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZS5vbkRpZENoYW5nZVdvcmtiZW5jaFN0YXRlKCgpID0+IHtcblx0XHRcdFx0dGhpcy51cGRhdGVWaXJ0dWFsV29ya3NwYWNlTG9jYXRpb24oKTtcblx0XHRcdFx0dGhpcy51cGRhdGVSZW1vdGVTdGF0dXNJbmRpY2F0b3IoKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHQvLyBPbmxpbmUgLyBPZmZsaW5lIGNoYW5nZXMgKHdlYiBvbmx5KVxuXHRcdGlmIChpc1dlYikge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuYW55KFxuXHRcdFx0XHR0aGlzLl9yZWdpc3RlcihuZXcgRG9tRW1pdHRlcihtYWluV2luZG93LCAnb25saW5lJykpLmV2ZW50LFxuXHRcdFx0XHR0aGlzLl9yZWdpc3RlcihuZXcgRG9tRW1pdHRlcihtYWluV2luZG93LCAnb2ZmbGluZScpKS5ldmVudFxuXHRcdFx0KSgoKSA9PiB0aGlzLnNldE5ldHdvcmtTdGF0ZShuYXZpZ2F0b3Iub25MaW5lID8gJ29ubGluZScgOiAnb2ZmbGluZScpKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5leHRlbnNpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlRXh0ZW5zaW9ucyhhc3luYyAocmVzdWx0KSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGV4dCBvZiByZXN1bHQuYWRkZWQpIHtcblx0XHRcdFx0Y29uc3QgaW5kZXggPSB0aGlzLnJlbW90ZUV4dGVuc2lvbk1ldGFkYXRhLmZpbmRJbmRleCh2YWx1ZSA9PiBFeHRlbnNpb25JZGVudGlmaWVyLmVxdWFscyh2YWx1ZS5pZCwgZXh0LmlkZW50aWZpZXIpKTtcblx0XHRcdFx0aWYgKGluZGV4ID4gLTEpIHtcblx0XHRcdFx0XHR0aGlzLnJlbW90ZUV4dGVuc2lvbk1ldGFkYXRhW2luZGV4XS5pbnN0YWxsZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5vbkRpZFVuaW5zdGFsbEV4dGVuc2lvbihhc3luYyAocmVzdWx0KSA9PiB7XG5cdFx0XHRjb25zdCBpbmRleCA9IHRoaXMucmVtb3RlRXh0ZW5zaW9uTWV0YWRhdGEuZmluZEluZGV4KHZhbHVlID0+IEV4dGVuc2lvbklkZW50aWZpZXIuZXF1YWxzKHZhbHVlLmlkLCByZXN1bHQuaWRlbnRpZmllci5pZCkpO1xuXHRcdFx0aWYgKGluZGV4ID4gLTEpIHtcblx0XHRcdFx0dGhpcy5yZW1vdGVFeHRlbnNpb25NZXRhZGF0YVtpbmRleF0uaW5zdGFsbGVkID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBpbml0aWFsaXplUmVtb3RlTWV0YWRhdGEoKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHRpZiAodGhpcy5yZW1vdGVNZXRhZGF0YUluaXRpYWxpemVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY3VycmVudFBsYXRmb3JtID0gUGxhdGZvcm1Ub1N0cmluZyhwbGF0Zm9ybSk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnJlbW90ZUV4dGVuc2lvbk1ldGFkYXRhLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBleHRlbnNpb25JZCA9IHRoaXMucmVtb3RlRXh0ZW5zaW9uTWV0YWRhdGFbaV0uaWQ7XG5cdFx0XHRjb25zdCBzdXBwb3J0ZWRQbGF0Zm9ybXMgPSB0aGlzLnJlbW90ZUV4dGVuc2lvbk1ldGFkYXRhW2ldLnN1cHBvcnRlZFBsYXRmb3Jtcztcblx0XHRcdGNvbnN0IGlzSW5zdGFsbGVkID0gKGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuZ2V0SW5zdGFsbGVkKCkpLmZpbmQodmFsdWUgPT4gRXh0ZW5zaW9uSWRlbnRpZmllci5lcXVhbHModmFsdWUuaWRlbnRpZmllci5pZCwgZXh0ZW5zaW9uSWQpKSA/IHRydWUgOiBmYWxzZTtcblxuXHRcdFx0dGhpcy5yZW1vdGVFeHRlbnNpb25NZXRhZGF0YVtpXS5pbnN0YWxsZWQgPSBpc0luc3RhbGxlZDtcblx0XHRcdGlmIChpc0luc3RhbGxlZCkge1xuXHRcdFx0XHR0aGlzLnJlbW90ZUV4dGVuc2lvbk1ldGFkYXRhW2ldLmlzUGxhdGZvcm1Db21wYXRpYmxlID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKHN1cHBvcnRlZFBsYXRmb3JtcyAmJiAhc3VwcG9ydGVkUGxhdGZvcm1zLmluY2x1ZGVzKGN1cnJlbnRQbGF0Zm9ybSkpIHtcblx0XHRcdFx0dGhpcy5yZW1vdGVFeHRlbnNpb25NZXRhZGF0YVtpXS5pc1BsYXRmb3JtQ29tcGF0aWJsZSA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSB7XG5cdFx0XHRcdHRoaXMucmVtb3RlRXh0ZW5zaW9uTWV0YWRhdGFbaV0uaXNQbGF0Zm9ybUNvbXBhdGlibGUgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMucmVtb3RlTWV0YWRhdGFJbml0aWFsaXplZCA9IHRydWU7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VFbnRyaWVzLmZpcmUoKTtcblx0XHR0aGlzLnVwZGF0ZVJlbW90ZVN0YXR1c0luZGljYXRvcigpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVWaXJ0dWFsV29ya3NwYWNlTG9jYXRpb24oKSB7XG5cdFx0dGhpcy52aXJ0dWFsV29ya3NwYWNlTG9jYXRpb24gPSBnZXRWaXJ0dWFsV29ya3NwYWNlTG9jYXRpb24odGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZVdoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvblNlcnZpY2Uud2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCk7XG5cblx0XHRjb25zdCByZW1vdGVBdXRob3JpdHkgPSB0aGlzLnJlbW90ZUF1dGhvcml0eTtcblx0XHRpZiAocmVtb3RlQXV0aG9yaXR5KSB7XG5cblx0XHRcdC8vIFRyeSB0byByZXNvbHZlIHRoZSBhdXRob3JpdHkgdG8gZmlndXJlIG91dCBjb25uZWN0aW9uIHN0YXRlXG5cdFx0XHQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IHsgYXV0aG9yaXR5IH0gPSBhd2FpdCB0aGlzLnJlbW90ZUF1dGhvcml0eVJlc29sdmVyU2VydmljZS5yZXNvbHZlQXV0aG9yaXR5KHJlbW90ZUF1dGhvcml0eSk7XG5cdFx0XHRcdFx0dGhpcy5jb25uZWN0aW9uVG9rZW4gPSBhdXRob3JpdHkuY29ubmVjdGlvblRva2VuO1xuXG5cdFx0XHRcdFx0dGhpcy5zZXRDb25uZWN0aW9uU3RhdGUoJ2Nvbm5lY3RlZCcpO1xuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdHRoaXMuc2V0Q29ubmVjdGlvblN0YXRlKCdkaXNjb25uZWN0ZWQnKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkoKTtcblx0XHR9XG5cblx0XHR0aGlzLnVwZGF0ZVJlbW90ZVN0YXR1c0luZGljYXRvcigpO1xuXHRcdHRoaXMuaW5pdGlhbGl6ZVJlbW90ZU1ldGFkYXRhKCk7XG5cdH1cblxuXHRwcml2YXRlIHNldENvbm5lY3Rpb25TdGF0ZShuZXdTdGF0ZTogJ2Rpc2Nvbm5lY3RlZCcgfCAnY29ubmVjdGVkJyB8ICdyZWNvbm5lY3RpbmcnKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuY29ubmVjdGlvblN0YXRlICE9PSBuZXdTdGF0ZSkge1xuXHRcdFx0dGhpcy5jb25uZWN0aW9uU3RhdGUgPSBuZXdTdGF0ZTtcblxuXHRcdFx0Ly8gc2ltcGxpZnkgY29udGV4dCBrZXkgd2hpY2ggZG9lc24ndCBzdXBwb3J0IGBjb25uZWN0aW5nYFxuXHRcdFx0aWYgKHRoaXMuY29ubmVjdGlvblN0YXRlID09PSAncmVjb25uZWN0aW5nJykge1xuXHRcdFx0XHR0aGlzLmNvbm5lY3Rpb25TdGF0ZUNvbnRleHRLZXkuc2V0KCdkaXNjb25uZWN0ZWQnKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuY29ubmVjdGlvblN0YXRlQ29udGV4dEtleS5zZXQodGhpcy5jb25uZWN0aW9uU3RhdGUpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBpbmRpY2F0ZSBzdGF0dXNcblx0XHRcdHRoaXMudXBkYXRlUmVtb3RlU3RhdHVzSW5kaWNhdG9yKCk7XG5cblx0XHRcdC8vIHN0YXJ0IG1lYXN1cmluZyBjb25uZWN0aW9uIGxhdGVuY3kgb25jZSBjb25uZWN0ZWRcblx0XHRcdGlmIChuZXdTdGF0ZSA9PT0gJ2Nvbm5lY3RlZCcpIHtcblx0XHRcdFx0dGhpcy5zY2hlZHVsZU1lYXN1cmVOZXR3b3JrQ29ubmVjdGlvbkxhdGVuY3koKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNjaGVkdWxlTWVhc3VyZU5ldHdvcmtDb25uZWN0aW9uTGF0ZW5jeSgpOiB2b2lkIHtcblx0XHRpZiAoXG5cdFx0XHQhdGhpcy5yZW1vdGVBdXRob3JpdHkgfHxcdFx0XHRcdFx0XHQvLyBvbmx5IHdoZW4gaGF2aW5nIGEgcmVtb3RlIGNvbm5lY3Rpb25cblx0XHRcdHRoaXMubWVhc3VyZU5ldHdvcmtDb25uZWN0aW9uTGF0ZW5jeVNjaGVkdWxlclx0Ly8gYWxyZWFkeSBzY2hlZHVsZWRcblx0XHQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLm1lYXN1cmVOZXR3b3JrQ29ubmVjdGlvbkxhdGVuY3lTY2hlZHVsZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB0aGlzLm1lYXN1cmVOZXR3b3JrQ29ubmVjdGlvbkxhdGVuY3koKSwgUmVtb3RlU3RhdHVzSW5kaWNhdG9yLlJFTU9URV9DT05ORUNUSU9OX0xBVEVOQ1lfU0NIRURVTEVSX0RFTEFZKSk7XG5cdFx0dGhpcy5tZWFzdXJlTmV0d29ya0Nvbm5lY3Rpb25MYXRlbmN5U2NoZWR1bGVyLnNjaGVkdWxlKFJlbW90ZVN0YXR1c0luZGljYXRvci5SRU1PVEVfQ09OTkVDVElPTl9MQVRFTkNZX1NDSEVEVUxFUl9GSVJTVF9SVU5fREVMQVkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBtZWFzdXJlTmV0d29ya0Nvbm5lY3Rpb25MYXRlbmN5KCk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gTWVhc3VyZSBsYXRlbmN5IGlmIHdlIGFyZSBvbmxpbmVcblx0XHQvLyBidXQgb25seSB3aGVuIHRoZSB3aW5kb3cgaGFzIGZvY3VzIHRvIHByZXZlbnQgY29uc3RhbnRseVxuXHRcdC8vIHdha2luZyB1cCB0aGUgY29ubmVjdGlvbiB0byB0aGUgcmVtb3RlXG5cblx0XHRpZiAodGhpcy5ob3N0U2VydmljZS5oYXNGb2N1cyAmJiB0aGlzLm5ldHdvcmtTdGF0ZSAhPT0gJ29mZmxpbmUnKSB7XG5cdFx0XHRjb25zdCBtZWFzdXJlbWVudCA9IGF3YWl0IHJlbW90ZUNvbm5lY3Rpb25MYXRlbmN5TWVhc3VyZXIubWVhc3VyZSh0aGlzLnJlbW90ZUFnZW50U2VydmljZSk7XG5cdFx0XHRpZiAobWVhc3VyZW1lbnQpIHtcblx0XHRcdFx0aWYgKG1lYXN1cmVtZW50LmhpZ2gpIHtcblx0XHRcdFx0XHR0aGlzLnNldE5ldHdvcmtTdGF0ZSgnaGlnaC1sYXRlbmN5Jyk7XG5cdFx0XHRcdH0gZWxzZSBpZiAodGhpcy5uZXR3b3JrU3RhdGUgPT09ICdoaWdoLWxhdGVuY3knKSB7XG5cdFx0XHRcdFx0dGhpcy5zZXROZXR3b3JrU3RhdGUoJ29ubGluZScpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5tZWFzdXJlTmV0d29ya0Nvbm5lY3Rpb25MYXRlbmN5U2NoZWR1bGVyPy5zY2hlZHVsZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBzZXROZXR3b3JrU3RhdGUobmV3U3RhdGU6ICdvbmxpbmUnIHwgJ29mZmxpbmUnIHwgJ2hpZ2gtbGF0ZW5jeScpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5uZXR3b3JrU3RhdGUgIT09IG5ld1N0YXRlKSB7XG5cdFx0XHRjb25zdCBvbGRTdGF0ZSA9IHRoaXMubmV0d29ya1N0YXRlO1xuXHRcdFx0dGhpcy5uZXR3b3JrU3RhdGUgPSBuZXdTdGF0ZTtcblxuXHRcdFx0aWYgKG5ld1N0YXRlID09PSAnaGlnaC1sYXRlbmN5Jykge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2FybihgUmVtb3RlIG5ldHdvcmsgY29ubmVjdGlvbiBhcHBlYXJzIHRvIGhhdmUgaGlnaCBsYXRlbmN5ICgke3JlbW90ZUNvbm5lY3Rpb25MYXRlbmN5TWVhc3VyZXIubGF0ZW5jeT8uY3VycmVudD8udG9GaXhlZCgyKX1tcyBsYXN0LCAke3JlbW90ZUNvbm5lY3Rpb25MYXRlbmN5TWVhc3VyZXIubGF0ZW5jeT8uYXZlcmFnZT8udG9GaXhlZCgyKX1tcyBhdmVyYWdlKWApO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5jb25uZWN0aW9uVG9rZW4pIHtcblx0XHRcdFx0aWYgKG5ld1N0YXRlID09PSAnb25saW5lJyAmJiBvbGRTdGF0ZSA9PT0gJ2hpZ2gtbGF0ZW5jeScpIHtcblx0XHRcdFx0XHR0aGlzLmxvZ05ldHdvcmtDb25uZWN0aW9uSGVhbHRoVGVsZW1ldHJ5KHRoaXMuY29ubmVjdGlvblRva2VuLCAnZ29vZCcpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKG5ld1N0YXRlID09PSAnaGlnaC1sYXRlbmN5JyAmJiBvbGRTdGF0ZSA9PT0gJ29ubGluZScpIHtcblx0XHRcdFx0XHR0aGlzLmxvZ05ldHdvcmtDb25uZWN0aW9uSGVhbHRoVGVsZW1ldHJ5KHRoaXMuY29ubmVjdGlvblRva2VuLCAncG9vcicpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIHVwZGF0ZSBzdGF0dXNcblx0XHRcdHRoaXMudXBkYXRlUmVtb3RlU3RhdHVzSW5kaWNhdG9yKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBsb2dOZXR3b3JrQ29ubmVjdGlvbkhlYWx0aFRlbGVtZXRyeShjb25uZWN0aW9uVG9rZW46IHN0cmluZywgY29ubmVjdGlvbkhlYWx0aDogJ2dvb2QnIHwgJ3Bvb3InKTogdm9pZCB7XG5cdFx0dHlwZSBSZW1vdGVDb25uZWN0aW9uSGVhbHRoQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRvd25lcjogJ2FsZXhkaW1hJztcblx0XHRcdGNvbW1lbnQ6ICdUaGUgcmVtb3RlIGNvbm5lY3Rpb24gaGVhbHRoIGhhcyBjaGFuZ2VkIChyb3VuZCB0cmlwIHRpbWUpJztcblx0XHRcdHJlbW90ZU5hbWU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgbmFtZSBvZiB0aGUgcmVzb2x2ZXIuJyB9O1xuXHRcdFx0cmVjb25uZWN0aW9uVG9rZW46IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgaWRlbnRpZmllciBvZiB0aGUgY29ubmVjdGlvbi4nIH07XG5cdFx0XHRjb25uZWN0aW9uSGVhbHRoOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIGhlYWx0aCBvZiB0aGUgY29ubmVjdGlvbjogZ29vZCBvciBwb29yLicgfTtcblx0XHR9O1xuXHRcdHR5cGUgUmVtb3RlQ29ubmVjdGlvbkhlYWx0aEV2ZW50ID0ge1xuXHRcdFx0cmVtb3RlTmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0cmVjb25uZWN0aW9uVG9rZW46IHN0cmluZztcblx0XHRcdGNvbm5lY3Rpb25IZWFsdGg6ICdnb29kJyB8ICdwb29yJztcblx0XHR9O1xuXHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFJlbW90ZUNvbm5lY3Rpb25IZWFsdGhFdmVudCwgUmVtb3RlQ29ubmVjdGlvbkhlYWx0aENsYXNzaWZpY2F0aW9uPigncmVtb3RlQ29ubmVjdGlvbkhlYWx0aCcsIHtcblx0XHRcdHJlbW90ZU5hbWU6IGdldFJlbW90ZU5hbWUodGhpcy5yZW1vdGVBdXRob3JpdHkpLFxuXHRcdFx0cmVjb25uZWN0aW9uVG9rZW46IGNvbm5lY3Rpb25Ub2tlbixcblx0XHRcdGNvbm5lY3Rpb25IZWFsdGhcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgdmFsaWRhdGVkR3JvdXAoZ3JvdXA6IHN0cmluZykge1xuXHRcdGlmICghZ3JvdXAubWF0Y2goL14ocmVtb3RlfHZpcnR1YWxmcylfKFxcZFxcZClfKChbYS16XVthLXowLTkrLi1dKilfKC4qKSkkLykpIHtcblx0XHRcdGlmICghdGhpcy5sb2dnZWRJbnZhbGlkR3JvdXBOYW1lc1tncm91cF0pIHtcblx0XHRcdFx0dGhpcy5sb2dnZWRJbnZhbGlkR3JvdXBOYW1lc1tncm91cF0gPSB0cnVlO1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2FybihgSW52YWxpZCBncm91cCBuYW1lIHVzZWQgaW4gXCJzdGF0dXNCYXIvcmVtb3RlSW5kaWNhdG9yXCIgbWVudSBjb250cmlidXRpb246ICR7Z3JvdXB9LiBFbnRyaWVzIGlnbm9yZWQuIEV4cGVjdGVkIGZvcm1hdDogJ3JlbW90ZV8kT1JERVJfJFJFTU9URU5BTUVfJEdST1VQSU5HIG9yICd2aXJ0dWFsZnNfJE9SREVSXyRGSUxFU0NIRU1FXyRHUk9VUElORy5gKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGdldFJlbW90ZU1lbnVBY3Rpb25zKGRvTm90VXNlQ2FjaGU/OiBib29sZWFuKTogQWN0aW9uR3JvdXBbXSB7XG5cdFx0aWYgKCF0aGlzLnJlbW90ZU1lbnVBY3Rpb25zR3JvdXBzIHx8IGRvTm90VXNlQ2FjaGUpIHtcblx0XHRcdHRoaXMucmVtb3RlTWVudUFjdGlvbnNHcm91cHMgPSB0aGlzLnJlbW90ZUluZGljYXRvck1lbnUuZ2V0QWN0aW9ucygpLmZpbHRlcihhID0+IHRoaXMudmFsaWRhdGVkR3JvdXAoYVswXSkpLmNvbmNhdCh0aGlzLmxlZ2FjeUluZGljYXRvck1lbnUuZ2V0QWN0aW9ucygpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMucmVtb3RlTWVudUFjdGlvbnNHcm91cHM7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVJlbW90ZVN0YXR1c0luZGljYXRvcigpOiB2b2lkIHtcblxuXHRcdC8vIFJlbW90ZSBJbmRpY2F0b3I6IHNob3cgaWYgcHJvdmlkZWQgdmlhIG9wdGlvbnMsIGUuZy4gYnkgdGhlIHdlYiBlbWJlZGRlciBBUElcblx0XHRjb25zdCByZW1vdGVJbmRpY2F0b3IgPSB0aGlzLmVudmlyb25tZW50U2VydmljZS5vcHRpb25zPy53aW5kb3dJbmRpY2F0b3I7XG5cdFx0aWYgKHJlbW90ZUluZGljYXRvcikge1xuXHRcdFx0bGV0IHJlbW90ZUluZGljYXRvckxhYmVsID0gcmVtb3RlSW5kaWNhdG9yLmxhYmVsLnRyaW0oKTtcblx0XHRcdGlmICghcmVtb3RlSW5kaWNhdG9yTGFiZWwuc3RhcnRzV2l0aCgnJCgnKSkge1xuXHRcdFx0XHRyZW1vdGVJbmRpY2F0b3JMYWJlbCA9IGAkKHJlbW90ZSkgJHtyZW1vdGVJbmRpY2F0b3JMYWJlbH1gOyAvLyBlbnN1cmUgdGhlIGluZGljYXRvciBoYXMgYSBjb2RpY29uXG5cdFx0XHR9XG5cblx0XHRcdHRoaXMucmVuZGVyUmVtb3RlU3RhdHVzSW5kaWNhdG9yKHRydW5jYXRlKHJlbW90ZUluZGljYXRvckxhYmVsLCBSZW1vdGVTdGF0dXNJbmRpY2F0b3IuUkVNT1RFX1NUQVRVU19MQUJFTF9NQVhfTEVOR1RIKSwgcmVtb3RlSW5kaWNhdG9yLnRvb2x0aXAsIHJlbW90ZUluZGljYXRvci5jb21tYW5kKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBTaG93IGZvciByZW1vdGUgd2luZG93cyBvbiB0aGUgZGVza3RvcFxuXHRcdGlmICh0aGlzLnJlbW90ZUF1dGhvcml0eSkge1xuXHRcdFx0Y29uc3QgaG9zdExhYmVsID0gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0SG9zdExhYmVsKFNjaGVtYXMudnNjb2RlUmVtb3RlLCB0aGlzLnJlbW90ZUF1dGhvcml0eSkgfHwgdGhpcy5yZW1vdGVBdXRob3JpdHk7XG5cdFx0XHRzd2l0Y2ggKHRoaXMuY29ubmVjdGlvblN0YXRlKSB7XG5cdFx0XHRcdGNhc2UgJ2luaXRpYWxpemluZyc6XG5cdFx0XHRcdFx0dGhpcy5yZW5kZXJSZW1vdGVTdGF0dXNJbmRpY2F0b3IobmxzLmxvY2FsaXplKCdob3N0Lm9wZW4nLCBcIk9wZW5pbmcgUmVtb3RlLi4uXCIpLCBubHMubG9jYWxpemUoJ2hvc3Qub3BlbicsIFwiT3BlbmluZyBSZW1vdGUuLi5cIiksIHVuZGVmaW5lZCwgdHJ1ZSAvKiBwcm9ncmVzcyAqLyk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ3JlY29ubmVjdGluZyc6XG5cdFx0XHRcdFx0dGhpcy5yZW5kZXJSZW1vdGVTdGF0dXNJbmRpY2F0b3IoYCR7bmxzLmxvY2FsaXplKCdob3N0LnJlY29ubmVjdGluZycsIFwiUmVjb25uZWN0aW5nIHRvIHswfS4uLlwiLCB0cnVuY2F0ZShob3N0TGFiZWwsIFJlbW90ZVN0YXR1c0luZGljYXRvci5SRU1PVEVfU1RBVFVTX0xBQkVMX01BWF9MRU5HVEgpKX1gLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSAvKiBwcm9ncmVzcyAqLyk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ2Rpc2Nvbm5lY3RlZCc6XG5cdFx0XHRcdFx0dGhpcy5yZW5kZXJSZW1vdGVTdGF0dXNJbmRpY2F0b3IoYCQoYWxlcnQpICR7bmxzLmxvY2FsaXplKCdkaXNjb25uZWN0ZWRGcm9tJywgXCJEaXNjb25uZWN0ZWQgZnJvbSB7MH1cIiwgdHJ1bmNhdGUoaG9zdExhYmVsLCBSZW1vdGVTdGF0dXNJbmRpY2F0b3IuUkVNT1RFX1NUQVRVU19MQUJFTF9NQVhfTEVOR1RIKSl9YCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGRlZmF1bHQ6IHtcblx0XHRcdFx0XHRjb25zdCB0b29sdGlwID0gbmV3IE1hcmtkb3duU3RyaW5nKCcnLCB7IGlzVHJ1c3RlZDogdHJ1ZSwgc3VwcG9ydFRoZW1lSWNvbnM6IHRydWUgfSk7XG5cdFx0XHRcdFx0Y29uc3QgaG9zdE5hbWVUb29sdGlwID0gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0SG9zdFRvb2x0aXAoU2NoZW1hcy52c2NvZGVSZW1vdGUsIHRoaXMucmVtb3RlQXV0aG9yaXR5KTtcblx0XHRcdFx0XHRpZiAoaG9zdE5hbWVUb29sdGlwKSB7XG5cdFx0XHRcdFx0XHR0b29sdGlwLmFwcGVuZE1hcmtkb3duKGhvc3ROYW1lVG9vbHRpcCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRvb2x0aXAuYXBwZW5kVGV4dChubHMubG9jYWxpemUoeyBrZXk6ICdob3N0LnRvb2x0aXAnLCBjb21tZW50OiBbJ3swfSBpcyBhIHJlbW90ZSBob3N0IG5hbWUsIGUuZy4gRGV2IENvbnRhaW5lciddIH0sIFwiRWRpdGluZyBvbiB7MH1cIiwgaG9zdExhYmVsKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMucmVuZGVyUmVtb3RlU3RhdHVzSW5kaWNhdG9yKGAkKHJlbW90ZSkgJHt0cnVuY2F0ZShob3N0TGFiZWwsIFJlbW90ZVN0YXR1c0luZGljYXRvci5SRU1PVEVfU1RBVFVTX0xBQkVMX01BWF9MRU5HVEgpfWAsIHRvb2x0aXApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdC8vIFNob3cgd2hlbiBpbiBhIHZpcnR1YWwgd29ya3NwYWNlXG5cdFx0aWYgKHRoaXMudmlydHVhbFdvcmtzcGFjZUxvY2F0aW9uKSB7XG5cblx0XHRcdC8vIFdvcmtzcGFjZSB3aXRoIGxhYmVsOiBpbmRpY2F0ZSBlZGl0aW5nIHNvdXJjZVxuXHRcdFx0Y29uc3Qgd29ya3NwYWNlTGFiZWwgPSB0aGlzLmxhYmVsU2VydmljZS5nZXRIb3N0TGFiZWwodGhpcy52aXJ0dWFsV29ya3NwYWNlTG9jYXRpb24uc2NoZW1lLCB0aGlzLnZpcnR1YWxXb3Jrc3BhY2VMb2NhdGlvbi5hdXRob3JpdHkpO1xuXHRcdFx0aWYgKHdvcmtzcGFjZUxhYmVsKSB7XG5cdFx0XHRcdGNvbnN0IHRvb2x0aXAgPSBuZXcgTWFya2Rvd25TdHJpbmcoJycsIHsgaXNUcnVzdGVkOiB0cnVlLCBzdXBwb3J0VGhlbWVJY29uczogdHJ1ZSB9KTtcblx0XHRcdFx0Y29uc3QgaG9zdE5hbWVUb29sdGlwID0gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0SG9zdFRvb2x0aXAodGhpcy52aXJ0dWFsV29ya3NwYWNlTG9jYXRpb24uc2NoZW1lLCB0aGlzLnZpcnR1YWxXb3Jrc3BhY2VMb2NhdGlvbi5hdXRob3JpdHkpO1xuXHRcdFx0XHRpZiAoaG9zdE5hbWVUb29sdGlwKSB7XG5cdFx0XHRcdFx0dG9vbHRpcC5hcHBlbmRNYXJrZG93bihob3N0TmFtZVRvb2x0aXApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRvb2x0aXAuYXBwZW5kVGV4dChubHMubG9jYWxpemUoeyBrZXk6ICd3b3Jrc3BhY2UudG9vbHRpcCcsIGNvbW1lbnQ6IFsnezB9IGlzIGEgcmVtb3RlIHdvcmtzcGFjZSBuYW1lLCBlLmcuIEdpdEh1YiddIH0sIFwiRWRpdGluZyBvbiB7MH1cIiwgd29ya3NwYWNlTGFiZWwpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIWlzV2ViIHx8IHRoaXMucmVtb3RlQXV0aG9yaXR5KSB7XG5cdFx0XHRcdFx0dG9vbHRpcC5hcHBlbmRNYXJrZG93bignXFxuXFxuJyk7XG5cdFx0XHRcdFx0dG9vbHRpcC5hcHBlbmRNYXJrZG93bihubHMubG9jYWxpemUoXG5cdFx0XHRcdFx0XHR7IGtleTogJ3dvcmtzcGFjZS50b29sdGlwMicsIGNvbW1lbnQ6IFsnW2ZlYXR1cmVzIGFyZSBub3QgYXZhaWxhYmxlXSh7MX0pIGlzIGEgbGluay4gT25seSB0cmFuc2xhdGUgYGZlYXR1cmVzIGFyZSBub3QgYXZhaWxhYmxlYC4gRG8gbm90IGNoYW5nZSBicmFja2V0cyBhbmQgcGFyZW50aGVzZXMgb3IgezB9J10gfSxcblx0XHRcdFx0XHRcdFwiU29tZSBbZmVhdHVyZXMgYXJlIG5vdCBhdmFpbGFibGVdKHswfSkgZm9yIHJlc291cmNlcyBsb2NhdGVkIG9uIGEgdmlydHVhbCBmaWxlIHN5c3RlbS5cIixcblx0XHRcdFx0XHRcdGBjb21tYW5kOiR7TElTVF9XT1JLU1BBQ0VfVU5TVVBQT1JURURfRVhURU5TSU9OU19DT01NQU5EX0lEfWBcblx0XHRcdFx0XHQpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnJlbmRlclJlbW90ZVN0YXR1c0luZGljYXRvcihgJChyZW1vdGUpICR7dHJ1bmNhdGUod29ya3NwYWNlTGFiZWwsIFJlbW90ZVN0YXR1c0luZGljYXRvci5SRU1PVEVfU1RBVFVTX0xBQkVMX01BWF9MRU5HVEgpfWAsIHRvb2x0aXApO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5yZW5kZXJSZW1vdGVTdGF0dXNJbmRpY2F0b3IoYCQocmVtb3RlKWAsIG5scy5sb2NhbGl6ZSgnbm9Ib3N0LnRvb2x0aXAnLCBcIk9wZW4gYSBSZW1vdGUgV2luZG93XCIpKTtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclJlbW90ZVN0YXR1c0luZGljYXRvcihpbml0aWFsVGV4dDogc3RyaW5nLCBpbml0aWFsVG9vbHRpcD86IHN0cmluZyB8IE1hcmtkb3duU3RyaW5nLCBjb21tYW5kPzogc3RyaW5nLCBzaG93UHJvZ3Jlc3M/OiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgeyB0ZXh0LCB0b29sdGlwLCBhcmlhTGFiZWwgfSA9IHRoaXMud2l0aE5ldHdvcmtTdGF0dXMoaW5pdGlhbFRleHQsIGluaXRpYWxUb29sdGlwLCBzaG93UHJvZ3Jlc3MpO1xuXG5cdFx0Y29uc3QgcHJvcGVydGllczogSVN0YXR1c2JhckVudHJ5ID0ge1xuXHRcdFx0bmFtZTogbmxzLmxvY2FsaXplKCdyZW1vdGVIb3N0JywgXCJSZW1vdGUgSG9zdFwiKSxcblx0XHRcdGtpbmQ6IHRoaXMubmV0d29ya1N0YXRlID09PSAnb2ZmbGluZScgPyAnb2ZmbGluZScgOiAncmVtb3RlJyxcblx0XHRcdGFyaWFMYWJlbCxcblx0XHRcdHRleHQsXG5cdFx0XHRzaG93UHJvZ3Jlc3MsXG5cdFx0XHR0b29sdGlwLFxuXHRcdFx0Y29tbWFuZDogY29tbWFuZCA/PyBSZW1vdGVTdGF0dXNJbmRpY2F0b3IuUkVNT1RFX0FDVElPTlNfQ09NTUFORF9JRFxuXHRcdH07XG5cblx0XHRpZiAodGhpcy5yZW1vdGVTdGF0dXNFbnRyeSkge1xuXHRcdFx0dGhpcy5yZW1vdGVTdGF0dXNFbnRyeS51cGRhdGUocHJvcGVydGllcyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMucmVtb3RlU3RhdHVzRW50cnkgPSB0aGlzLnN0YXR1c2JhclNlcnZpY2UuYWRkRW50cnkocHJvcGVydGllcywgJ3N0YXR1cy5ob3N0JywgU3RhdHVzYmFyQWxpZ25tZW50LkxFRlQsIE51bWJlci5QT1NJVElWRV9JTkZJTklUWSAvKiBmaXJzdCBlbnRyeSAqLyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB3aXRoTmV0d29ya1N0YXR1cyhpbml0aWFsVGV4dDogc3RyaW5nLCBpbml0aWFsVG9vbHRpcD86IHN0cmluZyB8IE1hcmtkb3duU3RyaW5nLCBzaG93UHJvZ3Jlc3M/OiBib29sZWFuKTogeyB0ZXh0OiBzdHJpbmc7IHRvb2x0aXA6IHN0cmluZyB8IElNYXJrZG93blN0cmluZyB8IHVuZGVmaW5lZDsgYXJpYUxhYmVsOiBzdHJpbmcgfSB7XG5cdFx0bGV0IHRleHQgPSBpbml0aWFsVGV4dDtcblx0XHRsZXQgdG9vbHRpcCA9IGluaXRpYWxUb29sdGlwO1xuXHRcdGxldCBhcmlhTGFiZWwgPSBnZXRDb2RpY29uQXJpYUxhYmVsKHRleHQpO1xuXG5cdFx0ZnVuY3Rpb24gdGV4dFdpdGhBbGVydCgpOiBzdHJpbmcge1xuXG5cdFx0XHQvLyBgaW5pdGlhbFRleHRgIGNhbiBoYXZlIGEgY29kaWNvbiBpbiB0aGUgYmVnaW5uaW5nIHRoYXQgYWxyZWFkeVxuXHRcdFx0Ly8gaW5kaWNhdGVzIHNvbWUga2luZCBvZiBzdGF0dXMsIG9yIHdlIG1heSBoYXZlIGJlZW4gYXNrZWQgdG9cblx0XHRcdC8vIHNob3cgcHJvZ3Jlc3MsIHdoZXJlIGEgc3Bpbm5pbmcgY29kaWNvbiBhcHBlYXJzLiB3ZSBvbmx5IHdhbnRcblx0XHRcdC8vIHRvIHJlcGxhY2Ugd2l0aCBhbiBhbGVydCBpY29uIGZvciB3aGVuIGEgbm9ybWFsIHJlbW90ZSBpbmRpY2F0b3Jcblx0XHRcdC8vIGlzIHNob3duLlxuXG5cdFx0XHRpZiAoIXNob3dQcm9ncmVzcyAmJiBpbml0aWFsVGV4dC5zdGFydHNXaXRoKCckKHJlbW90ZSknKSkge1xuXHRcdFx0XHRyZXR1cm4gaW5pdGlhbFRleHQucmVwbGFjZSgnJChyZW1vdGUpJywgJyQoYWxlcnQpJyk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBpbml0aWFsVGV4dDtcblx0XHR9XG5cblx0XHRzd2l0Y2ggKHRoaXMubmV0d29ya1N0YXRlKSB7XG5cdFx0XHRjYXNlICdvZmZsaW5lJzoge1xuXHRcdFx0XHRjb25zdCBvZmZsaW5lTWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgnbmV0d29ya1N0YXR1c09mZmxpbmVUb29sdGlwJywgXCJOZXR3b3JrIGFwcGVhcnMgdG8gYmUgb2ZmbGluZSwgY2VydGFpbiBmZWF0dXJlcyBtaWdodCBiZSB1bmF2YWlsYWJsZS5cIik7XG5cblx0XHRcdFx0dGV4dCA9IHRleHRXaXRoQWxlcnQoKTtcblx0XHRcdFx0dG9vbHRpcCA9IHRoaXMuYXBwZW5kVG9vbHRpcExpbmUodG9vbHRpcCwgb2ZmbGluZU1lc3NhZ2UpO1xuXHRcdFx0XHRhcmlhTGFiZWwgPSBgJHthcmlhTGFiZWx9LCAke29mZmxpbmVNZXNzYWdlfWA7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnaGlnaC1sYXRlbmN5Jzpcblx0XHRcdFx0dGV4dCA9IHRleHRXaXRoQWxlcnQoKTtcblx0XHRcdFx0dG9vbHRpcCA9IHRoaXMuYXBwZW5kVG9vbHRpcExpbmUodG9vbHRpcCwgbmxzLmxvY2FsaXplKCduZXR3b3JrU3RhdHVzSGlnaExhdGVuY3lUb29sdGlwJywgXCJOZXR3b3JrIGFwcGVhcnMgdG8gaGF2ZSBoaWdoIGxhdGVuY3kgKHswfW1zIGxhc3QsIHsxfW1zIGF2ZXJhZ2UpLCBjZXJ0YWluIGZlYXR1cmVzIG1heSBiZSBzbG93IHRvIHJlc3BvbmQuXCIsIHJlbW90ZUNvbm5lY3Rpb25MYXRlbmN5TWVhc3VyZXIubGF0ZW5jeT8uY3VycmVudD8udG9GaXhlZCgyKSwgcmVtb3RlQ29ubmVjdGlvbkxhdGVuY3lNZWFzdXJlci5sYXRlbmN5Py5hdmVyYWdlPy50b0ZpeGVkKDIpKSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdHJldHVybiB7IHRleHQsIHRvb2x0aXAsIGFyaWFMYWJlbCB9O1xuXHR9XG5cblx0cHJpdmF0ZSBhcHBlbmRUb29sdGlwTGluZSh0b29sdGlwOiBzdHJpbmcgfCBNYXJrZG93blN0cmluZyB8IHVuZGVmaW5lZCwgbGluZTogc3RyaW5nKTogTWFya2Rvd25TdHJpbmcge1xuXHRcdGxldCBtYXJrZG93blRvb2x0aXA6IE1hcmtkb3duU3RyaW5nO1xuXHRcdGlmICh0eXBlb2YgdG9vbHRpcCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdG1hcmtkb3duVG9vbHRpcCA9IG5ldyBNYXJrZG93blN0cmluZyh0b29sdGlwLCB7IGlzVHJ1c3RlZDogdHJ1ZSwgc3VwcG9ydFRoZW1lSWNvbnM6IHRydWUgfSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1hcmtkb3duVG9vbHRpcCA9IHRvb2x0aXAgPz8gbmV3IE1hcmtkb3duU3RyaW5nKCcnLCB7IGlzVHJ1c3RlZDogdHJ1ZSwgc3VwcG9ydFRoZW1lSWNvbnM6IHRydWUgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKG1hcmtkb3duVG9vbHRpcC52YWx1ZS5sZW5ndGggPiAwKSB7XG5cdFx0XHRtYXJrZG93blRvb2x0aXAuYXBwZW5kTWFya2Rvd24oJ1xcblxcbicpO1xuXHRcdH1cblxuXHRcdG1hcmtkb3duVG9vbHRpcC5hcHBlbmRNYXJrZG93bihsaW5lKTtcblxuXHRcdHJldHVybiBtYXJrZG93blRvb2x0aXA7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGluc3RhbGxFeHRlbnNpb24oZXh0ZW5zaW9uSWQ6IHN0cmluZywgcmVtb3RlTGFiZWw6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmluc3RhbGwoZXh0ZW5zaW9uSWQsIHtcblx0XHRcdFx0aXNNYWNoaW5lU2NvcGVkOiBmYWxzZSxcblx0XHRcdFx0ZG9ub3RJbmNsdWRlUGFja0FuZERlcGVuZGVuY2llczogZmFsc2UsXG5cdFx0XHRcdGNvbnRleHQ6IHsgW0VYVEVOU0lPTl9JTlNUQUxMX1NLSVBfV0FMS1RIUk9VR0hfQ09OVEVYVF06IHRydWUgfVxuXHRcdFx0fSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGlmICghdGhpcy5saWZlY3ljbGVTZXJ2aWNlLndpbGxTaHV0ZG93bikge1xuXHRcdFx0XHRjb25zdCB7IGNvbmZpcm1lZCB9ID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0XHRcdHR5cGU6IFNldmVyaXR5LkVycm9yLFxuXHRcdFx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgndW5rbm93blNldHVwRXJyb3InLCBcIkFuIGVycm9yIG9jY3VycmVkIHdoaWxlIHNldHRpbmcgdXAgezB9LiBXb3VsZCB5b3UgbGlrZSB0byB0cnkgYWdhaW4/XCIsIHJlbW90ZUxhYmVsKSxcblx0XHRcdFx0XHRkZXRhaWw6IGVycm9yICYmICFpc0NhbmNlbGxhdGlvbkVycm9yKGVycm9yKSA/IHRvRXJyb3JNZXNzYWdlKGVycm9yKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRwcmltYXJ5QnV0dG9uOiBubHMubG9jYWxpemUoJ3JldHJ5JywgXCJSZXRyeVwiKVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKGNvbmZpcm1lZCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmluc3RhbGxFeHRlbnNpb24oZXh0ZW5zaW9uSWQsIHJlbW90ZUxhYmVsKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBydW5SZW1vdGVTdGFydENvbW1hbmQoZXh0ZW5zaW9uSWQ6IHN0cmluZywgc3RhcnRDb21tYW5kOiBzdHJpbmcpIHtcblxuXHRcdC8vIGNoZWNrIHRvIGVuc3VyZSB0aGUgZXh0ZW5zaW9uIGlzIGluc3RhbGxlZFxuXHRcdGF3YWl0IHJldHJ5KGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGV4dCA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uU2VydmljZS5nZXRFeHRlbnNpb24oZXh0ZW5zaW9uSWQpO1xuXHRcdFx0aWYgKCFleHQpIHtcblx0XHRcdFx0dGhyb3cgRXJyb3IoJ0ZhaWxlZCB0byBmaW5kIGluc3RhbGxlZCByZW1vdGUgZXh0ZW5zaW9uJyk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZXh0O1xuXHRcdH0sIDMwMCwgMTApO1xuXG5cdFx0dGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChzdGFydENvbW1hbmQpO1xuXHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkRXZlbnQsIFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkQ2xhc3NpZmljYXRpb24+KCd3b3JrYmVuY2hBY3Rpb25FeGVjdXRlZCcsIHtcblx0XHRcdGlkOiAncmVtb3RlSW5zdGFsbEFuZFJ1bicsXG5cdFx0XHRkZXRhaWw6IGV4dGVuc2lvbklkLFxuXHRcdFx0ZnJvbTogJ3JlbW90ZSBpbmRpY2F0b3InXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHNob3dSZW1vdGVNZW51KCkge1xuXHRcdGNvbnN0IGdldENhdGVnb3J5TGFiZWwgPSAoYWN0aW9uOiBNZW51SXRlbUFjdGlvbikgPT4ge1xuXHRcdFx0aWYgKGFjdGlvbi5pdGVtLmNhdGVnb3J5KSB7XG5cdFx0XHRcdHJldHVybiB0eXBlb2YgYWN0aW9uLml0ZW0uY2F0ZWdvcnkgPT09ICdzdHJpbmcnID8gYWN0aW9uLml0ZW0uY2F0ZWdvcnkgOiBhY3Rpb24uaXRlbS5jYXRlZ29yeS52YWx1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fTtcblxuXHRcdGNvbnN0IG1hdGNoQ3VycmVudFJlbW90ZSA9ICgpID0+IHtcblx0XHRcdGlmICh0aGlzLnJlbW90ZUF1dGhvcml0eSkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFJlZ0V4cChgXnJlbW90ZV9cXFxcZFxcXFxkXyR7Z2V0UmVtb3RlTmFtZSh0aGlzLnJlbW90ZUF1dGhvcml0eSl9X2ApO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLnZpcnR1YWxXb3Jrc3BhY2VMb2NhdGlvbikge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFJlZ0V4cChgXnZpcnR1YWxmc19cXFxcZFxcXFxkXyR7dGhpcy52aXJ0dWFsV29ya3NwYWNlTG9jYXRpb24uc2NoZW1lfV9gKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGNvbXB1dGVJdGVtcyA9ICgpID0+IHtcblx0XHRcdGxldCBhY3Rpb25Hcm91cHMgPSB0aGlzLmdldFJlbW90ZU1lbnVBY3Rpb25zKHRydWUpO1xuXG5cdFx0XHRjb25zdCBpdGVtczogUXVpY2tQaWNrSXRlbVtdID0gW107XG5cblx0XHRcdGNvbnN0IGN1cnJlbnRSZW1vdGVNYXRjaGVyID0gbWF0Y2hDdXJyZW50UmVtb3RlKCk7XG5cdFx0XHRpZiAoY3VycmVudFJlbW90ZU1hdGNoZXIpIHtcblx0XHRcdFx0Ly8gY29tbWFuZHMgZm9yIHRoZSBjdXJyZW50IHJlbW90ZSBnbyBmaXJzdFxuXHRcdFx0XHRhY3Rpb25Hcm91cHMgPSBhY3Rpb25Hcm91cHMuc29ydCgoZzEsIGcyKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgaXNDdXJyZW50UmVtb3RlMSA9IGN1cnJlbnRSZW1vdGVNYXRjaGVyLnRlc3QoZzFbMF0pO1xuXHRcdFx0XHRcdGNvbnN0IGlzQ3VycmVudFJlbW90ZTIgPSBjdXJyZW50UmVtb3RlTWF0Y2hlci50ZXN0KGcyWzBdKTtcblx0XHRcdFx0XHRpZiAoaXNDdXJyZW50UmVtb3RlMSAhPT0gaXNDdXJyZW50UmVtb3RlMikge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGlzQ3VycmVudFJlbW90ZTEgPyAtMSA6IDE7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC8vIGxlZ2FjeSBpbmRpY2F0b3IgY29tbWFuZHMgZ28gbGFzdFxuXHRcdFx0XHRcdGlmIChnMVswXSAhPT0gJycgJiYgZzJbMF0gPT09ICcnKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gLTE7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChnMVswXSA9PT0gJycgJiYgZzJbMF0gIT09ICcnKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gMTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGcxWzBdLmxvY2FsZUNvbXBhcmUoZzJbMF0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0bGV0IGxhc3RDYXRlZ29yeU5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdFx0Zm9yIChjb25zdCBhY3Rpb25Hcm91cCBvZiBhY3Rpb25Hcm91cHMpIHtcblx0XHRcdFx0bGV0IGhhc0dyb3VwQ2F0ZWdvcnkgPSBmYWxzZTtcblx0XHRcdFx0Zm9yIChjb25zdCBhY3Rpb24gb2YgYWN0aW9uR3JvdXBbMV0pIHtcblx0XHRcdFx0XHRpZiAoYWN0aW9uIGluc3RhbmNlb2YgTWVudUl0ZW1BY3Rpb24pIHtcblx0XHRcdFx0XHRcdGlmICghaGFzR3JvdXBDYXRlZ29yeSkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBjYXRlZ29yeSA9IGdldENhdGVnb3J5TGFiZWwoYWN0aW9uKTtcblx0XHRcdFx0XHRcdFx0aWYgKGNhdGVnb3J5ICE9PSBsYXN0Q2F0ZWdvcnlOYW1lKSB7XG5cdFx0XHRcdFx0XHRcdFx0aXRlbXMucHVzaCh7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogY2F0ZWdvcnkgfSk7XG5cdFx0XHRcdFx0XHRcdFx0bGFzdENhdGVnb3J5TmFtZSA9IGNhdGVnb3J5O1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGhhc0dyb3VwQ2F0ZWdvcnkgPSB0cnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Y29uc3QgbGFiZWwgPSB0eXBlb2YgYWN0aW9uLml0ZW0udGl0bGUgPT09ICdzdHJpbmcnID8gYWN0aW9uLml0ZW0udGl0bGUgOiBhY3Rpb24uaXRlbS50aXRsZS52YWx1ZTtcblx0XHRcdFx0XHRcdGl0ZW1zLnB1c2goe1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnaXRlbScsXG5cdFx0XHRcdFx0XHRcdGlkOiBhY3Rpb24uaXRlbS5pZCxcblx0XHRcdFx0XHRcdFx0bGFiZWxcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzaG93RXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignd29ya2JlbmNoLnJlbW90ZUluZGljYXRvci5zaG93RXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zJyk7XG5cdFx0XHRpZiAoc2hvd0V4dGVuc2lvblJlY29tbWVuZGF0aW9ucyAmJiB0aGlzLmV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLmlzRW5hYmxlZCgpICYmIHRoaXMucmVtb3RlTWV0YWRhdGFJbml0aWFsaXplZCkge1xuXG5cdFx0XHRcdGNvbnN0IG5vdEluc3RhbGxlZEl0ZW1zOiBRdWlja1BpY2tJdGVtW10gPSBbXTtcblx0XHRcdFx0Zm9yIChjb25zdCBtZXRhZGF0YSBvZiB0aGlzLnJlbW90ZUV4dGVuc2lvbk1ldGFkYXRhKSB7XG5cdFx0XHRcdFx0aWYgKCFtZXRhZGF0YS5pbnN0YWxsZWQgJiYgbWV0YWRhdGEuaXNQbGF0Zm9ybUNvbXBhdGlibGUpIHtcblx0XHRcdFx0XHRcdC8vIENyZWF0ZSBJbnN0YWxsIFF1aWNrUGljayB3aXRoIGEgaGVscCBsaW5rXG5cdFx0XHRcdFx0XHRjb25zdCBsYWJlbCA9IG1ldGFkYXRhLnN0YXJ0Q29ubmVjdExhYmVsO1xuXHRcdFx0XHRcdFx0Y29uc3QgYnV0dG9uczogSVF1aWNrSW5wdXRCdXR0b25bXSA9IFt7XG5cdFx0XHRcdFx0XHRcdGljb25DbGFzczogVGhlbWVJY29uLmFzQ2xhc3NOYW1lKGluZm9JY29uKSxcblx0XHRcdFx0XHRcdFx0dG9vbHRpcDogbmxzLmxvY2FsaXplKCdyZW1vdGUuc3RhcnRBY3Rpb25zLmhlbHAnLCBcIkxlYXJuIE1vcmVcIilcblx0XHRcdFx0XHRcdH1dO1xuXHRcdFx0XHRcdFx0bm90SW5zdGFsbGVkSXRlbXMucHVzaCh7IHR5cGU6ICdpdGVtJywgaWQ6IG1ldGFkYXRhLmlkLCBsYWJlbDogbGFiZWwsIGJ1dHRvbnM6IGJ1dHRvbnMgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aXRlbXMucHVzaCh7XG5cdFx0XHRcdFx0dHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiBubHMubG9jYWxpemUoJ3JlbW90ZS5zdGFydEFjdGlvbnMuaW5zdGFsbCcsICdJbnN0YWxsJylcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGl0ZW1zLnB1c2goLi4ubm90SW5zdGFsbGVkSXRlbXMpO1xuXHRcdFx0fVxuXG5cdFx0XHRpdGVtcy5wdXNoKHtcblx0XHRcdFx0dHlwZTogJ3NlcGFyYXRvcidcblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBlbnRyaWVzQmVmb3JlQ29uZmlnID0gaXRlbXMubGVuZ3RoO1xuXG5cdFx0XHRpZiAoUmVtb3RlU3RhdHVzSW5kaWNhdG9yLlNIT1dfQ0xPU0VfUkVNT1RFX0NPTU1BTkRfSUQpIHtcblx0XHRcdFx0aWYgKHRoaXMucmVtb3RlQXV0aG9yaXR5KSB7XG5cdFx0XHRcdFx0aXRlbXMucHVzaCh7XG5cdFx0XHRcdFx0XHR0eXBlOiAnaXRlbScsXG5cdFx0XHRcdFx0XHRpZDogUmVtb3RlU3RhdHVzSW5kaWNhdG9yLkNMT1NFX1JFTU9URV9DT01NQU5EX0lELFxuXHRcdFx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnY2xvc2VSZW1vdGVDb25uZWN0aW9uLnRpdGxlJywgJ0Nsb3NlIFJlbW90ZSBDb25uZWN0aW9uJylcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGlmICh0aGlzLmNvbm5lY3Rpb25TdGF0ZSA9PT0gJ2Rpc2Nvbm5lY3RlZCcpIHtcblx0XHRcdFx0XHRcdGl0ZW1zLnB1c2goe1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnaXRlbScsXG5cdFx0XHRcdFx0XHRcdGlkOiBSZWxvYWRXaW5kb3dBY3Rpb24uSUQsXG5cdFx0XHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ3JlbG9hZFdpbmRvdycsICdSZWxvYWQgV2luZG93Jylcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmICh0aGlzLnZpcnR1YWxXb3Jrc3BhY2VMb2NhdGlvbikge1xuXHRcdFx0XHRcdGl0ZW1zLnB1c2goe1xuXHRcdFx0XHRcdFx0dHlwZTogJ2l0ZW0nLFxuXHRcdFx0XHRcdFx0aWQ6IFJlbW90ZVN0YXR1c0luZGljYXRvci5DTE9TRV9SRU1PVEVfQ09NTUFORF9JRCxcblx0XHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ2Nsb3NlVmlydHVhbFdvcmtzcGFjZS50aXRsZScsICdDbG9zZSBSZW1vdGUgV29ya3NwYWNlJylcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaXRlbXMubGVuZ3RoID09PSBlbnRyaWVzQmVmb3JlQ29uZmlnKSB7XG5cdFx0XHRcdGl0ZW1zLnBvcCgpOyAvLyByZW1vdmUgdGhlIHNlcGFyYXRvciBhZ2FpblxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gaXRlbXM7XG5cdFx0fTtcblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHF1aWNrUGljayA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZVF1aWNrUGljayh7IHVzZVNlcGFyYXRvcnM6IHRydWUgfSkpO1xuXHRcdHF1aWNrUGljay5wbGFjZWhvbGRlciA9IG5scy5sb2NhbGl6ZSgncmVtb3RlQWN0aW9ucycsIFwiU2VsZWN0IGFuIG9wdGlvbiB0byBvcGVuIGEgUmVtb3RlIFdpbmRvd1wiKTtcblx0XHRxdWlja1BpY2suaXRlbXMgPSBjb21wdXRlSXRlbXMoKTtcblx0XHRxdWlja1BpY2suc29ydEJ5TGFiZWwgPSBmYWxzZTtcblx0XHRxdWlja1BpY2suY2FuU2VsZWN0TWFueSA9IGZhbHNlO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChFdmVudC5vbmNlKHF1aWNrUGljay5vbkRpZEFjY2VwdCkoKGFzeW5jIF8gPT4ge1xuXHRcdFx0Y29uc3Qgc2VsZWN0ZWRJdGVtcyA9IHF1aWNrUGljay5zZWxlY3RlZEl0ZW1zO1xuXHRcdFx0aWYgKHNlbGVjdGVkSXRlbXMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdGNvbnN0IGNvbW1hbmRJZCA9IHNlbGVjdGVkSXRlbXNbMF0uaWQhO1xuXHRcdFx0XHRjb25zdCByZW1vdGVFeHRlbnNpb24gPSB0aGlzLnJlbW90ZUV4dGVuc2lvbk1ldGFkYXRhLmZpbmQodmFsdWUgPT4gRXh0ZW5zaW9uSWRlbnRpZmllci5lcXVhbHModmFsdWUuaWQsIGNvbW1hbmRJZCkpO1xuXHRcdFx0XHRpZiAocmVtb3RlRXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0cXVpY2tQaWNrLml0ZW1zID0gW107XG5cdFx0XHRcdFx0cXVpY2tQaWNrLmJ1c3kgPSB0cnVlO1xuXHRcdFx0XHRcdHF1aWNrUGljay5wbGFjZWhvbGRlciA9IG5scy5sb2NhbGl6ZSgncmVtb3RlLnN0YXJ0QWN0aW9ucy5pbnN0YWxsaW5nRXh0ZW5zaW9uJywgJ0luc3RhbGxpbmcgZXh0ZW5zaW9uLi4uICcpO1xuXG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuaW5zdGFsbEV4dGVuc2lvbihyZW1vdGVFeHRlbnNpb24uaWQsIHNlbGVjdGVkSXRlbXNbMF0ubGFiZWwpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHRcdHF1aWNrUGljay5oaWRlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGF3YWl0IHRoaXMucnVuUmVtb3RlU3RhcnRDb21tYW5kKHJlbW90ZUV4dGVuc2lvbi5pZCwgcmVtb3RlRXh0ZW5zaW9uLnN0YXJ0Q29tbWFuZCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8V29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRFdmVudCwgV29ya2JlbmNoQWN0aW9uRXhlY3V0ZWRDbGFzc2lmaWNhdGlvbj4oJ3dvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkJywge1xuXHRcdFx0XHRcdFx0aWQ6IGNvbW1hbmRJZCxcblx0XHRcdFx0XHRcdGZyb206ICdyZW1vdGUgaW5kaWNhdG9yJ1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoY29tbWFuZElkKTtcblx0XHRcdFx0XHRxdWlja1BpY2suaGlkZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChFdmVudC5vbmNlKHF1aWNrUGljay5vbkRpZFRyaWdnZXJJdGVtQnV0dG9uKShhc3luYyAoZSkgPT4ge1xuXHRcdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9uID0gdGhpcy5yZW1vdGVFeHRlbnNpb25NZXRhZGF0YS5maW5kKHZhbHVlID0+IEV4dGVuc2lvbklkZW50aWZpZXIuZXF1YWxzKHZhbHVlLmlkLCBlLml0ZW0uaWQpKTtcblx0XHRcdGlmIChyZW1vdGVFeHRlbnNpb24pIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4oVVJJLnBhcnNlKHJlbW90ZUV4dGVuc2lvbi5oZWxwTGluaykpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIHJlZnJlc2ggdGhlIGl0ZW1zIHdoZW4gYWN0aW9ucyBjaGFuZ2Vcblx0XHRkaXNwb3NhYmxlcy5hZGQodGhpcy5sZWdhY3lJbmRpY2F0b3JNZW51Lm9uRGlkQ2hhbmdlKCgpID0+IHF1aWNrUGljay5pdGVtcyA9IGNvbXB1dGVJdGVtcygpKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRoaXMucmVtb3RlSW5kaWNhdG9yTWVudS5vbkRpZENoYW5nZSgoKSA9PiBxdWlja1BpY2suaXRlbXMgPSBjb21wdXRlSXRlbXMoKSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljay5vbkRpZEhpZGUoKCkgPT4gZGlzcG9zYWJsZXMuZGlzcG9zZSgpKSk7XG5cblx0XHRpZiAoIXRoaXMucmVtb3RlTWV0YWRhdGFJbml0aWFsaXplZCkge1xuXHRcdFx0cXVpY2tQaWNrLmJ1c3kgPSB0cnVlO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5vbkRpZENoYW5nZUVudHJpZXMoKCkgPT4ge1xuXHRcdFx0XHQvLyBJZiBxdWljayBwaWNrIGlzIG9wZW4sIHVwZGF0ZSB0aGUgcXVpY2sgcGljayBpdGVtcyBhZnRlciBpbml0aWFsaXphdGlvbi5cblx0XHRcdFx0cXVpY2tQaWNrLmJ1c3kgPSBmYWxzZTtcblx0XHRcdFx0cXVpY2tQaWNrLml0ZW1zID0gY29tcHV0ZUl0ZW1zKCk7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXG5cdFx0cXVpY2tQaWNrLnNob3coKTtcblx0fVxufVxuXG5SZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihDb25maWd1cmF0aW9uRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKVxuXHQucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0XHQuLi53b3JrYmVuY2hDb25maWd1cmF0aW9uTm9kZUJhc2UsXG5cdFx0cHJvcGVydGllczoge1xuXHRcdFx0J3dvcmtiZW5jaC5yZW1vdGVJbmRpY2F0b3Iuc2hvd0V4dGVuc2lvblJlY29tbWVuZGF0aW9ucyc6IHtcblx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3JlbW90ZS5zaG93RXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zJywgXCJXaGVuIGVuYWJsZWQsIHJlbW90ZSBleHRlbnNpb25zIHJlY29tbWVuZGF0aW9ucyB3aWxsIGJlIHNob3duIGluIHRoZSBSZW1vdGUgSW5kaWNhdG9yIG1lbnUuXCIpLFxuXHRcdFx0XHRkZWZhdWx0OiB0cnVlXG5cdFx0XHR9LFxuXHRcdH1cblx0fSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLHFCQUFxQix1Q0FBdUM7QUFDckUsU0FBUyxrQkFBa0IsYUFBYTtBQUN4QyxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLFlBQVksdUJBQXVCO0FBQzVDLFNBQVMsUUFBUSxjQUFjLGdCQUFnQixjQUFjLGlCQUFpQixlQUF5QztBQUV2SCxTQUFTLG9CQUFvQix5QkFBbUU7QUFDaEcsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxnQkFBNkIsb0JBQW9CLHFCQUFxQjtBQUMvRSxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBd0IsMEJBQTZDO0FBQ3JFLFNBQVMsMkNBQTJDO0FBQ3BELFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsdUNBQXVDO0FBQ2hELFNBQVMsb0JBQW9CO0FBQzdCLFNBQXVCLGtCQUFrQixPQUFPLGdCQUFnQjtBQUNoRSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLG1DQUFtQztBQUM1QyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDRDQUE0QywwQkFBMEIsbUNBQW1DO0FBQ2xILFNBQVMsNkJBQTZCLHdEQUF3RDtBQUU5RixTQUEwQixzQkFBc0I7QUFDaEQsU0FBUyxtQkFBbUIsK0JBQStCO0FBQzNELFNBQVMseUJBQXlCO0FBRWxDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsU0FBUyxjQUFjO0FBQ2hDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsMkJB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
