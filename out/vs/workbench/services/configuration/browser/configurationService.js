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
import { URI } from "../../../../base/common/uri.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { equals } from "../../../../base/common/objects.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { Queue, Barrier, Promises, Delayer } from "../../../../base/common/async.js";
import { Extensions as JSONExtensions } from "../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { IWorkspaceContextService, Workspace as BaseWorkspace, WorkbenchState, toWorkspaceFolder, isWorkspaceFolder, isSingleFolderWorkspaceIdentifier, isWorkspaceIdentifier } from "../../../../platform/workspace/common/workspace.js";
import { ConfigurationModel, ConfigurationChangeEvent, mergeChanges } from "../../../../platform/configuration/common/configurationModels.js";
import { ConfigurationTarget, isConfigurationOverrides, ConfigurationTargetToString, isConfigurationUpdateOverrides, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { NullPolicyConfiguration, PolicyConfiguration } from "../../../../platform/configuration/common/configurations.js";
import { Configuration } from "../common/configurationModels.js";
import { FOLDER_CONFIG_FOLDER_NAME, defaultSettingsSchemaId, userSettingsSchemaId, workspaceSettingsSchemaId, folderSettingsSchemaId, machineSettingsSchemaId, LOCAL_MACHINE_SCOPES, PROFILE_SCOPES, LOCAL_MACHINE_PROFILE_SCOPES, profileSettingsSchemaId, APPLY_ALL_PROFILES_SETTING, APPLICATION_SCOPES } from "../common/configuration.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions, allSettings, windowSettings, resourceSettings, applicationSettings, machineSettings, machineOverridableSettings, ConfigurationScope, keyFromOverrideIdentifiers, OVERRIDE_PROPERTY_PATTERN, resourceLanguageSettingsSchemaId, configurationDefaultsSchemaId, applicationMachineSettings } from "../../../../platform/configuration/common/configurationRegistry.js";
import { isStoredWorkspaceFolder, getStoredWorkspaceFolder, toWorkspaceFolders } from "../../../../platform/workspaces/common/workspaces.js";
import { ConfigurationEditing, EditableConfigurationTarget } from "../common/configurationEditing.js";
import { WorkspaceConfiguration, FolderConfiguration, RemoteUserConfiguration, UserConfiguration, DefaultConfiguration, ApplicationConfiguration } from "./configuration.js";
import { mark } from "../../../../base/common/performance.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { WorkbenchPhase, Extensions as WorkbenchExtensions, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { ILifecycleService, LifecyclePhase } from "../../lifecycle/common/lifecycle.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { delta, distinct, equals as arrayEquals } from "../../../../base/common/arrays.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { IWorkbenchAssignmentService } from "../../assignment/common/assignmentService.js";
import { isUndefined } from "../../../../base/common/types.js";
import { localize } from "../../../../nls.js";
import { NullPolicyService } from "../../../../platform/policy/common/policy.js";
import { IJSONEditingService } from "../common/jsonEditing.js";
import { workbenchConfigurationNodeBase } from "../../../common/configuration.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { runWhenWindowIdle } from "../../../../base/browser/dom.js";
function getLocalUserConfigurationScopes(userDataProfile, hasRemote) {
  const isDefaultProfile = userDataProfile.isDefault || userDataProfile.useDefaultFlags?.settings;
  if (isDefaultProfile) {
    return hasRemote ? LOCAL_MACHINE_SCOPES : void 0;
  }
  return hasRemote ? LOCAL_MACHINE_PROFILE_SCOPES : PROFILE_SCOPES;
}
class Workspace extends BaseWorkspace {
  constructor() {
    super(...arguments);
    this.initialized = false;
  }
}
class WorkspaceService extends Disposable {
  constructor({ remoteAuthority, configurationCache }, environmentService, userDataProfileService, userDataProfilesService, fileService, remoteAgentService, uriIdentityService, logService, policyService) {
    super();
    this.userDataProfileService = userDataProfileService;
    this.userDataProfilesService = userDataProfilesService;
    this.fileService = fileService;
    this.remoteAgentService = remoteAgentService;
    this.uriIdentityService = uriIdentityService;
    this.logService = logService;
    this.initialized = false;
    this.applicationConfiguration = null;
    this.remoteUserConfiguration = null;
    this._onDidChangeConfiguration = this._register(new Emitter());
    this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
    this._onWillChangeWorkspaceFolders = this._register(new Emitter());
    this.onWillChangeWorkspaceFolders = this._onWillChangeWorkspaceFolders.event;
    this._onDidChangeWorkspaceFolders = this._register(new Emitter());
    this.onDidChangeWorkspaceFolders = this._onDidChangeWorkspaceFolders.event;
    this._onDidChangeWorkspaceName = this._register(new Emitter());
    this.onDidChangeWorkspaceName = this._onDidChangeWorkspaceName.event;
    this._onDidChangeWorkbenchState = this._register(new Emitter());
    this.onDidChangeWorkbenchState = this._onDidChangeWorkbenchState.event;
    this.isWorkspaceTrusted = true;
    this._restrictedSettings = { default: [] };
    this._onDidChangeRestrictedSettings = this._register(new Emitter());
    this.onDidChangeRestrictedSettings = this._onDidChangeRestrictedSettings.event;
    this.configurationRegistry = Registry.as(Extensions.Configuration);
    this.initRemoteUserConfigurationBarrier = new Barrier();
    this.completeWorkspaceBarrier = new Barrier();
    this.defaultConfiguration = this._register(new DefaultConfiguration(configurationCache, environmentService, logService));
    this.policyConfiguration = policyService instanceof NullPolicyService ? new NullPolicyConfiguration() : this._register(new PolicyConfiguration(this.defaultConfiguration, policyService, logService));
    this.configurationCache = configurationCache;
    this._configuration = new Configuration(this.defaultConfiguration.configurationModel, this.policyConfiguration.configurationModel, ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), ConfigurationModel.createEmptyModel(logService), new ResourceMap(), ConfigurationModel.createEmptyModel(logService), new ResourceMap(), this.workspace, logService);
    this.applicationConfigurationDisposables = this._register(new DisposableStore());
    this.createApplicationConfiguration();
    this.localUserConfiguration = this._register(new UserConfiguration(userDataProfileService.currentProfile.settingsResource, userDataProfileService.currentProfile.tasksResource, { scopes: getLocalUserConfigurationScopes(userDataProfileService.currentProfile, !!remoteAuthority) }, fileService, uriIdentityService, logService));
    this.cachedFolderConfigs = new ResourceMap();
    this._register(this.localUserConfiguration.onDidChangeConfiguration((userConfiguration) => this.onLocalUserConfigurationChanged(userConfiguration)));
    if (remoteAuthority) {
      const remoteUserConfiguration = this.remoteUserConfiguration = this._register(new RemoteUserConfiguration(remoteAuthority, configurationCache, fileService, uriIdentityService, remoteAgentService, logService));
      this._register(remoteUserConfiguration.onDidInitialize((remoteUserConfigurationModel) => {
        this._register(remoteUserConfiguration.onDidChangeConfiguration((remoteUserConfigurationModel2) => this.onRemoteUserConfigurationChanged(remoteUserConfigurationModel2)));
        this.onRemoteUserConfigurationChanged(remoteUserConfigurationModel);
        this.initRemoteUserConfigurationBarrier.open();
      }));
    } else {
      this.initRemoteUserConfigurationBarrier.open();
    }
    this.workspaceConfiguration = this._register(new WorkspaceConfiguration(configurationCache, fileService, uriIdentityService, logService));
    this._register(this.workspaceConfiguration.onDidUpdateConfiguration((fromCache) => {
      this.onWorkspaceConfigurationChanged(fromCache).then(() => {
        this.workspace.initialized = this.workspaceConfiguration.initialized;
        this.checkAndMarkWorkspaceComplete(fromCache);
      });
    }));
    this._register(this.defaultConfiguration.onDidChangeConfiguration(({ properties, defaults }) => this.onDefaultConfigurationChanged(defaults, properties)));
    this._register(this.policyConfiguration.onDidChangeConfiguration((configurationModel) => this.onPolicyConfigurationChanged(configurationModel)));
    this._register(userDataProfileService.onDidChangeCurrentProfile((e) => this.onUserDataProfileChanged(e)));
    this.workspaceEditingQueue = new Queue();
  }
  get restrictedSettings() {
    return this._restrictedSettings;
  }
  createApplicationConfiguration() {
    this.applicationConfigurationDisposables.clear();
    if (this.userDataProfileService.currentProfile.isDefault || this.userDataProfileService.currentProfile.useDefaultFlags?.settings) {
      this.applicationConfiguration = null;
    } else {
      this.applicationConfiguration = this.applicationConfigurationDisposables.add(this._register(new ApplicationConfiguration(this.userDataProfilesService, this.fileService, this.uriIdentityService, this.logService)));
      this.applicationConfigurationDisposables.add(this.applicationConfiguration.onDidChangeConfiguration((configurationModel) => this.onApplicationConfigurationChanged(configurationModel)));
    }
  }
  // Workspace Context Service Impl
  async getCompleteWorkspace() {
    await this.completeWorkspaceBarrier.wait();
    return this.getWorkspace();
  }
  getWorkspace() {
    return this.workspace;
  }
  getWorkbenchState() {
    if (this.workspace.configuration) {
      return WorkbenchState.WORKSPACE;
    }
    if (this.workspace.folders.length === 1) {
      return WorkbenchState.FOLDER;
    }
    return WorkbenchState.EMPTY;
  }
  getWorkspaceFolder(resource) {
    return this.workspace.getFolder(resource);
  }
  addFolders(foldersToAdd, index) {
    return this.updateFolders(foldersToAdd, [], index);
  }
  removeFolders(foldersToRemove) {
    return this.updateFolders([], foldersToRemove);
  }
  async updateFolders(foldersToAdd, foldersToRemove, index) {
    return this.workspaceEditingQueue.queue(() => this.doUpdateFolders(foldersToAdd, foldersToRemove, index));
  }
  isInsideWorkspace(resource) {
    return !!this.getWorkspaceFolder(resource);
  }
  isCurrentWorkspace(workspaceIdOrFolder) {
    switch (this.getWorkbenchState()) {
      case WorkbenchState.FOLDER: {
        let folderUri = void 0;
        if (URI.isUri(workspaceIdOrFolder)) {
          folderUri = workspaceIdOrFolder;
        } else if (isSingleFolderWorkspaceIdentifier(workspaceIdOrFolder)) {
          folderUri = workspaceIdOrFolder.uri;
        }
        return URI.isUri(folderUri) && this.uriIdentityService.extUri.isEqual(folderUri, this.workspace.folders[0].uri);
      }
      case WorkbenchState.WORKSPACE:
        return isWorkspaceIdentifier(workspaceIdOrFolder) && this.workspace.id === workspaceIdOrFolder.id;
    }
    return false;
  }
  async doUpdateFolders(foldersToAdd, foldersToRemove, index) {
    if (this.getWorkbenchState() !== WorkbenchState.WORKSPACE) {
      return Promise.resolve(void 0);
    }
    if (foldersToAdd.length + foldersToRemove.length === 0) {
      return Promise.resolve(void 0);
    }
    let foldersHaveChanged = false;
    let currentWorkspaceFolders = this.getWorkspace().folders;
    let newStoredFolders = currentWorkspaceFolders.map((f) => f.raw).filter((folder, index2) => {
      if (!isStoredWorkspaceFolder(folder)) {
        return true;
      }
      return !this.contains(foldersToRemove, currentWorkspaceFolders[index2].uri);
    });
    foldersHaveChanged = currentWorkspaceFolders.length !== newStoredFolders.length;
    if (foldersToAdd.length) {
      const workspaceConfigPath = this.getWorkspace().configuration;
      const workspaceConfigFolder = this.uriIdentityService.extUri.dirname(workspaceConfigPath);
      currentWorkspaceFolders = toWorkspaceFolders(newStoredFolders, workspaceConfigPath, this.uriIdentityService.extUri);
      const currentWorkspaceFolderUris = currentWorkspaceFolders.map((folder) => folder.uri);
      const storedFoldersToAdd = [];
      for (const folderToAdd of foldersToAdd) {
        const folderURI = folderToAdd.uri;
        if (this.contains(currentWorkspaceFolderUris, folderURI)) {
          continue;
        }
        try {
          const result = await this.fileService.stat(folderURI);
          if (!result.isDirectory) {
            continue;
          }
        } catch (e) {
        }
        storedFoldersToAdd.push(getStoredWorkspaceFolder(folderURI, false, folderToAdd.name, workspaceConfigFolder, this.uriIdentityService.extUri));
      }
      if (storedFoldersToAdd.length > 0) {
        foldersHaveChanged = true;
        if (typeof index === "number" && index >= 0 && index < newStoredFolders.length) {
          newStoredFolders = newStoredFolders.slice(0);
          newStoredFolders.splice(index, 0, ...storedFoldersToAdd);
        } else {
          newStoredFolders = [...newStoredFolders, ...storedFoldersToAdd];
        }
      }
    }
    if (foldersHaveChanged) {
      return this.setFolders(newStoredFolders);
    }
    return Promise.resolve(void 0);
  }
  async setFolders(folders) {
    if (!this.instantiationService) {
      throw new Error("Cannot update workspace folders because workspace service is not yet ready to accept writes.");
    }
    await this.instantiationService.invokeFunction((accessor) => this.workspaceConfiguration.setFolders(folders, accessor.get(IJSONEditingService)));
    return this.onWorkspaceConfigurationChanged(false);
  }
  contains(resources, toCheck) {
    return resources.some((resource) => this.uriIdentityService.extUri.isEqual(resource, toCheck));
  }
  // Workspace Configuration Service Impl
  getConfigurationData() {
    return this._configuration.toData();
  }
  getValue(arg1, arg2) {
    const section = typeof arg1 === "string" ? arg1 : void 0;
    const overrides = isConfigurationOverrides(arg1) ? arg1 : isConfigurationOverrides(arg2) ? arg2 : void 0;
    return this._configuration.getValue(section, overrides);
  }
  async updateValue(key, value, arg3, arg4, options) {
    const overrides = isConfigurationUpdateOverrides(arg3) ? arg3 : isConfigurationOverrides(arg3) ? { resource: arg3.resource, overrideIdentifiers: arg3.overrideIdentifier ? [arg3.overrideIdentifier] : void 0 } : void 0;
    const target = overrides ? arg4 : arg3;
    const targets = target ? [target] : [];
    if (overrides?.overrideIdentifiers) {
      overrides.overrideIdentifiers = distinct(overrides.overrideIdentifiers);
      overrides.overrideIdentifiers = overrides.overrideIdentifiers.length ? overrides.overrideIdentifiers : void 0;
    }
    if (!targets.length) {
      if (overrides?.overrideIdentifiers && overrides.overrideIdentifiers.length > 1) {
        throw new Error("Configuration Target is required while updating the value for multiple override identifiers");
      }
      const inspect = this.inspect(key, { resource: overrides?.resource, overrideIdentifier: overrides?.overrideIdentifiers ? overrides.overrideIdentifiers[0] : void 0 });
      targets.push(...this.deriveConfigurationTargets(key, value, inspect));
      if (equals(value, inspect.defaultValue) && targets.length === 1 && (targets[0] === ConfigurationTarget.USER || targets[0] === ConfigurationTarget.USER_LOCAL)) {
        value = void 0;
      }
    }
    await Promises.settled(targets.map((target2) => this.writeConfigurationValue(key, value, target2, overrides, options)));
  }
  async reloadConfiguration(target) {
    if (target === void 0) {
      this.reloadDefaultConfiguration();
      const application = await this.reloadApplicationConfiguration(true);
      const { local, remote } = await this.reloadUserConfiguration();
      await this.reloadWorkspaceConfiguration();
      await this.loadConfiguration(application, local, remote, true);
      return;
    }
    if (isWorkspaceFolder(target)) {
      await this.reloadWorkspaceFolderConfiguration(target);
      return;
    }
    switch (target) {
      case ConfigurationTarget.DEFAULT:
        this.reloadDefaultConfiguration();
        return;
      case ConfigurationTarget.USER: {
        const { local, remote } = await this.reloadUserConfiguration();
        await this.loadConfiguration(this._configuration.applicationConfiguration, local, remote, true);
        return;
      }
      case ConfigurationTarget.USER_LOCAL:
        await this.reloadLocalUserConfiguration();
        return;
      case ConfigurationTarget.USER_REMOTE:
        await this.reloadRemoteUserConfiguration();
        return;
      case ConfigurationTarget.WORKSPACE:
      case ConfigurationTarget.WORKSPACE_FOLDER:
        await this.reloadWorkspaceConfiguration();
        return;
    }
  }
  hasCachedConfigurationDefaultsOverrides() {
    return this.defaultConfiguration.hasCachedConfigurationDefaultsOverrides();
  }
  inspect(key, overrides) {
    return this._configuration.inspect(key, overrides);
  }
  keys() {
    return this._configuration.keys();
  }
  async whenRemoteConfigurationLoaded() {
    await this.initRemoteUserConfigurationBarrier.wait();
  }
  /**
   * At present, all workspaces (empty, single-folder, multi-root) in local and remote
   * can be initialized without requiring extension host except following case:
   *
   * A multi root workspace with .code-workspace file that has to be resolved by an extension.
   * Because of readonly `rootPath` property in extension API we have to resolve multi root workspace
   * before extension host starts so that `rootPath` can be set to first folder.
   *
   * This restriction is lifted partially for web in `MainThreadWorkspace`.
   * In web, we start extension host with empty `rootPath` in this case.
   *
   * Related root path issue discussion is being tracked here - https://github.com/microsoft/vscode/issues/69335
   */
  async initialize(arg) {
    mark("code/willInitWorkspaceService");
    const trigger = this.initialized;
    this.initialized = false;
    const workspace = await this.createWorkspace(arg);
    await this.updateWorkspaceAndInitializeConfiguration(workspace, trigger);
    this.checkAndMarkWorkspaceComplete(false);
    mark("code/didInitWorkspaceService");
  }
  updateWorkspaceTrust(trusted) {
    if (this.isWorkspaceTrusted !== trusted) {
      this.isWorkspaceTrusted = trusted;
      const data = this._configuration.toData();
      const folderConfigurationModels = [];
      for (const folder of this.workspace.folders) {
        const folderConfiguration = this.cachedFolderConfigs.get(folder.uri);
        let configurationModel;
        if (folderConfiguration) {
          configurationModel = folderConfiguration.updateWorkspaceTrust(this.isWorkspaceTrusted);
          this._configuration.updateFolderConfiguration(folder.uri, configurationModel);
        }
        folderConfigurationModels.push(configurationModel);
      }
      if (this.getWorkbenchState() === WorkbenchState.FOLDER) {
        if (folderConfigurationModels[0]) {
          this._configuration.updateWorkspaceConfiguration(folderConfigurationModels[0]);
        }
      } else {
        this._configuration.updateWorkspaceConfiguration(this.workspaceConfiguration.updateWorkspaceTrust(this.isWorkspaceTrusted));
      }
      this.updateRestrictedSettings();
      let keys = [];
      if (this.restrictedSettings.userLocal) {
        keys.push(...this.restrictedSettings.userLocal);
      }
      if (this.restrictedSettings.userRemote) {
        keys.push(...this.restrictedSettings.userRemote);
      }
      if (this.restrictedSettings.workspace) {
        keys.push(...this.restrictedSettings.workspace);
      }
      this.restrictedSettings.workspaceFolder?.forEach((value) => keys.push(...value));
      keys = distinct(keys);
      if (keys.length) {
        this.triggerConfigurationChange({ keys, overrides: [] }, { data, workspace: this.workspace }, ConfigurationTarget.WORKSPACE);
      }
    }
  }
  acquireInstantiationService(instantiationService) {
    this.instantiationService = instantiationService;
  }
  isSettingAppliedForAllProfiles(key) {
    const scope = this.configurationRegistry.getConfigurationProperties()[key]?.scope;
    if (scope && APPLICATION_SCOPES.includes(scope)) {
      return true;
    }
    const allProfilesSettings = this.getValue(APPLY_ALL_PROFILES_SETTING) ?? [];
    return Array.isArray(allProfilesSettings) && allProfilesSettings.includes(key);
  }
  async createWorkspace(arg) {
    if (isWorkspaceIdentifier(arg)) {
      return this.createMultiFolderWorkspace(arg);
    }
    if (isSingleFolderWorkspaceIdentifier(arg)) {
      return this.createSingleFolderWorkspace(arg);
    }
    return this.createEmptyWorkspace(arg);
  }
  async createMultiFolderWorkspace(workspaceIdentifier) {
    await this.workspaceConfiguration.initialize({ id: workspaceIdentifier.id, configPath: workspaceIdentifier.configPath }, this.isWorkspaceTrusted);
    const workspaceConfigPath = workspaceIdentifier.configPath;
    const workspaceFolders = toWorkspaceFolders(this.workspaceConfiguration.getFolders(), workspaceConfigPath, this.uriIdentityService.extUri);
    const workspaceId = workspaceIdentifier.id;
    const workspace = new Workspace(workspaceId, workspaceFolders, this.workspaceConfiguration.isTransient(), workspaceConfigPath, (uri) => this.uriIdentityService.extUri.ignorePathCasing(uri));
    workspace.initialized = this.workspaceConfiguration.initialized;
    return workspace;
  }
  createSingleFolderWorkspace(singleFolderWorkspaceIdentifier) {
    const workspace = new Workspace(singleFolderWorkspaceIdentifier.id, [toWorkspaceFolder(singleFolderWorkspaceIdentifier.uri)], false, null, (uri) => this.uriIdentityService.extUri.ignorePathCasing(uri));
    workspace.initialized = true;
    return workspace;
  }
  createEmptyWorkspace(emptyWorkspaceIdentifier) {
    const workspace = new Workspace(emptyWorkspaceIdentifier.id, [], false, null, (uri) => this.uriIdentityService.extUri.ignorePathCasing(uri));
    workspace.initialized = true;
    return Promise.resolve(workspace);
  }
  checkAndMarkWorkspaceComplete(fromCache) {
    if (!this.completeWorkspaceBarrier.isOpen() && this.workspace.initialized) {
      this.completeWorkspaceBarrier.open();
      this.validateWorkspaceFoldersAndReload(fromCache);
    }
  }
  async updateWorkspaceAndInitializeConfiguration(workspace, trigger) {
    const hasWorkspaceBefore = !!this.workspace;
    let previousState;
    let previousWorkspacePath;
    let previousFolders = [];
    if (hasWorkspaceBefore) {
      previousState = this.getWorkbenchState();
      previousWorkspacePath = this.workspace.configuration ? this.workspace.configuration.fsPath : void 0;
      previousFolders = this.workspace.folders;
      this.workspace.update(workspace);
    } else {
      this.workspace = workspace;
    }
    await this.initializeConfiguration(trigger);
    if (hasWorkspaceBefore) {
      const newState = this.getWorkbenchState();
      if (previousState && newState !== previousState) {
        this._onDidChangeWorkbenchState.fire(newState);
      }
      const newWorkspacePath = this.workspace.configuration ? this.workspace.configuration.fsPath : void 0;
      if (previousWorkspacePath && newWorkspacePath !== previousWorkspacePath || newState !== previousState) {
        this._onDidChangeWorkspaceName.fire();
      }
      const folderChanges = this.compareFolders(previousFolders, this.workspace.folders);
      if (folderChanges && (folderChanges.added.length || folderChanges.removed.length || folderChanges.changed.length)) {
        await this.handleWillChangeWorkspaceFolders(folderChanges, false);
        this._onDidChangeWorkspaceFolders.fire(folderChanges);
      }
    }
    if (!this.localUserConfiguration.hasTasksLoaded) {
      this._register(runWhenWindowIdle(mainWindow, () => this.reloadLocalUserConfiguration(false, this._configuration.localUserConfiguration)));
    }
  }
  compareFolders(currentFolders, newFolders) {
    const result = { added: [], removed: [], changed: [] };
    result.added = newFolders.filter((newFolder) => !currentFolders.some((currentFolder) => newFolder.uri.toString() === currentFolder.uri.toString()));
    for (let currentIndex = 0; currentIndex < currentFolders.length; currentIndex++) {
      const currentFolder = currentFolders[currentIndex];
      let newIndex = 0;
      for (newIndex = 0; newIndex < newFolders.length && currentFolder.uri.toString() !== newFolders[newIndex].uri.toString(); newIndex++) {
      }
      if (newIndex < newFolders.length) {
        if (currentIndex !== newIndex || currentFolder.name !== newFolders[newIndex].name) {
          result.changed.push(currentFolder);
        }
      } else {
        result.removed.push(currentFolder);
      }
    }
    return result;
  }
  async initializeConfiguration(trigger) {
    await this.defaultConfiguration.initialize();
    const initPolicyConfigurationPromise = this.policyConfiguration.initialize();
    const initApplicationConfigurationPromise = this.applicationConfiguration ? this.applicationConfiguration.initialize() : Promise.resolve(ConfigurationModel.createEmptyModel(this.logService));
    const initUserConfiguration = async () => {
      mark("code/willInitUserConfiguration");
      const result = await Promise.all([this.localUserConfiguration.initialize(), this.remoteUserConfiguration ? this.remoteUserConfiguration.initialize() : Promise.resolve(ConfigurationModel.createEmptyModel(this.logService))]);
      if (this.applicationConfiguration) {
        const applicationConfigurationModel = await initApplicationConfigurationPromise;
        result[0] = this.localUserConfiguration.reparse({ exclude: applicationConfigurationModel.getValue(APPLY_ALL_PROFILES_SETTING) });
      }
      mark("code/didInitUserConfiguration");
      return result;
    };
    const [, application, [local, remote]] = await Promise.all([
      initPolicyConfigurationPromise,
      initApplicationConfigurationPromise,
      initUserConfiguration()
    ]);
    mark("code/willInitWorkspaceConfiguration");
    await this.loadConfiguration(application, local, remote, trigger);
    mark("code/didInitWorkspaceConfiguration");
  }
  reloadDefaultConfiguration() {
    this.onDefaultConfigurationChanged(this.defaultConfiguration.reload());
  }
  async reloadApplicationConfiguration(donotTrigger) {
    if (!this.applicationConfiguration) {
      return ConfigurationModel.createEmptyModel(this.logService);
    }
    const model = await this.applicationConfiguration.loadConfiguration();
    if (!donotTrigger) {
      this.onApplicationConfigurationChanged(model);
    }
    return model;
  }
  async reloadUserConfiguration() {
    const [local, remote] = await Promise.all([this.reloadLocalUserConfiguration(true), this.reloadRemoteUserConfiguration(true)]);
    return { local, remote };
  }
  async reloadLocalUserConfiguration(donotTrigger, settingsConfiguration) {
    const model = await this.localUserConfiguration.reload(settingsConfiguration);
    if (!donotTrigger) {
      this.onLocalUserConfigurationChanged(model);
    }
    return model;
  }
  async reloadRemoteUserConfiguration(donotTrigger) {
    if (this.remoteUserConfiguration) {
      const model = await this.remoteUserConfiguration.reload();
      if (!donotTrigger) {
        this.onRemoteUserConfigurationChanged(model);
      }
      return model;
    }
    return ConfigurationModel.createEmptyModel(this.logService);
  }
  async reloadWorkspaceConfiguration() {
    const workbenchState = this.getWorkbenchState();
    if (workbenchState === WorkbenchState.FOLDER) {
      return this.onWorkspaceFolderConfigurationChanged(this.workspace.folders[0]);
    }
    if (workbenchState === WorkbenchState.WORKSPACE) {
      return this.workspaceConfiguration.reload().then(() => this.onWorkspaceConfigurationChanged(false));
    }
  }
  reloadWorkspaceFolderConfiguration(folder) {
    return this.onWorkspaceFolderConfigurationChanged(folder);
  }
  async loadConfiguration(applicationConfigurationModel, userConfigurationModel, remoteUserConfigurationModel, trigger) {
    this.cachedFolderConfigs = new ResourceMap();
    const folders = this.workspace.folders;
    const folderConfigurations = await this.loadFolderConfigurations(folders);
    const workspaceConfiguration = this.getWorkspaceConfigurationModel(folderConfigurations);
    const folderConfigurationModels = new ResourceMap();
    folderConfigurations.forEach((folderConfiguration, index) => folderConfigurationModels.set(folders[index].uri, folderConfiguration));
    const currentConfiguration = this._configuration;
    this._configuration = new Configuration(this.defaultConfiguration.configurationModel, this.policyConfiguration.configurationModel, applicationConfigurationModel, userConfigurationModel, remoteUserConfigurationModel, workspaceConfiguration, folderConfigurationModels, ConfigurationModel.createEmptyModel(this.logService), new ResourceMap(), this.workspace, this.logService);
    this.initialized = true;
    if (trigger) {
      const change = this._configuration.compare(currentConfiguration);
      this.triggerConfigurationChange(change, { data: currentConfiguration.toData(), workspace: this.workspace }, ConfigurationTarget.WORKSPACE);
    }
    this.updateRestrictedSettings();
  }
  getWorkspaceConfigurationModel(folderConfigurations) {
    switch (this.getWorkbenchState()) {
      case WorkbenchState.FOLDER:
        return folderConfigurations[0];
      case WorkbenchState.WORKSPACE:
        return this.workspaceConfiguration.getConfiguration();
      default:
        return ConfigurationModel.createEmptyModel(this.logService);
    }
  }
  onUserDataProfileChanged(e) {
    e.join((async () => {
      const promises = [];
      promises.push(this.localUserConfiguration.reset(e.profile.settingsResource, e.profile.tasksResource, { scopes: getLocalUserConfigurationScopes(e.profile, !!this.remoteUserConfiguration) }));
      if (e.previous.isDefault !== e.profile.isDefault || !!e.previous.useDefaultFlags?.settings !== !!e.profile.useDefaultFlags?.settings) {
        this.createApplicationConfiguration();
        if (this.applicationConfiguration) {
          promises.push(this.reloadApplicationConfiguration(true));
        }
      }
      let [localUser, application] = await Promise.all(promises);
      application = application ?? this._configuration.applicationConfiguration;
      if (this.applicationConfiguration) {
        localUser = this.localUserConfiguration.reparse({ exclude: application.getValue(APPLY_ALL_PROFILES_SETTING) });
      }
      await this.loadConfiguration(application, localUser, this._configuration.remoteUserConfiguration, true);
    })());
  }
  onDefaultConfigurationChanged(configurationModel, properties) {
    if (this.workspace) {
      const previousData = this._configuration.toData();
      const change = this._configuration.compareAndUpdateDefaultConfiguration(configurationModel, properties);
      if (this.applicationConfiguration) {
        this._configuration.updateApplicationConfiguration(this.applicationConfiguration.reparse());
      }
      if (this.remoteUserConfiguration) {
        this._configuration.updateLocalUserConfiguration(this.localUserConfiguration.reparse());
        this._configuration.updateRemoteUserConfiguration(this.remoteUserConfiguration.reparse());
      }
      if (this.getWorkbenchState() === WorkbenchState.FOLDER) {
        const folderConfiguration = this.cachedFolderConfigs.get(this.workspace.folders[0].uri);
        if (folderConfiguration) {
          this._configuration.updateWorkspaceConfiguration(folderConfiguration.reparse());
          this._configuration.updateFolderConfiguration(this.workspace.folders[0].uri, folderConfiguration.reparse());
        }
      } else {
        this._configuration.updateWorkspaceConfiguration(this.workspaceConfiguration.reparseWorkspaceSettings());
        for (const folder of this.workspace.folders) {
          const folderConfiguration = this.cachedFolderConfigs.get(folder.uri);
          if (folderConfiguration) {
            this._configuration.updateFolderConfiguration(folder.uri, folderConfiguration.reparse());
          }
        }
      }
      this.triggerConfigurationChange(change, { data: previousData, workspace: this.workspace }, ConfigurationTarget.DEFAULT);
      this.updateRestrictedSettings();
    }
  }
  onPolicyConfigurationChanged(policyConfiguration) {
    const previous = { data: this._configuration.toData(), workspace: this.workspace };
    const change = this._configuration.compareAndUpdatePolicyConfiguration(policyConfiguration);
    this.triggerConfigurationChange(change, previous, ConfigurationTarget.DEFAULT);
  }
  onApplicationConfigurationChanged(applicationConfiguration) {
    const previous = { data: this._configuration.toData(), workspace: this.workspace };
    const previousAllProfilesSettings = this._configuration.applicationConfiguration.getValue(APPLY_ALL_PROFILES_SETTING) ?? [];
    const change = this._configuration.compareAndUpdateApplicationConfiguration(applicationConfiguration);
    const currentAllProfilesSettings = this.getValue(APPLY_ALL_PROFILES_SETTING) ?? [];
    const configurationProperties = this.configurationRegistry.getConfigurationProperties();
    const changedKeys = [];
    for (const changedKey of change.keys) {
      const scope = configurationProperties[changedKey]?.scope;
      if (scope && APPLICATION_SCOPES.includes(scope)) {
        changedKeys.push(changedKey);
        if (changedKey === APPLY_ALL_PROFILES_SETTING) {
          for (const previousAllProfileSetting of previousAllProfilesSettings) {
            if (!currentAllProfilesSettings.includes(previousAllProfileSetting)) {
              changedKeys.push(previousAllProfileSetting);
            }
          }
          for (const currentAllProfileSetting of currentAllProfilesSettings) {
            if (!previousAllProfilesSettings.includes(currentAllProfileSetting)) {
              changedKeys.push(currentAllProfileSetting);
            }
          }
        }
      } else if (currentAllProfilesSettings.includes(changedKey)) {
        changedKeys.push(changedKey);
      }
    }
    change.keys = changedKeys;
    if (change.keys.includes(APPLY_ALL_PROFILES_SETTING)) {
      this._configuration.updateLocalUserConfiguration(this.localUserConfiguration.reparse({ exclude: currentAllProfilesSettings }));
    }
    this.triggerConfigurationChange(change, previous, ConfigurationTarget.USER);
  }
  onLocalUserConfigurationChanged(userConfiguration) {
    const previous = { data: this._configuration.toData(), workspace: this.workspace };
    const change = this._configuration.compareAndUpdateLocalUserConfiguration(userConfiguration);
    this.triggerConfigurationChange(change, previous, ConfigurationTarget.USER);
  }
  onRemoteUserConfigurationChanged(userConfiguration) {
    const previous = { data: this._configuration.toData(), workspace: this.workspace };
    const change = this._configuration.compareAndUpdateRemoteUserConfiguration(userConfiguration);
    this.triggerConfigurationChange(change, previous, ConfigurationTarget.USER);
  }
  async onWorkspaceConfigurationChanged(fromCache) {
    if (this.workspace && this.workspace.configuration) {
      let newFolders = toWorkspaceFolders(this.workspaceConfiguration.getFolders(), this.workspace.configuration, this.uriIdentityService.extUri);
      if (this.workspace.initialized) {
        const { added, removed, changed } = this.compareFolders(this.workspace.folders, newFolders);
        if (added.length || removed.length || changed.length) {
          newFolders = await this.toValidWorkspaceFolders(newFolders);
        } else {
          newFolders = this.workspace.folders;
        }
      }
      await this.updateWorkspaceConfiguration(newFolders, this.workspaceConfiguration.getConfiguration(), fromCache);
    }
  }
  updateRestrictedSettings() {
    const changed = [];
    const allProperties = this.configurationRegistry.getConfigurationProperties();
    const defaultRestrictedSettings = Object.keys(allProperties).filter((key) => allProperties[key].restricted).sort((a, b) => a.localeCompare(b));
    const defaultDelta = delta(defaultRestrictedSettings, this._restrictedSettings.default, (a, b) => a.localeCompare(b));
    changed.push(...defaultDelta.added, ...defaultDelta.removed);
    const application = (this.applicationConfiguration?.getRestrictedSettings() || []).sort((a, b) => a.localeCompare(b));
    const applicationDelta = delta(application, this._restrictedSettings.application || [], (a, b) => a.localeCompare(b));
    changed.push(...applicationDelta.added, ...applicationDelta.removed);
    const userLocal = this.localUserConfiguration.getRestrictedSettings().sort((a, b) => a.localeCompare(b));
    const userLocalDelta = delta(userLocal, this._restrictedSettings.userLocal || [], (a, b) => a.localeCompare(b));
    changed.push(...userLocalDelta.added, ...userLocalDelta.removed);
    const userRemote = (this.remoteUserConfiguration?.getRestrictedSettings() || []).sort((a, b) => a.localeCompare(b));
    const userRemoteDelta = delta(userRemote, this._restrictedSettings.userRemote || [], (a, b) => a.localeCompare(b));
    changed.push(...userRemoteDelta.added, ...userRemoteDelta.removed);
    const workspaceFolderMap = new ResourceMap();
    for (const workspaceFolder of this.workspace.folders) {
      const cachedFolderConfig = this.cachedFolderConfigs.get(workspaceFolder.uri);
      const folderRestrictedSettings = (cachedFolderConfig?.getRestrictedSettings() || []).sort((a, b) => a.localeCompare(b));
      if (folderRestrictedSettings.length) {
        workspaceFolderMap.set(workspaceFolder.uri, folderRestrictedSettings);
      }
      const previous = this._restrictedSettings.workspaceFolder?.get(workspaceFolder.uri) || [];
      const workspaceFolderDelta = delta(folderRestrictedSettings, previous, (a, b) => a.localeCompare(b));
      changed.push(...workspaceFolderDelta.added, ...workspaceFolderDelta.removed);
    }
    const workspace = this.getWorkbenchState() === WorkbenchState.WORKSPACE ? this.workspaceConfiguration.getRestrictedSettings().sort((a, b) => a.localeCompare(b)) : this.workspace.folders[0] ? workspaceFolderMap.get(this.workspace.folders[0].uri) || [] : [];
    const workspaceDelta = delta(workspace, this._restrictedSettings.workspace || [], (a, b) => a.localeCompare(b));
    changed.push(...workspaceDelta.added, ...workspaceDelta.removed);
    if (changed.length) {
      this._restrictedSettings = {
        default: defaultRestrictedSettings,
        application: application.length ? application : void 0,
        userLocal: userLocal.length ? userLocal : void 0,
        userRemote: userRemote.length ? userRemote : void 0,
        workspace: workspace.length ? workspace : void 0,
        workspaceFolder: workspaceFolderMap.size ? workspaceFolderMap : void 0
      };
      this._onDidChangeRestrictedSettings.fire(this.restrictedSettings);
    }
  }
  async updateWorkspaceConfiguration(workspaceFolders, configuration, fromCache) {
    const previous = { data: this._configuration.toData(), workspace: this.workspace };
    const change = this._configuration.compareAndUpdateWorkspaceConfiguration(configuration);
    const changes = this.compareFolders(this.workspace.folders, workspaceFolders);
    if (changes.added.length || changes.removed.length || changes.changed.length) {
      this.workspace.folders = workspaceFolders;
      const change2 = await this.onFoldersChanged();
      await this.handleWillChangeWorkspaceFolders(changes, fromCache);
      this.triggerConfigurationChange(change2, previous, ConfigurationTarget.WORKSPACE_FOLDER);
      this._onDidChangeWorkspaceFolders.fire(changes);
    } else {
      this.triggerConfigurationChange(change, previous, ConfigurationTarget.WORKSPACE);
    }
    this.updateRestrictedSettings();
  }
  async handleWillChangeWorkspaceFolders(changes, fromCache) {
    const joiners = [];
    this._onWillChangeWorkspaceFolders.fire({
      join(updateWorkspaceTrustStatePromise) {
        joiners.push(updateWorkspaceTrustStatePromise);
      },
      changes,
      fromCache
    });
    try {
      await Promises.settled(joiners);
    } catch (error) {
    }
  }
  async onWorkspaceFolderConfigurationChanged(folder) {
    const [folderConfiguration] = await this.loadFolderConfigurations([folder]);
    const previous = { data: this._configuration.toData(), workspace: this.workspace };
    const folderConfigurationChange = this._configuration.compareAndUpdateFolderConfiguration(folder.uri, folderConfiguration);
    if (this.getWorkbenchState() === WorkbenchState.FOLDER) {
      const workspaceConfigurationChange = this._configuration.compareAndUpdateWorkspaceConfiguration(folderConfiguration);
      this.triggerConfigurationChange(mergeChanges(folderConfigurationChange, workspaceConfigurationChange), previous, ConfigurationTarget.WORKSPACE);
    } else {
      this.triggerConfigurationChange(folderConfigurationChange, previous, ConfigurationTarget.WORKSPACE_FOLDER);
    }
    this.updateRestrictedSettings();
  }
  async onFoldersChanged() {
    const changes = [];
    for (const key of this.cachedFolderConfigs.keys()) {
      if (!this.workspace.folders.filter((folder) => folder.uri.toString() === key.toString())[0]) {
        const folderConfiguration = this.cachedFolderConfigs.get(key);
        folderConfiguration.dispose();
        this.cachedFolderConfigs.delete(key);
        changes.push(this._configuration.compareAndDeleteFolderConfiguration(key));
      }
    }
    const toInitialize = this.workspace.folders.filter((folder) => !this.cachedFolderConfigs.has(folder.uri));
    if (toInitialize.length) {
      const folderConfigurations = await this.loadFolderConfigurations(toInitialize);
      folderConfigurations.forEach((folderConfiguration, index) => {
        changes.push(this._configuration.compareAndUpdateFolderConfiguration(toInitialize[index].uri, folderConfiguration));
      });
    }
    return mergeChanges(...changes);
  }
  loadFolderConfigurations(folders) {
    return Promise.all([...folders.map((folder) => {
      let folderConfiguration = this.cachedFolderConfigs.get(folder.uri);
      if (!folderConfiguration) {
        folderConfiguration = new FolderConfiguration(!this.initialized, folder, FOLDER_CONFIG_FOLDER_NAME, this.getWorkbenchState(), this.isWorkspaceTrusted, this.fileService, this.uriIdentityService, this.logService, this.configurationCache);
        this._register(folderConfiguration.onDidChange(() => this.onWorkspaceFolderConfigurationChanged(folder)));
        this.cachedFolderConfigs.set(folder.uri, this._register(folderConfiguration));
      }
      return folderConfiguration.loadConfiguration();
    })]);
  }
  async validateWorkspaceFoldersAndReload(fromCache) {
    const validWorkspaceFolders = await this.toValidWorkspaceFolders(this.workspace.folders);
    const { removed } = this.compareFolders(this.workspace.folders, validWorkspaceFolders);
    if (removed.length) {
      await this.updateWorkspaceConfiguration(validWorkspaceFolders, this.workspaceConfiguration.getConfiguration(), fromCache);
    }
  }
  // Filter out workspace folders which are files (not directories)
  // Workspace folders those cannot be resolved are not filtered because they are handled by the Explorer.
  async toValidWorkspaceFolders(workspaceFolders) {
    const validWorkspaceFolders = [];
    for (const workspaceFolder of workspaceFolders) {
      try {
        const result = await this.fileService.stat(workspaceFolder.uri);
        if (!result.isDirectory) {
          continue;
        }
      } catch (e) {
        this.logService.warn(`Ignoring the error while validating workspace folder ${workspaceFolder.uri.toString()} - ${toErrorMessage(e)}`);
      }
      validWorkspaceFolders.push(workspaceFolder);
    }
    return validWorkspaceFolders;
  }
  async writeConfigurationValue(key, value, target, overrides, options) {
    if (!this.instantiationService) {
      throw new Error("Cannot write configuration because the configuration service is not yet ready to accept writes.");
    }
    if (target === ConfigurationTarget.DEFAULT) {
      throw new Error("Invalid configuration target");
    }
    if (target === ConfigurationTarget.MEMORY) {
      const previous = { data: this._configuration.toData(), workspace: this.workspace };
      this._configuration.updateValue(key, value, overrides);
      this.triggerConfigurationChange({ keys: overrides?.overrideIdentifiers?.length ? [keyFromOverrideIdentifiers(overrides.overrideIdentifiers), key] : [key], overrides: overrides?.overrideIdentifiers?.length ? overrides.overrideIdentifiers.map((overrideIdentifier) => [overrideIdentifier, [key]]) : [] }, previous, target);
      return;
    }
    const editableConfigurationTarget = this.toEditableConfigurationTarget(target, key);
    if (!editableConfigurationTarget) {
      throw new Error("Invalid configuration target");
    }
    if (editableConfigurationTarget === EditableConfigurationTarget.USER_REMOTE && !this.remoteUserConfiguration) {
      throw new Error("Invalid configuration target");
    }
    if (overrides?.overrideIdentifiers?.length && overrides.overrideIdentifiers.length > 1) {
      const configurationModel = this.getConfigurationModelForEditableConfigurationTarget(editableConfigurationTarget, overrides.resource);
      if (configurationModel) {
        const overrideIdentifiers = overrides.overrideIdentifiers.sort();
        const existingOverrides = configurationModel.overrides.find((override) => arrayEquals([...override.identifiers].sort(), overrideIdentifiers));
        if (existingOverrides) {
          overrides.overrideIdentifiers = existingOverrides.identifiers;
        }
      }
    }
    this.configurationEditing = this.configurationEditing ?? this.createConfigurationEditingService(this.instantiationService);
    await (await this.configurationEditing).writeConfiguration(editableConfigurationTarget, { key, value }, { scopes: overrides, ...options });
    switch (editableConfigurationTarget) {
      case EditableConfigurationTarget.USER_LOCAL:
        if (this.applicationConfiguration && this.isSettingAppliedForAllProfiles(key)) {
          await this.reloadApplicationConfiguration();
        } else {
          await this.reloadLocalUserConfiguration();
        }
        return;
      case EditableConfigurationTarget.USER_REMOTE:
        return this.reloadRemoteUserConfiguration().then(() => void 0);
      case EditableConfigurationTarget.WORKSPACE:
        return this.reloadWorkspaceConfiguration();
      case EditableConfigurationTarget.WORKSPACE_FOLDER: {
        const workspaceFolder = overrides && overrides.resource ? this.workspace.getFolder(overrides.resource) : null;
        if (workspaceFolder) {
          return this.reloadWorkspaceFolderConfiguration(workspaceFolder);
        }
      }
    }
  }
  async createConfigurationEditingService(instantiationService) {
    const remoteSettingsResource = (await this.remoteAgentService.getEnvironment())?.settingsPath ?? null;
    return instantiationService.createInstance(ConfigurationEditing, remoteSettingsResource);
  }
  getConfigurationModelForEditableConfigurationTarget(target, resource) {
    switch (target) {
      case EditableConfigurationTarget.USER_LOCAL:
        return this._configuration.localUserConfiguration;
      case EditableConfigurationTarget.USER_REMOTE:
        return this._configuration.remoteUserConfiguration;
      case EditableConfigurationTarget.WORKSPACE:
        return this._configuration.workspaceConfiguration;
      case EditableConfigurationTarget.WORKSPACE_FOLDER:
        return resource ? this._configuration.folderConfigurations.get(resource) : void 0;
    }
  }
  getConfigurationModel(target, resource) {
    switch (target) {
      case ConfigurationTarget.USER_LOCAL:
        return this._configuration.localUserConfiguration;
      case ConfigurationTarget.USER_REMOTE:
        return this._configuration.remoteUserConfiguration;
      case ConfigurationTarget.WORKSPACE:
        return this._configuration.workspaceConfiguration;
      case ConfigurationTarget.WORKSPACE_FOLDER:
        return resource ? this._configuration.folderConfigurations.get(resource) : void 0;
      default:
        return void 0;
    }
  }
  deriveConfigurationTargets(key, value, inspect) {
    if (equals(value, inspect.value)) {
      return [];
    }
    const definedTargets = [];
    if (inspect.workspaceFolderValue !== void 0) {
      definedTargets.push(ConfigurationTarget.WORKSPACE_FOLDER);
    }
    if (inspect.workspaceValue !== void 0) {
      definedTargets.push(ConfigurationTarget.WORKSPACE);
    }
    if (inspect.userRemoteValue !== void 0) {
      definedTargets.push(ConfigurationTarget.USER_REMOTE);
    }
    if (inspect.userLocalValue !== void 0) {
      definedTargets.push(ConfigurationTarget.USER_LOCAL);
    }
    if (inspect.applicationValue !== void 0) {
      definedTargets.push(ConfigurationTarget.APPLICATION);
    }
    if (value === void 0) {
      return definedTargets;
    }
    return [definedTargets[0] || ConfigurationTarget.USER];
  }
  triggerConfigurationChange(change, previous, target) {
    if (change.keys.length) {
      if (target !== ConfigurationTarget.DEFAULT) {
        this.logService.debug(`Configuration keys changed in ${ConfigurationTargetToString(target)} target`, ...change.keys);
      }
      const configurationChangeEvent = new ConfigurationChangeEvent(change, previous, this._configuration, this.workspace, this.logService);
      configurationChangeEvent.source = target;
      this._onDidChangeConfiguration.fire(configurationChangeEvent);
    }
  }
  toEditableConfigurationTarget(target, key) {
    if (target === ConfigurationTarget.APPLICATION) {
      return EditableConfigurationTarget.USER_LOCAL;
    }
    if (target === ConfigurationTarget.USER) {
      if (this.remoteUserConfiguration) {
        const scope = this.configurationRegistry.getConfigurationProperties()[key]?.scope;
        if (scope === ConfigurationScope.MACHINE || scope === ConfigurationScope.MACHINE_OVERRIDABLE || scope === ConfigurationScope.APPLICATION_MACHINE) {
          return EditableConfigurationTarget.USER_REMOTE;
        }
        if (this.inspect(key).userRemoteValue !== void 0) {
          return EditableConfigurationTarget.USER_REMOTE;
        }
      }
      return EditableConfigurationTarget.USER_LOCAL;
    }
    if (target === ConfigurationTarget.USER_LOCAL) {
      return EditableConfigurationTarget.USER_LOCAL;
    }
    if (target === ConfigurationTarget.USER_REMOTE) {
      return EditableConfigurationTarget.USER_REMOTE;
    }
    if (target === ConfigurationTarget.WORKSPACE) {
      return EditableConfigurationTarget.WORKSPACE;
    }
    if (target === ConfigurationTarget.WORKSPACE_FOLDER) {
      return EditableConfigurationTarget.WORKSPACE_FOLDER;
    }
    return null;
  }
}
let RegisterConfigurationSchemasContribution = class extends Disposable {
  constructor(workspaceContextService, environmentService, workspaceTrustManagementService, extensionService, lifecycleService) {
    super();
    this.workspaceContextService = workspaceContextService;
    this.environmentService = environmentService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    extensionService.whenInstalledExtensionsRegistered().then(() => {
      this.registerConfigurationSchemas();
      const configurationRegistry2 = Registry.as(Extensions.Configuration);
      const delayer = this._register(new Delayer(50));
      this._register(Event.any(configurationRegistry2.onDidUpdateConfiguration, configurationRegistry2.onDidSchemaChange, workspaceTrustManagementService.onDidChangeTrust)(() => delayer.trigger(
        () => this.registerConfigurationSchemas(),
        lifecycleService.phase === LifecyclePhase.Eventually ? void 0 : 2500
        /* delay longer in early phases */
      )));
    });
  }
  registerConfigurationSchemas() {
    const allSettingsSchema = {
      properties: allSettings.properties,
      patternProperties: allSettings.patternProperties,
      additionalProperties: true,
      allowTrailingCommas: true,
      allowComments: true
    };
    const userSettingsSchema = this.environmentService.remoteAuthority ? {
      properties: Object.assign(
        {},
        applicationSettings.properties,
        windowSettings.properties,
        resourceSettings.properties
      ),
      patternProperties: allSettings.patternProperties,
      additionalProperties: true,
      allowTrailingCommas: true,
      allowComments: true
    } : allSettingsSchema;
    const profileSettingsSchema = {
      properties: Object.assign(
        {},
        machineSettings.properties,
        machineOverridableSettings.properties,
        windowSettings.properties,
        resourceSettings.properties
      ),
      patternProperties: allSettings.patternProperties,
      additionalProperties: true,
      allowTrailingCommas: true,
      allowComments: true
    };
    const machineSettingsSchema = {
      properties: Object.assign(
        {},
        applicationMachineSettings.properties,
        machineSettings.properties,
        machineOverridableSettings.properties,
        windowSettings.properties,
        resourceSettings.properties
      ),
      patternProperties: allSettings.patternProperties,
      additionalProperties: true,
      allowTrailingCommas: true,
      allowComments: true
    };
    const workspaceSettingsSchema = {
      properties: Object.assign(
        {},
        this.checkAndFilterPropertiesRequiringTrust(machineOverridableSettings.properties),
        this.checkAndFilterPropertiesRequiringTrust(windowSettings.properties),
        this.checkAndFilterPropertiesRequiringTrust(resourceSettings.properties)
      ),
      patternProperties: allSettings.patternProperties,
      additionalProperties: true,
      allowTrailingCommas: true,
      allowComments: true
    };
    const defaultSettingsSchema = {
      properties: Object.keys(allSettings.properties).reduce((result, key) => {
        result[key] = Object.assign({ deprecationMessage: void 0 }, allSettings.properties[key]);
        return result;
      }, {}),
      patternProperties: Object.keys(allSettings.patternProperties).reduce((result, key) => {
        result[key] = Object.assign({ deprecationMessage: void 0 }, allSettings.patternProperties[key]);
        return result;
      }, {}),
      additionalProperties: true,
      allowTrailingCommas: true,
      allowComments: true
    };
    const folderSettingsSchema = WorkbenchState.WORKSPACE === this.workspaceContextService.getWorkbenchState() ? {
      properties: Object.assign(
        {},
        this.checkAndFilterPropertiesRequiringTrust(machineOverridableSettings.properties),
        this.checkAndFilterPropertiesRequiringTrust(resourceSettings.properties)
      ),
      patternProperties: allSettings.patternProperties,
      additionalProperties: true,
      allowTrailingCommas: true,
      allowComments: true
    } : workspaceSettingsSchema;
    const configDefaultsSchema = {
      type: "object",
      description: localize("configurationDefaults.description", "Contribute defaults for configurations"),
      properties: Object.assign(
        {},
        this.filterDefaultOverridableProperties(machineOverridableSettings.properties),
        this.filterDefaultOverridableProperties(windowSettings.properties),
        this.filterDefaultOverridableProperties(resourceSettings.properties)
      ),
      patternProperties: {
        [OVERRIDE_PROPERTY_PATTERN]: {
          type: "object",
          default: {},
          $ref: resourceLanguageSettingsSchemaId
        }
      },
      additionalProperties: false
    };
    this.registerSchemas({
      defaultSettingsSchema,
      userSettingsSchema,
      profileSettingsSchema,
      machineSettingsSchema,
      workspaceSettingsSchema,
      folderSettingsSchema,
      configDefaultsSchema
    });
  }
  registerSchemas(schemas) {
    const jsonRegistry = Registry.as(JSONExtensions.JSONContribution);
    jsonRegistry.registerSchema(defaultSettingsSchemaId, schemas.defaultSettingsSchema);
    jsonRegistry.registerSchema(userSettingsSchemaId, schemas.userSettingsSchema);
    jsonRegistry.registerSchema(profileSettingsSchemaId, schemas.profileSettingsSchema);
    jsonRegistry.registerSchema(machineSettingsSchemaId, schemas.machineSettingsSchema);
    jsonRegistry.registerSchema(workspaceSettingsSchemaId, schemas.workspaceSettingsSchema);
    jsonRegistry.registerSchema(folderSettingsSchemaId, schemas.folderSettingsSchema);
    jsonRegistry.registerSchema(configurationDefaultsSchemaId, schemas.configDefaultsSchema);
  }
  checkAndFilterPropertiesRequiringTrust(properties) {
    if (this.workspaceTrustManagementService.isWorkspaceTrusted()) {
      return properties;
    }
    const result = {};
    Object.entries(properties).forEach(([key, value]) => {
      if (!value.restricted) {
        result[key] = value;
      }
    });
    return result;
  }
  filterDefaultOverridableProperties(properties) {
    const result = {};
    Object.entries(properties).forEach(([key, value]) => {
      if (!value.disallowConfigurationDefault) {
        result[key] = value;
      }
    });
    return result;
  }
};
RegisterConfigurationSchemasContribution = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, IWorkbenchEnvironmentService),
  __decorateParam(2, IWorkspaceTrustManagementService),
  __decorateParam(3, IExtensionService),
  __decorateParam(4, ILifecycleService)
], RegisterConfigurationSchemasContribution);
let ResetConfigurationDefaultsOverridesCache = class extends Disposable {
  constructor(configurationService, extensionService) {
    super();
    if (configurationService.hasCachedConfigurationDefaultsOverrides()) {
      extensionService.whenInstalledExtensionsRegistered().then(() => configurationService.reloadConfiguration(ConfigurationTarget.DEFAULT));
    }
  }
};
ResetConfigurationDefaultsOverridesCache = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IExtensionService)
], ResetConfigurationDefaultsOverridesCache);
let UpdateExperimentalSettingsDefaults = class extends Disposable {
  constructor(workbenchAssignmentService) {
    super();
    this.workbenchAssignmentService = workbenchAssignmentService;
    this.processedExperimentalSettings = /* @__PURE__ */ new Set();
    this.configurationRegistry = Registry.as(Extensions.Configuration);
    this.processExperimentalSettings(Object.keys(this.configurationRegistry.getConfigurationProperties()));
    this._register(this.configurationRegistry.onDidUpdateConfiguration(({ properties }) => this.processExperimentalSettings(properties)));
  }
  async processExperimentalSettings(properties) {
    const overrides = {};
    const allProperties = this.configurationRegistry.getConfigurationProperties();
    for (const property of properties) {
      const schema = allProperties[property];
      const tags = schema?.tags;
      if (!tags || !tags.some((tag) => tag.toLowerCase() === "onexp")) {
        continue;
      }
      if (this.processedExperimentalSettings.has(property)) {
        continue;
      }
      this.processedExperimentalSettings.add(property);
      try {
        const value = await this.workbenchAssignmentService.getTreatment(`config.${property}`);
        if (!isUndefined(value) && !equals(value, schema.default)) {
          overrides[property] = value;
        }
      } catch (error) {
      }
    }
    if (Object.keys(overrides).length) {
      this.configurationRegistry.registerDefaultConfigurations([{ overrides }]);
    }
  }
};
UpdateExperimentalSettingsDefaults.ID = "workbench.contrib.updateExperimentalSettingsDefaults";
UpdateExperimentalSettingsDefaults = __decorateClass([
  __decorateParam(0, IWorkbenchAssignmentService)
], UpdateExperimentalSettingsDefaults);
const workbenchContributionsRegistry = Registry.as(WorkbenchExtensions.Workbench);
workbenchContributionsRegistry.registerWorkbenchContribution(RegisterConfigurationSchemasContribution, LifecyclePhase.Restored);
workbenchContributionsRegistry.registerWorkbenchContribution(ResetConfigurationDefaultsOverridesCache, LifecyclePhase.Eventually);
registerWorkbenchContribution2(UpdateExperimentalSettingsDefaults.ID, UpdateExperimentalSettingsDefaults, WorkbenchPhase.BlockRestore);
const configurationRegistry = Registry.as(Extensions.Configuration);
configurationRegistry.registerConfiguration({
  ...workbenchConfigurationNodeBase,
  properties: {
    [APPLY_ALL_PROFILES_SETTING]: {
      "type": "array",
      description: localize("setting description", "Configure settings to be applied for all profiles."),
      "default": [],
      "scope": ConfigurationScope.APPLICATION,
      additionalProperties: true,
      uniqueItems: true
    }
  }
});
export {
  WorkspaceService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvY29uZmlndXJhdGlvbi9icm93c2VyL2NvbmZpZ3VyYXRpb25TZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IEV2ZW50LCBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgZXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgUXVldWUsIEJhcnJpZXIsIFByb21pc2VzLCBEZWxheWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgSUpTT05Db250cmlidXRpb25SZWdpc3RyeSwgRXh0ZW5zaW9ucyBhcyBKU09ORXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2pzb25zY2hlbWFzL2NvbW1vbi9qc29uQ29udHJpYnV0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBXb3Jrc3BhY2UgYXMgQmFzZVdvcmtzcGFjZSwgV29ya2JlbmNoU3RhdGUsIElXb3Jrc3BhY2VGb2xkZXIsIElXb3Jrc3BhY2VGb2xkZXJzQ2hhbmdlRXZlbnQsIFdvcmtzcGFjZUZvbGRlciwgdG9Xb3Jrc3BhY2VGb2xkZXIsIGlzV29ya3NwYWNlRm9sZGVyLCBJV29ya3NwYWNlRm9sZGVyc1dpbGxDaGFuZ2VFdmVudCwgSUVtcHR5V29ya3NwYWNlSWRlbnRpZmllciwgSVNpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIsIGlzU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllciwgaXNXb3Jrc3BhY2VJZGVudGlmaWVyLCBJV29ya3NwYWNlSWRlbnRpZmllciwgSUFueVdvcmtzcGFjZUlkZW50aWZpZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uTW9kZWwsIENvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudCwgbWVyZ2VDaGFuZ2VzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbk1vZGVscy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50LCBDb25maWd1cmF0aW9uVGFyZ2V0LCBJQ29uZmlndXJhdGlvbk92ZXJyaWRlcywgaXNDb25maWd1cmF0aW9uT3ZlcnJpZGVzLCBJQ29uZmlndXJhdGlvbkRhdGEsIElDb25maWd1cmF0aW9uVmFsdWUsIElDb25maWd1cmF0aW9uQ2hhbmdlLCBDb25maWd1cmF0aW9uVGFyZ2V0VG9TdHJpbmcsIElDb25maWd1cmF0aW9uVXBkYXRlT3ZlcnJpZGVzLCBpc0NvbmZpZ3VyYXRpb25VcGRhdGVPdmVycmlkZXMsIElDb25maWd1cmF0aW9uU2VydmljZSwgSUNvbmZpZ3VyYXRpb25VcGRhdGVPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUG9saWN5Q29uZmlndXJhdGlvbiwgTnVsbFBvbGljeUNvbmZpZ3VyYXRpb24sIFBvbGljeUNvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uIH0gZnJvbSAnLi4vY29tbW9uL2NvbmZpZ3VyYXRpb25Nb2RlbHMuanMnO1xuaW1wb3J0IHsgRk9MREVSX0NPTkZJR19GT0xERVJfTkFNRSwgZGVmYXVsdFNldHRpbmdzU2NoZW1hSWQsIHVzZXJTZXR0aW5nc1NjaGVtYUlkLCB3b3Jrc3BhY2VTZXR0aW5nc1NjaGVtYUlkLCBmb2xkZXJTZXR0aW5nc1NjaGVtYUlkLCBJQ29uZmlndXJhdGlvbkNhY2hlLCBtYWNoaW5lU2V0dGluZ3NTY2hlbWFJZCwgTE9DQUxfTUFDSElORV9TQ09QRVMsIElXb3JrYmVuY2hDb25maWd1cmF0aW9uU2VydmljZSwgUmVzdHJpY3RlZFNldHRpbmdzLCBQUk9GSUxFX1NDT1BFUywgTE9DQUxfTUFDSElORV9QUk9GSUxFX1NDT1BFUywgcHJvZmlsZVNldHRpbmdzU2NoZW1hSWQsIEFQUExZX0FMTF9QUk9GSUxFU19TRVRUSU5HLCBBUFBMSUNBVElPTl9TQ09QRVMgfSBmcm9tICcuLi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5LCBFeHRlbnNpb25zLCBhbGxTZXR0aW5ncywgd2luZG93U2V0dGluZ3MsIHJlc291cmNlU2V0dGluZ3MsIGFwcGxpY2F0aW9uU2V0dGluZ3MsIG1hY2hpbmVTZXR0aW5ncywgbWFjaGluZU92ZXJyaWRhYmxlU2V0dGluZ3MsIENvbmZpZ3VyYXRpb25TY29wZSwgSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSwga2V5RnJvbU92ZXJyaWRlSWRlbnRpZmllcnMsIE9WRVJSSURFX1BST1BFUlRZX1BBVFRFUk4sIHJlc291cmNlTGFuZ3VhZ2VTZXR0aW5nc1NjaGVtYUlkLCBjb25maWd1cmF0aW9uRGVmYXVsdHNTY2hlbWFJZCwgYXBwbGljYXRpb25NYWNoaW5lU2V0dGluZ3MgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVN0b3JlZFdvcmtzcGFjZUZvbGRlciwgaXNTdG9yZWRXb3Jrc3BhY2VGb2xkZXIsIElXb3Jrc3BhY2VGb2xkZXJDcmVhdGlvbkRhdGEsIGdldFN0b3JlZFdvcmtzcGFjZUZvbGRlciwgdG9Xb3Jrc3BhY2VGb2xkZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlcy9jb21tb24vd29ya3NwYWNlcy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25FZGl0aW5nLCBFZGl0YWJsZUNvbmZpZ3VyYXRpb25UYXJnZXQgfSBmcm9tICcuLi9jb21tb24vY29uZmlndXJhdGlvbkVkaXRpbmcuanMnO1xuaW1wb3J0IHsgV29ya3NwYWNlQ29uZmlndXJhdGlvbiwgRm9sZGVyQ29uZmlndXJhdGlvbiwgUmVtb3RlVXNlckNvbmZpZ3VyYXRpb24sIFVzZXJDb25maWd1cmF0aW9uLCBEZWZhdWx0Q29uZmlndXJhdGlvbiwgQXBwbGljYXRpb25Db25maWd1cmF0aW9uIH0gZnJvbSAnLi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElKU09OU2NoZW1hLCBJSlNPTlNjaGVtYU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0IHsgbWFyayB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BlcmZvcm1hbmNlLmpzJztcbmltcG9ydCB7IElSZW1vdGVBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiwgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeSwgV29ya2JlbmNoUGhhc2UsIEV4dGVuc2lvbnMgYXMgV29ya2JlbmNoRXh0ZW5zaW9ucywgcmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZVNlcnZpY2UsIExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyB0b0Vycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9yTWVzc2FnZS5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2VUcnVzdC5qcyc7XG5pbXBvcnQgeyBkZWx0YSwgZGlzdGluY3QsIGVxdWFscyBhcyBhcnJheUVxdWFscyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBJU3RyaW5nRGljdGlvbmFyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbGxlY3Rpb25zLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQXNzaWdubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9hc3NpZ25tZW50L2NvbW1vbi9hc3NpZ25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBpc1VuZGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IERpZENoYW5nZVVzZXJEYXRhUHJvZmlsZUV2ZW50LCBJVXNlckRhdGFQcm9maWxlU2VydmljZSB9IGZyb20gJy4uLy4uL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IElQb2xpY3lTZXJ2aWNlLCBOdWxsUG9saWN5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3BvbGljeS9jb21tb24vcG9saWN5LmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGUsIElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IElKU09ORWRpdGluZ1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vanNvbkVkaXRpbmcuanMnO1xuaW1wb3J0IHsgSUJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9icm93c2VyL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyB3b3JrYmVuY2hDb25maWd1cmF0aW9uTm9kZUJhc2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBydW5XaGVuV2luZG93SWRsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuXG5mdW5jdGlvbiBnZXRMb2NhbFVzZXJDb25maWd1cmF0aW9uU2NvcGVzKHVzZXJEYXRhUHJvZmlsZTogSVVzZXJEYXRhUHJvZmlsZSwgaGFzUmVtb3RlOiBib29sZWFuKTogQ29uZmlndXJhdGlvblNjb3BlW10gfCB1bmRlZmluZWQge1xuXHRjb25zdCBpc0RlZmF1bHRQcm9maWxlID0gdXNlckRhdGFQcm9maWxlLmlzRGVmYXVsdCB8fCB1c2VyRGF0YVByb2ZpbGUudXNlRGVmYXVsdEZsYWdzPy5zZXR0aW5ncztcblx0aWYgKGlzRGVmYXVsdFByb2ZpbGUpIHtcblx0XHRyZXR1cm4gaGFzUmVtb3RlID8gTE9DQUxfTUFDSElORV9TQ09QRVMgOiB1bmRlZmluZWQ7XG5cdH1cblx0cmV0dXJuIGhhc1JlbW90ZSA/IExPQ0FMX01BQ0hJTkVfUFJPRklMRV9TQ09QRVMgOiBQUk9GSUxFX1NDT1BFUztcbn1cblxuY2xhc3MgV29ya3NwYWNlIGV4dGVuZHMgQmFzZVdvcmtzcGFjZSB7XG5cdGluaXRpYWxpemVkOiBib29sZWFuID0gZmFsc2U7XG59XG5cbmV4cG9ydCBjbGFzcyBXb3Jrc3BhY2VTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb25maWd1cmF0aW9uU2VydmljZSwgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHtcblxuXHRwdWJsaWMgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgd29ya3NwYWNlITogV29ya3NwYWNlO1xuXHRwcml2YXRlIGluaXRSZW1vdGVVc2VyQ29uZmlndXJhdGlvbkJhcnJpZXI6IEJhcnJpZXI7XG5cdHByaXZhdGUgY29tcGxldGVXb3Jrc3BhY2VCYXJyaWVyOiBCYXJyaWVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25DYWNoZTogSUNvbmZpZ3VyYXRpb25DYWNoZTtcblx0cHJpdmF0ZSBfY29uZmlndXJhdGlvbjogQ29uZmlndXJhdGlvbjtcblx0cHJpdmF0ZSBpbml0aWFsaXplZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IGRlZmF1bHRDb25maWd1cmF0aW9uOiBEZWZhdWx0Q29uZmlndXJhdGlvbjtcblx0cHJpdmF0ZSByZWFkb25seSBwb2xpY3lDb25maWd1cmF0aW9uOiBJUG9saWN5Q29uZmlndXJhdGlvbjtcblx0cHJpdmF0ZSBhcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb246IEFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbiB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHJlYWRvbmx5IGFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbkRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdHByaXZhdGUgcmVhZG9ubHkgbG9jYWxVc2VyQ29uZmlndXJhdGlvbjogVXNlckNvbmZpZ3VyYXRpb247XG5cdHByaXZhdGUgcmVhZG9ubHkgcmVtb3RlVXNlckNvbmZpZ3VyYXRpb246IFJlbW90ZVVzZXJDb25maWd1cmF0aW9uIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlQ29uZmlndXJhdGlvbjogV29ya3NwYWNlQ29uZmlndXJhdGlvbjtcblx0cHJpdmF0ZSBjYWNoZWRGb2xkZXJDb25maWdzOiBSZXNvdXJjZU1hcDxGb2xkZXJDb25maWd1cmF0aW9uPjtcblx0cHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VFZGl0aW5nUXVldWU6IFF1ZXVlPHZvaWQ+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbjogRW1pdHRlcjxJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50PiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElDb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uOiBFdmVudDxJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50PiA9IHRoaXMuX29uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbi5ldmVudDtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uV2lsbENoYW5nZVdvcmtzcGFjZUZvbGRlcnM6IEVtaXR0ZXI8SVdvcmtzcGFjZUZvbGRlcnNXaWxsQ2hhbmdlRXZlbnQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVdvcmtzcGFjZUZvbGRlcnNXaWxsQ2hhbmdlRXZlbnQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25XaWxsQ2hhbmdlV29ya3NwYWNlRm9sZGVyczogRXZlbnQ8SVdvcmtzcGFjZUZvbGRlcnNXaWxsQ2hhbmdlRXZlbnQ+ID0gdGhpcy5fb25XaWxsQ2hhbmdlV29ya3NwYWNlRm9sZGVycy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVdvcmtzcGFjZUZvbGRlcnM6IEVtaXR0ZXI8SVdvcmtzcGFjZUZvbGRlcnNDaGFuZ2VFdmVudD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJV29ya3NwYWNlRm9sZGVyc0NoYW5nZUV2ZW50PigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlV29ya3NwYWNlRm9sZGVyczogRXZlbnQ8SVdvcmtzcGFjZUZvbGRlcnNDaGFuZ2VFdmVudD4gPSB0aGlzLl9vbkRpZENoYW5nZVdvcmtzcGFjZUZvbGRlcnMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VXb3Jrc3BhY2VOYW1lOiBFbWl0dGVyPHZvaWQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZVdvcmtzcGFjZU5hbWU6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VXb3Jrc3BhY2VOYW1lLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlV29ya2JlbmNoU3RhdGU6IEVtaXR0ZXI8V29ya2JlbmNoU3RhdGU+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8V29ya2JlbmNoU3RhdGU+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VXb3JrYmVuY2hTdGF0ZTogRXZlbnQ8V29ya2JlbmNoU3RhdGU+ID0gdGhpcy5fb25EaWRDaGFuZ2VXb3JrYmVuY2hTdGF0ZS5ldmVudDtcblxuXHRwcml2YXRlIGlzV29ya3NwYWNlVHJ1c3RlZDogYm9vbGVhbiA9IHRydWU7XG5cblx0cHJpdmF0ZSBfcmVzdHJpY3RlZFNldHRpbmdzOiBSZXN0cmljdGVkU2V0dGluZ3MgPSB7IGRlZmF1bHQ6IFtdIH07XG5cdGdldCByZXN0cmljdGVkU2V0dGluZ3MoKSB7IHJldHVybiB0aGlzLl9yZXN0cmljdGVkU2V0dGluZ3M7IH1cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VSZXN0cmljdGVkU2V0dGluZ3MgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxSZXN0cmljdGVkU2V0dGluZ3M+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VSZXN0cmljdGVkU2V0dGluZ3MgPSB0aGlzLl9vbkRpZENoYW5nZVJlc3RyaWN0ZWRTZXR0aW5ncy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25SZWdpc3RyeTogSUNvbmZpZ3VyYXRpb25SZWdpc3RyeTtcblxuXHRwcml2YXRlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgY29uZmlndXJhdGlvbkVkaXRpbmc6IFByb21pc2U8Q29uZmlndXJhdGlvbkVkaXRpbmc+IHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHsgcmVtb3RlQXV0aG9yaXR5LCBjb25maWd1cmF0aW9uQ2FjaGUgfTogeyByZW1vdGVBdXRob3JpdHk/OiBzdHJpbmc7IGNvbmZpZ3VyYXRpb25DYWNoZTogSUNvbmZpZ3VyYXRpb25DYWNoZSB9LFxuXHRcdGVudmlyb25tZW50U2VydmljZTogSUJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgcmVtb3RlQWdlbnRTZXJ2aWNlOiBJUmVtb3RlQWdlbnRTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0cG9saWN5U2VydmljZTogSVBvbGljeVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuY29uZmlndXJhdGlvblJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKTtcblxuXHRcdHRoaXMuaW5pdFJlbW90ZVVzZXJDb25maWd1cmF0aW9uQmFycmllciA9IG5ldyBCYXJyaWVyKCk7XG5cdFx0dGhpcy5jb21wbGV0ZVdvcmtzcGFjZUJhcnJpZXIgPSBuZXcgQmFycmllcigpO1xuXHRcdHRoaXMuZGVmYXVsdENvbmZpZ3VyYXRpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRGVmYXVsdENvbmZpZ3VyYXRpb24oY29uZmlndXJhdGlvbkNhY2hlLCBlbnZpcm9ubWVudFNlcnZpY2UsIGxvZ1NlcnZpY2UpKTtcblx0XHR0aGlzLnBvbGljeUNvbmZpZ3VyYXRpb24gPSBwb2xpY3lTZXJ2aWNlIGluc3RhbmNlb2YgTnVsbFBvbGljeVNlcnZpY2UgPyBuZXcgTnVsbFBvbGljeUNvbmZpZ3VyYXRpb24oKSA6IHRoaXMuX3JlZ2lzdGVyKG5ldyBQb2xpY3lDb25maWd1cmF0aW9uKHRoaXMuZGVmYXVsdENvbmZpZ3VyYXRpb24sIHBvbGljeVNlcnZpY2UsIGxvZ1NlcnZpY2UpKTtcblx0XHR0aGlzLmNvbmZpZ3VyYXRpb25DYWNoZSA9IGNvbmZpZ3VyYXRpb25DYWNoZTtcblx0XHR0aGlzLl9jb25maWd1cmF0aW9uID0gbmV3IENvbmZpZ3VyYXRpb24odGhpcy5kZWZhdWx0Q29uZmlndXJhdGlvbi5jb25maWd1cmF0aW9uTW9kZWwsIHRoaXMucG9saWN5Q29uZmlndXJhdGlvbi5jb25maWd1cmF0aW9uTW9kZWwsIENvbmZpZ3VyYXRpb25Nb2RlbC5jcmVhdGVFbXB0eU1vZGVsKGxvZ1NlcnZpY2UpLCBDb25maWd1cmF0aW9uTW9kZWwuY3JlYXRlRW1wdHlNb2RlbChsb2dTZXJ2aWNlKSwgQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwobG9nU2VydmljZSksIENvbmZpZ3VyYXRpb25Nb2RlbC5jcmVhdGVFbXB0eU1vZGVsKGxvZ1NlcnZpY2UpLCBuZXcgUmVzb3VyY2VNYXAoKSwgQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwobG9nU2VydmljZSksIG5ldyBSZXNvdXJjZU1hcDxDb25maWd1cmF0aW9uTW9kZWw+KCksIHRoaXMud29ya3NwYWNlLCBsb2dTZXJ2aWNlKTtcblx0XHR0aGlzLmFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbkRpc3Bvc2FibGVzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0XHR0aGlzLmNyZWF0ZUFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbigpO1xuXHRcdHRoaXMubG9jYWxVc2VyQ29uZmlndXJhdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBVc2VyQ29uZmlndXJhdGlvbih1c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLnNldHRpbmdzUmVzb3VyY2UsIHVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUudGFza3NSZXNvdXJjZSwgeyBzY29wZXM6IGdldExvY2FsVXNlckNvbmZpZ3VyYXRpb25TY29wZXModXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZSwgISFyZW1vdGVBdXRob3JpdHkpIH0sIGZpbGVTZXJ2aWNlLCB1cmlJZGVudGl0eVNlcnZpY2UsIGxvZ1NlcnZpY2UpKTtcblx0XHR0aGlzLmNhY2hlZEZvbGRlckNvbmZpZ3MgPSBuZXcgUmVzb3VyY2VNYXA8Rm9sZGVyQ29uZmlndXJhdGlvbj4oKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmxvY2FsVXNlckNvbmZpZ3VyYXRpb24ub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKHVzZXJDb25maWd1cmF0aW9uID0+IHRoaXMub25Mb2NhbFVzZXJDb25maWd1cmF0aW9uQ2hhbmdlZCh1c2VyQ29uZmlndXJhdGlvbikpKTtcblx0XHRpZiAocmVtb3RlQXV0aG9yaXR5KSB7XG5cdFx0XHRjb25zdCByZW1vdGVVc2VyQ29uZmlndXJhdGlvbiA9IHRoaXMucmVtb3RlVXNlckNvbmZpZ3VyYXRpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgUmVtb3RlVXNlckNvbmZpZ3VyYXRpb24ocmVtb3RlQXV0aG9yaXR5LCBjb25maWd1cmF0aW9uQ2FjaGUsIGZpbGVTZXJ2aWNlLCB1cmlJZGVudGl0eVNlcnZpY2UsIHJlbW90ZUFnZW50U2VydmljZSwgbG9nU2VydmljZSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIocmVtb3RlVXNlckNvbmZpZ3VyYXRpb24ub25EaWRJbml0aWFsaXplKHJlbW90ZVVzZXJDb25maWd1cmF0aW9uTW9kZWwgPT4ge1xuXHRcdFx0XHR0aGlzLl9yZWdpc3RlcihyZW1vdGVVc2VyQ29uZmlndXJhdGlvbi5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24ocmVtb3RlVXNlckNvbmZpZ3VyYXRpb25Nb2RlbCA9PiB0aGlzLm9uUmVtb3RlVXNlckNvbmZpZ3VyYXRpb25DaGFuZ2VkKHJlbW90ZVVzZXJDb25maWd1cmF0aW9uTW9kZWwpKSk7XG5cdFx0XHRcdHRoaXMub25SZW1vdGVVc2VyQ29uZmlndXJhdGlvbkNoYW5nZWQocmVtb3RlVXNlckNvbmZpZ3VyYXRpb25Nb2RlbCk7XG5cdFx0XHRcdHRoaXMuaW5pdFJlbW90ZVVzZXJDb25maWd1cmF0aW9uQmFycmllci5vcGVuKCk7XG5cdFx0XHR9KSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuaW5pdFJlbW90ZVVzZXJDb25maWd1cmF0aW9uQmFycmllci5vcGVuKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy53b3Jrc3BhY2VDb25maWd1cmF0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IFdvcmtzcGFjZUNvbmZpZ3VyYXRpb24oY29uZmlndXJhdGlvbkNhY2hlLCBmaWxlU2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlLCBsb2dTZXJ2aWNlKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53b3Jrc3BhY2VDb25maWd1cmF0aW9uLm9uRGlkVXBkYXRlQ29uZmlndXJhdGlvbihmcm9tQ2FjaGUgPT4ge1xuXHRcdFx0dGhpcy5vbldvcmtzcGFjZUNvbmZpZ3VyYXRpb25DaGFuZ2VkKGZyb21DYWNoZSkudGhlbigoKSA9PiB7XG5cdFx0XHRcdHRoaXMud29ya3NwYWNlLmluaXRpYWxpemVkID0gdGhpcy53b3Jrc3BhY2VDb25maWd1cmF0aW9uLmluaXRpYWxpemVkO1xuXHRcdFx0XHR0aGlzLmNoZWNrQW5kTWFya1dvcmtzcGFjZUNvbXBsZXRlKGZyb21DYWNoZSk7XG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmRlZmF1bHRDb25maWd1cmF0aW9uLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbigoeyBwcm9wZXJ0aWVzLCBkZWZhdWx0cyB9KSA9PiB0aGlzLm9uRGVmYXVsdENvbmZpZ3VyYXRpb25DaGFuZ2VkKGRlZmF1bHRzLCBwcm9wZXJ0aWVzKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucG9saWN5Q29uZmlndXJhdGlvbi5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oY29uZmlndXJhdGlvbk1vZGVsID0+IHRoaXMub25Qb2xpY3lDb25maWd1cmF0aW9uQ2hhbmdlZChjb25maWd1cmF0aW9uTW9kZWwpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodXNlckRhdGFQcm9maWxlU2VydmljZS5vbkRpZENoYW5nZUN1cnJlbnRQcm9maWxlKGUgPT4gdGhpcy5vblVzZXJEYXRhUHJvZmlsZUNoYW5nZWQoZSkpKTtcblxuXHRcdHRoaXMud29ya3NwYWNlRWRpdGluZ1F1ZXVlID0gbmV3IFF1ZXVlPHZvaWQ+KCk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbigpOiB2b2lkIHtcblx0XHR0aGlzLmFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbkRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0aWYgKHRoaXMudXNlckRhdGFQcm9maWxlU2VydmljZS5jdXJyZW50UHJvZmlsZS5pc0RlZmF1bHQgfHwgdGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLnVzZURlZmF1bHRGbGFncz8uc2V0dGluZ3MpIHtcblx0XHRcdHRoaXMuYXBwbGljYXRpb25Db25maWd1cmF0aW9uID0gbnVsbDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5hcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb24gPSB0aGlzLmFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbkRpc3Bvc2FibGVzLmFkZCh0aGlzLl9yZWdpc3RlcihuZXcgQXBwbGljYXRpb25Db25maWd1cmF0aW9uKHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UsIHRoaXMuZmlsZVNlcnZpY2UsIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLCB0aGlzLmxvZ1NlcnZpY2UpKSk7XG5cdFx0XHR0aGlzLmFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbkRpc3Bvc2FibGVzLmFkZCh0aGlzLmFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbi5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oY29uZmlndXJhdGlvbk1vZGVsID0+IHRoaXMub25BcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb25DaGFuZ2VkKGNvbmZpZ3VyYXRpb25Nb2RlbCkpKTtcblx0XHR9XG5cdH1cblxuXHQvLyBXb3Jrc3BhY2UgQ29udGV4dCBTZXJ2aWNlIEltcGxcblxuXHRwdWJsaWMgYXN5bmMgZ2V0Q29tcGxldGVXb3Jrc3BhY2UoKTogUHJvbWlzZTxXb3Jrc3BhY2U+IHtcblx0XHRhd2FpdCB0aGlzLmNvbXBsZXRlV29ya3NwYWNlQmFycmllci53YWl0KCk7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0V29ya3NwYWNlKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0V29ya3NwYWNlKCk6IFdvcmtzcGFjZSB7XG5cdFx0cmV0dXJuIHRoaXMud29ya3NwYWNlO1xuXHR9XG5cblx0cHVibGljIGdldFdvcmtiZW5jaFN0YXRlKCk6IFdvcmtiZW5jaFN0YXRlIHtcblx0XHQvLyBXb3Jrc3BhY2UgaGFzIGNvbmZpZ3VyYXRpb24gZmlsZVxuXHRcdGlmICh0aGlzLndvcmtzcGFjZS5jb25maWd1cmF0aW9uKSB7XG5cdFx0XHRyZXR1cm4gV29ya2JlbmNoU3RhdGUuV09SS1NQQUNFO1xuXHRcdH1cblxuXHRcdC8vIEZvbGRlciBoYXMgc2luZ2xlIHJvb3Rcblx0XHRpZiAodGhpcy53b3Jrc3BhY2UuZm9sZGVycy5sZW5ndGggPT09IDEpIHtcblx0XHRcdHJldHVybiBXb3JrYmVuY2hTdGF0ZS5GT0xERVI7XG5cdFx0fVxuXG5cdFx0Ly8gRW1wdHlcblx0XHRyZXR1cm4gV29ya2JlbmNoU3RhdGUuRU1QVFk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0V29ya3NwYWNlRm9sZGVyKHJlc291cmNlOiBVUkkpOiBJV29ya3NwYWNlRm9sZGVyIHwgbnVsbCB7XG5cdFx0cmV0dXJuIHRoaXMud29ya3NwYWNlLmdldEZvbGRlcihyZXNvdXJjZSk7XG5cdH1cblxuXHRwdWJsaWMgYWRkRm9sZGVycyhmb2xkZXJzVG9BZGQ6IElXb3Jrc3BhY2VGb2xkZXJDcmVhdGlvbkRhdGFbXSwgaW5kZXg/OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy51cGRhdGVGb2xkZXJzKGZvbGRlcnNUb0FkZCwgW10sIGluZGV4KTtcblx0fVxuXG5cdHB1YmxpYyByZW1vdmVGb2xkZXJzKGZvbGRlcnNUb1JlbW92ZTogVVJJW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy51cGRhdGVGb2xkZXJzKFtdLCBmb2xkZXJzVG9SZW1vdmUpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHVwZGF0ZUZvbGRlcnMoZm9sZGVyc1RvQWRkOiBJV29ya3NwYWNlRm9sZGVyQ3JlYXRpb25EYXRhW10sIGZvbGRlcnNUb1JlbW92ZTogVVJJW10sIGluZGV4PzogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMud29ya3NwYWNlRWRpdGluZ1F1ZXVlLnF1ZXVlKCgpID0+IHRoaXMuZG9VcGRhdGVGb2xkZXJzKGZvbGRlcnNUb0FkZCwgZm9sZGVyc1RvUmVtb3ZlLCBpbmRleCkpO1xuXHR9XG5cblx0cHVibGljIGlzSW5zaWRlV29ya3NwYWNlKHJlc291cmNlOiBVUkkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLmdldFdvcmtzcGFjZUZvbGRlcihyZXNvdXJjZSk7XG5cdH1cblxuXHRwdWJsaWMgaXNDdXJyZW50V29ya3NwYWNlKHdvcmtzcGFjZUlkT3JGb2xkZXI6IElXb3Jrc3BhY2VJZGVudGlmaWVyIHwgSVNpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIgfCBVUkkpOiBib29sZWFuIHtcblx0XHRzd2l0Y2ggKHRoaXMuZ2V0V29ya2JlbmNoU3RhdGUoKSkge1xuXHRcdFx0Y2FzZSBXb3JrYmVuY2hTdGF0ZS5GT0xERVI6IHtcblx0XHRcdFx0bGV0IGZvbGRlclVyaTogVVJJIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAoVVJJLmlzVXJpKHdvcmtzcGFjZUlkT3JGb2xkZXIpKSB7XG5cdFx0XHRcdFx0Zm9sZGVyVXJpID0gd29ya3NwYWNlSWRPckZvbGRlcjtcblx0XHRcdFx0fSBlbHNlIGlmIChpc1NpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIod29ya3NwYWNlSWRPckZvbGRlcikpIHtcblx0XHRcdFx0XHRmb2xkZXJVcmkgPSB3b3Jrc3BhY2VJZE9yRm9sZGVyLnVyaTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBVUkkuaXNVcmkoZm9sZGVyVXJpKSAmJiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChmb2xkZXJVcmksIHRoaXMud29ya3NwYWNlLmZvbGRlcnNbMF0udXJpKTtcblx0XHRcdH1cblx0XHRcdGNhc2UgV29ya2JlbmNoU3RhdGUuV09SS1NQQUNFOlxuXHRcdFx0XHRyZXR1cm4gaXNXb3Jrc3BhY2VJZGVudGlmaWVyKHdvcmtzcGFjZUlkT3JGb2xkZXIpICYmIHRoaXMud29ya3NwYWNlLmlkID09PSB3b3Jrc3BhY2VJZE9yRm9sZGVyLmlkO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGRvVXBkYXRlRm9sZGVycyhmb2xkZXJzVG9BZGQ6IElXb3Jrc3BhY2VGb2xkZXJDcmVhdGlvbkRhdGFbXSwgZm9sZGVyc1RvUmVtb3ZlOiBVUklbXSwgaW5kZXg/OiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5nZXRXb3JrYmVuY2hTdGF0ZSgpICE9PSBXb3JrYmVuY2hTdGF0ZS5XT1JLU1BBQ0UpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTsgLy8gd2UgbmVlZCBhIHdvcmtzcGFjZSB0byBiZWdpbiB3aXRoXG5cdFx0fVxuXG5cdFx0aWYgKGZvbGRlcnNUb0FkZC5sZW5ndGggKyBmb2xkZXJzVG9SZW1vdmUubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7IC8vIG5vdGhpbmcgdG8gZG9cblx0XHR9XG5cblx0XHRsZXQgZm9sZGVyc0hhdmVDaGFuZ2VkID0gZmFsc2U7XG5cblx0XHQvLyBSZW1vdmUgZmlyc3QgKGlmIGFueSlcblx0XHRsZXQgY3VycmVudFdvcmtzcGFjZUZvbGRlcnMgPSB0aGlzLmdldFdvcmtzcGFjZSgpLmZvbGRlcnM7XG5cdFx0bGV0IG5ld1N0b3JlZEZvbGRlcnM6IElTdG9yZWRXb3Jrc3BhY2VGb2xkZXJbXSA9IGN1cnJlbnRXb3Jrc3BhY2VGb2xkZXJzLm1hcChmID0+IGYucmF3KS5maWx0ZXIoKGZvbGRlciwgaW5kZXgpOiBmb2xkZXIgaXMgSVN0b3JlZFdvcmtzcGFjZUZvbGRlciA9PiB7XG5cdFx0XHRpZiAoIWlzU3RvcmVkV29ya3NwYWNlRm9sZGVyKGZvbGRlcikpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7IC8vIGtlZXAgZW50cmllcyB3aGljaCBhcmUgdW5yZWxhdGVkXG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiAhdGhpcy5jb250YWlucyhmb2xkZXJzVG9SZW1vdmUsIGN1cnJlbnRXb3Jrc3BhY2VGb2xkZXJzW2luZGV4XS51cmkpOyAvLyBrZWVwIGVudHJpZXMgd2hpY2ggYXJlIHVucmVsYXRlZFxuXHRcdH0pO1xuXG5cdFx0Zm9sZGVyc0hhdmVDaGFuZ2VkID0gY3VycmVudFdvcmtzcGFjZUZvbGRlcnMubGVuZ3RoICE9PSBuZXdTdG9yZWRGb2xkZXJzLmxlbmd0aDtcblxuXHRcdC8vIEFkZCBhZnRlcndhcmRzIChpZiBhbnkpXG5cdFx0aWYgKGZvbGRlcnNUb0FkZC5sZW5ndGgpIHtcblxuXHRcdFx0Ly8gUmVjb21wdXRlIGN1cnJlbnQgd29ya3NwYWNlIGZvbGRlcnMgaWYgd2UgaGF2ZSBmb2xkZXJzIHRvIGFkZFxuXHRcdFx0Y29uc3Qgd29ya3NwYWNlQ29uZmlnUGF0aCA9IHRoaXMuZ2V0V29ya3NwYWNlKCkuY29uZmlndXJhdGlvbiE7XG5cdFx0XHRjb25zdCB3b3Jrc3BhY2VDb25maWdGb2xkZXIgPSB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuZGlybmFtZSh3b3Jrc3BhY2VDb25maWdQYXRoKTtcblx0XHRcdGN1cnJlbnRXb3Jrc3BhY2VGb2xkZXJzID0gdG9Xb3Jrc3BhY2VGb2xkZXJzKG5ld1N0b3JlZEZvbGRlcnMsIHdvcmtzcGFjZUNvbmZpZ1BhdGgsIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaSk7XG5cdFx0XHRjb25zdCBjdXJyZW50V29ya3NwYWNlRm9sZGVyVXJpcyA9IGN1cnJlbnRXb3Jrc3BhY2VGb2xkZXJzLm1hcChmb2xkZXIgPT4gZm9sZGVyLnVyaSk7XG5cblx0XHRcdGNvbnN0IHN0b3JlZEZvbGRlcnNUb0FkZDogSVN0b3JlZFdvcmtzcGFjZUZvbGRlcltdID0gW107XG5cblx0XHRcdGZvciAoY29uc3QgZm9sZGVyVG9BZGQgb2YgZm9sZGVyc1RvQWRkKSB7XG5cdFx0XHRcdGNvbnN0IGZvbGRlclVSSSA9IGZvbGRlclRvQWRkLnVyaTtcblx0XHRcdFx0aWYgKHRoaXMuY29udGFpbnMoY3VycmVudFdvcmtzcGFjZUZvbGRlclVyaXMsIGZvbGRlclVSSSkpIHtcblx0XHRcdFx0XHRjb250aW51ZTsgLy8gYWxyZWFkeSBleGlzdGluZ1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5zdGF0KGZvbGRlclVSSSk7XG5cdFx0XHRcdFx0aWYgKCFyZXN1bHQuaXNEaXJlY3RvcnkpIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBjYXRjaCAoZSkgeyAvKiBJZ25vcmUgKi8gfVxuXHRcdFx0XHRzdG9yZWRGb2xkZXJzVG9BZGQucHVzaChnZXRTdG9yZWRXb3Jrc3BhY2VGb2xkZXIoZm9sZGVyVVJJLCBmYWxzZSwgZm9sZGVyVG9BZGQubmFtZSwgd29ya3NwYWNlQ29uZmlnRm9sZGVyLCB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkpKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQXBwbHkgdG8gYXJyYXkgb2YgbmV3U3RvcmVkRm9sZGVyc1xuXHRcdFx0aWYgKHN0b3JlZEZvbGRlcnNUb0FkZC5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGZvbGRlcnNIYXZlQ2hhbmdlZCA9IHRydWU7XG5cblx0XHRcdFx0aWYgKHR5cGVvZiBpbmRleCA9PT0gJ251bWJlcicgJiYgaW5kZXggPj0gMCAmJiBpbmRleCA8IG5ld1N0b3JlZEZvbGRlcnMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0bmV3U3RvcmVkRm9sZGVycyA9IG5ld1N0b3JlZEZvbGRlcnMuc2xpY2UoMCk7XG5cdFx0XHRcdFx0bmV3U3RvcmVkRm9sZGVycy5zcGxpY2UoaW5kZXgsIDAsIC4uLnN0b3JlZEZvbGRlcnNUb0FkZCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bmV3U3RvcmVkRm9sZGVycyA9IFsuLi5uZXdTdG9yZWRGb2xkZXJzLCAuLi5zdG9yZWRGb2xkZXJzVG9BZGRdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gU2V0IGZvbGRlcnMgaWYgd2UgcmVjb3JkZWQgYSBjaGFuZ2Vcblx0XHRpZiAoZm9sZGVyc0hhdmVDaGFuZ2VkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5zZXRGb2xkZXJzKG5ld1N0b3JlZEZvbGRlcnMpO1xuXHRcdH1cblxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2V0Rm9sZGVycyhmb2xkZXJzOiBJU3RvcmVkV29ya3NwYWNlRm9sZGVyW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IHVwZGF0ZSB3b3Jrc3BhY2UgZm9sZGVycyBiZWNhdXNlIHdvcmtzcGFjZSBzZXJ2aWNlIGlzIG5vdCB5ZXQgcmVhZHkgdG8gYWNjZXB0IHdyaXRlcy4nKTtcblx0XHR9XG5cblx0XHRhd2FpdCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IHRoaXMud29ya3NwYWNlQ29uZmlndXJhdGlvbi5zZXRGb2xkZXJzKGZvbGRlcnMsIGFjY2Vzc29yLmdldChJSlNPTkVkaXRpbmdTZXJ2aWNlKSkpO1xuXHRcdHJldHVybiB0aGlzLm9uV29ya3NwYWNlQ29uZmlndXJhdGlvbkNoYW5nZWQoZmFsc2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBjb250YWlucyhyZXNvdXJjZXM6IFVSSVtdLCB0b0NoZWNrOiBVUkkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gcmVzb3VyY2VzLnNvbWUocmVzb3VyY2UgPT4gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwocmVzb3VyY2UsIHRvQ2hlY2spKTtcblx0fVxuXG5cdC8vIFdvcmtzcGFjZSBDb25maWd1cmF0aW9uIFNlcnZpY2UgSW1wbFxuXG5cdGdldENvbmZpZ3VyYXRpb25EYXRhKCk6IElDb25maWd1cmF0aW9uRGF0YSB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbmZpZ3VyYXRpb24udG9EYXRhKCk7XG5cdH1cblxuXHRnZXRWYWx1ZTxUPigpOiBUO1xuXHRnZXRWYWx1ZTxUPihzZWN0aW9uOiBzdHJpbmcpOiBUO1xuXHRnZXRWYWx1ZTxUPihvdmVycmlkZXM6IElDb25maWd1cmF0aW9uT3ZlcnJpZGVzKTogVDtcblx0Z2V0VmFsdWU8VD4oc2VjdGlvbjogc3RyaW5nLCBvdmVycmlkZXM6IElDb25maWd1cmF0aW9uT3ZlcnJpZGVzKTogVDtcblx0Z2V0VmFsdWUoYXJnMT86IGFueSwgYXJnMj86IGFueSk6IGFueSB7XG5cdFx0Y29uc3Qgc2VjdGlvbiA9IHR5cGVvZiBhcmcxID09PSAnc3RyaW5nJyA/IGFyZzEgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3Qgb3ZlcnJpZGVzID0gaXNDb25maWd1cmF0aW9uT3ZlcnJpZGVzKGFyZzEpID8gYXJnMSA6IGlzQ29uZmlndXJhdGlvbk92ZXJyaWRlcyhhcmcyKSA/IGFyZzIgOiB1bmRlZmluZWQ7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbmZpZ3VyYXRpb24uZ2V0VmFsdWUoc2VjdGlvbiwgb3ZlcnJpZGVzKTtcblx0fVxuXG5cdHVwZGF0ZVZhbHVlKGtleTogc3RyaW5nLCB2YWx1ZTogYW55KTogUHJvbWlzZTx2b2lkPjtcblx0dXBkYXRlVmFsdWUoa2V5OiBzdHJpbmcsIHZhbHVlOiBhbnksIG92ZXJyaWRlczogSUNvbmZpZ3VyYXRpb25PdmVycmlkZXMgfCBJQ29uZmlndXJhdGlvblVwZGF0ZU92ZXJyaWRlcyk6IFByb21pc2U8dm9pZD47XG5cdHVwZGF0ZVZhbHVlKGtleTogc3RyaW5nLCB2YWx1ZTogYW55LCB0YXJnZXQ6IENvbmZpZ3VyYXRpb25UYXJnZXQpOiBQcm9taXNlPHZvaWQ+O1xuXHR1cGRhdGVWYWx1ZShrZXk6IHN0cmluZywgdmFsdWU6IGFueSwgb3ZlcnJpZGVzOiBJQ29uZmlndXJhdGlvbk92ZXJyaWRlcyB8IElDb25maWd1cmF0aW9uVXBkYXRlT3ZlcnJpZGVzLCB0YXJnZXQ6IENvbmZpZ3VyYXRpb25UYXJnZXQsIG9wdGlvbnM/OiBJQ29uZmlndXJhdGlvblVwZGF0ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+O1xuXHRhc3luYyB1cGRhdGVWYWx1ZShrZXk6IHN0cmluZywgdmFsdWU6IGFueSwgYXJnMz86IGFueSwgYXJnND86IGFueSwgb3B0aW9ucz86IGFueSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IG92ZXJyaWRlczogSUNvbmZpZ3VyYXRpb25VcGRhdGVPdmVycmlkZXMgfCB1bmRlZmluZWQgPSBpc0NvbmZpZ3VyYXRpb25VcGRhdGVPdmVycmlkZXMoYXJnMykgPyBhcmczXG5cdFx0XHQ6IGlzQ29uZmlndXJhdGlvbk92ZXJyaWRlcyhhcmczKSA/IHsgcmVzb3VyY2U6IGFyZzMucmVzb3VyY2UsIG92ZXJyaWRlSWRlbnRpZmllcnM6IGFyZzMub3ZlcnJpZGVJZGVudGlmaWVyID8gW2FyZzMub3ZlcnJpZGVJZGVudGlmaWVyXSA6IHVuZGVmaW5lZCB9IDogdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHRhcmdldDogQ29uZmlndXJhdGlvblRhcmdldCB8IHVuZGVmaW5lZCA9IG92ZXJyaWRlcyA/IGFyZzQgOiBhcmczO1xuXHRcdGNvbnN0IHRhcmdldHM6IENvbmZpZ3VyYXRpb25UYXJnZXRbXSA9IHRhcmdldCA/IFt0YXJnZXRdIDogW107XG5cblx0XHRpZiAob3ZlcnJpZGVzPy5vdmVycmlkZUlkZW50aWZpZXJzKSB7XG5cdFx0XHRvdmVycmlkZXMub3ZlcnJpZGVJZGVudGlmaWVycyA9IGRpc3RpbmN0KG92ZXJyaWRlcy5vdmVycmlkZUlkZW50aWZpZXJzKTtcblx0XHRcdG92ZXJyaWRlcy5vdmVycmlkZUlkZW50aWZpZXJzID0gb3ZlcnJpZGVzLm92ZXJyaWRlSWRlbnRpZmllcnMubGVuZ3RoID8gb3ZlcnJpZGVzLm92ZXJyaWRlSWRlbnRpZmllcnMgOiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKCF0YXJnZXRzLmxlbmd0aCkge1xuXHRcdFx0aWYgKG92ZXJyaWRlcz8ub3ZlcnJpZGVJZGVudGlmaWVycyAmJiBvdmVycmlkZXMub3ZlcnJpZGVJZGVudGlmaWVycy5sZW5ndGggPiAxKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignQ29uZmlndXJhdGlvbiBUYXJnZXQgaXMgcmVxdWlyZWQgd2hpbGUgdXBkYXRpbmcgdGhlIHZhbHVlIGZvciBtdWx0aXBsZSBvdmVycmlkZSBpZGVudGlmaWVycycpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgaW5zcGVjdCA9IHRoaXMuaW5zcGVjdChrZXksIHsgcmVzb3VyY2U6IG92ZXJyaWRlcz8ucmVzb3VyY2UsIG92ZXJyaWRlSWRlbnRpZmllcjogb3ZlcnJpZGVzPy5vdmVycmlkZUlkZW50aWZpZXJzID8gb3ZlcnJpZGVzLm92ZXJyaWRlSWRlbnRpZmllcnNbMF0gOiB1bmRlZmluZWQgfSk7XG5cdFx0XHR0YXJnZXRzLnB1c2goLi4udGhpcy5kZXJpdmVDb25maWd1cmF0aW9uVGFyZ2V0cyhrZXksIHZhbHVlLCBpbnNwZWN0KSk7XG5cblx0XHRcdC8vIFJlbW92ZSB0aGUgc2V0dGluZywgaWYgdGhlIHZhbHVlIGlzIHNhbWUgYXMgZGVmYXVsdCB2YWx1ZSBhbmQgaXMgdXBkYXRlZCBvbmx5IGluIHVzZXIgdGFyZ2V0XG5cdFx0XHRpZiAoZXF1YWxzKHZhbHVlLCBpbnNwZWN0LmRlZmF1bHRWYWx1ZSkgJiYgdGFyZ2V0cy5sZW5ndGggPT09IDEgJiYgKHRhcmdldHNbMF0gPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUiB8fCB0YXJnZXRzWzBdID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUwpKSB7XG5cdFx0XHRcdHZhbHVlID0gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGF3YWl0IFByb21pc2VzLnNldHRsZWQodGFyZ2V0cy5tYXAodGFyZ2V0ID0+IHRoaXMud3JpdGVDb25maWd1cmF0aW9uVmFsdWUoa2V5LCB2YWx1ZSwgdGFyZ2V0LCBvdmVycmlkZXMsIG9wdGlvbnMpKSk7XG5cdH1cblxuXHRhc3luYyByZWxvYWRDb25maWd1cmF0aW9uKHRhcmdldD86IENvbmZpZ3VyYXRpb25UYXJnZXQgfCBJV29ya3NwYWNlRm9sZGVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRhcmdldCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLnJlbG9hZERlZmF1bHRDb25maWd1cmF0aW9uKCk7XG5cdFx0XHRjb25zdCBhcHBsaWNhdGlvbiA9IGF3YWl0IHRoaXMucmVsb2FkQXBwbGljYXRpb25Db25maWd1cmF0aW9uKHRydWUpO1xuXHRcdFx0Y29uc3QgeyBsb2NhbCwgcmVtb3RlIH0gPSBhd2FpdCB0aGlzLnJlbG9hZFVzZXJDb25maWd1cmF0aW9uKCk7XG5cdFx0XHRhd2FpdCB0aGlzLnJlbG9hZFdvcmtzcGFjZUNvbmZpZ3VyYXRpb24oKTtcblx0XHRcdGF3YWl0IHRoaXMubG9hZENvbmZpZ3VyYXRpb24oYXBwbGljYXRpb24sIGxvY2FsLCByZW1vdGUsIHRydWUpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChpc1dvcmtzcGFjZUZvbGRlcih0YXJnZXQpKSB7XG5cdFx0XHRhd2FpdCB0aGlzLnJlbG9hZFdvcmtzcGFjZUZvbGRlckNvbmZpZ3VyYXRpb24odGFyZ2V0KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRzd2l0Y2ggKHRhcmdldCkge1xuXHRcdFx0Y2FzZSBDb25maWd1cmF0aW9uVGFyZ2V0LkRFRkFVTFQ6XG5cdFx0XHRcdHRoaXMucmVsb2FkRGVmYXVsdENvbmZpZ3VyYXRpb24oKTtcblx0XHRcdFx0cmV0dXJuO1xuXG5cdFx0XHRjYXNlIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUjoge1xuXHRcdFx0XHRjb25zdCB7IGxvY2FsLCByZW1vdGUgfSA9IGF3YWl0IHRoaXMucmVsb2FkVXNlckNvbmZpZ3VyYXRpb24oKTtcblx0XHRcdFx0YXdhaXQgdGhpcy5sb2FkQ29uZmlndXJhdGlvbih0aGlzLl9jb25maWd1cmF0aW9uLmFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbiwgbG9jYWwsIHJlbW90ZSwgdHJ1ZSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNhc2UgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMOlxuXHRcdFx0XHRhd2FpdCB0aGlzLnJlbG9hZExvY2FsVXNlckNvbmZpZ3VyYXRpb24oKTtcblx0XHRcdFx0cmV0dXJuO1xuXG5cdFx0XHRjYXNlIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9SRU1PVEU6XG5cdFx0XHRcdGF3YWl0IHRoaXMucmVsb2FkUmVtb3RlVXNlckNvbmZpZ3VyYXRpb24oKTtcblx0XHRcdFx0cmV0dXJuO1xuXG5cdFx0XHRjYXNlIENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFOlxuXHRcdFx0Y2FzZSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRV9GT0xERVI6XG5cdFx0XHRcdGF3YWl0IHRoaXMucmVsb2FkV29ya3NwYWNlQ29uZmlndXJhdGlvbigpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9XG5cblx0aGFzQ2FjaGVkQ29uZmlndXJhdGlvbkRlZmF1bHRzT3ZlcnJpZGVzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmRlZmF1bHRDb25maWd1cmF0aW9uLmhhc0NhY2hlZENvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlcygpO1xuXHR9XG5cblx0aW5zcGVjdDxUPihrZXk6IHN0cmluZywgb3ZlcnJpZGVzPzogSUNvbmZpZ3VyYXRpb25PdmVycmlkZXMpOiBJQ29uZmlndXJhdGlvblZhbHVlPFQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fY29uZmlndXJhdGlvbi5pbnNwZWN0PFQ+KGtleSwgb3ZlcnJpZGVzKTtcblx0fVxuXG5cdGtleXMoKToge1xuXHRcdGRlZmF1bHQ6IHN0cmluZ1tdO1xuXHRcdHVzZXI6IHN0cmluZ1tdO1xuXHRcdHdvcmtzcGFjZTogc3RyaW5nW107XG5cdFx0d29ya3NwYWNlRm9sZGVyOiBzdHJpbmdbXTtcblx0fSB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbmZpZ3VyYXRpb24ua2V5cygpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHdoZW5SZW1vdGVDb25maWd1cmF0aW9uTG9hZGVkKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuaW5pdFJlbW90ZVVzZXJDb25maWd1cmF0aW9uQmFycmllci53YWl0KCk7XG5cdH1cblxuXHQvKipcblx0ICogQXQgcHJlc2VudCwgYWxsIHdvcmtzcGFjZXMgKGVtcHR5LCBzaW5nbGUtZm9sZGVyLCBtdWx0aS1yb290KSBpbiBsb2NhbCBhbmQgcmVtb3RlXG5cdCAqIGNhbiBiZSBpbml0aWFsaXplZCB3aXRob3V0IHJlcXVpcmluZyBleHRlbnNpb24gaG9zdCBleGNlcHQgZm9sbG93aW5nIGNhc2U6XG5cdCAqXG5cdCAqIEEgbXVsdGkgcm9vdCB3b3Jrc3BhY2Ugd2l0aCAuY29kZS13b3Jrc3BhY2UgZmlsZSB0aGF0IGhhcyB0byBiZSByZXNvbHZlZCBieSBhbiBleHRlbnNpb24uXG5cdCAqIEJlY2F1c2Ugb2YgcmVhZG9ubHkgYHJvb3RQYXRoYCBwcm9wZXJ0eSBpbiBleHRlbnNpb24gQVBJIHdlIGhhdmUgdG8gcmVzb2x2ZSBtdWx0aSByb290IHdvcmtzcGFjZVxuXHQgKiBiZWZvcmUgZXh0ZW5zaW9uIGhvc3Qgc3RhcnRzIHNvIHRoYXQgYHJvb3RQYXRoYCBjYW4gYmUgc2V0IHRvIGZpcnN0IGZvbGRlci5cblx0ICpcblx0ICogVGhpcyByZXN0cmljdGlvbiBpcyBsaWZ0ZWQgcGFydGlhbGx5IGZvciB3ZWIgaW4gYE1haW5UaHJlYWRXb3Jrc3BhY2VgLlxuXHQgKiBJbiB3ZWIsIHdlIHN0YXJ0IGV4dGVuc2lvbiBob3N0IHdpdGggZW1wdHkgYHJvb3RQYXRoYCBpbiB0aGlzIGNhc2UuXG5cdCAqXG5cdCAqIFJlbGF0ZWQgcm9vdCBwYXRoIGlzc3VlIGRpc2N1c3Npb24gaXMgYmVpbmcgdHJhY2tlZCBoZXJlIC0gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzY5MzM1XG5cdCAqL1xuXHRhc3luYyBpbml0aWFsaXplKGFyZzogSUFueVdvcmtzcGFjZUlkZW50aWZpZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRtYXJrKCdjb2RlL3dpbGxJbml0V29ya3NwYWNlU2VydmljZScpO1xuXG5cdFx0Y29uc3QgdHJpZ2dlciA9IHRoaXMuaW5pdGlhbGl6ZWQ7XG5cdFx0dGhpcy5pbml0aWFsaXplZCA9IGZhbHNlO1xuXHRcdGNvbnN0IHdvcmtzcGFjZSA9IGF3YWl0IHRoaXMuY3JlYXRlV29ya3NwYWNlKGFyZyk7XG5cdFx0YXdhaXQgdGhpcy51cGRhdGVXb3Jrc3BhY2VBbmRJbml0aWFsaXplQ29uZmlndXJhdGlvbih3b3Jrc3BhY2UsIHRyaWdnZXIpO1xuXHRcdHRoaXMuY2hlY2tBbmRNYXJrV29ya3NwYWNlQ29tcGxldGUoZmFsc2UpO1xuXG5cdFx0bWFyaygnY29kZS9kaWRJbml0V29ya3NwYWNlU2VydmljZScpO1xuXHR9XG5cblx0dXBkYXRlV29ya3NwYWNlVHJ1c3QodHJ1c3RlZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICh0aGlzLmlzV29ya3NwYWNlVHJ1c3RlZCAhPT0gdHJ1c3RlZCkge1xuXHRcdFx0dGhpcy5pc1dvcmtzcGFjZVRydXN0ZWQgPSB0cnVzdGVkO1xuXHRcdFx0Y29uc3QgZGF0YSA9IHRoaXMuX2NvbmZpZ3VyYXRpb24udG9EYXRhKCk7XG5cdFx0XHRjb25zdCBmb2xkZXJDb25maWd1cmF0aW9uTW9kZWxzOiAoQ29uZmlndXJhdGlvbk1vZGVsIHwgdW5kZWZpbmVkKVtdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IGZvbGRlciBvZiB0aGlzLndvcmtzcGFjZS5mb2xkZXJzKSB7XG5cdFx0XHRcdGNvbnN0IGZvbGRlckNvbmZpZ3VyYXRpb24gPSB0aGlzLmNhY2hlZEZvbGRlckNvbmZpZ3MuZ2V0KGZvbGRlci51cmkpO1xuXHRcdFx0XHRsZXQgY29uZmlndXJhdGlvbk1vZGVsOiBDb25maWd1cmF0aW9uTW9kZWwgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmIChmb2xkZXJDb25maWd1cmF0aW9uKSB7XG5cdFx0XHRcdFx0Y29uZmlndXJhdGlvbk1vZGVsID0gZm9sZGVyQ29uZmlndXJhdGlvbi51cGRhdGVXb3Jrc3BhY2VUcnVzdCh0aGlzLmlzV29ya3NwYWNlVHJ1c3RlZCk7XG5cdFx0XHRcdFx0dGhpcy5fY29uZmlndXJhdGlvbi51cGRhdGVGb2xkZXJDb25maWd1cmF0aW9uKGZvbGRlci51cmksIGNvbmZpZ3VyYXRpb25Nb2RlbCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9sZGVyQ29uZmlndXJhdGlvbk1vZGVscy5wdXNoKGNvbmZpZ3VyYXRpb25Nb2RlbCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5nZXRXb3JrYmVuY2hTdGF0ZSgpID09PSBXb3JrYmVuY2hTdGF0ZS5GT0xERVIpIHtcblx0XHRcdFx0aWYgKGZvbGRlckNvbmZpZ3VyYXRpb25Nb2RlbHNbMF0pIHtcblx0XHRcdFx0XHR0aGlzLl9jb25maWd1cmF0aW9uLnVwZGF0ZVdvcmtzcGFjZUNvbmZpZ3VyYXRpb24oZm9sZGVyQ29uZmlndXJhdGlvbk1vZGVsc1swXSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX2NvbmZpZ3VyYXRpb24udXBkYXRlV29ya3NwYWNlQ29uZmlndXJhdGlvbih0aGlzLndvcmtzcGFjZUNvbmZpZ3VyYXRpb24udXBkYXRlV29ya3NwYWNlVHJ1c3QodGhpcy5pc1dvcmtzcGFjZVRydXN0ZWQpKTtcblx0XHRcdH1cblx0XHRcdHRoaXMudXBkYXRlUmVzdHJpY3RlZFNldHRpbmdzKCk7XG5cblx0XHRcdGxldCBrZXlzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0aWYgKHRoaXMucmVzdHJpY3RlZFNldHRpbmdzLnVzZXJMb2NhbCkge1xuXHRcdFx0XHRrZXlzLnB1c2goLi4udGhpcy5yZXN0cmljdGVkU2V0dGluZ3MudXNlckxvY2FsKTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLnJlc3RyaWN0ZWRTZXR0aW5ncy51c2VyUmVtb3RlKSB7XG5cdFx0XHRcdGtleXMucHVzaCguLi50aGlzLnJlc3RyaWN0ZWRTZXR0aW5ncy51c2VyUmVtb3RlKTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLnJlc3RyaWN0ZWRTZXR0aW5ncy53b3Jrc3BhY2UpIHtcblx0XHRcdFx0a2V5cy5wdXNoKC4uLnRoaXMucmVzdHJpY3RlZFNldHRpbmdzLndvcmtzcGFjZSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLnJlc3RyaWN0ZWRTZXR0aW5ncy53b3Jrc3BhY2VGb2xkZXI/LmZvckVhY2goKHZhbHVlKSA9PiBrZXlzLnB1c2goLi4udmFsdWUpKTtcblx0XHRcdGtleXMgPSBkaXN0aW5jdChrZXlzKTtcblx0XHRcdGlmIChrZXlzLmxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLnRyaWdnZXJDb25maWd1cmF0aW9uQ2hhbmdlKHsga2V5cywgb3ZlcnJpZGVzOiBbXSB9LCB7IGRhdGEsIHdvcmtzcGFjZTogdGhpcy53b3Jrc3BhY2UgfSwgQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0UpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGFjcXVpcmVJbnN0YW50aWF0aW9uU2VydmljZShpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlKTogdm9pZCB7XG5cdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHR9XG5cblx0aXNTZXR0aW5nQXBwbGllZEZvckFsbFByb2ZpbGVzKGtleTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0Y29uc3Qgc2NvcGUgPSB0aGlzLmNvbmZpZ3VyYXRpb25SZWdpc3RyeS5nZXRDb25maWd1cmF0aW9uUHJvcGVydGllcygpW2tleV0/LnNjb3BlO1xuXHRcdGlmIChzY29wZSAmJiBBUFBMSUNBVElPTl9TQ09QRVMuaW5jbHVkZXMoc2NvcGUpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0Y29uc3QgYWxsUHJvZmlsZXNTZXR0aW5ncyA9IHRoaXMuZ2V0VmFsdWU8c3RyaW5nW10+KEFQUExZX0FMTF9QUk9GSUxFU19TRVRUSU5HKSA/PyBbXTtcblx0XHRyZXR1cm4gQXJyYXkuaXNBcnJheShhbGxQcm9maWxlc1NldHRpbmdzKSAmJiBhbGxQcm9maWxlc1NldHRpbmdzLmluY2x1ZGVzKGtleSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNyZWF0ZVdvcmtzcGFjZShhcmc6IElBbnlXb3Jrc3BhY2VJZGVudGlmaWVyKTogUHJvbWlzZTxXb3Jrc3BhY2U+IHtcblx0XHRpZiAoaXNXb3Jrc3BhY2VJZGVudGlmaWVyKGFyZykpIHtcblx0XHRcdHJldHVybiB0aGlzLmNyZWF0ZU11bHRpRm9sZGVyV29ya3NwYWNlKGFyZyk7XG5cdFx0fVxuXG5cdFx0aWYgKGlzU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllcihhcmcpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jcmVhdGVTaW5nbGVGb2xkZXJXb3Jrc3BhY2UoYXJnKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5jcmVhdGVFbXB0eVdvcmtzcGFjZShhcmcpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjcmVhdGVNdWx0aUZvbGRlcldvcmtzcGFjZSh3b3Jrc3BhY2VJZGVudGlmaWVyOiBJV29ya3NwYWNlSWRlbnRpZmllcik6IFByb21pc2U8V29ya3NwYWNlPiB7XG5cdFx0YXdhaXQgdGhpcy53b3Jrc3BhY2VDb25maWd1cmF0aW9uLmluaXRpYWxpemUoeyBpZDogd29ya3NwYWNlSWRlbnRpZmllci5pZCwgY29uZmlnUGF0aDogd29ya3NwYWNlSWRlbnRpZmllci5jb25maWdQYXRoIH0sIHRoaXMuaXNXb3Jrc3BhY2VUcnVzdGVkKTtcblx0XHRjb25zdCB3b3Jrc3BhY2VDb25maWdQYXRoID0gd29ya3NwYWNlSWRlbnRpZmllci5jb25maWdQYXRoO1xuXHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlcnMgPSB0b1dvcmtzcGFjZUZvbGRlcnModGhpcy53b3Jrc3BhY2VDb25maWd1cmF0aW9uLmdldEZvbGRlcnMoKSwgd29ya3NwYWNlQ29uZmlnUGF0aCwgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpKTtcblx0XHRjb25zdCB3b3Jrc3BhY2VJZCA9IHdvcmtzcGFjZUlkZW50aWZpZXIuaWQ7XG5cdFx0Y29uc3Qgd29ya3NwYWNlID0gbmV3IFdvcmtzcGFjZSh3b3Jrc3BhY2VJZCwgd29ya3NwYWNlRm9sZGVycywgdGhpcy53b3Jrc3BhY2VDb25maWd1cmF0aW9uLmlzVHJhbnNpZW50KCksIHdvcmtzcGFjZUNvbmZpZ1BhdGgsIHVyaSA9PiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaWdub3JlUGF0aENhc2luZyh1cmkpKTtcblx0XHR3b3Jrc3BhY2UuaW5pdGlhbGl6ZWQgPSB0aGlzLndvcmtzcGFjZUNvbmZpZ3VyYXRpb24uaW5pdGlhbGl6ZWQ7XG5cdFx0cmV0dXJuIHdvcmtzcGFjZTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlU2luZ2xlRm9sZGVyV29ya3NwYWNlKHNpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXI6IElTaW5nbGVGb2xkZXJXb3Jrc3BhY2VJZGVudGlmaWVyKTogV29ya3NwYWNlIHtcblx0XHRjb25zdCB3b3Jrc3BhY2UgPSBuZXcgV29ya3NwYWNlKHNpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIuaWQsIFt0b1dvcmtzcGFjZUZvbGRlcihzaW5nbGVGb2xkZXJXb3Jrc3BhY2VJZGVudGlmaWVyLnVyaSldLCBmYWxzZSwgbnVsbCwgdXJpID0+IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pZ25vcmVQYXRoQ2FzaW5nKHVyaSkpO1xuXHRcdHdvcmtzcGFjZS5pbml0aWFsaXplZCA9IHRydWU7XG5cdFx0cmV0dXJuIHdvcmtzcGFjZTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlRW1wdHlXb3Jrc3BhY2UoZW1wdHlXb3Jrc3BhY2VJZGVudGlmaWVyOiBJRW1wdHlXb3Jrc3BhY2VJZGVudGlmaWVyKTogUHJvbWlzZTxXb3Jrc3BhY2U+IHtcblx0XHRjb25zdCB3b3Jrc3BhY2UgPSBuZXcgV29ya3NwYWNlKGVtcHR5V29ya3NwYWNlSWRlbnRpZmllci5pZCwgW10sIGZhbHNlLCBudWxsLCB1cmkgPT4gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlnbm9yZVBhdGhDYXNpbmcodXJpKSk7XG5cdFx0d29ya3NwYWNlLmluaXRpYWxpemVkID0gdHJ1ZTtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHdvcmtzcGFjZSk7XG5cdH1cblxuXHRwcml2YXRlIGNoZWNrQW5kTWFya1dvcmtzcGFjZUNvbXBsZXRlKGZyb21DYWNoZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICghdGhpcy5jb21wbGV0ZVdvcmtzcGFjZUJhcnJpZXIuaXNPcGVuKCkgJiYgdGhpcy53b3Jrc3BhY2UuaW5pdGlhbGl6ZWQpIHtcblx0XHRcdHRoaXMuY29tcGxldGVXb3Jrc3BhY2VCYXJyaWVyLm9wZW4oKTtcblx0XHRcdHRoaXMudmFsaWRhdGVXb3Jrc3BhY2VGb2xkZXJzQW5kUmVsb2FkKGZyb21DYWNoZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVXb3Jrc3BhY2VBbmRJbml0aWFsaXplQ29uZmlndXJhdGlvbih3b3Jrc3BhY2U6IFdvcmtzcGFjZSwgdHJpZ2dlcjogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGhhc1dvcmtzcGFjZUJlZm9yZSA9ICEhdGhpcy53b3Jrc3BhY2U7XG5cdFx0bGV0IHByZXZpb3VzU3RhdGU6IFdvcmtiZW5jaFN0YXRlIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBwcmV2aW91c1dvcmtzcGFjZVBhdGg6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRsZXQgcHJldmlvdXNGb2xkZXJzOiBXb3Jrc3BhY2VGb2xkZXJbXSA9IFtdO1xuXG5cdFx0aWYgKGhhc1dvcmtzcGFjZUJlZm9yZSkge1xuXHRcdFx0cHJldmlvdXNTdGF0ZSA9IHRoaXMuZ2V0V29ya2JlbmNoU3RhdGUoKTtcblx0XHRcdHByZXZpb3VzV29ya3NwYWNlUGF0aCA9IHRoaXMud29ya3NwYWNlLmNvbmZpZ3VyYXRpb24gPyB0aGlzLndvcmtzcGFjZS5jb25maWd1cmF0aW9uLmZzUGF0aCA6IHVuZGVmaW5lZDtcblx0XHRcdHByZXZpb3VzRm9sZGVycyA9IHRoaXMud29ya3NwYWNlLmZvbGRlcnM7XG5cdFx0XHR0aGlzLndvcmtzcGFjZS51cGRhdGUod29ya3NwYWNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy53b3Jrc3BhY2UgPSB3b3Jrc3BhY2U7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGhpcy5pbml0aWFsaXplQ29uZmlndXJhdGlvbih0cmlnZ2VyKTtcblxuXHRcdC8vIFRyaWdnZXIgY2hhbmdlcyBhZnRlciBjb25maWd1cmF0aW9uIGluaXRpYWxpemF0aW9uIHNvIHRoYXQgY29uZmlndXJhdGlvbiBpcyB1cCB0byBkYXRlLlxuXHRcdGlmIChoYXNXb3Jrc3BhY2VCZWZvcmUpIHtcblx0XHRcdGNvbnN0IG5ld1N0YXRlID0gdGhpcy5nZXRXb3JrYmVuY2hTdGF0ZSgpO1xuXHRcdFx0aWYgKHByZXZpb3VzU3RhdGUgJiYgbmV3U3RhdGUgIT09IHByZXZpb3VzU3RhdGUpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VXb3JrYmVuY2hTdGF0ZS5maXJlKG5ld1N0YXRlKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbmV3V29ya3NwYWNlUGF0aCA9IHRoaXMud29ya3NwYWNlLmNvbmZpZ3VyYXRpb24gPyB0aGlzLndvcmtzcGFjZS5jb25maWd1cmF0aW9uLmZzUGF0aCA6IHVuZGVmaW5lZDtcblx0XHRcdGlmIChwcmV2aW91c1dvcmtzcGFjZVBhdGggJiYgbmV3V29ya3NwYWNlUGF0aCAhPT0gcHJldmlvdXNXb3Jrc3BhY2VQYXRoIHx8IG5ld1N0YXRlICE9PSBwcmV2aW91c1N0YXRlKSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlV29ya3NwYWNlTmFtZS5maXJlKCk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGZvbGRlckNoYW5nZXMgPSB0aGlzLmNvbXBhcmVGb2xkZXJzKHByZXZpb3VzRm9sZGVycywgdGhpcy53b3Jrc3BhY2UuZm9sZGVycyk7XG5cdFx0XHRpZiAoZm9sZGVyQ2hhbmdlcyAmJiAoZm9sZGVyQ2hhbmdlcy5hZGRlZC5sZW5ndGggfHwgZm9sZGVyQ2hhbmdlcy5yZW1vdmVkLmxlbmd0aCB8fCBmb2xkZXJDaGFuZ2VzLmNoYW5nZWQubGVuZ3RoKSkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmhhbmRsZVdpbGxDaGFuZ2VXb3Jrc3BhY2VGb2xkZXJzKGZvbGRlckNoYW5nZXMsIGZhbHNlKTtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VXb3Jrc3BhY2VGb2xkZXJzLmZpcmUoZm9sZGVyQ2hhbmdlcyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLmxvY2FsVXNlckNvbmZpZ3VyYXRpb24uaGFzVGFza3NMb2FkZWQpIHtcblx0XHRcdC8vIFJlbG9hZCBsb2NhbCB1c2VyIGNvbmZpZ3VyYXRpb24gYWdhaW4gdG8gbG9hZCB1c2VyIHRhc2tzXG5cdFx0XHR0aGlzLl9yZWdpc3RlcihydW5XaGVuV2luZG93SWRsZShtYWluV2luZG93LCAoKSA9PiB0aGlzLnJlbG9hZExvY2FsVXNlckNvbmZpZ3VyYXRpb24oZmFsc2UsIHRoaXMuX2NvbmZpZ3VyYXRpb24ubG9jYWxVc2VyQ29uZmlndXJhdGlvbikpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGNvbXBhcmVGb2xkZXJzKGN1cnJlbnRGb2xkZXJzOiBJV29ya3NwYWNlRm9sZGVyW10sIG5ld0ZvbGRlcnM6IElXb3Jrc3BhY2VGb2xkZXJbXSk6IElXb3Jrc3BhY2VGb2xkZXJzQ2hhbmdlRXZlbnQge1xuXHRcdGNvbnN0IHJlc3VsdDogSVdvcmtzcGFjZUZvbGRlcnNDaGFuZ2VFdmVudCA9IHsgYWRkZWQ6IFtdLCByZW1vdmVkOiBbXSwgY2hhbmdlZDogW10gfTtcblx0XHRyZXN1bHQuYWRkZWQgPSBuZXdGb2xkZXJzLmZpbHRlcihuZXdGb2xkZXIgPT4gIWN1cnJlbnRGb2xkZXJzLnNvbWUoY3VycmVudEZvbGRlciA9PiBuZXdGb2xkZXIudXJpLnRvU3RyaW5nKCkgPT09IGN1cnJlbnRGb2xkZXIudXJpLnRvU3RyaW5nKCkpKTtcblx0XHRmb3IgKGxldCBjdXJyZW50SW5kZXggPSAwOyBjdXJyZW50SW5kZXggPCBjdXJyZW50Rm9sZGVycy5sZW5ndGg7IGN1cnJlbnRJbmRleCsrKSB7XG5cdFx0XHRjb25zdCBjdXJyZW50Rm9sZGVyID0gY3VycmVudEZvbGRlcnNbY3VycmVudEluZGV4XTtcblx0XHRcdGxldCBuZXdJbmRleCA9IDA7XG5cdFx0XHRmb3IgKG5ld0luZGV4ID0gMDsgbmV3SW5kZXggPCBuZXdGb2xkZXJzLmxlbmd0aCAmJiBjdXJyZW50Rm9sZGVyLnVyaS50b1N0cmluZygpICE9PSBuZXdGb2xkZXJzW25ld0luZGV4XS51cmkudG9TdHJpbmcoKTsgbmV3SW5kZXgrKykgeyB9XG5cdFx0XHRpZiAobmV3SW5kZXggPCBuZXdGb2xkZXJzLmxlbmd0aCkge1xuXHRcdFx0XHRpZiAoY3VycmVudEluZGV4ICE9PSBuZXdJbmRleCB8fCBjdXJyZW50Rm9sZGVyLm5hbWUgIT09IG5ld0ZvbGRlcnNbbmV3SW5kZXhdLm5hbWUpIHtcblx0XHRcdFx0XHRyZXN1bHQuY2hhbmdlZC5wdXNoKGN1cnJlbnRGb2xkZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXN1bHQucmVtb3ZlZC5wdXNoKGN1cnJlbnRGb2xkZXIpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBpbml0aWFsaXplQ29uZmlndXJhdGlvbih0cmlnZ2VyOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5kZWZhdWx0Q29uZmlndXJhdGlvbi5pbml0aWFsaXplKCk7XG5cblx0XHRjb25zdCBpbml0UG9saWN5Q29uZmlndXJhdGlvblByb21pc2UgPSB0aGlzLnBvbGljeUNvbmZpZ3VyYXRpb24uaW5pdGlhbGl6ZSgpO1xuXHRcdGNvbnN0IGluaXRBcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb25Qcm9taXNlID0gdGhpcy5hcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb24gPyB0aGlzLmFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbi5pbml0aWFsaXplKCkgOiBQcm9taXNlLnJlc29sdmUoQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwodGhpcy5sb2dTZXJ2aWNlKSk7XG5cdFx0Y29uc3QgaW5pdFVzZXJDb25maWd1cmF0aW9uID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0bWFyaygnY29kZS93aWxsSW5pdFVzZXJDb25maWd1cmF0aW9uJyk7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBQcm9taXNlLmFsbChbdGhpcy5sb2NhbFVzZXJDb25maWd1cmF0aW9uLmluaXRpYWxpemUoKSwgdGhpcy5yZW1vdGVVc2VyQ29uZmlndXJhdGlvbiA/IHRoaXMucmVtb3RlVXNlckNvbmZpZ3VyYXRpb24uaW5pdGlhbGl6ZSgpIDogUHJvbWlzZS5yZXNvbHZlKENvbmZpZ3VyYXRpb25Nb2RlbC5jcmVhdGVFbXB0eU1vZGVsKHRoaXMubG9nU2VydmljZSkpXSk7XG5cdFx0XHRpZiAodGhpcy5hcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb24pIHtcblx0XHRcdFx0Y29uc3QgYXBwbGljYXRpb25Db25maWd1cmF0aW9uTW9kZWwgPSBhd2FpdCBpbml0QXBwbGljYXRpb25Db25maWd1cmF0aW9uUHJvbWlzZTtcblx0XHRcdFx0cmVzdWx0WzBdID0gdGhpcy5sb2NhbFVzZXJDb25maWd1cmF0aW9uLnJlcGFyc2UoeyBleGNsdWRlOiBhcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb25Nb2RlbC5nZXRWYWx1ZShBUFBMWV9BTExfUFJPRklMRVNfU0VUVElORykgfSk7XG5cdFx0XHR9XG5cdFx0XHRtYXJrKCdjb2RlL2RpZEluaXRVc2VyQ29uZmlndXJhdGlvbicpO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9O1xuXG5cdFx0Y29uc3QgWywgYXBwbGljYXRpb24sIFtsb2NhbCwgcmVtb3RlXV0gPSBhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHRpbml0UG9saWN5Q29uZmlndXJhdGlvblByb21pc2UsXG5cdFx0XHRpbml0QXBwbGljYXRpb25Db25maWd1cmF0aW9uUHJvbWlzZSxcblx0XHRcdGluaXRVc2VyQ29uZmlndXJhdGlvbigpXG5cdFx0XSk7XG5cblx0XHRtYXJrKCdjb2RlL3dpbGxJbml0V29ya3NwYWNlQ29uZmlndXJhdGlvbicpO1xuXHRcdGF3YWl0IHRoaXMubG9hZENvbmZpZ3VyYXRpb24oYXBwbGljYXRpb24sIGxvY2FsLCByZW1vdGUsIHRyaWdnZXIpO1xuXHRcdG1hcmsoJ2NvZGUvZGlkSW5pdFdvcmtzcGFjZUNvbmZpZ3VyYXRpb24nKTtcblx0fVxuXG5cdHByaXZhdGUgcmVsb2FkRGVmYXVsdENvbmZpZ3VyYXRpb24oKTogdm9pZCB7XG5cdFx0dGhpcy5vbkRlZmF1bHRDb25maWd1cmF0aW9uQ2hhbmdlZCh0aGlzLmRlZmF1bHRDb25maWd1cmF0aW9uLnJlbG9hZCgpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVsb2FkQXBwbGljYXRpb25Db25maWd1cmF0aW9uKGRvbm90VHJpZ2dlcj86IGJvb2xlYW4pOiBQcm9taXNlPENvbmZpZ3VyYXRpb25Nb2RlbD4ge1xuXHRcdGlmICghdGhpcy5hcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb24pIHtcblx0XHRcdHJldHVybiBDb25maWd1cmF0aW9uTW9kZWwuY3JlYXRlRW1wdHlNb2RlbCh0aGlzLmxvZ1NlcnZpY2UpO1xuXHRcdH1cblx0XHRjb25zdCBtb2RlbCA9IGF3YWl0IHRoaXMuYXBwbGljYXRpb25Db25maWd1cmF0aW9uLmxvYWRDb25maWd1cmF0aW9uKCk7XG5cdFx0aWYgKCFkb25vdFRyaWdnZXIpIHtcblx0XHRcdHRoaXMub25BcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb25DaGFuZ2VkKG1vZGVsKTtcblx0XHR9XG5cdFx0cmV0dXJuIG1vZGVsO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZWxvYWRVc2VyQ29uZmlndXJhdGlvbigpOiBQcm9taXNlPHsgbG9jYWw6IENvbmZpZ3VyYXRpb25Nb2RlbDsgcmVtb3RlOiBDb25maWd1cmF0aW9uTW9kZWwgfT4ge1xuXHRcdGNvbnN0IFtsb2NhbCwgcmVtb3RlXSA9IGF3YWl0IFByb21pc2UuYWxsKFt0aGlzLnJlbG9hZExvY2FsVXNlckNvbmZpZ3VyYXRpb24odHJ1ZSksIHRoaXMucmVsb2FkUmVtb3RlVXNlckNvbmZpZ3VyYXRpb24odHJ1ZSldKTtcblx0XHRyZXR1cm4geyBsb2NhbCwgcmVtb3RlIH07XG5cdH1cblxuXHRhc3luYyByZWxvYWRMb2NhbFVzZXJDb25maWd1cmF0aW9uKGRvbm90VHJpZ2dlcj86IGJvb2xlYW4sIHNldHRpbmdzQ29uZmlndXJhdGlvbj86IENvbmZpZ3VyYXRpb25Nb2RlbCk6IFByb21pc2U8Q29uZmlndXJhdGlvbk1vZGVsPiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCB0aGlzLmxvY2FsVXNlckNvbmZpZ3VyYXRpb24ucmVsb2FkKHNldHRpbmdzQ29uZmlndXJhdGlvbik7XG5cdFx0aWYgKCFkb25vdFRyaWdnZXIpIHtcblx0XHRcdHRoaXMub25Mb2NhbFVzZXJDb25maWd1cmF0aW9uQ2hhbmdlZChtb2RlbCk7XG5cdFx0fVxuXHRcdHJldHVybiBtb2RlbDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVsb2FkUmVtb3RlVXNlckNvbmZpZ3VyYXRpb24oZG9ub3RUcmlnZ2VyPzogYm9vbGVhbik6IFByb21pc2U8Q29uZmlndXJhdGlvbk1vZGVsPiB7XG5cdFx0aWYgKHRoaXMucmVtb3RlVXNlckNvbmZpZ3VyYXRpb24pIHtcblx0XHRcdGNvbnN0IG1vZGVsID0gYXdhaXQgdGhpcy5yZW1vdGVVc2VyQ29uZmlndXJhdGlvbi5yZWxvYWQoKTtcblx0XHRcdGlmICghZG9ub3RUcmlnZ2VyKSB7XG5cdFx0XHRcdHRoaXMub25SZW1vdGVVc2VyQ29uZmlndXJhdGlvbkNoYW5nZWQobW9kZWwpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG1vZGVsO1xuXHRcdH1cblx0XHRyZXR1cm4gQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwodGhpcy5sb2dTZXJ2aWNlKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgcmVsb2FkV29ya3NwYWNlQ29uZmlndXJhdGlvbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB3b3JrYmVuY2hTdGF0ZSA9IHRoaXMuZ2V0V29ya2JlbmNoU3RhdGUoKTtcblx0XHRpZiAod29ya2JlbmNoU3RhdGUgPT09IFdvcmtiZW5jaFN0YXRlLkZPTERFUikge1xuXHRcdFx0cmV0dXJuIHRoaXMub25Xb3Jrc3BhY2VGb2xkZXJDb25maWd1cmF0aW9uQ2hhbmdlZCh0aGlzLndvcmtzcGFjZS5mb2xkZXJzWzBdKTtcblx0XHR9XG5cdFx0aWYgKHdvcmtiZW5jaFN0YXRlID09PSBXb3JrYmVuY2hTdGF0ZS5XT1JLU1BBQ0UpIHtcblx0XHRcdHJldHVybiB0aGlzLndvcmtzcGFjZUNvbmZpZ3VyYXRpb24ucmVsb2FkKCkudGhlbigoKSA9PiB0aGlzLm9uV29ya3NwYWNlQ29uZmlndXJhdGlvbkNoYW5nZWQoZmFsc2UpKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbG9hZFdvcmtzcGFjZUZvbGRlckNvbmZpZ3VyYXRpb24oZm9sZGVyOiBJV29ya3NwYWNlRm9sZGVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMub25Xb3Jrc3BhY2VGb2xkZXJDb25maWd1cmF0aW9uQ2hhbmdlZChmb2xkZXIpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBsb2FkQ29uZmlndXJhdGlvbihhcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb25Nb2RlbDogQ29uZmlndXJhdGlvbk1vZGVsLCB1c2VyQ29uZmlndXJhdGlvbk1vZGVsOiBDb25maWd1cmF0aW9uTW9kZWwsIHJlbW90ZVVzZXJDb25maWd1cmF0aW9uTW9kZWw6IENvbmZpZ3VyYXRpb25Nb2RlbCwgdHJpZ2dlcjogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIHJlc2V0IGNhY2hlc1xuXHRcdHRoaXMuY2FjaGVkRm9sZGVyQ29uZmlncyA9IG5ldyBSZXNvdXJjZU1hcDxGb2xkZXJDb25maWd1cmF0aW9uPigpO1xuXG5cdFx0Y29uc3QgZm9sZGVycyA9IHRoaXMud29ya3NwYWNlLmZvbGRlcnM7XG5cdFx0Y29uc3QgZm9sZGVyQ29uZmlndXJhdGlvbnMgPSBhd2FpdCB0aGlzLmxvYWRGb2xkZXJDb25maWd1cmF0aW9ucyhmb2xkZXJzKTtcblxuXHRcdGNvbnN0IHdvcmtzcGFjZUNvbmZpZ3VyYXRpb24gPSB0aGlzLmdldFdvcmtzcGFjZUNvbmZpZ3VyYXRpb25Nb2RlbChmb2xkZXJDb25maWd1cmF0aW9ucyk7XG5cdFx0Y29uc3QgZm9sZGVyQ29uZmlndXJhdGlvbk1vZGVscyA9IG5ldyBSZXNvdXJjZU1hcDxDb25maWd1cmF0aW9uTW9kZWw+KCk7XG5cdFx0Zm9sZGVyQ29uZmlndXJhdGlvbnMuZm9yRWFjaCgoZm9sZGVyQ29uZmlndXJhdGlvbiwgaW5kZXgpID0+IGZvbGRlckNvbmZpZ3VyYXRpb25Nb2RlbHMuc2V0KGZvbGRlcnNbaW5kZXhdLnVyaSwgZm9sZGVyQ29uZmlndXJhdGlvbikpO1xuXG5cdFx0Y29uc3QgY3VycmVudENvbmZpZ3VyYXRpb24gPSB0aGlzLl9jb25maWd1cmF0aW9uO1xuXHRcdHRoaXMuX2NvbmZpZ3VyYXRpb24gPSBuZXcgQ29uZmlndXJhdGlvbih0aGlzLmRlZmF1bHRDb25maWd1cmF0aW9uLmNvbmZpZ3VyYXRpb25Nb2RlbCwgdGhpcy5wb2xpY3lDb25maWd1cmF0aW9uLmNvbmZpZ3VyYXRpb25Nb2RlbCwgYXBwbGljYXRpb25Db25maWd1cmF0aW9uTW9kZWwsIHVzZXJDb25maWd1cmF0aW9uTW9kZWwsIHJlbW90ZVVzZXJDb25maWd1cmF0aW9uTW9kZWwsIHdvcmtzcGFjZUNvbmZpZ3VyYXRpb24sIGZvbGRlckNvbmZpZ3VyYXRpb25Nb2RlbHMsIENvbmZpZ3VyYXRpb25Nb2RlbC5jcmVhdGVFbXB0eU1vZGVsKHRoaXMubG9nU2VydmljZSksIG5ldyBSZXNvdXJjZU1hcDxDb25maWd1cmF0aW9uTW9kZWw+KCksIHRoaXMud29ya3NwYWNlLCB0aGlzLmxvZ1NlcnZpY2UpO1xuXG5cdFx0dGhpcy5pbml0aWFsaXplZCA9IHRydWU7XG5cblx0XHRpZiAodHJpZ2dlcikge1xuXHRcdFx0Y29uc3QgY2hhbmdlID0gdGhpcy5fY29uZmlndXJhdGlvbi5jb21wYXJlKGN1cnJlbnRDb25maWd1cmF0aW9uKTtcblx0XHRcdHRoaXMudHJpZ2dlckNvbmZpZ3VyYXRpb25DaGFuZ2UoY2hhbmdlLCB7IGRhdGE6IGN1cnJlbnRDb25maWd1cmF0aW9uLnRvRGF0YSgpLCB3b3Jrc3BhY2U6IHRoaXMud29ya3NwYWNlIH0sIENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFKTtcblx0XHR9XG5cblx0XHR0aGlzLnVwZGF0ZVJlc3RyaWN0ZWRTZXR0aW5ncygpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRXb3Jrc3BhY2VDb25maWd1cmF0aW9uTW9kZWwoZm9sZGVyQ29uZmlndXJhdGlvbnM6IENvbmZpZ3VyYXRpb25Nb2RlbFtdKTogQ29uZmlndXJhdGlvbk1vZGVsIHtcblx0XHRzd2l0Y2ggKHRoaXMuZ2V0V29ya2JlbmNoU3RhdGUoKSkge1xuXHRcdFx0Y2FzZSBXb3JrYmVuY2hTdGF0ZS5GT0xERVI6XG5cdFx0XHRcdHJldHVybiBmb2xkZXJDb25maWd1cmF0aW9uc1swXTtcblx0XHRcdGNhc2UgV29ya2JlbmNoU3RhdGUuV09SS1NQQUNFOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy53b3Jrc3BhY2VDb25maWd1cmF0aW9uLmdldENvbmZpZ3VyYXRpb24oKTtcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiBDb25maWd1cmF0aW9uTW9kZWwuY3JlYXRlRW1wdHlNb2RlbCh0aGlzLmxvZ1NlcnZpY2UpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgb25Vc2VyRGF0YVByb2ZpbGVDaGFuZ2VkKGU6IERpZENoYW5nZVVzZXJEYXRhUHJvZmlsZUV2ZW50KTogdm9pZCB7XG5cdFx0ZS5qb2luKChhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBwcm9taXNlczogUHJvbWlzZTxDb25maWd1cmF0aW9uTW9kZWw+W10gPSBbXTtcblx0XHRcdHByb21pc2VzLnB1c2godGhpcy5sb2NhbFVzZXJDb25maWd1cmF0aW9uLnJlc2V0KGUucHJvZmlsZS5zZXR0aW5nc1Jlc291cmNlLCBlLnByb2ZpbGUudGFza3NSZXNvdXJjZSwgeyBzY29wZXM6IGdldExvY2FsVXNlckNvbmZpZ3VyYXRpb25TY29wZXMoZS5wcm9maWxlLCAhIXRoaXMucmVtb3RlVXNlckNvbmZpZ3VyYXRpb24pIH0pKTtcblx0XHRcdGlmIChlLnByZXZpb3VzLmlzRGVmYXVsdCAhPT0gZS5wcm9maWxlLmlzRGVmYXVsdFxuXHRcdFx0XHR8fCAhIWUucHJldmlvdXMudXNlRGVmYXVsdEZsYWdzPy5zZXR0aW5ncyAhPT0gISFlLnByb2ZpbGUudXNlRGVmYXVsdEZsYWdzPy5zZXR0aW5ncykge1xuXHRcdFx0XHR0aGlzLmNyZWF0ZUFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbigpO1xuXHRcdFx0XHRpZiAodGhpcy5hcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb24pIHtcblx0XHRcdFx0XHRwcm9taXNlcy5wdXNoKHRoaXMucmVsb2FkQXBwbGljYXRpb25Db25maWd1cmF0aW9uKHRydWUpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0bGV0IFtsb2NhbFVzZXIsIGFwcGxpY2F0aW9uXSA9IGF3YWl0IFByb21pc2UuYWxsKHByb21pc2VzKTtcblx0XHRcdGFwcGxpY2F0aW9uID0gYXBwbGljYXRpb24gPz8gdGhpcy5fY29uZmlndXJhdGlvbi5hcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb247XG5cdFx0XHRpZiAodGhpcy5hcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb24pIHtcblx0XHRcdFx0bG9jYWxVc2VyID0gdGhpcy5sb2NhbFVzZXJDb25maWd1cmF0aW9uLnJlcGFyc2UoeyBleGNsdWRlOiBhcHBsaWNhdGlvbi5nZXRWYWx1ZShBUFBMWV9BTExfUFJPRklMRVNfU0VUVElORykgfSk7XG5cdFx0XHR9XG5cdFx0XHRhd2FpdCB0aGlzLmxvYWRDb25maWd1cmF0aW9uKGFwcGxpY2F0aW9uLCBsb2NhbFVzZXIsIHRoaXMuX2NvbmZpZ3VyYXRpb24ucmVtb3RlVXNlckNvbmZpZ3VyYXRpb24sIHRydWUpO1xuXHRcdH0pKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkRlZmF1bHRDb25maWd1cmF0aW9uQ2hhbmdlZChjb25maWd1cmF0aW9uTW9kZWw6IENvbmZpZ3VyYXRpb25Nb2RlbCwgcHJvcGVydGllcz86IHN0cmluZ1tdKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMud29ya3NwYWNlKSB7XG5cdFx0XHRjb25zdCBwcmV2aW91c0RhdGEgPSB0aGlzLl9jb25maWd1cmF0aW9uLnRvRGF0YSgpO1xuXHRcdFx0Y29uc3QgY2hhbmdlID0gdGhpcy5fY29uZmlndXJhdGlvbi5jb21wYXJlQW5kVXBkYXRlRGVmYXVsdENvbmZpZ3VyYXRpb24oY29uZmlndXJhdGlvbk1vZGVsLCBwcm9wZXJ0aWVzKTtcblx0XHRcdGlmICh0aGlzLmFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbikge1xuXHRcdFx0XHR0aGlzLl9jb25maWd1cmF0aW9uLnVwZGF0ZUFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbih0aGlzLmFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbi5yZXBhcnNlKCkpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMucmVtb3RlVXNlckNvbmZpZ3VyYXRpb24pIHtcblx0XHRcdFx0dGhpcy5fY29uZmlndXJhdGlvbi51cGRhdGVMb2NhbFVzZXJDb25maWd1cmF0aW9uKHRoaXMubG9jYWxVc2VyQ29uZmlndXJhdGlvbi5yZXBhcnNlKCkpO1xuXHRcdFx0XHR0aGlzLl9jb25maWd1cmF0aW9uLnVwZGF0ZVJlbW90ZVVzZXJDb25maWd1cmF0aW9uKHRoaXMucmVtb3RlVXNlckNvbmZpZ3VyYXRpb24ucmVwYXJzZSgpKTtcblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLkZPTERFUikge1xuXHRcdFx0XHRjb25zdCBmb2xkZXJDb25maWd1cmF0aW9uID0gdGhpcy5jYWNoZWRGb2xkZXJDb25maWdzLmdldCh0aGlzLndvcmtzcGFjZS5mb2xkZXJzWzBdLnVyaSk7XG5cdFx0XHRcdGlmIChmb2xkZXJDb25maWd1cmF0aW9uKSB7XG5cdFx0XHRcdFx0dGhpcy5fY29uZmlndXJhdGlvbi51cGRhdGVXb3Jrc3BhY2VDb25maWd1cmF0aW9uKGZvbGRlckNvbmZpZ3VyYXRpb24ucmVwYXJzZSgpKTtcblx0XHRcdFx0XHR0aGlzLl9jb25maWd1cmF0aW9uLnVwZGF0ZUZvbGRlckNvbmZpZ3VyYXRpb24odGhpcy53b3Jrc3BhY2UuZm9sZGVyc1swXS51cmksIGZvbGRlckNvbmZpZ3VyYXRpb24ucmVwYXJzZSgpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fY29uZmlndXJhdGlvbi51cGRhdGVXb3Jrc3BhY2VDb25maWd1cmF0aW9uKHRoaXMud29ya3NwYWNlQ29uZmlndXJhdGlvbi5yZXBhcnNlV29ya3NwYWNlU2V0dGluZ3MoKSk7XG5cdFx0XHRcdGZvciAoY29uc3QgZm9sZGVyIG9mIHRoaXMud29ya3NwYWNlLmZvbGRlcnMpIHtcblx0XHRcdFx0XHRjb25zdCBmb2xkZXJDb25maWd1cmF0aW9uID0gdGhpcy5jYWNoZWRGb2xkZXJDb25maWdzLmdldChmb2xkZXIudXJpKTtcblx0XHRcdFx0XHRpZiAoZm9sZGVyQ29uZmlndXJhdGlvbikge1xuXHRcdFx0XHRcdFx0dGhpcy5fY29uZmlndXJhdGlvbi51cGRhdGVGb2xkZXJDb25maWd1cmF0aW9uKGZvbGRlci51cmksIGZvbGRlckNvbmZpZ3VyYXRpb24ucmVwYXJzZSgpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMudHJpZ2dlckNvbmZpZ3VyYXRpb25DaGFuZ2UoY2hhbmdlLCB7IGRhdGE6IHByZXZpb3VzRGF0YSwgd29ya3NwYWNlOiB0aGlzLndvcmtzcGFjZSB9LCBDb25maWd1cmF0aW9uVGFyZ2V0LkRFRkFVTFQpO1xuXHRcdFx0dGhpcy51cGRhdGVSZXN0cmljdGVkU2V0dGluZ3MoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uUG9saWN5Q29uZmlndXJhdGlvbkNoYW5nZWQocG9saWN5Q29uZmlndXJhdGlvbjogQ29uZmlndXJhdGlvbk1vZGVsKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJldmlvdXMgPSB7IGRhdGE6IHRoaXMuX2NvbmZpZ3VyYXRpb24udG9EYXRhKCksIHdvcmtzcGFjZTogdGhpcy53b3Jrc3BhY2UgfTtcblx0XHRjb25zdCBjaGFuZ2UgPSB0aGlzLl9jb25maWd1cmF0aW9uLmNvbXBhcmVBbmRVcGRhdGVQb2xpY3lDb25maWd1cmF0aW9uKHBvbGljeUNvbmZpZ3VyYXRpb24pO1xuXHRcdHRoaXMudHJpZ2dlckNvbmZpZ3VyYXRpb25DaGFuZ2UoY2hhbmdlLCBwcmV2aW91cywgQ29uZmlndXJhdGlvblRhcmdldC5ERUZBVUxUKTtcblx0fVxuXG5cdHByaXZhdGUgb25BcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb25DaGFuZ2VkKGFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbjogQ29uZmlndXJhdGlvbk1vZGVsKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJldmlvdXMgPSB7IGRhdGE6IHRoaXMuX2NvbmZpZ3VyYXRpb24udG9EYXRhKCksIHdvcmtzcGFjZTogdGhpcy53b3Jrc3BhY2UgfTtcblx0XHRjb25zdCBwcmV2aW91c0FsbFByb2ZpbGVzU2V0dGluZ3MgPSB0aGlzLl9jb25maWd1cmF0aW9uLmFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbi5nZXRWYWx1ZTxzdHJpbmdbXT4oQVBQTFlfQUxMX1BST0ZJTEVTX1NFVFRJTkcpID8/IFtdO1xuXHRcdGNvbnN0IGNoYW5nZSA9IHRoaXMuX2NvbmZpZ3VyYXRpb24uY29tcGFyZUFuZFVwZGF0ZUFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbihhcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb24pO1xuXHRcdGNvbnN0IGN1cnJlbnRBbGxQcm9maWxlc1NldHRpbmdzID0gdGhpcy5nZXRWYWx1ZTxzdHJpbmdbXT4oQVBQTFlfQUxMX1BST0ZJTEVTX1NFVFRJTkcpID8/IFtdO1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzID0gdGhpcy5jb25maWd1cmF0aW9uUmVnaXN0cnkuZ2V0Q29uZmlndXJhdGlvblByb3BlcnRpZXMoKTtcblx0XHRjb25zdCBjaGFuZ2VkS2V5czogc3RyaW5nW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IGNoYW5nZWRLZXkgb2YgY2hhbmdlLmtleXMpIHtcblx0XHRcdGNvbnN0IHNjb3BlID0gY29uZmlndXJhdGlvblByb3BlcnRpZXNbY2hhbmdlZEtleV0/LnNjb3BlO1xuXHRcdFx0aWYgKHNjb3BlICYmIEFQUExJQ0FUSU9OX1NDT1BFUy5pbmNsdWRlcyhzY29wZSkpIHtcblx0XHRcdFx0Y2hhbmdlZEtleXMucHVzaChjaGFuZ2VkS2V5KTtcblx0XHRcdFx0aWYgKGNoYW5nZWRLZXkgPT09IEFQUExZX0FMTF9QUk9GSUxFU19TRVRUSU5HKSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBwcmV2aW91c0FsbFByb2ZpbGVTZXR0aW5nIG9mIHByZXZpb3VzQWxsUHJvZmlsZXNTZXR0aW5ncykge1xuXHRcdFx0XHRcdFx0aWYgKCFjdXJyZW50QWxsUHJvZmlsZXNTZXR0aW5ncy5pbmNsdWRlcyhwcmV2aW91c0FsbFByb2ZpbGVTZXR0aW5nKSkge1xuXHRcdFx0XHRcdFx0XHRjaGFuZ2VkS2V5cy5wdXNoKHByZXZpb3VzQWxsUHJvZmlsZVNldHRpbmcpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRmb3IgKGNvbnN0IGN1cnJlbnRBbGxQcm9maWxlU2V0dGluZyBvZiBjdXJyZW50QWxsUHJvZmlsZXNTZXR0aW5ncykge1xuXHRcdFx0XHRcdFx0aWYgKCFwcmV2aW91c0FsbFByb2ZpbGVzU2V0dGluZ3MuaW5jbHVkZXMoY3VycmVudEFsbFByb2ZpbGVTZXR0aW5nKSkge1xuXHRcdFx0XHRcdFx0XHRjaGFuZ2VkS2V5cy5wdXNoKGN1cnJlbnRBbGxQcm9maWxlU2V0dGluZyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRlbHNlIGlmIChjdXJyZW50QWxsUHJvZmlsZXNTZXR0aW5ncy5pbmNsdWRlcyhjaGFuZ2VkS2V5KSkge1xuXHRcdFx0XHRjaGFuZ2VkS2V5cy5wdXNoKGNoYW5nZWRLZXkpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRjaGFuZ2Uua2V5cyA9IGNoYW5nZWRLZXlzO1xuXHRcdGlmIChjaGFuZ2Uua2V5cy5pbmNsdWRlcyhBUFBMWV9BTExfUFJPRklMRVNfU0VUVElORykpIHtcblx0XHRcdHRoaXMuX2NvbmZpZ3VyYXRpb24udXBkYXRlTG9jYWxVc2VyQ29uZmlndXJhdGlvbih0aGlzLmxvY2FsVXNlckNvbmZpZ3VyYXRpb24ucmVwYXJzZSh7IGV4Y2x1ZGU6IGN1cnJlbnRBbGxQcm9maWxlc1NldHRpbmdzIH0pKTtcblx0XHR9XG5cdFx0dGhpcy50cmlnZ2VyQ29uZmlndXJhdGlvbkNoYW5nZShjaGFuZ2UsIHByZXZpb3VzLCBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVIpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbkxvY2FsVXNlckNvbmZpZ3VyYXRpb25DaGFuZ2VkKHVzZXJDb25maWd1cmF0aW9uOiBDb25maWd1cmF0aW9uTW9kZWwpOiB2b2lkIHtcblx0XHRjb25zdCBwcmV2aW91cyA9IHsgZGF0YTogdGhpcy5fY29uZmlndXJhdGlvbi50b0RhdGEoKSwgd29ya3NwYWNlOiB0aGlzLndvcmtzcGFjZSB9O1xuXHRcdGNvbnN0IGNoYW5nZSA9IHRoaXMuX2NvbmZpZ3VyYXRpb24uY29tcGFyZUFuZFVwZGF0ZUxvY2FsVXNlckNvbmZpZ3VyYXRpb24odXNlckNvbmZpZ3VyYXRpb24pO1xuXHRcdHRoaXMudHJpZ2dlckNvbmZpZ3VyYXRpb25DaGFuZ2UoY2hhbmdlLCBwcmV2aW91cywgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSKTtcblx0fVxuXG5cdHByaXZhdGUgb25SZW1vdGVVc2VyQ29uZmlndXJhdGlvbkNoYW5nZWQodXNlckNvbmZpZ3VyYXRpb246IENvbmZpZ3VyYXRpb25Nb2RlbCk6IHZvaWQge1xuXHRcdGNvbnN0IHByZXZpb3VzID0geyBkYXRhOiB0aGlzLl9jb25maWd1cmF0aW9uLnRvRGF0YSgpLCB3b3Jrc3BhY2U6IHRoaXMud29ya3NwYWNlIH07XG5cdFx0Y29uc3QgY2hhbmdlID0gdGhpcy5fY29uZmlndXJhdGlvbi5jb21wYXJlQW5kVXBkYXRlUmVtb3RlVXNlckNvbmZpZ3VyYXRpb24odXNlckNvbmZpZ3VyYXRpb24pO1xuXHRcdHRoaXMudHJpZ2dlckNvbmZpZ3VyYXRpb25DaGFuZ2UoY2hhbmdlLCBwcmV2aW91cywgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb25Xb3Jrc3BhY2VDb25maWd1cmF0aW9uQ2hhbmdlZChmcm9tQ2FjaGU6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy53b3Jrc3BhY2UgJiYgdGhpcy53b3Jrc3BhY2UuY29uZmlndXJhdGlvbikge1xuXHRcdFx0bGV0IG5ld0ZvbGRlcnMgPSB0b1dvcmtzcGFjZUZvbGRlcnModGhpcy53b3Jrc3BhY2VDb25maWd1cmF0aW9uLmdldEZvbGRlcnMoKSwgdGhpcy53b3Jrc3BhY2UuY29uZmlndXJhdGlvbiwgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpKTtcblxuXHRcdFx0Ly8gVmFsaWRhdGUgb25seSBpZiB3b3Jrc3BhY2UgaXMgaW5pdGlhbGl6ZWRcblx0XHRcdGlmICh0aGlzLndvcmtzcGFjZS5pbml0aWFsaXplZCkge1xuXHRcdFx0XHRjb25zdCB7IGFkZGVkLCByZW1vdmVkLCBjaGFuZ2VkIH0gPSB0aGlzLmNvbXBhcmVGb2xkZXJzKHRoaXMud29ya3NwYWNlLmZvbGRlcnMsIG5ld0ZvbGRlcnMpO1xuXG5cdFx0XHRcdC8qIElmIGNoYW5nZWQgdmFsaWRhdGUgbmV3IGZvbGRlcnMgKi9cblx0XHRcdFx0aWYgKGFkZGVkLmxlbmd0aCB8fCByZW1vdmVkLmxlbmd0aCB8fCBjaGFuZ2VkLmxlbmd0aCkge1xuXHRcdFx0XHRcdG5ld0ZvbGRlcnMgPSBhd2FpdCB0aGlzLnRvVmFsaWRXb3Jrc3BhY2VGb2xkZXJzKG5ld0ZvbGRlcnMpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdC8qIE90aGVyd2lzZSB1c2UgZXhpc3RpbmcgKi9cblx0XHRcdFx0ZWxzZSB7XG5cdFx0XHRcdFx0bmV3Rm9sZGVycyA9IHRoaXMud29ya3NwYWNlLmZvbGRlcnM7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0YXdhaXQgdGhpcy51cGRhdGVXb3Jrc3BhY2VDb25maWd1cmF0aW9uKG5ld0ZvbGRlcnMsIHRoaXMud29ya3NwYWNlQ29uZmlndXJhdGlvbi5nZXRDb25maWd1cmF0aW9uKCksIGZyb21DYWNoZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVSZXN0cmljdGVkU2V0dGluZ3MoKTogdm9pZCB7XG5cdFx0Y29uc3QgY2hhbmdlZDogc3RyaW5nW10gPSBbXTtcblxuXHRcdGNvbnN0IGFsbFByb3BlcnRpZXMgPSB0aGlzLmNvbmZpZ3VyYXRpb25SZWdpc3RyeS5nZXRDb25maWd1cmF0aW9uUHJvcGVydGllcygpO1xuXHRcdGNvbnN0IGRlZmF1bHRSZXN0cmljdGVkU2V0dGluZ3M6IHN0cmluZ1tdID0gT2JqZWN0LmtleXMoYWxsUHJvcGVydGllcykuZmlsdGVyKGtleSA9PiBhbGxQcm9wZXJ0aWVzW2tleV0ucmVzdHJpY3RlZCkuc29ydCgoYSwgYikgPT4gYS5sb2NhbGVDb21wYXJlKGIpKTtcblx0XHRjb25zdCBkZWZhdWx0RGVsdGEgPSBkZWx0YShkZWZhdWx0UmVzdHJpY3RlZFNldHRpbmdzLCB0aGlzLl9yZXN0cmljdGVkU2V0dGluZ3MuZGVmYXVsdCwgKGEsIGIpID0+IGEubG9jYWxlQ29tcGFyZShiKSk7XG5cdFx0Y2hhbmdlZC5wdXNoKC4uLmRlZmF1bHREZWx0YS5hZGRlZCwgLi4uZGVmYXVsdERlbHRhLnJlbW92ZWQpO1xuXG5cdFx0Y29uc3QgYXBwbGljYXRpb24gPSAodGhpcy5hcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb24/LmdldFJlc3RyaWN0ZWRTZXR0aW5ncygpIHx8IFtdKS5zb3J0KChhLCBiKSA9PiBhLmxvY2FsZUNvbXBhcmUoYikpO1xuXHRcdGNvbnN0IGFwcGxpY2F0aW9uRGVsdGEgPSBkZWx0YShhcHBsaWNhdGlvbiwgdGhpcy5fcmVzdHJpY3RlZFNldHRpbmdzLmFwcGxpY2F0aW9uIHx8IFtdLCAoYSwgYikgPT4gYS5sb2NhbGVDb21wYXJlKGIpKTtcblx0XHRjaGFuZ2VkLnB1c2goLi4uYXBwbGljYXRpb25EZWx0YS5hZGRlZCwgLi4uYXBwbGljYXRpb25EZWx0YS5yZW1vdmVkKTtcblxuXHRcdGNvbnN0IHVzZXJMb2NhbCA9IHRoaXMubG9jYWxVc2VyQ29uZmlndXJhdGlvbi5nZXRSZXN0cmljdGVkU2V0dGluZ3MoKS5zb3J0KChhLCBiKSA9PiBhLmxvY2FsZUNvbXBhcmUoYikpO1xuXHRcdGNvbnN0IHVzZXJMb2NhbERlbHRhID0gZGVsdGEodXNlckxvY2FsLCB0aGlzLl9yZXN0cmljdGVkU2V0dGluZ3MudXNlckxvY2FsIHx8IFtdLCAoYSwgYikgPT4gYS5sb2NhbGVDb21wYXJlKGIpKTtcblx0XHRjaGFuZ2VkLnB1c2goLi4udXNlckxvY2FsRGVsdGEuYWRkZWQsIC4uLnVzZXJMb2NhbERlbHRhLnJlbW92ZWQpO1xuXG5cdFx0Y29uc3QgdXNlclJlbW90ZSA9ICh0aGlzLnJlbW90ZVVzZXJDb25maWd1cmF0aW9uPy5nZXRSZXN0cmljdGVkU2V0dGluZ3MoKSB8fCBbXSkuc29ydCgoYSwgYikgPT4gYS5sb2NhbGVDb21wYXJlKGIpKTtcblx0XHRjb25zdCB1c2VyUmVtb3RlRGVsdGEgPSBkZWx0YSh1c2VyUmVtb3RlLCB0aGlzLl9yZXN0cmljdGVkU2V0dGluZ3MudXNlclJlbW90ZSB8fCBbXSwgKGEsIGIpID0+IGEubG9jYWxlQ29tcGFyZShiKSk7XG5cdFx0Y2hhbmdlZC5wdXNoKC4uLnVzZXJSZW1vdGVEZWx0YS5hZGRlZCwgLi4udXNlclJlbW90ZURlbHRhLnJlbW92ZWQpO1xuXG5cdFx0Y29uc3Qgd29ya3NwYWNlRm9sZGVyTWFwID0gbmV3IFJlc291cmNlTWFwPFJlYWRvbmx5QXJyYXk8c3RyaW5nPj4oKTtcblx0XHRmb3IgKGNvbnN0IHdvcmtzcGFjZUZvbGRlciBvZiB0aGlzLndvcmtzcGFjZS5mb2xkZXJzKSB7XG5cdFx0XHRjb25zdCBjYWNoZWRGb2xkZXJDb25maWcgPSB0aGlzLmNhY2hlZEZvbGRlckNvbmZpZ3MuZ2V0KHdvcmtzcGFjZUZvbGRlci51cmkpO1xuXHRcdFx0Y29uc3QgZm9sZGVyUmVzdHJpY3RlZFNldHRpbmdzID0gKGNhY2hlZEZvbGRlckNvbmZpZz8uZ2V0UmVzdHJpY3RlZFNldHRpbmdzKCkgfHwgW10pLnNvcnQoKGEsIGIpID0+IGEubG9jYWxlQ29tcGFyZShiKSk7XG5cdFx0XHRpZiAoZm9sZGVyUmVzdHJpY3RlZFNldHRpbmdzLmxlbmd0aCkge1xuXHRcdFx0XHR3b3Jrc3BhY2VGb2xkZXJNYXAuc2V0KHdvcmtzcGFjZUZvbGRlci51cmksIGZvbGRlclJlc3RyaWN0ZWRTZXR0aW5ncyk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBwcmV2aW91cyA9IHRoaXMuX3Jlc3RyaWN0ZWRTZXR0aW5ncy53b3Jrc3BhY2VGb2xkZXI/LmdldCh3b3Jrc3BhY2VGb2xkZXIudXJpKSB8fCBbXTtcblx0XHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlckRlbHRhID0gZGVsdGEoZm9sZGVyUmVzdHJpY3RlZFNldHRpbmdzLCBwcmV2aW91cywgKGEsIGIpID0+IGEubG9jYWxlQ29tcGFyZShiKSk7XG5cdFx0XHRjaGFuZ2VkLnB1c2goLi4ud29ya3NwYWNlRm9sZGVyRGVsdGEuYWRkZWQsIC4uLndvcmtzcGFjZUZvbGRlckRlbHRhLnJlbW92ZWQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHdvcmtzcGFjZSA9IHRoaXMuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuV09SS1NQQUNFID8gdGhpcy53b3Jrc3BhY2VDb25maWd1cmF0aW9uLmdldFJlc3RyaWN0ZWRTZXR0aW5ncygpLnNvcnQoKGEsIGIpID0+IGEubG9jYWxlQ29tcGFyZShiKSlcblx0XHRcdDogdGhpcy53b3Jrc3BhY2UuZm9sZGVyc1swXSA/ICh3b3Jrc3BhY2VGb2xkZXJNYXAuZ2V0KHRoaXMud29ya3NwYWNlLmZvbGRlcnNbMF0udXJpKSB8fCBbXSkgOiBbXTtcblx0XHRjb25zdCB3b3Jrc3BhY2VEZWx0YSA9IGRlbHRhKHdvcmtzcGFjZSwgdGhpcy5fcmVzdHJpY3RlZFNldHRpbmdzLndvcmtzcGFjZSB8fCBbXSwgKGEsIGIpID0+IGEubG9jYWxlQ29tcGFyZShiKSk7XG5cdFx0Y2hhbmdlZC5wdXNoKC4uLndvcmtzcGFjZURlbHRhLmFkZGVkLCAuLi53b3Jrc3BhY2VEZWx0YS5yZW1vdmVkKTtcblxuXHRcdGlmIChjaGFuZ2VkLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5fcmVzdHJpY3RlZFNldHRpbmdzID0ge1xuXHRcdFx0XHRkZWZhdWx0OiBkZWZhdWx0UmVzdHJpY3RlZFNldHRpbmdzLFxuXHRcdFx0XHRhcHBsaWNhdGlvbjogYXBwbGljYXRpb24ubGVuZ3RoID8gYXBwbGljYXRpb24gOiB1bmRlZmluZWQsXG5cdFx0XHRcdHVzZXJMb2NhbDogdXNlckxvY2FsLmxlbmd0aCA/IHVzZXJMb2NhbCA6IHVuZGVmaW5lZCxcblx0XHRcdFx0dXNlclJlbW90ZTogdXNlclJlbW90ZS5sZW5ndGggPyB1c2VyUmVtb3RlIDogdW5kZWZpbmVkLFxuXHRcdFx0XHR3b3Jrc3BhY2U6IHdvcmtzcGFjZS5sZW5ndGggPyB3b3Jrc3BhY2UgOiB1bmRlZmluZWQsXG5cdFx0XHRcdHdvcmtzcGFjZUZvbGRlcjogd29ya3NwYWNlRm9sZGVyTWFwLnNpemUgPyB3b3Jrc3BhY2VGb2xkZXJNYXAgOiB1bmRlZmluZWQsXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VSZXN0cmljdGVkU2V0dGluZ3MuZmlyZSh0aGlzLnJlc3RyaWN0ZWRTZXR0aW5ncyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVXb3Jrc3BhY2VDb25maWd1cmF0aW9uKHdvcmtzcGFjZUZvbGRlcnM6IFdvcmtzcGFjZUZvbGRlcltdLCBjb25maWd1cmF0aW9uOiBDb25maWd1cmF0aW9uTW9kZWwsIGZyb21DYWNoZTogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHByZXZpb3VzID0geyBkYXRhOiB0aGlzLl9jb25maWd1cmF0aW9uLnRvRGF0YSgpLCB3b3Jrc3BhY2U6IHRoaXMud29ya3NwYWNlIH07XG5cdFx0Y29uc3QgY2hhbmdlID0gdGhpcy5fY29uZmlndXJhdGlvbi5jb21wYXJlQW5kVXBkYXRlV29ya3NwYWNlQ29uZmlndXJhdGlvbihjb25maWd1cmF0aW9uKTtcblx0XHRjb25zdCBjaGFuZ2VzID0gdGhpcy5jb21wYXJlRm9sZGVycyh0aGlzLndvcmtzcGFjZS5mb2xkZXJzLCB3b3Jrc3BhY2VGb2xkZXJzKTtcblx0XHRpZiAoY2hhbmdlcy5hZGRlZC5sZW5ndGggfHwgY2hhbmdlcy5yZW1vdmVkLmxlbmd0aCB8fCBjaGFuZ2VzLmNoYW5nZWQubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLndvcmtzcGFjZS5mb2xkZXJzID0gd29ya3NwYWNlRm9sZGVycztcblx0XHRcdGNvbnN0IGNoYW5nZSA9IGF3YWl0IHRoaXMub25Gb2xkZXJzQ2hhbmdlZCgpO1xuXHRcdFx0YXdhaXQgdGhpcy5oYW5kbGVXaWxsQ2hhbmdlV29ya3NwYWNlRm9sZGVycyhjaGFuZ2VzLCBmcm9tQ2FjaGUpO1xuXHRcdFx0dGhpcy50cmlnZ2VyQ29uZmlndXJhdGlvbkNoYW5nZShjaGFuZ2UsIHByZXZpb3VzLCBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRV9GT0xERVIpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VXb3Jrc3BhY2VGb2xkZXJzLmZpcmUoY2hhbmdlcyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudHJpZ2dlckNvbmZpZ3VyYXRpb25DaGFuZ2UoY2hhbmdlLCBwcmV2aW91cywgQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0UpO1xuXHRcdH1cblx0XHR0aGlzLnVwZGF0ZVJlc3RyaWN0ZWRTZXR0aW5ncygpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBoYW5kbGVXaWxsQ2hhbmdlV29ya3NwYWNlRm9sZGVycyhjaGFuZ2VzOiBJV29ya3NwYWNlRm9sZGVyc0NoYW5nZUV2ZW50LCBmcm9tQ2FjaGU6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBqb2luZXJzOiBQcm9taXNlPHZvaWQ+W10gPSBbXTtcblx0XHR0aGlzLl9vbldpbGxDaGFuZ2VXb3Jrc3BhY2VGb2xkZXJzLmZpcmUoe1xuXHRcdFx0am9pbih1cGRhdGVXb3Jrc3BhY2VUcnVzdFN0YXRlUHJvbWlzZSkge1xuXHRcdFx0XHRqb2luZXJzLnB1c2godXBkYXRlV29ya3NwYWNlVHJ1c3RTdGF0ZVByb21pc2UpO1xuXHRcdFx0fSxcblx0XHRcdGNoYW5nZXMsXG5cdFx0XHRmcm9tQ2FjaGVcblx0XHR9KTtcblx0XHR0cnkgeyBhd2FpdCBQcm9taXNlcy5zZXR0bGVkKGpvaW5lcnMpOyB9IGNhdGNoIChlcnJvcikgeyAvKiBJZ25vcmUgKi8gfVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvbldvcmtzcGFjZUZvbGRlckNvbmZpZ3VyYXRpb25DaGFuZ2VkKGZvbGRlcjogSVdvcmtzcGFjZUZvbGRlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IFtmb2xkZXJDb25maWd1cmF0aW9uXSA9IGF3YWl0IHRoaXMubG9hZEZvbGRlckNvbmZpZ3VyYXRpb25zKFtmb2xkZXJdKTtcblx0XHRjb25zdCBwcmV2aW91cyA9IHsgZGF0YTogdGhpcy5fY29uZmlndXJhdGlvbi50b0RhdGEoKSwgd29ya3NwYWNlOiB0aGlzLndvcmtzcGFjZSB9O1xuXHRcdGNvbnN0IGZvbGRlckNvbmZpZ3VyYXRpb25DaGFuZ2UgPSB0aGlzLl9jb25maWd1cmF0aW9uLmNvbXBhcmVBbmRVcGRhdGVGb2xkZXJDb25maWd1cmF0aW9uKGZvbGRlci51cmksIGZvbGRlckNvbmZpZ3VyYXRpb24pO1xuXHRcdGlmICh0aGlzLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLkZPTERFUikge1xuXHRcdFx0Y29uc3Qgd29ya3NwYWNlQ29uZmlndXJhdGlvbkNoYW5nZSA9IHRoaXMuX2NvbmZpZ3VyYXRpb24uY29tcGFyZUFuZFVwZGF0ZVdvcmtzcGFjZUNvbmZpZ3VyYXRpb24oZm9sZGVyQ29uZmlndXJhdGlvbik7XG5cdFx0XHR0aGlzLnRyaWdnZXJDb25maWd1cmF0aW9uQ2hhbmdlKG1lcmdlQ2hhbmdlcyhmb2xkZXJDb25maWd1cmF0aW9uQ2hhbmdlLCB3b3Jrc3BhY2VDb25maWd1cmF0aW9uQ2hhbmdlKSwgcHJldmlvdXMsIENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy50cmlnZ2VyQ29uZmlndXJhdGlvbkNoYW5nZShmb2xkZXJDb25maWd1cmF0aW9uQ2hhbmdlLCBwcmV2aW91cywgQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0VfRk9MREVSKTtcblx0XHR9XG5cdFx0dGhpcy51cGRhdGVSZXN0cmljdGVkU2V0dGluZ3MoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb25Gb2xkZXJzQ2hhbmdlZCgpOiBQcm9taXNlPElDb25maWd1cmF0aW9uQ2hhbmdlPiB7XG5cdFx0Y29uc3QgY2hhbmdlczogSUNvbmZpZ3VyYXRpb25DaGFuZ2VbXSA9IFtdO1xuXG5cdFx0Ly8gUmVtb3ZlIHRoZSBjb25maWd1cmF0aW9ucyBvZiBkZWxldGVkIGZvbGRlcnNcblx0XHRmb3IgKGNvbnN0IGtleSBvZiB0aGlzLmNhY2hlZEZvbGRlckNvbmZpZ3Mua2V5cygpKSB7XG5cdFx0XHRpZiAoIXRoaXMud29ya3NwYWNlLmZvbGRlcnMuZmlsdGVyKGZvbGRlciA9PiBmb2xkZXIudXJpLnRvU3RyaW5nKCkgPT09IGtleS50b1N0cmluZygpKVswXSkge1xuXHRcdFx0XHRjb25zdCBmb2xkZXJDb25maWd1cmF0aW9uID0gdGhpcy5jYWNoZWRGb2xkZXJDb25maWdzLmdldChrZXkpO1xuXHRcdFx0XHRmb2xkZXJDb25maWd1cmF0aW9uIS5kaXNwb3NlKCk7XG5cdFx0XHRcdHRoaXMuY2FjaGVkRm9sZGVyQ29uZmlncy5kZWxldGUoa2V5KTtcblx0XHRcdFx0Y2hhbmdlcy5wdXNoKHRoaXMuX2NvbmZpZ3VyYXRpb24uY29tcGFyZUFuZERlbGV0ZUZvbGRlckNvbmZpZ3VyYXRpb24oa2V5KSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgdG9Jbml0aWFsaXplID0gdGhpcy53b3Jrc3BhY2UuZm9sZGVycy5maWx0ZXIoZm9sZGVyID0+ICF0aGlzLmNhY2hlZEZvbGRlckNvbmZpZ3MuaGFzKGZvbGRlci51cmkpKTtcblx0XHRpZiAodG9Jbml0aWFsaXplLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgZm9sZGVyQ29uZmlndXJhdGlvbnMgPSBhd2FpdCB0aGlzLmxvYWRGb2xkZXJDb25maWd1cmF0aW9ucyh0b0luaXRpYWxpemUpO1xuXHRcdFx0Zm9sZGVyQ29uZmlndXJhdGlvbnMuZm9yRWFjaCgoZm9sZGVyQ29uZmlndXJhdGlvbiwgaW5kZXgpID0+IHtcblx0XHRcdFx0Y2hhbmdlcy5wdXNoKHRoaXMuX2NvbmZpZ3VyYXRpb24uY29tcGFyZUFuZFVwZGF0ZUZvbGRlckNvbmZpZ3VyYXRpb24odG9Jbml0aWFsaXplW2luZGV4XS51cmksIGZvbGRlckNvbmZpZ3VyYXRpb24pKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gbWVyZ2VDaGFuZ2VzKC4uLmNoYW5nZXMpO1xuXHR9XG5cblx0cHJpdmF0ZSBsb2FkRm9sZGVyQ29uZmlndXJhdGlvbnMoZm9sZGVyczogSVdvcmtzcGFjZUZvbGRlcltdKTogUHJvbWlzZTxDb25maWd1cmF0aW9uTW9kZWxbXT4ge1xuXHRcdHJldHVybiBQcm9taXNlLmFsbChbLi4uZm9sZGVycy5tYXAoZm9sZGVyID0+IHtcblx0XHRcdGxldCBmb2xkZXJDb25maWd1cmF0aW9uID0gdGhpcy5jYWNoZWRGb2xkZXJDb25maWdzLmdldChmb2xkZXIudXJpKTtcblx0XHRcdGlmICghZm9sZGVyQ29uZmlndXJhdGlvbikge1xuXHRcdFx0XHRmb2xkZXJDb25maWd1cmF0aW9uID0gbmV3IEZvbGRlckNvbmZpZ3VyYXRpb24oIXRoaXMuaW5pdGlhbGl6ZWQsIGZvbGRlciwgRk9MREVSX0NPTkZJR19GT0xERVJfTkFNRSwgdGhpcy5nZXRXb3JrYmVuY2hTdGF0ZSgpLCB0aGlzLmlzV29ya3NwYWNlVHJ1c3RlZCwgdGhpcy5maWxlU2VydmljZSwgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UsIHRoaXMubG9nU2VydmljZSwgdGhpcy5jb25maWd1cmF0aW9uQ2FjaGUpO1xuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcihmb2xkZXJDb25maWd1cmF0aW9uLm9uRGlkQ2hhbmdlKCgpID0+IHRoaXMub25Xb3Jrc3BhY2VGb2xkZXJDb25maWd1cmF0aW9uQ2hhbmdlZChmb2xkZXIpKSk7XG5cdFx0XHRcdHRoaXMuY2FjaGVkRm9sZGVyQ29uZmlncy5zZXQoZm9sZGVyLnVyaSwgdGhpcy5fcmVnaXN0ZXIoZm9sZGVyQ29uZmlndXJhdGlvbikpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGZvbGRlckNvbmZpZ3VyYXRpb24ubG9hZENvbmZpZ3VyYXRpb24oKTtcblx0XHR9KV0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB2YWxpZGF0ZVdvcmtzcGFjZUZvbGRlcnNBbmRSZWxvYWQoZnJvbUNhY2hlOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdmFsaWRXb3Jrc3BhY2VGb2xkZXJzID0gYXdhaXQgdGhpcy50b1ZhbGlkV29ya3NwYWNlRm9sZGVycyh0aGlzLndvcmtzcGFjZS5mb2xkZXJzKTtcblx0XHRjb25zdCB7IHJlbW92ZWQgfSA9IHRoaXMuY29tcGFyZUZvbGRlcnModGhpcy53b3Jrc3BhY2UuZm9sZGVycywgdmFsaWRXb3Jrc3BhY2VGb2xkZXJzKTtcblx0XHRpZiAocmVtb3ZlZC5sZW5ndGgpIHtcblx0XHRcdGF3YWl0IHRoaXMudXBkYXRlV29ya3NwYWNlQ29uZmlndXJhdGlvbih2YWxpZFdvcmtzcGFjZUZvbGRlcnMsIHRoaXMud29ya3NwYWNlQ29uZmlndXJhdGlvbi5nZXRDb25maWd1cmF0aW9uKCksIGZyb21DYWNoZSk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gRmlsdGVyIG91dCB3b3Jrc3BhY2UgZm9sZGVycyB3aGljaCBhcmUgZmlsZXMgKG5vdCBkaXJlY3Rvcmllcylcblx0Ly8gV29ya3NwYWNlIGZvbGRlcnMgdGhvc2UgY2Fubm90IGJlIHJlc29sdmVkIGFyZSBub3QgZmlsdGVyZWQgYmVjYXVzZSB0aGV5IGFyZSBoYW5kbGVkIGJ5IHRoZSBFeHBsb3Jlci5cblx0cHJpdmF0ZSBhc3luYyB0b1ZhbGlkV29ya3NwYWNlRm9sZGVycyh3b3Jrc3BhY2VGb2xkZXJzOiBXb3Jrc3BhY2VGb2xkZXJbXSk6IFByb21pc2U8V29ya3NwYWNlRm9sZGVyW10+IHtcblx0XHRjb25zdCB2YWxpZFdvcmtzcGFjZUZvbGRlcnM6IFdvcmtzcGFjZUZvbGRlcltdID0gW107XG5cdFx0Zm9yIChjb25zdCB3b3Jrc3BhY2VGb2xkZXIgb2Ygd29ya3NwYWNlRm9sZGVycykge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5zdGF0KHdvcmtzcGFjZUZvbGRlci51cmkpO1xuXHRcdFx0XHRpZiAoIXJlc3VsdC5pc0RpcmVjdG9yeSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS53YXJuKGBJZ25vcmluZyB0aGUgZXJyb3Igd2hpbGUgdmFsaWRhdGluZyB3b3Jrc3BhY2UgZm9sZGVyICR7d29ya3NwYWNlRm9sZGVyLnVyaS50b1N0cmluZygpfSAtICR7dG9FcnJvck1lc3NhZ2UoZSl9YCk7XG5cdFx0XHR9XG5cdFx0XHR2YWxpZFdvcmtzcGFjZUZvbGRlcnMucHVzaCh3b3Jrc3BhY2VGb2xkZXIpO1xuXHRcdH1cblx0XHRyZXR1cm4gdmFsaWRXb3Jrc3BhY2VGb2xkZXJzO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB3cml0ZUNvbmZpZ3VyYXRpb25WYWx1ZShrZXk6IHN0cmluZywgdmFsdWU6IGFueSwgdGFyZ2V0OiBDb25maWd1cmF0aW9uVGFyZ2V0LCBvdmVycmlkZXM6IElDb25maWd1cmF0aW9uVXBkYXRlT3ZlcnJpZGVzIHwgdW5kZWZpbmVkLCBvcHRpb25zPzogSUNvbmZpZ3VyYXRpb25VcGRhdGVPdmVycmlkZXMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IHdyaXRlIGNvbmZpZ3VyYXRpb24gYmVjYXVzZSB0aGUgY29uZmlndXJhdGlvbiBzZXJ2aWNlIGlzIG5vdCB5ZXQgcmVhZHkgdG8gYWNjZXB0IHdyaXRlcy4nKTtcblx0XHR9XG5cblx0XHRpZiAodGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LkRFRkFVTFQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCBjb25maWd1cmF0aW9uIHRhcmdldCcpO1xuXHRcdH1cblxuXHRcdGlmICh0YXJnZXQgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuTUVNT1JZKSB7XG5cdFx0XHRjb25zdCBwcmV2aW91cyA9IHsgZGF0YTogdGhpcy5fY29uZmlndXJhdGlvbi50b0RhdGEoKSwgd29ya3NwYWNlOiB0aGlzLndvcmtzcGFjZSB9O1xuXHRcdFx0dGhpcy5fY29uZmlndXJhdGlvbi51cGRhdGVWYWx1ZShrZXksIHZhbHVlLCBvdmVycmlkZXMpO1xuXHRcdFx0dGhpcy50cmlnZ2VyQ29uZmlndXJhdGlvbkNoYW5nZSh7IGtleXM6IG92ZXJyaWRlcz8ub3ZlcnJpZGVJZGVudGlmaWVycz8ubGVuZ3RoID8gW2tleUZyb21PdmVycmlkZUlkZW50aWZpZXJzKG92ZXJyaWRlcy5vdmVycmlkZUlkZW50aWZpZXJzKSwga2V5XSA6IFtrZXldLCBvdmVycmlkZXM6IG92ZXJyaWRlcz8ub3ZlcnJpZGVJZGVudGlmaWVycz8ubGVuZ3RoID8gb3ZlcnJpZGVzLm92ZXJyaWRlSWRlbnRpZmllcnMubWFwKG92ZXJyaWRlSWRlbnRpZmllciA9PiAoW292ZXJyaWRlSWRlbnRpZmllciwgW2tleV1dKSkgOiBbXSB9LCBwcmV2aW91cywgdGFyZ2V0KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlZGl0YWJsZUNvbmZpZ3VyYXRpb25UYXJnZXQgPSB0aGlzLnRvRWRpdGFibGVDb25maWd1cmF0aW9uVGFyZ2V0KHRhcmdldCwga2V5KTtcblx0XHRpZiAoIWVkaXRhYmxlQ29uZmlndXJhdGlvblRhcmdldCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvbmZpZ3VyYXRpb24gdGFyZ2V0Jyk7XG5cdFx0fVxuXG5cdFx0aWYgKGVkaXRhYmxlQ29uZmlndXJhdGlvblRhcmdldCA9PT0gRWRpdGFibGVDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfUkVNT1RFICYmICF0aGlzLnJlbW90ZVVzZXJDb25maWd1cmF0aW9uKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgY29uZmlndXJhdGlvbiB0YXJnZXQnKTtcblx0XHR9XG5cblx0XHRpZiAob3ZlcnJpZGVzPy5vdmVycmlkZUlkZW50aWZpZXJzPy5sZW5ndGggJiYgb3ZlcnJpZGVzLm92ZXJyaWRlSWRlbnRpZmllcnMubGVuZ3RoID4gMSkge1xuXHRcdFx0Y29uc3QgY29uZmlndXJhdGlvbk1vZGVsID0gdGhpcy5nZXRDb25maWd1cmF0aW9uTW9kZWxGb3JFZGl0YWJsZUNvbmZpZ3VyYXRpb25UYXJnZXQoZWRpdGFibGVDb25maWd1cmF0aW9uVGFyZ2V0LCBvdmVycmlkZXMucmVzb3VyY2UpO1xuXHRcdFx0aWYgKGNvbmZpZ3VyYXRpb25Nb2RlbCkge1xuXHRcdFx0XHRjb25zdCBvdmVycmlkZUlkZW50aWZpZXJzID0gb3ZlcnJpZGVzLm92ZXJyaWRlSWRlbnRpZmllcnMuc29ydCgpO1xuXHRcdFx0XHRjb25zdCBleGlzdGluZ092ZXJyaWRlcyA9IGNvbmZpZ3VyYXRpb25Nb2RlbC5vdmVycmlkZXMuZmluZChvdmVycmlkZSA9PiBhcnJheUVxdWFscyhbLi4ub3ZlcnJpZGUuaWRlbnRpZmllcnNdLnNvcnQoKSwgb3ZlcnJpZGVJZGVudGlmaWVycykpO1xuXHRcdFx0XHRpZiAoZXhpc3RpbmdPdmVycmlkZXMpIHtcblx0XHRcdFx0XHRvdmVycmlkZXMub3ZlcnJpZGVJZGVudGlmaWVycyA9IGV4aXN0aW5nT3ZlcnJpZGVzLmlkZW50aWZpZXJzO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gVXNlIHNhbWUgaW5zdGFuY2Ugb2YgQ29uZmlndXJhdGlvbkVkaXRpbmcgdG8gbWFrZSBzdXJlIGFsbCB3cml0ZXMgZ28gdGhyb3VnaCB0aGUgc2FtZSBxdWV1ZVxuXHRcdHRoaXMuY29uZmlndXJhdGlvbkVkaXRpbmcgPSB0aGlzLmNvbmZpZ3VyYXRpb25FZGl0aW5nID8/IHRoaXMuY3JlYXRlQ29uZmlndXJhdGlvbkVkaXRpbmdTZXJ2aWNlKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGF3YWl0IChhd2FpdCB0aGlzLmNvbmZpZ3VyYXRpb25FZGl0aW5nKS53cml0ZUNvbmZpZ3VyYXRpb24oZWRpdGFibGVDb25maWd1cmF0aW9uVGFyZ2V0LCB7IGtleSwgdmFsdWUgfSwgeyBzY29wZXM6IG92ZXJyaWRlcywgLi4ub3B0aW9ucyB9KTtcblx0XHRzd2l0Y2ggKGVkaXRhYmxlQ29uZmlndXJhdGlvblRhcmdldCkge1xuXHRcdFx0Y2FzZSBFZGl0YWJsZUNvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTDpcblx0XHRcdFx0aWYgKHRoaXMuYXBwbGljYXRpb25Db25maWd1cmF0aW9uICYmIHRoaXMuaXNTZXR0aW5nQXBwbGllZEZvckFsbFByb2ZpbGVzKGtleSkpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLnJlbG9hZEFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbigpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMucmVsb2FkTG9jYWxVc2VyQ29uZmlndXJhdGlvbigpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdGNhc2UgRWRpdGFibGVDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfUkVNT1RFOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5yZWxvYWRSZW1vdGVVc2VyQ29uZmlndXJhdGlvbigpLnRoZW4oKCkgPT4gdW5kZWZpbmVkKTtcblx0XHRcdGNhc2UgRWRpdGFibGVDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRTpcblx0XHRcdFx0cmV0dXJuIHRoaXMucmVsb2FkV29ya3NwYWNlQ29uZmlndXJhdGlvbigpO1xuXHRcdFx0Y2FzZSBFZGl0YWJsZUNvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFX0ZPTERFUjoge1xuXHRcdFx0XHRjb25zdCB3b3Jrc3BhY2VGb2xkZXIgPSBvdmVycmlkZXMgJiYgb3ZlcnJpZGVzLnJlc291cmNlID8gdGhpcy53b3Jrc3BhY2UuZ2V0Rm9sZGVyKG92ZXJyaWRlcy5yZXNvdXJjZSkgOiBudWxsO1xuXHRcdFx0XHRpZiAod29ya3NwYWNlRm9sZGVyKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMucmVsb2FkV29ya3NwYWNlRm9sZGVyQ29uZmlndXJhdGlvbih3b3Jrc3BhY2VGb2xkZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjcmVhdGVDb25maWd1cmF0aW9uRWRpdGluZ1NlcnZpY2UoaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSk6IFByb21pc2U8Q29uZmlndXJhdGlvbkVkaXRpbmc+IHtcblx0XHRjb25zdCByZW1vdGVTZXR0aW5nc1Jlc291cmNlID0gKGF3YWl0IHRoaXMucmVtb3RlQWdlbnRTZXJ2aWNlLmdldEVudmlyb25tZW50KCkpPy5zZXR0aW5nc1BhdGggPz8gbnVsbDtcblx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29uZmlndXJhdGlvbkVkaXRpbmcsIHJlbW90ZVNldHRpbmdzUmVzb3VyY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRDb25maWd1cmF0aW9uTW9kZWxGb3JFZGl0YWJsZUNvbmZpZ3VyYXRpb25UYXJnZXQodGFyZ2V0OiBFZGl0YWJsZUNvbmZpZ3VyYXRpb25UYXJnZXQsIHJlc291cmNlPzogVVJJIHwgbnVsbCk6IENvbmZpZ3VyYXRpb25Nb2RlbCB8IHVuZGVmaW5lZCB7XG5cdFx0c3dpdGNoICh0YXJnZXQpIHtcblx0XHRcdGNhc2UgRWRpdGFibGVDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUw6IHJldHVybiB0aGlzLl9jb25maWd1cmF0aW9uLmxvY2FsVXNlckNvbmZpZ3VyYXRpb247XG5cdFx0XHRjYXNlIEVkaXRhYmxlQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX1JFTU9URTogcmV0dXJuIHRoaXMuX2NvbmZpZ3VyYXRpb24ucmVtb3RlVXNlckNvbmZpZ3VyYXRpb247XG5cdFx0XHRjYXNlIEVkaXRhYmxlQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0U6IHJldHVybiB0aGlzLl9jb25maWd1cmF0aW9uLndvcmtzcGFjZUNvbmZpZ3VyYXRpb247XG5cdFx0XHRjYXNlIEVkaXRhYmxlQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0VfRk9MREVSOiByZXR1cm4gcmVzb3VyY2UgPyB0aGlzLl9jb25maWd1cmF0aW9uLmZvbGRlckNvbmZpZ3VyYXRpb25zLmdldChyZXNvdXJjZSkgOiB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0Z2V0Q29uZmlndXJhdGlvbk1vZGVsKHRhcmdldDogQ29uZmlndXJhdGlvblRhcmdldCwgcmVzb3VyY2U/OiBVUkkgfCBudWxsKTogQ29uZmlndXJhdGlvbk1vZGVsIHwgdW5kZWZpbmVkIHtcblx0XHRzd2l0Y2ggKHRhcmdldCkge1xuXHRcdFx0Y2FzZSBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUw6IHJldHVybiB0aGlzLl9jb25maWd1cmF0aW9uLmxvY2FsVXNlckNvbmZpZ3VyYXRpb247XG5cdFx0XHRjYXNlIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9SRU1PVEU6IHJldHVybiB0aGlzLl9jb25maWd1cmF0aW9uLnJlbW90ZVVzZXJDb25maWd1cmF0aW9uO1xuXHRcdFx0Y2FzZSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRTogcmV0dXJuIHRoaXMuX2NvbmZpZ3VyYXRpb24ud29ya3NwYWNlQ29uZmlndXJhdGlvbjtcblx0XHRcdGNhc2UgQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0VfRk9MREVSOiByZXR1cm4gcmVzb3VyY2UgPyB0aGlzLl9jb25maWd1cmF0aW9uLmZvbGRlckNvbmZpZ3VyYXRpb25zLmdldChyZXNvdXJjZSkgOiB1bmRlZmluZWQ7XG5cdFx0XHRkZWZhdWx0OiByZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZGVyaXZlQ29uZmlndXJhdGlvblRhcmdldHMoa2V5OiBzdHJpbmcsIHZhbHVlOiBhbnksIGluc3BlY3Q6IElDb25maWd1cmF0aW9uVmFsdWU8YW55Pik6IENvbmZpZ3VyYXRpb25UYXJnZXRbXSB7XG5cdFx0aWYgKGVxdWFscyh2YWx1ZSwgaW5zcGVjdC52YWx1ZSkpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRjb25zdCBkZWZpbmVkVGFyZ2V0czogQ29uZmlndXJhdGlvblRhcmdldFtdID0gW107XG5cdFx0aWYgKGluc3BlY3Qud29ya3NwYWNlRm9sZGVyVmFsdWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0ZGVmaW5lZFRhcmdldHMucHVzaChDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRV9GT0xERVIpO1xuXHRcdH1cblx0XHRpZiAoaW5zcGVjdC53b3Jrc3BhY2VWYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRkZWZpbmVkVGFyZ2V0cy5wdXNoKENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFKTtcblx0XHR9XG5cdFx0aWYgKGluc3BlY3QudXNlclJlbW90ZVZhbHVlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGRlZmluZWRUYXJnZXRzLnB1c2goQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX1JFTU9URSk7XG5cdFx0fVxuXHRcdGlmIChpbnNwZWN0LnVzZXJMb2NhbFZhbHVlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGRlZmluZWRUYXJnZXRzLnB1c2goQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMKTtcblx0XHR9XG5cdFx0aWYgKGluc3BlY3QuYXBwbGljYXRpb25WYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRkZWZpbmVkVGFyZ2V0cy5wdXNoKENvbmZpZ3VyYXRpb25UYXJnZXQuQVBQTElDQVRJT04pO1xuXHRcdH1cblxuXHRcdGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHQvLyBSZW1vdmUgdGhlIHNldHRpbmcgaW4gYWxsIGRlZmluZWQgdGFyZ2V0c1xuXHRcdFx0cmV0dXJuIGRlZmluZWRUYXJnZXRzO1xuXHRcdH1cblxuXHRcdHJldHVybiBbZGVmaW5lZFRhcmdldHNbMF0gfHwgQ29uZmlndXJhdGlvblRhcmdldC5VU0VSXTtcblx0fVxuXG5cdHByaXZhdGUgdHJpZ2dlckNvbmZpZ3VyYXRpb25DaGFuZ2UoY2hhbmdlOiBJQ29uZmlndXJhdGlvbkNoYW5nZSwgcHJldmlvdXM6IHsgZGF0YTogSUNvbmZpZ3VyYXRpb25EYXRhOyB3b3Jrc3BhY2U/OiBXb3Jrc3BhY2UgfSB8IHVuZGVmaW5lZCwgdGFyZ2V0OiBDb25maWd1cmF0aW9uVGFyZ2V0KTogdm9pZCB7XG5cdFx0aWYgKGNoYW5nZS5rZXlzLmxlbmd0aCkge1xuXHRcdFx0aWYgKHRhcmdldCAhPT0gQ29uZmlndXJhdGlvblRhcmdldC5ERUZBVUxUKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5kZWJ1ZyhgQ29uZmlndXJhdGlvbiBrZXlzIGNoYW5nZWQgaW4gJHtDb25maWd1cmF0aW9uVGFyZ2V0VG9TdHJpbmcodGFyZ2V0KX0gdGFyZ2V0YCwgLi4uY2hhbmdlLmtleXMpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgY29uZmlndXJhdGlvbkNoYW5nZUV2ZW50ID0gbmV3IENvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudChjaGFuZ2UsIHByZXZpb3VzLCB0aGlzLl9jb25maWd1cmF0aW9uLCB0aGlzLndvcmtzcGFjZSwgdGhpcy5sb2dTZXJ2aWNlKTtcblx0XHRcdGNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudC5zb3VyY2UgPSB0YXJnZXQ7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24uZmlyZShjb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdG9FZGl0YWJsZUNvbmZpZ3VyYXRpb25UYXJnZXQodGFyZ2V0OiBDb25maWd1cmF0aW9uVGFyZ2V0LCBrZXk6IHN0cmluZyk6IEVkaXRhYmxlQ29uZmlndXJhdGlvblRhcmdldCB8IG51bGwge1xuXHRcdGlmICh0YXJnZXQgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuQVBQTElDQVRJT04pIHtcblx0XHRcdHJldHVybiBFZGl0YWJsZUNvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTDtcblx0XHR9XG5cdFx0aWYgKHRhcmdldCA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5VU0VSKSB7XG5cdFx0XHRpZiAodGhpcy5yZW1vdGVVc2VyQ29uZmlndXJhdGlvbikge1xuXHRcdFx0XHRjb25zdCBzY29wZSA9IHRoaXMuY29uZmlndXJhdGlvblJlZ2lzdHJ5LmdldENvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzKClba2V5XT8uc2NvcGU7XG5cdFx0XHRcdGlmIChzY29wZSA9PT0gQ29uZmlndXJhdGlvblNjb3BlLk1BQ0hJTkUgfHwgc2NvcGUgPT09IENvbmZpZ3VyYXRpb25TY29wZS5NQUNISU5FX09WRVJSSURBQkxFIHx8IHNjb3BlID09PSBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT05fTUFDSElORSkge1xuXHRcdFx0XHRcdHJldHVybiBFZGl0YWJsZUNvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9SRU1PVEU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRoaXMuaW5zcGVjdChrZXkpLnVzZXJSZW1vdGVWYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuIEVkaXRhYmxlQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX1JFTU9URTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIEVkaXRhYmxlQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMO1xuXHRcdH1cblx0XHRpZiAodGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUwpIHtcblx0XHRcdHJldHVybiBFZGl0YWJsZUNvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTDtcblx0XHR9XG5cdFx0aWYgKHRhcmdldCA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX1JFTU9URSkge1xuXHRcdFx0cmV0dXJuIEVkaXRhYmxlQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX1JFTU9URTtcblx0XHR9XG5cdFx0aWYgKHRhcmdldCA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0UpIHtcblx0XHRcdHJldHVybiBFZGl0YWJsZUNvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFO1xuXHRcdH1cblx0XHRpZiAodGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRV9GT0xERVIpIHtcblx0XHRcdHJldHVybiBFZGl0YWJsZUNvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFX0ZPTERFUjtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cbn1cblxuY2xhc3MgUmVnaXN0ZXJDb25maWd1cmF0aW9uU2NoZW1hc0NvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZTogSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJTGlmZWN5Y2xlU2VydmljZSBsaWZlY3ljbGVTZXJ2aWNlOiBJTGlmZWN5Y2xlU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGV4dGVuc2lvblNlcnZpY2Uud2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCkudGhlbigoKSA9PiB7XG5cdFx0XHR0aGlzLnJlZ2lzdGVyQ29uZmlndXJhdGlvblNjaGVtYXMoKTtcblxuXHRcdFx0Y29uc3QgY29uZmlndXJhdGlvblJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKTtcblx0XHRcdGNvbnN0IGRlbGF5ZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGVsYXllcjx2b2lkPig1MCkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuYW55KGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5vbkRpZFVwZGF0ZUNvbmZpZ3VyYXRpb24sIGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5vbkRpZFNjaGVtYUNoYW5nZSwgd29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5vbkRpZENoYW5nZVRydXN0KSgoKSA9PlxuXHRcdFx0XHRkZWxheWVyLnRyaWdnZXIoKCkgPT4gdGhpcy5yZWdpc3RlckNvbmZpZ3VyYXRpb25TY2hlbWFzKCksIGxpZmVjeWNsZVNlcnZpY2UucGhhc2UgPT09IExpZmVjeWNsZVBoYXNlLkV2ZW50dWFsbHkgPyB1bmRlZmluZWQgOiAyNTAwIC8qIGRlbGF5IGxvbmdlciBpbiBlYXJseSBwaGFzZXMgKi8pKSk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyQ29uZmlndXJhdGlvblNjaGVtYXMoKTogdm9pZCB7XG5cdFx0Y29uc3QgYWxsU2V0dGluZ3NTY2hlbWE6IElKU09OU2NoZW1hID0ge1xuXHRcdFx0cHJvcGVydGllczogYWxsU2V0dGluZ3MucHJvcGVydGllcyxcblx0XHRcdHBhdHRlcm5Qcm9wZXJ0aWVzOiBhbGxTZXR0aW5ncy5wYXR0ZXJuUHJvcGVydGllcyxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB0cnVlLFxuXHRcdFx0YWxsb3dUcmFpbGluZ0NvbW1hczogdHJ1ZSxcblx0XHRcdGFsbG93Q29tbWVudHM6IHRydWVcblx0XHR9O1xuXG5cdFx0Y29uc3QgdXNlclNldHRpbmdzU2NoZW1hOiBJSlNPTlNjaGVtYSA9IHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSA/XG5cdFx0XHR7XG5cdFx0XHRcdHByb3BlcnRpZXM6IE9iamVjdC5hc3NpZ24oe30sXG5cdFx0XHRcdFx0YXBwbGljYXRpb25TZXR0aW5ncy5wcm9wZXJ0aWVzLFxuXHRcdFx0XHRcdHdpbmRvd1NldHRpbmdzLnByb3BlcnRpZXMsXG5cdFx0XHRcdFx0cmVzb3VyY2VTZXR0aW5ncy5wcm9wZXJ0aWVzXG5cdFx0XHRcdCksXG5cdFx0XHRcdHBhdHRlcm5Qcm9wZXJ0aWVzOiBhbGxTZXR0aW5ncy5wYXR0ZXJuUHJvcGVydGllcyxcblx0XHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IHRydWUsXG5cdFx0XHRcdGFsbG93VHJhaWxpbmdDb21tYXM6IHRydWUsXG5cdFx0XHRcdGFsbG93Q29tbWVudHM6IHRydWVcblx0XHRcdH1cblx0XHRcdDogYWxsU2V0dGluZ3NTY2hlbWE7XG5cblx0XHRjb25zdCBwcm9maWxlU2V0dGluZ3NTY2hlbWE6IElKU09OU2NoZW1hID0ge1xuXHRcdFx0cHJvcGVydGllczogT2JqZWN0LmFzc2lnbih7fSxcblx0XHRcdFx0bWFjaGluZVNldHRpbmdzLnByb3BlcnRpZXMsXG5cdFx0XHRcdG1hY2hpbmVPdmVycmlkYWJsZVNldHRpbmdzLnByb3BlcnRpZXMsXG5cdFx0XHRcdHdpbmRvd1NldHRpbmdzLnByb3BlcnRpZXMsXG5cdFx0XHRcdHJlc291cmNlU2V0dGluZ3MucHJvcGVydGllc1xuXHRcdFx0KSxcblx0XHRcdHBhdHRlcm5Qcm9wZXJ0aWVzOiBhbGxTZXR0aW5ncy5wYXR0ZXJuUHJvcGVydGllcyxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB0cnVlLFxuXHRcdFx0YWxsb3dUcmFpbGluZ0NvbW1hczogdHJ1ZSxcblx0XHRcdGFsbG93Q29tbWVudHM6IHRydWVcblx0XHR9O1xuXG5cdFx0Y29uc3QgbWFjaGluZVNldHRpbmdzU2NoZW1hOiBJSlNPTlNjaGVtYSA9IHtcblx0XHRcdHByb3BlcnRpZXM6IE9iamVjdC5hc3NpZ24oe30sXG5cdFx0XHRcdGFwcGxpY2F0aW9uTWFjaGluZVNldHRpbmdzLnByb3BlcnRpZXMsXG5cdFx0XHRcdG1hY2hpbmVTZXR0aW5ncy5wcm9wZXJ0aWVzLFxuXHRcdFx0XHRtYWNoaW5lT3ZlcnJpZGFibGVTZXR0aW5ncy5wcm9wZXJ0aWVzLFxuXHRcdFx0XHR3aW5kb3dTZXR0aW5ncy5wcm9wZXJ0aWVzLFxuXHRcdFx0XHRyZXNvdXJjZVNldHRpbmdzLnByb3BlcnRpZXNcblx0XHRcdCksXG5cdFx0XHRwYXR0ZXJuUHJvcGVydGllczogYWxsU2V0dGluZ3MucGF0dGVyblByb3BlcnRpZXMsXG5cdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogdHJ1ZSxcblx0XHRcdGFsbG93VHJhaWxpbmdDb21tYXM6IHRydWUsXG5cdFx0XHRhbGxvd0NvbW1lbnRzOiB0cnVlXG5cdFx0fTtcblxuXHRcdGNvbnN0IHdvcmtzcGFjZVNldHRpbmdzU2NoZW1hOiBJSlNPTlNjaGVtYSA9IHtcblx0XHRcdHByb3BlcnRpZXM6IE9iamVjdC5hc3NpZ24oe30sXG5cdFx0XHRcdHRoaXMuY2hlY2tBbmRGaWx0ZXJQcm9wZXJ0aWVzUmVxdWlyaW5nVHJ1c3QobWFjaGluZU92ZXJyaWRhYmxlU2V0dGluZ3MucHJvcGVydGllcyksXG5cdFx0XHRcdHRoaXMuY2hlY2tBbmRGaWx0ZXJQcm9wZXJ0aWVzUmVxdWlyaW5nVHJ1c3Qod2luZG93U2V0dGluZ3MucHJvcGVydGllcyksXG5cdFx0XHRcdHRoaXMuY2hlY2tBbmRGaWx0ZXJQcm9wZXJ0aWVzUmVxdWlyaW5nVHJ1c3QocmVzb3VyY2VTZXR0aW5ncy5wcm9wZXJ0aWVzKVxuXHRcdFx0KSxcblx0XHRcdHBhdHRlcm5Qcm9wZXJ0aWVzOiBhbGxTZXR0aW5ncy5wYXR0ZXJuUHJvcGVydGllcyxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB0cnVlLFxuXHRcdFx0YWxsb3dUcmFpbGluZ0NvbW1hczogdHJ1ZSxcblx0XHRcdGFsbG93Q29tbWVudHM6IHRydWVcblx0XHR9O1xuXG5cdFx0Y29uc3QgZGVmYXVsdFNldHRpbmdzU2NoZW1hID0ge1xuXHRcdFx0cHJvcGVydGllczogT2JqZWN0LmtleXMoYWxsU2V0dGluZ3MucHJvcGVydGllcykucmVkdWNlPElKU09OU2NoZW1hTWFwPigocmVzdWx0LCBrZXkpID0+IHtcblx0XHRcdFx0cmVzdWx0W2tleV0gPSBPYmplY3QuYXNzaWduKHsgZGVwcmVjYXRpb25NZXNzYWdlOiB1bmRlZmluZWQgfSwgYWxsU2V0dGluZ3MucHJvcGVydGllc1trZXldKTtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH0sIHt9KSxcblx0XHRcdHBhdHRlcm5Qcm9wZXJ0aWVzOiBPYmplY3Qua2V5cyhhbGxTZXR0aW5ncy5wYXR0ZXJuUHJvcGVydGllcykucmVkdWNlPElKU09OU2NoZW1hTWFwPigocmVzdWx0LCBrZXkpID0+IHtcblx0XHRcdFx0cmVzdWx0W2tleV0gPSBPYmplY3QuYXNzaWduKHsgZGVwcmVjYXRpb25NZXNzYWdlOiB1bmRlZmluZWQgfSwgYWxsU2V0dGluZ3MucGF0dGVyblByb3BlcnRpZXNba2V5XSk7XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9LCB7fSksXG5cdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogdHJ1ZSxcblx0XHRcdGFsbG93VHJhaWxpbmdDb21tYXM6IHRydWUsXG5cdFx0XHRhbGxvd0NvbW1lbnRzOiB0cnVlXG5cdFx0fTtcblxuXHRcdGNvbnN0IGZvbGRlclNldHRpbmdzU2NoZW1hOiBJSlNPTlNjaGVtYSA9IFdvcmtiZW5jaFN0YXRlLldPUktTUEFDRSA9PT0gdGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpID9cblx0XHRcdHtcblx0XHRcdFx0cHJvcGVydGllczogT2JqZWN0LmFzc2lnbih7fSxcblx0XHRcdFx0XHR0aGlzLmNoZWNrQW5kRmlsdGVyUHJvcGVydGllc1JlcXVpcmluZ1RydXN0KG1hY2hpbmVPdmVycmlkYWJsZVNldHRpbmdzLnByb3BlcnRpZXMpLFxuXHRcdFx0XHRcdHRoaXMuY2hlY2tBbmRGaWx0ZXJQcm9wZXJ0aWVzUmVxdWlyaW5nVHJ1c3QocmVzb3VyY2VTZXR0aW5ncy5wcm9wZXJ0aWVzKVxuXHRcdFx0XHQpLFxuXHRcdFx0XHRwYXR0ZXJuUHJvcGVydGllczogYWxsU2V0dGluZ3MucGF0dGVyblByb3BlcnRpZXMsXG5cdFx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB0cnVlLFxuXHRcdFx0XHRhbGxvd1RyYWlsaW5nQ29tbWFzOiB0cnVlLFxuXHRcdFx0XHRhbGxvd0NvbW1lbnRzOiB0cnVlXG5cdFx0XHR9IDogd29ya3NwYWNlU2V0dGluZ3NTY2hlbWE7XG5cblx0XHRjb25zdCBjb25maWdEZWZhdWx0c1NjaGVtYTogSUpTT05TY2hlbWEgPSB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY29uZmlndXJhdGlvbkRlZmF1bHRzLmRlc2NyaXB0aW9uJywgJ0NvbnRyaWJ1dGUgZGVmYXVsdHMgZm9yIGNvbmZpZ3VyYXRpb25zJyksXG5cdFx0XHRwcm9wZXJ0aWVzOiBPYmplY3QuYXNzaWduKHt9LFxuXHRcdFx0XHR0aGlzLmZpbHRlckRlZmF1bHRPdmVycmlkYWJsZVByb3BlcnRpZXMobWFjaGluZU92ZXJyaWRhYmxlU2V0dGluZ3MucHJvcGVydGllcyksXG5cdFx0XHRcdHRoaXMuZmlsdGVyRGVmYXVsdE92ZXJyaWRhYmxlUHJvcGVydGllcyh3aW5kb3dTZXR0aW5ncy5wcm9wZXJ0aWVzKSxcblx0XHRcdFx0dGhpcy5maWx0ZXJEZWZhdWx0T3ZlcnJpZGFibGVQcm9wZXJ0aWVzKHJlc291cmNlU2V0dGluZ3MucHJvcGVydGllcylcblx0XHRcdCksXG5cdFx0XHRwYXR0ZXJuUHJvcGVydGllczoge1xuXHRcdFx0XHRbT1ZFUlJJREVfUFJPUEVSVFlfUEFUVEVSTl06IHtcblx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRkZWZhdWx0OiB7fSxcblx0XHRcdFx0XHQkcmVmOiByZXNvdXJjZUxhbmd1YWdlU2V0dGluZ3NTY2hlbWFJZCxcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZVxuXHRcdH07XG5cdFx0dGhpcy5yZWdpc3RlclNjaGVtYXMoe1xuXHRcdFx0ZGVmYXVsdFNldHRpbmdzU2NoZW1hLFxuXHRcdFx0dXNlclNldHRpbmdzU2NoZW1hLFxuXHRcdFx0cHJvZmlsZVNldHRpbmdzU2NoZW1hLFxuXHRcdFx0bWFjaGluZVNldHRpbmdzU2NoZW1hLFxuXHRcdFx0d29ya3NwYWNlU2V0dGluZ3NTY2hlbWEsXG5cdFx0XHRmb2xkZXJTZXR0aW5nc1NjaGVtYSxcblx0XHRcdGNvbmZpZ0RlZmF1bHRzU2NoZW1hLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlclNjaGVtYXMoc2NoZW1hczoge1xuXHRcdGRlZmF1bHRTZXR0aW5nc1NjaGVtYTogSUpTT05TY2hlbWE7XG5cdFx0dXNlclNldHRpbmdzU2NoZW1hOiBJSlNPTlNjaGVtYTtcblx0XHRwcm9maWxlU2V0dGluZ3NTY2hlbWE6IElKU09OU2NoZW1hO1xuXHRcdG1hY2hpbmVTZXR0aW5nc1NjaGVtYTogSUpTT05TY2hlbWE7XG5cdFx0d29ya3NwYWNlU2V0dGluZ3NTY2hlbWE6IElKU09OU2NoZW1hO1xuXHRcdGZvbGRlclNldHRpbmdzU2NoZW1hOiBJSlNPTlNjaGVtYTtcblx0XHRjb25maWdEZWZhdWx0c1NjaGVtYTogSUpTT05TY2hlbWE7XG5cdH0pOiB2b2lkIHtcblx0XHRjb25zdCBqc29uUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJSlNPTkNvbnRyaWJ1dGlvblJlZ2lzdHJ5PihKU09ORXh0ZW5zaW9ucy5KU09OQ29udHJpYnV0aW9uKTtcblx0XHRqc29uUmVnaXN0cnkucmVnaXN0ZXJTY2hlbWEoZGVmYXVsdFNldHRpbmdzU2NoZW1hSWQsIHNjaGVtYXMuZGVmYXVsdFNldHRpbmdzU2NoZW1hKTtcblx0XHRqc29uUmVnaXN0cnkucmVnaXN0ZXJTY2hlbWEodXNlclNldHRpbmdzU2NoZW1hSWQsIHNjaGVtYXMudXNlclNldHRpbmdzU2NoZW1hKTtcblx0XHRqc29uUmVnaXN0cnkucmVnaXN0ZXJTY2hlbWEocHJvZmlsZVNldHRpbmdzU2NoZW1hSWQsIHNjaGVtYXMucHJvZmlsZVNldHRpbmdzU2NoZW1hKTtcblx0XHRqc29uUmVnaXN0cnkucmVnaXN0ZXJTY2hlbWEobWFjaGluZVNldHRpbmdzU2NoZW1hSWQsIHNjaGVtYXMubWFjaGluZVNldHRpbmdzU2NoZW1hKTtcblx0XHRqc29uUmVnaXN0cnkucmVnaXN0ZXJTY2hlbWEod29ya3NwYWNlU2V0dGluZ3NTY2hlbWFJZCwgc2NoZW1hcy53b3Jrc3BhY2VTZXR0aW5nc1NjaGVtYSk7XG5cdFx0anNvblJlZ2lzdHJ5LnJlZ2lzdGVyU2NoZW1hKGZvbGRlclNldHRpbmdzU2NoZW1hSWQsIHNjaGVtYXMuZm9sZGVyU2V0dGluZ3NTY2hlbWEpO1xuXHRcdGpzb25SZWdpc3RyeS5yZWdpc3RlclNjaGVtYShjb25maWd1cmF0aW9uRGVmYXVsdHNTY2hlbWFJZCwgc2NoZW1hcy5jb25maWdEZWZhdWx0c1NjaGVtYSk7XG5cdH1cblxuXHRwcml2YXRlIGNoZWNrQW5kRmlsdGVyUHJvcGVydGllc1JlcXVpcmluZ1RydXN0KHByb3BlcnRpZXM6IElTdHJpbmdEaWN0aW9uYXJ5PElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWE+KTogSVN0cmluZ0RpY3Rpb25hcnk8SUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYT4ge1xuXHRcdGlmICh0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UuaXNXb3Jrc3BhY2VUcnVzdGVkKCkpIHtcblx0XHRcdHJldHVybiBwcm9wZXJ0aWVzO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdDogSVN0cmluZ0RpY3Rpb25hcnk8SUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYT4gPSB7fTtcblx0XHRPYmplY3QuZW50cmllcyhwcm9wZXJ0aWVzKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcblx0XHRcdGlmICghdmFsdWUucmVzdHJpY3RlZCkge1xuXHRcdFx0XHRyZXN1bHRba2V5XSA9IHZhbHVlO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIGZpbHRlckRlZmF1bHRPdmVycmlkYWJsZVByb3BlcnRpZXMocHJvcGVydGllczogSVN0cmluZ0RpY3Rpb25hcnk8SUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYT4pOiBJU3RyaW5nRGljdGlvbmFyeTxJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hPiB7XG5cdFx0Y29uc3QgcmVzdWx0OiBJU3RyaW5nRGljdGlvbmFyeTxJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hPiA9IHt9O1xuXHRcdE9iamVjdC5lbnRyaWVzKHByb3BlcnRpZXMpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuXHRcdFx0aWYgKCF2YWx1ZS5kaXNhbGxvd0NvbmZpZ3VyYXRpb25EZWZhdWx0KSB7XG5cdFx0XHRcdHJlc3VsdFtrZXldID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5jbGFzcyBSZXNldENvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlc0NhY2hlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBXb3Jrc3BhY2VTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHRpZiAoY29uZmlndXJhdGlvblNlcnZpY2UuaGFzQ2FjaGVkQ29uZmlndXJhdGlvbkRlZmF1bHRzT3ZlcnJpZGVzKCkpIHtcblx0XHRcdGV4dGVuc2lvblNlcnZpY2Uud2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCkudGhlbigoKSA9PiBjb25maWd1cmF0aW9uU2VydmljZS5yZWxvYWRDb25maWd1cmF0aW9uKENvbmZpZ3VyYXRpb25UYXJnZXQuREVGQVVMVCkpO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBVcGRhdGVFeHBlcmltZW50YWxTZXR0aW5nc0RlZmF1bHRzIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi51cGRhdGVFeHBlcmltZW50YWxTZXR0aW5nc0RlZmF1bHRzJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IHByb2Nlc3NlZEV4cGVyaW1lbnRhbFNldHRpbmdzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVdvcmtiZW5jaEFzc2lnbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya2JlbmNoQXNzaWdubWVudFNlcnZpY2U6IElXb3JrYmVuY2hBc3NpZ25tZW50U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMucHJvY2Vzc0V4cGVyaW1lbnRhbFNldHRpbmdzKE9iamVjdC5rZXlzKHRoaXMuY29uZmlndXJhdGlvblJlZ2lzdHJ5LmdldENvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25SZWdpc3RyeS5vbkRpZFVwZGF0ZUNvbmZpZ3VyYXRpb24oKHsgcHJvcGVydGllcyB9KSA9PiB0aGlzLnByb2Nlc3NFeHBlcmltZW50YWxTZXR0aW5ncyhwcm9wZXJ0aWVzKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBwcm9jZXNzRXhwZXJpbWVudGFsU2V0dGluZ3MocHJvcGVydGllczogSXRlcmFibGU8c3RyaW5nPik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IG92ZXJyaWRlczogSVN0cmluZ0RpY3Rpb25hcnk8YW55PiA9IHt9O1xuXHRcdGNvbnN0IGFsbFByb3BlcnRpZXMgPSB0aGlzLmNvbmZpZ3VyYXRpb25SZWdpc3RyeS5nZXRDb25maWd1cmF0aW9uUHJvcGVydGllcygpO1xuXHRcdGZvciAoY29uc3QgcHJvcGVydHkgb2YgcHJvcGVydGllcykge1xuXHRcdFx0Y29uc3Qgc2NoZW1hID0gYWxsUHJvcGVydGllc1twcm9wZXJ0eV07XG5cdFx0XHRjb25zdCB0YWdzID0gc2NoZW1hPy50YWdzO1xuXHRcdFx0Ly8gTWFueSBleHBlcmltZW50YWwgc2V0dGluZ3MgcmVmZXIgdG8gaW4tZGV2ZWxvcG1lbnQgb3IgdW5zdGFibGUgc2V0dGluZ3MuXG5cdFx0XHQvLyBvbkV4UCBtb3JlIGNsZWFybHkgaW5kaWNhdGVzIHRoYXQgdGhlIHNldHRpbmcgY291bGQgYmVcblx0XHRcdC8vIHBhcnQgb2YgYW4gZXhwZXJpbWVudC5cblx0XHRcdGlmICghdGFncyB8fCAhdGFncy5zb21lKHRhZyA9PiB0YWcudG9Mb3dlckNhc2UoKSA9PT0gJ29uZXhwJykpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5wcm9jZXNzZWRFeHBlcmltZW50YWxTZXR0aW5ncy5oYXMocHJvcGVydHkpKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5wcm9jZXNzZWRFeHBlcmltZW50YWxTZXR0aW5ncy5hZGQocHJvcGVydHkpO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCB0aGlzLndvcmtiZW5jaEFzc2lnbm1lbnRTZXJ2aWNlLmdldFRyZWF0bWVudChgY29uZmlnLiR7cHJvcGVydHl9YCk7XG5cdFx0XHRcdGlmICghaXNVbmRlZmluZWQodmFsdWUpICYmICFlcXVhbHModmFsdWUsIHNjaGVtYS5kZWZhdWx0KSkge1xuXHRcdFx0XHRcdG92ZXJyaWRlc1twcm9wZXJ0eV0gPSB2YWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHsvKmlnbm9yZSAqLyB9XG5cdFx0fVxuXHRcdGlmIChPYmplY3Qua2V5cyhvdmVycmlkZXMpLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5jb25maWd1cmF0aW9uUmVnaXN0cnkucmVnaXN0ZXJEZWZhdWx0Q29uZmlndXJhdGlvbnMoW3sgb3ZlcnJpZGVzIH1dKTtcblx0XHR9XG5cdH1cbn1cblxuY29uc3Qgd29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpO1xud29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5LnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKFJlZ2lzdGVyQ29uZmlndXJhdGlvblNjaGVtYXNDb250cmlidXRpb24sIExpZmVjeWNsZVBoYXNlLlJlc3RvcmVkKTtcbndvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihSZXNldENvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlc0NhY2hlLCBMaWZlY3ljbGVQaGFzZS5FdmVudHVhbGx5KTtcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihVcGRhdGVFeHBlcmltZW50YWxTZXR0aW5nc0RlZmF1bHRzLklELCBVcGRhdGVFeHBlcmltZW50YWxTZXR0aW5nc0RlZmF1bHRzLCBXb3JrYmVuY2hQaGFzZS5CbG9ja1Jlc3RvcmUpO1xuXG5jb25zdCBjb25maWd1cmF0aW9uUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pO1xuY29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdC4uLndvcmtiZW5jaENvbmZpZ3VyYXRpb25Ob2RlQmFzZSxcblx0cHJvcGVydGllczoge1xuXHRcdFtBUFBMWV9BTExfUFJPRklMRVNfU0VUVElOR106IHtcblx0XHRcdCd0eXBlJzogJ2FycmF5Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnc2V0dGluZyBkZXNjcmlwdGlvbicsIFwiQ29uZmlndXJlIHNldHRpbmdzIHRvIGJlIGFwcGxpZWQgZm9yIGFsbCBwcm9maWxlcy5cIiksXG5cdFx0XHQnZGVmYXVsdCc6IFtdLFxuXHRcdFx0J3Njb3BlJzogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OLFxuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IHRydWUsXG5cdFx0XHR1bmlxdWVJdGVtczogdHJ1ZSxcblx0XHR9XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFdBQVc7QUFDcEIsU0FBUyxPQUFPLGVBQWU7QUFDL0IsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsWUFBWSx1QkFBdUI7QUFDNUMsU0FBUyxPQUFPLFNBQVMsVUFBVSxlQUFlO0FBQ2xELFNBQW9DLGNBQWMsc0JBQXNCO0FBQ3hFLFNBQVMsMEJBQTBCLGFBQWEsZUFBZSxnQkFBaUYsbUJBQW1CLG1CQUFr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UyxHQUFvQyxvQkFBb0IsU0FBUztBQUNqSCwrQkFBK0IsOEJBQThCLDBDQUEwQyxlQUFlLFFBQVE7QUFDOUgsK0JBQStCLDhCQUE4QiwwQ0FBMEMsZUFBZSxVQUFVO0FBQ2hJLCtCQUErQixtQ0FBbUMsSUFBSSxvQ0FBb0MsZUFBZSxZQUFZO0FBRXJJLE1BQU0sd0JBQXdCLFNBQVMsR0FBMkIsV0FBVyxhQUFhO0FBQzFGLHNCQUFzQixzQkFBc0I7QUFBQSxFQUMzQyxHQUFHO0FBQUEsRUFDSCxZQUFZO0FBQUEsSUFDWCxDQUFDLDBCQUEwQixHQUFHO0FBQUEsTUFDN0IsUUFBUTtBQUFBLE1BQ1IsYUFBYSxTQUFTLHVCQUF1QixvREFBb0Q7QUFBQSxNQUNqRyxXQUFXLENBQUM7QUFBQSxNQUNaLFNBQVMsbUJBQW1CO0FBQUEsTUFDNUIsc0JBQXNCO0FBQUEsTUFDdEIsYUFBYTtBQUFBLElBQ2Q7QUFBQSxFQUNEO0FBQ0QsQ0FBQzsiLAogICJuYW1lcyI6IFsicmVtb3RlVXNlckNvbmZpZ3VyYXRpb25Nb2RlbCIsICJpbmRleCIsICJ0YXJnZXQiLCAiY2hhbmdlIiwgImNvbmZpZ3VyYXRpb25SZWdpc3RyeSJdCn0K
