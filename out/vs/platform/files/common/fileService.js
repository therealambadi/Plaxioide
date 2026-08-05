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
import { coalesce } from "../../../base/common/arrays.js";
import { Promises, ResourceQueue } from "../../../base/common/async.js";
import { bufferedStreamToBuffer, bufferToReadable, newWriteableBufferStream, readableToBuffer, streamToBuffer, VSBuffer } from "../../../base/common/buffer.js";
import { CancellationToken, CancellationTokenSource } from "../../../base/common/cancellation.js";
import { Emitter } from "../../../base/common/event.js";
import { hash } from "../../../base/common/hash.js";
import { Iterable } from "../../../base/common/iterator.js";
import { Disposable, DisposableStore, dispose, toDisposable } from "../../../base/common/lifecycle.js";
import { TernarySearchTree } from "../../../base/common/ternarySearchTree.js";
import { Schemas } from "../../../base/common/network.js";
import { mark } from "../../../base/common/performance.js";
import { extUri, extUriIgnorePathCase, isAbsolutePath } from "../../../base/common/resources.js";
import { consumeStream, isReadableBufferedStream, isReadableStream, listenStream, newWriteableStream, peekReadable, peekStream, transform } from "../../../base/common/stream.js";
import { localize } from "../../../nls.js";
import { ensureFileSystemProviderError, etag, ETAG_DISABLED, FileChangesEvent, FileOperation, FileOperationError, FileOperationEvent, FileOperationResult, FilePermission, FileSystemProviderCapabilities, FileSystemProviderErrorCode, FileType, hasFileAtomicReadCapability, hasFileFolderCopyCapability, hasFileReadStreamCapability, hasOpenReadWriteCloseCapability, hasReadWriteCapability, NotModifiedSinceFileOperationError, toFileOperationResult, toFileSystemProviderErrorCode, hasFileCloneCapability, TooLargeFileOperationError, hasFileAtomicDeleteCapability, hasFileAtomicWriteCapability } from "./files.js";
import { readFileIntoStream } from "./io.js";
import { ILogService } from "../../log/common/log.js";
import { ErrorNoTelemetry } from "../../../base/common/errors.js";
let FileService = class extends Disposable {
  constructor(logService) {
    super();
    this.logService = logService;
    // Choose a buffer size that is a balance between memory needs and
    // manageable IPC overhead. The larger the buffer size, the less
    // roundtrips we have to do for reading/writing data.
    this.BUFFER_SIZE = 256 * 1024;
    //#region File System Provider
    this._onDidChangeFileSystemProviderRegistrations = this._register(new Emitter());
    this.onDidChangeFileSystemProviderRegistrations = this._onDidChangeFileSystemProviderRegistrations.event;
    this._onWillActivateFileSystemProvider = this._register(new Emitter());
    this.onWillActivateFileSystemProvider = this._onWillActivateFileSystemProvider.event;
    this._onDidChangeFileSystemProviderCapabilities = this._register(new Emitter());
    this.onDidChangeFileSystemProviderCapabilities = this._onDidChangeFileSystemProviderCapabilities.event;
    this.provider = /* @__PURE__ */ new Map();
    //#endregion
    //#region Operation events
    this._onDidRunOperation = this._register(new Emitter());
    this.onDidRunOperation = this._onDidRunOperation.event;
    //#endregion
    //#region File Watching
    this.internalOnDidFilesChange = this._register(new Emitter());
    this._onDidUncorrelatedFilesChange = this._register(new Emitter());
    this.onDidFilesChange = this._onDidUncorrelatedFilesChange.event;
    // global `onDidFilesChange` skips correlated events
    this._onDidWatchError = this._register(new Emitter());
    this.onDidWatchError = this._onDidWatchError.event;
    this.activeWatchers = /* @__PURE__ */ new Map();
    //#endregion
    //#region Helpers
    this.writeQueue = this._register(new ResourceQueue());
  }
  registerProvider(scheme, provider) {
    if (this.provider.has(scheme)) {
      throw new Error(`A filesystem provider for the scheme '${scheme}' is already registered.`);
    }
    mark(`code/registerFilesystem/${scheme}`);
    const providerDisposables = new DisposableStore();
    this.provider.set(scheme, provider);
    this._onDidChangeFileSystemProviderRegistrations.fire({ added: true, scheme, provider });
    providerDisposables.add(provider.onDidChangeFile((changes) => {
      const event = new FileChangesEvent(changes, !this.isPathCaseSensitive(provider));
      this.internalOnDidFilesChange.fire(event);
      if (!event.hasCorrelation()) {
        this._onDidUncorrelatedFilesChange.fire(event);
      }
    }));
    if (typeof provider.onDidWatchError === "function") {
      providerDisposables.add(provider.onDidWatchError((error) => this._onDidWatchError.fire(new Error(error))));
    }
    providerDisposables.add(provider.onDidChangeCapabilities(() => this._onDidChangeFileSystemProviderCapabilities.fire({ provider, scheme })));
    return toDisposable(() => {
      this._onDidChangeFileSystemProviderRegistrations.fire({ added: false, scheme, provider });
      this.provider.delete(scheme);
      dispose(providerDisposables);
    });
  }
  getProvider(scheme) {
    return this.provider.get(scheme);
  }
  async activateProvider(scheme) {
    const joiners = [];
    this._onWillActivateFileSystemProvider.fire({
      scheme,
      join(promise) {
        joiners.push(promise);
      }
    });
    if (this.provider.has(scheme)) {
      return;
    }
    await Promises.settled(joiners);
  }
  async canHandleResource(resource) {
    await this.activateProvider(resource.scheme);
    return this.hasProvider(resource);
  }
  hasProvider(resource) {
    return this.provider.has(resource.scheme);
  }
  hasCapability(resource, capability) {
    const provider = this.provider.get(resource.scheme);
    return !!(provider && provider.capabilities & capability);
  }
  listCapabilities() {
    return Iterable.map(this.provider, ([scheme, provider]) => ({ scheme, capabilities: provider.capabilities }));
  }
  async withProvider(resource) {
    if (!isAbsolutePath(resource)) {
      throw new FileOperationError(localize("invalidPath", "Unable to resolve filesystem provider with relative file path '{0}'", this.resourceForError(resource)), FileOperationResult.FILE_INVALID_PATH);
    }
    await this.activateProvider(resource.scheme);
    const provider = this.provider.get(resource.scheme);
    if (!provider) {
      const error = new ErrorNoTelemetry();
      error.message = localize("noProviderFound", "ENOPRO: No file system provider found for resource '{0}'", resource.toString());
      throw error;
    }
    return provider;
  }
  async withReadProvider(resource) {
    const provider = await this.withProvider(resource);
    if (hasOpenReadWriteCloseCapability(provider) || hasReadWriteCapability(provider) || hasFileReadStreamCapability(provider)) {
      return provider;
    }
    throw new Error(`Filesystem provider for scheme '${resource.scheme}' neither has FileReadWrite, FileReadStream nor FileOpenReadWriteClose capability which is needed for the read operation.`);
  }
  async withWriteProvider(resource) {
    const provider = await this.withProvider(resource);
    if (hasOpenReadWriteCloseCapability(provider) || hasReadWriteCapability(provider)) {
      return provider;
    }
    throw new Error(`Filesystem provider for scheme '${resource.scheme}' neither has FileReadWrite nor FileOpenReadWriteClose capability which is needed for the write operation.`);
  }
  async resolve(resource, options) {
    try {
      return await this.doResolveFile(resource, options);
    } catch (error) {
      if (toFileSystemProviderErrorCode(error) === FileSystemProviderErrorCode.FileNotFound) {
        throw new FileOperationError(localize("fileNotFoundError", "Unable to resolve nonexistent file '{0}'", this.resourceForError(resource)), FileOperationResult.FILE_NOT_FOUND);
      }
      throw ensureFileSystemProviderError(error);
    }
  }
  async doResolveFile(resource, options) {
    const provider = await this.withProvider(resource);
    const isPathCaseSensitive = this.isPathCaseSensitive(provider);
    const resolveTo = options?.resolveTo;
    const resolveSingleChildDescendants = options?.resolveSingleChildDescendants;
    const resolveMetadata = options?.resolveMetadata;
    const stat = await provider.stat(resource);
    let trie;
    return this.toFileStat(provider, resource, stat, void 0, !!resolveMetadata, (stat2, siblings) => {
      if (!trie) {
        trie = TernarySearchTree.forUris(() => !isPathCaseSensitive);
        trie.set(resource, true);
        if (resolveTo) {
          trie.fill(true, resolveTo);
        }
      }
      if (trie.get(stat2.resource) || trie.findSuperstr(stat2.resource.with(
        { query: null, fragment: null }
        /* required for https://github.com/microsoft/vscode/issues/128151 */
      ))) {
        return true;
      }
      if (stat2.isDirectory && resolveSingleChildDescendants) {
        return siblings === 1;
      }
      return false;
    });
  }
  async toFileStat(provider, resource, stat, siblings, resolveMetadata, recurse) {
    const { providerExtUri } = this.getExtUri(provider);
    const fileStat = {
      resource,
      name: providerExtUri.basename(resource),
      isFile: (stat.type & FileType.File) !== 0,
      isDirectory: (stat.type & FileType.Directory) !== 0,
      isSymbolicLink: (stat.type & FileType.SymbolicLink) !== 0,
      mtime: stat.mtime,
      ctime: stat.ctime,
      size: stat.size,
      readonly: Boolean((stat.permissions ?? 0) & FilePermission.Readonly) || Boolean(provider.capabilities & FileSystemProviderCapabilities.Readonly),
      locked: Boolean((stat.permissions ?? 0) & FilePermission.Locked),
      etag: etag({ mtime: stat.mtime, size: stat.size }),
      children: void 0
    };
    if (fileStat.isDirectory && recurse(fileStat, siblings)) {
      try {
        const entries = await provider.readdir(resource);
        const resolvedEntries = await Promises.settled(entries.map(async ([name, type]) => {
          try {
            const childResource = providerExtUri.joinPath(resource, name);
            const childStat = resolveMetadata ? await provider.stat(childResource) : { type };
            return await this.toFileStat(provider, childResource, childStat, entries.length, resolveMetadata, recurse);
          } catch (error) {
            this.logService.trace(error);
            return null;
          }
        }));
        fileStat.children = coalesce(resolvedEntries);
      } catch (error) {
        this.logService.trace(error);
        fileStat.children = [];
      }
      return fileStat;
    }
    return fileStat;
  }
  async resolveAll(toResolve) {
    return Promises.settled(toResolve.map(async (entry) => {
      try {
        return { stat: await this.doResolveFile(entry.resource, entry.options), success: true };
      } catch (error) {
        this.logService.trace(error);
        return { stat: void 0, success: false };
      }
    }));
  }
  async stat(resource) {
    const provider = await this.withProvider(resource);
    const stat = await provider.stat(resource);
    return this.toFileStat(
      provider,
      resource,
      stat,
      void 0,
      true,
      () => false
      /* Do not resolve any children */
    );
  }
  async exists(resource) {
    const provider = await this.withProvider(resource);
    try {
      const stat = await provider.stat(resource);
      return !!stat;
    } catch (error) {
      return false;
    }
  }
  //#endregion
  //#region File Reading/Writing
  async canCreateFile(resource, options) {
    try {
      await this.doValidateCreateFile(resource, options);
    } catch (error) {
      return error;
    }
    return true;
  }
  async doValidateCreateFile(resource, options) {
    if (!options?.overwrite && await this.exists(resource)) {
      throw new FileOperationError(localize("fileExists", "Unable to create file '{0}' that already exists when overwrite flag is not set", this.resourceForError(resource)), FileOperationResult.FILE_MODIFIED_SINCE, options);
    }
  }
  async createFile(resource, bufferOrReadableOrStream = VSBuffer.fromString(""), options) {
    await this.doValidateCreateFile(resource, options);
    const fileStat = await this.writeFile(resource, bufferOrReadableOrStream);
    this._onDidRunOperation.fire(new FileOperationEvent(resource, FileOperation.CREATE, fileStat));
    return fileStat;
  }
  async writeFile(resource, bufferOrReadableOrStream, options) {
    const provider = this.throwIfFileSystemIsReadonly(await this.withWriteProvider(resource), resource);
    const { providerExtUri } = this.getExtUri(provider);
    let writeFileOptions = options;
    if (hasFileAtomicWriteCapability(provider) && !writeFileOptions?.atomic) {
      const enforcedAtomicWrite = provider.enforceAtomicWriteFile?.(resource);
      if (enforcedAtomicWrite) {
        writeFileOptions = { ...options, atomic: enforcedAtomicWrite };
      }
    }
    try {
      let { stat, buffer: bufferOrReadableOrStreamOrBufferedStream } = await this.validateWriteFile(provider, resource, bufferOrReadableOrStream, writeFileOptions);
      if (!stat) {
        await this.mkdirp(provider, providerExtUri.dirname(resource));
      }
      if (!bufferOrReadableOrStreamOrBufferedStream) {
        bufferOrReadableOrStreamOrBufferedStream = await this.peekBufferForWriting(provider, bufferOrReadableOrStream);
      }
      if (!hasOpenReadWriteCloseCapability(provider) || // buffered writing is unsupported
      hasReadWriteCapability(provider) && bufferOrReadableOrStreamOrBufferedStream instanceof VSBuffer || // data is a full buffer already
      hasReadWriteCapability(provider) && hasFileAtomicWriteCapability(provider) && writeFileOptions?.atomic) {
        await this.doWriteUnbuffered(provider, resource, writeFileOptions, bufferOrReadableOrStreamOrBufferedStream);
      } else {
        await this.doWriteBuffered(provider, resource, writeFileOptions, bufferOrReadableOrStreamOrBufferedStream instanceof VSBuffer ? bufferToReadable(bufferOrReadableOrStreamOrBufferedStream) : bufferOrReadableOrStreamOrBufferedStream);
      }
      this._onDidRunOperation.fire(new FileOperationEvent(resource, FileOperation.WRITE));
    } catch (error) {
      throw new FileOperationError(localize("err.write", "Unable to write file '{0}' ({1})", this.resourceForError(resource), ensureFileSystemProviderError(error).toString()), toFileOperationResult(error), writeFileOptions);
    }
    return this.resolve(resource, { resolveMetadata: true });
  }
  async peekBufferForWriting(provider, bufferOrReadableOrStream) {
    let peekResult;
    if (hasReadWriteCapability(provider) && !(bufferOrReadableOrStream instanceof VSBuffer)) {
      if (isReadableStream(bufferOrReadableOrStream)) {
        const bufferedStream = await peekStream(bufferOrReadableOrStream, 3);
        if (bufferedStream.ended) {
          peekResult = VSBuffer.concat(bufferedStream.buffer);
        } else {
          peekResult = bufferedStream;
        }
      } else {
        peekResult = peekReadable(bufferOrReadableOrStream, (data) => VSBuffer.concat(data), 3);
      }
    } else {
      peekResult = bufferOrReadableOrStream;
    }
    return peekResult;
  }
  async validateWriteFile(provider, resource, bufferOrReadableOrStream, options) {
    const unlock = !!options?.unlock;
    if (unlock && !(provider.capabilities & FileSystemProviderCapabilities.FileWriteUnlock)) {
      throw new Error(localize("writeFailedUnlockUnsupported", "Unable to unlock file '{0}' because provider does not support it.", this.resourceForError(resource)));
    }
    const atomic = !!options?.atomic;
    if (atomic) {
      if (!(provider.capabilities & FileSystemProviderCapabilities.FileAtomicWrite)) {
        throw new Error(localize("writeFailedAtomicUnsupported1", "Unable to atomically write file '{0}' because provider does not support it.", this.resourceForError(resource)));
      }
      if (!(provider.capabilities & FileSystemProviderCapabilities.FileReadWrite)) {
        throw new Error(localize("writeFailedAtomicUnsupported2", "Unable to atomically write file '{0}' because provider does not support unbuffered writes.", this.resourceForError(resource)));
      }
      if (unlock) {
        throw new Error(localize("writeFailedAtomicUnlock", "Unable to unlock file '{0}' because atomic write is enabled.", this.resourceForError(resource)));
      }
    }
    let stat = void 0;
    try {
      stat = await provider.stat(resource);
    } catch (error) {
      return /* @__PURE__ */ Object.create(null);
    }
    if ((stat.type & FileType.Directory) !== 0) {
      throw new FileOperationError(localize("fileIsDirectoryWriteError", "Unable to write file '{0}' that is actually a directory", this.resourceForError(resource)), FileOperationResult.FILE_IS_DIRECTORY, options);
    }
    this.throwIfFileIsReadonly(resource, stat);
    let buffer;
    if (typeof options?.mtime === "number" && typeof options.etag === "string" && options.etag !== ETAG_DISABLED && typeof stat.mtime === "number" && typeof stat.size === "number" && options.mtime < stat.mtime && options.etag !== etag({ mtime: options.mtime, size: stat.size })) {
      buffer = await this.peekBufferForWriting(provider, bufferOrReadableOrStream);
      if (buffer instanceof VSBuffer && buffer.byteLength === stat.size) {
        try {
          const { value } = await this.readFile(resource, { limits: { size: stat.size } });
          if (buffer.equals(value)) {
            return { stat, buffer };
          }
        } catch (error) {
        }
      }
      throw new FileOperationError(localize("fileModifiedError", "File Modified Since"), FileOperationResult.FILE_MODIFIED_SINCE, options);
    }
    return { stat, buffer };
  }
  async readFile(resource, options, token) {
    const provider = await this.withReadProvider(resource);
    if (options?.atomic) {
      return this.doReadFileAtomic(provider, resource, options, token);
    }
    return this.doReadFile(provider, resource, options, token);
  }
  async doReadFileAtomic(provider, resource, options, token) {
    return new Promise((resolve, reject) => {
      this.writeQueue.queueFor(resource, async () => {
        try {
          const content = await this.doReadFile(provider, resource, options, token);
          resolve(content);
        } catch (error) {
          reject(error);
        }
      }, this.getExtUri(provider).providerExtUri);
    });
  }
  async doReadFile(provider, resource, options, token) {
    const stream = await this.doReadFileStream(provider, resource, {
      ...options,
      // optimization: since we know that the caller does not
      // care about buffering, we indicate this to the reader.
      // this reduces all the overhead the buffered reading
      // has (open, read, close) if the provider supports
      // unbuffered reading.
      preferUnbuffered: true
    }, token);
    return {
      ...stream,
      value: await streamToBuffer(stream.value)
    };
  }
  async readFileStream(resource, options, token) {
    const provider = await this.withReadProvider(resource);
    return this.doReadFileStream(provider, resource, options, token);
  }
  async doReadFileStream(provider, resource, options, token) {
    const cancellableSource = new CancellationTokenSource(token);
    let readFileOptions = options;
    if (hasFileAtomicReadCapability(provider) && provider.enforceAtomicReadFile?.(resource)) {
      readFileOptions = { ...options, atomic: true };
    }
    const statPromise = this.validateReadFile(resource, readFileOptions).then((stat) => stat, (error) => {
      cancellableSource.dispose(true);
      throw error;
    });
    let fileStream = void 0;
    try {
      if (typeof readFileOptions?.etag === "string" && readFileOptions.etag !== ETAG_DISABLED) {
        await statPromise;
      }
      if (readFileOptions?.atomic && hasFileAtomicReadCapability(provider) || // atomic reads are always unbuffered
      !(hasOpenReadWriteCloseCapability(provider) || hasFileReadStreamCapability(provider)) || // provider has no buffered capability
      hasReadWriteCapability(provider) && readFileOptions?.preferUnbuffered) {
        fileStream = this.readFileUnbuffered(provider, resource, readFileOptions);
      } else if (hasFileReadStreamCapability(provider)) {
        fileStream = this.readFileStreamed(provider, resource, cancellableSource.token, readFileOptions);
      } else {
        fileStream = this.readFileBuffered(provider, resource, cancellableSource.token, readFileOptions);
      }
      fileStream.on("end", () => cancellableSource.dispose());
      fileStream.on("error", () => cancellableSource.dispose());
      const fileStat = await statPromise;
      return {
        ...fileStat,
        value: fileStream
      };
    } catch (error) {
      if (fileStream) {
        await consumeStream(fileStream);
      }
      throw this.restoreReadError(error, resource, readFileOptions);
    }
  }
  restoreReadError(error, resource, options) {
    const message = localize("err.read", "Unable to read file '{0}' ({1})", this.resourceForError(resource), ensureFileSystemProviderError(error).toString());
    if (error instanceof NotModifiedSinceFileOperationError) {
      return new NotModifiedSinceFileOperationError(message, error.stat, options);
    }
    if (error instanceof TooLargeFileOperationError) {
      return new TooLargeFileOperationError(message, error.fileOperationResult, error.size, error.options);
    }
    return new FileOperationError(message, toFileOperationResult(error), options);
  }
  readFileStreamed(provider, resource, token, options = /* @__PURE__ */ Object.create(null)) {
    const fileStream = provider.readFileStream(resource, options, token);
    return transform(fileStream, {
      data: (data) => data instanceof VSBuffer ? data : VSBuffer.wrap(data),
      error: (error) => this.restoreReadError(error, resource, options)
    }, (data) => VSBuffer.concat(data));
  }
  readFileBuffered(provider, resource, token, options = /* @__PURE__ */ Object.create(null)) {
    const stream = newWriteableBufferStream();
    readFileIntoStream(provider, resource, stream, (data) => data, {
      ...options,
      bufferSize: this.BUFFER_SIZE,
      errorTransformer: (error) => this.restoreReadError(error, resource, options)
    }, token);
    return stream;
  }
  readFileUnbuffered(provider, resource, options) {
    const stream = newWriteableStream((data) => VSBuffer.concat(data));
    (async () => {
      try {
        let buffer;
        if (options?.atomic && hasFileAtomicReadCapability(provider)) {
          buffer = await provider.readFile(resource, { atomic: true });
        } else {
          buffer = await provider.readFile(resource);
        }
        if (typeof options?.position === "number") {
          buffer = buffer.slice(options.position);
        }
        if (typeof options?.length === "number") {
          buffer = buffer.slice(0, options.length);
        }
        this.validateReadFileLimits(resource, buffer.byteLength, options);
        stream.end(VSBuffer.wrap(buffer));
      } catch (err) {
        stream.error(err);
        stream.end();
      }
    })();
    return stream;
  }
  async validateReadFile(resource, options) {
    const stat = await this.resolve(resource, { resolveMetadata: true });
    if (stat.isDirectory) {
      throw new FileOperationError(localize("fileIsDirectoryReadError", "Unable to read file '{0}' that is actually a directory", this.resourceForError(resource)), FileOperationResult.FILE_IS_DIRECTORY, options);
    }
    if (typeof options?.etag === "string" && options.etag !== ETAG_DISABLED && options.etag === stat.etag) {
      throw new NotModifiedSinceFileOperationError(localize("fileNotModifiedError", "File not modified since"), stat, options);
    }
    this.validateReadFileLimits(resource, stat.size, options);
    return stat;
  }
  validateReadFileLimits(resource, size, options) {
    if (typeof options?.limits?.size === "number" && size > options.limits.size) {
      throw new TooLargeFileOperationError(localize("fileTooLargeError", "Unable to read file '{0}' that is too large to open", this.resourceForError(resource)), FileOperationResult.FILE_TOO_LARGE, size, options);
    }
  }
  //#endregion
  //#region Move/Copy/Delete/Create Folder
  async canMove(source, target, overwrite) {
    return this.doCanMoveCopy(source, target, "move", overwrite);
  }
  async canCopy(source, target, overwrite) {
    return this.doCanMoveCopy(source, target, "copy", overwrite);
  }
  async doCanMoveCopy(source, target, mode, overwrite) {
    if (source.toString() !== target.toString()) {
      try {
        const sourceProvider = mode === "move" ? this.throwIfFileSystemIsReadonly(await this.withWriteProvider(source), source) : await this.withReadProvider(source);
        const targetProvider = this.throwIfFileSystemIsReadonly(await this.withWriteProvider(target), target);
        await this.doValidateMoveCopy(sourceProvider, source, targetProvider, target, mode, overwrite);
      } catch (error) {
        return error;
      }
    }
    return true;
  }
  async move(source, target, overwrite) {
    const sourceProvider = this.throwIfFileSystemIsReadonly(await this.withWriteProvider(source), source);
    const targetProvider = this.throwIfFileSystemIsReadonly(await this.withWriteProvider(target), target);
    const mode = await this.doMoveCopy(sourceProvider, source, targetProvider, target, "move", !!overwrite);
    const fileStat = await this.resolve(target, { resolveMetadata: true });
    this._onDidRunOperation.fire(new FileOperationEvent(source, mode === "move" ? FileOperation.MOVE : FileOperation.COPY, fileStat));
    return fileStat;
  }
  async copy(source, target, overwrite) {
    const sourceProvider = await this.withReadProvider(source);
    const targetProvider = this.throwIfFileSystemIsReadonly(await this.withWriteProvider(target), target);
    const mode = await this.doMoveCopy(sourceProvider, source, targetProvider, target, "copy", !!overwrite);
    const fileStat = await this.resolve(target, { resolveMetadata: true });
    this._onDidRunOperation.fire(new FileOperationEvent(source, mode === "copy" ? FileOperation.COPY : FileOperation.MOVE, fileStat));
    return fileStat;
  }
  async doMoveCopy(sourceProvider, source, targetProvider, target, mode, overwrite) {
    if (source.toString() === target.toString()) {
      return mode;
    }
    const { exists, isSameResourceWithDifferentPathCase } = await this.doValidateMoveCopy(sourceProvider, source, targetProvider, target, mode, overwrite);
    if (exists && !isSameResourceWithDifferentPathCase && overwrite) {
      await this.del(target, { recursive: true });
    }
    await this.mkdirp(targetProvider, this.getExtUri(targetProvider).providerExtUri.dirname(target));
    if (mode === "copy") {
      if (sourceProvider === targetProvider && hasFileFolderCopyCapability(sourceProvider)) {
        await sourceProvider.copy(source, target, { overwrite });
      } else {
        const sourceFile = await this.resolve(source);
        if (sourceFile.isDirectory) {
          await this.doCopyFolder(sourceProvider, sourceFile, targetProvider, target);
        } else {
          await this.doCopyFile(sourceProvider, source, targetProvider, target);
        }
      }
      return mode;
    } else {
      if (sourceProvider === targetProvider) {
        await sourceProvider.rename(source, target, { overwrite });
        return mode;
      } else {
        await this.doMoveCopy(sourceProvider, source, targetProvider, target, "copy", overwrite);
        await this.del(source, { recursive: true });
        return "copy";
      }
    }
  }
  async doCopyFile(sourceProvider, source, targetProvider, target) {
    if (hasOpenReadWriteCloseCapability(sourceProvider) && hasOpenReadWriteCloseCapability(targetProvider)) {
      return this.doPipeBuffered(sourceProvider, source, targetProvider, target);
    }
    if (hasOpenReadWriteCloseCapability(sourceProvider) && hasReadWriteCapability(targetProvider)) {
      return this.doPipeBufferedToUnbuffered(sourceProvider, source, targetProvider, target);
    }
    if (hasReadWriteCapability(sourceProvider) && hasOpenReadWriteCloseCapability(targetProvider)) {
      return this.doPipeUnbufferedToBuffered(sourceProvider, source, targetProvider, target);
    }
    if (hasReadWriteCapability(sourceProvider) && hasReadWriteCapability(targetProvider)) {
      return this.doPipeUnbuffered(sourceProvider, source, targetProvider, target);
    }
  }
  async doCopyFolder(sourceProvider, sourceFolder, targetProvider, targetFolder) {
    await targetProvider.mkdir(targetFolder);
    if (Array.isArray(sourceFolder.children)) {
      await Promises.settled(sourceFolder.children.map(async (sourceChild) => {
        const targetChild = this.getExtUri(targetProvider).providerExtUri.joinPath(targetFolder, sourceChild.name);
        if (sourceChild.isDirectory) {
          return this.doCopyFolder(sourceProvider, await this.resolve(sourceChild.resource), targetProvider, targetChild);
        } else {
          return this.doCopyFile(sourceProvider, sourceChild.resource, targetProvider, targetChild);
        }
      }));
    }
  }
  async doValidateMoveCopy(sourceProvider, source, targetProvider, target, mode, overwrite) {
    let isSameResourceWithDifferentPathCase = false;
    if (sourceProvider === targetProvider) {
      const { providerExtUri, isPathCaseSensitive } = this.getExtUri(sourceProvider);
      if (!isPathCaseSensitive) {
        isSameResourceWithDifferentPathCase = providerExtUri.isEqual(source, target);
      }
      if (isSameResourceWithDifferentPathCase && mode === "copy") {
        throw new Error(localize("unableToMoveCopyError1", "Unable to copy when source '{0}' is same as target '{1}' with different path case on a case insensitive file system", this.resourceForError(source), this.resourceForError(target)));
      }
      if (!isSameResourceWithDifferentPathCase && providerExtUri.isEqualOrParent(target, source)) {
        throw new Error(localize("unableToMoveCopyError2", "Unable to move/copy when source '{0}' is parent of target '{1}'.", this.resourceForError(source), this.resourceForError(target)));
      }
    }
    const exists = await this.exists(target);
    if (exists && !isSameResourceWithDifferentPathCase) {
      if (!overwrite) {
        throw new FileOperationError(localize("unableToMoveCopyError3", "Unable to move/copy '{0}' because target '{1}' already exists at destination.", this.resourceForError(source), this.resourceForError(target)), FileOperationResult.FILE_MOVE_CONFLICT);
      }
      if (sourceProvider === targetProvider) {
        const { providerExtUri } = this.getExtUri(sourceProvider);
        if (providerExtUri.isEqualOrParent(source, target)) {
          throw new Error(localize("unableToMoveCopyError4", "Unable to move/copy '{0}' into '{1}' since a file would replace the folder it is contained in.", this.resourceForError(source), this.resourceForError(target)));
        }
      }
    }
    return { exists, isSameResourceWithDifferentPathCase };
  }
  getExtUri(provider) {
    const isPathCaseSensitive = this.isPathCaseSensitive(provider);
    return {
      providerExtUri: isPathCaseSensitive ? extUri : extUriIgnorePathCase,
      isPathCaseSensitive
    };
  }
  isPathCaseSensitive(provider) {
    return !!(provider.capabilities & FileSystemProviderCapabilities.PathCaseSensitive);
  }
  async createFolder(resource) {
    const provider = this.throwIfFileSystemIsReadonly(await this.withProvider(resource), resource);
    await this.mkdirp(provider, resource);
    const fileStat = await this.resolve(resource, { resolveMetadata: true });
    this._onDidRunOperation.fire(new FileOperationEvent(resource, FileOperation.CREATE, fileStat));
    return fileStat;
  }
  async mkdirp(provider, directory) {
    const directoriesToCreate = [];
    const { providerExtUri } = this.getExtUri(provider);
    while (!providerExtUri.isEqual(directory, providerExtUri.dirname(directory))) {
      try {
        const stat = await provider.stat(directory);
        if ((stat.type & FileType.Directory) === 0) {
          throw new Error(localize("mkdirExistsError", "Unable to create folder '{0}' that already exists but is not a directory", this.resourceForError(directory)));
        }
        break;
      } catch (error) {
        if (toFileSystemProviderErrorCode(error) !== FileSystemProviderErrorCode.FileNotFound) {
          throw error;
        }
        directoriesToCreate.push(providerExtUri.basename(directory));
        directory = providerExtUri.dirname(directory);
      }
    }
    for (let i = directoriesToCreate.length - 1; i >= 0; i--) {
      directory = providerExtUri.joinPath(directory, directoriesToCreate[i]);
      try {
        await provider.mkdir(directory);
      } catch (error) {
        if (toFileSystemProviderErrorCode(error) !== FileSystemProviderErrorCode.FileExists) {
          throw error;
        }
      }
    }
  }
  async canDelete(resource, options) {
    try {
      await this.doValidateDelete(resource, options);
    } catch (error) {
      return error;
    }
    return true;
  }
  async doValidateDelete(resource, options) {
    const provider = this.throwIfFileSystemIsReadonly(await this.withProvider(resource), resource);
    const useTrash = !!options?.useTrash;
    if (useTrash && !(provider.capabilities & FileSystemProviderCapabilities.Trash)) {
      throw new Error(localize("deleteFailedTrashUnsupported", "Unable to delete file '{0}' via trash because provider does not support it.", this.resourceForError(resource)));
    }
    const atomic = options?.atomic;
    if (atomic && !(provider.capabilities & FileSystemProviderCapabilities.FileAtomicDelete)) {
      throw new Error(localize("deleteFailedAtomicUnsupported", "Unable to delete file '{0}' atomically because provider does not support it.", this.resourceForError(resource)));
    }
    if (useTrash && atomic) {
      throw new Error(localize("deleteFailedTrashAndAtomicUnsupported", "Unable to atomically delete file '{0}' because using trash is enabled.", this.resourceForError(resource)));
    }
    let stat = void 0;
    try {
      stat = await provider.stat(resource);
    } catch (error) {
    }
    if (stat) {
      this.throwIfFileIsReadonly(resource, stat);
    } else {
      throw new FileOperationError(localize("deleteFailedNotFound", "Unable to delete nonexistent file '{0}'", this.resourceForError(resource)), FileOperationResult.FILE_NOT_FOUND);
    }
    const recursive = !!options?.recursive;
    if (!recursive) {
      const stat2 = await this.resolve(resource);
      if (stat2.isDirectory && Array.isArray(stat2.children) && stat2.children.length > 0) {
        throw new Error(localize("deleteFailedNonEmptyFolder", "Unable to delete non-empty folder '{0}'.", this.resourceForError(resource)));
      }
    }
    return provider;
  }
  async del(resource, options) {
    const provider = await this.doValidateDelete(resource, options);
    let deleteFileOptions = options;
    if (hasFileAtomicDeleteCapability(provider) && !deleteFileOptions?.atomic) {
      const enforcedAtomicDelete = provider.enforceAtomicDelete?.(resource);
      if (enforcedAtomicDelete) {
        deleteFileOptions = { ...options, atomic: enforcedAtomicDelete };
      }
    }
    const useTrash = !!deleteFileOptions?.useTrash;
    const recursive = !!deleteFileOptions?.recursive;
    const atomic = deleteFileOptions?.atomic ?? false;
    await provider.delete(resource, { recursive, useTrash, atomic });
    this._onDidRunOperation.fire(new FileOperationEvent(resource, FileOperation.DELETE));
  }
  //#endregion
  //#region Clone File
  async cloneFile(source, target) {
    const sourceProvider = await this.withProvider(source);
    const targetProvider = this.throwIfFileSystemIsReadonly(await this.withWriteProvider(target), target);
    if (sourceProvider === targetProvider && this.getExtUri(sourceProvider).providerExtUri.isEqual(source, target)) {
      return;
    }
    if (sourceProvider === targetProvider && hasFileCloneCapability(sourceProvider)) {
      return sourceProvider.cloneFile(source, target);
    }
    await this.mkdirp(targetProvider, this.getExtUri(targetProvider).providerExtUri.dirname(target));
    if (sourceProvider === targetProvider && hasFileFolderCopyCapability(sourceProvider)) {
      return this.writeQueue.queueFor(source, () => sourceProvider.copy(source, target, { overwrite: true }), this.getExtUri(sourceProvider).providerExtUri);
    }
    return this.writeQueue.queueFor(source, () => this.doCopyFile(sourceProvider, source, targetProvider, target), this.getExtUri(sourceProvider).providerExtUri);
  }
  createWatcher(resource, options) {
    return this.watch(resource, {
      ...options,
      // Explicitly set a correlation id so that file events that originate
      // from requests from extensions are exclusively routed back to the
      // extension host and not into the workbench.
      correlationId: FileService.WATCHER_CORRELATION_IDS++
    });
  }
  watch(resource, options = { recursive: false, excludes: [] }) {
    const disposables = new DisposableStore();
    let watchDisposed = false;
    let disposeWatch = () => {
      watchDisposed = true;
    };
    disposables.add(toDisposable(() => disposeWatch()));
    (async () => {
      try {
        const disposable = await this.doWatch(resource, options);
        if (watchDisposed) {
          dispose(disposable);
        } else {
          disposeWatch = () => dispose(disposable);
        }
      } catch (error) {
        this.logService.error(error);
      }
    })();
    const correlationId = options.correlationId;
    if (typeof correlationId === "number") {
      const fileChangeEmitter = disposables.add(new Emitter());
      disposables.add(this.internalOnDidFilesChange.event((e) => {
        if (e.correlates(correlationId)) {
          fileChangeEmitter.fire(e);
        }
      }));
      const watcher = {
        onDidChange: fileChangeEmitter.event,
        dispose: () => disposables.dispose()
      };
      return watcher;
    }
    return disposables;
  }
  async doWatch(resource, options) {
    const provider = await this.withProvider(resource);
    const watchHash = hash([this.getExtUri(provider).providerExtUri.getComparisonKey(resource), options]);
    let watcher = this.activeWatchers.get(watchHash);
    if (!watcher) {
      watcher = {
        count: 0,
        disposable: provider.watch(resource, options)
      };
      this.activeWatchers.set(watchHash, watcher);
    }
    watcher.count += 1;
    return toDisposable(() => {
      if (watcher) {
        watcher.count--;
        if (watcher.count === 0) {
          dispose(watcher.disposable);
          this.activeWatchers.delete(watchHash);
        }
      }
    });
  }
  dispose() {
    super.dispose();
    for (const [, watcher] of this.activeWatchers) {
      dispose(watcher.disposable);
    }
    this.activeWatchers.clear();
  }
  async doWriteBuffered(provider, resource, options, readableOrStreamOrBufferedStream) {
    return this.writeQueue.queueFor(resource, async () => {
      const handle = await provider.open(resource, { create: true, unlock: options?.unlock ?? false });
      try {
        if (isReadableStream(readableOrStreamOrBufferedStream) || isReadableBufferedStream(readableOrStreamOrBufferedStream)) {
          await this.doWriteStreamBufferedQueued(provider, handle, readableOrStreamOrBufferedStream);
        } else {
          await this.doWriteReadableBufferedQueued(provider, handle, readableOrStreamOrBufferedStream);
        }
      } catch (error) {
        throw ensureFileSystemProviderError(error);
      } finally {
        await provider.close(handle);
      }
    }, this.getExtUri(provider).providerExtUri);
  }
  async doWriteStreamBufferedQueued(provider, handle, streamOrBufferedStream) {
    let posInFile = 0;
    let stream;
    if (isReadableBufferedStream(streamOrBufferedStream)) {
      if (streamOrBufferedStream.buffer.length > 0) {
        const chunk = VSBuffer.concat(streamOrBufferedStream.buffer);
        await this.doWriteBuffer(provider, handle, chunk, chunk.byteLength, posInFile, 0);
        posInFile += chunk.byteLength;
      }
      if (streamOrBufferedStream.ended) {
        return;
      }
      stream = streamOrBufferedStream.stream;
    } else {
      stream = streamOrBufferedStream;
    }
    return new Promise((resolve, reject) => {
      listenStream(stream, {
        onData: async (chunk) => {
          stream.pause();
          try {
            await this.doWriteBuffer(provider, handle, chunk, chunk.byteLength, posInFile, 0);
          } catch (error) {
            return reject(error);
          }
          posInFile += chunk.byteLength;
          setTimeout(() => stream.resume());
        },
        onError: (error) => reject(error),
        onEnd: () => resolve()
      });
    });
  }
  async doWriteReadableBufferedQueued(provider, handle, readable) {
    let posInFile = 0;
    let chunk;
    while ((chunk = readable.read()) !== null) {
      await this.doWriteBuffer(provider, handle, chunk, chunk.byteLength, posInFile, 0);
      posInFile += chunk.byteLength;
    }
  }
  async doWriteBuffer(provider, handle, buffer, length, posInFile, posInBuffer) {
    let totalBytesWritten = 0;
    while (totalBytesWritten < length) {
      const bytesWritten = await provider.write(handle, posInFile + totalBytesWritten, buffer.buffer, posInBuffer + totalBytesWritten, length - totalBytesWritten);
      totalBytesWritten += bytesWritten;
    }
  }
  async doWriteUnbuffered(provider, resource, options, bufferOrReadableOrStreamOrBufferedStream) {
    return this.writeQueue.queueFor(resource, () => this.doWriteUnbufferedQueued(provider, resource, options, bufferOrReadableOrStreamOrBufferedStream), this.getExtUri(provider).providerExtUri);
  }
  async doWriteUnbufferedQueued(provider, resource, options, bufferOrReadableOrStreamOrBufferedStream) {
    let buffer;
    if (bufferOrReadableOrStreamOrBufferedStream instanceof VSBuffer) {
      buffer = bufferOrReadableOrStreamOrBufferedStream;
    } else if (isReadableStream(bufferOrReadableOrStreamOrBufferedStream)) {
      buffer = await streamToBuffer(bufferOrReadableOrStreamOrBufferedStream);
    } else if (isReadableBufferedStream(bufferOrReadableOrStreamOrBufferedStream)) {
      buffer = await bufferedStreamToBuffer(bufferOrReadableOrStreamOrBufferedStream);
    } else {
      buffer = readableToBuffer(bufferOrReadableOrStreamOrBufferedStream);
    }
    await provider.writeFile(resource, buffer.buffer, { create: true, overwrite: true, unlock: options?.unlock ?? false, atomic: options?.atomic ?? false });
  }
  async doPipeBuffered(sourceProvider, source, targetProvider, target) {
    return this.writeQueue.queueFor(target, () => this.doPipeBufferedQueued(sourceProvider, source, targetProvider, target), this.getExtUri(targetProvider).providerExtUri);
  }
  async doPipeBufferedQueued(sourceProvider, source, targetProvider, target) {
    let sourceHandle = void 0;
    let targetHandle = void 0;
    try {
      sourceHandle = await sourceProvider.open(source, { create: false });
      targetHandle = await targetProvider.open(target, { create: true, unlock: false });
      const buffer = VSBuffer.alloc(this.BUFFER_SIZE);
      let posInFile = 0;
      let posInBuffer = 0;
      let bytesRead = 0;
      do {
        bytesRead = await sourceProvider.read(sourceHandle, posInFile, buffer.buffer, posInBuffer, buffer.byteLength - posInBuffer);
        await this.doWriteBuffer(targetProvider, targetHandle, buffer, bytesRead, posInFile, posInBuffer);
        posInFile += bytesRead;
        posInBuffer += bytesRead;
        if (posInBuffer === buffer.byteLength) {
          posInBuffer = 0;
        }
      } while (bytesRead > 0);
    } catch (error) {
      throw ensureFileSystemProviderError(error);
    } finally {
      await Promises.settled([
        typeof sourceHandle === "number" ? sourceProvider.close(sourceHandle) : Promise.resolve(),
        typeof targetHandle === "number" ? targetProvider.close(targetHandle) : Promise.resolve()
      ]);
    }
  }
  async doPipeUnbuffered(sourceProvider, source, targetProvider, target) {
    return this.writeQueue.queueFor(target, () => this.doPipeUnbufferedQueued(sourceProvider, source, targetProvider, target), this.getExtUri(targetProvider).providerExtUri);
  }
  async doPipeUnbufferedQueued(sourceProvider, source, targetProvider, target) {
    return targetProvider.writeFile(target, await sourceProvider.readFile(source), { create: true, overwrite: true, unlock: false, atomic: false });
  }
  async doPipeUnbufferedToBuffered(sourceProvider, source, targetProvider, target) {
    return this.writeQueue.queueFor(target, () => this.doPipeUnbufferedToBufferedQueued(sourceProvider, source, targetProvider, target), this.getExtUri(targetProvider).providerExtUri);
  }
  async doPipeUnbufferedToBufferedQueued(sourceProvider, source, targetProvider, target) {
    const targetHandle = await targetProvider.open(target, { create: true, unlock: false });
    try {
      const buffer = await sourceProvider.readFile(source);
      await this.doWriteBuffer(targetProvider, targetHandle, VSBuffer.wrap(buffer), buffer.byteLength, 0, 0);
    } catch (error) {
      throw ensureFileSystemProviderError(error);
    } finally {
      await targetProvider.close(targetHandle);
    }
  }
  async doPipeBufferedToUnbuffered(sourceProvider, source, targetProvider, target) {
    const buffer = await streamToBuffer(this.readFileBuffered(sourceProvider, source, CancellationToken.None));
    await this.doWriteUnbuffered(targetProvider, target, void 0, buffer);
  }
  throwIfFileSystemIsReadonly(provider, resource) {
    if (provider.capabilities & FileSystemProviderCapabilities.Readonly) {
      throw new FileOperationError(localize("err.readonly", "Unable to modify read-only file '{0}'", this.resourceForError(resource)), FileOperationResult.FILE_PERMISSION_DENIED);
    }
    return provider;
  }
  throwIfFileIsReadonly(resource, stat) {
    if ((stat.permissions ?? 0) & FilePermission.Readonly) {
      throw new FileOperationError(localize("err.readonly", "Unable to modify read-only file '{0}'", this.resourceForError(resource)), FileOperationResult.FILE_PERMISSION_DENIED);
    }
  }
  resourceForError(resource) {
    if (resource.scheme === Schemas.file) {
      return resource.fsPath;
    }
    return resource.toString(true);
  }
  //#endregion
};
FileService.WATCHER_CORRELATION_IDS = 0;
FileService = __decorateClass([
  __decorateParam(0, ILogService)
], FileService);
export {
  FileService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZVNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBjb2FsZXNjZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBQcm9taXNlcywgUmVzb3VyY2VRdWV1ZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IGJ1ZmZlcmVkU3RyZWFtVG9CdWZmZXIsIGJ1ZmZlclRvUmVhZGFibGUsIG5ld1dyaXRlYWJsZUJ1ZmZlclN0cmVhbSwgcmVhZGFibGVUb0J1ZmZlciwgc3RyZWFtVG9CdWZmZXIsIFZTQnVmZmVyLCBWU0J1ZmZlclJlYWRhYmxlLCBWU0J1ZmZlclJlYWRhYmxlQnVmZmVyZWRTdHJlYW0sIFZTQnVmZmVyUmVhZGFibGVTdHJlYW0gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4sIENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBoYXNoIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vaGFzaC5qcyc7XG5pbXBvcnQgeyBJdGVyYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2l0ZXJhdG9yLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgZGlzcG9zZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBUZXJuYXJ5U2VhcmNoVHJlZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Rlcm5hcnlTZWFyY2hUcmVlLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IG1hcmsgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wZXJmb3JtYW5jZS5qcyc7XG5pbXBvcnQgeyBleHRVcmksIGV4dFVyaUlnbm9yZVBhdGhDYXNlLCBJRXh0VXJpLCBpc0Fic29sdXRlUGF0aCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBjb25zdW1lU3RyZWFtLCBpc1JlYWRhYmxlQnVmZmVyZWRTdHJlYW0sIGlzUmVhZGFibGVTdHJlYW0sIGxpc3RlblN0cmVhbSwgbmV3V3JpdGVhYmxlU3RyZWFtLCBwZWVrUmVhZGFibGUsIHBlZWtTdHJlYW0sIHRyYW5zZm9ybSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmVhbS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgZW5zdXJlRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3IsIGV0YWcsIEVUQUdfRElTQUJMRUQsIEZpbGVDaGFuZ2VzRXZlbnQsIElGaWxlRGVsZXRlT3B0aW9ucywgRmlsZU9wZXJhdGlvbiwgRmlsZU9wZXJhdGlvbkVycm9yLCBGaWxlT3BlcmF0aW9uRXZlbnQsIEZpbGVPcGVyYXRpb25SZXN1bHQsIEZpbGVQZXJtaXNzaW9uLCBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMsIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZSwgRmlsZVR5cGUsIGhhc0ZpbGVBdG9taWNSZWFkQ2FwYWJpbGl0eSwgaGFzRmlsZUZvbGRlckNvcHlDYXBhYmlsaXR5LCBoYXNGaWxlUmVhZFN0cmVhbUNhcGFiaWxpdHksIGhhc09wZW5SZWFkV3JpdGVDbG9zZUNhcGFiaWxpdHksIGhhc1JlYWRXcml0ZUNhcGFiaWxpdHksIElDcmVhdGVGaWxlT3B0aW9ucywgSUZpbGVDb250ZW50LCBJRmlsZVNlcnZpY2UsIElGaWxlU3RhdCwgSUZpbGVTdGF0V2l0aE1ldGFkYXRhLCBJRmlsZVN0cmVhbUNvbnRlbnQsIElGaWxlU3lzdGVtUHJvdmlkZXIsIElGaWxlU3lzdGVtUHJvdmlkZXJBY3RpdmF0aW9uRXZlbnQsIElGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXNDaGFuZ2VFdmVudCwgSUZpbGVTeXN0ZW1Qcm92aWRlclJlZ2lzdHJhdGlvbkV2ZW50LCBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVBdG9taWNSZWFkQ2FwYWJpbGl0eSwgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlUmVhZFN0cmVhbUNhcGFiaWxpdHksIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZVJlYWRXcml0ZUNhcGFiaWxpdHksIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoT3BlblJlYWRXcml0ZUNsb3NlQ2FwYWJpbGl0eSwgSVJlYWRGaWxlT3B0aW9ucywgSVJlYWRGaWxlU3RyZWFtT3B0aW9ucywgSVJlc29sdmVGaWxlT3B0aW9ucywgSUZpbGVTdGF0UmVzdWx0LCBJRmlsZVN0YXRSZXN1bHRXaXRoTWV0YWRhdGEsIElSZXNvbHZlTWV0YWRhdGFGaWxlT3B0aW9ucywgSVN0YXQsIElGaWxlU3RhdFdpdGhQYXJ0aWFsTWV0YWRhdGEsIElXYXRjaE9wdGlvbnMsIElXcml0ZUZpbGVPcHRpb25zLCBOb3RNb2RpZmllZFNpbmNlRmlsZU9wZXJhdGlvbkVycm9yLCB0b0ZpbGVPcGVyYXRpb25SZXN1bHQsIHRvRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLCBoYXNGaWxlQ2xvbmVDYXBhYmlsaXR5LCBUb29MYXJnZUZpbGVPcGVyYXRpb25FcnJvciwgaGFzRmlsZUF0b21pY0RlbGV0ZUNhcGFiaWxpdHksIGhhc0ZpbGVBdG9taWNXcml0ZUNhcGFiaWxpdHksIElXYXRjaE9wdGlvbnNXaXRoQ29ycmVsYXRpb24sIElGaWxlU3lzdGVtV2F0Y2hlciwgSVdhdGNoT3B0aW9uc1dpdGhvdXRDb3JyZWxhdGlvbiB9IGZyb20gJy4vZmlsZXMuanMnO1xuaW1wb3J0IHsgcmVhZEZpbGVJbnRvU3RyZWFtIH0gZnJvbSAnLi9pby5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IEVycm9yTm9UZWxlbWV0cnkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuXG5leHBvcnQgY2xhc3MgRmlsZVNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUZpbGVTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHQvLyBDaG9vc2UgYSBidWZmZXIgc2l6ZSB0aGF0IGlzIGEgYmFsYW5jZSBiZXR3ZWVuIG1lbW9yeSBuZWVkcyBhbmRcblx0Ly8gbWFuYWdlYWJsZSBJUEMgb3ZlcmhlYWQuIFRoZSBsYXJnZXIgdGhlIGJ1ZmZlciBzaXplLCB0aGUgbGVzc1xuXHQvLyByb3VuZHRyaXBzIHdlIGhhdmUgdG8gZG8gZm9yIHJlYWRpbmcvd3JpdGluZyBkYXRhLlxuXHRwcml2YXRlIHJlYWRvbmx5IEJVRkZFUl9TSVpFID0gMjU2ICogMTAyNDtcblxuXHRjb25zdHJ1Y3RvcihASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHQvLyNyZWdpb24gRmlsZSBTeXN0ZW0gUHJvdmlkZXJcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUZpbGVTeXN0ZW1Qcm92aWRlclJlZ2lzdHJhdGlvbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJRmlsZVN5c3RlbVByb3ZpZGVyUmVnaXN0cmF0aW9uRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUZpbGVTeXN0ZW1Qcm92aWRlclJlZ2lzdHJhdGlvbnMgPSB0aGlzLl9vbkRpZENoYW5nZUZpbGVTeXN0ZW1Qcm92aWRlclJlZ2lzdHJhdGlvbnMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25XaWxsQWN0aXZhdGVGaWxlU3lzdGVtUHJvdmlkZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJRmlsZVN5c3RlbVByb3ZpZGVyQWN0aXZhdGlvbkV2ZW50PigpKTtcblx0cmVhZG9ubHkgb25XaWxsQWN0aXZhdGVGaWxlU3lzdGVtUHJvdmlkZXIgPSB0aGlzLl9vbldpbGxBY3RpdmF0ZUZpbGVTeXN0ZW1Qcm92aWRlci5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXNDaGFuZ2VFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzID0gdGhpcy5fb25EaWRDaGFuZ2VGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBwcm92aWRlciA9IG5ldyBNYXA8c3RyaW5nLCBJRmlsZVN5c3RlbVByb3ZpZGVyPigpO1xuXG5cdHJlZ2lzdGVyUHJvdmlkZXIoc2NoZW1lOiBzdHJpbmcsIHByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRcdGlmICh0aGlzLnByb3ZpZGVyLmhhcyhzY2hlbWUpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEEgZmlsZXN5c3RlbSBwcm92aWRlciBmb3IgdGhlIHNjaGVtZSAnJHtzY2hlbWV9JyBpcyBhbHJlYWR5IHJlZ2lzdGVyZWQuYCk7XG5cdFx0fVxuXG5cdFx0bWFyayhgY29kZS9yZWdpc3RlckZpbGVzeXN0ZW0vJHtzY2hlbWV9YCk7XG5cblx0XHRjb25zdCBwcm92aWRlckRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0Ly8gQWRkIHByb3ZpZGVyIHdpdGggZXZlbnRcblx0XHR0aGlzLnByb3ZpZGVyLnNldChzY2hlbWUsIHByb3ZpZGVyKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUZpbGVTeXN0ZW1Qcm92aWRlclJlZ2lzdHJhdGlvbnMuZmlyZSh7IGFkZGVkOiB0cnVlLCBzY2hlbWUsIHByb3ZpZGVyIH0pO1xuXG5cdFx0Ly8gRm9yd2FyZCBldmVudHMgZnJvbSBwcm92aWRlclxuXHRcdHByb3ZpZGVyRGlzcG9zYWJsZXMuYWRkKHByb3ZpZGVyLm9uRGlkQ2hhbmdlRmlsZShjaGFuZ2VzID0+IHtcblx0XHRcdGNvbnN0IGV2ZW50ID0gbmV3IEZpbGVDaGFuZ2VzRXZlbnQoY2hhbmdlcywgIXRoaXMuaXNQYXRoQ2FzZVNlbnNpdGl2ZShwcm92aWRlcikpO1xuXG5cdFx0XHQvLyBBbHdheXMgZW1pdCBhbnkgZXZlbnQgaW50ZXJuYWxseVxuXHRcdFx0dGhpcy5pbnRlcm5hbE9uRGlkRmlsZXNDaGFuZ2UuZmlyZShldmVudCk7XG5cblx0XHRcdC8vIE9ubHkgZW1pdCB1bmNvcnJlbGF0ZWQgZXZlbnRzIGluIHRoZSBnbG9iYWwgYG9uRGlkRmlsZXNDaGFuZ2VgIGV2ZW50XG5cdFx0XHRpZiAoIWV2ZW50Lmhhc0NvcnJlbGF0aW9uKCkpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRVbmNvcnJlbGF0ZWRGaWxlc0NoYW5nZS5maXJlKGV2ZW50KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0aWYgKHR5cGVvZiBwcm92aWRlci5vbkRpZFdhdGNoRXJyb3IgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHByb3ZpZGVyRGlzcG9zYWJsZXMuYWRkKHByb3ZpZGVyLm9uRGlkV2F0Y2hFcnJvcihlcnJvciA9PiB0aGlzLl9vbkRpZFdhdGNoRXJyb3IuZmlyZShuZXcgRXJyb3IoZXJyb3IpKSkpO1xuXHRcdH1cblx0XHRwcm92aWRlckRpc3Bvc2FibGVzLmFkZChwcm92aWRlci5vbkRpZENoYW5nZUNhcGFiaWxpdGllcygoKSA9PiB0aGlzLl9vbkRpZENoYW5nZUZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5maXJlKHsgcHJvdmlkZXIsIHNjaGVtZSB9KSkpO1xuXG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUZpbGVTeXN0ZW1Qcm92aWRlclJlZ2lzdHJhdGlvbnMuZmlyZSh7IGFkZGVkOiBmYWxzZSwgc2NoZW1lLCBwcm92aWRlciB9KTtcblx0XHRcdHRoaXMucHJvdmlkZXIuZGVsZXRlKHNjaGVtZSk7XG5cblx0XHRcdGRpc3Bvc2UocHJvdmlkZXJEaXNwb3NhYmxlcyk7XG5cdFx0fSk7XG5cdH1cblxuXHRnZXRQcm92aWRlcihzY2hlbWU6IHN0cmluZyk6IElGaWxlU3lzdGVtUHJvdmlkZXIgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnByb3ZpZGVyLmdldChzY2hlbWUpO1xuXHR9XG5cblx0YXN5bmMgYWN0aXZhdGVQcm92aWRlcihzY2hlbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gRW1pdCBhbiBldmVudCB0aGF0IHdlIGFyZSBhYm91dCB0byBhY3RpdmF0ZSBhIHByb3ZpZGVyIHdpdGggdGhlIGdpdmVuIHNjaGVtZS5cblx0XHQvLyBMaXN0ZW5lcnMgY2FuIHBhcnRpY2lwYXRlIGluIHRoZSBhY3RpdmF0aW9uIGJ5IHJlZ2lzdGVyaW5nIGEgcHJvdmlkZXIgZm9yIGl0LlxuXHRcdGNvbnN0IGpvaW5lcnM6IFByb21pc2U8dm9pZD5bXSA9IFtdO1xuXHRcdHRoaXMuX29uV2lsbEFjdGl2YXRlRmlsZVN5c3RlbVByb3ZpZGVyLmZpcmUoe1xuXHRcdFx0c2NoZW1lLFxuXHRcdFx0am9pbihwcm9taXNlKSB7XG5cdFx0XHRcdGpvaW5lcnMucHVzaChwcm9taXNlKTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHRpZiAodGhpcy5wcm92aWRlci5oYXMoc2NoZW1lKSkge1xuXHRcdFx0cmV0dXJuOyAvLyBwcm92aWRlciBpcyBhbHJlYWR5IGhlcmUgc28gd2UgY2FuIHJldHVybiBkaXJlY3RseVxuXHRcdH1cblxuXHRcdC8vIElmIHRoZSBwcm92aWRlciBpcyBub3QgeWV0IHRoZXJlLCBtYWtlIHN1cmUgdG8gam9pbiBvbiB0aGUgbGlzdGVuZXJzIGFzc3VtaW5nXG5cdFx0Ly8gdGhhdCBpdCB0YWtlcyBhIGJpdCBsb25nZXIgdG8gcmVnaXN0ZXIgdGhlIGZpbGUgc3lzdGVtIHByb3ZpZGVyLlxuXHRcdGF3YWl0IFByb21pc2VzLnNldHRsZWQoam9pbmVycyk7XG5cdH1cblxuXHRhc3luYyBjYW5IYW5kbGVSZXNvdXJjZShyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxib29sZWFuPiB7XG5cblx0XHQvLyBBd2FpdCBhY3RpdmF0aW9uIG9mIHBvdGVudGlhbGx5IGV4dGVuc2lvbiBjb250cmlidXRlZCBwcm92aWRlcnNcblx0XHRhd2FpdCB0aGlzLmFjdGl2YXRlUHJvdmlkZXIocmVzb3VyY2Uuc2NoZW1lKTtcblxuXHRcdHJldHVybiB0aGlzLmhhc1Byb3ZpZGVyKHJlc291cmNlKTtcblx0fVxuXG5cdGhhc1Byb3ZpZGVyKHJlc291cmNlOiBVUkkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5wcm92aWRlci5oYXMocmVzb3VyY2Uuc2NoZW1lKTtcblx0fVxuXG5cdGhhc0NhcGFiaWxpdHkocmVzb3VyY2U6IFVSSSwgY2FwYWJpbGl0eTogRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLnByb3ZpZGVyLmdldChyZXNvdXJjZS5zY2hlbWUpO1xuXG5cdFx0cmV0dXJuICEhKHByb3ZpZGVyICYmIChwcm92aWRlci5jYXBhYmlsaXRpZXMgJiBjYXBhYmlsaXR5KSk7XG5cdH1cblxuXHRsaXN0Q2FwYWJpbGl0aWVzKCk6IEl0ZXJhYmxlPHsgc2NoZW1lOiBzdHJpbmc7IGNhcGFiaWxpdGllczogRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzIH0+IHtcblx0XHRyZXR1cm4gSXRlcmFibGUubWFwKHRoaXMucHJvdmlkZXIsIChbc2NoZW1lLCBwcm92aWRlcl0pID0+ICh7IHNjaGVtZSwgY2FwYWJpbGl0aWVzOiBwcm92aWRlci5jYXBhYmlsaXRpZXMgfSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIHdpdGhQcm92aWRlcihyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxJRmlsZVN5c3RlbVByb3ZpZGVyPiB7XG5cblx0XHQvLyBBc3NlcnQgcGF0aCBpcyBhYnNvbHV0ZVxuXHRcdGlmICghaXNBYnNvbHV0ZVBhdGgocmVzb3VyY2UpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRmlsZU9wZXJhdGlvbkVycm9yKGxvY2FsaXplKCdpbnZhbGlkUGF0aCcsIFwiVW5hYmxlIHRvIHJlc29sdmUgZmlsZXN5c3RlbSBwcm92aWRlciB3aXRoIHJlbGF0aXZlIGZpbGUgcGF0aCAnezB9J1wiLCB0aGlzLnJlc291cmNlRm9yRXJyb3IocmVzb3VyY2UpKSwgRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX0lOVkFMSURfUEFUSCk7XG5cdFx0fVxuXG5cdFx0Ly8gQWN0aXZhdGUgcHJvdmlkZXJcblx0XHRhd2FpdCB0aGlzLmFjdGl2YXRlUHJvdmlkZXIocmVzb3VyY2Uuc2NoZW1lKTtcblxuXHRcdC8vIEFzc2VydCBwcm92aWRlclxuXHRcdGNvbnN0IHByb3ZpZGVyID0gdGhpcy5wcm92aWRlci5nZXQocmVzb3VyY2Uuc2NoZW1lKTtcblx0XHRpZiAoIXByb3ZpZGVyKSB7XG5cdFx0XHRjb25zdCBlcnJvciA9IG5ldyBFcnJvck5vVGVsZW1ldHJ5KCk7XG5cdFx0XHRlcnJvci5tZXNzYWdlID0gbG9jYWxpemUoJ25vUHJvdmlkZXJGb3VuZCcsIFwiRU5PUFJPOiBObyBmaWxlIHN5c3RlbSBwcm92aWRlciBmb3VuZCBmb3IgcmVzb3VyY2UgJ3swfSdcIiwgcmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cblx0XHRcdHRocm93IGVycm9yO1xuXHRcdH1cblxuXHRcdHJldHVybiBwcm92aWRlcjtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgd2l0aFJlYWRQcm92aWRlcihyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVSZWFkV3JpdGVDYXBhYmlsaXR5IHwgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhPcGVuUmVhZFdyaXRlQ2xvc2VDYXBhYmlsaXR5IHwgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlUmVhZFN0cmVhbUNhcGFiaWxpdHk+IHtcblx0XHRjb25zdCBwcm92aWRlciA9IGF3YWl0IHRoaXMud2l0aFByb3ZpZGVyKHJlc291cmNlKTtcblxuXHRcdGlmIChoYXNPcGVuUmVhZFdyaXRlQ2xvc2VDYXBhYmlsaXR5KHByb3ZpZGVyKSB8fCBoYXNSZWFkV3JpdGVDYXBhYmlsaXR5KHByb3ZpZGVyKSB8fCBoYXNGaWxlUmVhZFN0cmVhbUNhcGFiaWxpdHkocHJvdmlkZXIpKSB7XG5cdFx0XHRyZXR1cm4gcHJvdmlkZXI7XG5cdFx0fVxuXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBGaWxlc3lzdGVtIHByb3ZpZGVyIGZvciBzY2hlbWUgJyR7cmVzb3VyY2Uuc2NoZW1lfScgbmVpdGhlciBoYXMgRmlsZVJlYWRXcml0ZSwgRmlsZVJlYWRTdHJlYW0gbm9yIEZpbGVPcGVuUmVhZFdyaXRlQ2xvc2UgY2FwYWJpbGl0eSB3aGljaCBpcyBuZWVkZWQgZm9yIHRoZSByZWFkIG9wZXJhdGlvbi5gKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgd2l0aFdyaXRlUHJvdmlkZXIocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8SUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlUmVhZFdyaXRlQ2FwYWJpbGl0eSB8IElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoT3BlblJlYWRXcml0ZUNsb3NlQ2FwYWJpbGl0eT4ge1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gYXdhaXQgdGhpcy53aXRoUHJvdmlkZXIocmVzb3VyY2UpO1xuXG5cdFx0aWYgKGhhc09wZW5SZWFkV3JpdGVDbG9zZUNhcGFiaWxpdHkocHJvdmlkZXIpIHx8IGhhc1JlYWRXcml0ZUNhcGFiaWxpdHkocHJvdmlkZXIpKSB7XG5cdFx0XHRyZXR1cm4gcHJvdmlkZXI7XG5cdFx0fVxuXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBGaWxlc3lzdGVtIHByb3ZpZGVyIGZvciBzY2hlbWUgJyR7cmVzb3VyY2Uuc2NoZW1lfScgbmVpdGhlciBoYXMgRmlsZVJlYWRXcml0ZSBub3IgRmlsZU9wZW5SZWFkV3JpdGVDbG9zZSBjYXBhYmlsaXR5IHdoaWNoIGlzIG5lZWRlZCBmb3IgdGhlIHdyaXRlIG9wZXJhdGlvbi5gKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBPcGVyYXRpb24gZXZlbnRzXG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSdW5PcGVyYXRpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxGaWxlT3BlcmF0aW9uRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJ1bk9wZXJhdGlvbiA9IHRoaXMuX29uRGlkUnVuT3BlcmF0aW9uLmV2ZW50O1xuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBGaWxlIE1ldGFkYXRhIFJlc29sdmluZ1xuXG5cdGFzeW5jIHJlc29sdmUocmVzb3VyY2U6IFVSSSwgb3B0aW9uczogSVJlc29sdmVNZXRhZGF0YUZpbGVPcHRpb25zKTogUHJvbWlzZTxJRmlsZVN0YXRXaXRoTWV0YWRhdGE+O1xuXHRhc3luYyByZXNvbHZlKHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBJUmVzb2x2ZUZpbGVPcHRpb25zKTogUHJvbWlzZTxJRmlsZVN0YXQ+O1xuXHRhc3luYyByZXNvbHZlKHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBJUmVzb2x2ZUZpbGVPcHRpb25zKTogUHJvbWlzZTxJRmlsZVN0YXQ+IHtcblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIGF3YWl0IHRoaXMuZG9SZXNvbHZlRmlsZShyZXNvdXJjZSwgb3B0aW9ucyk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblxuXHRcdFx0Ly8gU3BlY2lhbGx5IGhhbmRsZSBmaWxlIG5vdCBmb3VuZCBjYXNlIGFzIGZpbGUgb3BlcmF0aW9uIHJlc3VsdFxuXHRcdFx0aWYgKHRvRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlKGVycm9yKSA9PT0gRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLkZpbGVOb3RGb3VuZCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRmlsZU9wZXJhdGlvbkVycm9yKGxvY2FsaXplKCdmaWxlTm90Rm91bmRFcnJvcicsIFwiVW5hYmxlIHRvIHJlc29sdmUgbm9uZXhpc3RlbnQgZmlsZSAnezB9J1wiLCB0aGlzLnJlc291cmNlRm9yRXJyb3IocmVzb3VyY2UpKSwgRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9GT1VORCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEJ1YmJsZSB1cCBhbnkgb3RoZXIgZXJyb3IgYXMgaXNcblx0XHRcdHRocm93IGVuc3VyZUZpbGVTeXN0ZW1Qcm92aWRlckVycm9yKGVycm9yKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvUmVzb2x2ZUZpbGUocmVzb3VyY2U6IFVSSSwgb3B0aW9uczogSVJlc29sdmVNZXRhZGF0YUZpbGVPcHRpb25zKTogUHJvbWlzZTxJRmlsZVN0YXRXaXRoTWV0YWRhdGE+O1xuXHRwcml2YXRlIGFzeW5jIGRvUmVzb2x2ZUZpbGUocmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IElSZXNvbHZlRmlsZU9wdGlvbnMpOiBQcm9taXNlPElGaWxlU3RhdD47XG5cdHByaXZhdGUgYXN5bmMgZG9SZXNvbHZlRmlsZShyZXNvdXJjZTogVVJJLCBvcHRpb25zPzogSVJlc29sdmVGaWxlT3B0aW9ucyk6IFByb21pc2U8SUZpbGVTdGF0PiB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBhd2FpdCB0aGlzLndpdGhQcm92aWRlcihyZXNvdXJjZSk7XG5cdFx0Y29uc3QgaXNQYXRoQ2FzZVNlbnNpdGl2ZSA9IHRoaXMuaXNQYXRoQ2FzZVNlbnNpdGl2ZShwcm92aWRlcik7XG5cblx0XHRjb25zdCByZXNvbHZlVG8gPSBvcHRpb25zPy5yZXNvbHZlVG87XG5cdFx0Y29uc3QgcmVzb2x2ZVNpbmdsZUNoaWxkRGVzY2VuZGFudHMgPSBvcHRpb25zPy5yZXNvbHZlU2luZ2xlQ2hpbGREZXNjZW5kYW50cztcblx0XHRjb25zdCByZXNvbHZlTWV0YWRhdGEgPSBvcHRpb25zPy5yZXNvbHZlTWV0YWRhdGE7XG5cblx0XHRjb25zdCBzdGF0ID0gYXdhaXQgcHJvdmlkZXIuc3RhdChyZXNvdXJjZSk7XG5cblx0XHRsZXQgdHJpZTogVGVybmFyeVNlYXJjaFRyZWU8VVJJLCBib29sZWFuPiB8IHVuZGVmaW5lZDtcblxuXHRcdHJldHVybiB0aGlzLnRvRmlsZVN0YXQocHJvdmlkZXIsIHJlc291cmNlLCBzdGF0LCB1bmRlZmluZWQsICEhcmVzb2x2ZU1ldGFkYXRhLCAoc3RhdCwgc2libGluZ3MpID0+IHtcblxuXHRcdFx0Ly8gbGF6eSB0cmllIHRvIGNoZWNrIGZvciByZWN1cnNpdmUgcmVzb2x2aW5nXG5cdFx0XHRpZiAoIXRyaWUpIHtcblx0XHRcdFx0dHJpZSA9IFRlcm5hcnlTZWFyY2hUcmVlLmZvclVyaXM8dHJ1ZT4oKCkgPT4gIWlzUGF0aENhc2VTZW5zaXRpdmUpO1xuXHRcdFx0XHR0cmllLnNldChyZXNvdXJjZSwgdHJ1ZSk7XG5cdFx0XHRcdGlmIChyZXNvbHZlVG8pIHtcblx0XHRcdFx0XHR0cmllLmZpbGwodHJ1ZSwgcmVzb2x2ZVRvKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBjaGVjayBmb3IgcmVjdXJzaXZlIHJlc29sdmluZ1xuXHRcdFx0aWYgKHRyaWUuZ2V0KHN0YXQucmVzb3VyY2UpIHx8IHRyaWUuZmluZFN1cGVyc3RyKHN0YXQucmVzb3VyY2Uud2l0aCh7IHF1ZXJ5OiBudWxsLCBmcmFnbWVudDogbnVsbCB9IC8qIHJlcXVpcmVkIGZvciBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTI4MTUxICovKSkpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIGNoZWNrIGZvciByZXNvbHZpbmcgc2luZ2xlIGNoaWxkIGZvbGRlcnNcblx0XHRcdGlmIChzdGF0LmlzRGlyZWN0b3J5ICYmIHJlc29sdmVTaW5nbGVDaGlsZERlc2NlbmRhbnRzKSB7XG5cdFx0XHRcdHJldHVybiBzaWJsaW5ncyA9PT0gMTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB0b0ZpbGVTdGF0KHByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyLCByZXNvdXJjZTogVVJJLCBzdGF0OiBJU3RhdCB8IHsgdHlwZTogRmlsZVR5cGUgfSAmIFBhcnRpYWw8SVN0YXQ+LCBzaWJsaW5nczogbnVtYmVyIHwgdW5kZWZpbmVkLCByZXNvbHZlTWV0YWRhdGE6IGJvb2xlYW4sIHJlY3Vyc2U6IChzdGF0OiBJRmlsZVN0YXQsIHNpYmxpbmdzPzogbnVtYmVyKSA9PiBib29sZWFuKTogUHJvbWlzZTxJRmlsZVN0YXQ+O1xuXHRwcml2YXRlIGFzeW5jIHRvRmlsZVN0YXQocHJvdmlkZXI6IElGaWxlU3lzdGVtUHJvdmlkZXIsIHJlc291cmNlOiBVUkksIHN0YXQ6IElTdGF0LCBzaWJsaW5nczogbnVtYmVyIHwgdW5kZWZpbmVkLCByZXNvbHZlTWV0YWRhdGE6IHRydWUsIHJlY3Vyc2U6IChzdGF0OiBJRmlsZVN0YXQsIHNpYmxpbmdzPzogbnVtYmVyKSA9PiBib29sZWFuKTogUHJvbWlzZTxJRmlsZVN0YXRXaXRoTWV0YWRhdGE+O1xuXHRwcml2YXRlIGFzeW5jIHRvRmlsZVN0YXQocHJvdmlkZXI6IElGaWxlU3lzdGVtUHJvdmlkZXIsIHJlc291cmNlOiBVUkksIHN0YXQ6IElTdGF0IHwgeyB0eXBlOiBGaWxlVHlwZSB9ICYgUGFydGlhbDxJU3RhdD4sIHNpYmxpbmdzOiBudW1iZXIgfCB1bmRlZmluZWQsIHJlc29sdmVNZXRhZGF0YTogYm9vbGVhbiwgcmVjdXJzZTogKHN0YXQ6IElGaWxlU3RhdCwgc2libGluZ3M/OiBudW1iZXIpID0+IGJvb2xlYW4pOiBQcm9taXNlPElGaWxlU3RhdD4ge1xuXHRcdGNvbnN0IHsgcHJvdmlkZXJFeHRVcmkgfSA9IHRoaXMuZ2V0RXh0VXJpKHByb3ZpZGVyKTtcblxuXHRcdC8vIGNvbnZlcnQgdG8gZmlsZSBzdGF0XG5cdFx0Y29uc3QgZmlsZVN0YXQ6IElGaWxlU3RhdCA9IHtcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0bmFtZTogcHJvdmlkZXJFeHRVcmkuYmFzZW5hbWUocmVzb3VyY2UpLFxuXHRcdFx0aXNGaWxlOiAoc3RhdC50eXBlICYgRmlsZVR5cGUuRmlsZSkgIT09IDAsXG5cdFx0XHRpc0RpcmVjdG9yeTogKHN0YXQudHlwZSAmIEZpbGVUeXBlLkRpcmVjdG9yeSkgIT09IDAsXG5cdFx0XHRpc1N5bWJvbGljTGluazogKHN0YXQudHlwZSAmIEZpbGVUeXBlLlN5bWJvbGljTGluaykgIT09IDAsXG5cdFx0XHRtdGltZTogc3RhdC5tdGltZSxcblx0XHRcdGN0aW1lOiBzdGF0LmN0aW1lLFxuXHRcdFx0c2l6ZTogc3RhdC5zaXplLFxuXHRcdFx0cmVhZG9ubHk6IEJvb2xlYW4oKHN0YXQucGVybWlzc2lvbnMgPz8gMCkgJiBGaWxlUGVybWlzc2lvbi5SZWFkb25seSkgfHwgQm9vbGVhbihwcm92aWRlci5jYXBhYmlsaXRpZXMgJiBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuUmVhZG9ubHkpLFxuXHRcdFx0bG9ja2VkOiBCb29sZWFuKChzdGF0LnBlcm1pc3Npb25zID8/IDApICYgRmlsZVBlcm1pc3Npb24uTG9ja2VkKSxcblx0XHRcdGV0YWc6IGV0YWcoeyBtdGltZTogc3RhdC5tdGltZSwgc2l6ZTogc3RhdC5zaXplIH0pLFxuXHRcdFx0Y2hpbGRyZW46IHVuZGVmaW5lZFxuXHRcdH07XG5cblx0XHQvLyBjaGVjayB0byByZWN1cnNlIGZvciBkaXJlY3Rvcmllc1xuXHRcdGlmIChmaWxlU3RhdC5pc0RpcmVjdG9yeSAmJiByZWN1cnNlKGZpbGVTdGF0LCBzaWJsaW5ncykpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGVudHJpZXMgPSBhd2FpdCBwcm92aWRlci5yZWFkZGlyKHJlc291cmNlKTtcblx0XHRcdFx0Y29uc3QgcmVzb2x2ZWRFbnRyaWVzID0gYXdhaXQgUHJvbWlzZXMuc2V0dGxlZChlbnRyaWVzLm1hcChhc3luYyAoW25hbWUsIHR5cGVdKSA9PiB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGNvbnN0IGNoaWxkUmVzb3VyY2UgPSBwcm92aWRlckV4dFVyaS5qb2luUGF0aChyZXNvdXJjZSwgbmFtZSk7XG5cdFx0XHRcdFx0XHRjb25zdCBjaGlsZFN0YXQgPSByZXNvbHZlTWV0YWRhdGEgPyBhd2FpdCBwcm92aWRlci5zdGF0KGNoaWxkUmVzb3VyY2UpIDogeyB0eXBlIH07XG5cblx0XHRcdFx0XHRcdHJldHVybiBhd2FpdCB0aGlzLnRvRmlsZVN0YXQocHJvdmlkZXIsIGNoaWxkUmVzb3VyY2UsIGNoaWxkU3RhdCwgZW50cmllcy5sZW5ndGgsIHJlc29sdmVNZXRhZGF0YSwgcmVjdXJzZSk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShlcnJvcik7XG5cblx0XHRcdFx0XHRcdHJldHVybiBudWxsOyAvLyBjYW4gaGFwcGVuIGUuZy4gZHVlIHRvIHBlcm1pc3Npb24gZXJyb3JzXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cblx0XHRcdFx0Ly8gbWFrZSBzdXJlIHRvIGdldCByaWQgb2YgbnVsbCB2YWx1ZXMgdGhhdCBzaWduYWwgYSBmYWlsdXJlIHRvIHJlc29sdmUgYSBwYXJ0aWN1bGFyIGVudHJ5XG5cdFx0XHRcdGZpbGVTdGF0LmNoaWxkcmVuID0gY29hbGVzY2UocmVzb2x2ZWRFbnRyaWVzKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShlcnJvcik7XG5cblx0XHRcdFx0ZmlsZVN0YXQuY2hpbGRyZW4gPSBbXTsgLy8gZ3JhY2VmdWxseSBoYW5kbGUgZXJyb3JzLCB3ZSBtYXkgbm90IGhhdmUgcGVybWlzc2lvbnMgdG8gcmVhZFxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gZmlsZVN0YXQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZpbGVTdGF0O1xuXHR9XG5cblx0YXN5bmMgcmVzb2x2ZUFsbCh0b1Jlc29sdmU6IHsgcmVzb3VyY2U6IFVSSTsgb3B0aW9ucz86IElSZXNvbHZlRmlsZU9wdGlvbnMgfVtdKTogUHJvbWlzZTxJRmlsZVN0YXRSZXN1bHRbXT47XG5cdGFzeW5jIHJlc29sdmVBbGwodG9SZXNvbHZlOiB7IHJlc291cmNlOiBVUkk7IG9wdGlvbnM6IElSZXNvbHZlTWV0YWRhdGFGaWxlT3B0aW9ucyB9W10pOiBQcm9taXNlPElGaWxlU3RhdFJlc3VsdFdpdGhNZXRhZGF0YVtdPjtcblx0YXN5bmMgcmVzb2x2ZUFsbCh0b1Jlc29sdmU6IHsgcmVzb3VyY2U6IFVSSTsgb3B0aW9ucz86IElSZXNvbHZlRmlsZU9wdGlvbnMgfVtdKTogUHJvbWlzZTxJRmlsZVN0YXRSZXN1bHRbXT4ge1xuXHRcdHJldHVybiBQcm9taXNlcy5zZXR0bGVkKHRvUmVzb2x2ZS5tYXAoYXN5bmMgZW50cnkgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmV0dXJuIHsgc3RhdDogYXdhaXQgdGhpcy5kb1Jlc29sdmVGaWxlKGVudHJ5LnJlc291cmNlLCBlbnRyeS5vcHRpb25zKSwgc3VjY2VzczogdHJ1ZSB9O1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGVycm9yKTtcblxuXHRcdFx0XHRyZXR1cm4geyBzdGF0OiB1bmRlZmluZWQsIHN1Y2Nlc3M6IGZhbHNlIH07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0YXN5bmMgc3RhdChyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxJRmlsZVN0YXRXaXRoUGFydGlhbE1ldGFkYXRhPiB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBhd2FpdCB0aGlzLndpdGhQcm92aWRlcihyZXNvdXJjZSk7XG5cblx0XHRjb25zdCBzdGF0ID0gYXdhaXQgcHJvdmlkZXIuc3RhdChyZXNvdXJjZSk7XG5cblx0XHRyZXR1cm4gdGhpcy50b0ZpbGVTdGF0KHByb3ZpZGVyLCByZXNvdXJjZSwgc3RhdCwgdW5kZWZpbmVkLCB0cnVlLCAoKSA9PiBmYWxzZSAvKiBEbyBub3QgcmVzb2x2ZSBhbnkgY2hpbGRyZW4gKi8pO1xuXHR9XG5cblx0YXN5bmMgZXhpc3RzKHJlc291cmNlOiBVUkkpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCBwcm92aWRlciA9IGF3YWl0IHRoaXMud2l0aFByb3ZpZGVyKHJlc291cmNlKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBzdGF0ID0gYXdhaXQgcHJvdmlkZXIuc3RhdChyZXNvdXJjZSk7XG5cblx0XHRcdHJldHVybiAhIXN0YXQ7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gRmlsZSBSZWFkaW5nL1dyaXRpbmdcblxuXHRhc3luYyBjYW5DcmVhdGVGaWxlKHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBJQ3JlYXRlRmlsZU9wdGlvbnMpOiBQcm9taXNlPEVycm9yIHwgdHJ1ZT4ge1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmRvVmFsaWRhdGVDcmVhdGVGaWxlKHJlc291cmNlLCBvcHRpb25zKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0cmV0dXJuIGVycm9yO1xuXHRcdH1cblxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1ZhbGlkYXRlQ3JlYXRlRmlsZShyZXNvdXJjZTogVVJJLCBvcHRpb25zPzogSUNyZWF0ZUZpbGVPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyB2YWxpZGF0ZSBvdmVyd3JpdGVcblx0XHRpZiAoIW9wdGlvbnM/Lm92ZXJ3cml0ZSAmJiBhd2FpdCB0aGlzLmV4aXN0cyhyZXNvdXJjZSkpIHtcblx0XHRcdHRocm93IG5ldyBGaWxlT3BlcmF0aW9uRXJyb3IobG9jYWxpemUoJ2ZpbGVFeGlzdHMnLCBcIlVuYWJsZSB0byBjcmVhdGUgZmlsZSAnezB9JyB0aGF0IGFscmVhZHkgZXhpc3RzIHdoZW4gb3ZlcndyaXRlIGZsYWcgaXMgbm90IHNldFwiLCB0aGlzLnJlc291cmNlRm9yRXJyb3IocmVzb3VyY2UpKSwgRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX01PRElGSUVEX1NJTkNFLCBvcHRpb25zKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBjcmVhdGVGaWxlKHJlc291cmNlOiBVUkksIGJ1ZmZlck9yUmVhZGFibGVPclN0cmVhbTogVlNCdWZmZXIgfCBWU0J1ZmZlclJlYWRhYmxlIHwgVlNCdWZmZXJSZWFkYWJsZVN0cmVhbSA9IFZTQnVmZmVyLmZyb21TdHJpbmcoJycpLCBvcHRpb25zPzogSUNyZWF0ZUZpbGVPcHRpb25zKTogUHJvbWlzZTxJRmlsZVN0YXRXaXRoTWV0YWRhdGE+IHtcblxuXHRcdC8vIHZhbGlkYXRlXG5cdFx0YXdhaXQgdGhpcy5kb1ZhbGlkYXRlQ3JlYXRlRmlsZShyZXNvdXJjZSwgb3B0aW9ucyk7XG5cblx0XHQvLyBkbyB3cml0ZSBpbnRvIGZpbGUgKHRoaXMgd2lsbCBjcmVhdGUgaXQgdG9vKVxuXHRcdGNvbnN0IGZpbGVTdGF0ID0gYXdhaXQgdGhpcy53cml0ZUZpbGUocmVzb3VyY2UsIGJ1ZmZlck9yUmVhZGFibGVPclN0cmVhbSk7XG5cblx0XHQvLyBldmVudHNcblx0XHR0aGlzLl9vbkRpZFJ1bk9wZXJhdGlvbi5maXJlKG5ldyBGaWxlT3BlcmF0aW9uRXZlbnQocmVzb3VyY2UsIEZpbGVPcGVyYXRpb24uQ1JFQVRFLCBmaWxlU3RhdCkpO1xuXG5cdFx0cmV0dXJuIGZpbGVTdGF0O1xuXHR9XG5cblx0YXN5bmMgd3JpdGVGaWxlKHJlc291cmNlOiBVUkksIGJ1ZmZlck9yUmVhZGFibGVPclN0cmVhbTogVlNCdWZmZXIgfCBWU0J1ZmZlclJlYWRhYmxlIHwgVlNCdWZmZXJSZWFkYWJsZVN0cmVhbSwgb3B0aW9ucz86IElXcml0ZUZpbGVPcHRpb25zKTogUHJvbWlzZTxJRmlsZVN0YXRXaXRoTWV0YWRhdGE+IHtcblx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMudGhyb3dJZkZpbGVTeXN0ZW1Jc1JlYWRvbmx5KGF3YWl0IHRoaXMud2l0aFdyaXRlUHJvdmlkZXIocmVzb3VyY2UpLCByZXNvdXJjZSk7XG5cdFx0Y29uc3QgeyBwcm92aWRlckV4dFVyaSB9ID0gdGhpcy5nZXRFeHRVcmkocHJvdmlkZXIpO1xuXG5cdFx0bGV0IHdyaXRlRmlsZU9wdGlvbnMgPSBvcHRpb25zO1xuXHRcdGlmIChoYXNGaWxlQXRvbWljV3JpdGVDYXBhYmlsaXR5KHByb3ZpZGVyKSAmJiAhd3JpdGVGaWxlT3B0aW9ucz8uYXRvbWljKSB7XG5cdFx0XHRjb25zdCBlbmZvcmNlZEF0b21pY1dyaXRlID0gcHJvdmlkZXIuZW5mb3JjZUF0b21pY1dyaXRlRmlsZT8uKHJlc291cmNlKTtcblx0XHRcdGlmIChlbmZvcmNlZEF0b21pY1dyaXRlKSB7XG5cdFx0XHRcdHdyaXRlRmlsZU9wdGlvbnMgPSB7IC4uLm9wdGlvbnMsIGF0b21pYzogZW5mb3JjZWRBdG9taWNXcml0ZSB9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRyeSB7XG5cblx0XHRcdC8vIHZhbGlkYXRlIHdyaXRlICh0aGlzIG1heSBhbHJlYWR5IHJldHVybiBhIHBlZWtlZC1hdCBidWZmZXIpXG5cdFx0XHRsZXQgeyBzdGF0LCBidWZmZXI6IGJ1ZmZlck9yUmVhZGFibGVPclN0cmVhbU9yQnVmZmVyZWRTdHJlYW0gfSA9IGF3YWl0IHRoaXMudmFsaWRhdGVXcml0ZUZpbGUocHJvdmlkZXIsIHJlc291cmNlLCBidWZmZXJPclJlYWRhYmxlT3JTdHJlYW0sIHdyaXRlRmlsZU9wdGlvbnMpO1xuXG5cdFx0XHQvLyBta2RpciByZWN1cnNpdmVseSBhcyBuZWVkZWRcblx0XHRcdGlmICghc3RhdCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLm1rZGlycChwcm92aWRlciwgcHJvdmlkZXJFeHRVcmkuZGlybmFtZShyZXNvdXJjZSkpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBvcHRpbWl6YXRpb246IGlmIHRoZSBwcm92aWRlciBoYXMgdW5idWZmZXJlZCB3cml0ZSBjYXBhYmlsaXR5IGFuZCB0aGUgZGF0YVxuXHRcdFx0Ly8gdG8gd3JpdGUgaXMgbm90IGEgYnVmZmVyLCB3ZSBjb25zdW1lIHVwIHRvIDMgY2h1bmtzIGFuZCB0cnkgdG8gd3JpdGUgdGhlIGRhdGFcblx0XHRcdC8vIHVuYnVmZmVyZWQgdG8gcmVkdWNlIHRoZSBvdmVyaGVhZC4gSWYgdGhlIHN0cmVhbSBvciByZWFkYWJsZSBoYXMgbW9yZSBkYXRhXG5cdFx0XHQvLyB0byBwcm92aWRlIHdlIGNvbnRpbnVlIHRvIHdyaXRlIGJ1ZmZlcmVkLlxuXHRcdFx0aWYgKCFidWZmZXJPclJlYWRhYmxlT3JTdHJlYW1PckJ1ZmZlcmVkU3RyZWFtKSB7XG5cdFx0XHRcdGJ1ZmZlck9yUmVhZGFibGVPclN0cmVhbU9yQnVmZmVyZWRTdHJlYW0gPSBhd2FpdCB0aGlzLnBlZWtCdWZmZXJGb3JXcml0aW5nKHByb3ZpZGVyLCBidWZmZXJPclJlYWRhYmxlT3JTdHJlYW0pO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyB3cml0ZSBmaWxlOiB1bmJ1ZmZlcmVkXG5cdFx0XHRpZiAoXG5cdFx0XHRcdCFoYXNPcGVuUmVhZFdyaXRlQ2xvc2VDYXBhYmlsaXR5KHByb3ZpZGVyKSB8fFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gYnVmZmVyZWQgd3JpdGluZyBpcyB1bnN1cHBvcnRlZFxuXHRcdFx0XHQoaGFzUmVhZFdyaXRlQ2FwYWJpbGl0eShwcm92aWRlcikgJiYgYnVmZmVyT3JSZWFkYWJsZU9yU3RyZWFtT3JCdWZmZXJlZFN0cmVhbSBpbnN0YW5jZW9mIFZTQnVmZmVyKSB8fFx0XHQvLyBkYXRhIGlzIGEgZnVsbCBidWZmZXIgYWxyZWFkeVxuXHRcdFx0XHQoaGFzUmVhZFdyaXRlQ2FwYWJpbGl0eShwcm92aWRlcikgJiYgaGFzRmlsZUF0b21pY1dyaXRlQ2FwYWJpbGl0eShwcm92aWRlcikgJiYgd3JpdGVGaWxlT3B0aW9ucz8uYXRvbWljKVx0Ly8gYXRvbWljIHdyaXRlIGZvcmNlcyB1bmJ1ZmZlcmVkIHdyaXRlIGlmIHRoZSBwcm92aWRlciBzdXBwb3J0cyBpdFxuXHRcdFx0KSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuZG9Xcml0ZVVuYnVmZmVyZWQocHJvdmlkZXIsIHJlc291cmNlLCB3cml0ZUZpbGVPcHRpb25zLCBidWZmZXJPclJlYWRhYmxlT3JTdHJlYW1PckJ1ZmZlcmVkU3RyZWFtKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gd3JpdGUgZmlsZTogYnVmZmVyZWRcblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmRvV3JpdGVCdWZmZXJlZChwcm92aWRlciwgcmVzb3VyY2UsIHdyaXRlRmlsZU9wdGlvbnMsIGJ1ZmZlck9yUmVhZGFibGVPclN0cmVhbU9yQnVmZmVyZWRTdHJlYW0gaW5zdGFuY2VvZiBWU0J1ZmZlciA/IGJ1ZmZlclRvUmVhZGFibGUoYnVmZmVyT3JSZWFkYWJsZU9yU3RyZWFtT3JCdWZmZXJlZFN0cmVhbSkgOiBidWZmZXJPclJlYWRhYmxlT3JTdHJlYW1PckJ1ZmZlcmVkU3RyZWFtKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gZXZlbnRzXG5cdFx0XHR0aGlzLl9vbkRpZFJ1bk9wZXJhdGlvbi5maXJlKG5ldyBGaWxlT3BlcmF0aW9uRXZlbnQocmVzb3VyY2UsIEZpbGVPcGVyYXRpb24uV1JJVEUpKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhyb3cgbmV3IEZpbGVPcGVyYXRpb25FcnJvcihsb2NhbGl6ZSgnZXJyLndyaXRlJywgXCJVbmFibGUgdG8gd3JpdGUgZmlsZSAnezB9JyAoezF9KVwiLCB0aGlzLnJlc291cmNlRm9yRXJyb3IocmVzb3VyY2UpLCBlbnN1cmVGaWxlU3lzdGVtUHJvdmlkZXJFcnJvcihlcnJvcikudG9TdHJpbmcoKSksIHRvRmlsZU9wZXJhdGlvblJlc3VsdChlcnJvciksIHdyaXRlRmlsZU9wdGlvbnMpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnJlc29sdmUocmVzb3VyY2UsIHsgcmVzb2x2ZU1ldGFkYXRhOiB0cnVlIH0pO1xuXHR9XG5cblxuXHRwcml2YXRlIGFzeW5jIHBlZWtCdWZmZXJGb3JXcml0aW5nKHByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVSZWFkV3JpdGVDYXBhYmlsaXR5IHwgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhPcGVuUmVhZFdyaXRlQ2xvc2VDYXBhYmlsaXR5LCBidWZmZXJPclJlYWRhYmxlT3JTdHJlYW06IFZTQnVmZmVyIHwgVlNCdWZmZXJSZWFkYWJsZSB8IFZTQnVmZmVyUmVhZGFibGVTdHJlYW0pOiBQcm9taXNlPFZTQnVmZmVyIHwgVlNCdWZmZXJSZWFkYWJsZSB8IFZTQnVmZmVyUmVhZGFibGVTdHJlYW0gfCBWU0J1ZmZlclJlYWRhYmxlQnVmZmVyZWRTdHJlYW0+IHtcblx0XHRsZXQgcGVla1Jlc3VsdDogVlNCdWZmZXIgfCBWU0J1ZmZlclJlYWRhYmxlIHwgVlNCdWZmZXJSZWFkYWJsZVN0cmVhbSB8IFZTQnVmZmVyUmVhZGFibGVCdWZmZXJlZFN0cmVhbTtcblx0XHRpZiAoaGFzUmVhZFdyaXRlQ2FwYWJpbGl0eShwcm92aWRlcikgJiYgIShidWZmZXJPclJlYWRhYmxlT3JTdHJlYW0gaW5zdGFuY2VvZiBWU0J1ZmZlcikpIHtcblx0XHRcdGlmIChpc1JlYWRhYmxlU3RyZWFtKGJ1ZmZlck9yUmVhZGFibGVPclN0cmVhbSkpIHtcblx0XHRcdFx0Y29uc3QgYnVmZmVyZWRTdHJlYW0gPSBhd2FpdCBwZWVrU3RyZWFtKGJ1ZmZlck9yUmVhZGFibGVPclN0cmVhbSwgMyk7XG5cdFx0XHRcdGlmIChidWZmZXJlZFN0cmVhbS5lbmRlZCkge1xuXHRcdFx0XHRcdHBlZWtSZXN1bHQgPSBWU0J1ZmZlci5jb25jYXQoYnVmZmVyZWRTdHJlYW0uYnVmZmVyKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRwZWVrUmVzdWx0ID0gYnVmZmVyZWRTdHJlYW07XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHBlZWtSZXN1bHQgPSBwZWVrUmVhZGFibGUoYnVmZmVyT3JSZWFkYWJsZU9yU3RyZWFtLCBkYXRhID0+IFZTQnVmZmVyLmNvbmNhdChkYXRhKSwgMyk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHBlZWtSZXN1bHQgPSBidWZmZXJPclJlYWRhYmxlT3JTdHJlYW07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHBlZWtSZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHZhbGlkYXRlV3JpdGVGaWxlKHByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVSZWFkV3JpdGVDYXBhYmlsaXR5IHwgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhPcGVuUmVhZFdyaXRlQ2xvc2VDYXBhYmlsaXR5LCByZXNvdXJjZTogVVJJLCBidWZmZXJPclJlYWRhYmxlT3JTdHJlYW06IFZTQnVmZmVyIHwgVlNCdWZmZXJSZWFkYWJsZSB8IFZTQnVmZmVyUmVhZGFibGVTdHJlYW0sIG9wdGlvbnM/OiBJV3JpdGVGaWxlT3B0aW9ucyk6IFByb21pc2U8eyBzdGF0OiBJU3RhdCB8IHVuZGVmaW5lZDsgYnVmZmVyOiBWU0J1ZmZlciB8IFZTQnVmZmVyUmVhZGFibGUgfCBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtIHwgVlNCdWZmZXJSZWFkYWJsZUJ1ZmZlcmVkU3RyZWFtIHwgdW5kZWZpbmVkIH0+IHtcblxuXHRcdC8vIFZhbGlkYXRlIHVubG9jayBzdXBwb3J0XG5cdFx0Y29uc3QgdW5sb2NrID0gISFvcHRpb25zPy51bmxvY2s7XG5cdFx0aWYgKHVubG9jayAmJiAhKHByb3ZpZGVyLmNhcGFiaWxpdGllcyAmIEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5GaWxlV3JpdGVVbmxvY2spKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ3dyaXRlRmFpbGVkVW5sb2NrVW5zdXBwb3J0ZWQnLCBcIlVuYWJsZSB0byB1bmxvY2sgZmlsZSAnezB9JyBiZWNhdXNlIHByb3ZpZGVyIGRvZXMgbm90IHN1cHBvcnQgaXQuXCIsIHRoaXMucmVzb3VyY2VGb3JFcnJvcihyZXNvdXJjZSkpKTtcblx0XHR9XG5cblx0XHQvLyBWYWxpZGF0ZSBhdG9taWMgc3VwcG9ydFxuXHRcdGNvbnN0IGF0b21pYyA9ICEhb3B0aW9ucz8uYXRvbWljO1xuXHRcdGlmIChhdG9taWMpIHtcblx0XHRcdGlmICghKHByb3ZpZGVyLmNhcGFiaWxpdGllcyAmIEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5GaWxlQXRvbWljV3JpdGUpKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnd3JpdGVGYWlsZWRBdG9taWNVbnN1cHBvcnRlZDEnLCBcIlVuYWJsZSB0byBhdG9taWNhbGx5IHdyaXRlIGZpbGUgJ3swfScgYmVjYXVzZSBwcm92aWRlciBkb2VzIG5vdCBzdXBwb3J0IGl0LlwiLCB0aGlzLnJlc291cmNlRm9yRXJyb3IocmVzb3VyY2UpKSk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghKHByb3ZpZGVyLmNhcGFiaWxpdGllcyAmIEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5GaWxlUmVhZFdyaXRlKSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ3dyaXRlRmFpbGVkQXRvbWljVW5zdXBwb3J0ZWQyJywgXCJVbmFibGUgdG8gYXRvbWljYWxseSB3cml0ZSBmaWxlICd7MH0nIGJlY2F1c2UgcHJvdmlkZXIgZG9lcyBub3Qgc3VwcG9ydCB1bmJ1ZmZlcmVkIHdyaXRlcy5cIiwgdGhpcy5yZXNvdXJjZUZvckVycm9yKHJlc291cmNlKSkpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodW5sb2NrKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnd3JpdGVGYWlsZWRBdG9taWNVbmxvY2snLCBcIlVuYWJsZSB0byB1bmxvY2sgZmlsZSAnezB9JyBiZWNhdXNlIGF0b21pYyB3cml0ZSBpcyBlbmFibGVkLlwiLCB0aGlzLnJlc291cmNlRm9yRXJyb3IocmVzb3VyY2UpKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gVmFsaWRhdGUgdmlhIGZpbGUgc3RhdCBtZXRhIGRhdGFcblx0XHRsZXQgc3RhdDogSVN0YXQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0dHJ5IHtcblx0XHRcdHN0YXQgPSBhd2FpdCBwcm92aWRlci5zdGF0KHJlc291cmNlKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0cmV0dXJuIE9iamVjdC5jcmVhdGUobnVsbCk7IC8vIGZpbGUgbWlnaHQgbm90IGV4aXN0XG5cdFx0fVxuXG5cdFx0Ly8gRmlsZSBjYW5ub3QgYmUgZGlyZWN0b3J5XG5cdFx0aWYgKChzdGF0LnR5cGUgJiBGaWxlVHlwZS5EaXJlY3RvcnkpICE9PSAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRmlsZU9wZXJhdGlvbkVycm9yKGxvY2FsaXplKCdmaWxlSXNEaXJlY3RvcnlXcml0ZUVycm9yJywgXCJVbmFibGUgdG8gd3JpdGUgZmlsZSAnezB9JyB0aGF0IGlzIGFjdHVhbGx5IGEgZGlyZWN0b3J5XCIsIHRoaXMucmVzb3VyY2VGb3JFcnJvcihyZXNvdXJjZSkpLCBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfSVNfRElSRUNUT1JZLCBvcHRpb25zKTtcblx0XHR9XG5cblx0XHQvLyBGaWxlIGNhbm5vdCBiZSByZWFkb25seVxuXHRcdHRoaXMudGhyb3dJZkZpbGVJc1JlYWRvbmx5KHJlc291cmNlLCBzdGF0KTtcblxuXHRcdC8vIERpcnR5IHdyaXRlIHByZXZlbnRpb246IGlmIHRoZSBmaWxlIG9uIGRpc2sgaGFzIGJlZW4gY2hhbmdlZCBhbmQgZG9lcyBub3QgbWF0Y2ggb3VyIGV4cGVjdGVkXG5cdFx0Ly8gbXRpbWUgYW5kIGV0YWcsIHdlIGJhaWwgb3V0IHRvIHByZXZlbnQgZGlydHkgd3JpdGluZy5cblx0XHQvL1xuXHRcdC8vIEZpcnN0LCB3ZSBjaGVjayBmb3IgYSBtdGltZSB0aGF0IGlzIGluIHRoZSBmdXR1cmUgYmVmb3JlIHdlIGRvIG1vcmUgY2hlY2tzLiBUaGUgYXNzdW1wdGlvbiBpc1xuXHRcdC8vIHRoYXQgb25seSB0aGUgbXRpbWUgaXMgYW4gaW5kaWNhdG9yIGZvciBhIGZpbGUgdGhhdCBoYXMgY2hhbmdlZCBvbiBkaXNrLlxuXHRcdC8vXG5cdFx0Ly8gU2Vjb25kLCBpZiB0aGUgbXRpbWUgaGFzIGFkdmFuY2VkLCB3ZSBjb21wYXJlIHRoZSBzaXplIG9mIHRoZSBmaWxlIG9uIGRpc2sgd2l0aCBvdXIgcHJldmlvdXNcblx0XHQvLyBvbmUgdXNpbmcgdGhlIGV0YWcoKSBmdW5jdGlvbi4gUmVseWluZyBvbmx5IG9uIHRoZSBtdGltZSBjaGVjayBoYXMgcHJvb3ZlbiB0byBwcm9kdWNlIGZhbHNlXG5cdFx0Ly8gcG9zaXRpdmVzIGR1ZSB0byBmaWxlIHN5c3RlbSB3ZWlyZG5lc3MgKGVzcGVjaWFsbHkgYXJvdW5kIHJlbW90ZSBmaWxlIHN5c3RlbXMpLiBBcyBzdWNoLCB0aGVcblx0XHQvLyBjaGVjayBmb3Igc2l6ZSBpcyBhIHdlYWtlciBjaGVjayBiZWNhdXNlIGl0IGNhbiByZXR1cm4gYSBmYWxzZSBuZWdhdGl2ZSBpZiB0aGUgZmlsZSBoYXMgY2hhbmdlZFxuXHRcdC8vIGJ1dCB0byB0aGUgc2FtZSBsZW5ndGguIFRoaXMgaXMgYSBjb21wcm9taXNlIHdlIHRha2UgdG8gYXZvaWQgaGF2aW5nIHRvIHByb2R1Y2UgY2hlY2tzdW1zIG9mXG5cdFx0Ly8gdGhlIGZpbGUgY29udGVudCBmb3IgY29tcGFyaXNvbiB3aGljaCB3b3VsZCBiZSBtdWNoIHNsb3dlciB0byBjb21wdXRlLlxuXHRcdC8vXG5cdFx0Ly8gVGhpcmQsIGlmIHRoZSBldGFnKCkgdHVybnMgb3V0IHRvIGJlIGRpZmZlcmVudCwgd2UgZG8gb25lIGF0dGVtcHQgdG8gY29tcGFyZSB0aGUgYnVmZmVyIHdlXG5cdFx0Ly8gYXJlIGFib3V0IHRvIHdyaXRlIHdpdGggdGhlIGNvbnRlbnRzIG9uIGRpc2sgdG8gZmlndXJlIG91dCBpZiB0aGUgY29udGVudHMgYXJlIGlkZW50aWNhbC5cblx0XHQvLyBJbiB0aGF0IGNhc2Ugd2UgYWxsb3cgdGhlIHdyaXRpbmcgYXMgaXQgd291bGQgcmVzdWx0IGluIHRoZSBzYW1lIGNvbnRlbnRzIGluIHRoZSBmaWxlLlxuXHRcdGxldCBidWZmZXI6IFZTQnVmZmVyIHwgVlNCdWZmZXJSZWFkYWJsZSB8IFZTQnVmZmVyUmVhZGFibGVTdHJlYW0gfCBWU0J1ZmZlclJlYWRhYmxlQnVmZmVyZWRTdHJlYW0gfCB1bmRlZmluZWQ7XG5cdFx0aWYgKFxuXHRcdFx0dHlwZW9mIG9wdGlvbnM/Lm10aW1lID09PSAnbnVtYmVyJyAmJiB0eXBlb2Ygb3B0aW9ucy5ldGFnID09PSAnc3RyaW5nJyAmJiBvcHRpb25zLmV0YWcgIT09IEVUQUdfRElTQUJMRUQgJiZcblx0XHRcdHR5cGVvZiBzdGF0Lm10aW1lID09PSAnbnVtYmVyJyAmJiB0eXBlb2Ygc3RhdC5zaXplID09PSAnbnVtYmVyJyAmJlxuXHRcdFx0b3B0aW9ucy5tdGltZSA8IHN0YXQubXRpbWUgJiYgb3B0aW9ucy5ldGFnICE9PSBldGFnKHsgbXRpbWU6IG9wdGlvbnMubXRpbWUgLyogbm90IHVzaW5nIHN0YXQubXRpbWUgZm9yIGEgcmVhc29uLCBzZWUgYWJvdmUgKi8sIHNpemU6IHN0YXQuc2l6ZSB9KVxuXHRcdCkge1xuXHRcdFx0YnVmZmVyID0gYXdhaXQgdGhpcy5wZWVrQnVmZmVyRm9yV3JpdGluZyhwcm92aWRlciwgYnVmZmVyT3JSZWFkYWJsZU9yU3RyZWFtKTtcblx0XHRcdGlmIChidWZmZXIgaW5zdGFuY2VvZiBWU0J1ZmZlciAmJiBidWZmZXIuYnl0ZUxlbmd0aCA9PT0gc3RhdC5zaXplKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3QgeyB2YWx1ZSB9ID0gYXdhaXQgdGhpcy5yZWFkRmlsZShyZXNvdXJjZSwgeyBsaW1pdHM6IHsgc2l6ZTogc3RhdC5zaXplIH0gfSk7XG5cdFx0XHRcdFx0aWYgKGJ1ZmZlci5lcXVhbHModmFsdWUpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4geyBzdGF0LCBidWZmZXIgfTsgLy8gYWxsb3cgd3JpdGluZyBzaW5jZSBjb250ZW50cyBhcmUgaWRlbnRpY2FsXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdC8vIGlnbm9yZSwgdGhyb3cgdGhlIEZJTEVfTU9ESUZJRURfU0lOQ0UgZXJyb3Jcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR0aHJvdyBuZXcgRmlsZU9wZXJhdGlvbkVycm9yKGxvY2FsaXplKCdmaWxlTW9kaWZpZWRFcnJvcicsIFwiRmlsZSBNb2RpZmllZCBTaW5jZVwiKSwgRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX01PRElGSUVEX1NJTkNFLCBvcHRpb25zKTtcblx0XHR9XG5cblx0XHRyZXR1cm4geyBzdGF0LCBidWZmZXIgfTtcblx0fVxuXG5cdGFzeW5jIHJlYWRGaWxlKHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBJUmVhZEZpbGVPcHRpb25zLCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJRmlsZUNvbnRlbnQ+IHtcblx0XHRjb25zdCBwcm92aWRlciA9IGF3YWl0IHRoaXMud2l0aFJlYWRQcm92aWRlcihyZXNvdXJjZSk7XG5cblx0XHRpZiAob3B0aW9ucz8uYXRvbWljKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5kb1JlYWRGaWxlQXRvbWljKHByb3ZpZGVyLCByZXNvdXJjZSwgb3B0aW9ucywgdG9rZW4pO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmRvUmVhZEZpbGUocHJvdmlkZXIsIHJlc291cmNlLCBvcHRpb25zLCB0b2tlbik7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvUmVhZEZpbGVBdG9taWMocHJvdmlkZXI6IElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZVJlYWRXcml0ZUNhcGFiaWxpdHkgfCBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aE9wZW5SZWFkV3JpdGVDbG9zZUNhcGFiaWxpdHkgfCBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVSZWFkU3RyZWFtQ2FwYWJpbGl0eSwgcmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IElSZWFkRmlsZU9wdGlvbnMsIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElGaWxlQ29udGVudD4ge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZTxJRmlsZUNvbnRlbnQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdHRoaXMud3JpdGVRdWV1ZS5xdWV1ZUZvcihyZXNvdXJjZSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmRvUmVhZEZpbGUocHJvdmlkZXIsIHJlc291cmNlLCBvcHRpb25zLCB0b2tlbik7XG5cdFx0XHRcdFx0cmVzb2x2ZShjb250ZW50KTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRyZWplY3QoZXJyb3IpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCB0aGlzLmdldEV4dFVyaShwcm92aWRlcikucHJvdmlkZXJFeHRVcmkpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1JlYWRGaWxlKHByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVSZWFkV3JpdGVDYXBhYmlsaXR5IHwgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhPcGVuUmVhZFdyaXRlQ2xvc2VDYXBhYmlsaXR5IHwgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlUmVhZFN0cmVhbUNhcGFiaWxpdHksIHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBJUmVhZEZpbGVPcHRpb25zLCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJRmlsZUNvbnRlbnQ+IHtcblx0XHRjb25zdCBzdHJlYW0gPSBhd2FpdCB0aGlzLmRvUmVhZEZpbGVTdHJlYW0ocHJvdmlkZXIsIHJlc291cmNlLCB7XG5cdFx0XHQuLi5vcHRpb25zLFxuXHRcdFx0Ly8gb3B0aW1pemF0aW9uOiBzaW5jZSB3ZSBrbm93IHRoYXQgdGhlIGNhbGxlciBkb2VzIG5vdFxuXHRcdFx0Ly8gY2FyZSBhYm91dCBidWZmZXJpbmcsIHdlIGluZGljYXRlIHRoaXMgdG8gdGhlIHJlYWRlci5cblx0XHRcdC8vIHRoaXMgcmVkdWNlcyBhbGwgdGhlIG92ZXJoZWFkIHRoZSBidWZmZXJlZCByZWFkaW5nXG5cdFx0XHQvLyBoYXMgKG9wZW4sIHJlYWQsIGNsb3NlKSBpZiB0aGUgcHJvdmlkZXIgc3VwcG9ydHNcblx0XHRcdC8vIHVuYnVmZmVyZWQgcmVhZGluZy5cblx0XHRcdHByZWZlclVuYnVmZmVyZWQ6IHRydWVcblx0XHR9LCB0b2tlbik7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Li4uc3RyZWFtLFxuXHRcdFx0dmFsdWU6IGF3YWl0IHN0cmVhbVRvQnVmZmVyKHN0cmVhbS52YWx1ZSlcblx0XHR9O1xuXHR9XG5cblx0YXN5bmMgcmVhZEZpbGVTdHJlYW0ocmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IElSZWFkRmlsZVN0cmVhbU9wdGlvbnMsIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElGaWxlU3RyZWFtQ29udGVudD4ge1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gYXdhaXQgdGhpcy53aXRoUmVhZFByb3ZpZGVyKHJlc291cmNlKTtcblxuXHRcdHJldHVybiB0aGlzLmRvUmVhZEZpbGVTdHJlYW0ocHJvdmlkZXIsIHJlc291cmNlLCBvcHRpb25zLCB0b2tlbik7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvUmVhZEZpbGVTdHJlYW0ocHJvdmlkZXI6IElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZVJlYWRXcml0ZUNhcGFiaWxpdHkgfCBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aE9wZW5SZWFkV3JpdGVDbG9zZUNhcGFiaWxpdHkgfCBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVSZWFkU3RyZWFtQ2FwYWJpbGl0eSwgcmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IElSZWFkRmlsZU9wdGlvbnMgJiBJUmVhZEZpbGVTdHJlYW1PcHRpb25zICYgeyBwcmVmZXJVbmJ1ZmZlcmVkPzogYm9vbGVhbiB9LCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJRmlsZVN0cmVhbUNvbnRlbnQ+IHtcblxuXHRcdC8vIGluc3RhbGwgYSBjYW5jZWxsYXRpb24gdG9rZW4gdGhhdCBnZXRzIGNhbmNlbGxlZFxuXHRcdC8vIHdoZW4gYW55IGVycm9yIG9jY3Vycy4gdGhpcyBhbGxvd3MgdXMgdG8gcmVzb2x2ZVxuXHRcdC8vIHRoZSBjb250ZW50IG9mIHRoZSBmaWxlIHdoaWxlIHJlc29sdmluZyBtZXRhZGF0YVxuXHRcdC8vIGJ1dCBzdGlsbCBjYW5jZWwgdGhlIG9wZXJhdGlvbiBpbiBjZXJ0YWluIGNhc2VzLlxuXHRcdC8vXG5cdFx0Ly8gaW4gYWRkaXRpb24sIHdlIHBhc3MgdGhlIG9wdGlvbmFsIHRva2VuIGluIHRoYXRcblx0XHQvLyB3ZSBnb3QgZnJvbSB0aGUgb3V0c2lkZSB0byBldmVuIGFsbG93IGZvciBleHRlcm5hbFxuXHRcdC8vIGNhbmNlbGxhdGlvbiBvZiB0aGUgcmVhZCBvcGVyYXRpb24uXG5cdFx0Y29uc3QgY2FuY2VsbGFibGVTb3VyY2UgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UodG9rZW4pO1xuXG5cdFx0bGV0IHJlYWRGaWxlT3B0aW9ucyA9IG9wdGlvbnM7XG5cdFx0aWYgKGhhc0ZpbGVBdG9taWNSZWFkQ2FwYWJpbGl0eShwcm92aWRlcikgJiYgcHJvdmlkZXIuZW5mb3JjZUF0b21pY1JlYWRGaWxlPy4ocmVzb3VyY2UpKSB7XG5cdFx0XHRyZWFkRmlsZU9wdGlvbnMgPSB7IC4uLm9wdGlvbnMsIGF0b21pYzogdHJ1ZSB9O1xuXHRcdH1cblxuXHRcdC8vIHZhbGlkYXRlIHJlYWQgb3BlcmF0aW9uXG5cdFx0Y29uc3Qgc3RhdFByb21pc2UgPSB0aGlzLnZhbGlkYXRlUmVhZEZpbGUocmVzb3VyY2UsIHJlYWRGaWxlT3B0aW9ucykudGhlbihzdGF0ID0+IHN0YXQsIGVycm9yID0+IHtcblx0XHRcdGNhbmNlbGxhYmxlU291cmNlLmRpc3Bvc2UodHJ1ZSk7XG5cblx0XHRcdHRocm93IGVycm9yO1xuXHRcdH0pO1xuXG5cdFx0bGV0IGZpbGVTdHJlYW06IFZTQnVmZmVyUmVhZGFibGVTdHJlYW0gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0dHJ5IHtcblxuXHRcdFx0Ly8gaWYgdGhlIGV0YWcgaXMgcHJvdmlkZWQsIHdlIGF3YWl0IHRoZSByZXN1bHQgb2YgdGhlIHZhbGlkYXRpb25cblx0XHRcdC8vIGR1ZSB0byB0aGUgbGlrZWxpaG9vZCBvZiBoaXR0aW5nIGEgTk9UX01PRElGSUVEX1NJTkNFIHJlc3VsdC5cblx0XHRcdC8vIG90aGVyd2lzZSwgd2UgbGV0IGl0IHJ1biBpbiBwYXJhbGxlbCB0byB0aGUgZmlsZSByZWFkaW5nIGZvclxuXHRcdFx0Ly8gb3B0aW1hbCBzdGFydHVwIHBlcmZvcm1hbmNlLlxuXHRcdFx0aWYgKHR5cGVvZiByZWFkRmlsZU9wdGlvbnM/LmV0YWcgPT09ICdzdHJpbmcnICYmIHJlYWRGaWxlT3B0aW9ucy5ldGFnICE9PSBFVEFHX0RJU0FCTEVEKSB7XG5cdFx0XHRcdGF3YWl0IHN0YXRQcm9taXNlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyByZWFkIHVuYnVmZmVyZWRcblx0XHRcdGlmIChcblx0XHRcdFx0KHJlYWRGaWxlT3B0aW9ucz8uYXRvbWljICYmIGhhc0ZpbGVBdG9taWNSZWFkQ2FwYWJpbGl0eShwcm92aWRlcikpIHx8XHRcdFx0XHRcdFx0XHRcdC8vIGF0b21pYyByZWFkcyBhcmUgYWx3YXlzIHVuYnVmZmVyZWRcblx0XHRcdFx0IShoYXNPcGVuUmVhZFdyaXRlQ2xvc2VDYXBhYmlsaXR5KHByb3ZpZGVyKSB8fCBoYXNGaWxlUmVhZFN0cmVhbUNhcGFiaWxpdHkocHJvdmlkZXIpKSB8fFx0Ly8gcHJvdmlkZXIgaGFzIG5vIGJ1ZmZlcmVkIGNhcGFiaWxpdHlcblx0XHRcdFx0KGhhc1JlYWRXcml0ZUNhcGFiaWxpdHkocHJvdmlkZXIpICYmIHJlYWRGaWxlT3B0aW9ucz8ucHJlZmVyVW5idWZmZXJlZClcdFx0XHRcdFx0XHRcdFx0Ly8gdW5idWZmZXJlZCByZWFkIGlzIHByZWZlcnJlZFxuXHRcdFx0KSB7XG5cdFx0XHRcdGZpbGVTdHJlYW0gPSB0aGlzLnJlYWRGaWxlVW5idWZmZXJlZChwcm92aWRlciwgcmVzb3VyY2UsIHJlYWRGaWxlT3B0aW9ucyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHJlYWQgc3RyZWFtZWQgKGFsd2F5cyBwcmVmZXIgb3ZlciBwcmltaXRpdmUgYnVmZmVyZWQgcmVhZClcblx0XHRcdGVsc2UgaWYgKGhhc0ZpbGVSZWFkU3RyZWFtQ2FwYWJpbGl0eShwcm92aWRlcikpIHtcblx0XHRcdFx0ZmlsZVN0cmVhbSA9IHRoaXMucmVhZEZpbGVTdHJlYW1lZChwcm92aWRlciwgcmVzb3VyY2UsIGNhbmNlbGxhYmxlU291cmNlLnRva2VuLCByZWFkRmlsZU9wdGlvbnMpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyByZWFkIGJ1ZmZlcmVkXG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0ZmlsZVN0cmVhbSA9IHRoaXMucmVhZEZpbGVCdWZmZXJlZChwcm92aWRlciwgcmVzb3VyY2UsIGNhbmNlbGxhYmxlU291cmNlLnRva2VuLCByZWFkRmlsZU9wdGlvbnMpO1xuXHRcdFx0fVxuXG5cdFx0XHRmaWxlU3RyZWFtLm9uKCdlbmQnLCAoKSA9PiBjYW5jZWxsYWJsZVNvdXJjZS5kaXNwb3NlKCkpO1xuXHRcdFx0ZmlsZVN0cmVhbS5vbignZXJyb3InLCAoKSA9PiBjYW5jZWxsYWJsZVNvdXJjZS5kaXNwb3NlKCkpO1xuXG5cdFx0XHRjb25zdCBmaWxlU3RhdCA9IGF3YWl0IHN0YXRQcm9taXNlO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHQuLi5maWxlU3RhdCxcblx0XHRcdFx0dmFsdWU6IGZpbGVTdHJlYW1cblx0XHRcdH07XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblxuXHRcdFx0Ly8gQXdhaXQgdGhlIHN0cmVhbSB0byBmaW5pc2ggc28gdGhhdCB3ZSBleGl0IHRoaXMgbWV0aG9kXG5cdFx0XHQvLyBpbiBhIGNvbnNpc3RlbnQgc3RhdGUgd2l0aCBmaWxlIGhhbmRsZXMgY2xvc2VkXG5cdFx0XHQvLyAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzExNDAyNClcblx0XHRcdGlmIChmaWxlU3RyZWFtKSB7XG5cdFx0XHRcdGF3YWl0IGNvbnN1bWVTdHJlYW0oZmlsZVN0cmVhbSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFJlLXRocm93IGVycm9ycyBhcyBmaWxlIG9wZXJhdGlvbiBlcnJvcnMgYnV0IHByZXNlcnZlXG5cdFx0XHQvLyBzcGVjaWZpYyBlcnJvcnMgKHN1Y2ggYXMgbm90IG1vZGlmaWVkIHNpbmNlKVxuXHRcdFx0dGhyb3cgdGhpcy5yZXN0b3JlUmVhZEVycm9yKGVycm9yLCByZXNvdXJjZSwgcmVhZEZpbGVPcHRpb25zKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlc3RvcmVSZWFkRXJyb3IoZXJyb3I6IEVycm9yLCByZXNvdXJjZTogVVJJLCBvcHRpb25zPzogSVJlYWRGaWxlU3RyZWFtT3B0aW9ucyk6IEZpbGVPcGVyYXRpb25FcnJvciB7XG5cdFx0Y29uc3QgbWVzc2FnZSA9IGxvY2FsaXplKCdlcnIucmVhZCcsIFwiVW5hYmxlIHRvIHJlYWQgZmlsZSAnezB9JyAoezF9KVwiLCB0aGlzLnJlc291cmNlRm9yRXJyb3IocmVzb3VyY2UpLCBlbnN1cmVGaWxlU3lzdGVtUHJvdmlkZXJFcnJvcihlcnJvcikudG9TdHJpbmcoKSk7XG5cblx0XHRpZiAoZXJyb3IgaW5zdGFuY2VvZiBOb3RNb2RpZmllZFNpbmNlRmlsZU9wZXJhdGlvbkVycm9yKSB7XG5cdFx0XHRyZXR1cm4gbmV3IE5vdE1vZGlmaWVkU2luY2VGaWxlT3BlcmF0aW9uRXJyb3IobWVzc2FnZSwgZXJyb3Iuc3RhdCwgb3B0aW9ucyk7XG5cdFx0fVxuXG5cdFx0aWYgKGVycm9yIGluc3RhbmNlb2YgVG9vTGFyZ2VGaWxlT3BlcmF0aW9uRXJyb3IpIHtcblx0XHRcdHJldHVybiBuZXcgVG9vTGFyZ2VGaWxlT3BlcmF0aW9uRXJyb3IobWVzc2FnZSwgZXJyb3IuZmlsZU9wZXJhdGlvblJlc3VsdCwgZXJyb3Iuc2l6ZSwgZXJyb3Iub3B0aW9ucyBhcyBJUmVhZEZpbGVPcHRpb25zKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IEZpbGVPcGVyYXRpb25FcnJvcihtZXNzYWdlLCB0b0ZpbGVPcGVyYXRpb25SZXN1bHQoZXJyb3IpLCBvcHRpb25zKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZEZpbGVTdHJlYW1lZChwcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlUmVhZFN0cmVhbUNhcGFiaWxpdHksIHJlc291cmNlOiBVUkksIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiwgb3B0aW9uczogSVJlYWRGaWxlU3RyZWFtT3B0aW9ucyA9IE9iamVjdC5jcmVhdGUobnVsbCkpOiBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtIHtcblx0XHRjb25zdCBmaWxlU3RyZWFtID0gcHJvdmlkZXIucmVhZEZpbGVTdHJlYW0ocmVzb3VyY2UsIG9wdGlvbnMsIHRva2VuKTtcblxuXHRcdHJldHVybiB0cmFuc2Zvcm0oZmlsZVN0cmVhbSwge1xuXHRcdFx0ZGF0YTogZGF0YSA9PiBkYXRhIGluc3RhbmNlb2YgVlNCdWZmZXIgPyBkYXRhIDogVlNCdWZmZXIud3JhcChkYXRhKSxcblx0XHRcdGVycm9yOiBlcnJvciA9PiB0aGlzLnJlc3RvcmVSZWFkRXJyb3IoZXJyb3IsIHJlc291cmNlLCBvcHRpb25zKVxuXHRcdH0sIGRhdGEgPT4gVlNCdWZmZXIuY29uY2F0KGRhdGEpKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZEZpbGVCdWZmZXJlZChwcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhPcGVuUmVhZFdyaXRlQ2xvc2VDYXBhYmlsaXR5LCByZXNvdXJjZTogVVJJLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIG9wdGlvbnM6IElSZWFkRmlsZVN0cmVhbU9wdGlvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpKTogVlNCdWZmZXJSZWFkYWJsZVN0cmVhbSB7XG5cdFx0Y29uc3Qgc3RyZWFtID0gbmV3V3JpdGVhYmxlQnVmZmVyU3RyZWFtKCk7XG5cblx0XHRyZWFkRmlsZUludG9TdHJlYW0ocHJvdmlkZXIsIHJlc291cmNlLCBzdHJlYW0sIGRhdGEgPT4gZGF0YSwge1xuXHRcdFx0Li4ub3B0aW9ucyxcblx0XHRcdGJ1ZmZlclNpemU6IHRoaXMuQlVGRkVSX1NJWkUsXG5cdFx0XHRlcnJvclRyYW5zZm9ybWVyOiBlcnJvciA9PiB0aGlzLnJlc3RvcmVSZWFkRXJyb3IoZXJyb3IsIHJlc291cmNlLCBvcHRpb25zKVxuXHRcdH0sIHRva2VuKTtcblxuXHRcdHJldHVybiBzdHJlYW07XG5cdH1cblxuXHRwcml2YXRlIHJlYWRGaWxlVW5idWZmZXJlZChwcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlUmVhZFdyaXRlQ2FwYWJpbGl0eSB8IElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZUF0b21pY1JlYWRDYXBhYmlsaXR5LCByZXNvdXJjZTogVVJJLCBvcHRpb25zPzogSVJlYWRGaWxlT3B0aW9ucyAmIElSZWFkRmlsZVN0cmVhbU9wdGlvbnMpOiBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtIHtcblx0XHRjb25zdCBzdHJlYW0gPSBuZXdXcml0ZWFibGVTdHJlYW08VlNCdWZmZXI+KGRhdGEgPT4gVlNCdWZmZXIuY29uY2F0KGRhdGEpKTtcblxuXHRcdC8vIFJlYWQgdGhlIGZpbGUgaW50byB0aGUgc3RyZWFtIGFzeW5jIGJ1dCBkbyBub3Qgd2FpdCBmb3Jcblx0XHQvLyB0aGlzIHRvIGNvbXBsZXRlIGJlY2F1c2Ugc3RyZWFtcyB3b3JrIHZpYSBldmVudHNcblx0XHQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0bGV0IGJ1ZmZlcjogVWludDhBcnJheTtcblx0XHRcdFx0aWYgKG9wdGlvbnM/LmF0b21pYyAmJiBoYXNGaWxlQXRvbWljUmVhZENhcGFiaWxpdHkocHJvdmlkZXIpKSB7XG5cdFx0XHRcdFx0YnVmZmVyID0gYXdhaXQgcHJvdmlkZXIucmVhZEZpbGUocmVzb3VyY2UsIHsgYXRvbWljOiB0cnVlIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGJ1ZmZlciA9IGF3YWl0IHByb3ZpZGVyLnJlYWRGaWxlKHJlc291cmNlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIHJlc3BlY3QgcG9zaXRpb24gb3B0aW9uXG5cdFx0XHRcdGlmICh0eXBlb2Ygb3B0aW9ucz8ucG9zaXRpb24gPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0YnVmZmVyID0gYnVmZmVyLnNsaWNlKG9wdGlvbnMucG9zaXRpb24pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gcmVzcGVjdCBsZW5ndGggb3B0aW9uXG5cdFx0XHRcdGlmICh0eXBlb2Ygb3B0aW9ucz8ubGVuZ3RoID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdGJ1ZmZlciA9IGJ1ZmZlci5zbGljZSgwLCBvcHRpb25zLmxlbmd0aCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBUaHJvdyBpZiBmaWxlIGlzIHRvbyBsYXJnZSB0byBsb2FkXG5cdFx0XHRcdHRoaXMudmFsaWRhdGVSZWFkRmlsZUxpbWl0cyhyZXNvdXJjZSwgYnVmZmVyLmJ5dGVMZW5ndGgsIG9wdGlvbnMpO1xuXG5cdFx0XHRcdC8vIEVuZCBzdHJlYW0gd2l0aCBkYXRhXG5cdFx0XHRcdHN0cmVhbS5lbmQoVlNCdWZmZXIud3JhcChidWZmZXIpKTtcblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRzdHJlYW0uZXJyb3IoZXJyKTtcblx0XHRcdFx0c3RyZWFtLmVuZCgpO1xuXHRcdFx0fVxuXHRcdH0pKCk7XG5cblx0XHRyZXR1cm4gc3RyZWFtO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB2YWxpZGF0ZVJlYWRGaWxlKHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBJUmVhZEZpbGVTdHJlYW1PcHRpb25zKTogUHJvbWlzZTxJRmlsZVN0YXRXaXRoTWV0YWRhdGE+IHtcblx0XHRjb25zdCBzdGF0ID0gYXdhaXQgdGhpcy5yZXNvbHZlKHJlc291cmNlLCB7IHJlc29sdmVNZXRhZGF0YTogdHJ1ZSB9KTtcblxuXHRcdC8vIFRocm93IGlmIHJlc291cmNlIGlzIGEgZGlyZWN0b3J5XG5cdFx0aWYgKHN0YXQuaXNEaXJlY3RvcnkpIHtcblx0XHRcdHRocm93IG5ldyBGaWxlT3BlcmF0aW9uRXJyb3IobG9jYWxpemUoJ2ZpbGVJc0RpcmVjdG9yeVJlYWRFcnJvcicsIFwiVW5hYmxlIHRvIHJlYWQgZmlsZSAnezB9JyB0aGF0IGlzIGFjdHVhbGx5IGEgZGlyZWN0b3J5XCIsIHRoaXMucmVzb3VyY2VGb3JFcnJvcihyZXNvdXJjZSkpLCBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfSVNfRElSRUNUT1JZLCBvcHRpb25zKTtcblx0XHR9XG5cblx0XHQvLyBUaHJvdyBpZiBmaWxlIG5vdCBtb2RpZmllZCBzaW5jZSAodW5sZXNzIGRpc2FibGVkKVxuXHRcdGlmICh0eXBlb2Ygb3B0aW9ucz8uZXRhZyA9PT0gJ3N0cmluZycgJiYgb3B0aW9ucy5ldGFnICE9PSBFVEFHX0RJU0FCTEVEICYmIG9wdGlvbnMuZXRhZyA9PT0gc3RhdC5ldGFnKSB7XG5cdFx0XHR0aHJvdyBuZXcgTm90TW9kaWZpZWRTaW5jZUZpbGVPcGVyYXRpb25FcnJvcihsb2NhbGl6ZSgnZmlsZU5vdE1vZGlmaWVkRXJyb3InLCBcIkZpbGUgbm90IG1vZGlmaWVkIHNpbmNlXCIpLCBzdGF0LCBvcHRpb25zKTtcblx0XHR9XG5cblx0XHQvLyBUaHJvdyBpZiBmaWxlIGlzIHRvbyBsYXJnZSB0byBsb2FkXG5cdFx0dGhpcy52YWxpZGF0ZVJlYWRGaWxlTGltaXRzKHJlc291cmNlLCBzdGF0LnNpemUsIG9wdGlvbnMpO1xuXG5cdFx0cmV0dXJuIHN0YXQ7XG5cdH1cblxuXHRwcml2YXRlIHZhbGlkYXRlUmVhZEZpbGVMaW1pdHMocmVzb3VyY2U6IFVSSSwgc2l6ZTogbnVtYmVyLCBvcHRpb25zPzogSVJlYWRGaWxlU3RyZWFtT3B0aW9ucyk6IHZvaWQge1xuXHRcdGlmICh0eXBlb2Ygb3B0aW9ucz8ubGltaXRzPy5zaXplID09PSAnbnVtYmVyJyAmJiBzaXplID4gb3B0aW9ucy5saW1pdHMuc2l6ZSkge1xuXHRcdFx0dGhyb3cgbmV3IFRvb0xhcmdlRmlsZU9wZXJhdGlvbkVycm9yKGxvY2FsaXplKCdmaWxlVG9vTGFyZ2VFcnJvcicsIFwiVW5hYmxlIHRvIHJlYWQgZmlsZSAnezB9JyB0aGF0IGlzIHRvbyBsYXJnZSB0byBvcGVuXCIsIHRoaXMucmVzb3VyY2VGb3JFcnJvcihyZXNvdXJjZSkpLCBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfVE9PX0xBUkdFLCBzaXplLCBvcHRpb25zKTtcblx0XHR9XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gTW92ZS9Db3B5L0RlbGV0ZS9DcmVhdGUgRm9sZGVyXG5cblx0YXN5bmMgY2FuTW92ZShzb3VyY2U6IFVSSSwgdGFyZ2V0OiBVUkksIG92ZXJ3cml0ZT86IGJvb2xlYW4pOiBQcm9taXNlPEVycm9yIHwgdHJ1ZT4ge1xuXHRcdHJldHVybiB0aGlzLmRvQ2FuTW92ZUNvcHkoc291cmNlLCB0YXJnZXQsICdtb3ZlJywgb3ZlcndyaXRlKTtcblx0fVxuXG5cdGFzeW5jIGNhbkNvcHkoc291cmNlOiBVUkksIHRhcmdldDogVVJJLCBvdmVyd3JpdGU/OiBib29sZWFuKTogUHJvbWlzZTxFcnJvciB8IHRydWU+IHtcblx0XHRyZXR1cm4gdGhpcy5kb0Nhbk1vdmVDb3B5KHNvdXJjZSwgdGFyZ2V0LCAnY29weScsIG92ZXJ3cml0ZSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvQ2FuTW92ZUNvcHkoc291cmNlOiBVUkksIHRhcmdldDogVVJJLCBtb2RlOiAnbW92ZScgfCAnY29weScsIG92ZXJ3cml0ZT86IGJvb2xlYW4pOiBQcm9taXNlPEVycm9yIHwgdHJ1ZT4ge1xuXHRcdGlmIChzb3VyY2UudG9TdHJpbmcoKSAhPT0gdGFyZ2V0LnRvU3RyaW5nKCkpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHNvdXJjZVByb3ZpZGVyID0gbW9kZSA9PT0gJ21vdmUnID8gdGhpcy50aHJvd0lmRmlsZVN5c3RlbUlzUmVhZG9ubHkoYXdhaXQgdGhpcy53aXRoV3JpdGVQcm92aWRlcihzb3VyY2UpLCBzb3VyY2UpIDogYXdhaXQgdGhpcy53aXRoUmVhZFByb3ZpZGVyKHNvdXJjZSk7XG5cdFx0XHRcdGNvbnN0IHRhcmdldFByb3ZpZGVyID0gdGhpcy50aHJvd0lmRmlsZVN5c3RlbUlzUmVhZG9ubHkoYXdhaXQgdGhpcy53aXRoV3JpdGVQcm92aWRlcih0YXJnZXQpLCB0YXJnZXQpO1xuXG5cdFx0XHRcdGF3YWl0IHRoaXMuZG9WYWxpZGF0ZU1vdmVDb3B5KHNvdXJjZVByb3ZpZGVyLCBzb3VyY2UsIHRhcmdldFByb3ZpZGVyLCB0YXJnZXQsIG1vZGUsIG92ZXJ3cml0ZSk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRyZXR1cm4gZXJyb3I7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRhc3luYyBtb3ZlKHNvdXJjZTogVVJJLCB0YXJnZXQ6IFVSSSwgb3ZlcndyaXRlPzogYm9vbGVhbik6IFByb21pc2U8SUZpbGVTdGF0V2l0aE1ldGFkYXRhPiB7XG5cdFx0Y29uc3Qgc291cmNlUHJvdmlkZXIgPSB0aGlzLnRocm93SWZGaWxlU3lzdGVtSXNSZWFkb25seShhd2FpdCB0aGlzLndpdGhXcml0ZVByb3ZpZGVyKHNvdXJjZSksIHNvdXJjZSk7XG5cdFx0Y29uc3QgdGFyZ2V0UHJvdmlkZXIgPSB0aGlzLnRocm93SWZGaWxlU3lzdGVtSXNSZWFkb25seShhd2FpdCB0aGlzLndpdGhXcml0ZVByb3ZpZGVyKHRhcmdldCksIHRhcmdldCk7XG5cblx0XHQvLyBtb3ZlXG5cdFx0Y29uc3QgbW9kZSA9IGF3YWl0IHRoaXMuZG9Nb3ZlQ29weShzb3VyY2VQcm92aWRlciwgc291cmNlLCB0YXJnZXRQcm92aWRlciwgdGFyZ2V0LCAnbW92ZScsICEhb3ZlcndyaXRlKTtcblxuXHRcdC8vIHJlc29sdmUgYW5kIHNlbmQgZXZlbnRzXG5cdFx0Y29uc3QgZmlsZVN0YXQgPSBhd2FpdCB0aGlzLnJlc29sdmUodGFyZ2V0LCB7IHJlc29sdmVNZXRhZGF0YTogdHJ1ZSB9KTtcblx0XHR0aGlzLl9vbkRpZFJ1bk9wZXJhdGlvbi5maXJlKG5ldyBGaWxlT3BlcmF0aW9uRXZlbnQoc291cmNlLCBtb2RlID09PSAnbW92ZScgPyBGaWxlT3BlcmF0aW9uLk1PVkUgOiBGaWxlT3BlcmF0aW9uLkNPUFksIGZpbGVTdGF0KSk7XG5cblx0XHRyZXR1cm4gZmlsZVN0YXQ7XG5cdH1cblxuXHRhc3luYyBjb3B5KHNvdXJjZTogVVJJLCB0YXJnZXQ6IFVSSSwgb3ZlcndyaXRlPzogYm9vbGVhbik6IFByb21pc2U8SUZpbGVTdGF0V2l0aE1ldGFkYXRhPiB7XG5cdFx0Y29uc3Qgc291cmNlUHJvdmlkZXIgPSBhd2FpdCB0aGlzLndpdGhSZWFkUHJvdmlkZXIoc291cmNlKTtcblx0XHRjb25zdCB0YXJnZXRQcm92aWRlciA9IHRoaXMudGhyb3dJZkZpbGVTeXN0ZW1Jc1JlYWRvbmx5KGF3YWl0IHRoaXMud2l0aFdyaXRlUHJvdmlkZXIodGFyZ2V0KSwgdGFyZ2V0KTtcblxuXHRcdC8vIGNvcHlcblx0XHRjb25zdCBtb2RlID0gYXdhaXQgdGhpcy5kb01vdmVDb3B5KHNvdXJjZVByb3ZpZGVyLCBzb3VyY2UsIHRhcmdldFByb3ZpZGVyLCB0YXJnZXQsICdjb3B5JywgISFvdmVyd3JpdGUpO1xuXG5cdFx0Ly8gcmVzb2x2ZSBhbmQgc2VuZCBldmVudHNcblx0XHRjb25zdCBmaWxlU3RhdCA9IGF3YWl0IHRoaXMucmVzb2x2ZSh0YXJnZXQsIHsgcmVzb2x2ZU1ldGFkYXRhOiB0cnVlIH0pO1xuXHRcdHRoaXMuX29uRGlkUnVuT3BlcmF0aW9uLmZpcmUobmV3IEZpbGVPcGVyYXRpb25FdmVudChzb3VyY2UsIG1vZGUgPT09ICdjb3B5JyA/IEZpbGVPcGVyYXRpb24uQ09QWSA6IEZpbGVPcGVyYXRpb24uTU9WRSwgZmlsZVN0YXQpKTtcblxuXHRcdHJldHVybiBmaWxlU3RhdDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9Nb3ZlQ29weShzb3VyY2VQcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlciwgc291cmNlOiBVUkksIHRhcmdldFByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyLCB0YXJnZXQ6IFVSSSwgbW9kZTogJ21vdmUnIHwgJ2NvcHknLCBvdmVyd3JpdGU6IGJvb2xlYW4pOiBQcm9taXNlPCdtb3ZlJyB8ICdjb3B5Jz4ge1xuXHRcdGlmIChzb3VyY2UudG9TdHJpbmcoKSA9PT0gdGFyZ2V0LnRvU3RyaW5nKCkpIHtcblx0XHRcdHJldHVybiBtb2RlOyAvLyBzaW11bGF0ZSBub2RlLmpzIGJlaGF2aW91ciBoZXJlIGFuZCBkbyBhIG5vLW9wIGlmIHBhdGhzIG1hdGNoXG5cdFx0fVxuXG5cdFx0Ly8gdmFsaWRhdGlvblxuXHRcdGNvbnN0IHsgZXhpc3RzLCBpc1NhbWVSZXNvdXJjZVdpdGhEaWZmZXJlbnRQYXRoQ2FzZSB9ID0gYXdhaXQgdGhpcy5kb1ZhbGlkYXRlTW92ZUNvcHkoc291cmNlUHJvdmlkZXIsIHNvdXJjZSwgdGFyZ2V0UHJvdmlkZXIsIHRhcmdldCwgbW9kZSwgb3ZlcndyaXRlKTtcblxuXHRcdC8vIGRlbGV0ZSBhcyBuZWVkZWQgKHVubGVzcyB0YXJnZXQgaXMgc2FtZSByZXN1cmNlIHdpdGggZGlmZmVyZW50IHBhdGggY2FzZSlcblx0XHRpZiAoZXhpc3RzICYmICFpc1NhbWVSZXNvdXJjZVdpdGhEaWZmZXJlbnRQYXRoQ2FzZSAmJiBvdmVyd3JpdGUpIHtcblx0XHRcdGF3YWl0IHRoaXMuZGVsKHRhcmdldCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cdFx0fVxuXG5cdFx0Ly8gY3JlYXRlIHBhcmVudCBmb2xkZXJzXG5cdFx0YXdhaXQgdGhpcy5ta2RpcnAodGFyZ2V0UHJvdmlkZXIsIHRoaXMuZ2V0RXh0VXJpKHRhcmdldFByb3ZpZGVyKS5wcm92aWRlckV4dFVyaS5kaXJuYW1lKHRhcmdldCkpO1xuXG5cdFx0Ly8gY29weSBzb3VyY2UgPT4gdGFyZ2V0XG5cdFx0aWYgKG1vZGUgPT09ICdjb3B5Jykge1xuXG5cdFx0XHQvLyBzYW1lIHByb3ZpZGVyIHdpdGggZmFzdCBjb3B5OiBsZXZlcmFnZSBjb3B5KCkgZnVuY3Rpb25hbGl0eVxuXHRcdFx0aWYgKHNvdXJjZVByb3ZpZGVyID09PSB0YXJnZXRQcm92aWRlciAmJiBoYXNGaWxlRm9sZGVyQ29weUNhcGFiaWxpdHkoc291cmNlUHJvdmlkZXIpKSB7XG5cdFx0XHRcdGF3YWl0IHNvdXJjZVByb3ZpZGVyLmNvcHkoc291cmNlLCB0YXJnZXQsIHsgb3ZlcndyaXRlIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyB3aGVuIGNvcHlpbmcgdmlhIGJ1ZmZlci91bmJ1ZmZlcmVkLCB3ZSBoYXZlIHRvIG1hbnVhbGx5XG5cdFx0XHQvLyB0cmF2ZXJzZSB0aGUgc291cmNlIGlmIGl0IGlzIGEgZm9sZGVyIGFuZCBub3QgYSBmaWxlXG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0Y29uc3Qgc291cmNlRmlsZSA9IGF3YWl0IHRoaXMucmVzb2x2ZShzb3VyY2UpO1xuXHRcdFx0XHRpZiAoc291cmNlRmlsZS5pc0RpcmVjdG9yeSkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuZG9Db3B5Rm9sZGVyKHNvdXJjZVByb3ZpZGVyLCBzb3VyY2VGaWxlLCB0YXJnZXRQcm92aWRlciwgdGFyZ2V0KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmRvQ29weUZpbGUoc291cmNlUHJvdmlkZXIsIHNvdXJjZSwgdGFyZ2V0UHJvdmlkZXIsIHRhcmdldCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG1vZGU7XG5cdFx0fVxuXG5cdFx0Ly8gbW92ZSBzb3VyY2UgPT4gdGFyZ2V0XG5cdFx0ZWxzZSB7XG5cblx0XHRcdC8vIHNhbWUgcHJvdmlkZXI6IGxldmVyYWdlIHJlbmFtZSgpIGZ1bmN0aW9uYWxpdHlcblx0XHRcdGlmIChzb3VyY2VQcm92aWRlciA9PT0gdGFyZ2V0UHJvdmlkZXIpIHtcblx0XHRcdFx0YXdhaXQgc291cmNlUHJvdmlkZXIucmVuYW1lKHNvdXJjZSwgdGFyZ2V0LCB7IG92ZXJ3cml0ZSB9KTtcblxuXHRcdFx0XHRyZXR1cm4gbW9kZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gYWNyb3NzIHByb3ZpZGVyczogY29weSB0byB0YXJnZXQgJiBkZWxldGUgYXQgc291cmNlXG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5kb01vdmVDb3B5KHNvdXJjZVByb3ZpZGVyLCBzb3VyY2UsIHRhcmdldFByb3ZpZGVyLCB0YXJnZXQsICdjb3B5Jywgb3ZlcndyaXRlKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5kZWwoc291cmNlLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblxuXHRcdFx0XHRyZXR1cm4gJ2NvcHknO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9Db3B5RmlsZShzb3VyY2VQcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlciwgc291cmNlOiBVUkksIHRhcmdldFByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyLCB0YXJnZXQ6IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gY29weTogc291cmNlIChidWZmZXJlZCkgPT4gdGFyZ2V0IChidWZmZXJlZClcblx0XHRpZiAoaGFzT3BlblJlYWRXcml0ZUNsb3NlQ2FwYWJpbGl0eShzb3VyY2VQcm92aWRlcikgJiYgaGFzT3BlblJlYWRXcml0ZUNsb3NlQ2FwYWJpbGl0eSh0YXJnZXRQcm92aWRlcikpIHtcblx0XHRcdHJldHVybiB0aGlzLmRvUGlwZUJ1ZmZlcmVkKHNvdXJjZVByb3ZpZGVyLCBzb3VyY2UsIHRhcmdldFByb3ZpZGVyLCB0YXJnZXQpO1xuXHRcdH1cblxuXHRcdC8vIGNvcHk6IHNvdXJjZSAoYnVmZmVyZWQpID0+IHRhcmdldCAodW5idWZmZXJlZClcblx0XHRpZiAoaGFzT3BlblJlYWRXcml0ZUNsb3NlQ2FwYWJpbGl0eShzb3VyY2VQcm92aWRlcikgJiYgaGFzUmVhZFdyaXRlQ2FwYWJpbGl0eSh0YXJnZXRQcm92aWRlcikpIHtcblx0XHRcdHJldHVybiB0aGlzLmRvUGlwZUJ1ZmZlcmVkVG9VbmJ1ZmZlcmVkKHNvdXJjZVByb3ZpZGVyLCBzb3VyY2UsIHRhcmdldFByb3ZpZGVyLCB0YXJnZXQpO1xuXHRcdH1cblxuXHRcdC8vIGNvcHk6IHNvdXJjZSAodW5idWZmZXJlZCkgPT4gdGFyZ2V0IChidWZmZXJlZClcblx0XHRpZiAoaGFzUmVhZFdyaXRlQ2FwYWJpbGl0eShzb3VyY2VQcm92aWRlcikgJiYgaGFzT3BlblJlYWRXcml0ZUNsb3NlQ2FwYWJpbGl0eSh0YXJnZXRQcm92aWRlcikpIHtcblx0XHRcdHJldHVybiB0aGlzLmRvUGlwZVVuYnVmZmVyZWRUb0J1ZmZlcmVkKHNvdXJjZVByb3ZpZGVyLCBzb3VyY2UsIHRhcmdldFByb3ZpZGVyLCB0YXJnZXQpO1xuXHRcdH1cblxuXHRcdC8vIGNvcHk6IHNvdXJjZSAodW5idWZmZXJlZCkgPT4gdGFyZ2V0ICh1bmJ1ZmZlcmVkKVxuXHRcdGlmIChoYXNSZWFkV3JpdGVDYXBhYmlsaXR5KHNvdXJjZVByb3ZpZGVyKSAmJiBoYXNSZWFkV3JpdGVDYXBhYmlsaXR5KHRhcmdldFByb3ZpZGVyKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZG9QaXBlVW5idWZmZXJlZChzb3VyY2VQcm92aWRlciwgc291cmNlLCB0YXJnZXRQcm92aWRlciwgdGFyZ2V0KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvQ29weUZvbGRlcihzb3VyY2VQcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlciwgc291cmNlRm9sZGVyOiBJRmlsZVN0YXQsIHRhcmdldFByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyLCB0YXJnZXRGb2xkZXI6IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Ly8gY3JlYXRlIGZvbGRlciBpbiB0YXJnZXRcblx0XHRhd2FpdCB0YXJnZXRQcm92aWRlci5ta2Rpcih0YXJnZXRGb2xkZXIpO1xuXG5cdFx0Ly8gY3JlYXRlIGNoaWxkcmVuIGluIHRhcmdldFxuXHRcdGlmIChBcnJheS5pc0FycmF5KHNvdXJjZUZvbGRlci5jaGlsZHJlbikpIHtcblx0XHRcdGF3YWl0IFByb21pc2VzLnNldHRsZWQoc291cmNlRm9sZGVyLmNoaWxkcmVuLm1hcChhc3luYyBzb3VyY2VDaGlsZCA9PiB7XG5cdFx0XHRcdGNvbnN0IHRhcmdldENoaWxkID0gdGhpcy5nZXRFeHRVcmkodGFyZ2V0UHJvdmlkZXIpLnByb3ZpZGVyRXh0VXJpLmpvaW5QYXRoKHRhcmdldEZvbGRlciwgc291cmNlQ2hpbGQubmFtZSk7XG5cdFx0XHRcdGlmIChzb3VyY2VDaGlsZC5pc0RpcmVjdG9yeSkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmRvQ29weUZvbGRlcihzb3VyY2VQcm92aWRlciwgYXdhaXQgdGhpcy5yZXNvbHZlKHNvdXJjZUNoaWxkLnJlc291cmNlKSwgdGFyZ2V0UHJvdmlkZXIsIHRhcmdldENoaWxkKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5kb0NvcHlGaWxlKHNvdXJjZVByb3ZpZGVyLCBzb3VyY2VDaGlsZC5yZXNvdXJjZSwgdGFyZ2V0UHJvdmlkZXIsIHRhcmdldENoaWxkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9WYWxpZGF0ZU1vdmVDb3B5KHNvdXJjZVByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyLCBzb3VyY2U6IFVSSSwgdGFyZ2V0UHJvdmlkZXI6IElGaWxlU3lzdGVtUHJvdmlkZXIsIHRhcmdldDogVVJJLCBtb2RlOiAnbW92ZScgfCAnY29weScsIG92ZXJ3cml0ZT86IGJvb2xlYW4pOiBQcm9taXNlPHsgZXhpc3RzOiBib29sZWFuOyBpc1NhbWVSZXNvdXJjZVdpdGhEaWZmZXJlbnRQYXRoQ2FzZTogYm9vbGVhbiB9PiB7XG5cdFx0bGV0IGlzU2FtZVJlc291cmNlV2l0aERpZmZlcmVudFBhdGhDYXNlID0gZmFsc2U7XG5cblx0XHQvLyBDaGVjayBpZiBzb3VyY2UgaXMgZXF1YWwgb3IgcGFyZW50IHRvIHRhcmdldCAocmVxdWlyZXMgcHJvdmlkZXJzIHRvIGJlIHRoZSBzYW1lKVxuXHRcdGlmIChzb3VyY2VQcm92aWRlciA9PT0gdGFyZ2V0UHJvdmlkZXIpIHtcblx0XHRcdGNvbnN0IHsgcHJvdmlkZXJFeHRVcmksIGlzUGF0aENhc2VTZW5zaXRpdmUgfSA9IHRoaXMuZ2V0RXh0VXJpKHNvdXJjZVByb3ZpZGVyKTtcblx0XHRcdGlmICghaXNQYXRoQ2FzZVNlbnNpdGl2ZSkge1xuXHRcdFx0XHRpc1NhbWVSZXNvdXJjZVdpdGhEaWZmZXJlbnRQYXRoQ2FzZSA9IHByb3ZpZGVyRXh0VXJpLmlzRXF1YWwoc291cmNlLCB0YXJnZXQpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaXNTYW1lUmVzb3VyY2VXaXRoRGlmZmVyZW50UGF0aENhc2UgJiYgbW9kZSA9PT0gJ2NvcHknKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgndW5hYmxlVG9Nb3ZlQ29weUVycm9yMScsIFwiVW5hYmxlIHRvIGNvcHkgd2hlbiBzb3VyY2UgJ3swfScgaXMgc2FtZSBhcyB0YXJnZXQgJ3sxfScgd2l0aCBkaWZmZXJlbnQgcGF0aCBjYXNlIG9uIGEgY2FzZSBpbnNlbnNpdGl2ZSBmaWxlIHN5c3RlbVwiLCB0aGlzLnJlc291cmNlRm9yRXJyb3Ioc291cmNlKSwgdGhpcy5yZXNvdXJjZUZvckVycm9yKHRhcmdldCkpKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFpc1NhbWVSZXNvdXJjZVdpdGhEaWZmZXJlbnRQYXRoQ2FzZSAmJiBwcm92aWRlckV4dFVyaS5pc0VxdWFsT3JQYXJlbnQodGFyZ2V0LCBzb3VyY2UpKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgndW5hYmxlVG9Nb3ZlQ29weUVycm9yMicsIFwiVW5hYmxlIHRvIG1vdmUvY29weSB3aGVuIHNvdXJjZSAnezB9JyBpcyBwYXJlbnQgb2YgdGFyZ2V0ICd7MX0nLlwiLCB0aGlzLnJlc291cmNlRm9yRXJyb3Ioc291cmNlKSwgdGhpcy5yZXNvdXJjZUZvckVycm9yKHRhcmdldCkpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBFeHRyYSBjaGVja3MgaWYgdGFyZ2V0IGV4aXN0cyBhbmQgdGhpcyBpcyBub3QgYSByZW5hbWVcblx0XHRjb25zdCBleGlzdHMgPSBhd2FpdCB0aGlzLmV4aXN0cyh0YXJnZXQpO1xuXHRcdGlmIChleGlzdHMgJiYgIWlzU2FtZVJlc291cmNlV2l0aERpZmZlcmVudFBhdGhDYXNlKSB7XG5cblx0XHRcdC8vIEJhaWwgb3V0IGlmIHRhcmdldCBleGlzdHMgYW5kIHdlIGFyZSBub3QgYWJvdXQgdG8gb3ZlcndyaXRlXG5cdFx0XHRpZiAoIW92ZXJ3cml0ZSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRmlsZU9wZXJhdGlvbkVycm9yKGxvY2FsaXplKCd1bmFibGVUb01vdmVDb3B5RXJyb3IzJywgXCJVbmFibGUgdG8gbW92ZS9jb3B5ICd7MH0nIGJlY2F1c2UgdGFyZ2V0ICd7MX0nIGFscmVhZHkgZXhpc3RzIGF0IGRlc3RpbmF0aW9uLlwiLCB0aGlzLnJlc291cmNlRm9yRXJyb3Ioc291cmNlKSwgdGhpcy5yZXNvdXJjZUZvckVycm9yKHRhcmdldCkpLCBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTU9WRV9DT05GTElDVCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFNwZWNpYWwgY2FzZTogaWYgdGhlIHRhcmdldCBpcyBhIHBhcmVudCBvZiB0aGUgc291cmNlLCB3ZSBjYW5ub3QgZGVsZXRlXG5cdFx0XHQvLyBpdCBhcyBpdCB3b3VsZCBkZWxldGUgdGhlIHNvdXJjZSBhcyB3ZWxsLiBJbiB0aGlzIGNhc2Ugd2UgaGF2ZSB0byB0aHJvd1xuXHRcdFx0aWYgKHNvdXJjZVByb3ZpZGVyID09PSB0YXJnZXRQcm92aWRlcikge1xuXHRcdFx0XHRjb25zdCB7IHByb3ZpZGVyRXh0VXJpIH0gPSB0aGlzLmdldEV4dFVyaShzb3VyY2VQcm92aWRlcik7XG5cdFx0XHRcdGlmIChwcm92aWRlckV4dFVyaS5pc0VxdWFsT3JQYXJlbnQoc291cmNlLCB0YXJnZXQpKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCd1bmFibGVUb01vdmVDb3B5RXJyb3I0JywgXCJVbmFibGUgdG8gbW92ZS9jb3B5ICd7MH0nIGludG8gJ3sxfScgc2luY2UgYSBmaWxlIHdvdWxkIHJlcGxhY2UgdGhlIGZvbGRlciBpdCBpcyBjb250YWluZWQgaW4uXCIsIHRoaXMucmVzb3VyY2VGb3JFcnJvcihzb3VyY2UpLCB0aGlzLnJlc291cmNlRm9yRXJyb3IodGFyZ2V0KSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgZXhpc3RzLCBpc1NhbWVSZXNvdXJjZVdpdGhEaWZmZXJlbnRQYXRoQ2FzZSB9O1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRFeHRVcmkocHJvdmlkZXI6IElGaWxlU3lzdGVtUHJvdmlkZXIpOiB7IHByb3ZpZGVyRXh0VXJpOiBJRXh0VXJpOyBpc1BhdGhDYXNlU2Vuc2l0aXZlOiBib29sZWFuIH0ge1xuXHRcdGNvbnN0IGlzUGF0aENhc2VTZW5zaXRpdmUgPSB0aGlzLmlzUGF0aENhc2VTZW5zaXRpdmUocHJvdmlkZXIpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHByb3ZpZGVyRXh0VXJpOiBpc1BhdGhDYXNlU2Vuc2l0aXZlID8gZXh0VXJpIDogZXh0VXJpSWdub3JlUGF0aENhc2UsXG5cdFx0XHRpc1BhdGhDYXNlU2Vuc2l0aXZlXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgaXNQYXRoQ2FzZVNlbnNpdGl2ZShwcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlcik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIShwcm92aWRlci5jYXBhYmlsaXRpZXMgJiBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuUGF0aENhc2VTZW5zaXRpdmUpO1xuXHR9XG5cblx0YXN5bmMgY3JlYXRlRm9sZGVyKHJlc291cmNlOiBVUkkpOiBQcm9taXNlPElGaWxlU3RhdFdpdGhNZXRhZGF0YT4ge1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gdGhpcy50aHJvd0lmRmlsZVN5c3RlbUlzUmVhZG9ubHkoYXdhaXQgdGhpcy53aXRoUHJvdmlkZXIocmVzb3VyY2UpLCByZXNvdXJjZSk7XG5cblx0XHQvLyBta2RpciByZWN1cnNpdmVseVxuXHRcdGF3YWl0IHRoaXMubWtkaXJwKHByb3ZpZGVyLCByZXNvdXJjZSk7XG5cblx0XHQvLyBldmVudHNcblx0XHRjb25zdCBmaWxlU3RhdCA9IGF3YWl0IHRoaXMucmVzb2x2ZShyZXNvdXJjZSwgeyByZXNvbHZlTWV0YWRhdGE6IHRydWUgfSk7XG5cdFx0dGhpcy5fb25EaWRSdW5PcGVyYXRpb24uZmlyZShuZXcgRmlsZU9wZXJhdGlvbkV2ZW50KHJlc291cmNlLCBGaWxlT3BlcmF0aW9uLkNSRUFURSwgZmlsZVN0YXQpKTtcblxuXHRcdHJldHVybiBmaWxlU3RhdDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgbWtkaXJwKHByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyLCBkaXJlY3Rvcnk6IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGRpcmVjdG9yaWVzVG9DcmVhdGU6IHN0cmluZ1tdID0gW107XG5cblx0XHQvLyBta2RpciB1bnRpbCB3ZSByZWFjaCByb290XG5cdFx0Y29uc3QgeyBwcm92aWRlckV4dFVyaSB9ID0gdGhpcy5nZXRFeHRVcmkocHJvdmlkZXIpO1xuXHRcdHdoaWxlICghcHJvdmlkZXJFeHRVcmkuaXNFcXVhbChkaXJlY3RvcnksIHByb3ZpZGVyRXh0VXJpLmRpcm5hbWUoZGlyZWN0b3J5KSkpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHN0YXQgPSBhd2FpdCBwcm92aWRlci5zdGF0KGRpcmVjdG9yeSk7XG5cdFx0XHRcdGlmICgoc3RhdC50eXBlICYgRmlsZVR5cGUuRGlyZWN0b3J5KSA9PT0gMCkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnbWtkaXJFeGlzdHNFcnJvcicsIFwiVW5hYmxlIHRvIGNyZWF0ZSBmb2xkZXIgJ3swfScgdGhhdCBhbHJlYWR5IGV4aXN0cyBidXQgaXMgbm90IGEgZGlyZWN0b3J5XCIsIHRoaXMucmVzb3VyY2VGb3JFcnJvcihkaXJlY3RvcnkpKSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRicmVhazsgLy8gd2UgaGF2ZSBoaXQgYSBkaXJlY3RvcnkgdGhhdCBleGlzdHMgLT4gZ29vZFxuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblxuXHRcdFx0XHQvLyBCdWJibGUgdXAgYW55IG90aGVyIGVycm9yIHRoYXQgaXMgbm90IGZpbGUgbm90IGZvdW5kXG5cdFx0XHRcdGlmICh0b0ZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZShlcnJvcikgIT09IEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5GaWxlTm90Rm91bmQpIHtcblx0XHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFVwb24gZXJyb3IsIHJlbWVtYmVyIGRpcmVjdG9yaWVzIHRoYXQgbmVlZCB0byBiZSBjcmVhdGVkXG5cdFx0XHRcdGRpcmVjdG9yaWVzVG9DcmVhdGUucHVzaChwcm92aWRlckV4dFVyaS5iYXNlbmFtZShkaXJlY3RvcnkpKTtcblxuXHRcdFx0XHQvLyBDb250aW51ZSB1cFxuXHRcdFx0XHRkaXJlY3RvcnkgPSBwcm92aWRlckV4dFVyaS5kaXJuYW1lKGRpcmVjdG9yeSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQ3JlYXRlIGRpcmVjdG9yaWVzIGFzIG5lZWRlZFxuXHRcdGZvciAobGV0IGkgPSBkaXJlY3Rvcmllc1RvQ3JlYXRlLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRkaXJlY3RvcnkgPSBwcm92aWRlckV4dFVyaS5qb2luUGF0aChkaXJlY3RvcnksIGRpcmVjdG9yaWVzVG9DcmVhdGVbaV0pO1xuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCBwcm92aWRlci5ta2RpcihkaXJlY3RvcnkpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0aWYgKHRvRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlKGVycm9yKSAhPT0gRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLkZpbGVFeGlzdHMpIHtcblx0XHRcdFx0XHQvLyBGb3IgbWtkaXJwKCkgd2UgdG9sZXJhdGUgdGhhdCB0aGUgbWtkaXIoKSBjYWxsIGZhaWxzXG5cdFx0XHRcdFx0Ly8gaW4gY2FzZSB0aGUgZm9sZGVyIGFscmVhZHkgZXhpc3RzLiBUaGlzIGZvbGxvd3Mgbm9kZS5qc1xuXHRcdFx0XHRcdC8vIG93biBpbXBsZW1lbnRhdGlvbiBvZiBmcy5ta2Rpcih7IHJlY3Vyc2l2ZTogdHJ1ZSB9KSBhbmRcblx0XHRcdFx0XHQvLyByZWR1Y2VzIHRoZSBjaGFuY2VzIG9mIHJhY2UgY29uZGl0aW9ucyBsZWFkaW5nIHRvIGVycm9yc1xuXHRcdFx0XHRcdC8vIGlmIG11bHRpcGxlIGNhbGxzIHRyeSB0byBjcmVhdGUgdGhlIHNhbWUgZm9sZGVyc1xuXHRcdFx0XHRcdC8vIEFzIHN1Y2gsIHdlIG9ubHkgdGhyb3cgYW4gZXJyb3IgaGVyZSBpZiBpdCBpcyBvdGhlciB0aGFuXG5cdFx0XHRcdFx0Ly8gdGhlIGZhY3QgdGhhdCB0aGUgZmlsZSBhbHJlYWR5IGV4aXN0cy5cblx0XHRcdFx0XHQvLyAoc2VlIGFsc28gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzg5ODM0KVxuXHRcdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgY2FuRGVsZXRlKHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBQYXJ0aWFsPElGaWxlRGVsZXRlT3B0aW9ucz4pOiBQcm9taXNlPEVycm9yIHwgdHJ1ZT4ge1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmRvVmFsaWRhdGVEZWxldGUocmVzb3VyY2UsIG9wdGlvbnMpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRyZXR1cm4gZXJyb3I7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvVmFsaWRhdGVEZWxldGUocmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IFBhcnRpYWw8SUZpbGVEZWxldGVPcHRpb25zPik6IFByb21pc2U8SUZpbGVTeXN0ZW1Qcm92aWRlcj4ge1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gdGhpcy50aHJvd0lmRmlsZVN5c3RlbUlzUmVhZG9ubHkoYXdhaXQgdGhpcy53aXRoUHJvdmlkZXIocmVzb3VyY2UpLCByZXNvdXJjZSk7XG5cblx0XHQvLyBWYWxpZGF0ZSB0cmFzaCBzdXBwb3J0XG5cdFx0Y29uc3QgdXNlVHJhc2ggPSAhIW9wdGlvbnM/LnVzZVRyYXNoO1xuXHRcdGlmICh1c2VUcmFzaCAmJiAhKHByb3ZpZGVyLmNhcGFiaWxpdGllcyAmIEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5UcmFzaCkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnZGVsZXRlRmFpbGVkVHJhc2hVbnN1cHBvcnRlZCcsIFwiVW5hYmxlIHRvIGRlbGV0ZSBmaWxlICd7MH0nIHZpYSB0cmFzaCBiZWNhdXNlIHByb3ZpZGVyIGRvZXMgbm90IHN1cHBvcnQgaXQuXCIsIHRoaXMucmVzb3VyY2VGb3JFcnJvcihyZXNvdXJjZSkpKTtcblx0XHR9XG5cblx0XHQvLyBWYWxpZGF0ZSBhdG9taWMgc3VwcG9ydFxuXHRcdGNvbnN0IGF0b21pYyA9IG9wdGlvbnM/LmF0b21pYztcblx0XHRpZiAoYXRvbWljICYmICEocHJvdmlkZXIuY2FwYWJpbGl0aWVzICYgRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLkZpbGVBdG9taWNEZWxldGUpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ2RlbGV0ZUZhaWxlZEF0b21pY1Vuc3VwcG9ydGVkJywgXCJVbmFibGUgdG8gZGVsZXRlIGZpbGUgJ3swfScgYXRvbWljYWxseSBiZWNhdXNlIHByb3ZpZGVyIGRvZXMgbm90IHN1cHBvcnQgaXQuXCIsIHRoaXMucmVzb3VyY2VGb3JFcnJvcihyZXNvdXJjZSkpKTtcblx0XHR9XG5cblx0XHRpZiAodXNlVHJhc2ggJiYgYXRvbWljKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ2RlbGV0ZUZhaWxlZFRyYXNoQW5kQXRvbWljVW5zdXBwb3J0ZWQnLCBcIlVuYWJsZSB0byBhdG9taWNhbGx5IGRlbGV0ZSBmaWxlICd7MH0nIGJlY2F1c2UgdXNpbmcgdHJhc2ggaXMgZW5hYmxlZC5cIiwgdGhpcy5yZXNvdXJjZUZvckVycm9yKHJlc291cmNlKSkpO1xuXHRcdH1cblxuXHRcdC8vIFZhbGlkYXRlIGRlbGV0ZVxuXHRcdGxldCBzdGF0OiBJU3RhdCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0c3RhdCA9IGF3YWl0IHByb3ZpZGVyLnN0YXQocmVzb3VyY2UpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHQvLyBIYW5kbGVkIGxhdGVyXG5cdFx0fVxuXG5cdFx0aWYgKHN0YXQpIHtcblx0XHRcdHRoaXMudGhyb3dJZkZpbGVJc1JlYWRvbmx5KHJlc291cmNlLCBzdGF0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEZpbGVPcGVyYXRpb25FcnJvcihsb2NhbGl6ZSgnZGVsZXRlRmFpbGVkTm90Rm91bmQnLCBcIlVuYWJsZSB0byBkZWxldGUgbm9uZXhpc3RlbnQgZmlsZSAnezB9J1wiLCB0aGlzLnJlc291cmNlRm9yRXJyb3IocmVzb3VyY2UpKSwgRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9GT1VORCk7XG5cdFx0fVxuXG5cdFx0Ly8gVmFsaWRhdGUgcmVjdXJzaXZlXG5cdFx0Y29uc3QgcmVjdXJzaXZlID0gISFvcHRpb25zPy5yZWN1cnNpdmU7XG5cdFx0aWYgKCFyZWN1cnNpdmUpIHtcblx0XHRcdGNvbnN0IHN0YXQgPSBhd2FpdCB0aGlzLnJlc29sdmUocmVzb3VyY2UpO1xuXHRcdFx0aWYgKHN0YXQuaXNEaXJlY3RvcnkgJiYgQXJyYXkuaXNBcnJheShzdGF0LmNoaWxkcmVuKSAmJiBzdGF0LmNoaWxkcmVuLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdkZWxldGVGYWlsZWROb25FbXB0eUZvbGRlcicsIFwiVW5hYmxlIHRvIGRlbGV0ZSBub24tZW1wdHkgZm9sZGVyICd7MH0nLlwiLCB0aGlzLnJlc291cmNlRm9yRXJyb3IocmVzb3VyY2UpKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHByb3ZpZGVyO1xuXHR9XG5cblx0YXN5bmMgZGVsKHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBQYXJ0aWFsPElGaWxlRGVsZXRlT3B0aW9ucz4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBwcm92aWRlciA9IGF3YWl0IHRoaXMuZG9WYWxpZGF0ZURlbGV0ZShyZXNvdXJjZSwgb3B0aW9ucyk7XG5cblx0XHRsZXQgZGVsZXRlRmlsZU9wdGlvbnMgPSBvcHRpb25zO1xuXHRcdGlmIChoYXNGaWxlQXRvbWljRGVsZXRlQ2FwYWJpbGl0eShwcm92aWRlcikgJiYgIWRlbGV0ZUZpbGVPcHRpb25zPy5hdG9taWMpIHtcblx0XHRcdGNvbnN0IGVuZm9yY2VkQXRvbWljRGVsZXRlID0gcHJvdmlkZXIuZW5mb3JjZUF0b21pY0RlbGV0ZT8uKHJlc291cmNlKTtcblx0XHRcdGlmIChlbmZvcmNlZEF0b21pY0RlbGV0ZSkge1xuXHRcdFx0XHRkZWxldGVGaWxlT3B0aW9ucyA9IHsgLi4ub3B0aW9ucywgYXRvbWljOiBlbmZvcmNlZEF0b21pY0RlbGV0ZSB9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHVzZVRyYXNoID0gISFkZWxldGVGaWxlT3B0aW9ucz8udXNlVHJhc2g7XG5cdFx0Y29uc3QgcmVjdXJzaXZlID0gISFkZWxldGVGaWxlT3B0aW9ucz8ucmVjdXJzaXZlO1xuXHRcdGNvbnN0IGF0b21pYyA9IGRlbGV0ZUZpbGVPcHRpb25zPy5hdG9taWMgPz8gZmFsc2U7XG5cblx0XHQvLyBEZWxldGUgdGhyb3VnaCBwcm92aWRlclxuXHRcdGF3YWl0IHByb3ZpZGVyLmRlbGV0ZShyZXNvdXJjZSwgeyByZWN1cnNpdmUsIHVzZVRyYXNoLCBhdG9taWMgfSk7XG5cblx0XHQvLyBFdmVudHNcblx0XHR0aGlzLl9vbkRpZFJ1bk9wZXJhdGlvbi5maXJlKG5ldyBGaWxlT3BlcmF0aW9uRXZlbnQocmVzb3VyY2UsIEZpbGVPcGVyYXRpb24uREVMRVRFKSk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gQ2xvbmUgRmlsZVxuXG5cdGFzeW5jIGNsb25lRmlsZShzb3VyY2U6IFVSSSwgdGFyZ2V0OiBVUkkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBzb3VyY2VQcm92aWRlciA9IGF3YWl0IHRoaXMud2l0aFByb3ZpZGVyKHNvdXJjZSk7XG5cdFx0Y29uc3QgdGFyZ2V0UHJvdmlkZXIgPSB0aGlzLnRocm93SWZGaWxlU3lzdGVtSXNSZWFkb25seShhd2FpdCB0aGlzLndpdGhXcml0ZVByb3ZpZGVyKHRhcmdldCksIHRhcmdldCk7XG5cblx0XHRpZiAoc291cmNlUHJvdmlkZXIgPT09IHRhcmdldFByb3ZpZGVyICYmIHRoaXMuZ2V0RXh0VXJpKHNvdXJjZVByb3ZpZGVyKS5wcm92aWRlckV4dFVyaS5pc0VxdWFsKHNvdXJjZSwgdGFyZ2V0KSkge1xuXHRcdFx0cmV0dXJuOyAvLyByZXR1cm4gZWFybHkgaWYgcGF0aHMgYXJlIGVxdWFsXG5cdFx0fVxuXG5cdFx0Ly8gc2FtZSBwcm92aWRlciwgdXNlIGBjbG9uZUZpbGVgIHdoZW4gbmF0aXZlIHN1cHBvcnQgaXMgcHJvdmlkZWRcblx0XHRpZiAoc291cmNlUHJvdmlkZXIgPT09IHRhcmdldFByb3ZpZGVyICYmIGhhc0ZpbGVDbG9uZUNhcGFiaWxpdHkoc291cmNlUHJvdmlkZXIpKSB7XG5cdFx0XHRyZXR1cm4gc291cmNlUHJvdmlkZXIuY2xvbmVGaWxlKHNvdXJjZSwgdGFyZ2V0KTtcblx0XHR9XG5cblx0XHQvLyBvdGhlcndpc2UsIGVpdGhlciBwcm92aWRlcnMgYXJlIGRpZmZlcmVudCBvciB0aGVyZSBpcyBubyBuYXRpdmVcblx0XHQvLyBgY2xvbmVGaWxlYCBzdXBwb3J0LCB0aGVuIHdlIGZhbGxiYWNrIHRvIGVtdWxhdGUgYSBjbG9uZSBhcyBiZXN0XG5cdFx0Ly8gYXMgd2UgY2FuIHdpdGggdGhlIG90aGVyIHByaW1pdGl2ZXNcblxuXHRcdC8vIGNyZWF0ZSBwYXJlbnQgZm9sZGVyc1xuXHRcdGF3YWl0IHRoaXMubWtkaXJwKHRhcmdldFByb3ZpZGVyLCB0aGlzLmdldEV4dFVyaSh0YXJnZXRQcm92aWRlcikucHJvdmlkZXJFeHRVcmkuZGlybmFtZSh0YXJnZXQpKTtcblxuXHRcdC8vIGxldmVyYWdlIGBjb3B5YCBtZXRob2QgaWYgcHJvdmlkZWQgYW5kIHByb3ZpZGVycyBhcmUgaWRlbnRpY2FsXG5cdFx0Ly8gcXVldWUgb24gdGhlIHNvdXJjZSB0byBlbnN1cmUgYXRvbWljIHJlYWRcblx0XHRpZiAoc291cmNlUHJvdmlkZXIgPT09IHRhcmdldFByb3ZpZGVyICYmIGhhc0ZpbGVGb2xkZXJDb3B5Q2FwYWJpbGl0eShzb3VyY2VQcm92aWRlcikpIHtcblx0XHRcdHJldHVybiB0aGlzLndyaXRlUXVldWUucXVldWVGb3Ioc291cmNlLCAoKSA9PiBzb3VyY2VQcm92aWRlci5jb3B5KHNvdXJjZSwgdGFyZ2V0LCB7IG92ZXJ3cml0ZTogdHJ1ZSB9KSwgdGhpcy5nZXRFeHRVcmkoc291cmNlUHJvdmlkZXIpLnByb3ZpZGVyRXh0VXJpKTtcblx0XHR9XG5cblx0XHQvLyBvdGhlcndpc2UgY29weSB2aWEgYnVmZmVyL3VuYnVmZmVyZWQgYW5kIHVzZSBhIHdyaXRlIHF1ZXVlXG5cdFx0Ly8gb24gdGhlIHNvdXJjZSB0byBlbnN1cmUgYXRvbWljIG9wZXJhdGlvbiBhcyBtdWNoIGFzIHBvc3NpYmxlXG5cdFx0cmV0dXJuIHRoaXMud3JpdGVRdWV1ZS5xdWV1ZUZvcihzb3VyY2UsICgpID0+IHRoaXMuZG9Db3B5RmlsZShzb3VyY2VQcm92aWRlciwgc291cmNlLCB0YXJnZXRQcm92aWRlciwgdGFyZ2V0KSwgdGhpcy5nZXRFeHRVcmkoc291cmNlUHJvdmlkZXIpLnByb3ZpZGVyRXh0VXJpKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBGaWxlIFdhdGNoaW5nXG5cblx0cHJpdmF0ZSByZWFkb25seSBpbnRlcm5hbE9uRGlkRmlsZXNDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxGaWxlQ2hhbmdlc0V2ZW50PigpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFVuY29ycmVsYXRlZEZpbGVzQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8RmlsZUNoYW5nZXNFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRmlsZXNDaGFuZ2UgPSB0aGlzLl9vbkRpZFVuY29ycmVsYXRlZEZpbGVzQ2hhbmdlLmV2ZW50OyAvLyBnbG9iYWwgYG9uRGlkRmlsZXNDaGFuZ2VgIHNraXBzIGNvcnJlbGF0ZWQgZXZlbnRzXG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRXYXRjaEVycm9yID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8RXJyb3I+KCkpO1xuXHRyZWFkb25seSBvbkRpZFdhdGNoRXJyb3IgPSB0aGlzLl9vbkRpZFdhdGNoRXJyb3IuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBhY3RpdmVXYXRjaGVycyA9IG5ldyBNYXA8bnVtYmVyIC8qIHdhdGNoIHJlcXVlc3QgaGFzaCAqLywgeyBkaXNwb3NhYmxlOiBJRGlzcG9zYWJsZTsgY291bnQ6IG51bWJlciB9PigpO1xuXG5cdHByaXZhdGUgc3RhdGljIFdBVENIRVJfQ09SUkVMQVRJT05fSURTID0gMDtcblxuXHRjcmVhdGVXYXRjaGVyKHJlc291cmNlOiBVUkksIG9wdGlvbnM6IElXYXRjaE9wdGlvbnNXaXRob3V0Q29ycmVsYXRpb24gJiB7IHJlY3Vyc2l2ZTogZmFsc2UgfSk6IElGaWxlU3lzdGVtV2F0Y2hlciB7XG5cdFx0cmV0dXJuIHRoaXMud2F0Y2gocmVzb3VyY2UsIHtcblx0XHRcdC4uLm9wdGlvbnMsXG5cdFx0XHQvLyBFeHBsaWNpdGx5IHNldCBhIGNvcnJlbGF0aW9uIGlkIHNvIHRoYXQgZmlsZSBldmVudHMgdGhhdCBvcmlnaW5hdGVcblx0XHRcdC8vIGZyb20gcmVxdWVzdHMgZnJvbSBleHRlbnNpb25zIGFyZSBleGNsdXNpdmVseSByb3V0ZWQgYmFjayB0byB0aGVcblx0XHRcdC8vIGV4dGVuc2lvbiBob3N0IGFuZCBub3QgaW50byB0aGUgd29ya2JlbmNoLlxuXHRcdFx0Y29ycmVsYXRpb25JZDogRmlsZVNlcnZpY2UuV0FUQ0hFUl9DT1JSRUxBVElPTl9JRFMrK1xuXHRcdH0pO1xuXHR9XG5cblx0d2F0Y2gocmVzb3VyY2U6IFVSSSwgb3B0aW9uczogSVdhdGNoT3B0aW9uc1dpdGhDb3JyZWxhdGlvbik6IElGaWxlU3lzdGVtV2F0Y2hlcjtcblx0d2F0Y2gocmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IElXYXRjaE9wdGlvbnNXaXRob3V0Q29ycmVsYXRpb24pOiBJRGlzcG9zYWJsZTtcblx0d2F0Y2gocmVzb3VyY2U6IFVSSSwgb3B0aW9uczogSVdhdGNoT3B0aW9ucyA9IHsgcmVjdXJzaXZlOiBmYWxzZSwgZXhjbHVkZXM6IFtdIH0pOiBJRmlsZVN5c3RlbVdhdGNoZXIgfCBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHQvLyBGb3J3YXJkIHdhdGNoIHJlcXVlc3QgdG8gcHJvdmlkZXIgYW5kIHdpcmUgaW4gZGlzcG9zYWJsZXNcblx0XHRsZXQgd2F0Y2hEaXNwb3NlZCA9IGZhbHNlO1xuXHRcdGxldCBkaXNwb3NlV2F0Y2ggPSAoKSA9PiB7IHdhdGNoRGlzcG9zZWQgPSB0cnVlOyB9O1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gZGlzcG9zZVdhdGNoKCkpKTtcblxuXHRcdC8vIFdhdGNoIGFuZCB3aXJlIGluIGRpc3Bvc2FibGUgd2hpY2ggaXMgYXN5bmMgYnV0XG5cdFx0Ly8gY2hlY2sgaWYgd2UgZ290IGRpc3Bvc2VkIG1lYW53aGlsZSBhbmQgZm9yd2FyZFxuXHRcdChhc3luYyAoKSA9PiB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBkaXNwb3NhYmxlID0gYXdhaXQgdGhpcy5kb1dhdGNoKHJlc291cmNlLCBvcHRpb25zKTtcblx0XHRcdFx0aWYgKHdhdGNoRGlzcG9zZWQpIHtcblx0XHRcdFx0XHRkaXNwb3NlKGRpc3Bvc2FibGUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGRpc3Bvc2VXYXRjaCA9ICgpID0+IGRpc3Bvc2UoZGlzcG9zYWJsZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0XHR9XG5cdFx0fSkoKTtcblxuXHRcdC8vIFdoZW4gYSBjb3JyZWxhdGlvbiBpZGVudGlmaWVyIGlzIHNldCwgcmV0dXJuIGEgc3BlY2lmaWNcblx0XHQvLyB3YXRjaGVyIHRoYXQgb25seSBlbWl0cyBldmVudHMgbWF0Y2hpbmcgdGhhdCBjb3JyZWFsYXRpb24uXG5cdFx0Y29uc3QgY29ycmVsYXRpb25JZCA9IG9wdGlvbnMuY29ycmVsYXRpb25JZDtcblx0XHRpZiAodHlwZW9mIGNvcnJlbGF0aW9uSWQgPT09ICdudW1iZXInKSB7XG5cdFx0XHRjb25zdCBmaWxlQ2hhbmdlRW1pdHRlciA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRW1pdHRlcjxGaWxlQ2hhbmdlc0V2ZW50PigpKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLmludGVybmFsT25EaWRGaWxlc0NoYW5nZS5ldmVudChlID0+IHtcblx0XHRcdFx0aWYgKGUuY29ycmVsYXRlcyhjb3JyZWxhdGlvbklkKSkge1xuXHRcdFx0XHRcdGZpbGVDaGFuZ2VFbWl0dGVyLmZpcmUoZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0Y29uc3Qgd2F0Y2hlcjogSUZpbGVTeXN0ZW1XYXRjaGVyID0ge1xuXHRcdFx0XHRvbkRpZENoYW5nZTogZmlsZUNoYW5nZUVtaXR0ZXIuZXZlbnQsXG5cdFx0XHRcdGRpc3Bvc2U6ICgpID0+IGRpc3Bvc2FibGVzLmRpc3Bvc2UoKVxuXHRcdFx0fTtcblxuXHRcdFx0cmV0dXJuIHdhdGNoZXI7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGRpc3Bvc2FibGVzO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1dhdGNoKHJlc291cmNlOiBVUkksIG9wdGlvbnM6IElXYXRjaE9wdGlvbnMpOiBQcm9taXNlPElEaXNwb3NhYmxlPiB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBhd2FpdCB0aGlzLndpdGhQcm92aWRlcihyZXNvdXJjZSk7XG5cblx0XHQvLyBEZWR1cGxpY2F0ZSBpZGVudGljYWwgd2F0Y2ggcmVxdWVzdHNcblx0XHRjb25zdCB3YXRjaEhhc2ggPSBoYXNoKFt0aGlzLmdldEV4dFVyaShwcm92aWRlcikucHJvdmlkZXJFeHRVcmkuZ2V0Q29tcGFyaXNvbktleShyZXNvdXJjZSksIG9wdGlvbnNdKTtcblx0XHRsZXQgd2F0Y2hlciA9IHRoaXMuYWN0aXZlV2F0Y2hlcnMuZ2V0KHdhdGNoSGFzaCk7XG5cdFx0aWYgKCF3YXRjaGVyKSB7XG5cdFx0XHR3YXRjaGVyID0ge1xuXHRcdFx0XHRjb3VudDogMCxcblx0XHRcdFx0ZGlzcG9zYWJsZTogcHJvdmlkZXIud2F0Y2gocmVzb3VyY2UsIG9wdGlvbnMpXG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLmFjdGl2ZVdhdGNoZXJzLnNldCh3YXRjaEhhc2gsIHdhdGNoZXIpO1xuXHRcdH1cblxuXHRcdC8vIEluY3JlbWVudCB1c2FnZSBjb3VudGVyXG5cdFx0d2F0Y2hlci5jb3VudCArPSAxO1xuXG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRpZiAod2F0Y2hlcikge1xuXG5cdFx0XHRcdC8vIFVucmVmXG5cdFx0XHRcdHdhdGNoZXIuY291bnQtLTtcblxuXHRcdFx0XHQvLyBEaXNwb3NlIG9ubHkgd2hlbiBsYXN0IHVzZXIgaXMgcmVhY2hlZFxuXHRcdFx0XHRpZiAod2F0Y2hlci5jb3VudCA9PT0gMCkge1xuXHRcdFx0XHRcdGRpc3Bvc2Uod2F0Y2hlci5kaXNwb3NhYmxlKTtcblx0XHRcdFx0XHR0aGlzLmFjdGl2ZVdhdGNoZXJzLmRlbGV0ZSh3YXRjaEhhc2gpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblxuXHRcdGZvciAoY29uc3QgWywgd2F0Y2hlcl0gb2YgdGhpcy5hY3RpdmVXYXRjaGVycykge1xuXHRcdFx0ZGlzcG9zZSh3YXRjaGVyLmRpc3Bvc2FibGUpO1xuXHRcdH1cblxuXHRcdHRoaXMuYWN0aXZlV2F0Y2hlcnMuY2xlYXIoKTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBIZWxwZXJzXG5cblx0cHJpdmF0ZSByZWFkb25seSB3cml0ZVF1ZXVlID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJlc291cmNlUXVldWUoKSk7XG5cblx0cHJpdmF0ZSBhc3luYyBkb1dyaXRlQnVmZmVyZWQocHJvdmlkZXI6IElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoT3BlblJlYWRXcml0ZUNsb3NlQ2FwYWJpbGl0eSwgcmVzb3VyY2U6IFVSSSwgb3B0aW9uczogSVdyaXRlRmlsZU9wdGlvbnMgfCB1bmRlZmluZWQsIHJlYWRhYmxlT3JTdHJlYW1PckJ1ZmZlcmVkU3RyZWFtOiBWU0J1ZmZlclJlYWRhYmxlIHwgVlNCdWZmZXJSZWFkYWJsZVN0cmVhbSB8IFZTQnVmZmVyUmVhZGFibGVCdWZmZXJlZFN0cmVhbSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLndyaXRlUXVldWUucXVldWVGb3IocmVzb3VyY2UsIGFzeW5jICgpID0+IHtcblxuXHRcdFx0Ly8gb3BlbiBoYW5kbGVcblx0XHRcdGNvbnN0IGhhbmRsZSA9IGF3YWl0IHByb3ZpZGVyLm9wZW4ocmVzb3VyY2UsIHsgY3JlYXRlOiB0cnVlLCB1bmxvY2s6IG9wdGlvbnM/LnVubG9jayA/PyBmYWxzZSB9KTtcblxuXHRcdFx0Ly8gd3JpdGUgaW50byBoYW5kbGUgdW50aWwgYWxsIGJ5dGVzIGZyb20gYnVmZmVyIGhhdmUgYmVlbiB3cml0dGVuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRpZiAoaXNSZWFkYWJsZVN0cmVhbShyZWFkYWJsZU9yU3RyZWFtT3JCdWZmZXJlZFN0cmVhbSkgfHwgaXNSZWFkYWJsZUJ1ZmZlcmVkU3RyZWFtKHJlYWRhYmxlT3JTdHJlYW1PckJ1ZmZlcmVkU3RyZWFtKSkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuZG9Xcml0ZVN0cmVhbUJ1ZmZlcmVkUXVldWVkKHByb3ZpZGVyLCBoYW5kbGUsIHJlYWRhYmxlT3JTdHJlYW1PckJ1ZmZlcmVkU3RyZWFtKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmRvV3JpdGVSZWFkYWJsZUJ1ZmZlcmVkUXVldWVkKHByb3ZpZGVyLCBoYW5kbGUsIHJlYWRhYmxlT3JTdHJlYW1PckJ1ZmZlcmVkU3RyZWFtKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhyb3cgZW5zdXJlRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3IoZXJyb3IpO1xuXHRcdFx0fSBmaW5hbGx5IHtcblxuXHRcdFx0XHQvLyBjbG9zZSBoYW5kbGUgYWx3YXlzXG5cdFx0XHRcdGF3YWl0IHByb3ZpZGVyLmNsb3NlKGhhbmRsZSk7XG5cdFx0XHR9XG5cdFx0fSwgdGhpcy5nZXRFeHRVcmkocHJvdmlkZXIpLnByb3ZpZGVyRXh0VXJpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9Xcml0ZVN0cmVhbUJ1ZmZlcmVkUXVldWVkKHByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aE9wZW5SZWFkV3JpdGVDbG9zZUNhcGFiaWxpdHksIGhhbmRsZTogbnVtYmVyLCBzdHJlYW1PckJ1ZmZlcmVkU3RyZWFtOiBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtIHwgVlNCdWZmZXJSZWFkYWJsZUJ1ZmZlcmVkU3RyZWFtKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0bGV0IHBvc0luRmlsZSA9IDA7XG5cdFx0bGV0IHN0cmVhbTogVlNCdWZmZXJSZWFkYWJsZVN0cmVhbTtcblxuXHRcdC8vIEJ1ZmZlcmVkIHN0cmVhbTogY29uc3VtZSB0aGUgYnVmZmVyIGZpcnN0IGJ5IHdyaXRpbmdcblx0XHQvLyBpdCB0byB0aGUgdGFyZ2V0IGJlZm9yZSByZWFkaW5nIGZyb20gdGhlIHN0cmVhbS5cblx0XHRpZiAoaXNSZWFkYWJsZUJ1ZmZlcmVkU3RyZWFtKHN0cmVhbU9yQnVmZmVyZWRTdHJlYW0pKSB7XG5cdFx0XHRpZiAoc3RyZWFtT3JCdWZmZXJlZFN0cmVhbS5idWZmZXIubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRjb25zdCBjaHVuayA9IFZTQnVmZmVyLmNvbmNhdChzdHJlYW1PckJ1ZmZlcmVkU3RyZWFtLmJ1ZmZlcik7XG5cdFx0XHRcdGF3YWl0IHRoaXMuZG9Xcml0ZUJ1ZmZlcihwcm92aWRlciwgaGFuZGxlLCBjaHVuaywgY2h1bmsuYnl0ZUxlbmd0aCwgcG9zSW5GaWxlLCAwKTtcblxuXHRcdFx0XHRwb3NJbkZpbGUgKz0gY2h1bmsuYnl0ZUxlbmd0aDtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSWYgdGhlIHN0cmVhbSBoYXMgYmVlbiBjb25zdW1lZCwgcmV0dXJuIGVhcmx5XG5cdFx0XHRpZiAoc3RyZWFtT3JCdWZmZXJlZFN0cmVhbS5lbmRlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHN0cmVhbSA9IHN0cmVhbU9yQnVmZmVyZWRTdHJlYW0uc3RyZWFtO1xuXHRcdH1cblxuXHRcdC8vIFVuYnVmZmVyZWQgc3RyZWFtIC0ganVzdCB0YWtlIGFzIGlzXG5cdFx0ZWxzZSB7XG5cdFx0XHRzdHJlYW0gPSBzdHJlYW1PckJ1ZmZlcmVkU3RyZWFtO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRsaXN0ZW5TdHJlYW0oc3RyZWFtLCB7XG5cdFx0XHRcdG9uRGF0YTogYXN5bmMgY2h1bmsgPT4ge1xuXG5cdFx0XHRcdFx0Ly8gcGF1c2Ugc3RyZWFtIHRvIHBlcmZvcm0gYXN5bmMgd3JpdGUgb3BlcmF0aW9uXG5cdFx0XHRcdFx0c3RyZWFtLnBhdXNlKCk7XG5cblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5kb1dyaXRlQnVmZmVyKHByb3ZpZGVyLCBoYW5kbGUsIGNodW5rLCBjaHVuay5ieXRlTGVuZ3RoLCBwb3NJbkZpbGUsIDApO1xuXHRcdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcmVqZWN0KGVycm9yKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRwb3NJbkZpbGUgKz0gY2h1bmsuYnl0ZUxlbmd0aDtcblxuXHRcdFx0XHRcdC8vIHJlc3VtZSBzdHJlYW0gbm93IHRoYXQgd2UgaGF2ZSBzdWNjZXNzZnVsbHkgd3JpdHRlblxuXHRcdFx0XHRcdC8vIHJ1biB0aGlzIG9uIHRoZSBuZXh0IHRpY2sgdG8gcHJldmVudCBpbmNyZWFzaW5nIHRoZVxuXHRcdFx0XHRcdC8vIGV4ZWN1dGlvbiBzdGFjayBiZWNhdXNlIHJlc3VtZSgpIG1heSBjYWxsIHRoZSBldmVudFxuXHRcdFx0XHRcdC8vIGhhbmRsZXIgYWdhaW4gYmVmb3JlIGZpbmlzaGluZy5cblx0XHRcdFx0XHRzZXRUaW1lb3V0KCgpID0+IHN0cmVhbS5yZXN1bWUoKSk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdG9uRXJyb3I6IGVycm9yID0+IHJlamVjdChlcnJvciksXG5cdFx0XHRcdG9uRW5kOiAoKSA9PiByZXNvbHZlKClcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1dyaXRlUmVhZGFibGVCdWZmZXJlZFF1ZXVlZChwcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhPcGVuUmVhZFdyaXRlQ2xvc2VDYXBhYmlsaXR5LCBoYW5kbGU6IG51bWJlciwgcmVhZGFibGU6IFZTQnVmZmVyUmVhZGFibGUpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRsZXQgcG9zSW5GaWxlID0gMDtcblxuXHRcdGxldCBjaHVuazogVlNCdWZmZXIgfCBudWxsO1xuXHRcdHdoaWxlICgoY2h1bmsgPSByZWFkYWJsZS5yZWFkKCkpICE9PSBudWxsKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmRvV3JpdGVCdWZmZXIocHJvdmlkZXIsIGhhbmRsZSwgY2h1bmssIGNodW5rLmJ5dGVMZW5ndGgsIHBvc0luRmlsZSwgMCk7XG5cblx0XHRcdHBvc0luRmlsZSArPSBjaHVuay5ieXRlTGVuZ3RoO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9Xcml0ZUJ1ZmZlcihwcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhPcGVuUmVhZFdyaXRlQ2xvc2VDYXBhYmlsaXR5LCBoYW5kbGU6IG51bWJlciwgYnVmZmVyOiBWU0J1ZmZlciwgbGVuZ3RoOiBudW1iZXIsIHBvc0luRmlsZTogbnVtYmVyLCBwb3NJbkJ1ZmZlcjogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0bGV0IHRvdGFsQnl0ZXNXcml0dGVuID0gMDtcblx0XHR3aGlsZSAodG90YWxCeXRlc1dyaXR0ZW4gPCBsZW5ndGgpIHtcblxuXHRcdFx0Ly8gV3JpdGUgdGhyb3VnaCB0aGUgcHJvdmlkZXJcblx0XHRcdGNvbnN0IGJ5dGVzV3JpdHRlbiA9IGF3YWl0IHByb3ZpZGVyLndyaXRlKGhhbmRsZSwgcG9zSW5GaWxlICsgdG90YWxCeXRlc1dyaXR0ZW4sIGJ1ZmZlci5idWZmZXIsIHBvc0luQnVmZmVyICsgdG90YWxCeXRlc1dyaXR0ZW4sIGxlbmd0aCAtIHRvdGFsQnl0ZXNXcml0dGVuKTtcblx0XHRcdHRvdGFsQnl0ZXNXcml0dGVuICs9IGJ5dGVzV3JpdHRlbjtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvV3JpdGVVbmJ1ZmZlcmVkKHByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVSZWFkV3JpdGVDYXBhYmlsaXR5LCByZXNvdXJjZTogVVJJLCBvcHRpb25zOiBJV3JpdGVGaWxlT3B0aW9ucyB8IHVuZGVmaW5lZCwgYnVmZmVyT3JSZWFkYWJsZU9yU3RyZWFtT3JCdWZmZXJlZFN0cmVhbTogVlNCdWZmZXIgfCBWU0J1ZmZlclJlYWRhYmxlIHwgVlNCdWZmZXJSZWFkYWJsZVN0cmVhbSB8IFZTQnVmZmVyUmVhZGFibGVCdWZmZXJlZFN0cmVhbSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLndyaXRlUXVldWUucXVldWVGb3IocmVzb3VyY2UsICgpID0+IHRoaXMuZG9Xcml0ZVVuYnVmZmVyZWRRdWV1ZWQocHJvdmlkZXIsIHJlc291cmNlLCBvcHRpb25zLCBidWZmZXJPclJlYWRhYmxlT3JTdHJlYW1PckJ1ZmZlcmVkU3RyZWFtKSwgdGhpcy5nZXRFeHRVcmkocHJvdmlkZXIpLnByb3ZpZGVyRXh0VXJpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9Xcml0ZVVuYnVmZmVyZWRRdWV1ZWQocHJvdmlkZXI6IElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZVJlYWRXcml0ZUNhcGFiaWxpdHksIHJlc291cmNlOiBVUkksIG9wdGlvbnM6IElXcml0ZUZpbGVPcHRpb25zIHwgdW5kZWZpbmVkLCBidWZmZXJPclJlYWRhYmxlT3JTdHJlYW1PckJ1ZmZlcmVkU3RyZWFtOiBWU0J1ZmZlciB8IFZTQnVmZmVyUmVhZGFibGUgfCBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtIHwgVlNCdWZmZXJSZWFkYWJsZUJ1ZmZlcmVkU3RyZWFtKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0bGV0IGJ1ZmZlcjogVlNCdWZmZXI7XG5cdFx0aWYgKGJ1ZmZlck9yUmVhZGFibGVPclN0cmVhbU9yQnVmZmVyZWRTdHJlYW0gaW5zdGFuY2VvZiBWU0J1ZmZlcikge1xuXHRcdFx0YnVmZmVyID0gYnVmZmVyT3JSZWFkYWJsZU9yU3RyZWFtT3JCdWZmZXJlZFN0cmVhbTtcblx0XHR9IGVsc2UgaWYgKGlzUmVhZGFibGVTdHJlYW0oYnVmZmVyT3JSZWFkYWJsZU9yU3RyZWFtT3JCdWZmZXJlZFN0cmVhbSkpIHtcblx0XHRcdGJ1ZmZlciA9IGF3YWl0IHN0cmVhbVRvQnVmZmVyKGJ1ZmZlck9yUmVhZGFibGVPclN0cmVhbU9yQnVmZmVyZWRTdHJlYW0pO1xuXHRcdH0gZWxzZSBpZiAoaXNSZWFkYWJsZUJ1ZmZlcmVkU3RyZWFtKGJ1ZmZlck9yUmVhZGFibGVPclN0cmVhbU9yQnVmZmVyZWRTdHJlYW0pKSB7XG5cdFx0XHRidWZmZXIgPSBhd2FpdCBidWZmZXJlZFN0cmVhbVRvQnVmZmVyKGJ1ZmZlck9yUmVhZGFibGVPclN0cmVhbU9yQnVmZmVyZWRTdHJlYW0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRidWZmZXIgPSByZWFkYWJsZVRvQnVmZmVyKGJ1ZmZlck9yUmVhZGFibGVPclN0cmVhbU9yQnVmZmVyZWRTdHJlYW0pO1xuXHRcdH1cblxuXHRcdC8vIFdyaXRlIHRocm91Z2ggdGhlIHByb3ZpZGVyXG5cdFx0YXdhaXQgcHJvdmlkZXIud3JpdGVGaWxlKHJlc291cmNlLCBidWZmZXIuYnVmZmVyLCB7IGNyZWF0ZTogdHJ1ZSwgb3ZlcndyaXRlOiB0cnVlLCB1bmxvY2s6IG9wdGlvbnM/LnVubG9jayA/PyBmYWxzZSwgYXRvbWljOiBvcHRpb25zPy5hdG9taWMgPz8gZmFsc2UgfSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvUGlwZUJ1ZmZlcmVkKHNvdXJjZVByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aE9wZW5SZWFkV3JpdGVDbG9zZUNhcGFiaWxpdHksIHNvdXJjZTogVVJJLCB0YXJnZXRQcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhPcGVuUmVhZFdyaXRlQ2xvc2VDYXBhYmlsaXR5LCB0YXJnZXQ6IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLndyaXRlUXVldWUucXVldWVGb3IodGFyZ2V0LCAoKSA9PiB0aGlzLmRvUGlwZUJ1ZmZlcmVkUXVldWVkKHNvdXJjZVByb3ZpZGVyLCBzb3VyY2UsIHRhcmdldFByb3ZpZGVyLCB0YXJnZXQpLCB0aGlzLmdldEV4dFVyaSh0YXJnZXRQcm92aWRlcikucHJvdmlkZXJFeHRVcmkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1BpcGVCdWZmZXJlZFF1ZXVlZChzb3VyY2VQcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhPcGVuUmVhZFdyaXRlQ2xvc2VDYXBhYmlsaXR5LCBzb3VyY2U6IFVSSSwgdGFyZ2V0UHJvdmlkZXI6IElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoT3BlblJlYWRXcml0ZUNsb3NlQ2FwYWJpbGl0eSwgdGFyZ2V0OiBVUkkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRsZXQgc291cmNlSGFuZGxlOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0bGV0IHRhcmdldEhhbmRsZTogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0dHJ5IHtcblxuXHRcdFx0Ly8gT3BlbiBoYW5kbGVzXG5cdFx0XHRzb3VyY2VIYW5kbGUgPSBhd2FpdCBzb3VyY2VQcm92aWRlci5vcGVuKHNvdXJjZSwgeyBjcmVhdGU6IGZhbHNlIH0pO1xuXHRcdFx0dGFyZ2V0SGFuZGxlID0gYXdhaXQgdGFyZ2V0UHJvdmlkZXIub3Blbih0YXJnZXQsIHsgY3JlYXRlOiB0cnVlLCB1bmxvY2s6IGZhbHNlIH0pO1xuXG5cdFx0XHRjb25zdCBidWZmZXIgPSBWU0J1ZmZlci5hbGxvYyh0aGlzLkJVRkZFUl9TSVpFKTtcblxuXHRcdFx0bGV0IHBvc0luRmlsZSA9IDA7XG5cdFx0XHRsZXQgcG9zSW5CdWZmZXIgPSAwO1xuXHRcdFx0bGV0IGJ5dGVzUmVhZCA9IDA7XG5cdFx0XHRkbyB7XG5cdFx0XHRcdC8vIHJlYWQgZnJvbSBzb3VyY2UgKHNvdXJjZUhhbmRsZSkgYXQgY3VycmVudCBwb3NpdGlvbiAocG9zSW5GaWxlKSBpbnRvIGJ1ZmZlciAoYnVmZmVyKSBhdFxuXHRcdFx0XHQvLyBidWZmZXIgcG9zaXRpb24gKHBvc0luQnVmZmVyKSB1cCB0byB0aGUgc2l6ZSBvZiB0aGUgYnVmZmVyIChidWZmZXIuYnl0ZUxlbmd0aCkuXG5cdFx0XHRcdGJ5dGVzUmVhZCA9IGF3YWl0IHNvdXJjZVByb3ZpZGVyLnJlYWQoc291cmNlSGFuZGxlLCBwb3NJbkZpbGUsIGJ1ZmZlci5idWZmZXIsIHBvc0luQnVmZmVyLCBidWZmZXIuYnl0ZUxlbmd0aCAtIHBvc0luQnVmZmVyKTtcblxuXHRcdFx0XHQvLyB3cml0ZSBpbnRvIHRhcmdldCAodGFyZ2V0SGFuZGxlKSBhdCBjdXJyZW50IHBvc2l0aW9uIChwb3NJbkZpbGUpIGZyb20gYnVmZmVyIChidWZmZXIpIGF0XG5cdFx0XHRcdC8vIGJ1ZmZlciBwb3NpdGlvbiAocG9zSW5CdWZmZXIpIGFsbCBieXRlcyB3ZSByZWFkIChieXRlc1JlYWQpLlxuXHRcdFx0XHRhd2FpdCB0aGlzLmRvV3JpdGVCdWZmZXIodGFyZ2V0UHJvdmlkZXIsIHRhcmdldEhhbmRsZSwgYnVmZmVyLCBieXRlc1JlYWQsIHBvc0luRmlsZSwgcG9zSW5CdWZmZXIpO1xuXG5cdFx0XHRcdHBvc0luRmlsZSArPSBieXRlc1JlYWQ7XG5cdFx0XHRcdHBvc0luQnVmZmVyICs9IGJ5dGVzUmVhZDtcblxuXHRcdFx0XHQvLyB3aGVuIGJ1ZmZlciBmdWxsLCBmaWxsIGl0IGFnYWluIGZyb20gdGhlIGJlZ2lubmluZ1xuXHRcdFx0XHRpZiAocG9zSW5CdWZmZXIgPT09IGJ1ZmZlci5ieXRlTGVuZ3RoKSB7XG5cdFx0XHRcdFx0cG9zSW5CdWZmZXIgPSAwO1xuXHRcdFx0XHR9XG5cdFx0XHR9IHdoaWxlIChieXRlc1JlYWQgPiAwKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhyb3cgZW5zdXJlRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3IoZXJyb3IpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRhd2FpdCBQcm9taXNlcy5zZXR0bGVkKFtcblx0XHRcdFx0dHlwZW9mIHNvdXJjZUhhbmRsZSA9PT0gJ251bWJlcicgPyBzb3VyY2VQcm92aWRlci5jbG9zZShzb3VyY2VIYW5kbGUpIDogUHJvbWlzZS5yZXNvbHZlKCksXG5cdFx0XHRcdHR5cGVvZiB0YXJnZXRIYW5kbGUgPT09ICdudW1iZXInID8gdGFyZ2V0UHJvdmlkZXIuY2xvc2UodGFyZ2V0SGFuZGxlKSA6IFByb21pc2UucmVzb2x2ZSgpLFxuXHRcdFx0XSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1BpcGVVbmJ1ZmZlcmVkKHNvdXJjZVByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVSZWFkV3JpdGVDYXBhYmlsaXR5LCBzb3VyY2U6IFVSSSwgdGFyZ2V0UHJvdmlkZXI6IElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZVJlYWRXcml0ZUNhcGFiaWxpdHksIHRhcmdldDogVVJJKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMud3JpdGVRdWV1ZS5xdWV1ZUZvcih0YXJnZXQsICgpID0+IHRoaXMuZG9QaXBlVW5idWZmZXJlZFF1ZXVlZChzb3VyY2VQcm92aWRlciwgc291cmNlLCB0YXJnZXRQcm92aWRlciwgdGFyZ2V0KSwgdGhpcy5nZXRFeHRVcmkodGFyZ2V0UHJvdmlkZXIpLnByb3ZpZGVyRXh0VXJpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9QaXBlVW5idWZmZXJlZFF1ZXVlZChzb3VyY2VQcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlUmVhZFdyaXRlQ2FwYWJpbGl0eSwgc291cmNlOiBVUkksIHRhcmdldFByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVSZWFkV3JpdGVDYXBhYmlsaXR5LCB0YXJnZXQ6IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0YXJnZXRQcm92aWRlci53cml0ZUZpbGUodGFyZ2V0LCBhd2FpdCBzb3VyY2VQcm92aWRlci5yZWFkRmlsZShzb3VyY2UpLCB7IGNyZWF0ZTogdHJ1ZSwgb3ZlcndyaXRlOiB0cnVlLCB1bmxvY2s6IGZhbHNlLCBhdG9taWM6IGZhbHNlIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1BpcGVVbmJ1ZmZlcmVkVG9CdWZmZXJlZChzb3VyY2VQcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlUmVhZFdyaXRlQ2FwYWJpbGl0eSwgc291cmNlOiBVUkksIHRhcmdldFByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aE9wZW5SZWFkV3JpdGVDbG9zZUNhcGFiaWxpdHksIHRhcmdldDogVVJJKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMud3JpdGVRdWV1ZS5xdWV1ZUZvcih0YXJnZXQsICgpID0+IHRoaXMuZG9QaXBlVW5idWZmZXJlZFRvQnVmZmVyZWRRdWV1ZWQoc291cmNlUHJvdmlkZXIsIHNvdXJjZSwgdGFyZ2V0UHJvdmlkZXIsIHRhcmdldCksIHRoaXMuZ2V0RXh0VXJpKHRhcmdldFByb3ZpZGVyKS5wcm92aWRlckV4dFVyaSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvUGlwZVVuYnVmZmVyZWRUb0J1ZmZlcmVkUXVldWVkKHNvdXJjZVByb3ZpZGVyOiBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVSZWFkV3JpdGVDYXBhYmlsaXR5LCBzb3VyY2U6IFVSSSwgdGFyZ2V0UHJvdmlkZXI6IElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoT3BlblJlYWRXcml0ZUNsb3NlQ2FwYWJpbGl0eSwgdGFyZ2V0OiBVUkkpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIE9wZW4gaGFuZGxlXG5cdFx0Y29uc3QgdGFyZ2V0SGFuZGxlID0gYXdhaXQgdGFyZ2V0UHJvdmlkZXIub3Blbih0YXJnZXQsIHsgY3JlYXRlOiB0cnVlLCB1bmxvY2s6IGZhbHNlIH0pO1xuXG5cdFx0Ly8gUmVhZCBlbnRpcmUgYnVmZmVyIGZyb20gc291cmNlIGFuZCB3cml0ZSBidWZmZXJlZFxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBidWZmZXIgPSBhd2FpdCBzb3VyY2VQcm92aWRlci5yZWFkRmlsZShzb3VyY2UpO1xuXHRcdFx0YXdhaXQgdGhpcy5kb1dyaXRlQnVmZmVyKHRhcmdldFByb3ZpZGVyLCB0YXJnZXRIYW5kbGUsIFZTQnVmZmVyLndyYXAoYnVmZmVyKSwgYnVmZmVyLmJ5dGVMZW5ndGgsIDAsIDApO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aHJvdyBlbnN1cmVGaWxlU3lzdGVtUHJvdmlkZXJFcnJvcihlcnJvcik7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGF3YWl0IHRhcmdldFByb3ZpZGVyLmNsb3NlKHRhcmdldEhhbmRsZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1BpcGVCdWZmZXJlZFRvVW5idWZmZXJlZChzb3VyY2VQcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhPcGVuUmVhZFdyaXRlQ2xvc2VDYXBhYmlsaXR5LCBzb3VyY2U6IFVSSSwgdGFyZ2V0UHJvdmlkZXI6IElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZVJlYWRXcml0ZUNhcGFiaWxpdHksIHRhcmdldDogVVJJKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBSZWFkIGJ1ZmZlciB2aWEgc3RyZWFtIGJ1ZmZlcmVkXG5cdFx0Y29uc3QgYnVmZmVyID0gYXdhaXQgc3RyZWFtVG9CdWZmZXIodGhpcy5yZWFkRmlsZUJ1ZmZlcmVkKHNvdXJjZVByb3ZpZGVyLCBzb3VyY2UsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKTtcblxuXHRcdC8vIFdyaXRlIGJ1ZmZlciBpbnRvIHRhcmdldCBhdCBvbmNlXG5cdFx0YXdhaXQgdGhpcy5kb1dyaXRlVW5idWZmZXJlZCh0YXJnZXRQcm92aWRlciwgdGFyZ2V0LCB1bmRlZmluZWQsIGJ1ZmZlcik7XG5cdH1cblxuXHRwcm90ZWN0ZWQgdGhyb3dJZkZpbGVTeXN0ZW1Jc1JlYWRvbmx5PFQgZXh0ZW5kcyBJRmlsZVN5c3RlbVByb3ZpZGVyPihwcm92aWRlcjogVCwgcmVzb3VyY2U6IFVSSSk6IFQge1xuXHRcdGlmIChwcm92aWRlci5jYXBhYmlsaXRpZXMgJiBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuUmVhZG9ubHkpIHtcblx0XHRcdHRocm93IG5ldyBGaWxlT3BlcmF0aW9uRXJyb3IobG9jYWxpemUoJ2Vyci5yZWFkb25seScsIFwiVW5hYmxlIHRvIG1vZGlmeSByZWFkLW9ubHkgZmlsZSAnezB9J1wiLCB0aGlzLnJlc291cmNlRm9yRXJyb3IocmVzb3VyY2UpKSwgRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX1BFUk1JU1NJT05fREVOSUVEKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcHJvdmlkZXI7XG5cdH1cblxuXHRwcml2YXRlIHRocm93SWZGaWxlSXNSZWFkb25seShyZXNvdXJjZTogVVJJLCBzdGF0OiBJU3RhdCk6IHZvaWQge1xuXHRcdGlmICgoc3RhdC5wZXJtaXNzaW9ucyA/PyAwKSAmIEZpbGVQZXJtaXNzaW9uLlJlYWRvbmx5KSB7XG5cdFx0XHR0aHJvdyBuZXcgRmlsZU9wZXJhdGlvbkVycm9yKGxvY2FsaXplKCdlcnIucmVhZG9ubHknLCBcIlVuYWJsZSB0byBtb2RpZnkgcmVhZC1vbmx5IGZpbGUgJ3swfSdcIiwgdGhpcy5yZXNvdXJjZUZvckVycm9yKHJlc291cmNlKSksIEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9QRVJNSVNTSU9OX0RFTklFRCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZXNvdXJjZUZvckVycm9yKHJlc291cmNlOiBVUkkpOiBzdHJpbmcge1xuXHRcdGlmIChyZXNvdXJjZS5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0cmV0dXJuIHJlc291cmNlLmZzUGF0aDtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzb3VyY2UudG9TdHJpbmcodHJ1ZSk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxVQUFVLHFCQUFxQjtBQUN4QyxTQUFTLHdCQUF3QixrQkFBa0IsMEJBQTBCLGtCQUFrQixnQkFBZ0IsZ0JBQTBGO0FBQ3pNLFNBQVMsbUJBQW1CLCtCQUErQjtBQUMzRCxTQUFTLGVBQWU7QUFDeEIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsWUFBWSxpQkFBaUIsU0FBc0Isb0JBQW9CO0FBQ2hGLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZUFBZTtBQUN4QixTQUFTLFlBQVk7QUFDckIsU0FBUyxRQUFRLHNCQUErQixzQkFBc0I7QUFDdEUsU0FBUyxlQUFlLDBCQUEwQixrQkFBa0IsY0FBYyxvQkFBb0IsY0FBYyxZQUFZLGlCQUFpQjtBQUVqSixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLCtCQUErQixNQUFNLGVBQWUsa0JBQXNDLGVBQWUsb0JBQW9CLG9CQUFvQixxQkFBcUIsZ0JBQWdCLGdDQUFnQyw2QkFBNkIsVUFBVSw2QkFBNkIsNkJBQTZCLDZCQUE2QixpQ0FBaUMsd0JBQWlxQixvQ0FBb0MsdUJBQXVCLCtCQUErQix3QkFBd0IsNEJBQTRCLCtCQUErQixvQ0FBdUg7QUFDbjBDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsd0JBQXdCO0FBRTFCLElBQU0sY0FBTixjQUEwQixXQUFtQztBQUFBLEVBU25FLFlBQTBDLFlBQXlCO0FBQ2xFLFVBQU07QUFEbUM7QUFGMUM7QUFBQTtBQUFB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
