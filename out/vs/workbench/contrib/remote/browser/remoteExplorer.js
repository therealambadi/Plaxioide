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
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { Extensions, ViewContainerLocation } from "../../../common/views.js";
import { IRemoteExplorerService, PORT_AUTO_FALLBACK_SETTING, PORT_AUTO_FORWARD_SETTING, PORT_AUTO_SOURCE_SETTING, PORT_AUTO_SOURCE_SETTING_HYBRID, PORT_AUTO_SOURCE_SETTING_OUTPUT, PORT_AUTO_SOURCE_SETTING_PROCESS, PortsEnablement, TUNNEL_VIEW_CONTAINER_ID, TUNNEL_VIEW_ID } from "../../../services/remote/common/remoteExplorerService.js";
import { AutoTunnelSource, forwardedPortsFeaturesEnabled, forwardedPortsViewEnabled, makeAddress, mapHasAddressLocalhostOrAllInterfaces, OnPortForward, TunnelCloseReason, TunnelSource } from "../../../services/remote/common/tunnelModel.js";
import { ForwardPortAction, OpenPortInBrowserAction, TunnelPanel, TunnelPanelDescriptor, TunnelViewModel, OpenPortInPreviewAction, openPreviewEnabledContext } from "./tunnelView.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IStatusbarService, StatusbarAlignment } from "../../../services/statusbar/browser/statusbar.js";
import { UrlFinder } from "./urlFinder.js";
import Severity from "../../../../base/common/severity.js";
import { ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { ITerminalService } from "../../terminal/browser/terminal.js";
import { IDebugService } from "../../debug/common/debug.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { isWeb, OperatingSystem } from "../../../../base/common/platform.js";
import { ITunnelService, TunnelPrivacyId } from "../../../../platform/tunnel/common/tunnel.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { ViewPaneContainer } from "../../../browser/parts/views/viewPaneContainer.js";
import { IActivityService, NumberBadge } from "../../../services/activity/common/activity.js";
import { portsViewIcon } from "./remoteIcons.js";
import { Event } from "../../../../base/common/event.js";
import { IExternalUriOpenerService } from "../../externalUriOpener/common/externalUriOpenerService.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IWorkbenchConfigurationService } from "../../../services/configuration/common/configuration.js";
import { Action } from "../../../../base/common/actions.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
const VIEWLET_ID = "workbench.view.remote";
let ForwardedPortsView = class extends Disposable {
  constructor(contextKeyService, environmentService, remoteExplorerService, tunnelService, activityService, statusbarService) {
    super();
    this.contextKeyService = contextKeyService;
    this.environmentService = environmentService;
    this.remoteExplorerService = remoteExplorerService;
    this.tunnelService = tunnelService;
    this.activityService = activityService;
    this.statusbarService = statusbarService;
    this.contextKeyListener = this._register(new MutableDisposable());
    this.activityBadge = this._register(new MutableDisposable());
    this.hasPortsInSession = false;
    this._register(Registry.as(Extensions.ViewsRegistry).registerViewWelcomeContent(TUNNEL_VIEW_ID, {
      content: this.environmentService.remoteAuthority ? nls.localize("remoteNoPorts", "No forwarded ports. Forward a port to access your running services locally.\n[Forward a Port]({0})", `command:${ForwardPortAction.INLINE_ID}`) : nls.localize("noRemoteNoPorts", "No forwarded ports. Forward a port to access your locally running services over the internet.\n[Forward a Port]({0})", `command:${ForwardPortAction.INLINE_ID}`)
    }));
    this.enableBadgeAndStatusBar();
    this.enableForwardedPortsFeatures();
    if (!this.environmentService.remoteAuthority) {
      this._register(Event.once(this.tunnelService.onTunnelOpened)(() => {
        this.hasPortsInSession = true;
      }));
    }
  }
  async getViewContainer() {
    return Registry.as(Extensions.ViewContainersRegistry).registerViewContainer({
      id: TUNNEL_VIEW_CONTAINER_ID,
      title: nls.localize2("ports", "Ports"),
      icon: portsViewIcon,
      ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [TUNNEL_VIEW_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
      storageId: TUNNEL_VIEW_CONTAINER_ID,
      hideIfEmpty: true,
      order: 5
    }, ViewContainerLocation.Panel);
  }
  async enableForwardedPortsFeatures() {
    this.contextKeyListener.clear();
    const featuresEnabled = !!forwardedPortsFeaturesEnabled.getValue(this.contextKeyService);
    const viewEnabled = !!forwardedPortsViewEnabled.getValue(this.contextKeyService);
    if (featuresEnabled || viewEnabled) {
      if (!viewEnabled) {
        this.contextKeyService.createKey(forwardedPortsViewEnabled.key, true);
      }
      const viewContainer = await this.getViewContainer();
      const tunnelPanelDescriptor = new TunnelPanelDescriptor(new TunnelViewModel(this.remoteExplorerService, this.tunnelService), this.environmentService);
      const viewsRegistry = Registry.as(Extensions.ViewsRegistry);
      if (viewContainer) {
        this.remoteExplorerService.enablePortsFeatures(!featuresEnabled);
        viewsRegistry.registerViews([tunnelPanelDescriptor], viewContainer);
      }
    } else {
      this.contextKeyListener.value = this.contextKeyService.onDidChangeContext((e) => {
        if (e.affectsSome(/* @__PURE__ */ new Set([...forwardedPortsFeaturesEnabled.keys(), ...forwardedPortsViewEnabled.keys()]))) {
          this.enableForwardedPortsFeatures();
        }
      });
    }
  }
  enableBadgeAndStatusBar() {
    const disposable = Registry.as(Extensions.ViewsRegistry).onViewsRegistered((e) => {
      if (e.find((view) => view.views.find((viewDescriptor) => viewDescriptor.id === TUNNEL_VIEW_ID))) {
        this._register(Event.debounce(this.remoteExplorerService.tunnelModel.onForwardPort, (_last, e2) => e2, 50)(() => {
          this.updateActivityBadge();
          this.updateStatusBar();
        }));
        this._register(Event.debounce(this.remoteExplorerService.tunnelModel.onClosePort, (_last, e2) => e2, 50)(() => {
          this.updateActivityBadge();
          this.updateStatusBar();
        }));
        this.updateActivityBadge();
        this.updateStatusBar();
        disposable.dispose();
      }
    });
  }
  async updateActivityBadge() {
    if (this.remoteExplorerService.tunnelModel.forwarded.size > 0) {
      this.activityBadge.value = this.activityService.showViewActivity(TUNNEL_VIEW_ID, {
        badge: new NumberBadge(this.remoteExplorerService.tunnelModel.forwarded.size, (n) => n === 1 ? nls.localize("1forwardedPort", "1 forwarded port") : nls.localize("nForwardedPorts", "{0} forwarded ports", n))
      });
    } else {
      this.activityBadge.clear();
    }
  }
  updateStatusBar() {
    if (!this.environmentService.remoteAuthority && !this.hasPortsInSession) {
      return;
    }
    if (!this.entryAccessor) {
      this._register(this.entryAccessor = this.statusbarService.addEntry(this.entry, "status.forwardedPorts", StatusbarAlignment.LEFT, 40));
    } else {
      this.entryAccessor.update(this.entry);
    }
  }
  get entry() {
    let tooltip;
    const count = this.remoteExplorerService.tunnelModel.forwarded.size + this.remoteExplorerService.tunnelModel.detected.size;
    const text = `${count}`;
    if (count === 0) {
      tooltip = nls.localize("remote.forwardedPorts.statusbarTextNone", "No Ports Forwarded");
    } else {
      const allTunnels = Array.from(this.remoteExplorerService.tunnelModel.forwarded.values());
      allTunnels.push(...Array.from(this.remoteExplorerService.tunnelModel.detected.values()));
      tooltip = nls.localize(
        "remote.forwardedPorts.statusbarTooltip",
        "Forwarded Ports: {0}",
        allTunnels.map((forwarded) => forwarded.remotePort).join(", ")
      );
    }
    return {
      name: nls.localize("status.forwardedPorts", "Forwarded Ports"),
      text: `$(radio-tower) ${text}`,
      ariaLabel: tooltip,
      tooltip,
      command: `${TUNNEL_VIEW_ID}.focus`
    };
  }
};
ForwardedPortsView = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IWorkbenchEnvironmentService),
  __decorateParam(2, IRemoteExplorerService),
  __decorateParam(3, ITunnelService),
  __decorateParam(4, IActivityService),
  __decorateParam(5, IStatusbarService)
], ForwardedPortsView);
let PortRestore = class {
  constructor(remoteExplorerService, logService) {
    this.remoteExplorerService = remoteExplorerService;
    this.logService = logService;
    if (!this.remoteExplorerService.tunnelModel.environmentTunnelsSet) {
      Event.once(this.remoteExplorerService.tunnelModel.onEnvironmentTunnelsSet)(async () => {
        await this.restore();
      });
    } else {
      this.restore();
    }
  }
  async restore() {
    this.logService.trace("ForwardedPorts: Doing first restore.");
    return this.remoteExplorerService.restore();
  }
};
PortRestore = __decorateClass([
  __decorateParam(0, IRemoteExplorerService),
  __decorateParam(1, ILogService)
], PortRestore);
let AutomaticPortForwarding = class extends Disposable {
  constructor(terminalService, notificationService, openerService, externalOpenerService, remoteExplorerService, environmentService, contextKeyService, configurationService, debugService, remoteAgentService, tunnelService, hostService, logService, storageService, preferencesService) {
    super();
    this.terminalService = terminalService;
    this.notificationService = notificationService;
    this.openerService = openerService;
    this.externalOpenerService = externalOpenerService;
    this.remoteExplorerService = remoteExplorerService;
    this.contextKeyService = contextKeyService;
    this.configurationService = configurationService;
    this.debugService = debugService;
    this.tunnelService = tunnelService;
    this.hostService = hostService;
    this.logService = logService;
    this.storageService = storageService;
    this.preferencesService = preferencesService;
    if (!environmentService.remoteAuthority) {
      return;
    }
    configurationService.whenRemoteConfigurationLoaded().then(() => remoteAgentService.getEnvironment()).then((environment) => {
      this.setup(environment);
      this._register(configurationService.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration(PORT_AUTO_SOURCE_SETTING)) {
          this.setup(environment);
        } else if (e.affectsConfiguration(PORT_AUTO_FALLBACK_SETTING) && !this.portListener) {
          this.listenForPorts();
        }
      }));
    });
    if (!this.storageService.getBoolean("processPortForwardingFallback", StorageScope.WORKSPACE, true)) {
      this.configurationService.updateValue(PORT_AUTO_FALLBACK_SETTING, 0, ConfigurationTarget.WORKSPACE);
    }
  }
  getPortAutoFallbackNumber() {
    const fallbackAt = this.configurationService.inspect(PORT_AUTO_FALLBACK_SETTING);
    if (fallbackAt.value !== void 0 && (fallbackAt.value === 0 || fallbackAt.value !== fallbackAt.defaultValue)) {
      return fallbackAt.value;
    }
    const inspectSource = this.configurationService.inspect(PORT_AUTO_SOURCE_SETTING);
    if (inspectSource.applicationValue === PORT_AUTO_SOURCE_SETTING_PROCESS || inspectSource.userValue === PORT_AUTO_SOURCE_SETTING_PROCESS || inspectSource.userLocalValue === PORT_AUTO_SOURCE_SETTING_PROCESS || inspectSource.userRemoteValue === PORT_AUTO_SOURCE_SETTING_PROCESS || inspectSource.workspaceFolderValue === PORT_AUTO_SOURCE_SETTING_PROCESS || inspectSource.workspaceValue === PORT_AUTO_SOURCE_SETTING_PROCESS) {
      return 0;
    }
    return fallbackAt.value ?? 20;
  }
  listenForPorts() {
    let fallbackAt = this.getPortAutoFallbackNumber();
    if (fallbackAt === 0) {
      this.portListener?.dispose();
      return;
    }
    if (this.procForwarder && !this.portListener && this.configurationService.getValue(PORT_AUTO_SOURCE_SETTING) === PORT_AUTO_SOURCE_SETTING_PROCESS) {
      this.portListener = this._register(this.remoteExplorerService.tunnelModel.onForwardPort(async () => {
        fallbackAt = this.getPortAutoFallbackNumber();
        if (fallbackAt === 0) {
          this.portListener?.dispose();
          return;
        }
        if (Array.from(this.remoteExplorerService.tunnelModel.forwarded.values()).filter((tunnel) => tunnel.source.source === TunnelSource.Auto).length > fallbackAt) {
          await this.configurationService.updateValue(PORT_AUTO_SOURCE_SETTING, PORT_AUTO_SOURCE_SETTING_HYBRID);
          this.notificationService.notify({
            message: nls.localize("remote.autoForwardPortsSource.fallback", "Over 20 ports have been automatically forwarded. The `process` based automatic port forwarding has been switched to `hybrid` in settings. Some ports may no longer be detected."),
            severity: Severity.Warning,
            actions: {
              primary: [
                new Action("switchBack", nls.localize("remote.autoForwardPortsSource.fallback.switchBack", "Undo"), void 0, true, async () => {
                  await this.configurationService.updateValue(PORT_AUTO_SOURCE_SETTING, PORT_AUTO_SOURCE_SETTING_PROCESS);
                  await this.configurationService.updateValue(PORT_AUTO_FALLBACK_SETTING, 0, ConfigurationTarget.WORKSPACE);
                  this.portListener?.dispose();
                  this.portListener = void 0;
                }),
                new Action("showPortSourceSetting", nls.localize("remote.autoForwardPortsSource.fallback.showPortSourceSetting", "Show Setting"), void 0, true, async () => {
                  await this.preferencesService.openSettings({
                    query: "remote.autoForwardPortsSource"
                  });
                })
              ]
            }
          });
        }
      }));
    } else {
      this.portListener?.dispose();
      this.portListener = void 0;
    }
  }
  setup(environment) {
    const alreadyForwarded = this.procForwarder?.forwarded;
    const isSwitch = this.outputForwarder || this.procForwarder;
    this.procForwarder?.dispose();
    this.procForwarder = void 0;
    this.outputForwarder?.dispose();
    this.outputForwarder = void 0;
    if (environment?.os !== OperatingSystem.Linux) {
      if (this.configurationService.inspect(PORT_AUTO_SOURCE_SETTING).default?.value !== PORT_AUTO_SOURCE_SETTING_OUTPUT) {
        Registry.as(ConfigurationExtensions.Configuration).registerDefaultConfigurations([{ overrides: { "remote.autoForwardPortsSource": PORT_AUTO_SOURCE_SETTING_OUTPUT } }]);
      }
      this.outputForwarder = this._register(new OutputAutomaticPortForwarding(
        this.terminalService,
        this.notificationService,
        this.openerService,
        this.externalOpenerService,
        this.remoteExplorerService,
        this.configurationService,
        this.debugService,
        this.tunnelService,
        this.hostService,
        this.logService,
        this.contextKeyService,
        () => false
      ));
    } else {
      const useProc = () => this.configurationService.getValue(PORT_AUTO_SOURCE_SETTING) === PORT_AUTO_SOURCE_SETTING_PROCESS;
      if (useProc()) {
        this.procForwarder = this._register(new ProcAutomaticPortForwarding(
          false,
          alreadyForwarded,
          !isSwitch,
          this.configurationService,
          this.remoteExplorerService,
          this.notificationService,
          this.openerService,
          this.externalOpenerService,
          this.tunnelService,
          this.hostService,
          this.logService,
          this.contextKeyService
        ));
      } else if (this.configurationService.getValue(PORT_AUTO_SOURCE_SETTING) === PORT_AUTO_SOURCE_SETTING_HYBRID) {
        this.procForwarder = this._register(new ProcAutomaticPortForwarding(
          true,
          alreadyForwarded,
          !isSwitch,
          this.configurationService,
          this.remoteExplorerService,
          this.notificationService,
          this.openerService,
          this.externalOpenerService,
          this.tunnelService,
          this.hostService,
          this.logService,
          this.contextKeyService
        ));
      }
      this.outputForwarder = this._register(new OutputAutomaticPortForwarding(
        this.terminalService,
        this.notificationService,
        this.openerService,
        this.externalOpenerService,
        this.remoteExplorerService,
        this.configurationService,
        this.debugService,
        this.tunnelService,
        this.hostService,
        this.logService,
        this.contextKeyService,
        useProc
      ));
    }
    this.listenForPorts();
  }
};
AutomaticPortForwarding = __decorateClass([
  __decorateParam(0, ITerminalService),
  __decorateParam(1, INotificationService),
  __decorateParam(2, IOpenerService),
  __decorateParam(3, IExternalUriOpenerService),
  __decorateParam(4, IRemoteExplorerService),
  __decorateParam(5, IWorkbenchEnvironmentService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IWorkbenchConfigurationService),
  __decorateParam(8, IDebugService),
  __decorateParam(9, IRemoteAgentService),
  __decorateParam(10, ITunnelService),
  __decorateParam(11, IHostService),
  __decorateParam(12, ILogService),
  __decorateParam(13, IStorageService),
  __decorateParam(14, IPreferencesService)
], AutomaticPortForwarding);
const _OnAutoForwardedAction = class _OnAutoForwardedAction extends Disposable {
  constructor(notificationService, remoteExplorerService, openerService, externalOpenerService, tunnelService, hostService, logService, contextKeyService) {
    super();
    this.notificationService = notificationService;
    this.remoteExplorerService = remoteExplorerService;
    this.openerService = openerService;
    this.externalOpenerService = externalOpenerService;
    this.tunnelService = tunnelService;
    this.hostService = hostService;
    this.logService = logService;
    this.contextKeyService = contextKeyService;
    this.alreadyOpenedOnce = /* @__PURE__ */ new Set();
    this.lastNotifyTime = /* @__PURE__ */ new Date();
    this.lastNotifyTime.setFullYear(this.lastNotifyTime.getFullYear() - 1);
  }
  async doAction(tunnels) {
    this.logService.trace(`ForwardedPorts: (OnAutoForwardedAction) Starting action for ${tunnels[0]?.tunnelRemotePort}`);
    this.doActionTunnels = tunnels;
    const tunnel = await this.portNumberHeuristicDelay();
    this.logService.trace(`ForwardedPorts: (OnAutoForwardedAction) Heuristic chose ${tunnel?.tunnelRemotePort}`);
    if (tunnel) {
      const allAttributes = await this.remoteExplorerService.tunnelModel.getAttributes([{ port: tunnel.tunnelRemotePort, host: tunnel.tunnelRemoteHost }]);
      const attributes = allAttributes?.get(tunnel.tunnelRemotePort)?.onAutoForward;
      this.logService.trace(`ForwardedPorts: (OnAutoForwardedAction) onAutoForward action is ${attributes}`);
      switch (attributes) {
        case OnPortForward.OpenBrowserOnce: {
          if (this.alreadyOpenedOnce.has(tunnel.localAddress)) {
            break;
          }
          this.alreadyOpenedOnce.add(tunnel.localAddress);
        }
        case OnPortForward.OpenBrowser: {
          const address = makeAddress(tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort);
          await OpenPortInBrowserAction.run(this.remoteExplorerService.tunnelModel, this.openerService, address);
          break;
        }
        case OnPortForward.OpenPreview: {
          const address = makeAddress(tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort);
          await OpenPortInPreviewAction.run(this.remoteExplorerService.tunnelModel, this.openerService, this.externalOpenerService, address);
          break;
        }
        case OnPortForward.Silent:
          break;
        default: {
          const elapsed = (/* @__PURE__ */ new Date()).getTime() - this.lastNotifyTime.getTime();
          this.logService.trace(`ForwardedPorts: (OnAutoForwardedAction) time elapsed since last notification ${elapsed} ms`);
          if (elapsed > _OnAutoForwardedAction.NOTIFY_COOL_DOWN) {
            await this.showNotification(tunnel);
          }
        }
      }
    }
  }
  hide(removedPorts) {
    if (this.doActionTunnels) {
      this.doActionTunnels = this.doActionTunnels.filter((value) => !removedPorts.includes(value.tunnelRemotePort));
    }
    if (this.lastShownPort && removedPorts.indexOf(this.lastShownPort) >= 0) {
      this.lastNotification?.close();
    }
  }
  async portNumberHeuristicDelay() {
    this.logService.trace(`ForwardedPorts: (OnAutoForwardedAction) Starting heuristic delay`);
    if (!this.doActionTunnels || this.doActionTunnels.length === 0) {
      return;
    }
    this.doActionTunnels = this.doActionTunnels.sort((a, b) => a.tunnelRemotePort - b.tunnelRemotePort);
    const firstTunnel = this.doActionTunnels.shift();
    if (firstTunnel.tunnelRemotePort % 1e3 === 0) {
      this.logService.trace(`ForwardedPorts: (OnAutoForwardedAction) Heuristic chose tunnel because % 1000: ${firstTunnel.tunnelRemotePort}`);
      this.newerTunnel = firstTunnel;
      return firstTunnel;
    } else if (firstTunnel.tunnelRemotePort < 1e4 && firstTunnel.tunnelRemotePort !== 9229) {
      this.logService.trace(`ForwardedPorts: (OnAutoForwardedAction) Heuristic chose tunnel because < 10000: ${firstTunnel.tunnelRemotePort}`);
      this.newerTunnel = firstTunnel;
      return firstTunnel;
    }
    this.logService.trace(`ForwardedPorts: (OnAutoForwardedAction) Waiting for "better" tunnel than ${firstTunnel.tunnelRemotePort}`);
    this.newerTunnel = void 0;
    return new Promise((resolve) => {
      setTimeout(() => {
        if (this.newerTunnel) {
          resolve(void 0);
        } else if (this.doActionTunnels?.includes(firstTunnel)) {
          resolve(firstTunnel);
        } else {
          resolve(void 0);
        }
      }, 3e3);
    });
  }
  async basicMessage(tunnel) {
    const properties = await this.remoteExplorerService.tunnelModel.getAttributes([{ host: tunnel.tunnelRemoteHost, port: tunnel.tunnelRemotePort }], false);
    const label = properties?.get(tunnel.tunnelRemotePort)?.label;
    return nls.localize(
      "remote.tunnelsView.automaticForward",
      "Your application{0} running on port {1} is available.  ",
      label ? ` (${label})` : "",
      tunnel.tunnelRemotePort
    );
  }
  linkMessage() {
    return nls.localize(
      { key: "remote.tunnelsView.notificationLink2", comment: ["[See all forwarded ports]({0}) is a link. Only translate `See all forwarded ports`. Do not change brackets and parentheses or {0}"] },
      "[See all forwarded ports]({0})",
      `command:${TunnelPanel.ID}.focus`
    );
  }
  async showNotification(tunnel) {
    if (!await this.hostService.hadLastFocus()) {
      return;
    }
    this.lastNotification?.close();
    let message = await this.basicMessage(tunnel);
    const choices = [this.openBrowserChoice(tunnel)];
    if (!isWeb || openPreviewEnabledContext.getValue(this.contextKeyService)) {
      choices.push(this.openPreviewChoice(tunnel));
    }
    if (tunnel.tunnelLocalPort !== tunnel.tunnelRemotePort && this.tunnelService.canElevate && this.tunnelService.isPortPrivileged(tunnel.tunnelRemotePort)) {
      message += nls.localize("remote.tunnelsView.elevationMessage", "You'll need to run as superuser to use port {0} locally.  ", tunnel.tunnelRemotePort);
      choices.unshift(this.elevateChoice(tunnel));
    }
    if (tunnel.privacy === TunnelPrivacyId.Private && isWeb && this.tunnelService.canChangePrivacy) {
      choices.push(this.makePublicChoice(tunnel));
    }
    message += this.linkMessage();
    this.lastNotification = this.notificationService.prompt(Severity.Info, message, choices, { neverShowAgain: { id: "remote.tunnelsView.autoForwardNeverShow", isSecondary: true } });
    this.lastShownPort = tunnel.tunnelRemotePort;
    this.lastNotifyTime = /* @__PURE__ */ new Date();
    this.lastNotification.onDidClose(() => {
      this.lastNotification = void 0;
      this.lastShownPort = void 0;
    });
  }
  makePublicChoice(tunnel) {
    return {
      label: nls.localize("remote.tunnelsView.makePublic", "Make Public"),
      run: async () => {
        const oldTunnelDetails = mapHasAddressLocalhostOrAllInterfaces(this.remoteExplorerService.tunnelModel.forwarded, tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort);
        await this.remoteExplorerService.close({ host: tunnel.tunnelRemoteHost, port: tunnel.tunnelRemotePort }, TunnelCloseReason.Other);
        return this.remoteExplorerService.forward({
          remote: { host: tunnel.tunnelRemoteHost, port: tunnel.tunnelRemotePort },
          local: tunnel.tunnelLocalPort,
          name: oldTunnelDetails?.name,
          elevateIfNeeded: true,
          privacy: TunnelPrivacyId.Public,
          source: oldTunnelDetails?.source
        });
      }
    };
  }
  openBrowserChoice(tunnel) {
    const address = makeAddress(tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort);
    return {
      label: OpenPortInBrowserAction.LABEL,
      run: () => OpenPortInBrowserAction.run(this.remoteExplorerService.tunnelModel, this.openerService, address)
    };
  }
  openPreviewChoice(tunnel) {
    const address = makeAddress(tunnel.tunnelRemoteHost, tunnel.tunnelRemotePort);
    return {
      label: OpenPortInPreviewAction.LABEL,
      run: () => OpenPortInPreviewAction.run(this.remoteExplorerService.tunnelModel, this.openerService, this.externalOpenerService, address)
    };
  }
  elevateChoice(tunnel) {
    return {
      // Privileged ports are not on Windows, so it's ok to stick to just "sudo".
      label: nls.localize("remote.tunnelsView.elevationButton", "Use Port {0} as Sudo...", tunnel.tunnelRemotePort),
      run: async () => {
        await this.remoteExplorerService.close({ host: tunnel.tunnelRemoteHost, port: tunnel.tunnelRemotePort }, TunnelCloseReason.Other);
        const newTunnel = await this.remoteExplorerService.forward({
          remote: { host: tunnel.tunnelRemoteHost, port: tunnel.tunnelRemotePort },
          local: tunnel.tunnelRemotePort,
          elevateIfNeeded: true,
          source: AutoTunnelSource
        });
        if (!newTunnel || typeof newTunnel === "string") {
          return;
        }
        this.lastNotification?.close();
        this.lastShownPort = newTunnel.tunnelRemotePort;
        this.lastNotification = this.notificationService.prompt(
          Severity.Info,
          await this.basicMessage(newTunnel) + this.linkMessage(),
          [this.openBrowserChoice(newTunnel), this.openPreviewChoice(tunnel)],
          { neverShowAgain: { id: "remote.tunnelsView.autoForwardNeverShow", isSecondary: true } }
        );
        this.lastNotification.onDidClose(() => {
          this.lastNotification = void 0;
          this.lastShownPort = void 0;
        });
      }
    };
  }
};
_OnAutoForwardedAction.NOTIFY_COOL_DOWN = 5e3;
let OnAutoForwardedAction = _OnAutoForwardedAction;
class OutputAutomaticPortForwarding extends Disposable {
  constructor(terminalService, notificationService, openerService, externalOpenerService, remoteExplorerService, configurationService, debugService, tunnelService, hostService, logService, contextKeyService, privilegedOnly) {
    super();
    this.terminalService = terminalService;
    this.notificationService = notificationService;
    this.openerService = openerService;
    this.externalOpenerService = externalOpenerService;
    this.remoteExplorerService = remoteExplorerService;
    this.configurationService = configurationService;
    this.debugService = debugService;
    this.tunnelService = tunnelService;
    this.hostService = hostService;
    this.logService = logService;
    this.contextKeyService = contextKeyService;
    this.privilegedOnly = privilegedOnly;
    this.notifier = new OnAutoForwardedAction(notificationService, remoteExplorerService, openerService, externalOpenerService, tunnelService, hostService, logService, contextKeyService);
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(PORT_AUTO_FORWARD_SETTING)) {
        this.tryStartStopUrlFinder();
      }
    }));
    this.portsFeatures = this._register(this.remoteExplorerService.onEnabledPortsFeatures(() => {
      this.tryStartStopUrlFinder();
    }));
    this.tryStartStopUrlFinder();
    if (configurationService.getValue(PORT_AUTO_SOURCE_SETTING) === PORT_AUTO_SOURCE_SETTING_HYBRID) {
      this._register(this.tunnelService.onTunnelClosed((tunnel) => this.notifier.hide([tunnel.port])));
    }
  }
  tryStartStopUrlFinder() {
    if (this.configurationService.getValue(PORT_AUTO_FORWARD_SETTING)) {
      this.startUrlFinder();
    } else {
      this.stopUrlFinder();
    }
  }
  startUrlFinder() {
    if (!this.urlFinder && this.remoteExplorerService.portsFeaturesEnabled !== PortsEnablement.AdditionalFeatures) {
      return;
    }
    this.portsFeatures?.dispose();
    this.urlFinder = this._register(new UrlFinder(this.terminalService, this.debugService));
    this._register(this.urlFinder.onDidMatchLocalUrl(async (localUrl) => {
      if (mapHasAddressLocalhostOrAllInterfaces(this.remoteExplorerService.tunnelModel.detected, localUrl.host, localUrl.port)) {
        return;
      }
      const attributes = (await this.remoteExplorerService.tunnelModel.getAttributes([localUrl]))?.get(localUrl.port);
      if (attributes?.onAutoForward === OnPortForward.Ignore) {
        return;
      }
      if (this.privilegedOnly() && !this.tunnelService.isPortPrivileged(localUrl.port)) {
        return;
      }
      const forwarded = await this.remoteExplorerService.forward({ remote: localUrl, source: AutoTunnelSource }, attributes ?? null);
      if (forwarded && typeof forwarded !== "string") {
        this.notifier.doAction([forwarded]);
      }
    }));
  }
  stopUrlFinder() {
    if (this.urlFinder) {
      this.urlFinder.dispose();
      this.urlFinder = void 0;
    }
  }
}
class ProcAutomaticPortForwarding extends Disposable {
  constructor(unforwardOnly, alreadyAutoForwarded, needsInitialCandidates, configurationService, remoteExplorerService, notificationService, openerService, externalOpenerService, tunnelService, hostService, logService, contextKeyService) {
    super();
    this.unforwardOnly = unforwardOnly;
    this.alreadyAutoForwarded = alreadyAutoForwarded;
    this.needsInitialCandidates = needsInitialCandidates;
    this.configurationService = configurationService;
    this.remoteExplorerService = remoteExplorerService;
    this.notificationService = notificationService;
    this.openerService = openerService;
    this.externalOpenerService = externalOpenerService;
    this.tunnelService = tunnelService;
    this.hostService = hostService;
    this.logService = logService;
    this.contextKeyService = contextKeyService;
    this.autoForwarded = /* @__PURE__ */ new Set();
    this.notifiedOnly = /* @__PURE__ */ new Set();
    this.initialCandidates = /* @__PURE__ */ new Set();
    this.notifier = new OnAutoForwardedAction(notificationService, remoteExplorerService, openerService, externalOpenerService, tunnelService, hostService, logService, contextKeyService);
    alreadyAutoForwarded?.forEach((port) => this.autoForwarded.add(port));
    this.initialize();
  }
  get forwarded() {
    return this.autoForwarded;
  }
  async initialize() {
    if (!this.remoteExplorerService.tunnelModel.environmentTunnelsSet) {
      await new Promise((resolve) => this.remoteExplorerService.tunnelModel.onEnvironmentTunnelsSet(() => resolve()));
    }
    this._register(this.configurationService.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration(PORT_AUTO_FORWARD_SETTING)) {
        await this.startStopCandidateListener();
      }
    }));
    this.portsFeatures = this._register(this.remoteExplorerService.onEnabledPortsFeatures(async () => {
      await this.startStopCandidateListener();
    }));
    this.startStopCandidateListener();
  }
  async startStopCandidateListener() {
    if (this.configurationService.getValue(PORT_AUTO_FORWARD_SETTING)) {
      await this.startCandidateListener();
    } else {
      this.stopCandidateListener();
    }
  }
  stopCandidateListener() {
    if (this.candidateListener) {
      this.candidateListener.dispose();
      this.candidateListener = void 0;
    }
  }
  async startCandidateListener() {
    if (this.candidateListener || this.remoteExplorerService.portsFeaturesEnabled !== PortsEnablement.AdditionalFeatures) {
      return;
    }
    this.portsFeatures?.dispose();
    await this.setInitialCandidates();
    if (this.configurationService.getValue(PORT_AUTO_FORWARD_SETTING)) {
      this.candidateListener = this._register(this.remoteExplorerService.tunnelModel.onCandidatesChanged(this.handleCandidateUpdate, this));
    }
  }
  async setInitialCandidates() {
    if (!this.needsInitialCandidates) {
      this.logService.debug(`ForwardedPorts: (ProcForwarding) Not setting initial candidates`);
      return;
    }
    let startingCandidates = this.remoteExplorerService.tunnelModel.candidatesOrUndefined;
    if (!startingCandidates) {
      await new Promise((resolve) => this.remoteExplorerService.tunnelModel.onCandidatesChanged(() => resolve()));
      startingCandidates = this.remoteExplorerService.tunnelModel.candidates;
    }
    for (const value of startingCandidates) {
      this.initialCandidates.add(makeAddress(value.host, value.port));
    }
    this.logService.debug(`ForwardedPorts: (ProcForwarding) Initial candidates set to ${startingCandidates.map((candidate) => candidate.port).join(", ")}`);
  }
  async forwardCandidates() {
    let attributes;
    const allTunnels = [];
    this.logService.trace(`ForwardedPorts: (ProcForwarding) Attempting to forward ${this.remoteExplorerService.tunnelModel.candidates.length} candidates`);
    for (const value of this.remoteExplorerService.tunnelModel.candidates) {
      if (!value.detail) {
        this.logService.trace(`ForwardedPorts: (ProcForwarding) Port ${value.port} missing detail`);
        continue;
      }
      if (!attributes) {
        attributes = await this.remoteExplorerService.tunnelModel.getAttributes(this.remoteExplorerService.tunnelModel.candidates);
      }
      const portAttributes = attributes?.get(value.port);
      const address = makeAddress(value.host, value.port);
      if (this.initialCandidates.has(address) && portAttributes?.onAutoForward === void 0) {
        continue;
      }
      if (this.notifiedOnly.has(address) || this.autoForwarded.has(address)) {
        continue;
      }
      const alreadyForwarded = mapHasAddressLocalhostOrAllInterfaces(this.remoteExplorerService.tunnelModel.forwarded, value.host, value.port);
      if (mapHasAddressLocalhostOrAllInterfaces(this.remoteExplorerService.tunnelModel.detected, value.host, value.port)) {
        continue;
      }
      if (portAttributes?.onAutoForward === OnPortForward.Ignore) {
        this.logService.trace(`ForwardedPorts: (ProcForwarding) Port ${value.port} is ignored`);
        continue;
      }
      const forwarded = await this.remoteExplorerService.forward({ remote: value, source: AutoTunnelSource }, portAttributes ?? null);
      if (!alreadyForwarded && forwarded) {
        this.logService.trace(`ForwardedPorts: (ProcForwarding) Port ${value.port} has been forwarded`);
        this.autoForwarded.add(address);
      } else if (forwarded) {
        this.logService.trace(`ForwardedPorts: (ProcForwarding) Port ${value.port} has been notified`);
        this.notifiedOnly.add(address);
      }
      if (forwarded && typeof forwarded !== "string") {
        allTunnels.push(forwarded);
      }
    }
    this.logService.trace(`ForwardedPorts: (ProcForwarding) Forwarded ${allTunnels.length} candidates`);
    if (allTunnels.length === 0) {
      return void 0;
    }
    return allTunnels;
  }
  async handleCandidateUpdate(removed) {
    const removedPorts = [];
    let autoForwarded;
    if (this.unforwardOnly) {
      autoForwarded = /* @__PURE__ */ new Map();
      for (const entry of this.remoteExplorerService.tunnelModel.forwarded.entries()) {
        if (entry[1].source.source === TunnelSource.Auto) {
          autoForwarded.set(entry[0], entry[1]);
        }
      }
    } else {
      autoForwarded = new Map(this.autoForwarded.entries());
    }
    for (const removedPort of removed) {
      const key = removedPort[0];
      let value = removedPort[1];
      const forwardedValue = mapHasAddressLocalhostOrAllInterfaces(autoForwarded, value.host, value.port);
      if (forwardedValue) {
        if (typeof forwardedValue === "string") {
          this.autoForwarded.delete(key);
        } else {
          value = { host: forwardedValue.remoteHost, port: forwardedValue.remotePort };
        }
        await this.remoteExplorerService.close(value, TunnelCloseReason.AutoForwardEnd);
        removedPorts.push(value.port);
      } else if (this.notifiedOnly.has(key)) {
        this.notifiedOnly.delete(key);
        removedPorts.push(value.port);
      } else if (this.initialCandidates.has(key)) {
        this.initialCandidates.delete(key);
      }
    }
    if (this.unforwardOnly) {
      return;
    }
    if (removedPorts.length > 0) {
      await this.notifier.hide(removedPorts);
    }
    const tunnels = await this.forwardCandidates();
    if (tunnels) {
      await this.notifier.doAction(tunnels);
    }
  }
}
export {
  AutomaticPortForwarding,
  ForwardedPortsView,
  PortRestore,
  VIEWLET_ID
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9yZW1vdGUvYnJvd3Nlci9yZW1vdGVFeHBsb3Jlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucywgSVZpZXdDb250YWluZXJzUmVnaXN0cnksIElWaWV3c1JlZ2lzdHJ5LCBWaWV3Q29udGFpbmVyLCBWaWV3Q29udGFpbmVyTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUV4cGxvcmVyU2VydmljZSwgUE9SVF9BVVRPX0ZBTExCQUNLX1NFVFRJTkcsIFBPUlRfQVVUT19GT1JXQVJEX1NFVFRJTkcsIFBPUlRfQVVUT19TT1VSQ0VfU0VUVElORywgUE9SVF9BVVRPX1NPVVJDRV9TRVRUSU5HX0hZQlJJRCwgUE9SVF9BVVRPX1NPVVJDRV9TRVRUSU5HX09VVFBVVCwgUE9SVF9BVVRPX1NPVVJDRV9TRVRUSU5HX1BST0NFU1MsIFBvcnRzRW5hYmxlbWVudCwgVFVOTkVMX1ZJRVdfQ09OVEFJTkVSX0lELCBUVU5ORUxfVklFV19JRCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3JlbW90ZS9jb21tb24vcmVtb3RlRXhwbG9yZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEF0dHJpYnV0ZXMsIEF1dG9UdW5uZWxTb3VyY2UsIGZvcndhcmRlZFBvcnRzRmVhdHVyZXNFbmFibGVkLCBmb3J3YXJkZWRQb3J0c1ZpZXdFbmFibGVkLCBtYWtlQWRkcmVzcywgbWFwSGFzQWRkcmVzc0xvY2FsaG9zdE9yQWxsSW50ZXJmYWNlcywgT25Qb3J0Rm9yd2FyZCwgVHVubmVsLCBUdW5uZWxDbG9zZVJlYXNvbiwgVHVubmVsU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi90dW5uZWxNb2RlbC5qcyc7XG5pbXBvcnQgeyBGb3J3YXJkUG9ydEFjdGlvbiwgT3BlblBvcnRJbkJyb3dzZXJBY3Rpb24sIFR1bm5lbFBhbmVsLCBUdW5uZWxQYW5lbERlc2NyaXB0b3IsIFR1bm5lbFZpZXdNb2RlbCwgT3BlblBvcnRJblByZXZpZXdBY3Rpb24sIG9wZW5QcmV2aWV3RW5hYmxlZENvbnRleHQgfSBmcm9tICcuL3R1bm5lbFZpZXcuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJU3RhdHVzYmFyRW50cnksIElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yLCBJU3RhdHVzYmFyU2VydmljZSwgU3RhdHVzYmFyQWxpZ25tZW50IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvc3RhdHVzYmFyL2Jyb3dzZXIvc3RhdHVzYmFyLmpzJztcbmltcG9ydCB7IFVybEZpbmRlciB9IGZyb20gJy4vdXJsRmluZGVyLmpzJztcbmltcG9ydCBTZXZlcml0eSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXZlcml0eS5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uVGFyZ2V0LCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25IYW5kbGUsIElOb3RpZmljYXRpb25TZXJ2aWNlLCBJUHJvbXB0Q2hvaWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBJRGVidWdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZGVidWcvY29tbW9uL2RlYnVnLmpzJztcbmltcG9ydCB7IElSZW1vdGVBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBpc1dlYiwgT3BlcmF0aW5nU3lzdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVR1bm5lbFNlcnZpY2UsIFJlbW90ZVR1bm5lbCwgVHVubmVsUHJpdmFjeUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdHVubmVsL2NvbW1vbi90dW5uZWwuanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBWaWV3UGFuZUNvbnRhaW5lciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmVDb250YWluZXIuanMnO1xuaW1wb3J0IHsgSUFjdGl2aXR5U2VydmljZSwgTnVtYmVyQmFkZ2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9hY3Rpdml0eS9jb21tb24vYWN0aXZpdHkuanMnO1xuaW1wb3J0IHsgcG9ydHNWaWV3SWNvbiB9IGZyb20gJy4vcmVtb3RlSWNvbnMuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJRXh0ZXJuYWxVcmlPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZXh0ZXJuYWxVcmlPcGVuZXIvY29tbW9uL2V4dGVybmFsVXJpT3BlbmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIENvbmZpZ3VyYXRpb25FeHRlbnNpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlQWdlbnRFbnZpcm9ubWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRFbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElQcmVmZXJlbmNlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXMuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcblxuZXhwb3J0IGNvbnN0IFZJRVdMRVRfSUQgPSAnd29ya2JlbmNoLnZpZXcucmVtb3RlJztcblxuZXhwb3J0IGNsYXNzIEZvcndhcmRlZFBvcnRzVmlldyBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblx0cHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5TGlzdGVuZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8SURpc3Bvc2FibGU+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGFjdGl2aXR5QmFkZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8SURpc3Bvc2FibGU+KCkpO1xuXHRwcml2YXRlIGVudHJ5QWNjZXNzb3I6IElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGhhc1BvcnRzSW5TZXNzaW9uOiBib29sZWFuID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElSZW1vdGVFeHBsb3JlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSByZW1vdGVFeHBsb3JlclNlcnZpY2U6IElSZW1vdGVFeHBsb3JlclNlcnZpY2UsXG5cdFx0QElUdW5uZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdHVubmVsU2VydmljZTogSVR1bm5lbFNlcnZpY2UsXG5cdFx0QElBY3Rpdml0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhY3Rpdml0eVNlcnZpY2U6IElBY3Rpdml0eVNlcnZpY2UsXG5cdFx0QElTdGF0dXNiYXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RhdHVzYmFyU2VydmljZTogSVN0YXR1c2JhclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoUmVnaXN0cnkuYXM8SVZpZXdzUmVnaXN0cnk+KEV4dGVuc2lvbnMuVmlld3NSZWdpc3RyeSkucmVnaXN0ZXJWaWV3V2VsY29tZUNvbnRlbnQoVFVOTkVMX1ZJRVdfSUQsIHtcblx0XHRcdGNvbnRlbnQ6IHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSA/IG5scy5sb2NhbGl6ZSgncmVtb3RlTm9Qb3J0cycsIFwiTm8gZm9yd2FyZGVkIHBvcnRzLiBGb3J3YXJkIGEgcG9ydCB0byBhY2Nlc3MgeW91ciBydW5uaW5nIHNlcnZpY2VzIGxvY2FsbHkuXFxuW0ZvcndhcmQgYSBQb3J0XSh7MH0pXCIsIGBjb21tYW5kOiR7Rm9yd2FyZFBvcnRBY3Rpb24uSU5MSU5FX0lEfWApXG5cdFx0XHRcdDogbmxzLmxvY2FsaXplKCdub1JlbW90ZU5vUG9ydHMnLCBcIk5vIGZvcndhcmRlZCBwb3J0cy4gRm9yd2FyZCBhIHBvcnQgdG8gYWNjZXNzIHlvdXIgbG9jYWxseSBydW5uaW5nIHNlcnZpY2VzIG92ZXIgdGhlIGludGVybmV0LlxcbltGb3J3YXJkIGEgUG9ydF0oezB9KVwiLCBgY29tbWFuZDoke0ZvcndhcmRQb3J0QWN0aW9uLklOTElORV9JRH1gKSxcblx0XHR9KSk7XG5cdFx0dGhpcy5lbmFibGVCYWRnZUFuZFN0YXR1c0JhcigpO1xuXHRcdHRoaXMuZW5hYmxlRm9yd2FyZGVkUG9ydHNGZWF0dXJlcygpO1xuXHRcdGlmICghdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5KSB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5vbmNlKHRoaXMudHVubmVsU2VydmljZS5vblR1bm5lbE9wZW5lZCkoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmhhc1BvcnRzSW5TZXNzaW9uID0gdHJ1ZTtcblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldFZpZXdDb250YWluZXIoKTogUHJvbWlzZTxWaWV3Q29udGFpbmVyIHwgbnVsbD4ge1xuXHRcdHJldHVybiBSZWdpc3RyeS5hczxJVmlld0NvbnRhaW5lcnNSZWdpc3RyeT4oRXh0ZW5zaW9ucy5WaWV3Q29udGFpbmVyc1JlZ2lzdHJ5KS5yZWdpc3RlclZpZXdDb250YWluZXIoe1xuXHRcdFx0aWQ6IFRVTk5FTF9WSUVXX0NPTlRBSU5FUl9JRCxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdwb3J0cycsIFwiUG9ydHNcIiksXG5cdFx0XHRpY29uOiBwb3J0c1ZpZXdJY29uLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihWaWV3UGFuZUNvbnRhaW5lciwgW1RVTk5FTF9WSUVXX0NPTlRBSU5FUl9JRCwgeyBtZXJnZVZpZXdXaXRoQ29udGFpbmVyV2hlblNpbmdsZVZpZXc6IHRydWUgfV0pLFxuXHRcdFx0c3RvcmFnZUlkOiBUVU5ORUxfVklFV19DT05UQUlORVJfSUQsXG5cdFx0XHRoaWRlSWZFbXB0eTogdHJ1ZSxcblx0XHRcdG9yZGVyOiA1XG5cdFx0fSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZW5hYmxlRm9yd2FyZGVkUG9ydHNGZWF0dXJlcygpIHtcblx0XHR0aGlzLmNvbnRleHRLZXlMaXN0ZW5lci5jbGVhcigpO1xuXG5cdFx0Y29uc3QgZmVhdHVyZXNFbmFibGVkOiBib29sZWFuID0gISFmb3J3YXJkZWRQb3J0c0ZlYXR1cmVzRW5hYmxlZC5nZXRWYWx1ZSh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRjb25zdCB2aWV3RW5hYmxlZDogYm9vbGVhbiA9ICEhZm9yd2FyZGVkUG9ydHNWaWV3RW5hYmxlZC5nZXRWYWx1ZSh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdGlmIChmZWF0dXJlc0VuYWJsZWQgfHwgdmlld0VuYWJsZWQpIHtcblx0XHRcdC8vIEFsc28gZW5hYmxlIHRoZSB2aWV3IGlmIGl0IGlzbid0IGFscmVhZHkuXG5cdFx0XHRpZiAoIXZpZXdFbmFibGVkKSB7XG5cdFx0XHRcdHRoaXMuY29udGV4dEtleVNlcnZpY2UuY3JlYXRlS2V5KGZvcndhcmRlZFBvcnRzVmlld0VuYWJsZWQua2V5LCB0cnVlKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHZpZXdDb250YWluZXIgPSBhd2FpdCB0aGlzLmdldFZpZXdDb250YWluZXIoKTtcblx0XHRcdGNvbnN0IHR1bm5lbFBhbmVsRGVzY3JpcHRvciA9IG5ldyBUdW5uZWxQYW5lbERlc2NyaXB0b3IobmV3IFR1bm5lbFZpZXdNb2RlbCh0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZSwgdGhpcy50dW5uZWxTZXJ2aWNlKSwgdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UpO1xuXHRcdFx0Y29uc3Qgdmlld3NSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElWaWV3c1JlZ2lzdHJ5PihFeHRlbnNpb25zLlZpZXdzUmVnaXN0cnkpO1xuXHRcdFx0aWYgKHZpZXdDb250YWluZXIpIHtcblx0XHRcdFx0dGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UuZW5hYmxlUG9ydHNGZWF0dXJlcyghZmVhdHVyZXNFbmFibGVkKTtcblx0XHRcdFx0dmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKFt0dW5uZWxQYW5lbERlc2NyaXB0b3JdLCB2aWV3Q29udGFpbmVyKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5jb250ZXh0S2V5TGlzdGVuZXIudmFsdWUgPSB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLm9uRGlkQ2hhbmdlQ29udGV4dChlID0+IHtcblx0XHRcdFx0aWYgKGUuYWZmZWN0c1NvbWUobmV3IFNldChbLi4uZm9yd2FyZGVkUG9ydHNGZWF0dXJlc0VuYWJsZWQua2V5cygpLCAuLi5mb3J3YXJkZWRQb3J0c1ZpZXdFbmFibGVkLmtleXMoKV0pKSkge1xuXHRcdFx0XHRcdHRoaXMuZW5hYmxlRm9yd2FyZGVkUG9ydHNGZWF0dXJlcygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGVuYWJsZUJhZGdlQW5kU3RhdHVzQmFyKCkge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBSZWdpc3RyeS5hczxJVmlld3NSZWdpc3RyeT4oRXh0ZW5zaW9ucy5WaWV3c1JlZ2lzdHJ5KS5vblZpZXdzUmVnaXN0ZXJlZChlID0+IHtcblx0XHRcdGlmIChlLmZpbmQodmlldyA9PiB2aWV3LnZpZXdzLmZpbmQodmlld0Rlc2NyaXB0b3IgPT4gdmlld0Rlc2NyaXB0b3IuaWQgPT09IFRVTk5FTF9WSUVXX0lEKSkpIHtcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuZGVib3VuY2UodGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWwub25Gb3J3YXJkUG9ydCwgKF9sYXN0LCBlKSA9PiBlLCA1MCkoKCkgPT4ge1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlQWN0aXZpdHlCYWRnZSgpO1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlU3RhdHVzQmFyKCk7XG5cdFx0XHRcdH0pKTtcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuZGVib3VuY2UodGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWwub25DbG9zZVBvcnQsIChfbGFzdCwgZSkgPT4gZSwgNTApKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZUFjdGl2aXR5QmFkZ2UoKTtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZVN0YXR1c0JhcigpO1xuXHRcdFx0XHR9KSk7XG5cblx0XHRcdFx0dGhpcy51cGRhdGVBY3Rpdml0eUJhZGdlKCk7XG5cdFx0XHRcdHRoaXMudXBkYXRlU3RhdHVzQmFyKCk7XG5cdFx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVBY3Rpdml0eUJhZGdlKCkge1xuXHRcdGlmICh0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS50dW5uZWxNb2RlbC5mb3J3YXJkZWQuc2l6ZSA+IDApIHtcblx0XHRcdHRoaXMuYWN0aXZpdHlCYWRnZS52YWx1ZSA9IHRoaXMuYWN0aXZpdHlTZXJ2aWNlLnNob3dWaWV3QWN0aXZpdHkoVFVOTkVMX1ZJRVdfSUQsIHtcblx0XHRcdFx0YmFkZ2U6IG5ldyBOdW1iZXJCYWRnZSh0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS50dW5uZWxNb2RlbC5mb3J3YXJkZWQuc2l6ZSwgbiA9PiBuID09PSAxID8gbmxzLmxvY2FsaXplKCcxZm9yd2FyZGVkUG9ydCcsIFwiMSBmb3J3YXJkZWQgcG9ydFwiKSA6IG5scy5sb2NhbGl6ZSgnbkZvcndhcmRlZFBvcnRzJywgXCJ7MH0gZm9yd2FyZGVkIHBvcnRzXCIsIG4pKVxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuYWN0aXZpdHlCYWRnZS5jbGVhcigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlU3RhdHVzQmFyKCkge1xuXHRcdGlmICghdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5ICYmICF0aGlzLmhhc1BvcnRzSW5TZXNzaW9uKSB7XG5cdFx0XHQvLyBXZSBvbmx5IHdhbnQgdG8gc2hvdyB0aGUgcG9ydHMgc3RhdHVzIGJhciBlbnRyeSB3aGVuIHRoZSB1c2VyIGhhcyB0YWtlbiBhbiBhY3Rpb24gdGhhdCBpbmRpY2F0ZXMgdGhhdCB0aGV5IG1pZ2h0IGNhcmUgYWJvdXQgaXQuXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLmVudHJ5QWNjZXNzb3IpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZW50cnlBY2Nlc3NvciA9IHRoaXMuc3RhdHVzYmFyU2VydmljZS5hZGRFbnRyeSh0aGlzLmVudHJ5LCAnc3RhdHVzLmZvcndhcmRlZFBvcnRzJywgU3RhdHVzYmFyQWxpZ25tZW50LkxFRlQsIDQwKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZW50cnlBY2Nlc3Nvci51cGRhdGUodGhpcy5lbnRyeSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXQgZW50cnkoKTogSVN0YXR1c2JhckVudHJ5IHtcblx0XHRsZXQgdG9vbHRpcDogc3RyaW5nO1xuXHRcdGNvbnN0IGNvdW50ID0gdGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWwuZm9yd2FyZGVkLnNpemUgKyB0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS50dW5uZWxNb2RlbC5kZXRlY3RlZC5zaXplO1xuXHRcdGNvbnN0IHRleHQgPSBgJHtjb3VudH1gO1xuXHRcdGlmIChjb3VudCA9PT0gMCkge1xuXHRcdFx0dG9vbHRpcCA9IG5scy5sb2NhbGl6ZSgncmVtb3RlLmZvcndhcmRlZFBvcnRzLnN0YXR1c2JhclRleHROb25lJywgXCJObyBQb3J0cyBGb3J3YXJkZWRcIik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGFsbFR1bm5lbHMgPSBBcnJheS5mcm9tKHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsLmZvcndhcmRlZC52YWx1ZXMoKSk7XG5cdFx0XHRhbGxUdW5uZWxzLnB1c2goLi4uQXJyYXkuZnJvbSh0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS50dW5uZWxNb2RlbC5kZXRlY3RlZC52YWx1ZXMoKSkpO1xuXHRcdFx0dG9vbHRpcCA9IG5scy5sb2NhbGl6ZSgncmVtb3RlLmZvcndhcmRlZFBvcnRzLnN0YXR1c2JhclRvb2x0aXAnLCBcIkZvcndhcmRlZCBQb3J0czogezB9XCIsXG5cdFx0XHRcdGFsbFR1bm5lbHMubWFwKGZvcndhcmRlZCA9PiBmb3J3YXJkZWQucmVtb3RlUG9ydCkuam9pbignLCAnKSk7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRuYW1lOiBubHMubG9jYWxpemUoJ3N0YXR1cy5mb3J3YXJkZWRQb3J0cycsIFwiRm9yd2FyZGVkIFBvcnRzXCIpLFxuXHRcdFx0dGV4dDogYCQocmFkaW8tdG93ZXIpICR7dGV4dH1gLFxuXHRcdFx0YXJpYUxhYmVsOiB0b29sdGlwLFxuXHRcdFx0dG9vbHRpcCxcblx0XHRcdGNvbW1hbmQ6IGAke1RVTk5FTF9WSUVXX0lEfS5mb2N1c2Bcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBQb3J0UmVzdG9yZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVJlbW90ZUV4cGxvcmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHJlbW90ZUV4cGxvcmVyU2VydmljZTogSVJlbW90ZUV4cGxvcmVyU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHtcblx0XHRpZiAoIXRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsLmVudmlyb25tZW50VHVubmVsc1NldCkge1xuXHRcdFx0RXZlbnQub25jZSh0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS50dW5uZWxNb2RlbC5vbkVudmlyb25tZW50VHVubmVsc1NldCkoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnJlc3RvcmUoKTtcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnJlc3RvcmUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlc3RvcmUoKSB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdGb3J3YXJkZWRQb3J0czogRG9pbmcgZmlyc3QgcmVzdG9yZS4nKTtcblx0XHRyZXR1cm4gdGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UucmVzdG9yZSgpO1xuXHR9XG59XG5cblxuZXhwb3J0IGNsYXNzIEF1dG9tYXRpY1BvcnRGb3J3YXJkaW5nIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXHRwcml2YXRlIHByb2NGb3J3YXJkZXI6IFByb2NBdXRvbWF0aWNQb3J0Rm9yd2FyZGluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBvdXRwdXRGb3J3YXJkZXI6IE91dHB1dEF1dG9tYXRpY1BvcnRGb3J3YXJkaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHBvcnRMaXN0ZW5lcjogSURpc3Bvc2FibGUgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElUZXJtaW5hbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXJtaW5hbFNlcnZpY2U6IElUZXJtaW5hbFNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElFeHRlcm5hbFVyaU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlcm5hbE9wZW5lclNlcnZpY2U6IElFeHRlcm5hbFVyaU9wZW5lclNlcnZpY2UsXG5cdFx0QElSZW1vdGVFeHBsb3JlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSByZW1vdGVFeHBsb3JlclNlcnZpY2U6IElSZW1vdGVFeHBsb3JlclNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSVdvcmtiZW5jaENvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJRGVidWdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlLFxuXHRcdEBJUmVtb3RlQWdlbnRTZXJ2aWNlIHJlbW90ZUFnZW50U2VydmljZTogSVJlbW90ZUFnZW50U2VydmljZSxcblx0XHRASVR1bm5lbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0dW5uZWxTZXJ2aWNlOiBJVHVubmVsU2VydmljZSxcblx0XHRASUhvc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVByZWZlcmVuY2VzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByZWZlcmVuY2VzU2VydmljZTogSVByZWZlcmVuY2VzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHRpZiAoIWVudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25maWd1cmF0aW9uU2VydmljZS53aGVuUmVtb3RlQ29uZmlndXJhdGlvbkxvYWRlZCgpLnRoZW4oKCkgPT4gcmVtb3RlQWdlbnRTZXJ2aWNlLmdldEVudmlyb25tZW50KCkpLnRoZW4oZW52aXJvbm1lbnQgPT4ge1xuXHRcdFx0dGhpcy5zZXR1cChlbnZpcm9ubWVudCk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcihjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKFBPUlRfQVVUT19TT1VSQ0VfU0VUVElORykpIHtcblx0XHRcdFx0XHR0aGlzLnNldHVwKGVudmlyb25tZW50KTtcblx0XHRcdFx0fSBlbHNlIGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKFBPUlRfQVVUT19GQUxMQkFDS19TRVRUSU5HKSAmJiAhdGhpcy5wb3J0TGlzdGVuZXIpIHtcblx0XHRcdFx0XHR0aGlzLmxpc3RlbkZvclBvcnRzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9KTtcblxuXHRcdGlmICghdGhpcy5zdG9yYWdlU2VydmljZS5nZXRCb29sZWFuKCdwcm9jZXNzUG9ydEZvcndhcmRpbmdGYWxsYmFjaycsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIHRydWUpKSB7XG5cdFx0XHR0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKFBPUlRfQVVUT19GQUxMQkFDS19TRVRUSU5HLCAwLCBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRQb3J0QXV0b0ZhbGxiYWNrTnVtYmVyKCk6IG51bWJlciB7XG5cdFx0Y29uc3QgZmFsbGJhY2tBdCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuaW5zcGVjdDxudW1iZXI+KFBPUlRfQVVUT19GQUxMQkFDS19TRVRUSU5HKTtcblx0XHRpZiAoKGZhbGxiYWNrQXQudmFsdWUgIT09IHVuZGVmaW5lZCkgJiYgKGZhbGxiYWNrQXQudmFsdWUgPT09IDAgfHwgKGZhbGxiYWNrQXQudmFsdWUgIT09IGZhbGxiYWNrQXQuZGVmYXVsdFZhbHVlKSkpIHtcblx0XHRcdHJldHVybiBmYWxsYmFja0F0LnZhbHVlO1xuXHRcdH1cblx0XHRjb25zdCBpbnNwZWN0U291cmNlID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5pbnNwZWN0KFBPUlRfQVVUT19TT1VSQ0VfU0VUVElORyk7XG5cdFx0aWYgKGluc3BlY3RTb3VyY2UuYXBwbGljYXRpb25WYWx1ZSA9PT0gUE9SVF9BVVRPX1NPVVJDRV9TRVRUSU5HX1BST0NFU1MgfHxcblx0XHRcdGluc3BlY3RTb3VyY2UudXNlclZhbHVlID09PSBQT1JUX0FVVE9fU09VUkNFX1NFVFRJTkdfUFJPQ0VTUyB8fFxuXHRcdFx0aW5zcGVjdFNvdXJjZS51c2VyTG9jYWxWYWx1ZSA9PT0gUE9SVF9BVVRPX1NPVVJDRV9TRVRUSU5HX1BST0NFU1MgfHxcblx0XHRcdGluc3BlY3RTb3VyY2UudXNlclJlbW90ZVZhbHVlID09PSBQT1JUX0FVVE9fU09VUkNFX1NFVFRJTkdfUFJPQ0VTUyB8fFxuXHRcdFx0aW5zcGVjdFNvdXJjZS53b3Jrc3BhY2VGb2xkZXJWYWx1ZSA9PT0gUE9SVF9BVVRPX1NPVVJDRV9TRVRUSU5HX1BST0NFU1MgfHxcblx0XHRcdGluc3BlY3RTb3VyY2Uud29ya3NwYWNlVmFsdWUgPT09IFBPUlRfQVVUT19TT1VSQ0VfU0VUVElOR19QUk9DRVNTKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbGxiYWNrQXQudmFsdWUgPz8gMjA7XG5cdH1cblxuXHRwcml2YXRlIGxpc3RlbkZvclBvcnRzKCkge1xuXHRcdGxldCBmYWxsYmFja0F0ID0gdGhpcy5nZXRQb3J0QXV0b0ZhbGxiYWNrTnVtYmVyKCk7XG5cdFx0aWYgKGZhbGxiYWNrQXQgPT09IDApIHtcblx0XHRcdHRoaXMucG9ydExpc3RlbmVyPy5kaXNwb3NlKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMucHJvY0ZvcndhcmRlciAmJiAhdGhpcy5wb3J0TGlzdGVuZXIgJiYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoUE9SVF9BVVRPX1NPVVJDRV9TRVRUSU5HKSA9PT0gUE9SVF9BVVRPX1NPVVJDRV9TRVRUSU5HX1BST0NFU1MpKSB7XG5cdFx0XHR0aGlzLnBvcnRMaXN0ZW5lciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsLm9uRm9yd2FyZFBvcnQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRmYWxsYmFja0F0ID0gdGhpcy5nZXRQb3J0QXV0b0ZhbGxiYWNrTnVtYmVyKCk7XG5cdFx0XHRcdGlmIChmYWxsYmFja0F0ID09PSAwKSB7XG5cdFx0XHRcdFx0dGhpcy5wb3J0TGlzdGVuZXI/LmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKEFycmF5LmZyb20odGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWwuZm9yd2FyZGVkLnZhbHVlcygpKS5maWx0ZXIodHVubmVsID0+IHR1bm5lbC5zb3VyY2Uuc291cmNlID09PSBUdW5uZWxTb3VyY2UuQXV0bykubGVuZ3RoID4gZmFsbGJhY2tBdCkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoUE9SVF9BVVRPX1NPVVJDRV9TRVRUSU5HLCBQT1JUX0FVVE9fU09VUkNFX1NFVFRJTkdfSFlCUklEKTtcblx0XHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHtcblx0XHRcdFx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgncmVtb3RlLmF1dG9Gb3J3YXJkUG9ydHNTb3VyY2UuZmFsbGJhY2snLCBcIk92ZXIgMjAgcG9ydHMgaGF2ZSBiZWVuIGF1dG9tYXRpY2FsbHkgZm9yd2FyZGVkLiBUaGUgYHByb2Nlc3NgIGJhc2VkIGF1dG9tYXRpYyBwb3J0IGZvcndhcmRpbmcgaGFzIGJlZW4gc3dpdGNoZWQgdG8gYGh5YnJpZGAgaW4gc2V0dGluZ3MuIFNvbWUgcG9ydHMgbWF5IG5vIGxvbmdlciBiZSBkZXRlY3RlZC5cIiksXG5cdFx0XHRcdFx0XHRzZXZlcml0eTogU2V2ZXJpdHkuV2FybmluZyxcblx0XHRcdFx0XHRcdGFjdGlvbnM6IHtcblx0XHRcdFx0XHRcdFx0cHJpbWFyeTogW1xuXHRcdFx0XHRcdFx0XHRcdG5ldyBBY3Rpb24oJ3N3aXRjaEJhY2snLCBubHMubG9jYWxpemUoJ3JlbW90ZS5hdXRvRm9yd2FyZFBvcnRzU291cmNlLmZhbGxiYWNrLnN3aXRjaEJhY2snLCBcIlVuZG9cIiksIHVuZGVmaW5lZCwgdHJ1ZSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShQT1JUX0FVVE9fU09VUkNFX1NFVFRJTkcsIFBPUlRfQVVUT19TT1VSQ0VfU0VUVElOR19QUk9DRVNTKTtcblx0XHRcdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoUE9SVF9BVVRPX0ZBTExCQUNLX1NFVFRJTkcsIDAsIENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFKTtcblx0XHRcdFx0XHRcdFx0XHRcdHRoaXMucG9ydExpc3RlbmVyPy5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLnBvcnRMaXN0ZW5lciA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdFx0XHR9KSxcblx0XHRcdFx0XHRcdFx0XHRuZXcgQWN0aW9uKCdzaG93UG9ydFNvdXJjZVNldHRpbmcnLCBubHMubG9jYWxpemUoJ3JlbW90ZS5hdXRvRm9yd2FyZFBvcnRzU291cmNlLmZhbGxiYWNrLnNob3dQb3J0U291cmNlU2V0dGluZycsIFwiU2hvdyBTZXR0aW5nXCIpLCB1bmRlZmluZWQsIHRydWUsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMucHJlZmVyZW5jZXNTZXJ2aWNlLm9wZW5TZXR0aW5ncyh7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHF1ZXJ5OiAncmVtb3RlLmF1dG9Gb3J3YXJkUG9ydHNTb3VyY2UnXG5cdFx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5wb3J0TGlzdGVuZXI/LmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMucG9ydExpc3RlbmVyID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cblx0cHJpdmF0ZSBzZXR1cChlbnZpcm9ubWVudDogSVJlbW90ZUFnZW50RW52aXJvbm1lbnQgfCBudWxsKSB7XG5cdFx0Y29uc3QgYWxyZWFkeUZvcndhcmRlZCA9IHRoaXMucHJvY0ZvcndhcmRlcj8uZm9yd2FyZGVkO1xuXHRcdGNvbnN0IGlzU3dpdGNoID0gdGhpcy5vdXRwdXRGb3J3YXJkZXIgfHwgdGhpcy5wcm9jRm9yd2FyZGVyO1xuXHRcdHRoaXMucHJvY0ZvcndhcmRlcj8uZGlzcG9zZSgpO1xuXHRcdHRoaXMucHJvY0ZvcndhcmRlciA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLm91dHB1dEZvcndhcmRlcj8uZGlzcG9zZSgpO1xuXHRcdHRoaXMub3V0cHV0Rm9yd2FyZGVyID0gdW5kZWZpbmVkO1xuXHRcdGlmIChlbnZpcm9ubWVudD8ub3MgIT09IE9wZXJhdGluZ1N5c3RlbS5MaW51eCkge1xuXHRcdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuaW5zcGVjdDxzdHJpbmc+KFBPUlRfQVVUT19TT1VSQ0VfU0VUVElORykuZGVmYXVsdD8udmFsdWUgIT09IFBPUlRfQVVUT19TT1VSQ0VfU0VUVElOR19PVVRQVVQpIHtcblx0XHRcdFx0UmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbilcblx0XHRcdFx0XHQucmVnaXN0ZXJEZWZhdWx0Q29uZmlndXJhdGlvbnMoW3sgb3ZlcnJpZGVzOiB7ICdyZW1vdGUuYXV0b0ZvcndhcmRQb3J0c1NvdXJjZSc6IFBPUlRfQVVUT19TT1VSQ0VfU0VUVElOR19PVVRQVVQgfSB9XSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLm91dHB1dEZvcndhcmRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBPdXRwdXRBdXRvbWF0aWNQb3J0Rm9yd2FyZGluZyh0aGlzLnRlcm1pbmFsU2VydmljZSwgdGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLCB0aGlzLm9wZW5lclNlcnZpY2UsIHRoaXMuZXh0ZXJuYWxPcGVuZXJTZXJ2aWNlLFxuXHRcdFx0XHR0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZSwgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy5kZWJ1Z1NlcnZpY2UsIHRoaXMudHVubmVsU2VydmljZSwgdGhpcy5ob3N0U2VydmljZSwgdGhpcy5sb2dTZXJ2aWNlLCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLCAoKSA9PiBmYWxzZSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCB1c2VQcm9jID0gKCkgPT4gKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoUE9SVF9BVVRPX1NPVVJDRV9TRVRUSU5HKSA9PT0gUE9SVF9BVVRPX1NPVVJDRV9TRVRUSU5HX1BST0NFU1MpO1xuXHRcdFx0aWYgKHVzZVByb2MoKSkge1xuXHRcdFx0XHR0aGlzLnByb2NGb3J3YXJkZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgUHJvY0F1dG9tYXRpY1BvcnRGb3J3YXJkaW5nKGZhbHNlLCBhbHJlYWR5Rm9yd2FyZGVkLCAhaXNTd2l0Y2gsIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UsIHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLCB0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0XHRcdFx0dGhpcy5vcGVuZXJTZXJ2aWNlLCB0aGlzLmV4dGVybmFsT3BlbmVyU2VydmljZSwgdGhpcy50dW5uZWxTZXJ2aWNlLCB0aGlzLmhvc3RTZXJ2aWNlLCB0aGlzLmxvZ1NlcnZpY2UsIHRoaXMuY29udGV4dEtleVNlcnZpY2UpKTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShQT1JUX0FVVE9fU09VUkNFX1NFVFRJTkcpID09PSBQT1JUX0FVVE9fU09VUkNFX1NFVFRJTkdfSFlCUklEKSB7XG5cdFx0XHRcdHRoaXMucHJvY0ZvcndhcmRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBQcm9jQXV0b21hdGljUG9ydEZvcndhcmRpbmcodHJ1ZSwgYWxyZWFkeUZvcndhcmRlZCwgIWlzU3dpdGNoLCB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZSwgdGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdFx0XHRcdHRoaXMub3BlbmVyU2VydmljZSwgdGhpcy5leHRlcm5hbE9wZW5lclNlcnZpY2UsIHRoaXMudHVubmVsU2VydmljZSwgdGhpcy5ob3N0U2VydmljZSwgdGhpcy5sb2dTZXJ2aWNlLCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLm91dHB1dEZvcndhcmRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBPdXRwdXRBdXRvbWF0aWNQb3J0Rm9yd2FyZGluZyh0aGlzLnRlcm1pbmFsU2VydmljZSwgdGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLCB0aGlzLm9wZW5lclNlcnZpY2UsIHRoaXMuZXh0ZXJuYWxPcGVuZXJTZXJ2aWNlLFxuXHRcdFx0XHR0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZSwgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy5kZWJ1Z1NlcnZpY2UsIHRoaXMudHVubmVsU2VydmljZSwgdGhpcy5ob3N0U2VydmljZSwgdGhpcy5sb2dTZXJ2aWNlLCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLCB1c2VQcm9jKSk7XG5cdFx0fVxuXHRcdHRoaXMubGlzdGVuRm9yUG9ydHMoKTtcblx0fVxufVxuXG5jbGFzcyBPbkF1dG9Gb3J3YXJkZWRBY3Rpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBsYXN0Tm90aWZ5VGltZTogRGF0ZTtcblx0cHJpdmF0ZSBzdGF0aWMgTk9USUZZX0NPT0xfRE9XTiA9IDUwMDA7IC8vIG1pbGxpc2Vjb25kc1xuXHRwcml2YXRlIGxhc3ROb3RpZmljYXRpb246IElOb3RpZmljYXRpb25IYW5kbGUgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgbGFzdFNob3duUG9ydDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGRvQWN0aW9uVHVubmVsczogUmVtb3RlVHVubmVsW10gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgYWxyZWFkeU9wZW5lZE9uY2U6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpO1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSByZW1vdGVFeHBsb3JlclNlcnZpY2U6IElSZW1vdGVFeHBsb3JlclNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGV4dGVybmFsT3BlbmVyU2VydmljZTogSUV4dGVybmFsVXJpT3BlbmVyU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHR1bm5lbFNlcnZpY2U6IElUdW5uZWxTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5sYXN0Tm90aWZ5VGltZSA9IG5ldyBEYXRlKCk7XG5cdFx0dGhpcy5sYXN0Tm90aWZ5VGltZS5zZXRGdWxsWWVhcih0aGlzLmxhc3ROb3RpZnlUaW1lLmdldEZ1bGxZZWFyKCkgLSAxKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBkb0FjdGlvbih0dW5uZWxzOiBSZW1vdGVUdW5uZWxbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgRm9yd2FyZGVkUG9ydHM6IChPbkF1dG9Gb3J3YXJkZWRBY3Rpb24pIFN0YXJ0aW5nIGFjdGlvbiBmb3IgJHt0dW5uZWxzWzBdPy50dW5uZWxSZW1vdGVQb3J0fWApO1xuXHRcdHRoaXMuZG9BY3Rpb25UdW5uZWxzID0gdHVubmVscztcblx0XHRjb25zdCB0dW5uZWwgPSBhd2FpdCB0aGlzLnBvcnROdW1iZXJIZXVyaXN0aWNEZWxheSgpO1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgRm9yd2FyZGVkUG9ydHM6IChPbkF1dG9Gb3J3YXJkZWRBY3Rpb24pIEhldXJpc3RpYyBjaG9zZSAke3R1bm5lbD8udHVubmVsUmVtb3RlUG9ydH1gKTtcblx0XHRpZiAodHVubmVsKSB7XG5cdFx0XHRjb25zdCBhbGxBdHRyaWJ1dGVzID0gYXdhaXQgdGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWwuZ2V0QXR0cmlidXRlcyhbeyBwb3J0OiB0dW5uZWwudHVubmVsUmVtb3RlUG9ydCwgaG9zdDogdHVubmVsLnR1bm5lbFJlbW90ZUhvc3QgfV0pO1xuXHRcdFx0Y29uc3QgYXR0cmlidXRlcyA9IGFsbEF0dHJpYnV0ZXM/LmdldCh0dW5uZWwudHVubmVsUmVtb3RlUG9ydCk/Lm9uQXV0b0ZvcndhcmQ7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYEZvcndhcmRlZFBvcnRzOiAoT25BdXRvRm9yd2FyZGVkQWN0aW9uKSBvbkF1dG9Gb3J3YXJkIGFjdGlvbiBpcyAke2F0dHJpYnV0ZXN9YCk7XG5cdFx0XHRzd2l0Y2ggKGF0dHJpYnV0ZXMpIHtcblx0XHRcdFx0Y2FzZSBPblBvcnRGb3J3YXJkLk9wZW5Ccm93c2VyT25jZToge1xuXHRcdFx0XHRcdGlmICh0aGlzLmFscmVhZHlPcGVuZWRPbmNlLmhhcyh0dW5uZWwubG9jYWxBZGRyZXNzKSkge1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMuYWxyZWFkeU9wZW5lZE9uY2UuYWRkKHR1bm5lbC5sb2NhbEFkZHJlc3MpO1xuXHRcdFx0XHRcdC8vIEludGVudGlvbmFsbHkgZG8gbm90IGJyZWFrIHNvIHRoYXQgdGhlIG9wZW4gYnJvd3NlciBwYXRoIGNhbiBiZSBydW4uXG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSBPblBvcnRGb3J3YXJkLk9wZW5Ccm93c2VyOiB7XG5cdFx0XHRcdFx0Y29uc3QgYWRkcmVzcyA9IG1ha2VBZGRyZXNzKHR1bm5lbC50dW5uZWxSZW1vdGVIb3N0LCB0dW5uZWwudHVubmVsUmVtb3RlUG9ydCk7XG5cdFx0XHRcdFx0YXdhaXQgT3BlblBvcnRJbkJyb3dzZXJBY3Rpb24ucnVuKHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsLCB0aGlzLm9wZW5lclNlcnZpY2UsIGFkZHJlc3MpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgT25Qb3J0Rm9yd2FyZC5PcGVuUHJldmlldzoge1xuXHRcdFx0XHRcdGNvbnN0IGFkZHJlc3MgPSBtYWtlQWRkcmVzcyh0dW5uZWwudHVubmVsUmVtb3RlSG9zdCwgdHVubmVsLnR1bm5lbFJlbW90ZVBvcnQpO1xuXHRcdFx0XHRcdGF3YWl0IE9wZW5Qb3J0SW5QcmV2aWV3QWN0aW9uLnJ1bih0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS50dW5uZWxNb2RlbCwgdGhpcy5vcGVuZXJTZXJ2aWNlLCB0aGlzLmV4dGVybmFsT3BlbmVyU2VydmljZSwgYWRkcmVzcyk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2FzZSBPblBvcnRGb3J3YXJkLlNpbGVudDogYnJlYWs7XG5cdFx0XHRcdGRlZmF1bHQ6IHtcblx0XHRcdFx0XHRjb25zdCBlbGFwc2VkID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgLSB0aGlzLmxhc3ROb3RpZnlUaW1lLmdldFRpbWUoKTtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYEZvcndhcmRlZFBvcnRzOiAoT25BdXRvRm9yd2FyZGVkQWN0aW9uKSB0aW1lIGVsYXBzZWQgc2luY2UgbGFzdCBub3RpZmljYXRpb24gJHtlbGFwc2VkfSBtc2ApO1xuXHRcdFx0XHRcdGlmIChlbGFwc2VkID4gT25BdXRvRm9yd2FyZGVkQWN0aW9uLk5PVElGWV9DT09MX0RPV04pIHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuc2hvd05vdGlmaWNhdGlvbih0dW5uZWwpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBoaWRlKHJlbW92ZWRQb3J0czogbnVtYmVyW10pIHtcblx0XHRpZiAodGhpcy5kb0FjdGlvblR1bm5lbHMpIHtcblx0XHRcdHRoaXMuZG9BY3Rpb25UdW5uZWxzID0gdGhpcy5kb0FjdGlvblR1bm5lbHMuZmlsdGVyKHZhbHVlID0+ICFyZW1vdmVkUG9ydHMuaW5jbHVkZXModmFsdWUudHVubmVsUmVtb3RlUG9ydCkpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5sYXN0U2hvd25Qb3J0ICYmIHJlbW92ZWRQb3J0cy5pbmRleE9mKHRoaXMubGFzdFNob3duUG9ydCkgPj0gMCkge1xuXHRcdFx0dGhpcy5sYXN0Tm90aWZpY2F0aW9uPy5jbG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgbmV3ZXJUdW5uZWw6IFJlbW90ZVR1bm5lbCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBhc3luYyBwb3J0TnVtYmVySGV1cmlzdGljRGVsYXkoKTogUHJvbWlzZTxSZW1vdGVUdW5uZWwgfCB1bmRlZmluZWQ+IHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYEZvcndhcmRlZFBvcnRzOiAoT25BdXRvRm9yd2FyZGVkQWN0aW9uKSBTdGFydGluZyBoZXVyaXN0aWMgZGVsYXlgKTtcblx0XHRpZiAoIXRoaXMuZG9BY3Rpb25UdW5uZWxzIHx8IHRoaXMuZG9BY3Rpb25UdW5uZWxzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLmRvQWN0aW9uVHVubmVscyA9IHRoaXMuZG9BY3Rpb25UdW5uZWxzLnNvcnQoKGEsIGIpID0+IGEudHVubmVsUmVtb3RlUG9ydCAtIGIudHVubmVsUmVtb3RlUG9ydCk7XG5cdFx0Y29uc3QgZmlyc3RUdW5uZWwgPSB0aGlzLmRvQWN0aW9uVHVubmVscy5zaGlmdCgpITtcblx0XHQvLyBIZXVyaXN0aWMuXG5cdFx0aWYgKGZpcnN0VHVubmVsLnR1bm5lbFJlbW90ZVBvcnQgJSAxMDAwID09PSAwKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYEZvcndhcmRlZFBvcnRzOiAoT25BdXRvRm9yd2FyZGVkQWN0aW9uKSBIZXVyaXN0aWMgY2hvc2UgdHVubmVsIGJlY2F1c2UgJSAxMDAwOiAke2ZpcnN0VHVubmVsLnR1bm5lbFJlbW90ZVBvcnR9YCk7XG5cdFx0XHR0aGlzLm5ld2VyVHVubmVsID0gZmlyc3RUdW5uZWw7XG5cdFx0XHRyZXR1cm4gZmlyc3RUdW5uZWw7XG5cdFx0XHQvLyA5MjI5IGlzIHRoZSBub2RlIGluc3BlY3QgcG9ydFxuXHRcdH0gZWxzZSBpZiAoZmlyc3RUdW5uZWwudHVubmVsUmVtb3RlUG9ydCA8IDEwMDAwICYmIGZpcnN0VHVubmVsLnR1bm5lbFJlbW90ZVBvcnQgIT09IDkyMjkpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgRm9yd2FyZGVkUG9ydHM6IChPbkF1dG9Gb3J3YXJkZWRBY3Rpb24pIEhldXJpc3RpYyBjaG9zZSB0dW5uZWwgYmVjYXVzZSA8IDEwMDAwOiAke2ZpcnN0VHVubmVsLnR1bm5lbFJlbW90ZVBvcnR9YCk7XG5cdFx0XHR0aGlzLm5ld2VyVHVubmVsID0gZmlyc3RUdW5uZWw7XG5cdFx0XHRyZXR1cm4gZmlyc3RUdW5uZWw7XG5cdFx0fVxuXG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBGb3J3YXJkZWRQb3J0czogKE9uQXV0b0ZvcndhcmRlZEFjdGlvbikgV2FpdGluZyBmb3IgXCJiZXR0ZXJcIiB0dW5uZWwgdGhhbiAke2ZpcnN0VHVubmVsLnR1bm5lbFJlbW90ZVBvcnR9YCk7XG5cdFx0dGhpcy5uZXdlclR1bm5lbCA9IHVuZGVmaW5lZDtcblx0XHRyZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMubmV3ZXJUdW5uZWwpIHtcblx0XHRcdFx0XHRyZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAodGhpcy5kb0FjdGlvblR1bm5lbHM/LmluY2x1ZGVzKGZpcnN0VHVubmVsKSkge1xuXHRcdFx0XHRcdHJlc29sdmUoZmlyc3RUdW5uZWwpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgMzAwMCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGJhc2ljTWVzc2FnZSh0dW5uZWw6IFJlbW90ZVR1bm5lbCkge1xuXHRcdGNvbnN0IHByb3BlcnRpZXMgPSBhd2FpdCB0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS50dW5uZWxNb2RlbC5nZXRBdHRyaWJ1dGVzKFt7IGhvc3Q6IHR1bm5lbC50dW5uZWxSZW1vdGVIb3N0LCBwb3J0OiB0dW5uZWwudHVubmVsUmVtb3RlUG9ydCB9XSwgZmFsc2UpO1xuXHRcdGNvbnN0IGxhYmVsID0gcHJvcGVydGllcz8uZ2V0KHR1bm5lbC50dW5uZWxSZW1vdGVQb3J0KT8ubGFiZWw7XG5cdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgncmVtb3RlLnR1bm5lbHNWaWV3LmF1dG9tYXRpY0ZvcndhcmQnLCBcIllvdXIgYXBwbGljYXRpb257MH0gcnVubmluZyBvbiBwb3J0IHsxfSBpcyBhdmFpbGFibGUuICBcIixcblx0XHRcdGxhYmVsID8gYCAoJHtsYWJlbH0pYCA6ICcnLFxuXHRcdFx0dHVubmVsLnR1bm5lbFJlbW90ZVBvcnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBsaW5rTWVzc2FnZSgpIHtcblx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKFxuXHRcdFx0eyBrZXk6ICdyZW1vdGUudHVubmVsc1ZpZXcubm90aWZpY2F0aW9uTGluazInLCBjb21tZW50OiBbJ1tTZWUgYWxsIGZvcndhcmRlZCBwb3J0c10oezB9KSBpcyBhIGxpbmsuIE9ubHkgdHJhbnNsYXRlIGBTZWUgYWxsIGZvcndhcmRlZCBwb3J0c2AuIERvIG5vdCBjaGFuZ2UgYnJhY2tldHMgYW5kIHBhcmVudGhlc2VzIG9yIHswfSddIH0sXG5cdFx0XHRcIltTZWUgYWxsIGZvcndhcmRlZCBwb3J0c10oezB9KVwiLCBgY29tbWFuZDoke1R1bm5lbFBhbmVsLklEfS5mb2N1c2ApO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzaG93Tm90aWZpY2F0aW9uKHR1bm5lbDogUmVtb3RlVHVubmVsKSB7XG5cdFx0aWYgKCFhd2FpdCB0aGlzLmhvc3RTZXJ2aWNlLmhhZExhc3RGb2N1cygpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5sYXN0Tm90aWZpY2F0aW9uPy5jbG9zZSgpO1xuXHRcdGxldCBtZXNzYWdlID0gYXdhaXQgdGhpcy5iYXNpY01lc3NhZ2UodHVubmVsKTtcblx0XHRjb25zdCBjaG9pY2VzID0gW3RoaXMub3BlbkJyb3dzZXJDaG9pY2UodHVubmVsKV07XG5cdFx0aWYgKCFpc1dlYiB8fCBvcGVuUHJldmlld0VuYWJsZWRDb250ZXh0LmdldFZhbHVlKHRoaXMuY29udGV4dEtleVNlcnZpY2UpKSB7XG5cdFx0XHRjaG9pY2VzLnB1c2godGhpcy5vcGVuUHJldmlld0Nob2ljZSh0dW5uZWwpKTtcblx0XHR9XG5cblx0XHRpZiAoKHR1bm5lbC50dW5uZWxMb2NhbFBvcnQgIT09IHR1bm5lbC50dW5uZWxSZW1vdGVQb3J0KSAmJiB0aGlzLnR1bm5lbFNlcnZpY2UuY2FuRWxldmF0ZSAmJiB0aGlzLnR1bm5lbFNlcnZpY2UuaXNQb3J0UHJpdmlsZWdlZCh0dW5uZWwudHVubmVsUmVtb3RlUG9ydCkpIHtcblx0XHRcdC8vIFByaXZpbGVnZWQgcG9ydHMgYXJlIG5vdCBvbiBXaW5kb3dzLCBzbyBpdCdzIHNhZmUgdG8gdXNlIFwic3VwZXJ1c2VyXCJcblx0XHRcdG1lc3NhZ2UgKz0gbmxzLmxvY2FsaXplKCdyZW1vdGUudHVubmVsc1ZpZXcuZWxldmF0aW9uTWVzc2FnZScsIFwiWW91J2xsIG5lZWQgdG8gcnVuIGFzIHN1cGVydXNlciB0byB1c2UgcG9ydCB7MH0gbG9jYWxseS4gIFwiLCB0dW5uZWwudHVubmVsUmVtb3RlUG9ydCk7XG5cdFx0XHRjaG9pY2VzLnVuc2hpZnQodGhpcy5lbGV2YXRlQ2hvaWNlKHR1bm5lbCkpO1xuXHRcdH1cblxuXHRcdGlmICh0dW5uZWwucHJpdmFjeSA9PT0gVHVubmVsUHJpdmFjeUlkLlByaXZhdGUgJiYgaXNXZWIgJiYgdGhpcy50dW5uZWxTZXJ2aWNlLmNhbkNoYW5nZVByaXZhY3kpIHtcblx0XHRcdGNob2ljZXMucHVzaCh0aGlzLm1ha2VQdWJsaWNDaG9pY2UodHVubmVsKSk7XG5cdFx0fVxuXG5cdFx0bWVzc2FnZSArPSB0aGlzLmxpbmtNZXNzYWdlKCk7XG5cblx0XHR0aGlzLmxhc3ROb3RpZmljYXRpb24gPSB0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFNldmVyaXR5LkluZm8sIG1lc3NhZ2UsIGNob2ljZXMsIHsgbmV2ZXJTaG93QWdhaW46IHsgaWQ6ICdyZW1vdGUudHVubmVsc1ZpZXcuYXV0b0ZvcndhcmROZXZlclNob3cnLCBpc1NlY29uZGFyeTogdHJ1ZSB9IH0pO1xuXHRcdHRoaXMubGFzdFNob3duUG9ydCA9IHR1bm5lbC50dW5uZWxSZW1vdGVQb3J0O1xuXHRcdHRoaXMubGFzdE5vdGlmeVRpbWUgPSBuZXcgRGF0ZSgpO1xuXHRcdHRoaXMubGFzdE5vdGlmaWNhdGlvbi5vbkRpZENsb3NlKCgpID0+IHtcblx0XHRcdHRoaXMubGFzdE5vdGlmaWNhdGlvbiA9IHVuZGVmaW5lZDtcblx0XHRcdHRoaXMubGFzdFNob3duUG9ydCA9IHVuZGVmaW5lZDtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgbWFrZVB1YmxpY0Nob2ljZSh0dW5uZWw6IFJlbW90ZVR1bm5lbCk6IElQcm9tcHRDaG9pY2Uge1xuXHRcdHJldHVybiB7XG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdyZW1vdGUudHVubmVsc1ZpZXcubWFrZVB1YmxpYycsIFwiTWFrZSBQdWJsaWNcIiksXG5cdFx0XHRydW46IGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3Qgb2xkVHVubmVsRGV0YWlscyA9IG1hcEhhc0FkZHJlc3NMb2NhbGhvc3RPckFsbEludGVyZmFjZXModGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWwuZm9yd2FyZGVkLCB0dW5uZWwudHVubmVsUmVtb3RlSG9zdCwgdHVubmVsLnR1bm5lbFJlbW90ZVBvcnQpO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS5jbG9zZSh7IGhvc3Q6IHR1bm5lbC50dW5uZWxSZW1vdGVIb3N0LCBwb3J0OiB0dW5uZWwudHVubmVsUmVtb3RlUG9ydCB9LCBUdW5uZWxDbG9zZVJlYXNvbi5PdGhlcik7XG5cdFx0XHRcdHJldHVybiB0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS5mb3J3YXJkKHtcblx0XHRcdFx0XHRyZW1vdGU6IHsgaG9zdDogdHVubmVsLnR1bm5lbFJlbW90ZUhvc3QsIHBvcnQ6IHR1bm5lbC50dW5uZWxSZW1vdGVQb3J0IH0sXG5cdFx0XHRcdFx0bG9jYWw6IHR1bm5lbC50dW5uZWxMb2NhbFBvcnQsXG5cdFx0XHRcdFx0bmFtZTogb2xkVHVubmVsRGV0YWlscz8ubmFtZSxcblx0XHRcdFx0XHRlbGV2YXRlSWZOZWVkZWQ6IHRydWUsXG5cdFx0XHRcdFx0cHJpdmFjeTogVHVubmVsUHJpdmFjeUlkLlB1YmxpYyxcblx0XHRcdFx0XHRzb3VyY2U6IG9sZFR1bm5lbERldGFpbHM/LnNvdXJjZVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBvcGVuQnJvd3NlckNob2ljZSh0dW5uZWw6IFJlbW90ZVR1bm5lbCk6IElQcm9tcHRDaG9pY2Uge1xuXHRcdGNvbnN0IGFkZHJlc3MgPSBtYWtlQWRkcmVzcyh0dW5uZWwudHVubmVsUmVtb3RlSG9zdCwgdHVubmVsLnR1bm5lbFJlbW90ZVBvcnQpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRsYWJlbDogT3BlblBvcnRJbkJyb3dzZXJBY3Rpb24uTEFCRUwsXG5cdFx0XHRydW46ICgpID0+IE9wZW5Qb3J0SW5Ccm93c2VyQWN0aW9uLnJ1bih0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS50dW5uZWxNb2RlbCwgdGhpcy5vcGVuZXJTZXJ2aWNlLCBhZGRyZXNzKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIG9wZW5QcmV2aWV3Q2hvaWNlKHR1bm5lbDogUmVtb3RlVHVubmVsKTogSVByb21wdENob2ljZSB7XG5cdFx0Y29uc3QgYWRkcmVzcyA9IG1ha2VBZGRyZXNzKHR1bm5lbC50dW5uZWxSZW1vdGVIb3N0LCB0dW5uZWwudHVubmVsUmVtb3RlUG9ydCk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGxhYmVsOiBPcGVuUG9ydEluUHJldmlld0FjdGlvbi5MQUJFTCxcblx0XHRcdHJ1bjogKCkgPT4gT3BlblBvcnRJblByZXZpZXdBY3Rpb24ucnVuKHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsLCB0aGlzLm9wZW5lclNlcnZpY2UsIHRoaXMuZXh0ZXJuYWxPcGVuZXJTZXJ2aWNlLCBhZGRyZXNzKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGVsZXZhdGVDaG9pY2UodHVubmVsOiBSZW1vdGVUdW5uZWwpOiBJUHJvbXB0Q2hvaWNlIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0Ly8gUHJpdmlsZWdlZCBwb3J0cyBhcmUgbm90IG9uIFdpbmRvd3MsIHNvIGl0J3Mgb2sgdG8gc3RpY2sgdG8ganVzdCBcInN1ZG9cIi5cblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ3JlbW90ZS50dW5uZWxzVmlldy5lbGV2YXRpb25CdXR0b24nLCBcIlVzZSBQb3J0IHswfSBhcyBTdWRvLi4uXCIsIHR1bm5lbC50dW5uZWxSZW1vdGVQb3J0KSxcblx0XHRcdHJ1bjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS5jbG9zZSh7IGhvc3Q6IHR1bm5lbC50dW5uZWxSZW1vdGVIb3N0LCBwb3J0OiB0dW5uZWwudHVubmVsUmVtb3RlUG9ydCB9LCBUdW5uZWxDbG9zZVJlYXNvbi5PdGhlcik7XG5cdFx0XHRcdGNvbnN0IG5ld1R1bm5lbCA9IGF3YWl0IHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLmZvcndhcmQoe1xuXHRcdFx0XHRcdHJlbW90ZTogeyBob3N0OiB0dW5uZWwudHVubmVsUmVtb3RlSG9zdCwgcG9ydDogdHVubmVsLnR1bm5lbFJlbW90ZVBvcnQgfSxcblx0XHRcdFx0XHRsb2NhbDogdHVubmVsLnR1bm5lbFJlbW90ZVBvcnQsXG5cdFx0XHRcdFx0ZWxldmF0ZUlmTmVlZGVkOiB0cnVlLFxuXHRcdFx0XHRcdHNvdXJjZTogQXV0b1R1bm5lbFNvdXJjZVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKCFuZXdUdW5uZWwgfHwgKHR5cGVvZiBuZXdUdW5uZWwgPT09ICdzdHJpbmcnKSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmxhc3ROb3RpZmljYXRpb24/LmNsb3NlKCk7XG5cdFx0XHRcdHRoaXMubGFzdFNob3duUG9ydCA9IG5ld1R1bm5lbC50dW5uZWxSZW1vdGVQb3J0O1xuXHRcdFx0XHR0aGlzLmxhc3ROb3RpZmljYXRpb24gPSB0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFNldmVyaXR5LkluZm8sXG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5iYXNpY01lc3NhZ2UobmV3VHVubmVsKSArIHRoaXMubGlua01lc3NhZ2UoKSxcblx0XHRcdFx0XHRbdGhpcy5vcGVuQnJvd3NlckNob2ljZShuZXdUdW5uZWwpLCB0aGlzLm9wZW5QcmV2aWV3Q2hvaWNlKHR1bm5lbCldLFxuXHRcdFx0XHRcdHsgbmV2ZXJTaG93QWdhaW46IHsgaWQ6ICdyZW1vdGUudHVubmVsc1ZpZXcuYXV0b0ZvcndhcmROZXZlclNob3cnLCBpc1NlY29uZGFyeTogdHJ1ZSB9IH0pO1xuXHRcdFx0XHR0aGlzLmxhc3ROb3RpZmljYXRpb24ub25EaWRDbG9zZSgoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5sYXN0Tm90aWZpY2F0aW9uID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdHRoaXMubGFzdFNob3duUG9ydCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxufVxuXG5jbGFzcyBPdXRwdXRBdXRvbWF0aWNQb3J0Rm9yd2FyZGluZyBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHBvcnRzRmVhdHVyZXM/OiBJRGlzcG9zYWJsZTtcblx0cHJpdmF0ZSB1cmxGaW5kZXI/OiBVcmxGaW5kZXI7XG5cdHByaXZhdGUgbm90aWZpZXI6IE9uQXV0b0ZvcndhcmRlZEFjdGlvbjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IHRlcm1pbmFsU2VydmljZTogSVRlcm1pbmFsU2VydmljZSxcblx0XHRyZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRyZWFkb25seSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRyZWFkb25seSBleHRlcm5hbE9wZW5lclNlcnZpY2U6IElFeHRlcm5hbFVyaU9wZW5lclNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSByZW1vdGVFeHBsb3JlclNlcnZpY2U6IElSZW1vdGVFeHBsb3JlclNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZGVidWdTZXJ2aWNlOiBJRGVidWdTZXJ2aWNlLFxuXHRcdHJlYWRvbmx5IHR1bm5lbFNlcnZpY2U6IElUdW5uZWxTZXJ2aWNlLFxuXHRcdHJlYWRvbmx5IGhvc3RTZXJ2aWNlOiBJSG9zdFNlcnZpY2UsXG5cdFx0cmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0cmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRyZWFkb25seSBwcml2aWxlZ2VkT25seTogKCkgPT4gYm9vbGVhblxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMubm90aWZpZXIgPSBuZXcgT25BdXRvRm9yd2FyZGVkQWN0aW9uKG5vdGlmaWNhdGlvblNlcnZpY2UsIHJlbW90ZUV4cGxvcmVyU2VydmljZSwgb3BlbmVyU2VydmljZSwgZXh0ZXJuYWxPcGVuZXJTZXJ2aWNlLCB0dW5uZWxTZXJ2aWNlLCBob3N0U2VydmljZSwgbG9nU2VydmljZSwgY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbigoZSkgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oUE9SVF9BVVRPX0ZPUldBUkRfU0VUVElORykpIHtcblx0XHRcdFx0dGhpcy50cnlTdGFydFN0b3BVcmxGaW5kZXIoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLnBvcnRzRmVhdHVyZXMgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS5vbkVuYWJsZWRQb3J0c0ZlYXR1cmVzKCgpID0+IHtcblx0XHRcdHRoaXMudHJ5U3RhcnRTdG9wVXJsRmluZGVyKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMudHJ5U3RhcnRTdG9wVXJsRmluZGVyKCk7XG5cblx0XHRpZiAoY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoUE9SVF9BVVRPX1NPVVJDRV9TRVRUSU5HKSA9PT0gUE9SVF9BVVRPX1NPVVJDRV9TRVRUSU5HX0hZQlJJRCkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50dW5uZWxTZXJ2aWNlLm9uVHVubmVsQ2xvc2VkKHR1bm5lbCA9PiB0aGlzLm5vdGlmaWVyLmhpZGUoW3R1bm5lbC5wb3J0XSkpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHRyeVN0YXJ0U3RvcFVybEZpbmRlcigpIHtcblx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShQT1JUX0FVVE9fRk9SV0FSRF9TRVRUSU5HKSkge1xuXHRcdFx0dGhpcy5zdGFydFVybEZpbmRlcigpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnN0b3BVcmxGaW5kZXIoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHN0YXJ0VXJsRmluZGVyKCkge1xuXHRcdGlmICghdGhpcy51cmxGaW5kZXIgJiYgKHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnBvcnRzRmVhdHVyZXNFbmFibGVkICE9PSBQb3J0c0VuYWJsZW1lbnQuQWRkaXRpb25hbEZlYXR1cmVzKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLnBvcnRzRmVhdHVyZXM/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLnVybEZpbmRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBVcmxGaW5kZXIodGhpcy50ZXJtaW5hbFNlcnZpY2UsIHRoaXMuZGVidWdTZXJ2aWNlKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy51cmxGaW5kZXIub25EaWRNYXRjaExvY2FsVXJsKGFzeW5jIChsb2NhbFVybCkgPT4ge1xuXHRcdFx0aWYgKG1hcEhhc0FkZHJlc3NMb2NhbGhvc3RPckFsbEludGVyZmFjZXModGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWwuZGV0ZWN0ZWQsIGxvY2FsVXJsLmhvc3QsIGxvY2FsVXJsLnBvcnQpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGF0dHJpYnV0ZXMgPSAoYXdhaXQgdGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWwuZ2V0QXR0cmlidXRlcyhbbG9jYWxVcmxdKSk/LmdldChsb2NhbFVybC5wb3J0KTtcblx0XHRcdGlmIChhdHRyaWJ1dGVzPy5vbkF1dG9Gb3J3YXJkID09PSBPblBvcnRGb3J3YXJkLklnbm9yZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5wcml2aWxlZ2VkT25seSgpICYmICF0aGlzLnR1bm5lbFNlcnZpY2UuaXNQb3J0UHJpdmlsZWdlZChsb2NhbFVybC5wb3J0KSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBmb3J3YXJkZWQgPSBhd2FpdCB0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS5mb3J3YXJkKHsgcmVtb3RlOiBsb2NhbFVybCwgc291cmNlOiBBdXRvVHVubmVsU291cmNlIH0sIGF0dHJpYnV0ZXMgPz8gbnVsbCk7XG5cdFx0XHRpZiAoZm9yd2FyZGVkICYmICh0eXBlb2YgZm9yd2FyZGVkICE9PSAnc3RyaW5nJykpIHtcblx0XHRcdFx0dGhpcy5ub3RpZmllci5kb0FjdGlvbihbZm9yd2FyZGVkXSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdG9wVXJsRmluZGVyKCkge1xuXHRcdGlmICh0aGlzLnVybEZpbmRlcikge1xuXHRcdFx0dGhpcy51cmxGaW5kZXIuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy51cmxGaW5kZXIgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIFByb2NBdXRvbWF0aWNQb3J0Rm9yd2FyZGluZyBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIGNhbmRpZGF0ZUxpc3RlbmVyOiBJRGlzcG9zYWJsZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBhdXRvRm9yd2FyZGVkOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblx0cHJpdmF0ZSBub3RpZmllZE9ubHk6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpO1xuXHRwcml2YXRlIG5vdGlmaWVyOiBPbkF1dG9Gb3J3YXJkZWRBY3Rpb247XG5cdHByaXZhdGUgaW5pdGlhbENhbmRpZGF0ZXM6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpO1xuXHRwcml2YXRlIHBvcnRzRmVhdHVyZXM6IElEaXNwb3NhYmxlIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdW5mb3J3YXJkT25seTogYm9vbGVhbixcblx0XHRyZWFkb25seSBhbHJlYWR5QXV0b0ZvcndhcmRlZDogU2V0PHN0cmluZz4gfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBuZWVkc0luaXRpYWxDYW5kaWRhdGVzOiBib29sZWFuLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRyZWFkb25seSByZW1vdGVFeHBsb3JlclNlcnZpY2U6IElSZW1vdGVFeHBsb3JlclNlcnZpY2UsXG5cdFx0cmVhZG9ubHkgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0cmVhZG9ubHkgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0cmVhZG9ubHkgZXh0ZXJuYWxPcGVuZXJTZXJ2aWNlOiBJRXh0ZXJuYWxVcmlPcGVuZXJTZXJ2aWNlLFxuXHRcdHJlYWRvbmx5IHR1bm5lbFNlcnZpY2U6IElUdW5uZWxTZXJ2aWNlLFxuXHRcdHJlYWRvbmx5IGhvc3RTZXJ2aWNlOiBJSG9zdFNlcnZpY2UsXG5cdFx0cmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0cmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLm5vdGlmaWVyID0gbmV3IE9uQXV0b0ZvcndhcmRlZEFjdGlvbihub3RpZmljYXRpb25TZXJ2aWNlLCByZW1vdGVFeHBsb3JlclNlcnZpY2UsIG9wZW5lclNlcnZpY2UsIGV4dGVybmFsT3BlbmVyU2VydmljZSwgdHVubmVsU2VydmljZSwgaG9zdFNlcnZpY2UsIGxvZ1NlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRhbHJlYWR5QXV0b0ZvcndhcmRlZD8uZm9yRWFjaChwb3J0ID0+IHRoaXMuYXV0b0ZvcndhcmRlZC5hZGQocG9ydCkpO1xuXHRcdHRoaXMuaW5pdGlhbGl6ZSgpO1xuXHR9XG5cblx0Z2V0IGZvcndhcmRlZCgpOiBTZXQ8c3RyaW5nPiB7XG5cdFx0cmV0dXJuIHRoaXMuYXV0b0ZvcndhcmRlZDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaW5pdGlhbGl6ZSgpIHtcblx0XHRpZiAoIXRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsLmVudmlyb25tZW50VHVubmVsc1NldCkge1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS50dW5uZWxNb2RlbC5vbkVudmlyb25tZW50VHVubmVsc1NldCgoKSA9PiByZXNvbHZlKCkpKTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihhc3luYyAoZSkgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oUE9SVF9BVVRPX0ZPUldBUkRfU0VUVElORykpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5zdGFydFN0b3BDYW5kaWRhdGVMaXN0ZW5lcigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMucG9ydHNGZWF0dXJlcyA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLm9uRW5hYmxlZFBvcnRzRmVhdHVyZXMoYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgdGhpcy5zdGFydFN0b3BDYW5kaWRhdGVMaXN0ZW5lcigpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuc3RhcnRTdG9wQ2FuZGlkYXRlTGlzdGVuZXIoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc3RhcnRTdG9wQ2FuZGlkYXRlTGlzdGVuZXIoKSB7XG5cdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoUE9SVF9BVVRPX0ZPUldBUkRfU0VUVElORykpIHtcblx0XHRcdGF3YWl0IHRoaXMuc3RhcnRDYW5kaWRhdGVMaXN0ZW5lcigpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnN0b3BDYW5kaWRhdGVMaXN0ZW5lcigpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc3RvcENhbmRpZGF0ZUxpc3RlbmVyKCkge1xuXHRcdGlmICh0aGlzLmNhbmRpZGF0ZUxpc3RlbmVyKSB7XG5cdFx0XHR0aGlzLmNhbmRpZGF0ZUxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuY2FuZGlkYXRlTGlzdGVuZXIgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzdGFydENhbmRpZGF0ZUxpc3RlbmVyKCkge1xuXHRcdGlmICh0aGlzLmNhbmRpZGF0ZUxpc3RlbmVyIHx8ICh0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS5wb3J0c0ZlYXR1cmVzRW5hYmxlZCAhPT0gUG9ydHNFbmFibGVtZW50LkFkZGl0aW9uYWxGZWF0dXJlcykpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5wb3J0c0ZlYXR1cmVzPy5kaXNwb3NlKCk7XG5cblx0XHQvLyBDYXB0dXJlIGxpc3Qgb2Ygc3RhcnRpbmcgY2FuZGlkYXRlcyBzbyB3ZSBkb24ndCBhdXRvIGZvcndhcmQgdGhlbSBsYXRlci5cblx0XHRhd2FpdCB0aGlzLnNldEluaXRpYWxDYW5kaWRhdGVzKCk7XG5cblx0XHQvLyBOZWVkIHRvIGNoZWNrIHRoZSBzZXR0aW5nIGFnYWluLCBzaW5jZSBpdCBtYXkgaGF2ZSBjaGFuZ2VkIHdoaWxlIHdlIHdhaXRlZCBmb3IgdGhlIGluaXRpYWwgY2FuZGlkYXRlcyB0byBiZSBzZXQuXG5cdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoUE9SVF9BVVRPX0ZPUldBUkRfU0VUVElORykpIHtcblx0XHRcdHRoaXMuY2FuZGlkYXRlTGlzdGVuZXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS50dW5uZWxNb2RlbC5vbkNhbmRpZGF0ZXNDaGFuZ2VkKHRoaXMuaGFuZGxlQ2FuZGlkYXRlVXBkYXRlLCB0aGlzKSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzZXRJbml0aWFsQ2FuZGlkYXRlcygpIHtcblx0XHRpZiAoIXRoaXMubmVlZHNJbml0aWFsQ2FuZGlkYXRlcykge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmRlYnVnKGBGb3J3YXJkZWRQb3J0czogKFByb2NGb3J3YXJkaW5nKSBOb3Qgc2V0dGluZyBpbml0aWFsIGNhbmRpZGF0ZXNgKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0bGV0IHN0YXJ0aW5nQ2FuZGlkYXRlcyA9IHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsLmNhbmRpZGF0ZXNPclVuZGVmaW5lZDtcblx0XHRpZiAoIXN0YXJ0aW5nQ2FuZGlkYXRlcykge1xuXHRcdFx0YXdhaXQgbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS50dW5uZWxNb2RlbC5vbkNhbmRpZGF0ZXNDaGFuZ2VkKCgpID0+IHJlc29sdmUoKSkpO1xuXHRcdFx0c3RhcnRpbmdDYW5kaWRhdGVzID0gdGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWwuY2FuZGlkYXRlcztcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IHZhbHVlIG9mIHN0YXJ0aW5nQ2FuZGlkYXRlcykge1xuXHRcdFx0dGhpcy5pbml0aWFsQ2FuZGlkYXRlcy5hZGQobWFrZUFkZHJlc3ModmFsdWUuaG9zdCwgdmFsdWUucG9ydCkpO1xuXHRcdH1cblx0XHR0aGlzLmxvZ1NlcnZpY2UuZGVidWcoYEZvcndhcmRlZFBvcnRzOiAoUHJvY0ZvcndhcmRpbmcpIEluaXRpYWwgY2FuZGlkYXRlcyBzZXQgdG8gJHtzdGFydGluZ0NhbmRpZGF0ZXMubWFwKGNhbmRpZGF0ZSA9PiBjYW5kaWRhdGUucG9ydCkuam9pbignLCAnKX1gKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZm9yd2FyZENhbmRpZGF0ZXMoKTogUHJvbWlzZTxSZW1vdGVUdW5uZWxbXSB8IHVuZGVmaW5lZD4ge1xuXHRcdGxldCBhdHRyaWJ1dGVzOiBNYXA8bnVtYmVyLCBBdHRyaWJ1dGVzPiB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBhbGxUdW5uZWxzOiBSZW1vdGVUdW5uZWxbXSA9IFtdO1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgRm9yd2FyZGVkUG9ydHM6IChQcm9jRm9yd2FyZGluZykgQXR0ZW1wdGluZyB0byBmb3J3YXJkICR7dGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWwuY2FuZGlkYXRlcy5sZW5ndGh9IGNhbmRpZGF0ZXNgKTtcblx0XHRmb3IgKGNvbnN0IHZhbHVlIG9mIHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsLmNhbmRpZGF0ZXMpIHtcblx0XHRcdGlmICghdmFsdWUuZGV0YWlsKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgRm9yd2FyZGVkUG9ydHM6IChQcm9jRm9yd2FyZGluZykgUG9ydCAke3ZhbHVlLnBvcnR9IG1pc3NpbmcgZGV0YWlsYCk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWF0dHJpYnV0ZXMpIHtcblx0XHRcdFx0YXR0cmlidXRlcyA9IGF3YWl0IHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsLmdldEF0dHJpYnV0ZXModGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWwuY2FuZGlkYXRlcyk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHBvcnRBdHRyaWJ1dGVzID0gYXR0cmlidXRlcz8uZ2V0KHZhbHVlLnBvcnQpO1xuXG5cdFx0XHRjb25zdCBhZGRyZXNzID0gbWFrZUFkZHJlc3ModmFsdWUuaG9zdCwgdmFsdWUucG9ydCk7XG5cdFx0XHRpZiAodGhpcy5pbml0aWFsQ2FuZGlkYXRlcy5oYXMoYWRkcmVzcykgJiYgKHBvcnRBdHRyaWJ1dGVzPy5vbkF1dG9Gb3J3YXJkID09PSB1bmRlZmluZWQpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMubm90aWZpZWRPbmx5LmhhcyhhZGRyZXNzKSB8fCB0aGlzLmF1dG9Gb3J3YXJkZWQuaGFzKGFkZHJlc3MpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgYWxyZWFkeUZvcndhcmRlZCA9IG1hcEhhc0FkZHJlc3NMb2NhbGhvc3RPckFsbEludGVyZmFjZXModGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWwuZm9yd2FyZGVkLCB2YWx1ZS5ob3N0LCB2YWx1ZS5wb3J0KTtcblx0XHRcdGlmIChtYXBIYXNBZGRyZXNzTG9jYWxob3N0T3JBbGxJbnRlcmZhY2VzKHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsLmRldGVjdGVkLCB2YWx1ZS5ob3N0LCB2YWx1ZS5wb3J0KSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHBvcnRBdHRyaWJ1dGVzPy5vbkF1dG9Gb3J3YXJkID09PSBPblBvcnRGb3J3YXJkLklnbm9yZSkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYEZvcndhcmRlZFBvcnRzOiAoUHJvY0ZvcndhcmRpbmcpIFBvcnQgJHt2YWx1ZS5wb3J0fSBpcyBpZ25vcmVkYCk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZm9yd2FyZGVkID0gYXdhaXQgdGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UuZm9yd2FyZCh7IHJlbW90ZTogdmFsdWUsIHNvdXJjZTogQXV0b1R1bm5lbFNvdXJjZSB9LCBwb3J0QXR0cmlidXRlcyA/PyBudWxsKTtcblx0XHRcdGlmICghYWxyZWFkeUZvcndhcmRlZCAmJiBmb3J3YXJkZWQpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBGb3J3YXJkZWRQb3J0czogKFByb2NGb3J3YXJkaW5nKSBQb3J0ICR7dmFsdWUucG9ydH0gaGFzIGJlZW4gZm9yd2FyZGVkYCk7XG5cdFx0XHRcdHRoaXMuYXV0b0ZvcndhcmRlZC5hZGQoYWRkcmVzcyk7XG5cdFx0XHR9IGVsc2UgaWYgKGZvcndhcmRlZCkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYEZvcndhcmRlZFBvcnRzOiAoUHJvY0ZvcndhcmRpbmcpIFBvcnQgJHt2YWx1ZS5wb3J0fSBoYXMgYmVlbiBub3RpZmllZGApO1xuXHRcdFx0XHR0aGlzLm5vdGlmaWVkT25seS5hZGQoYWRkcmVzcyk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZm9yd2FyZGVkICYmICh0eXBlb2YgZm9yd2FyZGVkICE9PSAnc3RyaW5nJykpIHtcblx0XHRcdFx0YWxsVHVubmVscy5wdXNoKGZvcndhcmRlZCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgRm9yd2FyZGVkUG9ydHM6IChQcm9jRm9yd2FyZGluZykgRm9yd2FyZGVkICR7YWxsVHVubmVscy5sZW5ndGh9IGNhbmRpZGF0ZXNgKTtcblx0XHRpZiAoYWxsVHVubmVscy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiBhbGxUdW5uZWxzO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBoYW5kbGVDYW5kaWRhdGVVcGRhdGUocmVtb3ZlZDogTWFwPHN0cmluZywgeyBob3N0OiBzdHJpbmc7IHBvcnQ6IG51bWJlciB9Pikge1xuXHRcdGNvbnN0IHJlbW92ZWRQb3J0czogbnVtYmVyW10gPSBbXTtcblx0XHRsZXQgYXV0b0ZvcndhcmRlZDogTWFwPHN0cmluZywgc3RyaW5nIHwgVHVubmVsPjtcblx0XHRpZiAodGhpcy51bmZvcndhcmRPbmx5KSB7XG5cdFx0XHRhdXRvRm9yd2FyZGVkID0gbmV3IE1hcCgpO1xuXHRcdFx0Zm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS50dW5uZWxNb2RlbC5mb3J3YXJkZWQuZW50cmllcygpKSB7XG5cdFx0XHRcdGlmIChlbnRyeVsxXS5zb3VyY2Uuc291cmNlID09PSBUdW5uZWxTb3VyY2UuQXV0bykge1xuXHRcdFx0XHRcdGF1dG9Gb3J3YXJkZWQuc2V0KGVudHJ5WzBdLCBlbnRyeVsxXSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0YXV0b0ZvcndhcmRlZCA9IG5ldyBNYXAodGhpcy5hdXRvRm9yd2FyZGVkLmVudHJpZXMoKSk7XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCByZW1vdmVkUG9ydCBvZiByZW1vdmVkKSB7XG5cdFx0XHRjb25zdCBrZXkgPSByZW1vdmVkUG9ydFswXTtcblx0XHRcdGxldCB2YWx1ZSA9IHJlbW92ZWRQb3J0WzFdO1xuXHRcdFx0Y29uc3QgZm9yd2FyZGVkVmFsdWUgPSBtYXBIYXNBZGRyZXNzTG9jYWxob3N0T3JBbGxJbnRlcmZhY2VzKGF1dG9Gb3J3YXJkZWQsIHZhbHVlLmhvc3QsIHZhbHVlLnBvcnQpO1xuXHRcdFx0aWYgKGZvcndhcmRlZFZhbHVlKSB7XG5cdFx0XHRcdGlmICh0eXBlb2YgZm9yd2FyZGVkVmFsdWUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0dGhpcy5hdXRvRm9yd2FyZGVkLmRlbGV0ZShrZXkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHZhbHVlID0geyBob3N0OiBmb3J3YXJkZWRWYWx1ZS5yZW1vdGVIb3N0LCBwb3J0OiBmb3J3YXJkZWRWYWx1ZS5yZW1vdGVQb3J0IH07XG5cdFx0XHRcdH1cblx0XHRcdFx0YXdhaXQgdGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UuY2xvc2UodmFsdWUsIFR1bm5lbENsb3NlUmVhc29uLkF1dG9Gb3J3YXJkRW5kKTtcblx0XHRcdFx0cmVtb3ZlZFBvcnRzLnB1c2godmFsdWUucG9ydCk7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMubm90aWZpZWRPbmx5LmhhcyhrZXkpKSB7XG5cdFx0XHRcdHRoaXMubm90aWZpZWRPbmx5LmRlbGV0ZShrZXkpO1xuXHRcdFx0XHRyZW1vdmVkUG9ydHMucHVzaCh2YWx1ZS5wb3J0KTtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5pbml0aWFsQ2FuZGlkYXRlcy5oYXMoa2V5KSkge1xuXHRcdFx0XHR0aGlzLmluaXRpYWxDYW5kaWRhdGVzLmRlbGV0ZShrZXkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLnVuZm9yd2FyZE9ubHkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAocmVtb3ZlZFBvcnRzLmxlbmd0aCA+IDApIHtcblx0XHRcdGF3YWl0IHRoaXMubm90aWZpZXIuaGlkZShyZW1vdmVkUG9ydHMpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHR1bm5lbHMgPSBhd2FpdCB0aGlzLmZvcndhcmRDYW5kaWRhdGVzKCk7XG5cdFx0aWYgKHR1bm5lbHMpIHtcblx0XHRcdGF3YWl0IHRoaXMubm90aWZpZXIuZG9BY3Rpb24odHVubmVscyk7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUlBLFlBQVksU0FBUztBQUNyQixTQUFTLFlBQXlCLHlCQUF5QjtBQUUzRCxTQUFTLFlBQW9FLDZCQUE2QjtBQUMxRyxTQUFTLHdCQUF3Qiw0QkFBNEIsMkJBQTJCLDBCQUEwQixpQ0FBaUMsaUNBQWlDLGtDQUFrQyxpQkFBaUIsMEJBQTBCLHNCQUFzQjtBQUN2UixTQUFxQixrQkFBa0IsK0JBQStCLDJCQUEyQixhQUFhLHVDQUF1QyxlQUF1QixtQkFBbUIsb0JBQW9CO0FBQ25OLFNBQVMsbUJBQW1CLHlCQUF5QixhQUFhLHVCQUF1QixpQkFBaUIseUJBQXlCLGlDQUFpQztBQUNwSyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLG9DQUFvQztBQUM3QyxTQUFTLGdCQUFnQjtBQUN6QixTQUFtRCxtQkFBbUIsMEJBQTBCO0FBQ2hHLFNBQVMsaUJBQWlCO0FBQzFCLE9BQU8sY0FBYztBQUNyQixTQUFTLDJCQUFrRDtBQUMzRCxTQUE4Qiw0QkFBMkM7QUFDekUsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUywy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
