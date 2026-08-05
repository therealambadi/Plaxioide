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
import { createCancelablePromise, disposableTimeout, ThrottledDelayer, timeout } from "../../../base/common/async.js";
import { toLocalISOString } from "../../../base/common/date.js";
import { toErrorMessage } from "../../../base/common/errorMessage.js";
import { isCancellationError } from "../../../base/common/errors.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable, MutableDisposable, toDisposable } from "../../../base/common/lifecycle.js";
import { isWeb } from "../../../base/common/platform.js";
import { isEqual } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { IProductService } from "../../product/common/productService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
import { IUserDataSyncLogService, IUserDataSyncEnablementService, IUserDataSyncService, IUserDataSyncStoreManagementService, IUserDataSyncStoreService, UserDataAutoSyncError, UserDataSyncError, UserDataSyncErrorCode } from "./userDataSync.js";
import { IUserDataSyncAccountService } from "./userDataSyncAccount.js";
import { IUserDataSyncMachinesService } from "./userDataSyncMachines.js";
const disableMachineEventuallyKey = "sync.disableMachineEventually";
const sessionIdKey = "sync.sessionId";
const storeUrlKey = "sync.storeUrl";
const productQualityKey = "sync.productQuality";
let UserDataAutoSyncService = class extends Disposable {
  constructor(productService, userDataSyncStoreManagementService, userDataSyncStoreService, userDataSyncEnablementService, userDataSyncService, logService, userDataSyncAccountService, telemetryService, userDataSyncMachinesService, storageService) {
    super();
    this.userDataSyncStoreManagementService = userDataSyncStoreManagementService;
    this.userDataSyncStoreService = userDataSyncStoreService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this.userDataSyncService = userDataSyncService;
    this.logService = logService;
    this.userDataSyncAccountService = userDataSyncAccountService;
    this.telemetryService = telemetryService;
    this.userDataSyncMachinesService = userDataSyncMachinesService;
    this.storageService = storageService;
    this.autoSync = this._register(new MutableDisposable());
    this.successiveFailures = 0;
    this.lastSyncTriggerTime = void 0;
    this.suspendUntilRestart = false;
    this._onError = this._register(new Emitter());
    this.onError = this._onError.event;
    this.sources = [];
    this.syncTriggerDelayer = this._register(new ThrottledDelayer(this.getSyncTriggerDelayTime()));
    this.lastSyncUrl = this.syncUrl;
    this.syncUrl = userDataSyncStoreManagementService.userDataSyncStore?.url;
    this.previousProductQuality = this.productQuality;
    this.productQuality = productService.quality;
    if (this.syncUrl) {
      this.logService.info("[AutoSync] Using settings sync service", this.syncUrl.toString());
      this._register(userDataSyncStoreManagementService.onDidChangeUserDataSyncStore(() => {
        if (!isEqual(this.syncUrl, userDataSyncStoreManagementService.userDataSyncStore?.url)) {
          this.lastSyncUrl = this.syncUrl;
          this.syncUrl = userDataSyncStoreManagementService.userDataSyncStore?.url;
          if (this.syncUrl) {
            this.logService.info("[AutoSync] Using settings sync service", this.syncUrl.toString());
          }
        }
      }));
      if (this.userDataSyncEnablementService.isEnabled()) {
        this.logService.info("[AutoSync] Enabled.");
      } else {
        this.logService.info("[AutoSync] Disabled.");
      }
      this.updateAutoSync();
      if (this.hasToDisableMachineEventually()) {
        this.disableMachineEventually();
      }
      this._register(userDataSyncAccountService.onDidChangeAccount(() => this.updateAutoSync()));
      this._register(userDataSyncStoreService.onDidChangeDonotMakeRequestsUntil(() => this.updateAutoSync()));
      this._register(userDataSyncService.onDidChangeLocal((source) => this.triggerSync([source])));
      this._register(Event.filter(this.userDataSyncEnablementService.onDidChangeResourceEnablement, ([, enabled]) => enabled)(() => this.triggerSync(["resourceEnablement"])));
      this._register(this.userDataSyncStoreManagementService.onDidChangeUserDataSyncStore(() => this.triggerSync(["userDataSyncStoreChanged"])));
    }
  }
  get syncUrl() {
    const value = this.storageService.get(storeUrlKey, StorageScope.APPLICATION);
    return value ? URI.parse(value) : void 0;
  }
  set syncUrl(syncUrl) {
    if (syncUrl) {
      this.storageService.store(storeUrlKey, syncUrl.toString(), StorageScope.APPLICATION, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(storeUrlKey, StorageScope.APPLICATION);
    }
  }
  get productQuality() {
    return this.storageService.get(productQualityKey, StorageScope.APPLICATION);
  }
  set productQuality(productQuality) {
    if (productQuality) {
      this.storageService.store(productQualityKey, productQuality, StorageScope.APPLICATION, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(productQualityKey, StorageScope.APPLICATION);
    }
  }
  updateAutoSync() {
    const { enabled, message } = this.isAutoSyncEnabled();
    if (enabled) {
      if (this.autoSync.value === void 0) {
        this.autoSync.value = new AutoSync(this.lastSyncUrl, 1e3 * 60 * 5, this.userDataSyncStoreManagementService, this.userDataSyncStoreService, this.userDataSyncService, this.userDataSyncMachinesService, this.logService, this.telemetryService, this.storageService);
        this.autoSync.value.register(this.autoSync.value.onDidStartSync(() => this.lastSyncTriggerTime = (/* @__PURE__ */ new Date()).getTime()));
        this.autoSync.value.register(this.autoSync.value.onDidFinishSync((e) => this.onDidFinishSync(e)));
        if (this.startAutoSync()) {
          this.autoSync.value.start();
        }
      }
    } else {
      this.syncTriggerDelayer.cancel();
      if (this.autoSync.value !== void 0) {
        if (message) {
          this.logService.info(message);
        }
        this.autoSync.clear();
      } else if (message && this.userDataSyncEnablementService.isEnabled()) {
        this.logService.info(message);
      }
    }
  }
  // For tests purpose only
  startAutoSync() {
    return true;
  }
  isAutoSyncEnabled() {
    if (!this.userDataSyncEnablementService.isEnabled()) {
      return { enabled: false, message: "[AutoSync] Disabled." };
    }
    if (!this.userDataSyncAccountService.account) {
      return { enabled: false, message: "[AutoSync] Suspended until auth token is available." };
    }
    if (this.userDataSyncStoreService.donotMakeRequestsUntil) {
      return { enabled: false, message: `[AutoSync] Suspended until ${toLocalISOString(this.userDataSyncStoreService.donotMakeRequestsUntil)} because server is not accepting requests until then.` };
    }
    if (this.suspendUntilRestart) {
      return { enabled: false, message: "[AutoSync] Suspended until restart." };
    }
    return { enabled: true };
  }
  async turnOn() {
    this.stopDisableMachineEventually();
    this.lastSyncUrl = this.syncUrl;
    this.updateEnablement(true);
  }
  async turnOff(everywhere, softTurnOffOnError, donotRemoveMachine) {
    try {
      if (this.userDataSyncAccountService.account && !donotRemoveMachine) {
        await this.userDataSyncMachinesService.removeCurrentMachine();
      }
      this.updateEnablement(false);
      this.storageService.remove(sessionIdKey, StorageScope.APPLICATION);
      if (everywhere) {
        await this.userDataSyncService.reset();
      } else {
        await this.userDataSyncService.resetLocal();
      }
    } catch (error) {
      this.logService.error(error);
      if (softTurnOffOnError) {
        this.updateEnablement(false);
      } else {
        throw error;
      }
    }
  }
  updateEnablement(enabled) {
    if (this.userDataSyncEnablementService.isEnabled() !== enabled) {
      this.userDataSyncEnablementService.setEnablement(enabled);
      this.updateAutoSync();
    }
  }
  hasProductQualityChanged() {
    return !!this.previousProductQuality && !!this.productQuality && this.previousProductQuality !== this.productQuality;
  }
  async onDidFinishSync(error) {
    this.logService.debug("[AutoSync] Sync Finished");
    if (!error) {
      this.successiveFailures = 0;
      return;
    }
    const userDataSyncError = UserDataSyncError.toUserDataSyncError(error);
    if (userDataSyncError.code === UserDataSyncErrorCode.SessionExpired) {
      await this.turnOff(
        false,
        true
        /* force soft turnoff on error */
      );
      this.logService.info("[AutoSync] Turned off sync because current session is expired");
    } else if (userDataSyncError.code === UserDataSyncErrorCode.TurnedOff) {
      await this.turnOff(
        false,
        true
        /* force soft turnoff on error */
      );
      this.logService.info("[AutoSync] Turned off sync because sync is turned off in the cloud");
    } else if (userDataSyncError.code === UserDataSyncErrorCode.LocalTooManyRequests) {
      this.suspendUntilRestart = true;
      this.logService.info("[AutoSync] Suspended sync because of making too many requests to server");
      this.updateAutoSync();
    } else if (userDataSyncError.code === UserDataSyncErrorCode.TooManyRequests) {
      await this.turnOff(
        false,
        true,
        true
        /* do not disable machine because disabling a machine makes request to server and can fail with TooManyRequests */
      );
      this.disableMachineEventually();
      this.logService.info("[AutoSync] Turned off sync because of making too many requests to server");
    } else if (userDataSyncError.code === UserDataSyncErrorCode.MethodNotFound) {
      await this.turnOff(
        false,
        true
        /* force soft turnoff on error */
      );
      this.logService.info("[AutoSync] Turned off sync because current client is making requests to server that are not supported");
    } else if (userDataSyncError.code === UserDataSyncErrorCode.UpgradeRequired || userDataSyncError.code === UserDataSyncErrorCode.Gone) {
      await this.turnOff(
        false,
        true,
        true
        /* do not disable machine because disabling a machine makes request to server and can fail with upgrade required or gone */
      );
      this.disableMachineEventually();
      this.logService.info("[AutoSync] Turned off sync because current client is not compatible with server. Requires client upgrade.");
    } else if (userDataSyncError.code === UserDataSyncErrorCode.IncompatibleLocalContent) {
      await this.turnOff(
        false,
        true
        /* force soft turnoff on error */
      );
      this.logService.info(`[AutoSync] Turned off sync because server has ${userDataSyncError.resource} content with newer version than of client. Requires client upgrade.`);
    } else if (userDataSyncError.code === UserDataSyncErrorCode.IncompatibleRemoteContent) {
      await this.turnOff(
        false,
        true
        /* force soft turnoff on error */
      );
      this.logService.info(`[AutoSync] Turned off sync because server has ${userDataSyncError.resource} content with older version than of client. Requires server reset.`);
    } else if (userDataSyncError.code === UserDataSyncErrorCode.ServiceChanged || userDataSyncError.code === UserDataSyncErrorCode.DefaultServiceChanged) {
      if (isWeb && userDataSyncError.code === UserDataSyncErrorCode.DefaultServiceChanged && !this.hasProductQualityChanged()) {
        await this.turnOff(
          false,
          true
          /* force soft turnoff on error */
        );
        this.logService.info("[AutoSync] Turned off sync because default sync service is changed.");
      } else {
        await this.turnOff(
          false,
          true,
          true
          /* do not disable machine */
        );
        await this.turnOn();
        this.logService.info("[AutoSync] Sync Service changed. Turned off auto sync, reset local state and turned on auto sync.");
      }
    } else {
      this.logService.error(userDataSyncError);
      this.successiveFailures++;
    }
    this._onError.fire(userDataSyncError);
  }
  async disableMachineEventually() {
    this.storageService.store(disableMachineEventuallyKey, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
    await timeout(1e3 * 60 * 10);
    if (!this.hasToDisableMachineEventually()) {
      return;
    }
    this.stopDisableMachineEventually();
    if (!this.userDataSyncEnablementService.isEnabled() && this.userDataSyncAccountService.account) {
      await this.userDataSyncMachinesService.removeCurrentMachine();
    }
  }
  hasToDisableMachineEventually() {
    return this.storageService.getBoolean(disableMachineEventuallyKey, StorageScope.APPLICATION, false);
  }
  stopDisableMachineEventually() {
    this.storageService.remove(disableMachineEventuallyKey, StorageScope.APPLICATION);
  }
  async triggerSync(sources, options) {
    if (this.autoSync.value === void 0) {
      return this.syncTriggerDelayer.cancel();
    }
    if (options?.skipIfSyncedRecently && this.lastSyncTriggerTime && (/* @__PURE__ */ new Date()).getTime() - this.lastSyncTriggerTime < 1e4) {
      this.logService.debug("[AutoSync] Skipping because sync was triggered recently.", sources);
      return;
    }
    this.sources.push(...sources);
    return this.syncTriggerDelayer.trigger(async () => {
      this.logService.trace("[AutoSync] Activity sources", ...this.sources);
      this.sources = [];
      if (this.autoSync.value) {
        await this.autoSync.value.sync("Activity", !!options?.disableCache);
      }
    }, this.successiveFailures ? Math.min(this.getSyncTriggerDelayTime() * this.successiveFailures, 6e4) : options?.immediately ? 0 : this.getSyncTriggerDelayTime());
  }
  getSyncTriggerDelayTime() {
    if (this.lastSyncTriggerTime && (/* @__PURE__ */ new Date()).getTime() - this.lastSyncTriggerTime > 1e4) {
      this.logService.debug("[AutoSync] Sync immediately because last sync was triggered more than 10 seconds ago.");
      return 0;
    }
    return 3e3;
  }
};
UserDataAutoSyncService = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IUserDataSyncStoreManagementService),
  __decorateParam(2, IUserDataSyncStoreService),
  __decorateParam(3, IUserDataSyncEnablementService),
  __decorateParam(4, IUserDataSyncService),
  __decorateParam(5, IUserDataSyncLogService),
  __decorateParam(6, IUserDataSyncAccountService),
  __decorateParam(7, ITelemetryService),
  __decorateParam(8, IUserDataSyncMachinesService),
  __decorateParam(9, IStorageService)
], UserDataAutoSyncService);
const _AutoSync = class _AutoSync extends Disposable {
  constructor(lastSyncUrl, interval, userDataSyncStoreManagementService, userDataSyncStoreService, userDataSyncService, userDataSyncMachinesService, logService, telemetryService, storageService) {
    super();
    this.lastSyncUrl = lastSyncUrl;
    this.interval = interval;
    this.userDataSyncStoreManagementService = userDataSyncStoreManagementService;
    this.userDataSyncStoreService = userDataSyncStoreService;
    this.userDataSyncService = userDataSyncService;
    this.userDataSyncMachinesService = userDataSyncMachinesService;
    this.logService = logService;
    this.telemetryService = telemetryService;
    this.storageService = storageService;
    this.intervalHandler = this._register(new MutableDisposable());
    this._onDidStartSync = this._register(new Emitter());
    this.onDidStartSync = this._onDidStartSync.event;
    this._onDidFinishSync = this._register(new Emitter());
    this.onDidFinishSync = this._onDidFinishSync.event;
    this.manifest = null;
  }
  start() {
    this._register(this.onDidFinishSync(() => this.waitUntilNextIntervalAndSync()));
    this._register(toDisposable(() => {
      if (this.syncPromise) {
        this.syncPromise.cancel();
        this.logService.info("[AutoSync] Cancelled sync that is in progress");
        this.syncPromise = void 0;
      }
      this.syncTask?.stop();
      this.logService.info("[AutoSync] Stopped");
    }));
    this.sync(_AutoSync.INTERVAL_SYNCING, false);
  }
  waitUntilNextIntervalAndSync() {
    this.intervalHandler.value = disposableTimeout(() => {
      this.sync(_AutoSync.INTERVAL_SYNCING, false);
      this.intervalHandler.value = void 0;
    }, this.interval);
  }
  sync(reason, disableCache) {
    const syncPromise = createCancelablePromise(async (token) => {
      if (this.syncPromise) {
        try {
          this.logService.debug("[AutoSync] Waiting until sync is finished.");
          await this.syncPromise;
        } catch (error) {
          if (isCancellationError(error)) {
            return;
          }
        }
      }
      return this.doSync(reason, disableCache, token);
    });
    this.syncPromise = syncPromise;
    this.syncPromise.finally(() => this.syncPromise = void 0);
    return this.syncPromise;
  }
  hasSyncServiceChanged() {
    return this.lastSyncUrl !== void 0 && !isEqual(this.lastSyncUrl, this.userDataSyncStoreManagementService.userDataSyncStore?.url);
  }
  async hasDefaultServiceChanged() {
    const previous = await this.userDataSyncStoreManagementService.getPreviousUserDataSyncStore();
    const current = this.userDataSyncStoreManagementService.userDataSyncStore;
    return !!current && !!previous && (!isEqual(current.defaultUrl, previous.defaultUrl) || !isEqual(current.insidersUrl, previous.insidersUrl) || !isEqual(current.stableUrl, previous.stableUrl));
  }
  async doSync(reason, disableCache, token) {
    this.logService.info(`[AutoSync] Triggered by ${reason}`);
    this._onDidStartSync.fire();
    let error;
    try {
      await this.createAndRunSyncTask(disableCache, token);
    } catch (e) {
      this.logService.error(e);
      error = e;
      if (UserDataSyncError.toUserDataSyncError(e).code === UserDataSyncErrorCode.MethodNotFound) {
        try {
          this.logService.info("[AutoSync] Client is making invalid requests. Cleaning up data...");
          await this.userDataSyncService.cleanUpRemoteData();
          this.logService.info("[AutoSync] Retrying sync...");
          await this.createAndRunSyncTask(disableCache, token);
          error = void 0;
        } catch (e1) {
          this.logService.error(e1);
          error = e1;
        }
      }
    }
    this._onDidFinishSync.fire(error);
  }
  async createAndRunSyncTask(disableCache, token) {
    this.syncTask = await this.userDataSyncService.createSyncTask(this.manifest, disableCache);
    if (token.isCancellationRequested) {
      return;
    }
    this.manifest = this.syncTask.manifest;
    if (this.manifest === null && await this.userDataSyncService.hasPreviouslySynced()) {
      if (this.hasSyncServiceChanged()) {
        if (await this.hasDefaultServiceChanged()) {
          throw new UserDataAutoSyncError(localize("default service changed", "Cannot sync because default service has changed"), UserDataSyncErrorCode.DefaultServiceChanged);
        } else {
          throw new UserDataAutoSyncError(localize("service changed", "Cannot sync because sync service has changed"), UserDataSyncErrorCode.ServiceChanged);
        }
      } else {
        throw new UserDataAutoSyncError(localize("turned off", "Cannot sync because syncing is turned off in the cloud"), UserDataSyncErrorCode.TurnedOff);
      }
    }
    const sessionId = this.storageService.get(sessionIdKey, StorageScope.APPLICATION);
    if (sessionId && this.manifest && sessionId !== this.manifest.session) {
      if (this.hasSyncServiceChanged()) {
        if (await this.hasDefaultServiceChanged()) {
          throw new UserDataAutoSyncError(localize("default service changed", "Cannot sync because default service has changed"), UserDataSyncErrorCode.DefaultServiceChanged);
        } else {
          throw new UserDataAutoSyncError(localize("service changed", "Cannot sync because sync service has changed"), UserDataSyncErrorCode.ServiceChanged);
        }
      } else {
        throw new UserDataAutoSyncError(localize("session expired", "Cannot sync because current session is expired"), UserDataSyncErrorCode.SessionExpired);
      }
    }
    const machines = await this.userDataSyncMachinesService.getMachines(this.manifest || void 0);
    if (token.isCancellationRequested) {
      return;
    }
    const currentMachine = machines.find((machine) => machine.isCurrent);
    if (currentMachine?.disabled) {
      throw new UserDataAutoSyncError(localize("turned off machine", "Cannot sync because syncing is turned off on this machine from another machine."), UserDataSyncErrorCode.TurnedOff);
    }
    const startTime = (/* @__PURE__ */ new Date()).getTime();
    await this.syncTask.run();
    this.telemetryService.publicLog2("settingsSync:sync", { duration: (/* @__PURE__ */ new Date()).getTime() - startTime });
    if (this.manifest === null) {
      try {
        this.manifest = await this.userDataSyncStoreService.manifest(null);
      } catch (error) {
        throw new UserDataAutoSyncError(toErrorMessage(error), error instanceof UserDataSyncError ? error.code : UserDataSyncErrorCode.Unknown);
      }
    }
    if (this.manifest && this.manifest.session !== sessionId) {
      this.storageService.store(sessionIdKey, this.manifest.session, StorageScope.APPLICATION, StorageTarget.MACHINE);
    }
    if (token.isCancellationRequested) {
      return;
    }
    if (!currentMachine) {
      await this.userDataSyncMachinesService.addCurrentMachine(this.manifest || void 0);
    }
  }
  register(t) {
    return super._register(t);
  }
};
_AutoSync.INTERVAL_SYNCING = "Interval";
let AutoSync = _AutoSync;
export {
  UserDataAutoSyncService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL3VzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2FuY2VsYWJsZVByb21pc2UsIGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlLCBkaXNwb3NhYmxlVGltZW91dCwgVGhyb3R0bGVkRGVsYXllciwgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IHRvTG9jYWxJU09TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9kYXRlLmpzJztcbmltcG9ydCB7IHRvRXJyb3JNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JNZXNzYWdlLmpzJztcbmltcG9ydCB7IGlzQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc1dlYiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVN5bmNUYXNrLCBJVXNlckRhdGFBdXRvU3luY1NlcnZpY2UsIElVc2VyRGF0YU1hbmlmZXN0LCBJVXNlckRhdGFTeW5jTG9nU2VydmljZSwgSVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLCBJVXNlckRhdGFTeW5jU2VydmljZSwgSVVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UsIElVc2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UsIFVzZXJEYXRhQXV0b1N5bmNFcnJvciwgVXNlckRhdGFTeW5jRXJyb3IsIFVzZXJEYXRhU3luY0Vycm9yQ29kZSwgU3luY09wdGlvbnMgfSBmcm9tICcuL3VzZXJEYXRhU3luYy5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFTeW5jQWNjb3VudFNlcnZpY2UgfSBmcm9tICcuL3VzZXJEYXRhU3luY0FjY291bnQuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhU3luY01hY2hpbmVzU2VydmljZSB9IGZyb20gJy4vdXNlckRhdGFTeW5jTWFjaGluZXMuanMnO1xuXG5jb25zdCBkaXNhYmxlTWFjaGluZUV2ZW50dWFsbHlLZXkgPSAnc3luYy5kaXNhYmxlTWFjaGluZUV2ZW50dWFsbHknO1xuY29uc3Qgc2Vzc2lvbklkS2V5ID0gJ3N5bmMuc2Vzc2lvbklkJztcbmNvbnN0IHN0b3JlVXJsS2V5ID0gJ3N5bmMuc3RvcmVVcmwnO1xuY29uc3QgcHJvZHVjdFF1YWxpdHlLZXkgPSAnc3luYy5wcm9kdWN0UXVhbGl0eSc7XG5cbmV4cG9ydCBjbGFzcyBVc2VyRGF0YUF1dG9TeW5jU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVXNlckRhdGFBdXRvU3luY1NlcnZpY2Uge1xuXG5cdF9zZXJ2aWNlQnJhbmQ6IGFueTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGF1dG9TeW5jID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPEF1dG9TeW5jPigpKTtcblx0cHJpdmF0ZSBzdWNjZXNzaXZlRmFpbHVyZXM6IG51bWJlciA9IDA7XG5cdHByaXZhdGUgbGFzdFN5bmNUcmlnZ2VyVGltZTogbnVtYmVyIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIHJlYWRvbmx5IHN5bmNUcmlnZ2VyRGVsYXllcjogVGhyb3R0bGVkRGVsYXllcjx2b2lkPjtcblx0cHJpdmF0ZSBzdXNwZW5kVW50aWxSZXN0YXJ0OiBib29sZWFuID0gZmFsc2U7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25FcnJvcjogRW1pdHRlcjxVc2VyRGF0YVN5bmNFcnJvcj4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxVc2VyRGF0YVN5bmNFcnJvcj4oKSk7XG5cdHJlYWRvbmx5IG9uRXJyb3I6IEV2ZW50PFVzZXJEYXRhU3luY0Vycm9yPiA9IHRoaXMuX29uRXJyb3IuZXZlbnQ7XG5cblx0cHJpdmF0ZSBsYXN0U3luY1VybDogVVJJIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGdldCBzeW5jVXJsKCk6IFVSSSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgdmFsdWUgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChzdG9yZVVybEtleSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblx0XHRyZXR1cm4gdmFsdWUgPyBVUkkucGFyc2UodmFsdWUpIDogdW5kZWZpbmVkO1xuXHR9XG5cdHByaXZhdGUgc2V0IHN5bmNVcmwoc3luY1VybDogVVJJIHwgdW5kZWZpbmVkKSB7XG5cdFx0aWYgKHN5bmNVcmwpIHtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoc3RvcmVVcmxLZXksIHN5bmNVcmwudG9TdHJpbmcoKSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShzdG9yZVVybEtleSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHByZXZpb3VzUHJvZHVjdFF1YWxpdHk6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBnZXQgcHJvZHVjdFF1YWxpdHkoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQocHJvZHVjdFF1YWxpdHlLZXksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdH1cblx0cHJpdmF0ZSBzZXQgcHJvZHVjdFF1YWxpdHkocHJvZHVjdFF1YWxpdHk6IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuXHRcdGlmIChwcm9kdWN0UXVhbGl0eSkge1xuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShwcm9kdWN0UXVhbGl0eUtleSwgcHJvZHVjdFF1YWxpdHksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5yZW1vdmUocHJvZHVjdFF1YWxpdHlLZXksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2U6IElVc2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlOiBJVXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZTogSVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhU3luY1NlcnZpY2U6IElVc2VyRGF0YVN5bmNTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElVc2VyRGF0YVN5bmNMb2dTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jQWNjb3VudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNBY2NvdW50U2VydmljZTogSVVzZXJEYXRhU3luY0FjY291bnRTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jTWFjaGluZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFTeW5jTWFjaGluZXNTZXJ2aWNlOiBJVXNlckRhdGFTeW5jTWFjaGluZXNTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuc3luY1RyaWdnZXJEZWxheWVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IFRocm90dGxlZERlbGF5ZXI8dm9pZD4odGhpcy5nZXRTeW5jVHJpZ2dlckRlbGF5VGltZSgpKSk7XG5cblx0XHR0aGlzLmxhc3RTeW5jVXJsID0gdGhpcy5zeW5jVXJsO1xuXHRcdHRoaXMuc3luY1VybCA9IHVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UudXNlckRhdGFTeW5jU3RvcmU/LnVybDtcblxuXHRcdHRoaXMucHJldmlvdXNQcm9kdWN0UXVhbGl0eSA9IHRoaXMucHJvZHVjdFF1YWxpdHk7XG5cdFx0dGhpcy5wcm9kdWN0UXVhbGl0eSA9IHByb2R1Y3RTZXJ2aWNlLnF1YWxpdHk7XG5cblx0XHRpZiAodGhpcy5zeW5jVXJsKSB7XG5cblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdbQXV0b1N5bmNdIFVzaW5nIHNldHRpbmdzIHN5bmMgc2VydmljZScsIHRoaXMuc3luY1VybC50b1N0cmluZygpKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2Uub25EaWRDaGFuZ2VVc2VyRGF0YVN5bmNTdG9yZSgoKSA9PiB7XG5cdFx0XHRcdGlmICghaXNFcXVhbCh0aGlzLnN5bmNVcmwsIHVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UudXNlckRhdGFTeW5jU3RvcmU/LnVybCkpIHtcblx0XHRcdFx0XHR0aGlzLmxhc3RTeW5jVXJsID0gdGhpcy5zeW5jVXJsO1xuXHRcdFx0XHRcdHRoaXMuc3luY1VybCA9IHVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UudXNlckRhdGFTeW5jU3RvcmU/LnVybDtcblx0XHRcdFx0XHRpZiAodGhpcy5zeW5jVXJsKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnW0F1dG9TeW5jXSBVc2luZyBzZXR0aW5ncyBzeW5jIHNlcnZpY2UnLCB0aGlzLnN5bmNVcmwudG9TdHJpbmcoKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdGlmICh0aGlzLnVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZCgpKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdbQXV0b1N5bmNdIEVuYWJsZWQuJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnW0F1dG9TeW5jXSBEaXNhYmxlZC4nKTtcblx0XHRcdH1cblx0XHRcdHRoaXMudXBkYXRlQXV0b1N5bmMoKTtcblxuXHRcdFx0aWYgKHRoaXMuaGFzVG9EaXNhYmxlTWFjaGluZUV2ZW50dWFsbHkoKSkge1xuXHRcdFx0XHR0aGlzLmRpc2FibGVNYWNoaW5lRXZlbnR1YWxseSgpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih1c2VyRGF0YVN5bmNBY2NvdW50U2VydmljZS5vbkRpZENoYW5nZUFjY291bnQoKCkgPT4gdGhpcy51cGRhdGVBdXRvU3luYygpKSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih1c2VyRGF0YVN5bmNTdG9yZVNlcnZpY2Uub25EaWRDaGFuZ2VEb25vdE1ha2VSZXF1ZXN0c1VudGlsKCgpID0+IHRoaXMudXBkYXRlQXV0b1N5bmMoKSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodXNlckRhdGFTeW5jU2VydmljZS5vbkRpZENoYW5nZUxvY2FsKHNvdXJjZSA9PiB0aGlzLnRyaWdnZXJTeW5jKFtzb3VyY2VdKSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuZmlsdGVyKHRoaXMudXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2Uub25EaWRDaGFuZ2VSZXNvdXJjZUVuYWJsZW1lbnQsIChbLCBlbmFibGVkXSkgPT4gZW5hYmxlZCkoKCkgPT4gdGhpcy50cmlnZ2VyU3luYyhbJ3Jlc291cmNlRW5hYmxlbWVudCddKSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy51c2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlVXNlckRhdGFTeW5jU3RvcmUoKCkgPT4gdGhpcy50cmlnZ2VyU3luYyhbJ3VzZXJEYXRhU3luY1N0b3JlQ2hhbmdlZCddKSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQXV0b1N5bmMoKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBlbmFibGVkLCBtZXNzYWdlIH0gPSB0aGlzLmlzQXV0b1N5bmNFbmFibGVkKCk7XG5cdFx0aWYgKGVuYWJsZWQpIHtcblx0XHRcdGlmICh0aGlzLmF1dG9TeW5jLnZhbHVlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpcy5hdXRvU3luYy52YWx1ZSA9IG5ldyBBdXRvU3luYyh0aGlzLmxhc3RTeW5jVXJsLCAxMDAwICogNjAgKiA1IC8qIDUgbWl1dGVzICovLCB0aGlzLnVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UsIHRoaXMudXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLCB0aGlzLnVzZXJEYXRhU3luY1NlcnZpY2UsIHRoaXMudXNlckRhdGFTeW5jTWFjaGluZXNTZXJ2aWNlLCB0aGlzLmxvZ1NlcnZpY2UsIHRoaXMudGVsZW1ldHJ5U2VydmljZSwgdGhpcy5zdG9yYWdlU2VydmljZSk7XG5cdFx0XHRcdHRoaXMuYXV0b1N5bmMudmFsdWUucmVnaXN0ZXIodGhpcy5hdXRvU3luYy52YWx1ZS5vbkRpZFN0YXJ0U3luYygoKSA9PiB0aGlzLmxhc3RTeW5jVHJpZ2dlclRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSkpO1xuXHRcdFx0XHR0aGlzLmF1dG9TeW5jLnZhbHVlLnJlZ2lzdGVyKHRoaXMuYXV0b1N5bmMudmFsdWUub25EaWRGaW5pc2hTeW5jKGUgPT4gdGhpcy5vbkRpZEZpbmlzaFN5bmMoZSkpKTtcblx0XHRcdFx0aWYgKHRoaXMuc3RhcnRBdXRvU3luYygpKSB7XG5cdFx0XHRcdFx0dGhpcy5hdXRvU3luYy52YWx1ZS5zdGFydCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc3luY1RyaWdnZXJEZWxheWVyLmNhbmNlbCgpO1xuXHRcdFx0aWYgKHRoaXMuYXV0b1N5bmMudmFsdWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRpZiAobWVzc2FnZSkge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKG1lc3NhZ2UpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuYXV0b1N5bmMuY2xlYXIoKTtcblx0XHRcdH1cblxuXHRcdFx0LyogbG9nIG1lc3NhZ2Ugd2hlbiBhdXRvIHN5bmMgaXMgbm90IGRpc2FibGVkIGJ5IHVzZXIgKi9cblx0XHRcdGVsc2UgaWYgKG1lc3NhZ2UgJiYgdGhpcy51c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5pc0VuYWJsZWQoKSkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbyhtZXNzYWdlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyBGb3IgdGVzdHMgcHVycG9zZSBvbmx5XG5cdHByb3RlY3RlZCBzdGFydEF1dG9TeW5jKCk6IGJvb2xlYW4geyByZXR1cm4gdHJ1ZTsgfVxuXG5cdHByaXZhdGUgaXNBdXRvU3luY0VuYWJsZWQoKTogeyBlbmFibGVkOiBib29sZWFuOyBtZXNzYWdlPzogc3RyaW5nIH0ge1xuXHRcdGlmICghdGhpcy51c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5pc0VuYWJsZWQoKSkge1xuXHRcdFx0cmV0dXJuIHsgZW5hYmxlZDogZmFsc2UsIG1lc3NhZ2U6ICdbQXV0b1N5bmNdIERpc2FibGVkLicgfTtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLnVzZXJEYXRhU3luY0FjY291bnRTZXJ2aWNlLmFjY291bnQpIHtcblx0XHRcdHJldHVybiB7IGVuYWJsZWQ6IGZhbHNlLCBtZXNzYWdlOiAnW0F1dG9TeW5jXSBTdXNwZW5kZWQgdW50aWwgYXV0aCB0b2tlbiBpcyBhdmFpbGFibGUuJyB9O1xuXHRcdH1cblx0XHRpZiAodGhpcy51c2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UuZG9ub3RNYWtlUmVxdWVzdHNVbnRpbCkge1xuXHRcdFx0cmV0dXJuIHsgZW5hYmxlZDogZmFsc2UsIG1lc3NhZ2U6IGBbQXV0b1N5bmNdIFN1c3BlbmRlZCB1bnRpbCAke3RvTG9jYWxJU09TdHJpbmcodGhpcy51c2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UuZG9ub3RNYWtlUmVxdWVzdHNVbnRpbCl9IGJlY2F1c2Ugc2VydmVyIGlzIG5vdCBhY2NlcHRpbmcgcmVxdWVzdHMgdW50aWwgdGhlbi5gIH07XG5cdFx0fVxuXHRcdGlmICh0aGlzLnN1c3BlbmRVbnRpbFJlc3RhcnQpIHtcblx0XHRcdHJldHVybiB7IGVuYWJsZWQ6IGZhbHNlLCBtZXNzYWdlOiAnW0F1dG9TeW5jXSBTdXNwZW5kZWQgdW50aWwgcmVzdGFydC4nIH07XG5cdFx0fVxuXHRcdHJldHVybiB7IGVuYWJsZWQ6IHRydWUgfTtcblx0fVxuXG5cdGFzeW5jIHR1cm5PbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLnN0b3BEaXNhYmxlTWFjaGluZUV2ZW50dWFsbHkoKTtcblx0XHR0aGlzLmxhc3RTeW5jVXJsID0gdGhpcy5zeW5jVXJsO1xuXHRcdHRoaXMudXBkYXRlRW5hYmxlbWVudCh0cnVlKTtcblx0fVxuXG5cdGFzeW5jIHR1cm5PZmYoZXZlcnl3aGVyZTogYm9vbGVhbiwgc29mdFR1cm5PZmZPbkVycm9yPzogYm9vbGVhbiwgZG9ub3RSZW1vdmVNYWNoaW5lPzogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cblx0XHRcdC8vIFJlbW92ZSBtYWNoaW5lXG5cdFx0XHRpZiAodGhpcy51c2VyRGF0YVN5bmNBY2NvdW50U2VydmljZS5hY2NvdW50ICYmICFkb25vdFJlbW92ZU1hY2hpbmUpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy51c2VyRGF0YVN5bmNNYWNoaW5lc1NlcnZpY2UucmVtb3ZlQ3VycmVudE1hY2hpbmUoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gRGlzYWJsZSBBdXRvIFN5bmNcblx0XHRcdHRoaXMudXBkYXRlRW5hYmxlbWVudChmYWxzZSk7XG5cblx0XHRcdC8vIFJlc2V0IFNlc3Npb25cblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2UucmVtb3ZlKHNlc3Npb25JZEtleSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblxuXHRcdFx0Ly8gUmVzZXRcblx0XHRcdGlmIChldmVyeXdoZXJlKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMudXNlckRhdGFTeW5jU2VydmljZS5yZXNldCgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXdhaXQgdGhpcy51c2VyRGF0YVN5bmNTZXJ2aWNlLnJlc2V0TG9jYWwoKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdGlmIChzb2Z0VHVybk9mZk9uRXJyb3IpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVFbmFibGVtZW50KGZhbHNlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRW5hYmxlbWVudChlbmFibGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMudXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UuaXNFbmFibGVkKCkgIT09IGVuYWJsZWQpIHtcblx0XHRcdHRoaXMudXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2Uuc2V0RW5hYmxlbWVudChlbmFibGVkKTtcblx0XHRcdHRoaXMudXBkYXRlQXV0b1N5bmMoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGhhc1Byb2R1Y3RRdWFsaXR5Q2hhbmdlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLnByZXZpb3VzUHJvZHVjdFF1YWxpdHkgJiYgISF0aGlzLnByb2R1Y3RRdWFsaXR5ICYmIHRoaXMucHJldmlvdXNQcm9kdWN0UXVhbGl0eSAhPT0gdGhpcy5wcm9kdWN0UXVhbGl0eTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb25EaWRGaW5pc2hTeW5jKGVycm9yOiBFcnJvciB8IHVuZGVmaW5lZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubG9nU2VydmljZS5kZWJ1ZygnW0F1dG9TeW5jXSBTeW5jIEZpbmlzaGVkJyk7XG5cdFx0aWYgKCFlcnJvcikge1xuXHRcdFx0Ly8gU3luYyBmaW5pc2hlZCB3aXRob3V0IGVycm9yc1xuXHRcdFx0dGhpcy5zdWNjZXNzaXZlRmFpbHVyZXMgPSAwO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIEVycm9yIHdoaWxlIHN5bmNpbmdcblx0XHRjb25zdCB1c2VyRGF0YVN5bmNFcnJvciA9IFVzZXJEYXRhU3luY0Vycm9yLnRvVXNlckRhdGFTeW5jRXJyb3IoZXJyb3IpO1xuXG5cdFx0Ly8gU2Vzc2lvbiBnb3QgZXhwaXJlZFxuXHRcdGlmICh1c2VyRGF0YVN5bmNFcnJvci5jb2RlID09PSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuU2Vzc2lvbkV4cGlyZWQpIHtcblx0XHRcdGF3YWl0IHRoaXMudHVybk9mZihmYWxzZSwgdHJ1ZSAvKiBmb3JjZSBzb2Z0IHR1cm5vZmYgb24gZXJyb3IgKi8pO1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ1tBdXRvU3luY10gVHVybmVkIG9mZiBzeW5jIGJlY2F1c2UgY3VycmVudCBzZXNzaW9uIGlzIGV4cGlyZWQnKTtcblx0XHR9XG5cblx0XHQvLyBUdXJuZWQgb2ZmIGZyb20gYW5vdGhlciBkZXZpY2Vcblx0XHRlbHNlIGlmICh1c2VyRGF0YVN5bmNFcnJvci5jb2RlID09PSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuVHVybmVkT2ZmKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnR1cm5PZmYoZmFsc2UsIHRydWUgLyogZm9yY2Ugc29mdCB0dXJub2ZmIG9uIGVycm9yICovKTtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdbQXV0b1N5bmNdIFR1cm5lZCBvZmYgc3luYyBiZWNhdXNlIHN5bmMgaXMgdHVybmVkIG9mZiBpbiB0aGUgY2xvdWQnKTtcblx0XHR9XG5cblx0XHQvLyBFeGNlZWRlZCBSYXRlIExpbWl0IG9uIENsaWVudFxuXHRcdGVsc2UgaWYgKHVzZXJEYXRhU3luY0Vycm9yLmNvZGUgPT09IFVzZXJEYXRhU3luY0Vycm9yQ29kZS5Mb2NhbFRvb01hbnlSZXF1ZXN0cykge1xuXHRcdFx0dGhpcy5zdXNwZW5kVW50aWxSZXN0YXJ0ID0gdHJ1ZTtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdbQXV0b1N5bmNdIFN1c3BlbmRlZCBzeW5jIGJlY2F1c2Ugb2YgbWFraW5nIHRvbyBtYW55IHJlcXVlc3RzIHRvIHNlcnZlcicpO1xuXHRcdFx0dGhpcy51cGRhdGVBdXRvU3luYygpO1xuXHRcdH1cblxuXHRcdC8vIEV4Y2VlZGVkIFJhdGUgTGltaXQgb24gU2VydmVyXG5cdFx0ZWxzZSBpZiAodXNlckRhdGFTeW5jRXJyb3IuY29kZSA9PT0gVXNlckRhdGFTeW5jRXJyb3JDb2RlLlRvb01hbnlSZXF1ZXN0cykge1xuXHRcdFx0YXdhaXQgdGhpcy50dXJuT2ZmKGZhbHNlLCB0cnVlIC8qIGZvcmNlIHNvZnQgdHVybm9mZiBvbiBlcnJvciAqLyxcblx0XHRcdFx0dHJ1ZSAvKiBkbyBub3QgZGlzYWJsZSBtYWNoaW5lIGJlY2F1c2UgZGlzYWJsaW5nIGEgbWFjaGluZSBtYWtlcyByZXF1ZXN0IHRvIHNlcnZlciBhbmQgY2FuIGZhaWwgd2l0aCBUb29NYW55UmVxdWVzdHMgKi8pO1xuXHRcdFx0dGhpcy5kaXNhYmxlTWFjaGluZUV2ZW50dWFsbHkoKTtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdbQXV0b1N5bmNdIFR1cm5lZCBvZmYgc3luYyBiZWNhdXNlIG9mIG1ha2luZyB0b28gbWFueSByZXF1ZXN0cyB0byBzZXJ2ZXInKTtcblx0XHR9XG5cblx0XHQvLyBNZXRob2QgTm90IEZvdW5kXG5cdFx0ZWxzZSBpZiAodXNlckRhdGFTeW5jRXJyb3IuY29kZSA9PT0gVXNlckRhdGFTeW5jRXJyb3JDb2RlLk1ldGhvZE5vdEZvdW5kKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnR1cm5PZmYoZmFsc2UsIHRydWUgLyogZm9yY2Ugc29mdCB0dXJub2ZmIG9uIGVycm9yICovKTtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdbQXV0b1N5bmNdIFR1cm5lZCBvZmYgc3luYyBiZWNhdXNlIGN1cnJlbnQgY2xpZW50IGlzIG1ha2luZyByZXF1ZXN0cyB0byBzZXJ2ZXIgdGhhdCBhcmUgbm90IHN1cHBvcnRlZCcpO1xuXHRcdH1cblxuXHRcdC8vIFVwZ3JhZGUgUmVxdWlyZWQgb3IgR29uZVxuXHRcdGVsc2UgaWYgKHVzZXJEYXRhU3luY0Vycm9yLmNvZGUgPT09IFVzZXJEYXRhU3luY0Vycm9yQ29kZS5VcGdyYWRlUmVxdWlyZWQgfHwgdXNlckRhdGFTeW5jRXJyb3IuY29kZSA9PT0gVXNlckRhdGFTeW5jRXJyb3JDb2RlLkdvbmUpIHtcblx0XHRcdGF3YWl0IHRoaXMudHVybk9mZihmYWxzZSwgdHJ1ZSAvKiBmb3JjZSBzb2Z0IHR1cm5vZmYgb24gZXJyb3IgKi8sXG5cdFx0XHRcdHRydWUgLyogZG8gbm90IGRpc2FibGUgbWFjaGluZSBiZWNhdXNlIGRpc2FibGluZyBhIG1hY2hpbmUgbWFrZXMgcmVxdWVzdCB0byBzZXJ2ZXIgYW5kIGNhbiBmYWlsIHdpdGggdXBncmFkZSByZXF1aXJlZCBvciBnb25lICovKTtcblx0XHRcdHRoaXMuZGlzYWJsZU1hY2hpbmVFdmVudHVhbGx5KCk7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnW0F1dG9TeW5jXSBUdXJuZWQgb2ZmIHN5bmMgYmVjYXVzZSBjdXJyZW50IGNsaWVudCBpcyBub3QgY29tcGF0aWJsZSB3aXRoIHNlcnZlci4gUmVxdWlyZXMgY2xpZW50IHVwZ3JhZGUuJyk7XG5cdFx0fVxuXG5cdFx0Ly8gSW5jb21wYXRpYmxlIExvY2FsIENvbnRlbnRcblx0XHRlbHNlIGlmICh1c2VyRGF0YVN5bmNFcnJvci5jb2RlID09PSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuSW5jb21wYXRpYmxlTG9jYWxDb250ZW50KSB7XG5cdFx0XHRhd2FpdCB0aGlzLnR1cm5PZmYoZmFsc2UsIHRydWUgLyogZm9yY2Ugc29mdCB0dXJub2ZmIG9uIGVycm9yICovKTtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGBbQXV0b1N5bmNdIFR1cm5lZCBvZmYgc3luYyBiZWNhdXNlIHNlcnZlciBoYXMgJHt1c2VyRGF0YVN5bmNFcnJvci5yZXNvdXJjZX0gY29udGVudCB3aXRoIG5ld2VyIHZlcnNpb24gdGhhbiBvZiBjbGllbnQuIFJlcXVpcmVzIGNsaWVudCB1cGdyYWRlLmApO1xuXHRcdH1cblxuXHRcdC8vIEluY29tcGF0aWJsZSBSZW1vdGUgQ29udGVudFxuXHRcdGVsc2UgaWYgKHVzZXJEYXRhU3luY0Vycm9yLmNvZGUgPT09IFVzZXJEYXRhU3luY0Vycm9yQ29kZS5JbmNvbXBhdGlibGVSZW1vdGVDb250ZW50KSB7XG5cdFx0XHRhd2FpdCB0aGlzLnR1cm5PZmYoZmFsc2UsIHRydWUgLyogZm9yY2Ugc29mdCB0dXJub2ZmIG9uIGVycm9yICovKTtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGBbQXV0b1N5bmNdIFR1cm5lZCBvZmYgc3luYyBiZWNhdXNlIHNlcnZlciBoYXMgJHt1c2VyRGF0YVN5bmNFcnJvci5yZXNvdXJjZX0gY29udGVudCB3aXRoIG9sZGVyIHZlcnNpb24gdGhhbiBvZiBjbGllbnQuIFJlcXVpcmVzIHNlcnZlciByZXNldC5gKTtcblx0XHR9XG5cblx0XHQvLyBTZXJ2aWNlIGNoYW5nZWRcblx0XHRlbHNlIGlmICh1c2VyRGF0YVN5bmNFcnJvci5jb2RlID09PSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuU2VydmljZUNoYW5nZWQgfHwgdXNlckRhdGFTeW5jRXJyb3IuY29kZSA9PT0gVXNlckRhdGFTeW5jRXJyb3JDb2RlLkRlZmF1bHRTZXJ2aWNlQ2hhbmdlZCkge1xuXG5cdFx0XHQvLyBDaGVjayBpZiBkZWZhdWx0IHNldHRpbmdzIHN5bmMgc2VydmljZSBoYXMgY2hhbmdlZCBpbiB3ZWIgd2l0aG91dCBjaGFuZ2luZyB0aGUgcHJvZHVjdCBxdWFsaXR5XG5cdFx0XHQvLyBUaGVuIHR1cm4gb2ZmIHNldHRpbmdzIHN5bmMgYW5kIGFzayB1c2VyIHRvIHR1cm4gb24gYWdhaW5cblx0XHRcdGlmIChpc1dlYiAmJiB1c2VyRGF0YVN5bmNFcnJvci5jb2RlID09PSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuRGVmYXVsdFNlcnZpY2VDaGFuZ2VkICYmICF0aGlzLmhhc1Byb2R1Y3RRdWFsaXR5Q2hhbmdlZCgpKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMudHVybk9mZihmYWxzZSwgdHJ1ZSAvKiBmb3JjZSBzb2Z0IHR1cm5vZmYgb24gZXJyb3IgKi8pO1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnW0F1dG9TeW5jXSBUdXJuZWQgb2ZmIHN5bmMgYmVjYXVzZSBkZWZhdWx0IHN5bmMgc2VydmljZSBpcyBjaGFuZ2VkLicpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBTZXJ2aWNlIGhhcyBjaGFuZ2VkIGJ5IHRoZSB1c2VyLiBTbyB0dXJuIG9mZiBhbmQgdHVybiBvbiBzeW5jLlxuXHRcdFx0Ly8gU2hvdyBhIHByb21wdCB0byB0aGUgdXNlciBhYm91dCBzZXJ2aWNlIGNoYW5nZS5cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnR1cm5PZmYoZmFsc2UsIHRydWUgLyogZm9yY2Ugc29mdCB0dXJub2ZmIG9uIGVycm9yICovLCB0cnVlIC8qIGRvIG5vdCBkaXNhYmxlIG1hY2hpbmUgKi8pO1xuXHRcdFx0XHRhd2FpdCB0aGlzLnR1cm5PbigpO1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnW0F1dG9TeW5jXSBTeW5jIFNlcnZpY2UgY2hhbmdlZC4gVHVybmVkIG9mZiBhdXRvIHN5bmMsIHJlc2V0IGxvY2FsIHN0YXRlIGFuZCB0dXJuZWQgb24gYXV0byBzeW5jLicpO1xuXHRcdFx0fVxuXG5cdFx0fVxuXG5cdFx0ZWxzZSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IodXNlckRhdGFTeW5jRXJyb3IpO1xuXHRcdFx0dGhpcy5zdWNjZXNzaXZlRmFpbHVyZXMrKztcblx0XHR9XG5cblx0XHR0aGlzLl9vbkVycm9yLmZpcmUodXNlckRhdGFTeW5jRXJyb3IpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkaXNhYmxlTWFjaGluZUV2ZW50dWFsbHkoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShkaXNhYmxlTWFjaGluZUV2ZW50dWFsbHlLZXksIHRydWUsIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRhd2FpdCB0aW1lb3V0KDEwMDAgKiA2MCAqIDEwKTtcblxuXHRcdC8vIFJldHVybiBpZiBnb3Qgc3RvcHBlZCBtZWFud2hpbGUuXG5cdFx0aWYgKCF0aGlzLmhhc1RvRGlzYWJsZU1hY2hpbmVFdmVudHVhbGx5KCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnN0b3BEaXNhYmxlTWFjaGluZUV2ZW50dWFsbHkoKTtcblxuXHRcdC8vIGRpc2FibGUgb25seSBpZiBzeW5jIGlzIGRpc2FibGVkXG5cdFx0aWYgKCF0aGlzLnVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZCgpICYmIHRoaXMudXNlckRhdGFTeW5jQWNjb3VudFNlcnZpY2UuYWNjb3VudCkge1xuXHRcdFx0YXdhaXQgdGhpcy51c2VyRGF0YVN5bmNNYWNoaW5lc1NlcnZpY2UucmVtb3ZlQ3VycmVudE1hY2hpbmUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGhhc1RvRGlzYWJsZU1hY2hpbmVFdmVudHVhbGx5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldEJvb2xlYW4oZGlzYWJsZU1hY2hpbmVFdmVudHVhbGx5S2V5LCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIGZhbHNlKTtcblx0fVxuXG5cdHByaXZhdGUgc3RvcERpc2FibGVNYWNoaW5lRXZlbnR1YWxseSgpOiB2b2lkIHtcblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShkaXNhYmxlTWFjaGluZUV2ZW50dWFsbHlLZXksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdH1cblxuXHRwcml2YXRlIHNvdXJjZXM6IHN0cmluZ1tdID0gW107XG5cdGFzeW5jIHRyaWdnZXJTeW5jKHNvdXJjZXM6IHN0cmluZ1tdLCBvcHRpb25zPzogU3luY09wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5hdXRvU3luYy52YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5zeW5jVHJpZ2dlckRlbGF5ZXIuY2FuY2VsKCk7XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnM/LnNraXBJZlN5bmNlZFJlY2VudGx5ICYmIHRoaXMubGFzdFN5bmNUcmlnZ2VyVGltZSAmJiBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHRoaXMubGFzdFN5bmNUcmlnZ2VyVGltZSA8IDEwXzAwMCkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmRlYnVnKCdbQXV0b1N5bmNdIFNraXBwaW5nIGJlY2F1c2Ugc3luYyB3YXMgdHJpZ2dlcmVkIHJlY2VudGx5LicsIHNvdXJjZXMpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuc291cmNlcy5wdXNoKC4uLnNvdXJjZXMpO1xuXHRcdHJldHVybiB0aGlzLnN5bmNUcmlnZ2VyRGVsYXllci50cmlnZ2VyKGFzeW5jICgpID0+IHtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnW0F1dG9TeW5jXSBBY3Rpdml0eSBzb3VyY2VzJywgLi4udGhpcy5zb3VyY2VzKTtcblx0XHRcdHRoaXMuc291cmNlcyA9IFtdO1xuXHRcdFx0aWYgKHRoaXMuYXV0b1N5bmMudmFsdWUpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5hdXRvU3luYy52YWx1ZS5zeW5jKCdBY3Rpdml0eScsICEhb3B0aW9ucz8uZGlzYWJsZUNhY2hlKTtcblx0XHRcdH1cblx0XHR9LCB0aGlzLnN1Y2Nlc3NpdmVGYWlsdXJlc1xuXHRcdFx0PyBNYXRoLm1pbih0aGlzLmdldFN5bmNUcmlnZ2VyRGVsYXlUaW1lKCkgKiB0aGlzLnN1Y2Nlc3NpdmVGYWlsdXJlcywgNjBfMDAwKSAvKiBEZWxheSBsaW5lYXJseSB1bnRpbCBtYXggMSBtaW51dGUgKi9cblx0XHRcdDogb3B0aW9ucz8uaW1tZWRpYXRlbHkgPyAwIDogdGhpcy5nZXRTeW5jVHJpZ2dlckRlbGF5VGltZSgpKTtcblxuXHR9XG5cblx0cHJvdGVjdGVkIGdldFN5bmNUcmlnZ2VyRGVsYXlUaW1lKCk6IG51bWJlciB7XG5cdFx0aWYgKHRoaXMubGFzdFN5bmNUcmlnZ2VyVGltZSAmJiBuZXcgRGF0ZSgpLmdldFRpbWUoKSAtIHRoaXMubGFzdFN5bmNUcmlnZ2VyVGltZSA+IDEwXzAwMCkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmRlYnVnKCdbQXV0b1N5bmNdIFN5bmMgaW1tZWRpYXRlbHkgYmVjYXVzZSBsYXN0IHN5bmMgd2FzIHRyaWdnZXJlZCBtb3JlIHRoYW4gMTAgc2Vjb25kcyBhZ28uJyk7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cdFx0cmV0dXJuIDNfMDAwOyAvKiBEZWJvdW5jZSBmb3IgMyBzZWNvbmRzIGlmIHRoZXJlIGFyZSBubyBmYWlsdXJlcyAqL1xuXHR9XG5cbn1cblxuY2xhc3MgQXV0b1N5bmMgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBJTlRFUlZBTF9TWU5DSU5HID0gJ0ludGVydmFsJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IGludGVydmFsSGFuZGxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxJRGlzcG9zYWJsZT4oKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTdGFydFN5bmMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRTdGFydFN5bmMgPSB0aGlzLl9vbkRpZFN0YXJ0U3luYy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEZpbmlzaFN5bmMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxFcnJvciB8IHVuZGVmaW5lZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRmluaXNoU3luYyA9IHRoaXMuX29uRGlkRmluaXNoU3luYy5ldmVudDtcblxuXHRwcml2YXRlIG1hbmlmZXN0OiBJVXNlckRhdGFNYW5pZmVzdCB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHN5bmNUYXNrOiBJVXNlckRhdGFTeW5jVGFzayB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBzeW5jUHJvbWlzZTogQ2FuY2VsYWJsZVByb21pc2U8dm9pZD4gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBsYXN0U3luY1VybDogVVJJIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgaW50ZXJ2YWw6IG51bWJlciAvKiBpbiBtaWxsaXNlY29uZHMgKi8sXG5cdFx0cHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlOiBJVXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhU3luY1N0b3JlU2VydmljZTogSVVzZXJEYXRhU3luY1N0b3JlU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhU3luY1NlcnZpY2U6IElVc2VyRGF0YVN5bmNTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFTeW5jTWFjaGluZXNTZXJ2aWNlOiBJVXNlckRhdGFTeW5jTWFjaGluZXNTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSVVzZXJEYXRhU3luY0xvZ1NlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRzdGFydCgpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm9uRGlkRmluaXNoU3luYygoKSA9PiB0aGlzLndhaXRVbnRpbE5leHRJbnRlcnZhbEFuZFN5bmMoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5zeW5jUHJvbWlzZSkge1xuXHRcdFx0XHR0aGlzLnN5bmNQcm9taXNlLmNhbmNlbCgpO1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnW0F1dG9TeW5jXSBDYW5jZWxsZWQgc3luYyB0aGF0IGlzIGluIHByb2dyZXNzJyk7XG5cdFx0XHRcdHRoaXMuc3luY1Byb21pc2UgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnN5bmNUYXNrPy5zdG9wKCk7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnW0F1dG9TeW5jXSBTdG9wcGVkJyk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuc3luYyhBdXRvU3luYy5JTlRFUlZBTF9TWU5DSU5HLCBmYWxzZSk7XG5cdH1cblxuXHRwcml2YXRlIHdhaXRVbnRpbE5leHRJbnRlcnZhbEFuZFN5bmMoKTogdm9pZCB7XG5cdFx0dGhpcy5pbnRlcnZhbEhhbmRsZXIudmFsdWUgPSBkaXNwb3NhYmxlVGltZW91dCgoKSA9PiB7XG5cdFx0XHR0aGlzLnN5bmMoQXV0b1N5bmMuSU5URVJWQUxfU1lOQ0lORywgZmFsc2UpO1xuXHRcdFx0dGhpcy5pbnRlcnZhbEhhbmRsZXIudmFsdWUgPSB1bmRlZmluZWQ7XG5cdFx0fSwgdGhpcy5pbnRlcnZhbCk7XG5cdH1cblxuXHRzeW5jKHJlYXNvbjogc3RyaW5nLCBkaXNhYmxlQ2FjaGU6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBzeW5jUHJvbWlzZSA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKGFzeW5jIHRva2VuID0+IHtcblx0XHRcdGlmICh0aGlzLnN5bmNQcm9taXNlKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Ly8gV2FpdCB1bnRpbCBleGlzdGluZyBzeW5jIGlzIGZpbmlzaGVkXG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmRlYnVnKCdbQXV0b1N5bmNdIFdhaXRpbmcgdW50aWwgc3luYyBpcyBmaW5pc2hlZC4nKTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnN5bmNQcm9taXNlO1xuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdGlmIChpc0NhbmNlbGxhdGlvbkVycm9yKGVycm9yKSkge1xuXHRcdFx0XHRcdFx0Ly8gQ2FuY2VsbGVkID0+IERpc3Bvc2VkLiBEb25vdCBjb250aW51ZSBzeW5jLlxuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRoaXMuZG9TeW5jKHJlYXNvbiwgZGlzYWJsZUNhY2hlLCB0b2tlbik7XG5cdFx0fSk7XG5cdFx0dGhpcy5zeW5jUHJvbWlzZSA9IHN5bmNQcm9taXNlO1xuXHRcdHRoaXMuc3luY1Byb21pc2UuZmluYWxseSgoKSA9PiB0aGlzLnN5bmNQcm9taXNlID0gdW5kZWZpbmVkKTtcblx0XHRyZXR1cm4gdGhpcy5zeW5jUHJvbWlzZTtcblx0fVxuXG5cdHByaXZhdGUgaGFzU3luY1NlcnZpY2VDaGFuZ2VkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmxhc3RTeW5jVXJsICE9PSB1bmRlZmluZWQgJiYgIWlzRXF1YWwodGhpcy5sYXN0U3luY1VybCwgdGhpcy51c2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY1N0b3JlPy51cmwpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBoYXNEZWZhdWx0U2VydmljZUNoYW5nZWQoKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0Y29uc3QgcHJldmlvdXMgPSBhd2FpdCB0aGlzLnVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UuZ2V0UHJldmlvdXNVc2VyRGF0YVN5bmNTdG9yZSgpO1xuXHRcdGNvbnN0IGN1cnJlbnQgPSB0aGlzLnVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UudXNlckRhdGFTeW5jU3RvcmU7XG5cdFx0Ly8gY2hlY2sgaWYgZGVmYXVsdHMgY2hhbmdlZFxuXHRcdHJldHVybiAhIWN1cnJlbnQgJiYgISFwcmV2aW91cyAmJlxuXHRcdFx0KCFpc0VxdWFsKGN1cnJlbnQuZGVmYXVsdFVybCwgcHJldmlvdXMuZGVmYXVsdFVybCkgfHxcblx0XHRcdFx0IWlzRXF1YWwoY3VycmVudC5pbnNpZGVyc1VybCwgcHJldmlvdXMuaW5zaWRlcnNVcmwpIHx8XG5cdFx0XHRcdCFpc0VxdWFsKGN1cnJlbnQuc3RhYmxlVXJsLCBwcmV2aW91cy5zdGFibGVVcmwpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9TeW5jKHJlYXNvbjogc3RyaW5nLCBkaXNhYmxlQ2FjaGU6IGJvb2xlYW4sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMubG9nU2VydmljZS5pbmZvKGBbQXV0b1N5bmNdIFRyaWdnZXJlZCBieSAke3JlYXNvbn1gKTtcblx0XHR0aGlzLl9vbkRpZFN0YXJ0U3luYy5maXJlKCk7XG5cblx0XHRsZXQgZXJyb3I6IEVycm9yIHwgdW5kZWZpbmVkO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmNyZWF0ZUFuZFJ1blN5bmNUYXNrKGRpc2FibGVDYWNoZSwgdG9rZW4pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlKTtcblx0XHRcdGVycm9yID0gZTtcblx0XHRcdGlmIChVc2VyRGF0YVN5bmNFcnJvci50b1VzZXJEYXRhU3luY0Vycm9yKGUpLmNvZGUgPT09IFVzZXJEYXRhU3luY0Vycm9yQ29kZS5NZXRob2ROb3RGb3VuZCkge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdbQXV0b1N5bmNdIENsaWVudCBpcyBtYWtpbmcgaW52YWxpZCByZXF1ZXN0cy4gQ2xlYW5pbmcgdXAgZGF0YS4uLicpO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMudXNlckRhdGFTeW5jU2VydmljZS5jbGVhblVwUmVtb3RlRGF0YSgpO1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdbQXV0b1N5bmNdIFJldHJ5aW5nIHN5bmMuLi4nKTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmNyZWF0ZUFuZFJ1blN5bmNUYXNrKGRpc2FibGVDYWNoZSwgdG9rZW4pO1xuXHRcdFx0XHRcdGVycm9yID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9IGNhdGNoIChlMSkge1xuXHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlMSk7XG5cdFx0XHRcdFx0ZXJyb3IgPSBlMTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX29uRGlkRmluaXNoU3luYy5maXJlKGVycm9yKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY3JlYXRlQW5kUnVuU3luY1Rhc2soZGlzYWJsZUNhY2hlOiBib29sZWFuLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLnN5bmNUYXNrID0gYXdhaXQgdGhpcy51c2VyRGF0YVN5bmNTZXJ2aWNlLmNyZWF0ZVN5bmNUYXNrKHRoaXMubWFuaWZlc3QsIGRpc2FibGVDYWNoZSk7XG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMubWFuaWZlc3QgPSB0aGlzLnN5bmNUYXNrLm1hbmlmZXN0O1xuXG5cdFx0Ly8gU2VydmVyIGhhcyBubyBkYXRhIGJ1dCB0aGlzIG1hY2hpbmUgd2FzIHN5bmNlZCBiZWZvcmVcblx0XHRpZiAodGhpcy5tYW5pZmVzdCA9PT0gbnVsbCAmJiBhd2FpdCB0aGlzLnVzZXJEYXRhU3luY1NlcnZpY2UuaGFzUHJldmlvdXNseVN5bmNlZCgpKSB7XG5cdFx0XHRpZiAodGhpcy5oYXNTeW5jU2VydmljZUNoYW5nZWQoKSkge1xuXHRcdFx0XHRpZiAoYXdhaXQgdGhpcy5oYXNEZWZhdWx0U2VydmljZUNoYW5nZWQoKSkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBVc2VyRGF0YUF1dG9TeW5jRXJyb3IobG9jYWxpemUoJ2RlZmF1bHQgc2VydmljZSBjaGFuZ2VkJywgXCJDYW5ub3Qgc3luYyBiZWNhdXNlIGRlZmF1bHQgc2VydmljZSBoYXMgY2hhbmdlZFwiKSwgVXNlckRhdGFTeW5jRXJyb3JDb2RlLkRlZmF1bHRTZXJ2aWNlQ2hhbmdlZCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IFVzZXJEYXRhQXV0b1N5bmNFcnJvcihsb2NhbGl6ZSgnc2VydmljZSBjaGFuZ2VkJywgXCJDYW5ub3Qgc3luYyBiZWNhdXNlIHN5bmMgc2VydmljZSBoYXMgY2hhbmdlZFwiKSwgVXNlckRhdGFTeW5jRXJyb3JDb2RlLlNlcnZpY2VDaGFuZ2VkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gU3luYyB3YXMgdHVybmVkIG9mZiBpbiB0aGUgY2xvdWRcblx0XHRcdFx0dGhyb3cgbmV3IFVzZXJEYXRhQXV0b1N5bmNFcnJvcihsb2NhbGl6ZSgndHVybmVkIG9mZicsIFwiQ2Fubm90IHN5bmMgYmVjYXVzZSBzeW5jaW5nIGlzIHR1cm5lZCBvZmYgaW4gdGhlIGNsb3VkXCIpLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUuVHVybmVkT2ZmKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBzZXNzaW9uSWQgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChzZXNzaW9uSWRLZXksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdFx0Ly8gU2VydmVyIHNlc3Npb24gaXMgZGlmZmVyZW50IGZyb20gY2xpZW50IHNlc3Npb25cblx0XHRpZiAoc2Vzc2lvbklkICYmIHRoaXMubWFuaWZlc3QgJiYgc2Vzc2lvbklkICE9PSB0aGlzLm1hbmlmZXN0LnNlc3Npb24pIHtcblx0XHRcdGlmICh0aGlzLmhhc1N5bmNTZXJ2aWNlQ2hhbmdlZCgpKSB7XG5cdFx0XHRcdGlmIChhd2FpdCB0aGlzLmhhc0RlZmF1bHRTZXJ2aWNlQ2hhbmdlZCgpKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IFVzZXJEYXRhQXV0b1N5bmNFcnJvcihsb2NhbGl6ZSgnZGVmYXVsdCBzZXJ2aWNlIGNoYW5nZWQnLCBcIkNhbm5vdCBzeW5jIGJlY2F1c2UgZGVmYXVsdCBzZXJ2aWNlIGhhcyBjaGFuZ2VkXCIpLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUuRGVmYXVsdFNlcnZpY2VDaGFuZ2VkKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgVXNlckRhdGFBdXRvU3luY0Vycm9yKGxvY2FsaXplKCdzZXJ2aWNlIGNoYW5nZWQnLCBcIkNhbm5vdCBzeW5jIGJlY2F1c2Ugc3luYyBzZXJ2aWNlIGhhcyBjaGFuZ2VkXCIpLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUuU2VydmljZUNoYW5nZWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aHJvdyBuZXcgVXNlckRhdGFBdXRvU3luY0Vycm9yKGxvY2FsaXplKCdzZXNzaW9uIGV4cGlyZWQnLCBcIkNhbm5vdCBzeW5jIGJlY2F1c2UgY3VycmVudCBzZXNzaW9uIGlzIGV4cGlyZWRcIiksIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5TZXNzaW9uRXhwaXJlZCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWFjaGluZXMgPSBhd2FpdCB0aGlzLnVzZXJEYXRhU3luY01hY2hpbmVzU2VydmljZS5nZXRNYWNoaW5lcyh0aGlzLm1hbmlmZXN0IHx8IHVuZGVmaW5lZCk7XG5cdFx0Ly8gUmV0dXJuIGlmIGNhbmNlbGxhdGlvbiBpcyByZXF1ZXN0ZWRcblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjdXJyZW50TWFjaGluZSA9IG1hY2hpbmVzLmZpbmQobWFjaGluZSA9PiBtYWNoaW5lLmlzQ3VycmVudCk7XG5cdFx0Ly8gQ2hlY2sgaWYgc3luYyB3YXMgdHVybmVkIG9mZiBmcm9tIG90aGVyIG1hY2hpbmVcblx0XHRpZiAoY3VycmVudE1hY2hpbmU/LmRpc2FibGVkKSB7XG5cdFx0XHQvLyBUaHJvdyBUdXJuZWRPZmYgZXJyb3Jcblx0XHRcdHRocm93IG5ldyBVc2VyRGF0YUF1dG9TeW5jRXJyb3IobG9jYWxpemUoJ3R1cm5lZCBvZmYgbWFjaGluZScsIFwiQ2Fubm90IHN5bmMgYmVjYXVzZSBzeW5jaW5nIGlzIHR1cm5lZCBvZmYgb24gdGhpcyBtYWNoaW5lIGZyb20gYW5vdGhlciBtYWNoaW5lLlwiKSwgVXNlckRhdGFTeW5jRXJyb3JDb2RlLlR1cm5lZE9mZik7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RhcnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG5cdFx0YXdhaXQgdGhpcy5zeW5jVGFzay5ydW4oKTtcblx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjx7XG5cdFx0XHRkdXJhdGlvbjogbnVtYmVyO1xuXHRcdH0sIHtcblx0XHRcdG93bmVyOiAnc2FuZHkwODEnO1xuXHRcdFx0Y29tbWVudDogJ1JlcG9ydCB3aGVuIHJ1bm5pbmcgYSBzeW5jIG9wZXJhdGlvbic7XG5cdFx0XHRkdXJhdGlvbjogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RpbWUgdGFrZW4gdG8gcnVuIHN5bmMgb3BlcmF0aW9uJyB9O1xuXHRcdH0+KCdzZXR0aW5nc1N5bmM6c3luYycsIHsgZHVyYXRpb246IG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gc3RhcnRUaW1lIH0pO1xuXG5cdFx0Ly8gQWZ0ZXIgc3luY2luZywgZ2V0IHRoZSBtYW5pZmVzdCBpZiBpdCB3YXMgbm90IGF2YWlsYWJsZSBiZWZvcmVcblx0XHRpZiAodGhpcy5tYW5pZmVzdCA9PT0gbnVsbCkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhpcy5tYW5pZmVzdCA9IGF3YWl0IHRoaXMudXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLm1hbmlmZXN0KG51bGwpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhyb3cgbmV3IFVzZXJEYXRhQXV0b1N5bmNFcnJvcih0b0Vycm9yTWVzc2FnZShlcnJvciksIGVycm9yIGluc3RhbmNlb2YgVXNlckRhdGFTeW5jRXJyb3IgPyBlcnJvci5jb2RlIDogVXNlckRhdGFTeW5jRXJyb3JDb2RlLlVua25vd24pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFVwZGF0ZSBsb2NhbCBzZXNzaW9uIGlkXG5cdFx0aWYgKHRoaXMubWFuaWZlc3QgJiYgdGhpcy5tYW5pZmVzdC5zZXNzaW9uICE9PSBzZXNzaW9uSWQpIHtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoc2Vzc2lvbklkS2V5LCB0aGlzLm1hbmlmZXN0LnNlc3Npb24sIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHR9XG5cblx0XHQvLyBSZXR1cm4gaWYgY2FuY2VsbGF0aW9uIGlzIHJlcXVlc3RlZFxuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIEFkZCBjdXJyZW50IG1hY2hpbmVcblx0XHRpZiAoIWN1cnJlbnRNYWNoaW5lKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnVzZXJEYXRhU3luY01hY2hpbmVzU2VydmljZS5hZGRDdXJyZW50TWFjaGluZSh0aGlzLm1hbmlmZXN0IHx8IHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0cmVnaXN0ZXI8VCBleHRlbmRzIElEaXNwb3NhYmxlPih0OiBUKTogVCB7XG5cdFx0cmV0dXJuIHN1cGVyLl9yZWdpc3Rlcih0KTtcblx0fVxuXG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQTRCLHlCQUF5QixtQkFBbUIsa0JBQWtCLGVBQWU7QUFFekcsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxZQUF5QixtQkFBbUIsb0JBQW9CO0FBQ3pFLFNBQVMsYUFBYTtBQUN0QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMseUJBQXlCO0FBQ2xDLFNBQXlFLHlC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
