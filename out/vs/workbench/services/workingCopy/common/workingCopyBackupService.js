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
import { joinPath } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { coalesce } from "../../../../base/common/arrays.js";
import { equals, deepClone } from "../../../../base/common/objects.js";
import { Promises, ResourceQueue } from "../../../../base/common/async.js";
import { IFileService, FileOperationResult } from "../../../../platform/files/common/files.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { isReadableStream, peekStream } from "../../../../base/common/stream.js";
import { bufferToStream, prefixedBufferReadable, prefixedBufferStream, readableToBuffer, streamToBuffer, VSBuffer } from "../../../../base/common/buffer.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Schemas } from "../../../../base/common/network.js";
import { hash } from "../../../../base/common/hash.js";
import { isEmptyObject } from "../../../../base/common/types.js";
import { NO_TYPE_ID } from "./workingCopy.js";
class WorkingCopyBackupsModel {
  constructor(backupRoot, fileService) {
    this.backupRoot = backupRoot;
    this.fileService = fileService;
    this.cache = new ResourceMap();
  }
  static async create(backupRoot, fileService) {
    const model = new WorkingCopyBackupsModel(backupRoot, fileService);
    await model.resolve();
    return model;
  }
  async resolve() {
    try {
      const backupRootStat = await this.fileService.resolve(this.backupRoot);
      if (backupRootStat.children) {
        await Promises.settled(backupRootStat.children.filter((child) => child.isDirectory).map(async (backupSchemaFolder) => {
          const backupSchemaFolderStat = await this.fileService.resolve(backupSchemaFolder.resource);
          if (backupSchemaFolderStat.children) {
            for (const backupForSchema of backupSchemaFolderStat.children) {
              if (!backupForSchema.isDirectory) {
                this.add(backupForSchema.resource);
              }
            }
          }
        }));
      }
    } catch (error) {
    }
  }
  add(resource, versionId = 0, meta) {
    this.cache.set(resource, {
      versionId,
      meta: deepClone(meta)
    });
  }
  update(resource, meta) {
    const entry = this.cache.get(resource);
    if (entry) {
      entry.meta = deepClone(meta);
    }
  }
  count() {
    return this.cache.size;
  }
  has(resource, versionId, meta) {
    const entry = this.cache.get(resource);
    if (!entry) {
      return false;
    }
    if (typeof versionId === "number" && versionId !== entry.versionId) {
      return false;
    }
    if (meta && !equals(meta, entry.meta)) {
      return false;
    }
    return true;
  }
  get() {
    return Array.from(this.cache.keys());
  }
  remove(resource) {
    this.cache.delete(resource);
  }
  clear() {
    this.cache.clear();
  }
}
let WorkingCopyBackupService = class extends Disposable {
  constructor(backupWorkspaceHome, fileService, logService) {
    super();
    this.fileService = fileService;
    this.logService = logService;
    this.impl = this._register(this.initialize(backupWorkspaceHome));
  }
  initialize(backupWorkspaceHome) {
    if (backupWorkspaceHome) {
      return new WorkingCopyBackupServiceImpl(backupWorkspaceHome, this.fileService, this.logService);
    }
    return new InMemoryWorkingCopyBackupService();
  }
  reinitialize(backupWorkspaceHome) {
    if (this.impl instanceof WorkingCopyBackupServiceImpl) {
      if (backupWorkspaceHome) {
        this.impl.initialize(backupWorkspaceHome);
      } else {
        this.impl = new InMemoryWorkingCopyBackupService();
      }
    }
  }
  hasBackups() {
    return this.impl.hasBackups();
  }
  hasBackupSync(identifier, versionId, meta) {
    return this.impl.hasBackupSync(identifier, versionId, meta);
  }
  backup(identifier, content, versionId, meta, token) {
    return this.impl.backup(identifier, content, versionId, meta, token);
  }
  discardBackup(identifier, token) {
    return this.impl.discardBackup(identifier, token);
  }
  discardBackups(filter) {
    return this.impl.discardBackups(filter);
  }
  getBackups() {
    return this.impl.getBackups();
  }
  resolve(identifier) {
    return this.impl.resolve(identifier);
  }
  toBackupResource(identifier) {
    return this.impl.toBackupResource(identifier);
  }
  joinBackups() {
    return this.impl.joinBackups();
  }
};
WorkingCopyBackupService = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, ILogService)
], WorkingCopyBackupService);
let WorkingCopyBackupServiceImpl = class extends Disposable {
  constructor(backupWorkspaceHome, fileService, logService) {
    super();
    this.backupWorkspaceHome = backupWorkspaceHome;
    this.fileService = fileService;
    this.logService = logService;
    this.ioOperationQueues = this._register(new ResourceQueue());
    this.model = void 0;
    this.initialize(backupWorkspaceHome);
  }
  initialize(backupWorkspaceResource) {
    this.backupWorkspaceHome = backupWorkspaceResource;
    this.ready = this.doInitialize();
  }
  async doInitialize() {
    this.model = await WorkingCopyBackupsModel.create(this.backupWorkspaceHome, this.fileService);
    return this.model;
  }
  async hasBackups() {
    const model = await this.ready;
    await this.joinBackups();
    return model.count() > 0;
  }
  hasBackupSync(identifier, versionId, meta) {
    if (!this.model) {
      return false;
    }
    const backupResource = this.toBackupResource(identifier);
    return this.model.has(backupResource, versionId, meta);
  }
  async backup(identifier, content, versionId, meta, token) {
    const model = await this.ready;
    if (token?.isCancellationRequested) {
      return;
    }
    const backupResource = this.toBackupResource(identifier);
    if (model.has(backupResource, versionId, meta)) {
      return;
    }
    return this.ioOperationQueues.queueFor(backupResource, async () => {
      if (token?.isCancellationRequested) {
        return;
      }
      if (model.has(backupResource, versionId, meta)) {
        return;
      }
      let preamble = this.createPreamble(identifier, meta);
      if (preamble.length >= WorkingCopyBackupServiceImpl.PREAMBLE_MAX_LENGTH) {
        preamble = this.createPreamble(identifier);
      }
      const preambleBuffer = VSBuffer.fromString(preamble);
      let backupBuffer;
      if (isReadableStream(content)) {
        backupBuffer = prefixedBufferStream(preambleBuffer, content);
      } else if (content) {
        backupBuffer = prefixedBufferReadable(preambleBuffer, content);
      } else {
        backupBuffer = VSBuffer.concat([preambleBuffer, VSBuffer.fromString("")]);
      }
      await this.fileService.writeFile(backupResource, backupBuffer);
      model.add(backupResource, versionId, meta);
    });
  }
  createPreamble(identifier, meta) {
    return `${identifier.resource.toString()}${WorkingCopyBackupServiceImpl.PREAMBLE_META_SEPARATOR}${JSON.stringify({ ...meta, typeId: identifier.typeId })}${WorkingCopyBackupServiceImpl.PREAMBLE_END_MARKER}`;
  }
  async discardBackups(filter) {
    const model = await this.ready;
    const except = filter?.except;
    if (Array.isArray(except) && except.length > 0) {
      const exceptMap = new ResourceMap();
      for (const exceptWorkingCopy of except) {
        exceptMap.set(this.toBackupResource(exceptWorkingCopy), true);
      }
      await Promises.settled(model.get().map(async (backupResource) => {
        if (!exceptMap.has(backupResource)) {
          await this.doDiscardBackup(backupResource);
        }
      }));
    } else {
      await this.deleteIgnoreFileNotFound(this.backupWorkspaceHome);
      model.clear();
    }
  }
  discardBackup(identifier, token) {
    const backupResource = this.toBackupResource(identifier);
    return this.doDiscardBackup(backupResource, token);
  }
  async doDiscardBackup(backupResource, token) {
    const model = await this.ready;
    if (token?.isCancellationRequested) {
      return;
    }
    return this.ioOperationQueues.queueFor(backupResource, async () => {
      if (token?.isCancellationRequested) {
        return;
      }
      await this.deleteIgnoreFileNotFound(backupResource);
      model.remove(backupResource);
    });
  }
  async deleteIgnoreFileNotFound(backupResource) {
    try {
      await this.fileService.del(backupResource, { recursive: true });
    } catch (error) {
      if (error.fileOperationResult !== FileOperationResult.FILE_NOT_FOUND) {
        throw error;
      }
    }
  }
  async getBackups() {
    const model = await this.ready;
    await this.joinBackups();
    const backups = await Promise.all(model.get().map((backupResource) => this.resolveIdentifier(backupResource, model)));
    return coalesce(backups);
  }
  async resolveIdentifier(backupResource, model) {
    let res = void 0;
    await this.ioOperationQueues.queueFor(backupResource, async () => {
      if (!model.has(backupResource)) {
        return;
      }
      const backupPreamble = await this.readToMatchingString(backupResource, WorkingCopyBackupServiceImpl.PREAMBLE_END_MARKER, WorkingCopyBackupServiceImpl.PREAMBLE_MAX_LENGTH);
      if (!backupPreamble) {
        return;
      }
      const metaStartIndex = backupPreamble.indexOf(WorkingCopyBackupServiceImpl.PREAMBLE_META_SEPARATOR);
      let resourcePreamble;
      let metaPreamble;
      if (metaStartIndex > 0) {
        resourcePreamble = backupPreamble.substring(0, metaStartIndex);
        metaPreamble = backupPreamble.substr(metaStartIndex + 1);
      } else {
        resourcePreamble = backupPreamble;
        metaPreamble = void 0;
      }
      const { typeId, meta } = this.parsePreambleMeta(metaPreamble);
      model.update(backupResource, meta);
      res = {
        typeId: typeId ?? NO_TYPE_ID,
        resource: URI.parse(resourcePreamble)
      };
    });
    return res;
  }
  async readToMatchingString(backupResource, matchingString, maximumBytesToRead) {
    const contents = (await this.fileService.readFile(backupResource, { length: maximumBytesToRead })).value.toString();
    const matchingStringIndex = contents.indexOf(matchingString);
    if (matchingStringIndex >= 0) {
      return contents.substr(0, matchingStringIndex);
    }
    return void 0;
  }
  async resolve(identifier) {
    const backupResource = this.toBackupResource(identifier);
    const model = await this.ready;
    let res = void 0;
    await this.ioOperationQueues.queueFor(backupResource, async () => {
      if (!model.has(backupResource)) {
        return;
      }
      const backupStream = await this.fileService.readFileStream(backupResource);
      const peekedBackupStream = await peekStream(backupStream.value, 1);
      const firstBackupChunk = VSBuffer.concat(peekedBackupStream.buffer);
      const preambleEndIndex = firstBackupChunk.buffer.indexOf(WorkingCopyBackupServiceImpl.PREAMBLE_END_MARKER_CHARCODE);
      if (preambleEndIndex === -1) {
        this.logService.trace(`Backup: Could not find meta end marker in ${backupResource}. The file is probably corrupt (filesize: ${backupStream.size}).`);
        return void 0;
      }
      const preambelRaw = firstBackupChunk.slice(0, preambleEndIndex).toString();
      let meta;
      const metaStartIndex = preambelRaw.indexOf(WorkingCopyBackupServiceImpl.PREAMBLE_META_SEPARATOR);
      if (metaStartIndex !== -1) {
        meta = this.parsePreambleMeta(preambelRaw.substr(metaStartIndex + 1)).meta;
      }
      model.update(backupResource, meta);
      const firstBackupChunkWithoutPreamble = firstBackupChunk.slice(preambleEndIndex + 1);
      let value;
      if (peekedBackupStream.ended) {
        value = bufferToStream(firstBackupChunkWithoutPreamble);
      } else {
        value = prefixedBufferStream(firstBackupChunkWithoutPreamble, peekedBackupStream.stream);
      }
      res = { value, meta };
    });
    return res;
  }
  parsePreambleMeta(preambleMetaRaw) {
    let typeId = void 0;
    let meta = void 0;
    if (preambleMetaRaw) {
      try {
        meta = JSON.parse(preambleMetaRaw);
        typeId = meta?.typeId;
        if (typeof meta?.typeId === "string") {
          delete meta.typeId;
          if (isEmptyObject(meta)) {
            meta = void 0;
          }
        }
      } catch (error) {
      }
    }
    return { typeId, meta };
  }
  toBackupResource(identifier) {
    return joinPath(this.backupWorkspaceHome, identifier.resource.scheme, hashIdentifier(identifier));
  }
  joinBackups() {
    return this.ioOperationQueues.whenDrained();
  }
};
WorkingCopyBackupServiceImpl.PREAMBLE_END_MARKER = "\n";
WorkingCopyBackupServiceImpl.PREAMBLE_END_MARKER_CHARCODE = "\n".charCodeAt(0);
WorkingCopyBackupServiceImpl.PREAMBLE_META_SEPARATOR = " ";
// using a character that is know to be escaped in a URI as separator
WorkingCopyBackupServiceImpl.PREAMBLE_MAX_LENGTH = 1e4;
WorkingCopyBackupServiceImpl = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, ILogService)
], WorkingCopyBackupServiceImpl);
class InMemoryWorkingCopyBackupService extends Disposable {
  constructor() {
    super();
    this.backups = new ResourceMap();
  }
  async hasBackups() {
    return this.backups.size > 0;
  }
  hasBackupSync(identifier, versionId) {
    const backupResource = this.toBackupResource(identifier);
    return this.backups.has(backupResource);
  }
  async backup(identifier, content, versionId, meta, token) {
    const backupResource = this.toBackupResource(identifier);
    this.backups.set(backupResource, {
      typeId: identifier.typeId,
      content: content instanceof VSBuffer ? content : content ? isReadableStream(content) ? await streamToBuffer(content) : readableToBuffer(content) : VSBuffer.fromString(""),
      meta
    });
  }
  async resolve(identifier) {
    const backupResource = this.toBackupResource(identifier);
    const backup = this.backups.get(backupResource);
    if (backup) {
      return { value: bufferToStream(backup.content), meta: backup.meta };
    }
    return void 0;
  }
  async getBackups() {
    return Array.from(this.backups.entries()).map(([resource, backup]) => ({ typeId: backup.typeId, resource }));
  }
  async discardBackup(identifier) {
    this.backups.delete(this.toBackupResource(identifier));
  }
  async discardBackups(filter) {
    const except = filter?.except;
    if (Array.isArray(except) && except.length > 0) {
      const exceptMap = new ResourceMap();
      for (const exceptWorkingCopy of except) {
        exceptMap.set(this.toBackupResource(exceptWorkingCopy), true);
      }
      for (const backup of await this.getBackups()) {
        if (!exceptMap.has(this.toBackupResource(backup))) {
          await this.discardBackup(backup);
        }
      }
    } else {
      this.backups.clear();
    }
  }
  toBackupResource(identifier) {
    return URI.from({ scheme: Schemas.inMemory, path: hashIdentifier(identifier) });
  }
  async joinBackups() {
    return;
  }
}
function hashIdentifier(identifier) {
  let resource;
  if (identifier.typeId.length > 0) {
    const typeIdHash = hashString(identifier.typeId);
    if (identifier.resource.path) {
      resource = joinPath(identifier.resource, typeIdHash);
    } else {
      resource = identifier.resource.with({ path: typeIdHash });
    }
  } else {
    resource = identifier.resource;
  }
  return hashPath(resource);
}
function hashPath(resource) {
  const str = resource.scheme === Schemas.file || resource.scheme === Schemas.untitled ? resource.fsPath : resource.toString();
  return hashString(str);
}
function hashString(str) {
  return hash(str).toString(16);
}
export {
  InMemoryWorkingCopyBackupService,
  WorkingCopyBackupService,
  WorkingCopyBackupsModel,
  hashIdentifier
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5QmFja3VwU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBjb2FsZXNjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBlcXVhbHMsIGRlZXBDbG9uZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgUHJvbWlzZXMsIFJlc291cmNlUXVldWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBJUmVzb2x2ZWRXb3JraW5nQ29weUJhY2t1cCwgSVdvcmtpbmdDb3B5QmFja3VwU2VydmljZSB9IGZyb20gJy4vd29ya2luZ0NvcHlCYWNrdXAuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlLCBGaWxlT3BlcmF0aW9uRXJyb3IsIEZpbGVPcGVyYXRpb25SZXN1bHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgaXNSZWFkYWJsZVN0cmVhbSwgcGVla1N0cmVhbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmVhbS5qcyc7XG5pbXBvcnQgeyBidWZmZXJUb1N0cmVhbSwgcHJlZml4ZWRCdWZmZXJSZWFkYWJsZSwgcHJlZml4ZWRCdWZmZXJTdHJlYW0sIHJlYWRhYmxlVG9CdWZmZXIsIHN0cmVhbVRvQnVmZmVyLCBWU0J1ZmZlciwgVlNCdWZmZXJSZWFkYWJsZSwgVlNCdWZmZXJSZWFkYWJsZVN0cmVhbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgaGFzaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2hhc2guanMnO1xuaW1wb3J0IHsgaXNFbXB0eU9iamVjdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weUJhY2t1cE1ldGEsIElXb3JraW5nQ29weUlkZW50aWZpZXIsIE5PX1RZUEVfSUQgfSBmcm9tICcuL3dvcmtpbmdDb3B5LmpzJztcblxuZXhwb3J0IGNsYXNzIFdvcmtpbmdDb3B5QmFja3Vwc01vZGVsIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGNhY2hlID0gbmV3IFJlc291cmNlTWFwPHsgdmVyc2lvbklkPzogbnVtYmVyOyBtZXRhPzogSVdvcmtpbmdDb3B5QmFja3VwTWV0YSB9PigpO1xuXG5cdHN0YXRpYyBhc3luYyBjcmVhdGUoYmFja3VwUm9vdDogVVJJLCBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlKTogUHJvbWlzZTxXb3JraW5nQ29weUJhY2t1cHNNb2RlbD4ge1xuXHRcdGNvbnN0IG1vZGVsID0gbmV3IFdvcmtpbmdDb3B5QmFja3Vwc01vZGVsKGJhY2t1cFJvb3QsIGZpbGVTZXJ2aWNlKTtcblxuXHRcdGF3YWl0IG1vZGVsLnJlc29sdmUoKTtcblxuXHRcdHJldHVybiBtb2RlbDtcblx0fVxuXG5cdHByaXZhdGUgY29uc3RydWN0b3IocHJpdmF0ZSBiYWNrdXBSb290OiBVUkksIHByaXZhdGUgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSkgeyB9XG5cblx0cHJpdmF0ZSBhc3luYyByZXNvbHZlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBiYWNrdXBSb290U3RhdCA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UucmVzb2x2ZSh0aGlzLmJhY2t1cFJvb3QpO1xuXHRcdFx0aWYgKGJhY2t1cFJvb3RTdGF0LmNoaWxkcmVuKSB7XG5cdFx0XHRcdGF3YWl0IFByb21pc2VzLnNldHRsZWQoYmFja3VwUm9vdFN0YXQuY2hpbGRyZW5cblx0XHRcdFx0XHQuZmlsdGVyKGNoaWxkID0+IGNoaWxkLmlzRGlyZWN0b3J5KVxuXHRcdFx0XHRcdC5tYXAoYXN5bmMgYmFja3VwU2NoZW1hRm9sZGVyID0+IHtcblxuXHRcdFx0XHRcdFx0Ly8gUmVhZCBiYWNrdXAgZGlyZWN0b3J5IGZvciBiYWNrdXBzXG5cdFx0XHRcdFx0XHRjb25zdCBiYWNrdXBTY2hlbWFGb2xkZXJTdGF0ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZXNvbHZlKGJhY2t1cFNjaGVtYUZvbGRlci5yZXNvdXJjZSk7XG5cblx0XHRcdFx0XHRcdC8vIFJlbWVtYmVyIGtub3duIGJhY2t1cHMgaW4gb3VyIGNhY2hlc1xuXHRcdFx0XHRcdFx0Ly9cblx0XHRcdFx0XHRcdC8vIE5vdGU6IHRoaXMgZG9lcyBOT1QgYWNjb3VudCBmb3IgcmVzb2x2aW5nXG5cdFx0XHRcdFx0XHQvLyBhc3NvY2lhdGVkIG1ldGEgZGF0YSBiZWNhdXNlIHRoYXQgcmVxdWlyZXNcblx0XHRcdFx0XHRcdC8vIG9wZW5pbmcgdGhlIGJhY2t1cCBhbmQgcmVhZGluZyB0aGUgbWV0YVxuXHRcdFx0XHRcdFx0Ly8gcHJlYW1ibGUuIEluc3RlYWQsIHdoZW4gYmFja3VwcyBhcmUgYWN0dWFsbHlcblx0XHRcdFx0XHRcdC8vIHJlc29sdmVkLCB0aGUgbWV0YSBkYXRhIHdpbGwgYmUgYWRkZWQgdmlhXG5cdFx0XHRcdFx0XHQvLyBhZGRpdGlvbmFsIGB1cGRhdGVgIGNhbGxzLlxuXHRcdFx0XHRcdFx0aWYgKGJhY2t1cFNjaGVtYUZvbGRlclN0YXQuY2hpbGRyZW4pIHtcblx0XHRcdFx0XHRcdFx0Zm9yIChjb25zdCBiYWNrdXBGb3JTY2hlbWEgb2YgYmFja3VwU2NoZW1hRm9sZGVyU3RhdC5jaGlsZHJlbikge1xuXHRcdFx0XHRcdFx0XHRcdGlmICghYmFja3VwRm9yU2NoZW1hLmlzRGlyZWN0b3J5KSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0aGlzLmFkZChiYWNrdXBGb3JTY2hlbWEucmVzb3VyY2UpO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0Ly8gaWdub3JlIGFueSBlcnJvcnNcblx0XHR9XG5cdH1cblxuXHRhZGQocmVzb3VyY2U6IFVSSSwgdmVyc2lvbklkID0gMCwgbWV0YT86IElXb3JraW5nQ29weUJhY2t1cE1ldGEpOiB2b2lkIHtcblx0XHR0aGlzLmNhY2hlLnNldChyZXNvdXJjZSwge1xuXHRcdFx0dmVyc2lvbklkLFxuXHRcdFx0bWV0YTogZGVlcENsb25lKG1ldGEpXG5cdFx0fSk7XG5cdH1cblxuXHR1cGRhdGUocmVzb3VyY2U6IFVSSSwgbWV0YT86IElXb3JraW5nQ29weUJhY2t1cE1ldGEpOiB2b2lkIHtcblx0XHRjb25zdCBlbnRyeSA9IHRoaXMuY2FjaGUuZ2V0KHJlc291cmNlKTtcblx0XHRpZiAoZW50cnkpIHtcblx0XHRcdGVudHJ5Lm1ldGEgPSBkZWVwQ2xvbmUobWV0YSk7XG5cdFx0fVxuXHR9XG5cblx0Y291bnQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5jYWNoZS5zaXplO1xuXHR9XG5cblx0aGFzKHJlc291cmNlOiBVUkksIHZlcnNpb25JZD86IG51bWJlciwgbWV0YT86IElXb3JraW5nQ29weUJhY2t1cE1ldGEpOiBib29sZWFuIHtcblx0XHRjb25zdCBlbnRyeSA9IHRoaXMuY2FjaGUuZ2V0KHJlc291cmNlKTtcblx0XHRpZiAoIWVudHJ5KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7IC8vIHVua25vd24gcmVzb3VyY2Vcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIHZlcnNpb25JZCA9PT0gJ251bWJlcicgJiYgdmVyc2lvbklkICE9PSBlbnRyeS52ZXJzaW9uSWQpIHtcblx0XHRcdHJldHVybiBmYWxzZTsgLy8gZGlmZmVyZW50IHZlcnNpb25JZFxuXHRcdH1cblxuXHRcdGlmIChtZXRhICYmICFlcXVhbHMobWV0YSwgZW50cnkubWV0YSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTsgLy8gZGlmZmVyZW50IG1ldGFkYXRhXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRnZXQoKTogVVJJW10ge1xuXHRcdHJldHVybiBBcnJheS5mcm9tKHRoaXMuY2FjaGUua2V5cygpKTtcblx0fVxuXG5cdHJlbW92ZShyZXNvdXJjZTogVVJJKTogdm9pZCB7XG5cdFx0dGhpcy5jYWNoZS5kZWxldGUocmVzb3VyY2UpO1xuXHR9XG5cblx0Y2xlYXIoKTogdm9pZCB7XG5cdFx0dGhpcy5jYWNoZS5jbGVhcigpO1xuXHR9XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtpbmdDb3B5QmFja3VwU2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBpbXBsOiBXb3JraW5nQ29weUJhY2t1cFNlcnZpY2VJbXBsIHwgSW5NZW1vcnlXb3JraW5nQ29weUJhY2t1cFNlcnZpY2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0YmFja3VwV29ya3NwYWNlSG9tZTogVVJJIHwgdW5kZWZpbmVkLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJvdGVjdGVkIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuaW1wbCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5pdGlhbGl6ZShiYWNrdXBXb3Jrc3BhY2VIb21lKSk7XG5cdH1cblxuXHRwcml2YXRlIGluaXRpYWxpemUoYmFja3VwV29ya3NwYWNlSG9tZTogVVJJIHwgdW5kZWZpbmVkKTogV29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlSW1wbCB8IEluTWVtb3J5V29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlIHtcblx0XHRpZiAoYmFja3VwV29ya3NwYWNlSG9tZSkge1xuXHRcdFx0cmV0dXJuIG5ldyBXb3JraW5nQ29weUJhY2t1cFNlcnZpY2VJbXBsKGJhY2t1cFdvcmtzcGFjZUhvbWUsIHRoaXMuZmlsZVNlcnZpY2UsIHRoaXMubG9nU2VydmljZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyBJbk1lbW9yeVdvcmtpbmdDb3B5QmFja3VwU2VydmljZSgpO1xuXHR9XG5cblx0cmVpbml0aWFsaXplKGJhY2t1cFdvcmtzcGFjZUhvbWU6IFVSSSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXG5cdFx0Ly8gUmUtaW5pdCBpbXBsZW1lbnRhdGlvbiAodW5sZXNzIHdlIGFyZSBydW5uaW5nIGluLW1lbW9yeSlcblx0XHRpZiAodGhpcy5pbXBsIGluc3RhbmNlb2YgV29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlSW1wbCkge1xuXHRcdFx0aWYgKGJhY2t1cFdvcmtzcGFjZUhvbWUpIHtcblx0XHRcdFx0dGhpcy5pbXBsLmluaXRpYWxpemUoYmFja3VwV29ya3NwYWNlSG9tZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmltcGwgPSBuZXcgSW5NZW1vcnlXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRoYXNCYWNrdXBzKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiB0aGlzLmltcGwuaGFzQmFja3VwcygpO1xuXHR9XG5cblx0aGFzQmFja3VwU3luYyhpZGVudGlmaWVyOiBJV29ya2luZ0NvcHlJZGVudGlmaWVyLCB2ZXJzaW9uSWQ/OiBudW1iZXIsIG1ldGE/OiBJV29ya2luZ0NvcHlCYWNrdXBNZXRhKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuaW1wbC5oYXNCYWNrdXBTeW5jKGlkZW50aWZpZXIsIHZlcnNpb25JZCwgbWV0YSk7XG5cdH1cblxuXHRiYWNrdXAoaWRlbnRpZmllcjogSVdvcmtpbmdDb3B5SWRlbnRpZmllciwgY29udGVudD86IFZTQnVmZmVyUmVhZGFibGVTdHJlYW0gfCBWU0J1ZmZlclJlYWRhYmxlLCB2ZXJzaW9uSWQ/OiBudW1iZXIsIG1ldGE/OiBJV29ya2luZ0NvcHlCYWNrdXBNZXRhLCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuaW1wbC5iYWNrdXAoaWRlbnRpZmllciwgY29udGVudCwgdmVyc2lvbklkLCBtZXRhLCB0b2tlbik7XG5cdH1cblxuXHRkaXNjYXJkQmFja3VwKGlkZW50aWZpZXI6IElXb3JraW5nQ29weUlkZW50aWZpZXIsIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5pbXBsLmRpc2NhcmRCYWNrdXAoaWRlbnRpZmllciwgdG9rZW4pO1xuXHR9XG5cblx0ZGlzY2FyZEJhY2t1cHMoZmlsdGVyPzogeyBleGNlcHQ6IElXb3JraW5nQ29weUlkZW50aWZpZXJbXSB9KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuaW1wbC5kaXNjYXJkQmFja3VwcyhmaWx0ZXIpO1xuXHR9XG5cblx0Z2V0QmFja3VwcygpOiBQcm9taXNlPElXb3JraW5nQ29weUlkZW50aWZpZXJbXT4ge1xuXHRcdHJldHVybiB0aGlzLmltcGwuZ2V0QmFja3VwcygpO1xuXHR9XG5cblx0cmVzb2x2ZTxUIGV4dGVuZHMgSVdvcmtpbmdDb3B5QmFja3VwTWV0YT4oaWRlbnRpZmllcjogSVdvcmtpbmdDb3B5SWRlbnRpZmllcik6IFByb21pc2U8SVJlc29sdmVkV29ya2luZ0NvcHlCYWNrdXA8VD4gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5pbXBsLnJlc29sdmUoaWRlbnRpZmllcik7XG5cdH1cblxuXHR0b0JhY2t1cFJlc291cmNlKGlkZW50aWZpZXI6IElXb3JraW5nQ29weUlkZW50aWZpZXIpOiBVUkkge1xuXHRcdHJldHVybiB0aGlzLmltcGwudG9CYWNrdXBSZXNvdXJjZShpZGVudGlmaWVyKTtcblx0fVxuXG5cdGpvaW5CYWNrdXBzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLmltcGwuam9pbkJhY2t1cHMoKTtcblx0fVxufVxuXG5jbGFzcyBXb3JraW5nQ29weUJhY2t1cFNlcnZpY2VJbXBsIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JraW5nQ29weUJhY2t1cFNlcnZpY2Uge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFBSRUFNQkxFX0VORF9NQVJLRVIgPSAnXFxuJztcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgUFJFQU1CTEVfRU5EX01BUktFUl9DSEFSQ09ERSA9ICdcXG4nLmNoYXJDb2RlQXQoMCk7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFBSRUFNQkxFX01FVEFfU0VQQVJBVE9SID0gJyAnOyAvLyB1c2luZyBhIGNoYXJhY3RlciB0aGF0IGlzIGtub3cgdG8gYmUgZXNjYXBlZCBpbiBhIFVSSSBhcyBzZXBhcmF0b3Jcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgUFJFQU1CTEVfTUFYX0xFTkdUSCA9IDEwMDAwO1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgaW9PcGVyYXRpb25RdWV1ZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgUmVzb3VyY2VRdWV1ZSgpKTsgLy8gcXVldWUgSU8gb3BlcmF0aW9ucyB0byBlbnN1cmUgd3JpdGUvZGVsZXRlIGZpbGUgb3JkZXJcblxuXHRwcml2YXRlIHJlYWR5ITogUHJvbWlzZTxXb3JraW5nQ29weUJhY2t1cHNNb2RlbD47XG5cdHByaXZhdGUgbW9kZWw6IFdvcmtpbmdDb3B5QmFja3Vwc01vZGVsIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgYmFja3VwV29ya3NwYWNlSG9tZTogVVJJLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmluaXRpYWxpemUoYmFja3VwV29ya3NwYWNlSG9tZSk7XG5cdH1cblxuXHRpbml0aWFsaXplKGJhY2t1cFdvcmtzcGFjZVJlc291cmNlOiBVUkkpOiB2b2lkIHtcblx0XHR0aGlzLmJhY2t1cFdvcmtzcGFjZUhvbWUgPSBiYWNrdXBXb3Jrc3BhY2VSZXNvdXJjZTtcblxuXHRcdHRoaXMucmVhZHkgPSB0aGlzLmRvSW5pdGlhbGl6ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb0luaXRpYWxpemUoKTogUHJvbWlzZTxXb3JraW5nQ29weUJhY2t1cHNNb2RlbD4ge1xuXG5cdFx0Ly8gQ3JlYXRlIGJhY2t1cCBtb2RlbFxuXHRcdHRoaXMubW9kZWwgPSBhd2FpdCBXb3JraW5nQ29weUJhY2t1cHNNb2RlbC5jcmVhdGUodGhpcy5iYWNrdXBXb3Jrc3BhY2VIb21lLCB0aGlzLmZpbGVTZXJ2aWNlKTtcblxuXHRcdHJldHVybiB0aGlzLm1vZGVsO1xuXHR9XG5cblx0YXN5bmMgaGFzQmFja3VwcygpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCBtb2RlbCA9IGF3YWl0IHRoaXMucmVhZHk7XG5cblx0XHQvLyBFbnN1cmUgdG8gYXdhaXQgYW55IHBlbmRpbmcgYmFja3VwIG9wZXJhdGlvbnNcblx0XHRhd2FpdCB0aGlzLmpvaW5CYWNrdXBzKCk7XG5cblx0XHRyZXR1cm4gbW9kZWwuY291bnQoKSA+IDA7XG5cdH1cblxuXHRoYXNCYWNrdXBTeW5jKGlkZW50aWZpZXI6IElXb3JraW5nQ29weUlkZW50aWZpZXIsIHZlcnNpb25JZD86IG51bWJlciwgbWV0YT86IElXb3JraW5nQ29weUJhY2t1cE1ldGEpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMubW9kZWwpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRjb25zdCBiYWNrdXBSZXNvdXJjZSA9IHRoaXMudG9CYWNrdXBSZXNvdXJjZShpZGVudGlmaWVyKTtcblxuXHRcdHJldHVybiB0aGlzLm1vZGVsLmhhcyhiYWNrdXBSZXNvdXJjZSwgdmVyc2lvbklkLCBtZXRhKTtcblx0fVxuXG5cdGFzeW5jIGJhY2t1cChpZGVudGlmaWVyOiBJV29ya2luZ0NvcHlJZGVudGlmaWVyLCBjb250ZW50PzogVlNCdWZmZXJSZWFkYWJsZSB8IFZTQnVmZmVyUmVhZGFibGVTdHJlYW0sIHZlcnNpb25JZD86IG51bWJlciwgbWV0YT86IElXb3JraW5nQ29weUJhY2t1cE1ldGEsIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBtb2RlbCA9IGF3YWl0IHRoaXMucmVhZHk7XG5cdFx0aWYgKHRva2VuPy5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGJhY2t1cFJlc291cmNlID0gdGhpcy50b0JhY2t1cFJlc291cmNlKGlkZW50aWZpZXIpO1xuXHRcdGlmIChtb2RlbC5oYXMoYmFja3VwUmVzb3VyY2UsIHZlcnNpb25JZCwgbWV0YSkpIHtcblx0XHRcdC8vIHJldHVybiBlYXJseSBpZiBiYWNrdXAgdmVyc2lvbiBpZCBtYXRjaGVzIHJlcXVlc3RlZCBvbmVcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5pb09wZXJhdGlvblF1ZXVlcy5xdWV1ZUZvcihiYWNrdXBSZXNvdXJjZSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0aWYgKHRva2VuPy5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChtb2RlbC5oYXMoYmFja3VwUmVzb3VyY2UsIHZlcnNpb25JZCwgbWV0YSkpIHtcblx0XHRcdFx0Ly8gcmV0dXJuIGVhcmx5IGlmIGJhY2t1cCB2ZXJzaW9uIGlkIG1hdGNoZXMgcmVxdWVzdGVkIG9uZVxuXHRcdFx0XHQvLyB0aGlzIGNhbiBoYXBwZW4gd2hlbiBtdWx0aXBsZSBiYWNrdXAgSU8gb3BlcmF0aW9ucyBnb3Rcblx0XHRcdFx0Ly8gc2NoZWR1bGVkLCByYWNpbmcgYWdhaW5zdCBlYWNoIG90aGVyLlxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIEVuY29kZSBhczogUmVzb3VyY2UgKyBNRVRBLVNUQVJUICsgTWV0YSArIEVORFxuXHRcdFx0Ly8gYW5kIHJlc3BlY3QgbWF4IGxlbmd0aCByZXN0cmljdGlvbnMgaW4gY2FzZVxuXHRcdFx0Ly8gbWV0YSBpcyB0b28gbGFyZ2UuXG5cdFx0XHRsZXQgcHJlYW1ibGUgPSB0aGlzLmNyZWF0ZVByZWFtYmxlKGlkZW50aWZpZXIsIG1ldGEpO1xuXHRcdFx0aWYgKHByZWFtYmxlLmxlbmd0aCA+PSBXb3JraW5nQ29weUJhY2t1cFNlcnZpY2VJbXBsLlBSRUFNQkxFX01BWF9MRU5HVEgpIHtcblx0XHRcdFx0cHJlYW1ibGUgPSB0aGlzLmNyZWF0ZVByZWFtYmxlKGlkZW50aWZpZXIpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBVcGRhdGUgYmFja3VwIHdpdGggdmFsdWVcblx0XHRcdGNvbnN0IHByZWFtYmxlQnVmZmVyID0gVlNCdWZmZXIuZnJvbVN0cmluZyhwcmVhbWJsZSk7XG5cdFx0XHRsZXQgYmFja3VwQnVmZmVyOiBWU0J1ZmZlciB8IFZTQnVmZmVyUmVhZGFibGVTdHJlYW0gfCBWU0J1ZmZlclJlYWRhYmxlO1xuXHRcdFx0aWYgKGlzUmVhZGFibGVTdHJlYW0oY29udGVudCkpIHtcblx0XHRcdFx0YmFja3VwQnVmZmVyID0gcHJlZml4ZWRCdWZmZXJTdHJlYW0ocHJlYW1ibGVCdWZmZXIsIGNvbnRlbnQpO1xuXHRcdFx0fSBlbHNlIGlmIChjb250ZW50KSB7XG5cdFx0XHRcdGJhY2t1cEJ1ZmZlciA9IHByZWZpeGVkQnVmZmVyUmVhZGFibGUocHJlYW1ibGVCdWZmZXIsIGNvbnRlbnQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YmFja3VwQnVmZmVyID0gVlNCdWZmZXIuY29uY2F0KFtwcmVhbWJsZUJ1ZmZlciwgVlNCdWZmZXIuZnJvbVN0cmluZygnJyldKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gV3JpdGUgYmFja3VwIHZpYSBmaWxlIHNlcnZpY2Vcblx0XHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2Uud3JpdGVGaWxlKGJhY2t1cFJlc291cmNlLCBiYWNrdXBCdWZmZXIpO1xuXG5cdFx0XHQvL1xuXHRcdFx0Ly8gVXBkYXRlIG1vZGVsXG5cdFx0XHQvL1xuXHRcdFx0Ly8gTm90ZTogbm90IGNoZWNraW5nIGZvciBjYW5jZWxsYXRpb24gaGVyZSBiZWNhdXNlIGEgc3VjY2Vzc2Z1bFxuXHRcdFx0Ly8gd3JpdGUgaW50byB0aGUgYmFja3VwIGZpbGUgc2hvdWxkIGJlIG5vdGVkIGluIHRoZSBtb2RlbCB0b1xuXHRcdFx0Ly8gcHJldmVudCB0aGUgbW9kZWwgYmVpbmcgb3V0IG9mIHN5bmMgd2l0aCB0aGUgYmFja3VwIGZpbGVcblx0XHRcdG1vZGVsLmFkZChiYWNrdXBSZXNvdXJjZSwgdmVyc2lvbklkLCBtZXRhKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlUHJlYW1ibGUoaWRlbnRpZmllcjogSVdvcmtpbmdDb3B5SWRlbnRpZmllciwgbWV0YT86IElXb3JraW5nQ29weUJhY2t1cE1ldGEpOiBzdHJpbmcge1xuXHRcdHJldHVybiBgJHtpZGVudGlmaWVyLnJlc291cmNlLnRvU3RyaW5nKCl9JHtXb3JraW5nQ29weUJhY2t1cFNlcnZpY2VJbXBsLlBSRUFNQkxFX01FVEFfU0VQQVJBVE9SfSR7SlNPTi5zdHJpbmdpZnkoeyAuLi5tZXRhLCB0eXBlSWQ6IGlkZW50aWZpZXIudHlwZUlkIH0pfSR7V29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlSW1wbC5QUkVBTUJMRV9FTkRfTUFSS0VSfWA7XG5cdH1cblxuXHRhc3luYyBkaXNjYXJkQmFja3VwcyhmaWx0ZXI/OiB7IGV4Y2VwdDogSVdvcmtpbmdDb3B5SWRlbnRpZmllcltdIH0pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBtb2RlbCA9IGF3YWl0IHRoaXMucmVhZHk7XG5cblx0XHQvLyBEaXNjYXJkIGFsbCBidXQgc29tZSBiYWNrdXBzXG5cdFx0Y29uc3QgZXhjZXB0ID0gZmlsdGVyPy5leGNlcHQ7XG5cdFx0aWYgKEFycmF5LmlzQXJyYXkoZXhjZXB0KSAmJiBleGNlcHQubGVuZ3RoID4gMCkge1xuXHRcdFx0Y29uc3QgZXhjZXB0TWFwID0gbmV3IFJlc291cmNlTWFwPGJvb2xlYW4+KCk7XG5cdFx0XHRmb3IgKGNvbnN0IGV4Y2VwdFdvcmtpbmdDb3B5IG9mIGV4Y2VwdCkge1xuXHRcdFx0XHRleGNlcHRNYXAuc2V0KHRoaXMudG9CYWNrdXBSZXNvdXJjZShleGNlcHRXb3JraW5nQ29weSksIHRydWUpO1xuXHRcdFx0fVxuXG5cdFx0XHRhd2FpdCBQcm9taXNlcy5zZXR0bGVkKG1vZGVsLmdldCgpLm1hcChhc3luYyBiYWNrdXBSZXNvdXJjZSA9PiB7XG5cdFx0XHRcdGlmICghZXhjZXB0TWFwLmhhcyhiYWNrdXBSZXNvdXJjZSkpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmRvRGlzY2FyZEJhY2t1cChiYWNrdXBSZXNvdXJjZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cblx0XHQvLyBEaXNjYXJkIGFsbCBiYWNrdXBzXG5cdFx0ZWxzZSB7XG5cdFx0XHRhd2FpdCB0aGlzLmRlbGV0ZUlnbm9yZUZpbGVOb3RGb3VuZCh0aGlzLmJhY2t1cFdvcmtzcGFjZUhvbWUpO1xuXG5cdFx0XHRtb2RlbC5jbGVhcigpO1xuXHRcdH1cblx0fVxuXG5cdGRpc2NhcmRCYWNrdXAoaWRlbnRpZmllcjogSVdvcmtpbmdDb3B5SWRlbnRpZmllciwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGJhY2t1cFJlc291cmNlID0gdGhpcy50b0JhY2t1cFJlc291cmNlKGlkZW50aWZpZXIpO1xuXG5cdFx0cmV0dXJuIHRoaXMuZG9EaXNjYXJkQmFja3VwKGJhY2t1cFJlc291cmNlLCB0b2tlbik7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvRGlzY2FyZEJhY2t1cChiYWNrdXBSZXNvdXJjZTogVVJJLCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCB0aGlzLnJlYWR5O1xuXHRcdGlmICh0b2tlbj8uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5pb09wZXJhdGlvblF1ZXVlcy5xdWV1ZUZvcihiYWNrdXBSZXNvdXJjZSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0aWYgKHRva2VuPy5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIERlbGV0ZSBiYWNrdXAgZmlsZSBpZ25vcmluZyBhbnkgZmlsZSBub3QgZm91bmQgZXJyb3JzXG5cdFx0XHRhd2FpdCB0aGlzLmRlbGV0ZUlnbm9yZUZpbGVOb3RGb3VuZChiYWNrdXBSZXNvdXJjZSk7XG5cblx0XHRcdC8vXG5cdFx0XHQvLyBVcGRhdGUgbW9kZWxcblx0XHRcdC8vXG5cdFx0XHQvLyBOb3RlOiBub3QgY2hlY2tpbmcgZm9yIGNhbmNlbGxhdGlvbiBoZXJlIGJlY2F1c2UgYSBzdWNjZXNzZnVsXG5cdFx0XHQvLyBkZWxldGUgb2YgdGhlIGJhY2t1cCBmaWxlIHNob3VsZCBiZSBub3RlZCBpbiB0aGUgbW9kZWwgdG9cblx0XHRcdC8vIHByZXZlbnQgdGhlIG1vZGVsIGJlaW5nIG91dCBvZiBzeW5jIHdpdGggdGhlIGJhY2t1cCBmaWxlXG5cdFx0XHRtb2RlbC5yZW1vdmUoYmFja3VwUmVzb3VyY2UpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkZWxldGVJZ25vcmVGaWxlTm90Rm91bmQoYmFja3VwUmVzb3VyY2U6IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmRlbChiYWNrdXBSZXNvdXJjZSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGlmICgoPEZpbGVPcGVyYXRpb25FcnJvcj5lcnJvcikuZmlsZU9wZXJhdGlvblJlc3VsdCAhPT0gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9GT1VORCkge1xuXHRcdFx0XHR0aHJvdyBlcnJvcjsgLy8gcmUtdGhyb3cgYW55IG90aGVyIGVycm9yIHRoYW4gZmlsZSBub3QgZm91bmQgd2hpY2ggaXMgT0tcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRhc3luYyBnZXRCYWNrdXBzKCk6IFByb21pc2U8SVdvcmtpbmdDb3B5SWRlbnRpZmllcltdPiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCB0aGlzLnJlYWR5O1xuXG5cdFx0Ly8gRW5zdXJlIHRvIGF3YWl0IGFueSBwZW5kaW5nIGJhY2t1cCBvcGVyYXRpb25zXG5cdFx0YXdhaXQgdGhpcy5qb2luQmFja3VwcygpO1xuXG5cdFx0Y29uc3QgYmFja3VwcyA9IGF3YWl0IFByb21pc2UuYWxsKG1vZGVsLmdldCgpLm1hcChiYWNrdXBSZXNvdXJjZSA9PiB0aGlzLnJlc29sdmVJZGVudGlmaWVyKGJhY2t1cFJlc291cmNlLCBtb2RlbCkpKTtcblxuXHRcdHJldHVybiBjb2FsZXNjZShiYWNrdXBzKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVzb2x2ZUlkZW50aWZpZXIoYmFja3VwUmVzb3VyY2U6IFVSSSwgbW9kZWw6IFdvcmtpbmdDb3B5QmFja3Vwc01vZGVsKTogUHJvbWlzZTxJV29ya2luZ0NvcHlJZGVudGlmaWVyIHwgdW5kZWZpbmVkPiB7XG5cdFx0bGV0IHJlczogSVdvcmtpbmdDb3B5SWRlbnRpZmllciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdGF3YWl0IHRoaXMuaW9PcGVyYXRpb25RdWV1ZXMucXVldWVGb3IoYmFja3VwUmVzb3VyY2UsIGFzeW5jICgpID0+IHtcblx0XHRcdGlmICghbW9kZWwuaGFzKGJhY2t1cFJlc291cmNlKSkge1xuXHRcdFx0XHRyZXR1cm47IC8vIHJlcXVpcmUgYmFja3VwIHRvIGJlIHByZXNlbnRcblx0XHRcdH1cblxuXHRcdFx0Ly8gUmVhZCB0aGUgZW50aXJlIGJhY2t1cCBwcmVhbWJsZSBieSByZWFkaW5nIHVwIHRvXG5cdFx0XHQvLyBgUFJFQU1CTEVfTUFYX0xFTkdUSGAgaW4gdGhlIGJhY2t1cCBmaWxlIHVudGlsXG5cdFx0XHQvLyB0aGUgYFBSRUFNQkxFX0VORF9NQVJLRVJgIGlzIGZvdW5kXG5cdFx0XHRjb25zdCBiYWNrdXBQcmVhbWJsZSA9IGF3YWl0IHRoaXMucmVhZFRvTWF0Y2hpbmdTdHJpbmcoYmFja3VwUmVzb3VyY2UsIFdvcmtpbmdDb3B5QmFja3VwU2VydmljZUltcGwuUFJFQU1CTEVfRU5EX01BUktFUiwgV29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlSW1wbC5QUkVBTUJMRV9NQVhfTEVOR1RIKTtcblx0XHRcdGlmICghYmFja3VwUHJlYW1ibGUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBGaWd1cmUgb3V0IHRoZSBvZmZzZXQgaW4gdGhlIHByZWFtYmxlIHdoZXJlIG1ldGFcblx0XHRcdC8vIGluZm9ybWF0aW9uIHBvc3NpYmx5IHN0YXJ0cy4gVGhpcyBjYW4gYmUgYC0xYCBmb3Jcblx0XHRcdC8vIG9sZGVyIGJhY2t1cHMgd2l0aG91dCBtZXRhLlxuXHRcdFx0Y29uc3QgbWV0YVN0YXJ0SW5kZXggPSBiYWNrdXBQcmVhbWJsZS5pbmRleE9mKFdvcmtpbmdDb3B5QmFja3VwU2VydmljZUltcGwuUFJFQU1CTEVfTUVUQV9TRVBBUkFUT1IpO1xuXG5cdFx0XHQvLyBFeHRyYWN0IHRoZSBwcmVhbWJsZSBjb250ZW50IGZvciByZXNvdXJjZSBhbmQgbWV0YVxuXHRcdFx0bGV0IHJlc291cmNlUHJlYW1ibGU6IHN0cmluZztcblx0XHRcdGxldCBtZXRhUHJlYW1ibGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRcdGlmIChtZXRhU3RhcnRJbmRleCA+IDApIHtcblx0XHRcdFx0cmVzb3VyY2VQcmVhbWJsZSA9IGJhY2t1cFByZWFtYmxlLnN1YnN0cmluZygwLCBtZXRhU3RhcnRJbmRleCk7XG5cdFx0XHRcdG1ldGFQcmVhbWJsZSA9IGJhY2t1cFByZWFtYmxlLnN1YnN0cihtZXRhU3RhcnRJbmRleCArIDEpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzb3VyY2VQcmVhbWJsZSA9IGJhY2t1cFByZWFtYmxlO1xuXHRcdFx0XHRtZXRhUHJlYW1ibGUgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFRyeSB0byBwYXJzZSB0aGUgbWV0YSBwcmVhbWJsZSBmb3IgZmlndXJpbmcgb3V0XG5cdFx0XHQvLyBgdHlwZUlkYCBhbmQgYG1ldGFgIGlmIGRlZmluZWQuXG5cdFx0XHRjb25zdCB7IHR5cGVJZCwgbWV0YSB9ID0gdGhpcy5wYXJzZVByZWFtYmxlTWV0YShtZXRhUHJlYW1ibGUpO1xuXG5cdFx0XHQvLyBVcGRhdGUgbW9kZWwgZW50cnkgd2l0aCBub3cgcmVzb2x2ZWQgbWV0YVxuXHRcdFx0bW9kZWwudXBkYXRlKGJhY2t1cFJlc291cmNlLCBtZXRhKTtcblxuXHRcdFx0cmVzID0ge1xuXHRcdFx0XHR0eXBlSWQ6IHR5cGVJZCA/PyBOT19UWVBFX0lELFxuXHRcdFx0XHRyZXNvdXJjZTogVVJJLnBhcnNlKHJlc291cmNlUHJlYW1ibGUpXG5cdFx0XHR9O1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHJlcztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVhZFRvTWF0Y2hpbmdTdHJpbmcoYmFja3VwUmVzb3VyY2U6IFVSSSwgbWF0Y2hpbmdTdHJpbmc6IHN0cmluZywgbWF4aW11bUJ5dGVzVG9SZWFkOiBudW1iZXIpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGNvbnRlbnRzID0gKGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UucmVhZEZpbGUoYmFja3VwUmVzb3VyY2UsIHsgbGVuZ3RoOiBtYXhpbXVtQnl0ZXNUb1JlYWQgfSkpLnZhbHVlLnRvU3RyaW5nKCk7XG5cblx0XHRjb25zdCBtYXRjaGluZ1N0cmluZ0luZGV4ID0gY29udGVudHMuaW5kZXhPZihtYXRjaGluZ1N0cmluZyk7XG5cdFx0aWYgKG1hdGNoaW5nU3RyaW5nSW5kZXggPj0gMCkge1xuXHRcdFx0cmV0dXJuIGNvbnRlbnRzLnN1YnN0cigwLCBtYXRjaGluZ1N0cmluZ0luZGV4KTtcblx0XHR9XG5cblx0XHQvLyBVbmFibGUgdG8gZmluZCBtYXRjaGluZyBzdHJpbmcgaW4gZmlsZVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRhc3luYyByZXNvbHZlPFQgZXh0ZW5kcyBJV29ya2luZ0NvcHlCYWNrdXBNZXRhPihpZGVudGlmaWVyOiBJV29ya2luZ0NvcHlJZGVudGlmaWVyKTogUHJvbWlzZTxJUmVzb2x2ZWRXb3JraW5nQ29weUJhY2t1cDxUPiB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGJhY2t1cFJlc291cmNlID0gdGhpcy50b0JhY2t1cFJlc291cmNlKGlkZW50aWZpZXIpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCB0aGlzLnJlYWR5O1xuXG5cdFx0bGV0IHJlczogSVJlc29sdmVkV29ya2luZ0NvcHlCYWNrdXA8VD4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRhd2FpdCB0aGlzLmlvT3BlcmF0aW9uUXVldWVzLnF1ZXVlRm9yKGJhY2t1cFJlc291cmNlLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRpZiAoIW1vZGVsLmhhcyhiYWNrdXBSZXNvdXJjZSkpIHtcblx0XHRcdFx0cmV0dXJuOyAvLyByZXF1aXJlIGJhY2t1cCB0byBiZSBwcmVzZW50XG5cdFx0XHR9XG5cblx0XHRcdC8vIExvYWQgdGhlIGJhY2t1cCBjb250ZW50IGFuZCBwZWVrIGludG8gdGhlIGZpcnN0IGNodW5rXG5cdFx0XHQvLyB0byBiZSBhYmxlIHRvIHJlc29sdmUgdGhlIG1ldGEgZGF0YVxuXHRcdFx0Y29uc3QgYmFja3VwU3RyZWFtID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZWFkRmlsZVN0cmVhbShiYWNrdXBSZXNvdXJjZSk7XG5cdFx0XHRjb25zdCBwZWVrZWRCYWNrdXBTdHJlYW0gPSBhd2FpdCBwZWVrU3RyZWFtKGJhY2t1cFN0cmVhbS52YWx1ZSwgMSk7XG5cdFx0XHRjb25zdCBmaXJzdEJhY2t1cENodW5rID0gVlNCdWZmZXIuY29uY2F0KHBlZWtlZEJhY2t1cFN0cmVhbS5idWZmZXIpO1xuXG5cdFx0XHQvLyBXZSBoYXZlIHNlZW4gcmVwb3J0cyAoZS5nLiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNzg1MDApIHdoZXJlXG5cdFx0XHQvLyBpZiBWU0NvZGUgZ29lcyBkb3duIHdoaWxlIHdyaXRpbmcgdGhlIGJhY2t1cCBmaWxlLCB0aGUgZmlsZSBjYW4gdHVybiBlbXB0eSBiZWNhdXNlXG5cdFx0XHQvLyBpdCBhbHdheXMgZmlyc3QgZ2V0cyB0cnVuY2F0ZWQgYW5kIHRoZW4gd3JpdHRlbiB0by4gSW4gdGhpcyBjYXNlLCB3ZSB3aWxsIG5vdCBmaW5kXG5cdFx0XHQvLyB0aGUgbWV0YS1lbmQgbWFya2VyICgnXFxuJykgYW5kIGFzIHN1Y2ggdGhlIGJhY2t1cCBjYW4gb25seSBiZSBpbnZhbGlkLiBXZSBiYWlsIG91dFxuXHRcdFx0Ly8gaGVyZSBpZiB0aGF0IGlzIHRoZSBjYXNlLlxuXHRcdFx0Y29uc3QgcHJlYW1ibGVFbmRJbmRleCA9IGZpcnN0QmFja3VwQ2h1bmsuYnVmZmVyLmluZGV4T2YoV29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlSW1wbC5QUkVBTUJMRV9FTkRfTUFSS0VSX0NIQVJDT0RFKTtcblx0XHRcdGlmIChwcmVhbWJsZUVuZEluZGV4ID09PSAtMSkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYEJhY2t1cDogQ291bGQgbm90IGZpbmQgbWV0YSBlbmQgbWFya2VyIGluICR7YmFja3VwUmVzb3VyY2V9LiBUaGUgZmlsZSBpcyBwcm9iYWJseSBjb3JydXB0IChmaWxlc2l6ZTogJHtiYWNrdXBTdHJlYW0uc2l6ZX0pLmApO1xuXG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHByZWFtYmVsUmF3ID0gZmlyc3RCYWNrdXBDaHVuay5zbGljZSgwLCBwcmVhbWJsZUVuZEluZGV4KS50b1N0cmluZygpO1xuXG5cdFx0XHQvLyBFeHRyYWN0IG1ldGEgZGF0YSAoaWYgYW55KVxuXHRcdFx0bGV0IG1ldGE6IFQgfCB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCBtZXRhU3RhcnRJbmRleCA9IHByZWFtYmVsUmF3LmluZGV4T2YoV29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlSW1wbC5QUkVBTUJMRV9NRVRBX1NFUEFSQVRPUik7XG5cdFx0XHRpZiAobWV0YVN0YXJ0SW5kZXggIT09IC0xKSB7XG5cdFx0XHRcdG1ldGEgPSB0aGlzLnBhcnNlUHJlYW1ibGVNZXRhKHByZWFtYmVsUmF3LnN1YnN0cihtZXRhU3RhcnRJbmRleCArIDEpKS5tZXRhIGFzIFQ7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFVwZGF0ZSBtb2RlbCBlbnRyeSB3aXRoIG5vdyByZXNvbHZlZCBtZXRhXG5cdFx0XHRtb2RlbC51cGRhdGUoYmFja3VwUmVzb3VyY2UsIG1ldGEpO1xuXG5cdFx0XHQvLyBCdWlsZCBhIG5ldyBzdHJlYW0gd2l0aG91dCB0aGUgcHJlYW1ibGVcblx0XHRcdGNvbnN0IGZpcnN0QmFja3VwQ2h1bmtXaXRob3V0UHJlYW1ibGUgPSBmaXJzdEJhY2t1cENodW5rLnNsaWNlKHByZWFtYmxlRW5kSW5kZXggKyAxKTtcblx0XHRcdGxldCB2YWx1ZTogVlNCdWZmZXJSZWFkYWJsZVN0cmVhbTtcblx0XHRcdGlmIChwZWVrZWRCYWNrdXBTdHJlYW0uZW5kZWQpIHtcblx0XHRcdFx0dmFsdWUgPSBidWZmZXJUb1N0cmVhbShmaXJzdEJhY2t1cENodW5rV2l0aG91dFByZWFtYmxlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHZhbHVlID0gcHJlZml4ZWRCdWZmZXJTdHJlYW0oZmlyc3RCYWNrdXBDaHVua1dpdGhvdXRQcmVhbWJsZSwgcGVla2VkQmFja3VwU3RyZWFtLnN0cmVhbSk7XG5cdFx0XHR9XG5cblx0XHRcdHJlcyA9IHsgdmFsdWUsIG1ldGEgfTtcblx0XHR9KTtcblxuXHRcdHJldHVybiByZXM7XG5cdH1cblxuXHRwcml2YXRlIHBhcnNlUHJlYW1ibGVNZXRhPFQgZXh0ZW5kcyBJV29ya2luZ0NvcHlCYWNrdXBNZXRhPihwcmVhbWJsZU1ldGFSYXc6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHsgdHlwZUlkOiBzdHJpbmcgfCB1bmRlZmluZWQ7IG1ldGE6IFQgfCB1bmRlZmluZWQgfSB7XG5cdFx0bGV0IHR5cGVJZDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGxldCBtZXRhOiBUIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdFx0aWYgKHByZWFtYmxlTWV0YVJhdykge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0bWV0YSA9IEpTT04ucGFyc2UocHJlYW1ibGVNZXRhUmF3KTtcblx0XHRcdFx0dHlwZUlkID0gbWV0YT8udHlwZUlkO1xuXG5cdFx0XHRcdC8vIGB0eXBlSWRgIGlzIGEgcHJvcGVydHkgdGhhdCB3ZSBhZGQgc28gd2Vcblx0XHRcdFx0Ly8gcmVtb3ZlIGl0IHdoZW4gcmV0dXJuaW5nIHRvIGNsaWVudHMuXG5cdFx0XHRcdGlmICh0eXBlb2YgbWV0YT8udHlwZUlkID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdGRlbGV0ZSBtZXRhLnR5cGVJZDtcblxuXHRcdFx0XHRcdGlmIChpc0VtcHR5T2JqZWN0KG1ldGEpKSB7XG5cdFx0XHRcdFx0XHRtZXRhID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0Ly8gaWdub3JlIEpTT04gcGFyc2UgZXJyb3JzXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgdHlwZUlkLCBtZXRhIH07XG5cdH1cblxuXHR0b0JhY2t1cFJlc291cmNlKGlkZW50aWZpZXI6IElXb3JraW5nQ29weUlkZW50aWZpZXIpOiBVUkkge1xuXHRcdHJldHVybiBqb2luUGF0aCh0aGlzLmJhY2t1cFdvcmtzcGFjZUhvbWUsIGlkZW50aWZpZXIucmVzb3VyY2Uuc2NoZW1lLCBoYXNoSWRlbnRpZmllcihpZGVudGlmaWVyKSk7XG5cdH1cblxuXHRqb2luQmFja3VwcygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5pb09wZXJhdGlvblF1ZXVlcy53aGVuRHJhaW5lZCgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBJbk1lbW9yeVdvcmtpbmdDb3B5QmFja3VwU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIGJhY2t1cHMgPSBuZXcgUmVzb3VyY2VNYXA8eyB0eXBlSWQ6IHN0cmluZzsgY29udGVudDogVlNCdWZmZXI7IG1ldGE/OiBJV29ya2luZ0NvcHlCYWNrdXBNZXRhIH0+KCk7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdGFzeW5jIGhhc0JhY2t1cHMoKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0cmV0dXJuIHRoaXMuYmFja3Vwcy5zaXplID4gMDtcblx0fVxuXG5cdGhhc0JhY2t1cFN5bmMoaWRlbnRpZmllcjogSVdvcmtpbmdDb3B5SWRlbnRpZmllciwgdmVyc2lvbklkPzogbnVtYmVyKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgYmFja3VwUmVzb3VyY2UgPSB0aGlzLnRvQmFja3VwUmVzb3VyY2UoaWRlbnRpZmllcik7XG5cblx0XHRyZXR1cm4gdGhpcy5iYWNrdXBzLmhhcyhiYWNrdXBSZXNvdXJjZSk7XG5cdH1cblxuXHRhc3luYyBiYWNrdXAoaWRlbnRpZmllcjogSVdvcmtpbmdDb3B5SWRlbnRpZmllciwgY29udGVudD86IFZTQnVmZmVyUmVhZGFibGUgfCBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtLCB2ZXJzaW9uSWQ/OiBudW1iZXIsIG1ldGE/OiBJV29ya2luZ0NvcHlCYWNrdXBNZXRhLCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgYmFja3VwUmVzb3VyY2UgPSB0aGlzLnRvQmFja3VwUmVzb3VyY2UoaWRlbnRpZmllcik7XG5cdFx0dGhpcy5iYWNrdXBzLnNldChiYWNrdXBSZXNvdXJjZSwge1xuXHRcdFx0dHlwZUlkOiBpZGVudGlmaWVyLnR5cGVJZCxcblx0XHRcdGNvbnRlbnQ6IGNvbnRlbnQgaW5zdGFuY2VvZiBWU0J1ZmZlciA/IGNvbnRlbnQgOiBjb250ZW50ID8gaXNSZWFkYWJsZVN0cmVhbShjb250ZW50KSA/IGF3YWl0IHN0cmVhbVRvQnVmZmVyKGNvbnRlbnQpIDogcmVhZGFibGVUb0J1ZmZlcihjb250ZW50KSA6IFZTQnVmZmVyLmZyb21TdHJpbmcoJycpLFxuXHRcdFx0bWV0YVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcmVzb2x2ZTxUIGV4dGVuZHMgSVdvcmtpbmdDb3B5QmFja3VwTWV0YT4oaWRlbnRpZmllcjogSVdvcmtpbmdDb3B5SWRlbnRpZmllcik6IFByb21pc2U8SVJlc29sdmVkV29ya2luZ0NvcHlCYWNrdXA8VD4gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBiYWNrdXBSZXNvdXJjZSA9IHRoaXMudG9CYWNrdXBSZXNvdXJjZShpZGVudGlmaWVyKTtcblx0XHRjb25zdCBiYWNrdXAgPSB0aGlzLmJhY2t1cHMuZ2V0KGJhY2t1cFJlc291cmNlKTtcblx0XHRpZiAoYmFja3VwKSB7XG5cdFx0XHRyZXR1cm4geyB2YWx1ZTogYnVmZmVyVG9TdHJlYW0oYmFja3VwLmNvbnRlbnQpLCBtZXRhOiBiYWNrdXAubWV0YSBhcyBUIHwgdW5kZWZpbmVkIH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGFzeW5jIGdldEJhY2t1cHMoKTogUHJvbWlzZTxJV29ya2luZ0NvcHlJZGVudGlmaWVyW10+IHtcblx0XHRyZXR1cm4gQXJyYXkuZnJvbSh0aGlzLmJhY2t1cHMuZW50cmllcygpKS5tYXAoKFtyZXNvdXJjZSwgYmFja3VwXSkgPT4gKHsgdHlwZUlkOiBiYWNrdXAudHlwZUlkLCByZXNvdXJjZSB9KSk7XG5cdH1cblxuXHRhc3luYyBkaXNjYXJkQmFja3VwKGlkZW50aWZpZXI6IElXb3JraW5nQ29weUlkZW50aWZpZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmJhY2t1cHMuZGVsZXRlKHRoaXMudG9CYWNrdXBSZXNvdXJjZShpZGVudGlmaWVyKSk7XG5cdH1cblxuXHRhc3luYyBkaXNjYXJkQmFja3VwcyhmaWx0ZXI/OiB7IGV4Y2VwdDogSVdvcmtpbmdDb3B5SWRlbnRpZmllcltdIH0pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBleGNlcHQgPSBmaWx0ZXI/LmV4Y2VwdDtcblx0XHRpZiAoQXJyYXkuaXNBcnJheShleGNlcHQpICYmIGV4Y2VwdC5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBleGNlcHRNYXAgPSBuZXcgUmVzb3VyY2VNYXA8Ym9vbGVhbj4oKTtcblx0XHRcdGZvciAoY29uc3QgZXhjZXB0V29ya2luZ0NvcHkgb2YgZXhjZXB0KSB7XG5cdFx0XHRcdGV4Y2VwdE1hcC5zZXQodGhpcy50b0JhY2t1cFJlc291cmNlKGV4Y2VwdFdvcmtpbmdDb3B5KSwgdHJ1ZSk7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3QgYmFja3VwIG9mIGF3YWl0IHRoaXMuZ2V0QmFja3VwcygpKSB7XG5cdFx0XHRcdGlmICghZXhjZXB0TWFwLmhhcyh0aGlzLnRvQmFja3VwUmVzb3VyY2UoYmFja3VwKSkpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmRpc2NhcmRCYWNrdXAoYmFja3VwKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmJhY2t1cHMuY2xlYXIoKTtcblx0XHR9XG5cdH1cblxuXHR0b0JhY2t1cFJlc291cmNlKGlkZW50aWZpZXI6IElXb3JraW5nQ29weUlkZW50aWZpZXIpOiBVUkkge1xuXHRcdHJldHVybiBVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy5pbk1lbW9yeSwgcGF0aDogaGFzaElkZW50aWZpZXIoaWRlbnRpZmllcikgfSk7XG5cdH1cblxuXHRhc3luYyBqb2luQmFja3VwcygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm47XG5cdH1cbn1cblxuLypcbiAqIEV4cG9ydGVkIG9ubHkgZm9yIHRlc3RpbmdcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGhhc2hJZGVudGlmaWVyKGlkZW50aWZpZXI6IElXb3JraW5nQ29weUlkZW50aWZpZXIpOiBzdHJpbmcge1xuXG5cdC8vIElNUE9SVEFOVDogZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LCBlbnN1cmUgdGhhdFxuXHQvLyB3ZSBpZ25vcmUgdGhlIGB0eXBlSWRgIHVubGVzcyBhIHZhbHVlIGlzIHByb3ZpZGVkLlxuXHQvLyBUbyBwcmVzZXJ2ZSBwcmV2aW91cyBiYWNrdXBzIHdpdGhvdXQgdHlwZSBpZCwgd2Vcblx0Ly8gbmVlZCB0byBqdXN0IGhhc2ggdGhlIHJlc291cmNlLiBPdGhlcndpc2Ugd2UgdXNlXG5cdC8vIHRoZSB0eXBlIGlkIGFzIGEgc2VlZCB0byB0aGUgcmVzb3VyY2UgcGF0aC5cblx0bGV0IHJlc291cmNlOiBVUkk7XG5cdGlmIChpZGVudGlmaWVyLnR5cGVJZC5sZW5ndGggPiAwKSB7XG5cdFx0Y29uc3QgdHlwZUlkSGFzaCA9IGhhc2hTdHJpbmcoaWRlbnRpZmllci50eXBlSWQpO1xuXHRcdGlmIChpZGVudGlmaWVyLnJlc291cmNlLnBhdGgpIHtcblx0XHRcdHJlc291cmNlID0gam9pblBhdGgoaWRlbnRpZmllci5yZXNvdXJjZSwgdHlwZUlkSGFzaCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlc291cmNlID0gaWRlbnRpZmllci5yZXNvdXJjZS53aXRoKHsgcGF0aDogdHlwZUlkSGFzaCB9KTtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0cmVzb3VyY2UgPSBpZGVudGlmaWVyLnJlc291cmNlO1xuXHR9XG5cblx0cmV0dXJuIGhhc2hQYXRoKHJlc291cmNlKTtcbn1cblxuZnVuY3Rpb24gaGFzaFBhdGgocmVzb3VyY2U6IFVSSSk6IHN0cmluZyB7XG5cdGNvbnN0IHN0ciA9IHJlc291cmNlLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlIHx8IHJlc291cmNlLnNjaGVtZSA9PT0gU2NoZW1hcy51bnRpdGxlZCA/IHJlc291cmNlLmZzUGF0aCA6IHJlc291cmNlLnRvU3RyaW5nKCk7XG5cblx0cmV0dXJuIGhhc2hTdHJpbmcoc3RyKTtcbn1cblxuZnVuY3Rpb24gaGFzaFN0cmluZyhzdHI6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiBoYXNoKHN0cikudG9TdHJpbmcoMTYpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFdBQVc7QUFDcEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxRQUFRLGlCQUFpQjtBQUNsQyxTQUFTLFVBQVUscUJBQXFCO0FBRXhDLFNBQVMsY0FBa0MsMkJBQTJCO0FBQ3RFLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsa0JBQWtCLGtCQUFrQjtBQUM3QyxTQUFTLGdCQUFnQix3QkFBd0Isc0JBQXNCLGtCQUFrQixnQkFBZ0IsZ0JBQTBEO0FBQ25LLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsbUJBQW1CO0FBRTVCLFNBQVMsZUFBZTtBQUN4QixTQUFTLFlBQVk7QUFDckIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBeUQsa0JBQWtCO0FBRXBF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
