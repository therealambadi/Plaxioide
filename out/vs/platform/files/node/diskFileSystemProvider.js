import { promises } from "fs";
import { Barrier, retry } from "../../../base/common/async.js";
import { ResourceMap } from "../../../base/common/map.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { Event } from "../../../base/common/event.js";
import { isEqual } from "../../../base/common/extpath.js";
import { DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { basename, dirname, join } from "../../../base/common/path.js";
import { isLinux, isWindows } from "../../../base/common/platform.js";
import { extUriBiasedIgnorePathCase, joinPath, basename as resourcesBasename, dirname as resourcesDirname } from "../../../base/common/resources.js";
import { newWriteableStream } from "../../../base/common/stream.js";
import { Promises, RimRafMode, SymlinkSupport } from "../../../base/node/pfs.js";
import { localize } from "../../../nls.js";
import { createFileSystemProviderError, FileSystemProviderCapabilities, FileSystemProviderError, FileSystemProviderErrorCode, FileType, isFileOpenForWriteOptions, FilePermission } from "../common/files.js";
import { readFileIntoStream } from "../common/io.js";
import { AbstractDiskFileSystemProvider } from "../common/diskFileSystemProvider.js";
import { UniversalWatcherClient } from "./watcher/watcherClient.js";
import { NodeJSWatcherClient } from "./watcher/nodejs/nodejsClient.js";
const _DiskFileSystemProvider = class _DiskFileSystemProvider extends AbstractDiskFileSystemProvider {
  // not enabled by default because very spammy
  constructor(logService, options) {
    super(logService, options);
    //#region File Capabilities
    this.onDidChangeCapabilities = Event.None;
    //#endregion
    //#region File Reading/Writing
    this.resourceLocks = new ResourceMap((resource) => extUriBiasedIgnorePathCase.getComparisonKey(resource));
    this.mapHandleToPos = /* @__PURE__ */ new Map();
    this.mapHandleToLock = /* @__PURE__ */ new Map();
    this.writeHandles = /* @__PURE__ */ new Map();
  }
  get capabilities() {
    if (!this._capabilities) {
      this._capabilities = FileSystemProviderCapabilities.FileReadWrite | FileSystemProviderCapabilities.FileOpenReadWriteClose | FileSystemProviderCapabilities.FileReadStream | FileSystemProviderCapabilities.FileFolderCopy | FileSystemProviderCapabilities.FileWriteUnlock | FileSystemProviderCapabilities.FileAtomicRead | FileSystemProviderCapabilities.FileAtomicWrite | FileSystemProviderCapabilities.FileAtomicDelete | FileSystemProviderCapabilities.FileClone;
      if (isLinux) {
        this._capabilities |= FileSystemProviderCapabilities.PathCaseSensitive;
      }
    }
    return this._capabilities;
  }
  //#endregion
  //#region File Metadata Resolving
  async stat(resource) {
    try {
      const { stat, symbolicLink } = await SymlinkSupport.stat(this.toFilePath(resource));
      return {
        type: this.toType(stat, symbolicLink),
        ctime: stat.birthtime.getTime(),
        // intentionally not using ctime here, we want the creation time
        mtime: stat.mtime.getTime(),
        size: stat.size,
        permissions: (stat.mode & 128) === 0 ? FilePermission.Locked : void 0
      };
    } catch (error) {
      throw this.toFileSystemProviderError(error);
    }
  }
  async statIgnoreError(resource) {
    try {
      return await this.stat(resource);
    } catch (error) {
      return void 0;
    }
  }
  async readdir(resource) {
    try {
      const children = await Promises.readdir(this.toFilePath(resource), { withFileTypes: true });
      const result = [];
      await Promise.all(children.map(async (child) => {
        try {
          let type;
          if (child.isSymbolicLink()) {
            type = (await this.stat(joinPath(resource, child.name))).type;
          } else {
            type = this.toType(child);
          }
          result.push([child.name, type]);
        } catch (error) {
          this.logService.trace(error);
        }
      }));
      return result;
    } catch (error) {
      throw this.toFileSystemProviderError(error);
    }
  }
  toType(entry, symbolicLink) {
    let type;
    if (symbolicLink?.dangling) {
      type = FileType.Unknown;
    } else if (entry.isFile()) {
      type = FileType.File;
    } else if (entry.isDirectory()) {
      type = FileType.Directory;
    } else {
      type = FileType.Unknown;
    }
    if (symbolicLink) {
      type |= FileType.SymbolicLink;
    }
    return type;
  }
  async createResourceLock(resource) {
    const filePath = this.toFilePath(resource);
    this.traceLock(`[Disk FileSystemProvider]: createResourceLock() - request to acquire resource lock (${filePath})`);
    let existingLock = void 0;
    while (existingLock = this.resourceLocks.get(resource)) {
      this.traceLock(`[Disk FileSystemProvider]: createResourceLock() - waiting for resource lock to be released (${filePath})`);
      await existingLock.wait();
    }
    const newLock = new Barrier();
    this.resourceLocks.set(resource, newLock);
    this.traceLock(`[Disk FileSystemProvider]: createResourceLock() - new resource lock created (${filePath})`);
    return toDisposable(() => {
      this.traceLock(`[Disk FileSystemProvider]: createResourceLock() - resource lock dispose() (${filePath})`);
      if (this.resourceLocks.get(resource) === newLock) {
        this.traceLock(`[Disk FileSystemProvider]: createResourceLock() - resource lock removed from resource-lock map (${filePath})`);
        this.resourceLocks.delete(resource);
      }
      this.traceLock(`[Disk FileSystemProvider]: createResourceLock() - resource lock barrier open() (${filePath})`);
      newLock.open();
    });
  }
  async readFile(resource, options) {
    let lock = void 0;
    try {
      if (options?.atomic) {
        this.traceLock(`[Disk FileSystemProvider]: atomic read operation started (${this.toFilePath(resource)})`);
        lock = await this.createResourceLock(resource);
      }
      const filePath = this.toFilePath(resource);
      return await promises.readFile(filePath);
    } catch (error) {
      throw this.toFileSystemProviderError(error);
    } finally {
      lock?.dispose();
    }
  }
  traceLock(msg) {
    if (_DiskFileSystemProvider.TRACE_LOG_RESOURCE_LOCKS) {
      this.logService.trace(msg);
    }
  }
  readFileStream(resource, opts, token) {
    const stream = newWriteableStream((data) => VSBuffer.concat(data.map((data2) => VSBuffer.wrap(data2))).buffer);
    readFileIntoStream(this, resource, stream, (data) => data.buffer, {
      ...opts,
      bufferSize: 256 * 1024
      // read into chunks of 256kb each to reduce IPC overhead
    }, token);
    return stream;
  }
  async writeFile(resource, content, opts) {
    if (opts?.atomic !== false && opts?.atomic?.postfix && await this.canWriteFileAtomic(resource)) {
      return this.doWriteFileAtomic(resource, joinPath(resourcesDirname(resource), `${resourcesBasename(resource)}${opts.atomic.postfix}`), content, opts);
    } else {
      return this.doWriteFile(resource, content, opts);
    }
  }
  async canWriteFileAtomic(resource) {
    try {
      const filePath = this.toFilePath(resource);
      const { symbolicLink } = await SymlinkSupport.stat(filePath);
      if (symbolicLink) {
        return false;
      }
    } catch (error) {
    }
    return true;
  }
  async doWriteFileAtomic(resource, tempResource, content, opts) {
    const locks = new DisposableStore();
    try {
      locks.add(await this.createResourceLock(resource));
      locks.add(await this.createResourceLock(tempResource));
      await this.doWriteFile(
        tempResource,
        content,
        opts,
        true
        /* disable write lock */
      );
      try {
        await this.rename(tempResource, resource, { overwrite: true });
      } catch (error) {
        try {
          await this.delete(tempResource, { recursive: false, useTrash: false, atomic: false });
        } catch (error2) {
        }
        throw error;
      }
    } finally {
      locks.dispose();
    }
  }
  async doWriteFile(resource, content, opts, disableWriteLock) {
    let handle = void 0;
    try {
      const filePath = this.toFilePath(resource);
      if (!opts.create || !opts.overwrite) {
        const fileExists = await Promises.exists(filePath);
        if (fileExists) {
          if (!opts.overwrite) {
            throw createFileSystemProviderError(localize("fileExists", "File already exists"), FileSystemProviderErrorCode.FileExists);
          }
        } else {
          if (!opts.create) {
            throw createFileSystemProviderError(localize("fileNotExists", "File does not exist"), FileSystemProviderErrorCode.FileNotFound);
          }
        }
      }
      handle = await this.open(resource, { create: true, unlock: opts.unlock }, disableWriteLock);
      await this.write(handle, 0, content, 0, content.byteLength);
    } catch (error) {
      throw await this.toFileSystemProviderWriteError(resource, error);
    } finally {
      if (typeof handle === "number") {
        await this.close(handle);
      }
    }
  }
  static configureFlushOnWrite(enabled) {
    _DiskFileSystemProvider.canFlush = enabled;
  }
  async open(resource, opts, disableWriteLock) {
    const filePath = this.toFilePath(resource);
    let lock = void 0;
    if (isFileOpenForWriteOptions(opts) && !disableWriteLock) {
      lock = await this.createResourceLock(resource);
    }
    let fd = void 0;
    try {
      if (isFileOpenForWriteOptions(opts) && opts.unlock) {
        try {
          const { stat } = await SymlinkSupport.stat(filePath);
          if (!(stat.mode & 128)) {
            await promises.chmod(filePath, stat.mode | 128);
          }
        } catch (error) {
          if (error.code !== "ENOENT") {
            this.logService.trace(error);
          }
        }
      }
      if (isWindows && isFileOpenForWriteOptions(opts)) {
        try {
          fd = await Promises.open(filePath, "r+");
          await Promises.ftruncate(fd, 0);
        } catch (error) {
          if (error.code !== "ENOENT") {
            this.logService.trace(error);
          }
          if (typeof fd === "number") {
            try {
              await Promises.close(fd);
            } catch (error2) {
              this.logService.trace(error2);
            }
            fd = void 0;
          }
        }
      }
      if (typeof fd !== "number") {
        fd = await Promises.open(
          filePath,
          isFileOpenForWriteOptions(opts) ? (
            // We take `opts.create` as a hint that the file is opened for writing
            // as such we use 'w' to truncate an existing or create the
            // file otherwise. we do not allow reading.
            "w"
          ) : (
            // Otherwise we assume the file is opened for reading
            // as such we use 'r' to neither truncate, nor create
            // the file.
            "r"
          )
        );
      }
    } catch (error) {
      lock?.dispose();
      if (isFileOpenForWriteOptions(opts)) {
        throw await this.toFileSystemProviderWriteError(resource, error);
      } else {
        throw this.toFileSystemProviderError(error);
      }
    }
    this.mapHandleToPos.set(fd, 0);
    if (isFileOpenForWriteOptions(opts)) {
      this.writeHandles.set(fd, resource);
    }
    if (lock) {
      const previousLock = this.mapHandleToLock.get(fd);
      this.traceLock(`[Disk FileSystemProvider]: open() - storing lock for handle ${fd} (${filePath})`);
      this.mapHandleToLock.set(fd, lock);
      if (previousLock) {
        this.traceLock(`[Disk FileSystemProvider]: open() - disposing a previous lock that was still stored on same handle ${fd} (${filePath})`);
        previousLock.dispose();
      }
    }
    return fd;
  }
  async close(fd) {
    const lockForHandle = this.mapHandleToLock.get(fd);
    try {
      this.mapHandleToPos.delete(fd);
      if (this.writeHandles.delete(fd) && _DiskFileSystemProvider.canFlush) {
        try {
          await Promises.fdatasync(fd);
        } catch (error) {
          _DiskFileSystemProvider.configureFlushOnWrite(false);
          this.logService.error(error);
        }
      }
      return await Promises.close(fd);
    } catch (error) {
      throw this.toFileSystemProviderError(error);
    } finally {
      if (lockForHandle) {
        if (this.mapHandleToLock.get(fd) === lockForHandle) {
          this.traceLock(`[Disk FileSystemProvider]: close() - resource lock removed from handle-lock map ${fd}`);
          this.mapHandleToLock.delete(fd);
        }
        this.traceLock(`[Disk FileSystemProvider]: close() - disposing lock for handle ${fd}`);
        lockForHandle.dispose();
      }
    }
  }
  async read(fd, pos, data, offset, length) {
    const normalizedPos = this.normalizePos(fd, pos);
    let bytesRead = null;
    try {
      bytesRead = (await Promises.read(fd, data, offset, length, normalizedPos)).bytesRead;
    } catch (error) {
      throw this.toFileSystemProviderError(error);
    } finally {
      this.updatePos(fd, normalizedPos, bytesRead);
    }
    return bytesRead;
  }
  normalizePos(fd, pos) {
    if (pos === this.mapHandleToPos.get(fd)) {
      return null;
    }
    return pos;
  }
  updatePos(fd, pos, bytesLength) {
    const lastKnownPos = this.mapHandleToPos.get(fd);
    if (typeof lastKnownPos === "number") {
      if (typeof pos === "number") {
      } else if (typeof bytesLength === "number") {
        this.mapHandleToPos.set(fd, lastKnownPos + bytesLength);
      } else {
        this.mapHandleToPos.delete(fd);
      }
    }
  }
  async write(fd, pos, data, offset, length) {
    return retry(
      () => this.doWrite(fd, pos, data, offset, length),
      100,
      3
      /* retries */
    );
  }
  async doWrite(fd, pos, data, offset, length) {
    const normalizedPos = this.normalizePos(fd, pos);
    let bytesWritten = null;
    try {
      bytesWritten = (await Promises.write(fd, data, offset, length, normalizedPos)).bytesWritten;
    } catch (error) {
      throw await this.toFileSystemProviderWriteError(this.writeHandles.get(fd), error);
    } finally {
      this.updatePos(fd, normalizedPos, bytesWritten);
    }
    return bytesWritten;
  }
  //#endregion
  //#region Move/Copy/Delete/Create Folder
  async mkdir(resource) {
    try {
      await promises.mkdir(this.toFilePath(resource));
    } catch (error) {
      throw this.toFileSystemProviderError(error);
    }
  }
  async delete(resource, opts) {
    try {
      const filePath = this.toFilePath(resource);
      if (opts.recursive) {
        let rmMoveToPath = void 0;
        if (opts?.atomic !== false && opts.atomic.postfix) {
          rmMoveToPath = join(dirname(filePath), `${basename(filePath)}${opts.atomic.postfix}`);
        }
        await Promises.rm(filePath, RimRafMode.MOVE, rmMoveToPath);
      } else {
        try {
          await promises.unlink(filePath);
        } catch (unlinkError) {
          if (unlinkError.code === "EPERM" || unlinkError.code === "EISDIR") {
            let isDirectory = false;
            try {
              const { stat, symbolicLink } = await SymlinkSupport.stat(filePath);
              isDirectory = stat.isDirectory() && !symbolicLink;
            } catch (statError) {
            }
            if (isDirectory) {
              await promises.rmdir(filePath);
            } else {
              throw unlinkError;
            }
          } else {
            throw unlinkError;
          }
        }
      }
    } catch (error) {
      throw this.toFileSystemProviderError(error);
    }
  }
  async rename(from, to, opts) {
    const fromFilePath = this.toFilePath(from);
    const toFilePath = this.toFilePath(to);
    if (fromFilePath === toFilePath) {
      return;
    }
    try {
      await this.validateMoveCopy(from, to, "move", opts.overwrite);
      await Promises.rename(fromFilePath, toFilePath);
    } catch (error) {
      if (error.code === "EINVAL" || error.code === "EBUSY" || error.code === "ENAMETOOLONG") {
        error = new Error(localize("moveError", "Unable to move '{0}' into '{1}' ({2}).", basename(fromFilePath), basename(dirname(toFilePath)), error.toString()));
      }
      throw this.toFileSystemProviderError(error);
    }
  }
  async copy(from, to, opts) {
    const fromFilePath = this.toFilePath(from);
    const toFilePath = this.toFilePath(to);
    if (fromFilePath === toFilePath) {
      return;
    }
    try {
      await this.validateMoveCopy(from, to, "copy", opts.overwrite);
      await Promises.copy(fromFilePath, toFilePath, { preserveSymlinks: true });
    } catch (error) {
      if (error.code === "EINVAL" || error.code === "EBUSY" || error.code === "ENAMETOOLONG") {
        error = new Error(localize("copyError", "Unable to copy '{0}' into '{1}' ({2}).", basename(fromFilePath), basename(dirname(toFilePath)), error.toString()));
      }
      throw this.toFileSystemProviderError(error);
    }
  }
  async validateMoveCopy(from, to, mode, overwrite) {
    const fromFilePath = this.toFilePath(from);
    const toFilePath = this.toFilePath(to);
    let isSameResourceWithDifferentPathCase = false;
    const isPathCaseSensitive = !!(this.capabilities & FileSystemProviderCapabilities.PathCaseSensitive);
    if (!isPathCaseSensitive) {
      isSameResourceWithDifferentPathCase = isEqual(
        fromFilePath,
        toFilePath,
        true
        /* ignore case */
      );
    }
    if (isSameResourceWithDifferentPathCase) {
      if (mode === "copy") {
        throw createFileSystemProviderError(localize("fileCopyErrorPathCase", "File cannot be copied to same path with different path case"), FileSystemProviderErrorCode.FileExists);
      } else if (mode === "move") {
        return;
      }
    }
    const fromStat = await this.statIgnoreError(from);
    if (!fromStat) {
      throw createFileSystemProviderError(localize("fileMoveCopyErrorNotFound", "File to move/copy does not exist"), FileSystemProviderErrorCode.FileNotFound);
    }
    const toStat = await this.statIgnoreError(to);
    if (!toStat) {
      return;
    }
    if (!overwrite) {
      throw createFileSystemProviderError(localize("fileMoveCopyErrorExists", "File at target already exists and thus will not be moved/copied to unless overwrite is specified"), FileSystemProviderErrorCode.FileExists);
    }
    if ((fromStat.type & FileType.File) !== 0 && (toStat.type & FileType.File) !== 0) {
      return;
    } else {
      await this.delete(to, { recursive: true, useTrash: false, atomic: false });
    }
  }
  //#endregion
  //#region Clone File
  async cloneFile(from, to) {
    return this.doCloneFile(
      from,
      to,
      false
      /* optimistically assume parent folders exist */
    );
  }
  async doCloneFile(from, to, mkdir) {
    const fromFilePath = this.toFilePath(from);
    const toFilePath = this.toFilePath(to);
    const isPathCaseSensitive = !!(this.capabilities & FileSystemProviderCapabilities.PathCaseSensitive);
    if (isEqual(fromFilePath, toFilePath, !isPathCaseSensitive)) {
      return;
    }
    const locks = new DisposableStore();
    try {
      locks.add(await this.createResourceLock(from));
      locks.add(await this.createResourceLock(to));
      if (mkdir) {
        await promises.mkdir(dirname(toFilePath), { recursive: true });
      }
      await promises.copyFile(fromFilePath, toFilePath);
    } catch (error) {
      if (error.code === "ENOENT" && !mkdir) {
        return this.doCloneFile(from, to, true);
      }
      throw this.toFileSystemProviderError(error);
    } finally {
      locks.dispose();
    }
  }
  //#endregion
  //#region File Watching
  createUniversalWatcher(onChange, onLogMessage, verboseLogging) {
    return new UniversalWatcherClient((changes) => onChange(changes), (msg) => onLogMessage(msg), verboseLogging);
  }
  createNonRecursiveWatcher(onChange, onLogMessage, verboseLogging) {
    return new NodeJSWatcherClient((changes) => onChange(changes), (msg) => onLogMessage(msg), verboseLogging);
  }
  //#endregion
  //#region Helpers
  toFileSystemProviderError(error) {
    if (error instanceof FileSystemProviderError) {
      return error;
    }
    let resultError = error;
    let code;
    switch (error.code) {
      case "ENOENT":
        code = FileSystemProviderErrorCode.FileNotFound;
        break;
      case "EISDIR":
        code = FileSystemProviderErrorCode.FileIsADirectory;
        break;
      case "ENOTDIR":
        code = FileSystemProviderErrorCode.FileNotADirectory;
        break;
      case "EEXIST":
        code = FileSystemProviderErrorCode.FileExists;
        break;
      case "EPERM":
      case "EACCES":
        code = FileSystemProviderErrorCode.NoPermissions;
        break;
      case "ERR_UNC_HOST_NOT_ALLOWED":
        resultError = `${error.message}. Please update the 'security.allowedUNCHosts' setting if you want to allow this host.`;
        code = FileSystemProviderErrorCode.Unknown;
        break;
      default:
        code = FileSystemProviderErrorCode.Unknown;
    }
    return createFileSystemProviderError(resultError, code);
  }
  async toFileSystemProviderWriteError(resource, error) {
    let fileSystemProviderWriteError = this.toFileSystemProviderError(error);
    if (resource && fileSystemProviderWriteError.code === FileSystemProviderErrorCode.NoPermissions) {
      try {
        const { stat } = await SymlinkSupport.stat(this.toFilePath(resource));
        if (!(stat.mode & 128)) {
          fileSystemProviderWriteError = createFileSystemProviderError(error, FileSystemProviderErrorCode.FileWriteLocked);
        }
      } catch (error2) {
        this.logService.trace(error2);
      }
    }
    return fileSystemProviderWriteError;
  }
  //#endregion
};
_DiskFileSystemProvider.TRACE_LOG_RESOURCE_LOCKS = false;
_DiskFileSystemProvider.canFlush = true;
let DiskFileSystemProvider = _DiskFileSystemProvider;
export {
  DiskFileSystemProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9maWxlcy9ub2RlL2Rpc2tGaWxlU3lzdGVtUHJvdmlkZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBTdGF0cywgcHJvbWlzZXMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBCYXJyaWVyLCByZXRyeSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IFJlc291cmNlTWFwIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V4dHBhdGguanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lLCBkaXJuYW1lLCBqb2luIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBpc0xpbnV4LCBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBleHRVcmlCaWFzZWRJZ25vcmVQYXRoQ2FzZSwgam9pblBhdGgsIGJhc2VuYW1lIGFzIHJlc291cmNlc0Jhc2VuYW1lLCBkaXJuYW1lIGFzIHJlc291cmNlc0Rpcm5hbWUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgbmV3V3JpdGVhYmxlU3RyZWFtLCBSZWFkYWJsZVN0cmVhbUV2ZW50cyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmVhbS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSURpcmVudCwgUHJvbWlzZXMsIFJpbVJhZk1vZGUsIFN5bWxpbmtTdXBwb3J0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9ub2RlL3Bmcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVGaWxlU3lzdGVtUHJvdmlkZXJFcnJvciwgSUZpbGVBdG9taWNSZWFkT3B0aW9ucywgSUZpbGVEZWxldGVPcHRpb25zLCBJRmlsZU9wZW5PcHRpb25zLCBJRmlsZU92ZXJ3cml0ZU9wdGlvbnMsIElGaWxlUmVhZFN0cmVhbU9wdGlvbnMsIEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcywgRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3IsIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZSwgRmlsZVR5cGUsIElGaWxlV3JpdGVPcHRpb25zLCBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVBdG9taWNSZWFkQ2FwYWJpbGl0eSwgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlQ2xvbmVDYXBhYmlsaXR5LCBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVGb2xkZXJDb3B5Q2FwYWJpbGl0eSwgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlUmVhZFN0cmVhbUNhcGFiaWxpdHksIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZVJlYWRXcml0ZUNhcGFiaWxpdHksIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoT3BlblJlYWRXcml0ZUNsb3NlQ2FwYWJpbGl0eSwgaXNGaWxlT3BlbkZvcldyaXRlT3B0aW9ucywgSVN0YXQsIEZpbGVQZXJtaXNzaW9uLCBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVBdG9taWNXcml0ZUNhcGFiaWxpdHksIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZUF0b21pY0RlbGV0ZUNhcGFiaWxpdHksIElGaWxlQ2hhbmdlIH0gZnJvbSAnLi4vY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IHJlYWRGaWxlSW50b1N0cmVhbSB9IGZyb20gJy4uL2NvbW1vbi9pby5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdE5vblJlY3Vyc2l2ZVdhdGNoZXJDbGllbnQsIEFic3RyYWN0VW5pdmVyc2FsV2F0Y2hlckNsaWVudCwgSUxvZ01lc3NhZ2UgfSBmcm9tICcuLi9jb21tb24vd2F0Y2hlci5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IEFic3RyYWN0RGlza0ZpbGVTeXN0ZW1Qcm92aWRlciwgSURpc2tGaWxlU3lzdGVtUHJvdmlkZXJPcHRpb25zIH0gZnJvbSAnLi4vY29tbW9uL2Rpc2tGaWxlU3lzdGVtUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgVW5pdmVyc2FsV2F0Y2hlckNsaWVudCB9IGZyb20gJy4vd2F0Y2hlci93YXRjaGVyQ2xpZW50LmpzJztcbmltcG9ydCB7IE5vZGVKU1dhdGNoZXJDbGllbnQgfSBmcm9tICcuL3dhdGNoZXIvbm9kZWpzL25vZGVqc0NsaWVudC5qcyc7XG5cbmV4cG9ydCBjbGFzcyBEaXNrRmlsZVN5c3RlbVByb3ZpZGVyIGV4dGVuZHMgQWJzdHJhY3REaXNrRmlsZVN5c3RlbVByb3ZpZGVyIGltcGxlbWVudHNcblx0SUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlUmVhZFdyaXRlQ2FwYWJpbGl0eSxcblx0SUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhPcGVuUmVhZFdyaXRlQ2xvc2VDYXBhYmlsaXR5LFxuXHRJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVSZWFkU3RyZWFtQ2FwYWJpbGl0eSxcblx0SUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlRm9sZGVyQ29weUNhcGFiaWxpdHksXG5cdElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZUF0b21pY1JlYWRDYXBhYmlsaXR5LFxuXHRJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVBdG9taWNXcml0ZUNhcGFiaWxpdHksXG5cdElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZUF0b21pY0RlbGV0ZUNhcGFiaWxpdHksXG5cdElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZUNsb25lQ2FwYWJpbGl0eSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgVFJBQ0VfTE9HX1JFU09VUkNFX0xPQ0tTID0gZmFsc2U7IC8vIG5vdCBlbmFibGVkIGJ5IGRlZmF1bHQgYmVjYXVzZSB2ZXJ5IHNwYW1teVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdG9wdGlvbnM/OiBJRGlza0ZpbGVTeXN0ZW1Qcm92aWRlck9wdGlvbnNcblx0KSB7XG5cdFx0c3VwZXIobG9nU2VydmljZSwgb3B0aW9ucyk7XG5cdH1cblxuXHQvLyNyZWdpb24gRmlsZSBDYXBhYmlsaXRpZXNcblxuXHRyZWFkb25seSBvbkRpZENoYW5nZUNhcGFiaWxpdGllcyA9IEV2ZW50Lk5vbmU7XG5cblx0cHJpdmF0ZSBfY2FwYWJpbGl0aWVzOiBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMgfCB1bmRlZmluZWQ7XG5cdGdldCBjYXBhYmlsaXRpZXMoKTogRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzIHtcblx0XHRpZiAoIXRoaXMuX2NhcGFiaWxpdGllcykge1xuXHRcdFx0dGhpcy5fY2FwYWJpbGl0aWVzID1cblx0XHRcdFx0RmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLkZpbGVSZWFkV3JpdGUgfFxuXHRcdFx0XHRGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuRmlsZU9wZW5SZWFkV3JpdGVDbG9zZSB8XG5cdFx0XHRcdEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5GaWxlUmVhZFN0cmVhbSB8XG5cdFx0XHRcdEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5GaWxlRm9sZGVyQ29weSB8XG5cdFx0XHRcdEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5GaWxlV3JpdGVVbmxvY2sgfFxuXHRcdFx0XHRGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuRmlsZUF0b21pY1JlYWQgfFxuXHRcdFx0XHRGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuRmlsZUF0b21pY1dyaXRlIHxcblx0XHRcdFx0RmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLkZpbGVBdG9taWNEZWxldGUgfFxuXHRcdFx0XHRGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuRmlsZUNsb25lO1xuXG5cdFx0XHRpZiAoaXNMaW51eCkge1xuXHRcdFx0XHR0aGlzLl9jYXBhYmlsaXRpZXMgfD0gRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLlBhdGhDYXNlU2Vuc2l0aXZlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9jYXBhYmlsaXRpZXM7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gRmlsZSBNZXRhZGF0YSBSZXNvbHZpbmdcblxuXHRhc3luYyBzdGF0KHJlc291cmNlOiBVUkkpOiBQcm9taXNlPElTdGF0PiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHsgc3RhdCwgc3ltYm9saWNMaW5rIH0gPSBhd2FpdCBTeW1saW5rU3VwcG9ydC5zdGF0KHRoaXMudG9GaWxlUGF0aChyZXNvdXJjZSkpOyAvLyBjYW5ub3QgdXNlIGZzLnN0YXQoKSBoZXJlIHRvIHN1cHBvcnQgbGlua3MgcHJvcGVybHlcblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dHlwZTogdGhpcy50b1R5cGUoc3RhdCwgc3ltYm9saWNMaW5rKSxcblx0XHRcdFx0Y3RpbWU6IHN0YXQuYmlydGh0aW1lLmdldFRpbWUoKSwgLy8gaW50ZW50aW9uYWxseSBub3QgdXNpbmcgY3RpbWUgaGVyZSwgd2Ugd2FudCB0aGUgY3JlYXRpb24gdGltZVxuXHRcdFx0XHRtdGltZTogc3RhdC5tdGltZS5nZXRUaW1lKCksXG5cdFx0XHRcdHNpemU6IHN0YXQuc2l6ZSxcblx0XHRcdFx0cGVybWlzc2lvbnM6IChzdGF0Lm1vZGUgJiAwbzIwMCkgPT09IDAgPyBGaWxlUGVybWlzc2lvbi5Mb2NrZWQgOiB1bmRlZmluZWRcblx0XHRcdH07XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRocm93IHRoaXMudG9GaWxlU3lzdGVtUHJvdmlkZXJFcnJvcihlcnJvcik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzdGF0SWdub3JlRXJyb3IocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8SVN0YXQgfCB1bmRlZmluZWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIGF3YWl0IHRoaXMuc3RhdChyZXNvdXJjZSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcmVhZGRpcihyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxbc3RyaW5nLCBGaWxlVHlwZV1bXT4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBjaGlsZHJlbiA9IGF3YWl0IFByb21pc2VzLnJlYWRkaXIodGhpcy50b0ZpbGVQYXRoKHJlc291cmNlKSwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pO1xuXG5cdFx0XHRjb25zdCByZXN1bHQ6IFtzdHJpbmcsIEZpbGVUeXBlXVtdID0gW107XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChjaGlsZHJlbi5tYXAoYXN5bmMgY2hpbGQgPT4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGxldCB0eXBlOiBGaWxlVHlwZTtcblx0XHRcdFx0XHRpZiAoY2hpbGQuaXNTeW1ib2xpY0xpbmsoKSkge1xuXHRcdFx0XHRcdFx0dHlwZSA9IChhd2FpdCB0aGlzLnN0YXQoam9pblBhdGgocmVzb3VyY2UsIGNoaWxkLm5hbWUpKSkudHlwZTsgLy8gYWx3YXlzIHJlc29sdmUgdGFyZ2V0IHRoZSBsaW5rIHBvaW50cyB0byBpZiBhbnlcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dHlwZSA9IHRoaXMudG9UeXBlKGNoaWxkKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXN1bHQucHVzaChbY2hpbGQubmFtZSwgdHlwZV0pO1xuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShlcnJvcik7IC8vIGlnbm9yZSBlcnJvcnMgZm9yIGluZGl2aWR1YWwgZW50cmllcyB0aGF0IGNhbiBhcmlzZSBmcm9tIHBlcm1pc3Npb24gZGVuaWVkXG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhyb3cgdGhpcy50b0ZpbGVTeXN0ZW1Qcm92aWRlckVycm9yKGVycm9yKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHRvVHlwZShlbnRyeTogU3RhdHMgfCBJRGlyZW50LCBzeW1ib2xpY0xpbms/OiB7IGRhbmdsaW5nOiBib29sZWFuIH0pOiBGaWxlVHlwZSB7XG5cblx0XHQvLyBTaWduYWwgZmlsZSB0eXBlIGJ5IGNoZWNraW5nIGZvciBmaWxlIC8gZGlyZWN0b3J5LCBleGNlcHQ6XG5cdFx0Ly8gLSBzeW1ib2xpYyBsaW5rcyBwb2ludGluZyB0byBub25leGlzdGVudCBmaWxlcyBhcmUgRmlsZVR5cGUuVW5rbm93blxuXHRcdC8vIC0gZmlsZXMgdGhhdCBhcmUgbmVpdGhlciBmaWxlIG5vciBkaXJlY3RvcnkgYXJlIEZpbGVUeXBlLlVua25vd25cblx0XHRsZXQgdHlwZTogRmlsZVR5cGU7XG5cdFx0aWYgKHN5bWJvbGljTGluaz8uZGFuZ2xpbmcpIHtcblx0XHRcdHR5cGUgPSBGaWxlVHlwZS5Vbmtub3duO1xuXHRcdH0gZWxzZSBpZiAoZW50cnkuaXNGaWxlKCkpIHtcblx0XHRcdHR5cGUgPSBGaWxlVHlwZS5GaWxlO1xuXHRcdH0gZWxzZSBpZiAoZW50cnkuaXNEaXJlY3RvcnkoKSkge1xuXHRcdFx0dHlwZSA9IEZpbGVUeXBlLkRpcmVjdG9yeTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dHlwZSA9IEZpbGVUeXBlLlVua25vd247XG5cdFx0fVxuXG5cdFx0Ly8gQWx3YXlzIHNpZ25hbCBzeW1ib2xpYyBsaW5rIGFzIGZpbGUgdHlwZSBhZGRpdGlvbmFsbHlcblx0XHRpZiAoc3ltYm9saWNMaW5rKSB7XG5cdFx0XHR0eXBlIHw9IEZpbGVUeXBlLlN5bWJvbGljTGluaztcblx0XHR9XG5cblx0XHRyZXR1cm4gdHlwZTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBGaWxlIFJlYWRpbmcvV3JpdGluZ1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgcmVzb3VyY2VMb2NrcyA9IG5ldyBSZXNvdXJjZU1hcDxCYXJyaWVyPihyZXNvdXJjZSA9PiBleHRVcmlCaWFzZWRJZ25vcmVQYXRoQ2FzZS5nZXRDb21wYXJpc29uS2V5KHJlc291cmNlKSk7XG5cblx0cHJpdmF0ZSBhc3luYyBjcmVhdGVSZXNvdXJjZUxvY2socmVzb3VyY2U6IFVSSSk6IFByb21pc2U8SURpc3Bvc2FibGU+IHtcblx0XHRjb25zdCBmaWxlUGF0aCA9IHRoaXMudG9GaWxlUGF0aChyZXNvdXJjZSk7XG5cdFx0dGhpcy50cmFjZUxvY2soYFtEaXNrIEZpbGVTeXN0ZW1Qcm92aWRlcl06IGNyZWF0ZVJlc291cmNlTG9jaygpIC0gcmVxdWVzdCB0byBhY3F1aXJlIHJlc291cmNlIGxvY2sgKCR7ZmlsZVBhdGh9KWApO1xuXG5cdFx0Ly8gQXdhaXQgcGVuZGluZyBsb2NrcyBmb3IgcmVzb3VyY2UuIEl0IGlzIHBvc3NpYmxlIGZvciBhIG5ldyBsb2NrIGJlaW5nXG5cdFx0Ly8gYWRkZWQgcmlnaHQgYWZ0ZXIgb3BlbmluZywgc28gd2UgaGF2ZSB0byBsb29wIG92ZXIgbG9ja3MgdW50aWwgbm8gbG9ja1xuXHRcdC8vIHJlbWFpbnMuXG5cdFx0bGV0IGV4aXN0aW5nTG9jazogQmFycmllciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHR3aGlsZSAoZXhpc3RpbmdMb2NrID0gdGhpcy5yZXNvdXJjZUxvY2tzLmdldChyZXNvdXJjZSkpIHtcblx0XHRcdHRoaXMudHJhY2VMb2NrKGBbRGlzayBGaWxlU3lzdGVtUHJvdmlkZXJdOiBjcmVhdGVSZXNvdXJjZUxvY2soKSAtIHdhaXRpbmcgZm9yIHJlc291cmNlIGxvY2sgdG8gYmUgcmVsZWFzZWQgKCR7ZmlsZVBhdGh9KWApO1xuXHRcdFx0YXdhaXQgZXhpc3RpbmdMb2NrLndhaXQoKTtcblx0XHR9XG5cblx0XHQvLyBTdG9yZSBuZXdcblx0XHRjb25zdCBuZXdMb2NrID0gbmV3IEJhcnJpZXIoKTtcblx0XHR0aGlzLnJlc291cmNlTG9ja3Muc2V0KHJlc291cmNlLCBuZXdMb2NrKTtcblxuXHRcdHRoaXMudHJhY2VMb2NrKGBbRGlzayBGaWxlU3lzdGVtUHJvdmlkZXJdOiBjcmVhdGVSZXNvdXJjZUxvY2soKSAtIG5ldyByZXNvdXJjZSBsb2NrIGNyZWF0ZWQgKCR7ZmlsZVBhdGh9KWApO1xuXG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLnRyYWNlTG9jayhgW0Rpc2sgRmlsZVN5c3RlbVByb3ZpZGVyXTogY3JlYXRlUmVzb3VyY2VMb2NrKCkgLSByZXNvdXJjZSBsb2NrIGRpc3Bvc2UoKSAoJHtmaWxlUGF0aH0pYCk7XG5cblx0XHRcdC8vIERlbGV0ZSBsb2NrIGlmIGl0IGlzIHN0aWxsIG91cnNcblx0XHRcdGlmICh0aGlzLnJlc291cmNlTG9ja3MuZ2V0KHJlc291cmNlKSA9PT0gbmV3TG9jaykge1xuXHRcdFx0XHR0aGlzLnRyYWNlTG9jayhgW0Rpc2sgRmlsZVN5c3RlbVByb3ZpZGVyXTogY3JlYXRlUmVzb3VyY2VMb2NrKCkgLSByZXNvdXJjZSBsb2NrIHJlbW92ZWQgZnJvbSByZXNvdXJjZS1sb2NrIG1hcCAoJHtmaWxlUGF0aH0pYCk7XG5cdFx0XHRcdHRoaXMucmVzb3VyY2VMb2Nrcy5kZWxldGUocmVzb3VyY2UpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBPcGVuIGxvY2tcblx0XHRcdHRoaXMudHJhY2VMb2NrKGBbRGlzayBGaWxlU3lzdGVtUHJvdmlkZXJdOiBjcmVhdGVSZXNvdXJjZUxvY2soKSAtIHJlc291cmNlIGxvY2sgYmFycmllciBvcGVuKCkgKCR7ZmlsZVBhdGh9KWApO1xuXHRcdFx0bmV3TG9jay5vcGVuKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyByZWFkRmlsZShyZXNvdXJjZTogVVJJLCBvcHRpb25zPzogSUZpbGVBdG9taWNSZWFkT3B0aW9ucyk6IFByb21pc2U8VWludDhBcnJheT4ge1xuXHRcdGxldCBsb2NrOiBJRGlzcG9zYWJsZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0aWYgKG9wdGlvbnM/LmF0b21pYykge1xuXHRcdFx0XHR0aGlzLnRyYWNlTG9jayhgW0Rpc2sgRmlsZVN5c3RlbVByb3ZpZGVyXTogYXRvbWljIHJlYWQgb3BlcmF0aW9uIHN0YXJ0ZWQgKCR7dGhpcy50b0ZpbGVQYXRoKHJlc291cmNlKX0pYCk7XG5cblx0XHRcdFx0Ly8gV2hlbiB0aGUgcmVhZCBzaG91bGQgYmUgYXRvbWljLCBtYWtlIHN1cmVcblx0XHRcdFx0Ly8gdG8gYXdhaXQgYW55IHBlbmRpbmcgbG9ja3MgZm9yIHRoZSByZXNvdXJjZVxuXHRcdFx0XHQvLyBhbmQgbG9jayBmb3IgdGhlIGR1cmF0aW9uIG9mIHRoZSByZWFkLlxuXHRcdFx0XHRsb2NrID0gYXdhaXQgdGhpcy5jcmVhdGVSZXNvdXJjZUxvY2socmVzb3VyY2UpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBmaWxlUGF0aCA9IHRoaXMudG9GaWxlUGF0aChyZXNvdXJjZSk7XG5cblx0XHRcdHJldHVybiBhd2FpdCBwcm9taXNlcy5yZWFkRmlsZShmaWxlUGF0aCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRocm93IHRoaXMudG9GaWxlU3lzdGVtUHJvdmlkZXJFcnJvcihlcnJvcik7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGxvY2s/LmRpc3Bvc2UoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHRyYWNlTG9jayhtc2c6IHN0cmluZyk6IHZvaWQge1xuXHRcdGlmIChEaXNrRmlsZVN5c3RlbVByb3ZpZGVyLlRSQUNFX0xPR19SRVNPVVJDRV9MT0NLUykge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKG1zZyk7XG5cdFx0fVxuXHR9XG5cblx0cmVhZEZpbGVTdHJlYW0ocmVzb3VyY2U6IFVSSSwgb3B0czogSUZpbGVSZWFkU3RyZWFtT3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUmVhZGFibGVTdHJlYW1FdmVudHM8VWludDhBcnJheT4ge1xuXHRcdGNvbnN0IHN0cmVhbSA9IG5ld1dyaXRlYWJsZVN0cmVhbTxVaW50OEFycmF5PihkYXRhID0+IFZTQnVmZmVyLmNvbmNhdChkYXRhLm1hcChkYXRhID0+IFZTQnVmZmVyLndyYXAoZGF0YSkpKS5idWZmZXIpO1xuXG5cdFx0cmVhZEZpbGVJbnRvU3RyZWFtKHRoaXMsIHJlc291cmNlLCBzdHJlYW0sIGRhdGEgPT4gZGF0YS5idWZmZXIsIHtcblx0XHRcdC4uLm9wdHMsXG5cdFx0XHRidWZmZXJTaXplOiAyNTYgKiAxMDI0IC8vIHJlYWQgaW50byBjaHVua3Mgb2YgMjU2a2IgZWFjaCB0byByZWR1Y2UgSVBDIG92ZXJoZWFkXG5cdFx0fSwgdG9rZW4pO1xuXG5cdFx0cmV0dXJuIHN0cmVhbTtcblx0fVxuXG5cdGFzeW5jIHdyaXRlRmlsZShyZXNvdXJjZTogVVJJLCBjb250ZW50OiBVaW50OEFycmF5LCBvcHRzOiBJRmlsZVdyaXRlT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChvcHRzPy5hdG9taWMgIT09IGZhbHNlICYmIG9wdHM/LmF0b21pYz8ucG9zdGZpeCAmJiBhd2FpdCB0aGlzLmNhbldyaXRlRmlsZUF0b21pYyhyZXNvdXJjZSkpIHtcblx0XHRcdHJldHVybiB0aGlzLmRvV3JpdGVGaWxlQXRvbWljKHJlc291cmNlLCBqb2luUGF0aChyZXNvdXJjZXNEaXJuYW1lKHJlc291cmNlKSwgYCR7cmVzb3VyY2VzQmFzZW5hbWUocmVzb3VyY2UpfSR7b3B0cy5hdG9taWMucG9zdGZpeH1gKSwgY29udGVudCwgb3B0cyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB0aGlzLmRvV3JpdGVGaWxlKHJlc291cmNlLCBjb250ZW50LCBvcHRzKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNhbldyaXRlRmlsZUF0b21pYyhyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGZpbGVQYXRoID0gdGhpcy50b0ZpbGVQYXRoKHJlc291cmNlKTtcblx0XHRcdGNvbnN0IHsgc3ltYm9saWNMaW5rIH0gPSBhd2FpdCBTeW1saW5rU3VwcG9ydC5zdGF0KGZpbGVQYXRoKTtcblx0XHRcdGlmIChzeW1ib2xpY0xpbmspIHtcblx0XHRcdFx0Ly8gYXRvbWljIHdyaXRlcyBhcmUgdW5zdXBwb3J0ZWQgZm9yIHN5bWJvbGljIGxpbmtzIGJlY2F1c2Vcblx0XHRcdFx0Ly8gd2UgbmVlZCB0byBlbnN1cmUgdGhhdCB0aGUgYHJlbmFtZWAgb3BlcmF0aW9uIGlzIGF0b21pY1xuXHRcdFx0XHQvLyBhbmQgdGhhdCBvbmx5IHdvcmtzIGlmIHRoZSBsaW5rIGlzIG9uIHRoZSBzYW1lIGRpc2suXG5cdFx0XHRcdC8vIFNpbmNlIHdlIGRvIG5vdCBrbm93IHdoZXJlIHRoZSBzeW1ib2xpYyBsaW5rIHBvaW50cyB0b1xuXHRcdFx0XHQvLyB3ZSByZWZ1c2UgdG8gd3JpdGUgYXRvbWljYWxseS5cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHQvLyBpZ25vcmUgc3RhdCBlcnJvcnMgaGVyZSBhbmQganVzdCBwcm9jZWVkIHRyeWluZyB0byB3cml0ZVxuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlOyAvLyBhdG9taWMgd3JpdGluZyBzdXBwb3J0ZWRcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9Xcml0ZUZpbGVBdG9taWMocmVzb3VyY2U6IFVSSSwgdGVtcFJlc291cmNlOiBVUkksIGNvbnRlbnQ6IFVpbnQ4QXJyYXksIG9wdHM6IElGaWxlV3JpdGVPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBFbnN1cmUgdG8gY3JlYXRlIGxvY2tzIGZvciBhbGwgcmVzb3VyY2VzIGludm9sdmVkXG5cdFx0Ly8gc2luY2UgYXRvbWljIHdyaXRlIGludm9sdmVzIG11dGlwbGUgZGlzayBvcGVyYXRpb25zXG5cdFx0Ly8gYW5kIHJlc291cmNlcy5cblxuXHRcdGNvbnN0IGxvY2tzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGxvY2tzLmFkZChhd2FpdCB0aGlzLmNyZWF0ZVJlc291cmNlTG9jayhyZXNvdXJjZSkpO1xuXHRcdFx0bG9ja3MuYWRkKGF3YWl0IHRoaXMuY3JlYXRlUmVzb3VyY2VMb2NrKHRlbXBSZXNvdXJjZSkpO1xuXG5cdFx0XHQvLyBXcml0ZSB0byB0ZW1wIHJlc291cmNlIGZpcnN0XG5cdFx0XHRhd2FpdCB0aGlzLmRvV3JpdGVGaWxlKHRlbXBSZXNvdXJjZSwgY29udGVudCwgb3B0cywgdHJ1ZSAvKiBkaXNhYmxlIHdyaXRlIGxvY2sgKi8pO1xuXG5cdFx0XHR0cnkge1xuXG5cdFx0XHRcdC8vIFJlbmFtZSBvdmVyIGV4aXN0aW5nIHRvIGVuc3VyZSBhdG9taWMgcmVwbGFjZVxuXHRcdFx0XHRhd2FpdCB0aGlzLnJlbmFtZSh0ZW1wUmVzb3VyY2UsIHJlc291cmNlLCB7IG92ZXJ3cml0ZTogdHJ1ZSB9KTtcblxuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblxuXHRcdFx0XHQvLyBDbGVhbnVwIGluIGNhc2Ugb2YgcmVuYW1lIGVycm9yXG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5kZWxldGUodGVtcFJlc291cmNlLCB7IHJlY3Vyc2l2ZTogZmFsc2UsIHVzZVRyYXNoOiBmYWxzZSwgYXRvbWljOiBmYWxzZSB9KTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHQvLyBpZ25vcmUgLSB3ZSB3YW50IHRoZSBvdXRlciBlcnJvciB0byBidWJibGUgdXBcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0fVxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRsb2Nrcy5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1dyaXRlRmlsZShyZXNvdXJjZTogVVJJLCBjb250ZW50OiBVaW50OEFycmF5LCBvcHRzOiBJRmlsZVdyaXRlT3B0aW9ucywgZGlzYWJsZVdyaXRlTG9jaz86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRsZXQgaGFuZGxlOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGZpbGVQYXRoID0gdGhpcy50b0ZpbGVQYXRoKHJlc291cmNlKTtcblxuXHRcdFx0Ly8gVmFsaWRhdGUgdGFyZ2V0IHVubGVzcyB7IGNyZWF0ZTogdHJ1ZSwgb3ZlcndyaXRlOiB0cnVlIH1cblx0XHRcdGlmICghb3B0cy5jcmVhdGUgfHwgIW9wdHMub3ZlcndyaXRlKSB7XG5cdFx0XHRcdGNvbnN0IGZpbGVFeGlzdHMgPSBhd2FpdCBQcm9taXNlcy5leGlzdHMoZmlsZVBhdGgpO1xuXHRcdFx0XHRpZiAoZmlsZUV4aXN0cykge1xuXHRcdFx0XHRcdGlmICghb3B0cy5vdmVyd3JpdGUpIHtcblx0XHRcdFx0XHRcdHRocm93IGNyZWF0ZUZpbGVTeXN0ZW1Qcm92aWRlckVycm9yKGxvY2FsaXplKCdmaWxlRXhpc3RzJywgXCJGaWxlIGFscmVhZHkgZXhpc3RzXCIpLCBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvckNvZGUuRmlsZUV4aXN0cyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmICghb3B0cy5jcmVhdGUpIHtcblx0XHRcdFx0XHRcdHRocm93IGNyZWF0ZUZpbGVTeXN0ZW1Qcm92aWRlckVycm9yKGxvY2FsaXplKCdmaWxlTm90RXhpc3RzJywgXCJGaWxlIGRvZXMgbm90IGV4aXN0XCIpLCBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvckNvZGUuRmlsZU5vdEZvdW5kKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gT3BlblxuXHRcdFx0aGFuZGxlID0gYXdhaXQgdGhpcy5vcGVuKHJlc291cmNlLCB7IGNyZWF0ZTogdHJ1ZSwgdW5sb2NrOiBvcHRzLnVubG9jayB9LCBkaXNhYmxlV3JpdGVMb2NrKTtcblxuXHRcdFx0Ly8gV3JpdGUgY29udGVudCBhdCBvbmNlXG5cdFx0XHRhd2FpdCB0aGlzLndyaXRlKGhhbmRsZSwgMCwgY29udGVudCwgMCwgY29udGVudC5ieXRlTGVuZ3RoKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhyb3cgYXdhaXQgdGhpcy50b0ZpbGVTeXN0ZW1Qcm92aWRlcldyaXRlRXJyb3IocmVzb3VyY2UsIGVycm9yKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0aWYgKHR5cGVvZiBoYW5kbGUgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuY2xvc2UoaGFuZGxlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IG1hcEhhbmRsZVRvUG9zID0gbmV3IE1hcDxudW1iZXIsIG51bWJlcj4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBtYXBIYW5kbGVUb0xvY2sgPSBuZXcgTWFwPG51bWJlciwgSURpc3Bvc2FibGU+KCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSB3cml0ZUhhbmRsZXMgPSBuZXcgTWFwPG51bWJlciwgVVJJPigpO1xuXG5cdHByaXZhdGUgc3RhdGljIGNhbkZsdXNoOiBib29sZWFuID0gdHJ1ZTtcblxuXHRzdGF0aWMgY29uZmlndXJlRmx1c2hPbldyaXRlKGVuYWJsZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHREaXNrRmlsZVN5c3RlbVByb3ZpZGVyLmNhbkZsdXNoID0gZW5hYmxlZDtcblx0fVxuXG5cdGFzeW5jIG9wZW4ocmVzb3VyY2U6IFVSSSwgb3B0czogSUZpbGVPcGVuT3B0aW9ucywgZGlzYWJsZVdyaXRlTG9jaz86IGJvb2xlYW4pOiBQcm9taXNlPG51bWJlcj4ge1xuXHRcdGNvbnN0IGZpbGVQYXRoID0gdGhpcy50b0ZpbGVQYXRoKHJlc291cmNlKTtcblxuXHRcdC8vIFdyaXRlczogZ3VhcmQgbXVsdGlwbGUgd3JpdGVzIHRvIHRoZSBzYW1lIHJlc291cmNlXG5cdFx0Ly8gYmVoaW5kIGEgc2luZ2xlIGxvY2sgdG8gcHJldmVudCByYWNlcyB3aGVuIHdyaXRpbmdcblx0XHQvLyBmcm9tIG11bHRpcGxlIHBsYWNlcyBhdCB0aGUgc2FtZSB0aW1lIHRvIHRoZSBzYW1lIGZpbGVcblx0XHRsZXQgbG9jazogSURpc3Bvc2FibGUgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKGlzRmlsZU9wZW5Gb3JXcml0ZU9wdGlvbnMob3B0cykgJiYgIWRpc2FibGVXcml0ZUxvY2spIHtcblx0XHRcdGxvY2sgPSBhd2FpdCB0aGlzLmNyZWF0ZVJlc291cmNlTG9jayhyZXNvdXJjZSk7XG5cdFx0fVxuXG5cdFx0bGV0IGZkOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0dHJ5IHtcblxuXHRcdFx0Ly8gRGV0ZXJtaW5lIHdoZXRoZXIgdG8gdW5sb2NrIHRoZSBmaWxlICh3cml0ZSBvbmx5KVxuXHRcdFx0aWYgKGlzRmlsZU9wZW5Gb3JXcml0ZU9wdGlvbnMob3B0cykgJiYgb3B0cy51bmxvY2spIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCB7IHN0YXQgfSA9IGF3YWl0IFN5bWxpbmtTdXBwb3J0LnN0YXQoZmlsZVBhdGgpO1xuXHRcdFx0XHRcdGlmICghKHN0YXQubW9kZSAmIDBvMjAwIC8qIEZpbGUgbW9kZSBpbmRpY2F0aW5nIHdyaXRhYmxlIGJ5IG93bmVyICovKSkge1xuXHRcdFx0XHRcdFx0YXdhaXQgcHJvbWlzZXMuY2htb2QoZmlsZVBhdGgsIHN0YXQubW9kZSB8IDBvMjAwKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0aWYgKGVycm9yLmNvZGUgIT09ICdFTk9FTlQnKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoZXJyb3IpOyAvLyBsb2cgZXJyb3JzIGJ1dCBkbyBub3QgZ2l2ZSB1cCB3cml0aW5nXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIFdpbmRvd3MgZ2V0cyBzcGVjaWFsIHRyZWF0bWVudCAod3JpdGUgb25seSlcblx0XHRcdGlmIChpc1dpbmRvd3MgJiYgaXNGaWxlT3BlbkZvcldyaXRlT3B0aW9ucyhvcHRzKSkge1xuXHRcdFx0XHR0cnkge1xuXG5cdFx0XHRcdFx0Ly8gV2UgdHJ5IHRvIHVzZSAncisnIGZvciBvcGVuaW5nICh3aGljaCB3aWxsIGZhaWwgaWYgdGhlIGZpbGUgZG9lcyBub3QgZXhpc3QpXG5cdFx0XHRcdFx0Ly8gdG8gcHJldmVudCBpc3N1ZXMgd2hlbiBzYXZpbmcgaGlkZGVuIGZpbGVzIG9yIHByZXNlcnZpbmcgYWx0ZXJuYXRlIGRhdGFcblx0XHRcdFx0XHQvLyBzdHJlYW1zLlxuXHRcdFx0XHRcdC8vIFJlbGF0ZWQgaXNzdWVzOlxuXHRcdFx0XHRcdC8vIC0gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzkzMVxuXHRcdFx0XHRcdC8vIC0gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzYzNjNcblx0XHRcdFx0XHRmZCA9IGF3YWl0IFByb21pc2VzLm9wZW4oZmlsZVBhdGgsICdyKycpO1xuXG5cdFx0XHRcdFx0Ly8gVGhlIGZsYWcgJ3IrJyB3aWxsIG5vdCB0cnVuY2F0ZSB0aGUgZmlsZSwgc28gd2UgaGF2ZSB0byBkbyB0aGlzIG1hbnVhbGx5XG5cdFx0XHRcdFx0YXdhaXQgUHJvbWlzZXMuZnRydW5jYXRlKGZkLCAwKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRpZiAoZXJyb3IuY29kZSAhPT0gJ0VOT0VOVCcpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShlcnJvcik7IC8vIGxvZyBlcnJvcnMgYnV0IGRvIG5vdCBnaXZlIHVwIHdyaXRpbmdcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBNYWtlIHN1cmUgdG8gY2xvc2UgdGhlIGZpbGUgaGFuZGxlIGlmIHdlIGhhdmUgb25lXG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBmZCA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IFByb21pc2VzLmNsb3NlKGZkKTtcblx0XHRcdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShlcnJvcik7IC8vIGxvZyBlcnJvcnMgYnV0IGRvIG5vdCBnaXZlIHVwIHdyaXRpbmdcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Ly8gUmVzZXQgYGZkYCB0byBiZSBhYmxlIHRvIHRyeSBhZ2FpbiB3aXRoICd3J1xuXHRcdFx0XHRcdFx0ZmQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0eXBlb2YgZmQgIT09ICdudW1iZXInKSB7XG5cdFx0XHRcdGZkID0gYXdhaXQgUHJvbWlzZXMub3BlbihmaWxlUGF0aCwgaXNGaWxlT3BlbkZvcldyaXRlT3B0aW9ucyhvcHRzKSA/XG5cdFx0XHRcdFx0Ly8gV2UgdGFrZSBgb3B0cy5jcmVhdGVgIGFzIGEgaGludCB0aGF0IHRoZSBmaWxlIGlzIG9wZW5lZCBmb3Igd3JpdGluZ1xuXHRcdFx0XHRcdC8vIGFzIHN1Y2ggd2UgdXNlICd3JyB0byB0cnVuY2F0ZSBhbiBleGlzdGluZyBvciBjcmVhdGUgdGhlXG5cdFx0XHRcdFx0Ly8gZmlsZSBvdGhlcndpc2UuIHdlIGRvIG5vdCBhbGxvdyByZWFkaW5nLlxuXHRcdFx0XHRcdCd3JyA6XG5cdFx0XHRcdFx0Ly8gT3RoZXJ3aXNlIHdlIGFzc3VtZSB0aGUgZmlsZSBpcyBvcGVuZWQgZm9yIHJlYWRpbmdcblx0XHRcdFx0XHQvLyBhcyBzdWNoIHdlIHVzZSAncicgdG8gbmVpdGhlciB0cnVuY2F0ZSwgbm9yIGNyZWF0ZVxuXHRcdFx0XHRcdC8vIHRoZSBmaWxlLlxuXHRcdFx0XHRcdCdyJ1xuXHRcdFx0XHQpO1xuXHRcdFx0fVxuXG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblxuXHRcdFx0Ly8gUmVsZWFzZSBsb2NrIGJlY2F1c2Ugd2UgaGF2ZSBubyB2YWxpZCBoYW5kbGVcblx0XHRcdC8vIGlmIHdlIGRpZCBvcGVuIGEgbG9jayBkdXJpbmcgdGhpcyBvcGVyYXRpb25cblx0XHRcdGxvY2s/LmRpc3Bvc2UoKTtcblxuXHRcdFx0Ly8gUmV0aHJvdyBhcyBmaWxlIHN5c3RlbSBwcm92aWRlciBlcnJvclxuXHRcdFx0aWYgKGlzRmlsZU9wZW5Gb3JXcml0ZU9wdGlvbnMob3B0cykpIHtcblx0XHRcdFx0dGhyb3cgYXdhaXQgdGhpcy50b0ZpbGVTeXN0ZW1Qcm92aWRlcldyaXRlRXJyb3IocmVzb3VyY2UsIGVycm9yKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRocm93IHRoaXMudG9GaWxlU3lzdGVtUHJvdmlkZXJFcnJvcihlcnJvcik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gUmVtZW1iZXIgdGhpcyBoYW5kbGUgdG8gdHJhY2sgZmlsZSBwb3NpdGlvbiBvZiB0aGUgaGFuZGxlXG5cdFx0Ly8gd2UgaW5pdCB0aGUgcG9zaXRpb24gdG8gMCBzaW5jZSB0aGUgZmlsZSBkZXNjcmlwdG9yIHdhc1xuXHRcdC8vIGp1c3QgY3JlYXRlZCBhbmQgdGhlIHBvc2l0aW9uIHdhcyBub3QgbW92ZWQgc28gZmFyIChzZWVcblx0XHQvLyBhbHNvIGh0dHA6Ly9tYW43Lm9yZy9saW51eC9tYW4tcGFnZXMvbWFuMi9vcGVuLjIuaHRtbCAtXG5cdFx0Ly8gXCJUaGUgZmlsZSBvZmZzZXQgaXMgc2V0IHRvIHRoZSBiZWdpbm5pbmcgb2YgdGhlIGZpbGUuXCIpXG5cdFx0dGhpcy5tYXBIYW5kbGVUb1Bvcy5zZXQoZmQsIDApO1xuXG5cdFx0Ly8gcmVtZW1iZXIgdGhhdCB0aGlzIGhhbmRsZSB3YXMgdXNlZCBmb3Igd3JpdGluZ1xuXHRcdGlmIChpc0ZpbGVPcGVuRm9yV3JpdGVPcHRpb25zKG9wdHMpKSB7XG5cdFx0XHR0aGlzLndyaXRlSGFuZGxlcy5zZXQoZmQsIHJlc291cmNlKTtcblx0XHR9XG5cblx0XHRpZiAobG9jaykge1xuXHRcdFx0Y29uc3QgcHJldmlvdXNMb2NrID0gdGhpcy5tYXBIYW5kbGVUb0xvY2suZ2V0KGZkKTtcblxuXHRcdFx0Ly8gUmVtZW1iZXIgdGhhdCB0aGlzIGhhbmRsZSBoYXMgYW4gYXNzb2NpYXRlZCBsb2NrXG5cdFx0XHR0aGlzLnRyYWNlTG9jayhgW0Rpc2sgRmlsZVN5c3RlbVByb3ZpZGVyXTogb3BlbigpIC0gc3RvcmluZyBsb2NrIGZvciBoYW5kbGUgJHtmZH0gKCR7ZmlsZVBhdGh9KWApO1xuXHRcdFx0dGhpcy5tYXBIYW5kbGVUb0xvY2suc2V0KGZkLCBsb2NrKTtcblxuXHRcdFx0Ly8gVGhlcmUgaXMgYSBzbGlnaHQgY2hhbmNlIHRoYXQgYSByZXNvdXJjZSBsb2NrIGZvciBhXG5cdFx0XHQvLyBoYW5kbGUgd2FzIG5vdCB5ZXQgZGlzcG9zZWQgd2hlbiB3ZSBhY3F1aXJlIGEgbmV3XG5cdFx0XHQvLyBsb2NrLCBzbyB3ZSBtdXN0IGVuc3VyZSB0byBkaXNwb3NlIHRoZSBwcmV2aW91cyBsb2NrXG5cdFx0XHQvLyBiZWZvcmUgc3RvcmluZyBhIG5ldyBvbmUgZm9yIHRoZSBzYW1lIGhhbmRsZSwgb3RoZXJcblx0XHRcdC8vIHdpc2Ugd2UgZW5kIHVwIGluIGEgZGVhZGxvY2sgc2l0dWF0aW9uXG5cdFx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTQyNDYyXG5cdFx0XHRpZiAocHJldmlvdXNMb2NrKSB7XG5cdFx0XHRcdHRoaXMudHJhY2VMb2NrKGBbRGlzayBGaWxlU3lzdGVtUHJvdmlkZXJdOiBvcGVuKCkgLSBkaXNwb3NpbmcgYSBwcmV2aW91cyBsb2NrIHRoYXQgd2FzIHN0aWxsIHN0b3JlZCBvbiBzYW1lIGhhbmRsZSAke2ZkfSAoJHtmaWxlUGF0aH0pYCk7XG5cdFx0XHRcdHByZXZpb3VzTG9jay5kaXNwb3NlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZkO1xuXHR9XG5cblx0YXN5bmMgY2xvc2UoZmQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gSXQgaXMgdmVyeSBpbXBvcnRhbnQgdGhhdCB3ZSBrZWVwIGFueSBhc3NvY2lhdGVkIGxvY2tcblx0XHQvLyBmb3IgdGhlIGZpbGUgaGFuZGxlIGJlZm9yZSBhdHRlbXB0aW5nIHRvIGNhbGwgYGZzLmNsb3NlKGZkKWBcblx0XHQvLyBiZWNhdXNlIG9mIGEgcG9zc2libGUgcmFjZSBjb25kaXRpb246IGFzIHNvb24gYXMgYSBmaWxlXG5cdFx0Ly8gaGFuZGxlIGlzIHJlbGVhc2VkLCB0aGUgT1MgbWF5IGFzc2lnbiB0aGUgc2FtZSBoYW5kbGUgdG9cblx0XHQvLyB0aGUgbmV4dCBgZnMub3BlbmAgY2FsbCBhbmQgYXMgc3VjaCBpdCBpcyBwb3NzaWJsZSB0aGF0IG91clxuXHRcdC8vIGxvY2sgaXMgZ2V0dGluZyBvdmVyd3JpdHRlblxuXHRcdGNvbnN0IGxvY2tGb3JIYW5kbGUgPSB0aGlzLm1hcEhhbmRsZVRvTG9jay5nZXQoZmQpO1xuXG5cdFx0dHJ5IHtcblxuXHRcdFx0Ly8gUmVtb3ZlIHRoaXMgaGFuZGxlIGZyb20gbWFwIG9mIHBvc2l0aW9uc1xuXHRcdFx0dGhpcy5tYXBIYW5kbGVUb1Bvcy5kZWxldGUoZmQpO1xuXG5cdFx0XHQvLyBJZiBhIGhhbmRsZSBpcyBjbG9zZWQgdGhhdCB3YXMgdXNlZCBmb3Igd3JpdGluZywgZW5zdXJlXG5cdFx0XHQvLyB0byBmbHVzaCB0aGUgY29udGVudHMgdG8gZGlzayBpZiBwb3NzaWJsZS5cblx0XHRcdGlmICh0aGlzLndyaXRlSGFuZGxlcy5kZWxldGUoZmQpICYmIERpc2tGaWxlU3lzdGVtUHJvdmlkZXIuY2FuRmx1c2gpIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRhd2FpdCBQcm9taXNlcy5mZGF0YXN5bmMoZmQpOyAvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvOTU4OVxuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdC8vIEluIHNvbWUgZXhvdGljIHNldHVwcyBpdCBpcyB3ZWxsIHBvc3NpYmxlIHRoYXQgbm9kZSBmYWlscyB0byBzeW5jXG5cdFx0XHRcdFx0Ly8gSW4gdGhhdCBjYXNlIHdlIGRpc2FibGUgZmx1c2hpbmcgYW5kIGxvZyB0aGUgZXJyb3IgdG8gb3VyIGxvZ2dlclxuXHRcdFx0XHRcdERpc2tGaWxlU3lzdGVtUHJvdmlkZXIuY29uZmlndXJlRmx1c2hPbldyaXRlKGZhbHNlKTtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBhd2FpdCBQcm9taXNlcy5jbG9zZShmZCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRocm93IHRoaXMudG9GaWxlU3lzdGVtUHJvdmlkZXJFcnJvcihlcnJvcik7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGlmIChsb2NrRm9ySGFuZGxlKSB7XG5cdFx0XHRcdGlmICh0aGlzLm1hcEhhbmRsZVRvTG9jay5nZXQoZmQpID09PSBsb2NrRm9ySGFuZGxlKSB7XG5cdFx0XHRcdFx0dGhpcy50cmFjZUxvY2soYFtEaXNrIEZpbGVTeXN0ZW1Qcm92aWRlcl06IGNsb3NlKCkgLSByZXNvdXJjZSBsb2NrIHJlbW92ZWQgZnJvbSBoYW5kbGUtbG9jayBtYXAgJHtmZH1gKTtcblx0XHRcdFx0XHR0aGlzLm1hcEhhbmRsZVRvTG9jay5kZWxldGUoZmQpOyAvLyBvbmx5IGRlbGV0ZSBmcm9tIG1hcCBpZiB0aGlzIGlzIHN0aWxsIG91ciBsb2NrIVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy50cmFjZUxvY2soYFtEaXNrIEZpbGVTeXN0ZW1Qcm92aWRlcl06IGNsb3NlKCkgLSBkaXNwb3NpbmcgbG9jayBmb3IgaGFuZGxlICR7ZmR9YCk7XG5cdFx0XHRcdGxvY2tGb3JIYW5kbGUuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHJlYWQoZmQ6IG51bWJlciwgcG9zOiBudW1iZXIsIGRhdGE6IFVpbnQ4QXJyYXksIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlcik6IFByb21pc2U8bnVtYmVyPiB7XG5cdFx0Y29uc3Qgbm9ybWFsaXplZFBvcyA9IHRoaXMubm9ybWFsaXplUG9zKGZkLCBwb3MpO1xuXG5cdFx0bGV0IGJ5dGVzUmVhZDogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cdFx0dHJ5IHtcblx0XHRcdGJ5dGVzUmVhZCA9IChhd2FpdCBQcm9taXNlcy5yZWFkKGZkLCBkYXRhLCBvZmZzZXQsIGxlbmd0aCwgbm9ybWFsaXplZFBvcykpLmJ5dGVzUmVhZDtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhyb3cgdGhpcy50b0ZpbGVTeXN0ZW1Qcm92aWRlckVycm9yKGVycm9yKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy51cGRhdGVQb3MoZmQsIG5vcm1hbGl6ZWRQb3MsIGJ5dGVzUmVhZCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGJ5dGVzUmVhZDtcblx0fVxuXG5cdHByaXZhdGUgbm9ybWFsaXplUG9zKGZkOiBudW1iZXIsIHBvczogbnVtYmVyKTogbnVtYmVyIHwgbnVsbCB7XG5cblx0XHQvLyBXaGVuIGNhbGxpbmcgZnMucmVhZC93cml0ZSB3ZSB0cnkgdG8gYXZvaWQgcGFzc2luZyBpbiB0aGUgXCJwb3NcIiBhcmd1bWVudCBhbmRcblx0XHQvLyByYXRoZXIgcHJlZmVyIHRvIHBhc3MgaW4gXCJudWxsXCIgYmVjYXVzZSB0aGlzIGF2b2lkcyBhbiBleHRyYSBzZWVrKHBvcylcblx0XHQvLyBjYWxsIHRoYXQgaW4gc29tZSBjYXNlcyBjYW4gZXZlbiBmYWlsIChlLmcuIHdoZW4gb3BlbmluZyBhIGZpbGUgb3ZlciBGVFAgLVxuXHRcdC8vIHNlZSBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNzM4ODQpLlxuXHRcdC8vXG5cdFx0Ly8gYXMgc3VjaCwgd2UgY29tcGFyZSB0aGUgcGFzc2VkIGluIHBvc2l0aW9uIGFyZ3VtZW50IHdpdGggb3VyIGxhc3Qga25vd25cblx0XHQvLyBwb3NpdGlvbiBmb3IgdGhlIGZpbGUgZGVzY3JpcHRvciBhbmQgdXNlIFwibnVsbFwiIGlmIHRoZXkgbWF0Y2guXG5cdFx0aWYgKHBvcyA9PT0gdGhpcy5tYXBIYW5kbGVUb1Bvcy5nZXQoZmQpKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRyZXR1cm4gcG9zO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVQb3MoZmQ6IG51bWJlciwgcG9zOiBudW1iZXIgfCBudWxsLCBieXRlc0xlbmd0aDogbnVtYmVyIHwgbnVsbCk6IHZvaWQge1xuXHRcdGNvbnN0IGxhc3RLbm93blBvcyA9IHRoaXMubWFwSGFuZGxlVG9Qb3MuZ2V0KGZkKTtcblx0XHRpZiAodHlwZW9mIGxhc3RLbm93blBvcyA9PT0gJ251bWJlcicpIHtcblxuXHRcdFx0Ly8gcG9zICE9PSBudWxsIHNpZ25hbHMgdGhhdCBwcmV2aW91c2x5IGEgcG9zaXRpb24gd2FzIHVzZWQgdGhhdCBpc1xuXHRcdFx0Ly8gbm90IG51bGwuIG5vZGUuanMgZG9jdW1lbnRhdGlvbiBleHBsYWlucywgdGhhdCBpbiB0aGlzIGNhc2Vcblx0XHRcdC8vIHRoZSBpbnRlcm5hbCBmaWxlIHBvaW50ZXIgaXMgbm90IG1vdmluZyBhbmQgYXMgc3VjaCB3ZSBkbyBub3QgbW92ZVxuXHRcdFx0Ly8gb3VyIHBvc2l0aW9uIHBvaW50ZXIuXG5cdFx0XHQvL1xuXHRcdFx0Ly8gRG9jczogXCJJZiBwb3NpdGlvbiBpcyBudWxsLCBkYXRhIHdpbGwgYmUgcmVhZCBmcm9tIHRoZSBjdXJyZW50IGZpbGUgcG9zaXRpb24sXG5cdFx0XHQvLyBhbmQgdGhlIGZpbGUgcG9zaXRpb24gd2lsbCBiZSB1cGRhdGVkLiBJZiBwb3NpdGlvbiBpcyBhbiBpbnRlZ2VyLCB0aGUgZmlsZSBwb3NpdGlvblxuXHRcdFx0Ly8gd2lsbCByZW1haW4gdW5jaGFuZ2VkLlwiXG5cdFx0XHRpZiAodHlwZW9mIHBvcyA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0Ly8gZG8gbm90IG1vZGlmeSB0aGUgcG9zaXRpb25cblx0XHRcdH1cblxuXHRcdFx0Ly8gYnl0ZXNMZW5ndGggPSBudW1iZXIgaXMgYSBzaWduYWwgdGhhdCB0aGUgcmVhZC93cml0ZSBvcGVyYXRpb24gd2FzXG5cdFx0XHQvLyBzdWNjZXNzZnVsIGFuZCBhcyBzdWNoIHdlIG5lZWQgdG8gYWR2YW5jZSB0aGUgcG9zaXRpb24gaW4gdGhlIE1hcFxuXHRcdFx0Ly9cblx0XHRcdC8vIERvY3MgKGh0dHA6Ly9tYW43Lm9yZy9saW51eC9tYW4tcGFnZXMvbWFuMi9yZWFkLjIuaHRtbCk6XG5cdFx0XHQvLyBcIk9uIGZpbGVzIHRoYXQgc3VwcG9ydCBzZWVraW5nLCB0aGUgcmVhZCBvcGVyYXRpb24gY29tbWVuY2VzIGF0IHRoZVxuXHRcdFx0Ly8gZmlsZSBvZmZzZXQsIGFuZCB0aGUgZmlsZSBvZmZzZXQgaXMgaW5jcmVtZW50ZWQgYnkgdGhlIG51bWJlciBvZlxuXHRcdFx0Ly8gYnl0ZXMgcmVhZC5cIlxuXHRcdFx0Ly9cblx0XHRcdC8vIERvY3MgKGh0dHA6Ly9tYW43Lm9yZy9saW51eC9tYW4tcGFnZXMvbWFuMi93cml0ZS4yLmh0bWwpOlxuXHRcdFx0Ly8gXCJGb3IgYSBzZWVrYWJsZSBmaWxlIChpLmUuLCBvbmUgdG8gd2hpY2ggbHNlZWsoMikgbWF5IGJlIGFwcGxpZWQsIGZvclxuXHRcdFx0Ly8gZXhhbXBsZSwgYSByZWd1bGFyIGZpbGUpIHdyaXRpbmcgdGFrZXMgcGxhY2UgYXQgdGhlIGZpbGUgb2Zmc2V0LCBhbmRcblx0XHRcdC8vIHRoZSBmaWxlIG9mZnNldCBpcyBpbmNyZW1lbnRlZCBieSB0aGUgbnVtYmVyIG9mIGJ5dGVzIGFjdHVhbGx5XG5cdFx0XHQvLyB3cml0dGVuLlwiXG5cdFx0XHRlbHNlIGlmICh0eXBlb2YgYnl0ZXNMZW5ndGggPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdHRoaXMubWFwSGFuZGxlVG9Qb3Muc2V0KGZkLCBsYXN0S25vd25Qb3MgKyBieXRlc0xlbmd0aCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIGJ5dGVzTGVuZ3RoID0gbnVsbCBzaWduYWxzIGFuIGVycm9yIGluIHRoZSByZWFkL3dyaXRlIG9wZXJhdGlvblxuXHRcdFx0Ly8gYW5kIGFzIHN1Y2ggd2UgZHJvcCB0aGUgaGFuZGxlIGZyb20gdGhlIE1hcCBiZWNhdXNlIHRoZSBwb3NpdGlvblxuXHRcdFx0Ly8gaXMgdW5zcGVjaWZpY2VkIGF0IHRoaXMgcG9pbnQuXG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0dGhpcy5tYXBIYW5kbGVUb1Bvcy5kZWxldGUoZmQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHdyaXRlKGZkOiBudW1iZXIsIHBvczogbnVtYmVyLCBkYXRhOiBVaW50OEFycmF5LCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpOiBQcm9taXNlPG51bWJlcj4ge1xuXG5cdFx0Ly8gV2Uga25vdyBhdCB0aGlzIHBvaW50IHRoYXQgdGhlIGZpbGUgdG8gd3JpdGUgdG8gaXMgdHJ1bmNhdGVkIGFuZCB0aHVzIGVtcHR5XG5cdFx0Ly8gaWYgdGhlIHdyaXRlIG5vdyBmYWlscywgdGhlIGZpbGUgcmVtYWlucyBlbXB0eS4gYXMgc3VjaCB3ZSByZWFsbHkgdHJ5IGhhcmRcblx0XHQvLyB0byBlbnN1cmUgdGhlIHdyaXRlIHN1Y2NlZWRzIGJ5IHJldHJ5aW5nIHVwIHRvIHRocmVlIHRpbWVzLlxuXHRcdHJldHVybiByZXRyeSgoKSA9PiB0aGlzLmRvV3JpdGUoZmQsIHBvcywgZGF0YSwgb2Zmc2V0LCBsZW5ndGgpLCAxMDAgLyogbXMgZGVsYXkgKi8sIDMgLyogcmV0cmllcyAqLyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvV3JpdGUoZmQ6IG51bWJlciwgcG9zOiBudW1iZXIsIGRhdGE6IFVpbnQ4QXJyYXksIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlcik6IFByb21pc2U8bnVtYmVyPiB7XG5cdFx0Y29uc3Qgbm9ybWFsaXplZFBvcyA9IHRoaXMubm9ybWFsaXplUG9zKGZkLCBwb3MpO1xuXG5cdFx0bGV0IGJ5dGVzV3JpdHRlbjogbnVtYmVyIHwgbnVsbCA9IG51bGw7XG5cdFx0dHJ5IHtcblx0XHRcdGJ5dGVzV3JpdHRlbiA9IChhd2FpdCBQcm9taXNlcy53cml0ZShmZCwgZGF0YSwgb2Zmc2V0LCBsZW5ndGgsIG5vcm1hbGl6ZWRQb3MpKS5ieXRlc1dyaXR0ZW47XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRocm93IGF3YWl0IHRoaXMudG9GaWxlU3lzdGVtUHJvdmlkZXJXcml0ZUVycm9yKHRoaXMud3JpdGVIYW5kbGVzLmdldChmZCksIGVycm9yKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy51cGRhdGVQb3MoZmQsIG5vcm1hbGl6ZWRQb3MsIGJ5dGVzV3JpdHRlbik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGJ5dGVzV3JpdHRlbjtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBNb3ZlL0NvcHkvRGVsZXRlL0NyZWF0ZSBGb2xkZXJcblxuXHRhc3luYyBta2RpcihyZXNvdXJjZTogVVJJKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHByb21pc2VzLm1rZGlyKHRoaXMudG9GaWxlUGF0aChyZXNvdXJjZSkpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aHJvdyB0aGlzLnRvRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3IoZXJyb3IpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGRlbGV0ZShyZXNvdXJjZTogVVJJLCBvcHRzOiBJRmlsZURlbGV0ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZmlsZVBhdGggPSB0aGlzLnRvRmlsZVBhdGgocmVzb3VyY2UpO1xuXHRcdFx0aWYgKG9wdHMucmVjdXJzaXZlKSB7XG5cdFx0XHRcdGxldCBybU1vdmVUb1BhdGg6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0aWYgKG9wdHM/LmF0b21pYyAhPT0gZmFsc2UgJiYgb3B0cy5hdG9taWMucG9zdGZpeCkge1xuXHRcdFx0XHRcdHJtTW92ZVRvUGF0aCA9IGpvaW4oZGlybmFtZShmaWxlUGF0aCksIGAke2Jhc2VuYW1lKGZpbGVQYXRoKX0ke29wdHMuYXRvbWljLnBvc3RmaXh9YCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRhd2FpdCBQcm9taXNlcy5ybShmaWxlUGF0aCwgUmltUmFmTW9kZS5NT1ZFLCBybU1vdmVUb1BhdGgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRhd2FpdCBwcm9taXNlcy51bmxpbmsoZmlsZVBhdGgpO1xuXHRcdFx0XHR9IGNhdGNoICh1bmxpbmtFcnJvcikge1xuXG5cdFx0XHRcdFx0Ly8gYGZzLnVubGlua2Agd2lsbCB0aHJvdyB3aGVuIHVzZWQgb24gZGlyZWN0b3JpZXNcblx0XHRcdFx0XHQvLyB3ZSB0cnkgdG8gZGV0ZWN0IHRoaXMgZXJyb3IgYW5kIHRoZW4gc2VlIGlmIHRoZVxuXHRcdFx0XHRcdC8vIHByb3ZpZGVkIHJlc291cmNlIGlzIGFjdHVhbGx5IGEgZGlyZWN0b3J5LiBpbiB0aGF0XG5cdFx0XHRcdFx0Ly8gY2FzZSB3ZSB1c2UgYGZzLnJtZGlyYCB0byBkZWxldGUgdGhlIGRpcmVjdG9yeS5cblxuXHRcdFx0XHRcdGlmICh1bmxpbmtFcnJvci5jb2RlID09PSAnRVBFUk0nIHx8IHVubGlua0Vycm9yLmNvZGUgPT09ICdFSVNESVInKSB7XG5cdFx0XHRcdFx0XHRsZXQgaXNEaXJlY3RvcnkgPSBmYWxzZTtcblx0XHRcdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHsgc3RhdCwgc3ltYm9saWNMaW5rIH0gPSBhd2FpdCBTeW1saW5rU3VwcG9ydC5zdGF0KGZpbGVQYXRoKTtcblx0XHRcdFx0XHRcdFx0aXNEaXJlY3RvcnkgPSBzdGF0LmlzRGlyZWN0b3J5KCkgJiYgIXN5bWJvbGljTGluaztcblx0XHRcdFx0XHRcdH0gY2F0Y2ggKHN0YXRFcnJvcikge1xuXHRcdFx0XHRcdFx0XHQvLyBpZ25vcmVcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0aWYgKGlzRGlyZWN0b3J5KSB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHByb21pc2VzLnJtZGlyKGZpbGVQYXRoKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHRocm93IHVubGlua0Vycm9yO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0aHJvdyB1bmxpbmtFcnJvcjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhyb3cgdGhpcy50b0ZpbGVTeXN0ZW1Qcm92aWRlckVycm9yKGVycm9yKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyByZW5hbWUoZnJvbTogVVJJLCB0bzogVVJJLCBvcHRzOiBJRmlsZU92ZXJ3cml0ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBmcm9tRmlsZVBhdGggPSB0aGlzLnRvRmlsZVBhdGgoZnJvbSk7XG5cdFx0Y29uc3QgdG9GaWxlUGF0aCA9IHRoaXMudG9GaWxlUGF0aCh0byk7XG5cblx0XHRpZiAoZnJvbUZpbGVQYXRoID09PSB0b0ZpbGVQYXRoKSB7XG5cdFx0XHRyZXR1cm47IC8vIHNpbXVsYXRlIG5vZGUuanMgYmVoYXZpb3VyIGhlcmUgYW5kIGRvIGEgbm8tb3AgaWYgcGF0aHMgbWF0Y2hcblx0XHR9XG5cblx0XHR0cnkge1xuXG5cdFx0XHQvLyBWYWxpZGF0ZSB0aGUgbW92ZSBvcGVyYXRpb24gY2FuIHBlcmZvcm1cblx0XHRcdGF3YWl0IHRoaXMudmFsaWRhdGVNb3ZlQ29weShmcm9tLCB0bywgJ21vdmUnLCBvcHRzLm92ZXJ3cml0ZSk7XG5cblx0XHRcdC8vIFJlbmFtZVxuXHRcdFx0YXdhaXQgUHJvbWlzZXMucmVuYW1lKGZyb21GaWxlUGF0aCwgdG9GaWxlUGF0aCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblxuXHRcdFx0Ly8gUmV3cml0ZSBzb21lIHR5cGljYWwgZXJyb3JzIHRoYXQgY2FuIGhhcHBlbiBlc3BlY2lhbGx5IGFyb3VuZCBzeW1saW5rc1xuXHRcdFx0Ly8gdG8gc29tZXRoaW5nIHRoZSB1c2VyIGNhbiBiZXR0ZXIgdW5kZXJzdGFuZFxuXHRcdFx0aWYgKGVycm9yLmNvZGUgPT09ICdFSU5WQUwnIHx8IGVycm9yLmNvZGUgPT09ICdFQlVTWScgfHwgZXJyb3IuY29kZSA9PT0gJ0VOQU1FVE9PTE9ORycpIHtcblx0XHRcdFx0ZXJyb3IgPSBuZXcgRXJyb3IobG9jYWxpemUoJ21vdmVFcnJvcicsIFwiVW5hYmxlIHRvIG1vdmUgJ3swfScgaW50byAnezF9JyAoezJ9KS5cIiwgYmFzZW5hbWUoZnJvbUZpbGVQYXRoKSwgYmFzZW5hbWUoZGlybmFtZSh0b0ZpbGVQYXRoKSksIGVycm9yLnRvU3RyaW5nKCkpKTtcblx0XHRcdH1cblxuXHRcdFx0dGhyb3cgdGhpcy50b0ZpbGVTeXN0ZW1Qcm92aWRlckVycm9yKGVycm9yKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBjb3B5KGZyb206IFVSSSwgdG86IFVSSSwgb3B0czogSUZpbGVPdmVyd3JpdGVPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZnJvbUZpbGVQYXRoID0gdGhpcy50b0ZpbGVQYXRoKGZyb20pO1xuXHRcdGNvbnN0IHRvRmlsZVBhdGggPSB0aGlzLnRvRmlsZVBhdGgodG8pO1xuXG5cdFx0aWYgKGZyb21GaWxlUGF0aCA9PT0gdG9GaWxlUGF0aCkge1xuXHRcdFx0cmV0dXJuOyAvLyBzaW11bGF0ZSBub2RlLmpzIGJlaGF2aW91ciBoZXJlIGFuZCBkbyBhIG5vLW9wIGlmIHBhdGhzIG1hdGNoXG5cdFx0fVxuXG5cdFx0dHJ5IHtcblxuXHRcdFx0Ly8gVmFsaWRhdGUgdGhlIGNvcHkgb3BlcmF0aW9uIGNhbiBwZXJmb3JtXG5cdFx0XHRhd2FpdCB0aGlzLnZhbGlkYXRlTW92ZUNvcHkoZnJvbSwgdG8sICdjb3B5Jywgb3B0cy5vdmVyd3JpdGUpO1xuXG5cdFx0XHQvLyBDb3B5XG5cdFx0XHRhd2FpdCBQcm9taXNlcy5jb3B5KGZyb21GaWxlUGF0aCwgdG9GaWxlUGF0aCwgeyBwcmVzZXJ2ZVN5bWxpbmtzOiB0cnVlIH0pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cblx0XHRcdC8vIFJld3JpdGUgc29tZSB0eXBpY2FsIGVycm9ycyB0aGF0IGNhbiBoYXBwZW4gZXNwZWNpYWxseSBhcm91bmQgc3ltbGlua3Ncblx0XHRcdC8vIHRvIHNvbWV0aGluZyB0aGUgdXNlciBjYW4gYmV0dGVyIHVuZGVyc3RhbmRcblx0XHRcdGlmIChlcnJvci5jb2RlID09PSAnRUlOVkFMJyB8fCBlcnJvci5jb2RlID09PSAnRUJVU1knIHx8IGVycm9yLmNvZGUgPT09ICdFTkFNRVRPT0xPTkcnKSB7XG5cdFx0XHRcdGVycm9yID0gbmV3IEVycm9yKGxvY2FsaXplKCdjb3B5RXJyb3InLCBcIlVuYWJsZSB0byBjb3B5ICd7MH0nIGludG8gJ3sxfScgKHsyfSkuXCIsIGJhc2VuYW1lKGZyb21GaWxlUGF0aCksIGJhc2VuYW1lKGRpcm5hbWUodG9GaWxlUGF0aCkpLCBlcnJvci50b1N0cmluZygpKSk7XG5cdFx0XHR9XG5cblx0XHRcdHRocm93IHRoaXMudG9GaWxlU3lzdGVtUHJvdmlkZXJFcnJvcihlcnJvcik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB2YWxpZGF0ZU1vdmVDb3B5KGZyb206IFVSSSwgdG86IFVSSSwgbW9kZTogJ21vdmUnIHwgJ2NvcHknLCBvdmVyd3JpdGU/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZnJvbUZpbGVQYXRoID0gdGhpcy50b0ZpbGVQYXRoKGZyb20pO1xuXHRcdGNvbnN0IHRvRmlsZVBhdGggPSB0aGlzLnRvRmlsZVBhdGgodG8pO1xuXG5cdFx0bGV0IGlzU2FtZVJlc291cmNlV2l0aERpZmZlcmVudFBhdGhDYXNlID0gZmFsc2U7XG5cdFx0Y29uc3QgaXNQYXRoQ2FzZVNlbnNpdGl2ZSA9ICEhKHRoaXMuY2FwYWJpbGl0aWVzICYgRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLlBhdGhDYXNlU2Vuc2l0aXZlKTtcblx0XHRpZiAoIWlzUGF0aENhc2VTZW5zaXRpdmUpIHtcblx0XHRcdGlzU2FtZVJlc291cmNlV2l0aERpZmZlcmVudFBhdGhDYXNlID0gaXNFcXVhbChmcm9tRmlsZVBhdGgsIHRvRmlsZVBhdGgsIHRydWUgLyogaWdub3JlIGNhc2UgKi8pO1xuXHRcdH1cblxuXHRcdGlmIChpc1NhbWVSZXNvdXJjZVdpdGhEaWZmZXJlbnRQYXRoQ2FzZSkge1xuXG5cdFx0XHQvLyBZb3UgY2Fubm90IGNvcHkgdGhlIHNhbWUgZmlsZSB0byB0aGUgc2FtZSBsb2NhdGlvbiB3aXRoIGRpZmZlcmVudFxuXHRcdFx0Ly8gcGF0aCBjYXNlIHVubGVzcyB5b3UgYXJlIG9uIGEgY2FzZSBzZW5zaXRpdmUgZmlsZSBzeXN0ZW1cblx0XHRcdGlmIChtb2RlID09PSAnY29weScpIHtcblx0XHRcdFx0dGhyb3cgY3JlYXRlRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3IobG9jYWxpemUoJ2ZpbGVDb3B5RXJyb3JQYXRoQ2FzZScsIFwiRmlsZSBjYW5ub3QgYmUgY29waWVkIHRvIHNhbWUgcGF0aCB3aXRoIGRpZmZlcmVudCBwYXRoIGNhc2VcIiksIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5GaWxlRXhpc3RzKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gWW91IGNhbiBtb3ZlIHRoZSBzYW1lIGZpbGUgdG8gdGhlIHNhbWUgbG9jYXRpb24gd2l0aCBkaWZmZXJlbnRcblx0XHRcdC8vIHBhdGggY2FzZSBvbiBjYXNlIGluc2Vuc2l0aXZlIGZpbGUgc3lzdGVtc1xuXHRcdFx0ZWxzZSBpZiAobW9kZSA9PT0gJ21vdmUnKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBIZXJlIHdlIGhhdmUgdG8gc2VlIGlmIHRoZSB0YXJnZXQgdG8gbW92ZS9jb3B5IHRvIGV4aXN0cyBvciBub3QuXG5cdFx0Ly8gV2UgbmVlZCB0byByZXNwZWN0IHRoZSBgb3ZlcndyaXRlYCBvcHRpb24gdG8gdGhyb3cgaW4gY2FzZSB0aGVcblx0XHQvLyB0YXJnZXQgZXhpc3RzLlxuXG5cdFx0Y29uc3QgZnJvbVN0YXQgPSBhd2FpdCB0aGlzLnN0YXRJZ25vcmVFcnJvcihmcm9tKTtcblx0XHRpZiAoIWZyb21TdGF0KSB7XG5cdFx0XHR0aHJvdyBjcmVhdGVGaWxlU3lzdGVtUHJvdmlkZXJFcnJvcihsb2NhbGl6ZSgnZmlsZU1vdmVDb3B5RXJyb3JOb3RGb3VuZCcsIFwiRmlsZSB0byBtb3ZlL2NvcHkgZG9lcyBub3QgZXhpc3RcIiksIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5GaWxlTm90Rm91bmQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRvU3RhdCA9IGF3YWl0IHRoaXMuc3RhdElnbm9yZUVycm9yKHRvKTtcblx0XHRpZiAoIXRvU3RhdCkge1xuXHRcdFx0cmV0dXJuOyAvLyB0YXJnZXQgZG9lcyBub3QgZXhpc3Qgc28gd2UgYXJlIGdvb2Rcblx0XHR9XG5cblx0XHRpZiAoIW92ZXJ3cml0ZSkge1xuXHRcdFx0dGhyb3cgY3JlYXRlRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3IobG9jYWxpemUoJ2ZpbGVNb3ZlQ29weUVycm9yRXhpc3RzJywgXCJGaWxlIGF0IHRhcmdldCBhbHJlYWR5IGV4aXN0cyBhbmQgdGh1cyB3aWxsIG5vdCBiZSBtb3ZlZC9jb3BpZWQgdG8gdW5sZXNzIG92ZXJ3cml0ZSBpcyBzcGVjaWZpZWRcIiksIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5GaWxlRXhpc3RzKTtcblx0XHR9XG5cblx0XHQvLyBIYW5kbGUgZXhpc3RpbmcgdGFyZ2V0IGZvciBtb3ZlL2NvcHlcblx0XHRpZiAoKGZyb21TdGF0LnR5cGUgJiBGaWxlVHlwZS5GaWxlKSAhPT0gMCAmJiAodG9TdGF0LnR5cGUgJiBGaWxlVHlwZS5GaWxlKSAhPT0gMCkge1xuXHRcdFx0cmV0dXJuOyAvLyBub2RlLmpzIGNhbiBtb3ZlL2NvcHkgYSBmaWxlIG92ZXIgYW4gZXhpc3RpbmcgZmlsZSB3aXRob3V0IGhhdmluZyB0byBkZWxldGUgaXQgZmlyc3Rcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXdhaXQgdGhpcy5kZWxldGUodG8sIHsgcmVjdXJzaXZlOiB0cnVlLCB1c2VUcmFzaDogZmFsc2UsIGF0b21pYzogZmFsc2UgfSk7XG5cdFx0fVxuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIENsb25lIEZpbGVcblxuXHRhc3luYyBjbG9uZUZpbGUoZnJvbTogVVJJLCB0bzogVVJJKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuZG9DbG9uZUZpbGUoZnJvbSwgdG8sIGZhbHNlIC8qIG9wdGltaXN0aWNhbGx5IGFzc3VtZSBwYXJlbnQgZm9sZGVycyBleGlzdCAqLyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvQ2xvbmVGaWxlKGZyb206IFVSSSwgdG86IFVSSSwgbWtkaXI6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBmcm9tRmlsZVBhdGggPSB0aGlzLnRvRmlsZVBhdGgoZnJvbSk7XG5cdFx0Y29uc3QgdG9GaWxlUGF0aCA9IHRoaXMudG9GaWxlUGF0aCh0byk7XG5cblx0XHRjb25zdCBpc1BhdGhDYXNlU2Vuc2l0aXZlID0gISEodGhpcy5jYXBhYmlsaXRpZXMgJiBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuUGF0aENhc2VTZW5zaXRpdmUpO1xuXHRcdGlmIChpc0VxdWFsKGZyb21GaWxlUGF0aCwgdG9GaWxlUGF0aCwgIWlzUGF0aENhc2VTZW5zaXRpdmUpKSB7XG5cdFx0XHRyZXR1cm47IC8vIGNsb25pbmcgaXMgb25seSBzdXBwb3J0ZWQgYGZyb21gIGFuZCBgdG9gIGFyZSBkaWZmZXJlbnQgZmlsZXNcblx0XHR9XG5cblx0XHQvLyBJbXBsZW1lbnQgY2xvbmUgYnkgdXNpbmcgYGZzLmNvcHlGaWxlYCwgaG93ZXZlciBzZXR1cCBsb2Nrc1xuXHRcdC8vIGZvciBib3RoIGBmcm9tYCBhbmQgYHRvYCBiZWNhdXNlIG5vZGUuanMgZG9lcyBub3QgZW5zdXJlXG5cdFx0Ly8gdGhpcyB0byBiZSBhbiBhdG9taWMgb3BlcmF0aW9uXG5cblx0XHRjb25zdCBsb2NrcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRsb2Nrcy5hZGQoYXdhaXQgdGhpcy5jcmVhdGVSZXNvdXJjZUxvY2soZnJvbSkpO1xuXHRcdFx0bG9ja3MuYWRkKGF3YWl0IHRoaXMuY3JlYXRlUmVzb3VyY2VMb2NrKHRvKSk7XG5cblx0XHRcdGlmIChta2Rpcikge1xuXHRcdFx0XHRhd2FpdCBwcm9taXNlcy5ta2RpcihkaXJuYW1lKHRvRmlsZVBhdGgpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblx0XHRcdH1cblxuXHRcdFx0YXdhaXQgcHJvbWlzZXMuY29weUZpbGUoZnJvbUZpbGVQYXRoLCB0b0ZpbGVQYXRoKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0aWYgKGVycm9yLmNvZGUgPT09ICdFTk9FTlQnICYmICFta2Rpcikge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5kb0Nsb25lRmlsZShmcm9tLCB0bywgdHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdHRocm93IHRoaXMudG9GaWxlU3lzdGVtUHJvdmlkZXJFcnJvcihlcnJvcik7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGxvY2tzLmRpc3Bvc2UoKTtcblx0XHR9XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gRmlsZSBXYXRjaGluZ1xuXG5cdHByb3RlY3RlZCBjcmVhdGVVbml2ZXJzYWxXYXRjaGVyKFxuXHRcdG9uQ2hhbmdlOiAoY2hhbmdlczogSUZpbGVDaGFuZ2VbXSkgPT4gdm9pZCxcblx0XHRvbkxvZ01lc3NhZ2U6IChtc2c6IElMb2dNZXNzYWdlKSA9PiB2b2lkLFxuXHRcdHZlcmJvc2VMb2dnaW5nOiBib29sZWFuXG5cdCk6IEFic3RyYWN0VW5pdmVyc2FsV2F0Y2hlckNsaWVudCB7XG5cdFx0cmV0dXJuIG5ldyBVbml2ZXJzYWxXYXRjaGVyQ2xpZW50KGNoYW5nZXMgPT4gb25DaGFuZ2UoY2hhbmdlcyksIG1zZyA9PiBvbkxvZ01lc3NhZ2UobXNnKSwgdmVyYm9zZUxvZ2dpbmcpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZU5vblJlY3Vyc2l2ZVdhdGNoZXIoXG5cdFx0b25DaGFuZ2U6IChjaGFuZ2VzOiBJRmlsZUNoYW5nZVtdKSA9PiB2b2lkLFxuXHRcdG9uTG9nTWVzc2FnZTogKG1zZzogSUxvZ01lc3NhZ2UpID0+IHZvaWQsXG5cdFx0dmVyYm9zZUxvZ2dpbmc6IGJvb2xlYW5cblx0KTogQWJzdHJhY3ROb25SZWN1cnNpdmVXYXRjaGVyQ2xpZW50IHtcblx0XHRyZXR1cm4gbmV3IE5vZGVKU1dhdGNoZXJDbGllbnQoY2hhbmdlcyA9PiBvbkNoYW5nZShjaGFuZ2VzKSwgbXNnID0+IG9uTG9nTWVzc2FnZShtc2cpLCB2ZXJib3NlTG9nZ2luZyk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gSGVscGVyc1xuXG5cdHByaXZhdGUgdG9GaWxlU3lzdGVtUHJvdmlkZXJFcnJvcihlcnJvcjogTm9kZUpTLkVycm5vRXhjZXB0aW9uKTogRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3Ige1xuXHRcdGlmIChlcnJvciBpbnN0YW5jZW9mIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yKSB7XG5cdFx0XHRyZXR1cm4gZXJyb3I7IC8vIGF2b2lkIGRvdWJsZSBjb252ZXJzaW9uXG5cdFx0fVxuXG5cdFx0bGV0IHJlc3VsdEVycm9yOiBFcnJvciB8IHN0cmluZyA9IGVycm9yO1xuXHRcdGxldCBjb2RlOiBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvckNvZGU7XG5cdFx0c3dpdGNoIChlcnJvci5jb2RlKSB7XG5cdFx0XHRjYXNlICdFTk9FTlQnOlxuXHRcdFx0XHRjb2RlID0gRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLkZpbGVOb3RGb3VuZDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdFSVNESVInOlxuXHRcdFx0XHRjb2RlID0gRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLkZpbGVJc0FEaXJlY3Rvcnk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnRU5PVERJUic6XG5cdFx0XHRcdGNvZGUgPSBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvckNvZGUuRmlsZU5vdEFEaXJlY3Rvcnk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSAnRUVYSVNUJzpcblx0XHRcdFx0Y29kZSA9IEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5GaWxlRXhpc3RzO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ0VQRVJNJzpcblx0XHRcdGNhc2UgJ0VBQ0NFUyc6XG5cdFx0XHRcdGNvZGUgPSBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvckNvZGUuTm9QZXJtaXNzaW9ucztcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdFUlJfVU5DX0hPU1RfTk9UX0FMTE9XRUQnOlxuXHRcdFx0XHRyZXN1bHRFcnJvciA9IGAke2Vycm9yLm1lc3NhZ2V9LiBQbGVhc2UgdXBkYXRlIHRoZSAnc2VjdXJpdHkuYWxsb3dlZFVOQ0hvc3RzJyBzZXR0aW5nIGlmIHlvdSB3YW50IHRvIGFsbG93IHRoaXMgaG9zdC5gO1xuXHRcdFx0XHRjb2RlID0gRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLlVua25vd247XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0Y29kZSA9IEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5Vbmtub3duO1xuXHRcdH1cblxuXHRcdHJldHVybiBjcmVhdGVGaWxlU3lzdGVtUHJvdmlkZXJFcnJvcihyZXN1bHRFcnJvciwgY29kZSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHRvRmlsZVN5c3RlbVByb3ZpZGVyV3JpdGVFcnJvcihyZXNvdXJjZTogVVJJIHwgdW5kZWZpbmVkLCBlcnJvcjogTm9kZUpTLkVycm5vRXhjZXB0aW9uKTogUHJvbWlzZTxGaWxlU3lzdGVtUHJvdmlkZXJFcnJvcj4ge1xuXHRcdGxldCBmaWxlU3lzdGVtUHJvdmlkZXJXcml0ZUVycm9yID0gdGhpcy50b0ZpbGVTeXN0ZW1Qcm92aWRlckVycm9yKGVycm9yKTtcblxuXHRcdC8vIElmIHRoZSB3cml0ZSBlcnJvciBzaWduYWxzIHBlcm1pc3Npb24gaXNzdWVzLCB3ZSB0cnlcblx0XHQvLyB0byByZWFkIHRoZSBmaWxlJ3MgbW9kZSB0byBzZWUgaWYgdGhlIGZpbGUgaXMgd3JpdGVcblx0XHQvLyBsb2NrZWQuXG5cdFx0aWYgKHJlc291cmNlICYmIGZpbGVTeXN0ZW1Qcm92aWRlcldyaXRlRXJyb3IuY29kZSA9PT0gRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLk5vUGVybWlzc2lvbnMpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHsgc3RhdCB9ID0gYXdhaXQgU3ltbGlua1N1cHBvcnQuc3RhdCh0aGlzLnRvRmlsZVBhdGgocmVzb3VyY2UpKTtcblx0XHRcdFx0aWYgKCEoc3RhdC5tb2RlICYgMG8yMDAgLyogRmlsZSBtb2RlIGluZGljYXRpbmcgd3JpdGFibGUgYnkgb3duZXIgKi8pKSB7XG5cdFx0XHRcdFx0ZmlsZVN5c3RlbVByb3ZpZGVyV3JpdGVFcnJvciA9IGNyZWF0ZUZpbGVTeXN0ZW1Qcm92aWRlckVycm9yKGVycm9yLCBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvckNvZGUuRmlsZVdyaXRlTG9ja2VkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGVycm9yKTsgLy8gaWdub3JlIC0gcmV0dXJuIG9yaWdpbmFsIGVycm9yXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZpbGVTeXN0ZW1Qcm92aWRlcldyaXRlRXJyb3I7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25c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
