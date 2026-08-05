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
import { $, addDisposableListener, append, clearNode } from "../../../../base/browser/dom.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { Action, Separator } from "../../../../base/common/actions.js";
import { isNonEmptyArray } from "../../../../base/common/arrays.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { fromNow } from "../../../../base/common/date.js";
import { dispose } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import * as nls from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { getContextMenuActions } from "../../../../platform/actions/browser/menuEntryActionViewItem.js";
import { Action2, IMenuService, MenuId } from "../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { ExtensionIdentifierMap } from "../../../../platform/extensions/common/extensions.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { WorkbenchList } from "../../../../platform/list/browser/listService.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { editorBackground } from "../../../../platform/theme/common/colorRegistry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { Extensions, IExtensionFeaturesManagementService } from "../../../services/extensionManagement/common/extensionFeatures.js";
import { DefaultIconPath, EnablementState } from "../../../services/extensionManagement/common/extensionManagement.js";
import { LocalWebWorkerRunningLocation } from "../../../services/extensions/common/extensionRunningLocation.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IExtensionsWorkbenchService } from "../common/extensions.js";
import { RuntimeExtensionsInput } from "../common/runtimeExtensionsInput.js";
import { errorIcon, warningIcon } from "./extensionsIcons.js";
import "./media/runtimeExtensionsEditor.css";
let AbstractRuntimeExtensionsEditor = class extends EditorPane {
  constructor(group, telemetryService, themeService, contextKeyService, _extensionsWorkbenchService, _extensionService, _notificationService, _contextMenuService, _instantiationService, storageService, _labelService, _environmentService, _clipboardService, _extensionFeaturesManagementService, _hoverService, _menuService) {
    super(AbstractRuntimeExtensionsEditor.ID, group, telemetryService, themeService, storageService);
    this.contextKeyService = contextKeyService;
    this._extensionsWorkbenchService = _extensionsWorkbenchService;
    this._extensionService = _extensionService;
    this._notificationService = _notificationService;
    this._contextMenuService = _contextMenuService;
    this._instantiationService = _instantiationService;
    this._labelService = _labelService;
    this._environmentService = _environmentService;
    this._clipboardService = _clipboardService;
    this._extensionFeaturesManagementService = _extensionFeaturesManagementService;
    this._hoverService = _hoverService;
    this._menuService = _menuService;
    this._list = null;
    this._elements = null;
    this._updateSoon = this._register(new RunOnceScheduler(() => this._updateExtensions(), 200));
    this._register(this._extensionService.onDidChangeExtensionsStatus(() => this._updateSoon.schedule()));
    this._register(this._extensionFeaturesManagementService.onDidChangeAccessData(() => this._updateSoon.schedule()));
    this._updateExtensions();
  }
  async _updateExtensions() {
    this._elements = await this._resolveExtensions();
    this._list?.splice(0, this._list.length, this._elements);
  }
  async _resolveExtensions() {
    await this._extensionService.whenInstalledExtensionsRegistered();
    const extensionsDescriptions = this._extensionService.extensions.filter((extension) => {
      return Boolean(extension.main) || Boolean(extension.browser);
    });
    const marketplaceMap = new ExtensionIdentifierMap();
    const marketPlaceExtensions = await this._extensionsWorkbenchService.queryLocal();
    for (const extension of marketPlaceExtensions) {
      marketplaceMap.set(extension.identifier.id, extension);
    }
    const statusMap = this._extensionService.getExtensionsStatus();
    const segments = new ExtensionIdentifierMap();
    const profileInfo = this._getProfileInfo();
    if (profileInfo) {
      let currentStartTime = profileInfo.startTime;
      for (let i = 0, len = profileInfo.deltas.length; i < len; i++) {
        const id = profileInfo.ids[i];
        const delta = profileInfo.deltas[i];
        let extensionSegments = segments.get(id);
        if (!extensionSegments) {
          extensionSegments = [];
          segments.set(id, extensionSegments);
        }
        extensionSegments.push(currentStartTime);
        currentStartTime = currentStartTime + delta;
        extensionSegments.push(currentStartTime);
      }
    }
    let result = [];
    for (let i = 0, len = extensionsDescriptions.length; i < len; i++) {
      const extensionDescription = extensionsDescriptions[i];
      let extProfileInfo = null;
      if (profileInfo) {
        const extensionSegments = segments.get(extensionDescription.identifier) || [];
        let extensionTotalTime = 0;
        for (let j = 0, lenJ = extensionSegments.length / 2; j < lenJ; j++) {
          const startTime = extensionSegments[2 * j];
          const endTime = extensionSegments[2 * j + 1];
          extensionTotalTime += endTime - startTime;
        }
        extProfileInfo = {
          segments: extensionSegments,
          totalTime: extensionTotalTime
        };
      }
      result[i] = {
        originalIndex: i,
        description: extensionDescription,
        marketplaceInfo: marketplaceMap.get(extensionDescription.identifier),
        status: statusMap[extensionDescription.identifier.value],
        profileInfo: extProfileInfo || void 0,
        unresponsiveProfile: this._getUnresponsiveProfile(extensionDescription.identifier)
      };
    }
    result = result.filter((element) => element.status.activationStarted);
    const isUnresponsive = (extension) => extension.unresponsiveProfile === profileInfo;
    const profileTime = (extension) => extension.profileInfo?.totalTime ?? 0;
    const activationTime = (extension) => (extension.status.activationTimes?.codeLoadingTime ?? 0) + (extension.status.activationTimes?.activateCallTime ?? 0);
    result = result.sort((a, b) => {
      if (isUnresponsive(a) || isUnresponsive(b)) {
        return +isUnresponsive(b) - +isUnresponsive(a);
      } else if (profileTime(a) || profileTime(b)) {
        return profileTime(b) - profileTime(a);
      } else if (activationTime(a) || activationTime(b)) {
        return activationTime(b) - activationTime(a);
      }
      return a.originalIndex - b.originalIndex;
    });
    return result;
  }
  createEditor(parent) {
    parent.classList.add("runtime-extensions-editor");
    const TEMPLATE_ID = "runtimeExtensionElementTemplate";
    const delegate = new class {
      getHeight(element) {
        return 70;
      }
      getTemplateId(element) {
        return TEMPLATE_ID;
      }
    }();
    const renderer = {
      templateId: TEMPLATE_ID,
      renderTemplate: (root) => {
        const element = append(root, $(".extension"));
        const iconContainer = append(element, $(".icon-container"));
        const icon = append(iconContainer, $("img.icon"));
        const desc = append(element, $("div.desc"));
        const headerContainer = append(desc, $(".header-container"));
        const header = append(headerContainer, $(".header"));
        const name = append(header, $("div.name"));
        const version = append(header, $("span.version"));
        const msgContainer = append(desc, $("div.msg"));
        const actionbar = new ActionBar(desc);
        actionbar.onDidRun(({ error }) => error && this._notificationService.error(error));
        const timeContainer = append(element, $(".time"));
        const activationTime = append(timeContainer, $("div.activation-time"));
        const profileTime = append(timeContainer, $("div.profile-time"));
        const disposables = [actionbar];
        return {
          root,
          element,
          icon,
          name,
          version,
          actionbar,
          activationTime,
          profileTime,
          msgContainer,
          disposables,
          elementDisposables: []
        };
      },
      renderElement: (element, index, data) => {
        data.elementDisposables = dispose(data.elementDisposables);
        data.root.classList.toggle("odd", index % 2 === 1);
        data.elementDisposables.push(addDisposableListener(data.icon, "error", () => data.icon.src = element.marketplaceInfo?.iconUrlFallback || DefaultIconPath, { once: true }));
        data.icon.src = element.marketplaceInfo?.iconUrl || DefaultIconPath;
        if (!data.icon.complete) {
          data.icon.style.visibility = "hidden";
          data.icon.onload = () => data.icon.style.visibility = "inherit";
        } else {
          data.icon.style.visibility = "inherit";
        }
        data.name.textContent = (element.marketplaceInfo?.displayName || element.description.identifier.value).substr(0, 50);
        data.version.textContent = element.description.version;
        const activationTimes = element.status.activationTimes;
        if (activationTimes) {
          const syncTime = activationTimes.codeLoadingTime + activationTimes.activateCallTime;
          data.activationTime.textContent = activationTimes.activationReason.startup ? `Startup Activation: ${syncTime}ms` : `Activation: ${syncTime}ms`;
        } else {
          data.activationTime.textContent = `Activating...`;
        }
        data.actionbar.clear();
        const slowExtensionAction = this._createSlowExtensionAction(element);
        if (slowExtensionAction) {
          data.actionbar.push(slowExtensionAction, { icon: false, label: true });
        }
        if (isNonEmptyArray(element.status.runtimeErrors)) {
          const reportExtensionIssueAction = this._createReportExtensionIssueAction(element);
          if (reportExtensionIssueAction) {
            data.actionbar.push(reportExtensionIssueAction, { icon: false, label: true });
          }
        }
        let title;
        if (activationTimes) {
          const activationId = activationTimes.activationReason.extensionId.value;
          const activationEvent = activationTimes.activationReason.activationEvent;
          if (activationEvent === "*") {
            title = nls.localize({
              key: "starActivation",
              comment: [
                "{0} will be an extension identifier"
              ]
            }, "Activated by {0} on start-up", activationId);
          } else if (/^workspaceContains:/.test(activationEvent)) {
            const fileNameOrGlob = activationEvent.substr("workspaceContains:".length);
            if (fileNameOrGlob.indexOf("*") >= 0 || fileNameOrGlob.indexOf("?") >= 0) {
              title = nls.localize({
                key: "workspaceContainsGlobActivation",
                comment: [
                  "{0} will be a glob pattern",
                  "{1} will be an extension identifier"
                ]
              }, "Activated by {1} because a file matching {0} exists in your workspace", fileNameOrGlob, activationId);
            } else {
              title = nls.localize({
                key: "workspaceContainsFileActivation",
                comment: [
                  "{0} will be a file name",
                  "{1} will be an extension identifier"
                ]
              }, "Activated by {1} because file {0} exists in your workspace", fileNameOrGlob, activationId);
            }
          } else if (/^workspaceContainsTimeout:/.test(activationEvent)) {
            const glob = activationEvent.substr("workspaceContainsTimeout:".length);
            title = nls.localize({
              key: "workspaceContainsTimeout",
              comment: [
                "{0} will be a glob pattern",
                "{1} will be an extension identifier"
              ]
            }, "Activated by {1} because searching for {0} took too long", glob, activationId);
          } else if (activationEvent === "onStartupFinished") {
            title = nls.localize({
              key: "startupFinishedActivation",
              comment: [
                "This refers to an extension. {0} will be an activation event."
              ]
            }, "Activated by {0} after start-up finished", activationId);
          } else if (/^onLanguage:/.test(activationEvent)) {
            const language = activationEvent.substr("onLanguage:".length);
            title = nls.localize("languageActivation", "Activated by {1} because you opened a {0} file", language, activationId);
          } else {
            title = nls.localize({
              key: "workspaceGenericActivation",
              comment: [
                "{0} will be an activation event, like e.g. 'language:typescript', 'debug', etc.",
                "{1} will be an extension identifier"
              ]
            }, "Activated by {1} on {0}", activationEvent, activationId);
          }
        } else {
          title = nls.localize("extensionActivating", "Extension is activating...");
        }
        data.elementDisposables.push(this._hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), data.activationTime, title));
        clearNode(data.msgContainer);
        if (this._getUnresponsiveProfile(element.description.identifier)) {
          const el = $("span", void 0, ...renderLabelWithIcons(` $(alert) Unresponsive`));
          const extensionHostFreezTitle = nls.localize("unresponsive.title", "Extension has caused the extension host to freeze.");
          data.elementDisposables.push(this._hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), el, extensionHostFreezTitle));
          data.msgContainer.appendChild(el);
        }
        if (isNonEmptyArray(element.status.runtimeErrors)) {
          const el = $("span", void 0, ...renderLabelWithIcons(`$(bug) ${nls.localize("errors", "{0} uncaught errors", element.status.runtimeErrors.length)}`));
          data.msgContainer.appendChild(el);
        }
        if (element.status.messages && element.status.messages.length > 0) {
          const el = $("span", void 0, ...renderLabelWithIcons(`$(alert) ${element.status.messages[0].message}`));
          data.msgContainer.appendChild(el);
        }
        let extraLabel = null;
        if (element.status.runningLocation && element.status.runningLocation.equals(new LocalWebWorkerRunningLocation(0))) {
          extraLabel = `$(globe) web worker`;
        } else if (element.description.extensionLocation.scheme === Schemas.vscodeRemote) {
          const hostLabel = this._labelService.getHostLabel(Schemas.vscodeRemote, this._environmentService.remoteAuthority);
          if (hostLabel) {
            extraLabel = `$(remote) ${hostLabel}`;
          } else {
            extraLabel = `$(remote) ${element.description.extensionLocation.authority}`;
          }
        } else if (element.status.runningLocation && element.status.runningLocation.affinity > 0) {
          extraLabel = element.status.runningLocation instanceof LocalWebWorkerRunningLocation ? `$(globe) web worker ${element.status.runningLocation.affinity + 1}` : `$(server-process) local process ${element.status.runningLocation.affinity + 1}`;
        }
        if (extraLabel) {
          const el = $("span", void 0, ...renderLabelWithIcons(extraLabel));
          data.msgContainer.appendChild(el);
        }
        const features = Registry.as(Extensions.ExtensionFeaturesRegistry).getExtensionFeatures();
        for (const feature of features) {
          const accessData = this._extensionFeaturesManagementService.getAccessData(element.description.identifier, feature.id);
          if (accessData) {
            const status = accessData?.current?.status;
            if (status) {
              data.msgContainer.appendChild($("span", void 0, `${feature.label}: `));
              data.msgContainer.appendChild($("span", void 0, ...renderLabelWithIcons(`$(${status.severity === Severity.Error ? errorIcon.id : warningIcon.id}) ${status.message}`)));
            }
            if (accessData?.accessTimes.length > 0) {
              const element2 = $("span", void 0, `${nls.localize("requests count", "{0} Usage: {1} Requests", feature.label, accessData.accessTimes.length)}${accessData.current ? nls.localize("session requests count", ", {0} Requests (Session)", accessData.current.accessTimes.length) : ""}`);
              if (accessData.current) {
                const title2 = nls.localize("requests count title", "Last request was {0}.", fromNow(accessData.current.lastAccessed, true, true));
                data.elementDisposables.push(this._hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), element2, title2));
              }
              data.msgContainer.appendChild(element2);
            }
          }
        }
        if (element.profileInfo) {
          data.profileTime.textContent = `Profile: ${(element.profileInfo.totalTime / 1e3).toFixed(2)}ms`;
        } else {
          data.profileTime.textContent = "";
        }
      },
      disposeTemplate: (data) => {
        data.disposables = dispose(data.disposables);
      }
    };
    this._list = this._instantiationService.createInstance(
      WorkbenchList,
      "RuntimeExtensions",
      parent,
      delegate,
      [renderer],
      {
        multipleSelectionSupport: false,
        setRowLineHeight: false,
        horizontalScrolling: false,
        overrideStyles: {
          listBackground: editorBackground
        },
        accessibilityProvider: new class {
          getWidgetAriaLabel() {
            return nls.localize("runtimeExtensions", "Runtime Extensions");
          }
          getAriaLabel(element) {
            return element.description.name;
          }
        }()
      }
    );
    this._list.splice(0, this._list.length, this._elements || void 0);
    this._list.onContextMenu((e) => {
      if (!e.element) {
        return;
      }
      const actions = [];
      actions.push(new Action(
        "runtimeExtensionsEditor.action.copyId",
        nls.localize("copy id", "Copy id ({0})", e.element.description.identifier.value),
        void 0,
        true,
        () => {
          this._clipboardService.writeText(e.element.description.identifier.value);
        }
      ));
      const reportExtensionIssueAction = this._createReportExtensionIssueAction(e.element);
      if (reportExtensionIssueAction) {
        actions.push(reportExtensionIssueAction);
      }
      actions.push(new Separator());
      if (e.element.marketplaceInfo) {
        actions.push(new Action("runtimeExtensionsEditor.action.disableWorkspace", nls.localize("disable workspace", "Disable (Workspace)"), void 0, true, () => this._extensionsWorkbenchService.setEnablement(e.element.marketplaceInfo, EnablementState.DisabledWorkspace)));
        actions.push(new Action("runtimeExtensionsEditor.action.disable", nls.localize("disable", "Disable"), void 0, true, () => this._extensionsWorkbenchService.setEnablement(e.element.marketplaceInfo, EnablementState.DisabledGlobally)));
      }
      actions.push(new Separator());
      const menuActions = this._menuService.getMenuActions(MenuId.ExtensionEditorContextMenu, this.contextKeyService);
      actions.push(...getContextMenuActions(menuActions).secondary);
      this._contextMenuService.showContextMenu({
        getAnchor: () => e.anchor,
        getActions: () => actions
      });
    });
  }
  layout(dimension) {
    this._list?.layout(dimension.height);
  }
};
AbstractRuntimeExtensionsEditor.ID = "workbench.editor.runtimeExtensions";
AbstractRuntimeExtensionsEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IExtensionsWorkbenchService),
  __decorateParam(5, IExtensionService),
  __decorateParam(6, INotificationService),
  __decorateParam(7, IContextMenuService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, IStorageService),
  __decorateParam(10, ILabelService),
  __decorateParam(11, IWorkbenchEnvironmentService),
  __decorateParam(12, IClipboardService),
  __decorateParam(13, IExtensionFeaturesManagementService),
  __decorateParam(14, IHoverService),
  __decorateParam(15, IMenuService)
], AbstractRuntimeExtensionsEditor);
class ShowRuntimeExtensionsAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.showRuntimeExtensions",
      title: nls.localize2("showRuntimeExtensions", "Show Running Extensions"),
      category: Categories.Developer,
      f1: true,
      menu: {
        id: MenuId.ViewContainerTitle,
        when: ContextKeyExpr.equals("viewContainer", "workbench.view.extensions"),
        group: "2_enablement",
        order: 3
      }
    });
  }
  async run(accessor) {
    await accessor.get(IEditorService).openEditor(RuntimeExtensionsInput.instance, { pinned: true });
  }
}
export {
  AbstractRuntimeExtensionsEditor,
  ShowRuntimeExtensionsAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2Jyb3dzZXIvYWJzdHJhY3RSdW50aW1lRXh0ZW5zaW9uc0VkaXRvci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7ICQsIERpbWVuc2lvbiwgYWRkRGlzcG9zYWJsZUxpc3RlbmVyLCBhcHBlbmQsIGNsZWFyTm9kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgQWN0aW9uQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZUZhY3RvcnkuanMnO1xuaW1wb3J0IHsgcmVuZGVyTGFiZWxXaXRoSWNvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaWNvbkxhYmVsL2ljb25MYWJlbHMuanMnO1xuaW1wb3J0IHsgSUxpc3RSZW5kZXJlciwgSUxpc3RWaXJ0dWFsRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IElMaXN0QWNjZXNzaWJpbGl0eVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdFdpZGdldC5qcyc7XG5pbXBvcnQgeyBBY3Rpb24sIElBY3Rpb24sIFNlcGFyYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgaXNOb25FbXB0eUFycmF5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBmcm9tTm93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZGF0ZS5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgZGlzcG9zZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENhdGVnb3JpZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbkNvbW1vbkNhdGVnb3JpZXMuanMnO1xuaW1wb3J0IHsgZ2V0Q29udGV4dE1lbnVBY3Rpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9icm93c2VyL21lbnVFbnRyeUFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIElNZW51U2VydmljZSwgTWVudUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ2xpcGJvYXJkU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NsaXBib2FyZC9jb21tb24vY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyLCBFeHRlbnNpb25JZGVudGlmaWVyTWFwLCBJRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hMaXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlLCBTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBlZGl0b3JCYWNrZ3JvdW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFuZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvclBhbmUuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMsIElFeHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlLCBJRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbkZlYXR1cmVzLmpzJztcbmltcG9ydCB7IERlZmF1bHRJY29uUGF0aCwgRW5hYmxlbWVudFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBMb2NhbFdlYldvcmtlclJ1bm5pbmdMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvblJ1bm5pbmdMb2NhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uSG9zdFByb2ZpbGUsIElFeHRlbnNpb25TZXJ2aWNlLCBJRXh0ZW5zaW9uc1N0YXR1cyB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbiwgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgUnVudGltZUV4dGVuc2lvbnNJbnB1dCB9IGZyb20gJy4uL2NvbW1vbi9ydW50aW1lRXh0ZW5zaW9uc0lucHV0LmpzJztcbmltcG9ydCB7IGVycm9ySWNvbiwgd2FybmluZ0ljb24gfSBmcm9tICcuL2V4dGVuc2lvbnNJY29ucy5qcyc7XG5pbXBvcnQgJy4vbWVkaWEvcnVudGltZUV4dGVuc2lvbnNFZGl0b3IuY3NzJztcblxuaW50ZXJmYWNlIElFeHRlbnNpb25Qcm9maWxlSW5mb3JtYXRpb24ge1xuXHQvKipcblx0ICogc2VnbWVudCB3aGVuIHRoZSBleHRlbnNpb24gd2FzIHJ1bm5pbmcuXG5cdCAqIDIqaSA9IHNlZ21lbnQgc3RhcnQgdGltZVxuXHQgKiAyKmkrMSA9IHNlZ21lbnQgZW5kIHRpbWVcblx0ICovXG5cdHNlZ21lbnRzOiBudW1iZXJbXTtcblx0LyoqXG5cdCAqIHRvdGFsIHRpbWUgd2hlbiB0aGUgZXh0ZW5zaW9uIHdhcyBydW5uaW5nLlxuXHQgKiAoc3VtIG9mIGFsbCBzZWdtZW50IGxlbmd0aHMpLlxuXHQgKi9cblx0dG90YWxUaW1lOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJ1bnRpbWVFeHRlbnNpb24ge1xuXHRvcmlnaW5hbEluZGV4OiBudW1iZXI7XG5cdGRlc2NyaXB0aW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb247XG5cdG1hcmtldHBsYWNlSW5mbzogSUV4dGVuc2lvbiB8IHVuZGVmaW5lZDtcblx0c3RhdHVzOiBJRXh0ZW5zaW9uc1N0YXR1cztcblx0cHJvZmlsZUluZm8/OiBJRXh0ZW5zaW9uUHJvZmlsZUluZm9ybWF0aW9uO1xuXHR1bnJlc3BvbnNpdmVQcm9maWxlPzogSUV4dGVuc2lvbkhvc3RQcm9maWxlO1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RSdW50aW1lRXh0ZW5zaW9uc0VkaXRvciBleHRlbmRzIEVkaXRvclBhbmUge1xuXG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQ6IHN0cmluZyA9ICd3b3JrYmVuY2guZWRpdG9yLnJ1bnRpbWVFeHRlbnNpb25zJztcblxuXHRwcml2YXRlIF9saXN0OiBXb3JrYmVuY2hMaXN0PElSdW50aW1lRXh0ZW5zaW9uPiB8IG51bGw7XG5cdHByaXZhdGUgX2VsZW1lbnRzOiBJUnVudGltZUV4dGVuc2lvbltdIHwgbnVsbDtcblx0cHJpdmF0ZSBfdXBkYXRlU29vbjogUnVuT25jZVNjaGVkdWxlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRncm91cDogSUVkaXRvckdyb3VwLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2Ugc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJQ2xpcGJvYXJkU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jbGlwYm9hcmRTZXJ2aWNlOiBJQ2xpcGJvYXJkU2VydmljZSxcblx0XHRASUV4dGVuc2lvbkZlYXR1cmVzTWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uRmVhdHVyZXNNYW5hZ2VtZW50U2VydmljZTogSUV4dGVuc2lvbkZlYXR1cmVzTWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHRcdEBJTWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoQWJzdHJhY3RSdW50aW1lRXh0ZW5zaW9uc0VkaXRvci5JRCwgZ3JvdXAsIHRlbGVtZXRyeVNlcnZpY2UsIHRoZW1lU2VydmljZSwgc3RvcmFnZVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fbGlzdCA9IG51bGw7XG5cdFx0dGhpcy5fZWxlbWVudHMgPSBudWxsO1xuXHRcdHRoaXMuX3VwZGF0ZVNvb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB0aGlzLl91cGRhdGVFeHRlbnNpb25zKCksIDIwMCkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZXh0ZW5zaW9uU2VydmljZS5vbkRpZENoYW5nZUV4dGVuc2lvbnNTdGF0dXMoKCkgPT4gdGhpcy5fdXBkYXRlU29vbi5zY2hlZHVsZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fZXh0ZW5zaW9uRmVhdHVyZXNNYW5hZ2VtZW50U2VydmljZS5vbkRpZENoYW5nZUFjY2Vzc0RhdGEoKCkgPT4gdGhpcy5fdXBkYXRlU29vbi5zY2hlZHVsZSgpKSk7XG5cdFx0dGhpcy5fdXBkYXRlRXh0ZW5zaW9ucygpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIF91cGRhdGVFeHRlbnNpb25zKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX2VsZW1lbnRzID0gYXdhaXQgdGhpcy5fcmVzb2x2ZUV4dGVuc2lvbnMoKTtcblx0XHR0aGlzLl9saXN0Py5zcGxpY2UoMCwgdGhpcy5fbGlzdC5sZW5ndGgsIHRoaXMuX2VsZW1lbnRzKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3Jlc29sdmVFeHRlbnNpb25zKCk6IFByb21pc2U8SVJ1bnRpbWVFeHRlbnNpb25bXT4ge1xuXHRcdC8vIFdlIG9ubHkgZGVhbCB3aXRoIGV4dGVuc2lvbnMgd2l0aCBzb3VyY2UgY29kZSFcblx0XHRhd2FpdCB0aGlzLl9leHRlbnNpb25TZXJ2aWNlLndoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZCgpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbnNEZXNjcmlwdGlvbnMgPSB0aGlzLl9leHRlbnNpb25TZXJ2aWNlLmV4dGVuc2lvbnMuZmlsdGVyKChleHRlbnNpb24pID0+IHtcblx0XHRcdHJldHVybiBCb29sZWFuKGV4dGVuc2lvbi5tYWluKSB8fCBCb29sZWFuKGV4dGVuc2lvbi5icm93c2VyKTtcblx0XHR9KTtcblx0XHRjb25zdCBtYXJrZXRwbGFjZU1hcCA9IG5ldyBFeHRlbnNpb25JZGVudGlmaWVyTWFwPElFeHRlbnNpb24+KCk7XG5cdFx0Y29uc3QgbWFya2V0UGxhY2VFeHRlbnNpb25zID0gYXdhaXQgdGhpcy5fZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UucXVlcnlMb2NhbCgpO1xuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIG1hcmtldFBsYWNlRXh0ZW5zaW9ucykge1xuXHRcdFx0bWFya2V0cGxhY2VNYXAuc2V0KGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLCBleHRlbnNpb24pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0YXR1c01hcCA9IHRoaXMuX2V4dGVuc2lvblNlcnZpY2UuZ2V0RXh0ZW5zaW9uc1N0YXR1cygpO1xuXG5cdFx0Ly8gZ3JvdXAgcHJvZmlsZSBzZWdtZW50cyBieSBleHRlbnNpb25cblx0XHRjb25zdCBzZWdtZW50cyA9IG5ldyBFeHRlbnNpb25JZGVudGlmaWVyTWFwPG51bWJlcltdPigpO1xuXG5cdFx0Y29uc3QgcHJvZmlsZUluZm8gPSB0aGlzLl9nZXRQcm9maWxlSW5mbygpO1xuXHRcdGlmIChwcm9maWxlSW5mbykge1xuXHRcdFx0bGV0IGN1cnJlbnRTdGFydFRpbWUgPSBwcm9maWxlSW5mby5zdGFydFRpbWU7XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gcHJvZmlsZUluZm8uZGVsdGFzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGlkID0gcHJvZmlsZUluZm8uaWRzW2ldO1xuXHRcdFx0XHRjb25zdCBkZWx0YSA9IHByb2ZpbGVJbmZvLmRlbHRhc1tpXTtcblxuXHRcdFx0XHRsZXQgZXh0ZW5zaW9uU2VnbWVudHMgPSBzZWdtZW50cy5nZXQoaWQpO1xuXHRcdFx0XHRpZiAoIWV4dGVuc2lvblNlZ21lbnRzKSB7XG5cdFx0XHRcdFx0ZXh0ZW5zaW9uU2VnbWVudHMgPSBbXTtcblx0XHRcdFx0XHRzZWdtZW50cy5zZXQoaWQsIGV4dGVuc2lvblNlZ21lbnRzKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGV4dGVuc2lvblNlZ21lbnRzLnB1c2goY3VycmVudFN0YXJ0VGltZSk7XG5cdFx0XHRcdGN1cnJlbnRTdGFydFRpbWUgPSBjdXJyZW50U3RhcnRUaW1lICsgZGVsdGE7XG5cdFx0XHRcdGV4dGVuc2lvblNlZ21lbnRzLnB1c2goY3VycmVudFN0YXJ0VGltZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGV0IHJlc3VsdDogSVJ1bnRpbWVFeHRlbnNpb25bXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSBleHRlbnNpb25zRGVzY3JpcHRpb25zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBleHRlbnNpb25EZXNjcmlwdGlvbiA9IGV4dGVuc2lvbnNEZXNjcmlwdGlvbnNbaV07XG5cblx0XHRcdGxldCBleHRQcm9maWxlSW5mbzogSUV4dGVuc2lvblByb2ZpbGVJbmZvcm1hdGlvbiB8IG51bGwgPSBudWxsO1xuXHRcdFx0aWYgKHByb2ZpbGVJbmZvKSB7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvblNlZ21lbnRzID0gc2VnbWVudHMuZ2V0KGV4dGVuc2lvbkRlc2NyaXB0aW9uLmlkZW50aWZpZXIpIHx8IFtdO1xuXHRcdFx0XHRsZXQgZXh0ZW5zaW9uVG90YWxUaW1lID0gMDtcblx0XHRcdFx0Zm9yIChsZXQgaiA9IDAsIGxlbkogPSBleHRlbnNpb25TZWdtZW50cy5sZW5ndGggLyAyOyBqIDwgbGVuSjsgaisrKSB7XG5cdFx0XHRcdFx0Y29uc3Qgc3RhcnRUaW1lID0gZXh0ZW5zaW9uU2VnbWVudHNbMiAqIGpdO1xuXHRcdFx0XHRcdGNvbnN0IGVuZFRpbWUgPSBleHRlbnNpb25TZWdtZW50c1syICogaiArIDFdO1xuXHRcdFx0XHRcdGV4dGVuc2lvblRvdGFsVGltZSArPSAoZW5kVGltZSAtIHN0YXJ0VGltZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZXh0UHJvZmlsZUluZm8gPSB7XG5cdFx0XHRcdFx0c2VnbWVudHM6IGV4dGVuc2lvblNlZ21lbnRzLFxuXHRcdFx0XHRcdHRvdGFsVGltZTogZXh0ZW5zaW9uVG90YWxUaW1lXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdHJlc3VsdFtpXSA9IHtcblx0XHRcdFx0b3JpZ2luYWxJbmRleDogaSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdFx0XHRtYXJrZXRwbGFjZUluZm86IG1hcmtldHBsYWNlTWFwLmdldChleHRlbnNpb25EZXNjcmlwdGlvbi5pZGVudGlmaWVyKSxcblx0XHRcdFx0c3RhdHVzOiBzdGF0dXNNYXBbZXh0ZW5zaW9uRGVzY3JpcHRpb24uaWRlbnRpZmllci52YWx1ZV0sXG5cdFx0XHRcdHByb2ZpbGVJbmZvOiBleHRQcm9maWxlSW5mbyB8fCB1bmRlZmluZWQsXG5cdFx0XHRcdHVucmVzcG9uc2l2ZVByb2ZpbGU6IHRoaXMuX2dldFVucmVzcG9uc2l2ZVByb2ZpbGUoZXh0ZW5zaW9uRGVzY3JpcHRpb24uaWRlbnRpZmllcilcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0cmVzdWx0ID0gcmVzdWx0LmZpbHRlcihlbGVtZW50ID0+IGVsZW1lbnQuc3RhdHVzLmFjdGl2YXRpb25TdGFydGVkKTtcblxuXHRcdC8vIGJ1YmJsZSB1cCBleHRlbnNpb25zIHRoYXQgaGF2ZSBjYXVzZWQgc2xvd25lc3NcblxuXHRcdGNvbnN0IGlzVW5yZXNwb25zaXZlID0gKGV4dGVuc2lvbjogSVJ1bnRpbWVFeHRlbnNpb24pOiBib29sZWFuID0+XG5cdFx0XHRleHRlbnNpb24udW5yZXNwb25zaXZlUHJvZmlsZSA9PT0gcHJvZmlsZUluZm87XG5cblx0XHRjb25zdCBwcm9maWxlVGltZSA9IChleHRlbnNpb246IElSdW50aW1lRXh0ZW5zaW9uKTogbnVtYmVyID0+XG5cdFx0XHRleHRlbnNpb24ucHJvZmlsZUluZm8/LnRvdGFsVGltZSA/PyAwO1xuXG5cdFx0Y29uc3QgYWN0aXZhdGlvblRpbWUgPSAoZXh0ZW5zaW9uOiBJUnVudGltZUV4dGVuc2lvbik6IG51bWJlciA9PlxuXHRcdFx0KGV4dGVuc2lvbi5zdGF0dXMuYWN0aXZhdGlvblRpbWVzPy5jb2RlTG9hZGluZ1RpbWUgPz8gMCkgK1xuXHRcdFx0KGV4dGVuc2lvbi5zdGF0dXMuYWN0aXZhdGlvblRpbWVzPy5hY3RpdmF0ZUNhbGxUaW1lID8/IDApO1xuXG5cdFx0cmVzdWx0ID0gcmVzdWx0LnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdGlmIChpc1VucmVzcG9uc2l2ZShhKSB8fCBpc1VucmVzcG9uc2l2ZShiKSkge1xuXHRcdFx0XHRyZXR1cm4gK2lzVW5yZXNwb25zaXZlKGIpIC0gK2lzVW5yZXNwb25zaXZlKGEpO1xuXHRcdFx0fSBlbHNlIGlmIChwcm9maWxlVGltZShhKSB8fCBwcm9maWxlVGltZShiKSkge1xuXHRcdFx0XHRyZXR1cm4gcHJvZmlsZVRpbWUoYikgLSBwcm9maWxlVGltZShhKTtcblx0XHRcdH0gZWxzZSBpZiAoYWN0aXZhdGlvblRpbWUoYSkgfHwgYWN0aXZhdGlvblRpbWUoYikpIHtcblx0XHRcdFx0cmV0dXJuIGFjdGl2YXRpb25UaW1lKGIpIC0gYWN0aXZhdGlvblRpbWUoYSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYS5vcmlnaW5hbEluZGV4IC0gYi5vcmlnaW5hbEluZGV4O1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByb3RlY3RlZCBjcmVhdGVFZGl0b3IocGFyZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHBhcmVudC5jbGFzc0xpc3QuYWRkKCdydW50aW1lLWV4dGVuc2lvbnMtZWRpdG9yJyk7XG5cblx0XHRjb25zdCBURU1QTEFURV9JRCA9ICdydW50aW1lRXh0ZW5zaW9uRWxlbWVudFRlbXBsYXRlJztcblxuXHRcdGNvbnN0IGRlbGVnYXRlID0gbmV3IGNsYXNzIGltcGxlbWVudHMgSUxpc3RWaXJ0dWFsRGVsZWdhdGU8SVJ1bnRpbWVFeHRlbnNpb24+IHtcblx0XHRcdGdldEhlaWdodChlbGVtZW50OiBJUnVudGltZUV4dGVuc2lvbik6IG51bWJlciB7XG5cdFx0XHRcdHJldHVybiA3MDtcblx0XHRcdH1cblx0XHRcdGdldFRlbXBsYXRlSWQoZWxlbWVudDogSVJ1bnRpbWVFeHRlbnNpb24pOiBzdHJpbmcge1xuXHRcdFx0XHRyZXR1cm4gVEVNUExBVEVfSUQ7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGludGVyZmFjZSBJUnVudGltZUV4dGVuc2lvblRlbXBsYXRlRGF0YSB7XG5cdFx0XHRyb290OiBIVE1MRWxlbWVudDtcblx0XHRcdGVsZW1lbnQ6IEhUTUxFbGVtZW50O1xuXHRcdFx0aWNvbjogSFRNTEltYWdlRWxlbWVudDtcblx0XHRcdG5hbWU6IEhUTUxFbGVtZW50O1xuXHRcdFx0dmVyc2lvbjogSFRNTEVsZW1lbnQ7XG5cdFx0XHRtc2dDb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRcdFx0YWN0aW9uYmFyOiBBY3Rpb25CYXI7XG5cdFx0XHRhY3RpdmF0aW9uVGltZTogSFRNTEVsZW1lbnQ7XG5cdFx0XHRwcm9maWxlVGltZTogSFRNTEVsZW1lbnQ7XG5cdFx0XHRkaXNwb3NhYmxlczogSURpc3Bvc2FibGVbXTtcblx0XHRcdGVsZW1lbnREaXNwb3NhYmxlczogSURpc3Bvc2FibGVbXTtcblx0XHR9XG5cblx0XHRjb25zdCByZW5kZXJlcjogSUxpc3RSZW5kZXJlcjxJUnVudGltZUV4dGVuc2lvbiwgSVJ1bnRpbWVFeHRlbnNpb25UZW1wbGF0ZURhdGE+ID0ge1xuXHRcdFx0dGVtcGxhdGVJZDogVEVNUExBVEVfSUQsXG5cdFx0XHRyZW5kZXJUZW1wbGF0ZTogKHJvb3Q6IEhUTUxFbGVtZW50KTogSVJ1bnRpbWVFeHRlbnNpb25UZW1wbGF0ZURhdGEgPT4ge1xuXHRcdFx0XHRjb25zdCBlbGVtZW50ID0gYXBwZW5kKHJvb3QsICQoJy5leHRlbnNpb24nKSk7XG5cdFx0XHRcdGNvbnN0IGljb25Db250YWluZXIgPSBhcHBlbmQoZWxlbWVudCwgJCgnLmljb24tY29udGFpbmVyJykpO1xuXHRcdFx0XHRjb25zdCBpY29uID0gYXBwZW5kKGljb25Db250YWluZXIsICQ8SFRNTEltYWdlRWxlbWVudD4oJ2ltZy5pY29uJykpO1xuXG5cdFx0XHRcdGNvbnN0IGRlc2MgPSBhcHBlbmQoZWxlbWVudCwgJCgnZGl2LmRlc2MnKSk7XG5cdFx0XHRcdGNvbnN0IGhlYWRlckNvbnRhaW5lciA9IGFwcGVuZChkZXNjLCAkKCcuaGVhZGVyLWNvbnRhaW5lcicpKTtcblx0XHRcdFx0Y29uc3QgaGVhZGVyID0gYXBwZW5kKGhlYWRlckNvbnRhaW5lciwgJCgnLmhlYWRlcicpKTtcblx0XHRcdFx0Y29uc3QgbmFtZSA9IGFwcGVuZChoZWFkZXIsICQoJ2Rpdi5uYW1lJykpO1xuXHRcdFx0XHRjb25zdCB2ZXJzaW9uID0gYXBwZW5kKGhlYWRlciwgJCgnc3Bhbi52ZXJzaW9uJykpO1xuXG5cdFx0XHRcdGNvbnN0IG1zZ0NvbnRhaW5lciA9IGFwcGVuZChkZXNjLCAkKCdkaXYubXNnJykpO1xuXG5cdFx0XHRcdGNvbnN0IGFjdGlvbmJhciA9IG5ldyBBY3Rpb25CYXIoZGVzYyk7XG5cdFx0XHRcdGFjdGlvbmJhci5vbkRpZFJ1bigoeyBlcnJvciB9KSA9PiBlcnJvciAmJiB0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGVycm9yKSk7XG5cblx0XHRcdFx0Y29uc3QgdGltZUNvbnRhaW5lciA9IGFwcGVuZChlbGVtZW50LCAkKCcudGltZScpKTtcblx0XHRcdFx0Y29uc3QgYWN0aXZhdGlvblRpbWUgPSBhcHBlbmQodGltZUNvbnRhaW5lciwgJCgnZGl2LmFjdGl2YXRpb24tdGltZScpKTtcblx0XHRcdFx0Y29uc3QgcHJvZmlsZVRpbWUgPSBhcHBlbmQodGltZUNvbnRhaW5lciwgJCgnZGl2LnByb2ZpbGUtdGltZScpKTtcblxuXHRcdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IFthY3Rpb25iYXJdO1xuXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0cm9vdCxcblx0XHRcdFx0XHRlbGVtZW50LFxuXHRcdFx0XHRcdGljb24sXG5cdFx0XHRcdFx0bmFtZSxcblx0XHRcdFx0XHR2ZXJzaW9uLFxuXHRcdFx0XHRcdGFjdGlvbmJhcixcblx0XHRcdFx0XHRhY3RpdmF0aW9uVGltZSxcblx0XHRcdFx0XHRwcm9maWxlVGltZSxcblx0XHRcdFx0XHRtc2dDb250YWluZXIsXG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXMsXG5cdFx0XHRcdFx0ZWxlbWVudERpc3Bvc2FibGVzOiBbXSxcblx0XHRcdFx0fTtcblx0XHRcdH0sXG5cblx0XHRcdHJlbmRlckVsZW1lbnQ6IChlbGVtZW50OiBJUnVudGltZUV4dGVuc2lvbiwgaW5kZXg6IG51bWJlciwgZGF0YTogSVJ1bnRpbWVFeHRlbnNpb25UZW1wbGF0ZURhdGEpOiB2b2lkID0+IHtcblxuXHRcdFx0XHRkYXRhLmVsZW1lbnREaXNwb3NhYmxlcyA9IGRpc3Bvc2UoZGF0YS5lbGVtZW50RGlzcG9zYWJsZXMpO1xuXG5cdFx0XHRcdGRhdGEucm9vdC5jbGFzc0xpc3QudG9nZ2xlKCdvZGQnLCBpbmRleCAlIDIgPT09IDEpO1xuXG5cdFx0XHRcdGRhdGEuZWxlbWVudERpc3Bvc2FibGVzLnB1c2goYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGRhdGEuaWNvbiwgJ2Vycm9yJywgKCkgPT4gZGF0YS5pY29uLnNyYyA9IGVsZW1lbnQubWFya2V0cGxhY2VJbmZvPy5pY29uVXJsRmFsbGJhY2sgfHwgRGVmYXVsdEljb25QYXRoLCB7IG9uY2U6IHRydWUgfSkpO1xuXHRcdFx0XHRkYXRhLmljb24uc3JjID0gZWxlbWVudC5tYXJrZXRwbGFjZUluZm8/Lmljb25VcmwgfHwgRGVmYXVsdEljb25QYXRoO1xuXG5cdFx0XHRcdGlmICghZGF0YS5pY29uLmNvbXBsZXRlKSB7XG5cdFx0XHRcdFx0ZGF0YS5pY29uLnN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcblx0XHRcdFx0XHRkYXRhLmljb24ub25sb2FkID0gKCkgPT4gZGF0YS5pY29uLnN0eWxlLnZpc2liaWxpdHkgPSAnaW5oZXJpdCc7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZGF0YS5pY29uLnN0eWxlLnZpc2liaWxpdHkgPSAnaW5oZXJpdCc7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZGF0YS5uYW1lLnRleHRDb250ZW50ID0gKGVsZW1lbnQubWFya2V0cGxhY2VJbmZvPy5kaXNwbGF5TmFtZSB8fCBlbGVtZW50LmRlc2NyaXB0aW9uLmlkZW50aWZpZXIudmFsdWUpLnN1YnN0cigwLCA1MCk7XG5cdFx0XHRcdGRhdGEudmVyc2lvbi50ZXh0Q29udGVudCA9IGVsZW1lbnQuZGVzY3JpcHRpb24udmVyc2lvbjtcblxuXHRcdFx0XHRjb25zdCBhY3RpdmF0aW9uVGltZXMgPSBlbGVtZW50LnN0YXR1cy5hY3RpdmF0aW9uVGltZXM7XG5cdFx0XHRcdGlmIChhY3RpdmF0aW9uVGltZXMpIHtcblx0XHRcdFx0XHRjb25zdCBzeW5jVGltZSA9IGFjdGl2YXRpb25UaW1lcy5jb2RlTG9hZGluZ1RpbWUgKyBhY3RpdmF0aW9uVGltZXMuYWN0aXZhdGVDYWxsVGltZTtcblx0XHRcdFx0XHRkYXRhLmFjdGl2YXRpb25UaW1lLnRleHRDb250ZW50ID0gYWN0aXZhdGlvblRpbWVzLmFjdGl2YXRpb25SZWFzb24uc3RhcnR1cCA/IGBTdGFydHVwIEFjdGl2YXRpb246ICR7c3luY1RpbWV9bXNgIDogYEFjdGl2YXRpb246ICR7c3luY1RpbWV9bXNgO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGRhdGEuYWN0aXZhdGlvblRpbWUudGV4dENvbnRlbnQgPSBgQWN0aXZhdGluZy4uLmA7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRkYXRhLmFjdGlvbmJhci5jbGVhcigpO1xuXHRcdFx0XHRjb25zdCBzbG93RXh0ZW5zaW9uQWN0aW9uID0gdGhpcy5fY3JlYXRlU2xvd0V4dGVuc2lvbkFjdGlvbihlbGVtZW50KTtcblx0XHRcdFx0aWYgKHNsb3dFeHRlbnNpb25BY3Rpb24pIHtcblx0XHRcdFx0XHRkYXRhLmFjdGlvbmJhci5wdXNoKHNsb3dFeHRlbnNpb25BY3Rpb24sIHsgaWNvbjogZmFsc2UsIGxhYmVsOiB0cnVlIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChpc05vbkVtcHR5QXJyYXkoZWxlbWVudC5zdGF0dXMucnVudGltZUVycm9ycykpIHtcblx0XHRcdFx0XHRjb25zdCByZXBvcnRFeHRlbnNpb25Jc3N1ZUFjdGlvbiA9IHRoaXMuX2NyZWF0ZVJlcG9ydEV4dGVuc2lvbklzc3VlQWN0aW9uKGVsZW1lbnQpO1xuXHRcdFx0XHRcdGlmIChyZXBvcnRFeHRlbnNpb25Jc3N1ZUFjdGlvbikge1xuXHRcdFx0XHRcdFx0ZGF0YS5hY3Rpb25iYXIucHVzaChyZXBvcnRFeHRlbnNpb25Jc3N1ZUFjdGlvbiwgeyBpY29uOiBmYWxzZSwgbGFiZWw6IHRydWUgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0bGV0IHRpdGxlOiBzdHJpbmc7XG5cdFx0XHRcdGlmIChhY3RpdmF0aW9uVGltZXMpIHtcblx0XHRcdFx0XHRjb25zdCBhY3RpdmF0aW9uSWQgPSBhY3RpdmF0aW9uVGltZXMuYWN0aXZhdGlvblJlYXNvbi5leHRlbnNpb25JZC52YWx1ZTtcblx0XHRcdFx0XHRjb25zdCBhY3RpdmF0aW9uRXZlbnQgPSBhY3RpdmF0aW9uVGltZXMuYWN0aXZhdGlvblJlYXNvbi5hY3RpdmF0aW9uRXZlbnQ7XG5cdFx0XHRcdFx0aWYgKGFjdGl2YXRpb25FdmVudCA9PT0gJyonKSB7XG5cdFx0XHRcdFx0XHR0aXRsZSA9IG5scy5sb2NhbGl6ZSh7XG5cdFx0XHRcdFx0XHRcdGtleTogJ3N0YXJBY3RpdmF0aW9uJyxcblx0XHRcdFx0XHRcdFx0Y29tbWVudDogW1xuXHRcdFx0XHRcdFx0XHRcdCd7MH0gd2lsbCBiZSBhbiBleHRlbnNpb24gaWRlbnRpZmllcidcblx0XHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdFx0fSwgXCJBY3RpdmF0ZWQgYnkgezB9IG9uIHN0YXJ0LXVwXCIsIGFjdGl2YXRpb25JZCk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmICgvXndvcmtzcGFjZUNvbnRhaW5zOi8udGVzdChhY3RpdmF0aW9uRXZlbnQpKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBmaWxlTmFtZU9yR2xvYiA9IGFjdGl2YXRpb25FdmVudC5zdWJzdHIoJ3dvcmtzcGFjZUNvbnRhaW5zOicubGVuZ3RoKTtcblx0XHRcdFx0XHRcdGlmIChmaWxlTmFtZU9yR2xvYi5pbmRleE9mKCcqJykgPj0gMCB8fCBmaWxlTmFtZU9yR2xvYi5pbmRleE9mKCc/JykgPj0gMCkge1xuXHRcdFx0XHRcdFx0XHR0aXRsZSA9IG5scy5sb2NhbGl6ZSh7XG5cdFx0XHRcdFx0XHRcdFx0a2V5OiAnd29ya3NwYWNlQ29udGFpbnNHbG9iQWN0aXZhdGlvbicsXG5cdFx0XHRcdFx0XHRcdFx0Y29tbWVudDogW1xuXHRcdFx0XHRcdFx0XHRcdFx0J3swfSB3aWxsIGJlIGEgZ2xvYiBwYXR0ZXJuJyxcblx0XHRcdFx0XHRcdFx0XHRcdCd7MX0gd2lsbCBiZSBhbiBleHRlbnNpb24gaWRlbnRpZmllcidcblx0XHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHRcdH0sIFwiQWN0aXZhdGVkIGJ5IHsxfSBiZWNhdXNlIGEgZmlsZSBtYXRjaGluZyB7MH0gZXhpc3RzIGluIHlvdXIgd29ya3NwYWNlXCIsIGZpbGVOYW1lT3JHbG9iLCBhY3RpdmF0aW9uSWQpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dGl0bGUgPSBubHMubG9jYWxpemUoe1xuXHRcdFx0XHRcdFx0XHRcdGtleTogJ3dvcmtzcGFjZUNvbnRhaW5zRmlsZUFjdGl2YXRpb24nLFxuXHRcdFx0XHRcdFx0XHRcdGNvbW1lbnQ6IFtcblx0XHRcdFx0XHRcdFx0XHRcdCd7MH0gd2lsbCBiZSBhIGZpbGUgbmFtZScsXG5cdFx0XHRcdFx0XHRcdFx0XHQnezF9IHdpbGwgYmUgYW4gZXh0ZW5zaW9uIGlkZW50aWZpZXInXG5cdFx0XHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdFx0XHR9LCBcIkFjdGl2YXRlZCBieSB7MX0gYmVjYXVzZSBmaWxlIHswfSBleGlzdHMgaW4geW91ciB3b3Jrc3BhY2VcIiwgZmlsZU5hbWVPckdsb2IsIGFjdGl2YXRpb25JZCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIGlmICgvXndvcmtzcGFjZUNvbnRhaW5zVGltZW91dDovLnRlc3QoYWN0aXZhdGlvbkV2ZW50KSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgZ2xvYiA9IGFjdGl2YXRpb25FdmVudC5zdWJzdHIoJ3dvcmtzcGFjZUNvbnRhaW5zVGltZW91dDonLmxlbmd0aCk7XG5cdFx0XHRcdFx0XHR0aXRsZSA9IG5scy5sb2NhbGl6ZSh7XG5cdFx0XHRcdFx0XHRcdGtleTogJ3dvcmtzcGFjZUNvbnRhaW5zVGltZW91dCcsXG5cdFx0XHRcdFx0XHRcdGNvbW1lbnQ6IFtcblx0XHRcdFx0XHRcdFx0XHQnezB9IHdpbGwgYmUgYSBnbG9iIHBhdHRlcm4nLFxuXHRcdFx0XHRcdFx0XHRcdCd7MX0gd2lsbCBiZSBhbiBleHRlbnNpb24gaWRlbnRpZmllcidcblx0XHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdFx0fSwgXCJBY3RpdmF0ZWQgYnkgezF9IGJlY2F1c2Ugc2VhcmNoaW5nIGZvciB7MH0gdG9vayB0b28gbG9uZ1wiLCBnbG9iLCBhY3RpdmF0aW9uSWQpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoYWN0aXZhdGlvbkV2ZW50ID09PSAnb25TdGFydHVwRmluaXNoZWQnKSB7XG5cdFx0XHRcdFx0XHR0aXRsZSA9IG5scy5sb2NhbGl6ZSh7XG5cdFx0XHRcdFx0XHRcdGtleTogJ3N0YXJ0dXBGaW5pc2hlZEFjdGl2YXRpb24nLFxuXHRcdFx0XHRcdFx0XHRjb21tZW50OiBbXG5cdFx0XHRcdFx0XHRcdFx0J1RoaXMgcmVmZXJzIHRvIGFuIGV4dGVuc2lvbi4gezB9IHdpbGwgYmUgYW4gYWN0aXZhdGlvbiBldmVudC4nXG5cdFx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHRcdH0sIFwiQWN0aXZhdGVkIGJ5IHswfSBhZnRlciBzdGFydC11cCBmaW5pc2hlZFwiLCBhY3RpdmF0aW9uSWQpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoL15vbkxhbmd1YWdlOi8udGVzdChhY3RpdmF0aW9uRXZlbnQpKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBsYW5ndWFnZSA9IGFjdGl2YXRpb25FdmVudC5zdWJzdHIoJ29uTGFuZ3VhZ2U6Jy5sZW5ndGgpO1xuXHRcdFx0XHRcdFx0dGl0bGUgPSBubHMubG9jYWxpemUoJ2xhbmd1YWdlQWN0aXZhdGlvbicsIFwiQWN0aXZhdGVkIGJ5IHsxfSBiZWNhdXNlIHlvdSBvcGVuZWQgYSB7MH0gZmlsZVwiLCBsYW5ndWFnZSwgYWN0aXZhdGlvbklkKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGl0bGUgPSBubHMubG9jYWxpemUoe1xuXHRcdFx0XHRcdFx0XHRrZXk6ICd3b3Jrc3BhY2VHZW5lcmljQWN0aXZhdGlvbicsXG5cdFx0XHRcdFx0XHRcdGNvbW1lbnQ6IFtcblx0XHRcdFx0XHRcdFx0XHQnezB9IHdpbGwgYmUgYW4gYWN0aXZhdGlvbiBldmVudCwgbGlrZSBlLmcuIFxcJ2xhbmd1YWdlOnR5cGVzY3JpcHRcXCcsIFxcJ2RlYnVnXFwnLCBldGMuJyxcblx0XHRcdFx0XHRcdFx0XHQnezF9IHdpbGwgYmUgYW4gZXh0ZW5zaW9uIGlkZW50aWZpZXInXG5cdFx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHRcdH0sIFwiQWN0aXZhdGVkIGJ5IHsxfSBvbiB7MH1cIiwgYWN0aXZhdGlvbkV2ZW50LCBhY3RpdmF0aW9uSWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aXRsZSA9IG5scy5sb2NhbGl6ZSgnZXh0ZW5zaW9uQWN0aXZhdGluZycsIFwiRXh0ZW5zaW9uIGlzIGFjdGl2YXRpbmcuLi5cIik7XG5cdFx0XHRcdH1cblx0XHRcdFx0ZGF0YS5lbGVtZW50RGlzcG9zYWJsZXMucHVzaCh0aGlzLl9ob3ZlclNlcnZpY2Uuc2V0dXBNYW5hZ2VkSG92ZXIoZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ21vdXNlJyksIGRhdGEuYWN0aXZhdGlvblRpbWUsIHRpdGxlKSk7XG5cblx0XHRcdFx0Y2xlYXJOb2RlKGRhdGEubXNnQ29udGFpbmVyKTtcblxuXHRcdFx0XHRpZiAodGhpcy5fZ2V0VW5yZXNwb25zaXZlUHJvZmlsZShlbGVtZW50LmRlc2NyaXB0aW9uLmlkZW50aWZpZXIpKSB7XG5cdFx0XHRcdFx0Y29uc3QgZWwgPSAkKCdzcGFuJywgdW5kZWZpbmVkLCAuLi5yZW5kZXJMYWJlbFdpdGhJY29ucyhgICQoYWxlcnQpIFVucmVzcG9uc2l2ZWApKTtcblx0XHRcdFx0XHRjb25zdCBleHRlbnNpb25Ib3N0RnJlZXpUaXRsZSA9IG5scy5sb2NhbGl6ZSgndW5yZXNwb25zaXZlLnRpdGxlJywgXCJFeHRlbnNpb24gaGFzIGNhdXNlZCB0aGUgZXh0ZW5zaW9uIGhvc3QgdG8gZnJlZXplLlwiKTtcblx0XHRcdFx0XHRkYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5wdXNoKHRoaXMuX2hvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgZWwsIGV4dGVuc2lvbkhvc3RGcmVlelRpdGxlKSk7XG5cblx0XHRcdFx0XHRkYXRhLm1zZ0NvbnRhaW5lci5hcHBlbmRDaGlsZChlbCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoaXNOb25FbXB0eUFycmF5KGVsZW1lbnQuc3RhdHVzLnJ1bnRpbWVFcnJvcnMpKSB7XG5cdFx0XHRcdFx0Y29uc3QgZWwgPSAkKCdzcGFuJywgdW5kZWZpbmVkLCAuLi5yZW5kZXJMYWJlbFdpdGhJY29ucyhgJChidWcpICR7bmxzLmxvY2FsaXplKCdlcnJvcnMnLCBcInswfSB1bmNhdWdodCBlcnJvcnNcIiwgZWxlbWVudC5zdGF0dXMucnVudGltZUVycm9ycy5sZW5ndGgpfWApKTtcblx0XHRcdFx0XHRkYXRhLm1zZ0NvbnRhaW5lci5hcHBlbmRDaGlsZChlbCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoZWxlbWVudC5zdGF0dXMubWVzc2FnZXMgJiYgZWxlbWVudC5zdGF0dXMubWVzc2FnZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdGNvbnN0IGVsID0gJCgnc3BhbicsIHVuZGVmaW5lZCwgLi4ucmVuZGVyTGFiZWxXaXRoSWNvbnMoYCQoYWxlcnQpICR7ZWxlbWVudC5zdGF0dXMubWVzc2FnZXNbMF0ubWVzc2FnZX1gKSk7XG5cdFx0XHRcdFx0ZGF0YS5tc2dDb250YWluZXIuYXBwZW5kQ2hpbGQoZWwpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bGV0IGV4dHJhTGFiZWw6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRcdFx0XHRpZiAoZWxlbWVudC5zdGF0dXMucnVubmluZ0xvY2F0aW9uICYmIGVsZW1lbnQuc3RhdHVzLnJ1bm5pbmdMb2NhdGlvbi5lcXVhbHMobmV3IExvY2FsV2ViV29ya2VyUnVubmluZ0xvY2F0aW9uKDApKSkge1xuXHRcdFx0XHRcdGV4dHJhTGFiZWwgPSBgJChnbG9iZSkgd2ViIHdvcmtlcmA7XG5cdFx0XHRcdH0gZWxzZSBpZiAoZWxlbWVudC5kZXNjcmlwdGlvbi5leHRlbnNpb25Mb2NhdGlvbi5zY2hlbWUgPT09IFNjaGVtYXMudnNjb2RlUmVtb3RlKSB7XG5cdFx0XHRcdFx0Y29uc3QgaG9zdExhYmVsID0gdGhpcy5fbGFiZWxTZXJ2aWNlLmdldEhvc3RMYWJlbChTY2hlbWFzLnZzY29kZVJlbW90ZSwgdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSk7XG5cdFx0XHRcdFx0aWYgKGhvc3RMYWJlbCkge1xuXHRcdFx0XHRcdFx0ZXh0cmFMYWJlbCA9IGAkKHJlbW90ZSkgJHtob3N0TGFiZWx9YDtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0ZXh0cmFMYWJlbCA9IGAkKHJlbW90ZSkgJHtlbGVtZW50LmRlc2NyaXB0aW9uLmV4dGVuc2lvbkxvY2F0aW9uLmF1dGhvcml0eX1gO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIGlmIChlbGVtZW50LnN0YXR1cy5ydW5uaW5nTG9jYXRpb24gJiYgZWxlbWVudC5zdGF0dXMucnVubmluZ0xvY2F0aW9uLmFmZmluaXR5ID4gMCkge1xuXHRcdFx0XHRcdGV4dHJhTGFiZWwgPSBlbGVtZW50LnN0YXR1cy5ydW5uaW5nTG9jYXRpb24gaW5zdGFuY2VvZiBMb2NhbFdlYldvcmtlclJ1bm5pbmdMb2NhdGlvblxuXHRcdFx0XHRcdFx0PyBgJChnbG9iZSkgd2ViIHdvcmtlciAke2VsZW1lbnQuc3RhdHVzLnJ1bm5pbmdMb2NhdGlvbi5hZmZpbml0eSArIDF9YFxuXHRcdFx0XHRcdFx0OiBgJChzZXJ2ZXItcHJvY2VzcykgbG9jYWwgcHJvY2VzcyAke2VsZW1lbnQuc3RhdHVzLnJ1bm5pbmdMb2NhdGlvbi5hZmZpbml0eSArIDF9YDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChleHRyYUxhYmVsKSB7XG5cdFx0XHRcdFx0Y29uc3QgZWwgPSAkKCdzcGFuJywgdW5kZWZpbmVkLCAuLi5yZW5kZXJMYWJlbFdpdGhJY29ucyhleHRyYUxhYmVsKSk7XG5cdFx0XHRcdFx0ZGF0YS5tc2dDb250YWluZXIuYXBwZW5kQ2hpbGQoZWwpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgZmVhdHVyZXMgPSBSZWdpc3RyeS5hczxJRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeT4oRXh0ZW5zaW9ucy5FeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5KS5nZXRFeHRlbnNpb25GZWF0dXJlcygpO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGZlYXR1cmUgb2YgZmVhdHVyZXMpIHtcblx0XHRcdFx0XHRjb25zdCBhY2Nlc3NEYXRhID0gdGhpcy5fZXh0ZW5zaW9uRmVhdHVyZXNNYW5hZ2VtZW50U2VydmljZS5nZXRBY2Nlc3NEYXRhKGVsZW1lbnQuZGVzY3JpcHRpb24uaWRlbnRpZmllciwgZmVhdHVyZS5pZCk7XG5cdFx0XHRcdFx0aWYgKGFjY2Vzc0RhdGEpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHN0YXR1cyA9IGFjY2Vzc0RhdGE/LmN1cnJlbnQ/LnN0YXR1cztcblx0XHRcdFx0XHRcdGlmIChzdGF0dXMpIHtcblx0XHRcdFx0XHRcdFx0ZGF0YS5tc2dDb250YWluZXIuYXBwZW5kQ2hpbGQoJCgnc3BhbicsIHVuZGVmaW5lZCwgYCR7ZmVhdHVyZS5sYWJlbH06IGApKTtcblx0XHRcdFx0XHRcdFx0ZGF0YS5tc2dDb250YWluZXIuYXBwZW5kQ2hpbGQoJCgnc3BhbicsIHVuZGVmaW5lZCwgLi4ucmVuZGVyTGFiZWxXaXRoSWNvbnMoYCQoJHtzdGF0dXMuc2V2ZXJpdHkgPT09IFNldmVyaXR5LkVycm9yID8gZXJyb3JJY29uLmlkIDogd2FybmluZ0ljb24uaWR9KSAke3N0YXR1cy5tZXNzYWdlfWApKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRpZiAoYWNjZXNzRGF0YT8uYWNjZXNzVGltZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBlbGVtZW50ID0gJCgnc3BhbicsIHVuZGVmaW5lZCwgYCR7bmxzLmxvY2FsaXplKCdyZXF1ZXN0cyBjb3VudCcsIFwiezB9IFVzYWdlOiB7MX0gUmVxdWVzdHNcIiwgZmVhdHVyZS5sYWJlbCwgYWNjZXNzRGF0YS5hY2Nlc3NUaW1lcy5sZW5ndGgpfSR7YWNjZXNzRGF0YS5jdXJyZW50ID8gbmxzLmxvY2FsaXplKCdzZXNzaW9uIHJlcXVlc3RzIGNvdW50JywgXCIsIHswfSBSZXF1ZXN0cyAoU2Vzc2lvbilcIiwgYWNjZXNzRGF0YS5jdXJyZW50LmFjY2Vzc1RpbWVzLmxlbmd0aCkgOiAnJ31gKTtcblx0XHRcdFx0XHRcdFx0aWYgKGFjY2Vzc0RhdGEuY3VycmVudCkge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IHRpdGxlID0gbmxzLmxvY2FsaXplKCdyZXF1ZXN0cyBjb3VudCB0aXRsZScsIFwiTGFzdCByZXF1ZXN0IHdhcyB7MH0uXCIsIGZyb21Ob3coYWNjZXNzRGF0YS5jdXJyZW50Lmxhc3RBY2Nlc3NlZCwgdHJ1ZSwgdHJ1ZSkpO1xuXHRcdFx0XHRcdFx0XHRcdGRhdGEuZWxlbWVudERpc3Bvc2FibGVzLnB1c2godGhpcy5faG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpLCBlbGVtZW50LCB0aXRsZSkpO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0ZGF0YS5tc2dDb250YWluZXIuYXBwZW5kQ2hpbGQoZWxlbWVudCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGVsZW1lbnQucHJvZmlsZUluZm8pIHtcblx0XHRcdFx0XHRkYXRhLnByb2ZpbGVUaW1lLnRleHRDb250ZW50ID0gYFByb2ZpbGU6ICR7KGVsZW1lbnQucHJvZmlsZUluZm8udG90YWxUaW1lIC8gMTAwMCkudG9GaXhlZCgyKX1tc2A7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0ZGF0YS5wcm9maWxlVGltZS50ZXh0Q29udGVudCA9ICcnO1xuXHRcdFx0XHR9XG5cblx0XHRcdH0sXG5cblx0XHRcdGRpc3Bvc2VUZW1wbGF0ZTogKGRhdGE6IElSdW50aW1lRXh0ZW5zaW9uVGVtcGxhdGVEYXRhKTogdm9pZCA9PiB7XG5cdFx0XHRcdGRhdGEuZGlzcG9zYWJsZXMgPSBkaXNwb3NlKGRhdGEuZGlzcG9zYWJsZXMpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR0aGlzLl9saXN0ID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya2JlbmNoTGlzdDxJUnVudGltZUV4dGVuc2lvbj4sXG5cdFx0XHQnUnVudGltZUV4dGVuc2lvbnMnLFxuXHRcdFx0cGFyZW50LCBkZWxlZ2F0ZSwgW3JlbmRlcmVyXSwge1xuXHRcdFx0bXVsdGlwbGVTZWxlY3Rpb25TdXBwb3J0OiBmYWxzZSxcblx0XHRcdHNldFJvd0xpbmVIZWlnaHQ6IGZhbHNlLFxuXHRcdFx0aG9yaXpvbnRhbFNjcm9sbGluZzogZmFsc2UsXG5cdFx0XHRvdmVycmlkZVN0eWxlczoge1xuXHRcdFx0XHRsaXN0QmFja2dyb3VuZDogZWRpdG9yQmFja2dyb3VuZFxuXHRcdFx0fSxcblx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjogbmV3IGNsYXNzIGltcGxlbWVudHMgSUxpc3RBY2Nlc3NpYmlsaXR5UHJvdmlkZXI8SVJ1bnRpbWVFeHRlbnNpb24+IHtcblx0XHRcdFx0Z2V0V2lkZ2V0QXJpYUxhYmVsKCk6IHN0cmluZyB7XG5cdFx0XHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgncnVudGltZUV4dGVuc2lvbnMnLCBcIlJ1bnRpbWUgRXh0ZW5zaW9uc1wiKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRnZXRBcmlhTGFiZWwoZWxlbWVudDogSVJ1bnRpbWVFeHRlbnNpb24pOiBzdHJpbmcgfCBudWxsIHtcblx0XHRcdFx0XHRyZXR1cm4gZWxlbWVudC5kZXNjcmlwdGlvbi5uYW1lO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9saXN0LnNwbGljZSgwLCB0aGlzLl9saXN0Lmxlbmd0aCwgdGhpcy5fZWxlbWVudHMgfHwgdW5kZWZpbmVkKTtcblxuXHRcdHRoaXMuX2xpc3Qub25Db250ZXh0TWVudSgoZSkgPT4ge1xuXHRcdFx0aWYgKCFlLmVsZW1lbnQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBhY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblxuXHRcdFx0YWN0aW9ucy5wdXNoKG5ldyBBY3Rpb24oXG5cdFx0XHRcdCdydW50aW1lRXh0ZW5zaW9uc0VkaXRvci5hY3Rpb24uY29weUlkJyxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdjb3B5IGlkJywgXCJDb3B5IGlkICh7MH0pXCIsIGUuZWxlbWVudC5kZXNjcmlwdGlvbi5pZGVudGlmaWVyLnZhbHVlKSxcblx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHR0cnVlLFxuXHRcdFx0XHQoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fY2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQoZS5lbGVtZW50IS5kZXNjcmlwdGlvbi5pZGVudGlmaWVyLnZhbHVlKTtcblx0XHRcdFx0fVxuXHRcdFx0KSk7XG5cblx0XHRcdGNvbnN0IHJlcG9ydEV4dGVuc2lvbklzc3VlQWN0aW9uID0gdGhpcy5fY3JlYXRlUmVwb3J0RXh0ZW5zaW9uSXNzdWVBY3Rpb24oZS5lbGVtZW50KTtcblx0XHRcdGlmIChyZXBvcnRFeHRlbnNpb25Jc3N1ZUFjdGlvbikge1xuXHRcdFx0XHRhY3Rpb25zLnB1c2gocmVwb3J0RXh0ZW5zaW9uSXNzdWVBY3Rpb24pO1xuXHRcdFx0fVxuXHRcdFx0YWN0aW9ucy5wdXNoKG5ldyBTZXBhcmF0b3IoKSk7XG5cblx0XHRcdGlmIChlLmVsZW1lbnQubWFya2V0cGxhY2VJbmZvKSB7XG5cdFx0XHRcdGFjdGlvbnMucHVzaChuZXcgQWN0aW9uKCdydW50aW1lRXh0ZW5zaW9uc0VkaXRvci5hY3Rpb24uZGlzYWJsZVdvcmtzcGFjZScsIG5scy5sb2NhbGl6ZSgnZGlzYWJsZSB3b3Jrc3BhY2UnLCBcIkRpc2FibGUgKFdvcmtzcGFjZSlcIiksIHVuZGVmaW5lZCwgdHJ1ZSwgKCkgPT4gdGhpcy5fZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uuc2V0RW5hYmxlbWVudChlLmVsZW1lbnQhLm1hcmtldHBsYWNlSW5mbyEsIEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZFdvcmtzcGFjZSkpKTtcblx0XHRcdFx0YWN0aW9ucy5wdXNoKG5ldyBBY3Rpb24oJ3J1bnRpbWVFeHRlbnNpb25zRWRpdG9yLmFjdGlvbi5kaXNhYmxlJywgbmxzLmxvY2FsaXplKCdkaXNhYmxlJywgXCJEaXNhYmxlXCIpLCB1bmRlZmluZWQsIHRydWUsICgpID0+IHRoaXMuX2V4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnNldEVuYWJsZW1lbnQoZS5lbGVtZW50IS5tYXJrZXRwbGFjZUluZm8hLCBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRHbG9iYWxseSkpKTtcblx0XHRcdH1cblx0XHRcdGFjdGlvbnMucHVzaChuZXcgU2VwYXJhdG9yKCkpO1xuXG5cdFx0XHRjb25zdCBtZW51QWN0aW9ucyA9IHRoaXMuX21lbnVTZXJ2aWNlLmdldE1lbnVBY3Rpb25zKE1lbnVJZC5FeHRlbnNpb25FZGl0b3JDb250ZXh0TWVudSwgdGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0XHRhY3Rpb25zLnB1c2goLi4uZ2V0Q29udGV4dE1lbnVBY3Rpb25zKG1lbnVBY3Rpb25zLCkuc2Vjb25kYXJ5KTtcblxuXHRcdFx0dGhpcy5fY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRcdGdldEFuY2hvcjogKCkgPT4gZS5hbmNob3IsXG5cdFx0XHRcdGdldEFjdGlvbnM6ICgpID0+IGFjdGlvbnNcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGxheW91dChkaW1lbnNpb246IERpbWVuc2lvbik6IHZvaWQge1xuXHRcdHRoaXMuX2xpc3Q/LmxheW91dChkaW1lbnNpb24uaGVpZ2h0KTtcblx0fVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBfZ2V0UHJvZmlsZUluZm8oKTogSUV4dGVuc2lvbkhvc3RQcm9maWxlIHwgbnVsbDtcblx0cHJvdGVjdGVkIGFic3RyYWN0IF9nZXRVbnJlc3BvbnNpdmVQcm9maWxlKGV4dGVuc2lvbklkOiBFeHRlbnNpb25JZGVudGlmaWVyKTogSUV4dGVuc2lvbkhvc3RQcm9maWxlIHwgdW5kZWZpbmVkO1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgX2NyZWF0ZVNsb3dFeHRlbnNpb25BY3Rpb24oZWxlbWVudDogSVJ1bnRpbWVFeHRlbnNpb24pOiBBY3Rpb24gfCBudWxsO1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgX2NyZWF0ZVJlcG9ydEV4dGVuc2lvbklzc3VlQWN0aW9uKGVsZW1lbnQ6IElSdW50aW1lRXh0ZW5zaW9uKTogQWN0aW9uIHwgbnVsbDtcbn1cblxuZXhwb3J0IGNsYXNzIFNob3dSdW50aW1lRXh0ZW5zaW9uc0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5zaG93UnVudGltZUV4dGVuc2lvbnMnLFxuXHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3Nob3dSdW50aW1lRXh0ZW5zaW9ucycsIFwiU2hvdyBSdW5uaW5nIEV4dGVuc2lvbnNcIiksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5EZXZlbG9wZXIsXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3Q29udGFpbmVyVGl0bGUsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlld0NvbnRhaW5lcicsICd3b3JrYmVuY2gudmlldy5leHRlbnNpb25zJyksXG5cdFx0XHRcdGdyb3VwOiAnMl9lbmFibGVtZW50Jyxcblx0XHRcdFx0b3JkZXI6IDNcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSkub3BlbkVkaXRvcihSdW50aW1lRXh0ZW5zaW9uc0lucHV0Lmluc3RhbmNlLCB7IHBpbm5lZDogdHJ1ZSB9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLEdBQWMsdUJBQXVCLFFBQVEsaUJBQWlCO0FBQ3ZFLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsNEJBQTRCO0FBR3JDLFNBQVMsUUFBaUIsaUJBQWlCO0FBQzNDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsZUFBZTtBQUN4QixTQUFzQixlQUFlO0FBQ3JDLFNBQVMsZUFBZTtBQUN4QixZQUFZLFNBQVM7QUFDckIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxTQUFTLGNBQWMsY0FBYztBQUM5QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGdCQUFnQiwwQkFBMEI7QUFDbkQsU0FBUywyQkFBMkI7QUFDcEMsU0FBOEIsOEJBQXFEO0FBQ25GLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsNkJBQStDO0FBQ3hELFNBQVMscUJBQXFCO0FBQzlCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsc0JBQXNCLGdCQUFnQjtBQUMvQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGtCQUFrQjtBQUUzQixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLG9DQUFvQztBQUM3QyxTQUFTLFlBQVksMkNBQXVFO0FBQzVGLFNBQVMsaUJBQWlCLHVCQUF1QjtBQUNqRCxTQUFTLHFDQUFxQztBQUM5QyxTQUFnQyx5QkFBNEM7QUFDNUUsU0FBcUIsbUNBQW1D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
