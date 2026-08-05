import { bufferToStream, VSBuffer } from "../../../../base/common/buffer.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { joinPath } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { IConfigurationService } from "../../../configuration/common/configuration.js";
import { ConfigurationService } from "../../../configuration/common/configurationService.js";
import { IEnvironmentService } from "../../../environment/common/environment.js";
import { GlobalExtensionEnablementService } from "../../../extensionManagement/common/extensionEnablementService.js";
import { IExtensionGalleryService, IExtensionManagementService, IGlobalExtensionEnablementService } from "../../../extensionManagement/common/extensionManagement.js";
import { IFileService } from "../../../files/common/files.js";
import { FileService } from "../../../files/common/fileService.js";
import { InMemoryFileSystemProvider } from "../../../files/common/inMemoryFilesystemProvider.js";
import { TestInstantiationService } from "../../../instantiation/test/common/instantiationServiceMock.js";
import { ILogService, NullLogService } from "../../../log/common/log.js";
import product from "../../../product/common/product.js";
import { IProductService } from "../../../product/common/productService.js";
import { IRequestService } from "../../../request/common/request.js";
import { InMemoryStorageService, IStorageService } from "../../../storage/common/storage.js";
import { ITelemetryService } from "../../../telemetry/common/telemetry.js";
import { NullTelemetryService } from "../../../telemetry/common/telemetryUtils.js";
import { IUriIdentityService } from "../../../uriIdentity/common/uriIdentity.js";
import { UriIdentityService } from "../../../uriIdentity/common/uriIdentityService.js";
import { ExtensionStorageService, IExtensionStorageService } from "../../../extensionManagement/common/extensionStorage.js";
import { IgnoredExtensionsManagementService, IIgnoredExtensionsManagementService } from "../../common/ignoredExtensions.js";
import { ALL_SYNC_RESOURCES, getDefaultIgnoredSettings, IUserDataSyncLocalStoreService, IUserDataSyncLogService, IUserDataSyncEnablementService, IUserDataSyncService, IUserDataSyncStoreManagementService, IUserDataSyncStoreService, IUserDataSyncUtilService, registerConfiguration, SyncResource, USER_DATA_SYNC_SCHEME } from "../../common/userDataSync.js";
import { IUserDataSyncAccountService, UserDataSyncAccountService } from "../../common/userDataSyncAccount.js";
import { UserDataSyncLocalStoreService } from "../../common/userDataSyncLocalStoreService.js";
import { IUserDataSyncMachinesService, UserDataSyncMachinesService } from "../../common/userDataSyncMachines.js";
import { UserDataSyncEnablementService } from "../../common/userDataSyncEnablementService.js";
import { UserDataSyncService } from "../../common/userDataSyncService.js";
import { UserDataSyncStoreManagementService, UserDataSyncStoreService } from "../../common/userDataSyncStoreService.js";
import { InMemoryUserDataProfilesService, IUserDataProfilesService } from "../../../userDataProfile/common/userDataProfile.js";
import { NullPolicyService } from "../../../policy/common/policy.js";
import { IUserDataProfileStorageService } from "../../../userDataProfile/common/userDataProfileStorageService.js";
import { TestUserDataProfileStorageService } from "../../../userDataProfile/test/common/userDataProfileStorageService.test.js";
class UserDataSyncClient extends Disposable {
  constructor(testServer = new UserDataSyncTestServer()) {
    super();
    this.testServer = testServer;
    this.instantiationService = this._register(new TestInstantiationService());
  }
  async setUp(empty = false) {
    this._register(registerConfiguration());
    const logService = this.instantiationService.stub(ILogService, new NullLogService());
    const userRoamingDataHome = URI.file("userdata").with({ scheme: Schemas.inMemory });
    const userDataSyncHome = joinPath(userRoamingDataHome, ".sync");
    const environmentService = this.instantiationService.stub(IEnvironmentService, {
      userDataSyncHome,
      userRoamingDataHome,
      cacheHome: joinPath(userRoamingDataHome, "cache"),
      argvResource: joinPath(userRoamingDataHome, "argv.json"),
      sync: "on"
    });
    this.instantiationService.stub(IProductService, {
      _serviceBrand: void 0,
      ...product,
      ...{
        "configurationSync.store": {
          url: this.testServer.url,
          stableUrl: this.testServer.url,
          insidersUrl: this.testServer.url,
          canSwitch: false,
          authenticationProviders: { "test": { scopes: [] } }
        }
      }
    });
    const fileService = this._register(new FileService(logService));
    this._register(fileService.registerProvider(Schemas.inMemory, this._register(new InMemoryFileSystemProvider())));
    this._register(fileService.registerProvider(USER_DATA_SYNC_SCHEME, this._register(new InMemoryFileSystemProvider())));
    this.instantiationService.stub(IFileService, fileService);
    const uriIdentityService = this._register(this.instantiationService.createInstance(UriIdentityService));
    this.instantiationService.stub(IUriIdentityService, uriIdentityService);
    const userDataProfilesService = this._register(new InMemoryUserDataProfilesService(environmentService, fileService, uriIdentityService, logService));
    this.instantiationService.stub(IUserDataProfilesService, userDataProfilesService);
    const storageService = this._register(new TestStorageService(userDataProfilesService.defaultProfile));
    this.instantiationService.stub(IStorageService, this._register(storageService));
    this.instantiationService.stub(IUserDataProfileStorageService, this._register(new TestUserDataProfileStorageService(false, storageService)));
    const configurationService = this._register(new ConfigurationService(userDataProfilesService.defaultProfile.settingsResource, fileService, new NullPolicyService(), logService));
    await configurationService.initialize();
    this.instantiationService.stub(IConfigurationService, configurationService);
    this.instantiationService.stub(IRequestService, this.testServer);
    this.instantiationService.stub(IUserDataSyncLogService, logService);
    this.instantiationService.stub(ITelemetryService, NullTelemetryService);
    this.instantiationService.stub(IUserDataSyncStoreManagementService, this._register(this.instantiationService.createInstance(UserDataSyncStoreManagementService)));
    this.instantiationService.stub(IUserDataSyncStoreService, this._register(this.instantiationService.createInstance(UserDataSyncStoreService)));
    const userDataSyncAccountService = this._register(this.instantiationService.createInstance(UserDataSyncAccountService));
    await userDataSyncAccountService.updateAccount({ authenticationProviderId: "authenticationProviderId", token: "token" });
    this.instantiationService.stub(IUserDataSyncAccountService, userDataSyncAccountService);
    this.instantiationService.stub(IUserDataSyncMachinesService, this._register(this.instantiationService.createInstance(UserDataSyncMachinesService)));
    this.instantiationService.stub(IUserDataSyncLocalStoreService, this._register(this.instantiationService.createInstance(UserDataSyncLocalStoreService)));
    this.instantiationService.stub(IUserDataSyncUtilService, new TestUserDataSyncUtilService());
    this.instantiationService.stub(IUserDataSyncEnablementService, this._register(this.instantiationService.createInstance(UserDataSyncEnablementService)));
    this.instantiationService.stub(IExtensionManagementService, {
      async getInstalled() {
        return [];
      },
      onDidInstallExtensions: new Emitter().event,
      onDidUninstallExtension: new Emitter().event
    });
    this.instantiationService.stub(IGlobalExtensionEnablementService, this._register(this.instantiationService.createInstance(GlobalExtensionEnablementService)));
    this.instantiationService.stub(IExtensionStorageService, this._register(this.instantiationService.createInstance(ExtensionStorageService)));
    this.instantiationService.stub(IIgnoredExtensionsManagementService, this.instantiationService.createInstance(IgnoredExtensionsManagementService));
    this.instantiationService.stub(IExtensionGalleryService, {
      isEnabled() {
        return true;
      },
      async getCompatibleExtension() {
        return null;
      }
    });
    this.instantiationService.stub(IUserDataSyncService, this._register(this.instantiationService.createInstance(UserDataSyncService)));
    if (!empty) {
      await fileService.writeFile(userDataProfilesService.defaultProfile.settingsResource, VSBuffer.fromString(JSON.stringify({})));
      await fileService.writeFile(userDataProfilesService.defaultProfile.keybindingsResource, VSBuffer.fromString(JSON.stringify([])));
      await fileService.writeFile(joinPath(userDataProfilesService.defaultProfile.snippetsHome, "c.json"), VSBuffer.fromString(`{}`));
      await fileService.writeFile(joinPath(userDataProfilesService.defaultProfile.promptsHome, "c.prompt.md"), VSBuffer.fromString(" "));
      await fileService.writeFile(userDataProfilesService.defaultProfile.tasksResource, VSBuffer.fromString(`{}`));
      await fileService.writeFile(environmentService.argvResource, VSBuffer.fromString(JSON.stringify({ "locale": "en" })));
    }
    await configurationService.reloadConfiguration();
    this.instantiationService.get(IUserDataSyncEnablementService).setResourceEnablement(SyncResource.Prompts, true);
  }
  async sync() {
    await (await this.instantiationService.get(IUserDataSyncService).createSyncTask(null)).run();
  }
  read(resource, collection) {
    return this.instantiationService.get(IUserDataSyncStoreService).readResource(resource, null, collection);
  }
  async getResourceManifest() {
    const manifest = await this.instantiationService.get(IUserDataSyncStoreService).manifest(null);
    return manifest?.latest ?? null;
  }
  getSynchronizer(source) {
    return this.instantiationService.get(IUserDataSyncService).getOrCreateActiveProfileSynchronizer(this.instantiationService.get(IUserDataProfilesService).defaultProfile, void 0).enabled.find((s) => s.resource === source);
  }
}
const ALL_SERVER_RESOURCES = [...ALL_SYNC_RESOURCES, "machines"];
class UserDataSyncTestServer {
  constructor(rateLimit = Number.MAX_SAFE_INTEGER, retryAfter) {
    this.rateLimit = rateLimit;
    this.retryAfter = retryAfter;
    this.url = "http://host:3000";
    this.session = null;
    this.collections = /* @__PURE__ */ new Map();
    this.data = /* @__PURE__ */ new Map();
    this._requests = [];
    this._requestsWithAllHeaders = [];
    this._responses = [];
    this.manifestRef = 0;
    this.collectionCounter = 0;
  }
  get requests() {
    return this._requests;
  }
  get requestsWithAllHeaders() {
    return this._requestsWithAllHeaders;
  }
  get responses() {
    return this._responses;
  }
  reset() {
    this._requests = [];
    this._responses = [];
    this._requestsWithAllHeaders = [];
  }
  async resolveProxy(url) {
    return url;
  }
  async lookupAuthorization(authInfo) {
    return void 0;
  }
  async lookupKerberosAuthorization(url) {
    return void 0;
  }
  async loadCertificates() {
    return [];
  }
  async request(options, token) {
    if (this._requests.length === this.rateLimit) {
      return this.toResponse(429, this.retryAfter ? { "retry-after": `${this.retryAfter}` } : void 0);
    }
    const headers = {};
    if (options.headers) {
      if (options.headers["If-None-Match"]) {
        headers["If-None-Match"] = options.headers["If-None-Match"];
      }
      if (options.headers["If-Match"]) {
        headers["If-Match"] = options.headers["If-Match"];
      }
    }
    this._requests.push({ url: options.url, type: options.type, headers });
    this._requestsWithAllHeaders.push({ url: options.url, type: options.type, headers: options.headers });
    const requestContext = await this.doRequest(options);
    this._responses.push({ status: requestContext.res.statusCode });
    return requestContext;
  }
  async doRequest(options) {
    const versionUrl = `${this.url}/v1/`;
    const relativePath = options.url.indexOf(versionUrl) === 0 ? options.url.substring(versionUrl.length) : void 0;
    const segments = relativePath ? relativePath.split("/") : [];
    if (options.type === "GET" && segments.length === 1 && segments[0] === "manifest") {
      return this.getManifest(options.headers);
    }
    if (options.type === "GET" && segments.length === 3 && segments[0] === "resource") {
      return this.getResourceData(void 0, segments[1], segments[2] === "latest" ? void 0 : segments[2], options.headers);
    }
    if (options.type === "POST" && segments.length === 2 && segments[0] === "resource") {
      return this.writeData(void 0, segments[1], options.data, options.headers);
    }
    if (options.type === "GET" && segments.length === 5 && segments[0] === "collection" && segments[2] === "resource") {
      return this.getResourceData(segments[1], segments[3], segments[4] === "latest" ? void 0 : segments[4], options.headers);
    }
    if (options.type === "POST" && segments.length === 4 && segments[0] === "collection" && segments[2] === "resource") {
      return this.writeData(segments[1], segments[3], options.data, options.headers);
    }
    if (options.type === "DELETE" && segments.length === 2 && segments[0] === "resource") {
      return this.deleteResourceData(void 0, segments[1]);
    }
    if (options.type === "DELETE" && segments.length === 1 && segments[0] === "resource") {
      return this.clear(options.headers);
    }
    if (options.type === "DELETE" && segments[0] === "collection") {
      return this.toResponse(204);
    }
    if (options.type === "POST" && segments.length === 1 && segments[0] === "collection") {
      return this.createCollection();
    }
    return this.toResponse(501);
  }
  async getManifest(headers) {
    if (this.session) {
      const latest = /* @__PURE__ */ Object.create({});
      this.data.forEach((value, key) => latest[key] = value.ref);
      let collection = void 0;
      if (this.collectionCounter) {
        collection = {};
        for (let collectionId = 1; collectionId <= this.collectionCounter; collectionId++) {
          const collectionData = this.collections.get(`${collectionId}`);
          if (collectionData) {
            const latest2 = /* @__PURE__ */ Object.create({});
            collectionData.forEach((value, key) => latest2[key] = value.ref);
            collection[`${collectionId}`] = { latest: latest2 };
          }
        }
      }
      const manifest = { session: this.session, latest, collection };
      return this.toResponse(200, { "Content-Type": "application/json", etag: `${this.manifestRef++}` }, JSON.stringify(manifest));
    }
    return this.toResponse(204, { etag: `${this.manifestRef++}` });
  }
  async getResourceData(collection, resource, ref, headers = {}) {
    const collectionData = collection ? this.collections.get(collection) : this.data;
    if (!collectionData) {
      return this.toResponse(501);
    }
    const resourceKey = ALL_SERVER_RESOURCES.find((key) => key === resource);
    if (resourceKey) {
      const data = collectionData.get(resourceKey);
      if (ref && data?.ref !== ref) {
        return this.toResponse(404);
      }
      if (!data) {
        return this.toResponse(204, { etag: "0" });
      }
      if (headers["If-None-Match"] === data.ref) {
        return this.toResponse(304);
      }
      return this.toResponse(200, { etag: data.ref }, data.content || "");
    }
    return this.toResponse(204);
  }
  async writeData(collection, resource, content = "", headers = {}) {
    if (!this.session) {
      this.session = generateUuid();
    }
    const collectionData = collection ? this.collections.get(collection) : this.data;
    if (!collectionData) {
      return this.toResponse(501);
    }
    const resourceKey = ALL_SERVER_RESOURCES.find((key) => key === resource);
    if (resourceKey) {
      const data = collectionData.get(resourceKey);
      if (headers["If-Match"] !== void 0 && headers["If-Match"] !== (data ? data.ref : "0")) {
        return this.toResponse(412);
      }
      const ref = `${parseInt(data?.ref || "0") + 1}`;
      collectionData.set(resourceKey, { ref, content });
      return this.toResponse(200, { etag: ref });
    }
    return this.toResponse(204);
  }
  async deleteResourceData(collection, resource, headers = {}) {
    const collectionData = collection ? this.collections.get(collection) : this.data;
    if (!collectionData) {
      return this.toResponse(501);
    }
    const resourceKey = ALL_SERVER_RESOURCES.find((key) => key === resource);
    if (resourceKey) {
      collectionData.delete(resourceKey);
      return this.toResponse(200);
    }
    return this.toResponse(404);
  }
  async createCollection() {
    const collectionId = `${++this.collectionCounter}`;
    this.collections.set(collectionId, /* @__PURE__ */ new Map());
    return this.toResponse(200, {}, collectionId);
  }
  async clear(headers) {
    this.collections.clear();
    this.data.clear();
    this.session = null;
    this.collectionCounter = 0;
    return this.toResponse(204);
  }
  toResponse(statusCode, headers, data) {
    return {
      res: {
        headers: headers || {},
        statusCode
      },
      stream: bufferToStream(VSBuffer.fromString(data || ""))
    };
  }
}
class TestUserDataSyncUtilService {
  async resolveDefaultCoreIgnoredSettings() {
    return getDefaultIgnoredSettings();
  }
  async resolveUserBindings(userbindings) {
    const keys = {};
    for (const keybinding of userbindings) {
      keys[keybinding] = keybinding;
    }
    return keys;
  }
  async resolveFormattingOptions(file) {
    return { eol: "\n", insertSpaces: false, tabSize: 4 };
  }
}
class TestStorageService extends InMemoryStorageService {
  constructor(profileStorageProfile) {
    super();
    this.profileStorageProfile = profileStorageProfile;
  }
  hasScope(profile) {
    return this.profileStorageProfile.id === profile.id;
  }
}
export {
  TestUserDataSyncUtilService,
  UserDataSyncClient,
  UserDataSyncTestServer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvdGVzdC9jb21tb24vdXNlckRhdGFTeW5jQ2xpZW50LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgYnVmZmVyVG9TdHJlYW0sIFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElTdHJpbmdEaWN0aW9uYXJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29sbGVjdGlvbnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEZvcm1hdHRpbmdPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vanNvbkZvcm1hdHRlci5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IElIZWFkZXJzLCBJUmVxdWVzdENvbnRleHQsIElSZXF1ZXN0T3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvcGFydHMvcmVxdWVzdC9jb21tb24vcmVxdWVzdC5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBHbG9iYWxFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IERpZFVuaW5zdGFsbEV4dGVuc2lvbkV2ZW50LCBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UsIElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSwgSUdsb2JhbEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLCBJbnN0YWxsRXh0ZW5zaW9uUmVzdWx0IH0gZnJvbSAnLi4vLi4vLi4vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9maWxlcy9jb21tb24vZmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSW5NZW1vcnlGaWxlU3lzdGVtUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi9maWxlcy9jb21tb24vaW5NZW1vcnlGaWxlc3lzdGVtUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UsIE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHByb2R1Y3QgZnJvbSAnLi4vLi4vLi4vcHJvZHVjdC9jb21tb24vcHJvZHVjdC5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBBdXRoSW5mbywgQ3JlZGVudGlhbHMsIElSZXF1ZXN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3JlcXVlc3QvY29tbW9uL3JlcXVlc3QuanMnO1xuaW1wb3J0IHsgSW5NZW1vcnlTdG9yYWdlU2VydmljZSwgSVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IE51bGxUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnlVdGlscy5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IFVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uU3RvcmFnZVNlcnZpY2UsIElFeHRlbnNpb25TdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvblN0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSWdub3JlZEV4dGVuc2lvbnNNYW5hZ2VtZW50U2VydmljZSwgSUlnbm9yZWRFeHRlbnNpb25zTWFuYWdlbWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vaWdub3JlZEV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgQUxMX1NZTkNfUkVTT1VSQ0VTLCBnZXREZWZhdWx0SWdub3JlZFNldHRpbmdzLCBJVXNlckRhdGEsIElVc2VyRGF0YVN5bmNMb2NhbFN0b3JlU2VydmljZSwgSVVzZXJEYXRhU3luY0xvZ1NlcnZpY2UsIElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSwgSVVzZXJEYXRhU3luY1NlcnZpY2UsIElVc2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlLCBJVXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLCBJVXNlckRhdGFTeW5jVXRpbFNlcnZpY2UsIHJlZ2lzdGVyQ29uZmlndXJhdGlvbiwgU2VydmVyUmVzb3VyY2UsIFN5bmNSZXNvdXJjZSwgSVVzZXJEYXRhU3luY2hyb25pc2VyLCBJVXNlckRhdGFSZXNvdXJjZU1hbmlmZXN0LCBJVXNlckRhdGFDb2xsZWN0aW9uTWFuaWZlc3QsIFVTRVJfREFUQV9TWU5DX1NDSEVNRSB9IGZyb20gJy4uLy4uL2NvbW1vbi91c2VyRGF0YVN5bmMuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhU3luY0FjY291bnRTZXJ2aWNlLCBVc2VyRGF0YVN5bmNBY2NvdW50U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi91c2VyRGF0YVN5bmNBY2NvdW50LmpzJztcbmltcG9ydCB7IFVzZXJEYXRhU3luY0xvY2FsU3RvcmVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3VzZXJEYXRhU3luY0xvY2FsU3RvcmVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVN5bmNNYWNoaW5lc1NlcnZpY2UsIFVzZXJEYXRhU3luY01hY2hpbmVzU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi91c2VyRGF0YVN5bmNNYWNoaW5lcy5qcyc7XG5pbXBvcnQgeyBVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi91c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBVc2VyRGF0YVN5bmNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3VzZXJEYXRhU3luY1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgVXNlckRhdGFTeW5jU3RvcmVNYW5hZ2VtZW50U2VydmljZSwgVXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3VzZXJEYXRhU3luY1N0b3JlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJbk1lbW9yeVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLCBJVXNlckRhdGFQcm9maWxlLCBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBOdWxsUG9saWN5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BvbGljeS9jb21tb24vcG9saWN5LmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlU3RvcmFnZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdFVzZXJEYXRhUHJvZmlsZVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vdXNlckRhdGFQcm9maWxlL3Rlc3QvY29tbW9uL3VzZXJEYXRhUHJvZmlsZVN0b3JhZ2VTZXJ2aWNlLnRlc3QuanMnO1xuXG5leHBvcnQgY2xhc3MgVXNlckRhdGFTeW5jQ2xpZW50IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZTtcblxuXHRjb25zdHJ1Y3RvcihyZWFkb25seSB0ZXN0U2VydmVyOiBVc2VyRGF0YVN5bmNUZXN0U2VydmVyID0gbmV3IFVzZXJEYXRhU3luY1Rlc3RTZXJ2ZXIoKSkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UoKSk7XG5cdH1cblxuXHRhc3luYyBzZXRVcChlbXB0eTogYm9vbGVhbiA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJDb25maWd1cmF0aW9uKCkpO1xuXG5cdFx0Y29uc3QgbG9nU2VydmljZSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTG9nU2VydmljZSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXG5cdFx0Y29uc3QgdXNlclJvYW1pbmdEYXRhSG9tZSA9IFVSSS5maWxlKCd1c2VyZGF0YScpLndpdGgoeyBzY2hlbWU6IFNjaGVtYXMuaW5NZW1vcnkgfSk7XG5cdFx0Y29uc3QgdXNlckRhdGFTeW5jSG9tZSA9IGpvaW5QYXRoKHVzZXJSb2FtaW5nRGF0YUhvbWUsICcuc3luYycpO1xuXHRcdGNvbnN0IGVudmlyb25tZW50U2VydmljZSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRW52aXJvbm1lbnRTZXJ2aWNlLCB7XG5cdFx0XHR1c2VyRGF0YVN5bmNIb21lLFxuXHRcdFx0dXNlclJvYW1pbmdEYXRhSG9tZSxcblx0XHRcdGNhY2hlSG9tZTogam9pblBhdGgodXNlclJvYW1pbmdEYXRhSG9tZSwgJ2NhY2hlJyksXG5cdFx0XHRhcmd2UmVzb3VyY2U6IGpvaW5QYXRoKHVzZXJSb2FtaW5nRGF0YUhvbWUsICdhcmd2Lmpzb24nKSxcblx0XHRcdHN5bmM6ICdvbicsXG5cdFx0fSk7XG5cblx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVByb2R1Y3RTZXJ2aWNlLCB7XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQsIC4uLnByb2R1Y3QsIC4uLntcblx0XHRcdFx0J2NvbmZpZ3VyYXRpb25TeW5jLnN0b3JlJzoge1xuXHRcdFx0XHRcdHVybDogdGhpcy50ZXN0U2VydmVyLnVybCxcblx0XHRcdFx0XHRzdGFibGVVcmw6IHRoaXMudGVzdFNlcnZlci51cmwsXG5cdFx0XHRcdFx0aW5zaWRlcnNVcmw6IHRoaXMudGVzdFNlcnZlci51cmwsXG5cdFx0XHRcdFx0Y2FuU3dpdGNoOiBmYWxzZSxcblx0XHRcdFx0XHRhdXRoZW50aWNhdGlvblByb3ZpZGVyczogeyAndGVzdCc6IHsgc2NvcGVzOiBbXSB9IH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRmlsZVNlcnZpY2UobG9nU2VydmljZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGZpbGVTZXJ2aWNlLnJlZ2lzdGVyUHJvdmlkZXIoU2NoZW1hcy5pbk1lbW9yeSwgdGhpcy5fcmVnaXN0ZXIobmV3IEluTWVtb3J5RmlsZVN5c3RlbVByb3ZpZGVyKCkpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZmlsZVNlcnZpY2UucmVnaXN0ZXJQcm92aWRlcihVU0VSX0RBVEFfU1lOQ19TQ0hFTUUsIHRoaXMuX3JlZ2lzdGVyKG5ldyBJbk1lbW9yeUZpbGVTeXN0ZW1Qcm92aWRlcigpKSkpO1xuXHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRmlsZVNlcnZpY2UsIGZpbGVTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHVyaUlkZW50aXR5U2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVXJpSWRlbnRpdHlTZXJ2aWNlKSk7XG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVcmlJZGVudGl0eVNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZSk7XG5cblx0XHRjb25zdCB1c2VyRGF0YVByb2ZpbGVzU2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBJbk1lbW9yeVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKGVudmlyb25tZW50U2VydmljZSwgZmlsZVNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZSwgbG9nU2VydmljZSkpO1xuXHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsIHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHN0b3JhZ2VTZXJ2aWNlID0gdGhpcy5fcmVnaXN0ZXIobmV3IFRlc3RTdG9yYWdlU2VydmljZSh1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZSkpO1xuXHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU3RvcmFnZVNlcnZpY2UsIHRoaXMuX3JlZ2lzdGVyKHN0b3JhZ2VTZXJ2aWNlKSk7XG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVc2VyRGF0YVByb2ZpbGVTdG9yYWdlU2VydmljZSwgdGhpcy5fcmVnaXN0ZXIobmV3IFRlc3RVc2VyRGF0YVByb2ZpbGVTdG9yYWdlU2VydmljZShmYWxzZSwgc3RvcmFnZVNlcnZpY2UpKSk7XG5cblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBDb25maWd1cmF0aW9uU2VydmljZSh1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5zZXR0aW5nc1Jlc291cmNlLCBmaWxlU2VydmljZSwgbmV3IE51bGxQb2xpY3lTZXJ2aWNlKCksIGxvZ1NlcnZpY2UpKTtcblx0XHRhd2FpdCBjb25maWd1cmF0aW9uU2VydmljZS5pbml0aWFsaXplKCk7XG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb25maWd1cmF0aW9uU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElSZXF1ZXN0U2VydmljZSwgdGhpcy50ZXN0U2VydmVyKTtcblxuXHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVXNlckRhdGFTeW5jTG9nU2VydmljZSwgbG9nU2VydmljZSk7XG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUZWxlbWV0cnlTZXJ2aWNlLCBOdWxsVGVsZW1ldHJ5U2VydmljZSk7XG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVc2VyRGF0YVN5bmNTdG9yZU1hbmFnZW1lbnRTZXJ2aWNlLCB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFVzZXJEYXRhU3luY1N0b3JlTWFuYWdlbWVudFNlcnZpY2UpKSk7XG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVc2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UsIHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlKSkpO1xuXG5cdFx0Y29uc3QgdXNlckRhdGFTeW5jQWNjb3VudFNlcnZpY2U6IElVc2VyRGF0YVN5bmNBY2NvdW50U2VydmljZSA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVXNlckRhdGFTeW5jQWNjb3VudFNlcnZpY2UpKTtcblx0XHRhd2FpdCB1c2VyRGF0YVN5bmNBY2NvdW50U2VydmljZS51cGRhdGVBY2NvdW50KHsgYXV0aGVudGljYXRpb25Qcm92aWRlcklkOiAnYXV0aGVudGljYXRpb25Qcm92aWRlcklkJywgdG9rZW46ICd0b2tlbicgfSk7XG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVc2VyRGF0YVN5bmNBY2NvdW50U2VydmljZSwgdXNlckRhdGFTeW5jQWNjb3VudFNlcnZpY2UpO1xuXG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVc2VyRGF0YVN5bmNNYWNoaW5lc1NlcnZpY2UsIHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVXNlckRhdGFTeW5jTWFjaGluZXNTZXJ2aWNlKSkpO1xuXHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVXNlckRhdGFTeW5jTG9jYWxTdG9yZVNlcnZpY2UsIHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVXNlckRhdGFTeW5jTG9jYWxTdG9yZVNlcnZpY2UpKSk7XG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVc2VyRGF0YVN5bmNVdGlsU2VydmljZSwgbmV3IFRlc3RVc2VyRGF0YVN5bmNVdGlsU2VydmljZSgpKTtcblx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLCB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlKSkpO1xuXG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSwge1xuXHRcdFx0YXN5bmMgZ2V0SW5zdGFsbGVkKCkgeyByZXR1cm4gW107IH0sXG5cdFx0XHRvbkRpZEluc3RhbGxFeHRlbnNpb25zOiBuZXcgRW1pdHRlcjxyZWFkb25seSBJbnN0YWxsRXh0ZW5zaW9uUmVzdWx0W10+KCkuZXZlbnQsXG5cdFx0XHRvbkRpZFVuaW5zdGFsbEV4dGVuc2lvbjogbmV3IEVtaXR0ZXI8RGlkVW5pbnN0YWxsRXh0ZW5zaW9uRXZlbnQ+KCkuZXZlbnQsXG5cdFx0fSk7XG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElHbG9iYWxFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSwgdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShHbG9iYWxFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSkpKTtcblx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUV4dGVuc2lvblN0b3JhZ2VTZXJ2aWNlLCB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvblN0b3JhZ2VTZXJ2aWNlKSkpO1xuXHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJSWdub3JlZEV4dGVuc2lvbnNNYW5hZ2VtZW50U2VydmljZSwgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJZ25vcmVkRXh0ZW5zaW9uc01hbmFnZW1lbnRTZXJ2aWNlKSk7XG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSwge1xuXHRcdFx0aXNFbmFibGVkKCkgeyByZXR1cm4gdHJ1ZTsgfSxcblx0XHRcdGFzeW5jIGdldENvbXBhdGlibGVFeHRlbnNpb24oKSB7IHJldHVybiBudWxsOyB9XG5cdFx0fSk7XG5cblx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVVzZXJEYXRhU3luY1NlcnZpY2UsIHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVXNlckRhdGFTeW5jU2VydmljZSkpKTtcblxuXHRcdGlmICghZW1wdHkpIHtcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLndyaXRlRmlsZSh1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5zZXR0aW5nc1Jlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKEpTT04uc3RyaW5naWZ5KHt9KSkpO1xuXHRcdFx0YXdhaXQgZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLmtleWJpbmRpbmdzUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoW10pKSk7XG5cdFx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUoam9pblBhdGgodXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuc25pcHBldHNIb21lLCAnYy5qc29uJyksIFZTQnVmZmVyLmZyb21TdHJpbmcoYHt9YCkpO1xuXHRcdFx0YXdhaXQgZmlsZVNlcnZpY2Uud3JpdGVGaWxlKGpvaW5QYXRoKHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLnByb21wdHNIb21lLCAnYy5wcm9tcHQubWQnKSwgVlNCdWZmZXIuZnJvbVN0cmluZygnICcpKTtcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLndyaXRlRmlsZSh1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS50YXNrc1Jlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKGB7fWApKTtcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLndyaXRlRmlsZShlbnZpcm9ubWVudFNlcnZpY2UuYXJndlJlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKEpTT04uc3RyaW5naWZ5KHsgJ2xvY2FsZSc6ICdlbicgfSkpKTtcblx0XHR9XG5cdFx0YXdhaXQgY29uZmlndXJhdGlvblNlcnZpY2UucmVsb2FkQ29uZmlndXJhdGlvbigpO1xuXG5cdFx0Ly8gYHByb21wdHNgIHJlc291cmNlIGlzIGRpc2FibGVkIGJ5IGRlZmF1bHQsIHNvIGVuYWJsZSBpdCBmb3IgdGVzdHNcblx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlXG5cdFx0XHQuZ2V0KElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSlcblx0XHRcdC5zZXRSZXNvdXJjZUVuYWJsZW1lbnQoU3luY1Jlc291cmNlLlByb21wdHMsIHRydWUpO1xuXHR9XG5cblx0YXN5bmMgc3luYygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCAoYXdhaXQgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhU3luY1NlcnZpY2UpLmNyZWF0ZVN5bmNUYXNrKG51bGwpKS5ydW4oKTtcblx0fVxuXG5cdHJlYWQocmVzb3VyY2U6IFN5bmNSZXNvdXJjZSwgY29sbGVjdGlvbj86IHN0cmluZyk6IFByb21pc2U8SVVzZXJEYXRhPiB7XG5cdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UpLnJlYWRSZXNvdXJjZShyZXNvdXJjZSwgbnVsbCwgY29sbGVjdGlvbik7XG5cdH1cblxuXHRhc3luYyBnZXRSZXNvdXJjZU1hbmlmZXN0KCk6IFByb21pc2U8SVVzZXJEYXRhUmVzb3VyY2VNYW5pZmVzdCB8IG51bGw+IHtcblx0XHRjb25zdCBtYW5pZmVzdCA9IGF3YWl0IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UpLm1hbmlmZXN0KG51bGwpO1xuXHRcdHJldHVybiBtYW5pZmVzdD8ubGF0ZXN0ID8/IG51bGw7XG5cdH1cblxuXHRnZXRTeW5jaHJvbml6ZXIoc291cmNlOiBTeW5jUmVzb3VyY2UpOiBJVXNlckRhdGFTeW5jaHJvbmlzZXIge1xuXHRcdHJldHVybiAodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhU3luY1NlcnZpY2UpIGFzIFVzZXJEYXRhU3luY1NlcnZpY2UpLmdldE9yQ3JlYXRlQWN0aXZlUHJvZmlsZVN5bmNocm9uaXplcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlLCB1bmRlZmluZWQpLmVuYWJsZWQuZmluZChzID0+IHMucmVzb3VyY2UgPT09IHNvdXJjZSkhO1xuXHR9XG5cbn1cblxuY29uc3QgQUxMX1NFUlZFUl9SRVNPVVJDRVM6IFNlcnZlclJlc291cmNlW10gPSBbLi4uQUxMX1NZTkNfUkVTT1VSQ0VTLCAnbWFjaGluZXMnXTtcblxuZXhwb3J0IGNsYXNzIFVzZXJEYXRhU3luY1Rlc3RTZXJ2ZXIgaW1wbGVtZW50cyBJUmVxdWVzdFNlcnZpY2Uge1xuXG5cdF9zZXJ2aWNlQnJhbmQ6IGFueTtcblxuXHRyZWFkb25seSB1cmw6IHN0cmluZyA9ICdodHRwOi8vaG9zdDozMDAwJztcblx0cHJpdmF0ZSBzZXNzaW9uOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSByZWFkb25seSBjb2xsZWN0aW9ucyA9IG5ldyBNYXA8c3RyaW5nLCBNYXA8U2VydmVyUmVzb3VyY2UsIElVc2VyRGF0YT4+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZGF0YSA9IG5ldyBNYXA8U2VydmVyUmVzb3VyY2UsIElVc2VyRGF0YT4oKTtcblxuXHRwcml2YXRlIF9yZXF1ZXN0czogeyB1cmw6IHN0cmluZzsgdHlwZTogc3RyaW5nOyBoZWFkZXJzPzogSUhlYWRlcnMgfVtdID0gW107XG5cdGdldCByZXF1ZXN0cygpOiB7IHVybDogc3RyaW5nOyB0eXBlOiBzdHJpbmc7IGhlYWRlcnM/OiBJSGVhZGVycyB9W10geyByZXR1cm4gdGhpcy5fcmVxdWVzdHM7IH1cblxuXHRwcml2YXRlIF9yZXF1ZXN0c1dpdGhBbGxIZWFkZXJzOiB7IHVybDogc3RyaW5nOyB0eXBlOiBzdHJpbmc7IGhlYWRlcnM/OiBJSGVhZGVycyB9W10gPSBbXTtcblx0Z2V0IHJlcXVlc3RzV2l0aEFsbEhlYWRlcnMoKTogeyB1cmw6IHN0cmluZzsgdHlwZTogc3RyaW5nOyBoZWFkZXJzPzogSUhlYWRlcnMgfVtdIHsgcmV0dXJuIHRoaXMuX3JlcXVlc3RzV2l0aEFsbEhlYWRlcnM7IH1cblxuXHRwcml2YXRlIF9yZXNwb25zZXM6IHsgc3RhdHVzOiBudW1iZXIgfVtdID0gW107XG5cdGdldCByZXNwb25zZXMoKTogeyBzdGF0dXM6IG51bWJlciB9W10geyByZXR1cm4gdGhpcy5fcmVzcG9uc2VzOyB9XG5cdHJlc2V0KCk6IHZvaWQgeyB0aGlzLl9yZXF1ZXN0cyA9IFtdOyB0aGlzLl9yZXNwb25zZXMgPSBbXTsgdGhpcy5fcmVxdWVzdHNXaXRoQWxsSGVhZGVycyA9IFtdOyB9XG5cblx0cHJpdmF0ZSBtYW5pZmVzdFJlZiA9IDA7XG5cdHByaXZhdGUgY29sbGVjdGlvbkNvdW50ZXIgPSAwO1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgcmF0ZUxpbWl0ID0gTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIsIHByaXZhdGUgcmVhZG9ubHkgcmV0cnlBZnRlcj86IG51bWJlcikgeyB9XG5cblx0YXN5bmMgcmVzb2x2ZVByb3h5KHVybDogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHsgcmV0dXJuIHVybDsgfVxuXHRhc3luYyBsb29rdXBBdXRob3JpemF0aW9uKGF1dGhJbmZvOiBBdXRoSW5mbyk6IFByb21pc2U8Q3JlZGVudGlhbHMgfCB1bmRlZmluZWQ+IHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRhc3luYyBsb29rdXBLZXJiZXJvc0F1dGhvcml6YXRpb24odXJsOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4geyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdGFzeW5jIGxvYWRDZXJ0aWZpY2F0ZXMoKTogUHJvbWlzZTxzdHJpbmdbXT4geyByZXR1cm4gW107IH1cblxuXHRhc3luYyByZXF1ZXN0KG9wdGlvbnM6IElSZXF1ZXN0T3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJUmVxdWVzdENvbnRleHQ+IHtcblx0XHRpZiAodGhpcy5fcmVxdWVzdHMubGVuZ3RoID09PSB0aGlzLnJhdGVMaW1pdCkge1xuXHRcdFx0cmV0dXJuIHRoaXMudG9SZXNwb25zZSg0MjksIHRoaXMucmV0cnlBZnRlciA/IHsgJ3JldHJ5LWFmdGVyJzogYCR7dGhpcy5yZXRyeUFmdGVyfWAgfSA6IHVuZGVmaW5lZCk7XG5cdFx0fVxuXHRcdGNvbnN0IGhlYWRlcnM6IElIZWFkZXJzID0ge307XG5cdFx0aWYgKG9wdGlvbnMuaGVhZGVycykge1xuXHRcdFx0aWYgKG9wdGlvbnMuaGVhZGVyc1snSWYtTm9uZS1NYXRjaCddKSB7XG5cdFx0XHRcdGhlYWRlcnNbJ0lmLU5vbmUtTWF0Y2gnXSA9IG9wdGlvbnMuaGVhZGVyc1snSWYtTm9uZS1NYXRjaCddO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG9wdGlvbnMuaGVhZGVyc1snSWYtTWF0Y2gnXSkge1xuXHRcdFx0XHRoZWFkZXJzWydJZi1NYXRjaCddID0gb3B0aW9ucy5oZWFkZXJzWydJZi1NYXRjaCddO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9yZXF1ZXN0cy5wdXNoKHsgdXJsOiBvcHRpb25zLnVybCEsIHR5cGU6IG9wdGlvbnMudHlwZSEsIGhlYWRlcnMgfSk7XG5cdFx0dGhpcy5fcmVxdWVzdHNXaXRoQWxsSGVhZGVycy5wdXNoKHsgdXJsOiBvcHRpb25zLnVybCEsIHR5cGU6IG9wdGlvbnMudHlwZSEsIGhlYWRlcnM6IG9wdGlvbnMuaGVhZGVycyB9KTtcblx0XHRjb25zdCByZXF1ZXN0Q29udGV4dCA9IGF3YWl0IHRoaXMuZG9SZXF1ZXN0KG9wdGlvbnMpO1xuXHRcdHRoaXMuX3Jlc3BvbnNlcy5wdXNoKHsgc3RhdHVzOiByZXF1ZXN0Q29udGV4dC5yZXMuc3RhdHVzQ29kZSEgfSk7XG5cdFx0cmV0dXJuIHJlcXVlc3RDb250ZXh0O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1JlcXVlc3Qob3B0aW9uczogSVJlcXVlc3RPcHRpb25zKTogUHJvbWlzZTxJUmVxdWVzdENvbnRleHQ+IHtcblx0XHRjb25zdCB2ZXJzaW9uVXJsID0gYCR7dGhpcy51cmx9L3YxL2A7XG5cdFx0Y29uc3QgcmVsYXRpdmVQYXRoID0gb3B0aW9ucy51cmwhLmluZGV4T2YodmVyc2lvblVybCkgPT09IDAgPyBvcHRpb25zLnVybCEuc3Vic3RyaW5nKHZlcnNpb25VcmwubGVuZ3RoKSA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCBzZWdtZW50cyA9IHJlbGF0aXZlUGF0aCA/IHJlbGF0aXZlUGF0aC5zcGxpdCgnLycpIDogW107XG5cdFx0aWYgKG9wdGlvbnMudHlwZSA9PT0gJ0dFVCcgJiYgc2VnbWVudHMubGVuZ3RoID09PSAxICYmIHNlZ21lbnRzWzBdID09PSAnbWFuaWZlc3QnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5nZXRNYW5pZmVzdChvcHRpb25zLmhlYWRlcnMpO1xuXHRcdH1cblx0XHRpZiAob3B0aW9ucy50eXBlID09PSAnR0VUJyAmJiBzZWdtZW50cy5sZW5ndGggPT09IDMgJiYgc2VnbWVudHNbMF0gPT09ICdyZXNvdXJjZScpIHtcblx0XHRcdHJldHVybiB0aGlzLmdldFJlc291cmNlRGF0YSh1bmRlZmluZWQsIHNlZ21lbnRzWzFdLCBzZWdtZW50c1syXSA9PT0gJ2xhdGVzdCcgPyB1bmRlZmluZWQgOiBzZWdtZW50c1syXSwgb3B0aW9ucy5oZWFkZXJzKTtcblx0XHR9XG5cdFx0aWYgKG9wdGlvbnMudHlwZSA9PT0gJ1BPU1QnICYmIHNlZ21lbnRzLmxlbmd0aCA9PT0gMiAmJiBzZWdtZW50c1swXSA9PT0gJ3Jlc291cmNlJykge1xuXHRcdFx0cmV0dXJuIHRoaXMud3JpdGVEYXRhKHVuZGVmaW5lZCwgc2VnbWVudHNbMV0sIG9wdGlvbnMuZGF0YSwgb3B0aW9ucy5oZWFkZXJzKTtcblx0XHR9XG5cdFx0Ly8gcmVzb3VyY2VzIGluIGNvbGxlY3Rpb25cblx0XHRpZiAob3B0aW9ucy50eXBlID09PSAnR0VUJyAmJiBzZWdtZW50cy5sZW5ndGggPT09IDUgJiYgc2VnbWVudHNbMF0gPT09ICdjb2xsZWN0aW9uJyAmJiBzZWdtZW50c1syXSA9PT0gJ3Jlc291cmNlJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuZ2V0UmVzb3VyY2VEYXRhKHNlZ21lbnRzWzFdLCBzZWdtZW50c1szXSwgc2VnbWVudHNbNF0gPT09ICdsYXRlc3QnID8gdW5kZWZpbmVkIDogc2VnbWVudHNbNF0sIG9wdGlvbnMuaGVhZGVycyk7XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLnR5cGUgPT09ICdQT1NUJyAmJiBzZWdtZW50cy5sZW5ndGggPT09IDQgJiYgc2VnbWVudHNbMF0gPT09ICdjb2xsZWN0aW9uJyAmJiBzZWdtZW50c1syXSA9PT0gJ3Jlc291cmNlJykge1xuXHRcdFx0cmV0dXJuIHRoaXMud3JpdGVEYXRhKHNlZ21lbnRzWzFdLCBzZWdtZW50c1szXSwgb3B0aW9ucy5kYXRhLCBvcHRpb25zLmhlYWRlcnMpO1xuXHRcdH1cblx0XHRpZiAob3B0aW9ucy50eXBlID09PSAnREVMRVRFJyAmJiBzZWdtZW50cy5sZW5ndGggPT09IDIgJiYgc2VnbWVudHNbMF0gPT09ICdyZXNvdXJjZScpIHtcblx0XHRcdHJldHVybiB0aGlzLmRlbGV0ZVJlc291cmNlRGF0YSh1bmRlZmluZWQsIHNlZ21lbnRzWzFdKTtcblx0XHR9XG5cdFx0aWYgKG9wdGlvbnMudHlwZSA9PT0gJ0RFTEVURScgJiYgc2VnbWVudHMubGVuZ3RoID09PSAxICYmIHNlZ21lbnRzWzBdID09PSAncmVzb3VyY2UnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jbGVhcihvcHRpb25zLmhlYWRlcnMpO1xuXHRcdH1cblx0XHRpZiAob3B0aW9ucy50eXBlID09PSAnREVMRVRFJyAmJiBzZWdtZW50c1swXSA9PT0gJ2NvbGxlY3Rpb24nKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy50b1Jlc3BvbnNlKDIwNCk7XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLnR5cGUgPT09ICdQT1NUJyAmJiBzZWdtZW50cy5sZW5ndGggPT09IDEgJiYgc2VnbWVudHNbMF0gPT09ICdjb2xsZWN0aW9uJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuY3JlYXRlQ29sbGVjdGlvbigpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy50b1Jlc3BvbnNlKDUwMSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldE1hbmlmZXN0KGhlYWRlcnM/OiBJSGVhZGVycyk6IFByb21pc2U8SVJlcXVlc3RDb250ZXh0PiB7XG5cdFx0aWYgKHRoaXMuc2Vzc2lvbikge1xuXHRcdFx0Y29uc3QgbGF0ZXN0OiBSZWNvcmQ8U2VydmVyUmVzb3VyY2UsIHN0cmluZz4gPSBPYmplY3QuY3JlYXRlKHt9KTtcblx0XHRcdHRoaXMuZGF0YS5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiBsYXRlc3Rba2V5XSA9IHZhbHVlLnJlZik7XG5cdFx0XHRsZXQgY29sbGVjdGlvbjogSVVzZXJEYXRhQ29sbGVjdGlvbk1hbmlmZXN0IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0aWYgKHRoaXMuY29sbGVjdGlvbkNvdW50ZXIpIHtcblx0XHRcdFx0Y29sbGVjdGlvbiA9IHt9O1xuXHRcdFx0XHRmb3IgKGxldCBjb2xsZWN0aW9uSWQgPSAxOyBjb2xsZWN0aW9uSWQgPD0gdGhpcy5jb2xsZWN0aW9uQ291bnRlcjsgY29sbGVjdGlvbklkKyspIHtcblx0XHRcdFx0XHRjb25zdCBjb2xsZWN0aW9uRGF0YSA9IHRoaXMuY29sbGVjdGlvbnMuZ2V0KGAke2NvbGxlY3Rpb25JZH1gKTtcblx0XHRcdFx0XHRpZiAoY29sbGVjdGlvbkRhdGEpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGxhdGVzdDogUmVjb3JkPFNlcnZlclJlc291cmNlLCBzdHJpbmc+ID0gT2JqZWN0LmNyZWF0ZSh7fSk7XG5cdFx0XHRcdFx0XHRjb2xsZWN0aW9uRGF0YS5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiBsYXRlc3Rba2V5XSA9IHZhbHVlLnJlZik7XG5cdFx0XHRcdFx0XHRjb2xsZWN0aW9uW2Ake2NvbGxlY3Rpb25JZH1gXSA9IHsgbGF0ZXN0IH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBtYW5pZmVzdCA9IHsgc2Vzc2lvbjogdGhpcy5zZXNzaW9uLCBsYXRlc3QsIGNvbGxlY3Rpb24gfTtcblx0XHRcdHJldHVybiB0aGlzLnRvUmVzcG9uc2UoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsIGV0YWc6IGAke3RoaXMubWFuaWZlc3RSZWYrK31gIH0sIEpTT04uc3RyaW5naWZ5KG1hbmlmZXN0KSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnRvUmVzcG9uc2UoMjA0LCB7IGV0YWc6IGAke3RoaXMubWFuaWZlc3RSZWYrK31gIH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRSZXNvdXJjZURhdGEoY29sbGVjdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkLCByZXNvdXJjZTogc3RyaW5nLCByZWY/OiBzdHJpbmcsIGhlYWRlcnM6IElIZWFkZXJzID0ge30pOiBQcm9taXNlPElSZXF1ZXN0Q29udGV4dD4ge1xuXHRcdGNvbnN0IGNvbGxlY3Rpb25EYXRhID0gY29sbGVjdGlvbiA/IHRoaXMuY29sbGVjdGlvbnMuZ2V0KGNvbGxlY3Rpb24pIDogdGhpcy5kYXRhO1xuXHRcdGlmICghY29sbGVjdGlvbkRhdGEpIHtcblx0XHRcdHJldHVybiB0aGlzLnRvUmVzcG9uc2UoNTAxKTtcblx0XHR9XG5cblx0XHRjb25zdCByZXNvdXJjZUtleSA9IEFMTF9TRVJWRVJfUkVTT1VSQ0VTLmZpbmQoa2V5ID0+IGtleSA9PT0gcmVzb3VyY2UpO1xuXHRcdGlmIChyZXNvdXJjZUtleSkge1xuXHRcdFx0Y29uc3QgZGF0YSA9IGNvbGxlY3Rpb25EYXRhLmdldChyZXNvdXJjZUtleSk7XG5cdFx0XHRpZiAocmVmICYmIGRhdGE/LnJlZiAhPT0gcmVmKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnRvUmVzcG9uc2UoNDA0KTtcblx0XHRcdH1cblx0XHRcdGlmICghZGF0YSkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy50b1Jlc3BvbnNlKDIwNCwgeyBldGFnOiAnMCcgfSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoaGVhZGVyc1snSWYtTm9uZS1NYXRjaCddID09PSBkYXRhLnJlZikge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy50b1Jlc3BvbnNlKDMwNCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdGhpcy50b1Jlc3BvbnNlKDIwMCwgeyBldGFnOiBkYXRhLnJlZiB9LCBkYXRhLmNvbnRlbnQgfHwgJycpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy50b1Jlc3BvbnNlKDIwNCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHdyaXRlRGF0YShjb2xsZWN0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQsIHJlc291cmNlOiBzdHJpbmcsIGNvbnRlbnQ6IHN0cmluZyA9ICcnLCBoZWFkZXJzOiBJSGVhZGVycyA9IHt9KTogUHJvbWlzZTxJUmVxdWVzdENvbnRleHQ+IHtcblx0XHRpZiAoIXRoaXMuc2Vzc2lvbikge1xuXHRcdFx0dGhpcy5zZXNzaW9uID0gZ2VuZXJhdGVVdWlkKCk7XG5cdFx0fVxuXHRcdGNvbnN0IGNvbGxlY3Rpb25EYXRhID0gY29sbGVjdGlvbiA/IHRoaXMuY29sbGVjdGlvbnMuZ2V0KGNvbGxlY3Rpb24pIDogdGhpcy5kYXRhO1xuXHRcdGlmICghY29sbGVjdGlvbkRhdGEpIHtcblx0XHRcdHJldHVybiB0aGlzLnRvUmVzcG9uc2UoNTAxKTtcblx0XHR9XG5cdFx0Y29uc3QgcmVzb3VyY2VLZXkgPSBBTExfU0VSVkVSX1JFU09VUkNFUy5maW5kKGtleSA9PiBrZXkgPT09IHJlc291cmNlKTtcblx0XHRpZiAocmVzb3VyY2VLZXkpIHtcblx0XHRcdGNvbnN0IGRhdGEgPSBjb2xsZWN0aW9uRGF0YS5nZXQocmVzb3VyY2VLZXkpO1xuXHRcdFx0aWYgKGhlYWRlcnNbJ0lmLU1hdGNoJ10gIT09IHVuZGVmaW5lZCAmJiBoZWFkZXJzWydJZi1NYXRjaCddICE9PSAoZGF0YSA/IGRhdGEucmVmIDogJzAnKSkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy50b1Jlc3BvbnNlKDQxMik7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCByZWYgPSBgJHtwYXJzZUludChkYXRhPy5yZWYgfHwgJzAnKSArIDF9YDtcblx0XHRcdGNvbGxlY3Rpb25EYXRhLnNldChyZXNvdXJjZUtleSwgeyByZWYsIGNvbnRlbnQgfSk7XG5cdFx0XHRyZXR1cm4gdGhpcy50b1Jlc3BvbnNlKDIwMCwgeyBldGFnOiByZWYgfSk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLnRvUmVzcG9uc2UoMjA0KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZGVsZXRlUmVzb3VyY2VEYXRhKGNvbGxlY3Rpb246IHN0cmluZyB8IHVuZGVmaW5lZCwgcmVzb3VyY2U6IHN0cmluZywgaGVhZGVyczogSUhlYWRlcnMgPSB7fSk6IFByb21pc2U8SVJlcXVlc3RDb250ZXh0PiB7XG5cdFx0Y29uc3QgY29sbGVjdGlvbkRhdGEgPSBjb2xsZWN0aW9uID8gdGhpcy5jb2xsZWN0aW9ucy5nZXQoY29sbGVjdGlvbikgOiB0aGlzLmRhdGE7XG5cdFx0aWYgKCFjb2xsZWN0aW9uRGF0YSkge1xuXHRcdFx0cmV0dXJuIHRoaXMudG9SZXNwb25zZSg1MDEpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc291cmNlS2V5ID0gQUxMX1NFUlZFUl9SRVNPVVJDRVMuZmluZChrZXkgPT4ga2V5ID09PSByZXNvdXJjZSk7XG5cdFx0aWYgKHJlc291cmNlS2V5KSB7XG5cdFx0XHRjb2xsZWN0aW9uRGF0YS5kZWxldGUocmVzb3VyY2VLZXkpO1xuXHRcdFx0cmV0dXJuIHRoaXMudG9SZXNwb25zZSgyMDApO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnRvUmVzcG9uc2UoNDA0KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY3JlYXRlQ29sbGVjdGlvbigpOiBQcm9taXNlPElSZXF1ZXN0Q29udGV4dD4ge1xuXHRcdGNvbnN0IGNvbGxlY3Rpb25JZCA9IGAkeysrdGhpcy5jb2xsZWN0aW9uQ291bnRlcn1gO1xuXHRcdHRoaXMuY29sbGVjdGlvbnMuc2V0KGNvbGxlY3Rpb25JZCwgbmV3IE1hcCgpKTtcblx0XHRyZXR1cm4gdGhpcy50b1Jlc3BvbnNlKDIwMCwge30sIGNvbGxlY3Rpb25JZCk7XG5cdH1cblxuXHRhc3luYyBjbGVhcihoZWFkZXJzPzogSUhlYWRlcnMpOiBQcm9taXNlPElSZXF1ZXN0Q29udGV4dD4ge1xuXHRcdHRoaXMuY29sbGVjdGlvbnMuY2xlYXIoKTtcblx0XHR0aGlzLmRhdGEuY2xlYXIoKTtcblx0XHR0aGlzLnNlc3Npb24gPSBudWxsO1xuXHRcdHRoaXMuY29sbGVjdGlvbkNvdW50ZXIgPSAwO1xuXHRcdHJldHVybiB0aGlzLnRvUmVzcG9uc2UoMjA0KTtcblx0fVxuXG5cdHByaXZhdGUgdG9SZXNwb25zZShzdGF0dXNDb2RlOiBudW1iZXIsIGhlYWRlcnM/OiBJSGVhZGVycywgZGF0YT86IHN0cmluZyk6IElSZXF1ZXN0Q29udGV4dCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlczoge1xuXHRcdFx0XHRoZWFkZXJzOiBoZWFkZXJzIHx8IHt9LFxuXHRcdFx0XHRzdGF0dXNDb2RlXG5cdFx0XHR9LFxuXHRcdFx0c3RyZWFtOiBidWZmZXJUb1N0cmVhbShWU0J1ZmZlci5mcm9tU3RyaW5nKGRhdGEgfHwgJycpKVxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RVc2VyRGF0YVN5bmNVdGlsU2VydmljZSBpbXBsZW1lbnRzIElVc2VyRGF0YVN5bmNVdGlsU2VydmljZSB7XG5cblx0X3NlcnZpY2VCcmFuZDogYW55O1xuXG5cdGFzeW5jIHJlc29sdmVEZWZhdWx0Q29yZUlnbm9yZWRTZXR0aW5ncygpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG5cdFx0cmV0dXJuIGdldERlZmF1bHRJZ25vcmVkU2V0dGluZ3MoKTtcblx0fVxuXG5cdGFzeW5jIHJlc29sdmVVc2VyQmluZGluZ3ModXNlcmJpbmRpbmdzOiBzdHJpbmdbXSk6IFByb21pc2U8SVN0cmluZ0RpY3Rpb25hcnk8c3RyaW5nPj4ge1xuXHRcdGNvbnN0IGtleXM6IElTdHJpbmdEaWN0aW9uYXJ5PHN0cmluZz4gPSB7fTtcblx0XHRmb3IgKGNvbnN0IGtleWJpbmRpbmcgb2YgdXNlcmJpbmRpbmdzKSB7XG5cdFx0XHRrZXlzW2tleWJpbmRpbmddID0ga2V5YmluZGluZztcblx0XHR9XG5cdFx0cmV0dXJuIGtleXM7XG5cdH1cblxuXHRhc3luYyByZXNvbHZlRm9ybWF0dGluZ09wdGlvbnMoZmlsZT86IFVSSSk6IFByb21pc2U8Rm9ybWF0dGluZ09wdGlvbnM+IHtcblx0XHRyZXR1cm4geyBlb2w6ICdcXG4nLCBpbnNlcnRTcGFjZXM6IGZhbHNlLCB0YWJTaXplOiA0IH07XG5cdH1cblxufVxuXG5jbGFzcyBUZXN0U3RvcmFnZVNlcnZpY2UgZXh0ZW5kcyBJbk1lbW9yeVN0b3JhZ2VTZXJ2aWNlIHtcblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBwcm9maWxlU3RvcmFnZVByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cdG92ZXJyaWRlIGhhc1Njb3BlKHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5wcm9maWxlU3RvcmFnZVByb2ZpbGUuaWQgPT09IHByb2Zp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
