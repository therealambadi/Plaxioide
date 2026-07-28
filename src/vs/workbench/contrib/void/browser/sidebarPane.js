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
import { Registry } from "../../../../platform/registry/common/platform.js";
import {
  Extensions as ViewContainerExtensions,
  ViewContainerLocation,
  Extensions as ViewExtensions,
  IViewDescriptorService
} from "../../../common/views.js";
import * as nls from "../../../../nls.js";
import { ViewPaneContainer } from "../../../browser/parts/views/viewPaneContainer.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { ViewPane } from "../../../browser/parts/views/viewPane.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { mountSidebar } from "./react/out/sidebar-tsx/index.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Orientation } from "../../../../base/browser/ui/sash/sash.js";
import { toDisposable } from "../../../../base/common/lifecycle.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IWorkbenchLayoutService, Parts } from "../../../services/layout/browser/layoutService.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { IChatThreadService } from "./chatThreadService.js";
import { VOLT_PENDING_MESSAGE_KEY } from "../../../browser/parts/editor/editorGroupWatermark.js";
let SidebarViewPane = class extends ViewPane {
  constructor(options, instantiationService, viewDescriptorService, configurationService, contextKeyService, themeService, contextMenuService, keybindingService, openerService, telemetryService, hoverService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
  }
  renderBody(parent) {
    super.renderBody(parent);
    parent.style.userSelect = "text";
    // Hide the duplicate "CHAT" pane header (the view tab inside the composite)
    const paneHeader = this.element?.querySelector(".pane-header");
    if (paneHeader) paneHeader.style.display = "none";
    this.instantiationService.invokeFunction((accessor) => {
      const disposeFn = mountSidebar(parent, accessor)?.dispose;
      this._register(toDisposable(() => disposeFn?.()));
    });
  }
  layoutBody(height, width) {
    super.layoutBody(height, width);
    this.element.style.height = `${height}px`;
    this.element.style.width = `${width}px`;
  }
};
SidebarViewPane = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IViewDescriptorService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IThemeService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IKeybindingService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, ITelemetryService),
  __decorateParam(10, IHoverService)
], SidebarViewPane);
const VOID_VIEW_CONTAINER_ID = "workbench.view.void";
const VOID_VIEW_ID = VOID_VIEW_CONTAINER_ID;
const viewContainerRegistry = Registry.as(ViewContainerExtensions.ViewContainersRegistry);
const container = viewContainerRegistry.registerViewContainer({
  id: VOID_VIEW_CONTAINER_ID,
  title: nls.localize2("voidContainer", "Chat"),
  ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [VOID_VIEW_CONTAINER_ID, {
    mergeViewWithContainerWhenSingleView: true,
    orientation: Orientation.HORIZONTAL
  }]),
  hideIfEmpty: false,
  order: 1,
  rejectAddedViews: true,
  icon: Codicon.symbolMethod
}, ViewContainerLocation.AuxiliaryBar, { doNotRegisterOpenCommand: true, isDefault: true });
const viewsRegistry = Registry.as(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
  id: VOID_VIEW_ID,
  hideByDefault: false,
  name: nls.localize2("voidChat", ""),
  ctorDescriptor: new SyncDescriptor(SidebarViewPane),
  canToggleVisibility: false,
  canMoveView: false,
  weight: 80,
  order: 1
}], container);
const VOID_OPEN_SIDEBAR_ACTION_ID = "void.openSidebar";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: VOID_OPEN_SIDEBAR_ACTION_ID,
      title: "Open Plaxio Sidebar"
    });
  }
  run(accessor) {
    const viewsService = accessor.get(IViewsService);
    viewsService.openViewContainer(VOID_VIEW_CONTAINER_ID);
  }
});
let SidebarStartContribution = class {
  constructor(commandService, contextService, layoutService, storageService, chatThreadService) {
    this.commandService = commandService;
    this.contextService = contextService;
    this.layoutService = layoutService;
    this.storageService = storageService;
    this.chatThreadService = chatThreadService;
    const isEmpty = () => this.contextService.getWorkbenchState() === WorkbenchState.EMPTY;
    const applyLayout = () => {
      if (isEmpty()) {
        this.layoutService.setPartHidden(true, Parts.SIDEBAR_PART);
        this.layoutService.setPartHidden(true, Parts.ACTIVITYBAR_PART);
      } else {
        this.layoutService.setPartHidden(false, Parts.SIDEBAR_PART);
        this.commandService.executeCommand(VOID_OPEN_SIDEBAR_ACTION_ID);
        // Fire any pending startup message into the AI chat
        const pendingMessage = this.storageService.get(VOLT_PENDING_MESSAGE_KEY, StorageScope.PROFILE);
        if (pendingMessage) {
          this.storageService.remove(VOLT_PENDING_MESSAGE_KEY, StorageScope.PROFILE);
          // Delay so sidebar React tree is fully mounted before sending
          setTimeout(() => {
            const thread = this.chatThreadService.getCurrentThread();
            this.chatThreadService.addUserMessageAndStreamResponse({ userMessage: pendingMessage, threadId: thread.id });
          }, 1500);
        }
      }
    };
    applyLayout();
    this.contextService.onDidChangeWorkbenchState(applyLayout);
  }
};
SidebarStartContribution.ID = "workbench.contrib.startupVoidSidebar";
SidebarStartContribution = __decorateClass([
  __decorateParam(0, ICommandService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IWorkbenchLayoutService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IChatThreadService)
], SidebarStartContribution);
registerWorkbenchContribution2(SidebarStartContribution.ID, SidebarStartContribution, WorkbenchPhase.AfterRestored);
export {
  SidebarStartContribution,
  VOID_OPEN_SIDEBAR_ACTION_ID,
  VOID_VIEW_CONTAINER_ID,
  VOID_VIEW_ID
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvc2lkZWJhclBhbmUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgMjAyNSBHbGFzcyBEZXZ0b29scywgSW5jLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAuIFNlZSBMSUNFTlNFLnR4dCBmb3IgbW9yZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQge1xuXHRFeHRlbnNpb25zIGFzIFZpZXdDb250YWluZXJFeHRlbnNpb25zLCBJVmlld0NvbnRhaW5lcnNSZWdpc3RyeSxcblx0Vmlld0NvbnRhaW5lckxvY2F0aW9uLCBJVmlld3NSZWdpc3RyeSwgRXh0ZW5zaW9ucyBhcyBWaWV3RXh0ZW5zaW9ucyxcblx0SVZpZXdEZXNjcmlwdG9yU2VydmljZSxcbn0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5cbmltcG9ydCB7IFZpZXdQYW5lQ29udGFpbmVyIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3UGFuZUNvbnRhaW5lci5qcyc7XG5cbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuXG5pbXBvcnQgeyBJVmlld1BhbmVPcHRpb25zLCBWaWV3UGFuZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld1BhbmUuanMnO1xuXG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5pbXBvcnQgeyBtb3VudFNpZGViYXIgfSBmcm9tICcuL3JlYWN0L291dC9zaWRlYmFyLXRzeC9pbmRleC5qcyc7XG5cbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBPcmllbnRhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zYXNoL3Nhc2guanMnO1xuaW1wb3J0IHsgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiwgcmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yLCBXb3JrYmVuY2hQaGFzZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIFdvcmtiZW5jaFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaExheW91dFNlcnZpY2UsIFBhcnRzIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5cblxuLy8gLS0tLS0tLS0tLSBEZWZpbmUgdmlld3BhbmUgLS0tLS0tLS0tLVxuXG5jbGFzcyBTaWRlYmFyVmlld1BhbmUgZXh0ZW5kcyBWaWV3UGFuZSB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0b3B0aW9uczogSVZpZXdQYW5lT3B0aW9ucyxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2Ugdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIGNvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKG9wdGlvbnMsIGtleWJpbmRpbmdTZXJ2aWNlLCBjb250ZXh0TWVudVNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSwgdmlld0Rlc2NyaXB0b3JTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgb3BlbmVyU2VydmljZSwgdGhlbWVTZXJ2aWNlLCBob3ZlclNlcnZpY2UpXG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVuZGVyQm9keShwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0c3VwZXIucmVuZGVyQm9keShwYXJlbnQpO1xuXHRcdHBhcmVudC5zdHlsZS51c2VyU2VsZWN0ID0gJ3RleHQnXG5cblx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IHtcblx0XHRcdGNvbnN0IGRpc3Bvc2VGbjogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkID0gbW91bnRTaWRlYmFyKHBhcmVudCwgYWNjZXNzb3IpPy5kaXNwb3NlO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IGRpc3Bvc2VGbj8uKCkpKVxuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGxheW91dEJvZHkoaGVpZ2h0OiBudW1iZXIsIHdpZHRoOiBudW1iZXIpOiB2b2lkIHtcblx0XHRzdXBlci5sYXlvdXRCb2R5KGhlaWdodCwgd2lkdGgpXG5cdFx0dGhpcy5lbGVtZW50LnN0eWxlLmhlaWdodCA9IGAke2hlaWdodH1weGBcblx0XHR0aGlzLmVsZW1lbnQuc3R5bGUud2lkdGggPSBgJHt3aWR0aH1weGBcblx0fVxuXG59XG5cbi8vIC0tLS0tLS0tLS0gUmVnaXN0ZXIgdmlld3BhbmUgaW5zaWRlIHRoZSB2b2lkIGNvbnRhaW5lciAtLS0tLS0tLS0tXG5cbmV4cG9ydCBjb25zdCBWT0lEX1ZJRVdfQ09OVEFJTkVSX0lEID0gJ3dvcmtiZW5jaC52aWV3LnZvaWQnXG5leHBvcnQgY29uc3QgVk9JRF9WSUVXX0lEID0gVk9JRF9WSUVXX0NPTlRBSU5FUl9JRFxuXG5jb25zdCB2aWV3Q29udGFpbmVyUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJVmlld0NvbnRhaW5lcnNSZWdpc3RyeT4oVmlld0NvbnRhaW5lckV4dGVuc2lvbnMuVmlld0NvbnRhaW5lcnNSZWdpc3RyeSk7XG5jb25zdCBjb250YWluZXIgPSB2aWV3Q29udGFpbmVyUmVnaXN0cnkucmVnaXN0ZXJWaWV3Q29udGFpbmVyKHtcblx0aWQ6IFZPSURfVklFV19DT05UQUlORVJfSUQsXG5cdHRpdGxlOiBubHMubG9jYWxpemUyKCd2b2lkQ29udGFpbmVyJywgJ0NoYXQnKSxcblx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihWaWV3UGFuZUNvbnRhaW5lciwgW1ZPSURfVklFV19DT05UQUlORVJfSUQsIHtcblx0XHRtZXJnZVZpZXdXaXRoQ29udGFpbmVyV2hlblNpbmdsZVZpZXc6IHRydWUsXG5cdFx0b3JpZW50YXRpb246IE9yaWVudGF0aW9uLkhPUklaT05UQUwsXG5cdH1dKSxcblx0aGlkZUlmRW1wdHk6IGZhbHNlLFxuXHRvcmRlcjogMSxcblx0cmVqZWN0QWRkZWRWaWV3czogdHJ1ZSxcblx0aWNvbjogQ29kaWNvbi5zeW1ib2xNZXRob2QsXG59LCBWaWV3Q29udGFpbmVyTG9jYXRpb24uQXV4aWxpYXJ5QmFyLCB7IGRvTm90UmVnaXN0ZXJPcGVuQ29tbWFuZDogdHJ1ZSwgaXNEZWZhdWx0OiB0cnVlIH0pO1xuXG5jb25zdCB2aWV3c1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVZpZXdzUmVnaXN0cnk+KFZpZXdFeHRlbnNpb25zLlZpZXdzUmVnaXN0cnkpO1xudmlld3NSZWdpc3RyeS5yZWdpc3RlclZpZXdzKFt7XG5cdGlkOiBWT0lEX1ZJRVdfSUQsXG5cdGhpZGVCeURlZmF1bHQ6IGZhbHNlLFxuXHRuYW1lOiBubHMubG9jYWxpemUyKCd2b2lkQ2hhdCcsICcnKSxcblx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihTaWRlYmFyVmlld1BhbmUpLFxuXHRjYW5Ub2dnbGVWaXNpYmlsaXR5OiBmYWxzZSxcblx0Y2FuTW92ZVZpZXc6IGZhbHNlLFxuXHR3ZWlnaHQ6IDgwLFxuXHRvcmRlcjogMSxcbn1dLCBjb250YWluZXIpO1xuXG5leHBvcnQgY29uc3QgVk9JRF9PUEVOX1NJREVCQVJfQUNUSU9OX0lEID0gJ3ZvaWQub3BlblNpZGViYXInXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IFZPSURfT1BFTl9TSURFQkFSX0FDVElPTl9JRCxcblx0XHRcdHRpdGxlOiAnT3BlbiBQbGF4aW8gU2lkZWJhcicsXG5cdFx0fSlcblx0fVxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiB2b2lkIHtcblx0XHRjb25zdCB2aWV3c1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSlcblx0XHR2aWV3c1NlcnZpY2Uub3BlblZpZXdDb250YWluZXIoVk9JRF9WSUVXX0NPTlRBSU5FUl9JRCk7XG5cdH1cbn0pO1xuXG5leHBvcnQgY2xhc3MgU2lkZWJhclN0YXJ0Q29udHJpYnV0aW9uIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi5zdGFydHVwVm9pZFNpZGViYXInO1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASVdvcmtiZW5jaExheW91dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYXlvdXRTZXJ2aWNlOiBJV29ya2JlbmNoTGF5b3V0U2VydmljZSxcblx0KSB7XG5cdFx0Y29uc3QgaXNFbXB0eSA9ICgpID0+IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuRU1QVFk7XG5cblx0XHRjb25zdCBhcHBseUxheW91dCA9ICgpID0+IHtcblx0XHRcdGlmIChpc0VtcHR5KCkpIHtcblx0XHRcdFx0dGhpcy5sYXlvdXRTZXJ2aWNlLnNldFBhcnRIaWRkZW4odHJ1ZSwgUGFydHMuU0lERUJBUl9QQVJUKTtcblx0XHRcdFx0dGhpcy5sYXlvdXRTZXJ2aWNlLnNldFBhcnRIaWRkZW4odHJ1ZSwgUGFydHMuQUNUSVZJVFlCQVJfUEFSVCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmxheW91dFNlcnZpY2Uuc2V0UGFydEhpZGRlbihmYWxzZSwgUGFydHMuQUNUSVZJVFlCQVJfUEFSVCk7XG5cdFx0XHRcdHRoaXMubGF5b3V0U2VydmljZS5zZXRQYXJ0SGlkZGVuKGZhbHNlLCBQYXJ0cy5TSURFQkFSX1BBUlQpO1xuXHRcdFx0XHR0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKFZPSURfT1BFTl9TSURFQkFSX0FDVElPTl9JRCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGFwcGx5TGF5b3V0KCk7XG5cdFx0dGhpcy5jb250ZXh0U2VydmljZS5vbkRpZENoYW5nZVdvcmtiZW5jaFN0YXRlKGFwcGx5TGF5b3V0KTtcblx0fVxufVxucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKFNpZGViYXJTdGFydENvbnRyaWJ1dGlvbi5JRCwgU2lkZWJhclN0YXJ0Q29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZS5BZnRlclJlc3RvcmVkKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekI7QUFB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
