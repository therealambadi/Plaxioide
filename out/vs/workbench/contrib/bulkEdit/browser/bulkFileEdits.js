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
import { IFileService, FileSystemProviderCapabilities } from "../../../../platform/files/common/files.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IWorkingCopyFileService } from "../../../services/workingCopy/common/workingCopyFileService.js";
import { UndoRedoElementType, IUndoRedoService } from "../../../../platform/undoRedo/common/undoRedo.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { Schemas } from "../../../../base/common/network.js";
class Noop {
  constructor() {
    this.uris = [];
  }
  async perform() {
    return this;
  }
  toString() {
    return "(noop)";
  }
}
class RenameEdit {
  constructor(newUri, oldUri, options) {
    this.newUri = newUri;
    this.oldUri = oldUri;
    this.options = options;
    this.type = "rename";
  }
}
let RenameOperation = class {
  constructor(_edits, _undoRedoInfo, _workingCopyFileService, _fileService) {
    this._edits = _edits;
    this._undoRedoInfo = _undoRedoInfo;
    this._workingCopyFileService = _workingCopyFileService;
    this._fileService = _fileService;
  }
  get uris() {
    return this._edits.flatMap((edit) => [edit.newUri, edit.oldUri]);
  }
  async perform(token) {
    const moves = [];
    const undoes = [];
    for (const edit of this._edits) {
      const skip = edit.options.overwrite === void 0 && edit.options.ignoreIfExists && await this._fileService.exists(edit.newUri);
      if (!skip) {
        moves.push({
          file: { source: edit.oldUri, target: edit.newUri },
          overwrite: edit.options.overwrite
        });
        undoes.push(new RenameEdit(edit.oldUri, edit.newUri, edit.options));
      }
    }
    if (moves.length === 0) {
      return new Noop();
    }
    await this._workingCopyFileService.move(moves, token, this._undoRedoInfo);
    return new RenameOperation(undoes, { isUndoing: true }, this._workingCopyFileService, this._fileService);
  }
  toString() {
    return `(rename ${this._edits.map((edit) => `${edit.oldUri} to ${edit.newUri}`).join(", ")})`;
  }
};
RenameOperation = __decorateClass([
  __decorateParam(2, IWorkingCopyFileService),
  __decorateParam(3, IFileService)
], RenameOperation);
class CopyEdit {
  constructor(newUri, oldUri, options) {
    this.newUri = newUri;
    this.oldUri = oldUri;
    this.options = options;
    this.type = "copy";
  }
}
let CopyOperation = class {
  constructor(_edits, _undoRedoInfo, _workingCopyFileService, _fileService, _instaService) {
    this._edits = _edits;
    this._undoRedoInfo = _undoRedoInfo;
    this._workingCopyFileService = _workingCopyFileService;
    this._fileService = _fileService;
    this._instaService = _instaService;
  }
  get uris() {
    return this._edits.flatMap((edit) => [edit.newUri, edit.oldUri]);
  }
  async perform(token) {
    const copies = [];
    for (const edit of this._edits) {
      const skip = edit.options.overwrite === void 0 && edit.options.ignoreIfExists && await this._fileService.exists(edit.newUri);
      if (!skip) {
        copies.push({ file: { source: edit.oldUri, target: edit.newUri }, overwrite: edit.options.overwrite });
      }
    }
    if (copies.length === 0) {
      return new Noop();
    }
    const stats = await this._workingCopyFileService.copy(copies, token, this._undoRedoInfo);
    const undoes = [];
    for (let i = 0; i < stats.length; i++) {
      const stat = stats[i];
      const edit = this._edits[i];
      undoes.push(new DeleteEdit(stat.resource, { recursive: true, folder: this._edits[i].options.folder || stat.isDirectory, ...edit.options }, false));
    }
    return this._instaService.createInstance(DeleteOperation, undoes, { isUndoing: true });
  }
  toString() {
    return `(copy ${this._edits.map((edit) => `${edit.oldUri} to ${edit.newUri}`).join(", ")})`;
  }
};
CopyOperation = __decorateClass([
  __decorateParam(2, IWorkingCopyFileService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IInstantiationService)
], CopyOperation);
class CreateEdit {
  constructor(newUri, options, contents) {
    this.newUri = newUri;
    this.options = options;
    this.contents = contents;
    this.type = "create";
  }
}
let CreateOperation = class {
  constructor(_edits, _undoRedoInfo, _fileService, _workingCopyFileService, _instaService, _textFileService) {
    this._edits = _edits;
    this._undoRedoInfo = _undoRedoInfo;
    this._fileService = _fileService;
    this._workingCopyFileService = _workingCopyFileService;
    this._instaService = _instaService;
    this._textFileService = _textFileService;
  }
  get uris() {
    return this._edits.map((edit) => edit.newUri);
  }
  async perform(token) {
    const folderCreates = [];
    const fileCreates = [];
    const undoes = [];
    for (const edit of this._edits) {
      if (edit.newUri.scheme === Schemas.untitled) {
        continue;
      }
      if (edit.options.overwrite === void 0 && edit.options.ignoreIfExists && await this._fileService.exists(edit.newUri)) {
        continue;
      }
      if (edit.options.folder) {
        folderCreates.push({ resource: edit.newUri });
      } else {
        const encodedReadable = typeof edit.contents !== "undefined" ? edit.contents : await this._textFileService.getEncodedReadable(edit.newUri);
        fileCreates.push({ resource: edit.newUri, contents: encodedReadable, overwrite: edit.options.overwrite });
      }
      undoes.push(new DeleteEdit(edit.newUri, edit.options, !edit.options.folder && !edit.contents));
    }
    if (folderCreates.length === 0 && fileCreates.length === 0) {
      return new Noop();
    }
    await this._workingCopyFileService.createFolder(folderCreates, token, this._undoRedoInfo);
    await this._workingCopyFileService.create(fileCreates, token, this._undoRedoInfo);
    return this._instaService.createInstance(DeleteOperation, undoes, { isUndoing: true });
  }
  toString() {
    return `(create ${this._edits.map((edit) => edit.options.folder ? `folder ${edit.newUri}` : `file ${edit.newUri} with ${edit.contents?.byteLength || 0} bytes`).join(", ")})`;
  }
};
CreateOperation = __decorateClass([
  __decorateParam(2, IFileService),
  __decorateParam(3, IWorkingCopyFileService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, ITextFileService)
], CreateOperation);
class DeleteEdit {
  constructor(oldUri, options, undoesCreate) {
    this.oldUri = oldUri;
    this.options = options;
    this.undoesCreate = undoesCreate;
    this.type = "delete";
  }
}
let DeleteOperation = class {
  constructor(_edits, _undoRedoInfo, _workingCopyFileService, _fileService, _configurationService, _instaService, _logService) {
    this._edits = _edits;
    this._undoRedoInfo = _undoRedoInfo;
    this._workingCopyFileService = _workingCopyFileService;
    this._fileService = _fileService;
    this._configurationService = _configurationService;
    this._instaService = _instaService;
    this._logService = _logService;
  }
  get uris() {
    return this._edits.map((edit) => edit.oldUri);
  }
  async perform(token) {
    const deletes = [];
    const undoes = [];
    for (const edit of this._edits) {
      let fileStat;
      try {
        fileStat = await this._fileService.resolve(edit.oldUri, { resolveMetadata: true });
      } catch (err) {
        if (!edit.options.ignoreIfNotExists) {
          throw new Error(`${edit.oldUri} does not exist and can not be deleted`);
        }
        continue;
      }
      deletes.push({
        resource: edit.oldUri,
        recursive: edit.options.recursive,
        useTrash: !edit.options.skipTrashBin && this._fileService.hasCapability(edit.oldUri, FileSystemProviderCapabilities.Trash) && this._configurationService.getValue("files.enableTrash")
      });
      let fileContent;
      let fileContentExceedsMaxSize = false;
      if (!edit.undoesCreate && !edit.options.folder) {
        fileContentExceedsMaxSize = typeof edit.options.maxSize === "number" && fileStat.size > edit.options.maxSize;
        if (!fileContentExceedsMaxSize) {
          try {
            fileContent = await this._fileService.readFile(edit.oldUri);
          } catch (err) {
            this._logService.error(err);
          }
        }
      }
      if (!fileContentExceedsMaxSize) {
        undoes.push(new CreateEdit(edit.oldUri, edit.options, fileContent?.value));
      }
    }
    if (deletes.length === 0) {
      return new Noop();
    }
    await this._workingCopyFileService.delete(deletes, token, this._undoRedoInfo);
    if (undoes.length === 0) {
      return new Noop();
    }
    return this._instaService.createInstance(CreateOperation, undoes, { isUndoing: true });
  }
  toString() {
    return `(delete ${this._edits.map((edit) => edit.oldUri).join(", ")})`;
  }
};
DeleteOperation = __decorateClass([
  __decorateParam(2, IWorkingCopyFileService),
  __decorateParam(3, IFileService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, ILogService)
], DeleteOperation);
class FileUndoRedoElement {
  constructor(label, code, operations, confirmBeforeUndo) {
    this.label = label;
    this.code = code;
    this.operations = operations;
    this.confirmBeforeUndo = confirmBeforeUndo;
    this.type = UndoRedoElementType.Workspace;
    this.resources = operations.flatMap((op) => op.uris);
  }
  async undo() {
    await this._reverse();
  }
  async redo() {
    await this._reverse();
  }
  async _reverse() {
    for (let i = 0; i < this.operations.length; i++) {
      const op = this.operations[i];
      const undo = await op.perform(CancellationToken.None);
      this.operations[i] = undo;
    }
  }
  toString() {
    return this.operations.map((op) => String(op)).join(", ");
  }
}
let BulkFileEdits = class {
  constructor(_label, _code, _undoRedoGroup, _undoRedoSource, _confirmBeforeUndo, _progress, _token, _edits, _instaService, _undoRedoService) {
    this._label = _label;
    this._code = _code;
    this._undoRedoGroup = _undoRedoGroup;
    this._undoRedoSource = _undoRedoSource;
    this._confirmBeforeUndo = _confirmBeforeUndo;
    this._progress = _progress;
    this._token = _token;
    this._edits = _edits;
    this._instaService = _instaService;
    this._undoRedoService = _undoRedoService;
  }
  async apply() {
    const undoOperations = [];
    const undoRedoInfo = { undoRedoGroupId: this._undoRedoGroup.id };
    const edits = [];
    for (const edit of this._edits) {
      if (edit.newResource && edit.oldResource && !edit.options?.copy) {
        edits.push(new RenameEdit(edit.newResource, edit.oldResource, edit.options ?? {}));
      } else if (edit.newResource && edit.oldResource && edit.options?.copy) {
        edits.push(new CopyEdit(edit.newResource, edit.oldResource, edit.options ?? {}));
      } else if (!edit.newResource && edit.oldResource) {
        edits.push(new DeleteEdit(edit.oldResource, edit.options ?? {}, false));
      } else if (edit.newResource && !edit.oldResource) {
        edits.push(new CreateEdit(edit.newResource, edit.options ?? {}, await edit.options.contents));
      }
    }
    if (edits.length === 0) {
      return [];
    }
    const groups = [];
    groups[0] = [edits[0]];
    for (let i = 1; i < edits.length; i++) {
      const edit = edits[i];
      const lastGroup = groups.at(-1);
      if (lastGroup?.[0].type === edit.type) {
        lastGroup.push(edit);
      } else {
        groups.push([edit]);
      }
    }
    for (const group of groups) {
      if (this._token.isCancellationRequested) {
        break;
      }
      let op;
      switch (group[0].type) {
        case "rename":
          op = this._instaService.createInstance(RenameOperation, group, undoRedoInfo);
          break;
        case "copy":
          op = this._instaService.createInstance(CopyOperation, group, undoRedoInfo);
          break;
        case "delete":
          op = this._instaService.createInstance(DeleteOperation, group, undoRedoInfo);
          break;
        case "create":
          op = this._instaService.createInstance(CreateOperation, group, undoRedoInfo);
          break;
      }
      if (op) {
        const undoOp = await op.perform(this._token);
        undoOperations.push(undoOp);
      }
      this._progress.report(void 0);
    }
    const undoRedoElement = new FileUndoRedoElement(this._label, this._code, undoOperations, this._confirmBeforeUndo);
    this._undoRedoService.pushElement(undoRedoElement, this._undoRedoGroup, this._undoRedoSource);
    return undoRedoElement.resources;
  }
};
BulkFileEdits = __decorateClass([
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, IUndoRedoService)
], BulkFileEdits);
export {
  BulkFileEdits
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9idWxrRWRpdC9icm93c2VyL2J1bGtGaWxlRWRpdHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cbmltcG9ydCB7IFdvcmtzcGFjZUZpbGVFZGl0T3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSwgRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLCBJRmlsZUNvbnRlbnQsIElGaWxlU3RhdFdpdGhNZXRhZGF0YSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJUHJvZ3Jlc3MgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHlGaWxlU2VydmljZSwgSUZpbGVPcGVyYXRpb25VbmRvUmVkb0luZm8sIElNb3ZlT3BlcmF0aW9uLCBJQ29weU9wZXJhdGlvbiwgSURlbGV0ZU9wZXJhdGlvbiwgSUNyZWF0ZU9wZXJhdGlvbiwgSUNyZWF0ZUZpbGVPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHlGaWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlVW5kb1JlZG9FbGVtZW50LCBVbmRvUmVkb0VsZW1lbnRUeXBlLCBJVW5kb1JlZG9TZXJ2aWNlLCBVbmRvUmVkb0dyb3VwLCBVbmRvUmVkb1NvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuZG9SZWRvL2NvbW1vbi91bmRvUmVkby5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IFJlc291cmNlRmlsZUVkaXQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9idWxrRWRpdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSVRleHRGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3RleHRmaWxlL2NvbW1vbi90ZXh0ZmlsZXMuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuXG5pbnRlcmZhY2UgSUZpbGVPcGVyYXRpb24ge1xuXHR1cmlzOiBVUklbXTtcblx0cGVyZm9ybSh0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElGaWxlT3BlcmF0aW9uPjtcbn1cblxuY2xhc3MgTm9vcCBpbXBsZW1lbnRzIElGaWxlT3BlcmF0aW9uIHtcblx0cmVhZG9ubHkgdXJpcyA9IFtdO1xuXHRhc3luYyBwZXJmb3JtKCkgeyByZXR1cm4gdGhpczsgfVxuXHR0b1N0cmluZygpOiBzdHJpbmcge1xuXHRcdHJldHVybiAnKG5vb3ApJztcblx0fVxufVxuXG5jbGFzcyBSZW5hbWVFZGl0IHtcblx0cmVhZG9ubHkgdHlwZSA9ICdyZW5hbWUnO1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBuZXdVcmk6IFVSSSxcblx0XHRyZWFkb25seSBvbGRVcmk6IFVSSSxcblx0XHRyZWFkb25seSBvcHRpb25zOiBXb3Jrc3BhY2VGaWxlRWRpdE9wdGlvbnNcblx0KSB7IH1cbn1cblxuY2xhc3MgUmVuYW1lT3BlcmF0aW9uIGltcGxlbWVudHMgSUZpbGVPcGVyYXRpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRzOiBSZW5hbWVFZGl0W10sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdW5kb1JlZG9JbmZvOiBJRmlsZU9wZXJhdGlvblVuZG9SZWRvSW5mbyxcblx0XHRASVdvcmtpbmdDb3B5RmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfd29ya2luZ0NvcHlGaWxlU2VydmljZTogSVdvcmtpbmdDb3B5RmlsZVNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9maWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdGdldCB1cmlzKCkge1xuXHRcdHJldHVybiB0aGlzLl9lZGl0cy5mbGF0TWFwKGVkaXQgPT4gW2VkaXQubmV3VXJpLCBlZGl0Lm9sZFVyaV0pO1xuXHR9XG5cblx0YXN5bmMgcGVyZm9ybSh0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElGaWxlT3BlcmF0aW9uPiB7XG5cblx0XHRjb25zdCBtb3ZlczogSU1vdmVPcGVyYXRpb25bXSA9IFtdO1xuXHRcdGNvbnN0IHVuZG9lczogUmVuYW1lRWRpdFtdID0gW107XG5cdFx0Zm9yIChjb25zdCBlZGl0IG9mIHRoaXMuX2VkaXRzKSB7XG5cdFx0XHQvLyBjaGVjazogbm90IG92ZXJ3cml0aW5nLCBidXQgaWdub3JpbmcsIGFuZCB0aGUgdGFyZ2V0IGZpbGUgZXhpc3RzXG5cdFx0XHRjb25zdCBza2lwID0gZWRpdC5vcHRpb25zLm92ZXJ3cml0ZSA9PT0gdW5kZWZpbmVkICYmIGVkaXQub3B0aW9ucy5pZ25vcmVJZkV4aXN0cyAmJiBhd2FpdCB0aGlzLl9maWxlU2VydmljZS5leGlzdHMoZWRpdC5uZXdVcmkpO1xuXHRcdFx0aWYgKCFza2lwKSB7XG5cdFx0XHRcdG1vdmVzLnB1c2goe1xuXHRcdFx0XHRcdGZpbGU6IHsgc291cmNlOiBlZGl0Lm9sZFVyaSwgdGFyZ2V0OiBlZGl0Lm5ld1VyaSB9LFxuXHRcdFx0XHRcdG92ZXJ3cml0ZTogZWRpdC5vcHRpb25zLm92ZXJ3cml0ZVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHQvLyByZXZlcnNlIGVkaXRcblx0XHRcdFx0dW5kb2VzLnB1c2gobmV3IFJlbmFtZUVkaXQoZWRpdC5vbGRVcmksIGVkaXQubmV3VXJpLCBlZGl0Lm9wdGlvbnMpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAobW92ZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gbmV3IE5vb3AoKTtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLl93b3JraW5nQ29weUZpbGVTZXJ2aWNlLm1vdmUobW92ZXMsIHRva2VuLCB0aGlzLl91bmRvUmVkb0luZm8pO1xuXHRcdHJldHVybiBuZXcgUmVuYW1lT3BlcmF0aW9uKHVuZG9lcywgeyBpc1VuZG9pbmc6IHRydWUgfSwgdGhpcy5fd29ya2luZ0NvcHlGaWxlU2VydmljZSwgdGhpcy5fZmlsZVNlcnZpY2UpO1xuXHR9XG5cblx0dG9TdHJpbmcoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYChyZW5hbWUgJHt0aGlzLl9lZGl0cy5tYXAoZWRpdCA9PiBgJHtlZGl0Lm9sZFVyaX0gdG8gJHtlZGl0Lm5ld1VyaX1gKS5qb2luKCcsICcpfSlgO1xuXHR9XG59XG5cbmNsYXNzIENvcHlFZGl0IHtcblx0cmVhZG9ubHkgdHlwZSA9ICdjb3B5Jztcblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgbmV3VXJpOiBVUkksXG5cdFx0cmVhZG9ubHkgb2xkVXJpOiBVUkksXG5cdFx0cmVhZG9ubHkgb3B0aW9uczogV29ya3NwYWNlRmlsZUVkaXRPcHRpb25zXG5cdCkgeyB9XG59XG5cbmNsYXNzIENvcHlPcGVyYXRpb24gaW1wbGVtZW50cyBJRmlsZU9wZXJhdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdHM6IENvcHlFZGl0W10sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdW5kb1JlZG9JbmZvOiBJRmlsZU9wZXJhdGlvblVuZG9SZWRvSW5mbyxcblx0XHRASVdvcmtpbmdDb3B5RmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfd29ya2luZ0NvcHlGaWxlU2VydmljZTogSVdvcmtpbmdDb3B5RmlsZVNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9maWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFTZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7IH1cblxuXHRnZXQgdXJpcygpIHtcblx0XHRyZXR1cm4gdGhpcy5fZWRpdHMuZmxhdE1hcChlZGl0ID0+IFtlZGl0Lm5ld1VyaSwgZWRpdC5vbGRVcmldKTtcblx0fVxuXG5cdGFzeW5jIHBlcmZvcm0odG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJRmlsZU9wZXJhdGlvbj4ge1xuXG5cdFx0Ly8gKDEpIGNyZWF0ZSBjb3B5IG9wZXJhdGlvbnMsIHJlbW92ZSBub29wc1xuXHRcdGNvbnN0IGNvcGllczogSUNvcHlPcGVyYXRpb25bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZWRpdCBvZiB0aGlzLl9lZGl0cykge1xuXHRcdFx0Ly9jaGVjazogbm90IG92ZXJ3cml0aW5nLCBidXQgaWdub3JpbmcsIGFuZCB0aGUgdGFyZ2V0IGZpbGUgZXhpc3RzXG5cdFx0XHRjb25zdCBza2lwID0gZWRpdC5vcHRpb25zLm92ZXJ3cml0ZSA9PT0gdW5kZWZpbmVkICYmIGVkaXQub3B0aW9ucy5pZ25vcmVJZkV4aXN0cyAmJiBhd2FpdCB0aGlzLl9maWxlU2VydmljZS5leGlzdHMoZWRpdC5uZXdVcmkpO1xuXHRcdFx0aWYgKCFza2lwKSB7XG5cdFx0XHRcdGNvcGllcy5wdXNoKHsgZmlsZTogeyBzb3VyY2U6IGVkaXQub2xkVXJpLCB0YXJnZXQ6IGVkaXQubmV3VXJpIH0sIG92ZXJ3cml0ZTogZWRpdC5vcHRpb25zLm92ZXJ3cml0ZSB9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoY29waWVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIG5ldyBOb29wKCk7XG5cdFx0fVxuXG5cdFx0Ly8gKDIpIHBlcmZvcm0gdGhlIGFjdHVhbCBjb3B5IGFuZCB1c2UgdGhlIHJldHVybiBzdGF0cyB0byBidWlsZCB1bmRvIGVkaXRzXG5cdFx0Y29uc3Qgc3RhdHMgPSBhd2FpdCB0aGlzLl93b3JraW5nQ29weUZpbGVTZXJ2aWNlLmNvcHkoY29waWVzLCB0b2tlbiwgdGhpcy5fdW5kb1JlZG9JbmZvKTtcblx0XHRjb25zdCB1bmRvZXM6IERlbGV0ZUVkaXRbXSA9IFtdO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzdGF0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3Qgc3RhdCA9IHN0YXRzW2ldO1xuXHRcdFx0Y29uc3QgZWRpdCA9IHRoaXMuX2VkaXRzW2ldO1xuXHRcdFx0dW5kb2VzLnB1c2gobmV3IERlbGV0ZUVkaXQoc3RhdC5yZXNvdXJjZSwgeyByZWN1cnNpdmU6IHRydWUsIGZvbGRlcjogdGhpcy5fZWRpdHNbaV0ub3B0aW9ucy5mb2xkZXIgfHwgc3RhdC5pc0RpcmVjdG9yeSwgLi4uZWRpdC5vcHRpb25zIH0sIGZhbHNlKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX2luc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShEZWxldGVPcGVyYXRpb24sIHVuZG9lcywgeyBpc1VuZG9pbmc6IHRydWUgfSk7XG5cdH1cblxuXHR0b1N0cmluZygpOiBzdHJpbmcge1xuXHRcdHJldHVybiBgKGNvcHkgJHt0aGlzLl9lZGl0cy5tYXAoZWRpdCA9PiBgJHtlZGl0Lm9sZFVyaX0gdG8gJHtlZGl0Lm5ld1VyaX1gKS5qb2luKCcsICcpfSlgO1xuXHR9XG59XG5cbmNsYXNzIENyZWF0ZUVkaXQge1xuXHRyZWFkb25seSB0eXBlID0gJ2NyZWF0ZSc7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IG5ld1VyaTogVVJJLFxuXHRcdHJlYWRvbmx5IG9wdGlvbnM6IFdvcmtzcGFjZUZpbGVFZGl0T3B0aW9ucyxcblx0XHRyZWFkb25seSBjb250ZW50czogVlNCdWZmZXIgfCB1bmRlZmluZWQsXG5cdCkgeyB9XG59XG5cbmNsYXNzIENyZWF0ZU9wZXJhdGlvbiBpbXBsZW1lbnRzIElGaWxlT3BlcmF0aW9uIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0czogQ3JlYXRlRWRpdFtdLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3VuZG9SZWRvSW5mbzogSUZpbGVPcGVyYXRpb25VbmRvUmVkb0luZm8sXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9maWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJV29ya2luZ0NvcHlGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF93b3JraW5nQ29weUZpbGVTZXJ2aWNlOiBJV29ya2luZ0NvcHlGaWxlU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGV4dEZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RleHRGaWxlU2VydmljZTogSVRleHRGaWxlU2VydmljZVxuXHQpIHsgfVxuXG5cdGdldCB1cmlzKCkge1xuXHRcdHJldHVybiB0aGlzLl9lZGl0cy5tYXAoZWRpdCA9PiBlZGl0Lm5ld1VyaSk7XG5cdH1cblxuXHRhc3luYyBwZXJmb3JtKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUZpbGVPcGVyYXRpb24+IHtcblxuXHRcdGNvbnN0IGZvbGRlckNyZWF0ZXM6IElDcmVhdGVPcGVyYXRpb25bXSA9IFtdO1xuXHRcdGNvbnN0IGZpbGVDcmVhdGVzOiBJQ3JlYXRlRmlsZU9wZXJhdGlvbltdID0gW107XG5cdFx0Y29uc3QgdW5kb2VzOiBEZWxldGVFZGl0W10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgZWRpdCBvZiB0aGlzLl9lZGl0cykge1xuXHRcdFx0aWYgKGVkaXQubmV3VXJpLnNjaGVtZSA9PT0gU2NoZW1hcy51bnRpdGxlZCkge1xuXHRcdFx0XHRjb250aW51ZTsgLy8gaWdub3JlLCB3aWxsIGJlIGhhbmRsZWQgYnkgYSBsYXRlciBlZGl0XG5cdFx0XHR9XG5cdFx0XHRpZiAoZWRpdC5vcHRpb25zLm92ZXJ3cml0ZSA9PT0gdW5kZWZpbmVkICYmIGVkaXQub3B0aW9ucy5pZ25vcmVJZkV4aXN0cyAmJiBhd2FpdCB0aGlzLl9maWxlU2VydmljZS5leGlzdHMoZWRpdC5uZXdVcmkpKSB7XG5cdFx0XHRcdGNvbnRpbnVlOyAvLyBub3Qgb3ZlcndyaXRpbmcsIGJ1dCBpZ25vcmluZywgYW5kIHRoZSB0YXJnZXQgZmlsZSBleGlzdHNcblx0XHRcdH1cblx0XHRcdGlmIChlZGl0Lm9wdGlvbnMuZm9sZGVyKSB7XG5cdFx0XHRcdGZvbGRlckNyZWF0ZXMucHVzaCh7IHJlc291cmNlOiBlZGl0Lm5ld1VyaSB9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIElmIHRoZSBjb250ZW50cyBhcmUgcGFydCBvZiB0aGUgZWRpdCB0aGV5IGluY2x1ZGUgdGhlIGVuY29kaW5nLCB0aHVzIHVzZSB0aGVtLiBPdGhlcndpc2UgZ2V0IHRoZSBlbmNvZGluZyBmb3IgYSBuZXcgZW1wdHkgZmlsZS5cblx0XHRcdFx0Y29uc3QgZW5jb2RlZFJlYWRhYmxlID0gdHlwZW9mIGVkaXQuY29udGVudHMgIT09ICd1bmRlZmluZWQnID8gZWRpdC5jb250ZW50cyA6IGF3YWl0IHRoaXMuX3RleHRGaWxlU2VydmljZS5nZXRFbmNvZGVkUmVhZGFibGUoZWRpdC5uZXdVcmkpO1xuXHRcdFx0XHRmaWxlQ3JlYXRlcy5wdXNoKHsgcmVzb3VyY2U6IGVkaXQubmV3VXJpLCBjb250ZW50czogZW5jb2RlZFJlYWRhYmxlLCBvdmVyd3JpdGU6IGVkaXQub3B0aW9ucy5vdmVyd3JpdGUgfSk7XG5cdFx0XHR9XG5cdFx0XHR1bmRvZXMucHVzaChuZXcgRGVsZXRlRWRpdChlZGl0Lm5ld1VyaSwgZWRpdC5vcHRpb25zLCAhZWRpdC5vcHRpb25zLmZvbGRlciAmJiAhZWRpdC5jb250ZW50cykpO1xuXHRcdH1cblxuXHRcdGlmIChmb2xkZXJDcmVhdGVzLmxlbmd0aCA9PT0gMCAmJiBmaWxlQ3JlYXRlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiBuZXcgTm9vcCgpO1xuXHRcdH1cblxuXHRcdGF3YWl0IHRoaXMuX3dvcmtpbmdDb3B5RmlsZVNlcnZpY2UuY3JlYXRlRm9sZGVyKGZvbGRlckNyZWF0ZXMsIHRva2VuLCB0aGlzLl91bmRvUmVkb0luZm8pO1xuXHRcdGF3YWl0IHRoaXMuX3dvcmtpbmdDb3B5RmlsZVNlcnZpY2UuY3JlYXRlKGZpbGVDcmVhdGVzLCB0b2tlbiwgdGhpcy5fdW5kb1JlZG9JbmZvKTtcblxuXHRcdHJldHVybiB0aGlzLl9pbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRGVsZXRlT3BlcmF0aW9uLCB1bmRvZXMsIHsgaXNVbmRvaW5nOiB0cnVlIH0pO1xuXHR9XG5cblx0dG9TdHJpbmcoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYChjcmVhdGUgJHt0aGlzLl9lZGl0cy5tYXAoZWRpdCA9PiBlZGl0Lm9wdGlvbnMuZm9sZGVyID8gYGZvbGRlciAke2VkaXQubmV3VXJpfWAgOiBgZmlsZSAke2VkaXQubmV3VXJpfSB3aXRoICR7ZWRpdC5jb250ZW50cz8uYnl0ZUxlbmd0aCB8fCAwfSBieXRlc2ApLmpvaW4oJywgJyl9KWA7XG5cdH1cbn1cblxuY2xhc3MgRGVsZXRlRWRpdCB7XG5cdHJlYWRvbmx5IHR5cGUgPSAnZGVsZXRlJztcblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgb2xkVXJpOiBVUkksXG5cdFx0cmVhZG9ubHkgb3B0aW9uczogV29ya3NwYWNlRmlsZUVkaXRPcHRpb25zLFxuXHRcdHJlYWRvbmx5IHVuZG9lc0NyZWF0ZTogYm9vbGVhbixcblx0KSB7IH1cbn1cblxuY2xhc3MgRGVsZXRlT3BlcmF0aW9uIGltcGxlbWVudHMgSUZpbGVPcGVyYXRpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgX2VkaXRzOiBEZWxldGVFZGl0W10sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdW5kb1JlZG9JbmZvOiBJRmlsZU9wZXJhdGlvblVuZG9SZWRvSW5mbyxcblx0XHRASVdvcmtpbmdDb3B5RmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfd29ya2luZ0NvcHlGaWxlU2VydmljZTogSVdvcmtpbmdDb3B5RmlsZVNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9maWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHsgfVxuXG5cdGdldCB1cmlzKCkge1xuXHRcdHJldHVybiB0aGlzLl9lZGl0cy5tYXAoZWRpdCA9PiBlZGl0Lm9sZFVyaSk7XG5cdH1cblxuXHRhc3luYyBwZXJmb3JtKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUZpbGVPcGVyYXRpb24+IHtcblx0XHQvLyBkZWxldGUgZmlsZVxuXG5cdFx0Y29uc3QgZGVsZXRlczogSURlbGV0ZU9wZXJhdGlvbltdID0gW107XG5cdFx0Y29uc3QgdW5kb2VzOiBDcmVhdGVFZGl0W10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgZWRpdCBvZiB0aGlzLl9lZGl0cykge1xuXHRcdFx0bGV0IGZpbGVTdGF0OiBJRmlsZVN0YXRXaXRoTWV0YWRhdGEgfCB1bmRlZmluZWQ7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRmaWxlU3RhdCA9IGF3YWl0IHRoaXMuX2ZpbGVTZXJ2aWNlLnJlc29sdmUoZWRpdC5vbGRVcmksIHsgcmVzb2x2ZU1ldGFkYXRhOiB0cnVlIH0pO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdGlmICghZWRpdC5vcHRpb25zLmlnbm9yZUlmTm90RXhpc3RzKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGAke2VkaXQub2xkVXJpfSBkb2VzIG5vdCBleGlzdCBhbmQgY2FuIG5vdCBiZSBkZWxldGVkYCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGRlbGV0ZXMucHVzaCh7XG5cdFx0XHRcdHJlc291cmNlOiBlZGl0Lm9sZFVyaSxcblx0XHRcdFx0cmVjdXJzaXZlOiBlZGl0Lm9wdGlvbnMucmVjdXJzaXZlLFxuXHRcdFx0XHR1c2VUcmFzaDogIWVkaXQub3B0aW9ucy5za2lwVHJhc2hCaW4gJiYgdGhpcy5fZmlsZVNlcnZpY2UuaGFzQ2FwYWJpbGl0eShlZGl0Lm9sZFVyaSwgRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLlRyYXNoKSAmJiB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignZmlsZXMuZW5hYmxlVHJhc2gnKVxuXHRcdFx0fSk7XG5cblxuXHRcdFx0Ly8gcmVhZCBmaWxlIGNvbnRlbnRzIGZvciB1bmRvIG9wZXJhdGlvbi4gd2hlbiBhIGZpbGUgaXMgdG9vIGxhcmdlIGl0IHdvbid0IGJlIHJlc3RvcmVkXG5cdFx0XHRsZXQgZmlsZUNvbnRlbnQ6IElGaWxlQ29udGVudCB8IHVuZGVmaW5lZDtcblx0XHRcdGxldCBmaWxlQ29udGVudEV4Y2VlZHNNYXhTaXplID0gZmFsc2U7XG5cdFx0XHRpZiAoIWVkaXQudW5kb2VzQ3JlYXRlICYmICFlZGl0Lm9wdGlvbnMuZm9sZGVyKSB7XG5cdFx0XHRcdGZpbGVDb250ZW50RXhjZWVkc01heFNpemUgPSB0eXBlb2YgZWRpdC5vcHRpb25zLm1heFNpemUgPT09ICdudW1iZXInICYmIGZpbGVTdGF0LnNpemUgPiBlZGl0Lm9wdGlvbnMubWF4U2l6ZTtcblx0XHRcdFx0aWYgKCFmaWxlQ29udGVudEV4Y2VlZHNNYXhTaXplKSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGZpbGVDb250ZW50ID0gYXdhaXQgdGhpcy5fZmlsZVNlcnZpY2UucmVhZEZpbGUoZWRpdC5vbGRVcmkpO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihlcnIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCFmaWxlQ29udGVudEV4Y2VlZHNNYXhTaXplKSB7XG5cdFx0XHRcdHVuZG9lcy5wdXNoKG5ldyBDcmVhdGVFZGl0KGVkaXQub2xkVXJpLCBlZGl0Lm9wdGlvbnMsIGZpbGVDb250ZW50Py52YWx1ZSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChkZWxldGVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIG5ldyBOb29wKCk7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5fd29ya2luZ0NvcHlGaWxlU2VydmljZS5kZWxldGUoZGVsZXRlcywgdG9rZW4sIHRoaXMuX3VuZG9SZWRvSW5mbyk7XG5cblx0XHRpZiAodW5kb2VzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIG5ldyBOb29wKCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9pbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ3JlYXRlT3BlcmF0aW9uLCB1bmRvZXMsIHsgaXNVbmRvaW5nOiB0cnVlIH0pO1xuXHR9XG5cblx0dG9TdHJpbmcoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYChkZWxldGUgJHt0aGlzLl9lZGl0cy5tYXAoZWRpdCA9PiBlZGl0Lm9sZFVyaSkuam9pbignLCAnKX0pYDtcblx0fVxufVxuXG5jbGFzcyBGaWxlVW5kb1JlZG9FbGVtZW50IGltcGxlbWVudHMgSVdvcmtzcGFjZVVuZG9SZWRvRWxlbWVudCB7XG5cblx0cmVhZG9ubHkgdHlwZSA9IFVuZG9SZWRvRWxlbWVudFR5cGUuV29ya3NwYWNlO1xuXG5cdHJlYWRvbmx5IHJlc291cmNlczogcmVhZG9ubHkgVVJJW107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgbGFiZWw6IHN0cmluZyxcblx0XHRyZWFkb25seSBjb2RlOiBzdHJpbmcsXG5cdFx0cmVhZG9ubHkgb3BlcmF0aW9uczogSUZpbGVPcGVyYXRpb25bXSxcblx0XHRyZWFkb25seSBjb25maXJtQmVmb3JlVW5kbzogYm9vbGVhblxuXHQpIHtcblx0XHR0aGlzLnJlc291cmNlcyA9IG9wZXJhdGlvbnMuZmxhdE1hcChvcCA9PiBvcC51cmlzKTtcblx0fVxuXG5cdGFzeW5jIHVuZG8oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fcmV2ZXJzZSgpO1xuXHR9XG5cblx0YXN5bmMgcmVkbygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLl9yZXZlcnNlKCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9yZXZlcnNlKCkge1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5vcGVyYXRpb25zLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBvcCA9IHRoaXMub3BlcmF0aW9uc1tpXTtcblx0XHRcdGNvbnN0IHVuZG8gPSBhd2FpdCBvcC5wZXJmb3JtKENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0dGhpcy5vcGVyYXRpb25zW2ldID0gdW5kbztcblx0XHR9XG5cdH1cblxuXHR0b1N0cmluZygpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLm9wZXJhdGlvbnMubWFwKG9wID0+IFN0cmluZyhvcCkpLmpvaW4oJywgJyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEJ1bGtGaWxlRWRpdHMge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xhYmVsOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY29kZTogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3VuZG9SZWRvR3JvdXA6IFVuZG9SZWRvR3JvdXAsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdW5kb1JlZG9Tb3VyY2U6IFVuZG9SZWRvU291cmNlIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpcm1CZWZvcmVVbmRvOiBib29sZWFuLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb2dyZXNzOiBJUHJvZ3Jlc3M8dm9pZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdG9rZW46IENhbmNlbGxhdGlvblRva2VuLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRzOiBSZXNvdXJjZUZpbGVFZGl0W10sXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YVNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVVuZG9SZWRvU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF91bmRvUmVkb1NlcnZpY2U6IElVbmRvUmVkb1NlcnZpY2UsXG5cdCkgeyB9XG5cblx0YXN5bmMgYXBwbHkoKTogUHJvbWlzZTxyZWFkb25seSBVUklbXT4ge1xuXHRcdGNvbnN0IHVuZG9PcGVyYXRpb25zOiBJRmlsZU9wZXJhdGlvbltdID0gW107XG5cdFx0Y29uc3QgdW5kb1JlZG9JbmZvID0geyB1bmRvUmVkb0dyb3VwSWQ6IHRoaXMuX3VuZG9SZWRvR3JvdXAuaWQgfTtcblxuXHRcdGNvbnN0IGVkaXRzOiBBcnJheTxSZW5hbWVFZGl0IHwgQ29weUVkaXQgfCBEZWxldGVFZGl0IHwgQ3JlYXRlRWRpdD4gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGVkaXQgb2YgdGhpcy5fZWRpdHMpIHtcblx0XHRcdGlmIChlZGl0Lm5ld1Jlc291cmNlICYmIGVkaXQub2xkUmVzb3VyY2UgJiYgIWVkaXQub3B0aW9ucz8uY29weSkge1xuXHRcdFx0XHRlZGl0cy5wdXNoKG5ldyBSZW5hbWVFZGl0KGVkaXQubmV3UmVzb3VyY2UsIGVkaXQub2xkUmVzb3VyY2UsIGVkaXQub3B0aW9ucyA/PyB7fSkpO1xuXHRcdFx0fSBlbHNlIGlmIChlZGl0Lm5ld1Jlc291cmNlICYmIGVkaXQub2xkUmVzb3VyY2UgJiYgZWRpdC5vcHRpb25zPy5jb3B5KSB7XG5cdFx0XHRcdGVkaXRzLnB1c2gobmV3IENvcHlFZGl0KGVkaXQubmV3UmVzb3VyY2UsIGVkaXQub2xkUmVzb3VyY2UsIGVkaXQub3B0aW9ucyA/PyB7fSkpO1xuXHRcdFx0fSBlbHNlIGlmICghZWRpdC5uZXdSZXNvdXJjZSAmJiBlZGl0Lm9sZFJlc291cmNlKSB7XG5cdFx0XHRcdGVkaXRzLnB1c2gobmV3IERlbGV0ZUVkaXQoZWRpdC5vbGRSZXNvdXJjZSwgZWRpdC5vcHRpb25zID8/IHt9LCBmYWxzZSkpO1xuXHRcdFx0fSBlbHNlIGlmIChlZGl0Lm5ld1Jlc291cmNlICYmICFlZGl0Lm9sZFJlc291cmNlKSB7XG5cdFx0XHRcdGVkaXRzLnB1c2gobmV3IENyZWF0ZUVkaXQoZWRpdC5uZXdSZXNvdXJjZSwgZWRpdC5vcHRpb25zID8/IHt9LCBhd2FpdCBlZGl0Lm9wdGlvbnMuY29udGVudHMpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZWRpdHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgZ3JvdXBzOiBBcnJheTxSZW5hbWVFZGl0IHwgQ29weUVkaXQgfCBEZWxldGVFZGl0IHwgQ3JlYXRlRWRpdD5bXSA9IFtdO1xuXHRcdGdyb3Vwc1swXSA9IFtlZGl0c1swXV07XG5cblx0XHRmb3IgKGxldCBpID0gMTsgaSA8IGVkaXRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBlZGl0ID0gZWRpdHNbaV07XG5cdFx0XHRjb25zdCBsYXN0R3JvdXAgPSBncm91cHMuYXQoLTEpO1xuXHRcdFx0aWYgKGxhc3RHcm91cD8uWzBdLnR5cGUgPT09IGVkaXQudHlwZSkge1xuXHRcdFx0XHRsYXN0R3JvdXAucHVzaChlZGl0KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGdyb3Vwcy5wdXNoKFtlZGl0XSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBncm91cCBvZiBncm91cHMpIHtcblxuXHRcdFx0aWYgKHRoaXMuX3Rva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgb3A6IElGaWxlT3BlcmF0aW9uIHwgdW5kZWZpbmVkO1xuXHRcdFx0c3dpdGNoIChncm91cFswXS50eXBlKSB7XG5cdFx0XHRcdGNhc2UgJ3JlbmFtZSc6XG5cdFx0XHRcdFx0b3AgPSB0aGlzLl9pbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVuYW1lT3BlcmF0aW9uLCA8UmVuYW1lRWRpdFtdPmdyb3VwLCB1bmRvUmVkb0luZm8pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdjb3B5Jzpcblx0XHRcdFx0XHRvcCA9IHRoaXMuX2luc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb3B5T3BlcmF0aW9uLCA8Q29weUVkaXRbXT5ncm91cCwgdW5kb1JlZG9JbmZvKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAnZGVsZXRlJzpcblx0XHRcdFx0XHRvcCA9IHRoaXMuX2luc3RhU2VydmljZS5jcmVhdGVJbnN0YW5jZShEZWxldGVPcGVyYXRpb24sIDxEZWxldGVFZGl0W10+Z3JvdXAsIHVuZG9SZWRvSW5mbyk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ2NyZWF0ZSc6XG5cdFx0XHRcdFx0b3AgPSB0aGlzLl9pbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ3JlYXRlT3BlcmF0aW9uLCA8Q3JlYXRlRWRpdFtdPmdyb3VwLCB1bmRvUmVkb0luZm8pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAob3ApIHtcblx0XHRcdFx0Y29uc3QgdW5kb09wID0gYXdhaXQgb3AucGVyZm9ybSh0aGlzLl90b2tlbik7XG5cdFx0XHRcdHVuZG9PcGVyYXRpb25zLnB1c2godW5kb09wKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX3Byb2dyZXNzLnJlcG9ydCh1bmRlZmluZWQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVuZG9SZWRvRWxlbWVudCA9IG5ldyBGaWxlVW5kb1JlZG9FbGVtZW50KHRoaXMuX2xhYmVsLCB0aGlzLl9jb2RlLCB1bmRvT3BlcmF0aW9ucywgdGhpcy5fY29uZmlybUJlZm9yZVVuZG8pO1xuXHRcdHRoaXMuX3VuZG9SZWRvU2VydmljZS5wdXNoRWxlbWVudCh1bmRvUmVkb0VsZW1lbnQsIHRoaXMuX3VuZG9SZWRvR3JvdXAsIHRoaXMuX3VuZG9SZWRvU291cmNlKTtcblx0XHRyZXR1cm4gdW5kb1JlZG9FbGVtZW50LnJlc291cmNlcztcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFPQSxTQUFTLGNBQWMsc0NBQTJFO0FBRWxHLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsK0JBQXFKO0FBQzlKLFNBQW9DLHFCQUFxQix3QkFBdUQ7QUFFaEgsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxtQkFBbUI7QUFHNUIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxlQUFlO0FBT3hCLE1BQU0sS0FBK0I7QUFBQSxFQUFyQztBQUNDLFNBQVMsT0FBTyxDQUFDO0FBQUE7QUFBQSxFQUNqQixNQUFNLFVBQVU7QUFBRSxXQUFPO0FBQUEsRUFBTTtBQUFBLEVBQy9CLFdBQW1CO0FBQ2xCLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUFFQSxNQUFNLFdBQVc7QUFBQSxFQUVoQixZQUNVLFFBQ0EsUUFDQSxTQUNSO0FBSFE7QUFDQTtBQUNBO0FBSlYsU0FBUyxPQUFPO0FBQUEsRUFLWjtBQUNMO0FBRUEsSUFBTSxrQkFBTixNQUFnRDtBQUFBLEVBRS9DLFlBQ2tCLFFBQ0EsZUFDeUIseUJBQ1gsY0FDOUI7QUFKZ0I7QUFDQTtBQUN5QjtBQUNYO0FBQUEsRUFDNUI7QUFBQSxFQUVKLElBQUksT0FBTztBQUNWLFdBQU8sS0FBSyxPQUFPLFFBQVEsVUFBUSxDQUFDLEtBQUssUUFBUSxLQUFLLE1BQU0sQ0FBQztBQUFBLEVBQzlEO0FBQUEsRUFFQSxNQUFNLFFBQVEsT0FBbUQ7QUFFaEUsVUFBTSxRQUEwQixDQUFDO0FBQ2pDLFVBQU0sU0FBdUIsQ0FBQztBQUM5Qixl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
