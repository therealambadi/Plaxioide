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
import { localize } from "../../../../nls.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { IExtensionManagementService, IGlobalExtensionEnablementService, ENABLED_EXTENSIONS_STORAGE_PATH, DISABLED_EXTENSIONS_STORAGE_PATH, InstallOperation, IAllowedExtensionsService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IWorkbenchExtensionEnablementService, EnablementState, IExtensionManagementServerService, IWorkbenchExtensionManagementService, ExtensionInstallLocation } from "../common/extensionManagement.js";
import { areSameExtensions, BetterMergeId, getExtensionDependencies, isMalicious } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { ExtensionType, isAuthenticationProviderExtension, isLanguagePackExtension, isResolverExtension } from "../../../../platform/extensions/common/extensions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { StorageManager } from "../../../../platform/extensionManagement/common/extensionEnablementService.js";
import { webWorkerExtHostConfig } from "../../extensions/common/extensions.js";
import { IUserDataSyncAccountService } from "../../../../platform/userDataSync/common/userDataSyncAccount.js";
import { IUserDataSyncEnablementService } from "../../../../platform/userDataSync/common/userDataSync.js";
import { ILifecycleService, LifecyclePhase } from "../../lifecycle/common/lifecycle.js";
import { INotificationService, NotificationPriority, Severity } from "../../../../platform/notification/common/notification.js";
import { IHostService } from "../../host/browser/host.js";
import { IExtensionBisectService } from "./extensionBisect.js";
import { IWorkspaceTrustManagementService, IWorkspaceTrustRequestService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { IExtensionManifestPropertiesService } from "../../extensions/common/extensionManifestPropertiesService.js";
import { isVirtualWorkspace } from "../../../../platform/workspace/common/virtualWorkspace.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { equals } from "../../../../base/common/arrays.js";
import { isString } from "../../../../base/common/types.js";
import { Delayer } from "../../../../base/common/async.js";
const SOURCE = "IWorkbenchExtensionEnablementService";
let ExtensionEnablementService = class extends Disposable {
  constructor(storageService, globalExtensionEnablementService, contextService, environmentService, extensionManagementService, configurationService, extensionManagementServerService, userDataSyncEnablementService, userDataSyncAccountService, lifecycleService, notificationService, hostService, extensionBisectService, allowedExtensionsService, workspaceTrustManagementService, workspaceTrustRequestService, extensionManifestPropertiesService, instantiationService, logService) {
    super();
    this.storageService = storageService;
    this.globalExtensionEnablementService = globalExtensionEnablementService;
    this.contextService = contextService;
    this.environmentService = environmentService;
    this.extensionManagementService = extensionManagementService;
    this.configurationService = configurationService;
    this.extensionManagementServerService = extensionManagementServerService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this.userDataSyncAccountService = userDataSyncAccountService;
    this.lifecycleService = lifecycleService;
    this.notificationService = notificationService;
    this.extensionBisectService = extensionBisectService;
    this.allowedExtensionsService = allowedExtensionsService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.workspaceTrustRequestService = workspaceTrustRequestService;
    this.extensionManifestPropertiesService = extensionManifestPropertiesService;
    this.logService = logService;
    this._onEnablementChanged = new Emitter();
    this.onEnablementChanged = this._onEnablementChanged.event;
    this.extensionsDisabledExtensions = [];
    this.delayer = this._register(new Delayer(0));
    this.storageManager = this._register(new StorageManager(storageService));
    const uninstallDisposable = this._register(Event.filter(extensionManagementService.onDidUninstallExtension, (e) => !e.error)(({ identifier }) => this._reset(identifier)));
    let isDisposed = false;
    this._register(toDisposable(() => isDisposed = true));
    this.extensionsManager = this._register(instantiationService.createInstance(ExtensionsManager));
    this.extensionsManager.whenInitialized().then(() => {
      if (!isDisposed) {
        uninstallDisposable.dispose();
        this._onDidChangeExtensions([], [], false);
        this._register(this.extensionsManager.onDidChangeExtensions(({ added, removed, isProfileSwitch }) => this._onDidChangeExtensions(added, removed, isProfileSwitch)));
        this.loopCheckForMaliciousExtensions();
      }
    });
    this._register(this.globalExtensionEnablementService.onDidChangeEnablement(({ extensions, source }) => this._onDidChangeGloballyDisabledExtensions(extensions, source)));
    this._register(allowedExtensionsService.onDidChangeAllowedExtensionsConfigValue(() => this._onDidChangeExtensions([], [], false)));
    if (this.allUserExtensionsDisabled) {
      this.lifecycleService.when(LifecyclePhase.Eventually).then(() => {
        this.notificationService.prompt(Severity.Info, localize("extensionsDisabled", "All installed extensions are temporarily disabled."), [{
          label: localize("Reload", "Reload and Enable Extensions"),
          run: () => hostService.reload({ disableExtensions: false })
        }], {
          sticky: true,
          priority: NotificationPriority.URGENT
        });
      });
    }
  }
  get hasWorkspace() {
    return this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY;
  }
  get allUserExtensionsDisabled() {
    return this.environmentService.disableExtensions === true;
  }
  getEnablementState(extension) {
    return this._computeEnablementState(extension, this.extensionsManager.extensions, this.getWorkspaceType());
  }
  getEnablementStates(extensions, workspaceTypeOverrides = {}) {
    const extensionsEnablements = /* @__PURE__ */ new Map();
    const workspaceType = { ...this.getWorkspaceType(), ...workspaceTypeOverrides };
    return extensions.map((extension) => this._computeEnablementState(extension, extensions, workspaceType, extensionsEnablements));
  }
  getDependenciesEnablementStates(extension) {
    return getExtensionDependencies(this.extensionsManager.extensions, extension).map((e) => [e, this.getEnablementState(e)]);
  }
  canChangeEnablement(extension) {
    try {
      this.throwErrorIfCannotChangeEnablement(extension);
      return true;
    } catch (error) {
      return false;
    }
  }
  canChangeWorkspaceEnablement(extension) {
    if (!this.canChangeEnablement(extension)) {
      return false;
    }
    try {
      this.throwErrorIfCannotChangeWorkspaceEnablement(extension);
      return true;
    } catch (error) {
      return false;
    }
  }
  throwErrorIfCannotChangeEnablement(extension, donotCheckDependencies) {
    if (isLanguagePackExtension(extension.manifest)) {
      throw new Error(localize("cannot disable language pack extension", "Cannot change enablement of {0} extension because it contributes language packs.", extension.manifest.displayName || extension.identifier.id));
    }
    if (this.userDataSyncEnablementService.isEnabled() && this.userDataSyncAccountService.account && isAuthenticationProviderExtension(extension.manifest) && extension.manifest.contributes.authentication.some((a) => a.id === this.userDataSyncAccountService.account.authenticationProviderId)) {
      throw new Error(localize("cannot disable auth extension", "Cannot change enablement {0} extension because Settings Sync depends on it.", extension.manifest.displayName || extension.identifier.id));
    }
    if (this._isEnabledInEnv(extension)) {
      throw new Error(localize("cannot change enablement environment", "Cannot change enablement of {0} extension because it is enabled in environment", extension.manifest.displayName || extension.identifier.id));
    }
    this.throwErrorIfEnablementStateCannotBeChanged(extension, this.getEnablementState(extension), donotCheckDependencies);
  }
  throwErrorIfEnablementStateCannotBeChanged(extension, enablementStateOfExtension, donotCheckDependencies) {
    switch (enablementStateOfExtension) {
      case EnablementState.DisabledByEnvironment:
        throw new Error(localize("cannot change disablement environment", "Cannot change enablement of {0} extension because it is disabled in environment", extension.manifest.displayName || extension.identifier.id));
      case EnablementState.DisabledByMalicious:
        throw new Error(localize("cannot change enablement malicious", "Cannot change enablement of {0} extension because it is malicious", extension.manifest.displayName || extension.identifier.id));
      case EnablementState.DisabledByVirtualWorkspace:
        throw new Error(localize("cannot change enablement virtual workspace", "Cannot change enablement of {0} extension because it does not support virtual workspaces", extension.manifest.displayName || extension.identifier.id));
      case EnablementState.DisabledByExtensionKind:
        throw new Error(localize("cannot change enablement extension kind", "Cannot change enablement of {0} extension because of its extension kind", extension.manifest.displayName || extension.identifier.id));
      case EnablementState.DisabledByAllowlist:
        throw new Error(localize("cannot change disallowed extension enablement", "Cannot change enablement of {0} extension because it is disallowed", extension.manifest.displayName || extension.identifier.id));
      case EnablementState.DisabledByInvalidExtension:
        throw new Error(localize("cannot change invalid extension enablement", "Cannot change enablement of {0} extension because of it is invalid", extension.manifest.displayName || extension.identifier.id));
      case EnablementState.DisabledByExtensionDependency:
        if (donotCheckDependencies) {
          break;
        }
        for (const dependency of getExtensionDependencies(this.extensionsManager.extensions, extension)) {
          if (this.isEnabled(dependency)) {
            continue;
          }
          throw new Error(localize("cannot change enablement dependency", "Cannot enable '{0}' extension because it depends on '{1}' extension that cannot be enabled", extension.manifest.displayName || extension.identifier.id, dependency.manifest.displayName || dependency.identifier.id));
        }
    }
  }
  throwErrorIfCannotChangeWorkspaceEnablement(extension) {
    if (!this.hasWorkspace) {
      throw new Error(localize("noWorkspace", "No workspace."));
    }
    if (isAuthenticationProviderExtension(extension.manifest)) {
      throw new Error(localize("cannot disable auth extension in workspace", "Cannot change enablement of {0} extension in workspace because it contributes authentication providers", extension.manifest.displayName || extension.identifier.id));
    }
  }
  async setEnablement(extensions, newState) {
    await this.extensionsManager.whenInitialized();
    if (newState === EnablementState.EnabledGlobally || newState === EnablementState.EnabledWorkspace) {
      extensions.push(...this.getExtensionsToEnableRecursively(extensions, this.extensionsManager.extensions, newState, { dependencies: true, pack: true }));
    }
    const workspace = newState === EnablementState.DisabledWorkspace || newState === EnablementState.EnabledWorkspace;
    for (const extension of extensions) {
      if (workspace) {
        this.throwErrorIfCannotChangeWorkspaceEnablement(extension);
      } else {
        this.throwErrorIfCannotChangeEnablement(extension);
      }
    }
    const result = [];
    for (const extension of extensions) {
      const enablementState = this.getEnablementState(extension);
      if (enablementState === EnablementState.DisabledByTrustRequirement || enablementState === EnablementState.DisabledByExtensionDependency && this.getDependenciesEnablementStates(extension).every(([, e]) => this.isEnabledEnablementState(e) || e === EnablementState.DisabledByTrustRequirement)) {
        const trustState = await this.workspaceTrustRequestService.requestWorkspaceTrust();
        result.push(trustState ?? false);
      } else {
        result.push(await this._setUserEnablementState(extension, newState));
      }
    }
    const changedExtensions = extensions.filter((e, index) => result[index]);
    if (changedExtensions.length) {
      this._onEnablementChanged.fire(changedExtensions);
    }
    return result;
  }
  getExtensionsToEnableRecursively(extensions, allExtensions, enablementState, options, checked = []) {
    if (!options.dependencies && !options.pack) {
      return [];
    }
    const toCheck = extensions.filter((e) => checked.indexOf(e) === -1);
    if (!toCheck.length) {
      return [];
    }
    for (const extension of toCheck) {
      checked.push(extension);
    }
    const extensionsToEnable = [];
    for (const extension of allExtensions) {
      if (checked.some((e) => areSameExtensions(e.identifier, extension.identifier))) {
        continue;
      }
      const enablementStateOfExtension = this.getEnablementState(extension);
      if (this.isEnabledEnablementState(enablementStateOfExtension)) {
        continue;
      }
      if (enablementStateOfExtension === EnablementState.DisabledByExtensionKind) {
        continue;
      }
      if (extensions.some((e) => options.dependencies && e.manifest.extensionDependencies?.some((id) => areSameExtensions({ id }, extension.identifier)) || options.pack && e.manifest.extensionPack?.some((id) => areSameExtensions({ id }, extension.identifier)))) {
        const index = extensionsToEnable.findIndex((e) => areSameExtensions(e.identifier, extension.identifier));
        if (index === -1) {
          extensionsToEnable.push(extension);
        } else {
          try {
            this.throwErrorIfEnablementStateCannotBeChanged(extension, enablementStateOfExtension, true);
            extensionsToEnable.splice(index, 1, extension);
          } catch (error) {
          }
        }
      }
    }
    if (extensionsToEnable.length) {
      extensionsToEnable.push(...this.getExtensionsToEnableRecursively(extensionsToEnable, allExtensions, enablementState, options, checked));
    }
    return extensionsToEnable;
  }
  _setUserEnablementState(extension, newState) {
    const currentState = this._getUserEnablementState(extension.identifier);
    if (currentState === newState) {
      return Promise.resolve(false);
    }
    switch (newState) {
      case EnablementState.EnabledGlobally:
        this._enableExtension(extension.identifier);
        break;
      case EnablementState.DisabledGlobally:
        this._disableExtension(extension.identifier);
        break;
      case EnablementState.EnabledWorkspace:
        this._enableExtensionInWorkspace(extension.identifier);
        break;
      case EnablementState.DisabledWorkspace:
        this._disableExtensionInWorkspace(extension.identifier);
        break;
    }
    return Promise.resolve(true);
  }
  isEnabled(extension) {
    const enablementState = this.getEnablementState(extension);
    return this.isEnabledEnablementState(enablementState);
  }
  isEnabledEnablementState(enablementState) {
    return enablementState === EnablementState.EnabledByEnvironment || enablementState === EnablementState.EnabledWorkspace || enablementState === EnablementState.EnabledGlobally;
  }
  isDisabledGlobally(extension) {
    return this._isDisabledGlobally(extension.identifier);
  }
  _computeEnablementState(extension, extensions, workspaceType, computedEnablementStates) {
    computedEnablementStates = computedEnablementStates ?? /* @__PURE__ */ new Map();
    let enablementState = computedEnablementStates.get(extension);
    if (enablementState !== void 0) {
      return enablementState;
    }
    enablementState = this._getUserEnablementState(extension.identifier);
    const isEnabled = this.isEnabledEnablementState(enablementState);
    if (isMalicious(extension.identifier, this.getMaliciousExtensions())) {
      enablementState = EnablementState.DisabledByMalicious;
    } else if (isEnabled && extension.type === ExtensionType.User && this.allowedExtensionsService.isAllowed(extension) !== true) {
      enablementState = EnablementState.DisabledByAllowlist;
    } else if (isEnabled && !extension.isValid) {
      enablementState = EnablementState.DisabledByInvalidExtension;
    } else if (this.extensionBisectService.isDisabledByBisect(extension)) {
      enablementState = EnablementState.DisabledByEnvironment;
    } else if (this._isDisabledInEnv(extension)) {
      enablementState = EnablementState.DisabledByEnvironment;
    } else if (this._isDisabledByVirtualWorkspace(extension, workspaceType)) {
      enablementState = EnablementState.DisabledByVirtualWorkspace;
    } else if (isEnabled && this._isDisabledByWorkspaceTrust(extension, workspaceType)) {
      enablementState = EnablementState.DisabledByTrustRequirement;
    } else if (this._isDisabledByExtensionKind(extension)) {
      enablementState = EnablementState.DisabledByExtensionKind;
    } else if (isEnabled && this._isDisabledByExtensionDependency(extension, extensions, workspaceType, computedEnablementStates)) {
      enablementState = EnablementState.DisabledByExtensionDependency;
    } else if (!isEnabled && this._isEnabledInEnv(extension)) {
      enablementState = EnablementState.EnabledByEnvironment;
    }
    computedEnablementStates.set(extension, enablementState);
    return enablementState;
  }
  _isDisabledInEnv(extension) {
    if (this.allUserExtensionsDisabled) {
      return !extension.isBuiltin && !isResolverExtension(extension.manifest, this.environmentService.remoteAuthority);
    }
    const disabledExtensions = this.environmentService.disableExtensions;
    if (Array.isArray(disabledExtensions)) {
      return disabledExtensions.some((id) => areSameExtensions({ id }, extension.identifier));
    }
    if (areSameExtensions({ id: BetterMergeId.value }, extension.identifier)) {
      return true;
    }
    return false;
  }
  _isEnabledInEnv(extension) {
    const enabledExtensions = this.environmentService.enableExtensions;
    if (Array.isArray(enabledExtensions)) {
      return enabledExtensions.some((id) => areSameExtensions({ id }, extension.identifier));
    }
    return false;
  }
  _isDisabledByVirtualWorkspace(extension, workspaceType) {
    if (!workspaceType.virtual) {
      return false;
    }
    if (this.extensionManifestPropertiesService.getExtensionVirtualWorkspaceSupportType(extension.manifest) !== false) {
      return false;
    }
    if (this.extensionManagementServerService.getExtensionManagementServer(extension) === this.extensionManagementServerService.webExtensionManagementServer && this.extensionManifestPropertiesService.canExecuteOnWeb(extension.manifest)) {
      return false;
    }
    return true;
  }
  _isDisabledByExtensionKind(extension) {
    if (this.extensionManagementServerService.remoteExtensionManagementServer || this.extensionManagementServerService.webExtensionManagementServer) {
      const installLocation = this.extensionManagementServerService.getExtensionInstallLocation(extension);
      for (const extensionKind of this.extensionManifestPropertiesService.getExtensionKind(extension.manifest)) {
        if (extensionKind === "ui") {
          if (installLocation === ExtensionInstallLocation.Local) {
            return false;
          }
        }
        if (extensionKind === "workspace") {
          if (installLocation === ExtensionInstallLocation.Remote) {
            return false;
          }
        }
        if (extensionKind === "web") {
          if (this.extensionManagementServerService.webExtensionManagementServer) {
            if (installLocation === ExtensionInstallLocation.Web || installLocation === ExtensionInstallLocation.Remote) {
              return false;
            }
          } else if (installLocation === ExtensionInstallLocation.Local) {
            const enableLocalWebWorker = this.configurationService.getValue(webWorkerExtHostConfig);
            if (enableLocalWebWorker === true || enableLocalWebWorker === "auto") {
              return false;
            }
          }
        }
      }
      return true;
    }
    return false;
  }
  _isDisabledByWorkspaceTrust(extension, workspaceType) {
    if (workspaceType.trusted) {
      return false;
    }
    if (this.contextService.isInsideWorkspace(extension.location)) {
      return true;
    }
    return this.extensionManifestPropertiesService.getExtensionUntrustedWorkspaceSupportType(extension.manifest) === false;
  }
  _isDisabledByExtensionDependency(extension, extensions, workspaceType, computedEnablementStates) {
    if (!extension.manifest.extensionDependencies) {
      return false;
    }
    const dependencyExtensions = extensions.filter((e) => extension.manifest.extensionDependencies?.some((id) => areSameExtensions(e.identifier, { id }) && (this.extensionManagementServerService.getExtensionManagementServer(e) === this.extensionManagementServerService.getExtensionManagementServer(extension) || (e.manifest.main || e.manifest.browser) && e.manifest.api === "none")));
    if (!dependencyExtensions.length) {
      return false;
    }
    const hasEnablementState = computedEnablementStates.has(extension);
    if (!hasEnablementState) {
      computedEnablementStates.set(extension, EnablementState.EnabledGlobally);
    }
    try {
      for (const dependencyExtension of dependencyExtensions) {
        const enablementState = this._computeEnablementState(dependencyExtension, extensions, workspaceType, computedEnablementStates);
        if (!this.isEnabledEnablementState(enablementState) && enablementState !== EnablementState.DisabledByExtensionKind) {
          return true;
        }
      }
    } finally {
      if (!hasEnablementState) {
        computedEnablementStates.delete(extension);
      }
    }
    return false;
  }
  _getUserEnablementState(identifier) {
    if (this.hasWorkspace) {
      if (this._getWorkspaceEnabledExtensions().filter((e) => areSameExtensions(e, identifier))[0]) {
        return EnablementState.EnabledWorkspace;
      }
      if (this._getWorkspaceDisabledExtensions().filter((e) => areSameExtensions(e, identifier))[0]) {
        return EnablementState.DisabledWorkspace;
      }
    }
    if (this._isDisabledGlobally(identifier)) {
      return EnablementState.DisabledGlobally;
    }
    return EnablementState.EnabledGlobally;
  }
  _isDisabledGlobally(identifier) {
    return this.globalExtensionEnablementService.getDisabledExtensions().some((e) => areSameExtensions(e, identifier));
  }
  _enableExtension(identifier) {
    this._removeFromWorkspaceDisabledExtensions(identifier);
    this._removeFromWorkspaceEnabledExtensions(identifier);
    return this.globalExtensionEnablementService.enableExtension(identifier, SOURCE);
  }
  _disableExtension(identifier) {
    this._removeFromWorkspaceDisabledExtensions(identifier);
    this._removeFromWorkspaceEnabledExtensions(identifier);
    return this.globalExtensionEnablementService.disableExtension(identifier, SOURCE);
  }
  _enableExtensionInWorkspace(identifier) {
    this._removeFromWorkspaceDisabledExtensions(identifier);
    this._addToWorkspaceEnabledExtensions(identifier);
  }
  _disableExtensionInWorkspace(identifier) {
    this._addToWorkspaceDisabledExtensions(identifier);
    this._removeFromWorkspaceEnabledExtensions(identifier);
  }
  _addToWorkspaceDisabledExtensions(identifier) {
    if (!this.hasWorkspace) {
      return Promise.resolve(false);
    }
    const disabledExtensions = this._getWorkspaceDisabledExtensions();
    if (disabledExtensions.every((e) => !areSameExtensions(e, identifier))) {
      disabledExtensions.push(identifier);
      this._setDisabledExtensions(disabledExtensions);
      return Promise.resolve(true);
    }
    return Promise.resolve(false);
  }
  async _removeFromWorkspaceDisabledExtensions(identifier) {
    if (!this.hasWorkspace) {
      return false;
    }
    const disabledExtensions = this._getWorkspaceDisabledExtensions();
    for (let index = 0; index < disabledExtensions.length; index++) {
      const disabledExtension = disabledExtensions[index];
      if (areSameExtensions(disabledExtension, identifier)) {
        disabledExtensions.splice(index, 1);
        this._setDisabledExtensions(disabledExtensions);
        return true;
      }
    }
    return false;
  }
  _addToWorkspaceEnabledExtensions(identifier) {
    if (!this.hasWorkspace) {
      return false;
    }
    const enabledExtensions = this._getWorkspaceEnabledExtensions();
    if (enabledExtensions.every((e) => !areSameExtensions(e, identifier))) {
      enabledExtensions.push(identifier);
      this._setEnabledExtensions(enabledExtensions);
      return true;
    }
    return false;
  }
  _removeFromWorkspaceEnabledExtensions(identifier) {
    if (!this.hasWorkspace) {
      return false;
    }
    const enabledExtensions = this._getWorkspaceEnabledExtensions();
    for (let index = 0; index < enabledExtensions.length; index++) {
      const disabledExtension = enabledExtensions[index];
      if (areSameExtensions(disabledExtension, identifier)) {
        enabledExtensions.splice(index, 1);
        this._setEnabledExtensions(enabledExtensions);
        return true;
      }
    }
    return false;
  }
  _getWorkspaceEnabledExtensions() {
    return this._getExtensions(ENABLED_EXTENSIONS_STORAGE_PATH);
  }
  _setEnabledExtensions(enabledExtensions) {
    this._setExtensions(ENABLED_EXTENSIONS_STORAGE_PATH, enabledExtensions);
  }
  _getWorkspaceDisabledExtensions() {
    return this._getExtensions(DISABLED_EXTENSIONS_STORAGE_PATH);
  }
  _setDisabledExtensions(disabledExtensions) {
    this._setExtensions(DISABLED_EXTENSIONS_STORAGE_PATH, disabledExtensions);
  }
  _getExtensions(storageId) {
    if (!this.hasWorkspace) {
      return [];
    }
    return this.storageManager.get(storageId, StorageScope.WORKSPACE);
  }
  _setExtensions(storageId, extensions) {
    this.storageManager.set(storageId, extensions, StorageScope.WORKSPACE);
  }
  async _onDidChangeGloballyDisabledExtensions(extensionIdentifiers, source) {
    if (source !== SOURCE) {
      await this.extensionsManager.whenInitialized();
      const extensions = this.extensionsManager.extensions.filter((installedExtension) => extensionIdentifiers.some((identifier) => areSameExtensions(identifier, installedExtension.identifier)));
      this._onEnablementChanged.fire(extensions);
    }
  }
  _onDidChangeExtensions(added, removed, isProfileSwitch) {
    const changedExtensions = added.filter((e) => !this.isEnabledEnablementState(this.getEnablementState(e)));
    const existingDisabledExtensions = this.extensionsDisabledExtensions;
    this.extensionsDisabledExtensions = this.extensionsManager.extensions.filter((extension) => {
      const enablementState = this.getEnablementState(extension);
      return enablementState === EnablementState.DisabledByExtensionDependency || enablementState === EnablementState.DisabledByAllowlist || enablementState === EnablementState.DisabledByMalicious;
    });
    for (const extension of existingDisabledExtensions) {
      if (this.extensionsDisabledExtensions.every((e) => !areSameExtensions(e.identifier, extension.identifier))) {
        changedExtensions.push(extension);
      }
    }
    for (const extension of this.extensionsDisabledExtensions) {
      if (existingDisabledExtensions.every((e) => !areSameExtensions(e.identifier, extension.identifier))) {
        changedExtensions.push(extension);
      }
    }
    if (changedExtensions.length) {
      this._onEnablementChanged.fire(changedExtensions);
    }
    if (!isProfileSwitch) {
      removed.forEach(({ identifier }) => this._reset(identifier));
    }
  }
  async updateExtensionsEnablementsWhenWorkspaceTrustChanges() {
    await this.extensionsManager.whenInitialized();
    const computeEnablementStates = (workspaceType2) => {
      const extensionsEnablements = /* @__PURE__ */ new Map();
      return this.extensionsManager.extensions.map((extension) => [extension, this._computeEnablementState(extension, this.extensionsManager.extensions, workspaceType2, extensionsEnablements)]);
    };
    const workspaceType = this.getWorkspaceType();
    const enablementStatesWithTrustedWorkspace = computeEnablementStates({ ...workspaceType, trusted: true });
    const enablementStatesWithUntrustedWorkspace = computeEnablementStates({ ...workspaceType, trusted: false });
    const enablementChangedExtensionsBecauseOfTrust = enablementStatesWithTrustedWorkspace.filter(([, enablementState], index) => enablementState !== enablementStatesWithUntrustedWorkspace[index][1]).map(([extension]) => extension);
    if (enablementChangedExtensionsBecauseOfTrust.length) {
      this._onEnablementChanged.fire(enablementChangedExtensionsBecauseOfTrust);
    }
  }
  getWorkspaceType() {
    return { trusted: this.workspaceTrustManagementService.isWorkspaceTrusted(), virtual: isVirtualWorkspace(this.contextService.getWorkspace()) };
  }
  _reset(extension) {
    this._removeFromWorkspaceDisabledExtensions(extension);
    this._removeFromWorkspaceEnabledExtensions(extension);
    this.globalExtensionEnablementService.enableExtension(extension);
  }
  loopCheckForMaliciousExtensions() {
    this.checkForMaliciousExtensions().then(() => this.delayer.trigger(() => {
    }, 1e3 * 60 * 5)).then(() => this.loopCheckForMaliciousExtensions());
  }
  async checkForMaliciousExtensions() {
    try {
      const extensionsControlManifest = await this.extensionManagementService.getExtensionsControlManifest();
      const changed = this.storeMaliciousExtensions(extensionsControlManifest.malicious);
      if (changed) {
        this._onDidChangeExtensions([], [], false);
      }
    } catch (err) {
      this.logService.error(err);
    }
  }
  getMaliciousExtensions() {
    return this.storageService.getObject("extensionsEnablement/malicious", StorageScope.APPLICATION, []);
  }
  storeMaliciousExtensions(extensions) {
    const existing = this.getMaliciousExtensions();
    if (equals(existing, extensions, (a, b) => !isString(a) && !isString(b) ? areSameExtensions(a, b) : a === b)) {
      return false;
    }
    this.storageService.store("extensionsEnablement/malicious", JSON.stringify(extensions), StorageScope.APPLICATION, StorageTarget.MACHINE);
    return true;
  }
};
ExtensionEnablementService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IGlobalExtensionEnablementService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IWorkbenchEnvironmentService),
  __decorateParam(4, IExtensionManagementService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IExtensionManagementServerService),
  __decorateParam(7, IUserDataSyncEnablementService),
  __decorateParam(8, IUserDataSyncAccountService),
  __decorateParam(9, ILifecycleService),
  __decorateParam(10, INotificationService),
  __decorateParam(11, IHostService),
  __decorateParam(12, IExtensionBisectService),
  __decorateParam(13, IAllowedExtensionsService),
  __decorateParam(14, IWorkspaceTrustManagementService),
  __decorateParam(15, IWorkspaceTrustRequestService),
  __decorateParam(16, IExtensionManifestPropertiesService),
  __decorateParam(17, IInstantiationService),
  __decorateParam(18, ILogService)
], ExtensionEnablementService);
let ExtensionsManager = class extends Disposable {
  constructor(extensionManagementService, extensionManagementServerService, logService) {
    super();
    this.extensionManagementService = extensionManagementService;
    this.extensionManagementServerService = extensionManagementServerService;
    this.logService = logService;
    this._extensions = [];
    this._onDidChangeExtensions = this._register(new Emitter());
    this.onDidChangeExtensions = this._onDidChangeExtensions.event;
    this.disposed = false;
    this._register(toDisposable(() => this.disposed = true));
    this.initializePromise = this.initialize();
  }
  get extensions() {
    return this._extensions;
  }
  whenInitialized() {
    return this.initializePromise;
  }
  async initialize() {
    try {
      this._extensions = [
        ...await this.extensionManagementService.getInstalled(),
        ...await this.extensionManagementService.getInstalledWorkspaceExtensions(true)
      ];
      if (this.disposed) {
        return;
      }
      this._onDidChangeExtensions.fire({ added: this.extensions, removed: [], isProfileSwitch: false });
    } catch (error) {
      this.logService.error(error);
    }
    this._register(this.extensionManagementService.onDidInstallExtensions((e) => this.updateExtensions(e.reduce((result, { local, operation }) => {
      if (local && operation !== InstallOperation.Migrate) {
        result.push(local);
      }
      return result;
    }, []), [], void 0, false)));
    this._register(Event.filter(this.extensionManagementService.onDidUninstallExtension, (e) => !e.error)((e) => this.updateExtensions([], [e.identifier], e.server, false)));
    this._register(this.extensionManagementService.onDidChangeProfile(({ added, removed, server }) => {
      this.updateExtensions(added, removed.map(({ identifier }) => identifier), server, true);
    }));
  }
  updateExtensions(added, identifiers, server, isProfileSwitch) {
    if (added.length) {
      for (const extension of added) {
        const extensionServer = this.extensionManagementServerService.getExtensionManagementServer(extension);
        const index = this._extensions.findIndex((e) => areSameExtensions(e.identifier, extension.identifier) && this.extensionManagementServerService.getExtensionManagementServer(e) === extensionServer);
        if (index !== -1) {
          this._extensions.splice(index, 1);
        }
      }
      this._extensions.push(...added);
    }
    const removed = [];
    for (const identifier of identifiers) {
      const index = this._extensions.findIndex((e) => areSameExtensions(e.identifier, identifier) && this.extensionManagementServerService.getExtensionManagementServer(e) === server);
      if (index !== -1) {
        removed.push(...this._extensions.splice(index, 1));
      }
    }
    if (added.length || removed.length) {
      this._onDidChangeExtensions.fire({ added, removed, isProfileSwitch });
    }
  }
};
ExtensionsManager = __decorateClass([
  __decorateParam(0, IWorkbenchExtensionManagementService),
  __decorateParam(1, IExtensionManagementServerService),
  __decorateParam(2, ILogService)
], ExtensionsManager);
registerSingleton(IWorkbenchExtensionEnablementService, ExtensionEnablementService, InstantiationType.Delayed);
export {
  ExtensionEnablementService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9icm93c2VyL2V4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgRXZlbnQsIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLCBJRXh0ZW5zaW9uSWRlbnRpZmllciwgSUdsb2JhbEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLCBFTkFCTEVEX0VYVEVOU0lPTlNfU1RPUkFHRV9QQVRILCBESVNBQkxFRF9FWFRFTlNJT05TX1NUT1JBR0VfUEFUSCwgSW5zdGFsbE9wZXJhdGlvbiwgSUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLCBFbmFibGVtZW50U3RhdGUsIElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZSwgSVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLCBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciwgRXh0ZW5zaW9uSW5zdGFsbExvY2F0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgYXJlU2FtZUV4dGVuc2lvbnMsIEJldHRlck1lcmdlSWQsIGdldEV4dGVuc2lvbkRlcGVuZGVuY2llcywgaXNNYWxpY2lvdXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50VXRpbC5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIFdvcmtiZW5jaFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblR5cGUsIElFeHRlbnNpb24sIGlzQXV0aGVudGljYXRpb25Qcm92aWRlckV4dGVuc2lvbiwgaXNMYW5ndWFnZVBhY2tFeHRlbnNpb24sIGlzUmVzb2x2ZXJFeHRlbnNpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBTdG9yYWdlTWFuYWdlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHdlYldvcmtlckV4dEhvc3RDb25maWcsIFdlYldvcmtlckV4dEhvc3RDb25maWdWYWx1ZSB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhU3luY0FjY291bnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFTeW5jL2NvbW1vbi91c2VyRGF0YVN5bmNBY2NvdW50LmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhU3luYy9jb21tb24vdXNlckRhdGFTeW5jLmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVTZXJ2aWNlLCBMaWZlY3ljbGVQaGFzZSB9IGZyb20gJy4uLy4uL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlLCBOb3RpZmljYXRpb25Qcmlvcml0eSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uQmlzZWN0U2VydmljZSB9IGZyb20gJy4vZXh0ZW5zaW9uQmlzZWN0LmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLCBJV29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlVHJ1c3QuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGlzVmlydHVhbFdvcmtzcGFjZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vdmlydHVhbFdvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgZXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IGlzU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgRGVsYXllciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcblxuY29uc3QgU09VUkNFID0gJ0lXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSc7XG5cbnR5cGUgV29ya3NwYWNlVHlwZSA9IHsgcmVhZG9ubHkgdmlydHVhbDogYm9vbGVhbjsgcmVhZG9ubHkgdHJ1c3RlZDogYm9vbGVhbiB9O1xuXG5leHBvcnQgY2xhc3MgRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkVuYWJsZW1lbnRDaGFuZ2VkID0gbmV3IEVtaXR0ZXI8cmVhZG9ubHkgSUV4dGVuc2lvbltdPigpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25FbmFibGVtZW50Q2hhbmdlZDogRXZlbnQ8cmVhZG9ubHkgSUV4dGVuc2lvbltdPiA9IHRoaXMuX29uRW5hYmxlbWVudENoYW5nZWQuZXZlbnQ7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IGV4dGVuc2lvbnNNYW5hZ2VyOiBFeHRlbnNpb25zTWFuYWdlcjtcblx0cHJpdmF0ZSByZWFkb25seSBzdG9yYWdlTWFuYWdlcjogU3RvcmFnZU1hbmFnZXI7XG5cdHByaXZhdGUgZXh0ZW5zaW9uc0Rpc2FibGVkRXh0ZW5zaW9uczogSUV4dGVuc2lvbltdID0gW107XG5cdHByaXZhdGUgcmVhZG9ubHkgZGVsYXllciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEZWxheWVyPHZvaWQ+KDApKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUdsb2JhbEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBnbG9iYWxFeHRlbnNpb25FbmFibGVtZW50U2VydmljZTogSUdsb2JhbEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25NYW5hZ2VtZW50U2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZTogSVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jQWNjb3VudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNBY2NvdW50U2VydmljZTogSVVzZXJEYXRhU3luY0FjY291bnRTZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxpZmVjeWNsZVNlcnZpY2U6IElMaWZlY3ljbGVTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJSG9zdFNlcnZpY2UgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0XHRASUV4dGVuc2lvbkJpc2VjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25CaXNlY3RTZXJ2aWNlOiBJRXh0ZW5zaW9uQmlzZWN0U2VydmljZSxcblx0XHRASUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGFsbG93ZWRFeHRlbnNpb25zU2VydmljZTogSUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSxcblx0XHRASVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlOiBJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSxcblx0XHRASVdvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlOiBJV29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZSxcblx0XHRASUV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlOiBJRXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5zdG9yYWdlTWFuYWdlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBTdG9yYWdlTWFuYWdlcihzdG9yYWdlU2VydmljZSkpO1xuXG5cdFx0Y29uc3QgdW5pbnN0YWxsRGlzcG9zYWJsZSA9IHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmZpbHRlcihleHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5vbkRpZFVuaW5zdGFsbEV4dGVuc2lvbiwgZSA9PiAhZS5lcnJvcikoKHsgaWRlbnRpZmllciB9KSA9PiB0aGlzLl9yZXNldChpZGVudGlmaWVyKSkpO1xuXHRcdGxldCBpc0Rpc3Bvc2VkID0gZmFsc2U7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IGlzRGlzcG9zZWQgPSB0cnVlKSk7XG5cdFx0dGhpcy5leHRlbnNpb25zTWFuYWdlciA9IHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEV4dGVuc2lvbnNNYW5hZ2VyKSk7XG5cdFx0dGhpcy5leHRlbnNpb25zTWFuYWdlci53aGVuSW5pdGlhbGl6ZWQoKS50aGVuKCgpID0+IHtcblx0XHRcdGlmICghaXNEaXNwb3NlZCkge1xuXHRcdFx0XHR1bmluc3RhbGxEaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VFeHRlbnNpb25zKFtdLCBbXSwgZmFsc2UpO1xuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmV4dGVuc2lvbnNNYW5hZ2VyLm9uRGlkQ2hhbmdlRXh0ZW5zaW9ucygoeyBhZGRlZCwgcmVtb3ZlZCwgaXNQcm9maWxlU3dpdGNoIH0pID0+IHRoaXMuX29uRGlkQ2hhbmdlRXh0ZW5zaW9ucyhhZGRlZCwgcmVtb3ZlZCwgaXNQcm9maWxlU3dpdGNoKSkpO1xuXHRcdFx0XHR0aGlzLmxvb3BDaGVja0Zvck1hbGljaW91c0V4dGVuc2lvbnMoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZ2xvYmFsRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2Uub25EaWRDaGFuZ2VFbmFibGVtZW50KCh7IGV4dGVuc2lvbnMsIHNvdXJjZSB9KSA9PiB0aGlzLl9vbkRpZENoYW5nZUdsb2JhbGx5RGlzYWJsZWRFeHRlbnNpb25zKGV4dGVuc2lvbnMsIHNvdXJjZSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2Uub25EaWRDaGFuZ2VBbGxvd2VkRXh0ZW5zaW9uc0NvbmZpZ1ZhbHVlKCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlRXh0ZW5zaW9ucyhbXSwgW10sIGZhbHNlKSkpO1xuXG5cdFx0Ly8gZGVsYXkgbm90aWZpY2F0aW9uIGZvciBleHRlbnNpb25zIGRpc2FibGVkIHVudGlsIHdvcmtiZW5jaCByZXN0b3JlZFxuXHRcdGlmICh0aGlzLmFsbFVzZXJFeHRlbnNpb25zRGlzYWJsZWQpIHtcblx0XHRcdHRoaXMubGlmZWN5Y2xlU2VydmljZS53aGVuKExpZmVjeWNsZVBoYXNlLkV2ZW50dWFsbHkpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFNldmVyaXR5LkluZm8sIGxvY2FsaXplKCdleHRlbnNpb25zRGlzYWJsZWQnLCBcIkFsbCBpbnN0YWxsZWQgZXh0ZW5zaW9ucyBhcmUgdGVtcG9yYXJpbHkgZGlzYWJsZWQuXCIpLCBbe1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnUmVsb2FkJywgXCJSZWxvYWQgYW5kIEVuYWJsZSBFeHRlbnNpb25zXCIpLFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4gaG9zdFNlcnZpY2UucmVsb2FkKHsgZGlzYWJsZUV4dGVuc2lvbnM6IGZhbHNlIH0pXG5cdFx0XHRcdH1dLCB7XG5cdFx0XHRcdFx0c3RpY2t5OiB0cnVlLFxuXHRcdFx0XHRcdHByaW9yaXR5OiBOb3RpZmljYXRpb25Qcmlvcml0eS5VUkdFTlRcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldCBoYXNXb3Jrc3BhY2UoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSAhPT0gV29ya2JlbmNoU3RhdGUuRU1QVFk7XG5cdH1cblxuXHRwcml2YXRlIGdldCBhbGxVc2VyRXh0ZW5zaW9uc0Rpc2FibGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmVudmlyb25tZW50U2VydmljZS5kaXNhYmxlRXh0ZW5zaW9ucyA9PT0gdHJ1ZTtcblx0fVxuXG5cdGdldEVuYWJsZW1lbnRTdGF0ZShleHRlbnNpb246IElFeHRlbnNpb24pOiBFbmFibGVtZW50U3RhdGUge1xuXHRcdHJldHVybiB0aGlzLl9jb21wdXRlRW5hYmxlbWVudFN0YXRlKGV4dGVuc2lvbiwgdGhpcy5leHRlbnNpb25zTWFuYWdlci5leHRlbnNpb25zLCB0aGlzLmdldFdvcmtzcGFjZVR5cGUoKSk7XG5cdH1cblxuXHRnZXRFbmFibGVtZW50U3RhdGVzKGV4dGVuc2lvbnM6IElFeHRlbnNpb25bXSwgd29ya3NwYWNlVHlwZU92ZXJyaWRlczogUGFydGlhbDxXb3Jrc3BhY2VUeXBlPiA9IHt9KTogRW5hYmxlbWVudFN0YXRlW10ge1xuXHRcdGNvbnN0IGV4dGVuc2lvbnNFbmFibGVtZW50cyA9IG5ldyBNYXA8SUV4dGVuc2lvbiwgRW5hYmxlbWVudFN0YXRlPigpO1xuXHRcdGNvbnN0IHdvcmtzcGFjZVR5cGUgPSB7IC4uLnRoaXMuZ2V0V29ya3NwYWNlVHlwZSgpLCAuLi53b3Jrc3BhY2VUeXBlT3ZlcnJpZGVzIH07XG5cdFx0cmV0dXJuIGV4dGVuc2lvbnMubWFwKGV4dGVuc2lvbiA9PiB0aGlzLl9jb21wdXRlRW5hYmxlbWVudFN0YXRlKGV4dGVuc2lvbiwgZXh0ZW5zaW9ucywgd29ya3NwYWNlVHlwZSwgZXh0ZW5zaW9uc0VuYWJsZW1lbnRzKSk7XG5cdH1cblxuXHRnZXREZXBlbmRlbmNpZXNFbmFibGVtZW50U3RhdGVzKGV4dGVuc2lvbjogSUV4dGVuc2lvbik6IFtJRXh0ZW5zaW9uLCBFbmFibGVtZW50U3RhdGVdW10ge1xuXHRcdHJldHVybiBnZXRFeHRlbnNpb25EZXBlbmRlbmNpZXModGhpcy5leHRlbnNpb25zTWFuYWdlci5leHRlbnNpb25zLCBleHRlbnNpb24pLm1hcChlID0+IFtlLCB0aGlzLmdldEVuYWJsZW1lbnRTdGF0ZShlKV0pO1xuXHR9XG5cblx0Y2FuQ2hhbmdlRW5hYmxlbWVudChleHRlbnNpb246IElFeHRlbnNpb24pOiBib29sZWFuIHtcblx0XHR0cnkge1xuXHRcdFx0dGhpcy50aHJvd0Vycm9ySWZDYW5ub3RDaGFuZ2VFbmFibGVtZW50KGV4dGVuc2lvbik7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdGNhbkNoYW5nZVdvcmtzcGFjZUVuYWJsZW1lbnQoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uKTogYm9vbGVhbiB7XG5cdFx0aWYgKCF0aGlzLmNhbkNoYW5nZUVuYWJsZW1lbnQoZXh0ZW5zaW9uKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLnRocm93RXJyb3JJZkNhbm5vdENoYW5nZVdvcmtzcGFjZUVuYWJsZW1lbnQoZXh0ZW5zaW9uKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB0aHJvd0Vycm9ySWZDYW5ub3RDaGFuZ2VFbmFibGVtZW50KGV4dGVuc2lvbjogSUV4dGVuc2lvbiwgZG9ub3RDaGVja0RlcGVuZGVuY2llcz86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAoaXNMYW5ndWFnZVBhY2tFeHRlbnNpb24oZXh0ZW5zaW9uLm1hbmlmZXN0KSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdjYW5ub3QgZGlzYWJsZSBsYW5ndWFnZSBwYWNrIGV4dGVuc2lvbicsIFwiQ2Fubm90IGNoYW5nZSBlbmFibGVtZW50IG9mIHswfSBleHRlbnNpb24gYmVjYXVzZSBpdCBjb250cmlidXRlcyBsYW5ndWFnZSBwYWNrcy5cIiwgZXh0ZW5zaW9uLm1hbmlmZXN0LmRpc3BsYXlOYW1lIHx8IGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMudXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UuaXNFbmFibGVkKCkgJiYgdGhpcy51c2VyRGF0YVN5bmNBY2NvdW50U2VydmljZS5hY2NvdW50ICYmXG5cdFx0XHRpc0F1dGhlbnRpY2F0aW9uUHJvdmlkZXJFeHRlbnNpb24oZXh0ZW5zaW9uLm1hbmlmZXN0KSAmJiBleHRlbnNpb24ubWFuaWZlc3QuY29udHJpYnV0ZXMhLmF1dGhlbnRpY2F0aW9uIS5zb21lKGEgPT4gYS5pZCA9PT0gdGhpcy51c2VyRGF0YVN5bmNBY2NvdW50U2VydmljZS5hY2NvdW50IS5hdXRoZW50aWNhdGlvblByb3ZpZGVySWQpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ2Nhbm5vdCBkaXNhYmxlIGF1dGggZXh0ZW5zaW9uJywgXCJDYW5ub3QgY2hhbmdlIGVuYWJsZW1lbnQgezB9IGV4dGVuc2lvbiBiZWNhdXNlIFNldHRpbmdzIFN5bmMgZGVwZW5kcyBvbiBpdC5cIiwgZXh0ZW5zaW9uLm1hbmlmZXN0LmRpc3BsYXlOYW1lIHx8IGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2lzRW5hYmxlZEluRW52KGV4dGVuc2lvbikpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnY2Fubm90IGNoYW5nZSBlbmFibGVtZW50IGVudmlyb25tZW50JywgXCJDYW5ub3QgY2hhbmdlIGVuYWJsZW1lbnQgb2YgezB9IGV4dGVuc2lvbiBiZWNhdXNlIGl0IGlzIGVuYWJsZWQgaW4gZW52aXJvbm1lbnRcIiwgZXh0ZW5zaW9uLm1hbmlmZXN0LmRpc3BsYXlOYW1lIHx8IGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKSk7XG5cdFx0fVxuXG5cdFx0dGhpcy50aHJvd0Vycm9ySWZFbmFibGVtZW50U3RhdGVDYW5ub3RCZUNoYW5nZWQoZXh0ZW5zaW9uLCB0aGlzLmdldEVuYWJsZW1lbnRTdGF0ZShleHRlbnNpb24pLCBkb25vdENoZWNrRGVwZW5kZW5jaWVzKTtcblx0fVxuXG5cdHByaXZhdGUgdGhyb3dFcnJvcklmRW5hYmxlbWVudFN0YXRlQ2Fubm90QmVDaGFuZ2VkKGV4dGVuc2lvbjogSUV4dGVuc2lvbiwgZW5hYmxlbWVudFN0YXRlT2ZFeHRlbnNpb246IEVuYWJsZW1lbnRTdGF0ZSwgZG9ub3RDaGVja0RlcGVuZGVuY2llcz86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRzd2l0Y2ggKGVuYWJsZW1lbnRTdGF0ZU9mRXh0ZW5zaW9uKSB7XG5cdFx0XHRjYXNlIEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5RW52aXJvbm1lbnQ6XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnY2Fubm90IGNoYW5nZSBkaXNhYmxlbWVudCBlbnZpcm9ubWVudCcsIFwiQ2Fubm90IGNoYW5nZSBlbmFibGVtZW50IG9mIHswfSBleHRlbnNpb24gYmVjYXVzZSBpdCBpcyBkaXNhYmxlZCBpbiBlbnZpcm9ubWVudFwiLCBleHRlbnNpb24ubWFuaWZlc3QuZGlzcGxheU5hbWUgfHwgZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQpKTtcblx0XHRcdGNhc2UgRW5hYmxlbWVudFN0YXRlLkRpc2FibGVkQnlNYWxpY2lvdXM6XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnY2Fubm90IGNoYW5nZSBlbmFibGVtZW50IG1hbGljaW91cycsIFwiQ2Fubm90IGNoYW5nZSBlbmFibGVtZW50IG9mIHswfSBleHRlbnNpb24gYmVjYXVzZSBpdCBpcyBtYWxpY2lvdXNcIiwgZXh0ZW5zaW9uLm1hbmlmZXN0LmRpc3BsYXlOYW1lIHx8IGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKSk7XG5cdFx0XHRjYXNlIEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5VmlydHVhbFdvcmtzcGFjZTpcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdjYW5ub3QgY2hhbmdlIGVuYWJsZW1lbnQgdmlydHVhbCB3b3Jrc3BhY2UnLCBcIkNhbm5vdCBjaGFuZ2UgZW5hYmxlbWVudCBvZiB7MH0gZXh0ZW5zaW9uIGJlY2F1c2UgaXQgZG9lcyBub3Qgc3VwcG9ydCB2aXJ0dWFsIHdvcmtzcGFjZXNcIiwgZXh0ZW5zaW9uLm1hbmlmZXN0LmRpc3BsYXlOYW1lIHx8IGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKSk7XG5cdFx0XHRjYXNlIEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5RXh0ZW5zaW9uS2luZDpcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdjYW5ub3QgY2hhbmdlIGVuYWJsZW1lbnQgZXh0ZW5zaW9uIGtpbmQnLCBcIkNhbm5vdCBjaGFuZ2UgZW5hYmxlbWVudCBvZiB7MH0gZXh0ZW5zaW9uIGJlY2F1c2Ugb2YgaXRzIGV4dGVuc2lvbiBraW5kXCIsIGV4dGVuc2lvbi5tYW5pZmVzdC5kaXNwbGF5TmFtZSB8fCBleHRlbnNpb24uaWRlbnRpZmllci5pZCkpO1xuXHRcdFx0Y2FzZSBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRCeUFsbG93bGlzdDpcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdjYW5ub3QgY2hhbmdlIGRpc2FsbG93ZWQgZXh0ZW5zaW9uIGVuYWJsZW1lbnQnLCBcIkNhbm5vdCBjaGFuZ2UgZW5hYmxlbWVudCBvZiB7MH0gZXh0ZW5zaW9uIGJlY2F1c2UgaXQgaXMgZGlzYWxsb3dlZFwiLCBleHRlbnNpb24ubWFuaWZlc3QuZGlzcGxheU5hbWUgfHwgZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQpKTtcblx0XHRcdGNhc2UgRW5hYmxlbWVudFN0YXRlLkRpc2FibGVkQnlJbnZhbGlkRXh0ZW5zaW9uOlxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ2Nhbm5vdCBjaGFuZ2UgaW52YWxpZCBleHRlbnNpb24gZW5hYmxlbWVudCcsIFwiQ2Fubm90IGNoYW5nZSBlbmFibGVtZW50IG9mIHswfSBleHRlbnNpb24gYmVjYXVzZSBvZiBpdCBpcyBpbnZhbGlkXCIsIGV4dGVuc2lvbi5tYW5pZmVzdC5kaXNwbGF5TmFtZSB8fCBleHRlbnNpb24uaWRlbnRpZmllci5pZCkpO1xuXHRcdFx0Y2FzZSBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRCeUV4dGVuc2lvbkRlcGVuZGVuY3k6XG5cdFx0XHRcdGlmIChkb25vdENoZWNrRGVwZW5kZW5jaWVzKSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gQ2FuIGJlIGNoYW5nZWQgb25seSB3aGVuIGFsbCBpdHMgZGVwZW5kZW5jaWVzIGVuYWJsZW1lbnRzIGNhbiBiZSBjaGFuZ2VkXG5cdFx0XHRcdGZvciAoY29uc3QgZGVwZW5kZW5jeSBvZiBnZXRFeHRlbnNpb25EZXBlbmRlbmNpZXModGhpcy5leHRlbnNpb25zTWFuYWdlci5leHRlbnNpb25zLCBleHRlbnNpb24pKSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuaXNFbmFibGVkKGRlcGVuZGVuY3kpKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdjYW5ub3QgY2hhbmdlIGVuYWJsZW1lbnQgZGVwZW5kZW5jeScsIFwiQ2Fubm90IGVuYWJsZSAnezB9JyBleHRlbnNpb24gYmVjYXVzZSBpdCBkZXBlbmRzIG9uICd7MX0nIGV4dGVuc2lvbiB0aGF0IGNhbm5vdCBiZSBlbmFibGVkXCIsIGV4dGVuc2lvbi5tYW5pZmVzdC5kaXNwbGF5TmFtZSB8fCBleHRlbnNpb24uaWRlbnRpZmllci5pZCwgZGVwZW5kZW5jeS5tYW5pZmVzdC5kaXNwbGF5TmFtZSB8fCBkZXBlbmRlbmN5LmlkZW50aWZpZXIuaWQpKTtcblx0XHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdGhyb3dFcnJvcklmQ2Fubm90Q2hhbmdlV29ya3NwYWNlRW5hYmxlbWVudChleHRlbnNpb246IElFeHRlbnNpb24pOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuaGFzV29ya3NwYWNlKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ25vV29ya3NwYWNlJywgXCJObyB3b3Jrc3BhY2UuXCIpKTtcblx0XHR9XG5cdFx0aWYgKGlzQXV0aGVudGljYXRpb25Qcm92aWRlckV4dGVuc2lvbihleHRlbnNpb24ubWFuaWZlc3QpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ2Nhbm5vdCBkaXNhYmxlIGF1dGggZXh0ZW5zaW9uIGluIHdvcmtzcGFjZScsIFwiQ2Fubm90IGNoYW5nZSBlbmFibGVtZW50IG9mIHswfSBleHRlbnNpb24gaW4gd29ya3NwYWNlIGJlY2F1c2UgaXQgY29udHJpYnV0ZXMgYXV0aGVudGljYXRpb24gcHJvdmlkZXJzXCIsIGV4dGVuc2lvbi5tYW5pZmVzdC5kaXNwbGF5TmFtZSB8fCBleHRlbnNpb24uaWRlbnRpZmllci5pZCkpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHNldEVuYWJsZW1lbnQoZXh0ZW5zaW9uczogSUV4dGVuc2lvbltdLCBuZXdTdGF0ZTogRW5hYmxlbWVudFN0YXRlKTogUHJvbWlzZTxib29sZWFuW10+IHtcblx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbnNNYW5hZ2VyLndoZW5Jbml0aWFsaXplZCgpO1xuXG5cdFx0aWYgKG5ld1N0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRW5hYmxlZEdsb2JhbGx5IHx8IG5ld1N0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRW5hYmxlZFdvcmtzcGFjZSkge1xuXHRcdFx0ZXh0ZW5zaW9ucy5wdXNoKC4uLnRoaXMuZ2V0RXh0ZW5zaW9uc1RvRW5hYmxlUmVjdXJzaXZlbHkoZXh0ZW5zaW9ucywgdGhpcy5leHRlbnNpb25zTWFuYWdlci5leHRlbnNpb25zLCBuZXdTdGF0ZSwgeyBkZXBlbmRlbmNpZXM6IHRydWUsIHBhY2s6IHRydWUgfSkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHdvcmtzcGFjZSA9IG5ld1N0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRXb3Jrc3BhY2UgfHwgbmV3U3RhdGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5FbmFibGVkV29ya3NwYWNlO1xuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGV4dGVuc2lvbnMpIHtcblx0XHRcdGlmICh3b3Jrc3BhY2UpIHtcblx0XHRcdFx0dGhpcy50aHJvd0Vycm9ySWZDYW5ub3RDaGFuZ2VXb3Jrc3BhY2VFbmFibGVtZW50KGV4dGVuc2lvbik7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnRocm93RXJyb3JJZkNhbm5vdENoYW5nZUVuYWJsZW1lbnQoZXh0ZW5zaW9uKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQ6IGJvb2xlYW5bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGV4dGVuc2lvbnMpIHtcblx0XHRcdGNvbnN0IGVuYWJsZW1lbnRTdGF0ZSA9IHRoaXMuZ2V0RW5hYmxlbWVudFN0YXRlKGV4dGVuc2lvbik7XG5cdFx0XHRpZiAoZW5hYmxlbWVudFN0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRCeVRydXN0UmVxdWlyZW1lbnRcblx0XHRcdFx0LyogQWxsIGl0cyBkaXNhYmxlZCBkZXBlbmRlbmNpZXMgYXJlIGRpc2FibGVkIGJ5IFRydXN0IFJlcXVpcmVtZW50ICovXG5cdFx0XHRcdHx8IChlbmFibGVtZW50U3RhdGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5RXh0ZW5zaW9uRGVwZW5kZW5jeSAmJiB0aGlzLmdldERlcGVuZGVuY2llc0VuYWJsZW1lbnRTdGF0ZXMoZXh0ZW5zaW9uKS5ldmVyeSgoWywgZV0pID0+IHRoaXMuaXNFbmFibGVkRW5hYmxlbWVudFN0YXRlKGUpIHx8IGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5VHJ1c3RSZXF1aXJlbWVudCkpXG5cdFx0XHQpIHtcblx0XHRcdFx0Y29uc3QgdHJ1c3RTdGF0ZSA9IGF3YWl0IHRoaXMud29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZS5yZXF1ZXN0V29ya3NwYWNlVHJ1c3QoKTtcblx0XHRcdFx0cmVzdWx0LnB1c2godHJ1c3RTdGF0ZSA/PyBmYWxzZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHQucHVzaChhd2FpdCB0aGlzLl9zZXRVc2VyRW5hYmxlbWVudFN0YXRlKGV4dGVuc2lvbiwgbmV3U3RhdGUpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBjaGFuZ2VkRXh0ZW5zaW9ucyA9IGV4dGVuc2lvbnMuZmlsdGVyKChlLCBpbmRleCkgPT4gcmVzdWx0W2luZGV4XSk7XG5cdFx0aWYgKGNoYW5nZWRFeHRlbnNpb25zLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5fb25FbmFibGVtZW50Q2hhbmdlZC5maXJlKGNoYW5nZWRFeHRlbnNpb25zKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RXh0ZW5zaW9uc1RvRW5hYmxlUmVjdXJzaXZlbHkoZXh0ZW5zaW9uczogSUV4dGVuc2lvbltdLCBhbGxFeHRlbnNpb25zOiBSZWFkb25seUFycmF5PElFeHRlbnNpb24+LCBlbmFibGVtZW50U3RhdGU6IEVuYWJsZW1lbnRTdGF0ZSwgb3B0aW9uczogeyBkZXBlbmRlbmNpZXM6IGJvb2xlYW47IHBhY2s6IGJvb2xlYW4gfSwgY2hlY2tlZDogSUV4dGVuc2lvbltdID0gW10pOiBJRXh0ZW5zaW9uW10ge1xuXHRcdGlmICghb3B0aW9ucy5kZXBlbmRlbmNpZXMgJiYgIW9wdGlvbnMucGFjaykge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRvQ2hlY2sgPSBleHRlbnNpb25zLmZpbHRlcihlID0+IGNoZWNrZWQuaW5kZXhPZihlKSA9PT0gLTEpO1xuXHRcdGlmICghdG9DaGVjay5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiB0b0NoZWNrKSB7XG5cdFx0XHRjaGVja2VkLnB1c2goZXh0ZW5zaW9uKTtcblx0XHR9XG5cblx0XHRjb25zdCBleHRlbnNpb25zVG9FbmFibGU6IElFeHRlbnNpb25bXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGFsbEV4dGVuc2lvbnMpIHtcblx0XHRcdC8vIEV4dGVuc2lvbiBpcyBhbHJlYWR5IGNoZWNrZWRcblx0XHRcdGlmIChjaGVja2VkLnNvbWUoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIGV4dGVuc2lvbi5pZGVudGlmaWVyKSkpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGVuYWJsZW1lbnRTdGF0ZU9mRXh0ZW5zaW9uID0gdGhpcy5nZXRFbmFibGVtZW50U3RhdGUoZXh0ZW5zaW9uKTtcblx0XHRcdC8vIEV4dGVuc2lvbiBpcyBlbmFibGVkXG5cdFx0XHRpZiAodGhpcy5pc0VuYWJsZWRFbmFibGVtZW50U3RhdGUoZW5hYmxlbWVudFN0YXRlT2ZFeHRlbnNpb24pKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBTa2lwIGlmIGRlcGVuZGVuY3kgZXh0ZW5zaW9uIGlzIGRpc2FibGVkIGJ5IGV4dGVuc2lvbiBraW5kXG5cdFx0XHRpZiAoZW5hYmxlbWVudFN0YXRlT2ZFeHRlbnNpb24gPT09IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5RXh0ZW5zaW9uS2luZCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQ2hlY2sgaWYgdGhlIGV4dGVuc2lvbiBpcyBhIGRlcGVuZGVuY3kgb3IgaW4gZXh0ZW5zaW9uIHBhY2tcblx0XHRcdGlmIChleHRlbnNpb25zLnNvbWUoZSA9PlxuXHRcdFx0XHQob3B0aW9ucy5kZXBlbmRlbmNpZXMgJiYgZS5tYW5pZmVzdC5leHRlbnNpb25EZXBlbmRlbmNpZXM/LnNvbWUoaWQgPT4gYXJlU2FtZUV4dGVuc2lvbnMoeyBpZCB9LCBleHRlbnNpb24uaWRlbnRpZmllcikpKVxuXHRcdFx0XHR8fCAob3B0aW9ucy5wYWNrICYmIGUubWFuaWZlc3QuZXh0ZW5zaW9uUGFjaz8uc29tZShpZCA9PiBhcmVTYW1lRXh0ZW5zaW9ucyh7IGlkIH0sIGV4dGVuc2lvbi5pZGVudGlmaWVyKSkpKSkge1xuXG5cdFx0XHRcdGNvbnN0IGluZGV4ID0gZXh0ZW5zaW9uc1RvRW5hYmxlLmZpbmRJbmRleChlID0+IGFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgZXh0ZW5zaW9uLmlkZW50aWZpZXIpKTtcblxuXHRcdFx0XHQvLyBFeHRlbnNpb24gaXMgbm90IGFkZGVkIHRvIHRoZSBkaXNhYmxlbWVudCBsaXN0IHNvIGFkZCBpdFxuXHRcdFx0XHRpZiAoaW5kZXggPT09IC0xKSB7XG5cdFx0XHRcdFx0ZXh0ZW5zaW9uc1RvRW5hYmxlLnB1c2goZXh0ZW5zaW9uKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEV4dGVuc2lvbiBpcyB0aGVyZSBhbHJlYWR5IGluIHRoZSBkaXNhYmxlbWVudCBsaXN0LlxuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0Ly8gUmVwbGFjZSBvbmx5IGlmIHRoZSBlbmFibGVtZW50IHN0YXRlIGNhbiBiZSBjaGFuZ2VkXG5cdFx0XHRcdFx0XHR0aGlzLnRocm93RXJyb3JJZkVuYWJsZW1lbnRTdGF0ZUNhbm5vdEJlQ2hhbmdlZChleHRlbnNpb24sIGVuYWJsZW1lbnRTdGF0ZU9mRXh0ZW5zaW9uLCB0cnVlKTtcblx0XHRcdFx0XHRcdGV4dGVuc2lvbnNUb0VuYWJsZS5zcGxpY2UoaW5kZXgsIDEsIGV4dGVuc2lvbik7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHsgLypEbyBub3QgYWRkKi8gfVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGV4dGVuc2lvbnNUb0VuYWJsZS5sZW5ndGgpIHtcblx0XHRcdGV4dGVuc2lvbnNUb0VuYWJsZS5wdXNoKC4uLnRoaXMuZ2V0RXh0ZW5zaW9uc1RvRW5hYmxlUmVjdXJzaXZlbHkoZXh0ZW5zaW9uc1RvRW5hYmxlLCBhbGxFeHRlbnNpb25zLCBlbmFibGVtZW50U3RhdGUsIG9wdGlvbnMsIGNoZWNrZWQpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZXh0ZW5zaW9uc1RvRW5hYmxlO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0VXNlckVuYWJsZW1lbnRTdGF0ZShleHRlbnNpb246IElFeHRlbnNpb24sIG5ld1N0YXRlOiBFbmFibGVtZW50U3RhdGUpOiBQcm9taXNlPGJvb2xlYW4+IHtcblxuXHRcdGNvbnN0IGN1cnJlbnRTdGF0ZSA9IHRoaXMuX2dldFVzZXJFbmFibGVtZW50U3RhdGUoZXh0ZW5zaW9uLmlkZW50aWZpZXIpO1xuXG5cdFx0aWYgKGN1cnJlbnRTdGF0ZSA9PT0gbmV3U3RhdGUpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoZmFsc2UpO1xuXHRcdH1cblxuXHRcdHN3aXRjaCAobmV3U3RhdGUpIHtcblx0XHRcdGNhc2UgRW5hYmxlbWVudFN0YXRlLkVuYWJsZWRHbG9iYWxseTpcblx0XHRcdFx0dGhpcy5fZW5hYmxlRXh0ZW5zaW9uKGV4dGVuc2lvbi5pZGVudGlmaWVyKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEdsb2JhbGx5OlxuXHRcdFx0XHR0aGlzLl9kaXNhYmxlRXh0ZW5zaW9uKGV4dGVuc2lvbi5pZGVudGlmaWVyKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIEVuYWJsZW1lbnRTdGF0ZS5FbmFibGVkV29ya3NwYWNlOlxuXHRcdFx0XHR0aGlzLl9lbmFibGVFeHRlbnNpb25JbldvcmtzcGFjZShleHRlbnNpb24uaWRlbnRpZmllcik7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRXb3Jrc3BhY2U6XG5cdFx0XHRcdHRoaXMuX2Rpc2FibGVFeHRlbnNpb25JbldvcmtzcGFjZShleHRlbnNpb24uaWRlbnRpZmllcik7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodHJ1ZSk7XG5cdH1cblxuXHRpc0VuYWJsZWQoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgZW5hYmxlbWVudFN0YXRlID0gdGhpcy5nZXRFbmFibGVtZW50U3RhdGUoZXh0ZW5zaW9uKTtcblx0XHRyZXR1cm4gdGhpcy5pc0VuYWJsZWRFbmFibGVtZW50U3RhdGUoZW5hYmxlbWVudFN0YXRlKTtcblx0fVxuXG5cdGlzRW5hYmxlZEVuYWJsZW1lbnRTdGF0ZShlbmFibGVtZW50U3RhdGU6IEVuYWJsZW1lbnRTdGF0ZSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBlbmFibGVtZW50U3RhdGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5FbmFibGVkQnlFbnZpcm9ubWVudCB8fCBlbmFibGVtZW50U3RhdGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5FbmFibGVkV29ya3NwYWNlIHx8IGVuYWJsZW1lbnRTdGF0ZSA9PT0gRW5hYmxlbWVudFN0YXRlLkVuYWJsZWRHbG9iYWxseTtcblx0fVxuXG5cdGlzRGlzYWJsZWRHbG9iYWxseShleHRlbnNpb246IElFeHRlbnNpb24pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faXNEaXNhYmxlZEdsb2JhbGx5KGV4dGVuc2lvbi5pZGVudGlmaWVyKTtcblx0fVxuXG5cdHByaXZhdGUgX2NvbXB1dGVFbmFibGVtZW50U3RhdGUoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uLCBleHRlbnNpb25zOiBSZWFkb25seUFycmF5PElFeHRlbnNpb24+LCB3b3Jrc3BhY2VUeXBlOiBXb3Jrc3BhY2VUeXBlLCBjb21wdXRlZEVuYWJsZW1lbnRTdGF0ZXM/OiBNYXA8SUV4dGVuc2lvbiwgRW5hYmxlbWVudFN0YXRlPik6IEVuYWJsZW1lbnRTdGF0ZSB7XG5cdFx0Y29tcHV0ZWRFbmFibGVtZW50U3RhdGVzID0gY29tcHV0ZWRFbmFibGVtZW50U3RhdGVzID8/IG5ldyBNYXA8SUV4dGVuc2lvbiwgRW5hYmxlbWVudFN0YXRlPigpO1xuXHRcdGxldCBlbmFibGVtZW50U3RhdGUgPSBjb21wdXRlZEVuYWJsZW1lbnRTdGF0ZXMuZ2V0KGV4dGVuc2lvbik7XG5cdFx0aWYgKGVuYWJsZW1lbnRTdGF0ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm4gZW5hYmxlbWVudFN0YXRlO1xuXHRcdH1cblxuXHRcdGVuYWJsZW1lbnRTdGF0ZSA9IHRoaXMuX2dldFVzZXJFbmFibGVtZW50U3RhdGUoZXh0ZW5zaW9uLmlkZW50aWZpZXIpO1xuXHRcdGNvbnN0IGlzRW5hYmxlZCA9IHRoaXMuaXNFbmFibGVkRW5hYmxlbWVudFN0YXRlKGVuYWJsZW1lbnRTdGF0ZSk7XG5cblx0XHRpZiAoaXNNYWxpY2lvdXMoZXh0ZW5zaW9uLmlkZW50aWZpZXIsIHRoaXMuZ2V0TWFsaWNpb3VzRXh0ZW5zaW9ucygpKSkge1xuXHRcdFx0ZW5hYmxlbWVudFN0YXRlID0gRW5hYmxlbWVudFN0YXRlLkRpc2FibGVkQnlNYWxpY2lvdXM7XG5cdFx0fVxuXG5cdFx0ZWxzZSBpZiAoaXNFbmFibGVkICYmIGV4dGVuc2lvbi50eXBlID09PSBFeHRlbnNpb25UeXBlLlVzZXIgJiYgdGhpcy5hbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UuaXNBbGxvd2VkKGV4dGVuc2lvbikgIT09IHRydWUpIHtcblx0XHRcdGVuYWJsZW1lbnRTdGF0ZSA9IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5QWxsb3dsaXN0O1xuXHRcdH1cblxuXHRcdGVsc2UgaWYgKGlzRW5hYmxlZCAmJiAhZXh0ZW5zaW9uLmlzVmFsaWQpIHtcblx0XHRcdGVuYWJsZW1lbnRTdGF0ZSA9IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5SW52YWxpZEV4dGVuc2lvbjtcblx0XHR9XG5cblx0XHRlbHNlIGlmICh0aGlzLmV4dGVuc2lvbkJpc2VjdFNlcnZpY2UuaXNEaXNhYmxlZEJ5QmlzZWN0KGV4dGVuc2lvbikpIHtcblx0XHRcdGVuYWJsZW1lbnRTdGF0ZSA9IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5RW52aXJvbm1lbnQ7XG5cdFx0fVxuXG5cdFx0ZWxzZSBpZiAodGhpcy5faXNEaXNhYmxlZEluRW52KGV4dGVuc2lvbikpIHtcblx0XHRcdGVuYWJsZW1lbnRTdGF0ZSA9IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5RW52aXJvbm1lbnQ7XG5cdFx0fVxuXG5cdFx0ZWxzZSBpZiAodGhpcy5faXNEaXNhYmxlZEJ5VmlydHVhbFdvcmtzcGFjZShleHRlbnNpb24sIHdvcmtzcGFjZVR5cGUpKSB7XG5cdFx0XHRlbmFibGVtZW50U3RhdGUgPSBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRCeVZpcnR1YWxXb3Jrc3BhY2U7XG5cdFx0fVxuXG5cdFx0ZWxzZSBpZiAoaXNFbmFibGVkICYmIHRoaXMuX2lzRGlzYWJsZWRCeVdvcmtzcGFjZVRydXN0KGV4dGVuc2lvbiwgd29ya3NwYWNlVHlwZSkpIHtcblx0XHRcdGVuYWJsZW1lbnRTdGF0ZSA9IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5VHJ1c3RSZXF1aXJlbWVudDtcblx0XHR9XG5cblx0XHRlbHNlIGlmICh0aGlzLl9pc0Rpc2FibGVkQnlFeHRlbnNpb25LaW5kKGV4dGVuc2lvbikpIHtcblx0XHRcdGVuYWJsZW1lbnRTdGF0ZSA9IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5RXh0ZW5zaW9uS2luZDtcblx0XHR9XG5cblx0XHRlbHNlIGlmIChpc0VuYWJsZWQgJiYgdGhpcy5faXNEaXNhYmxlZEJ5RXh0ZW5zaW9uRGVwZW5kZW5jeShleHRlbnNpb24sIGV4dGVuc2lvbnMsIHdvcmtzcGFjZVR5cGUsIGNvbXB1dGVkRW5hYmxlbWVudFN0YXRlcykpIHtcblx0XHRcdGVuYWJsZW1lbnRTdGF0ZSA9IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5RXh0ZW5zaW9uRGVwZW5kZW5jeTtcblx0XHR9XG5cblx0XHRlbHNlIGlmICghaXNFbmFibGVkICYmIHRoaXMuX2lzRW5hYmxlZEluRW52KGV4dGVuc2lvbikpIHtcblx0XHRcdGVuYWJsZW1lbnRTdGF0ZSA9IEVuYWJsZW1lbnRTdGF0ZS5FbmFibGVkQnlFbnZpcm9ubWVudDtcblx0XHR9XG5cblx0XHRjb21wdXRlZEVuYWJsZW1lbnRTdGF0ZXMuc2V0KGV4dGVuc2lvbiwgZW5hYmxlbWVudFN0YXRlKTtcblx0XHRyZXR1cm4gZW5hYmxlbWVudFN0YXRlO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXNEaXNhYmxlZEluRW52KGV4dGVuc2lvbjogSUV4dGVuc2lvbik6IGJvb2xlYW4ge1xuXHRcdGlmICh0aGlzLmFsbFVzZXJFeHRlbnNpb25zRGlzYWJsZWQpIHtcblx0XHRcdHJldHVybiAhZXh0ZW5zaW9uLmlzQnVpbHRpbiAmJiAhaXNSZXNvbHZlckV4dGVuc2lvbihleHRlbnNpb24ubWFuaWZlc3QsIHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGlzYWJsZWRFeHRlbnNpb25zID0gdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UuZGlzYWJsZUV4dGVuc2lvbnM7XG5cdFx0aWYgKEFycmF5LmlzQXJyYXkoZGlzYWJsZWRFeHRlbnNpb25zKSkge1xuXHRcdFx0cmV0dXJuIGRpc2FibGVkRXh0ZW5zaW9ucy5zb21lKGlkID0+IGFyZVNhbWVFeHRlbnNpb25zKHsgaWQgfSwgZXh0ZW5zaW9uLmlkZW50aWZpZXIpKTtcblx0XHR9XG5cblx0XHQvLyBDaGVjayBpZiB0aGlzIGlzIHRoZSBiZXR0ZXIgbWVyZ2UgZXh0ZW5zaW9uIHdoaWNoIHdhcyBtaWdyYXRlZCB0byBhIGJ1aWx0LWluIGV4dGVuc2lvblxuXHRcdGlmIChhcmVTYW1lRXh0ZW5zaW9ucyh7IGlkOiBCZXR0ZXJNZXJnZUlkLnZhbHVlIH0sIGV4dGVuc2lvbi5pZGVudGlmaWVyKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXNFbmFibGVkSW5FbnYoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgZW5hYmxlZEV4dGVuc2lvbnMgPSB0aGlzLmVudmlyb25tZW50U2VydmljZS5lbmFibGVFeHRlbnNpb25zO1xuXHRcdGlmIChBcnJheS5pc0FycmF5KGVuYWJsZWRFeHRlbnNpb25zKSkge1xuXHRcdFx0cmV0dXJuIGVuYWJsZWRFeHRlbnNpb25zLnNvbWUoaWQgPT4gYXJlU2FtZUV4dGVuc2lvbnMoeyBpZCB9LCBleHRlbnNpb24uaWRlbnRpZmllcikpO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIF9pc0Rpc2FibGVkQnlWaXJ0dWFsV29ya3NwYWNlKGV4dGVuc2lvbjogSUV4dGVuc2lvbiwgd29ya3NwYWNlVHlwZTogV29ya3NwYWNlVHlwZSk6IGJvb2xlYW4ge1xuXHRcdC8vIE5vdCBhIHZpcnR1YWwgd29ya3NwYWNlXG5cdFx0aWYgKCF3b3Jrc3BhY2VUeXBlLnZpcnR1YWwpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHQvLyBTdXBwb3J0cyB2aXJ0dWFsIHdvcmtzcGFjZVxuXHRcdGlmICh0aGlzLmV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UuZ2V0RXh0ZW5zaW9uVmlydHVhbFdvcmtzcGFjZVN1cHBvcnRUeXBlKGV4dGVuc2lvbi5tYW5pZmVzdCkgIT09IGZhbHNlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Ly8gV2ViIGV4dGVuc2lvbiBmcm9tIHdlYiBleHRlbnNpb24gbWFuYWdlbWVudCBzZXJ2ZXJcblx0XHRpZiAodGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5nZXRFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyKGV4dGVuc2lvbikgPT09IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2Uud2ViRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciAmJiB0aGlzLmV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UuY2FuRXhlY3V0ZU9uV2ViKGV4dGVuc2lvbi5tYW5pZmVzdCkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByaXZhdGUgX2lzRGlzYWJsZWRCeUV4dGVuc2lvbktpbmQoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciB8fCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLndlYkV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdGNvbnN0IGluc3RhbGxMb2NhdGlvbiA9IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UuZ2V0RXh0ZW5zaW9uSW5zdGFsbExvY2F0aW9uKGV4dGVuc2lvbik7XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbktpbmQgb2YgdGhpcy5leHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLmdldEV4dGVuc2lvbktpbmQoZXh0ZW5zaW9uLm1hbmlmZXN0KSkge1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uS2luZCA9PT0gJ3VpJykge1xuXHRcdFx0XHRcdGlmIChpbnN0YWxsTG9jYXRpb24gPT09IEV4dGVuc2lvbkluc3RhbGxMb2NhdGlvbi5Mb2NhbCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uS2luZCA9PT0gJ3dvcmtzcGFjZScpIHtcblx0XHRcdFx0XHRpZiAoaW5zdGFsbExvY2F0aW9uID09PSBFeHRlbnNpb25JbnN0YWxsTG9jYXRpb24uUmVtb3RlKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChleHRlbnNpb25LaW5kID09PSAnd2ViJykge1xuXHRcdFx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLndlYkV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIgLyogd2ViICovKSB7XG5cdFx0XHRcdFx0XHRpZiAoaW5zdGFsbExvY2F0aW9uID09PSBFeHRlbnNpb25JbnN0YWxsTG9jYXRpb24uV2ViIHx8IGluc3RhbGxMb2NhdGlvbiA9PT0gRXh0ZW5zaW9uSW5zdGFsbExvY2F0aW9uLlJlbW90ZSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChpbnN0YWxsTG9jYXRpb24gPT09IEV4dGVuc2lvbkluc3RhbGxMb2NhdGlvbi5Mb2NhbCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgZW5hYmxlTG9jYWxXZWJXb3JrZXIgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPFdlYldvcmtlckV4dEhvc3RDb25maWdWYWx1ZT4od2ViV29ya2VyRXh0SG9zdENvbmZpZyk7XG5cdFx0XHRcdFx0XHRpZiAoZW5hYmxlTG9jYWxXZWJXb3JrZXIgPT09IHRydWUgfHwgZW5hYmxlTG9jYWxXZWJXb3JrZXIgPT09ICdhdXRvJykge1xuXHRcdFx0XHRcdFx0XHQvLyBXZWIgZXh0ZW5zaW9ucyBhcmUgZW5hYmxlZCBvbiBhbGwgY29uZmlndXJhdGlvbnNcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgX2lzRGlzYWJsZWRCeVdvcmtzcGFjZVRydXN0KGV4dGVuc2lvbjogSUV4dGVuc2lvbiwgd29ya3NwYWNlVHlwZTogV29ya3NwYWNlVHlwZSk6IGJvb2xlYW4ge1xuXHRcdGlmICh3b3Jrc3BhY2VUeXBlLnRydXN0ZWQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5jb250ZXh0U2VydmljZS5pc0luc2lkZVdvcmtzcGFjZShleHRlbnNpb24ubG9jYXRpb24pKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5leHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLmdldEV4dGVuc2lvblVudHJ1c3RlZFdvcmtzcGFjZVN1cHBvcnRUeXBlKGV4dGVuc2lvbi5tYW5pZmVzdCkgPT09IGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXNEaXNhYmxlZEJ5RXh0ZW5zaW9uRGVwZW5kZW5jeShleHRlbnNpb246IElFeHRlbnNpb24sIGV4dGVuc2lvbnM6IFJlYWRvbmx5QXJyYXk8SUV4dGVuc2lvbj4sIHdvcmtzcGFjZVR5cGU6IFdvcmtzcGFjZVR5cGUsIGNvbXB1dGVkRW5hYmxlbWVudFN0YXRlczogTWFwPElFeHRlbnNpb24sIEVuYWJsZW1lbnRTdGF0ZT4pOiBib29sZWFuIHtcblxuXHRcdGlmICghZXh0ZW5zaW9uLm1hbmlmZXN0LmV4dGVuc2lvbkRlcGVuZGVuY2llcykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdC8vIEZpbmQgZGVwZW5kZW5jeSB0aGF0IGlzIGZyb20gdGhlIHNhbWUgc2VydmVyIG9yIGRvZXMgbm90IGV4cG9ydHMgYW55IEFQSVxuXHRcdGNvbnN0IGRlcGVuZGVuY3lFeHRlbnNpb25zID0gZXh0ZW5zaW9ucy5maWx0ZXIoZSA9PlxuXHRcdFx0ZXh0ZW5zaW9uLm1hbmlmZXN0LmV4dGVuc2lvbkRlcGVuZGVuY2llcz8uc29tZShpZCA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIHsgaWQgfSlcblx0XHRcdFx0JiYgKHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UuZ2V0RXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcihlKSA9PT0gdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5nZXRFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyKGV4dGVuc2lvbikgfHwgKChlLm1hbmlmZXN0Lm1haW4gfHwgZS5tYW5pZmVzdC5icm93c2VyKSAmJiBlLm1hbmlmZXN0LmFwaSA9PT0gJ25vbmUnKSkpKTtcblxuXHRcdGlmICghZGVwZW5kZW5jeUV4dGVuc2lvbnMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGFzRW5hYmxlbWVudFN0YXRlID0gY29tcHV0ZWRFbmFibGVtZW50U3RhdGVzLmhhcyhleHRlbnNpb24pO1xuXHRcdGlmICghaGFzRW5hYmxlbWVudFN0YXRlKSB7XG5cdFx0XHQvLyBQbGFjZWhvbGRlciB0byBoYW5kbGUgY3ljbGljIGRlcHNcblx0XHRcdGNvbXB1dGVkRW5hYmxlbWVudFN0YXRlcy5zZXQoZXh0ZW5zaW9uLCBFbmFibGVtZW50U3RhdGUuRW5hYmxlZEdsb2JhbGx5KTtcblx0XHR9XG5cdFx0dHJ5IHtcblx0XHRcdGZvciAoY29uc3QgZGVwZW5kZW5jeUV4dGVuc2lvbiBvZiBkZXBlbmRlbmN5RXh0ZW5zaW9ucykge1xuXHRcdFx0XHRjb25zdCBlbmFibGVtZW50U3RhdGUgPSB0aGlzLl9jb21wdXRlRW5hYmxlbWVudFN0YXRlKGRlcGVuZGVuY3lFeHRlbnNpb24sIGV4dGVuc2lvbnMsIHdvcmtzcGFjZVR5cGUsIGNvbXB1dGVkRW5hYmxlbWVudFN0YXRlcyk7XG5cdFx0XHRcdGlmICghdGhpcy5pc0VuYWJsZWRFbmFibGVtZW50U3RhdGUoZW5hYmxlbWVudFN0YXRlKSAmJiBlbmFibGVtZW50U3RhdGUgIT09IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5RXh0ZW5zaW9uS2luZCkge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGlmICghaGFzRW5hYmxlbWVudFN0YXRlKSB7XG5cdFx0XHRcdC8vIHJlbW92ZSB0aGUgcGxhY2Vob2xkZXJcblx0XHRcdFx0Y29tcHV0ZWRFbmFibGVtZW50U3RhdGVzLmRlbGV0ZShleHRlbnNpb24pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgX2dldFVzZXJFbmFibGVtZW50U3RhdGUoaWRlbnRpZmllcjogSUV4dGVuc2lvbklkZW50aWZpZXIpOiBFbmFibGVtZW50U3RhdGUge1xuXHRcdGlmICh0aGlzLmhhc1dvcmtzcGFjZSkge1xuXHRcdFx0aWYgKHRoaXMuX2dldFdvcmtzcGFjZUVuYWJsZWRFeHRlbnNpb25zKCkuZmlsdGVyKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZSwgaWRlbnRpZmllcikpWzBdKSB7XG5cdFx0XHRcdHJldHVybiBFbmFibGVtZW50U3RhdGUuRW5hYmxlZFdvcmtzcGFjZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuX2dldFdvcmtzcGFjZURpc2FibGVkRXh0ZW5zaW9ucygpLmZpbHRlcihlID0+IGFyZVNhbWVFeHRlbnNpb25zKGUsIGlkZW50aWZpZXIpKVswXSkge1xuXHRcdFx0XHRyZXR1cm4gRW5hYmxlbWVudFN0YXRlLkRpc2FibGVkV29ya3NwYWNlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAodGhpcy5faXNEaXNhYmxlZEdsb2JhbGx5KGlkZW50aWZpZXIpKSB7XG5cdFx0XHRyZXR1cm4gRW5hYmxlbWVudFN0YXRlLkRpc2FibGVkR2xvYmFsbHk7XG5cdFx0fVxuXHRcdHJldHVybiBFbmFibGVtZW50U3RhdGUuRW5hYmxlZEdsb2JhbGx5O1xuXHR9XG5cblx0cHJpdmF0ZSBfaXNEaXNhYmxlZEdsb2JhbGx5KGlkZW50aWZpZXI6IElFeHRlbnNpb25JZGVudGlmaWVyKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuZ2xvYmFsRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuZ2V0RGlzYWJsZWRFeHRlbnNpb25zKCkuc29tZShlID0+IGFyZVNhbWVFeHRlbnNpb25zKGUsIGlkZW50aWZpZXIpKTtcblx0fVxuXG5cdHByaXZhdGUgX2VuYWJsZUV4dGVuc2lvbihpZGVudGlmaWVyOiBJRXh0ZW5zaW9uSWRlbnRpZmllcik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHRoaXMuX3JlbW92ZUZyb21Xb3Jrc3BhY2VEaXNhYmxlZEV4dGVuc2lvbnMoaWRlbnRpZmllcik7XG5cdFx0dGhpcy5fcmVtb3ZlRnJvbVdvcmtzcGFjZUVuYWJsZWRFeHRlbnNpb25zKGlkZW50aWZpZXIpO1xuXHRcdHJldHVybiB0aGlzLmdsb2JhbEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmVuYWJsZUV4dGVuc2lvbihpZGVudGlmaWVyLCBTT1VSQ0UpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZGlzYWJsZUV4dGVuc2lvbihpZGVudGlmaWVyOiBJRXh0ZW5zaW9uSWRlbnRpZmllcik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHRoaXMuX3JlbW92ZUZyb21Xb3Jrc3BhY2VEaXNhYmxlZEV4dGVuc2lvbnMoaWRlbnRpZmllcik7XG5cdFx0dGhpcy5fcmVtb3ZlRnJvbVdvcmtzcGFjZUVuYWJsZWRFeHRlbnNpb25zKGlkZW50aWZpZXIpO1xuXHRcdHJldHVybiB0aGlzLmdsb2JhbEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmRpc2FibGVFeHRlbnNpb24oaWRlbnRpZmllciwgU09VUkNFKTtcblx0fVxuXG5cdHByaXZhdGUgX2VuYWJsZUV4dGVuc2lvbkluV29ya3NwYWNlKGlkZW50aWZpZXI6IElFeHRlbnNpb25JZGVudGlmaWVyKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVtb3ZlRnJvbVdvcmtzcGFjZURpc2FibGVkRXh0ZW5zaW9ucyhpZGVudGlmaWVyKTtcblx0XHR0aGlzLl9hZGRUb1dvcmtzcGFjZUVuYWJsZWRFeHRlbnNpb25zKGlkZW50aWZpZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZGlzYWJsZUV4dGVuc2lvbkluV29ya3NwYWNlKGlkZW50aWZpZXI6IElFeHRlbnNpb25JZGVudGlmaWVyKTogdm9pZCB7XG5cdFx0dGhpcy5fYWRkVG9Xb3Jrc3BhY2VEaXNhYmxlZEV4dGVuc2lvbnMoaWRlbnRpZmllcik7XG5cdFx0dGhpcy5fcmVtb3ZlRnJvbVdvcmtzcGFjZUVuYWJsZWRFeHRlbnNpb25zKGlkZW50aWZpZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBfYWRkVG9Xb3Jrc3BhY2VEaXNhYmxlZEV4dGVuc2lvbnMoaWRlbnRpZmllcjogSUV4dGVuc2lvbklkZW50aWZpZXIpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAoIXRoaXMuaGFzV29ya3NwYWNlKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGZhbHNlKTtcblx0XHR9XG5cdFx0Y29uc3QgZGlzYWJsZWRFeHRlbnNpb25zID0gdGhpcy5fZ2V0V29ya3NwYWNlRGlzYWJsZWRFeHRlbnNpb25zKCk7XG5cdFx0aWYgKGRpc2FibGVkRXh0ZW5zaW9ucy5ldmVyeShlID0+ICFhcmVTYW1lRXh0ZW5zaW9ucyhlLCBpZGVudGlmaWVyKSkpIHtcblx0XHRcdGRpc2FibGVkRXh0ZW5zaW9ucy5wdXNoKGlkZW50aWZpZXIpO1xuXHRcdFx0dGhpcy5fc2V0RGlzYWJsZWRFeHRlbnNpb25zKGRpc2FibGVkRXh0ZW5zaW9ucyk7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRydWUpO1xuXHRcdH1cblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGZhbHNlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3JlbW92ZUZyb21Xb3Jrc3BhY2VEaXNhYmxlZEV4dGVuc2lvbnMoaWRlbnRpZmllcjogSUV4dGVuc2lvbklkZW50aWZpZXIpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRpZiAoIXRoaXMuaGFzV29ya3NwYWNlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGNvbnN0IGRpc2FibGVkRXh0ZW5zaW9ucyA9IHRoaXMuX2dldFdvcmtzcGFjZURpc2FibGVkRXh0ZW5zaW9ucygpO1xuXHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBkaXNhYmxlZEV4dGVuc2lvbnMubGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0XHRjb25zdCBkaXNhYmxlZEV4dGVuc2lvbiA9IGRpc2FibGVkRXh0ZW5zaW9uc1tpbmRleF07XG5cdFx0XHRpZiAoYXJlU2FtZUV4dGVuc2lvbnMoZGlzYWJsZWRFeHRlbnNpb24sIGlkZW50aWZpZXIpKSB7XG5cdFx0XHRcdGRpc2FibGVkRXh0ZW5zaW9ucy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0XHR0aGlzLl9zZXREaXNhYmxlZEV4dGVuc2lvbnMoZGlzYWJsZWRFeHRlbnNpb25zKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgX2FkZFRvV29ya3NwYWNlRW5hYmxlZEV4dGVuc2lvbnMoaWRlbnRpZmllcjogSUV4dGVuc2lvbklkZW50aWZpZXIpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMuaGFzV29ya3NwYWNlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGNvbnN0IGVuYWJsZWRFeHRlbnNpb25zID0gdGhpcy5fZ2V0V29ya3NwYWNlRW5hYmxlZEV4dGVuc2lvbnMoKTtcblx0XHRpZiAoZW5hYmxlZEV4dGVuc2lvbnMuZXZlcnkoZSA9PiAhYXJlU2FtZUV4dGVuc2lvbnMoZSwgaWRlbnRpZmllcikpKSB7XG5cdFx0XHRlbmFibGVkRXh0ZW5zaW9ucy5wdXNoKGlkZW50aWZpZXIpO1xuXHRcdFx0dGhpcy5fc2V0RW5hYmxlZEV4dGVuc2lvbnMoZW5hYmxlZEV4dGVuc2lvbnMpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgX3JlbW92ZUZyb21Xb3Jrc3BhY2VFbmFibGVkRXh0ZW5zaW9ucyhpZGVudGlmaWVyOiBJRXh0ZW5zaW9uSWRlbnRpZmllcik6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5oYXNXb3Jrc3BhY2UpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0Y29uc3QgZW5hYmxlZEV4dGVuc2lvbnMgPSB0aGlzLl9nZXRXb3Jrc3BhY2VFbmFibGVkRXh0ZW5zaW9ucygpO1xuXHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBlbmFibGVkRXh0ZW5zaW9ucy5sZW5ndGg7IGluZGV4KyspIHtcblx0XHRcdGNvbnN0IGRpc2FibGVkRXh0ZW5zaW9uID0gZW5hYmxlZEV4dGVuc2lvbnNbaW5kZXhdO1xuXHRcdFx0aWYgKGFyZVNhbWVFeHRlbnNpb25zKGRpc2FibGVkRXh0ZW5zaW9uLCBpZGVudGlmaWVyKSkge1xuXHRcdFx0XHRlbmFibGVkRXh0ZW5zaW9ucy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0XHR0aGlzLl9zZXRFbmFibGVkRXh0ZW5zaW9ucyhlbmFibGVkRXh0ZW5zaW9ucyk7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX2dldFdvcmtzcGFjZUVuYWJsZWRFeHRlbnNpb25zKCk6IElFeHRlbnNpb25JZGVudGlmaWVyW10ge1xuXHRcdHJldHVybiB0aGlzLl9nZXRFeHRlbnNpb25zKEVOQUJMRURfRVhURU5TSU9OU19TVE9SQUdFX1BBVEgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2V0RW5hYmxlZEV4dGVuc2lvbnMoZW5hYmxlZEV4dGVuc2lvbnM6IElFeHRlbnNpb25JZGVudGlmaWVyW10pOiB2b2lkIHtcblx0XHR0aGlzLl9zZXRFeHRlbnNpb25zKEVOQUJMRURfRVhURU5TSU9OU19TVE9SQUdFX1BBVEgsIGVuYWJsZWRFeHRlbnNpb25zKTtcblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0V29ya3NwYWNlRGlzYWJsZWRFeHRlbnNpb25zKCk6IElFeHRlbnNpb25JZGVudGlmaWVyW10ge1xuXHRcdHJldHVybiB0aGlzLl9nZXRFeHRlbnNpb25zKERJU0FCTEVEX0VYVEVOU0lPTlNfU1RPUkFHRV9QQVRIKTtcblx0fVxuXG5cdHByaXZhdGUgX3NldERpc2FibGVkRXh0ZW5zaW9ucyhkaXNhYmxlZEV4dGVuc2lvbnM6IElFeHRlbnNpb25JZGVudGlmaWVyW10pOiB2b2lkIHtcblx0XHR0aGlzLl9zZXRFeHRlbnNpb25zKERJU0FCTEVEX0VYVEVOU0lPTlNfU1RPUkFHRV9QQVRILCBkaXNhYmxlZEV4dGVuc2lvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0RXh0ZW5zaW9ucyhzdG9yYWdlSWQ6IHN0cmluZyk6IElFeHRlbnNpb25JZGVudGlmaWVyW10ge1xuXHRcdGlmICghdGhpcy5oYXNXb3Jrc3BhY2UpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuc3RvcmFnZU1hbmFnZXIuZ2V0KHN0b3JhZ2VJZCwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSk7XG5cdH1cblxuXHRwcml2YXRlIF9zZXRFeHRlbnNpb25zKHN0b3JhZ2VJZDogc3RyaW5nLCBleHRlbnNpb25zOiBJRXh0ZW5zaW9uSWRlbnRpZmllcltdKTogdm9pZCB7XG5cdFx0dGhpcy5zdG9yYWdlTWFuYWdlci5zZXQoc3RvcmFnZUlkLCBleHRlbnNpb25zLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX29uRGlkQ2hhbmdlR2xvYmFsbHlEaXNhYmxlZEV4dGVuc2lvbnMoZXh0ZW5zaW9uSWRlbnRpZmllcnM6IFJlYWRvbmx5QXJyYXk8SUV4dGVuc2lvbklkZW50aWZpZXI+LCBzb3VyY2U/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoc291cmNlICE9PSBTT1VSQ0UpIHtcblx0XHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uc01hbmFnZXIud2hlbkluaXRpYWxpemVkKCk7XG5cdFx0XHRjb25zdCBleHRlbnNpb25zID0gdGhpcy5leHRlbnNpb25zTWFuYWdlci5leHRlbnNpb25zLmZpbHRlcihpbnN0YWxsZWRFeHRlbnNpb24gPT4gZXh0ZW5zaW9uSWRlbnRpZmllcnMuc29tZShpZGVudGlmaWVyID0+IGFyZVNhbWVFeHRlbnNpb25zKGlkZW50aWZpZXIsIGluc3RhbGxlZEV4dGVuc2lvbi5pZGVudGlmaWVyKSkpO1xuXHRcdFx0dGhpcy5fb25FbmFibGVtZW50Q2hhbmdlZC5maXJlKGV4dGVuc2lvbnMpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlRXh0ZW5zaW9ucyhhZGRlZDogUmVhZG9ubHlBcnJheTxJRXh0ZW5zaW9uPiwgcmVtb3ZlZDogUmVhZG9ubHlBcnJheTxJRXh0ZW5zaW9uPiwgaXNQcm9maWxlU3dpdGNoOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgY2hhbmdlZEV4dGVuc2lvbnM6IElFeHRlbnNpb25bXSA9IGFkZGVkLmZpbHRlcihlID0+ICF0aGlzLmlzRW5hYmxlZEVuYWJsZW1lbnRTdGF0ZSh0aGlzLmdldEVuYWJsZW1lbnRTdGF0ZShlKSkpO1xuXHRcdGNvbnN0IGV4aXN0aW5nRGlzYWJsZWRFeHRlbnNpb25zID0gdGhpcy5leHRlbnNpb25zRGlzYWJsZWRFeHRlbnNpb25zO1xuXHRcdHRoaXMuZXh0ZW5zaW9uc0Rpc2FibGVkRXh0ZW5zaW9ucyA9IHRoaXMuZXh0ZW5zaW9uc01hbmFnZXIuZXh0ZW5zaW9ucy5maWx0ZXIoZXh0ZW5zaW9uID0+IHtcblx0XHRcdGNvbnN0IGVuYWJsZW1lbnRTdGF0ZSA9IHRoaXMuZ2V0RW5hYmxlbWVudFN0YXRlKGV4dGVuc2lvbik7XG5cdFx0XHRyZXR1cm4gZW5hYmxlbWVudFN0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRCeUV4dGVuc2lvbkRlcGVuZGVuY3kgfHwgZW5hYmxlbWVudFN0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRCeUFsbG93bGlzdCB8fCBlbmFibGVtZW50U3RhdGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5TWFsaWNpb3VzO1xuXHRcdH0pO1xuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGV4aXN0aW5nRGlzYWJsZWRFeHRlbnNpb25zKSB7XG5cdFx0XHRpZiAodGhpcy5leHRlbnNpb25zRGlzYWJsZWRFeHRlbnNpb25zLmV2ZXJ5KGUgPT4gIWFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgZXh0ZW5zaW9uLmlkZW50aWZpZXIpKSkge1xuXHRcdFx0XHRjaGFuZ2VkRXh0ZW5zaW9ucy5wdXNoKGV4dGVuc2lvbik7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIHRoaXMuZXh0ZW5zaW9uc0Rpc2FibGVkRXh0ZW5zaW9ucykge1xuXHRcdFx0aWYgKGV4aXN0aW5nRGlzYWJsZWRFeHRlbnNpb25zLmV2ZXJ5KGUgPT4gIWFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgZXh0ZW5zaW9uLmlkZW50aWZpZXIpKSkge1xuXHRcdFx0XHRjaGFuZ2VkRXh0ZW5zaW9ucy5wdXNoKGV4dGVuc2lvbik7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChjaGFuZ2VkRXh0ZW5zaW9ucy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuX29uRW5hYmxlbWVudENoYW5nZWQuZmlyZShjaGFuZ2VkRXh0ZW5zaW9ucyk7XG5cdFx0fVxuXHRcdGlmICghaXNQcm9maWxlU3dpdGNoKSB7XG5cdFx0XHRyZW1vdmVkLmZvckVhY2goKHsgaWRlbnRpZmllciB9KSA9PiB0aGlzLl9yZXNldChpZGVudGlmaWVyKSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGFzeW5jIHVwZGF0ZUV4dGVuc2lvbnNFbmFibGVtZW50c1doZW5Xb3Jrc3BhY2VUcnVzdENoYW5nZXMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5leHRlbnNpb25zTWFuYWdlci53aGVuSW5pdGlhbGl6ZWQoKTtcblxuXHRcdGNvbnN0IGNvbXB1dGVFbmFibGVtZW50U3RhdGVzID0gKHdvcmtzcGFjZVR5cGU6IFdvcmtzcGFjZVR5cGUpOiBbSUV4dGVuc2lvbiwgRW5hYmxlbWVudFN0YXRlXVtdID0+IHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbnNFbmFibGVtZW50cyA9IG5ldyBNYXA8SUV4dGVuc2lvbiwgRW5hYmxlbWVudFN0YXRlPigpO1xuXHRcdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uc01hbmFnZXIuZXh0ZW5zaW9ucy5tYXAoZXh0ZW5zaW9uID0+IFtleHRlbnNpb24sIHRoaXMuX2NvbXB1dGVFbmFibGVtZW50U3RhdGUoZXh0ZW5zaW9uLCB0aGlzLmV4dGVuc2lvbnNNYW5hZ2VyLmV4dGVuc2lvbnMsIHdvcmtzcGFjZVR5cGUsIGV4dGVuc2lvbnNFbmFibGVtZW50cyldKTtcblx0XHR9O1xuXG5cdFx0Y29uc3Qgd29ya3NwYWNlVHlwZSA9IHRoaXMuZ2V0V29ya3NwYWNlVHlwZSgpO1xuXHRcdGNvbnN0IGVuYWJsZW1lbnRTdGF0ZXNXaXRoVHJ1c3RlZFdvcmtzcGFjZSA9IGNvbXB1dGVFbmFibGVtZW50U3RhdGVzKHsgLi4ud29ya3NwYWNlVHlwZSwgdHJ1c3RlZDogdHJ1ZSB9KTtcblx0XHRjb25zdCBlbmFibGVtZW50U3RhdGVzV2l0aFVudHJ1c3RlZFdvcmtzcGFjZSA9IGNvbXB1dGVFbmFibGVtZW50U3RhdGVzKHsgLi4ud29ya3NwYWNlVHlwZSwgdHJ1c3RlZDogZmFsc2UgfSk7XG5cdFx0Y29uc3QgZW5hYmxlbWVudENoYW5nZWRFeHRlbnNpb25zQmVjYXVzZU9mVHJ1c3QgPSBlbmFibGVtZW50U3RhdGVzV2l0aFRydXN0ZWRXb3Jrc3BhY2UuZmlsdGVyKChbLCBlbmFibGVtZW50U3RhdGVdLCBpbmRleCkgPT4gZW5hYmxlbWVudFN0YXRlICE9PSBlbmFibGVtZW50U3RhdGVzV2l0aFVudHJ1c3RlZFdvcmtzcGFjZVtpbmRleF1bMV0pLm1hcCgoW2V4dGVuc2lvbl0pID0+IGV4dGVuc2lvbik7XG5cblx0XHRpZiAoZW5hYmxlbWVudENoYW5nZWRFeHRlbnNpb25zQmVjYXVzZU9mVHJ1c3QubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLl9vbkVuYWJsZW1lbnRDaGFuZ2VkLmZpcmUoZW5hYmxlbWVudENoYW5nZWRFeHRlbnNpb25zQmVjYXVzZU9mVHJ1c3QpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0V29ya3NwYWNlVHlwZSgpOiBXb3Jrc3BhY2VUeXBlIHtcblx0XHRyZXR1cm4geyB0cnVzdGVkOiB0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UuaXNXb3Jrc3BhY2VUcnVzdGVkKCksIHZpcnR1YWw6IGlzVmlydHVhbFdvcmtzcGFjZSh0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpKSB9O1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVzZXQoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uSWRlbnRpZmllcikge1xuXHRcdHRoaXMuX3JlbW92ZUZyb21Xb3Jrc3BhY2VEaXNhYmxlZEV4dGVuc2lvbnMoZXh0ZW5zaW9uKTtcblx0XHR0aGlzLl9yZW1vdmVGcm9tV29ya3NwYWNlRW5hYmxlZEV4dGVuc2lvbnMoZXh0ZW5zaW9uKTtcblx0XHR0aGlzLmdsb2JhbEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmVuYWJsZUV4dGVuc2lvbihleHRlbnNpb24pO1xuXHR9XG5cblx0cHJpdmF0ZSBsb29wQ2hlY2tGb3JNYWxpY2lvdXNFeHRlbnNpb25zKCk6IHZvaWQge1xuXHRcdHRoaXMuY2hlY2tGb3JNYWxpY2lvdXNFeHRlbnNpb25zKClcblx0XHRcdC50aGVuKCgpID0+IHRoaXMuZGVsYXllci50cmlnZ2VyKCgpID0+IHsgfSwgMTAwMCAqIDYwICogNSkpIC8vIGV2ZXJ5IGZpdmUgbWludXRlc1xuXHRcdFx0LnRoZW4oKCkgPT4gdGhpcy5sb29wQ2hlY2tGb3JNYWxpY2lvdXNFeHRlbnNpb25zKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjaGVja0Zvck1hbGljaW91c0V4dGVuc2lvbnMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3QgPSBhd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmdldEV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3QoKTtcblx0XHRcdGNvbnN0IGNoYW5nZWQgPSB0aGlzLnN0b3JlTWFsaWNpb3VzRXh0ZW5zaW9ucyhleHRlbnNpb25zQ29udHJvbE1hbmlmZXN0Lm1hbGljaW91cyk7XG5cdFx0XHRpZiAoY2hhbmdlZCkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUV4dGVuc2lvbnMoW10sIFtdLCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldE1hbGljaW91c0V4dGVuc2lvbnMoKTogUmVhZG9ubHlBcnJheTxJRXh0ZW5zaW9uSWRlbnRpZmllciB8IHN0cmluZz4ge1xuXHRcdHJldHVybiB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldE9iamVjdCgnZXh0ZW5zaW9uc0VuYWJsZW1lbnQvbWFsaWNpb3VzJywgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBbXSk7XG5cdH1cblxuXHRwcml2YXRlIHN0b3JlTWFsaWNpb3VzRXh0ZW5zaW9ucyhleHRlbnNpb25zOiBSZWFkb25seUFycmF5PElFeHRlbnNpb25JZGVudGlmaWVyIHwgc3RyaW5nPik6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGV4aXN0aW5nID0gdGhpcy5nZXRNYWxpY2lvdXNFeHRlbnNpb25zKCk7XG5cdFx0aWYgKGVxdWFscyhleGlzdGluZywgZXh0ZW5zaW9ucywgKGEsIGIpID0+ICFpc1N0cmluZyhhKSAmJiAhaXNTdHJpbmcoYikgPyBhcmVTYW1lRXh0ZW5zaW9ucyhhLCBiKSA6IGEgPT09IGIpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoJ2V4dGVuc2lvbnNFbmFibGVtZW50L21hbGljaW91cycsIEpTT04uc3RyaW5naWZ5KGV4dGVuc2lvbnMpLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cbn1cblxuY2xhc3MgRXh0ZW5zaW9uc01hbmFnZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIF9leHRlbnNpb25zOiBJRXh0ZW5zaW9uW10gPSBbXTtcblx0Z2V0IGV4dGVuc2lvbnMoKTogcmVhZG9ubHkgSUV4dGVuc2lvbltdIHsgcmV0dXJuIHRoaXMuX2V4dGVuc2lvbnM7IH1cblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZUV4dGVuc2lvbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGFkZGVkOiByZWFkb25seSBJRXh0ZW5zaW9uW107IHJlbW92ZWQ6IHJlYWRvbmx5IElFeHRlbnNpb25bXTsgcmVhZG9ubHkgaXNQcm9maWxlU3dpdGNoOiBib29sZWFuIH0+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUV4dGVuc2lvbnMgPSB0aGlzLl9vbkRpZENoYW5nZUV4dGVuc2lvbnMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBpbml0aWFsaXplUHJvbWlzZTtcblx0cHJpdmF0ZSBkaXNwb3NlZDogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJV29ya2JlbmNoRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25NYW5hZ2VtZW50U2VydmljZTogSVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMuZGlzcG9zZWQgPSB0cnVlKSk7XG5cdFx0dGhpcy5pbml0aWFsaXplUHJvbWlzZSA9IHRoaXMuaW5pdGlhbGl6ZSgpO1xuXHR9XG5cblx0d2hlbkluaXRpYWxpemVkKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLmluaXRpYWxpemVQcm9taXNlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBpbml0aWFsaXplKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLl9leHRlbnNpb25zID0gW1xuXHRcdFx0XHQuLi5hd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmdldEluc3RhbGxlZCgpLFxuXHRcdFx0XHQuLi5hd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmdldEluc3RhbGxlZFdvcmtzcGFjZUV4dGVuc2lvbnModHJ1ZSlcblx0XHRcdF07XG5cdFx0XHRpZiAodGhpcy5kaXNwb3NlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUV4dGVuc2lvbnMuZmlyZSh7IGFkZGVkOiB0aGlzLmV4dGVuc2lvbnMsIHJlbW92ZWQ6IFtdLCBpc1Byb2ZpbGVTd2l0Y2g6IGZhbHNlIH0pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdH1cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLm9uRGlkSW5zdGFsbEV4dGVuc2lvbnMoZSA9PlxuXHRcdFx0dGhpcy51cGRhdGVFeHRlbnNpb25zKGUucmVkdWNlPElFeHRlbnNpb25bXT4oKHJlc3VsdCwgeyBsb2NhbCwgb3BlcmF0aW9uIH0pID0+IHtcblx0XHRcdFx0aWYgKGxvY2FsICYmIG9wZXJhdGlvbiAhPT0gSW5zdGFsbE9wZXJhdGlvbi5NaWdyYXRlKSB7IHJlc3VsdC5wdXNoKGxvY2FsKTsgfSByZXR1cm4gcmVzdWx0O1xuXHRcdFx0fSwgW10pLCBbXSwgdW5kZWZpbmVkLCBmYWxzZSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5maWx0ZXIodGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5vbkRpZFVuaW5zdGFsbEV4dGVuc2lvbiwgKGUgPT4gIWUuZXJyb3IpKShlID0+IHRoaXMudXBkYXRlRXh0ZW5zaW9ucyhbXSwgW2UuaWRlbnRpZmllcl0sIGUuc2VydmVyLCBmYWxzZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlUHJvZmlsZSgoeyBhZGRlZCwgcmVtb3ZlZCwgc2VydmVyIH0pID0+IHtcblx0XHRcdHRoaXMudXBkYXRlRXh0ZW5zaW9ucyhhZGRlZCwgcmVtb3ZlZC5tYXAoKHsgaWRlbnRpZmllciB9KSA9PiBpZGVudGlmaWVyKSwgc2VydmVyLCB0cnVlKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUV4dGVuc2lvbnMoYWRkZWQ6IElFeHRlbnNpb25bXSwgaWRlbnRpZmllcnM6IElFeHRlbnNpb25JZGVudGlmaWVyW10sIHNlcnZlcjogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIgfCB1bmRlZmluZWQsIGlzUHJvZmlsZVN3aXRjaDogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmIChhZGRlZC5sZW5ndGgpIHtcblx0XHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGFkZGVkKSB7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvblNlcnZlciA9IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UuZ2V0RXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcihleHRlbnNpb24pO1xuXHRcdFx0XHRjb25zdCBpbmRleCA9IHRoaXMuX2V4dGVuc2lvbnMuZmluZEluZGV4KGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5pZGVudGlmaWVyLCBleHRlbnNpb24uaWRlbnRpZmllcikgJiYgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5nZXRFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyKGUpID09PSBleHRlbnNpb25TZXJ2ZXIpO1xuXHRcdFx0XHRpZiAoaW5kZXggIT09IC0xKSB7XG5cdFx0XHRcdFx0dGhpcy5fZXh0ZW5zaW9ucy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9leHRlbnNpb25zLnB1c2goLi4uYWRkZWQpO1xuXHRcdH1cblx0XHRjb25zdCByZW1vdmVkOiBJRXh0ZW5zaW9uW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGlkZW50aWZpZXIgb2YgaWRlbnRpZmllcnMpIHtcblx0XHRcdGNvbnN0IGluZGV4ID0gdGhpcy5fZXh0ZW5zaW9ucy5maW5kSW5kZXgoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIGlkZW50aWZpZXIpICYmIHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UuZ2V0RXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcihlKSA9PT0gc2VydmVyKTtcblx0XHRcdGlmIChpbmRleCAhPT0gLTEpIHtcblx0XHRcdFx0cmVtb3ZlZC5wdXNoKC4uLnRoaXMuX2V4dGVuc2lvbnMuc3BsaWNlKGluZGV4LCAxKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChhZGRlZC5sZW5ndGggfHwgcmVtb3ZlZC5sZW5ndGgpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRXh0ZW5zaW9ucy5maXJlKHsgYWRkZWQsIHJlbW92ZWQsIGlzUHJvZmlsZVN3aXRjaCB9KTtcblx0XHR9XG5cdH1cbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLCBFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsT0FBTyxlQUFlO0FBQy9CLFNBQVMsWUFBWSxvQkFBb0I7QUFDekMsU0FBUyw2QkFBbUQsbUNBQW1DLGlDQUFpQyxrQ0FBa0Msa0JBQWtCLGlDQUFpQztBQUNyTixTQUFTLHNDQUFzQyxpQkFBaUIsbUNBQW1DLHNDQUFrRSxnQ0FBZ0M7QUFDck0sU0FBUyxtQkFBbUIsZUFBZSwwQkFBMEIsbUJBQW1CO0FBQ3hGLFNBQVMsMEJBQTBCLHNCQUFzQjtBQUN6RCxTQUFTLGlCQUFpQixjQUFjLHFCQUFxQjtBQUM3RCxTQUFTLG9DQUFvQztBQUM3QyxTQUFTLGVBQTJCLG1DQUFtQyx5QkFBeUIsMkJBQTJCO0FBQzNILFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsbUJBQW1CLHlCQUF5QjtBQUNyRCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDhCQUEyRDtBQUNwRSxTQUFTLG1DQUFtQztBQUM1QyxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLG1CQUFtQixzQkFBc0I7QUFDbEQsU0FBUyxzQkFBc0Isc0JBQXNCLGdCQUFnQjtBQUNyRSxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLCtCQUErQjtBQUN4QyxTQUFTLGtDQUFrQyxxQ0FBcUM7QUFDaEYsU0FBUywyQ0FBMkM7QUFDcEQsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZUFBZTtBQUV4QixNQUFNLFNBQVM7QUFJUixJQUFNLDZCQUFOLGNBQXlDLFdBQTJEO0FBQUEsRUFZMUcsWUFDbUMsZ0JBQ29CLGtDQUNYLGdCQUNJLG9CQUNELDRCQUNOLHNCQUNZLGtDQUNILCtCQUNILDRCQUNWLGtCQUNHLHFCQUN6QixhQUM0Qix3QkFDRSwwQkFDTyxpQ0FDSCw4QkFDTSxvQ0FDL0Isc0JBQ08sWUFDN0I7QUFDRCxVQUFNO0FBcEI0QjtBQUNvQjtBQUNYO0FBQ0k7QUFDRDtBQUNOO0FBQ1k7QUFDSDtBQUNIO0FBQ1Y7QUFDRztBQUVHO0FBQ0U7QUFDTztBQUNIO0FBQ007QUFFeEI7QUEzQi9CLFNBQWlCLHVCQUF1QixJQUFJLFFBQStCO0FBQzNFLFNBQWdCLHNCQUFvRCxLQUFLLHFCQUFxQjtBQUk5RixTQUFRLCtCQUE2QyxDQUFDO0FBQ3RELFNBQWlCLFVBQVUsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDLENBQUM7QUF3QjdELFNBQUssaUJBQWlCLEtBQUssVUFBVSxJQUFJLGVBQWUsY0FBYyxDQUFDO0FBRXZFLFVBQU0sc0JBQXNCLEtBQUssVUFBVSxNQUFNLE9BQU8sMkJBQTJCLHlCQUF5QixPQUFLLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLFdBQVcsTUFBTSxLQUFLLE9BQU8sVUFBVSxDQUFDLENBQUM7QUFDdkssUUFBSSxhQUFhO0FBQ2pCLFNBQUssVUFBVSxhQUFhLE1BQU0sYUFBYSxJQUFJLENBQUM7QUFDcEQsU0FBSyxvQkFBb0IsS0FBSyxVQUFVLHFCQUFxQixlQUFlLGlCQUFpQixDQUFDO0FBQzlGLFNBQUssa0JBQWtCLGdCQUFnQixFQUFFLEtBQUssTUFBTTtBQUNuRCxVQUFJLENBQUMsWUFBWTtBQUNoQiw0QkFBb0IsUUFBUTtBQUM1QixhQUFLLHVCQUF1QixDQUFDLEdBQUcsQ0FBQyxHQUFHLEtBQUs7QUFDekMsYUFBSyxVQUFVLEtBQUssa0JBQWtCLHNCQUFzQixDQUFDLEVBQUUsT0FBTyxTQUFTLGdCQUFnQixNQUFNLEtBQUssdUJBQXVCLE9BQU8sU0FBUyxlQUFlLENBQUMsQ0FBQztBQUNsSyxhQUFLLGdDQUFnQztBQUFBLE1BQ3RDO0FBQUEsSUFDRCxDQUFDO0FBRUQsU0FBSyxVQUFVLEtBQUssaUNBQWlDLHNCQUFzQixDQUFDLEVBQUUsWUFBWSxPQUFPLE1BQU0sS0FBSyx1Q0FBdUMsWUFBWSxNQUFNLENBQUMsQ0FBQztBQUN2SyxTQUFLLFVBQVUseUJBQXlCLHdDQUF3QyxNQUFNLEtBQUssdUJBQXVCLENBQUMsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUM7QUFHakksUUFBSSxLQUFLLDJCQUEyQjtBQUNuQyxXQUFLLGlCQUFpQixLQUFLLGVBQWUsVUFBVSxFQUFFLEtBQUssTUFBTTtBQUNoRSxhQUFLLG9CQUFvQixPQUFPLFNBQVMsTUFBTSxTQUFTLHNCQUFzQixvREFBb0QsR0FBRyxDQUFDO0FBQUEsVUFDckksT0FBTyxTQUFTLFVBQVUsOEJBQThCO0FBQUEsVUFDeEQsS0FBSyxNQUFNLFlBQVksT0FBTyxFQUFFLG1CQUFtQixNQUFNLENBQUM7QUFBQSxRQUMzRCxDQUFDLEdBQUc7QUFBQSxVQUNILFFBQVE7QUFBQSxVQUNSLFVBQVUscUJBQXFCO0FBQUEsUUFDaEMsQ0FBQztBQUFBLE1BQ0YsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNEO0FBQUEsRUFFQSxJQUFZLGVBQXdCO0FBQ25DLFdBQU8sS0FBSyxlQUFlLGtCQUFrQixNQUFNLGVBQWU7QUFBQSxFQUNuRTtBQUFBLEVBRUEsSUFBWSw0QkFBcUM7QUFDaEQsV0FBTyxLQUFLLG1CQUFtQixzQkFBc0I7QUFBQSxFQUN0RDtBQUFBLEVBRUEsbUJBQW1CLFdBQXdDO0FBQzFELFdBQU8sS0FBSyx3QkFBd0IsV0FBVyxLQUFLLGtCQUFrQixZQUFZLEtBQUssaUJBQWlCLENBQUM7QUFBQSxFQUMxRztBQUFBLEVBRUEsb0JBQW9CLFlBQTBCLHlCQUFpRCxDQUFDLEdBQXNCO0FBQ3JILFVBQU0sd0JBQXdCLG9CQUFJLElBQWlDO0FBQ25FLFVBQU0sZ0JBQWdCLEVBQUUsR0FBRyxLQUFLLGlCQUFpQixHQUFHLEdBQUcsdUJBQXVCO0FBQzlFLFdBQU8sV0FBVyxJQUFJLGVBQWEsS0FBSyx3QkFBd0IsV0FBVyxZQUFZLGVBQWUscUJBQXFCLENBQUM7QUFBQSxFQUM3SDtBQUFBLEVBRUEsZ0NBQWdDLFdBQXdEO0FBQ3ZGLFdBQU8seUJBQXlCLEtBQUssa0JBQWtCLFlBQVksU0FBUyxFQUFFLElBQUksT0FBSyxDQUFDLEdBQUcsS0FBSyxtQkFBbUIsQ0FBQyxDQUFDLENBQUM7QUFBQSxFQUN2SDtBQUFBLEVBRUEsb0JBQW9CLFdBQWdDO0FBQ25ELFFBQUk7QUFDSCxXQUFLLG1DQUFtQyxTQUFTO0FBQ2pELGFBQU87QUFBQSxJQUNSLFNBQVMsT0FBTztBQUNmLGFBQU87QUFBQSxJQUNSO0FBQUEsRUFDRDtBQUFBLEVBRUEsNkJBQTZCLFdBQWdDO0FBQzVELFFBQUksQ0FBQyxLQUFLLG9CQUFvQixTQUFTLEdBQUc7QUFDekMsYUFBTztBQUFBLElBQ1I7QUFFQSxRQUFJO0FBQ0gsV0FBSyw0Q0FBNEMsU0FBUztBQUMxRCxhQUFPO0FBQUEsSUFDUixTQUFTLE9BQU87QUFDZixhQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLG1DQUFtQyxXQUF1Qix3QkFBd0M7QUFDekcsUUFBSSx3QkFBd0IsVUFBVSxRQUFRLEdBQUc7QUFDaEQsWUFBTSxJQUFJLE1BQU0sU0FBUywwQ0FBMEMsb0ZBQW9GLFVBQVUsU0FBUyxlQUFlLFVBQVUsV0FBVyxFQUFFLENBQUM7QUFBQSxJQUNsTjtBQUVBLFFBQUksS0FBSyw4QkFBOEIsVUFBVSxLQUFLLEtBQUssMkJBQTJCLFdBQ3JGLGtDQUFrQyxVQUFVLFFBQVEsS0FBSyxVQUFVLFNBQVMsWUFBYSxlQUFnQixLQUFLLE9BQUssRUFBRSxPQUFPLEtBQUssMkJBQTJCLFFBQVMsd0JBQXdCLEdBQUc7QUFDaE0sWUFBTSxJQUFJLE1BQU0sU0FBUyxpQ0FBaUMsK0VBQStFLFVBQVUsU0FBUyxlQUFlLFVBQVUsV0FBVyxFQUFFLENBQUM7QUFBQSxJQUNwTTtBQUVBLFFBQUksS0FBSyxnQkFBZ0IsU0FBUyxHQUFHO0FBQ3BDLFlBQU0sSUFBSSxNQUFNLFNBQVMsd0NBQXdDLGtGQUFrRixVQUFVLFNBQVMsZUFBZSxVQUFVLFdBQVcsRUFBRSxDQUFDO0FBQUEsSUFDOU07QUFFQSxTQUFLLDJDQUEyQyxXQUFXLEtBQUssbUJBQW1CLFNBQVMsR0FBRyxzQkFBc0I7QUFBQSxFQUN0SDtBQUFBLEVBRVEsMkNBQTJDLFdBQXVCLDRCQUE2Qyx3QkFBd0M7QUFDOUosWUFBUSw0QkFBNEI7QUFBQSxNQUNuQyxLQUFLLGdCQUFnQjtBQUNwQixjQUFNLElBQUksTUFBTSxTQUFTLHlDQUF5QyxtRkFBbUYsVUFBVSxTQUFTLGVBQWUsVUFBVSxXQUFXLEVBQUUsQ0FBQztBQUFBLE1BQ2hOLEtBQUssZ0JBQWdCO0FBQ3BCLGNBQU0sSUFBSSxNQUFNLFNBQVMsc0NBQXNDLHFFQUFxRSxVQUFVLFNBQVMsZUFBZSxVQUFVLFdBQVcsRUFBRSxDQUFDO0FBQUEsTUFDL0wsS0FBSyxnQkFBZ0I7QUFDcEIsY0FBTSxJQUFJLE1BQU0sU0FBUyw4Q0FBOEMsNEZBQTRGLFVBQVUsU0FBUyxlQUFlLFVBQVUsV0FBVyxFQUFFLENBQUM7QUFBQSxNQUM5TixLQUFLLGdCQUFnQjtBQUNwQixjQUFNLElBQUksTUFBTSxTQUFTLDJDQUEyQywyRUFBMkUsVUFBVSxTQUFTLGVBQWUsVUFBVSxXQUFXLEVBQUUsQ0FBQztBQUFBLE1BQzFNLEtBQUssZ0JBQWdCO0FBQ3BCLGNBQU0sSUFBSSxNQUFNLFNBQVMsaURBQWlELHNFQUFzRSxVQUFVLFNBQVMsZUFBZSxVQUFVLFdBQVcsRUFBRSxDQUFDO0FBQUEsTUFDM00sS0FBSyxnQkFBZ0I7QUFDcEIsY0FBTSxJQUFJLE1BQU0sU0FBUyw4Q0FBOEMsc0VBQXNFLFVBQVUsU0FBUyxlQUFlLFVBQVUsV0FBVyxFQUFFLENBQUM7QUFBQSxNQUN4TSxLQUFLLGdCQUFnQjtBQUNwQixZQUFJLHdCQUF3QjtBQUMzQjtBQUFBLFFBQ0Q7QUFFQSxtQkFBVyxjQUFjLHlCQUF5QixLQUFLLGtCQUFrQixZQUFZLFNBQVMsR0FBRztBQUNoRyxjQUFJLEtBQUssVUFBVSxVQUFVLEdBQUc7QUFDL0I7QUFBQSxVQUNEO0FBQ0EsZ0JBQU0sSUFBSSxNQUFNLFNBQVMsdUNBQXVDLDhGQUE4RixVQUFVLFNBQVMsZUFBZSxVQUFVLFdBQVcsSUFBSSxXQUFXLFNBQVMsZUFBZSxXQUFXLFdBQVcsRUFBRSxDQUFDO0FBQUEsUUFDdFI7QUFBQSxJQUNGO0FBQUEsRUFDRDtBQUFBLEVBRVEsNENBQTRDLFdBQTZCO0FBQ2hGLFFBQUksQ0FBQyxLQUFLLGNBQWM7QUFDdkIsWUFBTSxJQUFJLE1BQU0sU0FBUyxlQUFlLGVBQWUsQ0FBQztBQUFBLElBQ3pEO0FBQ0EsUUFBSSxrQ0FBa0MsVUFBVSxRQUFRLEdBQUc7QUFDMUQsWUFBTSxJQUFJLE1BQU0sU0FBUyw4Q0FBOEMsMEdBQTBHLFVBQVUsU0FBUyxlQUFlLFVBQVUsV0FBVyxFQUFFLENBQUM7QUFBQSxJQUM1TztBQUFBLEVBQ0Q7QUFBQSxFQUVBLE1BQU0sY0FBYyxZQUEwQixVQUErQztBQUM1RixVQUFNLEtBQUssa0JBQWtCLGdCQUFnQjtBQUU3QyxRQUFJLGFBQWEsZ0JBQWdCLG1CQUFtQixhQUFhLGdCQUFnQixrQkFBa0I7QUFDbEcsaUJBQVcsS0FBSyxHQUFHLEtBQUssaUNBQWlDLFlBQVksS0FBSyxrQkFBa0IsWUFBWSxVQUFVLEVBQUUsY0FBYyxNQUFNLE1BQU0sS0FBSyxDQUFDLENBQUM7QUFBQSxJQUN0SjtBQUVBLFVBQU0sWUFBWSxhQUFhLGdCQUFnQixxQkFBcUIsYUFBYSxnQkFBZ0I7QUFDakcsZUFBVyxhQUFhLFlBQVk7QUFDbkMsVUFBSSxXQUFXO0FBQ2QsYUFBSyw0Q0FBNEMsU0FBUztBQUFBLE1BQzNELE9BQU87QUFDTixhQUFLLG1DQUFtQyxTQUFTO0FBQUEsTUFDbEQ7QUFBQSxJQUNEO0FBRUEsVUFBTSxTQUFvQixDQUFDO0FBQzNCLGVBQVcsYUFBYSxZQUFZO0FBQ25DLFlBQU0sa0JBQWtCLEtBQUssbUJBQW1CLFNBQVM7QUFDekQsVUFBSSxvQkFBb0IsZ0JBQWdCLDhCQUVuQyxvQkFBb0IsZ0JBQWdCLGlDQUFpQyxLQUFLLGdDQUFnQyxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU0sS0FBSyx5QkFBeUIsQ0FBQyxLQUFLLE1BQU0sZ0JBQWdCLDBCQUEwQixHQUM3TjtBQUNELGNBQU0sYUFBYSxNQUFNLEtBQUssNkJBQTZCLHNCQUFzQjtBQUNqRixlQUFPLEtBQUssY0FBYyxLQUFLO0FBQUEsTUFDaEMsT0FBTztBQUNOLGVBQU8sS0FBSyxNQUFNLEtBQUssd0JBQXdCLFdBQVcsUUFBUSxDQUFDO0FBQUEsTUFDcEU7QUFBQSxJQUNEO0FBRUEsVUFBTSxvQkFBb0IsV0FBVyxPQUFPLENBQUMsR0FBRyxVQUFVLE9BQU8sS0FBSyxDQUFDO0FBQ3ZFLFFBQUksa0JBQWtCLFFBQVE7QUFDN0IsV0FBSyxxQkFBcUIsS0FBSyxpQkFBaUI7QUFBQSxJQUNqRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxpQ0FBaUMsWUFBMEIsZUFBMEMsaUJBQWtDLFNBQW1ELFVBQXdCLENBQUMsR0FBaUI7QUFDM08sUUFBSSxDQUFDLFFBQVEsZ0JBQWdCLENBQUMsUUFBUSxNQUFNO0FBQzNDLGFBQU8sQ0FBQztBQUFBLElBQ1Q7QUFFQSxVQUFNLFVBQVUsV0FBVyxPQUFPLE9BQUssUUFBUSxRQUFRLENBQUMsTUFBTSxFQUFFO0FBQ2hFLFFBQUksQ0FBQyxRQUFRLFFBQVE7QUFDcEIsYUFBTyxDQUFDO0FBQUEsSUFDVDtBQUVBLGVBQVcsYUFBYSxTQUFTO0FBQ2hDLGNBQVEsS0FBSyxTQUFTO0FBQUEsSUFDdkI7QUFFQSxVQUFNLHFCQUFtQyxDQUFDO0FBQzFDLGVBQVcsYUFBYSxlQUFlO0FBRXRDLFVBQUksUUFBUSxLQUFLLE9BQUssa0JBQWtCLEVBQUUsWUFBWSxVQUFVLFVBQVUsQ0FBQyxHQUFHO0FBQzdFO0FBQUEsTUFDRDtBQUVBLFlBQU0sNkJBQTZCLEtBQUssbUJBQW1CLFNBQVM7QUFFcEUsVUFBSSxLQUFLLHlCQUF5QiwwQkFBMEIsR0FBRztBQUM5RDtBQUFBLE1BQ0Q7QUFHQSxVQUFJLCtCQUErQixnQkFBZ0IseUJBQXlCO0FBQzNFO0FBQUEsTUFDRDtBQUdBLFVBQUksV0FBVyxLQUFLLE9BQ2xCLFFBQVEsZ0JBQWdCLEVBQUUsU0FBUyx1QkFBdUIsS0FBSyxRQUFNLGtCQUFrQixFQUFFLEdBQUcsR0FBRyxVQUFVLFVBQVUsQ0FBQyxLQUNqSCxRQUFRLFFBQVEsRUFBRSxTQUFTLGVBQWUsS0FBSyxRQUFNLGtCQUFrQixFQUFFLEdBQUcsR0FBRyxVQUFVLFVBQVUsQ0FBQyxDQUFFLEdBQUc7QUFFN0csY0FBTSxRQUFRLG1CQUFtQixVQUFVLE9BQUssa0JBQWtCLEVBQUUsWUFBWSxVQUFVLFVBQVUsQ0FBQztBQUdyRyxZQUFJLFVBQVUsSUFBSTtBQUNqQiw2QkFBbUIsS0FBSyxTQUFTO0FBQUEsUUFDbEMsT0FHSztBQUNKLGNBQUk7QUFFSCxpQkFBSywyQ0FBMkMsV0FBVyw0QkFBNEIsSUFBSTtBQUMzRiwrQkFBbUIsT0FBTyxPQUFPLEdBQUcsU0FBUztBQUFBLFVBQzlDLFNBQVMsT0FBTztBQUFBLFVBQWlCO0FBQUEsUUFDbEM7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFFBQUksbUJBQW1CLFFBQVE7QUFDOUIseUJBQW1CLEtBQUssR0FBRyxLQUFLLGlDQUFpQyxvQkFBb0IsZUFBZSxpQkFBaUIsU0FBUyxPQUFPLENBQUM7QUFBQSxJQUN2STtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSx3QkFBd0IsV0FBdUIsVUFBNkM7QUFFbkcsVUFBTSxlQUFlLEtBQUssd0JBQXdCLFVBQVUsVUFBVTtBQUV0RSxRQUFJLGlCQUFpQixVQUFVO0FBQzlCLGFBQU8sUUFBUSxRQUFRLEtBQUs7QUFBQSxJQUM3QjtBQUVBLFlBQVEsVUFBVTtBQUFBLE1BQ2pCLEtBQUssZ0JBQWdCO0FBQ3BCLGFBQUssaUJBQWlCLFVBQVUsVUFBVTtBQUMxQztBQUFBLE1BQ0QsS0FBSyxnQkFBZ0I7QUFDcEIsYUFBSyxrQkFBa0IsVUFBVSxVQUFVO0FBQzNDO0FBQUEsTUFDRCxLQUFLLGdCQUFnQjtBQUNwQixhQUFLLDRCQUE0QixVQUFVLFVBQVU7QUFDckQ7QUFBQSxNQUNELEtBQUssZ0JBQWdCO0FBQ3BCLGFBQUssNkJBQTZCLFVBQVUsVUFBVTtBQUN0RDtBQUFBLElBQ0Y7QUFFQSxXQUFPLFFBQVEsUUFBUSxJQUFJO0FBQUEsRUFDNUI7QUFBQSxFQUVBLFVBQVUsV0FBZ0M7QUFDekMsVUFBTSxrQkFBa0IsS0FBSyxtQkFBbUIsU0FBUztBQUN6RCxXQUFPLEtBQUsseUJBQXlCLGVBQWU7QUFBQSxFQUNyRDtBQUFBLEVBRUEseUJBQXlCLGlCQUEyQztBQUNuRSxXQUFPLG9CQUFvQixnQkFBZ0Isd0JBQXdCLG9CQUFvQixnQkFBZ0Isb0JBQW9CLG9CQUFvQixnQkFBZ0I7QUFBQSxFQUNoSztBQUFBLEVBRUEsbUJBQW1CLFdBQWdDO0FBQ2xELFdBQU8sS0FBSyxvQkFBb0IsVUFBVSxVQUFVO0FBQUEsRUFDckQ7QUFBQSxFQUVRLHdCQUF3QixXQUF1QixZQUF1QyxlQUE4QiwwQkFBOEU7QUFDek0sK0JBQTJCLDRCQUE0QixvQkFBSSxJQUFpQztBQUM1RixRQUFJLGtCQUFrQix5QkFBeUIsSUFBSSxTQUFTO0FBQzVELFFBQUksb0JBQW9CLFFBQVc7QUFDbEMsYUFBTztBQUFBLElBQ1I7QUFFQSxzQkFBa0IsS0FBSyx3QkFBd0IsVUFBVSxVQUFVO0FBQ25FLFVBQU0sWUFBWSxLQUFLLHlCQUF5QixlQUFlO0FBRS9ELFFBQUksWUFBWSxVQUFVLFlBQVksS0FBSyx1QkFBdUIsQ0FBQyxHQUFHO0FBQ3JFLHdCQUFrQixnQkFBZ0I7QUFBQSxJQUNuQyxXQUVTLGFBQWEsVUFBVSxTQUFTLGNBQWMsUUFBUSxLQUFLLHlCQUF5QixVQUFVLFNBQVMsTUFBTSxNQUFNO0FBQzNILHdCQUFrQixnQkFBZ0I7QUFBQSxJQUNuQyxXQUVTLGFBQWEsQ0FBQyxVQUFVLFNBQVM7QUFDekMsd0JBQWtCLGdCQUFnQjtBQUFBLElBQ25DLFdBRVMsS0FBSyx1QkFBdUIsbUJBQW1CLFNBQVMsR0FBRztBQUNuRSx3QkFBa0IsZ0JBQWdCO0FBQUEsSUFDbkMsV0FFUyxLQUFLLGlCQUFpQixTQUFTLEdBQUc7QUFDMUMsd0JBQWtCLGdCQUFnQjtBQUFBLElBQ25DLFdBRVMsS0FBSyw4QkFBOEIsV0FBVyxhQUFhLEdBQUc7QUFDdEUsd0JBQWtCLGdCQUFnQjtBQUFBLElBQ25DLFdBRVMsYUFBYSxLQUFLLDRCQUE0QixXQUFXLGFBQWEsR0FBRztBQUNqRix3QkFBa0IsZ0JBQWdCO0FBQUEsSUFDbkMsV0FFUyxLQUFLLDJCQUEyQixTQUFTLEdBQUc7QUFDcEQsd0JBQWtCLGdCQUFnQjtBQUFBLElBQ25DLFdBRVMsYUFBYSxLQUFLLGlDQUFpQyxXQUFXLFlBQVksZUFBZSx3QkFBd0IsR0FBRztBQUM1SCx3QkFBa0IsZ0JBQWdCO0FBQUEsSUFDbkMsV0FFUyxDQUFDLGFBQWEsS0FBSyxnQkFBZ0IsU0FBUyxHQUFHO0FBQ3ZELHdCQUFrQixnQkFBZ0I7QUFBQSxJQUNuQztBQUVBLDZCQUF5QixJQUFJLFdBQVcsZUFBZTtBQUN2RCxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsaUJBQWlCLFdBQWdDO0FBQ3hELFFBQUksS0FBSywyQkFBMkI7QUFDbkMsYUFBTyxDQUFDLFVBQVUsYUFBYSxDQUFDLG9CQUFvQixVQUFVLFVBQVUsS0FBSyxtQkFBbUIsZUFBZTtBQUFBLElBQ2hIO0FBRUEsVUFBTSxxQkFBcUIsS0FBSyxtQkFBbUI7QUFDbkQsUUFBSSxNQUFNLFFBQVEsa0JBQWtCLEdBQUc7QUFDdEMsYUFBTyxtQkFBbUIsS0FBSyxRQUFNLGtCQUFrQixFQUFFLEdBQUcsR0FBRyxVQUFVLFVBQVUsQ0FBQztBQUFBLElBQ3JGO0FBR0EsUUFBSSxrQkFBa0IsRUFBRSxJQUFJLGNBQWMsTUFBTSxHQUFHLFVBQVUsVUFBVSxHQUFHO0FBQ3pFLGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLGdCQUFnQixXQUFnQztBQUN2RCxVQUFNLG9CQUFvQixLQUFLLG1CQUFtQjtBQUNsRCxRQUFJLE1BQU0sUUFBUSxpQkFBaUIsR0FBRztBQUNyQyxhQUFPLGtCQUFrQixLQUFLLFFBQU0sa0JBQWtCLEVBQUUsR0FBRyxHQUFHLFVBQVUsVUFBVSxDQUFDO0FBQUEsSUFDcEY7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsOEJBQThCLFdBQXVCLGVBQXVDO0FBRW5HLFFBQUksQ0FBQyxjQUFjLFNBQVM7QUFDM0IsYUFBTztBQUFBLElBQ1I7QUFHQSxRQUFJLEtBQUssbUNBQW1DLHdDQUF3QyxVQUFVLFFBQVEsTUFBTSxPQUFPO0FBQ2xILGFBQU87QUFBQSxJQUNSO0FBR0EsUUFBSSxLQUFLLGlDQUFpQyw2QkFBNkIsU0FBUyxNQUFNLEtBQUssaUNBQWlDLGdDQUFnQyxLQUFLLG1DQUFtQyxnQkFBZ0IsVUFBVSxRQUFRLEdBQUc7QUFDeE8sYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsMkJBQTJCLFdBQWdDO0FBQ2xFLFFBQUksS0FBSyxpQ0FBaUMsbUNBQW1DLEtBQUssaUNBQWlDLDhCQUE4QjtBQUNoSixZQUFNLGtCQUFrQixLQUFLLGlDQUFpQyw0QkFBNEIsU0FBUztBQUNuRyxpQkFBVyxpQkFBaUIsS0FBSyxtQ0FBbUMsaUJBQWlCLFVBQVUsUUFBUSxHQUFHO0FBQ3pHLFlBQUksa0JBQWtCLE1BQU07QUFDM0IsY0FBSSxvQkFBb0IseUJBQXlCLE9BQU87QUFDdkQsbUJBQU87QUFBQSxVQUNSO0FBQUEsUUFDRDtBQUNBLFlBQUksa0JBQWtCLGFBQWE7QUFDbEMsY0FBSSxvQkFBb0IseUJBQXlCLFFBQVE7QUFDeEQsbUJBQU87QUFBQSxVQUNSO0FBQUEsUUFDRDtBQUNBLFlBQUksa0JBQWtCLE9BQU87QUFDNUIsY0FBSSxLQUFLLGlDQUFpQyw4QkFBd0M7QUFDakYsZ0JBQUksb0JBQW9CLHlCQUF5QixPQUFPLG9CQUFvQix5QkFBeUIsUUFBUTtBQUM1RyxxQkFBTztBQUFBLFlBQ1I7QUFBQSxVQUNELFdBQVcsb0JBQW9CLHlCQUF5QixPQUFPO0FBQzlELGtCQUFNLHVCQUF1QixLQUFLLHFCQUFxQixTQUFzQyxzQkFBc0I7QUFDbkgsZ0JBQUkseUJBQXlCLFFBQVEseUJBQXlCLFFBQVE7QUFFckUscUJBQU87QUFBQSxZQUNSO0FBQUEsVUFDRDtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQ0EsYUFBTztBQUFBLElBQ1I7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsNEJBQTRCLFdBQXVCLGVBQXVDO0FBQ2pHLFFBQUksY0FBYyxTQUFTO0FBQzFCLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxLQUFLLGVBQWUsa0JBQWtCLFVBQVUsUUFBUSxHQUFHO0FBQzlELGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTyxLQUFLLG1DQUFtQywwQ0FBMEMsVUFBVSxRQUFRLE1BQU07QUFBQSxFQUNsSDtBQUFBLEVBRVEsaUNBQWlDLFdBQXVCLFlBQXVDLGVBQThCLDBCQUFxRTtBQUV6TSxRQUFJLENBQUMsVUFBVSxTQUFTLHVCQUF1QjtBQUM5QyxhQUFPO0FBQUEsSUFDUjtBQUdBLFVBQU0sdUJBQXVCLFdBQVcsT0FBTyxPQUM5QyxVQUFVLFNBQVMsdUJBQXVCLEtBQUssUUFBTSxrQkFBa0IsRUFBRSxZQUFZLEVBQUUsR0FBRyxDQUFDLE1BQ3RGLEtBQUssaUNBQWlDLDZCQUE2QixDQUFDLE1BQU0sS0FBSyxpQ0FBaUMsNkJBQTZCLFNBQVMsTUFBTyxFQUFFLFNBQVMsUUFBUSxFQUFFLFNBQVMsWUFBWSxFQUFFLFNBQVMsUUFBUSxPQUFRLENBQUM7QUFFek8sUUFBSSxDQUFDLHFCQUFxQixRQUFRO0FBQ2pDLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxxQkFBcUIseUJBQXlCLElBQUksU0FBUztBQUNqRSxRQUFJLENBQUMsb0JBQW9CO0FBRXhCLCtCQUF5QixJQUFJLFdBQVcsZ0JBQWdCLGVBQWU7QUFBQSxJQUN4RTtBQUNBLFFBQUk7QUFDSCxpQkFBVyx1QkFBdUIsc0JBQXNCO0FBQ3ZELGNBQU0sa0JBQWtCLEtBQUssd0JBQXdCLHFCQUFxQixZQUFZLGVBQWUsd0JBQXdCO0FBQzdILFlBQUksQ0FBQyxLQUFLLHlCQUF5QixlQUFlLEtBQUssb0JBQW9CLGdCQUFnQix5QkFBeUI7QUFDbkgsaUJBQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLElBQ0QsVUFBRTtBQUNELFVBQUksQ0FBQyxvQkFBb0I7QUFFeEIsaUNBQXlCLE9BQU8sU0FBUztBQUFBLE1BQzFDO0FBQUEsSUFDRDtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSx3QkFBd0IsWUFBbUQ7QUFDbEYsUUFBSSxLQUFLLGNBQWM7QUFDdEIsVUFBSSxLQUFLLCtCQUErQixFQUFFLE9BQU8sT0FBSyxrQkFBa0IsR0FBRyxVQUFVLENBQUMsRUFBRSxDQUFDLEdBQUc7QUFDM0YsZUFBTyxnQkFBZ0I7QUFBQSxNQUN4QjtBQUVBLFVBQUksS0FBSyxnQ0FBZ0MsRUFBRSxPQUFPLE9BQUssa0JBQWtCLEdBQUcsVUFBVSxDQUFDLEVBQUUsQ0FBQyxHQUFHO0FBQzVGLGVBQU8sZ0JBQWdCO0FBQUEsTUFDeEI7QUFBQSxJQUNEO0FBQ0EsUUFBSSxLQUFLLG9CQUFvQixVQUFVLEdBQUc7QUFDekMsYUFBTyxnQkFBZ0I7QUFBQSxJQUN4QjtBQUNBLFdBQU8sZ0JBQWdCO0FBQUEsRUFDeEI7QUFBQSxFQUVRLG9CQUFvQixZQUEyQztBQUN0RSxXQUFPLEtBQUssaUNBQWlDLHNCQUFzQixFQUFFLEtBQUssT0FBSyxrQkFBa0IsR0FBRyxVQUFVLENBQUM7QUFBQSxFQUNoSDtBQUFBLEVBRVEsaUJBQWlCLFlBQW9EO0FBQzVFLFNBQUssdUNBQXVDLFVBQVU7QUFDdEQsU0FBSyxzQ0FBc0MsVUFBVTtBQUNyRCxXQUFPLEtBQUssaUNBQWlDLGdCQUFnQixZQUFZLE1BQU07QUFBQSxFQUNoRjtBQUFBLEVBRVEsa0JBQWtCLFlBQW9EO0FBQzdFLFNBQUssdUNBQXVDLFVBQVU7QUFDdEQsU0FBSyxzQ0FBc0MsVUFBVTtBQUNyRCxXQUFPLEtBQUssaUNBQWlDLGlCQUFpQixZQUFZLE1BQU07QUFBQSxFQUNqRjtBQUFBLEVBRVEsNEJBQTRCLFlBQXdDO0FBQzNFLFNBQUssdUNBQXVDLFVBQVU7QUFDdEQsU0FBSyxpQ0FBaUMsVUFBVTtBQUFBLEVBQ2pEO0FBQUEsRUFFUSw2QkFBNkIsWUFBd0M7QUFDNUUsU0FBSyxrQ0FBa0MsVUFBVTtBQUNqRCxTQUFLLHNDQUFzQyxVQUFVO0FBQUEsRUFDdEQ7QUFBQSxFQUVRLGtDQUFrQyxZQUFvRDtBQUM3RixRQUFJLENBQUMsS0FBSyxjQUFjO0FBQ3ZCLGFBQU8sUUFBUSxRQUFRLEtBQUs7QUFBQSxJQUM3QjtBQUNBLFVBQU0scUJBQXFCLEtBQUssZ0NBQWdDO0FBQ2hFLFFBQUksbUJBQW1CLE1BQU0sT0FBSyxDQUFDLGtCQUFrQixHQUFHLFVBQVUsQ0FBQyxHQUFHO0FBQ3JFLHlCQUFtQixLQUFLLFVBQVU7QUFDbEMsV0FBSyx1QkFBdUIsa0JBQWtCO0FBQzlDLGFBQU8sUUFBUSxRQUFRLElBQUk7QUFBQSxJQUM1QjtBQUNBLFdBQU8sUUFBUSxRQUFRLEtBQUs7QUFBQSxFQUM3QjtBQUFBLEVBRUEsTUFBYyx1Q0FBdUMsWUFBb0Q7QUFDeEcsUUFBSSxDQUFDLEtBQUssY0FBYztBQUN2QixhQUFPO0FBQUEsSUFDUjtBQUNBLFVBQU0scUJBQXFCLEtBQUssZ0NBQWdDO0FBQ2hFLGFBQVMsUUFBUSxHQUFHLFFBQVEsbUJBQW1CLFFBQVEsU0FBUztBQUMvRCxZQUFNLG9CQUFvQixtQkFBbUIsS0FBSztBQUNsRCxVQUFJLGtCQUFrQixtQkFBbUIsVUFBVSxHQUFHO0FBQ3JELDJCQUFtQixPQUFPLE9BQU8sQ0FBQztBQUNsQyxhQUFLLHVCQUF1QixrQkFBa0I7QUFDOUMsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLGlDQUFpQyxZQUEyQztBQUNuRixRQUFJLENBQUMsS0FBSyxjQUFjO0FBQ3ZCLGFBQU87QUFBQSxJQUNSO0FBQ0EsVUFBTSxvQkFBb0IsS0FBSywrQkFBK0I7QUFDOUQsUUFBSSxrQkFBa0IsTUFBTSxPQUFLLENBQUMsa0JBQWtCLEdBQUcsVUFBVSxDQUFDLEdBQUc7QUFDcEUsd0JBQWtCLEtBQUssVUFBVTtBQUNqQyxXQUFLLHNCQUFzQixpQkFBaUI7QUFDNUMsYUFBTztBQUFBLElBQ1I7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsc0NBQXNDLFlBQTJDO0FBQ3hGLFFBQUksQ0FBQyxLQUFLLGNBQWM7QUFDdkIsYUFBTztBQUFBLElBQ1I7QUFDQSxVQUFNLG9CQUFvQixLQUFLLCtCQUErQjtBQUM5RCxhQUFTLFFBQVEsR0FBRyxRQUFRLGtCQUFrQixRQUFRLFNBQVM7QUFDOUQsWUFBTSxvQkFBb0Isa0JBQWtCLEtBQUs7QUFDakQsVUFBSSxrQkFBa0IsbUJBQW1CLFVBQVUsR0FBRztBQUNyRCwwQkFBa0IsT0FBTyxPQUFPLENBQUM7QUFDakMsYUFBSyxzQkFBc0IsaUJBQWlCO0FBQzVDLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFVSxpQ0FBeUQ7QUFDbEUsV0FBTyxLQUFLLGVBQWUsK0JBQStCO0FBQUEsRUFDM0Q7QUFBQSxFQUVRLHNCQUFzQixtQkFBaUQ7QUFDOUUsU0FBSyxlQUFlLGlDQUFpQyxpQkFBaUI7QUFBQSxFQUN2RTtBQUFBLEVBRVUsa0NBQTBEO0FBQ25FLFdBQU8sS0FBSyxlQUFlLGdDQUFnQztBQUFBLEVBQzVEO0FBQUEsRUFFUSx1QkFBdUIsb0JBQWtEO0FBQ2hGLFNBQUssZUFBZSxrQ0FBa0Msa0JBQWtCO0FBQUEsRUFDekU7QUFBQSxFQUVRLGVBQWUsV0FBMkM7QUFDakUsUUFBSSxDQUFDLEtBQUssY0FBYztBQUN2QixhQUFPLENBQUM7QUFBQSxJQUNUO0FBQ0EsV0FBTyxLQUFLLGVBQWUsSUFBSSxXQUFXLGFBQWEsU0FBUztBQUFBLEVBQ2pFO0FBQUEsRUFFUSxlQUFlLFdBQW1CLFlBQTBDO0FBQ25GLFNBQUssZUFBZSxJQUFJLFdBQVcsWUFBWSxhQUFhLFNBQVM7QUFBQSxFQUN0RTtBQUFBLEVBRUEsTUFBYyx1Q0FBdUMsc0JBQTJELFFBQWdDO0FBQy9JLFFBQUksV0FBVyxRQUFRO0FBQ3RCLFlBQU0sS0FBSyxrQkFBa0IsZ0JBQWdCO0FBQzdDLFlBQU0sYUFBYSxLQUFLLGtCQUFrQixXQUFXLE9BQU8sd0JBQXNCLHFCQUFxQixLQUFLLGdCQUFjLGtCQUFrQixZQUFZLG1CQUFtQixVQUFVLENBQUMsQ0FBQztBQUN2TCxXQUFLLHFCQUFxQixLQUFLLFVBQVU7QUFBQSxJQUMxQztBQUFBLEVBQ0Q7QUFBQSxFQUVRLHVCQUF1QixPQUFrQyxTQUFvQyxpQkFBZ0M7QUFDcEksVUFBTSxvQkFBa0MsTUFBTSxPQUFPLE9BQUssQ0FBQyxLQUFLLHlCQUF5QixLQUFLLG1CQUFtQixDQUFDLENBQUMsQ0FBQztBQUNwSCxVQUFNLDZCQUE2QixLQUFLO0FBQ3hDLFNBQUssK0JBQStCLEtBQUssa0JBQWtCLFdBQVcsT0FBTyxlQUFhO0FBQ3pGLFlBQU0sa0JBQWtCLEtBQUssbUJBQW1CLFNBQVM7QUFDekQsYUFBTyxvQkFBb0IsZ0JBQWdCLGlDQUFpQyxvQkFBb0IsZ0JBQWdCLHVCQUF1QixvQkFBb0IsZ0JBQWdCO0FBQUEsSUFDNUssQ0FBQztBQUNELGVBQVcsYUFBYSw0QkFBNEI7QUFDbkQsVUFBSSxLQUFLLDZCQUE2QixNQUFNLE9BQUssQ0FBQyxrQkFBa0IsRUFBRSxZQUFZLFVBQVUsVUFBVSxDQUFDLEdBQUc7QUFDekcsMEJBQWtCLEtBQUssU0FBUztBQUFBLE1BQ2pDO0FBQUEsSUFDRDtBQUNBLGVBQVcsYUFBYSxLQUFLLDhCQUE4QjtBQUMxRCxVQUFJLDJCQUEyQixNQUFNLE9BQUssQ0FBQyxrQkFBa0IsRUFBRSxZQUFZLFVBQVUsVUFBVSxDQUFDLEdBQUc7QUFDbEcsMEJBQWtCLEtBQUssU0FBUztBQUFBLE1BQ2pDO0FBQUEsSUFDRDtBQUNBLFFBQUksa0JBQWtCLFFBQVE7QUFDN0IsV0FBSyxxQkFBcUIsS0FBSyxpQkFBaUI7QUFBQSxJQUNqRDtBQUNBLFFBQUksQ0FBQyxpQkFBaUI7QUFDckIsY0FBUSxRQUFRLENBQUMsRUFBRSxXQUFXLE1BQU0sS0FBSyxPQUFPLFVBQVUsQ0FBQztBQUFBLElBQzVEO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBYSx1REFBc0U7QUFDbEYsVUFBTSxLQUFLLGtCQUFrQixnQkFBZ0I7QUFFN0MsVUFBTSwwQkFBMEIsQ0FBQ0EsbUJBQWtFO0FBQ2xHLFlBQU0sd0JBQXdCLG9CQUFJLElBQWlDO0FBQ25FLGFBQU8sS0FBSyxrQkFBa0IsV0FBVyxJQUFJLGVBQWEsQ0FBQyxXQUFXLEtBQUssd0JBQXdCLFdBQVcsS0FBSyxrQkFBa0IsWUFBWUEsZ0JBQWUscUJBQXFCLENBQUMsQ0FBQztBQUFBLElBQ3hMO0FBRUEsVUFBTSxnQkFBZ0IsS0FBSyxpQkFBaUI7QUFDNUMsVUFBTSx1Q0FBdUMsd0JBQXdCLEVBQUUsR0FBRyxlQUFlLFNBQVMsS0FBSyxDQUFDO0FBQ3hHLFVBQU0seUNBQXlDLHdCQUF3QixFQUFFLEdBQUcsZUFBZSxTQUFTLE1BQU0sQ0FBQztBQUMzRyxVQUFNLDRDQUE0QyxxQ0FBcUMsT0FBTyxDQUFDLENBQUMsRUFBRSxlQUFlLEdBQUcsVUFBVSxvQkFBb0IsdUNBQXVDLEtBQUssRUFBRSxDQUFDLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQyxTQUFTLE1BQU0sU0FBUztBQUVsTyxRQUFJLDBDQUEwQyxRQUFRO0FBQ3JELFdBQUsscUJBQXFCLEtBQUsseUNBQXlDO0FBQUEsSUFDekU7QUFBQSxFQUNEO0FBQUEsRUFFUSxtQkFBa0M7QUFDekMsV0FBTyxFQUFFLFNBQVMsS0FBSyxnQ0FBZ0MsbUJBQW1CLEdBQUcsU0FBUyxtQkFBbUIsS0FBSyxlQUFlLGFBQWEsQ0FBQyxFQUFFO0FBQUEsRUFDOUk7QUFBQSxFQUVRLE9BQU8sV0FBaUM7QUFDL0MsU0FBSyx1Q0FBdUMsU0FBUztBQUNyRCxTQUFLLHNDQUFzQyxTQUFTO0FBQ3BELFNBQUssaUNBQWlDLGdCQUFnQixTQUFTO0FBQUEsRUFDaEU7QUFBQSxFQUVRLGtDQUF3QztBQUMvQyxTQUFLLDRCQUE0QixFQUMvQixLQUFLLE1BQU0sS0FBSyxRQUFRLFFBQVEsTUFBTTtBQUFBLElBQUUsR0FBRyxNQUFPLEtBQUssQ0FBQyxDQUFDLEVBQ3pELEtBQUssTUFBTSxLQUFLLGdDQUFnQyxDQUFDO0FBQUEsRUFDcEQ7QUFBQSxFQUVBLE1BQWMsOEJBQTZDO0FBQzFELFFBQUk7QUFDSCxZQUFNLDRCQUE0QixNQUFNLEtBQUssMkJBQTJCLDZCQUE2QjtBQUNyRyxZQUFNLFVBQVUsS0FBSyx5QkFBeUIsMEJBQTBCLFNBQVM7QUFDakYsVUFBSSxTQUFTO0FBQ1osYUFBSyx1QkFBdUIsQ0FBQyxHQUFHLENBQUMsR0FBRyxLQUFLO0FBQUEsTUFDMUM7QUFBQSxJQUNELFNBQVMsS0FBSztBQUNiLFdBQUssV0FBVyxNQUFNLEdBQUc7QUFBQSxJQUMxQjtBQUFBLEVBQ0Q7QUFBQSxFQUVRLHlCQUF1RTtBQUM5RSxXQUFPLEtBQUssZUFBZSxVQUFVLGtDQUFrQyxhQUFhLGFBQWEsQ0FBQyxDQUFDO0FBQUEsRUFDcEc7QUFBQSxFQUVRLHlCQUF5QixZQUFtRTtBQUNuRyxVQUFNLFdBQVcsS0FBSyx1QkFBdUI7QUFDN0MsUUFBSSxPQUFPLFVBQVUsWUFBWSxDQUFDLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksa0JBQWtCLEdBQUcsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHO0FBQzdHLGFBQU87QUFBQSxJQUNSO0FBQ0EsU0FBSyxlQUFlLE1BQU0sa0NBQWtDLEtBQUssVUFBVSxVQUFVLEdBQUcsYUFBYSxhQUFhLGNBQWMsT0FBTztBQUN2SSxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBN3JCYSw2QkFBTjtBQUFBLEVBYUo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQS9CVTtBQStyQmIsSUFBTSxvQkFBTixjQUFnQyxXQUFXO0FBQUEsRUFXMUMsWUFDd0QsNEJBQ0gsa0NBQ3RCLFlBQzdCO0FBQ0QsVUFBTTtBQUppRDtBQUNIO0FBQ3RCO0FBWi9CLFNBQVEsY0FBNEIsQ0FBQztBQUdyQyxTQUFRLHlCQUF5QixLQUFLLFVBQVUsSUFBSSxRQUE2RyxDQUFDO0FBQ2xLLFNBQVMsd0JBQXdCLEtBQUssdUJBQXVCO0FBRzdELFNBQVEsV0FBb0I7QUFRM0IsU0FBSyxVQUFVLGFBQWEsTUFBTSxLQUFLLFdBQVcsSUFBSSxDQUFDO0FBQ3ZELFNBQUssb0JBQW9CLEtBQUssV0FBVztBQUFBLEVBQzFDO0FBQUEsRUFoQkEsSUFBSSxhQUFvQztBQUFFLFdBQU8sS0FBSztBQUFBLEVBQWE7QUFBQSxFQWtCbkUsa0JBQWlDO0FBQ2hDLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVBLE1BQWMsYUFBNEI7QUFDekMsUUFBSTtBQUNILFdBQUssY0FBYztBQUFBLFFBQ2xCLEdBQUcsTUFBTSxLQUFLLDJCQUEyQixhQUFhO0FBQUEsUUFDdEQsR0FBRyxNQUFNLEtBQUssMkJBQTJCLGdDQUFnQyxJQUFJO0FBQUEsTUFDOUU7QUFDQSxVQUFJLEtBQUssVUFBVTtBQUNsQjtBQUFBLE1BQ0Q7QUFDQSxXQUFLLHVCQUF1QixLQUFLLEVBQUUsT0FBTyxLQUFLLFlBQVksU0FBUyxDQUFDLEdBQUcsaUJBQWlCLE1BQU0sQ0FBQztBQUFBLElBQ2pHLFNBQVMsT0FBTztBQUNmLFdBQUssV0FBVyxNQUFNLEtBQUs7QUFBQSxJQUM1QjtBQUNBLFNBQUssVUFBVSxLQUFLLDJCQUEyQix1QkFBdUIsT0FDckUsS0FBSyxpQkFBaUIsRUFBRSxPQUFxQixDQUFDLFFBQVEsRUFBRSxPQUFPLFVBQVUsTUFBTTtBQUM5RSxVQUFJLFNBQVMsY0FBYyxpQkFBaUIsU0FBUztBQUFFLGVBQU8sS0FBSyxLQUFLO0FBQUEsTUFBRztBQUFFLGFBQU87QUFBQSxJQUNyRixHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsR0FBRyxRQUFXLEtBQUssQ0FBQyxDQUFDO0FBQy9CLFNBQUssVUFBVSxNQUFNLE9BQU8sS0FBSywyQkFBMkIseUJBQTBCLE9BQUssQ0FBQyxFQUFFLEtBQU0sRUFBRSxPQUFLLEtBQUssaUJBQWlCLENBQUMsR0FBRyxDQUFDLEVBQUUsVUFBVSxHQUFHLEVBQUUsUUFBUSxLQUFLLENBQUMsQ0FBQztBQUN0SyxTQUFLLFVBQVUsS0FBSywyQkFBMkIsbUJBQW1CLENBQUMsRUFBRSxPQUFPLFNBQVMsT0FBTyxNQUFNO0FBQ2pHLFdBQUssaUJBQWlCLE9BQU8sUUFBUSxJQUFJLENBQUMsRUFBRSxXQUFXLE1BQU0sVUFBVSxHQUFHLFFBQVEsSUFBSTtBQUFBLElBQ3ZGLENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVRLGlCQUFpQixPQUFxQixhQUFxQyxRQUFnRCxpQkFBZ0M7QUFDbEssUUFBSSxNQUFNLFFBQVE7QUFDakIsaUJBQVcsYUFBYSxPQUFPO0FBQzlCLGNBQU0sa0JBQWtCLEtBQUssaUNBQWlDLDZCQUE2QixTQUFTO0FBQ3BHLGNBQU0sUUFBUSxLQUFLLFlBQVksVUFBVSxPQUFLLGtCQUFrQixFQUFFLFlBQVksVUFBVSxVQUFVLEtBQUssS0FBSyxpQ0FBaUMsNkJBQTZCLENBQUMsTUFBTSxlQUFlO0FBQ2hNLFlBQUksVUFBVSxJQUFJO0FBQ2pCLGVBQUssWUFBWSxPQUFPLE9BQU8sQ0FBQztBQUFBLFFBQ2pDO0FBQUEsTUFDRDtBQUNBLFdBQUssWUFBWSxLQUFLLEdBQUcsS0FBSztBQUFBLElBQy9CO0FBQ0EsVUFBTSxVQUF3QixDQUFDO0FBQy9CLGVBQVcsY0FBYyxhQUFhO0FBQ3JDLFlBQU0sUUFBUSxLQUFLLFlBQVksVUFBVSxPQUFLLGtCQUFrQixFQUFFLFlBQVksVUFBVSxLQUFLLEtBQUssaUNBQWlDLDZCQUE2QixDQUFDLE1BQU0sTUFBTTtBQUM3SyxVQUFJLFVBQVUsSUFBSTtBQUNqQixnQkFBUSxLQUFLLEdBQUcsS0FBSyxZQUFZLE9BQU8sT0FBTyxDQUFDLENBQUM7QUFBQSxNQUNsRDtBQUFBLElBQ0Q7QUFDQSxRQUFJLE1BQU0sVUFBVSxRQUFRLFFBQVE7QUFDbkMsV0FBSyx1QkFBdUIsS0FBSyxFQUFFLE9BQU8sU0FBUyxnQkFBZ0IsQ0FBQztBQUFBLElBQ3JFO0FBQUEsRUFDRDtBQUNEO0FBdEVNLG9CQUFOO0FBQUEsRUFZRztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FkRztBQXdFTixrQkFBa0Isc0NBQXNDLDRCQUE0QixrQkFBa0IsT0FBTzsiLAogICJuYW1lcyI6IFsid29ya3NwYWNlVHlwZSJdCn0K
