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
import "./media/explorerviewlet.css";
import { localize, localize2 } from "../../../../nls.js";
import { mark } from "../../../../base/common/performance.js";
import { VIEWLET_ID, VIEW_ID, ExplorerViewletVisibleContext } from "../common/files.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ExplorerView } from "./views/explorerView.js";
import { EmptyView } from "./views/emptyView.js";
import { OpenEditorsView } from "./views/openEditorsView.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IContextKeyService, ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { Extensions, ViewContainerLocation, IViewDescriptorService, ViewContentGroups } from "../../../common/views.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IWorkbenchLayoutService } from "../../../services/layout/browser/layoutService.js";
import { ViewPaneContainer } from "../../../browser/parts/views/viewPaneContainer.js";
import { KeyChord, KeyMod, KeyCode } from "../../../../base/common/keyCodes.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { WorkbenchStateContext, RemoteNameContext, OpenFolderWorkspaceSupportContext } from "../../../common/contextkeys.js";
import { IsWebContext } from "../../../../platform/contextkey/common/contextkeys.js";
import { AddRootFolderAction, OpenFolderAction, OpenFileFolderAction, OpenFolderViaWorkspaceAction } from "../../../browser/actions/workspaceActions.js";
import { OpenRecentAction } from "../../../browser/actions/windowActions.js";
import { isMacintosh, isWeb } from "../../../../base/common/platform.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { isMouseEvent } from "../../../../base/browser/dom.js";
import { ILogService } from "../../../../platform/log/common/log.js";
const explorerViewIcon = registerIcon("explorer-view-icon", Codicon.files, localize("explorerViewIcon", "View icon of the explorer view."));
const openEditorsViewIcon = registerIcon("open-editors-view-icon", Codicon.book, localize("openEditorsIcon", "View icon of the open editors view."));
let ExplorerViewletViewsContribution = class extends Disposable {
  constructor(workspaceContextService, progressService) {
    super();
    this.workspaceContextService = workspaceContextService;
    progressService.withProgress({ location: ProgressLocation.Explorer }, () => workspaceContextService.getCompleteWorkspace()).finally(() => {
      this.registerViews();
      this._register(workspaceContextService.onDidChangeWorkbenchState(() => this.registerViews()));
      this._register(workspaceContextService.onDidChangeWorkspaceFolders(() => this.registerViews()));
    });
  }
  registerViews() {
    mark("code/willRegisterExplorerViews");
    const viewDescriptors = viewsRegistry.getViews(VIEW_CONTAINER);
    const viewDescriptorsToRegister = [];
    const viewDescriptorsToDeregister = [];
    const openEditorsViewDescriptor = this.createOpenEditorsViewDescriptor();
    if (!viewDescriptors.some((v) => v.id === openEditorsViewDescriptor.id)) {
      viewDescriptorsToRegister.push(openEditorsViewDescriptor);
    }
    const explorerViewDescriptor = this.createExplorerViewDescriptor();
    const registeredExplorerViewDescriptor = viewDescriptors.find((v) => v.id === explorerViewDescriptor.id);
    const emptyViewDescriptor = this.createEmptyViewDescriptor();
    const registeredEmptyViewDescriptor = viewDescriptors.find((v) => v.id === emptyViewDescriptor.id);
    if (this.workspaceContextService.getWorkbenchState() === WorkbenchState.EMPTY || this.workspaceContextService.getWorkspace().folders.length === 0) {
      if (registeredExplorerViewDescriptor) {
        viewDescriptorsToDeregister.push(registeredExplorerViewDescriptor);
      }
      if (!registeredEmptyViewDescriptor) {
        viewDescriptorsToRegister.push(emptyViewDescriptor);
      }
    } else {
      if (registeredEmptyViewDescriptor) {
        viewDescriptorsToDeregister.push(registeredEmptyViewDescriptor);
      }
      if (!registeredExplorerViewDescriptor) {
        viewDescriptorsToRegister.push(explorerViewDescriptor);
      }
    }
    if (viewDescriptorsToDeregister.length) {
      viewsRegistry.deregisterViews(viewDescriptorsToDeregister, VIEW_CONTAINER);
    }
    if (viewDescriptorsToRegister.length) {
      viewsRegistry.registerViews(viewDescriptorsToRegister, VIEW_CONTAINER);
    }
    mark("code/didRegisterExplorerViews");
  }
  createOpenEditorsViewDescriptor() {
    return {
      id: OpenEditorsView.ID,
      name: OpenEditorsView.NAME,
      ctorDescriptor: new SyncDescriptor(OpenEditorsView),
      containerIcon: openEditorsViewIcon,
      order: 0,
      canToggleVisibility: true,
      canMoveView: true,
      collapsed: false,
      hideByDefault: true,
      focusCommand: {
        id: "workbench.files.action.focusOpenEditorsView",
        keybindings: { primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyE) }
      }
    };
  }
  createEmptyViewDescriptor() {
    return {
      id: EmptyView.ID,
      name: EmptyView.NAME,
      containerIcon: explorerViewIcon,
      ctorDescriptor: new SyncDescriptor(EmptyView),
      order: 1,
      canToggleVisibility: true,
      focusCommand: {
        id: "workbench.explorer.fileView.focus"
      }
    };
  }
  createExplorerViewDescriptor() {
    return {
      id: VIEW_ID,
      name: localize2("folders", "Folders"),
      containerIcon: explorerViewIcon,
      ctorDescriptor: new SyncDescriptor(ExplorerView),
      order: 1,
      canMoveView: true,
      canToggleVisibility: false,
      focusCommand: {
        id: "workbench.explorer.fileView.focus"
      }
    };
  }
};
ExplorerViewletViewsContribution.ID = "workbench.contrib.explorerViewletViews";
ExplorerViewletViewsContribution = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, IProgressService)
], ExplorerViewletViewsContribution);
let ExplorerViewPaneContainer = class extends ViewPaneContainer {
  constructor(layoutService, telemetryService, contextService, storageService, configurationService, instantiationService, contextKeyService, themeService, contextMenuService, extensionService, viewDescriptorService, logService) {
    super(VIEWLET_ID, { mergeViewWithContainerWhenSingleView: true }, instantiationService, configurationService, layoutService, contextMenuService, telemetryService, extensionService, themeService, storageService, contextService, viewDescriptorService, logService);
    this.viewletVisibleContextKey = ExplorerViewletVisibleContext.bindTo(contextKeyService);
    this._register(this.contextService.onDidChangeWorkspaceName((e) => this.updateTitleArea()));
  }
  create(parent) {
    super.create(parent);
    parent.classList.add("explorer-viewlet");
  }
  createView(viewDescriptor, options) {
    if (viewDescriptor.id === VIEW_ID) {
      return this.instantiationService.createInstance(ExplorerView, {
        ...options,
        delegate: {
          willOpenElement: (e) => {
            if (!isMouseEvent(e)) {
              return;
            }
            const openEditorsView = this.getOpenEditorsView();
            if (openEditorsView) {
              let delay = 0;
              const config = this.configurationService.getValue();
              if (!!config.workbench?.editor?.enablePreview) {
                delay = 250;
              }
              openEditorsView.setStructuralRefreshDelay(delay);
            }
          },
          didOpenElement: (e) => {
            if (!isMouseEvent(e)) {
              return;
            }
            const openEditorsView = this.getOpenEditorsView();
            openEditorsView?.setStructuralRefreshDelay(0);
          }
        }
      });
    }
    return super.createView(viewDescriptor, options);
  }
  getExplorerView() {
    return this.getView(VIEW_ID);
  }
  getOpenEditorsView() {
    return this.getView(OpenEditorsView.ID);
  }
  setVisible(visible) {
    this.viewletVisibleContextKey.set(visible);
    super.setVisible(visible);
  }
  focus() {
    const explorerView = this.getView(VIEW_ID);
    if (explorerView && this.panes.every((p) => !p.isExpanded())) {
      explorerView.setExpanded(true);
    }
    if (explorerView?.isExpanded()) {
      explorerView.focus();
    } else {
      super.focus();
    }
  }
};
ExplorerViewPaneContainer = __decorateClass([
  __decorateParam(0, IWorkbenchLayoutService),
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IContextKeyService),
  __decorateParam(7, IThemeService),
  __decorateParam(8, IContextMenuService),
  __decorateParam(9, IExtensionService),
  __decorateParam(10, IViewDescriptorService),
  __decorateParam(11, ILogService)
], ExplorerViewPaneContainer);
const viewContainerRegistry = Registry.as(Extensions.ViewContainersRegistry);
const VIEW_CONTAINER = viewContainerRegistry.registerViewContainer({
  id: VIEWLET_ID,
  title: localize2("explore", "Explorer"),
  ctorDescriptor: new SyncDescriptor(ExplorerViewPaneContainer),
  storageId: "workbench.explorer.views.state",
  icon: explorerViewIcon,
  alwaysUseContainerInfo: true,
  hideIfEmpty: true,
  order: 0,
  openCommandActionDescriptor: {
    id: VIEWLET_ID,
    title: localize2("explore", "Explorer"),
    mnemonicTitle: localize({ key: "miViewExplorer", comment: ["&& denotes a mnemonic"] }, "&&Explorer"),
    keybindings: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyE },
    order: 0
  }
}, ViewContainerLocation.Sidebar, { isDefault: true });
const openFolder = localize("openFolder", "Open Folder");
const addAFolder = localize("addAFolder", "add a folder");
const openRecent = localize("openRecent", "Open Recent");
const addRootFolderButton = `[${openFolder}](command:${AddRootFolderAction.ID})`;
const addAFolderButton = `[${addAFolder}](command:${AddRootFolderAction.ID})`;
const openFolderButton = `[${openFolder}](command:${isMacintosh && !isWeb ? OpenFileFolderAction.ID : OpenFolderAction.ID})`;
const openFolderViaWorkspaceButton = `[${openFolder}](command:${OpenFolderViaWorkspaceAction.ID})`;
const openRecentButton = `[${openRecent}](command:${OpenRecentAction.ID})`;
const viewsRegistry = Registry.as(Extensions.ViewsRegistry);
viewsRegistry.registerViewWelcomeContent(EmptyView.ID, {
  content: localize(
    { key: "noWorkspaceHelp", comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change'] },
    "You have not yet added a folder to the workspace.\n{0}",
    addRootFolderButton
  ),
  when: ContextKeyExpr.and(
    // inside a .code-workspace
    WorkbenchStateContext.isEqualTo("workspace"),
    // unless we cannot enter or open workspaces (e.g. web serverless)
    OpenFolderWorkspaceSupportContext
  ),
  group: ViewContentGroups.Open,
  order: 1
});
viewsRegistry.registerViewWelcomeContent(EmptyView.ID, {
  content: localize(
    { key: "noFolderHelpWeb", comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change'] },
    "You have not yet opened a folder.\n{0}\n{1}",
    openFolderViaWorkspaceButton,
    openRecentButton
  ),
  when: ContextKeyExpr.and(
    // inside a .code-workspace
    WorkbenchStateContext.isEqualTo("workspace"),
    // we cannot enter workspaces (e.g. web serverless)
    OpenFolderWorkspaceSupportContext.toNegated()
  ),
  group: ViewContentGroups.Open,
  order: 1
});
viewsRegistry.registerViewWelcomeContent(EmptyView.ID, {
  content: localize(
    { key: "remoteNoFolderHelp", comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change'] },
    "Connected to remote.\n{0}",
    openFolderButton
  ),
  when: ContextKeyExpr.and(
    // not inside a .code-workspace
    WorkbenchStateContext.notEqualsTo("workspace"),
    // connected to a remote
    RemoteNameContext.notEqualsTo(""),
    // but not in web
    IsWebContext.toNegated()
  ),
  group: ViewContentGroups.Open,
  order: 1
});
viewsRegistry.registerViewWelcomeContent(EmptyView.ID, {
  content: localize(
    { key: "noFolderButEditorsHelp", comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change'] },
    "You have not yet opened a folder.\n{0}\nOpening a folder will close all currently open editors. To keep them open, {1} instead.",
    openFolderButton,
    addAFolderButton
  ),
  when: ContextKeyExpr.and(
    // editors are opened
    ContextKeyExpr.has("editorIsOpen"),
    ContextKeyExpr.or(
      // not inside a .code-workspace and local
      ContextKeyExpr.and(WorkbenchStateContext.notEqualsTo("workspace"), RemoteNameContext.isEqualTo("")),
      // not inside a .code-workspace and web
      ContextKeyExpr.and(WorkbenchStateContext.notEqualsTo("workspace"), IsWebContext)
    )
  ),
  group: ViewContentGroups.Open,
  order: 1
});
viewsRegistry.registerViewWelcomeContent(EmptyView.ID, {
  content: localize(
    { key: "noFolderHelp", comment: ['Please do not translate the word "command", it is part of our internal syntax which must not change'] },
    "You have not yet opened a folder.\n{0}",
    openFolderButton
  ),
  when: ContextKeyExpr.and(
    // no editor is open
    ContextKeyExpr.has("editorIsOpen")?.negate(),
    ContextKeyExpr.or(
      // not inside a .code-workspace and local
      ContextKeyExpr.and(WorkbenchStateContext.notEqualsTo("workspace"), RemoteNameContext.isEqualTo("")),
      // not inside a .code-workspace and web
      ContextKeyExpr.and(WorkbenchStateContext.notEqualsTo("workspace"), IsWebContext)
    )
  ),
  group: ViewContentGroups.Open,
  order: 1
});
export {
  ExplorerViewPaneContainer,
  ExplorerViewletViewsContribution,
  VIEW_CONTAINER
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy9icm93c2VyL2V4cGxvcmVyVmlld2xldC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9tZWRpYS9leHBsb3JlcnZpZXdsZXQuY3NzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgbWFyayB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BlcmZvcm1hbmNlLmpzJztcbmltcG9ydCB7IFZJRVdMRVRfSUQsIFZJRVdfSUQsIElGaWxlc0NvbmZpZ3VyYXRpb24sIEV4cGxvcmVyVmlld2xldFZpc2libGVDb250ZXh0IH0gZnJvbSAnLi4vY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElWaWV3bGV0Vmlld09wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL3ZpZXdzL3ZpZXdzVmlld2xldC5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEV4cGxvcmVyVmlldyB9IGZyb20gJy4vdmlld3MvZXhwbG9yZXJWaWV3LmpzJztcbmltcG9ydCB7IEVtcHR5VmlldyB9IGZyb20gJy4vdmlld3MvZW1wdHlWaWV3LmpzJztcbmltcG9ydCB7IE9wZW5FZGl0b3JzVmlldyB9IGZyb20gJy4vdmlld3Mvb3BlbkVkaXRvcnNWaWV3LmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBXb3JrYmVuY2hTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlLCBJQ29udGV4dEtleSwgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElWaWV3c1JlZ2lzdHJ5LCBJVmlld0Rlc2NyaXB0b3IsIEV4dGVuc2lvbnMsIFZpZXdDb250YWluZXIsIElWaWV3Q29udGFpbmVyc1JlZ2lzdHJ5LCBWaWV3Q29udGFpbmVyTG9jYXRpb24sIElWaWV3RGVzY3JpcHRvclNlcnZpY2UsIFZpZXdDb250ZW50R3JvdXBzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBWaWV3UGFuZUNvbnRhaW5lciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmVDb250YWluZXIuanMnO1xuaW1wb3J0IHsgVmlld1BhbmUgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL3BhcnRzL3ZpZXdzL3ZpZXdQYW5lLmpzJztcbmltcG9ydCB7IEtleUNob3JkLCBLZXlNb2QsIEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJUHJvZ3Jlc3NTZXJ2aWNlLCBQcm9ncmVzc0xvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoU3RhdGVDb250ZXh0LCBSZW1vdGVOYW1lQ29udGV4dCwgT3BlbkZvbGRlcldvcmtzcGFjZVN1cHBvcnRDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IElzV2ViQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IEFkZFJvb3RGb2xkZXJBY3Rpb24sIE9wZW5Gb2xkZXJBY3Rpb24sIE9wZW5GaWxlRm9sZGVyQWN0aW9uLCBPcGVuRm9sZGVyVmlhV29ya3NwYWNlQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9hY3Rpb25zL3dvcmtzcGFjZUFjdGlvbnMuanMnO1xuaW1wb3J0IHsgT3BlblJlY2VudEFjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvYWN0aW9ucy93aW5kb3dBY3Rpb25zLmpzJztcbmltcG9ydCB7IGlzTWFjaW50b3NoLCBpc1dlYiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyByZWdpc3Rlckljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGlzTW91c2VFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5cbmNvbnN0IGV4cGxvcmVyVmlld0ljb24gPSByZWdpc3Rlckljb24oJ2V4cGxvcmVyLXZpZXctaWNvbicsIENvZGljb24uZmlsZXMsIGxvY2FsaXplKCdleHBsb3JlclZpZXdJY29uJywgJ1ZpZXcgaWNvbiBvZiB0aGUgZXhwbG9yZXIgdmlldy4nKSk7XG5jb25zdCBvcGVuRWRpdG9yc1ZpZXdJY29uID0gcmVnaXN0ZXJJY29uKCdvcGVuLWVkaXRvcnMtdmlldy1pY29uJywgQ29kaWNvbi5ib29rLCBsb2NhbGl6ZSgnb3BlbkVkaXRvcnNJY29uJywgJ1ZpZXcgaWNvbiBvZiB0aGUgb3BlbiBlZGl0b3JzIHZpZXcuJykpO1xuXG5leHBvcnQgY2xhc3MgRXhwbG9yZXJWaWV3bGV0Vmlld3NDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLmV4cGxvcmVyVmlld2xldFZpZXdzJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASVByb2dyZXNzU2VydmljZSBwcm9ncmVzc1NlcnZpY2U6IElQcm9ncmVzc1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3MoeyBsb2NhdGlvbjogUHJvZ3Jlc3NMb2NhdGlvbi5FeHBsb3JlciB9LCAoKSA9PiB3b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRDb21wbGV0ZVdvcmtzcGFjZSgpKS5maW5hbGx5KCgpID0+IHtcblx0XHRcdHRoaXMucmVnaXN0ZXJWaWV3cygpO1xuXG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih3b3Jrc3BhY2VDb250ZXh0U2VydmljZS5vbkRpZENoYW5nZVdvcmtiZW5jaFN0YXRlKCgpID0+IHRoaXMucmVnaXN0ZXJWaWV3cygpKSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih3b3Jrc3BhY2VDb250ZXh0U2VydmljZS5vbkRpZENoYW5nZVdvcmtzcGFjZUZvbGRlcnMoKCkgPT4gdGhpcy5yZWdpc3RlclZpZXdzKCkpKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJWaWV3cygpOiB2b2lkIHtcblx0XHRtYXJrKCdjb2RlL3dpbGxSZWdpc3RlckV4cGxvcmVyVmlld3MnKTtcblxuXHRcdGNvbnN0IHZpZXdEZXNjcmlwdG9ycyA9IHZpZXdzUmVnaXN0cnkuZ2V0Vmlld3MoVklFV19DT05UQUlORVIpO1xuXG5cdFx0Y29uc3Qgdmlld0Rlc2NyaXB0b3JzVG9SZWdpc3RlcjogSVZpZXdEZXNjcmlwdG9yW10gPSBbXTtcblx0XHRjb25zdCB2aWV3RGVzY3JpcHRvcnNUb0RlcmVnaXN0ZXI6IElWaWV3RGVzY3JpcHRvcltdID0gW107XG5cblx0XHRjb25zdCBvcGVuRWRpdG9yc1ZpZXdEZXNjcmlwdG9yID0gdGhpcy5jcmVhdGVPcGVuRWRpdG9yc1ZpZXdEZXNjcmlwdG9yKCk7XG5cdFx0aWYgKCF2aWV3RGVzY3JpcHRvcnMuc29tZSh2ID0+IHYuaWQgPT09IG9wZW5FZGl0b3JzVmlld0Rlc2NyaXB0b3IuaWQpKSB7XG5cdFx0XHR2aWV3RGVzY3JpcHRvcnNUb1JlZ2lzdGVyLnB1c2gob3BlbkVkaXRvcnNWaWV3RGVzY3JpcHRvcik7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZXhwbG9yZXJWaWV3RGVzY3JpcHRvciA9IHRoaXMuY3JlYXRlRXhwbG9yZXJWaWV3RGVzY3JpcHRvcigpO1xuXHRcdGNvbnN0IHJlZ2lzdGVyZWRFeHBsb3JlclZpZXdEZXNjcmlwdG9yID0gdmlld0Rlc2NyaXB0b3JzLmZpbmQodiA9PiB2LmlkID09PSBleHBsb3JlclZpZXdEZXNjcmlwdG9yLmlkKTtcblx0XHRjb25zdCBlbXB0eVZpZXdEZXNjcmlwdG9yID0gdGhpcy5jcmVhdGVFbXB0eVZpZXdEZXNjcmlwdG9yKCk7XG5cdFx0Y29uc3QgcmVnaXN0ZXJlZEVtcHR5Vmlld0Rlc2NyaXB0b3IgPSB2aWV3RGVzY3JpcHRvcnMuZmluZCh2ID0+IHYuaWQgPT09IGVtcHR5Vmlld0Rlc2NyaXB0b3IuaWQpO1xuXG5cdFx0aWYgKHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuRU1QVFkgfHwgdGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0aWYgKHJlZ2lzdGVyZWRFeHBsb3JlclZpZXdEZXNjcmlwdG9yKSB7XG5cdFx0XHRcdHZpZXdEZXNjcmlwdG9yc1RvRGVyZWdpc3Rlci5wdXNoKHJlZ2lzdGVyZWRFeHBsb3JlclZpZXdEZXNjcmlwdG9yKTtcblx0XHRcdH1cblx0XHRcdGlmICghcmVnaXN0ZXJlZEVtcHR5Vmlld0Rlc2NyaXB0b3IpIHtcblx0XHRcdFx0dmlld0Rlc2NyaXB0b3JzVG9SZWdpc3Rlci5wdXNoKGVtcHR5Vmlld0Rlc2NyaXB0b3IpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAocmVnaXN0ZXJlZEVtcHR5Vmlld0Rlc2NyaXB0b3IpIHtcblx0XHRcdFx0dmlld0Rlc2NyaXB0b3JzVG9EZXJlZ2lzdGVyLnB1c2gocmVnaXN0ZXJlZEVtcHR5Vmlld0Rlc2NyaXB0b3IpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFyZWdpc3RlcmVkRXhwbG9yZXJWaWV3RGVzY3JpcHRvcikge1xuXHRcdFx0XHR2aWV3RGVzY3JpcHRvcnNUb1JlZ2lzdGVyLnB1c2goZXhwbG9yZXJWaWV3RGVzY3JpcHRvcik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHZpZXdEZXNjcmlwdG9yc1RvRGVyZWdpc3Rlci5sZW5ndGgpIHtcblx0XHRcdHZpZXdzUmVnaXN0cnkuZGVyZWdpc3RlclZpZXdzKHZpZXdEZXNjcmlwdG9yc1RvRGVyZWdpc3RlciwgVklFV19DT05UQUlORVIpO1xuXHRcdH1cblx0XHRpZiAodmlld0Rlc2NyaXB0b3JzVG9SZWdpc3Rlci5sZW5ndGgpIHtcblx0XHRcdHZpZXdzUmVnaXN0cnkucmVnaXN0ZXJWaWV3cyh2aWV3RGVzY3JpcHRvcnNUb1JlZ2lzdGVyLCBWSUVXX0NPTlRBSU5FUik7XG5cdFx0fVxuXG5cdFx0bWFyaygnY29kZS9kaWRSZWdpc3RlckV4cGxvcmVyVmlld3MnKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlT3BlbkVkaXRvcnNWaWV3RGVzY3JpcHRvcigpOiBJVmlld0Rlc2NyaXB0b3Ige1xuXHRcdHJldHVybiB7XG5cdFx0XHRpZDogT3BlbkVkaXRvcnNWaWV3LklELFxuXHRcdFx0bmFtZTogT3BlbkVkaXRvcnNWaWV3Lk5BTUUsXG5cdFx0XHRjdG9yRGVzY3JpcHRvcjogbmV3IFN5bmNEZXNjcmlwdG9yKE9wZW5FZGl0b3JzVmlldyksXG5cdFx0XHRjb250YWluZXJJY29uOiBvcGVuRWRpdG9yc1ZpZXdJY29uLFxuXHRcdFx0b3JkZXI6IDAsXG5cdFx0XHRjYW5Ub2dnbGVWaXNpYmlsaXR5OiB0cnVlLFxuXHRcdFx0Y2FuTW92ZVZpZXc6IHRydWUsXG5cdFx0XHRjb2xsYXBzZWQ6IGZhbHNlLFxuXHRcdFx0aGlkZUJ5RGVmYXVsdDogdHJ1ZSxcblx0XHRcdGZvY3VzQ29tbWFuZDoge1xuXHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5maWxlcy5hY3Rpb24uZm9jdXNPcGVuRWRpdG9yc1ZpZXcnLFxuXHRcdFx0XHRrZXliaW5kaW5nczogeyBwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5Q29kZS5LZXlFKSB9XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlRW1wdHlWaWV3RGVzY3JpcHRvcigpOiBJVmlld0Rlc2NyaXB0b3Ige1xuXHRcdHJldHVybiB7XG5cdFx0XHRpZDogRW1wdHlWaWV3LklELFxuXHRcdFx0bmFtZTogRW1wdHlWaWV3Lk5BTUUsXG5cdFx0XHRjb250YWluZXJJY29uOiBleHBsb3JlclZpZXdJY29uLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihFbXB0eVZpZXcpLFxuXHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRjYW5Ub2dnbGVWaXNpYmlsaXR5OiB0cnVlLFxuXHRcdFx0Zm9jdXNDb21tYW5kOiB7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmV4cGxvcmVyLmZpbGVWaWV3LmZvY3VzJ1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUV4cGxvcmVyVmlld0Rlc2NyaXB0b3IoKTogSVZpZXdEZXNjcmlwdG9yIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aWQ6IFZJRVdfSUQsXG5cdFx0XHRuYW1lOiBsb2NhbGl6ZTIoJ2ZvbGRlcnMnLCBcIkZvbGRlcnNcIiksXG5cdFx0XHRjb250YWluZXJJY29uOiBleHBsb3JlclZpZXdJY29uLFxuXHRcdFx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihFeHBsb3JlclZpZXcpLFxuXHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRjYW5Nb3ZlVmlldzogdHJ1ZSxcblx0XHRcdGNhblRvZ2dsZVZpc2liaWxpdHk6IGZhbHNlLFxuXHRcdFx0Zm9jdXNDb21tYW5kOiB7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmV4cGxvcmVyLmZpbGVWaWV3LmZvY3VzJ1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4cGxvcmVyVmlld1BhbmVDb250YWluZXIgZXh0ZW5kcyBWaWV3UGFuZUNvbnRhaW5lciB7XG5cblx0cHJpdmF0ZSB2aWV3bGV0VmlzaWJsZUNvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJV29ya2JlbmNoTGF5b3V0U2VydmljZSBsYXlvdXRTZXJ2aWNlOiBJV29ya2JlbmNoTGF5b3V0U2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2Ugc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASVZpZXdEZXNjcmlwdG9yU2VydmljZSB2aWV3RGVzY3JpcHRvclNlcnZpY2U6IElWaWV3RGVzY3JpcHRvclNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblxuXHRcdHN1cGVyKFZJRVdMRVRfSUQsIHsgbWVyZ2VWaWV3V2l0aENvbnRhaW5lcldoZW5TaW5nbGVWaWV3OiB0cnVlIH0sIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgbGF5b3V0U2VydmljZSwgY29udGV4dE1lbnVTZXJ2aWNlLCB0ZWxlbWV0cnlTZXJ2aWNlLCBleHRlbnNpb25TZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlLCBjb250ZXh0U2VydmljZSwgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBsb2dTZXJ2aWNlKTtcblxuXHRcdHRoaXMudmlld2xldFZpc2libGVDb250ZXh0S2V5ID0gRXhwbG9yZXJWaWV3bGV0VmlzaWJsZUNvbnRleHQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbnRleHRTZXJ2aWNlLm9uRGlkQ2hhbmdlV29ya3NwYWNlTmFtZShlID0+IHRoaXMudXBkYXRlVGl0bGVBcmVhKCkpKTtcblx0fVxuXG5cdG92ZXJyaWRlIGNyZWF0ZShwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIuY3JlYXRlKHBhcmVudCk7XG5cdFx0cGFyZW50LmNsYXNzTGlzdC5hZGQoJ2V4cGxvcmVyLXZpZXdsZXQnKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBjcmVhdGVWaWV3KHZpZXdEZXNjcmlwdG9yOiBJVmlld0Rlc2NyaXB0b3IsIG9wdGlvbnM6IElWaWV3bGV0Vmlld09wdGlvbnMpOiBWaWV3UGFuZSB7XG5cdFx0aWYgKHZpZXdEZXNjcmlwdG9yLmlkID09PSBWSUVXX0lEKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeHBsb3JlclZpZXcsIHtcblx0XHRcdFx0Li4ub3B0aW9ucywgZGVsZWdhdGU6IHtcblx0XHRcdFx0XHR3aWxsT3BlbkVsZW1lbnQ6IGUgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKCFpc01vdXNlRXZlbnQoZSkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuOyAvLyBvbmx5IGRlbGF5IHdoZW4gdXNlciBjbGlja3Ncblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Y29uc3Qgb3BlbkVkaXRvcnNWaWV3ID0gdGhpcy5nZXRPcGVuRWRpdG9yc1ZpZXcoKTtcblx0XHRcdFx0XHRcdGlmIChvcGVuRWRpdG9yc1ZpZXcpIHtcblx0XHRcdFx0XHRcdFx0bGV0IGRlbGF5ID0gMDtcblxuXHRcdFx0XHRcdFx0XHRjb25zdCBjb25maWcgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElGaWxlc0NvbmZpZ3VyYXRpb24+KCk7XG5cdFx0XHRcdFx0XHRcdGlmICghIWNvbmZpZy53b3JrYmVuY2g/LmVkaXRvcj8uZW5hYmxlUHJldmlldykge1xuXHRcdFx0XHRcdFx0XHRcdC8vIGRlbGF5IG9wZW4gZWRpdG9ycyB2aWV3IHdoZW4gcHJldmlldyBpcyBlbmFibGVkXG5cdFx0XHRcdFx0XHRcdFx0Ly8gdG8gYWNjb21vZGF0ZSBmb3IgdGhlIHVzZXIgZG9pbmcgYSBkb3VibGUgY2xpY2tcblx0XHRcdFx0XHRcdFx0XHQvLyB0byBwaW4gdGhlIGVkaXRvci5cblx0XHRcdFx0XHRcdFx0XHQvLyB3aXRob3V0IHRoaXMgZGVsYXkgYSBkb3VibGUgY2xpY2sgd291bGQgYmUgbm90XG5cdFx0XHRcdFx0XHRcdFx0Ly8gcG9zc2libGUgYmVjYXVzZSB0aGUgbmV4dCBlbGVtZW50IHdvdWxkIG1vdmVcblx0XHRcdFx0XHRcdFx0XHQvLyB1bmRlciB0aGUgbW91c2UgYWZ0ZXIgdGhlIGZpcnN0IGNsaWNrLlxuXHRcdFx0XHRcdFx0XHRcdGRlbGF5ID0gMjUwO1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0b3BlbkVkaXRvcnNWaWV3LnNldFN0cnVjdHVyYWxSZWZyZXNoRGVsYXkoZGVsYXkpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0ZGlkT3BlbkVsZW1lbnQ6IGUgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKCFpc01vdXNlRXZlbnQoZSkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuOyAvLyBvbmx5IGRlbGF5IHdoZW4gdXNlciBjbGlja3Ncblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Y29uc3Qgb3BlbkVkaXRvcnNWaWV3ID0gdGhpcy5nZXRPcGVuRWRpdG9yc1ZpZXcoKTtcblx0XHRcdFx0XHRcdG9wZW5FZGl0b3JzVmlldz8uc2V0U3RydWN0dXJhbFJlZnJlc2hEZWxheSgwKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gc3VwZXIuY3JlYXRlVmlldyh2aWV3RGVzY3JpcHRvciwgb3B0aW9ucyk7XG5cdH1cblxuXHRnZXRFeHBsb3JlclZpZXcoKTogRXhwbG9yZXJWaWV3IHtcblx0XHRyZXR1cm4gPEV4cGxvcmVyVmlldz50aGlzLmdldFZpZXcoVklFV19JRCk7XG5cdH1cblxuXHRnZXRPcGVuRWRpdG9yc1ZpZXcoKTogT3BlbkVkaXRvcnNWaWV3IHtcblx0XHRyZXR1cm4gPE9wZW5FZGl0b3JzVmlldz50aGlzLmdldFZpZXcoT3BlbkVkaXRvcnNWaWV3LklEKTtcblx0fVxuXG5cdG92ZXJyaWRlIHNldFZpc2libGUodmlzaWJsZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMudmlld2xldFZpc2libGVDb250ZXh0S2V5LnNldCh2aXNpYmxlKTtcblx0XHRzdXBlci5zZXRWaXNpYmxlKHZpc2libGUpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZm9jdXMoKTogdm9pZCB7XG5cdFx0Y29uc3QgZXhwbG9yZXJWaWV3ID0gdGhpcy5nZXRWaWV3KFZJRVdfSUQpO1xuXHRcdGlmIChleHBsb3JlclZpZXcgJiYgdGhpcy5wYW5lcy5ldmVyeShwID0+ICFwLmlzRXhwYW5kZWQoKSkpIHtcblx0XHRcdGV4cGxvcmVyVmlldy5zZXRFeHBhbmRlZCh0cnVlKTtcblx0XHR9XG5cdFx0aWYgKGV4cGxvcmVyVmlldz8uaXNFeHBhbmRlZCgpKSB7XG5cdFx0XHRleHBsb3JlclZpZXcuZm9jdXMoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0c3VwZXIuZm9jdXMoKTtcblx0XHR9XG5cdH1cbn1cblxuY29uc3Qgdmlld0NvbnRhaW5lclJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVZpZXdDb250YWluZXJzUmVnaXN0cnk+KEV4dGVuc2lvbnMuVmlld0NvbnRhaW5lcnNSZWdpc3RyeSk7XG5cbi8qKlxuICogRXhwbG9yZXIgdmlld2xldCBjb250YWluZXIuXG4gKi9cbmV4cG9ydCBjb25zdCBWSUVXX0NPTlRBSU5FUjogVmlld0NvbnRhaW5lciA9IHZpZXdDb250YWluZXJSZWdpc3RyeS5yZWdpc3RlclZpZXdDb250YWluZXIoe1xuXHRpZDogVklFV0xFVF9JRCxcblx0dGl0bGU6IGxvY2FsaXplMignZXhwbG9yZScsIFwiRXhwbG9yZXJcIiksXG5cdGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoRXhwbG9yZXJWaWV3UGFuZUNvbnRhaW5lciksXG5cdHN0b3JhZ2VJZDogJ3dvcmtiZW5jaC5leHBsb3Jlci52aWV3cy5zdGF0ZScsXG5cdGljb246IGV4cGxvcmVyVmlld0ljb24sXG5cdGFsd2F5c1VzZUNvbnRhaW5lckluZm86IHRydWUsXG5cdGhpZGVJZkVtcHR5OiB0cnVlLFxuXHRvcmRlcjogMCxcblx0b3BlbkNvbW1hbmRBY3Rpb25EZXNjcmlwdG9yOiB7XG5cdFx0aWQ6IFZJRVdMRVRfSUQsXG5cdFx0dGl0bGU6IGxvY2FsaXplMignZXhwbG9yZScsIFwiRXhwbG9yZXJcIiksXG5cdFx0bW5lbW9uaWNUaXRsZTogbG9jYWxpemUoeyBrZXk6ICdtaVZpZXdFeHBsb3JlcicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkV4cGxvcmVyXCIpLFxuXHRcdGtleWJpbmRpbmdzOiB7IHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5LZXlFIH0sXG5cdFx0b3JkZXI6IDBcblx0fSxcbn0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyLCB7IGlzRGVmYXVsdDogdHJ1ZSB9KTtcblxuY29uc3Qgb3BlbkZvbGRlciA9IGxvY2FsaXplKCdvcGVuRm9sZGVyJywgXCJPcGVuIEZvbGRlclwiKTtcbmNvbnN0IGFkZEFGb2xkZXIgPSBsb2NhbGl6ZSgnYWRkQUZvbGRlcicsIFwiYWRkIGEgZm9sZGVyXCIpO1xuY29uc3Qgb3BlblJlY2VudCA9IGxvY2FsaXplKCdvcGVuUmVjZW50JywgXCJPcGVuIFJlY2VudFwiKTtcblxuY29uc3QgYWRkUm9vdEZvbGRlckJ1dHRvbiA9IGBbJHtvcGVuRm9sZGVyfV0oY29tbWFuZDoke0FkZFJvb3RGb2xkZXJBY3Rpb24uSUR9KWA7XG5jb25zdCBhZGRBRm9sZGVyQnV0dG9uID0gYFske2FkZEFGb2xkZXJ9XShjb21tYW5kOiR7QWRkUm9vdEZvbGRlckFjdGlvbi5JRH0pYDtcbmNvbnN0IG9wZW5Gb2xkZXJCdXR0b24gPSBgWyR7b3BlbkZvbGRlcn1dKGNvbW1hbmQ6JHsoaXNNYWNpbnRvc2ggJiYgIWlzV2ViKSA/IE9wZW5GaWxlRm9sZGVyQWN0aW9uLklEIDogT3BlbkZvbGRlckFjdGlvbi5JRH0pYDtcbmNvbnN0IG9wZW5Gb2xkZXJWaWFXb3Jrc3BhY2VCdXR0b24gPSBgWyR7b3BlbkZvbGRlcn1dKGNvbW1hbmQ6JHtPcGVuRm9sZGVyVmlhV29ya3NwYWNlQWN0aW9uLklEfSlgO1xuY29uc3Qgb3BlblJlY2VudEJ1dHRvbiA9IGBbJHtvcGVuUmVjZW50fV0oY29tbWFuZDoke09wZW5SZWNlbnRBY3Rpb24uSUR9KWA7XG5cbmNvbnN0IHZpZXdzUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJVmlld3NSZWdpc3RyeT4oRXh0ZW5zaW9ucy5WaWV3c1JlZ2lzdHJ5KTtcbnZpZXdzUmVnaXN0cnkucmVnaXN0ZXJWaWV3V2VsY29tZUNvbnRlbnQoRW1wdHlWaWV3LklELCB7XG5cdGNvbnRlbnQ6IGxvY2FsaXplKHsga2V5OiAnbm9Xb3Jrc3BhY2VIZWxwJywgY29tbWVudDogWydQbGVhc2UgZG8gbm90IHRyYW5zbGF0ZSB0aGUgd29yZCBcImNvbW1hbmRcIiwgaXQgaXMgcGFydCBvZiBvdXIgaW50ZXJuYWwgc3ludGF4IHdoaWNoIG11c3Qgbm90IGNoYW5nZSddIH0sXG5cdFx0XCJZb3UgaGF2ZSBub3QgeWV0IGFkZGVkIGEgZm9sZGVyIHRvIHRoZSB3b3Jrc3BhY2UuXFxuezB9XCIsIGFkZFJvb3RGb2xkZXJCdXR0b24pLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0Ly8gaW5zaWRlIGEgLmNvZGUtd29ya3NwYWNlXG5cdFx0V29ya2JlbmNoU3RhdGVDb250ZXh0LmlzRXF1YWxUbygnd29ya3NwYWNlJyksXG5cdFx0Ly8gdW5sZXNzIHdlIGNhbm5vdCBlbnRlciBvciBvcGVuIHdvcmtzcGFjZXMgKGUuZy4gd2ViIHNlcnZlcmxlc3MpXG5cdFx0T3BlbkZvbGRlcldvcmtzcGFjZVN1cHBvcnRDb250ZXh0XG5cdCksXG5cdGdyb3VwOiBWaWV3Q29udGVudEdyb3Vwcy5PcGVuLFxuXHRvcmRlcjogMVxufSk7XG5cbnZpZXdzUmVnaXN0cnkucmVnaXN0ZXJWaWV3V2VsY29tZUNvbnRlbnQoRW1wdHlWaWV3LklELCB7XG5cdGNvbnRlbnQ6IGxvY2FsaXplKHsga2V5OiAnbm9Gb2xkZXJIZWxwV2ViJywgY29tbWVudDogWydQbGVhc2UgZG8gbm90IHRyYW5zbGF0ZSB0aGUgd29yZCBcImNvbW1hbmRcIiwgaXQgaXMgcGFydCBvZiBvdXIgaW50ZXJuYWwgc3ludGF4IHdoaWNoIG11c3Qgbm90IGNoYW5nZSddIH0sXG5cdFx0XCJZb3UgaGF2ZSBub3QgeWV0IG9wZW5lZCBhIGZvbGRlci5cXG57MH1cXG57MX1cIiwgb3BlbkZvbGRlclZpYVdvcmtzcGFjZUJ1dHRvbiwgb3BlblJlY2VudEJ1dHRvbiksXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHQvLyBpbnNpZGUgYSAuY29kZS13b3Jrc3BhY2Vcblx0XHRXb3JrYmVuY2hTdGF0ZUNvbnRleHQuaXNFcXVhbFRvKCd3b3Jrc3BhY2UnKSxcblx0XHQvLyB3ZSBjYW5ub3QgZW50ZXIgd29ya3NwYWNlcyAoZS5nLiB3ZWIgc2VydmVybGVzcylcblx0XHRPcGVuRm9sZGVyV29ya3NwYWNlU3VwcG9ydENvbnRleHQudG9OZWdhdGVkKClcblx0KSxcblx0Z3JvdXA6IFZpZXdDb250ZW50R3JvdXBzLk9wZW4sXG5cdG9yZGVyOiAxXG59KTtcblxudmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdXZWxjb21lQ29udGVudChFbXB0eVZpZXcuSUQsIHtcblx0Y29udGVudDogbG9jYWxpemUoeyBrZXk6ICdyZW1vdGVOb0ZvbGRlckhlbHAnLCBjb21tZW50OiBbJ1BsZWFzZSBkbyBub3QgdHJhbnNsYXRlIHRoZSB3b3JkIFwiY29tbWFuZFwiLCBpdCBpcyBwYXJ0IG9mIG91ciBpbnRlcm5hbCBzeW50YXggd2hpY2ggbXVzdCBub3QgY2hhbmdlJ10gfSxcblx0XHRcIkNvbm5lY3RlZCB0byByZW1vdGUuXFxuezB9XCIsIG9wZW5Gb2xkZXJCdXR0b24pLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0Ly8gbm90IGluc2lkZSBhIC5jb2RlLXdvcmtzcGFjZVxuXHRcdFdvcmtiZW5jaFN0YXRlQ29udGV4dC5ub3RFcXVhbHNUbygnd29ya3NwYWNlJyksXG5cdFx0Ly8gY29ubmVjdGVkIHRvIGEgcmVtb3RlXG5cdFx0UmVtb3RlTmFtZUNvbnRleHQubm90RXF1YWxzVG8oJycpLFxuXHRcdC8vIGJ1dCBub3QgaW4gd2ViXG5cdFx0SXNXZWJDb250ZXh0LnRvTmVnYXRlZCgpKSxcblx0Z3JvdXA6IFZpZXdDb250ZW50R3JvdXBzLk9wZW4sXG5cdG9yZGVyOiAxXG59KTtcblxudmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdXZWxjb21lQ29udGVudChFbXB0eVZpZXcuSUQsIHtcblx0Y29udGVudDogbG9jYWxpemUoeyBrZXk6ICdub0ZvbGRlckJ1dEVkaXRvcnNIZWxwJywgY29tbWVudDogWydQbGVhc2UgZG8gbm90IHRyYW5zbGF0ZSB0aGUgd29yZCBcImNvbW1hbmRcIiwgaXQgaXMgcGFydCBvZiBvdXIgaW50ZXJuYWwgc3ludGF4IHdoaWNoIG11c3Qgbm90IGNoYW5nZSddIH0sXG5cdFx0XCJZb3UgaGF2ZSBub3QgeWV0IG9wZW5lZCBhIGZvbGRlci5cXG57MH1cXG5PcGVuaW5nIGEgZm9sZGVyIHdpbGwgY2xvc2UgYWxsIGN1cnJlbnRseSBvcGVuIGVkaXRvcnMuIFRvIGtlZXAgdGhlbSBvcGVuLCB7MX0gaW5zdGVhZC5cIiwgb3BlbkZvbGRlckJ1dHRvbiwgYWRkQUZvbGRlckJ1dHRvbiksXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHQvLyBlZGl0b3JzIGFyZSBvcGVuZWRcblx0XHRDb250ZXh0S2V5RXhwci5oYXMoJ2VkaXRvcklzT3BlbicpLFxuXHRcdENvbnRleHRLZXlFeHByLm9yKFxuXHRcdFx0Ly8gbm90IGluc2lkZSBhIC5jb2RlLXdvcmtzcGFjZSBhbmQgbG9jYWxcblx0XHRcdENvbnRleHRLZXlFeHByLmFuZChXb3JrYmVuY2hTdGF0ZUNvbnRleHQubm90RXF1YWxzVG8oJ3dvcmtzcGFjZScpLCBSZW1vdGVOYW1lQ29udGV4dC5pc0VxdWFsVG8oJycpKSxcblx0XHRcdC8vIG5vdCBpbnNpZGUgYSAuY29kZS13b3Jrc3BhY2UgYW5kIHdlYlxuXHRcdFx0Q29udGV4dEtleUV4cHIuYW5kKFdvcmtiZW5jaFN0YXRlQ29udGV4dC5ub3RFcXVhbHNUbygnd29ya3NwYWNlJyksIElzV2ViQ29udGV4dClcblx0XHQpXG5cdCksXG5cdGdyb3VwOiBWaWV3Q29udGVudEdyb3Vwcy5PcGVuLFxuXHRvcmRlcjogMVxufSk7XG5cbnZpZXdzUmVnaXN0cnkucmVnaXN0ZXJWaWV3V2VsY29tZUNvbnRlbnQoRW1wdHlWaWV3LklELCB7XG5cdGNvbnRlbnQ6IGxvY2FsaXplKHsga2V5OiAnbm9Gb2xkZXJIZWxwJywgY29tbWVudDogWydQbGVhc2UgZG8gbm90IHRyYW5zbGF0ZSB0aGUgd29yZCBcImNvbW1hbmRcIiwgaXQgaXMgcGFydCBvZiBvdXIgaW50ZXJuYWwgc3ludGF4IHdoaWNoIG11c3Qgbm90IGNoYW5nZSddIH0sXG5cdFx0XCJZb3UgaGF2ZSBub3QgeWV0IG9wZW5lZCBhIGZvbGRlci5cXG57MH1cIiwgb3BlbkZvbGRlckJ1dHRvbiksXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHQvLyBubyBlZGl0b3IgaXMgb3BlblxuXHRcdENvbnRleHRLZXlFeHByLmhhcygnZWRpdG9ySXNPcGVuJyk/Lm5lZ2F0ZSgpLFxuXHRcdENvbnRleHRLZXlFeHByLm9yKFxuXHRcdFx0Ly8gbm90IGluc2lkZSBhIC5jb2RlLXdvcmtzcGFjZSBhbmQgbG9jYWxcblx0XHRcdENvbnRleHRLZXlFeHByLmFuZChXb3JrYmVuY2hTdGF0ZUNvbnRleHQubm90RXF1YWxzVG8oJ3dvcmtzcGFjZScpLCBSZW1vdGVOYW1lQ29udGV4dC5pc0VxdWFsVG8oJycpKSxcblx0XHRcdC8vIG5vdCBpbnNpZGUgYSAuY29kZS13b3Jrc3BhY2UgYW5kIHdlYlxuXHRcdFx0Q29udGV4dEtleUV4cHIuYW5kKFdvcmtiZW5jaFN0YXRlQ29udGV4dC5ub3RFcXVhbHNUbygnd29ya3NwYWNlJyksIElzV2ViQ29udGV4dClcblx0XHQpXG5cdCksXG5cdGdyb3VwOiBWaWV3Q29udGVudEdyb3Vwcy5PcGVuLFxuXHRvcmRlcjogMVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLE9BQU87QUFDUCxTQUFTLFVBQVUsaUJBQWlCO0FBQ3BDLFNBQVMsWUFBWTtBQUNyQixTQUFTLFlBQVksU0FBOEIscUNBQXFDO0FBRXhGLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsMEJBQTBCLHNCQUFzQjtBQUN6RCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLG9CQUFpQyxzQkFBc0I7QUFDaEUsU0FBUyxxQkFBcUI7QUFDOUIsU0FBMEMsWUFBb0QsdUJBQXVCLHdCQUF3Qix5QkFBeUI7QUFDdEssU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyx5QkFBeUI7QUFFbEMsU0FBUyxVQUFVLFFBQVEsZUFBZTtBQUMxQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGtCQUFrQix3QkFBd0I7QUFDbkQsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyx1QkFBdUIsbUJBQW1CLHlDQUF5QztBQUM1RixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHFCQUFxQixrQkFBa0Isc0JBQXNCLG9DQUFvQztBQUMxRyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGFBQWEsYUFBYTtBQUNuQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxtQkFBbUI7QUFFNUIsTUFBTSxtQkFBbUIsYUFBYSxzQkFBc0IsUUFBUSxPQUFPLFNBQVMsb0JBQW9CLGlDQUFpQyxDQUFDO0FBQzFJLE1BQU0sc0JBQXNCLGFBQWEsMEJBQTBCLFFBQVEsTUFBTSxTQUFTLG1CQUFtQixxQ0FBcUMsQ0FBQztBQUU1SSxJQUFNLG1DQUFOLGNBQStDLFdBQTZDO0FBQUEsRUFJbEcsWUFDNEMseUJBQ3pCLGlCQUNqQjtBQUNELFVBQU07QUFIcUM7QUFLM0Msb0JBQWdCLGFBQWEsRUFBRSxVQUFVLGlCQUFpQixTQUFTLEdBQUcsTUFBTSx3QkFBd0IscUJBQXFCLENBQUMsRUFBRSxRQUFRLE1BQU07QUFDekksV0FBSyxjQUFjO0FBRW5CLFdBQUssVUFBVSx3QkFBd0IsMEJBQTBCLE1BQU0sS0FBSyxjQUFjLENBQUMsQ0FBQztBQUM1RixXQUFLLFVBQVUsd0JBQXdCLDRCQUE0QixNQUFNLEtBQUssY0FBYyxDQUFDLENBQUM7QUFBQSxJQUMvRixDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRVEsZ0JBQXNCO0FBQzdCLFNBQUssZ0NBQWdDO0FBRXJDLFVBQU0sa0JBQWtCLGNBQWMsU0FBUyxjQUFjO0FBRTdELFVBQU0sNEJBQStDLENBQUM7QUFDdEQsVUFBTSw4QkFBaUQsQ0FBQztBQUV4RCxVQUFNLDRCQUE0QixLQUFLLGdDQUFnQztBQUN2RSxRQUFJLENBQUMsZ0JBQWdCLEtBQUssT0FBSyxFQUFFLE9BQU8sMEJBQTBCLEVBQUUsR0FBRztBQUN0RSxnQ0FBMEIsS0FBSyx5QkFBeUI7QUFBQSxJQUN6RDtBQUVBLFVBQU0seUJBQXlCLEtBQUssNkJBQTZCO0FBQ2pFLFVBQU0sbUNBQW1DLGdCQUFnQixLQUFLLE9BQUssRUFBRSxPQUFPLHVCQUF1QixFQUFFO0FBQ3JHLFVBQU0sc0JBQXNCLEtBQUssMEJBQTBCO0FBQzNELFVBQU0sZ0NBQWdDLGdCQUFnQixLQUFLLE9BQUssRUFBRSxPQUFPLG9CQUFvQixFQUFFO0FBRS9GLFFBQUksS0FBSyx3QkFBd0Isa0JBQWtCLE1BQU0sZUFBZSxTQUFTLEtBQUssd0JBQXdCLGFBQWEsRUFBRSxRQUFRLFdBQVcsR0FBRztBQUNsSixVQUFJLGtDQUFrQztBQUNyQyxvQ0FBNEIsS0FBSyxnQ0FBZ0M7QUFBQSxNQUNsRTtBQUNBLFVBQUksQ0FBQywrQkFBK0I7QUFDbkMsa0NBQTBCLEtBQUssbUJBQW1CO0FBQUEsTUFDbkQ7QUFBQSxJQUNELE9BQU87QUFDTixVQUFJLCtCQUErQjtBQUNsQyxvQ0FBNEIsS0FBSyw2QkFBNkI7QUFBQSxNQUMvRDtBQUNBLFVBQUksQ0FBQyxrQ0FBa0M7QUFDdEMsa0NBQTBCLEtBQUssc0JBQXNCO0FBQUEsTUFDdEQ7QUFBQSxJQUNEO0FBRUEsUUFBSSw0QkFBNEIsUUFBUTtBQUN2QyxvQkFBYyxnQkFBZ0IsNkJBQTZCLGNBQWM7QUFBQSxJQUMxRTtBQUNBLFFBQUksMEJBQTBCLFFBQVE7QUFDckMsb0JBQWMsY0FBYywyQkFBMkIsY0FBYztBQUFBLElBQ3RFO0FBRUEsU0FBSywrQkFBK0I7QUFBQSxFQUNyQztBQUFBLEVBRVEsa0NBQW1EO0FBQzFELFdBQU87QUFBQSxNQUNOLElBQUksZ0JBQWdCO0FBQUEsTUFDcEIsTUFBTSxnQkFBZ0I7QUFBQSxNQUN0QixnQkFBZ0IsSUFBSSxlQUFlLGVBQWU7QUFBQSxNQUNsRCxlQUFlO0FBQUEsTUFDZixPQUFPO0FBQUEsTUFDUCxxQkFBcUI7QUFBQSxNQUNyQixhQUFhO0FBQUEsTUFDYixXQUFXO0FBQUEsTUFDWCxlQUFlO0FBQUEsTUFDZixjQUFjO0FBQUEsUUFDYixJQUFJO0FBQUEsUUFDSixhQUFhLEVBQUUsU0FBUyxTQUFTLE9BQU8sVUFBVSxRQUFRLE1BQU0sUUFBUSxJQUFJLEVBQUU7QUFBQSxNQUMvRTtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFUSw0QkFBNkM7QUFDcEQsV0FBTztBQUFBLE1BQ04sSUFBSSxVQUFVO0FBQUEsTUFDZCxNQUFNLFVBQVU7QUFBQSxNQUNoQixlQUFlO0FBQUEsTUFDZixnQkFBZ0IsSUFBSSxlQUFlLFNBQVM7QUFBQSxNQUM1QyxPQUFPO0FBQUEsTUFDUCxxQkFBcUI7QUFBQSxNQUNyQixjQUFjO0FBQUEsUUFDYixJQUFJO0FBQUEsTUFDTDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFUSwrQkFBZ0Q7QUFDdkQsV0FBTztBQUFBLE1BQ04sSUFBSTtBQUFBLE1BQ0osTUFBTSxVQUFVLFdBQVcsU0FBUztBQUFBLE1BQ3BDLGVBQWU7QUFBQSxNQUNmLGdCQUFnQixJQUFJLGVBQWUsWUFBWTtBQUFBLE1BQy9DLE9BQU87QUFBQSxNQUNQLGFBQWE7QUFBQSxNQUNiLHFCQUFxQjtBQUFBLE1BQ3JCLGNBQWM7QUFBQSxRQUNiLElBQUk7QUFBQSxNQUNMO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQTVHYSxpQ0FFSSxLQUFLO0FBRlQsbUNBQU47QUFBQSxFQUtKO0FBQUEsRUFDQTtBQUFBLEdBTlU7QUE4R04sSUFBTSw0QkFBTixjQUF3QyxrQkFBa0I7QUFBQSxFQUloRSxZQUMwQixlQUNOLGtCQUNPLGdCQUNULGdCQUNNLHNCQUNBLHNCQUNILG1CQUNMLGNBQ00sb0JBQ0Ysa0JBQ0ssdUJBQ1gsWUFDWjtBQUVELFVBQU0sWUFBWSxFQUFFLHNDQUFzQyxLQUFLLEdBQUcsc0JBQXNCLHNCQUFzQixlQUFlLG9CQUFvQixrQkFBa0Isa0JBQWtCLGNBQWMsZ0JBQWdCLGdCQUFnQix1QkFBdUIsVUFBVTtBQUVwUSxTQUFLLDJCQUEyQiw4QkFBOEIsT0FBTyxpQkFBaUI7QUFDdEYsU0FBSyxVQUFVLEtBQUssZUFBZSx5QkFBeUIsT0FBSyxLQUFLLGdCQUFnQixDQUFDLENBQUM7QUFBQSxFQUN6RjtBQUFBLEVBRVMsT0FBTyxRQUEyQjtBQUMxQyxVQUFNLE9BQU8sTUFBTTtBQUNuQixXQUFPLFVBQVUsSUFBSSxrQkFBa0I7QUFBQSxFQUN4QztBQUFBLEVBRW1CLFdBQVcsZ0JBQWlDLFNBQXdDO0FBQ3RHLFFBQUksZUFBZSxPQUFPLFNBQVM7QUFDbEMsYUFBTyxLQUFLLHFCQUFxQixlQUFlLGNBQWM7QUFBQSxRQUM3RCxHQUFHO0FBQUEsUUFBUyxVQUFVO0FBQUEsVUFDckIsaUJBQWlCLE9BQUs7QUFDckIsZ0JBQUksQ0FBQyxhQUFhLENBQUMsR0FBRztBQUNyQjtBQUFBLFlBQ0Q7QUFFQSxrQkFBTSxrQkFBa0IsS0FBSyxtQkFBbUI7QUFDaEQsZ0JBQUksaUJBQWlCO0FBQ3BCLGtCQUFJLFFBQVE7QUFFWixvQkFBTSxTQUFTLEtBQUsscUJBQXFCLFNBQThCO0FBQ3ZFLGtCQUFJLENBQUMsQ0FBQyxPQUFPLFdBQVcsUUFBUSxlQUFlO0FBTzlDLHdCQUFRO0FBQUEsY0FDVDtBQUVBLDhCQUFnQiwwQkFBMEIsS0FBSztBQUFBLFlBQ2hEO0FBQUEsVUFDRDtBQUFBLFVBQ0EsZ0JBQWdCLE9BQUs7QUFDcEIsZ0JBQUksQ0FBQyxhQUFhLENBQUMsR0FBRztBQUNyQjtBQUFBLFlBQ0Q7QUFFQSxrQkFBTSxrQkFBa0IsS0FBSyxtQkFBbUI7QUFDaEQsNkJBQWlCLDBCQUEwQixDQUFDO0FBQUEsVUFDN0M7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRjtBQUNBLFdBQU8sTUFBTSxXQUFXLGdCQUFnQixPQUFPO0FBQUEsRUFDaEQ7QUFBQSxFQUVBLGtCQUFnQztBQUMvQixXQUFxQixLQUFLLFFBQVEsT0FBTztBQUFBLEVBQzFDO0FBQUEsRUFFQSxxQkFBc0M7QUFDckMsV0FBd0IsS0FBSyxRQUFRLGdCQUFnQixFQUFFO0FBQUEsRUFDeEQ7QUFBQSxFQUVTLFdBQVcsU0FBd0I7QUFDM0MsU0FBSyx5QkFBeUIsSUFBSSxPQUFPO0FBQ3pDLFVBQU0sV0FBVyxPQUFPO0FBQUEsRUFDekI7QUFBQSxFQUVTLFFBQWM7QUFDdEIsVUFBTSxlQUFlLEtBQUssUUFBUSxPQUFPO0FBQ3pDLFFBQUksZ0JBQWdCLEtBQUssTUFBTSxNQUFNLE9BQUssQ0FBQyxFQUFFLFdBQVcsQ0FBQyxHQUFHO0FBQzNELG1CQUFhLFlBQVksSUFBSTtBQUFBLElBQzlCO0FBQ0EsUUFBSSxjQUFjLFdBQVcsR0FBRztBQUMvQixtQkFBYSxNQUFNO0FBQUEsSUFDcEIsT0FBTztBQUNOLFlBQU0sTUFBTTtBQUFBLElBQ2I7QUFBQSxFQUNEO0FBQ0Q7QUEvRmEsNEJBQU47QUFBQSxFQUtKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQWhCVTtBQWlHYixNQUFNLHdCQUF3QixTQUFTLEdBQTRCLFdBQVcsc0JBQXNCO0FBSzdGLE1BQU0saUJBQWdDLHNCQUFzQixzQkFBc0I7QUFBQSxFQUN4RixJQUFJO0FBQUEsRUFDSixPQUFPLFVBQVUsV0FBVyxVQUFVO0FBQUEsRUFDdEMsZ0JBQWdCLElBQUksZUFBZSx5QkFBeUI7QUFBQSxFQUM1RCxXQUFXO0FBQUEsRUFDWCxNQUFNO0FBQUEsRUFDTix3QkFBd0I7QUFBQSxFQUN4QixhQUFhO0FBQUEsRUFDYixPQUFPO0FBQUEsRUFDUCw2QkFBNkI7QUFBQSxJQUM1QixJQUFJO0FBQUEsSUFDSixPQUFPLFVBQVUsV0FBVyxVQUFVO0FBQUEsSUFDdEMsZUFBZSxTQUFTLEVBQUUsS0FBSyxrQkFBa0IsU0FBUyxDQUFDLHVCQUF1QixFQUFFLEdBQUcsWUFBWTtBQUFBLElBQ25HLGFBQWEsRUFBRSxTQUFTLE9BQU8sVUFBVSxPQUFPLFFBQVEsUUFBUSxLQUFLO0FBQUEsSUFDckUsT0FBTztBQUFBLEVBQ1I7QUFDRCxHQUFHLHNCQUFzQixTQUFTLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFFckQsTUFBTSxhQUFhLFNBQVMsY0FBYyxhQUFhO0FBQ3ZELE1BQU0sYUFBYSxTQUFTLGNBQWMsY0FBYztBQUN4RCxNQUFNLGFBQWEsU0FBUyxjQUFjLGFBQWE7QUFFdkQsTUFBTSxzQkFBc0IsSUFBSSxVQUFVLGFBQWEsb0JBQW9CLEVBQUU7QUFDN0UsTUFBTSxtQkFBbUIsSUFBSSxVQUFVLGFBQWEsb0JBQW9CLEVBQUU7QUFDMUUsTUFBTSxtQkFBbUIsSUFBSSxVQUFVLGFBQWMsZUFBZSxDQUFDLFFBQVMscUJBQXFCLEtBQUssaUJBQWlCLEVBQUU7QUFDM0gsTUFBTSwrQkFBK0IsSUFBSSxVQUFVLGFBQWEsNkJBQTZCLEVBQUU7QUFDL0YsTUFBTSxtQkFBbUIsSUFBSSxVQUFVLGFBQWEsaUJBQWlCLEVBQUU7QUFFdkUsTUFBTSxnQkFBZ0IsU0FBUyxHQUFtQixXQUFXLGFBQWE7QUFDMUUsY0FBYywyQkFBMkIsVUFBVSxJQUFJO0FBQUEsRUFDdEQsU0FBUztBQUFBLElBQVMsRUFBRSxLQUFLLG1CQUFtQixTQUFTLENBQUMscUdBQXFHLEVBQUU7QUFBQSxJQUM1SjtBQUFBLElBQTBEO0FBQUEsRUFBbUI7QUFBQSxFQUM5RSxNQUFNLGVBQWU7QUFBQTtBQUFBLElBRXBCLHNCQUFzQixVQUFVLFdBQVc7QUFBQTtBQUFBLElBRTNDO0FBQUEsRUFDRDtBQUFBLEVBQ0EsT0FBTyxrQkFBa0I7QUFBQSxFQUN6QixPQUFPO0FBQ1IsQ0FBQztBQUVELGNBQWMsMkJBQTJCLFVBQVUsSUFBSTtBQUFBLEVBQ3RELFNBQVM7QUFBQSxJQUFTLEVBQUUsS0FBSyxtQkFBbUIsU0FBUyxDQUFDLHFHQUFxRyxFQUFFO0FBQUEsSUFDNUo7QUFBQSxJQUErQztBQUFBLElBQThCO0FBQUEsRUFBZ0I7QUFBQSxFQUM5RixNQUFNLGVBQWU7QUFBQTtBQUFBLElBRXBCLHNCQUFzQixVQUFVLFdBQVc7QUFBQTtBQUFBLElBRTNDLGtDQUFrQyxVQUFVO0FBQUEsRUFDN0M7QUFBQSxFQUNBLE9BQU8sa0JBQWtCO0FBQUEsRUFDekIsT0FBTztBQUNSLENBQUM7QUFFRCxjQUFjLDJCQUEyQixVQUFVLElBQUk7QUFBQSxFQUN0RCxTQUFTO0FBQUEsSUFBUyxFQUFFLEtBQUssc0JBQXNCLFNBQVMsQ0FBQyxxR0FBcUcsRUFBRTtBQUFBLElBQy9KO0FBQUEsSUFBNkI7QUFBQSxFQUFnQjtBQUFBLEVBQzlDLE1BQU0sZUFBZTtBQUFBO0FBQUEsSUFFcEIsc0JBQXNCLFlBQVksV0FBVztBQUFBO0FBQUEsSUFFN0Msa0JBQWtCLFlBQVksRUFBRTtBQUFBO0FBQUEsSUFFaEMsYUFBYSxVQUFVO0FBQUEsRUFBQztBQUFBLEVBQ3pCLE9BQU8sa0JBQWtCO0FBQUEsRUFDekIsT0FBTztBQUNSLENBQUM7QUFFRCxjQUFjLDJCQUEyQixVQUFVLElBQUk7QUFBQSxFQUN0RCxTQUFTO0FBQUEsSUFBUyxFQUFFLEtBQUssMEJBQTBCLFNBQVMsQ0FBQyxxR0FBcUcsRUFBRTtBQUFBLElBQ25LO0FBQUEsSUFBbUk7QUFBQSxJQUFrQjtBQUFBLEVBQWdCO0FBQUEsRUFDdEssTUFBTSxlQUFlO0FBQUE7QUFBQSxJQUVwQixlQUFlLElBQUksY0FBYztBQUFBLElBQ2pDLGVBQWU7QUFBQTtBQUFBLE1BRWQsZUFBZSxJQUFJLHNCQUFzQixZQUFZLFdBQVcsR0FBRyxrQkFBa0IsVUFBVSxFQUFFLENBQUM7QUFBQTtBQUFBLE1BRWxHLGVBQWUsSUFBSSxzQkFBc0IsWUFBWSxXQUFXLEdBQUcsWUFBWTtBQUFBLElBQ2hGO0FBQUEsRUFDRDtBQUFBLEVBQ0EsT0FBTyxrQkFBa0I7QUFBQSxFQUN6QixPQUFPO0FBQ1IsQ0FBQztBQUVELGNBQWMsMkJBQTJCLFVBQVUsSUFBSTtBQUFBLEVBQ3RELFNBQVM7QUFBQSxJQUFTLEVBQUUsS0FBSyxnQkFBZ0IsU0FBUyxDQUFDLHFHQUFxRyxFQUFFO0FBQUEsSUFDeko7QUFBQSxJQUEwQztBQUFBLEVBQWdCO0FBQUEsRUFDM0QsTUFBTSxlQUFlO0FBQUE7QUFBQSxJQUVwQixlQUFlLElBQUksY0FBYyxHQUFHLE9BQU87QUFBQSxJQUMzQyxlQUFlO0FBQUE7QUFBQSxNQUVkLGVBQWUsSUFBSSxzQkFBc0IsWUFBWSxXQUFXLEdBQUcsa0JBQWtCLFVBQVUsRUFBRSxDQUFDO0FBQUE7QUFBQSxNQUVsRyxlQUFlLElBQUksc0JBQXNCLFlBQVksV0FBVyxHQUFHLFlBQVk7QUFBQSxJQUNoRjtBQUFBLEVBQ0Q7QUFBQSxFQUNBLE9BQU8sa0JBQWtCO0FBQUEsRUFDekIsT0FBTztBQUNSLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
