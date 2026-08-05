import { TernarySearchTree } from "../../../base/common/ternarySearchTree.js";
import { sep } from "../../../base/common/path.js";
import { startsWithIgnoreCase } from "../../../base/common/strings.js";
import { isNumber } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { isWeb } from "../../../base/common/platform.js";
import { Schemas } from "../../../base/common/network.js";
import { Lazy } from "../../../base/common/lazy.js";
const IFileService = createDecorator("fileService");
function isFileOpenForWriteOptions(options) {
  return options.create === true;
}
var FileType = /* @__PURE__ */ ((FileType2) => {
  FileType2[FileType2["Unknown"] = 0] = "Unknown";
  FileType2[FileType2["File"] = 1] = "File";
  FileType2[FileType2["Directory"] = 2] = "Directory";
  FileType2[FileType2["SymbolicLink"] = 64] = "SymbolicLink";
  return FileType2;
})(FileType || {});
var FilePermission = /* @__PURE__ */ ((FilePermission2) => {
  FilePermission2[FilePermission2["Readonly"] = 1] = "Readonly";
  FilePermission2[FilePermission2["Locked"] = 2] = "Locked";
  return FilePermission2;
})(FilePermission || {});
var FileChangeFilter = /* @__PURE__ */ ((FileChangeFilter2) => {
  FileChangeFilter2[FileChangeFilter2["UPDATED"] = 2] = "UPDATED";
  FileChangeFilter2[FileChangeFilter2["ADDED"] = 4] = "ADDED";
  FileChangeFilter2[FileChangeFilter2["DELETED"] = 8] = "DELETED";
  return FileChangeFilter2;
})(FileChangeFilter || {});
function isFileSystemWatcher(thing) {
  const candidate = thing;
  return !!candidate && typeof candidate.onDidChange === "function";
}
var FileSystemProviderCapabilities = /* @__PURE__ */ ((FileSystemProviderCapabilities2) => {
  FileSystemProviderCapabilities2[FileSystemProviderCapabilities2["None"] = 0] = "None";
  FileSystemProviderCapabilities2[FileSystemProviderCapabilities2["FileReadWrite"] = 2] = "FileReadWrite";
  FileSystemProviderCapabilities2[FileSystemProviderCapabilities2["FileOpenReadWriteClose"] = 4] = "FileOpenReadWriteClose";
  FileSystemProviderCapabilities2[FileSystemProviderCapabilities2["FileReadStream"] = 16] = "FileReadStream";
  FileSystemProviderCapabilities2[FileSystemProviderCapabilities2["FileFolderCopy"] = 8] = "FileFolderCopy";
  FileSystemProviderCapabilities2[FileSystemProviderCapabilities2["PathCaseSensitive"] = 1024] = "PathCaseSensitive";
  FileSystemProviderCapabilities2[FileSystemProviderCapabilities2["Readonly"] = 2048] = "Readonly";
  FileSystemProviderCapabilities2[FileSystemProviderCapabilities2["Trash"] = 4096] = "Trash";
  FileSystemProviderCapabilities2[FileSystemProviderCapabilities2["FileWriteUnlock"] = 8192] = "FileWriteUnlock";
  FileSystemProviderCapabilities2[FileSystemProviderCapabilities2["FileAtomicRead"] = 16384] = "FileAtomicRead";
  FileSystemProviderCapabilities2[FileSystemProviderCapabilities2["FileAtomicWrite"] = 32768] = "FileAtomicWrite";
  FileSystemProviderCapabilities2[FileSystemProviderCapabilities2["FileAtomicDelete"] = 65536] = "FileAtomicDelete";
  FileSystemProviderCapabilities2[FileSystemProviderCapabilities2["FileClone"] = 131072] = "FileClone";
  return FileSystemProviderCapabilities2;
})(FileSystemProviderCapabilities || {});
function hasReadWriteCapability(provider) {
  return !!(provider.capabilities & 2 /* FileReadWrite */);
}
function hasFileFolderCopyCapability(provider) {
  return !!(provider.capabilities & 8 /* FileFolderCopy */);
}
function hasFileCloneCapability(provider) {
  return !!(provider.capabilities & 131072 /* FileClone */);
}
function hasOpenReadWriteCloseCapability(provider) {
  return !!(provider.capabilities & 4 /* FileOpenReadWriteClose */);
}
function hasFileReadStreamCapability(provider) {
  return !!(provider.capabilities & 16 /* FileReadStream */);
}
function hasFileAtomicReadCapability(provider) {
  if (!hasReadWriteCapability(provider)) {
    return false;
  }
  return !!(provider.capabilities & 16384 /* FileAtomicRead */);
}
function hasFileAtomicWriteCapability(provider) {
  if (!hasReadWriteCapability(provider)) {
    return false;
  }
  return !!(provider.capabilities & 32768 /* FileAtomicWrite */);
}
function hasFileAtomicDeleteCapability(provider) {
  return !!(provider.capabilities & 65536 /* FileAtomicDelete */);
}
function hasReadonlyCapability(provider) {
  return !!(provider.capabilities & 2048 /* Readonly */);
}
var FileSystemProviderErrorCode = /* @__PURE__ */ ((FileSystemProviderErrorCode2) => {
  FileSystemProviderErrorCode2["FileExists"] = "EntryExists";
  FileSystemProviderErrorCode2["FileNotFound"] = "EntryNotFound";
  FileSystemProviderErrorCode2["FileNotADirectory"] = "EntryNotADirectory";
  FileSystemProviderErrorCode2["FileIsADirectory"] = "EntryIsADirectory";
  FileSystemProviderErrorCode2["FileExceedsStorageQuota"] = "EntryExceedsStorageQuota";
  FileSystemProviderErrorCode2["FileTooLarge"] = "EntryTooLarge";
  FileSystemProviderErrorCode2["FileWriteLocked"] = "EntryWriteLocked";
  FileSystemProviderErrorCode2["NoPermissions"] = "NoPermissions";
  FileSystemProviderErrorCode2["Unavailable"] = "Unavailable";
  FileSystemProviderErrorCode2["Unknown"] = "Unknown";
  return FileSystemProviderErrorCode2;
})(FileSystemProviderErrorCode || {});
class FileSystemProviderError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
  static create(error, code) {
    const providerError = new FileSystemProviderError(error.toString(), code);
    markAsFileSystemProviderError(providerError, code);
    return providerError;
  }
}
function createFileSystemProviderError(error, code) {
  return FileSystemProviderError.create(error, code);
}
function ensureFileSystemProviderError(error) {
  if (!error) {
    return createFileSystemProviderError(localize("unknownError", "Unknown Error"), "Unknown" /* Unknown */);
  }
  return error;
}
function markAsFileSystemProviderError(error, code) {
  error.name = code ? `${code} (FileSystemError)` : `FileSystemError`;
  return error;
}
function toFileSystemProviderErrorCode(error) {
  if (!error) {
    return "Unknown" /* Unknown */;
  }
  if (error instanceof FileSystemProviderError) {
    return error.code;
  }
  const match = /^(.+) \(FileSystemError\)$/.exec(error.name);
  if (!match) {
    return "Unknown" /* Unknown */;
  }
  switch (match[1]) {
    case "EntryExists" /* FileExists */:
      return "EntryExists" /* FileExists */;
    case "EntryIsADirectory" /* FileIsADirectory */:
      return "EntryIsADirectory" /* FileIsADirectory */;
    case "EntryNotADirectory" /* FileNotADirectory */:
      return "EntryNotADirectory" /* FileNotADirectory */;
    case "EntryNotFound" /* FileNotFound */:
      return "EntryNotFound" /* FileNotFound */;
    case "EntryTooLarge" /* FileTooLarge */:
      return "EntryTooLarge" /* FileTooLarge */;
    case "EntryWriteLocked" /* FileWriteLocked */:
      return "EntryWriteLocked" /* FileWriteLocked */;
    case "NoPermissions" /* NoPermissions */:
      return "NoPermissions" /* NoPermissions */;
    case "Unavailable" /* Unavailable */:
      return "Unavailable" /* Unavailable */;
  }
  return "Unknown" /* Unknown */;
}
function toFileOperationResult(error) {
  if (error instanceof FileOperationError) {
    return error.fileOperationResult;
  }
  switch (toFileSystemProviderErrorCode(error)) {
    case "EntryNotFound" /* FileNotFound */:
      return 1 /* FILE_NOT_FOUND */;
    case "EntryIsADirectory" /* FileIsADirectory */:
      return 0 /* FILE_IS_DIRECTORY */;
    case "EntryNotADirectory" /* FileNotADirectory */:
      return 9 /* FILE_NOT_DIRECTORY */;
    case "EntryWriteLocked" /* FileWriteLocked */:
      return 5 /* FILE_WRITE_LOCKED */;
    case "NoPermissions" /* NoPermissions */:
      return 6 /* FILE_PERMISSION_DENIED */;
    case "EntryExists" /* FileExists */:
      return 4 /* FILE_MOVE_CONFLICT */;
    case "EntryTooLarge" /* FileTooLarge */:
      return 7 /* FILE_TOO_LARGE */;
    default:
      return 10 /* FILE_OTHER_ERROR */;
  }
}
var FileOperation = /* @__PURE__ */ ((FileOperation2) => {
  FileOperation2[FileOperation2["CREATE"] = 0] = "CREATE";
  FileOperation2[FileOperation2["DELETE"] = 1] = "DELETE";
  FileOperation2[FileOperation2["MOVE"] = 2] = "MOVE";
  FileOperation2[FileOperation2["COPY"] = 3] = "COPY";
  FileOperation2[FileOperation2["WRITE"] = 4] = "WRITE";
  return FileOperation2;
})(FileOperation || {});
class FileOperationEvent {
  constructor(resource, operation, target) {
    this.resource = resource;
    this.operation = operation;
    this.target = target;
  }
  isOperation(operation) {
    return this.operation === operation;
  }
}
var FileChangeType = /* @__PURE__ */ ((FileChangeType2) => {
  FileChangeType2[FileChangeType2["UPDATED"] = 0] = "UPDATED";
  FileChangeType2[FileChangeType2["ADDED"] = 1] = "ADDED";
  FileChangeType2[FileChangeType2["DELETED"] = 2] = "DELETED";
  return FileChangeType2;
})(FileChangeType || {});
const _FileChangesEvent = class _FileChangesEvent {
  constructor(changes, ignorePathCasing) {
    this.ignorePathCasing = ignorePathCasing;
    this.correlationId = void 0;
    this.added = new Lazy(() => {
      const added = TernarySearchTree.forUris(() => this.ignorePathCasing);
      added.fill(this.rawAdded.map((resource) => [resource, true]));
      return added;
    });
    this.updated = new Lazy(() => {
      const updated = TernarySearchTree.forUris(() => this.ignorePathCasing);
      updated.fill(this.rawUpdated.map((resource) => [resource, true]));
      return updated;
    });
    this.deleted = new Lazy(() => {
      const deleted = TernarySearchTree.forUris(() => this.ignorePathCasing);
      deleted.fill(this.rawDeleted.map((resource) => [resource, true]));
      return deleted;
    });
    /**
     * @deprecated use the `contains` or `affects` method to efficiently find
     * out if the event relates to a given resource. these methods ensure:
     * - that there is no expensive lookup needed (by using a `TernarySearchTree`)
     * - correctly handles `FileChangeType.DELETED` events
     */
    this.rawAdded = [];
    /**
    * @deprecated use the `contains` or `affects` method to efficiently find
    * out if the event relates to a given resource. these methods ensure:
    * - that there is no expensive lookup needed (by using a `TernarySearchTree`)
    * - correctly handles `FileChangeType.DELETED` events
    */
    this.rawUpdated = [];
    /**
    * @deprecated use the `contains` or `affects` method to efficiently find
    * out if the event relates to a given resource. these methods ensure:
    * - that there is no expensive lookup needed (by using a `TernarySearchTree`)
    * - correctly handles `FileChangeType.DELETED` events
    */
    this.rawDeleted = [];
    for (const change of changes) {
      switch (change.type) {
        case 1 /* ADDED */:
          this.rawAdded.push(change.resource);
          break;
        case 0 /* UPDATED */:
          this.rawUpdated.push(change.resource);
          break;
        case 2 /* DELETED */:
          this.rawDeleted.push(change.resource);
          break;
      }
      if (this.correlationId !== _FileChangesEvent.MIXED_CORRELATION) {
        if (typeof change.cId === "number") {
          if (this.correlationId === void 0) {
            this.correlationId = change.cId;
          } else if (this.correlationId !== change.cId) {
            this.correlationId = _FileChangesEvent.MIXED_CORRELATION;
          }
        } else {
          if (this.correlationId !== void 0) {
            this.correlationId = _FileChangesEvent.MIXED_CORRELATION;
          }
        }
      }
    }
  }
  /**
   * Find out if the file change events match the provided resource.
   *
   * Note: when passing `FileChangeType.DELETED`, we consider a match
   * also when the parent of the resource got deleted.
   */
  contains(resource, ...types) {
    return this.doContains(resource, { includeChildren: false }, ...types);
  }
  /**
   * Find out if the file change events either match the provided
   * resource, or contain a child of this resource.
   */
  affects(resource, ...types) {
    return this.doContains(resource, { includeChildren: true }, ...types);
  }
  doContains(resource, options, ...types) {
    if (!resource) {
      return false;
    }
    const hasTypesFilter = types.length > 0;
    if (!hasTypesFilter || types.includes(1 /* ADDED */)) {
      if (this.added.value.get(resource)) {
        return true;
      }
      if (options.includeChildren && this.added.value.findSuperstr(resource)) {
        return true;
      }
    }
    if (!hasTypesFilter || types.includes(0 /* UPDATED */)) {
      if (this.updated.value.get(resource)) {
        return true;
      }
      if (options.includeChildren && this.updated.value.findSuperstr(resource)) {
        return true;
      }
    }
    if (!hasTypesFilter || types.includes(2 /* DELETED */)) {
      if (this.deleted.value.findSubstr(resource)) {
        return true;
      }
      if (options.includeChildren && this.deleted.value.findSuperstr(resource)) {
        return true;
      }
    }
    return false;
  }
  /**
   * Returns if this event contains added files.
   */
  gotAdded() {
    return this.rawAdded.length > 0;
  }
  /**
   * Returns if this event contains deleted files.
   */
  gotDeleted() {
    return this.rawDeleted.length > 0;
  }
  /**
   * Returns if this event contains updated files.
   */
  gotUpdated() {
    return this.rawUpdated.length > 0;
  }
  /**
   * Returns if this event contains changes that correlate to the
   * provided `correlationId`.
   *
   * File change event correlation is an advanced watch feature that
   * allows to  identify from which watch request the events originate
   * from. This correlation allows to route events specifically
   * only to the requestor and not emit them to all listeners.
   */
  correlates(correlationId) {
    return this.correlationId === correlationId;
  }
  /**
   * Figure out if the event contains changes that correlate to one
   * correlation identifier.
   *
   * File change event correlation is an advanced watch feature that
   * allows to  identify from which watch request the events originate
   * from. This correlation allows to route events specifically
   * only to the requestor and not emit them to all listeners.
   */
  hasCorrelation() {
    return typeof this.correlationId === "number";
  }
};
_FileChangesEvent.MIXED_CORRELATION = null;
let FileChangesEvent = _FileChangesEvent;
function isParent(path, candidate, ignoreCase) {
  if (!path || !candidate || path === candidate) {
    return false;
  }
  if (candidate.length > path.length) {
    return false;
  }
  if (candidate.charAt(candidate.length - 1) !== sep) {
    candidate += sep;
  }
  if (ignoreCase) {
    return startsWithIgnoreCase(path, candidate);
  }
  return path.indexOf(candidate) === 0;
}
class FileOperationError extends Error {
  constructor(message, fileOperationResult, options) {
    super(message);
    this.fileOperationResult = fileOperationResult;
    this.options = options;
  }
}
class TooLargeFileOperationError extends FileOperationError {
  constructor(message, fileOperationResult, size, options) {
    super(message, fileOperationResult, options);
    this.fileOperationResult = fileOperationResult;
    this.size = size;
  }
}
class NotModifiedSinceFileOperationError extends FileOperationError {
  constructor(message, stat, options) {
    super(message, 2 /* FILE_NOT_MODIFIED_SINCE */, options);
    this.stat = stat;
  }
}
var FileOperationResult = /* @__PURE__ */ ((FileOperationResult2) => {
  FileOperationResult2[FileOperationResult2["FILE_IS_DIRECTORY"] = 0] = "FILE_IS_DIRECTORY";
  FileOperationResult2[FileOperationResult2["FILE_NOT_FOUND"] = 1] = "FILE_NOT_FOUND";
  FileOperationResult2[FileOperationResult2["FILE_NOT_MODIFIED_SINCE"] = 2] = "FILE_NOT_MODIFIED_SINCE";
  FileOperationResult2[FileOperationResult2["FILE_MODIFIED_SINCE"] = 3] = "FILE_MODIFIED_SINCE";
  FileOperationResult2[FileOperationResult2["FILE_MOVE_CONFLICT"] = 4] = "FILE_MOVE_CONFLICT";
  FileOperationResult2[FileOperationResult2["FILE_WRITE_LOCKED"] = 5] = "FILE_WRITE_LOCKED";
  FileOperationResult2[FileOperationResult2["FILE_PERMISSION_DENIED"] = 6] = "FILE_PERMISSION_DENIED";
  FileOperationResult2[FileOperationResult2["FILE_TOO_LARGE"] = 7] = "FILE_TOO_LARGE";
  FileOperationResult2[FileOperationResult2["FILE_INVALID_PATH"] = 8] = "FILE_INVALID_PATH";
  FileOperationResult2[FileOperationResult2["FILE_NOT_DIRECTORY"] = 9] = "FILE_NOT_DIRECTORY";
  FileOperationResult2[FileOperationResult2["FILE_OTHER_ERROR"] = 10] = "FILE_OTHER_ERROR";
  return FileOperationResult2;
})(FileOperationResult || {});
const AutoSaveConfiguration = {
  OFF: "off",
  AFTER_DELAY: "afterDelay",
  ON_FOCUS_CHANGE: "onFocusChange",
  ON_WINDOW_CHANGE: "onWindowChange"
};
const HotExitConfiguration = {
  OFF: "off",
  ON_EXIT: "onExit",
  ON_EXIT_AND_WINDOW_CLOSE: "onExitAndWindowClose"
};
const FILES_ASSOCIATIONS_CONFIG = "files.associations";
const FILES_EXCLUDE_CONFIG = "files.exclude";
const FILES_READONLY_INCLUDE_CONFIG = "files.readonlyInclude";
const FILES_READONLY_EXCLUDE_CONFIG = "files.readonlyExclude";
const FILES_READONLY_FROM_PERMISSIONS_CONFIG = "files.readonlyFromPermissions";
var FileKind = /* @__PURE__ */ ((FileKind2) => {
  FileKind2[FileKind2["FILE"] = 0] = "FILE";
  FileKind2[FileKind2["FOLDER"] = 1] = "FOLDER";
  FileKind2[FileKind2["ROOT_FOLDER"] = 2] = "ROOT_FOLDER";
  return FileKind2;
})(FileKind || {});
const ETAG_DISABLED = "";
function etag(stat) {
  if (typeof stat.size !== "number" || typeof stat.mtime !== "number") {
    return void 0;
  }
  return stat.mtime.toString(29) + stat.size.toString(31);
}
async function whenProviderRegistered(file, fileService) {
  if (fileService.hasProvider(URI.from({ scheme: file.scheme }))) {
    return;
  }
  return new Promise((resolve) => {
    const disposable = fileService.onDidChangeFileSystemProviderRegistrations((e) => {
      if (e.scheme === file.scheme && e.added) {
        disposable.dispose();
        resolve();
      }
    });
  });
}
const _ByteSize = class _ByteSize {
  static formatSize(size) {
    if (!isNumber(size)) {
      size = 0;
    }
    if (size < _ByteSize.KB) {
      return localize("sizeB", "{0}B", size.toFixed(0));
    }
    if (size < _ByteSize.MB) {
      return localize("sizeKB", "{0}KB", (size / _ByteSize.KB).toFixed(2));
    }
    if (size < _ByteSize.GB) {
      return localize("sizeMB", "{0}MB", (size / _ByteSize.MB).toFixed(2));
    }
    if (size < _ByteSize.TB) {
      return localize("sizeGB", "{0}GB", (size / _ByteSize.GB).toFixed(2));
    }
    return localize("sizeTB", "{0}TB", (size / _ByteSize.TB).toFixed(2));
  }
};
_ByteSize.KB = 1024;
_ByteSize.MB = _ByteSize.KB * _ByteSize.KB;
_ByteSize.GB = _ByteSize.MB * _ByteSize.KB;
_ByteSize.TB = _ByteSize.GB * _ByteSize.KB;
let ByteSize = _ByteSize;
function getLargeFileConfirmationLimit(arg) {
  const isRemote = typeof arg === "string" || arg?.scheme === Schemas.vscodeRemote;
  const isLocal = typeof arg !== "string" && arg?.scheme === Schemas.file;
  if (isLocal) {
    return 1024 * ByteSize.MB;
  }
  if (isRemote) {
    return 10 * ByteSize.MB;
  }
  if (isWeb) {
    return 50 * ByteSize.MB;
  }
  return 1024 * ByteSize.MB;
}
export {
  AutoSaveConfiguration,
  ByteSize,
  ETAG_DISABLED,
  FILES_ASSOCIATIONS_CONFIG,
  FILES_EXCLUDE_CONFIG,
  FILES_READONLY_EXCLUDE_CONFIG,
  FILES_READONLY_FROM_PERMISSIONS_CONFIG,
  FILES_READONLY_INCLUDE_CONFIG,
  FileChangeFilter,
  FileChangeType,
  FileChangesEvent,
  FileKind,
  FileOperation,
  FileOperationError,
  FileOperationEvent,
  FileOperationResult,
  FilePermission,
  FileSystemProviderCapabilities,
  FileSystemProviderError,
  FileSystemProviderErrorCode,
  FileType,
  HotExitConfiguration,
  IFileService,
  NotModifiedSinceFileOperationError,
  TooLargeFileOperationError,
  createFileSystemProviderError,
  ensureFileSystemProviderError,
  etag,
  getLargeFileConfirmationLimit,
  hasFileAtomicDeleteCapability,
  hasFileAtomicReadCapability,
  hasFileAtomicWriteCapability,
  hasFileCloneCapability,
  hasFileFolderCopyCapability,
  hasFileReadStreamCapability,
  hasOpenReadWriteCloseCapability,
  hasReadWriteCapability,
  hasReadonlyCapability,
  isFileOpenForWriteOptions,
  isFileSystemWatcher,
  isParent,
  markAsFileSystemProviderError,
  toFileOperationResult,
  toFileSystemProviderErrorCode,
  whenProviderRegistered
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBWU0J1ZmZlciwgVlNCdWZmZXJSZWFkYWJsZSwgVlNCdWZmZXJSZWFkYWJsZVN0cmVhbSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElFeHByZXNzaW9uLCBJUmVsYXRpdmVQYXR0ZXJuIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZ2xvYi5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBUZXJuYXJ5U2VhcmNoVHJlZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Rlcm5hcnlTZWFyY2hUcmVlLmpzJztcbmltcG9ydCB7IHNlcCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgUmVhZGFibGVTdHJlYW1FdmVudHMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJlYW0uanMnO1xuaW1wb3J0IHsgc3RhcnRzV2l0aElnbm9yZUNhc2UgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IGlzTnVtYmVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGNyZWF0ZURlY29yYXRvciB9IGZyb20gJy4uLy4uL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgaXNXZWIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBMYXp5IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGF6eS5qcyc7XG5cbi8vI3JlZ2lvbiBmaWxlIHNlcnZpY2UgJiBwcm92aWRlcnNcblxuZXhwb3J0IGNvbnN0IElGaWxlU2VydmljZSA9IGNyZWF0ZURlY29yYXRvcjxJRmlsZVNlcnZpY2U+KCdmaWxlU2VydmljZScpO1xuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlU2VydmljZSB7XG5cblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdC8qKlxuXHQgKiBBbiBldmVudCB0aGF0IGlzIGZpcmVkIHdoZW4gYSBmaWxlIHN5c3RlbSBwcm92aWRlciBpcyBhZGRlZCBvciByZW1vdmVkXG5cdCAqL1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUZpbGVTeXN0ZW1Qcm92aWRlclJlZ2lzdHJhdGlvbnM6IEV2ZW50PElGaWxlU3lzdGVtUHJvdmlkZXJSZWdpc3RyYXRpb25FdmVudD47XG5cblx0LyoqXG5cdCAqIEFuIGV2ZW50IHRoYXQgaXMgZmlyZWQgd2hlbiBhIHJlZ2lzdGVyZWQgZmlsZSBzeXN0ZW0gcHJvdmlkZXIgY2hhbmdlcyBpdHMgY2FwYWJpbGl0aWVzLlxuXHQgKi9cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXM6IEV2ZW50PElGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXNDaGFuZ2VFdmVudD47XG5cblx0LyoqXG5cdCAqIEFuIGV2ZW50IHRoYXQgaXMgZmlyZWQgd2hlbiBhIGZpbGUgc3lzdGVtIHByb3ZpZGVyIGlzIGFib3V0IHRvIGJlIGFjdGl2YXRlZC4gTGlzdGVuZXJzXG5cdCAqIGNhbiBqb2luIHRoaXMgZXZlbnQgd2l0aCBhIGxvbmcgcnVubmluZyBwcm9taXNlIHRvIGhlbHAgaW4gdGhlIGFjdGl2YXRpb24gcHJvY2Vzcy5cblx0ICovXG5cdHJlYWRvbmx5IG9uV2lsbEFjdGl2YXRlRmlsZVN5c3RlbVByb3ZpZGVyOiBFdmVudDxJRmlsZVN5c3RlbVByb3ZpZGVyQWN0aXZhdGlvbkV2ZW50PjtcblxuXHQvKipcblx0ICogUmVnaXN0ZXJzIGEgZmlsZSBzeXN0ZW0gcHJvdmlkZXIgZm9yIGEgY2VydGFpbiBzY2hlbWUuXG5cdCAqL1xuXHRyZWdpc3RlclByb3ZpZGVyKHNjaGVtZTogc3RyaW5nLCBwcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlcik6IElEaXNwb3NhYmxlO1xuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGEgZmlsZSBzeXN0ZW0gcHJvdmlkZXIgZm9yIGEgY2VydGFpbiBzY2hlbWUuXG5cdCAqL1xuXHRnZXRQcm92aWRlcihzY2hlbWU6IHN0cmluZyk6IElGaWxlU3lzdGVtUHJvdmlkZXIgfCB1bmRlZmluZWQ7XG5cblx0LyoqXG5cdCAqIFRyaWVzIHRvIGFjdGl2YXRlIGEgcHJvdmlkZXIgd2l0aCB0aGUgZ2l2ZW4gc2NoZW1lLlxuXHQgKi9cblx0YWN0aXZhdGVQcm92aWRlcihzY2hlbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD47XG5cblx0LyoqXG5cdCAqIENoZWNrcyBpZiB0aGlzIGZpbGUgc2VydmljZSBjYW4gaGFuZGxlIHRoZSBnaXZlbiByZXNvdXJjZSBieVxuXHQgKiBmaXJzdCBhY3RpdmF0aW5nIGFueSBleHRlbnNpb24gdGhhdCB3YW50cyB0byBiZSBhY3RpdmF0ZWRcblx0ICogb24gdGhlIHByb3ZpZGVkIHJlc291cmNlIHNjaGVtZSB0byBpbmNsdWRlIGV4dGVuc2lvbnMgdGhhdFxuXHQgKiBjb250cmlidXRlIGZpbGUgc3lzdGVtIHByb3ZpZGVycyBmb3IgdGhlIGdpdmVuIHJlc291cmNlLlxuXHQgKi9cblx0Y2FuSGFuZGxlUmVzb3VyY2UocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8Ym9vbGVhbj47XG5cblx0LyoqXG5cdCAqIENoZWNrcyBpZiB0aGUgZmlsZSBzZXJ2aWNlIGhhcyBhIHJlZ2lzdGVyZWQgcHJvdmlkZXIgZm9yIHRoZVxuXHQgKiBwcm92aWRlZCByZXNvdXJjZS5cblx0ICpcblx0ICogTm90ZTogdGhpcyBkb2VzIE5PVCBhY2NvdW50IGZvciBjb250cmlidXRlZCBwcm92aWRlcnMgZnJvbVxuXHQgKiBleHRlbnNpb25zIHRoYXQgaGF2ZSBub3QgYmVlbiBhY3RpdmF0ZWQgeWV0LiBUbyBpbmNsdWRlIHRob3NlLFxuXHQgKiBjb25zaWRlciB0byBjYWxsIGBhd2FpdCBmaWxlU2VydmljZS5jYW5IYW5kbGVSZXNvdXJjZShyZXNvdXJjZSlgLlxuXHQgKi9cblx0aGFzUHJvdmlkZXIocmVzb3VyY2U6IFVSSSk6IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIENoZWNrcyBpZiB0aGUgcHJvdmlkZXIgZm9yIHRoZSBwcm92aWRlZCByZXNvdXJjZSBoYXMgdGhlIHByb3ZpZGVkIGZpbGUgc3lzdGVtIGNhcGFiaWxpdHkuXG5cdCAqL1xuXHRoYXNDYXBhYmlsaXR5KHJlc291cmNlOiBVUkksIGNhcGFiaWxpdHk6IEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcyk6IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIExpc3QgdGhlIHNjaGVtZXMgYW5kIGNhcGFiaWxpdGllcyBmb3IgcmVnaXN0ZXJlZCBmaWxlIHN5c3RlbSBwcm92aWRlcnNcblx0ICovXG5cdGxpc3RDYXBhYmlsaXRpZXMoKTogSXRlcmFibGU8eyBzY2hlbWU6IHN0cmluZzsgY2FwYWJpbGl0aWVzOiBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMgfT47XG5cblx0LyoqXG5cdCAqIEFsbG93cyB0byBsaXN0ZW4gZm9yIGZpbGUgY2hhbmdlcy4gVGhlIGV2ZW50IHdpbGwgZmlyZSBmb3IgZXZlcnkgZmlsZSB3aXRoaW4gdGhlIG9wZW5lZCB3b3Jrc3BhY2Vcblx0ICogKGlmIGFueSkgYXMgd2VsbCBhcyBhbGwgZmlsZXMgdGhhdCBoYXZlIGJlZW4gd2F0Y2hlZCBleHBsaWNpdGx5IHVzaW5nIHRoZSAjd2F0Y2goKSBBUEkuXG5cdCAqL1xuXHRyZWFkb25seSBvbkRpZEZpbGVzQ2hhbmdlOiBFdmVudDxGaWxlQ2hhbmdlc0V2ZW50PjtcblxuXHQvKipcblx0ICogQW4gZXZlbnQgdGhhdCBpcyBmaXJlZCB1cG9uIHN1Y2Nlc3NmdWwgY29tcGxldGlvbiBvZiBhIGNlcnRhaW4gZmlsZSBvcGVyYXRpb24uXG5cdCAqL1xuXHRyZWFkb25seSBvbkRpZFJ1bk9wZXJhdGlvbjogRXZlbnQ8RmlsZU9wZXJhdGlvbkV2ZW50PjtcblxuXHQvKipcblx0ICogUmVzb2x2ZSB0aGUgcHJvcGVydGllcyBvZiBhIGZpbGUvZm9sZGVyIGlkZW50aWZpZWQgYnkgdGhlIHJlc291cmNlLiBGb3IgYSBmb2xkZXIsIGNoaWxkcmVuXG5cdCAqIGluZm9ybWF0aW9uIGlzIHJlc29sdmVkIGFzIHdlbGwgZGVwZW5kaW5nIG9uIHRoZSBwcm92aWRlZCBvcHRpb25zLiBVc2UgYHN0YXQoKWAgbWV0aG9kIGlmXG5cdCAqIHlvdSBkbyBub3QgbmVlZCBjaGlsZHJlbiBpbmZvcm1hdGlvbi5cblx0ICpcblx0ICogSWYgdGhlIG9wdGlvbmFsIHBhcmFtZXRlciBcInJlc29sdmVUb1wiIGlzIHNwZWNpZmllZCBpbiBvcHRpb25zLCB0aGUgc3RhdCBzZXJ2aWNlIGlzIGFza2VkXG5cdCAqIHRvIHByb3ZpZGUgYSBzdGF0IG9iamVjdCB0aGF0IHNob3VsZCBjb250YWluIHRoZSBmdWxsIGdyYXBoIG9mIGZvbGRlcnMgdXAgdG8gYWxsIG9mIHRoZVxuXHQgKiB0YXJnZXQgcmVzb3VyY2VzLlxuXHQgKlxuXHQgKiBJZiB0aGUgb3B0aW9uYWwgcGFyYW1ldGVyIFwicmVzb2x2ZVNpbmdsZUNoaWxkRGVzY2VuZGFudHNcIiBpcyBzcGVjaWZpZWQgaW4gb3B0aW9ucyxcblx0ICogdGhlIHN0YXQgc2VydmljZSBpcyBhc2tlZCB0byBhdXRvbWF0aWNhbGx5IHJlc29sdmUgY2hpbGQgZm9sZGVycyB0aGF0IG9ubHlcblx0ICogY29udGFpbiBhIHNpbmdsZSBlbGVtZW50LlxuXHQgKlxuXHQgKiBJZiB0aGUgb3B0aW9uYWwgcGFyYW1ldGVyIFwicmVzb2x2ZU1ldGFkYXRhXCIgaXMgc3BlY2lmaWVkIGluIG9wdGlvbnMsXG5cdCAqIHRoZSBzdGF0IHdpbGwgY29udGFpbiBtZXRhZGF0YSBpbmZvcm1hdGlvbiBzdWNoIGFzIHNpemUsIG10aW1lIGFuZCBldGFnLlxuXHQgKi9cblx0cmVzb2x2ZShyZXNvdXJjZTogVVJJLCBvcHRpb25zOiBJUmVzb2x2ZU1ldGFkYXRhRmlsZU9wdGlvbnMpOiBQcm9taXNlPElGaWxlU3RhdFdpdGhNZXRhZGF0YT47XG5cdHJlc29sdmUocmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IElSZXNvbHZlRmlsZU9wdGlvbnMpOiBQcm9taXNlPElGaWxlU3RhdD47XG5cblx0LyoqXG5cdCAqIFNhbWUgYXMgYHJlc29sdmUoKWAgYnV0IHN1cHBvcnRzIHJlc29sdmluZyBtdWx0aXBsZSByZXNvdXJjZXMgaW4gcGFyYWxsZWwuXG5cdCAqXG5cdCAqIElmIG9uZSBvZiB0aGUgcmVzb2x2ZSB0YXJnZXRzIGZhaWxzIHRvIHJlc29sdmUgcmV0dXJucyBhIGZha2UgYElGaWxlU3RhdGAgaW5zdGVhZCBvZlxuXHQgKiBtYWtpbmcgdGhlIHdob2xlIGNhbGwgZmFpbC5cblx0ICovXG5cdHJlc29sdmVBbGwodG9SZXNvbHZlOiB7IHJlc291cmNlOiBVUkk7IG9wdGlvbnM6IElSZXNvbHZlTWV0YWRhdGFGaWxlT3B0aW9ucyB9W10pOiBQcm9taXNlPElGaWxlU3RhdFJlc3VsdFtdPjtcblx0cmVzb2x2ZUFsbCh0b1Jlc29sdmU6IHsgcmVzb3VyY2U6IFVSSTsgb3B0aW9ucz86IElSZXNvbHZlRmlsZU9wdGlvbnMgfVtdKTogUHJvbWlzZTxJRmlsZVN0YXRSZXN1bHRbXT47XG5cblx0LyoqXG5cdCAqIFNhbWUgYXMgYHJlc29sdmUoKWAgYnV0IHdpdGhvdXQgcmVzb2x2aW5nIHRoZSBjaGlsZHJlbiBvZiBhIGZvbGRlciBpZiB0aGVcblx0ICogcmVzb3VyY2UgaXMgcG9pbnRpbmcgdG8gYSBmb2xkZXIuXG5cdCAqL1xuXHRzdGF0KHJlc291cmNlOiBVUkkpOiBQcm9taXNlPElGaWxlU3RhdFdpdGhQYXJ0aWFsTWV0YWRhdGE+O1xuXG5cdC8qKlxuXHQgKiBGaW5kcyBvdXQgaWYgYSBmaWxlL2ZvbGRlciBpZGVudGlmaWVkIGJ5IHRoZSByZXNvdXJjZSBleGlzdHMuXG5cdCAqL1xuXHRleGlzdHMocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8Ym9vbGVhbj47XG5cblx0LyoqXG5cdCAqIFJlYWQgdGhlIGNvbnRlbnRzIG9mIHRoZSBwcm92aWRlZCByZXNvdXJjZSB1bmJ1ZmZlcmVkLlxuXHQgKi9cblx0cmVhZEZpbGUocmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IElSZWFkRmlsZU9wdGlvbnMsIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElGaWxlQ29udGVudD47XG5cblx0LyoqXG5cdCAqIFJlYWQgdGhlIGNvbnRlbnRzIG9mIHRoZSBwcm92aWRlZCByZXNvdXJjZSBidWZmZXJlZCBhcyBzdHJlYW0uXG5cdCAqL1xuXHRyZWFkRmlsZVN0cmVhbShyZXNvdXJjZTogVVJJLCBvcHRpb25zPzogSVJlYWRGaWxlU3RyZWFtT3B0aW9ucywgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUZpbGVTdHJlYW1Db250ZW50PjtcblxuXHQvKipcblx0ICogVXBkYXRlcyB0aGUgY29udGVudCByZXBsYWNpbmcgaXRzIHByZXZpb3VzIHZhbHVlLlxuXHQgKlxuXHQgKiBFbWl0cyBhIGBGaWxlT3BlcmF0aW9uLldSSVRFYCBmaWxlIG9wZXJhdGlvbiBldmVudCB3aGVuIHN1Y2Nlc3NmdWwuXG5cdCAqL1xuXHR3cml0ZUZpbGUocmVzb3VyY2U6IFVSSSwgYnVmZmVyT3JSZWFkYWJsZU9yU3RyZWFtOiBWU0J1ZmZlciB8IFZTQnVmZmVyUmVhZGFibGUgfCBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtLCBvcHRpb25zPzogSVdyaXRlRmlsZU9wdGlvbnMpOiBQcm9taXNlPElGaWxlU3RhdFdpdGhNZXRhZGF0YT47XG5cblx0LyoqXG5cdCAqIE1vdmVzIHRoZSBmaWxlL2ZvbGRlciB0byBhIG5ldyBwYXRoIGlkZW50aWZpZWQgYnkgdGhlIHJlc291cmNlLlxuXHQgKlxuXHQgKiBUaGUgb3B0aW9uYWwgcGFyYW1ldGVyIG92ZXJ3cml0ZSBjYW4gYmUgc2V0IHRvIHJlcGxhY2UgYW4gZXhpc3RpbmcgZmlsZSBhdCB0aGUgbG9jYXRpb24uXG5cdCAqXG5cdCAqIEVtaXRzIGEgYEZpbGVPcGVyYXRpb24uTU9WRWAgZmlsZSBvcGVyYXRpb24gZXZlbnQgd2hlbiBzdWNjZXNzZnVsLlxuXHQgKi9cblx0bW92ZShzb3VyY2U6IFVSSSwgdGFyZ2V0OiBVUkksIG92ZXJ3cml0ZT86IGJvb2xlYW4pOiBQcm9taXNlPElGaWxlU3RhdFdpdGhNZXRhZGF0YT47XG5cblx0LyoqXG5cdCAqIEZpbmQgb3V0IGlmIGEgbW92ZSBvcGVyYXRpb24gaXMgcG9zc2libGUgZ2l2ZW4gdGhlIGFyZ3VtZW50cy4gTm8gY2hhbmdlcyBvbiBkaXNrIHdpbGxcblx0ICogYmUgcGVyZm9ybWVkLiBSZXR1cm5zIGFuIEVycm9yIGlmIHRoZSBvcGVyYXRpb24gY2Fubm90IGJlIGRvbmUuXG5cdCAqL1xuXHRjYW5Nb3ZlKHNvdXJjZTogVVJJLCB0YXJnZXQ6IFVSSSwgb3ZlcndyaXRlPzogYm9vbGVhbik6IFByb21pc2U8RXJyb3IgfCB0cnVlPjtcblxuXHQvKipcblx0ICogQ29waWVzIHRoZSBmaWxlL2ZvbGRlciB0byBhIHBhdGggaWRlbnRpZmllZCBieSB0aGUgcmVzb3VyY2UuIEEgZm9sZGVyIGlzIGNvcGllZFxuXHQgKiByZWN1cnNpdmVseS5cblx0ICpcblx0ICogRW1pdHMgYSBgRmlsZU9wZXJhdGlvbi5DT1BZYCBmaWxlIG9wZXJhdGlvbiBldmVudCB3aGVuIHN1Y2Nlc3NmdWwuXG5cdCAqL1xuXHRjb3B5KHNvdXJjZTogVVJJLCB0YXJnZXQ6IFVSSSwgb3ZlcndyaXRlPzogYm9vbGVhbik6IFByb21pc2U8SUZpbGVTdGF0V2l0aE1ldGFkYXRhPjtcblxuXHQvKipcblx0ICogRmluZCBvdXQgaWYgYSBjb3B5IG9wZXJhdGlvbiBpcyBwb3NzaWJsZSBnaXZlbiB0aGUgYXJndW1lbnRzLiBObyBjaGFuZ2VzIG9uIGRpc2sgd2lsbFxuXHQgKiBiZSBwZXJmb3JtZWQuIFJldHVybnMgYW4gRXJyb3IgaWYgdGhlIG9wZXJhdGlvbiBjYW5ub3QgYmUgZG9uZS5cblx0ICovXG5cdGNhbkNvcHkoc291cmNlOiBVUkksIHRhcmdldDogVVJJLCBvdmVyd3JpdGU/OiBib29sZWFuKTogUHJvbWlzZTxFcnJvciB8IHRydWU+O1xuXG5cdC8qKlxuXHQgKiBDbG9uZXMgYSBmaWxlIHRvIGEgcGF0aCBpZGVudGlmaWVkIGJ5IHRoZSByZXNvdXJjZS4gRm9sZGVycyBhcmUgbm90IHN1cHBvcnRlZC5cblx0ICpcblx0ICogSWYgdGhlIHRhcmdldCBwYXRoIGV4aXN0cywgaXQgd2lsbCBiZSBvdmVyd3JpdHRlbi5cblx0ICovXG5cdGNsb25lRmlsZShzb3VyY2U6IFVSSSwgdGFyZ2V0OiBVUkkpOiBQcm9taXNlPHZvaWQ+O1xuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGEgbmV3IGZpbGUgd2l0aCB0aGUgZ2l2ZW4gcGF0aCBhbmQgb3B0aW9uYWwgY29udGVudHMuIFRoZSByZXR1cm5lZCBwcm9taXNlXG5cdCAqIHdpbGwgaGF2ZSB0aGUgc3RhdCBtb2RlbCBvYmplY3QgYXMgYSByZXN1bHQuXG5cdCAqXG5cdCAqIFRoZSBvcHRpb25hbCBwYXJhbWV0ZXIgY29udGVudCBjYW4gYmUgdXNlZCBhcyB2YWx1ZSB0byBmaWxsIGludG8gdGhlIG5ldyBmaWxlLlxuXHQgKlxuXHQgKiBFbWl0cyBhIGBGaWxlT3BlcmF0aW9uLkNSRUFURWAgZmlsZSBvcGVyYXRpb24gZXZlbnQgd2hlbiBzdWNjZXNzZnVsLlxuXHQgKi9cblx0Y3JlYXRlRmlsZShyZXNvdXJjZTogVVJJLCBidWZmZXJPclJlYWRhYmxlT3JTdHJlYW0/OiBWU0J1ZmZlciB8IFZTQnVmZmVyUmVhZGFibGUgfCBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtLCBvcHRpb25zPzogSUNyZWF0ZUZpbGVPcHRpb25zKTogUHJvbWlzZTxJRmlsZVN0YXRXaXRoTWV0YWRhdGE+O1xuXG5cdC8qKlxuXHQgKiBGaW5kIG91dCBpZiBhIGZpbGUgY3JlYXRlIG9wZXJhdGlvbiBpcyBwb3NzaWJsZSBnaXZlbiB0aGUgYXJndW1lbnRzLiBObyBjaGFuZ2VzIG9uIGRpc2sgd2lsbFxuXHQgKiBiZSBwZXJmb3JtZWQuIFJldHVybnMgYW4gRXJyb3IgaWYgdGhlIG9wZXJhdGlvbiBjYW5ub3QgYmUgZG9uZS5cblx0ICovXG5cdGNhbkNyZWF0ZUZpbGUocmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IElDcmVhdGVGaWxlT3B0aW9ucyk6IFByb21pc2U8RXJyb3IgfCB0cnVlPjtcblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIG5ldyBmb2xkZXIgd2l0aCB0aGUgZ2l2ZW4gcGF0aC4gVGhlIHJldHVybmVkIHByb21pc2Vcblx0ICogd2lsbCBoYXZlIHRoZSBzdGF0IG1vZGVsIG9iamVjdCBhcyBhIHJlc3VsdC5cblx0ICpcblx0ICogRW1pdHMgYSBgRmlsZU9wZXJhdGlvbi5DUkVBVEVgIGZpbGUgb3BlcmF0aW9uIGV2ZW50IHdoZW4gc3VjY2Vzc2Z1bC5cblx0ICovXG5cdGNyZWF0ZUZvbGRlcihyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxJRmlsZVN0YXRXaXRoTWV0YWRhdGE+O1xuXG5cdC8qKlxuXHQgKiBEZWxldGVzIHRoZSBwcm92aWRlZCBmaWxlLiBUaGUgb3B0aW9uYWwgdXNlVHJhc2ggcGFyYW1ldGVyIGFsbG93cyB0b1xuXHQgKiBtb3ZlIHRoZSBmaWxlIHRvIHRyYXNoLiBUaGUgb3B0aW9uYWwgcmVjdXJzaXZlIHBhcmFtZXRlciBhbGxvd3MgdG8gZGVsZXRlXG5cdCAqIG5vbi1lbXB0eSBmb2xkZXJzIHJlY3Vyc2l2ZWx5LlxuXHQgKlxuXHQgKiBFbWl0cyBhIGBGaWxlT3BlcmF0aW9uLkRFTEVURWAgZmlsZSBvcGVyYXRpb24gZXZlbnQgd2hlbiBzdWNjZXNzZnVsLlxuXHQgKi9cblx0ZGVsKHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBQYXJ0aWFsPElGaWxlRGVsZXRlT3B0aW9ucz4pOiBQcm9taXNlPHZvaWQ+O1xuXG5cdC8qKlxuXHQgKiBGaW5kIG91dCBpZiBhIGRlbGV0ZSBvcGVyYXRpb24gaXMgcG9zc2libGUgZ2l2ZW4gdGhlIGFyZ3VtZW50cy4gTm8gY2hhbmdlcyBvbiBkaXNrIHdpbGxcblx0ICogYmUgcGVyZm9ybWVkLiBSZXR1cm5zIGFuIEVycm9yIGlmIHRoZSBvcGVyYXRpb24gY2Fubm90IGJlIGRvbmUuXG5cdCAqL1xuXHRjYW5EZWxldGUocmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IFBhcnRpYWw8SUZpbGVEZWxldGVPcHRpb25zPik6IFByb21pc2U8RXJyb3IgfCB0cnVlPjtcblxuXHQvKipcblx0ICogQW4gZXZlbnQgdGhhdCBzaWduYWxzIGFuIGVycm9yIHdoZW4gd2F0Y2hpbmcgZm9yIGZpbGUgY2hhbmdlcy5cblx0ICovXG5cdHJlYWRvbmx5IG9uRGlkV2F0Y2hFcnJvcjogRXZlbnQ8RXJyb3I+O1xuXG5cdC8qKlxuXHQgKiBBbGxvd3MgdG8gc3RhcnQgYSB3YXRjaGVyIHRoYXQgcmVwb3J0cyBmaWxlL2ZvbGRlciBjaGFuZ2UgZXZlbnRzIG9uIHRoZSBwcm92aWRlZCByZXNvdXJjZS5cblx0ICpcblx0ICogVGhlIHdhdGNoZXIgcnVucyBjb3JyZWxhdGVkIGFuZCB0aHVzLCBmaWxlIGV2ZW50cyB3aWxsIGJlIHJlcG9ydGVkIG9uIHRoZSByZXR1cm5lZFxuXHQgKiBgSUZpbGVTeXN0ZW1XYXRjaGVyYCBhbmQgbm90IG9uIHRoZSBnZW5lcmljIGBJRmlsZVNlcnZpY2Uub25EaWRGaWxlc0NoYW5nZWAgZXZlbnQuXG5cdCAqXG5cdCAqIE5vdGU6IG9ubHkgbm9uLXJlY3Vyc2l2ZSBmaWxlIHdhdGNoaW5nIHN1cHBvcnRzIGV2ZW50IGNvcnJlbGF0aW9uIGZvciBub3cuXG5cdCAqL1xuXHRjcmVhdGVXYXRjaGVyKHJlc291cmNlOiBVUkksIG9wdGlvbnM6IElXYXRjaE9wdGlvbnNXaXRob3V0Q29ycmVsYXRpb24gJiB7IHJlY3Vyc2l2ZTogZmFsc2UgfSk6IElGaWxlU3lzdGVtV2F0Y2hlcjtcblxuXHQvKipcblx0ICogQWxsb3dzIHRvIHN0YXJ0IGEgd2F0Y2hlciB0aGF0IHJlcG9ydHMgZmlsZS9mb2xkZXIgY2hhbmdlIGV2ZW50cyBvbiB0aGUgcHJvdmlkZWQgcmVzb3VyY2UuXG5cdCAqXG5cdCAqIFRoZSB3YXRjaGVyIHJ1bnMgdW5jb3JyZWxhdGVkIGFuZCB0aHVzIHdpbGwgcmVwb3J0IGFsbCBldmVudHMgZnJvbSBgSUZpbGVTZXJ2aWNlLm9uRGlkRmlsZXNDaGFuZ2VgLlxuXHQgKiBUaGlzIG1lYW5zLCBtb3N0IGxpc3RlbmVycyBpbiB0aGUgYXBwbGljYXRpb24gd2lsbCByZWNlaXZlIHlvdXIgZXZlbnRzLiBJdCBpcyBlbmNvdXJhZ2VkIHRvXG5cdCAqIHVzZSBjb3JyZWxhdGVkIHdhdGNoZXJzICh2aWEgYElXYXRjaE9wdGlvbnNXaXRoQ29ycmVsYXRpb25gKSB0byBsaW1pdCBldmVudHMgdG8geW91ciBsaXN0ZW5lci5cblx0Ki9cblx0d2F0Y2gocmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IElXYXRjaE9wdGlvbnNXaXRob3V0Q29ycmVsYXRpb24pOiBJRGlzcG9zYWJsZTtcblxuXHQvKipcblx0ICogRnJlZXMgdXAgYW55IHJlc291cmNlcyBvY2N1cGllZCBieSB0aGlzIHNlcnZpY2UuXG5cdCAqL1xuXHRkaXNwb3NlKCk6IHZvaWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVPdmVyd3JpdGVPcHRpb25zIHtcblxuXHQvKipcblx0ICogU2V0IHRvIGB0cnVlYCB0byBvdmVyd3JpdGUgYSBmaWxlIGlmIGl0IGV4aXN0cy4gV2lsbFxuXHQgKiB0aHJvdyBhbiBlcnJvciBvdGhlcndpc2UgaWYgdGhlIGZpbGUgZG9lcyBleGlzdC5cblx0ICovXG5cdHJlYWRvbmx5IG92ZXJ3cml0ZTogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRmlsZVVubG9ja09wdGlvbnMge1xuXG5cdC8qKlxuXHQgKiBTZXQgdG8gYHRydWVgIHRvIHRyeSB0byByZW1vdmUgYW55IHdyaXRlIGxvY2tzIHRoZSBmaWxlIG1pZ2h0XG5cdCAqIGhhdmUuIEEgZmlsZSB0aGF0IGlzIHdyaXRlIGxvY2tlZCB3aWxsIHRocm93IGFuIGVycm9yIGZvciBhbnlcblx0ICogYXR0ZW1wdCB0byB3cml0ZSB0byB1bmxlc3MgYHVubG9jazogdHJ1ZWAgaXMgcHJvdmlkZWQuXG5cdCAqL1xuXHRyZWFkb25seSB1bmxvY2s6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVBdG9taWNSZWFkT3B0aW9ucyB7XG5cblx0LyoqXG5cdCAqIFRoZSBvcHRpb25hbCBgYXRvbWljYCBmbGFnIGNhbiBiZSB1c2VkIHRvIG1ha2Ugc3VyZVxuXHQgKiB0aGUgYHJlYWRGaWxlYCBtZXRob2QgaXMgbm90IHJ1bm5pbmcgaW4gcGFyYWxsZWwgd2l0aFxuXHQgKiBhbnkgYHdyaXRlYCBvcGVyYXRpb25zIGluIHRoZSBzYW1lIHByb2Nlc3MuXG5cdCAqXG5cdCAqIFR5cGljYWxseSB5b3Ugc2hvdWxkIG5vdCBuZWVkIHRvIHVzZSB0aGlzIGZsYWcgYnV0IGlmXG5cdCAqIGZvciBleGFtcGxlIHlvdSBhcmUgcXVpY2tseSByZWFkaW5nIGEgZmlsZSByaWdodCBhZnRlclxuXHQgKiBhIGZpbGUgZXZlbnQgb2NjdXJyZWQgYW5kIHRoZSBmaWxlIGNoYW5nZXMgYSBsb3QsIHRoZXJlXG5cdCAqIGlzIGEgY2hhbmNlIHRoYXQgYSByZWFkIHJldHVybnMgYW4gZW1wdHkgb3IgcGFydGlhbCBmaWxlXG5cdCAqIGJlY2F1c2UgYSBwZW5kaW5nIHdyaXRlIGhhcyBub3QgZmluaXNoZWQgeWV0LlxuXHQgKlxuXHQgKiBOb3RlOiB0aGlzIGRvZXMgbm90IHByZXZlbnQgdGhlIGZpbGUgZnJvbSBiZWluZyB3cml0dGVuXG5cdCAqIHRvIGZyb20gYSBkaWZmZXJlbnQgcHJvY2Vzcy4gSWYgeW91IG5lZWQgc3VjaCBhdG9taWNcblx0ICogb3BlcmF0aW9ucywgeW91IGJldHRlciB1c2UgYSByZWFsIGRhdGFiYXNlIGFzIHN0b3JhZ2UuXG5cdCAqL1xuXHRyZWFkb25seSBhdG9taWM6IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVBdG9taWNPcHRpb25zIHtcblxuXHQvKipcblx0ICogVGhlIHBvc3RmaXggaXMgdXNlZCB0byBjcmVhdGUgYSB0ZW1wb3JhcnkgZmlsZSBiYXNlZFxuXHQgKiBvbiB0aGUgb3JpZ2luYWwgcmVzb3VyY2UuIFRoZSByZXN1bHRpbmcgdGVtcG9yYXJ5XG5cdCAqIGZpbGUgd2lsbCBiZSBpbiB0aGUgc2FtZSBmb2xkZXIgYXMgdGhlIHJlc291cmNlIGFuZFxuXHQgKiBoYXZlIGBwb3N0Zml4YCBhcHBlbmRlZCB0byB0aGUgcmVzb3VyY2UgbmFtZS5cblx0ICpcblx0ICogRXhhbXBsZTogZ2l2ZW4gYSBmaWxlIHJlc291cmNlIGBmaWxlOi8vL3NvbWUvcGF0aC9mb28udHh0YFxuXHQgKiBhbmQgYSBwb3N0Zml4IGAudnNjdG1wYCwgdGhlIHRlbXBvcmFyeSBmaWxlIHdpbGwgYmVcblx0ICogY3JlYXRlZCBhcyBgZmlsZTovLy9zb21lL3BhdGgvZm9vLnR4dC52c2N0bXBgLlxuXHQgKi9cblx0cmVhZG9ubHkgcG9zdGZpeDogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlQXRvbWljV3JpdGVPcHRpb25zIHtcblxuXHQvKipcblx0ICogVGhlIG9wdGlvbmFsIGBhdG9taWNgIGZsYWcgY2FuIGJlIHVzZWQgdG8gbWFrZSBzdXJlXG5cdCAqIHRoZSBgd3JpdGVGaWxlYCBtZXRob2QgdXBkYXRlcyB0aGUgdGFyZ2V0IGZpbGUgYXRvbWljYWxseVxuXHQgKiBieSBmaXJzdCB3cml0aW5nIHRvIGEgdGVtcG9yYXJ5IGZpbGUgaW4gdGhlIHNhbWUgZm9sZGVyXG5cdCAqIGFuZCB0aGVuIHJlbmFtaW5nIGl0IG92ZXIgdGhlIHRhcmdldC5cblx0ICovXG5cdHJlYWRvbmx5IGF0b21pYzogSUZpbGVBdG9taWNPcHRpb25zIHwgZmFsc2U7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVBdG9taWNEZWxldGVPcHRpb25zIHtcblxuXHQvKipcblx0ICogVGhlIG9wdGlvbmFsIGBhdG9taWNgIGZsYWcgY2FuIGJlIHVzZWQgdG8gbWFrZSBzdXJlXG5cdCAqIHRoZSBgZGVsZXRlYCBtZXRob2QgZGVsZXRlcyB0aGUgdGFyZ2V0IGF0b21pY2FsbHkgYnlcblx0ICogZmlyc3QgcmVuYW1pbmcgaXQgdG8gYSB0ZW1wb3JhcnkgcmVzb3VyY2UgaW4gdGhlIHNhbWVcblx0ICogZm9sZGVyIGFuZCB0aGVuIGRlbGV0aW5nIGl0LlxuXHQgKi9cblx0cmVhZG9ubHkgYXRvbWljOiBJRmlsZUF0b21pY09wdGlvbnMgfCBmYWxzZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRmlsZVJlYWRMaW1pdHMge1xuXG5cdC8qKlxuXHQgKiBJZiB0aGUgZmlsZSBleGNlZWRzIHRoZSBnaXZlbiBzaXplLCBhbiBlcnJvciBvZiBraW5kXG5cdCAqIGBGSUxFX1RPT19MQVJHRWAgd2lsbCBiZSB0aHJvd24uXG5cdCAqL1xuXHRzaXplPzogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlUmVhZFN0cmVhbU9wdGlvbnMge1xuXG5cdC8qKlxuXHQgKiBJcyBhbiBpbnRlZ2VyIHNwZWNpZnlpbmcgd2hlcmUgdG8gYmVnaW4gcmVhZGluZyBmcm9tIGluIHRoZSBmaWxlLiBJZiBwb3NpdGlvbiBpcyB1bmRlZmluZWQsXG5cdCAqIGRhdGEgd2lsbCBiZSByZWFkIGZyb20gdGhlIGN1cnJlbnQgZmlsZSBwb3NpdGlvbi5cblx0ICovXG5cdHJlYWRvbmx5IHBvc2l0aW9uPzogbnVtYmVyO1xuXG5cdC8qKlxuXHQgKiBJcyBhbiBpbnRlZ2VyIHNwZWNpZnlpbmcgaG93IG1hbnkgYnl0ZXMgdG8gcmVhZCBmcm9tIHRoZSBmaWxlLiBCeSBkZWZhdWx0LCBhbGwgYnl0ZXNcblx0ICogd2lsbCBiZSByZWFkLlxuXHQgKi9cblx0cmVhZG9ubHkgbGVuZ3RoPzogbnVtYmVyO1xuXG5cdC8qKlxuXHQgKiBJZiBwcm92aWRlZCwgdGhlIHNpemUgb2YgdGhlIGZpbGUgd2lsbCBiZSBjaGVja2VkIGFnYWluc3QgdGhlIGxpbWl0c1xuXHQgKiBhbmQgYW4gZXJyb3Igd2lsbCBiZSB0aHJvd24gaWYgYW55IGxpbWl0IGlzIGV4Y2VlZGVkLlxuXHQgKi9cblx0cmVhZG9ubHkgbGltaXRzPzogSUZpbGVSZWFkTGltaXRzO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlV3JpdGVPcHRpb25zIGV4dGVuZHMgSUZpbGVPdmVyd3JpdGVPcHRpb25zLCBJRmlsZVVubG9ja09wdGlvbnMsIElGaWxlQXRvbWljV3JpdGVPcHRpb25zIHtcblxuXHQvKipcblx0ICogU2V0IHRvIGB0cnVlYCB0byBjcmVhdGUgYSBmaWxlIHdoZW4gaXQgZG9lcyBub3QgZXhpc3QuIFdpbGxcblx0ICogdGhyb3cgYW4gZXJyb3Igb3RoZXJ3aXNlIGlmIHRoZSBmaWxlIGRvZXMgbm90IGV4aXN0LlxuXHQgKi9cblx0cmVhZG9ubHkgY3JlYXRlOiBib29sZWFuO1xufVxuXG5leHBvcnQgdHlwZSBJRmlsZU9wZW5PcHRpb25zID0gSUZpbGVPcGVuRm9yUmVhZE9wdGlvbnMgfCBJRmlsZU9wZW5Gb3JXcml0ZU9wdGlvbnM7XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0ZpbGVPcGVuRm9yV3JpdGVPcHRpb25zKG9wdGlvbnM6IElGaWxlT3Blbk9wdGlvbnMpOiBvcHRpb25zIGlzIElGaWxlT3BlbkZvcldyaXRlT3B0aW9ucyB7XG5cdHJldHVybiBvcHRpb25zLmNyZWF0ZSA9PT0gdHJ1ZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRmlsZU9wZW5Gb3JSZWFkT3B0aW9ucyB7XG5cblx0LyoqXG5cdCAqIEEgaGludCB0aGF0IHRoZSBmaWxlIHNob3VsZCBiZSBvcGVuZWQgZm9yIHJlYWRpbmcgb25seS5cblx0ICovXG5cdHJlYWRvbmx5IGNyZWF0ZTogZmFsc2U7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVPcGVuRm9yV3JpdGVPcHRpb25zIGV4dGVuZHMgSUZpbGVVbmxvY2tPcHRpb25zIHtcblxuXHQvKipcblx0ICogQSBoaW50IHRoYXQgdGhlIGZpbGUgc2hvdWxkIGJlIG9wZW5lZCBmb3IgcmVhZGluZyBhbmQgd3JpdGluZy5cblx0ICovXG5cdHJlYWRvbmx5IGNyZWF0ZTogdHJ1ZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRmlsZURlbGV0ZU9wdGlvbnMge1xuXG5cdC8qKlxuXHQgKiBTZXQgdG8gYHRydWVgIHRvIHJlY3Vyc2l2ZWx5IGRlbGV0ZSBhbnkgY2hpbGRyZW4gb2YgdGhlIGZpbGUuIFRoaXNcblx0ICogb25seSBhcHBsaWVzIHRvIGZvbGRlcnMgYW5kIGNhbiBsZWFkIHRvIGFuIGVycm9yIHVubGVzcyBwcm92aWRlZFxuXHQgKiBpZiB0aGUgZm9sZGVyIGlzIG5vdCBlbXB0eS5cblx0ICovXG5cdHJlYWRvbmx5IHJlY3Vyc2l2ZTogYm9vbGVhbjtcblxuXHQvKipcblx0ICogU2V0IHRvIGB0cnVlYCB0byBhdHRlbXB0IHRvIG1vdmUgdGhlIGZpbGUgdG8gdHJhc2hcblx0ICogaW5zdGVhZCBvZiBkZWxldGluZyBpdCBwZXJtYW5lbnRseSBmcm9tIGRpc2suXG5cdCAqXG5cdCAqIFRoaXMgb3B0aW9uIG1heWJlIG5vdCBiZSBzdXBwb3J0ZWQgb24gYWxsIHByb3ZpZGVycy5cblx0ICovXG5cdHJlYWRvbmx5IHVzZVRyYXNoOiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBUaGUgb3B0aW9uYWwgYGF0b21pY2AgZmxhZyBjYW4gYmUgdXNlZCB0byBtYWtlIHN1cmVcblx0ICogdGhlIGBkZWxldGVgIG1ldGhvZCBkZWxldGVzIHRoZSB0YXJnZXQgYXRvbWljYWxseSBieVxuXHQgKiBmaXJzdCByZW5hbWluZyBpdCB0byBhIHRlbXBvcmFyeSByZXNvdXJjZSBpbiB0aGUgc2FtZVxuXHQgKiBmb2xkZXIgYW5kIHRoZW4gZGVsZXRpbmcgaXQuXG5cdCAqXG5cdCAqIFRoaXMgb3B0aW9uIG1heWJlIG5vdCBiZSBzdXBwb3J0ZWQgb24gYWxsIHByb3ZpZGVycy5cblx0ICovXG5cdHJlYWRvbmx5IGF0b21pYzogSUZpbGVBdG9taWNPcHRpb25zIHwgZmFsc2U7XG59XG5cbmV4cG9ydCBlbnVtIEZpbGVUeXBlIHtcblxuXHQvKipcblx0ICogRmlsZSBpcyB1bmtub3duIChuZWl0aGVyIGZpbGUsIGRpcmVjdG9yeSBub3Igc3ltYm9saWMgbGluaykuXG5cdCAqL1xuXHRVbmtub3duID0gMCxcblxuXHQvKipcblx0ICogRmlsZSBpcyBhIG5vcm1hbCBmaWxlLlxuXHQgKi9cblx0RmlsZSA9IDEsXG5cblx0LyoqXG5cdCAqIEZpbGUgaXMgYSBkaXJlY3RvcnkuXG5cdCAqL1xuXHREaXJlY3RvcnkgPSAyLFxuXG5cdC8qKlxuXHQgKiBGaWxlIGlzIGEgc3ltYm9saWMgbGluay5cblx0ICpcblx0ICogTm90ZTogZXZlbiB3aGVuIHRoZSBmaWxlIGlzIGEgc3ltYm9saWMgbGluaywgeW91IGNhbiB0ZXN0IGZvclxuXHQgKiBgRmlsZVR5cGUuRmlsZWAgYW5kIGBGaWxlVHlwZS5EaXJlY3RvcnlgIHRvIGtub3cgdGhlIHR5cGUgb2Zcblx0ICogdGhlIHRhcmdldCB0aGUgbGluayBwb2ludHMgdG8uXG5cdCAqL1xuXHRTeW1ib2xpY0xpbmsgPSA2NFxufVxuXG5leHBvcnQgZW51bSBGaWxlUGVybWlzc2lvbiB7XG5cblx0LyoqXG5cdCAqIEZpbGUgaXMgcmVhZG9ubHkuIENvbXBvbmVudHMgbGlrZSBlZGl0b3JzIHNob3VsZCBub3Rcblx0ICogb2ZmZXIgdG8gZWRpdCB0aGUgY29udGVudHMuXG5cdCAqL1xuXHRSZWFkb25seSA9IDEsXG5cblx0LyoqXG5cdCAqIEZpbGUgaXMgbG9ja2VkLiBDb21wb25lbnRzIGxpa2UgZWRpdG9ycyBzaG91bGQgb2ZmZXJcblx0ICogdG8gZWRpdCB0aGUgY29udGVudHMgYW5kIGFzayB0aGUgdXNlciB1cG9uIHNhdmluZyB0b1xuXHQgKiByZW1vdmUgdGhlIGxvY2suXG5cdCAqL1xuXHRMb2NrZWQgPSAyXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN0YXQge1xuXG5cdC8qKlxuXHQgKiBUaGUgZmlsZSB0eXBlLlxuXHQgKi9cblx0cmVhZG9ubHkgdHlwZTogRmlsZVR5cGU7XG5cblx0LyoqXG5cdCAqIFRoZSBsYXN0IG1vZGlmaWNhdGlvbiBkYXRlIHJlcHJlc2VudGVkIGFzIG1pbGxpcyBmcm9tIHVuaXggZXBvY2guXG5cdCAqL1xuXHRyZWFkb25seSBtdGltZTogbnVtYmVyO1xuXG5cdC8qKlxuXHQgKiBUaGUgY3JlYXRpb24gZGF0ZSByZXByZXNlbnRlZCBhcyBtaWxsaXMgZnJvbSB1bml4IGVwb2NoLlxuXHQgKi9cblx0cmVhZG9ubHkgY3RpbWU6IG51bWJlcjtcblxuXHQvKipcblx0ICogVGhlIHNpemUgb2YgdGhlIGZpbGUgaW4gYnl0ZXMuXG5cdCAqL1xuXHRyZWFkb25seSBzaXplOiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIFRoZSBmaWxlIHBlcm1pc3Npb25zLlxuXHQgKi9cblx0cmVhZG9ubHkgcGVybWlzc2lvbnM/OiBGaWxlUGVybWlzc2lvbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJV2F0Y2hPcHRpb25zV2l0aG91dENvcnJlbGF0aW9uIHtcblxuXHQvKipcblx0ICogU2V0IHRvIGB0cnVlYCB0byB3YXRjaCBmb3IgY2hhbmdlcyByZWN1cnNpdmVseSBpbiBhIGZvbGRlclxuXHQgKiBhbmQgYWxsIG9mIGl0cyBjaGlsZHJlbi5cblx0ICovXG5cdHJlY3Vyc2l2ZTogYm9vbGVhbjtcblxuXHQvKipcblx0ICogQSBzZXQgb2YgZ2xvYiBwYXR0ZXJucyBvciBwYXRocyB0byBleGNsdWRlIGZyb20gd2F0Y2hpbmcuXG5cdCAqIFBhdGhzIGNhbiBiZSByZWxhdGl2ZSBvciBhYnNvbHV0ZSBhbmQgd2hlbiByZWxhdGl2ZSBhcmVcblx0ICogcmVzb2x2ZWQgYWdhaW5zdCB0aGUgd2F0Y2hlZCBmb2xkZXIuIEdsb2IgcGF0dGVybnMgYXJlXG5cdCAqIGFsd2F5cyBtYXRjaGVkIHJlbGF0aXZlIHRvIHRoZSB3YXRjaGVkIGZvbGRlci5cblx0ICovXG5cdGV4Y2x1ZGVzOiBzdHJpbmdbXTtcblxuXHQvKipcblx0ICogQW4gb3B0aW9uYWwgc2V0IG9mIGdsb2IgcGF0dGVybnMgb3IgcGF0aHMgdG8gaW5jbHVkZSBmb3Jcblx0ICogd2F0Y2hpbmcuIElmIG5vdCBwcm92aWRlZCwgYWxsIHBhdGhzIGFyZSBjb25zaWRlcmVkIGZvclxuXHQgKiBldmVudHMuXG5cdCAqIFBhdGhzIGNhbiBiZSByZWxhdGl2ZSBvciBhYnNvbHV0ZSBhbmQgd2hlbiByZWxhdGl2ZSBhcmVcblx0ICogcmVzb2x2ZWQgYWdhaW5zdCB0aGUgd2F0Y2hlZCBmb2xkZXIuIEdsb2IgcGF0dGVybnMgYXJlXG5cdCAqIGFsd2F5cyBtYXRjaGVkIHJlbGF0aXZlIHRvIHRoZSB3YXRjaGVkIGZvbGRlci5cblx0ICovXG5cdGluY2x1ZGVzPzogQXJyYXk8c3RyaW5nIHwgSVJlbGF0aXZlUGF0dGVybj47XG5cblx0LyoqXG5cdCAqIElmIHByb3ZpZGVkLCBhbGxvd3MgdG8gZmlsdGVyIHRoZSBldmVudHMgdGhhdCB0aGUgd2F0Y2hlciBzaG91bGQgY29uc2lkZXJcblx0ICogZm9yIGVtaXR0aW5nLiBJZiBub3QgcHJvdmlkZWQsIGFsbCBldmVudHMgYXJlIGVtaXR0ZWQuXG5cdCAqXG5cdCAqIEZvciBleGFtcGxlLCB0byBlbWl0IGFkZGVkIGFuZCB1cGRhdGVkIGV2ZW50cywgc2V0IHRvOlxuXHQgKiBgRmlsZUNoYW5nZUZpbHRlci5BRERFRCB8IEZpbGVDaGFuZ2VGaWx0ZXIuVVBEQVRFRGAuXG5cdCAqL1xuXHRmaWx0ZXI/OiBGaWxlQ2hhbmdlRmlsdGVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElXYXRjaE9wdGlvbnMgZXh0ZW5kcyBJV2F0Y2hPcHRpb25zV2l0aG91dENvcnJlbGF0aW9uIHtcblxuXHQvKipcblx0ICogSWYgcHJvdmlkZWQsIGZpbGUgY2hhbmdlIGV2ZW50cyBmcm9tIHRoZSB3YXRjaGVyIHRoYXRcblx0ICogYXJlIGEgcmVzdWx0IG9mIHRoaXMgd2F0Y2ggcmVxdWVzdCB3aWxsIGNhcnJ5IHRoZSBzYW1lXG5cdCAqIGlkLlxuXHQgKi9cblx0cmVhZG9ubHkgY29ycmVsYXRpb25JZD86IG51bWJlcjtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gRmlsZUNoYW5nZUZpbHRlciB7XG5cdFVQREFURUQgPSAxIDw8IDEsXG5cdEFEREVEID0gMSA8PCAyLFxuXHRERUxFVEVEID0gMSA8PCAzXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdhdGNoT3B0aW9uc1dpdGhDb3JyZWxhdGlvbiBleHRlbmRzIElXYXRjaE9wdGlvbnMge1xuXHRyZWFkb25seSBjb3JyZWxhdGlvbklkOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVTeXN0ZW1XYXRjaGVyIGV4dGVuZHMgSURpc3Bvc2FibGUge1xuXG5cdC8qKlxuXHQgKiBBbiBldmVudCB3aGljaCBmaXJlcyBvbiBmaWxlL2ZvbGRlciBjaGFuZ2Ugb25seSBmb3IgY2hhbmdlc1xuXHQgKiB0aGF0IGNvcnJlbGF0ZSB0byB0aGUgd2F0Y2ggcmVxdWVzdCB3aXRoIG1hdGNoaW5nIGNvcnJlbGF0aW9uXG5cdCAqIGlkZW50aWZpZXIuXG5cdCAqL1xuXHRyZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8RmlsZUNoYW5nZXNFdmVudD47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0ZpbGVTeXN0ZW1XYXRjaGVyKHRoaW5nOiB1bmtub3duKTogdGhpbmcgaXMgSUZpbGVTeXN0ZW1XYXRjaGVyIHtcblx0Y29uc3QgY2FuZGlkYXRlID0gdGhpbmcgYXMgSUZpbGVTeXN0ZW1XYXRjaGVyIHwgdW5kZWZpbmVkO1xuXG5cdHJldHVybiAhIWNhbmRpZGF0ZSAmJiB0eXBlb2YgY2FuZGlkYXRlLm9uRGlkQ2hhbmdlID09PSAnZnVuY3Rpb24nO1xufVxuXG5leHBvcnQgY29uc3QgZW51bSBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMge1xuXG5cdC8qKlxuXHQgKiBObyBjYXBhYmlsaXRpZXMuXG5cdCAqL1xuXHROb25lID0gMCxcblxuXHQvKipcblx0ICogUHJvdmlkZXIgc3VwcG9ydHMgdW5idWZmZXJlZCByZWFkL3dyaXRlLlxuXHQgKi9cblx0RmlsZVJlYWRXcml0ZSA9IDEgPDwgMSxcblxuXHQvKipcblx0ICogUHJvdmlkZXIgc3VwcG9ydHMgb3Blbi9yZWFkL3dyaXRlL2Nsb3NlIGxvdyBsZXZlbCBmaWxlIG9wZXJhdGlvbnMuXG5cdCAqL1xuXHRGaWxlT3BlblJlYWRXcml0ZUNsb3NlID0gMSA8PCAyLFxuXG5cdC8qKlxuXHQgKiBQcm92aWRlciBzdXBwb3J0cyBzdHJlYW0gYmFzZWQgcmVhZGluZy5cblx0ICovXG5cdEZpbGVSZWFkU3RyZWFtID0gMSA8PCA0LFxuXG5cdC8qKlxuXHQgKiBQcm92aWRlciBzdXBwb3J0cyBjb3B5IG9wZXJhdGlvbi5cblx0ICovXG5cdEZpbGVGb2xkZXJDb3B5ID0gMSA8PCAzLFxuXG5cdC8qKlxuXHQgKiBQcm92aWRlciBpcyBwYXRoIGNhc2Ugc2Vuc2l0aXZlLlxuXHQgKi9cblx0UGF0aENhc2VTZW5zaXRpdmUgPSAxIDw8IDEwLFxuXG5cdC8qKlxuXHQgKiBBbGwgZmlsZXMgb2YgdGhlIHByb3ZpZGVyIGFyZSByZWFkb25seS5cblx0ICovXG5cdFJlYWRvbmx5ID0gMSA8PCAxMSxcblxuXHQvKipcblx0ICogUHJvdmlkZXIgc3VwcG9ydHMgdG8gZGVsZXRlIHZpYSB0cmFzaC5cblx0ICovXG5cdFRyYXNoID0gMSA8PCAxMixcblxuXHQvKipcblx0ICogUHJvdmlkZXIgc3VwcG9ydCB0byB1bmxvY2sgZmlsZXMgZm9yIHdyaXRpbmcuXG5cdCAqL1xuXHRGaWxlV3JpdGVVbmxvY2sgPSAxIDw8IDEzLFxuXG5cdC8qKlxuXHQgKiBQcm92aWRlciBzdXBwb3J0IHRvIHJlYWQgZmlsZXMgYXRvbWljYWxseS4gVGhpcyBpbXBsaWVzIHRoZVxuXHQgKiBwcm92aWRlciBwcm92aWRlcyB0aGUgYEZpbGVSZWFkV3JpdGVgIGNhcGFiaWxpdHkgdG9vLlxuXHQgKi9cblx0RmlsZUF0b21pY1JlYWQgPSAxIDw8IDE0LFxuXG5cdC8qKlxuXHQgKiBQcm92aWRlciBzdXBwb3J0IHRvIHdyaXRlIGZpbGVzIGF0b21pY2FsbHkuIFRoaXMgaW1wbGllcyB0aGVcblx0ICogcHJvdmlkZXIgcHJvdmlkZXMgdGhlIGBGaWxlUmVhZFdyaXRlYCBjYXBhYmlsaXR5IHRvby5cblx0ICovXG5cdEZpbGVBdG9taWNXcml0ZSA9IDEgPDwgMTUsXG5cblx0LyoqXG5cdCAqIFByb3ZpZGVyIHN1cHBvcnQgdG8gZGVsZXRlIGF0b21pY2FsbHkuXG5cdCAqL1xuXHRGaWxlQXRvbWljRGVsZXRlID0gMSA8PCAxNixcblxuXHQvKipcblx0ICogUHJvdmlkZXIgc3VwcG9ydCB0byBjbG9uZSBmaWxlcyBhdG9taWNhbGx5LlxuXHQgKi9cblx0RmlsZUNsb25lID0gMSA8PCAxN1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlU3lzdGVtUHJvdmlkZXIge1xuXG5cdHJlYWRvbmx5IGNhcGFiaWxpdGllczogRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUNhcGFiaWxpdGllczogRXZlbnQ8dm9pZD47XG5cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VGaWxlOiBFdmVudDxyZWFkb25seSBJRmlsZUNoYW5nZVtdPjtcblx0cmVhZG9ubHkgb25EaWRXYXRjaEVycm9yPzogRXZlbnQ8c3RyaW5nPjtcblx0d2F0Y2gocmVzb3VyY2U6IFVSSSwgb3B0czogSVdhdGNoT3B0aW9ucyk6IElEaXNwb3NhYmxlO1xuXG5cdHN0YXQocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8SVN0YXQ+O1xuXHRta2RpcihyZXNvdXJjZTogVVJJKTogUHJvbWlzZTx2b2lkPjtcblx0cmVhZGRpcihyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxbc3RyaW5nLCBGaWxlVHlwZV1bXT47XG5cdGRlbGV0ZShyZXNvdXJjZTogVVJJLCBvcHRzOiBJRmlsZURlbGV0ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+O1xuXG5cdHJlbmFtZShmcm9tOiBVUkksIHRvOiBVUkksIG9wdHM6IElGaWxlT3ZlcndyaXRlT3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG5cdGNvcHk/KGZyb206IFVSSSwgdG86IFVSSSwgb3B0czogSUZpbGVPdmVyd3JpdGVPcHRpb25zKTogUHJvbWlzZTx2b2lkPjtcblxuXHRyZWFkRmlsZT8ocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8VWludDhBcnJheT47XG5cdHdyaXRlRmlsZT8ocmVzb3VyY2U6IFVSSSwgY29udGVudDogVWludDhBcnJheSwgb3B0czogSUZpbGVXcml0ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+O1xuXG5cdHJlYWRGaWxlU3RyZWFtPyhyZXNvdXJjZTogVVJJLCBvcHRzOiBJRmlsZVJlYWRTdHJlYW1PcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBSZWFkYWJsZVN0cmVhbUV2ZW50czxVaW50OEFycmF5PjtcblxuXHRvcGVuPyhyZXNvdXJjZTogVVJJLCBvcHRzOiBJRmlsZU9wZW5PcHRpb25zKTogUHJvbWlzZTxudW1iZXI+O1xuXHRjbG9zZT8oZmQ6IG51bWJlcik6IFByb21pc2U8dm9pZD47XG5cdHJlYWQ/KGZkOiBudW1iZXIsIHBvczogbnVtYmVyLCBkYXRhOiBVaW50OEFycmF5LCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpOiBQcm9taXNlPG51bWJlcj47XG5cdHdyaXRlPyhmZDogbnVtYmVyLCBwb3M6IG51bWJlciwgZGF0YTogVWludDhBcnJheSwgb2Zmc2V0OiBudW1iZXIsIGxlbmd0aDogbnVtYmVyKTogUHJvbWlzZTxudW1iZXI+O1xuXG5cdGNsb25lRmlsZT8oZnJvbTogVVJJLCB0bzogVVJJKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVSZWFkV3JpdGVDYXBhYmlsaXR5IGV4dGVuZHMgSUZpbGVTeXN0ZW1Qcm92aWRlciB7XG5cdHJlYWRGaWxlKHJlc291cmNlOiBVUkkpOiBQcm9taXNlPFVpbnQ4QXJyYXk+O1xuXHR3cml0ZUZpbGUocmVzb3VyY2U6IFVSSSwgY29udGVudDogVWludDhBcnJheSwgb3B0czogSUZpbGVXcml0ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaGFzUmVhZFdyaXRlQ2FwYWJpbGl0eShwcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlcik6IHByb3ZpZGVyIGlzIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZVJlYWRXcml0ZUNhcGFiaWxpdHkge1xuXHRyZXR1cm4gISEocHJvdmlkZXIuY2FwYWJpbGl0aWVzICYgRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLkZpbGVSZWFkV3JpdGUpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZUZvbGRlckNvcHlDYXBhYmlsaXR5IGV4dGVuZHMgSUZpbGVTeXN0ZW1Qcm92aWRlciB7XG5cdGNvcHkoZnJvbTogVVJJLCB0bzogVVJJLCBvcHRzOiBJRmlsZU92ZXJ3cml0ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaGFzRmlsZUZvbGRlckNvcHlDYXBhYmlsaXR5KHByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyKTogcHJvdmlkZXIgaXMgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlRm9sZGVyQ29weUNhcGFiaWxpdHkge1xuXHRyZXR1cm4gISEocHJvdmlkZXIuY2FwYWJpbGl0aWVzICYgRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLkZpbGVGb2xkZXJDb3B5KTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVDbG9uZUNhcGFiaWxpdHkgZXh0ZW5kcyBJRmlsZVN5c3RlbVByb3ZpZGVyIHtcblx0Y2xvbmVGaWxlKGZyb206IFVSSSwgdG86IFVSSSk6IFByb21pc2U8dm9pZD47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBoYXNGaWxlQ2xvbmVDYXBhYmlsaXR5KHByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyKTogcHJvdmlkZXIgaXMgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlQ2xvbmVDYXBhYmlsaXR5IHtcblx0cmV0dXJuICEhKHByb3ZpZGVyLmNhcGFiaWxpdGllcyAmIEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5GaWxlQ2xvbmUpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoT3BlblJlYWRXcml0ZUNsb3NlQ2FwYWJpbGl0eSBleHRlbmRzIElGaWxlU3lzdGVtUHJvdmlkZXIge1xuXHRvcGVuKHJlc291cmNlOiBVUkksIG9wdHM6IElGaWxlT3Blbk9wdGlvbnMpOiBQcm9taXNlPG51bWJlcj47XG5cdGNsb3NlKGZkOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+O1xuXHRyZWFkKGZkOiBudW1iZXIsIHBvczogbnVtYmVyLCBkYXRhOiBVaW50OEFycmF5LCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpOiBQcm9taXNlPG51bWJlcj47XG5cdHdyaXRlKGZkOiBudW1iZXIsIHBvczogbnVtYmVyLCBkYXRhOiBVaW50OEFycmF5LCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpOiBQcm9taXNlPG51bWJlcj47XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBoYXNPcGVuUmVhZFdyaXRlQ2xvc2VDYXBhYmlsaXR5KHByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyKTogcHJvdmlkZXIgaXMgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhPcGVuUmVhZFdyaXRlQ2xvc2VDYXBhYmlsaXR5IHtcblx0cmV0dXJuICEhKHByb3ZpZGVyLmNhcGFiaWxpdGllcyAmIEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5GaWxlT3BlblJlYWRXcml0ZUNsb3NlKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVSZWFkU3RyZWFtQ2FwYWJpbGl0eSBleHRlbmRzIElGaWxlU3lzdGVtUHJvdmlkZXIge1xuXHRyZWFkRmlsZVN0cmVhbShyZXNvdXJjZTogVVJJLCBvcHRzOiBJRmlsZVJlYWRTdHJlYW1PcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBSZWFkYWJsZVN0cmVhbUV2ZW50czxVaW50OEFycmF5Pjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhhc0ZpbGVSZWFkU3RyZWFtQ2FwYWJpbGl0eShwcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlcik6IHByb3ZpZGVyIGlzIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZVJlYWRTdHJlYW1DYXBhYmlsaXR5IHtcblx0cmV0dXJuICEhKHByb3ZpZGVyLmNhcGFiaWxpdGllcyAmIEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5GaWxlUmVhZFN0cmVhbSk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlQXRvbWljUmVhZENhcGFiaWxpdHkgZXh0ZW5kcyBJRmlsZVN5c3RlbVByb3ZpZGVyIHtcblx0cmVhZEZpbGUocmVzb3VyY2U6IFVSSSwgb3B0cz86IElGaWxlQXRvbWljUmVhZE9wdGlvbnMpOiBQcm9taXNlPFVpbnQ4QXJyYXk+O1xuXHRlbmZvcmNlQXRvbWljUmVhZEZpbGU/KHJlc291cmNlOiBVUkkpOiBib29sZWFuO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaGFzRmlsZUF0b21pY1JlYWRDYXBhYmlsaXR5KHByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyKTogcHJvdmlkZXIgaXMgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlQXRvbWljUmVhZENhcGFiaWxpdHkge1xuXHRpZiAoIWhhc1JlYWRXcml0ZUNhcGFiaWxpdHkocHJvdmlkZXIpKSB7XG5cdFx0cmV0dXJuIGZhbHNlOyAvLyB3ZSByZXF1aXJlIHRoZSBgRmlsZVJlYWRXcml0ZWAgY2FwYWJpbGl0eSB0b29cblx0fVxuXG5cdHJldHVybiAhIShwcm92aWRlci5jYXBhYmlsaXRpZXMgJiBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuRmlsZUF0b21pY1JlYWQpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZUF0b21pY1dyaXRlQ2FwYWJpbGl0eSBleHRlbmRzIElGaWxlU3lzdGVtUHJvdmlkZXIge1xuXHR3cml0ZUZpbGUocmVzb3VyY2U6IFVSSSwgY29udGVudHM6IFVpbnQ4QXJyYXksIG9wdHM/OiBJRmlsZUF0b21pY1dyaXRlT3B0aW9ucyk6IFByb21pc2U8dm9pZD47XG5cdGVuZm9yY2VBdG9taWNXcml0ZUZpbGU/KHJlc291cmNlOiBVUkkpOiBJRmlsZUF0b21pY09wdGlvbnMgfCBmYWxzZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGhhc0ZpbGVBdG9taWNXcml0ZUNhcGFiaWxpdHkocHJvdmlkZXI6IElGaWxlU3lzdGVtUHJvdmlkZXIpOiBwcm92aWRlciBpcyBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVBdG9taWNXcml0ZUNhcGFiaWxpdHkge1xuXHRpZiAoIWhhc1JlYWRXcml0ZUNhcGFiaWxpdHkocHJvdmlkZXIpKSB7XG5cdFx0cmV0dXJuIGZhbHNlOyAvLyB3ZSByZXF1aXJlIHRoZSBgRmlsZVJlYWRXcml0ZWAgY2FwYWJpbGl0eSB0b29cblx0fVxuXG5cdHJldHVybiAhIShwcm92aWRlci5jYXBhYmlsaXRpZXMgJiBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuRmlsZUF0b21pY1dyaXRlKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVBdG9taWNEZWxldGVDYXBhYmlsaXR5IGV4dGVuZHMgSUZpbGVTeXN0ZW1Qcm92aWRlciB7XG5cdGRlbGV0ZShyZXNvdXJjZTogVVJJLCBvcHRzOiBJRmlsZUF0b21pY0RlbGV0ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+O1xuXHRlbmZvcmNlQXRvbWljRGVsZXRlPyhyZXNvdXJjZTogVVJJKTogSUZpbGVBdG9taWNPcHRpb25zIHwgZmFsc2U7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBoYXNGaWxlQXRvbWljRGVsZXRlQ2FwYWJpbGl0eShwcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlcik6IHByb3ZpZGVyIGlzIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZUF0b21pY0RlbGV0ZUNhcGFiaWxpdHkge1xuXHRyZXR1cm4gISEocHJvdmlkZXIuY2FwYWJpbGl0aWVzICYgRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLkZpbGVBdG9taWNEZWxldGUpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoUmVhZG9ubHlDYXBhYmlsaXR5IGV4dGVuZHMgSUZpbGVTeXN0ZW1Qcm92aWRlciB7XG5cblx0cmVhZG9ubHkgY2FwYWJpbGl0aWVzOiBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuUmVhZG9ubHkgJiBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXM7XG5cblx0LyoqXG5cdCAqIEFuIG9wdGlvbmFsIG1lc3NhZ2UgdG8gc2hvdyBpbiB0aGUgVUkgdG8gZXhwbGFpbiB3aHkgdGhlIGZpbGUgc3lzdGVtIGlzIHJlYWRvbmx5LlxuXHQgKi9cblx0cmVhZG9ubHkgcmVhZE9ubHlNZXNzYWdlPzogSU1hcmtkb3duU3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaGFzUmVhZG9ubHlDYXBhYmlsaXR5KHByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyKTogcHJvdmlkZXIgaXMgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhSZWFkb25seUNhcGFiaWxpdHkge1xuXHRyZXR1cm4gISEocHJvdmlkZXIuY2FwYWJpbGl0aWVzICYgRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLlJlYWRvbmx5KTtcbn1cblxuZXhwb3J0IGVudW0gRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlIHtcblx0RmlsZUV4aXN0cyA9ICdFbnRyeUV4aXN0cycsXG5cdEZpbGVOb3RGb3VuZCA9ICdFbnRyeU5vdEZvdW5kJyxcblx0RmlsZU5vdEFEaXJlY3RvcnkgPSAnRW50cnlOb3RBRGlyZWN0b3J5Jyxcblx0RmlsZUlzQURpcmVjdG9yeSA9ICdFbnRyeUlzQURpcmVjdG9yeScsXG5cdEZpbGVFeGNlZWRzU3RvcmFnZVF1b3RhID0gJ0VudHJ5RXhjZWVkc1N0b3JhZ2VRdW90YScsXG5cdEZpbGVUb29MYXJnZSA9ICdFbnRyeVRvb0xhcmdlJyxcblx0RmlsZVdyaXRlTG9ja2VkID0gJ0VudHJ5V3JpdGVMb2NrZWQnLFxuXHROb1Blcm1pc3Npb25zID0gJ05vUGVybWlzc2lvbnMnLFxuXHRVbmF2YWlsYWJsZSA9ICdVbmF2YWlsYWJsZScsXG5cdFVua25vd24gPSAnVW5rbm93bidcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG5cdHJlYWRvbmx5IG5hbWU6IHN0cmluZztcblx0cmVhZG9ubHkgY29kZTogRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlO1xufVxuXG5leHBvcnQgY2xhc3MgRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3IgZXh0ZW5kcyBFcnJvciBpbXBsZW1lbnRzIElGaWxlU3lzdGVtUHJvdmlkZXJFcnJvciB7XG5cblx0c3RhdGljIGNyZWF0ZShlcnJvcjogRXJyb3IgfCBzdHJpbmcsIGNvZGU6IEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZSk6IEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yIHtcblx0XHRjb25zdCBwcm92aWRlckVycm9yID0gbmV3IEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yKGVycm9yLnRvU3RyaW5nKCksIGNvZGUpO1xuXHRcdG1hcmtBc0ZpbGVTeXN0ZW1Qcm92aWRlckVycm9yKHByb3ZpZGVyRXJyb3IsIGNvZGUpO1xuXG5cdFx0cmV0dXJuIHByb3ZpZGVyRXJyb3I7XG5cdH1cblxuXHRwcml2YXRlIGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZywgcmVhZG9ubHkgY29kZTogRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlKSB7XG5cdFx0c3VwZXIobWVzc2FnZSk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUZpbGVTeXN0ZW1Qcm92aWRlckVycm9yKGVycm9yOiBFcnJvciB8IHN0cmluZywgY29kZTogRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlKTogRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3Ige1xuXHRyZXR1cm4gRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3IuY3JlYXRlKGVycm9yLCBjb2RlKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVuc3VyZUZpbGVTeXN0ZW1Qcm92aWRlckVycm9yKGVycm9yPzogRXJyb3IpOiBFcnJvciB7XG5cdGlmICghZXJyb3IpIHtcblx0XHRyZXR1cm4gY3JlYXRlRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3IobG9jYWxpemUoJ3Vua25vd25FcnJvcicsIFwiVW5rbm93biBFcnJvclwiKSwgRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLlVua25vd24pOyAvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNzI3OThcblx0fVxuXG5cdHJldHVybiBlcnJvcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hcmtBc0ZpbGVTeXN0ZW1Qcm92aWRlckVycm9yKGVycm9yOiBFcnJvciwgY29kZTogRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlKTogRXJyb3Ige1xuXHRlcnJvci5uYW1lID0gY29kZSA/IGAke2NvZGV9IChGaWxlU3lzdGVtRXJyb3IpYCA6IGBGaWxlU3lzdGVtRXJyb3JgO1xuXG5cdHJldHVybiBlcnJvcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHRvRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlKGVycm9yOiBFcnJvciB8IHVuZGVmaW5lZCB8IG51bGwpOiBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvckNvZGUge1xuXG5cdC8vIEd1YXJkIGFnYWluc3QgYWJ1c2Vcblx0aWYgKCFlcnJvcikge1xuXHRcdHJldHVybiBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvckNvZGUuVW5rbm93bjtcblx0fVxuXG5cdC8vIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yIGNvbWVzIHdpdGggdGhlIGNvZGVcblx0aWYgKGVycm9yIGluc3RhbmNlb2YgRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3IpIHtcblx0XHRyZXR1cm4gZXJyb3IuY29kZTtcblx0fVxuXG5cdC8vIEFueSBvdGhlciBlcnJvciwgY2hlY2sgZm9yIG5hbWUgbWF0Y2ggYnkgYXNzdW1pbmcgdGhhdCB0aGUgZXJyb3Jcblx0Ly8gd2VudCB0aHJvdWdoIHRoZSBtYXJrQXNGaWxlU3lzdGVtUHJvdmlkZXJFcnJvcigpIG1ldGhvZFxuXHRjb25zdCBtYXRjaCA9IC9eKC4rKSBcXChGaWxlU3lzdGVtRXJyb3JcXCkkLy5leGVjKGVycm9yLm5hbWUpO1xuXHRpZiAoIW1hdGNoKSB7XG5cdFx0cmV0dXJuIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5Vbmtub3duO1xuXHR9XG5cblx0c3dpdGNoIChtYXRjaFsxXSkge1xuXHRcdGNhc2UgRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLkZpbGVFeGlzdHM6IHJldHVybiBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvckNvZGUuRmlsZUV4aXN0cztcblx0XHRjYXNlIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5GaWxlSXNBRGlyZWN0b3J5OiByZXR1cm4gRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLkZpbGVJc0FEaXJlY3Rvcnk7XG5cdFx0Y2FzZSBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvckNvZGUuRmlsZU5vdEFEaXJlY3Rvcnk6IHJldHVybiBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvckNvZGUuRmlsZU5vdEFEaXJlY3Rvcnk7XG5cdFx0Y2FzZSBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvckNvZGUuRmlsZU5vdEZvdW5kOiByZXR1cm4gRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLkZpbGVOb3RGb3VuZDtcblx0XHRjYXNlIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5GaWxlVG9vTGFyZ2U6IHJldHVybiBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvckNvZGUuRmlsZVRvb0xhcmdlO1xuXHRcdGNhc2UgRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLkZpbGVXcml0ZUxvY2tlZDogcmV0dXJuIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5GaWxlV3JpdGVMb2NrZWQ7XG5cdFx0Y2FzZSBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvckNvZGUuTm9QZXJtaXNzaW9uczogcmV0dXJuIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5Ob1Blcm1pc3Npb25zO1xuXHRcdGNhc2UgRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLlVuYXZhaWxhYmxlOiByZXR1cm4gRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLlVuYXZhaWxhYmxlO1xuXHR9XG5cblx0cmV0dXJuIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5Vbmtub3duO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9GaWxlT3BlcmF0aW9uUmVzdWx0KGVycm9yOiBFcnJvcik6IEZpbGVPcGVyYXRpb25SZXN1bHQge1xuXG5cdC8vIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yIGNvbWVzIHdpdGggdGhlIHJlc3VsdCBhbHJlYWR5XG5cdGlmIChlcnJvciBpbnN0YW5jZW9mIEZpbGVPcGVyYXRpb25FcnJvcikge1xuXHRcdHJldHVybiBlcnJvci5maWxlT3BlcmF0aW9uUmVzdWx0O1xuXHR9XG5cblx0Ly8gT3RoZXJ3aXNlIHRyeSB0byBmaW5kIGZyb20gY29kZVxuXHRzd2l0Y2ggKHRvRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlKGVycm9yKSkge1xuXHRcdGNhc2UgRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLkZpbGVOb3RGb3VuZDpcblx0XHRcdHJldHVybiBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTk9UX0ZPVU5EO1xuXHRcdGNhc2UgRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLkZpbGVJc0FEaXJlY3Rvcnk6XG5cdFx0XHRyZXR1cm4gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX0lTX0RJUkVDVE9SWTtcblx0XHRjYXNlIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5GaWxlTm90QURpcmVjdG9yeTpcblx0XHRcdHJldHVybiBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTk9UX0RJUkVDVE9SWTtcblx0XHRjYXNlIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5GaWxlV3JpdGVMb2NrZWQ6XG5cdFx0XHRyZXR1cm4gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX1dSSVRFX0xPQ0tFRDtcblx0XHRjYXNlIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5Ob1Blcm1pc3Npb25zOlxuXHRcdFx0cmV0dXJuIEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9QRVJNSVNTSU9OX0RFTklFRDtcblx0XHRjYXNlIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5GaWxlRXhpc3RzOlxuXHRcdFx0cmV0dXJuIEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9NT1ZFX0NPTkZMSUNUO1xuXHRcdGNhc2UgRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLkZpbGVUb29MYXJnZTpcblx0XHRcdHJldHVybiBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfVE9PX0xBUkdFO1xuXHRcdGRlZmF1bHQ6XG5cdFx0XHRyZXR1cm4gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX09USEVSX0VSUk9SO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVTeXN0ZW1Qcm92aWRlclJlZ2lzdHJhdGlvbkV2ZW50IHtcblx0cmVhZG9ubHkgYWRkZWQ6IGJvb2xlYW47XG5cdHJlYWRvbmx5IHNjaGVtZTogc3RyaW5nO1xuXHRyZWFkb25seSBwcm92aWRlcj86IElGaWxlU3lzdGVtUHJvdmlkZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllc0NoYW5nZUV2ZW50IHtcblx0cmVhZG9ubHkgcHJvdmlkZXI6IElGaWxlU3lzdGVtUHJvdmlkZXI7XG5cdHJlYWRvbmx5IHNjaGVtZTogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlU3lzdGVtUHJvdmlkZXJBY3RpdmF0aW9uRXZlbnQge1xuXHRyZWFkb25seSBzY2hlbWU6IHN0cmluZztcblx0am9pbihwcm9taXNlOiBQcm9taXNlPHZvaWQ+KTogdm9pZDtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gRmlsZU9wZXJhdGlvbiB7XG5cdENSRUFURSxcblx0REVMRVRFLFxuXHRNT1ZFLFxuXHRDT1BZLFxuXHRXUklURVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlT3BlcmF0aW9uRXZlbnQge1xuXG5cdHJlYWRvbmx5IHJlc291cmNlOiBVUkk7XG5cdHJlYWRvbmx5IG9wZXJhdGlvbjogRmlsZU9wZXJhdGlvbjtcblxuXHRpc09wZXJhdGlvbihvcGVyYXRpb246IEZpbGVPcGVyYXRpb24uREVMRVRFIHwgRmlsZU9wZXJhdGlvbi5XUklURSk6IGJvb2xlYW47XG5cdGlzT3BlcmF0aW9uKG9wZXJhdGlvbjogRmlsZU9wZXJhdGlvbi5DUkVBVEUgfCBGaWxlT3BlcmF0aW9uLk1PVkUgfCBGaWxlT3BlcmF0aW9uLkNPUFkpOiB0aGlzIGlzIElGaWxlT3BlcmF0aW9uRXZlbnRXaXRoTWV0YWRhdGE7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVPcGVyYXRpb25FdmVudFdpdGhNZXRhZGF0YSBleHRlbmRzIElGaWxlT3BlcmF0aW9uRXZlbnQge1xuXHRyZWFkb25seSB0YXJnZXQ6IElGaWxlU3RhdFdpdGhNZXRhZGF0YTtcbn1cblxuZXhwb3J0IGNsYXNzIEZpbGVPcGVyYXRpb25FdmVudCBpbXBsZW1lbnRzIElGaWxlT3BlcmF0aW9uRXZlbnQge1xuXG5cdGNvbnN0cnVjdG9yKHJlc291cmNlOiBVUkksIG9wZXJhdGlvbjogRmlsZU9wZXJhdGlvbi5ERUxFVEUgfCBGaWxlT3BlcmF0aW9uLldSSVRFKTtcblx0Y29uc3RydWN0b3IocmVzb3VyY2U6IFVSSSwgb3BlcmF0aW9uOiBGaWxlT3BlcmF0aW9uLkNSRUFURSB8IEZpbGVPcGVyYXRpb24uTU9WRSB8IEZpbGVPcGVyYXRpb24uQ09QWSwgdGFyZ2V0OiBJRmlsZVN0YXRXaXRoTWV0YWRhdGEpO1xuXHRjb25zdHJ1Y3RvcihyZWFkb25seSByZXNvdXJjZTogVVJJLCByZWFkb25seSBvcGVyYXRpb246IEZpbGVPcGVyYXRpb24sIHJlYWRvbmx5IHRhcmdldD86IElGaWxlU3RhdFdpdGhNZXRhZGF0YSkgeyB9XG5cblx0aXNPcGVyYXRpb24ob3BlcmF0aW9uOiBGaWxlT3BlcmF0aW9uLkRFTEVURSB8IEZpbGVPcGVyYXRpb24uV1JJVEUpOiBib29sZWFuO1xuXHRpc09wZXJhdGlvbihvcGVyYXRpb246IEZpbGVPcGVyYXRpb24uQ1JFQVRFIHwgRmlsZU9wZXJhdGlvbi5NT1ZFIHwgRmlsZU9wZXJhdGlvbi5DT1BZKTogdGhpcyBpcyBJRmlsZU9wZXJhdGlvbkV2ZW50V2l0aE1ldGFkYXRhO1xuXHRpc09wZXJhdGlvbihvcGVyYXRpb246IEZpbGVPcGVyYXRpb24pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5vcGVyYXRpb24gPT09IG9wZXJhdGlvbjtcblx0fVxufVxuXG4vKipcbiAqIFBvc3NpYmxlIGNoYW5nZXMgdGhhdCBjYW4gb2NjdXIgdG8gYSBmaWxlLlxuICovXG5leHBvcnQgY29uc3QgZW51bSBGaWxlQ2hhbmdlVHlwZSB7XG5cdFVQREFURUQsXG5cdEFEREVELFxuXHRERUxFVEVEXG59XG5cbi8qKlxuICogSWRlbnRpZmllcyBhIHNpbmdsZSBjaGFuZ2UgaW4gYSBmaWxlLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlQ2hhbmdlIHtcblxuXHQvKipcblx0ICogVGhlIHR5cGUgb2YgY2hhbmdlIHRoYXQgb2NjdXJyZWQgdG8gdGhlIGZpbGUuXG5cdCAqL1xuXHR0eXBlOiBGaWxlQ2hhbmdlVHlwZTtcblxuXHQvKipcblx0ICogVGhlIHVuaWZpZWQgcmVzb3VyY2UgaWRlbnRpZmllciBvZiB0aGUgZmlsZSB0aGF0IGNoYW5nZWQuXG5cdCAqL1xuXHRyZWFkb25seSByZXNvdXJjZTogVVJJO1xuXG5cdC8qKlxuXHQgKiBJZiBwcm92aWRlZCB3aGVuIHN0YXJ0aW5nIHRoZSBmaWxlIHdhdGNoZXIsIHRoZSBjb3JyZWxhdGlvblxuXHQgKiBpZGVudGlmaWVyIHdpbGwgbWF0Y2ggdGhlIG9yaWdpbmFsIGZpbGUgd2F0Y2hpbmcgcmVxdWVzdCBhc1xuXHQgKiBhIHdheSB0byBpZGVudGlmeSB0aGUgb3JpZ2luYWwgY29tcG9uZW50IHRoYXQgaXMgaW50ZXJlc3RlZFxuXHQgKiBpbiB0aGUgY2hhbmdlLlxuXHQgKi9cblx0cmVhZG9ubHkgY0lkPzogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgRmlsZUNoYW5nZXNFdmVudCB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgTUlYRURfQ09SUkVMQVRJT04gPSBudWxsO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgY29ycmVsYXRpb25JZDogbnVtYmVyIHwgdW5kZWZpbmVkIHwgdHlwZW9mIEZpbGVDaGFuZ2VzRXZlbnQuTUlYRURfQ09SUkVMQVRJT04gPSB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoY2hhbmdlczogcmVhZG9ubHkgSUZpbGVDaGFuZ2VbXSwgcHJpdmF0ZSByZWFkb25seSBpZ25vcmVQYXRoQ2FzaW5nOiBib29sZWFuKSB7XG5cdFx0Zm9yIChjb25zdCBjaGFuZ2Ugb2YgY2hhbmdlcykge1xuXG5cdFx0XHQvLyBTcGxpdCBieSB0eXBlXG5cdFx0XHRzd2l0Y2ggKGNoYW5nZS50eXBlKSB7XG5cdFx0XHRcdGNhc2UgRmlsZUNoYW5nZVR5cGUuQURERUQ6XG5cdFx0XHRcdFx0dGhpcy5yYXdBZGRlZC5wdXNoKGNoYW5nZS5yZXNvdXJjZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgRmlsZUNoYW5nZVR5cGUuVVBEQVRFRDpcblx0XHRcdFx0XHR0aGlzLnJhd1VwZGF0ZWQucHVzaChjaGFuZ2UucmVzb3VyY2UpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQ6XG5cdFx0XHRcdFx0dGhpcy5yYXdEZWxldGVkLnB1c2goY2hhbmdlLnJlc291cmNlKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblxuXHRcdFx0Ly8gRmlndXJlIG91dCBldmVudHMgY29ycmVsYXRpb25cblx0XHRcdGlmICh0aGlzLmNvcnJlbGF0aW9uSWQgIT09IEZpbGVDaGFuZ2VzRXZlbnQuTUlYRURfQ09SUkVMQVRJT04pIHtcblx0XHRcdFx0aWYgKHR5cGVvZiBjaGFuZ2UuY0lkID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdGlmICh0aGlzLmNvcnJlbGF0aW9uSWQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0dGhpcy5jb3JyZWxhdGlvbklkID0gY2hhbmdlLmNJZDsgXHRcdFx0XHRcdFx0XHQvLyBjb3JyZWxhdGlvbiBub3QgeWV0IHNldCwganVzdCB0YWtlIGl0XG5cdFx0XHRcdFx0fSBlbHNlIGlmICh0aGlzLmNvcnJlbGF0aW9uSWQgIT09IGNoYW5nZS5jSWQpIHtcblx0XHRcdFx0XHRcdHRoaXMuY29ycmVsYXRpb25JZCA9IEZpbGVDaGFuZ2VzRXZlbnQuTUlYRURfQ09SUkVMQVRJT047XHQvLyBjb3JyZWxhdGlvbiBtaXNtYXRjaCwgd2UgaGF2ZSBtaXhlZCBjb3JyZWxhdGlvblxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAodGhpcy5jb3JyZWxhdGlvbklkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdHRoaXMuY29ycmVsYXRpb25JZCA9IEZpbGVDaGFuZ2VzRXZlbnQuTUlYRURfQ09SUkVMQVRJT047XHQvLyBjb3JyZWxhdGlvbiBtaXNtYXRjaCwgd2UgaGF2ZSBtaXhlZCBjb3JyZWxhdGlvblxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgYWRkZWQgPSBuZXcgTGF6eSgoKSA9PiB7XG5cdFx0Y29uc3QgYWRkZWQgPSBUZXJuYXJ5U2VhcmNoVHJlZS5mb3JVcmlzPGJvb2xlYW4+KCgpID0+IHRoaXMuaWdub3JlUGF0aENhc2luZyk7XG5cdFx0YWRkZWQuZmlsbCh0aGlzLnJhd0FkZGVkLm1hcChyZXNvdXJjZSA9PiBbcmVzb3VyY2UsIHRydWVdKSk7XG5cblx0XHRyZXR1cm4gYWRkZWQ7XG5cdH0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgdXBkYXRlZCA9IG5ldyBMYXp5KCgpID0+IHtcblx0XHRjb25zdCB1cGRhdGVkID0gVGVybmFyeVNlYXJjaFRyZWUuZm9yVXJpczxib29sZWFuPigoKSA9PiB0aGlzLmlnbm9yZVBhdGhDYXNpbmcpO1xuXHRcdHVwZGF0ZWQuZmlsbCh0aGlzLnJhd1VwZGF0ZWQubWFwKHJlc291cmNlID0+IFtyZXNvdXJjZSwgdHJ1ZV0pKTtcblxuXHRcdHJldHVybiB1cGRhdGVkO1xuXHR9KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGRlbGV0ZWQgPSBuZXcgTGF6eSgoKSA9PiB7XG5cdFx0Y29uc3QgZGVsZXRlZCA9IFRlcm5hcnlTZWFyY2hUcmVlLmZvclVyaXM8Ym9vbGVhbj4oKCkgPT4gdGhpcy5pZ25vcmVQYXRoQ2FzaW5nKTtcblx0XHRkZWxldGVkLmZpbGwodGhpcy5yYXdEZWxldGVkLm1hcChyZXNvdXJjZSA9PiBbcmVzb3VyY2UsIHRydWVdKSk7XG5cblx0XHRyZXR1cm4gZGVsZXRlZDtcblx0fSk7XG5cblx0LyoqXG5cdCAqIEZpbmQgb3V0IGlmIHRoZSBmaWxlIGNoYW5nZSBldmVudHMgbWF0Y2ggdGhlIHByb3ZpZGVkIHJlc291cmNlLlxuXHQgKlxuXHQgKiBOb3RlOiB3aGVuIHBhc3NpbmcgYEZpbGVDaGFuZ2VUeXBlLkRFTEVURURgLCB3ZSBjb25zaWRlciBhIG1hdGNoXG5cdCAqIGFsc28gd2hlbiB0aGUgcGFyZW50IG9mIHRoZSByZXNvdXJjZSBnb3QgZGVsZXRlZC5cblx0ICovXG5cdGNvbnRhaW5zKHJlc291cmNlOiBVUkksIC4uLnR5cGVzOiBGaWxlQ2hhbmdlVHlwZVtdKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuZG9Db250YWlucyhyZXNvdXJjZSwgeyBpbmNsdWRlQ2hpbGRyZW46IGZhbHNlIH0sIC4uLnR5cGVzKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBGaW5kIG91dCBpZiB0aGUgZmlsZSBjaGFuZ2UgZXZlbnRzIGVpdGhlciBtYXRjaCB0aGUgcHJvdmlkZWRcblx0ICogcmVzb3VyY2UsIG9yIGNvbnRhaW4gYSBjaGlsZCBvZiB0aGlzIHJlc291cmNlLlxuXHQgKi9cblx0YWZmZWN0cyhyZXNvdXJjZTogVVJJLCAuLi50eXBlczogRmlsZUNoYW5nZVR5cGVbXSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmRvQ29udGFpbnMocmVzb3VyY2UsIHsgaW5jbHVkZUNoaWxkcmVuOiB0cnVlIH0sIC4uLnR5cGVzKTtcblx0fVxuXG5cdHByaXZhdGUgZG9Db250YWlucyhyZXNvdXJjZTogVVJJLCBvcHRpb25zOiB7IGluY2x1ZGVDaGlsZHJlbjogYm9vbGVhbiB9LCAuLi50eXBlczogRmlsZUNoYW5nZVR5cGVbXSk6IGJvb2xlYW4ge1xuXHRcdGlmICghcmVzb3VyY2UpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBoYXNUeXBlc0ZpbHRlciA9IHR5cGVzLmxlbmd0aCA+IDA7XG5cblx0XHQvLyBBZGRlZFxuXHRcdGlmICghaGFzVHlwZXNGaWx0ZXIgfHwgdHlwZXMuaW5jbHVkZXMoRmlsZUNoYW5nZVR5cGUuQURERUQpKSB7XG5cdFx0XHRpZiAodGhpcy5hZGRlZC52YWx1ZS5nZXQocmVzb3VyY2UpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAob3B0aW9ucy5pbmNsdWRlQ2hpbGRyZW4gJiYgdGhpcy5hZGRlZC52YWx1ZS5maW5kU3VwZXJzdHIocmVzb3VyY2UpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZWRcblx0XHRpZiAoIWhhc1R5cGVzRmlsdGVyIHx8IHR5cGVzLmluY2x1ZGVzKEZpbGVDaGFuZ2VUeXBlLlVQREFURUQpKSB7XG5cdFx0XHRpZiAodGhpcy51cGRhdGVkLnZhbHVlLmdldChyZXNvdXJjZSkpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChvcHRpb25zLmluY2x1ZGVDaGlsZHJlbiAmJiB0aGlzLnVwZGF0ZWQudmFsdWUuZmluZFN1cGVyc3RyKHJlc291cmNlKSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBEZWxldGVkXG5cdFx0aWYgKCFoYXNUeXBlc0ZpbHRlciB8fCB0eXBlcy5pbmNsdWRlcyhGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEKSkge1xuXHRcdFx0aWYgKHRoaXMuZGVsZXRlZC52YWx1ZS5maW5kU3Vic3RyKHJlc291cmNlKSAvKiBkZWxldGVkIGFsc28gY29uc2lkZXJzIHBhcmVudCBmb2xkZXJzICovKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAob3B0aW9ucy5pbmNsdWRlQ2hpbGRyZW4gJiYgdGhpcy5kZWxldGVkLnZhbHVlLmZpbmRTdXBlcnN0cihyZXNvdXJjZSkpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgaWYgdGhpcyBldmVudCBjb250YWlucyBhZGRlZCBmaWxlcy5cblx0ICovXG5cdGdvdEFkZGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnJhd0FkZGVkLmxlbmd0aCA+IDA7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyBpZiB0aGlzIGV2ZW50IGNvbnRhaW5zIGRlbGV0ZWQgZmlsZXMuXG5cdCAqL1xuXHRnb3REZWxldGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnJhd0RlbGV0ZWQubGVuZ3RoID4gMDtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGlmIHRoaXMgZXZlbnQgY29udGFpbnMgdXBkYXRlZCBmaWxlcy5cblx0ICovXG5cdGdvdFVwZGF0ZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMucmF3VXBkYXRlZC5sZW5ndGggPiAwO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgaWYgdGhpcyBldmVudCBjb250YWlucyBjaGFuZ2VzIHRoYXQgY29ycmVsYXRlIHRvIHRoZVxuXHQgKiBwcm92aWRlZCBgY29ycmVsYXRpb25JZGAuXG5cdCAqXG5cdCAqIEZpbGUgY2hhbmdlIGV2ZW50IGNvcnJlbGF0aW9uIGlzIGFuIGFkdmFuY2VkIHdhdGNoIGZlYXR1cmUgdGhhdFxuXHQgKiBhbGxvd3MgdG8gIGlkZW50aWZ5IGZyb20gd2hpY2ggd2F0Y2ggcmVxdWVzdCB0aGUgZXZlbnRzIG9yaWdpbmF0ZVxuXHQgKiBmcm9tLiBUaGlzIGNvcnJlbGF0aW9uIGFsbG93cyB0byByb3V0ZSBldmVudHMgc3BlY2lmaWNhbGx5XG5cdCAqIG9ubHkgdG8gdGhlIHJlcXVlc3RvciBhbmQgbm90IGVtaXQgdGhlbSB0byBhbGwgbGlzdGVuZXJzLlxuXHQgKi9cblx0Y29ycmVsYXRlcyhjb3JyZWxhdGlvbklkOiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5jb3JyZWxhdGlvbklkID09PSBjb3JyZWxhdGlvbklkO1xuXHR9XG5cblx0LyoqXG5cdCAqIEZpZ3VyZSBvdXQgaWYgdGhlIGV2ZW50IGNvbnRhaW5zIGNoYW5nZXMgdGhhdCBjb3JyZWxhdGUgdG8gb25lXG5cdCAqIGNvcnJlbGF0aW9uIGlkZW50aWZpZXIuXG5cdCAqXG5cdCAqIEZpbGUgY2hhbmdlIGV2ZW50IGNvcnJlbGF0aW9uIGlzIGFuIGFkdmFuY2VkIHdhdGNoIGZlYXR1cmUgdGhhdFxuXHQgKiBhbGxvd3MgdG8gIGlkZW50aWZ5IGZyb20gd2hpY2ggd2F0Y2ggcmVxdWVzdCB0aGUgZXZlbnRzIG9yaWdpbmF0ZVxuXHQgKiBmcm9tLiBUaGlzIGNvcnJlbGF0aW9uIGFsbG93cyB0byByb3V0ZSBldmVudHMgc3BlY2lmaWNhbGx5XG5cdCAqIG9ubHkgdG8gdGhlIHJlcXVlc3RvciBhbmQgbm90IGVtaXQgdGhlbSB0byBhbGwgbGlzdGVuZXJzLlxuXHQgKi9cblx0aGFzQ29ycmVsYXRpb24oKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHR5cGVvZiB0aGlzLmNvcnJlbGF0aW9uSWQgPT09ICdudW1iZXInO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBkZXByZWNhdGVkIHVzZSB0aGUgYGNvbnRhaW5zYCBvciBgYWZmZWN0c2AgbWV0aG9kIHRvIGVmZmljaWVudGx5IGZpbmRcblx0ICogb3V0IGlmIHRoZSBldmVudCByZWxhdGVzIHRvIGEgZ2l2ZW4gcmVzb3VyY2UuIHRoZXNlIG1ldGhvZHMgZW5zdXJlOlxuXHQgKiAtIHRoYXQgdGhlcmUgaXMgbm8gZXhwZW5zaXZlIGxvb2t1cCBuZWVkZWQgKGJ5IHVzaW5nIGEgYFRlcm5hcnlTZWFyY2hUcmVlYClcblx0ICogLSBjb3JyZWN0bHkgaGFuZGxlcyBgRmlsZUNoYW5nZVR5cGUuREVMRVRFRGAgZXZlbnRzXG5cdCAqL1xuXHRyZWFkb25seSByYXdBZGRlZDogVVJJW10gPSBbXTtcblxuXHQvKipcblx0KiBAZGVwcmVjYXRlZCB1c2UgdGhlIGBjb250YWluc2Agb3IgYGFmZmVjdHNgIG1ldGhvZCB0byBlZmZpY2llbnRseSBmaW5kXG5cdCogb3V0IGlmIHRoZSBldmVudCByZWxhdGVzIHRvIGEgZ2l2ZW4gcmVzb3VyY2UuIHRoZXNlIG1ldGhvZHMgZW5zdXJlOlxuXHQqIC0gdGhhdCB0aGVyZSBpcyBubyBleHBlbnNpdmUgbG9va3VwIG5lZWRlZCAoYnkgdXNpbmcgYSBgVGVybmFyeVNlYXJjaFRyZWVgKVxuXHQqIC0gY29ycmVjdGx5IGhhbmRsZXMgYEZpbGVDaGFuZ2VUeXBlLkRFTEVURURgIGV2ZW50c1xuXHQqL1xuXHRyZWFkb25seSByYXdVcGRhdGVkOiBVUklbXSA9IFtdO1xuXG5cdC8qKlxuXHQqIEBkZXByZWNhdGVkIHVzZSB0aGUgYGNvbnRhaW5zYCBvciBgYWZmZWN0c2AgbWV0aG9kIHRvIGVmZmljaWVudGx5IGZpbmRcblx0KiBvdXQgaWYgdGhlIGV2ZW50IHJlbGF0ZXMgdG8gYSBnaXZlbiByZXNvdXJjZS4gdGhlc2UgbWV0aG9kcyBlbnN1cmU6XG5cdCogLSB0aGF0IHRoZXJlIGlzIG5vIGV4cGVuc2l2ZSBsb29rdXAgbmVlZGVkIChieSB1c2luZyBhIGBUZXJuYXJ5U2VhcmNoVHJlZWApXG5cdCogLSBjb3JyZWN0bHkgaGFuZGxlcyBgRmlsZUNoYW5nZVR5cGUuREVMRVRFRGAgZXZlbnRzXG5cdCovXG5cdHJlYWRvbmx5IHJhd0RlbGV0ZWQ6IFVSSVtdID0gW107XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1BhcmVudChwYXRoOiBzdHJpbmcsIGNhbmRpZGF0ZTogc3RyaW5nLCBpZ25vcmVDYXNlPzogYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRpZiAoIXBhdGggfHwgIWNhbmRpZGF0ZSB8fCBwYXRoID09PSBjYW5kaWRhdGUpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRpZiAoY2FuZGlkYXRlLmxlbmd0aCA+IHBhdGgubGVuZ3RoKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aWYgKGNhbmRpZGF0ZS5jaGFyQXQoY2FuZGlkYXRlLmxlbmd0aCAtIDEpICE9PSBzZXApIHtcblx0XHRjYW5kaWRhdGUgKz0gc2VwO1xuXHR9XG5cblx0aWYgKGlnbm9yZUNhc2UpIHtcblx0XHRyZXR1cm4gc3RhcnRzV2l0aElnbm9yZUNhc2UocGF0aCwgY2FuZGlkYXRlKTtcblx0fVxuXG5cdHJldHVybiBwYXRoLmluZGV4T2YoY2FuZGlkYXRlKSA9PT0gMDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQmFzZUZpbGVTdGF0IHtcblxuXHQvKipcblx0ICogVGhlIHVuaWZpZWQgcmVzb3VyY2UgaWRlbnRpZmllciBvZiB0aGlzIGZpbGUgb3IgZm9sZGVyLlxuXHQgKi9cblx0cmVhZG9ubHkgcmVzb3VyY2U6IFVSSTtcblxuXHQvKipcblx0ICogVGhlIG5hbWUgd2hpY2ggaXMgdGhlIGxhc3Qgc2VnbWVudFxuXHQgKiBvZiB0aGUge3twYXRofX0uXG5cdCAqL1xuXHRyZWFkb25seSBuYW1lOiBzdHJpbmc7XG5cblx0LyoqXG5cdCAqIFRoZSBzaXplIG9mIHRoZSBmaWxlLlxuXHQgKlxuXHQgKiBUaGUgdmFsdWUgbWF5IG9yIG1heSBub3QgYmUgcmVzb2x2ZWQgYXNcblx0ICogaXQgaXMgb3B0aW9uYWwuXG5cdCAqL1xuXHRyZWFkb25seSBzaXplPzogbnVtYmVyO1xuXG5cdC8qKlxuXHQgKiBUaGUgbGFzdCBtb2RpZmljYXRpb24gZGF0ZSByZXByZXNlbnRlZCBhcyBtaWxsaXMgZnJvbSB1bml4IGVwb2NoLlxuXHQgKlxuXHQgKiBUaGUgdmFsdWUgbWF5IG9yIG1heSBub3QgYmUgcmVzb2x2ZWQgYXNcblx0ICogaXQgaXMgb3B0aW9uYWwuXG5cdCAqL1xuXHRyZWFkb25seSBtdGltZT86IG51bWJlcjtcblxuXHQvKipcblx0ICogVGhlIGNyZWF0aW9uIGRhdGUgcmVwcmVzZW50ZWQgYXMgbWlsbGlzIGZyb20gdW5peCBlcG9jaC5cblx0ICpcblx0ICogVGhlIHZhbHVlIG1heSBvciBtYXkgbm90IGJlIHJlc29sdmVkIGFzXG5cdCAqIGl0IGlzIG9wdGlvbmFsLlxuXHQgKi9cblx0cmVhZG9ubHkgY3RpbWU/OiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIEEgdW5pcXVlIGlkZW50aWZpZXIgdGhhdCByZXByZXNlbnRzIHRoZVxuXHQgKiBjdXJyZW50IHN0YXRlIG9mIHRoZSBmaWxlIG9yIGRpcmVjdG9yeS5cblx0ICpcblx0ICogVGhlIHZhbHVlIG1heSBvciBtYXkgbm90IGJlIHJlc29sdmVkIGFzXG5cdCAqIGl0IGlzIG9wdGlvbmFsLlxuXHQgKi9cblx0cmVhZG9ubHkgZXRhZz86IHN0cmluZztcblxuXHQvKipcblx0ICogRmlsZSBpcyByZWFkb25seS4gQ29tcG9uZW50cyBsaWtlIGVkaXRvcnMgc2hvdWxkIG5vdFxuXHQgKiBvZmZlciB0byBlZGl0IHRoZSBjb250ZW50cy5cblx0ICovXG5cdHJlYWRvbmx5IHJlYWRvbmx5PzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogRmlsZSBpcyBsb2NrZWQuIENvbXBvbmVudHMgbGlrZSBlZGl0b3JzIHNob3VsZCBvZmZlclxuXHQgKiB0byBlZGl0IHRoZSBjb250ZW50cyBhbmQgYXNrIHRoZSB1c2VyIHVwb24gc2F2aW5nIHRvXG5cdCAqIHJlbW92ZSB0aGUgbG9jay5cblx0ICovXG5cdHJlYWRvbmx5IGxvY2tlZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUJhc2VGaWxlU3RhdFdpdGhNZXRhZGF0YSBleHRlbmRzIFJlcXVpcmVkPElCYXNlRmlsZVN0YXQ+IHsgfVxuXG4vKipcbiAqIEEgZmlsZSByZXNvdXJjZSB3aXRoIG1ldGEgaW5mb3JtYXRpb24gYW5kIHJlc29sdmVkIGNoaWxkcmVuIGlmIGFueS5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJRmlsZVN0YXQgZXh0ZW5kcyBJQmFzZUZpbGVTdGF0IHtcblxuXHQvKipcblx0ICogVGhlIHJlc291cmNlIGlzIGEgZmlsZS5cblx0ICovXG5cdHJlYWRvbmx5IGlzRmlsZTogYm9vbGVhbjtcblxuXHQvKipcblx0ICogVGhlIHJlc291cmNlIGlzIGEgZGlyZWN0b3J5LlxuXHQgKi9cblx0cmVhZG9ubHkgaXNEaXJlY3Rvcnk6IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFRoZSByZXNvdXJjZSBpcyBhIHN5bWJvbGljIGxpbmsuIE5vdGU6IGV2ZW4gd2hlbiB0aGVcblx0ICogZmlsZSBpcyBhIHN5bWJvbGljIGxpbmssIHlvdSBjYW4gdGVzdCBmb3IgYEZpbGVUeXBlLkZpbGVgXG5cdCAqIGFuZCBgRmlsZVR5cGUuRGlyZWN0b3J5YCB0byBrbm93IHRoZSB0eXBlIG9mIHRoZSB0YXJnZXRcblx0ICogdGhlIGxpbmsgcG9pbnRzIHRvLlxuXHQgKi9cblx0cmVhZG9ubHkgaXNTeW1ib2xpY0xpbms6IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFRoZSBjaGlsZHJlbiBvZiB0aGUgZmlsZSBzdGF0IG9yIHVuZGVmaW5lZCBpZiBub25lLlxuXHQgKi9cblx0Y2hpbGRyZW46IElGaWxlU3RhdFtdIHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlU3RhdFdpdGhNZXRhZGF0YSBleHRlbmRzIElGaWxlU3RhdCwgSUJhc2VGaWxlU3RhdFdpdGhNZXRhZGF0YSB7XG5cdHJlYWRvbmx5IG10aW1lOiBudW1iZXI7XG5cdHJlYWRvbmx5IGN0aW1lOiBudW1iZXI7XG5cdHJlYWRvbmx5IGV0YWc6IHN0cmluZztcblx0cmVhZG9ubHkgc2l6ZTogbnVtYmVyO1xuXHRyZWFkb25seSByZWFkb25seTogYm9vbGVhbjtcblx0cmVhZG9ubHkgbG9ja2VkOiBib29sZWFuO1xuXHRyZWFkb25seSBjaGlsZHJlbjogSUZpbGVTdGF0V2l0aE1ldGFkYXRhW10gfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVTdGF0UmVzdWx0IHtcblx0cmVhZG9ubHkgc3RhdD86IElGaWxlU3RhdDtcblx0cmVhZG9ubHkgc3VjY2VzczogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRmlsZVN0YXRSZXN1bHRXaXRoTWV0YWRhdGEgZXh0ZW5kcyBJRmlsZVN0YXRSZXN1bHQge1xuXHRyZWFkb25seSBzdGF0PzogSUZpbGVTdGF0V2l0aE1ldGFkYXRhO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElGaWxlU3RhdFdpdGhQYXJ0aWFsTWV0YWRhdGEgZXh0ZW5kcyBPbWl0PElGaWxlU3RhdFdpdGhNZXRhZGF0YSwgJ2NoaWxkcmVuJz4geyB9XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVDb250ZW50IGV4dGVuZHMgSUJhc2VGaWxlU3RhdFdpdGhNZXRhZGF0YSB7XG5cblx0LyoqXG5cdCAqIFRoZSBjb250ZW50IG9mIGEgZmlsZSBhcyBidWZmZXIuXG5cdCAqL1xuXHRyZWFkb25seSB2YWx1ZTogVlNCdWZmZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVTdHJlYW1Db250ZW50IGV4dGVuZHMgSUJhc2VGaWxlU3RhdFdpdGhNZXRhZGF0YSB7XG5cblx0LyoqXG5cdCAqIFRoZSBjb250ZW50IG9mIGEgZmlsZSBhcyBzdHJlYW0uXG5cdCAqL1xuXHRyZWFkb25seSB2YWx1ZTogVlNCdWZmZXJSZWFkYWJsZVN0cmVhbTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQmFzZVJlYWRGaWxlT3B0aW9ucyBleHRlbmRzIElGaWxlUmVhZFN0cmVhbU9wdGlvbnMge1xuXG5cdC8qKlxuXHQgKiBUaGUgb3B0aW9uYWwgZXRhZyBwYXJhbWV0ZXIgYWxsb3dzIHRvIHJldHVybiBlYXJseSBmcm9tIHJlc29sdmluZyB0aGUgcmVzb3VyY2UgaWZcblx0ICogdGhlIGNvbnRlbnRzIG9uIGRpc2sgbWF0Y2ggdGhlIGV0YWcuIFRoaXMgcHJldmVudHMgYWNjdW11bGF0ZWQgcmVhZGluZyBvZiByZXNvdXJjZXNcblx0ICogdGhhdCBoYXZlIGJlZW4gcmVhZCBhbHJlYWR5IHdpdGggdGhlIHNhbWUgZXRhZy5cblx0ICogSXQgaXMgdGhlIHRhc2sgb2YgdGhlIGNhbGxlciB0byBtYWtlcyBzdXJlIHRvIGhhbmRsZSB0aGlzIGVycm9yIGNhc2UgZnJvbSB0aGUgcHJvbWlzZS5cblx0ICovXG5cdHJlYWRvbmx5IGV0YWc/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlYWRGaWxlU3RyZWFtT3B0aW9ucyBleHRlbmRzIElCYXNlUmVhZEZpbGVPcHRpb25zIHsgfVxuXG5leHBvcnQgaW50ZXJmYWNlIElSZWFkRmlsZU9wdGlvbnMgZXh0ZW5kcyBJQmFzZVJlYWRGaWxlT3B0aW9ucyB7XG5cblx0LyoqXG5cdCAqIFRoZSBvcHRpb25hbCBgYXRvbWljYCBmbGFnIGNhbiBiZSB1c2VkIHRvIG1ha2Ugc3VyZVxuXHQgKiB0aGUgYHJlYWRGaWxlYCBtZXRob2QgaXMgbm90IHJ1bm5pbmcgaW4gcGFyYWxsZWwgd2l0aFxuXHQgKiBhbnkgYHdyaXRlYCBvcGVyYXRpb25zIGluIHRoZSBzYW1lIHByb2Nlc3MuXG5cdCAqXG5cdCAqIFR5cGljYWxseSB5b3Ugc2hvdWxkIG5vdCBuZWVkIHRvIHVzZSB0aGlzIGZsYWcgYnV0IGlmXG5cdCAqIGZvciBleGFtcGxlIHlvdSBhcmUgcXVpY2tseSByZWFkaW5nIGEgZmlsZSByaWdodCBhZnRlclxuXHQgKiBhIGZpbGUgZXZlbnQgb2NjdXJyZWQgYW5kIHRoZSBmaWxlIGNoYW5nZXMgYSBsb3QsIHRoZXJlXG5cdCAqIGlzIGEgY2hhbmNlIHRoYXQgYSByZWFkIHJldHVybnMgYW4gZW1wdHkgb3IgcGFydGlhbCBmaWxlXG5cdCAqIGJlY2F1c2UgYSBwZW5kaW5nIHdyaXRlIGhhcyBub3QgZmluaXNoZWQgeWV0LlxuXHQgKlxuXHQgKiBOb3RlOiB0aGlzIGRvZXMgbm90IHByZXZlbnQgdGhlIGZpbGUgZnJvbSBiZWluZyB3cml0dGVuXG5cdCAqIHRvIGZyb20gYSBkaWZmZXJlbnQgcHJvY2Vzcy4gSWYgeW91IG5lZWQgc3VjaCBhdG9taWNcblx0ICogb3BlcmF0aW9ucywgeW91IGJldHRlciB1c2UgYSByZWFsIGRhdGFiYXNlIGFzIHN0b3JhZ2UuXG5cdCAqL1xuXHRyZWFkb25seSBhdG9taWM/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElXcml0ZUZpbGVPcHRpb25zIHtcblxuXHQvKipcblx0ICogVGhlIGxhc3Qga25vd24gbW9kaWZpY2F0aW9uIHRpbWUgb2YgdGhlIGZpbGUuIFRoaXMgY2FuIGJlIHVzZWQgdG8gcHJldmVudCBkaXJ0eSB3cml0ZXMuXG5cdCAqL1xuXHRyZWFkb25seSBtdGltZT86IG51bWJlcjtcblxuXHQvKipcblx0ICogVGhlIGV0YWcgb2YgdGhlIGZpbGUuIFRoaXMgY2FuIGJlIHVzZWQgdG8gcHJldmVudCBkaXJ0eSB3cml0ZXMuXG5cdCAqL1xuXHRyZWFkb25seSBldGFnPzogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBXaGV0aGVyIHRvIGF0dGVtcHQgdG8gdW5sb2NrIGEgZmlsZSBiZWZvcmUgd3JpdGluZy5cblx0ICovXG5cdHJlYWRvbmx5IHVubG9jaz86IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIFRoZSBvcHRpb25hbCBgYXRvbWljYCBmbGFnIGNhbiBiZSB1c2VkIHRvIG1ha2Ugc3VyZVxuXHQgKiB0aGUgYHdyaXRlRmlsZWAgbWV0aG9kIHVwZGF0ZXMgdGhlIHRhcmdldCBmaWxlIGF0b21pY2FsbHlcblx0ICogYnkgZmlyc3Qgd3JpdGluZyB0byBhIHRlbXBvcmFyeSBmaWxlIGluIHRoZSBzYW1lIGZvbGRlclxuXHQgKiBhbmQgdGhlbiByZW5hbWluZyBpdCBvdmVyIHRoZSB0YXJnZXQuXG5cdCAqL1xuXHRyZWFkb25seSBhdG9taWM/OiBJRmlsZUF0b21pY09wdGlvbnMgfCBmYWxzZTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUmVzb2x2ZUZpbGVPcHRpb25zIHtcblxuXHQvKipcblx0ICogQXV0b21hdGljYWxseSBjb250aW51ZSByZXNvbHZpbmcgY2hpbGRyZW4gb2YgYSBkaXJlY3RvcnkgdW50aWwgdGhlIHByb3ZpZGVkIHJlc291cmNlc1xuXHQgKiBhcmUgZm91bmQuXG5cdCAqL1xuXHRyZWFkb25seSByZXNvbHZlVG8/OiByZWFkb25seSBVUklbXTtcblxuXHQvKipcblx0ICogQXV0b21hdGljYWxseSBjb250aW51ZSByZXNvbHZpbmcgY2hpbGRyZW4gb2YgYSBkaXJlY3RvcnkgaWYgdGhlIG51bWJlciBvZiBjaGlsZHJlbiBpcyAxLlxuXHQgKi9cblx0cmVhZG9ubHkgcmVzb2x2ZVNpbmdsZUNoaWxkRGVzY2VuZGFudHM/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBXaWxsIHJlc29sdmUgbXRpbWUsIGN0aW1lLCBzaXplIGFuZCBldGFnIG9mIGZpbGVzIGlmIGVuYWJsZWQuIFRoaXMgY2FuIGhhdmUgYSBuZWdhdGl2ZSBpbXBhY3Rcblx0ICogb24gcGVyZm9ybWFuY2UgYW5kIHRodXMgc2hvdWxkIG9ubHkgYmUgdXNlZCB3aGVuIHRoZXNlIHZhbHVlcyBhcmUgcmVxdWlyZWQuXG5cdCAqL1xuXHRyZWFkb25seSByZXNvbHZlTWV0YWRhdGE/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElSZXNvbHZlTWV0YWRhdGFGaWxlT3B0aW9ucyBleHRlbmRzIElSZXNvbHZlRmlsZU9wdGlvbnMge1xuXHRyZWFkb25seSByZXNvbHZlTWV0YWRhdGE6IHRydWU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNyZWF0ZUZpbGVPcHRpb25zIHtcblxuXHQvKipcblx0ICogT3ZlcndyaXRlIHRoZSBmaWxlIHRvIGNyZWF0ZSBpZiBpdCBhbHJlYWR5IGV4aXN0cyBvbiBkaXNrLiBPdGhlcndpc2Vcblx0ICogYW4gZXJyb3Igd2lsbCBiZSB0aHJvd24gKEZJTEVfTU9ESUZJRURfU0lOQ0UpLlxuXHQgKi9cblx0cmVhZG9ubHkgb3ZlcndyaXRlPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIEZpbGVPcGVyYXRpb25FcnJvciBleHRlbmRzIEVycm9yIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0bWVzc2FnZTogc3RyaW5nLFxuXHRcdHJlYWRvbmx5IGZpbGVPcGVyYXRpb25SZXN1bHQ6IEZpbGVPcGVyYXRpb25SZXN1bHQsXG5cdFx0cmVhZG9ubHkgb3B0aW9ucz86IElSZWFkRmlsZU9wdGlvbnMgfCBJV3JpdGVGaWxlT3B0aW9ucyB8IElDcmVhdGVGaWxlT3B0aW9uc1xuXHQpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVG9vTGFyZ2VGaWxlT3BlcmF0aW9uRXJyb3IgZXh0ZW5kcyBGaWxlT3BlcmF0aW9uRXJyb3Ige1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRtZXNzYWdlOiBzdHJpbmcsXG5cdFx0b3ZlcnJpZGUgcmVhZG9ubHkgZmlsZU9wZXJhdGlvblJlc3VsdDogRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX1RPT19MQVJHRSxcblx0XHRyZWFkb25seSBzaXplOiBudW1iZXIsXG5cdFx0b3B0aW9ucz86IElSZWFkRmlsZU9wdGlvbnNcblx0KSB7XG5cdFx0c3VwZXIobWVzc2FnZSwgZmlsZU9wZXJhdGlvblJlc3VsdCwgb3B0aW9ucyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE5vdE1vZGlmaWVkU2luY2VGaWxlT3BlcmF0aW9uRXJyb3IgZXh0ZW5kcyBGaWxlT3BlcmF0aW9uRXJyb3Ige1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG1lc3NhZ2U6IHN0cmluZyxcblx0XHRyZWFkb25seSBzdGF0OiBJRmlsZVN0YXRXaXRoTWV0YWRhdGEsXG5cdFx0b3B0aW9ucz86IElSZWFkRmlsZU9wdGlvbnNcblx0KSB7XG5cdFx0c3VwZXIobWVzc2FnZSwgRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9NT0RJRklFRF9TSU5DRSwgb3B0aW9ucyk7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gRmlsZU9wZXJhdGlvblJlc3VsdCB7XG5cdEZJTEVfSVNfRElSRUNUT1JZLFxuXHRGSUxFX05PVF9GT1VORCxcblx0RklMRV9OT1RfTU9ESUZJRURfU0lOQ0UsXG5cdEZJTEVfTU9ESUZJRURfU0lOQ0UsXG5cdEZJTEVfTU9WRV9DT05GTElDVCxcblx0RklMRV9XUklURV9MT0NLRUQsXG5cdEZJTEVfUEVSTUlTU0lPTl9ERU5JRUQsXG5cdEZJTEVfVE9PX0xBUkdFLFxuXHRGSUxFX0lOVkFMSURfUEFUSCxcblx0RklMRV9OT1RfRElSRUNUT1JZLFxuXHRGSUxFX09USEVSX0VSUk9SXG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gU2V0dGluZ3NcblxuZXhwb3J0IGNvbnN0IEF1dG9TYXZlQ29uZmlndXJhdGlvbiA9IHtcblx0T0ZGOiAnb2ZmJyxcblx0QUZURVJfREVMQVk6ICdhZnRlckRlbGF5Jyxcblx0T05fRk9DVVNfQ0hBTkdFOiAnb25Gb2N1c0NoYW5nZScsXG5cdE9OX1dJTkRPV19DSEFOR0U6ICdvbldpbmRvd0NoYW5nZSdcbn07XG5cbmV4cG9ydCBjb25zdCBIb3RFeGl0Q29uZmlndXJhdGlvbiA9IHtcblx0T0ZGOiAnb2ZmJyxcblx0T05fRVhJVDogJ29uRXhpdCcsXG5cdE9OX0VYSVRfQU5EX1dJTkRPV19DTE9TRTogJ29uRXhpdEFuZFdpbmRvd0Nsb3NlJ1xufTtcblxuZXhwb3J0IGNvbnN0IEZJTEVTX0FTU09DSUFUSU9OU19DT05GSUcgPSAnZmlsZXMuYXNzb2NpYXRpb25zJztcbmV4cG9ydCBjb25zdCBGSUxFU19FWENMVURFX0NPTkZJRyA9ICdmaWxlcy5leGNsdWRlJztcbmV4cG9ydCBjb25zdCBGSUxFU19SRUFET05MWV9JTkNMVURFX0NPTkZJRyA9ICdmaWxlcy5yZWFkb25seUluY2x1ZGUnO1xuZXhwb3J0IGNvbnN0IEZJTEVTX1JFQURPTkxZX0VYQ0xVREVfQ09ORklHID0gJ2ZpbGVzLnJlYWRvbmx5RXhjbHVkZSc7XG5leHBvcnQgY29uc3QgRklMRVNfUkVBRE9OTFlfRlJPTV9QRVJNSVNTSU9OU19DT05GSUcgPSAnZmlsZXMucmVhZG9ubHlGcm9tUGVybWlzc2lvbnMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElHbG9iUGF0dGVybnMge1xuXHRbZmlsZXBhdHRlcm46IHN0cmluZ106IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVzQ29uZmlndXJhdGlvbiB7XG5cdGZpbGVzPzogSUZpbGVzQ29uZmlndXJhdGlvbk5vZGU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUZpbGVzQ29uZmlndXJhdGlvbk5vZGUge1xuXHRhc3NvY2lhdGlvbnM6IHsgW2ZpbGVwYXR0ZXJuOiBzdHJpbmddOiBzdHJpbmcgfTtcblx0ZXhjbHVkZTogSUV4cHJlc3Npb247XG5cdHdhdGNoZXJFeGNsdWRlOiBJR2xvYlBhdHRlcm5zO1xuXHR3YXRjaGVySW5jbHVkZTogc3RyaW5nW107XG5cdGVuY29kaW5nOiBzdHJpbmc7XG5cdGF1dG9HdWVzc0VuY29kaW5nOiBib29sZWFuO1xuXHRjYW5kaWRhdGVHdWVzc0VuY29kaW5nczogc3RyaW5nW107XG5cdGRlZmF1bHRMYW5ndWFnZTogc3RyaW5nO1xuXHR0cmltVHJhaWxpbmdXaGl0ZXNwYWNlOiBib29sZWFuO1xuXHRhdXRvU2F2ZTogc3RyaW5nO1xuXHRhdXRvU2F2ZURlbGF5OiBudW1iZXI7XG5cdGF1dG9TYXZlV29ya3NwYWNlRmlsZXNPbmx5OiBib29sZWFuO1xuXHRhdXRvU2F2ZVdoZW5Ob0Vycm9yczogYm9vbGVhbjtcblx0ZW9sOiBzdHJpbmc7XG5cdGVuYWJsZVRyYXNoOiBib29sZWFuO1xuXHRob3RFeGl0OiBzdHJpbmc7XG5cdHNhdmVDb25mbGljdFJlc29sdXRpb246ICdhc2tVc2VyJyB8ICdvdmVyd3JpdGVGaWxlT25EaXNrJztcblx0cmVhZG9ubHlJbmNsdWRlOiBJR2xvYlBhdHRlcm5zO1xuXHRyZWFkb25seUV4Y2x1ZGU6IElHbG9iUGF0dGVybnM7XG5cdHJlYWRvbmx5RnJvbVBlcm1pc3Npb25zOiBib29sZWFuO1xufVxuXG4vLyNlbmRyZWdpb25cblxuLy8jcmVnaW9uIFV0aWxpdGllc1xuXG5leHBvcnQgZW51bSBGaWxlS2luZCB7XG5cdEZJTEUsXG5cdEZPTERFUixcblx0Uk9PVF9GT0xERVJcbn1cblxuLyoqXG4gKiBBIGhpbnQgdG8gZGlzYWJsZSBldGFnIGNoZWNraW5nIGZvciByZWFkaW5nL3dyaXRpbmcuXG4gKi9cbmV4cG9ydCBjb25zdCBFVEFHX0RJU0FCTEVEID0gJyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBldGFnKHN0YXQ6IHsgbXRpbWU6IG51bWJlcjsgc2l6ZTogbnVtYmVyIH0pOiBzdHJpbmc7XG5leHBvcnQgZnVuY3Rpb24gZXRhZyhzdGF0OiB7IG10aW1lOiBudW1iZXIgfCB1bmRlZmluZWQ7IHNpemU6IG51bWJlciB8IHVuZGVmaW5lZCB9KTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuZXhwb3J0IGZ1bmN0aW9uIGV0YWcoc3RhdDogeyBtdGltZTogbnVtYmVyIHwgdW5kZWZpbmVkOyBzaXplOiBudW1iZXIgfCB1bmRlZmluZWQgfSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdGlmICh0eXBlb2Ygc3RhdC5zaXplICE9PSAnbnVtYmVyJyB8fCB0eXBlb2Ygc3RhdC5tdGltZSAhPT0gJ251bWJlcicpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cmV0dXJuIHN0YXQubXRpbWUudG9TdHJpbmcoMjkpICsgc3RhdC5zaXplLnRvU3RyaW5nKDMxKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdoZW5Qcm92aWRlclJlZ2lzdGVyZWQoZmlsZTogVVJJLCBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdGlmIChmaWxlU2VydmljZS5oYXNQcm92aWRlcihVUkkuZnJvbSh7IHNjaGVtZTogZmlsZS5zY2hlbWUgfSkpKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0cmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBmaWxlU2VydmljZS5vbkRpZENoYW5nZUZpbGVTeXN0ZW1Qcm92aWRlclJlZ2lzdHJhdGlvbnMoZSA9PiB7XG5cdFx0XHRpZiAoZS5zY2hlbWUgPT09IGZpbGUuc2NoZW1lICYmIGUuYWRkZWQpIHtcblx0XHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG59XG5cbi8qKlxuICogSGVscGVyIHRvIGZvcm1hdCBhIHJhdyBieXRlIHNpemUgaW50byBhIGh1bWFuIHJlYWRhYmxlIGxhYmVsLlxuICovXG5leHBvcnQgY2xhc3MgQnl0ZVNpemUge1xuXG5cdHN0YXRpYyByZWFkb25seSBLQiA9IDEwMjQ7XG5cdHN0YXRpYyByZWFkb25seSBNQiA9IEJ5dGVTaXplLktCICogQnl0ZVNpemUuS0I7XG5cdHN0YXRpYyByZWFkb25seSBHQiA9IEJ5dGVTaXplLk1CICogQnl0ZVNpemUuS0I7XG5cdHN0YXRpYyByZWFkb25seSBUQiA9IEJ5dGVTaXplLkdCICogQnl0ZVNpemUuS0I7XG5cblx0c3RhdGljIGZvcm1hdFNpemUoc2l6ZTogbnVtYmVyKTogc3RyaW5nIHtcblx0XHRpZiAoIWlzTnVtYmVyKHNpemUpKSB7XG5cdFx0XHRzaXplID0gMDtcblx0XHR9XG5cblx0XHRpZiAoc2l6ZSA8IEJ5dGVTaXplLktCKSB7XG5cdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3NpemVCJywgXCJ7MH1CXCIsIHNpemUudG9GaXhlZCgwKSk7XG5cdFx0fVxuXG5cdFx0aWYgKHNpemUgPCBCeXRlU2l6ZS5NQikge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCdzaXplS0InLCBcInswfUtCXCIsIChzaXplIC8gQnl0ZVNpemUuS0IpLnRvRml4ZWQoMikpO1xuXHRcdH1cblxuXHRcdGlmIChzaXplIDwgQnl0ZVNpemUuR0IpIHtcblx0XHRcdHJldHVybiBsb2NhbGl6ZSgnc2l6ZU1CJywgXCJ7MH1NQlwiLCAoc2l6ZSAvIEJ5dGVTaXplLk1CKS50b0ZpeGVkKDIpKTtcblx0XHR9XG5cblx0XHRpZiAoc2l6ZSA8IEJ5dGVTaXplLlRCKSB7XG5cdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3NpemVHQicsIFwiezB9R0JcIiwgKHNpemUgLyBCeXRlU2l6ZS5HQikudG9GaXhlZCgyKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGxvY2FsaXplKCdzaXplVEInLCBcInswfVRCXCIsIChzaXplIC8gQnl0ZVNpemUuVEIpLnRvRml4ZWQoMikpO1xuXHR9XG59XG5cbi8vIEZpbGUgbGltaXRzXG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRMYXJnZUZpbGVDb25maXJtYXRpb25MaW1pdChyZW1vdGVBdXRob3JpdHk/OiBzdHJpbmcpOiBudW1iZXI7XG5leHBvcnQgZnVuY3Rpb24gZ2V0TGFyZ2VGaWxlQ29uZmlybWF0aW9uTGltaXQodXJpPzogVVJJKTogbnVtYmVyO1xuZXhwb3J0IGZ1bmN0aW9uIGdldExhcmdlRmlsZUNvbmZpcm1hdGlvbkxpbWl0KGFyZz86IHN0cmluZyB8IFVSSSk6IG51bWJlciB7XG5cdGNvbnN0IGlzUmVtb3RlID0gdHlwZW9mIGFyZyA9PT0gJ3N0cmluZycgfHwgYXJnPy5zY2hlbWUgPT09IFNjaGVtYXMudnNjb2RlUmVtb3RlO1xuXHRjb25zdCBpc0xvY2FsID0gdHlwZW9mIGFyZyAhPT0gJ3N0cmluZycgJiYgYXJnPy5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZTtcblxuXHRpZiAoaXNMb2NhbCkge1xuXHRcdC8vIExvY2FsIGFsbW9zdCBoYXMgbm8gbGltaXQgaW4gZmlsZSBzaXplXG5cdFx0cmV0dXJuIDEwMjQgKiBCeXRlU2l6ZS5NQjtcblx0fVxuXG5cdGlmIChpc1JlbW90ZSkge1xuXHRcdC8vIFdpdGggYSByZW1vdGUsIHBpY2sgYSBsb3cgbGltaXQgdG8gYXZvaWRcblx0XHQvLyBwb3RlbnRpYWxseSBjb3N0bHkgZmlsZSB0cmFuc2ZlcnNcblx0XHRyZXR1cm4gMTAgKiBCeXRlU2l6ZS5NQjtcblx0fVxuXG5cdGlmIChpc1dlYikge1xuXHRcdC8vIFdlYjogd2UgY2Fubm90IGtub3cgZm9yIHN1cmUgaWYgYSBjb3N0XG5cdFx0Ly8gaXMgYXNzb2NpYXRlZCB3aXRoIHRoZSBmaWxlIHRyYW5zZmVyXG5cdFx0Ly8gc28gd2UgcGljayBhIHJlYXNvbmFibHkgc21hbGwgbGltaXRcblx0XHRyZXR1cm4gNTAgKiBCeXRlU2l6ZS5NQjtcblx0fVxuXG5cdC8vIExvY2FsIGRlc2t0b3A6IGFsbW9zdCBubyBsaW1pdCBpbiBmaWxlIHNpemVcblx0cmV0dXJuIDEwMjQgKiBCeXRlU2l6ZS5NQjtcbn1cblxuLy8jZW5kcmVnaW9uXG4iXSwKICAibWFwcGluZ3MiOiAiQUFVQSxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLFdBQVc7QUFFcEIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsdUJB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LE9BQU8sVUFBUyxJQUFJO0FBQ3ZCLGFBQU8sU0FBUyxVQUFVLFVBQVUsT0FBTyxVQUFTLElBQUksUUFBUSxDQUFDLENBQUM7QUFBQSxJQUNuRTtBQUVBLFFBQUksT0FBTyxVQUFTLElBQUk7QUFDdkIsYUFBTyxTQUFTLFVBQVUsVUFBVSxPQUFPLFVBQVMsSUFBSSxRQUFRLENBQUMsQ0FBQztBQUFBLElBQ25FO0FBRUEsUUFBSSxPQUFPLFVBQVMsSUFBSTtBQUN2QixhQUFPLFNBQVMsVUFBVSxVQUFVLE9BQU8sVUFBUyxJQUFJLFFBQVEsQ0FBQyxDQUFDO0FBQUEsSUFDbkU7QUFFQSxXQUFPLFNBQVMsVUFBVSxVQUFVLE9BQU8sVUFBUyxJQUFJLFFBQVEsQ0FBQyxDQUFDO0FBQUEsRUFDbkU7QUFDRDtBQTlCYSxVQUVJLEtBQUs7QUFGVCxVQUdJLEtBQUssVUFBUyxLQUFLLFVBQVM7QUFIaEMsVUFJSSxLQUFLLFVBQVMsS0FBSyxVQUFTO0FBSmhDLFVBS0ksS0FBSyxVQUFTLEtBQUssVUFBUztBQUx0QyxJQUFNLFdBQU47QUFvQ0EsU0FBUyw4QkFBOEIsS0FBNEI7QUFDekUsUUFBTSxXQUFXLE9BQU8sUUFBUSxZQUFZLEtBQUssV0FBVyxRQUFRO0FBQ3BFLFFBQU0sVUFBVSxPQUFPLFFBQVEsWUFBWSxLQUFLLFdBQVcsUUFBUTtBQUVuRSxNQUFJLFNBQVM7QUFFWixXQUFPLE9BQU8sU0FBUztBQUFBLEVBQ3hCO0FBRUEsTUFBSSxVQUFVO0FBR2IsV0FBTyxLQUFLLFNBQVM7QUFBQSxFQUN0QjtBQUVBLE1BQUksT0FBTztBQUlWLFdBQU8sS0FBSyxTQUFTO0FBQUEsRUFDdEI7QUFHQSxTQUFPLE9BQU8sU0FBUztBQUN4QjsiLAogICJuYW1lcyI6IFsiRmlsZVR5cGUiLCAiRmlsZVBlcm1pc3Npb24iLCAiRmlsZUNoYW5nZUZpbHRlciIsICJGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMiLCAiRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlIiwgIkZpbGVPcGVyYXRpb24iLCAiRmlsZUNoYW5nZVR5cGUiLCAiRmlsZU9wZXJhdGlvblJlc3VsdCIsICJGaWxlS2luZCJdCn0K
