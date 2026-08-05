import * as arrays from "../../../base/common/arrays.js";
import { Emitter, Event } from "../../../base/common/event.js";
import * as json from "../../../base/common/json.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { getOrSet, ResourceMap } from "../../../base/common/map.js";
import * as objects from "../../../base/common/objects.js";
import * as types from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { addToValueTree, getConfigurationValue, removeFromValueTree, toValuesTree } from "./configuration.js";
import { ConfigurationScope, Extensions, overrideIdentifiersFromKey, OVERRIDE_PROPERTY_REGEX } from "./configurationRegistry.js";
import { FileOperation } from "../../files/common/files.js";
import { Registry } from "../../registry/common/platform.js";
function freeze(data) {
  return Object.isFrozen(data) ? data : objects.deepFreeze(data);
}
class ConfigurationModel {
  constructor(_contents, _keys, _overrides, raw, logService) {
    this._contents = _contents;
    this._keys = _keys;
    this._overrides = _overrides;
    this.raw = raw;
    this.logService = logService;
    this.overrideConfigurations = /* @__PURE__ */ new Map();
  }
  static createEmptyModel(logService) {
    return new ConfigurationModel({}, [], [], void 0, logService);
  }
  get rawConfiguration() {
    if (!this._rawConfiguration) {
      if (this.raw) {
        const rawConfigurationModels = (Array.isArray(this.raw) ? this.raw : [this.raw]).map((raw) => {
          if (raw instanceof ConfigurationModel) {
            return raw;
          }
          const parser = new ConfigurationModelParser("", this.logService);
          parser.parseRaw(raw);
          return parser.configurationModel;
        });
        this._rawConfiguration = rawConfigurationModels.reduce((previous, current) => current === previous ? current : previous.merge(current), rawConfigurationModels[0]);
      } else {
        this._rawConfiguration = this;
      }
    }
    return this._rawConfiguration;
  }
  get contents() {
    return this._contents;
  }
  get overrides() {
    return this._overrides;
  }
  get keys() {
    return this._keys;
  }
  isEmpty() {
    return this._keys.length === 0 && Object.keys(this._contents).length === 0 && this._overrides.length === 0;
  }
  getValue(section) {
    return section ? getConfigurationValue(this.contents, section) : this.contents;
  }
  inspect(section, overrideIdentifier) {
    const that = this;
    return {
      get value() {
        return freeze(that.rawConfiguration.getValue(section));
      },
      get override() {
        return overrideIdentifier ? freeze(that.rawConfiguration.getOverrideValue(section, overrideIdentifier)) : void 0;
      },
      get merged() {
        return freeze(overrideIdentifier ? that.rawConfiguration.override(overrideIdentifier).getValue(section) : that.rawConfiguration.getValue(section));
      },
      get overrides() {
        const overrides = [];
        for (const { contents, identifiers, keys } of that.rawConfiguration.overrides) {
          const value = new ConfigurationModel(contents, keys, [], void 0, that.logService).getValue(section);
          if (value !== void 0) {
            overrides.push({ identifiers, value });
          }
        }
        return overrides.length ? freeze(overrides) : void 0;
      }
    };
  }
  getOverrideValue(section, overrideIdentifier) {
    const overrideContents = this.getContentsForOverrideIdentifer(overrideIdentifier);
    return overrideContents ? section ? getConfigurationValue(overrideContents, section) : overrideContents : void 0;
  }
  getKeysForOverrideIdentifier(identifier) {
    const keys = [];
    for (const override of this.overrides) {
      if (override.identifiers.includes(identifier)) {
        keys.push(...override.keys);
      }
    }
    return arrays.distinct(keys);
  }
  getAllOverrideIdentifiers() {
    const result = [];
    for (const override of this.overrides) {
      result.push(...override.identifiers);
    }
    return arrays.distinct(result);
  }
  override(identifier) {
    let overrideConfigurationModel = this.overrideConfigurations.get(identifier);
    if (!overrideConfigurationModel) {
      overrideConfigurationModel = this.createOverrideConfigurationModel(identifier);
      this.overrideConfigurations.set(identifier, overrideConfigurationModel);
    }
    return overrideConfigurationModel;
  }
  merge(...others) {
    const contents = objects.deepClone(this.contents);
    const overrides = objects.deepClone(this.overrides);
    const keys = [...this.keys];
    const raws = this.raw ? Array.isArray(this.raw) ? [...this.raw] : [this.raw] : [this];
    for (const other of others) {
      raws.push(...other.raw ? Array.isArray(other.raw) ? other.raw : [other.raw] : [other]);
      if (other.isEmpty()) {
        continue;
      }
      this.mergeContents(contents, other.contents);
      for (const otherOverride of other.overrides) {
        const [override] = overrides.filter((o) => arrays.equals(o.identifiers, otherOverride.identifiers));
        if (override) {
          this.mergeContents(override.contents, otherOverride.contents);
          override.keys.push(...otherOverride.keys);
          override.keys = arrays.distinct(override.keys);
        } else {
          overrides.push(objects.deepClone(otherOverride));
        }
      }
      for (const key of other.keys) {
        if (keys.indexOf(key) === -1) {
          keys.push(key);
        }
      }
    }
    return new ConfigurationModel(contents, keys, overrides, !raws.length || raws.every((raw) => raw instanceof ConfigurationModel) ? void 0 : raws, this.logService);
  }
  createOverrideConfigurationModel(identifier) {
    const overrideContents = this.getContentsForOverrideIdentifer(identifier);
    if (!overrideContents || typeof overrideContents !== "object" || !Object.keys(overrideContents).length) {
      return this;
    }
    const contents = {};
    for (const key of arrays.distinct([...Object.keys(this.contents), ...Object.keys(overrideContents)])) {
      let contentsForKey = this.contents[key];
      const overrideContentsForKey = overrideContents[key];
      if (overrideContentsForKey) {
        if (typeof contentsForKey === "object" && typeof overrideContentsForKey === "object") {
          contentsForKey = objects.deepClone(contentsForKey);
          this.mergeContents(contentsForKey, overrideContentsForKey);
        } else {
          contentsForKey = overrideContentsForKey;
        }
      }
      contents[key] = contentsForKey;
    }
    return new ConfigurationModel(contents, this.keys, this.overrides, void 0, this.logService);
  }
  mergeContents(source, target) {
    for (const key of Object.keys(target)) {
      if (key in source) {
        if (types.isObject(source[key]) && types.isObject(target[key])) {
          this.mergeContents(source[key], target[key]);
          continue;
        }
      }
      source[key] = objects.deepClone(target[key]);
    }
  }
  getContentsForOverrideIdentifer(identifier) {
    let contentsForIdentifierOnly = null;
    let contents = null;
    const mergeContents = (contentsToMerge) => {
      if (contentsToMerge) {
        if (contents) {
          this.mergeContents(contents, contentsToMerge);
        } else {
          contents = objects.deepClone(contentsToMerge);
        }
      }
    };
    for (const override of this.overrides) {
      if (override.identifiers.length === 1 && override.identifiers[0] === identifier) {
        contentsForIdentifierOnly = override.contents;
      } else if (override.identifiers.includes(identifier)) {
        mergeContents(override.contents);
      }
    }
    mergeContents(contentsForIdentifierOnly);
    return contents;
  }
  toJSON() {
    return {
      contents: this.contents,
      overrides: this.overrides,
      keys: this.keys
    };
  }
  // Update methods
  addValue(key, value) {
    this.updateValue(key, value, true);
  }
  setValue(key, value) {
    this.updateValue(key, value, false);
  }
  removeValue(key) {
    const index = this.keys.indexOf(key);
    if (index === -1) {
      return;
    }
    this.keys.splice(index, 1);
    removeFromValueTree(this.contents, key);
    if (OVERRIDE_PROPERTY_REGEX.test(key)) {
      this.overrides.splice(this.overrides.findIndex((o) => arrays.equals(o.identifiers, overrideIdentifiersFromKey(key))), 1);
    }
  }
  updateValue(key, value, add) {
    addToValueTree(this.contents, key, value, (e) => this.logService.error(e));
    add = add || this.keys.indexOf(key) === -1;
    if (add) {
      this.keys.push(key);
    }
    if (OVERRIDE_PROPERTY_REGEX.test(key)) {
      const identifiers = overrideIdentifiersFromKey(key);
      const override = {
        identifiers,
        keys: Object.keys(this.contents[key]),
        contents: toValuesTree(this.contents[key], (message) => this.logService.error(message))
      };
      const index = this.overrides.findIndex((o) => arrays.equals(o.identifiers, identifiers));
      if (index !== -1) {
        this.overrides[index] = override;
      } else {
        this.overrides.push(override);
      }
    }
  }
}
class ConfigurationModelParser {
  constructor(_name, logService) {
    this._name = _name;
    this.logService = logService;
    this._raw = null;
    this._configurationModel = null;
    this._restrictedConfigurations = [];
    this._parseErrors = [];
  }
  get configurationModel() {
    return this._configurationModel || ConfigurationModel.createEmptyModel(this.logService);
  }
  get restrictedConfigurations() {
    return this._restrictedConfigurations;
  }
  get errors() {
    return this._parseErrors;
  }
  parse(content, options) {
    if (!types.isUndefinedOrNull(content)) {
      const raw = this.doParseContent(content);
      this.parseRaw(raw, options);
    }
  }
  reparse(options) {
    if (this._raw) {
      this.parseRaw(this._raw, options);
    }
  }
  parseRaw(raw, options) {
    this._raw = raw;
    const { contents, keys, overrides, restricted, hasExcludedProperties } = this.doParseRaw(raw, options);
    this._configurationModel = new ConfigurationModel(contents, keys, overrides, hasExcludedProperties ? [raw] : void 0, this.logService);
    this._restrictedConfigurations = restricted || [];
  }
  doParseContent(content) {
    let raw = {};
    let currentProperty = null;
    let currentParent = [];
    const previousParents = [];
    const parseErrors = [];
    function onValue(value) {
      if (Array.isArray(currentParent)) {
        currentParent.push(value);
      } else if (currentProperty !== null) {
        currentParent[currentProperty] = value;
      }
    }
    const visitor = {
      onObjectBegin: () => {
        const object = {};
        onValue(object);
        previousParents.push(currentParent);
        currentParent = object;
        currentProperty = null;
      },
      onObjectProperty: (name) => {
        currentProperty = name;
      },
      onObjectEnd: () => {
        currentParent = previousParents.pop();
      },
      onArrayBegin: () => {
        const array = [];
        onValue(array);
        previousParents.push(currentParent);
        currentParent = array;
        currentProperty = null;
      },
      onArrayEnd: () => {
        currentParent = previousParents.pop();
      },
      onLiteralValue: onValue,
      onError: (error, offset, length) => {
        parseErrors.push({ error, offset, length });
      }
    };
    if (content) {
      try {
        json.visit(content, visitor);
        raw = currentParent[0] || {};
      } catch (e) {
        this.logService.error(`Error while parsing settings file ${this._name}: ${e}`);
        this._parseErrors = [e];
      }
    }
    return raw;
  }
  doParseRaw(raw, options) {
    const configurationProperties = Registry.as(Extensions.Configuration).getConfigurationProperties();
    const filtered = this.filter(raw, configurationProperties, true, options);
    raw = filtered.raw;
    const contents = toValuesTree(raw, (message) => this.logService.error(`Conflict in settings file ${this._name}: ${message}`));
    const keys = Object.keys(raw);
    const overrides = this.toOverrides(raw, (message) => this.logService.error(`Conflict in settings file ${this._name}: ${message}`));
    return { contents, keys, overrides, restricted: filtered.restricted, hasExcludedProperties: filtered.hasExcludedProperties };
  }
  filter(properties, configurationProperties, filterOverriddenProperties, options) {
    let hasExcludedProperties = false;
    if (!options?.scopes && !options?.skipRestricted && !options?.exclude?.length) {
      return { raw: properties, restricted: [], hasExcludedProperties };
    }
    const raw = {};
    const restricted = [];
    for (const key in properties) {
      if (OVERRIDE_PROPERTY_REGEX.test(key) && filterOverriddenProperties) {
        const result = this.filter(properties[key], configurationProperties, false, options);
        raw[key] = result.raw;
        hasExcludedProperties = hasExcludedProperties || result.hasExcludedProperties;
        restricted.push(...result.restricted);
      } else {
        const propertySchema = configurationProperties[key];
        if (propertySchema?.restricted) {
          restricted.push(key);
        }
        if (this.shouldInclude(key, propertySchema, options)) {
          raw[key] = properties[key];
        } else {
          hasExcludedProperties = true;
        }
      }
    }
    return { raw, restricted, hasExcludedProperties };
  }
  shouldInclude(key, propertySchema, options) {
    if (options.exclude?.includes(key)) {
      return false;
    }
    if (options.include?.includes(key)) {
      return true;
    }
    if (options.skipRestricted && propertySchema?.restricted) {
      return false;
    }
    if (options.skipUnregistered && !propertySchema) {
      return false;
    }
    const scope = propertySchema ? typeof propertySchema.scope !== "undefined" ? propertySchema.scope : ConfigurationScope.WINDOW : void 0;
    if (scope === void 0 || options.scopes === void 0) {
      return true;
    }
    return options.scopes.includes(scope);
  }
  toOverrides(raw, conflictReporter) {
    const overrides = [];
    for (const key of Object.keys(raw)) {
      if (OVERRIDE_PROPERTY_REGEX.test(key)) {
        const overrideRaw = {};
        for (const keyInOverrideRaw in raw[key]) {
          overrideRaw[keyInOverrideRaw] = raw[key][keyInOverrideRaw];
        }
        overrides.push({
          identifiers: overrideIdentifiersFromKey(key),
          keys: Object.keys(overrideRaw),
          contents: toValuesTree(overrideRaw, conflictReporter)
        });
      }
    }
    return overrides;
  }
}
class UserSettings extends Disposable {
  constructor(userSettingsResource, parseOptions, extUri, fileService, logService) {
    super();
    this.userSettingsResource = userSettingsResource;
    this.parseOptions = parseOptions;
    this.fileService = fileService;
    this.logService = logService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.parser = new ConfigurationModelParser(this.userSettingsResource.toString(), logService);
    this._register(this.fileService.watch(extUri.dirname(this.userSettingsResource)));
    this._register(this.fileService.watch(this.userSettingsResource));
    this._register(Event.any(
      Event.filter(this.fileService.onDidFilesChange, (e) => e.contains(this.userSettingsResource)),
      Event.filter(this.fileService.onDidRunOperation, (e) => (e.isOperation(FileOperation.CREATE) || e.isOperation(FileOperation.COPY) || e.isOperation(FileOperation.DELETE) || e.isOperation(FileOperation.WRITE)) && extUri.isEqual(e.resource, userSettingsResource))
    )(() => this._onDidChange.fire()));
  }
  async loadConfiguration() {
    try {
      const content = await this.fileService.readFile(this.userSettingsResource);
      this.parser.parse(content.value.toString() || "{}", this.parseOptions);
      return this.parser.configurationModel;
    } catch (e) {
      return ConfigurationModel.createEmptyModel(this.logService);
    }
  }
  reparse(parseOptions) {
    if (parseOptions) {
      this.parseOptions = parseOptions;
    }
    this.parser.reparse(this.parseOptions);
    return this.parser.configurationModel;
  }
  getRestrictedSettings() {
    return this.parser.restrictedConfigurations;
  }
}
class ConfigurationInspectValue {
  constructor(key, overrides, _value, overrideIdentifiers, defaultConfiguration, policyConfiguration, applicationConfiguration, userConfiguration, localUserConfiguration, remoteUserConfiguration, workspaceConfiguration, folderConfigurationModel, memoryConfigurationModel) {
    this.key = key;
    this.overrides = overrides;
    this._value = _value;
    this.overrideIdentifiers = overrideIdentifiers;
    this.defaultConfiguration = defaultConfiguration;
    this.policyConfiguration = policyConfiguration;
    this.applicationConfiguration = applicationConfiguration;
    this.userConfiguration = userConfiguration;
    this.localUserConfiguration = localUserConfiguration;
    this.remoteUserConfiguration = remoteUserConfiguration;
    this.workspaceConfiguration = workspaceConfiguration;
    this.folderConfigurationModel = folderConfigurationModel;
    this.memoryConfigurationModel = memoryConfigurationModel;
  }
  get value() {
    return freeze(this._value);
  }
  toInspectValue(inspectValue) {
    return inspectValue?.value !== void 0 || inspectValue?.override !== void 0 || inspectValue?.overrides !== void 0 ? inspectValue : void 0;
  }
  get defaultInspectValue() {
    if (!this._defaultInspectValue) {
      this._defaultInspectValue = this.defaultConfiguration.inspect(this.key, this.overrides.overrideIdentifier);
    }
    return this._defaultInspectValue;
  }
  get defaultValue() {
    return this.defaultInspectValue.merged;
  }
  get default() {
    return this.toInspectValue(this.defaultInspectValue);
  }
  get policyInspectValue() {
    if (this._policyInspectValue === void 0) {
      this._policyInspectValue = this.policyConfiguration ? this.policyConfiguration.inspect(this.key) : null;
    }
    return this._policyInspectValue;
  }
  get policyValue() {
    return this.policyInspectValue?.merged;
  }
  get policy() {
    return this.policyInspectValue?.value !== void 0 ? { value: this.policyInspectValue.value } : void 0;
  }
  get applicationInspectValue() {
    if (this._applicationInspectValue === void 0) {
      this._applicationInspectValue = this.applicationConfiguration ? this.applicationConfiguration.inspect(this.key) : null;
    }
    return this._applicationInspectValue;
  }
  get applicationValue() {
    return this.applicationInspectValue?.merged;
  }
  get application() {
    return this.toInspectValue(this.applicationInspectValue);
  }
  get userInspectValue() {
    if (!this._userInspectValue) {
      this._userInspectValue = this.userConfiguration.inspect(this.key, this.overrides.overrideIdentifier);
    }
    return this._userInspectValue;
  }
  get userValue() {
    return this.userInspectValue.merged;
  }
  get user() {
    return this.toInspectValue(this.userInspectValue);
  }
  get userLocalInspectValue() {
    if (!this._userLocalInspectValue) {
      this._userLocalInspectValue = this.localUserConfiguration.inspect(this.key, this.overrides.overrideIdentifier);
    }
    return this._userLocalInspectValue;
  }
  get userLocalValue() {
    return this.userLocalInspectValue.merged;
  }
  get userLocal() {
    return this.toInspectValue(this.userLocalInspectValue);
  }
  get userRemoteInspectValue() {
    if (!this._userRemoteInspectValue) {
      this._userRemoteInspectValue = this.remoteUserConfiguration.inspect(this.key, this.overrides.overrideIdentifier);
    }
    return this._userRemoteInspectValue;
  }
  get userRemoteValue() {
    return this.userRemoteInspectValue.merged;
  }
  get userRemote() {
    return this.toInspectValue(this.userRemoteInspectValue);
  }
  get workspaceInspectValue() {
    if (this._workspaceInspectValue === void 0) {
      this._workspaceInspectValue = this.workspaceConfiguration ? this.workspaceConfiguration.inspect(this.key, this.overrides.overrideIdentifier) : null;
    }
    return this._workspaceInspectValue;
  }
  get workspaceValue() {
    return this.workspaceInspectValue?.merged;
  }
  get workspace() {
    return this.toInspectValue(this.workspaceInspectValue);
  }
  get workspaceFolderInspectValue() {
    if (this._workspaceFolderInspectValue === void 0) {
      this._workspaceFolderInspectValue = this.folderConfigurationModel ? this.folderConfigurationModel.inspect(this.key, this.overrides.overrideIdentifier) : null;
    }
    return this._workspaceFolderInspectValue;
  }
  get workspaceFolderValue() {
    return this.workspaceFolderInspectValue?.merged;
  }
  get workspaceFolder() {
    return this.toInspectValue(this.workspaceFolderInspectValue);
  }
  get memoryInspectValue() {
    if (this._memoryInspectValue === void 0) {
      this._memoryInspectValue = this.memoryConfigurationModel.inspect(this.key, this.overrides.overrideIdentifier);
    }
    return this._memoryInspectValue;
  }
  get memoryValue() {
    return this.memoryInspectValue.merged;
  }
  get memory() {
    return this.toInspectValue(this.memoryInspectValue);
  }
}
class Configuration {
  constructor(_defaultConfiguration, _policyConfiguration, _applicationConfiguration, _localUserConfiguration, _remoteUserConfiguration, _workspaceConfiguration, _folderConfigurations, _memoryConfiguration, _memoryConfigurationByResource, logService) {
    this._defaultConfiguration = _defaultConfiguration;
    this._policyConfiguration = _policyConfiguration;
    this._applicationConfiguration = _applicationConfiguration;
    this._localUserConfiguration = _localUserConfiguration;
    this._remoteUserConfiguration = _remoteUserConfiguration;
    this._workspaceConfiguration = _workspaceConfiguration;
    this._folderConfigurations = _folderConfigurations;
    this._memoryConfiguration = _memoryConfiguration;
    this._memoryConfigurationByResource = _memoryConfigurationByResource;
    this.logService = logService;
    this._workspaceConsolidatedConfiguration = null;
    this._foldersConsolidatedConfigurations = new ResourceMap();
    this._userConfiguration = null;
  }
  getValue(section, overrides, workspace) {
    const consolidateConfigurationModel = this.getConsolidatedConfigurationModel(section, overrides, workspace);
    return consolidateConfigurationModel.getValue(section);
  }
  updateValue(key, value, overrides = {}) {
    let memoryConfiguration;
    if (overrides.resource) {
      memoryConfiguration = this._memoryConfigurationByResource.get(overrides.resource);
      if (!memoryConfiguration) {
        memoryConfiguration = ConfigurationModel.createEmptyModel(this.logService);
        this._memoryConfigurationByResource.set(overrides.resource, memoryConfiguration);
      }
    } else {
      memoryConfiguration = this._memoryConfiguration;
    }
    if (value === void 0) {
      memoryConfiguration.removeValue(key);
    } else {
      memoryConfiguration.setValue(key, value);
    }
    if (!overrides.resource) {
      this._workspaceConsolidatedConfiguration = null;
    }
  }
  inspect(key, overrides, workspace) {
    const consolidateConfigurationModel = this.getConsolidatedConfigurationModel(key, overrides, workspace);
    const folderConfigurationModel = this.getFolderConfigurationModelForResource(overrides.resource, workspace);
    const memoryConfigurationModel = overrides.resource ? this._memoryConfigurationByResource.get(overrides.resource) || this._memoryConfiguration : this._memoryConfiguration;
    const overrideIdentifiers = /* @__PURE__ */ new Set();
    for (const override of consolidateConfigurationModel.overrides) {
      for (const overrideIdentifier of override.identifiers) {
        if (consolidateConfigurationModel.getOverrideValue(key, overrideIdentifier) !== void 0) {
          overrideIdentifiers.add(overrideIdentifier);
        }
      }
    }
    return new ConfigurationInspectValue(
      key,
      overrides,
      consolidateConfigurationModel.getValue(key),
      overrideIdentifiers.size ? [...overrideIdentifiers] : void 0,
      this._defaultConfiguration,
      this._policyConfiguration.isEmpty() ? void 0 : this._policyConfiguration,
      this.applicationConfiguration.isEmpty() ? void 0 : this.applicationConfiguration,
      this.userConfiguration,
      this.localUserConfiguration,
      this.remoteUserConfiguration,
      workspace ? this._workspaceConfiguration : void 0,
      folderConfigurationModel ? folderConfigurationModel : void 0,
      memoryConfigurationModel
    );
  }
  keys(workspace) {
    const folderConfigurationModel = this.getFolderConfigurationModelForResource(void 0, workspace);
    return {
      default: this._defaultConfiguration.keys.slice(0),
      user: this.userConfiguration.keys.slice(0),
      workspace: this._workspaceConfiguration.keys.slice(0),
      workspaceFolder: folderConfigurationModel ? folderConfigurationModel.keys.slice(0) : []
    };
  }
  updateDefaultConfiguration(defaultConfiguration) {
    this._defaultConfiguration = defaultConfiguration;
    this._workspaceConsolidatedConfiguration = null;
    this._foldersConsolidatedConfigurations.clear();
  }
  updatePolicyConfiguration(policyConfiguration) {
    this._policyConfiguration = policyConfiguration;
  }
  updateApplicationConfiguration(applicationConfiguration) {
    this._applicationConfiguration = applicationConfiguration;
    this._workspaceConsolidatedConfiguration = null;
    this._foldersConsolidatedConfigurations.clear();
  }
  updateLocalUserConfiguration(localUserConfiguration) {
    this._localUserConfiguration = localUserConfiguration;
    this._userConfiguration = null;
    this._workspaceConsolidatedConfiguration = null;
    this._foldersConsolidatedConfigurations.clear();
  }
  updateRemoteUserConfiguration(remoteUserConfiguration) {
    this._remoteUserConfiguration = remoteUserConfiguration;
    this._userConfiguration = null;
    this._workspaceConsolidatedConfiguration = null;
    this._foldersConsolidatedConfigurations.clear();
  }
  updateWorkspaceConfiguration(workspaceConfiguration) {
    this._workspaceConfiguration = workspaceConfiguration;
    this._workspaceConsolidatedConfiguration = null;
    this._foldersConsolidatedConfigurations.clear();
  }
  updateFolderConfiguration(resource, configuration) {
    this._folderConfigurations.set(resource, configuration);
    this._foldersConsolidatedConfigurations.delete(resource);
  }
  deleteFolderConfiguration(resource) {
    this.folderConfigurations.delete(resource);
    this._foldersConsolidatedConfigurations.delete(resource);
  }
  compareAndUpdateDefaultConfiguration(defaults, keys) {
    const overrides = [];
    if (!keys) {
      const { added, updated, removed } = compare(this._defaultConfiguration, defaults);
      keys = [...added, ...updated, ...removed];
    }
    for (const key of keys) {
      for (const overrideIdentifier of overrideIdentifiersFromKey(key)) {
        const fromKeys = this._defaultConfiguration.getKeysForOverrideIdentifier(overrideIdentifier);
        const toKeys = defaults.getKeysForOverrideIdentifier(overrideIdentifier);
        const keys2 = [
          ...toKeys.filter((key2) => fromKeys.indexOf(key2) === -1),
          ...fromKeys.filter((key2) => toKeys.indexOf(key2) === -1),
          ...fromKeys.filter((key2) => !objects.equals(this._defaultConfiguration.override(overrideIdentifier).getValue(key2), defaults.override(overrideIdentifier).getValue(key2)))
        ];
        overrides.push([overrideIdentifier, keys2]);
      }
    }
    this.updateDefaultConfiguration(defaults);
    return { keys, overrides };
  }
  compareAndUpdatePolicyConfiguration(policyConfiguration) {
    const { added, updated, removed } = compare(this._policyConfiguration, policyConfiguration);
    const keys = [...added, ...updated, ...removed];
    if (keys.length) {
      this.updatePolicyConfiguration(policyConfiguration);
    }
    return { keys, overrides: [] };
  }
  compareAndUpdateApplicationConfiguration(application) {
    const { added, updated, removed, overrides } = compare(this.applicationConfiguration, application);
    const keys = [...added, ...updated, ...removed];
    if (keys.length) {
      this.updateApplicationConfiguration(application);
    }
    return { keys, overrides };
  }
  compareAndUpdateLocalUserConfiguration(user) {
    const { added, updated, removed, overrides } = compare(this.localUserConfiguration, user);
    const keys = [...added, ...updated, ...removed];
    if (keys.length) {
      this.updateLocalUserConfiguration(user);
    }
    return { keys, overrides };
  }
  compareAndUpdateRemoteUserConfiguration(user) {
    const { added, updated, removed, overrides } = compare(this.remoteUserConfiguration, user);
    const keys = [...added, ...updated, ...removed];
    if (keys.length) {
      this.updateRemoteUserConfiguration(user);
    }
    return { keys, overrides };
  }
  compareAndUpdateWorkspaceConfiguration(workspaceConfiguration) {
    const { added, updated, removed, overrides } = compare(this.workspaceConfiguration, workspaceConfiguration);
    const keys = [...added, ...updated, ...removed];
    if (keys.length) {
      this.updateWorkspaceConfiguration(workspaceConfiguration);
    }
    return { keys, overrides };
  }
  compareAndUpdateFolderConfiguration(resource, folderConfiguration) {
    const currentFolderConfiguration = this.folderConfigurations.get(resource);
    const { added, updated, removed, overrides } = compare(currentFolderConfiguration, folderConfiguration);
    const keys = [...added, ...updated, ...removed];
    if (keys.length || !currentFolderConfiguration) {
      this.updateFolderConfiguration(resource, folderConfiguration);
    }
    return { keys, overrides };
  }
  compareAndDeleteFolderConfiguration(folder) {
    const folderConfig = this.folderConfigurations.get(folder);
    if (!folderConfig) {
      throw new Error("Unknown folder");
    }
    this.deleteFolderConfiguration(folder);
    const { added, updated, removed, overrides } = compare(folderConfig, void 0);
    return { keys: [...added, ...updated, ...removed], overrides };
  }
  get defaults() {
    return this._defaultConfiguration;
  }
  get applicationConfiguration() {
    return this._applicationConfiguration;
  }
  get userConfiguration() {
    if (!this._userConfiguration) {
      if (this._remoteUserConfiguration.isEmpty()) {
        this._userConfiguration = this._localUserConfiguration;
      } else {
        const merged = this._localUserConfiguration.merge(this._remoteUserConfiguration);
        this._userConfiguration = new ConfigurationModel(merged.contents, merged.keys, merged.overrides, void 0, this.logService);
      }
    }
    return this._userConfiguration;
  }
  get localUserConfiguration() {
    return this._localUserConfiguration;
  }
  get remoteUserConfiguration() {
    return this._remoteUserConfiguration;
  }
  get workspaceConfiguration() {
    return this._workspaceConfiguration;
  }
  get folderConfigurations() {
    return this._folderConfigurations;
  }
  getConsolidatedConfigurationModel(section, overrides, workspace) {
    let configurationModel = this.getConsolidatedConfigurationModelForResource(overrides, workspace);
    if (overrides.overrideIdentifier) {
      configurationModel = configurationModel.override(overrides.overrideIdentifier);
    }
    if (!this._policyConfiguration.isEmpty() && this._policyConfiguration.getValue(section) !== void 0) {
      configurationModel = configurationModel.merge();
      for (const key of this._policyConfiguration.keys) {
        configurationModel.setValue(key, this._policyConfiguration.getValue(key));
      }
    }
    return configurationModel;
  }
  getConsolidatedConfigurationModelForResource({ resource }, workspace) {
    let consolidateConfiguration = this.getWorkspaceConsolidatedConfiguration();
    if (workspace && resource) {
      const root = workspace.getFolder(resource);
      if (root) {
        consolidateConfiguration = this.getFolderConsolidatedConfiguration(root.uri) || consolidateConfiguration;
      }
      const memoryConfigurationForResource = this._memoryConfigurationByResource.get(resource);
      if (memoryConfigurationForResource) {
        consolidateConfiguration = consolidateConfiguration.merge(memoryConfigurationForResource);
      }
    }
    return consolidateConfiguration;
  }
  getWorkspaceConsolidatedConfiguration() {
    if (!this._workspaceConsolidatedConfiguration) {
      this._workspaceConsolidatedConfiguration = this._defaultConfiguration.merge(this.applicationConfiguration, this.userConfiguration, this._workspaceConfiguration, this._memoryConfiguration);
    }
    return this._workspaceConsolidatedConfiguration;
  }
  getFolderConsolidatedConfiguration(folder) {
    let folderConsolidatedConfiguration = this._foldersConsolidatedConfigurations.get(folder);
    if (!folderConsolidatedConfiguration) {
      const workspaceConsolidateConfiguration = this.getWorkspaceConsolidatedConfiguration();
      const folderConfiguration = this._folderConfigurations.get(folder);
      if (folderConfiguration) {
        folderConsolidatedConfiguration = workspaceConsolidateConfiguration.merge(folderConfiguration);
        this._foldersConsolidatedConfigurations.set(folder, folderConsolidatedConfiguration);
      } else {
        folderConsolidatedConfiguration = workspaceConsolidateConfiguration;
      }
    }
    return folderConsolidatedConfiguration;
  }
  getFolderConfigurationModelForResource(resource, workspace) {
    if (workspace && resource) {
      const root = workspace.getFolder(resource);
      if (root) {
        return this._folderConfigurations.get(root.uri);
      }
    }
    return void 0;
  }
  toData() {
    return {
      defaults: {
        contents: this._defaultConfiguration.contents,
        overrides: this._defaultConfiguration.overrides,
        keys: this._defaultConfiguration.keys
      },
      policy: {
        contents: this._policyConfiguration.contents,
        overrides: this._policyConfiguration.overrides,
        keys: this._policyConfiguration.keys
      },
      application: {
        contents: this.applicationConfiguration.contents,
        overrides: this.applicationConfiguration.overrides,
        keys: this.applicationConfiguration.keys,
        raw: Array.isArray(this.applicationConfiguration.raw) ? void 0 : this.applicationConfiguration.raw
      },
      userLocal: {
        contents: this.localUserConfiguration.contents,
        overrides: this.localUserConfiguration.overrides,
        keys: this.localUserConfiguration.keys,
        raw: Array.isArray(this.localUserConfiguration.raw) ? void 0 : this.localUserConfiguration.raw
      },
      userRemote: {
        contents: this.remoteUserConfiguration.contents,
        overrides: this.remoteUserConfiguration.overrides,
        keys: this.remoteUserConfiguration.keys,
        raw: Array.isArray(this.remoteUserConfiguration.raw) ? void 0 : this.remoteUserConfiguration.raw
      },
      workspace: {
        contents: this._workspaceConfiguration.contents,
        overrides: this._workspaceConfiguration.overrides,
        keys: this._workspaceConfiguration.keys
      },
      folders: [...this._folderConfigurations.keys()].reduce((result, folder) => {
        const { contents, overrides, keys } = this._folderConfigurations.get(folder);
        result.push([folder, { contents, overrides, keys }]);
        return result;
      }, [])
    };
  }
  allKeys() {
    const keys = /* @__PURE__ */ new Set();
    this._defaultConfiguration.keys.forEach((key) => keys.add(key));
    this.userConfiguration.keys.forEach((key) => keys.add(key));
    this._workspaceConfiguration.keys.forEach((key) => keys.add(key));
    this._folderConfigurations.forEach((folderConfiguration) => folderConfiguration.keys.forEach((key) => keys.add(key)));
    return [...keys.values()];
  }
  allOverrideIdentifiers() {
    const keys = /* @__PURE__ */ new Set();
    this._defaultConfiguration.getAllOverrideIdentifiers().forEach((key) => keys.add(key));
    this.userConfiguration.getAllOverrideIdentifiers().forEach((key) => keys.add(key));
    this._workspaceConfiguration.getAllOverrideIdentifiers().forEach((key) => keys.add(key));
    this._folderConfigurations.forEach((folderConfiguration) => folderConfiguration.getAllOverrideIdentifiers().forEach((key) => keys.add(key)));
    return [...keys.values()];
  }
  getAllKeysForOverrideIdentifier(overrideIdentifier) {
    const keys = /* @__PURE__ */ new Set();
    this._defaultConfiguration.getKeysForOverrideIdentifier(overrideIdentifier).forEach((key) => keys.add(key));
    this.userConfiguration.getKeysForOverrideIdentifier(overrideIdentifier).forEach((key) => keys.add(key));
    this._workspaceConfiguration.getKeysForOverrideIdentifier(overrideIdentifier).forEach((key) => keys.add(key));
    this._folderConfigurations.forEach((folderConfiguration) => folderConfiguration.getKeysForOverrideIdentifier(overrideIdentifier).forEach((key) => keys.add(key)));
    return [...keys.values()];
  }
  static parse(data, logService) {
    const defaultConfiguration = this.parseConfigurationModel(data.defaults, logService);
    const policyConfiguration = this.parseConfigurationModel(data.policy, logService);
    const applicationConfiguration = this.parseConfigurationModel(data.application, logService);
    const userLocalConfiguration = this.parseConfigurationModel(data.userLocal, logService);
    const userRemoteConfiguration = this.parseConfigurationModel(data.userRemote, logService);
    const workspaceConfiguration = this.parseConfigurationModel(data.workspace, logService);
    const folders = data.folders.reduce((result, value) => {
      result.set(URI.revive(value[0]), this.parseConfigurationModel(value[1], logService));
      return result;
    }, new ResourceMap());
    return new Configuration(
      defaultConfiguration,
      policyConfiguration,
      applicationConfiguration,
      userLocalConfiguration,
      userRemoteConfiguration,
      workspaceConfiguration,
      folders,
      ConfigurationModel.createEmptyModel(logService),
      new ResourceMap(),
      logService
    );
  }
  static parseConfigurationModel(model, logService) {
    return new ConfigurationModel(model.contents, model.keys, model.overrides, model.raw, logService);
  }
}
function mergeChanges(...changes) {
  if (changes.length === 0) {
    return { keys: [], overrides: [] };
  }
  if (changes.length === 1) {
    return changes[0];
  }
  const keysSet = /* @__PURE__ */ new Set();
  const overridesMap = /* @__PURE__ */ new Map();
  for (const change of changes) {
    change.keys.forEach((key) => keysSet.add(key));
    change.overrides.forEach(([identifier, keys]) => {
      const result = getOrSet(overridesMap, identifier, /* @__PURE__ */ new Set());
      keys.forEach((key) => result.add(key));
    });
  }
  const overrides = [];
  overridesMap.forEach((keys, identifier) => overrides.push([identifier, [...keys.values()]]));
  return { keys: [...keysSet.values()], overrides };
}
class ConfigurationChangeEvent {
  constructor(change, previous, currentConfiguraiton, currentWorkspace, logService) {
    this.change = change;
    this.previous = previous;
    this.currentConfiguraiton = currentConfiguraiton;
    this.currentWorkspace = currentWorkspace;
    this.logService = logService;
    this._marker = "\n";
    this._markerCode1 = this._marker.charCodeAt(0);
    this._markerCode2 = ".".charCodeAt(0);
    this.affectedKeys = /* @__PURE__ */ new Set();
    this._previousConfiguration = void 0;
    for (const key of change.keys) {
      this.affectedKeys.add(key);
    }
    for (const [, keys] of change.overrides) {
      for (const key of keys) {
        this.affectedKeys.add(key);
      }
    }
    this._affectsConfigStr = this._marker;
    for (const key of this.affectedKeys) {
      this._affectsConfigStr += key + this._marker;
    }
  }
  get previousConfiguration() {
    if (!this._previousConfiguration && this.previous) {
      this._previousConfiguration = Configuration.parse(this.previous.data, this.logService);
    }
    return this._previousConfiguration;
  }
  affectsConfiguration(section, overrides) {
    const needle = this._marker + section;
    const idx = this._affectsConfigStr.indexOf(needle);
    if (idx < 0) {
      return false;
    }
    const pos = idx + needle.length;
    if (pos >= this._affectsConfigStr.length) {
      return false;
    }
    const code = this._affectsConfigStr.charCodeAt(pos);
    if (code !== this._markerCode1 && code !== this._markerCode2) {
      return false;
    }
    if (overrides) {
      const value1 = this.previousConfiguration ? this.previousConfiguration.getValue(section, overrides, this.previous?.workspace) : void 0;
      const value2 = this.currentConfiguraiton.getValue(section, overrides, this.currentWorkspace);
      return !objects.equals(value1, value2);
    }
    return true;
  }
}
function compare(from, to) {
  const { added, removed, updated } = compareConfigurationContents(to?.rawConfiguration, from?.rawConfiguration);
  const overrides = [];
  const fromOverrideIdentifiers = from?.getAllOverrideIdentifiers() || [];
  const toOverrideIdentifiers = to?.getAllOverrideIdentifiers() || [];
  if (to) {
    const addedOverrideIdentifiers = toOverrideIdentifiers.filter((key) => !fromOverrideIdentifiers.includes(key));
    for (const identifier of addedOverrideIdentifiers) {
      overrides.push([identifier, to.getKeysForOverrideIdentifier(identifier)]);
    }
  }
  if (from) {
    const removedOverrideIdentifiers = fromOverrideIdentifiers.filter((key) => !toOverrideIdentifiers.includes(key));
    for (const identifier of removedOverrideIdentifiers) {
      overrides.push([identifier, from.getKeysForOverrideIdentifier(identifier)]);
    }
  }
  if (to && from) {
    for (const identifier of fromOverrideIdentifiers) {
      if (toOverrideIdentifiers.includes(identifier)) {
        const result = compareConfigurationContents({ contents: from.getOverrideValue(void 0, identifier) || {}, keys: from.getKeysForOverrideIdentifier(identifier) }, { contents: to.getOverrideValue(void 0, identifier) || {}, keys: to.getKeysForOverrideIdentifier(identifier) });
        overrides.push([identifier, [...result.added, ...result.removed, ...result.updated]]);
      }
    }
  }
  return { added, removed, updated, overrides };
}
function compareConfigurationContents(to, from) {
  const added = to ? from ? to.keys.filter((key) => from.keys.indexOf(key) === -1) : [...to.keys] : [];
  const removed = from ? to ? from.keys.filter((key) => to.keys.indexOf(key) === -1) : [...from.keys] : [];
  const updated = [];
  if (to && from) {
    for (const key of from.keys) {
      if (to.keys.indexOf(key) !== -1) {
        const value1 = getConfigurationValue(from.contents, key);
        const value2 = getConfigurationValue(to.contents, key);
        if (!objects.equals(value1, value2)) {
          updated.push(key);
        }
      }
    }
  }
  return { added, removed, updated };
}
export {
  Configuration,
  ConfigurationChangeEvent,
  ConfigurationModel,
  ConfigurationModelParser,
  UserSettings,
  mergeChanges
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uTW9kZWxzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgYXJyYXlzIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBJU3RyaW5nRGljdGlvbmFyeSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbGxlY3Rpb25zLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0ICogYXMganNvbiBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZ2V0T3JTZXQsIFJlc291cmNlTWFwIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCAqIGFzIG9iamVjdHMgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBJRXh0VXJpIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCAqIGFzIHR5cGVzIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSwgVXJpQ29tcG9uZW50cyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBhZGRUb1ZhbHVlVHJlZSwgQ29uZmlndXJhdGlvblRhcmdldCwgZ2V0Q29uZmlndXJhdGlvblZhbHVlLCBJQ29uZmlndXJhdGlvbkNoYW5nZSwgSUNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudCwgSUNvbmZpZ3VyYXRpb25Db21wYXJlUmVzdWx0LCBJQ29uZmlndXJhdGlvbkRhdGEsIElDb25maWd1cmF0aW9uTW9kZWwsIElDb25maWd1cmF0aW9uT3ZlcnJpZGVzLCBJQ29uZmlndXJhdGlvblVwZGF0ZU92ZXJyaWRlcywgSUNvbmZpZ3VyYXRpb25WYWx1ZSwgSUluc3BlY3RWYWx1ZSwgSU92ZXJyaWRlcywgcmVtb3ZlRnJvbVZhbHVlVHJlZSwgdG9WYWx1ZXNUcmVlIH0gZnJvbSAnLi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25TY29wZSwgRXh0ZW5zaW9ucywgSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSwgSUNvbmZpZ3VyYXRpb25SZWdpc3RyeSwgb3ZlcnJpZGVJZGVudGlmaWVyc0Zyb21LZXksIE9WRVJSSURFX1BST1BFUlRZX1JFR0VYIH0gZnJvbSAnLi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgRmlsZU9wZXJhdGlvbiwgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgV29ya3NwYWNlIH0gZnJvbSAnLi4vLi4vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuXG5mdW5jdGlvbiBmcmVlemU8VD4oZGF0YTogVCk6IFQge1xuXHRyZXR1cm4gT2JqZWN0LmlzRnJvemVuKGRhdGEpID8gZGF0YSA6IG9iamVjdHMuZGVlcEZyZWV6ZShkYXRhKTtcbn1cblxudHlwZSBJbnNwZWN0VmFsdWU8Vj4gPSBJSW5zcGVjdFZhbHVlPFY+ICYgeyBtZXJnZWQ/OiBWIH07XG5cbmV4cG9ydCBjbGFzcyBDb25maWd1cmF0aW9uTW9kZWwgaW1wbGVtZW50cyBJQ29uZmlndXJhdGlvbk1vZGVsIHtcblxuXHRzdGF0aWMgY3JlYXRlRW1wdHlNb2RlbChsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSk6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0cmV0dXJuIG5ldyBDb25maWd1cmF0aW9uTW9kZWwoe30sIFtdLCBbXSwgdW5kZWZpbmVkLCBsb2dTZXJ2aWNlKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgb3ZlcnJpZGVDb25maWd1cmF0aW9ucyA9IG5ldyBNYXA8c3RyaW5nLCBDb25maWd1cmF0aW9uTW9kZWw+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY29udGVudHM6IGFueSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9rZXlzOiBzdHJpbmdbXSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9vdmVycmlkZXM6IElPdmVycmlkZXNbXSxcblx0XHRyZWFkb25seSByYXc6IElTdHJpbmdEaWN0aW9uYXJ5PGFueT4gfCBSZWFkb25seUFycmF5PElTdHJpbmdEaWN0aW9uYXJ5PGFueT4gfCBDb25maWd1cmF0aW9uTW9kZWw+IHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7XG5cdH1cblxuXHRwcml2YXRlIF9yYXdDb25maWd1cmF0aW9uOiBDb25maWd1cmF0aW9uTW9kZWwgfCB1bmRlZmluZWQ7XG5cdGdldCByYXdDb25maWd1cmF0aW9uKCk6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0aWYgKCF0aGlzLl9yYXdDb25maWd1cmF0aW9uKSB7XG5cdFx0XHRpZiAodGhpcy5yYXcpIHtcblx0XHRcdFx0Y29uc3QgcmF3Q29uZmlndXJhdGlvbk1vZGVscyA9IChBcnJheS5pc0FycmF5KHRoaXMucmF3KSA/IHRoaXMucmF3IDogW3RoaXMucmF3XSkubWFwKHJhdyA9PiB7XG5cdFx0XHRcdFx0aWYgKHJhdyBpbnN0YW5jZW9mIENvbmZpZ3VyYXRpb25Nb2RlbCkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHJhdztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uc3QgcGFyc2VyID0gbmV3IENvbmZpZ3VyYXRpb25Nb2RlbFBhcnNlcignJywgdGhpcy5sb2dTZXJ2aWNlKTtcblx0XHRcdFx0XHRwYXJzZXIucGFyc2VSYXcocmF3KTtcblx0XHRcdFx0XHRyZXR1cm4gcGFyc2VyLmNvbmZpZ3VyYXRpb25Nb2RlbDtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRoaXMuX3Jhd0NvbmZpZ3VyYXRpb24gPSByYXdDb25maWd1cmF0aW9uTW9kZWxzLnJlZHVjZSgocHJldmlvdXMsIGN1cnJlbnQpID0+IGN1cnJlbnQgPT09IHByZXZpb3VzID8gY3VycmVudCA6IHByZXZpb3VzLm1lcmdlKGN1cnJlbnQpLCByYXdDb25maWd1cmF0aW9uTW9kZWxzWzBdKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIHJhdyBpcyBzYW1lIGFzIGN1cnJlbnRcblx0XHRcdFx0dGhpcy5fcmF3Q29uZmlndXJhdGlvbiA9IHRoaXM7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9yYXdDb25maWd1cmF0aW9uO1xuXHR9XG5cblx0Z2V0IGNvbnRlbnRzKCk6IGFueSB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRlbnRzO1xuXHR9XG5cblx0Z2V0IG92ZXJyaWRlcygpOiBJT3ZlcnJpZGVzW10ge1xuXHRcdHJldHVybiB0aGlzLl9vdmVycmlkZXM7XG5cdH1cblxuXHRnZXQga2V5cygpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX2tleXM7XG5cdH1cblxuXHRpc0VtcHR5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9rZXlzLmxlbmd0aCA9PT0gMCAmJiBPYmplY3Qua2V5cyh0aGlzLl9jb250ZW50cykubGVuZ3RoID09PSAwICYmIHRoaXMuX292ZXJyaWRlcy5sZW5ndGggPT09IDA7XG5cdH1cblxuXHRnZXRWYWx1ZTxWPihzZWN0aW9uOiBzdHJpbmcgfCB1bmRlZmluZWQpOiBWIHtcblx0XHRyZXR1cm4gc2VjdGlvbiA/IGdldENvbmZpZ3VyYXRpb25WYWx1ZTxhbnk+KHRoaXMuY29udGVudHMsIHNlY3Rpb24pIDogdGhpcy5jb250ZW50cztcblx0fVxuXG5cdGluc3BlY3Q8Vj4oc2VjdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkLCBvdmVycmlkZUlkZW50aWZpZXI/OiBzdHJpbmcgfCBudWxsKTogSW5zcGVjdFZhbHVlPFY+IHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRyZXR1cm4ge1xuXHRcdFx0Z2V0IHZhbHVlKCkge1xuXHRcdFx0XHRyZXR1cm4gZnJlZXplKHRoYXQucmF3Q29uZmlndXJhdGlvbi5nZXRWYWx1ZTxWPihzZWN0aW9uKSk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IG92ZXJyaWRlKCkge1xuXHRcdFx0XHRyZXR1cm4gb3ZlcnJpZGVJZGVudGlmaWVyID8gZnJlZXplKHRoYXQucmF3Q29uZmlndXJhdGlvbi5nZXRPdmVycmlkZVZhbHVlPFY+KHNlY3Rpb24sIG92ZXJyaWRlSWRlbnRpZmllcikpIDogdW5kZWZpbmVkO1xuXHRcdFx0fSxcblx0XHRcdGdldCBtZXJnZWQoKSB7XG5cdFx0XHRcdHJldHVybiBmcmVlemUob3ZlcnJpZGVJZGVudGlmaWVyID8gdGhhdC5yYXdDb25maWd1cmF0aW9uLm92ZXJyaWRlKG92ZXJyaWRlSWRlbnRpZmllcikuZ2V0VmFsdWU8Vj4oc2VjdGlvbikgOiB0aGF0LnJhd0NvbmZpZ3VyYXRpb24uZ2V0VmFsdWU8Vj4oc2VjdGlvbikpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBvdmVycmlkZXMoKSB7XG5cdFx0XHRcdGNvbnN0IG92ZXJyaWRlczogeyByZWFkb25seSBpZGVudGlmaWVyczogc3RyaW5nW107IHJlYWRvbmx5IHZhbHVlOiBWIH1bXSA9IFtdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHsgY29udGVudHMsIGlkZW50aWZpZXJzLCBrZXlzIH0gb2YgdGhhdC5yYXdDb25maWd1cmF0aW9uLm92ZXJyaWRlcykge1xuXHRcdFx0XHRcdGNvbnN0IHZhbHVlID0gbmV3IENvbmZpZ3VyYXRpb25Nb2RlbChjb250ZW50cywga2V5cywgW10sIHVuZGVmaW5lZCwgdGhhdC5sb2dTZXJ2aWNlKS5nZXRWYWx1ZTxWPihzZWN0aW9uKTtcblx0XHRcdFx0XHRpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0b3ZlcnJpZGVzLnB1c2goeyBpZGVudGlmaWVycywgdmFsdWUgfSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBvdmVycmlkZXMubGVuZ3RoID8gZnJlZXplKG92ZXJyaWRlcykgOiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdGdldE92ZXJyaWRlVmFsdWU8Vj4oc2VjdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkLCBvdmVycmlkZUlkZW50aWZpZXI6IHN0cmluZyk6IFYgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IG92ZXJyaWRlQ29udGVudHMgPSB0aGlzLmdldENvbnRlbnRzRm9yT3ZlcnJpZGVJZGVudGlmZXIob3ZlcnJpZGVJZGVudGlmaWVyKTtcblx0XHRyZXR1cm4gb3ZlcnJpZGVDb250ZW50c1xuXHRcdFx0PyBzZWN0aW9uID8gZ2V0Q29uZmlndXJhdGlvblZhbHVlPGFueT4ob3ZlcnJpZGVDb250ZW50cywgc2VjdGlvbikgOiBvdmVycmlkZUNvbnRlbnRzXG5cdFx0XHQ6IHVuZGVmaW5lZDtcblx0fVxuXG5cdGdldEtleXNGb3JPdmVycmlkZUlkZW50aWZpZXIoaWRlbnRpZmllcjogc3RyaW5nKTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IGtleXM6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBvdmVycmlkZSBvZiB0aGlzLm92ZXJyaWRlcykge1xuXHRcdFx0aWYgKG92ZXJyaWRlLmlkZW50aWZpZXJzLmluY2x1ZGVzKGlkZW50aWZpZXIpKSB7XG5cdFx0XHRcdGtleXMucHVzaCguLi5vdmVycmlkZS5rZXlzKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGFycmF5cy5kaXN0aW5jdChrZXlzKTtcblx0fVxuXG5cdGdldEFsbE92ZXJyaWRlSWRlbnRpZmllcnMoKTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IG92ZXJyaWRlIG9mIHRoaXMub3ZlcnJpZGVzKSB7XG5cdFx0XHRyZXN1bHQucHVzaCguLi5vdmVycmlkZS5pZGVudGlmaWVycyk7XG5cdFx0fVxuXHRcdHJldHVybiBhcnJheXMuZGlzdGluY3QocmVzdWx0KTtcblx0fVxuXG5cdG92ZXJyaWRlKGlkZW50aWZpZXI6IHN0cmluZyk6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0bGV0IG92ZXJyaWRlQ29uZmlndXJhdGlvbk1vZGVsID0gdGhpcy5vdmVycmlkZUNvbmZpZ3VyYXRpb25zLmdldChpZGVudGlmaWVyKTtcblx0XHRpZiAoIW92ZXJyaWRlQ29uZmlndXJhdGlvbk1vZGVsKSB7XG5cdFx0XHRvdmVycmlkZUNvbmZpZ3VyYXRpb25Nb2RlbCA9IHRoaXMuY3JlYXRlT3ZlcnJpZGVDb25maWd1cmF0aW9uTW9kZWwoaWRlbnRpZmllcik7XG5cdFx0XHR0aGlzLm92ZXJyaWRlQ29uZmlndXJhdGlvbnMuc2V0KGlkZW50aWZpZXIsIG92ZXJyaWRlQ29uZmlndXJhdGlvbk1vZGVsKTtcblx0XHR9XG5cdFx0cmV0dXJuIG92ZXJyaWRlQ29uZmlndXJhdGlvbk1vZGVsO1xuXHR9XG5cblx0bWVyZ2UoLi4ub3RoZXJzOiBDb25maWd1cmF0aW9uTW9kZWxbXSk6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0Y29uc3QgY29udGVudHMgPSBvYmplY3RzLmRlZXBDbG9uZSh0aGlzLmNvbnRlbnRzKTtcblx0XHRjb25zdCBvdmVycmlkZXMgPSBvYmplY3RzLmRlZXBDbG9uZSh0aGlzLm92ZXJyaWRlcyk7XG5cdFx0Y29uc3Qga2V5cyA9IFsuLi50aGlzLmtleXNdO1xuXHRcdGNvbnN0IHJhd3MgPSB0aGlzLnJhdyA/IEFycmF5LmlzQXJyYXkodGhpcy5yYXcpID8gWy4uLnRoaXMucmF3XSA6IFt0aGlzLnJhd10gOiBbdGhpc107XG5cblx0XHRmb3IgKGNvbnN0IG90aGVyIG9mIG90aGVycykge1xuXHRcdFx0cmF3cy5wdXNoKC4uLihvdGhlci5yYXcgPyBBcnJheS5pc0FycmF5KG90aGVyLnJhdykgPyBvdGhlci5yYXcgOiBbb3RoZXIucmF3XSA6IFtvdGhlcl0pKTtcblx0XHRcdGlmIChvdGhlci5pc0VtcHR5KCkpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLm1lcmdlQ29udGVudHMoY29udGVudHMsIG90aGVyLmNvbnRlbnRzKTtcblxuXHRcdFx0Zm9yIChjb25zdCBvdGhlck92ZXJyaWRlIG9mIG90aGVyLm92ZXJyaWRlcykge1xuXHRcdFx0XHRjb25zdCBbb3ZlcnJpZGVdID0gb3ZlcnJpZGVzLmZpbHRlcihvID0+IGFycmF5cy5lcXVhbHMoby5pZGVudGlmaWVycywgb3RoZXJPdmVycmlkZS5pZGVudGlmaWVycykpO1xuXHRcdFx0XHRpZiAob3ZlcnJpZGUpIHtcblx0XHRcdFx0XHR0aGlzLm1lcmdlQ29udGVudHMob3ZlcnJpZGUuY29udGVudHMsIG90aGVyT3ZlcnJpZGUuY29udGVudHMpO1xuXHRcdFx0XHRcdG92ZXJyaWRlLmtleXMucHVzaCguLi5vdGhlck92ZXJyaWRlLmtleXMpO1xuXHRcdFx0XHRcdG92ZXJyaWRlLmtleXMgPSBhcnJheXMuZGlzdGluY3Qob3ZlcnJpZGUua2V5cyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0b3ZlcnJpZGVzLnB1c2gob2JqZWN0cy5kZWVwQ2xvbmUob3RoZXJPdmVycmlkZSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IGtleSBvZiBvdGhlci5rZXlzKSB7XG5cdFx0XHRcdGlmIChrZXlzLmluZGV4T2Yoa2V5KSA9PT0gLTEpIHtcblx0XHRcdFx0XHRrZXlzLnB1c2goa2V5KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbmV3IENvbmZpZ3VyYXRpb25Nb2RlbChjb250ZW50cywga2V5cywgb3ZlcnJpZGVzLCAhcmF3cy5sZW5ndGggfHwgcmF3cy5ldmVyeShyYXcgPT4gcmF3IGluc3RhbmNlb2YgQ29uZmlndXJhdGlvbk1vZGVsKSA/IHVuZGVmaW5lZCA6IHJhd3MsIHRoaXMubG9nU2VydmljZSk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZU92ZXJyaWRlQ29uZmlndXJhdGlvbk1vZGVsKGlkZW50aWZpZXI6IHN0cmluZyk6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0Y29uc3Qgb3ZlcnJpZGVDb250ZW50cyA9IHRoaXMuZ2V0Q29udGVudHNGb3JPdmVycmlkZUlkZW50aWZlcihpZGVudGlmaWVyKTtcblxuXHRcdGlmICghb3ZlcnJpZGVDb250ZW50cyB8fCB0eXBlb2Ygb3ZlcnJpZGVDb250ZW50cyAhPT0gJ29iamVjdCcgfHwgIU9iamVjdC5rZXlzKG92ZXJyaWRlQ29udGVudHMpLmxlbmd0aCkge1xuXHRcdFx0Ly8gSWYgdGhlcmUgYXJlIG5vIHZhbGlkIG92ZXJyaWRlcywgcmV0dXJuIHNlbGZcblx0XHRcdHJldHVybiB0aGlzO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRlbnRzOiBhbnkgPSB7fTtcblx0XHRmb3IgKGNvbnN0IGtleSBvZiBhcnJheXMuZGlzdGluY3QoWy4uLk9iamVjdC5rZXlzKHRoaXMuY29udGVudHMpLCAuLi5PYmplY3Qua2V5cyhvdmVycmlkZUNvbnRlbnRzKV0pKSB7XG5cblx0XHRcdGxldCBjb250ZW50c0ZvcktleSA9IHRoaXMuY29udGVudHNba2V5XTtcblx0XHRcdGNvbnN0IG92ZXJyaWRlQ29udGVudHNGb3JLZXkgPSBvdmVycmlkZUNvbnRlbnRzW2tleV07XG5cblx0XHRcdC8vIElmIHRoZXJlIGFyZSBvdmVycmlkZSBjb250ZW50cyBmb3IgdGhlIGtleSwgY2xvbmUgYW5kIG1lcmdlIG90aGVyd2lzZSB1c2UgYmFzZSBjb250ZW50c1xuXHRcdFx0aWYgKG92ZXJyaWRlQ29udGVudHNGb3JLZXkpIHtcblx0XHRcdFx0Ly8gQ2xvbmUgYW5kIG1lcmdlIG9ubHkgaWYgYmFzZSBjb250ZW50cyBhbmQgb3ZlcnJpZGUgY29udGVudHMgYXJlIG9mIHR5cGUgb2JqZWN0IG90aGVyd2lzZSBqdXN0IG92ZXJyaWRlXG5cdFx0XHRcdGlmICh0eXBlb2YgY29udGVudHNGb3JLZXkgPT09ICdvYmplY3QnICYmIHR5cGVvZiBvdmVycmlkZUNvbnRlbnRzRm9yS2V5ID09PSAnb2JqZWN0Jykge1xuXHRcdFx0XHRcdGNvbnRlbnRzRm9yS2V5ID0gb2JqZWN0cy5kZWVwQ2xvbmUoY29udGVudHNGb3JLZXkpO1xuXHRcdFx0XHRcdHRoaXMubWVyZ2VDb250ZW50cyhjb250ZW50c0ZvcktleSwgb3ZlcnJpZGVDb250ZW50c0ZvcktleSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29udGVudHNGb3JLZXkgPSBvdmVycmlkZUNvbnRlbnRzRm9yS2V5O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnRlbnRzW2tleV0gPSBjb250ZW50c0ZvcktleTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmV3IENvbmZpZ3VyYXRpb25Nb2RlbChjb250ZW50cywgdGhpcy5rZXlzLCB0aGlzLm92ZXJyaWRlcywgdW5kZWZpbmVkLCB0aGlzLmxvZ1NlcnZpY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBtZXJnZUNvbnRlbnRzKHNvdXJjZTogYW55LCB0YXJnZXQ6IGFueSk6IHZvaWQge1xuXHRcdGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKHRhcmdldCkpIHtcblx0XHRcdGlmIChrZXkgaW4gc291cmNlKSB7XG5cdFx0XHRcdGlmICh0eXBlcy5pc09iamVjdChzb3VyY2Vba2V5XSkgJiYgdHlwZXMuaXNPYmplY3QodGFyZ2V0W2tleV0pKSB7XG5cdFx0XHRcdFx0dGhpcy5tZXJnZUNvbnRlbnRzKHNvdXJjZVtrZXldLCB0YXJnZXRba2V5XSk7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHNvdXJjZVtrZXldID0gb2JqZWN0cy5kZWVwQ2xvbmUodGFyZ2V0W2tleV0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0Q29udGVudHNGb3JPdmVycmlkZUlkZW50aWZlcihpZGVudGlmaWVyOiBzdHJpbmcpOiBhbnkge1xuXHRcdGxldCBjb250ZW50c0ZvcklkZW50aWZpZXJPbmx5OiBJU3RyaW5nRGljdGlvbmFyeTxhbnk+IHwgbnVsbCA9IG51bGw7XG5cdFx0bGV0IGNvbnRlbnRzOiBJU3RyaW5nRGljdGlvbmFyeTxhbnk+IHwgbnVsbCA9IG51bGw7XG5cdFx0Y29uc3QgbWVyZ2VDb250ZW50cyA9IChjb250ZW50c1RvTWVyZ2U6IGFueSkgPT4ge1xuXHRcdFx0aWYgKGNvbnRlbnRzVG9NZXJnZSkge1xuXHRcdFx0XHRpZiAoY29udGVudHMpIHtcblx0XHRcdFx0XHR0aGlzLm1lcmdlQ29udGVudHMoY29udGVudHMsIGNvbnRlbnRzVG9NZXJnZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29udGVudHMgPSBvYmplY3RzLmRlZXBDbG9uZShjb250ZW50c1RvTWVyZ2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRmb3IgKGNvbnN0IG92ZXJyaWRlIG9mIHRoaXMub3ZlcnJpZGVzKSB7XG5cdFx0XHRpZiAob3ZlcnJpZGUuaWRlbnRpZmllcnMubGVuZ3RoID09PSAxICYmIG92ZXJyaWRlLmlkZW50aWZpZXJzWzBdID09PSBpZGVudGlmaWVyKSB7XG5cdFx0XHRcdGNvbnRlbnRzRm9ySWRlbnRpZmllck9ubHkgPSBvdmVycmlkZS5jb250ZW50cztcblx0XHRcdH0gZWxzZSBpZiAob3ZlcnJpZGUuaWRlbnRpZmllcnMuaW5jbHVkZXMoaWRlbnRpZmllcikpIHtcblx0XHRcdFx0bWVyZ2VDb250ZW50cyhvdmVycmlkZS5jb250ZW50cyk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdC8vIE1lcmdlIGNvbnRlbnRzIG9mIHRoZSBpZGVudGlmaWVyIG9ubHkgYXQgdGhlIGVuZCB0byB0YWtlIHByZWNlZGVuY2UuXG5cdFx0bWVyZ2VDb250ZW50cyhjb250ZW50c0ZvcklkZW50aWZpZXJPbmx5KTtcblx0XHRyZXR1cm4gY29udGVudHM7XG5cdH1cblxuXHR0b0pTT04oKTogSUNvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGNvbnRlbnRzOiB0aGlzLmNvbnRlbnRzLFxuXHRcdFx0b3ZlcnJpZGVzOiB0aGlzLm92ZXJyaWRlcyxcblx0XHRcdGtleXM6IHRoaXMua2V5c1xuXHRcdH07XG5cdH1cblxuXHQvLyBVcGRhdGUgbWV0aG9kc1xuXG5cdHB1YmxpYyBhZGRWYWx1ZShrZXk6IHN0cmluZywgdmFsdWU6IGFueSk6IHZvaWQge1xuXHRcdHRoaXMudXBkYXRlVmFsdWUoa2V5LCB2YWx1ZSwgdHJ1ZSk7XG5cdH1cblxuXHRwdWJsaWMgc2V0VmFsdWUoa2V5OiBzdHJpbmcsIHZhbHVlOiBhbnkpOiB2b2lkIHtcblx0XHR0aGlzLnVwZGF0ZVZhbHVlKGtleSwgdmFsdWUsIGZhbHNlKTtcblx0fVxuXG5cdHB1YmxpYyByZW1vdmVWYWx1ZShrZXk6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5rZXlzLmluZGV4T2Yoa2V5KTtcblx0XHRpZiAoaW5kZXggPT09IC0xKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMua2V5cy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdHJlbW92ZUZyb21WYWx1ZVRyZWUodGhpcy5jb250ZW50cywga2V5KTtcblx0XHRpZiAoT1ZFUlJJREVfUFJPUEVSVFlfUkVHRVgudGVzdChrZXkpKSB7XG5cdFx0XHR0aGlzLm92ZXJyaWRlcy5zcGxpY2UodGhpcy5vdmVycmlkZXMuZmluZEluZGV4KG8gPT4gYXJyYXlzLmVxdWFscyhvLmlkZW50aWZpZXJzLCBvdmVycmlkZUlkZW50aWZpZXJzRnJvbUtleShrZXkpKSksIDEpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlVmFsdWUoa2V5OiBzdHJpbmcsIHZhbHVlOiBhbnksIGFkZDogYm9vbGVhbik6IHZvaWQge1xuXHRcdGFkZFRvVmFsdWVUcmVlKHRoaXMuY29udGVudHMsIGtleSwgdmFsdWUsIGUgPT4gdGhpcy5sb2dTZXJ2aWNlLmVycm9yKGUpKTtcblx0XHRhZGQgPSBhZGQgfHwgdGhpcy5rZXlzLmluZGV4T2Yoa2V5KSA9PT0gLTE7XG5cdFx0aWYgKGFkZCkge1xuXHRcdFx0dGhpcy5rZXlzLnB1c2goa2V5KTtcblx0XHR9XG5cdFx0aWYgKE9WRVJSSURFX1BST1BFUlRZX1JFR0VYLnRlc3Qoa2V5KSkge1xuXHRcdFx0Y29uc3QgaWRlbnRpZmllcnMgPSBvdmVycmlkZUlkZW50aWZpZXJzRnJvbUtleShrZXkpO1xuXHRcdFx0Y29uc3Qgb3ZlcnJpZGUgPSB7XG5cdFx0XHRcdGlkZW50aWZpZXJzLFxuXHRcdFx0XHRrZXlzOiBPYmplY3Qua2V5cyh0aGlzLmNvbnRlbnRzW2tleV0pLFxuXHRcdFx0XHRjb250ZW50czogdG9WYWx1ZXNUcmVlKHRoaXMuY29udGVudHNba2V5XSwgbWVzc2FnZSA9PiB0aGlzLmxvZ1NlcnZpY2UuZXJyb3IobWVzc2FnZSkpLFxuXHRcdFx0fTtcblx0XHRcdGNvbnN0IGluZGV4ID0gdGhpcy5vdmVycmlkZXMuZmluZEluZGV4KG8gPT4gYXJyYXlzLmVxdWFscyhvLmlkZW50aWZpZXJzLCBpZGVudGlmaWVycykpO1xuXHRcdFx0aWYgKGluZGV4ICE9PSAtMSkge1xuXHRcdFx0XHR0aGlzLm92ZXJyaWRlc1tpbmRleF0gPSBvdmVycmlkZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMub3ZlcnJpZGVzLnB1c2gob3ZlcnJpZGUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIENvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnMge1xuXHRza2lwVW5yZWdpc3RlcmVkPzogYm9vbGVhbjtcblx0c2NvcGVzPzogQ29uZmlndXJhdGlvblNjb3BlW107XG5cdHNraXBSZXN0cmljdGVkPzogYm9vbGVhbjtcblx0aW5jbHVkZT86IHN0cmluZ1tdO1xuXHRleGNsdWRlPzogc3RyaW5nW107XG59XG5cbmV4cG9ydCBjbGFzcyBDb25maWd1cmF0aW9uTW9kZWxQYXJzZXIge1xuXG5cdHByaXZhdGUgX3JhdzogYW55ID0gbnVsbDtcblx0cHJpdmF0ZSBfY29uZmlndXJhdGlvbk1vZGVsOiBDb25maWd1cmF0aW9uTW9kZWwgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBfcmVzdHJpY3RlZENvbmZpZ3VyYXRpb25zOiBzdHJpbmdbXSA9IFtdO1xuXHRwcml2YXRlIF9wYXJzZUVycm9yczogYW55W10gPSBbXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgX25hbWU6IHN0cmluZyxcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2Vcblx0KSB7IH1cblxuXHRnZXQgY29uZmlndXJhdGlvbk1vZGVsKCk6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbmZpZ3VyYXRpb25Nb2RlbCB8fCBDb25maWd1cmF0aW9uTW9kZWwuY3JlYXRlRW1wdHlNb2RlbCh0aGlzLmxvZ1NlcnZpY2UpO1xuXHR9XG5cblx0Z2V0IHJlc3RyaWN0ZWRDb25maWd1cmF0aW9ucygpOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX3Jlc3RyaWN0ZWRDb25maWd1cmF0aW9ucztcblx0fVxuXG5cdGdldCBlcnJvcnMoKTogYW55W10ge1xuXHRcdHJldHVybiB0aGlzLl9wYXJzZUVycm9ycztcblx0fVxuXG5cdHB1YmxpYyBwYXJzZShjb250ZW50OiBzdHJpbmcgfCBudWxsIHwgdW5kZWZpbmVkLCBvcHRpb25zPzogQ29uZmlndXJhdGlvblBhcnNlT3B0aW9ucyk6IHZvaWQge1xuXHRcdGlmICghdHlwZXMuaXNVbmRlZmluZWRPck51bGwoY29udGVudCkpIHtcblx0XHRcdGNvbnN0IHJhdyA9IHRoaXMuZG9QYXJzZUNvbnRlbnQoY29udGVudCk7XG5cdFx0XHR0aGlzLnBhcnNlUmF3KHJhdywgb3B0aW9ucyk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHJlcGFyc2Uob3B0aW9uczogQ29uZmlndXJhdGlvblBhcnNlT3B0aW9ucyk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9yYXcpIHtcblx0XHRcdHRoaXMucGFyc2VSYXcodGhpcy5fcmF3LCBvcHRpb25zKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgcGFyc2VSYXcocmF3OiBhbnksIG9wdGlvbnM/OiBDb25maWd1cmF0aW9uUGFyc2VPcHRpb25zKTogdm9pZCB7XG5cdFx0dGhpcy5fcmF3ID0gcmF3O1xuXHRcdGNvbnN0IHsgY29udGVudHMsIGtleXMsIG92ZXJyaWRlcywgcmVzdHJpY3RlZCwgaGFzRXhjbHVkZWRQcm9wZXJ0aWVzIH0gPSB0aGlzLmRvUGFyc2VSYXcocmF3LCBvcHRpb25zKTtcblx0XHR0aGlzLl9jb25maWd1cmF0aW9uTW9kZWwgPSBuZXcgQ29uZmlndXJhdGlvbk1vZGVsKGNvbnRlbnRzLCBrZXlzLCBvdmVycmlkZXMsIGhhc0V4Y2x1ZGVkUHJvcGVydGllcyA/IFtyYXddIDogdW5kZWZpbmVkIC8qIHJhdyBoYXMgbm90IGNoYW5nZWQgKi8sIHRoaXMubG9nU2VydmljZSk7XG5cdFx0dGhpcy5fcmVzdHJpY3RlZENvbmZpZ3VyYXRpb25zID0gcmVzdHJpY3RlZCB8fCBbXTtcblx0fVxuXG5cdHByaXZhdGUgZG9QYXJzZUNvbnRlbnQoY29udGVudDogc3RyaW5nKTogYW55IHtcblx0XHRsZXQgcmF3OiBhbnkgPSB7fTtcblx0XHRsZXQgY3VycmVudFByb3BlcnR5OiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblx0XHRsZXQgY3VycmVudFBhcmVudDogYW55ID0gW107XG5cdFx0Y29uc3QgcHJldmlvdXNQYXJlbnRzOiBhbnlbXSA9IFtdO1xuXHRcdGNvbnN0IHBhcnNlRXJyb3JzOiBqc29uLlBhcnNlRXJyb3JbXSA9IFtdO1xuXG5cdFx0ZnVuY3Rpb24gb25WYWx1ZSh2YWx1ZTogYW55KSB7XG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShjdXJyZW50UGFyZW50KSkge1xuXHRcdFx0XHQoPGFueVtdPmN1cnJlbnRQYXJlbnQpLnB1c2godmFsdWUpO1xuXHRcdFx0fSBlbHNlIGlmIChjdXJyZW50UHJvcGVydHkgIT09IG51bGwpIHtcblx0XHRcdFx0Y3VycmVudFBhcmVudFtjdXJyZW50UHJvcGVydHldID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgdmlzaXRvcjoganNvbi5KU09OVmlzaXRvciA9IHtcblx0XHRcdG9uT2JqZWN0QmVnaW46ICgpID0+IHtcblx0XHRcdFx0Y29uc3Qgb2JqZWN0ID0ge307XG5cdFx0XHRcdG9uVmFsdWUob2JqZWN0KTtcblx0XHRcdFx0cHJldmlvdXNQYXJlbnRzLnB1c2goY3VycmVudFBhcmVudCk7XG5cdFx0XHRcdGN1cnJlbnRQYXJlbnQgPSBvYmplY3Q7XG5cdFx0XHRcdGN1cnJlbnRQcm9wZXJ0eSA9IG51bGw7XG5cdFx0XHR9LFxuXHRcdFx0b25PYmplY3RQcm9wZXJ0eTogKG5hbWU6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRjdXJyZW50UHJvcGVydHkgPSBuYW1lO1xuXHRcdFx0fSxcblx0XHRcdG9uT2JqZWN0RW5kOiAoKSA9PiB7XG5cdFx0XHRcdGN1cnJlbnRQYXJlbnQgPSBwcmV2aW91c1BhcmVudHMucG9wKCk7XG5cdFx0XHR9LFxuXHRcdFx0b25BcnJheUJlZ2luOiAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGFycmF5OiBhbnlbXSA9IFtdO1xuXHRcdFx0XHRvblZhbHVlKGFycmF5KTtcblx0XHRcdFx0cHJldmlvdXNQYXJlbnRzLnB1c2goY3VycmVudFBhcmVudCk7XG5cdFx0XHRcdGN1cnJlbnRQYXJlbnQgPSBhcnJheTtcblx0XHRcdFx0Y3VycmVudFByb3BlcnR5ID0gbnVsbDtcblx0XHRcdH0sXG5cdFx0XHRvbkFycmF5RW5kOiAoKSA9PiB7XG5cdFx0XHRcdGN1cnJlbnRQYXJlbnQgPSBwcmV2aW91c1BhcmVudHMucG9wKCk7XG5cdFx0XHR9LFxuXHRcdFx0b25MaXRlcmFsVmFsdWU6IG9uVmFsdWUsXG5cdFx0XHRvbkVycm9yOiAoZXJyb3I6IGpzb24uUGFyc2VFcnJvckNvZGUsIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlcikgPT4ge1xuXHRcdFx0XHRwYXJzZUVycm9ycy5wdXNoKHsgZXJyb3IsIG9mZnNldCwgbGVuZ3RoIH0pO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0aWYgKGNvbnRlbnQpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGpzb24udmlzaXQoY29udGVudCwgdmlzaXRvcik7XG5cdFx0XHRcdHJhdyA9IGN1cnJlbnRQYXJlbnRbMF0gfHwge307XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihgRXJyb3Igd2hpbGUgcGFyc2luZyBzZXR0aW5ncyBmaWxlICR7dGhpcy5fbmFtZX06ICR7ZX1gKTtcblx0XHRcdFx0dGhpcy5fcGFyc2VFcnJvcnMgPSBbZV07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJhdztcblx0fVxuXG5cdHByb3RlY3RlZCBkb1BhcnNlUmF3KHJhdzogYW55LCBvcHRpb25zPzogQ29uZmlndXJhdGlvblBhcnNlT3B0aW9ucyk6IElDb25maWd1cmF0aW9uTW9kZWwgJiB7IHJlc3RyaWN0ZWQ/OiBzdHJpbmdbXTsgaGFzRXhjbHVkZWRQcm9wZXJ0aWVzPzogYm9vbGVhbiB9IHtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uUHJvcGVydGllcyA9IFJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KEV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbikuZ2V0Q29uZmlndXJhdGlvblByb3BlcnRpZXMoKTtcblx0XHRjb25zdCBmaWx0ZXJlZCA9IHRoaXMuZmlsdGVyKHJhdywgY29uZmlndXJhdGlvblByb3BlcnRpZXMsIHRydWUsIG9wdGlvbnMpO1xuXHRcdHJhdyA9IGZpbHRlcmVkLnJhdztcblx0XHRjb25zdCBjb250ZW50cyA9IHRvVmFsdWVzVHJlZShyYXcsIG1lc3NhZ2UgPT4gdGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBDb25mbGljdCBpbiBzZXR0aW5ncyBmaWxlICR7dGhpcy5fbmFtZX06ICR7bWVzc2FnZX1gKSk7XG5cdFx0Y29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHJhdyk7XG5cdFx0Y29uc3Qgb3ZlcnJpZGVzID0gdGhpcy50b092ZXJyaWRlcyhyYXcsIG1lc3NhZ2UgPT4gdGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBDb25mbGljdCBpbiBzZXR0aW5ncyBmaWxlICR7dGhpcy5fbmFtZX06ICR7bWVzc2FnZX1gKSk7XG5cdFx0cmV0dXJuIHsgY29udGVudHMsIGtleXMsIG92ZXJyaWRlcywgcmVzdHJpY3RlZDogZmlsdGVyZWQucmVzdHJpY3RlZCwgaGFzRXhjbHVkZWRQcm9wZXJ0aWVzOiBmaWx0ZXJlZC5oYXNFeGNsdWRlZFByb3BlcnRpZXMgfTtcblx0fVxuXG5cdHByaXZhdGUgZmlsdGVyKHByb3BlcnRpZXM6IGFueSwgY29uZmlndXJhdGlvblByb3BlcnRpZXM6IHsgW3F1YWxpZmllZEtleTogc3RyaW5nXTogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSB8IHVuZGVmaW5lZCB9LCBmaWx0ZXJPdmVycmlkZGVuUHJvcGVydGllczogYm9vbGVhbiwgb3B0aW9ucz86IENvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnMpOiB7IHJhdzoge307IHJlc3RyaWN0ZWQ6IHN0cmluZ1tdOyBoYXNFeGNsdWRlZFByb3BlcnRpZXM6IGJvb2xlYW4gfSB7XG5cdFx0bGV0IGhhc0V4Y2x1ZGVkUHJvcGVydGllcyA9IGZhbHNlO1xuXHRcdGlmICghb3B0aW9ucz8uc2NvcGVzICYmICFvcHRpb25zPy5za2lwUmVzdHJpY3RlZCAmJiAhb3B0aW9ucz8uZXhjbHVkZT8ubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4geyByYXc6IHByb3BlcnRpZXMsIHJlc3RyaWN0ZWQ6IFtdLCBoYXNFeGNsdWRlZFByb3BlcnRpZXMgfTtcblx0XHR9XG5cdFx0Y29uc3QgcmF3OiBhbnkgPSB7fTtcblx0XHRjb25zdCByZXN0cmljdGVkOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGZvciAoY29uc3Qga2V5IGluIHByb3BlcnRpZXMpIHtcblx0XHRcdGlmIChPVkVSUklERV9QUk9QRVJUWV9SRUdFWC50ZXN0KGtleSkgJiYgZmlsdGVyT3ZlcnJpZGRlblByb3BlcnRpZXMpIHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5maWx0ZXIocHJvcGVydGllc1trZXldLCBjb25maWd1cmF0aW9uUHJvcGVydGllcywgZmFsc2UsIG9wdGlvbnMpO1xuXHRcdFx0XHRyYXdba2V5XSA9IHJlc3VsdC5yYXc7XG5cdFx0XHRcdGhhc0V4Y2x1ZGVkUHJvcGVydGllcyA9IGhhc0V4Y2x1ZGVkUHJvcGVydGllcyB8fCByZXN1bHQuaGFzRXhjbHVkZWRQcm9wZXJ0aWVzO1xuXHRcdFx0XHRyZXN0cmljdGVkLnB1c2goLi4ucmVzdWx0LnJlc3RyaWN0ZWQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc3QgcHJvcGVydHlTY2hlbWEgPSBjb25maWd1cmF0aW9uUHJvcGVydGllc1trZXldO1xuXHRcdFx0XHRpZiAocHJvcGVydHlTY2hlbWE/LnJlc3RyaWN0ZWQpIHtcblx0XHRcdFx0XHRyZXN0cmljdGVkLnB1c2goa2V5KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodGhpcy5zaG91bGRJbmNsdWRlKGtleSwgcHJvcGVydHlTY2hlbWEsIG9wdGlvbnMpKSB7XG5cdFx0XHRcdFx0cmF3W2tleV0gPSBwcm9wZXJ0aWVzW2tleV07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aGFzRXhjbHVkZWRQcm9wZXJ0aWVzID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4geyByYXcsIHJlc3RyaWN0ZWQsIGhhc0V4Y2x1ZGVkUHJvcGVydGllcyB9O1xuXHR9XG5cblx0cHJpdmF0ZSBzaG91bGRJbmNsdWRlKGtleTogc3RyaW5nLCBwcm9wZXJ0eVNjaGVtYTogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSB8IHVuZGVmaW5lZCwgb3B0aW9uczogQ29uZmlndXJhdGlvblBhcnNlT3B0aW9ucyk6IGJvb2xlYW4ge1xuXHRcdGlmIChvcHRpb25zLmV4Y2x1ZGU/LmluY2x1ZGVzKGtleSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAob3B0aW9ucy5pbmNsdWRlPy5pbmNsdWRlcyhrZXkpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRpZiAob3B0aW9ucy5za2lwUmVzdHJpY3RlZCAmJiBwcm9wZXJ0eVNjaGVtYT8ucmVzdHJpY3RlZCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmIChvcHRpb25zLnNraXBVbnJlZ2lzdGVyZWQgJiYgIXByb3BlcnR5U2NoZW1hKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2NvcGUgPSBwcm9wZXJ0eVNjaGVtYSA/IHR5cGVvZiBwcm9wZXJ0eVNjaGVtYS5zY29wZSAhPT0gJ3VuZGVmaW5lZCcgPyBwcm9wZXJ0eVNjaGVtYS5zY29wZSA6IENvbmZpZ3VyYXRpb25TY29wZS5XSU5ET1cgOiB1bmRlZmluZWQ7XG5cdFx0aWYgKHNjb3BlID09PSB1bmRlZmluZWQgfHwgb3B0aW9ucy5zY29wZXMgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG9wdGlvbnMuc2NvcGVzLmluY2x1ZGVzKHNjb3BlKTtcblx0fVxuXG5cdHByaXZhdGUgdG9PdmVycmlkZXMocmF3OiBhbnksIGNvbmZsaWN0UmVwb3J0ZXI6IChtZXNzYWdlOiBzdHJpbmcpID0+IHZvaWQpOiBJT3ZlcnJpZGVzW10ge1xuXHRcdGNvbnN0IG92ZXJyaWRlczogSU92ZXJyaWRlc1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMocmF3KSkge1xuXHRcdFx0aWYgKE9WRVJSSURFX1BST1BFUlRZX1JFR0VYLnRlc3Qoa2V5KSkge1xuXHRcdFx0XHRjb25zdCBvdmVycmlkZVJhdzogYW55ID0ge307XG5cdFx0XHRcdGZvciAoY29uc3Qga2V5SW5PdmVycmlkZVJhdyBpbiByYXdba2V5XSkge1xuXHRcdFx0XHRcdG92ZXJyaWRlUmF3W2tleUluT3ZlcnJpZGVSYXddID0gcmF3W2tleV1ba2V5SW5PdmVycmlkZVJhd107XG5cdFx0XHRcdH1cblx0XHRcdFx0b3ZlcnJpZGVzLnB1c2goe1xuXHRcdFx0XHRcdGlkZW50aWZpZXJzOiBvdmVycmlkZUlkZW50aWZpZXJzRnJvbUtleShrZXkpLFxuXHRcdFx0XHRcdGtleXM6IE9iamVjdC5rZXlzKG92ZXJyaWRlUmF3KSxcblx0XHRcdFx0XHRjb250ZW50czogdG9WYWx1ZXNUcmVlKG92ZXJyaWRlUmF3LCBjb25mbGljdFJlcG9ydGVyKVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG92ZXJyaWRlcztcblx0fVxuXG59XG5cbmV4cG9ydCBjbGFzcyBVc2VyU2V0dGluZ3MgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHBhcnNlcjogQ29uZmlndXJhdGlvbk1vZGVsUGFyc2VyO1xuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkQ2hhbmdlOiBFbWl0dGVyPHZvaWQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdXNlclNldHRpbmdzUmVzb3VyY2U6IFVSSSxcblx0XHRwcm90ZWN0ZWQgcGFyc2VPcHRpb25zOiBDb25maWd1cmF0aW9uUGFyc2VPcHRpb25zLFxuXHRcdGV4dFVyaTogSUV4dFVyaSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnBhcnNlciA9IG5ldyBDb25maWd1cmF0aW9uTW9kZWxQYXJzZXIodGhpcy51c2VyU2V0dGluZ3NSZXNvdXJjZS50b1N0cmluZygpLCBsb2dTZXJ2aWNlKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVTZXJ2aWNlLndhdGNoKGV4dFVyaS5kaXJuYW1lKHRoaXMudXNlclNldHRpbmdzUmVzb3VyY2UpKSk7XG5cdFx0Ly8gQWxzbyBsaXN0ZW4gdG8gdGhlIHJlc291cmNlIGluY2FzZSB0aGUgcmVzb3VyY2UgaXMgYSBzeW1saW5rIC0gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzExODEzNFxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZmlsZVNlcnZpY2Uud2F0Y2godGhpcy51c2VyU2V0dGluZ3NSZXNvdXJjZSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmFueShcblx0XHRcdEV2ZW50LmZpbHRlcih0aGlzLmZpbGVTZXJ2aWNlLm9uRGlkRmlsZXNDaGFuZ2UsIGUgPT4gZS5jb250YWlucyh0aGlzLnVzZXJTZXR0aW5nc1Jlc291cmNlKSksXG5cdFx0XHRFdmVudC5maWx0ZXIodGhpcy5maWxlU2VydmljZS5vbkRpZFJ1bk9wZXJhdGlvbiwgZSA9PiAoZS5pc09wZXJhdGlvbihGaWxlT3BlcmF0aW9uLkNSRUFURSkgfHwgZS5pc09wZXJhdGlvbihGaWxlT3BlcmF0aW9uLkNPUFkpIHx8IGUuaXNPcGVyYXRpb24oRmlsZU9wZXJhdGlvbi5ERUxFVEUpIHx8IGUuaXNPcGVyYXRpb24oRmlsZU9wZXJhdGlvbi5XUklURSkpICYmIGV4dFVyaS5pc0VxdWFsKGUucmVzb3VyY2UsIHVzZXJTZXR0aW5nc1Jlc291cmNlKSlcblx0XHQpKCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKSkpO1xuXHR9XG5cblx0YXN5bmMgbG9hZENvbmZpZ3VyYXRpb24oKTogUHJvbWlzZTxDb25maWd1cmF0aW9uTW9kZWw+IHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UucmVhZEZpbGUodGhpcy51c2VyU2V0dGluZ3NSZXNvdXJjZSk7XG5cdFx0XHR0aGlzLnBhcnNlci5wYXJzZShjb250ZW50LnZhbHVlLnRvU3RyaW5nKCkgfHwgJ3t9JywgdGhpcy5wYXJzZU9wdGlvbnMpO1xuXHRcdFx0cmV0dXJuIHRoaXMucGFyc2VyLmNvbmZpZ3VyYXRpb25Nb2RlbDtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRyZXR1cm4gQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwodGhpcy5sb2dTZXJ2aWNlKTtcblx0XHR9XG5cdH1cblxuXHRyZXBhcnNlKHBhcnNlT3B0aW9ucz86IENvbmZpZ3VyYXRpb25QYXJzZU9wdGlvbnMpOiBDb25maWd1cmF0aW9uTW9kZWwge1xuXHRcdGlmIChwYXJzZU9wdGlvbnMpIHtcblx0XHRcdHRoaXMucGFyc2VPcHRpb25zID0gcGFyc2VPcHRpb25zO1xuXHRcdH1cblx0XHR0aGlzLnBhcnNlci5yZXBhcnNlKHRoaXMucGFyc2VPcHRpb25zKTtcblx0XHRyZXR1cm4gdGhpcy5wYXJzZXIuY29uZmlndXJhdGlvbk1vZGVsO1xuXHR9XG5cblx0Z2V0UmVzdHJpY3RlZFNldHRpbmdzKCk6IHN0cmluZ1tdIHtcblx0XHRyZXR1cm4gdGhpcy5wYXJzZXIucmVzdHJpY3RlZENvbmZpZ3VyYXRpb25zO1xuXHR9XG59XG5cbmNsYXNzIENvbmZpZ3VyYXRpb25JbnNwZWN0VmFsdWU8Vj4gaW1wbGVtZW50cyBJQ29uZmlndXJhdGlvblZhbHVlPFY+IHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGtleTogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgb3ZlcnJpZGVzOiBJQ29uZmlndXJhdGlvbk92ZXJyaWRlcyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF92YWx1ZTogViB8IHVuZGVmaW5lZCxcblx0XHRyZWFkb25seSBvdmVycmlkZUlkZW50aWZpZXJzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGRlZmF1bHRDb25maWd1cmF0aW9uOiBDb25maWd1cmF0aW9uTW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBwb2xpY3lDb25maWd1cmF0aW9uOiBDb25maWd1cmF0aW9uTW9kZWwgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBhcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb246IENvbmZpZ3VyYXRpb25Nb2RlbCB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHVzZXJDb25maWd1cmF0aW9uOiBDb25maWd1cmF0aW9uTW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBsb2NhbFVzZXJDb25maWd1cmF0aW9uOiBDb25maWd1cmF0aW9uTW9kZWwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSByZW1vdGVVc2VyQ29uZmlndXJhdGlvbjogQ29uZmlndXJhdGlvbk1vZGVsLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlQ29uZmlndXJhdGlvbjogQ29uZmlndXJhdGlvbk1vZGVsIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZm9sZGVyQ29uZmlndXJhdGlvbk1vZGVsOiBDb25maWd1cmF0aW9uTW9kZWwgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBtZW1vcnlDb25maWd1cmF0aW9uTW9kZWw6IENvbmZpZ3VyYXRpb25Nb2RlbFxuXHQpIHtcblx0fVxuXG5cdGdldCB2YWx1ZSgpOiBWIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gZnJlZXplKHRoaXMuX3ZhbHVlKTtcblx0fVxuXG5cdHByaXZhdGUgdG9JbnNwZWN0VmFsdWUoaW5zcGVjdFZhbHVlOiBJSW5zcGVjdFZhbHVlPFY+IHwgdW5kZWZpbmVkIHwgbnVsbCk6IElJbnNwZWN0VmFsdWU8Vj4gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBpbnNwZWN0VmFsdWU/LnZhbHVlICE9PSB1bmRlZmluZWQgfHwgaW5zcGVjdFZhbHVlPy5vdmVycmlkZSAhPT0gdW5kZWZpbmVkIHx8IGluc3BlY3RWYWx1ZT8ub3ZlcnJpZGVzICE9PSB1bmRlZmluZWQgPyBpbnNwZWN0VmFsdWUgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9kZWZhdWx0SW5zcGVjdFZhbHVlOiBJbnNwZWN0VmFsdWU8Vj4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZ2V0IGRlZmF1bHRJbnNwZWN0VmFsdWUoKTogSW5zcGVjdFZhbHVlPFY+IHtcblx0XHRpZiAoIXRoaXMuX2RlZmF1bHRJbnNwZWN0VmFsdWUpIHtcblx0XHRcdHRoaXMuX2RlZmF1bHRJbnNwZWN0VmFsdWUgPSB0aGlzLmRlZmF1bHRDb25maWd1cmF0aW9uLmluc3BlY3Q8Vj4odGhpcy5rZXksIHRoaXMub3ZlcnJpZGVzLm92ZXJyaWRlSWRlbnRpZmllcik7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9kZWZhdWx0SW5zcGVjdFZhbHVlO1xuXHR9XG5cblx0Z2V0IGRlZmF1bHRWYWx1ZSgpOiBWIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5kZWZhdWx0SW5zcGVjdFZhbHVlLm1lcmdlZDtcblx0fVxuXG5cdGdldCBkZWZhdWx0KCk6IElJbnNwZWN0VmFsdWU8Vj4gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnRvSW5zcGVjdFZhbHVlKHRoaXMuZGVmYXVsdEluc3BlY3RWYWx1ZSk7XG5cdH1cblxuXHRwcml2YXRlIF9wb2xpY3lJbnNwZWN0VmFsdWU6IEluc3BlY3RWYWx1ZTxWPiB8IHVuZGVmaW5lZCB8IG51bGw7XG5cdHByaXZhdGUgZ2V0IHBvbGljeUluc3BlY3RWYWx1ZSgpOiBJbnNwZWN0VmFsdWU8Vj4gfCBudWxsIHtcblx0XHRpZiAodGhpcy5fcG9saWN5SW5zcGVjdFZhbHVlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX3BvbGljeUluc3BlY3RWYWx1ZSA9IHRoaXMucG9saWN5Q29uZmlndXJhdGlvbiA/IHRoaXMucG9saWN5Q29uZmlndXJhdGlvbi5pbnNwZWN0PFY+KHRoaXMua2V5KSA6IG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9wb2xpY3lJbnNwZWN0VmFsdWU7XG5cdH1cblxuXHRnZXQgcG9saWN5VmFsdWUoKTogViB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMucG9saWN5SW5zcGVjdFZhbHVlPy5tZXJnZWQ7XG5cdH1cblxuXHRnZXQgcG9saWN5KCk6IElJbnNwZWN0VmFsdWU8Vj4gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnBvbGljeUluc3BlY3RWYWx1ZT8udmFsdWUgIT09IHVuZGVmaW5lZCA/IHsgdmFsdWU6IHRoaXMucG9saWN5SW5zcGVjdFZhbHVlLnZhbHVlIH0gOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9hcHBsaWNhdGlvbkluc3BlY3RWYWx1ZTogSW5zcGVjdFZhbHVlPFY+IHwgdW5kZWZpbmVkIHwgbnVsbDtcblx0cHJpdmF0ZSBnZXQgYXBwbGljYXRpb25JbnNwZWN0VmFsdWUoKTogSW5zcGVjdFZhbHVlPFY+IHwgbnVsbCB7XG5cdFx0aWYgKHRoaXMuX2FwcGxpY2F0aW9uSW5zcGVjdFZhbHVlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX2FwcGxpY2F0aW9uSW5zcGVjdFZhbHVlID0gdGhpcy5hcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb24gPyB0aGlzLmFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbi5pbnNwZWN0PFY+KHRoaXMua2V5KSA6IG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9hcHBsaWNhdGlvbkluc3BlY3RWYWx1ZTtcblx0fVxuXG5cdGdldCBhcHBsaWNhdGlvblZhbHVlKCk6IFYgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmFwcGxpY2F0aW9uSW5zcGVjdFZhbHVlPy5tZXJnZWQ7XG5cdH1cblxuXHRnZXQgYXBwbGljYXRpb24oKTogSUluc3BlY3RWYWx1ZTxWPiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMudG9JbnNwZWN0VmFsdWUodGhpcy5hcHBsaWNhdGlvbkluc3BlY3RWYWx1ZSk7XG5cdH1cblxuXHRwcml2YXRlIF91c2VySW5zcGVjdFZhbHVlOiBJbnNwZWN0VmFsdWU8Vj4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZ2V0IHVzZXJJbnNwZWN0VmFsdWUoKTogSW5zcGVjdFZhbHVlPFY+IHtcblx0XHRpZiAoIXRoaXMuX3VzZXJJbnNwZWN0VmFsdWUpIHtcblx0XHRcdHRoaXMuX3VzZXJJbnNwZWN0VmFsdWUgPSB0aGlzLnVzZXJDb25maWd1cmF0aW9uLmluc3BlY3Q8Vj4odGhpcy5rZXksIHRoaXMub3ZlcnJpZGVzLm92ZXJyaWRlSWRlbnRpZmllcik7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl91c2VySW5zcGVjdFZhbHVlO1xuXHR9XG5cblx0Z2V0IHVzZXJWYWx1ZSgpOiBWIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy51c2VySW5zcGVjdFZhbHVlLm1lcmdlZDtcblx0fVxuXG5cdGdldCB1c2VyKCk6IElJbnNwZWN0VmFsdWU8Vj4gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnRvSW5zcGVjdFZhbHVlKHRoaXMudXNlckluc3BlY3RWYWx1ZSk7XG5cdH1cblxuXHRwcml2YXRlIF91c2VyTG9jYWxJbnNwZWN0VmFsdWU6IEluc3BlY3RWYWx1ZTxWPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBnZXQgdXNlckxvY2FsSW5zcGVjdFZhbHVlKCk6IEluc3BlY3RWYWx1ZTxWPiB7XG5cdFx0aWYgKCF0aGlzLl91c2VyTG9jYWxJbnNwZWN0VmFsdWUpIHtcblx0XHRcdHRoaXMuX3VzZXJMb2NhbEluc3BlY3RWYWx1ZSA9IHRoaXMubG9jYWxVc2VyQ29uZmlndXJhdGlvbi5pbnNwZWN0PFY+KHRoaXMua2V5LCB0aGlzLm92ZXJyaWRlcy5vdmVycmlkZUlkZW50aWZpZXIpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fdXNlckxvY2FsSW5zcGVjdFZhbHVlO1xuXHR9XG5cblx0Z2V0IHVzZXJMb2NhbFZhbHVlKCk6IFYgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnVzZXJMb2NhbEluc3BlY3RWYWx1ZS5tZXJnZWQ7XG5cdH1cblxuXHRnZXQgdXNlckxvY2FsKCk6IElJbnNwZWN0VmFsdWU8Vj4gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnRvSW5zcGVjdFZhbHVlKHRoaXMudXNlckxvY2FsSW5zcGVjdFZhbHVlKTtcblx0fVxuXG5cdHByaXZhdGUgX3VzZXJSZW1vdGVJbnNwZWN0VmFsdWU6IEluc3BlY3RWYWx1ZTxWPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBnZXQgdXNlclJlbW90ZUluc3BlY3RWYWx1ZSgpOiBJbnNwZWN0VmFsdWU8Vj4ge1xuXHRcdGlmICghdGhpcy5fdXNlclJlbW90ZUluc3BlY3RWYWx1ZSkge1xuXHRcdFx0dGhpcy5fdXNlclJlbW90ZUluc3BlY3RWYWx1ZSA9IHRoaXMucmVtb3RlVXNlckNvbmZpZ3VyYXRpb24uaW5zcGVjdDxWPih0aGlzLmtleSwgdGhpcy5vdmVycmlkZXMub3ZlcnJpZGVJZGVudGlmaWVyKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3VzZXJSZW1vdGVJbnNwZWN0VmFsdWU7XG5cdH1cblxuXHRnZXQgdXNlclJlbW90ZVZhbHVlKCk6IFYgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnVzZXJSZW1vdGVJbnNwZWN0VmFsdWUubWVyZ2VkO1xuXHR9XG5cblx0Z2V0IHVzZXJSZW1vdGUoKTogSUluc3BlY3RWYWx1ZTxWPiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMudG9JbnNwZWN0VmFsdWUodGhpcy51c2VyUmVtb3RlSW5zcGVjdFZhbHVlKTtcblx0fVxuXG5cdHByaXZhdGUgX3dvcmtzcGFjZUluc3BlY3RWYWx1ZTogSW5zcGVjdFZhbHVlPFY+IHwgdW5kZWZpbmVkIHwgbnVsbDtcblx0cHJpdmF0ZSBnZXQgd29ya3NwYWNlSW5zcGVjdFZhbHVlKCk6IEluc3BlY3RWYWx1ZTxWPiB8IG51bGwge1xuXHRcdGlmICh0aGlzLl93b3Jrc3BhY2VJbnNwZWN0VmFsdWUgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5fd29ya3NwYWNlSW5zcGVjdFZhbHVlID0gdGhpcy53b3Jrc3BhY2VDb25maWd1cmF0aW9uID8gdGhpcy53b3Jrc3BhY2VDb25maWd1cmF0aW9uLmluc3BlY3Q8Vj4odGhpcy5rZXksIHRoaXMub3ZlcnJpZGVzLm92ZXJyaWRlSWRlbnRpZmllcikgOiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fd29ya3NwYWNlSW5zcGVjdFZhbHVlO1xuXHR9XG5cblx0Z2V0IHdvcmtzcGFjZVZhbHVlKCk6IFYgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLndvcmtzcGFjZUluc3BlY3RWYWx1ZT8ubWVyZ2VkO1xuXHR9XG5cblx0Z2V0IHdvcmtzcGFjZSgpOiBJSW5zcGVjdFZhbHVlPFY+IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy50b0luc3BlY3RWYWx1ZSh0aGlzLndvcmtzcGFjZUluc3BlY3RWYWx1ZSk7XG5cdH1cblxuXHRwcml2YXRlIF93b3Jrc3BhY2VGb2xkZXJJbnNwZWN0VmFsdWU6IEluc3BlY3RWYWx1ZTxWPiB8IHVuZGVmaW5lZCB8IG51bGw7XG5cdHByaXZhdGUgZ2V0IHdvcmtzcGFjZUZvbGRlckluc3BlY3RWYWx1ZSgpOiBJbnNwZWN0VmFsdWU8Vj4gfCBudWxsIHtcblx0XHRpZiAodGhpcy5fd29ya3NwYWNlRm9sZGVySW5zcGVjdFZhbHVlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX3dvcmtzcGFjZUZvbGRlckluc3BlY3RWYWx1ZSA9IHRoaXMuZm9sZGVyQ29uZmlndXJhdGlvbk1vZGVsID8gdGhpcy5mb2xkZXJDb25maWd1cmF0aW9uTW9kZWwuaW5zcGVjdDxWPih0aGlzLmtleSwgdGhpcy5vdmVycmlkZXMub3ZlcnJpZGVJZGVudGlmaWVyKSA6IG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl93b3Jrc3BhY2VGb2xkZXJJbnNwZWN0VmFsdWU7XG5cdH1cblxuXHRnZXQgd29ya3NwYWNlRm9sZGVyVmFsdWUoKTogViB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMud29ya3NwYWNlRm9sZGVySW5zcGVjdFZhbHVlPy5tZXJnZWQ7XG5cdH1cblxuXHRnZXQgd29ya3NwYWNlRm9sZGVyKCk6IElJbnNwZWN0VmFsdWU8Vj4gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLnRvSW5zcGVjdFZhbHVlKHRoaXMud29ya3NwYWNlRm9sZGVySW5zcGVjdFZhbHVlKTtcblx0fVxuXG5cdHByaXZhdGUgX21lbW9yeUluc3BlY3RWYWx1ZTogSW5zcGVjdFZhbHVlPFY+IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIGdldCBtZW1vcnlJbnNwZWN0VmFsdWUoKTogSW5zcGVjdFZhbHVlPFY+IHtcblx0XHRpZiAodGhpcy5fbWVtb3J5SW5zcGVjdFZhbHVlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuX21lbW9yeUluc3BlY3RWYWx1ZSA9IHRoaXMubWVtb3J5Q29uZmlndXJhdGlvbk1vZGVsLmluc3BlY3Q8Vj4odGhpcy5rZXksIHRoaXMub3ZlcnJpZGVzLm92ZXJyaWRlSWRlbnRpZmllcik7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9tZW1vcnlJbnNwZWN0VmFsdWU7XG5cdH1cblxuXHRnZXQgbWVtb3J5VmFsdWUoKTogViB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMubWVtb3J5SW5zcGVjdFZhbHVlLm1lcmdlZDtcblx0fVxuXG5cdGdldCBtZW1vcnkoKTogSUluc3BlY3RWYWx1ZTxWPiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMudG9JbnNwZWN0VmFsdWUodGhpcy5tZW1vcnlJbnNwZWN0VmFsdWUpO1xuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIENvbmZpZ3VyYXRpb24ge1xuXG5cdHByaXZhdGUgX3dvcmtzcGFjZUNvbnNvbGlkYXRlZENvbmZpZ3VyYXRpb246IENvbmZpZ3VyYXRpb25Nb2RlbCB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF9mb2xkZXJzQ29uc29saWRhdGVkQ29uZmlndXJhdGlvbnMgPSBuZXcgUmVzb3VyY2VNYXA8Q29uZmlndXJhdGlvbk1vZGVsPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgX2RlZmF1bHRDb25maWd1cmF0aW9uOiBDb25maWd1cmF0aW9uTW9kZWwsXG5cdFx0cHJpdmF0ZSBfcG9saWN5Q29uZmlndXJhdGlvbjogQ29uZmlndXJhdGlvbk1vZGVsLFxuXHRcdHByaXZhdGUgX2FwcGxpY2F0aW9uQ29uZmlndXJhdGlvbjogQ29uZmlndXJhdGlvbk1vZGVsLFxuXHRcdHByaXZhdGUgX2xvY2FsVXNlckNvbmZpZ3VyYXRpb246IENvbmZpZ3VyYXRpb25Nb2RlbCxcblx0XHRwcml2YXRlIF9yZW1vdGVVc2VyQ29uZmlndXJhdGlvbjogQ29uZmlndXJhdGlvbk1vZGVsLFxuXHRcdHByaXZhdGUgX3dvcmtzcGFjZUNvbmZpZ3VyYXRpb246IENvbmZpZ3VyYXRpb25Nb2RlbCxcblx0XHRwcml2YXRlIF9mb2xkZXJDb25maWd1cmF0aW9uczogUmVzb3VyY2VNYXA8Q29uZmlndXJhdGlvbk1vZGVsPixcblx0XHRwcml2YXRlIF9tZW1vcnlDb25maWd1cmF0aW9uOiBDb25maWd1cmF0aW9uTW9kZWwsXG5cdFx0cHJpdmF0ZSBfbWVtb3J5Q29uZmlndXJhdGlvbkJ5UmVzb3VyY2U6IFJlc291cmNlTWFwPENvbmZpZ3VyYXRpb25Nb2RlbD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHtcblx0fVxuXG5cdGdldFZhbHVlKHNlY3Rpb246IHN0cmluZyB8IHVuZGVmaW5lZCwgb3ZlcnJpZGVzOiBJQ29uZmlndXJhdGlvbk92ZXJyaWRlcywgd29ya3NwYWNlOiBXb3Jrc3BhY2UgfCB1bmRlZmluZWQpOiBhbnkge1xuXHRcdGNvbnN0IGNvbnNvbGlkYXRlQ29uZmlndXJhdGlvbk1vZGVsID0gdGhpcy5nZXRDb25zb2xpZGF0ZWRDb25maWd1cmF0aW9uTW9kZWwoc2VjdGlvbiwgb3ZlcnJpZGVzLCB3b3Jrc3BhY2UpO1xuXHRcdHJldHVybiBjb25zb2xpZGF0ZUNvbmZpZ3VyYXRpb25Nb2RlbC5nZXRWYWx1ZShzZWN0aW9uKTtcblx0fVxuXG5cdHVwZGF0ZVZhbHVlKGtleTogc3RyaW5nLCB2YWx1ZTogYW55LCBvdmVycmlkZXM6IElDb25maWd1cmF0aW9uVXBkYXRlT3ZlcnJpZGVzID0ge30pOiB2b2lkIHtcblx0XHRsZXQgbWVtb3J5Q29uZmlndXJhdGlvbjogQ29uZmlndXJhdGlvbk1vZGVsIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChvdmVycmlkZXMucmVzb3VyY2UpIHtcblx0XHRcdG1lbW9yeUNvbmZpZ3VyYXRpb24gPSB0aGlzLl9tZW1vcnlDb25maWd1cmF0aW9uQnlSZXNvdXJjZS5nZXQob3ZlcnJpZGVzLnJlc291cmNlKTtcblx0XHRcdGlmICghbWVtb3J5Q29uZmlndXJhdGlvbikge1xuXHRcdFx0XHRtZW1vcnlDb25maWd1cmF0aW9uID0gQ29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwodGhpcy5sb2dTZXJ2aWNlKTtcblx0XHRcdFx0dGhpcy5fbWVtb3J5Q29uZmlndXJhdGlvbkJ5UmVzb3VyY2Uuc2V0KG92ZXJyaWRlcy5yZXNvdXJjZSwgbWVtb3J5Q29uZmlndXJhdGlvbik7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1lbW9yeUNvbmZpZ3VyYXRpb24gPSB0aGlzLl9tZW1vcnlDb25maWd1cmF0aW9uO1xuXHRcdH1cblxuXHRcdGlmICh2YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRtZW1vcnlDb25maWd1cmF0aW9uLnJlbW92ZVZhbHVlKGtleSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1lbW9yeUNvbmZpZ3VyYXRpb24uc2V0VmFsdWUoa2V5LCB2YWx1ZSk7XG5cdFx0fVxuXG5cdFx0aWYgKCFvdmVycmlkZXMucmVzb3VyY2UpIHtcblx0XHRcdHRoaXMuX3dvcmtzcGFjZUNvbnNvbGlkYXRlZENvbmZpZ3VyYXRpb24gPSBudWxsO1xuXHRcdH1cblx0fVxuXG5cdGluc3BlY3Q8Qz4oa2V5OiBzdHJpbmcsIG92ZXJyaWRlczogSUNvbmZpZ3VyYXRpb25PdmVycmlkZXMsIHdvcmtzcGFjZTogV29ya3NwYWNlIHwgdW5kZWZpbmVkKTogSUNvbmZpZ3VyYXRpb25WYWx1ZTxDPiB7XG5cdFx0Y29uc3QgY29uc29saWRhdGVDb25maWd1cmF0aW9uTW9kZWwgPSB0aGlzLmdldENvbnNvbGlkYXRlZENvbmZpZ3VyYXRpb25Nb2RlbChrZXksIG92ZXJyaWRlcywgd29ya3NwYWNlKTtcblx0XHRjb25zdCBmb2xkZXJDb25maWd1cmF0aW9uTW9kZWwgPSB0aGlzLmdldEZvbGRlckNvbmZpZ3VyYXRpb25Nb2RlbEZvclJlc291cmNlKG92ZXJyaWRlcy5yZXNvdXJjZSwgd29ya3NwYWNlKTtcblx0XHRjb25zdCBtZW1vcnlDb25maWd1cmF0aW9uTW9kZWwgPSBvdmVycmlkZXMucmVzb3VyY2UgPyB0aGlzLl9tZW1vcnlDb25maWd1cmF0aW9uQnlSZXNvdXJjZS5nZXQob3ZlcnJpZGVzLnJlc291cmNlKSB8fCB0aGlzLl9tZW1vcnlDb25maWd1cmF0aW9uIDogdGhpcy5fbWVtb3J5Q29uZmlndXJhdGlvbjtcblx0XHRjb25zdCBvdmVycmlkZUlkZW50aWZpZXJzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0Zm9yIChjb25zdCBvdmVycmlkZSBvZiBjb25zb2xpZGF0ZUNvbmZpZ3VyYXRpb25Nb2RlbC5vdmVycmlkZXMpIHtcblx0XHRcdGZvciAoY29uc3Qgb3ZlcnJpZGVJZGVudGlmaWVyIG9mIG92ZXJyaWRlLmlkZW50aWZpZXJzKSB7XG5cdFx0XHRcdGlmIChjb25zb2xpZGF0ZUNvbmZpZ3VyYXRpb25Nb2RlbC5nZXRPdmVycmlkZVZhbHVlKGtleSwgb3ZlcnJpZGVJZGVudGlmaWVyKSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0b3ZlcnJpZGVJZGVudGlmaWVycy5hZGQob3ZlcnJpZGVJZGVudGlmaWVyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgQ29uZmlndXJhdGlvbkluc3BlY3RWYWx1ZTxDPihcblx0XHRcdGtleSxcblx0XHRcdG92ZXJyaWRlcyxcblx0XHRcdGNvbnNvbGlkYXRlQ29uZmlndXJhdGlvbk1vZGVsLmdldFZhbHVlPEM+KGtleSksXG5cdFx0XHRvdmVycmlkZUlkZW50aWZpZXJzLnNpemUgPyBbLi4ub3ZlcnJpZGVJZGVudGlmaWVyc10gOiB1bmRlZmluZWQsXG5cdFx0XHR0aGlzLl9kZWZhdWx0Q29uZmlndXJhdGlvbixcblx0XHRcdHRoaXMuX3BvbGljeUNvbmZpZ3VyYXRpb24uaXNFbXB0eSgpID8gdW5kZWZpbmVkIDogdGhpcy5fcG9saWN5Q29uZmlndXJhdGlvbixcblx0XHRcdHRoaXMuYXBwbGljYXRpb25Db25maWd1cmF0aW9uLmlzRW1wdHkoKSA/IHVuZGVmaW5lZCA6IHRoaXMuYXBwbGljYXRpb25Db25maWd1cmF0aW9uLFxuXHRcdFx0dGhpcy51c2VyQ29uZmlndXJhdGlvbixcblx0XHRcdHRoaXMubG9jYWxVc2VyQ29uZmlndXJhdGlvbixcblx0XHRcdHRoaXMucmVtb3RlVXNlckNvbmZpZ3VyYXRpb24sXG5cdFx0XHR3b3Jrc3BhY2UgPyB0aGlzLl93b3Jrc3BhY2VDb25maWd1cmF0aW9uIDogdW5kZWZpbmVkLFxuXHRcdFx0Zm9sZGVyQ29uZmlndXJhdGlvbk1vZGVsID8gZm9sZGVyQ29uZmlndXJhdGlvbk1vZGVsIDogdW5kZWZpbmVkLFxuXHRcdFx0bWVtb3J5Q29uZmlndXJhdGlvbk1vZGVsXG5cdFx0KTtcblxuXHR9XG5cblx0a2V5cyh3b3Jrc3BhY2U6IFdvcmtzcGFjZSB8IHVuZGVmaW5lZCk6IHtcblx0XHRkZWZhdWx0OiBzdHJpbmdbXTtcblx0XHR1c2VyOiBzdHJpbmdbXTtcblx0XHR3b3Jrc3BhY2U6IHN0cmluZ1tdO1xuXHRcdHdvcmtzcGFjZUZvbGRlcjogc3RyaW5nW107XG5cdH0ge1xuXHRcdGNvbnN0IGZvbGRlckNvbmZpZ3VyYXRpb25Nb2RlbCA9IHRoaXMuZ2V0Rm9sZGVyQ29uZmlndXJhdGlvbk1vZGVsRm9yUmVzb3VyY2UodW5kZWZpbmVkLCB3b3Jrc3BhY2UpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRkZWZhdWx0OiB0aGlzLl9kZWZhdWx0Q29uZmlndXJhdGlvbi5rZXlzLnNsaWNlKDApLFxuXHRcdFx0dXNlcjogdGhpcy51c2VyQ29uZmlndXJhdGlvbi5rZXlzLnNsaWNlKDApLFxuXHRcdFx0d29ya3NwYWNlOiB0aGlzLl93b3Jrc3BhY2VDb25maWd1cmF0aW9uLmtleXMuc2xpY2UoMCksXG5cdFx0XHR3b3Jrc3BhY2VGb2xkZXI6IGZvbGRlckNvbmZpZ3VyYXRpb25Nb2RlbCA/IGZvbGRlckNvbmZpZ3VyYXRpb25Nb2RlbC5rZXlzLnNsaWNlKDApIDogW11cblx0XHR9O1xuXHR9XG5cblx0dXBkYXRlRGVmYXVsdENvbmZpZ3VyYXRpb24oZGVmYXVsdENvbmZpZ3VyYXRpb246IENvbmZpZ3VyYXRpb25Nb2RlbCk6IHZvaWQge1xuXHRcdHRoaXMuX2RlZmF1bHRDb25maWd1cmF0aW9uID0gZGVmYXVsdENvbmZpZ3VyYXRpb247XG5cdFx0dGhpcy5fd29ya3NwYWNlQ29uc29saWRhdGVkQ29uZmlndXJhdGlvbiA9IG51bGw7XG5cdFx0dGhpcy5fZm9sZGVyc0NvbnNvbGlkYXRlZENvbmZpZ3VyYXRpb25zLmNsZWFyKCk7XG5cdH1cblxuXHR1cGRhdGVQb2xpY3lDb25maWd1cmF0aW9uKHBvbGljeUNvbmZpZ3VyYXRpb246IENvbmZpZ3VyYXRpb25Nb2RlbCk6IHZvaWQge1xuXHRcdHRoaXMuX3BvbGljeUNvbmZpZ3VyYXRpb24gPSBwb2xpY3lDb25maWd1cmF0aW9uO1xuXHR9XG5cblx0dXBkYXRlQXBwbGljYXRpb25Db25maWd1cmF0aW9uKGFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbjogQ29uZmlndXJhdGlvbk1vZGVsKTogdm9pZCB7XG5cdFx0dGhpcy5fYXBwbGljYXRpb25Db25maWd1cmF0aW9uID0gYXBwbGljYXRpb25Db25maWd1cmF0aW9uO1xuXHRcdHRoaXMuX3dvcmtzcGFjZUNvbnNvbGlkYXRlZENvbmZpZ3VyYXRpb24gPSBudWxsO1xuXHRcdHRoaXMuX2ZvbGRlcnNDb25zb2xpZGF0ZWRDb25maWd1cmF0aW9ucy5jbGVhcigpO1xuXHR9XG5cblx0dXBkYXRlTG9jYWxVc2VyQ29uZmlndXJhdGlvbihsb2NhbFVzZXJDb25maWd1cmF0aW9uOiBDb25maWd1cmF0aW9uTW9kZWwpOiB2b2lkIHtcblx0XHR0aGlzLl9sb2NhbFVzZXJDb25maWd1cmF0aW9uID0gbG9jYWxVc2VyQ29uZmlndXJhdGlvbjtcblx0XHR0aGlzLl91c2VyQ29uZmlndXJhdGlvbiA9IG51bGw7XG5cdFx0dGhpcy5fd29ya3NwYWNlQ29uc29saWRhdGVkQ29uZmlndXJhdGlvbiA9IG51bGw7XG5cdFx0dGhpcy5fZm9sZGVyc0NvbnNvbGlkYXRlZENvbmZpZ3VyYXRpb25zLmNsZWFyKCk7XG5cdH1cblxuXHR1cGRhdGVSZW1vdGVVc2VyQ29uZmlndXJhdGlvbihyZW1vdGVVc2VyQ29uZmlndXJhdGlvbjogQ29uZmlndXJhdGlvbk1vZGVsKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVtb3RlVXNlckNvbmZpZ3VyYXRpb24gPSByZW1vdGVVc2VyQ29uZmlndXJhdGlvbjtcblx0XHR0aGlzLl91c2VyQ29uZmlndXJhdGlvbiA9IG51bGw7XG5cdFx0dGhpcy5fd29ya3NwYWNlQ29uc29saWRhdGVkQ29uZmlndXJhdGlvbiA9IG51bGw7XG5cdFx0dGhpcy5fZm9sZGVyc0NvbnNvbGlkYXRlZENvbmZpZ3VyYXRpb25zLmNsZWFyKCk7XG5cdH1cblxuXHR1cGRhdGVXb3Jrc3BhY2VDb25maWd1cmF0aW9uKHdvcmtzcGFjZUNvbmZpZ3VyYXRpb246IENvbmZpZ3VyYXRpb25Nb2RlbCk6IHZvaWQge1xuXHRcdHRoaXMuX3dvcmtzcGFjZUNvbmZpZ3VyYXRpb24gPSB3b3Jrc3BhY2VDb25maWd1cmF0aW9uO1xuXHRcdHRoaXMuX3dvcmtzcGFjZUNvbnNvbGlkYXRlZENvbmZpZ3VyYXRpb24gPSBudWxsO1xuXHRcdHRoaXMuX2ZvbGRlcnNDb25zb2xpZGF0ZWRDb25maWd1cmF0aW9ucy5jbGVhcigpO1xuXHR9XG5cblx0dXBkYXRlRm9sZGVyQ29uZmlndXJhdGlvbihyZXNvdXJjZTogVVJJLCBjb25maWd1cmF0aW9uOiBDb25maWd1cmF0aW9uTW9kZWwpOiB2b2lkIHtcblx0XHR0aGlzLl9mb2xkZXJDb25maWd1cmF0aW9ucy5zZXQocmVzb3VyY2UsIGNvbmZpZ3VyYXRpb24pO1xuXHRcdHRoaXMuX2ZvbGRlcnNDb25zb2xpZGF0ZWRDb25maWd1cmF0aW9ucy5kZWxldGUocmVzb3VyY2UpO1xuXHR9XG5cblx0ZGVsZXRlRm9sZGVyQ29uZmlndXJhdGlvbihyZXNvdXJjZTogVVJJKTogdm9pZCB7XG5cdFx0dGhpcy5mb2xkZXJDb25maWd1cmF0aW9ucy5kZWxldGUocmVzb3VyY2UpO1xuXHRcdHRoaXMuX2ZvbGRlcnNDb25zb2xpZGF0ZWRDb25maWd1cmF0aW9ucy5kZWxldGUocmVzb3VyY2UpO1xuXHR9XG5cblx0Y29tcGFyZUFuZFVwZGF0ZURlZmF1bHRDb25maWd1cmF0aW9uKGRlZmF1bHRzOiBDb25maWd1cmF0aW9uTW9kZWwsIGtleXM/OiBzdHJpbmdbXSk6IElDb25maWd1cmF0aW9uQ2hhbmdlIHtcblx0XHRjb25zdCBvdmVycmlkZXM6IFtzdHJpbmcsIHN0cmluZ1tdXVtdID0gW107XG5cdFx0aWYgKCFrZXlzKSB7XG5cdFx0XHRjb25zdCB7IGFkZGVkLCB1cGRhdGVkLCByZW1vdmVkIH0gPSBjb21wYXJlKHRoaXMuX2RlZmF1bHRDb25maWd1cmF0aW9uLCBkZWZhdWx0cyk7XG5cdFx0XHRrZXlzID0gWy4uLmFkZGVkLCAuLi51cGRhdGVkLCAuLi5yZW1vdmVkXTtcblx0XHR9XG5cdFx0Zm9yIChjb25zdCBrZXkgb2Yga2V5cykge1xuXHRcdFx0Zm9yIChjb25zdCBvdmVycmlkZUlkZW50aWZpZXIgb2Ygb3ZlcnJpZGVJZGVudGlmaWVyc0Zyb21LZXkoa2V5KSkge1xuXHRcdFx0XHRjb25zdCBmcm9tS2V5cyA9IHRoaXMuX2RlZmF1bHRDb25maWd1cmF0aW9uLmdldEtleXNGb3JPdmVycmlkZUlkZW50aWZpZXIob3ZlcnJpZGVJZGVudGlmaWVyKTtcblx0XHRcdFx0Y29uc3QgdG9LZXlzID0gZGVmYXVsdHMuZ2V0S2V5c0Zvck92ZXJyaWRlSWRlbnRpZmllcihvdmVycmlkZUlkZW50aWZpZXIpO1xuXHRcdFx0XHRjb25zdCBrZXlzID0gW1xuXHRcdFx0XHRcdC4uLnRvS2V5cy5maWx0ZXIoa2V5ID0+IGZyb21LZXlzLmluZGV4T2Yoa2V5KSA9PT0gLTEpLFxuXHRcdFx0XHRcdC4uLmZyb21LZXlzLmZpbHRlcihrZXkgPT4gdG9LZXlzLmluZGV4T2Yoa2V5KSA9PT0gLTEpLFxuXHRcdFx0XHRcdC4uLmZyb21LZXlzLmZpbHRlcihrZXkgPT4gIW9iamVjdHMuZXF1YWxzKHRoaXMuX2RlZmF1bHRDb25maWd1cmF0aW9uLm92ZXJyaWRlKG92ZXJyaWRlSWRlbnRpZmllcikuZ2V0VmFsdWUoa2V5KSwgZGVmYXVsdHMub3ZlcnJpZGUob3ZlcnJpZGVJZGVudGlmaWVyKS5nZXRWYWx1ZShrZXkpKSlcblx0XHRcdFx0XTtcblx0XHRcdFx0b3ZlcnJpZGVzLnB1c2goW292ZXJyaWRlSWRlbnRpZmllciwga2V5c10pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLnVwZGF0ZURlZmF1bHRDb25maWd1cmF0aW9uKGRlZmF1bHRzKTtcblx0XHRyZXR1cm4geyBrZXlzLCBvdmVycmlkZXMgfTtcblx0fVxuXG5cdGNvbXBhcmVBbmRVcGRhdGVQb2xpY3lDb25maWd1cmF0aW9uKHBvbGljeUNvbmZpZ3VyYXRpb246IENvbmZpZ3VyYXRpb25Nb2RlbCk6IElDb25maWd1cmF0aW9uQ2hhbmdlIHtcblx0XHRjb25zdCB7IGFkZGVkLCB1cGRhdGVkLCByZW1vdmVkIH0gPSBjb21wYXJlKHRoaXMuX3BvbGljeUNvbmZpZ3VyYXRpb24sIHBvbGljeUNvbmZpZ3VyYXRpb24pO1xuXHRcdGNvbnN0IGtleXMgPSBbLi4uYWRkZWQsIC4uLnVwZGF0ZWQsIC4uLnJlbW92ZWRdO1xuXHRcdGlmIChrZXlzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy51cGRhdGVQb2xpY3lDb25maWd1cmF0aW9uKHBvbGljeUNvbmZpZ3VyYXRpb24pO1xuXHRcdH1cblx0XHRyZXR1cm4geyBrZXlzLCBvdmVycmlkZXM6IFtdIH07XG5cdH1cblxuXHRjb21wYXJlQW5kVXBkYXRlQXBwbGljYXRpb25Db25maWd1cmF0aW9uKGFwcGxpY2F0aW9uOiBDb25maWd1cmF0aW9uTW9kZWwpOiBJQ29uZmlndXJhdGlvbkNoYW5nZSB7XG5cdFx0Y29uc3QgeyBhZGRlZCwgdXBkYXRlZCwgcmVtb3ZlZCwgb3ZlcnJpZGVzIH0gPSBjb21wYXJlKHRoaXMuYXBwbGljYXRpb25Db25maWd1cmF0aW9uLCBhcHBsaWNhdGlvbik7XG5cdFx0Y29uc3Qga2V5cyA9IFsuLi5hZGRlZCwgLi4udXBkYXRlZCwgLi4ucmVtb3ZlZF07XG5cdFx0aWYgKGtleXMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZUFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbihhcHBsaWNhdGlvbik7XG5cdFx0fVxuXHRcdHJldHVybiB7IGtleXMsIG92ZXJyaWRlcyB9O1xuXHR9XG5cblx0Y29tcGFyZUFuZFVwZGF0ZUxvY2FsVXNlckNvbmZpZ3VyYXRpb24odXNlcjogQ29uZmlndXJhdGlvbk1vZGVsKTogSUNvbmZpZ3VyYXRpb25DaGFuZ2Uge1xuXHRcdGNvbnN0IHsgYWRkZWQsIHVwZGF0ZWQsIHJlbW92ZWQsIG92ZXJyaWRlcyB9ID0gY29tcGFyZSh0aGlzLmxvY2FsVXNlckNvbmZpZ3VyYXRpb24sIHVzZXIpO1xuXHRcdGNvbnN0IGtleXMgPSBbLi4uYWRkZWQsIC4uLnVwZGF0ZWQsIC4uLnJlbW92ZWRdO1xuXHRcdGlmIChrZXlzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy51cGRhdGVMb2NhbFVzZXJDb25maWd1cmF0aW9uKHVzZXIpO1xuXHRcdH1cblx0XHRyZXR1cm4geyBrZXlzLCBvdmVycmlkZXMgfTtcblx0fVxuXG5cdGNvbXBhcmVBbmRVcGRhdGVSZW1vdGVVc2VyQ29uZmlndXJhdGlvbih1c2VyOiBDb25maWd1cmF0aW9uTW9kZWwpOiBJQ29uZmlndXJhdGlvbkNoYW5nZSB7XG5cdFx0Y29uc3QgeyBhZGRlZCwgdXBkYXRlZCwgcmVtb3ZlZCwgb3ZlcnJpZGVzIH0gPSBjb21wYXJlKHRoaXMucmVtb3RlVXNlckNvbmZpZ3VyYXRpb24sIHVzZXIpO1xuXHRcdGNvbnN0IGtleXMgPSBbLi4uYWRkZWQsIC4uLnVwZGF0ZWQsIC4uLnJlbW92ZWRdO1xuXHRcdGlmIChrZXlzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy51cGRhdGVSZW1vdGVVc2VyQ29uZmlndXJhdGlvbih1c2VyKTtcblx0XHR9XG5cdFx0cmV0dXJuIHsga2V5cywgb3ZlcnJpZGVzIH07XG5cdH1cblxuXHRjb21wYXJlQW5kVXBkYXRlV29ya3NwYWNlQ29uZmlndXJhdGlvbih3b3Jrc3BhY2VDb25maWd1cmF0aW9uOiBDb25maWd1cmF0aW9uTW9kZWwpOiBJQ29uZmlndXJhdGlvbkNoYW5nZSB7XG5cdFx0Y29uc3QgeyBhZGRlZCwgdXBkYXRlZCwgcmVtb3ZlZCwgb3ZlcnJpZGVzIH0gPSBjb21wYXJlKHRoaXMud29ya3NwYWNlQ29uZmlndXJhdGlvbiwgd29ya3NwYWNlQ29uZmlndXJhdGlvbik7XG5cdFx0Y29uc3Qga2V5cyA9IFsuLi5hZGRlZCwgLi4udXBkYXRlZCwgLi4ucmVtb3ZlZF07XG5cdFx0aWYgKGtleXMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVdvcmtzcGFjZUNvbmZpZ3VyYXRpb24od29ya3NwYWNlQ29uZmlndXJhdGlvbik7XG5cdFx0fVxuXHRcdHJldHVybiB7IGtleXMsIG92ZXJyaWRlcyB9O1xuXHR9XG5cblx0Y29tcGFyZUFuZFVwZGF0ZUZvbGRlckNvbmZpZ3VyYXRpb24ocmVzb3VyY2U6IFVSSSwgZm9sZGVyQ29uZmlndXJhdGlvbjogQ29uZmlndXJhdGlvbk1vZGVsKTogSUNvbmZpZ3VyYXRpb25DaGFuZ2Uge1xuXHRcdGNvbnN0IGN1cnJlbnRGb2xkZXJDb25maWd1cmF0aW9uID0gdGhpcy5mb2xkZXJDb25maWd1cmF0aW9ucy5nZXQocmVzb3VyY2UpO1xuXHRcdGNvbnN0IHsgYWRkZWQsIHVwZGF0ZWQsIHJlbW92ZWQsIG92ZXJyaWRlcyB9ID0gY29tcGFyZShjdXJyZW50Rm9sZGVyQ29uZmlndXJhdGlvbiwgZm9sZGVyQ29uZmlndXJhdGlvbik7XG5cdFx0Y29uc3Qga2V5cyA9IFsuLi5hZGRlZCwgLi4udXBkYXRlZCwgLi4ucmVtb3ZlZF07XG5cdFx0aWYgKGtleXMubGVuZ3RoIHx8ICFjdXJyZW50Rm9sZGVyQ29uZmlndXJhdGlvbikge1xuXHRcdFx0dGhpcy51cGRhdGVGb2xkZXJDb25maWd1cmF0aW9uKHJlc291cmNlLCBmb2xkZXJDb25maWd1cmF0aW9uKTtcblx0XHR9XG5cdFx0cmV0dXJuIHsga2V5cywgb3ZlcnJpZGVzIH07XG5cdH1cblxuXHRjb21wYXJlQW5kRGVsZXRlRm9sZGVyQ29uZmlndXJhdGlvbihmb2xkZXI6IFVSSSk6IElDb25maWd1cmF0aW9uQ2hhbmdlIHtcblx0XHRjb25zdCBmb2xkZXJDb25maWcgPSB0aGlzLmZvbGRlckNvbmZpZ3VyYXRpb25zLmdldChmb2xkZXIpO1xuXHRcdGlmICghZm9sZGVyQ29uZmlnKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gZm9sZGVyJyk7XG5cdFx0fVxuXHRcdHRoaXMuZGVsZXRlRm9sZGVyQ29uZmlndXJhdGlvbihmb2xkZXIpO1xuXHRcdGNvbnN0IHsgYWRkZWQsIHVwZGF0ZWQsIHJlbW92ZWQsIG92ZXJyaWRlcyB9ID0gY29tcGFyZShmb2xkZXJDb25maWcsIHVuZGVmaW5lZCk7XG5cdFx0cmV0dXJuIHsga2V5czogWy4uLmFkZGVkLCAuLi51cGRhdGVkLCAuLi5yZW1vdmVkXSwgb3ZlcnJpZGVzIH07XG5cdH1cblxuXHRnZXQgZGVmYXVsdHMoKTogQ29uZmlndXJhdGlvbk1vZGVsIHtcblx0XHRyZXR1cm4gdGhpcy5fZGVmYXVsdENvbmZpZ3VyYXRpb247XG5cdH1cblxuXHRnZXQgYXBwbGljYXRpb25Db25maWd1cmF0aW9uKCk6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0cmV0dXJuIHRoaXMuX2FwcGxpY2F0aW9uQ29uZmlndXJhdGlvbjtcblx0fVxuXG5cdHByaXZhdGUgX3VzZXJDb25maWd1cmF0aW9uOiBDb25maWd1cmF0aW9uTW9kZWwgfCBudWxsID0gbnVsbDtcblx0Z2V0IHVzZXJDb25maWd1cmF0aW9uKCk6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0aWYgKCF0aGlzLl91c2VyQ29uZmlndXJhdGlvbikge1xuXHRcdFx0aWYgKHRoaXMuX3JlbW90ZVVzZXJDb25maWd1cmF0aW9uLmlzRW1wdHkoKSkge1xuXHRcdFx0XHR0aGlzLl91c2VyQ29uZmlndXJhdGlvbiA9IHRoaXMuX2xvY2FsVXNlckNvbmZpZ3VyYXRpb247XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBtZXJnZWQgPSB0aGlzLl9sb2NhbFVzZXJDb25maWd1cmF0aW9uLm1lcmdlKHRoaXMuX3JlbW90ZVVzZXJDb25maWd1cmF0aW9uKTtcblx0XHRcdFx0dGhpcy5fdXNlckNvbmZpZ3VyYXRpb24gPSBuZXcgQ29uZmlndXJhdGlvbk1vZGVsKG1lcmdlZC5jb250ZW50cywgbWVyZ2VkLmtleXMsIG1lcmdlZC5vdmVycmlkZXMsIHVuZGVmaW5lZCwgdGhpcy5sb2dTZXJ2aWNlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3VzZXJDb25maWd1cmF0aW9uO1xuXHR9XG5cblx0Z2V0IGxvY2FsVXNlckNvbmZpZ3VyYXRpb24oKTogQ29uZmlndXJhdGlvbk1vZGVsIHtcblx0XHRyZXR1cm4gdGhpcy5fbG9jYWxVc2VyQ29uZmlndXJhdGlvbjtcblx0fVxuXG5cdGdldCByZW1vdGVVc2VyQ29uZmlndXJhdGlvbigpOiBDb25maWd1cmF0aW9uTW9kZWwge1xuXHRcdHJldHVybiB0aGlzLl9yZW1vdGVVc2VyQ29uZmlndXJhdGlvbjtcblx0fVxuXG5cdGdldCB3b3Jrc3BhY2VDb25maWd1cmF0aW9uKCk6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0cmV0dXJuIHRoaXMuX3dvcmtzcGFjZUNvbmZpZ3VyYXRpb247XG5cdH1cblxuXHRnZXQgZm9sZGVyQ29uZmlndXJhdGlvbnMoKTogUmVzb3VyY2VNYXA8Q29uZmlndXJhdGlvbk1vZGVsPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2ZvbGRlckNvbmZpZ3VyYXRpb25zO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRDb25zb2xpZGF0ZWRDb25maWd1cmF0aW9uTW9kZWwoc2VjdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkLCBvdmVycmlkZXM6IElDb25maWd1cmF0aW9uT3ZlcnJpZGVzLCB3b3Jrc3BhY2U6IFdvcmtzcGFjZSB8IHVuZGVmaW5lZCk6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0bGV0IGNvbmZpZ3VyYXRpb25Nb2RlbCA9IHRoaXMuZ2V0Q29uc29saWRhdGVkQ29uZmlndXJhdGlvbk1vZGVsRm9yUmVzb3VyY2Uob3ZlcnJpZGVzLCB3b3Jrc3BhY2UpO1xuXHRcdGlmIChvdmVycmlkZXMub3ZlcnJpZGVJZGVudGlmaWVyKSB7XG5cdFx0XHRjb25maWd1cmF0aW9uTW9kZWwgPSBjb25maWd1cmF0aW9uTW9kZWwub3ZlcnJpZGUob3ZlcnJpZGVzLm92ZXJyaWRlSWRlbnRpZmllcik7XG5cdFx0fVxuXHRcdGlmICghdGhpcy5fcG9saWN5Q29uZmlndXJhdGlvbi5pc0VtcHR5KCkgJiYgdGhpcy5fcG9saWN5Q29uZmlndXJhdGlvbi5nZXRWYWx1ZShzZWN0aW9uKSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHQvLyBjbG9uZSBieSBtZXJnaW5nXG5cdFx0XHRjb25maWd1cmF0aW9uTW9kZWwgPSBjb25maWd1cmF0aW9uTW9kZWwubWVyZ2UoKTtcblx0XHRcdGZvciAoY29uc3Qga2V5IG9mIHRoaXMuX3BvbGljeUNvbmZpZ3VyYXRpb24ua2V5cykge1xuXHRcdFx0XHRjb25maWd1cmF0aW9uTW9kZWwuc2V0VmFsdWUoa2V5LCB0aGlzLl9wb2xpY3lDb25maWd1cmF0aW9uLmdldFZhbHVlKGtleSkpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gY29uZmlndXJhdGlvbk1vZGVsO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRDb25zb2xpZGF0ZWRDb25maWd1cmF0aW9uTW9kZWxGb3JSZXNvdXJjZSh7IHJlc291cmNlIH06IElDb25maWd1cmF0aW9uT3ZlcnJpZGVzLCB3b3Jrc3BhY2U6IFdvcmtzcGFjZSB8IHVuZGVmaW5lZCk6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0bGV0IGNvbnNvbGlkYXRlQ29uZmlndXJhdGlvbiA9IHRoaXMuZ2V0V29ya3NwYWNlQ29uc29saWRhdGVkQ29uZmlndXJhdGlvbigpO1xuXG5cdFx0aWYgKHdvcmtzcGFjZSAmJiByZXNvdXJjZSkge1xuXHRcdFx0Y29uc3Qgcm9vdCA9IHdvcmtzcGFjZS5nZXRGb2xkZXIocmVzb3VyY2UpO1xuXHRcdFx0aWYgKHJvb3QpIHtcblx0XHRcdFx0Y29uc29saWRhdGVDb25maWd1cmF0aW9uID0gdGhpcy5nZXRGb2xkZXJDb25zb2xpZGF0ZWRDb25maWd1cmF0aW9uKHJvb3QudXJpKSB8fCBjb25zb2xpZGF0ZUNvbmZpZ3VyYXRpb247XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBtZW1vcnlDb25maWd1cmF0aW9uRm9yUmVzb3VyY2UgPSB0aGlzLl9tZW1vcnlDb25maWd1cmF0aW9uQnlSZXNvdXJjZS5nZXQocmVzb3VyY2UpO1xuXHRcdFx0aWYgKG1lbW9yeUNvbmZpZ3VyYXRpb25Gb3JSZXNvdXJjZSkge1xuXHRcdFx0XHRjb25zb2xpZGF0ZUNvbmZpZ3VyYXRpb24gPSBjb25zb2xpZGF0ZUNvbmZpZ3VyYXRpb24ubWVyZ2UobWVtb3J5Q29uZmlndXJhdGlvbkZvclJlc291cmNlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gY29uc29saWRhdGVDb25maWd1cmF0aW9uO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRXb3Jrc3BhY2VDb25zb2xpZGF0ZWRDb25maWd1cmF0aW9uKCk6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0aWYgKCF0aGlzLl93b3Jrc3BhY2VDb25zb2xpZGF0ZWRDb25maWd1cmF0aW9uKSB7XG5cdFx0XHR0aGlzLl93b3Jrc3BhY2VDb25zb2xpZGF0ZWRDb25maWd1cmF0aW9uID0gdGhpcy5fZGVmYXVsdENvbmZpZ3VyYXRpb24ubWVyZ2UodGhpcy5hcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb24sIHRoaXMudXNlckNvbmZpZ3VyYXRpb24sIHRoaXMuX3dvcmtzcGFjZUNvbmZpZ3VyYXRpb24sIHRoaXMuX21lbW9yeUNvbmZpZ3VyYXRpb24pO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fd29ya3NwYWNlQ29uc29saWRhdGVkQ29uZmlndXJhdGlvbjtcblx0fVxuXG5cdHByaXZhdGUgZ2V0Rm9sZGVyQ29uc29saWRhdGVkQ29uZmlndXJhdGlvbihmb2xkZXI6IFVSSSk6IENvbmZpZ3VyYXRpb25Nb2RlbCB7XG5cdFx0bGV0IGZvbGRlckNvbnNvbGlkYXRlZENvbmZpZ3VyYXRpb24gPSB0aGlzLl9mb2xkZXJzQ29uc29saWRhdGVkQ29uZmlndXJhdGlvbnMuZ2V0KGZvbGRlcik7XG5cdFx0aWYgKCFmb2xkZXJDb25zb2xpZGF0ZWRDb25maWd1cmF0aW9uKSB7XG5cdFx0XHRjb25zdCB3b3Jrc3BhY2VDb25zb2xpZGF0ZUNvbmZpZ3VyYXRpb24gPSB0aGlzLmdldFdvcmtzcGFjZUNvbnNvbGlkYXRlZENvbmZpZ3VyYXRpb24oKTtcblx0XHRcdGNvbnN0IGZvbGRlckNvbmZpZ3VyYXRpb24gPSB0aGlzLl9mb2xkZXJDb25maWd1cmF0aW9ucy5nZXQoZm9sZGVyKTtcblx0XHRcdGlmIChmb2xkZXJDb25maWd1cmF0aW9uKSB7XG5cdFx0XHRcdGZvbGRlckNvbnNvbGlkYXRlZENvbmZpZ3VyYXRpb24gPSB3b3Jrc3BhY2VDb25zb2xpZGF0ZUNvbmZpZ3VyYXRpb24ubWVyZ2UoZm9sZGVyQ29uZmlndXJhdGlvbik7XG5cdFx0XHRcdHRoaXMuX2ZvbGRlcnNDb25zb2xpZGF0ZWRDb25maWd1cmF0aW9ucy5zZXQoZm9sZGVyLCBmb2xkZXJDb25zb2xpZGF0ZWRDb25maWd1cmF0aW9uKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGZvbGRlckNvbnNvbGlkYXRlZENvbmZpZ3VyYXRpb24gPSB3b3Jrc3BhY2VDb25zb2xpZGF0ZUNvbmZpZ3VyYXRpb247XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmb2xkZXJDb25zb2xpZGF0ZWRDb25maWd1cmF0aW9uO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRGb2xkZXJDb25maWd1cmF0aW9uTW9kZWxGb3JSZXNvdXJjZShyZXNvdXJjZTogVVJJIHwgbnVsbCB8IHVuZGVmaW5lZCwgd29ya3NwYWNlOiBXb3Jrc3BhY2UgfCB1bmRlZmluZWQpOiBDb25maWd1cmF0aW9uTW9kZWwgfCB1bmRlZmluZWQge1xuXHRcdGlmICh3b3Jrc3BhY2UgJiYgcmVzb3VyY2UpIHtcblx0XHRcdGNvbnN0IHJvb3QgPSB3b3Jrc3BhY2UuZ2V0Rm9sZGVyKHJlc291cmNlKTtcblx0XHRcdGlmIChyb290KSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9mb2xkZXJDb25maWd1cmF0aW9ucy5nZXQocm9vdC51cmkpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0dG9EYXRhKCk6IElDb25maWd1cmF0aW9uRGF0YSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGRlZmF1bHRzOiB7XG5cdFx0XHRcdGNvbnRlbnRzOiB0aGlzLl9kZWZhdWx0Q29uZmlndXJhdGlvbi5jb250ZW50cyxcblx0XHRcdFx0b3ZlcnJpZGVzOiB0aGlzLl9kZWZhdWx0Q29uZmlndXJhdGlvbi5vdmVycmlkZXMsXG5cdFx0XHRcdGtleXM6IHRoaXMuX2RlZmF1bHRDb25maWd1cmF0aW9uLmtleXMsXG5cdFx0XHR9LFxuXHRcdFx0cG9saWN5OiB7XG5cdFx0XHRcdGNvbnRlbnRzOiB0aGlzLl9wb2xpY3lDb25maWd1cmF0aW9uLmNvbnRlbnRzLFxuXHRcdFx0XHRvdmVycmlkZXM6IHRoaXMuX3BvbGljeUNvbmZpZ3VyYXRpb24ub3ZlcnJpZGVzLFxuXHRcdFx0XHRrZXlzOiB0aGlzLl9wb2xpY3lDb25maWd1cmF0aW9uLmtleXNcblx0XHRcdH0sXG5cdFx0XHRhcHBsaWNhdGlvbjoge1xuXHRcdFx0XHRjb250ZW50czogdGhpcy5hcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb24uY29udGVudHMsXG5cdFx0XHRcdG92ZXJyaWRlczogdGhpcy5hcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb24ub3ZlcnJpZGVzLFxuXHRcdFx0XHRrZXlzOiB0aGlzLmFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbi5rZXlzLFxuXHRcdFx0XHRyYXc6IEFycmF5LmlzQXJyYXkodGhpcy5hcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb24ucmF3KSA/IHVuZGVmaW5lZCA6IHRoaXMuYXBwbGljYXRpb25Db25maWd1cmF0aW9uLnJhd1xuXHRcdFx0fSxcblx0XHRcdHVzZXJMb2NhbDoge1xuXHRcdFx0XHRjb250ZW50czogdGhpcy5sb2NhbFVzZXJDb25maWd1cmF0aW9uLmNvbnRlbnRzLFxuXHRcdFx0XHRvdmVycmlkZXM6IHRoaXMubG9jYWxVc2VyQ29uZmlndXJhdGlvbi5vdmVycmlkZXMsXG5cdFx0XHRcdGtleXM6IHRoaXMubG9jYWxVc2VyQ29uZmlndXJhdGlvbi5rZXlzLFxuXHRcdFx0XHRyYXc6IEFycmF5LmlzQXJyYXkodGhpcy5sb2NhbFVzZXJDb25maWd1cmF0aW9uLnJhdykgPyB1bmRlZmluZWQgOiB0aGlzLmxvY2FsVXNlckNvbmZpZ3VyYXRpb24ucmF3XG5cdFx0XHR9LFxuXHRcdFx0dXNlclJlbW90ZToge1xuXHRcdFx0XHRjb250ZW50czogdGhpcy5yZW1vdGVVc2VyQ29uZmlndXJhdGlvbi5jb250ZW50cyxcblx0XHRcdFx0b3ZlcnJpZGVzOiB0aGlzLnJlbW90ZVVzZXJDb25maWd1cmF0aW9uLm92ZXJyaWRlcyxcblx0XHRcdFx0a2V5czogdGhpcy5yZW1vdGVVc2VyQ29uZmlndXJhdGlvbi5rZXlzLFxuXHRcdFx0XHRyYXc6IEFycmF5LmlzQXJyYXkodGhpcy5yZW1vdGVVc2VyQ29uZmlndXJhdGlvbi5yYXcpID8gdW5kZWZpbmVkIDogdGhpcy5yZW1vdGVVc2VyQ29uZmlndXJhdGlvbi5yYXdcblx0XHRcdH0sXG5cdFx0XHR3b3Jrc3BhY2U6IHtcblx0XHRcdFx0Y29udGVudHM6IHRoaXMuX3dvcmtzcGFjZUNvbmZpZ3VyYXRpb24uY29udGVudHMsXG5cdFx0XHRcdG92ZXJyaWRlczogdGhpcy5fd29ya3NwYWNlQ29uZmlndXJhdGlvbi5vdmVycmlkZXMsXG5cdFx0XHRcdGtleXM6IHRoaXMuX3dvcmtzcGFjZUNvbmZpZ3VyYXRpb24ua2V5c1xuXHRcdFx0fSxcblx0XHRcdGZvbGRlcnM6IFsuLi50aGlzLl9mb2xkZXJDb25maWd1cmF0aW9ucy5rZXlzKCldLnJlZHVjZTxbVXJpQ29tcG9uZW50cywgSUNvbmZpZ3VyYXRpb25Nb2RlbF1bXT4oKHJlc3VsdCwgZm9sZGVyKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHsgY29udGVudHMsIG92ZXJyaWRlcywga2V5cyB9ID0gdGhpcy5fZm9sZGVyQ29uZmlndXJhdGlvbnMuZ2V0KGZvbGRlcikhO1xuXHRcdFx0XHRyZXN1bHQucHVzaChbZm9sZGVyLCB7IGNvbnRlbnRzLCBvdmVycmlkZXMsIGtleXMgfV0pO1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fSwgW10pXG5cdFx0fTtcblx0fVxuXG5cdGFsbEtleXMoKTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IGtleXM6IFNldDxzdHJpbmc+ID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cdFx0dGhpcy5fZGVmYXVsdENvbmZpZ3VyYXRpb24ua2V5cy5mb3JFYWNoKGtleSA9PiBrZXlzLmFkZChrZXkpKTtcblx0XHR0aGlzLnVzZXJDb25maWd1cmF0aW9uLmtleXMuZm9yRWFjaChrZXkgPT4ga2V5cy5hZGQoa2V5KSk7XG5cdFx0dGhpcy5fd29ya3NwYWNlQ29uZmlndXJhdGlvbi5rZXlzLmZvckVhY2goa2V5ID0+IGtleXMuYWRkKGtleSkpO1xuXHRcdHRoaXMuX2ZvbGRlckNvbmZpZ3VyYXRpb25zLmZvckVhY2goZm9sZGVyQ29uZmlndXJhdGlvbiA9PiBmb2xkZXJDb25maWd1cmF0aW9uLmtleXMuZm9yRWFjaChrZXkgPT4ga2V5cy5hZGQoa2V5KSkpO1xuXHRcdHJldHVybiBbLi4ua2V5cy52YWx1ZXMoKV07XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWxsT3ZlcnJpZGVJZGVudGlmaWVycygpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3Qga2V5czogU2V0PHN0cmluZz4gPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHR0aGlzLl9kZWZhdWx0Q29uZmlndXJhdGlvbi5nZXRBbGxPdmVycmlkZUlkZW50aWZpZXJzKCkuZm9yRWFjaChrZXkgPT4ga2V5cy5hZGQoa2V5KSk7XG5cdFx0dGhpcy51c2VyQ29uZmlndXJhdGlvbi5nZXRBbGxPdmVycmlkZUlkZW50aWZpZXJzKCkuZm9yRWFjaChrZXkgPT4ga2V5cy5hZGQoa2V5KSk7XG5cdFx0dGhpcy5fd29ya3NwYWNlQ29uZmlndXJhdGlvbi5nZXRBbGxPdmVycmlkZUlkZW50aWZpZXJzKCkuZm9yRWFjaChrZXkgPT4ga2V5cy5hZGQoa2V5KSk7XG5cdFx0dGhpcy5fZm9sZGVyQ29uZmlndXJhdGlvbnMuZm9yRWFjaChmb2xkZXJDb25maWd1cmF0aW9uID0+IGZvbGRlckNvbmZpZ3VyYXRpb24uZ2V0QWxsT3ZlcnJpZGVJZGVudGlmaWVycygpLmZvckVhY2goa2V5ID0+IGtleXMuYWRkKGtleSkpKTtcblx0XHRyZXR1cm4gWy4uLmtleXMudmFsdWVzKCldO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldEFsbEtleXNGb3JPdmVycmlkZUlkZW50aWZpZXIob3ZlcnJpZGVJZGVudGlmaWVyOiBzdHJpbmcpOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3Qga2V5czogU2V0PHN0cmluZz4gPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHR0aGlzLl9kZWZhdWx0Q29uZmlndXJhdGlvbi5nZXRLZXlzRm9yT3ZlcnJpZGVJZGVudGlmaWVyKG92ZXJyaWRlSWRlbnRpZmllcikuZm9yRWFjaChrZXkgPT4ga2V5cy5hZGQoa2V5KSk7XG5cdFx0dGhpcy51c2VyQ29uZmlndXJhdGlvbi5nZXRLZXlzRm9yT3ZlcnJpZGVJZGVudGlmaWVyKG92ZXJyaWRlSWRlbnRpZmllcikuZm9yRWFjaChrZXkgPT4ga2V5cy5hZGQoa2V5KSk7XG5cdFx0dGhpcy5fd29ya3NwYWNlQ29uZmlndXJhdGlvbi5nZXRLZXlzRm9yT3ZlcnJpZGVJZGVudGlmaWVyKG92ZXJyaWRlSWRlbnRpZmllcikuZm9yRWFjaChrZXkgPT4ga2V5cy5hZGQoa2V5KSk7XG5cdFx0dGhpcy5fZm9sZGVyQ29uZmlndXJhdGlvbnMuZm9yRWFjaChmb2xkZXJDb25maWd1cmF0aW9uID0+IGZvbGRlckNvbmZpZ3VyYXRpb24uZ2V0S2V5c0Zvck92ZXJyaWRlSWRlbnRpZmllcihvdmVycmlkZUlkZW50aWZpZXIpLmZvckVhY2goa2V5ID0+IGtleXMuYWRkKGtleSkpKTtcblx0XHRyZXR1cm4gWy4uLmtleXMudmFsdWVzKCldO1xuXHR9XG5cblx0c3RhdGljIHBhcnNlKGRhdGE6IElDb25maWd1cmF0aW9uRGF0YSwgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UpOiBDb25maWd1cmF0aW9uIHtcblx0XHRjb25zdCBkZWZhdWx0Q29uZmlndXJhdGlvbiA9IHRoaXMucGFyc2VDb25maWd1cmF0aW9uTW9kZWwoZGF0YS5kZWZhdWx0cywgbG9nU2VydmljZSk7XG5cdFx0Y29uc3QgcG9saWN5Q29uZmlndXJhdGlvbiA9IHRoaXMucGFyc2VDb25maWd1cmF0aW9uTW9kZWwoZGF0YS5wb2xpY3ksIGxvZ1NlcnZpY2UpO1xuXHRcdGNvbnN0IGFwcGxpY2F0aW9uQ29uZmlndXJhdGlvbiA9IHRoaXMucGFyc2VDb25maWd1cmF0aW9uTW9kZWwoZGF0YS5hcHBsaWNhdGlvbiwgbG9nU2VydmljZSk7XG5cdFx0Y29uc3QgdXNlckxvY2FsQ29uZmlndXJhdGlvbiA9IHRoaXMucGFyc2VDb25maWd1cmF0aW9uTW9kZWwoZGF0YS51c2VyTG9jYWwsIGxvZ1NlcnZpY2UpO1xuXHRcdGNvbnN0IHVzZXJSZW1vdGVDb25maWd1cmF0aW9uID0gdGhpcy5wYXJzZUNvbmZpZ3VyYXRpb25Nb2RlbChkYXRhLnVzZXJSZW1vdGUsIGxvZ1NlcnZpY2UpO1xuXHRcdGNvbnN0IHdvcmtzcGFjZUNvbmZpZ3VyYXRpb24gPSB0aGlzLnBhcnNlQ29uZmlndXJhdGlvbk1vZGVsKGRhdGEud29ya3NwYWNlLCBsb2dTZXJ2aWNlKTtcblx0XHRjb25zdCBmb2xkZXJzOiBSZXNvdXJjZU1hcDxDb25maWd1cmF0aW9uTW9kZWw+ID0gZGF0YS5mb2xkZXJzLnJlZHVjZSgocmVzdWx0LCB2YWx1ZSkgPT4ge1xuXHRcdFx0cmVzdWx0LnNldChVUkkucmV2aXZlKHZhbHVlWzBdKSwgdGhpcy5wYXJzZUNvbmZpZ3VyYXRpb25Nb2RlbCh2YWx1ZVsxXSwgbG9nU2VydmljZSkpO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9LCBuZXcgUmVzb3VyY2VNYXA8Q29uZmlndXJhdGlvbk1vZGVsPigpKTtcblx0XHRyZXR1cm4gbmV3IENvbmZpZ3VyYXRpb24oXG5cdFx0XHRkZWZhdWx0Q29uZmlndXJhdGlvbixcblx0XHRcdHBvbGljeUNvbmZpZ3VyYXRpb24sXG5cdFx0XHRhcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb24sXG5cdFx0XHR1c2VyTG9jYWxDb25maWd1cmF0aW9uLFxuXHRcdFx0dXNlclJlbW90ZUNvbmZpZ3VyYXRpb24sXG5cdFx0XHR3b3Jrc3BhY2VDb25maWd1cmF0aW9uLFxuXHRcdFx0Zm9sZGVycyxcblx0XHRcdENvbmZpZ3VyYXRpb25Nb2RlbC5jcmVhdGVFbXB0eU1vZGVsKGxvZ1NlcnZpY2UpLFxuXHRcdFx0bmV3IFJlc291cmNlTWFwPENvbmZpZ3VyYXRpb25Nb2RlbD4oKSxcblx0XHRcdGxvZ1NlcnZpY2Vcblx0XHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgcGFyc2VDb25maWd1cmF0aW9uTW9kZWwobW9kZWw6IElDb25maWd1cmF0aW9uTW9kZWwsIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlKTogQ29uZmlndXJhdGlvbk1vZGVsIHtcblx0XHRyZXR1cm4gbmV3IENvbmZpZ3VyYXRpb25Nb2RlbChtb2RlbC5jb250ZW50cywgbW9kZWwua2V5cywgbW9kZWwub3ZlcnJpZGVzLCBtb2RlbC5yYXcsIGxvZ1NlcnZpY2UpO1xuXHR9XG5cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1lcmdlQ2hhbmdlcyguLi5jaGFuZ2VzOiBJQ29uZmlndXJhdGlvbkNoYW5nZVtdKTogSUNvbmZpZ3VyYXRpb25DaGFuZ2Uge1xuXHRpZiAoY2hhbmdlcy5sZW5ndGggPT09IDApIHtcblx0XHRyZXR1cm4geyBrZXlzOiBbXSwgb3ZlcnJpZGVzOiBbXSB9O1xuXHR9XG5cdGlmIChjaGFuZ2VzLmxlbmd0aCA9PT0gMSkge1xuXHRcdHJldHVybiBjaGFuZ2VzWzBdO1xuXHR9XG5cdGNvbnN0IGtleXNTZXQgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0Y29uc3Qgb3ZlcnJpZGVzTWFwID0gbmV3IE1hcDxzdHJpbmcsIFNldDxzdHJpbmc+PigpO1xuXHRmb3IgKGNvbnN0IGNoYW5nZSBvZiBjaGFuZ2VzKSB7XG5cdFx0Y2hhbmdlLmtleXMuZm9yRWFjaChrZXkgPT4ga2V5c1NldC5hZGQoa2V5KSk7XG5cdFx0Y2hhbmdlLm92ZXJyaWRlcy5mb3JFYWNoKChbaWRlbnRpZmllciwga2V5c10pID0+IHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGdldE9yU2V0KG92ZXJyaWRlc01hcCwgaWRlbnRpZmllciwgbmV3IFNldDxzdHJpbmc+KCkpO1xuXHRcdFx0a2V5cy5mb3JFYWNoKGtleSA9PiByZXN1bHQuYWRkKGtleSkpO1xuXHRcdH0pO1xuXHR9XG5cdGNvbnN0IG92ZXJyaWRlczogW3N0cmluZywgc3RyaW5nW11dW10gPSBbXTtcblx0b3ZlcnJpZGVzTWFwLmZvckVhY2goKGtleXMsIGlkZW50aWZpZXIpID0+IG92ZXJyaWRlcy5wdXNoKFtpZGVudGlmaWVyLCBbLi4ua2V5cy52YWx1ZXMoKV1dKSk7XG5cdHJldHVybiB7IGtleXM6IFsuLi5rZXlzU2V0LnZhbHVlcygpXSwgb3ZlcnJpZGVzIH07XG59XG5cbmV4cG9ydCBjbGFzcyBDb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQgaW1wbGVtZW50cyBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9tYXJrZXIgPSAnXFxuJztcblx0cHJpdmF0ZSByZWFkb25seSBfbWFya2VyQ29kZTEgPSB0aGlzLl9tYXJrZXIuY2hhckNvZGVBdCgwKTtcblx0cHJpdmF0ZSByZWFkb25seSBfbWFya2VyQ29kZTIgPSAnLicuY2hhckNvZGVBdCgwKTtcblx0cHJpdmF0ZSByZWFkb25seSBfYWZmZWN0c0NvbmZpZ1N0cjogc3RyaW5nO1xuXG5cdHJlYWRvbmx5IGFmZmVjdGVkS2V5cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRzb3VyY2UhOiBDb25maWd1cmF0aW9uVGFyZ2V0O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGNoYW5nZTogSUNvbmZpZ3VyYXRpb25DaGFuZ2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBwcmV2aW91czogeyB3b3Jrc3BhY2U/OiBXb3Jrc3BhY2U7IGRhdGE6IElDb25maWd1cmF0aW9uRGF0YSB9IHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgY3VycmVudENvbmZpZ3VyYWl0b246IENvbmZpZ3VyYXRpb24sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjdXJyZW50V29ya3NwYWNlOiBXb3Jrc3BhY2UgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHtcblx0XHRmb3IgKGNvbnN0IGtleSBvZiBjaGFuZ2Uua2V5cykge1xuXHRcdFx0dGhpcy5hZmZlY3RlZEtleXMuYWRkKGtleSk7XG5cdFx0fVxuXHRcdGZvciAoY29uc3QgWywga2V5c10gb2YgY2hhbmdlLm92ZXJyaWRlcykge1xuXHRcdFx0Zm9yIChjb25zdCBrZXkgb2Yga2V5cykge1xuXHRcdFx0XHR0aGlzLmFmZmVjdGVkS2V5cy5hZGQoa2V5KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBFeGFtcGxlOiAnXFxuZm9vLmJhclxcbmFiYy5kZWZcXG4nXG5cdFx0dGhpcy5fYWZmZWN0c0NvbmZpZ1N0ciA9IHRoaXMuX21hcmtlcjtcblx0XHRmb3IgKGNvbnN0IGtleSBvZiB0aGlzLmFmZmVjdGVkS2V5cykge1xuXHRcdFx0dGhpcy5fYWZmZWN0c0NvbmZpZ1N0ciArPSBrZXkgKyB0aGlzLl9tYXJrZXI7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcHJldmlvdXNDb25maWd1cmF0aW9uOiBDb25maWd1cmF0aW9uIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRnZXQgcHJldmlvdXNDb25maWd1cmF0aW9uKCk6IENvbmZpZ3VyYXRpb24gfCB1bmRlZmluZWQge1xuXHRcdGlmICghdGhpcy5fcHJldmlvdXNDb25maWd1cmF0aW9uICYmIHRoaXMucHJldmlvdXMpIHtcblx0XHRcdHRoaXMuX3ByZXZpb3VzQ29uZmlndXJhdGlvbiA9IENvbmZpZ3VyYXRpb24ucGFyc2UodGhpcy5wcmV2aW91cy5kYXRhLCB0aGlzLmxvZ1NlcnZpY2UpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fcHJldmlvdXNDb25maWd1cmF0aW9uO1xuXHR9XG5cblx0YWZmZWN0c0NvbmZpZ3VyYXRpb24oc2VjdGlvbjogc3RyaW5nLCBvdmVycmlkZXM/OiBJQ29uZmlndXJhdGlvbk92ZXJyaWRlcyk6IGJvb2xlYW4ge1xuXHRcdC8vIHdlIGhhdmUgb25lIGxhcmdlIHN0cmluZyB3aXRoIGFsbCBrZXlzIHRoYXQgaGF2ZSBjaGFuZ2VkLiB3ZSBwYWQgKG1hcmtlcikgdGhlIHNlY3Rpb25cblx0XHQvLyBhbmQgY2hlY2sgdGhhdCBlaXRoZXIgZmluZCBpdCBwYWRkZWQgb3IgYmVmb3JlIGEgc2VnbWVudCBjaGFyYWN0ZXJcblx0XHRjb25zdCBuZWVkbGUgPSB0aGlzLl9tYXJrZXIgKyBzZWN0aW9uO1xuXHRcdGNvbnN0IGlkeCA9IHRoaXMuX2FmZmVjdHNDb25maWdTdHIuaW5kZXhPZihuZWVkbGUpO1xuXHRcdGlmIChpZHggPCAwKSB7XG5cdFx0XHQvLyBOT1Q6IChtYXJrZXIgKyBzZWN0aW9uKVxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCBwb3MgPSBpZHggKyBuZWVkbGUubGVuZ3RoO1xuXHRcdGlmIChwb3MgPj0gdGhpcy5fYWZmZWN0c0NvbmZpZ1N0ci5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0Y29uc3QgY29kZSA9IHRoaXMuX2FmZmVjdHNDb25maWdTdHIuY2hhckNvZGVBdChwb3MpO1xuXHRcdGlmIChjb2RlICE9PSB0aGlzLl9tYXJrZXJDb2RlMSAmJiBjb2RlICE9PSB0aGlzLl9tYXJrZXJDb2RlMikge1xuXHRcdFx0Ly8gTk9UOiBzZWN0aW9uICsgKG1hcmtlciB8IHNlZ21lbnQpXG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmIChvdmVycmlkZXMpIHtcblx0XHRcdGNvbnN0IHZhbHVlMSA9IHRoaXMucHJldmlvdXNDb25maWd1cmF0aW9uID8gdGhpcy5wcmV2aW91c0NvbmZpZ3VyYXRpb24uZ2V0VmFsdWUoc2VjdGlvbiwgb3ZlcnJpZGVzLCB0aGlzLnByZXZpb3VzPy53b3Jrc3BhY2UpIDogdW5kZWZpbmVkO1xuXHRcdFx0Y29uc3QgdmFsdWUyID0gdGhpcy5jdXJyZW50Q29uZmlndXJhaXRvbi5nZXRWYWx1ZShzZWN0aW9uLCBvdmVycmlkZXMsIHRoaXMuY3VycmVudFdvcmtzcGFjZSk7XG5cdFx0XHRyZXR1cm4gIW9iamVjdHMuZXF1YWxzKHZhbHVlMSwgdmFsdWUyKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cbn1cblxuZnVuY3Rpb24gY29tcGFyZShmcm9tOiBDb25maWd1cmF0aW9uTW9kZWwgfCB1bmRlZmluZWQsIHRvOiBDb25maWd1cmF0aW9uTW9kZWwgfCB1bmRlZmluZWQpOiBJQ29uZmlndXJhdGlvbkNvbXBhcmVSZXN1bHQge1xuXHRjb25zdCB7IGFkZGVkLCByZW1vdmVkLCB1cGRhdGVkIH0gPSBjb21wYXJlQ29uZmlndXJhdGlvbkNvbnRlbnRzKHRvPy5yYXdDb25maWd1cmF0aW9uLCBmcm9tPy5yYXdDb25maWd1cmF0aW9uKTtcblx0Y29uc3Qgb3ZlcnJpZGVzOiBbc3RyaW5nLCBzdHJpbmdbXV1bXSA9IFtdO1xuXG5cdGNvbnN0IGZyb21PdmVycmlkZUlkZW50aWZpZXJzID0gZnJvbT8uZ2V0QWxsT3ZlcnJpZGVJZGVudGlmaWVycygpIHx8IFtdO1xuXHRjb25zdCB0b092ZXJyaWRlSWRlbnRpZmllcnMgPSB0bz8uZ2V0QWxsT3ZlcnJpZGVJZGVudGlmaWVycygpIHx8IFtdO1xuXG5cdGlmICh0bykge1xuXHRcdGNvbnN0IGFkZGVkT3ZlcnJpZGVJZGVudGlmaWVycyA9IHRvT3ZlcnJpZGVJZGVudGlmaWVycy5maWx0ZXIoa2V5ID0+ICFmcm9tT3ZlcnJpZGVJZGVudGlmaWVycy5pbmNsdWRlcyhrZXkpKTtcblx0XHRmb3IgKGNvbnN0IGlkZW50aWZpZXIgb2YgYWRkZWRPdmVycmlkZUlkZW50aWZpZXJzKSB7XG5cdFx0XHRvdmVycmlkZXMucHVzaChbaWRlbnRpZmllciwgdG8uZ2V0S2V5c0Zvck92ZXJyaWRlSWRlbnRpZmllcihpZGVudGlmaWVyKV0pO1xuXHRcdH1cblx0fVxuXG5cdGlmIChmcm9tKSB7XG5cdFx0Y29uc3QgcmVtb3ZlZE92ZXJyaWRlSWRlbnRpZmllcnMgPSBmcm9tT3ZlcnJpZGVJZGVudGlmaWVycy5maWx0ZXIoa2V5ID0+ICF0b092ZXJyaWRlSWRlbnRpZmllcnMuaW5jbHVkZXMoa2V5KSk7XG5cdFx0Zm9yIChjb25zdCBpZGVudGlmaWVyIG9mIHJlbW92ZWRPdmVycmlkZUlkZW50aWZpZXJzKSB7XG5cdFx0XHRvdmVycmlkZXMucHVzaChbaWRlbnRpZmllciwgZnJvbS5nZXRLZXlzRm9yT3ZlcnJpZGVJZGVudGlmaWVyKGlkZW50aWZpZXIpXSk7XG5cdFx0fVxuXHR9XG5cblx0aWYgKHRvICYmIGZyb20pIHtcblx0XHRmb3IgKGNvbnN0IGlkZW50aWZpZXIgb2YgZnJvbU92ZXJyaWRlSWRlbnRpZmllcnMpIHtcblx0XHRcdGlmICh0b092ZXJyaWRlSWRlbnRpZmllcnMuaW5jbHVkZXMoaWRlbnRpZmllcikpIHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gY29tcGFyZUNvbmZpZ3VyYXRpb25Db250ZW50cyh7IGNvbnRlbnRzOiBmcm9tLmdldE92ZXJyaWRlVmFsdWUodW5kZWZpbmVkLCBpZGVudGlmaWVyKSB8fCB7fSwga2V5czogZnJvbS5nZXRLZXlzRm9yT3ZlcnJpZGVJZGVudGlmaWVyKGlkZW50aWZpZXIpIH0sIHsgY29udGVudHM6IHRvLmdldE92ZXJyaWRlVmFsdWUodW5kZWZpbmVkLCBpZGVudGlmaWVyKSB8fCB7fSwga2V5czogdG8uZ2V0S2V5c0Zvck92ZXJyaWRlSWRlbnRpZmllcihpZGVudGlmaWVyKSB9KTtcblx0XHRcdFx0b3ZlcnJpZGVzLnB1c2goW2lkZW50aWZpZXIsIFsuLi5yZXN1bHQuYWRkZWQsIC4uLnJlc3VsdC5yZW1vdmVkLCAuLi5yZXN1bHQudXBkYXRlZF1dKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRyZXR1cm4geyBhZGRlZCwgcmVtb3ZlZCwgdXBkYXRlZCwgb3ZlcnJpZGVzIH07XG59XG5cbmZ1bmN0aW9uIGNvbXBhcmVDb25maWd1cmF0aW9uQ29udGVudHModG86IHsga2V5czogc3RyaW5nW107IGNvbnRlbnRzOiBhbnkgfSB8IHVuZGVmaW5lZCwgZnJvbTogeyBrZXlzOiBzdHJpbmdbXTsgY29udGVudHM6IGFueSB9IHwgdW5kZWZpbmVkKSB7XG5cdGNvbnN0IGFkZGVkID0gdG9cblx0XHQ/IGZyb20gPyB0by5rZXlzLmZpbHRlcihrZXkgPT4gZnJvbS5rZXlzLmluZGV4T2Yoa2V5KSA9PT0gLTEpIDogWy4uLnRvLmtleXNdXG5cdFx0OiBbXTtcblx0Y29uc3QgcmVtb3ZlZCA9IGZyb21cblx0XHQ/IHRvID8gZnJvbS5rZXlzLmZpbHRlcihrZXkgPT4gdG8ua2V5cy5pbmRleE9mKGtleSkgPT09IC0xKSA6IFsuLi5mcm9tLmtleXNdXG5cdFx0OiBbXTtcblx0Y29uc3QgdXBkYXRlZDogc3RyaW5nW10gPSBbXTtcblxuXHRpZiAodG8gJiYgZnJvbSkge1xuXHRcdGZvciAoY29uc3Qga2V5IG9mIGZyb20ua2V5cykge1xuXHRcdFx0aWYgKHRvLmtleXMuaW5kZXhPZihrZXkpICE9PSAtMSkge1xuXHRcdFx0XHRjb25zdCB2YWx1ZTEgPSBnZXRDb25maWd1cmF0aW9uVmFsdWUoZnJvbS5jb250ZW50cywga2V5KTtcblx0XHRcdFx0Y29uc3QgdmFsdWUyID0gZ2V0Q29uZmlndXJhdGlvblZhbHVlKHRvLmNvbnRlbnRzLCBrZXkpO1xuXHRcdFx0XHRpZiAoIW9iamVjdHMuZXF1YWxzKHZhbHVlMSwgdmFsdWUyKSkge1xuXHRcdFx0XHRcdHVwZGF0ZWQucHVzaChrZXkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cdHJldHVybiB7IGFkZGVkLCByZW1vdmVkLCB1cGRhdGVkIH07XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFlBQVk7QUFFeEIsU0FBUyxTQUFTLGFBQWE7QUFDL0IsWUFBWSxVQUFVO0FBQ3RCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsVUFBVSxtQkFBbUI7QUFDdEMsWUFBWSxhQUFhO0FBRXpCLFlBQVksV0FBVztBQUN2QixTQUFTLFdBQTBCO0FBQ25DLFNBQVMsZ0JBQXFDLHVCQUFzUCxxQkFBcUIsb0JBQW9CO0FBQzdVLFNBQVMsb0JBQW9CLFlBQWtFLDRCQUE0QiwrQkFBK0I7QUFDMUosU0FBUyxxQkFBbUM7QUFFNUMsU0FBUyxnQkFBZ0I7QUFHekIsU0FBUyxPQUFVLE1BQVk7QUFDOUIsU0FBTyxPQUFPLFNBQVMsSUFBSSxJQUFJLE9BQU8sUUFBUSxXQUFXLElBQUk7QUFDOUQ7QUFJTyxNQUFNLG1CQUFrRDtBQUFBLEVBUTlELFlBQ2tCLFdBQ0EsT0FDQSxZQUNSLEtBQ1EsWUFDaEI7QUFMZ0I7QUFDQTtBQUNBO0FBQ1I7QUFDUTtBQVBsQixTQUFpQix5QkFBeUIsb0JBQUksSUFBZ0M7QUFBQSxFQVM5RTtBQUFBLEVBYkEsT0FBTyxpQkFBaUIsWUFBNkM7QUFDcEUsV0FBTyxJQUFJ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NkIsVUFBVSxDQUFDLENBQUM7QUFBQSxJQUN6RTtBQUFBLEVBQ0Q7QUFFQSxNQUFJLE1BQU07QUFDVCxVQUFNLDZCQUE2Qix3QkFBd0IsT0FBTyxTQUFPLENBQUMsc0JBQXNCLFNBQVMsR0FBRyxDQUFDO0FBQzdHLGVBQVcsY0FBYyw0QkFBNEI7QUFDcEQsZ0JBQVUsS0FBSyxDQUFDLFlBQVksS0FBSyw2QkFBNkIsVUFBVSxDQUFDLENBQUM7QUFBQSxJQUMzRTtBQUFBLEVBQ0Q7QUFFQSxNQUFJLE1BQU0sTUFBTTtBQUNmLGVBQVcsY0FBYyx5QkFBeUI7QUFDakQsVUFBSSxzQkFBc0IsU0FBUyxVQUFVLEdBQUc7QUFDL0MsY0FBTSxTQUFTLDZCQUE2QixFQUFFLFVBQVUsS0FBSyxpQkFBaUIsUUFBVyxVQUFVLEtBQUssQ0FBQyxHQUFHLE1BQU0sS0FBSyw2QkFBNkIsVUFBVSxFQUFFLEdBQUcsRUFBRSxVQUFVLEdBQUcsaUJBQWlCLFFBQVcsVUFBVSxLQUFLLENBQUMsR0FBRyxNQUFNLEdBQUcsNkJBQTZCLFVBQVUsRUFBRSxDQUFDO0FBQ3BSLGtCQUFVLEtBQUssQ0FBQyxZQUFZLENBQUMsR0FBRyxPQUFPLE9BQU8sR0FBRyxPQUFPLFNBQVMsR0FBRyxPQUFPLE9BQU8sQ0FBQyxDQUFDO0FBQUEsTUFDckY7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVBLFNBQU8sRUFBRSxPQUFPLFNBQVMsU0FBUyxVQUFVO0FBQzdDO0FBRUEsU0FBUyw2QkFBNkIsSUFBbUQsTUFBcUQ7QUFDN0ksUUFBTSxRQUFRLEtBQ1gsT0FBTyxHQUFHLEtBQUssT0FBTyxTQUFPLEtBQUssS0FBSyxRQUFRLEdBQUcsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxJQUN6RSxDQUFDO0FBQ0osUUFBTSxVQUFVLE9BQ2IsS0FBSyxLQUFLLEtBQUssT0FBTyxTQUFPLEdBQUcsS0FBSyxRQUFRLEdBQUcsTUFBTSxFQUFFLElBQUksQ0FBQyxHQUFHLEtBQUssSUFBSSxJQUN6RSxDQUFDO0FBQ0osUUFBTSxVQUFvQixDQUFDO0FBRTNCLE1BQUksTUFBTSxNQUFNO0FBQ2YsZUFBVyxPQUFPLEtBQUssTUFBTTtBQUM1QixVQUFJLEdBQUcsS0FBSyxRQUFRLEdBQUcsTUFBTSxJQUFJO0FBQ2hDLGNBQU0sU0FBUyxzQkFBc0IsS0FBSyxVQUFVLEdBQUc7QUFDdkQsY0FBTSxTQUFTLHNCQUFzQixHQUFHLFVBQVUsR0FBRztBQUNyRCxZQUFJLENBQUMsUUFBUSxPQUFPLFFBQVEsTUFBTSxHQUFHO0FBQ3BDLGtCQUFRLEtBQUssR0FBRztBQUFBLFFBQ2pCO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0EsU0FBTyxFQUFFLE9BQU8sU0FBUyxRQUFRO0FBQ2xDOyIsCiAgIm5hbWVzIjogWyJrZXlzIiwgImtleSJdCn0K
