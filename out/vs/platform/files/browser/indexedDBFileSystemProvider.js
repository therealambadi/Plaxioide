import { Throttler } from "../../../base/common/async.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { ExtUri } from "../../../base/common/resources.js";
import { isString } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { createFileSystemProviderError, FileChangeType, FileSystemProviderCapabilities, FileSystemProviderErrorCode, FileType } from "../common/files.js";
import { BroadcastDataChannel } from "../../../base/browser/broadcast.js";
const ERR_FILE_NOT_FOUND = createFileSystemProviderError(localize("fileNotExists", "File does not exist"), FileSystemProviderErrorCode.FileNotFound);
const ERR_FILE_IS_DIR = createFileSystemProviderError(localize("fileIsDirectory", "File is Directory"), FileSystemProviderErrorCode.FileIsADirectory);
const ERR_FILE_NOT_DIR = createFileSystemProviderError(localize("fileNotDirectory", "File is not a directory"), FileSystemProviderErrorCode.FileNotADirectory);
const ERR_DIR_NOT_EMPTY = createFileSystemProviderError(localize("dirIsNotEmpty", "Directory is not empty"), FileSystemProviderErrorCode.Unknown);
const ERR_FILE_EXCEEDS_STORAGE_QUOTA = createFileSystemProviderError(localize("fileExceedsStorageQuota", "File exceeds available storage quota"), FileSystemProviderErrorCode.FileExceedsStorageQuota);
const ERR_UNKNOWN_INTERNAL = (message) => createFileSystemProviderError(localize("internal", "Internal error occurred in IndexedDB File System Provider. ({0})", message), FileSystemProviderErrorCode.Unknown);
class IndexedDBFileSystemNode {
  constructor(entry) {
    this.entry = entry;
    this.type = entry.type;
  }
  read(path) {
    return this.doRead(path.split("/").filter((p) => p.length));
  }
  doRead(pathParts) {
    if (pathParts.length === 0) {
      return this.entry;
    }
    if (this.entry.type !== FileType.Directory) {
      throw ERR_UNKNOWN_INTERNAL("Internal error reading from IndexedDBFSNode -- expected directory at " + this.entry.path);
    }
    const next = this.entry.children.get(pathParts[0]);
    if (!next) {
      return void 0;
    }
    return next.doRead(pathParts.slice(1));
  }
  delete(path) {
    const toDelete = path.split("/").filter((p) => p.length);
    if (toDelete.length === 0) {
      if (this.entry.type !== FileType.Directory) {
        throw ERR_UNKNOWN_INTERNAL(`Internal error deleting from IndexedDBFSNode. Expected root entry to be directory`);
      }
      this.entry.children.clear();
    } else {
      return this.doDelete(toDelete, path);
    }
  }
  doDelete(pathParts, originalPath) {
    if (pathParts.length === 0) {
      throw ERR_UNKNOWN_INTERNAL(`Internal error deleting from IndexedDBFSNode -- got no deletion path parts (encountered while deleting ${originalPath})`);
    } else if (this.entry.type !== FileType.Directory) {
      throw ERR_UNKNOWN_INTERNAL("Internal error deleting from IndexedDBFSNode -- expected directory at " + this.entry.path);
    } else if (pathParts.length === 1) {
      this.entry.children.delete(pathParts[0]);
    } else {
      const next = this.entry.children.get(pathParts[0]);
      if (!next) {
        throw ERR_UNKNOWN_INTERNAL("Internal error deleting from IndexedDBFSNode -- expected entry at " + this.entry.path + "/" + next);
      }
      next.doDelete(pathParts.slice(1), originalPath);
    }
  }
  add(path, entry) {
    this.doAdd(path.split("/").filter((p) => p.length), entry, path);
  }
  doAdd(pathParts, entry, originalPath) {
    if (pathParts.length === 0) {
      throw ERR_UNKNOWN_INTERNAL(`Internal error creating IndexedDBFSNode -- adding empty path (encountered while adding ${originalPath})`);
    } else if (this.entry.type !== FileType.Directory) {
      throw ERR_UNKNOWN_INTERNAL(`Internal error creating IndexedDBFSNode -- parent is not a directory (encountered while adding ${originalPath})`);
    } else if (pathParts.length === 1) {
      const next = pathParts[0];
      const existing = this.entry.children.get(next);
      if (entry.type === "dir") {
        if (existing?.entry.type === FileType.File) {
          throw ERR_UNKNOWN_INTERNAL(`Internal error creating IndexedDBFSNode -- overwriting file with directory: ${this.entry.path}/${next} (encountered while adding ${originalPath})`);
        }
        this.entry.children.set(next, existing ?? new IndexedDBFileSystemNode({
          type: FileType.Directory,
          path: this.entry.path + "/" + next,
          children: /* @__PURE__ */ new Map()
        }));
      } else {
        if (existing?.entry.type === FileType.Directory) {
          throw ERR_UNKNOWN_INTERNAL(`Internal error creating IndexedDBFSNode -- overwriting directory with file: ${this.entry.path}/${next} (encountered while adding ${originalPath})`);
        }
        this.entry.children.set(next, new IndexedDBFileSystemNode({
          type: FileType.File,
          path: this.entry.path + "/" + next,
          size: entry.size
        }));
      }
    } else if (pathParts.length > 1) {
      const next = pathParts[0];
      let childNode = this.entry.children.get(next);
      if (!childNode) {
        childNode = new IndexedDBFileSystemNode({
          children: /* @__PURE__ */ new Map(),
          path: this.entry.path + "/" + next,
          type: FileType.Directory
        });
        this.entry.children.set(next, childNode);
      } else if (childNode.type === FileType.File) {
        throw ERR_UNKNOWN_INTERNAL(`Internal error creating IndexedDBFSNode -- overwriting file entry with directory: ${this.entry.path}/${next} (encountered while adding ${originalPath})`);
      }
      childNode.doAdd(pathParts.slice(1), entry, originalPath);
    }
  }
  print(indentation = "") {
    console.log(indentation + this.entry.path);
    if (this.entry.type === FileType.Directory) {
      this.entry.children.forEach((child) => child.print(indentation + " "));
    }
  }
}
class IndexedDBFileSystemProvider extends Disposable {
  constructor(scheme, indexedDB, store, watchCrossWindowChanges) {
    super();
    this.scheme = scheme;
    this.indexedDB = indexedDB;
    this.store = store;
    this.capabilities = FileSystemProviderCapabilities.FileReadWrite | FileSystemProviderCapabilities.PathCaseSensitive;
    this.onDidChangeCapabilities = Event.None;
    this.extUri = new ExtUri(() => false);
    this._onDidChangeFile = this._register(new Emitter());
    this.onDidChangeFile = this._onDidChangeFile.event;
    this.mtimes = /* @__PURE__ */ new Map();
    this.fileWriteBatch = [];
    this.writeManyThrottler = new Throttler();
    if (watchCrossWindowChanges) {
      this.changesBroadcastChannel = this._register(new BroadcastDataChannel(`vscode.indexedDB.${scheme}.changes`));
      this._register(this.changesBroadcastChannel.onDidReceiveData((changes) => {
        this._onDidChangeFile.fire(changes.map((c) => ({ type: c.type, resource: URI.revive(c.resource) })));
      }));
    }
  }
  watch(resource, opts) {
    return Disposable.None;
  }
  async mkdir(resource) {
    try {
      const resourceStat = await this.stat(resource);
      if (resourceStat.type === FileType.File) {
        throw ERR_FILE_NOT_DIR;
      }
    } catch (error) {
    }
    (await this.getFiletree()).add(resource.path, { type: "dir" });
  }
  async stat(resource) {
    const entry = (await this.getFiletree()).read(resource.path);
    if (entry?.type === FileType.File) {
      return {
        type: FileType.File,
        ctime: 0,
        mtime: this.mtimes.get(resource.toString()) || 0,
        size: entry.size ?? (await this.readFile(resource)).byteLength
      };
    }
    if (entry?.type === FileType.Directory) {
      return {
        type: FileType.Directory,
        ctime: 0,
        mtime: 0,
        size: 0
      };
    }
    throw ERR_FILE_NOT_FOUND;
  }
  async readdir(resource) {
    try {
      const entry = (await this.getFiletree()).read(resource.path);
      if (!entry) {
        return [];
      }
      if (entry.type !== FileType.Directory) {
        throw ERR_FILE_NOT_DIR;
      } else {
        return [...entry.children.entries()].map(([name, node]) => [name, node.type]);
      }
    } catch (error) {
      throw error;
    }
  }
  async readFile(resource) {
    try {
      const result = await this.indexedDB.runInTransaction(this.store, "readonly", (objectStore) => objectStore.get(resource.path));
      if (result === void 0) {
        throw ERR_FILE_NOT_FOUND;
      }
      const buffer = result instanceof Uint8Array ? result : isString(result) ? VSBuffer.fromString(result).buffer : void 0;
      if (buffer === void 0) {
        throw ERR_UNKNOWN_INTERNAL(`IndexedDB entry at "${resource.path}" in unexpected format`);
      }
      const fileTree = await this.getFiletree();
      fileTree.add(resource.path, { type: "file", size: buffer.byteLength });
      return buffer;
    } catch (error) {
      throw error;
    }
  }
  async writeFile(resource, content, opts) {
    try {
      const existing = await this.stat(resource).catch(() => void 0);
      if (existing?.type === FileType.Directory) {
        throw ERR_FILE_IS_DIR;
      }
      await this.bulkWrite([[resource, content]]);
    } catch (error) {
      throw error;
    }
  }
  async rename(from, to, opts) {
    const fileTree = await this.getFiletree();
    const fromEntry = fileTree.read(from.path);
    if (!fromEntry) {
      throw ERR_FILE_NOT_FOUND;
    }
    const toEntry = fileTree.read(to.path);
    if (toEntry) {
      if (!opts.overwrite) {
        throw createFileSystemProviderError("file exists already", FileSystemProviderErrorCode.FileExists);
      }
      if (toEntry.type !== fromEntry.type) {
        throw createFileSystemProviderError("Cannot rename files with different types", FileSystemProviderErrorCode.Unknown);
      }
      await this.delete(to, { recursive: true, useTrash: false, atomic: false });
    }
    const toTargetResource = (path) => this.extUri.joinPath(to, this.extUri.relativePath(from, from.with({ path })) || "");
    const sourceEntries = await this.tree(from);
    const sourceFiles = [];
    for (const sourceEntry of sourceEntries) {
      if (sourceEntry[1] === FileType.File) {
        sourceFiles.push(sourceEntry);
      } else if (sourceEntry[1] === FileType.Directory) {
        fileTree.add(toTargetResource(sourceEntry[0]).path, { type: "dir" });
      }
    }
    if (sourceFiles.length) {
      const targetFiles = [];
      const sourceFilesContents = await this.indexedDB.runInTransaction(this.store, "readonly", (objectStore) => sourceFiles.map(([path]) => objectStore.get(path)));
      for (let index = 0; index < sourceFiles.length; index++) {
        const content = sourceFilesContents[index] instanceof Uint8Array ? sourceFilesContents[index] : isString(sourceFilesContents[index]) ? VSBuffer.fromString(sourceFilesContents[index]).buffer : void 0;
        if (content) {
          targetFiles.push([toTargetResource(sourceFiles[index][0]), content]);
        }
      }
      await this.bulkWrite(targetFiles);
    }
    await this.delete(from, { recursive: true, useTrash: false, atomic: false });
  }
  async delete(resource, opts) {
    let stat;
    try {
      stat = await this.stat(resource);
    } catch (e) {
      if (e.code === FileSystemProviderErrorCode.FileNotFound) {
        return;
      }
      throw e;
    }
    let toDelete;
    if (opts.recursive) {
      const tree = await this.tree(resource);
      toDelete = tree.map(([path]) => path);
    } else {
      if (stat.type === FileType.Directory && (await this.readdir(resource)).length) {
        throw ERR_DIR_NOT_EMPTY;
      }
      toDelete = [resource.path];
    }
    await this.deleteKeys(toDelete);
    (await this.getFiletree()).delete(resource.path);
    toDelete.forEach((key) => this.mtimes.delete(key));
    this.triggerChanges(toDelete.map((path) => ({ resource: resource.with({ path }), type: FileChangeType.DELETED })));
  }
  async tree(resource) {
    const stat = await this.stat(resource);
    const allEntries = [[resource.path, stat.type]];
    if (stat.type === FileType.Directory) {
      const dirEntries = await this.readdir(resource);
      for (const [key, type] of dirEntries) {
        const childResource = this.extUri.joinPath(resource, key);
        allEntries.push([childResource.path, type]);
        if (type === FileType.Directory) {
          const childEntries = await this.tree(childResource);
          allEntries.push(...childEntries);
        }
      }
    }
    return allEntries;
  }
  triggerChanges(changes) {
    if (changes.length) {
      this._onDidChangeFile.fire(changes);
      this.changesBroadcastChannel?.postData(changes);
    }
  }
  getFiletree() {
    if (!this.cachedFiletree) {
      this.cachedFiletree = (async () => {
        const rootNode = new IndexedDBFileSystemNode({
          children: /* @__PURE__ */ new Map(),
          path: "",
          type: FileType.Directory
        });
        const result = await this.indexedDB.runInTransaction(this.store, "readonly", (objectStore) => objectStore.getAllKeys());
        const keys = result.map((key) => key.toString());
        keys.forEach((key) => rootNode.add(key, { type: "file" }));
        return rootNode;
      })();
    }
    return this.cachedFiletree;
  }
  async bulkWrite(files) {
    files.forEach(([resource, content]) => this.fileWriteBatch.push({ content, resource }));
    await this.writeManyThrottler.queue(() => this.writeMany());
    const fileTree = await this.getFiletree();
    for (const [resource, content] of files) {
      fileTree.add(resource.path, { type: "file", size: content.byteLength });
      this.mtimes.set(resource.toString(), Date.now());
    }
    this.triggerChanges(files.map(([resource]) => ({ resource, type: FileChangeType.UPDATED })));
  }
  async writeMany() {
    if (this.fileWriteBatch.length) {
      const fileBatch = this.fileWriteBatch.splice(0, this.fileWriteBatch.length);
      try {
        await this.indexedDB.runInTransaction(this.store, "readwrite", (objectStore) => fileBatch.map((entry) => {
          return objectStore.put(entry.content, entry.resource.path);
        }));
      } catch (ex) {
        if (ex instanceof DOMException && ex.name === "QuotaExceededError") {
          throw ERR_FILE_EXCEEDS_STORAGE_QUOTA;
        }
        throw ex;
      }
    }
  }
  async deleteKeys(keys) {
    if (keys.length) {
      await this.indexedDB.runInTransaction(this.store, "readwrite", (objectStore) => keys.map((key) => objectStore.delete(key)));
    }
  }
  async reset() {
    await this.indexedDB.runInTransaction(this.store, "readwrite", (objectStore) => objectStore.clear());
  }
}
export {
  IndexedDBFileSystemProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9maWxlcy9icm93c2VyL2luZGV4ZWREQkZpbGVTeXN0ZW1Qcm92aWRlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFRocm90dGxlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgRXh0VXJpIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGlzU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlEdG8gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgY3JlYXRlRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3IsIEZpbGVDaGFuZ2VUeXBlLCBJRmlsZURlbGV0ZU9wdGlvbnMsIElGaWxlT3ZlcndyaXRlT3B0aW9ucywgRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLCBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvckNvZGUsIEZpbGVUeXBlLCBJRmlsZVdyaXRlT3B0aW9ucywgSUZpbGVDaGFuZ2UsIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZVJlYWRXcml0ZUNhcGFiaWxpdHksIElTdGF0LCBJV2F0Y2hPcHRpb25zIH0gZnJvbSAnLi4vY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IEluZGV4ZWREQiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9pbmRleGVkREIuanMnO1xuaW1wb3J0IHsgQnJvYWRjYXN0RGF0YUNoYW5uZWwgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvYnJvYWRjYXN0LmpzJztcblxuLy8gU3RhbmRhcmQgRlMgRXJyb3JzIChleHBlY3RlZCB0byBiZSB0aHJvd24gaW4gcHJvZHVjdGlvbiB3aGVuIGludmFsaWQgRlMgb3BlcmF0aW9ucyBhcmUgcmVxdWVzdGVkKVxuY29uc3QgRVJSX0ZJTEVfTk9UX0ZPVU5EID0gY3JlYXRlRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3IobG9jYWxpemUoJ2ZpbGVOb3RFeGlzdHMnLCBcIkZpbGUgZG9lcyBub3QgZXhpc3RcIiksIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5GaWxlTm90Rm91bmQpO1xuY29uc3QgRVJSX0ZJTEVfSVNfRElSID0gY3JlYXRlRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3IobG9jYWxpemUoJ2ZpbGVJc0RpcmVjdG9yeScsIFwiRmlsZSBpcyBEaXJlY3RvcnlcIiksIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5GaWxlSXNBRGlyZWN0b3J5KTtcbmNvbnN0IEVSUl9GSUxFX05PVF9ESVIgPSBjcmVhdGVGaWxlU3lzdGVtUHJvdmlkZXJFcnJvcihsb2NhbGl6ZSgnZmlsZU5vdERpcmVjdG9yeScsIFwiRmlsZSBpcyBub3QgYSBkaXJlY3RvcnlcIiksIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5GaWxlTm90QURpcmVjdG9yeSk7XG5jb25zdCBFUlJfRElSX05PVF9FTVBUWSA9IGNyZWF0ZUZpbGVTeXN0ZW1Qcm92aWRlckVycm9yKGxvY2FsaXplKCdkaXJJc05vdEVtcHR5JywgXCJEaXJlY3RvcnkgaXMgbm90IGVtcHR5XCIpLCBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvckNvZGUuVW5rbm93bik7XG5jb25zdCBFUlJfRklMRV9FWENFRURTX1NUT1JBR0VfUVVPVEEgPSBjcmVhdGVGaWxlU3lzdGVtUHJvdmlkZXJFcnJvcihsb2NhbGl6ZSgnZmlsZUV4Y2VlZHNTdG9yYWdlUXVvdGEnLCBcIkZpbGUgZXhjZWVkcyBhdmFpbGFibGUgc3RvcmFnZSBxdW90YVwiKSwgRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLkZpbGVFeGNlZWRzU3RvcmFnZVF1b3RhKTtcblxuLy8gQXJiaXRyYXJ5IEludGVybmFsIEVycm9yc1xuY29uc3QgRVJSX1VOS05PV05fSU5URVJOQUwgPSAobWVzc2FnZTogc3RyaW5nKSA9PiBjcmVhdGVGaWxlU3lzdGVtUHJvdmlkZXJFcnJvcihsb2NhbGl6ZSgnaW50ZXJuYWwnLCBcIkludGVybmFsIGVycm9yIG9jY3VycmVkIGluIEluZGV4ZWREQiBGaWxlIFN5c3RlbSBQcm92aWRlci4gKHswfSlcIiwgbWVzc2FnZSksIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5Vbmtub3duKTtcblxudHlwZSBEaXJFbnRyeSA9IFtzdHJpbmcsIEZpbGVUeXBlXTtcblxudHlwZSBJbmRleGVkREJGaWxlU3lzdGVtRW50cnkgPVxuXHR8IHtcblx0XHRwYXRoOiBzdHJpbmc7XG5cdFx0dHlwZTogRmlsZVR5cGUuRGlyZWN0b3J5O1xuXHRcdGNoaWxkcmVuOiBNYXA8c3RyaW5nLCBJbmRleGVkREJGaWxlU3lzdGVtTm9kZT47XG5cdH1cblx0fCB7XG5cdFx0cGF0aDogc3RyaW5nO1xuXHRcdHR5cGU6IEZpbGVUeXBlLkZpbGU7XG5cdFx0c2l6ZTogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHR9O1xuXG5jbGFzcyBJbmRleGVkREJGaWxlU3lzdGVtTm9kZSB7XG5cdHB1YmxpYyB0eXBlOiBGaWxlVHlwZTtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIGVudHJ5OiBJbmRleGVkREJGaWxlU3lzdGVtRW50cnkpIHtcblx0XHR0aGlzLnR5cGUgPSBlbnRyeS50eXBlO1xuXHR9XG5cblx0cmVhZChwYXRoOiBzdHJpbmcpOiBJbmRleGVkREJGaWxlU3lzdGVtRW50cnkgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmRvUmVhZChwYXRoLnNwbGl0KCcvJykuZmlsdGVyKHAgPT4gcC5sZW5ndGgpKTtcblx0fVxuXG5cdHByaXZhdGUgZG9SZWFkKHBhdGhQYXJ0czogc3RyaW5nW10pOiBJbmRleGVkREJGaWxlU3lzdGVtRW50cnkgfCB1bmRlZmluZWQge1xuXHRcdGlmIChwYXRoUGFydHMubGVuZ3RoID09PSAwKSB7IHJldHVybiB0aGlzLmVudHJ5OyB9XG5cdFx0aWYgKHRoaXMuZW50cnkudHlwZSAhPT0gRmlsZVR5cGUuRGlyZWN0b3J5KSB7XG5cdFx0XHR0aHJvdyBFUlJfVU5LTk9XTl9JTlRFUk5BTCgnSW50ZXJuYWwgZXJyb3IgcmVhZGluZyBmcm9tIEluZGV4ZWREQkZTTm9kZSAtLSBleHBlY3RlZCBkaXJlY3RvcnkgYXQgJyArIHRoaXMuZW50cnkucGF0aCk7XG5cdFx0fVxuXHRcdGNvbnN0IG5leHQgPSB0aGlzLmVudHJ5LmNoaWxkcmVuLmdldChwYXRoUGFydHNbMF0pO1xuXG5cdFx0aWYgKCFuZXh0KSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblx0XHRyZXR1cm4gbmV4dC5kb1JlYWQocGF0aFBhcnRzLnNsaWNlKDEpKTtcblx0fVxuXG5cdGRlbGV0ZShwYXRoOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCB0b0RlbGV0ZSA9IHBhdGguc3BsaXQoJy8nKS5maWx0ZXIocCA9PiBwLmxlbmd0aCk7XG5cdFx0aWYgKHRvRGVsZXRlLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0aWYgKHRoaXMuZW50cnkudHlwZSAhPT0gRmlsZVR5cGUuRGlyZWN0b3J5KSB7XG5cdFx0XHRcdHRocm93IEVSUl9VTktOT1dOX0lOVEVSTkFMKGBJbnRlcm5hbCBlcnJvciBkZWxldGluZyBmcm9tIEluZGV4ZWREQkZTTm9kZS4gRXhwZWN0ZWQgcm9vdCBlbnRyeSB0byBiZSBkaXJlY3RvcnlgKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuZW50cnkuY2hpbGRyZW4uY2xlYXIoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuZG9EZWxldGUodG9EZWxldGUsIHBhdGgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZG9EZWxldGUocGF0aFBhcnRzOiBzdHJpbmdbXSwgb3JpZ2luYWxQYXRoOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAocGF0aFBhcnRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhyb3cgRVJSX1VOS05PV05fSU5URVJOQUwoYEludGVybmFsIGVycm9yIGRlbGV0aW5nIGZyb20gSW5kZXhlZERCRlNOb2RlIC0tIGdvdCBubyBkZWxldGlvbiBwYXRoIHBhcnRzIChlbmNvdW50ZXJlZCB3aGlsZSBkZWxldGluZyAke29yaWdpbmFsUGF0aH0pYCk7XG5cdFx0fVxuXHRcdGVsc2UgaWYgKHRoaXMuZW50cnkudHlwZSAhPT0gRmlsZVR5cGUuRGlyZWN0b3J5KSB7XG5cdFx0XHR0aHJvdyBFUlJfVU5LTk9XTl9JTlRFUk5BTCgnSW50ZXJuYWwgZXJyb3IgZGVsZXRpbmcgZnJvbSBJbmRleGVkREJGU05vZGUgLS0gZXhwZWN0ZWQgZGlyZWN0b3J5IGF0ICcgKyB0aGlzLmVudHJ5LnBhdGgpO1xuXHRcdH1cblx0XHRlbHNlIGlmIChwYXRoUGFydHMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHR0aGlzLmVudHJ5LmNoaWxkcmVuLmRlbGV0ZShwYXRoUGFydHNbMF0pO1xuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdGNvbnN0IG5leHQgPSB0aGlzLmVudHJ5LmNoaWxkcmVuLmdldChwYXRoUGFydHNbMF0pO1xuXHRcdFx0aWYgKCFuZXh0KSB7XG5cdFx0XHRcdHRocm93IEVSUl9VTktOT1dOX0lOVEVSTkFMKCdJbnRlcm5hbCBlcnJvciBkZWxldGluZyBmcm9tIEluZGV4ZWREQkZTTm9kZSAtLSBleHBlY3RlZCBlbnRyeSBhdCAnICsgdGhpcy5lbnRyeS5wYXRoICsgJy8nICsgbmV4dCk7XG5cdFx0XHR9XG5cdFx0XHRuZXh0LmRvRGVsZXRlKHBhdGhQYXJ0cy5zbGljZSgxKSwgb3JpZ2luYWxQYXRoKTtcblx0XHR9XG5cdH1cblxuXHRhZGQocGF0aDogc3RyaW5nLCBlbnRyeTogeyB0eXBlOiAnZmlsZSc7IHNpemU/OiBudW1iZXIgfSB8IHsgdHlwZTogJ2RpcicgfSkge1xuXHRcdHRoaXMuZG9BZGQocGF0aC5zcGxpdCgnLycpLmZpbHRlcihwID0+IHAubGVuZ3RoKSwgZW50cnksIHBhdGgpO1xuXHR9XG5cblx0cHJpdmF0ZSBkb0FkZChwYXRoUGFydHM6IHN0cmluZ1tdLCBlbnRyeTogeyB0eXBlOiAnZmlsZSc7IHNpemU/OiBudW1iZXIgfSB8IHsgdHlwZTogJ2RpcicgfSwgb3JpZ2luYWxQYXRoOiBzdHJpbmcpIHtcblx0XHRpZiAocGF0aFBhcnRzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0dGhyb3cgRVJSX1VOS05PV05fSU5URVJOQUwoYEludGVybmFsIGVycm9yIGNyZWF0aW5nIEluZGV4ZWREQkZTTm9kZSAtLSBhZGRpbmcgZW1wdHkgcGF0aCAoZW5jb3VudGVyZWQgd2hpbGUgYWRkaW5nICR7b3JpZ2luYWxQYXRofSlgKTtcblx0XHR9XG5cdFx0ZWxzZSBpZiAodGhpcy5lbnRyeS50eXBlICE9PSBGaWxlVHlwZS5EaXJlY3RvcnkpIHtcblx0XHRcdHRocm93IEVSUl9VTktOT1dOX0lOVEVSTkFMKGBJbnRlcm5hbCBlcnJvciBjcmVhdGluZyBJbmRleGVkREJGU05vZGUgLS0gcGFyZW50IGlzIG5vdCBhIGRpcmVjdG9yeSAoZW5jb3VudGVyZWQgd2hpbGUgYWRkaW5nICR7b3JpZ2luYWxQYXRofSlgKTtcblx0XHR9XG5cdFx0ZWxzZSBpZiAocGF0aFBhcnRzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0Y29uc3QgbmV4dCA9IHBhdGhQYXJ0c1swXTtcblx0XHRcdGNvbnN0IGV4aXN0aW5nID0gdGhpcy5lbnRyeS5jaGlsZHJlbi5nZXQobmV4dCk7XG5cdFx0XHRpZiAoZW50cnkudHlwZSA9PT0gJ2RpcicpIHtcblx0XHRcdFx0aWYgKGV4aXN0aW5nPy5lbnRyeS50eXBlID09PSBGaWxlVHlwZS5GaWxlKSB7XG5cdFx0XHRcdFx0dGhyb3cgRVJSX1VOS05PV05fSU5URVJOQUwoYEludGVybmFsIGVycm9yIGNyZWF0aW5nIEluZGV4ZWREQkZTTm9kZSAtLSBvdmVyd3JpdGluZyBmaWxlIHdpdGggZGlyZWN0b3J5OiAke3RoaXMuZW50cnkucGF0aH0vJHtuZXh0fSAoZW5jb3VudGVyZWQgd2hpbGUgYWRkaW5nICR7b3JpZ2luYWxQYXRofSlgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmVudHJ5LmNoaWxkcmVuLnNldChuZXh0LCBleGlzdGluZyA/PyBuZXcgSW5kZXhlZERCRmlsZVN5c3RlbU5vZGUoe1xuXHRcdFx0XHRcdHR5cGU6IEZpbGVUeXBlLkRpcmVjdG9yeSxcblx0XHRcdFx0XHRwYXRoOiB0aGlzLmVudHJ5LnBhdGggKyAnLycgKyBuZXh0LFxuXHRcdFx0XHRcdGNoaWxkcmVuOiBuZXcgTWFwKCksXG5cdFx0XHRcdH0pKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmIChleGlzdGluZz8uZW50cnkudHlwZSA9PT0gRmlsZVR5cGUuRGlyZWN0b3J5KSB7XG5cdFx0XHRcdFx0dGhyb3cgRVJSX1VOS05PV05fSU5URVJOQUwoYEludGVybmFsIGVycm9yIGNyZWF0aW5nIEluZGV4ZWREQkZTTm9kZSAtLSBvdmVyd3JpdGluZyBkaXJlY3Rvcnkgd2l0aCBmaWxlOiAke3RoaXMuZW50cnkucGF0aH0vJHtuZXh0fSAoZW5jb3VudGVyZWQgd2hpbGUgYWRkaW5nICR7b3JpZ2luYWxQYXRofSlgKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLmVudHJ5LmNoaWxkcmVuLnNldChuZXh0LCBuZXcgSW5kZXhlZERCRmlsZVN5c3RlbU5vZGUoe1xuXHRcdFx0XHRcdHR5cGU6IEZpbGVUeXBlLkZpbGUsXG5cdFx0XHRcdFx0cGF0aDogdGhpcy5lbnRyeS5wYXRoICsgJy8nICsgbmV4dCxcblx0XHRcdFx0XHRzaXplOiBlbnRyeS5zaXplLFxuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGVsc2UgaWYgKHBhdGhQYXJ0cy5sZW5ndGggPiAxKSB7XG5cdFx0XHRjb25zdCBuZXh0ID0gcGF0aFBhcnRzWzBdO1xuXHRcdFx0bGV0IGNoaWxkTm9kZSA9IHRoaXMuZW50cnkuY2hpbGRyZW4uZ2V0KG5leHQpO1xuXHRcdFx0aWYgKCFjaGlsZE5vZGUpIHtcblx0XHRcdFx0Y2hpbGROb2RlID0gbmV3IEluZGV4ZWREQkZpbGVTeXN0ZW1Ob2RlKHtcblx0XHRcdFx0XHRjaGlsZHJlbjogbmV3IE1hcCgpLFxuXHRcdFx0XHRcdHBhdGg6IHRoaXMuZW50cnkucGF0aCArICcvJyArIG5leHQsXG5cdFx0XHRcdFx0dHlwZTogRmlsZVR5cGUuRGlyZWN0b3J5XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aGlzLmVudHJ5LmNoaWxkcmVuLnNldChuZXh0LCBjaGlsZE5vZGUpO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoY2hpbGROb2RlLnR5cGUgPT09IEZpbGVUeXBlLkZpbGUpIHtcblx0XHRcdFx0dGhyb3cgRVJSX1VOS05PV05fSU5URVJOQUwoYEludGVybmFsIGVycm9yIGNyZWF0aW5nIEluZGV4ZWREQkZTTm9kZSAtLSBvdmVyd3JpdGluZyBmaWxlIGVudHJ5IHdpdGggZGlyZWN0b3J5OiAke3RoaXMuZW50cnkucGF0aH0vJHtuZXh0fSAoZW5jb3VudGVyZWQgd2hpbGUgYWRkaW5nICR7b3JpZ2luYWxQYXRofSlgKTtcblx0XHRcdH1cblx0XHRcdGNoaWxkTm9kZS5kb0FkZChwYXRoUGFydHMuc2xpY2UoMSksIGVudHJ5LCBvcmlnaW5hbFBhdGgpO1xuXHRcdH1cblx0fVxuXG5cdHByaW50KGluZGVudGF0aW9uID0gJycpIHtcblx0XHRjb25zb2xlLmxvZyhpbmRlbnRhdGlvbiArIHRoaXMuZW50cnkucGF0aCk7XG5cdFx0aWYgKHRoaXMuZW50cnkudHlwZSA9PT0gRmlsZVR5cGUuRGlyZWN0b3J5KSB7XG5cdFx0XHR0aGlzLmVudHJ5LmNoaWxkcmVuLmZvckVhY2goY2hpbGQgPT4gY2hpbGQucHJpbnQoaW5kZW50YXRpb24gKyAnICcpKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEluZGV4ZWREQkZpbGVTeXN0ZW1Qcm92aWRlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVSZWFkV3JpdGVDYXBhYmlsaXR5IHtcblxuXHRyZWFkb25seSBjYXBhYmlsaXRpZXM6IEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcyA9XG5cdFx0RmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLkZpbGVSZWFkV3JpdGVcblx0XHR8IEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5QYXRoQ2FzZVNlbnNpdGl2ZTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VDYXBhYmlsaXRpZXM6IEV2ZW50PHZvaWQ+ID0gRXZlbnQuTm9uZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGV4dFVyaSA9IG5ldyBFeHRVcmkoKCkgPT4gZmFsc2UpIC8qIENhc2UgU2Vuc2l0aXZlICovO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgY2hhbmdlc0Jyb2FkY2FzdENoYW5uZWw6IEJyb2FkY2FzdERhdGFDaGFubmVsPFVyaUR0bzxJRmlsZUNoYW5nZT5bXT4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlRmlsZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHJlYWRvbmx5IElGaWxlQ2hhbmdlW10+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUZpbGU6IEV2ZW50PHJlYWRvbmx5IElGaWxlQ2hhbmdlW10+ID0gdGhpcy5fb25EaWRDaGFuZ2VGaWxlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgbXRpbWVzID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblxuXHRwcml2YXRlIGNhY2hlZEZpbGV0cmVlOiBQcm9taXNlPEluZGV4ZWREQkZpbGVTeXN0ZW1Ob2RlPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSB3cml0ZU1hbnlUaHJvdHRsZXI6IFRocm90dGxlcjtcblxuXHRjb25zdHJ1Y3RvcihyZWFkb25seSBzY2hlbWU6IHN0cmluZywgcHJpdmF0ZSBpbmRleGVkREI6IEluZGV4ZWREQiwgcHJpdmF0ZSByZWFkb25seSBzdG9yZTogc3RyaW5nLCB3YXRjaENyb3NzV2luZG93Q2hhbmdlczogYm9vbGVhbikge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy53cml0ZU1hbnlUaHJvdHRsZXIgPSBuZXcgVGhyb3R0bGVyKCk7XG5cblx0XHRpZiAod2F0Y2hDcm9zc1dpbmRvd0NoYW5nZXMpIHtcblx0XHRcdHRoaXMuY2hhbmdlc0Jyb2FkY2FzdENoYW5uZWwgPSB0aGlzLl9yZWdpc3RlcihuZXcgQnJvYWRjYXN0RGF0YUNoYW5uZWw8VXJpRHRvPElGaWxlQ2hhbmdlPltdPihgdnNjb2RlLmluZGV4ZWREQi4ke3NjaGVtZX0uY2hhbmdlc2ApKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY2hhbmdlc0Jyb2FkY2FzdENoYW5uZWwub25EaWRSZWNlaXZlRGF0YShjaGFuZ2VzID0+IHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VGaWxlLmZpcmUoY2hhbmdlcy5tYXAoYyA9PiAoeyB0eXBlOiBjLnR5cGUsIHJlc291cmNlOiBVUkkucmV2aXZlKGMucmVzb3VyY2UpIH0pKSk7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG5cblx0d2F0Y2gocmVzb3VyY2U6IFVSSSwgb3B0czogSVdhdGNoT3B0aW9ucyk6IElEaXNwb3NhYmxlIHtcblx0XHRyZXR1cm4gRGlzcG9zYWJsZS5Ob25lO1xuXHR9XG5cblx0YXN5bmMgbWtkaXIocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCByZXNvdXJjZVN0YXQgPSBhd2FpdCB0aGlzLnN0YXQocmVzb3VyY2UpO1xuXHRcdFx0aWYgKHJlc291cmNlU3RhdC50eXBlID09PSBGaWxlVHlwZS5GaWxlKSB7XG5cdFx0XHRcdHRocm93IEVSUl9GSUxFX05PVF9ESVI7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHsgLyogSWdub3JlICovIH1cblx0XHQoYXdhaXQgdGhpcy5nZXRGaWxldHJlZSgpKS5hZGQocmVzb3VyY2UucGF0aCwgeyB0eXBlOiAnZGlyJyB9KTtcblx0fVxuXG5cdGFzeW5jIHN0YXQocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8SVN0YXQ+IHtcblx0XHRjb25zdCBlbnRyeSA9IChhd2FpdCB0aGlzLmdldEZpbGV0cmVlKCkpLnJlYWQocmVzb3VyY2UucGF0aCk7XG5cblx0XHRpZiAoZW50cnk/LnR5cGUgPT09IEZpbGVUeXBlLkZpbGUpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHR5cGU6IEZpbGVUeXBlLkZpbGUsXG5cdFx0XHRcdGN0aW1lOiAwLFxuXHRcdFx0XHRtdGltZTogdGhpcy5tdGltZXMuZ2V0KHJlc291cmNlLnRvU3RyaW5nKCkpIHx8IDAsXG5cdFx0XHRcdHNpemU6IGVudHJ5LnNpemUgPz8gKGF3YWl0IHRoaXMucmVhZEZpbGUocmVzb3VyY2UpKS5ieXRlTGVuZ3RoXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGlmIChlbnRyeT8udHlwZSA9PT0gRmlsZVR5cGUuRGlyZWN0b3J5KSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0eXBlOiBGaWxlVHlwZS5EaXJlY3RvcnksXG5cdFx0XHRcdGN0aW1lOiAwLFxuXHRcdFx0XHRtdGltZTogMCxcblx0XHRcdFx0c2l6ZTogMFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHR0aHJvdyBFUlJfRklMRV9OT1RfRk9VTkQ7XG5cdH1cblxuXHRhc3luYyByZWFkZGlyKHJlc291cmNlOiBVUkkpOiBQcm9taXNlPERpckVudHJ5W10+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZW50cnkgPSAoYXdhaXQgdGhpcy5nZXRGaWxldHJlZSgpKS5yZWFkKHJlc291cmNlLnBhdGgpO1xuXHRcdFx0aWYgKCFlbnRyeSkge1xuXHRcdFx0XHQvLyBEaXJzIGFyZW4ndCBzYXZlZCB0byBkaXNrLCBzbyBlbXB0eSBkaXJzIHdpbGwgYmUgbG9zdCBvbiByZWxvYWQuXG5cdFx0XHRcdC8vIFRodXMgd2UgaGF2ZSB0d28gb3B0aW9ucyBmb3Igd2hhdCBoYXBwZW5zIHdoZW4geW91IHRyeSB0byByZWFkIGEgZGlyIGFuZCBub3RoaW5nIGlzIGZvdW5kOlxuXHRcdFx0XHQvLyAtIFRocm93IEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5GaWxlTm90Rm91bmRcblx0XHRcdFx0Ly8gLSBSZXR1cm4gW11cblx0XHRcdFx0Ly8gV2UgY2hvb3NlIHRvIHJldHVybiBbXSBhcyBjcmVhdGluZyBhIGRpciB0aGVuIHJlYWRpbmcgaXQgKGV2ZW4gYWZ0ZXIgcmVsb2FkKSBzaG91bGQgbm90IHRocm93IGFuIGVycm9yLlxuXHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHR9XG5cdFx0XHRpZiAoZW50cnkudHlwZSAhPT0gRmlsZVR5cGUuRGlyZWN0b3J5KSB7XG5cdFx0XHRcdHRocm93IEVSUl9GSUxFX05PVF9ESVI7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0cmV0dXJuIFsuLi5lbnRyeS5jaGlsZHJlbi5lbnRyaWVzKCldLm1hcCgoW25hbWUsIG5vZGVdKSA9PiBbbmFtZSwgbm9kZS50eXBlXSk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHRocm93IGVycm9yO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHJlYWRGaWxlKHJlc291cmNlOiBVUkkpOiBQcm9taXNlPFVpbnQ4QXJyYXk+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5pbmRleGVkREIucnVuSW5UcmFuc2FjdGlvbih0aGlzLnN0b3JlLCAncmVhZG9ubHknLCBvYmplY3RTdG9yZSA9PiBvYmplY3RTdG9yZS5nZXQocmVzb3VyY2UucGF0aCkpO1xuXHRcdFx0aWYgKHJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHRocm93IEVSUl9GSUxFX05PVF9GT1VORDtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGJ1ZmZlciA9IHJlc3VsdCBpbnN0YW5jZW9mIFVpbnQ4QXJyYXkgPyByZXN1bHQgOiBpc1N0cmluZyhyZXN1bHQpID8gVlNCdWZmZXIuZnJvbVN0cmluZyhyZXN1bHQpLmJ1ZmZlciA6IHVuZGVmaW5lZDtcblx0XHRcdGlmIChidWZmZXIgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHR0aHJvdyBFUlJfVU5LTk9XTl9JTlRFUk5BTChgSW5kZXhlZERCIGVudHJ5IGF0IFwiJHtyZXNvdXJjZS5wYXRofVwiIGluIHVuZXhwZWN0ZWQgZm9ybWF0YCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHVwZGF0ZSBjYWNoZVxuXHRcdFx0Y29uc3QgZmlsZVRyZWUgPSBhd2FpdCB0aGlzLmdldEZpbGV0cmVlKCk7XG5cdFx0XHRmaWxlVHJlZS5hZGQocmVzb3VyY2UucGF0aCwgeyB0eXBlOiAnZmlsZScsIHNpemU6IGJ1ZmZlci5ieXRlTGVuZ3RoIH0pO1xuXG5cdFx0XHRyZXR1cm4gYnVmZmVyO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9XG5cdH1cblxuXHRhc3luYyB3cml0ZUZpbGUocmVzb3VyY2U6IFVSSSwgY29udGVudDogVWludDhBcnJheSwgb3B0czogSUZpbGVXcml0ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZXhpc3RpbmcgPSBhd2FpdCB0aGlzLnN0YXQocmVzb3VyY2UpLmNhdGNoKCgpID0+IHVuZGVmaW5lZCk7XG5cdFx0XHRpZiAoZXhpc3Rpbmc/LnR5cGUgPT09IEZpbGVUeXBlLkRpcmVjdG9yeSkge1xuXHRcdFx0XHR0aHJvdyBFUlJfRklMRV9JU19ESVI7XG5cdFx0XHR9XG5cdFx0XHRhd2FpdCB0aGlzLmJ1bGtXcml0ZShbW3Jlc291cmNlLCBjb250ZW50XV0pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9XG5cdH1cblxuXHRhc3luYyByZW5hbWUoZnJvbTogVVJJLCB0bzogVVJJLCBvcHRzOiBJRmlsZU92ZXJ3cml0ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBmaWxlVHJlZSA9IGF3YWl0IHRoaXMuZ2V0RmlsZXRyZWUoKTtcblx0XHRjb25zdCBmcm9tRW50cnkgPSBmaWxlVHJlZS5yZWFkKGZyb20ucGF0aCk7XG5cdFx0aWYgKCFmcm9tRW50cnkpIHtcblx0XHRcdHRocm93IEVSUl9GSUxFX05PVF9GT1VORDtcblx0XHR9XG5cblx0XHRjb25zdCB0b0VudHJ5ID0gZmlsZVRyZWUucmVhZCh0by5wYXRoKTtcblx0XHRpZiAodG9FbnRyeSkge1xuXHRcdFx0aWYgKCFvcHRzLm92ZXJ3cml0ZSkge1xuXHRcdFx0XHR0aHJvdyBjcmVhdGVGaWxlU3lzdGVtUHJvdmlkZXJFcnJvcignZmlsZSBleGlzdHMgYWxyZWFkeScsIEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yQ29kZS5GaWxlRXhpc3RzKTtcblx0XHRcdH1cblx0XHRcdGlmICh0b0VudHJ5LnR5cGUgIT09IGZyb21FbnRyeS50eXBlKSB7XG5cdFx0XHRcdHRocm93IGNyZWF0ZUZpbGVTeXN0ZW1Qcm92aWRlckVycm9yKCdDYW5ub3QgcmVuYW1lIGZpbGVzIHdpdGggZGlmZmVyZW50IHR5cGVzJywgRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLlVua25vd24pO1xuXHRcdFx0fVxuXHRcdFx0Ly8gZGVsZXRlIHRoZSB0YXJnZXQgZmlsZSBpZiBleGlzdHNcblx0XHRcdGF3YWl0IHRoaXMuZGVsZXRlKHRvLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgdXNlVHJhc2g6IGZhbHNlLCBhdG9taWM6IGZhbHNlIH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRvVGFyZ2V0UmVzb3VyY2UgPSAocGF0aDogc3RyaW5nKTogVVJJID0+IHRoaXMuZXh0VXJpLmpvaW5QYXRoKHRvLCB0aGlzLmV4dFVyaS5yZWxhdGl2ZVBhdGgoZnJvbSwgZnJvbS53aXRoKHsgcGF0aCB9KSkgfHwgJycpO1xuXG5cdFx0Y29uc3Qgc291cmNlRW50cmllcyA9IGF3YWl0IHRoaXMudHJlZShmcm9tKTtcblx0XHRjb25zdCBzb3VyY2VGaWxlczogRGlyRW50cnlbXSA9IFtdO1xuXHRcdGZvciAoY29uc3Qgc291cmNlRW50cnkgb2Ygc291cmNlRW50cmllcykge1xuXHRcdFx0aWYgKHNvdXJjZUVudHJ5WzFdID09PSBGaWxlVHlwZS5GaWxlKSB7XG5cdFx0XHRcdHNvdXJjZUZpbGVzLnB1c2goc291cmNlRW50cnkpO1xuXHRcdFx0fSBlbHNlIGlmIChzb3VyY2VFbnRyeVsxXSA9PT0gRmlsZVR5cGUuRGlyZWN0b3J5KSB7XG5cdFx0XHRcdC8vIGFkZCBkaXJlY3RvcmllcyB0byB0aGUgdHJlZVxuXHRcdFx0XHRmaWxlVHJlZS5hZGQodG9UYXJnZXRSZXNvdXJjZShzb3VyY2VFbnRyeVswXSkucGF0aCwgeyB0eXBlOiAnZGlyJyB9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoc291cmNlRmlsZXMubGVuZ3RoKSB7XG5cdFx0XHRjb25zdCB0YXJnZXRGaWxlczogW1VSSSwgVWludDhBcnJheV1bXSA9IFtdO1xuXHRcdFx0Y29uc3Qgc291cmNlRmlsZXNDb250ZW50cyA9IGF3YWl0IHRoaXMuaW5kZXhlZERCLnJ1bkluVHJhbnNhY3Rpb24odGhpcy5zdG9yZSwgJ3JlYWRvbmx5Jywgb2JqZWN0U3RvcmUgPT4gc291cmNlRmlsZXMubWFwKChbcGF0aF0pID0+IG9iamVjdFN0b3JlLmdldChwYXRoKSkpO1xuXHRcdFx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHNvdXJjZUZpbGVzLmxlbmd0aDsgaW5kZXgrKykge1xuXHRcdFx0XHRjb25zdCBjb250ZW50ID0gc291cmNlRmlsZXNDb250ZW50c1tpbmRleF0gaW5zdGFuY2VvZiBVaW50OEFycmF5ID8gc291cmNlRmlsZXNDb250ZW50c1tpbmRleF0gOiBpc1N0cmluZyhzb3VyY2VGaWxlc0NvbnRlbnRzW2luZGV4XSkgPyBWU0J1ZmZlci5mcm9tU3RyaW5nKHNvdXJjZUZpbGVzQ29udGVudHNbaW5kZXhdKS5idWZmZXIgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmIChjb250ZW50KSB7XG5cdFx0XHRcdFx0dGFyZ2V0RmlsZXMucHVzaChbdG9UYXJnZXRSZXNvdXJjZShzb3VyY2VGaWxlc1tpbmRleF1bMF0pLCBjb250ZW50XSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGF3YWl0IHRoaXMuYnVsa1dyaXRlKHRhcmdldEZpbGVzKTtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLmRlbGV0ZShmcm9tLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgdXNlVHJhc2g6IGZhbHNlLCBhdG9taWM6IGZhbHNlIH0pO1xuXHR9XG5cblx0YXN5bmMgZGVsZXRlKHJlc291cmNlOiBVUkksIG9wdHM6IElGaWxlRGVsZXRlT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGxldCBzdGF0OiBJU3RhdDtcblx0XHR0cnkge1xuXHRcdFx0c3RhdCA9IGF3YWl0IHRoaXMuc3RhdChyZXNvdXJjZSk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0aWYgKGUuY29kZSA9PT0gRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLkZpbGVOb3RGb3VuZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBlO1xuXHRcdH1cblxuXHRcdGxldCB0b0RlbGV0ZTogc3RyaW5nW107XG5cdFx0aWYgKG9wdHMucmVjdXJzaXZlKSB7XG5cdFx0XHRjb25zdCB0cmVlID0gYXdhaXQgdGhpcy50cmVlKHJlc291cmNlKTtcblx0XHRcdHRvRGVsZXRlID0gdHJlZS5tYXAoKFtwYXRoXSkgPT4gcGF0aCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmIChzdGF0LnR5cGUgPT09IEZpbGVUeXBlLkRpcmVjdG9yeSAmJiAoYXdhaXQgdGhpcy5yZWFkZGlyKHJlc291cmNlKSkubGVuZ3RoKSB7XG5cdFx0XHRcdHRocm93IEVSUl9ESVJfTk9UX0VNUFRZO1xuXHRcdFx0fVxuXHRcdFx0dG9EZWxldGUgPSBbcmVzb3VyY2UucGF0aF07XG5cdFx0fVxuXHRcdGF3YWl0IHRoaXMuZGVsZXRlS2V5cyh0b0RlbGV0ZSk7XG5cdFx0KGF3YWl0IHRoaXMuZ2V0RmlsZXRyZWUoKSkuZGVsZXRlKHJlc291cmNlLnBhdGgpO1xuXHRcdHRvRGVsZXRlLmZvckVhY2goa2V5ID0+IHRoaXMubXRpbWVzLmRlbGV0ZShrZXkpKTtcblx0XHR0aGlzLnRyaWdnZXJDaGFuZ2VzKHRvRGVsZXRlLm1hcChwYXRoID0+ICh7IHJlc291cmNlOiByZXNvdXJjZS53aXRoKHsgcGF0aCB9KSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuREVMRVRFRCB9KSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB0cmVlKHJlc291cmNlOiBVUkkpOiBQcm9taXNlPERpckVudHJ5W10+IHtcblx0XHRjb25zdCBzdGF0ID0gYXdhaXQgdGhpcy5zdGF0KHJlc291cmNlKTtcblx0XHRjb25zdCBhbGxFbnRyaWVzOiBEaXJFbnRyeVtdID0gW1tyZXNvdXJjZS5wYXRoLCBzdGF0LnR5cGVdXTtcblx0XHRpZiAoc3RhdC50eXBlID09PSBGaWxlVHlwZS5EaXJlY3RvcnkpIHtcblx0XHRcdGNvbnN0IGRpckVudHJpZXMgPSBhd2FpdCB0aGlzLnJlYWRkaXIocmVzb3VyY2UpO1xuXHRcdFx0Zm9yIChjb25zdCBba2V5LCB0eXBlXSBvZiBkaXJFbnRyaWVzKSB7XG5cdFx0XHRcdGNvbnN0IGNoaWxkUmVzb3VyY2UgPSB0aGlzLmV4dFVyaS5qb2luUGF0aChyZXNvdXJjZSwga2V5KTtcblx0XHRcdFx0YWxsRW50cmllcy5wdXNoKFtjaGlsZFJlc291cmNlLnBhdGgsIHR5cGVdKTtcblx0XHRcdFx0aWYgKHR5cGUgPT09IEZpbGVUeXBlLkRpcmVjdG9yeSkge1xuXHRcdFx0XHRcdGNvbnN0IGNoaWxkRW50cmllcyA9IGF3YWl0IHRoaXMudHJlZShjaGlsZFJlc291cmNlKTtcblx0XHRcdFx0XHRhbGxFbnRyaWVzLnB1c2goLi4uY2hpbGRFbnRyaWVzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gYWxsRW50cmllcztcblx0fVxuXG5cdHByaXZhdGUgdHJpZ2dlckNoYW5nZXMoY2hhbmdlczogSUZpbGVDaGFuZ2VbXSk6IHZvaWQge1xuXHRcdGlmIChjaGFuZ2VzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VGaWxlLmZpcmUoY2hhbmdlcyk7XG5cblx0XHRcdHRoaXMuY2hhbmdlc0Jyb2FkY2FzdENoYW5uZWw/LnBvc3REYXRhKGNoYW5nZXMpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0RmlsZXRyZWUoKTogUHJvbWlzZTxJbmRleGVkREJGaWxlU3lzdGVtTm9kZT4ge1xuXHRcdGlmICghdGhpcy5jYWNoZWRGaWxldHJlZSkge1xuXHRcdFx0dGhpcy5jYWNoZWRGaWxldHJlZSA9IChhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJvb3ROb2RlID0gbmV3IEluZGV4ZWREQkZpbGVTeXN0ZW1Ob2RlKHtcblx0XHRcdFx0XHRjaGlsZHJlbjogbmV3IE1hcCgpLFxuXHRcdFx0XHRcdHBhdGg6ICcnLFxuXHRcdFx0XHRcdHR5cGU6IEZpbGVUeXBlLkRpcmVjdG9yeVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5pbmRleGVkREIucnVuSW5UcmFuc2FjdGlvbih0aGlzLnN0b3JlLCAncmVhZG9ubHknLCBvYmplY3RTdG9yZSA9PiBvYmplY3RTdG9yZS5nZXRBbGxLZXlzKCkpO1xuXHRcdFx0XHRjb25zdCBrZXlzID0gcmVzdWx0Lm1hcChrZXkgPT4ga2V5LnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRrZXlzLmZvckVhY2goa2V5ID0+IHJvb3ROb2RlLmFkZChrZXksIHsgdHlwZTogJ2ZpbGUnIH0pKTtcblx0XHRcdFx0cmV0dXJuIHJvb3ROb2RlO1xuXHRcdFx0fSkoKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuY2FjaGVkRmlsZXRyZWU7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGJ1bGtXcml0ZShmaWxlczogW1VSSSwgVWludDhBcnJheV1bXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGZpbGVzLmZvckVhY2goKFtyZXNvdXJjZSwgY29udGVudF0pID0+IHRoaXMuZmlsZVdyaXRlQmF0Y2gucHVzaCh7IGNvbnRlbnQsIHJlc291cmNlIH0pKTtcblx0XHRhd2FpdCB0aGlzLndyaXRlTWFueVRocm90dGxlci5xdWV1ZSgoKSA9PiB0aGlzLndyaXRlTWFueSgpKTtcblxuXHRcdGNvbnN0IGZpbGVUcmVlID0gYXdhaXQgdGhpcy5nZXRGaWxldHJlZSgpO1xuXHRcdGZvciAoY29uc3QgW3Jlc291cmNlLCBjb250ZW50XSBvZiBmaWxlcykge1xuXHRcdFx0ZmlsZVRyZWUuYWRkKHJlc291cmNlLnBhdGgsIHsgdHlwZTogJ2ZpbGUnLCBzaXplOiBjb250ZW50LmJ5dGVMZW5ndGggfSk7XG5cdFx0XHR0aGlzLm10aW1lcy5zZXQocmVzb3VyY2UudG9TdHJpbmcoKSwgRGF0ZS5ub3coKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy50cmlnZ2VyQ2hhbmdlcyhmaWxlcy5tYXAoKFtyZXNvdXJjZV0pID0+ICh7IHJlc291cmNlLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5VUERBVEVEIH0pKSk7XG5cdH1cblxuXHRwcml2YXRlIGZpbGVXcml0ZUJhdGNoOiB7IHJlc291cmNlOiBVUkk7IGNvbnRlbnQ6IFVpbnQ4QXJyYXkgfVtdID0gW107XG5cdHByaXZhdGUgYXN5bmMgd3JpdGVNYW55KCkge1xuXHRcdGlmICh0aGlzLmZpbGVXcml0ZUJhdGNoLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgZmlsZUJhdGNoID0gdGhpcy5maWxlV3JpdGVCYXRjaC5zcGxpY2UoMCwgdGhpcy5maWxlV3JpdGVCYXRjaC5sZW5ndGgpO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5pbmRleGVkREIucnVuSW5UcmFuc2FjdGlvbih0aGlzLnN0b3JlLCAncmVhZHdyaXRlJywgb2JqZWN0U3RvcmUgPT4gZmlsZUJhdGNoLm1hcChlbnRyeSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIG9iamVjdFN0b3JlLnB1dChlbnRyeS5jb250ZW50LCBlbnRyeS5yZXNvdXJjZS5wYXRoKTtcblx0XHRcdFx0fSkpO1xuXHRcdFx0fSBjYXRjaCAoZXgpIHtcblx0XHRcdFx0aWYgKGV4IGluc3RhbmNlb2YgRE9NRXhjZXB0aW9uICYmIGV4Lm5hbWUgPT09ICdRdW90YUV4Y2VlZGVkRXJyb3InKSB7XG5cdFx0XHRcdFx0dGhyb3cgRVJSX0ZJTEVfRVhDRUVEU19TVE9SQUdFX1FVT1RBO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhyb3cgZXg7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkZWxldGVLZXlzKGtleXM6IHN0cmluZ1tdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGtleXMubGVuZ3RoKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmluZGV4ZWREQi5ydW5JblRyYW5zYWN0aW9uKHRoaXMuc3RvcmUsICdyZWFkd3JpdGUnLCBvYmplY3RTdG9yZSA9PiBrZXlzLm1hcChrZXkgPT4gb2JqZWN0U3RvcmUuZGVsZXRlKGtleSkpKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyByZXNldCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLmluZGV4ZWREQi5ydW5JblRyYW5zYWN0aW9uKHRoaXMuc3RvcmUsICdyZWFkd3JpdGUnLCBvYmplY3RTdG9yZSA9PiBvYmplY3RTdG9yZS5jbGVhcigpKTtcblx0fVxuXG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLGtCQUErQjtBQUN4QyxTQUFTLGNBQWM7QUFDdkIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxXQUFtQjtBQUM1QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLCtCQUErQixnQkFBMkQsZ0NBQWdDLDZCQUE2QixnQkFBc0g7QUFFdFIsU0FBUyw0QkFBNEI7QUFHckMsTUFBTSxxQkFBcUIsOEJBQThCLFNBQVMsaUJBQWlCLHFCQUFxQixHQUFHLDRCQUE0QixZQUFZO0FBQ25KLE1BQU0sa0JBQWtCLDhCQUE4QixTQUFTLG1CQUFtQixtQkFBbUIsR0FBRyw0QkFBNEIsZ0JBQWdCO0FBQ3BKLE1BQU0sbUJBQW1CLDhCQUE4QixTQUFTLG9CQUFvQix5QkFBeUIsR0FBRyw0QkFBNEIsaUJBQWlCO0FBQzdKLE1BQU0sb0JBQW9CLDhCQUE4QixTQUFTLGlCQUFpQix3QkFBd0IsR0FBRyw0QkFBNEIsT0FBTztBQUNoSixNQUFNLGlDQUFpQyw4QkFBOEIsU0FBUywyQkFBMkIsc0NBQXNDLEdBQUcsNEJBQTRCLHVCQUF1QjtBQUdyTSxNQUFNLHVCQUF1QixDQUFDLFlBQW9CLDhCQUE4QixTQUFTLFlBQVksb0VBQW9FLE9BQU8sR0FBRyw0QkFBNEIsT0FBTztBQWdCdE4sTUFBTSx3QkFBd0I7QUFBQSxFQUc3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QUFVLE9BQTJDO0FBQ2xFLFVBQU0sUUFBUSxDQUFDLENBQUMsVUFBVSxPQUFPLE1BQU0sS0FBSyxlQUFlLEtBQUssRUFBRSxTQUFTLFNBQVMsQ0FBQyxDQUFDO0FBQ3RGLFVBQU0sS0FBSyxtQkFBbUIsTUFBTSxNQUFNLEtBQUssVUFBVSxDQUFDO0FBRTFELFVBQU0sV0FBVyxNQUFNLEtBQUssWUFBWTtBQUN4QyxlQUFXLENBQUMsVUFBVSxPQUFPLEtBQUssT0FBTztBQUN4QyxlQUFTLElBQUksU0FBUyxNQUFNLEVBQUUsTUFBTSxRQUFRLE1BQU0sUUFBUSxXQUFXLENBQUM7QUFDdEUsV0FBSyxPQUFPLElBQUksU0FBUyxTQUFTLEdBQUcsS0FBSyxJQUFJLENBQUM7QUFBQSxJQUNoRDtBQUVBLFNBQUssZUFBZSxNQUFNLElBQUksQ0FBQyxDQUFDLFFBQVEsT0FBTyxFQUFFLFVBQVUsTUFBTSxlQUFlLFFBQVEsRUFBRSxDQUFDO0FBQUEsRUFDNUY7QUFBQSxFQUdBLE1BQWMsWUFBWTtBQUN6QixRQUFJLEtBQUssZUFBZSxRQUFRO0FBQy9CLFlBQU0sWUFBWSxLQUFLLGVBQWUsT0FBTyxHQUFHLEtBQUssZUFBZSxNQUFNO0FBQzFFLFVBQUk7QUFDSCxjQUFNLEtBQUssVUFBVSxpQkFBaUIsS0FBSyxPQUFPLGFBQWEsaUJBQWUsVUFBVSxJQUFJLFdBQVM7QUFDcEcsaUJBQU8sWUFBWSxJQUFJLE1BQU0sU0FBUyxNQUFNLFNBQVMsSUFBSTtBQUFBLFFBQzFELENBQUMsQ0FBQztBQUFBLE1BQ0gsU0FBUyxJQUFJO0FBQ1osWUFBSSxjQUFjLGdCQUFnQixHQUFHLFNBQVMsc0JBQXNCO0FBQ25FLGdCQUFNO0FBQUEsUUFDUDtBQUVBLGNBQU07QUFBQSxNQUNQO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQWMsV0FBVyxNQUErQjtBQUN2RCxRQUFJLEtBQUssUUFBUTtBQUNoQixZQUFNLEtBQUssVUFBVSxpQkFBaUIsS0FBSyxPQUFPLGFBQWEsaUJBQWUsS0FBSyxJQUFJLFNBQU8sWUFBWSxPQUFPLEdBQUcsQ0FBQyxDQUFDO0FBQUEsSUFDdkg7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFNLFFBQXVCO0FBQzVCLFVBQU0sS0FBSyxVQUFVLGlCQUFpQixLQUFLLE9BQU8sYUFBYSxpQkFBZSxZQUFZLE1BQU0sQ0FBQztBQUFBLEVBQ2xHO0FBRUQ7IiwKICAibmFtZXMiOiBbXQp9Cg==
