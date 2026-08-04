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
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { deepClone } from "../../../../base/common/objects.js";
import { IEncryptionService } from "../../../../platform/encryption/common/encryptionService.js";
import { registerSingleton, InstantiationType } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IMetricsService } from "./metricsService.js";
import { defaultProviderSettings, getModelCapabilities } from "./modelCapabilities.js";
import { VOID_SETTINGS_STORAGE_KEY } from "./storageKeys.js";
import { defaultSettingsOfProvider, providerNames, modelSelectionsEqual, featureNames, defaultGlobalSettings, defaultOverridesOfModel } from "./voidSettingsTypes.js";
const _modelsWithSwappedInNewModels = (options) => {
  const { existingModels, models, type } = options;
  const existingModelsMap = {};
  for (const existingModel of existingModels) {
    existingModelsMap[existingModel.modelName] = existingModel;
  }
  const newDefaultModels = models.map((modelName, i) => ({ modelName, type, isHidden: !!existingModelsMap[modelName]?.isHidden }));
  return [
    ...newDefaultModels,
    // swap out all the models of this type for the new models of this type
    ...existingModels.filter((m) => {
      const keep = m.type !== type;
      return keep;
    })
  ];
};
const modelFilterOfFeatureName = {
  "Autocomplete": { filter: (o, opts) => getModelCapabilities(o.providerName, o.modelName, opts.overridesOfModel).supportsFIM, emptyMessage: { message: "No models support FIM", priority: "always" } },
  "Chat": { filter: (o) => true, emptyMessage: null },
  "Ctrl+K": { filter: (o) => true, emptyMessage: null },
  "Apply": { filter: (o) => true, emptyMessage: null },
  "SCM": { filter: (o) => true, emptyMessage: null }
};
const _stateWithMergedDefaultModels = (state) => {
  let newSettingsOfProvider = state.settingsOfProvider;
  for (const providerName of providerNames) {
    const defaultModels = defaultSettingsOfProvider[providerName]?.models ?? [];
    const currentModels = newSettingsOfProvider[providerName]?.models ?? [];
    const defaultModelNames = defaultModels.map((m) => m.modelName);
    const newModels = _modelsWithSwappedInNewModels({ existingModels: currentModels, models: defaultModelNames, type: "default" });
    newSettingsOfProvider = {
      ...newSettingsOfProvider,
      [providerName]: {
        ...newSettingsOfProvider[providerName],
        models: newModels
      }
    };
  }
  return {
    ...state,
    settingsOfProvider: newSettingsOfProvider
  };
};
const _validatedModelState = (state) => {
  let newSettingsOfProvider = state.settingsOfProvider;
  for (const providerName of providerNames) {
    const settingsAtProvider = newSettingsOfProvider[providerName];
    const didFillInProviderSettings = Object.keys(defaultProviderSettings[providerName]).every((key) => !!settingsAtProvider[key]);
    if (didFillInProviderSettings === settingsAtProvider._didFillInProviderSettings) continue;
    newSettingsOfProvider = {
      ...newSettingsOfProvider,
      [providerName]: {
        ...settingsAtProvider,
        _didFillInProviderSettings: didFillInProviderSettings
      }
    };
  }
  let newModelOptions = [];
  for (const providerName of providerNames) {
    const providerTitle = providerName;
    if (!newSettingsOfProvider[providerName]._didFillInProviderSettings) continue;
    for (const { modelName, isHidden } of newSettingsOfProvider[providerName].models) {
      if (isHidden) continue;
      newModelOptions.push({ name: `${modelName} (${providerTitle})`, selection: { providerName, modelName } });
    }
  }
  let newModelSelectionOfFeature = state.modelSelectionOfFeature;
  for (const featureName of featureNames) {
    const { filter } = modelFilterOfFeatureName[featureName];
    const filterOpts = { chatMode: state.globalSettings.chatMode, overridesOfModel: state.overridesOfModel };
    const modelOptionsForThisFeature = newModelOptions.filter((o) => filter(o.selection, filterOpts));
    const modelSelectionAtFeature = newModelSelectionOfFeature[featureName];
    const selnIdx = modelSelectionAtFeature === null ? -1 : modelOptionsForThisFeature.findIndex((m) => modelSelectionsEqual(m.selection, modelSelectionAtFeature));
    if (selnIdx !== -1) continue;
    newModelSelectionOfFeature = {
      ...newModelSelectionOfFeature,
      [featureName]: modelOptionsForThisFeature.length === 0 ? null : modelOptionsForThisFeature[0].selection
    };
  }
  const newState = {
    ...state,
    settingsOfProvider: newSettingsOfProvider,
    modelSelectionOfFeature: newModelSelectionOfFeature,
    overridesOfModel: state.overridesOfModel,
    _modelOptions: newModelOptions
  };
  return newState;
};
const defaultState = () => {
  const d = {
    settingsOfProvider: deepClone(defaultSettingsOfProvider),
    modelSelectionOfFeature: {
      "Chat": { providerName: "googleVertex", modelName: "gemini-2.5-flash" },
      "Ctrl+K": { providerName: "googleVertex", modelName: "gemini-2.5-flash" },
      "Autocomplete": { providerName: "googleVertex", modelName: "gemini-2.5-flash" },
      "Apply": { providerName: "googleVertex", modelName: "gemini-2.5-flash" },
      "SCM": { providerName: "googleVertex", modelName: "gemini-2.5-flash" }
    },
    globalSettings: deepClone(defaultGlobalSettings),
    optionsOfModelSelection: { "Chat": {}, "Ctrl+K": {}, "Autocomplete": {}, "Apply": {}, "SCM": {} },
    overridesOfModel: deepClone(defaultOverridesOfModel),
    _modelOptions: [],
    // computed later
    mcpUserStateOfName: {}
  };
  return d;
};
const IVoidSettingsService = createDecorator("VoidSettingsService");
let VoidSettingsService = class extends Disposable {
  // await this if you need a valid state initially
  constructor(_storageService, _encryptionService, _metricsService) {
    super();
    this._storageService = _storageService;
    this._encryptionService = _encryptionService;
    this._metricsService = _metricsService;
    this._onDidChangeState = new Emitter();
    this.onDidChangeState = this._onDidChangeState.event;
    this.dangerousSetState = async (newState) => {
      this.state = _validatedModelState(newState);
      await this._storeState();
      this._onDidChangeState.fire();
      this._onUpdate_syncApplyToChat();
      this._onUpdate_syncSCMToChat();
    };
    this.setSettingOfProvider = async (providerName, settingName, newVal) => {
      const newModelSelectionOfFeature = this.state.modelSelectionOfFeature;
      const newOptionsOfModelSelection = this.state.optionsOfModelSelection;
      const newSettingsOfProvider = {
        ...this.state.settingsOfProvider,
        [providerName]: {
          ...this.state.settingsOfProvider[providerName],
          [settingName]: newVal
        }
      };
      const newGlobalSettings = this.state.globalSettings;
      const newOverridesOfModel = this.state.overridesOfModel;
      const newMCPUserStateOfName = this.state.mcpUserStateOfName;
      const newState = {
        modelSelectionOfFeature: newModelSelectionOfFeature,
        optionsOfModelSelection: newOptionsOfModelSelection,
        settingsOfProvider: newSettingsOfProvider,
        globalSettings: newGlobalSettings,
        overridesOfModel: newOverridesOfModel,
        mcpUserStateOfName: newMCPUserStateOfName
      };
      this.state = _validatedModelState(newState);
      await this._storeState();
      this._onDidChangeState.fire();
    };
    this.setGlobalSetting = async (settingName, newVal) => {
      const newState = {
        ...this.state,
        globalSettings: {
          ...this.state.globalSettings,
          [settingName]: newVal
        }
      };
      this.state = _validatedModelState(newState);
      await this._storeState();
      this._onDidChangeState.fire();
      if (this.state.globalSettings.syncApplyToChat) this._onUpdate_syncApplyToChat();
      if (this.state.globalSettings.syncSCMToChat) this._onUpdate_syncSCMToChat();
    };
    this.setModelSelectionOfFeature = async (featureName, newVal) => {
      const newState = {
        ...this.state,
        modelSelectionOfFeature: {
          ...this.state.modelSelectionOfFeature,
          [featureName]: newVal
        }
      };
      this.state = _validatedModelState(newState);
      await this._storeState();
      this._onDidChangeState.fire();
      if (featureName === "Chat") {
        this._onUpdate_syncApplyToChat();
        this._onUpdate_syncSCMToChat();
      }
    };
    this.setOptionsOfModelSelection = async (featureName, providerName, modelName, newVal) => {
      const newState = {
        ...this.state,
        optionsOfModelSelection: {
          ...this.state.optionsOfModelSelection,
          [featureName]: {
            ...this.state.optionsOfModelSelection[featureName],
            [providerName]: {
              ...this.state.optionsOfModelSelection[featureName][providerName],
              [modelName]: {
                ...this.state.optionsOfModelSelection[featureName][providerName]?.[modelName],
                ...newVal
              }
            }
          }
        }
      };
      this.state = _validatedModelState(newState);
      await this._storeState();
      this._onDidChangeState.fire();
    };
    this.setOverridesOfModel = async (providerName, modelName, overrides) => {
      const newState = {
        ...this.state,
        overridesOfModel: {
          ...this.state.overridesOfModel,
          [providerName]: {
            ...this.state.overridesOfModel[providerName],
            [modelName]: overrides === void 0 ? void 0 : {
              ...this.state.overridesOfModel[providerName][modelName],
              ...overrides
            }
          }
        }
      };
      this.state = _validatedModelState(newState);
      await this._storeState();
      this._onDidChangeState.fire();
      this._metricsService.capture("Update Model Overrides", { providerName, modelName, overrides });
    };
    // MCP Server State
    this._setMCPUserStateOfName = async (newStates) => {
      const newState = {
        ...this.state,
        mcpUserStateOfName: {
          ...this.state.mcpUserStateOfName,
          ...newStates
        }
      };
      this.state = _validatedModelState(newState);
      await this._storeState();
      this._onDidChangeState.fire();
      this._metricsService.capture("Set MCP Server States", { newStates });
    };
    this.addMCPUserStateOfNames = async (newMCPStates) => {
      const { mcpUserStateOfName: mcpServerStates } = this.state;
      const newMCPServerStates = {
        ...mcpServerStates,
        ...newMCPStates
      };
      await this._setMCPUserStateOfName(newMCPServerStates);
      this._metricsService.capture("Add MCP Servers", { servers: Object.keys(newMCPStates).join(", ") });
    };
    this.removeMCPUserStateOfNames = async (serverNames) => {
      const { mcpUserStateOfName: mcpServerStates } = this.state;
      const newMCPServerStates = {
        ...mcpServerStates
      };
      serverNames.forEach((serverName) => {
        if (serverName in newMCPServerStates) {
          delete newMCPServerStates[serverName];
        }
      });
      await this._setMCPUserStateOfName(newMCPServerStates);
      this._metricsService.capture("Remove MCP Servers", { servers: serverNames.join(", ") });
    };
    this.setMCPServerState = async (serverName, state) => {
      const { mcpUserStateOfName } = this.state;
      const newMCPServerStates = {
        ...mcpUserStateOfName,
        [serverName]: state
      };
      await this._setMCPUserStateOfName(newMCPServerStates);
      this._metricsService.capture("Update MCP Server State", { serverName, state });
    };
    this.state = defaultState();
    let resolver = () => {
    };
    this.waitForInitState = new Promise((res, rej) => resolver = res);
    this._resolver = resolver;
    this.readAndInitializeState();
  }
  async resetState() {
    await this.dangerousSetState(defaultState());
  }
  async readAndInitializeState() {
    let readS;
    try {
      readS = await this._readState();
      if (readS.globalSettings.includeToolLintErrors === void 0) readS.globalSettings.includeToolLintErrors = true;
      if (typeof readS.globalSettings.autoApprove === "boolean") readS.globalSettings.autoApprove = {};
      if (readS.modelSelectionOfFeature && !readS.modelSelectionOfFeature["SCM"]) {
        readS.modelSelectionOfFeature["SCM"] = deepClone(readS.modelSelectionOfFeature["Chat"]);
        readS.optionsOfModelSelection["SCM"] = deepClone(readS.optionsOfModelSelection["Chat"]);
      }
      if (readS.globalSettings.disableSystemMessage === void 0) readS.globalSettings.disableSystemMessage = false;
      if (readS.globalSettings.autoAcceptLLMChanges === void 0) readS.globalSettings.autoAcceptLLMChanges = false;
    } catch (e) {
      readS = defaultState();
    }
    try {
      readS = {
        ...defaultState(),
        ...readS
        // no idea why this was here, seems like a bug
        // ...defaultSettingsOfProvider,
        // ...readS.settingsOfProvider,
      };
      for (const providerName of providerNames) {
        readS.settingsOfProvider[providerName] = {
          ...defaultSettingsOfProvider[providerName],
          ...readS.settingsOfProvider[providerName]
        };
        for (const m of readS.settingsOfProvider[providerName].models) {
          if (!m.type) {
            const old = m;
            if (old.isAutodetected)
              m.type = "autodetected";
            else if (old.isDefault)
              m.type = "default";
            else m.type = "custom";
          }
        }
        if (providerName === "openAICompatible" && !readS.settingsOfProvider[providerName].headersJSON) {
          readS.settingsOfProvider[providerName].headersJSON = "{}";
        }
      }
    } catch (e) {
      readS = defaultState();
    }
    this.state = readS;
    this.state = _stateWithMergedDefaultModels(this.state);
    this.state = _validatedModelState(this.state);
    const voltDefaultModel = { providerName: "googleVertex", modelName: "gemini-2.5-flash" };
    for (const f of ["Chat", "Ctrl+K", "Autocomplete", "Apply", "SCM"]) {
      this.state.modelSelectionOfFeature[f] = { ...voltDefaultModel };
    }
    this.state.settingsOfProvider.googleVertex.project = "videogen-496506";
    this.state.settingsOfProvider.googleVertex.region = "us-central1";
    this.state.settingsOfProvider.googleVertex._didFillInProviderSettings = true;
    this._resolver();
    this._onDidChangeState.fire();
  }
  async _readState() {
    const encryptedState = this._storageService.get(VOID_SETTINGS_STORAGE_KEY, StorageScope.APPLICATION);
    if (!encryptedState)
      return defaultState();
    const stateStr = await this._encryptionService.decrypt(encryptedState);
    const state = JSON.parse(stateStr);
    return state;
  }
  async _storeState() {
    const state = this.state;
    const encryptedState = await this._encryptionService.encrypt(JSON.stringify(state));
    this._storageService.store(VOID_SETTINGS_STORAGE_KEY, encryptedState, StorageScope.APPLICATION, StorageTarget.USER);
  }
  _onUpdate_syncApplyToChat() {
    this.setModelSelectionOfFeature("Apply", deepClone(this.state.modelSelectionOfFeature["Chat"]));
  }
  _onUpdate_syncSCMToChat() {
    this.setModelSelectionOfFeature("SCM", deepClone(this.state.modelSelectionOfFeature["Chat"]));
  }
  setAutodetectedModels(providerName, autodetectedModelNames, logging) {
    const { models } = this.state.settingsOfProvider[providerName];
    const oldModelNames = models.map((m) => m.modelName);
    const newModels = _modelsWithSwappedInNewModels({ existingModels: models, models: autodetectedModelNames, type: "autodetected" });
    this.setSettingOfProvider(providerName, "models", newModels);
    const new_names = newModels.map((m) => m.modelName);
    if (!(oldModelNames.length === new_names.length && oldModelNames.every((_, i) => oldModelNames[i] === new_names[i]))) {
      this._metricsService.capture("Autodetect Models", { providerName, newModels, ...logging });
    }
  }
  toggleModelHidden(providerName, modelName) {
    const { models } = this.state.settingsOfProvider[providerName];
    const modelIdx = models.findIndex((m) => m.modelName === modelName);
    if (modelIdx === -1) return;
    const newIsHidden = !models[modelIdx].isHidden;
    const newModels = [
      ...models.slice(0, modelIdx),
      { ...models[modelIdx], isHidden: newIsHidden },
      ...models.slice(modelIdx + 1, Infinity)
    ];
    this.setSettingOfProvider(providerName, "models", newModels);
    this._metricsService.capture("Toggle Model Hidden", { providerName, modelName, newIsHidden });
  }
  addModel(providerName, modelName) {
    const { models } = this.state.settingsOfProvider[providerName];
    const existingIdx = models.findIndex((m) => m.modelName === modelName);
    if (existingIdx !== -1) return;
    const newModels = [
      ...models,
      { modelName, type: "custom", isHidden: false }
    ];
    this.setSettingOfProvider(providerName, "models", newModels);
    this._metricsService.capture("Add Model", { providerName, modelName });
  }
  deleteModel(providerName, modelName) {
    const { models } = this.state.settingsOfProvider[providerName];
    const delIdx = models.findIndex((m) => m.modelName === modelName);
    if (delIdx === -1) return false;
    const newModels = [
      ...models.slice(0, delIdx),
      // delete the idx
      ...models.slice(delIdx + 1, Infinity)
    ];
    this.setSettingOfProvider(providerName, "models", newModels);
    this._metricsService.capture("Delete Model", { providerName, modelName });
    return true;
  }
};
VoidSettingsService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IEncryptionService),
  __decorateParam(2, IMetricsService)
], VoidSettingsService);
registerSingleton(IVoidSettingsService, VoidSettingsService, InstantiationType.Eager);
export {
  IVoidSettingsService,
  modelFilterOfFeatureName
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2NvbW1vbi92b2lkU2V0dGluZ3NTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IDIwMjUgR2xhc3MgRGV2dG9vbHMsIEluYy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wLiBTZWUgTElDRU5TRS50eHQgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGRlZXBDbG9uZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgSUVuY3J5cHRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW5jcnlwdGlvbi9jb21tb24vZW5jcnlwdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJTaW5nbGV0b24sIEluc3RhbnRpYXRpb25UeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJTWV0cmljc1NlcnZpY2UgfSBmcm9tICcuL21ldHJpY3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGRlZmF1bHRQcm92aWRlclNldHRpbmdzLCBnZXRNb2RlbENhcGFiaWxpdGllcywgTW9kZWxPdmVycmlkZXMgfSBmcm9tICcuL21vZGVsQ2FwYWJpbGl0aWVzLmpzJztcbmltcG9ydCB7IFZPSURfU0VUVElOR1NfU1RPUkFHRV9LRVkgfSBmcm9tICcuL3N0b3JhZ2VLZXlzLmpzJztcbmltcG9ydCB7IGRlZmF1bHRTZXR0aW5nc09mUHJvdmlkZXIsIEZlYXR1cmVOYW1lLCBQcm92aWRlck5hbWUsIE1vZGVsU2VsZWN0aW9uT2ZGZWF0dXJlLCBTZXR0aW5nc09mUHJvdmlkZXIsIFNldHRpbmdOYW1lLCBwcm92aWRlck5hbWVzLCBNb2RlbFNlbGVjdGlvbiwgbW9kZWxTZWxlY3Rpb25zRXF1YWwsIGZlYXR1cmVOYW1lcywgVm9pZFN0YXRlZnVsTW9kZWxJbmZvLCBHbG9iYWxTZXR0aW5ncywgR2xvYmFsU2V0dGluZ05hbWUsIGRlZmF1bHRHbG9iYWxTZXR0aW5ncywgTW9kZWxTZWxlY3Rpb25PcHRpb25zLCBPcHRpb25zT2ZNb2RlbFNlbGVjdGlvbiwgQ2hhdE1vZGUsIE92ZXJyaWRlc09mTW9kZWwsIGRlZmF1bHRPdmVycmlkZXNPZk1vZGVsLCBNQ1BVc2VyU3RhdGVPZk5hbWUgYXMgTUNQVXNlclN0YXRlT2ZOYW1lLCBNQ1BVc2VyU3RhdGUgfSBmcm9tICcuL3ZvaWRTZXR0aW5nc1R5cGVzLmpzJztcblxuXG4vLyBuYW1lIGlzIHRoZSBuYW1lIGluIHRoZSBkcm9wZG93blxuZXhwb3J0IHR5cGUgTW9kZWxPcHRpb24gPSB7IG5hbWU6IHN0cmluZywgc2VsZWN0aW9uOiBNb2RlbFNlbGVjdGlvbiB9XG5cblxuXG50eXBlIFNldFNldHRpbmdPZlByb3ZpZGVyRm4gPSA8UyBleHRlbmRzIFNldHRpbmdOYW1lPihcblx0cHJvdmlkZXJOYW1lOiBQcm92aWRlck5hbWUsXG5cdHNldHRpbmdOYW1lOiBTLFxuXHRuZXdWYWw6IFNldHRpbmdzT2ZQcm92aWRlcltQcm92aWRlck5hbWVdW1MgZXh0ZW5kcyBrZXlvZiBTZXR0aW5nc09mUHJvdmlkZXJbUHJvdmlkZXJOYW1lXSA/IFMgOiBuZXZlcl0sXG4pID0+IFByb21pc2U8dm9pZD47XG5cbnR5cGUgU2V0TW9kZWxTZWxlY3Rpb25PZkZlYXR1cmVGbiA9IDxLIGV4dGVuZHMgRmVhdHVyZU5hbWU+KFxuXHRmZWF0dXJlTmFtZTogSyxcblx0bmV3VmFsOiBNb2RlbFNlbGVjdGlvbk9mRmVhdHVyZVtLXSxcbikgPT4gUHJvbWlzZTx2b2lkPjtcblxudHlwZSBTZXRHbG9iYWxTZXR0aW5nRm4gPSA8VCBleHRlbmRzIEdsb2JhbFNldHRpbmdOYW1lPihzZXR0aW5nTmFtZTogVCwgbmV3VmFsOiBHbG9iYWxTZXR0aW5nc1tUXSkgPT4gdm9pZDtcblxudHlwZSBTZXRPcHRpb25zT2ZNb2RlbFNlbGVjdGlvbiA9IChmZWF0dXJlTmFtZTogRmVhdHVyZU5hbWUsIHByb3ZpZGVyTmFtZTogUHJvdmlkZXJOYW1lLCBtb2RlbE5hbWU6IHN0cmluZywgbmV3VmFsOiBQYXJ0aWFsPE1vZGVsU2VsZWN0aW9uT3B0aW9ucz4pID0+IHZvaWRcblxuXG5leHBvcnQgdHlwZSBWb2lkU2V0dGluZ3NTdGF0ZSA9IHtcblx0cmVhZG9ubHkgc2V0dGluZ3NPZlByb3ZpZGVyOiBTZXR0aW5nc09mUHJvdmlkZXI7IC8vIG9wdGlvbnNPZlByb3ZpZGVyXG5cdHJlYWRvbmx5IG1vZGVsU2VsZWN0aW9uT2ZGZWF0dXJlOiBNb2RlbFNlbGVjdGlvbk9mRmVhdHVyZTsgLy8gc3RhdGVPZkZlYXR1cmVcblx0cmVhZG9ubHkgb3B0aW9uc09mTW9kZWxTZWxlY3Rpb246IE9wdGlvbnNPZk1vZGVsU2VsZWN0aW9uO1xuXHRyZWFkb25seSBvdmVycmlkZXNPZk1vZGVsOiBPdmVycmlkZXNPZk1vZGVsO1xuXHRyZWFkb25seSBnbG9iYWxTZXR0aW5nczogR2xvYmFsU2V0dGluZ3M7XG5cdHJlYWRvbmx5IG1jcFVzZXJTdGF0ZU9mTmFtZTogTUNQVXNlclN0YXRlT2ZOYW1lOyAvLyB1c2VyLWNvbnRyb2xsZWQgc3RhdGUgb2YgTUNQIHNlcnZlcnNcblxuXHRyZWFkb25seSBfbW9kZWxPcHRpb25zOiBNb2RlbE9wdGlvbltdIC8vIGNvbXB1dGVkIGJhc2VkIG9uIHRoZSB0d28gYWJvdmUgaXRlbXNcbn1cblxuLy8gdHlwZSBSZWFsVm9pZFNldHRpbmdzID0gRXhjbHVkZTxrZXlvZiBWb2lkU2V0dGluZ3NTdGF0ZSwgJ19tb2RlbE9wdGlvbnMnPlxuLy8gdHlwZSBFdmVudFByb3A8VCBleHRlbmRzIFJlYWxWb2lkU2V0dGluZ3MgPSBSZWFsVm9pZFNldHRpbmdzPiA9IFQgZXh0ZW5kcyAnZ2xvYmFsU2V0dGluZ3MnID8gW1QsIGtleW9mIFZvaWRTZXR0aW5nc1N0YXRlW1RdXSA6IFQgfCAnYWxsJ1xuXG5cbmV4cG9ydCBpbnRlcmZhY2UgSVZvaWRTZXR0aW5nc1NlcnZpY2Uge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IHN0YXRlOiBWb2lkU2V0dGluZ3NTdGF0ZTsgLy8gaW4gb3JkZXIgdG8gcGxheSBuaWNlbHkgd2l0aCByZWFjdCwgeW91IHNob3VsZCBpbW11dGFibHkgY2hhbmdlIHN0YXRlXG5cdHJlYWRvbmx5IHdhaXRGb3JJbml0U3RhdGU6IFByb21pc2U8dm9pZD47XG5cblx0b25EaWRDaGFuZ2VTdGF0ZTogRXZlbnQ8dm9pZD47XG5cblx0c2V0U2V0dGluZ09mUHJvdmlkZXI6IFNldFNldHRpbmdPZlByb3ZpZGVyRm47XG5cdHNldE1vZGVsU2VsZWN0aW9uT2ZGZWF0dXJlOiBTZXRNb2RlbFNlbGVjdGlvbk9mRmVhdHVyZUZuO1xuXHRzZXRPcHRpb25zT2ZNb2RlbFNlbGVjdGlvbjogU2V0T3B0aW9uc09mTW9kZWxTZWxlY3Rpb247XG5cdHNldEdsb2JhbFNldHRpbmc6IFNldEdsb2JhbFNldHRpbmdGbjtcblx0Ly8gc2V0TUNQU2VydmVyU3RhdGVzOiAobmV3U3RhdGVzOiBNQ1BTZXJ2ZXJTdGF0ZXMpID0+IFByb21pc2U8dm9pZD47XG5cblx0Ly8gc2V0dGluZyB0byB1bmRlZmluZWQgQ0xFQVJTIGl0LCB1bmxpa2Ugb3RoZXJzOlxuXHRzZXRPdmVycmlkZXNPZk1vZGVsKHByb3ZpZGVyTmFtZTogUHJvdmlkZXJOYW1lLCBtb2RlbE5hbWU6IHN0cmluZywgb3ZlcnJpZGVzOiBQYXJ0aWFsPE1vZGVsT3ZlcnJpZGVzPiB8IHVuZGVmaW5lZCk6IFByb21pc2U8dm9pZD47XG5cblx0ZGFuZ2Vyb3VzU2V0U3RhdGUobmV3U3RhdGU6IFZvaWRTZXR0aW5nc1N0YXRlKTogUHJvbWlzZTx2b2lkPjtcblx0cmVzZXRTdGF0ZSgpOiBQcm9taXNlPHZvaWQ+O1xuXG5cdHNldEF1dG9kZXRlY3RlZE1vZGVscyhwcm92aWRlck5hbWU6IFByb3ZpZGVyTmFtZSwgbW9kZWxOYW1lczogc3RyaW5nW10sIGxvZ2dpbmc6IG9iamVjdCk6IHZvaWQ7XG5cdHRvZ2dsZU1vZGVsSGlkZGVuKHByb3ZpZGVyTmFtZTogUHJvdmlkZXJOYW1lLCBtb2RlbE5hbWU6IHN0cmluZyk6IHZvaWQ7XG5cdGFkZE1vZGVsKHByb3ZpZGVyTmFtZTogUHJvdmlkZXJOYW1lLCBtb2RlbE5hbWU6IHN0cmluZyk6IHZvaWQ7XG5cdGRlbGV0ZU1vZGVsKHByb3ZpZGVyTmFtZTogUHJvdmlkZXJOYW1lLCBtb2RlbE5hbWU6IHN0cmluZyk6IGJvb2xlYW47XG5cblx0YWRkTUNQVXNlclN0YXRlT2ZOYW1lcyh1c2VyU3RhdGVPZk5hbWU6IE1DUFVzZXJTdGF0ZU9mTmFtZSk6IFByb21pc2U8dm9pZD47XG5cdHJlbW92ZU1DUFVzZXJTdGF0ZU9mTmFtZXMoc2VydmVyTmFtZXM6IHN0cmluZ1tdKTogUHJvbWlzZTx2b2lkPjtcblx0c2V0TUNQU2VydmVyU3RhdGUoc2VydmVyTmFtZTogc3RyaW5nLCBzdGF0ZTogTUNQVXNlclN0YXRlKTogUHJvbWlzZTx2b2lkPjtcbn1cblxuXG5cblxuY29uc3QgX21vZGVsc1dpdGhTd2FwcGVkSW5OZXdNb2RlbHMgPSAob3B0aW9uczogeyBleGlzdGluZ01vZGVsczogVm9pZFN0YXRlZnVsTW9kZWxJbmZvW10sIG1vZGVsczogc3RyaW5nW10sIHR5cGU6ICdhdXRvZGV0ZWN0ZWQnIHwgJ2RlZmF1bHQnIH0pID0+IHtcblx0Y29uc3QgeyBleGlzdGluZ01vZGVscywgbW9kZWxzLCB0eXBlIH0gPSBvcHRpb25zXG5cblx0Y29uc3QgZXhpc3RpbmdNb2RlbHNNYXA6IFJlY29yZDxzdHJpbmcsIFZvaWRTdGF0ZWZ1bE1vZGVsSW5mbz4gPSB7fVxuXHRmb3IgKGNvbnN0IGV4aXN0aW5nTW9kZWwgb2YgZXhpc3RpbmdNb2RlbHMpIHtcblx0XHRleGlzdGluZ01vZGVsc01hcFtleGlzdGluZ01vZGVsLm1vZGVsTmFtZV0gPSBleGlzdGluZ01vZGVsXG5cdH1cblxuXHRjb25zdCBuZXdEZWZhdWx0TW9kZWxzID0gbW9kZWxzLm1hcCgobW9kZWxOYW1lLCBpKSA9PiAoeyBtb2RlbE5hbWUsIHR5cGUsIGlzSGlkZGVuOiAhIWV4aXN0aW5nTW9kZWxzTWFwW21vZGVsTmFtZV0/LmlzSGlkZGVuLCB9KSlcblxuXHRyZXR1cm4gW1xuXHRcdC4uLm5ld0RlZmF1bHRNb2RlbHMsIC8vIHN3YXAgb3V0IGFsbCB0aGUgbW9kZWxzIG9mIHRoaXMgdHlwZSBmb3IgdGhlIG5ldyBtb2RlbHMgb2YgdGhpcyB0eXBlXG5cdFx0Li4uZXhpc3RpbmdNb2RlbHMuZmlsdGVyKG0gPT4ge1xuXHRcdFx0Y29uc3Qga2VlcCA9IG0udHlwZSAhPT0gdHlwZVxuXHRcdFx0cmV0dXJuIGtlZXBcblx0XHR9KVxuXHRdXG59XG5cblxuZXhwb3J0IGNvbnN0IG1vZGVsRmlsdGVyT2ZGZWF0dXJlTmFtZToge1xuXHRbZmVhdHVyZU5hbWUgaW4gRmVhdHVyZU5hbWVdOiB7XG5cdFx0ZmlsdGVyOiAoXG5cdFx0XHRvOiBNb2RlbFNlbGVjdGlvbixcblx0XHRcdG9wdHM6IHsgY2hhdE1vZGU6IENoYXRNb2RlLCBvdmVycmlkZXNPZk1vZGVsOiBPdmVycmlkZXNPZk1vZGVsIH1cblx0XHQpID0+IGJvb2xlYW47XG5cdFx0ZW1wdHlNZXNzYWdlOiBudWxsIHwgeyBtZXNzYWdlOiBzdHJpbmcsIHByaW9yaXR5OiAnYWx3YXlzJyB8ICdmYWxsYmFjaycgfVxuXHR9IH0gPSB7XG5cdCdBdXRvY29tcGxldGUnOiB7IGZpbHRlcjogKG8sIG9wdHMpID0+IGdldE1vZGVsQ2FwYWJpbGl0aWVzKG8ucHJvdmlkZXJOYW1lLCBvLm1vZGVsTmFtZSwgb3B0cy5vdmVycmlkZXNPZk1vZGVsKS5zdXBwb3J0c0ZJTSwgZW1wdHlNZXNzYWdlOiB7IG1lc3NhZ2U6ICdObyBtb2RlbHMgc3VwcG9ydCBGSU0nLCBwcmlvcml0eTogJ2Fsd2F5cycgfSB9LFxuXHQnQ2hhdCc6IHsgZmlsdGVyOiBvID0+IHRydWUsIGVtcHR5TWVzc2FnZTogbnVsbCwgfSxcblx0J0N0cmwrSyc6IHsgZmlsdGVyOiBvID0+IHRydWUsIGVtcHR5TWVzc2FnZTogbnVsbCwgfSxcblx0J0FwcGx5JzogeyBmaWx0ZXI6IG8gPT4gdHJ1ZSwgZW1wdHlNZXNzYWdlOiBudWxsLCB9LFxuXHQnU0NNJzogeyBmaWx0ZXI6IG8gPT4gdHJ1ZSwgZW1wdHlNZXNzYWdlOiBudWxsLCB9LFxufVxuXG5cbmNvbnN0IF9zdGF0ZVdpdGhNZXJnZWREZWZhdWx0TW9kZWxzID0gKHN0YXRlOiBWb2lkU2V0dGluZ3NTdGF0ZSk6IFZvaWRTZXR0aW5nc1N0YXRlID0+IHtcblx0bGV0IG5ld1NldHRpbmdzT2ZQcm92aWRlciA9IHN0YXRlLnNldHRpbmdzT2ZQcm92aWRlclxuXG5cdC8vIHJlY29tcHV0ZSBkZWZhdWx0IG1vZGVsc1xuXHRmb3IgKGNvbnN0IHByb3ZpZGVyTmFtZSBvZiBwcm92aWRlck5hbWVzKSB7XG5cdFx0Y29uc3QgZGVmYXVsdE1vZGVscyA9IGRlZmF1bHRTZXR0aW5nc09mUHJvdmlkZXJbcHJvdmlkZXJOYW1lXT8ubW9kZWxzID8/IFtdXG5cdFx0Y29uc3QgY3VycmVudE1vZGVscyA9IG5ld1NldHRpbmdzT2ZQcm92aWRlcltwcm92aWRlck5hbWVdPy5tb2RlbHMgPz8gW11cblx0XHRjb25zdCBkZWZhdWx0TW9kZWxOYW1lcyA9IGRlZmF1bHRNb2RlbHMubWFwKG0gPT4gbS5tb2RlbE5hbWUpXG5cdFx0Y29uc3QgbmV3TW9kZWxzID0gX21vZGVsc1dpdGhTd2FwcGVkSW5OZXdNb2RlbHMoeyBleGlzdGluZ01vZGVsczogY3VycmVudE1vZGVscywgbW9kZWxzOiBkZWZhdWx0TW9kZWxOYW1lcywgdHlwZTogJ2RlZmF1bHQnIH0pXG5cdFx0bmV3U2V0dGluZ3NPZlByb3ZpZGVyID0ge1xuXHRcdFx0Li4ubmV3U2V0dGluZ3NPZlByb3ZpZGVyLFxuXHRcdFx0W3Byb3ZpZGVyTmFtZV06IHtcblx0XHRcdFx0Li4ubmV3U2V0dGluZ3NPZlByb3ZpZGVyW3Byb3ZpZGVyTmFtZV0sXG5cdFx0XHRcdG1vZGVsczogbmV3TW9kZWxzLFxuXHRcdFx0fSxcblx0XHR9XG5cdH1cblx0cmV0dXJuIHtcblx0XHQuLi5zdGF0ZSxcblx0XHRzZXR0aW5nc09mUHJvdmlkZXI6IG5ld1NldHRpbmdzT2ZQcm92aWRlcixcblx0fVxufVxuXG5jb25zdCBfdmFsaWRhdGVkTW9kZWxTdGF0ZSA9IChzdGF0ZTogT21pdDxWb2lkU2V0dGluZ3NTdGF0ZSwgJ19tb2RlbE9wdGlvbnMnPik6IFZvaWRTZXR0aW5nc1N0YXRlID0+IHtcblxuXHRsZXQgbmV3U2V0dGluZ3NPZlByb3ZpZGVyID0gc3RhdGUuc2V0dGluZ3NPZlByb3ZpZGVyXG5cblx0Ly8gcmVjb21wdXRlIF9kaWRGaWxsSW5Qcm92aWRlclNldHRpbmdzXG5cdGZvciAoY29uc3QgcHJvdmlkZXJOYW1lIG9mIHByb3ZpZGVyTmFtZXMpIHtcblx0XHRjb25zdCBzZXR0aW5nc0F0UHJvdmlkZXIgPSBuZXdTZXR0aW5nc09mUHJvdmlkZXJbcHJvdmlkZXJOYW1lXVxuXG5cdFx0Y29uc3QgZGlkRmlsbEluUHJvdmlkZXJTZXR0aW5ncyA9IE9iamVjdC5rZXlzKGRlZmF1bHRQcm92aWRlclNldHRpbmdzW3Byb3ZpZGVyTmFtZV0pLmV2ZXJ5KGtleSA9PiAhIXNldHRpbmdzQXRQcm92aWRlcltrZXkgYXMga2V5b2YgdHlwZW9mIHNldHRpbmdzQXRQcm92aWRlcl0pXG5cblx0XHRpZiAoZGlkRmlsbEluUHJvdmlkZXJTZXR0aW5ncyA9PT0gc2V0dGluZ3NBdFByb3ZpZGVyLl9kaWRGaWxsSW5Qcm92aWRlclNldHRpbmdzKSBjb250aW51ZVxuXG5cdFx0bmV3U2V0dGluZ3NPZlByb3ZpZGVyID0ge1xuXHRcdFx0Li4ubmV3U2V0dGluZ3NPZlByb3ZpZGVyLFxuXHRcdFx0W3Byb3ZpZGVyTmFtZV06IHtcblx0XHRcdFx0Li4uc2V0dGluZ3NBdFByb3ZpZGVyLFxuXHRcdFx0XHRfZGlkRmlsbEluUHJvdmlkZXJTZXR0aW5nczogZGlkRmlsbEluUHJvdmlkZXJTZXR0aW5ncyxcblx0XHRcdH0sXG5cdFx0fVxuXHR9XG5cblx0Ly8gdXBkYXRlIG1vZGVsIG9wdGlvbnNcblx0bGV0IG5ld01vZGVsT3B0aW9uczogTW9kZWxPcHRpb25bXSA9IFtdXG5cdGZvciAoY29uc3QgcHJvdmlkZXJOYW1lIG9mIHByb3ZpZGVyTmFtZXMpIHtcblx0XHRjb25zdCBwcm92aWRlclRpdGxlID0gcHJvdmlkZXJOYW1lIC8vIGRpc3BsYXlJbmZvT2ZQcm92aWRlck5hbWUocHJvdmlkZXJOYW1lKS50aXRsZS50b0xvd2VyQ2FzZSgpIC8vIGxvb2tzIGJldHRlciBsb3dlcmNhc2UsIGJlc3QgcHJhY3RpY2UgdG8gbm90IHVzZSByYXcgcHJvdmlkZXJOYW1lXG5cdFx0aWYgKCFuZXdTZXR0aW5nc09mUHJvdmlkZXJbcHJvdmlkZXJOYW1lXS5fZGlkRmlsbEluUHJvdmlkZXJTZXR0aW5ncykgY29udGludWUgLy8gaWYgZGlzYWJsZWQsIGRvbid0IGRpc3BsYXkgbW9kZWwgb3B0aW9uc1xuXHRcdGZvciAoY29uc3QgeyBtb2RlbE5hbWUsIGlzSGlkZGVuIH0gb2YgbmV3U2V0dGluZ3NPZlByb3ZpZGVyW3Byb3ZpZGVyTmFtZV0ubW9kZWxzKSB7XG5cdFx0XHRpZiAoaXNIaWRkZW4pIGNvbnRpbnVlXG5cdFx0XHRuZXdNb2RlbE9wdGlvbnMucHVzaCh7IG5hbWU6IGAke21vZGVsTmFtZX0gKCR7cHJvdmlkZXJUaXRsZX0pYCwgc2VsZWN0aW9uOiB7IHByb3ZpZGVyTmFtZSwgbW9kZWxOYW1lIH0gfSlcblx0XHR9XG5cdH1cblxuXHQvLyBub3cgdGhhdCBtb2RlbCBvcHRpb25zIGFyZSB1cGRhdGVkLCBtYWtlIHN1cmUgdGhlIHNlbGVjdGlvbiBpcyB2YWxpZFxuXHQvLyBpZiB0aGUgdXNlci1zZWxlY3RlZCBtb2RlbCBpcyBubyBsb25nZXIgaW4gdGhlIGxpc3QsIHVwZGF0ZSB0aGUgc2VsZWN0aW9uIGZvciBlYWNoIGZlYXR1cmUgdGhhdCBuZWVkcyBpdCB0byBzb21ldGhpbmcgcmVsZXZhbnQgKHRoZSAwdGggbW9kZWwgYXZhaWxhYmxlLCBvciBudWxsKVxuXHRsZXQgbmV3TW9kZWxTZWxlY3Rpb25PZkZlYXR1cmUgPSBzdGF0ZS5tb2RlbFNlbGVjdGlvbk9mRmVhdHVyZVxuXHRmb3IgKGNvbnN0IGZlYXR1cmVOYW1lIG9mIGZlYXR1cmVOYW1lcykge1xuXG5cdFx0Y29uc3QgeyBmaWx0ZXIgfSA9IG1vZGVsRmlsdGVyT2ZGZWF0dXJlTmFtZVtmZWF0dXJlTmFtZV1cblx0XHRjb25zdCBmaWx0ZXJPcHRzID0geyBjaGF0TW9kZTogc3RhdGUuZ2xvYmFsU2V0dGluZ3MuY2hhdE1vZGUsIG92ZXJyaWRlc09mTW9kZWw6IHN0YXRlLm92ZXJyaWRlc09mTW9kZWwgfVxuXHRcdGNvbnN0IG1vZGVsT3B0aW9uc0ZvclRoaXNGZWF0dXJlID0gbmV3TW9kZWxPcHRpb25zLmZpbHRlcigobykgPT4gZmlsdGVyKG8uc2VsZWN0aW9uLCBmaWx0ZXJPcHRzKSlcblxuXHRcdGNvbnN0IG1vZGVsU2VsZWN0aW9uQXRGZWF0dXJlID0gbmV3TW9kZWxTZWxlY3Rpb25PZkZlYXR1cmVbZmVhdHVyZU5hbWVdXG5cdFx0Y29uc3Qgc2VsbklkeCA9IG1vZGVsU2VsZWN0aW9uQXRGZWF0dXJlID09PSBudWxsID8gLTEgOiBtb2RlbE9wdGlvbnNGb3JUaGlzRmVhdHVyZS5maW5kSW5kZXgobSA9PiBtb2RlbFNlbGVjdGlvbnNFcXVhbChtLnNlbGVjdGlvbiwgbW9kZWxTZWxlY3Rpb25BdEZlYXR1cmUpKVxuXG5cdFx0aWYgKHNlbG5JZHggIT09IC0xKSBjb250aW51ZSAvLyBubyBsb25nZXIgaW4gbGlzdCwgc28gdXBkYXRlIHRvIDFzdCBpbiBsaXN0IG9yIG51bGxcblxuXHRcdG5ld01vZGVsU2VsZWN0aW9uT2ZGZWF0dXJlID0ge1xuXHRcdFx0Li4ubmV3TW9kZWxTZWxlY3Rpb25PZkZlYXR1cmUsXG5cdFx0XHRbZmVhdHVyZU5hbWVdOiBtb2RlbE9wdGlvbnNGb3JUaGlzRmVhdHVyZS5sZW5ndGggPT09IDAgPyBudWxsIDogbW9kZWxPcHRpb25zRm9yVGhpc0ZlYXR1cmVbMF0uc2VsZWN0aW9uXG5cdFx0fVxuXHR9XG5cblxuXHRjb25zdCBuZXdTdGF0ZSA9IHtcblx0XHQuLi5zdGF0ZSxcblx0XHRzZXR0aW5nc09mUHJvdmlkZXI6IG5ld1NldHRpbmdzT2ZQcm92aWRlcixcblx0XHRtb2RlbFNlbGVjdGlvbk9mRmVhdHVyZTogbmV3TW9kZWxTZWxlY3Rpb25PZkZlYXR1cmUsXG5cdFx0b3ZlcnJpZGVzT2ZNb2RlbDogc3RhdGUub3ZlcnJpZGVzT2ZNb2RlbCxcblx0XHRfbW9kZWxPcHRpb25zOiBuZXdNb2RlbE9wdGlvbnMsXG5cdH0gc2F0aXNmaWVzIFZvaWRTZXR0aW5nc1N0YXRlXG5cblx0cmV0dXJuIG5ld1N0YXRlXG59XG5cblxuXG5cblxuY29uc3QgZGVmYXVsdFN0YXRlID0gKCkgPT4ge1xuXHRjb25zdCBkOiBWb2lkU2V0dGluZ3NTdGF0ZSA9IHtcblx0XHRzZXR0aW5nc09mUHJvdmlkZXI6IGRlZXBDbG9uZShkZWZhdWx0U2V0dGluZ3NPZlByb3ZpZGVyKSxcblx0XHRtb2RlbFNlbGVjdGlvbk9mRmVhdHVyZToge1xuXHRcdFx0J0NoYXQnOiB7IHByb3ZpZGVyTmFtZTogJ2dvb2dsZVZlcnRleCcsIG1vZGVsTmFtZTogJ2dlbWluaS0yLjUtZmxhc2gnIH0sXG5cdFx0XHQnQ3RybCtLJzogeyBwcm92aWRlck5hbWU6ICdnb29nbGVWZXJ0ZXgnLCBtb2RlbE5hbWU6ICdnZW1pbmktMi41LWZsYXNoJyB9LFxuXHRcdFx0J0F1dG9jb21wbGV0ZSc6IHsgcHJvdmlkZXJOYW1lOiAnZ29vZ2xlVmVydGV4JywgbW9kZWxOYW1lOiAnZ2VtaW5pLTIuNS1mbGFzaCcgfSxcblx0XHRcdCdBcHBseSc6IHsgcHJvdmlkZXJOYW1lOiAnZ29vZ2xlVmVydGV4JywgbW9kZWxOYW1lOiAnZ2VtaW5pLTIuNS1mbGFzaCcgfSxcblx0XHRcdCdTQ00nOiB7IHByb3ZpZGVyTmFtZTogJ2dvb2dsZVZlcnRleCcsIG1vZGVsTmFtZTogJ2dlbWluaS0yLjUtZmxhc2gnIH0sXG5cdFx0fSxcblx0XHRnbG9iYWxTZXR0aW5nczogZGVlcENsb25lKGRlZmF1bHRHbG9iYWxTZXR0aW5ncyksXG5cdFx0b3B0aW9uc09mTW9kZWxTZWxlY3Rpb246IHsgJ0NoYXQnOiB7fSwgJ0N0cmwrSyc6IHt9LCAnQXV0b2NvbXBsZXRlJzoge30sICdBcHBseSc6IHt9LCAnU0NNJzoge30gfSxcblx0XHRvdmVycmlkZXNPZk1vZGVsOiBkZWVwQ2xvbmUoZGVmYXVsdE92ZXJyaWRlc09mTW9kZWwpLFxuXHRcdF9tb2RlbE9wdGlvbnM6IFtdLCAvLyBjb21wdXRlZCBsYXRlclxuXHRcdG1jcFVzZXJTdGF0ZU9mTmFtZToge30sXG5cdH1cblx0cmV0dXJuIGRcbn1cblxuXG5leHBvcnQgY29uc3QgSVZvaWRTZXR0aW5nc1NlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SVZvaWRTZXR0aW5nc1NlcnZpY2U+KCdWb2lkU2V0dGluZ3NTZXJ2aWNlJyk7XG5jbGFzcyBWb2lkU2V0dGluZ3NTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElWb2lkU2V0dGluZ3NTZXJ2aWNlIHtcblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU3RhdGUgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVN0YXRlOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUuZXZlbnQ7IC8vIHRoaXMgaXMgcHJpbWFyaWx5IGZvciB1c2UgaW4gcmVhY3QsIHNvIHJlYWN0IGNhbiBsaXN0ZW4gKyB1cGRhdGUgb24gc3RhdGUgY2hhbmdlc1xuXG5cdHN0YXRlOiBWb2lkU2V0dGluZ3NTdGF0ZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9yZXNvbHZlcjogKCkgPT4gdm9pZFxuXHR3YWl0Rm9ySW5pdFN0YXRlOiBQcm9taXNlPHZvaWQ+IC8vIGF3YWl0IHRoaXMgaWYgeW91IG5lZWQgYSB2YWxpZCBzdGF0ZSBpbml0aWFsbHlcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3N0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElFbmNyeXB0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lbmNyeXB0aW9uU2VydmljZTogSUVuY3J5cHRpb25TZXJ2aWNlLFxuXHRcdEBJTWV0cmljc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbWV0cmljc1NlcnZpY2U6IElNZXRyaWNzU2VydmljZSxcblx0XHQvLyBjb3VsZCBoYXZlIHVzZWQgdGhpcywgYnV0IGl0J3MgY2xlYXJlciB0aGUgd2F5IGl0IGlzICgrIHNsaWdodGx5IGRpZmZlcmVudCBlZyBTdG9yYWdlVGFyZ2V0LlVTRVIpXG5cdFx0Ly8gQElTZWNyZXRTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9zZWNyZXRTdG9yYWdlU2VydmljZTogSVNlY3JldFN0b3JhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpXG5cblx0XHQvLyBhdCB0aGUgc3RhcnQsIHdlIGhhdmVuJ3QgcmVhZCB0aGUgcGFydGlhbCBjb25maWcgeWV0LCBidXQgd2UgbmVlZCB0byBzZXQgc3RhdGUgdG8gc29tZXRoaW5nXG5cdFx0dGhpcy5zdGF0ZSA9IGRlZmF1bHRTdGF0ZSgpXG5cdFx0bGV0IHJlc29sdmVyOiAoKSA9PiB2b2lkID0gKCkgPT4geyB9XG5cdFx0dGhpcy53YWl0Rm9ySW5pdFN0YXRlID0gbmV3IFByb21pc2UoKHJlcywgcmVqKSA9PiByZXNvbHZlciA9IHJlcylcblx0XHR0aGlzLl9yZXNvbHZlciA9IHJlc29sdmVyXG5cblx0XHR0aGlzLnJlYWRBbmRJbml0aWFsaXplU3RhdGUoKVxuXHR9XG5cblxuXG5cblx0ZGFuZ2Vyb3VzU2V0U3RhdGUgPSBhc3luYyAobmV3U3RhdGU6IFZvaWRTZXR0aW5nc1N0YXRlKSA9PiB7XG5cdFx0dGhpcy5zdGF0ZSA9IF92YWxpZGF0ZWRNb2RlbFN0YXRlKG5ld1N0YXRlKVxuXHRcdGF3YWl0IHRoaXMuX3N0b3JlU3RhdGUoKVxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUuZmlyZSgpXG5cdFx0dGhpcy5fb25VcGRhdGVfc3luY0FwcGx5VG9DaGF0KClcblx0XHR0aGlzLl9vblVwZGF0ZV9zeW5jU0NNVG9DaGF0KClcblx0fVxuXHRhc3luYyByZXNldFN0YXRlKCkge1xuXHRcdGF3YWl0IHRoaXMuZGFuZ2Vyb3VzU2V0U3RhdGUoZGVmYXVsdFN0YXRlKCkpXG5cdH1cblxuXG5cblxuXHRhc3luYyByZWFkQW5kSW5pdGlhbGl6ZVN0YXRlKCkge1xuXHRcdGxldCByZWFkUzogVm9pZFNldHRpbmdzU3RhdGVcblx0XHR0cnkge1xuXHRcdFx0cmVhZFMgPSBhd2FpdCB0aGlzLl9yZWFkU3RhdGUoKTtcblx0XHRcdC8vIDEuMC4zIGFkZGl0aW9uLCByZW1vdmUgd2hlbiBlbm91Z2ggdXNlcnMgaGF2ZSBoYWQgdGhpcyBjb2RlIHJ1blxuXHRcdFx0aWYgKHJlYWRTLmdsb2JhbFNldHRpbmdzLmluY2x1ZGVUb29sTGludEVycm9ycyA9PT0gdW5kZWZpbmVkKSByZWFkUy5nbG9iYWxTZXR0aW5ncy5pbmNsdWRlVG9vbExpbnRFcnJvcnMgPSB0cnVlXG5cblx0XHRcdC8vIGF1dG9hcHByb3ZlIGlzIG5vdyBhbiBvYmogbm90IGEgYm9vbGVhbiAoMS4yLjUpXG5cdFx0XHRpZiAodHlwZW9mIHJlYWRTLmdsb2JhbFNldHRpbmdzLmF1dG9BcHByb3ZlID09PSAnYm9vbGVhbicpIHJlYWRTLmdsb2JhbFNldHRpbmdzLmF1dG9BcHByb3ZlID0ge31cblxuXHRcdFx0Ly8gMS4zLjUgYWRkIHNvdXJjZSBjb250cm9sIGZlYXR1cmVcblx0XHRcdGlmIChyZWFkUy5tb2RlbFNlbGVjdGlvbk9mRmVhdHVyZSAmJiAhcmVhZFMubW9kZWxTZWxlY3Rpb25PZkZlYXR1cmVbJ1NDTSddKSB7XG5cdFx0XHRcdHJlYWRTLm1vZGVsU2VsZWN0aW9uT2ZGZWF0dXJlWydTQ00nXSA9IGRlZXBDbG9uZShyZWFkUy5tb2RlbFNlbGVjdGlvbk9mRmVhdHVyZVsnQ2hhdCddKVxuXHRcdFx0XHRyZWFkUy5vcHRpb25zT2ZNb2RlbFNlbGVjdGlvblsnU0NNJ10gPSBkZWVwQ2xvbmUocmVhZFMub3B0aW9uc09mTW9kZWxTZWxlY3Rpb25bJ0NoYXQnXSlcblx0XHRcdH1cblx0XHRcdC8vIGFkZCBkaXNhYmxlU3lzdGVtTWVzc2FnZSBmZWF0dXJlXG5cdFx0XHRpZiAocmVhZFMuZ2xvYmFsU2V0dGluZ3MuZGlzYWJsZVN5c3RlbU1lc3NhZ2UgPT09IHVuZGVmaW5lZCkgcmVhZFMuZ2xvYmFsU2V0dGluZ3MuZGlzYWJsZVN5c3RlbU1lc3NhZ2UgPSBmYWxzZTtcblx0XHRcdFxuXHRcdFx0Ly8gYWRkIGF1dG9BY2NlcHRMTE1DaGFuZ2VzIGZlYXR1cmVcblx0XHRcdGlmIChyZWFkUy5nbG9iYWxTZXR0aW5ncy5hdXRvQWNjZXB0TExNQ2hhbmdlcyA9PT0gdW5kZWZpbmVkKSByZWFkUy5nbG9iYWxTZXR0aW5ncy5hdXRvQWNjZXB0TExNQ2hhbmdlcyA9IGZhbHNlO1xuXHRcdH1cblx0XHRjYXRjaCAoZSkge1xuXHRcdFx0cmVhZFMgPSBkZWZhdWx0U3RhdGUoKVxuXHRcdH1cblxuXHRcdC8vIHRoZSBzdG9yZWQgZGF0YSBzdHJ1Y3R1cmUgbWlnaHQgYmUgb3V0ZGF0ZWQsIHNvIHdlIG5lZWQgdG8gdXBkYXRlIGl0IGhlcmVcblx0XHR0cnkge1xuXHRcdFx0cmVhZFMgPSB7XG5cdFx0XHRcdC4uLmRlZmF1bHRTdGF0ZSgpLFxuXHRcdFx0XHQuLi5yZWFkUyxcblx0XHRcdFx0Ly8gbm8gaWRlYSB3aHkgdGhpcyB3YXMgaGVyZSwgc2VlbXMgbGlrZSBhIGJ1Z1xuXHRcdFx0XHQvLyAuLi5kZWZhdWx0U2V0dGluZ3NPZlByb3ZpZGVyLFxuXHRcdFx0XHQvLyAuLi5yZWFkUy5zZXR0aW5nc09mUHJvdmlkZXIsXG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3QgcHJvdmlkZXJOYW1lIG9mIHByb3ZpZGVyTmFtZXMpIHtcblx0XHRcdFx0cmVhZFMuc2V0dGluZ3NPZlByb3ZpZGVyW3Byb3ZpZGVyTmFtZV0gPSB7XG5cdFx0XHRcdFx0Li4uZGVmYXVsdFNldHRpbmdzT2ZQcm92aWRlcltwcm92aWRlck5hbWVdLFxuXHRcdFx0XHRcdC4uLnJlYWRTLnNldHRpbmdzT2ZQcm92aWRlcltwcm92aWRlck5hbWVdLFxuXHRcdFx0XHR9IGFzIGFueVxuXG5cdFx0XHRcdC8vIGNvbnZlcnNpb24gZnJvbSAxLjAuMyB0byAxLjIuNSAoY2FuIHJlbW92ZSB0aGlzIHdoZW4gZW5vdWdoIHBlb3BsZSB1cGRhdGUpXG5cdFx0XHRcdGZvciAoY29uc3QgbSBvZiByZWFkUy5zZXR0aW5nc09mUHJvdmlkZXJbcHJvdmlkZXJOYW1lXS5tb2RlbHMpIHtcblx0XHRcdFx0XHRpZiAoIW0udHlwZSkge1xuXHRcdFx0XHRcdFx0Y29uc3Qgb2xkID0gKG0gYXMgeyBpc0F1dG9kZXRlY3RlZD86IGJvb2xlYW47IGlzRGVmYXVsdD86IGJvb2xlYW4gfSlcblx0XHRcdFx0XHRcdGlmIChvbGQuaXNBdXRvZGV0ZWN0ZWQpXG5cdFx0XHRcdFx0XHRcdG0udHlwZSA9ICdhdXRvZGV0ZWN0ZWQnXG5cdFx0XHRcdFx0XHRlbHNlIGlmIChvbGQuaXNEZWZhdWx0KVxuXHRcdFx0XHRcdFx0XHRtLnR5cGUgPSAnZGVmYXVsdCdcblx0XHRcdFx0XHRcdGVsc2UgbS50eXBlID0gJ2N1c3RvbSdcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyByZW1vdmUgd2hlbiBlbm91Z2ggcGVvcGxlIGhhdmUgaGFkIGl0IHJ1biAoZGVmYXVsdCBpcyBub3cge30pXG5cdFx0XHRcdGlmIChwcm92aWRlck5hbWUgPT09ICdvcGVuQUlDb21wYXRpYmxlJyAmJiAhcmVhZFMuc2V0dGluZ3NPZlByb3ZpZGVyW3Byb3ZpZGVyTmFtZV0uaGVhZGVyc0pTT04pIHtcblx0XHRcdFx0XHRyZWFkUy5zZXR0aW5nc09mUHJvdmlkZXJbcHJvdmlkZXJOYW1lXS5oZWFkZXJzSlNPTiA9ICd7fSdcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNhdGNoIChlKSB7XG5cdFx0XHRyZWFkUyA9IGRlZmF1bHRTdGF0ZSgpXG5cdFx0fVxuXG5cdFx0dGhpcy5zdGF0ZSA9IHJlYWRTXG5cdFx0dGhpcy5zdGF0ZSA9IF9zdGF0ZVdpdGhNZXJnZWREZWZhdWx0TW9kZWxzKHRoaXMuc3RhdGUpXG5cdFx0dGhpcy5zdGF0ZSA9IF92YWxpZGF0ZWRNb2RlbFN0YXRlKHRoaXMuc3RhdGUpO1xuXG5cdFx0Ly8gQWx3YXlzIHVzZSBnZW1pbmktMi41LWZsYXNoIG9uIFZlcnRleCBcdTIwMTQgbG9jayBwcm92aWRlciBhbmQgbW9kZWwgcmVnYXJkbGVzcyBvZiBzYXZlZCBzdGF0ZVxuXHRcdGNvbnN0IHZvbHREZWZhdWx0TW9kZWwgPSB7IHByb3ZpZGVyTmFtZTogJ2dvb2dsZVZlcnRleCcgYXMgY29uc3QsIG1vZGVsTmFtZTogJ2dlbWluaS0yLjUtZmxhc2gnIH07XG5cdFx0Zm9yIChjb25zdCBmIG9mIChbJ0NoYXQnLCAnQ3RybCtLJywgJ0F1dG9jb21wbGV0ZScsICdBcHBseScsICdTQ00nXSBhcyBjb25zdCkpIHtcblx0XHRcdHRoaXMuc3RhdGUubW9kZWxTZWxlY3Rpb25PZkZlYXR1cmVbZl0gPSB7IC4uLnZvbHREZWZhdWx0TW9kZWwgfTtcblx0XHR9XG5cdFx0Ly8gU2V0IGRlZmF1bHQgVmVydGV4IHByb2plY3QvcmVnaW9uXG5cdFx0aWYgKCF0aGlzLnN0YXRlLnNldHRpbmdzT2ZQcm92aWRlci5nb29nbGVWZXJ0ZXgucHJvamVjdCkge1xuXHRcdFx0dGhpcy5zdGF0ZS5zZXR0aW5nc09mUHJvdmlkZXIuZ29vZ2xlVmVydGV4LnByb2plY3QgPSAndmlkZW9nZW4tNDk2NTA2Jztcblx0XHR9XG5cdFx0aWYgKCF0aGlzLnN0YXRlLnNldHRpbmdzT2ZQcm92aWRlci5nb29nbGVWZXJ0ZXgucmVnaW9uKSB7XG5cdFx0XHR0aGlzLnN0YXRlLnNldHRpbmdzT2ZQcm92aWRlci5nb29nbGVWZXJ0ZXgucmVnaW9uID0gJ3VzLWNlbnRyYWwxJztcblx0XHR9XG5cblxuXHRcdHRoaXMuX3Jlc29sdmVyKCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKCk7XG5cblx0fVxuXG5cblx0cHJpdmF0ZSBhc3luYyBfcmVhZFN0YXRlKCk6IFByb21pc2U8Vm9pZFNldHRpbmdzU3RhdGU+IHtcblx0XHRjb25zdCBlbmNyeXB0ZWRTdGF0ZSA9IHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmdldChWT0lEX1NFVFRJTkdTX1NUT1JBR0VfS0VZLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pXG5cblx0XHRpZiAoIWVuY3J5cHRlZFN0YXRlKVxuXHRcdFx0cmV0dXJuIGRlZmF1bHRTdGF0ZSgpXG5cblx0XHRjb25zdCBzdGF0ZVN0ciA9IGF3YWl0IHRoaXMuX2VuY3J5cHRpb25TZXJ2aWNlLmRlY3J5cHQoZW5jcnlwdGVkU3RhdGUpXG5cdFx0Y29uc3Qgc3RhdGUgPSBKU09OLnBhcnNlKHN0YXRlU3RyKVxuXHRcdHJldHVybiBzdGF0ZVxuXHR9XG5cblxuXHRwcml2YXRlIGFzeW5jIF9zdG9yZVN0YXRlKCkge1xuXHRcdGNvbnN0IHN0YXRlID0gdGhpcy5zdGF0ZVxuXHRcdGNvbnN0IGVuY3J5cHRlZFN0YXRlID0gYXdhaXQgdGhpcy5fZW5jcnlwdGlvblNlcnZpY2UuZW5jcnlwdChKU09OLnN0cmluZ2lmeShzdGF0ZSkpXG5cdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2Uuc3RvcmUoVk9JRF9TRVRUSU5HU19TVE9SQUdFX0tFWSwgZW5jcnlwdGVkU3RhdGUsIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0fVxuXG5cdHNldFNldHRpbmdPZlByb3ZpZGVyOiBTZXRTZXR0aW5nT2ZQcm92aWRlckZuID0gYXN5bmMgKHByb3ZpZGVyTmFtZSwgc2V0dGluZ05hbWUsIG5ld1ZhbCkgPT4ge1xuXG5cdFx0Y29uc3QgbmV3TW9kZWxTZWxlY3Rpb25PZkZlYXR1cmUgPSB0aGlzLnN0YXRlLm1vZGVsU2VsZWN0aW9uT2ZGZWF0dXJlXG5cblx0XHRjb25zdCBuZXdPcHRpb25zT2ZNb2RlbFNlbGVjdGlvbiA9IHRoaXMuc3RhdGUub3B0aW9uc09mTW9kZWxTZWxlY3Rpb25cblxuXHRcdGNvbnN0IG5ld1NldHRpbmdzT2ZQcm92aWRlcjogU2V0dGluZ3NPZlByb3ZpZGVyID0ge1xuXHRcdFx0Li4udGhpcy5zdGF0ZS5zZXR0aW5nc09mUHJvdmlkZXIsXG5cdFx0XHRbcHJvdmlkZXJOYW1lXToge1xuXHRcdFx0XHQuLi50aGlzLnN0YXRlLnNldHRpbmdzT2ZQcm92aWRlcltwcm92aWRlck5hbWVdLFxuXHRcdFx0XHRbc2V0dGluZ05hbWVdOiBuZXdWYWwsXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgbmV3R2xvYmFsU2V0dGluZ3MgPSB0aGlzLnN0YXRlLmdsb2JhbFNldHRpbmdzXG5cdFx0Y29uc3QgbmV3T3ZlcnJpZGVzT2ZNb2RlbCA9IHRoaXMuc3RhdGUub3ZlcnJpZGVzT2ZNb2RlbFxuXHRcdGNvbnN0IG5ld01DUFVzZXJTdGF0ZU9mTmFtZSA9IHRoaXMuc3RhdGUubWNwVXNlclN0YXRlT2ZOYW1lXG5cblx0XHRjb25zdCBuZXdTdGF0ZSA9IHtcblx0XHRcdG1vZGVsU2VsZWN0aW9uT2ZGZWF0dXJlOiBuZXdNb2RlbFNlbGVjdGlvbk9mRmVhdHVyZSxcblx0XHRcdG9wdGlvbnNPZk1vZGVsU2VsZWN0aW9uOiBuZXdPcHRpb25zT2ZNb2RlbFNlbGVjdGlvbixcblx0XHRcdHNldHRpbmdzT2ZQcm92aWRlcjogbmV3U2V0dGluZ3NPZlByb3ZpZGVyLFxuXHRcdFx0Z2xvYmFsU2V0dGluZ3M6IG5ld0dsb2JhbFNldHRpbmdzLFxuXHRcdFx0b3ZlcnJpZGVzT2ZNb2RlbDogbmV3T3ZlcnJpZGVzT2ZNb2RlbCxcblx0XHRcdG1jcFVzZXJTdGF0ZU9mTmFtZTogbmV3TUNQVXNlclN0YXRlT2ZOYW1lLFxuXHRcdH1cblxuXHRcdHRoaXMuc3RhdGUgPSBfdmFsaWRhdGVkTW9kZWxTdGF0ZShuZXdTdGF0ZSlcblxuXHRcdGF3YWl0IHRoaXMuX3N0b3JlU3RhdGUoKVxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUuZmlyZSgpXG5cblx0fVxuXG5cblx0cHJpdmF0ZSBfb25VcGRhdGVfc3luY0FwcGx5VG9DaGF0KCkge1xuXHRcdC8vIGlmIHN5bmMgaXMgdHVybmVkIG9uLCBzeW5jIChjYWxsIHRoaXMgd2hlbmV2ZXIgQ2hhdCBtb2RlbCBvciAhIXN5bmMgY2hhbmdlcylcblx0XHR0aGlzLnNldE1vZGVsU2VsZWN0aW9uT2ZGZWF0dXJlKCdBcHBseScsIGRlZXBDbG9uZSh0aGlzLnN0YXRlLm1vZGVsU2VsZWN0aW9uT2ZGZWF0dXJlWydDaGF0J10pKVxuXHR9XG5cblx0cHJpdmF0ZSBfb25VcGRhdGVfc3luY1NDTVRvQ2hhdCgpIHtcblx0XHR0aGlzLnNldE1vZGVsU2VsZWN0aW9uT2ZGZWF0dXJlKCdTQ00nLCBkZWVwQ2xvbmUodGhpcy5zdGF0ZS5tb2RlbFNlbGVjdGlvbk9mRmVhdHVyZVsnQ2hhdCddKSlcblx0fVxuXG5cdHNldEdsb2JhbFNldHRpbmc6IFNldEdsb2JhbFNldHRpbmdGbiA9IGFzeW5jIChzZXR0aW5nTmFtZSwgbmV3VmFsKSA9PiB7XG5cdFx0Y29uc3QgbmV3U3RhdGU6IFZvaWRTZXR0aW5nc1N0YXRlID0ge1xuXHRcdFx0Li4udGhpcy5zdGF0ZSxcblx0XHRcdGdsb2JhbFNldHRpbmdzOiB7XG5cdFx0XHRcdC4uLnRoaXMuc3RhdGUuZ2xvYmFsU2V0dGluZ3MsXG5cdFx0XHRcdFtzZXR0aW5nTmFtZV06IG5ld1ZhbFxuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLnN0YXRlID0gX3ZhbGlkYXRlZE1vZGVsU3RhdGUobmV3U3RhdGUpXG5cdFx0YXdhaXQgdGhpcy5fc3RvcmVTdGF0ZSgpXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKClcblxuXHRcdC8vIGhvb2tzXG5cdFx0aWYgKHRoaXMuc3RhdGUuZ2xvYmFsU2V0dGluZ3Muc3luY0FwcGx5VG9DaGF0KSB0aGlzLl9vblVwZGF0ZV9zeW5jQXBwbHlUb0NoYXQoKVxuXHRcdGlmICh0aGlzLnN0YXRlLmdsb2JhbFNldHRpbmdzLnN5bmNTQ01Ub0NoYXQpIHRoaXMuX29uVXBkYXRlX3N5bmNTQ01Ub0NoYXQoKVxuXG5cdH1cblxuXG5cdHNldE1vZGVsU2VsZWN0aW9uT2ZGZWF0dXJlOiBTZXRNb2RlbFNlbGVjdGlvbk9mRmVhdHVyZUZuID0gYXN5bmMgKGZlYXR1cmVOYW1lLCBuZXdWYWwpID0+IHtcblx0XHRjb25zdCBuZXdTdGF0ZTogVm9pZFNldHRpbmdzU3RhdGUgPSB7XG5cdFx0XHQuLi50aGlzLnN0YXRlLFxuXHRcdFx0bW9kZWxTZWxlY3Rpb25PZkZlYXR1cmU6IHtcblx0XHRcdFx0Li4udGhpcy5zdGF0ZS5tb2RlbFNlbGVjdGlvbk9mRmVhdHVyZSxcblx0XHRcdFx0W2ZlYXR1cmVOYW1lXTogbmV3VmFsXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5zdGF0ZSA9IF92YWxpZGF0ZWRNb2RlbFN0YXRlKG5ld1N0YXRlKVxuXG5cdFx0YXdhaXQgdGhpcy5fc3RvcmVTdGF0ZSgpXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKClcblxuXHRcdC8vIGhvb2tzXG5cdFx0aWYgKGZlYXR1cmVOYW1lID09PSAnQ2hhdCcpIHtcblx0XHRcdC8vIFdoZW4gQ2hhdCBtb2RlbCBjaGFuZ2VzLCB1cGRhdGUgc3luY2VkIGZlYXR1cmVzXG5cdFx0XHR0aGlzLl9vblVwZGF0ZV9zeW5jQXBwbHlUb0NoYXQoKVxuXHRcdFx0dGhpcy5fb25VcGRhdGVfc3luY1NDTVRvQ2hhdCgpXG5cdFx0fVxuXHR9XG5cblxuXHRzZXRPcHRpb25zT2ZNb2RlbFNlbGVjdGlvbiA9IGFzeW5jIChmZWF0dXJlTmFtZTogRmVhdHVyZU5hbWUsIHByb3ZpZGVyTmFtZTogUHJvdmlkZXJOYW1lLCBtb2RlbE5hbWU6IHN0cmluZywgbmV3VmFsOiBQYXJ0aWFsPE1vZGVsU2VsZWN0aW9uT3B0aW9ucz4pID0+IHtcblx0XHRjb25zdCBuZXdTdGF0ZTogVm9pZFNldHRpbmdzU3RhdGUgPSB7XG5cdFx0XHQuLi50aGlzLnN0YXRlLFxuXHRcdFx0b3B0aW9uc09mTW9kZWxTZWxlY3Rpb246IHtcblx0XHRcdFx0Li4udGhpcy5zdGF0ZS5vcHRpb25zT2ZNb2RlbFNlbGVjdGlvbixcblx0XHRcdFx0W2ZlYXR1cmVOYW1lXToge1xuXHRcdFx0XHRcdC4uLnRoaXMuc3RhdGUub3B0aW9uc09mTW9kZWxTZWxlY3Rpb25bZmVhdHVyZU5hbWVdLFxuXHRcdFx0XHRcdFtwcm92aWRlck5hbWVdOiB7XG5cdFx0XHRcdFx0XHQuLi50aGlzLnN0YXRlLm9wdGlvbnNPZk1vZGVsU2VsZWN0aW9uW2ZlYXR1cmVOYW1lXVtwcm92aWRlck5hbWVdLFxuXHRcdFx0XHRcdFx0W21vZGVsTmFtZV06IHtcblx0XHRcdFx0XHRcdFx0Li4udGhpcy5zdGF0ZS5vcHRpb25zT2ZNb2RlbFNlbGVjdGlvbltmZWF0dXJlTmFtZV1bcHJvdmlkZXJOYW1lXT8uW21vZGVsTmFtZV0sXG5cdFx0XHRcdFx0XHRcdC4uLm5ld1ZhbFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLnN0YXRlID0gX3ZhbGlkYXRlZE1vZGVsU3RhdGUobmV3U3RhdGUpXG5cblx0XHRhd2FpdCB0aGlzLl9zdG9yZVN0YXRlKClcblx0XHR0aGlzLl9vbkRpZENoYW5nZVN0YXRlLmZpcmUoKVxuXHR9XG5cblx0c2V0T3ZlcnJpZGVzT2ZNb2RlbCA9IGFzeW5jIChwcm92aWRlck5hbWU6IFByb3ZpZGVyTmFtZSwgbW9kZWxOYW1lOiBzdHJpbmcsIG92ZXJyaWRlczogUGFydGlhbDxNb2RlbE92ZXJyaWRlcz4gfCB1bmRlZmluZWQpID0+IHtcblx0XHRjb25zdCBuZXdTdGF0ZTogVm9pZFNldHRpbmdzU3RhdGUgPSB7XG5cdFx0XHQuLi50aGlzLnN0YXRlLFxuXHRcdFx0b3ZlcnJpZGVzT2ZNb2RlbDoge1xuXHRcdFx0XHQuLi50aGlzLnN0YXRlLm92ZXJyaWRlc09mTW9kZWwsXG5cdFx0XHRcdFtwcm92aWRlck5hbWVdOiB7XG5cdFx0XHRcdFx0Li4udGhpcy5zdGF0ZS5vdmVycmlkZXNPZk1vZGVsW3Byb3ZpZGVyTmFtZV0sXG5cdFx0XHRcdFx0W21vZGVsTmFtZV06IG92ZXJyaWRlcyA9PT0gdW5kZWZpbmVkID8gdW5kZWZpbmVkIDoge1xuXHRcdFx0XHRcdFx0Li4udGhpcy5zdGF0ZS5vdmVycmlkZXNPZk1vZGVsW3Byb3ZpZGVyTmFtZV1bbW9kZWxOYW1lXSxcblx0XHRcdFx0XHRcdC4uLm92ZXJyaWRlc1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0dGhpcy5zdGF0ZSA9IF92YWxpZGF0ZWRNb2RlbFN0YXRlKG5ld1N0YXRlKTtcblx0XHRhd2FpdCB0aGlzLl9zdG9yZVN0YXRlKCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKCk7XG5cblx0XHR0aGlzLl9tZXRyaWNzU2VydmljZS5jYXB0dXJlKCdVcGRhdGUgTW9kZWwgT3ZlcnJpZGVzJywgeyBwcm92aWRlck5hbWUsIG1vZGVsTmFtZSwgb3ZlcnJpZGVzIH0pO1xuXHR9XG5cblxuXG5cblx0c2V0QXV0b2RldGVjdGVkTW9kZWxzKHByb3ZpZGVyTmFtZTogUHJvdmlkZXJOYW1lLCBhdXRvZGV0ZWN0ZWRNb2RlbE5hbWVzOiBzdHJpbmdbXSwgbG9nZ2luZzogb2JqZWN0KSB7XG5cblx0XHRjb25zdCB7IG1vZGVscyB9ID0gdGhpcy5zdGF0ZS5zZXR0aW5nc09mUHJvdmlkZXJbcHJvdmlkZXJOYW1lXVxuXHRcdGNvbnN0IG9sZE1vZGVsTmFtZXMgPSBtb2RlbHMubWFwKG0gPT4gbS5tb2RlbE5hbWUpXG5cblx0XHRjb25zdCBuZXdNb2RlbHMgPSBfbW9kZWxzV2l0aFN3YXBwZWRJbk5ld01vZGVscyh7IGV4aXN0aW5nTW9kZWxzOiBtb2RlbHMsIG1vZGVsczogYXV0b2RldGVjdGVkTW9kZWxOYW1lcywgdHlwZTogJ2F1dG9kZXRlY3RlZCcgfSlcblx0XHR0aGlzLnNldFNldHRpbmdPZlByb3ZpZGVyKHByb3ZpZGVyTmFtZSwgJ21vZGVscycsIG5ld01vZGVscylcblxuXHRcdC8vIGlmIHRoZSBtb2RlbHMgY2hhbmdlZCwgbG9nIGl0XG5cdFx0Y29uc3QgbmV3X25hbWVzID0gbmV3TW9kZWxzLm1hcChtID0+IG0ubW9kZWxOYW1lKVxuXHRcdGlmICghKG9sZE1vZGVsTmFtZXMubGVuZ3RoID09PSBuZXdfbmFtZXMubGVuZ3RoXG5cdFx0XHQmJiBvbGRNb2RlbE5hbWVzLmV2ZXJ5KChfLCBpKSA9PiBvbGRNb2RlbE5hbWVzW2ldID09PSBuZXdfbmFtZXNbaV0pKVxuXHRcdCkge1xuXHRcdFx0dGhpcy5fbWV0cmljc1NlcnZpY2UuY2FwdHVyZSgnQXV0b2RldGVjdCBNb2RlbHMnLCB7IHByb3ZpZGVyTmFtZSwgbmV3TW9kZWxzOiBuZXdNb2RlbHMsIC4uLmxvZ2dpbmcgfSlcblx0XHR9XG5cdH1cblx0dG9nZ2xlTW9kZWxIaWRkZW4ocHJvdmlkZXJOYW1lOiBQcm92aWRlck5hbWUsIG1vZGVsTmFtZTogc3RyaW5nKSB7XG5cblxuXHRcdGNvbnN0IHsgbW9kZWxzIH0gPSB0aGlzLnN0YXRlLnNldHRpbmdzT2ZQcm92aWRlcltwcm92aWRlck5hbWVdXG5cdFx0Y29uc3QgbW9kZWxJZHggPSBtb2RlbHMuZmluZEluZGV4KG0gPT4gbS5tb2RlbE5hbWUgPT09IG1vZGVsTmFtZSlcblx0XHRpZiAobW9kZWxJZHggPT09IC0xKSByZXR1cm5cblx0XHRjb25zdCBuZXdJc0hpZGRlbiA9ICFtb2RlbHNbbW9kZWxJZHhdLmlzSGlkZGVuXG5cdFx0Y29uc3QgbmV3TW9kZWxzOiBWb2lkU3RhdGVmdWxNb2RlbEluZm9bXSA9IFtcblx0XHRcdC4uLm1vZGVscy5zbGljZSgwLCBtb2RlbElkeCksXG5cdFx0XHR7IC4uLm1vZGVsc1ttb2RlbElkeF0sIGlzSGlkZGVuOiBuZXdJc0hpZGRlbiB9LFxuXHRcdFx0Li4ubW9kZWxzLnNsaWNlKG1vZGVsSWR4ICsgMSwgSW5maW5pdHkpXG5cdFx0XVxuXHRcdHRoaXMuc2V0U2V0dGluZ09mUHJvdmlkZXIocHJvdmlkZXJOYW1lLCAnbW9kZWxzJywgbmV3TW9kZWxzKVxuXG5cdFx0dGhpcy5fbWV0cmljc1NlcnZpY2UuY2FwdHVyZSgnVG9nZ2xlIE1vZGVsIEhpZGRlbicsIHsgcHJvdmlkZXJOYW1lLCBtb2RlbE5hbWUsIG5ld0lzSGlkZGVuIH0pXG5cblx0fVxuXHRhZGRNb2RlbChwcm92aWRlck5hbWU6IFByb3ZpZGVyTmFtZSwgbW9kZWxOYW1lOiBzdHJpbmcpIHtcblx0XHRjb25zdCB7IG1vZGVscyB9ID0gdGhpcy5zdGF0ZS5zZXR0aW5nc09mUHJvdmlkZXJbcHJvdmlkZXJOYW1lXVxuXHRcdGNvbnN0IGV4aXN0aW5nSWR4ID0gbW9kZWxzLmZpbmRJbmRleChtID0+IG0ubW9kZWxOYW1lID09PSBtb2RlbE5hbWUpXG5cdFx0aWYgKGV4aXN0aW5nSWR4ICE9PSAtMSkgcmV0dXJuIC8vIGlmIGV4aXN0cywgZG8gbm90aGluZ1xuXHRcdGNvbnN0IG5ld01vZGVscyA9IFtcblx0XHRcdC4uLm1vZGVscyxcblx0XHRcdHsgbW9kZWxOYW1lLCB0eXBlOiAnY3VzdG9tJywgaXNIaWRkZW46IGZhbHNlIH0gYXMgY29uc3Rcblx0XHRdXG5cdFx0dGhpcy5zZXRTZXR0aW5nT2ZQcm92aWRlcihwcm92aWRlck5hbWUsICdtb2RlbHMnLCBuZXdNb2RlbHMpXG5cblx0XHR0aGlzLl9tZXRyaWNzU2VydmljZS5jYXB0dXJlKCdBZGQgTW9kZWwnLCB7IHByb3ZpZGVyTmFtZSwgbW9kZWxOYW1lIH0pXG5cblx0fVxuXHRkZWxldGVNb2RlbChwcm92aWRlck5hbWU6IFByb3ZpZGVyTmFtZSwgbW9kZWxOYW1lOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRjb25zdCB7IG1vZGVscyB9ID0gdGhpcy5zdGF0ZS5zZXR0aW5nc09mUHJvdmlkZXJbcHJvdmlkZXJOYW1lXVxuXHRcdGNvbnN0IGRlbElkeCA9IG1vZGVscy5maW5kSW5kZXgobSA9PiBtLm1vZGVsTmFtZSA9PT0gbW9kZWxOYW1lKVxuXHRcdGlmIChkZWxJZHggPT09IC0xKSByZXR1cm4gZmFsc2Vcblx0XHRjb25zdCBuZXdNb2RlbHMgPSBbXG5cdFx0XHQuLi5tb2RlbHMuc2xpY2UoMCwgZGVsSWR4KSwgLy8gZGVsZXRlIHRoZSBpZHhcblx0XHRcdC4uLm1vZGVscy5zbGljZShkZWxJZHggKyAxLCBJbmZpbml0eSlcblx0XHRdXG5cdFx0dGhpcy5zZXRTZXR0aW5nT2ZQcm92aWRlcihwcm92aWRlck5hbWUsICdtb2RlbHMnLCBuZXdNb2RlbHMpXG5cblx0XHR0aGlzLl9tZXRyaWNzU2VydmljZS5jYXB0dXJlKCdEZWxldGUgTW9kZWwnLCB7IHByb3ZpZGVyTmFtZSwgbW9kZWxOYW1lIH0pXG5cblx0XHRyZXR1cm4gdHJ1ZVxuXHR9XG5cblx0Ly8gTUNQIFNlcnZlciBTdGF0ZVxuXHRwcml2YXRlIF9zZXRNQ1BVc2VyU3RhdGVPZk5hbWUgPSBhc3luYyAobmV3U3RhdGVzOiBNQ1BVc2VyU3RhdGVPZk5hbWUpID0+IHtcblx0XHRjb25zdCBuZXdTdGF0ZTogVm9pZFNldHRpbmdzU3RhdGUgPSB7XG5cdFx0XHQuLi50aGlzLnN0YXRlLFxuXHRcdFx0bWNwVXNlclN0YXRlT2ZOYW1lOiB7XG5cdFx0XHRcdC4uLnRoaXMuc3RhdGUubWNwVXNlclN0YXRlT2ZOYW1lLFxuXHRcdFx0XHQuLi5uZXdTdGF0ZXNcblx0XHRcdH1cblx0XHR9O1xuXHRcdHRoaXMuc3RhdGUgPSBfdmFsaWRhdGVkTW9kZWxTdGF0ZShuZXdTdGF0ZSk7XG5cdFx0YXdhaXQgdGhpcy5fc3RvcmVTdGF0ZSgpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlU3RhdGUuZmlyZSgpO1xuXHRcdHRoaXMuX21ldHJpY3NTZXJ2aWNlLmNhcHR1cmUoJ1NldCBNQ1AgU2VydmVyIFN0YXRlcycsIHsgbmV3U3RhdGVzIH0pO1xuXHR9XG5cblx0YWRkTUNQVXNlclN0YXRlT2ZOYW1lcyA9IGFzeW5jIChuZXdNQ1BTdGF0ZXM6IE1DUFVzZXJTdGF0ZU9mTmFtZSkgPT4ge1xuXHRcdGNvbnN0IHsgbWNwVXNlclN0YXRlT2ZOYW1lOiBtY3BTZXJ2ZXJTdGF0ZXMgfSA9IHRoaXMuc3RhdGVcblx0XHRjb25zdCBuZXdNQ1BTZXJ2ZXJTdGF0ZXMgPSB7XG5cdFx0XHQuLi5tY3BTZXJ2ZXJTdGF0ZXMsXG5cdFx0XHQuLi5uZXdNQ1BTdGF0ZXMsXG5cdFx0fVxuXHRcdGF3YWl0IHRoaXMuX3NldE1DUFVzZXJTdGF0ZU9mTmFtZShuZXdNQ1BTZXJ2ZXJTdGF0ZXMpXG5cdFx0dGhpcy5fbWV0cmljc1NlcnZpY2UuY2FwdHVyZSgnQWRkIE1DUCBTZXJ2ZXJzJywgeyBzZXJ2ZXJzOiBPYmplY3Qua2V5cyhuZXdNQ1BTdGF0ZXMpLmpvaW4oJywgJykgfSk7XG5cdH1cblxuXHRyZW1vdmVNQ1BVc2VyU3RhdGVPZk5hbWVzID0gYXN5bmMgKHNlcnZlck5hbWVzOiBzdHJpbmdbXSkgPT4ge1xuXHRcdGNvbnN0IHsgbWNwVXNlclN0YXRlT2ZOYW1lOiBtY3BTZXJ2ZXJTdGF0ZXMgfSA9IHRoaXMuc3RhdGVcblx0XHRjb25zdCBuZXdNQ1BTZXJ2ZXJTdGF0ZXMgPSB7XG5cdFx0XHQuLi5tY3BTZXJ2ZXJTdGF0ZXMsXG5cdFx0fVxuXHRcdHNlcnZlck5hbWVzLmZvckVhY2goc2VydmVyTmFtZSA9PiB7XG5cdFx0XHRpZiAoc2VydmVyTmFtZSBpbiBuZXdNQ1BTZXJ2ZXJTdGF0ZXMpIHtcblx0XHRcdFx0ZGVsZXRlIG5ld01DUFNlcnZlclN0YXRlc1tzZXJ2ZXJOYW1lXVxuXHRcdFx0fVxuXHRcdH0pXG5cdFx0YXdhaXQgdGhpcy5fc2V0TUNQVXNlclN0YXRlT2ZOYW1lKG5ld01DUFNlcnZlclN0YXRlcylcblx0XHR0aGlzLl9tZXRyaWNzU2VydmljZS5jYXB0dXJlKCdSZW1vdmUgTUNQIFNlcnZlcnMnLCB7IHNlcnZlcnM6IHNlcnZlck5hbWVzLmpvaW4oJywgJykgfSk7XG5cdH1cblxuXHRzZXRNQ1BTZXJ2ZXJTdGF0ZSA9IGFzeW5jIChzZXJ2ZXJOYW1lOiBzdHJpbmcsIHN0YXRlOiBNQ1BVc2VyU3RhdGUpID0+IHtcblx0XHRjb25zdCB7IG1jcFVzZXJTdGF0ZU9mTmFtZSB9ID0gdGhpcy5zdGF0ZVxuXHRcdGNvbnN0IG5ld01DUFNlcnZlclN0YXRlcyA9IHtcblx0XHRcdC4uLm1jcFVzZXJTdGF0ZU9mTmFtZSxcblx0XHRcdFtzZXJ2ZXJOYW1lXTogc3RhdGUsXG5cdFx0fVxuXHRcdGF3YWl0IHRoaXMuX3NldE1DUFVzZXJTdGF0ZU9mTmFtZShuZXdNQ1BTZXJ2ZXJTdGF0ZXMpXG5cdFx0dGhpcy5fbWV0cmljc1NlcnZpY2UuY2FwdHVyZSgnVXBkYXRlIE1DUCBTZXJ2ZXIgU3RhdGUnLCB7IHNlcnZlck5hbWUsIHN0YXRlIH0pO1xuXHR9XG5cbn1cblxuXG5yZWdpc3RlclNpbmdsZXRvbihJVm9pZFNldHRpbmdzU2VydmljZSwgVm9pZFNldHRpbmdzU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGVBQXNCO0FBQy9CLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsbUJBQW1CLHlCQUF5QjtBQUNyRCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGlCQUFpQixjQUFjLHFCQUFxQjtBQUM3RCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5Qiw0QkFBNEM7QUFDOUUsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUywyQkFBZ0gsZUFBK0Isc0JBQXNCLGNBQXdFLHVCQUFtRywrQkFBdUY7QUF1RWhiLE1BQU0sZ0NBQWdDLENBQUMsWUFBNkc7QUFDbkosUUFBTSxFQUFFLGdCQUFnQixRQUFRLEtBQUssSUFBSTtBQUV6QyxRQUFNLG9CQUEyRCxDQUFDO0FBQ2xFLGFBQVcsaUJBQWlCLGdCQUFnQjtBQUMzQyxzQkFBa0IsY0FBYyxTQUFTLElBQUk7QUFBQSxFQUM5QztBQUVBLFFBQU0sbUJBQW1CLE9BQU8sSUFBSSxDQUFDLFdBQVcsT0FBTyxFQUFFLFdBQVcsTUFBTSxVQUFVLENBQUMsQ0FBQyxrQkFBa0IsU0FBUyxHQUFHLFNBQVUsRUFBRTtBQUVoSSxTQUFPO0FBQUEsSUFDTixHQUFHO0FBQUE7QUFBQSxJQUNILEdBQUcsZUFBZSxPQUFPLE9BQUs7QUFDN0IsWUFBTSxPQUFPLEVBQUUsU0FBUztBQUN4QixhQUFPO0FBQUEsSUFDUixDQUFDO0FBQUEsRUFDRjtBQUNEO0FBR08sTUFBTSwyQkFPTjtBQUFBLEVBQ04sZ0JBQWdCLEVBQUUsUUFB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
