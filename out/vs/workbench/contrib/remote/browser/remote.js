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
import "./media/remoteViewlet.css";
import * as nls from "../../../../nls.js";
import * as dom from "../../../../base/browser/dom.js";
import { URI } from "../../../../base/common/uri.js";
import { IWorkbenchLayoutService } from "../../../services/layout/browser/layoutService.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IExtensionService, isProposedApiEnabled } from "../../../services/extensions/common/extensions.js";
import { FilterViewPaneContainer } from "../../../browser/parts/views/viewsViewlet.js";
import { VIEWLET_ID } from "./remoteExplorer.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { Extensions, ViewContainerLocation, IViewDescriptorService } from "../../../common/views.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { PersistentConnectionEventType } from "../../../../platform/remote/common/remoteAgentConnection.js";
import Severity from "../../../../base/common/severity.js";
import { ReloadWindowAction } from "../../../browser/actions/windowActions.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { SwitchRemoteViewItem } from "./explorerViewItems.js";
import { isStringArray } from "../../../../base/common/types.js";
import { IRemoteExplorerService } from "../../../services/remote/common/remoteExplorerService.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { ViewPane } from "../../../browser/parts/views/viewPane.js";
import { WorkbenchAsyncDataTree } from "../../../../platform/list/browser/listService.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import * as icons from "./remoteIcons.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { ITimerService } from "../../../services/timer/browser/timerService.js";
import { getRemoteName } from "../../../../platform/remote/common/remoteHosts.js";
import { getVirtualWorkspaceLocation } from "../../../../platform/workspace/common/virtualWorkspace.js";
import { IWalkthroughsService } from "../../welcomeGettingStarted/browser/gettingStartedService.js";
import { Schemas } from "../../../../base/common/network.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
class HelpTreeVirtualDelegate {
  getHeight(element) {
    return 22;
  }
  getTemplateId(element) {
    return "HelpItemTemplate";
  }
}
class HelpTreeRenderer {
  constructor() {
    this.templateId = "HelpItemTemplate";
  }
  renderTemplate(container) {
    container.classList.add("remote-help-tree-node-item");
    const icon = dom.append(container, dom.$(".remote-help-tree-node-item-icon"));
    const parent = container;
    return { parent, icon };
  }
  renderElement(element, index, templateData, height) {
    const container = templateData.parent;
    dom.append(container, templateData.icon);
    templateData.icon.classList.add(...element.element.iconClasses);
    const labelContainer = dom.append(container, dom.$(".help-item-label"));
    labelContainer.innerText = element.element.label;
  }
  disposeTemplate(templateData) {
  }
}
class HelpDataSource {
  hasChildren(element) {
    return element instanceof HelpModel;
  }
  getChildren(element) {
    if (element instanceof HelpModel && element.items) {
      return element.items;
    }
    return [];
  }
}
class HelpModel {
  constructor(viewModel, openerService, quickInputService, commandService, remoteExplorerService, environmentService, workspaceContextService, walkthroughsService) {
    this.viewModel = viewModel;
    this.openerService = openerService;
    this.quickInputService = quickInputService;
    this.commandService = commandService;
    this.remoteExplorerService = remoteExplorerService;
    this.environmentService = environmentService;
    this.workspaceContextService = workspaceContextService;
    this.walkthroughsService = walkthroughsService;
    this.updateItems();
    viewModel.onDidChangeHelpInformation(() => this.updateItems());
  }
  createHelpItemValue(info, infoKey) {
    return new HelpItemValue(
      this.commandService,
      this.walkthroughsService,
      info.extensionDescription,
      typeof info.remoteName === "string" ? [info.remoteName] : info.remoteName,
      info.virtualWorkspace,
      info[infoKey]
    );
  }
  updateItems() {
    const helpItems = [];
    const getStarted = this.viewModel.helpInformation.filter((info) => info.getStarted);
    if (getStarted.length) {
      const helpItemValues = getStarted.map((info) => this.createHelpItemValue(info, "getStarted"));
      const getStartedHelpItem = this.items?.find((item) => item.icon === icons.getStartedIcon) ?? new GetStartedHelpItem(
        icons.getStartedIcon,
        nls.localize("remote.help.getStarted", "Get Started"),
        helpItemValues,
        this.quickInputService,
        this.environmentService,
        this.openerService,
        this.remoteExplorerService,
        this.workspaceContextService,
        this.commandService
      );
      getStartedHelpItem.values = helpItemValues;
      helpItems.push(getStartedHelpItem);
    }
    const documentation = this.viewModel.helpInformation.filter((info) => info.documentation);
    if (documentation.length) {
      const helpItemValues = documentation.map((info) => this.createHelpItemValue(info, "documentation"));
      const documentationHelpItem = this.items?.find((item) => item.icon === icons.documentationIcon) ?? new HelpItem(
        icons.documentationIcon,
        nls.localize("remote.help.documentation", "Read Documentation"),
        helpItemValues,
        this.quickInputService,
        this.environmentService,
        this.openerService,
        this.remoteExplorerService,
        this.workspaceContextService
      );
      documentationHelpItem.values = helpItemValues;
      helpItems.push(documentationHelpItem);
    }
    const issues = this.viewModel.helpInformation.filter((info) => info.issues);
    if (issues.length) {
      const helpItemValues = issues.map((info) => this.createHelpItemValue(info, "issues"));
      const reviewIssuesHelpItem = this.items?.find((item) => item.icon === icons.reviewIssuesIcon) ?? new HelpItem(
        icons.reviewIssuesIcon,
        nls.localize("remote.help.issues", "Review Issues"),
        helpItemValues,
        this.quickInputService,
        this.environmentService,
        this.openerService,
        this.remoteExplorerService,
        this.workspaceContextService
      );
      reviewIssuesHelpItem.values = helpItemValues;
      helpItems.push(reviewIssuesHelpItem);
    }
    if (helpItems.length) {
      const helpItemValues = this.viewModel.helpInformation.map((info) => this.createHelpItemValue(info, "reportIssue"));
      const issueReporterItem = this.items?.find((item) => item.icon === icons.reportIssuesIcon) ?? new IssueReporterItem(
        icons.reportIssuesIcon,
        nls.localize("remote.help.report", "Report Issue"),
        helpItemValues,
        this.quickInputService,
        this.environmentService,
        this.commandService,
        this.openerService,
        this.remoteExplorerService,
        this.workspaceContextService
      );
      issueReporterItem.values = helpItemValues;
      helpItems.push(issueReporterItem);
    }
    if (helpItems.length) {
      this.items = helpItems;
    }
  }
}
class HelpItemValue {
  constructor(commandService, walkthroughService, extensionDescription, remoteAuthority, virtualWorkspace, urlOrCommandOrId) {
    this.commandService = commandService;
    this.walkthroughService = walkthroughService;
    this.extensionDescription = extensionDescription;
    this.remoteAuthority = remoteAuthority;
    this.virtualWorkspace = virtualWorkspace;
    this.urlOrCommandOrId = urlOrCommandOrId;
  }
  get description() {
    return this.getUrl().then(() => this._description);
  }
  get url() {
    return this.getUrl();
  }
  async getUrl() {
    if (this._url === void 0) {
      if (typeof this.urlOrCommandOrId === "string") {
        const url = URI.parse(this.urlOrCommandOrId);
        if (url.authority) {
          this._url = this.urlOrCommandOrId;
        } else {
          const urlCommand = this.commandService.executeCommand(this.urlOrCommandOrId).then((result) => {
            this._url = result;
            return this._url;
          });
          const emptyString = new Promise((resolve) => setTimeout(() => resolve(""), 500));
          this._url = await Promise.race([urlCommand, emptyString]);
        }
      } else if (this.urlOrCommandOrId?.id) {
        try {
          const walkthroughId = `${this.extensionDescription.id}#${this.urlOrCommandOrId.id}`;
          const walkthrough = await this.walkthroughService.getWalkthrough(walkthroughId);
          this._description = walkthrough.title;
          this._url = walkthroughId;
        } catch {
        }
      }
    }
    if (this._url === void 0) {
      this._url = "";
    }
    return this._url;
  }
}
class HelpItemBase {
  constructor(icon, label, values, quickInputService, environmentService, remoteExplorerService, workspaceContextService) {
    this.icon = icon;
    this.label = label;
    this.values = values;
    this.quickInputService = quickInputService;
    this.environmentService = environmentService;
    this.remoteExplorerService = remoteExplorerService;
    this.workspaceContextService = workspaceContextService;
    this.iconClasses = [];
    this.iconClasses.push(...ThemeIcon.asClassNameArray(icon));
    this.iconClasses.push("remote-help-tree-node-item-icon");
  }
  async getActions() {
    return (await Promise.all(this.values.map(async (value) => {
      return {
        label: value.extensionDescription.displayName || value.extensionDescription.identifier.value,
        description: await value.description ?? await value.url,
        url: await value.url,
        extensionDescription: value.extensionDescription
      };
    }))).filter((item) => item.description);
  }
  async handleClick() {
    const remoteAuthority = this.environmentService.remoteAuthority;
    if (remoteAuthority) {
      for (let i = 0; i < this.remoteExplorerService.targetType.length; i++) {
        if (remoteAuthority.startsWith(this.remoteExplorerService.targetType[i])) {
          for (const value of this.values) {
            if (value.remoteAuthority) {
              for (const authority of value.remoteAuthority) {
                if (remoteAuthority.startsWith(authority)) {
                  await this.takeAction(value.extensionDescription, await value.url);
                  return;
                }
              }
            }
          }
        }
      }
    } else {
      const virtualWorkspace = getVirtualWorkspaceLocation(this.workspaceContextService.getWorkspace())?.scheme;
      if (virtualWorkspace) {
        for (let i = 0; i < this.remoteExplorerService.targetType.length; i++) {
          for (const value of this.values) {
            if (value.virtualWorkspace && value.remoteAuthority) {
              for (const authority of value.remoteAuthority) {
                if (this.remoteExplorerService.targetType[i].startsWith(authority) && virtualWorkspace.startsWith(value.virtualWorkspace)) {
                  await this.takeAction(value.extensionDescription, await value.url);
                  return;
                }
              }
            }
          }
        }
      }
    }
    if (this.values.length > 1) {
      const actions = await this.getActions();
      if (actions.length) {
        const action = await this.quickInputService.pick(actions, { placeHolder: nls.localize("pickRemoteExtension", "Select url to open") });
        if (action) {
          await this.takeAction(action.extensionDescription, action.url);
        }
      }
    } else {
      await this.takeAction(this.values[0].extensionDescription, await this.values[0].url);
    }
  }
}
class GetStartedHelpItem extends HelpItemBase {
  constructor(icon, label, values, quickInputService, environmentService, openerService, remoteExplorerService, workspaceContextService, commandService) {
    super(icon, label, values, quickInputService, environmentService, remoteExplorerService, workspaceContextService);
    this.openerService = openerService;
    this.commandService = commandService;
  }
  async takeAction(extensionDescription, urlOrWalkthroughId) {
    if ([Schemas.http, Schemas.https].includes(URI.parse(urlOrWalkthroughId).scheme)) {
      this.openerService.open(urlOrWalkthroughId, { allowCommands: true });
      return;
    }
    this.commandService.executeCommand("workbench.action.openWalkthrough", urlOrWalkthroughId);
  }
}
class HelpItem extends HelpItemBase {
  constructor(icon, label, values, quickInputService, environmentService, openerService, remoteExplorerService, workspaceContextService) {
    super(icon, label, values, quickInputService, environmentService, remoteExplorerService, workspaceContextService);
    this.openerService = openerService;
  }
  async takeAction(extensionDescription, url) {
    await this.openerService.open(URI.parse(url), { allowCommands: true });
  }
}
class IssueReporterItem extends HelpItemBase {
  constructor(icon, label, values, quickInputService, environmentService, commandService, openerService, remoteExplorerService, workspaceContextService) {
    super(icon, label, values, quickInputService, environmentService, remoteExplorerService, workspaceContextService);
    this.commandService = commandService;
    this.openerService = openerService;
  }
  async getActions() {
    return Promise.all(this.values.map(async (value) => {
      return {
        label: value.extensionDescription.displayName || value.extensionDescription.identifier.value,
        description: "",
        url: await value.url,
        extensionDescription: value.extensionDescription
      };
    }));
  }
  async takeAction(extensionDescription, url) {
    if (!url) {
      await this.commandService.executeCommand("workbench.action.openIssueReporter", [extensionDescription.identifier.value]);
    } else {
      await this.openerService.open(URI.parse(url));
    }
  }
}
let HelpPanel = class extends ViewPane {
  constructor(viewModel, options, keybindingService, contextMenuService, contextKeyService, configurationService, instantiationService, viewDescriptorService, openerService, quickInputService, commandService, remoteExplorerService, environmentService, themeService, hoverService, workspaceContextService, walkthroughsService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.viewModel = viewModel;
    this.quickInputService = quickInputService;
    this.commandService = commandService;
    this.remoteExplorerService = remoteExplorerService;
    this.environmentService = environmentService;
    this.workspaceContextService = workspaceContextService;
    this.walkthroughsService = walkthroughsService;
  }
  renderBody(container) {
    super.renderBody(container);
    container.classList.add("remote-help");
    const treeContainer = document.createElement("div");
    treeContainer.classList.add("remote-help-content");
    container.appendChild(treeContainer);
    this.tree = this.instantiationService.createInstance(
      WorkbenchAsyncDataTree,
      "RemoteHelp",
      treeContainer,
      new HelpTreeVirtualDelegate(),
      [new HelpTreeRenderer()],
      new HelpDataSource(),
      {
        accessibilityProvider: {
          getAriaLabel: (item) => {
            return item.label;
          },
          getWidgetAriaLabel: () => nls.localize("remotehelp", "Remote Help")
        }
      }
    );
    const model = new HelpModel(this.viewModel, this.openerService, this.quickInputService, this.commandService, this.remoteExplorerService, this.environmentService, this.workspaceContextService, this.walkthroughsService);
    this.tree.setInput(model);
    this._register(Event.debounce(this.tree.onDidOpen, (last, event) => event, 75, true)((e) => {
      e.element?.handleClick();
    }));
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.tree.layout(height, width);
  }
};
HelpPanel.ID = "~remote.helpPanel";
HelpPanel.TITLE = nls.localize2("remote.help", "Help and feedback");
HelpPanel = __decorateClass([
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, IContextMenuService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IViewDescriptorService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, IQuickInputService),
  __decorateParam(10, ICommandService),
  __decorateParam(11, IRemoteExplorerService),
  __decorateParam(12, IWorkbenchEnvironmentService),
  __decorateParam(13, IThemeService),
  __decorateParam(14, IHoverService),
  __decorateParam(15, IWorkspaceContextService),
  __decorateParam(16, IWalkthroughsService)
], HelpPanel);
class HelpPanelDescriptor {
  constructor(viewModel) {
    this.id = HelpPanel.ID;
    this.name = HelpPanel.TITLE;
    this.canToggleVisibility = true;
    this.hideByDefault = false;
    this.group = "help@50";
    this.order = -10;
    this.ctorDescriptor = new SyncDescriptor(HelpPanel, [viewModel]);
  }
}
let RemoteViewPaneContainer = class extends FilterViewPaneContainer {
  constructor(layoutService, telemetryService, contextService, storageService, configurationService, instantiationService, themeService, contextMenuService, extensionService, remoteExplorerService, viewDescriptorService, logService) {
    super(VIEWLET_ID, remoteExplorerService.onDidChangeTargetType, configurationService, layoutService, telemetryService, storageService, instantiationService, themeService, contextMenuService, extensionService, contextService, viewDescriptorService, logService);
    this.remoteExplorerService = remoteExplorerService;
    this.helpPanelDescriptor = new HelpPanelDescriptor(this);
    this.helpInformation = [];
    this._onDidChangeHelpInformation = new Emitter();
    this.onDidChangeHelpInformation = this._onDidChangeHelpInformation.event;
    this.hasRegisteredHelpView = false;
    this.addConstantViewDescriptors([this.helpPanelDescriptor]);
    this._register(this.remoteSwitcher = this.instantiationService.createInstance(SwitchRemoteViewItem));
    this.remoteExplorerService.onDidChangeHelpInformation((extensions) => {
      this._setHelpInformation(extensions);
    });
    this._setHelpInformation(this.remoteExplorerService.helpInformation);
    const viewsRegistry = Registry.as(Extensions.ViewsRegistry);
    this.remoteSwitcher.createOptionItems(viewsRegistry.getViews(this.viewContainer));
    this._register(viewsRegistry.onViewsRegistered((e) => {
      const remoteViews = [];
      for (const view of e) {
        if (view.viewContainer.id === VIEWLET_ID) {
          remoteViews.push(...view.views);
        }
      }
      if (remoteViews.length > 0) {
        this.remoteSwitcher.createOptionItems(remoteViews);
      }
    }));
    this._register(viewsRegistry.onViewsDeregistered((e) => {
      if (e.viewContainer.id === VIEWLET_ID) {
        this.remoteSwitcher.removeOptionItems(e.views);
      }
    }));
  }
  _setHelpInformation(extensions) {
    const helpInformation = [];
    for (const extension of extensions) {
      this._handleRemoteInfoExtensionPoint(extension, helpInformation);
    }
    this.helpInformation = helpInformation;
    this._onDidChangeHelpInformation.fire();
    const viewsRegistry = Registry.as(Extensions.ViewsRegistry);
    if (this.helpInformation.length && !this.hasRegisteredHelpView) {
      const view = viewsRegistry.getView(this.helpPanelDescriptor.id);
      if (!view) {
        viewsRegistry.registerViews([this.helpPanelDescriptor], this.viewContainer);
      }
      this.hasRegisteredHelpView = true;
    } else if (this.hasRegisteredHelpView) {
      viewsRegistry.deregisterViews([this.helpPanelDescriptor], this.viewContainer);
      this.hasRegisteredHelpView = false;
    }
  }
  _handleRemoteInfoExtensionPoint(extension, helpInformation) {
    if (!isProposedApiEnabled(extension.description, "contribRemoteHelp")) {
      return;
    }
    if (!extension.value.documentation && !extension.value.getStarted && !extension.value.issues) {
      return;
    }
    helpInformation.push({
      extensionDescription: extension.description,
      getStarted: extension.value.getStarted,
      documentation: extension.value.documentation,
      reportIssue: extension.value.reportIssue,
      issues: extension.value.issues,
      remoteName: extension.value.remoteName,
      virtualWorkspace: extension.value.virtualWorkspace
    });
  }
  getFilterOn(viewDescriptor) {
    return isStringArray(viewDescriptor.remoteAuthority) ? viewDescriptor.remoteAuthority[0] : viewDescriptor.remoteAuthority;
  }
  setFilter(viewDescriptor) {
    this.remoteExplorerService.targetType = isStringArray(viewDescriptor.remoteAuthority) ? viewDescriptor.remoteAuthority : [viewDescriptor.remoteAuthority];
  }
  getTitle() {
    const title = nls.localize("remote.explorer", "Remote Explorer");
    return title;
  }
};
RemoteViewPaneContainer = __decorateClass([
  __decorateParam(0, IWorkbenchLayoutService),
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IThemeService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IExtensionService),
  __decorateParam(9, IRemoteExplorerService),
  __decorateParam(10, IViewDescriptorService),
  __decorateParam(11, ILogService)
], RemoteViewPaneContainer);
Registry.as(Extensions.ViewContainersRegistry).registerViewContainer(
  {
    id: VIEWLET_ID,
    title: nls.localize2("remote.explorer", "Remote Explorer"),
    ctorDescriptor: new SyncDescriptor(RemoteViewPaneContainer),
    hideIfEmpty: true,
    viewOrderDelegate: {
      getOrder: (group) => {
        if (!group) {
          return;
        }
        let matches = /^targets@(\d+)$/.exec(group);
        if (matches) {
          return -1e3;
        }
        matches = /^details(@(\d+))?$/.exec(group);
        if (matches) {
          return -500 + Number(matches[2]);
        }
        matches = /^help(@(\d+))?$/.exec(group);
        if (matches) {
          return -10;
        }
        return;
      }
    },
    icon: icons.remoteExplorerViewIcon,
    order: 4,
    hideByDefault: true
  },
  ViewContainerLocation.Sidebar
);
let RemoteMarkers = class {
  constructor(remoteAgentService, timerService) {
    remoteAgentService.getEnvironment().then((remoteEnv) => {
      if (remoteEnv) {
        timerService.setPerformanceMarks("server", remoteEnv.marks);
      }
    });
  }
};
RemoteMarkers = __decorateClass([
  __decorateParam(0, IRemoteAgentService),
  __decorateParam(1, ITimerService)
], RemoteMarkers);
class VisibleProgress {
  get lastReport() {
    return this._lastReport;
  }
  constructor(progressService, location, initialReport, buttons, onDidCancel) {
    this.location = location;
    this._isDisposed = false;
    this._lastReport = initialReport;
    this._currentProgressPromiseResolve = null;
    this._currentProgress = null;
    this._currentTimer = null;
    const promise = new Promise((resolve) => this._currentProgressPromiseResolve = resolve);
    progressService.withProgress(
      { location, buttons },
      (progress) => {
        if (!this._isDisposed) {
          this._currentProgress = progress;
        }
        return promise;
      },
      (choice) => onDidCancel(choice, this._lastReport)
    );
    if (this._lastReport) {
      this.report();
    }
  }
  dispose() {
    this._isDisposed = true;
    if (this._currentProgressPromiseResolve) {
      this._currentProgressPromiseResolve();
      this._currentProgressPromiseResolve = null;
    }
    this._currentProgress = null;
    if (this._currentTimer) {
      this._currentTimer.dispose();
      this._currentTimer = null;
    }
  }
  report(message) {
    if (message) {
      this._lastReport = message;
    }
    if (this._lastReport && this._currentProgress) {
      this._currentProgress.report({ message: this._lastReport });
    }
  }
  startTimer(completionTime) {
    this.stopTimer();
    this._currentTimer = new ReconnectionTimer(this, completionTime);
  }
  stopTimer() {
    if (this._currentTimer) {
      this._currentTimer.dispose();
      this._currentTimer = null;
    }
  }
}
class ReconnectionTimer {
  constructor(parent, completionTime) {
    this._parent = parent;
    this._completionTime = completionTime;
    this._renderInterval = dom.disposableWindowInterval(mainWindow, () => this._render(), 1e3);
    this._render();
  }
  dispose() {
    this._renderInterval.dispose();
  }
  _render() {
    const remainingTimeMs = this._completionTime - Date.now();
    if (remainingTimeMs < 0) {
      return;
    }
    const remainingTime = Math.ceil(remainingTimeMs / 1e3);
    if (remainingTime === 1) {
      this._parent.report(nls.localize("reconnectionWaitOne", "Attempting to reconnect in {0} second...", remainingTime));
    } else {
      this._parent.report(nls.localize("reconnectionWaitMany", "Attempting to reconnect in {0} seconds...", remainingTime));
    }
  }
}
const DISCONNECT_PROMPT_TIME = 40 * 1e3;
let RemoteAgentConnectionStatusListener = class extends Disposable {
  constructor(remoteAgentService, progressService, dialogService, commandService, quickInputService, logService, environmentService, telemetryService) {
    super();
    this._reloadWindowShown = false;
    const connection = remoteAgentService.getConnection();
    if (connection) {
      let showProgress2 = function(location, buttons, initialReport = null) {
        if (visibleProgress) {
          visibleProgress.dispose();
          visibleProgress = null;
        }
        if (!location) {
          location = quickInputVisible ? ProgressLocation.Notification : ProgressLocation.Dialog;
        }
        return new VisibleProgress(
          progressService,
          location,
          initialReport,
          buttons.map((button) => button.label),
          (choice, lastReport) => {
            if (typeof choice !== "undefined" && buttons[choice]) {
              buttons[choice].callback();
            } else {
              if (location === ProgressLocation.Dialog) {
                visibleProgress = showProgress2(ProgressLocation.Notification, buttons, lastReport);
              } else {
                hideProgress2();
              }
            }
          }
        );
      }, hideProgress2 = function() {
        if (visibleProgress) {
          visibleProgress.dispose();
          visibleProgress = null;
        }
      };
      var showProgress = showProgress2, hideProgress = hideProgress2;
      let quickInputVisible = false;
      this._register(quickInputService.onShow(() => quickInputVisible = true));
      this._register(quickInputService.onHide(() => quickInputVisible = false));
      let visibleProgress = null;
      let reconnectWaitEvent = null;
      let disposableListener = null;
      let reconnectionToken = "";
      let lastIncomingDataTime = 0;
      let reconnectionAttempts = 0;
      const reconnectButton = {
        label: nls.localize("reconnectNow", "Reconnect Now"),
        callback: () => {
          reconnectWaitEvent?.skipWait();
        }
      };
      const reloadButton = {
        label: nls.localize("reloadWindow", "Reload Window"),
        callback: () => {
          telemetryService.publicLog2("remoteReconnectionReload", {
            remoteName: getRemoteName(environmentService.remoteAuthority),
            reconnectionToken,
            millisSinceLastIncomingData: Date.now() - lastIncomingDataTime,
            attempt: reconnectionAttempts
          });
          commandService.executeCommand(ReloadWindowAction.ID);
        }
      };
      connection.onDidStateChange((e) => {
        visibleProgress?.stopTimer();
        if (disposableListener) {
          disposableListener.dispose();
          disposableListener = null;
        }
        switch (e.type) {
          case PersistentConnectionEventType.ConnectionLost:
            reconnectionToken = e.reconnectionToken;
            lastIncomingDataTime = Date.now() - e.millisSinceLastIncomingData;
            reconnectionAttempts = 0;
            telemetryService.publicLog2("remoteConnectionLost", {
              remoteName: getRemoteName(environmentService.remoteAuthority),
              reconnectionToken: e.reconnectionToken
            });
            if (visibleProgress || e.millisSinceLastIncomingData > DISCONNECT_PROMPT_TIME) {
              if (!visibleProgress) {
                visibleProgress = showProgress2(null, [reconnectButton, reloadButton]);
              }
              visibleProgress.report(nls.localize("connectionLost", "Connection Lost"));
            }
            break;
          case PersistentConnectionEventType.ReconnectionWait:
            if (visibleProgress) {
              reconnectWaitEvent = e;
              visibleProgress = showProgress2(null, [reconnectButton, reloadButton]);
              visibleProgress.startTimer(Date.now() + 1e3 * e.durationSeconds);
            }
            break;
          case PersistentConnectionEventType.ReconnectionRunning:
            reconnectionToken = e.reconnectionToken;
            lastIncomingDataTime = Date.now() - e.millisSinceLastIncomingData;
            reconnectionAttempts = e.attempt;
            telemetryService.publicLog2("remoteReconnectionRunning", {
              remoteName: getRemoteName(environmentService.remoteAuthority),
              reconnectionToken: e.reconnectionToken,
              millisSinceLastIncomingData: e.millisSinceLastIncomingData,
              attempt: e.attempt
            });
            if (visibleProgress || e.millisSinceLastIncomingData > DISCONNECT_PROMPT_TIME) {
              visibleProgress = showProgress2(null, [reloadButton]);
              visibleProgress.report(nls.localize("reconnectionRunning", "Disconnected. Attempting to reconnect..."));
              disposableListener = quickInputService.onShow(() => {
                if (visibleProgress && visibleProgress.location === ProgressLocation.Dialog) {
                  visibleProgress = showProgress2(ProgressLocation.Notification, [reloadButton], visibleProgress.lastReport);
                }
              });
            }
            break;
          case PersistentConnectionEventType.ReconnectionPermanentFailure:
            reconnectionToken = e.reconnectionToken;
            lastIncomingDataTime = Date.now() - e.millisSinceLastIncomingData;
            reconnectionAttempts = e.attempt;
            telemetryService.publicLog2("remoteReconnectionPermanentFailure", {
              remoteName: getRemoteName(environmentService.remoteAuthority),
              reconnectionToken: e.reconnectionToken,
              millisSinceLastIncomingData: e.millisSinceLastIncomingData,
              attempt: e.attempt,
              handled: e.handled
            });
            hideProgress2();
            if (e.handled) {
              logService.info(`Error handled: Not showing a notification for the error.`);
              console.log(`Error handled: Not showing a notification for the error.`);
            } else if (!this._reloadWindowShown) {
              this._reloadWindowShown = true;
              dialogService.confirm({
                type: Severity.Error,
                message: nls.localize("reconnectionPermanentFailure", "Cannot reconnect. Please reload the window."),
                primaryButton: nls.localize({ key: "reloadWindow.dialog", comment: ["&& denotes a mnemonic"] }, "&&Reload Window")
              }).then((result) => {
                if (result.confirmed) {
                  commandService.executeCommand(ReloadWindowAction.ID);
                }
              });
            }
            break;
          case PersistentConnectionEventType.ConnectionGain:
            reconnectionToken = e.reconnectionToken;
            lastIncomingDataTime = Date.now() - e.millisSinceLastIncomingData;
            reconnectionAttempts = e.attempt;
            telemetryService.publicLog2("remoteConnectionGain", {
              remoteName: getRemoteName(environmentService.remoteAuthority),
              reconnectionToken: e.reconnectionToken,
              millisSinceLastIncomingData: e.millisSinceLastIncomingData,
              attempt: e.attempt
            });
            hideProgress2();
            break;
        }
      });
    }
  }
};
RemoteAgentConnectionStatusListener = __decorateClass([
  __decorateParam(0, IRemoteAgentService),
  __decorateParam(1, IProgressService),
  __decorateParam(2, IDialogService),
  __decorateParam(3, ICommandService),
  __decorateParam(4, IQuickInputService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IWorkbenchEnvironmentService),
  __decorateParam(7, ITelemetryService)
], RemoteAgentConnectionStatusListener);
export {
  RemoteAgentConnectionStatusListener,
  RemoteMarkers
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9yZW1vdGUvYnJvd3Nlci9yZW1vdGUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvcmVtb3RlVmlld2xldC5jc3MnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaExheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlLCBpc1Byb3Bvc2VkQXBpRW5hYmxlZCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRmlsdGVyVmlld1BhbmVDb250YWluZXIgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL3ZpZXdzL3ZpZXdzVmlld2xldC5qcyc7XG5pbXBvcnQgeyBWSUVXTEVUX0lEIH0gZnJvbSAnLi9yZW1vdGVFeHBsb3Jlci5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElWaWV3RGVzY3JpcHRvciwgSVZpZXdzUmVnaXN0cnksIEV4dGVuc2lvbnMsIFZpZXdDb250YWluZXJMb2NhdGlvbiwgSVZpZXdDb250YWluZXJzUmVnaXN0cnksIElWaWV3RGVzY3JpcHRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElQcm9ncmVzcywgSVByb2dyZXNzU3RlcCwgSVByb2dyZXNzU2VydmljZSwgUHJvZ3Jlc3NMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBSZWNvbm5lY3Rpb25XYWl0RXZlbnQsIFBlcnNpc3RlbnRDb25uZWN0aW9uRXZlbnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudENvbm5lY3Rpb24uanMnO1xuaW1wb3J0IFNldmVyaXR5IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3NldmVyaXR5LmpzJztcbmltcG9ydCB7IFJlbG9hZFdpbmRvd0FjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvYWN0aW9ucy93aW5kb3dBY3Rpb25zLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFN3aXRjaFJlbW90ZVZpZXdJdGVtIH0gZnJvbSAnLi9leHBsb3JlclZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyBpc1N0cmluZ0FycmF5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgSGVscEluZm9ybWF0aW9uLCBJUmVtb3RlRXhwbG9yZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi9yZW1vdGVFeHBsb3JlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVmlld1BhbmUsIElWaWV3UGFuZU9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL3ZpZXdzL3ZpZXdQYW5lLmpzJztcbmltcG9ydCB7IElMaXN0VmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBJVHJlZVJlbmRlcmVyLCBJVHJlZU5vZGUsIElBc3luY0RhdGFTb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS90cmVlLmpzJztcbmltcG9ydCB7IFdvcmtiZW5jaEFzeW5jRGF0YVRyZWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBFdmVudCwgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25Qb2ludFVzZXIgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgKiBhcyBpY29ucyBmcm9tICcuL3JlbW90ZUljb25zLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVRpbWVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3RpbWVyL2Jyb3dzZXIvdGltZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGdldFJlbW90ZU5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUhvc3RzLmpzJztcbmltcG9ydCB7IGdldFZpcnR1YWxXb3Jrc3BhY2VMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vdmlydHVhbFdvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJV2Fsa3Rocm91Z2hzU2VydmljZSB9IGZyb20gJy4uLy4uL3dlbGNvbWVHZXR0aW5nU3RhcnRlZC9icm93c2VyL2dldHRpbmdTdGFydGVkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5cbmludGVyZmFjZSBJVmlld01vZGVsIHtcblx0b25EaWRDaGFuZ2VIZWxwSW5mb3JtYXRpb246IEV2ZW50PHZvaWQ+O1xuXHRoZWxwSW5mb3JtYXRpb246IEhlbHBJbmZvcm1hdGlvbltdO1xufVxuXG5jbGFzcyBIZWxwVHJlZVZpcnR1YWxEZWxlZ2F0ZSBpbXBsZW1lbnRzIElMaXN0VmlydHVhbERlbGVnYXRlPElIZWxwSXRlbT4ge1xuXHRnZXRIZWlnaHQoZWxlbWVudDogSUhlbHBJdGVtKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gMjI7XG5cdH1cblxuXHRnZXRUZW1wbGF0ZUlkKGVsZW1lbnQ6IElIZWxwSXRlbSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuICdIZWxwSXRlbVRlbXBsYXRlJztcblx0fVxufVxuXG5pbnRlcmZhY2UgSUhlbHBJdGVtVGVtcGxhdGVEYXRhIHtcblx0cGFyZW50OiBIVE1MRWxlbWVudDtcblx0aWNvbjogSFRNTEVsZW1lbnQ7XG59XG5cbmNsYXNzIEhlbHBUcmVlUmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPEhlbHBNb2RlbCB8IElIZWxwSXRlbSwgSUhlbHBJdGVtLCBJSGVscEl0ZW1UZW1wbGF0ZURhdGE+IHtcblx0dGVtcGxhdGVJZDogc3RyaW5nID0gJ0hlbHBJdGVtVGVtcGxhdGUnO1xuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJSGVscEl0ZW1UZW1wbGF0ZURhdGEge1xuXHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdyZW1vdGUtaGVscC10cmVlLW5vZGUtaXRlbScpO1xuXHRcdGNvbnN0IGljb24gPSBkb20uYXBwZW5kKGNvbnRhaW5lciwgZG9tLiQoJy5yZW1vdGUtaGVscC10cmVlLW5vZGUtaXRlbS1pY29uJykpO1xuXHRcdGNvbnN0IHBhcmVudCA9IGNvbnRhaW5lcjtcblx0XHRyZXR1cm4geyBwYXJlbnQsIGljb24gfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoZWxlbWVudDogSVRyZWVOb2RlPElIZWxwSXRlbSwgSUhlbHBJdGVtPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJSGVscEl0ZW1UZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gdGVtcGxhdGVEYXRhLnBhcmVudDtcblx0XHRkb20uYXBwZW5kKGNvbnRhaW5lciwgdGVtcGxhdGVEYXRhLmljb24pO1xuXHRcdHRlbXBsYXRlRGF0YS5pY29uLmNsYXNzTGlzdC5hZGQoLi4uZWxlbWVudC5lbGVtZW50Lmljb25DbGFzc2VzKTtcblx0XHRjb25zdCBsYWJlbENvbnRhaW5lciA9IGRvbS5hcHBlbmQoY29udGFpbmVyLCBkb20uJCgnLmhlbHAtaXRlbS1sYWJlbCcpKTtcblx0XHRsYWJlbENvbnRhaW5lci5pbm5lclRleHQgPSBlbGVtZW50LmVsZW1lbnQubGFiZWw7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJSGVscEl0ZW1UZW1wbGF0ZURhdGEpOiB2b2lkIHtcblxuXHR9XG59XG5cbmNsYXNzIEhlbHBEYXRhU291cmNlIGltcGxlbWVudHMgSUFzeW5jRGF0YVNvdXJjZTxIZWxwTW9kZWwsIElIZWxwSXRlbT4ge1xuXHRoYXNDaGlsZHJlbihlbGVtZW50OiBIZWxwTW9kZWwpIHtcblx0XHRyZXR1cm4gZWxlbWVudCBpbnN0YW5jZW9mIEhlbHBNb2RlbDtcblx0fVxuXG5cdGdldENoaWxkcmVuKGVsZW1lbnQ6IEhlbHBNb2RlbCkge1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgSGVscE1vZGVsICYmIGVsZW1lbnQuaXRlbXMpIHtcblx0XHRcdHJldHVybiBlbGVtZW50Lml0ZW1zO1xuXHRcdH1cblxuXHRcdHJldHVybiBbXTtcblx0fVxufVxuaW50ZXJmYWNlIElIZWxwSXRlbSB7XG5cdGljb246IFRoZW1lSWNvbjtcblx0aWNvbkNsYXNzZXM6IHN0cmluZ1tdO1xuXHRsYWJlbDogc3RyaW5nO1xuXHR2YWx1ZXM6IEhlbHBJdGVtVmFsdWVbXTtcblx0aGFuZGxlQ2xpY2soKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuY2xhc3MgSGVscE1vZGVsIHtcblx0aXRlbXM6IElIZWxwSXRlbVtdIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgdmlld01vZGVsOiBJVmlld01vZGVsLFxuXHRcdHByaXZhdGUgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0cHJpdmF0ZSBxdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdHByaXZhdGUgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRwcml2YXRlIHJlbW90ZUV4cGxvcmVyU2VydmljZTogSVJlbW90ZUV4cGxvcmVyU2VydmljZSxcblx0XHRwcml2YXRlIGVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRwcml2YXRlIHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0cHJpdmF0ZSB3YWxrdGhyb3VnaHNTZXJ2aWNlOiBJV2Fsa3Rocm91Z2hzU2VydmljZVxuXHQpIHtcblx0XHR0aGlzLnVwZGF0ZUl0ZW1zKCk7XG5cdFx0dmlld01vZGVsLm9uRGlkQ2hhbmdlSGVscEluZm9ybWF0aW9uKCgpID0+IHRoaXMudXBkYXRlSXRlbXMoKSk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUhlbHBJdGVtVmFsdWUoaW5mbzogSGVscEluZm9ybWF0aW9uLCBpbmZvS2V5OiBFeGNsdWRlPGtleW9mIEhlbHBJbmZvcm1hdGlvbiwgJ2V4dGVuc2lvbkRlc2NyaXB0aW9uJyB8ICdyZW1vdGVOYW1lJyB8ICd2aXJ0dWFsV29ya3NwYWNlJz4pIHtcblx0XHRyZXR1cm4gbmV3IEhlbHBJdGVtVmFsdWUodGhpcy5jb21tYW5kU2VydmljZSxcblx0XHRcdHRoaXMud2Fsa3Rocm91Z2hzU2VydmljZSxcblx0XHRcdGluZm8uZXh0ZW5zaW9uRGVzY3JpcHRpb24sXG5cdFx0XHQodHlwZW9mIGluZm8ucmVtb3RlTmFtZSA9PT0gJ3N0cmluZycpID8gW2luZm8ucmVtb3RlTmFtZV0gOiBpbmZvLnJlbW90ZU5hbWUsXG5cdFx0XHRpbmZvLnZpcnR1YWxXb3Jrc3BhY2UsXG5cdFx0XHRpbmZvW2luZm9LZXldKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlSXRlbXMoKSB7XG5cdFx0Y29uc3QgaGVscEl0ZW1zOiBJSGVscEl0ZW1bXSA9IFtdO1xuXG5cdFx0Y29uc3QgZ2V0U3RhcnRlZCA9IHRoaXMudmlld01vZGVsLmhlbHBJbmZvcm1hdGlvbi5maWx0ZXIoaW5mbyA9PiBpbmZvLmdldFN0YXJ0ZWQpO1xuXHRcdGlmIChnZXRTdGFydGVkLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgaGVscEl0ZW1WYWx1ZXMgPSBnZXRTdGFydGVkLm1hcCgoaW5mbzogSGVscEluZm9ybWF0aW9uKSA9PiB0aGlzLmNyZWF0ZUhlbHBJdGVtVmFsdWUoaW5mbywgJ2dldFN0YXJ0ZWQnKSk7XG5cdFx0XHRjb25zdCBnZXRTdGFydGVkSGVscEl0ZW0gPSB0aGlzLml0ZW1zPy5maW5kKGl0ZW0gPT4gaXRlbS5pY29uID09PSBpY29ucy5nZXRTdGFydGVkSWNvbikgPz8gbmV3IEdldFN0YXJ0ZWRIZWxwSXRlbShcblx0XHRcdFx0aWNvbnMuZ2V0U3RhcnRlZEljb24sXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgncmVtb3RlLmhlbHAuZ2V0U3RhcnRlZCcsIFwiR2V0IFN0YXJ0ZWRcIiksXG5cdFx0XHRcdGhlbHBJdGVtVmFsdWVzLFxuXHRcdFx0XHR0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdFx0XHR0aGlzLmVudmlyb25tZW50U2VydmljZSxcblx0XHRcdFx0dGhpcy5vcGVuZXJTZXJ2aWNlLFxuXHRcdFx0XHR0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZSxcblx0XHRcdFx0dGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRcdFx0dGhpcy5jb21tYW5kU2VydmljZVxuXHRcdFx0KTtcblx0XHRcdGdldFN0YXJ0ZWRIZWxwSXRlbS52YWx1ZXMgPSBoZWxwSXRlbVZhbHVlcztcblx0XHRcdGhlbHBJdGVtcy5wdXNoKGdldFN0YXJ0ZWRIZWxwSXRlbSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZG9jdW1lbnRhdGlvbiA9IHRoaXMudmlld01vZGVsLmhlbHBJbmZvcm1hdGlvbi5maWx0ZXIoaW5mbyA9PiBpbmZvLmRvY3VtZW50YXRpb24pO1xuXHRcdGlmIChkb2N1bWVudGF0aW9uLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgaGVscEl0ZW1WYWx1ZXMgPSBkb2N1bWVudGF0aW9uLm1hcCgoaW5mbzogSGVscEluZm9ybWF0aW9uKSA9PiB0aGlzLmNyZWF0ZUhlbHBJdGVtVmFsdWUoaW5mbywgJ2RvY3VtZW50YXRpb24nKSk7XG5cdFx0XHRjb25zdCBkb2N1bWVudGF0aW9uSGVscEl0ZW0gPSB0aGlzLml0ZW1zPy5maW5kKGl0ZW0gPT4gaXRlbS5pY29uID09PSBpY29ucy5kb2N1bWVudGF0aW9uSWNvbikgPz8gbmV3IEhlbHBJdGVtKFxuXHRcdFx0XHRpY29ucy5kb2N1bWVudGF0aW9uSWNvbixcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdyZW1vdGUuaGVscC5kb2N1bWVudGF0aW9uJywgXCJSZWFkIERvY3VtZW50YXRpb25cIiksXG5cdFx0XHRcdGhlbHBJdGVtVmFsdWVzLFxuXHRcdFx0XHR0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdFx0XHR0aGlzLmVudmlyb25tZW50U2VydmljZSxcblx0XHRcdFx0dGhpcy5vcGVuZXJTZXJ2aWNlLFxuXHRcdFx0XHR0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZSxcblx0XHRcdFx0dGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZVxuXHRcdFx0KTtcblx0XHRcdGRvY3VtZW50YXRpb25IZWxwSXRlbS52YWx1ZXMgPSBoZWxwSXRlbVZhbHVlcztcblx0XHRcdGhlbHBJdGVtcy5wdXNoKGRvY3VtZW50YXRpb25IZWxwSXRlbSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXNzdWVzID0gdGhpcy52aWV3TW9kZWwuaGVscEluZm9ybWF0aW9uLmZpbHRlcihpbmZvID0+IGluZm8uaXNzdWVzKTtcblx0XHRpZiAoaXNzdWVzLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgaGVscEl0ZW1WYWx1ZXMgPSBpc3N1ZXMubWFwKChpbmZvOiBIZWxwSW5mb3JtYXRpb24pID0+IHRoaXMuY3JlYXRlSGVscEl0ZW1WYWx1ZShpbmZvLCAnaXNzdWVzJykpO1xuXHRcdFx0Y29uc3QgcmV2aWV3SXNzdWVzSGVscEl0ZW0gPSB0aGlzLml0ZW1zPy5maW5kKGl0ZW0gPT4gaXRlbS5pY29uID09PSBpY29ucy5yZXZpZXdJc3N1ZXNJY29uKSA/PyBuZXcgSGVscEl0ZW0oXG5cdFx0XHRcdGljb25zLnJldmlld0lzc3Vlc0ljb24sXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgncmVtb3RlLmhlbHAuaXNzdWVzJywgXCJSZXZpZXcgSXNzdWVzXCIpLFxuXHRcdFx0XHRoZWxwSXRlbVZhbHVlcyxcblx0XHRcdFx0dGhpcy5xdWlja0lucHV0U2VydmljZSxcblx0XHRcdFx0dGhpcy5lbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0XHRcdHRoaXMub3BlbmVyU2VydmljZSxcblx0XHRcdFx0dGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UsXG5cdFx0XHRcdHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2Vcblx0XHRcdCk7XG5cdFx0XHRyZXZpZXdJc3N1ZXNIZWxwSXRlbS52YWx1ZXMgPSBoZWxwSXRlbVZhbHVlcztcblx0XHRcdGhlbHBJdGVtcy5wdXNoKHJldmlld0lzc3Vlc0hlbHBJdGVtKTtcblx0XHR9XG5cblx0XHRpZiAoaGVscEl0ZW1zLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgaGVscEl0ZW1WYWx1ZXMgPSB0aGlzLnZpZXdNb2RlbC5oZWxwSW5mb3JtYXRpb24ubWFwKGluZm8gPT4gdGhpcy5jcmVhdGVIZWxwSXRlbVZhbHVlKGluZm8sICdyZXBvcnRJc3N1ZScpKTtcblx0XHRcdGNvbnN0IGlzc3VlUmVwb3J0ZXJJdGVtID0gdGhpcy5pdGVtcz8uZmluZChpdGVtID0+IGl0ZW0uaWNvbiA9PT0gaWNvbnMucmVwb3J0SXNzdWVzSWNvbikgPz8gbmV3IElzc3VlUmVwb3J0ZXJJdGVtKFxuXHRcdFx0XHRpY29ucy5yZXBvcnRJc3N1ZXNJY29uLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ3JlbW90ZS5oZWxwLnJlcG9ydCcsIFwiUmVwb3J0IElzc3VlXCIpLFxuXHRcdFx0XHRoZWxwSXRlbVZhbHVlcyxcblx0XHRcdFx0dGhpcy5xdWlja0lucHV0U2VydmljZSxcblx0XHRcdFx0dGhpcy5lbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UsXG5cdFx0XHRcdHRoaXMub3BlbmVyU2VydmljZSxcblx0XHRcdFx0dGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UsXG5cdFx0XHRcdHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2Vcblx0XHRcdCk7XG5cdFx0XHRpc3N1ZVJlcG9ydGVySXRlbS52YWx1ZXMgPSBoZWxwSXRlbVZhbHVlcztcblx0XHRcdGhlbHBJdGVtcy5wdXNoKGlzc3VlUmVwb3J0ZXJJdGVtKTtcblx0XHR9XG5cblx0XHRpZiAoaGVscEl0ZW1zLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5pdGVtcyA9IGhlbHBJdGVtcztcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgSGVscEl0ZW1WYWx1ZSB7XG5cdHByaXZhdGUgX3VybDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9kZXNjcmlwdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSwgcHJpdmF0ZSB3YWxrdGhyb3VnaFNlcnZpY2U6IElXYWxrdGhyb3VnaHNTZXJ2aWNlLCBwdWJsaWMgZXh0ZW5zaW9uRGVzY3JpcHRpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgcHVibGljIHJlYWRvbmx5IHJlbW90ZUF1dGhvcml0eTogc3RyaW5nW10gfCB1bmRlZmluZWQsIHB1YmxpYyByZWFkb25seSB2aXJ0dWFsV29ya3NwYWNlOiBzdHJpbmcgfCB1bmRlZmluZWQsIHByaXZhdGUgdXJsT3JDb21tYW5kT3JJZD86IHN0cmluZyB8IHsgaWQ6IHN0cmluZyB9KSB7XG5cdH1cblxuXHRnZXQgZGVzY3JpcHRpb24oKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5nZXRVcmwoKS50aGVuKCgpID0+IHRoaXMuX2Rlc2NyaXB0aW9uKTtcblx0fVxuXG5cdGdldCB1cmwoKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRyZXR1cm4gdGhpcy5nZXRVcmwoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0VXJsKCk6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0aWYgKHRoaXMuX3VybCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRpZiAodHlwZW9mIHRoaXMudXJsT3JDb21tYW5kT3JJZCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0Y29uc3QgdXJsID0gVVJJLnBhcnNlKHRoaXMudXJsT3JDb21tYW5kT3JJZCk7XG5cdFx0XHRcdGlmICh1cmwuYXV0aG9yaXR5KSB7XG5cdFx0XHRcdFx0dGhpcy5fdXJsID0gdGhpcy51cmxPckNvbW1hbmRPcklkO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IHVybENvbW1hbmQ6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiA9IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQodGhpcy51cmxPckNvbW1hbmRPcklkKS50aGVuKChyZXN1bHQpID0+IHtcblx0XHRcdFx0XHRcdC8vIGlmIGV4ZWN1dGluZyB0aGlzIGNvbW1hbmQgdGltZXMgb3V0LCBjYWNoZSBpdHMgdmFsdWUgd2hlbmV2ZXIgaXQgZXZlbnR1YWxseSByZXNvbHZlc1xuXHRcdFx0XHRcdFx0dGhpcy5fdXJsID0gcmVzdWx0O1xuXHRcdFx0XHRcdFx0cmV0dXJuIHRoaXMuX3VybDtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHQvLyBXZSBtdXN0IGJlIGRlZmVuc2l2ZS4gVGhlIGNvbW1hbmQgbWF5IG5ldmVyIHJldHVybiwgbWVhbmluZyB0aGF0IG5vIGhlbHAgYXQgYWxsIGlzIGV2ZXIgc2hvd24hXG5cdFx0XHRcdFx0Y29uc3QgZW1wdHlTdHJpbmc6IFByb21pc2U8c3RyaW5nPiA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4gc2V0VGltZW91dCgoKSA9PiByZXNvbHZlKCcnKSwgNTAwKSk7XG5cdFx0XHRcdFx0dGhpcy5fdXJsID0gYXdhaXQgUHJvbWlzZS5yYWNlKFt1cmxDb21tYW5kLCBlbXB0eVN0cmluZ10pO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMudXJsT3JDb21tYW5kT3JJZD8uaWQpIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCB3YWxrdGhyb3VnaElkID0gYCR7dGhpcy5leHRlbnNpb25EZXNjcmlwdGlvbi5pZH0jJHt0aGlzLnVybE9yQ29tbWFuZE9ySWQuaWR9YDtcblx0XHRcdFx0XHRjb25zdCB3YWxrdGhyb3VnaCA9IGF3YWl0IHRoaXMud2Fsa3Rocm91Z2hTZXJ2aWNlLmdldFdhbGt0aHJvdWdoKHdhbGt0aHJvdWdoSWQpO1xuXHRcdFx0XHRcdHRoaXMuX2Rlc2NyaXB0aW9uID0gd2Fsa3Rocm91Z2gudGl0bGU7XG5cdFx0XHRcdFx0dGhpcy5fdXJsID0gd2Fsa3Rocm91Z2hJZDtcblx0XHRcdFx0fSBjYXRjaCB7IH1cblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKHRoaXMuX3VybCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLl91cmwgPSAnJztcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3VybDtcblx0fVxufVxuXG5hYnN0cmFjdCBjbGFzcyBIZWxwSXRlbUJhc2UgaW1wbGVtZW50cyBJSGVscEl0ZW0ge1xuXHRwdWJsaWMgaWNvbkNsYXNzZXM6IHN0cmluZ1tdID0gW107XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyBpY29uOiBUaGVtZUljb24sXG5cdFx0cHVibGljIGxhYmVsOiBzdHJpbmcsXG5cdFx0cHVibGljIHZhbHVlczogSGVscEl0ZW1WYWx1ZVtdLFxuXHRcdHByaXZhdGUgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRwcml2YXRlIGVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRwcml2YXRlIHJlbW90ZUV4cGxvcmVyU2VydmljZTogSVJlbW90ZUV4cGxvcmVyU2VydmljZSxcblx0XHRwcml2YXRlIHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2Vcblx0KSB7XG5cdFx0dGhpcy5pY29uQ2xhc3Nlcy5wdXNoKC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KGljb24pKTtcblx0XHR0aGlzLmljb25DbGFzc2VzLnB1c2goJ3JlbW90ZS1oZWxwLXRyZWUtbm9kZS1pdGVtLWljb24nKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBnZXRBY3Rpb25zKCk6IFByb21pc2U8e1xuXHRcdGxhYmVsOiBzdHJpbmc7XG5cdFx0dXJsOiBzdHJpbmc7XG5cdFx0ZGVzY3JpcHRpb246IHN0cmluZztcblx0XHRleHRlbnNpb25EZXNjcmlwdGlvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uO1xuXHR9W10+IHtcblx0XHRyZXR1cm4gKGF3YWl0IFByb21pc2UuYWxsKHRoaXMudmFsdWVzLm1hcChhc3luYyAodmFsdWUpID0+IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGxhYmVsOiB2YWx1ZS5leHRlbnNpb25EZXNjcmlwdGlvbi5kaXNwbGF5TmFtZSB8fCB2YWx1ZS5leHRlbnNpb25EZXNjcmlwdGlvbi5pZGVudGlmaWVyLnZhbHVlLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogYXdhaXQgdmFsdWUuZGVzY3JpcHRpb24gPz8gYXdhaXQgdmFsdWUudXJsLFxuXHRcdFx0XHR1cmw6IGF3YWl0IHZhbHVlLnVybCxcblx0XHRcdFx0ZXh0ZW5zaW9uRGVzY3JpcHRpb246IHZhbHVlLmV4dGVuc2lvbkRlc2NyaXB0aW9uXG5cdFx0XHR9O1xuXHRcdH0pKSkuZmlsdGVyKGl0ZW0gPT4gaXRlbS5kZXNjcmlwdGlvbik7XG5cdH1cblxuXHRhc3luYyBoYW5kbGVDbGljaygpIHtcblx0XHRjb25zdCByZW1vdGVBdXRob3JpdHkgPSB0aGlzLmVudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHk7XG5cdFx0aWYgKHJlbW90ZUF1dGhvcml0eSkge1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS50YXJnZXRUeXBlLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGlmIChyZW1vdGVBdXRob3JpdHkuc3RhcnRzV2l0aCh0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS50YXJnZXRUeXBlW2ldKSkge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgdmFsdWUgb2YgdGhpcy52YWx1ZXMpIHtcblx0XHRcdFx0XHRcdGlmICh2YWx1ZS5yZW1vdGVBdXRob3JpdHkpIHtcblx0XHRcdFx0XHRcdFx0Zm9yIChjb25zdCBhdXRob3JpdHkgb2YgdmFsdWUucmVtb3RlQXV0aG9yaXR5KSB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHJlbW90ZUF1dGhvcml0eS5zdGFydHNXaXRoKGF1dGhvcml0eSkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMudGFrZUFjdGlvbih2YWx1ZS5leHRlbnNpb25EZXNjcmlwdGlvbiwgYXdhaXQgdmFsdWUudXJsKTtcblx0XHRcdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgdmlydHVhbFdvcmtzcGFjZSA9IGdldFZpcnR1YWxXb3Jrc3BhY2VMb2NhdGlvbih0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpKT8uc2NoZW1lO1xuXHRcdFx0aWYgKHZpcnR1YWxXb3Jrc3BhY2UpIHtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS50YXJnZXRUeXBlLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCB2YWx1ZSBvZiB0aGlzLnZhbHVlcykge1xuXHRcdFx0XHRcdFx0aWYgKHZhbHVlLnZpcnR1YWxXb3Jrc3BhY2UgJiYgdmFsdWUucmVtb3RlQXV0aG9yaXR5KSB7XG5cdFx0XHRcdFx0XHRcdGZvciAoY29uc3QgYXV0aG9yaXR5IG9mIHZhbHVlLnJlbW90ZUF1dGhvcml0eSkge1xuXHRcdFx0XHRcdFx0XHRcdGlmICh0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS50YXJnZXRUeXBlW2ldLnN0YXJ0c1dpdGgoYXV0aG9yaXR5KSAmJiB2aXJ0dWFsV29ya3NwYWNlLnN0YXJ0c1dpdGgodmFsdWUudmlydHVhbFdvcmtzcGFjZSkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMudGFrZUFjdGlvbih2YWx1ZS5leHRlbnNpb25EZXNjcmlwdGlvbiwgYXdhaXQgdmFsdWUudXJsKTtcblx0XHRcdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLnZhbHVlcy5sZW5ndGggPiAxKSB7XG5cdFx0XHRjb25zdCBhY3Rpb25zID0gYXdhaXQgdGhpcy5nZXRBY3Rpb25zKCk7XG5cblx0XHRcdGlmIChhY3Rpb25zLmxlbmd0aCkge1xuXHRcdFx0XHRjb25zdCBhY3Rpb24gPSBhd2FpdCB0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLnBpY2soYWN0aW9ucywgeyBwbGFjZUhvbGRlcjogbmxzLmxvY2FsaXplKCdwaWNrUmVtb3RlRXh0ZW5zaW9uJywgXCJTZWxlY3QgdXJsIHRvIG9wZW5cIikgfSk7XG5cdFx0XHRcdGlmIChhY3Rpb24pIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnRha2VBY3Rpb24oYWN0aW9uLmV4dGVuc2lvbkRlc2NyaXB0aW9uLCBhY3Rpb24udXJsKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRhd2FpdCB0aGlzLnRha2VBY3Rpb24odGhpcy52YWx1ZXNbMF0uZXh0ZW5zaW9uRGVzY3JpcHRpb24sIGF3YWl0IHRoaXMudmFsdWVzWzBdLnVybCk7XG5cdFx0fVxuXG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgdGFrZUFjdGlvbihleHRlbnNpb25EZXNjcmlwdGlvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCB1cmw/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+O1xufVxuXG5jbGFzcyBHZXRTdGFydGVkSGVscEl0ZW0gZXh0ZW5kcyBIZWxwSXRlbUJhc2Uge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRpY29uOiBUaGVtZUljb24sXG5cdFx0bGFiZWw6IHN0cmluZyxcblx0XHR2YWx1ZXM6IEhlbHBJdGVtVmFsdWVbXSxcblx0XHRxdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdGVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRwcml2YXRlIG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdHJlbW90ZUV4cGxvcmVyU2VydmljZTogSVJlbW90ZUV4cGxvcmVyU2VydmljZSxcblx0XHR3b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdHByaXZhdGUgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihpY29uLCBsYWJlbCwgdmFsdWVzLCBxdWlja0lucHV0U2VydmljZSwgZW52aXJvbm1lbnRTZXJ2aWNlLCByZW1vdGVFeHBsb3JlclNlcnZpY2UsIHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyB0YWtlQWN0aW9uKGV4dGVuc2lvbkRlc2NyaXB0aW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHVybE9yV2Fsa3Rocm91Z2hJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKFtTY2hlbWFzLmh0dHAsIFNjaGVtYXMuaHR0cHNdLmluY2x1ZGVzKFVSSS5wYXJzZSh1cmxPcldhbGt0aHJvdWdoSWQpLnNjaGVtZSkpIHtcblx0XHRcdHRoaXMub3BlbmVyU2VydmljZS5vcGVuKHVybE9yV2Fsa3Rocm91Z2hJZCwgeyBhbGxvd0NvbW1hbmRzOiB0cnVlIH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ3dvcmtiZW5jaC5hY3Rpb24ub3BlbldhbGt0aHJvdWdoJywgdXJsT3JXYWxrdGhyb3VnaElkKTtcblx0fVxufVxuXG5jbGFzcyBIZWxwSXRlbSBleHRlbmRzIEhlbHBJdGVtQmFzZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdGljb246IFRoZW1lSWNvbixcblx0XHRsYWJlbDogc3RyaW5nLFxuXHRcdHZhbHVlczogSGVscEl0ZW1WYWx1ZVtdLFxuXHRcdHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0ZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdHByaXZhdGUgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0cmVtb3RlRXhwbG9yZXJTZXJ2aWNlOiBJUmVtb3RlRXhwbG9yZXJTZXJ2aWNlLFxuXHRcdHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoaWNvbiwgbGFiZWwsIHZhbHVlcywgcXVpY2tJbnB1dFNlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSwgcmVtb3RlRXhwbG9yZXJTZXJ2aWNlLCB3b3Jrc3BhY2VDb250ZXh0U2VydmljZSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgdGFrZUFjdGlvbihleHRlbnNpb25EZXNjcmlwdGlvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCB1cmw6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMub3BlbmVyU2VydmljZS5vcGVuKFVSSS5wYXJzZSh1cmwpLCB7IGFsbG93Q29tbWFuZHM6IHRydWUgfSk7XG5cdH1cbn1cblxuY2xhc3MgSXNzdWVSZXBvcnRlckl0ZW0gZXh0ZW5kcyBIZWxwSXRlbUJhc2Uge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRpY29uOiBUaGVtZUljb24sXG5cdFx0bGFiZWw6IHN0cmluZyxcblx0XHR2YWx1ZXM6IEhlbHBJdGVtVmFsdWVbXSxcblx0XHRxdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdGVudmlyb25tZW50U2VydmljZTogSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRwcml2YXRlIGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0cHJpdmF0ZSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRyZW1vdGVFeHBsb3JlclNlcnZpY2U6IElSZW1vdGVFeHBsb3JlclNlcnZpY2UsXG5cdFx0d29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihpY29uLCBsYWJlbCwgdmFsdWVzLCBxdWlja0lucHV0U2VydmljZSwgZW52aXJvbm1lbnRTZXJ2aWNlLCByZW1vdGVFeHBsb3JlclNlcnZpY2UsIHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBhc3luYyBnZXRBY3Rpb25zKCk6IFByb21pc2U8e1xuXHRcdGxhYmVsOiBzdHJpbmc7XG5cdFx0ZGVzY3JpcHRpb246IHN0cmluZztcblx0XHR1cmw6IHN0cmluZztcblx0XHRleHRlbnNpb25EZXNjcmlwdGlvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uO1xuXHR9W10+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5hbGwodGhpcy52YWx1ZXMubWFwKGFzeW5jICh2YWx1ZSkgPT4ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bGFiZWw6IHZhbHVlLmV4dGVuc2lvbkRlc2NyaXB0aW9uLmRpc3BsYXlOYW1lIHx8IHZhbHVlLmV4dGVuc2lvbkRlc2NyaXB0aW9uLmlkZW50aWZpZXIudmFsdWUsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiAnJyxcblx0XHRcdFx0dXJsOiBhd2FpdCB2YWx1ZS51cmwsXG5cdFx0XHRcdGV4dGVuc2lvbkRlc2NyaXB0aW9uOiB2YWx1ZS5leHRlbnNpb25EZXNjcmlwdGlvblxuXHRcdFx0fTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgdGFrZUFjdGlvbihleHRlbnNpb25EZXNjcmlwdGlvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCB1cmw6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdXJsKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCd3b3JrYmVuY2guYWN0aW9uLm9wZW5Jc3N1ZVJlcG9ydGVyJywgW2V4dGVuc2lvbkRlc2NyaXB0aW9uLmlkZW50aWZpZXIudmFsdWVdKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXdhaXQgdGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4oVVJJLnBhcnNlKHVybCkpO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBIZWxwUGFuZWwgZXh0ZW5kcyBWaWV3UGFuZSB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd+cmVtb3RlLmhlbHBQYW5lbCc7XG5cdHN0YXRpYyByZWFkb25seSBUSVRMRSA9IG5scy5sb2NhbGl6ZTIoJ3JlbW90ZS5oZWxwJywgXCJIZWxwIGFuZCBmZWVkYmFja1wiKTtcblx0cHJpdmF0ZSB0cmVlITogV29ya2JlbmNoQXN5bmNEYXRhVHJlZTxIZWxwTW9kZWwsIElIZWxwSXRlbSwgSUhlbHBJdGVtPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm90ZWN0ZWQgdmlld01vZGVsOiBJVmlld01vZGVsLFxuXHRcdG9wdGlvbnM6IElWaWV3UGFuZU9wdGlvbnMsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVZpZXdEZXNjcmlwdG9yU2VydmljZSB2aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcHJvdGVjdGVkIHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcm90ZWN0ZWQgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASVJlbW90ZUV4cGxvcmVyU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgcmVtb3RlRXhwbG9yZXJTZXJ2aWNlOiBJUmVtb3RlRXhwbG9yZXJTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASVdhbGt0aHJvdWdoc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3YWxrdGhyb3VnaHNTZXJ2aWNlOiBJV2Fsa3Rocm91Z2hzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIob3B0aW9ucywga2V5YmluZGluZ1NlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCB2aWV3RGVzY3JpcHRvclNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIGhvdmVyU2VydmljZSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVuZGVyQm9keShjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyQm9keShjb250YWluZXIpO1xuXG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3JlbW90ZS1oZWxwJyk7XG5cdFx0Y29uc3QgdHJlZUNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXHRcdHRyZWVDb250YWluZXIuY2xhc3NMaXN0LmFkZCgncmVtb3RlLWhlbHAtY29udGVudCcpO1xuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZCh0cmVlQ29udGFpbmVyKTtcblxuXHRcdHRoaXMudHJlZSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya2JlbmNoQXN5bmNEYXRhVHJlZTxIZWxwTW9kZWwsIElIZWxwSXRlbSwgSUhlbHBJdGVtPixcblx0XHRcdCdSZW1vdGVIZWxwJyxcblx0XHRcdHRyZWVDb250YWluZXIsXG5cdFx0XHRuZXcgSGVscFRyZWVWaXJ0dWFsRGVsZWdhdGUoKSxcblx0XHRcdFtuZXcgSGVscFRyZWVSZW5kZXJlcigpXSxcblx0XHRcdG5ldyBIZWxwRGF0YVNvdXJjZSgpLFxuXHRcdFx0e1xuXHRcdFx0XHRhY2Nlc3NpYmlsaXR5UHJvdmlkZXI6IHtcblx0XHRcdFx0XHRnZXRBcmlhTGFiZWw6IChpdGVtOiBIZWxwSXRlbUJhc2UpID0+IHtcblx0XHRcdFx0XHRcdHJldHVybiBpdGVtLmxhYmVsO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z2V0V2lkZ2V0QXJpYUxhYmVsOiAoKSA9PiBubHMubG9jYWxpemUoJ3JlbW90ZWhlbHAnLCBcIlJlbW90ZSBIZWxwXCIpXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBuZXcgSGVscE1vZGVsKHRoaXMudmlld01vZGVsLCB0aGlzLm9wZW5lclNlcnZpY2UsIHRoaXMucXVpY2tJbnB1dFNlcnZpY2UsIHRoaXMuY29tbWFuZFNlcnZpY2UsIHRoaXMucmVtb3RlRXhwbG9yZXJTZXJ2aWNlLCB0aGlzLmVudmlyb25tZW50U2VydmljZSwgdGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZSwgdGhpcy53YWxrdGhyb3VnaHNTZXJ2aWNlKTtcblxuXHRcdHRoaXMudHJlZS5zZXRJbnB1dChtb2RlbCk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5kZWJvdW5jZSh0aGlzLnRyZWUub25EaWRPcGVuLCAobGFzdCwgZXZlbnQpID0+IGV2ZW50LCA3NSwgdHJ1ZSkoZSA9PiB7XG5cdFx0XHRlLmVsZW1lbnQ/LmhhbmRsZUNsaWNrKCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGxheW91dEJvZHkoaGVpZ2h0OiBudW1iZXIsIHdpZHRoOiBudW1iZXIpOiB2b2lkIHtcblx0XHRzdXBlci5sYXlvdXRCb2R5KGhlaWdodCwgd2lkdGgpO1xuXHRcdHRoaXMudHJlZS5sYXlvdXQoaGVpZ2h0LCB3aWR0aCk7XG5cdH1cbn1cblxuY2xhc3MgSGVscFBhbmVsRGVzY3JpcHRvciBpbXBsZW1lbnRzIElWaWV3RGVzY3JpcHRvciB7XG5cdHJlYWRvbmx5IGlkID0gSGVscFBhbmVsLklEO1xuXHRyZWFkb25seSBuYW1lID0gSGVscFBhbmVsLlRJVExFO1xuXHRyZWFkb25seSBjdG9yRGVzY3JpcHRvcjogU3luY0Rlc2NyaXB0b3I8SGVscFBhbmVsPjtcblx0cmVhZG9ubHkgY2FuVG9nZ2xlVmlzaWJpbGl0eSA9IHRydWU7XG5cdHJlYWRvbmx5IGhpZGVCeURlZmF1bHQgPSBmYWxzZTtcblx0cmVhZG9ubHkgZ3JvdXAgPSAnaGVscEA1MCc7XG5cdHJlYWRvbmx5IG9yZGVyID0gLTEwO1xuXG5cdGNvbnN0cnVjdG9yKHZpZXdNb2RlbDogSVZpZXdNb2RlbCkge1xuXHRcdHRoaXMuY3RvckRlc2NyaXB0b3IgPSBuZXcgU3luY0Rlc2NyaXB0b3IoSGVscFBhbmVsLCBbdmlld01vZGVsXSk7XG5cdH1cbn1cblxuY2xhc3MgUmVtb3RlVmlld1BhbmVDb250YWluZXIgZXh0ZW5kcyBGaWx0ZXJWaWV3UGFuZUNvbnRhaW5lciBpbXBsZW1lbnRzIElWaWV3TW9kZWwge1xuXHRwcml2YXRlIGhlbHBQYW5lbERlc2NyaXB0b3IgPSBuZXcgSGVscFBhbmVsRGVzY3JpcHRvcih0aGlzKTtcblx0aGVscEluZm9ybWF0aW9uOiBIZWxwSW5mb3JtYXRpb25bXSA9IFtdO1xuXHRwcml2YXRlIF9vbkRpZENoYW5nZUhlbHBJbmZvcm1hdGlvbiA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHB1YmxpYyBvbkRpZENoYW5nZUhlbHBJbmZvcm1hdGlvbjogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZUhlbHBJbmZvcm1hdGlvbi5ldmVudDtcblx0cHJpdmF0ZSBoYXNSZWdpc3RlcmVkSGVscFZpZXc6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSByZW1vdGVTd2l0Y2hlcjogU3dpdGNoUmVtb3RlVmlld0l0ZW0gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIGxheW91dFNlcnZpY2U6IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElSZW1vdGVFeHBsb3JlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSByZW1vdGVFeHBsb3JlclNlcnZpY2U6IElSZW1vdGVFeHBsb3JlclNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2Ugdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoVklFV0xFVF9JRCwgcmVtb3RlRXhwbG9yZXJTZXJ2aWNlLm9uRGlkQ2hhbmdlVGFyZ2V0VHlwZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGxheW91dFNlcnZpY2UsIHRlbGVtZXRyeVNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGV4dGVuc2lvblNlcnZpY2UsIGNvbnRleHRTZXJ2aWNlLCB2aWV3RGVzY3JpcHRvclNlcnZpY2UsIGxvZ1NlcnZpY2UpO1xuXHRcdHRoaXMuYWRkQ29uc3RhbnRWaWV3RGVzY3JpcHRvcnMoW3RoaXMuaGVscFBhbmVsRGVzY3JpcHRvcl0pO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucmVtb3RlU3dpdGNoZXIgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFN3aXRjaFJlbW90ZVZpZXdJdGVtKSk7XG5cdFx0dGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2Uub25EaWRDaGFuZ2VIZWxwSW5mb3JtYXRpb24oZXh0ZW5zaW9ucyA9PiB7XG5cdFx0XHR0aGlzLl9zZXRIZWxwSW5mb3JtYXRpb24oZXh0ZW5zaW9ucyk7XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9zZXRIZWxwSW5mb3JtYXRpb24odGhpcy5yZW1vdGVFeHBsb3JlclNlcnZpY2UuaGVscEluZm9ybWF0aW9uKTtcblx0XHRjb25zdCB2aWV3c1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVZpZXdzUmVnaXN0cnk+KEV4dGVuc2lvbnMuVmlld3NSZWdpc3RyeSk7XG5cblx0XHR0aGlzLnJlbW90ZVN3aXRjaGVyLmNyZWF0ZU9wdGlvbkl0ZW1zKHZpZXdzUmVnaXN0cnkuZ2V0Vmlld3ModGhpcy52aWV3Q29udGFpbmVyKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodmlld3NSZWdpc3RyeS5vblZpZXdzUmVnaXN0ZXJlZChlID0+IHtcblx0XHRcdGNvbnN0IHJlbW90ZVZpZXdzOiBJVmlld0Rlc2NyaXB0b3JbXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCB2aWV3IG9mIGUpIHtcblx0XHRcdFx0aWYgKHZpZXcudmlld0NvbnRhaW5lci5pZCA9PT0gVklFV0xFVF9JRCkge1xuXHRcdFx0XHRcdHJlbW90ZVZpZXdzLnB1c2goLi4udmlldy52aWV3cyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmIChyZW1vdGVWaWV3cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHRoaXMucmVtb3RlU3dpdGNoZXIhLmNyZWF0ZU9wdGlvbkl0ZW1zKHJlbW90ZVZpZXdzKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodmlld3NSZWdpc3RyeS5vblZpZXdzRGVyZWdpc3RlcmVkKGUgPT4ge1xuXHRcdFx0aWYgKGUudmlld0NvbnRhaW5lci5pZCA9PT0gVklFV0xFVF9JRCkge1xuXHRcdFx0XHR0aGlzLnJlbW90ZVN3aXRjaGVyIS5yZW1vdmVPcHRpb25JdGVtcyhlLnZpZXdzKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF9zZXRIZWxwSW5mb3JtYXRpb24oZXh0ZW5zaW9uczogcmVhZG9ubHkgSUV4dGVuc2lvblBvaW50VXNlcjxIZWxwSW5mb3JtYXRpb24+W10pIHtcblx0XHRjb25zdCBoZWxwSW5mb3JtYXRpb246IEhlbHBJbmZvcm1hdGlvbltdID0gW107XG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgZXh0ZW5zaW9ucykge1xuXHRcdFx0dGhpcy5faGFuZGxlUmVtb3RlSW5mb0V4dGVuc2lvblBvaW50KGV4dGVuc2lvbiwgaGVscEluZm9ybWF0aW9uKTtcblx0XHR9XG5cblx0XHR0aGlzLmhlbHBJbmZvcm1hdGlvbiA9IGhlbHBJbmZvcm1hdGlvbjtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUhlbHBJbmZvcm1hdGlvbi5maXJlKCk7XG5cblx0XHRjb25zdCB2aWV3c1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVZpZXdzUmVnaXN0cnk+KEV4dGVuc2lvbnMuVmlld3NSZWdpc3RyeSk7XG5cdFx0aWYgKHRoaXMuaGVscEluZm9ybWF0aW9uLmxlbmd0aCAmJiAhdGhpcy5oYXNSZWdpc3RlcmVkSGVscFZpZXcpIHtcblx0XHRcdGNvbnN0IHZpZXcgPSB2aWV3c1JlZ2lzdHJ5LmdldFZpZXcodGhpcy5oZWxwUGFuZWxEZXNjcmlwdG9yLmlkKTtcblx0XHRcdGlmICghdmlldykge1xuXHRcdFx0XHR2aWV3c1JlZ2lzdHJ5LnJlZ2lzdGVyVmlld3MoW3RoaXMuaGVscFBhbmVsRGVzY3JpcHRvcl0sIHRoaXMudmlld0NvbnRhaW5lcik7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmhhc1JlZ2lzdGVyZWRIZWxwVmlldyA9IHRydWU7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmhhc1JlZ2lzdGVyZWRIZWxwVmlldykge1xuXHRcdFx0dmlld3NSZWdpc3RyeS5kZXJlZ2lzdGVyVmlld3MoW3RoaXMuaGVscFBhbmVsRGVzY3JpcHRvcl0sIHRoaXMudmlld0NvbnRhaW5lcik7XG5cdFx0XHR0aGlzLmhhc1JlZ2lzdGVyZWRIZWxwVmlldyA9IGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2hhbmRsZVJlbW90ZUluZm9FeHRlbnNpb25Qb2ludChleHRlbnNpb246IElFeHRlbnNpb25Qb2ludFVzZXI8SGVscEluZm9ybWF0aW9uPiwgaGVscEluZm9ybWF0aW9uOiBIZWxwSW5mb3JtYXRpb25bXSkge1xuXHRcdGlmICghaXNQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLCAnY29udHJpYlJlbW90ZUhlbHAnKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghZXh0ZW5zaW9uLnZhbHVlLmRvY3VtZW50YXRpb24gJiYgIWV4dGVuc2lvbi52YWx1ZS5nZXRTdGFydGVkICYmICFleHRlbnNpb24udmFsdWUuaXNzdWVzKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aGVscEluZm9ybWF0aW9uLnB1c2goe1xuXHRcdFx0ZXh0ZW5zaW9uRGVzY3JpcHRpb246IGV4dGVuc2lvbi5kZXNjcmlwdGlvbixcblx0XHRcdGdldFN0YXJ0ZWQ6IGV4dGVuc2lvbi52YWx1ZS5nZXRTdGFydGVkLFxuXHRcdFx0ZG9jdW1lbnRhdGlvbjogZXh0ZW5zaW9uLnZhbHVlLmRvY3VtZW50YXRpb24sXG5cdFx0XHRyZXBvcnRJc3N1ZTogZXh0ZW5zaW9uLnZhbHVlLnJlcG9ydElzc3VlLFxuXHRcdFx0aXNzdWVzOiBleHRlbnNpb24udmFsdWUuaXNzdWVzLFxuXHRcdFx0cmVtb3RlTmFtZTogZXh0ZW5zaW9uLnZhbHVlLnJlbW90ZU5hbWUsXG5cdFx0XHR2aXJ0dWFsV29ya3NwYWNlOiBleHRlbnNpb24udmFsdWUudmlydHVhbFdvcmtzcGFjZVxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldEZpbHRlck9uKHZpZXdEZXNjcmlwdG9yOiBJVmlld0Rlc2NyaXB0b3IpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBpc1N0cmluZ0FycmF5KHZpZXdEZXNjcmlwdG9yLnJlbW90ZUF1dGhvcml0eSkgPyB2aWV3RGVzY3JpcHRvci5yZW1vdGVBdXRob3JpdHlbMF0gOiB2aWV3RGVzY3JpcHRvci5yZW1vdGVBdXRob3JpdHk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgc2V0RmlsdGVyKHZpZXdEZXNjcmlwdG9yOiBJVmlld0Rlc2NyaXB0b3IpOiB2b2lkIHtcblx0XHR0aGlzLnJlbW90ZUV4cGxvcmVyU2VydmljZS50YXJnZXRUeXBlID0gaXNTdHJpbmdBcnJheSh2aWV3RGVzY3JpcHRvci5yZW1vdGVBdXRob3JpdHkpID8gdmlld0Rlc2NyaXB0b3IucmVtb3RlQXV0aG9yaXR5IDogW3ZpZXdEZXNjcmlwdG9yLnJlbW90ZUF1dGhvcml0eSFdO1xuXHR9XG5cblx0Z2V0VGl0bGUoKTogc3RyaW5nIHtcblx0XHRjb25zdCB0aXRsZSA9IG5scy5sb2NhbGl6ZSgncmVtb3RlLmV4cGxvcmVyJywgXCJSZW1vdGUgRXhwbG9yZXJcIik7XG5cdFx0cmV0dXJuIHRpdGxlO1xuXHR9XG59XG5cblJlZ2lzdHJ5LmFzPElWaWV3Q29udGFpbmVyc1JlZ2lzdHJ5PihFeHRlbnNpb25zLlZpZXdDb250YWluZXJzUmVnaXN0cnkpLnJlZ2lzdGVyVmlld0NvbnRhaW5lcihcblx0e1xuXHRcdGlkOiBWSUVXTEVUX0lELFxuXHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdyZW1vdGUuZXhwbG9yZXInLCBcIlJlbW90ZSBFeHBsb3JlclwiKSxcblx0XHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKFJlbW90ZVZpZXdQYW5lQ29udGFpbmVyKSxcblx0XHRoaWRlSWZFbXB0eTogdHJ1ZSxcblx0XHR2aWV3T3JkZXJEZWxlZ2F0ZToge1xuXHRcdFx0Z2V0T3JkZXI6IChncm91cD86IHN0cmluZykgPT4ge1xuXHRcdFx0XHRpZiAoIWdyb3VwKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bGV0IG1hdGNoZXMgPSAvXnRhcmdldHNAKFxcZCspJC8uZXhlYyhncm91cCk7XG5cdFx0XHRcdGlmIChtYXRjaGVzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIC0xMDAwO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bWF0Y2hlcyA9IC9eZGV0YWlscyhAKFxcZCspKT8kLy5leGVjKGdyb3VwKTtcblxuXHRcdFx0XHRpZiAobWF0Y2hlcykge1xuXHRcdFx0XHRcdHJldHVybiAtNTAwICsgTnVtYmVyKG1hdGNoZXNbMl0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bWF0Y2hlcyA9IC9eaGVscChAKFxcZCspKT8kLy5leGVjKGdyb3VwKTtcblx0XHRcdFx0aWYgKG1hdGNoZXMpIHtcblx0XHRcdFx0XHRyZXR1cm4gLTEwO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0aWNvbjogaWNvbnMucmVtb3RlRXhwbG9yZXJWaWV3SWNvbixcblx0XHRvcmRlcjogNCxcblx0XHRoaWRlQnlEZWZhdWx0OiB0cnVlLFxuXHR9LCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcik7XG5cbmV4cG9ydCBjbGFzcyBSZW1vdGVNYXJrZXJzIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElSZW1vdGVBZ2VudFNlcnZpY2UgcmVtb3RlQWdlbnRTZXJ2aWNlOiBJUmVtb3RlQWdlbnRTZXJ2aWNlLFxuXHRcdEBJVGltZXJTZXJ2aWNlIHRpbWVyU2VydmljZTogSVRpbWVyU2VydmljZSxcblx0KSB7XG5cdFx0cmVtb3RlQWdlbnRTZXJ2aWNlLmdldEVudmlyb25tZW50KCkudGhlbihyZW1vdGVFbnYgPT4ge1xuXHRcdFx0aWYgKHJlbW90ZUVudikge1xuXHRcdFx0XHR0aW1lclNlcnZpY2Uuc2V0UGVyZm9ybWFuY2VNYXJrcygnc2VydmVyJywgcmVtb3RlRW52Lm1hcmtzKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufVxuXG5jbGFzcyBWaXNpYmxlUHJvZ3Jlc3Mge1xuXG5cdHB1YmxpYyByZWFkb25seSBsb2NhdGlvbjogUHJvZ3Jlc3NMb2NhdGlvbjtcblx0cHJpdmF0ZSBfaXNEaXNwb3NlZDogYm9vbGVhbjtcblx0cHJpdmF0ZSBfbGFzdFJlcG9ydDogc3RyaW5nIHwgbnVsbDtcblx0cHJpdmF0ZSBfY3VycmVudFByb2dyZXNzUHJvbWlzZVJlc29sdmU6ICgoKSA9PiB2b2lkKSB8IG51bGw7XG5cdHByaXZhdGUgX2N1cnJlbnRQcm9ncmVzczogSVByb2dyZXNzPElQcm9ncmVzc1N0ZXA+IHwgbnVsbDtcblx0cHJpdmF0ZSBfY3VycmVudFRpbWVyOiBSZWNvbm5lY3Rpb25UaW1lciB8IG51bGw7XG5cblx0cHVibGljIGdldCBsYXN0UmVwb3J0KCk6IHN0cmluZyB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLl9sYXN0UmVwb3J0O1xuXHR9XG5cblx0Y29uc3RydWN0b3IocHJvZ3Jlc3NTZXJ2aWNlOiBJUHJvZ3Jlc3NTZXJ2aWNlLCBsb2NhdGlvbjogUHJvZ3Jlc3NMb2NhdGlvbiwgaW5pdGlhbFJlcG9ydDogc3RyaW5nIHwgbnVsbCwgYnV0dG9uczogc3RyaW5nW10sIG9uRGlkQ2FuY2VsOiAoY2hvaWNlOiBudW1iZXIgfCB1bmRlZmluZWQsIGxhc3RSZXBvcnQ6IHN0cmluZyB8IG51bGwpID0+IHZvaWQpIHtcblx0XHR0aGlzLmxvY2F0aW9uID0gbG9jYXRpb247XG5cdFx0dGhpcy5faXNEaXNwb3NlZCA9IGZhbHNlO1xuXHRcdHRoaXMuX2xhc3RSZXBvcnQgPSBpbml0aWFsUmVwb3J0O1xuXHRcdHRoaXMuX2N1cnJlbnRQcm9ncmVzc1Byb21pc2VSZXNvbHZlID0gbnVsbDtcblx0XHR0aGlzLl9jdXJyZW50UHJvZ3Jlc3MgPSBudWxsO1xuXHRcdHRoaXMuX2N1cnJlbnRUaW1lciA9IG51bGw7XG5cblx0XHRjb25zdCBwcm9taXNlID0gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHRoaXMuX2N1cnJlbnRQcm9ncmVzc1Byb21pc2VSZXNvbHZlID0gcmVzb2x2ZSk7XG5cblx0XHRwcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzKFxuXHRcdFx0eyBsb2NhdGlvbjogbG9jYXRpb24sIGJ1dHRvbnM6IGJ1dHRvbnMgfSxcblx0XHRcdChwcm9ncmVzcykgPT4geyBpZiAoIXRoaXMuX2lzRGlzcG9zZWQpIHsgdGhpcy5fY3VycmVudFByb2dyZXNzID0gcHJvZ3Jlc3M7IH0gcmV0dXJuIHByb21pc2U7IH0sXG5cdFx0XHQoY2hvaWNlKSA9PiBvbkRpZENhbmNlbChjaG9pY2UsIHRoaXMuX2xhc3RSZXBvcnQpXG5cdFx0KTtcblxuXHRcdGlmICh0aGlzLl9sYXN0UmVwb3J0KSB7XG5cdFx0XHR0aGlzLnJlcG9ydCgpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2lzRGlzcG9zZWQgPSB0cnVlO1xuXHRcdGlmICh0aGlzLl9jdXJyZW50UHJvZ3Jlc3NQcm9taXNlUmVzb2x2ZSkge1xuXHRcdFx0dGhpcy5fY3VycmVudFByb2dyZXNzUHJvbWlzZVJlc29sdmUoKTtcblx0XHRcdHRoaXMuX2N1cnJlbnRQcm9ncmVzc1Byb21pc2VSZXNvbHZlID0gbnVsbDtcblx0XHR9XG5cdFx0dGhpcy5fY3VycmVudFByb2dyZXNzID0gbnVsbDtcblx0XHRpZiAodGhpcy5fY3VycmVudFRpbWVyKSB7XG5cdFx0XHR0aGlzLl9jdXJyZW50VGltZXIuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fY3VycmVudFRpbWVyID0gbnVsbDtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgcmVwb3J0KG1lc3NhZ2U/OiBzdHJpbmcpIHtcblx0XHRpZiAobWVzc2FnZSkge1xuXHRcdFx0dGhpcy5fbGFzdFJlcG9ydCA9IG1lc3NhZ2U7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2xhc3RSZXBvcnQgJiYgdGhpcy5fY3VycmVudFByb2dyZXNzKSB7XG5cdFx0XHR0aGlzLl9jdXJyZW50UHJvZ3Jlc3MucmVwb3J0KHsgbWVzc2FnZTogdGhpcy5fbGFzdFJlcG9ydCB9KTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgc3RhcnRUaW1lcihjb21wbGV0aW9uVGltZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5zdG9wVGltZXIoKTtcblx0XHR0aGlzLl9jdXJyZW50VGltZXIgPSBuZXcgUmVjb25uZWN0aW9uVGltZXIodGhpcywgY29tcGxldGlvblRpbWUpO1xuXHR9XG5cblx0cHVibGljIHN0b3BUaW1lcigpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fY3VycmVudFRpbWVyKSB7XG5cdFx0XHR0aGlzLl9jdXJyZW50VGltZXIuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fY3VycmVudFRpbWVyID0gbnVsbDtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgUmVjb25uZWN0aW9uVGltZXIgaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3BhcmVudDogVmlzaWJsZVByb2dyZXNzO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jb21wbGV0aW9uVGltZTogbnVtYmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9yZW5kZXJJbnRlcnZhbDogSURpc3Bvc2FibGU7XG5cblx0Y29uc3RydWN0b3IocGFyZW50OiBWaXNpYmxlUHJvZ3Jlc3MsIGNvbXBsZXRpb25UaW1lOiBudW1iZXIpIHtcblx0XHR0aGlzLl9wYXJlbnQgPSBwYXJlbnQ7XG5cdFx0dGhpcy5fY29tcGxldGlvblRpbWUgPSBjb21wbGV0aW9uVGltZTtcblx0XHR0aGlzLl9yZW5kZXJJbnRlcnZhbCA9IGRvbS5kaXNwb3NhYmxlV2luZG93SW50ZXJ2YWwobWFpbldpbmRvdywgKCkgPT4gdGhpcy5fcmVuZGVyKCksIDEwMDApO1xuXHRcdHRoaXMuX3JlbmRlcigpO1xuXHR9XG5cblx0cHVibGljIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVuZGVySW50ZXJ2YWwuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVuZGVyKCkge1xuXHRcdGNvbnN0IHJlbWFpbmluZ1RpbWVNcyA9IHRoaXMuX2NvbXBsZXRpb25UaW1lIC0gRGF0ZS5ub3coKTtcblx0XHRpZiAocmVtYWluaW5nVGltZU1zIDwgMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCByZW1haW5pbmdUaW1lID0gTWF0aC5jZWlsKHJlbWFpbmluZ1RpbWVNcyAvIDEwMDApO1xuXHRcdGlmIChyZW1haW5pbmdUaW1lID09PSAxKSB7XG5cdFx0XHR0aGlzLl9wYXJlbnQucmVwb3J0KG5scy5sb2NhbGl6ZSgncmVjb25uZWN0aW9uV2FpdE9uZScsIFwiQXR0ZW1wdGluZyB0byByZWNvbm5lY3QgaW4gezB9IHNlY29uZC4uLlwiLCByZW1haW5pbmdUaW1lKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX3BhcmVudC5yZXBvcnQobmxzLmxvY2FsaXplKCdyZWNvbm5lY3Rpb25XYWl0TWFueScsIFwiQXR0ZW1wdGluZyB0byByZWNvbm5lY3QgaW4gezB9IHNlY29uZHMuLi5cIiwgcmVtYWluaW5nVGltZSkpO1xuXHRcdH1cblx0fVxufVxuXG4vKipcbiAqIFRoZSB0aW1lIHdoZW4gYSBwcm9tcHQgaXMgc2hvd24gdG8gdGhlIHVzZXJcbiAqL1xuY29uc3QgRElTQ09OTkVDVF9QUk9NUFRfVElNRSA9IDQwICogMTAwMDsgLy8gNDAgc2Vjb25kc1xuXG5leHBvcnQgY2xhc3MgUmVtb3RlQWdlbnRDb25uZWN0aW9uU3RhdHVzTGlzdGVuZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0cHJpdmF0ZSBfcmVsb2FkV2luZG93U2hvd246IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVJlbW90ZUFnZW50U2VydmljZSByZW1vdGVBZ2VudFNlcnZpY2U6IElSZW1vdGVBZ2VudFNlcnZpY2UsXG5cdFx0QElQcm9ncmVzc1NlcnZpY2UgcHJvZ3Jlc3NTZXJ2aWNlOiBJUHJvZ3Jlc3NTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBxdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IHJlbW90ZUFnZW50U2VydmljZS5nZXRDb25uZWN0aW9uKCk7XG5cdFx0aWYgKGNvbm5lY3Rpb24pIHtcblx0XHRcdGxldCBxdWlja0lucHV0VmlzaWJsZSA9IGZhbHNlO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIocXVpY2tJbnB1dFNlcnZpY2Uub25TaG93KCgpID0+IHF1aWNrSW5wdXRWaXNpYmxlID0gdHJ1ZSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIocXVpY2tJbnB1dFNlcnZpY2Uub25IaWRlKCgpID0+IHF1aWNrSW5wdXRWaXNpYmxlID0gZmFsc2UpKTtcblxuXHRcdFx0bGV0IHZpc2libGVQcm9ncmVzczogVmlzaWJsZVByb2dyZXNzIHwgbnVsbCA9IG51bGw7XG5cdFx0XHRsZXQgcmVjb25uZWN0V2FpdEV2ZW50OiBSZWNvbm5lY3Rpb25XYWl0RXZlbnQgfCBudWxsID0gbnVsbDtcblx0XHRcdGxldCBkaXNwb3NhYmxlTGlzdGVuZXI6IElEaXNwb3NhYmxlIHwgbnVsbCA9IG51bGw7XG5cblx0XHRcdGZ1bmN0aW9uIHNob3dQcm9ncmVzcyhsb2NhdGlvbjogUHJvZ3Jlc3NMb2NhdGlvbi5EaWFsb2cgfCBQcm9ncmVzc0xvY2F0aW9uLk5vdGlmaWNhdGlvbiB8IG51bGwsIGJ1dHRvbnM6IHsgbGFiZWw6IHN0cmluZzsgY2FsbGJhY2s6ICgpID0+IHZvaWQgfVtdLCBpbml0aWFsUmVwb3J0OiBzdHJpbmcgfCBudWxsID0gbnVsbCk6IFZpc2libGVQcm9ncmVzcyB7XG5cdFx0XHRcdGlmICh2aXNpYmxlUHJvZ3Jlc3MpIHtcblx0XHRcdFx0XHR2aXNpYmxlUHJvZ3Jlc3MuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHZpc2libGVQcm9ncmVzcyA9IG51bGw7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIWxvY2F0aW9uKSB7XG5cdFx0XHRcdFx0bG9jYXRpb24gPSBxdWlja0lucHV0VmlzaWJsZSA/IFByb2dyZXNzTG9jYXRpb24uTm90aWZpY2F0aW9uIDogUHJvZ3Jlc3NMb2NhdGlvbi5EaWFsb2c7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gbmV3IFZpc2libGVQcm9ncmVzcyhcblx0XHRcdFx0XHRwcm9ncmVzc1NlcnZpY2UsIGxvY2F0aW9uLCBpbml0aWFsUmVwb3J0LCBidXR0b25zLm1hcChidXR0b24gPT4gYnV0dG9uLmxhYmVsKSxcblx0XHRcdFx0XHQoY2hvaWNlLCBsYXN0UmVwb3J0KSA9PiB7XG5cdFx0XHRcdFx0XHQvLyBIYW5kbGUgY2hvaWNlIGZyb20gZGlhbG9nXG5cdFx0XHRcdFx0XHRpZiAodHlwZW9mIGNob2ljZSAhPT0gJ3VuZGVmaW5lZCcgJiYgYnV0dG9uc1tjaG9pY2VdKSB7XG5cdFx0XHRcdFx0XHRcdGJ1dHRvbnNbY2hvaWNlXS5jYWxsYmFjaygpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0aWYgKGxvY2F0aW9uID09PSBQcm9ncmVzc0xvY2F0aW9uLkRpYWxvZykge1xuXHRcdFx0XHRcdFx0XHRcdHZpc2libGVQcm9ncmVzcyA9IHNob3dQcm9ncmVzcyhQcm9ncmVzc0xvY2F0aW9uLk5vdGlmaWNhdGlvbiwgYnV0dG9ucywgbGFzdFJlcG9ydCk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0aGlkZVByb2dyZXNzKCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cblx0XHRcdGZ1bmN0aW9uIGhpZGVQcm9ncmVzcygpIHtcblx0XHRcdFx0aWYgKHZpc2libGVQcm9ncmVzcykge1xuXHRcdFx0XHRcdHZpc2libGVQcm9ncmVzcy5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0dmlzaWJsZVByb2dyZXNzID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRsZXQgcmVjb25uZWN0aW9uVG9rZW46IHN0cmluZyA9ICcnO1xuXHRcdFx0bGV0IGxhc3RJbmNvbWluZ0RhdGFUaW1lOiBudW1iZXIgPSAwO1xuXHRcdFx0bGV0IHJlY29ubmVjdGlvbkF0dGVtcHRzOiBudW1iZXIgPSAwO1xuXG5cdFx0XHRjb25zdCByZWNvbm5lY3RCdXR0b24gPSB7XG5cdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ3JlY29ubmVjdE5vdycsIFwiUmVjb25uZWN0IE5vd1wiKSxcblx0XHRcdFx0Y2FsbGJhY2s6ICgpID0+IHtcblx0XHRcdFx0XHRyZWNvbm5lY3RXYWl0RXZlbnQ/LnNraXBXYWl0KCk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHJlbG9hZEJ1dHRvbiA9IHtcblx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgncmVsb2FkV2luZG93JywgXCJSZWxvYWQgV2luZG93XCIpLFxuXHRcdFx0XHRjYWxsYmFjazogKCkgPT4ge1xuXG5cdFx0XHRcdFx0dHlwZSBSZWNvbm5lY3RSZWxvYWRDbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdFx0XHRcdG93bmVyOiAnYWxleGRpbWEnO1xuXHRcdFx0XHRcdFx0Y29tbWVudDogJ1RoZSByZWxvYWQgYnV0dG9uIGluIHRoZSBidWlsdGluIHBlcm1hbmVudCByZWNvbm5lY3Rpb24gZmFpbHVyZSBkaWFsb2cgd2FzIHByZXNzZWQnO1xuXHRcdFx0XHRcdFx0cmVtb3RlTmFtZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSBuYW1lIG9mIHRoZSByZXNvbHZlci4nIH07XG5cdFx0XHRcdFx0XHRyZWNvbm5lY3Rpb25Ub2tlbjogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSBpZGVudGlmaWVyIG9mIHRoZSBjb25uZWN0aW9uLicgfTtcblx0XHRcdFx0XHRcdG1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ0VsYXBzZWQgdGltZSAoaW4gbXMpIHNpbmNlIGRhdGEgd2FzIGxhc3QgcmVjZWl2ZWQuJyB9O1xuXHRcdFx0XHRcdFx0YXR0ZW1wdDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSByZWNvbm5lY3Rpb24gYXR0ZW1wdCBjb3VudGVyLicgfTtcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdHR5cGUgUmVjb25uZWN0UmVsb2FkRXZlbnQgPSB7XG5cdFx0XHRcdFx0XHRyZW1vdGVOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRyZWNvbm5lY3Rpb25Ub2tlbjogc3RyaW5nO1xuXHRcdFx0XHRcdFx0bWlsbGlzU2luY2VMYXN0SW5jb21pbmdEYXRhOiBudW1iZXI7XG5cdFx0XHRcdFx0XHRhdHRlbXB0OiBudW1iZXI7XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR0ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8UmVjb25uZWN0UmVsb2FkRXZlbnQsIFJlY29ubmVjdFJlbG9hZENsYXNzaWZpY2F0aW9uPigncmVtb3RlUmVjb25uZWN0aW9uUmVsb2FkJywge1xuXHRcdFx0XHRcdFx0cmVtb3RlTmFtZTogZ2V0UmVtb3RlTmFtZShlbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5KSxcblx0XHRcdFx0XHRcdHJlY29ubmVjdGlvblRva2VuOiByZWNvbm5lY3Rpb25Ub2tlbixcblx0XHRcdFx0XHRcdG1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YTogRGF0ZS5ub3coKSAtIGxhc3RJbmNvbWluZ0RhdGFUaW1lLFxuXHRcdFx0XHRcdFx0YXR0ZW1wdDogcmVjb25uZWN0aW9uQXR0ZW1wdHNcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKFJlbG9hZFdpbmRvd0FjdGlvbi5JRCk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdC8vIFBvc3NpYmxlIHN0YXRlIHRyYW5zaXRpb25zOlxuXHRcdFx0Ly8gQ29ubmVjdGlvbkdhaW4gICAgICAtPiBDb25uZWN0aW9uTG9zdFxuXHRcdFx0Ly8gQ29ubmVjdGlvbkxvc3QgICAgICAtPiBSZWNvbm5lY3Rpb25XYWl0LCBSZWNvbm5lY3Rpb25SdW5uaW5nXG5cdFx0XHQvLyBSZWNvbm5lY3Rpb25XYWl0ICAgIC0+IFJlY29ubmVjdGlvblJ1bm5pbmdcblx0XHRcdC8vIFJlY29ubmVjdGlvblJ1bm5pbmcgLT4gQ29ubmVjdGlvbkdhaW4sIFJlY29ubmVjdGlvblBlcm1hbmVudEZhaWx1cmVcblxuXHRcdFx0Y29ubmVjdGlvbi5vbkRpZFN0YXRlQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHRcdHZpc2libGVQcm9ncmVzcz8uc3RvcFRpbWVyKCk7XG5cblx0XHRcdFx0aWYgKGRpc3Bvc2FibGVMaXN0ZW5lcikge1xuXHRcdFx0XHRcdGRpc3Bvc2FibGVMaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZUxpc3RlbmVyID0gbnVsbDtcblx0XHRcdFx0fVxuXHRcdFx0XHRzd2l0Y2ggKGUudHlwZSkge1xuXHRcdFx0XHRcdGNhc2UgUGVyc2lzdGVudENvbm5lY3Rpb25FdmVudFR5cGUuQ29ubmVjdGlvbkxvc3Q6XG5cdFx0XHRcdFx0XHRyZWNvbm5lY3Rpb25Ub2tlbiA9IGUucmVjb25uZWN0aW9uVG9rZW47XG5cdFx0XHRcdFx0XHRsYXN0SW5jb21pbmdEYXRhVGltZSA9IERhdGUubm93KCkgLSBlLm1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YTtcblx0XHRcdFx0XHRcdHJlY29ubmVjdGlvbkF0dGVtcHRzID0gMDtcblxuXHRcdFx0XHRcdFx0dHlwZSBSZW1vdGVDb25uZWN0aW9uTG9zdENsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0XHRcdFx0XHRvd25lcjogJ2FsZXhkaW1hJztcblx0XHRcdFx0XHRcdFx0Y29tbWVudDogJ1RoZSByZW1vdGUgY29ubmVjdGlvbiBzdGF0ZSBpcyBub3cgYENvbm5lY3Rpb25Mb3N0YCc7XG5cdFx0XHRcdFx0XHRcdHJlbW90ZU5hbWU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgbmFtZSBvZiB0aGUgcmVzb2x2ZXIuJyB9O1xuXHRcdFx0XHRcdFx0XHRyZWNvbm5lY3Rpb25Ub2tlbjogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSBpZGVudGlmaWVyIG9mIHRoZSBjb25uZWN0aW9uLicgfTtcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHR0eXBlIFJlbW90ZUNvbm5lY3Rpb25Mb3N0RXZlbnQgPSB7XG5cdFx0XHRcdFx0XHRcdHJlbW90ZU5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdFx0cmVjb25uZWN0aW9uVG9rZW46IHN0cmluZztcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHR0ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8UmVtb3RlQ29ubmVjdGlvbkxvc3RFdmVudCwgUmVtb3RlQ29ubmVjdGlvbkxvc3RDbGFzc2lmaWNhdGlvbj4oJ3JlbW90ZUNvbm5lY3Rpb25Mb3N0Jywge1xuXHRcdFx0XHRcdFx0XHRyZW1vdGVOYW1lOiBnZXRSZW1vdGVOYW1lKGVudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHkpLFxuXHRcdFx0XHRcdFx0XHRyZWNvbm5lY3Rpb25Ub2tlbjogZS5yZWNvbm5lY3Rpb25Ub2tlbixcblx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0XHRpZiAodmlzaWJsZVByb2dyZXNzIHx8IGUubWlsbGlzU2luY2VMYXN0SW5jb21pbmdEYXRhID4gRElTQ09OTkVDVF9QUk9NUFRfVElNRSkge1xuXHRcdFx0XHRcdFx0XHRpZiAoIXZpc2libGVQcm9ncmVzcykge1xuXHRcdFx0XHRcdFx0XHRcdHZpc2libGVQcm9ncmVzcyA9IHNob3dQcm9ncmVzcyhudWxsLCBbcmVjb25uZWN0QnV0dG9uLCByZWxvYWRCdXR0b25dKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR2aXNpYmxlUHJvZ3Jlc3MucmVwb3J0KG5scy5sb2NhbGl6ZSgnY29ubmVjdGlvbkxvc3QnLCBcIkNvbm5lY3Rpb24gTG9zdFwiKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRcdGNhc2UgUGVyc2lzdGVudENvbm5lY3Rpb25FdmVudFR5cGUuUmVjb25uZWN0aW9uV2FpdDpcblx0XHRcdFx0XHRcdGlmICh2aXNpYmxlUHJvZ3Jlc3MpIHtcblx0XHRcdFx0XHRcdFx0cmVjb25uZWN0V2FpdEV2ZW50ID0gZTtcblx0XHRcdFx0XHRcdFx0dmlzaWJsZVByb2dyZXNzID0gc2hvd1Byb2dyZXNzKG51bGwsIFtyZWNvbm5lY3RCdXR0b24sIHJlbG9hZEJ1dHRvbl0pO1xuXHRcdFx0XHRcdFx0XHR2aXNpYmxlUHJvZ3Jlc3Muc3RhcnRUaW1lcihEYXRlLm5vdygpICsgMTAwMCAqIGUuZHVyYXRpb25TZWNvbmRzKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdFx0Y2FzZSBQZXJzaXN0ZW50Q29ubmVjdGlvbkV2ZW50VHlwZS5SZWNvbm5lY3Rpb25SdW5uaW5nOlxuXHRcdFx0XHRcdFx0cmVjb25uZWN0aW9uVG9rZW4gPSBlLnJlY29ubmVjdGlvblRva2VuO1xuXHRcdFx0XHRcdFx0bGFzdEluY29taW5nRGF0YVRpbWUgPSBEYXRlLm5vdygpIC0gZS5taWxsaXNTaW5jZUxhc3RJbmNvbWluZ0RhdGE7XG5cdFx0XHRcdFx0XHRyZWNvbm5lY3Rpb25BdHRlbXB0cyA9IGUuYXR0ZW1wdDtcblxuXHRcdFx0XHRcdFx0dHlwZSBSZW1vdGVSZWNvbm5lY3Rpb25SdW5uaW5nQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRcdFx0XHRcdG93bmVyOiAnYWxleGRpbWEnO1xuXHRcdFx0XHRcdFx0XHRjb21tZW50OiAnVGhlIHJlbW90ZSBjb25uZWN0aW9uIHN0YXRlIGlzIG5vdyBgUmVjb25uZWN0aW9uUnVubmluZ2AnO1xuXHRcdFx0XHRcdFx0XHRyZW1vdGVOYW1lOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIG5hbWUgb2YgdGhlIHJlc29sdmVyLicgfTtcblx0XHRcdFx0XHRcdFx0cmVjb25uZWN0aW9uVG9rZW46IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgaWRlbnRpZmllciBvZiB0aGUgY29ubmVjdGlvbi4nIH07XG5cdFx0XHRcdFx0XHRcdG1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ0VsYXBzZWQgdGltZSAoaW4gbXMpIHNpbmNlIGRhdGEgd2FzIGxhc3QgcmVjZWl2ZWQuJyB9O1xuXHRcdFx0XHRcdFx0XHRhdHRlbXB0OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIHJlY29ubmVjdGlvbiBhdHRlbXB0IGNvdW50ZXIuJyB9O1xuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdHR5cGUgUmVtb3RlUmVjb25uZWN0aW9uUnVubmluZ0V2ZW50ID0ge1xuXHRcdFx0XHRcdFx0XHRyZW1vdGVOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRcdHJlY29ubmVjdGlvblRva2VuOiBzdHJpbmc7XG5cdFx0XHRcdFx0XHRcdG1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YTogbnVtYmVyO1xuXHRcdFx0XHRcdFx0XHRhdHRlbXB0OiBudW1iZXI7XG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0dGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFJlbW90ZVJlY29ubmVjdGlvblJ1bm5pbmdFdmVudCwgUmVtb3RlUmVjb25uZWN0aW9uUnVubmluZ0NsYXNzaWZpY2F0aW9uPigncmVtb3RlUmVjb25uZWN0aW9uUnVubmluZycsIHtcblx0XHRcdFx0XHRcdFx0cmVtb3RlTmFtZTogZ2V0UmVtb3RlTmFtZShlbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5KSxcblx0XHRcdFx0XHRcdFx0cmVjb25uZWN0aW9uVG9rZW46IGUucmVjb25uZWN0aW9uVG9rZW4sXG5cdFx0XHRcdFx0XHRcdG1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YTogZS5taWxsaXNTaW5jZUxhc3RJbmNvbWluZ0RhdGEsXG5cdFx0XHRcdFx0XHRcdGF0dGVtcHQ6IGUuYXR0ZW1wdFxuXHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRcdGlmICh2aXNpYmxlUHJvZ3Jlc3MgfHwgZS5taWxsaXNTaW5jZUxhc3RJbmNvbWluZ0RhdGEgPiBESVNDT05ORUNUX1BST01QVF9USU1FKSB7XG5cdFx0XHRcdFx0XHRcdHZpc2libGVQcm9ncmVzcyA9IHNob3dQcm9ncmVzcyhudWxsLCBbcmVsb2FkQnV0dG9uXSk7XG5cdFx0XHRcdFx0XHRcdHZpc2libGVQcm9ncmVzcy5yZXBvcnQobmxzLmxvY2FsaXplKCdyZWNvbm5lY3Rpb25SdW5uaW5nJywgXCJEaXNjb25uZWN0ZWQuIEF0dGVtcHRpbmcgdG8gcmVjb25uZWN0Li4uXCIpKTtcblxuXHRcdFx0XHRcdFx0XHQvLyBSZWdpc3RlciB0byBsaXN0ZW4gZm9yIHF1aWNrIGlucHV0IGlzIG9wZW5lZFxuXHRcdFx0XHRcdFx0XHRkaXNwb3NhYmxlTGlzdGVuZXIgPSBxdWlja0lucHV0U2VydmljZS5vblNob3coKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdC8vIE5lZWQgdG8gbW92ZSBmcm9tIGRpYWxvZyBpZiBiZWluZyBzaG93biBhbmQgdXNlciBuZWVkcyB0byB0eXBlIGluIGEgcHJvbXB0XG5cdFx0XHRcdFx0XHRcdFx0aWYgKHZpc2libGVQcm9ncmVzcyAmJiB2aXNpYmxlUHJvZ3Jlc3MubG9jYXRpb24gPT09IFByb2dyZXNzTG9jYXRpb24uRGlhbG9nKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR2aXNpYmxlUHJvZ3Jlc3MgPSBzaG93UHJvZ3Jlc3MoUHJvZ3Jlc3NMb2NhdGlvbi5Ob3RpZmljYXRpb24sIFtyZWxvYWRCdXR0b25dLCB2aXNpYmxlUHJvZ3Jlc3MubGFzdFJlcG9ydCk7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0XHRjYXNlIFBlcnNpc3RlbnRDb25uZWN0aW9uRXZlbnRUeXBlLlJlY29ubmVjdGlvblBlcm1hbmVudEZhaWx1cmU6XG5cdFx0XHRcdFx0XHRyZWNvbm5lY3Rpb25Ub2tlbiA9IGUucmVjb25uZWN0aW9uVG9rZW47XG5cdFx0XHRcdFx0XHRsYXN0SW5jb21pbmdEYXRhVGltZSA9IERhdGUubm93KCkgLSBlLm1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YTtcblx0XHRcdFx0XHRcdHJlY29ubmVjdGlvbkF0dGVtcHRzID0gZS5hdHRlbXB0O1xuXG5cdFx0XHRcdFx0XHR0eXBlIFJlbW90ZVJlY29ubmVjdGlvblBlcm1hbmVudEZhaWx1cmVDbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdFx0XHRcdFx0b3duZXI6ICdhbGV4ZGltYSc7XG5cdFx0XHRcdFx0XHRcdGNvbW1lbnQ6ICdUaGUgcmVtb3RlIGNvbm5lY3Rpb24gc3RhdGUgaXMgbm93IGBSZWNvbm5lY3Rpb25QZXJtYW5lbnRGYWlsdXJlYCc7XG5cdFx0XHRcdFx0XHRcdHJlbW90ZU5hbWU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgbmFtZSBvZiB0aGUgcmVzb2x2ZXIuJyB9O1xuXHRcdFx0XHRcdFx0XHRyZWNvbm5lY3Rpb25Ub2tlbjogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSBpZGVudGlmaWVyIG9mIHRoZSBjb25uZWN0aW9uLicgfTtcblx0XHRcdFx0XHRcdFx0bWlsbGlzU2luY2VMYXN0SW5jb21pbmdEYXRhOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnRWxhcHNlZCB0aW1lIChpbiBtcykgc2luY2UgZGF0YSB3YXMgbGFzdCByZWNlaXZlZC4nIH07XG5cdFx0XHRcdFx0XHRcdGF0dGVtcHQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgcmVjb25uZWN0aW9uIGF0dGVtcHQgY291bnRlci4nIH07XG5cdFx0XHRcdFx0XHRcdGhhbmRsZWQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgZXJyb3Igd2FzIGhhbmRsZWQgYnkgdGhlIHJlc29sdmVyLicgfTtcblx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHR0eXBlIFJlbW90ZVJlY29ubmVjdGlvblBlcm1hbmVudEZhaWx1cmVFdmVudCA9IHtcblx0XHRcdFx0XHRcdFx0cmVtb3RlTmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0XHRyZWNvbm5lY3Rpb25Ub2tlbjogc3RyaW5nO1xuXHRcdFx0XHRcdFx0XHRtaWxsaXNTaW5jZUxhc3RJbmNvbWluZ0RhdGE6IG51bWJlcjtcblx0XHRcdFx0XHRcdFx0YXR0ZW1wdDogbnVtYmVyO1xuXHRcdFx0XHRcdFx0XHRoYW5kbGVkOiBib29sZWFuO1xuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdHRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxSZW1vdGVSZWNvbm5lY3Rpb25QZXJtYW5lbnRGYWlsdXJlRXZlbnQsIFJlbW90ZVJlY29ubmVjdGlvblBlcm1hbmVudEZhaWx1cmVDbGFzc2lmaWNhdGlvbj4oJ3JlbW90ZVJlY29ubmVjdGlvblBlcm1hbmVudEZhaWx1cmUnLCB7XG5cdFx0XHRcdFx0XHRcdHJlbW90ZU5hbWU6IGdldFJlbW90ZU5hbWUoZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSksXG5cdFx0XHRcdFx0XHRcdHJlY29ubmVjdGlvblRva2VuOiBlLnJlY29ubmVjdGlvblRva2VuLFxuXHRcdFx0XHRcdFx0XHRtaWxsaXNTaW5jZUxhc3RJbmNvbWluZ0RhdGE6IGUubWlsbGlzU2luY2VMYXN0SW5jb21pbmdEYXRhLFxuXHRcdFx0XHRcdFx0XHRhdHRlbXB0OiBlLmF0dGVtcHQsXG5cdFx0XHRcdFx0XHRcdGhhbmRsZWQ6IGUuaGFuZGxlZFxuXHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRcdGhpZGVQcm9ncmVzcygpO1xuXG5cdFx0XHRcdFx0XHRpZiAoZS5oYW5kbGVkKSB7XG5cdFx0XHRcdFx0XHRcdGxvZ1NlcnZpY2UuaW5mbyhgRXJyb3IgaGFuZGxlZDogTm90IHNob3dpbmcgYSBub3RpZmljYXRpb24gZm9yIHRoZSBlcnJvci5gKTtcblx0XHRcdFx0XHRcdFx0Y29uc29sZS5sb2coYEVycm9yIGhhbmRsZWQ6IE5vdCBzaG93aW5nIGEgbm90aWZpY2F0aW9uIGZvciB0aGUgZXJyb3IuYCk7XG5cdFx0XHRcdFx0XHR9IGVsc2UgaWYgKCF0aGlzLl9yZWxvYWRXaW5kb3dTaG93bikge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9yZWxvYWRXaW5kb3dTaG93biA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdGRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogU2V2ZXJpdHkuRXJyb3IsXG5cdFx0XHRcdFx0XHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCdyZWNvbm5lY3Rpb25QZXJtYW5lbnRGYWlsdXJlJywgXCJDYW5ub3QgcmVjb25uZWN0LiBQbGVhc2UgcmVsb2FkIHRoZSB3aW5kb3cuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdHByaW1hcnlCdXR0b246IG5scy5sb2NhbGl6ZSh7IGtleTogJ3JlbG9hZFdpbmRvdy5kaWFsb2cnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZSZWxvYWQgV2luZG93XCIpXG5cdFx0XHRcdFx0XHRcdH0pLnRoZW4ocmVzdWx0ID0+IHtcblx0XHRcdFx0XHRcdFx0XHRpZiAocmVzdWx0LmNvbmZpcm1lZCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoUmVsb2FkV2luZG93QWN0aW9uLklEKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0XHRjYXNlIFBlcnNpc3RlbnRDb25uZWN0aW9uRXZlbnRUeXBlLkNvbm5lY3Rpb25HYWluOlxuXHRcdFx0XHRcdFx0cmVjb25uZWN0aW9uVG9rZW4gPSBlLnJlY29ubmVjdGlvblRva2VuO1xuXHRcdFx0XHRcdFx0bGFzdEluY29taW5nRGF0YVRpbWUgPSBEYXRlLm5vdygpIC0gZS5taWxsaXNTaW5jZUxhc3RJbmNvbWluZ0RhdGE7XG5cdFx0XHRcdFx0XHRyZWNvbm5lY3Rpb25BdHRlbXB0cyA9IGUuYXR0ZW1wdDtcblxuXHRcdFx0XHRcdFx0dHlwZSBSZW1vdGVDb25uZWN0aW9uR2FpbkNsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0XHRcdFx0XHRvd25lcjogJ2FsZXhkaW1hJztcblx0XHRcdFx0XHRcdFx0Y29tbWVudDogJ1RoZSByZW1vdGUgY29ubmVjdGlvbiBzdGF0ZSBpcyBub3cgYENvbm5lY3Rpb25HYWluYCc7XG5cdFx0XHRcdFx0XHRcdHJlbW90ZU5hbWU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgbmFtZSBvZiB0aGUgcmVzb2x2ZXIuJyB9O1xuXHRcdFx0XHRcdFx0XHRyZWNvbm5lY3Rpb25Ub2tlbjogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSBpZGVudGlmaWVyIG9mIHRoZSBjb25uZWN0aW9uLicgfTtcblx0XHRcdFx0XHRcdFx0bWlsbGlzU2luY2VMYXN0SW5jb21pbmdEYXRhOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnRWxhcHNlZCB0aW1lIChpbiBtcykgc2luY2UgZGF0YSB3YXMgbGFzdCByZWNlaXZlZC4nIH07XG5cdFx0XHRcdFx0XHRcdGF0dGVtcHQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgcmVjb25uZWN0aW9uIGF0dGVtcHQgY291bnRlci4nIH07XG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0dHlwZSBSZW1vdGVDb25uZWN0aW9uR2FpbkV2ZW50ID0ge1xuXHRcdFx0XHRcdFx0XHRyZW1vdGVOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0XHRcdHJlY29ubmVjdGlvblRva2VuOiBzdHJpbmc7XG5cdFx0XHRcdFx0XHRcdG1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YTogbnVtYmVyO1xuXHRcdFx0XHRcdFx0XHRhdHRlbXB0OiBudW1iZXI7XG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0dGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFJlbW90ZUNvbm5lY3Rpb25HYWluRXZlbnQsIFJlbW90ZUNvbm5lY3Rpb25HYWluQ2xhc3NpZmljYXRpb24+KCdyZW1vdGVDb25uZWN0aW9uR2FpbicsIHtcblx0XHRcdFx0XHRcdFx0cmVtb3RlTmFtZTogZ2V0UmVtb3RlTmFtZShlbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5KSxcblx0XHRcdFx0XHRcdFx0cmVjb25uZWN0aW9uVG9rZW46IGUucmVjb25uZWN0aW9uVG9rZW4sXG5cdFx0XHRcdFx0XHRcdG1pbGxpc1NpbmNlTGFzdEluY29taW5nRGF0YTogZS5taWxsaXNTaW5jZUxhc3RJbmNvbWluZ0RhdGEsXG5cdFx0XHRcdFx0XHRcdGF0dGVtcHQ6IGUuYXR0ZW1wdFxuXHRcdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRcdGhpZGVQcm9ncmVzcygpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsWUFBWSxTQUFTO0FBQ3JCLFlBQVksU0FBUztBQUNyQixTQUFTLFdBQVc7QUFDcEIsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxtQkFBbUIsNEJBQTRCO0FBQ3hELFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQTBDLFlBQVksdUJBQWdELDhCQUE4QjtBQUNwSSxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFtQyxrQkFBa0Isd0JBQXdCO0FBRTdFLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQWdDLHFDQUFxQztBQUNyRSxPQUFPLGNBQWM7QUFDckIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxrQkFBK0I7QUFDeEMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBMEIsOEJBQThCO0FBQ3hELFNBQVMsb0NBQW9DO0FBQzdDLFNB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
