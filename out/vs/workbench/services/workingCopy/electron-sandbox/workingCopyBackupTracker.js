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
import { IWorkingCopyBackupService } from "../common/workingCopyBackup.js";
import { IFilesConfigurationService, AutoSaveMode } from "../../filesConfiguration/common/filesConfigurationService.js";
import { IWorkingCopyService } from "../common/workingCopyService.js";
import { WorkingCopyCapabilities } from "../common/workingCopy.js";
import { ILifecycleService, ShutdownReason } from "../../lifecycle/common/lifecycle.js";
import { ConfirmResult, IFileDialogService, IDialogService, getFileNamesMessage } from "../../../../platform/dialogs/common/dialogs.js";
import { WorkbenchState, IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { HotExitConfiguration } from "../../../../platform/files/common/files.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { WorkingCopyBackupTracker } from "../common/workingCopyBackupTracker.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { SaveReason } from "../../../common/editor.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { Promises, raceCancellation } from "../../../../base/common/async.js";
import { IWorkingCopyEditorService } from "../common/workingCopyEditorService.js";
import { IEditorGroupsService } from "../../editor/common/editorGroupsService.js";
let NativeWorkingCopyBackupTracker = class extends WorkingCopyBackupTracker {
  constructor(workingCopyBackupService, filesConfigurationService, workingCopyService, lifecycleService, fileDialogService, dialogService, contextService, nativeHostService, logService, environmentService, progressService, workingCopyEditorService, editorService, editorGroupService) {
    super(workingCopyBackupService, workingCopyService, logService, lifecycleService, filesConfigurationService, workingCopyEditorService, editorService, editorGroupService);
    this.fileDialogService = fileDialogService;
    this.dialogService = dialogService;
    this.contextService = contextService;
    this.nativeHostService = nativeHostService;
    this.environmentService = environmentService;
    this.progressService = progressService;
  }
  async onFinalBeforeShutdown(reason) {
    this.cancelBackupOperations();
    const { resume } = this.suspendBackupOperations();
    try {
      const modifiedWorkingCopies = this.workingCopyService.modifiedWorkingCopies;
      if (modifiedWorkingCopies.length) {
        return await this.onBeforeShutdownWithModified(reason, modifiedWorkingCopies);
      } else {
        return await this.onBeforeShutdownWithoutModified();
      }
    } finally {
      resume();
    }
  }
  async onBeforeShutdownWithModified(reason, modifiedWorkingCopies) {
    const workingCopiesToAutoSave = modifiedWorkingCopies.filter((wc) => !(wc.capabilities & WorkingCopyCapabilities.Untitled) && this.filesConfigurationService.getAutoSaveMode(wc.resource).mode !== AutoSaveMode.OFF);
    if (workingCopiesToAutoSave.length > 0) {
      try {
        await this.doSaveAllBeforeShutdown(workingCopiesToAutoSave, SaveReason.AUTO);
      } catch (error) {
        this.logService.error(`[backup tracker] error saving modified working copies: ${error}`);
      }
      const remainingModifiedWorkingCopies = this.workingCopyService.modifiedWorkingCopies;
      if (remainingModifiedWorkingCopies.length) {
        return this.handleModifiedBeforeShutdown(remainingModifiedWorkingCopies, reason);
      }
      return this.noVeto([...modifiedWorkingCopies]);
    }
    return this.handleModifiedBeforeShutdown(modifiedWorkingCopies, reason);
  }
  async handleModifiedBeforeShutdown(modifiedWorkingCopies, reason) {
    let backups = [];
    let backupError = void 0;
    const modifiedWorkingCopiesToBackup = await this.shouldBackupBeforeShutdown(reason, modifiedWorkingCopies);
    if (modifiedWorkingCopiesToBackup.length > 0) {
      try {
        const backupResult = await this.backupBeforeShutdown(modifiedWorkingCopiesToBackup);
        backups = backupResult.backups;
        backupError = backupResult.error;
        if (backups.length === modifiedWorkingCopies.length) {
          return false;
        }
      } catch (error) {
        backupError = error;
      }
    }
    const remainingModifiedWorkingCopies = modifiedWorkingCopies.filter((workingCopy) => !backups.includes(workingCopy));
    if (backupError) {
      if (this.environmentService.isExtensionDevelopment) {
        this.logService.error(`[backup tracker] error creating backups: ${backupError}`);
        return false;
      }
      return this.showErrorDialog(localize("backupTrackerBackupFailed", "The following editors with unsaved changes could not be saved to the backup location."), remainingModifiedWorkingCopies, backupError, reason);
    }
    try {
      return await this.confirmBeforeShutdown(remainingModifiedWorkingCopies);
    } catch (error) {
      if (this.environmentService.isExtensionDevelopment) {
        this.logService.error(`[backup tracker] error saving or reverting modified working copies: ${error}`);
        return false;
      }
      return this.showErrorDialog(localize("backupTrackerConfirmFailed", "The following editors with unsaved changes could not be saved or reverted."), remainingModifiedWorkingCopies, error, reason);
    }
  }
  async shouldBackupBeforeShutdown(reason, modifiedWorkingCopies) {
    if (!this.filesConfigurationService.isHotExitEnabled) {
      return [];
    }
    if (this.environmentService.isExtensionDevelopment) {
      return modifiedWorkingCopies;
    }
    switch (reason) {
      // Window Close
      case ShutdownReason.CLOSE:
        if (this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY && this.filesConfigurationService.hotExitConfiguration === HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE) {
          return modifiedWorkingCopies;
        }
        if (isMacintosh || await this.nativeHostService.getWindowCount() > 1) {
          if (this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY) {
            return modifiedWorkingCopies.filter((modifiedWorkingCopy) => modifiedWorkingCopy.capabilities & WorkingCopyCapabilities.Scratchpad);
          }
          return [];
        }
        return modifiedWorkingCopies;
      // backup if last window is closed on win/linux where the application quits right after
      // Application Quit
      case ShutdownReason.QUIT:
        return modifiedWorkingCopies;
      // backup because next start we restore all backups
      // Window Reload
      case ShutdownReason.RELOAD:
        return modifiedWorkingCopies;
      // backup because after window reload, backups restore
      // Workspace Change
      case ShutdownReason.LOAD:
        if (this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY) {
          if (this.filesConfigurationService.hotExitConfiguration === HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE) {
            return modifiedWorkingCopies;
          }
          return modifiedWorkingCopies.filter((modifiedWorkingCopy) => modifiedWorkingCopy.capabilities & WorkingCopyCapabilities.Scratchpad);
        }
        return [];
    }
  }
  async showErrorDialog(message, workingCopies, error, reason) {
    this.logService.error(`[backup tracker] ${message}: ${error}`);
    const modifiedWorkingCopies = workingCopies.filter((workingCopy) => workingCopy.isModified());
    const advice = localize("backupErrorDetails", "Try saving or reverting the editors with unsaved changes first and then try again.");
    const detail = modifiedWorkingCopies.length ? `${getFileNamesMessage(modifiedWorkingCopies.map((x) => x.name))}
${advice}` : advice;
    const { result } = await this.dialogService.prompt({
      type: "error",
      message,
      detail,
      buttons: [
        {
          label: localize({ key: "ok", comment: ["&& denotes a mnemonic"] }, "&&OK"),
          run: () => true
          // veto
        },
        {
          label: this.toForceShutdownLabel(reason),
          run: () => false
          // no veto
        }
      ]
    });
    return result ?? true;
  }
  toForceShutdownLabel(reason) {
    switch (reason) {
      case ShutdownReason.CLOSE:
      case ShutdownReason.LOAD:
        return localize("shutdownForceClose", "Close Anyway");
      case ShutdownReason.QUIT:
        return localize("shutdownForceQuit", "Quit Anyway");
      case ShutdownReason.RELOAD:
        return localize("shutdownForceReload", "Reload Anyway");
    }
  }
  async backupBeforeShutdown(modifiedWorkingCopies) {
    const backups = [];
    let error = void 0;
    await this.withProgressAndCancellation(
      async (token) => {
        try {
          await Promises.settled(modifiedWorkingCopies.map(async (workingCopy) => {
            const contentVersion = this.getContentVersion(workingCopy);
            if (this.workingCopyBackupService.hasBackupSync(workingCopy, contentVersion)) {
              backups.push(workingCopy);
            } else {
              const backup = await workingCopy.backup(token);
              if (token.isCancellationRequested) {
                return;
              }
              await this.workingCopyBackupService.backup(workingCopy, backup.content, contentVersion, backup.meta, token);
              if (token.isCancellationRequested) {
                return;
              }
              backups.push(workingCopy);
            }
          }));
        } catch (backupError) {
          error = backupError;
        }
      },
      localize("backupBeforeShutdownMessage", "Backing up editors with unsaved changes is taking a bit longer..."),
      localize("backupBeforeShutdownDetail", "Click 'Cancel' to stop waiting and to save or revert editors with unsaved changes.")
    );
    return { backups, error };
  }
  async confirmBeforeShutdown(modifiedWorkingCopies) {
    const confirm = await this.fileDialogService.showSaveConfirm(modifiedWorkingCopies.map((workingCopy) => workingCopy.name));
    if (confirm === ConfirmResult.SAVE) {
      const modifiedCountBeforeSave = this.workingCopyService.modifiedCount;
      try {
        await this.doSaveAllBeforeShutdown(modifiedWorkingCopies, SaveReason.EXPLICIT);
      } catch (error) {
        this.logService.error(`[backup tracker] error saving modified working copies: ${error}`);
      }
      const savedWorkingCopies = modifiedCountBeforeSave - this.workingCopyService.modifiedCount;
      if (savedWorkingCopies < modifiedWorkingCopies.length) {
        return true;
      }
      return this.noVeto(modifiedWorkingCopies);
    } else if (confirm === ConfirmResult.DONT_SAVE) {
      try {
        await this.doRevertAllBeforeShutdown(modifiedWorkingCopies);
      } catch (error) {
        this.logService.error(`[backup tracker] error reverting modified working copies: ${error}`);
      }
      return this.noVeto(modifiedWorkingCopies);
    }
    return true;
  }
  doSaveAllBeforeShutdown(workingCopies, reason) {
    return this.withProgressAndCancellation(
      async () => {
        const saveOptions = { skipSaveParticipants: true, reason };
        let result = void 0;
        if (workingCopies.length === this.workingCopyService.modifiedCount) {
          result = (await this.editorService.saveAll({
            includeUntitled: { includeScratchpad: true },
            ...saveOptions
          })).success;
        }
        if (result !== false) {
          await Promises.settled(workingCopies.map((workingCopy) => workingCopy.isModified() ? workingCopy.save(saveOptions) : Promise.resolve(true)));
        }
      },
      localize("saveBeforeShutdown", "Saving editors with unsaved changes is taking a bit longer..."),
      void 0,
      // Do not pick `Dialog` as location for reporting progress if it is likely
      // that the save operation will itself open a dialog for asking for the
      // location to save to for untitled or scratchpad working copies.
      // https://github.com/microsoft/vscode-internalbacklog/issues/4943
      workingCopies.some((workingCopy) => workingCopy.capabilities & WorkingCopyCapabilities.Untitled || workingCopy.capabilities & WorkingCopyCapabilities.Scratchpad) ? ProgressLocation.Window : ProgressLocation.Dialog
    );
  }
  doRevertAllBeforeShutdown(modifiedWorkingCopies) {
    return this.withProgressAndCancellation(async () => {
      const revertOptions = { soft: true };
      if (modifiedWorkingCopies.length === this.workingCopyService.modifiedCount) {
        await this.editorService.revertAll(revertOptions);
      }
      await Promises.settled(modifiedWorkingCopies.map((workingCopy) => workingCopy.isModified() ? workingCopy.revert(revertOptions) : Promise.resolve()));
    }, localize("revertBeforeShutdown", "Reverting editors with unsaved changes is taking a bit longer..."));
  }
  onBeforeShutdownWithoutModified() {
    return this.noVeto({ except: this.contextService.getWorkbenchState() === WorkbenchState.EMPTY ? [] : Array.from(this.unrestoredBackups) });
  }
  async noVeto(arg1) {
    await this.discardBackupsBeforeShutdown(arg1);
    return false;
  }
  async discardBackupsBeforeShutdown(arg1) {
    if (!this.isReady) {
      return;
    }
    await this.withProgressAndCancellation(async () => {
      try {
        if (Array.isArray(arg1)) {
          await Promises.settled(arg1.map((workingCopy) => this.workingCopyBackupService.discardBackup(workingCopy)));
        } else {
          await this.workingCopyBackupService.discardBackups(arg1);
        }
      } catch (error) {
        this.logService.error(`[backup tracker] error discarding backups: ${error}`);
      }
    }, localize("discardBackupsBeforeShutdown", "Discarding backups is taking a bit longer..."));
  }
  withProgressAndCancellation(promiseFactory, title, detail, location = ProgressLocation.Dialog) {
    const cts = new CancellationTokenSource();
    return this.progressService.withProgress({
      location,
      // by default use a dialog to prevent the user from making any more changes now (https://github.com/microsoft/vscode/issues/122774)
      cancellable: true,
      // allow to cancel (https://github.com/microsoft/vscode/issues/112278)
      delay: 800,
      // delay so that it only appears when operation takes a long time
      title,
      detail
    }, () => raceCancellation(promiseFactory(cts.token), cts.token), () => cts.dispose(true));
  }
};
NativeWorkingCopyBackupTracker.ID = "workbench.contrib.nativeWorkingCopyBackupTracker";
NativeWorkingCopyBackupTracker = __decorateClass([
  __decorateParam(0, IWorkingCopyBackupService),
  __decorateParam(1, IFilesConfigurationService),
  __decorateParam(2, IWorkingCopyService),
  __decorateParam(3, ILifecycleService),
  __decorateParam(4, IFileDialogService),
  __decorateParam(5, IDialogService),
  __decorateParam(6, IWorkspaceContextService),
  __decorateParam(7, INativeHostService),
  __decorateParam(8, ILogService),
  __decorateParam(9, IEnvironmentService),
  __decorateParam(10, IProgressService),
  __decorateParam(11, IWorkingCopyEditorService),
  __decorateParam(12, IEditorService),
  __decorateParam(13, IEditorGroupsService)
], NativeWorkingCopyBackupTracker);
export {
  NativeWorkingCopyBackupTracker
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvd29ya2luZ0NvcHkvZWxlY3Ryb24tc2FuZGJveC93b3JraW5nQ29weUJhY2t1cFRyYWNrZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3dvcmtpbmdDb3B5QmFja3VwLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRmlsZXNDb25maWd1cmF0aW9uU2VydmljZSwgQXV0b1NhdmVNb2RlIH0gZnJvbSAnLi4vLi4vZmlsZXNDb25maWd1cmF0aW9uL2NvbW1vbi9maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weVNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vd29ya2luZ0NvcHlTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weSwgSVdvcmtpbmdDb3B5SWRlbnRpZmllciwgV29ya2luZ0NvcHlDYXBhYmlsaXRpZXMgfSBmcm9tICcuLi9jb21tb24vd29ya2luZ0NvcHkuanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZVNlcnZpY2UsIFNodXRkb3duUmVhc29uIH0gZnJvbSAnLi4vLi4vbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgQ29uZmlybVJlc3VsdCwgSUZpbGVEaWFsb2dTZXJ2aWNlLCBJRGlhbG9nU2VydmljZSwgZ2V0RmlsZU5hbWVzTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoU3RhdGUsIElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IGlzTWFjaW50b3NoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSG90RXhpdENvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSU5hdGl2ZUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbmF0aXZlL2NvbW1vbi9uYXRpdmUuanMnO1xuaW1wb3J0IHsgV29ya2luZ0NvcHlCYWNrdXBUcmFja2VyIH0gZnJvbSAnLi4vY29tbW9uL3dvcmtpbmdDb3B5QmFja3VwVHJhY2tlci5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFNhdmVSZWFzb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4sIENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElQcm9ncmVzc1NlcnZpY2UsIFByb2dyZXNzTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgUHJvbWlzZXMsIHJhY2VDYW5jZWxsYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3dvcmtpbmdDb3B5RWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBOYXRpdmVXb3JraW5nQ29weUJhY2t1cFRyYWNrZXIgZXh0ZW5kcyBXb3JraW5nQ29weUJhY2t1cFRyYWNrZXIgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIubmF0aXZlV29ya2luZ0NvcHlCYWNrdXBUcmFja2VyJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVdvcmtpbmdDb3B5QmFja3VwU2VydmljZSB3b3JraW5nQ29weUJhY2t1cFNlcnZpY2U6IElXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UsXG5cdFx0QElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlIGZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2U6IElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya2luZ0NvcHlTZXJ2aWNlIHdvcmtpbmdDb3B5U2VydmljZTogSVdvcmtpbmdDb3B5U2VydmljZSxcblx0XHRASUxpZmVjeWNsZVNlcnZpY2UgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0QElGaWxlRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVEaWFsb2dTZXJ2aWNlOiBJRmlsZURpYWxvZ1NlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElOYXRpdmVIb3N0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5hdGl2ZUhvc3RTZXJ2aWNlOiBJTmF0aXZlSG9zdFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJUHJvZ3Jlc3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZ3Jlc3NTZXJ2aWNlOiBJUHJvZ3Jlc3NTZXJ2aWNlLFxuXHRcdEBJV29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlIHdvcmtpbmdDb3B5RWRpdG9yU2VydmljZTogSVdvcmtpbmdDb3B5RWRpdG9yU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElFZGl0b3JHcm91cHNTZXJ2aWNlIGVkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIod29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlLCB3b3JraW5nQ29weVNlcnZpY2UsIGxvZ1NlcnZpY2UsIGxpZmVjeWNsZVNlcnZpY2UsIGZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsIHdvcmtpbmdDb3B5RWRpdG9yU2VydmljZSwgZWRpdG9yU2VydmljZSwgZWRpdG9yR3JvdXBTZXJ2aWNlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBvbkZpbmFsQmVmb3JlU2h1dGRvd24ocmVhc29uOiBTaHV0ZG93blJlYXNvbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXG5cdFx0Ly8gSW1wb3J0YW50OiB3ZSBhcmUgYWJvdXQgdG8gc2h1dGRvd24gYW5kIGhhbmRsZSBtb2RpZmllZCB3b3JraW5nIGNvcGllc1xuXHRcdC8vIGFuZCBiYWNrdXBzLiBXZSBkbyBub3Qgd2FudCBhbnkgcGVuZGluZyBiYWNrdXAgb3BzIHRvIGludGVyZmVyIHdpdGhcblx0XHQvLyB0aGlzIGJlY2F1c2UgdGhlcmUgaXMgYSByaXNrIG9mIGEgYmFja3VwIGJlaW5nIHNjaGVkdWxlZCBhZnRlciB3ZSBoYXZlXG5cdFx0Ly8gYWNrbm93bGVkZ2VkIHRvIHNodXRkb3duIGFuZCB0aGVuIG1pZ2h0IGVuZCB1cCB3aXRoIHBhcnRpYWwgYmFja3Vwc1xuXHRcdC8vIHdyaXR0ZW4gdG8gZGlzaywgb3IgZXZlbiBlbXB0eSBiYWNrdXBzIG9yIGRlbGV0ZXMgYWZ0ZXIgd3JpdGVzLlxuXHRcdC8vIChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTM4MDU1KVxuXG5cdFx0dGhpcy5jYW5jZWxCYWNrdXBPcGVyYXRpb25zKCk7XG5cblx0XHQvLyBGb3IgdGhlIGR1cmF0aW9uIG9mIHRoZSBzaHV0ZG93biBoYW5kbGluZywgc3VzcGVuZCBiYWNrdXAgb3BlcmF0aW9uc1xuXHRcdC8vIGFuZCBvbmx5IHJlc3VtZSBhZnRlciB3ZSBoYXZlIGhhbmRsZWQgYmFja3Vwcy4gU2ltaWxhciB0byBhYm92ZSwgd2Vcblx0XHQvLyBkbyBub3Qgd2FudCB0byB0cmlnZ2VyIGJhY2t1cCB0cmFja2luZyBkdXJpbmcgb3VyIHNodXRkb3duIGhhbmRsaW5nXG5cdFx0Ly8gYnV0IHdlIG11c3QgcmVzdW1lLCBpbiBjYXNlIG9mIGEgdmV0byBhZnRlcndhcmRzLlxuXG5cdFx0Y29uc3QgeyByZXN1bWUgfSA9IHRoaXMuc3VzcGVuZEJhY2t1cE9wZXJhdGlvbnMoKTtcblxuXHRcdHRyeSB7XG5cblx0XHRcdC8vIE1vZGlmaWVkIHdvcmtpbmcgY29waWVzIG5lZWQgdHJlYXRtZW50IG9uIHNodXRkb3duXG5cdFx0XHRjb25zdCBtb2RpZmllZFdvcmtpbmdDb3BpZXMgPSB0aGlzLndvcmtpbmdDb3B5U2VydmljZS5tb2RpZmllZFdvcmtpbmdDb3BpZXM7XG5cdFx0XHRpZiAobW9kaWZpZWRXb3JraW5nQ29waWVzLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5vbkJlZm9yZVNodXRkb3duV2l0aE1vZGlmaWVkKHJlYXNvbiwgbW9kaWZpZWRXb3JraW5nQ29waWVzKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gTm8gbW9kaWZpZWQgd29ya2luZyBjb3BpZXNcblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5vbkJlZm9yZVNodXRkb3duV2l0aG91dE1vZGlmaWVkKCk7XG5cdFx0XHR9XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHJlc3VtZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBvbkJlZm9yZVNodXRkb3duV2l0aE1vZGlmaWVkKHJlYXNvbjogU2h1dGRvd25SZWFzb24sIG1vZGlmaWVkV29ya2luZ0NvcGllczogcmVhZG9ubHkgSVdvcmtpbmdDb3B5W10pOiBQcm9taXNlPGJvb2xlYW4+IHtcblxuXHRcdC8vIElmIGF1dG8gc2F2ZSBpcyBlbmFibGVkLCBzYXZlIGFsbCBub24tdW50aXRsZWQgd29ya2luZyBjb3BpZXNcblx0XHQvLyBhbmQgdGhlbiBjaGVjayBhZ2FpbiBmb3IgbW9kaWZpZWQgY29waWVzXG5cblx0XHRjb25zdCB3b3JraW5nQ29waWVzVG9BdXRvU2F2ZSA9IG1vZGlmaWVkV29ya2luZ0NvcGllcy5maWx0ZXIod2MgPT4gISh3Yy5jYXBhYmlsaXRpZXMgJiBXb3JraW5nQ29weUNhcGFiaWxpdGllcy5VbnRpdGxlZCkgJiYgdGhpcy5maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldEF1dG9TYXZlTW9kZSh3Yy5yZXNvdXJjZSkubW9kZSAhPT0gQXV0b1NhdmVNb2RlLk9GRik7XG5cdFx0aWYgKHdvcmtpbmdDb3BpZXNUb0F1dG9TYXZlLmxlbmd0aCA+IDApIHtcblxuXHRcdFx0Ly8gU2F2ZSBhbGwgbW9kaWZpZWQgd29ya2luZyBjb3BpZXMgdGhhdCBjYW4gYmUgYXV0by1zYXZlZFxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5kb1NhdmVBbGxCZWZvcmVTaHV0ZG93bih3b3JraW5nQ29waWVzVG9BdXRvU2F2ZSwgU2F2ZVJlYXNvbi5BVVRPKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihgW2JhY2t1cCB0cmFja2VyXSBlcnJvciBzYXZpbmcgbW9kaWZpZWQgd29ya2luZyBjb3BpZXM6ICR7ZXJyb3J9YCk7IC8vIGd1YXJkIGFnYWluc3QgbWlzYmVoYXZpbmcgc2F2ZXMsIHdlIGhhbmRsZSByZW1haW5pbmcgbW9kaWZpZWQgYmVsb3dcblx0XHRcdH1cblxuXHRcdFx0Ly8gSWYgd2Ugc3RpbGwgaGF2ZSBtb2RpZmllZCB3b3JraW5nIGNvcGllcywgd2UgZWl0aGVyIGhhdmUgdW50aXRsZWQgb25lcyBvciB3b3JraW5nIGNvcGllcyB0aGF0IGNhbm5vdCBiZSBzYXZlZFxuXHRcdFx0Y29uc3QgcmVtYWluaW5nTW9kaWZpZWRXb3JraW5nQ29waWVzID0gdGhpcy53b3JraW5nQ29weVNlcnZpY2UubW9kaWZpZWRXb3JraW5nQ29waWVzO1xuXHRcdFx0aWYgKHJlbWFpbmluZ01vZGlmaWVkV29ya2luZ0NvcGllcy5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuaGFuZGxlTW9kaWZpZWRCZWZvcmVTaHV0ZG93bihyZW1haW5pbmdNb2RpZmllZFdvcmtpbmdDb3BpZXMsIHJlYXNvbik7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0aGlzLm5vVmV0byhbLi4ubW9kaWZpZWRXb3JraW5nQ29waWVzXSk7IC8vIG5vIHZldG8gKG1vZGlmaWVkIGF1dG8tc2F2ZWQpXG5cdFx0fVxuXG5cdFx0Ly8gQXV0byBzYXZlIGlzIG5vdCBlbmFibGVkXG5cdFx0cmV0dXJuIHRoaXMuaGFuZGxlTW9kaWZpZWRCZWZvcmVTaHV0ZG93bihtb2RpZmllZFdvcmtpbmdDb3BpZXMsIHJlYXNvbik7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGhhbmRsZU1vZGlmaWVkQmVmb3JlU2h1dGRvd24obW9kaWZpZWRXb3JraW5nQ29waWVzOiByZWFkb25seSBJV29ya2luZ0NvcHlbXSwgcmVhc29uOiBTaHV0ZG93blJlYXNvbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXG5cdFx0Ly8gVHJpZ2dlciBiYWNrdXAgaWYgY29uZmlndXJlZCBhbmQgZW5hYmxlZCBmb3Igc2h1dGRvd24gcmVhc29uXG5cdFx0bGV0IGJhY2t1cHM6IElXb3JraW5nQ29weVtdID0gW107XG5cdFx0bGV0IGJhY2t1cEVycm9yOiBFcnJvciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRjb25zdCBtb2RpZmllZFdvcmtpbmdDb3BpZXNUb0JhY2t1cCA9IGF3YWl0IHRoaXMuc2hvdWxkQmFja3VwQmVmb3JlU2h1dGRvd24ocmVhc29uLCBtb2RpZmllZFdvcmtpbmdDb3BpZXMpO1xuXHRcdGlmIChtb2RpZmllZFdvcmtpbmdDb3BpZXNUb0JhY2t1cC5sZW5ndGggPiAwKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBiYWNrdXBSZXN1bHQgPSBhd2FpdCB0aGlzLmJhY2t1cEJlZm9yZVNodXRkb3duKG1vZGlmaWVkV29ya2luZ0NvcGllc1RvQmFja3VwKTtcblx0XHRcdFx0YmFja3VwcyA9IGJhY2t1cFJlc3VsdC5iYWNrdXBzO1xuXHRcdFx0XHRiYWNrdXBFcnJvciA9IGJhY2t1cFJlc3VsdC5lcnJvcjtcblxuXHRcdFx0XHRpZiAoYmFja3Vwcy5sZW5ndGggPT09IG1vZGlmaWVkV29ya2luZ0NvcGllcy5sZW5ndGgpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7IC8vIG5vIHZldG8gKGJhY2t1cCB3YXMgc3VjY2Vzc2Z1bCBmb3IgYWxsIHdvcmtpbmcgY29waWVzKVxuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRiYWNrdXBFcnJvciA9IGVycm9yO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHJlbWFpbmluZ01vZGlmaWVkV29ya2luZ0NvcGllcyA9IG1vZGlmaWVkV29ya2luZ0NvcGllcy5maWx0ZXIod29ya2luZ0NvcHkgPT4gIWJhY2t1cHMuaW5jbHVkZXMod29ya2luZ0NvcHkpKTtcblxuXHRcdC8vIFdlIHJhbiBhIGJhY2t1cCBidXQgcmVjZWl2ZWQgYW4gZXJyb3IgdGhhdCB3ZSBzaG93IHRvIHRoZSB1c2VyXG5cdFx0aWYgKGJhY2t1cEVycm9yKSB7XG5cdFx0XHRpZiAodGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuaXNFeHRlbnNpb25EZXZlbG9wbWVudCkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYFtiYWNrdXAgdHJhY2tlcl0gZXJyb3IgY3JlYXRpbmcgYmFja3VwczogJHtiYWNrdXBFcnJvcn1gKTtcblxuXHRcdFx0XHRyZXR1cm4gZmFsc2U7IC8vIGRvIG5vdCBibG9jayBzaHV0ZG93biBkdXJpbmcgZXh0ZW5zaW9uIGRldmVsb3BtZW50IChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTE1MDI4KVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdGhpcy5zaG93RXJyb3JEaWFsb2cobG9jYWxpemUoJ2JhY2t1cFRyYWNrZXJCYWNrdXBGYWlsZWQnLCBcIlRoZSBmb2xsb3dpbmcgZWRpdG9ycyB3aXRoIHVuc2F2ZWQgY2hhbmdlcyBjb3VsZCBub3QgYmUgc2F2ZWQgdG8gdGhlIGJhY2t1cCBsb2NhdGlvbi5cIiksIHJlbWFpbmluZ01vZGlmaWVkV29ya2luZ0NvcGllcywgYmFja3VwRXJyb3IsIHJlYXNvbik7XG5cdFx0fVxuXG5cdFx0Ly8gU2luY2UgYSBiYWNrdXAgZGlkIG5vdCBoYXBwZW4sIHdlIGhhdmUgdG8gY29uZmlybSBmb3Jcblx0XHQvLyB0aGUgd29ya2luZyBjb3BpZXMgdGhhdCBkaWQgbm90IHN1Y2Nlc3NmdWxseSBiYWNrdXBcblxuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5jb25maXJtQmVmb3JlU2h1dGRvd24ocmVtYWluaW5nTW9kaWZpZWRXb3JraW5nQ29waWVzKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0aWYgKHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnQpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBbYmFja3VwIHRyYWNrZXJdIGVycm9yIHNhdmluZyBvciByZXZlcnRpbmcgbW9kaWZpZWQgd29ya2luZyBjb3BpZXM6ICR7ZXJyb3J9YCk7XG5cblx0XHRcdFx0cmV0dXJuIGZhbHNlOyAvLyBkbyBub3QgYmxvY2sgc2h1dGRvd24gZHVyaW5nIGV4dGVuc2lvbiBkZXZlbG9wbWVudCAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzExNTAyOClcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRoaXMuc2hvd0Vycm9yRGlhbG9nKGxvY2FsaXplKCdiYWNrdXBUcmFja2VyQ29uZmlybUZhaWxlZCcsIFwiVGhlIGZvbGxvd2luZyBlZGl0b3JzIHdpdGggdW5zYXZlZCBjaGFuZ2VzIGNvdWxkIG5vdCBiZSBzYXZlZCBvciByZXZlcnRlZC5cIiksIHJlbWFpbmluZ01vZGlmaWVkV29ya2luZ0NvcGllcywgZXJyb3IsIHJlYXNvbik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzaG91bGRCYWNrdXBCZWZvcmVTaHV0ZG93bihyZWFzb246IFNodXRkb3duUmVhc29uLCBtb2RpZmllZFdvcmtpbmdDb3BpZXM6IHJlYWRvbmx5IElXb3JraW5nQ29weVtdKTogUHJvbWlzZTxyZWFkb25seSBJV29ya2luZ0NvcHlbXT4ge1xuXHRcdGlmICghdGhpcy5maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLmlzSG90RXhpdEVuYWJsZWQpIHtcblx0XHRcdHJldHVybiBbXTsgLy8gbmV2ZXIgYmFja3VwIHdoZW4gaG90IGV4aXQgaXMgZGlzYWJsZWQgdmlhIHNldHRpbmdzXG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnQpIHtcblx0XHRcdHJldHVybiBtb2RpZmllZFdvcmtpbmdDb3BpZXM7IC8vIGFsd2F5cyBiYWNrdXAgY2xvc2luZyBleHRlbnNpb24gZGV2ZWxvcG1lbnQgd2luZG93IHdpdGhvdXQgYXNraW5nIHRvIHNwZWVkIHVwIGRlYnVnZ2luZ1xuXHRcdH1cblxuXHRcdHN3aXRjaCAocmVhc29uKSB7XG5cblx0XHRcdC8vIFdpbmRvdyBDbG9zZVxuXHRcdFx0Y2FzZSBTaHV0ZG93blJlYXNvbi5DTE9TRTpcblx0XHRcdFx0aWYgKHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSAhPT0gV29ya2JlbmNoU3RhdGUuRU1QVFkgJiYgdGhpcy5maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLmhvdEV4aXRDb25maWd1cmF0aW9uID09PSBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElUX0FORF9XSU5ET1dfQ0xPU0UpIHtcblx0XHRcdFx0XHRyZXR1cm4gbW9kaWZpZWRXb3JraW5nQ29waWVzOyAvLyBiYWNrdXAgaWYgYSB3b3Jrc3BhY2UvZm9sZGVyIGlzIG9wZW4gYW5kIG9uRXhpdEFuZFdpbmRvd0Nsb3NlIGlzIGNvbmZpZ3VyZWRcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChpc01hY2ludG9zaCB8fCBhd2FpdCB0aGlzLm5hdGl2ZUhvc3RTZXJ2aWNlLmdldFdpbmRvd0NvdW50KCkgPiAxKSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSAhPT0gV29ya2JlbmNoU3RhdGUuRU1QVFkpIHtcblx0XHRcdFx0XHRcdHJldHVybiBtb2RpZmllZFdvcmtpbmdDb3BpZXMuZmlsdGVyKG1vZGlmaWVkV29ya2luZ0NvcHkgPT4gbW9kaWZpZWRXb3JraW5nQ29weS5jYXBhYmlsaXRpZXMgJiBXb3JraW5nQ29weUNhcGFiaWxpdGllcy5TY3JhdGNocGFkKTsgLy8gYmFja3VwIHNjcmF0Y2hwYWRzIGF1dG9tYXRpY2FsbHkgdG8gYXZvaWQgdXNlciBjb25maXJtYXRpb25cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gW107IC8vIGRvIG5vdCBiYWNrdXAgaWYgYSB3aW5kb3cgaXMgY2xvc2VkIHRoYXQgZG9lcyBub3QgY2F1c2UgcXVpdHRpbmcgb2YgdGhlIGFwcGxpY2F0aW9uXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gbW9kaWZpZWRXb3JraW5nQ29waWVzOyAvLyBiYWNrdXAgaWYgbGFzdCB3aW5kb3cgaXMgY2xvc2VkIG9uIHdpbi9saW51eCB3aGVyZSB0aGUgYXBwbGljYXRpb24gcXVpdHMgcmlnaHQgYWZ0ZXJcblxuXHRcdFx0Ly8gQXBwbGljYXRpb24gUXVpdFxuXHRcdFx0Y2FzZSBTaHV0ZG93blJlYXNvbi5RVUlUOlxuXHRcdFx0XHRyZXR1cm4gbW9kaWZpZWRXb3JraW5nQ29waWVzOyAvLyBiYWNrdXAgYmVjYXVzZSBuZXh0IHN0YXJ0IHdlIHJlc3RvcmUgYWxsIGJhY2t1cHNcblxuXHRcdFx0Ly8gV2luZG93IFJlbG9hZFxuXHRcdFx0Y2FzZSBTaHV0ZG93blJlYXNvbi5SRUxPQUQ6XG5cdFx0XHRcdHJldHVybiBtb2RpZmllZFdvcmtpbmdDb3BpZXM7IC8vIGJhY2t1cCBiZWNhdXNlIGFmdGVyIHdpbmRvdyByZWxvYWQsIGJhY2t1cHMgcmVzdG9yZVxuXG5cdFx0XHQvLyBXb3Jrc3BhY2UgQ2hhbmdlXG5cdFx0XHRjYXNlIFNodXRkb3duUmVhc29uLkxPQUQ6XG5cdFx0XHRcdGlmICh0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgIT09IFdvcmtiZW5jaFN0YXRlLkVNUFRZKSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuZmlsZXNDb25maWd1cmF0aW9uU2VydmljZS5ob3RFeGl0Q29uZmlndXJhdGlvbiA9PT0gSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVF9BTkRfV0lORE9XX0NMT1NFKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbW9kaWZpZWRXb3JraW5nQ29waWVzOyAvLyBiYWNrdXAgaWYgYSB3b3Jrc3BhY2UvZm9sZGVyIGlzIG9wZW4gYW5kIG9uRXhpdEFuZFdpbmRvd0Nsb3NlIGlzIGNvbmZpZ3VyZWRcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gbW9kaWZpZWRXb3JraW5nQ29waWVzLmZpbHRlcihtb2RpZmllZFdvcmtpbmdDb3B5ID0+IG1vZGlmaWVkV29ya2luZ0NvcHkuY2FwYWJpbGl0aWVzICYgV29ya2luZ0NvcHlDYXBhYmlsaXRpZXMuU2NyYXRjaHBhZCk7IC8vIGJhY2t1cCBzY3JhdGNocGFkcyBhdXRvbWF0aWNhbGx5IHRvIGF2b2lkIHVzZXIgY29uZmlybWF0aW9uXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gW107IC8vIGRvIG5vdCBiYWNrdXAgYmVjYXVzZSB3ZSBhcmUgc3dpdGNoaW5nIGNvbnRleHRzIHdpdGggbm8gd29ya3NwYWNlL2ZvbGRlciBvcGVuXG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzaG93RXJyb3JEaWFsb2cobWVzc2FnZTogc3RyaW5nLCB3b3JraW5nQ29waWVzOiByZWFkb25seSBJV29ya2luZ0NvcHlbXSwgZXJyb3I6IEVycm9yLCByZWFzb246IFNodXRkb3duUmVhc29uKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBbYmFja3VwIHRyYWNrZXJdICR7bWVzc2FnZX06ICR7ZXJyb3J9YCk7XG5cblx0XHRjb25zdCBtb2RpZmllZFdvcmtpbmdDb3BpZXMgPSB3b3JraW5nQ29waWVzLmZpbHRlcih3b3JraW5nQ29weSA9PiB3b3JraW5nQ29weS5pc01vZGlmaWVkKCkpO1xuXG5cdFx0Y29uc3QgYWR2aWNlID0gbG9jYWxpemUoJ2JhY2t1cEVycm9yRGV0YWlscycsIFwiVHJ5IHNhdmluZyBvciByZXZlcnRpbmcgdGhlIGVkaXRvcnMgd2l0aCB1bnNhdmVkIGNoYW5nZXMgZmlyc3QgYW5kIHRoZW4gdHJ5IGFnYWluLlwiKTtcblx0XHRjb25zdCBkZXRhaWwgPSBtb2RpZmllZFdvcmtpbmdDb3BpZXMubGVuZ3RoXG5cdFx0XHQ/IGAke2dldEZpbGVOYW1lc01lc3NhZ2UobW9kaWZpZWRXb3JraW5nQ29waWVzLm1hcCh4ID0+IHgubmFtZSkpfVxcbiR7YWR2aWNlfWBcblx0XHRcdDogYWR2aWNlO1xuXG5cdFx0Y29uc3QgeyByZXN1bHQgfSA9IGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5wcm9tcHQoe1xuXHRcdFx0dHlwZTogJ2Vycm9yJyxcblx0XHRcdG1lc3NhZ2UsXG5cdFx0XHRkZXRhaWwsXG5cdFx0XHRidXR0b25zOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoeyBrZXk6ICdvaycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJk9LXCIpLFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4gdHJ1ZSAvLyB2ZXRvXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRsYWJlbDogdGhpcy50b0ZvcmNlU2h1dGRvd25MYWJlbChyZWFzb24pLFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4gZmFsc2UgLy8gbm8gdmV0b1xuXHRcdFx0XHR9XG5cdFx0XHRdLFxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHJlc3VsdCA/PyB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSB0b0ZvcmNlU2h1dGRvd25MYWJlbChyZWFzb246IFNodXRkb3duUmVhc29uKTogc3RyaW5nIHtcblx0XHRzd2l0Y2ggKHJlYXNvbikge1xuXHRcdFx0Y2FzZSBTaHV0ZG93blJlYXNvbi5DTE9TRTpcblx0XHRcdGNhc2UgU2h1dGRvd25SZWFzb24uTE9BRDpcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdzaHV0ZG93bkZvcmNlQ2xvc2UnLCBcIkNsb3NlIEFueXdheVwiKTtcblx0XHRcdGNhc2UgU2h1dGRvd25SZWFzb24uUVVJVDpcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdzaHV0ZG93bkZvcmNlUXVpdCcsIFwiUXVpdCBBbnl3YXlcIik7XG5cdFx0XHRjYXNlIFNodXRkb3duUmVhc29uLlJFTE9BRDpcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdzaHV0ZG93bkZvcmNlUmVsb2FkJywgXCJSZWxvYWQgQW55d2F5XCIpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgYmFja3VwQmVmb3JlU2h1dGRvd24obW9kaWZpZWRXb3JraW5nQ29waWVzOiByZWFkb25seSBJV29ya2luZ0NvcHlbXSk6IFByb21pc2U8eyBiYWNrdXBzOiBJV29ya2luZ0NvcHlbXTsgZXJyb3I/OiBFcnJvciB9PiB7XG5cdFx0Y29uc3QgYmFja3VwczogSVdvcmtpbmdDb3B5W10gPSBbXTtcblx0XHRsZXQgZXJyb3I6IEVycm9yIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0YXdhaXQgdGhpcy53aXRoUHJvZ3Jlc3NBbmRDYW5jZWxsYXRpb24oYXN5bmMgdG9rZW4gPT4ge1xuXG5cdFx0XHQvLyBQZXJmb3JtIGEgYmFja3VwIG9mIGFsbCBtb2RpZmllZCB3b3JraW5nIGNvcGllcyB1bmxlc3MgYSBiYWNrdXAgYWxyZWFkeSBleGlzdHNcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IFByb21pc2VzLnNldHRsZWQobW9kaWZpZWRXb3JraW5nQ29waWVzLm1hcChhc3luYyB3b3JraW5nQ29weSA9PiB7XG5cblx0XHRcdFx0XHQvLyBCYWNrdXAgZXhpc3RzXG5cdFx0XHRcdFx0Y29uc3QgY29udGVudFZlcnNpb24gPSB0aGlzLmdldENvbnRlbnRWZXJzaW9uKHdvcmtpbmdDb3B5KTtcblx0XHRcdFx0XHRpZiAodGhpcy53b3JraW5nQ29weUJhY2t1cFNlcnZpY2UuaGFzQmFja3VwU3luYyh3b3JraW5nQ29weSwgY29udGVudFZlcnNpb24pKSB7XG5cdFx0XHRcdFx0XHRiYWNrdXBzLnB1c2god29ya2luZ0NvcHkpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIEJhY2t1cCBkb2VzIG5vdCBleGlzdFxuXHRcdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdFx0Y29uc3QgYmFja3VwID0gYXdhaXQgd29ya2luZ0NvcHkuYmFja3VwKHRva2VuKTtcblx0XHRcdFx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMud29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlLmJhY2t1cCh3b3JraW5nQ29weSwgYmFja3VwLmNvbnRlbnQsIGNvbnRlbnRWZXJzaW9uLCBiYWNrdXAubWV0YSwgdG9rZW4pO1xuXHRcdFx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0YmFja3Vwcy5wdXNoKHdvcmtpbmdDb3B5KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblx0XHRcdH0gY2F0Y2ggKGJhY2t1cEVycm9yKSB7XG5cdFx0XHRcdGVycm9yID0gYmFja3VwRXJyb3I7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRcdGxvY2FsaXplKCdiYWNrdXBCZWZvcmVTaHV0ZG93bk1lc3NhZ2UnLCBcIkJhY2tpbmcgdXAgZWRpdG9ycyB3aXRoIHVuc2F2ZWQgY2hhbmdlcyBpcyB0YWtpbmcgYSBiaXQgbG9uZ2VyLi4uXCIpLFxuXHRcdFx0bG9jYWxpemUoJ2JhY2t1cEJlZm9yZVNodXRkb3duRGV0YWlsJywgXCJDbGljayAnQ2FuY2VsJyB0byBzdG9wIHdhaXRpbmcgYW5kIHRvIHNhdmUgb3IgcmV2ZXJ0IGVkaXRvcnMgd2l0aCB1bnNhdmVkIGNoYW5nZXMuXCIpXG5cdFx0KTtcblxuXHRcdHJldHVybiB7IGJhY2t1cHMsIGVycm9yIH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNvbmZpcm1CZWZvcmVTaHV0ZG93bihtb2RpZmllZFdvcmtpbmdDb3BpZXM6IElXb3JraW5nQ29weVtdKTogUHJvbWlzZTxib29sZWFuPiB7XG5cblx0XHQvLyBTYXZlXG5cdFx0Y29uc3QgY29uZmlybSA9IGF3YWl0IHRoaXMuZmlsZURpYWxvZ1NlcnZpY2Uuc2hvd1NhdmVDb25maXJtKG1vZGlmaWVkV29ya2luZ0NvcGllcy5tYXAod29ya2luZ0NvcHkgPT4gd29ya2luZ0NvcHkubmFtZSkpO1xuXHRcdGlmIChjb25maXJtID09PSBDb25maXJtUmVzdWx0LlNBVkUpIHtcblx0XHRcdGNvbnN0IG1vZGlmaWVkQ291bnRCZWZvcmVTYXZlID0gdGhpcy53b3JraW5nQ29weVNlcnZpY2UubW9kaWZpZWRDb3VudDtcblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5kb1NhdmVBbGxCZWZvcmVTaHV0ZG93bihtb2RpZmllZFdvcmtpbmdDb3BpZXMsIFNhdmVSZWFzb24uRVhQTElDSVQpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBbYmFja3VwIHRyYWNrZXJdIGVycm9yIHNhdmluZyBtb2RpZmllZCB3b3JraW5nIGNvcGllczogJHtlcnJvcn1gKTsgLy8gZ3VhcmQgYWdhaW5zdCBtaXNiZWhhdmluZyBzYXZlcywgd2UgaGFuZGxlIHJlbWFpbmluZyBtb2RpZmllZCBiZWxvd1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzYXZlZFdvcmtpbmdDb3BpZXMgPSBtb2RpZmllZENvdW50QmVmb3JlU2F2ZSAtIHRoaXMud29ya2luZ0NvcHlTZXJ2aWNlLm1vZGlmaWVkQ291bnQ7XG5cdFx0XHRpZiAoc2F2ZWRXb3JraW5nQ29waWVzIDwgbW9kaWZpZWRXb3JraW5nQ29waWVzLmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTsgLy8gdmV0byAoc2F2ZSBmYWlsZWQgb3Igd2FzIGNhbmNlbGVkKVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdGhpcy5ub1ZldG8obW9kaWZpZWRXb3JraW5nQ29waWVzKTsgLy8gbm8gdmV0byAobW9kaWZpZWQgc2F2ZWQpXG5cdFx0fVxuXG5cdFx0Ly8gRG9uJ3QgU2F2ZVxuXHRcdGVsc2UgaWYgKGNvbmZpcm0gPT09IENvbmZpcm1SZXN1bHQuRE9OVF9TQVZFKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmRvUmV2ZXJ0QWxsQmVmb3JlU2h1dGRvd24obW9kaWZpZWRXb3JraW5nQ29waWVzKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihgW2JhY2t1cCB0cmFja2VyXSBlcnJvciByZXZlcnRpbmcgbW9kaWZpZWQgd29ya2luZyBjb3BpZXM6ICR7ZXJyb3J9YCk7IC8vIGRvIG5vdCBibG9jayB0aGUgc2h1dGRvd24gb24gZXJyb3JzIGZyb20gcmV2ZXJ0XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB0aGlzLm5vVmV0byhtb2RpZmllZFdvcmtpbmdDb3BpZXMpOyAvLyBubyB2ZXRvIChtb2RpZmllZCByZXZlcnRlZClcblx0XHR9XG5cblx0XHQvLyBDYW5jZWxcblx0XHRyZXR1cm4gdHJ1ZTsgLy8gdmV0byAodXNlciBjYW5jZWxlZClcblx0fVxuXG5cdHByaXZhdGUgZG9TYXZlQWxsQmVmb3JlU2h1dGRvd24od29ya2luZ0NvcGllczogSVdvcmtpbmdDb3B5W10sIHJlYXNvbjogU2F2ZVJlYXNvbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLndpdGhQcm9ncmVzc0FuZENhbmNlbGxhdGlvbihhc3luYyAoKSA9PiB7XG5cblx0XHRcdC8vIFNraXAgc2F2ZSBwYXJ0aWNpcGFudHMgb24gc2h1dGRvd24gZm9yIHBlcmZvcm1hbmNlIHJlYXNvbnNcblx0XHRcdGNvbnN0IHNhdmVPcHRpb25zID0geyBza2lwU2F2ZVBhcnRpY2lwYW50czogdHJ1ZSwgcmVhc29uIH07XG5cblx0XHRcdC8vIEZpcnN0IHNhdmUgdGhyb3VnaCB0aGUgZWRpdG9yIHNlcnZpY2UgaWYgd2Ugc2F2ZSBhbGwgdG8gYmVuZWZpdFxuXHRcdFx0Ly8gZnJvbSBzb21lIGV4dHJhcyBsaWtlIHN3aXRjaGluZyB0byB1bnRpdGxlZCBtb2RpZmllZCBlZGl0b3JzIGJlZm9yZSBzYXZpbmcuXG5cdFx0XHRsZXQgcmVzdWx0OiBib29sZWFuIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHdvcmtpbmdDb3BpZXMubGVuZ3RoID09PSB0aGlzLndvcmtpbmdDb3B5U2VydmljZS5tb2RpZmllZENvdW50KSB7XG5cdFx0XHRcdHJlc3VsdCA9IChhd2FpdCB0aGlzLmVkaXRvclNlcnZpY2Uuc2F2ZUFsbCh7XG5cdFx0XHRcdFx0aW5jbHVkZVVudGl0bGVkOiB7IGluY2x1ZGVTY3JhdGNocGFkOiB0cnVlIH0sXG5cdFx0XHRcdFx0Li4uc2F2ZU9wdGlvbnNcblx0XHRcdFx0fSkpLnN1Y2Nlc3M7XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmIHdlIHN0aWxsIGhhdmUgbW9kaWZpZWQgd29ya2luZyBjb3BpZXMsIHNhdmUgdGhvc2UgZGlyZWN0bHlcblx0XHRcdC8vIHVubGVzcyB0aGUgc2F2ZSB3YXMgbm90IHN1Y2Nlc3NmdWwgKGUuZy4gY2FuY2VsbGVkKVxuXHRcdFx0aWYgKHJlc3VsdCAhPT0gZmFsc2UpIHtcblx0XHRcdFx0YXdhaXQgUHJvbWlzZXMuc2V0dGxlZCh3b3JraW5nQ29waWVzLm1hcCh3b3JraW5nQ29weSA9PiB3b3JraW5nQ29weS5pc01vZGlmaWVkKCkgPyB3b3JraW5nQ29weS5zYXZlKHNhdmVPcHRpb25zKSA6IFByb21pc2UucmVzb2x2ZSh0cnVlKSkpO1xuXHRcdFx0fVxuXHRcdH0sXG5cdFx0XHRsb2NhbGl6ZSgnc2F2ZUJlZm9yZVNodXRkb3duJywgXCJTYXZpbmcgZWRpdG9ycyB3aXRoIHVuc2F2ZWQgY2hhbmdlcyBpcyB0YWtpbmcgYSBiaXQgbG9uZ2VyLi4uXCIpLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0Ly8gRG8gbm90IHBpY2sgYERpYWxvZ2AgYXMgbG9jYXRpb24gZm9yIHJlcG9ydGluZyBwcm9ncmVzcyBpZiBpdCBpcyBsaWtlbHlcblx0XHRcdC8vIHRoYXQgdGhlIHNhdmUgb3BlcmF0aW9uIHdpbGwgaXRzZWxmIG9wZW4gYSBkaWFsb2cgZm9yIGFza2luZyBmb3IgdGhlXG5cdFx0XHQvLyBsb2NhdGlvbiB0byBzYXZlIHRvIGZvciB1bnRpdGxlZCBvciBzY3JhdGNocGFkIHdvcmtpbmcgY29waWVzLlxuXHRcdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUtaW50ZXJuYWxiYWNrbG9nL2lzc3Vlcy80OTQzXG5cdFx0XHR3b3JraW5nQ29waWVzLnNvbWUod29ya2luZ0NvcHkgPT4gd29ya2luZ0NvcHkuY2FwYWJpbGl0aWVzICYgV29ya2luZ0NvcHlDYXBhYmlsaXRpZXMuVW50aXRsZWQgfHwgd29ya2luZ0NvcHkuY2FwYWJpbGl0aWVzICYgV29ya2luZ0NvcHlDYXBhYmlsaXRpZXMuU2NyYXRjaHBhZCkgPyBQcm9ncmVzc0xvY2F0aW9uLldpbmRvdyA6IFByb2dyZXNzTG9jYXRpb24uRGlhbG9nKTtcblx0fVxuXG5cdHByaXZhdGUgZG9SZXZlcnRBbGxCZWZvcmVTaHV0ZG93bihtb2RpZmllZFdvcmtpbmdDb3BpZXM6IElXb3JraW5nQ29weVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMud2l0aFByb2dyZXNzQW5kQ2FuY2VsbGF0aW9uKGFzeW5jICgpID0+IHtcblxuXHRcdFx0Ly8gU29mdCByZXZlcnQgaXMgZ29vZCBlbm91Z2ggb24gc2h1dGRvd25cblx0XHRcdGNvbnN0IHJldmVydE9wdGlvbnMgPSB7IHNvZnQ6IHRydWUgfTtcblxuXHRcdFx0Ly8gRmlyc3QgcmV2ZXJ0IHRocm91Z2ggdGhlIGVkaXRvciBzZXJ2aWNlIGlmIHdlIHJldmVydCBhbGxcblx0XHRcdGlmIChtb2RpZmllZFdvcmtpbmdDb3BpZXMubGVuZ3RoID09PSB0aGlzLndvcmtpbmdDb3B5U2VydmljZS5tb2RpZmllZENvdW50KSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuZWRpdG9yU2VydmljZS5yZXZlcnRBbGwocmV2ZXJ0T3B0aW9ucyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmIHdlIHN0aWxsIGhhdmUgbW9kaWZpZWQgd29ya2luZyBjb3BpZXMsIHJldmVydCB0aG9zZSBkaXJlY3RseVxuXHRcdFx0YXdhaXQgUHJvbWlzZXMuc2V0dGxlZChtb2RpZmllZFdvcmtpbmdDb3BpZXMubWFwKHdvcmtpbmdDb3B5ID0+IHdvcmtpbmdDb3B5LmlzTW9kaWZpZWQoKSA/IHdvcmtpbmdDb3B5LnJldmVydChyZXZlcnRPcHRpb25zKSA6IFByb21pc2UucmVzb2x2ZSgpKSk7XG5cdFx0fSwgbG9jYWxpemUoJ3JldmVydEJlZm9yZVNodXRkb3duJywgXCJSZXZlcnRpbmcgZWRpdG9ycyB3aXRoIHVuc2F2ZWQgY2hhbmdlcyBpcyB0YWtpbmcgYSBiaXQgbG9uZ2VyLi4uXCIpKTtcblx0fVxuXG5cdHByaXZhdGUgb25CZWZvcmVTaHV0ZG93bldpdGhvdXRNb2RpZmllZCgpOiBQcm9taXNlPGJvb2xlYW4+IHtcblxuXHRcdC8vIFdlIGFyZSBhYm91dCB0byBzaHV0ZG93biB3aXRob3V0IG1vZGlmaWVkIGVkaXRvcnNcblx0XHQvLyBhbmQgd2lsbCBkaXNjYXJkIGFueSBiYWNrdXBzIHRoYXQgYXJlIHN0aWxsXG5cdFx0Ly8gYXJvdW5kIHRoYXQgaGF2ZSBub3QgYmVlbiBoYW5kbGVkIGRlcGVuZGluZ1xuXHRcdC8vIG9uIHRoZSB3aW5kb3cgc3RhdGUuXG5cdFx0Ly9cblx0XHQvLyBFbXB0eSB3aW5kb3c6IGRpc2NhcmQgZXZlbiB1bnJlc3RvcmVkIGJhY2t1cHMgdG9cblx0XHQvLyBwcmV2ZW50IGVtcHR5IHdpbmRvd3MgZnJvbSByZXN0b3JpbmcgdGhhdCBjYW5ub3Rcblx0XHQvLyBiZSBjbG9zZWQgKHdvcmthcm91bmQgZm9yIG5vdCBoYXZpbmcgaW1wbGVtZW50ZWRcblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTI3MTYzXG5cdFx0Ly8gYW5kIGEgZml4IGZvciB3aGF0IHVzZXJzIGhhdmUgcmVwb3J0ZWQgaW4gaXNzdWVcblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTI2NzI1KVxuXHRcdC8vXG5cdFx0Ly8gV29ya3NwYWNlL0ZvbGRlciB3aW5kb3c6IGRvIG5vdCBkaXNjYXJkIHVucmVzdG9yZWRcblx0XHQvLyBiYWNrdXBzIHRvIGdpdmUgYSBjaGFuY2UgdG8gcmVzdG9yZSB0aGVtIGluIHRoZVxuXHRcdC8vIGZ1dHVyZS4gU2luY2Ugd2UgZG8gbm90IHJlc3RvcmUgd29ya3NwYWNlL2ZvbGRlclxuXHRcdC8vIHdpbmRvd3Mgd2l0aCBiYWNrdXBzLCB0aGlzIGlzIGZpbmUuXG5cblx0XHRyZXR1cm4gdGhpcy5ub1ZldG8oeyBleGNlcHQ6IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuRU1QVFkgPyBbXSA6IEFycmF5LmZyb20odGhpcy51bnJlc3RvcmVkQmFja3VwcykgfSk7XG5cdH1cblxuXHRwcml2YXRlIG5vVmV0byhiYWNrdXBzVG9EaXNjYXJkOiBJV29ya2luZ0NvcHlJZGVudGlmaWVyW10pOiBQcm9taXNlPGJvb2xlYW4+O1xuXHRwcml2YXRlIG5vVmV0byhiYWNrdXBzVG9LZWVwOiB7IGV4Y2VwdDogSVdvcmtpbmdDb3B5SWRlbnRpZmllcltdIH0pOiBQcm9taXNlPGJvb2xlYW4+O1xuXHRwcml2YXRlIGFzeW5jIG5vVmV0byhhcmcxOiBJV29ya2luZ0NvcHlJZGVudGlmaWVyW10gfCB7IGV4Y2VwdDogSVdvcmtpbmdDb3B5SWRlbnRpZmllcltdIH0pOiBQcm9taXNlPGJvb2xlYW4+IHtcblxuXHRcdC8vIERpc2NhcmQgYmFja3VwcyBmcm9tIHdvcmtpbmcgY29waWVzIHRoZVxuXHRcdC8vIHVzZXIgZWl0aGVyIHNhdmVkIG9yIHJldmVydGVkXG5cblx0XHRhd2FpdCB0aGlzLmRpc2NhcmRCYWNrdXBzQmVmb3JlU2h1dGRvd24oYXJnMSk7XG5cblx0XHRyZXR1cm4gZmFsc2U7IC8vIG5vIHZldG8gKG5vIG1vZGlmaWVkKVxuXHR9XG5cblx0cHJpdmF0ZSBkaXNjYXJkQmFja3Vwc0JlZm9yZVNodXRkb3duKGJhY2t1cHNUb0Rpc2NhcmQ6IElXb3JraW5nQ29weUlkZW50aWZpZXJbXSk6IFByb21pc2U8dm9pZD47XG5cdHByaXZhdGUgZGlzY2FyZEJhY2t1cHNCZWZvcmVTaHV0ZG93bihiYWNrdXBzVG9LZWVwOiB7IGV4Y2VwdDogSVdvcmtpbmdDb3B5SWRlbnRpZmllcltdIH0pOiBQcm9taXNlPHZvaWQ+O1xuXHRwcml2YXRlIGRpc2NhcmRCYWNrdXBzQmVmb3JlU2h1dGRvd24oYmFja3Vwc1RvRGlzY2FyZE9yS2VlcDogSVdvcmtpbmdDb3B5SWRlbnRpZmllcltdIHwgeyBleGNlcHQ6IElXb3JraW5nQ29weUlkZW50aWZpZXJbXSB9KTogUHJvbWlzZTx2b2lkPjtcblx0cHJpdmF0ZSBhc3luYyBkaXNjYXJkQmFja3Vwc0JlZm9yZVNodXRkb3duKGFyZzE6IElXb3JraW5nQ29weUlkZW50aWZpZXJbXSB8IHsgZXhjZXB0OiBJV29ya2luZ0NvcHlJZGVudGlmaWVyW10gfSk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gV2UgbmV2ZXIgZGlzY2FyZCBhbnkgYmFja3VwcyBiZWZvcmUgd2UgYXJlIHJlYWR5XG5cdFx0Ly8gYW5kIGhhdmUgcmVzb2x2ZWQgYWxsIGJhY2t1cHMgdGhhdCBleGlzdC4gVGhpc1xuXHRcdC8vIGlzIGltcG9ydGFudCB0byBub3QgbG9vc2UgYmFja3VwcyB0aGF0IGhhdmUgbm90XG5cdFx0Ly8gYmVlbiBoYW5kbGVkLlxuXG5cdFx0aWYgKCF0aGlzLmlzUmVhZHkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLndpdGhQcm9ncmVzc0FuZENhbmNlbGxhdGlvbihhc3luYyAoKSA9PiB7XG5cblx0XHRcdC8vIFdoZW4gd2Ugc2h1dGRvd24gZWl0aGVyIHdpdGggbm8gbW9kaWZpZWQgd29ya2luZyBjb3BpZXMgbGVmdFxuXHRcdFx0Ly8gb3Igd2l0aCBzb21lIGhhbmRsZWQsIHdlIHN0YXJ0IHRvIGRpc2NhcmQgdGhlc2UgYmFja3Vwc1xuXHRcdFx0Ly8gdG8gZnJlZSB0aGVtIHVwLiBUaGlzIGhlbHBzIHRvIGdldCByaWQgb2Ygc3RhbGUgYmFja3Vwc1xuXHRcdFx0Ly8gYXMgcmVwb3J0ZWQgaW4gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzkyOTYyXG5cdFx0XHQvL1xuXHRcdFx0Ly8gSG93ZXZlciwgd2UgbmV2ZXIgd2FudCB0byBkaXNjYXJkIGJhY2t1cHMgdGhhdCB3ZSBrbm93XG5cdFx0XHQvLyB3ZXJlIG5vdCByZXN0b3JlZCBpbiB0aGUgc2Vzc2lvbi5cblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0aWYgKEFycmF5LmlzQXJyYXkoYXJnMSkpIHtcblx0XHRcdFx0XHRhd2FpdCBQcm9taXNlcy5zZXR0bGVkKGFyZzEubWFwKHdvcmtpbmdDb3B5ID0+IHRoaXMud29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlLmRpc2NhcmRCYWNrdXAod29ya2luZ0NvcHkpKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy53b3JraW5nQ29weUJhY2t1cFNlcnZpY2UuZGlzY2FyZEJhY2t1cHMoYXJnMSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihgW2JhY2t1cCB0cmFja2VyXSBlcnJvciBkaXNjYXJkaW5nIGJhY2t1cHM6ICR7ZXJyb3J9YCk7XG5cdFx0XHR9XG5cdFx0fSwgbG9jYWxpemUoJ2Rpc2NhcmRCYWNrdXBzQmVmb3JlU2h1dGRvd24nLCBcIkRpc2NhcmRpbmcgYmFja3VwcyBpcyB0YWtpbmcgYSBiaXQgbG9uZ2VyLi4uXCIpKTtcblx0fVxuXG5cdHByaXZhdGUgd2l0aFByb2dyZXNzQW5kQ2FuY2VsbGF0aW9uKHByb21pc2VGYWN0b3J5OiAodG9rZW46IENhbmNlbGxhdGlvblRva2VuKSA9PiBQcm9taXNlPHZvaWQ+LCB0aXRsZTogc3RyaW5nLCBkZXRhaWw/OiBzdHJpbmcsIGxvY2F0aW9uID0gUHJvZ3Jlc3NMb2NhdGlvbi5EaWFsb2cpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblxuXHRcdHJldHVybiB0aGlzLnByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3Moe1xuXHRcdFx0bG9jYXRpb24sIFx0XHRcdC8vIGJ5IGRlZmF1bHQgdXNlIGEgZGlhbG9nIHRvIHByZXZlbnQgdGhlIHVzZXIgZnJvbSBtYWtpbmcgYW55IG1vcmUgY2hhbmdlcyBub3cgKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMjI3NzQpXG5cdFx0XHRjYW5jZWxsYWJsZTogdHJ1ZSwgXHQvLyBhbGxvdyB0byBjYW5jZWwgKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMTIyNzgpXG5cdFx0XHRkZWxheTogODAwLCBcdFx0Ly8gZGVsYXkgc28gdGhhdCBpdCBvbmx5IGFwcGVhcnMgd2hlbiBvcGVyYXRpb24gdGFrZXMgYSBsb25nIHRpbWVcblx0XHRcdHRpdGxlLFxuXHRcdFx0ZGV0YWlsXG5cdFx0fSwgKCkgPT4gcmFjZUNhbmNlbGxhdGlvbihwcm9taXNlRmFjdG9yeShjdHMudG9rZW4pLCBjdHMudG9rZW4pLCAoKSA9PiBjdHMuZGlzcG9zZSh0cnVlKSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxpQ0FBaUM7QUFFMUMsU0FBUyw0QkFBNEIsb0JBQW9CO0FBQ3pELFNBQVMsMkJBQTJCO0FBQ3BDLFNBQStDLCtCQUErQjtBQUM5RSxTQUFTLG1CQUFtQixzQkFBc0I7QUFDbEQsU0FBUyxlQUFlLG9CQUFvQixnQkFBZ0IsMkJBQTJCO0FBQ3ZGLFNBQVMsZ0JBQWdCLGdDQUFnQztBQUN6RCxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLDJCQUEyQjtBQUNwQyxTQUE0QiwrQkFBK0I7QUFDM0QsU0FBUyxrQkFBa0Isd0JBQXdCO0FBQ25ELFNBQVMsVUFBVSx3QkFBd0I7QUFDM0MsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyw0QkFBNEI7QUFFOUIsSUFBTSxpQ0FBTixjQUE2Qyx5QkFBMkQ7QUFBQSxFQUk5RyxZQUM0QiwwQkFDQywyQkFDUCxvQkFDRixrQkFDa0IsbUJBQ0osZUFDVSxnQkFDTixtQkFDeEIsWUFDeUIsb0JBQ0gsaUJBQ1IsMEJBQ1gsZUFDTSxvQkFDckI7QUFDRCxVQUFNLDBCQUEwQixvQkFBb0IsWUFBWSxrQkFBa0IsMkJB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
