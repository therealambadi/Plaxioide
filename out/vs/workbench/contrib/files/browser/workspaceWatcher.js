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
import { localize } from "../../../../nls.js";
import { Disposable, dispose, DisposableStore } from "../../../../base/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { INotificationService, Severity, NeverShowAgainScope, NotificationPriority } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { isAbsolute } from "../../../../base/common/path.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
let WorkspaceWatcher = class extends Disposable {
  constructor(fileService, configurationService, contextService, notificationService, openerService, uriIdentityService, hostService, telemetryService) {
    super();
    this.fileService = fileService;
    this.configurationService = configurationService;
    this.contextService = contextService;
    this.notificationService = notificationService;
    this.openerService = openerService;
    this.uriIdentityService = uriIdentityService;
    this.hostService = hostService;
    this.telemetryService = telemetryService;
    this.watchedWorkspaces = new ResourceMap((resource) => this.uriIdentityService.extUri.getComparisonKey(resource));
    this.registerListeners();
    this.refresh();
  }
  registerListeners() {
    this._register(this.contextService.onDidChangeWorkspaceFolders((e) => this.onDidChangeWorkspaceFolders(e)));
    this._register(this.contextService.onDidChangeWorkbenchState(() => this.onDidChangeWorkbenchState()));
    this._register(this.configurationService.onDidChangeConfiguration((e) => this.onDidChangeConfiguration(e)));
    this._register(this.fileService.onDidWatchError((error) => this.onDidWatchError(error)));
  }
  onDidChangeWorkspaceFolders(e) {
    for (const removed of e.removed) {
      this.unwatchWorkspace(removed);
    }
    for (const added of e.added) {
      this.watchWorkspace(added);
    }
  }
  onDidChangeWorkbenchState() {
    this.refresh();
  }
  onDidChangeConfiguration(e) {
    if (e.affectsConfiguration("files.watcherExclude") || e.affectsConfiguration("files.watcherInclude")) {
      this.refresh();
    }
  }
  onDidWatchError(error) {
    const msg = error.toString();
    let reason = void 0;
    if (msg.indexOf("ENOSPC") >= 0) {
      reason = "ENOSPC";
      this.notificationService.prompt(
        Severity.Warning,
        localize("enospcError", "Unable to watch for file changes. Please follow the instructions link to resolve this issue."),
        [{
          label: localize("learnMore", "Instructions"),
          run: () => this.openerService.open(URI.parse("https://go.microsoft.com/fwlink/?linkid=867693"))
        }],
        {
          sticky: true,
          neverShowAgain: { id: "ignoreEnospcError", isSecondary: true, scope: NeverShowAgainScope.WORKSPACE }
        }
      );
    } else if (msg.indexOf("EUNKNOWN") >= 0) {
      reason = "EUNKNOWN";
      this.notificationService.prompt(
        Severity.Warning,
        localize("eshutdownError", "File changes watcher stopped unexpectedly. A reload of the window may enable the watcher again unless the workspace cannot be watched for file changes."),
        [{
          label: localize("reload", "Reload"),
          run: () => this.hostService.reload()
        }],
        {
          sticky: true,
          priority: NotificationPriority.SILENT
          // reduce potential spam since we don't really know how often this fires
        }
      );
    } else if (msg.indexOf("ETERM") >= 0) {
      reason = "ETERM";
    }
    if (reason) {
      this.telemetryService.publicLog2("fileWatcherError", { reason });
    }
  }
  watchWorkspace(workspace) {
    const excludes = [];
    const config = this.configurationService.getValue({ resource: workspace.uri });
    if (config.files?.watcherExclude) {
      for (const key in config.files.watcherExclude) {
        if (key && config.files.watcherExclude[key] === true) {
          excludes.push(key);
        }
      }
    }
    const pathsToWatch = new ResourceMap((uri) => this.uriIdentityService.extUri.getComparisonKey(uri));
    pathsToWatch.set(workspace.uri, workspace.uri);
    if (config.files?.watcherInclude) {
      for (const includePath of config.files.watcherInclude) {
        if (!includePath) {
          continue;
        }
        if (isAbsolute(includePath)) {
          const candidate = URI.file(includePath).with({ scheme: workspace.uri.scheme });
          if (this.uriIdentityService.extUri.isEqualOrParent(candidate, workspace.uri)) {
            pathsToWatch.set(candidate, candidate);
          }
        } else {
          const candidate = workspace.toResource(includePath);
          pathsToWatch.set(candidate, candidate);
        }
      }
    }
    const disposables = new DisposableStore();
    for (const [, pathToWatch] of pathsToWatch) {
      disposables.add(this.fileService.watch(pathToWatch, { recursive: true, excludes }));
    }
    this.watchedWorkspaces.set(workspace.uri, disposables);
  }
  unwatchWorkspace(workspace) {
    if (this.watchedWorkspaces.has(workspace.uri)) {
      dispose(this.watchedWorkspaces.get(workspace.uri));
      this.watchedWorkspaces.delete(workspace.uri);
    }
  }
  refresh() {
    this.unwatchWorkspaces();
    for (const folder of this.contextService.getWorkspace().folders) {
      this.watchWorkspace(folder);
    }
  }
  unwatchWorkspaces() {
    for (const [, disposable] of this.watchedWorkspaces) {
      disposable.dispose();
    }
    this.watchedWorkspaces.clear();
  }
  dispose() {
    super.dispose();
    this.unwatchWorkspaces();
  }
};
WorkspaceWatcher.ID = "workbench.contrib.workspaceWatcher";
WorkspaceWatcher = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IOpenerService),
  __decorateParam(5, IUriIdentityService),
  __decorateParam(6, IHostService),
  __decorateParam(7, ITelemetryService)
], WorkspaceWatcher);
export {
  WorkspaceWatcher
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy9icm93c2VyL3dvcmtzcGFjZVdhdGNoZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgRGlzcG9zYWJsZSwgZGlzcG9zZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UsIElDb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSwgSUZpbGVzQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIElXb3Jrc3BhY2VGb2xkZXIsIElXb3Jrc3BhY2VGb2xkZXJzQ2hhbmdlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgU2V2ZXJpdHksIE5ldmVyU2hvd0FnYWluU2NvcGUsIE5vdGlmaWNhdGlvblByaW9yaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBpc0Fic29sdXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuXG5leHBvcnQgY2xhc3MgV29ya3NwYWNlV2F0Y2hlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi53b3Jrc3BhY2VXYXRjaGVyJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IHdhdGNoZWRXb3Jrc3BhY2VzID0gbmV3IFJlc291cmNlTWFwPElEaXNwb3NhYmxlPihyZXNvdXJjZSA9PiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuZ2V0Q29tcGFyaXNvbktleShyZXNvdXJjZSkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cblx0XHR0aGlzLnJlZnJlc2goKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb250ZXh0U2VydmljZS5vbkRpZENoYW5nZVdvcmtzcGFjZUZvbGRlcnMoZSA9PiB0aGlzLm9uRGlkQ2hhbmdlV29ya3NwYWNlRm9sZGVycyhlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29udGV4dFNlcnZpY2Uub25EaWRDaGFuZ2VXb3JrYmVuY2hTdGF0ZSgoKSA9PiB0aGlzLm9uRGlkQ2hhbmdlV29ya2JlbmNoU3RhdGUoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4gdGhpcy5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVTZXJ2aWNlLm9uRGlkV2F0Y2hFcnJvcihlcnJvciA9PiB0aGlzLm9uRGlkV2F0Y2hFcnJvcihlcnJvcikpKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VXb3Jrc3BhY2VGb2xkZXJzKGU6IElXb3Jrc3BhY2VGb2xkZXJzQ2hhbmdlRXZlbnQpOiB2b2lkIHtcblxuXHRcdC8vIFJlbW92ZWQgd29ya3NwYWNlOiBVbndhdGNoXG5cdFx0Zm9yIChjb25zdCByZW1vdmVkIG9mIGUucmVtb3ZlZCkge1xuXHRcdFx0dGhpcy51bndhdGNoV29ya3NwYWNlKHJlbW92ZWQpO1xuXHRcdH1cblxuXHRcdC8vIEFkZGVkIHdvcmtzcGFjZTogV2F0Y2hcblx0XHRmb3IgKGNvbnN0IGFkZGVkIG9mIGUuYWRkZWQpIHtcblx0XHRcdHRoaXMud2F0Y2hXb3Jrc3BhY2UoYWRkZWQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VXb3JrYmVuY2hTdGF0ZSgpOiB2b2lkIHtcblx0XHR0aGlzLnJlZnJlc2goKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGU6IElDb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZmlsZXMud2F0Y2hlckV4Y2x1ZGUnKSB8fCBlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdmaWxlcy53YXRjaGVySW5jbHVkZScpKSB7XG5cdFx0XHR0aGlzLnJlZnJlc2goKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkV2F0Y2hFcnJvcihlcnJvcjogRXJyb3IpOiB2b2lkIHtcblx0XHRjb25zdCBtc2cgPSBlcnJvci50b1N0cmluZygpO1xuXHRcdGxldCByZWFzb246ICdFTk9TUEMnIHwgJ0VVTktOT1dOJyB8ICdFVEVSTScgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHQvLyBEZXRlY3QgaWYgd2UgcnVuIGludG8gRU5PU1BDIGlzc3Vlc1xuXHRcdGlmIChtc2cuaW5kZXhPZignRU5PU1BDJykgPj0gMCkge1xuXHRcdFx0cmVhc29uID0gJ0VOT1NQQyc7XG5cblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoXG5cdFx0XHRcdFNldmVyaXR5Lldhcm5pbmcsXG5cdFx0XHRcdGxvY2FsaXplKCdlbm9zcGNFcnJvcicsIFwiVW5hYmxlIHRvIHdhdGNoIGZvciBmaWxlIGNoYW5nZXMuIFBsZWFzZSBmb2xsb3cgdGhlIGluc3RydWN0aW9ucyBsaW5rIHRvIHJlc29sdmUgdGhpcyBpc3N1ZS5cIiksXG5cdFx0XHRcdFt7XG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdsZWFybk1vcmUnLCBcIkluc3RydWN0aW9uc1wiKSxcblx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMub3BlbmVyU2VydmljZS5vcGVuKFVSSS5wYXJzZSgnaHR0cHM6Ly9nby5taWNyb3NvZnQuY29tL2Z3bGluay8/bGlua2lkPTg2NzY5MycpKVxuXHRcdFx0XHR9XSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHN0aWNreTogdHJ1ZSxcblx0XHRcdFx0XHRuZXZlclNob3dBZ2FpbjogeyBpZDogJ2lnbm9yZUVub3NwY0Vycm9yJywgaXNTZWNvbmRhcnk6IHRydWUsIHNjb3BlOiBOZXZlclNob3dBZ2FpblNjb3BlLldPUktTUEFDRSB9XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0Ly8gRGV0ZWN0IHdoZW4gdGhlIHdhdGNoZXIgdGhyb3dzIGFuIGVycm9yIHVuZXhwZWN0ZWRseVxuXHRcdGVsc2UgaWYgKG1zZy5pbmRleE9mKCdFVU5LTk9XTicpID49IDApIHtcblx0XHRcdHJlYXNvbiA9ICdFVU5LTk9XTic7XG5cblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5wcm9tcHQoXG5cdFx0XHRcdFNldmVyaXR5Lldhcm5pbmcsXG5cdFx0XHRcdGxvY2FsaXplKCdlc2h1dGRvd25FcnJvcicsIFwiRmlsZSBjaGFuZ2VzIHdhdGNoZXIgc3RvcHBlZCB1bmV4cGVjdGVkbHkuIEEgcmVsb2FkIG9mIHRoZSB3aW5kb3cgbWF5IGVuYWJsZSB0aGUgd2F0Y2hlciBhZ2FpbiB1bmxlc3MgdGhlIHdvcmtzcGFjZSBjYW5ub3QgYmUgd2F0Y2hlZCBmb3IgZmlsZSBjaGFuZ2VzLlwiKSxcblx0XHRcdFx0W3tcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3JlbG9hZCcsIFwiUmVsb2FkXCIpLFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5ob3N0U2VydmljZS5yZWxvYWQoKVxuXHRcdFx0XHR9XSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHN0aWNreTogdHJ1ZSxcblx0XHRcdFx0XHRwcmlvcml0eTogTm90aWZpY2F0aW9uUHJpb3JpdHkuU0lMRU5UIC8vIHJlZHVjZSBwb3RlbnRpYWwgc3BhbSBzaW5jZSB3ZSBkb24ndCByZWFsbHkga25vdyBob3cgb2Z0ZW4gdGhpcyBmaXJlc1xuXHRcdFx0XHR9XG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdC8vIERldGVjdCB1bmV4cGVjdGVkIHRlcm1pbmF0aW9uXG5cdFx0ZWxzZSBpZiAobXNnLmluZGV4T2YoJ0VURVJNJykgPj0gMCkge1xuXHRcdFx0cmVhc29uID0gJ0VURVJNJztcblx0XHR9XG5cblx0XHQvLyBMb2cgdGVsZW1ldHJ5IGlmIHdlIGdhdGhlcmVkIGEgcmVhc29uIChsb2dnaW5nIGl0IGZyb20gdGhlIHJlbmRlcmVyXG5cdFx0Ly8gYWxsb3dzIHVzIHRvIGludmVzdGlnYXRlIHRoaXMgc2l0dWF0aW9uIGluIGNvbnRleHQgb2YgZXhwZXJpbWVudHMpXG5cdFx0aWYgKHJlYXNvbikge1xuXHRcdFx0dHlwZSBXYXRjaEVycm9yQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRcdG93bmVyOiAnYnBhc2Vybyc7XG5cdFx0XHRcdGNvbW1lbnQ6ICdBbiBldmVudCB0aGF0IGZpcmVzIHdoZW4gYSB3YXRjaGVyIGVycm9ycyc7XG5cdFx0XHRcdHJlYXNvbjogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1RoZSB3YXRjaGVyIGVycm9yIHJlYXNvbi4nIH07XG5cdFx0XHR9O1xuXHRcdFx0dHlwZSBXYXRjaEVycm9yRXZlbnQgPSB7XG5cdFx0XHRcdHJlYXNvbjogc3RyaW5nO1xuXHRcdFx0fTtcblx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFdhdGNoRXJyb3JFdmVudCwgV2F0Y2hFcnJvckNsYXNzaWZpY2F0aW9uPignZmlsZVdhdGNoZXJFcnJvcicsIHsgcmVhc29uIH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgd2F0Y2hXb3Jrc3BhY2Uod29ya3NwYWNlOiBJV29ya3NwYWNlRm9sZGVyKTogdm9pZCB7XG5cblx0XHQvLyBDb21wdXRlIHRoZSB3YXRjaGVyIGV4Y2x1ZGUgcnVsZXMgZnJvbSBjb25maWd1cmF0aW9uXG5cdFx0Y29uc3QgZXhjbHVkZXM6IHN0cmluZ1tdID0gW107XG5cdFx0Y29uc3QgY29uZmlnID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRmlsZXNDb25maWd1cmF0aW9uPih7IHJlc291cmNlOiB3b3Jrc3BhY2UudXJpIH0pO1xuXHRcdGlmIChjb25maWcuZmlsZXM/LndhdGNoZXJFeGNsdWRlKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGtleSBpbiBjb25maWcuZmlsZXMud2F0Y2hlckV4Y2x1ZGUpIHtcblx0XHRcdFx0aWYgKGtleSAmJiBjb25maWcuZmlsZXMud2F0Y2hlckV4Y2x1ZGVba2V5XSA9PT0gdHJ1ZSkge1xuXHRcdFx0XHRcdGV4Y2x1ZGVzLnB1c2goa2V5KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHBhdGhzVG9XYXRjaCA9IG5ldyBSZXNvdXJjZU1hcDxVUkk+KHVyaSA9PiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuZ2V0Q29tcGFyaXNvbktleSh1cmkpKTtcblxuXHRcdC8vIEFkZCB0aGUgd29ya3NwYWNlIGFzIHBhdGggdG8gd2F0Y2hcblx0XHRwYXRoc1RvV2F0Y2guc2V0KHdvcmtzcGFjZS51cmksIHdvcmtzcGFjZS51cmkpO1xuXG5cdFx0Ly8gQ29tcHV0ZSBhZGRpdGlvbmFsIGluY2x1ZGVzIGZyb20gY29uZmlndXJhdGlvblxuXHRcdGlmIChjb25maWcuZmlsZXM/LndhdGNoZXJJbmNsdWRlKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGluY2x1ZGVQYXRoIG9mIGNvbmZpZy5maWxlcy53YXRjaGVySW5jbHVkZSkge1xuXHRcdFx0XHRpZiAoIWluY2x1ZGVQYXRoKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBBYnNvbHV0ZTogdmVyaWZ5IGEgY2hpbGQgb2YgdGhlIHdvcmtzcGFjZVxuXHRcdFx0XHRpZiAoaXNBYnNvbHV0ZShpbmNsdWRlUGF0aCkpIHtcblx0XHRcdFx0XHRjb25zdCBjYW5kaWRhdGUgPSBVUkkuZmlsZShpbmNsdWRlUGF0aCkud2l0aCh7IHNjaGVtZTogd29ya3NwYWNlLnVyaS5zY2hlbWUgfSk7XG5cdFx0XHRcdFx0aWYgKHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsT3JQYXJlbnQoY2FuZGlkYXRlLCB3b3Jrc3BhY2UudXJpKSkge1xuXHRcdFx0XHRcdFx0cGF0aHNUb1dhdGNoLnNldChjYW5kaWRhdGUsIGNhbmRpZGF0ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gUmVsYXRpdmU6IGpvaW4gYWdhaW5zdCB3b3Jrc3BhY2UgZm9sZGVyXG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGNhbmRpZGF0ZSA9IHdvcmtzcGFjZS50b1Jlc291cmNlKGluY2x1ZGVQYXRoKTtcblx0XHRcdFx0XHRwYXRoc1RvV2F0Y2guc2V0KGNhbmRpZGF0ZSwgY2FuZGlkYXRlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFdhdGNoIGFsbCBwYXRocyBhcyBpbnN0cnVjdGVkXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Zm9yIChjb25zdCBbLCBwYXRoVG9XYXRjaF0gb2YgcGF0aHNUb1dhdGNoKSB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQodGhpcy5maWxlU2VydmljZS53YXRjaChwYXRoVG9XYXRjaCwgeyByZWN1cnNpdmU6IHRydWUsIGV4Y2x1ZGVzIH0pKTtcblx0XHR9XG5cdFx0dGhpcy53YXRjaGVkV29ya3NwYWNlcy5zZXQod29ya3NwYWNlLnVyaSwgZGlzcG9zYWJsZXMpO1xuXHR9XG5cblx0cHJpdmF0ZSB1bndhdGNoV29ya3NwYWNlKHdvcmtzcGFjZTogSVdvcmtzcGFjZUZvbGRlcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLndhdGNoZWRXb3Jrc3BhY2VzLmhhcyh3b3Jrc3BhY2UudXJpKSkge1xuXHRcdFx0ZGlzcG9zZSh0aGlzLndhdGNoZWRXb3Jrc3BhY2VzLmdldCh3b3Jrc3BhY2UudXJpKSk7XG5cdFx0XHR0aGlzLndhdGNoZWRXb3Jrc3BhY2VzLmRlbGV0ZSh3b3Jrc3BhY2UudXJpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlZnJlc2goKTogdm9pZCB7XG5cblx0XHQvLyBVbndhdGNoIGFsbCBmaXJzdFxuXHRcdHRoaXMudW53YXRjaFdvcmtzcGFjZXMoKTtcblxuXHRcdC8vIFdhdGNoIGVhY2ggd29ya3NwYWNlIGZvbGRlclxuXHRcdGZvciAoY29uc3QgZm9sZGVyIG9mIHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycykge1xuXHRcdFx0dGhpcy53YXRjaFdvcmtzcGFjZShmb2xkZXIpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdW53YXRjaFdvcmtzcGFjZXMoKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBbLCBkaXNwb3NhYmxlXSBvZiB0aGlzLndhdGNoZWRXb3Jrc3BhY2VzKSB7XG5cdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHR9XG5cdFx0dGhpcy53YXRjaGVkV29ya3NwYWNlcy5jbGVhcigpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cblx0XHR0aGlzLnVud2F0Y2hXb3Jrc3BhY2VzKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBc0IsWUFBWSxTQUFTLHVCQUF1QjtBQUNsRSxTQUFTLFdBQVc7QUFDcEIsU0FBUyw2QkFBd0Q7QUFDakUsU0FBUyxvQkFBeUM7QUFDbEQsU0FBUyxnQ0FBZ0Y7QUFDekYsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxzQkFBc0IsVUFBVSxxQkFBcUIsNEJBQTRCO0FBQzFGLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMseUJBQXlCO0FBRTNCLElBQU0sbUJBQU4sY0FBK0IsV0FBVztBQUFBLEVBTWhELFlBQ2dDLGFBQ1Msc0JBQ0csZ0JBQ0oscUJBQ04sZUFDSyxvQkFDUCxhQUNL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
