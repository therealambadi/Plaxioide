import { Emitter, Event } from "../../../base/common/event.js";
import { cloneAndChange } from "../../../base/common/objects.js";
import { URI } from "../../../base/common/uri.js";
import { DefaultURITransformer, transformAndReviveIncomingURIs } from "../../../base/common/uriIpc.js";
import { CommontExtensionManagementService } from "./abstractExtensionManagementService.js";
function transformIncomingURI(uri, transformer) {
  return uri ? URI.revive(transformer ? transformer.transformIncoming(uri) : uri) : void 0;
}
function transformOutgoingURI(uri, transformer) {
  return transformer ? transformer.transformOutgoingURI(uri) : uri;
}
function transformIncomingExtension(extension, transformer) {
  transformer = transformer ? transformer : DefaultURITransformer;
  const manifest = extension.manifest;
  const transformed = transformAndReviveIncomingURIs({ ...extension, ...{ manifest: void 0 } }, transformer);
  return { ...transformed, ...{ manifest } };
}
function transformIncomingOptions(options, transformer) {
  return options?.profileLocation ? transformAndReviveIncomingURIs(options, transformer ?? DefaultURITransformer) : options;
}
function transformOutgoingExtension(extension, transformer) {
  return transformer ? cloneAndChange(extension, (value) => value instanceof URI ? transformer.transformOutgoingURI(value) : void 0) : extension;
}
class ExtensionManagementChannel {
  constructor(service, getUriTransformer) {
    this.service = service;
    this.getUriTransformer = getUriTransformer;
    this.onInstallExtension = Event.buffer(service.onInstallExtension, true);
    this.onDidInstallExtensions = Event.buffer(service.onDidInstallExtensions, true);
    this.onUninstallExtension = Event.buffer(service.onUninstallExtension, true);
    this.onDidUninstallExtension = Event.buffer(service.onDidUninstallExtension, true);
    this.onDidUpdateExtensionMetadata = Event.buffer(service.onDidUpdateExtensionMetadata, true);
  }
  listen(context, event) {
    const uriTransformer = this.getUriTransformer(context);
    switch (event) {
      case "onInstallExtension": {
        return Event.map(this.onInstallExtension, (e) => {
          return {
            ...e,
            profileLocation: e.profileLocation ? transformOutgoingURI(e.profileLocation, uriTransformer) : e.profileLocation
          };
        });
      }
      case "onDidInstallExtensions": {
        return Event.map(this.onDidInstallExtensions, (results) => results.map((i) => ({
          ...i,
          local: i.local ? transformOutgoingExtension(i.local, uriTransformer) : i.local,
          profileLocation: i.profileLocation ? transformOutgoingURI(i.profileLocation, uriTransformer) : i.profileLocation
        })));
      }
      case "onUninstallExtension": {
        return Event.map(this.onUninstallExtension, (e) => {
          return {
            ...e,
            profileLocation: e.profileLocation ? transformOutgoingURI(e.profileLocation, uriTransformer) : e.profileLocation
          };
        });
      }
      case "onDidUninstallExtension": {
        return Event.map(this.onDidUninstallExtension, (e) => {
          return {
            ...e,
            profileLocation: e.profileLocation ? transformOutgoingURI(e.profileLocation, uriTransformer) : e.profileLocation
          };
        });
      }
      case "onDidUpdateExtensionMetadata": {
        return Event.map(this.onDidUpdateExtensionMetadata, (e) => {
          return {
            local: transformOutgoingExtension(e.local, uriTransformer),
            profileLocation: transformOutgoingURI(e.profileLocation, uriTransformer)
          };
        });
      }
    }
    throw new Error("Invalid listen");
  }
  async call(context, command, args) {
    const uriTransformer = this.getUriTransformer(context);
    switch (command) {
      case "zip": {
        const extension = transformIncomingExtension(args[0], uriTransformer);
        const uri = await this.service.zip(extension);
        return transformOutgoingURI(uri, uriTransformer);
      }
      case "install": {
        return this.service.install(transformIncomingURI(args[0], uriTransformer), transformIncomingOptions(args[1], uriTransformer));
      }
      case "installFromLocation": {
        return this.service.installFromLocation(transformIncomingURI(args[0], uriTransformer), transformIncomingURI(args[1], uriTransformer));
      }
      case "installExtensionsFromProfile": {
        return this.service.installExtensionsFromProfile(args[0], transformIncomingURI(args[1], uriTransformer), transformIncomingURI(args[2], uriTransformer));
      }
      case "getManifest": {
        return this.service.getManifest(transformIncomingURI(args[0], uriTransformer));
      }
      case "getTargetPlatform": {
        return this.service.getTargetPlatform();
      }
      case "installFromGallery": {
        return this.service.installFromGallery(args[0], transformIncomingOptions(args[1], uriTransformer));
      }
      case "installGalleryExtensions": {
        const arg = args[0];
        return this.service.installGalleryExtensions(arg.map(({ extension, options }) => ({ extension, options: transformIncomingOptions(options, uriTransformer) ?? {} })));
      }
      case "uninstall": {
        return this.service.uninstall(transformIncomingExtension(args[0], uriTransformer), transformIncomingOptions(args[1], uriTransformer));
      }
      case "uninstallExtensions": {
        const arg = args[0];
        return this.service.uninstallExtensions(arg.map(({ extension, options }) => ({ extension: transformIncomingExtension(extension, uriTransformer), options: transformIncomingOptions(options, uriTransformer) })));
      }
      case "getInstalled": {
        const extensions = await this.service.getInstalled(args[0], transformIncomingURI(args[1], uriTransformer), args[2]);
        return extensions.map((e) => transformOutgoingExtension(e, uriTransformer));
      }
      case "toggleAppliationScope": {
        const extension = await this.service.toggleAppliationScope(transformIncomingExtension(args[0], uriTransformer), transformIncomingURI(args[1], uriTransformer));
        return transformOutgoingExtension(extension, uriTransformer);
      }
      case "copyExtensions": {
        return this.service.copyExtensions(transformIncomingURI(args[0], uriTransformer), transformIncomingURI(args[1], uriTransformer));
      }
      case "updateMetadata": {
        const e = await this.service.updateMetadata(transformIncomingExtension(args[0], uriTransformer), args[1], transformIncomingURI(args[2], uriTransformer));
        return transformOutgoingExtension(e, uriTransformer);
      }
      case "resetPinnedStateForAllUserExtensions": {
        return this.service.resetPinnedStateForAllUserExtensions(args[0]);
      }
      case "getExtensionsControlManifest": {
        return this.service.getExtensionsControlManifest();
      }
      case "download": {
        return this.service.download(args[0], args[1], args[2]);
      }
      case "cleanUp": {
        return this.service.cleanUp();
      }
    }
    throw new Error("Invalid call");
  }
}
class ExtensionManagementChannelClient extends CommontExtensionManagementService {
  constructor(channel, productService, allowedExtensionsService) {
    super(productService, allowedExtensionsService);
    this.channel = channel;
    this._onInstallExtension = this._register(new Emitter());
    this._onDidInstallExtensions = this._register(new Emitter());
    this._onUninstallExtension = this._register(new Emitter());
    this._onDidUninstallExtension = this._register(new Emitter());
    this._onDidUpdateExtensionMetadata = this._register(new Emitter());
    this._register(this.channel.listen("onInstallExtension")((e) => this.onInstallExtensionEvent({ ...e, source: this.isUriComponents(e.source) ? URI.revive(e.source) : e.source, profileLocation: URI.revive(e.profileLocation) })));
    this._register(this.channel.listen("onDidInstallExtensions")((results) => this.onDidInstallExtensionsEvent(results.map((e) => ({ ...e, local: e.local ? transformIncomingExtension(e.local, null) : e.local, source: this.isUriComponents(e.source) ? URI.revive(e.source) : e.source, profileLocation: URI.revive(e.profileLocation) })))));
    this._register(this.channel.listen("onUninstallExtension")((e) => this.onUninstallExtensionEvent({ ...e, profileLocation: URI.revive(e.profileLocation) })));
    this._register(this.channel.listen("onDidUninstallExtension")((e) => this.onDidUninstallExtensionEvent({ ...e, profileLocation: URI.revive(e.profileLocation) })));
    this._register(this.channel.listen("onDidUpdateExtensionMetadata")((e) => this.onDidUpdateExtensionMetadataEvent({ profileLocation: URI.revive(e.profileLocation), local: transformIncomingExtension(e.local, null) })));
  }
  get onInstallExtension() {
    return this._onInstallExtension.event;
  }
  get onDidInstallExtensions() {
    return this._onDidInstallExtensions.event;
  }
  get onUninstallExtension() {
    return this._onUninstallExtension.event;
  }
  get onDidUninstallExtension() {
    return this._onDidUninstallExtension.event;
  }
  get onDidUpdateExtensionMetadata() {
    return this._onDidUpdateExtensionMetadata.event;
  }
  onInstallExtensionEvent(event) {
    this._onInstallExtension.fire(event);
  }
  onDidInstallExtensionsEvent(results) {
    this._onDidInstallExtensions.fire(results);
  }
  onUninstallExtensionEvent(event) {
    this._onUninstallExtension.fire(event);
  }
  onDidUninstallExtensionEvent(event) {
    this._onDidUninstallExtension.fire(event);
  }
  onDidUpdateExtensionMetadataEvent(event) {
    this._onDidUpdateExtensionMetadata.fire(event);
  }
  isUriComponents(thing) {
    if (!thing) {
      return false;
    }
    return typeof thing.path === "string" && typeof thing.scheme === "string";
  }
  getTargetPlatform() {
    if (!this._targetPlatformPromise) {
      this._targetPlatformPromise = this.channel.call("getTargetPlatform");
    }
    return this._targetPlatformPromise;
  }
  zip(extension) {
    return Promise.resolve(this.channel.call("zip", [extension]).then((result) => URI.revive(result)));
  }
  install(vsix, options) {
    return Promise.resolve(this.channel.call("install", [vsix, options])).then((local) => transformIncomingExtension(local, null));
  }
  installFromLocation(location, profileLocation) {
    return Promise.resolve(this.channel.call("installFromLocation", [location, profileLocation])).then((local) => transformIncomingExtension(local, null));
  }
  async installExtensionsFromProfile(extensions, fromProfileLocation, toProfileLocation) {
    const result = await this.channel.call("installExtensionsFromProfile", [extensions, fromProfileLocation, toProfileLocation]);
    return result.map((local) => transformIncomingExtension(local, null));
  }
  getManifest(vsix) {
    return Promise.resolve(this.channel.call("getManifest", [vsix]));
  }
  installFromGallery(extension, installOptions) {
    return Promise.resolve(this.channel.call("installFromGallery", [extension, installOptions])).then((local) => transformIncomingExtension(local, null));
  }
  async installGalleryExtensions(extensions) {
    const results = await this.channel.call("installGalleryExtensions", [extensions]);
    return results.map((e) => ({ ...e, local: e.local ? transformIncomingExtension(e.local, null) : e.local, source: this.isUriComponents(e.source) ? URI.revive(e.source) : e.source, profileLocation: URI.revive(e.profileLocation) }));
  }
  uninstall(extension, options) {
    if (extension.isWorkspaceScoped) {
      throw new Error("Cannot uninstall a workspace extension");
    }
    return Promise.resolve(this.channel.call("uninstall", [extension, options]));
  }
  uninstallExtensions(extensions) {
    if (extensions.some((e) => e.extension.isWorkspaceScoped)) {
      throw new Error("Cannot uninstall a workspace extension");
    }
    return Promise.resolve(this.channel.call("uninstallExtensions", [extensions]));
  }
  getInstalled(type = null, extensionsProfileResource, productVersion) {
    return Promise.resolve(this.channel.call("getInstalled", [type, extensionsProfileResource, productVersion])).then((extensions) => extensions.map((extension) => transformIncomingExtension(extension, null)));
  }
  updateMetadata(local, metadata, extensionsProfileResource) {
    return Promise.resolve(this.channel.call("updateMetadata", [local, metadata, extensionsProfileResource])).then((extension) => transformIncomingExtension(extension, null));
  }
  resetPinnedStateForAllUserExtensions(pinned) {
    return this.channel.call("resetPinnedStateForAllUserExtensions", [pinned]);
  }
  toggleAppliationScope(local, fromProfileLocation) {
    return this.channel.call("toggleAppliationScope", [local, fromProfileLocation]).then((extension) => transformIncomingExtension(extension, null));
  }
  copyExtensions(fromProfileLocation, toProfileLocation) {
    return this.channel.call("copyExtensions", [fromProfileLocation, toProfileLocation]);
  }
  getExtensionsControlManifest() {
    return Promise.resolve(this.channel.call("getExtensionsControlManifest"));
  }
  async download(extension, operation, donotVerifySignature) {
    const result = await this.channel.call("download", [extension, operation, donotVerifySignature]);
    return URI.revive(result);
  }
  async cleanUp() {
    return this.channel.call("cleanUp");
  }
  registerParticipant() {
    throw new Error("Not Supported");
  }
}
class ExtensionTipsChannel {
  constructor(service) {
    this.service = service;
  }
  listen(context, event) {
    throw new Error("Invalid listen");
  }
  call(context, command, args) {
    switch (command) {
      case "getConfigBasedTips":
        return this.service.getConfigBasedTips(URI.revive(args[0]));
      case "getImportantExecutableBasedTips":
        return this.service.getImportantExecutableBasedTips();
      case "getOtherExecutableBasedTips":
        return this.service.getOtherExecutableBasedTips();
    }
    throw new Error("Invalid call");
  }
}
export {
  ExtensionManagementChannel,
  ExtensionManagementChannelClient,
  ExtensionTipsChannel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50SXBjLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBjbG9uZUFuZENoYW5nZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IERlZmF1bHRVUklUcmFuc2Zvcm1lciwgSVVSSVRyYW5zZm9ybWVyLCB0cmFuc2Zvcm1BbmRSZXZpdmVJbmNvbWluZ1VSSXMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmlJcGMuanMnO1xuaW1wb3J0IHsgSUNoYW5uZWwsIElTZXJ2ZXJDaGFubmVsIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9wYXJ0cy9pcGMvY29tbW9uL2lwYy5qcyc7XG5pbXBvcnQge1xuXHRJRXh0ZW5zaW9uSWRlbnRpZmllciwgSUV4dGVuc2lvblRpcHNTZXJ2aWNlLCBJR2FsbGVyeUV4dGVuc2lvbiwgSUxvY2FsRXh0ZW5zaW9uLCBJRXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdCwgSW5zdGFsbE9wdGlvbnMsXG5cdFVuaW5zdGFsbE9wdGlvbnMsIE1ldGFkYXRhLCBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UsIERpZFVuaW5zdGFsbEV4dGVuc2lvbkV2ZW50LCBJbnN0YWxsRXh0ZW5zaW9uRXZlbnQsIEluc3RhbGxFeHRlbnNpb25SZXN1bHQsXG5cdFVuaW5zdGFsbEV4dGVuc2lvbkV2ZW50LCBJbnN0YWxsT3BlcmF0aW9uLCBJbnN0YWxsRXh0ZW5zaW9uSW5mbywgSVByb2R1Y3RWZXJzaW9uLCBEaWRVcGRhdGVFeHRlbnNpb25NZXRhZGF0YSwgVW5pbnN0YWxsRXh0ZW5zaW9uSW5mbyxcblx0SUFsbG93ZWRFeHRlbnNpb25zU2VydmljZVxufSBmcm9tICcuL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uVHlwZSwgSUV4dGVuc2lvbk1hbmlmZXN0LCBUYXJnZXRQbGF0Zm9ybSB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29tbW9udEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi9hYnN0cmFjdEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmpzJztcblxuZnVuY3Rpb24gdHJhbnNmb3JtSW5jb21pbmdVUkkodXJpOiBVcmlDb21wb25lbnRzLCB0cmFuc2Zvcm1lcjogSVVSSVRyYW5zZm9ybWVyIHwgbnVsbCk6IFVSSTtcbmZ1bmN0aW9uIHRyYW5zZm9ybUluY29taW5nVVJJKHVyaTogVXJpQ29tcG9uZW50cyB8IHVuZGVmaW5lZCwgdHJhbnNmb3JtZXI6IElVUklUcmFuc2Zvcm1lciB8IG51bGwpOiBVUkkgfCB1bmRlZmluZWQ7XG5mdW5jdGlvbiB0cmFuc2Zvcm1JbmNvbWluZ1VSSSh1cmk6IFVyaUNvbXBvbmVudHMgfCB1bmRlZmluZWQsIHRyYW5zZm9ybWVyOiBJVVJJVHJhbnNmb3JtZXIgfCBudWxsKTogVVJJIHwgdW5kZWZpbmVkIHtcblx0cmV0dXJuIHVyaSA/IFVSSS5yZXZpdmUodHJhbnNmb3JtZXIgPyB0cmFuc2Zvcm1lci50cmFuc2Zvcm1JbmNvbWluZyh1cmkpIDogdXJpKSA6IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gdHJhbnNmb3JtT3V0Z29pbmdVUkkodXJpOiBVUkksIHRyYW5zZm9ybWVyOiBJVVJJVHJhbnNmb3JtZXIgfCBudWxsKTogVVJJIHtcblx0cmV0dXJuIHRyYW5zZm9ybWVyID8gdHJhbnNmb3JtZXIudHJhbnNmb3JtT3V0Z29pbmdVUkkodXJpKSA6IHVyaTtcbn1cblxuZnVuY3Rpb24gdHJhbnNmb3JtSW5jb21pbmdFeHRlbnNpb24oZXh0ZW5zaW9uOiBJTG9jYWxFeHRlbnNpb24sIHRyYW5zZm9ybWVyOiBJVVJJVHJhbnNmb3JtZXIgfCBudWxsKTogSUxvY2FsRXh0ZW5zaW9uIHtcblx0dHJhbnNmb3JtZXIgPSB0cmFuc2Zvcm1lciA/IHRyYW5zZm9ybWVyIDogRGVmYXVsdFVSSVRyYW5zZm9ybWVyO1xuXHRjb25zdCBtYW5pZmVzdCA9IGV4dGVuc2lvbi5tYW5pZmVzdDtcblx0Y29uc3QgdHJhbnNmb3JtZWQgPSB0cmFuc2Zvcm1BbmRSZXZpdmVJbmNvbWluZ1VSSXMoeyAuLi5leHRlbnNpb24sIC4uLnsgbWFuaWZlc3Q6IHVuZGVmaW5lZCB9IH0sIHRyYW5zZm9ybWVyKTtcblx0cmV0dXJuIHsgLi4udHJhbnNmb3JtZWQsIC4uLnsgbWFuaWZlc3QgfSB9O1xufVxuXG5mdW5jdGlvbiB0cmFuc2Zvcm1JbmNvbWluZ09wdGlvbnM8TyBleHRlbmRzIHsgcHJvZmlsZUxvY2F0aW9uPzogVXJpQ29tcG9uZW50cyB9PihvcHRpb25zOiBPIHwgdW5kZWZpbmVkLCB0cmFuc2Zvcm1lcjogSVVSSVRyYW5zZm9ybWVyIHwgbnVsbCk6IE8gfCB1bmRlZmluZWQge1xuXHRyZXR1cm4gb3B0aW9ucz8ucHJvZmlsZUxvY2F0aW9uID8gdHJhbnNmb3JtQW5kUmV2aXZlSW5jb21pbmdVUklzKG9wdGlvbnMsIHRyYW5zZm9ybWVyID8/IERlZmF1bHRVUklUcmFuc2Zvcm1lcikgOiBvcHRpb25zO1xufVxuXG5mdW5jdGlvbiB0cmFuc2Zvcm1PdXRnb2luZ0V4dGVuc2lvbihleHRlbnNpb246IElMb2NhbEV4dGVuc2lvbiwgdHJhbnNmb3JtZXI6IElVUklUcmFuc2Zvcm1lciB8IG51bGwpOiBJTG9jYWxFeHRlbnNpb24ge1xuXHRyZXR1cm4gdHJhbnNmb3JtZXIgPyBjbG9uZUFuZENoYW5nZShleHRlbnNpb24sIHZhbHVlID0+IHZhbHVlIGluc3RhbmNlb2YgVVJJID8gdHJhbnNmb3JtZXIudHJhbnNmb3JtT3V0Z29pbmdVUkkodmFsdWUpIDogdW5kZWZpbmVkKSA6IGV4dGVuc2lvbjtcbn1cblxuZXhwb3J0IGNsYXNzIEV4dGVuc2lvbk1hbmFnZW1lbnRDaGFubmVsIGltcGxlbWVudHMgSVNlcnZlckNoYW5uZWwge1xuXG5cdG9uSW5zdGFsbEV4dGVuc2lvbjogRXZlbnQ8SW5zdGFsbEV4dGVuc2lvbkV2ZW50Pjtcblx0b25EaWRJbnN0YWxsRXh0ZW5zaW9uczogRXZlbnQ8cmVhZG9ubHkgSW5zdGFsbEV4dGVuc2lvblJlc3VsdFtdPjtcblx0b25Vbmluc3RhbGxFeHRlbnNpb246IEV2ZW50PFVuaW5zdGFsbEV4dGVuc2lvbkV2ZW50Pjtcblx0b25EaWRVbmluc3RhbGxFeHRlbnNpb246IEV2ZW50PERpZFVuaW5zdGFsbEV4dGVuc2lvbkV2ZW50Pjtcblx0b25EaWRVcGRhdGVFeHRlbnNpb25NZXRhZGF0YTogRXZlbnQ8RGlkVXBkYXRlRXh0ZW5zaW9uTWV0YWRhdGE+O1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgc2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLCBwcml2YXRlIGdldFVyaVRyYW5zZm9ybWVyOiAocmVxdWVzdENvbnRleHQ6IGFueSkgPT4gSVVSSVRyYW5zZm9ybWVyIHwgbnVsbCkge1xuXHRcdHRoaXMub25JbnN0YWxsRXh0ZW5zaW9uID0gRXZlbnQuYnVmZmVyKHNlcnZpY2Uub25JbnN0YWxsRXh0ZW5zaW9uLCB0cnVlKTtcblx0XHR0aGlzLm9uRGlkSW5zdGFsbEV4dGVuc2lvbnMgPSBFdmVudC5idWZmZXIoc2VydmljZS5vbkRpZEluc3RhbGxFeHRlbnNpb25zLCB0cnVlKTtcblx0XHR0aGlzLm9uVW5pbnN0YWxsRXh0ZW5zaW9uID0gRXZlbnQuYnVmZmVyKHNlcnZpY2Uub25Vbmluc3RhbGxFeHRlbnNpb24sIHRydWUpO1xuXHRcdHRoaXMub25EaWRVbmluc3RhbGxFeHRlbnNpb24gPSBFdmVudC5idWZmZXIoc2VydmljZS5vbkRpZFVuaW5zdGFsbEV4dGVuc2lvbiwgdHJ1ZSk7XG5cdFx0dGhpcy5vbkRpZFVwZGF0ZUV4dGVuc2lvbk1ldGFkYXRhID0gRXZlbnQuYnVmZmVyKHNlcnZpY2Uub25EaWRVcGRhdGVFeHRlbnNpb25NZXRhZGF0YSwgdHJ1ZSk7XG5cdH1cblxuXHRsaXN0ZW4oY29udGV4dDogYW55LCBldmVudDogc3RyaW5nKTogRXZlbnQ8YW55PiB7XG5cdFx0Y29uc3QgdXJpVHJhbnNmb3JtZXIgPSB0aGlzLmdldFVyaVRyYW5zZm9ybWVyKGNvbnRleHQpO1xuXHRcdHN3aXRjaCAoZXZlbnQpIHtcblx0XHRcdGNhc2UgJ29uSW5zdGFsbEV4dGVuc2lvbic6IHtcblx0XHRcdFx0cmV0dXJuIEV2ZW50Lm1hcDxJbnN0YWxsRXh0ZW5zaW9uRXZlbnQsIEluc3RhbGxFeHRlbnNpb25FdmVudD4odGhpcy5vbkluc3RhbGxFeHRlbnNpb24sIGUgPT4ge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHQuLi5lLFxuXHRcdFx0XHRcdFx0cHJvZmlsZUxvY2F0aW9uOiBlLnByb2ZpbGVMb2NhdGlvbiA/IHRyYW5zZm9ybU91dGdvaW5nVVJJKGUucHJvZmlsZUxvY2F0aW9uLCB1cmlUcmFuc2Zvcm1lcikgOiBlLnByb2ZpbGVMb2NhdGlvblxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnb25EaWRJbnN0YWxsRXh0ZW5zaW9ucyc6IHtcblx0XHRcdFx0cmV0dXJuIEV2ZW50Lm1hcDxyZWFkb25seSBJbnN0YWxsRXh0ZW5zaW9uUmVzdWx0W10sIHJlYWRvbmx5IEluc3RhbGxFeHRlbnNpb25SZXN1bHRbXT4odGhpcy5vbkRpZEluc3RhbGxFeHRlbnNpb25zLCByZXN1bHRzID0+XG5cdFx0XHRcdFx0cmVzdWx0cy5tYXAoaSA9PiAoe1xuXHRcdFx0XHRcdFx0Li4uaSxcblx0XHRcdFx0XHRcdGxvY2FsOiBpLmxvY2FsID8gdHJhbnNmb3JtT3V0Z29pbmdFeHRlbnNpb24oaS5sb2NhbCwgdXJpVHJhbnNmb3JtZXIpIDogaS5sb2NhbCxcblx0XHRcdFx0XHRcdHByb2ZpbGVMb2NhdGlvbjogaS5wcm9maWxlTG9jYXRpb24gPyB0cmFuc2Zvcm1PdXRnb2luZ1VSSShpLnByb2ZpbGVMb2NhdGlvbiwgdXJpVHJhbnNmb3JtZXIpIDogaS5wcm9maWxlTG9jYXRpb25cblx0XHRcdFx0XHR9KSkpO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnb25Vbmluc3RhbGxFeHRlbnNpb24nOiB7XG5cdFx0XHRcdHJldHVybiBFdmVudC5tYXA8VW5pbnN0YWxsRXh0ZW5zaW9uRXZlbnQsIFVuaW5zdGFsbEV4dGVuc2lvbkV2ZW50Pih0aGlzLm9uVW5pbnN0YWxsRXh0ZW5zaW9uLCBlID0+IHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0Li4uZSxcblx0XHRcdFx0XHRcdHByb2ZpbGVMb2NhdGlvbjogZS5wcm9maWxlTG9jYXRpb24gPyB0cmFuc2Zvcm1PdXRnb2luZ1VSSShlLnByb2ZpbGVMb2NhdGlvbiwgdXJpVHJhbnNmb3JtZXIpIDogZS5wcm9maWxlTG9jYXRpb25cblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGNhc2UgJ29uRGlkVW5pbnN0YWxsRXh0ZW5zaW9uJzoge1xuXHRcdFx0XHRyZXR1cm4gRXZlbnQubWFwPERpZFVuaW5zdGFsbEV4dGVuc2lvbkV2ZW50LCBEaWRVbmluc3RhbGxFeHRlbnNpb25FdmVudD4odGhpcy5vbkRpZFVuaW5zdGFsbEV4dGVuc2lvbiwgZSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdC4uLmUsXG5cdFx0XHRcdFx0XHRwcm9maWxlTG9jYXRpb246IGUucHJvZmlsZUxvY2F0aW9uID8gdHJhbnNmb3JtT3V0Z29pbmdVUkkoZS5wcm9maWxlTG9jYXRpb24sIHVyaVRyYW5zZm9ybWVyKSA6IGUucHJvZmlsZUxvY2F0aW9uXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRjYXNlICdvbkRpZFVwZGF0ZUV4dGVuc2lvbk1ldGFkYXRhJzoge1xuXHRcdFx0XHRyZXR1cm4gRXZlbnQubWFwPERpZFVwZGF0ZUV4dGVuc2lvbk1ldGFkYXRhLCBEaWRVcGRhdGVFeHRlbnNpb25NZXRhZGF0YT4odGhpcy5vbkRpZFVwZGF0ZUV4dGVuc2lvbk1ldGFkYXRhLCBlID0+IHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0bG9jYWw6IHRyYW5zZm9ybU91dGdvaW5nRXh0ZW5zaW9uKGUubG9jYWwsIHVyaVRyYW5zZm9ybWVyKSxcblx0XHRcdFx0XHRcdHByb2ZpbGVMb2NhdGlvbjogdHJhbnNmb3JtT3V0Z29pbmdVUkkoZS5wcm9maWxlTG9jYXRpb24sIHVyaVRyYW5zZm9ybWVyKVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBsaXN0ZW4nKTtcblx0fVxuXG5cdGFzeW5jIGNhbGwoY29udGV4dDogYW55LCBjb21tYW5kOiBzdHJpbmcsIGFyZ3M/OiBhbnkpOiBQcm9taXNlPGFueT4ge1xuXHRcdGNvbnN0IHVyaVRyYW5zZm9ybWVyOiBJVVJJVHJhbnNmb3JtZXIgfCBudWxsID0gdGhpcy5nZXRVcmlUcmFuc2Zvcm1lcihjb250ZXh0KTtcblx0XHRzd2l0Y2ggKGNvbW1hbmQpIHtcblx0XHRcdGNhc2UgJ3ppcCc6IHtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uID0gdHJhbnNmb3JtSW5jb21pbmdFeHRlbnNpb24oYXJnc1swXSwgdXJpVHJhbnNmb3JtZXIpO1xuXHRcdFx0XHRjb25zdCB1cmkgPSBhd2FpdCB0aGlzLnNlcnZpY2UuemlwKGV4dGVuc2lvbik7XG5cdFx0XHRcdHJldHVybiB0cmFuc2Zvcm1PdXRnb2luZ1VSSSh1cmksIHVyaVRyYW5zZm9ybWVyKTtcblx0XHRcdH1cblx0XHRcdGNhc2UgJ2luc3RhbGwnOiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnNlcnZpY2UuaW5zdGFsbCh0cmFuc2Zvcm1JbmNvbWluZ1VSSShhcmdzWzBdLCB1cmlUcmFuc2Zvcm1lciksIHRyYW5zZm9ybUluY29taW5nT3B0aW9ucyhhcmdzWzFdLCB1cmlUcmFuc2Zvcm1lcikpO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnaW5zdGFsbEZyb21Mb2NhdGlvbic6IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc2VydmljZS5pbnN0YWxsRnJvbUxvY2F0aW9uKHRyYW5zZm9ybUluY29taW5nVVJJKGFyZ3NbMF0sIHVyaVRyYW5zZm9ybWVyKSwgdHJhbnNmb3JtSW5jb21pbmdVUkkoYXJnc1sxXSwgdXJpVHJhbnNmb3JtZXIpKTtcblx0XHRcdH1cblx0XHRcdGNhc2UgJ2luc3RhbGxFeHRlbnNpb25zRnJvbVByb2ZpbGUnOiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnNlcnZpY2UuaW5zdGFsbEV4dGVuc2lvbnNGcm9tUHJvZmlsZShhcmdzWzBdLCB0cmFuc2Zvcm1JbmNvbWluZ1VSSShhcmdzWzFdLCB1cmlUcmFuc2Zvcm1lciksIHRyYW5zZm9ybUluY29taW5nVVJJKGFyZ3NbMl0sIHVyaVRyYW5zZm9ybWVyKSk7XG5cdFx0XHR9XG5cdFx0XHRjYXNlICdnZXRNYW5pZmVzdCc6IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc2VydmljZS5nZXRNYW5pZmVzdCh0cmFuc2Zvcm1JbmNvbWluZ1VSSShhcmdzWzBdLCB1cmlUcmFuc2Zvcm1lcikpO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnZ2V0VGFyZ2V0UGxhdGZvcm0nOiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnNlcnZpY2UuZ2V0VGFyZ2V0UGxhdGZvcm0oKTtcblx0XHRcdH1cblx0XHRcdGNhc2UgJ2luc3RhbGxGcm9tR2FsbGVyeSc6IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuc2VydmljZS5pbnN0YWxsRnJvbUdhbGxlcnkoYXJnc1swXSwgdHJhbnNmb3JtSW5jb21pbmdPcHRpb25zKGFyZ3NbMV0sIHVyaVRyYW5zZm9ybWVyKSk7XG5cdFx0XHR9XG5cdFx0XHRjYXNlICdpbnN0YWxsR2FsbGVyeUV4dGVuc2lvbnMnOiB7XG5cdFx0XHRcdGNvbnN0IGFyZzogSW5zdGFsbEV4dGVuc2lvbkluZm9bXSA9IGFyZ3NbMF07XG5cdFx0XHRcdHJldHVybiB0aGlzLnNlcnZpY2UuaW5zdGFsbEdhbGxlcnlFeHRlbnNpb25zKGFyZy5tYXAoKHsgZXh0ZW5zaW9uLCBvcHRpb25zIH0pID0+ICh7IGV4dGVuc2lvbiwgb3B0aW9uczogdHJhbnNmb3JtSW5jb21pbmdPcHRpb25zKG9wdGlvbnMsIHVyaVRyYW5zZm9ybWVyKSA/PyB7fSB9KSkpO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAndW5pbnN0YWxsJzoge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zZXJ2aWNlLnVuaW5zdGFsbCh0cmFuc2Zvcm1JbmNvbWluZ0V4dGVuc2lvbihhcmdzWzBdLCB1cmlUcmFuc2Zvcm1lciksIHRyYW5zZm9ybUluY29taW5nT3B0aW9ucyhhcmdzWzFdLCB1cmlUcmFuc2Zvcm1lcikpO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAndW5pbnN0YWxsRXh0ZW5zaW9ucyc6IHtcblx0XHRcdFx0Y29uc3QgYXJnOiBVbmluc3RhbGxFeHRlbnNpb25JbmZvW10gPSBhcmdzWzBdO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zZXJ2aWNlLnVuaW5zdGFsbEV4dGVuc2lvbnMoYXJnLm1hcCgoeyBleHRlbnNpb24sIG9wdGlvbnMgfSkgPT4gKHsgZXh0ZW5zaW9uOiB0cmFuc2Zvcm1JbmNvbWluZ0V4dGVuc2lvbihleHRlbnNpb24sIHVyaVRyYW5zZm9ybWVyKSwgb3B0aW9uczogdHJhbnNmb3JtSW5jb21pbmdPcHRpb25zKG9wdGlvbnMsIHVyaVRyYW5zZm9ybWVyKSB9KSkpO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnZ2V0SW5zdGFsbGVkJzoge1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25zID0gYXdhaXQgdGhpcy5zZXJ2aWNlLmdldEluc3RhbGxlZChhcmdzWzBdLCB0cmFuc2Zvcm1JbmNvbWluZ1VSSShhcmdzWzFdLCB1cmlUcmFuc2Zvcm1lciksIGFyZ3NbMl0pO1xuXHRcdFx0XHRyZXR1cm4gZXh0ZW5zaW9ucy5tYXAoZSA9PiB0cmFuc2Zvcm1PdXRnb2luZ0V4dGVuc2lvbihlLCB1cmlUcmFuc2Zvcm1lcikpO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAndG9nZ2xlQXBwbGlhdGlvblNjb3BlJzoge1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb24gPSBhd2FpdCB0aGlzLnNlcnZpY2UudG9nZ2xlQXBwbGlhdGlvblNjb3BlKHRyYW5zZm9ybUluY29taW5nRXh0ZW5zaW9uKGFyZ3NbMF0sIHVyaVRyYW5zZm9ybWVyKSwgdHJhbnNmb3JtSW5jb21pbmdVUkkoYXJnc1sxXSwgdXJpVHJhbnNmb3JtZXIpKTtcblx0XHRcdFx0cmV0dXJuIHRyYW5zZm9ybU91dGdvaW5nRXh0ZW5zaW9uKGV4dGVuc2lvbiwgdXJpVHJhbnNmb3JtZXIpO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnY29weUV4dGVuc2lvbnMnOiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnNlcnZpY2UuY29weUV4dGVuc2lvbnModHJhbnNmb3JtSW5jb21pbmdVUkkoYXJnc1swXSwgdXJpVHJhbnNmb3JtZXIpLCB0cmFuc2Zvcm1JbmNvbWluZ1VSSShhcmdzWzFdLCB1cmlUcmFuc2Zvcm1lcikpO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAndXBkYXRlTWV0YWRhdGEnOiB7XG5cdFx0XHRcdGNvbnN0IGUgPSBhd2FpdCB0aGlzLnNlcnZpY2UudXBkYXRlTWV0YWRhdGEodHJhbnNmb3JtSW5jb21pbmdFeHRlbnNpb24oYXJnc1swXSwgdXJpVHJhbnNmb3JtZXIpLCBhcmdzWzFdLCB0cmFuc2Zvcm1JbmNvbWluZ1VSSShhcmdzWzJdLCB1cmlUcmFuc2Zvcm1lcikpO1xuXHRcdFx0XHRyZXR1cm4gdHJhbnNmb3JtT3V0Z29pbmdFeHRlbnNpb24oZSwgdXJpVHJhbnNmb3JtZXIpO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAncmVzZXRQaW5uZWRTdGF0ZUZvckFsbFVzZXJFeHRlbnNpb25zJzoge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zZXJ2aWNlLnJlc2V0UGlubmVkU3RhdGVGb3JBbGxVc2VyRXh0ZW5zaW9ucyhhcmdzWzBdKTtcblx0XHRcdH1cblx0XHRcdGNhc2UgJ2dldEV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3QnOiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnNlcnZpY2UuZ2V0RXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdCgpO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSAnZG93bmxvYWQnOiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLnNlcnZpY2UuZG93bmxvYWQoYXJnc1swXSwgYXJnc1sxXSwgYXJnc1syXSk7XG5cdFx0XHR9XG5cdFx0XHRjYXNlICdjbGVhblVwJzoge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5zZXJ2aWNlLmNsZWFuVXAoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY2FsbCcpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgRXh0ZW5zaW9uRXZlbnRSZXN1bHQge1xuXHRyZWFkb25seSBwcm9maWxlTG9jYXRpb246IFVSSTtcblx0cmVhZG9ubHkgbG9jYWw/OiBJTG9jYWxFeHRlbnNpb247XG5cdHJlYWRvbmx5IGFwcGxpY2F0aW9uU2NvcGVkPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIEV4dGVuc2lvbk1hbmFnZW1lbnRDaGFubmVsQ2xpZW50IGV4dGVuZHMgQ29tbW9udEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIGltcGxlbWVudHMgSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uSW5zdGFsbEV4dGVuc2lvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPEluc3RhbGxFeHRlbnNpb25FdmVudD4oKSk7XG5cdGdldCBvbkluc3RhbGxFeHRlbnNpb24oKSB7IHJldHVybiB0aGlzLl9vbkluc3RhbGxFeHRlbnNpb24uZXZlbnQ7IH1cblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkSW5zdGFsbEV4dGVuc2lvbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxyZWFkb25seSBJbnN0YWxsRXh0ZW5zaW9uUmVzdWx0W10+KCkpO1xuXHRnZXQgb25EaWRJbnN0YWxsRXh0ZW5zaW9ucygpIHsgcmV0dXJuIHRoaXMuX29uRGlkSW5zdGFsbEV4dGVuc2lvbnMuZXZlbnQ7IH1cblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uVW5pbnN0YWxsRXh0ZW5zaW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8VW5pbnN0YWxsRXh0ZW5zaW9uRXZlbnQ+KCkpO1xuXHRnZXQgb25Vbmluc3RhbGxFeHRlbnNpb24oKSB7IHJldHVybiB0aGlzLl9vblVuaW5zdGFsbEV4dGVuc2lvbi5ldmVudDsgfVxuXG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRVbmluc3RhbGxFeHRlbnNpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxEaWRVbmluc3RhbGxFeHRlbnNpb25FdmVudD4oKSk7XG5cdGdldCBvbkRpZFVuaW5zdGFsbEV4dGVuc2lvbigpIHsgcmV0dXJuIHRoaXMuX29uRGlkVW5pbnN0YWxsRXh0ZW5zaW9uLmV2ZW50OyB9XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZFVwZGF0ZUV4dGVuc2lvbk1ldGFkYXRhID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8RGlkVXBkYXRlRXh0ZW5zaW9uTWV0YWRhdGE+KCkpO1xuXHRnZXQgb25EaWRVcGRhdGVFeHRlbnNpb25NZXRhZGF0YSgpIHsgcmV0dXJuIHRoaXMuX29uRGlkVXBkYXRlRXh0ZW5zaW9uTWV0YWRhdGEuZXZlbnQ7IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNoYW5uZWw6IElDaGFubmVsLFxuXHRcdHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0YWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlOiBJQWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihwcm9kdWN0U2VydmljZSwgYWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNoYW5uZWwubGlzdGVuPEluc3RhbGxFeHRlbnNpb25FdmVudD4oJ29uSW5zdGFsbEV4dGVuc2lvbicpKGUgPT4gdGhpcy5vbkluc3RhbGxFeHRlbnNpb25FdmVudCh7IC4uLmUsIHNvdXJjZTogdGhpcy5pc1VyaUNvbXBvbmVudHMoZS5zb3VyY2UpID8gVVJJLnJldml2ZShlLnNvdXJjZSkgOiBlLnNvdXJjZSwgcHJvZmlsZUxvY2F0aW9uOiBVUkkucmV2aXZlKGUucHJvZmlsZUxvY2F0aW9uKSB9KSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY2hhbm5lbC5saXN0ZW48cmVhZG9ubHkgSW5zdGFsbEV4dGVuc2lvblJlc3VsdFtdPignb25EaWRJbnN0YWxsRXh0ZW5zaW9ucycpKHJlc3VsdHMgPT4gdGhpcy5vbkRpZEluc3RhbGxFeHRlbnNpb25zRXZlbnQocmVzdWx0cy5tYXAoZSA9PiAoeyAuLi5lLCBsb2NhbDogZS5sb2NhbCA/IHRyYW5zZm9ybUluY29taW5nRXh0ZW5zaW9uKGUubG9jYWwsIG51bGwpIDogZS5sb2NhbCwgc291cmNlOiB0aGlzLmlzVXJpQ29tcG9uZW50cyhlLnNvdXJjZSkgPyBVUkkucmV2aXZlKGUuc291cmNlKSA6IGUuc291cmNlLCBwcm9maWxlTG9jYXRpb246IFVSSS5yZXZpdmUoZS5wcm9maWxlTG9jYXRpb24pIH0pKSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNoYW5uZWwubGlzdGVuPFVuaW5zdGFsbEV4dGVuc2lvbkV2ZW50Pignb25Vbmluc3RhbGxFeHRlbnNpb24nKShlID0+IHRoaXMub25Vbmluc3RhbGxFeHRlbnNpb25FdmVudCh7IC4uLmUsIHByb2ZpbGVMb2NhdGlvbjogVVJJLnJldml2ZShlLnByb2ZpbGVMb2NhdGlvbikgfSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNoYW5uZWwubGlzdGVuPERpZFVuaW5zdGFsbEV4dGVuc2lvbkV2ZW50Pignb25EaWRVbmluc3RhbGxFeHRlbnNpb24nKShlID0+IHRoaXMub25EaWRVbmluc3RhbGxFeHRlbnNpb25FdmVudCh7IC4uLmUsIHByb2ZpbGVMb2NhdGlvbjogVVJJLnJldml2ZShlLnByb2ZpbGVMb2NhdGlvbikgfSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNoYW5uZWwubGlzdGVuPERpZFVwZGF0ZUV4dGVuc2lvbk1ldGFkYXRhPignb25EaWRVcGRhdGVFeHRlbnNpb25NZXRhZGF0YScpKGUgPT4gdGhpcy5vbkRpZFVwZGF0ZUV4dGVuc2lvbk1ldGFkYXRhRXZlbnQoeyBwcm9maWxlTG9jYXRpb246IFVSSS5yZXZpdmUoZS5wcm9maWxlTG9jYXRpb24pLCBsb2NhbDogdHJhbnNmb3JtSW5jb21pbmdFeHRlbnNpb24oZS5sb2NhbCwgbnVsbCkgfSkpKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvbkluc3RhbGxFeHRlbnNpb25FdmVudChldmVudDogSW5zdGFsbEV4dGVuc2lvbkV2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy5fb25JbnN0YWxsRXh0ZW5zaW9uLmZpcmUoZXZlbnQpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG9uRGlkSW5zdGFsbEV4dGVuc2lvbnNFdmVudChyZXN1bHRzOiByZWFkb25seSBJbnN0YWxsRXh0ZW5zaW9uUmVzdWx0W10pOiB2b2lkIHtcblx0XHR0aGlzLl9vbkRpZEluc3RhbGxFeHRlbnNpb25zLmZpcmUocmVzdWx0cyk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb25Vbmluc3RhbGxFeHRlbnNpb25FdmVudChldmVudDogVW5pbnN0YWxsRXh0ZW5zaW9uRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLl9vblVuaW5zdGFsbEV4dGVuc2lvbi5maXJlKGV2ZW50KTtcblx0fVxuXG5cdHByb3RlY3RlZCBvbkRpZFVuaW5zdGFsbEV4dGVuc2lvbkV2ZW50KGV2ZW50OiBEaWRVbmluc3RhbGxFeHRlbnNpb25FdmVudCk6IHZvaWQge1xuXHRcdHRoaXMuX29uRGlkVW5pbnN0YWxsRXh0ZW5zaW9uLmZpcmUoZXZlbnQpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG9uRGlkVXBkYXRlRXh0ZW5zaW9uTWV0YWRhdGFFdmVudChldmVudDogRGlkVXBkYXRlRXh0ZW5zaW9uTWV0YWRhdGEpOiB2b2lkIHtcblx0XHR0aGlzLl9vbkRpZFVwZGF0ZUV4dGVuc2lvbk1ldGFkYXRhLmZpcmUoZXZlbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1VyaUNvbXBvbmVudHModGhpbmc6IHVua25vd24pOiB0aGluZyBpcyBVcmlDb21wb25lbnRzIHtcblx0XHRpZiAoIXRoaW5nKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0eXBlb2YgKDxhbnk+dGhpbmcpLnBhdGggPT09ICdzdHJpbmcnICYmXG5cdFx0XHR0eXBlb2YgKDxhbnk+dGhpbmcpLnNjaGVtZSA9PT0gJ3N0cmluZyc7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX3RhcmdldFBsYXRmb3JtUHJvbWlzZTogUHJvbWlzZTxUYXJnZXRQbGF0Zm9ybT4gfCB1bmRlZmluZWQ7XG5cdGdldFRhcmdldFBsYXRmb3JtKCk6IFByb21pc2U8VGFyZ2V0UGxhdGZvcm0+IHtcblx0XHRpZiAoIXRoaXMuX3RhcmdldFBsYXRmb3JtUHJvbWlzZSkge1xuXHRcdFx0dGhpcy5fdGFyZ2V0UGxhdGZvcm1Qcm9taXNlID0gdGhpcy5jaGFubmVsLmNhbGw8VGFyZ2V0UGxhdGZvcm0+KCdnZXRUYXJnZXRQbGF0Zm9ybScpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fdGFyZ2V0UGxhdGZvcm1Qcm9taXNlO1xuXHR9XG5cblx0emlwKGV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uKTogUHJvbWlzZTxVUkk+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuY2hhbm5lbC5jYWxsPFVyaUNvbXBvbmVudHM+KCd6aXAnLCBbZXh0ZW5zaW9uXSkudGhlbihyZXN1bHQgPT4gVVJJLnJldml2ZShyZXN1bHQpKSk7XG5cdH1cblxuXHRpbnN0YWxsKHZzaXg6IFVSSSwgb3B0aW9ucz86IEluc3RhbGxPcHRpb25zKTogUHJvbWlzZTxJTG9jYWxFeHRlbnNpb24+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuY2hhbm5lbC5jYWxsPElMb2NhbEV4dGVuc2lvbj4oJ2luc3RhbGwnLCBbdnNpeCwgb3B0aW9uc10pKS50aGVuKGxvY2FsID0+IHRyYW5zZm9ybUluY29taW5nRXh0ZW5zaW9uKGxvY2FsLCBudWxsKSk7XG5cdH1cblxuXHRpbnN0YWxsRnJvbUxvY2F0aW9uKGxvY2F0aW9uOiBVUkksIHByb2ZpbGVMb2NhdGlvbjogVVJJKTogUHJvbWlzZTxJTG9jYWxFeHRlbnNpb24+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuY2hhbm5lbC5jYWxsPElMb2NhbEV4dGVuc2lvbj4oJ2luc3RhbGxGcm9tTG9jYXRpb24nLCBbbG9jYXRpb24sIHByb2ZpbGVMb2NhdGlvbl0pKS50aGVuKGxvY2FsID0+IHRyYW5zZm9ybUluY29taW5nRXh0ZW5zaW9uKGxvY2FsLCBudWxsKSk7XG5cdH1cblxuXHRhc3luYyBpbnN0YWxsRXh0ZW5zaW9uc0Zyb21Qcm9maWxlKGV4dGVuc2lvbnM6IElFeHRlbnNpb25JZGVudGlmaWVyW10sIGZyb21Qcm9maWxlTG9jYXRpb246IFVSSSwgdG9Qcm9maWxlTG9jYXRpb246IFVSSSk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uW10+IHtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNoYW5uZWwuY2FsbDxJTG9jYWxFeHRlbnNpb25bXT4oJ2luc3RhbGxFeHRlbnNpb25zRnJvbVByb2ZpbGUnLCBbZXh0ZW5zaW9ucywgZnJvbVByb2ZpbGVMb2NhdGlvbiwgdG9Qcm9maWxlTG9jYXRpb25dKTtcblx0XHRyZXR1cm4gcmVzdWx0Lm1hcChsb2NhbCA9PiB0cmFuc2Zvcm1JbmNvbWluZ0V4dGVuc2lvbihsb2NhbCwgbnVsbCkpO1xuXHR9XG5cblx0Z2V0TWFuaWZlc3QodnNpeDogVVJJKTogUHJvbWlzZTxJRXh0ZW5zaW9uTWFuaWZlc3Q+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuY2hhbm5lbC5jYWxsPElFeHRlbnNpb25NYW5pZmVzdD4oJ2dldE1hbmlmZXN0JywgW3ZzaXhdKSk7XG5cdH1cblxuXHRpbnN0YWxsRnJvbUdhbGxlcnkoZXh0ZW5zaW9uOiBJR2FsbGVyeUV4dGVuc2lvbiwgaW5zdGFsbE9wdGlvbnM/OiBJbnN0YWxsT3B0aW9ucyk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uPiB7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLmNoYW5uZWwuY2FsbDxJTG9jYWxFeHRlbnNpb24+KCdpbnN0YWxsRnJvbUdhbGxlcnknLCBbZXh0ZW5zaW9uLCBpbnN0YWxsT3B0aW9uc10pKS50aGVuKGxvY2FsID0+IHRyYW5zZm9ybUluY29taW5nRXh0ZW5zaW9uKGxvY2FsLCBudWxsKSk7XG5cdH1cblxuXHRhc3luYyBpbnN0YWxsR2FsbGVyeUV4dGVuc2lvbnMoZXh0ZW5zaW9uczogSW5zdGFsbEV4dGVuc2lvbkluZm9bXSk6IFByb21pc2U8SW5zdGFsbEV4dGVuc2lvblJlc3VsdFtdPiB7XG5cdFx0Y29uc3QgcmVzdWx0cyA9IGF3YWl0IHRoaXMuY2hhbm5lbC5jYWxsPEluc3RhbGxFeHRlbnNpb25SZXN1bHRbXT4oJ2luc3RhbGxHYWxsZXJ5RXh0ZW5zaW9ucycsIFtleHRlbnNpb25zXSk7XG5cdFx0cmV0dXJuIHJlc3VsdHMubWFwKGUgPT4gKHsgLi4uZSwgbG9jYWw6IGUubG9jYWwgPyB0cmFuc2Zvcm1JbmNvbWluZ0V4dGVuc2lvbihlLmxvY2FsLCBudWxsKSA6IGUubG9jYWwsIHNvdXJjZTogdGhpcy5pc1VyaUNvbXBvbmVudHMoZS5zb3VyY2UpID8gVVJJLnJldml2ZShlLnNvdXJjZSkgOiBlLnNvdXJjZSwgcHJvZmlsZUxvY2F0aW9uOiBVUkkucmV2aXZlKGUucHJvZmlsZUxvY2F0aW9uKSB9KSk7XG5cdH1cblxuXHR1bmluc3RhbGwoZXh0ZW5zaW9uOiBJTG9jYWxFeHRlbnNpb24sIG9wdGlvbnM/OiBVbmluc3RhbGxPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGV4dGVuc2lvbi5pc1dvcmtzcGFjZVNjb3BlZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgdW5pbnN0YWxsIGEgd29ya3NwYWNlIGV4dGVuc2lvbicpO1xuXHRcdH1cblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuY2hhbm5lbC5jYWxsPHZvaWQ+KCd1bmluc3RhbGwnLCBbZXh0ZW5zaW9uLCBvcHRpb25zXSkpO1xuXHR9XG5cblx0dW5pbnN0YWxsRXh0ZW5zaW9ucyhleHRlbnNpb25zOiBVbmluc3RhbGxFeHRlbnNpb25JbmZvW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoZXh0ZW5zaW9ucy5zb21lKGUgPT4gZS5leHRlbnNpb24uaXNXb3Jrc3BhY2VTY29wZWQpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCB1bmluc3RhbGwgYSB3b3Jrc3BhY2UgZXh0ZW5zaW9uJyk7XG5cdFx0fVxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5jaGFubmVsLmNhbGw8dm9pZD4oJ3VuaW5zdGFsbEV4dGVuc2lvbnMnLCBbZXh0ZW5zaW9uc10pKTtcblxuXHR9XG5cblx0Z2V0SW5zdGFsbGVkKHR5cGU6IEV4dGVuc2lvblR5cGUgfCBudWxsID0gbnVsbCwgZXh0ZW5zaW9uc1Byb2ZpbGVSZXNvdXJjZT86IFVSSSwgcHJvZHVjdFZlcnNpb24/OiBJUHJvZHVjdFZlcnNpb24pOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbltdPiB7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLmNoYW5uZWwuY2FsbDxJTG9jYWxFeHRlbnNpb25bXT4oJ2dldEluc3RhbGxlZCcsIFt0eXBlLCBleHRlbnNpb25zUHJvZmlsZVJlc291cmNlLCBwcm9kdWN0VmVyc2lvbl0pKVxuXHRcdFx0LnRoZW4oZXh0ZW5zaW9ucyA9PiBleHRlbnNpb25zLm1hcChleHRlbnNpb24gPT4gdHJhbnNmb3JtSW5jb21pbmdFeHRlbnNpb24oZXh0ZW5zaW9uLCBudWxsKSkpO1xuXHR9XG5cblx0dXBkYXRlTWV0YWRhdGEobG9jYWw6IElMb2NhbEV4dGVuc2lvbiwgbWV0YWRhdGE6IFBhcnRpYWw8TWV0YWRhdGE+LCBleHRlbnNpb25zUHJvZmlsZVJlc291cmNlPzogVVJJKTogUHJvbWlzZTxJTG9jYWxFeHRlbnNpb24+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuY2hhbm5lbC5jYWxsPElMb2NhbEV4dGVuc2lvbj4oJ3VwZGF0ZU1ldGFkYXRhJywgW2xvY2FsLCBtZXRhZGF0YSwgZXh0ZW5zaW9uc1Byb2ZpbGVSZXNvdXJjZV0pKVxuXHRcdFx0LnRoZW4oZXh0ZW5zaW9uID0+IHRyYW5zZm9ybUluY29taW5nRXh0ZW5zaW9uKGV4dGVuc2lvbiwgbnVsbCkpO1xuXHR9XG5cblx0cmVzZXRQaW5uZWRTdGF0ZUZvckFsbFVzZXJFeHRlbnNpb25zKHBpbm5lZDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLmNoYW5uZWwuY2FsbDx2b2lkPigncmVzZXRQaW5uZWRTdGF0ZUZvckFsbFVzZXJFeHRlbnNpb25zJywgW3Bpbm5lZF0pO1xuXHR9XG5cblx0dG9nZ2xlQXBwbGlhdGlvblNjb3BlKGxvY2FsOiBJTG9jYWxFeHRlbnNpb24sIGZyb21Qcm9maWxlTG9jYXRpb246IFVSSSk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uPiB7XG5cdFx0cmV0dXJuIHRoaXMuY2hhbm5lbC5jYWxsPElMb2NhbEV4dGVuc2lvbj4oJ3RvZ2dsZUFwcGxpYXRpb25TY29wZScsIFtsb2NhbCwgZnJvbVByb2ZpbGVMb2NhdGlvbl0pXG5cdFx0XHQudGhlbihleHRlbnNpb24gPT4gdHJhbnNmb3JtSW5jb21pbmdFeHRlbnNpb24oZXh0ZW5zaW9uLCBudWxsKSk7XG5cdH1cblxuXHRjb3B5RXh0ZW5zaW9ucyhmcm9tUHJvZmlsZUxvY2F0aW9uOiBVUkksIHRvUHJvZmlsZUxvY2F0aW9uOiBVUkkpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5jaGFubmVsLmNhbGw8dm9pZD4oJ2NvcHlFeHRlbnNpb25zJywgW2Zyb21Qcm9maWxlTG9jYXRpb24sIHRvUHJvZmlsZUxvY2F0aW9uXSk7XG5cdH1cblxuXHRnZXRFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0KCk6IFByb21pc2U8SUV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3Q+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuY2hhbm5lbC5jYWxsPElFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0PignZ2V0RXh0ZW5zaW9uc0NvbnRyb2xNYW5pZmVzdCcpKTtcblx0fVxuXG5cdGFzeW5jIGRvd25sb2FkKGV4dGVuc2lvbjogSUdhbGxlcnlFeHRlbnNpb24sIG9wZXJhdGlvbjogSW5zdGFsbE9wZXJhdGlvbiwgZG9ub3RWZXJpZnlTaWduYXR1cmU6IGJvb2xlYW4pOiBQcm9taXNlPFVSST4ge1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuY2hhbm5lbC5jYWxsPFVyaUNvbXBvbmVudHM+KCdkb3dubG9hZCcsIFtleHRlbnNpb24sIG9wZXJhdGlvbiwgZG9ub3RWZXJpZnlTaWduYXR1cmVdKTtcblx0XHRyZXR1cm4gVVJJLnJldml2ZShyZXN1bHQpO1xuXHR9XG5cblx0YXN5bmMgY2xlYW5VcCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5jaGFubmVsLmNhbGwoJ2NsZWFuVXAnKTtcblx0fVxuXG5cdHJlZ2lzdGVyUGFydGljaXBhbnQoKSB7IHRocm93IG5ldyBFcnJvcignTm90IFN1cHBvcnRlZCcpOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25UaXBzQ2hhbm5lbCBpbXBsZW1lbnRzIElTZXJ2ZXJDaGFubmVsIHtcblxuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHNlcnZpY2U6IElFeHRlbnNpb25UaXBzU2VydmljZSkge1xuXHR9XG5cblx0bGlzdGVuKGNvbnRleHQ6IGFueSwgZXZlbnQ6IHN0cmluZyk6IEV2ZW50PGFueT4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBsaXN0ZW4nKTtcblx0fVxuXG5cdGNhbGwoY29udGV4dDogYW55LCBjb21tYW5kOiBzdHJpbmcsIGFyZ3M/OiBhbnkpOiBQcm9taXNlPGFueT4ge1xuXHRcdHN3aXRjaCAoY29tbWFuZCkge1xuXHRcdFx0Y2FzZSAnZ2V0Q29uZmlnQmFzZWRUaXBzJzogcmV0dXJuIHRoaXMuc2VydmljZS5nZXRDb25maWdCYXNlZFRpcHMoVVJJLnJldml2ZShhcmdzWzBdKSk7XG5cdFx0XHRjYXNlICdnZXRJbXBvcnRhbnRFeGVjdXRhYmxlQmFzZWRUaXBzJzogcmV0dXJuIHRoaXMuc2VydmljZS5nZXRJbXBvcnRhbnRFeGVjdXRhYmxlQmFzZWRUaXBzKCk7XG5cdFx0XHRjYXNlICdnZXRPdGhlckV4ZWN1dGFibGVCYXNlZFRpcHMnOiByZXR1cm4gdGhpcy5zZXJ2aWNlLmdldE90aGVyRXhlY3V0YWJsZUJhc2VkVGlwcygpO1xuXHRcdH1cblxuXHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjYWxsJyk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsV0FBMEI7QUFDbkMsU0FBUyx1QkFBd0Msc0NBQXNDO0FBVXZGLFNBQVMseUNBQXlDO0FBSWxELFNBQVMscUJBQXFCLEtBQWdDLGFBQXNEO0FBQ25ILFNBQU8sTUFBTSxJQUFJLE9BQU8sY0FBYyxZQUFZLGtCQUFrQixHQUFHLElBQUksR0FBRyxJQUFJO0FBQ25GO0FBRUEsU0FBUyxxQkFBcUIsS0FBVSxhQUEwQztBQUNqRixTQUFPLGNBQWMsWUFBWSxxQkFBcUIsR0FBRyxJQUFJO0FBQzlEO0FBRUEsU0FBUywyQkFBMkIsV0FBNEIsYUFBc0Q7QUFDckgsZ0JBQWMsY0FBYyxjQUFjO0FBQzFDLFFBQU0sV0FBVyxVQUFVO0FBQzNCLFFBQU0sY0FBYywrQkFBK0IsRUFBRSxHQUFHLFdBQVcsR0FBRyxFQUFFLFVBQVUsT0FBVSxFQUFFLEdBQUcsV0FBVztBQUM1RyxTQUFPLEVBQUUsR0FBRyxhQUFhLEdBQUcsRUFBRSxTQUFTLEVBQUU7QUFDMUM7QUFFQSxTQUFTLHlCQUF3RSxTQUF3QixhQUFvRDtBQUM1SixTQUFPLFNBQVMsa0JBQWtCLCtCQUErQixTQUFTLGVBQWUscUJBQXFCLElBQUk7QUFDbkg7QUFFQSxTQUFTLDJCQUEyQixXQUE0QixhQUFzRDtBQUNySCxTQUFPLGNBQWMsZUFBZSxXQUFXLFdBQVMsaUJBQWlCLE1BQU0sWUFBWSxxQkFBcUIsS0FBSyxJQUFJLE1BQVMsSUFBSTtB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
