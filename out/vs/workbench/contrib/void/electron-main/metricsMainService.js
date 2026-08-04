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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { isLinux, isMacintosh, isWindows } from "../../../../base/common/platform.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { IEnvironmentMainService } from "../../../../platform/environment/electron-main/environmentMainService.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { StorageTarget, StorageScope } from "../../../../platform/storage/common/storage.js";
import { IApplicationStorageMainService } from "../../../../platform/storage/electron-main/storageMainService.js";
import { PostHog } from "posthog-node";
import { OPT_OUT_KEY } from "../common/storageKeys.js";
const os = isWindows ? "windows" : isMacintosh ? "mac" : isLinux ? "linux" : null;
const _getOSInfo = () => {
  try {
    const { platform, arch } = process;
    return { platform, arch };
  } catch (e) {
    return { osInfo: { platform: "??", arch: "??" } };
  }
};
const osInfo = _getOSInfo();
let MetricsMainService = class extends Disposable {
  constructor(_productService, _envMainService, _appStorage) {
    super();
    this._productService = _productService;
    this._envMainService = _envMainService;
    this._appStorage = _appStorage;
    this._initProperties = {};
    this.capture = (event, params) => {
      const capture = { distinctId: this.distinctId, event, properties: params };
      this.client.capture(capture);
    };
    this.setOptOut = (newVal) => {
      if (newVal) {
        this._appStorage.store(OPT_OUT_KEY, "true", StorageScope.APPLICATION, StorageTarget.MACHINE);
      } else {
        this._appStorage.remove(OPT_OUT_KEY, StorageScope.APPLICATION);
      }
    };
    this.client = new PostHog("phc_UanIdujHiLp55BkUTjB1AuBXcasVkdqRwgnwRlWESH2", {
      host: "https://us.i.posthog.com"
    });
    this.initialize();
  }
  // helper - looks like this is stored in a .vscdb file in ~/Library/Application Support/Void
  _memoStorage(key, target, setValIfNotExist) {
    const currVal = this._appStorage.get(key, StorageScope.APPLICATION);
    if (currVal !== void 0) return currVal;
    const newVal = setValIfNotExist ?? generateUuid();
    this._appStorage.store(key, newVal, StorageScope.APPLICATION, target);
    return newVal;
  }
  // this is old, eventually we can just delete this since all the keys will have been transferred over
  // returns 'NULL' or the old key
  get oldId() {
    const newKey = "void.app.oldMachineId";
    const newOldId = this._appStorage.get(newKey, StorageScope.APPLICATION);
    if (newOldId) return newOldId;
    const oldValue = this._appStorage.get("void.machineId", StorageScope.APPLICATION) ?? "NULL";
    this._appStorage.store(newKey, oldValue, StorageScope.APPLICATION, StorageTarget.MACHINE);
    return oldValue;
  }
  // the main id
  get distinctId() {
    const oldId = this.oldId;
    const setValIfNotExist = oldId === "NULL" ? void 0 : oldId;
    return this._memoStorage("void.app.machineId", StorageTarget.MACHINE, setValIfNotExist);
  }
  // just to see if there are ever multiple machineIDs per userID (instead of this, we should just track by the user's email)
  get userId() {
    return this._memoStorage("void.app.userMachineId", StorageTarget.USER);
  }
  async initialize() {
    await this._appStorage.whenReady;
    const { commit, version, voidVersion, release, quality } = this._productService;
    const isDevMode = !this._envMainService.isBuilt;
    this._initProperties = {
      commit,
      vscodeVersion: version,
      voidVersion,
      release,
      os,
      quality,
      distinctId: this.distinctId,
      distinctIdUser: this.userId,
      oldId: this.oldId,
      isDevMode,
      ...osInfo
    };
    const identifyMessage = {
      distinctId: this.distinctId,
      properties: this._initProperties
    };
    const didOptOut = this._appStorage.getBoolean(OPT_OUT_KEY, StorageScope.APPLICATION, false);
    console.log("User is opted out of basic Void metrics?", didOptOut);
    if (didOptOut) {
      this.client.optOut();
    } else {
      this.client.optIn();
      this.client.identify(identifyMessage);
    }
    console.log("Void posthog metrics info:", JSON.stringify(identifyMessage, null, 2));
  }
  async getDebuggingProperties() {
    return this._initProperties;
  }
};
MetricsMainService = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IEnvironmentMainService),
  __decorateParam(2, IApplicationStorageMainService)
], MetricsMainService);
export {
  MetricsMainService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2VsZWN0cm9uLW1haW4vbWV0cmljc01haW5TZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IDIwMjUgR2xhc3MgRGV2dG9vbHMsIEluYy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wLiBTZWUgTElDRU5TRS50eHQgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc0xpbnV4LCBpc01hY2ludG9zaCwgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRNYWluU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2Vudmlyb25tZW50L2VsZWN0cm9uLW1haW4vZW52aXJvbm1lbnRNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBTdG9yYWdlVGFyZ2V0LCBTdG9yYWdlU2NvcGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElBcHBsaWNhdGlvblN0b3JhZ2VNYWluU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvZWxlY3Ryb24tbWFpbi9zdG9yYWdlTWFpblNlcnZpY2UuanMnO1xuXG5pbXBvcnQgeyBJTWV0cmljc1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbWV0cmljc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgUG9zdEhvZyB9IGZyb20gJ3Bvc3Rob2ctbm9kZSdcbmltcG9ydCB7IE9QVF9PVVRfS0VZIH0gZnJvbSAnLi4vY29tbW9uL3N0b3JhZ2VLZXlzLmpzJztcblxuXG5jb25zdCBvcyA9IGlzV2luZG93cyA/ICd3aW5kb3dzJyA6IGlzTWFjaW50b3NoID8gJ21hYycgOiBpc0xpbnV4ID8gJ2xpbnV4JyA6IG51bGxcbmNvbnN0IF9nZXRPU0luZm8gPSAoKSA9PiB7XG5cdHRyeSB7XG5cdFx0Y29uc3QgeyBwbGF0Zm9ybSwgYXJjaCB9ID0gcHJvY2VzcyAvLyBzZWUgcGxhdGZvcm0udHNcblx0XHRyZXR1cm4geyBwbGF0Zm9ybSwgYXJjaCB9XG5cdH1cblx0Y2F0Y2ggKGUpIHtcblx0XHRyZXR1cm4geyBvc0luZm86IHsgcGxhdGZvcm06ICc/PycsIGFyY2g6ICc/PycgfSB9XG5cdH1cbn1cbmNvbnN0IG9zSW5mbyA9IF9nZXRPU0luZm8oKVxuXG4vLyB3ZSdkIGxpa2UgdG8gdXNlIGRldkRldmljZUlkIG9uIHRlbGVtZXRyeVNlcnZpY2UsIGJ1dCB0aGF0IGdldHMgc2FuaXRpemVkIGJ5IHRoZSB0aW1lIGl0IGdldHMgaGVyZSBhcyAnc29tZVZhbHVlLmRldkRldmljZUlkJ1xuXG5cblxuZXhwb3J0IGNsYXNzIE1ldHJpY3NNYWluU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJTWV0cmljc1NlcnZpY2Uge1xuXHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBjbGllbnQ6IFBvc3RIb2dcblxuXHRwcml2YXRlIF9pbml0UHJvcGVydGllczogb2JqZWN0ID0ge31cblxuXG5cdC8vIGhlbHBlciAtIGxvb2tzIGxpa2UgdGhpcyBpcyBzdG9yZWQgaW4gYSAudnNjZGIgZmlsZSBpbiB+L0xpYnJhcnkvQXBwbGljYXRpb24gU3VwcG9ydC9Wb2lkXG5cdHByaXZhdGUgX21lbW9TdG9yYWdlKGtleTogc3RyaW5nLCB0YXJnZXQ6IFN0b3JhZ2VUYXJnZXQsIHNldFZhbElmTm90RXhpc3Q/OiBzdHJpbmcpIHtcblx0XHRjb25zdCBjdXJyVmFsID0gdGhpcy5fYXBwU3RvcmFnZS5nZXQoa2V5LCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pXG5cdFx0aWYgKGN1cnJWYWwgIT09IHVuZGVmaW5lZCkgcmV0dXJuIGN1cnJWYWxcblx0XHRjb25zdCBuZXdWYWwgPSBzZXRWYWxJZk5vdEV4aXN0ID8/IGdlbmVyYXRlVXVpZCgpXG5cdFx0dGhpcy5fYXBwU3RvcmFnZS5zdG9yZShrZXksIG5ld1ZhbCwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCB0YXJnZXQpXG5cdFx0cmV0dXJuIG5ld1ZhbFxuXHR9XG5cblxuXHQvLyB0aGlzIGlzIG9sZCwgZXZlbnR1YWxseSB3ZSBjYW4ganVzdCBkZWxldGUgdGhpcyBzaW5jZSBhbGwgdGhlIGtleXMgd2lsbCBoYXZlIGJlZW4gdHJhbnNmZXJyZWQgb3ZlclxuXHQvLyByZXR1cm5zICdOVUxMJyBvciB0aGUgb2xkIGtleVxuXHRwcml2YXRlIGdldCBvbGRJZCgpIHtcblx0XHQvLyBjaGVjayBuZXcgc3RvcmFnZSBrZXkgZmlyc3Rcblx0XHRjb25zdCBuZXdLZXkgPSAndm9pZC5hcHAub2xkTWFjaGluZUlkJ1xuXHRcdGNvbnN0IG5ld09sZElkID0gdGhpcy5fYXBwU3RvcmFnZS5nZXQobmV3S2V5LCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pXG5cdFx0aWYgKG5ld09sZElkKSByZXR1cm4gbmV3T2xkSWRcblxuXHRcdC8vIHB1dCBvbGQga2V5IGludG8gbmV3IGtleSBpZiBkaWRuJ3QgYWxyZWFkeVxuXHRcdGNvbnN0IG9sZFZhbHVlID0gdGhpcy5fYXBwU3RvcmFnZS5nZXQoJ3ZvaWQubWFjaGluZUlkJywgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKSA/PyAnTlVMTCcgLy8gdGhlIG9sZCB3YXkgb2YgZ2V0dGluZyB0aGUga2V5XG5cdFx0dGhpcy5fYXBwU3RvcmFnZS5zdG9yZShuZXdLZXksIG9sZFZhbHVlLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuTUFDSElORSlcblx0XHRyZXR1cm4gb2xkVmFsdWVcblxuXHRcdC8vIGluIGEgZmV3IHdlZWtzIHdlIGNhbiByZXBsYWNlIGFib3ZlIHdpdGggdGhpc1xuXHRcdC8vIHByaXZhdGUgZ2V0IG9sZElkKCkge1xuXHRcdC8vIFx0cmV0dXJuIHRoaXMuX21lbW9TdG9yYWdlKCd2b2lkLmFwcC5vbGRNYWNoaW5lSWQnLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUsICdOVUxMJylcblx0XHQvLyB9XG5cdH1cblxuXG5cdC8vIHRoZSBtYWluIGlkXG5cdHByaXZhdGUgZ2V0IGRpc3RpbmN0SWQoKSB7XG5cdFx0Y29uc3Qgb2xkSWQgPSB0aGlzLm9sZElkXG5cdFx0Y29uc3Qgc2V0VmFsSWZOb3RFeGlzdCA9IG9sZElkID09PSAnTlVMTCcgPyB1bmRlZmluZWQgOiBvbGRJZFxuXHRcdHJldHVybiB0aGlzLl9tZW1vU3RvcmFnZSgndm9pZC5hcHAubWFjaGluZUlkJywgU3RvcmFnZVRhcmdldC5NQUNISU5FLCBzZXRWYWxJZk5vdEV4aXN0KVxuXHR9XG5cblx0Ly8ganVzdCB0byBzZWUgaWYgdGhlcmUgYXJlIGV2ZXIgbXVsdGlwbGUgbWFjaGluZUlEcyBwZXIgdXNlcklEIChpbnN0ZWFkIG9mIHRoaXMsIHdlIHNob3VsZCBqdXN0IHRyYWNrIGJ5IHRoZSB1c2VyJ3MgZW1haWwpXG5cdHByaXZhdGUgZ2V0IHVzZXJJZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbWVtb1N0b3JhZ2UoJ3ZvaWQuYXBwLnVzZXJNYWNoaW5lSWQnLCBTdG9yYWdlVGFyZ2V0LlVTRVIpXG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Byb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElFbnZpcm9ubWVudE1haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2Vudk1haW5TZXJ2aWNlOiBJRW52aXJvbm1lbnRNYWluU2VydmljZSxcblx0XHRASUFwcGxpY2F0aW9uU3RvcmFnZU1haW5TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2FwcFN0b3JhZ2U6IElBcHBsaWNhdGlvblN0b3JhZ2VNYWluU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKVxuXHRcdHRoaXMuY2xpZW50ID0gbmV3IFBvc3RIb2coJ3BoY19VYW5JZHVqSGlMcDU1QmtVVGpCMUF1QlhjYXNWa2RxUndnbndSbFdFU0gyJywge1xuXHRcdFx0aG9zdDogJ2h0dHBzOi8vdXMuaS5wb3N0aG9nLmNvbScsXG5cdFx0fSlcblxuXHRcdHRoaXMuaW5pdGlhbGl6ZSgpIC8vIGFzeW5jXG5cdH1cblxuXHRhc3luYyBpbml0aWFsaXplKCkge1xuXHRcdC8vIHZlcnkgaW1wb3J0YW50IHRvIGF3YWl0IHdoZW5SZWFkeSFcblx0XHRhd2FpdCB0aGlzLl9hcHBTdG9yYWdlLndoZW5SZWFkeVxuXG5cdFx0Y29uc3QgeyBjb21taXQsIHZlcnNpb24sIHZvaWRWZXJzaW9uLCByZWxlYXNlLCBxdWFsaXR5IH0gPSB0aGlzLl9wcm9kdWN0U2VydmljZVxuXG5cdFx0Y29uc3QgaXNEZXZNb2RlID0gIXRoaXMuX2Vudk1haW5TZXJ2aWNlLmlzQnVpbHQgLy8gZm91bmQgaW4gYWJzdHJhY3RVcGRhdGVTZXJ2aWNlLnRzXG5cblx0XHQvLyBjdXN0b20gcHJvcGVydGllcyB3ZSBpZGVudGlmeVxuXHRcdHRoaXMuX2luaXRQcm9wZXJ0aWVzID0ge1xuXHRcdFx0Y29tbWl0LFxuXHRcdFx0dnNjb2RlVmVyc2lvbjogdmVyc2lvbixcblx0XHRcdHZvaWRWZXJzaW9uOiB2b2lkVmVyc2lvbixcblx0XHRcdHJlbGVhc2UsXG5cdFx0XHRvcyxcblx0XHRcdHF1YWxpdHksXG5cdFx0XHRkaXN0aW5jdElkOiB0aGlzLmRpc3RpbmN0SWQsXG5cdFx0XHRkaXN0aW5jdElkVXNlcjogdGhpcy51c2VySWQsXG5cdFx0XHRvbGRJZDogdGhpcy5vbGRJZCxcblx0XHRcdGlzRGV2TW9kZSxcblx0XHRcdC4uLm9zSW5mbyxcblx0XHR9XG5cblx0XHRjb25zdCBpZGVudGlmeU1lc3NhZ2UgPSB7XG5cdFx0XHRkaXN0aW5jdElkOiB0aGlzLmRpc3RpbmN0SWQsXG5cdFx0XHRwcm9wZXJ0aWVzOiB0aGlzLl9pbml0UHJvcGVydGllcyxcblx0XHR9XG5cblx0XHRjb25zdCBkaWRPcHRPdXQgPSB0aGlzLl9hcHBTdG9yYWdlLmdldEJvb2xlYW4oT1BUX09VVF9LRVksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgZmFsc2UpXG5cblx0XHRjb25zb2xlLmxvZygnVXNlciBpcyBvcHRlZCBvdXQgb2YgYmFzaWMgVm9pZCBtZXRyaWNzPycsIGRpZE9wdE91dClcblx0XHRpZiAoZGlkT3B0T3V0KSB7XG5cdFx0XHR0aGlzLmNsaWVudC5vcHRPdXQoKVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHRoaXMuY2xpZW50Lm9wdEluKClcblx0XHRcdHRoaXMuY2xpZW50LmlkZW50aWZ5KGlkZW50aWZ5TWVzc2FnZSlcblx0XHR9XG5cblxuXHRcdGNvbnNvbGUubG9nKCdWb2lkIHBvc3Rob2cgbWV0cmljcyBpbmZvOicsIEpTT04uc3RyaW5naWZ5KGlkZW50aWZ5TWVzc2FnZSwgbnVsbCwgMikpXG5cdH1cblxuXG5cdGNhcHR1cmU6IElNZXRyaWNzU2VydmljZVsnY2FwdHVyZSddID0gKGV2ZW50LCBwYXJhbXMpID0+IHtcblx0XHRjb25zdCBjYXB0dXJlID0geyBkaXN0aW5jdElkOiB0aGlzLmRpc3RpbmN0SWQsIGV2ZW50LCBwcm9wZXJ0aWVzOiBwYXJhbXMgfSBhcyBjb25zdFxuXHRcdC8vIGNvbnNvbGUubG9nKCdmdWxsIGNhcHR1cmU6JywgdGhpcy5kaXN0aW5jdElkKVxuXHRcdHRoaXMuY2xpZW50LmNhcHR1cmUoY2FwdHVyZSlcblx0fVxuXG5cdHNldE9wdE91dDogSU1ldHJpY3NTZXJ2aWNlWydzZXRPcHRPdXQnXSA9IChuZXdWYWw6IGJvb2xlYW4pID0+IHtcblx0XHRpZiAobmV3VmFsKSB7XG5cdFx0XHR0aGlzLl9hcHBTdG9yYWdlLnN0b3JlKE9QVF9PVVRfS0VZLCAndHJ1ZScsIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgU3RvcmFnZVRhcmdldC5NQUNISU5FKVxuXHRcdH1cblx0XHRlbHNlIHtcblx0XHRcdHRoaXMuX2FwcFN0b3JhZ2UucmVtb3ZlKE9QVF9PVVRfS0VZLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pXG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZ2V0RGVidWdnaW5nUHJvcGVydGllcygpIHtcblx0XHRyZXR1cm4gdGhpcy5faW5pdFByb3BlcnRpZXNcblx0fVxufVxuXG5cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxTQUFTLGFBQWEsaUJBQWlCO0FBQ2hELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZUFBZSxvQkFBb0I7QUFDNUMsU0FBUyxzQ0FBc0M7QUFHL0MsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsbUJBQW1CO0FBRzVCLE1BQU0sS0FBSyxZQUFZLFlBQVksY0FBYyxRQUFRLFVBQVUsVUFBVTtBQUM3RSxNQUFNLGFBQWEsTUFBTTtBQUN4QixNQUFJO0FBQ0gsVUFBTSxFQUFFLFVBQVUsS0FBSyxJQUFJO0FBQzNCLFdBQU8sRUFBRSxVQUFVLEtBQUs7QUFBQSxFQUN6QixTQUNPLEdBQUc7QUFDVCxXQUFPLEVBQUUsUUFBUSxFQUFFLFVBQVUsTUFBTSxNQUFNLEtBQUssRUFBRTtBQUFBLEVBQ2pEO0FBQ0Q7QUFDQSxNQUFNLFNBQVMsV0FBVztBQU1uQixJQUFNLHFCQUFOLGNBQWlDLFdBQXNDO0FBQUEsRUFrRDdFLFlBQ21DLGlCQUNRLGlCQUNPLGFBQ2hEO0FBQ0QsVUFBTTtBQUo0QjtBQUNRO0FBQ087QUFoRGxELFNBQVEsa0JBQTBCLENBQUM7QUFzR25DLG1CQUFzQyxDQUFDLE9BQU8sV0FBVztBQUN4RCxZQUFNLFVBQVUsRUFBRSxZQUFZLEtBQUssWUFBWSxPQUFPLFlBQVksT0FBTztBQUV6RSxXQUFLLE9BQU8sUUFBUSxPQUFPO0FBQUEsSUFDNUI7QUFFQSxxQkFBMEMsQ0FBQyxXQUFvQjtBQUM5RCxVQUFJLFFBQVE7QUFDWCxhQUFLLFlBQVksTUFBTSxhQUFhLFFBQVEsYUFBYSxhQUFhLGNBQWMsT0FBTztBQUFBLE1BQzVGLE9BQ0s7QUFDSixhQUFLLFlBQVksT0FBTyxhQUFhLGFBQWEsV0FBVztBQUFBLE1BQzlEO0FBQUEsSUFDRDtBQWhFQyxTQUFLLFNBQVMsSUFBSSxRQUFRLG1EQUFtRDtBQUFBLE1BQzVFLE1BQU07QUFBQSxJQUNQLENBQUM7QUFFRCxTQUFLLFdBQVc7QUFBQSxFQUNqQjtBQUFBO0FBQUEsRUFwRFEsYUFBYSxLQUFhLFFBQXVCLGtCQUEyQjtBQUNuRixVQUFNLFVBQVUsS0FBSyxZQUFZLElBQUksS0FBSyxhQUFhLFdBQVc7QUFDbEUsUUFBSSxZQUFZLE9BQVcsUUFBTztBQUNsQyxVQUFNLFNBQVMsb0JBQW9CLGFBQWE7QUFDaEQsU0FBSyxZQUFZLE1BQU0sS0FBSyxRQUFRLGFBQWEsYUFBYSxNQUFNO0FBQ3BFLFdBQU87QUFBQSxFQUNSO0FBQUE7QUFBQTtBQUFBLEVBS0EsSUFBWSxRQUFRO0FBRW5CLFVBQU0sU0FBUztBQUNmLFVBQU0sV0FBVyxLQUFLLFlBQVksSUFBSSxRQUFRLGFBQWEsV0FBVztBQUN0RSxRQUFJLFNBQVUsUUFBTztBQUdyQixVQUFNLFdBQVcsS0FBSyxZQUFZLElBQUksa0JBQWtCLGFBQWEsV0FBVyxLQUFLO0FBQ3JGLFNBQUssWUFBWSxNQUFNLFFBQVEsVUFBVSxhQUFhLGFBQWEsY0FBYyxPQUFPO0FBQ3hGLFdBQU87QUFBQSxFQU1SO0FBQUE7QUFBQSxFQUlBLElBQVksYUFBYTtBQUN4QixVQUFNLFFBQVEsS0FBSztBQUNuQixVQUFNLG1CQUFtQixVQUFVLFNBQVMsU0FBWTtBQUN4RCxXQUFPLEtBQUssYUFBYSxzQkFBc0IsY0FBYyxTQUFTLGdCQUFnQjtBQUFBLEVBQ3ZGO0FBQUE7QUFBQSxFQUdBLElBQVksU0FBUztBQUNwQixXQUFPLEtBQUssYUFBYSwwQkFBMEIsY0FBYyxJQUFJO0FBQUEsRUFDdEU7QUFBQSxFQWVBLE1BQU0sYUFBYTtBQUVsQixVQUFNLEtBQUssWUFBWTtBQUV2QixVQUFNLEVBQUUsUUFBUSxTQUFTLGFBQWEsU0FBUyxRQUFRLElBQUksS0FBSztBQUVoRSxVQUFNLFlBQVksQ0FBQyxLQUFLLGdCQUFnQjtBQUd4QyxTQUFLLGtCQUFrQjtBQUFBLE1BQ3RCO0FBQUEsTUFDQSxlQUFlO0FBQUEsTUFDZjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EsWUFBWSxLQUFLO0FBQUEsTUFDakIsZ0JBQWdCLEtBQUs7QUFBQSxNQUNyQixPQUFPLEtBQUs7QUFBQSxNQUNaO0FBQUEsTUFDQSxHQUFHO0FBQUEsSUFDSjtBQUVBLFVBQU0sa0JBQWtCO0FBQUEsTUFDdkIsWUFBWSxLQUFLO0FBQUEsTUFDakIsWUFBWSxLQUFLO0FBQUEsSUFDbEI7QUFFQSxVQUFNLFlBQVksS0FBSyxZQUFZLFdBQVcsYUFBYSxhQUFhLGFBQWEsS0FBSztBQUUxRixZQUFRLElBQUksNENBQTRDLFNBQVM7QUFDakUsUUFBSSxXQUFXO0FBQ2QsV0FBSyxPQUFPLE9BQU87QUFBQSxJQUNwQixPQUNLO0FBQ0osV0FBSyxPQUFPLE1BQU07QUFDbEIsV0FBSyxPQUFPLFNBQVMsZUFBZTtBQUFBLElBQ3JDO0FBR0EsWUFBUSxJQUFJLDhCQUE4QixLQUFLLFVBQVUsaUJBQWlCLE1BQU0sQ0FBQyxDQUFDO0FBQUEsRUFDbkY7QUFBQSxFQWtCQSxNQUFNLHlCQUF5QjtBQUM5QixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQ0Q7QUE3SGEscUJBQU47QUFBQSxFQW1ESjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FyRFU7IiwKICAibmFtZXMiOiBbXQp9Cg==
