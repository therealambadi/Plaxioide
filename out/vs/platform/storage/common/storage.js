import { Promises, RunOnceScheduler, runWhenGlobalIdle } from "../../../base/common/async.js";
import { Emitter, Event, PauseableEmitter } from "../../../base/common/event.js";
import { Disposable, dispose, MutableDisposable } from "../../../base/common/lifecycle.js";
import { mark } from "../../../base/common/performance.js";
import { isUndefinedOrNull } from "../../../base/common/types.js";
import { InMemoryStorageDatabase, Storage, StorageHint } from "../../../base/parts/storage/common/storage.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { isUserDataProfile } from "../../userDataProfile/common/userDataProfile.js";
const IS_NEW_KEY = "__$__isNewStorageMarker";
const TARGET_KEY = "__$__targetStorageMarker";
const IStorageService = createDecorator("storageService");
var WillSaveStateReason = /* @__PURE__ */ ((WillSaveStateReason2) => {
  WillSaveStateReason2[WillSaveStateReason2["NONE"] = 0] = "NONE";
  WillSaveStateReason2[WillSaveStateReason2["SHUTDOWN"] = 1] = "SHUTDOWN";
  return WillSaveStateReason2;
})(WillSaveStateReason || {});
var StorageScope = /* @__PURE__ */ ((StorageScope2) => {
  StorageScope2[StorageScope2["APPLICATION"] = -1] = "APPLICATION";
  StorageScope2[StorageScope2["PROFILE"] = 0] = "PROFILE";
  StorageScope2[StorageScope2["WORKSPACE"] = 1] = "WORKSPACE";
  return StorageScope2;
})(StorageScope || {});
var StorageTarget = /* @__PURE__ */ ((StorageTarget2) => {
  StorageTarget2[StorageTarget2["USER"] = 0] = "USER";
  StorageTarget2[StorageTarget2["MACHINE"] = 1] = "MACHINE";
  return StorageTarget2;
})(StorageTarget || {});
function loadKeyTargets(storage) {
  const keysRaw = storage.get(TARGET_KEY);
  if (keysRaw) {
    try {
      return JSON.parse(keysRaw);
    } catch (error) {
    }
  }
  return /* @__PURE__ */ Object.create(null);
}
const _AbstractStorageService = class _AbstractStorageService extends Disposable {
  constructor(options = { flushInterval: _AbstractStorageService.DEFAULT_FLUSH_INTERVAL }) {
    super();
    // every minute
    this._onDidChangeValue = this._register(new PauseableEmitter());
    this._onDidChangeTarget = this._register(new PauseableEmitter());
    this.onDidChangeTarget = this._onDidChangeTarget.event;
    this._onWillSaveState = this._register(new Emitter());
    this.onWillSaveState = this._onWillSaveState.event;
    this.runFlushWhenIdle = this._register(new MutableDisposable());
    this._workspaceKeyTargets = void 0;
    this._profileKeyTargets = void 0;
    this._applicationKeyTargets = void 0;
    this.flushWhenIdleScheduler = this._register(new RunOnceScheduler(() => this.doFlushWhenIdle(), options.flushInterval));
  }
  onDidChangeValue(scope, key, disposable) {
    return Event.filter(this._onDidChangeValue.event, (e) => e.scope === scope && (key === void 0 || e.key === key), disposable);
  }
  doFlushWhenIdle() {
    this.runFlushWhenIdle.value = runWhenGlobalIdle(() => {
      if (this.shouldFlushWhenIdle()) {
        this.flush();
      }
      this.flushWhenIdleScheduler.schedule();
    });
  }
  shouldFlushWhenIdle() {
    return true;
  }
  stopFlushWhenIdle() {
    dispose([this.runFlushWhenIdle, this.flushWhenIdleScheduler]);
  }
  initialize() {
    if (!this.initializationPromise) {
      this.initializationPromise = (async () => {
        mark("code/willInitStorage");
        try {
          await this.doInitialize();
        } finally {
          mark("code/didInitStorage");
        }
        this.flushWhenIdleScheduler.schedule();
      })();
    }
    return this.initializationPromise;
  }
  emitDidChangeValue(scope, event) {
    const { key, external } = event;
    if (key === TARGET_KEY) {
      switch (scope) {
        case -1 /* APPLICATION */:
          this._applicationKeyTargets = void 0;
          break;
        case 0 /* PROFILE */:
          this._profileKeyTargets = void 0;
          break;
        case 1 /* WORKSPACE */:
          this._workspaceKeyTargets = void 0;
          break;
      }
      this._onDidChangeTarget.fire({ scope });
    } else {
      this._onDidChangeValue.fire({ scope, key, target: this.getKeyTargets(scope)[key], external });
    }
  }
  emitWillSaveState(reason) {
    this._onWillSaveState.fire({ reason });
  }
  get(key, scope, fallbackValue) {
    return this.getStorage(scope)?.get(key, fallbackValue);
  }
  getBoolean(key, scope, fallbackValue) {
    return this.getStorage(scope)?.getBoolean(key, fallbackValue);
  }
  getNumber(key, scope, fallbackValue) {
    return this.getStorage(scope)?.getNumber(key, fallbackValue);
  }
  getObject(key, scope, fallbackValue) {
    return this.getStorage(scope)?.getObject(key, fallbackValue);
  }
  storeAll(entries, external) {
    this.withPausedEmitters(() => {
      for (const entry of entries) {
        this.store(entry.key, entry.value, entry.scope, entry.target, external);
      }
    });
  }
  store(key, value, scope, target, external = false) {
    if (isUndefinedOrNull(value)) {
      this.remove(key, scope, external);
      return;
    }
    this.withPausedEmitters(() => {
      this.updateKeyTarget(key, scope, target);
      this.getStorage(scope)?.set(key, value, external);
    });
  }
  remove(key, scope, external = false) {
    this.withPausedEmitters(() => {
      this.updateKeyTarget(key, scope, void 0);
      this.getStorage(scope)?.delete(key, external);
    });
  }
  withPausedEmitters(fn) {
    this._onDidChangeValue.pause();
    this._onDidChangeTarget.pause();
    try {
      fn();
    } finally {
      this._onDidChangeValue.resume();
      this._onDidChangeTarget.resume();
    }
  }
  keys(scope, target) {
    const keys = [];
    const keyTargets = this.getKeyTargets(scope);
    for (const key of Object.keys(keyTargets)) {
      const keyTarget = keyTargets[key];
      if (keyTarget === target) {
        keys.push(key);
      }
    }
    return keys;
  }
  updateKeyTarget(key, scope, target, external = false) {
    const keyTargets = this.getKeyTargets(scope);
    if (typeof target === "number") {
      if (keyTargets[key] !== target) {
        keyTargets[key] = target;
        this.getStorage(scope)?.set(TARGET_KEY, JSON.stringify(keyTargets), external);
      }
    } else {
      if (typeof keyTargets[key] === "number") {
        delete keyTargets[key];
        this.getStorage(scope)?.set(TARGET_KEY, JSON.stringify(keyTargets), external);
      }
    }
  }
  get workspaceKeyTargets() {
    if (!this._workspaceKeyTargets) {
      this._workspaceKeyTargets = this.loadKeyTargets(1 /* WORKSPACE */);
    }
    return this._workspaceKeyTargets;
  }
  get profileKeyTargets() {
    if (!this._profileKeyTargets) {
      this._profileKeyTargets = this.loadKeyTargets(0 /* PROFILE */);
    }
    return this._profileKeyTargets;
  }
  get applicationKeyTargets() {
    if (!this._applicationKeyTargets) {
      this._applicationKeyTargets = this.loadKeyTargets(-1 /* APPLICATION */);
    }
    return this._applicationKeyTargets;
  }
  getKeyTargets(scope) {
    switch (scope) {
      case -1 /* APPLICATION */:
        return this.applicationKeyTargets;
      case 0 /* PROFILE */:
        return this.profileKeyTargets;
      default:
        return this.workspaceKeyTargets;
    }
  }
  loadKeyTargets(scope) {
    const storage = this.getStorage(scope);
    return storage ? loadKeyTargets(storage) : /* @__PURE__ */ Object.create(null);
  }
  isNew(scope) {
    return this.getBoolean(IS_NEW_KEY, scope) === true;
  }
  async flush(reason = 0 /* NONE */) {
    this._onWillSaveState.fire({ reason });
    const applicationStorage = this.getStorage(-1 /* APPLICATION */);
    const profileStorage = this.getStorage(0 /* PROFILE */);
    const workspaceStorage = this.getStorage(1 /* WORKSPACE */);
    switch (reason) {
      // Unspecific reason: just wait when data is flushed
      case 0 /* NONE */:
        await Promises.settled([
          applicationStorage?.whenFlushed() ?? Promise.resolve(),
          profileStorage?.whenFlushed() ?? Promise.resolve(),
          workspaceStorage?.whenFlushed() ?? Promise.resolve()
        ]);
        break;
      // Shutdown: we want to flush as soon as possible
      // and not hit any delays that might be there
      case 1 /* SHUTDOWN */:
        await Promises.settled([
          applicationStorage?.flush(0) ?? Promise.resolve(),
          profileStorage?.flush(0) ?? Promise.resolve(),
          workspaceStorage?.flush(0) ?? Promise.resolve()
        ]);
        break;
    }
  }
  async log() {
    const applicationItems = this.getStorage(-1 /* APPLICATION */)?.items ?? /* @__PURE__ */ new Map();
    const profileItems = this.getStorage(0 /* PROFILE */)?.items ?? /* @__PURE__ */ new Map();
    const workspaceItems = this.getStorage(1 /* WORKSPACE */)?.items ?? /* @__PURE__ */ new Map();
    return logStorage(
      applicationItems,
      profileItems,
      workspaceItems,
      this.getLogDetails(-1 /* APPLICATION */) ?? "",
      this.getLogDetails(0 /* PROFILE */) ?? "",
      this.getLogDetails(1 /* WORKSPACE */) ?? ""
    );
  }
  async optimize(scope) {
    await this.flush();
    return this.getStorage(scope)?.optimize();
  }
  async switch(to, preserveData) {
    this.emitWillSaveState(0 /* NONE */);
    if (isUserDataProfile(to)) {
      return this.switchToProfile(to, preserveData);
    }
    return this.switchToWorkspace(to, preserveData);
  }
  canSwitchProfile(from, to) {
    if (from.id === to.id) {
      return false;
    }
    if (isProfileUsingDefaultStorage(to) && isProfileUsingDefaultStorage(from)) {
      return false;
    }
    return true;
  }
  switchData(oldStorage, newStorage, scope) {
    this.withPausedEmitters(() => {
      const handledkeys = /* @__PURE__ */ new Set();
      for (const [key, oldValue] of oldStorage) {
        handledkeys.add(key);
        const newValue = newStorage.get(key);
        if (newValue !== oldValue) {
          this.emitDidChangeValue(scope, { key, external: true });
        }
      }
      for (const [key] of newStorage.items) {
        if (!handledkeys.has(key)) {
          this.emitDidChangeValue(scope, { key, external: true });
        }
      }
    });
  }
};
_AbstractStorageService.DEFAULT_FLUSH_INTERVAL = 60 * 1e3;
let AbstractStorageService = _AbstractStorageService;
function isProfileUsingDefaultStorage(profile) {
  return profile.isDefault || !!profile.useDefaultFlags?.globalState;
}
class InMemoryStorageService extends AbstractStorageService {
  constructor() {
    super();
    this.applicationStorage = this._register(new Storage(new InMemoryStorageDatabase(), { hint: StorageHint.STORAGE_IN_MEMORY }));
    this.profileStorage = this._register(new Storage(new InMemoryStorageDatabase(), { hint: StorageHint.STORAGE_IN_MEMORY }));
    this.workspaceStorage = this._register(new Storage(new InMemoryStorageDatabase(), { hint: StorageHint.STORAGE_IN_MEMORY }));
    this._register(this.workspaceStorage.onDidChangeStorage((e) => this.emitDidChangeValue(1 /* WORKSPACE */, e)));
    this._register(this.profileStorage.onDidChangeStorage((e) => this.emitDidChangeValue(0 /* PROFILE */, e)));
    this._register(this.applicationStorage.onDidChangeStorage((e) => this.emitDidChangeValue(-1 /* APPLICATION */, e)));
  }
  getStorage(scope) {
    switch (scope) {
      case -1 /* APPLICATION */:
        return this.applicationStorage;
      case 0 /* PROFILE */:
        return this.profileStorage;
      default:
        return this.workspaceStorage;
    }
  }
  getLogDetails(scope) {
    switch (scope) {
      case -1 /* APPLICATION */:
        return "inMemory (application)";
      case 0 /* PROFILE */:
        return "inMemory (profile)";
      default:
        return "inMemory (workspace)";
    }
  }
  async doInitialize() {
  }
  async switchToProfile() {
  }
  async switchToWorkspace() {
  }
  shouldFlushWhenIdle() {
    return false;
  }
  hasScope(scope) {
    return false;
  }
}
async function logStorage(application, profile, workspace, applicationPath, profilePath, workspacePath) {
  const safeParse = (value) => {
    try {
      return JSON.parse(value);
    } catch (error) {
      return value;
    }
  };
  const applicationItems = /* @__PURE__ */ new Map();
  const applicationItemsParsed = /* @__PURE__ */ new Map();
  application.forEach((value, key) => {
    applicationItems.set(key, value);
    applicationItemsParsed.set(key, safeParse(value));
  });
  const profileItems = /* @__PURE__ */ new Map();
  const profileItemsParsed = /* @__PURE__ */ new Map();
  profile.forEach((value, key) => {
    profileItems.set(key, value);
    profileItemsParsed.set(key, safeParse(value));
  });
  const workspaceItems = /* @__PURE__ */ new Map();
  const workspaceItemsParsed = /* @__PURE__ */ new Map();
  workspace.forEach((value, key) => {
    workspaceItems.set(key, value);
    workspaceItemsParsed.set(key, safeParse(value));
  });
  if (applicationPath !== profilePath) {
    console.group(`Storage: Application (path: ${applicationPath})`);
  } else {
    console.group(`Storage: Application & Profile (path: ${applicationPath}, default profile)`);
  }
  const applicationValues = [];
  applicationItems.forEach((value, key) => {
    applicationValues.push({ key, value });
  });
  console.table(applicationValues);
  console.groupEnd();
  console.log(applicationItemsParsed);
  if (applicationPath !== profilePath) {
    console.group(`Storage: Profile (path: ${profilePath}, profile specific)`);
    const profileValues = [];
    profileItems.forEach((value, key) => {
      profileValues.push({ key, value });
    });
    console.table(profileValues);
    console.groupEnd();
    console.log(profileItemsParsed);
  }
  console.group(`Storage: Workspace (path: ${workspacePath})`);
  const workspaceValues = [];
  workspaceItems.forEach((value, key) => {
    workspaceValues.push({ key, value });
  });
  console.table(workspaceValues);
  console.groupEnd();
  console.log(workspaceItemsParsed);
}
export {
  AbstractStorageService,
  IS_NEW_KEY,
  IStorageService,
  InMemoryStorageService,
  StorageScope,
  StorageTarget,
  TARGET_KEY,
  WillSaveStateReason,
  isProfileUsingDefaultStorage,
  loadKeyTargets,
  logStorage
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgUHJvbWlzZXMsIFJ1bk9uY2VTY2hlZHVsZXIsIHJ1bldoZW5HbG9iYWxJZGxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQsIFBhdXNlYWJsZUVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IG1hcmsgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wZXJmb3JtYW5jZS5qcyc7XG5pbXBvcnQgeyBpc1VuZGVmaW5lZE9yTnVsbCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IEluTWVtb3J5U3RvcmFnZURhdGFiYXNlLCBJU3RvcmFnZSwgSVN0b3JhZ2VDaGFuZ2VFdmVudCwgU3RvcmFnZSwgU3RvcmFnZUhpbnQsIFN0b3JhZ2VWYWx1ZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvcGFydHMvc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IGlzVXNlckRhdGFQcm9maWxlLCBJVXNlckRhdGFQcm9maWxlIH0gZnJvbSAnLi4vLi4vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSUFueVdvcmtzcGFjZUlkZW50aWZpZXIgfSBmcm9tICcuLi8uLi93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5cbmV4cG9ydCBjb25zdCBJU19ORVdfS0VZID0gJ19fJF9faXNOZXdTdG9yYWdlTWFya2VyJztcbmV4cG9ydCBjb25zdCBUQVJHRVRfS0VZID0gJ19fJF9fdGFyZ2V0U3RvcmFnZU1hcmtlcic7XG5cbmV4cG9ydCBjb25zdCBJU3RvcmFnZVNlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SVN0b3JhZ2VTZXJ2aWNlPignc3RvcmFnZVNlcnZpY2UnKTtcblxuZXhwb3J0IGVudW0gV2lsbFNhdmVTdGF0ZVJlYXNvbiB7XG5cblx0LyoqXG5cdCAqIE5vIHNwZWNpZmljIHJlYXNvbiB0byBzYXZlIHN0YXRlLlxuXHQgKi9cblx0Tk9ORSxcblxuXHQvKipcblx0ICogQSBoaW50IHRoYXQgdGhlIHdvcmtiZW5jaCBpcyBhYm91dCB0byBzaHV0ZG93bi5cblx0ICovXG5cdFNIVVRET1dOXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVdpbGxTYXZlU3RhdGVFdmVudCB7XG5cdHJlYWRvbmx5IHJlYXNvbjogV2lsbFNhdmVTdGF0ZVJlYXNvbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU3RvcmFnZUVudHJ5IHtcblx0cmVhZG9ubHkga2V5OiBzdHJpbmc7XG5cdHJlYWRvbmx5IHZhbHVlOiBTdG9yYWdlVmFsdWU7XG5cdHJlYWRvbmx5IHNjb3BlOiBTdG9yYWdlU2NvcGU7XG5cdHJlYWRvbmx5IHRhcmdldDogU3RvcmFnZVRhcmdldDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJV29ya3NwYWNlU3RvcmFnZVZhbHVlQ2hhbmdlRXZlbnQgZXh0ZW5kcyBJU3RvcmFnZVZhbHVlQ2hhbmdlRXZlbnQge1xuXHRyZWFkb25seSBzY29wZTogU3RvcmFnZVNjb3BlLldPUktTUEFDRTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUHJvZmlsZVN0b3JhZ2VWYWx1ZUNoYW5nZUV2ZW50IGV4dGVuZHMgSVN0b3JhZ2VWYWx1ZUNoYW5nZUV2ZW50IHtcblx0cmVhZG9ubHkgc2NvcGU6IFN0b3JhZ2VTY29wZS5QUk9GSUxFO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElBcHBsaWNhdGlvblN0b3JhZ2VWYWx1ZUNoYW5nZUV2ZW50IGV4dGVuZHMgSVN0b3JhZ2VWYWx1ZUNoYW5nZUV2ZW50IHtcblx0cmVhZG9ubHkgc2NvcGU6IFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU3RvcmFnZVNlcnZpY2Uge1xuXG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHQvKipcblx0ICogRW1pdHRlZCB3aGVuZXZlciBkYXRhIGlzIHVwZGF0ZWQgb3IgZGVsZXRlZCBvbiB0aGUgZ2l2ZW5cblx0ICogc2NvcGUgYW5kIG9wdGlvbmFsIGtleS5cblx0ICpcblx0ICogQHBhcmFtIHNjb3BlIHRoZSBgU3RvcmFnZVNjb3BlYCB0byBsaXN0ZW4gdG8gY2hhbmdlc1xuXHQgKiBAcGFyYW0ga2V5IHRoZSBvcHRpb25hbCBrZXkgdG8gZmlsdGVyIGZvciBvciBhbGwga2V5cyBvZlxuXHQgKiB0aGUgc2NvcGUgaWYgYHVuZGVmaW5lZGBcblx0ICovXG5cdG9uRGlkQ2hhbmdlVmFsdWUoc2NvcGU6IFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIGtleTogc3RyaW5nIHwgdW5kZWZpbmVkLCBkaXNwb3NhYmxlOiBEaXNwb3NhYmxlU3RvcmUpOiBFdmVudDxJV29ya3NwYWNlU3RvcmFnZVZhbHVlQ2hhbmdlRXZlbnQ+O1xuXHRvbkRpZENoYW5nZVZhbHVlKHNjb3BlOiBTdG9yYWdlU2NvcGUuUFJPRklMRSwga2V5OiBzdHJpbmcgfCB1bmRlZmluZWQsIGRpc3Bvc2FibGU6IERpc3Bvc2FibGVTdG9yZSk6IEV2ZW50PElQcm9maWxlU3RvcmFnZVZhbHVlQ2hhbmdlRXZlbnQ+O1xuXHRvbkRpZENoYW5nZVZhbHVlKHNjb3BlOiBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIGtleTogc3RyaW5nIHwgdW5kZWZpbmVkLCBkaXNwb3NhYmxlOiBEaXNwb3NhYmxlU3RvcmUpOiBFdmVudDxJQXBwbGljYXRpb25TdG9yYWdlVmFsdWVDaGFuZ2VFdmVudD47XG5cdG9uRGlkQ2hhbmdlVmFsdWUoc2NvcGU6IFN0b3JhZ2VTY29wZSwga2V5OiBzdHJpbmcgfCB1bmRlZmluZWQsIGRpc3Bvc2FibGU6IERpc3Bvc2FibGVTdG9yZSk6IEV2ZW50PElTdG9yYWdlVmFsdWVDaGFuZ2VFdmVudD47XG5cblx0LyoqXG5cdCAqIEVtaXR0ZWQgd2hlbmV2ZXIgdGFyZ2V0IG9mIGEgc3RvcmFnZSBlbnRyeSBjaGFuZ2VzLlxuXHQgKi9cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VUYXJnZXQ6IEV2ZW50PElTdG9yYWdlVGFyZ2V0Q2hhbmdlRXZlbnQ+O1xuXG5cdC8qKlxuXHQgKiBFbWl0dGVkIHdoZW4gdGhlIHN0b3JhZ2UgaXMgYWJvdXQgdG8gcGVyc2lzdC4gVGhpcyBpcyB0aGUgcmlnaHQgdGltZVxuXHQgKiB0byBwZXJzaXN0IGRhdGEgdG8gZW5zdXJlIGl0IGlzIHN0b3JlZCBiZWZvcmUgdGhlIGFwcGxpY2F0aW9uIHNodXRzXG5cdCAqIGRvd24uXG5cdCAqXG5cdCAqIFRoZSB3aWxsIHNhdmUgc3RhdGUgZXZlbnQgYWxsb3dzIHRvIG9wdGlvbmFsbHkgYXNrIGZvciB0aGUgcmVhc29uIG9mXG5cdCAqIHNhdmluZyB0aGUgc3RhdGUsIGUuZy4gdG8gZmluZCBvdXQgaWYgdGhlIHN0YXRlIGlzIHNhdmVkIGR1ZSB0byBhXG5cdCAqIHNodXRkb3duLlxuXHQgKlxuXHQgKiBOb3RlOiB0aGlzIGV2ZW50IG1heSBiZSBmaXJlZCBtYW55IHRpbWVzLCBub3Qgb25seSBvbiBzaHV0ZG93biB0byBwcmV2ZW50XG5cdCAqIGxvc3Mgb2Ygc3RhdGUgaW4gc2l0dWF0aW9ucyB3aGVyZSB0aGUgc2h1dGRvd24gaXMgbm90IHN1ZmZpY2llbnQgdG9cblx0ICogcGVyc2lzdCB0aGUgZGF0YSBwcm9wZXJseS5cblx0ICovXG5cdHJlYWRvbmx5IG9uV2lsbFNhdmVTdGF0ZTogRXZlbnQ8SVdpbGxTYXZlU3RhdGVFdmVudD47XG5cblx0LyoqXG5cdCAqIFJldHJpZXZlIGFuIGVsZW1lbnQgc3RvcmVkIHdpdGggdGhlIGdpdmVuIGtleSBmcm9tIHN0b3JhZ2UuIFVzZVxuXHQgKiB0aGUgcHJvdmlkZWQgYGRlZmF1bHRWYWx1ZWAgaWYgdGhlIGVsZW1lbnQgaXMgYG51bGxgIG9yIGB1bmRlZmluZWRgLlxuXHQgKlxuXHQgKiBAcGFyYW0gc2NvcGUgYWxsb3dzIHRvIGRlZmluZSB0aGUgc2NvcGUgb2YgdGhlIHN0b3JhZ2Ugb3BlcmF0aW9uXG5cdCAqIHRvIGVpdGhlciB0aGUgY3VycmVudCB3b3Jrc3BhY2Ugb25seSwgYWxsIHdvcmtzcGFjZXMgb3IgYWxsIHByb2ZpbGVzLlxuXHQgKi9cblx0Z2V0KGtleTogc3RyaW5nLCBzY29wZTogU3RvcmFnZVNjb3BlLCBmYWxsYmFja1ZhbHVlOiBzdHJpbmcpOiBzdHJpbmc7XG5cdGdldChrZXk6IHN0cmluZywgc2NvcGU6IFN0b3JhZ2VTY29wZSwgZmFsbGJhY2tWYWx1ZT86IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHQvKipcblx0ICogUmV0cmlldmUgYW4gZWxlbWVudCBzdG9yZWQgd2l0aCB0aGUgZ2l2ZW4ga2V5IGZyb20gc3RvcmFnZS4gVXNlXG5cdCAqIHRoZSBwcm92aWRlZCBgZGVmYXVsdFZhbHVlYCBpZiB0aGUgZWxlbWVudCBpcyBgbnVsbGAgb3IgYHVuZGVmaW5lZGAuXG5cdCAqIFRoZSBlbGVtZW50IHdpbGwgYmUgY29udmVydGVkIHRvIGEgYGJvb2xlYW5gLlxuXHQgKlxuXHQgKiBAcGFyYW0gc2NvcGUgYWxsb3dzIHRvIGRlZmluZSB0aGUgc2NvcGUgb2YgdGhlIHN0b3JhZ2Ugb3BlcmF0aW9uXG5cdCAqIHRvIGVpdGhlciB0aGUgY3VycmVudCB3b3Jrc3BhY2Ugb25seSwgYWxsIHdvcmtzcGFjZXMgb3IgYWxsIHByb2ZpbGVzLlxuXHQgKi9cblx0Z2V0Qm9vbGVhbihrZXk6IHN0cmluZywgc2NvcGU6IFN0b3JhZ2VTY29wZSwgZmFsbGJhY2tWYWx1ZTogYm9vbGVhbik6IGJvb2xlYW47XG5cdGdldEJvb2xlYW4oa2V5OiBzdHJpbmcsIHNjb3BlOiBTdG9yYWdlU2NvcGUsIGZhbGxiYWNrVmFsdWU/OiBib29sZWFuKTogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblxuXHQvKipcblx0ICogUmV0cmlldmUgYW4gZWxlbWVudCBzdG9yZWQgd2l0aCB0aGUgZ2l2ZW4ga2V5IGZyb20gc3RvcmFnZS4gVXNlXG5cdCAqIHRoZSBwcm92aWRlZCBgZGVmYXVsdFZhbHVlYCBpZiB0aGUgZWxlbWVudCBpcyBgbnVsbGAgb3IgYHVuZGVmaW5lZGAuXG5cdCAqIFRoZSBlbGVtZW50IHdpbGwgYmUgY29udmVydGVkIHRvIGEgYG51bWJlcmAgdXNpbmcgYHBhcnNlSW50YCB3aXRoIGFcblx0ICogYmFzZSBvZiBgMTBgLlxuXHQgKlxuXHQgKiBAcGFyYW0gc2NvcGUgYWxsb3dzIHRvIGRlZmluZSB0aGUgc2NvcGUgb2YgdGhlIHN0b3JhZ2Ugb3BlcmF0aW9uXG5cdCAqIHRvIGVpdGhlciB0aGUgY3VycmVudCB3b3Jrc3BhY2Ugb25seSwgYWxsIHdvcmtzcGFjZXMgb3IgYWxsIHByb2ZpbGVzLlxuXHQgKi9cblx0Z2V0TnVtYmVyKGtleTogc3RyaW5nLCBzY29wZTogU3RvcmFnZVNjb3BlLCBmYWxsYmFja1ZhbHVlOiBudW1iZXIpOiBudW1iZXI7XG5cdGdldE51bWJlcihrZXk6IHN0cmluZywgc2NvcGU6IFN0b3JhZ2VTY29wZSwgZmFsbGJhY2tWYWx1ZT86IG51bWJlcik6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHQvKipcblx0ICogUmV0cmlldmUgYW4gZWxlbWVudCBzdG9yZWQgd2l0aCB0aGUgZ2l2ZW4ga2V5IGZyb20gc3RvcmFnZS4gVXNlXG5cdCAqIHRoZSBwcm92aWRlZCBgZGVmYXVsdFZhbHVlYCBpZiB0aGUgZWxlbWVudCBpcyBgbnVsbGAgb3IgYHVuZGVmaW5lZGAuXG5cdCAqIFRoZSBlbGVtZW50IHdpbGwgYmUgY29udmVydGVkIHRvIGEgYG9iamVjdGAgdXNpbmcgYEpTT04ucGFyc2VgLlxuXHQgKlxuXHQgKiBAcGFyYW0gc2NvcGUgYWxsb3dzIHRvIGRlZmluZSB0aGUgc2NvcGUgb2YgdGhlIHN0b3JhZ2Ugb3BlcmF0aW9uXG5cdCAqIHRvIGVpdGhlciB0aGUgY3VycmVudCB3b3Jrc3BhY2Ugb25seSwgYWxsIHdvcmtzcGFjZXMgb3IgYWxsIHByb2ZpbGVzLlxuXHQgKi9cblx0Z2V0T2JqZWN0PFQgZXh0ZW5kcyBvYmplY3Q+KGtleTogc3RyaW5nLCBzY29wZTogU3RvcmFnZVNjb3BlLCBmYWxsYmFja1ZhbHVlOiBUKTogVDtcblx0Z2V0T2JqZWN0PFQgZXh0ZW5kcyBvYmplY3Q+KGtleTogc3RyaW5nLCBzY29wZTogU3RvcmFnZVNjb3BlLCBmYWxsYmFja1ZhbHVlPzogVCk6IFQgfCB1bmRlZmluZWQ7XG5cblx0LyoqXG5cdCAqIFN0b3JlIGEgdmFsdWUgdW5kZXIgdGhlIGdpdmVuIGtleSB0byBzdG9yYWdlLiBUaGUgdmFsdWUgd2lsbCBiZVxuXHQgKiBjb252ZXJ0ZWQgdG8gYSBgc3RyaW5nYC4gU3RvcmluZyBlaXRoZXIgYHVuZGVmaW5lZGAgb3IgYG51bGxgIHdpbGxcblx0ICogcmVtb3ZlIHRoZSBlbnRyeSB1bmRlciB0aGUga2V5LlxuXHQgKlxuXHQgKiBAcGFyYW0gc2NvcGUgYWxsb3dzIHRvIGRlZmluZSB0aGUgc2NvcGUgb2YgdGhlIHN0b3JhZ2Ugb3BlcmF0aW9uXG5cdCAqIHRvIGVpdGhlciB0aGUgY3VycmVudCB3b3Jrc3BhY2Ugb25seSwgYWxsIHdvcmtzcGFjZXMgb3IgYWxsIHByb2ZpbGVzLlxuXHQgKlxuXHQgKiBAcGFyYW0gdGFyZ2V0IGFsbG93cyB0byBkZWZpbmUgdGhlIHRhcmdldCBvZiB0aGUgc3RvcmFnZSBvcGVyYXRpb25cblx0ICogdG8gZWl0aGVyIHRoZSBjdXJyZW50IG1hY2hpbmUgb3IgdXNlci5cblx0ICovXG5cdHN0b3JlKGtleTogc3RyaW5nLCB2YWx1ZTogU3RvcmFnZVZhbHVlLCBzY29wZTogU3RvcmFnZVNjb3BlLCB0YXJnZXQ6IFN0b3JhZ2VUYXJnZXQpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBBbGxvd3MgdG8gc3RvcmUgbXVsdGlwbGUgdmFsdWVzIGluIGEgYnVsayBvcGVyYXRpb24uIEV2ZW50cyB3aWxsIG9ubHlcblx0ICogYmUgZW1pdHRlZCB3aGVuIGFsbCB2YWx1ZXMgaGF2ZSBiZWVuIHN0b3JlZC5cblx0ICpcblx0ICogQHBhcmFtIGV4dGVybmFsIGEgaGludCB0byBpbmRpY2F0ZSB0aGUgc291cmNlIG9mIHRoZSBvcGVyYXRpb24gaXMgZXh0ZXJuYWwsXG5cdCAqIHN1Y2ggYXMgc2V0dGluZ3Mgc3luYyBvciBwcm9maWxlIGNoYW5nZXMuXG5cdCAqL1xuXHRzdG9yZUFsbChlbnRyaWVzOiBBcnJheTxJU3RvcmFnZUVudHJ5PiwgZXh0ZXJuYWw6IGJvb2xlYW4pOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBEZWxldGUgYW4gZWxlbWVudCBzdG9yZWQgdW5kZXIgdGhlIHByb3ZpZGVkIGtleSBmcm9tIHN0b3JhZ2UuXG5cdCAqXG5cdCAqIFRoZSBzY29wZSBhcmd1bWVudCBhbGxvd3MgdG8gZGVmaW5lIHRoZSBzY29wZSBvZiB0aGUgc3RvcmFnZVxuXHQgKiBvcGVyYXRpb24gdG8gZWl0aGVyIHRoZSBjdXJyZW50IHdvcmtzcGFjZSBvbmx5LCBhbGwgd29ya3NwYWNlc1xuXHQgKiBvciBhbGwgcHJvZmlsZXMuXG5cdCAqL1xuXHRyZW1vdmUoa2V5OiBzdHJpbmcsIHNjb3BlOiBTdG9yYWdlU2NvcGUpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGFsbCB0aGUga2V5cyB1c2VkIGluIHRoZSBzdG9yYWdlIGZvciB0aGUgcHJvdmlkZWQgYHNjb3BlYFxuXHQgKiBhbmQgYHRhcmdldGAuXG5cdCAqXG5cdCAqIE5vdGU6IHRoaXMgd2lsbCBOT1QgcmV0dXJuIGFsbCBrZXlzIHN0b3JlZCBpbiB0aGUgc3RvcmFnZSBsYXllci5cblx0ICogU29tZSBrZXlzIG1heSBub3QgaGF2ZSBhbiBhc3NvY2lhdGVkIGBTdG9yYWdlVGFyZ2V0YCBhbmQgdGh1c1xuXHQgKiB3aWxsIGJlIGV4Y2x1ZGVkIGZyb20gdGhlIHJlc3VsdHMuXG5cdCAqXG5cdCAqIEBwYXJhbSBzY29wZSBhbGxvd3MgdG8gZGVmaW5lIHRoZSBzY29wZSBmb3IgdGhlIGtleXNcblx0ICogdG8gZWl0aGVyIHRoZSBjdXJyZW50IHdvcmtzcGFjZSBvbmx5LCBhbGwgd29ya3NwYWNlcyBvciBhbGwgcHJvZmlsZXMuXG5cdCAqXG5cdCAqIEBwYXJhbSB0YXJnZXQgYWxsb3dzIHRvIGRlZmluZSB0aGUgdGFyZ2V0IGZvciB0aGUga2V5c1xuXHQgKiB0byBlaXRoZXIgdGhlIGN1cnJlbnQgbWFjaGluZSBvciB1c2VyLlxuXHQgKi9cblx0a2V5cyhzY29wZTogU3RvcmFnZVNjb3BlLCB0YXJnZXQ6IFN0b3JhZ2VUYXJnZXQpOiBzdHJpbmdbXTtcblxuXHQvKipcblx0ICogTG9nIHRoZSBjb250ZW50cyBvZiB0aGUgc3RvcmFnZSB0byB0aGUgY29uc29sZS5cblx0ICovXG5cdGxvZygpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRydWUgaWYgdGhlIHN0b3JhZ2Ugc2VydmljZSBoYW5kbGVzIHRoZSBwcm92aWRlZCBzY29wZS5cblx0ICovXG5cdGhhc1Njb3BlKHNjb3BlOiBJQW55V29ya3NwYWNlSWRlbnRpZmllciB8IElVc2VyRGF0YVByb2ZpbGUpOiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBTd2l0Y2ggc3RvcmFnZSB0byBhbm90aGVyIHdvcmtzcGFjZSBvciBwcm9maWxlLiBPcHRpb25hbGx5IHByZXNlcnZlIHRoZVxuXHQgKiBjdXJyZW50IGRhdGEgdG8gdGhlIG5ldyBzdG9yYWdlLlxuXHQgKi9cblx0c3dpdGNoKHRvOiBJQW55V29ya3NwYWNlSWRlbnRpZmllciB8IElVc2VyRGF0YVByb2ZpbGUsIHByZXNlcnZlRGF0YTogYm9vbGVhbik6IFByb21pc2U8dm9pZD47XG5cblx0LyoqXG5cdCAqIFdoZXRoZXIgdGhlIHN0b3JhZ2UgZm9yIHRoZSBnaXZlbiBzY29wZSB3YXMgY3JlYXRlZCBkdXJpbmcgdGhpcyBzZXNzaW9uIG9yXG5cdCAqIGV4aXN0ZWQgYmVmb3JlLlxuXHQgKi9cblx0aXNOZXcoc2NvcGU6IFN0b3JhZ2VTY29wZSk6IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIEF0dGVtcHRzIHRvIHJlZHVjZSB0aGUgREIgc2l6ZSB2aWEgb3B0aW1pemF0aW9uIGNvbW1hbmRzIGlmIHN1cHBvcnRlZC5cblx0ICovXG5cdG9wdGltaXplKHNjb3BlOiBTdG9yYWdlU2NvcGUpOiBQcm9taXNlPHZvaWQ+O1xuXG5cdC8qKlxuXHQgKiBBbGxvd3MgdG8gZmx1c2ggc3RhdGUsIGUuZy4gaW4gY2FzZXMgd2hlcmUgYSBzaHV0ZG93biBpc1xuXHQgKiBpbW1pbmVudC4gVGhpcyB3aWxsIHNlbmQgb3V0IHRoZSBgb25XaWxsU2F2ZVN0YXRlYCB0byBhc2tcblx0ICogZXZlcnlvbmUgZm9yIGxhdGVzdCBzdGF0ZS5cblx0ICpcblx0ICogQHJldHVybnMgYSBgUHJvbWlzZWAgdGhhdCBjYW4gYmUgYXdhaXRlZCBvbiB3aGVuIGFsbCB1cGRhdGVzXG5cdCAqIHRvIHRoZSB1bmRlcmx5aW5nIHN0b3JhZ2UgaGF2ZSBiZWVuIGZsdXNoZWQuXG5cdCAqL1xuXHRmbHVzaChyZWFzb24/OiBXaWxsU2F2ZVN0YXRlUmVhc29uKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gU3RvcmFnZVNjb3BlIHtcblxuXHQvKipcblx0ICogVGhlIHN0b3JlZCBkYXRhIHdpbGwgYmUgc2NvcGVkIHRvIGFsbCB3b3Jrc3BhY2VzIGFjcm9zcyBhbGwgcHJvZmlsZXMuXG5cdCAqL1xuXHRBUFBMSUNBVElPTiA9IC0xLFxuXG5cdC8qKlxuXHQgKiBUaGUgc3RvcmVkIGRhdGEgd2lsbCBiZSBzY29wZWQgdG8gYWxsIHdvcmtzcGFjZXMgb2YgdGhlIHNhbWUgcHJvZmlsZS5cblx0ICovXG5cdFBST0ZJTEUgPSAwLFxuXG5cdC8qKlxuXHQgKiBUaGUgc3RvcmVkIGRhdGEgd2lsbCBiZSBzY29wZWQgdG8gdGhlIGN1cnJlbnQgd29ya3NwYWNlLlxuXHQgKi9cblx0V09SS1NQQUNFID0gMVxufVxuXG5leHBvcnQgY29uc3QgZW51bSBTdG9yYWdlVGFyZ2V0IHtcblxuXHQvKipcblx0ICogVGhlIHN0b3JlZCBkYXRhIGlzIHVzZXIgc3BlY2lmaWMgYW5kIGFwcGxpZXMgYWNyb3NzIG1hY2hpbmVzLlxuXHQgKi9cblx0VVNFUixcblxuXHQvKipcblx0ICogVGhlIHN0b3JlZCBkYXRhIGlzIG1hY2hpbmUgc3BlY2lmaWMuXG5cdCAqL1xuXHRNQUNISU5FXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN0b3JhZ2VWYWx1ZUNoYW5nZUV2ZW50IHtcblxuXHQvKipcblx0ICogVGhlIHNjb3BlIGZvciB0aGUgc3RvcmFnZSBlbnRyeSB0aGF0IGNoYW5nZWRcblx0ICogb3Igd2FzIHJlbW92ZWQuXG5cdCAqL1xuXHRyZWFkb25seSBzY29wZTogU3RvcmFnZVNjb3BlO1xuXG5cdC8qKlxuXHQgKiBUaGUgYGtleWAgb2YgdGhlIHN0b3JhZ2UgZW50cnkgdGhhdCB3YXMgY2hhbmdlZFxuXHQgKiBvciB3YXMgcmVtb3ZlZC5cblx0ICovXG5cdHJlYWRvbmx5IGtleTogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBUaGUgYHRhcmdldGAgY2FuIGJlIGB1bmRlZmluZWRgIGlmIGEga2V5IGlzIGJlaW5nXG5cdCAqIHJlbW92ZWQuXG5cdCAqL1xuXHRyZWFkb25seSB0YXJnZXQ6IFN0b3JhZ2VUYXJnZXQgfCB1bmRlZmluZWQ7XG5cblx0LyoqXG5cdCAqIEEgaGludCBob3cgdGhlIHN0b3JhZ2UgY2hhbmdlIGV2ZW50IHdhcyB0cmlnZ2VyZWQuIElmXG5cdCAqIGB0cnVlYCwgdGhlIHN0b3JhZ2UgY2hhbmdlIHdhcyB0cmlnZ2VyZWQgYnkgYW4gZXh0ZXJuYWxcblx0ICogc291cmNlLCBzdWNoIGFzOlxuXHQgKiAtIGFub3RoZXIgcHJvY2VzcyAoZm9yIGV4YW1wbGUgYW5vdGhlciB3aW5kb3cpXG5cdCAqIC0gb3BlcmF0aW9ucyBzdWNoIGFzIHNldHRpbmdzIHN5bmMgb3IgcHJvZmlsZXMgY2hhbmdlXG5cdCAqL1xuXHRyZWFkb25seSBleHRlcm5hbD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN0b3JhZ2VUYXJnZXRDaGFuZ2VFdmVudCB7XG5cblx0LyoqXG5cdCAqIFRoZSBzY29wZSBmb3IgdGhlIHRhcmdldCB0aGF0IGNoYW5nZWQuIExpc3RlbmVyc1xuXHQgKiBzaG91bGQgdXNlIGBrZXlzKHNjb3BlLCB0YXJnZXQpYCB0byBnZXQgYW4gdXBkYXRlZFxuXHQgKiBsaXN0IG9mIGtleXMgZm9yIHRoZSBnaXZlbiBgc2NvcGVgIGFuZCBgdGFyZ2V0YC5cblx0ICovXG5cdHJlYWRvbmx5IHNjb3BlOiBTdG9yYWdlU2NvcGU7XG59XG5cbmludGVyZmFjZSBJS2V5VGFyZ2V0cyB7XG5cdFtrZXk6IHN0cmluZ106IFN0b3JhZ2VUYXJnZXQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN0b3JhZ2VTZXJ2aWNlT3B0aW9ucyB7XG5cdHJlYWRvbmx5IGZsdXNoSW50ZXJ2YWw6IG51bWJlcjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGxvYWRLZXlUYXJnZXRzKHN0b3JhZ2U6IElTdG9yYWdlKTogSUtleVRhcmdldHMge1xuXHRjb25zdCBrZXlzUmF3ID0gc3RvcmFnZS5nZXQoVEFSR0VUX0tFWSk7XG5cdGlmIChrZXlzUmF3KSB7XG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiBKU09OLnBhcnNlKGtleXNSYXcpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHQvLyBGYWlsIGdyYWNlZnVsbHlcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gT2JqZWN0LmNyZWF0ZShudWxsKTtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0U3RvcmFnZVNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVN0b3JhZ2VTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHN0YXRpYyBERUZBVUxUX0ZMVVNIX0lOVEVSVkFMID0gNjAgKiAxMDAwOyAvLyBldmVyeSBtaW51dGVcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVZhbHVlID0gdGhpcy5fcmVnaXN0ZXIobmV3IFBhdXNlYWJsZUVtaXR0ZXI8SVN0b3JhZ2VWYWx1ZUNoYW5nZUV2ZW50PigpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVRhcmdldCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBQYXVzZWFibGVFbWl0dGVyPElTdG9yYWdlVGFyZ2V0Q2hhbmdlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVRhcmdldCA9IHRoaXMuX29uRGlkQ2hhbmdlVGFyZ2V0LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uV2lsbFNhdmVTdGF0ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElXaWxsU2F2ZVN0YXRlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbldpbGxTYXZlU3RhdGUgPSB0aGlzLl9vbldpbGxTYXZlU3RhdGUuZXZlbnQ7XG5cblx0cHJpdmF0ZSBpbml0aWFsaXphdGlvblByb21pc2U6IFByb21pc2U8dm9pZD4gfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBmbHVzaFdoZW5JZGxlU2NoZWR1bGVyOiBSdW5PbmNlU2NoZWR1bGVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IHJ1bkZsdXNoV2hlbklkbGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cblx0Y29uc3RydWN0b3Iob3B0aW9uczogSVN0b3JhZ2VTZXJ2aWNlT3B0aW9ucyA9IHsgZmx1c2hJbnRlcnZhbDogQWJzdHJhY3RTdG9yYWdlU2VydmljZS5ERUZBVUxUX0ZMVVNIX0lOVEVSVkFMIH0pIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5mbHVzaFdoZW5JZGxlU2NoZWR1bGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4gdGhpcy5kb0ZsdXNoV2hlbklkbGUoKSwgb3B0aW9ucy5mbHVzaEludGVydmFsKSk7XG5cdH1cblxuXHRvbkRpZENoYW5nZVZhbHVlKHNjb3BlOiBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBrZXk6IHN0cmluZyB8IHVuZGVmaW5lZCwgZGlzcG9zYWJsZTogRGlzcG9zYWJsZVN0b3JlKTogRXZlbnQ8SVdvcmtzcGFjZVN0b3JhZ2VWYWx1ZUNoYW5nZUV2ZW50Pjtcblx0b25EaWRDaGFuZ2VWYWx1ZShzY29wZTogU3RvcmFnZVNjb3BlLlBST0ZJTEUsIGtleTogc3RyaW5nIHwgdW5kZWZpbmVkLCBkaXNwb3NhYmxlOiBEaXNwb3NhYmxlU3RvcmUpOiBFdmVudDxJUHJvZmlsZVN0b3JhZ2VWYWx1ZUNoYW5nZUV2ZW50Pjtcblx0b25EaWRDaGFuZ2VWYWx1ZShzY29wZTogU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBrZXk6IHN0cmluZyB8IHVuZGVmaW5lZCwgZGlzcG9zYWJsZTogRGlzcG9zYWJsZVN0b3JlKTogRXZlbnQ8SUFwcGxpY2F0aW9uU3RvcmFnZVZhbHVlQ2hhbmdlRXZlbnQ+O1xuXHRvbkRpZENoYW5nZVZhbHVlKHNjb3BlOiBTdG9yYWdlU2NvcGUsIGtleTogc3RyaW5nIHwgdW5kZWZpbmVkLCBkaXNwb3NhYmxlOiBEaXNwb3NhYmxlU3RvcmUpOiBFdmVudDxJU3RvcmFnZVZhbHVlQ2hhbmdlRXZlbnQ+IHtcblx0XHRyZXR1cm4gRXZlbnQuZmlsdGVyKHRoaXMuX29uRGlkQ2hhbmdlVmFsdWUuZXZlbnQsIGUgPT4gZS5zY29wZSA9PT0gc2NvcGUgJiYgKGtleSA9PT0gdW5kZWZpbmVkIHx8IGUua2V5ID09PSBrZXkpLCBkaXNwb3NhYmxlKTtcblx0fVxuXG5cdHByaXZhdGUgZG9GbHVzaFdoZW5JZGxlKCk6IHZvaWQge1xuXHRcdHRoaXMucnVuRmx1c2hXaGVuSWRsZS52YWx1ZSA9IHJ1bldoZW5HbG9iYWxJZGxlKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLnNob3VsZEZsdXNoV2hlbklkbGUoKSkge1xuXHRcdFx0XHR0aGlzLmZsdXNoKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHJlcGVhdFxuXHRcdFx0dGhpcy5mbHVzaFdoZW5JZGxlU2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgc2hvdWxkRmx1c2hXaGVuSWRsZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByb3RlY3RlZCBzdG9wRmx1c2hXaGVuSWRsZSgpOiB2b2lkIHtcblx0XHRkaXNwb3NlKFt0aGlzLnJ1bkZsdXNoV2hlbklkbGUsIHRoaXMuZmx1c2hXaGVuSWRsZVNjaGVkdWxlcl0pO1xuXHR9XG5cblx0aW5pdGlhbGl6ZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuaW5pdGlhbGl6YXRpb25Qcm9taXNlKSB7XG5cdFx0XHR0aGlzLmluaXRpYWxpemF0aW9uUHJvbWlzZSA9IChhc3luYyAoKSA9PiB7XG5cblx0XHRcdFx0Ly8gSW5pdCBhbGwgc3RvcmFnZSBsb2NhdGlvbnNcblx0XHRcdFx0bWFyaygnY29kZS93aWxsSW5pdFN0b3JhZ2UnKTtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmRvSW5pdGlhbGl6ZSgpOyAvLyBBc2sgc3ViY2xhc3NlcyB0byBpbml0aWFsaXplIHN0b3JhZ2Vcblx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHRtYXJrKCdjb2RlL2RpZEluaXRTdG9yYWdlJyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBPbiBzb21lIE9TIHdlIGRvIG5vdCBnZXQgZW5vdWdoIHRpbWUgdG8gcGVyc2lzdCBzdGF0ZSBvbiBzaHV0ZG93biAoZS5nLiB3aGVuXG5cdFx0XHRcdC8vIFdpbmRvd3MgcmVzdGFydHMgYWZ0ZXIgYXBwbHlpbmcgdXBkYXRlcykuIEluIG90aGVyIGNhc2VzLCBWU0NvZGUgbWlnaHQgY3Jhc2gsXG5cdFx0XHRcdC8vIHNvIHdlIHBlcmlvZGljYWxseSBzYXZlIHN0YXRlIHRvIHJlZHVjZSB0aGUgY2hhbmNlIG9mIGxvb3NpbmcgYW55IHN0YXRlLlxuXHRcdFx0XHQvLyBJbiB0aGUgYnJvd3NlciB3ZSBkbyBub3QgaGF2ZSBzdXBwb3J0IGZvciBsb25nIHJ1bm5pbmcgdW5sb2FkIHNlcXVlbmNlcy4gQXMgc3VjaCxcblx0XHRcdFx0Ly8gd2UgY2Fubm90IGFzayBmb3Igc2F2aW5nIHN0YXRlIGluIHRoYXQgbW9tZW50LCBiZWNhdXNlIHRoYXQgd291bGQgcmVzdWx0IGluIGFcblx0XHRcdFx0Ly8gbG9uZyBydW5uaW5nIG9wZXJhdGlvbi5cblx0XHRcdFx0Ly8gSW5zdGVhZCwgcGVyaW9kaWNhbGx5IGFzayBjdXN0b21lcnMgdG8gc2F2ZSBzYXZlLiBUaGUgbGlicmFyeSB3aWxsIGJlIGNsZXZlciBlbm91Z2hcblx0XHRcdFx0Ly8gdG8gb25seSBzYXZlIHN0YXRlIHRoYXQgaGFzIGFjdHVhbGx5IGNoYW5nZWQuXG5cdFx0XHRcdHRoaXMuZmx1c2hXaGVuSWRsZVNjaGVkdWxlci5zY2hlZHVsZSgpO1xuXHRcdFx0fSkoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5pbml0aWFsaXphdGlvblByb21pc2U7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZW1pdERpZENoYW5nZVZhbHVlKHNjb3BlOiBTdG9yYWdlU2NvcGUsIGV2ZW50OiBJU3RvcmFnZUNoYW5nZUV2ZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgeyBrZXksIGV4dGVybmFsIH0gPSBldmVudDtcblxuXHRcdC8vIFNwZWNpYWxseSBoYW5kbGUgYFRBUkdFVF9LRVlgXG5cdFx0aWYgKGtleSA9PT0gVEFSR0VUX0tFWSkge1xuXG5cdFx0XHQvLyBDbGVhciBvdXIgY2FjaGVkIHZlcnNpb24gd2hpY2ggaXMgbm93IG91dCBvZiBkYXRlXG5cdFx0XHRzd2l0Y2ggKHNjb3BlKSB7XG5cdFx0XHRcdGNhc2UgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OOlxuXHRcdFx0XHRcdHRoaXMuX2FwcGxpY2F0aW9uS2V5VGFyZ2V0cyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBTdG9yYWdlU2NvcGUuUFJPRklMRTpcblx0XHRcdFx0XHR0aGlzLl9wcm9maWxlS2V5VGFyZ2V0cyA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBTdG9yYWdlU2NvcGUuV09SS1NQQUNFOlxuXHRcdFx0XHRcdHRoaXMuX3dvcmtzcGFjZUtleVRhcmdldHMgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEVtaXQgYXMgYGRpZENoYW5nZVRhcmdldGAgZXZlbnRcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlVGFyZ2V0LmZpcmUoeyBzY29wZSB9KTtcblx0XHR9XG5cblx0XHQvLyBFbWl0IGFueSBvdGhlciBrZXkgdG8gb3V0c2lkZVxuXHRcdGVsc2Uge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VWYWx1ZS5maXJlKHsgc2NvcGUsIGtleSwgdGFyZ2V0OiB0aGlzLmdldEtleVRhcmdldHMoc2NvcGUpW2tleV0sIGV4dGVybmFsIH0pO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBlbWl0V2lsbFNhdmVTdGF0ZShyZWFzb246IFdpbGxTYXZlU3RhdGVSZWFzb24pOiB2b2lkIHtcblx0XHR0aGlzLl9vbldpbGxTYXZlU3RhdGUuZmlyZSh7IHJlYXNvbiB9KTtcblx0fVxuXG5cdGdldChrZXk6IHN0cmluZywgc2NvcGU6IFN0b3JhZ2VTY29wZSwgZmFsbGJhY2tWYWx1ZTogc3RyaW5nKTogc3RyaW5nO1xuXHRnZXQoa2V5OiBzdHJpbmcsIHNjb3BlOiBTdG9yYWdlU2NvcGUpOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdGdldChrZXk6IHN0cmluZywgc2NvcGU6IFN0b3JhZ2VTY29wZSwgZmFsbGJhY2tWYWx1ZT86IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0U3RvcmFnZShzY29wZSk/LmdldChrZXksIGZhbGxiYWNrVmFsdWUpO1xuXHR9XG5cblx0Z2V0Qm9vbGVhbihrZXk6IHN0cmluZywgc2NvcGU6IFN0b3JhZ2VTY29wZSwgZmFsbGJhY2tWYWx1ZTogYm9vbGVhbik6IGJvb2xlYW47XG5cdGdldEJvb2xlYW4oa2V5OiBzdHJpbmcsIHNjb3BlOiBTdG9yYWdlU2NvcGUpOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRnZXRCb29sZWFuKGtleTogc3RyaW5nLCBzY29wZTogU3RvcmFnZVNjb3BlLCBmYWxsYmFja1ZhbHVlPzogYm9vbGVhbik6IGJvb2xlYW4gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmdldFN0b3JhZ2Uoc2NvcGUpPy5nZXRCb29sZWFuKGtleSwgZmFsbGJhY2tWYWx1ZSk7XG5cdH1cblxuXHRnZXROdW1iZXIoa2V5OiBzdHJpbmcsIHNjb3BlOiBTdG9yYWdlU2NvcGUsIGZhbGxiYWNrVmFsdWU6IG51bWJlcik6IG51bWJlcjtcblx0Z2V0TnVtYmVyKGtleTogc3RyaW5nLCBzY29wZTogU3RvcmFnZVNjb3BlKTogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHRnZXROdW1iZXIoa2V5OiBzdHJpbmcsIHNjb3BlOiBTdG9yYWdlU2NvcGUsIGZhbGxiYWNrVmFsdWU/OiBudW1iZXIpOiBudW1iZXIgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmdldFN0b3JhZ2Uoc2NvcGUpPy5nZXROdW1iZXIoa2V5LCBmYWxsYmFja1ZhbHVlKTtcblx0fVxuXG5cdGdldE9iamVjdChrZXk6IHN0cmluZywgc2NvcGU6IFN0b3JhZ2VTY29wZSwgZmFsbGJhY2tWYWx1ZTogb2JqZWN0KTogb2JqZWN0O1xuXHRnZXRPYmplY3Qoa2V5OiBzdHJpbmcsIHNjb3BlOiBTdG9yYWdlU2NvcGUpOiBvYmplY3QgfCB1bmRlZmluZWQ7XG5cdGdldE9iamVjdChrZXk6IHN0cmluZywgc2NvcGU6IFN0b3JhZ2VTY29wZSwgZmFsbGJhY2tWYWx1ZT86IG9iamVjdCk6IG9iamVjdCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0U3RvcmFnZShzY29wZSk/LmdldE9iamVjdChrZXksIGZhbGxiYWNrVmFsdWUpO1xuXHR9XG5cblx0c3RvcmVBbGwoZW50cmllczogQXJyYXk8SVN0b3JhZ2VFbnRyeT4sIGV4dGVybmFsOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy53aXRoUGF1c2VkRW1pdHRlcnMoKCkgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBlbnRyeSBvZiBlbnRyaWVzKSB7XG5cdFx0XHRcdHRoaXMuc3RvcmUoZW50cnkua2V5LCBlbnRyeS52YWx1ZSwgZW50cnkuc2NvcGUsIGVudHJ5LnRhcmdldCwgZXh0ZXJuYWwpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0c3RvcmUoa2V5OiBzdHJpbmcsIHZhbHVlOiBTdG9yYWdlVmFsdWUsIHNjb3BlOiBTdG9yYWdlU2NvcGUsIHRhcmdldDogU3RvcmFnZVRhcmdldCwgZXh0ZXJuYWwgPSBmYWxzZSk6IHZvaWQge1xuXG5cdFx0Ly8gV2UgcmVtb3ZlIHRoZSBrZXkgZm9yIHVuZGVmaW5lZC9udWxsIHZhbHVlc1xuXHRcdGlmIChpc1VuZGVmaW5lZE9yTnVsbCh2YWx1ZSkpIHtcblx0XHRcdHRoaXMucmVtb3ZlKGtleSwgc2NvcGUsIGV4dGVybmFsKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBVcGRhdGUgb3VyIGRhdGFzdHJ1Y3R1cmVzIGJ1dCBzZW5kIGV2ZW50cyBvbmx5IGFmdGVyXG5cdFx0dGhpcy53aXRoUGF1c2VkRW1pdHRlcnMoKCkgPT4ge1xuXG5cdFx0XHQvLyBVcGRhdGUga2V5LXRhcmdldCBtYXBcblx0XHRcdHRoaXMudXBkYXRlS2V5VGFyZ2V0KGtleSwgc2NvcGUsIHRhcmdldCk7XG5cblx0XHRcdC8vIFN0b3JlIGFjdHVhbCB2YWx1ZVxuXHRcdFx0dGhpcy5nZXRTdG9yYWdlKHNjb3BlKT8uc2V0KGtleSwgdmFsdWUsIGV4dGVybmFsKTtcblx0XHR9KTtcblx0fVxuXG5cdHJlbW92ZShrZXk6IHN0cmluZywgc2NvcGU6IFN0b3JhZ2VTY29wZSwgZXh0ZXJuYWwgPSBmYWxzZSk6IHZvaWQge1xuXG5cdFx0Ly8gVXBkYXRlIG91ciBkYXRhc3RydWN0dXJlcyBidXQgc2VuZCBldmVudHMgb25seSBhZnRlclxuXHRcdHRoaXMud2l0aFBhdXNlZEVtaXR0ZXJzKCgpID0+IHtcblxuXHRcdFx0Ly8gVXBkYXRlIGtleS10YXJnZXQgbWFwXG5cdFx0XHR0aGlzLnVwZGF0ZUtleVRhcmdldChrZXksIHNjb3BlLCB1bmRlZmluZWQpO1xuXG5cdFx0XHQvLyBSZW1vdmUgYWN0dWFsIGtleVxuXHRcdFx0dGhpcy5nZXRTdG9yYWdlKHNjb3BlKT8uZGVsZXRlKGtleSwgZXh0ZXJuYWwpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSB3aXRoUGF1c2VkRW1pdHRlcnMoZm46IEZ1bmN0aW9uKTogdm9pZCB7XG5cblx0XHQvLyBQYXVzZSBlbWl0dGVyc1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlVmFsdWUucGF1c2UoKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZVRhcmdldC5wYXVzZSgpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGZuKCk7XG5cdFx0fSBmaW5hbGx5IHtcblxuXHRcdFx0Ly8gUmVzdW1lIGVtaXR0ZXJzXG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVZhbHVlLnJlc3VtZSgpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VUYXJnZXQucmVzdW1lKCk7XG5cdFx0fVxuXHR9XG5cblx0a2V5cyhzY29wZTogU3RvcmFnZVNjb3BlLCB0YXJnZXQ6IFN0b3JhZ2VUYXJnZXQpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3Qga2V5czogc3RyaW5nW10gPSBbXTtcblxuXHRcdGNvbnN0IGtleVRhcmdldHMgPSB0aGlzLmdldEtleVRhcmdldHMoc2NvcGUpO1xuXHRcdGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKGtleVRhcmdldHMpKSB7XG5cdFx0XHRjb25zdCBrZXlUYXJnZXQgPSBrZXlUYXJnZXRzW2tleV07XG5cdFx0XHRpZiAoa2V5VGFyZ2V0ID09PSB0YXJnZXQpIHtcblx0XHRcdFx0a2V5cy5wdXNoKGtleSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGtleXM7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUtleVRhcmdldChrZXk6IHN0cmluZywgc2NvcGU6IFN0b3JhZ2VTY29wZSwgdGFyZ2V0OiBTdG9yYWdlVGFyZ2V0IHwgdW5kZWZpbmVkLCBleHRlcm5hbCA9IGZhbHNlKTogdm9pZCB7XG5cblx0XHQvLyBBZGRcblx0XHRjb25zdCBrZXlUYXJnZXRzID0gdGhpcy5nZXRLZXlUYXJnZXRzKHNjb3BlKTtcblx0XHRpZiAodHlwZW9mIHRhcmdldCA9PT0gJ251bWJlcicpIHtcblx0XHRcdGlmIChrZXlUYXJnZXRzW2tleV0gIT09IHRhcmdldCkge1xuXHRcdFx0XHRrZXlUYXJnZXRzW2tleV0gPSB0YXJnZXQ7XG5cdFx0XHRcdHRoaXMuZ2V0U3RvcmFnZShzY29wZSk/LnNldChUQVJHRVRfS0VZLCBKU09OLnN0cmluZ2lmeShrZXlUYXJnZXRzKSwgZXh0ZXJuYWwpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFJlbW92ZVxuXHRcdGVsc2Uge1xuXHRcdFx0aWYgKHR5cGVvZiBrZXlUYXJnZXRzW2tleV0gPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdGRlbGV0ZSBrZXlUYXJnZXRzW2tleV07XG5cdFx0XHRcdHRoaXMuZ2V0U3RvcmFnZShzY29wZSk/LnNldChUQVJHRVRfS0VZLCBKU09OLnN0cmluZ2lmeShrZXlUYXJnZXRzKSwgZXh0ZXJuYWwpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3dvcmtzcGFjZUtleVRhcmdldHM6IElLZXlUYXJnZXRzIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIGdldCB3b3Jrc3BhY2VLZXlUYXJnZXRzKCk6IElLZXlUYXJnZXRzIHtcblx0XHRpZiAoIXRoaXMuX3dvcmtzcGFjZUtleVRhcmdldHMpIHtcblx0XHRcdHRoaXMuX3dvcmtzcGFjZUtleVRhcmdldHMgPSB0aGlzLmxvYWRLZXlUYXJnZXRzKFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl93b3Jrc3BhY2VLZXlUYXJnZXRzO1xuXHR9XG5cblx0cHJpdmF0ZSBfcHJvZmlsZUtleVRhcmdldHM6IElLZXlUYXJnZXRzIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIGdldCBwcm9maWxlS2V5VGFyZ2V0cygpOiBJS2V5VGFyZ2V0cyB7XG5cdFx0aWYgKCF0aGlzLl9wcm9maWxlS2V5VGFyZ2V0cykge1xuXHRcdFx0dGhpcy5fcHJvZmlsZUtleVRhcmdldHMgPSB0aGlzLmxvYWRLZXlUYXJnZXRzKFN0b3JhZ2VTY29wZS5QUk9GSUxFKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fcHJvZmlsZUtleVRhcmdldHM7XG5cdH1cblxuXHRwcml2YXRlIF9hcHBsaWNhdGlvbktleVRhcmdldHM6IElLZXlUYXJnZXRzIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIGdldCBhcHBsaWNhdGlvbktleVRhcmdldHMoKTogSUtleVRhcmdldHMge1xuXHRcdGlmICghdGhpcy5fYXBwbGljYXRpb25LZXlUYXJnZXRzKSB7XG5cdFx0XHR0aGlzLl9hcHBsaWNhdGlvbktleVRhcmdldHMgPSB0aGlzLmxvYWRLZXlUYXJnZXRzKFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX2FwcGxpY2F0aW9uS2V5VGFyZ2V0cztcblx0fVxuXG5cdHByaXZhdGUgZ2V0S2V5VGFyZ2V0cyhzY29wZTogU3RvcmFnZVNjb3BlKTogSUtleVRhcmdldHMge1xuXHRcdHN3aXRjaCAoc2NvcGUpIHtcblx0XHRcdGNhc2UgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5hcHBsaWNhdGlvbktleVRhcmdldHM7XG5cdFx0XHRjYXNlIFN0b3JhZ2VTY29wZS5QUk9GSUxFOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5wcm9maWxlS2V5VGFyZ2V0cztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiB0aGlzLndvcmtzcGFjZUtleVRhcmdldHM7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBsb2FkS2V5VGFyZ2V0cyhzY29wZTogU3RvcmFnZVNjb3BlKTogeyBba2V5OiBzdHJpbmddOiBTdG9yYWdlVGFyZ2V0IH0ge1xuXHRcdGNvbnN0IHN0b3JhZ2UgPSB0aGlzLmdldFN0b3JhZ2Uoc2NvcGUpO1xuXG5cdFx0cmV0dXJuIHN0b3JhZ2UgPyBsb2FkS2V5VGFyZ2V0cyhzdG9yYWdlKSA6IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdH1cblxuXHRpc05ldyhzY29wZTogU3RvcmFnZVNjb3BlKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0Qm9vbGVhbihJU19ORVdfS0VZLCBzY29wZSkgPT09IHRydWU7XG5cdH1cblxuXHRhc3luYyBmbHVzaChyZWFzb24gPSBXaWxsU2F2ZVN0YXRlUmVhc29uLk5PTkUpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIFNpZ25hbCBldmVudCB0byBjb2xsZWN0IGNoYW5nZXNcblx0XHR0aGlzLl9vbldpbGxTYXZlU3RhdGUuZmlyZSh7IHJlYXNvbiB9KTtcblxuXHRcdGNvbnN0IGFwcGxpY2F0aW9uU3RvcmFnZSA9IHRoaXMuZ2V0U3RvcmFnZShTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pO1xuXHRcdGNvbnN0IHByb2ZpbGVTdG9yYWdlID0gdGhpcy5nZXRTdG9yYWdlKFN0b3JhZ2VTY29wZS5QUk9GSUxFKTtcblx0XHRjb25zdCB3b3Jrc3BhY2VTdG9yYWdlID0gdGhpcy5nZXRTdG9yYWdlKFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpO1xuXG5cdFx0c3dpdGNoIChyZWFzb24pIHtcblxuXHRcdFx0Ly8gVW5zcGVjaWZpYyByZWFzb246IGp1c3Qgd2FpdCB3aGVuIGRhdGEgaXMgZmx1c2hlZFxuXHRcdFx0Y2FzZSBXaWxsU2F2ZVN0YXRlUmVhc29uLk5PTkU6XG5cdFx0XHRcdGF3YWl0IFByb21pc2VzLnNldHRsZWQoW1xuXHRcdFx0XHRcdGFwcGxpY2F0aW9uU3RvcmFnZT8ud2hlbkZsdXNoZWQoKSA/PyBQcm9taXNlLnJlc29sdmUoKSxcblx0XHRcdFx0XHRwcm9maWxlU3RvcmFnZT8ud2hlbkZsdXNoZWQoKSA/PyBQcm9taXNlLnJlc29sdmUoKSxcblx0XHRcdFx0XHR3b3Jrc3BhY2VTdG9yYWdlPy53aGVuRmx1c2hlZCgpID8/IFByb21pc2UucmVzb2x2ZSgpXG5cdFx0XHRcdF0pO1xuXHRcdFx0XHRicmVhaztcblxuXHRcdFx0Ly8gU2h1dGRvd246IHdlIHdhbnQgdG8gZmx1c2ggYXMgc29vbiBhcyBwb3NzaWJsZVxuXHRcdFx0Ly8gYW5kIG5vdCBoaXQgYW55IGRlbGF5cyB0aGF0IG1pZ2h0IGJlIHRoZXJlXG5cdFx0XHRjYXNlIFdpbGxTYXZlU3RhdGVSZWFzb24uU0hVVERPV046XG5cdFx0XHRcdGF3YWl0IFByb21pc2VzLnNldHRsZWQoW1xuXHRcdFx0XHRcdGFwcGxpY2F0aW9uU3RvcmFnZT8uZmx1c2goMCkgPz8gUHJvbWlzZS5yZXNvbHZlKCksXG5cdFx0XHRcdFx0cHJvZmlsZVN0b3JhZ2U/LmZsdXNoKDApID8/IFByb21pc2UucmVzb2x2ZSgpLFxuXHRcdFx0XHRcdHdvcmtzcGFjZVN0b3JhZ2U/LmZsdXNoKDApID8/IFByb21pc2UucmVzb2x2ZSgpXG5cdFx0XHRcdF0pO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdH1cblxuXHRhc3luYyBsb2coKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgYXBwbGljYXRpb25JdGVtcyA9IHRoaXMuZ2V0U3RvcmFnZShTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pPy5pdGVtcyA/PyBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXHRcdGNvbnN0IHByb2ZpbGVJdGVtcyA9IHRoaXMuZ2V0U3RvcmFnZShTdG9yYWdlU2NvcGUuUFJPRklMRSk/Lml0ZW1zID8/IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cdFx0Y29uc3Qgd29ya3NwYWNlSXRlbXMgPSB0aGlzLmdldFN0b3JhZ2UoU3RvcmFnZVNjb3BlLldPUktTUEFDRSk/Lml0ZW1zID8/IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cblx0XHRyZXR1cm4gbG9nU3RvcmFnZShcblx0XHRcdGFwcGxpY2F0aW9uSXRlbXMsXG5cdFx0XHRwcm9maWxlSXRlbXMsXG5cdFx0XHR3b3Jrc3BhY2VJdGVtcyxcblx0XHRcdHRoaXMuZ2V0TG9nRGV0YWlscyhTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pID8/ICcnLFxuXHRcdFx0dGhpcy5nZXRMb2dEZXRhaWxzKFN0b3JhZ2VTY29wZS5QUk9GSUxFKSA/PyAnJyxcblx0XHRcdHRoaXMuZ2V0TG9nRGV0YWlscyhTdG9yYWdlU2NvcGUuV09SS1NQQUNFKSA/PyAnJ1xuXHRcdCk7XG5cdH1cblxuXHRhc3luYyBvcHRpbWl6ZShzY29wZTogU3RvcmFnZVNjb3BlKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBBd2FpdCBwZW5kaW5nIGRhdGEgdG8gYmUgZmx1c2hlZCB0byB0aGUgREJcblx0XHQvLyBiZWZvcmUgYXR0ZW1wdGluZyB0byBvcHRpbWl6ZSB0aGUgREJcblx0XHRhd2FpdCB0aGlzLmZsdXNoKCk7XG5cblx0XHRyZXR1cm4gdGhpcy5nZXRTdG9yYWdlKHNjb3BlKT8ub3B0aW1pemUoKTtcblx0fVxuXG5cdGFzeW5jIHN3aXRjaCh0bzogSUFueVdvcmtzcGFjZUlkZW50aWZpZXIgfCBJVXNlckRhdGFQcm9maWxlLCBwcmVzZXJ2ZURhdGE6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIFNpZ25hbCBhcyBldmVudCBzbyB0aGF0IGNsaWVudHMgY2FuIHN0b3JlIGRhdGEgYmVmb3JlIHdlIHN3aXRjaFxuXHRcdHRoaXMuZW1pdFdpbGxTYXZlU3RhdGUoV2lsbFNhdmVTdGF0ZVJlYXNvbi5OT05FKTtcblxuXHRcdGlmIChpc1VzZXJEYXRhUHJvZmlsZSh0bykpIHtcblx0XHRcdHJldHVybiB0aGlzLnN3aXRjaFRvUHJvZmlsZSh0bywgcHJlc2VydmVEYXRhKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5zd2l0Y2hUb1dvcmtzcGFjZSh0bywgcHJlc2VydmVEYXRhKTtcblx0fVxuXG5cdHByb3RlY3RlZCBjYW5Td2l0Y2hQcm9maWxlKGZyb206IElVc2VyRGF0YVByb2ZpbGUsIHRvOiBJVXNlckRhdGFQcm9maWxlKTogYm9vbGVhbiB7XG5cdFx0aWYgKGZyb20uaWQgPT09IHRvLmlkKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7IC8vIGJvdGggcHJvZmlsZXMgYXJlIHNhbWVcblx0XHR9XG5cblx0XHRpZiAoaXNQcm9maWxlVXNpbmdEZWZhdWx0U3RvcmFnZSh0bykgJiYgaXNQcm9maWxlVXNpbmdEZWZhdWx0U3RvcmFnZShmcm9tKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlOyAvLyBib3RoIHByb2ZpbGVzIGFyZSB1c2luZyBkZWZhdWx0XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwcm90ZWN0ZWQgc3dpdGNoRGF0YShvbGRTdG9yYWdlOiBNYXA8c3RyaW5nLCBzdHJpbmc+LCBuZXdTdG9yYWdlOiBJU3RvcmFnZSwgc2NvcGU6IFN0b3JhZ2VTY29wZSk6IHZvaWQge1xuXHRcdHRoaXMud2l0aFBhdXNlZEVtaXR0ZXJzKCgpID0+IHtcblx0XHRcdC8vIFNpZ25hbCBzdG9yYWdlIGtleXMgdGhhdCBoYXZlIGNoYW5nZWRcblx0XHRcdGNvbnN0IGhhbmRsZWRrZXlzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0XHRmb3IgKGNvbnN0IFtrZXksIG9sZFZhbHVlXSBvZiBvbGRTdG9yYWdlKSB7XG5cdFx0XHRcdGhhbmRsZWRrZXlzLmFkZChrZXkpO1xuXG5cdFx0XHRcdGNvbnN0IG5ld1ZhbHVlID0gbmV3U3RvcmFnZS5nZXQoa2V5KTtcblx0XHRcdFx0aWYgKG5ld1ZhbHVlICE9PSBvbGRWYWx1ZSkge1xuXHRcdFx0XHRcdHRoaXMuZW1pdERpZENoYW5nZVZhbHVlKHNjb3BlLCB7IGtleSwgZXh0ZXJuYWw6IHRydWUgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Zm9yIChjb25zdCBba2V5XSBvZiBuZXdTdG9yYWdlLml0ZW1zKSB7XG5cdFx0XHRcdGlmICghaGFuZGxlZGtleXMuaGFzKGtleSkpIHtcblx0XHRcdFx0XHR0aGlzLmVtaXREaWRDaGFuZ2VWYWx1ZShzY29wZSwgeyBrZXksIGV4dGVybmFsOiB0cnVlIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHQvLyAtLS0gYWJzdHJhY3RcblxuXHRhYnN0cmFjdCBoYXNTY29wZShzY29wZTogSUFueVdvcmtzcGFjZUlkZW50aWZpZXIgfCBJVXNlckRhdGFQcm9maWxlKTogYm9vbGVhbjtcblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgZG9Jbml0aWFsaXplKCk6IFByb21pc2U8dm9pZD47XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IGdldFN0b3JhZ2Uoc2NvcGU6IFN0b3JhZ2VTY29wZSk6IElTdG9yYWdlIHwgdW5kZWZpbmVkO1xuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBnZXRMb2dEZXRhaWxzKHNjb3BlOiBTdG9yYWdlU2NvcGUpOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0cHJvdGVjdGVkIGFic3RyYWN0IHN3aXRjaFRvUHJvZmlsZSh0b1Byb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUsIHByZXNlcnZlRGF0YTogYm9vbGVhbik6IFByb21pc2U8dm9pZD47XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBzd2l0Y2hUb1dvcmtzcGFjZSh0b1dvcmtzcGFjZTogSUFueVdvcmtzcGFjZUlkZW50aWZpZXIgfCBJVXNlckRhdGFQcm9maWxlLCBwcmVzZXJ2ZURhdGE6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNQcm9maWxlVXNpbmdEZWZhdWx0U3RvcmFnZShwcm9maWxlOiBJVXNlckRhdGFQcm9maWxlKTogYm9vbGVhbiB7XG5cdHJldHVybiBwcm9maWxlLmlzRGVmYXVsdCB8fCAhIXByb2ZpbGUudXNlRGVmYXVsdEZsYWdzPy5nbG9iYWxTdGF0ZTtcbn1cblxuZXhwb3J0IGNsYXNzIEluTWVtb3J5U3RvcmFnZVNlcnZpY2UgZXh0ZW5kcyBBYnN0cmFjdFN0b3JhZ2VTZXJ2aWNlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGFwcGxpY2F0aW9uU3RvcmFnZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBTdG9yYWdlKG5ldyBJbk1lbW9yeVN0b3JhZ2VEYXRhYmFzZSgpLCB7IGhpbnQ6IFN0b3JhZ2VIaW50LlNUT1JBR0VfSU5fTUVNT1JZIH0pKTtcblx0cHJpdmF0ZSByZWFkb25seSBwcm9maWxlU3RvcmFnZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBTdG9yYWdlKG5ldyBJbk1lbW9yeVN0b3JhZ2VEYXRhYmFzZSgpLCB7IGhpbnQ6IFN0b3JhZ2VIaW50LlNUT1JBR0VfSU5fTUVNT1JZIH0pKTtcblx0cHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VTdG9yYWdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IFN0b3JhZ2UobmV3IEluTWVtb3J5U3RvcmFnZURhdGFiYXNlKCksIHsgaGludDogU3RvcmFnZUhpbnQuU1RPUkFHRV9JTl9NRU1PUlkgfSkpO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndvcmtzcGFjZVN0b3JhZ2Uub25EaWRDaGFuZ2VTdG9yYWdlKGUgPT4gdGhpcy5lbWl0RGlkQ2hhbmdlVmFsdWUoU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnByb2ZpbGVTdG9yYWdlLm9uRGlkQ2hhbmdlU3RvcmFnZShlID0+IHRoaXMuZW1pdERpZENoYW5nZVZhbHVlKFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuYXBwbGljYXRpb25TdG9yYWdlLm9uRGlkQ2hhbmdlU3RvcmFnZShlID0+IHRoaXMuZW1pdERpZENoYW5nZVZhbHVlKFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgZSkpKTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRTdG9yYWdlKHNjb3BlOiBTdG9yYWdlU2NvcGUpOiBJU3RvcmFnZSB7XG5cdFx0c3dpdGNoIChzY29wZSkge1xuXHRcdFx0Y2FzZSBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT046XG5cdFx0XHRcdHJldHVybiB0aGlzLmFwcGxpY2F0aW9uU3RvcmFnZTtcblx0XHRcdGNhc2UgU3RvcmFnZVNjb3BlLlBST0ZJTEU6XG5cdFx0XHRcdHJldHVybiB0aGlzLnByb2ZpbGVTdG9yYWdlO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIHRoaXMud29ya3NwYWNlU3RvcmFnZTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0TG9nRGV0YWlscyhzY29wZTogU3RvcmFnZVNjb3BlKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRzd2l0Y2ggKHNjb3BlKSB7XG5cdFx0XHRjYXNlIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTjpcblx0XHRcdFx0cmV0dXJuICdpbk1lbW9yeSAoYXBwbGljYXRpb24pJztcblx0XHRcdGNhc2UgU3RvcmFnZVNjb3BlLlBST0ZJTEU6XG5cdFx0XHRcdHJldHVybiAnaW5NZW1vcnkgKHByb2ZpbGUpJztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiAnaW5NZW1vcnkgKHdvcmtzcGFjZSknO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBkb0luaXRpYWxpemUoKTogUHJvbWlzZTx2b2lkPiB7IH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgc3dpdGNoVG9Qcm9maWxlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIG5vLW9wIHdoZW4gaW4tbWVtb3J5XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgc3dpdGNoVG9Xb3Jrc3BhY2UoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gbm8tb3Agd2hlbiBpbi1tZW1vcnlcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBzaG91bGRGbHVzaFdoZW5JZGxlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGhhc1Njb3BlKHNjb3BlOiBJQW55V29ya3NwYWNlSWRlbnRpZmllciB8IElVc2VyRGF0YVByb2ZpbGUpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvZ1N0b3JhZ2UoYXBwbGljYXRpb246IE1hcDxzdHJpbmcsIHN0cmluZz4sIHByb2ZpbGU6IE1hcDxzdHJpbmcsIHN0cmluZz4sIHdvcmtzcGFjZTogTWFwPHN0cmluZywgc3RyaW5nPiwgYXBwbGljYXRpb25QYXRoOiBzdHJpbmcsIHByb2ZpbGVQYXRoOiBzdHJpbmcsIHdvcmtzcGFjZVBhdGg6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRjb25zdCBzYWZlUGFyc2UgPSAodmFsdWU6IHN0cmluZykgPT4ge1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gSlNPTi5wYXJzZSh2YWx1ZSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9XG5cdH07XG5cblx0Y29uc3QgYXBwbGljYXRpb25JdGVtcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cdGNvbnN0IGFwcGxpY2F0aW9uSXRlbXNQYXJzZWQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXHRhcHBsaWNhdGlvbi5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7XG5cdFx0YXBwbGljYXRpb25JdGVtcy5zZXQoa2V5LCB2YWx1ZSk7XG5cdFx0YXBwbGljYXRpb25JdGVtc1BhcnNlZC5zZXQoa2V5LCBzYWZlUGFyc2UodmFsdWUpKTtcblx0fSk7XG5cblx0Y29uc3QgcHJvZmlsZUl0ZW1zID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblx0Y29uc3QgcHJvZmlsZUl0ZW1zUGFyc2VkID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblx0cHJvZmlsZS5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7XG5cdFx0cHJvZmlsZUl0ZW1zLnNldChrZXksIHZhbHVlKTtcblx0XHRwcm9maWxlSXRlbXNQYXJzZWQuc2V0KGtleSwgc2FmZVBhcnNlKHZhbHVlKSk7XG5cdH0pO1xuXG5cdGNvbnN0IHdvcmtzcGFjZUl0ZW1zID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblx0Y29uc3Qgd29ya3NwYWNlSXRlbXNQYXJzZWQgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpO1xuXHR3b3Jrc3BhY2UuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuXHRcdHdvcmtzcGFjZUl0ZW1zLnNldChrZXksIHZhbHVlKTtcblx0XHR3b3Jrc3BhY2VJdGVtc1BhcnNlZC5zZXQoa2V5LCBzYWZlUGFyc2UodmFsdWUpKTtcblx0fSk7XG5cblx0aWYgKGFwcGxpY2F0aW9uUGF0aCAhPT0gcHJvZmlsZVBhdGgpIHtcblx0XHRjb25zb2xlLmdyb3VwKGBTdG9yYWdlOiBBcHBsaWNhdGlvbiAocGF0aDogJHthcHBsaWNhdGlvblBhdGh9KWApO1xuXHR9IGVsc2Uge1xuXHRcdGNvbnNvbGUuZ3JvdXAoYFN0b3JhZ2U6IEFwcGxpY2F0aW9uICYgUHJvZmlsZSAocGF0aDogJHthcHBsaWNhdGlvblBhdGh9LCBkZWZhdWx0IHByb2ZpbGUpYCk7XG5cdH1cblx0Y29uc3QgYXBwbGljYXRpb25WYWx1ZXM6IHsga2V5OiBzdHJpbmc7IHZhbHVlOiBzdHJpbmcgfVtdID0gW107XG5cdGFwcGxpY2F0aW9uSXRlbXMuZm9yRWFjaCgodmFsdWUsIGtleSkgPT4ge1xuXHRcdGFwcGxpY2F0aW9uVmFsdWVzLnB1c2goeyBrZXksIHZhbHVlIH0pO1xuXHR9KTtcblx0Y29uc29sZS50YWJsZShhcHBsaWNhdGlvblZhbHVlcyk7XG5cdGNvbnNvbGUuZ3JvdXBFbmQoKTtcblxuXHRjb25zb2xlLmxvZyhhcHBsaWNhdGlvbkl0ZW1zUGFyc2VkKTtcblxuXHRpZiAoYXBwbGljYXRpb25QYXRoICE9PSBwcm9maWxlUGF0aCkge1xuXHRcdGNvbnNvbGUuZ3JvdXAoYFN0b3JhZ2U6IFByb2ZpbGUgKHBhdGg6ICR7cHJvZmlsZVBhdGh9LCBwcm9maWxlIHNwZWNpZmljKWApO1xuXHRcdGNvbnN0IHByb2ZpbGVWYWx1ZXM6IHsga2V5OiBzdHJpbmc7IHZhbHVlOiBzdHJpbmcgfVtdID0gW107XG5cdFx0cHJvZmlsZUl0ZW1zLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcblx0XHRcdHByb2ZpbGVWYWx1ZXMucHVzaCh7IGtleSwgdmFsdWUgfSk7XG5cdFx0fSk7XG5cdFx0Y29uc29sZS50YWJsZShwcm9maWxlVmFsdWVzKTtcblx0XHRjb25zb2xlLmdyb3VwRW5kKCk7XG5cblx0XHRjb25zb2xlLmxvZyhwcm9maWxlSXRlbXNQYXJzZWQpO1xuXHR9XG5cblx0Y29uc29sZS5ncm91cChgU3RvcmFnZTogV29ya3NwYWNlIChwYXRoOiAke3dvcmtzcGFjZVBhdGh9KWApO1xuXHRjb25zdCB3b3Jrc3BhY2VWYWx1ZXM6IHsga2V5OiBzdHJpbmc7IHZhbHVlOiBzdHJpbmcgfVtdID0gW107XG5cdHdvcmtzcGFjZUl0ZW1zLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcblx0XHR3b3Jrc3BhY2VWYWx1ZXMucHVzaCh7IGtleSwgdmFsdWUgfSk7XG5cdH0pO1xuXHRjb25zb2xlLnRhYmxlKHdvcmtzcGFjZVZhbHVlcyk7XG5cdGNvbnNvbGUuZ3JvdXBFbmQoKTtcblxuXHRjb25zb2xlLmxvZyh3b3Jrc3BhY2VJdGVtc1BhcnNlZCk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLFVBQVUsa0JBQWtCLHlCQUF5QjtBQUM5RCxTQUFTLFNBQVMsT0FBTyx3QkFBd0I7QUFDakQsU0FBUyxZQUE2QixTQUFTLHlCQUF5QjtBQUN4RSxTQUFTLFlBQVk7QUFDckIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx5QkFBd0QsU0FBUyxtQkFBaUM7QUFDM0csU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx5QkFBMkM7QUFHN0MsTUFBTSxhQUFhO0FBQ25CLE1BQU0sYUFBYTtBQUVuQixNQUFNLGtCQUFrQixnQkFBaUMsZ0JBQWdCO0FBRXpFLElBQUssc0JBQUwsa0JBQUtBLHlCQUFMO0FBS04sRUFBQUEsMENBQUE7QUFLQSxFQUFBQSwwQ0FBQTtBQVZXLFNBQUFBO0FBQUEsR0FBQTtBQTBNTCxJQUFXLGVBQVgsa0JBQVdDLGtCQUFYO0FBS04sRUFBQUEsNEJBQUEsaUJBQWMsTUFBZDtBQUtBLEVBQUFBLDRCQUFBLGFBQVUsS0FBVjtBQUtBLEVBQUFBLDRCQUFBLGVBQVksS0FBWjtBQWZpQixTQUFBQTtBQUFBLEdBQUE7QUFrQlgsSUFBVyxnQkFBWCxrQkFBV0MsbUJBQVg7QUFLTixFQUFBQSw4QkFBQTtBQUtB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LFdBQVcscUJBQXFCO0FBQ3pFLFVBQU0sZ0JBQWtELENBQUM7QUFDekQsaUJBQWEsUUFBUSxDQUFDLE9BQU8sUUFBUTtBQUNwQyxvQkFBYyxLQUFLLEVBQUUsS0FBSyxNQUFNLENBQUM7QUFBQSxJQUNsQyxDQUFDO0FBQ0QsWUFBUSxNQUFNLGFBQWE7QUFDM0IsWUFBUSxTQUFTO0FBRWpCLFlBQVEsSUFBSSxrQkFBa0I7QUFBQSxFQUMvQjtBQUVBLFVBQVEsTUFBTSw2QkFBNkIsYUFBYSxHQUFHO0FBQzNELFFBQU0sa0JBQW9ELENBQUM7QUFDM0QsaUJBQWUsUUFBUSxDQUFDLE9BQU8sUUFBUTtBQUN0QyxvQkFBZ0IsS0FBSyxFQUFFLEtBQUssTUFBTSxDQUFDO0FBQUEsRUFDcEMsQ0FBQztBQUNELFVBQVEsTUFBTSxlQUFlO0FBQzdCLFVBQVEsU0FBUztBQUVqQixVQUFRLElBQUksb0JBQW9CO0FBQ2pDOyIsCiAgIm5hbWVzIjogWyJXaWxsU2F2ZVN0YXRlUmVhc29uIiwgIlN0b3JhZ2VTY29wZSIsICJTdG9yYWdlVGFyZ2V0Il0KfQo=
