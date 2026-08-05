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
import { Sequencer } from "../../../../base/common/async.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { revive } from "../../../../base/common/marshalling.js";
import { joinPath } from "../../../../base/common/resources.js";
import { localize } from "../../../../nls.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { FileOperationResult, IFileService, toFileOperationResult } from "../../../../platform/files/common/files.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
import { ChatModel, normalizeSerializableChatData } from "./chatModel.js";
const maxPersistedSessions = 25;
const ChatIndexStorageKey = "chat.ChatSessionStore.index";
let ChatSessionStore = class extends Disposable {
  constructor(fileService, environmentService, logService, workspaceContextService, telemetryService, storageService, lifecycleService, userDataProfilesService) {
    super();
    this.fileService = fileService;
    this.environmentService = environmentService;
    this.logService = logService;
    this.workspaceContextService = workspaceContextService;
    this.telemetryService = telemetryService;
    this.storageService = storageService;
    this.lifecycleService = lifecycleService;
    this.userDataProfilesService = userDataProfilesService;
    // private readonly transferredSessionStorageRoot: URI;
    this.storeQueue = new Sequencer();
    this.shuttingDown = false;
    const workspace = this.workspaceContextService.getWorkspace();
    const isEmptyWindow = !workspace.configuration && workspace.folders.length === 0;
    const workspaceId = this.workspaceContextService.getWorkspace().id;
    this.storageRoot = isEmptyWindow ? joinPath(this.userDataProfilesService.defaultProfile.globalStorageHome, "emptyWindowChatSessions") : joinPath(this.environmentService.workspaceStorageHome, workspaceId, "chatSessions");
    this.previousEmptyWindowStorageRoot = isEmptyWindow ? joinPath(this.environmentService.workspaceStorageHome, "no-workspace", "chatSessions") : void 0;
    this._register(this.lifecycleService.onWillShutdown((e) => {
      this.shuttingDown = true;
      if (!this.storeTask) {
        return;
      }
      e.join(this.storeTask, {
        id: "join.chatSessionStore",
        label: localize("join.chatSessionStore", "Saving chat history")
      });
    }));
  }
  async storeSessions(sessions) {
    if (this.shuttingDown) {
      return;
    }
    try {
      this.storeTask = this.storeQueue.queue(async () => {
        try {
          await Promise.all(sessions.map((session) => this.writeSession(session)));
          await this.trimEntries();
          await this.flushIndex();
        } catch (e) {
          this.reportError("storeSessions", "Error storing chat sessions", e);
        }
      });
      await this.storeTask;
    } finally {
      this.storeTask = void 0;
    }
  }
  // async storeTransferSession(transferData: IChatTransfer, session: ISerializableChatData): Promise<void> {
  // 	try {
  // 		const content = JSON.stringify(session, undefined, 2);
  // 		await this.fileService.writeFile(this.transferredSessionStorageRoot, VSBuffer.fromString(content));
  // 	} catch (e) {
  // 		this.reportError('sessionWrite', 'Error writing chat session', e);
  // 		return;
  // 	}
  // 	const index = this.getTransferredSessionIndex();
  // 	index[transferData.toWorkspace.toString()] = transferData;
  // 	try {
  // 		this.storageService.store(ChatTransferIndexStorageKey, index, StorageScope.PROFILE, StorageTarget.MACHINE);
  // 	} catch (e) {
  // 		this.reportError('storeTransferSession', 'Error storing chat transfer session', e);
  // 	}
  // }
  // private getTransferredSessionIndex(): IChatTransferIndex {
  // 	try {
  // 		const data: IChatTransferIndex = this.storageService.getObject(ChatTransferIndexStorageKey, StorageScope.PROFILE, {});
  // 		return data;
  // 	} catch (e) {
  // 		this.reportError('getTransferredSessionIndex', 'Error reading chat transfer index', e);
  // 		return {};
  // 	}
  // }
  async writeSession(session) {
    try {
      const index = this.internalGetIndex();
      const storageLocation = this.getStorageLocation(session.sessionId);
      const content = JSON.stringify(session, void 0, 2);
      await this.fileService.writeFile(storageLocation, VSBuffer.fromString(content));
      index.entries[session.sessionId] = getSessionMetadata(session);
    } catch (e) {
      this.reportError("sessionWrite", "Error writing chat session", e);
    }
  }
  async flushIndex() {
    const index = this.internalGetIndex();
    try {
      this.storageService.store(ChatIndexStorageKey, index, this.getIndexStorageScope(), StorageTarget.MACHINE);
    } catch (e) {
      this.reportError("indexWrite", "Error writing index", e);
    }
  }
  getIndexStorageScope() {
    const workspace = this.workspaceContextService.getWorkspace();
    const isEmptyWindow = !workspace.configuration && workspace.folders.length === 0;
    return isEmptyWindow ? StorageScope.APPLICATION : StorageScope.WORKSPACE;
  }
  async trimEntries() {
    const index = this.internalGetIndex();
    const entries = Object.entries(index.entries).sort((a, b) => b[1].lastMessageDate - a[1].lastMessageDate).map(([id]) => id);
    if (entries.length > maxPersistedSessions) {
      const entriesToDelete = entries.slice(maxPersistedSessions);
      for (const entry of entriesToDelete) {
        delete index.entries[entry];
      }
      this.logService.trace(`ChatSessionStore: Trimmed ${entriesToDelete.length} old chat sessions from index`);
    }
  }
  async internalDeleteSession(sessionId) {
    const index = this.internalGetIndex();
    if (!index.entries[sessionId]) {
      return;
    }
    const storageLocation = this.getStorageLocation(sessionId);
    try {
      await this.fileService.del(storageLocation);
    } catch (e) {
      if (toFileOperationResult(e) !== FileOperationResult.FILE_NOT_FOUND) {
        this.reportError("sessionDelete", "Error deleting chat session", e);
      }
    } finally {
      delete index.entries[sessionId];
    }
  }
  hasSessions() {
    return Object.keys(this.internalGetIndex().entries).length > 0;
  }
  isSessionEmpty(sessionId) {
    const index = this.internalGetIndex();
    return index.entries[sessionId]?.isEmpty ?? true;
  }
  async deleteSession(sessionId) {
    await this.storeQueue.queue(async () => {
      await this.internalDeleteSession(sessionId);
      await this.flushIndex();
    });
  }
  async clearAllSessions() {
    await this.storeQueue.queue(async () => {
      const index = this.internalGetIndex();
      const entries = Object.keys(index.entries);
      this.logService.info(`ChatSessionStore: Clearing ${entries.length} chat sessions`);
      await Promise.all(entries.map((entry) => this.internalDeleteSession(entry)));
      await this.flushIndex();
    });
  }
  async setSessionTitle(sessionId, title) {
    await this.storeQueue.queue(async () => {
      const index = this.internalGetIndex();
      if (index.entries[sessionId]) {
        index.entries[sessionId].title = title;
      }
    });
  }
  reportError(reasonForTelemetry, message, error) {
    this.logService.error(`ChatSessionStore: ` + message, toErrorMessage(error));
    const fileOperationReason = error && toFileOperationResult(error);
    this.telemetryService.publicLog2("chatSessionStoreError", {
      reason: reasonForTelemetry,
      fileOperationReason: fileOperationReason ?? -1
    });
  }
  internalGetIndex() {
    if (this.indexCache) {
      return this.indexCache;
    }
    const data = this.storageService.get(ChatIndexStorageKey, this.getIndexStorageScope(), void 0);
    if (!data) {
      this.indexCache = { version: 1, entries: {} };
      return this.indexCache;
    }
    try {
      const index = JSON.parse(data);
      if (isChatSessionIndex(index)) {
        this.indexCache = index;
      } else {
        this.reportError("invalidIndexFormat", `Invalid index format: ${data}`);
        this.indexCache = { version: 1, entries: {} };
      }
      return this.indexCache;
    } catch (e) {
      this.reportError("invalidIndexJSON", `Index corrupt: ${data}`, e);
      this.indexCache = { version: 1, entries: {} };
      return this.indexCache;
    }
  }
  async getIndex() {
    return this.storeQueue.queue(async () => {
      return this.internalGetIndex().entries;
    });
  }
  logIndex() {
    const data = this.storageService.get(ChatIndexStorageKey, this.getIndexStorageScope(), void 0);
    this.logService.info("ChatSessionStore index: ", data);
  }
  async migrateDataIfNeeded(getInitialData) {
    await this.storeQueue.queue(async () => {
      const data = this.storageService.get(ChatIndexStorageKey, this.getIndexStorageScope(), void 0);
      const needsMigrationFromStorageService = !data;
      if (needsMigrationFromStorageService) {
        const initialData = getInitialData();
        if (initialData) {
          await this.migrate(initialData);
        }
      }
    });
  }
  async migrate(initialData) {
    const numSessions = Object.keys(initialData).length;
    this.logService.info(`ChatSessionStore: Migrating ${numSessions} chat sessions from storage service to file system`);
    await Promise.all(Object.values(initialData).map(async (session) => {
      await this.writeSession(session);
    }));
    await this.flushIndex();
  }
  async readSession(sessionId) {
    return await this.storeQueue.queue(async () => {
      let rawData;
      const storageLocation = this.getStorageLocation(sessionId);
      try {
        rawData = (await this.fileService.readFile(storageLocation)).value.toString();
      } catch (e) {
        this.reportError("sessionReadFile", `Error reading chat session file ${sessionId}`, e);
        if (toFileOperationResult(e) === FileOperationResult.FILE_NOT_FOUND && this.previousEmptyWindowStorageRoot) {
          rawData = await this.readSessionFromPreviousLocation(sessionId);
        }
        if (!rawData) {
          return void 0;
        }
      }
      try {
        const session = revive(JSON.parse(rawData));
        for (const request of session.requests) {
          if (Array.isArray(request.response)) {
            request.response = request.response.map((response) => {
              if (typeof response === "string") {
                return new MarkdownString(response);
              }
              return response;
            });
          } else if (typeof request.response === "string") {
            request.response = [new MarkdownString(request.response)];
          }
        }
        return normalizeSerializableChatData(session);
      } catch (err) {
        this.reportError("malformedSession", `Malformed session data in ${storageLocation.fsPath}: [${rawData.substring(0, 20)}${rawData.length > 20 ? "..." : ""}]`, err);
        return void 0;
      }
    });
  }
  async readSessionFromPreviousLocation(sessionId) {
    let rawData;
    if (this.previousEmptyWindowStorageRoot) {
      const storageLocation2 = joinPath(this.previousEmptyWindowStorageRoot, `${sessionId}.json`);
      try {
        rawData = (await this.fileService.readFile(storageLocation2)).value.toString();
        this.logService.info(`ChatSessionStore: Read chat session ${sessionId} from previous location`);
      } catch (e) {
        this.reportError("sessionReadFile", `Error reading chat session file ${sessionId} from previous location`, e);
        return void 0;
      }
    }
    return rawData;
  }
  getStorageLocation(chatSessionId) {
    return joinPath(this.storageRoot, `${chatSessionId}.json`);
  }
  getChatStorageFolder() {
    return this.storageRoot;
  }
};
ChatSessionStore = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IEnvironmentService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, ILifecycleService),
  __decorateParam(7, IUserDataProfilesService)
], ChatSessionStore);
function isChatSessionEntryMetadata(obj) {
  return !!obj && typeof obj === "object" && typeof obj.sessionId === "string" && typeof obj.title === "string" && typeof obj.lastMessageDate === "number";
}
function isChatSessionIndex(data) {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const index = data;
  if (index.version !== 1) {
    return false;
  }
  if (typeof index.entries !== "object" || index.entries === null) {
    return false;
  }
  for (const key in index.entries) {
    if (!isChatSessionEntryMetadata(index.entries[key])) {
      return false;
    }
  }
  return true;
}
function getSessionMetadata(session) {
  const title = session instanceof ChatModel ? session.title || localize("newChat", "New Chat") : session.customTitle ?? ChatModel.getDefaultTitle(session.requests);
  return {
    sessionId: session.sessionId,
    title,
    lastMessageDate: session.lastMessageDate,
    isImported: session.isImported,
    initialLocation: session.initialLocation,
    isEmpty: session instanceof ChatModel ? session.getRequests().length === 0 : session.requests.length === 0
  };
}
export {
  ChatSessionStore
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0U2Vzc2lvblN0b3JlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgU2VxdWVuY2VyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgdG9FcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvck1lc3NhZ2UuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IHJldml2ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcnNoYWxsaW5nLmpzJztcbmltcG9ydCB7IGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IEZpbGVPcGVyYXRpb25SZXN1bHQsIElGaWxlU2VydmljZSwgdG9GaWxlT3BlcmF0aW9uUmVzdWx0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBDaGF0TW9kZWwsIElTZXJpYWxpemFibGVDaGF0RGF0YSwgSVNlcmlhbGl6YWJsZUNoYXREYXRhSW4sIElTZXJpYWxpemFibGVDaGF0c0RhdGEsIG5vcm1hbGl6ZVNlcmlhbGl6YWJsZUNoYXREYXRhIH0gZnJvbSAnLi9jaGF0TW9kZWwuanMnO1xuaW1wb3J0IHsgQ2hhdEFnZW50TG9jYXRpb24sIENoYXRNb2RlIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuXG5jb25zdCBtYXhQZXJzaXN0ZWRTZXNzaW9ucyA9IDI1O1xuXG5jb25zdCBDaGF0SW5kZXhTdG9yYWdlS2V5ID0gJ2NoYXQuQ2hhdFNlc3Npb25TdG9yZS5pbmRleCc7XG4vLyBjb25zdCBDaGF0VHJhbnNmZXJJbmRleFN0b3JhZ2VLZXkgPSAnQ2hhdFNlc3Npb25TdG9yZS50cmFuc2ZlckluZGV4JztcblxuZXhwb3J0IGNsYXNzIENoYXRTZXNzaW9uU3RvcmUgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBzdG9yYWdlUm9vdDogVVJJO1xuXHRwcml2YXRlIHJlYWRvbmx5IHByZXZpb3VzRW1wdHlXaW5kb3dTdG9yYWdlUm9vdDogVVJJIHwgdW5kZWZpbmVkO1xuXHQvLyBwcml2YXRlIHJlYWRvbmx5IHRyYW5zZmVycmVkU2Vzc2lvblN0b3JhZ2VSb290OiBVUkk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBzdG9yZVF1ZXVlID0gbmV3IFNlcXVlbmNlcigpO1xuXG5cdHByaXZhdGUgc3RvcmVUYXNrOiBQcm9taXNlPHZvaWQ+IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHNodXR0aW5nRG93biA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxpZmVjeWNsZVNlcnZpY2U6IElMaWZlY3ljbGVTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVzU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Y29uc3Qgd29ya3NwYWNlID0gdGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKTtcblx0XHRjb25zdCBpc0VtcHR5V2luZG93ID0gIXdvcmtzcGFjZS5jb25maWd1cmF0aW9uICYmIHdvcmtzcGFjZS5mb2xkZXJzLmxlbmd0aCA9PT0gMDtcblx0XHRjb25zdCB3b3Jrc3BhY2VJZCA9IHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuaWQ7XG5cdFx0dGhpcy5zdG9yYWdlUm9vdCA9IGlzRW1wdHlXaW5kb3cgP1xuXHRcdFx0am9pblBhdGgodGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5nbG9iYWxTdG9yYWdlSG9tZSwgJ2VtcHR5V2luZG93Q2hhdFNlc3Npb25zJykgOlxuXHRcdFx0am9pblBhdGgodGhpcy5lbnZpcm9ubWVudFNlcnZpY2Uud29ya3NwYWNlU3RvcmFnZUhvbWUsIHdvcmtzcGFjZUlkLCAnY2hhdFNlc3Npb25zJyk7XG5cblx0XHR0aGlzLnByZXZpb3VzRW1wdHlXaW5kb3dTdG9yYWdlUm9vdCA9IGlzRW1wdHlXaW5kb3cgP1xuXHRcdFx0am9pblBhdGgodGhpcy5lbnZpcm9ubWVudFNlcnZpY2Uud29ya3NwYWNlU3RvcmFnZUhvbWUsICduby13b3Jrc3BhY2UnLCAnY2hhdFNlc3Npb25zJykgOlxuXHRcdFx0dW5kZWZpbmVkO1xuXG5cdFx0Ly8gVE9ETyB0bXBkaXJcblx0XHQvLyB0aGlzLnRyYW5zZmVycmVkU2Vzc2lvblN0b3JhZ2VSb290ID0gam9pblBhdGgodGhpcy5lbnZpcm9ubWVudFNlcnZpY2Uud29ya3NwYWNlU3RvcmFnZUhvbWUsICd0cmFuc2ZlcnJlZENoYXRTZXNzaW9ucycpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5saWZlY3ljbGVTZXJ2aWNlLm9uV2lsbFNodXRkb3duKGUgPT4ge1xuXHRcdFx0dGhpcy5zaHV0dGluZ0Rvd24gPSB0cnVlO1xuXHRcdFx0aWYgKCF0aGlzLnN0b3JlVGFzaykge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGUuam9pbih0aGlzLnN0b3JlVGFzaywge1xuXHRcdFx0XHRpZDogJ2pvaW4uY2hhdFNlc3Npb25TdG9yZScsXG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnam9pbi5jaGF0U2Vzc2lvblN0b3JlJywgXCJTYXZpbmcgY2hhdCBoaXN0b3J5XCIpXG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cdH1cblxuXHRhc3luYyBzdG9yZVNlc3Npb25zKHNlc3Npb25zOiBDaGF0TW9kZWxbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLnNodXR0aW5nRG93bikge1xuXHRcdFx0Ly8gRG9uJ3Qgc3RhcnQgdGhpcyB0YXNrIGlmIHdlIG1pc3NlZCB0aGUgY2hhbmNlIHRvIGJsb2NrIHNodXRkb3duXG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuc3RvcmVUYXNrID0gdGhpcy5zdG9yZVF1ZXVlLnF1ZXVlKGFzeW5jICgpID0+IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRhd2FpdCBQcm9taXNlLmFsbChzZXNzaW9ucy5tYXAoc2Vzc2lvbiA9PiB0aGlzLndyaXRlU2Vzc2lvbihzZXNzaW9uKSkpO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMudHJpbUVudHJpZXMoKTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmZsdXNoSW5kZXgoKTtcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdHRoaXMucmVwb3J0RXJyb3IoJ3N0b3JlU2Vzc2lvbnMnLCAnRXJyb3Igc3RvcmluZyBjaGF0IHNlc3Npb25zJywgZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGhpcy5zdG9yZVRhc2s7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuc3RvcmVUYXNrID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdC8vIGFzeW5jIHN0b3JlVHJhbnNmZXJTZXNzaW9uKHRyYW5zZmVyRGF0YTogSUNoYXRUcmFuc2Zlciwgc2Vzc2lvbjogSVNlcmlhbGl6YWJsZUNoYXREYXRhKTogUHJvbWlzZTx2b2lkPiB7XG5cdC8vIFx0dHJ5IHtcblx0Ly8gXHRcdGNvbnN0IGNvbnRlbnQgPSBKU09OLnN0cmluZ2lmeShzZXNzaW9uLCB1bmRlZmluZWQsIDIpO1xuXHQvLyBcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS53cml0ZUZpbGUodGhpcy50cmFuc2ZlcnJlZFNlc3Npb25TdG9yYWdlUm9vdCwgVlNCdWZmZXIuZnJvbVN0cmluZyhjb250ZW50KSk7XG5cdC8vIFx0fSBjYXRjaCAoZSkge1xuXHQvLyBcdFx0dGhpcy5yZXBvcnRFcnJvcignc2Vzc2lvbldyaXRlJywgJ0Vycm9yIHdyaXRpbmcgY2hhdCBzZXNzaW9uJywgZSk7XG5cdC8vIFx0XHRyZXR1cm47XG5cdC8vIFx0fVxuXG5cdC8vIFx0Y29uc3QgaW5kZXggPSB0aGlzLmdldFRyYW5zZmVycmVkU2Vzc2lvbkluZGV4KCk7XG5cdC8vIFx0aW5kZXhbdHJhbnNmZXJEYXRhLnRvV29ya3NwYWNlLnRvU3RyaW5nKCldID0gdHJhbnNmZXJEYXRhO1xuXHQvLyBcdHRyeSB7XG5cdC8vIFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKENoYXRUcmFuc2ZlckluZGV4U3RvcmFnZUtleSwgaW5kZXgsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHQvLyBcdH0gY2F0Y2ggKGUpIHtcblx0Ly8gXHRcdHRoaXMucmVwb3J0RXJyb3IoJ3N0b3JlVHJhbnNmZXJTZXNzaW9uJywgJ0Vycm9yIHN0b3JpbmcgY2hhdCB0cmFuc2ZlciBzZXNzaW9uJywgZSk7XG5cdC8vIFx0fVxuXHQvLyB9XG5cblx0Ly8gcHJpdmF0ZSBnZXRUcmFuc2ZlcnJlZFNlc3Npb25JbmRleCgpOiBJQ2hhdFRyYW5zZmVySW5kZXgge1xuXHQvLyBcdHRyeSB7XG5cdC8vIFx0XHRjb25zdCBkYXRhOiBJQ2hhdFRyYW5zZmVySW5kZXggPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldE9iamVjdChDaGF0VHJhbnNmZXJJbmRleFN0b3JhZ2VLZXksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCB7fSk7XG5cdC8vIFx0XHRyZXR1cm4gZGF0YTtcblx0Ly8gXHR9IGNhdGNoIChlKSB7XG5cdC8vIFx0XHR0aGlzLnJlcG9ydEVycm9yKCdnZXRUcmFuc2ZlcnJlZFNlc3Npb25JbmRleCcsICdFcnJvciByZWFkaW5nIGNoYXQgdHJhbnNmZXIgaW5kZXgnLCBlKTtcblx0Ly8gXHRcdHJldHVybiB7fTtcblx0Ly8gXHR9XG5cdC8vIH1cblxuXHRwcml2YXRlIGFzeW5jIHdyaXRlU2Vzc2lvbihzZXNzaW9uOiBDaGF0TW9kZWwgfCBJU2VyaWFsaXphYmxlQ2hhdERhdGEpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgaW5kZXggPSB0aGlzLmludGVybmFsR2V0SW5kZXgoKTtcblx0XHRcdGNvbnN0IHN0b3JhZ2VMb2NhdGlvbiA9IHRoaXMuZ2V0U3RvcmFnZUxvY2F0aW9uKHNlc3Npb24uc2Vzc2lvbklkKTtcblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBKU09OLnN0cmluZ2lmeShzZXNzaW9uLCB1bmRlZmluZWQsIDIpO1xuXHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS53cml0ZUZpbGUoc3RvcmFnZUxvY2F0aW9uLCBWU0J1ZmZlci5mcm9tU3RyaW5nKGNvbnRlbnQpKTtcblxuXHRcdFx0Ly8gV3JpdGUgc3VjY2VlZGVkLCB1cGRhdGUgaW5kZXhcblx0XHRcdGluZGV4LmVudHJpZXNbc2Vzc2lvbi5zZXNzaW9uSWRdID0gZ2V0U2Vzc2lvbk1ldGFkYXRhKHNlc3Npb24pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMucmVwb3J0RXJyb3IoJ3Nlc3Npb25Xcml0ZScsICdFcnJvciB3cml0aW5nIGNoYXQgc2Vzc2lvbicsIGUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZmx1c2hJbmRleCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMuaW50ZXJuYWxHZXRJbmRleCgpO1xuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKENoYXRJbmRleFN0b3JhZ2VLZXksIGluZGV4LCB0aGlzLmdldEluZGV4U3RvcmFnZVNjb3BlKCksIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0Ly8gT25seSBpZiBKU09OLnN0cmluZ2lmeSBmYWlscywgQUZBSUtcblx0XHRcdHRoaXMucmVwb3J0RXJyb3IoJ2luZGV4V3JpdGUnLCAnRXJyb3Igd3JpdGluZyBpbmRleCcsIGUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0SW5kZXhTdG9yYWdlU2NvcGUoKTogU3RvcmFnZVNjb3BlIHtcblx0XHRjb25zdCB3b3Jrc3BhY2UgPSB0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpO1xuXHRcdGNvbnN0IGlzRW1wdHlXaW5kb3cgPSAhd29ya3NwYWNlLmNvbmZpZ3VyYXRpb24gJiYgd29ya3NwYWNlLmZvbGRlcnMubGVuZ3RoID09PSAwO1xuXHRcdHJldHVybiBpc0VtcHR5V2luZG93ID8gU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OIDogU3RvcmFnZVNjb3BlLldPUktTUEFDRTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdHJpbUVudHJpZXMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaW5kZXggPSB0aGlzLmludGVybmFsR2V0SW5kZXgoKTtcblx0XHRjb25zdCBlbnRyaWVzID0gT2JqZWN0LmVudHJpZXMoaW5kZXguZW50cmllcylcblx0XHRcdC5zb3J0KChhLCBiKSA9PiBiWzFdLmxhc3RNZXNzYWdlRGF0ZSAtIGFbMV0ubGFzdE1lc3NhZ2VEYXRlKVxuXHRcdFx0Lm1hcCgoW2lkXSkgPT4gaWQpO1xuXG5cdFx0aWYgKGVudHJpZXMubGVuZ3RoID4gbWF4UGVyc2lzdGVkU2Vzc2lvbnMpIHtcblx0XHRcdGNvbnN0IGVudHJpZXNUb0RlbGV0ZSA9IGVudHJpZXMuc2xpY2UobWF4UGVyc2lzdGVkU2Vzc2lvbnMpO1xuXHRcdFx0Zm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzVG9EZWxldGUpIHtcblx0XHRcdFx0ZGVsZXRlIGluZGV4LmVudHJpZXNbZW50cnldO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYENoYXRTZXNzaW9uU3RvcmU6IFRyaW1tZWQgJHtlbnRyaWVzVG9EZWxldGUubGVuZ3RofSBvbGQgY2hhdCBzZXNzaW9ucyBmcm9tIGluZGV4YCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBpbnRlcm5hbERlbGV0ZVNlc3Npb24oc2Vzc2lvbklkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMuaW50ZXJuYWxHZXRJbmRleCgpO1xuXHRcdGlmICghaW5kZXguZW50cmllc1tzZXNzaW9uSWRdKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RvcmFnZUxvY2F0aW9uID0gdGhpcy5nZXRTdG9yYWdlTG9jYXRpb24oc2Vzc2lvbklkKTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS5kZWwoc3RvcmFnZUxvY2F0aW9uKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRpZiAodG9GaWxlT3BlcmF0aW9uUmVzdWx0KGUpICE9PSBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTk9UX0ZPVU5EKSB7XG5cdFx0XHRcdHRoaXMucmVwb3J0RXJyb3IoJ3Nlc3Npb25EZWxldGUnLCAnRXJyb3IgZGVsZXRpbmcgY2hhdCBzZXNzaW9uJywgZSk7XG5cdFx0XHR9XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGRlbGV0ZSBpbmRleC5lbnRyaWVzW3Nlc3Npb25JZF07XG5cdFx0fVxuXHR9XG5cblx0aGFzU2Vzc2lvbnMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIE9iamVjdC5rZXlzKHRoaXMuaW50ZXJuYWxHZXRJbmRleCgpLmVudHJpZXMpLmxlbmd0aCA+IDA7XG5cdH1cblxuXHRpc1Nlc3Npb25FbXB0eShzZXNzaW9uSWQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5pbnRlcm5hbEdldEluZGV4KCk7XG5cdFx0cmV0dXJuIGluZGV4LmVudHJpZXNbc2Vzc2lvbklkXT8uaXNFbXB0eSA/PyB0cnVlO1xuXHR9XG5cblx0YXN5bmMgZGVsZXRlU2Vzc2lvbihzZXNzaW9uSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuc3RvcmVRdWV1ZS5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB0aGlzLmludGVybmFsRGVsZXRlU2Vzc2lvbihzZXNzaW9uSWQpO1xuXHRcdFx0YXdhaXQgdGhpcy5mbHVzaEluZGV4KCk7XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBjbGVhckFsbFNlc3Npb25zKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuc3RvcmVRdWV1ZS5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBpbmRleCA9IHRoaXMuaW50ZXJuYWxHZXRJbmRleCgpO1xuXHRcdFx0Y29uc3QgZW50cmllcyA9IE9iamVjdC5rZXlzKGluZGV4LmVudHJpZXMpO1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oYENoYXRTZXNzaW9uU3RvcmU6IENsZWFyaW5nICR7ZW50cmllcy5sZW5ndGh9IGNoYXQgc2Vzc2lvbnNgKTtcblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKGVudHJpZXMubWFwKGVudHJ5ID0+IHRoaXMuaW50ZXJuYWxEZWxldGVTZXNzaW9uKGVudHJ5KSkpO1xuXHRcdFx0YXdhaXQgdGhpcy5mbHVzaEluZGV4KCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgc2V0U2Vzc2lvblRpdGxlKHNlc3Npb25JZDogc3RyaW5nLCB0aXRsZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5zdG9yZVF1ZXVlLnF1ZXVlKGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGluZGV4ID0gdGhpcy5pbnRlcm5hbEdldEluZGV4KCk7XG5cdFx0XHRpZiAoaW5kZXguZW50cmllc1tzZXNzaW9uSWRdKSB7XG5cdFx0XHRcdGluZGV4LmVudHJpZXNbc2Vzc2lvbklkXS50aXRsZSA9IHRpdGxlO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZXBvcnRFcnJvcihyZWFzb25Gb3JUZWxlbWV0cnk6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nLCBlcnJvcj86IEVycm9yKTogdm9pZCB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBDaGF0U2Vzc2lvblN0b3JlOiBgICsgbWVzc2FnZSwgdG9FcnJvck1lc3NhZ2UoZXJyb3IpKTtcblxuXHRcdGNvbnN0IGZpbGVPcGVyYXRpb25SZWFzb24gPSBlcnJvciAmJiB0b0ZpbGVPcGVyYXRpb25SZXN1bHQoZXJyb3IpO1xuXHRcdHR5cGUgQ2hhdFNlc3Npb25TdG9yZUVycm9yRGF0YSA9IHtcblx0XHRcdHJlYXNvbjogc3RyaW5nO1xuXHRcdFx0ZmlsZU9wZXJhdGlvblJlYXNvbjogbnVtYmVyO1xuXHRcdFx0Ly8gZXJyb3I6IEVycm9yO1xuXHRcdH07XG5cdFx0dHlwZSBDaGF0U2Vzc2lvblN0b3JlRXJyb3JDbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdG93bmVyOiAncm9ibG91cmVucyc7XG5cdFx0XHRjb21tZW50OiAnRGV0ZWN0IGlzc3VlcyByZWxhdGVkIHRvIG1hbmFnaW5nIGNoYXQgc2Vzc2lvbnMnO1xuXHRcdFx0cmVhc29uOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnSW5mbyBhYm91dCB0aGUgZXJyb3IgdGhhdCBvY2N1cnJlZCcgfTtcblx0XHRcdGZpbGVPcGVyYXRpb25SZWFzb246IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdBbiBlcnJvciBjb2RlIGZyb20gdGhlIGZpbGUgc2VydmljZScgfTtcblx0XHRcdC8vIGVycm9yOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnSW5mbyBhYm91dCB0aGUgZXJyb3IgdGhhdCBvY2N1cnJlZCcgfTtcblx0XHR9O1xuXHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPENoYXRTZXNzaW9uU3RvcmVFcnJvckRhdGEsIENoYXRTZXNzaW9uU3RvcmVFcnJvckNsYXNzaWZpY2F0aW9uPignY2hhdFNlc3Npb25TdG9yZUVycm9yJywge1xuXHRcdFx0cmVhc29uOiByZWFzb25Gb3JUZWxlbWV0cnksXG5cdFx0XHRmaWxlT3BlcmF0aW9uUmVhc29uOiBmaWxlT3BlcmF0aW9uUmVhc29uID8/IC0xXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGluZGV4Q2FjaGU6IElDaGF0U2Vzc2lvbkluZGV4RGF0YSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBpbnRlcm5hbEdldEluZGV4KCk6IElDaGF0U2Vzc2lvbkluZGV4RGF0YSB7XG5cdFx0aWYgKHRoaXMuaW5kZXhDYWNoZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuaW5kZXhDYWNoZTtcblx0XHR9XG5cblx0XHRjb25zdCBkYXRhID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoQ2hhdEluZGV4U3RvcmFnZUtleSwgdGhpcy5nZXRJbmRleFN0b3JhZ2VTY29wZSgpLCB1bmRlZmluZWQpO1xuXHRcdGlmICghZGF0YSkge1xuXHRcdFx0dGhpcy5pbmRleENhY2hlID0geyB2ZXJzaW9uOiAxLCBlbnRyaWVzOiB7fSB9O1xuXHRcdFx0cmV0dXJuIHRoaXMuaW5kZXhDYWNoZTtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgaW5kZXggPSBKU09OLnBhcnNlKGRhdGEpIGFzIHVua25vd247XG5cdFx0XHRpZiAoaXNDaGF0U2Vzc2lvbkluZGV4KGluZGV4KSkge1xuXHRcdFx0XHQvLyBTdWNjZXNzXG5cdFx0XHRcdHRoaXMuaW5kZXhDYWNoZSA9IGluZGV4O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5yZXBvcnRFcnJvcignaW52YWxpZEluZGV4Rm9ybWF0JywgYEludmFsaWQgaW5kZXggZm9ybWF0OiAke2RhdGF9YCk7XG5cdFx0XHRcdHRoaXMuaW5kZXhDYWNoZSA9IHsgdmVyc2lvbjogMSwgZW50cmllczoge30gfTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRoaXMuaW5kZXhDYWNoZTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHQvLyBPbmx5IGlmIEpTT04ucGFyc2UgZmFpbHNcblx0XHRcdHRoaXMucmVwb3J0RXJyb3IoJ2ludmFsaWRJbmRleEpTT04nLCBgSW5kZXggY29ycnVwdDogJHtkYXRhfWAsIGUpO1xuXHRcdFx0dGhpcy5pbmRleENhY2hlID0geyB2ZXJzaW9uOiAxLCBlbnRyaWVzOiB7fSB9O1xuXHRcdFx0cmV0dXJuIHRoaXMuaW5kZXhDYWNoZTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBnZXRJbmRleCgpOiBQcm9taXNlPElDaGF0U2Vzc2lvbkluZGV4PiB7XG5cdFx0cmV0dXJuIHRoaXMuc3RvcmVRdWV1ZS5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRyZXR1cm4gdGhpcy5pbnRlcm5hbEdldEluZGV4KCkuZW50cmllcztcblx0XHR9KTtcblx0fVxuXG5cdGxvZ0luZGV4KCk6IHZvaWQge1xuXHRcdGNvbnN0IGRhdGEgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChDaGF0SW5kZXhTdG9yYWdlS2V5LCB0aGlzLmdldEluZGV4U3RvcmFnZVNjb3BlKCksIHVuZGVmaW5lZCk7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ0NoYXRTZXNzaW9uU3RvcmUgaW5kZXg6ICcsIGRhdGEpO1xuXHR9XG5cblx0YXN5bmMgbWlncmF0ZURhdGFJZk5lZWRlZChnZXRJbml0aWFsRGF0YTogKCkgPT4gSVNlcmlhbGl6YWJsZUNoYXRzRGF0YSB8IHVuZGVmaW5lZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuc3RvcmVRdWV1ZS5xdWV1ZShhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBkYXRhID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoQ2hhdEluZGV4U3RvcmFnZUtleSwgdGhpcy5nZXRJbmRleFN0b3JhZ2VTY29wZSgpLCB1bmRlZmluZWQpO1xuXHRcdFx0Y29uc3QgbmVlZHNNaWdyYXRpb25Gcm9tU3RvcmFnZVNlcnZpY2UgPSAhZGF0YTtcblx0XHRcdGlmIChuZWVkc01pZ3JhdGlvbkZyb21TdG9yYWdlU2VydmljZSkge1xuXHRcdFx0XHRjb25zdCBpbml0aWFsRGF0YSA9IGdldEluaXRpYWxEYXRhKCk7XG5cdFx0XHRcdGlmIChpbml0aWFsRGF0YSkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMubWlncmF0ZShpbml0aWFsRGF0YSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgbWlncmF0ZShpbml0aWFsRGF0YTogSVNlcmlhbGl6YWJsZUNoYXRzRGF0YSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IG51bVNlc3Npb25zID0gT2JqZWN0LmtleXMoaW5pdGlhbERhdGEpLmxlbmd0aDtcblx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgQ2hhdFNlc3Npb25TdG9yZTogTWlncmF0aW5nICR7bnVtU2Vzc2lvbnN9IGNoYXQgc2Vzc2lvbnMgZnJvbSBzdG9yYWdlIHNlcnZpY2UgdG8gZmlsZSBzeXN0ZW1gKTtcblxuXHRcdGF3YWl0IFByb21pc2UuYWxsKE9iamVjdC52YWx1ZXMoaW5pdGlhbERhdGEpLm1hcChhc3luYyBzZXNzaW9uID0+IHtcblx0XHRcdGF3YWl0IHRoaXMud3JpdGVTZXNzaW9uKHNlc3Npb24pO1xuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHRoaXMuZmx1c2hJbmRleCgpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHJlYWRTZXNzaW9uKHNlc3Npb25JZDogc3RyaW5nKTogUHJvbWlzZTxJU2VyaWFsaXphYmxlQ2hhdERhdGEgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gYXdhaXQgdGhpcy5zdG9yZVF1ZXVlLnF1ZXVlKGFzeW5jICgpID0+IHtcblx0XHRcdGxldCByYXdEYXRhOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCBzdG9yYWdlTG9jYXRpb24gPSB0aGlzLmdldFN0b3JhZ2VMb2NhdGlvbihzZXNzaW9uSWQpO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmF3RGF0YSA9IChhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKHN0b3JhZ2VMb2NhdGlvbikpLnZhbHVlLnRvU3RyaW5nKCk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHRoaXMucmVwb3J0RXJyb3IoJ3Nlc3Npb25SZWFkRmlsZScsIGBFcnJvciByZWFkaW5nIGNoYXQgc2Vzc2lvbiBmaWxlICR7c2Vzc2lvbklkfWAsIGUpO1xuXG5cdFx0XHRcdGlmICh0b0ZpbGVPcGVyYXRpb25SZXN1bHQoZSkgPT09IEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9OT1RfRk9VTkQgJiYgdGhpcy5wcmV2aW91c0VtcHR5V2luZG93U3RvcmFnZVJvb3QpIHtcblx0XHRcdFx0XHRyYXdEYXRhID0gYXdhaXQgdGhpcy5yZWFkU2Vzc2lvbkZyb21QcmV2aW91c0xvY2F0aW9uKHNlc3Npb25JZCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIXJhd0RhdGEpIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdC8vIFRPRE8gQ29waWVkIGZyb20gQ2hhdFNlcnZpY2UudHMsIGNsZWFudXBcblx0XHRcdFx0Y29uc3Qgc2Vzc2lvbjogSVNlcmlhbGl6YWJsZUNoYXREYXRhSW4gPSByZXZpdmUoSlNPTi5wYXJzZShyYXdEYXRhKSk7IC8vIFJldml2ZSBzZXJpYWxpemVkIFVSSXMgaW4gc2Vzc2lvbiBkYXRhXG5cdFx0XHRcdC8vIFJldml2ZSBzZXJpYWxpemVkIG1hcmtkb3duIHN0cmluZ3MgaW4gcmVzcG9uc2UgZGF0YVxuXHRcdFx0XHRmb3IgKGNvbnN0IHJlcXVlc3Qgb2Ygc2Vzc2lvbi5yZXF1ZXN0cykge1xuXHRcdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KHJlcXVlc3QucmVzcG9uc2UpKSB7XG5cdFx0XHRcdFx0XHRyZXF1ZXN0LnJlc3BvbnNlID0gcmVxdWVzdC5yZXNwb25zZS5tYXAoKHJlc3BvbnNlKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGlmICh0eXBlb2YgcmVzcG9uc2UgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBNYXJrZG93blN0cmluZyhyZXNwb25zZSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0cmV0dXJuIHJlc3BvbnNlO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmICh0eXBlb2YgcmVxdWVzdC5yZXNwb25zZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdHJlcXVlc3QucmVzcG9uc2UgPSBbbmV3IE1hcmtkb3duU3RyaW5nKHJlcXVlc3QucmVzcG9uc2UpXTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gbm9ybWFsaXplU2VyaWFsaXphYmxlQ2hhdERhdGEoc2Vzc2lvbik7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0dGhpcy5yZXBvcnRFcnJvcignbWFsZm9ybWVkU2Vzc2lvbicsIGBNYWxmb3JtZWQgc2Vzc2lvbiBkYXRhIGluICR7c3RvcmFnZUxvY2F0aW9uLmZzUGF0aH06IFske3Jhd0RhdGEuc3Vic3RyaW5nKDAsIDIwKX0ke3Jhd0RhdGEubGVuZ3RoID4gMjAgPyAnLi4uJyA6ICcnfV1gLCBlcnIpO1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZWFkU2Vzc2lvbkZyb21QcmV2aW91c0xvY2F0aW9uKHNlc3Npb25JZDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcblx0XHRsZXQgcmF3RGF0YTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXG5cdFx0aWYgKHRoaXMucHJldmlvdXNFbXB0eVdpbmRvd1N0b3JhZ2VSb290KSB7XG5cdFx0XHRjb25zdCBzdG9yYWdlTG9jYXRpb24yID0gam9pblBhdGgodGhpcy5wcmV2aW91c0VtcHR5V2luZG93U3RvcmFnZVJvb3QsIGAke3Nlc3Npb25JZH0uanNvbmApO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmF3RGF0YSA9IChhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKHN0b3JhZ2VMb2NhdGlvbjIpKS52YWx1ZS50b1N0cmluZygpO1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhgQ2hhdFNlc3Npb25TdG9yZTogUmVhZCBjaGF0IHNlc3Npb24gJHtzZXNzaW9uSWR9IGZyb20gcHJldmlvdXMgbG9jYXRpb25gKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0dGhpcy5yZXBvcnRFcnJvcignc2Vzc2lvblJlYWRGaWxlJywgYEVycm9yIHJlYWRpbmcgY2hhdCBzZXNzaW9uIGZpbGUgJHtzZXNzaW9uSWR9IGZyb20gcHJldmlvdXMgbG9jYXRpb25gLCBlKTtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gcmF3RGF0YTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0U3RvcmFnZUxvY2F0aW9uKGNoYXRTZXNzaW9uSWQ6IHN0cmluZyk6IFVSSSB7XG5cdFx0cmV0dXJuIGpvaW5QYXRoKHRoaXMuc3RvcmFnZVJvb3QsIGAke2NoYXRTZXNzaW9uSWR9Lmpzb25gKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRDaGF0U3RvcmFnZUZvbGRlcigpOiBVUkkge1xuXHRcdHJldHVybiB0aGlzLnN0b3JhZ2VSb290O1xuXHR9XG59XG5cbmludGVyZmFjZSBJQ2hhdFNlc3Npb25FbnRyeU1ldGFkYXRhIHtcblx0c2Vzc2lvbklkOiBzdHJpbmc7XG5cdHRpdGxlOiBzdHJpbmc7XG5cdGxhc3RNZXNzYWdlRGF0ZTogbnVtYmVyO1xuXHRpc0ltcG9ydGVkPzogYm9vbGVhbjtcblx0aW5pdGlhbExvY2F0aW9uPzogQ2hhdEFnZW50TG9jYXRpb247XG5cblx0LyoqXG5cdCAqIFRoaXMgb25seSBleGlzdHMgYmVjYXVzZSB0aGUgbWlncmF0ZWQgZGF0YSBmcm9tIHRoZSBzdG9yYWdlIHNlcnZpY2UgaGFkIGVtcHR5IHNlc3Npb25zIHBlcnNpc3RlZCwgYW5kIGl0J3MgaW1wb3NzaWJsZSB0byBrbm93IHdoaWNoIG9uZXMgYXJlXG5cdCAqIGN1cnJlbnRseSBpbiB1c2UuIE5vdywgYGNsZWFyU2Vzc2lvbmAgZGVsZXRlcyBlbXB0eSBzZXNzaW9ucywgc28gb2xkIG9uZXMgc2hvdWxkbid0IHRha2UgdXAgc3BhY2UgaW4gdGhlIHN0b3JlIGFueW1vcmUsIGJ1dCB3ZSBzdGlsbCBuZWVkIHRvXG5cdCAqIGZpbHRlciB0aGUgb2xkIG9uZXMgb3V0IG9mIGhpc3RvcnkuXG5cdCAqL1xuXHRpc0VtcHR5PzogYm9vbGVhbjtcbn1cblxuZnVuY3Rpb24gaXNDaGF0U2Vzc2lvbkVudHJ5TWV0YWRhdGEob2JqOiB1bmtub3duKTogb2JqIGlzIElDaGF0U2Vzc2lvbkVudHJ5TWV0YWRhdGEge1xuXHRyZXR1cm4gKFxuXHRcdCEhb2JqICYmXG5cdFx0dHlwZW9mIG9iaiA9PT0gJ29iamVjdCcgJiZcblx0XHR0eXBlb2YgKG9iaiBhcyBJQ2hhdFNlc3Npb25FbnRyeU1ldGFkYXRhKS5zZXNzaW9uSWQgPT09ICdzdHJpbmcnICYmXG5cdFx0dHlwZW9mIChvYmogYXMgSUNoYXRTZXNzaW9uRW50cnlNZXRhZGF0YSkudGl0bGUgPT09ICdzdHJpbmcnICYmXG5cdFx0dHlwZW9mIChvYmogYXMgSUNoYXRTZXNzaW9uRW50cnlNZXRhZGF0YSkubGFzdE1lc3NhZ2VEYXRlID09PSAnbnVtYmVyJ1xuXHQpO1xufVxuXG5leHBvcnQgdHlwZSBJQ2hhdFNlc3Npb25JbmRleCA9IFJlY29yZDxzdHJpbmcsIElDaGF0U2Vzc2lvbkVudHJ5TWV0YWRhdGE+O1xuXG5pbnRlcmZhY2UgSUNoYXRTZXNzaW9uSW5kZXhEYXRhIHtcblx0dmVyc2lvbjogMTtcblx0ZW50cmllczogSUNoYXRTZXNzaW9uSW5kZXg7XG59XG5cbi8vIFRPRE8gaWYgd2UgdXBkYXRlIHRoZSBpbmRleCB2ZXJzaW9uOlxuLy8gRG9uJ3QgdGhyb3cgYXdheSBpbmRleCB3aGVuIG1vdmluZyBiYWNrd2FyZHMgaW4gVlMgQ29kZSB2ZXJzaW9uLiBUcnkgdG8gcmVjb3ZlciBpdC4gQnV0IHRoaXMgc2NlbmFyaW8gaXMgaGFyZC5cbmZ1bmN0aW9uIGlzQ2hhdFNlc3Npb25JbmRleChkYXRhOiB1bmtub3duKTogZGF0YSBpcyBJQ2hhdFNlc3Npb25JbmRleERhdGEge1xuXHRpZiAodHlwZW9mIGRhdGEgIT09ICdvYmplY3QnIHx8IGRhdGEgPT09IG51bGwpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRjb25zdCBpbmRleCA9IGRhdGEgYXMgSUNoYXRTZXNzaW9uSW5kZXhEYXRhO1xuXHRpZiAoaW5kZXgudmVyc2lvbiAhPT0gMSkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGlmICh0eXBlb2YgaW5kZXguZW50cmllcyAhPT0gJ29iamVjdCcgfHwgaW5kZXguZW50cmllcyA9PT0gbnVsbCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGZvciAoY29uc3Qga2V5IGluIGluZGV4LmVudHJpZXMpIHtcblx0XHRpZiAoIWlzQ2hhdFNlc3Npb25FbnRyeU1ldGFkYXRhKGluZGV4LmVudHJpZXNba2V5XSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gZ2V0U2Vzc2lvbk1ldGFkYXRhKHNlc3Npb246IENoYXRNb2RlbCB8IElTZXJpYWxpemFibGVDaGF0RGF0YSk6IElDaGF0U2Vzc2lvbkVudHJ5TWV0YWRhdGEge1xuXHRjb25zdCB0aXRsZSA9IHNlc3Npb24gaW5zdGFuY2VvZiBDaGF0TW9kZWwgP1xuXHRcdChzZXNzaW9uLnRpdGxlIHx8IGxvY2FsaXplKCduZXdDaGF0JywgXCJOZXcgQ2hhdFwiKSkgOlxuXHRcdHNlc3Npb24uY3VzdG9tVGl0bGUgPz8gQ2hhdE1vZGVsLmdldERlZmF1bHRUaXRsZShzZXNzaW9uLnJlcXVlc3RzKTtcblx0cmV0dXJuIHtcblx0XHRzZXNzaW9uSWQ6IHNlc3Npb24uc2Vzc2lvbklkLFxuXHRcdHRpdGxlLFxuXHRcdGxhc3RNZXNzYWdlRGF0ZTogc2Vzc2lvbi5sYXN0TWVzc2FnZURhdGUsXG5cdFx0aXNJbXBvcnRlZDogc2Vzc2lvbi5pc0ltcG9ydGVkLFxuXHRcdGluaXRpYWxMb2NhdGlvbjogc2Vzc2lvbi5pbml0aWFsTG9jYXRpb24sXG5cdFx0aXNFbXB0eTogc2Vzc2lvbiBpbnN0YW5jZW9mIENoYXRNb2RlbCA/IHNlc3Npb24uZ2V0UmVxdWVzdHMoKS5sZW5ndGggPT09IDAgOiBzZXNzaW9uLnJlcXVlc3RzLmxlbmd0aCA9PT0gMFxuXHR9O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0VHJhbnNmZXIge1xuXHR0b1dvcmtzcGFjZTogVVJJO1xuXHR0aW1lc3RhbXBJbk1pbGxpc2Vjb25kczogbnVtYmVyO1xuXHRpbnB1dFZhbHVlOiBzdHJpbmc7XG5cdGxvY2F0aW9uOiBDaGF0QWdlbnRMb2NhdGlvbjtcblx0bW9kZTogQ2hhdE1vZGU7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXRUcmFuc2ZlcjIgZXh0ZW5kcyBJQ2hhdFRyYW5zZmVyIHtcblx0Y2hhdDogSVNlcmlhbGl6YWJsZUNoYXREYXRhO1xufVxuXG4vLyB0eXBlIElDaGF0VHJhbnNmZXJEdG8gPSBEdG88SUNoYXRUcmFuc2Zlcj47XG5cbi8qKlxuICogTWFwIG9mIGRlc3RpbmF0aW9uIHdvcmtzcGFjZSBVUkkgdG8gY2hhdCB0cmFuc2ZlciBkYXRhXG4gKi9cbi8vIHR5cGUgSUNoYXRUcmFuc2ZlckluZGV4ID0gUmVjb3JkPHN0cmluZywgSUNoYXRUcmFuc2ZlckR0bz47XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsc0JBQXNCO0FB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
