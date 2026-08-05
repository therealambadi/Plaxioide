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
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { LRUCache } from "../../../../../base/common/map.js";
import { Schemas } from "../../../../../base/common/network.js";
import { join } from "../../../../../base/common/path.js";
import { isWindows, OperatingSystem } from "../../../../../base/common/platform.js";
import { env } from "../../../../../base/common/process.js";
import { URI } from "../../../../../base/common/uri.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { FileOperationError, FileOperationResult, IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { GeneralShellType, PosixShellType } from "../../../../../platform/terminal/common/terminal.js";
import { IRemoteAgentService } from "../../../../services/remote/common/remoteAgentService.js";
import { TerminalHistorySettingId } from "./terminal.history.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["DefaultHistoryLimit"] = 100] = "DefaultHistoryLimit";
  return Constants2;
})(Constants || {});
var StorageKeys = /* @__PURE__ */ ((StorageKeys2) => {
  StorageKeys2["Entries"] = "terminal.history.entries";
  StorageKeys2["Timestamp"] = "terminal.history.timestamp";
  return StorageKeys2;
})(StorageKeys || {});
let directoryHistory = void 0;
function getDirectoryHistory(accessor) {
  if (!directoryHistory) {
    directoryHistory = accessor.get(IInstantiationService).createInstance(TerminalPersistedHistory, "dirs");
  }
  return directoryHistory;
}
let commandHistory = void 0;
function getCommandHistory(accessor) {
  if (!commandHistory) {
    commandHistory = accessor.get(IInstantiationService).createInstance(TerminalPersistedHistory, "commands");
  }
  return commandHistory;
}
let TerminalPersistedHistory = class extends Disposable {
  constructor(_storageDataKey, _configurationService, _storageService) {
    super();
    this._storageDataKey = _storageDataKey;
    this._configurationService = _configurationService;
    this._storageService = _storageService;
    this._timestamp = 0;
    this._isReady = false;
    this._isStale = true;
    this._entries = new LRUCache(this._getHistoryLimit());
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalHistorySettingId.ShellIntegrationCommandHistory)) {
        this._entries.limit = this._getHistoryLimit();
      }
    }));
    this._register(this._storageService.onDidChangeValue(StorageScope.APPLICATION, this._getTimestampStorageKey(), this._store)(() => {
      if (!this._isStale) {
        this._isStale = this._storageService.getNumber(this._getTimestampStorageKey(), StorageScope.APPLICATION, 0) !== this._timestamp;
      }
    }));
  }
  get entries() {
    this._ensureUpToDate();
    return this._entries.entries();
  }
  add(key, value) {
    this._ensureUpToDate();
    this._entries.set(key, value);
    this._saveState();
  }
  remove(key) {
    this._ensureUpToDate();
    this._entries.delete(key);
    this._saveState();
  }
  clear() {
    this._ensureUpToDate();
    this._entries.clear();
    this._saveState();
  }
  _ensureUpToDate() {
    if (!this._isReady) {
      this._loadState();
      this._isReady = true;
    }
    if (this._isStale) {
      this._entries.clear();
      this._loadState();
      this._isStale = false;
    }
  }
  _loadState() {
    this._timestamp = this._storageService.getNumber(this._getTimestampStorageKey(), StorageScope.APPLICATION, 0);
    const serialized = this._loadPersistedState();
    if (serialized) {
      for (const entry of serialized.entries) {
        this._entries.set(entry.key, entry.value);
      }
    }
  }
  _loadPersistedState() {
    const raw = this._storageService.get(this._getEntriesStorageKey(), StorageScope.APPLICATION);
    if (raw === void 0 || raw.length === 0) {
      return void 0;
    }
    let serialized = void 0;
    try {
      serialized = JSON.parse(raw);
    } catch {
      return void 0;
    }
    return serialized;
  }
  _saveState() {
    const serialized = { entries: [] };
    this._entries.forEach((value, key) => serialized.entries.push({ key, value }));
    this._storageService.store(this._getEntriesStorageKey(), JSON.stringify(serialized), StorageScope.APPLICATION, StorageTarget.MACHINE);
    this._timestamp = Date.now();
    this._storageService.store(this._getTimestampStorageKey(), this._timestamp, StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
  _getHistoryLimit() {
    const historyLimit = this._configurationService.getValue(TerminalHistorySettingId.ShellIntegrationCommandHistory);
    return typeof historyLimit === "number" ? historyLimit : 100 /* DefaultHistoryLimit */;
  }
  _getTimestampStorageKey() {
    return `${"terminal.history.timestamp" /* Timestamp */}.${this._storageDataKey}`;
  }
  _getEntriesStorageKey() {
    return `${"terminal.history.entries" /* Entries */}.${this._storageDataKey}`;
  }
};
TerminalPersistedHistory = __decorateClass([
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IStorageService)
], TerminalPersistedHistory);
const shellFileHistory = /* @__PURE__ */ new Map();
async function getShellFileHistory(accessor, shellType) {
  const cached = shellFileHistory.get(shellType);
  if (cached === null) {
    return void 0;
  }
  if (cached !== void 0) {
    return cached;
  }
  let result;
  switch (shellType) {
    case PosixShellType.Bash:
      result = await fetchBashHistory(accessor);
      break;
    case GeneralShellType.PowerShell:
      result = await fetchPwshHistory(accessor);
      break;
    case PosixShellType.Zsh:
      result = await fetchZshHistory(accessor);
      break;
    case PosixShellType.Fish:
      result = await fetchFishHistory(accessor);
      break;
    case GeneralShellType.Python:
      result = await fetchPythonHistory(accessor);
      break;
    default:
      return void 0;
  }
  if (result === void 0) {
    shellFileHistory.set(shellType, null);
    return void 0;
  }
  shellFileHistory.set(shellType, result);
  return result;
}
function clearShellFileHistory() {
  shellFileHistory.clear();
}
async function fetchBashHistory(accessor) {
  const fileService = accessor.get(IFileService);
  const remoteAgentService = accessor.get(IRemoteAgentService);
  const remoteEnvironment = await remoteAgentService.getEnvironment();
  if (remoteEnvironment?.os === OperatingSystem.Windows || !remoteEnvironment && isWindows) {
    return void 0;
  }
  const sourceLabel = "~/.bash_history";
  const resolvedFile = await fetchFileContents(env["HOME"], ".bash_history", false, fileService, remoteAgentService);
  if (resolvedFile === void 0) {
    return void 0;
  }
  const fileLines = resolvedFile.content.split("\n");
  const result = /* @__PURE__ */ new Set();
  let currentLine;
  let currentCommand = void 0;
  let wrapChar = void 0;
  for (let i = 0; i < fileLines.length; i++) {
    currentLine = fileLines[i];
    if (currentCommand === void 0) {
      currentCommand = currentLine;
    } else {
      currentCommand += `
${currentLine}`;
    }
    for (let c = 0; c < currentLine.length; c++) {
      if (wrapChar) {
        if (currentLine[c] === wrapChar) {
          wrapChar = void 0;
        }
      } else {
        if (currentLine[c].match(/['"]/)) {
          wrapChar = currentLine[c];
        }
      }
    }
    if (wrapChar === void 0) {
      if (currentCommand.length > 0) {
        result.add(currentCommand.trim());
      }
      currentCommand = void 0;
    }
  }
  return {
    sourceLabel,
    sourceResource: resolvedFile.resource,
    commands: Array.from(result.values())
  };
}
async function fetchZshHistory(accessor) {
  const fileService = accessor.get(IFileService);
  const remoteAgentService = accessor.get(IRemoteAgentService);
  const remoteEnvironment = await remoteAgentService.getEnvironment();
  if (remoteEnvironment?.os === OperatingSystem.Windows || !remoteEnvironment && isWindows) {
    return void 0;
  }
  const sourceLabel = "~/.zsh_history";
  const resolvedFile = await fetchFileContents(env["HOME"], ".zsh_history", false, fileService, remoteAgentService);
  if (resolvedFile === void 0) {
    return void 0;
  }
  const fileLines = resolvedFile.content.split(/\:\s\d+\:\d+;/);
  const result = /* @__PURE__ */ new Set();
  for (let i = 0; i < fileLines.length; i++) {
    const sanitized = fileLines[i].replace(/\\\n/g, "\n").trim();
    if (sanitized.length > 0) {
      result.add(sanitized);
    }
  }
  return {
    sourceLabel,
    sourceResource: resolvedFile.resource,
    commands: Array.from(result.values())
  };
}
async function fetchPythonHistory(accessor) {
  const fileService = accessor.get(IFileService);
  const remoteAgentService = accessor.get(IRemoteAgentService);
  const sourceLabel = "~/.python_history";
  const resolvedFile = await fetchFileContents(env["HOME"], ".python_history", false, fileService, remoteAgentService);
  if (resolvedFile === void 0) {
    return void 0;
  }
  const fileLines = resolvedFile.content.split("\n");
  const result = /* @__PURE__ */ new Set();
  fileLines.forEach((line) => {
    if (line.trim().length > 0) {
      result.add(line.trim());
    }
  });
  return {
    sourceLabel,
    sourceResource: resolvedFile.resource,
    commands: Array.from(result.values())
  };
}
async function fetchPwshHistory(accessor) {
  const fileService = accessor.get(IFileService);
  const remoteAgentService = accessor.get(IRemoteAgentService);
  let folderPrefix;
  let filePath;
  const remoteEnvironment = await remoteAgentService.getEnvironment();
  const isFileWindows = remoteEnvironment?.os === OperatingSystem.Windows || !remoteEnvironment && isWindows;
  let sourceLabel;
  if (isFileWindows) {
    folderPrefix = env["APPDATA"];
    filePath = "Microsoft\\Windows\\PowerShell\\PSReadLine\\ConsoleHost_history.txt";
    sourceLabel = `$APPDATA\\Microsoft\\Windows\\PowerShell\\PSReadLine\\ConsoleHost_history.txt`;
  } else {
    folderPrefix = env["HOME"];
    filePath = ".local/share/powershell/PSReadline/ConsoleHost_history.txt";
    sourceLabel = `~/${filePath}`;
  }
  const resolvedFile = await fetchFileContents(folderPrefix, filePath, isFileWindows, fileService, remoteAgentService);
  if (resolvedFile === void 0) {
    return void 0;
  }
  const fileLines = resolvedFile.content.split("\n");
  const result = /* @__PURE__ */ new Set();
  let currentLine;
  let currentCommand = void 0;
  let wrapChar = void 0;
  for (let i = 0; i < fileLines.length; i++) {
    currentLine = fileLines[i];
    if (currentCommand === void 0) {
      currentCommand = currentLine;
    } else {
      currentCommand += `
${currentLine}`;
    }
    if (!currentLine.endsWith("`")) {
      const sanitized = currentCommand.trim();
      if (sanitized.length > 0) {
        result.add(sanitized);
      }
      currentCommand = void 0;
      continue;
    }
    for (let c = 0; c < currentLine.length; c++) {
      if (wrapChar) {
        if (currentLine[c] === wrapChar) {
          wrapChar = void 0;
        }
      } else {
        if (currentLine[c].match(/`/)) {
          wrapChar = currentLine[c];
        }
      }
    }
    if (!wrapChar) {
      const sanitized = currentCommand.trim();
      if (sanitized.length > 0) {
        result.add(sanitized);
      }
      currentCommand = void 0;
    } else {
      currentCommand = currentCommand.replace(/`$/, "");
      wrapChar = void 0;
    }
  }
  return {
    sourceLabel,
    sourceResource: resolvedFile.resource,
    commands: Array.from(result.values())
  };
}
async function fetchFishHistory(accessor) {
  const fileService = accessor.get(IFileService);
  const remoteAgentService = accessor.get(IRemoteAgentService);
  const remoteEnvironment = await remoteAgentService.getEnvironment();
  if (remoteEnvironment?.os === OperatingSystem.Windows || !remoteEnvironment && isWindows) {
    return void 0;
  }
  const overridenDataHome = env["XDG_DATA_HOME"];
  let folderPrefix;
  let filePath;
  let sourceLabel;
  if (overridenDataHome) {
    sourceLabel = "$XDG_DATA_HOME/fish/fish_history";
    folderPrefix = env["XDG_DATA_HOME"];
    filePath = "fish/fish_history";
  } else {
    sourceLabel = "~/.local/share/fish/fish_history";
    folderPrefix = env["HOME"];
    filePath = ".local/share/fish/fish_history";
  }
  const resolvedFile = await fetchFileContents(folderPrefix, filePath, false, fileService, remoteAgentService);
  if (resolvedFile === void 0) {
    return void 0;
  }
  const result = /* @__PURE__ */ new Set();
  const cmds = resolvedFile.content.split("\n").filter((x) => x.startsWith("- cmd:")).map((x) => x.substring(6).trimStart());
  for (let i = 0; i < cmds.length; i++) {
    const sanitized = sanitizeFishHistoryCmd(cmds[i]).trim();
    if (sanitized.length > 0) {
      result.add(sanitized);
    }
  }
  return {
    sourceLabel,
    sourceResource: resolvedFile.resource,
    commands: Array.from(result.values())
  };
}
function sanitizeFishHistoryCmd(cmd) {
  return repeatedReplace(/(^|[^\\])((?:\\\\)*)(\\n)/g, cmd, "$1$2\n");
}
function repeatedReplace(pattern, value, replaceValue) {
  let last;
  let current = value;
  while (true) {
    last = current;
    current = current.replace(pattern, replaceValue);
    if (current === last) {
      return current;
    }
  }
}
async function fetchFileContents(folderPrefix, filePath, isFileWindows, fileService, remoteAgentService) {
  if (!folderPrefix) {
    return void 0;
  }
  const connection = remoteAgentService.getConnection();
  const isRemote = !!connection?.remoteAuthority;
  const resource = URI.from({
    scheme: isRemote ? Schemas.vscodeRemote : Schemas.file,
    authority: isRemote ? connection.remoteAuthority : void 0,
    path: URI.file(join(folderPrefix, filePath)).path
  });
  let content;
  try {
    content = await fileService.readFile(resource);
  } catch (e) {
    if (e instanceof FileOperationError && e.fileOperationResult === FileOperationResult.FILE_NOT_FOUND) {
      return void 0;
    }
    throw e;
  }
  if (content === void 0) {
    return void 0;
  }
  return {
    resource,
    content: content.value.toString()
  };
}
export {
  TerminalPersistedHistory,
  clearShellFileHistory,
  fetchBashHistory,
  fetchFishHistory,
  fetchPwshHistory,
  fetchPythonHistory,
  fetchZshHistory,
  getCommandHistory,
  getDirectoryHistory,
  getShellFileHistory,
  sanitizeFishHistoryCmd
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvaGlzdG9yeS9jb21tb24vaGlzdG9yeS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTFJVQ2FjaGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgaXNXaW5kb3dzLCBPcGVyYXRpbmdTeXN0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBlbnYgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wcm9jZXNzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEZpbGVPcGVyYXRpb25FcnJvciwgRmlsZU9wZXJhdGlvblJlc3VsdCwgSUZpbGVDb250ZW50LCBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgR2VuZXJhbFNoZWxsVHlwZSwgUG9zaXhTaGVsbFR5cGUsIFRlcm1pbmFsU2hlbGxUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IElSZW1vdGVBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbEhpc3RvcnlTZXR0aW5nSWQgfSBmcm9tICcuL3Rlcm1pbmFsLmhpc3RvcnkuanMnO1xuXG4vKipcbiAqIFRyYWNrcyBhIGxpc3Qgb2YgZ2VuZXJpYyBlbnRyaWVzLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIElUZXJtaW5hbFBlcnNpc3RlZEhpc3Rvcnk8VD4ge1xuXHQvKipcblx0ICogVGhlIHBlcnNpc3RlZCBlbnRyaWVzLlxuXHQgKi9cblx0cmVhZG9ubHkgZW50cmllczogSXRlcmFibGVJdGVyYXRvcjxbc3RyaW5nLCBUXT47XG5cdC8qKlxuXHQgKiBBZGRzIGFuIGVudHJ5LlxuXHQgKi9cblx0YWRkKGtleTogc3RyaW5nLCB2YWx1ZTogVCk6IHZvaWQ7XG5cdC8qKlxuXHQgKiBSZW1vdmVzIGFuIGVudHJ5LlxuXHQgKi9cblx0cmVtb3ZlKGtleTogc3RyaW5nKTogdm9pZDtcblx0LyoqXG5cdCAqIENsZWFycyBhbGwgZW50cmllcy5cblx0ICovXG5cdGNsZWFyKCk6IHZvaWQ7XG59XG5cbmludGVyZmFjZSBJU2VyaWFsaXplZENhY2hlPFQ+IHtcblx0ZW50cmllczogeyBrZXk6IHN0cmluZzsgdmFsdWU6IFQgfVtdO1xufVxuXG5jb25zdCBlbnVtIENvbnN0YW50cyB7XG5cdERlZmF1bHRIaXN0b3J5TGltaXQgPSAxMDBcbn1cblxuY29uc3QgZW51bSBTdG9yYWdlS2V5cyB7XG5cdEVudHJpZXMgPSAndGVybWluYWwuaGlzdG9yeS5lbnRyaWVzJyxcblx0VGltZXN0YW1wID0gJ3Rlcm1pbmFsLmhpc3RvcnkudGltZXN0YW1wJ1xufVxuXG5sZXQgZGlyZWN0b3J5SGlzdG9yeTogSVRlcm1pbmFsUGVyc2lzdGVkSGlzdG9yeTx7IHJlbW90ZUF1dGhvcml0eT86IHN0cmluZyB9PiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcbmV4cG9ydCBmdW5jdGlvbiBnZXREaXJlY3RvcnlIaXN0b3J5KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogSVRlcm1pbmFsUGVyc2lzdGVkSGlzdG9yeTx7IHJlbW90ZUF1dGhvcml0eT86IHN0cmluZyB9PiB7XG5cdGlmICghZGlyZWN0b3J5SGlzdG9yeSkge1xuXHRcdGRpcmVjdG9yeUhpc3RvcnkgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbFBlcnNpc3RlZEhpc3RvcnksICdkaXJzJykgYXMgVGVybWluYWxQZXJzaXN0ZWRIaXN0b3J5PHsgcmVtb3RlQXV0aG9yaXR5Pzogc3RyaW5nIH0+O1xuXHR9XG5cdHJldHVybiBkaXJlY3RvcnlIaXN0b3J5O1xufVxuXG5sZXQgY29tbWFuZEhpc3Rvcnk6IElUZXJtaW5hbFBlcnNpc3RlZEhpc3Rvcnk8eyBzaGVsbFR5cGU6IFRlcm1pbmFsU2hlbGxUeXBlIH0+IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuZXhwb3J0IGZ1bmN0aW9uIGdldENvbW1hbmRIaXN0b3J5KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogSVRlcm1pbmFsUGVyc2lzdGVkSGlzdG9yeTx7IHNoZWxsVHlwZTogVGVybWluYWxTaGVsbFR5cGUgfCB1bmRlZmluZWQgfT4ge1xuXHRpZiAoIWNvbW1hbmRIaXN0b3J5KSB7XG5cdFx0Y29tbWFuZEhpc3RvcnkgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbFBlcnNpc3RlZEhpc3RvcnksICdjb21tYW5kcycpIGFzIFRlcm1pbmFsUGVyc2lzdGVkSGlzdG9yeTx7IHNoZWxsVHlwZTogVGVybWluYWxTaGVsbFR5cGUgfT47XG5cdH1cblx0cmV0dXJuIGNvbW1hbmRIaXN0b3J5O1xufVxuXG5leHBvcnQgY2xhc3MgVGVybWluYWxQZXJzaXN0ZWRIaXN0b3J5PFQ+IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElUZXJtaW5hbFBlcnNpc3RlZEhpc3Rvcnk8VD4ge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9lbnRyaWVzOiBMUlVDYWNoZTxzdHJpbmcsIFQ+O1xuXHRwcml2YXRlIF90aW1lc3RhbXA6IG51bWJlciA9IDA7XG5cdHByaXZhdGUgX2lzUmVhZHkgPSBmYWxzZTtcblx0cHJpdmF0ZSBfaXNTdGFsZSA9IHRydWU7XG5cblx0Z2V0IGVudHJpZXMoKTogSXRlcmFibGVJdGVyYXRvcjxbc3RyaW5nLCBUXT4ge1xuXHRcdHRoaXMuX2Vuc3VyZVVwVG9EYXRlKCk7XG5cdFx0cmV0dXJuIHRoaXMuX2VudHJpZXMuZW50cmllcygpO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfc3RvcmFnZURhdGFLZXk6IHN0cmluZyxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9zdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Ly8gSW5pdCBjYWNoZVxuXHRcdHRoaXMuX2VudHJpZXMgPSBuZXcgTFJVQ2FjaGU8c3RyaW5nLCBUPih0aGlzLl9nZXRIaXN0b3J5TGltaXQoKSk7XG5cblx0XHQvLyBMaXN0ZW4gZm9yIGNvbmZpZyBjaGFuZ2VzIHRvIHNldCBoaXN0b3J5IGxpbWl0XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGVybWluYWxIaXN0b3J5U2V0dGluZ0lkLlNoZWxsSW50ZWdyYXRpb25Db21tYW5kSGlzdG9yeSkpIHtcblx0XHRcdFx0dGhpcy5fZW50cmllcy5saW1pdCA9IHRoaXMuX2dldEhpc3RvcnlMaW1pdCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdC8vIExpc3RlbiB0byBjYWNoZSBjaGFuZ2VzIGZyb20gb3RoZXIgd2luZG93c1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLm9uRGlkQ2hhbmdlVmFsdWUoU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCB0aGlzLl9nZXRUaW1lc3RhbXBTdG9yYWdlS2V5KCksIHRoaXMuX3N0b3JlKSgoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuX2lzU3RhbGUpIHtcblx0XHRcdFx0dGhpcy5faXNTdGFsZSA9IHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmdldE51bWJlcih0aGlzLl9nZXRUaW1lc3RhbXBTdG9yYWdlS2V5KCksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgMCkgIT09IHRoaXMuX3RpbWVzdGFtcDtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRhZGQoa2V5OiBzdHJpbmcsIHZhbHVlOiBUKSB7XG5cdFx0dGhpcy5fZW5zdXJlVXBUb0RhdGUoKTtcblx0XHR0aGlzLl9lbnRyaWVzLnNldChrZXksIHZhbHVlKTtcblx0XHR0aGlzLl9zYXZlU3RhdGUoKTtcblx0fVxuXG5cdHJlbW92ZShrZXk6IHN0cmluZykge1xuXHRcdHRoaXMuX2Vuc3VyZVVwVG9EYXRlKCk7XG5cdFx0dGhpcy5fZW50cmllcy5kZWxldGUoa2V5KTtcblx0XHR0aGlzLl9zYXZlU3RhdGUoKTtcblx0fVxuXG5cdGNsZWFyKCkge1xuXHRcdHRoaXMuX2Vuc3VyZVVwVG9EYXRlKCk7XG5cdFx0dGhpcy5fZW50cmllcy5jbGVhcigpO1xuXHRcdHRoaXMuX3NhdmVTdGF0ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZW5zdXJlVXBUb0RhdGUoKSB7XG5cdFx0Ly8gSW5pdGlhbCBsb2FkXG5cdFx0aWYgKCF0aGlzLl9pc1JlYWR5KSB7XG5cdFx0XHR0aGlzLl9sb2FkU3RhdGUoKTtcblx0XHRcdHRoaXMuX2lzUmVhZHkgPSB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIFJlYWN0IHRvIHN0YWxlIGNhY2hlIGNhdXNlZCBieSBhbm90aGVyIHdpbmRvd1xuXHRcdGlmICh0aGlzLl9pc1N0YWxlKSB7XG5cdFx0XHQvLyBTaW5jZSBzdGF0ZSBpcyBzYXZlZCB3aGVuZXZlciB0aGUgZW50cmllcyBjaGFuZ2UsIGl0J3MgYSBzYWZlIGFzc3VtcHRpb24gdGhhdCBub1xuXHRcdFx0Ly8gbWVyZ2luZyBvZiBlbnRyaWVzIG5lZWRzIHRvIGhhcHBlbiwganVzdCBsb2FkaW5nIHRoZSBuZXcgc3RhdGUuXG5cdFx0XHR0aGlzLl9lbnRyaWVzLmNsZWFyKCk7XG5cdFx0XHR0aGlzLl9sb2FkU3RhdGUoKTtcblx0XHRcdHRoaXMuX2lzU3RhbGUgPSBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9sb2FkU3RhdGUoKSB7XG5cdFx0dGhpcy5fdGltZXN0YW1wID0gdGhpcy5fc3RvcmFnZVNlcnZpY2UuZ2V0TnVtYmVyKHRoaXMuX2dldFRpbWVzdGFtcFN0b3JhZ2VLZXkoKSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCAwKTtcblxuXHRcdC8vIExvYWQgZ2xvYmFsIGVudHJpZXMgcGx1c1xuXHRcdGNvbnN0IHNlcmlhbGl6ZWQgPSB0aGlzLl9sb2FkUGVyc2lzdGVkU3RhdGUoKTtcblx0XHRpZiAoc2VyaWFsaXplZCkge1xuXHRcdFx0Zm9yIChjb25zdCBlbnRyeSBvZiBzZXJpYWxpemVkLmVudHJpZXMpIHtcblx0XHRcdFx0dGhpcy5fZW50cmllcy5zZXQoZW50cnkua2V5LCBlbnRyeS52YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfbG9hZFBlcnNpc3RlZFN0YXRlKCk6IElTZXJpYWxpemVkQ2FjaGU8VD4gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHJhdyA9IHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmdldCh0aGlzLl9nZXRFbnRyaWVzU3RvcmFnZUtleSgpLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pO1xuXHRcdGlmIChyYXcgPT09IHVuZGVmaW5lZCB8fCByYXcubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRsZXQgc2VyaWFsaXplZDogSVNlcmlhbGl6ZWRDYWNoZTxUPiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0c2VyaWFsaXplZCA9IEpTT04ucGFyc2UocmF3KTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdC8vIEludmFsaWQgZGF0YVxuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHNlcmlhbGl6ZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9zYXZlU3RhdGUoKSB7XG5cdFx0Y29uc3Qgc2VyaWFsaXplZDogSVNlcmlhbGl6ZWRDYWNoZTxUPiA9IHsgZW50cmllczogW10gfTtcblx0XHR0aGlzLl9lbnRyaWVzLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHNlcmlhbGl6ZWQuZW50cmllcy5wdXNoKHsga2V5LCB2YWx1ZSB9KSk7XG5cdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2Uuc3RvcmUodGhpcy5fZ2V0RW50cmllc1N0b3JhZ2VLZXkoKSwgSlNPTi5zdHJpbmdpZnkoc2VyaWFsaXplZCksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHR0aGlzLl90aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuXHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnN0b3JlKHRoaXMuX2dldFRpbWVzdGFtcFN0b3JhZ2VLZXkoKSwgdGhpcy5fdGltZXN0YW1wLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRIaXN0b3J5TGltaXQoKSB7XG5cdFx0Y29uc3QgaGlzdG9yeUxpbWl0ID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoVGVybWluYWxIaXN0b3J5U2V0dGluZ0lkLlNoZWxsSW50ZWdyYXRpb25Db21tYW5kSGlzdG9yeSk7XG5cdFx0cmV0dXJuIHR5cGVvZiBoaXN0b3J5TGltaXQgPT09ICdudW1iZXInID8gaGlzdG9yeUxpbWl0IDogQ29uc3RhbnRzLkRlZmF1bHRIaXN0b3J5TGltaXQ7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRUaW1lc3RhbXBTdG9yYWdlS2V5KCkge1xuXHRcdHJldHVybiBgJHtTdG9yYWdlS2V5cy5UaW1lc3RhbXB9LiR7dGhpcy5fc3RvcmFnZURhdGFLZXl9YDtcblx0fVxuXG5cdHByaXZhdGUgX2dldEVudHJpZXNTdG9yYWdlS2V5KCkge1xuXHRcdHJldHVybiBgJHtTdG9yYWdlS2V5cy5FbnRyaWVzfS4ke3RoaXMuX3N0b3JhZ2VEYXRhS2V5fWA7XG5cdH1cbn1cblxuLy8gU2hlbGwgZmlsZSBoaXN0b3J5IGxvYWRzIG9uY2UgcGVyIHNoZWxsIHBlciB3aW5kb3dcbmludGVyZmFjZSBJU2hlbGxGaWxlSGlzdG9yeUVudHJ5IHtcblx0c291cmNlTGFiZWw6IHN0cmluZztcblx0c291cmNlUmVzb3VyY2U6IFVSSTtcblx0Y29tbWFuZHM6IHN0cmluZ1tdO1xufVxuY29uc3Qgc2hlbGxGaWxlSGlzdG9yeTogTWFwPFRlcm1pbmFsU2hlbGxUeXBlIHwgdW5kZWZpbmVkLCBJU2hlbGxGaWxlSGlzdG9yeUVudHJ5IHwgbnVsbD4gPSBuZXcgTWFwKCk7XG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0U2hlbGxGaWxlSGlzdG9yeShhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgc2hlbGxUeXBlOiBUZXJtaW5hbFNoZWxsVHlwZSB8IHVuZGVmaW5lZCk6IFByb21pc2U8SVNoZWxsRmlsZUhpc3RvcnlFbnRyeSB8IHVuZGVmaW5lZD4ge1xuXHRjb25zdCBjYWNoZWQgPSBzaGVsbEZpbGVIaXN0b3J5LmdldChzaGVsbFR5cGUpO1xuXHRpZiAoY2FjaGVkID09PSBudWxsKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXHRpZiAoY2FjaGVkICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gY2FjaGVkO1xuXHR9XG5cdGxldCByZXN1bHQ6IElTaGVsbEZpbGVIaXN0b3J5RW50cnkgfCB1bmRlZmluZWQ7XG5cdHN3aXRjaCAoc2hlbGxUeXBlKSB7XG5cdFx0Y2FzZSBQb3NpeFNoZWxsVHlwZS5CYXNoOlxuXHRcdFx0cmVzdWx0ID0gYXdhaXQgZmV0Y2hCYXNoSGlzdG9yeShhY2Nlc3Nvcik7XG5cdFx0XHRicmVhaztcblx0XHRjYXNlIEdlbmVyYWxTaGVsbFR5cGUuUG93ZXJTaGVsbDpcblx0XHRcdHJlc3VsdCA9IGF3YWl0IGZldGNoUHdzaEhpc3RvcnkoYWNjZXNzb3IpO1xuXHRcdFx0YnJlYWs7XG5cdFx0Y2FzZSBQb3NpeFNoZWxsVHlwZS5ac2g6XG5cdFx0XHRyZXN1bHQgPSBhd2FpdCBmZXRjaFpzaEhpc3RvcnkoYWNjZXNzb3IpO1xuXHRcdFx0YnJlYWs7XG5cdFx0Y2FzZSBQb3NpeFNoZWxsVHlwZS5GaXNoOlxuXHRcdFx0cmVzdWx0ID0gYXdhaXQgZmV0Y2hGaXNoSGlzdG9yeShhY2Nlc3Nvcik7XG5cdFx0XHRicmVhaztcblx0XHRjYXNlIEdlbmVyYWxTaGVsbFR5cGUuUHl0aG9uOlxuXHRcdFx0cmVzdWx0ID0gYXdhaXQgZmV0Y2hQeXRob25IaXN0b3J5KGFjY2Vzc29yKTtcblx0XHRcdGJyZWFrO1xuXHRcdGRlZmF1bHQ6IHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblx0aWYgKHJlc3VsdCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0c2hlbGxGaWxlSGlzdG9yeS5zZXQoc2hlbGxUeXBlLCBudWxsKTtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cdHNoZWxsRmlsZUhpc3Rvcnkuc2V0KHNoZWxsVHlwZSwgcmVzdWx0KTtcblx0cmV0dXJuIHJlc3VsdDtcbn1cbmV4cG9ydCBmdW5jdGlvbiBjbGVhclNoZWxsRmlsZUhpc3RvcnkoKSB7XG5cdHNoZWxsRmlsZUhpc3RvcnkuY2xlYXIoKTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoQmFzaEhpc3RvcnkoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPElTaGVsbEZpbGVIaXN0b3J5RW50cnkgfCB1bmRlZmluZWQ+IHtcblx0Y29uc3QgZmlsZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0Y29uc3QgcmVtb3RlQWdlbnRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElSZW1vdGVBZ2VudFNlcnZpY2UpO1xuXHRjb25zdCByZW1vdGVFbnZpcm9ubWVudCA9IGF3YWl0IHJlbW90ZUFnZW50U2VydmljZS5nZXRFbnZpcm9ubWVudCgpO1xuXHRpZiAocmVtb3RlRW52aXJvbm1lbnQ/Lm9zID09PSBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cyB8fCAhcmVtb3RlRW52aXJvbm1lbnQgJiYgaXNXaW5kb3dzKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXHRjb25zdCBzb3VyY2VMYWJlbCA9ICd+Ly5iYXNoX2hpc3RvcnknO1xuXHRjb25zdCByZXNvbHZlZEZpbGUgPSBhd2FpdCBmZXRjaEZpbGVDb250ZW50cyhlbnZbJ0hPTUUnXSwgJy5iYXNoX2hpc3RvcnknLCBmYWxzZSwgZmlsZVNlcnZpY2UsIHJlbW90ZUFnZW50U2VydmljZSk7XG5cdGlmIChyZXNvbHZlZEZpbGUgPT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblx0Ly8gLmJhc2hfaGlzdG9yeSBkb2VzIG5vdCBkaWZmZXJlbnRpYXRlIHdyYXBwZWQgY29tbWFuZHMgZnJvbSBtdWx0aXBsZSBjb21tYW5kcy4gUGFyc2Vcblx0Ly8gdGhlIG91dHB1dCB0byBnZXQgdGhlXG5cdGNvbnN0IGZpbGVMaW5lcyA9IHJlc29sdmVkRmlsZS5jb250ZW50LnNwbGl0KCdcXG4nKTtcblx0Y29uc3QgcmVzdWx0OiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblx0bGV0IGN1cnJlbnRMaW5lOiBzdHJpbmc7XG5cdGxldCBjdXJyZW50Q29tbWFuZDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRsZXQgd3JhcENoYXI6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBmaWxlTGluZXMubGVuZ3RoOyBpKyspIHtcblx0XHRjdXJyZW50TGluZSA9IGZpbGVMaW5lc1tpXTtcblx0XHRpZiAoY3VycmVudENvbW1hbmQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Y3VycmVudENvbW1hbmQgPSBjdXJyZW50TGluZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y3VycmVudENvbW1hbmQgKz0gYFxcbiR7Y3VycmVudExpbmV9YDtcblx0XHR9XG5cdFx0Zm9yIChsZXQgYyA9IDA7IGMgPCBjdXJyZW50TGluZS5sZW5ndGg7IGMrKykge1xuXHRcdFx0aWYgKHdyYXBDaGFyKSB7XG5cdFx0XHRcdGlmIChjdXJyZW50TGluZVtjXSA9PT0gd3JhcENoYXIpIHtcblx0XHRcdFx0XHR3cmFwQ2hhciA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGN1cnJlbnRMaW5lW2NdLm1hdGNoKC9bJ1wiXS8pKSB7XG5cdFx0XHRcdFx0d3JhcENoYXIgPSBjdXJyZW50TGluZVtjXTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAod3JhcENoYXIgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0aWYgKGN1cnJlbnRDb21tYW5kLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0cmVzdWx0LmFkZChjdXJyZW50Q29tbWFuZC50cmltKCkpO1xuXHRcdFx0fVxuXHRcdFx0Y3VycmVudENvbW1hbmQgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRzb3VyY2VMYWJlbCxcblx0XHRzb3VyY2VSZXNvdXJjZTogcmVzb2x2ZWRGaWxlLnJlc291cmNlLFxuXHRcdGNvbW1hbmRzOiBBcnJheS5mcm9tKHJlc3VsdC52YWx1ZXMoKSlcblx0fTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoWnNoSGlzdG9yeShhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8SVNoZWxsRmlsZUhpc3RvcnlFbnRyeSB8IHVuZGVmaW5lZD4ge1xuXHRjb25zdCBmaWxlU2VydmljZSA9IGFjY2Vzc29yLmdldChJRmlsZVNlcnZpY2UpO1xuXHRjb25zdCByZW1vdGVBZ2VudFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVJlbW90ZUFnZW50U2VydmljZSk7XG5cdGNvbnN0IHJlbW90ZUVudmlyb25tZW50ID0gYXdhaXQgcmVtb3RlQWdlbnRTZXJ2aWNlLmdldEVudmlyb25tZW50KCk7XG5cdGlmIChyZW1vdGVFbnZpcm9ubWVudD8ub3MgPT09IE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzIHx8ICFyZW1vdGVFbnZpcm9ubWVudCAmJiBpc1dpbmRvd3MpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0Y29uc3Qgc291cmNlTGFiZWwgPSAnfi8uenNoX2hpc3RvcnknO1xuXHRjb25zdCByZXNvbHZlZEZpbGUgPSBhd2FpdCBmZXRjaEZpbGVDb250ZW50cyhlbnZbJ0hPTUUnXSwgJy56c2hfaGlzdG9yeScsIGZhbHNlLCBmaWxlU2VydmljZSwgcmVtb3RlQWdlbnRTZXJ2aWNlKTtcblx0aWYgKHJlc29sdmVkRmlsZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXHRjb25zdCBmaWxlTGluZXMgPSByZXNvbHZlZEZpbGUuY29udGVudC5zcGxpdCgvXFw6XFxzXFxkK1xcOlxcZCs7Lyk7XG5cdGNvbnN0IHJlc3VsdDogU2V0PHN0cmluZz4gPSBuZXcgU2V0KCk7XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgZmlsZUxpbmVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3Qgc2FuaXRpemVkID0gZmlsZUxpbmVzW2ldLnJlcGxhY2UoL1xcXFxcXG4vZywgJ1xcbicpLnRyaW0oKTtcblx0XHRpZiAoc2FuaXRpemVkLmxlbmd0aCA+IDApIHtcblx0XHRcdHJlc3VsdC5hZGQoc2FuaXRpemVkKTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIHtcblx0XHRzb3VyY2VMYWJlbCxcblx0XHRzb3VyY2VSZXNvdXJjZTogcmVzb2x2ZWRGaWxlLnJlc291cmNlLFxuXHRcdGNvbW1hbmRzOiBBcnJheS5mcm9tKHJlc3VsdC52YWx1ZXMoKSlcblx0fTtcbn1cblxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmV0Y2hQeXRob25IaXN0b3J5KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTxJU2hlbGxGaWxlSGlzdG9yeUVudHJ5IHwgdW5kZWZpbmVkPiB7XG5cdGNvbnN0IGZpbGVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElGaWxlU2VydmljZSk7XG5cdGNvbnN0IHJlbW90ZUFnZW50U2VydmljZSA9IGFjY2Vzc29yLmdldChJUmVtb3RlQWdlbnRTZXJ2aWNlKTtcblxuXHRjb25zdCBzb3VyY2VMYWJlbCA9ICd+Ly5weXRob25faGlzdG9yeSc7XG5cdGNvbnN0IHJlc29sdmVkRmlsZSA9IGF3YWl0IGZldGNoRmlsZUNvbnRlbnRzKGVudlsnSE9NRSddLCAnLnB5dGhvbl9oaXN0b3J5JywgZmFsc2UsIGZpbGVTZXJ2aWNlLCByZW1vdGVBZ2VudFNlcnZpY2UpO1xuXG5cdGlmIChyZXNvbHZlZEZpbGUgPT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHQvLyBQeXRob24gaGlzdG9yeSBmaWxlIGlzIGEgc2ltcGxlIHRleHQgZmlsZSB3aXRoIG9uZSBjb21tYW5kIHBlciBsaW5lXG5cdGNvbnN0IGZpbGVMaW5lcyA9IHJlc29sdmVkRmlsZS5jb250ZW50LnNwbGl0KCdcXG4nKTtcblx0Y29uc3QgcmVzdWx0OiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblxuXHRmaWxlTGluZXMuZm9yRWFjaChsaW5lID0+IHtcblx0XHRpZiAobGluZS50cmltKCkubGVuZ3RoID4gMCkge1xuXHRcdFx0cmVzdWx0LmFkZChsaW5lLnRyaW0oKSk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZXR1cm4ge1xuXHRcdHNvdXJjZUxhYmVsLFxuXHRcdHNvdXJjZVJlc291cmNlOiByZXNvbHZlZEZpbGUucmVzb3VyY2UsXG5cdFx0Y29tbWFuZHM6IEFycmF5LmZyb20ocmVzdWx0LnZhbHVlcygpKVxuXHR9O1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmV0Y2hQd3NoSGlzdG9yeShhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8SVNoZWxsRmlsZUhpc3RvcnlFbnRyeSB8IHVuZGVmaW5lZD4ge1xuXHRjb25zdCBmaWxlU2VydmljZTogUGljazxJRmlsZVNlcnZpY2UsICdyZWFkRmlsZSc+ID0gYWNjZXNzb3IuZ2V0KElGaWxlU2VydmljZSk7XG5cdGNvbnN0IHJlbW90ZUFnZW50U2VydmljZTogUGljazxJUmVtb3RlQWdlbnRTZXJ2aWNlLCAnZ2V0Q29ubmVjdGlvbicgfCAnZ2V0RW52aXJvbm1lbnQnPiA9IGFjY2Vzc29yLmdldChJUmVtb3RlQWdlbnRTZXJ2aWNlKTtcblx0bGV0IGZvbGRlclByZWZpeDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRsZXQgZmlsZVBhdGg6IHN0cmluZztcblx0Y29uc3QgcmVtb3RlRW52aXJvbm1lbnQgPSBhd2FpdCByZW1vdGVBZ2VudFNlcnZpY2UuZ2V0RW52aXJvbm1lbnQoKTtcblx0Y29uc3QgaXNGaWxlV2luZG93cyA9IHJlbW90ZUVudmlyb25tZW50Py5vcyA9PT0gT3BlcmF0aW5nU3lzdGVtLldpbmRvd3MgfHwgIXJlbW90ZUVudmlyb25tZW50ICYmIGlzV2luZG93cztcblx0bGV0IHNvdXJjZUxhYmVsOiBzdHJpbmc7XG5cdGlmIChpc0ZpbGVXaW5kb3dzKSB7XG5cdFx0Zm9sZGVyUHJlZml4ID0gZW52WydBUFBEQVRBJ107XG5cdFx0ZmlsZVBhdGggPSAnTWljcm9zb2Z0XFxcXFdpbmRvd3NcXFxcUG93ZXJTaGVsbFxcXFxQU1JlYWRMaW5lXFxcXENvbnNvbGVIb3N0X2hpc3RvcnkudHh0Jztcblx0XHRzb3VyY2VMYWJlbCA9IGAkQVBQREFUQVxcXFxNaWNyb3NvZnRcXFxcV2luZG93c1xcXFxQb3dlclNoZWxsXFxcXFBTUmVhZExpbmVcXFxcQ29uc29sZUhvc3RfaGlzdG9yeS50eHRgO1xuXHR9IGVsc2Uge1xuXHRcdGZvbGRlclByZWZpeCA9IGVudlsnSE9NRSddO1xuXHRcdGZpbGVQYXRoID0gJy5sb2NhbC9zaGFyZS9wb3dlcnNoZWxsL1BTUmVhZGxpbmUvQ29uc29sZUhvc3RfaGlzdG9yeS50eHQnO1xuXHRcdHNvdXJjZUxhYmVsID0gYH4vJHtmaWxlUGF0aH1gO1xuXHR9XG5cdGNvbnN0IHJlc29sdmVkRmlsZSA9IGF3YWl0IGZldGNoRmlsZUNvbnRlbnRzKGZvbGRlclByZWZpeCwgZmlsZVBhdGgsIGlzRmlsZVdpbmRvd3MsIGZpbGVTZXJ2aWNlLCByZW1vdGVBZ2VudFNlcnZpY2UpO1xuXHRpZiAocmVzb2x2ZWRGaWxlID09PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cdGNvbnN0IGZpbGVMaW5lcyA9IHJlc29sdmVkRmlsZS5jb250ZW50LnNwbGl0KCdcXG4nKTtcblx0Y29uc3QgcmVzdWx0OiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblx0bGV0IGN1cnJlbnRMaW5lOiBzdHJpbmc7XG5cdGxldCBjdXJyZW50Q29tbWFuZDogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRsZXQgd3JhcENoYXI6IHN0cmluZyB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBmaWxlTGluZXMubGVuZ3RoOyBpKyspIHtcblx0XHRjdXJyZW50TGluZSA9IGZpbGVMaW5lc1tpXTtcblx0XHRpZiAoY3VycmVudENvbW1hbmQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Y3VycmVudENvbW1hbmQgPSBjdXJyZW50TGluZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y3VycmVudENvbW1hbmQgKz0gYFxcbiR7Y3VycmVudExpbmV9YDtcblx0XHR9XG5cdFx0aWYgKCFjdXJyZW50TGluZS5lbmRzV2l0aCgnYCcpKSB7XG5cdFx0XHRjb25zdCBzYW5pdGl6ZWQgPSBjdXJyZW50Q29tbWFuZC50cmltKCk7XG5cdFx0XHRpZiAoc2FuaXRpemVkLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0cmVzdWx0LmFkZChzYW5pdGl6ZWQpO1xuXHRcdFx0fVxuXHRcdFx0Y3VycmVudENvbW1hbmQgPSB1bmRlZmluZWQ7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cdFx0Ly8gSWYgdGhlIGxpbmUgZW5kcyB3aXRoIGAsIHRoZSBsaW5lIG1heSBiZSB3cmFwcGVkLiBOZWVkIHRvIGFsc28gdGVzdCB0aGUgY2FzZSB3aGVyZSBgIGlzXG5cdFx0Ly8gdGhlIGxhc3QgY2hhcmFjdGVyIGluIHRoZSBsaW5lXG5cdFx0Zm9yIChsZXQgYyA9IDA7IGMgPCBjdXJyZW50TGluZS5sZW5ndGg7IGMrKykge1xuXHRcdFx0aWYgKHdyYXBDaGFyKSB7XG5cdFx0XHRcdGlmIChjdXJyZW50TGluZVtjXSA9PT0gd3JhcENoYXIpIHtcblx0XHRcdFx0XHR3cmFwQ2hhciA9IHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKGN1cnJlbnRMaW5lW2NdLm1hdGNoKC9gLykpIHtcblx0XHRcdFx0XHR3cmFwQ2hhciA9IGN1cnJlbnRMaW5lW2NdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdC8vIEhhdmluZyBhbiBldmVuIG51bWJlciBvZiBiYWNrdGlja3MgbWVhbnMgdGhlIGxpbmUgaXMgdGVybWluYXRlZFxuXHRcdC8vIFRPRE86IFRoaXMgZG9lc24ndCBjb3ZlciBtb3JlIGNvbXBsaWNhdGVkIGNhc2VzIHdoZXJlIGAgaXMgd2l0aGluIHF1b3Rlc1xuXHRcdGlmICghd3JhcENoYXIpIHtcblx0XHRcdGNvbnN0IHNhbml0aXplZCA9IGN1cnJlbnRDb21tYW5kLnRyaW0oKTtcblx0XHRcdGlmIChzYW5pdGl6ZWQubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRyZXN1bHQuYWRkKHNhbml0aXplZCk7XG5cdFx0XHR9XG5cdFx0XHRjdXJyZW50Q29tbWFuZCA9IHVuZGVmaW5lZDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gUmVtb3ZlIHRyYWlsaW5nIGJhY2t0aWNrXG5cdFx0XHRjdXJyZW50Q29tbWFuZCA9IGN1cnJlbnRDb21tYW5kLnJlcGxhY2UoL2AkLywgJycpO1xuXHRcdFx0d3JhcENoYXIgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0cmV0dXJuIHtcblx0XHRzb3VyY2VMYWJlbCxcblx0XHRzb3VyY2VSZXNvdXJjZTogcmVzb2x2ZWRGaWxlLnJlc291cmNlLFxuXHRcdGNvbW1hbmRzOiBBcnJheS5mcm9tKHJlc3VsdC52YWx1ZXMoKSlcblx0fTtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGZldGNoRmlzaEhpc3RvcnkoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPElTaGVsbEZpbGVIaXN0b3J5RW50cnkgfCB1bmRlZmluZWQ+IHtcblx0Y29uc3QgZmlsZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0Y29uc3QgcmVtb3RlQWdlbnRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElSZW1vdGVBZ2VudFNlcnZpY2UpO1xuXHRjb25zdCByZW1vdGVFbnZpcm9ubWVudCA9IGF3YWl0IHJlbW90ZUFnZW50U2VydmljZS5nZXRFbnZpcm9ubWVudCgpO1xuXHRpZiAocmVtb3RlRW52aXJvbm1lbnQ/Lm9zID09PSBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cyB8fCAhcmVtb3RlRW52aXJvbm1lbnQgJiYgaXNXaW5kb3dzKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBGcm9tIGBmaXNoYCBkb2NzOlxuXHQgKiA+IFRoZSBjb21tYW5kIGhpc3RvcnkgaXMgc3RvcmVkIGluIHRoZSBmaWxlIH4vLmxvY2FsL3NoYXJlL2Zpc2gvZmlzaF9oaXN0b3J5XG5cdCAqICAgKG9yICRYREdfREFUQV9IT01FL2Zpc2gvZmlzaF9oaXN0b3J5IGlmIHRoYXQgdmFyaWFibGUgaXMgc2V0KSBieSBkZWZhdWx0LlxuXHQgKlxuXHQgKiAoaHR0cHM6Ly9maXNoc2hlbGwuY29tL2RvY3MvY3VycmVudC9pbnRlcmFjdGl2ZS5odG1sI2hpc3Rvcnktc2VhcmNoKVxuXHQgKi9cblx0Y29uc3Qgb3ZlcnJpZGVuRGF0YUhvbWUgPSBlbnZbJ1hER19EQVRBX0hPTUUnXTtcblxuXHQvLyBUT0RPOiBVbmNoZWNrZWQgZmlzaCBiZWhhdmlvcjpcblx0Ly8gV2hhdCBpZiBYREdfREFUQV9IT01FIHdhcyBkZWZpbmVkIGJ1dCBzb21laG93ICRYREdfREFUQV9IT01FL2Zpc2gvZmlzaF9oaXN0b3J5XG5cdC8vIHdhcyBub3QgZXhpc3QuIERvZXMgZmlzaCBmYWxsIGJhY2sgdG8gfi8ubG9jYWwvc2hhcmUvZmlzaC9maXNoX2hpc3Rvcnk/XG5cblx0bGV0IGZvbGRlclByZWZpeDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRsZXQgZmlsZVBhdGg6IHN0cmluZztcblx0bGV0IHNvdXJjZUxhYmVsOiBzdHJpbmc7XG5cdGlmIChvdmVycmlkZW5EYXRhSG9tZSkge1xuXHRcdHNvdXJjZUxhYmVsID0gJyRYREdfREFUQV9IT01FL2Zpc2gvZmlzaF9oaXN0b3J5Jztcblx0XHRmb2xkZXJQcmVmaXggPSBlbnZbJ1hER19EQVRBX0hPTUUnXTtcblx0XHRmaWxlUGF0aCA9ICdmaXNoL2Zpc2hfaGlzdG9yeSc7XG5cdH0gZWxzZSB7XG5cdFx0c291cmNlTGFiZWwgPSAnfi8ubG9jYWwvc2hhcmUvZmlzaC9maXNoX2hpc3RvcnknO1xuXHRcdGZvbGRlclByZWZpeCA9IGVudlsnSE9NRSddO1xuXHRcdGZpbGVQYXRoID0gJy5sb2NhbC9zaGFyZS9maXNoL2Zpc2hfaGlzdG9yeSc7XG5cdH1cblx0Y29uc3QgcmVzb2x2ZWRGaWxlID0gYXdhaXQgZmV0Y2hGaWxlQ29udGVudHMoZm9sZGVyUHJlZml4LCBmaWxlUGF0aCwgZmFsc2UsIGZpbGVTZXJ2aWNlLCByZW1vdGVBZ2VudFNlcnZpY2UpO1xuXHRpZiAocmVzb2x2ZWRGaWxlID09PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0LyoqXG5cdCAqIFRoZXNlIGFwcGx5IHRvIGBmaXNoYCB2My41LjE6XG5cdCAqIC0gSXQgbG9va3MgbGlrZSBZQU1MIGJ1dCBpdCdzIG5vdC4gSXQncywgcXVvdGluZywgKlwiYSBicm9rZW4gcHN1ZWRvLVlBTUxcIiouXG5cdCAqICAgU2VlIHRoZXNlIGRpc2N1c3Npb25zIGZvciBtb3JlIGRldGFpbHM6XG5cdCAqICAgLSBodHRwczovL2dpdGh1Yi5jb20vZmlzaC1zaGVsbC9maXNoLXNoZWxsL3B1bGwvNjQ5M1xuXHQgKiAgIC0gaHR0cHM6Ly9naXRodWIuY29tL2Zpc2gtc2hlbGwvZmlzaC1zaGVsbC9pc3N1ZXMvMzM0MVxuXHQgKiAtIEV2ZXJ5IHJlY29yZCBzaG91bGQgZXhhY3RseSBzdGFydCB3aXRoIGAtIGNtZDpgICh0aGUgd2hpdGVzcGFjZSBiZXR3ZWVuIGAtYCBhbmQgYGNtZGAgY2Fubm90IGJlIHJlcGxhY2VkIHdpdGggdGFiKVxuXHQgKiAtIEJvdGggYC0gY21kOiBlY2hvIDFgIGFuZCBgLSBjbWQ6ZWNobyAxYCBhcmUgdmFsaWQgZW50cmllcy5cblx0ICogLSBCYWNrc2xhc2hlcyBhcmUgZXNhY3BlZCBhcyBgXFxcXGAuXG5cdCAqIC0gTXVsdGlsaW5lIGNvbW1hbmRzIGFyZSBqb2luZWQgd2l0aCBhIGBcXG5gIHNlcXVlbmNlLCBoZW5jZSB0aGV5J3JlIHJlYWQgYXMgc2luZ2xlIGxpbmUgY29tbWFuZHMuXG5cdCAqIC0gUHJvcGVydHkgYHdoZW5gIGlzIG9wdGlvbmFsLlxuXHQgKiAtIEhpc3RvcnkgbmF2aWdhdGlvbiByZXNwZWN0cyB0aGUgcmVjb3JkcyBvcmRlciBhbmQgaWdub3JlIHRoZSBhY3R1YWwgYHdoZW5gIHByb3BlcnR5IHZhbHVlcyAoY2hyb25vbG9naWNhbCBvcmRlcikuXG5cdCAqIC0gSWYgYGNtZGAgdmFsdWUgaXMgbXVsdGlsaW5lICwgaXQganVzdCB0YWtlcyB0aGUgZmlyc3QgbGluZS4gQWxzbyBZQU1MIG9wZXJhdG9ycyBsaWtlIGA+LWAgb3IgYHwtYCBhcmUgbm90IHN1cHBvcnRlZC5cblx0ICovXG5cdGNvbnN0IHJlc3VsdDogU2V0PHN0cmluZz4gPSBuZXcgU2V0KCk7XG5cdGNvbnN0IGNtZHMgPSByZXNvbHZlZEZpbGUuY29udGVudC5zcGxpdCgnXFxuJylcblx0XHQuZmlsdGVyKHggPT4geC5zdGFydHNXaXRoKCctIGNtZDonKSlcblx0XHQubWFwKHggPT4geC5zdWJzdHJpbmcoNikudHJpbVN0YXJ0KCkpO1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IGNtZHMubGVuZ3RoOyBpKyspIHtcblx0XHRjb25zdCBzYW5pdGl6ZWQgPSBzYW5pdGl6ZUZpc2hIaXN0b3J5Q21kKGNtZHNbaV0pLnRyaW0oKTtcblx0XHRpZiAoc2FuaXRpemVkLmxlbmd0aCA+IDApIHtcblx0XHRcdHJlc3VsdC5hZGQoc2FuaXRpemVkKTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIHtcblx0XHRzb3VyY2VMYWJlbCxcblx0XHRzb3VyY2VSZXNvdXJjZTogcmVzb2x2ZWRGaWxlLnJlc291cmNlLFxuXHRcdGNvbW1hbmRzOiBBcnJheS5mcm9tKHJlc3VsdC52YWx1ZXMoKSlcblx0fTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNhbml0aXplRmlzaEhpc3RvcnlDbWQoY21kOiBzdHJpbmcpOiBzdHJpbmcge1xuXHQvKipcblx0ICogTk9URVxuXHQgKiBUaGlzIHJlcGVhdGVkUmVwbGFjZSgpIGNhbGwgY2FuIGJlIGVsaW1pbmF0ZWQgYnkgdXNpbmcgbG9vay1haGVhZFxuXHQgKiBjYWx1c2VzIGluIHRoZSBvcmlnaW5hbCBSZWdFeHAgcGF0dGVybjpcblx0ICpcblx0ICogPj4+IGBgYHRzXG5cdCAqID4+PiBjbWRzW2ldLnJlcGxhY2UoLyg/PD1efFteXFxcXF0pKCg/OlxcXFxcXFxcKSopKFxcXFxuKS9nLCAnJDFcXG4nKVxuXHQgKiA+Pj4gYGBgXG5cdCAqXG5cdCAqIEJ1dCBzaW5jZSBub3QgYWxsIGJyb3dzZXJzIHN1cHBvcnQgbG9vayBhaGVhZHMgd2Ugb3B0ZWQgdG8gYSBzaW1wbGVcblx0ICogcGF0dGVybiBhbmQgcmVwZWF0ZWRseSBjYWxsaW5nIHJlcGxhY2UgbWV0aG9kLlxuXHQgKi9cblx0cmV0dXJuIHJlcGVhdGVkUmVwbGFjZSgvKF58W15cXFxcXSkoKD86XFxcXFxcXFwpKikoXFxcXG4pL2csIGNtZCwgJyQxJDJcXG4nKTtcbn1cblxuZnVuY3Rpb24gcmVwZWF0ZWRSZXBsYWNlKHBhdHRlcm46IFJlZ0V4cCwgdmFsdWU6IHN0cmluZywgcmVwbGFjZVZhbHVlOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRsZXQgbGFzdDtcblx0bGV0IGN1cnJlbnQgPSB2YWx1ZTtcblx0d2hpbGUgKHRydWUpIHtcblx0XHRsYXN0ID0gY3VycmVudDtcblx0XHRjdXJyZW50ID0gY3VycmVudC5yZXBsYWNlKHBhdHRlcm4sIHJlcGxhY2VWYWx1ZSk7XG5cdFx0aWYgKGN1cnJlbnQgPT09IGxhc3QpIHtcblx0XHRcdHJldHVybiBjdXJyZW50O1xuXHRcdH1cblx0fVxufVxuXG5hc3luYyBmdW5jdGlvbiBmZXRjaEZpbGVDb250ZW50cyhcblx0Zm9sZGVyUHJlZml4OiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdGZpbGVQYXRoOiBzdHJpbmcsXG5cdGlzRmlsZVdpbmRvd3M6IGJvb2xlYW4sXG5cdGZpbGVTZXJ2aWNlOiBQaWNrPElGaWxlU2VydmljZSwgJ3JlYWRGaWxlJz4sXG5cdHJlbW90ZUFnZW50U2VydmljZTogUGljazxJUmVtb3RlQWdlbnRTZXJ2aWNlLCAnZ2V0Q29ubmVjdGlvbic+LFxuKTogUHJvbWlzZTx7IHJlc291cmNlOiBVUkk7IGNvbnRlbnQ6IHN0cmluZyB9IHwgdW5kZWZpbmVkPiB7XG5cdGlmICghZm9sZGVyUHJlZml4KSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXHRjb25zdCBjb25uZWN0aW9uID0gcmVtb3RlQWdlbnRTZXJ2aWNlLmdldENvbm5lY3Rpb24oKTtcblx0Y29uc3QgaXNSZW1vdGUgPSAhIWNvbm5lY3Rpb24/LnJlbW90ZUF1dGhvcml0eTtcblx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZnJvbSh7XG5cdFx0c2NoZW1lOiBpc1JlbW90ZSA/IFNjaGVtYXMudnNjb2RlUmVtb3RlIDogU2NoZW1hcy5maWxlLFxuXHRcdGF1dGhvcml0eTogaXNSZW1vdGUgPyBjb25uZWN0aW9uLnJlbW90ZUF1dGhvcml0eSA6IHVuZGVmaW5lZCxcblx0XHRwYXRoOiBVUkkuZmlsZShqb2luKGZvbGRlclByZWZpeCwgZmlsZVBhdGgpKS5wYXRoXG5cdH0pO1xuXHRsZXQgY29udGVudDogSUZpbGVDb250ZW50O1xuXHR0cnkge1xuXHRcdGNvbnRlbnQgPSBhd2FpdCBmaWxlU2VydmljZS5yZWFkRmlsZShyZXNvdXJjZSk7XG5cdH0gY2F0Y2ggKGU6IHVua25vd24pIHtcblx0XHQvLyBIYW5kbGUgZmlsZSBub3QgZm91bmQgb25seVxuXHRcdGlmIChlIGluc3RhbmNlb2YgRmlsZU9wZXJhdGlvbkVycm9yICYmIGUuZmlsZU9wZXJhdGlvblJlc3VsdCA9PT0gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9GT1VORCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0dGhyb3cgZTtcblx0fVxuXHRpZiAoY29udGVudCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXHRyZXR1cm4ge1xuXHRcdHJlc291cmNlLFxuXHRcdGNvbnRlbnQ6IGNvbnRlbnQudmFsdWUudG9TdHJpbmcoKVxuXHR9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsV0FBVyx1QkFBdUI7QUFDM0MsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsV0FBVztBQUNwQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLG9CQUFvQixxQkFBbUMsb0JBQW9CO0FBQ3BGLFNBQVMsNkJBQStDO0FBQ3hELFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FB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QVcsQ0FBQyxDQUFDLFlBQVk7QUFDL0IsUUFBTSxXQUFXLElBQUksS0FBSztBQUFBLElBQ3pCLFFBQVEsV0FBVyxRQUFRLGVBQWUsUUFBUTtBQUFBLElBQ2xELFdBQVcsV0FBVyxXQUFXLGtCQUFrQjtBQUFBLElBQ25ELE1BQU0sSUFBSSxLQUFLLEtBQUssY0FBYyxRQUFRLENBQUMsRUFBRTtBQUFBLEVBQzlDLENBQUM7QUFDRCxNQUFJO0FBQ0osTUFBSTtBQUNILGNBQVUsTUFBTSxZQUFZLFNBQVMsUUFBUTtBQUFBLEVBQzlDLFNBQVMsR0FBWTtBQUVwQixRQUFJLGFBQWEsc0JBQXNCLEVBQUUsd0JBQXdCLG9CQUFvQixnQkFBZ0I7QUFDcEcsYUFBTztBQUFBLElBQ1I7QUFDQSxVQUFNO0FBQUEsRUFDUDtBQUNBLE1BQUksWUFBWSxRQUFXO0FBQzFCLFdBQU87QUFBQSxFQUNSO0FBQ0EsU0FBTztBQUFBLElBQ047QUFBQSxJQUNBLFNBQVMsUUFBUSxNQUFNLFNBQVM7QUFBQSxFQUNqQztBQUNEOyIsCiAgIm5hbWVzIjogWyJDb25zdGFudHMiLCAiU3RvcmFnZUtleXMiXQp9Cg==
