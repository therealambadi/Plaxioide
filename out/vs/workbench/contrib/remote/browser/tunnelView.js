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
import "./media/tunnelView.css";
import * as nls from "../../../../nls.js";
import * as dom from "../../../../base/browser/dom.js";
import { IViewDescriptorService } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IContextMenuService, IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IContextKeyService, RawContextKey, ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { ICommandService, CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { Event } from "../../../../base/common/event.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { Disposable, toDisposable, dispose, DisposableStore } from "../../../../base/common/lifecycle.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { IconLabel } from "../../../../base/browser/ui/iconLabel/iconLabel.js";
import { ActionRunner } from "../../../../base/common/actions.js";
import { IMenuService, MenuId, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { createActionViewItem, getFlatActionBarActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { IRemoteExplorerService, TunnelType, TUNNEL_VIEW_ID, TunnelEditId } from "../../../services/remote/common/remoteExplorerService.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { InputBox, MessageType } from "../../../../base/browser/ui/inputbox/inputBox.js";
import { createSingleCallFunction } from "../../../../base/common/functional.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { ViewPane } from "../../../browser/parts/views/viewPane.js";
import { URI } from "../../../../base/common/uri.js";
import { isAllInterfaces, isLocalhost, ITunnelService, TunnelPrivacyId, TunnelProtocol } from "../../../../platform/tunnel/common/tunnel.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { copyAddressIcon, forwardedPortWithoutProcessIcon, forwardedPortWithProcessIcon, forwardPortIcon, labelPortIcon, openBrowserIcon, openPreviewIcon, portsViewIcon, privatePortIcon, stopForwardIcon } from "./remoteIcons.js";
import { IExternalUriOpenerService } from "../../externalUriOpener/common/externalUriOpenerService.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { WorkbenchTable } from "../../../../platform/list/browser/listService.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { registerColor } from "../../../../platform/theme/common/colorRegistry.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { STATUS_BAR_REMOTE_ITEM_BACKGROUND } from "../../../common/theme.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { defaultButtonStyles, defaultInputBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { TunnelCloseReason, TunnelSource, forwardedPortsViewEnabled, makeAddress, mapHasAddressLocalhostOrAllInterfaces, parseAddress } from "../../../services/remote/common/tunnelModel.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
const openPreviewEnabledContext = new RawContextKey("openPreviewEnabled", false);
class TunnelTreeVirtualDelegate {
  constructor(remoteExplorerService) {
    this.remoteExplorerService = remoteExplorerService;
    this.headerRowHeight = 22;
  }
  getHeight(row) {
    return row.tunnelType === TunnelType.Add && !this.remoteExplorerService.getEditableData(void 0) ? 30 : 22;
  }
}
let TunnelViewModel = class {
  constructor(remoteExplorerService, tunnelService) {
    this.remoteExplorerService = remoteExplorerService;
    this.tunnelService = tunnelService;
    this._candidates = /* @__PURE__ */ new Map();
    this.input = {
      label: nls.localize("remote.tunnelsView.addPort", "Add Port"),
      icon: void 0,
      tunnelType: TunnelType.Add,
      hasRunningProcess: false,
      remoteHost: "",
      remotePort: 0,
      processDescription: "",
      tooltipPostfix: "",
      iconTooltip: "",
      portTooltip: "",
      processTooltip: "",
      originTooltip: "",
      privacyTooltip: "",
      source: { source: TunnelSource.User, description: "" },
      protocol: TunnelProtocol.Http,
      privacy: {
        id: TunnelPrivacyId.Private,
        themeIcon: privatePortIcon.id,
        label: nls.localize("tunnelPrivacy.private", "Private")
      },
      strip: () => void 0
    };
    this.model = remoteExplorerService.tunnelModel;
    this.onForwardedPortsChanged = Event.any(this.model.onForwardPort, this.model.onClosePort, this.model.onPortName, this.model.onCandidatesChanged);
  }
  get all() {
    const result = [];
    this._candidates = /* @__PURE__ */ new Map();
    this.model.candidates.forEach((candidate) => {
      this._candidates.set(makeAddress(candidate.host, candidate.port), candidate);
    });
    if (this.model.forwarded.size > 0 || this.remoteExplorerService.getEditableData(void 0)) {
      result.push(...this.forwarded);
    }
    if (this.model.detected.size > 0) {
      result.push(...this.detected);
    }
    result.push(this.input);
    return result;
  }
  addProcessInfoFromCandidate(tunnelItem) {
    const key = makeAddress(tunnelItem.remoteHost, tunnelItem.remotePort);
    if (this._candidates.has(key)) {
      tunnelItem.processDescription = this._candidates.get(key).detail;
    }
  }
  get forwarded() {
    const forwarded = Array.from(this.model.forwarded.values()).map((tunnel) => {
      const tunnelItem = TunnelItem.createFromTunnel(this.remoteExplorerService, this.tunnelService, tunnel);
      this.addProcessInfoFromCandidate(tunnelItem);
      return tunnelItem;
    }).sort((a, b) => {
      if (a.remotePort === b.remotePort) {
        return a.remoteHost < b.remoteHost ? -1 : 1;
      } else {
        return a.remotePort < b.remotePort ? -1 : 1;
      }
    });
    return forwarded;
  }
  get detected() {
    return Array.from(this.model.detected.values()).map((tunnel) => {
      const tunnelItem = TunnelItem.createFromTunnel(this.remoteExplorerService, this.tunnelService, tunnel, TunnelType.Detected, false);
      this.addProcessInfoFromCandidate(tunnelItem);
      return tunnelItem;
    });
  }
  isEmpty() {
    return this.detected.length === 0 && (this.forwarded.length === 0 || this.forwarded.length === 1 && this.forwarded[0].tunnelType === TunnelType.Add && !this.remoteExplorerService.getEditableData(void 0));
  }
};
TunnelViewModel = __decorateClass([
  __decorateParam(0, IRemoteExplorerService),
  __decorateParam(1, ITunnelService)
], TunnelViewModel);
function emptyCell(item) {
  return { label: "", tunnel: item, editId: TunnelEditId.None, tooltip: "" };
}
class IconColumn {
  constructor() {
    this.label = "";
    this.tooltip = "";
    this.weight = 1;
    this.minimumWidth = 40;
    this.maximumWidth = 40;
    this.templateId = "actionbar";
  }
  project(row) {
    if (row.tunnelType === TunnelType.Add) {
      return emptyCell(row);
    }
    const icon = row.processDescription ? forwardedPortWithProcessIcon : forwardedPortWithoutProcessIcon;
    let tooltip = "";
    if (row instanceof TunnelItem) {
      tooltip = `${row.iconTooltip} ${row.tooltipPostfix}`;
    }
    return {
      label: "",
      icon,
      tunnel: row,
      editId: TunnelEditId.None,
      tooltip
    };
  }
}
class PortColumn {
  constructor() {
    this.label = nls.localize("tunnel.portColumn.label", "Port");
    this.tooltip = nls.localize("tunnel.portColumn.tooltip", "The label and remote port number of the forwarded port.");
    this.weight = 1;
    this.templateId = "actionbar";
  }
  project(row) {
    const isAdd = row.tunnelType === TunnelType.Add;
    const label = row.label;
    let tooltip = "";
    if (row instanceof TunnelItem && !isAdd) {
      tooltip = `${row.portTooltip} ${row.tooltipPostfix}`;
    } else {
      tooltip = label;
    }
    return {
      label,
      tunnel: row,
      menuId: MenuId.TunnelPortInline,
      editId: row.tunnelType === TunnelType.Add ? TunnelEditId.New : TunnelEditId.Label,
      tooltip
    };
  }
}
class LocalAddressColumn {
  constructor() {
    this.label = nls.localize("tunnel.addressColumn.label", "Forwarded Address");
    this.tooltip = nls.localize("tunnel.addressColumn.tooltip", "The address that the forwarded port is available at.");
    this.weight = 1;
    this.templateId = "actionbar";
  }
  project(row) {
    if (row.tunnelType === TunnelType.Add) {
      return emptyCell(row);
    }
    const label = row.localAddress ?? "";
    let tooltip = label;
    if (row instanceof TunnelItem) {
      tooltip = row.tooltipPostfix;
    }
    return {
      label,
      menuId: MenuId.TunnelLocalAddressInline,
      tunnel: row,
      editId: TunnelEditId.LocalPort,
      tooltip,
      markdownTooltip: label ? LocalAddressColumn.getHoverText(label) : void 0
    };
  }
  static getHoverText(localAddress) {
    return function(configurationService) {
      const editorConf = configurationService.getValue("editor");
      let clickLabel = "";
      if (editorConf.multiCursorModifier === "ctrlCmd") {
        if (isMacintosh) {
          clickLabel = nls.localize("portsLink.followLinkAlt.mac", "option + click");
        } else {
          clickLabel = nls.localize("portsLink.followLinkAlt", "alt + click");
        }
      } else {
        if (isMacintosh) {
          clickLabel = nls.localize("portsLink.followLinkCmd", "cmd + click");
        } else {
          clickLabel = nls.localize("portsLink.followLinkCtrl", "ctrl + click");
        }
      }
      const markdown = new MarkdownString("", true);
      const uri = localAddress.startsWith("http") ? localAddress : `http://${localAddress}`;
      return markdown.appendLink(uri, "Follow link").appendMarkdown(` (${clickLabel})`);
    };
  }
}
class RunningProcessColumn {
  constructor() {
    this.label = nls.localize("tunnel.processColumn.label", "Running Process");
    this.tooltip = nls.localize("tunnel.processColumn.tooltip", "The command line of the process that is using the port.");
    this.weight = 2;
    this.templateId = "actionbar";
  }
  project(row) {
    if (row.tunnelType === TunnelType.Add) {
      return emptyCell(row);
    }
    const label = row.processDescription ?? "";
    return { label, tunnel: row, editId: TunnelEditId.None, tooltip: row instanceof TunnelItem ? row.processTooltip : "" };
  }
}
class OriginColumn {
  constructor() {
    this.label = nls.localize("tunnel.originColumn.label", "Origin");
    this.tooltip = nls.localize("tunnel.originColumn.tooltip", "The source that a forwarded port originates from. Can be an extension, user forwarded, statically forwarded, or automatically forwarded.");
    this.weight = 1;
    this.templateId = "actionbar";
  }
  project(row) {
    if (row.tunnelType === TunnelType.Add) {
      return emptyCell(row);
    }
    const label = row.source.description;
    const tooltip = `${row instanceof TunnelItem ? row.originTooltip : ""}. ${row instanceof TunnelItem ? row.tooltipPostfix : ""}`;
    return { label, menuId: MenuId.TunnelOriginInline, tunnel: row, editId: TunnelEditId.None, tooltip };
  }
}
class PrivacyColumn {
  constructor() {
    this.label = nls.localize("tunnel.privacyColumn.label", "Visibility");
    this.tooltip = nls.localize("tunnel.privacyColumn.tooltip", "The availability of the forwarded port.");
    this.weight = 1;
    this.templateId = "actionbar";
  }
  project(row) {
    if (row.tunnelType === TunnelType.Add) {
      return emptyCell(row);
    }
    const label = row.privacy?.label;
    let tooltip = "";
    if (row instanceof TunnelItem) {
      tooltip = `${row.privacy.label} ${row.tooltipPostfix}`;
    }
    return { label, tunnel: row, icon: { id: row.privacy.themeIcon }, editId: TunnelEditId.None, tooltip };
  }
}
let ActionBarRenderer = class extends Disposable {
  constructor(instantiationService, contextKeyService, menuService, contextViewService, remoteExplorerService, commandService, configurationService) {
    super();
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.menuService = menuService;
    this.contextViewService = contextViewService;
    this.remoteExplorerService = remoteExplorerService;
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.templateId = "actionbar";
    this._hoverDelegate = getDefaultHoverDelegate("mouse");
  }
  set actionRunner(actionRunner) {
    this._actionRunner = actionRunner;
  }
  renderTemplate(container) {
    const cell = dom.append(container, dom.$(".ports-view-actionbar-cell"));
    const icon = dom.append(cell, dom.$(".ports-view-actionbar-cell-icon"));
    const label = new IconLabel(
      cell,
      {
        supportHighlights: true,
        hoverDelegate: this._hoverDelegate
      }
    );
    const actionsContainer = dom.append(cell, dom.$(".actions"));
    const actionBar = new ActionBar(actionsContainer, {
      actionViewItemProvider: createActionViewItem.bind(void 0, this.instantiationService),
      hoverDelegate: this._hoverDelegate
    });
    return { label, icon, actionBar, container: cell, elementDisposable: Disposable.None };
  }
  renderElement(element, index, templateData) {
    templateData.actionBar.clear();
    templateData.icon.className = "ports-view-actionbar-cell-icon";
    templateData.icon.style.display = "none";
    templateData.label.setLabel("");
    templateData.label.element.style.display = "none";
    templateData.container.style.height = "22px";
    if (templateData.button) {
      templateData.button.element.style.display = "none";
      templateData.button.dispose();
    }
    templateData.container.style.paddingLeft = "0px";
    templateData.elementDisposable.dispose();
    let editableData;
    if (element.editId === TunnelEditId.New && (editableData = this.remoteExplorerService.getEditableData(void 0))) {
      this.renderInputBox(templateData.container, editableData);
    } else {
      editableData = this.remoteExplorerService.getEditableData(element.tunnel, element.editId);
      if (editableData) {
        this.renderInputBox(templateData.container, editableData);
      } else if (element.tunnel.tunnelType === TunnelType.Add && element.menuId === MenuId.TunnelPortInline) {
        this.renderButton(element, templateData);
      } else {
        this.renderActionBarItem(element, templateData);
      }
    }
  }
  renderButton(element, templateData) {
    templateData.container.style.paddingLeft = "7px";
    templateData.container.style.height = "28px";
    templateData.button = this._register(new Button(templateData.container, defaultButtonStyles));
    templateData.button.label = element.label;
    templateData.button.element.title = element.tooltip;
    this._register(templateData.button.onDidClick(() => {
      this.commandService.executeCommand(ForwardPortAction.INLINE_ID);
    }));
  }
  tunnelContext(tunnel) {
    let context;
    if (tunnel instanceof TunnelItem) {
      context = tunnel.strip();
    }
    if (!context) {
      context = {
        tunnelType: tunnel.tunnelType,
        remoteHost: tunnel.remoteHost,
        remotePort: tunnel.remotePort,
        localAddress: tunnel.localAddress,
        protocol: tunnel.protocol,
        localUri: tunnel.localUri,
        localPort: tunnel.localPort,
        name: tunnel.name,
        closeable: tunnel.closeable,
        source: tunnel.source,
        privacy: tunnel.privacy,
        processDescription: tunnel.processDescription,
        label: tunnel.label
      };
    }
    return context;
  }
  renderActionBarItem(element, templateData) {
    templateData.label.element.style.display = "flex";
    templateData.label.setLabel(
      element.label,
      void 0,
      {
        title: element.markdownTooltip ? { markdown: element.markdownTooltip(this.configurationService), markdownNotSupportedFallback: element.tooltip } : element.tooltip,
        extraClasses: element.menuId === MenuId.TunnelLocalAddressInline ? ["ports-view-actionbar-cell-localaddress"] : void 0
      }
    );
    templateData.actionBar.context = this.tunnelContext(element.tunnel);
    templateData.container.style.paddingLeft = "10px";
    const context = [
      ["view", TUNNEL_VIEW_ID],
      [TunnelTypeContextKey.key, element.tunnel.tunnelType],
      [TunnelCloseableContextKey.key, element.tunnel.closeable],
      [TunnelPrivacyContextKey.key, element.tunnel.privacy.id],
      [TunnelProtocolContextKey.key, element.tunnel.protocol]
    ];
    const contextKeyService = this.contextKeyService.createOverlay(context);
    const disposableStore = new DisposableStore();
    templateData.elementDisposable = disposableStore;
    if (element.menuId) {
      const menu = disposableStore.add(this.menuService.createMenu(element.menuId, contextKeyService));
      let actions = getFlatActionBarActions(menu.getActions({ shouldForwardArgs: true }));
      if (actions) {
        const labelActions = actions.filter((action) => action.id.toLowerCase().indexOf("label") >= 0);
        if (labelActions.length > 1) {
          labelActions.sort((a, b) => a.label.length - b.label.length);
          labelActions.pop();
          actions = actions.filter((action) => labelActions.indexOf(action) < 0);
        }
        templateData.actionBar.push(actions, { icon: true, label: false });
        if (this._actionRunner) {
          templateData.actionBar.actionRunner = this._actionRunner;
        }
      }
    }
    if (element.icon) {
      templateData.icon.className = `ports-view-actionbar-cell-icon ${ThemeIcon.asClassName(element.icon)}`;
      templateData.icon.title = element.tooltip;
      templateData.icon.style.display = "inline";
    }
  }
  renderInputBox(container, editableData) {
    if (this.inputDone) {
      this.inputDone(false, false);
      this.inputDone = void 0;
    }
    container.style.paddingLeft = "5px";
    const value = editableData.startingValue || "";
    const inputBox = new InputBox(container, this.contextViewService, {
      ariaLabel: nls.localize("remote.tunnelsView.input", "Press Enter to confirm or Escape to cancel."),
      validationOptions: {
        validation: (value2) => {
          const message = editableData.validationMessage(value2);
          if (!message) {
            return null;
          }
          return {
            content: message.content,
            formatContent: true,
            type: message.severity === Severity.Error ? MessageType.ERROR : MessageType.INFO
          };
        }
      },
      placeholder: editableData.placeholder || "",
      inputBoxStyles: defaultInputBoxStyles
    });
    inputBox.value = value;
    inputBox.focus();
    inputBox.select({ start: 0, end: editableData.startingValue ? editableData.startingValue.length : 0 });
    const done = createSingleCallFunction(async (success, finishEditing) => {
      dispose(toDispose);
      if (this.inputDone) {
        this.inputDone = void 0;
      }
      inputBox.element.style.display = "none";
      const inputValue = inputBox.value;
      if (finishEditing) {
        return editableData.onFinish(inputValue, success);
      }
    });
    this.inputDone = done;
    const toDispose = [
      inputBox,
      dom.addStandardDisposableListener(inputBox.inputElement, dom.EventType.KEY_DOWN, async (e) => {
        if (e.equals(KeyCode.Enter)) {
          e.stopPropagation();
          if (inputBox.validate() !== MessageType.ERROR) {
            return done(true, true);
          } else {
            return done(false, true);
          }
        } else if (e.equals(KeyCode.Escape)) {
          e.preventDefault();
          e.stopPropagation();
          return done(false, true);
        }
      }),
      dom.addDisposableListener(inputBox.inputElement, dom.EventType.BLUR, () => {
        return done(inputBox.validate() !== MessageType.ERROR, true);
      })
    ];
    return toDisposable(() => {
      done(false, false);
    });
  }
  disposeElement(element, index, templateData, height) {
    templateData.elementDisposable.dispose();
  }
  disposeTemplate(templateData) {
    templateData.label.dispose();
    templateData.actionBar.dispose();
    templateData.elementDisposable.dispose();
    templateData.button?.dispose();
  }
};
ActionBarRenderer = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IMenuService),
  __decorateParam(3, IContextViewService),
  __decorateParam(4, IRemoteExplorerService),
  __decorateParam(5, ICommandService),
  __decorateParam(6, IConfigurationService)
], ActionBarRenderer);
class TunnelItem {
  constructor(tunnelType, remoteHost, remotePort, source, hasRunningProcess, protocol, localUri, localAddress, localPort, closeable, name, runningProcess, pid, _privacy, remoteExplorerService, tunnelService) {
    this.tunnelType = tunnelType;
    this.remoteHost = remoteHost;
    this.remotePort = remotePort;
    this.source = source;
    this.hasRunningProcess = hasRunningProcess;
    this.protocol = protocol;
    this.localUri = localUri;
    this.localAddress = localAddress;
    this.localPort = localPort;
    this.closeable = closeable;
    this.name = name;
    this.runningProcess = runningProcess;
    this.pid = pid;
    this._privacy = _privacy;
    this.remoteExplorerService = remoteExplorerService;
    this.tunnelService = tunnelService;
  }
  static createFromTunnel(remoteExplorerService, tunnelService, tunnel, type = TunnelType.Forwarded, closeable) {
    return new TunnelItem(
      type,
      tunnel.remoteHost,
      tunnel.remotePort,
      tunnel.source,
      !!tunnel.hasRunningProcess,
      tunnel.protocol,
      tunnel.localUri,
      tunnel.localAddress,
      tunnel.localPort,
      closeable === void 0 ? tunnel.closeable : closeable,
      tunnel.name,
      tunnel.runningProcess,
      tunnel.pid,
      tunnel.privacy,
      remoteExplorerService,
      tunnelService
    );
  }
  /**
   * Removes all non-serializable properties from the tunnel
   * @returns A new TunnelItem without any services
   */
  strip() {
    return new TunnelItem(
      this.tunnelType,
      this.remoteHost,
      this.remotePort,
      this.source,
      this.hasRunningProcess,
      this.protocol,
      this.localUri,
      this.localAddress,
      this.localPort,
      this.closeable,
      this.name,
      this.runningProcess,
      this.pid,
      this._privacy
    );
  }
  get label() {
    if (this.tunnelType === TunnelType.Add && this.name) {
      return this.name;
    }
    const portNumberLabel = isLocalhost(this.remoteHost) || isAllInterfaces(this.remoteHost) ? `${this.remotePort}` : `${this.remoteHost}:${this.remotePort}`;
    if (this.name) {
      return `${this.name} (${portNumberLabel})`;
    } else {
      return portNumberLabel;
    }
  }
  set processDescription(description) {
    this.runningProcess = description;
  }
  get processDescription() {
    let description = "";
    if (this.runningProcess) {
      if (this.pid && this.remoteExplorerService?.namedProcesses.has(this.pid)) {
        description = this.remoteExplorerService.namedProcesses.get(this.pid);
      } else {
        description = this.runningProcess.replace(/\0/g, " ").trim();
      }
      if (this.pid) {
        description += ` (${this.pid})`;
      }
    } else if (this.hasRunningProcess) {
      description = nls.localize("tunnelView.runningProcess.inacessable", "Process information unavailable");
    }
    return description;
  }
  get tooltipPostfix() {
    let information;
    if (this.localAddress) {
      information = nls.localize("remote.tunnel.tooltipForwarded", "Remote port {0}:{1} forwarded to local address {2}. ", this.remoteHost, this.remotePort, this.localAddress);
    } else {
      information = nls.localize("remote.tunnel.tooltipCandidate", "Remote port {0}:{1} not forwarded. ", this.remoteHost, this.remotePort);
    }
    return information;
  }
  get iconTooltip() {
    const isAdd = this.tunnelType === TunnelType.Add;
    if (!isAdd) {
      return `${this.processDescription ? nls.localize("tunnel.iconColumn.running", "Port has running process.") : nls.localize("tunnel.iconColumn.notRunning", "No running process.")}`;
    } else {
      return this.label;
    }
  }
  get portTooltip() {
    const isAdd = this.tunnelType === TunnelType.Add;
    if (!isAdd) {
      return `${this.name ? nls.localize("remote.tunnel.tooltipName", "Port labeled {0}. ", this.name) : ""}`;
    } else {
      return "";
    }
  }
  get processTooltip() {
    return this.processDescription ?? "";
  }
  get originTooltip() {
    return this.source.description;
  }
  get privacy() {
    if (this.tunnelService?.privacyOptions) {
      return this.tunnelService?.privacyOptions.find((element) => element.id === this._privacy) ?? {
        id: "",
        themeIcon: Codicon.question.id,
        label: nls.localize("tunnelPrivacy.unknown", "Unknown")
      };
    } else {
      return {
        id: TunnelPrivacyId.Private,
        themeIcon: privatePortIcon.id,
        label: nls.localize("tunnelPrivacy.private", "Private")
      };
    }
  }
}
const TunnelTypeContextKey = new RawContextKey("tunnelType", TunnelType.Add, true);
const TunnelCloseableContextKey = new RawContextKey("tunnelCloseable", false, true);
const TunnelPrivacyContextKey = new RawContextKey("tunnelPrivacy", void 0, true);
const TunnelPrivacyEnabledContextKey = new RawContextKey("tunnelPrivacyEnabled", false, true);
const TunnelProtocolContextKey = new RawContextKey("tunnelProtocol", TunnelProtocol.Http, true);
const TunnelViewFocusContextKey = new RawContextKey("tunnelViewFocus", false, nls.localize("tunnel.focusContext", "Whether the Ports view has focus."));
const TunnelViewSelectionKeyName = "tunnelViewSelection";
const TunnelViewSelectionContextKey = new RawContextKey(TunnelViewSelectionKeyName, void 0, true);
const TunnelViewMultiSelectionKeyName = "tunnelViewMultiSelection";
const TunnelViewMultiSelectionContextKey = new RawContextKey(TunnelViewMultiSelectionKeyName, void 0, true);
const PortChangableContextKey = new RawContextKey("portChangable", false, true);
const ProtocolChangeableContextKey = new RawContextKey("protocolChangable", true, true);
let TunnelPanel = class extends ViewPane {
  constructor(viewModel, options, keybindingService, contextMenuService, contextKeyService, configurationService, instantiationService, viewDescriptorService, openerService, quickInputService, commandService, menuService, themeService, remoteExplorerService, hoverService, tunnelService, contextViewService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.viewModel = viewModel;
    this.quickInputService = quickInputService;
    this.commandService = commandService;
    this.menuService = menuService;
    this.remoteExplorerService = remoteExplorerService;
    this.tunnelService = tunnelService;
    this.contextViewService = contextViewService;
    this.tableDisposables = this._register(new DisposableStore());
    this.isEditing = false;
    // TODO: Should this be removed?
    //@ts-expect-error
    this.titleActions = [];
    this.lastFocus = [];
    this.height = 0;
    this.width = 0;
    this.tunnelTypeContext = TunnelTypeContextKey.bindTo(contextKeyService);
    this.tunnelCloseableContext = TunnelCloseableContextKey.bindTo(contextKeyService);
    this.tunnelPrivacyContext = TunnelPrivacyContextKey.bindTo(contextKeyService);
    this.tunnelPrivacyEnabledContext = TunnelPrivacyEnabledContextKey.bindTo(contextKeyService);
    this.tunnelPrivacyEnabledContext.set(tunnelService.canChangePrivacy);
    this.protocolChangableContextKey = ProtocolChangeableContextKey.bindTo(contextKeyService);
    this.protocolChangableContextKey.set(tunnelService.canChangeProtocol);
    this.tunnelProtocolContext = TunnelProtocolContextKey.bindTo(contextKeyService);
    this.tunnelViewFocusContext = TunnelViewFocusContextKey.bindTo(contextKeyService);
    this.tunnelViewSelectionContext = TunnelViewSelectionContextKey.bindTo(contextKeyService);
    this.tunnelViewMultiSelectionContext = TunnelViewMultiSelectionContextKey.bindTo(contextKeyService);
    this.portChangableContextKey = PortChangableContextKey.bindTo(contextKeyService);
    const overlayContextKeyService = this.contextKeyService.createOverlay([["view", TunnelPanel.ID]]);
    const titleMenu = this._register(this.menuService.createMenu(MenuId.TunnelTitle, overlayContextKeyService));
    const updateActions = () => {
      this.titleActions = getFlatActionBarActions(titleMenu.getActions());
      this.updateActions();
    };
    this._register(titleMenu.onDidChange(updateActions));
    updateActions();
    this._register(toDisposable(() => {
      this.titleActions = [];
    }));
    this.registerPrivacyActions();
    this._register(Event.once(this.tunnelService.onAddedTunnelProvider)(() => {
      let updated = false;
      if (this.tunnelPrivacyEnabledContext.get() === false) {
        this.tunnelPrivacyEnabledContext.set(tunnelService.canChangePrivacy);
        updated = true;
      }
      if (this.protocolChangableContextKey.get() === true) {
        this.protocolChangableContextKey.set(tunnelService.canChangeProtocol);
        updated = true;
      }
      if (updated) {
        updateActions();
        this.registerPrivacyActions();
        this.createTable();
        this.table?.layout(this.height, this.width);
      }
    }));
  }
  registerPrivacyActions() {
    for (const privacyOption of this.tunnelService.privacyOptions) {
      const optionId = `remote.tunnel.privacy${privacyOption.id}`;
      CommandsRegistry.registerCommand(optionId, ChangeTunnelPrivacyAction.handler(privacyOption.id));
      MenuRegistry.appendMenuItem(MenuId.TunnelPrivacy, {
        order: 0,
        command: {
          id: optionId,
          title: privacyOption.label,
          toggled: TunnelPrivacyContextKey.isEqualTo(privacyOption.id)
        }
      });
    }
  }
  get portCount() {
    return this.remoteExplorerService.tunnelModel.forwarded.size + this.remoteExplorerService.tunnelModel.detected.size;
  }
  createTable() {
    if (!this.panelContainer) {
      return;
    }
    this.tableDisposables.clear();
    dom.clearNode(this.panelContainer);
    const widgetContainer = dom.append(this.panelContainer, dom.$(".customview-tree"));
    widgetContainer.classList.add("ports-view");
    widgetContainer.classList.add("file-icon-themable-tree", "show-file-icons");
    const actionBarRenderer = new ActionBarRenderer(
      this.instantiationService,
      this.contextKeyService,
      this.menuService,
      this.contextViewService,
      this.remoteExplorerService,
      this.commandService,
      this.configurationService
    );
    const columns = [new IconColumn(), new PortColumn(), new LocalAddressColumn(), new RunningProcessColumn()];
    if (this.tunnelService.canChangePrivacy) {
      columns.push(new PrivacyColumn());
    }
    columns.push(new OriginColumn());
    this.table = this.instantiationService.createInstance(
      WorkbenchTable,
      "RemoteTunnels",
      widgetContainer,
      new TunnelTreeVirtualDelegate(this.remoteExplorerService),
      columns,
      [actionBarRenderer],
      {
        keyboardNavigationLabelProvider: {
          getKeyboardNavigationLabel: (item) => {
            return item.label;
          }
        },
        multipleSelectionSupport: true,
        accessibilityProvider: {
          getAriaLabel: (item) => {
            if (item instanceof TunnelItem) {
              return `${item.tooltipPostfix} ${item.portTooltip} ${item.iconTooltip} ${item.processTooltip} ${item.originTooltip} ${this.tunnelService.canChangePrivacy ? item.privacy.label : ""}`;
            } else {
              return item.label;
            }
          },
          getWidgetAriaLabel: () => nls.localize("tunnelView", "Tunnel View")
        },
        openOnSingleClick: true
      }
    );
    const actionRunner = this.tableDisposables.add(new ActionRunner());
    actionBarRenderer.actionRunner = actionRunner;
    this.tableDisposables.add(this.table);
    this.tableDisposables.add(this.table.onContextMenu((e) => this.onContextMenu(e, actionRunner)));
    this.tableDisposables.add(this.table.onMouseDblClick((e) => this.onMouseDblClick(e)));
    this.tableDisposables.add(this.table.onDidChangeFocus((e) => this.onFocusChanged(e)));
    this.tableDisposables.add(this.table.onDidChangeSelection((e) => this.onSelectionChanged(e)));
    this.tableDisposables.add(this.table.onDidFocus(() => this.tunnelViewFocusContext.set(true)));
    this.tableDisposables.add(this.table.onDidBlur(() => this.tunnelViewFocusContext.set(false)));
    const rerender = () => this.table?.splice(0, Number.POSITIVE_INFINITY, this.viewModel.all);
    rerender();
    let lastPortCount = this.portCount;
    this.tableDisposables.add(Event.debounce(this.viewModel.onForwardedPortsChanged, (_last, e) => e, 50)(() => {
      const newPortCount = this.portCount;
      if ((lastPortCount === 0 || newPortCount === 0) && lastPortCount !== newPortCount) {
        this._onDidChangeViewWelcomeState.fire();
      }
      lastPortCount = newPortCount;
      rerender();
    }));
    this.tableDisposables.add(this.table.onMouseClick((e) => {
      if (this.hasOpenLinkModifier(e.browserEvent) && this.table) {
        const selection = this.table.getSelectedElements();
        if (selection.length === 0 || selection.length === 1 && selection[0] === e.element) {
          this.commandService.executeCommand(OpenPortInBrowserAction.ID, e.element);
        }
      }
    }));
    this.tableDisposables.add(this.table.onDidOpen((e) => {
      if (!e.element || e.element.tunnelType !== TunnelType.Forwarded) {
        return;
      }
      if (e.browserEvent?.type === "dblclick") {
        this.commandService.executeCommand(LabelTunnelAction.ID);
      }
    }));
    this.tableDisposables.add(this.remoteExplorerService.onDidChangeEditable((e) => {
      this.isEditing = !!this.remoteExplorerService.getEditableData(e?.tunnel, e?.editId);
      this._onDidChangeViewWelcomeState.fire();
      if (!this.isEditing) {
        widgetContainer.classList.remove("highlight");
      }
      rerender();
      if (this.isEditing) {
        widgetContainer.classList.add("highlight");
        if (!e) {
          this.table?.reveal(this.table.indexOf(this.viewModel.input));
        }
      } else {
        if (e && e.tunnel.tunnelType !== TunnelType.Add) {
          this.table?.setFocus(this.lastFocus);
        }
        this.focus();
      }
    }));
  }
  renderBody(container) {
    super.renderBody(container);
    this.panelContainer = dom.append(container, dom.$(".tree-explorer-viewlet-tree-view"));
    this.createTable();
  }
  shouldShowWelcome() {
    return this.viewModel.isEmpty() && !this.isEditing;
  }
  focus() {
    super.focus();
    this.table?.domFocus();
  }
  onFocusChanged(event) {
    if (event.indexes.length > 0 && event.elements.length > 0) {
      this.lastFocus = [...event.indexes];
    }
    const elements = event.elements;
    const item = elements && elements.length ? elements[0] : void 0;
    if (item) {
      this.tunnelViewSelectionContext.set(makeAddress(item.remoteHost, item.remotePort));
      this.tunnelTypeContext.set(item.tunnelType);
      this.tunnelCloseableContext.set(!!item.closeable);
      this.tunnelPrivacyContext.set(item.privacy.id);
      this.tunnelProtocolContext.set(item.protocol === TunnelProtocol.Https ? TunnelProtocol.Https : TunnelProtocol.Https);
      this.portChangableContextKey.set(!!item.localPort);
    } else {
      this.tunnelTypeContext.reset();
      this.tunnelViewSelectionContext.reset();
      this.tunnelCloseableContext.reset();
      this.tunnelPrivacyContext.reset();
      this.tunnelProtocolContext.reset();
      this.portChangableContextKey.reset();
    }
  }
  hasOpenLinkModifier(e) {
    const editorConf = this.configurationService.getValue("editor");
    let modifierKey = false;
    if (editorConf.multiCursorModifier === "ctrlCmd") {
      modifierKey = e.altKey;
    } else {
      if (isMacintosh) {
        modifierKey = e.metaKey;
      } else {
        modifierKey = e.ctrlKey;
      }
    }
    return modifierKey;
  }
  onSelectionChanged(event) {
    const elements = event.elements;
    if (elements.length > 1) {
      this.tunnelViewMultiSelectionContext.set(elements.map((element) => makeAddress(element.remoteHost, element.remotePort)));
    } else {
      this.tunnelViewMultiSelectionContext.set(void 0);
    }
  }
  onContextMenu(event, actionRunner) {
    if (event.element !== void 0 && !(event.element instanceof TunnelItem)) {
      return;
    }
    event.browserEvent.preventDefault();
    event.browserEvent.stopPropagation();
    const node = event.element;
    if (node) {
      this.table?.setFocus([this.table.indexOf(node)]);
      this.tunnelTypeContext.set(node.tunnelType);
      this.tunnelCloseableContext.set(!!node.closeable);
      this.tunnelPrivacyContext.set(node.privacy.id);
      this.tunnelProtocolContext.set(node.protocol);
      this.portChangableContextKey.set(!!node.localPort);
    } else {
      this.tunnelTypeContext.set(TunnelType.Add);
      this.tunnelCloseableContext.set(false);
      this.tunnelPrivacyContext.set(void 0);
      this.tunnelProtocolContext.set(void 0);
      this.portChangableContextKey.set(false);
    }
    this.contextMenuService.showContextMenu({
      menuId: MenuId.TunnelContext,
      menuActionOptions: { shouldForwardArgs: true },
      contextKeyService: this.table?.contextKeyService,
      getAnchor: () => event.anchor,
      getActionViewItem: (action) => {
        const keybinding = this.keybindingService.lookupKeybinding(action.id);
        if (keybinding) {
          return new ActionViewItem(action, action, { label: true, keybinding: keybinding.getLabel() });
        }
        return void 0;
      },
      onHide: (wasCancelled) => {
        if (wasCancelled) {
          this.table?.domFocus();
        }
      },
      getActionsContext: () => node?.strip(),
      actionRunner
    });
  }
  onMouseDblClick(e) {
    if (!e.element) {
      this.commandService.executeCommand(ForwardPortAction.INLINE_ID);
    }
  }
  layoutBody(height, width) {
    this.height = height;
    this.width = width;
    super.layoutBody(height, width);
    this.table?.layout(height, width);
  }
};
TunnelPanel.ID = TUNNEL_VIEW_ID;
TunnelPanel.TITLE = nls.localize2("remote.tunnel", "Ports");
TunnelPanel = __decorateClass([
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IViewDescriptorService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, IQuickInputService),
  __decorateParam(10, ICommandService),
  __decorateParam(11, IMenuService),
  __decorateParam(12, IThemeService),
  __decorateParam(13, IRemoteExplorerService),
  __decorateParam(14, IHoverService),
  __decorateParam(15, ITunnelService),
  __decorateParam(16, IContextViewService)
], TunnelPanel);
class TunnelPanelDescriptor {
  constructor(viewModel, environmentService) {
    this.id = TunnelPanel.ID;
    this.name = TunnelPanel.TITLE;
    this.canToggleVisibility = true;
    this.hideByDefault = false;
    // group is not actually used for views that are not extension contributed. Use order instead.
    this.group = "details@0";
    // -500 comes from the remote explorer viewOrderDelegate
    this.order = -500;
    this.canMoveView = true;
    this.containerIcon = portsViewIcon;
    this.ctorDescriptor = new SyncDescriptor(TunnelPanel, [viewModel]);
    this.remoteAuthority = environmentService.remoteAuthority ? environmentService.remoteAuthority.split("+")[0] : void 0;
  }
}
function isITunnelItem(item) {
  return item && item.tunnelType && item.remoteHost && item.source;
}
var LabelTunnelAction;
((LabelTunnelAction2) => {
  LabelTunnelAction2.ID = "remote.tunnel.label";
  LabelTunnelAction2.LABEL = nls.localize("remote.tunnel.label", "Set Port Label");
  LabelTunnelAction2.COMMAND_ID_KEYWORD = "label";
  function handler() {
    return async (accessor, arg) => {
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      let tunnelContext;
      if (isITunnelItem(arg)) {
        tunnelContext = arg;
      } else {
        const context = accessor.get(IContextKeyService).getContextKeyValue(TunnelViewSelectionKeyName);
        const tunnel = context ? remoteExplorerService.tunnelModel.forwarded.get(context) : void 0;
        if (tunnel) {
          const tunnelService = accessor.get(ITunnelService);
          tunnelContext = TunnelItem.createFromTunnel(remoteExplorerService, tunnelService, tunnel);
        }
      }
      if (tunnelContext) {
        const tunnelItem = tunnelContext;
        return new Promise((resolve) => {
          const startingValue = tunnelItem.name ? tunnelItem.name : `${tunnelItem.remotePort}`;
          remoteExplorerService.setEditable(tunnelItem, TunnelEditId.Label, {
            onFinish: async (value, success) => {
              value = value.trim();
              remoteExplorerService.setEditable(tunnelItem, TunnelEditId.Label, null);
              const changed = success && value !== startingValue;
              if (changed) {
                await remoteExplorerService.tunnelModel.name(tunnelItem.remoteHost, tunnelItem.remotePort, value);
              }
              resolve(changed ? { port: tunnelItem.remotePort, label: value } : void 0);
            },
            validationMessage: () => null,
            placeholder: nls.localize("remote.tunnelsView.labelPlaceholder", "Port label"),
            startingValue
          });
        });
      }
      return void 0;
    };
  }
  LabelTunnelAction2.handler = handler;
})(LabelTunnelAction || (LabelTunnelAction = {}));
const invalidPortString = nls.localize("remote.tunnelsView.portNumberValid", "Forwarded port should be a number or a host:port.");
const maxPortNumber = 65536;
const invalidPortNumberString = nls.localize("remote.tunnelsView.portNumberToHigh", "Port number must be \u2265 0 and < {0}.", maxPortNumber);
const requiresSudoString = nls.localize("remote.tunnelView.inlineElevationMessage", "May Require Sudo");
const alreadyForwarded = nls.localize("remote.tunnelView.alreadyForwarded", "Port is already forwarded");
var ForwardPortAction;
((ForwardPortAction2) => {
  ForwardPortAction2.INLINE_ID = "remote.tunnel.forwardInline";
  ForwardPortAction2.COMMANDPALETTE_ID = "remote.tunnel.forwardCommandPalette";
  ForwardPortAction2.LABEL = nls.localize2("remote.tunnel.forward", "Forward a Port");
  ForwardPortAction2.TREEITEM_LABEL = nls.localize("remote.tunnel.forwardItem", "Forward Port");
  const forwardPrompt = nls.localize("remote.tunnel.forwardPrompt", "Port number or address (eg. 3000 or 10.10.10.10:2000).");
  function validateInput(remoteExplorerService, tunnelService, value, canElevate) {
    const parsed = parseAddress(value);
    if (!parsed) {
      return { content: invalidPortString, severity: Severity.Error };
    } else if (parsed.port >= maxPortNumber) {
      return { content: invalidPortNumberString, severity: Severity.Error };
    } else if (canElevate && tunnelService.isPortPrivileged(parsed.port)) {
      return { content: requiresSudoString, severity: Severity.Info };
    } else if (mapHasAddressLocalhostOrAllInterfaces(remoteExplorerService.tunnelModel.forwarded, parsed.host, parsed.port)) {
      return { content: alreadyForwarded, severity: Severity.Error };
    }
    return null;
  }
  function error(notificationService, tunnelOrError, host, port) {
    if (!tunnelOrError) {
      notificationService.warn(nls.localize("remote.tunnel.forwardError", "Unable to forward {0}:{1}. The host may not be available or that remote port may already be forwarded", host, port));
    } else if (typeof tunnelOrError === "string") {
      notificationService.warn(nls.localize("remote.tunnel.forwardErrorProvided", "Unable to forward {0}:{1}. {2}", host, port, tunnelOrError));
    }
  }
  function inlineHandler() {
    return async (accessor, arg) => {
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      const notificationService = accessor.get(INotificationService);
      const tunnelService = accessor.get(ITunnelService);
      remoteExplorerService.setEditable(void 0, TunnelEditId.New, {
        onFinish: async (value, success) => {
          remoteExplorerService.setEditable(void 0, TunnelEditId.New, null);
          let parsed;
          if (success && (parsed = parseAddress(value))) {
            remoteExplorerService.forward({
              remote: { host: parsed.host, port: parsed.port },
              elevateIfNeeded: true
            }).then((tunnelOrError) => error(notificationService, tunnelOrError, parsed.host, parsed.port));
          }
        },
        validationMessage: (value) => validateInput(remoteExplorerService, tunnelService, value, tunnelService.canElevate),
        placeholder: forwardPrompt
      });
    };
  }
  ForwardPortAction2.inlineHandler = inlineHandler;
  function commandPaletteHandler() {
    return async (accessor, arg) => {
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      const notificationService = accessor.get(INotificationService);
      const viewsService = accessor.get(IViewsService);
      const quickInputService = accessor.get(IQuickInputService);
      const tunnelService = accessor.get(ITunnelService);
      await viewsService.openView(TunnelPanel.ID, true);
      const value = await quickInputService.input({
        prompt: forwardPrompt,
        validateInput: (value2) => Promise.resolve(validateInput(remoteExplorerService, tunnelService, value2, tunnelService.canElevate))
      });
      let parsed;
      if (value && (parsed = parseAddress(value))) {
        remoteExplorerService.forward({
          remote: { host: parsed.host, port: parsed.port },
          elevateIfNeeded: true
        }).then((tunnel) => error(notificationService, tunnel, parsed.host, parsed.port));
      }
    };
  }
  ForwardPortAction2.commandPaletteHandler = commandPaletteHandler;
})(ForwardPortAction || (ForwardPortAction = {}));
function makeTunnelPicks(tunnels, remoteExplorerService, tunnelService) {
  const picks = tunnels.map((forwarded) => {
    const item = TunnelItem.createFromTunnel(remoteExplorerService, tunnelService, forwarded);
    return {
      label: item.label,
      description: item.processDescription,
      tunnel: item
    };
  });
  if (picks.length === 0) {
    picks.push({
      label: nls.localize("remote.tunnel.closeNoPorts", "No ports currently forwarded. Try running the {0} command", ForwardPortAction.LABEL.value)
    });
  }
  return picks;
}
var ClosePortAction;
((ClosePortAction2) => {
  ClosePortAction2.INLINE_ID = "remote.tunnel.closeInline";
  ClosePortAction2.COMMANDPALETTE_ID = "remote.tunnel.closeCommandPalette";
  ClosePortAction2.LABEL = nls.localize2("remote.tunnel.close", "Stop Forwarding Port");
  function inlineHandler() {
    return async (accessor, arg) => {
      const contextKeyService = accessor.get(IContextKeyService);
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      let ports = [];
      const multiSelectContext = contextKeyService.getContextKeyValue(TunnelViewMultiSelectionKeyName);
      if (multiSelectContext) {
        multiSelectContext.forEach((context) => {
          const tunnel = remoteExplorerService.tunnelModel.forwarded.get(context);
          if (tunnel) {
            ports?.push(tunnel);
          }
        });
      } else if (isITunnelItem(arg)) {
        ports = [arg];
      } else {
        const context = contextKeyService.getContextKeyValue(TunnelViewSelectionKeyName);
        const tunnel = context ? remoteExplorerService.tunnelModel.forwarded.get(context) : void 0;
        if (tunnel) {
          ports = [tunnel];
        }
      }
      if (!ports || ports.length === 0) {
        return;
      }
      return Promise.all(ports.map((port) => remoteExplorerService.close({ host: port.remoteHost, port: port.remotePort }, TunnelCloseReason.User)));
    };
  }
  ClosePortAction2.inlineHandler = inlineHandler;
  function commandPaletteHandler() {
    return async (accessor) => {
      const quickInputService = accessor.get(IQuickInputService);
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      const tunnelService = accessor.get(ITunnelService);
      const commandService = accessor.get(ICommandService);
      const picks = makeTunnelPicks(Array.from(remoteExplorerService.tunnelModel.forwarded.values()).filter((tunnel) => tunnel.closeable), remoteExplorerService, tunnelService);
      const result = await quickInputService.pick(picks, { placeHolder: nls.localize("remote.tunnel.closePlaceholder", "Choose a port to stop forwarding") });
      if (result && result.tunnel) {
        await remoteExplorerService.close({ host: result.tunnel.remoteHost, port: result.tunnel.remotePort }, TunnelCloseReason.User);
      } else if (result) {
        await commandService.executeCommand(ForwardPortAction.COMMANDPALETTE_ID);
      }
    };
  }
  ClosePortAction2.commandPaletteHandler = commandPaletteHandler;
})(ClosePortAction || (ClosePortAction = {}));
var OpenPortInBrowserAction;
((OpenPortInBrowserAction2) => {
  OpenPortInBrowserAction2.ID = "remote.tunnel.open";
  OpenPortInBrowserAction2.LABEL = nls.localize("remote.tunnel.open", "Open in Browser");
  function handler() {
    return async (accessor, arg) => {
      let key;
      if (isITunnelItem(arg)) {
        key = makeAddress(arg.remoteHost, arg.remotePort);
      } else if (arg.tunnelRemoteHost && arg.tunnelRemotePort) {
        key = makeAddress(arg.tunnelRemoteHost, arg.tunnelRemotePort);
      }
      if (key) {
        const model = accessor.get(IRemoteExplorerService).tunnelModel;
        const openerService = accessor.get(IOpenerService);
        return run(model, openerService, key);
      }
    };
  }
  OpenPortInBrowserAction2.handler = handler;
  function run(model, openerService, key) {
    const tunnel = model.forwarded.get(key) || model.detected.get(key);
    if (tunnel) {
      return openerService.open(tunnel.localUri, { allowContributedOpeners: false });
    }
    return Promise.resolve();
  }
  OpenPortInBrowserAction2.run = run;
})(OpenPortInBrowserAction || (OpenPortInBrowserAction = {}));
var OpenPortInPreviewAction;
((OpenPortInPreviewAction2) => {
  OpenPortInPreviewAction2.ID = "remote.tunnel.openPreview";
  OpenPortInPreviewAction2.LABEL = nls.localize("remote.tunnel.openPreview", "Preview in Editor");
  function handler() {
    return async (accessor, arg) => {
      let key;
      if (isITunnelItem(arg)) {
        key = makeAddress(arg.remoteHost, arg.remotePort);
      } else if (arg.tunnelRemoteHost && arg.tunnelRemotePort) {
        key = makeAddress(arg.tunnelRemoteHost, arg.tunnelRemotePort);
      }
      if (key) {
        const model = accessor.get(IRemoteExplorerService).tunnelModel;
        const openerService = accessor.get(IOpenerService);
        const externalOpenerService = accessor.get(IExternalUriOpenerService);
        return run(model, openerService, externalOpenerService, key);
      }
    };
  }
  OpenPortInPreviewAction2.handler = handler;
  async function run(model, openerService, externalOpenerService, key) {
    const tunnel = model.forwarded.get(key) || model.detected.get(key);
    if (tunnel) {
      const remoteHost = tunnel.remoteHost.includes(":") ? `[${tunnel.remoteHost}]` : tunnel.remoteHost;
      const sourceUri = URI.parse(`http://${remoteHost}:${tunnel.remotePort}`);
      const opener = await externalOpenerService.getOpener(tunnel.localUri, { sourceUri }, CancellationToken.None);
      if (opener) {
        return opener.openExternalUri(tunnel.localUri, { sourceUri }, CancellationToken.None);
      }
      return openerService.open(tunnel.localUri);
    }
    return Promise.resolve();
  }
  OpenPortInPreviewAction2.run = run;
})(OpenPortInPreviewAction || (OpenPortInPreviewAction = {}));
var OpenPortInBrowserCommandPaletteAction;
((OpenPortInBrowserCommandPaletteAction2) => {
  OpenPortInBrowserCommandPaletteAction2.ID = "remote.tunnel.openCommandPalette";
  OpenPortInBrowserCommandPaletteAction2.LABEL = nls.localize("remote.tunnel.openCommandPalette", "Open Port in Browser");
  function handler() {
    return async (accessor, arg) => {
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      const tunnelService = accessor.get(ITunnelService);
      const model = remoteExplorerService.tunnelModel;
      const quickPickService = accessor.get(IQuickInputService);
      const openerService = accessor.get(IOpenerService);
      const commandService = accessor.get(ICommandService);
      const options = [...model.forwarded, ...model.detected].map((value) => {
        const tunnelItem = TunnelItem.createFromTunnel(remoteExplorerService, tunnelService, value[1]);
        return {
          label: tunnelItem.label,
          description: tunnelItem.processDescription,
          tunnel: tunnelItem
        };
      });
      if (options.length === 0) {
        options.push({
          label: nls.localize("remote.tunnel.openCommandPaletteNone", "No ports currently forwarded. Open the Ports view to get started.")
        });
      } else {
        options.push({
          label: nls.localize("remote.tunnel.openCommandPaletteView", "Open the Ports view...")
        });
      }
      const picked = await quickPickService.pick(options, { placeHolder: nls.localize("remote.tunnel.openCommandPalettePick", "Choose the port to open") });
      if (picked && picked.tunnel) {
        return OpenPortInBrowserAction.run(model, openerService, makeAddress(picked.tunnel.remoteHost, picked.tunnel.remotePort));
      } else if (picked) {
        return commandService.executeCommand(`${TUNNEL_VIEW_ID}.focus`);
      }
    };
  }
  OpenPortInBrowserCommandPaletteAction2.handler = handler;
})(OpenPortInBrowserCommandPaletteAction || (OpenPortInBrowserCommandPaletteAction = {}));
var CopyAddressAction;
((CopyAddressAction2) => {
  CopyAddressAction2.INLINE_ID = "remote.tunnel.copyAddressInline";
  CopyAddressAction2.COMMANDPALETTE_ID = "remote.tunnel.copyAddressCommandPalette";
  CopyAddressAction2.INLINE_LABEL = nls.localize("remote.tunnel.copyAddressInline", "Copy Local Address");
  CopyAddressAction2.COMMANDPALETTE_LABEL = nls.localize("remote.tunnel.copyAddressCommandPalette", "Copy Forwarded Port Address");
  async function copyAddress(remoteExplorerService, clipboardService, tunnelItem) {
    const address = remoteExplorerService.tunnelModel.address(tunnelItem.remoteHost, tunnelItem.remotePort);
    if (address) {
      await clipboardService.writeText(address.toString());
    }
  }
  function inlineHandler() {
    return async (accessor, arg) => {
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      let tunnelItem;
      if (isITunnelItem(arg)) {
        tunnelItem = arg;
      } else {
        const context = accessor.get(IContextKeyService).getContextKeyValue(TunnelViewSelectionKeyName);
        tunnelItem = context ? remoteExplorerService.tunnelModel.forwarded.get(context) : void 0;
      }
      if (tunnelItem) {
        return copyAddress(remoteExplorerService, accessor.get(IClipboardService), tunnelItem);
      }
    };
  }
  CopyAddressAction2.inlineHandler = inlineHandler;
  function commandPaletteHandler() {
    return async (accessor, arg) => {
      const quickInputService = accessor.get(IQuickInputService);
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      const tunnelService = accessor.get(ITunnelService);
      const commandService = accessor.get(ICommandService);
      const clipboardService = accessor.get(IClipboardService);
      const tunnels = Array.from(remoteExplorerService.tunnelModel.forwarded.values()).concat(Array.from(remoteExplorerService.tunnelModel.detected.values()));
      const result = await quickInputService.pick(makeTunnelPicks(tunnels, remoteExplorerService, tunnelService), { placeHolder: nls.localize("remote.tunnel.copyAddressPlaceholdter", "Choose a forwarded port") });
      if (result && result.tunnel) {
        await copyAddress(remoteExplorerService, clipboardService, result.tunnel);
      } else if (result) {
        await commandService.executeCommand(ForwardPortAction.COMMANDPALETTE_ID);
      }
    };
  }
  CopyAddressAction2.commandPaletteHandler = commandPaletteHandler;
})(CopyAddressAction || (CopyAddressAction = {}));
var ChangeLocalPortAction;
((ChangeLocalPortAction2) => {
  ChangeLocalPortAction2.ID = "remote.tunnel.changeLocalPort";
  ChangeLocalPortAction2.LABEL = nls.localize("remote.tunnel.changeLocalPort", "Change Local Address Port");
  function validateInput(tunnelService, value, canElevate) {
    if (!value.match(/^[0-9]+$/)) {
      return { content: nls.localize("remote.tunnelsView.portShouldBeNumber", "Local port should be a number."), severity: Severity.Error };
    } else if (Number(value) >= maxPortNumber) {
      return { content: invalidPortNumberString, severity: Severity.Error };
    } else if (canElevate && tunnelService.isPortPrivileged(Number(value))) {
      return { content: requiresSudoString, severity: Severity.Info };
    }
    return null;
  }
  function handler() {
    return async (accessor, arg) => {
      const remoteExplorerService = accessor.get(IRemoteExplorerService);
      const notificationService = accessor.get(INotificationService);
      const tunnelService = accessor.get(ITunnelService);
      let tunnelContext;
      if (isITunnelItem(arg)) {
        tunnelContext = arg;
      } else {
        const context = accessor.get(IContextKeyService).getContextKeyValue(TunnelViewSelectionKeyName);
        const tunnel = context ? remoteExplorerService.tunnelModel.forwarded.get(context) : void 0;
        if (tunnel) {
          const tunnelService2 = accessor.get(ITunnelService);
          tunnelContext = TunnelItem.createFromTunnel(remoteExplorerService, tunnelService2, tunnel);
        }
      }
      if (tunnelContext) {
        const tunnelItem = tunnelContext;
        remoteExplorerService.setEditable(tunnelItem, TunnelEditId.LocalPort, {
          onFinish: async (value, success) => {
            remoteExplorerService.setEditable(tunnelItem, TunnelEditId.LocalPort, null);
            if (success) {
              await remoteExplorerService.close({ host: tunnelItem.remoteHost, port: tunnelItem.remotePort }, TunnelCloseReason.Other);
              const numberValue = Number(value);
              const newForward = await remoteExplorerService.forward({
                remote: { host: tunnelItem.remoteHost, port: tunnelItem.remotePort },
                local: numberValue,
                name: tunnelItem.name,
                elevateIfNeeded: true,
                source: tunnelItem.source
              });
              if (newForward && typeof newForward !== "string" && newForward.tunnelLocalPort !== numberValue) {
                notificationService.warn(nls.localize("remote.tunnel.changeLocalPortNumber", "The local port {0} is not available. Port number {1} has been used instead", value, newForward.tunnelLocalPort ?? newForward.localAddress));
              }
            }
          },
          validationMessage: (value) => validateInput(tunnelService, value, tunnelService.canElevate),
          placeholder: nls.localize("remote.tunnelsView.changePort", "New local port")
        });
      }
    };
  }
  ChangeLocalPortAction2.handler = handler;
})(ChangeLocalPortAction || (ChangeLocalPortAction = {}));
var ChangeTunnelPrivacyAction;
((ChangeTunnelPrivacyAction2) => {
  function handler(privacyId) {
    return async (accessor, arg) => {
      if (isITunnelItem(arg)) {
        const remoteExplorerService = accessor.get(IRemoteExplorerService);
        await remoteExplorerService.close({ host: arg.remoteHost, port: arg.remotePort }, TunnelCloseReason.Other);
        return remoteExplorerService.forward({
          remote: { host: arg.remoteHost, port: arg.remotePort },
          local: arg.localPort,
          name: arg.name,
          elevateIfNeeded: true,
          privacy: privacyId,
          source: arg.source
        });
      }
      return void 0;
    };
  }
  ChangeTunnelPrivacyAction2.handler = handler;
})(ChangeTunnelPrivacyAction || (ChangeTunnelPrivacyAction = {}));
var SetTunnelProtocolAction;
((SetTunnelProtocolAction2) => {
  SetTunnelProtocolAction2.ID_HTTP = "remote.tunnel.setProtocolHttp";
  SetTunnelProtocolAction2.ID_HTTPS = "remote.tunnel.setProtocolHttps";
  SetTunnelProtocolAction2.LABEL_HTTP = nls.localize("remote.tunnel.protocolHttp", "HTTP");
  SetTunnelProtocolAction2.LABEL_HTTPS = nls.localize("remote.tunnel.protocolHttps", "HTTPS");
  async function handler(arg, protocol, remoteExplorerService, environmentService) {
    if (isITunnelItem(arg)) {
      const attributes = {
        protocol
      };
      const target = environmentService.remoteAuthority ? ConfigurationTarget.USER_REMOTE : ConfigurationTarget.USER_LOCAL;
      return remoteExplorerService.tunnelModel.configPortsAttributes.addAttributes(arg.remotePort, attributes, target);
    }
  }
  function handlerHttp() {
    return async (accessor, arg) => {
      return handler(arg, TunnelProtocol.Http, accessor.get(IRemoteExplorerService), accessor.get(IWorkbenchEnvironmentService));
    };
  }
  SetTunnelProtocolAction2.handlerHttp = handlerHttp;
  function handlerHttps() {
    return async (accessor, arg) => {
      return handler(arg, TunnelProtocol.Https, accessor.get(IRemoteExplorerService), accessor.get(IWorkbenchEnvironmentService));
    };
  }
  SetTunnelProtocolAction2.handlerHttps = handlerHttps;
})(SetTunnelProtocolAction || (SetTunnelProtocolAction = {}));
const tunnelViewCommandsWeightBonus = 10;
const isForwardedExpr = TunnelTypeContextKey.isEqualTo(TunnelType.Forwarded);
const isForwardedOrDetectedExpr = ContextKeyExpr.or(isForwardedExpr, TunnelTypeContextKey.isEqualTo(TunnelType.Detected));
const isNotMultiSelectionExpr = TunnelViewMultiSelectionContextKey.isEqualTo(void 0);
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: LabelTunnelAction.ID,
  weight: KeybindingWeight.WorkbenchContrib + tunnelViewCommandsWeightBonus,
  when: ContextKeyExpr.and(TunnelViewFocusContextKey, isForwardedExpr, isNotMultiSelectionExpr),
  primary: KeyCode.F2,
  mac: {
    primary: KeyCode.Enter
  },
  handler: LabelTunnelAction.handler()
});
CommandsRegistry.registerCommand(ForwardPortAction.INLINE_ID, ForwardPortAction.inlineHandler());
CommandsRegistry.registerCommand(ForwardPortAction.COMMANDPALETTE_ID, ForwardPortAction.commandPaletteHandler());
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: ClosePortAction.INLINE_ID,
  weight: KeybindingWeight.WorkbenchContrib + tunnelViewCommandsWeightBonus,
  when: ContextKeyExpr.and(TunnelCloseableContextKey, TunnelViewFocusContextKey),
  primary: KeyCode.Delete,
  mac: {
    primary: KeyMod.CtrlCmd | KeyCode.Backspace,
    secondary: [KeyCode.Delete]
  },
  handler: ClosePortAction.inlineHandler()
});
CommandsRegistry.registerCommand(ClosePortAction.COMMANDPALETTE_ID, ClosePortAction.commandPaletteHandler());
CommandsRegistry.registerCommand(OpenPortInBrowserAction.ID, OpenPortInBrowserAction.handler());
CommandsRegistry.registerCommand(OpenPortInPreviewAction.ID, OpenPortInPreviewAction.handler());
CommandsRegistry.registerCommand(OpenPortInBrowserCommandPaletteAction.ID, OpenPortInBrowserCommandPaletteAction.handler());
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: CopyAddressAction.INLINE_ID,
  weight: KeybindingWeight.WorkbenchContrib + tunnelViewCommandsWeightBonus,
  when: ContextKeyExpr.and(TunnelViewFocusContextKey, isForwardedOrDetectedExpr, isNotMultiSelectionExpr),
  primary: KeyMod.CtrlCmd | KeyCode.KeyC,
  handler: CopyAddressAction.inlineHandler()
});
CommandsRegistry.registerCommand(CopyAddressAction.COMMANDPALETTE_ID, CopyAddressAction.commandPaletteHandler());
CommandsRegistry.registerCommand(ChangeLocalPortAction.ID, ChangeLocalPortAction.handler());
CommandsRegistry.registerCommand(SetTunnelProtocolAction.ID_HTTP, SetTunnelProtocolAction.handlerHttp());
CommandsRegistry.registerCommand(SetTunnelProtocolAction.ID_HTTPS, SetTunnelProtocolAction.handlerHttps());
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: ClosePortAction.COMMANDPALETTE_ID,
    title: ClosePortAction.LABEL
  },
  when: forwardedPortsViewEnabled
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: ForwardPortAction.COMMANDPALETTE_ID,
    title: ForwardPortAction.LABEL
  },
  when: forwardedPortsViewEnabled
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: CopyAddressAction.COMMANDPALETTE_ID,
    title: CopyAddressAction.COMMANDPALETTE_LABEL
  },
  when: forwardedPortsViewEnabled
});
MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
  command: {
    id: OpenPortInBrowserCommandPaletteAction.ID,
    title: OpenPortInBrowserCommandPaletteAction.LABEL
  },
  when: forwardedPortsViewEnabled
});
MenuRegistry.appendMenuItem(MenuId.TunnelContext, {
  group: "._open",
  order: 0,
  command: {
    id: OpenPortInBrowserAction.ID,
    title: OpenPortInBrowserAction.LABEL
  },
  when: ContextKeyExpr.and(isForwardedOrDetectedExpr, isNotMultiSelectionExpr)
});
MenuRegistry.appendMenuItem(MenuId.TunnelContext, {
  group: "._open",
  order: 1,
  command: {
    id: OpenPortInPreviewAction.ID,
    title: OpenPortInPreviewAction.LABEL
  },
  when: ContextKeyExpr.and(
    isForwardedOrDetectedExpr,
    isNotMultiSelectionExpr
  )
});
MenuRegistry.appendMenuItem(MenuId.TunnelContext, {
  group: "0_manage",
  order: 1,
  command: {
    id: LabelTunnelAction.ID,
    title: LabelTunnelAction.LABEL,
    icon: labelPortIcon
  },
  when: ContextKeyExpr.and(isForwardedExpr, isNotMultiSelectionExpr)
});
MenuRegistry.appendMenuItem(MenuId.TunnelContext, {
  group: "2_localaddress",
  order: 0,
  command: {
    id: CopyAddressAction.INLINE_ID,
    title: CopyAddressAction.INLINE_LABEL
  },
  when: ContextKeyExpr.and(isForwardedOrDetectedExpr, isNotMultiSelectionExpr)
});
MenuRegistry.appendMenuItem(MenuId.TunnelContext, {
  group: "2_localaddress",
  order: 1,
  command: {
    id: ChangeLocalPortAction.ID,
    title: ChangeLocalPortAction.LABEL
  },
  when: ContextKeyExpr.and(isForwardedExpr, PortChangableContextKey, isNotMultiSelectionExpr)
});
MenuRegistry.appendMenuItem(MenuId.TunnelContext, {
  group: "2_localaddress",
  order: 2,
  submenu: MenuId.TunnelPrivacy,
  title: nls.localize("tunnelContext.privacyMenu", "Port Visibility"),
  when: ContextKeyExpr.and(isForwardedExpr, TunnelPrivacyEnabledContextKey)
});
MenuRegistry.appendMenuItem(MenuId.TunnelContext, {
  group: "2_localaddress",
  order: 3,
  submenu: MenuId.TunnelProtocol,
  title: nls.localize("tunnelContext.protocolMenu", "Change Port Protocol"),
  when: ContextKeyExpr.and(isForwardedExpr, isNotMultiSelectionExpr, ProtocolChangeableContextKey)
});
MenuRegistry.appendMenuItem(MenuId.TunnelContext, {
  group: "3_forward",
  order: 0,
  command: {
    id: ClosePortAction.INLINE_ID,
    title: ClosePortAction.LABEL
  },
  when: TunnelCloseableContextKey
});
MenuRegistry.appendMenuItem(MenuId.TunnelContext, {
  group: "3_forward",
  order: 1,
  command: {
    id: ForwardPortAction.INLINE_ID,
    title: ForwardPortAction.LABEL
  }
});
MenuRegistry.appendMenuItem(MenuId.TunnelProtocol, {
  order: 0,
  command: {
    id: SetTunnelProtocolAction.ID_HTTP,
    title: SetTunnelProtocolAction.LABEL_HTTP,
    toggled: TunnelProtocolContextKey.isEqualTo(TunnelProtocol.Http)
  }
});
MenuRegistry.appendMenuItem(MenuId.TunnelProtocol, {
  order: 1,
  command: {
    id: SetTunnelProtocolAction.ID_HTTPS,
    title: SetTunnelProtocolAction.LABEL_HTTPS,
    toggled: TunnelProtocolContextKey.isEqualTo(TunnelProtocol.Https)
  }
});
MenuRegistry.appendMenuItem(MenuId.TunnelPortInline, {
  group: "0_manage",
  order: 0,
  command: {
    id: ForwardPortAction.INLINE_ID,
    title: ForwardPortAction.TREEITEM_LABEL,
    icon: forwardPortIcon
  },
  when: TunnelTypeContextKey.isEqualTo(TunnelType.Candidate)
});
MenuRegistry.appendMenuItem(MenuId.TunnelPortInline, {
  group: "0_manage",
  order: 4,
  command: {
    id: LabelTunnelAction.ID,
    title: LabelTunnelAction.LABEL,
    icon: labelPortIcon
  },
  when: isForwardedExpr
});
MenuRegistry.appendMenuItem(MenuId.TunnelPortInline, {
  group: "0_manage",
  order: 5,
  command: {
    id: ClosePortAction.INLINE_ID,
    title: ClosePortAction.LABEL,
    icon: stopForwardIcon
  },
  when: TunnelCloseableContextKey
});
MenuRegistry.appendMenuItem(MenuId.TunnelLocalAddressInline, {
  order: -1,
  command: {
    id: CopyAddressAction.INLINE_ID,
    title: CopyAddressAction.INLINE_LABEL,
    icon: copyAddressIcon
  },
  when: isForwardedOrDetectedExpr
});
MenuRegistry.appendMenuItem(MenuId.TunnelLocalAddressInline, {
  order: 0,
  command: {
    id: OpenPortInBrowserAction.ID,
    title: OpenPortInBrowserAction.LABEL,
    icon: openBrowserIcon
  },
  when: isForwardedOrDetectedExpr
});
MenuRegistry.appendMenuItem(MenuId.TunnelLocalAddressInline, {
  order: 1,
  command: {
    id: OpenPortInPreviewAction.ID,
    title: OpenPortInPreviewAction.LABEL,
    icon: openPreviewIcon
  },
  when: isForwardedOrDetectedExpr
});
registerColor("ports.iconRunningProcessForeground", STATUS_BAR_REMOTE_ITEM_BACKGROUND, nls.localize("portWithRunningProcess.foreground", "The color of the icon for a port that has an associated running process."));
export {
  ForwardPortAction,
  OpenPortInBrowserAction,
  OpenPortInPreviewAction,
  TunnelPanel,
  TunnelPanelDescriptor,
  TunnelViewModel,
  openPreviewEnabledContext
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9yZW1vdGUvYnJvd3Nlci90dW5uZWxWaWV3LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuL21lZGlhL3R1bm5lbFZpZXcuY3NzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSVZpZXdEZXNjcmlwdG9yLCBJRWRpdGFibGVEYXRhLCBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSwgSUNvbnRleHRWaWV3U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlLCBJQ29udGV4dEtleSwgUmF3Q29udGV4dEtleSwgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25UYXJnZXQsIElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGlja0l0ZW0sIFF1aWNrUGlja0lucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UsIElDb21tYW5kSGFuZGxlciwgQ29tbWFuZHNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUsIGRpc3Bvc2UsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBBY3Rpb25CYXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvbmJhci5qcyc7XG5pbXBvcnQgeyBJY29uTGFiZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaWNvbkxhYmVsL2ljb25MYWJlbC5qcyc7XG5pbXBvcnQgeyBBY3Rpb25SdW5uZXIsIElBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElNZW51U2VydmljZSwgTWVudUlkLCBNZW51UmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElMb2NhbGl6ZWRTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbi5qcyc7XG5pbXBvcnQgeyBjcmVhdGVBY3Rpb25WaWV3SXRlbSwgZ2V0RmxhdEFjdGlvbkJhckFjdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvbWVudUVudHJ5QWN0aW9uVmlld0l0ZW0uanMnO1xuaW1wb3J0IHsgSVJlbW90ZUV4cGxvcmVyU2VydmljZSwgVHVubmVsVHlwZSwgSVR1bm5lbEl0ZW0sIFRVTk5FTF9WSUVXX0lELCBUdW5uZWxFZGl0SWQgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9yZW1vdGUvY29tbW9uL3JlbW90ZUV4cGxvcmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ2xpcGJvYXJkU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NsaXBib2FyZC9jb21tb24vY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJbnB1dEJveCwgTWVzc2FnZVR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaW5wdXRib3gvaW5wdXRCb3guanMnO1xuaW1wb3J0IHsgY3JlYXRlU2luZ2xlQ2FsbEZ1bmN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZnVuY3Rpb25hbC5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgSUtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIva2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBWaWV3UGFuZSwgSVZpZXdQYW5lT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGlzQWxsSW50ZXJmYWNlcywgaXNMb2NhbGhvc3QsIElUdW5uZWxTZXJ2aWNlLCBSZW1vdGVUdW5uZWwsIFR1bm5lbFByaXZhY3lJZCwgVHVubmVsUHJvdG9jb2wgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90dW5uZWwvY29tbW9uL3R1bm5lbC5qcyc7XG5pbXBvcnQgeyBUdW5uZWxQcml2YWN5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9yZW1vdGVBdXRob3JpdHlSZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzUmVnaXN0cnksIEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25WaWV3SXRlbXMuanMnO1xuaW1wb3J0IHsgY29weUFkZHJlc3NJY29uLCBmb3J3YXJkZWRQb3J0V2l0aG91dFByb2Nlc3NJY29uLCBmb3J3YXJkZWRQb3J0V2l0aFByb2Nlc3NJY29uLCBmb3J3YXJkUG9ydEljb24sIGxhYmVsUG9ydEljb24sIG9wZW5Ccm93c2VySWNvbiwgb3BlblByZXZpZXdJY29uLCBwb3J0c1ZpZXdJY29uLCBwcml2YXRlUG9ydEljb24sIHN0b3BGb3J3YXJkSWNvbiB9IGZyb20gJy4vcmVtb3RlSWNvbnMuanMnO1xuaW1wb3J0IHsgSUV4dGVybmFsVXJpT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uL2V4dGVybmFsVXJpT3BlbmVyL2NvbW1vbi9leHRlcm5hbFVyaU9wZW5lclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJVGFibGVDb2x1bW4sIElUYWJsZUNvbnRleHRNZW51RXZlbnQsIElUYWJsZUV2ZW50LCBJVGFibGVNb3VzZUV2ZW50LCBJVGFibGVSZW5kZXJlciwgSVRhYmxlVmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RhYmxlL3RhYmxlLmpzJztcbmltcG9ydCB7IFdvcmtiZW5jaFRhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEJ1dHRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9idXR0b24vYnV0dG9uLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyQ29sb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcsIE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgSUhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZS5qcyc7XG5pbXBvcnQgeyBTVEFUVVNfQkFSX1JFTU9URV9JVEVNX0JBQ0tHUk9VTkQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdGhlbWUuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IGRlZmF1bHRCdXR0b25TdHlsZXMsIGRlZmF1bHRJbnB1dEJveFN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2Jyb3dzZXIvZGVmYXVsdFN0eWxlcy5qcyc7XG5pbXBvcnQgeyBBdHRyaWJ1dGVzLCBDYW5kaWRhdGVQb3J0LCBUdW5uZWwsIFR1bm5lbENsb3NlUmVhc29uLCBUdW5uZWxNb2RlbCwgVHVubmVsU291cmNlLCBmb3J3YXJkZWRQb3J0c1ZpZXdFbmFibGVkLCBtYWtlQWRkcmVzcywgbWFwSGFzQWRkcmVzc0xvY2FsaG9zdE9yQWxsSW50ZXJmYWNlcywgcGFyc2VBZGRyZXNzIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi90dW5uZWxNb2RlbC5qcyc7XG5pbXBvcnQgeyBnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlckRlbGVnYXRlRmFjdG9yeS5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5cbmV4cG9ydCBjb25zdCBvcGVuUHJldmlld0VuYWJsZWRDb250ZXh0ID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ29wZW5QcmV2aWV3RW5hYmxlZCcsIGZhbHNlKTtcblxuY2xhc3MgVHVubmVsVHJlZVZpcnR1YWxEZWxlZ2F0ZSBpbXBsZW1lbnRzIElUYWJsZVZpcnR1YWxEZWxlZ2F0ZTxJVHVubmVsSXRlbT4ge1xuXG5cdHJlYWRvbmx5IGhlYWRlclJvd0hlaWdodDogbnVtYmVyID0gMjI7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSByZW1vdGVFeHBsb3JlclNlcnZpY2U6IElSZW1vdGVFeHBsb3JlclNlcnZpY2UpIHsgfVxuXG5cdGdldEhlaWdodChyb3c6IElUdW5uZWxJdGVtKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gKHJvdy50dW5uZWxUeXBlID09PSBUdW5uZWxUeXBlLkFkZCAmJiAhdGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UuZ2V0RWRpdGFibGVEYXRhKHVuZGVmaW5lZCkpID8gMzAgOiAyMjtcblx0fVxufVxuXG5pbnRlcmZhY2UgSVR1bm5lbFZpZXdNb2RlbCB7XG5cdHJlYWRvbmx5IG9uRm9yd2FyZGVkUG9ydHNDaGFuZ2VkOiBFdmVudDx2b2lkPjtcblx0cmVhZG9ubHkgYWxsOiBUdW5uZWxJdGVtW107XG5cdHJlYWRvbmx5IGlucHV0OiBUdW5uZWxJdGVtO1xuXHRpc0VtcHR5KCk6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBUdW5uZWxWaWV3TW9kZWwgaW1wbGVtZW50cyBJVHVubmVsVmlld01vZGVsIHtcblxuXHRyZWFkb25seSBvbkZvcndhcmRlZFBvcnRzQ2hhbmdlZDogRXZlbnQ8dm9pZD47XG5cdHByaXZhdGUgbW9kZWw6IFR1bm5lbE1vZGVsO1xuXHRwcml2YXRlIF9jYW5kaWRhdGVzOiBNYXA8c3RyaW5nLCBDYW5kaWRhdGVQb3J0PiA9IG5ldyBNYXAoKTtcblxuXHRyZWFkb25seSBpbnB1dCA9IHtcblx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdyZW1vdGUudHVubmVsc1ZpZXcuYWRkUG9ydCcsIFwiQWRkIFBvcnRcIiksXG5cdFx0aWNvbjogdW5kZWZpbmVkLFxuXHRcdHR1bm5lbFR5cGU6IFR1bm5lbFR5cGUuQWRkLFxuXHRcdGhhc1J1bm5pbmdQcm9jZXNzOiBmYWxzZSxcblx0XHRyZW1vdGVIb3N0OiAnJyxcblx0XHRyZW1vdGVQb3J0OiAwLFxuXHRcdHByb2Nlc3NEZXNjcmlwdGlvbjogJycsXG5cdFx0dG9vbHRpcFBvc3RmaXg6ICcnLFxuXHRcdGljb25Ub29sdGlwOiAnJyxcblx0XHRwb3J0VG9vbHRpcDogJycsXG5cdFx0cHJvY2Vzc1Rvb2x0aXA6ICcnLFxuXHRcdG9yaWdpblRvb2x0aXA6ICcnLFxuXHRcdHByaXZhY3lUb29sdGlwOiAnJyxcblx0XHRzb3VyY2U6IHsgc291cmNlOiBUdW5uZWxTb3VyY2UuVXNlciwgZGVzY3JpcHRpb246ICcnIH0sXG5cdFx0cHJvdG9jb2w6IFR1bm5lbFByb3RvY29sLkh0dHAsXG5cdFx0cHJpdmFjeToge1xuXHRcdFx0aWQ6IFR1bm5lbFByaXZhY3lJZC5Qcml2YXRlLFxuXHRcdFx0dGhlbWVJY29uOiBwcml2YXRlUG9ydEljb24uaWQsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCd0dW5uZWxQcml2YWN5LnByaXZhdGUnLCBcIlByaXZhdGVcIilcblx0XHR9LFxuXHRcdHN0cmlwOiAoKSA9PiB1bmRlZmluZWRcblx0fTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVJlbW90ZUV4cGxvcmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHJlbW90ZUV4cGxvcmVyU2VydmljZTogSVJlbW90ZUV4cGxvcmVyU2VydmljZSxcblx0XHRASVR1bm5lbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0dW5uZWxTZXJ2aWNlOiBJVHVubmVsU2VydmljZVxuXHQpIHtcblx0XHR0aGlzLm1vZGVsID0gcmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsO1xuXHRcdHRoaXMub25Gb3J3YXJkZWRQb3J0c0NoYW5nZWQgPSBFdmVudC5hbnkodGhpcy5tb2RlbC5vbkZvcndhcmRQb3J0LCB0aGlzLm1vZGVsLm9uQ2xvc2VQb3J0LCB0aGlzLm1vZGVsLm9uUG9ydE5hbWUsIHRoaXMubW9kZWwub25DYW5kaWRhdGVzQ2hhbmdlZCk7XG5cdH1cblxuXHRnZXQgYWxsKCk6IFR1bm5lbEl0ZW1bXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBUdW5uZWxJdGVtW10gPSBbXTtcblx0XHR0aGlzLl9jYW5kaWRhdGVzID0gbmV3IE1hcCgpO1xuXHRcdHRoaXMubW9kZWwuY2FuZGlkYXRlcy5mb3JFYWNoKGNhbmRpZGF0ZSA9PiB7XG5cdFx0XHR0aGlzLl9jYW5kaWRhdGVzLnNldChtYWtlQWRkcmVzcyhjYW5kaWRhdGUuaG9zdCwgY2FuZGlkYXRlLnBvcnQpLCBjYW5kaWRhdGUpO1xuXHRcdH0pO1xuXHRcdGlmICgodGhpcy5tb2RlbC5mb3J3YXJkZWQuc2l6ZSA+IDApIHx8IHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLmdldEVkaXRhYmxlRGF0YSh1bmRlZmluZWQpKSB7XG5cdFx0XHRyZXN1bHQucHVzaCguLi50aGlzLmZvcndhcmRlZCk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLm1vZGVsLmRldGVjdGVkLnNpemUgPiAwKSB7XG5cdFx0XHRyZXN1bHQucHVzaCguLi50aGlzLmRldGVjdGVkKTtcblx0XHR9XG5cblx0XHRyZXN1bHQucHVzaCh0aGlzLmlucHV0KTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBhZGRQcm9jZXNzSW5mb0Zyb21DYW5kaWRhdGUodHVubmVsSXRlbTogSVR1bm5lbEl0ZW0pIHtcblx0XHRjb25zdCBrZXkgPSBtYWtlQWRkcmVzcyh0dW5uZWxJdGVtLnJlbW90ZUhvc3QsIHR1bm5lbEl0ZW0ucmVtb3RlUG9ydCk7XG5cdFx0aWYgKHRoaXMuX2NhbmRpZGF0ZXMuaGFzKGtleSkpIHtcblx0XHRcdHR1bm5lbEl0ZW0ucHJvY2Vzc0Rlc2NyaXB0aW9uID0gdGhpcy5fY2FuZGlkYXRlcy5nZXQoa2V5KSEuZGV0YWlsO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0IGZvcndhcmRlZCgpOiBUdW5uZWxJdGVtW10ge1xuXHRcdGNvbnN0IGZvcndhcmRlZCA9IEFycmF5LmZyb20odGhpcy5tb2RlbC5mb3J3YXJkZWQudmFsdWVzKCkpLm1hcCh0dW5uZWwgPT4ge1xuXHRcdFx0Y29uc3QgdHVubmVsSXRlbSA9IFR1bm5lbEl0ZW0uY3JlYXRlRnJvbVR1bm5lbCh0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZSwgdGhpcy50dW5uZWxTZXJ2aWNlLCB0dW5uZWwpO1xuXHRcdFx0dGhpcy5hZGRQcm9jZXNzSW5mb0Zyb21DYW5kaWRhdGUodHVubmVsSXRlbSk7XG5cdFx0XHRyZXR1cm4gdHVubmVsSXRlbTtcblx0XHR9KS5zb3J0KChhOiBUdW5uZWxJdGVtLCBiOiBUdW5uZWxJdGVtKSA9PiB7XG5cdFx0XHRpZiAoYS5yZW1vdGVQb3J0ID09PSBiLnJlbW90ZVBvcnQpIHtcblx0XHRcdFx0cmV0dXJuIGEucmVtb3RlSG9zdCA8IGIucmVtb3RlSG9zdCA/IC0xIDogMTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBhLnJlbW90ZVBvcnQgPCBiLnJlbW90ZVBvcnQgPyAtMSA6IDE7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cmV0dXJuIGZvcndhcmRlZDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0IGRldGVjdGVkKCk6IFR1bm5lbEl0ZW1bXSB7XG5cdFx0cmV0dXJuIEFycmF5LmZyb20odGhpcy5tb2RlbC5kZXRlY3RlZC52YWx1ZXMoKSkubWFwKHR1bm5lbCA9PiB7XG5cdFx0XHRjb25zdCB0dW5uZWxJdGVtID0gVHVubmVsSXRlbS5jcmVhdGVGcm9tVHVubmVsKHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLCB0aGlzLnR1bm5lbFNlcnZpY2UsIHR1bm5lbCwgVHVubmVsVHlwZS5EZXRlY3RlZCwgZmFsc2UpO1xuXHRcdFx0dGhpcy5hZGRQcm9jZXNzSW5mb0Zyb21DYW5kaWRhdGUodHVubmVsSXRlbSk7XG5cdFx0XHRyZXR1cm4gdHVubmVsSXRlbTtcblx0XHR9KTtcblx0fVxuXG5cdGlzRW1wdHkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICh0aGlzLmRldGVjdGVkLmxlbmd0aCA9PT0gMCkgJiZcblx0XHRcdCgodGhpcy5mb3J3YXJkZWQubGVuZ3RoID09PSAwKSB8fCAodGhpcy5mb3J3YXJkZWQubGVuZ3RoID09PSAxICYmXG5cdFx0XHRcdCh0aGlzLmZvcndhcmRlZFswXS50dW5uZWxUeXBlID09PSBUdW5uZWxUeXBlLkFkZCkgJiYgIXRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLmdldEVkaXRhYmxlRGF0YSh1bmRlZmluZWQpKSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gZW1wdHlDZWxsKGl0ZW06IElUdW5uZWxJdGVtKTogQWN0aW9uQmFyQ2VsbCB7XG5cdHJldHVybiB7IGxhYmVsOiAnJywgdHVubmVsOiBpdGVtLCBlZGl0SWQ6IFR1bm5lbEVkaXRJZC5Ob25lLCB0b29sdGlwOiAnJyB9O1xufVxuXG5jbGFzcyBJY29uQ29sdW1uIGltcGxlbWVudHMgSVRhYmxlQ29sdW1uPElUdW5uZWxJdGVtLCBBY3Rpb25CYXJDZWxsPiB7XG5cdHJlYWRvbmx5IGxhYmVsOiBzdHJpbmcgPSAnJztcblx0cmVhZG9ubHkgdG9vbHRpcDogc3RyaW5nID0gJyc7XG5cdHJlYWRvbmx5IHdlaWdodDogbnVtYmVyID0gMTtcblx0cmVhZG9ubHkgbWluaW11bVdpZHRoID0gNDA7XG5cdHJlYWRvbmx5IG1heGltdW1XaWR0aCA9IDQwO1xuXHRyZWFkb25seSB0ZW1wbGF0ZUlkOiBzdHJpbmcgPSAnYWN0aW9uYmFyJztcblx0cHJvamVjdChyb3c6IElUdW5uZWxJdGVtKTogQWN0aW9uQmFyQ2VsbCB7XG5cdFx0aWYgKHJvdy50dW5uZWxUeXBlID09PSBUdW5uZWxUeXBlLkFkZCkge1xuXHRcdFx0cmV0dXJuIGVtcHR5Q2VsbChyb3cpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGljb24gPSByb3cucHJvY2Vzc0Rlc2NyaXB0aW9uID8gZm9yd2FyZGVkUG9ydFdpdGhQcm9jZXNzSWNvbiA6IGZvcndhcmRlZFBvcnRXaXRob3V0UHJvY2Vzc0ljb247XG5cdFx0bGV0IHRvb2x0aXA6IHN0cmluZyA9ICcnO1xuXHRcdGlmIChyb3cgaW5zdGFuY2VvZiBUdW5uZWxJdGVtKSB7XG5cdFx0XHR0b29sdGlwID0gYCR7cm93Lmljb25Ub29sdGlwfSAke3Jvdy50b29sdGlwUG9zdGZpeH1gO1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0bGFiZWw6ICcnLCBpY29uLCB0dW5uZWw6IHJvdywgZWRpdElkOiBUdW5uZWxFZGl0SWQuTm9uZSwgdG9vbHRpcFxuXHRcdH07XG5cdH1cbn1cblxuY2xhc3MgUG9ydENvbHVtbiBpbXBsZW1lbnRzIElUYWJsZUNvbHVtbjxJVHVubmVsSXRlbSwgQWN0aW9uQmFyQ2VsbD4ge1xuXHRyZWFkb25seSBsYWJlbDogc3RyaW5nID0gbmxzLmxvY2FsaXplKCd0dW5uZWwucG9ydENvbHVtbi5sYWJlbCcsIFwiUG9ydFwiKTtcblx0cmVhZG9ubHkgdG9vbHRpcDogc3RyaW5nID0gbmxzLmxvY2FsaXplKCd0dW5uZWwucG9ydENvbHVtbi50b29sdGlwJywgXCJUaGUgbGFiZWwgYW5kIHJlbW90ZSBwb3J0IG51bWJlciBvZiB0aGUgZm9yd2FyZGVkIHBvcnQuXCIpO1xuXHRyZWFkb25seSB3ZWlnaHQ6IG51bWJlciA9IDE7XG5cdHJlYWRvbmx5IHRlbXBsYXRlSWQ6IHN0cmluZyA9ICdhY3Rpb25iYXInO1xuXHRwcm9qZWN0KHJvdzogSVR1bm5lbEl0ZW0pOiBBY3Rpb25CYXJDZWxsIHtcblx0XHRjb25zdCBpc0FkZCA9IHJvdy50dW5uZWxUeXBlID09PSBUdW5uZWxUeXBlLkFkZDtcblx0XHRjb25zdCBsYWJlbCA9IHJvdy5sYWJlbDtcblx0XHRsZXQgdG9vbHRpcDogc3RyaW5nID0gJyc7XG5cdFx0aWYgKHJvdyBpbnN0YW5jZW9mIFR1bm5lbEl0ZW0gJiYgIWlzQWRkKSB7XG5cdFx0XHR0b29sdGlwID0gYCR7cm93LnBvcnRUb29sdGlwfSAke3Jvdy50b29sdGlwUG9zdGZpeH1gO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0b29sdGlwID0gbGFiZWw7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRsYWJlbCwgdHVubmVsOiByb3csIG1lbnVJZDogTWVudUlkLlR1bm5lbFBvcnRJbmxpbmUsXG5cdFx0XHRlZGl0SWQ6IHJvdy50dW5uZWxUeXBlID09PSBUdW5uZWxUeXBlLkFkZCA/IFR1bm5lbEVkaXRJZC5OZXcgOiBUdW5uZWxFZGl0SWQuTGFiZWwsIHRvb2x0aXBcblx0XHR9O1xuXHR9XG59XG5cbmNsYXNzIExvY2FsQWRkcmVzc0NvbHVtbiBpbXBsZW1lbnRzIElUYWJsZUNvbHVtbjxJVHVubmVsSXRlbSwgQWN0aW9uQmFyQ2VsbD4ge1xuXHRyZWFkb25seSBsYWJlbDogc3RyaW5nID0gbmxzLmxvY2FsaXplKCd0dW5uZWwuYWRkcmVzc0NvbHVtbi5sYWJlbCcsIFwiRm9yd2FyZGVkIEFkZHJlc3NcIik7XG5cdHJlYWRvbmx5IHRvb2x0aXA6IHN0cmluZyA9IG5scy5sb2NhbGl6ZSgndHVubmVsLmFkZHJlc3NDb2x1bW4udG9vbHRpcCcsIFwiVGhlIGFkZHJlc3MgdGhhdCB0aGUgZm9yd2FyZGVkIHBvcnQgaXMgYXZhaWxhYmxlIGF0LlwiKTtcblx0cmVhZG9ubHkgd2VpZ2h0OiBudW1iZXIgPSAxO1xuXHRyZWFkb25seSB0ZW1wbGF0ZUlkOiBzdHJpbmcgPSAnYWN0aW9uYmFyJztcblx0cHJvamVjdChyb3c6IElUdW5uZWxJdGVtKTogQWN0aW9uQmFyQ2VsbCB7XG5cdFx0aWYgKHJvdy50dW5uZWxUeXBlID09PSBUdW5uZWxUeXBlLkFkZCkge1xuXHRcdFx0cmV0dXJuIGVtcHR5Q2VsbChyb3cpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxhYmVsID0gcm93LmxvY2FsQWRkcmVzcyA/PyAnJztcblx0XHRsZXQgdG9vbHRpcDogc3RyaW5nID0gbGFiZWw7XG5cdFx0aWYgKHJvdyBpbnN0YW5jZW9mIFR1bm5lbEl0ZW0pIHtcblx0XHRcdHRvb2x0aXAgPSByb3cudG9vbHRpcFBvc3RmaXg7XG5cdFx0fVxuXHRcdHJldHVybiB7XG5cdFx0XHRsYWJlbCxcblx0XHRcdG1lbnVJZDogTWVudUlkLlR1bm5lbExvY2FsQWRkcmVzc0lubGluZSxcblx0XHRcdHR1bm5lbDogcm93LFxuXHRcdFx0ZWRpdElkOiBUdW5uZWxFZGl0SWQuTG9jYWxQb3J0LFxuXHRcdFx0dG9vbHRpcCxcblx0XHRcdG1hcmtkb3duVG9vbHRpcDogbGFiZWwgPyBMb2NhbEFkZHJlc3NDb2x1bW4uZ2V0SG92ZXJUZXh0KGxhYmVsKSA6IHVuZGVmaW5lZFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBnZXRIb3ZlclRleHQobG9jYWxBZGRyZXNzOiBzdHJpbmcpIHtcblx0XHRyZXR1cm4gZnVuY3Rpb24gKGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UpIHtcblx0XHRcdGNvbnN0IGVkaXRvckNvbmYgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTx7IG11bHRpQ3Vyc29yTW9kaWZpZXI6ICdjdHJsQ21kJyB8ICdhbHQnIH0+KCdlZGl0b3InKTtcblxuXHRcdFx0bGV0IGNsaWNrTGFiZWwgPSAnJztcblx0XHRcdGlmIChlZGl0b3JDb25mLm11bHRpQ3Vyc29yTW9kaWZpZXIgPT09ICdjdHJsQ21kJykge1xuXHRcdFx0XHRpZiAoaXNNYWNpbnRvc2gpIHtcblx0XHRcdFx0XHRjbGlja0xhYmVsID0gbmxzLmxvY2FsaXplKCdwb3J0c0xpbmsuZm9sbG93TGlua0FsdC5tYWMnLCBcIm9wdGlvbiArIGNsaWNrXCIpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNsaWNrTGFiZWwgPSBubHMubG9jYWxpemUoJ3BvcnRzTGluay5mb2xsb3dMaW5rQWx0JywgXCJhbHQgKyBjbGlja1wiKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0XHRcdFx0Y2xpY2tMYWJlbCA9IG5scy5sb2NhbGl6ZSgncG9ydHNMaW5rLmZvbGxvd0xpbmtDbWQnLCBcImNtZCArIGNsaWNrXCIpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNsaWNrTGFiZWwgPSBubHMubG9jYWxpemUoJ3BvcnRzTGluay5mb2xsb3dMaW5rQ3RybCcsIFwiY3RybCArIGNsaWNrXCIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG1hcmtkb3duID0gbmV3IE1hcmtkb3duU3RyaW5nKCcnLCB0cnVlKTtcblx0XHRcdGNvbnN0IHVyaSA9IGxvY2FsQWRkcmVzcy5zdGFydHNXaXRoKCdodHRwJykgPyBsb2NhbEFkZHJlc3MgOiBgaHR0cDovLyR7bG9jYWxBZGRyZXNzfWA7XG5cdFx0XHRyZXR1cm4gbWFya2Rvd24uYXBwZW5kTGluayh1cmksICdGb2xsb3cgbGluaycpLmFwcGVuZE1hcmtkb3duKGAgKCR7Y2xpY2tMYWJlbH0pYCk7XG5cdFx0fTtcblx0fVxufVxuXG5jbGFzcyBSdW5uaW5nUHJvY2Vzc0NvbHVtbiBpbXBsZW1lbnRzIElUYWJsZUNvbHVtbjxJVHVubmVsSXRlbSwgQWN0aW9uQmFyQ2VsbD4ge1xuXHRyZWFkb25seSBsYWJlbDogc3RyaW5nID0gbmxzLmxvY2FsaXplKCd0dW5uZWwucHJvY2Vzc0NvbHVtbi5sYWJlbCcsIFwiUnVubmluZyBQcm9jZXNzXCIpO1xuXHRyZWFkb25seSB0b29sdGlwOiBzdHJpbmcgPSBubHMubG9jYWxpemUoJ3R1bm5lbC5wcm9jZXNzQ29sdW1uLnRvb2x0aXAnLCBcIlRoZSBjb21tYW5kIGxpbmUgb2YgdGhlIHByb2Nlc3MgdGhhdCBpcyB1c2luZyB0aGUgcG9ydC5cIik7XG5cdHJlYWRvbmx5IHdlaWdodDogbnVtYmVyID0gMjtcblx0cmVhZG9ubHkgdGVtcGxhdGVJZDogc3RyaW5nID0gJ2FjdGlvbmJhcic7XG5cdHByb2plY3Qocm93OiBJVHVubmVsSXRlbSk6IEFjdGlvbkJhckNlbGwge1xuXHRcdGlmIChyb3cudHVubmVsVHlwZSA9PT0gVHVubmVsVHlwZS5BZGQpIHtcblx0XHRcdHJldHVybiBlbXB0eUNlbGwocm93KTtcblx0XHR9XG5cblx0XHRjb25zdCBsYWJlbCA9IHJvdy5wcm9jZXNzRGVzY3JpcHRpb24gPz8gJyc7XG5cdFx0cmV0dXJuIHsgbGFiZWwsIHR1bm5lbDogcm93LCBlZGl0SWQ6IFR1bm5lbEVkaXRJZC5Ob25lLCB0b29sdGlwOiByb3cgaW5zdGFuY2VvZiBUdW5uZWxJdGVtID8gcm93LnByb2Nlc3NUb29sdGlwIDogJycgfTtcblx0fVxufVxuXG5jbGFzcyBPcmlnaW5Db2x1bW4gaW1wbGVtZW50cyBJVGFibGVDb2x1bW48SVR1bm5lbEl0ZW0sIEFjdGlvbkJhckNlbGw+IHtcblx0cmVhZG9ubHkgbGFiZWw6IHN0cmluZyA9IG5scy5sb2NhbGl6ZSgndHVubmVsLm9yaWdpbkNvbHVtbi5sYWJlbCcsIFwiT3JpZ2luXCIpO1xuXHRyZWFkb25seSB0b29sdGlwOiBzdHJpbmcgPSBubHMubG9jYWxpemUoJ3R1bm5lbC5vcmlnaW5Db2x1bW4udG9vbHRpcCcsIFwiVGhlIHNvdXJjZSB0aGF0IGEgZm9yd2FyZGVkIHBvcnQgb3JpZ2luYXRlcyBmcm9tLiBDYW4gYmUgYW4gZXh0ZW5zaW9uLCB1c2VyIGZvcndhcmRlZCwgc3RhdGljYWxseSBmb3J3YXJkZWQsIG9yIGF1dG9tYXRpY2FsbHkgZm9yd2FyZGVkLlwiKTtcblx0cmVhZG9ubHkgd2VpZ2h0OiBudW1iZXIgPSAxO1xuXHRyZWFkb25seSB0ZW1wbGF0ZUlkOiBzdHJpbmcgPSAnYWN0aW9uYmFyJztcblx0cHJvamVjdChyb3c6IElUdW5uZWxJdGVtKTogQWN0aW9uQmFyQ2VsbCB7XG5cdFx0aWYgKHJvdy50dW5uZWxUeXBlID09PSBUdW5uZWxUeXBlLkFkZCkge1xuXHRcdFx0cmV0dXJuIGVtcHR5Q2VsbChyb3cpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxhYmVsID0gcm93LnNvdXJjZS5kZXNjcmlwdGlvbjtcblx0XHRjb25zdCB0b29sdGlwID0gYCR7cm93IGluc3RhbmNlb2YgVHVubmVsSXRlbSA/IHJvdy5vcmlnaW5Ub29sdGlwIDogJyd9LiAke3JvdyBpbnN0YW5jZW9mIFR1bm5lbEl0ZW0gPyByb3cudG9vbHRpcFBvc3RmaXggOiAnJ31gO1xuXHRcdHJldHVybiB7IGxhYmVsLCBtZW51SWQ6IE1lbnVJZC5UdW5uZWxPcmlnaW5JbmxpbmUsIHR1bm5lbDogcm93LCBlZGl0SWQ6IFR1bm5lbEVkaXRJZC5Ob25lLCB0b29sdGlwIH07XG5cdH1cbn1cblxuY2xhc3MgUHJpdmFjeUNvbHVtbiBpbXBsZW1lbnRzIElUYWJsZUNvbHVtbjxJVHVubmVsSXRlbSwgQWN0aW9uQmFyQ2VsbD4ge1xuXHRyZWFkb25seSBsYWJlbDogc3RyaW5nID0gbmxzLmxvY2FsaXplKCd0dW5uZWwucHJpdmFjeUNvbHVtbi5sYWJlbCcsIFwiVmlzaWJpbGl0eVwiKTtcblx0cmVhZG9ubHkgdG9vbHRpcDogc3RyaW5nID0gbmxzLmxvY2FsaXplKCd0dW5uZWwucHJpdmFjeUNvbHVtbi50b29sdGlwJywgXCJUaGUgYXZhaWxhYmlsaXR5IG9mIHRoZSBmb3J3YXJkZWQgcG9ydC5cIik7XG5cdHJlYWRvbmx5IHdlaWdodDogbnVtYmVyID0gMTtcblx0cmVhZG9ubHkgdGVtcGxhdGVJZDogc3RyaW5nID0gJ2FjdGlvbmJhcic7XG5cdHByb2plY3Qocm93OiBJVHVubmVsSXRlbSk6IEFjdGlvbkJhckNlbGwge1xuXHRcdGlmIChyb3cudHVubmVsVHlwZSA9PT0gVHVubmVsVHlwZS5BZGQpIHtcblx0XHRcdHJldHVybiBlbXB0eUNlbGwocm93KTtcblx0XHR9XG5cblx0XHRjb25zdCBsYWJlbCA9IHJvdy5wcml2YWN5Py5sYWJlbDtcblx0XHRsZXQgdG9vbHRpcDogc3RyaW5nID0gJyc7XG5cdFx0aWYgKHJvdyBpbnN0YW5jZW9mIFR1bm5lbEl0ZW0pIHtcblx0XHRcdHRvb2x0aXAgPSBgJHtyb3cucHJpdmFjeS5sYWJlbH0gJHtyb3cudG9vbHRpcFBvc3RmaXh9YDtcblx0XHR9XG5cdFx0cmV0dXJuIHsgbGFiZWwsIHR1bm5lbDogcm93LCBpY29uOiB7IGlkOiByb3cucHJpdmFjeS50aGVtZUljb24gfSwgZWRpdElkOiBUdW5uZWxFZGl0SWQuTm9uZSwgdG9vbHRpcCB9O1xuXHR9XG59XG5cbmludGVyZmFjZSBJQWN0aW9uQmFyVGVtcGxhdGVEYXRhIHtcblx0ZWxlbWVudERpc3Bvc2FibGU6IElEaXNwb3NhYmxlO1xuXHRjb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRsYWJlbDogSWNvbkxhYmVsO1xuXHRidXR0b24/OiBCdXR0b247XG5cdGljb246IEhUTUxFbGVtZW50O1xuXHRhY3Rpb25CYXI6IEFjdGlvbkJhcjtcbn1cblxuaW50ZXJmYWNlIEFjdGlvbkJhckNlbGwge1xuXHRsYWJlbDogc3RyaW5nO1xuXHRpY29uPzogVGhlbWVJY29uO1xuXHR0b29sdGlwOiBzdHJpbmc7XG5cdG1hcmtkb3duVG9vbHRpcD86IChjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSA9PiBJTWFya2Rvd25TdHJpbmc7XG5cdG1lbnVJZD86IE1lbnVJZDtcblx0dHVubmVsOiBJVHVubmVsSXRlbTtcblx0ZWRpdElkOiBUdW5uZWxFZGl0SWQ7XG59XG5cbmNsYXNzIEFjdGlvbkJhclJlbmRlcmVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElUYWJsZVJlbmRlcmVyPEFjdGlvbkJhckNlbGwsIElBY3Rpb25CYXJUZW1wbGF0ZURhdGE+IHtcblx0cmVhZG9ubHkgdGVtcGxhdGVJZCA9ICdhY3Rpb25iYXInO1xuXHRwcml2YXRlIGlucHV0RG9uZT86IChzdWNjZXNzOiBib29sZWFuLCBmaW5pc2hFZGl0aW5nOiBib29sZWFuKSA9PiB2b2lkO1xuXHRwcml2YXRlIF9hY3Rpb25SdW5uZXI6IEFjdGlvblJ1bm5lciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBfaG92ZXJEZWxlZ2F0ZTogSUhvdmVyRGVsZWdhdGU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1lbnVTZXJ2aWNlOiBJTWVudVNlcnZpY2UsXG5cdFx0QElDb250ZXh0Vmlld1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0Vmlld1NlcnZpY2U6IElDb250ZXh0Vmlld1NlcnZpY2UsXG5cdFx0QElSZW1vdGVFeHBsb3JlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSByZW1vdGVFeHBsb3JlclNlcnZpY2U6IElSZW1vdGVFeHBsb3JlclNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9ob3ZlckRlbGVnYXRlID0gZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ21vdXNlJyk7XG5cdH1cblxuXHRzZXQgYWN0aW9uUnVubmVyKGFjdGlvblJ1bm5lcjogQWN0aW9uUnVubmVyKSB7XG5cdFx0dGhpcy5fYWN0aW9uUnVubmVyID0gYWN0aW9uUnVubmVyO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElBY3Rpb25CYXJUZW1wbGF0ZURhdGEge1xuXHRcdGNvbnN0IGNlbGwgPSBkb20uYXBwZW5kKGNvbnRhaW5lciwgZG9tLiQoJy5wb3J0cy12aWV3LWFjdGlvbmJhci1jZWxsJykpO1xuXHRcdGNvbnN0IGljb24gPSBkb20uYXBwZW5kKGNlbGwsIGRvbS4kKCcucG9ydHMtdmlldy1hY3Rpb25iYXItY2VsbC1pY29uJykpO1xuXHRcdGNvbnN0IGxhYmVsID0gbmV3IEljb25MYWJlbChjZWxsLFxuXHRcdFx0e1xuXHRcdFx0XHRzdXBwb3J0SGlnaGxpZ2h0czogdHJ1ZSxcblx0XHRcdFx0aG92ZXJEZWxlZ2F0ZTogdGhpcy5faG92ZXJEZWxlZ2F0ZVxuXHRcdFx0fSk7XG5cdFx0Y29uc3QgYWN0aW9uc0NvbnRhaW5lciA9IGRvbS5hcHBlbmQoY2VsbCwgZG9tLiQoJy5hY3Rpb25zJykpO1xuXHRcdGNvbnN0IGFjdGlvbkJhciA9IG5ldyBBY3Rpb25CYXIoYWN0aW9uc0NvbnRhaW5lciwge1xuXHRcdFx0YWN0aW9uVmlld0l0ZW1Qcm92aWRlcjogY3JlYXRlQWN0aW9uVmlld0l0ZW0uYmluZCh1bmRlZmluZWQsIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UpLFxuXHRcdFx0aG92ZXJEZWxlZ2F0ZTogdGhpcy5faG92ZXJEZWxlZ2F0ZVxuXHRcdH0pO1xuXHRcdHJldHVybiB7IGxhYmVsLCBpY29uLCBhY3Rpb25CYXIsIGNvbnRhaW5lcjogY2VsbCwgZWxlbWVudERpc3Bvc2FibGU6IERpc3Bvc2FibGUuTm9uZSB9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChlbGVtZW50OiBBY3Rpb25CYXJDZWxsLCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElBY3Rpb25CYXJUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHQvLyByZXNldFxuXHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIuY2xlYXIoKTtcblx0XHR0ZW1wbGF0ZURhdGEuaWNvbi5jbGFzc05hbWUgPSAncG9ydHMtdmlldy1hY3Rpb25iYXItY2VsbC1pY29uJztcblx0XHR0ZW1wbGF0ZURhdGEuaWNvbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdHRlbXBsYXRlRGF0YS5sYWJlbC5zZXRMYWJlbCgnJyk7XG5cdFx0dGVtcGxhdGVEYXRhLmxhYmVsLmVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0XHR0ZW1wbGF0ZURhdGEuY29udGFpbmVyLnN0eWxlLmhlaWdodCA9ICcyMnB4Jztcblx0XHRpZiAodGVtcGxhdGVEYXRhLmJ1dHRvbikge1xuXHRcdFx0dGVtcGxhdGVEYXRhLmJ1dHRvbi5lbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuYnV0dG9uLmRpc3Bvc2UoKTtcblx0XHR9XG5cdFx0dGVtcGxhdGVEYXRhLmNvbnRhaW5lci5zdHlsZS5wYWRkaW5nTGVmdCA9ICcwcHgnO1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cblx0XHRsZXQgZWRpdGFibGVEYXRhOiBJRWRpdGFibGVEYXRhIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChlbGVtZW50LmVkaXRJZCA9PT0gVHVubmVsRWRpdElkLk5ldyAmJiAoZWRpdGFibGVEYXRhID0gdGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UuZ2V0RWRpdGFibGVEYXRhKHVuZGVmaW5lZCkpKSB7XG5cdFx0XHR0aGlzLnJlbmRlcklucHV0Qm94KHRlbXBsYXRlRGF0YS5jb250YWluZXIsIGVkaXRhYmxlRGF0YSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGVkaXRhYmxlRGF0YSA9IHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLmdldEVkaXRhYmxlRGF0YShlbGVtZW50LnR1bm5lbCwgZWxlbWVudC5lZGl0SWQpO1xuXHRcdFx0aWYgKGVkaXRhYmxlRGF0YSkge1xuXHRcdFx0XHR0aGlzLnJlbmRlcklucHV0Qm94KHRlbXBsYXRlRGF0YS5jb250YWluZXIsIGVkaXRhYmxlRGF0YSk7XG5cdFx0XHR9IGVsc2UgaWYgKChlbGVtZW50LnR1bm5lbC50dW5uZWxUeXBlID09PSBUdW5uZWxUeXBlLkFkZCkgJiYgKGVsZW1lbnQubWVudUlkID09PSBNZW51SWQuVHVubmVsUG9ydElubGluZSkpIHtcblx0XHRcdFx0dGhpcy5yZW5kZXJCdXR0b24oZWxlbWVudCwgdGVtcGxhdGVEYXRhKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMucmVuZGVyQWN0aW9uQmFySXRlbShlbGVtZW50LCB0ZW1wbGF0ZURhdGEpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHJlbmRlckJ1dHRvbihlbGVtZW50OiBBY3Rpb25CYXJDZWxsLCB0ZW1wbGF0ZURhdGE6IElBY3Rpb25CYXJUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuY29udGFpbmVyLnN0eWxlLnBhZGRpbmdMZWZ0ID0gJzdweCc7XG5cdFx0dGVtcGxhdGVEYXRhLmNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSAnMjhweCc7XG5cdFx0dGVtcGxhdGVEYXRhLmJ1dHRvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBCdXR0b24odGVtcGxhdGVEYXRhLmNvbnRhaW5lciwgZGVmYXVsdEJ1dHRvblN0eWxlcykpO1xuXHRcdHRlbXBsYXRlRGF0YS5idXR0b24ubGFiZWwgPSBlbGVtZW50LmxhYmVsO1xuXHRcdHRlbXBsYXRlRGF0YS5idXR0b24uZWxlbWVudC50aXRsZSA9IGVsZW1lbnQudG9vbHRpcDtcblx0XHR0aGlzLl9yZWdpc3Rlcih0ZW1wbGF0ZURhdGEuYnV0dG9uLm9uRGlkQ2xpY2soKCkgPT4ge1xuXHRcdFx0dGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChGb3J3YXJkUG9ydEFjdGlvbi5JTkxJTkVfSUQpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgdHVubmVsQ29udGV4dCh0dW5uZWw6IElUdW5uZWxJdGVtKTogSVR1bm5lbEl0ZW0ge1xuXHRcdGxldCBjb250ZXh0OiBJVHVubmVsSXRlbSB8IHVuZGVmaW5lZDtcblx0XHRpZiAodHVubmVsIGluc3RhbmNlb2YgVHVubmVsSXRlbSkge1xuXHRcdFx0Y29udGV4dCA9IHR1bm5lbC5zdHJpcCgpO1xuXHRcdH1cblx0XHRpZiAoIWNvbnRleHQpIHtcblx0XHRcdGNvbnRleHQgPSB7XG5cdFx0XHRcdHR1bm5lbFR5cGU6IHR1bm5lbC50dW5uZWxUeXBlLFxuXHRcdFx0XHRyZW1vdGVIb3N0OiB0dW5uZWwucmVtb3RlSG9zdCxcblx0XHRcdFx0cmVtb3RlUG9ydDogdHVubmVsLnJlbW90ZVBvcnQsXG5cdFx0XHRcdGxvY2FsQWRkcmVzczogdHVubmVsLmxvY2FsQWRkcmVzcyxcblx0XHRcdFx0cHJvdG9jb2w6IHR1bm5lbC5wcm90b2NvbCxcblx0XHRcdFx0bG9jYWxVcmk6IHR1bm5lbC5sb2NhbFVyaSxcblx0XHRcdFx0bG9jYWxQb3J0OiB0dW5uZWwubG9jYWxQb3J0LFxuXHRcdFx0XHRuYW1lOiB0dW5uZWwubmFtZSxcblx0XHRcdFx0Y2xvc2VhYmxlOiB0dW5uZWwuY2xvc2VhYmxlLFxuXHRcdFx0XHRzb3VyY2U6IHR1bm5lbC5zb3VyY2UsXG5cdFx0XHRcdHByaXZhY3k6IHR1bm5lbC5wcml2YWN5LFxuXHRcdFx0XHRwcm9jZXNzRGVzY3JpcHRpb246IHR1bm5lbC5wcm9jZXNzRGVzY3JpcHRpb24sXG5cdFx0XHRcdGxhYmVsOiB0dW5uZWwubGFiZWxcblx0XHRcdH07XG5cdFx0fVxuXHRcdHJldHVybiBjb250ZXh0O1xuXHR9XG5cblx0cmVuZGVyQWN0aW9uQmFySXRlbShlbGVtZW50OiBBY3Rpb25CYXJDZWxsLCB0ZW1wbGF0ZURhdGE6IElBY3Rpb25CYXJUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEubGFiZWwuZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ2ZsZXgnO1xuXHRcdHRlbXBsYXRlRGF0YS5sYWJlbC5zZXRMYWJlbChlbGVtZW50LmxhYmVsLCB1bmRlZmluZWQsXG5cdFx0XHR7XG5cdFx0XHRcdHRpdGxlOiBlbGVtZW50Lm1hcmtkb3duVG9vbHRpcCA/XG5cdFx0XHRcdFx0eyBtYXJrZG93bjogZWxlbWVudC5tYXJrZG93blRvb2x0aXAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSksIG1hcmtkb3duTm90U3VwcG9ydGVkRmFsbGJhY2s6IGVsZW1lbnQudG9vbHRpcCB9XG5cdFx0XHRcdFx0OiBlbGVtZW50LnRvb2x0aXAsXG5cdFx0XHRcdGV4dHJhQ2xhc3NlczogZWxlbWVudC5tZW51SWQgPT09IE1lbnVJZC5UdW5uZWxMb2NhbEFkZHJlc3NJbmxpbmUgPyBbJ3BvcnRzLXZpZXctYWN0aW9uYmFyLWNlbGwtbG9jYWxhZGRyZXNzJ10gOiB1bmRlZmluZWRcblx0XHRcdH0pO1xuXHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIuY29udGV4dCA9IHRoaXMudHVubmVsQ29udGV4dChlbGVtZW50LnR1bm5lbCk7XG5cdFx0dGVtcGxhdGVEYXRhLmNvbnRhaW5lci5zdHlsZS5wYWRkaW5nTGVmdCA9ICcxMHB4Jztcblx0XHRjb25zdCBjb250ZXh0OiBbc3RyaW5nLCBhbnldW10gPVxuXHRcdFx0W1xuXHRcdFx0XHRbJ3ZpZXcnLCBUVU5ORUxfVklFV19JRF0sXG5cdFx0XHRcdFtUdW5uZWxUeXBlQ29udGV4dEtleS5rZXksIGVsZW1lbnQudHVubmVsLnR1bm5lbFR5cGVdLFxuXHRcdFx0XHRbVHVubmVsQ2xvc2VhYmxlQ29udGV4dEtleS5rZXksIGVsZW1lbnQudHVubmVsLmNsb3NlYWJsZV0sXG5cdFx0XHRcdFtUdW5uZWxQcml2YWN5Q29udGV4dEtleS5rZXksIGVsZW1lbnQudHVubmVsLnByaXZhY3kuaWRdLFxuXHRcdFx0XHRbVHVubmVsUHJvdG9jb2xDb250ZXh0S2V5LmtleSwgZWxlbWVudC50dW5uZWwucHJvdG9jb2xdXG5cdFx0XHRdO1xuXHRcdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gdGhpcy5jb250ZXh0S2V5U2VydmljZS5jcmVhdGVPdmVybGF5KGNvbnRleHQpO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGUgPSBkaXNwb3NhYmxlU3RvcmU7XG5cdFx0aWYgKGVsZW1lbnQubWVudUlkKSB7XG5cdFx0XHRjb25zdCBtZW51ID0gZGlzcG9zYWJsZVN0b3JlLmFkZCh0aGlzLm1lbnVTZXJ2aWNlLmNyZWF0ZU1lbnUoZWxlbWVudC5tZW51SWQsIGNvbnRleHRLZXlTZXJ2aWNlKSk7XG5cdFx0XHRsZXQgYWN0aW9ucyA9IGdldEZsYXRBY3Rpb25CYXJBY3Rpb25zKG1lbnUuZ2V0QWN0aW9ucyh7IHNob3VsZEZvcndhcmRBcmdzOiB0cnVlIH0pKTtcblx0XHRcdGlmIChhY3Rpb25zKSB7XG5cdFx0XHRcdGNvbnN0IGxhYmVsQWN0aW9ucyA9IGFjdGlvbnMuZmlsdGVyKGFjdGlvbiA9PiBhY3Rpb24uaWQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdsYWJlbCcpID49IDApO1xuXHRcdFx0XHRpZiAobGFiZWxBY3Rpb25zLmxlbmd0aCA+IDEpIHtcblx0XHRcdFx0XHRsYWJlbEFjdGlvbnMuc29ydCgoYSwgYikgPT4gYS5sYWJlbC5sZW5ndGggLSBiLmxhYmVsLmxlbmd0aCk7XG5cdFx0XHRcdFx0bGFiZWxBY3Rpb25zLnBvcCgpO1xuXHRcdFx0XHRcdGFjdGlvbnMgPSBhY3Rpb25zLmZpbHRlcihhY3Rpb24gPT4gbGFiZWxBY3Rpb25zLmluZGV4T2YoYWN0aW9uKSA8IDApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIucHVzaChhY3Rpb25zLCB7IGljb246IHRydWUsIGxhYmVsOiBmYWxzZSB9KTtcblx0XHRcdFx0aWYgKHRoaXMuX2FjdGlvblJ1bm5lcikge1xuXHRcdFx0XHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIuYWN0aW9uUnVubmVyID0gdGhpcy5fYWN0aW9uUnVubmVyO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChlbGVtZW50Lmljb24pIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5pY29uLmNsYXNzTmFtZSA9IGBwb3J0cy12aWV3LWFjdGlvbmJhci1jZWxsLWljb24gJHtUaGVtZUljb24uYXNDbGFzc05hbWUoZWxlbWVudC5pY29uKX1gO1xuXHRcdFx0dGVtcGxhdGVEYXRhLmljb24udGl0bGUgPSBlbGVtZW50LnRvb2x0aXA7XG5cdFx0XHR0ZW1wbGF0ZURhdGEuaWNvbi5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJJbnB1dEJveChjb250YWluZXI6IEhUTUxFbGVtZW50LCBlZGl0YWJsZURhdGE6IElFZGl0YWJsZURhdGEpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Ly8gUmVxdWlyZWQgZm9yIEZpcmVGb3guIFRoZSBibHVyIGV2ZW50IGRvZXNuJ3QgZmlyZSBvbiBGaXJlRm94IHdoZW4geW91IGp1c3QgbWFzaCB0aGUgXCIrXCIgYnV0dG9uIHRvIGZvcndhcmQgYSBwb3J0LlxuXHRcdGlmICh0aGlzLmlucHV0RG9uZSkge1xuXHRcdFx0dGhpcy5pbnB1dERvbmUoZmFsc2UsIGZhbHNlKTtcblx0XHRcdHRoaXMuaW5wdXREb25lID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb250YWluZXIuc3R5bGUucGFkZGluZ0xlZnQgPSAnNXB4Jztcblx0XHRjb25zdCB2YWx1ZSA9IGVkaXRhYmxlRGF0YS5zdGFydGluZ1ZhbHVlIHx8ICcnO1xuXHRcdGNvbnN0IGlucHV0Qm94ID0gbmV3IElucHV0Qm94KGNvbnRhaW5lciwgdGhpcy5jb250ZXh0Vmlld1NlcnZpY2UsIHtcblx0XHRcdGFyaWFMYWJlbDogbmxzLmxvY2FsaXplKCdyZW1vdGUudHVubmVsc1ZpZXcuaW5wdXQnLCBcIlByZXNzIEVudGVyIHRvIGNvbmZpcm0gb3IgRXNjYXBlIHRvIGNhbmNlbC5cIiksXG5cdFx0XHR2YWxpZGF0aW9uT3B0aW9uczoge1xuXHRcdFx0XHR2YWxpZGF0aW9uOiAodmFsdWUpID0+IHtcblx0XHRcdFx0XHRjb25zdCBtZXNzYWdlID0gZWRpdGFibGVEYXRhLnZhbGlkYXRpb25NZXNzYWdlKHZhbHVlKTtcblx0XHRcdFx0XHRpZiAoIW1lc3NhZ2UpIHtcblx0XHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRjb250ZW50OiBtZXNzYWdlLmNvbnRlbnQsXG5cdFx0XHRcdFx0XHRmb3JtYXRDb250ZW50OiB0cnVlLFxuXHRcdFx0XHRcdFx0dHlwZTogbWVzc2FnZS5zZXZlcml0eSA9PT0gU2V2ZXJpdHkuRXJyb3IgPyBNZXNzYWdlVHlwZS5FUlJPUiA6IE1lc3NhZ2VUeXBlLklORk9cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0cGxhY2Vob2xkZXI6IGVkaXRhYmxlRGF0YS5wbGFjZWhvbGRlciB8fCAnJyxcblx0XHRcdGlucHV0Qm94U3R5bGVzOiBkZWZhdWx0SW5wdXRCb3hTdHlsZXNcblx0XHR9KTtcblx0XHRpbnB1dEJveC52YWx1ZSA9IHZhbHVlO1xuXHRcdGlucHV0Qm94LmZvY3VzKCk7XG5cdFx0aW5wdXRCb3guc2VsZWN0KHsgc3RhcnQ6IDAsIGVuZDogZWRpdGFibGVEYXRhLnN0YXJ0aW5nVmFsdWUgPyBlZGl0YWJsZURhdGEuc3RhcnRpbmdWYWx1ZS5sZW5ndGggOiAwIH0pO1xuXG5cdFx0Y29uc3QgZG9uZSA9IGNyZWF0ZVNpbmdsZUNhbGxGdW5jdGlvbihhc3luYyAoc3VjY2VzczogYm9vbGVhbiwgZmluaXNoRWRpdGluZzogYm9vbGVhbikgPT4ge1xuXHRcdFx0ZGlzcG9zZSh0b0Rpc3Bvc2UpO1xuXHRcdFx0aWYgKHRoaXMuaW5wdXREb25lKSB7XG5cdFx0XHRcdHRoaXMuaW5wdXREb25lID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0aW5wdXRCb3guZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdFx0Y29uc3QgaW5wdXRWYWx1ZSA9IGlucHV0Qm94LnZhbHVlO1xuXHRcdFx0aWYgKGZpbmlzaEVkaXRpbmcpIHtcblx0XHRcdFx0cmV0dXJuIGVkaXRhYmxlRGF0YS5vbkZpbmlzaChpbnB1dFZhbHVlLCBzdWNjZXNzKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLmlucHV0RG9uZSA9IGRvbmU7XG5cblx0XHRjb25zdCB0b0Rpc3Bvc2UgPSBbXG5cdFx0XHRpbnB1dEJveCxcblx0XHRcdGRvbS5hZGRTdGFuZGFyZERpc3Bvc2FibGVMaXN0ZW5lcihpbnB1dEJveC5pbnB1dEVsZW1lbnQsIGRvbS5FdmVudFR5cGUuS0VZX0RPV04sIGFzeW5jIChlOiBJS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0XHRpZiAoZS5lcXVhbHMoS2V5Q29kZS5FbnRlcikpIHtcblx0XHRcdFx0XHRlLnN0b3BQcm9wYWdhdGlvbigpO1xuXHRcdFx0XHRcdGlmIChpbnB1dEJveC52YWxpZGF0ZSgpICE9PSBNZXNzYWdlVHlwZS5FUlJPUikge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGRvbmUodHJ1ZSwgdHJ1ZSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiBkb25lKGZhbHNlLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSBpZiAoZS5lcXVhbHMoS2V5Q29kZS5Fc2NhcGUpKSB7XG5cdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdFx0cmV0dXJuIGRvbmUoZmFsc2UsIHRydWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSxcblx0XHRcdGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoaW5wdXRCb3guaW5wdXRFbGVtZW50LCBkb20uRXZlbnRUeXBlLkJMVVIsICgpID0+IHtcblx0XHRcdFx0cmV0dXJuIGRvbmUoaW5wdXRCb3gudmFsaWRhdGUoKSAhPT0gTWVzc2FnZVR5cGUuRVJST1IsIHRydWUpO1xuXHRcdFx0fSlcblx0XHRdO1xuXG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRkb25lKGZhbHNlLCBmYWxzZSk7XG5cdFx0fSk7XG5cdH1cblxuXHRkaXNwb3NlRWxlbWVudChlbGVtZW50OiBBY3Rpb25CYXJDZWxsLCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElBY3Rpb25CYXJUZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElBY3Rpb25CYXJUZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEubGFiZWwuZGlzcG9zZSgpO1xuXHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIuZGlzcG9zZSgpO1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0dGVtcGxhdGVEYXRhLmJ1dHRvbj8uZGlzcG9zZSgpO1xuXHR9XG59XG5cbmNsYXNzIFR1bm5lbEl0ZW0gaW1wbGVtZW50cyBJVHVubmVsSXRlbSB7XG5cdHN0YXRpYyBjcmVhdGVGcm9tVHVubmVsKHJlbW90ZUV4cGxvcmVyU2VydmljZTogSVJlbW90ZUV4cGxvcmVyU2VydmljZSwgdHVubmVsU2VydmljZTogSVR1bm5lbFNlcnZpY2UsXG5cdFx0dHVubmVsOiBUdW5uZWwsIHR5cGU6IFR1bm5lbFR5cGUgPSBUdW5uZWxUeXBlLkZvcndhcmRlZCwgY2xvc2VhYmxlPzogYm9vbGVhbikge1xuXHRcdHJldHVybiBuZXcgVHVubmVsSXRlbSh0eXBlLFxuXHRcdFx0dHVubmVsLnJlbW90ZUhvc3QsXG5cdFx0XHR0dW5uZWwucmVtb3RlUG9ydCxcblx0XHRcdHR1bm5lbC5zb3VyY2UsXG5cdFx0XHQhIXR1bm5lbC5oYXNSdW5uaW5nUHJvY2Vzcyxcblx0XHRcdHR1bm5lbC5wcm90b2NvbCxcblx0XHRcdHR1bm5lbC5sb2NhbFVyaSxcblx0XHRcdHR1bm5lbC5sb2NhbEFkZHJlc3MsXG5cdFx0XHR0dW5uZWwubG9jYWxQb3J0LFxuXHRcdFx0Y2xvc2VhYmxlID09PSB1bmRlZmluZWQgPyB0dW5uZWwuY2xvc2VhYmxlIDogY2xvc2VhYmxlLFxuXHRcdFx0dHVubmVsLm5hbWUsXG5cdFx0XHR0dW5uZWwucnVubmluZ1Byb2Nlc3MsXG5cdFx0XHR0dW5uZWwucGlkLFxuXHRcdFx0dHVubmVsLnByaXZhY3ksXG5cdFx0XHRyZW1vdGVFeHBsb3JlclNlcnZpY2UsXG5cdFx0XHR0dW5uZWxTZXJ2aWNlKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZW1vdmVzIGFsbCBub24tc2VyaWFsaXphYmxlIHByb3BlcnRpZXMgZnJvbSB0aGUgdHVubmVsXG5cdCAqIEByZXR1cm5zIEEgbmV3IFR1bm5lbEl0ZW0gd2l0aG91dCBhbnkgc2VydmljZXNcblx0ICovXG5cdHB1YmxpYyBzdHJpcCgpOiBUdW5uZWxJdGVtIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gbmV3IFR1bm5lbEl0ZW0oXG5cdFx0XHR0aGlzLnR1bm5lbFR5cGUsXG5cdFx0XHR0aGlzLnJlbW90ZUhvc3QsXG5cdFx0XHR0aGlzLnJlbW90ZVBvcnQsXG5cdFx0XHR0aGlzLnNvdXJjZSxcblx0XHRcdHRoaXMuaGFzUnVubmluZ1Byb2Nlc3MsXG5cdFx0XHR0aGlzLnByb3RvY29sLFxuXHRcdFx0dGhpcy5sb2NhbFVyaSxcblx0XHRcdHRoaXMubG9jYWxBZGRyZXNzLFxuXHRcdFx0dGhpcy5sb2NhbFBvcnQsXG5cdFx0XHR0aGlzLmNsb3NlYWJsZSxcblx0XHRcdHRoaXMubmFtZSxcblx0XHRcdHRoaXMucnVubmluZ1Byb2Nlc3MsXG5cdFx0XHR0aGlzLnBpZCxcblx0XHRcdHRoaXMuX3ByaXZhY3lcblx0XHQpO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHR1bm5lbFR5cGU6IFR1bm5lbFR5cGUsXG5cdFx0cHVibGljIHJlbW90ZUhvc3Q6IHN0cmluZyxcblx0XHRwdWJsaWMgcmVtb3RlUG9ydDogbnVtYmVyLFxuXHRcdHB1YmxpYyBzb3VyY2U6IHsgc291cmNlOiBUdW5uZWxTb3VyY2U7IGRlc2NyaXB0aW9uOiBzdHJpbmcgfSxcblx0XHRwdWJsaWMgaGFzUnVubmluZ1Byb2Nlc3M6IGJvb2xlYW4sXG5cdFx0cHVibGljIHByb3RvY29sOiBUdW5uZWxQcm90b2NvbCxcblx0XHRwdWJsaWMgbG9jYWxVcmk/OiBVUkksXG5cdFx0cHVibGljIGxvY2FsQWRkcmVzcz86IHN0cmluZyxcblx0XHRwdWJsaWMgbG9jYWxQb3J0PzogbnVtYmVyLFxuXHRcdHB1YmxpYyBjbG9zZWFibGU/OiBib29sZWFuLFxuXHRcdHB1YmxpYyBuYW1lPzogc3RyaW5nLFxuXHRcdHByaXZhdGUgcnVubmluZ1Byb2Nlc3M/OiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSBwaWQ/OiBudW1iZXIsXG5cdFx0cHJpdmF0ZSBfcHJpdmFjeT86IFR1bm5lbFByaXZhY3lJZCB8IHN0cmluZyxcblx0XHRwcml2YXRlIHJlbW90ZUV4cGxvcmVyU2VydmljZT86IElSZW1vdGVFeHBsb3JlclNlcnZpY2UsXG5cdFx0cHJpdmF0ZSB0dW5uZWxTZXJ2aWNlPzogSVR1bm5lbFNlcnZpY2Vcblx0KSB7IH1cblxuXHRnZXQgbGFiZWwoKTogc3RyaW5nIHtcblx0XHRpZiAodGhpcy50dW5uZWxUeXBlID09PSBUdW5uZWxUeXBlLkFkZCAmJiB0aGlzLm5hbWUpIHtcblx0XHRcdHJldHVybiB0aGlzLm5hbWU7XG5cdFx0fVxuXHRcdGNvbnN0IHBvcnROdW1iZXJMYWJlbCA9IChpc0xvY2FsaG9zdCh0aGlzLnJlbW90ZUhvc3QpIHx8IGlzQWxsSW50ZXJmYWNlcyh0aGlzLnJlbW90ZUhvc3QpKVxuXHRcdFx0PyBgJHt0aGlzLnJlbW90ZVBvcnR9YFxuXHRcdFx0OiBgJHt0aGlzLnJlbW90ZUhvc3R9OiR7dGhpcy5yZW1vdGVQb3J0fWA7XG5cdFx0aWYgKHRoaXMubmFtZSkge1xuXHRcdFx0cmV0dXJuIGAke3RoaXMubmFtZX0gKCR7cG9ydE51bWJlckxhYmVsfSlgO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gcG9ydE51bWJlckxhYmVsO1xuXHRcdH1cblx0fVxuXG5cdHNldCBwcm9jZXNzRGVzY3JpcHRpb24oZGVzY3JpcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMucnVubmluZ1Byb2Nlc3MgPSBkZXNjcmlwdGlvbjtcblx0fVxuXG5cdGdldCBwcm9jZXNzRGVzY3JpcHRpb24oKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRsZXQgZGVzY3JpcHRpb246IHN0cmluZyA9ICcnO1xuXHRcdGlmICh0aGlzLnJ1bm5pbmdQcm9jZXNzKSB7XG5cdFx0XHRpZiAodGhpcy5waWQgJiYgdGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2U/Lm5hbWVkUHJvY2Vzc2VzLmhhcyh0aGlzLnBpZCkpIHtcblx0XHRcdFx0Ly8gVGhpcyBpcyBhIGtub3duIHByb2Nlc3MuIEdpdmUgaXQgYSBmcmllbmRseSBuYW1lLlxuXHRcdFx0XHRkZXNjcmlwdGlvbiA9IHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLm5hbWVkUHJvY2Vzc2VzLmdldCh0aGlzLnBpZCkhO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZGVzY3JpcHRpb24gPSB0aGlzLnJ1bm5pbmdQcm9jZXNzLnJlcGxhY2UoL1xcMC9nLCAnICcpLnRyaW0oKTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLnBpZCkge1xuXHRcdFx0XHRkZXNjcmlwdGlvbiArPSBgICgke3RoaXMucGlkfSlgO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAodGhpcy5oYXNSdW5uaW5nUHJvY2Vzcykge1xuXHRcdFx0ZGVzY3JpcHRpb24gPSBubHMubG9jYWxpemUoJ3R1bm5lbFZpZXcucnVubmluZ1Byb2Nlc3MuaW5hY2Vzc2FibGUnLCBcIlByb2Nlc3MgaW5mb3JtYXRpb24gdW5hdmFpbGFibGVcIik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGRlc2NyaXB0aW9uO1xuXHR9XG5cblx0Z2V0IHRvb2x0aXBQb3N0Zml4KCk6IHN0cmluZyB7XG5cdFx0bGV0IGluZm9ybWF0aW9uOiBzdHJpbmc7XG5cdFx0aWYgKHRoaXMubG9jYWxBZGRyZXNzKSB7XG5cdFx0XHRpbmZvcm1hdGlvbiA9IG5scy5sb2NhbGl6ZSgncmVtb3RlLnR1bm5lbC50b29sdGlwRm9yd2FyZGVkJywgXCJSZW1vdGUgcG9ydCB7MH06ezF9IGZvcndhcmRlZCB0byBsb2NhbCBhZGRyZXNzIHsyfS4gXCIsIHRoaXMucmVtb3RlSG9zdCwgdGhpcy5yZW1vdGVQb3J0LCB0aGlzLmxvY2FsQWRkcmVzcyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGluZm9ybWF0aW9uID0gbmxzLmxvY2FsaXplKCdyZW1vdGUudHVubmVsLnRvb2x0aXBDYW5kaWRhdGUnLCBcIlJlbW90ZSBwb3J0IHswfTp7MX0gbm90IGZvcndhcmRlZC4gXCIsIHRoaXMucmVtb3RlSG9zdCwgdGhpcy5yZW1vdGVQb3J0KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gaW5mb3JtYXRpb247XG5cdH1cblxuXHRnZXQgaWNvblRvb2x0aXAoKTogc3RyaW5nIHtcblx0XHRjb25zdCBpc0FkZCA9IHRoaXMudHVubmVsVHlwZSA9PT0gVHVubmVsVHlwZS5BZGQ7XG5cdFx0aWYgKCFpc0FkZCkge1xuXHRcdFx0cmV0dXJuIGAke3RoaXMucHJvY2Vzc0Rlc2NyaXB0aW9uID8gbmxzLmxvY2FsaXplKCd0dW5uZWwuaWNvbkNvbHVtbi5ydW5uaW5nJywgXCJQb3J0IGhhcyBydW5uaW5nIHByb2Nlc3MuXCIpIDpcblx0XHRcdFx0bmxzLmxvY2FsaXplKCd0dW5uZWwuaWNvbkNvbHVtbi5ub3RSdW5uaW5nJywgXCJObyBydW5uaW5nIHByb2Nlc3MuXCIpfWA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLmxhYmVsO1xuXHRcdH1cblx0fVxuXG5cdGdldCBwb3J0VG9vbHRpcCgpOiBzdHJpbmcge1xuXHRcdGNvbnN0IGlzQWRkID0gdGhpcy50dW5uZWxUeXBlID09PSBUdW5uZWxUeXBlLkFkZDtcblx0XHRpZiAoIWlzQWRkKSB7XG5cdFx0XHRyZXR1cm4gYCR7dGhpcy5uYW1lID8gbmxzLmxvY2FsaXplKCdyZW1vdGUudHVubmVsLnRvb2x0aXBOYW1lJywgXCJQb3J0IGxhYmVsZWQgezB9LiBcIiwgdGhpcy5uYW1lKSA6ICcnfWA7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiAnJztcblx0XHR9XG5cdH1cblxuXHRnZXQgcHJvY2Vzc1Rvb2x0aXAoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5wcm9jZXNzRGVzY3JpcHRpb24gPz8gJyc7XG5cdH1cblxuXHRnZXQgb3JpZ2luVG9vbHRpcCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLnNvdXJjZS5kZXNjcmlwdGlvbjtcblx0fVxuXG5cdGdldCBwcml2YWN5KCk6IFR1bm5lbFByaXZhY3kge1xuXHRcdGlmICh0aGlzLnR1bm5lbFNlcnZpY2U/LnByaXZhY3lPcHRpb25zKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy50dW5uZWxTZXJ2aWNlPy5wcml2YWN5T3B0aW9ucy5maW5kKGVsZW1lbnQgPT4gZWxlbWVudC5pZCA9PT0gdGhpcy5fcHJpdmFjeSkgPz9cblx0XHRcdHtcblx0XHRcdFx0aWQ6ICcnLFxuXHRcdFx0XHR0aGVtZUljb246IENvZGljb24ucXVlc3Rpb24uaWQsXG5cdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ3R1bm5lbFByaXZhY3kudW5rbm93bicsIFwiVW5rbm93blwiKVxuXHRcdFx0fTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0aWQ6IFR1bm5lbFByaXZhY3lJZC5Qcml2YXRlLFxuXHRcdFx0XHR0aGVtZUljb246IHByaXZhdGVQb3J0SWNvbi5pZCxcblx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgndHVubmVsUHJpdmFjeS5wcml2YXRlJywgXCJQcml2YXRlXCIpXG5cdFx0XHR9O1xuXHRcdH1cblx0fVxufVxuXG5jb25zdCBUdW5uZWxUeXBlQ29udGV4dEtleSA9IG5ldyBSYXdDb250ZXh0S2V5PFR1bm5lbFR5cGU+KCd0dW5uZWxUeXBlJywgVHVubmVsVHlwZS5BZGQsIHRydWUpO1xuY29uc3QgVHVubmVsQ2xvc2VhYmxlQ29udGV4dEtleSA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCd0dW5uZWxDbG9zZWFibGUnLCBmYWxzZSwgdHJ1ZSk7XG5jb25zdCBUdW5uZWxQcml2YWN5Q29udGV4dEtleSA9IG5ldyBSYXdDb250ZXh0S2V5PFR1bm5lbFByaXZhY3lJZCB8IHN0cmluZyB8IHVuZGVmaW5lZD4oJ3R1bm5lbFByaXZhY3knLCB1bmRlZmluZWQsIHRydWUpO1xuY29uc3QgVHVubmVsUHJpdmFjeUVuYWJsZWRDb250ZXh0S2V5ID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ3R1bm5lbFByaXZhY3lFbmFibGVkJywgZmFsc2UsIHRydWUpO1xuY29uc3QgVHVubmVsUHJvdG9jb2xDb250ZXh0S2V5ID0gbmV3IFJhd0NvbnRleHRLZXk8VHVubmVsUHJvdG9jb2wgfCB1bmRlZmluZWQ+KCd0dW5uZWxQcm90b2NvbCcsIFR1bm5lbFByb3RvY29sLkh0dHAsIHRydWUpO1xuY29uc3QgVHVubmVsVmlld0ZvY3VzQ29udGV4dEtleSA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCd0dW5uZWxWaWV3Rm9jdXMnLCBmYWxzZSwgbmxzLmxvY2FsaXplKCd0dW5uZWwuZm9jdXNDb250ZXh0JywgXCJXaGV0aGVyIHRoZSBQb3J0cyB2aWV3IGhhcyBmb2N1cy5cIikpO1xuY29uc3QgVHVubmVsVmlld1NlbGVjdGlvbktleU5hbWUgPSAndHVubmVsVmlld1NlbGVjdGlvbic7XG4vLyBob3N0OnBvcnRcbmNvbnN0IFR1bm5lbFZpZXdTZWxlY3Rpb25Db250ZXh0S2V5ID0gbmV3IFJhd0NvbnRleHRLZXk8c3RyaW5nIHwgdW5kZWZpbmVkPihUdW5uZWxWaWV3U2VsZWN0aW9uS2V5TmFtZSwgdW5kZWZpbmVkLCB0cnVlKTtcbmNvbnN0IFR1bm5lbFZpZXdNdWx0aVNlbGVjdGlvbktleU5hbWUgPSAndHVubmVsVmlld011bHRpU2VsZWN0aW9uJztcbi8vIGhvc3Q6cG9ydFtdXG5jb25zdCBUdW5uZWxWaWV3TXVsdGlTZWxlY3Rpb25Db250ZXh0S2V5ID0gbmV3IFJhd0NvbnRleHRLZXk8c3RyaW5nW10gfCB1bmRlZmluZWQ+KFR1bm5lbFZpZXdNdWx0aVNlbGVjdGlvbktleU5hbWUsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5jb25zdCBQb3J0Q2hhbmdhYmxlQ29udGV4dEtleSA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdwb3J0Q2hhbmdhYmxlJywgZmFsc2UsIHRydWUpO1xuY29uc3QgUHJvdG9jb2xDaGFuZ2VhYmxlQ29udGV4dEtleSA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdwcm90b2NvbENoYW5nYWJsZScsIHRydWUsIHRydWUpO1xuXG5leHBvcnQgY2xhc3MgVHVubmVsUGFuZWwgZXh0ZW5kcyBWaWV3UGFuZSB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gVFVOTkVMX1ZJRVdfSUQ7XG5cdHN0YXRpYyByZWFkb25seSBUSVRMRTogSUxvY2FsaXplZFN0cmluZyA9IG5scy5sb2NhbGl6ZTIoJ3JlbW90ZS50dW5uZWwnLCBcIlBvcnRzXCIpO1xuXG5cdHByaXZhdGUgcGFuZWxDb250YWluZXI6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHRhYmxlOiBXb3JrYmVuY2hUYWJsZTxJVHVubmVsSXRlbT4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgdGFibGVEaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSB0dW5uZWxUeXBlQ29udGV4dDogSUNvbnRleHRLZXk8VHVubmVsVHlwZT47XG5cdHByaXZhdGUgdHVubmVsQ2xvc2VhYmxlQ29udGV4dDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgdHVubmVsUHJpdmFjeUNvbnRleHQ6IElDb250ZXh0S2V5PFR1bm5lbFByaXZhY3lJZCB8IHN0cmluZyB8IHVuZGVmaW5lZD47XG5cdHByaXZhdGUgdHVubmVsUHJpdmFjeUVuYWJsZWRDb250ZXh0OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSB0dW5uZWxQcm90b2NvbENvbnRleHQ6IElDb250ZXh0S2V5PFR1bm5lbFByb3RvY29sIHwgdW5kZWZpbmVkPjtcblx0cHJpdmF0ZSB0dW5uZWxWaWV3Rm9jdXNDb250ZXh0OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSB0dW5uZWxWaWV3U2VsZWN0aW9uQ29udGV4dDogSUNvbnRleHRLZXk8c3RyaW5nIHwgdW5kZWZpbmVkPjtcblx0cHJpdmF0ZSB0dW5uZWxWaWV3TXVsdGlTZWxlY3Rpb25Db250ZXh0OiBJQ29udGV4dEtleTxzdHJpbmdbXSB8IHVuZGVmaW5lZD47XG5cdHByaXZhdGUgcG9ydENoYW5nYWJsZUNvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHByb3RvY29sQ2hhbmdhYmxlQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgaXNFZGl0aW5nOiBib29sZWFuID0gZmFsc2U7XG5cdC8vIFRPRE86IFNob3VsZCB0aGlzIGJlIHJlbW92ZWQ/XG5cdC8vQHRzLWV4cGVjdC1lcnJvclxuXHRwcml2YXRlIHRpdGxlQWN0aW9uczogSUFjdGlvbltdID0gW107XG5cdHByaXZhdGUgbGFzdEZvY3VzOiBudW1iZXJbXSA9IFtdO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByb3RlY3RlZCB2aWV3TW9kZWw6IElUdW5uZWxWaWV3TW9kZWwsXG5cdFx0b3B0aW9uczogSVZpZXdQYW5lT3B0aW9ucyxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIHZpZXdEZXNjcmlwdG9yU2VydmljZTogSVZpZXdEZXNjcmlwdG9yU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcm90ZWN0ZWQgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByb3RlY3RlZCBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJTWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtZW51U2VydmljZTogSU1lbnVTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASVJlbW90ZUV4cGxvcmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHJlbW90ZUV4cGxvcmVyU2VydmljZTogSVJlbW90ZUV4cGxvcmVyU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdFx0QElUdW5uZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdHVubmVsU2VydmljZTogSVR1bm5lbFNlcnZpY2UsXG5cdFx0QElDb250ZXh0Vmlld1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0Vmlld1NlcnZpY2U6IElDb250ZXh0Vmlld1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKG9wdGlvbnMsIGtleWJpbmRpbmdTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgb3BlbmVyU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBob3ZlclNlcnZpY2UpO1xuXHRcdHRoaXMudHVubmVsVHlwZUNvbnRleHQgPSBUdW5uZWxUeXBlQ29udGV4dEtleS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMudHVubmVsQ2xvc2VhYmxlQ29udGV4dCA9IFR1bm5lbENsb3NlYWJsZUNvbnRleHRLZXkuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnR1bm5lbFByaXZhY3lDb250ZXh0ID0gVHVubmVsUHJpdmFjeUNvbnRleHRLZXkuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnR1bm5lbFByaXZhY3lFbmFibGVkQ29udGV4dCA9IFR1bm5lbFByaXZhY3lFbmFibGVkQ29udGV4dEtleS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMudHVubmVsUHJpdmFjeUVuYWJsZWRDb250ZXh0LnNldCh0dW5uZWxTZXJ2aWNlLmNhbkNoYW5nZVByaXZhY3kpO1xuXHRcdHRoaXMucHJvdG9jb2xDaGFuZ2FibGVDb250ZXh0S2V5ID0gUHJvdG9jb2xDaGFuZ2VhYmxlQ29udGV4dEtleS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMucHJvdG9jb2xDaGFuZ2FibGVDb250ZXh0S2V5LnNldCh0dW5uZWxTZXJ2aWNlLmNhbkNoYW5nZVByb3RvY29sKTtcblx0XHR0aGlzLnR1bm5lbFByb3RvY29sQ29udGV4dCA9IFR1bm5lbFByb3RvY29sQ29udGV4dEtleS5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMudHVubmVsVmlld0ZvY3VzQ29udGV4dCA9IFR1bm5lbFZpZXdGb2N1c0NvbnRleHRLZXkuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnR1bm5lbFZpZXdTZWxlY3Rpb25Db250ZXh0ID0gVHVubmVsVmlld1NlbGVjdGlvbkNvbnRleHRLZXkuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnR1bm5lbFZpZXdNdWx0aVNlbGVjdGlvbkNvbnRleHQgPSBUdW5uZWxWaWV3TXVsdGlTZWxlY3Rpb25Db250ZXh0S2V5LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5wb3J0Q2hhbmdhYmxlQ29udGV4dEtleSA9IFBvcnRDaGFuZ2FibGVDb250ZXh0S2V5LmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHRjb25zdCBvdmVybGF5Q29udGV4dEtleVNlcnZpY2UgPSB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZU92ZXJsYXkoW1sndmlldycsIFR1bm5lbFBhbmVsLklEXV0pO1xuXHRcdGNvbnN0IHRpdGxlTWVudSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMubWVudVNlcnZpY2UuY3JlYXRlTWVudShNZW51SWQuVHVubmVsVGl0bGUsIG92ZXJsYXlDb250ZXh0S2V5U2VydmljZSkpO1xuXHRcdGNvbnN0IHVwZGF0ZUFjdGlvbnMgPSAoKSA9PiB7XG5cdFx0XHR0aGlzLnRpdGxlQWN0aW9ucyA9IGdldEZsYXRBY3Rpb25CYXJBY3Rpb25zKHRpdGxlTWVudS5nZXRBY3Rpb25zKCkpO1xuXHRcdFx0dGhpcy51cGRhdGVBY3Rpb25zKCk7XG5cdFx0fTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRpdGxlTWVudS5vbkRpZENoYW5nZSh1cGRhdGVBY3Rpb25zKSk7XG5cdFx0dXBkYXRlQWN0aW9ucygpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMudGl0bGVBY3Rpb25zID0gW107XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5yZWdpc3RlclByaXZhY3lBY3Rpb25zKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQub25jZSh0aGlzLnR1bm5lbFNlcnZpY2Uub25BZGRlZFR1bm5lbFByb3ZpZGVyKSgoKSA9PiB7XG5cdFx0XHRsZXQgdXBkYXRlZCA9IGZhbHNlO1xuXHRcdFx0aWYgKHRoaXMudHVubmVsUHJpdmFjeUVuYWJsZWRDb250ZXh0LmdldCgpID09PSBmYWxzZSkge1xuXHRcdFx0XHR0aGlzLnR1bm5lbFByaXZhY3lFbmFibGVkQ29udGV4dC5zZXQodHVubmVsU2VydmljZS5jYW5DaGFuZ2VQcml2YWN5KTtcblx0XHRcdFx0dXBkYXRlZCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5wcm90b2NvbENoYW5nYWJsZUNvbnRleHRLZXkuZ2V0KCkgPT09IHRydWUpIHtcblx0XHRcdFx0dGhpcy5wcm90b2NvbENoYW5nYWJsZUNvbnRleHRLZXkuc2V0KHR1bm5lbFNlcnZpY2UuY2FuQ2hhbmdlUHJvdG9jb2wpO1xuXHRcdFx0XHR1cGRhdGVkID0gdHJ1ZTtcblx0XHRcdH1cblx0XHRcdGlmICh1cGRhdGVkKSB7XG5cdFx0XHRcdHVwZGF0ZUFjdGlvbnMoKTtcblx0XHRcdFx0dGhpcy5yZWdpc3RlclByaXZhY3lBY3Rpb25zKCk7XG5cdFx0XHRcdHRoaXMuY3JlYXRlVGFibGUoKTtcblx0XHRcdFx0dGhpcy50YWJsZT8ubGF5b3V0KHRoaXMuaGVpZ2h0LCB0aGlzLndpZHRoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyUHJpdmFjeUFjdGlvbnMoKSB7XG5cdFx0Zm9yIChjb25zdCBwcml2YWN5T3B0aW9uIG9mIHRoaXMudHVubmVsU2VydmljZS5wcml2YWN5T3B0aW9ucykge1xuXHRcdFx0Y29uc3Qgb3B0aW9uSWQgPSBgcmVtb3RlLnR1bm5lbC5wcml2YWN5JHtwcml2YWN5T3B0aW9uLmlkfWA7XG5cdFx0XHRDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZChvcHRpb25JZCwgQ2hhbmdlVHVubmVsUHJpdmFjeUFjdGlvbi5oYW5kbGVyKHByaXZhY3lPcHRpb24uaWQpKTtcblx0XHRcdE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuVHVubmVsUHJpdmFjeSwgKHtcblx0XHRcdFx0b3JkZXI6IDAsXG5cdFx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0XHRpZDogb3B0aW9uSWQsXG5cdFx0XHRcdFx0dGl0bGU6IHByaXZhY3lPcHRpb24ubGFiZWwsXG5cdFx0XHRcdFx0dG9nZ2xlZDogVHVubmVsUHJpdmFjeUNvbnRleHRLZXkuaXNFcXVhbFRvKHByaXZhY3lPcHRpb24uaWQpXG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cblxuXHRnZXQgcG9ydENvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsLmZvcndhcmRlZC5zaXplICsgdGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWwuZGV0ZWN0ZWQuc2l6ZTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlVGFibGUoKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLnBhbmVsQ29udGFpbmVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMudGFibGVEaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0ZG9tLmNsZWFyTm9kZSh0aGlzLnBhbmVsQ29udGFpbmVyKTtcblxuXHRcdGNvbnN0IHdpZGdldENvbnRhaW5lciA9IGRvbS5hcHBlbmQodGhpcy5wYW5lbENvbnRhaW5lciwgZG9tLiQoJy5jdXN0b212aWV3LXRyZWUnKSk7XG5cdFx0d2lkZ2V0Q29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3BvcnRzLXZpZXcnKTtcblx0XHR3aWRnZXRDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnZmlsZS1pY29uLXRoZW1hYmxlLXRyZWUnLCAnc2hvdy1maWxlLWljb25zJyk7XG5cblx0XHRjb25zdCBhY3Rpb25CYXJSZW5kZXJlciA9IG5ldyBBY3Rpb25CYXJSZW5kZXJlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdFx0dGhpcy5tZW51U2VydmljZSwgdGhpcy5jb250ZXh0Vmlld1NlcnZpY2UsIHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLCB0aGlzLmNvbW1hbmRTZXJ2aWNlLFxuXHRcdFx0dGhpcy5jb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3QgY29sdW1ucyA9IFtuZXcgSWNvbkNvbHVtbigpLCBuZXcgUG9ydENvbHVtbigpLCBuZXcgTG9jYWxBZGRyZXNzQ29sdW1uKCksIG5ldyBSdW5uaW5nUHJvY2Vzc0NvbHVtbigpXTtcblx0XHRpZiAodGhpcy50dW5uZWxTZXJ2aWNlLmNhbkNoYW5nZVByaXZhY3kpIHtcblx0XHRcdGNvbHVtbnMucHVzaChuZXcgUHJpdmFjeUNvbHVtbigpKTtcblx0XHR9XG5cdFx0Y29sdW1ucy5wdXNoKG5ldyBPcmlnaW5Db2x1bW4oKSk7XG5cblx0XHR0aGlzLnRhYmxlID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShXb3JrYmVuY2hUYWJsZSxcblx0XHRcdCdSZW1vdGVUdW5uZWxzJyxcblx0XHRcdHdpZGdldENvbnRhaW5lcixcblx0XHRcdG5ldyBUdW5uZWxUcmVlVmlydHVhbERlbGVnYXRlKHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlKSxcblx0XHRcdGNvbHVtbnMsXG5cdFx0XHRbYWN0aW9uQmFyUmVuZGVyZXJdLFxuXHRcdFx0e1xuXHRcdFx0XHRrZXlib2FyZE5hdmlnYXRpb25MYWJlbFByb3ZpZGVyOiB7XG5cdFx0XHRcdFx0Z2V0S2V5Ym9hcmROYXZpZ2F0aW9uTGFiZWw6IChpdGVtOiBJVHVubmVsSXRlbSkgPT4ge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGl0ZW0ubGFiZWw7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRtdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ6IHRydWUsXG5cdFx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjoge1xuXHRcdFx0XHRcdGdldEFyaWFMYWJlbDogKGl0ZW06IElUdW5uZWxJdGVtKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoaXRlbSBpbnN0YW5jZW9mIFR1bm5lbEl0ZW0pIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGAke2l0ZW0udG9vbHRpcFBvc3RmaXh9ICR7aXRlbS5wb3J0VG9vbHRpcH0gJHtpdGVtLmljb25Ub29sdGlwfSAke2l0ZW0ucHJvY2Vzc1Rvb2x0aXB9ICR7aXRlbS5vcmlnaW5Ub29sdGlwfSAke3RoaXMudHVubmVsU2VydmljZS5jYW5DaGFuZ2VQcml2YWN5ID8gaXRlbS5wcml2YWN5LmxhYmVsIDogJyd9YDtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBpdGVtLmxhYmVsO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z2V0V2lkZ2V0QXJpYUxhYmVsOiAoKSA9PiBubHMubG9jYWxpemUoJ3R1bm5lbFZpZXcnLCBcIlR1bm5lbCBWaWV3XCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdG9wZW5PblNpbmdsZUNsaWNrOiB0cnVlXG5cdFx0XHR9XG5cdFx0KSBhcyBXb3JrYmVuY2hUYWJsZTxJVHVubmVsSXRlbT47XG5cblx0XHRjb25zdCBhY3Rpb25SdW5uZXI6IEFjdGlvblJ1bm5lciA9IHRoaXMudGFibGVEaXNwb3NhYmxlcy5hZGQobmV3IEFjdGlvblJ1bm5lcigpKTtcblx0XHRhY3Rpb25CYXJSZW5kZXJlci5hY3Rpb25SdW5uZXIgPSBhY3Rpb25SdW5uZXI7XG5cblx0XHR0aGlzLnRhYmxlRGlzcG9zYWJsZXMuYWRkKHRoaXMudGFibGUpO1xuXHRcdHRoaXMudGFibGVEaXNwb3NhYmxlcy5hZGQodGhpcy50YWJsZS5vbkNvbnRleHRNZW51KGUgPT4gdGhpcy5vbkNvbnRleHRNZW51KGUsIGFjdGlvblJ1bm5lcikpKTtcblx0XHR0aGlzLnRhYmxlRGlzcG9zYWJsZXMuYWRkKHRoaXMudGFibGUub25Nb3VzZURibENsaWNrKGUgPT4gdGhpcy5vbk1vdXNlRGJsQ2xpY2soZSkpKTtcblx0XHR0aGlzLnRhYmxlRGlzcG9zYWJsZXMuYWRkKHRoaXMudGFibGUub25EaWRDaGFuZ2VGb2N1cyhlID0+IHRoaXMub25Gb2N1c0NoYW5nZWQoZSkpKTtcblx0XHR0aGlzLnRhYmxlRGlzcG9zYWJsZXMuYWRkKHRoaXMudGFibGUub25EaWRDaGFuZ2VTZWxlY3Rpb24oZSA9PiB0aGlzLm9uU2VsZWN0aW9uQ2hhbmdlZChlKSkpO1xuXHRcdHRoaXMudGFibGVEaXNwb3NhYmxlcy5hZGQodGhpcy50YWJsZS5vbkRpZEZvY3VzKCgpID0+IHRoaXMudHVubmVsVmlld0ZvY3VzQ29udGV4dC5zZXQodHJ1ZSkpKTtcblx0XHR0aGlzLnRhYmxlRGlzcG9zYWJsZXMuYWRkKHRoaXMudGFibGUub25EaWRCbHVyKCgpID0+IHRoaXMudHVubmVsVmlld0ZvY3VzQ29udGV4dC5zZXQoZmFsc2UpKSk7XG5cblx0XHRjb25zdCByZXJlbmRlciA9ICgpID0+IHRoaXMudGFibGU/LnNwbGljZSgwLCBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksIHRoaXMudmlld01vZGVsLmFsbCk7XG5cblx0XHRyZXJlbmRlcigpO1xuXHRcdGxldCBsYXN0UG9ydENvdW50ID0gdGhpcy5wb3J0Q291bnQ7XG5cdFx0dGhpcy50YWJsZURpc3Bvc2FibGVzLmFkZChFdmVudC5kZWJvdW5jZSh0aGlzLnZpZXdNb2RlbC5vbkZvcndhcmRlZFBvcnRzQ2hhbmdlZCwgKF9sYXN0LCBlKSA9PiBlLCA1MCkoKCkgPT4ge1xuXHRcdFx0Y29uc3QgbmV3UG9ydENvdW50ID0gdGhpcy5wb3J0Q291bnQ7XG5cdFx0XHRpZiAoKChsYXN0UG9ydENvdW50ID09PSAwKSB8fCAobmV3UG9ydENvdW50ID09PSAwKSkgJiYgKGxhc3RQb3J0Q291bnQgIT09IG5ld1BvcnRDb3VudCkpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VWaWV3V2VsY29tZVN0YXRlLmZpcmUoKTtcblx0XHRcdH1cblx0XHRcdGxhc3RQb3J0Q291bnQgPSBuZXdQb3J0Q291bnQ7XG5cdFx0XHRyZXJlbmRlcigpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMudGFibGVEaXNwb3NhYmxlcy5hZGQodGhpcy50YWJsZS5vbk1vdXNlQ2xpY2soZSA9PiB7XG5cdFx0XHRpZiAodGhpcy5oYXNPcGVuTGlua01vZGlmaWVyKGUuYnJvd3NlckV2ZW50KSAmJiB0aGlzLnRhYmxlKSB7XG5cdFx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IHRoaXMudGFibGUuZ2V0U2VsZWN0ZWRFbGVtZW50cygpO1xuXHRcdFx0XHRpZiAoKHNlbGVjdGlvbi5sZW5ndGggPT09IDApIHx8XG5cdFx0XHRcdFx0KChzZWxlY3Rpb24ubGVuZ3RoID09PSAxKSAmJiAoc2VsZWN0aW9uWzBdID09PSBlLmVsZW1lbnQpKSkge1xuXHRcdFx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoT3BlblBvcnRJbkJyb3dzZXJBY3Rpb24uSUQsIGUuZWxlbWVudCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLnRhYmxlRGlzcG9zYWJsZXMuYWRkKHRoaXMudGFibGUub25EaWRPcGVuKGUgPT4ge1xuXHRcdFx0aWYgKCFlLmVsZW1lbnQgfHwgKGUuZWxlbWVudC50dW5uZWxUeXBlICE9PSBUdW5uZWxUeXBlLkZvcndhcmRlZCkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuYnJvd3NlckV2ZW50Py50eXBlID09PSAnZGJsY2xpY2snKSB7XG5cdFx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoTGFiZWxUdW5uZWxBY3Rpb24uSUQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMudGFibGVEaXNwb3NhYmxlcy5hZGQodGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2Uub25EaWRDaGFuZ2VFZGl0YWJsZShlID0+IHtcblx0XHRcdHRoaXMuaXNFZGl0aW5nID0gISF0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS5nZXRFZGl0YWJsZURhdGEoZT8udHVubmVsLCBlPy5lZGl0SWQpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VWaWV3V2VsY29tZVN0YXRlLmZpcmUoKTtcblxuXHRcdFx0aWYgKCF0aGlzLmlzRWRpdGluZykge1xuXHRcdFx0XHR3aWRnZXRDb250YWluZXIuY2xhc3NMaXN0LnJlbW92ZSgnaGlnaGxpZ2h0Jyk7XG5cdFx0XHR9XG5cblx0XHRcdHJlcmVuZGVyKCk7XG5cblx0XHRcdGlmICh0aGlzLmlzRWRpdGluZykge1xuXHRcdFx0XHR3aWRnZXRDb250YWluZXIuY2xhc3NMaXN0LmFkZCgnaGlnaGxpZ2h0Jyk7XG5cdFx0XHRcdGlmICghZSkge1xuXHRcdFx0XHRcdC8vIFdoZW4gd2UgYXJlIGluIGVkaXRpbmcgbW9kZSBmb3IgYSBuZXcgZm9yd2FyZCwgcmF0aGVyIHRoYW4gdXBkYXRpbmcgYW4gZXhpc3Rpbmcgb25lIHdlIG5lZWQgdG8gcmV2ZWFsIHRoZSBpbnB1dCBib3ggc2luY2UgaXQgbWlnaHQgYmUgb3V0IG9mIHZpZXcuXG5cdFx0XHRcdFx0dGhpcy50YWJsZT8ucmV2ZWFsKHRoaXMudGFibGUuaW5kZXhPZih0aGlzLnZpZXdNb2RlbC5pbnB1dCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoZSAmJiAoZS50dW5uZWwudHVubmVsVHlwZSAhPT0gVHVubmVsVHlwZS5BZGQpKSB7XG5cdFx0XHRcdFx0dGhpcy50YWJsZT8uc2V0Rm9jdXModGhpcy5sYXN0Rm9jdXMpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuZm9jdXMoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVuZGVyQm9keShjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyQm9keShjb250YWluZXIpO1xuXG5cdFx0dGhpcy5wYW5lbENvbnRhaW5lciA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCBkb20uJCgnLnRyZWUtZXhwbG9yZXItdmlld2xldC10cmVlLXZpZXcnKSk7XG5cdFx0dGhpcy5jcmVhdGVUYWJsZSgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2hvdWxkU2hvd1dlbGNvbWUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMudmlld01vZGVsLmlzRW1wdHkoKSAmJiAhdGhpcy5pc0VkaXRpbmc7XG5cdH1cblxuXHRvdmVycmlkZSBmb2N1cygpOiB2b2lkIHtcblx0XHRzdXBlci5mb2N1cygpO1xuXHRcdHRoaXMudGFibGU/LmRvbUZvY3VzKCk7XG5cdH1cblxuXHRwcml2YXRlIG9uRm9jdXNDaGFuZ2VkKGV2ZW50OiBJVGFibGVFdmVudDxJVHVubmVsSXRlbT4pIHtcblx0XHRpZiAoZXZlbnQuaW5kZXhlcy5sZW5ndGggPiAwICYmIGV2ZW50LmVsZW1lbnRzLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMubGFzdEZvY3VzID0gWy4uLmV2ZW50LmluZGV4ZXNdO1xuXHRcdH1cblx0XHRjb25zdCBlbGVtZW50cyA9IGV2ZW50LmVsZW1lbnRzO1xuXHRcdGNvbnN0IGl0ZW0gPSBlbGVtZW50cyAmJiBlbGVtZW50cy5sZW5ndGggPyBlbGVtZW50c1swXSA6IHVuZGVmaW5lZDtcblx0XHRpZiAoaXRlbSkge1xuXHRcdFx0dGhpcy50dW5uZWxWaWV3U2VsZWN0aW9uQ29udGV4dC5zZXQobWFrZUFkZHJlc3MoaXRlbS5yZW1vdGVIb3N0LCBpdGVtLnJlbW90ZVBvcnQpKTtcblx0XHRcdHRoaXMudHVubmVsVHlwZUNvbnRleHQuc2V0KGl0ZW0udHVubmVsVHlwZSk7XG5cdFx0XHR0aGlzLnR1bm5lbENsb3NlYWJsZUNvbnRleHQuc2V0KCEhaXRlbS5jbG9zZWFibGUpO1xuXHRcdFx0dGhpcy50dW5uZWxQcml2YWN5Q29udGV4dC5zZXQoaXRlbS5wcml2YWN5LmlkKTtcblx0XHRcdHRoaXMudHVubmVsUHJvdG9jb2xDb250ZXh0LnNldChpdGVtLnByb3RvY29sID09PSBUdW5uZWxQcm90b2NvbC5IdHRwcyA/IFR1bm5lbFByb3RvY29sLkh0dHBzIDogVHVubmVsUHJvdG9jb2wuSHR0cHMpO1xuXHRcdFx0dGhpcy5wb3J0Q2hhbmdhYmxlQ29udGV4dEtleS5zZXQoISFpdGVtLmxvY2FsUG9ydCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudHVubmVsVHlwZUNvbnRleHQucmVzZXQoKTtcblx0XHRcdHRoaXMudHVubmVsVmlld1NlbGVjdGlvbkNvbnRleHQucmVzZXQoKTtcblx0XHRcdHRoaXMudHVubmVsQ2xvc2VhYmxlQ29udGV4dC5yZXNldCgpO1xuXHRcdFx0dGhpcy50dW5uZWxQcml2YWN5Q29udGV4dC5yZXNldCgpO1xuXHRcdFx0dGhpcy50dW5uZWxQcm90b2NvbENvbnRleHQucmVzZXQoKTtcblx0XHRcdHRoaXMucG9ydENoYW5nYWJsZUNvbnRleHRLZXkucmVzZXQoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGhhc09wZW5MaW5rTW9kaWZpZXIoZTogTW91c2VFdmVudCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGVkaXRvckNvbmYgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPHsgbXVsdGlDdXJzb3JNb2RpZmllcjogJ2N0cmxDbWQnIHwgJ2FsdCcgfT4oJ2VkaXRvcicpO1xuXG5cdFx0bGV0IG1vZGlmaWVyS2V5ID0gZmFsc2U7XG5cdFx0aWYgKGVkaXRvckNvbmYubXVsdGlDdXJzb3JNb2RpZmllciA9PT0gJ2N0cmxDbWQnKSB7XG5cdFx0XHRtb2RpZmllcktleSA9IGUuYWx0S2V5O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoaXNNYWNpbnRvc2gpIHtcblx0XHRcdFx0bW9kaWZpZXJLZXkgPSBlLm1ldGFLZXk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRtb2RpZmllcktleSA9IGUuY3RybEtleTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG1vZGlmaWVyS2V5O1xuXHR9XG5cblx0cHJpdmF0ZSBvblNlbGVjdGlvbkNoYW5nZWQoZXZlbnQ6IElUYWJsZUV2ZW50PElUdW5uZWxJdGVtPikge1xuXHRcdGNvbnN0IGVsZW1lbnRzID0gZXZlbnQuZWxlbWVudHM7XG5cdFx0aWYgKGVsZW1lbnRzLmxlbmd0aCA+IDEpIHtcblx0XHRcdHRoaXMudHVubmVsVmlld011bHRpU2VsZWN0aW9uQ29udGV4dC5zZXQoZWxlbWVudHMubWFwKGVsZW1lbnQgPT4gbWFrZUFkZHJlc3MoZWxlbWVudC5yZW1vdGVIb3N0LCBlbGVtZW50LnJlbW90ZVBvcnQpKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudHVubmVsVmlld011bHRpU2VsZWN0aW9uQ29udGV4dC5zZXQodW5kZWZpbmVkKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uQ29udGV4dE1lbnUoZXZlbnQ6IElUYWJsZUNvbnRleHRNZW51RXZlbnQ8SVR1bm5lbEl0ZW0+LCBhY3Rpb25SdW5uZXI6IEFjdGlvblJ1bm5lcik6IHZvaWQge1xuXHRcdGlmICgoZXZlbnQuZWxlbWVudCAhPT0gdW5kZWZpbmVkKSAmJiAhKGV2ZW50LmVsZW1lbnQgaW5zdGFuY2VvZiBUdW5uZWxJdGVtKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGV2ZW50LmJyb3dzZXJFdmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdGV2ZW50LmJyb3dzZXJFdmVudC5zdG9wUHJvcGFnYXRpb24oKTtcblxuXHRcdGNvbnN0IG5vZGU6IFR1bm5lbEl0ZW0gfCB1bmRlZmluZWQgPSBldmVudC5lbGVtZW50O1xuXG5cdFx0aWYgKG5vZGUpIHtcblx0XHRcdHRoaXMudGFibGU/LnNldEZvY3VzKFt0aGlzLnRhYmxlLmluZGV4T2Yobm9kZSldKTtcblx0XHRcdHRoaXMudHVubmVsVHlwZUNvbnRleHQuc2V0KG5vZGUudHVubmVsVHlwZSk7XG5cdFx0XHR0aGlzLnR1bm5lbENsb3NlYWJsZUNvbnRleHQuc2V0KCEhbm9kZS5jbG9zZWFibGUpO1xuXHRcdFx0dGhpcy50dW5uZWxQcml2YWN5Q29udGV4dC5zZXQobm9kZS5wcml2YWN5LmlkKTtcblx0XHRcdHRoaXMudHVubmVsUHJvdG9jb2xDb250ZXh0LnNldChub2RlLnByb3RvY29sKTtcblx0XHRcdHRoaXMucG9ydENoYW5nYWJsZUNvbnRleHRLZXkuc2V0KCEhbm9kZS5sb2NhbFBvcnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnR1bm5lbFR5cGVDb250ZXh0LnNldChUdW5uZWxUeXBlLkFkZCk7XG5cdFx0XHR0aGlzLnR1bm5lbENsb3NlYWJsZUNvbnRleHQuc2V0KGZhbHNlKTtcblx0XHRcdHRoaXMudHVubmVsUHJpdmFjeUNvbnRleHQuc2V0KHVuZGVmaW5lZCk7XG5cdFx0XHR0aGlzLnR1bm5lbFByb3RvY29sQ29udGV4dC5zZXQodW5kZWZpbmVkKTtcblx0XHRcdHRoaXMucG9ydENoYW5nYWJsZUNvbnRleHRLZXkuc2V0KGZhbHNlKTtcblx0XHR9XG5cblx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0bWVudUlkOiBNZW51SWQuVHVubmVsQ29udGV4dCxcblx0XHRcdG1lbnVBY3Rpb25PcHRpb25zOiB7IHNob3VsZEZvcndhcmRBcmdzOiB0cnVlIH0sXG5cdFx0XHRjb250ZXh0S2V5U2VydmljZTogdGhpcy50YWJsZT8uY29udGV4dEtleVNlcnZpY2UsXG5cdFx0XHRnZXRBbmNob3I6ICgpID0+IGV2ZW50LmFuY2hvcixcblx0XHRcdGdldEFjdGlvblZpZXdJdGVtOiAoYWN0aW9uKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGtleWJpbmRpbmcgPSB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcoYWN0aW9uLmlkKTtcblx0XHRcdFx0aWYgKGtleWJpbmRpbmcpIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IEFjdGlvblZpZXdJdGVtKGFjdGlvbiwgYWN0aW9uLCB7IGxhYmVsOiB0cnVlLCBrZXliaW5kaW5nOiBrZXliaW5kaW5nLmdldExhYmVsKCkgfSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH0sXG5cdFx0XHRvbkhpZGU6ICh3YXNDYW5jZWxsZWQ/OiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdGlmICh3YXNDYW5jZWxsZWQpIHtcblx0XHRcdFx0XHR0aGlzLnRhYmxlPy5kb21Gb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0Z2V0QWN0aW9uc0NvbnRleHQ6ICgpID0+IG5vZGU/LnN0cmlwKCksXG5cdFx0XHRhY3Rpb25SdW5uZXJcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgb25Nb3VzZURibENsaWNrKGU6IElUYWJsZU1vdXNlRXZlbnQ8SVR1bm5lbEl0ZW0+KTogdm9pZCB7XG5cdFx0aWYgKCFlLmVsZW1lbnQpIHtcblx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoRm9yd2FyZFBvcnRBY3Rpb24uSU5MSU5FX0lEKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGhlaWdodCA9IDA7XG5cdHByaXZhdGUgd2lkdGggPSAwO1xuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgbGF5b3V0Qm9keShoZWlnaHQ6IG51bWJlciwgd2lkdGg6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuaGVpZ2h0ID0gaGVpZ2h0O1xuXHRcdHRoaXMud2lkdGggPSB3aWR0aDtcblx0XHRzdXBlci5sYXlvdXRCb2R5KGhlaWdodCwgd2lkdGgpO1xuXHRcdHRoaXMudGFibGU/LmxheW91dChoZWlnaHQsIHdpZHRoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVHVubmVsUGFuZWxEZXNjcmlwdG9yIGltcGxlbWVudHMgSVZpZXdEZXNjcmlwdG9yIHtcblx0cmVhZG9ubHkgaWQgPSBUdW5uZWxQYW5lbC5JRDtcblx0cmVhZG9ubHkgbmFtZTogSUxvY2FsaXplZFN0cmluZyA9IFR1bm5lbFBhbmVsLlRJVExFO1xuXHRyZWFkb25seSBjdG9yRGVzY3JpcHRvcjogU3luY0Rlc2NyaXB0b3I8VHVubmVsUGFuZWw+O1xuXHRyZWFkb25seSBjYW5Ub2dnbGVWaXNpYmlsaXR5ID0gdHJ1ZTtcblx0cmVhZG9ubHkgaGlkZUJ5RGVmYXVsdCA9IGZhbHNlO1xuXHQvLyBncm91cCBpcyBub3QgYWN0dWFsbHkgdXNlZCBmb3Igdmlld3MgdGhhdCBhcmUgbm90IGV4dGVuc2lvbiBjb250cmlidXRlZC4gVXNlIG9yZGVyIGluc3RlYWQuXG5cdHJlYWRvbmx5IGdyb3VwID0gJ2RldGFpbHNAMCc7XG5cdC8vIC01MDAgY29tZXMgZnJvbSB0aGUgcmVtb3RlIGV4cGxvcmVyIHZpZXdPcmRlckRlbGVnYXRlXG5cdHJlYWRvbmx5IG9yZGVyID0gLTUwMDtcblx0cmVhZG9ubHkgcmVtb3RlQXV0aG9yaXR5Pzogc3RyaW5nIHwgc3RyaW5nW107XG5cdHJlYWRvbmx5IGNhbk1vdmVWaWV3ID0gdHJ1ZTtcblx0cmVhZG9ubHkgY29udGFpbmVySWNvbiA9IHBvcnRzVmlld0ljb247XG5cblx0Y29uc3RydWN0b3Iodmlld01vZGVsOiBJVHVubmVsVmlld01vZGVsLCBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UpIHtcblx0XHR0aGlzLmN0b3JEZXNjcmlwdG9yID0gbmV3IFN5bmNEZXNjcmlwdG9yKFR1bm5lbFBhbmVsLCBbdmlld01vZGVsXSk7XG5cdFx0dGhpcy5yZW1vdGVBdXRob3JpdHkgPSBlbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5ID8gZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eS5zcGxpdCgnKycpWzBdIDogdW5kZWZpbmVkO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGlzSVR1bm5lbEl0ZW0oaXRlbTogYW55KTogaXRlbSBpcyBJVHVubmVsSXRlbSB7XG5cdHJldHVybiBpdGVtICYmIGl0ZW0udHVubmVsVHlwZSAmJiBpdGVtLnJlbW90ZUhvc3QgJiYgaXRlbS5zb3VyY2U7XG59XG5cbm5hbWVzcGFjZSBMYWJlbFR1bm5lbEFjdGlvbiB7XG5cdGV4cG9ydCBjb25zdCBJRCA9ICdyZW1vdGUudHVubmVsLmxhYmVsJztcblx0ZXhwb3J0IGNvbnN0IExBQkVMID0gbmxzLmxvY2FsaXplKCdyZW1vdGUudHVubmVsLmxhYmVsJywgXCJTZXQgUG9ydCBMYWJlbFwiKTtcblx0ZXhwb3J0IGNvbnN0IENPTU1BTkRfSURfS0VZV09SRCA9ICdsYWJlbCc7XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGhhbmRsZXIoKTogSUNvbW1hbmRIYW5kbGVyIHtcblx0XHRyZXR1cm4gYXN5bmMgKGFjY2Vzc29yLCBhcmcpOiBQcm9taXNlPHsgcG9ydDogbnVtYmVyOyBsYWJlbDogc3RyaW5nIH0gfCB1bmRlZmluZWQ+ID0+IHtcblx0XHRcdGNvbnN0IHJlbW90ZUV4cGxvcmVyU2VydmljZSA9IGFjY2Vzc29yLmdldChJUmVtb3RlRXhwbG9yZXJTZXJ2aWNlKTtcblx0XHRcdGxldCB0dW5uZWxDb250ZXh0OiBJVHVubmVsSXRlbSB8IHVuZGVmaW5lZDtcblx0XHRcdGlmIChpc0lUdW5uZWxJdGVtKGFyZykpIHtcblx0XHRcdFx0dHVubmVsQ29udGV4dCA9IGFyZztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGNvbnRleHQgPSBhY2Nlc3Nvci5nZXQoSUNvbnRleHRLZXlTZXJ2aWNlKS5nZXRDb250ZXh0S2V5VmFsdWU8c3RyaW5nIHwgdW5kZWZpbmVkPihUdW5uZWxWaWV3U2VsZWN0aW9uS2V5TmFtZSk7XG5cdFx0XHRcdGNvbnN0IHR1bm5lbCA9IGNvbnRleHQgPyByZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWwuZm9yd2FyZGVkLmdldChjb250ZXh0KSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0aWYgKHR1bm5lbCkge1xuXHRcdFx0XHRcdGNvbnN0IHR1bm5lbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVR1bm5lbFNlcnZpY2UpO1xuXHRcdFx0XHRcdHR1bm5lbENvbnRleHQgPSBUdW5uZWxJdGVtLmNyZWF0ZUZyb21UdW5uZWwocmVtb3RlRXhwbG9yZXJTZXJ2aWNlLCB0dW5uZWxTZXJ2aWNlLCB0dW5uZWwpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAodHVubmVsQ29udGV4dCkge1xuXHRcdFx0XHRjb25zdCB0dW5uZWxJdGVtOiBJVHVubmVsSXRlbSA9IHR1bm5lbENvbnRleHQ7XG5cdFx0XHRcdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRcdFx0XHRjb25zdCBzdGFydGluZ1ZhbHVlID0gdHVubmVsSXRlbS5uYW1lID8gdHVubmVsSXRlbS5uYW1lIDogYCR7dHVubmVsSXRlbS5yZW1vdGVQb3J0fWA7XG5cdFx0XHRcdFx0cmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnNldEVkaXRhYmxlKHR1bm5lbEl0ZW0sIFR1bm5lbEVkaXRJZC5MYWJlbCwge1xuXHRcdFx0XHRcdFx0b25GaW5pc2g6IGFzeW5jICh2YWx1ZSwgc3VjY2VzcykgPT4ge1xuXHRcdFx0XHRcdFx0XHR2YWx1ZSA9IHZhbHVlLnRyaW0oKTtcblx0XHRcdFx0XHRcdFx0cmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnNldEVkaXRhYmxlKHR1bm5lbEl0ZW0sIFR1bm5lbEVkaXRJZC5MYWJlbCwgbnVsbCk7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGNoYW5nZWQgPSBzdWNjZXNzICYmICh2YWx1ZSAhPT0gc3RhcnRpbmdWYWx1ZSk7XG5cdFx0XHRcdFx0XHRcdGlmIChjaGFuZ2VkKSB7XG5cdFx0XHRcdFx0XHRcdFx0YXdhaXQgcmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsLm5hbWUodHVubmVsSXRlbS5yZW1vdGVIb3N0LCB0dW5uZWxJdGVtLnJlbW90ZVBvcnQsIHZhbHVlKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRyZXNvbHZlKGNoYW5nZWQgPyB7IHBvcnQ6IHR1bm5lbEl0ZW0ucmVtb3RlUG9ydCwgbGFiZWw6IHZhbHVlIH0gOiB1bmRlZmluZWQpO1xuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHZhbGlkYXRpb25NZXNzYWdlOiAoKSA9PiBudWxsLFxuXHRcdFx0XHRcdFx0cGxhY2Vob2xkZXI6IG5scy5sb2NhbGl6ZSgncmVtb3RlLnR1bm5lbHNWaWV3LmxhYmVsUGxhY2Vob2xkZXInLCBcIlBvcnQgbGFiZWxcIiksXG5cdFx0XHRcdFx0XHRzdGFydGluZ1ZhbHVlXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9O1xuXHR9XG59XG5cbmNvbnN0IGludmFsaWRQb3J0U3RyaW5nOiBzdHJpbmcgPSBubHMubG9jYWxpemUoJ3JlbW90ZS50dW5uZWxzVmlldy5wb3J0TnVtYmVyVmFsaWQnLCBcIkZvcndhcmRlZCBwb3J0IHNob3VsZCBiZSBhIG51bWJlciBvciBhIGhvc3Q6cG9ydC5cIik7XG5jb25zdCBtYXhQb3J0TnVtYmVyOiBudW1iZXIgPSA2NTUzNjtcbmNvbnN0IGludmFsaWRQb3J0TnVtYmVyU3RyaW5nOiBzdHJpbmcgPSBubHMubG9jYWxpemUoJ3JlbW90ZS50dW5uZWxzVmlldy5wb3J0TnVtYmVyVG9IaWdoJywgXCJQb3J0IG51bWJlciBtdXN0IGJlIFxcdTIyNjUgMCBhbmQgPCB7MH0uXCIsIG1heFBvcnROdW1iZXIpO1xuY29uc3QgcmVxdWlyZXNTdWRvU3RyaW5nOiBzdHJpbmcgPSBubHMubG9jYWxpemUoJ3JlbW90ZS50dW5uZWxWaWV3LmlubGluZUVsZXZhdGlvbk1lc3NhZ2UnLCBcIk1heSBSZXF1aXJlIFN1ZG9cIik7XG5jb25zdCBhbHJlYWR5Rm9yd2FyZGVkOiBzdHJpbmcgPSBubHMubG9jYWxpemUoJ3JlbW90ZS50dW5uZWxWaWV3LmFscmVhZHlGb3J3YXJkZWQnLCBcIlBvcnQgaXMgYWxyZWFkeSBmb3J3YXJkZWRcIik7XG5cbmV4cG9ydCBuYW1lc3BhY2UgRm9yd2FyZFBvcnRBY3Rpb24ge1xuXHRleHBvcnQgY29uc3QgSU5MSU5FX0lEID0gJ3JlbW90ZS50dW5uZWwuZm9yd2FyZElubGluZSc7XG5cdGV4cG9ydCBjb25zdCBDT01NQU5EUEFMRVRURV9JRCA9ICdyZW1vdGUudHVubmVsLmZvcndhcmRDb21tYW5kUGFsZXR0ZSc7XG5cdGV4cG9ydCBjb25zdCBMQUJFTDogSUxvY2FsaXplZFN0cmluZyA9IG5scy5sb2NhbGl6ZTIoJ3JlbW90ZS50dW5uZWwuZm9yd2FyZCcsIFwiRm9yd2FyZCBhIFBvcnRcIik7XG5cdGV4cG9ydCBjb25zdCBUUkVFSVRFTV9MQUJFTCA9IG5scy5sb2NhbGl6ZSgncmVtb3RlLnR1bm5lbC5mb3J3YXJkSXRlbScsIFwiRm9yd2FyZCBQb3J0XCIpO1xuXHRjb25zdCBmb3J3YXJkUHJvbXB0ID0gbmxzLmxvY2FsaXplKCdyZW1vdGUudHVubmVsLmZvcndhcmRQcm9tcHQnLCBcIlBvcnQgbnVtYmVyIG9yIGFkZHJlc3MgKGVnLiAzMDAwIG9yIDEwLjEwLjEwLjEwOjIwMDApLlwiKTtcblxuXHRmdW5jdGlvbiB2YWxpZGF0ZUlucHV0KHJlbW90ZUV4cGxvcmVyU2VydmljZTogSVJlbW90ZUV4cGxvcmVyU2VydmljZSwgdHVubmVsU2VydmljZTogSVR1bm5lbFNlcnZpY2UsIHZhbHVlOiBzdHJpbmcsIGNhbkVsZXZhdGU6IGJvb2xlYW4pOiB7IGNvbnRlbnQ6IHN0cmluZzsgc2V2ZXJpdHk6IFNldmVyaXR5IH0gfCBudWxsIHtcblx0XHRjb25zdCBwYXJzZWQgPSBwYXJzZUFkZHJlc3ModmFsdWUpO1xuXHRcdGlmICghcGFyc2VkKSB7XG5cdFx0XHRyZXR1cm4geyBjb250ZW50OiBpbnZhbGlkUG9ydFN0cmluZywgc2V2ZXJpdHk6IFNldmVyaXR5LkVycm9yIH07XG5cdFx0fSBlbHNlIGlmIChwYXJzZWQucG9ydCA+PSBtYXhQb3J0TnVtYmVyKSB7XG5cdFx0XHRyZXR1cm4geyBjb250ZW50OiBpbnZhbGlkUG9ydE51bWJlclN0cmluZywgc2V2ZXJpdHk6IFNldmVyaXR5LkVycm9yIH07XG5cdFx0fSBlbHNlIGlmIChjYW5FbGV2YXRlICYmIHR1bm5lbFNlcnZpY2UuaXNQb3J0UHJpdmlsZWdlZChwYXJzZWQucG9ydCkpIHtcblx0XHRcdHJldHVybiB7IGNvbnRlbnQ6IHJlcXVpcmVzU3Vkb1N0cmluZywgc2V2ZXJpdHk6IFNldmVyaXR5LkluZm8gfTtcblx0XHR9IGVsc2UgaWYgKG1hcEhhc0FkZHJlc3NMb2NhbGhvc3RPckFsbEludGVyZmFjZXMocmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsLmZvcndhcmRlZCwgcGFyc2VkLmhvc3QsIHBhcnNlZC5wb3J0KSkge1xuXHRcdFx0cmV0dXJuIHsgY29udGVudDogYWxyZWFkeUZvcndhcmRlZCwgc2V2ZXJpdHk6IFNldmVyaXR5LkVycm9yIH07XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0ZnVuY3Rpb24gZXJyb3Iobm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsIHR1bm5lbE9yRXJyb3I6IFJlbW90ZVR1bm5lbCB8IHN0cmluZyB8IHZvaWQsIGhvc3Q6IHN0cmluZywgcG9ydDogbnVtYmVyKSB7XG5cdFx0aWYgKCF0dW5uZWxPckVycm9yKSB7XG5cdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLndhcm4obmxzLmxvY2FsaXplKCdyZW1vdGUudHVubmVsLmZvcndhcmRFcnJvcicsIFwiVW5hYmxlIHRvIGZvcndhcmQgezB9OnsxfS4gVGhlIGhvc3QgbWF5IG5vdCBiZSBhdmFpbGFibGUgb3IgdGhhdCByZW1vdGUgcG9ydCBtYXkgYWxyZWFkeSBiZSBmb3J3YXJkZWRcIiwgaG9zdCwgcG9ydCkpO1xuXHRcdH0gZWxzZSBpZiAodHlwZW9mIHR1bm5lbE9yRXJyb3IgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLndhcm4obmxzLmxvY2FsaXplKCdyZW1vdGUudHVubmVsLmZvcndhcmRFcnJvclByb3ZpZGVkJywgXCJVbmFibGUgdG8gZm9yd2FyZCB7MH06ezF9LiB7Mn1cIiwgaG9zdCwgcG9ydCwgdHVubmVsT3JFcnJvcikpO1xuXHRcdH1cblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBpbmxpbmVIYW5kbGVyKCk6IElDb21tYW5kSGFuZGxlciB7XG5cdFx0cmV0dXJuIGFzeW5jIChhY2Nlc3NvciwgYXJnKSA9PiB7XG5cdFx0XHRjb25zdCByZW1vdGVFeHBsb3JlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVJlbW90ZUV4cGxvcmVyU2VydmljZSk7XG5cdFx0XHRjb25zdCBub3RpZmljYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElOb3RpZmljYXRpb25TZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHR1bm5lbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVR1bm5lbFNlcnZpY2UpO1xuXHRcdFx0cmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnNldEVkaXRhYmxlKHVuZGVmaW5lZCwgVHVubmVsRWRpdElkLk5ldywge1xuXHRcdFx0XHRvbkZpbmlzaDogYXN5bmMgKHZhbHVlLCBzdWNjZXNzKSA9PiB7XG5cdFx0XHRcdFx0cmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnNldEVkaXRhYmxlKHVuZGVmaW5lZCwgVHVubmVsRWRpdElkLk5ldywgbnVsbCk7XG5cdFx0XHRcdFx0bGV0IHBhcnNlZDogeyBob3N0OiBzdHJpbmc7IHBvcnQ6IG51bWJlciB9IHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRcdGlmIChzdWNjZXNzICYmIChwYXJzZWQgPSBwYXJzZUFkZHJlc3ModmFsdWUpKSkge1xuXHRcdFx0XHRcdFx0cmVtb3RlRXhwbG9yZXJTZXJ2aWNlLmZvcndhcmQoe1xuXHRcdFx0XHRcdFx0XHRyZW1vdGU6IHsgaG9zdDogcGFyc2VkLmhvc3QsIHBvcnQ6IHBhcnNlZC5wb3J0IH0sXG5cdFx0XHRcdFx0XHRcdGVsZXZhdGVJZk5lZWRlZDogdHJ1ZVxuXHRcdFx0XHRcdFx0fSkudGhlbih0dW5uZWxPckVycm9yID0+IGVycm9yKG5vdGlmaWNhdGlvblNlcnZpY2UsIHR1bm5lbE9yRXJyb3IsIHBhcnNlZCEuaG9zdCwgcGFyc2VkIS5wb3J0KSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR2YWxpZGF0aW9uTWVzc2FnZTogKHZhbHVlKSA9PiB2YWxpZGF0ZUlucHV0KHJlbW90ZUV4cGxvcmVyU2VydmljZSwgdHVubmVsU2VydmljZSwgdmFsdWUsIHR1bm5lbFNlcnZpY2UuY2FuRWxldmF0ZSksXG5cdFx0XHRcdHBsYWNlaG9sZGVyOiBmb3J3YXJkUHJvbXB0XG5cdFx0XHR9KTtcblx0XHR9O1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGNvbW1hbmRQYWxldHRlSGFuZGxlcigpOiBJQ29tbWFuZEhhbmRsZXIge1xuXHRcdHJldHVybiBhc3luYyAoYWNjZXNzb3IsIGFyZykgPT4ge1xuXHRcdFx0Y29uc3QgcmVtb3RlRXhwbG9yZXJTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElSZW1vdGVFeHBsb3JlclNlcnZpY2UpO1xuXHRcdFx0Y29uc3Qgbm90aWZpY2F0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90aWZpY2F0aW9uU2VydmljZSk7XG5cdFx0XHRjb25zdCB2aWV3c1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSk7XG5cdFx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgdHVubmVsU2VydmljZSA9IGFjY2Vzc29yLmdldChJVHVubmVsU2VydmljZSk7XG5cdFx0XHRhd2FpdCB2aWV3c1NlcnZpY2Uub3BlblZpZXcoVHVubmVsUGFuZWwuSUQsIHRydWUpO1xuXHRcdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCBxdWlja0lucHV0U2VydmljZS5pbnB1dCh7XG5cdFx0XHRcdHByb21wdDogZm9yd2FyZFByb21wdCxcblx0XHRcdFx0dmFsaWRhdGVJbnB1dDogKHZhbHVlKSA9PiBQcm9taXNlLnJlc29sdmUodmFsaWRhdGVJbnB1dChyZW1vdGVFeHBsb3JlclNlcnZpY2UsIHR1bm5lbFNlcnZpY2UsIHZhbHVlLCB0dW5uZWxTZXJ2aWNlLmNhbkVsZXZhdGUpKVxuXHRcdFx0fSk7XG5cdFx0XHRsZXQgcGFyc2VkOiB7IGhvc3Q6IHN0cmluZzsgcG9ydDogbnVtYmVyIH0gfCB1bmRlZmluZWQ7XG5cdFx0XHRpZiAodmFsdWUgJiYgKHBhcnNlZCA9IHBhcnNlQWRkcmVzcyh2YWx1ZSkpKSB7XG5cdFx0XHRcdHJlbW90ZUV4cGxvcmVyU2VydmljZS5mb3J3YXJkKHtcblx0XHRcdFx0XHRyZW1vdGU6IHsgaG9zdDogcGFyc2VkLmhvc3QsIHBvcnQ6IHBhcnNlZC5wb3J0IH0sXG5cdFx0XHRcdFx0ZWxldmF0ZUlmTmVlZGVkOiB0cnVlXG5cdFx0XHRcdH0pLnRoZW4odHVubmVsID0+IGVycm9yKG5vdGlmaWNhdGlvblNlcnZpY2UsIHR1bm5lbCwgcGFyc2VkIS5ob3N0LCBwYXJzZWQhLnBvcnQpKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG59XG5cbmludGVyZmFjZSBRdWlja1BpY2tUdW5uZWwgZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbSB7XG5cdHR1bm5lbD86IElUdW5uZWxJdGVtO1xufVxuXG5mdW5jdGlvbiBtYWtlVHVubmVsUGlja3ModHVubmVsczogVHVubmVsW10sIHJlbW90ZUV4cGxvcmVyU2VydmljZTogSVJlbW90ZUV4cGxvcmVyU2VydmljZSwgdHVubmVsU2VydmljZTogSVR1bm5lbFNlcnZpY2UpOiBRdWlja1BpY2tJbnB1dDxRdWlja1BpY2tUdW5uZWw+W10ge1xuXHRjb25zdCBwaWNrczogUXVpY2tQaWNrSW5wdXQ8UXVpY2tQaWNrVHVubmVsPltdID0gdHVubmVscy5tYXAoZm9yd2FyZGVkID0+IHtcblx0XHRjb25zdCBpdGVtID0gVHVubmVsSXRlbS5jcmVhdGVGcm9tVHVubmVsKHJlbW90ZUV4cGxvcmVyU2VydmljZSwgdHVubmVsU2VydmljZSwgZm9yd2FyZGVkKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bGFiZWw6IGl0ZW0ubGFiZWwsXG5cdFx0XHRkZXNjcmlwdGlvbjogaXRlbS5wcm9jZXNzRGVzY3JpcHRpb24sXG5cdFx0XHR0dW5uZWw6IGl0ZW1cblx0XHR9O1xuXHR9KTtcblx0aWYgKHBpY2tzLmxlbmd0aCA9PT0gMCkge1xuXHRcdHBpY2tzLnB1c2goe1xuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgncmVtb3RlLnR1bm5lbC5jbG9zZU5vUG9ydHMnLCBcIk5vIHBvcnRzIGN1cnJlbnRseSBmb3J3YXJkZWQuIFRyeSBydW5uaW5nIHRoZSB7MH0gY29tbWFuZFwiLCBGb3J3YXJkUG9ydEFjdGlvbi5MQUJFTC52YWx1ZSlcblx0XHR9KTtcblx0fVxuXHRyZXR1cm4gcGlja3M7XG59XG5cbm5hbWVzcGFjZSBDbG9zZVBvcnRBY3Rpb24ge1xuXHRleHBvcnQgY29uc3QgSU5MSU5FX0lEID0gJ3JlbW90ZS50dW5uZWwuY2xvc2VJbmxpbmUnO1xuXHRleHBvcnQgY29uc3QgQ09NTUFORFBBTEVUVEVfSUQgPSAncmVtb3RlLnR1bm5lbC5jbG9zZUNvbW1hbmRQYWxldHRlJztcblx0ZXhwb3J0IGNvbnN0IExBQkVMOiBJTG9jYWxpemVkU3RyaW5nID0gbmxzLmxvY2FsaXplMigncmVtb3RlLnR1bm5lbC5jbG9zZScsIFwiU3RvcCBGb3J3YXJkaW5nIFBvcnRcIik7XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGlubGluZUhhbmRsZXIoKTogSUNvbW1hbmRIYW5kbGVyIHtcblx0XHRyZXR1cm4gYXN5bmMgKGFjY2Vzc29yLCBhcmcpID0+IHtcblx0XHRcdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0XHRjb25zdCByZW1vdGVFeHBsb3JlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVJlbW90ZUV4cGxvcmVyU2VydmljZSk7XG5cdFx0XHRsZXQgcG9ydHM6IChJVHVubmVsSXRlbSB8IFR1bm5lbClbXSA9IFtdO1xuXHRcdFx0Y29uc3QgbXVsdGlTZWxlY3RDb250ZXh0ID0gY29udGV4dEtleVNlcnZpY2UuZ2V0Q29udGV4dEtleVZhbHVlPHN0cmluZ1tdIHwgdW5kZWZpbmVkPihUdW5uZWxWaWV3TXVsdGlTZWxlY3Rpb25LZXlOYW1lKTtcblx0XHRcdGlmIChtdWx0aVNlbGVjdENvbnRleHQpIHtcblx0XHRcdFx0bXVsdGlTZWxlY3RDb250ZXh0LmZvckVhY2goY29udGV4dCA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgdHVubmVsID0gcmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsLmZvcndhcmRlZC5nZXQoY29udGV4dCk7XG5cdFx0XHRcdFx0aWYgKHR1bm5lbCkge1xuXHRcdFx0XHRcdFx0cG9ydHM/LnB1c2godHVubmVsKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIGlmIChpc0lUdW5uZWxJdGVtKGFyZykpIHtcblx0XHRcdFx0cG9ydHMgPSBbYXJnXTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGNvbnRleHQgPSBjb250ZXh0S2V5U2VydmljZS5nZXRDb250ZXh0S2V5VmFsdWU8c3RyaW5nIHwgdW5kZWZpbmVkPihUdW5uZWxWaWV3U2VsZWN0aW9uS2V5TmFtZSk7XG5cdFx0XHRcdGNvbnN0IHR1bm5lbCA9IGNvbnRleHQgPyByZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWwuZm9yd2FyZGVkLmdldChjb250ZXh0KSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0aWYgKHR1bm5lbCkge1xuXHRcdFx0XHRcdHBvcnRzID0gW3R1bm5lbF07XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKCFwb3J0cyB8fCBwb3J0cy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFByb21pc2UuYWxsKHBvcnRzLm1hcChwb3J0ID0+IHJlbW90ZUV4cGxvcmVyU2VydmljZS5jbG9zZSh7IGhvc3Q6IHBvcnQucmVtb3RlSG9zdCwgcG9ydDogcG9ydC5yZW1vdGVQb3J0IH0sIFR1bm5lbENsb3NlUmVhc29uLlVzZXIpKSk7XG5cdFx0fTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBjb21tYW5kUGFsZXR0ZUhhbmRsZXIoKTogSUNvbW1hbmRIYW5kbGVyIHtcblx0XHRyZXR1cm4gYXN5bmMgKGFjY2Vzc29yKSA9PiB7XG5cdFx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgcmVtb3RlRXhwbG9yZXJTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElSZW1vdGVFeHBsb3JlclNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgdHVubmVsU2VydmljZSA9IGFjY2Vzc29yLmdldChJVHVubmVsU2VydmljZSk7XG5cdFx0XHRjb25zdCBjb21tYW5kU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCBwaWNrczogUXVpY2tQaWNrSW5wdXQ8UXVpY2tQaWNrVHVubmVsPltdID0gbWFrZVR1bm5lbFBpY2tzKEFycmF5LmZyb20ocmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsLmZvcndhcmRlZC52YWx1ZXMoKSkuZmlsdGVyKHR1bm5lbCA9PiB0dW5uZWwuY2xvc2VhYmxlKSwgcmVtb3RlRXhwbG9yZXJTZXJ2aWNlLCB0dW5uZWxTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHF1aWNrSW5wdXRTZXJ2aWNlLnBpY2socGlja3MsIHsgcGxhY2VIb2xkZXI6IG5scy5sb2NhbGl6ZSgncmVtb3RlLnR1bm5lbC5jbG9zZVBsYWNlaG9sZGVyJywgXCJDaG9vc2UgYSBwb3J0IHRvIHN0b3AgZm9yd2FyZGluZ1wiKSB9KTtcblx0XHRcdGlmIChyZXN1bHQgJiYgcmVzdWx0LnR1bm5lbCkge1xuXHRcdFx0XHRhd2FpdCByZW1vdGVFeHBsb3JlclNlcnZpY2UuY2xvc2UoeyBob3N0OiByZXN1bHQudHVubmVsLnJlbW90ZUhvc3QsIHBvcnQ6IHJlc3VsdC50dW5uZWwucmVtb3RlUG9ydCB9LCBUdW5uZWxDbG9zZVJlYXNvbi5Vc2VyKTtcblx0XHRcdH0gZWxzZSBpZiAocmVzdWx0KSB7XG5cdFx0XHRcdGF3YWl0IGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKEZvcndhcmRQb3J0QWN0aW9uLkNPTU1BTkRQQUxFVFRFX0lEKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgT3BlblBvcnRJbkJyb3dzZXJBY3Rpb24ge1xuXHRleHBvcnQgY29uc3QgSUQgPSAncmVtb3RlLnR1bm5lbC5vcGVuJztcblx0ZXhwb3J0IGNvbnN0IExBQkVMID0gbmxzLmxvY2FsaXplKCdyZW1vdGUudHVubmVsLm9wZW4nLCBcIk9wZW4gaW4gQnJvd3NlclwiKTtcblxuXHRleHBvcnQgZnVuY3Rpb24gaGFuZGxlcigpOiBJQ29tbWFuZEhhbmRsZXIge1xuXHRcdHJldHVybiBhc3luYyAoYWNjZXNzb3IsIGFyZykgPT4ge1xuXHRcdFx0bGV0IGtleTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKGlzSVR1bm5lbEl0ZW0oYXJnKSkge1xuXHRcdFx0XHRrZXkgPSBtYWtlQWRkcmVzcyhhcmcucmVtb3RlSG9zdCwgYXJnLnJlbW90ZVBvcnQpO1xuXHRcdFx0fSBlbHNlIGlmIChhcmcudHVubmVsUmVtb3RlSG9zdCAmJiBhcmcudHVubmVsUmVtb3RlUG9ydCkge1xuXHRcdFx0XHRrZXkgPSBtYWtlQWRkcmVzcyhhcmcudHVubmVsUmVtb3RlSG9zdCwgYXJnLnR1bm5lbFJlbW90ZVBvcnQpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGtleSkge1xuXHRcdFx0XHRjb25zdCBtb2RlbCA9IGFjY2Vzc29yLmdldChJUmVtb3RlRXhwbG9yZXJTZXJ2aWNlKS50dW5uZWxNb2RlbDtcblx0XHRcdFx0Y29uc3Qgb3BlbmVyU2VydmljZSA9IGFjY2Vzc29yLmdldChJT3BlbmVyU2VydmljZSk7XG5cdFx0XHRcdHJldHVybiBydW4obW9kZWwsIG9wZW5lclNlcnZpY2UsIGtleSk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBydW4obW9kZWw6IFR1bm5lbE1vZGVsLCBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSwga2V5OiBzdHJpbmcpIHtcblx0XHRjb25zdCB0dW5uZWwgPSBtb2RlbC5mb3J3YXJkZWQuZ2V0KGtleSkgfHwgbW9kZWwuZGV0ZWN0ZWQuZ2V0KGtleSk7XG5cdFx0aWYgKHR1bm5lbCkge1xuXHRcdFx0cmV0dXJuIG9wZW5lclNlcnZpY2Uub3Blbih0dW5uZWwubG9jYWxVcmksIHsgYWxsb3dDb250cmlidXRlZE9wZW5lcnM6IGZhbHNlIH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cbn1cblxuZXhwb3J0IG5hbWVzcGFjZSBPcGVuUG9ydEluUHJldmlld0FjdGlvbiB7XG5cdGV4cG9ydCBjb25zdCBJRCA9ICdyZW1vdGUudHVubmVsLm9wZW5QcmV2aWV3Jztcblx0ZXhwb3J0IGNvbnN0IExBQkVMID0gbmxzLmxvY2FsaXplKCdyZW1vdGUudHVubmVsLm9wZW5QcmV2aWV3JywgXCJQcmV2aWV3IGluIEVkaXRvclwiKTtcblxuXHRleHBvcnQgZnVuY3Rpb24gaGFuZGxlcigpOiBJQ29tbWFuZEhhbmRsZXIge1xuXHRcdHJldHVybiBhc3luYyAoYWNjZXNzb3IsIGFyZykgPT4ge1xuXHRcdFx0bGV0IGtleTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0aWYgKGlzSVR1bm5lbEl0ZW0oYXJnKSkge1xuXHRcdFx0XHRrZXkgPSBtYWtlQWRkcmVzcyhhcmcucmVtb3RlSG9zdCwgYXJnLnJlbW90ZVBvcnQpO1xuXHRcdFx0fSBlbHNlIGlmIChhcmcudHVubmVsUmVtb3RlSG9zdCAmJiBhcmcudHVubmVsUmVtb3RlUG9ydCkge1xuXHRcdFx0XHRrZXkgPSBtYWtlQWRkcmVzcyhhcmcudHVubmVsUmVtb3RlSG9zdCwgYXJnLnR1bm5lbFJlbW90ZVBvcnQpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGtleSkge1xuXHRcdFx0XHRjb25zdCBtb2RlbCA9IGFjY2Vzc29yLmdldChJUmVtb3RlRXhwbG9yZXJTZXJ2aWNlKS50dW5uZWxNb2RlbDtcblx0XHRcdFx0Y29uc3Qgb3BlbmVyU2VydmljZSA9IGFjY2Vzc29yLmdldChJT3BlbmVyU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGV4dGVybmFsT3BlbmVyU2VydmljZSA9IGFjY2Vzc29yLmdldChJRXh0ZXJuYWxVcmlPcGVuZXJTZXJ2aWNlKTtcblx0XHRcdFx0cmV0dXJuIHJ1bihtb2RlbCwgb3BlbmVyU2VydmljZSwgZXh0ZXJuYWxPcGVuZXJTZXJ2aWNlLCBrZXkpO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRleHBvcnQgYXN5bmMgZnVuY3Rpb24gcnVuKG1vZGVsOiBUdW5uZWxNb2RlbCwgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsIGV4dGVybmFsT3BlbmVyU2VydmljZTogSUV4dGVybmFsVXJpT3BlbmVyU2VydmljZSwga2V5OiBzdHJpbmcpIHtcblx0XHRjb25zdCB0dW5uZWwgPSBtb2RlbC5mb3J3YXJkZWQuZ2V0KGtleSkgfHwgbW9kZWwuZGV0ZWN0ZWQuZ2V0KGtleSk7XG5cdFx0aWYgKHR1bm5lbCkge1xuXHRcdFx0Y29uc3QgcmVtb3RlSG9zdCA9IHR1bm5lbC5yZW1vdGVIb3N0LmluY2x1ZGVzKCc6JykgPyBgWyR7dHVubmVsLnJlbW90ZUhvc3R9XWAgOiB0dW5uZWwucmVtb3RlSG9zdDtcblx0XHRcdGNvbnN0IHNvdXJjZVVyaSA9IFVSSS5wYXJzZShgaHR0cDovLyR7cmVtb3RlSG9zdH06JHt0dW5uZWwucmVtb3RlUG9ydH1gKTtcblx0XHRcdGNvbnN0IG9wZW5lciA9IGF3YWl0IGV4dGVybmFsT3BlbmVyU2VydmljZS5nZXRPcGVuZXIodHVubmVsLmxvY2FsVXJpLCB7IHNvdXJjZVVyaSB9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGlmIChvcGVuZXIpIHtcblx0XHRcdFx0cmV0dXJuIG9wZW5lci5vcGVuRXh0ZXJuYWxVcmkodHVubmVsLmxvY2FsVXJpLCB7IHNvdXJjZVVyaSB9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBvcGVuZXJTZXJ2aWNlLm9wZW4odHVubmVsLmxvY2FsVXJpKTtcblx0XHR9XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHR9XG59XG5cbm5hbWVzcGFjZSBPcGVuUG9ydEluQnJvd3NlckNvbW1hbmRQYWxldHRlQWN0aW9uIHtcblx0ZXhwb3J0IGNvbnN0IElEID0gJ3JlbW90ZS50dW5uZWwub3BlbkNvbW1hbmRQYWxldHRlJztcblx0ZXhwb3J0IGNvbnN0IExBQkVMID0gbmxzLmxvY2FsaXplKCdyZW1vdGUudHVubmVsLm9wZW5Db21tYW5kUGFsZXR0ZScsIFwiT3BlbiBQb3J0IGluIEJyb3dzZXJcIik7XG5cblx0aW50ZXJmYWNlIFF1aWNrUGlja1R1bm5lbCBleHRlbmRzIElRdWlja1BpY2tJdGVtIHtcblx0XHR0dW5uZWw/OiBUdW5uZWxJdGVtO1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGhhbmRsZXIoKTogSUNvbW1hbmRIYW5kbGVyIHtcblx0XHRyZXR1cm4gYXN5bmMgKGFjY2Vzc29yLCBhcmcpID0+IHtcblx0XHRcdGNvbnN0IHJlbW90ZUV4cGxvcmVyU2VydmljZSA9IGFjY2Vzc29yLmdldChJUmVtb3RlRXhwbG9yZXJTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHR1bm5lbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVR1bm5lbFNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgbW9kZWwgPSByZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWw7XG5cdFx0XHRjb25zdCBxdWlja1BpY2tTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdFx0XHRjb25zdCBvcGVuZXJTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElPcGVuZXJTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cdFx0XHRjb25zdCBvcHRpb25zOiBRdWlja1BpY2tUdW5uZWxbXSA9IFsuLi5tb2RlbC5mb3J3YXJkZWQsIC4uLm1vZGVsLmRldGVjdGVkXS5tYXAodmFsdWUgPT4ge1xuXHRcdFx0XHRjb25zdCB0dW5uZWxJdGVtID0gVHVubmVsSXRlbS5jcmVhdGVGcm9tVHVubmVsKHJlbW90ZUV4cGxvcmVyU2VydmljZSwgdHVubmVsU2VydmljZSwgdmFsdWVbMV0pO1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGxhYmVsOiB0dW5uZWxJdGVtLmxhYmVsLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiB0dW5uZWxJdGVtLnByb2Nlc3NEZXNjcmlwdGlvbixcblx0XHRcdFx0XHR0dW5uZWw6IHR1bm5lbEl0ZW1cblx0XHRcdFx0fTtcblx0XHRcdH0pO1xuXHRcdFx0aWYgKG9wdGlvbnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdG9wdGlvbnMucHVzaCh7XG5cdFx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgncmVtb3RlLnR1bm5lbC5vcGVuQ29tbWFuZFBhbGV0dGVOb25lJywgXCJObyBwb3J0cyBjdXJyZW50bHkgZm9yd2FyZGVkLiBPcGVuIHRoZSBQb3J0cyB2aWV3IHRvIGdldCBzdGFydGVkLlwiKVxuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG9wdGlvbnMucHVzaCh7XG5cdFx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgncmVtb3RlLnR1bm5lbC5vcGVuQ29tbWFuZFBhbGV0dGVWaWV3JywgXCJPcGVuIHRoZSBQb3J0cyB2aWV3Li4uXCIpXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcGlja2VkID0gYXdhaXQgcXVpY2tQaWNrU2VydmljZS5waWNrPFF1aWNrUGlja1R1bm5lbD4ob3B0aW9ucywgeyBwbGFjZUhvbGRlcjogbmxzLmxvY2FsaXplKCdyZW1vdGUudHVubmVsLm9wZW5Db21tYW5kUGFsZXR0ZVBpY2snLCBcIkNob29zZSB0aGUgcG9ydCB0byBvcGVuXCIpIH0pO1xuXHRcdFx0aWYgKHBpY2tlZCAmJiBwaWNrZWQudHVubmVsKSB7XG5cdFx0XHRcdHJldHVybiBPcGVuUG9ydEluQnJvd3NlckFjdGlvbi5ydW4obW9kZWwsIG9wZW5lclNlcnZpY2UsIG1ha2VBZGRyZXNzKHBpY2tlZC50dW5uZWwucmVtb3RlSG9zdCwgcGlja2VkLnR1bm5lbC5yZW1vdGVQb3J0KSk7XG5cdFx0XHR9IGVsc2UgaWYgKHBpY2tlZCkge1xuXHRcdFx0XHRyZXR1cm4gY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoYCR7VFVOTkVMX1ZJRVdfSUR9LmZvY3VzYCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxufVxuXG5uYW1lc3BhY2UgQ29weUFkZHJlc3NBY3Rpb24ge1xuXHRleHBvcnQgY29uc3QgSU5MSU5FX0lEID0gJ3JlbW90ZS50dW5uZWwuY29weUFkZHJlc3NJbmxpbmUnO1xuXHRleHBvcnQgY29uc3QgQ09NTUFORFBBTEVUVEVfSUQgPSAncmVtb3RlLnR1bm5lbC5jb3B5QWRkcmVzc0NvbW1hbmRQYWxldHRlJztcblx0ZXhwb3J0IGNvbnN0IElOTElORV9MQUJFTCA9IG5scy5sb2NhbGl6ZSgncmVtb3RlLnR1bm5lbC5jb3B5QWRkcmVzc0lubGluZScsIFwiQ29weSBMb2NhbCBBZGRyZXNzXCIpO1xuXHRleHBvcnQgY29uc3QgQ09NTUFORFBBTEVUVEVfTEFCRUwgPSBubHMubG9jYWxpemUoJ3JlbW90ZS50dW5uZWwuY29weUFkZHJlc3NDb21tYW5kUGFsZXR0ZScsIFwiQ29weSBGb3J3YXJkZWQgUG9ydCBBZGRyZXNzXCIpO1xuXG5cdGFzeW5jIGZ1bmN0aW9uIGNvcHlBZGRyZXNzKHJlbW90ZUV4cGxvcmVyU2VydmljZTogSVJlbW90ZUV4cGxvcmVyU2VydmljZSwgY2xpcGJvYXJkU2VydmljZTogSUNsaXBib2FyZFNlcnZpY2UsIHR1bm5lbEl0ZW06IHsgcmVtb3RlSG9zdDogc3RyaW5nOyByZW1vdGVQb3J0OiBudW1iZXIgfSkge1xuXHRcdGNvbnN0IGFkZHJlc3MgPSByZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWwuYWRkcmVzcyh0dW5uZWxJdGVtLnJlbW90ZUhvc3QsIHR1bm5lbEl0ZW0ucmVtb3RlUG9ydCk7XG5cdFx0aWYgKGFkZHJlc3MpIHtcblx0XHRcdGF3YWl0IGNsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KGFkZHJlc3MudG9TdHJpbmcoKSk7XG5cdFx0fVxuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGlubGluZUhhbmRsZXIoKTogSUNvbW1hbmRIYW5kbGVyIHtcblx0XHRyZXR1cm4gYXN5bmMgKGFjY2Vzc29yLCBhcmcpID0+IHtcblx0XHRcdGNvbnN0IHJlbW90ZUV4cGxvcmVyU2VydmljZSA9IGFjY2Vzc29yLmdldChJUmVtb3RlRXhwbG9yZXJTZXJ2aWNlKTtcblx0XHRcdGxldCB0dW5uZWxJdGVtOiBJVHVubmVsSXRlbSB8IFR1bm5lbCB8IHVuZGVmaW5lZDtcblx0XHRcdGlmIChpc0lUdW5uZWxJdGVtKGFyZykpIHtcblx0XHRcdFx0dHVubmVsSXRlbSA9IGFyZztcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGNvbnRleHQgPSBhY2Nlc3Nvci5nZXQoSUNvbnRleHRLZXlTZXJ2aWNlKS5nZXRDb250ZXh0S2V5VmFsdWU8c3RyaW5nIHwgdW5kZWZpbmVkPihUdW5uZWxWaWV3U2VsZWN0aW9uS2V5TmFtZSk7XG5cdFx0XHRcdHR1bm5lbEl0ZW0gPSBjb250ZXh0ID8gcmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsLmZvcndhcmRlZC5nZXQoY29udGV4dCkgOiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAodHVubmVsSXRlbSkge1xuXHRcdFx0XHRyZXR1cm4gY29weUFkZHJlc3MocmVtb3RlRXhwbG9yZXJTZXJ2aWNlLCBhY2Nlc3Nvci5nZXQoSUNsaXBib2FyZFNlcnZpY2UpLCB0dW5uZWxJdGVtKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGNvbW1hbmRQYWxldHRlSGFuZGxlcigpOiBJQ29tbWFuZEhhbmRsZXIge1xuXHRcdHJldHVybiBhc3luYyAoYWNjZXNzb3IsIGFyZykgPT4ge1xuXHRcdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHJlbW90ZUV4cGxvcmVyU2VydmljZSA9IGFjY2Vzc29yLmdldChJUmVtb3RlRXhwbG9yZXJTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHR1bm5lbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVR1bm5lbFNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGNsaXBib2FyZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNsaXBib2FyZFNlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCB0dW5uZWxzID0gQXJyYXkuZnJvbShyZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWwuZm9yd2FyZGVkLnZhbHVlcygpKS5jb25jYXQoQXJyYXkuZnJvbShyZW1vdGVFeHBsb3JlclNlcnZpY2UudHVubmVsTW9kZWwuZGV0ZWN0ZWQudmFsdWVzKCkpKTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHF1aWNrSW5wdXRTZXJ2aWNlLnBpY2sobWFrZVR1bm5lbFBpY2tzKHR1bm5lbHMsIHJlbW90ZUV4cGxvcmVyU2VydmljZSwgdHVubmVsU2VydmljZSksIHsgcGxhY2VIb2xkZXI6IG5scy5sb2NhbGl6ZSgncmVtb3RlLnR1bm5lbC5jb3B5QWRkcmVzc1BsYWNlaG9sZHRlcicsIFwiQ2hvb3NlIGEgZm9yd2FyZGVkIHBvcnRcIikgfSk7XG5cdFx0XHRpZiAocmVzdWx0ICYmIHJlc3VsdC50dW5uZWwpIHtcblx0XHRcdFx0YXdhaXQgY29weUFkZHJlc3MocmVtb3RlRXhwbG9yZXJTZXJ2aWNlLCBjbGlwYm9hcmRTZXJ2aWNlLCByZXN1bHQudHVubmVsKTtcblx0XHRcdH0gZWxzZSBpZiAocmVzdWx0KSB7XG5cdFx0XHRcdGF3YWl0IGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKEZvcndhcmRQb3J0QWN0aW9uLkNPTU1BTkRQQUxFVFRFX0lEKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG59XG5cbm5hbWVzcGFjZSBDaGFuZ2VMb2NhbFBvcnRBY3Rpb24ge1xuXHRleHBvcnQgY29uc3QgSUQgPSAncmVtb3RlLnR1bm5lbC5jaGFuZ2VMb2NhbFBvcnQnO1xuXHRleHBvcnQgY29uc3QgTEFCRUwgPSBubHMubG9jYWxpemUoJ3JlbW90ZS50dW5uZWwuY2hhbmdlTG9jYWxQb3J0JywgXCJDaGFuZ2UgTG9jYWwgQWRkcmVzcyBQb3J0XCIpO1xuXG5cdGZ1bmN0aW9uIHZhbGlkYXRlSW5wdXQodHVubmVsU2VydmljZTogSVR1bm5lbFNlcnZpY2UsIHZhbHVlOiBzdHJpbmcsIGNhbkVsZXZhdGU6IGJvb2xlYW4pOiB7IGNvbnRlbnQ6IHN0cmluZzsgc2V2ZXJpdHk6IFNldmVyaXR5IH0gfCBudWxsIHtcblx0XHRpZiAoIXZhbHVlLm1hdGNoKC9eWzAtOV0rJC8pKSB7XG5cdFx0XHRyZXR1cm4geyBjb250ZW50OiBubHMubG9jYWxpemUoJ3JlbW90ZS50dW5uZWxzVmlldy5wb3J0U2hvdWxkQmVOdW1iZXInLCBcIkxvY2FsIHBvcnQgc2hvdWxkIGJlIGEgbnVtYmVyLlwiKSwgc2V2ZXJpdHk6IFNldmVyaXR5LkVycm9yIH07XG5cdFx0fSBlbHNlIGlmIChOdW1iZXIodmFsdWUpID49IG1heFBvcnROdW1iZXIpIHtcblx0XHRcdHJldHVybiB7IGNvbnRlbnQ6IGludmFsaWRQb3J0TnVtYmVyU3RyaW5nLCBzZXZlcml0eTogU2V2ZXJpdHkuRXJyb3IgfTtcblx0XHR9IGVsc2UgaWYgKGNhbkVsZXZhdGUgJiYgdHVubmVsU2VydmljZS5pc1BvcnRQcml2aWxlZ2VkKE51bWJlcih2YWx1ZSkpKSB7XG5cdFx0XHRyZXR1cm4geyBjb250ZW50OiByZXF1aXJlc1N1ZG9TdHJpbmcsIHNldmVyaXR5OiBTZXZlcml0eS5JbmZvIH07XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGhhbmRsZXIoKTogSUNvbW1hbmRIYW5kbGVyIHtcblx0XHRyZXR1cm4gYXN5bmMgKGFjY2Vzc29yLCBhcmcpID0+IHtcblx0XHRcdGNvbnN0IHJlbW90ZUV4cGxvcmVyU2VydmljZSA9IGFjY2Vzc29yLmdldChJUmVtb3RlRXhwbG9yZXJTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgdHVubmVsU2VydmljZSA9IGFjY2Vzc29yLmdldChJVHVubmVsU2VydmljZSk7XG5cdFx0XHRsZXQgdHVubmVsQ29udGV4dDogSVR1bm5lbEl0ZW0gfCB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoaXNJVHVubmVsSXRlbShhcmcpKSB7XG5cdFx0XHRcdHR1bm5lbENvbnRleHQgPSBhcmc7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBjb250ZXh0ID0gYWNjZXNzb3IuZ2V0KElDb250ZXh0S2V5U2VydmljZSkuZ2V0Q29udGV4dEtleVZhbHVlPHN0cmluZyB8IHVuZGVmaW5lZD4oVHVubmVsVmlld1NlbGVjdGlvbktleU5hbWUpO1xuXHRcdFx0XHRjb25zdCB0dW5uZWwgPSBjb250ZXh0ID8gcmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsLmZvcndhcmRlZC5nZXQoY29udGV4dCkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmICh0dW5uZWwpIHtcblx0XHRcdFx0XHRjb25zdCB0dW5uZWxTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElUdW5uZWxTZXJ2aWNlKTtcblx0XHRcdFx0XHR0dW5uZWxDb250ZXh0ID0gVHVubmVsSXRlbS5jcmVhdGVGcm9tVHVubmVsKHJlbW90ZUV4cGxvcmVyU2VydmljZSwgdHVubmVsU2VydmljZSwgdHVubmVsKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAodHVubmVsQ29udGV4dCkge1xuXHRcdFx0XHRjb25zdCB0dW5uZWxJdGVtOiBJVHVubmVsSXRlbSA9IHR1bm5lbENvbnRleHQ7XG5cdFx0XHRcdHJlbW90ZUV4cGxvcmVyU2VydmljZS5zZXRFZGl0YWJsZSh0dW5uZWxJdGVtLCBUdW5uZWxFZGl0SWQuTG9jYWxQb3J0LCB7XG5cdFx0XHRcdFx0b25GaW5pc2g6IGFzeW5jICh2YWx1ZSwgc3VjY2VzcykgPT4ge1xuXHRcdFx0XHRcdFx0cmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnNldEVkaXRhYmxlKHR1bm5lbEl0ZW0sIFR1bm5lbEVkaXRJZC5Mb2NhbFBvcnQsIG51bGwpO1xuXHRcdFx0XHRcdFx0aWYgKHN1Y2Nlc3MpIHtcblx0XHRcdFx0XHRcdFx0YXdhaXQgcmVtb3RlRXhwbG9yZXJTZXJ2aWNlLmNsb3NlKHsgaG9zdDogdHVubmVsSXRlbS5yZW1vdGVIb3N0LCBwb3J0OiB0dW5uZWxJdGVtLnJlbW90ZVBvcnQgfSwgVHVubmVsQ2xvc2VSZWFzb24uT3RoZXIpO1xuXHRcdFx0XHRcdFx0XHRjb25zdCBudW1iZXJWYWx1ZSA9IE51bWJlcih2YWx1ZSk7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IG5ld0ZvcndhcmQgPSBhd2FpdCByZW1vdGVFeHBsb3JlclNlcnZpY2UuZm9yd2FyZCh7XG5cdFx0XHRcdFx0XHRcdFx0cmVtb3RlOiB7IGhvc3Q6IHR1bm5lbEl0ZW0ucmVtb3RlSG9zdCwgcG9ydDogdHVubmVsSXRlbS5yZW1vdGVQb3J0IH0sXG5cdFx0XHRcdFx0XHRcdFx0bG9jYWw6IG51bWJlclZhbHVlLFxuXHRcdFx0XHRcdFx0XHRcdG5hbWU6IHR1bm5lbEl0ZW0ubmFtZSxcblx0XHRcdFx0XHRcdFx0XHRlbGV2YXRlSWZOZWVkZWQ6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0c291cmNlOiB0dW5uZWxJdGVtLnNvdXJjZVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0aWYgKG5ld0ZvcndhcmQgJiYgKHR5cGVvZiBuZXdGb3J3YXJkICE9PSAnc3RyaW5nJykgJiYgbmV3Rm9yd2FyZC50dW5uZWxMb2NhbFBvcnQgIT09IG51bWJlclZhbHVlKSB7XG5cdFx0XHRcdFx0XHRcdFx0bm90aWZpY2F0aW9uU2VydmljZS53YXJuKG5scy5sb2NhbGl6ZSgncmVtb3RlLnR1bm5lbC5jaGFuZ2VMb2NhbFBvcnROdW1iZXInLCBcIlRoZSBsb2NhbCBwb3J0IHswfSBpcyBub3QgYXZhaWxhYmxlLiBQb3J0IG51bWJlciB7MX0gaGFzIGJlZW4gdXNlZCBpbnN0ZWFkXCIsIHZhbHVlLCBuZXdGb3J3YXJkLnR1bm5lbExvY2FsUG9ydCA/PyBuZXdGb3J3YXJkLmxvY2FsQWRkcmVzcykpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR2YWxpZGF0aW9uTWVzc2FnZTogKHZhbHVlKSA9PiB2YWxpZGF0ZUlucHV0KHR1bm5lbFNlcnZpY2UsIHZhbHVlLCB0dW5uZWxTZXJ2aWNlLmNhbkVsZXZhdGUpLFxuXHRcdFx0XHRcdHBsYWNlaG9sZGVyOiBubHMubG9jYWxpemUoJ3JlbW90ZS50dW5uZWxzVmlldy5jaGFuZ2VQb3J0JywgXCJOZXcgbG9jYWwgcG9ydFwiKVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG59XG5cbm5hbWVzcGFjZSBDaGFuZ2VUdW5uZWxQcml2YWN5QWN0aW9uIHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGhhbmRsZXIocHJpdmFjeUlkOiBzdHJpbmcpOiBJQ29tbWFuZEhhbmRsZXIge1xuXHRcdHJldHVybiBhc3luYyAoYWNjZXNzb3IsIGFyZykgPT4ge1xuXHRcdFx0aWYgKGlzSVR1bm5lbEl0ZW0oYXJnKSkge1xuXHRcdFx0XHRjb25zdCByZW1vdGVFeHBsb3JlclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVJlbW90ZUV4cGxvcmVyU2VydmljZSk7XG5cdFx0XHRcdGF3YWl0IHJlbW90ZUV4cGxvcmVyU2VydmljZS5jbG9zZSh7IGhvc3Q6IGFyZy5yZW1vdGVIb3N0LCBwb3J0OiBhcmcucmVtb3RlUG9ydCB9LCBUdW5uZWxDbG9zZVJlYXNvbi5PdGhlcik7XG5cdFx0XHRcdHJldHVybiByZW1vdGVFeHBsb3JlclNlcnZpY2UuZm9yd2FyZCh7XG5cdFx0XHRcdFx0cmVtb3RlOiB7IGhvc3Q6IGFyZy5yZW1vdGVIb3N0LCBwb3J0OiBhcmcucmVtb3RlUG9ydCB9LFxuXHRcdFx0XHRcdGxvY2FsOiBhcmcubG9jYWxQb3J0LFxuXHRcdFx0XHRcdG5hbWU6IGFyZy5uYW1lLFxuXHRcdFx0XHRcdGVsZXZhdGVJZk5lZWRlZDogdHJ1ZSxcblx0XHRcdFx0XHRwcml2YWN5OiBwcml2YWN5SWQsXG5cdFx0XHRcdFx0c291cmNlOiBhcmcuc291cmNlXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH07XG5cdH1cbn1cblxubmFtZXNwYWNlIFNldFR1bm5lbFByb3RvY29sQWN0aW9uIHtcblx0ZXhwb3J0IGNvbnN0IElEX0hUVFAgPSAncmVtb3RlLnR1bm5lbC5zZXRQcm90b2NvbEh0dHAnO1xuXHRleHBvcnQgY29uc3QgSURfSFRUUFMgPSAncmVtb3RlLnR1bm5lbC5zZXRQcm90b2NvbEh0dHBzJztcblx0ZXhwb3J0IGNvbnN0IExBQkVMX0hUVFAgPSBubHMubG9jYWxpemUoJ3JlbW90ZS50dW5uZWwucHJvdG9jb2xIdHRwJywgXCJIVFRQXCIpO1xuXHRleHBvcnQgY29uc3QgTEFCRUxfSFRUUFMgPSBubHMubG9jYWxpemUoJ3JlbW90ZS50dW5uZWwucHJvdG9jb2xIdHRwcycsIFwiSFRUUFNcIik7XG5cblx0YXN5bmMgZnVuY3Rpb24gaGFuZGxlcihhcmc6IGFueSwgcHJvdG9jb2w6IFR1bm5lbFByb3RvY29sLCByZW1vdGVFeHBsb3JlclNlcnZpY2U6IElSZW1vdGVFeHBsb3JlclNlcnZpY2UsIGVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSkge1xuXHRcdGlmIChpc0lUdW5uZWxJdGVtKGFyZykpIHtcblx0XHRcdGNvbnN0IGF0dHJpYnV0ZXM6IFBhcnRpYWw8QXR0cmlidXRlcz4gPSB7XG5cdFx0XHRcdHByb3RvY29sXG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgdGFyZ2V0ID0gZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSA/IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9SRU1PVEUgOiBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUw7XG5cdFx0XHRyZXR1cm4gcmVtb3RlRXhwbG9yZXJTZXJ2aWNlLnR1bm5lbE1vZGVsLmNvbmZpZ1BvcnRzQXR0cmlidXRlcy5hZGRBdHRyaWJ1dGVzKGFyZy5yZW1vdGVQb3J0LCBhdHRyaWJ1dGVzLCB0YXJnZXQpO1xuXHRcdH1cblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBoYW5kbGVySHR0cCgpOiBJQ29tbWFuZEhhbmRsZXIge1xuXHRcdHJldHVybiBhc3luYyAoYWNjZXNzb3IsIGFyZykgPT4ge1xuXHRcdFx0cmV0dXJuIGhhbmRsZXIoYXJnLCBUdW5uZWxQcm90b2NvbC5IdHRwLCBhY2Nlc3Nvci5nZXQoSVJlbW90ZUV4cGxvcmVyU2VydmljZSksIGFjY2Vzc29yLmdldChJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlKSk7XG5cdFx0fTtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBoYW5kbGVySHR0cHMoKTogSUNvbW1hbmRIYW5kbGVyIHtcblx0XHRyZXR1cm4gYXN5bmMgKGFjY2Vzc29yLCBhcmcpID0+IHtcblx0XHRcdHJldHVybiBoYW5kbGVyKGFyZywgVHVubmVsUHJvdG9jb2wuSHR0cHMsIGFjY2Vzc29yLmdldChJUmVtb3RlRXhwbG9yZXJTZXJ2aWNlKSwgYWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UpKTtcblx0XHR9O1xuXHR9XG59XG5cbmNvbnN0IHR1bm5lbFZpZXdDb21tYW5kc1dlaWdodEJvbnVzID0gMTA7IC8vIGdpdmUgb3VyIGNvbW1hbmRzIGEgbGl0dGxlIGJpdCBtb3JlIHdlaWdodCBvdmVyIG90aGVyIGRlZmF1bHQgbGlzdC90cmVlIGNvbW1hbmRzXG5cbmNvbnN0IGlzRm9yd2FyZGVkRXhwciA9IFR1bm5lbFR5cGVDb250ZXh0S2V5LmlzRXF1YWxUbyhUdW5uZWxUeXBlLkZvcndhcmRlZCk7XG5jb25zdCBpc0ZvcndhcmRlZE9yRGV0ZWN0ZWRFeHByID0gQ29udGV4dEtleUV4cHIub3IoaXNGb3J3YXJkZWRFeHByLCBUdW5uZWxUeXBlQ29udGV4dEtleS5pc0VxdWFsVG8oVHVubmVsVHlwZS5EZXRlY3RlZCkpO1xuY29uc3QgaXNOb3RNdWx0aVNlbGVjdGlvbkV4cHIgPSBUdW5uZWxWaWV3TXVsdGlTZWxlY3Rpb25Db250ZXh0S2V5LmlzRXF1YWxUbyh1bmRlZmluZWQpO1xuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6IExhYmVsVHVubmVsQWN0aW9uLklELFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYiArIHR1bm5lbFZpZXdDb21tYW5kc1dlaWdodEJvbnVzLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoVHVubmVsVmlld0ZvY3VzQ29udGV4dEtleSwgaXNGb3J3YXJkZWRFeHByLCBpc05vdE11bHRpU2VsZWN0aW9uRXhwciksXG5cdHByaW1hcnk6IEtleUNvZGUuRjIsXG5cdG1hYzoge1xuXHRcdHByaW1hcnk6IEtleUNvZGUuRW50ZXJcblx0fSxcblx0aGFuZGxlcjogTGFiZWxUdW5uZWxBY3Rpb24uaGFuZGxlcigpXG59KTtcbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKEZvcndhcmRQb3J0QWN0aW9uLklOTElORV9JRCwgRm9yd2FyZFBvcnRBY3Rpb24uaW5saW5lSGFuZGxlcigpKTtcbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKEZvcndhcmRQb3J0QWN0aW9uLkNPTU1BTkRQQUxFVFRFX0lELCBGb3J3YXJkUG9ydEFjdGlvbi5jb21tYW5kUGFsZXR0ZUhhbmRsZXIoKSk7XG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0aWQ6IENsb3NlUG9ydEFjdGlvbi5JTkxJTkVfSUQsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgdHVubmVsVmlld0NvbW1hbmRzV2VpZ2h0Qm9udXMsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChUdW5uZWxDbG9zZWFibGVDb250ZXh0S2V5LCBUdW5uZWxWaWV3Rm9jdXNDb250ZXh0S2V5KSxcblx0cHJpbWFyeTogS2V5Q29kZS5EZWxldGUsXG5cdG1hYzoge1xuXHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5CYWNrc3BhY2UsXG5cdFx0c2Vjb25kYXJ5OiBbS2V5Q29kZS5EZWxldGVdXG5cdH0sXG5cdGhhbmRsZXI6IENsb3NlUG9ydEFjdGlvbi5pbmxpbmVIYW5kbGVyKClcbn0pO1xuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZChDbG9zZVBvcnRBY3Rpb24uQ09NTUFORFBBTEVUVEVfSUQsIENsb3NlUG9ydEFjdGlvbi5jb21tYW5kUGFsZXR0ZUhhbmRsZXIoKSk7XG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZChPcGVuUG9ydEluQnJvd3NlckFjdGlvbi5JRCwgT3BlblBvcnRJbkJyb3dzZXJBY3Rpb24uaGFuZGxlcigpKTtcbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKE9wZW5Qb3J0SW5QcmV2aWV3QWN0aW9uLklELCBPcGVuUG9ydEluUHJldmlld0FjdGlvbi5oYW5kbGVyKCkpO1xuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoT3BlblBvcnRJbkJyb3dzZXJDb21tYW5kUGFsZXR0ZUFjdGlvbi5JRCwgT3BlblBvcnRJbkJyb3dzZXJDb21tYW5kUGFsZXR0ZUFjdGlvbi5oYW5kbGVyKCkpO1xuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiBDb3B5QWRkcmVzc0FjdGlvbi5JTkxJTkVfSUQsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliICsgdHVubmVsVmlld0NvbW1hbmRzV2VpZ2h0Qm9udXMsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChUdW5uZWxWaWV3Rm9jdXNDb250ZXh0S2V5LCBpc0ZvcndhcmRlZE9yRGV0ZWN0ZWRFeHByLCBpc05vdE11bHRpU2VsZWN0aW9uRXhwciksXG5cdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlDLFxuXHRoYW5kbGVyOiBDb3B5QWRkcmVzc0FjdGlvbi5pbmxpbmVIYW5kbGVyKClcbn0pO1xuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoQ29weUFkZHJlc3NBY3Rpb24uQ09NTUFORFBBTEVUVEVfSUQsIENvcHlBZGRyZXNzQWN0aW9uLmNvbW1hbmRQYWxldHRlSGFuZGxlcigpKTtcbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKENoYW5nZUxvY2FsUG9ydEFjdGlvbi5JRCwgQ2hhbmdlTG9jYWxQb3J0QWN0aW9uLmhhbmRsZXIoKSk7XG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZChTZXRUdW5uZWxQcm90b2NvbEFjdGlvbi5JRF9IVFRQLCBTZXRUdW5uZWxQcm90b2NvbEFjdGlvbi5oYW5kbGVySHR0cCgpKTtcbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKFNldFR1bm5lbFByb3RvY29sQWN0aW9uLklEX0hUVFBTLCBTZXRUdW5uZWxQcm90b2NvbEFjdGlvbi5oYW5kbGVySHR0cHMoKSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuQ29tbWFuZFBhbGV0dGUsICh7XG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogQ2xvc2VQb3J0QWN0aW9uLkNPTU1BTkRQQUxFVFRFX0lELFxuXHRcdHRpdGxlOiBDbG9zZVBvcnRBY3Rpb24uTEFCRUxcblx0fSxcblx0d2hlbjogZm9yd2FyZGVkUG9ydHNWaWV3RW5hYmxlZFxufSkpO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5Db21tYW5kUGFsZXR0ZSwgKHtcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBGb3J3YXJkUG9ydEFjdGlvbi5DT01NQU5EUEFMRVRURV9JRCxcblx0XHR0aXRsZTogRm9yd2FyZFBvcnRBY3Rpb24uTEFCRUxcblx0fSxcblx0d2hlbjogZm9yd2FyZGVkUG9ydHNWaWV3RW5hYmxlZFxufSkpO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5Db21tYW5kUGFsZXR0ZSwgKHtcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBDb3B5QWRkcmVzc0FjdGlvbi5DT01NQU5EUEFMRVRURV9JRCxcblx0XHR0aXRsZTogQ29weUFkZHJlc3NBY3Rpb24uQ09NTUFORFBBTEVUVEVfTEFCRUxcblx0fSxcblx0d2hlbjogZm9yd2FyZGVkUG9ydHNWaWV3RW5hYmxlZFxufSkpO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5Db21tYW5kUGFsZXR0ZSwgKHtcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBPcGVuUG9ydEluQnJvd3NlckNvbW1hbmRQYWxldHRlQWN0aW9uLklELFxuXHRcdHRpdGxlOiBPcGVuUG9ydEluQnJvd3NlckNvbW1hbmRQYWxldHRlQWN0aW9uLkxBQkVMXG5cdH0sXG5cdHdoZW46IGZvcndhcmRlZFBvcnRzVmlld0VuYWJsZWRcbn0pKTtcblxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5UdW5uZWxDb250ZXh0LCAoe1xuXHRncm91cDogJy5fb3BlbicsXG5cdG9yZGVyOiAwLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IE9wZW5Qb3J0SW5Ccm93c2VyQWN0aW9uLklELFxuXHRcdHRpdGxlOiBPcGVuUG9ydEluQnJvd3NlckFjdGlvbi5MQUJFTCxcblx0fSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKGlzRm9yd2FyZGVkT3JEZXRlY3RlZEV4cHIsIGlzTm90TXVsdGlTZWxlY3Rpb25FeHByKVxufSkpO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5UdW5uZWxDb250ZXh0LCAoe1xuXHRncm91cDogJy5fb3BlbicsXG5cdG9yZGVyOiAxLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IE9wZW5Qb3J0SW5QcmV2aWV3QWN0aW9uLklELFxuXHRcdHRpdGxlOiBPcGVuUG9ydEluUHJldmlld0FjdGlvbi5MQUJFTCxcblx0fSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdGlzRm9yd2FyZGVkT3JEZXRlY3RlZEV4cHIsXG5cdFx0aXNOb3RNdWx0aVNlbGVjdGlvbkV4cHIpXG59KSk7XG4vLyBUaGUgZ3JvdXAgMF9tYW5hZ2UgaXMgdXNlZCBieSBleHRlbnNpb25zLCBzbyB0cnkgbm90IHRvIGNoYW5nZSBpdFxuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5UdW5uZWxDb250ZXh0LCAoe1xuXHRncm91cDogJzBfbWFuYWdlJyxcblx0b3JkZXI6IDEsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogTGFiZWxUdW5uZWxBY3Rpb24uSUQsXG5cdFx0dGl0bGU6IExhYmVsVHVubmVsQWN0aW9uLkxBQkVMLFxuXHRcdGljb246IGxhYmVsUG9ydEljb25cblx0fSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKGlzRm9yd2FyZGVkRXhwciwgaXNOb3RNdWx0aVNlbGVjdGlvbkV4cHIpXG59KSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLlR1bm5lbENvbnRleHQsICh7XG5cdGdyb3VwOiAnMl9sb2NhbGFkZHJlc3MnLFxuXHRvcmRlcjogMCxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBDb3B5QWRkcmVzc0FjdGlvbi5JTkxJTkVfSUQsXG5cdFx0dGl0bGU6IENvcHlBZGRyZXNzQWN0aW9uLklOTElORV9MQUJFTCxcblx0fSxcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKGlzRm9yd2FyZGVkT3JEZXRlY3RlZEV4cHIsIGlzTm90TXVsdGlTZWxlY3Rpb25FeHByKVxufSkpO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5UdW5uZWxDb250ZXh0LCAoe1xuXHRncm91cDogJzJfbG9jYWxhZGRyZXNzJyxcblx0b3JkZXI6IDEsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogQ2hhbmdlTG9jYWxQb3J0QWN0aW9uLklELFxuXHRcdHRpdGxlOiBDaGFuZ2VMb2NhbFBvcnRBY3Rpb24uTEFCRUwsXG5cdH0sXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChpc0ZvcndhcmRlZEV4cHIsIFBvcnRDaGFuZ2FibGVDb250ZXh0S2V5LCBpc05vdE11bHRpU2VsZWN0aW9uRXhwcilcbn0pKTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuVHVubmVsQ29udGV4dCwgKHtcblx0Z3JvdXA6ICcyX2xvY2FsYWRkcmVzcycsXG5cdG9yZGVyOiAyLFxuXHRzdWJtZW51OiBNZW51SWQuVHVubmVsUHJpdmFjeSxcblx0dGl0bGU6IG5scy5sb2NhbGl6ZSgndHVubmVsQ29udGV4dC5wcml2YWN5TWVudScsIFwiUG9ydCBWaXNpYmlsaXR5XCIpLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoaXNGb3J3YXJkZWRFeHByLCBUdW5uZWxQcml2YWN5RW5hYmxlZENvbnRleHRLZXkpXG59KSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLlR1bm5lbENvbnRleHQsICh7XG5cdGdyb3VwOiAnMl9sb2NhbGFkZHJlc3MnLFxuXHRvcmRlcjogMyxcblx0c3VibWVudTogTWVudUlkLlR1bm5lbFByb3RvY29sLFxuXHR0aXRsZTogbmxzLmxvY2FsaXplKCd0dW5uZWxDb250ZXh0LnByb3RvY29sTWVudScsIFwiQ2hhbmdlIFBvcnQgUHJvdG9jb2xcIiksXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChpc0ZvcndhcmRlZEV4cHIsIGlzTm90TXVsdGlTZWxlY3Rpb25FeHByLCBQcm90b2NvbENoYW5nZWFibGVDb250ZXh0S2V5KVxufSkpO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5UdW5uZWxDb250ZXh0LCAoe1xuXHRncm91cDogJzNfZm9yd2FyZCcsXG5cdG9yZGVyOiAwLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IENsb3NlUG9ydEFjdGlvbi5JTkxJTkVfSUQsXG5cdFx0dGl0bGU6IENsb3NlUG9ydEFjdGlvbi5MQUJFTCxcblx0fSxcblx0d2hlbjogVHVubmVsQ2xvc2VhYmxlQ29udGV4dEtleVxufSkpO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5UdW5uZWxDb250ZXh0LCAoe1xuXHRncm91cDogJzNfZm9yd2FyZCcsXG5cdG9yZGVyOiAxLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IEZvcndhcmRQb3J0QWN0aW9uLklOTElORV9JRCxcblx0XHR0aXRsZTogRm9yd2FyZFBvcnRBY3Rpb24uTEFCRUwsXG5cdH0sXG59KSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuVHVubmVsUHJvdG9jb2wsICh7XG5cdG9yZGVyOiAwLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IFNldFR1bm5lbFByb3RvY29sQWN0aW9uLklEX0hUVFAsXG5cdFx0dGl0bGU6IFNldFR1bm5lbFByb3RvY29sQWN0aW9uLkxBQkVMX0hUVFAsXG5cdFx0dG9nZ2xlZDogVHVubmVsUHJvdG9jb2xDb250ZXh0S2V5LmlzRXF1YWxUbyhUdW5uZWxQcm90b2NvbC5IdHRwKVxuXHR9XG59KSk7XG5NZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLlR1bm5lbFByb3RvY29sLCAoe1xuXHRvcmRlcjogMSxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBTZXRUdW5uZWxQcm90b2NvbEFjdGlvbi5JRF9IVFRQUyxcblx0XHR0aXRsZTogU2V0VHVubmVsUHJvdG9jb2xBY3Rpb24uTEFCRUxfSFRUUFMsXG5cdFx0dG9nZ2xlZDogVHVubmVsUHJvdG9jb2xDb250ZXh0S2V5LmlzRXF1YWxUbyhUdW5uZWxQcm90b2NvbC5IdHRwcylcblx0fVxufSkpO1xuXG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuVHVubmVsUG9ydElubGluZSwgKHtcblx0Z3JvdXA6ICcwX21hbmFnZScsXG5cdG9yZGVyOiAwLFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IEZvcndhcmRQb3J0QWN0aW9uLklOTElORV9JRCxcblx0XHR0aXRsZTogRm9yd2FyZFBvcnRBY3Rpb24uVFJFRUlURU1fTEFCRUwsXG5cdFx0aWNvbjogZm9yd2FyZFBvcnRJY29uXG5cdH0sXG5cdHdoZW46IFR1bm5lbFR5cGVDb250ZXh0S2V5LmlzRXF1YWxUbyhUdW5uZWxUeXBlLkNhbmRpZGF0ZSlcbn0pKTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuVHVubmVsUG9ydElubGluZSwgKHtcblx0Z3JvdXA6ICcwX21hbmFnZScsXG5cdG9yZGVyOiA0LFxuXHRjb21tYW5kOiB7XG5cdFx0aWQ6IExhYmVsVHVubmVsQWN0aW9uLklELFxuXHRcdHRpdGxlOiBMYWJlbFR1bm5lbEFjdGlvbi5MQUJFTCxcblx0XHRpY29uOiBsYWJlbFBvcnRJY29uXG5cdH0sXG5cdHdoZW46IGlzRm9yd2FyZGVkRXhwclxufSkpO1xuTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5UdW5uZWxQb3J0SW5saW5lLCAoe1xuXHRncm91cDogJzBfbWFuYWdlJyxcblx0b3JkZXI6IDUsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogQ2xvc2VQb3J0QWN0aW9uLklOTElORV9JRCxcblx0XHR0aXRsZTogQ2xvc2VQb3J0QWN0aW9uLkxBQkVMLFxuXHRcdGljb246IHN0b3BGb3J3YXJkSWNvblxuXHR9LFxuXHR3aGVuOiBUdW5uZWxDbG9zZWFibGVDb250ZXh0S2V5XG59KSk7XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuVHVubmVsTG9jYWxBZGRyZXNzSW5saW5lLCAoe1xuXHRvcmRlcjogLTEsXG5cdGNvbW1hbmQ6IHtcblx0XHRpZDogQ29weUFkZHJlc3NBY3Rpb24uSU5MSU5FX0lELFxuXHRcdHRpdGxlOiBDb3B5QWRkcmVzc0FjdGlvbi5JTkxJTkVfTEFCRUwsXG5cdFx0aWNvbjogY29weUFkZHJlc3NJY29uXG5cdH0sXG5cdHdoZW46IGlzRm9yd2FyZGVkT3JEZXRlY3RlZEV4cHJcbn0pKTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuVHVubmVsTG9jYWxBZGRyZXNzSW5saW5lLCAoe1xuXHRvcmRlcjogMCxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBPcGVuUG9ydEluQnJvd3NlckFjdGlvbi5JRCxcblx0XHR0aXRsZTogT3BlblBvcnRJbkJyb3dzZXJBY3Rpb24uTEFCRUwsXG5cdFx0aWNvbjogb3BlbkJyb3dzZXJJY29uXG5cdH0sXG5cdHdoZW46IGlzRm9yd2FyZGVkT3JEZXRlY3RlZEV4cHJcbn0pKTtcbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuVHVubmVsTG9jYWxBZGRyZXNzSW5saW5lLCAoe1xuXHRvcmRlcjogMSxcblx0Y29tbWFuZDoge1xuXHRcdGlkOiBPcGVuUG9ydEluUHJldmlld0FjdGlvbi5JRCxcblx0XHR0aXRsZTogT3BlblBvcnRJblByZXZpZXdBY3Rpb24uTEFCRUwsXG5cdFx0aWNvbjogb3BlblByZXZpZXdJY29uXG5cdH0sXG5cdHdoZW46IGlzRm9yd2FyZGVkT3JEZXRlY3RlZEV4cHJcbn0pKTtcblxucmVnaXN0ZXJDb2xvcigncG9ydHMuaWNvblJ1bm5pbmdQcm9jZXNzRm9yZWdyb3VuZCcsIFNUQVRVU19CQVJfUkVNT1RFX0lURU1fQkFDS0dST1VORCwgbmxzLmxvY2FsaXplKCdwb3J0V2l0aFJ1bm5pbmdQcm9jZXNzLmZvcmVncm91bmQnLCBcIlRoZSBjb2xvciBvZiB0aGUgaWNvbiBmb3IgYSBwb3J0IHRoYXQgaGFzIGFuIGFzc29jaWF0ZWQgcnVubmluZyBwcm9jZXNzLlwiKSk7XG5cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLFlBQVksU0FBUztBQUNyQixZQUFZLFNBQVM7QUFDckIsU0FBeUMsOEJBQThCO0FBQ3ZFLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMscUJBQXFCLDJCQUEyQjtBQUN6RCxTQUFTLG9CQUFpQyxlQUFlLHNCQUFzQjtBQUMvRSxTQUFTLHFCQUFxQiw2QkFBNkI7QUFDM0QsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUywwQkFBMEQ7QUFDbkUsU0FBUyxpQkFBa0Msd0JBQXdCO0FBQ25FLFNBQVMsYUFBYTtBQUN0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QUksd0JBQXdCO0FBQUEsSUFDNUIsT0FBTyx3QkFBd0I7QUFBQSxJQUMvQixNQUFNO0FBQUEsRUFDUDtBQUFBLEVBQ0EsTUFBTTtBQUNQLENBQUU7QUFDRixhQUFhLGVBQWUsT0FBTywwQkFBMkI7QUFBQSxFQUM3RCxPQUFPO0FBQUEsRUFDUCxTQUFTO0FBQUEsSUFDUixJQUFJLHdCQUF3QjtBQUFBLElBQzVCLE9BQU8sd0JBQXdCO0FBQUEsSUFDL0IsTUFBTTtBQUFBLEVBQ1A7QUFBQSxFQUNBLE1BQU07QUFDUCxDQUFFO0FBRUYsY0FBYyxzQ0FBc0MsbUNBQW1DLElBQUksU0FBUyxxQ0FBcUMsMEVBQTBFLENBQUM7IiwKICAibmFtZXMiOiBbInZhbHVlIiwgIkxhYmVsVHVubmVsQWN0aW9uIiwgIkZvcndhcmRQb3J0QWN0aW9uIiwgIkNsb3NlUG9ydEFjdGlvbiIsICJPcGVuUG9ydEluQnJvd3NlckFjdGlvbiIsICJPcGVuUG9ydEluUHJldmlld0FjdGlvbiIsICJPcGVuUG9ydEluQnJvd3NlckNvbW1hbmRQYWxldHRlQWN0aW9uIiwgIkNvcHlBZGRyZXNzQWN0aW9uIiwgIkNoYW5nZUxvY2FsUG9ydEFjdGlvbiIsICJ0dW5uZWxTZXJ2aWNlIiwgIkNoYW5nZVR1bm5lbFByaXZhY3lBY3Rpb24iLCAiU2V0VHVubmVsUHJvdG9jb2xBY3Rpb24iXQp9Cg==
