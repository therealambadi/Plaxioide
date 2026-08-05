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
import { DisposableStore, dispose } from "../../../../base/common/lifecycle.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { StoredFileWorkingCopy, StoredFileWorkingCopyState } from "./storedFileWorkingCopy.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { Promises, ResourceQueue } from "../../../../base/common/async.js";
import { FileChangeType, FileOperation, IFileService } from "../../../../platform/files/common/files.js";
import { ILifecycleService } from "../../lifecycle/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { joinPath } from "../../../../base/common/resources.js";
import { IWorkingCopyFileService } from "./workingCopyFileService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { IWorkingCopyBackupService } from "./workingCopyBackup.js";
import { BaseFileWorkingCopyManager } from "./abstractFileWorkingCopyManager.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IElevatedFileService } from "../../files/common/elevatedFileService.js";
import { IFilesConfigurationService } from "../../filesConfiguration/common/filesConfigurationService.js";
import { IWorkingCopyEditorService } from "./workingCopyEditorService.js";
import { IWorkingCopyService } from "./workingCopyService.js";
import { isWeb } from "../../../../base/common/platform.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { SnapshotContext } from "./fileWorkingCopy.js";
import { IProgressService } from "../../../../platform/progress/common/progress.js";
let StoredFileWorkingCopyManager = class extends BaseFileWorkingCopyManager {
  constructor(workingCopyTypeId, modelFactory, fileService, lifecycleService, labelService, logService, workingCopyFileService, workingCopyBackupService, uriIdentityService, filesConfigurationService, workingCopyService, notificationService, workingCopyEditorService, editorService, elevatedFileService, progressService) {
    super(fileService, logService, workingCopyBackupService);
    this.workingCopyTypeId = workingCopyTypeId;
    this.modelFactory = modelFactory;
    this.lifecycleService = lifecycleService;
    this.labelService = labelService;
    this.workingCopyFileService = workingCopyFileService;
    this.uriIdentityService = uriIdentityService;
    this.filesConfigurationService = filesConfigurationService;
    this.workingCopyService = workingCopyService;
    this.notificationService = notificationService;
    this.workingCopyEditorService = workingCopyEditorService;
    this.editorService = editorService;
    this.elevatedFileService = elevatedFileService;
    this.progressService = progressService;
    //#region Events
    this._onDidResolve = this._register(new Emitter());
    this.onDidResolve = this._onDidResolve.event;
    this._onDidChangeDirty = this._register(new Emitter());
    this.onDidChangeDirty = this._onDidChangeDirty.event;
    this._onDidChangeReadonly = this._register(new Emitter());
    this.onDidChangeReadonly = this._onDidChangeReadonly.event;
    this._onDidChangeOrphaned = this._register(new Emitter());
    this.onDidChangeOrphaned = this._onDidChangeOrphaned.event;
    this._onDidSaveError = this._register(new Emitter());
    this.onDidSaveError = this._onDidSaveError.event;
    this._onDidSave = this._register(new Emitter());
    this.onDidSave = this._onDidSave.event;
    this._onDidRevert = this._register(new Emitter());
    this.onDidRevert = this._onDidRevert.event;
    this._onDidRemove = this._register(new Emitter());
    this.onDidRemove = this._onDidRemove.event;
    //#endregion
    this.mapResourceToWorkingCopyListeners = new ResourceMap();
    this.mapResourceToPendingWorkingCopyResolve = new ResourceMap();
    this.workingCopyResolveQueue = this._register(new ResourceQueue());
    //#endregion
    //#region Working Copy File Events
    this.mapCorrelationIdToWorkingCopiesToRestore = /* @__PURE__ */ new Map();
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.fileService.onDidFilesChange((e) => this.onDidFilesChange(e)));
    this._register(this.fileService.onDidChangeFileSystemProviderCapabilities((e) => this.onDidChangeFileSystemProviderCapabilities(e)));
    this._register(this.fileService.onDidChangeFileSystemProviderRegistrations((e) => this.onDidChangeFileSystemProviderRegistrations(e)));
    this._register(this.workingCopyFileService.onWillRunWorkingCopyFileOperation((e) => this.onWillRunWorkingCopyFileOperation(e)));
    this._register(this.workingCopyFileService.onDidFailWorkingCopyFileOperation((e) => this.onDidFailWorkingCopyFileOperation(e)));
    this._register(this.workingCopyFileService.onDidRunWorkingCopyFileOperation((e) => this.onDidRunWorkingCopyFileOperation(e)));
    if (isWeb) {
      this._register(this.lifecycleService.onBeforeShutdown((event) => event.veto(this.onBeforeShutdownWeb(), "veto.fileWorkingCopyManager")));
    } else {
      this._register(this.lifecycleService.onWillShutdown((event) => event.join(this.onWillShutdownDesktop(), { id: "join.fileWorkingCopyManager", label: localize("join.fileWorkingCopyManager", "Saving working copies") })));
    }
  }
  onBeforeShutdownWeb() {
    if (this.workingCopies.some((workingCopy) => workingCopy.hasState(StoredFileWorkingCopyState.PENDING_SAVE))) {
      return true;
    }
    return false;
  }
  async onWillShutdownDesktop() {
    let pendingSavedWorkingCopies;
    while ((pendingSavedWorkingCopies = this.workingCopies.filter((workingCopy) => workingCopy.hasState(StoredFileWorkingCopyState.PENDING_SAVE))).length > 0) {
      await Promises.settled(pendingSavedWorkingCopies.map((workingCopy) => workingCopy.joinState(StoredFileWorkingCopyState.PENDING_SAVE)));
    }
  }
  //#region Resolve from file or file provider changes
  onDidChangeFileSystemProviderCapabilities(e) {
    this.queueWorkingCopyReloads(e.scheme);
  }
  onDidChangeFileSystemProviderRegistrations(e) {
    if (!e.added) {
      return;
    }
    this.queueWorkingCopyReloads(e.scheme);
  }
  onDidFilesChange(e) {
    this.queueWorkingCopyReloads(e);
  }
  queueWorkingCopyReloads(schemeOrEvent) {
    for (const workingCopy of this.workingCopies) {
      if (workingCopy.isDirty()) {
        continue;
      }
      let resolveWorkingCopy = false;
      if (typeof schemeOrEvent === "string") {
        resolveWorkingCopy = schemeOrEvent === workingCopy.resource.scheme;
      } else {
        resolveWorkingCopy = schemeOrEvent.contains(workingCopy.resource, FileChangeType.UPDATED, FileChangeType.ADDED);
      }
      if (resolveWorkingCopy) {
        this.queueWorkingCopyReload(workingCopy);
      }
    }
  }
  queueWorkingCopyReload(workingCopy) {
    const queueSize = this.workingCopyResolveQueue.queueSize(workingCopy.resource);
    if (queueSize <= 1) {
      this.workingCopyResolveQueue.queueFor(workingCopy.resource, async () => {
        try {
          await this.reload(workingCopy);
        } catch (error) {
          this.logService.error(error);
        }
      });
    }
  }
  onWillRunWorkingCopyFileOperation(e) {
    if (e.operation === FileOperation.MOVE || e.operation === FileOperation.COPY) {
      e.waitUntil((async () => {
        const workingCopiesToRestore = [];
        for (const { source, target } of e.files) {
          if (source) {
            if (this.uriIdentityService.extUri.isEqual(source, target)) {
              continue;
            }
            const sourceWorkingCopies = [];
            for (const workingCopy of this.workingCopies) {
              if (this.uriIdentityService.extUri.isEqualOrParent(workingCopy.resource, source)) {
                sourceWorkingCopies.push(workingCopy);
              }
            }
            for (const sourceWorkingCopy of sourceWorkingCopies) {
              const sourceResource = sourceWorkingCopy.resource;
              let targetResource;
              if (this.uriIdentityService.extUri.isEqual(sourceResource, source)) {
                targetResource = target;
              } else {
                targetResource = joinPath(target, sourceResource.path.substr(source.path.length + 1));
              }
              workingCopiesToRestore.push({
                source: sourceResource,
                target: targetResource,
                snapshot: sourceWorkingCopy.isDirty() ? await sourceWorkingCopy.model?.snapshot(SnapshotContext.Save, CancellationToken.None) : void 0
              });
            }
          }
        }
        this.mapCorrelationIdToWorkingCopiesToRestore.set(e.correlationId, workingCopiesToRestore);
      })());
    }
  }
  onDidFailWorkingCopyFileOperation(e) {
    if (e.operation === FileOperation.MOVE || e.operation === FileOperation.COPY) {
      const workingCopiesToRestore = this.mapCorrelationIdToWorkingCopiesToRestore.get(e.correlationId);
      if (workingCopiesToRestore) {
        this.mapCorrelationIdToWorkingCopiesToRestore.delete(e.correlationId);
        for (const workingCopy of workingCopiesToRestore) {
          if (workingCopy.snapshot) {
            this.get(workingCopy.source)?.markModified();
          }
        }
      }
    }
  }
  onDidRunWorkingCopyFileOperation(e) {
    switch (e.operation) {
      // Create: Revert existing working copies
      case FileOperation.CREATE:
        e.waitUntil((async () => {
          for (const { target } of e.files) {
            const workingCopy = this.get(target);
            if (workingCopy && !workingCopy.isDisposed()) {
              await workingCopy.revert();
            }
          }
        })());
        break;
      // Move/Copy: restore working copies that were loaded before the operation took place
      case FileOperation.MOVE:
      case FileOperation.COPY:
        e.waitUntil((async () => {
          const workingCopiesToRestore = this.mapCorrelationIdToWorkingCopiesToRestore.get(e.correlationId);
          if (workingCopiesToRestore) {
            this.mapCorrelationIdToWorkingCopiesToRestore.delete(e.correlationId);
            await Promises.settled(workingCopiesToRestore.map(async (workingCopyToRestore) => {
              const target = this.uriIdentityService.asCanonicalUri(workingCopyToRestore.target);
              await this.resolve(target, {
                reload: { async: false },
                // enforce a reload
                contents: workingCopyToRestore.snapshot
              });
            }));
          }
        })());
        break;
    }
  }
  //#endregion
  //#region Reload & Resolve
  async reload(workingCopy) {
    await this.joinPendingResolves(workingCopy.resource);
    if (workingCopy.isDirty() || workingCopy.isDisposed() || !this.has(workingCopy.resource)) {
      return;
    }
    await this.doResolve(workingCopy, { reload: { async: false } });
  }
  async resolve(resource, options) {
    const pendingResolve = this.joinPendingResolves(resource);
    if (pendingResolve) {
      await pendingResolve;
    }
    return this.doResolve(resource, options);
  }
  async doResolve(resourceOrWorkingCopy, options) {
    let workingCopy;
    let resource;
    if (URI.isUri(resourceOrWorkingCopy)) {
      resource = resourceOrWorkingCopy;
      workingCopy = this.get(resource);
    } else {
      resource = resourceOrWorkingCopy.resource;
      workingCopy = resourceOrWorkingCopy;
    }
    let workingCopyResolve;
    let didCreateWorkingCopy = false;
    const resolveOptions = {
      contents: options?.contents,
      forceReadFromFile: options?.reload?.force,
      limits: options?.limits
    };
    if (workingCopy) {
      if (options?.contents) {
        workingCopyResolve = workingCopy.resolve(resolveOptions);
      } else if (options?.reload) {
        if (options.reload.async) {
          workingCopyResolve = Promise.resolve();
          (async () => {
            try {
              await workingCopy.resolve(resolveOptions);
            } catch (error) {
              if (!workingCopy.isDisposed()) {
                onUnexpectedError(error);
              }
            }
          })();
        } else {
          workingCopyResolve = workingCopy.resolve(resolveOptions);
        }
      } else {
        workingCopyResolve = Promise.resolve();
      }
    } else {
      didCreateWorkingCopy = true;
      workingCopy = new StoredFileWorkingCopy(
        this.workingCopyTypeId,
        resource,
        this.labelService.getUriBasenameLabel(resource),
        this.modelFactory,
        async (options2) => {
          await this.resolve(resource, { ...options2, reload: { async: false } });
        },
        this.fileService,
        this.logService,
        this.workingCopyFileService,
        this.filesConfigurationService,
        this.workingCopyBackupService,
        this.workingCopyService,
        this.notificationService,
        this.workingCopyEditorService,
        this.editorService,
        this.elevatedFileService,
        this.progressService
      );
      workingCopyResolve = workingCopy.resolve(resolveOptions);
      this.registerWorkingCopy(workingCopy);
    }
    this.mapResourceToPendingWorkingCopyResolve.set(resource, workingCopyResolve);
    this.add(resource, workingCopy);
    if (didCreateWorkingCopy) {
      if (workingCopy.isDirty()) {
        this._onDidChangeDirty.fire(workingCopy);
      }
    }
    try {
      await workingCopyResolve;
    } catch (error) {
      if (didCreateWorkingCopy) {
        workingCopy.dispose();
      }
      throw error;
    } finally {
      this.mapResourceToPendingWorkingCopyResolve.delete(resource);
    }
    if (didCreateWorkingCopy && workingCopy.isDirty()) {
      this._onDidChangeDirty.fire(workingCopy);
    }
    return workingCopy;
  }
  joinPendingResolves(resource) {
    const pendingWorkingCopyResolve = this.mapResourceToPendingWorkingCopyResolve.get(resource);
    if (!pendingWorkingCopyResolve) {
      return;
    }
    return this.doJoinPendingResolves(resource);
  }
  async doJoinPendingResolves(resource) {
    let currentWorkingCopyResolve;
    while (this.mapResourceToPendingWorkingCopyResolve.has(resource)) {
      const nextPendingWorkingCopyResolve = this.mapResourceToPendingWorkingCopyResolve.get(resource);
      if (nextPendingWorkingCopyResolve === currentWorkingCopyResolve) {
        return;
      }
      currentWorkingCopyResolve = nextPendingWorkingCopyResolve;
      try {
        await nextPendingWorkingCopyResolve;
      } catch (error) {
      }
    }
  }
  registerWorkingCopy(workingCopy) {
    const workingCopyListeners = new DisposableStore();
    workingCopyListeners.add(workingCopy.onDidResolve(() => this._onDidResolve.fire(workingCopy)));
    workingCopyListeners.add(workingCopy.onDidChangeDirty(() => this._onDidChangeDirty.fire(workingCopy)));
    workingCopyListeners.add(workingCopy.onDidChangeReadonly(() => this._onDidChangeReadonly.fire(workingCopy)));
    workingCopyListeners.add(workingCopy.onDidChangeOrphaned(() => this._onDidChangeOrphaned.fire(workingCopy)));
    workingCopyListeners.add(workingCopy.onDidSaveError(() => this._onDidSaveError.fire(workingCopy)));
    workingCopyListeners.add(workingCopy.onDidSave((e) => this._onDidSave.fire({ workingCopy, ...e })));
    workingCopyListeners.add(workingCopy.onDidRevert(() => this._onDidRevert.fire(workingCopy)));
    this.mapResourceToWorkingCopyListeners.set(workingCopy.resource, workingCopyListeners);
  }
  remove(resource) {
    const removed = super.remove(resource);
    const workingCopyListener = this.mapResourceToWorkingCopyListeners.get(resource);
    if (workingCopyListener) {
      dispose(workingCopyListener);
      this.mapResourceToWorkingCopyListeners.delete(resource);
    }
    if (removed) {
      this._onDidRemove.fire(resource);
    }
    return removed;
  }
  //#endregion
  //#region Lifecycle
  canDispose(workingCopy) {
    if (workingCopy.isDisposed() || !this.mapResourceToPendingWorkingCopyResolve.has(workingCopy.resource) && !workingCopy.isDirty()) {
      return true;
    }
    return this.doCanDispose(workingCopy);
  }
  async doCanDispose(workingCopy) {
    const pendingResolve = this.joinPendingResolves(workingCopy.resource);
    if (pendingResolve) {
      await pendingResolve;
      return this.canDispose(workingCopy);
    }
    if (workingCopy.isDirty()) {
      await Event.toPromise(workingCopy.onDidChangeDirty);
      return this.canDispose(workingCopy);
    }
    return true;
  }
  dispose() {
    super.dispose();
    this.mapResourceToPendingWorkingCopyResolve.clear();
    dispose(this.mapResourceToWorkingCopyListeners.values());
    this.mapResourceToWorkingCopyListeners.clear();
  }
  //#endregion
};
StoredFileWorkingCopyManager = __decorateClass([
  __decorateParam(2, IFileService),
  __decorateParam(3, ILifecycleService),
  __decorateParam(4, ILabelService),
  __decorateParam(5, ILogService),
  __decorateParam(6, IWorkingCopyFileService),
  __decorateParam(7, IWorkingCopyBackupService),
  __decorateParam(8, IUriIdentityService),
  __decorateParam(9, IFilesConfigurationService),
  __decorateParam(10, IWorkingCopyService),
  __decorateParam(11, INotificationService),
  __decorateParam(12, IWorkingCopyEditorService),
  __decorateParam(13, IEditorService),
  __decorateParam(14, IElevatedFileService),
  __decorateParam(15, IProgressService)
], StoredFileWorkingCopyManager);
export {
  StoredFileWorkingCopyManager
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3N0b3JlZEZpbGVXb3JraW5nQ29weU1hbmFnZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEV2ZW50LCBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgU3RvcmVkRmlsZVdvcmtpbmdDb3B5LCBTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZSwgSVN0b3JlZEZpbGVXb3JraW5nQ29weSwgSVN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsLCBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWxGYWN0b3J5LCBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5UmVzb2x2ZU9wdGlvbnMsIElTdG9yZWRGaWxlV29ya2luZ0NvcHlTYXZlRXZlbnQgYXMgSUJhc2VTdG9yZWRGaWxlV29ya2luZ0NvcHlTYXZlRXZlbnQgfSBmcm9tICcuL3N0b3JlZEZpbGVXb3JraW5nQ29weS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBQcm9taXNlcywgUmVzb3VyY2VRdWV1ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IEZpbGVDaGFuZ2VzRXZlbnQsIEZpbGVDaGFuZ2VUeXBlLCBGaWxlT3BlcmF0aW9uLCBJRmlsZVNlcnZpY2UsIElGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXNDaGFuZ2VFdmVudCwgSUZpbGVTeXN0ZW1Qcm92aWRlclJlZ2lzdHJhdGlvbkV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IFZTQnVmZmVyUmVhZGFibGVTdHJlYW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weUZpbGVTZXJ2aWNlLCBXb3JraW5nQ29weUZpbGVFdmVudCB9IGZyb20gJy4vd29ya2luZ0NvcHlGaWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UgfSBmcm9tICcuL3dvcmtpbmdDb3B5QmFja3VwLmpzJztcbmltcG9ydCB7IEJhc2VGaWxlV29ya2luZ0NvcHlNYW5hZ2VyLCBJQmFzZUZpbGVXb3JraW5nQ29weU1hbmFnZXIgfSBmcm9tICcuL2Fic3RyYWN0RmlsZVdvcmtpbmdDb3B5TWFuYWdlci5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFbGV2YXRlZEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZmlsZXMvY29tbW9uL2VsZXZhdGVkRmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9maWxlc0NvbmZpZ3VyYXRpb24vY29tbW9uL2ZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5RWRpdG9yU2VydmljZSB9IGZyb20gJy4vd29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weVNlcnZpY2UgfSBmcm9tICcuL3dvcmtpbmdDb3B5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBpc1dlYiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IFNuYXBzaG90Q29udGV4dCB9IGZyb20gJy4vZmlsZVdvcmtpbmdDb3B5LmpzJztcbmltcG9ydCB7IElQcm9ncmVzc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuXG4vKipcbiAqIFRoZSBvbmx5IG9uZSB0aGF0IHNob3VsZCBiZSBkZWFsaW5nIHdpdGggYElTdG9yZWRGaWxlV29ya2luZ0NvcHlgIGFuZCBoYW5kbGUgYWxsXG4gKiBvcGVyYXRpb25zIHRoYXQgYXJlIHdvcmtpbmcgY29weSByZWxhdGVkLCBzdWNoIGFzIHNhdmUvcmV2ZXJ0LCBiYWNrdXBcbiAqIGFuZCByZXNvbHZpbmcuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgSVN0b3JlZEZpbGVXb3JraW5nQ29weU1hbmFnZXI8TSBleHRlbmRzIElTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbD4gZXh0ZW5kcyBJQmFzZUZpbGVXb3JraW5nQ29weU1hbmFnZXI8TSwgSVN0b3JlZEZpbGVXb3JraW5nQ29weTxNPj4ge1xuXG5cdC8qKlxuXHQgKiBBbiBldmVudCBmb3Igd2hlbiBhIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSB3YXMgcmVzb2x2ZWQuXG5cdCAqL1xuXHRyZWFkb25seSBvbkRpZFJlc29sdmU6IEV2ZW50PElTdG9yZWRGaWxlV29ya2luZ0NvcHk8TT4+O1xuXG5cdC8qKlxuXHQgKiBBbiBldmVudCBmb3Igd2hlbiBhIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBjaGFuZ2VkIGl0J3MgZGlydHkgc3RhdGUuXG5cdCAqL1xuXHRyZWFkb25seSBvbkRpZENoYW5nZURpcnR5OiBFdmVudDxJU3RvcmVkRmlsZVdvcmtpbmdDb3B5PE0+PjtcblxuXHQvKipcblx0ICogQW4gZXZlbnQgZm9yIHdoZW4gYSBzdG9yZWQgZmlsZSB3b3JraW5nIGNvcHkgY2hhbmdlZCBpdCdzIHJlYWRvbmx5IHN0YXRlLlxuXHQgKi9cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VSZWFkb25seTogRXZlbnQ8SVN0b3JlZEZpbGVXb3JraW5nQ29weTxNPj47XG5cblx0LyoqXG5cdCAqIEFuIGV2ZW50IGZvciB3aGVuIGEgc3RvcmVkIGZpbGUgd29ya2luZyBjb3B5IGNoYW5nZWQgaXQncyBvcnBoYW5lZCBzdGF0ZS5cblx0ICovXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlT3JwaGFuZWQ6IEV2ZW50PElTdG9yZWRGaWxlV29ya2luZ0NvcHk8TT4+O1xuXG5cdC8qKlxuXHQgKiBBbiBldmVudCBmb3Igd2hlbiBhIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBmYWlsZWQgdG8gc2F2ZS5cblx0ICovXG5cdHJlYWRvbmx5IG9uRGlkU2F2ZUVycm9yOiBFdmVudDxJU3RvcmVkRmlsZVdvcmtpbmdDb3B5PE0+PjtcblxuXHQvKipcblx0ICogQW4gZXZlbnQgZm9yIHdoZW4gYSBzdG9yZWQgZmlsZSB3b3JraW5nIGNvcHkgc3VjY2Vzc2Z1bGx5IHNhdmVkLlxuXHQgKi9cblx0cmVhZG9ubHkgb25EaWRTYXZlOiBFdmVudDxJU3RvcmVkRmlsZVdvcmtpbmdDb3B5U2F2ZUV2ZW50PE0+PjtcblxuXHQvKipcblx0ICogQW4gZXZlbnQgZm9yIHdoZW4gYSBzdG9yZWQgZmlsZSB3b3JraW5nIGNvcHkgd2FzIHJldmVydGVkLlxuXHQgKi9cblx0cmVhZG9ubHkgb25EaWRSZXZlcnQ6IEV2ZW50PElTdG9yZWRGaWxlV29ya2luZ0NvcHk8TT4+O1xuXG5cdC8qKlxuXHQgKiBBbiBldmVudCBmb3Igd2hlbiBhIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBpcyByZW1vdmVkIGZyb20gdGhlIG1hbmFnZXIuXG5cdCAqL1xuXHRyZWFkb25seSBvbkRpZFJlbW92ZTogRXZlbnQ8VVJJPjtcblxuXHQvKipcblx0ICogQWxsb3dzIHRvIHJlc29sdmUgYSBzdG9yZWQgZmlsZSB3b3JraW5nIGNvcHkuIElmIHRoZSBtYW5hZ2VyIGFscmVhZHkga25vd3Ncblx0ICogYWJvdXQgYSBzdG9yZWQgZmlsZSB3b3JraW5nIGNvcHkgd2l0aCB0aGUgc2FtZSBgVVJJYCwgaXQgd2lsbCByZXR1cm4gdGhhdFxuXHQgKiBleGlzdGluZyBzdG9yZWQgZmlsZSB3b3JraW5nIGNvcHkuIFRoZXJlIHdpbGwgbmV2ZXIgYmUgbW9yZSB0aGFuIG9uZVxuXHQgKiBzdG9yZWQgZmlsZSB3b3JraW5nIGNvcHkgcGVyIGBVUklgIHVudGlsIHRoZSBzdG9yZWQgZmlsZSB3b3JraW5nIGNvcHkgaXNcblx0ICogZGlzcG9zZWQuXG5cdCAqXG5cdCAqIFVzZSB0aGUgYElTdG9yZWRGaWxlV29ya2luZ0NvcHlSZXNvbHZlT3B0aW9ucy5yZWxvYWRgIG9wdGlvbiB0byBjb250cm9sIHRoZVxuXHQgKiBiZWhhdmlvdXIgZm9yIHdoZW4gYSBzdG9yZWQgZmlsZSB3b3JraW5nIGNvcHkgd2FzIHByZXZpb3VzbHkgYWxyZWFkeSByZXNvbHZlZFxuXHQgKiB3aXRoIHJlZ2FyZHMgdG8gcmVzb2x2aW5nIGl0IGFnYWluIGZyb20gdGhlIHVuZGVybHlpbmcgZmlsZSByZXNvdXJjZVxuXHQgKiBvciBub3QuXG5cdCAqXG5cdCAqIE5vdGU6IENhbGxlcnMgbXVzdCBgZGlzcG9zZWAgdGhlIHdvcmtpbmcgY29weSB3aGVuIG5vIGxvbmdlciBuZWVkZWQuXG5cdCAqXG5cdCAqIEBwYXJhbSByZXNvdXJjZSB1c2VkIGFzIHVuaXF1ZSBpZGVudGlmaWVyIG9mIHRoZSBzdG9yZWQgZmlsZSB3b3JraW5nIGNvcHkgaW5cblx0ICogY2FzZSBvbmUgaXMgYWxyZWFkeSBrbm93biBmb3IgdGhpcyBgVVJJYC5cblx0ICogQHBhcmFtIG9wdGlvbnNcblx0ICovXG5cdHJlc29sdmUocmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IElTdG9yZWRGaWxlV29ya2luZ0NvcHlNYW5hZ2VyUmVzb2x2ZU9wdGlvbnMpOiBQcm9taXNlPElTdG9yZWRGaWxlV29ya2luZ0NvcHk8TT4+O1xuXG5cdC8qKlxuXHQgKiBXYWl0cyBmb3IgdGhlIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSB0byBiZSByZWFkeSB0byBiZSBkaXNwb3NlZC4gVGhlcmUgbWF5IGJlXG5cdCAqIGNvbmRpdGlvbnMgdW5kZXIgd2hpY2ggdGhlIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBjYW5ub3QgYmUgZGlzcG9zZWQsIGUuZy4gd2hlblxuXHQgKiBpdCBpcyBkaXJ0eS4gT25jZSB0aGUgcHJvbWlzZSBpcyBzZXR0bGVkLCBpdCBpcyBzYWZlIHRvIGRpc3Bvc2UuXG5cdCAqL1xuXHRjYW5EaXNwb3NlKHdvcmtpbmdDb3B5OiBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5PE0+KTogdHJ1ZSB8IFByb21pc2U8dHJ1ZT47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN0b3JlZEZpbGVXb3JraW5nQ29weVNhdmVFdmVudDxNIGV4dGVuZHMgSVN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsPiBleHRlbmRzIElCYXNlU3RvcmVkRmlsZVdvcmtpbmdDb3B5U2F2ZUV2ZW50IHtcblxuXHQvKipcblx0ICogVGhlIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSB0aGF0IHdhcyBzdWNjZXNzZnVsbHkgc2F2ZWQuXG5cdCAqL1xuXHRyZWFkb25seSB3b3JraW5nQ29weTogSVN0b3JlZEZpbGVXb3JraW5nQ29weTxNPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5TWFuYWdlclJlc29sdmVPcHRpb25zIGV4dGVuZHMgSVN0b3JlZEZpbGVXb3JraW5nQ29weVJlc29sdmVPcHRpb25zIHtcblxuXHQvKipcblx0ICogSWYgdGhlIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSB3YXMgYWxyZWFkeSByZXNvbHZlZCBiZWZvcmUsXG5cdCAqIGFsbG93cyB0byB0cmlnZ2VyIGEgcmVsb2FkIG9mIGl0IHRvIGZldGNoIHRoZSBsYXRlc3QgY29udGVudHMuXG5cdCAqL1xuXHRyZWFkb25seSByZWxvYWQ/OiB7XG5cblx0XHQvKipcblx0XHQgKiBDb250cm9scyB3aGV0aGVyIHRoZSByZWxvYWQgaGFwcGVucyBpbiB0aGUgYmFja2dyb3VuZFxuXHRcdCAqIG9yIHdoZXRoZXIgYHJlc29sdmVgIHdpbGwgYXdhaXQgdGhlIHJlbG9hZCB0byBoYXBwZW4uXG5cdFx0ICovXG5cdFx0cmVhZG9ubHkgYXN5bmM6IGJvb2xlYW47XG5cblx0XHQvKipcblx0XHQgKiBDb250cm9scyB3aGV0aGVyIHRvIGZvcmNlIHJlYWRpbmcgdGhlIGNvbnRlbnRzIGZyb20gdGhlXG5cdFx0ICogdW5kZXJseWluZyByZXNvdXJjZSBldmVuIGlmIHRoZSByZXNvdXJjZSBkaWQgbm90IGNoYW5nZS5cblx0XHQgKi9cblx0XHRyZWFkb25seSBmb3JjZT86IGJvb2xlYW47XG5cdH07XG59XG5cbmV4cG9ydCBjbGFzcyBTdG9yZWRGaWxlV29ya2luZ0NvcHlNYW5hZ2VyPE0gZXh0ZW5kcyBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWw+IGV4dGVuZHMgQmFzZUZpbGVXb3JraW5nQ29weU1hbmFnZXI8TSwgSVN0b3JlZEZpbGVXb3JraW5nQ29weTxNPj4gaW1wbGVtZW50cyBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5TWFuYWdlcjxNPiB7XG5cblx0Ly8jcmVnaW9uIEV2ZW50c1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmVzb2x2ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElTdG9yZWRGaWxlV29ya2luZ0NvcHk8TT4+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlc29sdmUgPSB0aGlzLl9vbkRpZFJlc29sdmUuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VEaXJ0eSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElTdG9yZWRGaWxlV29ya2luZ0NvcHk8TT4+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZURpcnR5ID0gdGhpcy5fb25EaWRDaGFuZ2VEaXJ0eS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVJlYWRvbmx5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVN0b3JlZEZpbGVXb3JraW5nQ29weTxNPj4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUmVhZG9ubHkgPSB0aGlzLl9vbkRpZENoYW5nZVJlYWRvbmx5LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlT3JwaGFuZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJU3RvcmVkRmlsZVdvcmtpbmdDb3B5PE0+PigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VPcnBoYW5lZCA9IHRoaXMuX29uRGlkQ2hhbmdlT3JwaGFuZWQuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTYXZlRXJyb3IgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJU3RvcmVkRmlsZVdvcmtpbmdDb3B5PE0+PigpKTtcblx0cmVhZG9ubHkgb25EaWRTYXZlRXJyb3IgPSB0aGlzLl9vbkRpZFNhdmVFcnJvci5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFNhdmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJU3RvcmVkRmlsZVdvcmtpbmdDb3B5U2F2ZUV2ZW50PE0+PigpKTtcblx0cmVhZG9ubHkgb25EaWRTYXZlID0gdGhpcy5fb25EaWRTYXZlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmV2ZXJ0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVN0b3JlZEZpbGVXb3JraW5nQ29weTxNPj4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkUmV2ZXJ0ID0gdGhpcy5fb25EaWRSZXZlcnQuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZW1vdmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxVUkk+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlbW92ZSA9IHRoaXMuX29uRGlkUmVtb3ZlLmV2ZW50O1xuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdHByaXZhdGUgcmVhZG9ubHkgbWFwUmVzb3VyY2VUb1dvcmtpbmdDb3B5TGlzdGVuZXJzID0gbmV3IFJlc291cmNlTWFwPElEaXNwb3NhYmxlPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IG1hcFJlc291cmNlVG9QZW5kaW5nV29ya2luZ0NvcHlSZXNvbHZlID0gbmV3IFJlc291cmNlTWFwPFByb21pc2U8dm9pZD4+KCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSB3b3JraW5nQ29weVJlc29sdmVRdWV1ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSZXNvdXJjZVF1ZXVlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgd29ya2luZ0NvcHlUeXBlSWQ6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IG1vZGVsRmFjdG9yeTogSVN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsRmFjdG9yeTxNPixcblx0XHRASUZpbGVTZXJ2aWNlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJV29ya2luZ0NvcHlGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtpbmdDb3B5RmlsZVNlcnZpY2U6IElXb3JraW5nQ29weUZpbGVTZXJ2aWNlLFxuXHRcdEBJV29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlIHdvcmtpbmdDb3B5QmFja3VwU2VydmljZTogSVdvcmtpbmdDb3B5QmFja3VwU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVdvcmtpbmdDb3B5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtpbmdDb3B5U2VydmljZTogSVdvcmtpbmdDb3B5U2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASVdvcmtpbmdDb3B5RWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtpbmdDb3B5RWRpdG9yU2VydmljZTogSVdvcmtpbmdDb3B5RWRpdG9yU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASUVsZXZhdGVkRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlbGV2YXRlZEZpbGVTZXJ2aWNlOiBJRWxldmF0ZWRGaWxlU2VydmljZSxcblx0XHRASVByb2dyZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByb2dyZXNzU2VydmljZTogSVByb2dyZXNzU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihmaWxlU2VydmljZSwgbG9nU2VydmljZSwgd29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cblx0XHQvLyBVcGRhdGUgd29ya2luZyBjb3BpZXMgZnJvbSBmaWxlIGNoYW5nZSBldmVudHNcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVTZXJ2aWNlLm9uRGlkRmlsZXNDaGFuZ2UoZSA9PiB0aGlzLm9uRGlkRmlsZXNDaGFuZ2UoZSkpKTtcblxuXHRcdC8vIEZpbGUgc3lzdGVtIHByb3ZpZGVyIGNoYW5nZXNcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVTZXJ2aWNlLm9uRGlkQ2hhbmdlRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzKGUgPT4gdGhpcy5vbkRpZENoYW5nZUZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcyhlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZmlsZVNlcnZpY2Uub25EaWRDaGFuZ2VGaWxlU3lzdGVtUHJvdmlkZXJSZWdpc3RyYXRpb25zKGUgPT4gdGhpcy5vbkRpZENoYW5nZUZpbGVTeXN0ZW1Qcm92aWRlclJlZ2lzdHJhdGlvbnMoZSkpKTtcblxuXHRcdC8vIFdvcmtpbmcgY29weSBvcGVyYXRpb25zXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53b3JraW5nQ29weUZpbGVTZXJ2aWNlLm9uV2lsbFJ1bldvcmtpbmdDb3B5RmlsZU9wZXJhdGlvbihlID0+IHRoaXMub25XaWxsUnVuV29ya2luZ0NvcHlGaWxlT3BlcmF0aW9uKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53b3JraW5nQ29weUZpbGVTZXJ2aWNlLm9uRGlkRmFpbFdvcmtpbmdDb3B5RmlsZU9wZXJhdGlvbihlID0+IHRoaXMub25EaWRGYWlsV29ya2luZ0NvcHlGaWxlT3BlcmF0aW9uKGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53b3JraW5nQ29weUZpbGVTZXJ2aWNlLm9uRGlkUnVuV29ya2luZ0NvcHlGaWxlT3BlcmF0aW9uKGUgPT4gdGhpcy5vbkRpZFJ1bldvcmtpbmdDb3B5RmlsZU9wZXJhdGlvbihlKSkpO1xuXG5cdFx0Ly8gTGlmZWN5Y2xlXG5cdFx0aWYgKGlzV2ViKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmxpZmVjeWNsZVNlcnZpY2Uub25CZWZvcmVTaHV0ZG93bihldmVudCA9PiBldmVudC52ZXRvKHRoaXMub25CZWZvcmVTaHV0ZG93bldlYigpLCAndmV0by5maWxlV29ya2luZ0NvcHlNYW5hZ2VyJykpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5saWZlY3ljbGVTZXJ2aWNlLm9uV2lsbFNodXRkb3duKGV2ZW50ID0+IGV2ZW50LmpvaW4odGhpcy5vbldpbGxTaHV0ZG93bkRlc2t0b3AoKSwgeyBpZDogJ2pvaW4uZmlsZVdvcmtpbmdDb3B5TWFuYWdlcicsIGxhYmVsOiBsb2NhbGl6ZSgnam9pbi5maWxlV29ya2luZ0NvcHlNYW5hZ2VyJywgXCJTYXZpbmcgd29ya2luZyBjb3BpZXNcIikgfSkpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uQmVmb3JlU2h1dGRvd25XZWIoKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMud29ya2luZ0NvcGllcy5zb21lKHdvcmtpbmdDb3B5ID0+IHdvcmtpbmdDb3B5Lmhhc1N0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLlBFTkRJTkdfU0FWRSkpKSB7XG5cdFx0XHQvLyBzdG9yZWQgZmlsZSB3b3JraW5nIGNvcGllcyBhcmUgcGVuZGluZyB0byBiZSBzYXZlZDpcblx0XHRcdC8vIHZldG8gYmVjYXVzZSB3ZWIgZG9lcyBub3Qgc3VwcG9ydCBsb25nIHJ1bm5pbmcgc2h1dGRvd25cblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb25XaWxsU2h1dGRvd25EZXNrdG9wKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCBwZW5kaW5nU2F2ZWRXb3JraW5nQ29waWVzOiBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5PE0+W107XG5cblx0XHQvLyBBcyBsb25nIGFzIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29waWVzIGFyZSBwZW5kaW5nIHRvIGJlIHNhdmVkLCB3ZSBwcm9sb25nIHRoZSBzaHV0ZG93blxuXHRcdC8vIHVudGlsIHRoYXQgaGFzIGhhcHBlbmVkIHRvIGVuc3VyZSB3ZSBhcmUgbm90IHNodXR0aW5nIGRvd24gaW4gdGhlIG1pZGRsZSBvZlxuXHRcdC8vIHdyaXRpbmcgdG8gdGhlIHdvcmtpbmcgY29weSAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzExNjYwMCkuXG5cdFx0d2hpbGUgKChwZW5kaW5nU2F2ZWRXb3JraW5nQ29waWVzID0gdGhpcy53b3JraW5nQ29waWVzLmZpbHRlcih3b3JraW5nQ29weSA9PiB3b3JraW5nQ29weS5oYXNTdGF0ZShTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5QRU5ESU5HX1NBVkUpKSkubGVuZ3RoID4gMCkge1xuXHRcdFx0YXdhaXQgUHJvbWlzZXMuc2V0dGxlZChwZW5kaW5nU2F2ZWRXb3JraW5nQ29waWVzLm1hcCh3b3JraW5nQ29weSA9PiB3b3JraW5nQ29weS5qb2luU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuUEVORElOR19TQVZFKSkpO1xuXHRcdH1cblx0fVxuXG5cdC8vI3JlZ2lvbiBSZXNvbHZlIGZyb20gZmlsZSBvciBmaWxlIHByb3ZpZGVyIGNoYW5nZXNcblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzKGU6IElGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXNDaGFuZ2VFdmVudCk6IHZvaWQge1xuXG5cdFx0Ly8gUmVzb2x2ZSB3b3JraW5nIGNvcGllcyBhZ2FpbiBmb3IgZmlsZSBzeXN0ZW1zIHRoYXQgY2hhbmdlZFxuXHRcdC8vIGNhcGFiaWxpdGllcyB0byBmZXRjaCBsYXRlc3QgbWV0YWRhdGEgKGUuZy4gcmVhZG9ubHkpXG5cdFx0Ly8gaW50byBhbGwgd29ya2luZyBjb3BpZXMuXG5cdFx0dGhpcy5xdWV1ZVdvcmtpbmdDb3B5UmVsb2FkcyhlLnNjaGVtZSk7XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkQ2hhbmdlRmlsZVN5c3RlbVByb3ZpZGVyUmVnaXN0cmF0aW9ucyhlOiBJRmlsZVN5c3RlbVByb3ZpZGVyUmVnaXN0cmF0aW9uRXZlbnQpOiB2b2lkIHtcblx0XHRpZiAoIWUuYWRkZWQpIHtcblx0XHRcdHJldHVybjsgLy8gb25seSBpZiBhZGRlZFxuXHRcdH1cblxuXHRcdC8vIFJlc29sdmUgd29ya2luZyBjb3BpZXMgYWdhaW4gZm9yIGZpbGUgc3lzdGVtcyB0aGF0IHJlZ2lzdGVyZWRcblx0XHQvLyB0byBhY2NvdW50IGZvciBjYXBhYmlsaXR5IGNoYW5nZXM6IGV4dGVuc2lvbnMgbWF5IHVucmVnaXN0ZXJcblx0XHQvLyBhbmQgcmVnaXN0ZXIgdGhlIHNhbWUgcHJvdmlkZXIgd2l0aCBkaWZmZXJlbnQgY2FwYWJpbGl0aWVzLFxuXHRcdC8vIHNvIHdlIHdhbnQgdG8gZW5zdXJlIHRvIGZldGNoIGxhdGVzdCBtZXRhZGF0YSAoZS5nLiByZWFkb25seSlcblx0XHQvLyBpbnRvIGFsbCB3b3JraW5nIGNvcGllcy5cblx0XHR0aGlzLnF1ZXVlV29ya2luZ0NvcHlSZWxvYWRzKGUuc2NoZW1lKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRGaWxlc0NoYW5nZShlOiBGaWxlQ2hhbmdlc0V2ZW50KTogdm9pZCB7XG5cblx0XHQvLyBUcmlnZ2VyIGEgcmVzb2x2ZSBmb3IgYW55IHVwZGF0ZSBvciBhZGQgZXZlbnQgdGhhdCBpbXBhY3RzXG5cdFx0Ly8gdGhlIHdvcmtpbmcgY29weS4gV2UgYWxzbyBjb25zaWRlciB0aGUgYWRkZWQgZXZlbnRcblx0XHQvLyBiZWNhdXNlIGl0IGNvdWxkIGJlIHRoYXQgYSBmaWxlIHdhcyBhZGRlZCBhbmQgdXBkYXRlZFxuXHRcdC8vIHJpZ2h0IGFmdGVyLlxuXHRcdHRoaXMucXVldWVXb3JraW5nQ29weVJlbG9hZHMoZSk7XG5cdH1cblxuXHRwcml2YXRlIHF1ZXVlV29ya2luZ0NvcHlSZWxvYWRzKHNjaGVtZTogc3RyaW5nKTogdm9pZDtcblx0cHJpdmF0ZSBxdWV1ZVdvcmtpbmdDb3B5UmVsb2FkcyhlOiBGaWxlQ2hhbmdlc0V2ZW50KTogdm9pZDtcblx0cHJpdmF0ZSBxdWV1ZVdvcmtpbmdDb3B5UmVsb2FkcyhzY2hlbWVPckV2ZW50OiBzdHJpbmcgfCBGaWxlQ2hhbmdlc0V2ZW50KTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCB3b3JraW5nQ29weSBvZiB0aGlzLndvcmtpbmdDb3BpZXMpIHtcblx0XHRcdGlmICh3b3JraW5nQ29weS5pc0RpcnR5KCkpIHtcblx0XHRcdFx0Y29udGludWU7IC8vIG5ldmVyIHJlbG9hZCBkaXJ0eSB3b3JraW5nIGNvcGllc1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgcmVzb2x2ZVdvcmtpbmdDb3B5ID0gZmFsc2U7XG5cdFx0XHRpZiAodHlwZW9mIHNjaGVtZU9yRXZlbnQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdHJlc29sdmVXb3JraW5nQ29weSA9IHNjaGVtZU9yRXZlbnQgPT09IHdvcmtpbmdDb3B5LnJlc291cmNlLnNjaGVtZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJlc29sdmVXb3JraW5nQ29weSA9IHNjaGVtZU9yRXZlbnQuY29udGFpbnMod29ya2luZ0NvcHkucmVzb3VyY2UsIEZpbGVDaGFuZ2VUeXBlLlVQREFURUQsIEZpbGVDaGFuZ2VUeXBlLkFEREVEKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHJlc29sdmVXb3JraW5nQ29weSkge1xuXHRcdFx0XHR0aGlzLnF1ZXVlV29ya2luZ0NvcHlSZWxvYWQod29ya2luZ0NvcHkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcXVldWVXb3JraW5nQ29weVJlbG9hZCh3b3JraW5nQ29weTogSVN0b3JlZEZpbGVXb3JraW5nQ29weTxNPik6IHZvaWQge1xuXG5cdFx0Ly8gUmVzb2x2ZXMgYSB3b3JraW5nIGNvcHkgdG8gdXBkYXRlICh1c2UgYSBxdWV1ZSB0byBwcmV2ZW50IGFjY3VtdWxhdGlvbiBvZlxuXHRcdC8vIHJlc29sdmUgd2hlbiB0aGUgcmVzb2x2aW5nIGFjdHVhbGx5IHRha2VzIGxvbmcuIEF0IG1vc3Qgd2Ugb25seSB3YW50IHRoZVxuXHRcdC8vIHF1ZXVlIHRvIGhhdmUgYSBzaXplIG9mIDIgKDEgcnVubmluZyByZXNvbHZlIGFuZCAxIHF1ZXVlZCByZXNvbHZlKS5cblx0XHRjb25zdCBxdWV1ZVNpemUgPSB0aGlzLndvcmtpbmdDb3B5UmVzb2x2ZVF1ZXVlLnF1ZXVlU2l6ZSh3b3JraW5nQ29weS5yZXNvdXJjZSk7XG5cdFx0aWYgKHF1ZXVlU2l6ZSA8PSAxKSB7XG5cdFx0XHR0aGlzLndvcmtpbmdDb3B5UmVzb2x2ZVF1ZXVlLnF1ZXVlRm9yKHdvcmtpbmdDb3B5LnJlc291cmNlLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5yZWxvYWQod29ya2luZ0NvcHkpO1xuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBXb3JraW5nIENvcHkgRmlsZSBFdmVudHNcblxuXHRwcml2YXRlIHJlYWRvbmx5IG1hcENvcnJlbGF0aW9uSWRUb1dvcmtpbmdDb3BpZXNUb1Jlc3RvcmUgPSBuZXcgTWFwPG51bWJlciwgeyBzb3VyY2U6IFVSSTsgdGFyZ2V0OiBVUkk7IHNuYXBzaG90PzogVlNCdWZmZXJSZWFkYWJsZVN0cmVhbSB9W10+KCk7XG5cblx0cHJpdmF0ZSBvbldpbGxSdW5Xb3JraW5nQ29weUZpbGVPcGVyYXRpb24oZTogV29ya2luZ0NvcHlGaWxlRXZlbnQpOiB2b2lkIHtcblxuXHRcdC8vIE1vdmUgLyBDb3B5OiByZW1lbWJlciB3b3JraW5nIGNvcGllcyB0byByZXN0b3JlIGFmdGVyIHRoZSBvcGVyYXRpb25cblx0XHRpZiAoZS5vcGVyYXRpb24gPT09IEZpbGVPcGVyYXRpb24uTU9WRSB8fCBlLm9wZXJhdGlvbiA9PT0gRmlsZU9wZXJhdGlvbi5DT1BZKSB7XG5cdFx0XHRlLndhaXRVbnRpbCgoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCB3b3JraW5nQ29waWVzVG9SZXN0b3JlOiB7IHNvdXJjZTogVVJJOyB0YXJnZXQ6IFVSSTsgc25hcHNob3Q/OiBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtIH1bXSA9IFtdO1xuXG5cdFx0XHRcdGZvciAoY29uc3QgeyBzb3VyY2UsIHRhcmdldCB9IG9mIGUuZmlsZXMpIHtcblx0XHRcdFx0XHRpZiAoc291cmNlKSB7XG5cdFx0XHRcdFx0XHRpZiAodGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoc291cmNlLCB0YXJnZXQpKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlOyAvLyBpZ25vcmUgaWYgcmVzb3VyY2VzIGFyZSBjb25zaWRlcmVkIGVxdWFsXG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8vIEZpbmQgYWxsIHdvcmtpbmcgY29waWVzIHRoYXQgcmVsYXRlZCB0byBzb3VyY2UgKGNhbiBiZSBtYW55IGlmIHJlc291cmNlIGlzIGEgZm9sZGVyKVxuXHRcdFx0XHRcdFx0Y29uc3Qgc291cmNlV29ya2luZ0NvcGllczogSVN0b3JlZEZpbGVXb3JraW5nQ29weTxNPltdID0gW107XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHdvcmtpbmdDb3B5IG9mIHRoaXMud29ya2luZ0NvcGllcykge1xuXHRcdFx0XHRcdFx0XHRpZiAodGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWxPclBhcmVudCh3b3JraW5nQ29weS5yZXNvdXJjZSwgc291cmNlKSkge1xuXHRcdFx0XHRcdFx0XHRcdHNvdXJjZVdvcmtpbmdDb3BpZXMucHVzaCh3b3JraW5nQ29weSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Ly8gUmVtZW1iZXIgZWFjaCBzb3VyY2Ugd29ya2luZyBjb3B5IHRvIGxvYWQgYWdhaW4gYWZ0ZXIgbW92ZSBpcyBkb25lXG5cdFx0XHRcdFx0XHQvLyB3aXRoIG9wdGlvbmFsIGNvbnRlbnQgdG8gcmVzdG9yZSBpZiBpdCB3YXMgZGlydHlcblx0XHRcdFx0XHRcdGZvciAoY29uc3Qgc291cmNlV29ya2luZ0NvcHkgb2Ygc291cmNlV29ya2luZ0NvcGllcykge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBzb3VyY2VSZXNvdXJjZSA9IHNvdXJjZVdvcmtpbmdDb3B5LnJlc291cmNlO1xuXG5cdFx0XHRcdFx0XHRcdC8vIElmIHRoZSBzb3VyY2UgaXMgdGhlIGFjdHVhbCB3b3JraW5nIGNvcHksIGp1c3QgdXNlIHRhcmdldCBhcyBuZXcgcmVzb3VyY2Vcblx0XHRcdFx0XHRcdFx0bGV0IHRhcmdldFJlc291cmNlOiBVUkk7XG5cdFx0XHRcdFx0XHRcdGlmICh0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChzb3VyY2VSZXNvdXJjZSwgc291cmNlKSkge1xuXHRcdFx0XHRcdFx0XHRcdHRhcmdldFJlc291cmNlID0gdGFyZ2V0O1xuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0Ly8gT3RoZXJ3aXNlIGEgcGFyZW50IGZvbGRlciBvZiB0aGUgc291cmNlIGlzIGJlaW5nIG1vdmVkLCBzbyB3ZSBuZWVkXG5cdFx0XHRcdFx0XHRcdC8vIHRvIGNvbXB1dGUgdGhlIHRhcmdldCByZXNvdXJjZSBiYXNlZCBvbiB0aGF0XG5cdFx0XHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRcdHRhcmdldFJlc291cmNlID0gam9pblBhdGgodGFyZ2V0LCBzb3VyY2VSZXNvdXJjZS5wYXRoLnN1YnN0cihzb3VyY2UucGF0aC5sZW5ndGggKyAxKSk7XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHR3b3JraW5nQ29waWVzVG9SZXN0b3JlLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdHNvdXJjZTogc291cmNlUmVzb3VyY2UsXG5cdFx0XHRcdFx0XHRcdFx0dGFyZ2V0OiB0YXJnZXRSZXNvdXJjZSxcblx0XHRcdFx0XHRcdFx0XHRzbmFwc2hvdDogc291cmNlV29ya2luZ0NvcHkuaXNEaXJ0eSgpID8gYXdhaXQgc291cmNlV29ya2luZ0NvcHkubW9kZWw/LnNuYXBzaG90KFNuYXBzaG90Q29udGV4dC5TYXZlLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSA6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLm1hcENvcnJlbGF0aW9uSWRUb1dvcmtpbmdDb3BpZXNUb1Jlc3RvcmUuc2V0KGUuY29ycmVsYXRpb25JZCwgd29ya2luZ0NvcGllc1RvUmVzdG9yZSk7XG5cdFx0XHR9KSgpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uRGlkRmFpbFdvcmtpbmdDb3B5RmlsZU9wZXJhdGlvbihlOiBXb3JraW5nQ29weUZpbGVFdmVudCk6IHZvaWQge1xuXG5cdFx0Ly8gTW92ZSAvIENvcHk6IHJlc3RvcmUgZGlydHkgZmxhZyBvbiB3b3JraW5nIGNvcGllcyB0byByZXN0b3JlIHRoYXQgd2VyZSBkaXJ0eVxuXHRcdGlmICgoZS5vcGVyYXRpb24gPT09IEZpbGVPcGVyYXRpb24uTU9WRSB8fCBlLm9wZXJhdGlvbiA9PT0gRmlsZU9wZXJhdGlvbi5DT1BZKSkge1xuXHRcdFx0Y29uc3Qgd29ya2luZ0NvcGllc1RvUmVzdG9yZSA9IHRoaXMubWFwQ29ycmVsYXRpb25JZFRvV29ya2luZ0NvcGllc1RvUmVzdG9yZS5nZXQoZS5jb3JyZWxhdGlvbklkKTtcblx0XHRcdGlmICh3b3JraW5nQ29waWVzVG9SZXN0b3JlKSB7XG5cdFx0XHRcdHRoaXMubWFwQ29ycmVsYXRpb25JZFRvV29ya2luZ0NvcGllc1RvUmVzdG9yZS5kZWxldGUoZS5jb3JyZWxhdGlvbklkKTtcblxuXHRcdFx0XHRmb3IgKGNvbnN0IHdvcmtpbmdDb3B5IG9mIHdvcmtpbmdDb3BpZXNUb1Jlc3RvcmUpIHtcblxuXHRcdFx0XHRcdC8vIFNuYXBzaG90IHByZXNlbmNlIG1lYW5zIHRoaXMgd29ya2luZyBjb3B5IHVzZWQgdG8gYmUgbW9kaWZpZWQgYW5kIHNvIHdlIHJlc3RvcmUgdGhhdFxuXHRcdFx0XHRcdC8vIGZsYWcuIHdlIGRvIE5PVCBoYXZlIHRvIHJlc3RvcmUgdGhlIGNvbnRlbnQgYmVjYXVzZSB0aGUgd29ya2luZyBjb3B5IHdhcyBvbmx5IHNvZnRcblx0XHRcdFx0XHQvLyByZXZlcnRlZCBhbmQgZGlkIG5vdCBsb29zZSBpdHMgb3JpZ2luYWwgbW9kaWZpZWQgY29udGVudHMuXG5cblx0XHRcdFx0XHRpZiAod29ya2luZ0NvcHkuc25hcHNob3QpIHtcblx0XHRcdFx0XHRcdHRoaXMuZ2V0KHdvcmtpbmdDb3B5LnNvdXJjZSk/Lm1hcmtNb2RpZmllZCgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25EaWRSdW5Xb3JraW5nQ29weUZpbGVPcGVyYXRpb24oZTogV29ya2luZ0NvcHlGaWxlRXZlbnQpOiB2b2lkIHtcblx0XHRzd2l0Y2ggKGUub3BlcmF0aW9uKSB7XG5cblx0XHRcdC8vIENyZWF0ZTogUmV2ZXJ0IGV4aXN0aW5nIHdvcmtpbmcgY29waWVzXG5cdFx0XHRjYXNlIEZpbGVPcGVyYXRpb24uQ1JFQVRFOlxuXHRcdFx0XHRlLndhaXRVbnRpbCgoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGZvciAoY29uc3QgeyB0YXJnZXQgfSBvZiBlLmZpbGVzKSB7XG5cdFx0XHRcdFx0XHRjb25zdCB3b3JraW5nQ29weSA9IHRoaXMuZ2V0KHRhcmdldCk7XG5cdFx0XHRcdFx0XHRpZiAod29ya2luZ0NvcHkgJiYgIXdvcmtpbmdDb3B5LmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0XHRcdFx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXZlcnQoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKCkpO1xuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Ly8gTW92ZS9Db3B5OiByZXN0b3JlIHdvcmtpbmcgY29waWVzIHRoYXQgd2VyZSBsb2FkZWQgYmVmb3JlIHRoZSBvcGVyYXRpb24gdG9vayBwbGFjZVxuXHRcdFx0Y2FzZSBGaWxlT3BlcmF0aW9uLk1PVkU6XG5cdFx0XHRjYXNlIEZpbGVPcGVyYXRpb24uQ09QWTpcblx0XHRcdFx0ZS53YWl0VW50aWwoKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRjb25zdCB3b3JraW5nQ29waWVzVG9SZXN0b3JlID0gdGhpcy5tYXBDb3JyZWxhdGlvbklkVG9Xb3JraW5nQ29waWVzVG9SZXN0b3JlLmdldChlLmNvcnJlbGF0aW9uSWQpO1xuXHRcdFx0XHRcdGlmICh3b3JraW5nQ29waWVzVG9SZXN0b3JlKSB7XG5cdFx0XHRcdFx0XHR0aGlzLm1hcENvcnJlbGF0aW9uSWRUb1dvcmtpbmdDb3BpZXNUb1Jlc3RvcmUuZGVsZXRlKGUuY29ycmVsYXRpb25JZCk7XG5cblx0XHRcdFx0XHRcdGF3YWl0IFByb21pc2VzLnNldHRsZWQod29ya2luZ0NvcGllc1RvUmVzdG9yZS5tYXAoYXN5bmMgd29ya2luZ0NvcHlUb1Jlc3RvcmUgPT4ge1xuXG5cdFx0XHRcdFx0XHRcdC8vIEZyb20gdGhpcyBtb21lbnQgb24sIG9ubHkgb3BlcmF0ZSBvbiB0aGUgY2Fub25pY2FsIHJlc291cmNlXG5cdFx0XHRcdFx0XHRcdC8vIHRvIGZpeCBhIHBvdGVudGlhbCBkYXRhIGxvc3MgaXNzdWU6XG5cdFx0XHRcdFx0XHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8yMTEzNzRcblx0XHRcdFx0XHRcdFx0Y29uc3QgdGFyZ2V0ID0gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuYXNDYW5vbmljYWxVcmkod29ya2luZ0NvcHlUb1Jlc3RvcmUudGFyZ2V0KTtcblxuXHRcdFx0XHRcdFx0XHQvLyBSZXN0b3JlIHRoZSB3b3JraW5nIGNvcHkgYXQgdGhlIHRhcmdldC4gaWYgd2UgaGF2ZSBwcmV2aW91cyBkaXJ0eSBjb250ZW50LCB3ZSBwYXNzIGl0XG5cdFx0XHRcdFx0XHRcdC8vIG92ZXIgdG8gYmUgdXNlZCwgb3RoZXJ3aXNlIHdlIGZvcmNlIGEgcmVsb2FkIGZyb20gZGlzay4gdGhpcyBpcyBpbXBvcnRhbnRcblx0XHRcdFx0XHRcdFx0Ly8gYmVjYXVzZSB3ZSBrbm93IHRoZSBmaWxlIGhhcyBjaGFuZ2VkIG9uIGRpc2sgYWZ0ZXIgdGhlIG1vdmUgYW5kIHRoZSB3b3JraW5nIGNvcHkgbWlnaHRcblx0XHRcdFx0XHRcdFx0Ly8gaGF2ZSBzdGlsbCBleGlzdGVkIHdpdGggdGhlIHByZXZpb3VzIHN0YXRlLiB0aGlzIGVuc3VyZXMgdGhhdCB0aGUgd29ya2luZyBjb3B5IGlzIG5vdFxuXHRcdFx0XHRcdFx0XHQvLyB0cmFja2luZyBhIHN0YWxlIHN0YXRlLlxuXHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnJlc29sdmUodGFyZ2V0LCB7XG5cdFx0XHRcdFx0XHRcdFx0cmVsb2FkOiB7IGFzeW5jOiBmYWxzZSB9LCAvLyBlbmZvcmNlIGEgcmVsb2FkXG5cdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6IHdvcmtpbmdDb3B5VG9SZXN0b3JlLnNuYXBzaG90XG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkoKSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBSZWxvYWQgJiBSZXNvbHZlXG5cblx0cHJpdmF0ZSBhc3luYyByZWxvYWQod29ya2luZ0NvcHk6IElTdG9yZWRGaWxlV29ya2luZ0NvcHk8TT4pOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIEF3YWl0IGEgcGVuZGluZyB3b3JraW5nIGNvcHkgcmVzb2x2ZSBmaXJzdCBiZWZvcmUgcHJvY2VlZGluZ1xuXHRcdC8vIHRvIGVuc3VyZSB0aGF0IHdlIG5ldmVyIHJlc29sdmUgYSB3b3JraW5nIGNvcHkgbW9yZSB0aGFuIG9uY2Vcblx0XHQvLyBpbiBwYXJhbGxlbC5cblx0XHRhd2FpdCB0aGlzLmpvaW5QZW5kaW5nUmVzb2x2ZXMod29ya2luZ0NvcHkucmVzb3VyY2UpO1xuXG5cdFx0aWYgKHdvcmtpbmdDb3B5LmlzRGlydHkoKSB8fCB3b3JraW5nQ29weS5pc0Rpc3Bvc2VkKCkgfHwgIXRoaXMuaGFzKHdvcmtpbmdDb3B5LnJlc291cmNlKSkge1xuXHRcdFx0cmV0dXJuOyAvLyB0aGUgd29ya2luZyBjb3B5IHBvc3NpYmx5IGdvdCBkaXJ0eSBvciBkaXNwb3NlZCwgc28gcmV0dXJuIGVhcmx5IHRoZW5cblx0XHR9XG5cblx0XHQvLyBUcmlnZ2VyIHJlbG9hZFxuXHRcdGF3YWl0IHRoaXMuZG9SZXNvbHZlKHdvcmtpbmdDb3B5LCB7IHJlbG9hZDogeyBhc3luYzogZmFsc2UgfSB9KTtcblx0fVxuXG5cdGFzeW5jIHJlc29sdmUocmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IElTdG9yZWRGaWxlV29ya2luZ0NvcHlNYW5hZ2VyUmVzb2x2ZU9wdGlvbnMpOiBQcm9taXNlPElTdG9yZWRGaWxlV29ya2luZ0NvcHk8TT4+IHtcblxuXHRcdC8vIEF3YWl0IGEgcGVuZGluZyB3b3JraW5nIGNvcHkgcmVzb2x2ZSBmaXJzdCBiZWZvcmUgcHJvY2VlZGluZ1xuXHRcdC8vIHRvIGVuc3VyZSB0aGF0IHdlIG5ldmVyIHJlc29sdmUgYSB3b3JraW5nIGNvcHkgbW9yZSB0aGFuIG9uY2Vcblx0XHQvLyBpbiBwYXJhbGxlbC5cblx0XHRjb25zdCBwZW5kaW5nUmVzb2x2ZSA9IHRoaXMuam9pblBlbmRpbmdSZXNvbHZlcyhyZXNvdXJjZSk7XG5cdFx0aWYgKHBlbmRpbmdSZXNvbHZlKSB7XG5cdFx0XHRhd2FpdCBwZW5kaW5nUmVzb2x2ZTtcblx0XHR9XG5cblx0XHQvLyBUcmlnZ2VyIHJlc29sdmVcblx0XHRyZXR1cm4gdGhpcy5kb1Jlc29sdmUocmVzb3VyY2UsIG9wdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1Jlc29sdmUocmVzb3VyY2VPcldvcmtpbmdDb3B5OiBVUkkgfCBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5PE0+LCBvcHRpb25zPzogSVN0b3JlZEZpbGVXb3JraW5nQ29weU1hbmFnZXJSZXNvbHZlT3B0aW9ucyk6IFByb21pc2U8SVN0b3JlZEZpbGVXb3JraW5nQ29weTxNPj4ge1xuXHRcdGxldCB3b3JraW5nQ29weTogSVN0b3JlZEZpbGVXb3JraW5nQ29weTxNPiB8IHVuZGVmaW5lZDtcblx0XHRsZXQgcmVzb3VyY2U6IFVSSTtcblx0XHRpZiAoVVJJLmlzVXJpKHJlc291cmNlT3JXb3JraW5nQ29weSkpIHtcblx0XHRcdHJlc291cmNlID0gcmVzb3VyY2VPcldvcmtpbmdDb3B5O1xuXHRcdFx0d29ya2luZ0NvcHkgPSB0aGlzLmdldChyZXNvdXJjZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlc291cmNlID0gcmVzb3VyY2VPcldvcmtpbmdDb3B5LnJlc291cmNlO1xuXHRcdFx0d29ya2luZ0NvcHkgPSByZXNvdXJjZU9yV29ya2luZ0NvcHk7XG5cdFx0fVxuXG5cdFx0bGV0IHdvcmtpbmdDb3B5UmVzb2x2ZTogUHJvbWlzZTx2b2lkPjtcblx0XHRsZXQgZGlkQ3JlYXRlV29ya2luZ0NvcHkgPSBmYWxzZTtcblxuXHRcdGNvbnN0IHJlc29sdmVPcHRpb25zOiBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5UmVzb2x2ZU9wdGlvbnMgPSB7XG5cdFx0XHRjb250ZW50czogb3B0aW9ucz8uY29udGVudHMsXG5cdFx0XHRmb3JjZVJlYWRGcm9tRmlsZTogb3B0aW9ucz8ucmVsb2FkPy5mb3JjZSxcblx0XHRcdGxpbWl0czogb3B0aW9ucz8ubGltaXRzXG5cdFx0fTtcblxuXHRcdC8vIFdvcmtpbmcgY29weSBleGlzdHNcblx0XHRpZiAod29ya2luZ0NvcHkpIHtcblxuXHRcdFx0Ly8gQWx3YXlzIHJlbG9hZCBpZiBjb250ZW50cyBhcmUgcHJvdmlkZWRcblx0XHRcdGlmIChvcHRpb25zPy5jb250ZW50cykge1xuXHRcdFx0XHR3b3JraW5nQ29weVJlc29sdmUgPSB3b3JraW5nQ29weS5yZXNvbHZlKHJlc29sdmVPcHRpb25zKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVsb2FkIGFzeW5jIG9yIHN5bmMgYmFzZWQgb24gb3B0aW9uc1xuXHRcdFx0ZWxzZSBpZiAob3B0aW9ucz8ucmVsb2FkKSB7XG5cblx0XHRcdFx0Ly8gQXN5bmMgcmVsb2FkOiB0cmlnZ2VyIGEgcmVsb2FkIGJ1dCByZXR1cm4gaW1tZWRpYXRlbHlcblx0XHRcdFx0aWYgKG9wdGlvbnMucmVsb2FkLmFzeW5jKSB7XG5cdFx0XHRcdFx0d29ya2luZ0NvcHlSZXNvbHZlID0gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0XHRcdFx0KGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJlc29sdmUocmVzb2x2ZU9wdGlvbnMpO1xuXHRcdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdFx0aWYgKCF3b3JraW5nQ29weS5pc0Rpc3Bvc2VkKCkpIHtcblx0XHRcdFx0XHRcdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlcnJvcik7IC8vIG9ubHkgbG9nIGlmIHRoZSB3b3JraW5nIGNvcHkgaXMgc3RpbGwgYXJvdW5kXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KSgpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gU3luYyByZWxvYWQ6IGRvIG5vdCByZXR1cm4gdW50aWwgd29ya2luZyBjb3B5IHJlbG9hZGVkXG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdHdvcmtpbmdDb3B5UmVzb2x2ZSA9IHdvcmtpbmdDb3B5LnJlc29sdmUocmVzb2x2ZU9wdGlvbnMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIERvIG5vdCByZWxvYWRcblx0XHRcdGVsc2Uge1xuXHRcdFx0XHR3b3JraW5nQ29weVJlc29sdmUgPSBQcm9taXNlLnJlc29sdmUoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBTdG9yZWQgZmlsZSB3b3JraW5nIGNvcHkgZG9lcyBub3QgZXhpc3Rcblx0XHRlbHNlIHtcblx0XHRcdGRpZENyZWF0ZVdvcmtpbmdDb3B5ID0gdHJ1ZTtcblxuXHRcdFx0d29ya2luZ0NvcHkgPSBuZXcgU3RvcmVkRmlsZVdvcmtpbmdDb3B5KFxuXHRcdFx0XHR0aGlzLndvcmtpbmdDb3B5VHlwZUlkLFxuXHRcdFx0XHRyZXNvdXJjZSxcblx0XHRcdFx0dGhpcy5sYWJlbFNlcnZpY2UuZ2V0VXJpQmFzZW5hbWVMYWJlbChyZXNvdXJjZSksXG5cdFx0XHRcdHRoaXMubW9kZWxGYWN0b3J5LFxuXHRcdFx0XHRhc3luYyBvcHRpb25zID0+IHsgYXdhaXQgdGhpcy5yZXNvbHZlKHJlc291cmNlLCB7IC4uLm9wdGlvbnMsIHJlbG9hZDogeyBhc3luYzogZmFsc2UgfSB9KTsgfSxcblx0XHRcdFx0dGhpcy5maWxlU2VydmljZSwgdGhpcy5sb2dTZXJ2aWNlLCB0aGlzLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UsIHRoaXMuZmlsZXNDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRcdFx0dGhpcy53b3JraW5nQ29weUJhY2t1cFNlcnZpY2UsIHRoaXMud29ya2luZ0NvcHlTZXJ2aWNlLCB0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UsIHRoaXMud29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlLFxuXHRcdFx0XHR0aGlzLmVkaXRvclNlcnZpY2UsIHRoaXMuZWxldmF0ZWRGaWxlU2VydmljZSwgdGhpcy5wcm9ncmVzc1NlcnZpY2Vcblx0XHRcdCk7XG5cblx0XHRcdHdvcmtpbmdDb3B5UmVzb2x2ZSA9IHdvcmtpbmdDb3B5LnJlc29sdmUocmVzb2x2ZU9wdGlvbnMpO1xuXG5cdFx0XHR0aGlzLnJlZ2lzdGVyV29ya2luZ0NvcHkod29ya2luZ0NvcHkpO1xuXHRcdH1cblxuXHRcdC8vIFN0b3JlIHBlbmRpbmcgcmVzb2x2ZSB0byBhdm9pZCByYWNlIGNvbmRpdGlvbnNcblx0XHR0aGlzLm1hcFJlc291cmNlVG9QZW5kaW5nV29ya2luZ0NvcHlSZXNvbHZlLnNldChyZXNvdXJjZSwgd29ya2luZ0NvcHlSZXNvbHZlKTtcblxuXHRcdC8vIE1ha2Uga25vd24gdG8gbWFuYWdlciAoaWYgbm90IGFscmVhZHkga25vd24pXG5cdFx0dGhpcy5hZGQocmVzb3VyY2UsIHdvcmtpbmdDb3B5KTtcblxuXHRcdC8vIEVtaXQgc29tZSBldmVudHMgaWYgd2UgY3JlYXRlZCB0aGUgd29ya2luZyBjb3B5XG5cdFx0aWYgKGRpZENyZWF0ZVdvcmtpbmdDb3B5KSB7XG5cblx0XHRcdC8vIElmIHRoZSB3b3JraW5nIGNvcHkgaXMgZGlydHkgcmlnaHQgZnJvbSB0aGUgYmVnaW5uaW5nLFxuXHRcdFx0Ly8gbWFrZSBzdXJlIHRvIGVtaXQgdGhpcyBhcyBhbiBldmVudFxuXHRcdFx0aWYgKHdvcmtpbmdDb3B5LmlzRGlydHkoKSkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZURpcnR5LmZpcmUod29ya2luZ0NvcHkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB3b3JraW5nQ29weVJlc29sdmU7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblxuXHRcdFx0Ly8gQXV0b21hdGljYWxseSBkaXNwb3NlIHRoZSB3b3JraW5nIGNvcHkgaWYgd2UgY3JlYXRlZFxuXHRcdFx0Ly8gaXQgYmVjYXVzZSB3ZSBjYW5ub3QgZGlzcG9zZSBhIHdvcmtpbmcgY29weSB3ZSBkbyBub3Rcblx0XHRcdC8vIG93biAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEzODg1MClcblx0XHRcdGlmIChkaWRDcmVhdGVXb3JraW5nQ29weSkge1xuXHRcdFx0XHR3b3JraW5nQ29weS5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cblx0XHRcdHRocm93IGVycm9yO1xuXHRcdH0gZmluYWxseSB7XG5cblx0XHRcdC8vIFJlbW92ZSBmcm9tIHBlbmRpbmcgcmVzb2x2ZXNcblx0XHRcdHRoaXMubWFwUmVzb3VyY2VUb1BlbmRpbmdXb3JraW5nQ29weVJlc29sdmUuZGVsZXRlKHJlc291cmNlKTtcblx0XHR9XG5cblx0XHQvLyBTdG9yZWQgZmlsZSB3b3JraW5nIGNvcHkgY2FuIGJlIGRpcnR5IGlmIGEgYmFja3VwIHdhcyByZXN0b3JlZCwgc28gd2UgbWFrZSBzdXJlIHRvXG5cdFx0Ly8gaGF2ZSB0aGlzIGV2ZW50IGRlbGl2ZXJlZCBpZiB3ZSBjcmVhdGVkIHRoZSB3b3JraW5nIGNvcHkgaGVyZVxuXHRcdGlmIChkaWRDcmVhdGVXb3JraW5nQ29weSAmJiB3b3JraW5nQ29weS5pc0RpcnR5KCkpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRGlydHkuZmlyZSh3b3JraW5nQ29weSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHdvcmtpbmdDb3B5O1xuXHR9XG5cblx0cHJpdmF0ZSBqb2luUGVuZGluZ1Jlc29sdmVzKHJlc291cmNlOiBVUkkpOiBQcm9taXNlPHZvaWQ+IHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBwZW5kaW5nV29ya2luZ0NvcHlSZXNvbHZlID0gdGhpcy5tYXBSZXNvdXJjZVRvUGVuZGluZ1dvcmtpbmdDb3B5UmVzb2x2ZS5nZXQocmVzb3VyY2UpO1xuXHRcdGlmICghcGVuZGluZ1dvcmtpbmdDb3B5UmVzb2x2ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmRvSm9pblBlbmRpbmdSZXNvbHZlcyhyZXNvdXJjZSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvSm9pblBlbmRpbmdSZXNvbHZlcyhyZXNvdXJjZTogVVJJKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBXaGlsZSB3ZSBoYXZlIHBlbmRpbmcgd29ya2luZyBjb3B5IHJlc29sdmVzLCBlbnN1cmVcblx0XHQvLyB0byBhd2FpdCB0aGUgbGFzdCBvbmUgZmluaXNoaW5nIGJlZm9yZSByZXR1cm5pbmcuXG5cdFx0Ly8gVGhpcyBwcmV2ZW50cyBhIHJhY2Ugd2hlbiBtdWx0aXBsZSBjbGllbnRzIGF3YWl0XG5cdFx0Ly8gdGhlIHBlbmRpbmcgcmVzb2x2ZSBhbmQgdGhlbiBhbGwgdHJpZ2dlciB0aGUgcmVzb2x2ZVxuXHRcdC8vIGF0IHRoZSBzYW1lIHRpbWUuXG5cdFx0bGV0IGN1cnJlbnRXb3JraW5nQ29weVJlc29sdmU6IFByb21pc2U8dm9pZD4gfCB1bmRlZmluZWQ7XG5cdFx0d2hpbGUgKHRoaXMubWFwUmVzb3VyY2VUb1BlbmRpbmdXb3JraW5nQ29weVJlc29sdmUuaGFzKHJlc291cmNlKSkge1xuXHRcdFx0Y29uc3QgbmV4dFBlbmRpbmdXb3JraW5nQ29weVJlc29sdmUgPSB0aGlzLm1hcFJlc291cmNlVG9QZW5kaW5nV29ya2luZ0NvcHlSZXNvbHZlLmdldChyZXNvdXJjZSk7XG5cdFx0XHRpZiAobmV4dFBlbmRpbmdXb3JraW5nQ29weVJlc29sdmUgPT09IGN1cnJlbnRXb3JraW5nQ29weVJlc29sdmUpIHtcblx0XHRcdFx0cmV0dXJuOyAvLyBhbHJlYWR5IGF3YWl0ZWQgb24gLSByZXR1cm5cblx0XHRcdH1cblxuXHRcdFx0Y3VycmVudFdvcmtpbmdDb3B5UmVzb2x2ZSA9IG5leHRQZW5kaW5nV29ya2luZ0NvcHlSZXNvbHZlO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgbmV4dFBlbmRpbmdXb3JraW5nQ29weVJlc29sdmU7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHQvLyBpZ25vcmUgYW55IGVycm9yIGhlcmUsIGl0IHdpbGwgYnViYmxlIHRvIHRoZSBvcmlnaW5hbCByZXF1ZXN0b3Jcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyV29ya2luZ0NvcHkod29ya2luZ0NvcHk6IElTdG9yZWRGaWxlV29ya2luZ0NvcHk8TT4pOiB2b2lkIHtcblxuXHRcdC8vIEluc3RhbGwgd29ya2luZyBjb3B5IGxpc3RlbmVyc1xuXHRcdGNvbnN0IHdvcmtpbmdDb3B5TGlzdGVuZXJzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHdvcmtpbmdDb3B5TGlzdGVuZXJzLmFkZCh3b3JraW5nQ29weS5vbkRpZFJlc29sdmUoKCkgPT4gdGhpcy5fb25EaWRSZXNvbHZlLmZpcmUod29ya2luZ0NvcHkpKSk7XG5cdFx0d29ya2luZ0NvcHlMaXN0ZW5lcnMuYWRkKHdvcmtpbmdDb3B5Lm9uRGlkQ2hhbmdlRGlydHkoKCkgPT4gdGhpcy5fb25EaWRDaGFuZ2VEaXJ0eS5maXJlKHdvcmtpbmdDb3B5KSkpO1xuXHRcdHdvcmtpbmdDb3B5TGlzdGVuZXJzLmFkZCh3b3JraW5nQ29weS5vbkRpZENoYW5nZVJlYWRvbmx5KCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlUmVhZG9ubHkuZmlyZSh3b3JraW5nQ29weSkpKTtcblx0XHR3b3JraW5nQ29weUxpc3RlbmVycy5hZGQod29ya2luZ0NvcHkub25EaWRDaGFuZ2VPcnBoYW5lZCgoKSA9PiB0aGlzLl9vbkRpZENoYW5nZU9ycGhhbmVkLmZpcmUod29ya2luZ0NvcHkpKSk7XG5cdFx0d29ya2luZ0NvcHlMaXN0ZW5lcnMuYWRkKHdvcmtpbmdDb3B5Lm9uRGlkU2F2ZUVycm9yKCgpID0+IHRoaXMuX29uRGlkU2F2ZUVycm9yLmZpcmUod29ya2luZ0NvcHkpKSk7XG5cdFx0d29ya2luZ0NvcHlMaXN0ZW5lcnMuYWRkKHdvcmtpbmdDb3B5Lm9uRGlkU2F2ZShlID0+IHRoaXMuX29uRGlkU2F2ZS5maXJlKHsgd29ya2luZ0NvcHksIC4uLmUgfSkpKTtcblx0XHR3b3JraW5nQ29weUxpc3RlbmVycy5hZGQod29ya2luZ0NvcHkub25EaWRSZXZlcnQoKCkgPT4gdGhpcy5fb25EaWRSZXZlcnQuZmlyZSh3b3JraW5nQ29weSkpKTtcblxuXHRcdC8vIEtlZXAgZm9yIGRpc3Bvc2FsXG5cdFx0dGhpcy5tYXBSZXNvdXJjZVRvV29ya2luZ0NvcHlMaXN0ZW5lcnMuc2V0KHdvcmtpbmdDb3B5LnJlc291cmNlLCB3b3JraW5nQ29weUxpc3RlbmVycyk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVtb3ZlKHJlc291cmNlOiBVUkkpOiBib29sZWFuIHtcblx0XHRjb25zdCByZW1vdmVkID0gc3VwZXIucmVtb3ZlKHJlc291cmNlKTtcblxuXHRcdC8vIERpc3Bvc2UgYW55IGV4aXN0aW5nIHdvcmtpbmcgY29weSBsaXN0ZW5lcnNcblx0XHRjb25zdCB3b3JraW5nQ29weUxpc3RlbmVyID0gdGhpcy5tYXBSZXNvdXJjZVRvV29ya2luZ0NvcHlMaXN0ZW5lcnMuZ2V0KHJlc291cmNlKTtcblx0XHRpZiAod29ya2luZ0NvcHlMaXN0ZW5lcikge1xuXHRcdFx0ZGlzcG9zZSh3b3JraW5nQ29weUxpc3RlbmVyKTtcblx0XHRcdHRoaXMubWFwUmVzb3VyY2VUb1dvcmtpbmdDb3B5TGlzdGVuZXJzLmRlbGV0ZShyZXNvdXJjZSk7XG5cdFx0fVxuXG5cdFx0aWYgKHJlbW92ZWQpIHtcblx0XHRcdHRoaXMuX29uRGlkUmVtb3ZlLmZpcmUocmVzb3VyY2UpO1xuXHRcdH1cblxuXHRcdHJldHVybiByZW1vdmVkO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIExpZmVjeWNsZVxuXG5cdGNhbkRpc3Bvc2Uod29ya2luZ0NvcHk6IElTdG9yZWRGaWxlV29ya2luZ0NvcHk8TT4pOiB0cnVlIHwgUHJvbWlzZTx0cnVlPiB7XG5cblx0XHQvLyBRdWljayByZXR1cm4gaWYgd29ya2luZyBjb3B5IGFscmVhZHkgZGlzcG9zZWQgb3Igbm90IGRpcnR5IGFuZCBub3QgcmVzb2x2aW5nXG5cdFx0aWYgKFxuXHRcdFx0d29ya2luZ0NvcHkuaXNEaXNwb3NlZCgpIHx8XG5cdFx0XHQoIXRoaXMubWFwUmVzb3VyY2VUb1BlbmRpbmdXb3JraW5nQ29weVJlc29sdmUuaGFzKHdvcmtpbmdDb3B5LnJlc291cmNlKSAmJiAhd29ya2luZ0NvcHkuaXNEaXJ0eSgpKVxuXHRcdCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gUHJvbWlzZSBiYXNlZCByZXR1cm4gaW4gYWxsIG90aGVyIGNhc2VzXG5cdFx0cmV0dXJuIHRoaXMuZG9DYW5EaXNwb3NlKHdvcmtpbmdDb3B5KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9DYW5EaXNwb3NlKHdvcmtpbmdDb3B5OiBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5PE0+KTogUHJvbWlzZTx0cnVlPiB7XG5cblx0XHQvLyBBd2FpdCBhbnkgcGVuZGluZyByZXNvbHZlcyBmaXJzdCBiZWZvcmUgcHJvY2VlZGluZ1xuXHRcdGNvbnN0IHBlbmRpbmdSZXNvbHZlID0gdGhpcy5qb2luUGVuZGluZ1Jlc29sdmVzKHdvcmtpbmdDb3B5LnJlc291cmNlKTtcblx0XHRpZiAocGVuZGluZ1Jlc29sdmUpIHtcblx0XHRcdGF3YWl0IHBlbmRpbmdSZXNvbHZlO1xuXG5cdFx0XHRyZXR1cm4gdGhpcy5jYW5EaXNwb3NlKHdvcmtpbmdDb3B5KTtcblx0XHR9XG5cblx0XHQvLyBEaXJ0eSB3b3JraW5nIGNvcHk6IHdlIGRvIG5vdCBhbGxvdyB0byBkaXNwb3NlIGRpcnR5IHdvcmtpbmcgY29weXNcblx0XHQvLyB0byBwcmV2ZW50IGRhdGEgbG9zcyBjYXNlcy4gZGlydHkgd29ya2luZyBjb3B5cyBjYW4gb25seSBiZSBkaXNwb3NlZCB3aGVuXG5cdFx0Ly8gdGhleSBhcmUgZWl0aGVyIHNhdmVkIG9yIHJldmVydGVkXG5cdFx0aWYgKHdvcmtpbmdDb3B5LmlzRGlydHkoKSkge1xuXHRcdFx0YXdhaXQgRXZlbnQudG9Qcm9taXNlKHdvcmtpbmdDb3B5Lm9uRGlkQ2hhbmdlRGlydHkpO1xuXG5cdFx0XHRyZXR1cm4gdGhpcy5jYW5EaXNwb3NlKHdvcmtpbmdDb3B5KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXG5cdFx0Ly8gQ2xlYXIgcGVuZGluZyB3b3JraW5nIGNvcHkgcmVzb2x2ZXNcblx0XHR0aGlzLm1hcFJlc291cmNlVG9QZW5kaW5nV29ya2luZ0NvcHlSZXNvbHZlLmNsZWFyKCk7XG5cblx0XHQvLyBEaXNwb3NlIHRoZSB3b3JraW5nIGNvcHkgY2hhbmdlIGxpc3RlbmVyc1xuXHRcdGRpc3Bvc2UodGhpcy5tYXBSZXNvdXJjZVRvV29ya2luZ0NvcHlMaXN0ZW5lcnMudmFsdWVzKCkpO1xuXHRcdHRoaXMubWFwUmVzb3VyY2VUb1dvcmtpbmdDb3B5TGlzdGVuZXJzLmNsZWFyKCk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxpQkFBaUIsZUFBNEI7QUFDdEQsU0FBUyxPQUFPLGVBQWU7QUFDL0IsU0FBUyx1QkFBdUIsa0NBQXlPO0FBQ3pRLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsVUFBVSxxQkFBcUI7QUFDeEMsU0FBMkIsZ0JBQWdCLGVBQWUsb0JBQXNHO0FBQ2hLLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsV0FBVztBQUVwQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLCtCQUFxRDtBQUM5RCxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGlDQUFpQztBQUMxQyxTQUFTLGtDQUErRDtBQUN4RSxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLGlDQUFpQztBQUMxQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGFBQWE7QUFDdEIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx3QkFBd0I7QUEyRzFCLElBQU0sK0JBQU4s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
