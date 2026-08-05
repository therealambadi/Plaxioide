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
import { createCancelablePromise, timeout } from "../../../base/common/async.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { getErrorMessage, isCancellationError } from "../../../base/common/errors.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { Mimes } from "../../../base/common/mime.js";
import { isWeb } from "../../../base/common/platform.js";
import { joinPath, relativePath } from "../../../base/common/resources.js";
import { isObject, isString } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IEnvironmentService } from "../../environment/common/environment.js";
import { IFileService } from "../../files/common/files.js";
import { IProductService } from "../../product/common/productService.js";
import { asJson, asText, asTextOrError, hasNoContent, IRequestService, isSuccess, isSuccess as isSuccessContext } from "../../request/common/request.js";
import { getServiceMachineId } from "../../externalServices/common/serviceMachineId.js";
import { IStorageService, StorageScope, StorageTarget } from "../../storage/common/storage.js";
import { HEADER_EXECUTION_ID, HEADER_OPERATION_ID, IUserDataSyncLogService, IUserDataSyncStoreManagementService, SYNC_SERVICE_URL_TYPE, UserDataSyncErrorCode, UserDataSyncStoreError } from "./userDataSync.js";
const CONFIGURATION_SYNC_STORE_KEY = "configurationSync.store";
const SYNC_PREVIOUS_STORE = "sync.previous.store";
const DONOT_MAKE_REQUESTS_UNTIL_KEY = "sync.donot-make-requests-until";
const USER_SESSION_ID_KEY = "sync.user-session-id";
const MACHINE_SESSION_ID_KEY = "sync.machine-session-id";
const REQUEST_SESSION_LIMIT = 100;
const REQUEST_SESSION_INTERVAL = 1e3 * 60 * 5;
let AbstractUserDataSyncStoreManagementService = class extends Disposable {
  constructor(productService, configurationService, storageService) {
    super();
    this.productService = productService;
    this.configurationService = configurationService;
    this.storageService = storageService;
    this._onDidChangeUserDataSyncStore = this._register(new Emitter());
    this.onDidChangeUserDataSyncStore = this._onDidChangeUserDataSyncStore.event;
    this.updateUserDataSyncStore();
    const disposable = this._register(new DisposableStore());
    this._register(Event.filter(storageService.onDidChangeValue(StorageScope.APPLICATION, SYNC_SERVICE_URL_TYPE, disposable), () => this.userDataSyncStoreType !== this.userDataSyncStore?.type, disposable)(() => this.updateUserDataSyncStore()));
  }
  get userDataSyncStore() {
    return this._userDataSyncStore;
  }
  get userDataSyncStoreType() {
    return this.storageService.get(SYNC_SERVICE_URL_TYPE, StorageScope.APPLICATION);
  }
  set userDataSyncStoreType(type) {
    this.storageService.store(SYNC_SERVICE_URL_TYPE, type, StorageScope.APPLICATION, isWeb ? StorageTarget.USER : StorageTarget.MACHINE);
  }
  updateUserDataSyncStore() {
    this._userDataSyncStore = this.toUserDataSyncStore(this.productService[CONFIGURATION_SYNC_STORE_KEY]);
    this._onDidChangeUserDataSyncStore.fire();
  }
  toUserDataSyncStore(configurationSyncStore) {
    if (!configurationSyncStore) {
      return void 0;
    }
    configurationSyncStore = isWeb && configurationSyncStore.web ? { ...configurationSyncStore, ...configurationSyncStore.web } : configurationSyncStore;
    if (isString(configurationSyncStore.url) && isObject(configurationSyncStore.authenticationProviders) && Object.keys(configurationSyncStore.authenticationProviders).every((authenticationProviderId) => Array.isArray(configurationSyncStore.authenticationProviders[authenticationProviderId].scopes))) {
      const syncStore = configurationSyncStore;
      const canSwitch = !!syncStore.canSwitch;
      const defaultType = syncStore.url === syncStore.insidersUrl ? "insiders" : "stable";
      const type = (canSwitch ? this.userDataSyncStoreType : void 0) || defaultType;
      const url = type === "insiders" ? syncStore.insidersUrl : type === "stable" ? syncStore.stableUrl : syncStore.url;
      return {
        url: URI.parse(url),
        type,
        defaultType,
        defaultUrl: URI.parse(syncStore.url),
        stableUrl: URI.parse(syncStore.stableUrl),
        insidersUrl: URI.parse(syncStore.insidersUrl),
        canSwitch,
        authenticationProviders: Object.keys(syncStore.authenticationProviders).reduce((result, id) => {
          result.push({ id, scopes: syncStore.authenticationProviders[id].scopes });
          return result;
        }, [])
      };
    }
    return void 0;
  }
};
AbstractUserDataSyncStoreManagementService = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IStorageService)
], AbstractUserDataSyncStoreManagementService);
let UserDataSyncStoreManagementService = class extends AbstractUserDataSyncStoreManagementService {
  constructor(productService, configurationService, storageService) {
    super(productService, configurationService, storageService);
    const previousConfigurationSyncStore = this.storageService.get(SYNC_PREVIOUS_STORE, StorageScope.APPLICATION);
    if (previousConfigurationSyncStore) {
      this.previousConfigurationSyncStore = JSON.parse(previousConfigurationSyncStore);
    }
    const syncStore = this.productService[CONFIGURATION_SYNC_STORE_KEY];
    if (syncStore) {
      this.storageService.store(SYNC_PREVIOUS_STORE, JSON.stringify(syncStore), StorageScope.APPLICATION, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(SYNC_PREVIOUS_STORE, StorageScope.APPLICATION);
    }
  }
  async switch(type) {
    if (type !== this.userDataSyncStoreType) {
      this.userDataSyncStoreType = type;
      this.updateUserDataSyncStore();
    }
  }
  async getPreviousUserDataSyncStore() {
    return this.toUserDataSyncStore(this.previousConfigurationSyncStore);
  }
};
UserDataSyncStoreManagementService = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, IStorageService)
], UserDataSyncStoreManagementService);
let UserDataSyncStoreClient = class extends Disposable {
  constructor(userDataSyncStoreUrl, productService, requestService, logService, environmentService, fileService, storageService) {
    super();
    this.requestService = requestService;
    this.logService = logService;
    this.storageService = storageService;
    this._onTokenFailed = this._register(new Emitter());
    this.onTokenFailed = this._onTokenFailed.event;
    this._onTokenSucceed = this._register(new Emitter());
    this.onTokenSucceed = this._onTokenSucceed.event;
    this._donotMakeRequestsUntil = void 0;
    this._onDidChangeDonotMakeRequestsUntil = this._register(new Emitter());
    this.onDidChangeDonotMakeRequestsUntil = this._onDidChangeDonotMakeRequestsUntil.event;
    this.resetDonotMakeRequestsUntilPromise = void 0;
    this.updateUserDataSyncStoreUrl(userDataSyncStoreUrl);
    this.commonHeadersPromise = getServiceMachineId(environmentService, fileService, storageService).then((uuid) => {
      const headers = {
        "X-Client-Name": `${productService.applicationName}${isWeb ? "-web" : ""}`,
        "X-Client-Version": productService.version
      };
      if (productService.commit) {
        headers["X-Client-Commit"] = productService.commit;
      }
      return headers;
    });
    this.session = new RequestsSession(REQUEST_SESSION_LIMIT, REQUEST_SESSION_INTERVAL, this.requestService, this.logService);
    this.initDonotMakeRequestsUntil();
    this._register(toDisposable(() => {
      if (this.resetDonotMakeRequestsUntilPromise) {
        this.resetDonotMakeRequestsUntilPromise.cancel();
        this.resetDonotMakeRequestsUntilPromise = void 0;
      }
    }));
  }
  get donotMakeRequestsUntil() {
    return this._donotMakeRequestsUntil;
  }
  setAuthToken(token, type) {
    this.authToken = { token, type };
  }
  updateUserDataSyncStoreUrl(userDataSyncStoreUrl) {
    this.userDataSyncStoreUrl = userDataSyncStoreUrl ? joinPath(userDataSyncStoreUrl, "v1") : void 0;
  }
  initDonotMakeRequestsUntil() {
    const donotMakeRequestsUntil = this.storageService.getNumber(DONOT_MAKE_REQUESTS_UNTIL_KEY, StorageScope.APPLICATION);
    if (donotMakeRequestsUntil && Date.now() < donotMakeRequestsUntil) {
      this.setDonotMakeRequestsUntil(new Date(donotMakeRequestsUntil));
    }
  }
  setDonotMakeRequestsUntil(donotMakeRequestsUntil) {
    if (this._donotMakeRequestsUntil?.getTime() !== donotMakeRequestsUntil?.getTime()) {
      this._donotMakeRequestsUntil = donotMakeRequestsUntil;
      if (this.resetDonotMakeRequestsUntilPromise) {
        this.resetDonotMakeRequestsUntilPromise.cancel();
        this.resetDonotMakeRequestsUntilPromise = void 0;
      }
      if (this._donotMakeRequestsUntil) {
        this.storageService.store(DONOT_MAKE_REQUESTS_UNTIL_KEY, this._donotMakeRequestsUntil.getTime(), StorageScope.APPLICATION, StorageTarget.MACHINE);
        this.resetDonotMakeRequestsUntilPromise = createCancelablePromise((token) => timeout(this._donotMakeRequestsUntil.getTime() - Date.now(), token).then(() => this.setDonotMakeRequestsUntil(void 0)));
        this.resetDonotMakeRequestsUntilPromise.then(
          null,
          (e) => null
          /* ignore error */
        );
      } else {
        this.storageService.remove(DONOT_MAKE_REQUESTS_UNTIL_KEY, StorageScope.APPLICATION);
      }
      this._onDidChangeDonotMakeRequestsUntil.fire();
    }
  }
  // #region Collection
  async getAllCollections(headers = {}) {
    if (!this.userDataSyncStoreUrl) {
      throw new Error("No settings sync store url configured.");
    }
    const url = joinPath(this.userDataSyncStoreUrl, "collection").toString();
    headers = { ...headers };
    headers["Content-Type"] = "application/json";
    const context = await this.request(url, { type: "GET", headers }, [], CancellationToken.None);
    return (await asJson(context))?.map(({ id }) => id) || [];
  }
  async createCollection(headers = {}) {
    if (!this.userDataSyncStoreUrl) {
      throw new Error("No settings sync store url configured.");
    }
    const url = joinPath(this.userDataSyncStoreUrl, "collection").toString();
    headers = { ...headers };
    headers["Content-Type"] = Mimes.text;
    const context = await this.request(url, { type: "POST", headers }, [], CancellationToken.None);
    const collectionId = await asTextOrError(context);
    if (!collectionId) {
      throw new UserDataSyncStoreError("Server did not return the collection id", url, UserDataSyncErrorCode.NoCollection, context.res.statusCode, context.res.headers[HEADER_OPERATION_ID]);
    }
    return collectionId;
  }
  async deleteCollection(collection, headers = {}) {
    if (!this.userDataSyncStoreUrl) {
      throw new Error("No settings sync store url configured.");
    }
    const url = collection ? joinPath(this.userDataSyncStoreUrl, "collection", collection).toString() : joinPath(this.userDataSyncStoreUrl, "collection").toString();
    headers = { ...headers };
    await this.request(url, { type: "DELETE", headers }, [], CancellationToken.None);
  }
  // #endregion
  // #region Resource
  async getAllResourceRefs(resource, collection) {
    if (!this.userDataSyncStoreUrl) {
      throw new Error("No settings sync store url configured.");
    }
    const uri = this.getResourceUrl(this.userDataSyncStoreUrl, collection, resource);
    const headers = {};
    const context = await this.request(uri.toString(), { type: "GET", headers }, [], CancellationToken.None);
    const result = await asJson(context) || [];
    return result.map(({ url, created }) => ({
      ref: relativePath(uri, uri.with({ path: url })),
      created: created * 1e3
      /* Server returns in seconds */
    }));
  }
  async resolveResourceContent(resource, ref, collection, headers = {}) {
    if (!this.userDataSyncStoreUrl) {
      throw new Error("No settings sync store url configured.");
    }
    const url = joinPath(this.getResourceUrl(this.userDataSyncStoreUrl, collection, resource), ref).toString();
    headers = { ...headers };
    headers["Cache-Control"] = "no-cache";
    const context = await this.request(url, { type: "GET", headers }, [], CancellationToken.None);
    const content = await asTextOrError(context);
    return content;
  }
  async deleteResource(resource, ref, collection) {
    if (!this.userDataSyncStoreUrl) {
      throw new Error("No settings sync store url configured.");
    }
    const url = ref !== null ? joinPath(this.getResourceUrl(this.userDataSyncStoreUrl, collection, resource), ref).toString() : this.getResourceUrl(this.userDataSyncStoreUrl, collection, resource).toString();
    const headers = {};
    await this.request(url, { type: "DELETE", headers }, [], CancellationToken.None);
  }
  async deleteResources() {
    if (!this.userDataSyncStoreUrl) {
      throw new Error("No settings sync store url configured.");
    }
    const url = joinPath(this.userDataSyncStoreUrl, "resource").toString();
    const headers = { "Content-Type": Mimes.text };
    await this.request(url, { type: "DELETE", headers }, [], CancellationToken.None);
  }
  async readResource(resource, oldValue, collection, headers = {}) {
    if (!this.userDataSyncStoreUrl) {
      throw new Error("No settings sync store url configured.");
    }
    const url = joinPath(this.getResourceUrl(this.userDataSyncStoreUrl, collection, resource), "latest").toString();
    headers = { ...headers };
    headers["Cache-Control"] = "no-cache";
    if (oldValue) {
      headers["If-None-Match"] = oldValue.ref;
    }
    const context = await this.request(url, { type: "GET", headers }, [304], CancellationToken.None);
    let userData = null;
    if (context.res.statusCode === 304) {
      userData = oldValue;
    }
    if (userData === null) {
      const ref = context.res.headers["etag"];
      if (!ref) {
        throw new UserDataSyncStoreError("Server did not return the ref", url, UserDataSyncErrorCode.NoRef, context.res.statusCode, context.res.headers[HEADER_OPERATION_ID]);
      }
      const content = await asTextOrError(context);
      if (!content && context.res.statusCode === 304) {
        throw new UserDataSyncStoreError("Empty response", url, UserDataSyncErrorCode.EmptyResponse, context.res.statusCode, context.res.headers[HEADER_OPERATION_ID]);
      }
      userData = { ref, content };
    }
    return userData;
  }
  async writeResource(resource, data, ref, collection, headers = {}) {
    if (!this.userDataSyncStoreUrl) {
      throw new Error("No settings sync store url configured.");
    }
    const url = this.getResourceUrl(this.userDataSyncStoreUrl, collection, resource).toString();
    headers = { ...headers };
    headers["Content-Type"] = Mimes.text;
    if (ref) {
      headers["If-Match"] = ref;
    }
    const context = await this.request(url, { type: "POST", data, headers }, [], CancellationToken.None);
    const newRef = context.res.headers["etag"];
    if (!newRef) {
      throw new UserDataSyncStoreError("Server did not return the ref", url, UserDataSyncErrorCode.NoRef, context.res.statusCode, context.res.headers[HEADER_OPERATION_ID]);
    }
    return newRef;
  }
  // #endregion
  async manifest(oldValue, headers = {}) {
    if (!this.userDataSyncStoreUrl) {
      throw new Error("No settings sync store url configured.");
    }
    const url = joinPath(this.userDataSyncStoreUrl, "manifest").toString();
    headers = { ...headers };
    headers["Content-Type"] = "application/json";
    if (oldValue) {
      headers["If-None-Match"] = oldValue.ref;
    }
    const context = await this.request(url, { type: "GET", headers }, [304], CancellationToken.None);
    let manifest = null;
    if (context.res.statusCode === 304) {
      manifest = oldValue;
    }
    if (!manifest) {
      const ref = context.res.headers["etag"];
      if (!ref) {
        throw new UserDataSyncStoreError("Server did not return the ref", url, UserDataSyncErrorCode.NoRef, context.res.statusCode, context.res.headers[HEADER_OPERATION_ID]);
      }
      const content = await asTextOrError(context);
      if (!content && context.res.statusCode === 304) {
        throw new UserDataSyncStoreError("Empty response", url, UserDataSyncErrorCode.EmptyResponse, context.res.statusCode, context.res.headers[HEADER_OPERATION_ID]);
      }
      if (content) {
        manifest = { ...JSON.parse(content), ref };
      }
    }
    const currentSessionId = this.storageService.get(USER_SESSION_ID_KEY, StorageScope.APPLICATION);
    if (currentSessionId && manifest && currentSessionId !== manifest.session) {
      this.clearSession();
    }
    if (manifest === null && currentSessionId) {
      this.clearSession();
    }
    if (manifest) {
      this.storageService.store(USER_SESSION_ID_KEY, manifest.session, StorageScope.APPLICATION, StorageTarget.MACHINE);
    }
    return manifest;
  }
  async clear() {
    if (!this.userDataSyncStoreUrl) {
      throw new Error("No settings sync store url configured.");
    }
    await this.deleteCollection();
    await this.deleteResources();
    this.clearSession();
  }
  async getActivityData() {
    if (!this.userDataSyncStoreUrl) {
      throw new Error("No settings sync store url configured.");
    }
    const url = joinPath(this.userDataSyncStoreUrl, "download").toString();
    const headers = {};
    const context = await this.request(url, { type: "GET", headers }, [], CancellationToken.None);
    if (!isSuccess(context)) {
      throw new UserDataSyncStoreError("Server returned " + context.res.statusCode, url, UserDataSyncErrorCode.EmptyResponse, context.res.statusCode, context.res.headers[HEADER_OPERATION_ID]);
    }
    if (hasNoContent(context)) {
      throw new UserDataSyncStoreError("Empty response", url, UserDataSyncErrorCode.EmptyResponse, context.res.statusCode, context.res.headers[HEADER_OPERATION_ID]);
    }
    return context.stream;
  }
  getResourceUrl(userDataSyncStoreUrl, collection, resource) {
    return collection ? joinPath(userDataSyncStoreUrl, "collection", collection, "resource", resource) : joinPath(userDataSyncStoreUrl, "resource", resource);
  }
  clearSession() {
    this.storageService.remove(USER_SESSION_ID_KEY, StorageScope.APPLICATION);
    this.storageService.remove(MACHINE_SESSION_ID_KEY, StorageScope.APPLICATION);
  }
  async request(url, options, successCodes, token) {
    if (!this.authToken) {
      throw new UserDataSyncStoreError("No Auth Token Available", url, UserDataSyncErrorCode.Unauthorized, void 0, void 0);
    }
    if (this._donotMakeRequestsUntil && Date.now() < this._donotMakeRequestsUntil.getTime()) {
      throw new UserDataSyncStoreError(`${options.type} request '${url}' failed because of too many requests (429).`, url, UserDataSyncErrorCode.TooManyRequestsAndRetryAfter, void 0, void 0);
    }
    this.setDonotMakeRequestsUntil(void 0);
    const commonHeaders = await this.commonHeadersPromise;
    options.headers = {
      ...options.headers || {},
      ...commonHeaders,
      "X-Account-Type": this.authToken.type,
      "authorization": `Bearer ${this.authToken.token}`
    };
    this.addSessionHeaders(options.headers);
    this.logService.trace("Sending request to server", { url, type: options.type, headers: { ...options.headers, ...{ authorization: void 0 } } });
    let context;
    try {
      context = await this.session.request(url, options, token);
    } catch (e) {
      if (!(e instanceof UserDataSyncStoreError)) {
        let code = UserDataSyncErrorCode.RequestFailed;
        const errorMessage = getErrorMessage(e).toLowerCase();
        if (errorMessage.includes("xhr timeout")) {
          code = UserDataSyncErrorCode.RequestTimeout;
        } else if (errorMessage.includes("protocol") && errorMessage.includes("not supported")) {
          code = UserDataSyncErrorCode.RequestProtocolNotSupported;
        } else if (errorMessage.includes("request path contains unescaped characters")) {
          code = UserDataSyncErrorCode.RequestPathNotEscaped;
        } else if (errorMessage.includes("headers must be an object")) {
          code = UserDataSyncErrorCode.RequestHeadersNotObject;
        } else if (isCancellationError(e)) {
          code = UserDataSyncErrorCode.RequestCanceled;
        }
        e = new UserDataSyncStoreError(`Connection refused for the request '${url}'.`, url, code, void 0, void 0);
      }
      this.logService.info("Request failed", url);
      throw e;
    }
    const operationId = context.res.headers[HEADER_OPERATION_ID];
    const requestInfo = { url, status: context.res.statusCode, "execution-id": options.headers[HEADER_EXECUTION_ID], "operation-id": operationId };
    const isSuccess2 = isSuccessContext(context) || context.res.statusCode && successCodes.includes(context.res.statusCode);
    let failureMessage = "";
    if (isSuccess2) {
      this.logService.trace("Request succeeded", requestInfo);
    } else {
      failureMessage = await asText(context) || "";
      this.logService.info("Request failed", requestInfo, failureMessage);
    }
    if (context.res.statusCode === 401 || context.res.statusCode === 403) {
      this.authToken = void 0;
      if (context.res.statusCode === 401) {
        this._onTokenFailed.fire(UserDataSyncErrorCode.Unauthorized);
        throw new UserDataSyncStoreError(`${options.type} request '${url}' failed because of Unauthorized (401).`, url, UserDataSyncErrorCode.Unauthorized, context.res.statusCode, operationId);
      }
      if (context.res.statusCode === 403) {
        this._onTokenFailed.fire(UserDataSyncErrorCode.Forbidden);
        throw new UserDataSyncStoreError(`${options.type} request '${url}' failed because the access is forbidden (403).`, url, UserDataSyncErrorCode.Forbidden, context.res.statusCode, operationId);
      }
    }
    this._onTokenSucceed.fire();
    if (context.res.statusCode === 404) {
      throw new UserDataSyncStoreError(`${options.type} request '${url}' failed because the requested resource is not found (404).`, url, UserDataSyncErrorCode.NotFound, context.res.statusCode, operationId);
    }
    if (context.res.statusCode === 405) {
      throw new UserDataSyncStoreError(`${options.type} request '${url}' failed because the requested endpoint is not found (405). ${failureMessage}`, url, UserDataSyncErrorCode.MethodNotFound, context.res.statusCode, operationId);
    }
    if (context.res.statusCode === 409) {
      throw new UserDataSyncStoreError(`${options.type} request '${url}' failed because of Conflict (409). There is new data for this resource. Make the request again with latest data.`, url, UserDataSyncErrorCode.Conflict, context.res.statusCode, operationId);
    }
    if (context.res.statusCode === 410) {
      throw new UserDataSyncStoreError(`${options.type} request '${url}' failed because the requested resource is not longer available (410).`, url, UserDataSyncErrorCode.Gone, context.res.statusCode, operationId);
    }
    if (context.res.statusCode === 412) {
      throw new UserDataSyncStoreError(`${options.type} request '${url}' failed because of Precondition Failed (412). There is new data for this resource. Make the request again with latest data.`, url, UserDataSyncErrorCode.PreconditionFailed, context.res.statusCode, operationId);
    }
    if (context.res.statusCode === 413) {
      throw new UserDataSyncStoreError(`${options.type} request '${url}' failed because of too large payload (413).`, url, UserDataSyncErrorCode.TooLarge, context.res.statusCode, operationId);
    }
    if (context.res.statusCode === 426) {
      throw new UserDataSyncStoreError(`${options.type} request '${url}' failed with status Upgrade Required (426). Please upgrade the client and try again.`, url, UserDataSyncErrorCode.UpgradeRequired, context.res.statusCode, operationId);
    }
    if (context.res.statusCode === 429) {
      const retryAfter = context.res.headers["retry-after"];
      if (retryAfter) {
        this.setDonotMakeRequestsUntil(new Date(Date.now() + parseInt(retryAfter) * 1e3));
        throw new UserDataSyncStoreError(`${options.type} request '${url}' failed because of too many requests (429).`, url, UserDataSyncErrorCode.TooManyRequestsAndRetryAfter, context.res.statusCode, operationId);
      } else {
        throw new UserDataSyncStoreError(`${options.type} request '${url}' failed because of too many requests (429).`, url, UserDataSyncErrorCode.TooManyRequests, context.res.statusCode, operationId);
      }
    }
    if (!isSuccess2) {
      throw new UserDataSyncStoreError("Server returned " + context.res.statusCode, url, UserDataSyncErrorCode.Unknown, context.res.statusCode, operationId);
    }
    return context;
  }
  addSessionHeaders(headers) {
    let machineSessionId = this.storageService.get(MACHINE_SESSION_ID_KEY, StorageScope.APPLICATION);
    if (machineSessionId === void 0) {
      machineSessionId = generateUuid();
      this.storageService.store(MACHINE_SESSION_ID_KEY, machineSessionId, StorageScope.APPLICATION, StorageTarget.MACHINE);
    }
    headers["X-Machine-Session-Id"] = machineSessionId;
    const userSessionId = this.storageService.get(USER_SESSION_ID_KEY, StorageScope.APPLICATION);
    if (userSessionId !== void 0) {
      headers["X-User-Session-Id"] = userSessionId;
    }
  }
};
UserDataSyncStoreClient = __decorateClass([
  __decorateParam(1, IProductService),
  __decorateParam(2, IRequestService),
  __decorateParam(3, IUserDataSyncLogService),
  __decorateParam(4, IEnvironmentService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IStorageService)
], UserDataSyncStoreClient);
let UserDataSyncStoreService = class extends UserDataSyncStoreClient {
  constructor(userDataSyncStoreManagementService, productService, requestService, logService, environmentService, fileService, storageService) {
    super(userDataSyncStoreManagementService.userDataSyncStore?.url, productService, requestService, logService, environmentService, fileService, storageService);
    this._register(userDataSyncStoreManagementService.onDidChangeUserDataSyncStore(() => this.updateUserDataSyncStoreUrl(userDataSyncStoreManagementService.userDataSyncStore?.url)));
  }
};
UserDataSyncStoreService = __decorateClass([
  __decorateParam(0, IUserDataSyncStoreManagementService),
  __decorateParam(1, IProductService),
  __decorateParam(2, IRequestService),
  __decorateParam(3, IUserDataSyncLogService),
  __decorateParam(4, IEnvironmentService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IStorageService)
], UserDataSyncStoreService);
class RequestsSession {
  constructor(limit, interval, requestService, logService) {
    this.limit = limit;
    this.interval = interval;
    this.requestService = requestService;
    this.logService = logService;
    this.requests = [];
    this.startTime = void 0;
  }
  request(url, options, token) {
    if (this.isExpired()) {
      this.reset();
    }
    options.url = url;
    if (this.requests.length >= this.limit) {
      this.logService.info("Too many requests", ...this.requests);
      throw new UserDataSyncStoreError(`Too many requests. Only ${this.limit} requests allowed in ${this.interval / (1e3 * 60)} minutes.`, url, UserDataSyncErrorCode.LocalTooManyRequests, void 0, void 0);
    }
    this.startTime = this.startTime || /* @__PURE__ */ new Date();
    this.requests.push(url);
    return this.requestService.request(options, token);
  }
  isExpired() {
    return this.startTime !== void 0 && (/* @__PURE__ */ new Date()).getTime() - this.startTime.getTime() > this.interval;
  }
  reset() {
    this.requests = [];
    this.startTime = void 0;
  }
}
export {
  AbstractUserDataSyncStoreManagementService,
  RequestsSession,
  UserDataSyncStoreClient,
  UserDataSyncStoreManagementService,
  UserDataSyncStoreService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvY29tbW9uL3VzZXJEYXRhU3luY1N0b3JlU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENhbmNlbGFibGVQcm9taXNlLCBjcmVhdGVDYW5jZWxhYmxlUHJvbWlzZSwgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IGdldEVycm9yTWVzc2FnZSwgaXNDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IE1pbWVzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbWltZS5qcyc7XG5pbXBvcnQgeyBpc1dlYiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25TeW5jU3RvcmUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wcm9kdWN0LmpzJztcbmltcG9ydCB7IGpvaW5QYXRoLCByZWxhdGl2ZVBhdGggfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgaXNPYmplY3QsIGlzU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgSUhlYWRlcnMsIElSZXF1ZXN0Q29udGV4dCwgSVJlcXVlc3RPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9wYXJ0cy9yZXF1ZXN0L2NvbW1vbi9yZXF1ZXN0LmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgYXNKc29uLCBhc1RleHQsIGFzVGV4dE9yRXJyb3IsIGhhc05vQ29udGVudCwgSVJlcXVlc3RTZXJ2aWNlLCBpc1N1Y2Nlc3MsIGlzU3VjY2VzcyBhcyBpc1N1Y2Nlc3NDb250ZXh0IH0gZnJvbSAnLi4vLi4vcmVxdWVzdC9jb21tb24vcmVxdWVzdC5qcyc7XG5pbXBvcnQgeyBnZXRTZXJ2aWNlTWFjaGluZUlkIH0gZnJvbSAnLi4vLi4vZXh0ZXJuYWxTZXJ2aWNlcy9jb21tb24vc2VydmljZU1hY2hpbmVJZC5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSEVBREVSX0VYRUNVVElPTl9JRCwgSEVBREVSX09QRVJBVElPTl9JRCwgSUF1dGhlbnRpY2F0aW9uUHJvdmlkZXIsIElSZXNvdXJjZVJlZkhhbmRsZSwgSVVzZXJEYXRhLCBJVXNlckRhdGFNYW5pZmVzdCwgSVVzZXJEYXRhU3luY0xvZ1NlcnZpY2UsIElVc2VyRGF0YVN5bmNTdG9yZSwgSVVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UsIElVc2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UsIFNlcnZlclJlc291cmNlLCBTWU5DX1NFUlZJQ0VfVVJMX1RZUEUsIFVzZXJEYXRhU3luY0Vycm9yQ29kZSwgVXNlckRhdGFTeW5jU3RvcmVFcnJvciwgVXNlckRhdGFTeW5jU3RvcmVUeXBlIH0gZnJvbSAnLi91c2VyRGF0YVN5bmMuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXJSZWFkYWJsZVN0cmVhbSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5cbmNvbnN0IENPTkZJR1VSQVRJT05fU1lOQ19TVE9SRV9LRVkgPSAnY29uZmlndXJhdGlvblN5bmMuc3RvcmUnO1xuY29uc3QgU1lOQ19QUkVWSU9VU19TVE9SRSA9ICdzeW5jLnByZXZpb3VzLnN0b3JlJztcbmNvbnN0IERPTk9UX01BS0VfUkVRVUVTVFNfVU5USUxfS0VZID0gJ3N5bmMuZG9ub3QtbWFrZS1yZXF1ZXN0cy11bnRpbCc7XG5jb25zdCBVU0VSX1NFU1NJT05fSURfS0VZID0gJ3N5bmMudXNlci1zZXNzaW9uLWlkJztcbmNvbnN0IE1BQ0hJTkVfU0VTU0lPTl9JRF9LRVkgPSAnc3luYy5tYWNoaW5lLXNlc3Npb24taWQnO1xuY29uc3QgUkVRVUVTVF9TRVNTSU9OX0xJTUlUID0gMTAwO1xuY29uc3QgUkVRVUVTVF9TRVNTSU9OX0lOVEVSVkFMID0gMTAwMCAqIDYwICogNTsgLyogNSBtaW51dGVzICovXG5cbnR5cGUgVXNlckRhdGFTeW5jU3RvcmUgPSBJVXNlckRhdGFTeW5jU3RvcmUgJiB7IGRlZmF1bHRUeXBlOiBVc2VyRGF0YVN5bmNTdG9yZVR5cGUgfTtcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0VXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZSB7XG5cblx0X3NlcnZpY2VCcmFuZDogYW55O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlVXNlckRhdGFTeW5jU3RvcmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VVc2VyRGF0YVN5bmNTdG9yZSA9IHRoaXMuX29uRGlkQ2hhbmdlVXNlckRhdGFTeW5jU3RvcmUuZXZlbnQ7XG5cdHByaXZhdGUgX3VzZXJEYXRhU3luY1N0b3JlOiBVc2VyRGF0YVN5bmNTdG9yZSB8IHVuZGVmaW5lZDtcblx0Z2V0IHVzZXJEYXRhU3luY1N0b3JlKCk6IFVzZXJEYXRhU3luY1N0b3JlIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX3VzZXJEYXRhU3luY1N0b3JlOyB9XG5cblx0cHJvdGVjdGVkIGdldCB1c2VyRGF0YVN5bmNTdG9yZVR5cGUoKTogVXNlckRhdGFTeW5jU3RvcmVUeXBlIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoU1lOQ19TRVJWSUNFX1VSTF9UWVBFLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pIGFzIFVzZXJEYXRhU3luY1N0b3JlVHlwZTtcblx0fVxuXHRwcm90ZWN0ZWQgc2V0IHVzZXJEYXRhU3luY1N0b3JlVHlwZSh0eXBlOiBVc2VyRGF0YVN5bmNTdG9yZVR5cGUgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKFNZTkNfU0VSVklDRV9VUkxfVFlQRSwgdHlwZSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBpc1dlYiA/IFN0b3JhZ2VUYXJnZXQuVVNFUiAvKiBzeW5jIGluIHdlYiAqLyA6IFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnVwZGF0ZVVzZXJEYXRhU3luY1N0b3JlKCk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuZmlsdGVyKHN0b3JhZ2VTZXJ2aWNlLm9uRGlkQ2hhbmdlVmFsdWUoU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTWU5DX1NFUlZJQ0VfVVJMX1RZUEUsIGRpc3Bvc2FibGUpLCAoKSA9PiB0aGlzLnVzZXJEYXRhU3luY1N0b3JlVHlwZSAhPT0gdGhpcy51c2VyRGF0YVN5bmNTdG9yZT8udHlwZSwgZGlzcG9zYWJsZSkoKCkgPT4gdGhpcy51cGRhdGVVc2VyRGF0YVN5bmNTdG9yZSgpKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgdXBkYXRlVXNlckRhdGFTeW5jU3RvcmUoKTogdm9pZCB7XG5cdFx0dGhpcy5fdXNlckRhdGFTeW5jU3RvcmUgPSB0aGlzLnRvVXNlckRhdGFTeW5jU3RvcmUodGhpcy5wcm9kdWN0U2VydmljZVtDT05GSUdVUkFUSU9OX1NZTkNfU1RPUkVfS0VZXSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VVc2VyRGF0YVN5bmNTdG9yZS5maXJlKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgdG9Vc2VyRGF0YVN5bmNTdG9yZShjb25maWd1cmF0aW9uU3luY1N0b3JlOiBDb25maWd1cmF0aW9uU3luY1N0b3JlICYgeyB3ZWI/OiBDb25maWd1cmF0aW9uU3luY1N0b3JlIH0gfCB1bmRlZmluZWQpOiBVc2VyRGF0YVN5bmNTdG9yZSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCFjb25maWd1cmF0aW9uU3luY1N0b3JlKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHQvLyBDaGVjayBmb3Igd2ViIG92ZXJyaWRlcyBmb3IgYmFja3dhcmQgY29tcGF0aWJpbGl0eSB3aGlsZSByZWFkaW5nIHByZXZpb3VzIHN0b3JlXG5cdFx0Y29uZmlndXJhdGlvblN5bmNTdG9yZSA9IGlzV2ViICYmIGNvbmZpZ3VyYXRpb25TeW5jU3RvcmUud2ViID8geyAuLi5jb25maWd1cmF0aW9uU3luY1N0b3JlLCAuLi5jb25maWd1cmF0aW9uU3luY1N0b3JlLndlYiB9IDogY29uZmlndXJhdGlvblN5bmNTdG9yZTtcblx0XHRpZiAoaXNTdHJpbmcoY29uZmlndXJhdGlvblN5bmNTdG9yZS51cmwpXG5cdFx0XHQmJiBpc09iamVjdChjb25maWd1cmF0aW9uU3luY1N0b3JlLmF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzKVxuXHRcdFx0JiYgT2JqZWN0LmtleXMoY29uZmlndXJhdGlvblN5bmNTdG9yZS5hdXRoZW50aWNhdGlvblByb3ZpZGVycykuZXZlcnkoYXV0aGVudGljYXRpb25Qcm92aWRlcklkID0+IEFycmF5LmlzQXJyYXkoY29uZmlndXJhdGlvblN5bmNTdG9yZS5hdXRoZW50aWNhdGlvblByb3ZpZGVyc1thdXRoZW50aWNhdGlvblByb3ZpZGVySWRdLnNjb3BlcykpXG5cdFx0KSB7XG5cdFx0XHRjb25zdCBzeW5jU3RvcmUgPSBjb25maWd1cmF0aW9uU3luY1N0b3JlIGFzIENvbmZpZ3VyYXRpb25TeW5jU3RvcmU7XG5cdFx0XHRjb25zdCBjYW5Td2l0Y2ggPSAhIXN5bmNTdG9yZS5jYW5Td2l0Y2g7XG5cdFx0XHRjb25zdCBkZWZhdWx0VHlwZTogVXNlckRhdGFTeW5jU3RvcmVUeXBlID0gc3luY1N0b3JlLnVybCA9PT0gc3luY1N0b3JlLmluc2lkZXJzVXJsID8gJ2luc2lkZXJzJyA6ICdzdGFibGUnO1xuXHRcdFx0Y29uc3QgdHlwZTogVXNlckRhdGFTeW5jU3RvcmVUeXBlID0gKGNhblN3aXRjaCA/IHRoaXMudXNlckRhdGFTeW5jU3RvcmVUeXBlIDogdW5kZWZpbmVkKSB8fCBkZWZhdWx0VHlwZTtcblx0XHRcdGNvbnN0IHVybCA9IHR5cGUgPT09ICdpbnNpZGVycycgPyBzeW5jU3RvcmUuaW5zaWRlcnNVcmxcblx0XHRcdFx0OiB0eXBlID09PSAnc3RhYmxlJyA/IHN5bmNTdG9yZS5zdGFibGVVcmxcblx0XHRcdFx0XHQ6IHN5bmNTdG9yZS51cmw7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR1cmw6IFVSSS5wYXJzZSh1cmwpLFxuXHRcdFx0XHR0eXBlLFxuXHRcdFx0XHRkZWZhdWx0VHlwZSxcblx0XHRcdFx0ZGVmYXVsdFVybDogVVJJLnBhcnNlKHN5bmNTdG9yZS51cmwpLFxuXHRcdFx0XHRzdGFibGVVcmw6IFVSSS5wYXJzZShzeW5jU3RvcmUuc3RhYmxlVXJsKSxcblx0XHRcdFx0aW5zaWRlcnNVcmw6IFVSSS5wYXJzZShzeW5jU3RvcmUuaW5zaWRlcnNVcmwpLFxuXHRcdFx0XHRjYW5Td2l0Y2gsXG5cdFx0XHRcdGF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzOiBPYmplY3Qua2V5cyhzeW5jU3RvcmUuYXV0aGVudGljYXRpb25Qcm92aWRlcnMpLnJlZHVjZTxJQXV0aGVudGljYXRpb25Qcm92aWRlcltdPigocmVzdWx0LCBpZCkgPT4ge1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKHsgaWQsIHNjb3Blczogc3luY1N0b3JlLmF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzW2lkXS5zY29wZXMgfSk7XG5cdFx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdFx0fSwgW10pXG5cdFx0XHR9O1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0YWJzdHJhY3Qgc3dpdGNoKHR5cGU6IFVzZXJEYXRhU3luY1N0b3JlVHlwZSk6IFByb21pc2U8dm9pZD47XG5cdGFic3RyYWN0IGdldFByZXZpb3VzVXNlckRhdGFTeW5jU3RvcmUoKTogUHJvbWlzZTxJVXNlckRhdGFTeW5jU3RvcmUgfCB1bmRlZmluZWQ+O1xuXG59XG5cbmV4cG9ydCBjbGFzcyBVc2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlIGV4dGVuZHMgQWJzdHJhY3RVc2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlIGltcGxlbWVudHMgSVVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2Uge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgcHJldmlvdXNDb25maWd1cmF0aW9uU3luY1N0b3JlOiBDb25maWd1cmF0aW9uU3luY1N0b3JlIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihwcm9kdWN0U2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHByZXZpb3VzQ29uZmlndXJhdGlvblN5bmNTdG9yZSA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KFNZTkNfUFJFVklPVVNfU1RPUkUsIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdFx0aWYgKHByZXZpb3VzQ29uZmlndXJhdGlvblN5bmNTdG9yZSkge1xuXHRcdFx0dGhpcy5wcmV2aW91c0NvbmZpZ3VyYXRpb25TeW5jU3RvcmUgPSBKU09OLnBhcnNlKHByZXZpb3VzQ29uZmlndXJhdGlvblN5bmNTdG9yZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3luY1N0b3JlID0gdGhpcy5wcm9kdWN0U2VydmljZVtDT05GSUdVUkFUSU9OX1NZTkNfU1RPUkVfS0VZXTtcblx0XHRpZiAoc3luY1N0b3JlKSB7XG5cdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKFNZTkNfUFJFVklPVVNfU1RPUkUsIEpTT04uc3RyaW5naWZ5KHN5bmNTdG9yZSksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5yZW1vdmUoU1lOQ19QUkVWSU9VU19TVE9SRSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBzd2l0Y2godHlwZTogVXNlckRhdGFTeW5jU3RvcmVUeXBlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHR5cGUgIT09IHRoaXMudXNlckRhdGFTeW5jU3RvcmVUeXBlKSB7XG5cdFx0XHR0aGlzLnVzZXJEYXRhU3luY1N0b3JlVHlwZSA9IHR5cGU7XG5cdFx0XHR0aGlzLnVwZGF0ZVVzZXJEYXRhU3luY1N0b3JlKCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZ2V0UHJldmlvdXNVc2VyRGF0YVN5bmNTdG9yZSgpOiBQcm9taXNlPElVc2VyRGF0YVN5bmNTdG9yZSB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLnRvVXNlckRhdGFTeW5jU3RvcmUodGhpcy5wcmV2aW91c0NvbmZpZ3VyYXRpb25TeW5jU3RvcmUpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBVc2VyRGF0YVN5bmNTdG9yZUNsaWVudCBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgdXNlckRhdGFTeW5jU3RvcmVVcmw6IFVSSSB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIGF1dGhUb2tlbjogeyB0b2tlbjogc3RyaW5nOyB0eXBlOiBzdHJpbmcgfSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBjb21tb25IZWFkZXJzUHJvbWlzZTogUHJvbWlzZTxJSGVhZGVycz47XG5cdHByaXZhdGUgcmVhZG9ubHkgc2Vzc2lvbjogUmVxdWVzdHNTZXNzaW9uO1xuXG5cdHByaXZhdGUgX29uVG9rZW5GYWlsZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxVc2VyRGF0YVN5bmNFcnJvckNvZGU+KCkpO1xuXHRyZWFkb25seSBvblRva2VuRmFpbGVkID0gdGhpcy5fb25Ub2tlbkZhaWxlZC5ldmVudDtcblxuXHRwcml2YXRlIF9vblRva2VuU3VjY2VlZDogRW1pdHRlcjx2b2lkPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvblRva2VuU3VjY2VlZDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vblRva2VuU3VjY2VlZC5ldmVudDtcblxuXHRwcml2YXRlIF9kb25vdE1ha2VSZXF1ZXN0c1VudGlsOiBEYXRlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRnZXQgZG9ub3RNYWtlUmVxdWVzdHNVbnRpbCgpIHsgcmV0dXJuIHRoaXMuX2Rvbm90TWFrZVJlcXVlc3RzVW50aWw7IH1cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VEb25vdE1ha2VSZXF1ZXN0c1VudGlsID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRG9ub3RNYWtlUmVxdWVzdHNVbnRpbCA9IHRoaXMuX29uRGlkQ2hhbmdlRG9ub3RNYWtlUmVxdWVzdHNVbnRpbC5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHR1c2VyRGF0YVN5bmNTdG9yZVVybDogVVJJIHwgdW5kZWZpbmVkLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASVJlcXVlc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcmVxdWVzdFNlcnZpY2U6IElSZXF1ZXN0U2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY0xvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJVXNlckRhdGFTeW5jTG9nU2VydmljZSxcblx0XHRASUVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMudXBkYXRlVXNlckRhdGFTeW5jU3RvcmVVcmwodXNlckRhdGFTeW5jU3RvcmVVcmwpO1xuXHRcdHRoaXMuY29tbW9uSGVhZGVyc1Byb21pc2UgPSBnZXRTZXJ2aWNlTWFjaGluZUlkKGVudmlyb25tZW50U2VydmljZSwgZmlsZVNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlKVxuXHRcdFx0LnRoZW4odXVpZCA9PiB7XG5cdFx0XHRcdGNvbnN0IGhlYWRlcnM6IElIZWFkZXJzID0ge1xuXHRcdFx0XHRcdCdYLUNsaWVudC1OYW1lJzogYCR7cHJvZHVjdFNlcnZpY2UuYXBwbGljYXRpb25OYW1lfSR7aXNXZWIgPyAnLXdlYicgOiAnJ31gLFxuXHRcdFx0XHRcdCdYLUNsaWVudC1WZXJzaW9uJzogcHJvZHVjdFNlcnZpY2UudmVyc2lvbixcblx0XHRcdFx0fTtcblx0XHRcdFx0aWYgKHByb2R1Y3RTZXJ2aWNlLmNvbW1pdCkge1xuXHRcdFx0XHRcdGhlYWRlcnNbJ1gtQ2xpZW50LUNvbW1pdCddID0gcHJvZHVjdFNlcnZpY2UuY29tbWl0O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBoZWFkZXJzO1xuXHRcdFx0fSk7XG5cblx0XHQvKiBBIHJlcXVlc3RzIHNlc3Npb24gdGhhdCBsaW1pdHMgcmVxdWVzdHMgcGVyIHNlc3Npb25zICovXG5cdFx0dGhpcy5zZXNzaW9uID0gbmV3IFJlcXVlc3RzU2Vzc2lvbihSRVFVRVNUX1NFU1NJT05fTElNSVQsIFJFUVVFU1RfU0VTU0lPTl9JTlRFUlZBTCwgdGhpcy5yZXF1ZXN0U2VydmljZSwgdGhpcy5sb2dTZXJ2aWNlKTtcblx0XHR0aGlzLmluaXREb25vdE1ha2VSZXF1ZXN0c1VudGlsKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLnJlc2V0RG9ub3RNYWtlUmVxdWVzdHNVbnRpbFByb21pc2UpIHtcblx0XHRcdFx0dGhpcy5yZXNldERvbm90TWFrZVJlcXVlc3RzVW50aWxQcm9taXNlLmNhbmNlbCgpO1xuXHRcdFx0XHR0aGlzLnJlc2V0RG9ub3RNYWtlUmVxdWVzdHNVbnRpbFByb21pc2UgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0c2V0QXV0aFRva2VuKHRva2VuOiBzdHJpbmcsIHR5cGU6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuYXV0aFRva2VuID0geyB0b2tlbiwgdHlwZSB9O1xuXHR9XG5cblx0cHJvdGVjdGVkIHVwZGF0ZVVzZXJEYXRhU3luY1N0b3JlVXJsKHVzZXJEYXRhU3luY1N0b3JlVXJsOiBVUkkgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLnVzZXJEYXRhU3luY1N0b3JlVXJsID0gdXNlckRhdGFTeW5jU3RvcmVVcmwgPyBqb2luUGF0aCh1c2VyRGF0YVN5bmNTdG9yZVVybCwgJ3YxJykgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGluaXREb25vdE1ha2VSZXF1ZXN0c1VudGlsKCk6IHZvaWQge1xuXHRcdGNvbnN0IGRvbm90TWFrZVJlcXVlc3RzVW50aWwgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldE51bWJlcihET05PVF9NQUtFX1JFUVVFU1RTX1VOVElMX0tFWSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblx0XHRpZiAoZG9ub3RNYWtlUmVxdWVzdHNVbnRpbCAmJiBEYXRlLm5vdygpIDwgZG9ub3RNYWtlUmVxdWVzdHNVbnRpbCkge1xuXHRcdFx0dGhpcy5zZXREb25vdE1ha2VSZXF1ZXN0c1VudGlsKG5ldyBEYXRlKGRvbm90TWFrZVJlcXVlc3RzVW50aWwpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlc2V0RG9ub3RNYWtlUmVxdWVzdHNVbnRpbFByb21pc2U6IENhbmNlbGFibGVQcm9taXNlPHZvaWQ+IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRwcml2YXRlIHNldERvbm90TWFrZVJlcXVlc3RzVW50aWwoZG9ub3RNYWtlUmVxdWVzdHNVbnRpbDogRGF0ZSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9kb25vdE1ha2VSZXF1ZXN0c1VudGlsPy5nZXRUaW1lKCkgIT09IGRvbm90TWFrZVJlcXVlc3RzVW50aWw/LmdldFRpbWUoKSkge1xuXHRcdFx0dGhpcy5fZG9ub3RNYWtlUmVxdWVzdHNVbnRpbCA9IGRvbm90TWFrZVJlcXVlc3RzVW50aWw7XG5cblx0XHRcdGlmICh0aGlzLnJlc2V0RG9ub3RNYWtlUmVxdWVzdHNVbnRpbFByb21pc2UpIHtcblx0XHRcdFx0dGhpcy5yZXNldERvbm90TWFrZVJlcXVlc3RzVW50aWxQcm9taXNlLmNhbmNlbCgpO1xuXHRcdFx0XHR0aGlzLnJlc2V0RG9ub3RNYWtlUmVxdWVzdHNVbnRpbFByb21pc2UgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLl9kb25vdE1ha2VSZXF1ZXN0c1VudGlsKSB7XG5cdFx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoRE9OT1RfTUFLRV9SRVFVRVNUU19VTlRJTF9LRVksIHRoaXMuX2Rvbm90TWFrZVJlcXVlc3RzVW50aWwuZ2V0VGltZSgpLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0XHRcdHRoaXMucmVzZXREb25vdE1ha2VSZXF1ZXN0c1VudGlsUHJvbWlzZSA9IGNyZWF0ZUNhbmNlbGFibGVQcm9taXNlKHRva2VuID0+IHRpbWVvdXQodGhpcy5fZG9ub3RNYWtlUmVxdWVzdHNVbnRpbCEuZ2V0VGltZSgpIC0gRGF0ZS5ub3coKSwgdG9rZW4pLnRoZW4oKCkgPT4gdGhpcy5zZXREb25vdE1ha2VSZXF1ZXN0c1VudGlsKHVuZGVmaW5lZCkpKTtcblx0XHRcdFx0dGhpcy5yZXNldERvbm90TWFrZVJlcXVlc3RzVW50aWxQcm9taXNlLnRoZW4obnVsbCwgZSA9PiBudWxsIC8qIGlnbm9yZSBlcnJvciAqLyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShET05PVF9NQUtFX1JFUVVFU1RTX1VOVElMX0tFWSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEb25vdE1ha2VSZXF1ZXN0c1VudGlsLmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHQvLyAjcmVnaW9uIENvbGxlY3Rpb25cblxuXHRhc3luYyBnZXRBbGxDb2xsZWN0aW9ucyhoZWFkZXJzOiBJSGVhZGVycyA9IHt9KTogUHJvbWlzZTxzdHJpbmdbXT4ge1xuXHRcdGlmICghdGhpcy51c2VyRGF0YVN5bmNTdG9yZVVybCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdObyBzZXR0aW5ncyBzeW5jIHN0b3JlIHVybCBjb25maWd1cmVkLicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVybCA9IGpvaW5QYXRoKHRoaXMudXNlckRhdGFTeW5jU3RvcmVVcmwsICdjb2xsZWN0aW9uJykudG9TdHJpbmcoKTtcblx0XHRoZWFkZXJzID0geyAuLi5oZWFkZXJzIH07XG5cdFx0aGVhZGVyc1snQ29udGVudC1UeXBlJ10gPSAnYXBwbGljYXRpb24vanNvbic7XG5cblx0XHRjb25zdCBjb250ZXh0ID0gYXdhaXQgdGhpcy5yZXF1ZXN0KHVybCwgeyB0eXBlOiAnR0VUJywgaGVhZGVycyB9LCBbXSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHRyZXR1cm4gKGF3YWl0IGFzSnNvbjx7IGlkOiBzdHJpbmcgfVtdPihjb250ZXh0KSk/Lm1hcCgoeyBpZCB9KSA9PiBpZCkgfHwgW107XG5cdH1cblxuXHRhc3luYyBjcmVhdGVDb2xsZWN0aW9uKGhlYWRlcnM6IElIZWFkZXJzID0ge30pOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGlmICghdGhpcy51c2VyRGF0YVN5bmNTdG9yZVVybCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdObyBzZXR0aW5ncyBzeW5jIHN0b3JlIHVybCBjb25maWd1cmVkLicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVybCA9IGpvaW5QYXRoKHRoaXMudXNlckRhdGFTeW5jU3RvcmVVcmwsICdjb2xsZWN0aW9uJykudG9TdHJpbmcoKTtcblx0XHRoZWFkZXJzID0geyAuLi5oZWFkZXJzIH07XG5cdFx0aGVhZGVyc1snQ29udGVudC1UeXBlJ10gPSBNaW1lcy50ZXh0O1xuXG5cdFx0Y29uc3QgY29udGV4dCA9IGF3YWl0IHRoaXMucmVxdWVzdCh1cmwsIHsgdHlwZTogJ1BPU1QnLCBoZWFkZXJzIH0sIFtdLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRjb25zdCBjb2xsZWN0aW9uSWQgPSBhd2FpdCBhc1RleHRPckVycm9yKGNvbnRleHQpO1xuXHRcdGlmICghY29sbGVjdGlvbklkKSB7XG5cdFx0XHR0aHJvdyBuZXcgVXNlckRhdGFTeW5jU3RvcmVFcnJvcignU2VydmVyIGRpZCBub3QgcmV0dXJuIHRoZSBjb2xsZWN0aW9uIGlkJywgdXJsLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUuTm9Db2xsZWN0aW9uLCBjb250ZXh0LnJlcy5zdGF0dXNDb2RlLCBjb250ZXh0LnJlcy5oZWFkZXJzW0hFQURFUl9PUEVSQVRJT05fSURdKTtcblx0XHR9XG5cdFx0cmV0dXJuIGNvbGxlY3Rpb25JZDtcblx0fVxuXG5cdGFzeW5jIGRlbGV0ZUNvbGxlY3Rpb24oY29sbGVjdGlvbj86IHN0cmluZywgaGVhZGVyczogSUhlYWRlcnMgPSB7fSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy51c2VyRGF0YVN5bmNTdG9yZVVybCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdObyBzZXR0aW5ncyBzeW5jIHN0b3JlIHVybCBjb25maWd1cmVkLicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVybCA9IGNvbGxlY3Rpb24gPyBqb2luUGF0aCh0aGlzLnVzZXJEYXRhU3luY1N0b3JlVXJsLCAnY29sbGVjdGlvbicsIGNvbGxlY3Rpb24pLnRvU3RyaW5nKCkgOiBqb2luUGF0aCh0aGlzLnVzZXJEYXRhU3luY1N0b3JlVXJsLCAnY29sbGVjdGlvbicpLnRvU3RyaW5nKCk7XG5cdFx0aGVhZGVycyA9IHsgLi4uaGVhZGVycyB9O1xuXG5cdFx0YXdhaXQgdGhpcy5yZXF1ZXN0KHVybCwgeyB0eXBlOiAnREVMRVRFJywgaGVhZGVycyB9LCBbXSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdH1cblxuXHQvLyAjZW5kcmVnaW9uXG5cblx0Ly8gI3JlZ2lvbiBSZXNvdXJjZVxuXG5cdGFzeW5jIGdldEFsbFJlc291cmNlUmVmcyhyZXNvdXJjZTogU2VydmVyUmVzb3VyY2UsIGNvbGxlY3Rpb24/OiBzdHJpbmcpOiBQcm9taXNlPElSZXNvdXJjZVJlZkhhbmRsZVtdPiB7XG5cdFx0aWYgKCF0aGlzLnVzZXJEYXRhU3luY1N0b3JlVXJsKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ05vIHNldHRpbmdzIHN5bmMgc3RvcmUgdXJsIGNvbmZpZ3VyZWQuJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXJpID0gdGhpcy5nZXRSZXNvdXJjZVVybCh0aGlzLnVzZXJEYXRhU3luY1N0b3JlVXJsLCBjb2xsZWN0aW9uLCByZXNvdXJjZSk7XG5cdFx0Y29uc3QgaGVhZGVyczogSUhlYWRlcnMgPSB7fTtcblxuXHRcdGNvbnN0IGNvbnRleHQgPSBhd2FpdCB0aGlzLnJlcXVlc3QodXJpLnRvU3RyaW5nKCksIHsgdHlwZTogJ0dFVCcsIGhlYWRlcnMgfSwgW10sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgYXNKc29uPHsgdXJsOiBzdHJpbmc7IGNyZWF0ZWQ6IG51bWJlciB9W10+KGNvbnRleHQpIHx8IFtdO1xuXHRcdHJldHVybiByZXN1bHQubWFwKCh7IHVybCwgY3JlYXRlZCB9KSA9PiAoeyByZWY6IHJlbGF0aXZlUGF0aCh1cmksIHVyaS53aXRoKHsgcGF0aDogdXJsIH0pKSEsIGNyZWF0ZWQ6IGNyZWF0ZWQgKiAxMDAwIC8qIFNlcnZlciByZXR1cm5zIGluIHNlY29uZHMgKi8gfSkpO1xuXHR9XG5cblx0YXN5bmMgcmVzb2x2ZVJlc291cmNlQ29udGVudChyZXNvdXJjZTogU2VydmVyUmVzb3VyY2UsIHJlZjogc3RyaW5nLCBjb2xsZWN0aW9uPzogc3RyaW5nLCBoZWFkZXJzOiBJSGVhZGVycyA9IHt9KTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XG5cdFx0aWYgKCF0aGlzLnVzZXJEYXRhU3luY1N0b3JlVXJsKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ05vIHNldHRpbmdzIHN5bmMgc3RvcmUgdXJsIGNvbmZpZ3VyZWQuJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXJsID0gam9pblBhdGgodGhpcy5nZXRSZXNvdXJjZVVybCh0aGlzLnVzZXJEYXRhU3luY1N0b3JlVXJsLCBjb2xsZWN0aW9uLCByZXNvdXJjZSksIHJlZikudG9TdHJpbmcoKTtcblx0XHRoZWFkZXJzID0geyAuLi5oZWFkZXJzIH07XG5cdFx0aGVhZGVyc1snQ2FjaGUtQ29udHJvbCddID0gJ25vLWNhY2hlJztcblxuXHRcdGNvbnN0IGNvbnRleHQgPSBhd2FpdCB0aGlzLnJlcXVlc3QodXJsLCB7IHR5cGU6ICdHRVQnLCBoZWFkZXJzIH0sIFtdLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgYXNUZXh0T3JFcnJvcihjb250ZXh0KTtcblx0XHRyZXR1cm4gY29udGVudDtcblx0fVxuXG5cdGFzeW5jIGRlbGV0ZVJlc291cmNlKHJlc291cmNlOiBTZXJ2ZXJSZXNvdXJjZSwgcmVmOiBzdHJpbmcgfCBudWxsLCBjb2xsZWN0aW9uPzogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLnVzZXJEYXRhU3luY1N0b3JlVXJsKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ05vIHNldHRpbmdzIHN5bmMgc3RvcmUgdXJsIGNvbmZpZ3VyZWQuJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXJsID0gcmVmICE9PSBudWxsID8gam9pblBhdGgodGhpcy5nZXRSZXNvdXJjZVVybCh0aGlzLnVzZXJEYXRhU3luY1N0b3JlVXJsLCBjb2xsZWN0aW9uLCByZXNvdXJjZSksIHJlZikudG9TdHJpbmcoKSA6IHRoaXMuZ2V0UmVzb3VyY2VVcmwodGhpcy51c2VyRGF0YVN5bmNTdG9yZVVybCwgY29sbGVjdGlvbiwgcmVzb3VyY2UpLnRvU3RyaW5nKCk7XG5cdFx0Y29uc3QgaGVhZGVyczogSUhlYWRlcnMgPSB7fTtcblxuXHRcdGF3YWl0IHRoaXMucmVxdWVzdCh1cmwsIHsgdHlwZTogJ0RFTEVURScsIGhlYWRlcnMgfSwgW10sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHR9XG5cblx0YXN5bmMgZGVsZXRlUmVzb3VyY2VzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy51c2VyRGF0YVN5bmNTdG9yZVVybCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdObyBzZXR0aW5ncyBzeW5jIHN0b3JlIHVybCBjb25maWd1cmVkLicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVybCA9IGpvaW5QYXRoKHRoaXMudXNlckRhdGFTeW5jU3RvcmVVcmwsICdyZXNvdXJjZScpLnRvU3RyaW5nKCk7XG5cdFx0Y29uc3QgaGVhZGVyczogSUhlYWRlcnMgPSB7ICdDb250ZW50LVR5cGUnOiBNaW1lcy50ZXh0IH07XG5cblx0XHRhd2FpdCB0aGlzLnJlcXVlc3QodXJsLCB7IHR5cGU6ICdERUxFVEUnLCBoZWFkZXJzIH0sIFtdLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0fVxuXG5cdGFzeW5jIHJlYWRSZXNvdXJjZShyZXNvdXJjZTogU2VydmVyUmVzb3VyY2UsIG9sZFZhbHVlOiBJVXNlckRhdGEgfCBudWxsLCBjb2xsZWN0aW9uPzogc3RyaW5nLCBoZWFkZXJzOiBJSGVhZGVycyA9IHt9KTogUHJvbWlzZTxJVXNlckRhdGE+IHtcblx0XHRpZiAoIXRoaXMudXNlckRhdGFTeW5jU3RvcmVVcmwpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTm8gc2V0dGluZ3Mgc3luYyBzdG9yZSB1cmwgY29uZmlndXJlZC4nKTtcblx0XHR9XG5cblx0XHRjb25zdCB1cmwgPSBqb2luUGF0aCh0aGlzLmdldFJlc291cmNlVXJsKHRoaXMudXNlckRhdGFTeW5jU3RvcmVVcmwsIGNvbGxlY3Rpb24sIHJlc291cmNlKSwgJ2xhdGVzdCcpLnRvU3RyaW5nKCk7XG5cdFx0aGVhZGVycyA9IHsgLi4uaGVhZGVycyB9O1xuXHRcdC8vIERpc2FibGUgY2FjaGluZyBhcyB0aGV5IGFyZSBjYWNoZWQgYnkgc3luY2hyb25pc2Vyc1xuXHRcdGhlYWRlcnNbJ0NhY2hlLUNvbnRyb2wnXSA9ICduby1jYWNoZSc7XG5cdFx0aWYgKG9sZFZhbHVlKSB7XG5cdFx0XHRoZWFkZXJzWydJZi1Ob25lLU1hdGNoJ10gPSBvbGRWYWx1ZS5yZWY7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udGV4dCA9IGF3YWl0IHRoaXMucmVxdWVzdCh1cmwsIHsgdHlwZTogJ0dFVCcsIGhlYWRlcnMgfSwgWzMwNF0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXG5cdFx0bGV0IHVzZXJEYXRhOiBJVXNlckRhdGEgfCBudWxsID0gbnVsbDtcblx0XHRpZiAoY29udGV4dC5yZXMuc3RhdHVzQ29kZSA9PT0gMzA0KSB7XG5cdFx0XHR1c2VyRGF0YSA9IG9sZFZhbHVlO1xuXHRcdH1cblxuXHRcdGlmICh1c2VyRGF0YSA9PT0gbnVsbCkge1xuXHRcdFx0Y29uc3QgcmVmID0gY29udGV4dC5yZXMuaGVhZGVyc1snZXRhZyddO1xuXHRcdFx0aWYgKCFyZWYpIHtcblx0XHRcdFx0dGhyb3cgbmV3IFVzZXJEYXRhU3luY1N0b3JlRXJyb3IoJ1NlcnZlciBkaWQgbm90IHJldHVybiB0aGUgcmVmJywgdXJsLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUuTm9SZWYsIGNvbnRleHQucmVzLnN0YXR1c0NvZGUsIGNvbnRleHQucmVzLmhlYWRlcnNbSEVBREVSX09QRVJBVElPTl9JRF0pO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgYXNUZXh0T3JFcnJvcihjb250ZXh0KTtcblx0XHRcdGlmICghY29udGVudCAmJiBjb250ZXh0LnJlcy5zdGF0dXNDb2RlID09PSAzMDQpIHtcblx0XHRcdFx0dGhyb3cgbmV3IFVzZXJEYXRhU3luY1N0b3JlRXJyb3IoJ0VtcHR5IHJlc3BvbnNlJywgdXJsLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUuRW1wdHlSZXNwb25zZSwgY29udGV4dC5yZXMuc3RhdHVzQ29kZSwgY29udGV4dC5yZXMuaGVhZGVyc1tIRUFERVJfT1BFUkFUSU9OX0lEXSk7XG5cdFx0XHR9XG5cblx0XHRcdHVzZXJEYXRhID0geyByZWYsIGNvbnRlbnQgfTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdXNlckRhdGE7XG5cdH1cblxuXHRhc3luYyB3cml0ZVJlc291cmNlKHJlc291cmNlOiBTZXJ2ZXJSZXNvdXJjZSwgZGF0YTogc3RyaW5nLCByZWY6IHN0cmluZyB8IG51bGwsIGNvbGxlY3Rpb24/OiBzdHJpbmcsIGhlYWRlcnM6IElIZWFkZXJzID0ge30pOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGlmICghdGhpcy51c2VyRGF0YVN5bmNTdG9yZVVybCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdObyBzZXR0aW5ncyBzeW5jIHN0b3JlIHVybCBjb25maWd1cmVkLicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHVybCA9IHRoaXMuZ2V0UmVzb3VyY2VVcmwodGhpcy51c2VyRGF0YVN5bmNTdG9yZVVybCwgY29sbGVjdGlvbiwgcmVzb3VyY2UpLnRvU3RyaW5nKCk7XG5cdFx0aGVhZGVycyA9IHsgLi4uaGVhZGVycyB9O1xuXHRcdGhlYWRlcnNbJ0NvbnRlbnQtVHlwZSddID0gTWltZXMudGV4dDtcblx0XHRpZiAocmVmKSB7XG5cdFx0XHRoZWFkZXJzWydJZi1NYXRjaCddID0gcmVmO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRleHQgPSBhd2FpdCB0aGlzLnJlcXVlc3QodXJsLCB7IHR5cGU6ICdQT1NUJywgZGF0YSwgaGVhZGVycyB9LCBbXSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHRjb25zdCBuZXdSZWYgPSBjb250ZXh0LnJlcy5oZWFkZXJzWydldGFnJ107XG5cdFx0aWYgKCFuZXdSZWYpIHtcblx0XHRcdHRocm93IG5ldyBVc2VyRGF0YVN5bmNTdG9yZUVycm9yKCdTZXJ2ZXIgZGlkIG5vdCByZXR1cm4gdGhlIHJlZicsIHVybCwgVXNlckRhdGFTeW5jRXJyb3JDb2RlLk5vUmVmLCBjb250ZXh0LnJlcy5zdGF0dXNDb2RlLCBjb250ZXh0LnJlcy5oZWFkZXJzW0hFQURFUl9PUEVSQVRJT05fSURdKTtcblx0XHR9XG5cdFx0cmV0dXJuIG5ld1JlZjtcblx0fVxuXG5cdC8vICNlbmRyZWdpb25cblxuXHRhc3luYyBtYW5pZmVzdChvbGRWYWx1ZTogSVVzZXJEYXRhTWFuaWZlc3QgfCBudWxsLCBoZWFkZXJzOiBJSGVhZGVycyA9IHt9KTogUHJvbWlzZTxJVXNlckRhdGFNYW5pZmVzdCB8IG51bGw+IHtcblx0XHRpZiAoIXRoaXMudXNlckRhdGFTeW5jU3RvcmVVcmwpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTm8gc2V0dGluZ3Mgc3luYyBzdG9yZSB1cmwgY29uZmlndXJlZC4nKTtcblx0XHR9XG5cblx0XHRjb25zdCB1cmwgPSBqb2luUGF0aCh0aGlzLnVzZXJEYXRhU3luY1N0b3JlVXJsLCAnbWFuaWZlc3QnKS50b1N0cmluZygpO1xuXHRcdGhlYWRlcnMgPSB7IC4uLmhlYWRlcnMgfTtcblx0XHRoZWFkZXJzWydDb250ZW50LVR5cGUnXSA9ICdhcHBsaWNhdGlvbi9qc29uJztcblx0XHRpZiAob2xkVmFsdWUpIHtcblx0XHRcdGhlYWRlcnNbJ0lmLU5vbmUtTWF0Y2gnXSA9IG9sZFZhbHVlLnJlZjtcblx0XHR9XG5cblx0XHRjb25zdCBjb250ZXh0ID0gYXdhaXQgdGhpcy5yZXF1ZXN0KHVybCwgeyB0eXBlOiAnR0VUJywgaGVhZGVycyB9LCBbMzA0XSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHRsZXQgbWFuaWZlc3Q6IElVc2VyRGF0YU1hbmlmZXN0IHwgbnVsbCA9IG51bGw7XG5cdFx0aWYgKGNvbnRleHQucmVzLnN0YXR1c0NvZGUgPT09IDMwNCkge1xuXHRcdFx0bWFuaWZlc3QgPSBvbGRWYWx1ZTtcblx0XHR9XG5cblx0XHRpZiAoIW1hbmlmZXN0KSB7XG5cdFx0XHRjb25zdCByZWYgPSBjb250ZXh0LnJlcy5oZWFkZXJzWydldGFnJ107XG5cdFx0XHRpZiAoIXJlZikge1xuXHRcdFx0XHR0aHJvdyBuZXcgVXNlckRhdGFTeW5jU3RvcmVFcnJvcignU2VydmVyIGRpZCBub3QgcmV0dXJuIHRoZSByZWYnLCB1cmwsIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5Ob1JlZiwgY29udGV4dC5yZXMuc3RhdHVzQ29kZSwgY29udGV4dC5yZXMuaGVhZGVyc1tIRUFERVJfT1BFUkFUSU9OX0lEXSk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBhc1RleHRPckVycm9yKGNvbnRleHQpO1xuXHRcdFx0aWYgKCFjb250ZW50ICYmIGNvbnRleHQucmVzLnN0YXR1c0NvZGUgPT09IDMwNCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgVXNlckRhdGFTeW5jU3RvcmVFcnJvcignRW1wdHkgcmVzcG9uc2UnLCB1cmwsIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5FbXB0eVJlc3BvbnNlLCBjb250ZXh0LnJlcy5zdGF0dXNDb2RlLCBjb250ZXh0LnJlcy5oZWFkZXJzW0hFQURFUl9PUEVSQVRJT05fSURdKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGNvbnRlbnQpIHtcblx0XHRcdFx0bWFuaWZlc3QgPSB7IC4uLkpTT04ucGFyc2UoY29udGVudCksIHJlZiB9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGN1cnJlbnRTZXNzaW9uSWQgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChVU0VSX1NFU1NJT05fSURfS0VZLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pO1xuXG5cdFx0aWYgKGN1cnJlbnRTZXNzaW9uSWQgJiYgbWFuaWZlc3QgJiYgY3VycmVudFNlc3Npb25JZCAhPT0gbWFuaWZlc3Quc2Vzc2lvbikge1xuXHRcdFx0Ly8gU2VydmVyIHNlc3Npb24gaXMgZGlmZmVyZW50IGZyb20gY2xpZW50IHNlc3Npb24gc28gY2xlYXIgY2FjaGVkIHNlc3Npb24uXG5cdFx0XHR0aGlzLmNsZWFyU2Vzc2lvbigpO1xuXHRcdH1cblxuXHRcdGlmIChtYW5pZmVzdCA9PT0gbnVsbCAmJiBjdXJyZW50U2Vzc2lvbklkKSB7XG5cdFx0XHQvLyBzZXJ2ZXIgc2Vzc2lvbiBpcyBjbGVhcmVkIHNvIGNsZWFyIGNhY2hlZCBzZXNzaW9uLlxuXHRcdFx0dGhpcy5jbGVhclNlc3Npb24oKTtcblx0XHR9XG5cblx0XHRpZiAobWFuaWZlc3QpIHtcblx0XHRcdC8vIHVwZGF0ZSBzZXNzaW9uXG5cdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKFVTRVJfU0VTU0lPTl9JRF9LRVksIG1hbmlmZXN0LnNlc3Npb24sIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbWFuaWZlc3Q7XG5cdH1cblxuXHRhc3luYyBjbGVhcigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMudXNlckRhdGFTeW5jU3RvcmVVcmwpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTm8gc2V0dGluZ3Mgc3luYyBzdG9yZSB1cmwgY29uZmlndXJlZC4nKTtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLmRlbGV0ZUNvbGxlY3Rpb24oKTtcblx0XHRhd2FpdCB0aGlzLmRlbGV0ZVJlc291cmNlcygpO1xuXG5cdFx0Ly8gY2xlYXIgY2FjaGVkIHNlc3Npb24uXG5cdFx0dGhpcy5jbGVhclNlc3Npb24oKTtcblx0fVxuXG5cdGFzeW5jIGdldEFjdGl2aXR5RGF0YSgpOiBQcm9taXNlPFZTQnVmZmVyUmVhZGFibGVTdHJlYW0+IHtcblx0XHRpZiAoIXRoaXMudXNlckRhdGFTeW5jU3RvcmVVcmwpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTm8gc2V0dGluZ3Mgc3luYyBzdG9yZSB1cmwgY29uZmlndXJlZC4nKTtcblx0XHR9XG5cblx0XHRjb25zdCB1cmwgPSBqb2luUGF0aCh0aGlzLnVzZXJEYXRhU3luY1N0b3JlVXJsLCAnZG93bmxvYWQnKS50b1N0cmluZygpO1xuXHRcdGNvbnN0IGhlYWRlcnM6IElIZWFkZXJzID0ge307XG5cblx0XHRjb25zdCBjb250ZXh0ID0gYXdhaXQgdGhpcy5yZXF1ZXN0KHVybCwgeyB0eXBlOiAnR0VUJywgaGVhZGVycyB9LCBbXSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHRpZiAoIWlzU3VjY2Vzcyhjb250ZXh0KSkge1xuXHRcdFx0dGhyb3cgbmV3IFVzZXJEYXRhU3luY1N0b3JlRXJyb3IoJ1NlcnZlciByZXR1cm5lZCAnICsgY29udGV4dC5yZXMuc3RhdHVzQ29kZSwgdXJsLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUuRW1wdHlSZXNwb25zZSwgY29udGV4dC5yZXMuc3RhdHVzQ29kZSwgY29udGV4dC5yZXMuaGVhZGVyc1tIRUFERVJfT1BFUkFUSU9OX0lEXSk7XG5cdFx0fVxuXG5cdFx0aWYgKGhhc05vQ29udGVudChjb250ZXh0KSkge1xuXHRcdFx0dGhyb3cgbmV3IFVzZXJEYXRhU3luY1N0b3JlRXJyb3IoJ0VtcHR5IHJlc3BvbnNlJywgdXJsLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUuRW1wdHlSZXNwb25zZSwgY29udGV4dC5yZXMuc3RhdHVzQ29kZSwgY29udGV4dC5yZXMuaGVhZGVyc1tIRUFERVJfT1BFUkFUSU9OX0lEXSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNvbnRleHQuc3RyZWFtO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRSZXNvdXJjZVVybCh1c2VyRGF0YVN5bmNTdG9yZVVybDogVVJJLCBjb2xsZWN0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQsIHJlc291cmNlOiBTZXJ2ZXJSZXNvdXJjZSk6IFVSSSB7XG5cdFx0cmV0dXJuIGNvbGxlY3Rpb24gPyBqb2luUGF0aCh1c2VyRGF0YVN5bmNTdG9yZVVybCwgJ2NvbGxlY3Rpb24nLCBjb2xsZWN0aW9uLCAncmVzb3VyY2UnLCByZXNvdXJjZSkgOiBqb2luUGF0aCh1c2VyRGF0YVN5bmNTdG9yZVVybCwgJ3Jlc291cmNlJywgcmVzb3VyY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBjbGVhclNlc3Npb24oKTogdm9pZCB7XG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5yZW1vdmUoVVNFUl9TRVNTSU9OX0lEX0tFWSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShNQUNISU5FX1NFU1NJT05fSURfS0VZLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXF1ZXN0KHVybDogc3RyaW5nLCBvcHRpb25zOiBJUmVxdWVzdE9wdGlvbnMsIHN1Y2Nlc3NDb2RlczogbnVtYmVyW10sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVJlcXVlc3RDb250ZXh0PiB7XG5cdFx0aWYgKCF0aGlzLmF1dGhUb2tlbikge1xuXHRcdFx0dGhyb3cgbmV3IFVzZXJEYXRhU3luY1N0b3JlRXJyb3IoJ05vIEF1dGggVG9rZW4gQXZhaWxhYmxlJywgdXJsLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUuVW5hdXRob3JpemVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2Rvbm90TWFrZVJlcXVlc3RzVW50aWwgJiYgRGF0ZS5ub3coKSA8IHRoaXMuX2Rvbm90TWFrZVJlcXVlc3RzVW50aWwuZ2V0VGltZSgpKSB7XG5cdFx0XHR0aHJvdyBuZXcgVXNlckRhdGFTeW5jU3RvcmVFcnJvcihgJHtvcHRpb25zLnR5cGV9IHJlcXVlc3QgJyR7dXJsfScgZmFpbGVkIGJlY2F1c2Ugb2YgdG9vIG1hbnkgcmVxdWVzdHMgKDQyOSkuYCwgdXJsLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUuVG9vTWFueVJlcXVlc3RzQW5kUmV0cnlBZnRlciwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHRcdH1cblx0XHR0aGlzLnNldERvbm90TWFrZVJlcXVlc3RzVW50aWwodW5kZWZpbmVkKTtcblxuXHRcdGNvbnN0IGNvbW1vbkhlYWRlcnMgPSBhd2FpdCB0aGlzLmNvbW1vbkhlYWRlcnNQcm9taXNlO1xuXHRcdG9wdGlvbnMuaGVhZGVycyA9IHtcblx0XHRcdC4uLihvcHRpb25zLmhlYWRlcnMgfHwge30pLFxuXHRcdFx0Li4uY29tbW9uSGVhZGVycyxcblx0XHRcdCdYLUFjY291bnQtVHlwZSc6IHRoaXMuYXV0aFRva2VuLnR5cGUsXG5cdFx0XHQnYXV0aG9yaXphdGlvbic6IGBCZWFyZXIgJHt0aGlzLmF1dGhUb2tlbi50b2tlbn1gLFxuXHRcdH07XG5cblx0XHQvLyBBZGQgc2Vzc2lvbiBoZWFkZXJzXG5cdFx0dGhpcy5hZGRTZXNzaW9uSGVhZGVycyhvcHRpb25zLmhlYWRlcnMpO1xuXG5cdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdTZW5kaW5nIHJlcXVlc3QgdG8gc2VydmVyJywgeyB1cmwsIHR5cGU6IG9wdGlvbnMudHlwZSwgaGVhZGVyczogeyAuLi5vcHRpb25zLmhlYWRlcnMsIC4uLnsgYXV0aG9yaXphdGlvbjogdW5kZWZpbmVkIH0gfSB9KTtcblxuXHRcdGxldCBjb250ZXh0O1xuXHRcdHRyeSB7XG5cdFx0XHRjb250ZXh0ID0gYXdhaXQgdGhpcy5zZXNzaW9uLnJlcXVlc3QodXJsLCBvcHRpb25zLCB0b2tlbik7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0aWYgKCEoZSBpbnN0YW5jZW9mIFVzZXJEYXRhU3luY1N0b3JlRXJyb3IpKSB7XG5cdFx0XHRcdGxldCBjb2RlID0gVXNlckRhdGFTeW5jRXJyb3JDb2RlLlJlcXVlc3RGYWlsZWQ7XG5cdFx0XHRcdGNvbnN0IGVycm9yTWVzc2FnZSA9IGdldEVycm9yTWVzc2FnZShlKS50b0xvd2VyQ2FzZSgpO1xuXG5cdFx0XHRcdC8vIFJlcXVlc3QgdGltZWQgb3V0XG5cdFx0XHRcdGlmIChlcnJvck1lc3NhZ2UuaW5jbHVkZXMoJ3hociB0aW1lb3V0JykpIHtcblx0XHRcdFx0XHRjb2RlID0gVXNlckRhdGFTeW5jRXJyb3JDb2RlLlJlcXVlc3RUaW1lb3V0O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gUmVxdWVzdCBwcm90b2NvbCBub3Qgc3VwcG9ydGVkXG5cdFx0XHRcdGVsc2UgaWYgKGVycm9yTWVzc2FnZS5pbmNsdWRlcygncHJvdG9jb2wnKSAmJiBlcnJvck1lc3NhZ2UuaW5jbHVkZXMoJ25vdCBzdXBwb3J0ZWQnKSkge1xuXHRcdFx0XHRcdGNvZGUgPSBVc2VyRGF0YVN5bmNFcnJvckNvZGUuUmVxdWVzdFByb3RvY29sTm90U3VwcG9ydGVkO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gUmVxdWVzdCBwYXRoIG5vdCBlc2NhcGVkXG5cdFx0XHRcdGVsc2UgaWYgKGVycm9yTWVzc2FnZS5pbmNsdWRlcygncmVxdWVzdCBwYXRoIGNvbnRhaW5zIHVuZXNjYXBlZCBjaGFyYWN0ZXJzJykpIHtcblx0XHRcdFx0XHRjb2RlID0gVXNlckRhdGFTeW5jRXJyb3JDb2RlLlJlcXVlc3RQYXRoTm90RXNjYXBlZDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIFJlcXVlc3QgaGVhZGVyIG5vdCBhbiBvYmplY3Rcblx0XHRcdFx0ZWxzZSBpZiAoZXJyb3JNZXNzYWdlLmluY2x1ZGVzKCdoZWFkZXJzIG11c3QgYmUgYW4gb2JqZWN0JykpIHtcblx0XHRcdFx0XHRjb2RlID0gVXNlckRhdGFTeW5jRXJyb3JDb2RlLlJlcXVlc3RIZWFkZXJzTm90T2JqZWN0O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gUmVxdWVzdCBjYW5jZWxlZFxuXHRcdFx0XHRlbHNlIGlmIChpc0NhbmNlbGxhdGlvbkVycm9yKGUpKSB7XG5cdFx0XHRcdFx0Y29kZSA9IFVzZXJEYXRhU3luY0Vycm9yQ29kZS5SZXF1ZXN0Q2FuY2VsZWQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRlID0gbmV3IFVzZXJEYXRhU3luY1N0b3JlRXJyb3IoYENvbm5lY3Rpb24gcmVmdXNlZCBmb3IgdGhlIHJlcXVlc3QgJyR7dXJsfScuYCwgdXJsLCBjb2RlLCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnUmVxdWVzdCBmYWlsZWQnLCB1cmwpO1xuXHRcdFx0dGhyb3cgZTtcblx0XHR9XG5cblx0XHRjb25zdCBvcGVyYXRpb25JZCA9IGNvbnRleHQucmVzLmhlYWRlcnNbSEVBREVSX09QRVJBVElPTl9JRF07XG5cdFx0Y29uc3QgcmVxdWVzdEluZm8gPSB7IHVybCwgc3RhdHVzOiBjb250ZXh0LnJlcy5zdGF0dXNDb2RlLCAnZXhlY3V0aW9uLWlkJzogb3B0aW9ucy5oZWFkZXJzW0hFQURFUl9FWEVDVVRJT05fSURdLCAnb3BlcmF0aW9uLWlkJzogb3BlcmF0aW9uSWQgfTtcblx0XHRjb25zdCBpc1N1Y2Nlc3MgPSBpc1N1Y2Nlc3NDb250ZXh0KGNvbnRleHQpIHx8IChjb250ZXh0LnJlcy5zdGF0dXNDb2RlICYmIHN1Y2Nlc3NDb2Rlcy5pbmNsdWRlcyhjb250ZXh0LnJlcy5zdGF0dXNDb2RlKSk7XG5cdFx0bGV0IGZhaWx1cmVNZXNzYWdlID0gJyc7XG5cdFx0aWYgKGlzU3VjY2Vzcykge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKCdSZXF1ZXN0IHN1Y2NlZWRlZCcsIHJlcXVlc3RJbmZvKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZmFpbHVyZU1lc3NhZ2UgPSBhd2FpdCBhc1RleHQoY29udGV4dCkgfHwgJyc7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnUmVxdWVzdCBmYWlsZWQnLCByZXF1ZXN0SW5mbywgZmFpbHVyZU1lc3NhZ2UpO1xuXHRcdH1cblxuXHRcdGlmIChjb250ZXh0LnJlcy5zdGF0dXNDb2RlID09PSA0MDEgfHwgY29udGV4dC5yZXMuc3RhdHVzQ29kZSA9PT0gNDAzKSB7XG5cdFx0XHR0aGlzLmF1dGhUb2tlbiA9IHVuZGVmaW5lZDtcblx0XHRcdGlmIChjb250ZXh0LnJlcy5zdGF0dXNDb2RlID09PSA0MDEpIHtcblx0XHRcdFx0dGhpcy5fb25Ub2tlbkZhaWxlZC5maXJlKFVzZXJEYXRhU3luY0Vycm9yQ29kZS5VbmF1dGhvcml6ZWQpO1xuXHRcdFx0XHR0aHJvdyBuZXcgVXNlckRhdGFTeW5jU3RvcmVFcnJvcihgJHtvcHRpb25zLnR5cGV9IHJlcXVlc3QgJyR7dXJsfScgZmFpbGVkIGJlY2F1c2Ugb2YgVW5hdXRob3JpemVkICg0MDEpLmAsIHVybCwgVXNlckRhdGFTeW5jRXJyb3JDb2RlLlVuYXV0aG9yaXplZCwgY29udGV4dC5yZXMuc3RhdHVzQ29kZSwgb3BlcmF0aW9uSWQpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGNvbnRleHQucmVzLnN0YXR1c0NvZGUgPT09IDQwMykge1xuXHRcdFx0XHR0aGlzLl9vblRva2VuRmFpbGVkLmZpcmUoVXNlckRhdGFTeW5jRXJyb3JDb2RlLkZvcmJpZGRlbik7XG5cdFx0XHRcdHRocm93IG5ldyBVc2VyRGF0YVN5bmNTdG9yZUVycm9yKGAke29wdGlvbnMudHlwZX0gcmVxdWVzdCAnJHt1cmx9JyBmYWlsZWQgYmVjYXVzZSB0aGUgYWNjZXNzIGlzIGZvcmJpZGRlbiAoNDAzKS5gLCB1cmwsIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5Gb3JiaWRkZW4sIGNvbnRleHQucmVzLnN0YXR1c0NvZGUsIG9wZXJhdGlvbklkKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl9vblRva2VuU3VjY2VlZC5maXJlKCk7XG5cblx0XHRpZiAoY29udGV4dC5yZXMuc3RhdHVzQ29kZSA9PT0gNDA0KSB7XG5cdFx0XHR0aHJvdyBuZXcgVXNlckRhdGFTeW5jU3RvcmVFcnJvcihgJHtvcHRpb25zLnR5cGV9IHJlcXVlc3QgJyR7dXJsfScgZmFpbGVkIGJlY2F1c2UgdGhlIHJlcXVlc3RlZCByZXNvdXJjZSBpcyBub3QgZm91bmQgKDQwNCkuYCwgdXJsLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUuTm90Rm91bmQsIGNvbnRleHQucmVzLnN0YXR1c0NvZGUsIG9wZXJhdGlvbklkKTtcblx0XHR9XG5cblx0XHRpZiAoY29udGV4dC5yZXMuc3RhdHVzQ29kZSA9PT0gNDA1KSB7XG5cdFx0XHR0aHJvdyBuZXcgVXNlckRhdGFTeW5jU3RvcmVFcnJvcihgJHtvcHRpb25zLnR5cGV9IHJlcXVlc3QgJyR7dXJsfScgZmFpbGVkIGJlY2F1c2UgdGhlIHJlcXVlc3RlZCBlbmRwb2ludCBpcyBub3QgZm91bmQgKDQwNSkuICR7ZmFpbHVyZU1lc3NhZ2V9YCwgdXJsLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUuTWV0aG9kTm90Rm91bmQsIGNvbnRleHQucmVzLnN0YXR1c0NvZGUsIG9wZXJhdGlvbklkKTtcblx0XHR9XG5cblx0XHRpZiAoY29udGV4dC5yZXMuc3RhdHVzQ29kZSA9PT0gNDA5KSB7XG5cdFx0XHR0aHJvdyBuZXcgVXNlckRhdGFTeW5jU3RvcmVFcnJvcihgJHtvcHRpb25zLnR5cGV9IHJlcXVlc3QgJyR7dXJsfScgZmFpbGVkIGJlY2F1c2Ugb2YgQ29uZmxpY3QgKDQwOSkuIFRoZXJlIGlzIG5ldyBkYXRhIGZvciB0aGlzIHJlc291cmNlLiBNYWtlIHRoZSByZXF1ZXN0IGFnYWluIHdpdGggbGF0ZXN0IGRhdGEuYCwgdXJsLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUuQ29uZmxpY3QsIGNvbnRleHQucmVzLnN0YXR1c0NvZGUsIG9wZXJhdGlvbklkKTtcblx0XHR9XG5cblx0XHRpZiAoY29udGV4dC5yZXMuc3RhdHVzQ29kZSA9PT0gNDEwKSB7XG5cdFx0XHR0aHJvdyBuZXcgVXNlckRhdGFTeW5jU3RvcmVFcnJvcihgJHtvcHRpb25zLnR5cGV9IHJlcXVlc3QgJyR7dXJsfScgZmFpbGVkIGJlY2F1c2UgdGhlIHJlcXVlc3RlZCByZXNvdXJjZSBpcyBub3QgbG9uZ2VyIGF2YWlsYWJsZSAoNDEwKS5gLCB1cmwsIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5Hb25lLCBjb250ZXh0LnJlcy5zdGF0dXNDb2RlLCBvcGVyYXRpb25JZCk7XG5cdFx0fVxuXG5cdFx0aWYgKGNvbnRleHQucmVzLnN0YXR1c0NvZGUgPT09IDQxMikge1xuXHRcdFx0dGhyb3cgbmV3IFVzZXJEYXRhU3luY1N0b3JlRXJyb3IoYCR7b3B0aW9ucy50eXBlfSByZXF1ZXN0ICcke3VybH0nIGZhaWxlZCBiZWNhdXNlIG9mIFByZWNvbmRpdGlvbiBGYWlsZWQgKDQxMikuIFRoZXJlIGlzIG5ldyBkYXRhIGZvciB0aGlzIHJlc291cmNlLiBNYWtlIHRoZSByZXF1ZXN0IGFnYWluIHdpdGggbGF0ZXN0IGRhdGEuYCwgdXJsLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUuUHJlY29uZGl0aW9uRmFpbGVkLCBjb250ZXh0LnJlcy5zdGF0dXNDb2RlLCBvcGVyYXRpb25JZCk7XG5cdFx0fVxuXG5cdFx0aWYgKGNvbnRleHQucmVzLnN0YXR1c0NvZGUgPT09IDQxMykge1xuXHRcdFx0dGhyb3cgbmV3IFVzZXJEYXRhU3luY1N0b3JlRXJyb3IoYCR7b3B0aW9ucy50eXBlfSByZXF1ZXN0ICcke3VybH0nIGZhaWxlZCBiZWNhdXNlIG9mIHRvbyBsYXJnZSBwYXlsb2FkICg0MTMpLmAsIHVybCwgVXNlckRhdGFTeW5jRXJyb3JDb2RlLlRvb0xhcmdlLCBjb250ZXh0LnJlcy5zdGF0dXNDb2RlLCBvcGVyYXRpb25JZCk7XG5cdFx0fVxuXG5cdFx0aWYgKGNvbnRleHQucmVzLnN0YXR1c0NvZGUgPT09IDQyNikge1xuXHRcdFx0dGhyb3cgbmV3IFVzZXJEYXRhU3luY1N0b3JlRXJyb3IoYCR7b3B0aW9ucy50eXBlfSByZXF1ZXN0ICcke3VybH0nIGZhaWxlZCB3aXRoIHN0YXR1cyBVcGdyYWRlIFJlcXVpcmVkICg0MjYpLiBQbGVhc2UgdXBncmFkZSB0aGUgY2xpZW50IGFuZCB0cnkgYWdhaW4uYCwgdXJsLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUuVXBncmFkZVJlcXVpcmVkLCBjb250ZXh0LnJlcy5zdGF0dXNDb2RlLCBvcGVyYXRpb25JZCk7XG5cdFx0fVxuXG5cdFx0aWYgKGNvbnRleHQucmVzLnN0YXR1c0NvZGUgPT09IDQyOSkge1xuXHRcdFx0Y29uc3QgcmV0cnlBZnRlciA9IGNvbnRleHQucmVzLmhlYWRlcnNbJ3JldHJ5LWFmdGVyJ107XG5cdFx0XHRpZiAocmV0cnlBZnRlcikge1xuXHRcdFx0XHR0aGlzLnNldERvbm90TWFrZVJlcXVlc3RzVW50aWwobmV3IERhdGUoRGF0ZS5ub3coKSArIChwYXJzZUludChyZXRyeUFmdGVyKSAqIDEwMDApKSk7XG5cdFx0XHRcdHRocm93IG5ldyBVc2VyRGF0YVN5bmNTdG9yZUVycm9yKGAke29wdGlvbnMudHlwZX0gcmVxdWVzdCAnJHt1cmx9JyBmYWlsZWQgYmVjYXVzZSBvZiB0b28gbWFueSByZXF1ZXN0cyAoNDI5KS5gLCB1cmwsIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5Ub29NYW55UmVxdWVzdHNBbmRSZXRyeUFmdGVyLCBjb250ZXh0LnJlcy5zdGF0dXNDb2RlLCBvcGVyYXRpb25JZCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aHJvdyBuZXcgVXNlckRhdGFTeW5jU3RvcmVFcnJvcihgJHtvcHRpb25zLnR5cGV9IHJlcXVlc3QgJyR7dXJsfScgZmFpbGVkIGJlY2F1c2Ugb2YgdG9vIG1hbnkgcmVxdWVzdHMgKDQyOSkuYCwgdXJsLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUuVG9vTWFueVJlcXVlc3RzLCBjb250ZXh0LnJlcy5zdGF0dXNDb2RlLCBvcGVyYXRpb25JZCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFpc1N1Y2Nlc3MpIHtcblx0XHRcdHRocm93IG5ldyBVc2VyRGF0YVN5bmNTdG9yZUVycm9yKCdTZXJ2ZXIgcmV0dXJuZWQgJyArIGNvbnRleHQucmVzLnN0YXR1c0NvZGUsIHVybCwgVXNlckRhdGFTeW5jRXJyb3JDb2RlLlVua25vd24sIGNvbnRleHQucmVzLnN0YXR1c0NvZGUsIG9wZXJhdGlvbklkKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gY29udGV4dDtcblx0fVxuXG5cdHByaXZhdGUgYWRkU2Vzc2lvbkhlYWRlcnMoaGVhZGVyczogSUhlYWRlcnMpOiB2b2lkIHtcblx0XHRsZXQgbWFjaGluZVNlc3Npb25JZCA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KE1BQ0hJTkVfU0VTU0lPTl9JRF9LRVksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdFx0aWYgKG1hY2hpbmVTZXNzaW9uSWQgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0bWFjaGluZVNlc3Npb25JZCA9IGdlbmVyYXRlVXVpZCgpO1xuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShNQUNISU5FX1NFU1NJT05fSURfS0VZLCBtYWNoaW5lU2Vzc2lvbklkLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0fVxuXHRcdGhlYWRlcnNbJ1gtTWFjaGluZS1TZXNzaW9uLUlkJ10gPSBtYWNoaW5lU2Vzc2lvbklkO1xuXG5cdFx0Y29uc3QgdXNlclNlc3Npb25JZCA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KFVTRVJfU0VTU0lPTl9JRF9LRVksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdFx0aWYgKHVzZXJTZXNzaW9uSWQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0aGVhZGVyc1snWC1Vc2VyLVNlc3Npb24tSWQnXSA9IHVzZXJTZXNzaW9uSWQ7XG5cdFx0fVxuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIFVzZXJEYXRhU3luY1N0b3JlU2VydmljZSBleHRlbmRzIFVzZXJEYXRhU3luY1N0b3JlQ2xpZW50IGltcGxlbWVudHMgSVVzZXJEYXRhU3luY1N0b3JlU2VydmljZSB7XG5cblx0X3NlcnZpY2VCcmFuZDogYW55O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZSB1c2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlOiBJVXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElSZXF1ZXN0U2VydmljZSByZXF1ZXN0U2VydmljZTogSVJlcXVlc3RTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jTG9nU2VydmljZSBsb2dTZXJ2aWNlOiBJVXNlckRhdGFTeW5jTG9nU2VydmljZSxcblx0XHRASUVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2Ugc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIodXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZS51c2VyRGF0YVN5bmNTdG9yZT8udXJsLCBwcm9kdWN0U2VydmljZSwgcmVxdWVzdFNlcnZpY2UsIGxvZ1NlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSwgZmlsZVNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih1c2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlVXNlckRhdGFTeW5jU3RvcmUoKCkgPT4gdGhpcy51cGRhdGVVc2VyRGF0YVN5bmNTdG9yZVVybCh1c2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY1N0b3JlPy51cmwpKSk7XG5cdH1cblxufVxuXG5leHBvcnQgY2xhc3MgUmVxdWVzdHNTZXNzaW9uIHtcblxuXHRwcml2YXRlIHJlcXVlc3RzOiBzdHJpbmdbXSA9IFtdO1xuXHRwcml2YXRlIHN0YXJ0VGltZTogRGF0ZSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGxpbWl0OiBudW1iZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBpbnRlcnZhbDogbnVtYmVyLCAvKiBpbiBtcyAqL1xuXHRcdHByaXZhdGUgcmVhZG9ubHkgcmVxdWVzdFNlcnZpY2U6IElSZXF1ZXN0U2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElVc2VyRGF0YVN5bmNMb2dTZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdHJlcXVlc3QodXJsOiBzdHJpbmcsIG9wdGlvbnM6IElSZXF1ZXN0T3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJUmVxdWVzdENvbnRleHQ+IHtcblx0XHRpZiAodGhpcy5pc0V4cGlyZWQoKSkge1xuXHRcdFx0dGhpcy5yZXNldCgpO1xuXHRcdH1cblxuXHRcdG9wdGlvbnMudXJsID0gdXJsO1xuXG5cdFx0aWYgKHRoaXMucmVxdWVzdHMubGVuZ3RoID49IHRoaXMubGltaXQpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS5pbmZvKCdUb28gbWFueSByZXF1ZXN0cycsIC4uLnRoaXMucmVxdWVzdHMpO1xuXHRcdFx0dGhyb3cgbmV3IFVzZXJEYXRhU3luY1N0b3JlRXJyb3IoYFRvbyBtYW55IHJlcXVlc3RzLiBPbmx5ICR7dGhpcy5saW1pdH0gcmVxdWVzdHMgYWxsb3dlZCBpbiAke3RoaXMuaW50ZXJ2YWwgLyAoMTAwMCAqIDYwKX0gbWludXRlcy5gLCB1cmwsIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5Mb2NhbFRvb01hbnlSZXF1ZXN0cywgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHRcdH1cblxuXHRcdHRoaXMuc3RhcnRUaW1lID0gdGhpcy5zdGFydFRpbWUgfHwgbmV3IERhdGUoKTtcblx0XHR0aGlzLnJlcXVlc3RzLnB1c2godXJsKTtcblxuXHRcdHJldHVybiB0aGlzLnJlcXVlc3RTZXJ2aWNlLnJlcXVlc3Qob3B0aW9ucywgdG9rZW4pO1xuXHR9XG5cblx0cHJpdmF0ZSBpc0V4cGlyZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuc3RhcnRUaW1lICE9PSB1bmRlZmluZWQgJiYgbmV3IERhdGUoKS5nZXRUaW1lKCkgLSB0aGlzLnN0YXJ0VGltZS5nZXRUaW1lKCkgPiB0aGlzLmludGVydmFsO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNldCgpOiB2b2lkIHtcblx0XHR0aGlzLnJlcXVlc3RzID0gW107XG5cdFx0dGhpcy5zdGFydFRpbWUgPSB1bmRlZmluZWQ7XG5cdH1cblxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUE0Qix5QkFBeUIsZUFBZTtBQUNwRSxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGlCQUFpQiwyQkFBMkI7QUFDckQsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxZQUFZLGlCQUFpQixvQkFBb0I7QUFDMUQsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsYUFBYTtBQUV0QixTQUFTLFVBQVUsb0JBQW9CO0FBQ3ZDLFNBQVMsVUFBVSxnQkFBZ0I7QUFDbkMsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsUUFBUSxRQUFRLGVBQWUsY0FBYyxpQkFBaUIsV0FBVyxhQUFhLHdCQUF3QjtBQUN2SCxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGlCQUFpQixjQUFjLHFCQUFxQjtBQUM3RCxTQUFTLHFCQUFxQixxQkFBZ0cseUJBQTZDLHFDQUFnRix1QkFBdUIsdUJBQXVCLDhCQUFxRDtBQUc5VixNQUFNLCtCQUErQjtBQUNyQyxNQUFNLHNCQUFzQjtBQUM1QixNQUFNLGdDQUFnQztBQUN0QyxNQUFNLHNCQUFzQjtBQUM1QixNQUFNLHlCQUF5QjtBQUMvQixNQUFNLHdCQUF3QjtBQUM5QixNQUFNLDJCQUEyQixNQUFPLEtBQUs7QUFJdEMsSUFBZSw2Q0FBZixjQUFrRSxXQUEwRDtBQUFBLEVBZ0JsSSxZQUNxQyxnQkFDTSxzQkFDTixnQkFDbkM7QUFDRCxVQUFNO0FBSjhCO0FBQ007QUFDTjtBQWZyQyxTQUFpQixnQ0FBZ0MsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBQ25GLFNBQVMsK0JBQStC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
