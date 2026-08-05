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
import { localize, localize2 } from "../../../../nls.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { hasWorkspaceFileExtension, IWorkspaceContextService, WorkbenchState, WORKSPACE_SUFFIX } from "../../../../platform/workspace/common/workspace.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { INotificationService, NeverShowAgainScope, NotificationPriority, Severity } from "../../../../platform/notification/common/notification.js";
import { isEqual, joinPath } from "../../../../base/common/resources.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { isVirtualWorkspace } from "../../../../platform/workspace/common/virtualWorkspace.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ActiveEditorContext, ResourceContextKey, TemporaryWorkspaceContext } from "../../../common/contextkeys.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { TEXT_FILE_EDITOR_ID } from "../../files/common/files.js";
let WorkspacesFinderContribution = class extends Disposable {
  constructor(contextService, notificationService, fileService, quickInputService, hostService, storageService) {
    super();
    this.contextService = contextService;
    this.notificationService = notificationService;
    this.fileService = fileService;
    this.quickInputService = quickInputService;
    this.hostService = hostService;
    this.storageService = storageService;
    this.findWorkspaces();
  }
  async findWorkspaces() {
    const folder = this.contextService.getWorkspace().folders[0];
    if (!folder || this.contextService.getWorkbenchState() !== WorkbenchState.FOLDER || isVirtualWorkspace(this.contextService.getWorkspace())) {
      return;
    }
    const rootFileNames = (await this.fileService.resolve(folder.uri)).children?.map((child) => child.name);
    if (Array.isArray(rootFileNames)) {
      const workspaceFiles = rootFileNames.filter(hasWorkspaceFileExtension);
      if (workspaceFiles.length > 0) {
        this.doHandleWorkspaceFiles(folder.uri, workspaceFiles);
      }
    }
  }
  doHandleWorkspaceFiles(folder, workspaces) {
    const neverShowAgain = { id: "workspaces.dontPromptToOpen", scope: NeverShowAgainScope.WORKSPACE, isSecondary: true };
    if (workspaces.length === 1) {
      const workspaceFile = workspaces[0];
      this.notificationService.prompt(Severity.Info, localize(
        {
          key: "foundWorkspace",
          comment: ['{Locked="]({1})"}']
        },
        "This folder contains a workspace file '{0}'. Do you want to open it? [Learn more]({1}) about workspace files.",
        workspaceFile,
        "https://go.microsoft.com/fwlink/?linkid=2025315"
      ), [{
        label: localize("openWorkspace", "Open Workspace"),
        run: () => this.hostService.openWindow([{ workspaceUri: joinPath(folder, workspaceFile) }])
      }], {
        neverShowAgain,
        priority: !this.storageService.isNew(StorageScope.WORKSPACE) ? NotificationPriority.SILENT : void 0
        // https://github.com/microsoft/vscode/issues/125315
      });
    } else if (workspaces.length > 1) {
      this.notificationService.prompt(Severity.Info, localize({
        key: "foundWorkspaces",
        comment: ['{Locked="]({0})"}']
      }, "This folder contains multiple workspace files. Do you want to open one? [Learn more]({0}) about workspace files.", "https://go.microsoft.com/fwlink/?linkid=2025315"), [{
        label: localize("selectWorkspace", "Select Workspace"),
        run: () => {
          this.quickInputService.pick(
            workspaces.map((workspace) => ({ label: workspace })),
            { placeHolder: localize("selectToOpen", "Select a workspace to open") }
          ).then((pick) => {
            if (pick) {
              this.hostService.openWindow([{ workspaceUri: joinPath(folder, pick.label) }]);
            }
          });
        }
      }], {
        neverShowAgain,
        priority: !this.storageService.isNew(StorageScope.WORKSPACE) ? NotificationPriority.SILENT : void 0
        // https://github.com/microsoft/vscode/issues/125315
      });
    }
  }
};
WorkspacesFinderContribution = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, INotificationService),
  __decorateParam(2, IFileService),
  __decorateParam(3, IQuickInputService),
  __decorateParam(4, IHostService),
  __decorateParam(5, IStorageService)
], WorkspacesFinderContribution);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(WorkspacesFinderContribution, LifecyclePhase.Eventually);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.openWorkspaceFromEditor",
      title: localize2("openWorkspace", "Open Workspace"),
      f1: false,
      menu: {
        id: MenuId.EditorContent,
        when: ContextKeyExpr.and(
          ResourceContextKey.Extension.isEqualTo(WORKSPACE_SUFFIX),
          ActiveEditorContext.isEqualTo(TEXT_FILE_EDITOR_ID),
          TemporaryWorkspaceContext.toNegated()
        )
      }
    });
  }
  async run(accessor, uri) {
    const hostService = accessor.get(IHostService);
    const contextService = accessor.get(IWorkspaceContextService);
    const notificationService = accessor.get(INotificationService);
    if (contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
      const workspaceConfiguration = contextService.getWorkspace().configuration;
      if (workspaceConfiguration && isEqual(workspaceConfiguration, uri)) {
        notificationService.info(localize("alreadyOpen", "This workspace is already open."));
        return;
      }
    }
    return hostService.openWindow([{ workspaceUri: uri }]);
  }
});
export {
  WorkspacesFinderContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi93b3Jrc3BhY2VzL2Jyb3dzZXIvd29ya3NwYWNlcy5jb250cmlidXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMgYXMgV29ya2JlbmNoRXh0ZW5zaW9ucywgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeSwgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgaGFzV29ya3NwYWNlRmlsZUV4dGVuc2lvbiwgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBXb3JrYmVuY2hTdGF0ZSwgV09SS1NQQUNFX1NVRkZJWCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElOZXZlclNob3dBZ2Fpbk9wdGlvbnMsIElOb3RpZmljYXRpb25TZXJ2aWNlLCBOZXZlclNob3dBZ2FpblNjb3BlLCBOb3RpZmljYXRpb25Qcmlvcml0eSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCwgam9pblBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrSXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IGlzVmlydHVhbFdvcmtzcGFjZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vdmlydHVhbFdvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgQWN0aXZlRWRpdG9yQ29udGV4dCwgUmVzb3VyY2VDb250ZXh0S2V5LCBUZW1wb3JhcnlXb3Jrc3BhY2VDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBURVhUX0ZJTEVfRURJVE9SX0lEIH0gZnJvbSAnLi4vLi4vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcblxuLyoqXG4gKiBBIHdvcmtiZW5jaCBjb250cmlidXRpb24gdGhhdCB3aWxsIGxvb2sgZm9yIGAuY29kZS13b3Jrc3BhY2VgIGZpbGVzIGluIHRoZSByb290IG9mIHRoZVxuICogd29ya3NwYWNlIGZvbGRlciBhbmQgb3BlbiBhIG5vdGlmaWNhdGlvbiB0byBzdWdnZXN0IHRvIG9wZW4gb25lIG9mIHRoZSB3b3Jrc3BhY2VzLlxuICovXG5leHBvcnQgY2xhc3MgV29ya3NwYWNlc0ZpbmRlckNvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASUhvc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5maW5kV29ya3NwYWNlcygpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBmaW5kV29ya3NwYWNlcygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBmb2xkZXIgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnNbMF07XG5cdFx0aWYgKCFmb2xkZXIgfHwgdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpICE9PSBXb3JrYmVuY2hTdGF0ZS5GT0xERVIgfHwgaXNWaXJ0dWFsV29ya3NwYWNlKHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkpKSB7XG5cdFx0XHRyZXR1cm47IC8vIHJlcXVpcmUgYSBzaW5nbGUgKG5vbiB2aXJ0dWFsKSByb290IGZvbGRlclxuXHRcdH1cblxuXHRcdGNvbnN0IHJvb3RGaWxlTmFtZXMgPSAoYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZXNvbHZlKGZvbGRlci51cmkpKS5jaGlsZHJlbj8ubWFwKGNoaWxkID0+IGNoaWxkLm5hbWUpO1xuXHRcdGlmIChBcnJheS5pc0FycmF5KHJvb3RGaWxlTmFtZXMpKSB7XG5cdFx0XHRjb25zdCB3b3Jrc3BhY2VGaWxlcyA9IHJvb3RGaWxlTmFtZXMuZmlsdGVyKGhhc1dvcmtzcGFjZUZpbGVFeHRlbnNpb24pO1xuXHRcdFx0aWYgKHdvcmtzcGFjZUZpbGVzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0dGhpcy5kb0hhbmRsZVdvcmtzcGFjZUZpbGVzKGZvbGRlci51cmksIHdvcmtzcGFjZUZpbGVzKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGRvSGFuZGxlV29ya3NwYWNlRmlsZXMoZm9sZGVyOiBVUkksIHdvcmtzcGFjZXM6IHN0cmluZ1tdKTogdm9pZCB7XG5cdFx0Y29uc3QgbmV2ZXJTaG93QWdhaW46IElOZXZlclNob3dBZ2Fpbk9wdGlvbnMgPSB7IGlkOiAnd29ya3NwYWNlcy5kb250UHJvbXB0VG9PcGVuJywgc2NvcGU6IE5ldmVyU2hvd0FnYWluU2NvcGUuV09SS1NQQUNFLCBpc1NlY29uZGFyeTogdHJ1ZSB9O1xuXG5cdFx0Ly8gUHJvbXB0IHRvIG9wZW4gb25lIHdvcmtzcGFjZVxuXHRcdGlmICh3b3Jrc3BhY2VzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0Y29uc3Qgd29ya3NwYWNlRmlsZSA9IHdvcmtzcGFjZXNbMF07XG5cblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoU2V2ZXJpdHkuSW5mbywgbG9jYWxpemUoXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRrZXk6ICdmb3VuZFdvcmtzcGFjZScsXG5cdFx0XHRcdFx0Y29tbWVudDogWyd7TG9ja2VkPVwiXSh7MX0pXCJ9J11cblx0XHRcdFx0fSxcblx0XHRcdFx0XCJUaGlzIGZvbGRlciBjb250YWlucyBhIHdvcmtzcGFjZSBmaWxlICd7MH0nLiBEbyB5b3Ugd2FudCB0byBvcGVuIGl0PyBbTGVhcm4gbW9yZV0oezF9KSBhYm91dCB3b3Jrc3BhY2UgZmlsZXMuXCIsXG5cdFx0XHRcdHdvcmtzcGFjZUZpbGUsXG5cdFx0XHRcdCdodHRwczovL2dvLm1pY3Jvc29mdC5jb20vZndsaW5rLz9saW5raWQ9MjAyNTMxNSdcblx0XHRcdCksIFt7XG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnb3BlbldvcmtzcGFjZScsIFwiT3BlbiBXb3Jrc3BhY2VcIiksXG5cdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5ob3N0U2VydmljZS5vcGVuV2luZG93KFt7IHdvcmtzcGFjZVVyaTogam9pblBhdGgoZm9sZGVyLCB3b3Jrc3BhY2VGaWxlKSB9XSlcblx0XHRcdH1dLCB7XG5cdFx0XHRcdG5ldmVyU2hvd0FnYWluLFxuXHRcdFx0XHRwcmlvcml0eTogIXRoaXMuc3RvcmFnZVNlcnZpY2UuaXNOZXcoU3RvcmFnZVNjb3BlLldPUktTUEFDRSkgPyBOb3RpZmljYXRpb25Qcmlvcml0eS5TSUxFTlQgOiB1bmRlZmluZWQgLy8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEyNTMxNVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gUHJvbXB0IHRvIHNlbGVjdCBhIHdvcmtzcGFjZSBmcm9tIG1hbnlcblx0XHRlbHNlIGlmICh3b3Jrc3BhY2VzLmxlbmd0aCA+IDEpIHtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoU2V2ZXJpdHkuSW5mbywgbG9jYWxpemUoe1xuXHRcdFx0XHRrZXk6ICdmb3VuZFdvcmtzcGFjZXMnLFxuXHRcdFx0XHRjb21tZW50OiBbJ3tMb2NrZWQ9XCJdKHswfSlcIn0nXVxuXHRcdFx0fSwgXCJUaGlzIGZvbGRlciBjb250YWlucyBtdWx0aXBsZSB3b3Jrc3BhY2UgZmlsZXMuIERvIHlvdSB3YW50IHRvIG9wZW4gb25lPyBbTGVhcm4gbW9yZV0oezB9KSBhYm91dCB3b3Jrc3BhY2UgZmlsZXMuXCIsICdodHRwczovL2dvLm1pY3Jvc29mdC5jb20vZndsaW5rLz9saW5raWQ9MjAyNTMxNScpLCBbe1xuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3NlbGVjdFdvcmtzcGFjZScsIFwiU2VsZWN0IFdvcmtzcGFjZVwiKSxcblx0XHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5xdWlja0lucHV0U2VydmljZS5waWNrKFxuXHRcdFx0XHRcdFx0d29ya3NwYWNlcy5tYXAod29ya3NwYWNlID0+ICh7IGxhYmVsOiB3b3Jrc3BhY2UgfSBzYXRpc2ZpZXMgSVF1aWNrUGlja0l0ZW0pKSxcblx0XHRcdFx0XHRcdHsgcGxhY2VIb2xkZXI6IGxvY2FsaXplKCdzZWxlY3RUb09wZW4nLCBcIlNlbGVjdCBhIHdvcmtzcGFjZSB0byBvcGVuXCIpIH0pLnRoZW4ocGljayA9PiB7XG5cdFx0XHRcdFx0XHRcdGlmIChwaWNrKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5ob3N0U2VydmljZS5vcGVuV2luZG93KFt7IHdvcmtzcGFjZVVyaTogam9pblBhdGgoZm9sZGVyLCBwaWNrLmxhYmVsKSB9XSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XSwge1xuXHRcdFx0XHRuZXZlclNob3dBZ2Fpbixcblx0XHRcdFx0cHJpb3JpdHk6ICF0aGlzLnN0b3JhZ2VTZXJ2aWNlLmlzTmV3KFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpID8gTm90aWZpY2F0aW9uUHJpb3JpdHkuU0lMRU5UIDogdW5kZWZpbmVkIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMjUzMTVcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxufVxuXG5SZWdpc3RyeS5hczxJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5PihXb3JrYmVuY2hFeHRlbnNpb25zLldvcmtiZW5jaCkucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24oV29ya3NwYWNlc0ZpbmRlckNvbnRyaWJ1dGlvbiwgTGlmZWN5Y2xlUGhhc2UuRXZlbnR1YWxseSk7XG5cbi8vIFJlbmRlciBcIk9wZW4gV29ya3NwYWNlXCIgYnV0dG9uIGluICouY29kZS13b3Jrc3BhY2UgZmlsZXNcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5vcGVuV29ya3NwYWNlRnJvbUVkaXRvcicsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdvcGVuV29ya3NwYWNlJywgXCJPcGVuIFdvcmtzcGFjZVwiKSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5FZGl0b3JDb250ZW50LFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0UmVzb3VyY2VDb250ZXh0S2V5LkV4dGVuc2lvbi5pc0VxdWFsVG8oV09SS1NQQUNFX1NVRkZJWCksXG5cdFx0XHRcdFx0QWN0aXZlRWRpdG9yQ29udGV4dC5pc0VxdWFsVG8oVEVYVF9GSUxFX0VESVRPUl9JRCksXG5cdFx0XHRcdFx0VGVtcG9yYXJ5V29ya3NwYWNlQ29udGV4dC50b05lZ2F0ZWQoKVxuXHRcdFx0XHQpXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHVyaTogVVJJKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaG9zdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUhvc3RTZXJ2aWNlKTtcblx0XHRjb25zdCBjb250ZXh0U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UpO1xuXHRcdGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXG5cdFx0aWYgKGNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLldPUktTUEFDRSkge1xuXHRcdFx0Y29uc3Qgd29ya3NwYWNlQ29uZmlndXJhdGlvbiA9IGNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmNvbmZpZ3VyYXRpb247XG5cdFx0XHRpZiAod29ya3NwYWNlQ29uZmlndXJhdGlvbiAmJiBpc0VxdWFsKHdvcmtzcGFjZUNvbmZpZ3VyYXRpb24sIHVyaSkpIHtcblx0XHRcdFx0bm90aWZpY2F0aW9uU2VydmljZS5pbmZvKGxvY2FsaXplKCdhbHJlYWR5T3BlbicsIFwiVGhpcyB3b3Jrc3BhY2UgaXMgYWxyZWFkeSBvcGVuLlwiKSk7XG5cblx0XHRcdFx0cmV0dXJuOyAvLyB3b3Jrc3BhY2UgYWxyZWFkeSBvcGVuZWRcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gaG9zdFNlcnZpY2Uub3BlbldpbmRvdyhbeyB3b3Jrc3BhY2VVcmk6IHVyaSB9XSk7XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFVBQVUsaUJBQWlCO0FBQ3BDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsY0FBYywyQkFBb0Y7QUFDM0csU0FBUyxzQkFBc0I7QUFDL0IsU0FBUywyQkFBMkIsMEJBQTBCLGdCQUFnQix3QkFBd0I7QUFDdEcsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxvQkFBb0I7QUFDN0IsU0FBaUMsc0JBQXNCLHFCQUFxQixzQkFBc0IsZ0JBQWdCO0FBRWxILFNBQVMsU0FBUyxnQkFBZ0I7QUFDbEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUywwQkFBMEM7QUFDbkQsU0FBUyxpQkFBaUIsb0JBQW9CO0FBQzlDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsU0FBUyxRQUFRLHVCQUF1QjtBQUVqRCxTQUFTLHFCQUFxQixvQkFBb0IsaUNBQWlDO0FBQ25GLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMkJBQTJCO0FBTTdCLElBQU0sK0JBQU4sY0FBMkMsV0FBNkM7QUFBQSxFQUU5RixZQUM0QyxnQkFDSixxQkFDUixhQUNNLG1CQUNOLGFBQ0csZ0JBQ2pDO0FBQ0QsVUFBTTtBQVBxQztBQUNKO0FBQ1I7QUFDTTtBQUNOO0FBQ0c7QUFJ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
