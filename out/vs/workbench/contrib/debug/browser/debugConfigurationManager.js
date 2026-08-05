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
import { distinct } from "../../../../base/common/arrays.js";
import { sequence } from "../../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import * as json from "../../../../base/common/json.js";
import { DisposableStore, dispose } from "../../../../base/common/lifecycle.js";
import * as resources from "../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { URI as uri } from "../../../../base/common/uri.js";
import * as nls from "../../../../nls.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Extensions as JSONExtensions } from "../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { launchSchemaId } from "../../../services/configuration/common/configuration.js";
import { ACTIVE_GROUP, IEditorService } from "../../../services/editor/common/editorService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IHistoryService } from "../../../services/history/common/history.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { CONTEXT_DEBUG_CONFIGURATION_TYPE, DebugConfigurationProviderTriggerKind } from "../common/debug.js";
import { launchSchema } from "../common/debugSchemas.js";
import { getVisibleAndSorted } from "../common/debugUtils.js";
import { debugConfigure } from "./debugIcons.js";
const jsonRegistry = Registry.as(JSONExtensions.JSONContribution);
jsonRegistry.registerSchema(launchSchemaId, launchSchema);
const DEBUG_SELECTED_CONFIG_NAME_KEY = "debug.selectedconfigname";
const DEBUG_SELECTED_ROOT = "debug.selectedroot";
const DEBUG_SELECTED_TYPE = "debug.selectedtype";
const DEBUG_RECENT_DYNAMIC_CONFIGURATIONS = "debug.recentdynamicconfigurations";
const ON_DEBUG_DYNAMIC_CONFIGURATIONS_NAME = "onDebugDynamicConfigurations";
let ConfigurationManager = class {
  constructor(adapterManager, contextService, configurationService, quickInputService, instantiationService, storageService, extensionService, historyService, uriIdentityService, contextKeyService, logService) {
    this.adapterManager = adapterManager;
    this.contextService = contextService;
    this.configurationService = configurationService;
    this.quickInputService = quickInputService;
    this.instantiationService = instantiationService;
    this.storageService = storageService;
    this.extensionService = extensionService;
    this.historyService = historyService;
    this.uriIdentityService = uriIdentityService;
    this.logService = logService;
    this.getSelectedConfig = () => Promise.resolve(void 0);
    this.selectedDynamic = false;
    this._onDidSelectConfigurationName = new Emitter();
    this._onDidChangeConfigurationProviders = new Emitter();
    this.onDidChangeConfigurationProviders = this._onDidChangeConfigurationProviders.event;
    this.configProviders = [];
    this.toDispose = [this._onDidChangeConfigurationProviders];
    this.initLaunches();
    this.setCompoundSchemaValues();
    this.registerListeners();
    const previousSelectedRoot = this.storageService.get(DEBUG_SELECTED_ROOT, StorageScope.WORKSPACE);
    const previousSelectedType = this.storageService.get(DEBUG_SELECTED_TYPE, StorageScope.WORKSPACE);
    const previousSelectedLaunch = this.launches.find((l) => l.uri.toString() === previousSelectedRoot);
    const previousSelectedName = this.storageService.get(DEBUG_SELECTED_CONFIG_NAME_KEY, StorageScope.WORKSPACE);
    this.debugConfigurationTypeContext = CONTEXT_DEBUG_CONFIGURATION_TYPE.bindTo(contextKeyService);
    const dynamicConfig = previousSelectedType ? { type: previousSelectedType } : void 0;
    if (previousSelectedLaunch && previousSelectedLaunch.getConfigurationNames().length) {
      this.selectConfiguration(previousSelectedLaunch, previousSelectedName, void 0, dynamicConfig);
    } else if (this.launches.length > 0) {
      this.selectConfiguration(void 0, previousSelectedName, void 0, dynamicConfig);
    }
  }
  registerDebugConfigurationProvider(debugConfigurationProvider) {
    this.configProviders.push(debugConfigurationProvider);
    this._onDidChangeConfigurationProviders.fire();
    return {
      dispose: () => {
        this.unregisterDebugConfigurationProvider(debugConfigurationProvider);
        this._onDidChangeConfigurationProviders.fire();
      }
    };
  }
  unregisterDebugConfigurationProvider(debugConfigurationProvider) {
    const ix = this.configProviders.indexOf(debugConfigurationProvider);
    if (ix >= 0) {
      this.configProviders.splice(ix, 1);
    }
  }
  /**
   * if scope is not specified,a value of DebugConfigurationProvideTrigger.Initial is assumed.
   */
  hasDebugConfigurationProvider(debugType, triggerKind) {
    if (triggerKind === void 0) {
      triggerKind = DebugConfigurationProviderTriggerKind.Initial;
    }
    const provider = this.configProviders.find((p) => p.provideDebugConfigurations && p.type === debugType && p.triggerKind === triggerKind);
    return !!provider;
  }
  async resolveConfigurationByProviders(folderUri, type, config, token) {
    const resolveDebugConfigurationForType = async (type2, config2) => {
      if (type2 !== "*") {
        await this.adapterManager.activateDebuggers("onDebugResolve", type2);
      }
      for (const p of this.configProviders) {
        if (p.type === type2 && p.resolveDebugConfiguration && config2) {
          config2 = await p.resolveDebugConfiguration(folderUri, config2, token);
        }
      }
      return config2;
    };
    let resolvedType = config.type ?? type;
    let result = config;
    for (let seen = /* @__PURE__ */ new Set(); result && !seen.has(resolvedType); ) {
      seen.add(resolvedType);
      result = await resolveDebugConfigurationForType(resolvedType, result);
      result = await resolveDebugConfigurationForType("*", result);
      resolvedType = result?.type ?? type;
    }
    return result;
  }
  async resolveDebugConfigurationWithSubstitutedVariables(folderUri, type, config, token) {
    const providers = this.configProviders.filter((p) => p.type === type && p.resolveDebugConfigurationWithSubstitutedVariables).concat(this.configProviders.filter((p) => p.type === "*" && p.resolveDebugConfigurationWithSubstitutedVariables));
    let result = config;
    await sequence(providers.map((provider) => async () => {
      if (result) {
        result = await provider.resolveDebugConfigurationWithSubstitutedVariables(folderUri, result, token);
      }
    }));
    return result;
  }
  async provideDebugConfigurations(folderUri, type, token) {
    await this.adapterManager.activateDebuggers("onDebugInitialConfigurations");
    const results = await Promise.all(this.configProviders.filter((p) => p.type === type && p.triggerKind === DebugConfigurationProviderTriggerKind.Initial && p.provideDebugConfigurations).map((p) => p.provideDebugConfigurations(folderUri, token)));
    return results.reduce((first, second) => first.concat(second), []);
  }
  async getDynamicProviders() {
    await this.extensionService.whenInstalledExtensionsRegistered();
    const debugDynamicExtensionsTypes = this.extensionService.extensions.reduce((acc, e) => {
      if (!e.activationEvents) {
        return acc;
      }
      const explicitTypes = [];
      let hasGenericEvent = false;
      for (const event of e.activationEvents) {
        if (event === ON_DEBUG_DYNAMIC_CONFIGURATIONS_NAME) {
          hasGenericEvent = true;
        } else if (event.startsWith(`${ON_DEBUG_DYNAMIC_CONFIGURATIONS_NAME}:`)) {
          explicitTypes.push(event.slice(ON_DEBUG_DYNAMIC_CONFIGURATIONS_NAME.length + 1));
        }
      }
      if (explicitTypes.length) {
        explicitTypes.forEach((t) => acc.add(t));
      } else if (hasGenericEvent) {
        const debuggerType = e.contributes?.debuggers?.[0].type;
        if (debuggerType) {
          acc.add(debuggerType);
        }
      }
      return acc;
    }, /* @__PURE__ */ new Set());
    for (const configProvider of this.configProviders) {
      if (configProvider.triggerKind === DebugConfigurationProviderTriggerKind.Dynamic) {
        debugDynamicExtensionsTypes.add(configProvider.type);
      }
    }
    return [...debugDynamicExtensionsTypes].map((type) => {
      return {
        label: this.adapterManager.getDebuggerLabel(type),
        getProvider: async () => {
          await this.adapterManager.activateDebuggers(ON_DEBUG_DYNAMIC_CONFIGURATIONS_NAME, type);
          return this.configProviders.find((p) => p.type === type && p.triggerKind === DebugConfigurationProviderTriggerKind.Dynamic && p.provideDebugConfigurations);
        },
        type,
        pick: async () => {
          await this.adapterManager.activateDebuggers(ON_DEBUG_DYNAMIC_CONFIGURATIONS_NAME, type);
          const disposables = new DisposableStore();
          const token = new CancellationTokenSource();
          disposables.add(token);
          const input = disposables.add(this.quickInputService.createQuickPick());
          input.busy = true;
          input.placeholder = nls.localize("selectConfiguration", "Select Launch Configuration");
          const chosenPromise = new Promise((resolve) => {
            disposables.add(input.onDidAccept(() => resolve(input.activeItems[0])));
            disposables.add(input.onDidTriggerItemButton(async (context) => {
              resolve(void 0);
              const { launch, config } = context.item;
              await launch.openConfigFile({ preserveFocus: false, type: config.type, suppressInitialConfigs: true });
              await launch.writeConfiguration(config);
              await this.selectConfiguration(launch, config.name);
              this.removeRecentDynamicConfigurations(config.name, config.type);
            }));
            disposables.add(input.onDidHide(() => resolve(void 0)));
          }).finally(() => token.cancel());
          let items;
          try {
            items = await this.getDynamicConfigurationsByType(type, token.token);
          } catch (err) {
            this.logService.error(err);
            disposables.dispose();
            return;
          }
          input.items = items;
          input.busy = false;
          input.show();
          const chosen = await chosenPromise;
          disposables.dispose();
          return chosen;
        }
      };
    });
  }
  async getDynamicConfigurationsByType(type, token = CancellationToken.None) {
    await this.adapterManager.activateDebuggers(ON_DEBUG_DYNAMIC_CONFIGURATIONS_NAME, type);
    const picks = [];
    const provider = this.configProviders.find((p) => p.type === type && p.triggerKind === DebugConfigurationProviderTriggerKind.Dynamic && p.provideDebugConfigurations);
    this.getLaunches().forEach((launch) => {
      if (provider) {
        picks.push(provider.provideDebugConfigurations(launch.workspace?.uri, token).then((configurations) => configurations.map((config) => ({
          label: config.name,
          description: launch.name,
          config,
          buttons: [{
            iconClass: ThemeIcon.asClassName(debugConfigure),
            tooltip: nls.localize("editLaunchConfig", "Edit Debug Configuration in launch.json")
          }],
          launch
        }))));
      }
    });
    return (await Promise.all(picks)).flat();
  }
  getAllConfigurations() {
    const all = [];
    for (const l of this.launches) {
      for (const name of l.getConfigurationNames()) {
        const config = l.getConfiguration(name) || l.getCompound(name);
        if (config) {
          all.push({ launch: l, name, presentation: config.presentation });
        }
      }
    }
    return getVisibleAndSorted(all);
  }
  removeRecentDynamicConfigurations(name, type) {
    const remaining = this.getRecentDynamicConfigurations().filter((c) => c.name !== name || c.type !== type);
    this.storageService.store(DEBUG_RECENT_DYNAMIC_CONFIGURATIONS, JSON.stringify(remaining), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    if (this.selectedConfiguration.name === name && this.selectedType === type && this.selectedDynamic) {
      this.selectConfiguration(void 0, void 0);
    } else {
      this._onDidSelectConfigurationName.fire();
    }
  }
  getRecentDynamicConfigurations() {
    return JSON.parse(this.storageService.get(DEBUG_RECENT_DYNAMIC_CONFIGURATIONS, StorageScope.WORKSPACE, "[]"));
  }
  registerListeners() {
    this.toDispose.push(Event.any(this.contextService.onDidChangeWorkspaceFolders, this.contextService.onDidChangeWorkbenchState)(() => {
      this.initLaunches();
      this.selectConfiguration(void 0);
      this.setCompoundSchemaValues();
    }));
    this.toDispose.push(this.configurationService.onDidChangeConfiguration(async (e) => {
      if (e.affectsConfiguration("launch")) {
        await this.selectConfiguration(void 0);
        this.setCompoundSchemaValues();
      }
    }));
    this.toDispose.push(this.adapterManager.onDidDebuggersExtPointRead(() => {
      this.setCompoundSchemaValues();
    }));
  }
  initLaunches() {
    this.launches = this.contextService.getWorkspace().folders.map((folder) => this.instantiationService.createInstance(Launch, this, this.adapterManager, folder));
    if (this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
      this.launches.push(this.instantiationService.createInstance(WorkspaceLaunch, this, this.adapterManager));
    }
    this.launches.push(this.instantiationService.createInstance(UserLaunch, this, this.adapterManager));
    if (this.selectedLaunch && this.launches.indexOf(this.selectedLaunch) === -1) {
      this.selectConfiguration(void 0);
    }
  }
  setCompoundSchemaValues() {
    const compoundConfigurationsSchema = launchSchema.properties["compounds"].items.properties["configurations"];
    const launchNames = this.launches.map((l) => l.getConfigurationNames(true)).reduce((first, second) => first.concat(second), []);
    compoundConfigurationsSchema.items.oneOf[0].enum = launchNames;
    compoundConfigurationsSchema.items.oneOf[1].properties.name.enum = launchNames;
    const folderNames = this.contextService.getWorkspace().folders.map((f) => f.name);
    compoundConfigurationsSchema.items.oneOf[1].properties.folder.enum = folderNames;
    jsonRegistry.registerSchema(launchSchemaId, launchSchema);
  }
  getLaunches() {
    return this.launches;
  }
  getLaunch(workspaceUri) {
    if (!uri.isUri(workspaceUri)) {
      return void 0;
    }
    return this.launches.find((l) => l.workspace && this.uriIdentityService.extUri.isEqual(l.workspace.uri, workspaceUri));
  }
  get selectedConfiguration() {
    return {
      launch: this.selectedLaunch,
      name: this.selectedName,
      getConfig: this.getSelectedConfig,
      type: this.selectedType
    };
  }
  get onDidSelectConfiguration() {
    return this._onDidSelectConfigurationName.event;
  }
  getWorkspaceLaunch() {
    if (this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
      return this.launches[this.launches.length - 1];
    }
    return void 0;
  }
  async selectConfiguration(launch, name, config, dynamicConfig) {
    if (typeof launch === "undefined") {
      const rootUri = this.historyService.getLastActiveWorkspaceRoot();
      launch = this.getLaunch(rootUri);
      if (!launch || launch.getConfigurationNames().length === 0) {
        launch = this.launches.find((l) => !!(l && l.getConfigurationNames().length)) || launch || this.launches[0];
      }
    }
    const previousLaunch = this.selectedLaunch;
    const previousName = this.selectedName;
    const previousSelectedDynamic = this.selectedDynamic;
    this.selectedLaunch = launch;
    if (this.selectedLaunch) {
      this.storageService.store(DEBUG_SELECTED_ROOT, this.selectedLaunch.uri.toString(), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(DEBUG_SELECTED_ROOT, StorageScope.WORKSPACE);
    }
    const names = launch ? launch.getConfigurationNames() : [];
    this.getSelectedConfig = () => {
      const selected = this.selectedName ? launch?.getConfiguration(this.selectedName) : void 0;
      return Promise.resolve(selected || config);
    };
    let type = config?.type;
    if (name && names.indexOf(name) >= 0) {
      this.setSelectedLaunchName(name);
    } else if (dynamicConfig && dynamicConfig.type) {
      type = dynamicConfig.type;
      if (!config) {
        const providers = (await this.getDynamicProviders()).filter((p) => p.type === type);
        this.getSelectedConfig = async () => {
          const activatedProviders = await Promise.all(providers.map((p) => p.getProvider()));
          const provider = activatedProviders.length > 0 ? activatedProviders[0] : void 0;
          if (provider && launch && launch.workspace) {
            const token = new CancellationTokenSource();
            const dynamicConfigs = await provider.provideDebugConfigurations(launch.workspace.uri, token.token);
            const dynamicConfig2 = dynamicConfigs.find((c) => c.name === name);
            if (dynamicConfig2) {
              return dynamicConfig2;
            }
          }
          return void 0;
        };
      }
      this.setSelectedLaunchName(name);
      let recentDynamicProviders = this.getRecentDynamicConfigurations();
      if (name && dynamicConfig.type) {
        recentDynamicProviders.unshift({ name, type: dynamicConfig.type });
        recentDynamicProviders = distinct(recentDynamicProviders, (t) => `${t.name} : ${t.type}`);
        this.storageService.store(DEBUG_RECENT_DYNAMIC_CONFIGURATIONS, JSON.stringify(recentDynamicProviders), StorageScope.WORKSPACE, StorageTarget.MACHINE);
      }
    } else if (!this.selectedName || names.indexOf(this.selectedName) === -1) {
      const nameToSet = names.length ? names[0] : void 0;
      this.setSelectedLaunchName(nameToSet);
    }
    if (!config && launch && this.selectedName) {
      config = launch.getConfiguration(this.selectedName);
      type = config?.type;
    }
    this.selectedType = dynamicConfig?.type || config?.type;
    this.selectedDynamic = !!dynamicConfig;
    this.storageService.store(DEBUG_SELECTED_TYPE, dynamicConfig ? this.selectedType : void 0, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    if (type) {
      this.debugConfigurationTypeContext.set(type);
    } else {
      this.debugConfigurationTypeContext.reset();
    }
    if (this.selectedLaunch !== previousLaunch || this.selectedName !== previousName || previousSelectedDynamic !== this.selectedDynamic) {
      this._onDidSelectConfigurationName.fire();
    }
  }
  setSelectedLaunchName(selectedName) {
    this.selectedName = selectedName;
    if (this.selectedName) {
      this.storageService.store(DEBUG_SELECTED_CONFIG_NAME_KEY, this.selectedName, StorageScope.WORKSPACE, StorageTarget.MACHINE);
    } else {
      this.storageService.remove(DEBUG_SELECTED_CONFIG_NAME_KEY, StorageScope.WORKSPACE);
    }
  }
  dispose() {
    this.toDispose = dispose(this.toDispose);
  }
};
ConfigurationManager = __decorateClass([
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IQuickInputService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, IExtensionService),
  __decorateParam(7, IHistoryService),
  __decorateParam(8, IUriIdentityService),
  __decorateParam(9, IContextKeyService),
  __decorateParam(10, ILogService)
], ConfigurationManager);
class AbstractLaunch {
  constructor(configurationManager, adapterManager) {
    this.configurationManager = configurationManager;
    this.adapterManager = adapterManager;
  }
  getCompound(name) {
    const config = this.getDeduplicatedConfig();
    if (!config || !config.compounds) {
      return void 0;
    }
    return config.compounds.find((compound) => compound.name === name);
  }
  getConfigurationNames(ignoreCompoundsAndPresentation = false) {
    const config = this.getDeduplicatedConfig();
    if (!config || !Array.isArray(config.configurations) && !Array.isArray(config.compounds)) {
      return [];
    } else {
      const configurations = [];
      if (config.configurations) {
        configurations.push(...config.configurations.filter((cfg) => cfg && typeof cfg.name === "string"));
      }
      if (ignoreCompoundsAndPresentation) {
        return configurations.map((c) => c.name);
      }
      if (config.compounds) {
        configurations.push(...config.compounds.filter((compound) => typeof compound.name === "string" && compound.configurations && compound.configurations.length));
      }
      return getVisibleAndSorted(configurations).map((c) => c.name);
    }
  }
  getConfiguration(name) {
    const config = this.getDeduplicatedConfig();
    if (!config || !config.configurations) {
      return void 0;
    }
    const configuration = config.configurations.find((config2) => config2 && config2.name === name);
    if (!configuration) {
      return;
    }
    if (this instanceof UserLaunch) {
      return { ...configuration, __configurationTarget: ConfigurationTarget.USER };
    } else if (this instanceof WorkspaceLaunch) {
      return { ...configuration, __configurationTarget: ConfigurationTarget.WORKSPACE };
    } else {
      return { ...configuration, __configurationTarget: ConfigurationTarget.WORKSPACE_FOLDER };
    }
  }
  async getInitialConfigurationContent(folderUri, type, useInitialConfigs, token) {
    let content = "";
    const adapter = type ? { debugger: this.adapterManager.getEnabledDebugger(type) } : await this.adapterManager.guessDebugger(true);
    if (adapter?.withConfig && adapter.debugger) {
      content = await adapter.debugger.getInitialConfigurationContent([adapter.withConfig.config]);
    } else if (adapter?.debugger) {
      const initialConfigs = useInitialConfigs ? await this.configurationManager.provideDebugConfigurations(folderUri, adapter.debugger.type, token || CancellationToken.None) : [];
      content = await adapter.debugger.getInitialConfigurationContent(initialConfigs);
    }
    return content;
  }
  get hidden() {
    return false;
  }
  getDeduplicatedConfig() {
    const original = this.getConfig();
    return original && {
      version: original.version,
      compounds: original.compounds && distinguishConfigsByName(original.compounds),
      configurations: original.configurations && distinguishConfigsByName(original.configurations)
    };
  }
}
function distinguishConfigsByName(things) {
  const seen = /* @__PURE__ */ new Map();
  return things.map((thing) => {
    const no = seen.get(thing.name) || 0;
    seen.set(thing.name, no + 1);
    return no === 0 ? thing : { ...thing, name: `${thing.name} (${no})` };
  });
}
let Launch = class extends AbstractLaunch {
  constructor(configurationManager, adapterManager, workspace, fileService, textFileService, editorService, configurationService) {
    super(configurationManager, adapterManager);
    this.workspace = workspace;
    this.fileService = fileService;
    this.textFileService = textFileService;
    this.editorService = editorService;
    this.configurationService = configurationService;
  }
  get uri() {
    return resources.joinPath(this.workspace.uri, "/.vscode/launch.json");
  }
  get name() {
    return this.workspace.name;
  }
  getConfig() {
    return this.configurationService.inspect("launch", { resource: this.workspace.uri }).workspaceFolderValue;
  }
  async openConfigFile({ preserveFocus, type, suppressInitialConfigs }, token) {
    const resource = this.uri;
    let created = false;
    let content = "";
    try {
      const fileContent = await this.fileService.readFile(resource);
      content = fileContent.value.toString();
    } catch {
      content = await this.getInitialConfigurationContent(this.workspace.uri, type, !suppressInitialConfigs, token);
      if (!content) {
        return { editor: null, created: false };
      }
      created = true;
      try {
        await this.textFileService.write(resource, content);
      } catch (error) {
        throw new Error(nls.localize("DebugConfig.failed", "Unable to create 'launch.json' file inside the '.vscode' folder ({0}).", error.message));
      }
    }
    const index = content.indexOf(`"${this.configurationManager.selectedConfiguration.name}"`);
    let startLineNumber = 1;
    for (let i = 0; i < index; i++) {
      if (content.charAt(i) === "\n") {
        startLineNumber++;
      }
    }
    const selection = startLineNumber > 1 ? { startLineNumber, startColumn: 4 } : void 0;
    const editor = await this.editorService.openEditor({
      resource,
      options: {
        selection,
        preserveFocus,
        pinned: created,
        revealIfVisible: true
      }
    }, ACTIVE_GROUP);
    return {
      editor: editor ?? null,
      created
    };
  }
  async writeConfiguration(configuration) {
    const fullConfig = this.getConfig() || {};
    fullConfig.configurations = [...fullConfig.configurations || [], configuration];
    await this.configurationService.updateValue("launch", fullConfig, { resource: this.workspace.uri }, ConfigurationTarget.WORKSPACE_FOLDER);
  }
};
Launch = __decorateClass([
  __decorateParam(3, IFileService),
  __decorateParam(4, ITextFileService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IConfigurationService)
], Launch);
let WorkspaceLaunch = class extends AbstractLaunch {
  constructor(configurationManager, adapterManager, editorService, configurationService, contextService) {
    super(configurationManager, adapterManager);
    this.editorService = editorService;
    this.configurationService = configurationService;
    this.contextService = contextService;
  }
  get workspace() {
    return void 0;
  }
  get uri() {
    return this.contextService.getWorkspace().configuration;
  }
  get name() {
    return nls.localize("workspace", "workspace");
  }
  getConfig() {
    return this.configurationService.inspect("launch").workspaceValue;
  }
  async openConfigFile({ preserveFocus, type, useInitialConfigs }, token) {
    const launchExistInFile = !!this.getConfig();
    if (!launchExistInFile) {
      const content = await this.getInitialConfigurationContent(void 0, type, useInitialConfigs, token);
      if (content) {
        await this.configurationService.updateValue("launch", json.parse(content), ConfigurationTarget.WORKSPACE);
      } else {
        return { editor: null, created: false };
      }
    }
    const editor = await this.editorService.openEditor({
      resource: this.contextService.getWorkspace().configuration,
      options: { preserveFocus }
    }, ACTIVE_GROUP);
    return {
      editor: editor ?? null,
      created: false
    };
  }
};
WorkspaceLaunch = __decorateClass([
  __decorateParam(2, IEditorService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IWorkspaceContextService)
], WorkspaceLaunch);
let UserLaunch = class extends AbstractLaunch {
  constructor(configurationManager, adapterManager, configurationService, preferencesService) {
    super(configurationManager, adapterManager);
    this.configurationService = configurationService;
    this.preferencesService = preferencesService;
  }
  get workspace() {
    return void 0;
  }
  get uri() {
    return this.preferencesService.userSettingsResource;
  }
  get name() {
    return nls.localize("user settings", "user settings");
  }
  get hidden() {
    return true;
  }
  getConfig() {
    return this.configurationService.inspect("launch").userValue;
  }
  async openConfigFile({ preserveFocus, type, useInitialContent }) {
    const editor = await this.preferencesService.openUserSettings({ jsonEditor: true, preserveFocus, revealSetting: { key: "launch" } });
    return {
      editor: editor ?? null,
      created: false
    };
  }
};
UserLaunch = __decorateClass([
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IPreferencesService)
], UserLaunch);
export {
  ConfigurationManager
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9icm93c2VyL2RlYnVnQ29uZmlndXJhdGlvbk1hbmFnZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBkaXN0aW5jdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBzZXF1ZW5jZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCAqIGFzIGpzb24gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vanNvbi5qcyc7XG5pbXBvcnQgeyBJSlNPTlNjaGVtYSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgZGlzcG9zZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgKiBhcyByZXNvdXJjZXMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBVUkkgYXMgdXJpIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblRhcmdldCwgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJSlNPTkNvbnRyaWJ1dGlvblJlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIEpTT05FeHRlbnNpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vanNvbnNjaGVtYXMvY29tbW9uL2pzb25Db250cmlidXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBJV29ya3NwYWNlRm9sZGVyLCBJV29ya3NwYWNlRm9sZGVyc0NoYW5nZUV2ZW50LCBXb3JrYmVuY2hTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JQYW5lIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBsYXVuY2hTY2hlbWFJZCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQUNUSVZFX0dST1VQLCBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUhpc3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaGlzdG9yeS9jb21tb24vaGlzdG9yeS5qcyc7XG5pbXBvcnQgeyBJUHJlZmVyZW5jZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzLmpzJztcbmltcG9ydCB7IElUZXh0RmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy90ZXh0ZmlsZS9jb21tb24vdGV4dGZpbGVzLmpzJztcbmltcG9ydCB7IENPTlRFWFRfREVCVUdfQ09ORklHVVJBVElPTl9UWVBFLCBEZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlclRyaWdnZXJLaW5kLCBJQWRhcHRlck1hbmFnZXIsIElDb21wb3VuZCwgSUNvbmZpZywgSUNvbmZpZ1ByZXNlbnRhdGlvbiwgSUNvbmZpZ3VyYXRpb25NYW5hZ2VyLCBJRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXIsIElHbG9iYWxDb25maWcsIElHdWVzc2VkRGVidWdnZXIsIElMYXVuY2ggfSBmcm9tICcuLi9jb21tb24vZGVidWcuanMnO1xuaW1wb3J0IHsgbGF1bmNoU2NoZW1hIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnU2NoZW1hcy5qcyc7XG5pbXBvcnQgeyBnZXRWaXNpYmxlQW5kU29ydGVkIH0gZnJvbSAnLi4vY29tbW9uL2RlYnVnVXRpbHMuanMnO1xuaW1wb3J0IHsgZGVidWdDb25maWd1cmUgfSBmcm9tICcuL2RlYnVnSWNvbnMuanMnO1xuXG5jb25zdCBqc29uUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJSlNPTkNvbnRyaWJ1dGlvblJlZ2lzdHJ5PihKU09ORXh0ZW5zaW9ucy5KU09OQ29udHJpYnV0aW9uKTtcbmpzb25SZWdpc3RyeS5yZWdpc3RlclNjaGVtYShsYXVuY2hTY2hlbWFJZCwgbGF1bmNoU2NoZW1hKTtcblxuY29uc3QgREVCVUdfU0VMRUNURURfQ09ORklHX05BTUVfS0VZID0gJ2RlYnVnLnNlbGVjdGVkY29uZmlnbmFtZSc7XG5jb25zdCBERUJVR19TRUxFQ1RFRF9ST09UID0gJ2RlYnVnLnNlbGVjdGVkcm9vdCc7XG4vLyBEZWJ1ZyB0eXBlIGlzIG9ubHkgc3RvcmVkIGlmIGEgZHluYW1pYyBjb25maWd1cmF0aW9uIGlzIHVzZWQgZm9yIGJldHRlciByZXN0b3JlXG5jb25zdCBERUJVR19TRUxFQ1RFRF9UWVBFID0gJ2RlYnVnLnNlbGVjdGVkdHlwZSc7XG5jb25zdCBERUJVR19SRUNFTlRfRFlOQU1JQ19DT05GSUdVUkFUSU9OUyA9ICdkZWJ1Zy5yZWNlbnRkeW5hbWljY29uZmlndXJhdGlvbnMnO1xuY29uc3QgT05fREVCVUdfRFlOQU1JQ19DT05GSUdVUkFUSU9OU19OQU1FID0gJ29uRGVidWdEeW5hbWljQ29uZmlndXJhdGlvbnMnO1xuXG5pbnRlcmZhY2UgSUR5bmFtaWNQaWNrSXRlbSB7IGxhYmVsOiBzdHJpbmc7IGxhdW5jaDogSUxhdW5jaDsgY29uZmlnOiBJQ29uZmlnIH1cblxuZXhwb3J0IGNsYXNzIENvbmZpZ3VyYXRpb25NYW5hZ2VyIGltcGxlbWVudHMgSUNvbmZpZ3VyYXRpb25NYW5hZ2VyIHtcblx0cHJpdmF0ZSBsYXVuY2hlcyE6IElMYXVuY2hbXTtcblx0cHJpdmF0ZSBzZWxlY3RlZE5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBzZWxlY3RlZExhdW5jaDogSUxhdW5jaCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBnZXRTZWxlY3RlZENvbmZpZzogKCkgPT4gUHJvbWlzZTxJQ29uZmlnIHwgdW5kZWZpbmVkPiA9ICgpID0+IFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHRwcml2YXRlIHNlbGVjdGVkVHlwZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHNlbGVjdGVkRHluYW1pYyA9IGZhbHNlO1xuXHRwcml2YXRlIHRvRGlzcG9zZTogSURpc3Bvc2FibGVbXTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTZWxlY3RDb25maWd1cmF0aW9uTmFtZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHByaXZhdGUgY29uZmlnUHJvdmlkZXJzOiBJRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXJbXTtcblx0cHJpdmF0ZSBkZWJ1Z0NvbmZpZ3VyYXRpb25UeXBlQ29udGV4dDogSUNvbnRleHRLZXk8c3RyaW5nPjtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uUHJvdmlkZXJzID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvblByb3ZpZGVycyA9IHRoaXMuX29uRGlkQ2hhbmdlQ29uZmlndXJhdGlvblByb3ZpZGVycy5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGFkYXB0ZXJNYW5hZ2VyOiBJQWRhcHRlck1hbmFnZXIsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElIaXN0b3J5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhpc3RvcnlTZXJ2aWNlOiBJSGlzdG9yeVNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLmNvbmZpZ1Byb3ZpZGVycyA9IFtdO1xuXHRcdHRoaXMudG9EaXNwb3NlID0gW3RoaXMuX29uRGlkQ2hhbmdlQ29uZmlndXJhdGlvblByb3ZpZGVyc107XG5cdFx0dGhpcy5pbml0TGF1bmNoZXMoKTtcblx0XHR0aGlzLnNldENvbXBvdW5kU2NoZW1hVmFsdWVzKCk7XG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHRcdGNvbnN0IHByZXZpb3VzU2VsZWN0ZWRSb290ID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoREVCVUdfU0VMRUNURURfUk9PVCwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSk7XG5cdFx0Y29uc3QgcHJldmlvdXNTZWxlY3RlZFR5cGUgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChERUJVR19TRUxFQ1RFRF9UWVBFLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKTtcblx0XHRjb25zdCBwcmV2aW91c1NlbGVjdGVkTGF1bmNoID0gdGhpcy5sYXVuY2hlcy5maW5kKGwgPT4gbC51cmkudG9TdHJpbmcoKSA9PT0gcHJldmlvdXNTZWxlY3RlZFJvb3QpO1xuXHRcdGNvbnN0IHByZXZpb3VzU2VsZWN0ZWROYW1lID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoREVCVUdfU0VMRUNURURfQ09ORklHX05BTUVfS0VZLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFKTtcblx0XHR0aGlzLmRlYnVnQ29uZmlndXJhdGlvblR5cGVDb250ZXh0ID0gQ09OVEVYVF9ERUJVR19DT05GSUdVUkFUSU9OX1RZUEUuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRjb25zdCBkeW5hbWljQ29uZmlnID0gcHJldmlvdXNTZWxlY3RlZFR5cGUgPyB7IHR5cGU6IHByZXZpb3VzU2VsZWN0ZWRUeXBlIH0gOiB1bmRlZmluZWQ7XG5cdFx0aWYgKHByZXZpb3VzU2VsZWN0ZWRMYXVuY2ggJiYgcHJldmlvdXNTZWxlY3RlZExhdW5jaC5nZXRDb25maWd1cmF0aW9uTmFtZXMoKS5sZW5ndGgpIHtcblx0XHRcdHRoaXMuc2VsZWN0Q29uZmlndXJhdGlvbihwcmV2aW91c1NlbGVjdGVkTGF1bmNoLCBwcmV2aW91c1NlbGVjdGVkTmFtZSwgdW5kZWZpbmVkLCBkeW5hbWljQ29uZmlnKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMubGF1bmNoZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0dGhpcy5zZWxlY3RDb25maWd1cmF0aW9uKHVuZGVmaW5lZCwgcHJldmlvdXNTZWxlY3RlZE5hbWUsIHVuZGVmaW5lZCwgZHluYW1pY0NvbmZpZyk7XG5cdFx0fVxuXHR9XG5cblx0cmVnaXN0ZXJEZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlcihkZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlcjogSURlYnVnQ29uZmlndXJhdGlvblByb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRcdHRoaXMuY29uZmlnUHJvdmlkZXJzLnB1c2goZGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXIpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29uZmlndXJhdGlvblByb3ZpZGVycy5maXJlKCk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0dGhpcy51bnJlZ2lzdGVyRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXIoZGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXIpO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb25Qcm92aWRlcnMuZmlyZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHR1bnJlZ2lzdGVyRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXIoZGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXI6IElEZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlcik6IHZvaWQge1xuXHRcdGNvbnN0IGl4ID0gdGhpcy5jb25maWdQcm92aWRlcnMuaW5kZXhPZihkZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlcik7XG5cdFx0aWYgKGl4ID49IDApIHtcblx0XHRcdHRoaXMuY29uZmlnUHJvdmlkZXJzLnNwbGljZShpeCwgMSk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIGlmIHNjb3BlIGlzIG5vdCBzcGVjaWZpZWQsYSB2YWx1ZSBvZiBEZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlVHJpZ2dlci5Jbml0aWFsIGlzIGFzc3VtZWQuXG5cdCAqL1xuXHRoYXNEZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlcihkZWJ1Z1R5cGU6IHN0cmluZywgdHJpZ2dlcktpbmQ/OiBEZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlclRyaWdnZXJLaW5kKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRyaWdnZXJLaW5kID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHRyaWdnZXJLaW5kID0gRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXJUcmlnZ2VyS2luZC5Jbml0aWFsO1xuXHRcdH1cblx0XHQvLyBjaGVjayBpZiB0aGVyZSBhcmUgcHJvdmlkZXJzIGZvciB0aGUgZ2l2ZW4gdHlwZSB0aGF0IGNvbnRyaWJ1dGUgYSBwcm92aWRlRGVidWdDb25maWd1cmF0aW9ucyBtZXRob2Rcblx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuY29uZmlnUHJvdmlkZXJzLmZpbmQocCA9PiBwLnByb3ZpZGVEZWJ1Z0NvbmZpZ3VyYXRpb25zICYmIChwLnR5cGUgPT09IGRlYnVnVHlwZSkgJiYgKHAudHJpZ2dlcktpbmQgPT09IHRyaWdnZXJLaW5kKSk7XG5cdFx0cmV0dXJuICEhcHJvdmlkZXI7XG5cdH1cblxuXHRhc3luYyByZXNvbHZlQ29uZmlndXJhdGlvbkJ5UHJvdmlkZXJzKGZvbGRlclVyaTogdXJpIHwgdW5kZWZpbmVkLCB0eXBlOiBzdHJpbmcgfCB1bmRlZmluZWQsIGNvbmZpZzogSUNvbmZpZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJQ29uZmlnIHwgbnVsbCB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHJlc29sdmVEZWJ1Z0NvbmZpZ3VyYXRpb25Gb3JUeXBlID0gYXN5bmMgKHR5cGU6IHN0cmluZyB8IHVuZGVmaW5lZCwgY29uZmlnOiBJQ29uZmlnIHwgbnVsbCB8IHVuZGVmaW5lZCkgPT4ge1xuXHRcdFx0aWYgKHR5cGUgIT09ICcqJykge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmFkYXB0ZXJNYW5hZ2VyLmFjdGl2YXRlRGVidWdnZXJzKCdvbkRlYnVnUmVzb2x2ZScsIHR5cGUpO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGNvbnN0IHAgb2YgdGhpcy5jb25maWdQcm92aWRlcnMpIHtcblx0XHRcdFx0aWYgKHAudHlwZSA9PT0gdHlwZSAmJiBwLnJlc29sdmVEZWJ1Z0NvbmZpZ3VyYXRpb24gJiYgY29uZmlnKSB7XG5cdFx0XHRcdFx0Y29uZmlnID0gYXdhaXQgcC5yZXNvbHZlRGVidWdDb25maWd1cmF0aW9uKGZvbGRlclVyaSwgY29uZmlnLCB0b2tlbik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGNvbmZpZztcblx0XHR9O1xuXG5cdFx0bGV0IHJlc29sdmVkVHlwZSA9IGNvbmZpZy50eXBlID8/IHR5cGU7XG5cdFx0bGV0IHJlc3VsdDogSUNvbmZpZyB8IG51bGwgfCB1bmRlZmluZWQgPSBjb25maWc7XG5cdFx0Zm9yIChsZXQgc2VlbiA9IG5ldyBTZXQoKTsgcmVzdWx0ICYmICFzZWVuLmhhcyhyZXNvbHZlZFR5cGUpOykge1xuXHRcdFx0c2Vlbi5hZGQocmVzb2x2ZWRUeXBlKTtcblx0XHRcdHJlc3VsdCA9IGF3YWl0IHJlc29sdmVEZWJ1Z0NvbmZpZ3VyYXRpb25Gb3JUeXBlKHJlc29sdmVkVHlwZSwgcmVzdWx0KTtcblx0XHRcdHJlc3VsdCA9IGF3YWl0IHJlc29sdmVEZWJ1Z0NvbmZpZ3VyYXRpb25Gb3JUeXBlKCcqJywgcmVzdWx0KTtcblx0XHRcdHJlc29sdmVkVHlwZSA9IHJlc3VsdD8udHlwZSA/PyB0eXBlITtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0YXN5bmMgcmVzb2x2ZURlYnVnQ29uZmlndXJhdGlvbldpdGhTdWJzdGl0dXRlZFZhcmlhYmxlcyhmb2xkZXJVcmk6IHVyaSB8IHVuZGVmaW5lZCwgdHlwZTogc3RyaW5nIHwgdW5kZWZpbmVkLCBjb25maWc6IElDb25maWcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUNvbmZpZyB8IG51bGwgfCB1bmRlZmluZWQ+IHtcblx0XHQvLyBwaXBlIHRoZSBjb25maWcgdGhyb3VnaCB0aGUgcHJvbWlzZXMgc2VxdWVudGlhbGx5LiBBcHBlbmQgYXQgdGhlIGVuZCB0aGUgJyonIHR5cGVzXG5cdFx0Y29uc3QgcHJvdmlkZXJzID0gdGhpcy5jb25maWdQcm92aWRlcnMuZmlsdGVyKHAgPT4gcC50eXBlID09PSB0eXBlICYmIHAucmVzb2x2ZURlYnVnQ29uZmlndXJhdGlvbldpdGhTdWJzdGl0dXRlZFZhcmlhYmxlcylcblx0XHRcdC5jb25jYXQodGhpcy5jb25maWdQcm92aWRlcnMuZmlsdGVyKHAgPT4gcC50eXBlID09PSAnKicgJiYgcC5yZXNvbHZlRGVidWdDb25maWd1cmF0aW9uV2l0aFN1YnN0aXR1dGVkVmFyaWFibGVzKSk7XG5cblx0XHRsZXQgcmVzdWx0OiBJQ29uZmlnIHwgbnVsbCB8IHVuZGVmaW5lZCA9IGNvbmZpZztcblx0XHRhd2FpdCBzZXF1ZW5jZShwcm92aWRlcnMubWFwKHByb3ZpZGVyID0+IGFzeW5jICgpID0+IHtcblx0XHRcdC8vIElmIGFueSBwcm92aWRlciByZXR1cm5lZCB1bmRlZmluZWQgb3IgbnVsbCBtYWtlIHN1cmUgdG8gcmVzcGVjdCB0aGF0IGFuZCBkbyBub3QgcGFzcyB0aGUgcmVzdWx0IHRvIG1vcmUgcmVzb2x2ZXJcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0cmVzdWx0ID0gYXdhaXQgcHJvdmlkZXIucmVzb2x2ZURlYnVnQ29uZmlndXJhdGlvbldpdGhTdWJzdGl0dXRlZFZhcmlhYmxlcyEoZm9sZGVyVXJpLCByZXN1bHQsIHRva2VuKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0YXN5bmMgcHJvdmlkZURlYnVnQ29uZmlndXJhdGlvbnMoZm9sZGVyVXJpOiB1cmkgfCB1bmRlZmluZWQsIHR5cGU6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxhbnlbXT4ge1xuXHRcdGF3YWl0IHRoaXMuYWRhcHRlck1hbmFnZXIuYWN0aXZhdGVEZWJ1Z2dlcnMoJ29uRGVidWdJbml0aWFsQ29uZmlndXJhdGlvbnMnKTtcblx0XHRjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwodGhpcy5jb25maWdQcm92aWRlcnMuZmlsdGVyKHAgPT4gcC50eXBlID09PSB0eXBlICYmIHAudHJpZ2dlcktpbmQgPT09IERlYnVnQ29uZmlndXJhdGlvblByb3ZpZGVyVHJpZ2dlcktpbmQuSW5pdGlhbCAmJiBwLnByb3ZpZGVEZWJ1Z0NvbmZpZ3VyYXRpb25zKS5tYXAocCA9PiBwLnByb3ZpZGVEZWJ1Z0NvbmZpZ3VyYXRpb25zIShmb2xkZXJVcmksIHRva2VuKSkpO1xuXG5cdFx0cmV0dXJuIHJlc3VsdHMucmVkdWNlKChmaXJzdCwgc2Vjb25kKSA9PiBmaXJzdC5jb25jYXQoc2Vjb25kKSwgW10pO1xuXHR9XG5cblx0YXN5bmMgZ2V0RHluYW1pY1Byb3ZpZGVycygpOiBQcm9taXNlPHsgbGFiZWw6IHN0cmluZzsgdHlwZTogc3RyaW5nOyBnZXRQcm92aWRlcjogKCkgPT4gUHJvbWlzZTxJRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXIgfCB1bmRlZmluZWQ+OyBwaWNrOiAoKSA9PiBQcm9taXNlPHsgbGF1bmNoOiBJTGF1bmNoOyBjb25maWc6IElDb25maWc7IGxhYmVsOiBzdHJpbmcgfSB8IHVuZGVmaW5lZD4gfVtdPiB7XG5cdFx0YXdhaXQgdGhpcy5leHRlbnNpb25TZXJ2aWNlLndoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZCgpO1xuXHRcdGNvbnN0IGRlYnVnRHluYW1pY0V4dGVuc2lvbnNUeXBlcyA9IHRoaXMuZXh0ZW5zaW9uU2VydmljZS5leHRlbnNpb25zLnJlZHVjZSgoYWNjLCBlKSA9PiB7XG5cdFx0XHRpZiAoIWUuYWN0aXZhdGlvbkV2ZW50cykge1xuXHRcdFx0XHRyZXR1cm4gYWNjO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBleHBsaWNpdFR5cGVzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0bGV0IGhhc0dlbmVyaWNFdmVudCA9IGZhbHNlO1xuXHRcdFx0Zm9yIChjb25zdCBldmVudCBvZiBlLmFjdGl2YXRpb25FdmVudHMpIHtcblx0XHRcdFx0aWYgKGV2ZW50ID09PSBPTl9ERUJVR19EWU5BTUlDX0NPTkZJR1VSQVRJT05TX05BTUUpIHtcblx0XHRcdFx0XHRoYXNHZW5lcmljRXZlbnQgPSB0cnVlO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGV2ZW50LnN0YXJ0c1dpdGgoYCR7T05fREVCVUdfRFlOQU1JQ19DT05GSUdVUkFUSU9OU19OQU1FfTpgKSkge1xuXHRcdFx0XHRcdGV4cGxpY2l0VHlwZXMucHVzaChldmVudC5zbGljZShPTl9ERUJVR19EWU5BTUlDX0NPTkZJR1VSQVRJT05TX05BTUUubGVuZ3RoICsgMSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChleHBsaWNpdFR5cGVzLmxlbmd0aCkge1xuXHRcdFx0XHRleHBsaWNpdFR5cGVzLmZvckVhY2godCA9PiBhY2MuYWRkKHQpKTtcblx0XHRcdH0gZWxzZSBpZiAoaGFzR2VuZXJpY0V2ZW50KSB7XG5cdFx0XHRcdGNvbnN0IGRlYnVnZ2VyVHlwZSA9IGUuY29udHJpYnV0ZXM/LmRlYnVnZ2Vycz8uWzBdLnR5cGU7XG5cdFx0XHRcdGlmIChkZWJ1Z2dlclR5cGUpIHtcblx0XHRcdFx0XHRhY2MuYWRkKGRlYnVnZ2VyVHlwZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGFjYztcblx0XHR9LCBuZXcgU2V0PHN0cmluZz4oKSk7XG5cblx0XHRmb3IgKGNvbnN0IGNvbmZpZ1Byb3ZpZGVyIG9mIHRoaXMuY29uZmlnUHJvdmlkZXJzKSB7XG5cdFx0XHRpZiAoY29uZmlnUHJvdmlkZXIudHJpZ2dlcktpbmQgPT09IERlYnVnQ29uZmlndXJhdGlvblByb3ZpZGVyVHJpZ2dlcktpbmQuRHluYW1pYykge1xuXHRcdFx0XHRkZWJ1Z0R5bmFtaWNFeHRlbnNpb25zVHlwZXMuYWRkKGNvbmZpZ1Byb3ZpZGVyLnR5cGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBbLi4uZGVidWdEeW5hbWljRXh0ZW5zaW9uc1R5cGVzXS5tYXAodHlwZSA9PiB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRsYWJlbDogdGhpcy5hZGFwdGVyTWFuYWdlci5nZXREZWJ1Z2dlckxhYmVsKHR5cGUpISxcblx0XHRcdFx0Z2V0UHJvdmlkZXI6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmFkYXB0ZXJNYW5hZ2VyLmFjdGl2YXRlRGVidWdnZXJzKE9OX0RFQlVHX0RZTkFNSUNfQ09ORklHVVJBVElPTlNfTkFNRSwgdHlwZSk7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuY29uZmlnUHJvdmlkZXJzLmZpbmQocCA9PiBwLnR5cGUgPT09IHR5cGUgJiYgcC50cmlnZ2VyS2luZCA9PT0gRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXJUcmlnZ2VyS2luZC5EeW5hbWljICYmIHAucHJvdmlkZURlYnVnQ29uZmlndXJhdGlvbnMpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR0eXBlLFxuXHRcdFx0XHRwaWNrOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0Ly8gRG8gYSBsYXRlICdvbkRlYnVnRHluYW1pY0NvbmZpZ3VyYXRpb25zTmFtZScgYWN0aXZhdGlvbiBzbyBleHRlbnNpb25zIGFyZSBub3QgYWN0aXZhdGVkIHRvbyBlYXJseSAjMTA4NTc4XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5hZGFwdGVyTWFuYWdlci5hY3RpdmF0ZURlYnVnZ2VycyhPTl9ERUJVR19EWU5BTUlDX0NPTkZJR1VSQVRJT05TX05BTUUsIHR5cGUpO1xuXG5cdFx0XHRcdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHRcdFx0Y29uc3QgdG9rZW4gPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQodG9rZW4pO1xuXHRcdFx0XHRcdGNvbnN0IGlucHV0ID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMucXVpY2tJbnB1dFNlcnZpY2UuY3JlYXRlUXVpY2tQaWNrPElEeW5hbWljUGlja0l0ZW0+KCkpO1xuXHRcdFx0XHRcdGlucHV0LmJ1c3kgPSB0cnVlO1xuXHRcdFx0XHRcdGlucHV0LnBsYWNlaG9sZGVyID0gbmxzLmxvY2FsaXplKCdzZWxlY3RDb25maWd1cmF0aW9uJywgXCJTZWxlY3QgTGF1bmNoIENvbmZpZ3VyYXRpb25cIik7XG5cblx0XHRcdFx0XHRjb25zdCBjaG9zZW5Qcm9taXNlID0gbmV3IFByb21pc2U8SUR5bmFtaWNQaWNrSXRlbSB8IHVuZGVmaW5lZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQoaW5wdXQub25EaWRBY2NlcHQoKCkgPT4gcmVzb2x2ZShpbnB1dC5hY3RpdmVJdGVtc1swXSkpKTtcblx0XHRcdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChpbnB1dC5vbkRpZFRyaWdnZXJJdGVtQnV0dG9uKGFzeW5jIChjb250ZXh0KSA9PiB7XG5cdFx0XHRcdFx0XHRcdHJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdFx0XHRcdFx0Y29uc3QgeyBsYXVuY2gsIGNvbmZpZyB9ID0gY29udGV4dC5pdGVtO1xuXHRcdFx0XHRcdFx0XHRhd2FpdCBsYXVuY2gub3BlbkNvbmZpZ0ZpbGUoeyBwcmVzZXJ2ZUZvY3VzOiBmYWxzZSwgdHlwZTogY29uZmlnLnR5cGUsIHN1cHByZXNzSW5pdGlhbENvbmZpZ3M6IHRydWUgfSk7XG5cdFx0XHRcdFx0XHRcdC8vIE9ubHkgTGF1bmNoIGhhdmUgYSBwaW4gdHJpZ2dlciBidXR0b25cblx0XHRcdFx0XHRcdFx0YXdhaXQgKGxhdW5jaCBhcyBMYXVuY2gpLndyaXRlQ29uZmlndXJhdGlvbihjb25maWcpO1xuXHRcdFx0XHRcdFx0XHRhd2FpdCB0aGlzLnNlbGVjdENvbmZpZ3VyYXRpb24obGF1bmNoLCBjb25maWcubmFtZSk7XG5cdFx0XHRcdFx0XHRcdHRoaXMucmVtb3ZlUmVjZW50RHluYW1pY0NvbmZpZ3VyYXRpb25zKGNvbmZpZy5uYW1lLCBjb25maWcudHlwZSk7XG5cdFx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQoaW5wdXQub25EaWRIaWRlKCgpID0+IHJlc29sdmUodW5kZWZpbmVkKSkpO1xuXHRcdFx0XHRcdH0pLmZpbmFsbHkoKCkgPT4gdG9rZW4uY2FuY2VsKCkpO1xuXG5cdFx0XHRcdFx0bGV0IGl0ZW1zOiBJRHluYW1pY1BpY2tJdGVtW107XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdC8vIFRoaXMgYXdhaXQgaW52b2tlcyB0aGUgZXh0ZW5zaW9uIHByb3ZpZGVycywgd2hpY2ggbWlnaHQgZmFpbCBkdWUgdG8gc2V2ZXJhbCByZWFzb25zLFxuXHRcdFx0XHRcdFx0Ly8gdGhlcmVmb3JlIHdlIGdhdGUgdGhpcyBsb2dpYyB1bmRlciBhIHRyeS9jYXRjaCB0byBwcmV2ZW50IGxlYXZpbmcgdGhlIERlYnVnIFRhYlxuXHRcdFx0XHRcdFx0Ly8gc2VsZWN0b3IgaW4gYSBib3JrZWQgc3RhdGUuXG5cdFx0XHRcdFx0XHRpdGVtcyA9IGF3YWl0IHRoaXMuZ2V0RHluYW1pY0NvbmZpZ3VyYXRpb25zQnlUeXBlKHR5cGUsIHRva2VuLnRva2VuKTtcblx0XHRcdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlcnIpO1xuXHRcdFx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGlucHV0Lml0ZW1zID0gaXRlbXM7XG5cdFx0XHRcdFx0aW5wdXQuYnVzeSA9IGZhbHNlO1xuXHRcdFx0XHRcdGlucHV0LnNob3coKTtcblx0XHRcdFx0XHRjb25zdCBjaG9zZW4gPSBhd2FpdCBjaG9zZW5Qcm9taXNlO1xuXHRcdFx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblxuXHRcdFx0XHRcdHJldHVybiBjaG9zZW47XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBnZXREeW5hbWljQ29uZmlndXJhdGlvbnNCeVR5cGUodHlwZTogc3RyaW5nLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4gPSBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTogUHJvbWlzZTxJRHluYW1pY1BpY2tJdGVtW10+IHtcblx0XHQvLyBEbyBhIGxhdGUgJ29uRGVidWdEeW5hbWljQ29uZmlndXJhdGlvbnNOYW1lJyBhY3RpdmF0aW9uIHNvIGV4dGVuc2lvbnMgYXJlIG5vdCBhY3RpdmF0ZWQgdG9vIGVhcmx5ICMxMDg1Nzhcblx0XHRhd2FpdCB0aGlzLmFkYXB0ZXJNYW5hZ2VyLmFjdGl2YXRlRGVidWdnZXJzKE9OX0RFQlVHX0RZTkFNSUNfQ09ORklHVVJBVElPTlNfTkFNRSwgdHlwZSk7XG5cblx0XHRjb25zdCBwaWNrczogUHJvbWlzZTxJRHluYW1pY1BpY2tJdGVtW10+W10gPSBbXTtcblx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuY29uZmlnUHJvdmlkZXJzLmZpbmQocCA9PiBwLnR5cGUgPT09IHR5cGUgJiYgcC50cmlnZ2VyS2luZCA9PT0gRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXJUcmlnZ2VyS2luZC5EeW5hbWljICYmIHAucHJvdmlkZURlYnVnQ29uZmlndXJhdGlvbnMpO1xuXHRcdHRoaXMuZ2V0TGF1bmNoZXMoKS5mb3JFYWNoKGxhdW5jaCA9PiB7XG5cdFx0XHRpZiAocHJvdmlkZXIpIHtcblx0XHRcdFx0cGlja3MucHVzaChwcm92aWRlci5wcm92aWRlRGVidWdDb25maWd1cmF0aW9ucyEobGF1bmNoLndvcmtzcGFjZT8udXJpLCB0b2tlbikudGhlbihjb25maWd1cmF0aW9ucyA9PiBjb25maWd1cmF0aW9ucy5tYXAoY29uZmlnID0+ICh7XG5cdFx0XHRcdFx0bGFiZWw6IGNvbmZpZy5uYW1lLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsYXVuY2gubmFtZSxcblx0XHRcdFx0XHRjb25maWcsXG5cdFx0XHRcdFx0YnV0dG9uczogW3tcblx0XHRcdFx0XHRcdGljb25DbGFzczogVGhlbWVJY29uLmFzQ2xhc3NOYW1lKGRlYnVnQ29uZmlndXJlKSxcblx0XHRcdFx0XHRcdHRvb2x0aXA6IG5scy5sb2NhbGl6ZSgnZWRpdExhdW5jaENvbmZpZycsIFwiRWRpdCBEZWJ1ZyBDb25maWd1cmF0aW9uIGluIGxhdW5jaC5qc29uXCIpXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdFx0bGF1bmNoXG5cdFx0XHRcdH0pKSkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIChhd2FpdCBQcm9taXNlLmFsbChwaWNrcykpLmZsYXQoKTtcblx0fVxuXG5cdGdldEFsbENvbmZpZ3VyYXRpb25zKCk6IHsgbGF1bmNoOiBJTGF1bmNoOyBuYW1lOiBzdHJpbmc7IHByZXNlbnRhdGlvbj86IElDb25maWdQcmVzZW50YXRpb24gfVtdIHtcblx0XHRjb25zdCBhbGw6IHsgbGF1bmNoOiBJTGF1bmNoOyBuYW1lOiBzdHJpbmc7IHByZXNlbnRhdGlvbj86IElDb25maWdQcmVzZW50YXRpb24gfVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBsIG9mIHRoaXMubGF1bmNoZXMpIHtcblx0XHRcdGZvciAoY29uc3QgbmFtZSBvZiBsLmdldENvbmZpZ3VyYXRpb25OYW1lcygpKSB7XG5cdFx0XHRcdGNvbnN0IGNvbmZpZyA9IGwuZ2V0Q29uZmlndXJhdGlvbihuYW1lKSB8fCBsLmdldENvbXBvdW5kKG5hbWUpO1xuXHRcdFx0XHRpZiAoY29uZmlnKSB7XG5cdFx0XHRcdFx0YWxsLnB1c2goeyBsYXVuY2g6IGwsIG5hbWUsIHByZXNlbnRhdGlvbjogY29uZmlnLnByZXNlbnRhdGlvbiB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBnZXRWaXNpYmxlQW5kU29ydGVkKGFsbCk7XG5cdH1cblxuXHRyZW1vdmVSZWNlbnREeW5hbWljQ29uZmlndXJhdGlvbnMobmFtZTogc3RyaW5nLCB0eXBlOiBzdHJpbmcpIHtcblx0XHRjb25zdCByZW1haW5pbmcgPSB0aGlzLmdldFJlY2VudER5bmFtaWNDb25maWd1cmF0aW9ucygpLmZpbHRlcihjID0+IGMubmFtZSAhPT0gbmFtZSB8fCBjLnR5cGUgIT09IHR5cGUpO1xuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoREVCVUdfUkVDRU5UX0RZTkFNSUNfQ09ORklHVVJBVElPTlMsIEpTT04uc3RyaW5naWZ5KHJlbWFpbmluZyksIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0aWYgKHRoaXMuc2VsZWN0ZWRDb25maWd1cmF0aW9uLm5hbWUgPT09IG5hbWUgJiYgdGhpcy5zZWxlY3RlZFR5cGUgPT09IHR5cGUgJiYgdGhpcy5zZWxlY3RlZER5bmFtaWMpIHtcblx0XHRcdHRoaXMuc2VsZWN0Q29uZmlndXJhdGlvbih1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX29uRGlkU2VsZWN0Q29uZmlndXJhdGlvbk5hbWUuZmlyZSgpO1xuXHRcdH1cblx0fVxuXG5cdGdldFJlY2VudER5bmFtaWNDb25maWd1cmF0aW9ucygpOiB7IG5hbWU6IHN0cmluZzsgdHlwZTogc3RyaW5nIH1bXSB7XG5cdFx0cmV0dXJuIEpTT04ucGFyc2UodGhpcy5zdG9yYWdlU2VydmljZS5nZXQoREVCVUdfUkVDRU5UX0RZTkFNSUNfQ09ORklHVVJBVElPTlMsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsICdbXScpKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy50b0Rpc3Bvc2UucHVzaChFdmVudC5hbnk8SVdvcmtzcGFjZUZvbGRlcnNDaGFuZ2VFdmVudCB8IFdvcmtiZW5jaFN0YXRlPih0aGlzLmNvbnRleHRTZXJ2aWNlLm9uRGlkQ2hhbmdlV29ya3NwYWNlRm9sZGVycywgdGhpcy5jb250ZXh0U2VydmljZS5vbkRpZENoYW5nZVdvcmtiZW5jaFN0YXRlKSgoKSA9PiB7XG5cdFx0XHR0aGlzLmluaXRMYXVuY2hlcygpO1xuXHRcdFx0dGhpcy5zZWxlY3RDb25maWd1cmF0aW9uKHVuZGVmaW5lZCk7XG5cdFx0XHR0aGlzLnNldENvbXBvdW5kU2NoZW1hVmFsdWVzKCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2godGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oYXN5bmMgZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbignbGF1bmNoJykpIHtcblx0XHRcdFx0Ly8gQSBjaGFuZ2UgaGFwcGVuIGluIHRoZSBsYXVuY2guanNvbi4gSWYgdGhlcmUgaXMgYWxyZWFkeSBhIGxhdW5jaCBjb25maWd1cmF0aW9uIHNlbGVjdGVkLCBkbyBub3QgY2hhbmdlIHRoZSBzZWxlY3Rpb24uXG5cdFx0XHRcdGF3YWl0IHRoaXMuc2VsZWN0Q29uZmlndXJhdGlvbih1bmRlZmluZWQpO1xuXHRcdFx0XHR0aGlzLnNldENvbXBvdW5kU2NoZW1hVmFsdWVzKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMudG9EaXNwb3NlLnB1c2godGhpcy5hZGFwdGVyTWFuYWdlci5vbkRpZERlYnVnZ2Vyc0V4dFBvaW50UmVhZCgoKSA9PiB7XG5cdFx0XHR0aGlzLnNldENvbXBvdW5kU2NoZW1hVmFsdWVzKCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBpbml0TGF1bmNoZXMoKTogdm9pZCB7XG5cdFx0dGhpcy5sYXVuY2hlcyA9IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycy5tYXAoZm9sZGVyID0+IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTGF1bmNoLCB0aGlzLCB0aGlzLmFkYXB0ZXJNYW5hZ2VyLCBmb2xkZXIpKTtcblx0XHRpZiAodGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpID09PSBXb3JrYmVuY2hTdGF0ZS5XT1JLU1BBQ0UpIHtcblx0XHRcdHRoaXMubGF1bmNoZXMucHVzaCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdvcmtzcGFjZUxhdW5jaCwgdGhpcywgdGhpcy5hZGFwdGVyTWFuYWdlcikpO1xuXHRcdH1cblx0XHR0aGlzLmxhdW5jaGVzLnB1c2godGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShVc2VyTGF1bmNoLCB0aGlzLCB0aGlzLmFkYXB0ZXJNYW5hZ2VyKSk7XG5cblx0XHRpZiAodGhpcy5zZWxlY3RlZExhdW5jaCAmJiB0aGlzLmxhdW5jaGVzLmluZGV4T2YodGhpcy5zZWxlY3RlZExhdW5jaCkgPT09IC0xKSB7XG5cdFx0XHR0aGlzLnNlbGVjdENvbmZpZ3VyYXRpb24odW5kZWZpbmVkKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldENvbXBvdW5kU2NoZW1hVmFsdWVzKCk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbXBvdW5kQ29uZmlndXJhdGlvbnNTY2hlbWEgPSAoPElKU09OU2NoZW1hPmxhdW5jaFNjaGVtYS5wcm9wZXJ0aWVzIVsnY29tcG91bmRzJ10uaXRlbXMpLnByb3BlcnRpZXMhWydjb25maWd1cmF0aW9ucyddO1xuXHRcdGNvbnN0IGxhdW5jaE5hbWVzID0gdGhpcy5sYXVuY2hlcy5tYXAobCA9PlxuXHRcdFx0bC5nZXRDb25maWd1cmF0aW9uTmFtZXModHJ1ZSkpLnJlZHVjZSgoZmlyc3QsIHNlY29uZCkgPT4gZmlyc3QuY29uY2F0KHNlY29uZCksIFtdKTtcblx0XHQoPElKU09OU2NoZW1hPmNvbXBvdW5kQ29uZmlndXJhdGlvbnNTY2hlbWEuaXRlbXMpLm9uZU9mIVswXS5lbnVtID0gbGF1bmNoTmFtZXM7XG5cdFx0KDxJSlNPTlNjaGVtYT5jb21wb3VuZENvbmZpZ3VyYXRpb25zU2NoZW1hLml0ZW1zKS5vbmVPZiFbMV0ucHJvcGVydGllcyEubmFtZS5lbnVtID0gbGF1bmNoTmFtZXM7XG5cblx0XHRjb25zdCBmb2xkZXJOYW1lcyA9IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycy5tYXAoZiA9PiBmLm5hbWUpO1xuXHRcdCg8SUpTT05TY2hlbWE+Y29tcG91bmRDb25maWd1cmF0aW9uc1NjaGVtYS5pdGVtcykub25lT2YhWzFdLnByb3BlcnRpZXMhLmZvbGRlci5lbnVtID0gZm9sZGVyTmFtZXM7XG5cblx0XHRqc29uUmVnaXN0cnkucmVnaXN0ZXJTY2hlbWEobGF1bmNoU2NoZW1hSWQsIGxhdW5jaFNjaGVtYSk7XG5cdH1cblxuXHRnZXRMYXVuY2hlcygpOiBJTGF1bmNoW10ge1xuXHRcdHJldHVybiB0aGlzLmxhdW5jaGVzO1xuXHR9XG5cblx0Z2V0TGF1bmNoKHdvcmtzcGFjZVVyaTogdXJpIHwgdW5kZWZpbmVkKTogSUxhdW5jaCB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCF1cmkuaXNVcmkod29ya3NwYWNlVXJpKSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5sYXVuY2hlcy5maW5kKGwgPT4gbC53b3Jrc3BhY2UgJiYgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwobC53b3Jrc3BhY2UudXJpLCB3b3Jrc3BhY2VVcmkpKTtcblx0fVxuXG5cdGdldCBzZWxlY3RlZENvbmZpZ3VyYXRpb24oKTogeyBsYXVuY2g6IElMYXVuY2ggfCB1bmRlZmluZWQ7IG5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDsgZ2V0Q29uZmlnOiAoKSA9PiBQcm9taXNlPElDb25maWcgfCB1bmRlZmluZWQ+OyB0eXBlOiBzdHJpbmcgfCB1bmRlZmluZWQgfSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGxhdW5jaDogdGhpcy5zZWxlY3RlZExhdW5jaCxcblx0XHRcdG5hbWU6IHRoaXMuc2VsZWN0ZWROYW1lLFxuXHRcdFx0Z2V0Q29uZmlnOiB0aGlzLmdldFNlbGVjdGVkQ29uZmlnLFxuXHRcdFx0dHlwZTogdGhpcy5zZWxlY3RlZFR5cGVcblx0XHR9O1xuXHR9XG5cblx0Z2V0IG9uRGlkU2VsZWN0Q29uZmlndXJhdGlvbigpOiBFdmVudDx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX29uRGlkU2VsZWN0Q29uZmlndXJhdGlvbk5hbWUuZXZlbnQ7XG5cdH1cblxuXHRnZXRXb3Jrc3BhY2VMYXVuY2goKTogSUxhdW5jaCB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuV09SS1NQQUNFKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5sYXVuY2hlc1t0aGlzLmxhdW5jaGVzLmxlbmd0aCAtIDFdO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRhc3luYyBzZWxlY3RDb25maWd1cmF0aW9uKGxhdW5jaDogSUxhdW5jaCB8IHVuZGVmaW5lZCwgbmFtZT86IHN0cmluZywgY29uZmlnPzogSUNvbmZpZywgZHluYW1pY0NvbmZpZz86IHsgdHlwZT86IHN0cmluZyB9KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHR5cGVvZiBsYXVuY2ggPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRjb25zdCByb290VXJpID0gdGhpcy5oaXN0b3J5U2VydmljZS5nZXRMYXN0QWN0aXZlV29ya3NwYWNlUm9vdCgpO1xuXHRcdFx0bGF1bmNoID0gdGhpcy5nZXRMYXVuY2gocm9vdFVyaSk7XG5cdFx0XHRpZiAoIWxhdW5jaCB8fCBsYXVuY2guZ2V0Q29uZmlndXJhdGlvbk5hbWVzKCkubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdGxhdW5jaCA9IHRoaXMubGF1bmNoZXMuZmluZChsID0+ICEhKGwgJiYgbC5nZXRDb25maWd1cmF0aW9uTmFtZXMoKS5sZW5ndGgpKSB8fCBsYXVuY2ggfHwgdGhpcy5sYXVuY2hlc1swXTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBwcmV2aW91c0xhdW5jaCA9IHRoaXMuc2VsZWN0ZWRMYXVuY2g7XG5cdFx0Y29uc3QgcHJldmlvdXNOYW1lID0gdGhpcy5zZWxlY3RlZE5hbWU7XG5cdFx0Y29uc3QgcHJldmlvdXNTZWxlY3RlZER5bmFtaWMgPSB0aGlzLnNlbGVjdGVkRHluYW1pYztcblx0XHR0aGlzLnNlbGVjdGVkTGF1bmNoID0gbGF1bmNoO1xuXG5cdFx0aWYgKHRoaXMuc2VsZWN0ZWRMYXVuY2gpIHtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoREVCVUdfU0VMRUNURURfUk9PVCwgdGhpcy5zZWxlY3RlZExhdW5jaC51cmkudG9TdHJpbmcoKSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5yZW1vdmUoREVCVUdfU0VMRUNURURfUk9PVCwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmFtZXMgPSBsYXVuY2ggPyBsYXVuY2guZ2V0Q29uZmlndXJhdGlvbk5hbWVzKCkgOiBbXTtcblx0XHR0aGlzLmdldFNlbGVjdGVkQ29uZmlnID0gKCkgPT4ge1xuXHRcdFx0Y29uc3Qgc2VsZWN0ZWQgPSB0aGlzLnNlbGVjdGVkTmFtZSA/IGxhdW5jaD8uZ2V0Q29uZmlndXJhdGlvbih0aGlzLnNlbGVjdGVkTmFtZSkgOiB1bmRlZmluZWQ7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHNlbGVjdGVkIHx8IGNvbmZpZyk7XG5cdFx0fTtcblxuXHRcdGxldCB0eXBlID0gY29uZmlnPy50eXBlO1xuXHRcdGlmIChuYW1lICYmIG5hbWVzLmluZGV4T2YobmFtZSkgPj0gMCkge1xuXHRcdFx0dGhpcy5zZXRTZWxlY3RlZExhdW5jaE5hbWUobmFtZSk7XG5cdFx0fSBlbHNlIGlmIChkeW5hbWljQ29uZmlnICYmIGR5bmFtaWNDb25maWcudHlwZSkge1xuXHRcdFx0Ly8gV2UgY291bGQgbm90IGZpbmQgdGhlIHByZXZpb3VzbHkgdXNlZCBuYW1lIGFuZCBjb25maWcgaXMgbm90IHBhc3NlZC4gV2Ugc2hvdWxkIGdldCBhbGwgZHluYW1pYyBjb25maWd1cmF0aW9ucyBmcm9tIHByb3ZpZGVyc1xuXHRcdFx0Ly8gQW5kIHBvdGVudGlhbGx5IGF1dG8gc2VsZWN0IHRoZSBwcmV2aW91c2x5IHVzZWQgZHluYW1pYyBjb25maWd1cmF0aW9uICM5NjI5M1xuXHRcdFx0dHlwZSA9IGR5bmFtaWNDb25maWcudHlwZTtcblx0XHRcdGlmICghY29uZmlnKSB7XG5cdFx0XHRcdGNvbnN0IHByb3ZpZGVycyA9IChhd2FpdCB0aGlzLmdldER5bmFtaWNQcm92aWRlcnMoKSkuZmlsdGVyKHAgPT4gcC50eXBlID09PSB0eXBlKTtcblx0XHRcdFx0dGhpcy5nZXRTZWxlY3RlZENvbmZpZyA9IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBhY3RpdmF0ZWRQcm92aWRlcnMgPSBhd2FpdCBQcm9taXNlLmFsbChwcm92aWRlcnMubWFwKHAgPT4gcC5nZXRQcm92aWRlcigpKSk7XG5cdFx0XHRcdFx0Y29uc3QgcHJvdmlkZXIgPSBhY3RpdmF0ZWRQcm92aWRlcnMubGVuZ3RoID4gMCA/IGFjdGl2YXRlZFByb3ZpZGVyc1swXSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRpZiAocHJvdmlkZXIgJiYgbGF1bmNoICYmIGxhdW5jaC53b3Jrc3BhY2UpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHRva2VuID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0XHRcdFx0XHRjb25zdCBkeW5hbWljQ29uZmlncyA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVEZWJ1Z0NvbmZpZ3VyYXRpb25zIShsYXVuY2gud29ya3NwYWNlLnVyaSwgdG9rZW4udG9rZW4pO1xuXHRcdFx0XHRcdFx0Y29uc3QgZHluYW1pY0NvbmZpZyA9IGR5bmFtaWNDb25maWdzLmZpbmQoYyA9PiBjLm5hbWUgPT09IG5hbWUpO1xuXHRcdFx0XHRcdFx0aWYgKGR5bmFtaWNDb25maWcpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGR5bmFtaWNDb25maWc7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdHRoaXMuc2V0U2VsZWN0ZWRMYXVuY2hOYW1lKG5hbWUpO1xuXG5cdFx0XHRsZXQgcmVjZW50RHluYW1pY1Byb3ZpZGVycyA9IHRoaXMuZ2V0UmVjZW50RHluYW1pY0NvbmZpZ3VyYXRpb25zKCk7XG5cdFx0XHRpZiAobmFtZSAmJiBkeW5hbWljQ29uZmlnLnR5cGUpIHtcblx0XHRcdFx0Ly8gV2UgbmVlZCB0byBzdG9yZSB0aGUgcmVjZW50bHkgdXNlZCBkeW5hbWljIGNvbmZpZ3VyYXRpb25zIHRvIGJlIGFibGUgdG8gc2hvdyB0aGVtIGluIFVJICMxMTAwMDlcblx0XHRcdFx0cmVjZW50RHluYW1pY1Byb3ZpZGVycy51bnNoaWZ0KHsgbmFtZSwgdHlwZTogZHluYW1pY0NvbmZpZy50eXBlIH0pO1xuXHRcdFx0XHRyZWNlbnREeW5hbWljUHJvdmlkZXJzID0gZGlzdGluY3QocmVjZW50RHluYW1pY1Byb3ZpZGVycywgdCA9PiBgJHt0Lm5hbWV9IDogJHt0LnR5cGV9YCk7XG5cdFx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoREVCVUdfUkVDRU5UX0RZTkFNSUNfQ09ORklHVVJBVElPTlMsIEpTT04uc3RyaW5naWZ5KHJlY2VudER5bmFtaWNQcm92aWRlcnMpLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoIXRoaXMuc2VsZWN0ZWROYW1lIHx8IG5hbWVzLmluZGV4T2YodGhpcy5zZWxlY3RlZE5hbWUpID09PSAtMSkge1xuXHRcdFx0Ly8gV2UgY291bGQgbm90IGZpbmQgdGhlIGNvbmZpZ3VyYXRpb24gdG8gc2VsZWN0LCBwaWNrIHRoZSBmaXJzdCBvbmUsIG9yIHJlc2V0IHRoZSBzZWxlY3Rpb24gaWYgdGhlcmUgaXMgbm8gbGF1bmNoIGNvbmZpZ3VyYXRpb25cblx0XHRcdGNvbnN0IG5hbWVUb1NldCA9IG5hbWVzLmxlbmd0aCA/IG5hbWVzWzBdIDogdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5zZXRTZWxlY3RlZExhdW5jaE5hbWUobmFtZVRvU2V0KTtcblx0XHR9XG5cblx0XHRpZiAoIWNvbmZpZyAmJiBsYXVuY2ggJiYgdGhpcy5zZWxlY3RlZE5hbWUpIHtcblx0XHRcdGNvbmZpZyA9IGxhdW5jaC5nZXRDb25maWd1cmF0aW9uKHRoaXMuc2VsZWN0ZWROYW1lKTtcblx0XHRcdHR5cGUgPSBjb25maWc/LnR5cGU7XG5cdFx0fVxuXG5cdFx0dGhpcy5zZWxlY3RlZFR5cGUgPSBkeW5hbWljQ29uZmlnPy50eXBlIHx8IGNvbmZpZz8udHlwZTtcblx0XHR0aGlzLnNlbGVjdGVkRHluYW1pYyA9ICEhZHluYW1pY0NvbmZpZztcblx0XHQvLyBPbmx5IHN0b3JlIHRoZSBzZWxlY3RlZCB0eXBlIGlmIHdlIGFyZSBoYXZpbmcgYSBkeW5hbWljIGNvbmZpZ3VyYXRpb24uIE90aGVyd2lzZSByZXN0b3JpbmcgdGhpcyBjb25maWd1cmF0aW9uIGZyb20gc3RvcmFnZSBtaWdodCBiZSBtaXNpbmRlbnRpZmllZCBhcyBhIGR5bmFtaWMgY29uZmlndXJhdGlvblxuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoREVCVUdfU0VMRUNURURfVFlQRSwgZHluYW1pY0NvbmZpZyA/IHRoaXMuc2VsZWN0ZWRUeXBlIDogdW5kZWZpbmVkLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXG5cdFx0aWYgKHR5cGUpIHtcblx0XHRcdHRoaXMuZGVidWdDb25maWd1cmF0aW9uVHlwZUNvbnRleHQuc2V0KHR5cGUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmRlYnVnQ29uZmlndXJhdGlvblR5cGVDb250ZXh0LnJlc2V0KCk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc2VsZWN0ZWRMYXVuY2ggIT09IHByZXZpb3VzTGF1bmNoIHx8IHRoaXMuc2VsZWN0ZWROYW1lICE9PSBwcmV2aW91c05hbWUgfHwgcHJldmlvdXNTZWxlY3RlZER5bmFtaWMgIT09IHRoaXMuc2VsZWN0ZWREeW5hbWljKSB7XG5cdFx0XHR0aGlzLl9vbkRpZFNlbGVjdENvbmZpZ3VyYXRpb25OYW1lLmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNldFNlbGVjdGVkTGF1bmNoTmFtZShzZWxlY3RlZE5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuc2VsZWN0ZWROYW1lID0gc2VsZWN0ZWROYW1lO1xuXG5cdFx0aWYgKHRoaXMuc2VsZWN0ZWROYW1lKSB7XG5cdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKERFQlVHX1NFTEVDVEVEX0NPTkZJR19OQU1FX0tFWSwgdGhpcy5zZWxlY3RlZE5hbWUsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2UucmVtb3ZlKERFQlVHX1NFTEVDVEVEX0NPTkZJR19OQU1FX0tFWSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSk7XG5cdFx0fVxuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLnRvRGlzcG9zZSA9IGRpc3Bvc2UodGhpcy50b0Rpc3Bvc2UpO1xuXHR9XG59XG5cbmFic3RyYWN0IGNsYXNzIEFic3RyYWN0TGF1bmNoIGltcGxlbWVudHMgSUxhdW5jaCB7XG5cdGFic3RyYWN0IHJlYWRvbmx5IHVyaTogdXJpO1xuXHRhYnN0cmFjdCByZWFkb25seSBuYW1lOiBzdHJpbmc7XG5cdGFic3RyYWN0IHJlYWRvbmx5IHdvcmtzcGFjZTogSVdvcmtzcGFjZUZvbGRlciB8IHVuZGVmaW5lZDtcblx0cHJvdGVjdGVkIGFic3RyYWN0IGdldENvbmZpZygpOiBJR2xvYmFsQ29uZmlnIHwgdW5kZWZpbmVkO1xuXHRhYnN0cmFjdCBvcGVuQ29uZmlnRmlsZShvcHRpb25zOiB7IHByZXNlcnZlRm9jdXM6IGJvb2xlYW47IHR5cGU/OiBzdHJpbmcgfCB1bmRlZmluZWQ7IHN1cHByZXNzSW5pdGlhbENvbmZpZ3M/OiBib29sZWFuIHwgdW5kZWZpbmVkIH0sIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4gfCB1bmRlZmluZWQpOiBQcm9taXNlPHsgZWRpdG9yOiBJRWRpdG9yUGFuZSB8IG51bGw7IGNyZWF0ZWQ6IGJvb2xlYW4gfT47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJvdGVjdGVkIGNvbmZpZ3VyYXRpb25NYW5hZ2VyOiBDb25maWd1cmF0aW9uTWFuYWdlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGFkYXB0ZXJNYW5hZ2VyOiBJQWRhcHRlck1hbmFnZXJcblx0KSB7IH1cblxuXHRnZXRDb21wb3VuZChuYW1lOiBzdHJpbmcpOiBJQ29tcG91bmQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGNvbmZpZyA9IHRoaXMuZ2V0RGVkdXBsaWNhdGVkQ29uZmlnKCk7XG5cdFx0aWYgKCFjb25maWcgfHwgIWNvbmZpZy5jb21wb3VuZHMpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNvbmZpZy5jb21wb3VuZHMuZmluZChjb21wb3VuZCA9PiBjb21wb3VuZC5uYW1lID09PSBuYW1lKTtcblx0fVxuXG5cdGdldENvbmZpZ3VyYXRpb25OYW1lcyhpZ25vcmVDb21wb3VuZHNBbmRQcmVzZW50YXRpb24gPSBmYWxzZSk6IHN0cmluZ1tdIHtcblx0XHRjb25zdCBjb25maWcgPSB0aGlzLmdldERlZHVwbGljYXRlZENvbmZpZygpO1xuXHRcdGlmICghY29uZmlnIHx8ICghQXJyYXkuaXNBcnJheShjb25maWcuY29uZmlndXJhdGlvbnMpICYmICFBcnJheS5pc0FycmF5KGNvbmZpZy5jb21wb3VuZHMpKSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBjb25maWd1cmF0aW9uczogKElDb25maWcgfCBJQ29tcG91bmQpW10gPSBbXTtcblx0XHRcdGlmIChjb25maWcuY29uZmlndXJhdGlvbnMpIHtcblx0XHRcdFx0Y29uZmlndXJhdGlvbnMucHVzaCguLi5jb25maWcuY29uZmlndXJhdGlvbnMuZmlsdGVyKGNmZyA9PiBjZmcgJiYgdHlwZW9mIGNmZy5uYW1lID09PSAnc3RyaW5nJykpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoaWdub3JlQ29tcG91bmRzQW5kUHJlc2VudGF0aW9uKSB7XG5cdFx0XHRcdHJldHVybiBjb25maWd1cmF0aW9ucy5tYXAoYyA9PiBjLm5hbWUpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY29uZmlnLmNvbXBvdW5kcykge1xuXHRcdFx0XHRjb25maWd1cmF0aW9ucy5wdXNoKC4uLmNvbmZpZy5jb21wb3VuZHMuZmlsdGVyKGNvbXBvdW5kID0+IHR5cGVvZiBjb21wb3VuZC5uYW1lID09PSAnc3RyaW5nJyAmJiBjb21wb3VuZC5jb25maWd1cmF0aW9ucyAmJiBjb21wb3VuZC5jb25maWd1cmF0aW9ucy5sZW5ndGgpKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBnZXRWaXNpYmxlQW5kU29ydGVkKGNvbmZpZ3VyYXRpb25zKS5tYXAoYyA9PiBjLm5hbWUpO1xuXHRcdH1cblx0fVxuXG5cdGdldENvbmZpZ3VyYXRpb24obmFtZTogc3RyaW5nKTogSUNvbmZpZyB8IHVuZGVmaW5lZCB7XG5cdFx0Ly8gV2UgbmVlZCB0byBjbG9uZSB0aGUgY29uZmlndXJhdGlvbiBpbiBvcmRlciB0byBiZSBhYmxlIHRvIG1ha2UgY2hhbmdlcyB0byBpdCAjNDIxOThcblx0XHRjb25zdCBjb25maWcgPSB0aGlzLmdldERlZHVwbGljYXRlZENvbmZpZygpO1xuXHRcdGlmICghY29uZmlnIHx8ICFjb25maWcuY29uZmlndXJhdGlvbnMpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb24gPSBjb25maWcuY29uZmlndXJhdGlvbnMuZmluZChjb25maWcgPT4gY29uZmlnICYmIGNvbmZpZy5uYW1lID09PSBuYW1lKTtcblx0XHRpZiAoIWNvbmZpZ3VyYXRpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcyBpbnN0YW5jZW9mIFVzZXJMYXVuY2gpIHtcblx0XHRcdHJldHVybiB7IC4uLmNvbmZpZ3VyYXRpb24sIF9fY29uZmlndXJhdGlvblRhcmdldDogQ29uZmlndXJhdGlvblRhcmdldC5VU0VSIH07XG5cdFx0fSBlbHNlIGlmICh0aGlzIGluc3RhbmNlb2YgV29ya3NwYWNlTGF1bmNoKSB7XG5cdFx0XHRyZXR1cm4geyAuLi5jb25maWd1cmF0aW9uLCBfX2NvbmZpZ3VyYXRpb25UYXJnZXQ6IENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFIH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB7IC4uLmNvbmZpZ3VyYXRpb24sIF9fY29uZmlndXJhdGlvblRhcmdldDogQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0VfRk9MREVSIH07XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZ2V0SW5pdGlhbENvbmZpZ3VyYXRpb25Db250ZW50KGZvbGRlclVyaT86IHVyaSwgdHlwZT86IHN0cmluZywgdXNlSW5pdGlhbENvbmZpZ3M/OiBib29sZWFuLCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRsZXQgY29udGVudCA9ICcnO1xuXHRcdGNvbnN0IGFkYXB0ZXI6IFBhcnRpYWw8SUd1ZXNzZWREZWJ1Z2dlcj4gfCB1bmRlZmluZWQgPSB0eXBlXG5cdFx0XHQ/IHsgZGVidWdnZXI6IHRoaXMuYWRhcHRlck1hbmFnZXIuZ2V0RW5hYmxlZERlYnVnZ2VyKHR5cGUpIH1cblx0XHRcdDogYXdhaXQgdGhpcy5hZGFwdGVyTWFuYWdlci5ndWVzc0RlYnVnZ2VyKHRydWUpO1xuXG5cdFx0aWYgKGFkYXB0ZXI/LndpdGhDb25maWcgJiYgYWRhcHRlci5kZWJ1Z2dlcikge1xuXHRcdFx0Y29udGVudCA9IGF3YWl0IGFkYXB0ZXIuZGVidWdnZXIuZ2V0SW5pdGlhbENvbmZpZ3VyYXRpb25Db250ZW50KFthZGFwdGVyLndpdGhDb25maWcuY29uZmlnXSk7XG5cdFx0fSBlbHNlIGlmIChhZGFwdGVyPy5kZWJ1Z2dlcikge1xuXHRcdFx0Y29uc3QgaW5pdGlhbENvbmZpZ3MgPSB1c2VJbml0aWFsQ29uZmlncyA/XG5cdFx0XHRcdGF3YWl0IHRoaXMuY29uZmlndXJhdGlvbk1hbmFnZXIucHJvdmlkZURlYnVnQ29uZmlndXJhdGlvbnMoZm9sZGVyVXJpLCBhZGFwdGVyLmRlYnVnZ2VyLnR5cGUsIHRva2VuIHx8IENhbmNlbGxhdGlvblRva2VuLk5vbmUpIDpcblx0XHRcdFx0W107XG5cdFx0XHRjb250ZW50ID0gYXdhaXQgYWRhcHRlci5kZWJ1Z2dlci5nZXRJbml0aWFsQ29uZmlndXJhdGlvbkNvbnRlbnQoaW5pdGlhbENvbmZpZ3MpO1xuXHRcdH1cblxuXHRcdHJldHVybiBjb250ZW50O1xuXHR9XG5cblxuXHRnZXQgaGlkZGVuKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0RGVkdXBsaWNhdGVkQ29uZmlnKCk6IElHbG9iYWxDb25maWcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gdGhpcy5nZXRDb25maWcoKTtcblx0XHRyZXR1cm4gb3JpZ2luYWwgJiYge1xuXHRcdFx0dmVyc2lvbjogb3JpZ2luYWwudmVyc2lvbixcblx0XHRcdGNvbXBvdW5kczogb3JpZ2luYWwuY29tcG91bmRzICYmIGRpc3Rpbmd1aXNoQ29uZmlnc0J5TmFtZShvcmlnaW5hbC5jb21wb3VuZHMpLFxuXHRcdFx0Y29uZmlndXJhdGlvbnM6IG9yaWdpbmFsLmNvbmZpZ3VyYXRpb25zICYmIGRpc3Rpbmd1aXNoQ29uZmlnc0J5TmFtZShvcmlnaW5hbC5jb25maWd1cmF0aW9ucyksXG5cdFx0fTtcblx0fVxufVxuXG5mdW5jdGlvbiBkaXN0aW5ndWlzaENvbmZpZ3NCeU5hbWU8VCBleHRlbmRzIHsgbmFtZTogc3RyaW5nIH0+KHRoaW5nczogcmVhZG9ubHkgVFtdKTogVFtdIHtcblx0Y29uc3Qgc2VlbiA9IG5ldyBNYXA8c3RyaW5nLCBudW1iZXI+KCk7XG5cdHJldHVybiB0aGluZ3MubWFwKHRoaW5nID0+IHtcblx0XHRjb25zdCBubyA9IHNlZW4uZ2V0KHRoaW5nLm5hbWUpIHx8IDA7XG5cdFx0c2Vlbi5zZXQodGhpbmcubmFtZSwgbm8gKyAxKTtcblx0XHRyZXR1cm4gbm8gPT09IDAgPyB0aGluZyA6IHsgLi4udGhpbmcsIG5hbWU6IGAke3RoaW5nLm5hbWV9ICgke25vfSlgIH07XG5cdH0pO1xufVxuXG5jbGFzcyBMYXVuY2ggZXh0ZW5kcyBBYnN0cmFjdExhdW5jaCBpbXBsZW1lbnRzIElMYXVuY2gge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbmZpZ3VyYXRpb25NYW5hZ2VyOiBDb25maWd1cmF0aW9uTWFuYWdlcixcblx0XHRhZGFwdGVyTWFuYWdlcjogSUFkYXB0ZXJNYW5hZ2VyLFxuXHRcdHB1YmxpYyB3b3Jrc3BhY2U6IElXb3Jrc3BhY2VGb2xkZXIsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElUZXh0RmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0RmlsZVNlcnZpY2U6IElUZXh0RmlsZVNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoY29uZmlndXJhdGlvbk1hbmFnZXIsIGFkYXB0ZXJNYW5hZ2VyKTtcblx0fVxuXG5cdGdldCB1cmkoKTogdXJpIHtcblx0XHRyZXR1cm4gcmVzb3VyY2VzLmpvaW5QYXRoKHRoaXMud29ya3NwYWNlLnVyaSwgJy8udnNjb2RlL2xhdW5jaC5qc29uJyk7XG5cdH1cblxuXHRnZXQgbmFtZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLndvcmtzcGFjZS5uYW1lO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldENvbmZpZygpOiBJR2xvYmFsQ29uZmlnIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5pbnNwZWN0PElHbG9iYWxDb25maWc+KCdsYXVuY2gnLCB7IHJlc291cmNlOiB0aGlzLndvcmtzcGFjZS51cmkgfSkud29ya3NwYWNlRm9sZGVyVmFsdWU7XG5cdH1cblxuXHRhc3luYyBvcGVuQ29uZmlnRmlsZSh7IHByZXNlcnZlRm9jdXMsIHR5cGUsIHN1cHByZXNzSW5pdGlhbENvbmZpZ3MgfTogeyBwcmVzZXJ2ZUZvY3VzOiBib29sZWFuOyB0eXBlPzogc3RyaW5nOyBzdXBwcmVzc0luaXRpYWxDb25maWdzPzogYm9vbGVhbiB9LCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx7IGVkaXRvcjogSUVkaXRvclBhbmUgfCBudWxsOyBjcmVhdGVkOiBib29sZWFuIH0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRoaXMudXJpO1xuXHRcdGxldCBjcmVhdGVkID0gZmFsc2U7XG5cdFx0bGV0IGNvbnRlbnQgPSAnJztcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZmlsZUNvbnRlbnQgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKHJlc291cmNlKTtcblx0XHRcdGNvbnRlbnQgPSBmaWxlQ29udGVudC52YWx1ZS50b1N0cmluZygpO1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0Ly8gbGF1bmNoLmpzb24gbm90IGZvdW5kOiBjcmVhdGUgb25lIGJ5IGNvbGxlY3RpbmcgbGF1bmNoIGNvbmZpZ3MgZnJvbSBkZWJ1Z0NvbmZpZ1Byb3ZpZGVyc1xuXHRcdFx0Y29udGVudCA9IGF3YWl0IHRoaXMuZ2V0SW5pdGlhbENvbmZpZ3VyYXRpb25Db250ZW50KHRoaXMud29ya3NwYWNlLnVyaSwgdHlwZSwgIXN1cHByZXNzSW5pdGlhbENvbmZpZ3MsIHRva2VuKTtcblx0XHRcdGlmICghY29udGVudCkge1xuXHRcdFx0XHQvLyBDYW5jZWxsZWRcblx0XHRcdFx0cmV0dXJuIHsgZWRpdG9yOiBudWxsLCBjcmVhdGVkOiBmYWxzZSB9O1xuXHRcdFx0fVxuXG5cdFx0XHRjcmVhdGVkID0gdHJ1ZTsgLy8gcGluIG9ubHkgaWYgY29uZmlnIGZpbGUgaXMgY3JlYXRlZCAjODcyN1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgdGhpcy50ZXh0RmlsZVNlcnZpY2Uud3JpdGUocmVzb3VyY2UsIGNvbnRlbnQpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKG5scy5sb2NhbGl6ZSgnRGVidWdDb25maWcuZmFpbGVkJywgXCJVbmFibGUgdG8gY3JlYXRlICdsYXVuY2guanNvbicgZmlsZSBpbnNpZGUgdGhlICcudnNjb2RlJyBmb2xkZXIgKHswfSkuXCIsIGVycm9yLm1lc3NhZ2UpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBpbmRleCA9IGNvbnRlbnQuaW5kZXhPZihgXCIke3RoaXMuY29uZmlndXJhdGlvbk1hbmFnZXIuc2VsZWN0ZWRDb25maWd1cmF0aW9uLm5hbWV9XCJgKTtcblx0XHRsZXQgc3RhcnRMaW5lTnVtYmVyID0gMTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGluZGV4OyBpKyspIHtcblx0XHRcdGlmIChjb250ZW50LmNoYXJBdChpKSA9PT0gJ1xcbicpIHtcblx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyKys7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IHNlbGVjdGlvbiA9IHN0YXJ0TGluZU51bWJlciA+IDEgPyB7IHN0YXJ0TGluZU51bWJlciwgc3RhcnRDb2x1bW46IDQgfSA6IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IGVkaXRvciA9IGF3YWl0IHRoaXMuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRcdHJlc291cmNlLFxuXHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRzZWxlY3Rpb24sXG5cdFx0XHRcdHByZXNlcnZlRm9jdXMsXG5cdFx0XHRcdHBpbm5lZDogY3JlYXRlZCxcblx0XHRcdFx0cmV2ZWFsSWZWaXNpYmxlOiB0cnVlXG5cdFx0XHR9LFxuXHRcdH0sIEFDVElWRV9HUk9VUCk7XG5cblx0XHRyZXR1cm4gKHtcblx0XHRcdGVkaXRvcjogZWRpdG9yID8/IG51bGwsXG5cdFx0XHRjcmVhdGVkXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyB3cml0ZUNvbmZpZ3VyYXRpb24oY29uZmlndXJhdGlvbjogSUNvbmZpZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIG5vdGU6IHdlIGRvbid0IGdldCB0aGUgZGVkdXBsaWNhdGVkIGNvbmZpZyBzaW5jZSB3ZSBkb24ndCB3YW50IHRoYXQgdG8gJ2xlYWsnIGludG8gdGhlIGZpbGVcblx0XHRjb25zdCBmdWxsQ29uZmlnOiBQYXJ0aWFsPElHbG9iYWxDb25maWc+ID0gdGhpcy5nZXRDb25maWcoKSB8fCB7fTtcblx0XHRmdWxsQ29uZmlnLmNvbmZpZ3VyYXRpb25zID0gWy4uLmZ1bGxDb25maWcuY29uZmlndXJhdGlvbnMgfHwgW10sIGNvbmZpZ3VyYXRpb25dO1xuXHRcdGF3YWl0IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoJ2xhdW5jaCcsIGZ1bGxDb25maWcsIHsgcmVzb3VyY2U6IHRoaXMud29ya3NwYWNlLnVyaSB9LCBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRV9GT0xERVIpO1xuXHR9XG59XG5cbmNsYXNzIFdvcmtzcGFjZUxhdW5jaCBleHRlbmRzIEFic3RyYWN0TGF1bmNoIGltcGxlbWVudHMgSUxhdW5jaCB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdGNvbmZpZ3VyYXRpb25NYW5hZ2VyOiBDb25maWd1cmF0aW9uTWFuYWdlcixcblx0XHRhZGFwdGVyTWFuYWdlcjogSUFkYXB0ZXJNYW5hZ2VyLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKGNvbmZpZ3VyYXRpb25NYW5hZ2VyLCBhZGFwdGVyTWFuYWdlcik7XG5cdH1cblxuXHRnZXQgd29ya3NwYWNlKCk6IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGdldCB1cmkoKTogdXJpIHtcblx0XHRyZXR1cm4gdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5jb25maWd1cmF0aW9uITtcblx0fVxuXG5cdGdldCBuYW1lKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgnd29ya3NwYWNlJywgXCJ3b3Jrc3BhY2VcIik7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0Q29uZmlnKCk6IElHbG9iYWxDb25maWcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmluc3BlY3Q8SUdsb2JhbENvbmZpZz4oJ2xhdW5jaCcpLndvcmtzcGFjZVZhbHVlO1xuXHR9XG5cblx0YXN5bmMgb3BlbkNvbmZpZ0ZpbGUoeyBwcmVzZXJ2ZUZvY3VzLCB0eXBlLCB1c2VJbml0aWFsQ29uZmlncyB9OiB7IHByZXNlcnZlRm9jdXM6IGJvb2xlYW47IHR5cGU/OiBzdHJpbmc7IHVzZUluaXRpYWxDb25maWdzPzogYm9vbGVhbiB9LCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx7IGVkaXRvcjogSUVkaXRvclBhbmUgfCBudWxsOyBjcmVhdGVkOiBib29sZWFuIH0+IHtcblx0XHRjb25zdCBsYXVuY2hFeGlzdEluRmlsZSA9ICEhdGhpcy5nZXRDb25maWcoKTtcblx0XHRpZiAoIWxhdW5jaEV4aXN0SW5GaWxlKSB7XG5cdFx0XHQvLyBMYXVuY2ggcHJvcGVydHkgaW4gd29ya3NwYWNlIGNvbmZpZyBub3QgZm91bmQ6IGNyZWF0ZSBvbmUgYnkgY29sbGVjdGluZyBsYXVuY2ggY29uZmlncyBmcm9tIGRlYnVnQ29uZmlnUHJvdmlkZXJzXG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5nZXRJbml0aWFsQ29uZmlndXJhdGlvbkNvbnRlbnQodW5kZWZpbmVkLCB0eXBlLCB1c2VJbml0aWFsQ29uZmlncywgdG9rZW4pO1xuXHRcdFx0aWYgKGNvbnRlbnQpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZSgnbGF1bmNoJywganNvbi5wYXJzZShjb250ZW50KSwgQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0UpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHsgZWRpdG9yOiBudWxsLCBjcmVhdGVkOiBmYWxzZSB9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGVkaXRvciA9IGF3YWl0IHRoaXMuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRcdHJlc291cmNlOiB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmNvbmZpZ3VyYXRpb24hLFxuXHRcdFx0b3B0aW9uczogeyBwcmVzZXJ2ZUZvY3VzIH1cblx0XHR9LCBBQ1RJVkVfR1JPVVApO1xuXG5cdFx0cmV0dXJuICh7XG5cdFx0XHRlZGl0b3I6IGVkaXRvciA/PyBudWxsLFxuXHRcdFx0Y3JlYXRlZDogZmFsc2Vcblx0XHR9KTtcblx0fVxufVxuXG5jbGFzcyBVc2VyTGF1bmNoIGV4dGVuZHMgQWJzdHJhY3RMYXVuY2ggaW1wbGVtZW50cyBJTGF1bmNoIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRjb25maWd1cmF0aW9uTWFuYWdlcjogQ29uZmlndXJhdGlvbk1hbmFnZXIsXG5cdFx0YWRhcHRlck1hbmFnZXI6IElBZGFwdGVyTWFuYWdlcixcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVByZWZlcmVuY2VzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByZWZlcmVuY2VzU2VydmljZTogSVByZWZlcmVuY2VzU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihjb25maWd1cmF0aW9uTWFuYWdlciwgYWRhcHRlck1hbmFnZXIpO1xuXHR9XG5cblx0Z2V0IHdvcmtzcGFjZSgpOiB1bmRlZmluZWQge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXQgdXJpKCk6IHVyaSB7XG5cdFx0cmV0dXJuIHRoaXMucHJlZmVyZW5jZXNTZXJ2aWNlLnVzZXJTZXR0aW5nc1Jlc291cmNlO1xuXHR9XG5cblx0Z2V0IG5hbWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCd1c2VyIHNldHRpbmdzJywgXCJ1c2VyIHNldHRpbmdzXCIpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0IGhpZGRlbigpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRDb25maWcoKTogSUdsb2JhbENvbmZpZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuaW5zcGVjdDxJR2xvYmFsQ29uZmlnPignbGF1bmNoJykudXNlclZhbHVlO1xuXHR9XG5cblx0YXN5bmMgb3BlbkNvbmZpZ0ZpbGUoeyBwcmVzZXJ2ZUZvY3VzLCB0eXBlLCB1c2VJbml0aWFsQ29udGVudCB9OiB7IHByZXNlcnZlRm9jdXM6IGJvb2xlYW47IHR5cGU/OiBzdHJpbmc7IHVzZUluaXRpYWxDb250ZW50PzogYm9vbGVhbiB9KTogUHJvbWlzZTx7IGVkaXRvcjogSUVkaXRvclBhbmUgfCBudWxsOyBjcmVhdGVkOiBib29sZWFuIH0+IHtcblx0XHRjb25zdCBlZGl0b3IgPSBhd2FpdCB0aGlzLnByZWZlcmVuY2VzU2VydmljZS5vcGVuVXNlclNldHRpbmdzKHsganNvbkVkaXRvcjogdHJ1ZSwgcHJlc2VydmVGb2N1cywgcmV2ZWFsU2V0dGluZzogeyBrZXk6ICdsYXVuY2gnIH0gfSk7XG5cdFx0cmV0dXJuICh7XG5cdFx0XHRlZGl0b3I6IGVkaXRvciA/PyBudWxsLFxuXHRcdFx0Y3JlYXRlZDogZmFsc2Vcblx0XHR9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLG1CQUFtQiwrQkFBK0I7QUFDM0QsU0FBUyxTQUFTLGFBQWE7QUFDL0IsWUFBWSxVQUFVO0FBRXRCLFNBQVMsaUJBQThCLGVBQWU7QUFDdEQsWUFBWSxlQUFlO0FBQzNCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsT0FBTyxXQUFXO0FBQzNCLFlBQVksU0FBUztBQUNyQixTQUFTLHFCQUFxQiw2QkFBNkI7QUFDM0QsU0FBc0IsMEJBQTBCO0FBQ2hELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQW9DLGNBQWMsc0JBQXNCO0FBQ3hFLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsMEJBQTBFLHNCQUFzQjtBQUV6RyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGNBQWMsc0JBQXNCO0FBQzdDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsa0NBQWtDLDZDQUFxTTtBQUNoUCxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHNCQUFzQjtBQUUvQixNQUFNLGVBQWUsU0FBUyxHQUE4QixlQUFlLGdCQUFnQjtBQUMzRixhQUFhLGVBQWUsZ0JBQWdCLFlBQVk7QUFFeEQsTUFBTSxpQ0FBaUM7QUFDdkMsTUFBTSxzQkFBc0I7QUFFNUIsTUFBTSxzQkFBc0I7QUFDNUIsTUFBTSxzQ0FBc0M7QUFDNUMsTUFBTSx1Q0FBdUM7QUFJdEMsSUFBTSx1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Q0FBQyxtQkFBbUI7QUFFdkIsWUFBTSxVQUFVLE1BQU0sS0FBSywrQkFBK0IsUUFBVyxNQUFNLG1CQUFtQixLQUFLO0FBQ25HLFVBQUksU0FBUztBQUNaLGNBQU0sS0FBSyxxQkFBcUIsWUFBWSxVQUFVLEtBQUssTUFBTSxPQUFPLEdBQUcsb0JBQW9CLFNBQVM7QUFBQSxNQUN6RyxPQUFPO0FBQ04sZUFBTyxFQUFFLFFBQVEsTUFBTSxTQUFTLE1BQU07QUFBQSxNQUN2QztBQUFBLElBQ0Q7QUFFQSxVQUFNLFNBQVMsTUFBTSxLQUFLLGNBQWMsV0FBVztBQUFBLE1BQ2xELFVBQVUsS0FBSyxlQUFlLGFBQWEsRUFBRTtBQUFBLE1BQzdDLFNBQVMsRUFBRSxjQUFjO0FBQUEsSUFDMUIsR0FBRyxZQUFZO0FBRWYsV0FBUTtBQUFBLE1BQ1AsUUFBUSxVQUFVO0FBQUEsTUFDbEIsU0FBUztBQUFBLElBQ1Y7QUFBQSxFQUNEO0FBQ0Q7QUFqRE0sa0JBQU47QUFBQSxFQUlHO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQU5HO0FBbUROLElBQU0sYUFBTixjQUF5QixlQUFrQztBQUFBLEVBRTFELFlBQ0Msc0JBQ0EsZ0JBQ3dDLHNCQUNGLG9CQUNyQztBQUNELFVBQU0sc0JBQXNCLGNBQWM7QUFIRjtBQUNGO0FBQUEsRUFHdkM7QUFBQSxFQUVBLElBQUksWUFBdUI7QUFDMUIsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLElBQUksTUFBVztBQUNkLFdBQU8sS0FBSyxtQkFBbUI7QUFBQSxFQUNoQztBQUFBLEVBRUEsSUFBSSxPQUFlO0FBQ2xCLFdBQU8sSUFBSSxTQUFTLGlCQUFpQixlQUFlO0FBQUEsRUFDckQ7QUFBQSxFQUVBLElBQWEsU0FBa0I7QUFDOUIsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVVLFlBQXVDO0FBQ2hELFdBQU8sS0FBSyxxQkFBcUIsUUFBdUIsUUFBUSxFQUFFO0FBQUEsRUFDbkU7QUFBQSxFQUVBLE1BQU0sZUFBZSxFQUFFLGVBQWUsTUFBTSxrQkFBa0IsR0FBc0k7QUFDbk0sVUFBTSxTQUFTLE1BQU0sS0FBSyxtQkFBbUIsaUJBQWlCLEVBQUUsWUFBWSxNQUFNLGVBQWUsZUFBZSxFQUFFLEtBQUssU0FBUyxFQUFFLENBQUM7QUFDbkksV0FBUTtBQUFBLE1BQ1AsUUFBUSxVQUFVO0FBQUEsTUFDbEIsU0FBUztBQUFBLElBQ1Y7QUFBQSxFQUNEO0FBQ0Q7QUF0Q00sYUFBTjtBQUFBLEVBS0c7QUFBQSxFQUNBO0FBQUEsR0FORzsiLAogICJuYW1lcyI6IFsidHlwZSIsICJjb25maWciLCAiZHluYW1pY0NvbmZpZyJdCn0K
