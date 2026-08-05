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
import { Emitter, Event } from "../../../../base/common/event.js";
import { Promises } from "../../../../base/common/async.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { toLocalResource, joinPath, isEqual, basename, dirname } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { IFileDialogService, IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { SaveSourceRegistry } from "../../../common/editor.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { IPathService } from "../../path/common/pathService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { StoredFileWorkingCopyState } from "./storedFileWorkingCopy.js";
import { StoredFileWorkingCopyManager } from "./storedFileWorkingCopyManager.js";
import { UntitledFileWorkingCopy } from "./untitledFileWorkingCopy.js";
import { UntitledFileWorkingCopyManager } from "./untitledFileWorkingCopyManager.js";
import { IWorkingCopyFileService } from "./workingCopyFileService.js";
import { SnapshotContext } from "./fileWorkingCopy.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IElevatedFileService } from "../../files/common/elevatedFileService.js";
import { IFilesConfigurationService } from "../../filesConfiguration/common/filesConfigurationService.js";
import { ILifecycleService } from "../../lifecycle/common/lifecycle.js";
import { IWorkingCopyBackupService } from "./workingCopyBackup.js";
import { IWorkingCopyEditorService } from "./workingCopyEditorService.js";
import { IWorkingCopyService } from "./workingCopyService.js";
import { Schemas } from "../../../../base/common/network.js";
import { IDecorationsService } from "../../decorations/common/decorations.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { listErrorForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { IProgressService } from "../../../../platform/progress/common/progress.js";
let FileWorkingCopyManager = class extends Disposable {
  constructor(workingCopyTypeId, storedWorkingCopyModelFactory, untitledWorkingCopyModelFactory, fileService, lifecycleService, labelService, logService, workingCopyFileService, workingCopyBackupService, uriIdentityService, fileDialogService, filesConfigurationService, workingCopyService, notificationService, workingCopyEditorService, editorService, elevatedFileService, pathService, environmentService, dialogService, decorationsService, progressService) {
    super();
    this.workingCopyTypeId = workingCopyTypeId;
    this.storedWorkingCopyModelFactory = storedWorkingCopyModelFactory;
    this.untitledWorkingCopyModelFactory = untitledWorkingCopyModelFactory;
    this.fileService = fileService;
    this.logService = logService;
    this.workingCopyFileService = workingCopyFileService;
    this.uriIdentityService = uriIdentityService;
    this.fileDialogService = fileDialogService;
    this.filesConfigurationService = filesConfigurationService;
    this.pathService = pathService;
    this.environmentService = environmentService;
    this.dialogService = dialogService;
    this.decorationsService = decorationsService;
    this.stored = this._register(new StoredFileWorkingCopyManager(
      this.workingCopyTypeId,
      this.storedWorkingCopyModelFactory,
      fileService,
      lifecycleService,
      labelService,
      logService,
      workingCopyFileService,
      workingCopyBackupService,
      uriIdentityService,
      filesConfigurationService,
      workingCopyService,
      notificationService,
      workingCopyEditorService,
      editorService,
      elevatedFileService,
      progressService
    ));
    this.untitled = this._register(new UntitledFileWorkingCopyManager(
      this.workingCopyTypeId,
      this.untitledWorkingCopyModelFactory,
      async (workingCopy, options) => {
        const result = await this.saveAs(workingCopy.resource, void 0, options);
        return result ? true : false;
      },
      fileService,
      labelService,
      logService,
      workingCopyBackupService,
      workingCopyService
    ));
    this.onDidCreate = Event.any(this.stored.onDidCreate, this.untitled.onDidCreate);
    this.provideDecorations();
  }
  //#region decorations
  provideDecorations() {
    const provider = this._register(new class extends Disposable {
      constructor(stored) {
        super();
        this.stored = stored;
        this.label = localize("fileWorkingCopyDecorations", "File Working Copy Decorations");
        this._onDidChange = this._register(new Emitter());
        this.onDidChange = this._onDidChange.event;
        this.registerListeners();
      }
      registerListeners() {
        this._register(this.stored.onDidResolve((workingCopy) => {
          if (workingCopy.isReadonly() || workingCopy.hasState(StoredFileWorkingCopyState.ORPHAN)) {
            this._onDidChange.fire([workingCopy.resource]);
          }
        }));
        this._register(this.stored.onDidRemove((workingCopyUri) => this._onDidChange.fire([workingCopyUri])));
        this._register(this.stored.onDidChangeReadonly((workingCopy) => this._onDidChange.fire([workingCopy.resource])));
        this._register(this.stored.onDidChangeOrphaned((workingCopy) => this._onDidChange.fire([workingCopy.resource])));
      }
      provideDecorations(uri) {
        const workingCopy = this.stored.get(uri);
        if (!workingCopy || workingCopy.isDisposed()) {
          return void 0;
        }
        const isReadonly = workingCopy.isReadonly();
        const isOrphaned = workingCopy.hasState(StoredFileWorkingCopyState.ORPHAN);
        if (isReadonly && isOrphaned) {
          return {
            color: listErrorForeground,
            letter: Codicon.lockSmall,
            strikethrough: true,
            tooltip: localize("readonlyAndDeleted", "Deleted, Read-only")
          };
        } else if (isReadonly) {
          return {
            letter: Codicon.lockSmall,
            tooltip: localize("readonly", "Read-only")
          };
        } else if (isOrphaned) {
          return {
            color: listErrorForeground,
            strikethrough: true,
            tooltip: localize("deleted", "Deleted")
          };
        }
        return void 0;
      }
    }(this.stored));
    this._register(this.decorationsService.registerDecorationsProvider(provider));
  }
  //#endregion
  //#region get / get all
  get workingCopies() {
    return [...this.stored.workingCopies, ...this.untitled.workingCopies];
  }
  get(resource) {
    return this.stored.get(resource) ?? this.untitled.get(resource);
  }
  resolve(arg1, arg2) {
    if (URI.isUri(arg1)) {
      if (arg1.scheme === Schemas.untitled) {
        return this.untitled.resolve({ untitledResource: arg1 });
      } else {
        return this.stored.resolve(arg1, arg2);
      }
    }
    return this.untitled.resolve(arg1);
  }
  //#endregion
  //#region Save
  async saveAs(source, target, options) {
    if (!target) {
      const workingCopy = this.get(source);
      if (workingCopy instanceof UntitledFileWorkingCopy && workingCopy.hasAssociatedFilePath) {
        target = await this.suggestSavePath(source);
      } else {
        target = await this.fileDialogService.pickFileToSave(await this.suggestSavePath(options?.suggestedTarget ?? source), options?.availableFileSystems);
      }
    }
    if (!target) {
      return;
    }
    if (this.filesConfigurationService.isReadonly(target)) {
      const confirmed = await this.confirmMakeWriteable(target);
      if (!confirmed) {
        return;
      } else {
        this.filesConfigurationService.updateReadonly(target, false);
      }
    }
    if (this.fileService.hasProvider(source) && isEqual(source, target)) {
      return this.doSave(source, {
        ...options,
        force: true
        /* force to save, even if not dirty (https://github.com/microsoft/vscode/issues/99619) */
      });
    }
    if (this.fileService.hasProvider(source) && this.uriIdentityService.extUri.isEqual(source, target) && await this.fileService.exists(source)) {
      await this.workingCopyFileService.move([{ file: { source, target } }], CancellationToken.None);
      return await this.doSave(source, options) ?? await this.doSave(target, options);
    }
    return this.doSaveAs(source, target, options);
  }
  async doSave(resource, options) {
    const storedFileWorkingCopy = this.stored.get(resource);
    if (storedFileWorkingCopy) {
      const success = await storedFileWorkingCopy.save(options);
      if (success) {
        return storedFileWorkingCopy;
      }
    }
    return void 0;
  }
  async doSaveAs(source, target, options) {
    let sourceContents;
    const sourceWorkingCopy = this.get(source);
    if (sourceWorkingCopy?.isResolved()) {
      sourceContents = await sourceWorkingCopy.model.snapshot(SnapshotContext.Save, CancellationToken.None);
    } else {
      sourceContents = (await this.fileService.readFileStream(source)).value;
    }
    const { targetFileExists, targetStoredFileWorkingCopy } = await this.doResolveSaveTarget(source, target);
    if (sourceWorkingCopy instanceof UntitledFileWorkingCopy && sourceWorkingCopy.hasAssociatedFilePath && targetFileExists && this.uriIdentityService.extUri.isEqual(target, toLocalResource(sourceWorkingCopy.resource, this.environmentService.remoteAuthority, this.pathService.defaultUriScheme))) {
      const overwrite = await this.confirmOverwrite(target);
      if (!overwrite) {
        return void 0;
      }
    }
    await targetStoredFileWorkingCopy.model?.update(sourceContents, CancellationToken.None);
    if (!options?.source) {
      options = {
        ...options,
        source: targetFileExists ? FileWorkingCopyManager.FILE_WORKING_COPY_SAVE_REPLACE_SOURCE : FileWorkingCopyManager.FILE_WORKING_COPY_SAVE_CREATE_SOURCE
      };
    }
    const success = await targetStoredFileWorkingCopy.save({
      ...options,
      from: source,
      force: true
      /* force to save, even if not dirty (https://github.com/microsoft/vscode/issues/99619) */
    });
    if (!success) {
      return void 0;
    }
    try {
      await sourceWorkingCopy?.revert();
    } catch (error) {
      this.logService.error(error);
    }
    if (source.scheme === Schemas.untitled) {
      this.untitled.notifyDidSave(source, target);
    }
    return targetStoredFileWorkingCopy;
  }
  async doResolveSaveTarget(source, target) {
    let targetFileExists = false;
    let targetStoredFileWorkingCopy = this.stored.get(target);
    if (targetStoredFileWorkingCopy?.isResolved()) {
      targetFileExists = true;
    } else {
      targetFileExists = await this.fileService.exists(target);
      if (!targetFileExists) {
        await this.workingCopyFileService.create([{ resource: target }], CancellationToken.None);
      }
      if (this.uriIdentityService.extUri.isEqual(source, target) && this.get(source)) {
        targetStoredFileWorkingCopy = await this.stored.resolve(source);
      } else {
        targetStoredFileWorkingCopy = await this.stored.resolve(target);
      }
    }
    return { targetFileExists, targetStoredFileWorkingCopy };
  }
  async confirmOverwrite(resource) {
    const { confirmed } = await this.dialogService.confirm({
      type: "warning",
      message: localize("confirmOverwrite", "'{0}' already exists. Do you want to replace it?", basename(resource)),
      detail: localize("overwriteIrreversible", "A file or folder with the name '{0}' already exists in the folder '{1}'. Replacing it will overwrite its current contents.", basename(resource), basename(dirname(resource))),
      primaryButton: localize({ key: "replaceButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Replace")
    });
    return confirmed;
  }
  async confirmMakeWriteable(resource) {
    const { confirmed } = await this.dialogService.confirm({
      type: "warning",
      message: localize("confirmMakeWriteable", "'{0}' is marked as read-only. Do you want to save anyway?", basename(resource)),
      detail: localize("confirmMakeWriteableDetail", "Paths can be configured as read-only via settings."),
      primaryButton: localize({ key: "makeWriteableButtonLabel", comment: ["&& denotes a mnemonic"] }, "&&Save Anyway")
    });
    return confirmed;
  }
  async suggestSavePath(resource) {
    if (this.fileService.hasProvider(resource)) {
      return resource;
    }
    const workingCopy = this.get(resource);
    if (workingCopy instanceof UntitledFileWorkingCopy && workingCopy.hasAssociatedFilePath) {
      return toLocalResource(resource, this.environmentService.remoteAuthority, this.pathService.defaultUriScheme);
    }
    const defaultFilePath = await this.fileDialogService.defaultFilePath();
    if (workingCopy) {
      const candidatePath = joinPath(defaultFilePath, workingCopy.name);
      if (await this.pathService.hasValidBasename(candidatePath, workingCopy.name)) {
        return candidatePath;
      }
    }
    return joinPath(defaultFilePath, basename(resource));
  }
  //#endregion
  //#region Lifecycle
  async destroy() {
    await Promises.settled([
      this.stored.destroy(),
      this.untitled.destroy()
    ]);
  }
  //#endregion
};
FileWorkingCopyManager.FILE_WORKING_COPY_SAVE_CREATE_SOURCE = SaveSourceRegistry.registerSource("fileWorkingCopyCreate.source", localize("fileWorkingCopyCreate.source", "File Created"));
FileWorkingCopyManager.FILE_WORKING_COPY_SAVE_REPLACE_SOURCE = SaveSourceRegistry.registerSource("fileWorkingCopyReplace.source", localize("fileWorkingCopyReplace.source", "File Replaced"));
FileWorkingCopyManager = __decorateClass([
  __decorateParam(3, IFileService),
  __decorateParam(4, ILifecycleService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IWorkingCopyFileService),
  __decorateParam(8, IWorkingCopyBackupService),
  __decorateParam(9, IUriIdentityService),
  __decorateParam(10, IFileDialogService),
  __decorateParam(11, IFilesConfigurationService),
  __decorateParam(12, IWorkingCopyService),
  __decorateParam(13, INotificationService),
  __decorateParam(14, IWorkingCopyEditorService),
  __decorateParam(15, IEditorService),
  __decorateParam(16, IElevatedFileService),
  __decorateParam(17, IPathService),
  __decorateParam(18, IWorkbenchEnvironmentService),
  __decorateParam(19, IDialogService),
  __decorateParam(20, IDecorationsService),
  __decorateParam(21, IProgressService)
], FileWorkingCopyManager);
export {
  FileWorkingCopyManager
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL2ZpbGVXb3JraW5nQ29weU1hbmFnZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFByb21pc2VzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXJSZWFkYWJsZVN0cmVhbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IHRvTG9jYWxSZXNvdXJjZSwgam9pblBhdGgsIGlzRXF1YWwsIGJhc2VuYW1lLCBkaXJuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJRmlsZURpYWxvZ1NlcnZpY2UsIElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSVNhdmVPcHRpb25zLCBTYXZlU291cmNlUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElQYXRoU2VydmljZSB9IGZyb20gJy4uLy4uL3BhdGgvY29tbW9uL3BhdGhTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgSVN0b3JlZEZpbGVXb3JraW5nQ29weSwgSVN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsLCBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWxGYWN0b3J5LCBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5UmVzb2x2ZU9wdGlvbnMsIFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlIH0gZnJvbSAnLi9zdG9yZWRGaWxlV29ya2luZ0NvcHkuanMnO1xuaW1wb3J0IHsgU3RvcmVkRmlsZVdvcmtpbmdDb3B5TWFuYWdlciwgSVN0b3JlZEZpbGVXb3JraW5nQ29weU1hbmFnZXIsIElTdG9yZWRGaWxlV29ya2luZ0NvcHlNYW5hZ2VyUmVzb2x2ZU9wdGlvbnMgfSBmcm9tICcuL3N0b3JlZEZpbGVXb3JraW5nQ29weU1hbmFnZXIuanMnO1xuaW1wb3J0IHsgSVVudGl0bGVkRmlsZVdvcmtpbmdDb3B5LCBJVW50aXRsZWRGaWxlV29ya2luZ0NvcHlNb2RlbCwgSVVudGl0bGVkRmlsZVdvcmtpbmdDb3B5TW9kZWxGYWN0b3J5LCBVbnRpdGxlZEZpbGVXb3JraW5nQ29weSB9IGZyb20gJy4vdW50aXRsZWRGaWxlV29ya2luZ0NvcHkuanMnO1xuaW1wb3J0IHsgSU5ld09yRXhpc3RpbmdVbnRpdGxlZEZpbGVXb3JraW5nQ29weU9wdGlvbnMsIElOZXdVbnRpdGxlZEZpbGVXb3JraW5nQ29weU9wdGlvbnMsIElOZXdVbnRpdGxlZEZpbGVXb3JraW5nQ29weVdpdGhBc3NvY2lhdGVkUmVzb3VyY2VPcHRpb25zLCBJVW50aXRsZWRGaWxlV29ya2luZ0NvcHlNYW5hZ2VyLCBVbnRpdGxlZEZpbGVXb3JraW5nQ29weU1hbmFnZXIgfSBmcm9tICcuL3VudGl0bGVkRmlsZVdvcmtpbmdDb3B5TWFuYWdlci5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHlGaWxlU2VydmljZSB9IGZyb20gJy4vd29ya2luZ0NvcHlGaWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQmFzZUZpbGVXb3JraW5nQ29weU1hbmFnZXIgfSBmcm9tICcuL2Fic3RyYWN0RmlsZVdvcmtpbmdDb3B5TWFuYWdlci5qcyc7XG5pbXBvcnQgeyBJRmlsZVdvcmtpbmdDb3B5LCBTbmFwc2hvdENvbnRleHQgfSBmcm9tICcuL2ZpbGVXb3JraW5nQ29weS5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWxldmF0ZWRGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uL2ZpbGVzL2NvbW1vbi9lbGV2YXRlZEZpbGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZmlsZXNDb25maWd1cmF0aW9uL2NvbW1vbi9maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5QmFja3VwU2VydmljZSB9IGZyb20gJy4vd29ya2luZ0NvcHlCYWNrdXAuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5RWRpdG9yU2VydmljZSB9IGZyb20gJy4vd29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weVNlcnZpY2UgfSBmcm9tICcuL3dvcmtpbmdDb3B5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJRGVjb3JhdGlvbkRhdGEsIElEZWNvcmF0aW9uc1Byb3ZpZGVyLCBJRGVjb3JhdGlvbnNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZGVjb3JhdGlvbnMvY29tbW9uL2RlY29yYXRpb25zLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBsaXN0RXJyb3JGb3JlZ3JvdW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVXb3JraW5nQ29weU1hbmFnZXI8UyBleHRlbmRzIElTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbCwgVSBleHRlbmRzIElVbnRpdGxlZEZpbGVXb3JraW5nQ29weU1vZGVsPiBleHRlbmRzIElCYXNlRmlsZVdvcmtpbmdDb3B5TWFuYWdlcjxTIHwgVSwgSUZpbGVXb3JraW5nQ29weTxTIHwgVT4+IHtcblxuXHQvKipcblx0ICogUHJvdmlkZXMgYWNjZXNzIHRvIHRoZSBtYW5hZ2VyIGZvciBzdG9yZWQgZmlsZSB3b3JraW5nIGNvcGllcy5cblx0ICovXG5cdHJlYWRvbmx5IHN0b3JlZDogSVN0b3JlZEZpbGVXb3JraW5nQ29weU1hbmFnZXI8Uz47XG5cblx0LyoqXG5cdCAqIFByb3ZpZGVzIGFjY2VzcyB0byB0aGUgbWFuYWdlciBmb3IgdW50aXRsZWQgZmlsZSB3b3JraW5nIGNvcGllcy5cblx0ICovXG5cdHJlYWRvbmx5IHVudGl0bGVkOiBJVW50aXRsZWRGaWxlV29ya2luZ0NvcHlNYW5hZ2VyPFU+O1xuXG5cdC8qKlxuXHQgKiBBbGxvd3MgdG8gcmVzb2x2ZSBhIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weS4gSWYgdGhlIG1hbmFnZXIgYWxyZWFkeSBrbm93c1xuXHQgKiBhYm91dCBhIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSB3aXRoIHRoZSBzYW1lIGBVUklgLCBpdCB3aWxsIHJldHVybiB0aGF0XG5cdCAqIGV4aXN0aW5nIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weS4gVGhlcmUgd2lsbCBuZXZlciBiZSBtb3JlIHRoYW4gb25lXG5cdCAqIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBwZXIgYFVSSWAgdW50aWwgdGhlIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBpc1xuXHQgKiBkaXNwb3NlZC5cblx0ICpcblx0ICogVXNlIHRoZSBgSVN0b3JlZEZpbGVXb3JraW5nQ29weVJlc29sdmVPcHRpb25zLnJlbG9hZGAgb3B0aW9uIHRvIGNvbnRyb2wgdGhlXG5cdCAqIGJlaGF2aW91ciBmb3Igd2hlbiBhIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSB3YXMgcHJldmlvdXNseSBhbHJlYWR5IHJlc29sdmVkXG5cdCAqIHdpdGggcmVnYXJkcyB0byByZXNvbHZpbmcgaXQgYWdhaW4gZnJvbSB0aGUgdW5kZXJseWluZyBmaWxlIHJlc291cmNlXG5cdCAqIG9yIG5vdC5cblx0ICpcblx0ICogTm90ZTogQ2FsbGVycyBtdXN0IGBkaXNwb3NlYCB0aGUgd29ya2luZyBjb3B5IHdoZW4gbm8gbG9uZ2VyIG5lZWRlZC5cblx0ICpcblx0ICogQHBhcmFtIHJlc291cmNlIHVzZWQgYXMgdW5pcXVlIGlkZW50aWZpZXIgb2YgdGhlIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBpblxuXHQgKiBjYXNlIG9uZSBpcyBhbHJlYWR5IGtub3duIGZvciB0aGlzIGBVUklgLlxuXHQgKiBAcGFyYW0gb3B0aW9uc1xuXHQgKi9cblx0cmVzb2x2ZShyZXNvdXJjZTogVVJJLCBvcHRpb25zPzogSVN0b3JlZEZpbGVXb3JraW5nQ29weU1hbmFnZXJSZXNvbHZlT3B0aW9ucyk6IFByb21pc2U8SVN0b3JlZEZpbGVXb3JraW5nQ29weTxTPj47XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBhIG5ldyB1bnRpdGxlZCBmaWxlIHdvcmtpbmcgY29weSB3aXRoIG9wdGlvbmFsIGluaXRpYWwgY29udGVudHMuXG5cdCAqXG5cdCAqIE5vdGU6IENhbGxlcnMgbXVzdCBgZGlzcG9zZWAgdGhlIHdvcmtpbmcgY29weSB3aGVuIG5vIGxvbmdlciBuZWVkZWQuXG5cdCAqL1xuXHRyZXNvbHZlKG9wdGlvbnM/OiBJTmV3VW50aXRsZWRGaWxlV29ya2luZ0NvcHlPcHRpb25zKTogUHJvbWlzZTxJVW50aXRsZWRGaWxlV29ya2luZ0NvcHk8VT4+O1xuXG5cdC8qKlxuXHQgKiBDcmVhdGUgYSBuZXcgdW50aXRsZWQgZmlsZSB3b3JraW5nIGNvcHkgd2l0aCBvcHRpb25hbCBpbml0aWFsIGNvbnRlbnRzXG5cdCAqIGFuZCBhc3NvY2lhdGVkIHJlc291cmNlLiBUaGUgYXNzb2NpYXRlZCByZXNvdXJjZSB3aWxsIGJlIHVzZWQgd2hlblxuXHQgKiBzYXZpbmcgYW5kIHdpbGwgbm90IHJlcXVpcmUgdG8gYXNrIHRoZSB1c2VyIGZvciBhIGZpbGUgcGF0aC5cblx0ICpcblx0ICogTm90ZTogQ2FsbGVycyBtdXN0IGBkaXNwb3NlYCB0aGUgd29ya2luZyBjb3B5IHdoZW4gbm8gbG9uZ2VyIG5lZWRlZC5cblx0ICovXG5cdHJlc29sdmUob3B0aW9ucz86IElOZXdVbnRpdGxlZEZpbGVXb3JraW5nQ29weVdpdGhBc3NvY2lhdGVkUmVzb3VyY2VPcHRpb25zKTogUHJvbWlzZTxJVW50aXRsZWRGaWxlV29ya2luZ0NvcHk8VT4+O1xuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgbmV3IHVudGl0bGVkIGZpbGUgd29ya2luZyBjb3B5IHdpdGggb3B0aW9uYWwgaW5pdGlhbCBjb250ZW50c1xuXHQgKiB3aXRoIHRoZSBwcm92aWRlZCByZXNvdXJjZSBvciByZXR1cm4gYW4gZXhpc3RpbmcgdW50aXRsZWQgZmlsZSB3b3JraW5nXG5cdCAqIGNvcHkgb3RoZXJ3aXNlLlxuXHQgKlxuXHQgKiBOb3RlOiBDYWxsZXJzIG11c3QgYGRpc3Bvc2VgIHRoZSB3b3JraW5nIGNvcHkgd2hlbiBubyBsb25nZXIgbmVlZGVkLlxuXHQgKi9cblx0cmVzb2x2ZShvcHRpb25zPzogSU5ld09yRXhpc3RpbmdVbnRpdGxlZEZpbGVXb3JraW5nQ29weU9wdGlvbnMpOiBQcm9taXNlPElVbnRpdGxlZEZpbGVXb3JraW5nQ29weTxVPj47XG5cblx0LyoqXG5cdCAqIEltcGxlbWVudHMgXCJTYXZlIEFzXCIgZm9yIGZpbGUgYmFzZWQgd29ya2luZyBjb3BpZXMuIFRoZSBBUEkgaXMgYFVSSWAgYmFzZWRcblx0ICogYmVjYXVzZSBpdCB3b3JrcyBldmVuIHdpdGhvdXQgcmVzb2x2ZWQgZmlsZSB3b3JraW5nIGNvcGllcy4gSWYgYSBmaWxlIHdvcmtpbmdcblx0ICogY29weSBleGlzdHMgZm9yIGFueSBnaXZlbiBgVVJJYCwgdGhlIGltcGxlbWVudGF0aW9uIHdpbGwgZGVhbCB3aXRoIHRoZW0gcHJvcGVybHlcblx0ICogKGUuZy4gZGlydHkgY29udGVudHMgb2YgdGhlIHNvdXJjZSB3aWxsIGJlIHdyaXR0ZW4gdG8gdGhlIHRhcmdldCBhbmQgdGhlIHNvdXJjZVxuXHQgKiB3aWxsIGJlIHJldmVydGVkKS5cblx0ICpcblx0ICogTm90ZTogaXQgaXMgcG9zc2libGUgdGhhdCB0aGUgcmV0dXJuZWQgZmlsZSB3b3JraW5nIGNvcHkgaGFzIGEgZGlmZmVyZW50IGBVUklgXG5cdCAqIHRoYW4gdGhlIGB0YXJnZXRgIHRoYXQgd2FzIHBhc3NlZCBpbi4gQmFzZWQgb24gVVJJIGlkZW50aXR5LCB0aGUgZmlsZSB3b3JraW5nXG5cdCAqIGNvcHkgbWF5IGNob3NlIHRvIHJldHVybiBhbiBleGlzdGluZyBmaWxlIHdvcmtpbmcgY29weSB3aXRoIGRpZmZlcmVudCBjYXNpbmdcblx0ICogdG8gcmVzcGVjdCBmaWxlIHN5c3RlbXMgdGhhdCBhcmUgY2FzZSBpbnNlbnNpdGl2ZS5cblx0ICpcblx0ICogTm90ZTogQ2FsbGVycyBtdXN0IGBkaXNwb3NlYCB0aGUgd29ya2luZyBjb3B5IHdoZW4gbm8gbG9uZ2VyIG5lZWRlZC5cblx0ICpcblx0ICogTm90ZTogVW50aXRsZWQgZmlsZSB3b3JraW5nIGNvcGllcyBhcmUgYmVpbmcgZGlzcG9zZWQgd2hlbiBzYXZlZC5cblx0ICpcblx0ICogQHBhcmFtIHNvdXJjZSB0aGUgc291cmNlIHJlc291cmNlIHRvIHNhdmUgYXNcblx0ICogQHBhcmFtIHRhcmdldCB0aGUgb3B0aW9uYWwgdGFyZ2V0IHJlc291cmNlIHRvIHNhdmUgdG8uIGlmIG5vdCBkZWZpbmVkLCB0aGUgdXNlclxuXHQgKiB3aWxsIGJlIGFza2VkIGZvciBpbnB1dFxuXHQgKiBAcmV0dXJucyB0aGUgdGFyZ2V0IHN0b3JlZCB3b3JraW5nIGNvcHkgdGhhdCB3YXMgc2F2ZWQgdG8gb3IgYHVuZGVmaW5lZGAgaW4gY2FzZSBvZlxuXHQgKiBjYW5jZWxsYXRpb25cblx0ICovXG5cdHNhdmVBcyhzb3VyY2U6IFVSSSwgdGFyZ2V0OiBVUkksIG9wdGlvbnM/OiBJU2F2ZU9wdGlvbnMpOiBQcm9taXNlPElTdG9yZWRGaWxlV29ya2luZ0NvcHk8Uz4gfCB1bmRlZmluZWQ+O1xuXHRzYXZlQXMoc291cmNlOiBVUkksIHRhcmdldDogdW5kZWZpbmVkLCBvcHRpb25zPzogSUZpbGVXb3JraW5nQ29weVNhdmVBc09wdGlvbnMpOiBQcm9taXNlPElTdG9yZWRGaWxlV29ya2luZ0NvcHk8Uz4gfCB1bmRlZmluZWQ+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlV29ya2luZ0NvcHlTYXZlQXNPcHRpb25zIGV4dGVuZHMgSVNhdmVPcHRpb25zIHtcblxuXHQvKipcblx0ICogT3B0aW9uYWwgdGFyZ2V0IHJlc291cmNlIHRvIHN1Z2dlc3QgdG8gdGhlIHVzZXIgaW4gY2FzZVxuXHQgKiBubyB0YXJnZXQgcmVzb3VyY2UgaXMgcHJvdmlkZWQgdG8gc2F2ZSB0by5cblx0ICovXG5cdHN1Z2dlc3RlZFRhcmdldD86IFVSSTtcbn1cblxuZXhwb3J0IGNsYXNzIEZpbGVXb3JraW5nQ29weU1hbmFnZXI8UyBleHRlbmRzIElTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbCwgVSBleHRlbmRzIElVbnRpdGxlZEZpbGVXb3JraW5nQ29weU1vZGVsPiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRmlsZVdvcmtpbmdDb3B5TWFuYWdlcjxTLCBVPiB7XG5cblx0cmVhZG9ubHkgb25EaWRDcmVhdGU6IEV2ZW50PElGaWxlV29ya2luZ0NvcHk8UyB8IFU+PjtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBGSUxFX1dPUktJTkdfQ09QWV9TQVZFX0NSRUFURV9TT1VSQ0UgPSBTYXZlU291cmNlUmVnaXN0cnkucmVnaXN0ZXJTb3VyY2UoJ2ZpbGVXb3JraW5nQ29weUNyZWF0ZS5zb3VyY2UnLCBsb2NhbGl6ZSgnZmlsZVdvcmtpbmdDb3B5Q3JlYXRlLnNvdXJjZScsIFwiRmlsZSBDcmVhdGVkXCIpKTtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgRklMRV9XT1JLSU5HX0NPUFlfU0FWRV9SRVBMQUNFX1NPVVJDRSA9IFNhdmVTb3VyY2VSZWdpc3RyeS5yZWdpc3RlclNvdXJjZSgnZmlsZVdvcmtpbmdDb3B5UmVwbGFjZS5zb3VyY2UnLCBsb2NhbGl6ZSgnZmlsZVdvcmtpbmdDb3B5UmVwbGFjZS5zb3VyY2UnLCBcIkZpbGUgUmVwbGFjZWRcIikpO1xuXG5cdHJlYWRvbmx5IHN0b3JlZDogSVN0b3JlZEZpbGVXb3JraW5nQ29weU1hbmFnZXI8Uz47XG5cdHJlYWRvbmx5IHVudGl0bGVkOiBJVW50aXRsZWRGaWxlV29ya2luZ0NvcHlNYW5hZ2VyPFU+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgd29ya2luZ0NvcHlUeXBlSWQ6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHN0b3JlZFdvcmtpbmdDb3B5TW9kZWxGYWN0b3J5OiBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWxGYWN0b3J5PFM+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdW50aXRsZWRXb3JraW5nQ29weU1vZGVsRmFjdG9yeTogSVVudGl0bGVkRmlsZVdvcmtpbmdDb3B5TW9kZWxGYWN0b3J5PFU+LFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBsaWZlY3ljbGVTZXJ2aWNlOiBJTGlmZWN5Y2xlU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElXb3JraW5nQ29weUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya2luZ0NvcHlGaWxlU2VydmljZTogSVdvcmtpbmdDb3B5RmlsZVNlcnZpY2UsXG5cdFx0QElXb3JraW5nQ29weUJhY2t1cFNlcnZpY2Ugd29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlOiBJV29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJRmlsZURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlRGlhbG9nU2VydmljZTogSUZpbGVEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2U6IElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya2luZ0NvcHlTZXJ2aWNlIHdvcmtpbmdDb3B5U2VydmljZTogSVdvcmtpbmdDb3B5U2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2Ugbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElXb3JraW5nQ29weUVkaXRvclNlcnZpY2Ugd29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlOiBJV29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASUVsZXZhdGVkRmlsZVNlcnZpY2UgZWxldmF0ZWRGaWxlU2VydmljZTogSUVsZXZhdGVkRmlsZVNlcnZpY2UsXG5cdFx0QElQYXRoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHBhdGhTZXJ2aWNlOiBJUGF0aFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0QElEZWNvcmF0aW9uc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkZWNvcmF0aW9uc1NlcnZpY2U6IElEZWNvcmF0aW9uc1NlcnZpY2UsXG5cdFx0QElQcm9ncmVzc1NlcnZpY2UgcHJvZ3Jlc3NTZXJ2aWNlOiBJUHJvZ3Jlc3NTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHQvLyBTdG9yZWQgZmlsZSB3b3JraW5nIGNvcGllcyBtYW5hZ2VyXG5cdFx0dGhpcy5zdG9yZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgU3RvcmVkRmlsZVdvcmtpbmdDb3B5TWFuYWdlcihcblx0XHRcdHRoaXMud29ya2luZ0NvcHlUeXBlSWQsXG5cdFx0XHR0aGlzLnN0b3JlZFdvcmtpbmdDb3B5TW9kZWxGYWN0b3J5LFxuXHRcdFx0ZmlsZVNlcnZpY2UsIGxpZmVjeWNsZVNlcnZpY2UsIGxhYmVsU2VydmljZSwgbG9nU2VydmljZSwgd29ya2luZ0NvcHlGaWxlU2VydmljZSxcblx0XHRcdHdvcmtpbmdDb3B5QmFja3VwU2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlLCBmaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLCB3b3JraW5nQ29weVNlcnZpY2UsXG5cdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLCB3b3JraW5nQ29weUVkaXRvclNlcnZpY2UsIGVkaXRvclNlcnZpY2UsIGVsZXZhdGVkRmlsZVNlcnZpY2UsIHByb2dyZXNzU2VydmljZVxuXHRcdCkpO1xuXG5cdFx0Ly8gVW50aXRsZWQgZmlsZSB3b3JraW5nIGNvcGllcyBtYW5hZ2VyXG5cdFx0dGhpcy51bnRpdGxlZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBVbnRpdGxlZEZpbGVXb3JraW5nQ29weU1hbmFnZXIoXG5cdFx0XHR0aGlzLndvcmtpbmdDb3B5VHlwZUlkLFxuXHRcdFx0dGhpcy51bnRpdGxlZFdvcmtpbmdDb3B5TW9kZWxGYWN0b3J5LFxuXHRcdFx0YXN5bmMgKHdvcmtpbmdDb3B5LCBvcHRpb25zKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuc2F2ZUFzKHdvcmtpbmdDb3B5LnJlc291cmNlLCB1bmRlZmluZWQsIG9wdGlvbnMpO1xuXG5cdFx0XHRcdHJldHVybiByZXN1bHQgPyB0cnVlIDogZmFsc2U7XG5cdFx0XHR9LFxuXHRcdFx0ZmlsZVNlcnZpY2UsIGxhYmVsU2VydmljZSwgbG9nU2VydmljZSwgd29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlLCB3b3JraW5nQ29weVNlcnZpY2Vcblx0XHQpKTtcblxuXHRcdC8vIEV2ZW50c1xuXHRcdHRoaXMub25EaWRDcmVhdGUgPSBFdmVudC5hbnk8SUZpbGVXb3JraW5nQ29weTxTIHwgVT4+KHRoaXMuc3RvcmVkLm9uRGlkQ3JlYXRlLCB0aGlzLnVudGl0bGVkLm9uRGlkQ3JlYXRlKTtcblxuXHRcdC8vIERlY29yYXRpb25zXG5cdFx0dGhpcy5wcm92aWRlRGVjb3JhdGlvbnMoKTtcblx0fVxuXG5cdC8vI3JlZ2lvbiBkZWNvcmF0aW9uc1xuXG5cdHByaXZhdGUgcHJvdmlkZURlY29yYXRpb25zKCk6IHZvaWQge1xuXG5cdFx0Ly8gRmlsZSB3b3JraW5nIGNvcHkgZGVjb3JhdGlvbnNcblx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBjbGFzcyBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRGVjb3JhdGlvbnNQcm92aWRlciB7XG5cblx0XHRcdHJlYWRvbmx5IGxhYmVsID0gbG9jYWxpemUoJ2ZpbGVXb3JraW5nQ29weURlY29yYXRpb25zJywgXCJGaWxlIFdvcmtpbmcgQ29weSBEZWNvcmF0aW9uc1wiKTtcblxuXHRcdFx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxVUklbXT4oKSk7XG5cdFx0XHRyZWFkb25seSBvbkRpZENoYW5nZSA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdFx0XHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IHN0b3JlZDogSVN0b3JlZEZpbGVXb3JraW5nQ29weU1hbmFnZXI8Uz4pIHtcblx0XHRcdFx0c3VwZXIoKTtcblxuXHRcdFx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdFx0XHR9XG5cblx0XHRcdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cblx0XHRcdFx0Ly8gQ3JlYXRlc1xuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnN0b3JlZC5vbkRpZFJlc29sdmUod29ya2luZ0NvcHkgPT4ge1xuXHRcdFx0XHRcdGlmICh3b3JraW5nQ29weS5pc1JlYWRvbmx5KCkgfHwgd29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuT1JQSEFOKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZShbd29ya2luZ0NvcHkucmVzb3VyY2VdKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblxuXHRcdFx0XHQvLyBSZW1vdmFsczogb25jZSBhIHN0b3JlZCB3b3JraW5nIGNvcHkgaXMgbm8gbG9uZ2VyXG5cdFx0XHRcdC8vIHVuZGVyIG91ciBjb250cm9sLCBtYWtlIHN1cmUgdG8gc2lnbmFsIHRoaXMgYXNcblx0XHRcdFx0Ly8gZGVjb3JhdGlvbiBjaGFuZ2UgYmVjYXVzZSBmcm9tIHRoaXMgcG9pbnQgb24gd2Vcblx0XHRcdFx0Ly8gaGF2ZSBubyB3YXkgb2YgdXBkYXRpbmcgdGhlIGRlY29yYXRpb24gYW55bW9yZS5cblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zdG9yZWQub25EaWRSZW1vdmUod29ya2luZ0NvcHlVcmkgPT4gdGhpcy5fb25EaWRDaGFuZ2UuZmlyZShbd29ya2luZ0NvcHlVcmldKSkpO1xuXG5cdFx0XHRcdC8vIENoYW5nZXNcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5zdG9yZWQub25EaWRDaGFuZ2VSZWFkb25seSh3b3JraW5nQ29weSA9PiB0aGlzLl9vbkRpZENoYW5nZS5maXJlKFt3b3JraW5nQ29weS5yZXNvdXJjZV0pKSk7XG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuc3RvcmVkLm9uRGlkQ2hhbmdlT3JwaGFuZWQod29ya2luZ0NvcHkgPT4gdGhpcy5fb25EaWRDaGFuZ2UuZmlyZShbd29ya2luZ0NvcHkucmVzb3VyY2VdKSkpO1xuXHRcdFx0fVxuXG5cdFx0XHRwcm92aWRlRGVjb3JhdGlvbnModXJpOiBVUkkpOiBJRGVjb3JhdGlvbkRhdGEgfCB1bmRlZmluZWQge1xuXHRcdFx0XHRjb25zdCB3b3JraW5nQ29weSA9IHRoaXMuc3RvcmVkLmdldCh1cmkpO1xuXHRcdFx0XHRpZiAoIXdvcmtpbmdDb3B5IHx8IHdvcmtpbmdDb3B5LmlzRGlzcG9zZWQoKSkge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBpc1JlYWRvbmx5ID0gd29ya2luZ0NvcHkuaXNSZWFkb25seSgpO1xuXHRcdFx0XHRjb25zdCBpc09ycGhhbmVkID0gd29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuT1JQSEFOKTtcblxuXHRcdFx0XHQvLyBSZWFkb25seSArIE9ycGhhbmVkXG5cdFx0XHRcdGlmIChpc1JlYWRvbmx5ICYmIGlzT3JwaGFuZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0Y29sb3I6IGxpc3RFcnJvckZvcmVncm91bmQsXG5cdFx0XHRcdFx0XHRsZXR0ZXI6IENvZGljb24ubG9ja1NtYWxsLFxuXHRcdFx0XHRcdFx0c3RyaWtldGhyb3VnaDogdHJ1ZSxcblx0XHRcdFx0XHRcdHRvb2x0aXA6IGxvY2FsaXplKCdyZWFkb25seUFuZERlbGV0ZWQnLCBcIkRlbGV0ZWQsIFJlYWQtb25seVwiKSxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gUmVhZG9ubHlcblx0XHRcdFx0ZWxzZSBpZiAoaXNSZWFkb25seSkge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRsZXR0ZXI6IENvZGljb24ubG9ja1NtYWxsLFxuXHRcdFx0XHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ3JlYWRvbmx5JywgXCJSZWFkLW9ubHlcIiksXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIE9ycGhhbmVkXG5cdFx0XHRcdGVsc2UgaWYgKGlzT3JwaGFuZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0Y29sb3I6IGxpc3RFcnJvckZvcmVncm91bmQsXG5cdFx0XHRcdFx0XHRzdHJpa2V0aHJvdWdoOiB0cnVlLFxuXHRcdFx0XHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ2RlbGV0ZWQnLCBcIkRlbGV0ZWRcIiksXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSh0aGlzLnN0b3JlZCkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5kZWNvcmF0aW9uc1NlcnZpY2UucmVnaXN0ZXJEZWNvcmF0aW9uc1Byb3ZpZGVyKHByb3ZpZGVyKSk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gZ2V0IC8gZ2V0IGFsbFxuXG5cdGdldCB3b3JraW5nQ29waWVzKCk6IChJVW50aXRsZWRGaWxlV29ya2luZ0NvcHk8VT4gfCBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5PFM+KVtdIHtcblx0XHRyZXR1cm4gWy4uLnRoaXMuc3RvcmVkLndvcmtpbmdDb3BpZXMsIC4uLnRoaXMudW50aXRsZWQud29ya2luZ0NvcGllc107XG5cdH1cblxuXHRnZXQocmVzb3VyY2U6IFVSSSk6IElVbnRpdGxlZEZpbGVXb3JraW5nQ29weTxVPiB8IElTdG9yZWRGaWxlV29ya2luZ0NvcHk8Uz4gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnN0b3JlZC5nZXQocmVzb3VyY2UpID8/IHRoaXMudW50aXRsZWQuZ2V0KHJlc291cmNlKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiByZXNvbHZlXG5cblx0cmVzb2x2ZShvcHRpb25zPzogSU5ld1VudGl0bGVkRmlsZVdvcmtpbmdDb3B5T3B0aW9ucyk6IFByb21pc2U8SVVudGl0bGVkRmlsZVdvcmtpbmdDb3B5PFU+Pjtcblx0cmVzb2x2ZShvcHRpb25zPzogSU5ld1VudGl0bGVkRmlsZVdvcmtpbmdDb3B5V2l0aEFzc29jaWF0ZWRSZXNvdXJjZU9wdGlvbnMpOiBQcm9taXNlPElVbnRpdGxlZEZpbGVXb3JraW5nQ29weTxVPj47XG5cdHJlc29sdmUob3B0aW9ucz86IElOZXdPckV4aXN0aW5nVW50aXRsZWRGaWxlV29ya2luZ0NvcHlPcHRpb25zKTogUHJvbWlzZTxJVW50aXRsZWRGaWxlV29ya2luZ0NvcHk8VT4+O1xuXHRyZXNvbHZlKHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5UmVzb2x2ZU9wdGlvbnMpOiBQcm9taXNlPElTdG9yZWRGaWxlV29ya2luZ0NvcHk8Uz4+O1xuXHRyZXNvbHZlKGFyZzE/OiBVUkkgfCBJTmV3VW50aXRsZWRGaWxlV29ya2luZ0NvcHlPcHRpb25zIHwgSU5ld1VudGl0bGVkRmlsZVdvcmtpbmdDb3B5V2l0aEFzc29jaWF0ZWRSZXNvdXJjZU9wdGlvbnMgfCBJTmV3T3JFeGlzdGluZ1VudGl0bGVkRmlsZVdvcmtpbmdDb3B5T3B0aW9ucywgYXJnMj86IElTdG9yZWRGaWxlV29ya2luZ0NvcHlSZXNvbHZlT3B0aW9ucyk6IFByb21pc2U8SVVudGl0bGVkRmlsZVdvcmtpbmdDb3B5PFU+IHwgSVN0b3JlZEZpbGVXb3JraW5nQ29weTxTPj4ge1xuXHRcdGlmIChVUkkuaXNVcmkoYXJnMSkpIHtcblxuXHRcdFx0Ly8gVW50aXRsZWQ6IHZpYSB1bnRpdGxlZCBtYW5hZ2VyXG5cdFx0XHRpZiAoYXJnMS5zY2hlbWUgPT09IFNjaGVtYXMudW50aXRsZWQpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMudW50aXRsZWQucmVzb2x2ZSh7IHVudGl0bGVkUmVzb3VyY2U6IGFyZzEgfSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIGVsc2U6IHZpYSBzdG9yZWQgZmlsZSBtYW5hZ2VyXG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc3RvcmVkLnJlc29sdmUoYXJnMSwgYXJnMik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMudW50aXRsZWQucmVzb2x2ZShhcmcxKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBTYXZlXG5cblx0YXN5bmMgc2F2ZUFzKHNvdXJjZTogVVJJLCB0YXJnZXQ/OiBVUkksIG9wdGlvbnM/OiBJRmlsZVdvcmtpbmdDb3B5U2F2ZUFzT3B0aW9ucyk6IFByb21pc2U8SVN0b3JlZEZpbGVXb3JraW5nQ29weTxTPiB8IHVuZGVmaW5lZD4ge1xuXG5cdFx0Ly8gR2V0IHRvIHRhcmdldCByZXNvdXJjZVxuXHRcdGlmICghdGFyZ2V0KSB7XG5cdFx0XHRjb25zdCB3b3JraW5nQ29weSA9IHRoaXMuZ2V0KHNvdXJjZSk7XG5cdFx0XHRpZiAod29ya2luZ0NvcHkgaW5zdGFuY2VvZiBVbnRpdGxlZEZpbGVXb3JraW5nQ29weSAmJiB3b3JraW5nQ29weS5oYXNBc3NvY2lhdGVkRmlsZVBhdGgpIHtcblx0XHRcdFx0dGFyZ2V0ID0gYXdhaXQgdGhpcy5zdWdnZXN0U2F2ZVBhdGgoc291cmNlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRhcmdldCA9IGF3YWl0IHRoaXMuZmlsZURpYWxvZ1NlcnZpY2UucGlja0ZpbGVUb1NhdmUoYXdhaXQgdGhpcy5zdWdnZXN0U2F2ZVBhdGgob3B0aW9ucz8uc3VnZ2VzdGVkVGFyZ2V0ID8/IHNvdXJjZSksIG9wdGlvbnM/LmF2YWlsYWJsZUZpbGVTeXN0ZW1zKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIXRhcmdldCkge1xuXHRcdFx0cmV0dXJuOyAvLyB1c2VyIGNhbmNlbGVkXG5cdFx0fVxuXG5cdFx0Ly8gRW5zdXJlIHRhcmdldCBpcyBub3QgbWFya2VkIGFzIHJlYWRvbmx5IGFuZCBwcm9tcHQgb3RoZXJ3aXNlXG5cdFx0aWYgKHRoaXMuZmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5pc1JlYWRvbmx5KHRhcmdldCkpIHtcblx0XHRcdGNvbnN0IGNvbmZpcm1lZCA9IGF3YWl0IHRoaXMuY29uZmlybU1ha2VXcml0ZWFibGUodGFyZ2V0KTtcblx0XHRcdGlmICghY29uZmlybWVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuZmlsZXNDb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVSZWFkb25seSh0YXJnZXQsIGZhbHNlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBKdXN0IHNhdmUgaWYgdGFyZ2V0IGlzIHNhbWUgYXMgd29ya2luZyBjb3BpZXMgb3duIHJlc291cmNlXG5cdFx0Ly8gYW5kIHdlIGFyZSBub3Qgc2F2aW5nIGFuIHVudGl0bGVkIGZpbGUgd29ya2luZyBjb3B5XG5cdFx0aWYgKHRoaXMuZmlsZVNlcnZpY2UuaGFzUHJvdmlkZXIoc291cmNlKSAmJiBpc0VxdWFsKHNvdXJjZSwgdGFyZ2V0KSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZG9TYXZlKHNvdXJjZSwgeyAuLi5vcHRpb25zLCBmb3JjZTogdHJ1ZSAgLyogZm9yY2UgdG8gc2F2ZSwgZXZlbiBpZiBub3QgZGlydHkgKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy85OTYxOSkgKi8gfSk7XG5cdFx0fVxuXG5cdFx0Ly8gSWYgdGhlIHRhcmdldCBpcyBkaWZmZXJlbnQgYnV0IG9mIHNhbWUgaWRlbnRpdHksIHdlXG5cdFx0Ly8gbW92ZSB0aGUgc291cmNlIHRvIHRoZSB0YXJnZXQsIGtub3dpbmcgdGhhdCB0aGVcblx0XHQvLyB1bmRlcmx5aW5nIGZpbGUgc3lzdGVtIGNhbm5vdCBoYXZlIGJvdGggYW5kIHRoZW4gc2F2ZS5cblx0XHQvLyBIb3dldmVyLCB0aGlzIHdpbGwgb25seSB3b3JrIGlmIHRoZSBzb3VyY2UgZXhpc3RzXG5cdFx0Ly8gYW5kIGlzIG5vdCBvcnBoYW5lZCwgc28gd2UgbmVlZCB0byBjaGVjayB0aGF0IHRvby5cblx0XHRpZiAodGhpcy5maWxlU2VydmljZS5oYXNQcm92aWRlcihzb3VyY2UpICYmIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKHNvdXJjZSwgdGFyZ2V0KSAmJiAoYXdhaXQgdGhpcy5maWxlU2VydmljZS5leGlzdHMoc291cmNlKSkpIHtcblxuXHRcdFx0Ly8gTW92ZSB2aWEgd29ya2luZyBjb3B5IGZpbGUgc2VydmljZSB0byBlbmFibGUgcGFydGljaXBhbnRzXG5cdFx0XHRhd2FpdCB0aGlzLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UubW92ZShbeyBmaWxlOiB7IHNvdXJjZSwgdGFyZ2V0IH0gfV0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXG5cdFx0XHQvLyBBdCB0aGlzIHBvaW50IHdlIGRvbid0IGtub3cgd2hldGhlciB3ZSBoYXZlIGFcblx0XHRcdC8vIHdvcmtpbmcgY29weSBmb3IgdGhlIHNvdXJjZSBvciB0aGUgdGFyZ2V0IFVSSSBzbyB3ZVxuXHRcdFx0Ly8gc2ltcGx5IHRyeSB0byBzYXZlIHdpdGggYm90aCByZXNvdXJjZXMuXG5cdFx0XHRyZXR1cm4gKGF3YWl0IHRoaXMuZG9TYXZlKHNvdXJjZSwgb3B0aW9ucykpID8/IChhd2FpdCB0aGlzLmRvU2F2ZSh0YXJnZXQsIG9wdGlvbnMpKTtcblx0XHR9XG5cblx0XHQvLyBQZXJmb3JtIG5vcm1hbCBcIlNhdmUgQXNcIlxuXHRcdHJldHVybiB0aGlzLmRvU2F2ZUFzKHNvdXJjZSwgdGFyZ2V0LCBvcHRpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9TYXZlKHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBJU2F2ZU9wdGlvbnMpOiBQcm9taXNlPElTdG9yZWRGaWxlV29ya2luZ0NvcHk8Uz4gfCB1bmRlZmluZWQ+IHtcblxuXHRcdC8vIFNhdmUgaXMgb25seSBwb3NzaWJsZSB3aXRoIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29waWVzLFxuXHRcdC8vIGFueSBvdGhlciBoYXZlIHRvIGdvIHZpYSBgc2F2ZUFzYCBmbG93LlxuXHRcdGNvbnN0IHN0b3JlZEZpbGVXb3JraW5nQ29weSA9IHRoaXMuc3RvcmVkLmdldChyZXNvdXJjZSk7XG5cdFx0aWYgKHN0b3JlZEZpbGVXb3JraW5nQ29weSkge1xuXHRcdFx0Y29uc3Qgc3VjY2VzcyA9IGF3YWl0IHN0b3JlZEZpbGVXb3JraW5nQ29weS5zYXZlKG9wdGlvbnMpO1xuXHRcdFx0aWYgKHN1Y2Nlc3MpIHtcblx0XHRcdFx0cmV0dXJuIHN0b3JlZEZpbGVXb3JraW5nQ29weTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1NhdmVBcyhzb3VyY2U6IFVSSSwgdGFyZ2V0OiBVUkksIG9wdGlvbnM/OiBJRmlsZVdvcmtpbmdDb3B5U2F2ZUFzT3B0aW9ucyk6IFByb21pc2U8SVN0b3JlZEZpbGVXb3JraW5nQ29weTxTPiB8IHVuZGVmaW5lZD4ge1xuXHRcdGxldCBzb3VyY2VDb250ZW50czogVlNCdWZmZXJSZWFkYWJsZVN0cmVhbTtcblxuXHRcdC8vIElmIHRoZSBzb3VyY2UgaXMgYW4gZXhpc3RpbmcgZmlsZSB3b3JraW5nIGNvcHksIHdlIGNhbiBkaXJlY3RseVxuXHRcdC8vIHVzZSB0aGF0IHRvIGNvcHkgdGhlIGNvbnRlbnRzIHRvIHRoZSB0YXJnZXQgZGVzdGluYXRpb25cblx0XHRjb25zdCBzb3VyY2VXb3JraW5nQ29weSA9IHRoaXMuZ2V0KHNvdXJjZSk7XG5cdFx0aWYgKHNvdXJjZVdvcmtpbmdDb3B5Py5pc1Jlc29sdmVkKCkpIHtcblx0XHRcdHNvdXJjZUNvbnRlbnRzID0gYXdhaXQgc291cmNlV29ya2luZ0NvcHkubW9kZWwuc25hcHNob3QoU25hcHNob3RDb250ZXh0LlNhdmUsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdH1cblxuXHRcdC8vIE90aGVyd2lzZSB3ZSByZXNvbHZlIHRoZSBjb250ZW50cyBmcm9tIHRoZSB1bmRlcmx5aW5nIGZpbGVcblx0XHRlbHNlIHtcblx0XHRcdHNvdXJjZUNvbnRlbnRzID0gKGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UucmVhZEZpbGVTdHJlYW0oc291cmNlKSkudmFsdWU7XG5cdFx0fVxuXG5cdFx0Ly8gUmVzb2x2ZSB0YXJnZXRcblx0XHRjb25zdCB7IHRhcmdldEZpbGVFeGlzdHMsIHRhcmdldFN0b3JlZEZpbGVXb3JraW5nQ29weSB9ID0gYXdhaXQgdGhpcy5kb1Jlc29sdmVTYXZlVGFyZ2V0KHNvdXJjZSwgdGFyZ2V0KTtcblxuXHRcdC8vIENvbmZpcm0gdG8gb3ZlcndyaXRlIGlmIHdlIGhhdmUgYW4gdW50aXRsZWQgZmlsZSB3b3JraW5nIGNvcHkgd2l0aCBhc3NvY2lhdGVkIHBhdGggd2hlcmVcblx0XHQvLyB0aGUgZmlsZSBhY3R1YWxseSBleGlzdHMgb24gZGlzayBhbmQgd2UgYXJlIGluc3RydWN0ZWQgdG8gc2F2ZSB0byB0aGF0IGZpbGUgcGF0aC5cblx0XHQvLyBUaGlzIGNhbiBoYXBwZW4gaWYgdGhlIGZpbGUgd2FzIGNyZWF0ZWQgYWZ0ZXIgdGhlIHVudGl0bGVkIGZpbGUgd2FzIG9wZW5lZC5cblx0XHQvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzY3OTQ2XG5cdFx0aWYgKFxuXHRcdFx0c291cmNlV29ya2luZ0NvcHkgaW5zdGFuY2VvZiBVbnRpdGxlZEZpbGVXb3JraW5nQ29weSAmJlxuXHRcdFx0c291cmNlV29ya2luZ0NvcHkuaGFzQXNzb2NpYXRlZEZpbGVQYXRoICYmXG5cdFx0XHR0YXJnZXRGaWxlRXhpc3RzICYmXG5cdFx0XHR0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbCh0YXJnZXQsIHRvTG9jYWxSZXNvdXJjZShzb3VyY2VXb3JraW5nQ29weS5yZXNvdXJjZSwgdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5LCB0aGlzLnBhdGhTZXJ2aWNlLmRlZmF1bHRVcmlTY2hlbWUpKVxuXHRcdCkge1xuXHRcdFx0Y29uc3Qgb3ZlcndyaXRlID0gYXdhaXQgdGhpcy5jb25maXJtT3ZlcndyaXRlKHRhcmdldCk7XG5cdFx0XHRpZiAoIW92ZXJ3cml0ZSkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFRha2Ugb3ZlciBjb250ZW50IGZyb20gc291cmNlIHRvIHRhcmdldFxuXHRcdGF3YWl0IHRhcmdldFN0b3JlZEZpbGVXb3JraW5nQ29weS5tb2RlbD8udXBkYXRlKHNvdXJjZUNvbnRlbnRzLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblxuXHRcdC8vIFNldCBzb3VyY2Ugb3B0aW9ucyBkZXBlbmRpbmcgb24gdGFyZ2V0IGV4aXN0cyBvciBub3Rcblx0XHRpZiAoIW9wdGlvbnM/LnNvdXJjZSkge1xuXHRcdFx0b3B0aW9ucyA9IHtcblx0XHRcdFx0Li4ub3B0aW9ucyxcblx0XHRcdFx0c291cmNlOiB0YXJnZXRGaWxlRXhpc3RzID8gRmlsZVdvcmtpbmdDb3B5TWFuYWdlci5GSUxFX1dPUktJTkdfQ09QWV9TQVZFX1JFUExBQ0VfU09VUkNFIDogRmlsZVdvcmtpbmdDb3B5TWFuYWdlci5GSUxFX1dPUktJTkdfQ09QWV9TQVZFX0NSRUFURV9TT1VSQ0Vcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gU2F2ZSB0YXJnZXRcblx0XHRjb25zdCBzdWNjZXNzID0gYXdhaXQgdGFyZ2V0U3RvcmVkRmlsZVdvcmtpbmdDb3B5LnNhdmUoe1xuXHRcdFx0Li4ub3B0aW9ucyxcblx0XHRcdGZyb206IHNvdXJjZSxcblx0XHRcdGZvcmNlOiB0cnVlICAvKiBmb3JjZSB0byBzYXZlLCBldmVuIGlmIG5vdCBkaXJ0eSAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzk5NjE5KSAqL1xuXHRcdH0pO1xuXHRcdGlmICghc3VjY2Vzcykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHQvLyBSZXZlcnQgdGhlIHNvdXJjZVxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBzb3VyY2VXb3JraW5nQ29weT8ucmV2ZXJ0KCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblxuXHRcdFx0Ly8gSXQgaXMgcG9zc2libGUgdGhhdCByZXZlcnRpbmcgdGhlIHNvdXJjZSBmYWlscywgZm9yIGV4YW1wbGVcblx0XHRcdC8vIHdoZW4gYSByZW1vdGUgaXMgZGlzY29ubmVjdGVkIGFuZCB3ZSBjYW5ub3QgcmVhZCBpdCBhbnltb3JlLlxuXHRcdFx0Ly8gSG93ZXZlciwgdGhpcyBzaG91bGQgbm90IGludGVycnVwdCB0aGUgXCJTYXZlIEFzXCIgZmxvdywgc29cblx0XHRcdC8vIHdlIGdyYWNlZnVsbHkgY2F0Y2ggdGhlIGVycm9yIGFuZCBqdXN0IGxvZyBpdC5cblxuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHR9XG5cblx0XHQvLyBFdmVudHNcblx0XHRpZiAoc291cmNlLnNjaGVtZSA9PT0gU2NoZW1hcy51bnRpdGxlZCkge1xuXHRcdFx0dGhpcy51bnRpdGxlZC5ub3RpZnlEaWRTYXZlKHNvdXJjZSwgdGFyZ2V0KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGFyZ2V0U3RvcmVkRmlsZVdvcmtpbmdDb3B5O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1Jlc29sdmVTYXZlVGFyZ2V0KHNvdXJjZTogVVJJLCB0YXJnZXQ6IFVSSSk6IFByb21pc2U8eyB0YXJnZXRGaWxlRXhpc3RzOiBib29sZWFuOyB0YXJnZXRTdG9yZWRGaWxlV29ya2luZ0NvcHk6IElTdG9yZWRGaWxlV29ya2luZ0NvcHk8Uz4gfT4ge1xuXG5cdFx0Ly8gUHJlZmVyIGFuIGV4aXN0aW5nIHN0b3JlZCBmaWxlIHdvcmtpbmcgY29weSBpZiBpdCBpcyBhbHJlYWR5IHJlc29sdmVkXG5cdFx0Ly8gZm9yIHRoZSBnaXZlbiB0YXJnZXQgcmVzb3VyY2Vcblx0XHRsZXQgdGFyZ2V0RmlsZUV4aXN0cyA9IGZhbHNlO1xuXHRcdGxldCB0YXJnZXRTdG9yZWRGaWxlV29ya2luZ0NvcHkgPSB0aGlzLnN0b3JlZC5nZXQodGFyZ2V0KTtcblx0XHRpZiAodGFyZ2V0U3RvcmVkRmlsZVdvcmtpbmdDb3B5Py5pc1Jlc29sdmVkKCkpIHtcblx0XHRcdHRhcmdldEZpbGVFeGlzdHMgPSB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIE90aGVyd2lzZSBjcmVhdGUgdGhlIHRhcmdldCB3b3JraW5nIGNvcHkgZW1wdHkgaWZcblx0XHQvLyBpdCBkb2VzIG5vdCBleGlzdCBhbHJlYWR5IGFuZCByZXNvbHZlIGl0IGZyb20gdGhlcmVcblx0XHRlbHNlIHtcblx0XHRcdHRhcmdldEZpbGVFeGlzdHMgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmV4aXN0cyh0YXJnZXQpO1xuXG5cdFx0XHQvLyBDcmVhdGUgdGFyZ2V0IGZpbGUgYWRob2MgaWYgaXQgZG9lcyBub3QgZXhpc3QgeWV0XG5cdFx0XHRpZiAoIXRhcmdldEZpbGVFeGlzdHMpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy53b3JraW5nQ29weUZpbGVTZXJ2aWNlLmNyZWF0ZShbeyByZXNvdXJjZTogdGFyZ2V0IH1dLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQXQgdGhpcyBwb2ludCB3ZSBuZWVkIHRvIHJlc29sdmUgdGhlIHRhcmdldCB3b3JraW5nIGNvcHlcblx0XHRcdC8vIGFuZCB3ZSBoYXZlIHRvIGRvIGFuIGV4cGxpY2l0IGNoZWNrIGlmIHRoZSBzb3VyY2UgVVJJXG5cdFx0XHQvLyBlcXVhbHMgdGhlIHRhcmdldCB2aWEgVVJJIGlkZW50aXR5LiBJZiB0aGV5IG1hdGNoIGFuZCB3ZVxuXHRcdFx0Ly8gaGF2ZSBoYWQgYW4gZXhpc3Rpbmcgd29ya2luZyBjb3B5IHdpdGggdGhlIHNvdXJjZSwgd2Vcblx0XHRcdC8vIHByZWZlciB0aGF0IG9uZSBvdmVyIHJlc29sdmluZyB0aGUgdGFyZ2V0LiBPdGhlcndpc2Ugd2Vcblx0XHRcdC8vIHdvdWxkIHBvdGVudGlhbGx5IGludHJvZHVjZSBhXG5cdFx0XHRpZiAodGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoc291cmNlLCB0YXJnZXQpICYmIHRoaXMuZ2V0KHNvdXJjZSkpIHtcblx0XHRcdFx0dGFyZ2V0U3RvcmVkRmlsZVdvcmtpbmdDb3B5ID0gYXdhaXQgdGhpcy5zdG9yZWQucmVzb2x2ZShzb3VyY2UpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGFyZ2V0U3RvcmVkRmlsZVdvcmtpbmdDb3B5ID0gYXdhaXQgdGhpcy5zdG9yZWQucmVzb2x2ZSh0YXJnZXQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7IHRhcmdldEZpbGVFeGlzdHMsIHRhcmdldFN0b3JlZEZpbGVXb3JraW5nQ29weSB9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjb25maXJtT3ZlcndyaXRlKHJlc291cmNlOiBVUkkpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCB7IGNvbmZpcm1lZCB9ID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0dHlwZTogJ3dhcm5pbmcnLFxuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2NvbmZpcm1PdmVyd3JpdGUnLCBcIid7MH0nIGFscmVhZHkgZXhpc3RzLiBEbyB5b3Ugd2FudCB0byByZXBsYWNlIGl0P1wiLCBiYXNlbmFtZShyZXNvdXJjZSkpLFxuXHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgnb3ZlcndyaXRlSXJyZXZlcnNpYmxlJywgXCJBIGZpbGUgb3IgZm9sZGVyIHdpdGggdGhlIG5hbWUgJ3swfScgYWxyZWFkeSBleGlzdHMgaW4gdGhlIGZvbGRlciAnezF9Jy4gUmVwbGFjaW5nIGl0IHdpbGwgb3ZlcndyaXRlIGl0cyBjdXJyZW50IGNvbnRlbnRzLlwiLCBiYXNlbmFtZShyZXNvdXJjZSksIGJhc2VuYW1lKGRpcm5hbWUocmVzb3VyY2UpKSksXG5cdFx0XHRwcmltYXJ5QnV0dG9uOiBsb2NhbGl6ZSh7IGtleTogJ3JlcGxhY2VCdXR0b25MYWJlbCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlJlcGxhY2VcIilcblx0XHR9KTtcblxuXHRcdHJldHVybiBjb25maXJtZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNvbmZpcm1NYWtlV3JpdGVhYmxlKHJlc291cmNlOiBVUkkpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCB7IGNvbmZpcm1lZCB9ID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0dHlwZTogJ3dhcm5pbmcnLFxuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2NvbmZpcm1NYWtlV3JpdGVhYmxlJywgXCInezB9JyBpcyBtYXJrZWQgYXMgcmVhZC1vbmx5LiBEbyB5b3Ugd2FudCB0byBzYXZlIGFueXdheT9cIiwgYmFzZW5hbWUocmVzb3VyY2UpKSxcblx0XHRcdGRldGFpbDogbG9jYWxpemUoJ2NvbmZpcm1NYWtlV3JpdGVhYmxlRGV0YWlsJywgXCJQYXRocyBjYW4gYmUgY29uZmlndXJlZCBhcyByZWFkLW9ubHkgdmlhIHNldHRpbmdzLlwiKSxcblx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKHsga2V5OiAnbWFrZVdyaXRlYWJsZUJ1dHRvbkxhYmVsJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmU2F2ZSBBbnl3YXlcIilcblx0XHR9KTtcblxuXHRcdHJldHVybiBjb25maXJtZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHN1Z2dlc3RTYXZlUGF0aChyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxVUkk+IHtcblxuXHRcdC8vIDEuKSBKdXN0IHRha2UgdGhlIHJlc291cmNlIGFzIGlzIGlmIHRoZSBmaWxlIHNlcnZpY2UgY2FuIGhhbmRsZSBpdFxuXHRcdGlmICh0aGlzLmZpbGVTZXJ2aWNlLmhhc1Byb3ZpZGVyKHJlc291cmNlKSkge1xuXHRcdFx0cmV0dXJuIHJlc291cmNlO1xuXHRcdH1cblxuXHRcdC8vIDIuKSBQaWNrIHRoZSBhc3NvY2lhdGVkIGZpbGUgcGF0aCBmb3IgdW50aXRsZWQgd29ya2luZyBjb3BpZXMgaWYgYW55XG5cdFx0Y29uc3Qgd29ya2luZ0NvcHkgPSB0aGlzLmdldChyZXNvdXJjZSk7XG5cdFx0aWYgKHdvcmtpbmdDb3B5IGluc3RhbmNlb2YgVW50aXRsZWRGaWxlV29ya2luZ0NvcHkgJiYgd29ya2luZ0NvcHkuaGFzQXNzb2NpYXRlZEZpbGVQYXRoKSB7XG5cdFx0XHRyZXR1cm4gdG9Mb2NhbFJlc291cmNlKHJlc291cmNlLCB0aGlzLmVudmlyb25tZW50U2VydmljZS5yZW1vdGVBdXRob3JpdHksIHRoaXMucGF0aFNlcnZpY2UuZGVmYXVsdFVyaVNjaGVtZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGVmYXVsdEZpbGVQYXRoID0gYXdhaXQgdGhpcy5maWxlRGlhbG9nU2VydmljZS5kZWZhdWx0RmlsZVBhdGgoKTtcblxuXHRcdC8vIDMuKSBQaWNrIHRoZSB3b3JraW5nIGNvcHkgbmFtZSBpZiB2YWxpZCBqb2luZWQgd2l0aCBkZWZhdWx0IHBhdGhcblx0XHRpZiAod29ya2luZ0NvcHkpIHtcblx0XHRcdGNvbnN0IGNhbmRpZGF0ZVBhdGggPSBqb2luUGF0aChkZWZhdWx0RmlsZVBhdGgsIHdvcmtpbmdDb3B5Lm5hbWUpO1xuXHRcdFx0aWYgKGF3YWl0IHRoaXMucGF0aFNlcnZpY2UuaGFzVmFsaWRCYXNlbmFtZShjYW5kaWRhdGVQYXRoLCB3b3JraW5nQ29weS5uYW1lKSkge1xuXHRcdFx0XHRyZXR1cm4gY2FuZGlkYXRlUGF0aDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyA0LikgRmluYWxseSBmYWxsYmFjayB0byB0aGUgbmFtZSBvZiB0aGUgcmVzb3VyY2Ugam9pbmVkIHdpdGggZGVmYXVsdCBwYXRoXG5cdFx0cmV0dXJuIGpvaW5QYXRoKGRlZmF1bHRGaWxlUGF0aCwgYmFzZW5hbWUocmVzb3VyY2UpKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBMaWZlY3ljbGVcblxuXHRhc3luYyBkZXN0cm95KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IFByb21pc2VzLnNldHRsZWQoW1xuXHRcdFx0dGhpcy5zdG9yZWQuZGVzdHJveSgpLFxuXHRcdFx0dGhpcy51bnRpdGxlZC5kZXN0cm95KClcblx0XHRdKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLGdCQUFnQjtBQUV6QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGlCQUFpQixVQUFVLFNBQVMsVUFBVSxlQUFlO0FBQ3RFLFNBQVMsV0FBVztBQUNwQixTQUFTLG9CQUFvQixzQkFBc0I7QUFDbkQsU0FBUyxvQkFBb0I7QUFDN0IsU0FBdUIsMEJBQTBCO0FBQ2pELFNBQVMsb0NBQW9DO0FBQzdDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsMkJBQTJCO0FBQ3BDLFNB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
