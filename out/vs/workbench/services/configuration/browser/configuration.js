import { Event, Emitter } from "../../../../base/common/event.js";
import * as errors from "../../../../base/common/errors.js";
import { Disposable, dispose, toDisposable, MutableDisposable, combinedDisposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { FileChangeType, whenProviderRegistered, FileOperationResult, FileOperation } from "../../../../platform/files/common/files.js";
import { ConfigurationModel, ConfigurationModelParser, UserSettings } from "../../../../platform/configuration/common/configurationModels.js";
import { WorkspaceConfigurationModelParser, StandaloneConfigurationModelParser } from "../common/configurationModels.js";
import { TASKS_CONFIGURATION_KEY, FOLDER_SETTINGS_NAME, LAUNCH_CONFIGURATION_KEY, REMOTE_MACHINE_SCOPES, FOLDER_SCOPES, WORKSPACE_SCOPES, APPLY_ALL_PROFILES_SETTING, APPLICATION_SCOPES, MCP_CONFIGURATION_KEY } from "../common/configuration.js";
import { WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { Extensions, OVERRIDE_PROPERTY_REGEX } from "../../../../platform/configuration/common/configurationRegistry.js";
import { equals } from "../../../../base/common/objects.js";
import { hash } from "../../../../base/common/hash.js";
import { joinPath } from "../../../../base/common/resources.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { isEmptyObject, isObject } from "../../../../base/common/types.js";
import { DefaultConfiguration as BaseDefaultConfiguration } from "../../../../platform/configuration/common/configurations.js";
const _DefaultConfiguration = class _DefaultConfiguration extends BaseDefaultConfiguration {
  constructor(configurationCache, environmentService, logService) {
    super(logService);
    this.configurationCache = configurationCache;
    this.configurationRegistry = Registry.as(Extensions.Configuration);
    this.cachedConfigurationDefaultsOverrides = {};
    this.cacheKey = { type: "defaults", key: "configurationDefaultsOverrides" };
    this.updateCache = false;
    if (environmentService.options?.configurationDefaults) {
      this.configurationRegistry.registerDefaultConfigurations([{ overrides: environmentService.options.configurationDefaults }]);
    }
  }
  getConfigurationDefaultOverrides() {
    return this.cachedConfigurationDefaultsOverrides;
  }
  async initialize() {
    await this.initializeCachedConfigurationDefaultsOverrides();
    return super.initialize();
  }
  reload() {
    this.updateCache = true;
    this.cachedConfigurationDefaultsOverrides = {};
    this.updateCachedConfigurationDefaultsOverrides();
    return super.reload();
  }
  hasCachedConfigurationDefaultsOverrides() {
    return !isEmptyObject(this.cachedConfigurationDefaultsOverrides);
  }
  initializeCachedConfigurationDefaultsOverrides() {
    if (!this.initiaizeCachedConfigurationDefaultsOverridesPromise) {
      this.initiaizeCachedConfigurationDefaultsOverridesPromise = (async () => {
        try {
          if (localStorage.getItem(_DefaultConfiguration.DEFAULT_OVERRIDES_CACHE_EXISTS_KEY)) {
            const content = await this.configurationCache.read(this.cacheKey);
            if (content) {
              this.cachedConfigurationDefaultsOverrides = JSON.parse(content);
            }
          }
        } catch (error) {
        }
        this.cachedConfigurationDefaultsOverrides = isObject(this.cachedConfigurationDefaultsOverrides) ? this.cachedConfigurationDefaultsOverrides : {};
      })();
    }
    return this.initiaizeCachedConfigurationDefaultsOverridesPromise;
  }
  onDidUpdateConfiguration(properties, defaultsOverrides) {
    super.onDidUpdateConfiguration(properties, defaultsOverrides);
    if (defaultsOverrides) {
      this.updateCachedConfigurationDefaultsOverrides();
    }
  }
  async updateCachedConfigurationDefaultsOverrides() {
    if (!this.updateCache) {
      return;
    }
    const cachedConfigurationDefaultsOverrides = {};
    const configurationDefaultsOverrides = this.configurationRegistry.getConfigurationDefaultsOverrides();
    for (const [key, value] of configurationDefaultsOverrides) {
      if (!OVERRIDE_PROPERTY_REGEX.test(key) && value.value !== void 0) {
        cachedConfigurationDefaultsOverrides[key] = value.value;
      }
    }
    try {
      if (Object.keys(cachedConfigurationDefaultsOverrides).length) {
        localStorage.setItem(_DefaultConfiguration.DEFAULT_OVERRIDES_CACHE_EXISTS_KEY, "yes");
        await this.configurationCache.write(this.cacheKey, JSON.stringify(cachedConfigurationDefaultsOverrides));
      } else {
        localStorage.removeItem(_DefaultConfiguration.DEFAULT_OVERRIDES_CACHE_EXISTS_KEY);
        await this.configurationCache.remove(this.cacheKey);
      }
    } catch (error) {
    }
  }
};
_DefaultConfiguration.DEFAULT_OVERRIDES_CACHE_EXISTS_KEY = "DefaultOverridesCacheExists";
let DefaultConfiguration = _DefaultConfiguration;
class ApplicationConfiguration extends UserSettings {
  constructor(userDataProfilesService, fileService, uriIdentityService, logService) {
    super(userDataProfilesService.defaultProfile.settingsResource, { scopes: APPLICATION_SCOPES, skipUnregistered: true }, uriIdentityService.extUri, fileService, logService);
    this._onDidChangeConfiguration = this._register(new Emitter());
    this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
    this._register(this.onDidChange(() => this.reloadConfigurationScheduler.schedule()));
    this.reloadConfigurationScheduler = this._register(new RunOnceScheduler(() => this.loadConfiguration().then((configurationModel) => this._onDidChangeConfiguration.fire(configurationModel)), 50));
  }
  async initialize() {
    return this.loadConfiguration();
  }
  async loadConfiguration() {
    const model = await super.loadConfiguration();
    const value = model.getValue(APPLY_ALL_PROFILES_SETTING);
    const allProfilesSettings = Array.isArray(value) ? value : [];
    return this.parseOptions.include || allProfilesSettings.length ? this.reparse({ ...this.parseOptions, include: allProfilesSettings }) : model;
  }
}
class UserConfiguration extends Disposable {
  constructor(settingsResource, tasksResource, configurationParseOptions, fileService, uriIdentityService, logService) {
    super();
    this.settingsResource = settingsResource;
    this.tasksResource = tasksResource;
    this.configurationParseOptions = configurationParseOptions;
    this.fileService = fileService;
    this.uriIdentityService = uriIdentityService;
    this.logService = logService;
    this._onDidChangeConfiguration = this._register(new Emitter());
    this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
    this.userConfiguration = this._register(new MutableDisposable());
    this.userConfigurationChangeDisposable = this._register(new MutableDisposable());
    this.userConfiguration.value = new UserSettings(settingsResource, this.configurationParseOptions, uriIdentityService.extUri, this.fileService, logService);
    this.userConfigurationChangeDisposable.value = this.userConfiguration.value.onDidChange(() => this.reloadConfigurationScheduler.schedule());
    this.reloadConfigurationScheduler = this._register(new RunOnceScheduler(() => this.userConfiguration.value.loadConfiguration().then((configurationModel) => this._onDidChangeConfiguration.fire(configurationModel)), 50));
  }
  get hasTasksLoaded() {
    return this.userConfiguration.value instanceof FileServiceBasedConfiguration;
  }
  async reset(settingsResource, tasksResource, configurationParseOptions) {
    this.settingsResource = settingsResource;
    this.tasksResource = tasksResource;
    this.configurationParseOptions = configurationParseOptions;
    return this.doReset();
  }
  async doReset(settingsConfiguration) {
    const folder = this.uriIdentityService.extUri.dirname(this.settingsResource);
    const standAloneConfigurationResources = this.tasksResource ? [[TASKS_CONFIGURATION_KEY, this.tasksResource]] : [];
    const fileServiceBasedConfiguration = new FileServiceBasedConfiguration(folder.toString(), this.settingsResource, standAloneConfigurationResources, this.configurationParseOptions, this.fileService, this.uriIdentityService, this.logService);
    const configurationModel = await fileServiceBasedConfiguration.loadConfiguration(settingsConfiguration);
    this.userConfiguration.value = fileServiceBasedConfiguration;
    if (this.userConfigurationChangeDisposable.value) {
      this.userConfigurationChangeDisposable.value = this.userConfiguration.value.onDidChange(() => this.reloadConfigurationScheduler.schedule());
    }
    return configurationModel;
  }
  async initialize() {
    return this.userConfiguration.value.loadConfiguration();
  }
  async reload(settingsConfiguration) {
    if (this.hasTasksLoaded) {
      return this.userConfiguration.value.loadConfiguration();
    }
    return this.doReset(settingsConfiguration);
  }
  reparse(parseOptions) {
    this.configurationParseOptions = { ...this.configurationParseOptions, ...parseOptions };
    return this.userConfiguration.value.reparse(this.configurationParseOptions);
  }
  getRestrictedSettings() {
    return this.userConfiguration.value.getRestrictedSettings();
  }
}
class FileServiceBasedConfiguration extends Disposable {
  constructor(name, settingsResource, standAloneConfigurationResources, configurationParseOptions, fileService, uriIdentityService, logService) {
    super();
    this.settingsResource = settingsResource;
    this.standAloneConfigurationResources = standAloneConfigurationResources;
    this.fileService = fileService;
    this.uriIdentityService = uriIdentityService;
    this.logService = logService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.allResources = [this.settingsResource, ...this.standAloneConfigurationResources.map(([, resource]) => resource)];
    this._register(combinedDisposable(...this.allResources.map((resource) => combinedDisposable(
      this.fileService.watch(uriIdentityService.extUri.dirname(resource)),
      // Also listen to the resource incase the resource is a symlink - https://github.com/microsoft/vscode/issues/118134
      this.fileService.watch(resource)
    ))));
    this._folderSettingsModelParser = new ConfigurationModelParser(name, logService);
    this._folderSettingsParseOptions = configurationParseOptions;
    this._standAloneConfigurations = [];
    this._cache = ConfigurationModel.createEmptyModel(this.logService);
    this._register(Event.debounce(
      Event.any(
        Event.filter(this.fileService.onDidFilesChange, (e) => this.handleFileChangesEvent(e)),
        Event.filter(this.fileService.onDidRunOperation, (e) => this.handleFileOperationEvent(e))
      ),
      () => void 0,
      100
    )(() => this._onDidChange.fire()));
  }
  async resolveContents(donotResolveSettings) {
    const resolveContents = async (resources) => {
      return Promise.all(resources.map(async (resource) => {
        try {
          const content = await this.fileService.readFile(resource, { atomic: true });
          return content.value.toString();
        } catch (error) {
          this.logService.trace(`Error while resolving configuration file '${resource.toString()}': ${errors.getErrorMessage(error)}`);
          if (error.fileOperationResult !== FileOperationResult.FILE_NOT_FOUND && error.fileOperationResult !== FileOperationResult.FILE_NOT_DIRECTORY) {
            this.logService.error(error);
          }
        }
        return "{}";
      }));
    };
    const [[settingsContent], standAloneConfigurationContents] = await Promise.all([
      donotResolveSettings ? Promise.resolve([void 0]) : resolveContents([this.settingsResource]),
      resolveContents(this.standAloneConfigurationResources.map(([, resource]) => resource))
    ]);
    return [settingsContent, standAloneConfigurationContents.map((content, index) => [this.standAloneConfigurationResources[index][0], content])];
  }
  async loadConfiguration(settingsConfiguration) {
    const [settingsContent, standAloneConfigurationContents] = await this.resolveContents(!!settingsConfiguration);
    this._standAloneConfigurations = [];
    this._folderSettingsModelParser.parse("", this._folderSettingsParseOptions);
    if (settingsContent !== void 0) {
      this._folderSettingsModelParser.parse(settingsContent, this._folderSettingsParseOptions);
    }
    for (let index = 0; index < standAloneConfigurationContents.length; index++) {
      const contents = standAloneConfigurationContents[index][1];
      if (contents !== void 0) {
        const standAloneConfigurationModelParser = new StandaloneConfigurationModelParser(this.standAloneConfigurationResources[index][1].toString(), this.standAloneConfigurationResources[index][0], this.logService);
        standAloneConfigurationModelParser.parse(contents);
        this._standAloneConfigurations.push(standAloneConfigurationModelParser.configurationModel);
      }
    }
    this.consolidate(settingsConfiguration);
    return this._cache;
  }
  getRestrictedSettings() {
    return this._folderSettingsModelParser.restrictedConfigurations;
  }
  reparse(configurationParseOptions) {
    const oldContents = this._folderSettingsModelParser.configurationModel.contents;
    this._folderSettingsParseOptions = configurationParseOptions;
    this._folderSettingsModelParser.reparse(this._folderSettingsParseOptions);
    if (!equals(oldContents, this._folderSettingsModelParser.configurationModel.contents)) {
      this.consolidate();
    }
    return this._cache;
  }
  consolidate(settingsConfiguration) {
    this._cache = (settingsConfiguration ?? this._folderSettingsModelParser.configurationModel).merge(...this._standAloneConfigurations);
  }
  handleFileChangesEvent(event) {
    if (this.allResources.some((resource) => event.contains(resource))) {
      return true;
    }
    if (this.allResources.some((resource) => event.contains(this.uriIdentityService.extUri.dirname(resource), FileChangeType.DELETED))) {
      return true;
    }
    return false;
  }
  handleFileOperationEvent(event) {
    if ((event.isOperation(FileOperation.CREATE) || event.isOperation(FileOperation.COPY) || event.isOperation(FileOperation.DELETE) || event.isOperation(FileOperation.WRITE)) && this.allResources.some((resource) => this.uriIdentityService.extUri.isEqual(event.resource, resource))) {
      return true;
    }
    if (event.isOperation(FileOperation.DELETE) && this.allResources.some((resource) => this.uriIdentityService.extUri.isEqual(event.resource, this.uriIdentityService.extUri.dirname(resource)))) {
      return true;
    }
    return false;
  }
}
class RemoteUserConfiguration extends Disposable {
  constructor(remoteAuthority, configurationCache, fileService, uriIdentityService, remoteAgentService, logService) {
    super();
    this._userConfigurationInitializationPromise = null;
    this._onDidChangeConfiguration = this._register(new Emitter());
    this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
    this._onDidInitialize = this._register(new Emitter());
    this.onDidInitialize = this._onDidInitialize.event;
    this._fileService = fileService;
    this._userConfiguration = this._cachedConfiguration = new CachedRemoteUserConfiguration(remoteAuthority, configurationCache, { scopes: REMOTE_MACHINE_SCOPES }, logService);
    remoteAgentService.getEnvironment().then(async (environment) => {
      if (environment) {
        const userConfiguration = this._register(new FileServiceBasedRemoteUserConfiguration(environment.settingsPath, { scopes: REMOTE_MACHINE_SCOPES }, this._fileService, uriIdentityService, logService));
        this._register(userConfiguration.onDidChangeConfiguration((configurationModel2) => this.onDidUserConfigurationChange(configurationModel2)));
        this._userConfigurationInitializationPromise = userConfiguration.initialize();
        const configurationModel = await this._userConfigurationInitializationPromise;
        this._userConfiguration.dispose();
        this._userConfiguration = userConfiguration;
        this.onDidUserConfigurationChange(configurationModel);
        this._onDidInitialize.fire(configurationModel);
      }
    });
  }
  async initialize() {
    if (this._userConfiguration instanceof FileServiceBasedRemoteUserConfiguration) {
      return this._userConfiguration.initialize();
    }
    let configurationModel = await this._userConfiguration.initialize();
    if (this._userConfigurationInitializationPromise) {
      configurationModel = await this._userConfigurationInitializationPromise;
      this._userConfigurationInitializationPromise = null;
    }
    return configurationModel;
  }
  reload() {
    return this._userConfiguration.reload();
  }
  reparse() {
    return this._userConfiguration.reparse({ scopes: REMOTE_MACHINE_SCOPES });
  }
  getRestrictedSettings() {
    return this._userConfiguration.getRestrictedSettings();
  }
  onDidUserConfigurationChange(configurationModel) {
    this.updateCache();
    this._onDidChangeConfiguration.fire(configurationModel);
  }
  async updateCache() {
    if (this._userConfiguration instanceof FileServiceBasedRemoteUserConfiguration) {
      let content;
      try {
        content = await this._userConfiguration.resolveContent();
      } catch (error) {
        if (error.fileOperationResult !== FileOperationResult.FILE_NOT_FOUND) {
          return;
        }
      }
      await this._cachedConfiguration.updateConfiguration(content);
    }
  }
}
class FileServiceBasedRemoteUserConfiguration extends Disposable {
  constructor(configurationResource, configurationParseOptions, fileService, uriIdentityService, logService) {
    super();
    this.configurationResource = configurationResource;
    this.fileService = fileService;
    this.uriIdentityService = uriIdentityService;
    this.logService = logService;
    this._onDidChangeConfiguration = this._register(new Emitter());
    this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
    this.fileWatcherDisposable = this._register(new MutableDisposable());
    this.directoryWatcherDisposable = this._register(new MutableDisposable());
    this.parser = new ConfigurationModelParser(this.configurationResource.toString(), logService);
    this.parseOptions = configurationParseOptions;
    this._register(fileService.onDidFilesChange((e) => this.handleFileChangesEvent(e)));
    this._register(fileService.onDidRunOperation((e) => this.handleFileOperationEvent(e)));
    this.reloadConfigurationScheduler = this._register(new RunOnceScheduler(() => this.reload().then((configurationModel) => this._onDidChangeConfiguration.fire(configurationModel)), 50));
    this._register(toDisposable(() => {
      this.stopWatchingResource();
      this.stopWatchingDirectory();
    }));
  }
  watchResource() {
    this.fileWatcherDisposable.value = this.fileService.watch(this.configurationResource);
  }
  stopWatchingResource() {
    this.fileWatcherDisposable.value = void 0;
  }
  watchDirectory() {
    const directory = this.uriIdentityService.extUri.dirname(this.configurationResource);
    this.directoryWatcherDisposable.value = this.fileService.watch(directory);
  }
  stopWatchingDirectory() {
    this.directoryWatcherDisposable.value = void 0;
  }
  async initialize() {
    const exists = await this.fileService.exists(this.configurationResource);
    this.onResourceExists(exists);
    return this.reload();
  }
  async resolveContent() {
    const content = await this.fileService.readFile(this.configurationResource, { atomic: true });
    return content.value.toString();
  }
  async reload() {
    try {
      const content = await this.resolveContent();
      this.parser.parse(content, this.parseOptions);
      return this.parser.configurationModel;
    } catch (e) {
      return ConfigurationModel.createEmptyModel(this.logService);
    }
  }
  reparse(configurationParseOptions) {
    this.parseOptions = configurationParseOptions;
    this.parser.reparse(this.parseOptions);
    return this.parser.configurationModel;
  }
  getRestrictedSettings() {
    return this.parser.restrictedConfigurations;
  }
  handleFileChangesEvent(event) {
    let affectedByChanges = false;
    if (event.contains(this.configurationResource, FileChangeType.ADDED)) {
      affectedByChanges = true;
      this.onResourceExists(true);
    } else if (event.contains(this.configurationResource, FileChangeType.DELETED)) {
      affectedByChanges = true;
      this.onResourceExists(false);
    } else if (event.contains(this.configurationResource, FileChangeType.UPDATED)) {
      affectedByChanges = true;
    }
    if (affectedByChanges) {
      this.reloadConfigurationScheduler.schedule();
    }
  }
  handleFileOperationEvent(event) {
    if ((event.isOperation(FileOperation.CREATE) || event.isOperation(FileOperation.COPY) || event.isOperation(FileOperation.DELETE) || event.isOperation(FileOperation.WRITE)) && this.uriIdentityService.extUri.isEqual(event.resource, this.configurationResource)) {
      this.reloadConfigurationScheduler.schedule();
    }
  }
  onResourceExists(exists) {
    if (exists) {
      this.stopWatchingDirectory();
      this.watchResource();
    } else {
      this.stopWatchingResource();
      this.watchDirectory();
    }
  }
}
class CachedRemoteUserConfiguration extends Disposable {
  constructor(remoteAuthority, configurationCache, configurationParseOptions, logService) {
    super();
    this.configurationCache = configurationCache;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.key = { type: "user", key: remoteAuthority };
    this.parser = new ConfigurationModelParser("CachedRemoteUserConfiguration", logService);
    this.parseOptions = configurationParseOptions;
    this.configurationModel = ConfigurationModel.createEmptyModel(logService);
  }
  getConfigurationModel() {
    return this.configurationModel;
  }
  initialize() {
    return this.reload();
  }
  reparse(configurationParseOptions) {
    this.parseOptions = configurationParseOptions;
    this.parser.reparse(this.parseOptions);
    this.configurationModel = this.parser.configurationModel;
    return this.configurationModel;
  }
  getRestrictedSettings() {
    return this.parser.restrictedConfigurations;
  }
  async reload() {
    try {
      const content = await this.configurationCache.read(this.key);
      const parsed = JSON.parse(content);
      if (parsed.content) {
        this.parser.parse(parsed.content, this.parseOptions);
        this.configurationModel = this.parser.configurationModel;
      }
    } catch (e) {
    }
    return this.configurationModel;
  }
  async updateConfiguration(content) {
    if (content) {
      return this.configurationCache.write(this.key, JSON.stringify({ content }));
    } else {
      return this.configurationCache.remove(this.key);
    }
  }
}
class WorkspaceConfiguration extends Disposable {
  constructor(configurationCache, fileService, uriIdentityService, logService) {
    super();
    this.configurationCache = configurationCache;
    this.fileService = fileService;
    this.uriIdentityService = uriIdentityService;
    this.logService = logService;
    this._workspaceConfigurationDisposables = this._register(new DisposableStore());
    this._workspaceIdentifier = null;
    this._isWorkspaceTrusted = false;
    this._onDidUpdateConfiguration = this._register(new Emitter());
    this.onDidUpdateConfiguration = this._onDidUpdateConfiguration.event;
    this._initialized = false;
    this.fileService = fileService;
    this._workspaceConfiguration = this._cachedConfiguration = new CachedWorkspaceConfiguration(configurationCache, logService);
  }
  get initialized() {
    return this._initialized;
  }
  async initialize(workspaceIdentifier, workspaceTrusted) {
    this._workspaceIdentifier = workspaceIdentifier;
    this._isWorkspaceTrusted = workspaceTrusted;
    if (!this._initialized) {
      if (this.configurationCache.needsCaching(this._workspaceIdentifier.configPath)) {
        this._workspaceConfiguration = this._cachedConfiguration;
        this.waitAndInitialize(this._workspaceIdentifier);
      } else {
        this.doInitialize(new FileServiceBasedWorkspaceConfiguration(this.fileService, this.uriIdentityService, this.logService));
      }
    }
    await this.reload();
  }
  async reload() {
    if (this._workspaceIdentifier) {
      await this._workspaceConfiguration.load(this._workspaceIdentifier, { scopes: WORKSPACE_SCOPES, skipRestricted: this.isUntrusted() });
    }
  }
  getFolders() {
    return this._workspaceConfiguration.getFolders();
  }
  setFolders(folders, jsonEditingService) {
    if (this._workspaceIdentifier) {
      return jsonEditingService.write(this._workspaceIdentifier.configPath, [{ path: ["folders"], value: folders }], true).then(() => this.reload());
    }
    return Promise.resolve();
  }
  isTransient() {
    return this._workspaceConfiguration.isTransient();
  }
  getConfiguration() {
    return this._workspaceConfiguration.getWorkspaceSettings();
  }
  updateWorkspaceTrust(trusted) {
    this._isWorkspaceTrusted = trusted;
    return this.reparseWorkspaceSettings();
  }
  reparseWorkspaceSettings() {
    this._workspaceConfiguration.reparseWorkspaceSettings({ scopes: WORKSPACE_SCOPES, skipRestricted: this.isUntrusted() });
    return this.getConfiguration();
  }
  getRestrictedSettings() {
    return this._workspaceConfiguration.getRestrictedSettings();
  }
  async waitAndInitialize(workspaceIdentifier) {
    await whenProviderRegistered(workspaceIdentifier.configPath, this.fileService);
    if (!(this._workspaceConfiguration instanceof FileServiceBasedWorkspaceConfiguration)) {
      const fileServiceBasedWorkspaceConfiguration = this._register(new FileServiceBasedWorkspaceConfiguration(this.fileService, this.uriIdentityService, this.logService));
      await fileServiceBasedWorkspaceConfiguration.load(workspaceIdentifier, { scopes: WORKSPACE_SCOPES, skipRestricted: this.isUntrusted() });
      this.doInitialize(fileServiceBasedWorkspaceConfiguration);
      this.onDidWorkspaceConfigurationChange(false, true);
    }
  }
  doInitialize(fileServiceBasedWorkspaceConfiguration) {
    this._workspaceConfigurationDisposables.clear();
    this._workspaceConfiguration = this._workspaceConfigurationDisposables.add(fileServiceBasedWorkspaceConfiguration);
    this._workspaceConfigurationDisposables.add(this._workspaceConfiguration.onDidChange((e) => this.onDidWorkspaceConfigurationChange(true, false)));
    this._initialized = true;
  }
  isUntrusted() {
    return !this._isWorkspaceTrusted;
  }
  async onDidWorkspaceConfigurationChange(reload, fromCache) {
    if (reload) {
      await this.reload();
    }
    this.updateCache();
    this._onDidUpdateConfiguration.fire(fromCache);
  }
  async updateCache() {
    if (this._workspaceIdentifier && this.configurationCache.needsCaching(this._workspaceIdentifier.configPath) && this._workspaceConfiguration instanceof FileServiceBasedWorkspaceConfiguration) {
      const content = await this._workspaceConfiguration.resolveContent(this._workspaceIdentifier);
      await this._cachedConfiguration.updateWorkspace(this._workspaceIdentifier, content);
    }
  }
}
class FileServiceBasedWorkspaceConfiguration extends Disposable {
  constructor(fileService, uriIdentityService, logService) {
    super();
    this.fileService = fileService;
    this.logService = logService;
    this._workspaceIdentifier = null;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.workspaceConfigurationModelParser = new WorkspaceConfigurationModelParser("", logService);
    this.workspaceSettings = ConfigurationModel.createEmptyModel(logService);
    this._register(Event.any(
      Event.filter(this.fileService.onDidFilesChange, (e) => !!this._workspaceIdentifier && e.contains(this._workspaceIdentifier.configPath)),
      Event.filter(this.fileService.onDidRunOperation, (e) => !!this._workspaceIdentifier && (e.isOperation(FileOperation.CREATE) || e.isOperation(FileOperation.COPY) || e.isOperation(FileOperation.DELETE) || e.isOperation(FileOperation.WRITE)) && uriIdentityService.extUri.isEqual(e.resource, this._workspaceIdentifier.configPath))
    )(() => this.reloadConfigurationScheduler.schedule()));
    this.reloadConfigurationScheduler = this._register(new RunOnceScheduler(() => this._onDidChange.fire(), 50));
    this.workspaceConfigWatcher = this._register(this.watchWorkspaceConfigurationFile());
  }
  get workspaceIdentifier() {
    return this._workspaceIdentifier;
  }
  async resolveContent(workspaceIdentifier) {
    const content = await this.fileService.readFile(workspaceIdentifier.configPath, { atomic: true });
    return content.value.toString();
  }
  async load(workspaceIdentifier, configurationParseOptions) {
    if (!this._workspaceIdentifier || this._workspaceIdentifier.id !== workspaceIdentifier.id) {
      this._workspaceIdentifier = workspaceIdentifier;
      this.workspaceConfigurationModelParser = new WorkspaceConfigurationModelParser(this._workspaceIdentifier.id, this.logService);
      dispose(this.workspaceConfigWatcher);
      this.workspaceConfigWatcher = this._register(this.watchWorkspaceConfigurationFile());
    }
    let contents = "";
    try {
      contents = await this.resolveContent(this._workspaceIdentifier);
    } catch (error) {
      const exists = await this.fileService.exists(this._workspaceIdentifier.configPath);
      if (exists) {
        this.logService.error(error);
      }
    }
    this.workspaceConfigurationModelParser.parse(contents, configurationParseOptions);
    this.consolidate();
  }
  getConfigurationModel() {
    return this.workspaceConfigurationModelParser.configurationModel;
  }
  getFolders() {
    return this.workspaceConfigurationModelParser.folders;
  }
  isTransient() {
    return this.workspaceConfigurationModelParser.transient;
  }
  getWorkspaceSettings() {
    return this.workspaceSettings;
  }
  reparseWorkspaceSettings(configurationParseOptions) {
    this.workspaceConfigurationModelParser.reparseWorkspaceSettings(configurationParseOptions);
    this.consolidate();
    return this.getWorkspaceSettings();
  }
  getRestrictedSettings() {
    return this.workspaceConfigurationModelParser.getRestrictedWorkspaceSettings();
  }
  consolidate() {
    this.workspaceSettings = this.workspaceConfigurationModelParser.settingsModel.merge(this.workspaceConfigurationModelParser.launchModel, this.workspaceConfigurationModelParser.tasksModel);
  }
  watchWorkspaceConfigurationFile() {
    return this._workspaceIdentifier ? this.fileService.watch(this._workspaceIdentifier.configPath) : Disposable.None;
  }
}
class CachedWorkspaceConfiguration {
  constructor(configurationCache, logService) {
    this.configurationCache = configurationCache;
    this.logService = logService;
    this.onDidChange = Event.None;
    this.workspaceConfigurationModelParser = new WorkspaceConfigurationModelParser("", logService);
    this.workspaceSettings = ConfigurationModel.createEmptyModel(logService);
  }
  async load(workspaceIdentifier, configurationParseOptions) {
    try {
      const key = this.getKey(workspaceIdentifier);
      const contents = await this.configurationCache.read(key);
      const parsed = JSON.parse(contents);
      if (parsed.content) {
        this.workspaceConfigurationModelParser = new WorkspaceConfigurationModelParser(key.key, this.logService);
        this.workspaceConfigurationModelParser.parse(parsed.content, configurationParseOptions);
        this.consolidate();
      }
    } catch (e) {
    }
  }
  get workspaceIdentifier() {
    return null;
  }
  getConfigurationModel() {
    return this.workspaceConfigurationModelParser.configurationModel;
  }
  getFolders() {
    return this.workspaceConfigurationModelParser.folders;
  }
  isTransient() {
    return this.workspaceConfigurationModelParser.transient;
  }
  getWorkspaceSettings() {
    return this.workspaceSettings;
  }
  reparseWorkspaceSettings(configurationParseOptions) {
    this.workspaceConfigurationModelParser.reparseWorkspaceSettings(configurationParseOptions);
    this.consolidate();
    return this.getWorkspaceSettings();
  }
  getRestrictedSettings() {
    return this.workspaceConfigurationModelParser.getRestrictedWorkspaceSettings();
  }
  consolidate() {
    this.workspaceSettings = this.workspaceConfigurationModelParser.settingsModel.merge(this.workspaceConfigurationModelParser.launchModel, this.workspaceConfigurationModelParser.tasksModel);
  }
  async updateWorkspace(workspaceIdentifier, content) {
    try {
      const key = this.getKey(workspaceIdentifier);
      if (content) {
        await this.configurationCache.write(key, JSON.stringify({ content }));
      } else {
        await this.configurationCache.remove(key);
      }
    } catch (error) {
    }
  }
  getKey(workspaceIdentifier) {
    return {
      type: "workspaces",
      key: workspaceIdentifier.id
    };
  }
}
class CachedFolderConfiguration {
  constructor(folder, configFolderRelativePath, configurationParseOptions, configurationCache, logService) {
    this.configurationCache = configurationCache;
    this.logService = logService;
    this.onDidChange = Event.None;
    this.key = { type: "folder", key: hash(joinPath(folder, configFolderRelativePath).toString()).toString(16) };
    this._folderSettingsModelParser = new ConfigurationModelParser("CachedFolderConfiguration", logService);
    this._folderSettingsParseOptions = configurationParseOptions;
    this._standAloneConfigurations = [];
    this.configurationModel = ConfigurationModel.createEmptyModel(logService);
  }
  async loadConfiguration() {
    try {
      const contents = await this.configurationCache.read(this.key);
      const { content: configurationContents } = JSON.parse(contents.toString());
      if (configurationContents) {
        for (const key of Object.keys(configurationContents)) {
          if (key === FOLDER_SETTINGS_NAME) {
            this._folderSettingsModelParser.parse(configurationContents[key], this._folderSettingsParseOptions);
          } else {
            const standAloneConfigurationModelParser = new StandaloneConfigurationModelParser(key, key, this.logService);
            standAloneConfigurationModelParser.parse(configurationContents[key]);
            this._standAloneConfigurations.push(standAloneConfigurationModelParser.configurationModel);
          }
        }
      }
      this.consolidate();
    } catch (e) {
    }
    return this.configurationModel;
  }
  async updateConfiguration(settingsContent, standAloneConfigurationContents) {
    const content = {};
    if (settingsContent) {
      content[FOLDER_SETTINGS_NAME] = settingsContent;
    }
    standAloneConfigurationContents.forEach(([key, contents]) => {
      if (contents) {
        content[key] = contents;
      }
    });
    if (Object.keys(content).length) {
      await this.configurationCache.write(this.key, JSON.stringify({ content }));
    } else {
      await this.configurationCache.remove(this.key);
    }
  }
  getRestrictedSettings() {
    return this._folderSettingsModelParser.restrictedConfigurations;
  }
  reparse(configurationParseOptions) {
    this._folderSettingsParseOptions = configurationParseOptions;
    this._folderSettingsModelParser.reparse(this._folderSettingsParseOptions);
    this.consolidate();
    return this.configurationModel;
  }
  consolidate() {
    this.configurationModel = this._folderSettingsModelParser.configurationModel.merge(...this._standAloneConfigurations);
  }
  getUnsupportedKeys() {
    return [];
  }
}
class FolderConfiguration extends Disposable {
  constructor(useCache, workspaceFolder, configFolderRelativePath, workbenchState, workspaceTrusted, fileService, uriIdentityService, logService, configurationCache) {
    super();
    this.workspaceFolder = workspaceFolder;
    this.workbenchState = workbenchState;
    this.workspaceTrusted = workspaceTrusted;
    this.configurationCache = configurationCache;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.scopes = WorkbenchState.WORKSPACE === this.workbenchState ? FOLDER_SCOPES : WORKSPACE_SCOPES;
    this.configurationFolder = uriIdentityService.extUri.joinPath(workspaceFolder.uri, configFolderRelativePath);
    this.cachedFolderConfiguration = new CachedFolderConfiguration(workspaceFolder.uri, configFolderRelativePath, { scopes: this.scopes, skipRestricted: this.isUntrusted() }, configurationCache, logService);
    if (useCache && this.configurationCache.needsCaching(workspaceFolder.uri)) {
      this.folderConfiguration = this.cachedFolderConfiguration;
      whenProviderRegistered(workspaceFolder.uri, fileService).then(() => {
        this.folderConfiguration = this._register(this.createFileServiceBasedConfiguration(fileService, uriIdentityService, logService));
        this._register(this.folderConfiguration.onDidChange((e) => this.onDidFolderConfigurationChange()));
        this.onDidFolderConfigurationChange();
      });
    } else {
      this.folderConfiguration = this._register(this.createFileServiceBasedConfiguration(fileService, uriIdentityService, logService));
      this._register(this.folderConfiguration.onDidChange((e) => this.onDidFolderConfigurationChange()));
    }
  }
  loadConfiguration() {
    return this.folderConfiguration.loadConfiguration();
  }
  updateWorkspaceTrust(trusted) {
    this.workspaceTrusted = trusted;
    return this.reparse();
  }
  reparse() {
    const configurationModel = this.folderConfiguration.reparse({ scopes: this.scopes, skipRestricted: this.isUntrusted() });
    this.updateCache();
    return configurationModel;
  }
  getRestrictedSettings() {
    return this.folderConfiguration.getRestrictedSettings();
  }
  isUntrusted() {
    return !this.workspaceTrusted;
  }
  onDidFolderConfigurationChange() {
    this.updateCache();
    this._onDidChange.fire();
  }
  createFileServiceBasedConfiguration(fileService, uriIdentityService, logService) {
    const settingsResource = uriIdentityService.extUri.joinPath(this.configurationFolder, `${FOLDER_SETTINGS_NAME}.json`);
    const standAloneConfigurationResources = [TASKS_CONFIGURATION_KEY, LAUNCH_CONFIGURATION_KEY, MCP_CONFIGURATION_KEY].map((name) => [name, uriIdentityService.extUri.joinPath(this.configurationFolder, `${name}.json`)]);
    return new FileServiceBasedConfiguration(this.configurationFolder.toString(), settingsResource, standAloneConfigurationResources, { scopes: this.scopes, skipRestricted: this.isUntrusted() }, fileService, uriIdentityService, logService);
  }
  async updateCache() {
    if (this.configurationCache.needsCaching(this.configurationFolder) && this.folderConfiguration instanceof FileServiceBasedConfiguration) {
      const [settingsContent, standAloneConfigurationContents] = await this.folderConfiguration.resolveContents();
      this.cachedFolderConfiguration.updateConfiguration(settingsContent, standAloneConfigurationContents);
    }
  }
}
export {
  ApplicationConfiguration,
  DefaultConfiguration,
  FolderConfiguration,
  RemoteUserConfiguration,
  UserConfiguration,
  WorkspaceConfiguration
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvY29uZmlndXJhdGlvbi9icm93c2VyL2NvbmZpZ3VyYXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRXZlbnQsIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgKiBhcyBlcnJvcnMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIElEaXNwb3NhYmxlLCBkaXNwb3NlLCB0b0Rpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlLCBjb21iaW5lZERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgRmlsZUNoYW5nZVR5cGUsIEZpbGVDaGFuZ2VzRXZlbnQsIElGaWxlU2VydmljZSwgd2hlblByb3ZpZGVyUmVnaXN0ZXJlZCwgRmlsZU9wZXJhdGlvbkVycm9yLCBGaWxlT3BlcmF0aW9uUmVzdWx0LCBGaWxlT3BlcmF0aW9uLCBGaWxlT3BlcmF0aW9uRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbk1vZGVsLCBDb25maWd1cmF0aW9uTW9kZWxQYXJzZXIsIENvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnMsIFVzZXJTZXR0aW5ncyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25Nb2RlbHMuanMnO1xuaW1wb3J0IHsgV29ya3NwYWNlQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyLCBTdGFuZGFsb25lQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyIH0gZnJvbSAnLi4vY29tbW9uL2NvbmZpZ3VyYXRpb25Nb2RlbHMuanMnO1xuaW1wb3J0IHsgVEFTS1NfQ09ORklHVVJBVElPTl9LRVksIEZPTERFUl9TRVRUSU5HU19OQU1FLCBMQVVOQ0hfQ09ORklHVVJBVElPTl9LRVksIElDb25maWd1cmF0aW9uQ2FjaGUsIENvbmZpZ3VyYXRpb25LZXksIFJFTU9URV9NQUNISU5FX1NDT1BFUywgRk9MREVSX1NDT1BFUywgV09SS1NQQUNFX1NDT1BFUywgQVBQTFlfQUxMX1BST0ZJTEVTX1NFVFRJTkcsIEFQUExJQ0FUSU9OX1NDT1BFUywgTUNQX0NPTkZJR1VSQVRJT05fS0VZIH0gZnJvbSAnLi4vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSVN0b3JlZFdvcmtzcGFjZUZvbGRlciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZXMvY29tbW9uL3dvcmtzcGFjZXMuanMnO1xuaW1wb3J0IHsgV29ya2JlbmNoU3RhdGUsIElXb3Jrc3BhY2VGb2xkZXIsIElXb3Jrc3BhY2VJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblNjb3BlLCBFeHRlbnNpb25zLCBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5LCBPVkVSUklERV9QUk9QRVJUWV9SRUdFWCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBlcXVhbHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCB7IElSZW1vdGVBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBoYXNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaGFzaC5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVN0cmluZ0RpY3Rpb25hcnkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xsZWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBqb2luUGF0aCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uL2Vudmlyb25tZW50L2Jyb3dzZXIvZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGlzRW1wdHlPYmplY3QsIGlzT2JqZWN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgRGVmYXVsdENvbmZpZ3VyYXRpb24gYXMgQmFzZURlZmF1bHRDb25maWd1cmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbnMuanMnO1xuaW1wb3J0IHsgSUpTT05FZGl0aW5nU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9qc29uRWRpdGluZy5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBEZWZhdWx0Q29uZmlndXJhdGlvbiBleHRlbmRzIEJhc2VEZWZhdWx0Q29uZmlndXJhdGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IERFRkFVTFRfT1ZFUlJJREVTX0NBQ0hFX0VYSVNUU19LRVkgPSAnRGVmYXVsdE92ZXJyaWRlc0NhY2hlRXhpc3RzJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25SZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KEV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbik7XG5cdHByaXZhdGUgY2FjaGVkQ29uZmlndXJhdGlvbkRlZmF1bHRzT3ZlcnJpZGVzOiBJU3RyaW5nRGljdGlvbmFyeTxhbnk+ID0ge307XG5cdHByaXZhdGUgcmVhZG9ubHkgY2FjaGVLZXk6IENvbmZpZ3VyYXRpb25LZXkgPSB7IHR5cGU6ICdkZWZhdWx0cycsIGtleTogJ2NvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlcycgfTtcblxuXHRwcml2YXRlIHVwZGF0ZUNhY2hlOiBib29sZWFuID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uQ2FjaGU6IElDb25maWd1cmF0aW9uQ2FjaGUsXG5cdFx0ZW52aXJvbm1lbnRTZXJ2aWNlOiBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIobG9nU2VydmljZSk7XG5cdFx0aWYgKGVudmlyb25tZW50U2VydmljZS5vcHRpb25zPy5jb25maWd1cmF0aW9uRGVmYXVsdHMpIHtcblx0XHRcdHRoaXMuY29uZmlndXJhdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKFt7IG92ZXJyaWRlczogZW52aXJvbm1lbnRTZXJ2aWNlLm9wdGlvbnMuY29uZmlndXJhdGlvbkRlZmF1bHRzIH1dKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZ2V0Q29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZXMoKTogSVN0cmluZ0RpY3Rpb25hcnk8YW55PiB7XG5cdFx0cmV0dXJuIHRoaXMuY2FjaGVkQ29uZmlndXJhdGlvbkRlZmF1bHRzT3ZlcnJpZGVzO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgaW5pdGlhbGl6ZSgpOiBQcm9taXNlPENvbmZpZ3VyYXRpb25Nb2RlbD4ge1xuXHRcdGF3YWl0IHRoaXMuaW5pdGlhbGl6ZUNhY2hlZENvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlcygpO1xuXHRcdHJldHVybiBzdXBlci5pbml0aWFsaXplKCk7XG5cdH1cblxuXHRvdmVycmlkZSByZWxvYWQoKTogQ29uZmlndXJhdGlvbk1vZGVsIHtcblx0XHR0aGlzLnVwZGF0ZUNhY2hlID0gdHJ1ZTtcblx0XHR0aGlzLmNhY2hlZENvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlcyA9IHt9O1xuXHRcdHRoaXMudXBkYXRlQ2FjaGVkQ29uZmlndXJhdGlvbkRlZmF1bHRzT3ZlcnJpZGVzKCk7XG5cdFx0cmV0dXJuIHN1cGVyLnJlbG9hZCgpO1xuXHR9XG5cblx0aGFzQ2FjaGVkQ29uZmlndXJhdGlvbkRlZmF1bHRzT3ZlcnJpZGVzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhaXNFbXB0eU9iamVjdCh0aGlzLmNhY2hlZENvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlcyk7XG5cdH1cblxuXHRwcml2YXRlIGluaXRpYWl6ZUNhY2hlZENvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlc1Byb21pc2U6IFByb21pc2U8dm9pZD4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgaW5pdGlhbGl6ZUNhY2hlZENvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlcygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuaW5pdGlhaXplQ2FjaGVkQ29uZmlndXJhdGlvbkRlZmF1bHRzT3ZlcnJpZGVzUHJvbWlzZSkge1xuXHRcdFx0dGhpcy5pbml0aWFpemVDYWNoZWRDb25maWd1cmF0aW9uRGVmYXVsdHNPdmVycmlkZXNQcm9taXNlID0gKGFzeW5jICgpID0+IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHQvLyBSZWFkIG9ubHkgd2hlbiB0aGUgY2FjaGUgZXhpc3RzXG5cdFx0XHRcdFx0aWYgKGxvY2FsU3RvcmFnZS5nZXRJdGVtKERlZmF1bHRDb25maWd1cmF0aW9uLkRFRkFVTFRfT1ZFUlJJREVTX0NBQ0hFX0VYSVNUU19LRVkpKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5jb25maWd1cmF0aW9uQ2FjaGUucmVhZCh0aGlzLmNhY2hlS2V5KTtcblx0XHRcdFx0XHRcdGlmIChjb250ZW50KSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuY2FjaGVkQ29uZmlndXJhdGlvbkRlZmF1bHRzT3ZlcnJpZGVzID0gSlNPTi5wYXJzZShjb250ZW50KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7IC8qIGlnbm9yZSAqLyB9XG5cdFx0XHRcdHRoaXMuY2FjaGVkQ29uZmlndXJhdGlvbkRlZmF1bHRzT3ZlcnJpZGVzID0gaXNPYmplY3QodGhpcy5jYWNoZWRDb25maWd1cmF0aW9uRGVmYXVsdHNPdmVycmlkZXMpID8gdGhpcy5jYWNoZWRDb25maWd1cmF0aW9uRGVmYXVsdHNPdmVycmlkZXMgOiB7fTtcblx0XHRcdH0pKCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmluaXRpYWl6ZUNhY2hlZENvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlc1Byb21pc2U7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgb25EaWRVcGRhdGVDb25maWd1cmF0aW9uKHByb3BlcnRpZXM6IHN0cmluZ1tdLCBkZWZhdWx0c092ZXJyaWRlcz86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRzdXBlci5vbkRpZFVwZGF0ZUNvbmZpZ3VyYXRpb24ocHJvcGVydGllcywgZGVmYXVsdHNPdmVycmlkZXMpO1xuXHRcdGlmIChkZWZhdWx0c092ZXJyaWRlcykge1xuXHRcdFx0dGhpcy51cGRhdGVDYWNoZWRDb25maWd1cmF0aW9uRGVmYXVsdHNPdmVycmlkZXMoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZUNhY2hlZENvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlcygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMudXBkYXRlQ2FjaGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgY2FjaGVkQ29uZmlndXJhdGlvbkRlZmF1bHRzT3ZlcnJpZGVzOiBJU3RyaW5nRGljdGlvbmFyeTxhbnk+ID0ge307XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvbkRlZmF1bHRzT3ZlcnJpZGVzID0gdGhpcy5jb25maWd1cmF0aW9uUmVnaXN0cnkuZ2V0Q29uZmlndXJhdGlvbkRlZmF1bHRzT3ZlcnJpZGVzKCk7XG5cdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgY29uZmlndXJhdGlvbkRlZmF1bHRzT3ZlcnJpZGVzKSB7XG5cdFx0XHRpZiAoIU9WRVJSSURFX1BST1BFUlRZX1JFR0VYLnRlc3Qoa2V5KSAmJiB2YWx1ZS52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGNhY2hlZENvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlc1trZXldID0gdmFsdWUudmFsdWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRyeSB7XG5cdFx0XHRpZiAoT2JqZWN0LmtleXMoY2FjaGVkQ29uZmlndXJhdGlvbkRlZmF1bHRzT3ZlcnJpZGVzKS5sZW5ndGgpIHtcblx0XHRcdFx0bG9jYWxTdG9yYWdlLnNldEl0ZW0oRGVmYXVsdENvbmZpZ3VyYXRpb24uREVGQVVMVF9PVkVSUklERVNfQ0FDSEVfRVhJU1RTX0tFWSwgJ3llcycpO1xuXHRcdFx0XHRhd2FpdCB0aGlzLmNvbmZpZ3VyYXRpb25DYWNoZS53cml0ZSh0aGlzLmNhY2hlS2V5LCBKU09OLnN0cmluZ2lmeShjYWNoZWRDb25maWd1cmF0aW9uRGVmYXVsdHNPdmVycmlkZXMpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGxvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKERlZmF1bHRDb25maWd1cmF0aW9uLkRFRkFVTFRfT1ZFUlJJREVTX0NBQ0hFX0VYSVNUU19LRVkpO1xuXHRcdFx0XHRhd2FpdCB0aGlzLmNvbmZpZ3VyYXRpb25DYWNoZS5yZW1vdmUodGhpcy5jYWNoZUtleSk7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHsvKiBJZ25vcmUgZXJyb3IgKi8gfVxuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIEFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbiBleHRlbmRzIFVzZXJTZXR0aW5ncyB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uOiBFbWl0dGVyPENvbmZpZ3VyYXRpb25Nb2RlbD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxDb25maWd1cmF0aW9uTW9kZWw+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUNvbmZpZ3VyYXRpb246IEV2ZW50PENvbmZpZ3VyYXRpb25Nb2RlbD4gPSB0aGlzLl9vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSByZWxvYWRDb25maWd1cmF0aW9uU2NoZWR1bGVyOiBSdW5PbmNlU2NoZWR1bGVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdFx0ZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHR1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0bG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLnNldHRpbmdzUmVzb3VyY2UsIHsgc2NvcGVzOiBBUFBMSUNBVElPTl9TQ09QRVMsIHNraXBVbnJlZ2lzdGVyZWQ6IHRydWUgfSwgdXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaSwgZmlsZVNlcnZpY2UsIGxvZ1NlcnZpY2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMub25EaWRDaGFuZ2UoKCkgPT4gdGhpcy5yZWxvYWRDb25maWd1cmF0aW9uU2NoZWR1bGVyLnNjaGVkdWxlKCkpKTtcblx0XHR0aGlzLnJlbG9hZENvbmZpZ3VyYXRpb25TY2hlZHVsZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgUnVuT25jZVNjaGVkdWxlcigoKSA9PiB0aGlzLmxvYWRDb25maWd1cmF0aW9uKCkudGhlbihjb25maWd1cmF0aW9uTW9kZWwgPT4gdGhpcy5fb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLmZpcmUoY29uZmlndXJhdGlvbk1vZGVsKSksIDUwKSk7XG5cdH1cblxuXHRhc3luYyBpbml0aWFsaXplKCk6IFByb21pc2U8Q29uZmlndXJhdGlvbk1vZGVsPiB7XG5cdFx0cmV0dXJuIHRoaXMubG9hZENvbmZpZ3VyYXRpb24oKTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIGxvYWRDb25maWd1cmF0aW9uKCk6IFByb21pc2U8Q29uZmlndXJhdGlvbk1vZGVsPiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCBzdXBlci5sb2FkQ29uZmlndXJhdGlvbigpO1xuXHRcdGNvbnN0IHZhbHVlID0gbW9kZWwuZ2V0VmFsdWU8c3RyaW5nW10+KEFQUExZX0FMTF9QUk9GSUxFU19TRVRUSU5HKTtcblx0XHRjb25zdCBhbGxQcm9maWxlc1NldHRpbmdzID0gQXJyYXkuaXNBcnJheSh2YWx1ZSkgPyB2YWx1ZSA6IFtdO1xuXHRcdHJldHVybiB0aGlzLnBhcnNlT3B0aW9ucy5pbmNsdWRlIHx8IGFsbFByb2ZpbGVzU2V0dGluZ3MubGVuZ3RoXG5cdFx0XHQ/IHRoaXMucmVwYXJzZSh7IC4uLnRoaXMucGFyc2VPcHRpb25zLCBpbmNsdWRlOiBhbGxQcm9maWxlc1NldHRpbmdzIH0pXG5cdFx0XHQ6IG1vZGVsO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBVc2VyQ29uZmlndXJhdGlvbiBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbjogRW1pdHRlcjxDb25maWd1cmF0aW9uTW9kZWw+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8Q29uZmlndXJhdGlvbk1vZGVsPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uOiBFdmVudDxDb25maWd1cmF0aW9uTW9kZWw+ID0gdGhpcy5fb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgdXNlckNvbmZpZ3VyYXRpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGU8VXNlclNldHRpbmdzIHwgRmlsZVNlcnZpY2VCYXNlZENvbmZpZ3VyYXRpb24+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IHVzZXJDb25maWd1cmF0aW9uQ2hhbmdlRGlzcG9zYWJsZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxJRGlzcG9zYWJsZT4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgcmVsb2FkQ29uZmlndXJhdGlvblNjaGVkdWxlcjogUnVuT25jZVNjaGVkdWxlcjtcblxuXHRnZXQgaGFzVGFza3NMb2FkZWQoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLnVzZXJDb25maWd1cmF0aW9uLnZhbHVlIGluc3RhbmNlb2YgRmlsZVNlcnZpY2VCYXNlZENvbmZpZ3VyYXRpb247IH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHNldHRpbmdzUmVzb3VyY2U6IFVSSSxcblx0XHRwcml2YXRlIHRhc2tzUmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIGNvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnM6IENvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy51c2VyQ29uZmlndXJhdGlvbi52YWx1ZSA9IG5ldyBVc2VyU2V0dGluZ3Moc2V0dGluZ3NSZXNvdXJjZSwgdGhpcy5jb25maWd1cmF0aW9uUGFyc2VPcHRpb25zLCB1cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLCB0aGlzLmZpbGVTZXJ2aWNlLCBsb2dTZXJ2aWNlKTtcblx0XHR0aGlzLnVzZXJDb25maWd1cmF0aW9uQ2hhbmdlRGlzcG9zYWJsZS52YWx1ZSA9IHRoaXMudXNlckNvbmZpZ3VyYXRpb24udmFsdWUub25EaWRDaGFuZ2UoKCkgPT4gdGhpcy5yZWxvYWRDb25maWd1cmF0aW9uU2NoZWR1bGVyLnNjaGVkdWxlKCkpO1xuXHRcdHRoaXMucmVsb2FkQ29uZmlndXJhdGlvblNjaGVkdWxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHRoaXMudXNlckNvbmZpZ3VyYXRpb24udmFsdWUhLmxvYWRDb25maWd1cmF0aW9uKCkudGhlbihjb25maWd1cmF0aW9uTW9kZWwgPT4gdGhpcy5fb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLmZpcmUoY29uZmlndXJhdGlvbk1vZGVsKSksIDUwKSk7XG5cdH1cblxuXHRhc3luYyByZXNldChzZXR0aW5nc1Jlc291cmNlOiBVUkksIHRhc2tzUmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCwgY29uZmlndXJhdGlvblBhcnNlT3B0aW9uczogQ29uZmlndXJhdGlvblBhcnNlT3B0aW9ucyk6IFByb21pc2U8Q29uZmlndXJhdGlvbk1vZGVsPiB7XG5cdFx0dGhpcy5zZXR0aW5nc1Jlc291cmNlID0gc2V0dGluZ3NSZXNvdXJjZTtcblx0XHR0aGlzLnRhc2tzUmVzb3VyY2UgPSB0YXNrc1Jlc291cmNlO1xuXHRcdHRoaXMuY29uZmlndXJhdGlvblBhcnNlT3B0aW9ucyA9IGNvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnM7XG5cdFx0cmV0dXJuIHRoaXMuZG9SZXNldCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb1Jlc2V0KHNldHRpbmdzQ29uZmlndXJhdGlvbj86IENvbmZpZ3VyYXRpb25Nb2RlbCk6IFByb21pc2U8Q29uZmlndXJhdGlvbk1vZGVsPiB7XG5cdFx0Y29uc3QgZm9sZGVyID0gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmRpcm5hbWUodGhpcy5zZXR0aW5nc1Jlc291cmNlKTtcblx0XHRjb25zdCBzdGFuZEFsb25lQ29uZmlndXJhdGlvblJlc291cmNlczogW3N0cmluZywgVVJJXVtdID0gdGhpcy50YXNrc1Jlc291cmNlID8gW1tUQVNLU19DT05GSUdVUkFUSU9OX0tFWSwgdGhpcy50YXNrc1Jlc291cmNlXV0gOiBbXTtcblx0XHRjb25zdCBmaWxlU2VydmljZUJhc2VkQ29uZmlndXJhdGlvbiA9IG5ldyBGaWxlU2VydmljZUJhc2VkQ29uZmlndXJhdGlvbihmb2xkZXIudG9TdHJpbmcoKSwgdGhpcy5zZXR0aW5nc1Jlc291cmNlLCBzdGFuZEFsb25lQ29uZmlndXJhdGlvblJlc291cmNlcywgdGhpcy5jb25maWd1cmF0aW9uUGFyc2VPcHRpb25zLCB0aGlzLmZpbGVTZXJ2aWNlLCB0aGlzLnVyaUlkZW50aXR5U2VydmljZSwgdGhpcy5sb2dTZXJ2aWNlKTtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uTW9kZWwgPSBhd2FpdCBmaWxlU2VydmljZUJhc2VkQ29uZmlndXJhdGlvbi5sb2FkQ29uZmlndXJhdGlvbihzZXR0aW5nc0NvbmZpZ3VyYXRpb24pO1xuXHRcdHRoaXMudXNlckNvbmZpZ3VyYXRpb24udmFsdWUgPSBmaWxlU2VydmljZUJhc2VkQ29uZmlndXJhdGlvbjtcblxuXHRcdC8vIENoZWNrIGZvciB2YWx1ZSBiZWNhdXNlIHVzZXJDb25maWd1cmF0aW9uIG1pZ2h0IGhhdmUgYmVlbiBkaXNwb3NlZC5cblx0XHRpZiAodGhpcy51c2VyQ29uZmlndXJhdGlvbkNoYW5nZURpc3Bvc2FibGUudmFsdWUpIHtcblx0XHRcdHRoaXMudXNlckNvbmZpZ3VyYXRpb25DaGFuZ2VEaXNwb3NhYmxlLnZhbHVlID0gdGhpcy51c2VyQ29uZmlndXJhdGlvbi52YWx1ZS5vbkRpZENoYW5nZSgoKSA9PiB0aGlzLnJlbG9hZENvbmZpZ3VyYXRpb25TY2hlZHVsZXIuc2NoZWR1bGUoKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNvbmZpZ3VyYXRpb25Nb2RlbDtcblx0fVxuXG5cdGFzeW5jIGluaXRpYWxpemUoKTogUHJvbWlzZTxDb25maWd1cmF0aW9uTW9kZWw+IHtcblx0XHRyZXR1cm4gdGhpcy51c2VyQ29uZmlndXJhdGlvbi52YWx1ZSEubG9hZENvbmZpZ3VyYXRpb24oKTtcblx0fVxuXG5cdGFzeW5jIHJlbG9hZChzZXR0aW5nc0NvbmZpZ3VyYXRpb24/OiBDb25maWd1cmF0aW9uTW9kZWwpOiBQcm9taXNlPENvbmZpZ3VyYXRpb25Nb2RlbD4ge1xuXHRcdGlmICh0aGlzLmhhc1Rhc2tzTG9hZGVkKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy51c2VyQ29uZmlndXJhdGlvbi52YWx1ZSEubG9hZENvbmZpZ3VyYXRpb24oKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuZG9SZXNldChzZXR0aW5nc0NvbmZpZ3VyYXRpb24pO1xuXHR9XG5cblx0cmVwYXJzZShwYXJzZU9wdGlvbnM/OiBQYXJ0aWFsPENvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnM+KTogQ29uZmlndXJhdGlvbk1vZGVsIHtcblx0XHR0aGlzLmNvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnMgPSB7IC4uLnRoaXMuY29uZmlndXJhdGlvblBhcnNlT3B0aW9ucywgLi4ucGFyc2VPcHRpb25zIH07XG5cdFx0cmV0dXJuIHRoaXMudXNlckNvbmZpZ3VyYXRpb24udmFsdWUhLnJlcGFyc2UodGhpcy5jb25maWd1cmF0aW9uUGFyc2VPcHRpb25zKTtcblx0fVxuXG5cdGdldFJlc3RyaWN0ZWRTZXR0aW5ncygpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMudXNlckNvbmZpZ3VyYXRpb24udmFsdWUhLmdldFJlc3RyaWN0ZWRTZXR0aW5ncygpO1xuXHR9XG59XG5cbmNsYXNzIEZpbGVTZXJ2aWNlQmFzZWRDb25maWd1cmF0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBhbGxSZXNvdXJjZXM6IFVSSVtdO1xuXHRwcml2YXRlIF9mb2xkZXJTZXR0aW5nc01vZGVsUGFyc2VyOiBDb25maWd1cmF0aW9uTW9kZWxQYXJzZXI7XG5cdHByaXZhdGUgX2ZvbGRlclNldHRpbmdzUGFyc2VPcHRpb25zOiBDb25maWd1cmF0aW9uUGFyc2VPcHRpb25zO1xuXHRwcml2YXRlIF9zdGFuZEFsb25lQ29uZmlndXJhdGlvbnM6IENvbmZpZ3VyYXRpb25Nb2RlbFtdO1xuXHRwcml2YXRlIF9jYWNoZTogQ29uZmlndXJhdGlvbk1vZGVsO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlOiBFbWl0dGVyPHZvaWQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG5hbWU6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHNldHRpbmdzUmVzb3VyY2U6IFVSSSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHN0YW5kQWxvbmVDb25maWd1cmF0aW9uUmVzb3VyY2VzOiBbc3RyaW5nLCBVUkldW10sXG5cdFx0Y29uZmlndXJhdGlvblBhcnNlT3B0aW9uczogQ29uZmlndXJhdGlvblBhcnNlT3B0aW9ucyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmFsbFJlc291cmNlcyA9IFt0aGlzLnNldHRpbmdzUmVzb3VyY2UsIC4uLnRoaXMuc3RhbmRBbG9uZUNvbmZpZ3VyYXRpb25SZXNvdXJjZXMubWFwKChbLCByZXNvdXJjZV0pID0+IHJlc291cmNlKV07XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29tYmluZWREaXNwb3NhYmxlKC4uLnRoaXMuYWxsUmVzb3VyY2VzLm1hcChyZXNvdXJjZSA9PiBjb21iaW5lZERpc3Bvc2FibGUoXG5cdFx0XHR0aGlzLmZpbGVTZXJ2aWNlLndhdGNoKHVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuZGlybmFtZShyZXNvdXJjZSkpLFxuXHRcdFx0Ly8gQWxzbyBsaXN0ZW4gdG8gdGhlIHJlc291cmNlIGluY2FzZSB0aGUgcmVzb3VyY2UgaXMgYSBzeW1saW5rIC0gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzExODEzNFxuXHRcdFx0dGhpcy5maWxlU2VydmljZS53YXRjaChyZXNvdXJjZSlcblx0XHQpKSkpO1xuXG5cdFx0dGhpcy5fZm9sZGVyU2V0dGluZ3NNb2RlbFBhcnNlciA9IG5ldyBDb25maWd1cmF0aW9uTW9kZWxQYXJzZXIobmFtZSwgbG9nU2VydmljZSk7XG5cdFx0dGhpcy5fZm9sZGVyU2V0dGluZ3NQYXJzZU9wdGlvbnMgPSBjb25maWd1cmF0aW9uUGFyc2VPcHRpb25zO1xuXHRcdHRoaXMuX3N0YW5kQWxvbmVDb25maWd1cmF0aW9ucyA9IFtdO1xuXHRcdHRoaXMuX2NhY2hlID0gQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwodGhpcy5sb2dTZXJ2aWNlKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmRlYm91bmNlKFxuXHRcdFx0RXZlbnQuYW55KFxuXHRcdFx0XHRFdmVudC5maWx0ZXIodGhpcy5maWxlU2VydmljZS5vbkRpZEZpbGVzQ2hhbmdlLCBlID0+IHRoaXMuaGFuZGxlRmlsZUNoYW5nZXNFdmVudChlKSksXG5cdFx0XHRcdEV2ZW50LmZpbHRlcih0aGlzLmZpbGVTZXJ2aWNlLm9uRGlkUnVuT3BlcmF0aW9uLCBlID0+IHRoaXMuaGFuZGxlRmlsZU9wZXJhdGlvbkV2ZW50KGUpKVxuXHRcdFx0KSwgKCkgPT4gdW5kZWZpbmVkLCAxMDApKCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKSkpO1xuXHR9XG5cblx0YXN5bmMgcmVzb2x2ZUNvbnRlbnRzKGRvbm90UmVzb2x2ZVNldHRpbmdzPzogYm9vbGVhbik6IFByb21pc2U8W3N0cmluZyB8IHVuZGVmaW5lZCwgW3N0cmluZywgc3RyaW5nIHwgdW5kZWZpbmVkXVtdXT4ge1xuXG5cdFx0Y29uc3QgcmVzb2x2ZUNvbnRlbnRzID0gYXN5bmMgKHJlc291cmNlczogVVJJW10pOiBQcm9taXNlPChzdHJpbmcgfCB1bmRlZmluZWQpW10+ID0+IHtcblx0XHRcdHJldHVybiBQcm9taXNlLmFsbChyZXNvdXJjZXMubWFwKGFzeW5jIHJlc291cmNlID0+IHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZWFkRmlsZShyZXNvdXJjZSwgeyBhdG9taWM6IHRydWUgfSk7XG5cdFx0XHRcdFx0cmV0dXJuIGNvbnRlbnQudmFsdWUudG9TdHJpbmcoKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYEVycm9yIHdoaWxlIHJlc29sdmluZyBjb25maWd1cmF0aW9uIGZpbGUgJyR7cmVzb3VyY2UudG9TdHJpbmcoKX0nOiAke2Vycm9ycy5nZXRFcnJvck1lc3NhZ2UoZXJyb3IpfWApO1xuXHRcdFx0XHRcdGlmICgoPEZpbGVPcGVyYXRpb25FcnJvcj5lcnJvcikuZmlsZU9wZXJhdGlvblJlc3VsdCAhPT0gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9GT1VORFxuXHRcdFx0XHRcdFx0JiYgKDxGaWxlT3BlcmF0aW9uRXJyb3I+ZXJyb3IpLmZpbGVPcGVyYXRpb25SZXN1bHQgIT09IEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9OT1RfRElSRUNUT1JZKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gJ3t9Jztcblx0XHRcdH0pKTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgW1tzZXR0aW5nc0NvbnRlbnRdLCBzdGFuZEFsb25lQ29uZmlndXJhdGlvbkNvbnRlbnRzXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcblx0XHRcdGRvbm90UmVzb2x2ZVNldHRpbmdzID8gUHJvbWlzZS5yZXNvbHZlKFt1bmRlZmluZWRdKSA6IHJlc29sdmVDb250ZW50cyhbdGhpcy5zZXR0aW5nc1Jlc291cmNlXSksXG5cdFx0XHRyZXNvbHZlQ29udGVudHModGhpcy5zdGFuZEFsb25lQ29uZmlndXJhdGlvblJlc291cmNlcy5tYXAoKFssIHJlc291cmNlXSkgPT4gcmVzb3VyY2UpKSxcblx0XHRdKTtcblxuXHRcdHJldHVybiBbc2V0dGluZ3NDb250ZW50LCBzdGFuZEFsb25lQ29uZmlndXJhdGlvbkNvbnRlbnRzLm1hcCgoY29udGVudCwgaW5kZXgpID0+IChbdGhpcy5zdGFuZEFsb25lQ29uZmlndXJhdGlvblJlc291cmNlc1tpbmRleF1bMF0sIGNvbnRlbnRdKSldO1xuXHR9XG5cblx0YXN5bmMgbG9hZENvbmZpZ3VyYXRpb24oc2V0dGluZ3NDb25maWd1cmF0aW9uPzogQ29uZmlndXJhdGlvbk1vZGVsKTogUHJvbWlzZTxDb25maWd1cmF0aW9uTW9kZWw+IHtcblxuXHRcdGNvbnN0IFtzZXR0aW5nc0NvbnRlbnQsIHN0YW5kQWxvbmVDb25maWd1cmF0aW9uQ29udGVudHNdID0gYXdhaXQgdGhpcy5yZXNvbHZlQ29udGVudHMoISFzZXR0aW5nc0NvbmZpZ3VyYXRpb24pO1xuXG5cdFx0Ly8gcmVzZXRcblx0XHR0aGlzLl9zdGFuZEFsb25lQ29uZmlndXJhdGlvbnMgPSBbXTtcblx0XHR0aGlzLl9mb2xkZXJTZXR0aW5nc01vZGVsUGFyc2VyLnBhcnNlKCcnLCB0aGlzLl9mb2xkZXJTZXR0aW5nc1BhcnNlT3B0aW9ucyk7XG5cblx0XHQvLyBwYXJzZVxuXHRcdGlmIChzZXR0aW5nc0NvbnRlbnQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fZm9sZGVyU2V0dGluZ3NNb2RlbFBhcnNlci5wYXJzZShzZXR0aW5nc0NvbnRlbnQsIHRoaXMuX2ZvbGRlclNldHRpbmdzUGFyc2VPcHRpb25zKTtcblx0XHR9XG5cdFx0Zm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHN0YW5kQWxvbmVDb25maWd1cmF0aW9uQ29udGVudHMubGVuZ3RoOyBpbmRleCsrKSB7XG5cdFx0XHRjb25zdCBjb250ZW50cyA9IHN0YW5kQWxvbmVDb25maWd1cmF0aW9uQ29udGVudHNbaW5kZXhdWzFdO1xuXHRcdFx0aWYgKGNvbnRlbnRzICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0Y29uc3Qgc3RhbmRBbG9uZUNvbmZpZ3VyYXRpb25Nb2RlbFBhcnNlciA9IG5ldyBTdGFuZGFsb25lQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyKHRoaXMuc3RhbmRBbG9uZUNvbmZpZ3VyYXRpb25SZXNvdXJjZXNbaW5kZXhdWzFdLnRvU3RyaW5nKCksIHRoaXMuc3RhbmRBbG9uZUNvbmZpZ3VyYXRpb25SZXNvdXJjZXNbaW5kZXhdWzBdLCB0aGlzLmxvZ1NlcnZpY2UpO1xuXHRcdFx0XHRzdGFuZEFsb25lQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyLnBhcnNlKGNvbnRlbnRzKTtcblx0XHRcdFx0dGhpcy5fc3RhbmRBbG9uZUNvbmZpZ3VyYXRpb25zLnB1c2goc3RhbmRBbG9uZUNvbmZpZ3VyYXRpb25Nb2RlbFBhcnNlci5jb25maWd1cmF0aW9uTW9kZWwpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIENvbnNvbGlkYXRlIChzdXBwb3J0ICouanNvbiBmaWxlcyBpbiB0aGUgd29ya3NwYWNlIHNldHRpbmdzIGZvbGRlcilcblx0XHR0aGlzLmNvbnNvbGlkYXRlKHNldHRpbmdzQ29uZmlndXJhdGlvbik7XG5cblx0XHRyZXR1cm4gdGhpcy5fY2FjaGU7XG5cdH1cblxuXHRnZXRSZXN0cmljdGVkU2V0dGluZ3MoKTogc3RyaW5nW10ge1xuXHRcdHJldHVybiB0aGlzLl9mb2xkZXJTZXR0aW5nc01vZGVsUGFyc2VyLnJlc3RyaWN0ZWRDb25maWd1cmF0aW9ucztcblx0fVxuXG5cdHJlcGFyc2UoY29uZmlndXJhdGlvblBhcnNlT3B0aW9uczogQ29uZmlndXJhdGlvblBhcnNlT3B0aW9ucyk6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0Y29uc3Qgb2xkQ29udGVudHMgPSB0aGlzLl9mb2xkZXJTZXR0aW5nc01vZGVsUGFyc2VyLmNvbmZpZ3VyYXRpb25Nb2RlbC5jb250ZW50cztcblx0XHR0aGlzLl9mb2xkZXJTZXR0aW5nc1BhcnNlT3B0aW9ucyA9IGNvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnM7XG5cdFx0dGhpcy5fZm9sZGVyU2V0dGluZ3NNb2RlbFBhcnNlci5yZXBhcnNlKHRoaXMuX2ZvbGRlclNldHRpbmdzUGFyc2VPcHRpb25zKTtcblx0XHRpZiAoIWVxdWFscyhvbGRDb250ZW50cywgdGhpcy5fZm9sZGVyU2V0dGluZ3NNb2RlbFBhcnNlci5jb25maWd1cmF0aW9uTW9kZWwuY29udGVudHMpKSB7XG5cdFx0XHR0aGlzLmNvbnNvbGlkYXRlKCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9jYWNoZTtcblx0fVxuXG5cdHByaXZhdGUgY29uc29saWRhdGUoc2V0dGluZ3NDb25maWd1cmF0aW9uPzogQ29uZmlndXJhdGlvbk1vZGVsKTogdm9pZCB7XG5cdFx0dGhpcy5fY2FjaGUgPSAoc2V0dGluZ3NDb25maWd1cmF0aW9uID8/IHRoaXMuX2ZvbGRlclNldHRpbmdzTW9kZWxQYXJzZXIuY29uZmlndXJhdGlvbk1vZGVsKS5tZXJnZSguLi50aGlzLl9zdGFuZEFsb25lQ29uZmlndXJhdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVGaWxlQ2hhbmdlc0V2ZW50KGV2ZW50OiBGaWxlQ2hhbmdlc0V2ZW50KTogYm9vbGVhbiB7XG5cdFx0Ly8gT25lIG9mIHRoZSByZXNvdXJjZXMgaGFzIGNoYW5nZWRcblx0XHRpZiAodGhpcy5hbGxSZXNvdXJjZXMuc29tZShyZXNvdXJjZSA9PiBldmVudC5jb250YWlucyhyZXNvdXJjZSkpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0Ly8gT25lIG9mIHRoZSByZXNvdXJjZSdzIHBhcmVudCBnb3QgZGVsZXRlZFxuXHRcdGlmICh0aGlzLmFsbFJlc291cmNlcy5zb21lKHJlc291cmNlID0+IGV2ZW50LmNvbnRhaW5zKHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5kaXJuYW1lKHJlc291cmNlKSwgRmlsZUNoYW5nZVR5cGUuREVMRVRFRCkpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVGaWxlT3BlcmF0aW9uRXZlbnQoZXZlbnQ6IEZpbGVPcGVyYXRpb25FdmVudCk6IGJvb2xlYW4ge1xuXHRcdC8vIE9uZSBvZiB0aGUgcmVzb3VyY2VzIGhhcyBjaGFuZ2VkXG5cdFx0aWYgKChldmVudC5pc09wZXJhdGlvbihGaWxlT3BlcmF0aW9uLkNSRUFURSkgfHwgZXZlbnQuaXNPcGVyYXRpb24oRmlsZU9wZXJhdGlvbi5DT1BZKSB8fCBldmVudC5pc09wZXJhdGlvbihGaWxlT3BlcmF0aW9uLkRFTEVURSkgfHwgZXZlbnQuaXNPcGVyYXRpb24oRmlsZU9wZXJhdGlvbi5XUklURSkpXG5cdFx0XHQmJiB0aGlzLmFsbFJlc291cmNlcy5zb21lKHJlc291cmNlID0+IHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKGV2ZW50LnJlc291cmNlLCByZXNvdXJjZSkpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0Ly8gT25lIG9mIHRoZSByZXNvdXJjZSdzIHBhcmVudCBnb3QgZGVsZXRlZFxuXHRcdGlmIChldmVudC5pc09wZXJhdGlvbihGaWxlT3BlcmF0aW9uLkRFTEVURSkgJiYgdGhpcy5hbGxSZXNvdXJjZXMuc29tZShyZXNvdXJjZSA9PiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChldmVudC5yZXNvdXJjZSwgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmRpcm5hbWUocmVzb3VyY2UpKSkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxufVxuXG5leHBvcnQgY2xhc3MgUmVtb3RlVXNlckNvbmZpZ3VyYXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jYWNoZWRDb25maWd1cmF0aW9uOiBDYWNoZWRSZW1vdGVVc2VyQ29uZmlndXJhdGlvbjtcblx0cHJpdmF0ZSByZWFkb25seSBfZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZTtcblx0cHJpdmF0ZSBfdXNlckNvbmZpZ3VyYXRpb246IEZpbGVTZXJ2aWNlQmFzZWRSZW1vdGVVc2VyQ29uZmlndXJhdGlvbiB8IENhY2hlZFJlbW90ZVVzZXJDb25maWd1cmF0aW9uO1xuXHRwcml2YXRlIF91c2VyQ29uZmlndXJhdGlvbkluaXRpYWxpemF0aW9uUHJvbWlzZTogUHJvbWlzZTxDb25maWd1cmF0aW9uTW9kZWw+IHwgbnVsbCA9IG51bGw7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uOiBFbWl0dGVyPENvbmZpZ3VyYXRpb25Nb2RlbD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxDb25maWd1cmF0aW9uTW9kZWw+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uOiBFdmVudDxDb25maWd1cmF0aW9uTW9kZWw+ID0gdGhpcy5fb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkSW5pdGlhbGl6ZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPENvbmZpZ3VyYXRpb25Nb2RlbD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZEluaXRpYWxpemUgPSB0aGlzLl9vbkRpZEluaXRpYWxpemUuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVtb3RlQXV0aG9yaXR5OiBzdHJpbmcsXG5cdFx0Y29uZmlndXJhdGlvbkNhY2hlOiBJQ29uZmlndXJhdGlvbkNhY2hlLFxuXHRcdGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0dXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdHJlbW90ZUFnZW50U2VydmljZTogSVJlbW90ZUFnZW50U2VydmljZSxcblx0XHRsb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2ZpbGVTZXJ2aWNlID0gZmlsZVNlcnZpY2U7XG5cdFx0dGhpcy5fdXNlckNvbmZpZ3VyYXRpb24gPSB0aGlzLl9jYWNoZWRDb25maWd1cmF0aW9uID0gbmV3IENhY2hlZFJlbW90ZVVzZXJDb25maWd1cmF0aW9uKHJlbW90ZUF1dGhvcml0eSwgY29uZmlndXJhdGlvbkNhY2hlLCB7IHNjb3BlczogUkVNT1RFX01BQ0hJTkVfU0NPUEVTIH0sIGxvZ1NlcnZpY2UpO1xuXHRcdHJlbW90ZUFnZW50U2VydmljZS5nZXRFbnZpcm9ubWVudCgpLnRoZW4oYXN5bmMgZW52aXJvbm1lbnQgPT4ge1xuXHRcdFx0aWYgKGVudmlyb25tZW50KSB7XG5cdFx0XHRcdGNvbnN0IHVzZXJDb25maWd1cmF0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEZpbGVTZXJ2aWNlQmFzZWRSZW1vdGVVc2VyQ29uZmlndXJhdGlvbihlbnZpcm9ubWVudC5zZXR0aW5nc1BhdGgsIHsgc2NvcGVzOiBSRU1PVEVfTUFDSElORV9TQ09QRVMgfSwgdGhpcy5fZmlsZVNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZSwgbG9nU2VydmljZSkpO1xuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih1c2VyQ29uZmlndXJhdGlvbi5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oY29uZmlndXJhdGlvbk1vZGVsID0+IHRoaXMub25EaWRVc2VyQ29uZmlndXJhdGlvbkNoYW5nZShjb25maWd1cmF0aW9uTW9kZWwpKSk7XG5cdFx0XHRcdHRoaXMuX3VzZXJDb25maWd1cmF0aW9uSW5pdGlhbGl6YXRpb25Qcm9taXNlID0gdXNlckNvbmZpZ3VyYXRpb24uaW5pdGlhbGl6ZSgpO1xuXHRcdFx0XHRjb25zdCBjb25maWd1cmF0aW9uTW9kZWwgPSBhd2FpdCB0aGlzLl91c2VyQ29uZmlndXJhdGlvbkluaXRpYWxpemF0aW9uUHJvbWlzZTtcblx0XHRcdFx0dGhpcy5fdXNlckNvbmZpZ3VyYXRpb24uZGlzcG9zZSgpO1xuXHRcdFx0XHR0aGlzLl91c2VyQ29uZmlndXJhdGlvbiA9IHVzZXJDb25maWd1cmF0aW9uO1xuXHRcdFx0XHR0aGlzLm9uRGlkVXNlckNvbmZpZ3VyYXRpb25DaGFuZ2UoY29uZmlndXJhdGlvbk1vZGVsKTtcblx0XHRcdFx0dGhpcy5fb25EaWRJbml0aWFsaXplLmZpcmUoY29uZmlndXJhdGlvbk1vZGVsKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIGluaXRpYWxpemUoKTogUHJvbWlzZTxDb25maWd1cmF0aW9uTW9kZWw+IHtcblx0XHRpZiAodGhpcy5fdXNlckNvbmZpZ3VyYXRpb24gaW5zdGFuY2VvZiBGaWxlU2VydmljZUJhc2VkUmVtb3RlVXNlckNvbmZpZ3VyYXRpb24pIHtcblx0XHRcdHJldHVybiB0aGlzLl91c2VyQ29uZmlndXJhdGlvbi5pbml0aWFsaXplKCk7XG5cdFx0fVxuXG5cdFx0Ly8gSW5pdGlhbGl6ZSBjYWNoZWQgY29uZmlndXJhdGlvblxuXHRcdGxldCBjb25maWd1cmF0aW9uTW9kZWwgPSBhd2FpdCB0aGlzLl91c2VyQ29uZmlndXJhdGlvbi5pbml0aWFsaXplKCk7XG5cdFx0aWYgKHRoaXMuX3VzZXJDb25maWd1cmF0aW9uSW5pdGlhbGl6YXRpb25Qcm9taXNlKSB7XG5cdFx0XHQvLyBVc2UgdXNlciBjb25maWd1cmF0aW9uXG5cdFx0XHRjb25maWd1cmF0aW9uTW9kZWwgPSBhd2FpdCB0aGlzLl91c2VyQ29uZmlndXJhdGlvbkluaXRpYWxpemF0aW9uUHJvbWlzZTtcblx0XHRcdHRoaXMuX3VzZXJDb25maWd1cmF0aW9uSW5pdGlhbGl6YXRpb25Qcm9taXNlID0gbnVsbDtcblx0XHR9XG5cblx0XHRyZXR1cm4gY29uZmlndXJhdGlvbk1vZGVsO1xuXHR9XG5cblx0cmVsb2FkKCk6IFByb21pc2U8Q29uZmlndXJhdGlvbk1vZGVsPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3VzZXJDb25maWd1cmF0aW9uLnJlbG9hZCgpO1xuXHR9XG5cblx0cmVwYXJzZSgpOiBDb25maWd1cmF0aW9uTW9kZWwge1xuXHRcdHJldHVybiB0aGlzLl91c2VyQ29uZmlndXJhdGlvbi5yZXBhcnNlKHsgc2NvcGVzOiBSRU1PVEVfTUFDSElORV9TQ09QRVMgfSk7XG5cdH1cblxuXHRnZXRSZXN0cmljdGVkU2V0dGluZ3MoKTogc3RyaW5nW10ge1xuXHRcdHJldHVybiB0aGlzLl91c2VyQ29uZmlndXJhdGlvbi5nZXRSZXN0cmljdGVkU2V0dGluZ3MoKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRVc2VyQ29uZmlndXJhdGlvbkNoYW5nZShjb25maWd1cmF0aW9uTW9kZWw6IENvbmZpZ3VyYXRpb25Nb2RlbCk6IHZvaWQge1xuXHRcdHRoaXMudXBkYXRlQ2FjaGUoKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24uZmlyZShjb25maWd1cmF0aW9uTW9kZWwpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVDYWNoZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5fdXNlckNvbmZpZ3VyYXRpb24gaW5zdGFuY2VvZiBGaWxlU2VydmljZUJhc2VkUmVtb3RlVXNlckNvbmZpZ3VyYXRpb24pIHtcblx0XHRcdGxldCBjb250ZW50OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb250ZW50ID0gYXdhaXQgdGhpcy5fdXNlckNvbmZpZ3VyYXRpb24ucmVzb2x2ZUNvbnRlbnQoKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdGlmICgoPEZpbGVPcGVyYXRpb25FcnJvcj5lcnJvcikuZmlsZU9wZXJhdGlvblJlc3VsdCAhPT0gRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9GT1VORCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGhpcy5fY2FjaGVkQ29uZmlndXJhdGlvbi51cGRhdGVDb25maWd1cmF0aW9uKGNvbnRlbnQpO1xuXHRcdH1cblx0fVxuXG59XG5cbmNsYXNzIEZpbGVTZXJ2aWNlQmFzZWRSZW1vdGVVc2VyQ29uZmlndXJhdGlvbiBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgcGFyc2VyOiBDb25maWd1cmF0aW9uTW9kZWxQYXJzZXI7XG5cdHByaXZhdGUgcGFyc2VPcHRpb25zOiBDb25maWd1cmF0aW9uUGFyc2VPcHRpb25zO1xuXHRwcml2YXRlIHJlYWRvbmx5IHJlbG9hZENvbmZpZ3VyYXRpb25TY2hlZHVsZXI6IFJ1bk9uY2VTY2hlZHVsZXI7XG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uOiBFbWl0dGVyPENvbmZpZ3VyYXRpb25Nb2RlbD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxDb25maWd1cmF0aW9uTW9kZWw+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUNvbmZpZ3VyYXRpb246IEV2ZW50PENvbmZpZ3VyYXRpb25Nb2RlbD4gPSB0aGlzLl9vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBmaWxlV2F0Y2hlckRpc3Bvc2FibGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgZGlyZWN0b3J5V2F0Y2hlckRpc3Bvc2FibGUgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uUmVzb3VyY2U6IFVSSSxcblx0XHRjb25maWd1cmF0aW9uUGFyc2VPcHRpb25zOiBDb25maWd1cmF0aW9uUGFyc2VPcHRpb25zLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5wYXJzZXIgPSBuZXcgQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyKHRoaXMuY29uZmlndXJhdGlvblJlc291cmNlLnRvU3RyaW5nKCksIGxvZ1NlcnZpY2UpO1xuXHRcdHRoaXMucGFyc2VPcHRpb25zID0gY29uZmlndXJhdGlvblBhcnNlT3B0aW9ucztcblx0XHR0aGlzLl9yZWdpc3RlcihmaWxlU2VydmljZS5vbkRpZEZpbGVzQ2hhbmdlKGUgPT4gdGhpcy5oYW5kbGVGaWxlQ2hhbmdlc0V2ZW50KGUpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZmlsZVNlcnZpY2Uub25EaWRSdW5PcGVyYXRpb24oZSA9PiB0aGlzLmhhbmRsZUZpbGVPcGVyYXRpb25FdmVudChlKSkpO1xuXHRcdHRoaXMucmVsb2FkQ29uZmlndXJhdGlvblNjaGVkdWxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHRoaXMucmVsb2FkKCkudGhlbihjb25maWd1cmF0aW9uTW9kZWwgPT4gdGhpcy5fb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLmZpcmUoY29uZmlndXJhdGlvbk1vZGVsKSksIDUwKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMuc3RvcFdhdGNoaW5nUmVzb3VyY2UoKTtcblx0XHRcdHRoaXMuc3RvcFdhdGNoaW5nRGlyZWN0b3J5KCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSB3YXRjaFJlc291cmNlKCk6IHZvaWQge1xuXHRcdHRoaXMuZmlsZVdhdGNoZXJEaXNwb3NhYmxlLnZhbHVlID0gdGhpcy5maWxlU2VydmljZS53YXRjaCh0aGlzLmNvbmZpZ3VyYXRpb25SZXNvdXJjZSk7XG5cdH1cblxuXHRwcml2YXRlIHN0b3BXYXRjaGluZ1Jlc291cmNlKCk6IHZvaWQge1xuXHRcdHRoaXMuZmlsZVdhdGNoZXJEaXNwb3NhYmxlLnZhbHVlID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSB3YXRjaERpcmVjdG9yeSgpOiB2b2lkIHtcblx0XHRjb25zdCBkaXJlY3RvcnkgPSB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuZGlybmFtZSh0aGlzLmNvbmZpZ3VyYXRpb25SZXNvdXJjZSk7XG5cdFx0dGhpcy5kaXJlY3RvcnlXYXRjaGVyRGlzcG9zYWJsZS52YWx1ZSA9IHRoaXMuZmlsZVNlcnZpY2Uud2F0Y2goZGlyZWN0b3J5KTtcblx0fVxuXG5cdHByaXZhdGUgc3RvcFdhdGNoaW5nRGlyZWN0b3J5KCk6IHZvaWQge1xuXHRcdHRoaXMuZGlyZWN0b3J5V2F0Y2hlckRpc3Bvc2FibGUudmFsdWUgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRhc3luYyBpbml0aWFsaXplKCk6IFByb21pc2U8Q29uZmlndXJhdGlvbk1vZGVsPiB7XG5cdFx0Y29uc3QgZXhpc3RzID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5leGlzdHModGhpcy5jb25maWd1cmF0aW9uUmVzb3VyY2UpO1xuXHRcdHRoaXMub25SZXNvdXJjZUV4aXN0cyhleGlzdHMpO1xuXHRcdHJldHVybiB0aGlzLnJlbG9hZCgpO1xuXHR9XG5cblx0YXN5bmMgcmVzb2x2ZUNvbnRlbnQoKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZWFkRmlsZSh0aGlzLmNvbmZpZ3VyYXRpb25SZXNvdXJjZSwgeyBhdG9taWM6IHRydWUgfSk7XG5cdFx0cmV0dXJuIGNvbnRlbnQudmFsdWUudG9TdHJpbmcoKTtcblx0fVxuXG5cdGFzeW5jIHJlbG9hZCgpOiBQcm9taXNlPENvbmZpZ3VyYXRpb25Nb2RlbD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5yZXNvbHZlQ29udGVudCgpO1xuXHRcdFx0dGhpcy5wYXJzZXIucGFyc2UoY29udGVudCwgdGhpcy5wYXJzZU9wdGlvbnMpO1xuXHRcdFx0cmV0dXJuIHRoaXMucGFyc2VyLmNvbmZpZ3VyYXRpb25Nb2RlbDtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXR1cm4gQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwodGhpcy5sb2dTZXJ2aWNlKTtcblx0XHR9XG5cdH1cblxuXHRyZXBhcnNlKGNvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnM6IENvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnMpOiBDb25maWd1cmF0aW9uTW9kZWwge1xuXHRcdHRoaXMucGFyc2VPcHRpb25zID0gY29uZmlndXJhdGlvblBhcnNlT3B0aW9ucztcblx0XHR0aGlzLnBhcnNlci5yZXBhcnNlKHRoaXMucGFyc2VPcHRpb25zKTtcblx0XHRyZXR1cm4gdGhpcy5wYXJzZXIuY29uZmlndXJhdGlvbk1vZGVsO1xuXHR9XG5cblx0Z2V0UmVzdHJpY3RlZFNldHRpbmdzKCk6IHN0cmluZ1tdIHtcblx0XHRyZXR1cm4gdGhpcy5wYXJzZXIucmVzdHJpY3RlZENvbmZpZ3VyYXRpb25zO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVGaWxlQ2hhbmdlc0V2ZW50KGV2ZW50OiBGaWxlQ2hhbmdlc0V2ZW50KTogdm9pZCB7XG5cblx0XHQvLyBGaW5kIGNoYW5nZXMgdGhhdCBhZmZlY3QgdGhlIHJlc291cmNlXG5cdFx0bGV0IGFmZmVjdGVkQnlDaGFuZ2VzID0gZmFsc2U7XG5cdFx0aWYgKGV2ZW50LmNvbnRhaW5zKHRoaXMuY29uZmlndXJhdGlvblJlc291cmNlLCBGaWxlQ2hhbmdlVHlwZS5BRERFRCkpIHtcblx0XHRcdGFmZmVjdGVkQnlDaGFuZ2VzID0gdHJ1ZTtcblx0XHRcdHRoaXMub25SZXNvdXJjZUV4aXN0cyh0cnVlKTtcblx0XHR9IGVsc2UgaWYgKGV2ZW50LmNvbnRhaW5zKHRoaXMuY29uZmlndXJhdGlvblJlc291cmNlLCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEKSkge1xuXHRcdFx0YWZmZWN0ZWRCeUNoYW5nZXMgPSB0cnVlO1xuXHRcdFx0dGhpcy5vblJlc291cmNlRXhpc3RzKGZhbHNlKTtcblx0XHR9IGVsc2UgaWYgKGV2ZW50LmNvbnRhaW5zKHRoaXMuY29uZmlndXJhdGlvblJlc291cmNlLCBGaWxlQ2hhbmdlVHlwZS5VUERBVEVEKSkge1xuXHRcdFx0YWZmZWN0ZWRCeUNoYW5nZXMgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGlmIChhZmZlY3RlZEJ5Q2hhbmdlcykge1xuXHRcdFx0dGhpcy5yZWxvYWRDb25maWd1cmF0aW9uU2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVGaWxlT3BlcmF0aW9uRXZlbnQoZXZlbnQ6IEZpbGVPcGVyYXRpb25FdmVudCk6IHZvaWQge1xuXHRcdGlmICgoZXZlbnQuaXNPcGVyYXRpb24oRmlsZU9wZXJhdGlvbi5DUkVBVEUpIHx8IGV2ZW50LmlzT3BlcmF0aW9uKEZpbGVPcGVyYXRpb24uQ09QWSkgfHwgZXZlbnQuaXNPcGVyYXRpb24oRmlsZU9wZXJhdGlvbi5ERUxFVEUpIHx8IGV2ZW50LmlzT3BlcmF0aW9uKEZpbGVPcGVyYXRpb24uV1JJVEUpKVxuXHRcdFx0JiYgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoZXZlbnQucmVzb3VyY2UsIHRoaXMuY29uZmlndXJhdGlvblJlc291cmNlKSkge1xuXHRcdFx0dGhpcy5yZWxvYWRDb25maWd1cmF0aW9uU2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBvblJlc291cmNlRXhpc3RzKGV4aXN0czogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmIChleGlzdHMpIHtcblx0XHRcdHRoaXMuc3RvcFdhdGNoaW5nRGlyZWN0b3J5KCk7XG5cdFx0XHR0aGlzLndhdGNoUmVzb3VyY2UoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zdG9wV2F0Y2hpbmdSZXNvdXJjZSgpO1xuXHRcdFx0dGhpcy53YXRjaERpcmVjdG9yeSgpO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBDYWNoZWRSZW1vdGVVc2VyQ29uZmlndXJhdGlvbiBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlOiBFbWl0dGVyPENvbmZpZ3VyYXRpb25Nb2RlbD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxDb25maWd1cmF0aW9uTW9kZWw+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8Q29uZmlndXJhdGlvbk1vZGVsPiA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkga2V5OiBDb25maWd1cmF0aW9uS2V5O1xuXHRwcml2YXRlIHJlYWRvbmx5IHBhcnNlcjogQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyO1xuXHRwcml2YXRlIHBhcnNlT3B0aW9uczogQ29uZmlndXJhdGlvblBhcnNlT3B0aW9ucztcblx0cHJpdmF0ZSBjb25maWd1cmF0aW9uTW9kZWw6IENvbmZpZ3VyYXRpb25Nb2RlbDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZW1vdGVBdXRob3JpdHk6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25DYWNoZTogSUNvbmZpZ3VyYXRpb25DYWNoZSxcblx0XHRjb25maWd1cmF0aW9uUGFyc2VPcHRpb25zOiBDb25maWd1cmF0aW9uUGFyc2VPcHRpb25zLFxuXHRcdGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMua2V5ID0geyB0eXBlOiAndXNlcicsIGtleTogcmVtb3RlQXV0aG9yaXR5IH07XG5cdFx0dGhpcy5wYXJzZXIgPSBuZXcgQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyKCdDYWNoZWRSZW1vdGVVc2VyQ29uZmlndXJhdGlvbicsIGxvZ1NlcnZpY2UpO1xuXHRcdHRoaXMucGFyc2VPcHRpb25zID0gY29uZmlndXJhdGlvblBhcnNlT3B0aW9ucztcblx0XHR0aGlzLmNvbmZpZ3VyYXRpb25Nb2RlbCA9IENvbmZpZ3VyYXRpb25Nb2RlbC5jcmVhdGVFbXB0eU1vZGVsKGxvZ1NlcnZpY2UpO1xuXHR9XG5cblx0Z2V0Q29uZmlndXJhdGlvbk1vZGVsKCk6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0cmV0dXJuIHRoaXMuY29uZmlndXJhdGlvbk1vZGVsO1xuXHR9XG5cblx0aW5pdGlhbGl6ZSgpOiBQcm9taXNlPENvbmZpZ3VyYXRpb25Nb2RlbD4ge1xuXHRcdHJldHVybiB0aGlzLnJlbG9hZCgpO1xuXHR9XG5cblx0cmVwYXJzZShjb25maWd1cmF0aW9uUGFyc2VPcHRpb25zOiBDb25maWd1cmF0aW9uUGFyc2VPcHRpb25zKTogQ29uZmlndXJhdGlvbk1vZGVsIHtcblx0XHR0aGlzLnBhcnNlT3B0aW9ucyA9IGNvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnM7XG5cdFx0dGhpcy5wYXJzZXIucmVwYXJzZSh0aGlzLnBhcnNlT3B0aW9ucyk7XG5cdFx0dGhpcy5jb25maWd1cmF0aW9uTW9kZWwgPSB0aGlzLnBhcnNlci5jb25maWd1cmF0aW9uTW9kZWw7XG5cdFx0cmV0dXJuIHRoaXMuY29uZmlndXJhdGlvbk1vZGVsO1xuXHR9XG5cblx0Z2V0UmVzdHJpY3RlZFNldHRpbmdzKCk6IHN0cmluZ1tdIHtcblx0XHRyZXR1cm4gdGhpcy5wYXJzZXIucmVzdHJpY3RlZENvbmZpZ3VyYXRpb25zO1xuXHR9XG5cblx0YXN5bmMgcmVsb2FkKCk6IFByb21pc2U8Q29uZmlndXJhdGlvbk1vZGVsPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmNvbmZpZ3VyYXRpb25DYWNoZS5yZWFkKHRoaXMua2V5KTtcblx0XHRcdGNvbnN0IHBhcnNlZDogeyBjb250ZW50OiBzdHJpbmcgfSA9IEpTT04ucGFyc2UoY29udGVudCk7XG5cdFx0XHRpZiAocGFyc2VkLmNvbnRlbnQpIHtcblx0XHRcdFx0dGhpcy5wYXJzZXIucGFyc2UocGFyc2VkLmNvbnRlbnQsIHRoaXMucGFyc2VPcHRpb25zKTtcblx0XHRcdFx0dGhpcy5jb25maWd1cmF0aW9uTW9kZWwgPSB0aGlzLnBhcnNlci5jb25maWd1cmF0aW9uTW9kZWw7XG5cdFx0XHR9XG5cdFx0fSBjYXRjaCAoZSkgeyAvKiBJZ25vcmUgZXJyb3IgKi8gfVxuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25Nb2RlbDtcblx0fVxuXG5cdGFzeW5jIHVwZGF0ZUNvbmZpZ3VyYXRpb24oY29udGVudDogc3RyaW5nIHwgdW5kZWZpbmVkKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGNvbnRlbnQpIHtcblx0XHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25DYWNoZS53cml0ZSh0aGlzLmtleSwgSlNPTi5zdHJpbmdpZnkoeyBjb250ZW50IH0pKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHRoaXMuY29uZmlndXJhdGlvbkNhY2hlLnJlbW92ZSh0aGlzLmtleSk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBXb3Jrc3BhY2VDb25maWd1cmF0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY2FjaGVkQ29uZmlndXJhdGlvbjogQ2FjaGVkV29ya3NwYWNlQ29uZmlndXJhdGlvbjtcblx0cHJpdmF0ZSBfd29ya3NwYWNlQ29uZmlndXJhdGlvbjogQ2FjaGVkV29ya3NwYWNlQ29uZmlndXJhdGlvbiB8IEZpbGVTZXJ2aWNlQmFzZWRXb3Jrc3BhY2VDb25maWd1cmF0aW9uO1xuXHRwcml2YXRlIHJlYWRvbmx5IF93b3Jrc3BhY2VDb25maWd1cmF0aW9uRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRwcml2YXRlIF93b3Jrc3BhY2VJZGVudGlmaWVyOiBJV29ya3NwYWNlSWRlbnRpZmllciB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF9pc1dvcmtzcGFjZVRydXN0ZWQ6IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFVwZGF0ZUNvbmZpZ3VyYXRpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxib29sZWFuPigpKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkVXBkYXRlQ29uZmlndXJhdGlvbiA9IHRoaXMuX29uRGlkVXBkYXRlQ29uZmlndXJhdGlvbi5ldmVudDtcblxuXHRwcml2YXRlIF9pbml0aWFsaXplZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRnZXQgaW5pdGlhbGl6ZWQoKTogYm9vbGVhbiB7IHJldHVybiB0aGlzLl9pbml0aWFsaXplZDsgfVxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25DYWNoZTogSUNvbmZpZ3VyYXRpb25DYWNoZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmZpbGVTZXJ2aWNlID0gZmlsZVNlcnZpY2U7XG5cdFx0dGhpcy5fd29ya3NwYWNlQ29uZmlndXJhdGlvbiA9IHRoaXMuX2NhY2hlZENvbmZpZ3VyYXRpb24gPSBuZXcgQ2FjaGVkV29ya3NwYWNlQ29uZmlndXJhdGlvbihjb25maWd1cmF0aW9uQ2FjaGUsIGxvZ1NlcnZpY2UpO1xuXHR9XG5cblx0YXN5bmMgaW5pdGlhbGl6ZSh3b3Jrc3BhY2VJZGVudGlmaWVyOiBJV29ya3NwYWNlSWRlbnRpZmllciwgd29ya3NwYWNlVHJ1c3RlZDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3dvcmtzcGFjZUlkZW50aWZpZXIgPSB3b3Jrc3BhY2VJZGVudGlmaWVyO1xuXHRcdHRoaXMuX2lzV29ya3NwYWNlVHJ1c3RlZCA9IHdvcmtzcGFjZVRydXN0ZWQ7XG5cdFx0aWYgKCF0aGlzLl9pbml0aWFsaXplZCkge1xuXHRcdFx0aWYgKHRoaXMuY29uZmlndXJhdGlvbkNhY2hlLm5lZWRzQ2FjaGluZyh0aGlzLl93b3Jrc3BhY2VJZGVudGlmaWVyLmNvbmZpZ1BhdGgpKSB7XG5cdFx0XHRcdHRoaXMuX3dvcmtzcGFjZUNvbmZpZ3VyYXRpb24gPSB0aGlzLl9jYWNoZWRDb25maWd1cmF0aW9uO1xuXHRcdFx0XHR0aGlzLndhaXRBbmRJbml0aWFsaXplKHRoaXMuX3dvcmtzcGFjZUlkZW50aWZpZXIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5kb0luaXRpYWxpemUobmV3IEZpbGVTZXJ2aWNlQmFzZWRXb3Jrc3BhY2VDb25maWd1cmF0aW9uKHRoaXMuZmlsZVNlcnZpY2UsIHRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLCB0aGlzLmxvZ1NlcnZpY2UpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0YXdhaXQgdGhpcy5yZWxvYWQoKTtcblx0fVxuXG5cdGFzeW5jIHJlbG9hZCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5fd29ya3NwYWNlSWRlbnRpZmllcikge1xuXHRcdFx0YXdhaXQgdGhpcy5fd29ya3NwYWNlQ29uZmlndXJhdGlvbi5sb2FkKHRoaXMuX3dvcmtzcGFjZUlkZW50aWZpZXIsIHsgc2NvcGVzOiBXT1JLU1BBQ0VfU0NPUEVTLCBza2lwUmVzdHJpY3RlZDogdGhpcy5pc1VudHJ1c3RlZCgpIH0pO1xuXHRcdH1cblx0fVxuXG5cdGdldEZvbGRlcnMoKTogSVN0b3JlZFdvcmtzcGFjZUZvbGRlcltdIHtcblx0XHRyZXR1cm4gdGhpcy5fd29ya3NwYWNlQ29uZmlndXJhdGlvbi5nZXRGb2xkZXJzKCk7XG5cdH1cblxuXHRzZXRGb2xkZXJzKGZvbGRlcnM6IElTdG9yZWRXb3Jrc3BhY2VGb2xkZXJbXSwganNvbkVkaXRpbmdTZXJ2aWNlOiBJSlNPTkVkaXRpbmdTZXJ2aWNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuX3dvcmtzcGFjZUlkZW50aWZpZXIpIHtcblx0XHRcdHJldHVybiBqc29uRWRpdGluZ1NlcnZpY2Uud3JpdGUodGhpcy5fd29ya3NwYWNlSWRlbnRpZmllci5jb25maWdQYXRoLCBbeyBwYXRoOiBbJ2ZvbGRlcnMnXSwgdmFsdWU6IGZvbGRlcnMgfV0sIHRydWUpXG5cdFx0XHRcdC50aGVuKCgpID0+IHRoaXMucmVsb2FkKCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cblxuXHRpc1RyYW5zaWVudCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fd29ya3NwYWNlQ29uZmlndXJhdGlvbi5pc1RyYW5zaWVudCgpO1xuXHR9XG5cblx0Z2V0Q29uZmlndXJhdGlvbigpOiBDb25maWd1cmF0aW9uTW9kZWwge1xuXHRcdHJldHVybiB0aGlzLl93b3Jrc3BhY2VDb25maWd1cmF0aW9uLmdldFdvcmtzcGFjZVNldHRpbmdzKCk7XG5cdH1cblxuXHR1cGRhdGVXb3Jrc3BhY2VUcnVzdCh0cnVzdGVkOiBib29sZWFuKTogQ29uZmlndXJhdGlvbk1vZGVsIHtcblx0XHR0aGlzLl9pc1dvcmtzcGFjZVRydXN0ZWQgPSB0cnVzdGVkO1xuXHRcdHJldHVybiB0aGlzLnJlcGFyc2VXb3Jrc3BhY2VTZXR0aW5ncygpO1xuXHR9XG5cblx0cmVwYXJzZVdvcmtzcGFjZVNldHRpbmdzKCk6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0dGhpcy5fd29ya3NwYWNlQ29uZmlndXJhdGlvbi5yZXBhcnNlV29ya3NwYWNlU2V0dGluZ3MoeyBzY29wZXM6IFdPUktTUEFDRV9TQ09QRVMsIHNraXBSZXN0cmljdGVkOiB0aGlzLmlzVW50cnVzdGVkKCkgfSk7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0Q29uZmlndXJhdGlvbigpO1xuXHR9XG5cblx0Z2V0UmVzdHJpY3RlZFNldHRpbmdzKCk6IHN0cmluZ1tdIHtcblx0XHRyZXR1cm4gdGhpcy5fd29ya3NwYWNlQ29uZmlndXJhdGlvbi5nZXRSZXN0cmljdGVkU2V0dGluZ3MoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgd2FpdEFuZEluaXRpYWxpemUod29ya3NwYWNlSWRlbnRpZmllcjogSVdvcmtzcGFjZUlkZW50aWZpZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB3aGVuUHJvdmlkZXJSZWdpc3RlcmVkKHdvcmtzcGFjZUlkZW50aWZpZXIuY29uZmlnUGF0aCwgdGhpcy5maWxlU2VydmljZSk7XG5cdFx0aWYgKCEodGhpcy5fd29ya3NwYWNlQ29uZmlndXJhdGlvbiBpbnN0YW5jZW9mIEZpbGVTZXJ2aWNlQmFzZWRXb3Jrc3BhY2VDb25maWd1cmF0aW9uKSkge1xuXHRcdFx0Y29uc3QgZmlsZVNlcnZpY2VCYXNlZFdvcmtzcGFjZUNvbmZpZ3VyYXRpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRmlsZVNlcnZpY2VCYXNlZFdvcmtzcGFjZUNvbmZpZ3VyYXRpb24odGhpcy5maWxlU2VydmljZSwgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UsIHRoaXMubG9nU2VydmljZSkpO1xuXHRcdFx0YXdhaXQgZmlsZVNlcnZpY2VCYXNlZFdvcmtzcGFjZUNvbmZpZ3VyYXRpb24ubG9hZCh3b3Jrc3BhY2VJZGVudGlmaWVyLCB7IHNjb3BlczogV09SS1NQQUNFX1NDT1BFUywgc2tpcFJlc3RyaWN0ZWQ6IHRoaXMuaXNVbnRydXN0ZWQoKSB9KTtcblx0XHRcdHRoaXMuZG9Jbml0aWFsaXplKGZpbGVTZXJ2aWNlQmFzZWRXb3Jrc3BhY2VDb25maWd1cmF0aW9uKTtcblx0XHRcdHRoaXMub25EaWRXb3Jrc3BhY2VDb25maWd1cmF0aW9uQ2hhbmdlKGZhbHNlLCB0cnVlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGRvSW5pdGlhbGl6ZShmaWxlU2VydmljZUJhc2VkV29ya3NwYWNlQ29uZmlndXJhdGlvbjogRmlsZVNlcnZpY2VCYXNlZFdvcmtzcGFjZUNvbmZpZ3VyYXRpb24pOiB2b2lkIHtcblx0XHR0aGlzLl93b3Jrc3BhY2VDb25maWd1cmF0aW9uRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHR0aGlzLl93b3Jrc3BhY2VDb25maWd1cmF0aW9uID0gdGhpcy5fd29ya3NwYWNlQ29uZmlndXJhdGlvbkRpc3Bvc2FibGVzLmFkZChmaWxlU2VydmljZUJhc2VkV29ya3NwYWNlQ29uZmlndXJhdGlvbik7XG5cdFx0dGhpcy5fd29ya3NwYWNlQ29uZmlndXJhdGlvbkRpc3Bvc2FibGVzLmFkZCh0aGlzLl93b3Jrc3BhY2VDb25maWd1cmF0aW9uLm9uRGlkQ2hhbmdlKGUgPT4gdGhpcy5vbkRpZFdvcmtzcGFjZUNvbmZpZ3VyYXRpb25DaGFuZ2UodHJ1ZSwgZmFsc2UpKSk7XG5cdFx0dGhpcy5faW5pdGlhbGl6ZWQgPSB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1VudHJ1c3RlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gIXRoaXMuX2lzV29ya3NwYWNlVHJ1c3RlZDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgb25EaWRXb3Jrc3BhY2VDb25maWd1cmF0aW9uQ2hhbmdlKHJlbG9hZDogYm9vbGVhbiwgZnJvbUNhY2hlOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHJlbG9hZCkge1xuXHRcdFx0YXdhaXQgdGhpcy5yZWxvYWQoKTtcblx0XHR9XG5cdFx0dGhpcy51cGRhdGVDYWNoZSgpO1xuXHRcdHRoaXMuX29uRGlkVXBkYXRlQ29uZmlndXJhdGlvbi5maXJlKGZyb21DYWNoZSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZUNhY2hlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLl93b3Jrc3BhY2VJZGVudGlmaWVyICYmIHRoaXMuY29uZmlndXJhdGlvbkNhY2hlLm5lZWRzQ2FjaGluZyh0aGlzLl93b3Jrc3BhY2VJZGVudGlmaWVyLmNvbmZpZ1BhdGgpICYmIHRoaXMuX3dvcmtzcGFjZUNvbmZpZ3VyYXRpb24gaW5zdGFuY2VvZiBGaWxlU2VydmljZUJhc2VkV29ya3NwYWNlQ29uZmlndXJhdGlvbikge1xuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuX3dvcmtzcGFjZUNvbmZpZ3VyYXRpb24ucmVzb2x2ZUNvbnRlbnQodGhpcy5fd29ya3NwYWNlSWRlbnRpZmllcik7XG5cdFx0XHRhd2FpdCB0aGlzLl9jYWNoZWRDb25maWd1cmF0aW9uLnVwZGF0ZVdvcmtzcGFjZSh0aGlzLl93b3Jrc3BhY2VJZGVudGlmaWVyLCBjb250ZW50KTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgRmlsZVNlcnZpY2VCYXNlZFdvcmtzcGFjZUNvbmZpZ3VyYXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHR3b3Jrc3BhY2VDb25maWd1cmF0aW9uTW9kZWxQYXJzZXI6IFdvcmtzcGFjZUNvbmZpZ3VyYXRpb25Nb2RlbFBhcnNlcjtcblx0d29ya3NwYWNlU2V0dGluZ3M6IENvbmZpZ3VyYXRpb25Nb2RlbDtcblx0cHJpdmF0ZSBfd29ya3NwYWNlSWRlbnRpZmllcjogSVdvcmtzcGFjZUlkZW50aWZpZXIgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSB3b3Jrc3BhY2VDb25maWdXYXRjaGVyOiBJRGlzcG9zYWJsZTtcblx0cHJpdmF0ZSByZWFkb25seSByZWxvYWRDb25maWd1cmF0aW9uU2NoZWR1bGVyOiBSdW5PbmNlU2NoZWR1bGVyO1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRDaGFuZ2U6IEVtaXR0ZXI8dm9pZD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2UuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy53b3Jrc3BhY2VDb25maWd1cmF0aW9uTW9kZWxQYXJzZXIgPSBuZXcgV29ya3NwYWNlQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyKCcnLCBsb2dTZXJ2aWNlKTtcblx0XHR0aGlzLndvcmtzcGFjZVNldHRpbmdzID0gQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwobG9nU2VydmljZSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5hbnkoXG5cdFx0XHRFdmVudC5maWx0ZXIodGhpcy5maWxlU2VydmljZS5vbkRpZEZpbGVzQ2hhbmdlLCBlID0+ICEhdGhpcy5fd29ya3NwYWNlSWRlbnRpZmllciAmJiBlLmNvbnRhaW5zKHRoaXMuX3dvcmtzcGFjZUlkZW50aWZpZXIuY29uZmlnUGF0aCkpLFxuXHRcdFx0RXZlbnQuZmlsdGVyKHRoaXMuZmlsZVNlcnZpY2Uub25EaWRSdW5PcGVyYXRpb24sIGUgPT4gISF0aGlzLl93b3Jrc3BhY2VJZGVudGlmaWVyICYmIChlLmlzT3BlcmF0aW9uKEZpbGVPcGVyYXRpb24uQ1JFQVRFKSB8fCBlLmlzT3BlcmF0aW9uKEZpbGVPcGVyYXRpb24uQ09QWSkgfHwgZS5pc09wZXJhdGlvbihGaWxlT3BlcmF0aW9uLkRFTEVURSkgfHwgZS5pc09wZXJhdGlvbihGaWxlT3BlcmF0aW9uLldSSVRFKSkgJiYgdXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKGUucmVzb3VyY2UsIHRoaXMuX3dvcmtzcGFjZUlkZW50aWZpZXIuY29uZmlnUGF0aCkpXG5cdFx0KSgoKSA9PiB0aGlzLnJlbG9hZENvbmZpZ3VyYXRpb25TY2hlZHVsZXIuc2NoZWR1bGUoKSkpO1xuXHRcdHRoaXMucmVsb2FkQ29uZmlndXJhdGlvblNjaGVkdWxlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKSwgNTApKTtcblx0XHR0aGlzLndvcmtzcGFjZUNvbmZpZ1dhdGNoZXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLndhdGNoV29ya3NwYWNlQ29uZmlndXJhdGlvbkZpbGUoKSk7XG5cdH1cblxuXHRnZXQgd29ya3NwYWNlSWRlbnRpZmllcigpOiBJV29ya3NwYWNlSWRlbnRpZmllciB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLl93b3Jrc3BhY2VJZGVudGlmaWVyO1xuXHR9XG5cblx0YXN5bmMgcmVzb2x2ZUNvbnRlbnQod29ya3NwYWNlSWRlbnRpZmllcjogSVdvcmtzcGFjZUlkZW50aWZpZXIpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKHdvcmtzcGFjZUlkZW50aWZpZXIuY29uZmlnUGF0aCwgeyBhdG9taWM6IHRydWUgfSk7XG5cdFx0cmV0dXJuIGNvbnRlbnQudmFsdWUudG9TdHJpbmcoKTtcblx0fVxuXG5cdGFzeW5jIGxvYWQod29ya3NwYWNlSWRlbnRpZmllcjogSVdvcmtzcGFjZUlkZW50aWZpZXIsIGNvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnM6IENvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuX3dvcmtzcGFjZUlkZW50aWZpZXIgfHwgdGhpcy5fd29ya3NwYWNlSWRlbnRpZmllci5pZCAhPT0gd29ya3NwYWNlSWRlbnRpZmllci5pZCkge1xuXHRcdFx0dGhpcy5fd29ya3NwYWNlSWRlbnRpZmllciA9IHdvcmtzcGFjZUlkZW50aWZpZXI7XG5cdFx0XHR0aGlzLndvcmtzcGFjZUNvbmZpZ3VyYXRpb25Nb2RlbFBhcnNlciA9IG5ldyBXb3Jrc3BhY2VDb25maWd1cmF0aW9uTW9kZWxQYXJzZXIodGhpcy5fd29ya3NwYWNlSWRlbnRpZmllci5pZCwgdGhpcy5sb2dTZXJ2aWNlKTtcblx0XHRcdGRpc3Bvc2UodGhpcy53b3Jrc3BhY2VDb25maWdXYXRjaGVyKTtcblx0XHRcdHRoaXMud29ya3NwYWNlQ29uZmlnV2F0Y2hlciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMud2F0Y2hXb3Jrc3BhY2VDb25maWd1cmF0aW9uRmlsZSgpKTtcblx0XHR9XG5cdFx0bGV0IGNvbnRlbnRzID0gJyc7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnRlbnRzID0gYXdhaXQgdGhpcy5yZXNvbHZlQ29udGVudCh0aGlzLl93b3Jrc3BhY2VJZGVudGlmaWVyKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0Y29uc3QgZXhpc3RzID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5leGlzdHModGhpcy5fd29ya3NwYWNlSWRlbnRpZmllci5jb25maWdQYXRoKTtcblx0XHRcdGlmIChleGlzdHMpIHtcblx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy53b3Jrc3BhY2VDb25maWd1cmF0aW9uTW9kZWxQYXJzZXIucGFyc2UoY29udGVudHMsIGNvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnMpO1xuXHRcdHRoaXMuY29uc29saWRhdGUoKTtcblx0fVxuXG5cdGdldENvbmZpZ3VyYXRpb25Nb2RlbCgpOiBDb25maWd1cmF0aW9uTW9kZWwge1xuXHRcdHJldHVybiB0aGlzLndvcmtzcGFjZUNvbmZpZ3VyYXRpb25Nb2RlbFBhcnNlci5jb25maWd1cmF0aW9uTW9kZWw7XG5cdH1cblxuXHRnZXRGb2xkZXJzKCk6IElTdG9yZWRXb3Jrc3BhY2VGb2xkZXJbXSB7XG5cdFx0cmV0dXJuIHRoaXMud29ya3NwYWNlQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyLmZvbGRlcnM7XG5cdH1cblxuXHRpc1RyYW5zaWVudCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy53b3Jrc3BhY2VDb25maWd1cmF0aW9uTW9kZWxQYXJzZXIudHJhbnNpZW50O1xuXHR9XG5cblx0Z2V0V29ya3NwYWNlU2V0dGluZ3MoKTogQ29uZmlndXJhdGlvbk1vZGVsIHtcblx0XHRyZXR1cm4gdGhpcy53b3Jrc3BhY2VTZXR0aW5ncztcblx0fVxuXG5cdHJlcGFyc2VXb3Jrc3BhY2VTZXR0aW5ncyhjb25maWd1cmF0aW9uUGFyc2VPcHRpb25zOiBDb25maWd1cmF0aW9uUGFyc2VPcHRpb25zKTogQ29uZmlndXJhdGlvbk1vZGVsIHtcblx0XHR0aGlzLndvcmtzcGFjZUNvbmZpZ3VyYXRpb25Nb2RlbFBhcnNlci5yZXBhcnNlV29ya3NwYWNlU2V0dGluZ3MoY29uZmlndXJhdGlvblBhcnNlT3B0aW9ucyk7XG5cdFx0dGhpcy5jb25zb2xpZGF0ZSgpO1xuXHRcdHJldHVybiB0aGlzLmdldFdvcmtzcGFjZVNldHRpbmdzKCk7XG5cdH1cblxuXHRnZXRSZXN0cmljdGVkU2V0dGluZ3MoKTogc3RyaW5nW10ge1xuXHRcdHJldHVybiB0aGlzLndvcmtzcGFjZUNvbmZpZ3VyYXRpb25Nb2RlbFBhcnNlci5nZXRSZXN0cmljdGVkV29ya3NwYWNlU2V0dGluZ3MoKTtcblx0fVxuXG5cdHByaXZhdGUgY29uc29saWRhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy53b3Jrc3BhY2VTZXR0aW5ncyA9IHRoaXMud29ya3NwYWNlQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyLnNldHRpbmdzTW9kZWwubWVyZ2UodGhpcy53b3Jrc3BhY2VDb25maWd1cmF0aW9uTW9kZWxQYXJzZXIubGF1bmNoTW9kZWwsIHRoaXMud29ya3NwYWNlQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyLnRhc2tzTW9kZWwpO1xuXHR9XG5cblx0cHJpdmF0ZSB3YXRjaFdvcmtzcGFjZUNvbmZpZ3VyYXRpb25GaWxlKCk6IElEaXNwb3NhYmxlIHtcblx0XHRyZXR1cm4gdGhpcy5fd29ya3NwYWNlSWRlbnRpZmllciA/IHRoaXMuZmlsZVNlcnZpY2Uud2F0Y2godGhpcy5fd29ya3NwYWNlSWRlbnRpZmllci5jb25maWdQYXRoKSA6IERpc3Bvc2FibGUuTm9uZTtcblx0fVxuXG59XG5cbmNsYXNzIENhY2hlZFdvcmtzcGFjZUNvbmZpZ3VyYXRpb24ge1xuXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlOiBFdmVudDx2b2lkPiA9IEV2ZW50Lk5vbmU7XG5cblx0d29ya3NwYWNlQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyOiBXb3Jrc3BhY2VDb25maWd1cmF0aW9uTW9kZWxQYXJzZXI7XG5cdHdvcmtzcGFjZVNldHRpbmdzOiBDb25maWd1cmF0aW9uTW9kZWw7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uQ2FjaGU6IElDb25maWd1cmF0aW9uQ2FjaGUsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHtcblx0XHR0aGlzLndvcmtzcGFjZUNvbmZpZ3VyYXRpb25Nb2RlbFBhcnNlciA9IG5ldyBXb3Jrc3BhY2VDb25maWd1cmF0aW9uTW9kZWxQYXJzZXIoJycsIGxvZ1NlcnZpY2UpO1xuXHRcdHRoaXMud29ya3NwYWNlU2V0dGluZ3MgPSBDb25maWd1cmF0aW9uTW9kZWwuY3JlYXRlRW1wdHlNb2RlbChsb2dTZXJ2aWNlKTtcblx0fVxuXG5cdGFzeW5jIGxvYWQod29ya3NwYWNlSWRlbnRpZmllcjogSVdvcmtzcGFjZUlkZW50aWZpZXIsIGNvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnM6IENvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3Qga2V5ID0gdGhpcy5nZXRLZXkod29ya3NwYWNlSWRlbnRpZmllcik7XG5cdFx0XHRjb25zdCBjb250ZW50cyA9IGF3YWl0IHRoaXMuY29uZmlndXJhdGlvbkNhY2hlLnJlYWQoa2V5KTtcblx0XHRcdGNvbnN0IHBhcnNlZDogeyBjb250ZW50OiBzdHJpbmcgfSA9IEpTT04ucGFyc2UoY29udGVudHMpO1xuXHRcdFx0aWYgKHBhcnNlZC5jb250ZW50KSB7XG5cdFx0XHRcdHRoaXMud29ya3NwYWNlQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyID0gbmV3IFdvcmtzcGFjZUNvbmZpZ3VyYXRpb25Nb2RlbFBhcnNlcihrZXkua2V5LCB0aGlzLmxvZ1NlcnZpY2UpO1xuXHRcdFx0XHR0aGlzLndvcmtzcGFjZUNvbmZpZ3VyYXRpb25Nb2RlbFBhcnNlci5wYXJzZShwYXJzZWQuY29udGVudCwgY29uZmlndXJhdGlvblBhcnNlT3B0aW9ucyk7XG5cdFx0XHRcdHRoaXMuY29uc29saWRhdGUoKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0fVxuXHR9XG5cblx0Z2V0IHdvcmtzcGFjZUlkZW50aWZpZXIoKTogSVdvcmtzcGFjZUlkZW50aWZpZXIgfCBudWxsIHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGdldENvbmZpZ3VyYXRpb25Nb2RlbCgpOiBDb25maWd1cmF0aW9uTW9kZWwge1xuXHRcdHJldHVybiB0aGlzLndvcmtzcGFjZUNvbmZpZ3VyYXRpb25Nb2RlbFBhcnNlci5jb25maWd1cmF0aW9uTW9kZWw7XG5cdH1cblxuXHRnZXRGb2xkZXJzKCk6IElTdG9yZWRXb3Jrc3BhY2VGb2xkZXJbXSB7XG5cdFx0cmV0dXJuIHRoaXMud29ya3NwYWNlQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyLmZvbGRlcnM7XG5cdH1cblxuXHRpc1RyYW5zaWVudCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy53b3Jrc3BhY2VDb25maWd1cmF0aW9uTW9kZWxQYXJzZXIudHJhbnNpZW50O1xuXHR9XG5cblx0Z2V0V29ya3NwYWNlU2V0dGluZ3MoKTogQ29uZmlndXJhdGlvbk1vZGVsIHtcblx0XHRyZXR1cm4gdGhpcy53b3Jrc3BhY2VTZXR0aW5ncztcblx0fVxuXG5cdHJlcGFyc2VXb3Jrc3BhY2VTZXR0aW5ncyhjb25maWd1cmF0aW9uUGFyc2VPcHRpb25zOiBDb25maWd1cmF0aW9uUGFyc2VPcHRpb25zKTogQ29uZmlndXJhdGlvbk1vZGVsIHtcblx0XHR0aGlzLndvcmtzcGFjZUNvbmZpZ3VyYXRpb25Nb2RlbFBhcnNlci5yZXBhcnNlV29ya3NwYWNlU2V0dGluZ3MoY29uZmlndXJhdGlvblBhcnNlT3B0aW9ucyk7XG5cdFx0dGhpcy5jb25zb2xpZGF0ZSgpO1xuXHRcdHJldHVybiB0aGlzLmdldFdvcmtzcGFjZVNldHRpbmdzKCk7XG5cdH1cblxuXHRnZXRSZXN0cmljdGVkU2V0dGluZ3MoKTogc3RyaW5nW10ge1xuXHRcdHJldHVybiB0aGlzLndvcmtzcGFjZUNvbmZpZ3VyYXRpb25Nb2RlbFBhcnNlci5nZXRSZXN0cmljdGVkV29ya3NwYWNlU2V0dGluZ3MoKTtcblx0fVxuXG5cdHByaXZhdGUgY29uc29saWRhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy53b3Jrc3BhY2VTZXR0aW5ncyA9IHRoaXMud29ya3NwYWNlQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyLnNldHRpbmdzTW9kZWwubWVyZ2UodGhpcy53b3Jrc3BhY2VDb25maWd1cmF0aW9uTW9kZWxQYXJzZXIubGF1bmNoTW9kZWwsIHRoaXMud29ya3NwYWNlQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyLnRhc2tzTW9kZWwpO1xuXHR9XG5cblx0YXN5bmMgdXBkYXRlV29ya3NwYWNlKHdvcmtzcGFjZUlkZW50aWZpZXI6IElXb3Jrc3BhY2VJZGVudGlmaWVyLCBjb250ZW50OiBzdHJpbmcgfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3Qga2V5ID0gdGhpcy5nZXRLZXkod29ya3NwYWNlSWRlbnRpZmllcik7XG5cdFx0XHRpZiAoY29udGVudCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmNvbmZpZ3VyYXRpb25DYWNoZS53cml0ZShrZXksIEpTT04uc3RyaW5naWZ5KHsgY29udGVudCB9KSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmNvbmZpZ3VyYXRpb25DYWNoZS5yZW1vdmUoa2V5KTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0S2V5KHdvcmtzcGFjZUlkZW50aWZpZXI6IElXb3Jrc3BhY2VJZGVudGlmaWVyKTogQ29uZmlndXJhdGlvbktleSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHR5cGU6ICd3b3Jrc3BhY2VzJyxcblx0XHRcdGtleTogd29ya3NwYWNlSWRlbnRpZmllci5pZFxuXHRcdH07XG5cdH1cbn1cblxuY2xhc3MgQ2FjaGVkRm9sZGVyQ29uZmlndXJhdGlvbiB7XG5cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2UgPSBFdmVudC5Ob25lO1xuXG5cdHByaXZhdGUgX2ZvbGRlclNldHRpbmdzTW9kZWxQYXJzZXI6IENvbmZpZ3VyYXRpb25Nb2RlbFBhcnNlcjtcblx0cHJpdmF0ZSBfZm9sZGVyU2V0dGluZ3NQYXJzZU9wdGlvbnM6IENvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnM7XG5cdHByaXZhdGUgX3N0YW5kQWxvbmVDb25maWd1cmF0aW9uczogQ29uZmlndXJhdGlvbk1vZGVsW107XG5cdHByaXZhdGUgY29uZmlndXJhdGlvbk1vZGVsOiBDb25maWd1cmF0aW9uTW9kZWw7XG5cdHByaXZhdGUgcmVhZG9ubHkga2V5OiBDb25maWd1cmF0aW9uS2V5O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGZvbGRlcjogVVJJLFxuXHRcdGNvbmZpZ0ZvbGRlclJlbGF0aXZlUGF0aDogc3RyaW5nLFxuXHRcdGNvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnM6IENvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uQ2FjaGU6IElDb25maWd1cmF0aW9uQ2FjaGUsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHtcblx0XHR0aGlzLmtleSA9IHsgdHlwZTogJ2ZvbGRlcicsIGtleTogaGFzaChqb2luUGF0aChmb2xkZXIsIGNvbmZpZ0ZvbGRlclJlbGF0aXZlUGF0aCkudG9TdHJpbmcoKSkudG9TdHJpbmcoMTYpIH07XG5cdFx0dGhpcy5fZm9sZGVyU2V0dGluZ3NNb2RlbFBhcnNlciA9IG5ldyBDb25maWd1cmF0aW9uTW9kZWxQYXJzZXIoJ0NhY2hlZEZvbGRlckNvbmZpZ3VyYXRpb24nLCBsb2dTZXJ2aWNlKTtcblx0XHR0aGlzLl9mb2xkZXJTZXR0aW5nc1BhcnNlT3B0aW9ucyA9IGNvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnM7XG5cdFx0dGhpcy5fc3RhbmRBbG9uZUNvbmZpZ3VyYXRpb25zID0gW107XG5cdFx0dGhpcy5jb25maWd1cmF0aW9uTW9kZWwgPSBDb25maWd1cmF0aW9uTW9kZWwuY3JlYXRlRW1wdHlNb2RlbChsb2dTZXJ2aWNlKTtcblx0fVxuXG5cdGFzeW5jIGxvYWRDb25maWd1cmF0aW9uKCk6IFByb21pc2U8Q29uZmlndXJhdGlvbk1vZGVsPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGNvbnRlbnRzID0gYXdhaXQgdGhpcy5jb25maWd1cmF0aW9uQ2FjaGUucmVhZCh0aGlzLmtleSk7XG5cdFx0XHRjb25zdCB7IGNvbnRlbnQ6IGNvbmZpZ3VyYXRpb25Db250ZW50cyB9OiB7IGNvbnRlbnQ6IElTdHJpbmdEaWN0aW9uYXJ5PHN0cmluZz4gfSA9IEpTT04ucGFyc2UoY29udGVudHMudG9TdHJpbmcoKSk7XG5cdFx0XHRpZiAoY29uZmlndXJhdGlvbkNvbnRlbnRzKSB7XG5cdFx0XHRcdGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKGNvbmZpZ3VyYXRpb25Db250ZW50cykpIHtcblx0XHRcdFx0XHRpZiAoa2V5ID09PSBGT0xERVJfU0VUVElOR1NfTkFNRSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fZm9sZGVyU2V0dGluZ3NNb2RlbFBhcnNlci5wYXJzZShjb25maWd1cmF0aW9uQ29udGVudHNba2V5XSwgdGhpcy5fZm9sZGVyU2V0dGluZ3NQYXJzZU9wdGlvbnMpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb25zdCBzdGFuZEFsb25lQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyID0gbmV3IFN0YW5kYWxvbmVDb25maWd1cmF0aW9uTW9kZWxQYXJzZXIoa2V5LCBrZXksIHRoaXMubG9nU2VydmljZSk7XG5cdFx0XHRcdFx0XHRzdGFuZEFsb25lQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyLnBhcnNlKGNvbmZpZ3VyYXRpb25Db250ZW50c1trZXldKTtcblx0XHRcdFx0XHRcdHRoaXMuX3N0YW5kQWxvbmVDb25maWd1cmF0aW9ucy5wdXNoKHN0YW5kQWxvbmVDb25maWd1cmF0aW9uTW9kZWxQYXJzZXIuY29uZmlndXJhdGlvbk1vZGVsKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMuY29uc29saWRhdGUoKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25Nb2RlbDtcblx0fVxuXG5cdGFzeW5jIHVwZGF0ZUNvbmZpZ3VyYXRpb24oc2V0dGluZ3NDb250ZW50OiBzdHJpbmcgfCB1bmRlZmluZWQsIHN0YW5kQWxvbmVDb25maWd1cmF0aW9uQ29udGVudHM6IFtzdHJpbmcsIHN0cmluZyB8IHVuZGVmaW5lZF1bXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbnRlbnQ6IGFueSA9IHt9O1xuXHRcdGlmIChzZXR0aW5nc0NvbnRlbnQpIHtcblx0XHRcdGNvbnRlbnRbRk9MREVSX1NFVFRJTkdTX05BTUVdID0gc2V0dGluZ3NDb250ZW50O1xuXHRcdH1cblx0XHRzdGFuZEFsb25lQ29uZmlndXJhdGlvbkNvbnRlbnRzLmZvckVhY2goKFtrZXksIGNvbnRlbnRzXSkgPT4ge1xuXHRcdFx0aWYgKGNvbnRlbnRzKSB7XG5cdFx0XHRcdGNvbnRlbnRba2V5XSA9IGNvbnRlbnRzO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGlmIChPYmplY3Qua2V5cyhjb250ZW50KS5sZW5ndGgpIHtcblx0XHRcdGF3YWl0IHRoaXMuY29uZmlndXJhdGlvbkNhY2hlLndyaXRlKHRoaXMua2V5LCBKU09OLnN0cmluZ2lmeSh7IGNvbnRlbnQgfSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhd2FpdCB0aGlzLmNvbmZpZ3VyYXRpb25DYWNoZS5yZW1vdmUodGhpcy5rZXkpO1xuXHRcdH1cblx0fVxuXG5cdGdldFJlc3RyaWN0ZWRTZXR0aW5ncygpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX2ZvbGRlclNldHRpbmdzTW9kZWxQYXJzZXIucmVzdHJpY3RlZENvbmZpZ3VyYXRpb25zO1xuXHR9XG5cblx0cmVwYXJzZShjb25maWd1cmF0aW9uUGFyc2VPcHRpb25zOiBDb25maWd1cmF0aW9uUGFyc2VPcHRpb25zKTogQ29uZmlndXJhdGlvbk1vZGVsIHtcblx0XHR0aGlzLl9mb2xkZXJTZXR0aW5nc1BhcnNlT3B0aW9ucyA9IGNvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnM7XG5cdFx0dGhpcy5fZm9sZGVyU2V0dGluZ3NNb2RlbFBhcnNlci5yZXBhcnNlKHRoaXMuX2ZvbGRlclNldHRpbmdzUGFyc2VPcHRpb25zKTtcblx0XHR0aGlzLmNvbnNvbGlkYXRlKCk7XG5cdFx0cmV0dXJuIHRoaXMuY29uZmlndXJhdGlvbk1vZGVsO1xuXHR9XG5cblx0cHJpdmF0ZSBjb25zb2xpZGF0ZSgpOiB2b2lkIHtcblx0XHR0aGlzLmNvbmZpZ3VyYXRpb25Nb2RlbCA9IHRoaXMuX2ZvbGRlclNldHRpbmdzTW9kZWxQYXJzZXIuY29uZmlndXJhdGlvbk1vZGVsLm1lcmdlKC4uLnRoaXMuX3N0YW5kQWxvbmVDb25maWd1cmF0aW9ucyk7XG5cdH1cblxuXHRnZXRVbnN1cHBvcnRlZEtleXMoKTogc3RyaW5nW10ge1xuXHRcdHJldHVybiBbXTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRm9sZGVyQ29uZmlndXJhdGlvbiBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByb3RlY3RlZCByZWFkb25seSBfb25EaWRDaGFuZ2U6IEVtaXR0ZXI8dm9pZD4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSBmb2xkZXJDb25maWd1cmF0aW9uOiBDYWNoZWRGb2xkZXJDb25maWd1cmF0aW9uIHwgRmlsZVNlcnZpY2VCYXNlZENvbmZpZ3VyYXRpb247XG5cdHByaXZhdGUgcmVhZG9ubHkgc2NvcGVzOiBDb25maWd1cmF0aW9uU2NvcGVbXTtcblx0cHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uRm9sZGVyOiBVUkk7XG5cdHByaXZhdGUgY2FjaGVkRm9sZGVyQ29uZmlndXJhdGlvbjogQ2FjaGVkRm9sZGVyQ29uZmlndXJhdGlvbjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHR1c2VDYWNoZTogYm9vbGVhbixcblx0XHRyZWFkb25seSB3b3Jrc3BhY2VGb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIsXG5cdFx0Y29uZmlnRm9sZGVyUmVsYXRpdmVQYXRoOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB3b3JrYmVuY2hTdGF0ZTogV29ya2JlbmNoU3RhdGUsXG5cdFx0cHJpdmF0ZSB3b3Jrc3BhY2VUcnVzdGVkOiBib29sZWFuLFxuXHRcdGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0dXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvbkNhY2hlOiBJQ29uZmlndXJhdGlvbkNhY2hlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnNjb3BlcyA9IFdvcmtiZW5jaFN0YXRlLldPUktTUEFDRSA9PT0gdGhpcy53b3JrYmVuY2hTdGF0ZSA/IEZPTERFUl9TQ09QRVMgOiBXT1JLU1BBQ0VfU0NPUEVTO1xuXHRcdHRoaXMuY29uZmlndXJhdGlvbkZvbGRlciA9IHVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuam9pblBhdGgod29ya3NwYWNlRm9sZGVyLnVyaSwgY29uZmlnRm9sZGVyUmVsYXRpdmVQYXRoKTtcblx0XHR0aGlzLmNhY2hlZEZvbGRlckNvbmZpZ3VyYXRpb24gPSBuZXcgQ2FjaGVkRm9sZGVyQ29uZmlndXJhdGlvbih3b3Jrc3BhY2VGb2xkZXIudXJpLCBjb25maWdGb2xkZXJSZWxhdGl2ZVBhdGgsIHsgc2NvcGVzOiB0aGlzLnNjb3Blcywgc2tpcFJlc3RyaWN0ZWQ6IHRoaXMuaXNVbnRydXN0ZWQoKSB9LCBjb25maWd1cmF0aW9uQ2FjaGUsIGxvZ1NlcnZpY2UpO1xuXHRcdGlmICh1c2VDYWNoZSAmJiB0aGlzLmNvbmZpZ3VyYXRpb25DYWNoZS5uZWVkc0NhY2hpbmcod29ya3NwYWNlRm9sZGVyLnVyaSkpIHtcblx0XHRcdHRoaXMuZm9sZGVyQ29uZmlndXJhdGlvbiA9IHRoaXMuY2FjaGVkRm9sZGVyQ29uZmlndXJhdGlvbjtcblx0XHRcdHdoZW5Qcm92aWRlclJlZ2lzdGVyZWQod29ya3NwYWNlRm9sZGVyLnVyaSwgZmlsZVNlcnZpY2UpXG5cdFx0XHRcdC50aGVuKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLmZvbGRlckNvbmZpZ3VyYXRpb24gPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmNyZWF0ZUZpbGVTZXJ2aWNlQmFzZWRDb25maWd1cmF0aW9uKGZpbGVTZXJ2aWNlLCB1cmlJZGVudGl0eVNlcnZpY2UsIGxvZ1NlcnZpY2UpKTtcblx0XHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZvbGRlckNvbmZpZ3VyYXRpb24ub25EaWRDaGFuZ2UoZSA9PiB0aGlzLm9uRGlkRm9sZGVyQ29uZmlndXJhdGlvbkNoYW5nZSgpKSk7XG5cdFx0XHRcdFx0dGhpcy5vbkRpZEZvbGRlckNvbmZpZ3VyYXRpb25DaGFuZ2UoKTtcblx0XHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZm9sZGVyQ29uZmlndXJhdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuY3JlYXRlRmlsZVNlcnZpY2VCYXNlZENvbmZpZ3VyYXRpb24oZmlsZVNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZSwgbG9nU2VydmljZSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5mb2xkZXJDb25maWd1cmF0aW9uLm9uRGlkQ2hhbmdlKGUgPT4gdGhpcy5vbkRpZEZvbGRlckNvbmZpZ3VyYXRpb25DaGFuZ2UoKSkpO1xuXHRcdH1cblx0fVxuXG5cdGxvYWRDb25maWd1cmF0aW9uKCk6IFByb21pc2U8Q29uZmlndXJhdGlvbk1vZGVsPiB7XG5cdFx0cmV0dXJuIHRoaXMuZm9sZGVyQ29uZmlndXJhdGlvbi5sb2FkQ29uZmlndXJhdGlvbigpO1xuXHR9XG5cblx0dXBkYXRlV29ya3NwYWNlVHJ1c3QodHJ1c3RlZDogYm9vbGVhbik6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0dGhpcy53b3Jrc3BhY2VUcnVzdGVkID0gdHJ1c3RlZDtcblx0XHRyZXR1cm4gdGhpcy5yZXBhcnNlKCk7XG5cdH1cblxuXHRyZXBhcnNlKCk6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvbk1vZGVsID0gdGhpcy5mb2xkZXJDb25maWd1cmF0aW9uLnJlcGFyc2UoeyBzY29wZXM6IHRoaXMuc2NvcGVzLCBza2lwUmVzdHJpY3RlZDogdGhpcy5pc1VudHJ1c3RlZCgpIH0pO1xuXHRcdHRoaXMudXBkYXRlQ2FjaGUoKTtcblx0XHRyZXR1cm4gY29uZmlndXJhdGlvbk1vZGVsO1xuXHR9XG5cblx0Z2V0UmVzdHJpY3RlZFNldHRpbmdzKCk6IHN0cmluZ1tdIHtcblx0XHRyZXR1cm4gdGhpcy5mb2xkZXJDb25maWd1cmF0aW9uLmdldFJlc3RyaWN0ZWRTZXR0aW5ncygpO1xuXHR9XG5cblx0cHJpdmF0ZSBpc1VudHJ1c3RlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gIXRoaXMud29ya3NwYWNlVHJ1c3RlZDtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRGb2xkZXJDb25maWd1cmF0aW9uQ2hhbmdlKCk6IHZvaWQge1xuXHRcdHRoaXMudXBkYXRlQ2FjaGUoKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKCk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUZpbGVTZXJ2aWNlQmFzZWRDb25maWd1cmF0aW9uKGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSwgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UpIHtcblx0XHRjb25zdCBzZXR0aW5nc1Jlc291cmNlID0gdXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5qb2luUGF0aCh0aGlzLmNvbmZpZ3VyYXRpb25Gb2xkZXIsIGAke0ZPTERFUl9TRVRUSU5HU19OQU1FfS5qc29uYCk7XG5cdFx0Y29uc3Qgc3RhbmRBbG9uZUNvbmZpZ3VyYXRpb25SZXNvdXJjZXM6IFtzdHJpbmcsIFVSSV1bXSA9IFtUQVNLU19DT05GSUdVUkFUSU9OX0tFWSwgTEFVTkNIX0NPTkZJR1VSQVRJT05fS0VZLCBNQ1BfQ09ORklHVVJBVElPTl9LRVldLm1hcChuYW1lID0+IChbbmFtZSwgdXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5qb2luUGF0aCh0aGlzLmNvbmZpZ3VyYXRpb25Gb2xkZXIsIGAke25hbWV9Lmpzb25gKV0pKTtcblx0XHRyZXR1cm4gbmV3IEZpbGVTZXJ2aWNlQmFzZWRDb25maWd1cmF0aW9uKHRoaXMuY29uZmlndXJhdGlvbkZvbGRlci50b1N0cmluZygpLCBzZXR0aW5nc1Jlc291cmNlLCBzdGFuZEFsb25lQ29uZmlndXJhdGlvblJlc291cmNlcywgeyBzY29wZXM6IHRoaXMuc2NvcGVzLCBza2lwUmVzdHJpY3RlZDogdGhpcy5pc1VudHJ1c3RlZCgpIH0sIGZpbGVTZXJ2aWNlLCB1cmlJZGVudGl0eVNlcnZpY2UsIGxvZ1NlcnZpY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVDYWNoZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uQ2FjaGUubmVlZHNDYWNoaW5nKHRoaXMuY29uZmlndXJhdGlvbkZvbGRlcikgJiYgdGhpcy5mb2xkZXJDb25maWd1cmF0aW9uIGluc3RhbmNlb2YgRmlsZVNlcnZpY2VCYXNlZENvbmZpZ3VyYXRpb24pIHtcblx0XHRcdGNvbnN0IFtzZXR0aW5nc0NvbnRlbnQsIHN0YW5kQWxvbmVDb25maWd1cmF0aW9uQ29udGVudHNdID0gYXdhaXQgdGhpcy5mb2xkZXJDb25maWd1cmF0aW9uLnJlc29sdmVDb250ZW50cygpO1xuXHRcdFx0dGhpcy5jYWNoZWRGb2xkZXJDb25maWd1cmF0aW9uLnVwZGF0ZUNvbmZpZ3VyYXRpb24oc2V0dGluZ3NDb250ZW50LCBzdGFuZEFsb25lQ29uZmlndXJhdGlvbkNvbnRlbnRzKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLFNBQVMsT0FBTyxlQUFlO0FBQy9CLFlBQVksWUFBWTtBQUN4QixTQUFTLFlBQXlCLFNBQVMsY0FBYyxtQkFBbUIsb0JBQW9CLHVCQUF1QjtBQUN2SCxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGdCQUFnRCx3QkFBNEMscUJBQXFCLHFCQUF5QztBQUNuSyxTQUFTLG9CQUFvQiwwQkFBcUQsb0JBQW9CO0FBQ3RHLFNBQVMsbUNBQW1DLDBDQUEwQztBQUN0RixTQUFTLHlCQUF5QixzQkFBc0IsMEJBQWlFLHVCQUF1QixlQUFlLGtCQUFrQiw0QkFBNEIsb0JBQW9CLDZCQUE2QjtBQUU5UCxTQUFTLHNCQUE4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
