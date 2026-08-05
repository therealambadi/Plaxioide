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
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { AbstractFileDialogService } from "./abstractFileDialogService.js";
import { Schemas } from "../../../../base/common/network.js";
import { memoize } from "../../../../base/common/decorators.js";
import { localize } from "../../../../nls.js";
import { getMediaOrTextMime } from "../../../../base/common/mime.js";
import { basename } from "../../../../base/common/resources.js";
import { getActiveWindow, triggerDownload, triggerUpload } from "../../../../base/browser/dom.js";
import Severity from "../../../../base/common/severity.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { extractFileListData } from "../../../../platform/dnd/browser/dnd.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { WebFileSystemAccess } from "../../../../platform/files/browser/webFileSystemAccess.js";
import { EmbeddedCodeEditorWidget } from "../../../../editor/browser/widget/codeEditor/embeddedCodeEditorWidget.js";
class FileDialogService extends AbstractFileDialogService {
  get fileSystemProvider() {
    return this.fileService.getProvider(Schemas.file);
  }
  async pickFileFolderAndOpen(options) {
    const schema = this.getFileSystemSchema(options);
    if (!options.defaultUri) {
      options.defaultUri = await this.defaultFilePath(schema);
    }
    if (this.shouldUseSimplified(schema)) {
      return super.pickFileFolderAndOpenSimplified(schema, options, false);
    }
    throw new Error(localize("pickFolderAndOpen", "Can't open folders, try adding a folder to the workspace instead."));
  }
  addFileSchemaIfNeeded(schema, isFolder) {
    return schema === Schemas.untitled ? [Schemas.file] : schema !== Schemas.file && (!isFolder || schema !== Schemas.vscodeRemote) ? [schema, Schemas.file] : [schema];
  }
  async pickFileAndOpen(options) {
    const schema = this.getFileSystemSchema(options);
    if (!options.defaultUri) {
      options.defaultUri = await this.defaultFilePath(schema);
    }
    if (this.shouldUseSimplified(schema)) {
      return super.pickFileAndOpenSimplified(schema, options, false);
    }
    const activeWindow = getActiveWindow();
    if (!WebFileSystemAccess.supported(activeWindow)) {
      return this.showUnsupportedBrowserWarning("open");
    }
    let fileHandle = void 0;
    try {
      [fileHandle] = await activeWindow.showOpenFilePicker({ multiple: false });
    } catch (error) {
      return;
    }
    if (!WebFileSystemAccess.isFileSystemFileHandle(fileHandle)) {
      return;
    }
    const uri = await this.fileSystemProvider.registerFileHandle(fileHandle);
    this.addFileToRecentlyOpened(uri);
    await this.openerService.open(uri, { fromUserGesture: true, editorOptions: { pinned: true } });
  }
  async pickFolderAndOpen(options) {
    const schema = this.getFileSystemSchema(options);
    if (!options.defaultUri) {
      options.defaultUri = await this.defaultFolderPath(schema);
    }
    if (this.shouldUseSimplified(schema)) {
      return super.pickFolderAndOpenSimplified(schema, options);
    }
    throw new Error(localize("pickFolderAndOpen", "Can't open folders, try adding a folder to the workspace instead."));
  }
  async pickWorkspaceAndOpen(options) {
    options.availableFileSystems = this.getWorkspaceAvailableFileSystems(options);
    const schema = this.getFileSystemSchema(options);
    if (!options.defaultUri) {
      options.defaultUri = await this.defaultWorkspacePath(schema);
    }
    if (this.shouldUseSimplified(schema)) {
      return super.pickWorkspaceAndOpenSimplified(schema, options);
    }
    throw new Error(localize("pickWorkspaceAndOpen", "Can't open workspaces, try adding a folder to the workspace instead."));
  }
  async pickFileToSave(defaultUri, availableFileSystems) {
    const schema = this.getFileSystemSchema({ defaultUri, availableFileSystems });
    const options = this.getPickFileToSaveDialogOptions(defaultUri, availableFileSystems);
    if (this.shouldUseSimplified(schema)) {
      return super.pickFileToSaveSimplified(schema, options);
    }
    const activeWindow = getActiveWindow();
    if (!WebFileSystemAccess.supported(activeWindow)) {
      return this.showUnsupportedBrowserWarning("save");
    }
    let fileHandle = void 0;
    const startIn = Iterable.first(this.fileSystemProvider.directories);
    try {
      fileHandle = await activeWindow.showSaveFilePicker({ types: this.getFilePickerTypes(options.filters), ...{ suggestedName: basename(defaultUri), startIn } });
    } catch (error) {
      return;
    }
    if (!WebFileSystemAccess.isFileSystemFileHandle(fileHandle)) {
      return void 0;
    }
    return this.fileSystemProvider.registerFileHandle(fileHandle);
  }
  getFilePickerTypes(filters) {
    return filters?.filter((filter) => {
      return !(filter.extensions.length === 1 && (filter.extensions[0] === "*" || filter.extensions[0] === ""));
    }).map((filter) => {
      const accept = {};
      const extensions = filter.extensions.filter((ext) => ext.indexOf("-") < 0 && ext.indexOf("*") < 0 && ext.indexOf("_") < 0);
      accept[getMediaOrTextMime(`fileName.${filter.extensions[0]}`) ?? "text/plain"] = extensions.map((ext) => ext.startsWith(".") ? ext : `.${ext}`);
      return {
        description: filter.name,
        accept
      };
    });
  }
  async showSaveDialog(options) {
    const schema = this.getFileSystemSchema(options);
    if (this.shouldUseSimplified(schema)) {
      return super.showSaveDialogSimplified(schema, options);
    }
    const activeWindow = getActiveWindow();
    if (!WebFileSystemAccess.supported(activeWindow)) {
      return this.showUnsupportedBrowserWarning("save");
    }
    let fileHandle = void 0;
    const startIn = Iterable.first(this.fileSystemProvider.directories);
    try {
      fileHandle = await activeWindow.showSaveFilePicker({ types: this.getFilePickerTypes(options.filters), ...options.defaultUri ? { suggestedName: basename(options.defaultUri) } : void 0, ...{ startIn } });
    } catch (error) {
      return void 0;
    }
    if (!WebFileSystemAccess.isFileSystemFileHandle(fileHandle)) {
      return void 0;
    }
    return this.fileSystemProvider.registerFileHandle(fileHandle);
  }
  async showOpenDialog(options) {
    const schema = this.getFileSystemSchema(options);
    if (this.shouldUseSimplified(schema)) {
      return super.showOpenDialogSimplified(schema, options);
    }
    const activeWindow = getActiveWindow();
    if (!WebFileSystemAccess.supported(activeWindow)) {
      return this.showUnsupportedBrowserWarning("open");
    }
    let uri;
    const startIn = Iterable.first(this.fileSystemProvider.directories) ?? "documents";
    try {
      if (options.canSelectFiles) {
        const handle = await activeWindow.showOpenFilePicker({ multiple: false, types: this.getFilePickerTypes(options.filters), ...{ startIn } });
        if (handle.length === 1 && WebFileSystemAccess.isFileSystemFileHandle(handle[0])) {
          uri = await this.fileSystemProvider.registerFileHandle(handle[0]);
        }
      } else {
        const handle = await activeWindow.showDirectoryPicker({ ...{ startIn } });
        uri = await this.fileSystemProvider.registerDirectoryHandle(handle);
      }
    } catch (error) {
    }
    return uri ? [uri] : void 0;
  }
  async showUnsupportedBrowserWarning(context) {
    if (context === "save") {
      const activeCodeEditor = this.codeEditorService.getActiveCodeEditor();
      if (!(activeCodeEditor instanceof EmbeddedCodeEditorWidget)) {
        const activeTextModel = activeCodeEditor?.getModel();
        if (activeTextModel) {
          triggerDownload(VSBuffer.fromString(activeTextModel.getValue()).buffer, basename(activeTextModel.uri));
          return;
        }
      }
    }
    const buttons = [
      {
        label: localize({ key: "openRemote", comment: ["&& denotes a mnemonic"] }, "&&Open Remote..."),
        run: async () => {
          await this.commandService.executeCommand("workbench.action.remote.showMenu");
        }
      },
      {
        label: localize({ key: "learnMore", comment: ["&& denotes a mnemonic"] }, "&&Learn More"),
        run: async () => {
          await this.openerService.open("https://aka.ms/VSCodeWebLocalFileSystemAccess");
        }
      }
    ];
    if (context === "open") {
      buttons.push({
        label: localize({ key: "openFiles", comment: ["&& denotes a mnemonic"] }, "Open &&Files..."),
        run: async () => {
          const files = await triggerUpload();
          if (files) {
            const filesData = (await this.instantiationService.invokeFunction((accessor) => extractFileListData(accessor, files))).filter((fileData) => !fileData.isDirectory);
            if (filesData.length > 0) {
              this.editorService.openEditors(filesData.map((fileData) => {
                return {
                  resource: fileData.resource,
                  contents: fileData.contents?.toString(),
                  options: { pinned: true }
                };
              }));
            }
          }
        }
      });
    }
    await this.dialogService.prompt({
      type: Severity.Warning,
      message: localize("unsupportedBrowserMessage", "Opening Local Folders is Unsupported"),
      detail: localize("unsupportedBrowserDetail", "Your browser doesn't support opening local folders.\nYou can either open single files or open a remote repository."),
      buttons
    });
    return void 0;
  }
  shouldUseSimplified(scheme) {
    return ![Schemas.file, Schemas.vscodeUserData, Schemas.tmp].includes(scheme);
  }
}
__decorateClass([
  memoize
], FileDialogService.prototype, "fileSystemProvider", 1);
registerSingleton(IFileDialogService, FileDialogService, InstantiationType.Delayed);
export {
  FileDialogService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZGlhbG9ncy9icm93c2VyL2ZpbGVEaWFsb2dTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSVBpY2tBbmRPcGVuT3B0aW9ucywgSVNhdmVEaWFsb2dPcHRpb25zLCBJT3BlbkRpYWxvZ09wdGlvbnMsIElGaWxlRGlhbG9nU2VydmljZSwgRmlsZUZpbHRlciwgSVByb21wdEJ1dHRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RGaWxlRGlhbG9nU2VydmljZSB9IGZyb20gJy4vYWJzdHJhY3RGaWxlRGlhbG9nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBtZW1vaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZGVjb3JhdG9ycy5qcyc7XG5pbXBvcnQgeyBIVE1MRmlsZVN5c3RlbVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvYnJvd3Nlci9odG1sRmlsZVN5c3RlbVByb3ZpZGVyLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGdldE1lZGlhT3JUZXh0TWltZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21pbWUuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgZ2V0QWN0aXZlV2luZG93LCB0cmlnZ2VyRG93bmxvYWQsIHRyaWdnZXJVcGxvYWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCBTZXZlcml0eSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zZXZlcml0eS5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBleHRyYWN0RmlsZUxpc3REYXRhIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZG5kL2Jyb3dzZXIvZG5kLmpzJztcbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgV2ViRmlsZVN5c3RlbUFjY2VzcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2Jyb3dzZXIvd2ViRmlsZVN5c3RlbUFjY2Vzcy5qcyc7XG5pbXBvcnQgeyBFbWJlZGRlZENvZGVFZGl0b3JXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci93aWRnZXQvY29kZUVkaXRvci9lbWJlZGRlZENvZGVFZGl0b3JXaWRnZXQuanMnO1xuXG5leHBvcnQgY2xhc3MgRmlsZURpYWxvZ1NlcnZpY2UgZXh0ZW5kcyBBYnN0cmFjdEZpbGVEaWFsb2dTZXJ2aWNlIGltcGxlbWVudHMgSUZpbGVEaWFsb2dTZXJ2aWNlIHtcblxuXHRAbWVtb2l6ZVxuXHRwcml2YXRlIGdldCBmaWxlU3lzdGVtUHJvdmlkZXIoKTogSFRNTEZpbGVTeXN0ZW1Qcm92aWRlciB7XG5cdFx0cmV0dXJuIHRoaXMuZmlsZVNlcnZpY2UuZ2V0UHJvdmlkZXIoU2NoZW1hcy5maWxlKSBhcyBIVE1MRmlsZVN5c3RlbVByb3ZpZGVyO1xuXHR9XG5cblx0YXN5bmMgcGlja0ZpbGVGb2xkZXJBbmRPcGVuKG9wdGlvbnM6IElQaWNrQW5kT3Blbk9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBzY2hlbWEgPSB0aGlzLmdldEZpbGVTeXN0ZW1TY2hlbWEob3B0aW9ucyk7XG5cblx0XHRpZiAoIW9wdGlvbnMuZGVmYXVsdFVyaSkge1xuXHRcdFx0b3B0aW9ucy5kZWZhdWx0VXJpID0gYXdhaXQgdGhpcy5kZWZhdWx0RmlsZVBhdGgoc2NoZW1hKTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5zaG91bGRVc2VTaW1wbGlmaWVkKHNjaGVtYSkpIHtcblx0XHRcdHJldHVybiBzdXBlci5waWNrRmlsZUZvbGRlckFuZE9wZW5TaW1wbGlmaWVkKHNjaGVtYSwgb3B0aW9ucywgZmFsc2UpO1xuXHRcdH1cblxuXHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgncGlja0ZvbGRlckFuZE9wZW4nLCBcIkNhbid0IG9wZW4gZm9sZGVycywgdHJ5IGFkZGluZyBhIGZvbGRlciB0byB0aGUgd29ya3NwYWNlIGluc3RlYWQuXCIpKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBhZGRGaWxlU2NoZW1hSWZOZWVkZWQoc2NoZW1hOiBzdHJpbmcsIGlzRm9sZGVyOiBib29sZWFuKTogc3RyaW5nW10ge1xuXHRcdHJldHVybiAoc2NoZW1hID09PSBTY2hlbWFzLnVudGl0bGVkKSA/IFtTY2hlbWFzLmZpbGVdXG5cdFx0XHQ6ICgoKHNjaGVtYSAhPT0gU2NoZW1hcy5maWxlKSAmJiAoIWlzRm9sZGVyIHx8IChzY2hlbWEgIT09IFNjaGVtYXMudnNjb2RlUmVtb3RlKSkpID8gW3NjaGVtYSwgU2NoZW1hcy5maWxlXSA6IFtzY2hlbWFdKTtcblx0fVxuXG5cdGFzeW5jIHBpY2tGaWxlQW5kT3BlbihvcHRpb25zOiBJUGlja0FuZE9wZW5PcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgc2NoZW1hID0gdGhpcy5nZXRGaWxlU3lzdGVtU2NoZW1hKG9wdGlvbnMpO1xuXG5cdFx0aWYgKCFvcHRpb25zLmRlZmF1bHRVcmkpIHtcblx0XHRcdG9wdGlvbnMuZGVmYXVsdFVyaSA9IGF3YWl0IHRoaXMuZGVmYXVsdEZpbGVQYXRoKHNjaGVtYSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc2hvdWxkVXNlU2ltcGxpZmllZChzY2hlbWEpKSB7XG5cdFx0XHRyZXR1cm4gc3VwZXIucGlja0ZpbGVBbmRPcGVuU2ltcGxpZmllZChzY2hlbWEsIG9wdGlvbnMsIGZhbHNlKTtcblx0XHR9XG5cblx0XHRjb25zdCBhY3RpdmVXaW5kb3cgPSBnZXRBY3RpdmVXaW5kb3coKTtcblx0XHRpZiAoIVdlYkZpbGVTeXN0ZW1BY2Nlc3Muc3VwcG9ydGVkKGFjdGl2ZVdpbmRvdykpIHtcblx0XHRcdHJldHVybiB0aGlzLnNob3dVbnN1cHBvcnRlZEJyb3dzZXJXYXJuaW5nKCdvcGVuJyk7XG5cdFx0fVxuXG5cdFx0bGV0IGZpbGVIYW5kbGU6IEZpbGVTeXN0ZW1IYW5kbGUgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0dHJ5IHtcblx0XHRcdChbZmlsZUhhbmRsZV0gPSBhd2FpdCBhY3RpdmVXaW5kb3cuc2hvd09wZW5GaWxlUGlja2VyKHsgbXVsdGlwbGU6IGZhbHNlIH0pKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0cmV0dXJuOyAvLyBgc2hvd09wZW5GaWxlUGlja2VyYCB3aWxsIHRocm93IGFuIGVycm9yIHdoZW4gdGhlIHVzZXIgY2FuY2Vsc1xuXHRcdH1cblxuXHRcdGlmICghV2ViRmlsZVN5c3RlbUFjY2Vzcy5pc0ZpbGVTeXN0ZW1GaWxlSGFuZGxlKGZpbGVIYW5kbGUpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXJpID0gYXdhaXQgdGhpcy5maWxlU3lzdGVtUHJvdmlkZXIucmVnaXN0ZXJGaWxlSGFuZGxlKGZpbGVIYW5kbGUpO1xuXG5cdFx0dGhpcy5hZGRGaWxlVG9SZWNlbnRseU9wZW5lZCh1cmkpO1xuXG5cdFx0YXdhaXQgdGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4odXJpLCB7IGZyb21Vc2VyR2VzdHVyZTogdHJ1ZSwgZWRpdG9yT3B0aW9uczogeyBwaW5uZWQ6IHRydWUgfSB9KTtcblx0fVxuXG5cdGFzeW5jIHBpY2tGb2xkZXJBbmRPcGVuKG9wdGlvbnM6IElQaWNrQW5kT3Blbk9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBzY2hlbWEgPSB0aGlzLmdldEZpbGVTeXN0ZW1TY2hlbWEob3B0aW9ucyk7XG5cblx0XHRpZiAoIW9wdGlvbnMuZGVmYXVsdFVyaSkge1xuXHRcdFx0b3B0aW9ucy5kZWZhdWx0VXJpID0gYXdhaXQgdGhpcy5kZWZhdWx0Rm9sZGVyUGF0aChzY2hlbWEpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnNob3VsZFVzZVNpbXBsaWZpZWQoc2NoZW1hKSkge1xuXHRcdFx0cmV0dXJuIHN1cGVyLnBpY2tGb2xkZXJBbmRPcGVuU2ltcGxpZmllZChzY2hlbWEsIG9wdGlvbnMpO1xuXHRcdH1cblxuXHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgncGlja0ZvbGRlckFuZE9wZW4nLCBcIkNhbid0IG9wZW4gZm9sZGVycywgdHJ5IGFkZGluZyBhIGZvbGRlciB0byB0aGUgd29ya3NwYWNlIGluc3RlYWQuXCIpKTtcblx0fVxuXG5cdGFzeW5jIHBpY2tXb3Jrc3BhY2VBbmRPcGVuKG9wdGlvbnM6IElQaWNrQW5kT3Blbk9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRvcHRpb25zLmF2YWlsYWJsZUZpbGVTeXN0ZW1zID0gdGhpcy5nZXRXb3Jrc3BhY2VBdmFpbGFibGVGaWxlU3lzdGVtcyhvcHRpb25zKTtcblx0XHRjb25zdCBzY2hlbWEgPSB0aGlzLmdldEZpbGVTeXN0ZW1TY2hlbWEob3B0aW9ucyk7XG5cblx0XHRpZiAoIW9wdGlvbnMuZGVmYXVsdFVyaSkge1xuXHRcdFx0b3B0aW9ucy5kZWZhdWx0VXJpID0gYXdhaXQgdGhpcy5kZWZhdWx0V29ya3NwYWNlUGF0aChzY2hlbWEpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnNob3VsZFVzZVNpbXBsaWZpZWQoc2NoZW1hKSkge1xuXHRcdFx0cmV0dXJuIHN1cGVyLnBpY2tXb3Jrc3BhY2VBbmRPcGVuU2ltcGxpZmllZChzY2hlbWEsIG9wdGlvbnMpO1xuXHRcdH1cblxuXHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgncGlja1dvcmtzcGFjZUFuZE9wZW4nLCBcIkNhbid0IG9wZW4gd29ya3NwYWNlcywgdHJ5IGFkZGluZyBhIGZvbGRlciB0byB0aGUgd29ya3NwYWNlIGluc3RlYWQuXCIpKTtcblx0fVxuXG5cdGFzeW5jIHBpY2tGaWxlVG9TYXZlKGRlZmF1bHRVcmk6IFVSSSwgYXZhaWxhYmxlRmlsZVN5c3RlbXM/OiBzdHJpbmdbXSk6IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3Qgc2NoZW1hID0gdGhpcy5nZXRGaWxlU3lzdGVtU2NoZW1hKHsgZGVmYXVsdFVyaSwgYXZhaWxhYmxlRmlsZVN5c3RlbXMgfSk7XG5cblx0XHRjb25zdCBvcHRpb25zID0gdGhpcy5nZXRQaWNrRmlsZVRvU2F2ZURpYWxvZ09wdGlvbnMoZGVmYXVsdFVyaSwgYXZhaWxhYmxlRmlsZVN5c3RlbXMpO1xuXHRcdGlmICh0aGlzLnNob3VsZFVzZVNpbXBsaWZpZWQoc2NoZW1hKSkge1xuXHRcdFx0cmV0dXJuIHN1cGVyLnBpY2tGaWxlVG9TYXZlU2ltcGxpZmllZChzY2hlbWEsIG9wdGlvbnMpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGl2ZVdpbmRvdyA9IGdldEFjdGl2ZVdpbmRvdygpO1xuXHRcdGlmICghV2ViRmlsZVN5c3RlbUFjY2Vzcy5zdXBwb3J0ZWQoYWN0aXZlV2luZG93KSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuc2hvd1Vuc3VwcG9ydGVkQnJvd3Nlcldhcm5pbmcoJ3NhdmUnKTtcblx0XHR9XG5cblx0XHRsZXQgZmlsZUhhbmRsZTogRmlsZVN5c3RlbUhhbmRsZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRjb25zdCBzdGFydEluID0gSXRlcmFibGUuZmlyc3QodGhpcy5maWxlU3lzdGVtUHJvdmlkZXIuZGlyZWN0b3JpZXMpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGZpbGVIYW5kbGUgPSBhd2FpdCBhY3RpdmVXaW5kb3cuc2hvd1NhdmVGaWxlUGlja2VyKHsgdHlwZXM6IHRoaXMuZ2V0RmlsZVBpY2tlclR5cGVzKG9wdGlvbnMuZmlsdGVycyksIC4uLnsgc3VnZ2VzdGVkTmFtZTogYmFzZW5hbWUoZGVmYXVsdFVyaSksIHN0YXJ0SW4gfSB9KTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0cmV0dXJuOyAvLyBgc2hvd1NhdmVGaWxlUGlja2VyYCB3aWxsIHRocm93IGFuIGVycm9yIHdoZW4gdGhlIHVzZXIgY2FuY2Vsc1xuXHRcdH1cblxuXHRcdGlmICghV2ViRmlsZVN5c3RlbUFjY2Vzcy5pc0ZpbGVTeXN0ZW1GaWxlSGFuZGxlKGZpbGVIYW5kbGUpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmZpbGVTeXN0ZW1Qcm92aWRlci5yZWdpc3RlckZpbGVIYW5kbGUoZmlsZUhhbmRsZSk7XG5cdH1cblxuXHRwcml2YXRlIGdldEZpbGVQaWNrZXJUeXBlcyhmaWx0ZXJzPzogRmlsZUZpbHRlcltdKTogRmlsZVBpY2tlckFjY2VwdFR5cGVbXSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIGZpbHRlcnM/LmZpbHRlcihmaWx0ZXIgPT4ge1xuXHRcdFx0cmV0dXJuICEoKGZpbHRlci5leHRlbnNpb25zLmxlbmd0aCA9PT0gMSkgJiYgKChmaWx0ZXIuZXh0ZW5zaW9uc1swXSA9PT0gJyonKSB8fCBmaWx0ZXIuZXh0ZW5zaW9uc1swXSA9PT0gJycpKTtcblx0XHR9KS5tYXAoZmlsdGVyID0+IHtcblx0XHRcdGNvbnN0IGFjY2VwdDogUmVjb3JkPHN0cmluZywgc3RyaW5nW10+ID0ge307XG5cdFx0XHRjb25zdCBleHRlbnNpb25zID0gZmlsdGVyLmV4dGVuc2lvbnMuZmlsdGVyKGV4dCA9PiAoZXh0LmluZGV4T2YoJy0nKSA8IDApICYmIChleHQuaW5kZXhPZignKicpIDwgMCkgJiYgKGV4dC5pbmRleE9mKCdfJykgPCAwKSk7XG5cdFx0XHRhY2NlcHRbZ2V0TWVkaWFPclRleHRNaW1lKGBmaWxlTmFtZS4ke2ZpbHRlci5leHRlbnNpb25zWzBdfWApID8/ICd0ZXh0L3BsYWluJ10gPSBleHRlbnNpb25zLm1hcChleHQgPT4gZXh0LnN0YXJ0c1dpdGgoJy4nKSA/IGV4dCA6IGAuJHtleHR9YCk7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogZmlsdGVyLm5hbWUsXG5cdFx0XHRcdGFjY2VwdFxuXHRcdFx0fTtcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHNob3dTYXZlRGlhbG9nKG9wdGlvbnM6IElTYXZlRGlhbG9nT3B0aW9ucyk6IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3Qgc2NoZW1hID0gdGhpcy5nZXRGaWxlU3lzdGVtU2NoZW1hKG9wdGlvbnMpO1xuXG5cdFx0aWYgKHRoaXMuc2hvdWxkVXNlU2ltcGxpZmllZChzY2hlbWEpKSB7XG5cdFx0XHRyZXR1cm4gc3VwZXIuc2hvd1NhdmVEaWFsb2dTaW1wbGlmaWVkKHNjaGVtYSwgb3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWN0aXZlV2luZG93ID0gZ2V0QWN0aXZlV2luZG93KCk7XG5cdFx0aWYgKCFXZWJGaWxlU3lzdGVtQWNjZXNzLnN1cHBvcnRlZChhY3RpdmVXaW5kb3cpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5zaG93VW5zdXBwb3J0ZWRCcm93c2VyV2FybmluZygnc2F2ZScpO1xuXHRcdH1cblxuXHRcdGxldCBmaWxlSGFuZGxlOiBGaWxlU3lzdGVtSGFuZGxlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHN0YXJ0SW4gPSBJdGVyYWJsZS5maXJzdCh0aGlzLmZpbGVTeXN0ZW1Qcm92aWRlci5kaXJlY3Rvcmllcyk7XG5cblx0XHR0cnkge1xuXHRcdFx0ZmlsZUhhbmRsZSA9IGF3YWl0IGFjdGl2ZVdpbmRvdy5zaG93U2F2ZUZpbGVQaWNrZXIoeyB0eXBlczogdGhpcy5nZXRGaWxlUGlja2VyVHlwZXMob3B0aW9ucy5maWx0ZXJzKSwgLi4ub3B0aW9ucy5kZWZhdWx0VXJpID8geyBzdWdnZXN0ZWROYW1lOiBiYXNlbmFtZShvcHRpb25zLmRlZmF1bHRVcmkpIH0gOiB1bmRlZmluZWQsIC4uLnsgc3RhcnRJbiB9IH0pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkOyAvLyBgc2hvd1NhdmVGaWxlUGlja2VyYCB3aWxsIHRocm93IGFuIGVycm9yIHdoZW4gdGhlIHVzZXIgY2FuY2Vsc1xuXHRcdH1cblxuXHRcdGlmICghV2ViRmlsZVN5c3RlbUFjY2Vzcy5pc0ZpbGVTeXN0ZW1GaWxlSGFuZGxlKGZpbGVIYW5kbGUpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmZpbGVTeXN0ZW1Qcm92aWRlci5yZWdpc3RlckZpbGVIYW5kbGUoZmlsZUhhbmRsZSk7XG5cdH1cblxuXHRhc3luYyBzaG93T3BlbkRpYWxvZyhvcHRpb25zOiBJT3BlbkRpYWxvZ09wdGlvbnMpOiBQcm9taXNlPFVSSVtdIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3Qgc2NoZW1hID0gdGhpcy5nZXRGaWxlU3lzdGVtU2NoZW1hKG9wdGlvbnMpO1xuXG5cdFx0aWYgKHRoaXMuc2hvdWxkVXNlU2ltcGxpZmllZChzY2hlbWEpKSB7XG5cdFx0XHRyZXR1cm4gc3VwZXIuc2hvd09wZW5EaWFsb2dTaW1wbGlmaWVkKHNjaGVtYSwgb3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWN0aXZlV2luZG93ID0gZ2V0QWN0aXZlV2luZG93KCk7XG5cdFx0aWYgKCFXZWJGaWxlU3lzdGVtQWNjZXNzLnN1cHBvcnRlZChhY3RpdmVXaW5kb3cpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5zaG93VW5zdXBwb3J0ZWRCcm93c2VyV2FybmluZygnb3BlbicpO1xuXHRcdH1cblxuXHRcdGxldCB1cmk6IFVSSSB8IHVuZGVmaW5lZDtcblx0XHRjb25zdCBzdGFydEluID0gSXRlcmFibGUuZmlyc3QodGhpcy5maWxlU3lzdGVtUHJvdmlkZXIuZGlyZWN0b3JpZXMpID8/ICdkb2N1bWVudHMnO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGlmIChvcHRpb25zLmNhblNlbGVjdEZpbGVzKSB7XG5cdFx0XHRcdGNvbnN0IGhhbmRsZSA9IGF3YWl0IGFjdGl2ZVdpbmRvdy5zaG93T3BlbkZpbGVQaWNrZXIoeyBtdWx0aXBsZTogZmFsc2UsIHR5cGVzOiB0aGlzLmdldEZpbGVQaWNrZXJUeXBlcyhvcHRpb25zLmZpbHRlcnMpLCAuLi57IHN0YXJ0SW4gfSB9KTtcblx0XHRcdFx0aWYgKGhhbmRsZS5sZW5ndGggPT09IDEgJiYgV2ViRmlsZVN5c3RlbUFjY2Vzcy5pc0ZpbGVTeXN0ZW1GaWxlSGFuZGxlKGhhbmRsZVswXSkpIHtcblx0XHRcdFx0XHR1cmkgPSBhd2FpdCB0aGlzLmZpbGVTeXN0ZW1Qcm92aWRlci5yZWdpc3RlckZpbGVIYW5kbGUoaGFuZGxlWzBdKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgaGFuZGxlID0gYXdhaXQgYWN0aXZlV2luZG93LnNob3dEaXJlY3RvcnlQaWNrZXIoeyAuLi57IHN0YXJ0SW4gfSB9KTtcblx0XHRcdFx0dXJpID0gYXdhaXQgdGhpcy5maWxlU3lzdGVtUHJvdmlkZXIucmVnaXN0ZXJEaXJlY3RvcnlIYW5kbGUoaGFuZGxlKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0Ly8gaWdub3JlIC0gYHNob3dPcGVuRmlsZVBpY2tlcmAgLyBgc2hvd0RpcmVjdG9yeVBpY2tlcmAgd2lsbCB0aHJvdyBhbiBlcnJvciB3aGVuIHRoZSB1c2VyIGNhbmNlbHNcblx0XHR9XG5cblx0XHRyZXR1cm4gdXJpID8gW3VyaV0gOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHNob3dVbnN1cHBvcnRlZEJyb3dzZXJXYXJuaW5nKGNvbnRleHQ6ICdzYXZlJyB8ICdvcGVuJyk6IFByb21pc2U8dW5kZWZpbmVkPiB7XG5cblx0XHQvLyBXaGVuIHNhdmluZywgdHJ5IHRvIGp1c3QgZG93bmxvYWQgdGhlIGNvbnRlbnRzXG5cdFx0Ly8gb2YgdGhlIGFjdGl2ZSB0ZXh0IGVkaXRvciBpZiBhbnkgYXMgYSB3b3JrYXJvdW5kXG5cdFx0aWYgKGNvbnRleHQgPT09ICdzYXZlJykge1xuXHRcdFx0Y29uc3QgYWN0aXZlQ29kZUVkaXRvciA9IHRoaXMuY29kZUVkaXRvclNlcnZpY2UuZ2V0QWN0aXZlQ29kZUVkaXRvcigpO1xuXHRcdFx0aWYgKCEoYWN0aXZlQ29kZUVkaXRvciBpbnN0YW5jZW9mIEVtYmVkZGVkQ29kZUVkaXRvcldpZGdldCkpIHtcblx0XHRcdFx0Y29uc3QgYWN0aXZlVGV4dE1vZGVsID0gYWN0aXZlQ29kZUVkaXRvcj8uZ2V0TW9kZWwoKTtcblx0XHRcdFx0aWYgKGFjdGl2ZVRleHRNb2RlbCkge1xuXHRcdFx0XHRcdHRyaWdnZXJEb3dubG9hZChWU0J1ZmZlci5mcm9tU3RyaW5nKGFjdGl2ZVRleHRNb2RlbC5nZXRWYWx1ZSgpKS5idWZmZXIsIGJhc2VuYW1lKGFjdGl2ZVRleHRNb2RlbC51cmkpKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBPdGhlcndpc2UgaW5mb3JtIHRoZSB1c2VyIGFib3V0IG9wdGlvbnNcblxuXHRcdGNvbnN0IGJ1dHRvbnM6IElQcm9tcHRCdXR0b248dm9pZD5bXSA9IFtcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKHsga2V5OiAnb3BlblJlbW90ZScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJk9wZW4gUmVtb3RlLi4uXCIpLFxuXHRcdFx0XHRydW46IGFzeW5jICgpID0+IHsgYXdhaXQgdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnd29ya2JlbmNoLmFjdGlvbi5yZW1vdGUuc2hvd01lbnUnKTsgfVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKHsga2V5OiAnbGVhcm5Nb3JlJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmTGVhcm4gTW9yZVwiKSxcblx0XHRcdFx0cnVuOiBhc3luYyAoKSA9PiB7IGF3YWl0IHRoaXMub3BlbmVyU2VydmljZS5vcGVuKCdodHRwczovL2FrYS5tcy9WU0NvZGVXZWJMb2NhbEZpbGVTeXN0ZW1BY2Nlc3MnKTsgfVxuXHRcdFx0fVxuXHRcdF07XG5cdFx0aWYgKGNvbnRleHQgPT09ICdvcGVuJykge1xuXHRcdFx0YnV0dG9ucy5wdXNoKHtcblx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKHsga2V5OiAnb3BlbkZpbGVzJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIk9wZW4gJiZGaWxlcy4uLlwiKSxcblx0XHRcdFx0cnVuOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgZmlsZXMgPSBhd2FpdCB0cmlnZ2VyVXBsb2FkKCk7XG5cdFx0XHRcdFx0aWYgKGZpbGVzKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBmaWxlc0RhdGEgPSAoYXdhaXQgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBleHRyYWN0RmlsZUxpc3REYXRhKGFjY2Vzc29yLCBmaWxlcykpKS5maWx0ZXIoZmlsZURhdGEgPT4gIWZpbGVEYXRhLmlzRGlyZWN0b3J5KTtcblx0XHRcdFx0XHRcdGlmIChmaWxlc0RhdGEubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcnMoZmlsZXNEYXRhLm1hcChmaWxlRGF0YSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0XHRcdHJlc291cmNlOiBmaWxlRGF0YS5yZXNvdXJjZSxcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiBmaWxlRGF0YS5jb250ZW50cz8udG9TdHJpbmcoKSxcblx0XHRcdFx0XHRcdFx0XHRcdG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH1cblx0XHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UucHJvbXB0KHtcblx0XHRcdHR5cGU6IFNldmVyaXR5Lldhcm5pbmcsXG5cdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZSgndW5zdXBwb3J0ZWRCcm93c2VyTWVzc2FnZScsIFwiT3BlbmluZyBMb2NhbCBGb2xkZXJzIGlzIFVuc3VwcG9ydGVkXCIpLFxuXHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgndW5zdXBwb3J0ZWRCcm93c2VyRGV0YWlsJywgXCJZb3VyIGJyb3dzZXIgZG9lc24ndCBzdXBwb3J0IG9wZW5pbmcgbG9jYWwgZm9sZGVycy5cXG5Zb3UgY2FuIGVpdGhlciBvcGVuIHNpbmdsZSBmaWxlcyBvciBvcGVuIGEgcmVtb3RlIHJlcG9zaXRvcnkuXCIpLFxuXHRcdFx0YnV0dG9uc1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgc2hvdWxkVXNlU2ltcGxpZmllZChzY2hlbWU6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhW1NjaGVtYXMuZmlsZSwgU2NoZW1hcy52c2NvZGVVc2VyRGF0YSwgU2NoZW1hcy50bXBdLmluY2x1ZGVzKHNjaGVtZSk7XG5cdH1cbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSUZpbGVEaWFsb2dTZXJ2aWNlLCBGaWxlRGlhbG9nU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7O0FBS0EsU0FBc0UsMEJBQXFEO0FBRTNILFNBQVMsbUJBQW1CLHlCQUF5QjtBQUNyRCxTQUFTLGlDQUFpQztBQUMxQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxlQUFlO0FBRXhCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsaUJBQWlCLGlCQUFpQixxQkFBcUI7QUFDaEUsT0FBTyxjQUFjO0FBQ3JCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsZ0NBQWdDO0FBRWxDLE1BQU0sMEJBQTBCLDBCQUF3RDtBQUFBLEVBRzlGLElBQVkscUJBQTZDO0FBQ3hELFdBQU8sS0FBSyxZQUFZLFlBQVksUUFBUSxJQUFJO0FBQUEsRUFDakQ7QUFBQSxFQUVBLE1BQU0sc0JBQXNCLFNBQTZDO0FBQ3hFLFVBQU0sU0FBUyxLQUFLLG9CQUFvQixPQUFPO0FBRS9DLFFBQUksQ0FBQyxR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
