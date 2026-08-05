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
import { Queue } from "../../../base/common/async.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { Emitter } from "../../../base/common/event.js";
import { ResourceMap } from "../../../base/common/map.js";
import { URI } from "../../../base/common/uri.js";
import { isIExtensionIdentifier } from "./extensionManagement.js";
import { areSameExtensions } from "./extensionManagementUtil.js";
import { FileOperationResult, IFileService, toFileOperationResult } from "../../files/common/files.js";
import { createDecorator } from "../../instantiation/common/instantiation.js";
import { ILogService } from "../../log/common/log.js";
import { IUserDataProfilesService } from "../../userDataProfile/common/userDataProfile.js";
import { IUriIdentityService } from "../../uriIdentity/common/uriIdentity.js";
import { isObject, isString, isUndefined } from "../../../base/common/types.js";
import { getErrorMessage } from "../../../base/common/errors.js";
var ExtensionsProfileScanningErrorCode = /* @__PURE__ */ ((ExtensionsProfileScanningErrorCode2) => {
  ExtensionsProfileScanningErrorCode2["ERROR_PROFILE_NOT_FOUND"] = "ERROR_PROFILE_NOT_FOUND";
  ExtensionsProfileScanningErrorCode2["ERROR_INVALID_CONTENT"] = "ERROR_INVALID_CONTENT";
  return ExtensionsProfileScanningErrorCode2;
})(ExtensionsProfileScanningErrorCode || {});
class ExtensionsProfileScanningError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}
const IExtensionsProfileScannerService = createDecorator("IExtensionsProfileScannerService");
let AbstractExtensionsProfileScannerService = class extends Disposable {
  constructor(extensionsLocation, fileService, userDataProfilesService, uriIdentityService, logService) {
    super();
    this.extensionsLocation = extensionsLocation;
    this.fileService = fileService;
    this.userDataProfilesService = userDataProfilesService;
    this.uriIdentityService = uriIdentityService;
    this.logService = logService;
    this._onAddExtensions = this._register(new Emitter());
    this.onAddExtensions = this._onAddExtensions.event;
    this._onDidAddExtensions = this._register(new Emitter());
    this.onDidAddExtensions = this._onDidAddExtensions.event;
    this._onRemoveExtensions = this._register(new Emitter());
    this.onRemoveExtensions = this._onRemoveExtensions.event;
    this._onDidRemoveExtensions = this._register(new Emitter());
    this.onDidRemoveExtensions = this._onDidRemoveExtensions.event;
    this.resourcesAccessQueueMap = new ResourceMap();
  }
  scanProfileExtensions(profileLocation, options) {
    return this.withProfileExtensions(profileLocation, void 0, options);
  }
  async addExtensionsToProfile(extensions, profileLocation, keepExistingVersions) {
    const extensionsToRemove = [];
    const extensionsToAdd = [];
    try {
      await this.withProfileExtensions(profileLocation, (existingExtensions) => {
        const result = [];
        if (keepExistingVersions) {
          result.push(...existingExtensions);
        } else {
          for (const existing of existingExtensions) {
            if (extensions.some(([e]) => areSameExtensions(e.identifier, existing.identifier) && e.manifest.version !== existing.version)) {
              extensionsToRemove.push(existing);
            } else {
              result.push(existing);
            }
          }
        }
        for (const [extension, metadata] of extensions) {
          const index = result.findIndex((e) => areSameExtensions(e.identifier, extension.identifier) && e.version === extension.manifest.version);
          const extensionToAdd = { identifier: extension.identifier, version: extension.manifest.version, location: extension.location, metadata };
          if (index === -1) {
            extensionsToAdd.push(extensionToAdd);
            result.push(extensionToAdd);
          } else {
            result.splice(index, 1, extensionToAdd);
          }
        }
        if (extensionsToAdd.length) {
          this._onAddExtensions.fire({ extensions: extensionsToAdd, profileLocation });
        }
        if (extensionsToRemove.length) {
          this._onRemoveExtensions.fire({ extensions: extensionsToRemove, profileLocation });
        }
        return result;
      });
      if (extensionsToAdd.length) {
        this._onDidAddExtensions.fire({ extensions: extensionsToAdd, profileLocation });
      }
      if (extensionsToRemove.length) {
        this._onDidRemoveExtensions.fire({ extensions: extensionsToRemove, profileLocation });
      }
      return extensionsToAdd;
    } catch (error) {
      if (extensionsToAdd.length) {
        this._onDidAddExtensions.fire({ extensions: extensionsToAdd, error, profileLocation });
      }
      if (extensionsToRemove.length) {
        this._onDidRemoveExtensions.fire({ extensions: extensionsToRemove, error, profileLocation });
      }
      throw error;
    }
  }
  async updateMetadata(extensions, profileLocation) {
    const updatedExtensions = [];
    await this.withProfileExtensions(profileLocation, (profileExtensions) => {
      const result = [];
      for (const profileExtension of profileExtensions) {
        const extension = extensions.find(([e]) => areSameExtensions(e.identifier, profileExtension.identifier) && e.manifest.version === profileExtension.version);
        if (extension) {
          profileExtension.metadata = { ...profileExtension.metadata, ...extension[1] };
          updatedExtensions.push(profileExtension);
          result.push(profileExtension);
        } else {
          result.push(profileExtension);
        }
      }
      return result;
    });
    return updatedExtensions;
  }
  async removeExtensionsFromProfile(extensions, profileLocation) {
    const extensionsToRemove = [];
    try {
      await this.withProfileExtensions(profileLocation, (profileExtensions) => {
        const result = [];
        for (const e of profileExtensions) {
          if (extensions.some((extension) => areSameExtensions(e.identifier, extension))) {
            extensionsToRemove.push(e);
          } else {
            result.push(e);
          }
        }
        if (extensionsToRemove.length) {
          this._onRemoveExtensions.fire({ extensions: extensionsToRemove, profileLocation });
        }
        return result;
      });
      if (extensionsToRemove.length) {
        this._onDidRemoveExtensions.fire({ extensions: extensionsToRemove, profileLocation });
      }
    } catch (error) {
      if (extensionsToRemove.length) {
        this._onDidRemoveExtensions.fire({ extensions: extensionsToRemove, error, profileLocation });
      }
      throw error;
    }
  }
  async withProfileExtensions(file, updateFn, options) {
    return this.getResourceAccessQueue(file).queue(async () => {
      let extensions = [];
      let storedProfileExtensions;
      try {
        const content = await this.fileService.readFile(file);
        storedProfileExtensions = JSON.parse(content.value.toString().trim() || "[]");
      } catch (error) {
        if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
          throw error;
        }
        if (this.uriIdentityService.extUri.isEqual(file, this.userDataProfilesService.defaultProfile.extensionsResource)) {
          storedProfileExtensions = await this.migrateFromOldDefaultProfileExtensionsLocation();
        }
        if (!storedProfileExtensions && options?.bailOutWhenFileNotFound) {
          throw new ExtensionsProfileScanningError(getErrorMessage(error), "ERROR_PROFILE_NOT_FOUND" /* ERROR_PROFILE_NOT_FOUND */);
        }
      }
      if (storedProfileExtensions) {
        if (!Array.isArray(storedProfileExtensions)) {
          this.throwInvalidConentError(file);
        }
        let migrate = false;
        for (const e of storedProfileExtensions) {
          if (!isStoredProfileExtension(e)) {
            this.throwInvalidConentError(file);
          }
          let location;
          if (isString(e.relativeLocation) && e.relativeLocation) {
            location = this.resolveExtensionLocation(e.relativeLocation);
          } else if (isString(e.location)) {
            this.logService.warn(`Extensions profile: Ignoring extension with invalid location: ${e.location}`);
            continue;
          } else {
            location = URI.revive(e.location);
            const relativePath = this.toRelativePath(location);
            if (relativePath) {
              migrate = true;
              e.relativeLocation = relativePath;
            }
          }
          if (isUndefined(e.metadata?.hasPreReleaseVersion) && e.metadata?.preRelease) {
            migrate = true;
            e.metadata.hasPreReleaseVersion = true;
          }
          const uuid = e.metadata?.id ?? e.identifier.uuid;
          extensions.push({
            identifier: uuid ? { id: e.identifier.id, uuid } : { id: e.identifier.id },
            location,
            version: e.version,
            metadata: e.metadata
          });
        }
        if (migrate) {
          await this.fileService.writeFile(file, VSBuffer.fromString(JSON.stringify(storedProfileExtensions)));
        }
      }
      if (updateFn) {
        extensions = updateFn(extensions);
        const storedProfileExtensions2 = extensions.map((e) => ({
          identifier: e.identifier,
          version: e.version,
          // retain old format so that old clients can read it
          location: e.location.toJSON(),
          relativeLocation: this.toRelativePath(e.location),
          metadata: e.metadata
        }));
        await this.fileService.writeFile(file, VSBuffer.fromString(JSON.stringify(storedProfileExtensions2)));
      }
      return extensions;
    });
  }
  throwInvalidConentError(file) {
    throw new ExtensionsProfileScanningError(`Invalid extensions content in ${file.toString()}`, "ERROR_INVALID_CONTENT" /* ERROR_INVALID_CONTENT */);
  }
  toRelativePath(extensionLocation) {
    return this.uriIdentityService.extUri.isEqual(this.uriIdentityService.extUri.dirname(extensionLocation), this.extensionsLocation) ? this.uriIdentityService.extUri.basename(extensionLocation) : void 0;
  }
  resolveExtensionLocation(path) {
    return this.uriIdentityService.extUri.joinPath(this.extensionsLocation, path);
  }
  async migrateFromOldDefaultProfileExtensionsLocation() {
    if (!this._migrationPromise) {
      this._migrationPromise = (async () => {
        const oldDefaultProfileExtensionsLocation = this.uriIdentityService.extUri.joinPath(this.userDataProfilesService.defaultProfile.location, "extensions.json");
        const oldDefaultProfileExtensionsInitLocation = this.uriIdentityService.extUri.joinPath(this.extensionsLocation, ".init-default-profile-extensions");
        let content;
        try {
          content = (await this.fileService.readFile(oldDefaultProfileExtensionsLocation)).value.toString();
        } catch (error) {
          if (toFileOperationResult(error) === FileOperationResult.FILE_NOT_FOUND) {
            return void 0;
          }
          throw error;
        }
        this.logService.info("Migrating extensions from old default profile location", oldDefaultProfileExtensionsLocation.toString());
        let storedProfileExtensions;
        try {
          const parsedData = JSON.parse(content);
          if (Array.isArray(parsedData) && parsedData.every((candidate) => isStoredProfileExtension(candidate))) {
            storedProfileExtensions = parsedData;
          } else {
            this.logService.warn("Skipping migrating from old default profile locaiton: Found invalid data", parsedData);
          }
        } catch (error) {
          this.logService.error(error);
        }
        if (storedProfileExtensions) {
          try {
            await this.fileService.createFile(this.userDataProfilesService.defaultProfile.extensionsResource, VSBuffer.fromString(JSON.stringify(storedProfileExtensions)), { overwrite: false });
            this.logService.info("Migrated extensions from old default profile location to new location", oldDefaultProfileExtensionsLocation.toString(), this.userDataProfilesService.defaultProfile.extensionsResource.toString());
          } catch (error) {
            if (toFileOperationResult(error) === FileOperationResult.FILE_MODIFIED_SINCE) {
              this.logService.info("Migration from old default profile location to new location is done by another window", oldDefaultProfileExtensionsLocation.toString(), this.userDataProfilesService.defaultProfile.extensionsResource.toString());
            } else {
              throw error;
            }
          }
        }
        try {
          await this.fileService.del(oldDefaultProfileExtensionsLocation);
        } catch (error) {
          if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
            this.logService.error(error);
          }
        }
        try {
          await this.fileService.del(oldDefaultProfileExtensionsInitLocation);
        } catch (error) {
          if (toFileOperationResult(error) !== FileOperationResult.FILE_NOT_FOUND) {
            this.logService.error(error);
          }
        }
        return storedProfileExtensions;
      })();
    }
    return this._migrationPromise;
  }
  getResourceAccessQueue(file) {
    let resourceQueue = this.resourcesAccessQueueMap.get(file);
    if (!resourceQueue) {
      resourceQueue = new Queue();
      this.resourcesAccessQueueMap.set(file, resourceQueue);
    }
    return resourceQueue;
  }
};
AbstractExtensionsProfileScannerService = __decorateClass([
  __decorateParam(1, IFileService),
  __decorateParam(2, IUserDataProfilesService),
  __decorateParam(3, IUriIdentityService),
  __decorateParam(4, ILogService)
], AbstractExtensionsProfileScannerService);
function isStoredProfileExtension(candidate) {
  return isObject(candidate) && isIExtensionIdentifier(candidate.identifier) && (isUriComponents(candidate.location) || isString(candidate.location) && candidate.location) && (isUndefined(candidate.relativeLocation) || isString(candidate.relativeLocation)) && candidate.version && isString(candidate.version);
}
function isUriComponents(thing) {
  if (!thing) {
    return false;
  }
  return isString(thing.path) && isString(thing.scheme);
}
export {
  AbstractExtensionsProfileScannerService,
  ExtensionsProfileScanningError,
  ExtensionsProfileScanningErrorCode,
  IExtensionsProfileScannerService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25zUHJvZmlsZVNjYW5uZXJTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgUXVldWUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IE1ldGFkYXRhLCBpc0lFeHRlbnNpb25JZGVudGlmaWVyIH0gZnJvbSAnLi9leHRlbnNpb25NYW5hZ2VtZW50LmpzJztcbmltcG9ydCB7IGFyZVNhbWVFeHRlbnNpb25zIH0gZnJvbSAnLi9leHRlbnNpb25NYW5hZ2VtZW50VXRpbC5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uLCBJRXh0ZW5zaW9uSWRlbnRpZmllciB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRmlsZU9wZXJhdGlvblJlc3VsdCwgSUZpbGVTZXJ2aWNlLCB0b0ZpbGVPcGVyYXRpb25SZXN1bHQgfSBmcm9tICcuLi8uLi9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yIH0gZnJvbSAnLi4vLi4vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSB9IGZyb20gJy4uLy4uL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgTXV0YWJsZSwgaXNPYmplY3QsIGlzU3RyaW5nLCBpc1VuZGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IGdldEVycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5cbmludGVyZmFjZSBJU3RvcmVkUHJvZmlsZUV4dGVuc2lvbiB7XG5cdGlkZW50aWZpZXI6IElFeHRlbnNpb25JZGVudGlmaWVyO1xuXHRsb2NhdGlvbjogVXJpQ29tcG9uZW50cyB8IHN0cmluZztcblx0cmVsYXRpdmVMb2NhdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHR2ZXJzaW9uOiBzdHJpbmc7XG5cdG1ldGFkYXRhPzogTWV0YWRhdGE7XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIEV4dGVuc2lvbnNQcm9maWxlU2Nhbm5pbmdFcnJvckNvZGUge1xuXG5cdC8qKlxuXHQgKiBFcnJvciB3aGVuIHRyeWluZyB0byBzY2FuIGV4dGVuc2lvbnMgZnJvbSBhIHByb2ZpbGUgdGhhdCBkb2VzIG5vdCBleGlzdC5cblx0ICovXG5cdEVSUk9SX1BST0ZJTEVfTk9UX0ZPVU5EID0gJ0VSUk9SX1BST0ZJTEVfTk9UX0ZPVU5EJyxcblxuXHQvKipcblx0ICogRXJyb3Igd2hlbiBwcm9maWxlIGZpbGUgaXMgaW52YWxpZC5cblx0ICovXG5cdEVSUk9SX0lOVkFMSURfQ09OVEVOVCA9ICdFUlJPUl9JTlZBTElEX0NPTlRFTlQnLFxuXG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25zUHJvZmlsZVNjYW5uaW5nRXJyb3IgZXh0ZW5kcyBFcnJvciB7XG5cdGNvbnN0cnVjdG9yKG1lc3NhZ2U6IHN0cmluZywgcHVibGljIGNvZGU6IEV4dGVuc2lvbnNQcm9maWxlU2Nhbm5pbmdFcnJvckNvZGUpIHtcblx0XHRzdXBlcihtZXNzYWdlKTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTY2FubmVkUHJvZmlsZUV4dGVuc2lvbiB7XG5cdHJlYWRvbmx5IGlkZW50aWZpZXI6IElFeHRlbnNpb25JZGVudGlmaWVyO1xuXHRyZWFkb25seSB2ZXJzaW9uOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGxvY2F0aW9uOiBVUkk7XG5cdHJlYWRvbmx5IG1ldGFkYXRhPzogTWV0YWRhdGE7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUHJvZmlsZUV4dGVuc2lvbnNFdmVudCB7XG5cdHJlYWRvbmx5IGV4dGVuc2lvbnM6IHJlYWRvbmx5IElTY2FubmVkUHJvZmlsZUV4dGVuc2lvbltdO1xuXHRyZWFkb25seSBwcm9maWxlTG9jYXRpb246IFVSSTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBEaWRBZGRQcm9maWxlRXh0ZW5zaW9uc0V2ZW50IGV4dGVuZHMgUHJvZmlsZUV4dGVuc2lvbnNFdmVudCB7XG5cdHJlYWRvbmx5IGVycm9yPzogRXJyb3I7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRGlkUmVtb3ZlUHJvZmlsZUV4dGVuc2lvbnNFdmVudCBleHRlbmRzIFByb2ZpbGVFeHRlbnNpb25zRXZlbnQge1xuXHRyZWFkb25seSBlcnJvcj86IEVycm9yO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElQcm9maWxlRXh0ZW5zaW9uc1NjYW5PcHRpb25zIHtcblx0cmVhZG9ubHkgYmFpbE91dFdoZW5GaWxlTm90Rm91bmQ/OiBib29sZWFuO1xufVxuXG5leHBvcnQgY29uc3QgSUV4dGVuc2lvbnNQcm9maWxlU2Nhbm5lclNlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SUV4dGVuc2lvbnNQcm9maWxlU2Nhbm5lclNlcnZpY2U+KCdJRXh0ZW5zaW9uc1Byb2ZpbGVTY2FubmVyU2VydmljZScpO1xuZXhwb3J0IGludGVyZmFjZSBJRXh0ZW5zaW9uc1Byb2ZpbGVTY2FubmVyU2VydmljZSB7XG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRyZWFkb25seSBvbkFkZEV4dGVuc2lvbnM6IEV2ZW50PFByb2ZpbGVFeHRlbnNpb25zRXZlbnQ+O1xuXHRyZWFkb25seSBvbkRpZEFkZEV4dGVuc2lvbnM6IEV2ZW50PERpZEFkZFByb2ZpbGVFeHRlbnNpb25zRXZlbnQ+O1xuXHRyZWFkb25seSBvblJlbW92ZUV4dGVuc2lvbnM6IEV2ZW50PFByb2ZpbGVFeHRlbnNpb25zRXZlbnQ+O1xuXHRyZWFkb25seSBvbkRpZFJlbW92ZUV4dGVuc2lvbnM6IEV2ZW50PERpZFJlbW92ZVByb2ZpbGVFeHRlbnNpb25zRXZlbnQ+O1xuXG5cdHNjYW5Qcm9maWxlRXh0ZW5zaW9ucyhwcm9maWxlTG9jYXRpb246IFVSSSwgb3B0aW9ucz86IElQcm9maWxlRXh0ZW5zaW9uc1NjYW5PcHRpb25zKTogUHJvbWlzZTxJU2Nhbm5lZFByb2ZpbGVFeHRlbnNpb25bXT47XG5cdGFkZEV4dGVuc2lvbnNUb1Byb2ZpbGUoZXh0ZW5zaW9uczogW0lFeHRlbnNpb24sIE1ldGFkYXRhIHwgdW5kZWZpbmVkXVtdLCBwcm9maWxlTG9jYXRpb246IFVSSSwga2VlcEV4aXN0aW5nVmVyc2lvbnM/OiBib29sZWFuKTogUHJvbWlzZTxJU2Nhbm5lZFByb2ZpbGVFeHRlbnNpb25bXT47XG5cdHVwZGF0ZU1ldGFkYXRhKGV4dGVuc2lvbnM6IFtJRXh0ZW5zaW9uLCBNZXRhZGF0YSB8IHVuZGVmaW5lZF1bXSwgcHJvZmlsZUxvY2F0aW9uOiBVUkkpOiBQcm9taXNlPElTY2FubmVkUHJvZmlsZUV4dGVuc2lvbltdPjtcblx0cmVtb3ZlRXh0ZW5zaW9uc0Zyb21Qcm9maWxlKGV4dGVuc2lvbnM6IElFeHRlbnNpb25JZGVudGlmaWVyW10sIHByb2ZpbGVMb2NhdGlvbjogVVJJKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0RXh0ZW5zaW9uc1Byb2ZpbGVTY2FubmVyU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRXh0ZW5zaW9uc1Byb2ZpbGVTY2FubmVyU2VydmljZSB7XG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkFkZEV4dGVuc2lvbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxQcm9maWxlRXh0ZW5zaW9uc0V2ZW50PigpKTtcblx0cmVhZG9ubHkgb25BZGRFeHRlbnNpb25zID0gdGhpcy5fb25BZGRFeHRlbnNpb25zLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQWRkRXh0ZW5zaW9ucyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPERpZEFkZFByb2ZpbGVFeHRlbnNpb25zRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZEFkZEV4dGVuc2lvbnMgPSB0aGlzLl9vbkRpZEFkZEV4dGVuc2lvbnMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25SZW1vdmVFeHRlbnNpb25zID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8UHJvZmlsZUV4dGVuc2lvbnNFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uUmVtb3ZlRXh0ZW5zaW9ucyA9IHRoaXMuX29uUmVtb3ZlRXh0ZW5zaW9ucy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFJlbW92ZUV4dGVuc2lvbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxEaWRSZW1vdmVQcm9maWxlRXh0ZW5zaW9uc0V2ZW50PigpKTtcblx0cmVhZG9ubHkgb25EaWRSZW1vdmVFeHRlbnNpb25zID0gdGhpcy5fb25EaWRSZW1vdmVFeHRlbnNpb25zLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgcmVzb3VyY2VzQWNjZXNzUXVldWVNYXAgPSBuZXcgUmVzb3VyY2VNYXA8UXVldWU8SVNjYW5uZWRQcm9maWxlRXh0ZW5zaW9uW10+PigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc0xvY2F0aW9uOiBVUkksXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRzY2FuUHJvZmlsZUV4dGVuc2lvbnMocHJvZmlsZUxvY2F0aW9uOiBVUkksIG9wdGlvbnM/OiBJUHJvZmlsZUV4dGVuc2lvbnNTY2FuT3B0aW9ucyk6IFByb21pc2U8SVNjYW5uZWRQcm9maWxlRXh0ZW5zaW9uW10+IHtcblx0XHRyZXR1cm4gdGhpcy53aXRoUHJvZmlsZUV4dGVuc2lvbnMocHJvZmlsZUxvY2F0aW9uLCB1bmRlZmluZWQsIG9wdGlvbnMpO1xuXHR9XG5cblx0YXN5bmMgYWRkRXh0ZW5zaW9uc1RvUHJvZmlsZShleHRlbnNpb25zOiBbSUV4dGVuc2lvbiwgTWV0YWRhdGEgfCB1bmRlZmluZWRdW10sIHByb2ZpbGVMb2NhdGlvbjogVVJJLCBrZWVwRXhpc3RpbmdWZXJzaW9ucz86IGJvb2xlYW4pOiBQcm9taXNlPElTY2FubmVkUHJvZmlsZUV4dGVuc2lvbltdPiB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uc1RvUmVtb3ZlOiBJU2Nhbm5lZFByb2ZpbGVFeHRlbnNpb25bXSA9IFtdO1xuXHRcdGNvbnN0IGV4dGVuc2lvbnNUb0FkZDogSVNjYW5uZWRQcm9maWxlRXh0ZW5zaW9uW10gPSBbXTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy53aXRoUHJvZmlsZUV4dGVuc2lvbnMocHJvZmlsZUxvY2F0aW9uLCBleGlzdGluZ0V4dGVuc2lvbnMgPT4ge1xuXHRcdFx0XHRjb25zdCByZXN1bHQ6IElTY2FubmVkUHJvZmlsZUV4dGVuc2lvbltdID0gW107XG5cdFx0XHRcdGlmIChrZWVwRXhpc3RpbmdWZXJzaW9ucykge1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKC4uLmV4aXN0aW5nRXh0ZW5zaW9ucyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBleGlzdGluZyBvZiBleGlzdGluZ0V4dGVuc2lvbnMpIHtcblx0XHRcdFx0XHRcdGlmIChleHRlbnNpb25zLnNvbWUoKFtlXSkgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5pZGVudGlmaWVyLCBleGlzdGluZy5pZGVudGlmaWVyKSAmJiBlLm1hbmlmZXN0LnZlcnNpb24gIT09IGV4aXN0aW5nLnZlcnNpb24pKSB7XG5cdFx0XHRcdFx0XHRcdC8vIFJlbW92ZSB0aGUgZXhpc3RpbmcgZXh0ZW5zaW9uIHdpdGggZGlmZmVyZW50IHZlcnNpb25cblx0XHRcdFx0XHRcdFx0ZXh0ZW5zaW9uc1RvUmVtb3ZlLnB1c2goZXhpc3RpbmcpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0cmVzdWx0LnB1c2goZXhpc3RpbmcpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRmb3IgKGNvbnN0IFtleHRlbnNpb24sIG1ldGFkYXRhXSBvZiBleHRlbnNpb25zKSB7XG5cdFx0XHRcdFx0Y29uc3QgaW5kZXggPSByZXN1bHQuZmluZEluZGV4KGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5pZGVudGlmaWVyLCBleHRlbnNpb24uaWRlbnRpZmllcikgJiYgZS52ZXJzaW9uID09PSBleHRlbnNpb24ubWFuaWZlc3QudmVyc2lvbik7XG5cdFx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uVG9BZGQgPSB7IGlkZW50aWZpZXI6IGV4dGVuc2lvbi5pZGVudGlmaWVyLCB2ZXJzaW9uOiBleHRlbnNpb24ubWFuaWZlc3QudmVyc2lvbiwgbG9jYXRpb246IGV4dGVuc2lvbi5sb2NhdGlvbiwgbWV0YWRhdGEgfTtcblx0XHRcdFx0XHRpZiAoaW5kZXggPT09IC0xKSB7XG5cdFx0XHRcdFx0XHRleHRlbnNpb25zVG9BZGQucHVzaChleHRlbnNpb25Ub0FkZCk7XG5cdFx0XHRcdFx0XHRyZXN1bHQucHVzaChleHRlbnNpb25Ub0FkZCk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJlc3VsdC5zcGxpY2UoaW5kZXgsIDEsIGV4dGVuc2lvblRvQWRkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGV4dGVuc2lvbnNUb0FkZC5sZW5ndGgpIHtcblx0XHRcdFx0XHR0aGlzLl9vbkFkZEV4dGVuc2lvbnMuZmlyZSh7IGV4dGVuc2lvbnM6IGV4dGVuc2lvbnNUb0FkZCwgcHJvZmlsZUxvY2F0aW9uIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChleHRlbnNpb25zVG9SZW1vdmUubGVuZ3RoKSB7XG5cdFx0XHRcdFx0dGhpcy5fb25SZW1vdmVFeHRlbnNpb25zLmZpcmUoeyBleHRlbnNpb25zOiBleHRlbnNpb25zVG9SZW1vdmUsIHByb2ZpbGVMb2NhdGlvbiB9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fSk7XG5cdFx0XHRpZiAoZXh0ZW5zaW9uc1RvQWRkLmxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZEFkZEV4dGVuc2lvbnMuZmlyZSh7IGV4dGVuc2lvbnM6IGV4dGVuc2lvbnNUb0FkZCwgcHJvZmlsZUxvY2F0aW9uIH0pO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGV4dGVuc2lvbnNUb1JlbW92ZS5sZW5ndGgpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRSZW1vdmVFeHRlbnNpb25zLmZpcmUoeyBleHRlbnNpb25zOiBleHRlbnNpb25zVG9SZW1vdmUsIHByb2ZpbGVMb2NhdGlvbiB9KTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBleHRlbnNpb25zVG9BZGQ7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGlmIChleHRlbnNpb25zVG9BZGQubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQWRkRXh0ZW5zaW9ucy5maXJlKHsgZXh0ZW5zaW9uczogZXh0ZW5zaW9uc1RvQWRkLCBlcnJvciwgcHJvZmlsZUxvY2F0aW9uIH0pO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGV4dGVuc2lvbnNUb1JlbW92ZS5sZW5ndGgpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRSZW1vdmVFeHRlbnNpb25zLmZpcmUoeyBleHRlbnNpb25zOiBleHRlbnNpb25zVG9SZW1vdmUsIGVycm9yLCBwcm9maWxlTG9jYXRpb24gfSk7XG5cdFx0XHR9XG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9XG5cdH1cblxuXHRhc3luYyB1cGRhdGVNZXRhZGF0YShleHRlbnNpb25zOiBbSUV4dGVuc2lvbiwgTWV0YWRhdGFdW10sIHByb2ZpbGVMb2NhdGlvbjogVVJJKTogUHJvbWlzZTxJU2Nhbm5lZFByb2ZpbGVFeHRlbnNpb25bXT4ge1xuXHRcdGNvbnN0IHVwZGF0ZWRFeHRlbnNpb25zOiBJU2Nhbm5lZFByb2ZpbGVFeHRlbnNpb25bXSA9IFtdO1xuXHRcdGF3YWl0IHRoaXMud2l0aFByb2ZpbGVFeHRlbnNpb25zKHByb2ZpbGVMb2NhdGlvbiwgcHJvZmlsZUV4dGVuc2lvbnMgPT4ge1xuXHRcdFx0Y29uc3QgcmVzdWx0OiBJU2Nhbm5lZFByb2ZpbGVFeHRlbnNpb25bXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBwcm9maWxlRXh0ZW5zaW9uIG9mIHByb2ZpbGVFeHRlbnNpb25zKSB7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IGV4dGVuc2lvbnMuZmluZCgoW2VdKSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIHByb2ZpbGVFeHRlbnNpb24uaWRlbnRpZmllcikgJiYgZS5tYW5pZmVzdC52ZXJzaW9uID09PSBwcm9maWxlRXh0ZW5zaW9uLnZlcnNpb24pO1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0cHJvZmlsZUV4dGVuc2lvbi5tZXRhZGF0YSA9IHsgLi4ucHJvZmlsZUV4dGVuc2lvbi5tZXRhZGF0YSwgLi4uZXh0ZW5zaW9uWzFdIH07XG5cdFx0XHRcdFx0dXBkYXRlZEV4dGVuc2lvbnMucHVzaChwcm9maWxlRXh0ZW5zaW9uKTtcblx0XHRcdFx0XHRyZXN1bHQucHVzaChwcm9maWxlRXh0ZW5zaW9uKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXN1bHQucHVzaChwcm9maWxlRXh0ZW5zaW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9KTtcblx0XHRyZXR1cm4gdXBkYXRlZEV4dGVuc2lvbnM7XG5cdH1cblxuXHRhc3luYyByZW1vdmVFeHRlbnNpb25zRnJvbVByb2ZpbGUoZXh0ZW5zaW9uczogSUV4dGVuc2lvbklkZW50aWZpZXJbXSwgcHJvZmlsZUxvY2F0aW9uOiBVUkkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBleHRlbnNpb25zVG9SZW1vdmU6IElTY2FubmVkUHJvZmlsZUV4dGVuc2lvbltdID0gW107XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMud2l0aFByb2ZpbGVFeHRlbnNpb25zKHByb2ZpbGVMb2NhdGlvbiwgcHJvZmlsZUV4dGVuc2lvbnMgPT4ge1xuXHRcdFx0XHRjb25zdCByZXN1bHQ6IElTY2FubmVkUHJvZmlsZUV4dGVuc2lvbltdID0gW107XG5cdFx0XHRcdGZvciAoY29uc3QgZSBvZiBwcm9maWxlRXh0ZW5zaW9ucykge1xuXHRcdFx0XHRcdGlmIChleHRlbnNpb25zLnNvbWUoZXh0ZW5zaW9uID0+IGFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgZXh0ZW5zaW9uKSkpIHtcblx0XHRcdFx0XHRcdGV4dGVuc2lvbnNUb1JlbW92ZS5wdXNoKGUpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQucHVzaChlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGV4dGVuc2lvbnNUb1JlbW92ZS5sZW5ndGgpIHtcblx0XHRcdFx0XHR0aGlzLl9vblJlbW92ZUV4dGVuc2lvbnMuZmlyZSh7IGV4dGVuc2lvbnM6IGV4dGVuc2lvbnNUb1JlbW92ZSwgcHJvZmlsZUxvY2F0aW9uIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9KTtcblx0XHRcdGlmIChleHRlbnNpb25zVG9SZW1vdmUubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkUmVtb3ZlRXh0ZW5zaW9ucy5maXJlKHsgZXh0ZW5zaW9uczogZXh0ZW5zaW9uc1RvUmVtb3ZlLCBwcm9maWxlTG9jYXRpb24gfSk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGlmIChleHRlbnNpb25zVG9SZW1vdmUubGVuZ3RoKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkUmVtb3ZlRXh0ZW5zaW9ucy5maXJlKHsgZXh0ZW5zaW9uczogZXh0ZW5zaW9uc1RvUmVtb3ZlLCBlcnJvciwgcHJvZmlsZUxvY2F0aW9uIH0pO1xuXHRcdFx0fVxuXHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB3aXRoUHJvZmlsZUV4dGVuc2lvbnMoZmlsZTogVVJJLCB1cGRhdGVGbj86IChleHRlbnNpb25zOiBNdXRhYmxlPElTY2FubmVkUHJvZmlsZUV4dGVuc2lvbj5bXSkgPT4gSVNjYW5uZWRQcm9maWxlRXh0ZW5zaW9uW10sIG9wdGlvbnM/OiBJUHJvZmlsZUV4dGVuc2lvbnNTY2FuT3B0aW9ucyk6IFByb21pc2U8SVNjYW5uZWRQcm9maWxlRXh0ZW5zaW9uW10+IHtcblx0XHRyZXR1cm4gdGhpcy5nZXRSZXNvdXJjZUFjY2Vzc1F1ZXVlKGZpbGUpLnF1ZXVlKGFzeW5jICgpID0+IHtcblx0XHRcdGxldCBleHRlbnNpb25zOiBJU2Nhbm5lZFByb2ZpbGVFeHRlbnNpb25bXSA9IFtdO1xuXG5cdFx0XHQvLyBSZWFkXG5cdFx0XHRsZXQgc3RvcmVkUHJvZmlsZUV4dGVuc2lvbnM6IElTdG9yZWRQcm9maWxlRXh0ZW5zaW9uW10gfCB1bmRlZmluZWQ7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZWFkRmlsZShmaWxlKTtcblx0XHRcdFx0c3RvcmVkUHJvZmlsZUV4dGVuc2lvbnMgPSBKU09OLnBhcnNlKGNvbnRlbnQudmFsdWUudG9TdHJpbmcoKS50cmltKCkgfHwgJ1tdJyk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRpZiAodG9GaWxlT3BlcmF0aW9uUmVzdWx0KGVycm9yKSAhPT0gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9GT1VORCkge1xuXHRcdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIG1pZ3JhdGUgZnJvbSBvbGQgbG9jYXRpb24sIHJlbW92ZSB0aGlzIGFmdGVyIGNvdXBsZSBvZiByZWxlYXNlc1xuXHRcdFx0XHRpZiAodGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoZmlsZSwgdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2UpKSB7XG5cdFx0XHRcdFx0c3RvcmVkUHJvZmlsZUV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLm1pZ3JhdGVGcm9tT2xkRGVmYXVsdFByb2ZpbGVFeHRlbnNpb25zTG9jYXRpb24oKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIXN0b3JlZFByb2ZpbGVFeHRlbnNpb25zICYmIG9wdGlvbnM/LmJhaWxPdXRXaGVuRmlsZU5vdEZvdW5kKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEV4dGVuc2lvbnNQcm9maWxlU2Nhbm5pbmdFcnJvcihnZXRFcnJvck1lc3NhZ2UoZXJyb3IpLCBFeHRlbnNpb25zUHJvZmlsZVNjYW5uaW5nRXJyb3JDb2RlLkVSUk9SX1BST0ZJTEVfTk9UX0ZPVU5EKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKHN0b3JlZFByb2ZpbGVFeHRlbnNpb25zKSB7XG5cdFx0XHRcdGlmICghQXJyYXkuaXNBcnJheShzdG9yZWRQcm9maWxlRXh0ZW5zaW9ucykpIHtcblx0XHRcdFx0XHR0aGlzLnRocm93SW52YWxpZENvbmVudEVycm9yKGZpbGUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIFRPRE8gQHNhbmR5MDgxOiBSZW1vdmUgdGhpcyBtaWdyYXRpb24gYWZ0ZXIgY291cGxlIG9mIHJlbGVhc2VzXG5cdFx0XHRcdGxldCBtaWdyYXRlID0gZmFsc2U7XG5cdFx0XHRcdGZvciAoY29uc3QgZSBvZiBzdG9yZWRQcm9maWxlRXh0ZW5zaW9ucykge1xuXHRcdFx0XHRcdGlmICghaXNTdG9yZWRQcm9maWxlRXh0ZW5zaW9uKGUpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnRocm93SW52YWxpZENvbmVudEVycm9yKGZpbGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRsZXQgbG9jYXRpb246IFVSSTtcblx0XHRcdFx0XHRpZiAoaXNTdHJpbmcoZS5yZWxhdGl2ZUxvY2F0aW9uKSAmJiBlLnJlbGF0aXZlTG9jYXRpb24pIHtcblx0XHRcdFx0XHRcdC8vIEV4dGVuc2lvbiBpbiBuZXcgZm9ybWF0LiBObyBtaWdyYXRpb24gbmVlZGVkLlxuXHRcdFx0XHRcdFx0bG9jYXRpb24gPSB0aGlzLnJlc29sdmVFeHRlbnNpb25Mb2NhdGlvbihlLnJlbGF0aXZlTG9jYXRpb24pO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoaXNTdHJpbmcoZS5sb2NhdGlvbikpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKGBFeHRlbnNpb25zIHByb2ZpbGU6IElnbm9yaW5nIGV4dGVuc2lvbiB3aXRoIGludmFsaWQgbG9jYXRpb246ICR7ZS5sb2NhdGlvbn1gKTtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRsb2NhdGlvbiA9IFVSSS5yZXZpdmUoZS5sb2NhdGlvbik7XG5cdFx0XHRcdFx0XHRjb25zdCByZWxhdGl2ZVBhdGggPSB0aGlzLnRvUmVsYXRpdmVQYXRoKGxvY2F0aW9uKTtcblx0XHRcdFx0XHRcdGlmIChyZWxhdGl2ZVBhdGgpIHtcblx0XHRcdFx0XHRcdFx0Ly8gRXh0ZW5zaW9uIGluIG9sZCBmb3JtYXQuIE1pZ3JhdGUgdG8gbmV3IGZvcm1hdC5cblx0XHRcdFx0XHRcdFx0bWlncmF0ZSA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdGUucmVsYXRpdmVMb2NhdGlvbiA9IHJlbGF0aXZlUGF0aDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGlzVW5kZWZpbmVkKGUubWV0YWRhdGE/Lmhhc1ByZVJlbGVhc2VWZXJzaW9uKSAmJiBlLm1ldGFkYXRhPy5wcmVSZWxlYXNlKSB7XG5cdFx0XHRcdFx0XHRtaWdyYXRlID0gdHJ1ZTtcblx0XHRcdFx0XHRcdGUubWV0YWRhdGEuaGFzUHJlUmVsZWFzZVZlcnNpb24gPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCB1dWlkID0gZS5tZXRhZGF0YT8uaWQgPz8gZS5pZGVudGlmaWVyLnV1aWQ7XG5cdFx0XHRcdFx0ZXh0ZW5zaW9ucy5wdXNoKHtcblx0XHRcdFx0XHRcdGlkZW50aWZpZXI6IHV1aWQgPyB7IGlkOiBlLmlkZW50aWZpZXIuaWQsIHV1aWQgfSA6IHsgaWQ6IGUuaWRlbnRpZmllci5pZCB9LFxuXHRcdFx0XHRcdFx0bG9jYXRpb24sXG5cdFx0XHRcdFx0XHR2ZXJzaW9uOiBlLnZlcnNpb24sXG5cdFx0XHRcdFx0XHRtZXRhZGF0YTogZS5tZXRhZGF0YSxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAobWlncmF0ZSkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2Uud3JpdGVGaWxlKGZpbGUsIFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoc3RvcmVkUHJvZmlsZUV4dGVuc2lvbnMpKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gVXBkYXRlXG5cdFx0XHRpZiAodXBkYXRlRm4pIHtcblx0XHRcdFx0ZXh0ZW5zaW9ucyA9IHVwZGF0ZUZuKGV4dGVuc2lvbnMpO1xuXHRcdFx0XHRjb25zdCBzdG9yZWRQcm9maWxlRXh0ZW5zaW9uczogSVN0b3JlZFByb2ZpbGVFeHRlbnNpb25bXSA9IGV4dGVuc2lvbnMubWFwKGUgPT4gKHtcblx0XHRcdFx0XHRpZGVudGlmaWVyOiBlLmlkZW50aWZpZXIsXG5cdFx0XHRcdFx0dmVyc2lvbjogZS52ZXJzaW9uLFxuXHRcdFx0XHRcdC8vIHJldGFpbiBvbGQgZm9ybWF0IHNvIHRoYXQgb2xkIGNsaWVudHMgY2FuIHJlYWQgaXRcblx0XHRcdFx0XHRsb2NhdGlvbjogZS5sb2NhdGlvbi50b0pTT04oKSxcblx0XHRcdFx0XHRyZWxhdGl2ZUxvY2F0aW9uOiB0aGlzLnRvUmVsYXRpdmVQYXRoKGUubG9jYXRpb24pLFxuXHRcdFx0XHRcdG1ldGFkYXRhOiBlLm1ldGFkYXRhXG5cdFx0XHRcdH0pKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS53cml0ZUZpbGUoZmlsZSwgVlNCdWZmZXIuZnJvbVN0cmluZyhKU09OLnN0cmluZ2lmeShzdG9yZWRQcm9maWxlRXh0ZW5zaW9ucykpKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGV4dGVuc2lvbnM7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHRocm93SW52YWxpZENvbmVudEVycm9yKGZpbGU6IFVSSSk6IHZvaWQge1xuXHRcdHRocm93IG5ldyBFeHRlbnNpb25zUHJvZmlsZVNjYW5uaW5nRXJyb3IoYEludmFsaWQgZXh0ZW5zaW9ucyBjb250ZW50IGluICR7ZmlsZS50b1N0cmluZygpfWAsIEV4dGVuc2lvbnNQcm9maWxlU2Nhbm5pbmdFcnJvckNvZGUuRVJST1JfSU5WQUxJRF9DT05URU5UKTtcblx0fVxuXG5cdHByaXZhdGUgdG9SZWxhdGl2ZVBhdGgoZXh0ZW5zaW9uTG9jYXRpb246IFVSSSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5kaXJuYW1lKGV4dGVuc2lvbkxvY2F0aW9uKSwgdGhpcy5leHRlbnNpb25zTG9jYXRpb24pXG5cdFx0XHQ/IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5iYXNlbmFtZShleHRlbnNpb25Mb2NhdGlvbilcblx0XHRcdDogdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSByZXNvbHZlRXh0ZW5zaW9uTG9jYXRpb24ocGF0aDogc3RyaW5nKTogVVJJIHtcblx0XHRyZXR1cm4gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmpvaW5QYXRoKHRoaXMuZXh0ZW5zaW9uc0xvY2F0aW9uLCBwYXRoKTtcblx0fVxuXG5cdHByaXZhdGUgX21pZ3JhdGlvblByb21pc2U6IFByb21pc2U8SVN0b3JlZFByb2ZpbGVFeHRlbnNpb25bXSB8IHVuZGVmaW5lZD4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgYXN5bmMgbWlncmF0ZUZyb21PbGREZWZhdWx0UHJvZmlsZUV4dGVuc2lvbnNMb2NhdGlvbigpOiBQcm9taXNlPElTdG9yZWRQcm9maWxlRXh0ZW5zaW9uW10gfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXRoaXMuX21pZ3JhdGlvblByb21pc2UpIHtcblx0XHRcdHRoaXMuX21pZ3JhdGlvblByb21pc2UgPSAoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBvbGREZWZhdWx0UHJvZmlsZUV4dGVuc2lvbnNMb2NhdGlvbiA9IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5qb2luUGF0aCh0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLmxvY2F0aW9uLCAnZXh0ZW5zaW9ucy5qc29uJyk7XG5cdFx0XHRcdGNvbnN0IG9sZERlZmF1bHRQcm9maWxlRXh0ZW5zaW9uc0luaXRMb2NhdGlvbiA9IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5qb2luUGF0aCh0aGlzLmV4dGVuc2lvbnNMb2NhdGlvbiwgJy5pbml0LWRlZmF1bHQtcHJvZmlsZS1leHRlbnNpb25zJyk7XG5cdFx0XHRcdGxldCBjb250ZW50OiBzdHJpbmc7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29udGVudCA9IChhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKG9sZERlZmF1bHRQcm9maWxlRXh0ZW5zaW9uc0xvY2F0aW9uKSkudmFsdWUudG9TdHJpbmcoKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRpZiAodG9GaWxlT3BlcmF0aW9uUmVzdWx0KGVycm9yKSA9PT0gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9GT1VORCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnTWlncmF0aW5nIGV4dGVuc2lvbnMgZnJvbSBvbGQgZGVmYXVsdCBwcm9maWxlIGxvY2F0aW9uJywgb2xkRGVmYXVsdFByb2ZpbGVFeHRlbnNpb25zTG9jYXRpb24udG9TdHJpbmcoKSk7XG5cdFx0XHRcdGxldCBzdG9yZWRQcm9maWxlRXh0ZW5zaW9uczogSVN0b3JlZFByb2ZpbGVFeHRlbnNpb25bXSB8IHVuZGVmaW5lZDtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCBwYXJzZWREYXRhID0gSlNPTi5wYXJzZShjb250ZW50KTtcblx0XHRcdFx0XHRpZiAoQXJyYXkuaXNBcnJheShwYXJzZWREYXRhKSAmJiBwYXJzZWREYXRhLmV2ZXJ5KGNhbmRpZGF0ZSA9PiBpc1N0b3JlZFByb2ZpbGVFeHRlbnNpb24oY2FuZGlkYXRlKSkpIHtcblx0XHRcdFx0XHRcdHN0b3JlZFByb2ZpbGVFeHRlbnNpb25zID0gcGFyc2VkRGF0YTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLndhcm4oJ1NraXBwaW5nIG1pZ3JhdGluZyBmcm9tIG9sZCBkZWZhdWx0IHByb2ZpbGUgbG9jYWl0b246IEZvdW5kIGludmFsaWQgZGF0YScsIHBhcnNlZERhdGEpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHQvKiBJZ25vcmUgKi9cblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHN0b3JlZFByb2ZpbGVFeHRlbnNpb25zKSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UuY3JlYXRlRmlsZSh0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZyhKU09OLnN0cmluZ2lmeShzdG9yZWRQcm9maWxlRXh0ZW5zaW9ucykpLCB7IG92ZXJ3cml0ZTogZmFsc2UgfSk7XG5cdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuaW5mbygnTWlncmF0ZWQgZXh0ZW5zaW9ucyBmcm9tIG9sZCBkZWZhdWx0IHByb2ZpbGUgbG9jYXRpb24gdG8gbmV3IGxvY2F0aW9uJywgb2xkRGVmYXVsdFByb2ZpbGVFeHRlbnNpb25zTG9jYXRpb24udG9TdHJpbmcoKSwgdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdGlmICh0b0ZpbGVPcGVyYXRpb25SZXN1bHQoZXJyb3IpID09PSBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTU9ESUZJRURfU0lOQ0UpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmluZm8oJ01pZ3JhdGlvbiBmcm9tIG9sZCBkZWZhdWx0IHByb2ZpbGUgbG9jYXRpb24gdG8gbmV3IGxvY2F0aW9uIGlzIGRvbmUgYnkgYW5vdGhlciB3aW5kb3cnLCBvbGREZWZhdWx0UHJvZmlsZUV4dGVuc2lvbnNMb2NhdGlvbi50b1N0cmluZygpLCB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS5kZWwob2xkRGVmYXVsdFByb2ZpbGVFeHRlbnNpb25zTG9jYXRpb24pO1xuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdGlmICh0b0ZpbGVPcGVyYXRpb25SZXN1bHQoZXJyb3IpICE9PSBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTk9UX0ZPVU5EKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS5kZWwob2xkRGVmYXVsdFByb2ZpbGVFeHRlbnNpb25zSW5pdExvY2F0aW9uKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRpZiAodG9GaWxlT3BlcmF0aW9uUmVzdWx0KGVycm9yKSAhPT0gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9GT1VORCkge1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gc3RvcmVkUHJvZmlsZUV4dGVuc2lvbnM7XG5cdFx0XHR9KSgpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fbWlncmF0aW9uUHJvbWlzZTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0UmVzb3VyY2VBY2Nlc3NRdWV1ZShmaWxlOiBVUkkpOiBRdWV1ZTxJU2Nhbm5lZFByb2ZpbGVFeHRlbnNpb25bXT4ge1xuXHRcdGxldCByZXNvdXJjZVF1ZXVlID0gdGhpcy5yZXNvdXJjZXNBY2Nlc3NRdWV1ZU1hcC5nZXQoZmlsZSk7XG5cdFx0aWYgKCFyZXNvdXJjZVF1ZXVlKSB7XG5cdFx0XHRyZXNvdXJjZVF1ZXVlID0gbmV3IFF1ZXVlPElTY2FubmVkUHJvZmlsZUV4dGVuc2lvbltdPigpO1xuXHRcdFx0dGhpcy5yZXNvdXJjZXNBY2Nlc3NRdWV1ZU1hcC5zZXQoZmlsZSwgcmVzb3VyY2VRdWV1ZSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXNvdXJjZVF1ZXVlO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGlzU3RvcmVkUHJvZmlsZUV4dGVuc2lvbihjYW5kaWRhdGU6IGFueSk6IGNhbmRpZGF0ZSBpcyBJU3RvcmVkUHJvZmlsZUV4dGVuc2lvbiB7XG5cdHJldHVybiBpc09iamVjdChjYW5kaWRhdGUpXG5cdFx0JiYgaXNJRXh0ZW5zaW9uSWRlbnRpZmllcihjYW5kaWRhdGUuaWRlbnRpZmllcilcblx0XHQmJiAoaXNVcmlDb21wb25lbnRzKGNhbmRpZGF0ZS5sb2NhdGlvbikgfHwgKGlzU3RyaW5nKGNhbmRpZGF0ZS5sb2NhdGlvbikgJiYgY2FuZGlkYXRlLmxvY2F0aW9uKSlcblx0XHQmJiAoaXNVbmRlZmluZWQoY2FuZGlkYXRlLnJlbGF0aXZlTG9jYXRpb24pIHx8IGlzU3RyaW5nKGNhbmRpZGF0ZS5yZWxhdGl2ZUxvY2F0aW9uKSlcblx0XHQmJiBjYW5kaWRhdGUudmVyc2lvbiAmJiBpc1N0cmluZyhjYW5kaWRhdGUudmVyc2lvbik7XG59XG5cbmZ1bmN0aW9uIGlzVXJpQ29tcG9uZW50cyh0aGluZzogdW5rbm93bik6IHRoaW5nIGlzIFVyaUNvbXBvbmVudHMge1xuXHRpZiAoIXRoaW5nKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHJldHVybiBpc1N0cmluZygoPGFueT50aGluZykucGF0aCkgJiZcblx0XHRpc1N0cmluZygoPGFueT50aGluZykuc2NoZW1lKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsa0JBQWtCO0FB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QUEsRUFDUjtBQUNEO0FBN1NzQiwwQ0FBZjtBQUFBLEVBbUJKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0F0Qm1CO0FBK1N0QixTQUFTLHlCQUF5QixXQUFzRDtBQUN2RixTQUFPLFNBQVMsU0FBUyxLQUNyQix1QkFBdUIsVUFBVSxVQUFVLE1BQzFDLGdCQUFnQixVQUFVLFFBQVEsS0FBTSxTQUFTLFVBQVUsUUFBUSxLQUFLLFVBQVUsY0FDbEYsWUFBWSxVQUFVLGdCQUFnQixLQUFLLFNBQVMsVUFBVSxnQkFBZ0IsTUFDL0UsVUFBVSxXQUFXLFNBQVMsVUFBVSxPQUFPO0FBQ3BEO0FBRUEsU0FBUyxnQkFBZ0IsT0FBd0M7QUFDaEUsTUFBSSxDQUFDLE9BQU87QUFDWCxXQUFPO0FBQUEsRUFDUjtBQUNBLFNBQU8sU0FBZSxNQUFPLElBQUksS0FDaEMsU0FBZSxNQUFPLE1BQU07QUFDOUI7IiwKICAibmFtZXMiOiBbIkV4dGVuc2lvbnNQcm9maWxlU2Nhbm5pbmdFcnJvckNvZGUiLCAic3RvcmVkUHJvZmlsZUV4dGVuc2lvbnMiXQp9Cg==
