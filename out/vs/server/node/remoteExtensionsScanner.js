import { isAbsolute, join, resolve } from "../../base/common/path.js";
import * as platform from "../../base/common/platform.js";
import { cwd } from "../../base/common/process.js";
import { URI } from "../../base/common/uri.js";
import * as performance from "../../base/common/performance.js";
import { transformOutgoingURIs } from "../../base/common/uriIpc.js";
import { ContextKeyDefinedExpr, ContextKeyEqualsExpr, ContextKeyExpr, ContextKeyGreaterEqualsExpr, ContextKeyGreaterExpr, ContextKeyInExpr, ContextKeyNotEqualsExpr, ContextKeyNotExpr, ContextKeyNotInExpr, ContextKeyRegexExpr, ContextKeySmallerEqualsExpr, ContextKeySmallerExpr } from "../../platform/contextkey/common/contextkey.js";
import { toExtensionDescription } from "../../platform/extensionManagement/common/extensionsScannerService.js";
import { ExtensionType } from "../../platform/extensions/common/extensions.js";
import { dedupExtensions } from "../../workbench/services/extensions/common/extensionsUtil.js";
import { Schemas } from "../../base/common/network.js";
import { areSameExtensions } from "../../platform/extensionManagement/common/extensionManagementUtil.js";
class RemoteExtensionsScannerService {
  constructor(_extensionManagementCLI, environmentService, _userDataProfilesService, _extensionsScannerService, _logService, _extensionGalleryService, _languagePackService, _extensionManagementService) {
    this._extensionManagementCLI = _extensionManagementCLI;
    this._userDataProfilesService = _userDataProfilesService;
    this._extensionsScannerService = _extensionsScannerService;
    this._logService = _logService;
    this._extensionGalleryService = _extensionGalleryService;
    this._languagePackService = _languagePackService;
    this._extensionManagementService = _extensionManagementService;
    this._whenBuiltinExtensionsReady = Promise.resolve({ failed: [] });
    this._whenExtensionsReady = Promise.resolve({ failed: [] });
    const builtinExtensionsToInstall = environmentService.args["install-builtin-extension"];
    if (builtinExtensionsToInstall) {
      _logService.trace("Installing builtin extensions passed via args...");
      const installOptions = { isMachineScoped: !!environmentService.args["do-not-sync"], installPreReleaseVersion: !!environmentService.args["pre-release"] };
      performance.mark("code/server/willInstallBuiltinExtensions");
      this._whenExtensionsReady = this._whenBuiltinExtensionsReady = _extensionManagementCLI.installExtensions([], this._asExtensionIdOrVSIX(builtinExtensionsToInstall), installOptions, !!environmentService.args["force"]).then(() => {
        performance.mark("code/server/didInstallBuiltinExtensions");
        _logService.trace("Finished installing builtin extensions");
        return { failed: [] };
      }, (error) => {
        _logService.error(error);
        return { failed: [] };
      });
    }
    const extensionsToInstall = environmentService.args["install-extension"];
    if (extensionsToInstall) {
      _logService.trace("Installing extensions passed via args...");
      const installOptions = {
        isMachineScoped: !!environmentService.args["do-not-sync"],
        installPreReleaseVersion: !!environmentService.args["pre-release"],
        isApplicationScoped: true
        // extensions installed during server startup are available to all profiles
      };
      this._whenExtensionsReady = this._whenBuiltinExtensionsReady.then(() => _extensionManagementCLI.installExtensions(this._asExtensionIdOrVSIX(extensionsToInstall), [], installOptions, !!environmentService.args["force"])).then(async () => {
        _logService.trace("Finished installing extensions");
        return { failed: [] };
      }, async (error) => {
        _logService.error(error);
        const failed = [];
        const alreadyInstalled = await this._extensionManagementService.getInstalled(ExtensionType.User);
        for (const id of this._asExtensionIdOrVSIX(extensionsToInstall)) {
          if (typeof id === "string") {
            if (!alreadyInstalled.some((e) => areSameExtensions(e.identifier, { id }))) {
              failed.push({ id, installOptions });
            }
          }
        }
        if (!failed.length) {
          _logService.trace(`No extensions to report as failed`);
          return { failed: [] };
        }
        _logService.info(`Relaying the following extensions to install later: ${failed.map((f) => f.id).join(", ")}`);
        return { failed };
      });
    }
  }
  _asExtensionIdOrVSIX(inputs) {
    return inputs.map((input) => /\.vsix$/i.test(input) ? URI.file(isAbsolute(input) ? input : join(cwd(), input)) : input);
  }
  whenExtensionsReady() {
    return this._whenExtensionsReady;
  }
  async scanExtensions(language, profileLocation, workspaceExtensionLocations, extensionDevelopmentLocations, languagePackId) {
    performance.mark("code/server/willScanExtensions");
    this._logService.trace(`Scanning extensions using UI language: ${language}`);
    await this._whenBuiltinExtensionsReady;
    const extensionDevelopmentPaths = extensionDevelopmentLocations ? extensionDevelopmentLocations.filter((url) => url.scheme === Schemas.file).map((url) => url.fsPath) : void 0;
    profileLocation = profileLocation ?? this._userDataProfilesService.defaultProfile.extensionsResource;
    const extensions = await this._scanExtensions(profileLocation, language ?? platform.language, workspaceExtensionLocations, extensionDevelopmentPaths, languagePackId);
    this._logService.trace("Scanned Extensions", extensions);
    this._massageWhenConditions(extensions);
    performance.mark("code/server/didScanExtensions");
    return extensions;
  }
  async _scanExtensions(profileLocation, language, workspaceInstalledExtensionLocations, extensionDevelopmentPath, languagePackId) {
    await this._ensureLanguagePackIsInstalled(language, languagePackId);
    const [builtinExtensions, installedExtensions, workspaceInstalledExtensions, developedExtensions] = await Promise.all([
      this._scanBuiltinExtensions(language),
      this._scanInstalledExtensions(profileLocation, language),
      this._scanWorkspaceInstalledExtensions(language, workspaceInstalledExtensionLocations),
      this._scanDevelopedExtensions(language, extensionDevelopmentPath)
    ]);
    return dedupExtensions(builtinExtensions, installedExtensions, workspaceInstalledExtensions, developedExtensions, this._logService);
  }
  async _scanDevelopedExtensions(language, extensionDevelopmentPaths) {
    if (extensionDevelopmentPaths) {
      return (await Promise.all(extensionDevelopmentPaths.map((extensionDevelopmentPath) => this._extensionsScannerService.scanOneOrMultipleExtensions(URI.file(resolve(extensionDevelopmentPath)), ExtensionType.User, { language })))).flat().map((e) => toExtensionDescription(e, true));
    }
    return [];
  }
  async _scanWorkspaceInstalledExtensions(language, workspaceInstalledExtensions) {
    const result = [];
    if (workspaceInstalledExtensions?.length) {
      const scannedExtensions = await Promise.all(workspaceInstalledExtensions.map((location) => this._extensionsScannerService.scanExistingExtension(location, ExtensionType.User, { language })));
      for (const scannedExtension of scannedExtensions) {
        if (scannedExtension) {
          result.push(toExtensionDescription(scannedExtension, false));
        }
      }
    }
    return result;
  }
  async _scanBuiltinExtensions(language) {
    const scannedExtensions = await this._extensionsScannerService.scanSystemExtensions({ language });
    return scannedExtensions.map((e) => toExtensionDescription(e, false));
  }
  async _scanInstalledExtensions(profileLocation, language) {
    const scannedExtensions = await this._extensionsScannerService.scanUserExtensions({ profileLocation, language, useCache: true });
    return scannedExtensions.map((e) => toExtensionDescription(e, false));
  }
  async _ensureLanguagePackIsInstalled(language, languagePackId) {
    if (
      // No need to install language packs for the default language
      language === platform.LANGUAGE_DEFAULT || // The extension gallery service needs to be available
      !this._extensionGalleryService.isEnabled()
    ) {
      return;
    }
    try {
      const installed = await this._languagePackService.getInstalledLanguages();
      if (installed.find((p) => p.id === language)) {
        this._logService.trace(`Language Pack ${language} is already installed. Skipping language pack installation.`);
        return;
      }
    } catch (err) {
      this._logService.error(err);
    }
    if (!languagePackId) {
      this._logService.trace(`No language pack id provided for language ${language}. Skipping language pack installation.`);
      return;
    }
    this._logService.trace(`Language Pack ${languagePackId} for language ${language} is not installed. It will be installed now.`);
    try {
      await this._extensionManagementCLI.installExtensions([languagePackId], [], { isMachineScoped: true }, true);
    } catch (err) {
      this._logService.error(err);
    }
  }
  _massageWhenConditions(extensions) {
    const _mapResourceSchemeValue = (value, isRegex) => {
      return value.replace(/file/g, "vscode-remote");
    };
    const _mapResourceRegExpValue = (value) => {
      let flags = "";
      flags += value.global ? "g" : "";
      flags += value.ignoreCase ? "i" : "";
      flags += value.multiline ? "m" : "";
      return new RegExp(_mapResourceSchemeValue(value.source, true), flags);
    };
    const _exprKeyMapper = new class {
      mapDefined(key) {
        return ContextKeyDefinedExpr.create(key);
      }
      mapNot(key) {
        return ContextKeyNotExpr.create(key);
      }
      mapEquals(key, value) {
        if (key === "resourceScheme" && typeof value === "string") {
          return ContextKeyEqualsExpr.create(key, _mapResourceSchemeValue(value, false));
        } else {
          return ContextKeyEqualsExpr.create(key, value);
        }
      }
      mapNotEquals(key, value) {
        if (key === "resourceScheme" && typeof value === "string") {
          return ContextKeyNotEqualsExpr.create(key, _mapResourceSchemeValue(value, false));
        } else {
          return ContextKeyNotEqualsExpr.create(key, value);
        }
      }
      mapGreater(key, value) {
        return ContextKeyGreaterExpr.create(key, value);
      }
      mapGreaterEquals(key, value) {
        return ContextKeyGreaterEqualsExpr.create(key, value);
      }
      mapSmaller(key, value) {
        return ContextKeySmallerExpr.create(key, value);
      }
      mapSmallerEquals(key, value) {
        return ContextKeySmallerEqualsExpr.create(key, value);
      }
      mapRegex(key, regexp) {
        if (key === "resourceScheme" && regexp) {
          return ContextKeyRegexExpr.create(key, _mapResourceRegExpValue(regexp));
        } else {
          return ContextKeyRegexExpr.create(key, regexp);
        }
      }
      mapIn(key, valueKey) {
        return ContextKeyInExpr.create(key, valueKey);
      }
      mapNotIn(key, valueKey) {
        return ContextKeyNotInExpr.create(key, valueKey);
      }
    }();
    const _massageWhenUser = (element) => {
      if (!element || !element.when || !/resourceScheme/.test(element.when)) {
        return;
      }
      const expr = ContextKeyExpr.deserialize(element.when);
      if (!expr) {
        return;
      }
      const massaged = expr.map(_exprKeyMapper);
      element.when = massaged.serialize();
    };
    const _massageWhenUserArr = (elements) => {
      if (Array.isArray(elements)) {
        for (const element of elements) {
          _massageWhenUser(element);
        }
      } else {
        _massageWhenUser(elements);
      }
    };
    const _massageLocWhenUser = (target) => {
      for (const loc in target) {
        _massageWhenUserArr(target[loc]);
      }
    };
    extensions.forEach((extension) => {
      if (extension.contributes) {
        if (extension.contributes.menus) {
          _massageLocWhenUser(extension.contributes.menus);
        }
        if (extension.contributes.keybindings) {
          _massageWhenUserArr(extension.contributes.keybindings);
        }
        if (extension.contributes.views) {
          _massageLocWhenUser(extension.contributes.views);
        }
      }
    });
  }
}
class RemoteExtensionsScannerChannel {
  constructor(service, getUriTransformer) {
    this.service = service;
    this.getUriTransformer = getUriTransformer;
  }
  listen(context, event) {
    throw new Error("Invalid listen");
  }
  async call(context, command, args) {
    const uriTransformer = this.getUriTransformer(context);
    switch (command) {
      case "whenExtensionsReady":
        return await this.service.whenExtensionsReady();
      case "scanExtensions": {
        const language = args[0];
        const profileLocation = args[1] ? URI.revive(uriTransformer.transformIncoming(args[1])) : void 0;
        const workspaceExtensionLocations = Array.isArray(args[2]) ? args[2].map((u) => URI.revive(uriTransformer.transformIncoming(u))) : void 0;
        const extensionDevelopmentPath = Array.isArray(args[3]) ? args[3].map((u) => URI.revive(uriTransformer.transformIncoming(u))) : void 0;
        const languagePackId = args[4];
        const extensions = await this.service.scanExtensions(
          language,
          profileLocation,
          workspaceExtensionLocations,
          extensionDevelopmentPath,
          languagePackId
        );
        return extensions.map((extension) => transformOutgoingURIs(extension, uriTransformer));
      }
    }
    throw new Error("Invalid call");
  }
}
export {
  RemoteExtensionsScannerChannel,
  RemoteExtensionsScannerService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9zZXJ2ZXIvbm9kZS9yZW1vdGVFeHRlbnNpb25zU2Nhbm5lci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGlzQWJzb2x1dGUsIGpvaW4sIHJlc29sdmUgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCAqIGFzIHBsYXRmb3JtIGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGN3ZCB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3Byb2Nlc3MuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCAqIGFzIHBlcmZvcm1hbmNlIGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3BlcmZvcm1hbmNlLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSVVSSVRyYW5zZm9ybWVyLCB0cmFuc2Zvcm1PdXRnb2luZ1VSSXMgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi91cmlJcGMuanMnO1xuaW1wb3J0IHsgSVNlcnZlckNoYW5uZWwgfSBmcm9tICcuLi8uLi9iYXNlL3BhcnRzL2lwYy9jb21tb24vaXBjLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlEZWZpbmVkRXhwciwgQ29udGV4dEtleUVxdWFsc0V4cHIsIENvbnRleHRLZXlFeHByLCBDb250ZXh0S2V5RXhwcmVzc2lvbiwgQ29udGV4dEtleUdyZWF0ZXJFcXVhbHNFeHByLCBDb250ZXh0S2V5R3JlYXRlckV4cHIsIENvbnRleHRLZXlJbkV4cHIsIENvbnRleHRLZXlOb3RFcXVhbHNFeHByLCBDb250ZXh0S2V5Tm90RXhwciwgQ29udGV4dEtleU5vdEluRXhwciwgQ29udGV4dEtleVJlZ2V4RXhwciwgQ29udGV4dEtleVNtYWxsZXJFcXVhbHNFeHByLCBDb250ZXh0S2V5U21hbGxlckV4cHIsIElDb250ZXh0S2V5RXhwck1hcHBlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLCBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UsIEluc3RhbGxFeHRlbnNpb25TdW1tYXJ5LCBJbnN0YWxsT3B0aW9ucyB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uTWFuYWdlbWVudENMSSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnRDTEkuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbnNTY2FubmVyU2VydmljZSwgdG9FeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbnNTY2FubmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25UeXBlLCBJRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSVNlcnZlckVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4vc2VydmVyRW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGRlZHVwRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uL3dvcmtiZW5jaC9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zVXRpbC5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9yZW1vdGVFeHRlbnNpb25zU2Nhbm5lci5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VQYWNrU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2xhbmd1YWdlUGFja3MvY29tbW9uL2xhbmd1YWdlUGFja3MuanMnO1xuaW1wb3J0IHsgYXJlU2FtZUV4dGVuc2lvbnMgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50VXRpbC5qcyc7XG5cbmV4cG9ydCBjbGFzcyBSZW1vdGVFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UgaW1wbGVtZW50cyBJUmVtb3RlRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlIHtcblxuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfd2hlbkJ1aWx0aW5FeHRlbnNpb25zUmVhZHkgPSBQcm9taXNlLnJlc29sdmU8SW5zdGFsbEV4dGVuc2lvblN1bW1hcnk+KHsgZmFpbGVkOiBbXSB9KTtcblx0cHJpdmF0ZSByZWFkb25seSBfd2hlbkV4dGVuc2lvbnNSZWFkeSA9IFByb21pc2UucmVzb2x2ZTxJbnN0YWxsRXh0ZW5zaW9uU3VtbWFyeT4oeyBmYWlsZWQ6IFtdIH0pO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvbk1hbmFnZW1lbnRDTEk6IEV4dGVuc2lvbk1hbmFnZW1lbnRDTEksXG5cdFx0ZW52aXJvbm1lbnRTZXJ2aWNlOiBJU2VydmVyRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3VzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlOiBJRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlOiBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VQYWNrU2VydmljZTogSUxhbmd1YWdlUGFja1NlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2U6IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSxcblx0KSB7XG5cdFx0Y29uc3QgYnVpbHRpbkV4dGVuc2lvbnNUb0luc3RhbGwgPSBlbnZpcm9ubWVudFNlcnZpY2UuYXJnc1snaW5zdGFsbC1idWlsdGluLWV4dGVuc2lvbiddO1xuXHRcdGlmIChidWlsdGluRXh0ZW5zaW9uc1RvSW5zdGFsbCkge1xuXHRcdFx0X2xvZ1NlcnZpY2UudHJhY2UoJ0luc3RhbGxpbmcgYnVpbHRpbiBleHRlbnNpb25zIHBhc3NlZCB2aWEgYXJncy4uLicpO1xuXHRcdFx0Y29uc3QgaW5zdGFsbE9wdGlvbnM6IEluc3RhbGxPcHRpb25zID0geyBpc01hY2hpbmVTY29wZWQ6ICEhZW52aXJvbm1lbnRTZXJ2aWNlLmFyZ3NbJ2RvLW5vdC1zeW5jJ10sIGluc3RhbGxQcmVSZWxlYXNlVmVyc2lvbjogISFlbnZpcm9ubWVudFNlcnZpY2UuYXJnc1sncHJlLXJlbGVhc2UnXSB9O1xuXHRcdFx0cGVyZm9ybWFuY2UubWFyaygnY29kZS9zZXJ2ZXIvd2lsbEluc3RhbGxCdWlsdGluRXh0ZW5zaW9ucycpO1xuXHRcdFx0dGhpcy5fd2hlbkV4dGVuc2lvbnNSZWFkeSA9IHRoaXMuX3doZW5CdWlsdGluRXh0ZW5zaW9uc1JlYWR5ID0gX2V4dGVuc2lvbk1hbmFnZW1lbnRDTEkuaW5zdGFsbEV4dGVuc2lvbnMoW10sIHRoaXMuX2FzRXh0ZW5zaW9uSWRPclZTSVgoYnVpbHRpbkV4dGVuc2lvbnNUb0luc3RhbGwpLCBpbnN0YWxsT3B0aW9ucywgISFlbnZpcm9ubWVudFNlcnZpY2UuYXJnc1snZm9yY2UnXSlcblx0XHRcdFx0LnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRcdHBlcmZvcm1hbmNlLm1hcmsoJ2NvZGUvc2VydmVyL2RpZEluc3RhbGxCdWlsdGluRXh0ZW5zaW9ucycpO1xuXHRcdFx0XHRcdF9sb2dTZXJ2aWNlLnRyYWNlKCdGaW5pc2hlZCBpbnN0YWxsaW5nIGJ1aWx0aW4gZXh0ZW5zaW9ucycpO1xuXHRcdFx0XHRcdHJldHVybiB7IGZhaWxlZDogW10gfTtcblx0XHRcdFx0fSwgZXJyb3IgPT4ge1xuXHRcdFx0XHRcdF9sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdFx0XHRyZXR1cm4geyBmYWlsZWQ6IFtdIH07XG5cdFx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4dGVuc2lvbnNUb0luc3RhbGwgPSBlbnZpcm9ubWVudFNlcnZpY2UuYXJnc1snaW5zdGFsbC1leHRlbnNpb24nXTtcblx0XHRpZiAoZXh0ZW5zaW9uc1RvSW5zdGFsbCkge1xuXHRcdFx0X2xvZ1NlcnZpY2UudHJhY2UoJ0luc3RhbGxpbmcgZXh0ZW5zaW9ucyBwYXNzZWQgdmlhIGFyZ3MuLi4nKTtcblx0XHRcdGNvbnN0IGluc3RhbGxPcHRpb25zOiBJbnN0YWxsT3B0aW9ucyA9IHtcblx0XHRcdFx0aXNNYWNoaW5lU2NvcGVkOiAhIWVudmlyb25tZW50U2VydmljZS5hcmdzWydkby1ub3Qtc3luYyddLFxuXHRcdFx0XHRpbnN0YWxsUHJlUmVsZWFzZVZlcnNpb246ICEhZW52aXJvbm1lbnRTZXJ2aWNlLmFyZ3NbJ3ByZS1yZWxlYXNlJ10sXG5cdFx0XHRcdGlzQXBwbGljYXRpb25TY29wZWQ6IHRydWUgLy8gZXh0ZW5zaW9ucyBpbnN0YWxsZWQgZHVyaW5nIHNlcnZlciBzdGFydHVwIGFyZSBhdmFpbGFibGUgdG8gYWxsIHByb2ZpbGVzXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fd2hlbkV4dGVuc2lvbnNSZWFkeSA9IHRoaXMuX3doZW5CdWlsdGluRXh0ZW5zaW9uc1JlYWR5XG5cdFx0XHRcdC50aGVuKCgpID0+IF9leHRlbnNpb25NYW5hZ2VtZW50Q0xJLmluc3RhbGxFeHRlbnNpb25zKHRoaXMuX2FzRXh0ZW5zaW9uSWRPclZTSVgoZXh0ZW5zaW9uc1RvSW5zdGFsbCksIFtdLCBpbnN0YWxsT3B0aW9ucywgISFlbnZpcm9ubWVudFNlcnZpY2UuYXJnc1snZm9yY2UnXSkpXG5cdFx0XHRcdC50aGVuKGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRfbG9nU2VydmljZS50cmFjZSgnRmluaXNoZWQgaW5zdGFsbGluZyBleHRlbnNpb25zJyk7XG5cdFx0XHRcdFx0cmV0dXJuIHsgZmFpbGVkOiBbXSB9O1xuXHRcdFx0XHR9LCBhc3luYyBlcnJvciA9PiB7XG5cdFx0XHRcdFx0X2xvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXG5cdFx0XHRcdFx0Y29uc3QgZmFpbGVkOiB7XG5cdFx0XHRcdFx0XHRpZDogc3RyaW5nO1xuXHRcdFx0XHRcdFx0aW5zdGFsbE9wdGlvbnM6IEluc3RhbGxPcHRpb25zO1xuXHRcdFx0XHRcdH1bXSA9IFtdO1xuXHRcdFx0XHRcdGNvbnN0IGFscmVhZHlJbnN0YWxsZWQgPSBhd2FpdCB0aGlzLl9leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRJbnN0YWxsZWQoRXh0ZW5zaW9uVHlwZS5Vc2VyKTtcblxuXHRcdFx0XHRcdGZvciAoY29uc3QgaWQgb2YgdGhpcy5fYXNFeHRlbnNpb25JZE9yVlNJWChleHRlbnNpb25zVG9JbnN0YWxsKSkge1xuXHRcdFx0XHRcdFx0aWYgKHR5cGVvZiBpZCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdFx0aWYgKCFhbHJlYWR5SW5zdGFsbGVkLnNvbWUoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIHsgaWQgfSkpKSB7XG5cdFx0XHRcdFx0XHRcdFx0ZmFpbGVkLnB1c2goeyBpZCwgaW5zdGFsbE9wdGlvbnMgfSk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoIWZhaWxlZC5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdF9sb2dTZXJ2aWNlLnRyYWNlKGBObyBleHRlbnNpb25zIHRvIHJlcG9ydCBhcyBmYWlsZWRgKTtcblx0XHRcdFx0XHRcdHJldHVybiB7IGZhaWxlZDogW10gfTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRfbG9nU2VydmljZS5pbmZvKGBSZWxheWluZyB0aGUgZm9sbG93aW5nIGV4dGVuc2lvbnMgdG8gaW5zdGFsbCBsYXRlcjogJHtmYWlsZWQubWFwKGYgPT4gZi5pZCkuam9pbignLCAnKX1gKTtcblx0XHRcdFx0XHRyZXR1cm4geyBmYWlsZWQgfTtcblx0XHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfYXNFeHRlbnNpb25JZE9yVlNJWChpbnB1dHM6IHN0cmluZ1tdKTogKHN0cmluZyB8IFVSSSlbXSB7XG5cdFx0cmV0dXJuIGlucHV0cy5tYXAoaW5wdXQgPT4gL1xcLnZzaXgkL2kudGVzdChpbnB1dCkgPyBVUkkuZmlsZShpc0Fic29sdXRlKGlucHV0KSA/IGlucHV0IDogam9pbihjd2QoKSwgaW5wdXQpKSA6IGlucHV0KTtcblx0fVxuXG5cdHdoZW5FeHRlbnNpb25zUmVhZHkoKTogUHJvbWlzZTxJbnN0YWxsRXh0ZW5zaW9uU3VtbWFyeT4ge1xuXHRcdHJldHVybiB0aGlzLl93aGVuRXh0ZW5zaW9uc1JlYWR5O1xuXHR9XG5cblx0YXN5bmMgc2NhbkV4dGVuc2lvbnMoXG5cdFx0bGFuZ3VhZ2U/OiBzdHJpbmcsXG5cdFx0cHJvZmlsZUxvY2F0aW9uPzogVVJJLFxuXHRcdHdvcmtzcGFjZUV4dGVuc2lvbkxvY2F0aW9ucz86IFVSSVtdLFxuXHRcdGV4dGVuc2lvbkRldmVsb3BtZW50TG9jYXRpb25zPzogVVJJW10sXG5cdFx0bGFuZ3VhZ2VQYWNrSWQ/OiBzdHJpbmdcblx0KTogUHJvbWlzZTxJRXh0ZW5zaW9uRGVzY3JpcHRpb25bXT4ge1xuXHRcdHBlcmZvcm1hbmNlLm1hcmsoJ2NvZGUvc2VydmVyL3dpbGxTY2FuRXh0ZW5zaW9ucycpO1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYFNjYW5uaW5nIGV4dGVuc2lvbnMgdXNpbmcgVUkgbGFuZ3VhZ2U6ICR7bGFuZ3VhZ2V9YCk7XG5cblx0XHRhd2FpdCB0aGlzLl93aGVuQnVpbHRpbkV4dGVuc2lvbnNSZWFkeTtcblxuXHRcdGNvbnN0IGV4dGVuc2lvbkRldmVsb3BtZW50UGF0aHMgPSBleHRlbnNpb25EZXZlbG9wbWVudExvY2F0aW9ucyA/IGV4dGVuc2lvbkRldmVsb3BtZW50TG9jYXRpb25zLmZpbHRlcih1cmwgPT4gdXJsLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlKS5tYXAodXJsID0+IHVybC5mc1BhdGgpIDogdW5kZWZpbmVkO1xuXHRcdHByb2ZpbGVMb2NhdGlvbiA9IHByb2ZpbGVMb2NhdGlvbiA/PyB0aGlzLl91c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5leHRlbnNpb25zUmVzb3VyY2U7XG5cblx0XHRjb25zdCBleHRlbnNpb25zID0gYXdhaXQgdGhpcy5fc2NhbkV4dGVuc2lvbnMocHJvZmlsZUxvY2F0aW9uLCBsYW5ndWFnZSA/PyBwbGF0Zm9ybS5sYW5ndWFnZSwgd29ya3NwYWNlRXh0ZW5zaW9uTG9jYXRpb25zLCBleHRlbnNpb25EZXZlbG9wbWVudFBhdGhzLCBsYW5ndWFnZVBhY2tJZCk7XG5cblx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKCdTY2FubmVkIEV4dGVuc2lvbnMnLCBleHRlbnNpb25zKTtcblx0XHR0aGlzLl9tYXNzYWdlV2hlbkNvbmRpdGlvbnMoZXh0ZW5zaW9ucyk7XG5cblx0XHRwZXJmb3JtYW5jZS5tYXJrKCdjb2RlL3NlcnZlci9kaWRTY2FuRXh0ZW5zaW9ucycpO1xuXHRcdHJldHVybiBleHRlbnNpb25zO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfc2NhbkV4dGVuc2lvbnMocHJvZmlsZUxvY2F0aW9uOiBVUkksIGxhbmd1YWdlOiBzdHJpbmcsIHdvcmtzcGFjZUluc3RhbGxlZEV4dGVuc2lvbkxvY2F0aW9uczogVVJJW10gfCB1bmRlZmluZWQsIGV4dGVuc2lvbkRldmVsb3BtZW50UGF0aDogc3RyaW5nW10gfCB1bmRlZmluZWQsIGxhbmd1YWdlUGFja0lkOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBQcm9taXNlPElFeHRlbnNpb25EZXNjcmlwdGlvbltdPiB7XG5cdFx0YXdhaXQgdGhpcy5fZW5zdXJlTGFuZ3VhZ2VQYWNrSXNJbnN0YWxsZWQobGFuZ3VhZ2UsIGxhbmd1YWdlUGFja0lkKTtcblxuXHRcdGNvbnN0IFtidWlsdGluRXh0ZW5zaW9ucywgaW5zdGFsbGVkRXh0ZW5zaW9ucywgd29ya3NwYWNlSW5zdGFsbGVkRXh0ZW5zaW9ucywgZGV2ZWxvcGVkRXh0ZW5zaW9uc10gPSBhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHR0aGlzLl9zY2FuQnVpbHRpbkV4dGVuc2lvbnMobGFuZ3VhZ2UpLFxuXHRcdFx0dGhpcy5fc2Nhbkluc3RhbGxlZEV4dGVuc2lvbnMocHJvZmlsZUxvY2F0aW9uLCBsYW5ndWFnZSksXG5cdFx0XHR0aGlzLl9zY2FuV29ya3NwYWNlSW5zdGFsbGVkRXh0ZW5zaW9ucyhsYW5ndWFnZSwgd29ya3NwYWNlSW5zdGFsbGVkRXh0ZW5zaW9uTG9jYXRpb25zKSxcblx0XHRcdHRoaXMuX3NjYW5EZXZlbG9wZWRFeHRlbnNpb25zKGxhbmd1YWdlLCBleHRlbnNpb25EZXZlbG9wbWVudFBhdGgpXG5cdFx0XSk7XG5cblx0XHRyZXR1cm4gZGVkdXBFeHRlbnNpb25zKGJ1aWx0aW5FeHRlbnNpb25zLCBpbnN0YWxsZWRFeHRlbnNpb25zLCB3b3Jrc3BhY2VJbnN0YWxsZWRFeHRlbnNpb25zLCBkZXZlbG9wZWRFeHRlbnNpb25zLCB0aGlzLl9sb2dTZXJ2aWNlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3NjYW5EZXZlbG9wZWRFeHRlbnNpb25zKGxhbmd1YWdlOiBzdHJpbmcsIGV4dGVuc2lvbkRldmVsb3BtZW50UGF0aHM/OiBzdHJpbmdbXSk6IFByb21pc2U8SUV4dGVuc2lvbkRlc2NyaXB0aW9uW10+IHtcblx0XHRpZiAoZXh0ZW5zaW9uRGV2ZWxvcG1lbnRQYXRocykge1xuXHRcdFx0cmV0dXJuIChhd2FpdCBQcm9taXNlLmFsbChleHRlbnNpb25EZXZlbG9wbWVudFBhdGhzLm1hcChleHRlbnNpb25EZXZlbG9wbWVudFBhdGggPT4gdGhpcy5fZXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLnNjYW5PbmVPck11bHRpcGxlRXh0ZW5zaW9ucyhVUkkuZmlsZShyZXNvbHZlKGV4dGVuc2lvbkRldmVsb3BtZW50UGF0aCkpLCBFeHRlbnNpb25UeXBlLlVzZXIsIHsgbGFuZ3VhZ2UgfSkpKSlcblx0XHRcdFx0LmZsYXQoKVxuXHRcdFx0XHQubWFwKGUgPT4gdG9FeHRlbnNpb25EZXNjcmlwdGlvbihlLCB0cnVlKSk7XG5cdFx0fVxuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3NjYW5Xb3Jrc3BhY2VJbnN0YWxsZWRFeHRlbnNpb25zKGxhbmd1YWdlOiBzdHJpbmcsIHdvcmtzcGFjZUluc3RhbGxlZEV4dGVuc2lvbnM/OiBVUklbXSk6IFByb21pc2U8SUV4dGVuc2lvbkRlc2NyaXB0aW9uW10+IHtcblx0XHRjb25zdCByZXN1bHQ6IElFeHRlbnNpb25EZXNjcmlwdGlvbltdID0gW107XG5cdFx0aWYgKHdvcmtzcGFjZUluc3RhbGxlZEV4dGVuc2lvbnM/Lmxlbmd0aCkge1xuXHRcdFx0Y29uc3Qgc2Nhbm5lZEV4dGVuc2lvbnMgPSBhd2FpdCBQcm9taXNlLmFsbCh3b3Jrc3BhY2VJbnN0YWxsZWRFeHRlbnNpb25zLm1hcChsb2NhdGlvbiA9PiB0aGlzLl9leHRlbnNpb25zU2Nhbm5lclNlcnZpY2Uuc2NhbkV4aXN0aW5nRXh0ZW5zaW9uKGxvY2F0aW9uLCBFeHRlbnNpb25UeXBlLlVzZXIsIHsgbGFuZ3VhZ2UgfSkpKTtcblx0XHRcdGZvciAoY29uc3Qgc2Nhbm5lZEV4dGVuc2lvbiBvZiBzY2FubmVkRXh0ZW5zaW9ucykge1xuXHRcdFx0XHRpZiAoc2Nhbm5lZEV4dGVuc2lvbikge1xuXHRcdFx0XHRcdHJlc3VsdC5wdXNoKHRvRXh0ZW5zaW9uRGVzY3JpcHRpb24oc2Nhbm5lZEV4dGVuc2lvbiwgZmFsc2UpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfc2NhbkJ1aWx0aW5FeHRlbnNpb25zKGxhbmd1YWdlOiBzdHJpbmcpOiBQcm9taXNlPElFeHRlbnNpb25EZXNjcmlwdGlvbltdPiB7XG5cdFx0Y29uc3Qgc2Nhbm5lZEV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLl9leHRlbnNpb25zU2Nhbm5lclNlcnZpY2Uuc2NhblN5c3RlbUV4dGVuc2lvbnMoeyBsYW5ndWFnZSB9KTtcblx0XHRyZXR1cm4gc2Nhbm5lZEV4dGVuc2lvbnMubWFwKGUgPT4gdG9FeHRlbnNpb25EZXNjcmlwdGlvbihlLCBmYWxzZSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfc2Nhbkluc3RhbGxlZEV4dGVuc2lvbnMocHJvZmlsZUxvY2F0aW9uOiBVUkksIGxhbmd1YWdlOiBzdHJpbmcpOiBQcm9taXNlPElFeHRlbnNpb25EZXNjcmlwdGlvbltdPiB7XG5cdFx0Y29uc3Qgc2Nhbm5lZEV4dGVuc2lvbnMgPSBhd2FpdCB0aGlzLl9leHRlbnNpb25zU2Nhbm5lclNlcnZpY2Uuc2NhblVzZXJFeHRlbnNpb25zKHsgcHJvZmlsZUxvY2F0aW9uLCBsYW5ndWFnZSwgdXNlQ2FjaGU6IHRydWUgfSk7XG5cdFx0cmV0dXJuIHNjYW5uZWRFeHRlbnNpb25zLm1hcChlID0+IHRvRXh0ZW5zaW9uRGVzY3JpcHRpb24oZSwgZmFsc2UpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2Vuc3VyZUxhbmd1YWdlUGFja0lzSW5zdGFsbGVkKGxhbmd1YWdlOiBzdHJpbmcsIGxhbmd1YWdlUGFja0lkOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoXG5cdFx0XHQvLyBObyBuZWVkIHRvIGluc3RhbGwgbGFuZ3VhZ2UgcGFja3MgZm9yIHRoZSBkZWZhdWx0IGxhbmd1YWdlXG5cdFx0XHRsYW5ndWFnZSA9PT0gcGxhdGZvcm0uTEFOR1VBR0VfREVGQVVMVCB8fFxuXHRcdFx0Ly8gVGhlIGV4dGVuc2lvbiBnYWxsZXJ5IHNlcnZpY2UgbmVlZHMgdG8gYmUgYXZhaWxhYmxlXG5cdFx0XHQhdGhpcy5fZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UuaXNFbmFibGVkKClcblx0XHQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgaW5zdGFsbGVkID0gYXdhaXQgdGhpcy5fbGFuZ3VhZ2VQYWNrU2VydmljZS5nZXRJbnN0YWxsZWRMYW5ndWFnZXMoKTtcblx0XHRcdGlmIChpbnN0YWxsZWQuZmluZChwID0+IHAuaWQgPT09IGxhbmd1YWdlKSkge1xuXHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBMYW5ndWFnZSBQYWNrICR7bGFuZ3VhZ2V9IGlzIGFscmVhZHkgaW5zdGFsbGVkLiBTa2lwcGluZyBsYW5ndWFnZSBwYWNrIGluc3RhbGxhdGlvbi5gKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0Ly8gV2UgdHJpZWQgdG8gc2VlIHdoYXQgaXMgaW5zdGFsbGVkIGJ1dCBmYWlsZWQuIFdlIGNhbiB0cnkgaW5zdGFsbGluZyBhbnl3YXkuXG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0fVxuXG5cdFx0aWYgKCFsYW5ndWFnZVBhY2tJZCkge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZShgTm8gbGFuZ3VhZ2UgcGFjayBpZCBwcm92aWRlZCBmb3IgbGFuZ3VhZ2UgJHtsYW5ndWFnZX0uIFNraXBwaW5nIGxhbmd1YWdlIHBhY2sgaW5zdGFsbGF0aW9uLmApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYExhbmd1YWdlIFBhY2sgJHtsYW5ndWFnZVBhY2tJZH0gZm9yIGxhbmd1YWdlICR7bGFuZ3VhZ2V9IGlzIG5vdCBpbnN0YWxsZWQuIEl0IHdpbGwgYmUgaW5zdGFsbGVkIG5vdy5gKTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5fZXh0ZW5zaW9uTWFuYWdlbWVudENMSS5pbnN0YWxsRXh0ZW5zaW9ucyhbbGFuZ3VhZ2VQYWNrSWRdLCBbXSwgeyBpc01hY2hpbmVTY29wZWQ6IHRydWUgfSwgdHJ1ZSk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHQvLyBXZSB0cmllZCB0byBpbnN0YWxsIHRoZSBsYW5ndWFnZSBwYWNrIGJ1dCBmYWlsZWQuIFdlIGNhbiBjb250aW51ZSB3aXRob3V0IGl0IHRodXMgdXNpbmcgdGhlIGRlZmF1bHQgbGFuZ3VhZ2UuXG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfbWFzc2FnZVdoZW5Db25kaXRpb25zKGV4dGVuc2lvbnM6IElFeHRlbnNpb25EZXNjcmlwdGlvbltdKTogdm9pZCB7XG5cdFx0Ly8gTWFzc2FnZSBcIndoZW5cIiBjb25kaXRpb25zIHdoaWNoIG1lbnRpb24gYHJlc291cmNlU2NoZW1lYFxuXG5cdFx0aW50ZXJmYWNlIFdoZW5Vc2VyIHsgd2hlbj86IHN0cmluZyB9XG5cblx0XHRpbnRlcmZhY2UgTG9jV2hlblVzZXIgeyBbbG9jOiBzdHJpbmddOiBXaGVuVXNlcltdIH1cblxuXHRcdGNvbnN0IF9tYXBSZXNvdXJjZVNjaGVtZVZhbHVlID0gKHZhbHVlOiBzdHJpbmcsIGlzUmVnZXg6IGJvb2xlYW4pOiBzdHJpbmcgPT4ge1xuXHRcdFx0Ly8gY29uc29sZS5sb2coYF9tYXBSZXNvdXJjZVNjaGVtZVZhbHVlOiAke3ZhbHVlfSwgJHtpc1JlZ2V4fWApO1xuXHRcdFx0cmV0dXJuIHZhbHVlLnJlcGxhY2UoL2ZpbGUvZywgJ3ZzY29kZS1yZW1vdGUnKTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgX21hcFJlc291cmNlUmVnRXhwVmFsdWUgPSAodmFsdWU6IFJlZ0V4cCk6IFJlZ0V4cCA9PiB7XG5cdFx0XHRsZXQgZmxhZ3MgPSAnJztcblx0XHRcdGZsYWdzICs9IHZhbHVlLmdsb2JhbCA/ICdnJyA6ICcnO1xuXHRcdFx0ZmxhZ3MgKz0gdmFsdWUuaWdub3JlQ2FzZSA/ICdpJyA6ICcnO1xuXHRcdFx0ZmxhZ3MgKz0gdmFsdWUubXVsdGlsaW5lID8gJ20nIDogJyc7XG5cdFx0XHRyZXR1cm4gbmV3IFJlZ0V4cChfbWFwUmVzb3VyY2VTY2hlbWVWYWx1ZSh2YWx1ZS5zb3VyY2UsIHRydWUpLCBmbGFncyk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IF9leHByS2V5TWFwcGVyID0gbmV3IGNsYXNzIGltcGxlbWVudHMgSUNvbnRleHRLZXlFeHByTWFwcGVyIHtcblx0XHRcdG1hcERlZmluZWQoa2V5OiBzdHJpbmcpOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB7XG5cdFx0XHRcdHJldHVybiBDb250ZXh0S2V5RGVmaW5lZEV4cHIuY3JlYXRlKGtleSk7XG5cdFx0XHR9XG5cdFx0XHRtYXBOb3Qoa2V5OiBzdHJpbmcpOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB7XG5cdFx0XHRcdHJldHVybiBDb250ZXh0S2V5Tm90RXhwci5jcmVhdGUoa2V5KTtcblx0XHRcdH1cblx0XHRcdG1hcEVxdWFscyhrZXk6IHN0cmluZywgdmFsdWU6IGFueSk6IENvbnRleHRLZXlFeHByZXNzaW9uIHtcblx0XHRcdFx0aWYgKGtleSA9PT0gJ3Jlc291cmNlU2NoZW1lJyAmJiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0cmV0dXJuIENvbnRleHRLZXlFcXVhbHNFeHByLmNyZWF0ZShrZXksIF9tYXBSZXNvdXJjZVNjaGVtZVZhbHVlKHZhbHVlLCBmYWxzZSkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiBDb250ZXh0S2V5RXF1YWxzRXhwci5jcmVhdGUoa2V5LCB2YWx1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdG1hcE5vdEVxdWFscyhrZXk6IHN0cmluZywgdmFsdWU6IGFueSk6IENvbnRleHRLZXlFeHByZXNzaW9uIHtcblx0XHRcdFx0aWYgKGtleSA9PT0gJ3Jlc291cmNlU2NoZW1lJyAmJiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0cmV0dXJuIENvbnRleHRLZXlOb3RFcXVhbHNFeHByLmNyZWF0ZShrZXksIF9tYXBSZXNvdXJjZVNjaGVtZVZhbHVlKHZhbHVlLCBmYWxzZSkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiBDb250ZXh0S2V5Tm90RXF1YWxzRXhwci5jcmVhdGUoa2V5LCB2YWx1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdG1hcEdyZWF0ZXIoa2V5OiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB7XG5cdFx0XHRcdHJldHVybiBDb250ZXh0S2V5R3JlYXRlckV4cHIuY3JlYXRlKGtleSwgdmFsdWUpO1xuXHRcdFx0fVxuXHRcdFx0bWFwR3JlYXRlckVxdWFscyhrZXk6IHN0cmluZywgdmFsdWU6IGFueSk6IENvbnRleHRLZXlFeHByZXNzaW9uIHtcblx0XHRcdFx0cmV0dXJuIENvbnRleHRLZXlHcmVhdGVyRXF1YWxzRXhwci5jcmVhdGUoa2V5LCB2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0XHRtYXBTbWFsbGVyKGtleTogc3RyaW5nLCB2YWx1ZTogYW55KTogQ29udGV4dEtleUV4cHJlc3Npb24ge1xuXHRcdFx0XHRyZXR1cm4gQ29udGV4dEtleVNtYWxsZXJFeHByLmNyZWF0ZShrZXksIHZhbHVlKTtcblx0XHRcdH1cblx0XHRcdG1hcFNtYWxsZXJFcXVhbHMoa2V5OiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB7XG5cdFx0XHRcdHJldHVybiBDb250ZXh0S2V5U21hbGxlckVxdWFsc0V4cHIuY3JlYXRlKGtleSwgdmFsdWUpO1xuXHRcdFx0fVxuXHRcdFx0bWFwUmVnZXgoa2V5OiBzdHJpbmcsIHJlZ2V4cDogUmVnRXhwIHwgbnVsbCk6IENvbnRleHRLZXlSZWdleEV4cHIge1xuXHRcdFx0XHRpZiAoa2V5ID09PSAncmVzb3VyY2VTY2hlbWUnICYmIHJlZ2V4cCkge1xuXHRcdFx0XHRcdHJldHVybiBDb250ZXh0S2V5UmVnZXhFeHByLmNyZWF0ZShrZXksIF9tYXBSZXNvdXJjZVJlZ0V4cFZhbHVlKHJlZ2V4cCkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiBDb250ZXh0S2V5UmVnZXhFeHByLmNyZWF0ZShrZXksIHJlZ2V4cCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdG1hcEluKGtleTogc3RyaW5nLCB2YWx1ZUtleTogc3RyaW5nKTogQ29udGV4dEtleUluRXhwciB7XG5cdFx0XHRcdHJldHVybiBDb250ZXh0S2V5SW5FeHByLmNyZWF0ZShrZXksIHZhbHVlS2V5KTtcblx0XHRcdH1cblx0XHRcdG1hcE5vdEluKGtleTogc3RyaW5nLCB2YWx1ZUtleTogc3RyaW5nKTogQ29udGV4dEtleU5vdEluRXhwciB7XG5cdFx0XHRcdHJldHVybiBDb250ZXh0S2V5Tm90SW5FeHByLmNyZWF0ZShrZXksIHZhbHVlS2V5KTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgX21hc3NhZ2VXaGVuVXNlciA9IChlbGVtZW50OiBXaGVuVXNlcikgPT4ge1xuXHRcdFx0aWYgKCFlbGVtZW50IHx8ICFlbGVtZW50LndoZW4gfHwgIS9yZXNvdXJjZVNjaGVtZS8udGVzdChlbGVtZW50LndoZW4pKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZXhwciA9IENvbnRleHRLZXlFeHByLmRlc2VyaWFsaXplKGVsZW1lbnQud2hlbik7XG5cdFx0XHRpZiAoIWV4cHIpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBtYXNzYWdlZCA9IGV4cHIubWFwKF9leHByS2V5TWFwcGVyKTtcblx0XHRcdGVsZW1lbnQud2hlbiA9IG1hc3NhZ2VkLnNlcmlhbGl6ZSgpO1xuXHRcdH07XG5cblx0XHRjb25zdCBfbWFzc2FnZVdoZW5Vc2VyQXJyID0gKGVsZW1lbnRzOiBXaGVuVXNlcltdIHwgV2hlblVzZXIpID0+IHtcblx0XHRcdGlmIChBcnJheS5pc0FycmF5KGVsZW1lbnRzKSkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZWxlbWVudHMpIHtcblx0XHRcdFx0XHRfbWFzc2FnZVdoZW5Vc2VyKGVsZW1lbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRfbWFzc2FnZVdoZW5Vc2VyKGVsZW1lbnRzKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgX21hc3NhZ2VMb2NXaGVuVXNlciA9ICh0YXJnZXQ6IExvY1doZW5Vc2VyKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGxvYyBpbiB0YXJnZXQpIHtcblx0XHRcdFx0X21hc3NhZ2VXaGVuVXNlckFycih0YXJnZXRbbG9jXSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGV4dGVuc2lvbnMuZm9yRWFjaCgoZXh0ZW5zaW9uKSA9PiB7XG5cdFx0XHRpZiAoZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzKSB7XG5cdFx0XHRcdGlmIChleHRlbnNpb24uY29udHJpYnV0ZXMubWVudXMpIHtcblx0XHRcdFx0XHRfbWFzc2FnZUxvY1doZW5Vc2VyKDxMb2NXaGVuVXNlcj5leHRlbnNpb24uY29udHJpYnV0ZXMubWVudXMpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChleHRlbnNpb24uY29udHJpYnV0ZXMua2V5YmluZGluZ3MpIHtcblx0XHRcdFx0XHRfbWFzc2FnZVdoZW5Vc2VyQXJyKDxXaGVuVXNlciB8IFdoZW5Vc2VyW10+ZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmtleWJpbmRpbmdzKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnZpZXdzKSB7XG5cdFx0XHRcdFx0X21hc3NhZ2VMb2NXaGVuVXNlcig8TG9jV2hlblVzZXI+ZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnZpZXdzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBSZW1vdGVFeHRlbnNpb25zU2Nhbm5lckNoYW5uZWwgaW1wbGVtZW50cyBJU2VydmVyQ2hhbm5lbCB7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBzZXJ2aWNlOiBSZW1vdGVFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UsIHByaXZhdGUgZ2V0VXJpVHJhbnNmb3JtZXI6IChyZXF1ZXN0Q29udGV4dDogYW55KSA9PiBJVVJJVHJhbnNmb3JtZXIpIHsgfVxuXG5cdGxpc3Rlbihjb250ZXh0OiBhbnksIGV2ZW50OiBzdHJpbmcpOiBFdmVudDxhbnk+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgbGlzdGVuJyk7XG5cdH1cblxuXHRhc3luYyBjYWxsKGNvbnRleHQ6IGFueSwgY29tbWFuZDogc3RyaW5nLCBhcmdzPzogYW55KTogUHJvbWlzZTxhbnk+IHtcblx0XHRjb25zdCB1cmlUcmFuc2Zvcm1lciA9IHRoaXMuZ2V0VXJpVHJhbnNmb3JtZXIoY29udGV4dCk7XG5cdFx0c3dpdGNoIChjb21tYW5kKSB7XG5cdFx0XHRjYXNlICd3aGVuRXh0ZW5zaW9uc1JlYWR5JzogcmV0dXJuIGF3YWl0IHRoaXMuc2VydmljZS53aGVuRXh0ZW5zaW9uc1JlYWR5KCk7XG5cblx0XHRcdGNhc2UgJ3NjYW5FeHRlbnNpb25zJzoge1xuXHRcdFx0XHRjb25zdCBsYW5ndWFnZSA9IGFyZ3NbMF07XG5cdFx0XHRcdGNvbnN0IHByb2ZpbGVMb2NhdGlvbiA9IGFyZ3NbMV0gPyBVUkkucmV2aXZlKHVyaVRyYW5zZm9ybWVyLnRyYW5zZm9ybUluY29taW5nKGFyZ3NbMV0pKSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0Y29uc3Qgd29ya3NwYWNlRXh0ZW5zaW9uTG9jYXRpb25zID0gQXJyYXkuaXNBcnJheShhcmdzWzJdKSA/IGFyZ3NbMl0ubWFwKHUgPT4gVVJJLnJldml2ZSh1cmlUcmFuc2Zvcm1lci50cmFuc2Zvcm1JbmNvbWluZyh1KSkpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25EZXZlbG9wbWVudFBhdGggPSBBcnJheS5pc0FycmF5KGFyZ3NbM10pID8gYXJnc1szXS5tYXAodSA9PiBVUkkucmV2aXZlKHVyaVRyYW5zZm9ybWVyLnRyYW5zZm9ybUluY29taW5nKHUpKSkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdGNvbnN0IGxhbmd1YWdlUGFja0lkOiBzdHJpbmcgfCB1bmRlZmluZWQgPSBhcmdzWzRdO1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25zID0gYXdhaXQgdGhpcy5zZXJ2aWNlLnNjYW5FeHRlbnNpb25zKFxuXHRcdFx0XHRcdGxhbmd1YWdlLFxuXHRcdFx0XHRcdHByb2ZpbGVMb2NhdGlvbixcblx0XHRcdFx0XHR3b3Jrc3BhY2VFeHRlbnNpb25Mb2NhdGlvbnMsXG5cdFx0XHRcdFx0ZXh0ZW5zaW9uRGV2ZWxvcG1lbnRQYXRoLFxuXHRcdFx0XHRcdGxhbmd1YWdlUGFja0lkXG5cdFx0XHRcdCk7XG5cdFx0XHRcdHJldHVybiBleHRlbnNpb25zLm1hcChleHRlbnNpb24gPT4gdHJhbnNmb3JtT3V0Z29pbmdVUklzKGV4dGVuc2lvbiwgdXJpVHJhbnNmb3JtZXIpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNhbGwnKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxZQUFZLE1BQU0sZUFBZTtBQUMxQyxZQUFZLGNBQWM7QUFDMUIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsV0FBVztBQUNwQixZQUFZLGlCQUFpQjtBQUU3QixTQUEwQiw2QkFBNkI7QUFFdkQsU0FBUyx1QkFBdUIsc0JBQXNCLGdCQUFzQyw2QkFBNkIsdUJBQXVCLGtCQUFrQix5QkFBeUIsbUJBQW1CLHFCQUFxQixxQkFBcUIsNkJBQTZCLDZCQUFvRDtBQUd6VSxTQUFvQyw4QkFBOEI7QUFDbEUsU0FBUyxxQkFBNEM7QUFJckQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxlQUFlO0FBR3hCLFNBQVMseUJBQXlCO0FBRTNCLE1BQU0sK0JBQTBFO0FBQUEsRUFPdEYsWUFDa0IseUJBQ2pCLG9CQUNpQiwwQkFDQSwyQkFDQSxhQUNBLDBCQUNBLHNCQUNBLDZCQUNoQjtBQVJnQjtBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQVhsQixTQUFpQiw4QkFBOEIsUUFBUSxRQUFpQyxFQUFFLFFBQVEsQ0FBQyxFQUFF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
