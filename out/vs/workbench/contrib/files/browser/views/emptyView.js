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
import * as nls from "../../../../../nls.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { isTemporaryWorkspace, IWorkspaceContextService, WorkbenchState } from "../../../../../platform/workspace/common/workspace.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ViewPane } from "../../../../browser/parts/views/viewPane.js";
import { ResourcesDropHandler } from "../../../../browser/dnd.js";
import { listDropOverBackground } from "../../../../../platform/theme/common/colorRegistry.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IViewDescriptorService } from "../../../../common/views.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { isWeb } from "../../../../../base/common/platform.js";
import { DragAndDropObserver, getWindow } from "../../../../../base/browser/dom.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
let EmptyView = class extends ViewPane {
  constructor(options, themeService, viewDescriptorService, instantiationService, keybindingService, contextMenuService, contextService, configurationService, labelService, contextKeyService, openerService, hoverService) {
    super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
    this.contextService = contextService;
    this.labelService = labelService;
    this._disposed = false;
    this._register(this.contextService.onDidChangeWorkbenchState(() => this.refreshTitle()));
    this._register(this.labelService.onDidChangeFormatters(() => this.refreshTitle()));
  }
  shouldShowWelcome() {
    return true;
  }
  renderBody(container) {
    super.renderBody(container);
    this._register(new DragAndDropObserver(container, {
      onDrop: (e) => {
        container.style.backgroundColor = "";
        const dropHandler = this.instantiationService.createInstance(ResourcesDropHandler, { allowWorkspaceOpen: !isWeb || isTemporaryWorkspace(this.contextService.getWorkspace()) });
        dropHandler.handleDrop(e, getWindow(container));
      },
      onDragEnter: () => {
        const color = this.themeService.getColorTheme().getColor(listDropOverBackground);
        container.style.backgroundColor = color ? color.toString() : "";
      },
      onDragEnd: () => {
        container.style.backgroundColor = "";
      },
      onDragLeave: () => {
        container.style.backgroundColor = "";
      },
      onDragOver: (e) => {
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = "copy";
        }
      }
    }));
    this.refreshTitle();
  }
  refreshTitle() {
    if (this._disposed) {
      return;
    }
    if (this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
      this.updateTitle(EmptyView.NAME.value);
    } else {
      this.updateTitle(this.title);
    }
  }
  dispose() {
    this._disposed = true;
    super.dispose();
  }
};
EmptyView.ID = "workbench.explorer.emptyView";
EmptyView.NAME = nls.localize2("noWorkspace", "No Folder Opened");
EmptyView = __decorateClass([
  __decorateParam(1, IThemeService),
  __decorateParam(2, IViewDescriptorService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IKeybindingService),
  __decorateParam(5, IContextMenuService),
  __decorateParam(6, IWorkspaceContextService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, ILabelService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, IOpenerService),
  __decorateParam(11, IHoverService)
], EmptyView);
export {
  EmptyView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy9icm93c2VyL3ZpZXdzL2VtcHR5Vmlldy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSVZpZXdsZXRWaWV3T3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld3NWaWV3bGV0LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBpc1RlbXBvcmFyeVdvcmtzcGFjZSwgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBXb3JrYmVuY2hTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgVmlld1BhbmUgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL3BhcnRzL3ZpZXdzL3ZpZXdQYW5lLmpzJztcbmltcG9ydCB7IFJlc291cmNlc0Ryb3BIYW5kbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9kbmQuanMnO1xuaW1wb3J0IHsgbGlzdERyb3BPdmVyQmFja2dyb3VuZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgaXNXZWIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBEcmFnQW5kRHJvcE9ic2VydmVyLCBnZXRXaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IElMb2NhbGl6ZWRTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbi5qcyc7XG5pbXBvcnQgeyBJSG92ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaG92ZXIvYnJvd3Nlci9ob3Zlci5qcyc7XG5cbmV4cG9ydCBjbGFzcyBFbXB0eVZpZXcgZXh0ZW5kcyBWaWV3UGFuZSB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEOiBzdHJpbmcgPSAnd29ya2JlbmNoLmV4cGxvcmVyLmVtcHR5Vmlldyc7XG5cdHN0YXRpYyByZWFkb25seSBOQU1FOiBJTG9jYWxpemVkU3RyaW5nID0gbmxzLmxvY2FsaXplMignbm9Xb3Jrc3BhY2UnLCBcIk5vIEZvbGRlciBPcGVuZWRcIik7XG5cdHByaXZhdGUgX2Rpc3Bvc2VkOiBib29sZWFuID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0b3B0aW9uczogSVZpZXdsZXRWaWV3T3B0aW9ucyxcblx0XHRASVRoZW1lU2VydmljZSB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2UsXG5cdFx0QElWaWV3RGVzY3JpcHRvclNlcnZpY2Ugdmlld0Rlc2NyaXB0b3JTZXJ2aWNlOiBJVmlld0Rlc2NyaXB0b3JTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIob3B0aW9ucywga2V5YmluZGluZ1NlcnZpY2UsIGNvbnRleHRNZW51U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIGNvbnRleHRLZXlTZXJ2aWNlLCB2aWV3RGVzY3JpcHRvclNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBvcGVuZXJTZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIGhvdmVyU2VydmljZSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbnRleHRTZXJ2aWNlLm9uRGlkQ2hhbmdlV29ya2JlbmNoU3RhdGUoKCkgPT4gdGhpcy5yZWZyZXNoVGl0bGUoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGFiZWxTZXJ2aWNlLm9uRGlkQ2hhbmdlRm9ybWF0dGVycygoKSA9PiB0aGlzLnJlZnJlc2hUaXRsZSgpKSk7XG5cdH1cblxuXHRvdmVycmlkZSBzaG91bGRTaG93V2VsY29tZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSByZW5kZXJCb2R5KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRzdXBlci5yZW5kZXJCb2R5KGNvbnRhaW5lcik7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihuZXcgRHJhZ0FuZERyb3BPYnNlcnZlcihjb250YWluZXIsIHtcblx0XHRcdG9uRHJvcDogZSA9PiB7XG5cdFx0XHRcdGNvbnRhaW5lci5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAnJztcblx0XHRcdFx0Y29uc3QgZHJvcEhhbmRsZXIgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlc291cmNlc0Ryb3BIYW5kbGVyLCB7IGFsbG93V29ya3NwYWNlT3BlbjogIWlzV2ViIHx8IGlzVGVtcG9yYXJ5V29ya3NwYWNlKHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkpIH0pO1xuXHRcdFx0XHRkcm9wSGFuZGxlci5oYW5kbGVEcm9wKGUsIGdldFdpbmRvdyhjb250YWluZXIpKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRyYWdFbnRlcjogKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBjb2xvciA9IHRoaXMudGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKS5nZXRDb2xvcihsaXN0RHJvcE92ZXJCYWNrZ3JvdW5kKTtcblx0XHRcdFx0Y29udGFpbmVyLnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGNvbG9yID8gY29sb3IudG9TdHJpbmcoKSA6ICcnO1xuXHRcdFx0fSxcblx0XHRcdG9uRHJhZ0VuZDogKCkgPT4ge1xuXHRcdFx0XHRjb250YWluZXIuc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyc7XG5cdFx0XHR9LFxuXHRcdFx0b25EcmFnTGVhdmU6ICgpID0+IHtcblx0XHRcdFx0Y29udGFpbmVyLnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICcnO1xuXHRcdFx0fSxcblx0XHRcdG9uRHJhZ092ZXI6IGUgPT4ge1xuXHRcdFx0XHRpZiAoZS5kYXRhVHJhbnNmZXIpIHtcblx0XHRcdFx0XHRlLmRhdGFUcmFuc2Zlci5kcm9wRWZmZWN0ID0gJ2NvcHknO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5yZWZyZXNoVGl0bGUoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVmcmVzaFRpdGxlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9kaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLldPUktTUEFDRSkge1xuXHRcdFx0dGhpcy51cGRhdGVUaXRsZShFbXB0eVZpZXcuTkFNRS52YWx1ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudXBkYXRlVGl0bGUodGhpcy50aXRsZSk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9kaXNwb3NlZCA9IHRydWU7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFlBQVksU0FBUztBQUVyQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHNCQUFzQiwwQkFBMEIsc0JBQXNCO0FBQy9FLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsYUFBYTtBQUN0QixTQUFTLHFCQUFxQixpQkFBaUI7QUFFL0MsU0FBUyxxQkFBcUI7QUFFdkIsSUFBTSxZQUFOLGNBQXdCLFNBQVM7QUFBQSxFQU12QyxZQUNDLFNBQ2UsY0FDUyx1QkFDRCxzQkFDSCxtQkFDQyxvQkFDc0IsZ0JBQ3BCLHNCQUNBLGNBQ0gsbUJBQ0osZUFDRCxjQUNkO0FBQ0QsVUFBTSxTQUFTLG1CQUFtQixvQkFBb0Isc0JBQXNCLG1CQUFtQix1QkFBdUIsc0JBQXNCLGVBQWUsY0FBYyxZQUFZO0FBUDFJO0FBRXBCO0FBWHhCLFNBQVEsWUFBcUI7QUFrQjVCLFNBQUssVUFBVSxLQUFLLGVBQWUsMEJBQTBCLE1BQU0sS0FBSyxhQUFhLENBQUMsQ0FBQztBQUN2RixTQUFLLFVBQVUsS0FBSyxhQUFhLHNCQUFzQixNQUFNLEtBQUssYUFBYSxDQUFDLENBQUM7QUFBQSxFQUNsRjtBQUFBLEVBRVMsb0JBQTZCO0FBQ3JDLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFbUIsV0FBVyxXQUE4QjtBQUMzRCxVQUFNLFdBQVcsU0FBUztBQUUxQixTQUFLLFVBQVUsSUFBSSxvQkFBb0IsV0FBVztBQUFBLE1BQ2pELFFBQVEsT0FBSztBQUNaLGtCQUFVLE1BQU0sa0JBQWtCO0FBQ2xDLGNBQU0sY0FBYyxLQUFLLHFCQUFxQixlQUFlLHNCQUFzQixFQUFFLG9CQUFvQixDQUFDLFNBQVMscUJBQXFCLEtBQUssZUFBZSxhQUFhLENBQUMsRUFBRSxDQUFDO0FBQzdLLG9CQUFZLFdBQVcsR0FBRyxVQUFVLFNBQVMsQ0FBQztBQUFBLE1BQy9DO0FBQUEsTUFDQSxhQUFhLE1BQU07QUFDbEIsY0FBTSxRQUFRLEtBQUssYUFBYSxjQUFjLEVBQUUsU0FBUyxzQkFBc0I7QUFDL0Usa0JBQVUsTUFBTSxrQkFBa0IsUUFBUSxNQUFNLFNBQVMsSUFBSTtBQUFBLE1BQzlEO0FBQUEsTUFDQSxXQUFXLE1BQU07QUFDaEIsa0JBQVUsTUFBTSxrQkFBa0I7QUFBQSxNQUNuQztBQUFBLE1BQ0EsYUFBYSxNQUFNO0FBQ2xCLGtCQUFVLE1BQU0sa0JBQWtCO0FBQUEsTUFDbkM7QUFBQSxNQUNBLFlBQVksT0FBSztBQUNoQixZQUFJLEVBQUUsY0FBYztBQUNuQixZQUFFLGFBQWEsYUFBYTtBQUFBLFFBQzdCO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsU0FBSyxhQUFhO0FBQUEsRUFDbkI7QUFBQSxFQUVRLGVBQXFCO0FBQzVCLFFBQUksS0FBSyxXQUFXO0FBQ25CO0FBQUEsSUFDRDtBQUVBLFFBQUksS0FBSyxlQUFlLGtCQUFrQixNQUFNLGVBQWUsV0FBVztBQUN6RSxXQUFLLFlBQVksVUFBVSxLQUFLLEtBQUs7QUFBQSxJQUN0QyxPQUFPO0FBQ04sV0FBSyxZQUFZLEtBQUssS0FBSztBQUFBLElBQzVCO0FBQUEsRUFDRDtBQUFBLEVBRVMsVUFBZ0I7QUFDeEIsU0FBSyxZQUFZO0FBQ2pCLFVBQU0sUUFBUTtBQUFBLEVBQ2Y7QUFDRDtBQTNFYSxVQUVJLEtBQWE7QUFGakIsVUFHSSxPQUF5QixJQUFJLFVBQVUsZUFBZSxrQkFBa0I7QUFINUUsWUFBTjtBQUFBLEVBUUo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FsQlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
