import { distinct } from "../../../base/common/arrays.js";
import { Emitter } from "../../../base/common/event.js";
import * as types from "../../../base/common/types.js";
import * as nls from "../../../nls.js";
import { getLanguageTagSettingPlainKey } from "./configuration.js";
import { Extensions as JSONExtensions } from "../../jsonschemas/common/jsonContributionRegistry.js";
import { Registry } from "../../registry/common/platform.js";
var EditPresentationTypes = /* @__PURE__ */ ((EditPresentationTypes2) => {
  EditPresentationTypes2["Multiline"] = "multilineText";
  EditPresentationTypes2["Singleline"] = "singlelineText";
  return EditPresentationTypes2;
})(EditPresentationTypes || {});
const Extensions = {
  Configuration: "base.contributions.configuration"
};
var ConfigurationScope = /* @__PURE__ */ ((ConfigurationScope2) => {
  ConfigurationScope2[ConfigurationScope2["APPLICATION"] = 1] = "APPLICATION";
  ConfigurationScope2[ConfigurationScope2["MACHINE"] = 2] = "MACHINE";
  ConfigurationScope2[ConfigurationScope2["APPLICATION_MACHINE"] = 3] = "APPLICATION_MACHINE";
  ConfigurationScope2[ConfigurationScope2["WINDOW"] = 4] = "WINDOW";
  ConfigurationScope2[ConfigurationScope2["RESOURCE"] = 5] = "RESOURCE";
  ConfigurationScope2[ConfigurationScope2["LANGUAGE_OVERRIDABLE"] = 6] = "LANGUAGE_OVERRIDABLE";
  ConfigurationScope2[ConfigurationScope2["MACHINE_OVERRIDABLE"] = 7] = "MACHINE_OVERRIDABLE";
  return ConfigurationScope2;
})(ConfigurationScope || {});
const allSettings = { properties: {}, patternProperties: {} };
const applicationSettings = { properties: {}, patternProperties: {} };
const applicationMachineSettings = { properties: {}, patternProperties: {} };
const machineSettings = { properties: {}, patternProperties: {} };
const machineOverridableSettings = { properties: {}, patternProperties: {} };
const windowSettings = { properties: {}, patternProperties: {} };
const resourceSettings = { properties: {}, patternProperties: {} };
const resourceLanguageSettingsSchemaId = "vscode://schemas/settings/resourceLanguage";
const configurationDefaultsSchemaId = "vscode://schemas/settings/configurationDefaults";
const contributionRegistry = Registry.as(JSONExtensions.JSONContribution);
class ConfigurationRegistry {
  constructor() {
    this.registeredConfigurationDefaults = [];
    this.overrideIdentifiers = /* @__PURE__ */ new Set();
    this._onDidSchemaChange = new Emitter();
    this.onDidSchemaChange = this._onDidSchemaChange.event;
    this._onDidUpdateConfiguration = new Emitter();
    this.onDidUpdateConfiguration = this._onDidUpdateConfiguration.event;
    this.configurationDefaultsOverrides = /* @__PURE__ */ new Map();
    this.defaultLanguageConfigurationOverridesNode = {
      id: "defaultOverrides",
      title: nls.localize("defaultLanguageConfigurationOverrides.title", "Default Language Configuration Overrides"),
      properties: {}
    };
    this.configurationContributors = [this.defaultLanguageConfigurationOverridesNode];
    this.resourceLanguageSettingsSchema = {
      properties: {},
      patternProperties: {},
      additionalProperties: true,
      allowTrailingCommas: true,
      allowComments: true
    };
    this.configurationProperties = {};
    this.policyConfigurations = /* @__PURE__ */ new Map();
    this.excludedConfigurationProperties = {};
    contributionRegistry.registerSchema(resourceLanguageSettingsSchemaId, this.resourceLanguageSettingsSchema);
    this.registerOverridePropertyPatternKey();
  }
  registerConfiguration(configuration, validate = true) {
    this.registerConfigurations([configuration], validate);
    return configuration;
  }
  registerConfigurations(configurations, validate = true) {
    const properties = /* @__PURE__ */ new Set();
    this.doRegisterConfigurations(configurations, validate, properties);
    contributionRegistry.registerSchema(resourceLanguageSettingsSchemaId, this.resourceLanguageSettingsSchema);
    this._onDidSchemaChange.fire();
    this._onDidUpdateConfiguration.fire({ properties });
  }
  deregisterConfigurations(configurations) {
    const properties = /* @__PURE__ */ new Set();
    this.doDeregisterConfigurations(configurations, properties);
    contributionRegistry.registerSchema(resourceLanguageSettingsSchemaId, this.resourceLanguageSettingsSchema);
    this._onDidSchemaChange.fire();
    this._onDidUpdateConfiguration.fire({ properties });
  }
  updateConfigurations({ add, remove }) {
    const properties = /* @__PURE__ */ new Set();
    this.doDeregisterConfigurations(remove, properties);
    this.doRegisterConfigurations(add, false, properties);
    contributionRegistry.registerSchema(resourceLanguageSettingsSchemaId, this.resourceLanguageSettingsSchema);
    this._onDidSchemaChange.fire();
    this._onDidUpdateConfiguration.fire({ properties });
  }
  registerDefaultConfigurations(configurationDefaults) {
    const properties = /* @__PURE__ */ new Set();
    this.doRegisterDefaultConfigurations(configurationDefaults, properties);
    this._onDidSchemaChange.fire();
    this._onDidUpdateConfiguration.fire({ properties, defaultsOverrides: true });
  }
  doRegisterDefaultConfigurations(configurationDefaults, bucket) {
    this.registeredConfigurationDefaults.push(...configurationDefaults);
    const overrideIdentifiers = [];
    for (const { overrides, source } of configurationDefaults) {
      for (const key in overrides) {
        bucket.add(key);
        const configurationDefaultOverridesForKey = this.configurationDefaultsOverrides.get(key) ?? this.configurationDefaultsOverrides.set(key, { configurationDefaultOverrides: [] }).get(key);
        const value = overrides[key];
        configurationDefaultOverridesForKey.configurationDefaultOverrides.push({ value, source });
        if (OVERRIDE_PROPERTY_REGEX.test(key)) {
          const newDefaultOverride = this.mergeDefaultConfigurationsForOverrideIdentifier(key, value, source, configurationDefaultOverridesForKey.configurationDefaultOverrideValue);
          if (!newDefaultOverride) {
            continue;
          }
          configurationDefaultOverridesForKey.configurationDefaultOverrideValue = newDefaultOverride;
          this.updateDefaultOverrideProperty(key, newDefaultOverride, source);
          overrideIdentifiers.push(...overrideIdentifiersFromKey(key));
        } else {
          const newDefaultOverride = this.mergeDefaultConfigurationsForConfigurationProperty(key, value, source, configurationDefaultOverridesForKey.configurationDefaultOverrideValue);
          if (!newDefaultOverride) {
            continue;
          }
          configurationDefaultOverridesForKey.configurationDefaultOverrideValue = newDefaultOverride;
          const property = this.configurationProperties[key];
          if (property) {
            this.updatePropertyDefaultValue(key, property);
            this.updateSchema(key, property);
          }
        }
      }
    }
    this.doRegisterOverrideIdentifiers(overrideIdentifiers);
  }
  deregisterDefaultConfigurations(defaultConfigurations) {
    const properties = /* @__PURE__ */ new Set();
    this.doDeregisterDefaultConfigurations(defaultConfigurations, properties);
    this._onDidSchemaChange.fire();
    this._onDidUpdateConfiguration.fire({ properties, defaultsOverrides: true });
  }
  doDeregisterDefaultConfigurations(defaultConfigurations, bucket) {
    for (const defaultConfiguration of defaultConfigurations) {
      const index = this.registeredConfigurationDefaults.indexOf(defaultConfiguration);
      if (index !== -1) {
        this.registeredConfigurationDefaults.splice(index, 1);
      }
    }
    for (const { overrides, source } of defaultConfigurations) {
      for (const key in overrides) {
        const configurationDefaultOverridesForKey = this.configurationDefaultsOverrides.get(key);
        if (!configurationDefaultOverridesForKey) {
          continue;
        }
        const index = configurationDefaultOverridesForKey.configurationDefaultOverrides.findIndex((configurationDefaultOverride) => source ? configurationDefaultOverride.source?.id === source.id : configurationDefaultOverride.value === overrides[key]);
        if (index === -1) {
          continue;
        }
        configurationDefaultOverridesForKey.configurationDefaultOverrides.splice(index, 1);
        if (configurationDefaultOverridesForKey.configurationDefaultOverrides.length === 0) {
          this.configurationDefaultsOverrides.delete(key);
        }
        if (OVERRIDE_PROPERTY_REGEX.test(key)) {
          let configurationDefaultOverrideValue;
          for (const configurationDefaultOverride of configurationDefaultOverridesForKey.configurationDefaultOverrides) {
            configurationDefaultOverrideValue = this.mergeDefaultConfigurationsForOverrideIdentifier(key, configurationDefaultOverride.value, configurationDefaultOverride.source, configurationDefaultOverrideValue);
          }
          if (configurationDefaultOverrideValue && !types.isEmptyObject(configurationDefaultOverrideValue.value)) {
            configurationDefaultOverridesForKey.configurationDefaultOverrideValue = configurationDefaultOverrideValue;
            this.updateDefaultOverrideProperty(key, configurationDefaultOverrideValue, source);
          } else {
            this.configurationDefaultsOverrides.delete(key);
            delete this.configurationProperties[key];
            delete this.defaultLanguageConfigurationOverridesNode.properties[key];
          }
        } else {
          let configurationDefaultOverrideValue;
          for (const configurationDefaultOverride of configurationDefaultOverridesForKey.configurationDefaultOverrides) {
            configurationDefaultOverrideValue = this.mergeDefaultConfigurationsForConfigurationProperty(key, configurationDefaultOverride.value, configurationDefaultOverride.source, configurationDefaultOverrideValue);
          }
          configurationDefaultOverridesForKey.configurationDefaultOverrideValue = configurationDefaultOverrideValue;
          const property = this.configurationProperties[key];
          if (property) {
            this.updatePropertyDefaultValue(key, property);
            this.updateSchema(key, property);
          }
        }
        bucket.add(key);
      }
    }
    this.updateOverridePropertyPatternKey();
  }
  updateDefaultOverrideProperty(key, newDefaultOverride, source) {
    const property = {
      type: "object",
      default: newDefaultOverride.value,
      description: nls.localize("defaultLanguageConfiguration.description", "Configure settings to be overridden for the {0} language.", getLanguageTagSettingPlainKey(key)),
      $ref: resourceLanguageSettingsSchemaId,
      defaultDefaultValue: newDefaultOverride.value,
      source,
      defaultValueSource: source
    };
    this.configurationProperties[key] = property;
    this.defaultLanguageConfigurationOverridesNode.properties[key] = property;
  }
  mergeDefaultConfigurationsForOverrideIdentifier(overrideIdentifier, configurationValueObject, valueSource, existingDefaultOverride) {
    const defaultValue = existingDefaultOverride?.value || {};
    const source = existingDefaultOverride?.source ?? /* @__PURE__ */ new Map();
    if (!(source instanceof Map)) {
      console.error("objectConfigurationSources is not a Map");
      return void 0;
    }
    for (const propertyKey of Object.keys(configurationValueObject)) {
      const propertyDefaultValue = configurationValueObject[propertyKey];
      const isObjectSetting = types.isObject(propertyDefaultValue) && (types.isUndefined(defaultValue[propertyKey]) || types.isObject(defaultValue[propertyKey]));
      if (isObjectSetting) {
        defaultValue[propertyKey] = { ...defaultValue[propertyKey] ?? {}, ...propertyDefaultValue };
        if (valueSource) {
          for (const objectKey in propertyDefaultValue) {
            source.set(`${propertyKey}.${objectKey}`, valueSource);
          }
        }
      } else {
        defaultValue[propertyKey] = propertyDefaultValue;
        if (valueSource) {
          source.set(propertyKey, valueSource);
        } else {
          source.delete(propertyKey);
        }
      }
    }
    return { value: defaultValue, source };
  }
  mergeDefaultConfigurationsForConfigurationProperty(propertyKey, value, valuesSource, existingDefaultOverride) {
    const property = this.configurationProperties[propertyKey];
    const existingDefaultValue = existingDefaultOverride?.value ?? property?.defaultDefaultValue;
    let source = valuesSource;
    const isObjectSetting = types.isObject(value) && (property !== void 0 && property.type === "object" || property === void 0 && (types.isUndefined(existingDefaultValue) || types.isObject(existingDefaultValue)));
    if (isObjectSetting) {
      source = existingDefaultOverride?.source ?? /* @__PURE__ */ new Map();
      if (!(source instanceof Map)) {
        console.error("defaultValueSource is not a Map");
        return void 0;
      }
      for (const objectKey in value) {
        if (valuesSource) {
          source.set(`${propertyKey}.${objectKey}`, valuesSource);
        }
      }
      value = { ...types.isObject(existingDefaultValue) ? existingDefaultValue : {}, ...value };
    }
    return { value, source };
  }
  deltaConfiguration(delta) {
    let defaultsOverrides = false;
    const properties = /* @__PURE__ */ new Set();
    if (delta.removedDefaults) {
      this.doDeregisterDefaultConfigurations(delta.removedDefaults, properties);
      defaultsOverrides = true;
    }
    if (delta.addedDefaults) {
      this.doRegisterDefaultConfigurations(delta.addedDefaults, properties);
      defaultsOverrides = true;
    }
    if (delta.removedConfigurations) {
      this.doDeregisterConfigurations(delta.removedConfigurations, properties);
    }
    if (delta.addedConfigurations) {
      this.doRegisterConfigurations(delta.addedConfigurations, false, properties);
    }
    this._onDidSchemaChange.fire();
    this._onDidUpdateConfiguration.fire({ properties, defaultsOverrides });
  }
  notifyConfigurationSchemaUpdated(...configurations) {
    this._onDidSchemaChange.fire();
  }
  registerOverrideIdentifiers(overrideIdentifiers) {
    this.doRegisterOverrideIdentifiers(overrideIdentifiers);
    this._onDidSchemaChange.fire();
  }
  doRegisterOverrideIdentifiers(overrideIdentifiers) {
    for (const overrideIdentifier of overrideIdentifiers) {
      this.overrideIdentifiers.add(overrideIdentifier);
    }
    this.updateOverridePropertyPatternKey();
  }
  doRegisterConfigurations(configurations, validate, bucket) {
    configurations.forEach((configuration) => {
      this.validateAndRegisterProperties(configuration, validate, configuration.extensionInfo, configuration.restrictedProperties, void 0, bucket);
      this.configurationContributors.push(configuration);
      this.registerJSONConfiguration(configuration);
    });
  }
  doDeregisterConfigurations(configurations, bucket) {
    const deregisterConfiguration = (configuration) => {
      if (configuration.properties) {
        for (const key in configuration.properties) {
          bucket.add(key);
          const property = this.configurationProperties[key];
          if (property?.policy?.name) {
            this.policyConfigurations.delete(property.policy.name);
          }
          delete this.configurationProperties[key];
          this.removeFromSchema(key, configuration.properties[key]);
        }
      }
      configuration.allOf?.forEach((node) => deregisterConfiguration(node));
    };
    for (const configuration of configurations) {
      deregisterConfiguration(configuration);
      const index = this.configurationContributors.indexOf(configuration);
      if (index !== -1) {
        this.configurationContributors.splice(index, 1);
      }
    }
  }
  validateAndRegisterProperties(configuration, validate = true, extensionInfo, restrictedProperties, scope = 4 /* WINDOW */, bucket) {
    scope = types.isUndefinedOrNull(configuration.scope) ? scope : configuration.scope;
    const properties = configuration.properties;
    if (properties) {
      for (const key in properties) {
        const property = properties[key];
        if (validate && validateProperty(key, property)) {
          delete properties[key];
          continue;
        }
        property.source = extensionInfo;
        property.defaultDefaultValue = properties[key].default;
        this.updatePropertyDefaultValue(key, property);
        if (OVERRIDE_PROPERTY_REGEX.test(key)) {
          property.scope = void 0;
        } else {
          property.scope = types.isUndefinedOrNull(property.scope) ? scope : property.scope;
          property.restricted = types.isUndefinedOrNull(property.restricted) ? !!restrictedProperties?.includes(key) : property.restricted;
        }
        const excluded = properties[key].hasOwnProperty("included") && !properties[key].included;
        const policyName = properties[key].policy?.name;
        if (excluded) {
          this.excludedConfigurationProperties[key] = properties[key];
          if (policyName) {
            this.policyConfigurations.set(policyName, key);
            bucket.add(key);
          }
          delete properties[key];
        } else {
          bucket.add(key);
          if (policyName) {
            this.policyConfigurations.set(policyName, key);
          }
          this.configurationProperties[key] = properties[key];
          if (!properties[key].deprecationMessage && properties[key].markdownDeprecationMessage) {
            properties[key].deprecationMessage = properties[key].markdownDeprecationMessage;
          }
        }
      }
    }
    const subNodes = configuration.allOf;
    if (subNodes) {
      for (const node of subNodes) {
        this.validateAndRegisterProperties(node, validate, extensionInfo, restrictedProperties, scope, bucket);
      }
    }
  }
  // TODO: @sandy081 - Remove this method and include required info in getConfigurationProperties
  getConfigurations() {
    return this.configurationContributors;
  }
  getConfigurationProperties() {
    return this.configurationProperties;
  }
  getPolicyConfigurations() {
    return this.policyConfigurations;
  }
  getExcludedConfigurationProperties() {
    return this.excludedConfigurationProperties;
  }
  getRegisteredDefaultConfigurations() {
    return [...this.registeredConfigurationDefaults];
  }
  getConfigurationDefaultsOverrides() {
    const configurationDefaultsOverrides = /* @__PURE__ */ new Map();
    for (const [key, value] of this.configurationDefaultsOverrides) {
      if (value.configurationDefaultOverrideValue) {
        configurationDefaultsOverrides.set(key, value.configurationDefaultOverrideValue);
      }
    }
    return configurationDefaultsOverrides;
  }
  registerJSONConfiguration(configuration) {
    const register = (configuration2) => {
      const properties = configuration2.properties;
      if (properties) {
        for (const key in properties) {
          this.updateSchema(key, properties[key]);
        }
      }
      const subNodes = configuration2.allOf;
      subNodes?.forEach(register);
    };
    register(configuration);
  }
  updateSchema(key, property) {
    allSettings.properties[key] = property;
    switch (property.scope) {
      case 1 /* APPLICATION */:
        applicationSettings.properties[key] = property;
        break;
      case 2 /* MACHINE */:
        machineSettings.properties[key] = property;
        break;
      case 3 /* APPLICATION_MACHINE */:
        applicationMachineSettings.properties[key] = property;
        break;
      case 7 /* MACHINE_OVERRIDABLE */:
        machineOverridableSettings.properties[key] = property;
        break;
      case 4 /* WINDOW */:
        windowSettings.properties[key] = property;
        break;
      case 5 /* RESOURCE */:
        resourceSettings.properties[key] = property;
        break;
      case 6 /* LANGUAGE_OVERRIDABLE */:
        resourceSettings.properties[key] = property;
        this.resourceLanguageSettingsSchema.properties[key] = property;
        break;
    }
  }
  removeFromSchema(key, property) {
    delete allSettings.properties[key];
    switch (property.scope) {
      case 1 /* APPLICATION */:
        delete applicationSettings.properties[key];
        break;
      case 2 /* MACHINE */:
        delete machineSettings.properties[key];
        break;
      case 3 /* APPLICATION_MACHINE */:
        delete applicationMachineSettings.properties[key];
        break;
      case 7 /* MACHINE_OVERRIDABLE */:
        delete machineOverridableSettings.properties[key];
        break;
      case 4 /* WINDOW */:
        delete windowSettings.properties[key];
        break;
      case 5 /* RESOURCE */:
      case 6 /* LANGUAGE_OVERRIDABLE */:
        delete resourceSettings.properties[key];
        delete this.resourceLanguageSettingsSchema.properties[key];
        break;
    }
  }
  updateOverridePropertyPatternKey() {
    for (const overrideIdentifier of this.overrideIdentifiers.values()) {
      const overrideIdentifierProperty = `[${overrideIdentifier}]`;
      const resourceLanguagePropertiesSchema = {
        type: "object",
        description: nls.localize("overrideSettings.defaultDescription", "Configure editor settings to be overridden for a language."),
        errorMessage: nls.localize("overrideSettings.errorMessage", "This setting does not support per-language configuration."),
        $ref: resourceLanguageSettingsSchemaId
      };
      this.updatePropertyDefaultValue(overrideIdentifierProperty, resourceLanguagePropertiesSchema);
      allSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
      applicationSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
      applicationMachineSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
      machineSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
      machineOverridableSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
      windowSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
      resourceSettings.properties[overrideIdentifierProperty] = resourceLanguagePropertiesSchema;
    }
  }
  registerOverridePropertyPatternKey() {
    const resourceLanguagePropertiesSchema = {
      type: "object",
      description: nls.localize("overrideSettings.defaultDescription", "Configure editor settings to be overridden for a language."),
      errorMessage: nls.localize("overrideSettings.errorMessage", "This setting does not support per-language configuration."),
      $ref: resourceLanguageSettingsSchemaId
    };
    allSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
    applicationSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
    applicationMachineSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
    machineSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
    machineOverridableSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
    windowSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
    resourceSettings.patternProperties[OVERRIDE_PROPERTY_PATTERN] = resourceLanguagePropertiesSchema;
    this._onDidSchemaChange.fire();
  }
  updatePropertyDefaultValue(key, property) {
    const configurationdefaultOverride = this.configurationDefaultsOverrides.get(key)?.configurationDefaultOverrideValue;
    let defaultValue = void 0;
    let defaultSource = void 0;
    if (configurationdefaultOverride && (!property.disallowConfigurationDefault || !configurationdefaultOverride.source)) {
      defaultValue = configurationdefaultOverride.value;
      defaultSource = configurationdefaultOverride.source;
    }
    if (types.isUndefined(defaultValue)) {
      defaultValue = property.defaultDefaultValue;
      defaultSource = void 0;
    }
    if (types.isUndefined(defaultValue)) {
      defaultValue = getDefaultValue(property.type);
    }
    property.default = defaultValue;
    property.defaultValueSource = defaultSource;
  }
}
const OVERRIDE_IDENTIFIER_PATTERN = `\\[([^\\]]+)\\]`;
const OVERRIDE_IDENTIFIER_REGEX = new RegExp(OVERRIDE_IDENTIFIER_PATTERN, "g");
const OVERRIDE_PROPERTY_PATTERN = `^(${OVERRIDE_IDENTIFIER_PATTERN})+$`;
const OVERRIDE_PROPERTY_REGEX = new RegExp(OVERRIDE_PROPERTY_PATTERN);
function overrideIdentifiersFromKey(key) {
  const identifiers = [];
  if (OVERRIDE_PROPERTY_REGEX.test(key)) {
    let matches = OVERRIDE_IDENTIFIER_REGEX.exec(key);
    while (matches?.length) {
      const identifier = matches[1].trim();
      if (identifier) {
        identifiers.push(identifier);
      }
      matches = OVERRIDE_IDENTIFIER_REGEX.exec(key);
    }
  }
  return distinct(identifiers);
}
function keyFromOverrideIdentifiers(overrideIdentifiers) {
  return overrideIdentifiers.reduce((result, overrideIdentifier) => `${result}[${overrideIdentifier}]`, "");
}
function getDefaultValue(type) {
  const t = Array.isArray(type) ? type[0] : type;
  switch (t) {
    case "boolean":
      return false;
    case "integer":
    case "number":
      return 0;
    case "string":
      return "";
    case "array":
      return [];
    case "object":
      return {};
    default:
      return null;
  }
}
const configurationRegistry = new ConfigurationRegistry();
Registry.add(Extensions.Configuration, configurationRegistry);
function validateProperty(property, schema) {
  if (!property.trim()) {
    return nls.localize("config.property.empty", "Cannot register an empty property");
  }
  if (OVERRIDE_PROPERTY_REGEX.test(property)) {
    return nls.localize("config.property.languageDefault", "Cannot register '{0}'. This matches property pattern '\\\\[.*\\\\]$' for describing language specific editor settings. Use 'configurationDefaults' contribution.", property);
  }
  if (configurationRegistry.getConfigurationProperties()[property] !== void 0) {
    return nls.localize("config.property.duplicate", "Cannot register '{0}'. This property is already registered.", property);
  }
  if (schema.policy?.name && configurationRegistry.getPolicyConfigurations().get(schema.policy?.name) !== void 0) {
    return nls.localize("config.policy.duplicate", "Cannot register '{0}'. The associated policy {1} is already registered with {2}.", property, schema.policy?.name, configurationRegistry.getPolicyConfigurations().get(schema.policy?.name));
  }
  return null;
}
function getScopes() {
  const scopes = [];
  const configurationProperties = configurationRegistry.getConfigurationProperties();
  for (const key of Object.keys(configurationProperties)) {
    scopes.push([key, configurationProperties[key].scope]);
  }
  scopes.push(["launch", 5 /* RESOURCE */]);
  scopes.push(["task", 5 /* RESOURCE */]);
  return scopes;
}
function getAllConfigurationProperties(configurationNode) {
  const result = {};
  for (const configuration of configurationNode) {
    const properties = configuration.properties;
    if (types.isObject(properties)) {
      for (const key in properties) {
        result[key] = properties[key];
      }
    }
    if (configuration.allOf) {
      Object.assign(result, getAllConfigurationProperties(configuration.allOf));
    }
  }
  return result;
}
function parseScope(scope) {
  switch (scope) {
    case "application":
      return 1 /* APPLICATION */;
    case "machine":
      return 2 /* MACHINE */;
    case "resource":
      return 5 /* RESOURCE */;
    case "machine-overridable":
      return 7 /* MACHINE_OVERRIDABLE */;
    case "language-overridable":
      return 6 /* LANGUAGE_OVERRIDABLE */;
    default:
      return 4 /* WINDOW */;
  }
}
export {
  ConfigurationScope,
  EditPresentationTypes,
  Extensions,
  OVERRIDE_PROPERTY_PATTERN,
  OVERRIDE_PROPERTY_REGEX,
  allSettings,
  applicationMachineSettings,
  applicationSettings,
  configurationDefaultsSchemaId,
  getAllConfigurationProperties,
  getDefaultValue,
  getScopes,
  keyFromOverrideIdentifiers,
  machineOverridableSettings,
  machineSettings,
  overrideIdentifiersFromKey,
  parseScope,
  resourceLanguageSettingsSchemaId,
  resourceSettings,
  validateProperty,
  windowSettings
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBkaXN0aW5jdCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBJU3RyaW5nRGljdGlvbmFyeSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbGxlY3Rpb25zLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSUpTT05TY2hlbWEgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uU2NoZW1hLmpzJztcbmltcG9ydCAqIGFzIHR5cGVzIGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgZ2V0TGFuZ3VhZ2VUYWdTZXR0aW5nUGxhaW5LZXkgfSBmcm9tICcuL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucyBhcyBKU09ORXh0ZW5zaW9ucywgSUpTT05Db250cmlidXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uL2pzb25zY2hlbWFzL2NvbW1vbi9qc29uQ29udHJpYnV0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVBvbGljeSwgUG9saWN5TmFtZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BvbGljeS5qcyc7XG5cbmV4cG9ydCBlbnVtIEVkaXRQcmVzZW50YXRpb25UeXBlcyB7XG5cdE11bHRpbGluZSA9ICdtdWx0aWxpbmVUZXh0Jyxcblx0U2luZ2xlbGluZSA9ICdzaW5nbGVsaW5lVGV4dCdcbn1cblxuZXhwb3J0IGNvbnN0IEV4dGVuc2lvbnMgPSB7XG5cdENvbmZpZ3VyYXRpb246ICdiYXNlLmNvbnRyaWJ1dGlvbnMuY29uZmlndXJhdGlvbidcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbmZpZ3VyYXRpb25EZWx0YSB7XG5cdHJlbW92ZWREZWZhdWx0cz86IElDb25maWd1cmF0aW9uRGVmYXVsdHNbXTtcblx0cmVtb3ZlZENvbmZpZ3VyYXRpb25zPzogSUNvbmZpZ3VyYXRpb25Ob2RlW107XG5cdGFkZGVkRGVmYXVsdHM/OiBJQ29uZmlndXJhdGlvbkRlZmF1bHRzW107XG5cdGFkZGVkQ29uZmlndXJhdGlvbnM/OiBJQ29uZmlndXJhdGlvbk5vZGVbXTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5IHtcblxuXHQvKipcblx0ICogUmVnaXN0ZXIgYSBjb25maWd1cmF0aW9uIHRvIHRoZSByZWdpc3RyeS5cblx0ICovXG5cdHJlZ2lzdGVyQ29uZmlndXJhdGlvbihjb25maWd1cmF0aW9uOiBJQ29uZmlndXJhdGlvbk5vZGUpOiBJQ29uZmlndXJhdGlvbk5vZGU7XG5cblx0LyoqXG5cdCAqIFJlZ2lzdGVyIG11bHRpcGxlIGNvbmZpZ3VyYXRpb25zIHRvIHRoZSByZWdpc3RyeS5cblx0ICovXG5cdHJlZ2lzdGVyQ29uZmlndXJhdGlvbnMoY29uZmlndXJhdGlvbnM6IElDb25maWd1cmF0aW9uTm9kZVtdLCB2YWxpZGF0ZT86IGJvb2xlYW4pOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBEZXJlZ2lzdGVyIG11bHRpcGxlIGNvbmZpZ3VyYXRpb25zIGZyb20gdGhlIHJlZ2lzdHJ5LlxuXHQgKi9cblx0ZGVyZWdpc3RlckNvbmZpZ3VyYXRpb25zKGNvbmZpZ3VyYXRpb25zOiBJQ29uZmlndXJhdGlvbk5vZGVbXSk6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIHVwZGF0ZSB0aGUgY29uZmlndXJhdGlvbiByZWdpc3RyeSBieVxuXHQgKiBcdC0gcmVnaXN0ZXJpbmcgdGhlIGNvbmZpZ3VyYXRpb25zIHRvIGFkZFxuXHQgKiBcdC0gZGVyZWlnc3RlcmluZyB0aGUgY29uZmlndXJhdGlvbnMgdG8gcmVtb3ZlXG5cdCAqL1xuXHR1cGRhdGVDb25maWd1cmF0aW9ucyhjb25maWd1cmF0aW9uczogeyBhZGQ6IElDb25maWd1cmF0aW9uTm9kZVtdOyByZW1vdmU6IElDb25maWd1cmF0aW9uTm9kZVtdIH0pOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBSZWdpc3RlciBtdWx0aXBsZSBkZWZhdWx0IGNvbmZpZ3VyYXRpb25zIHRvIHRoZSByZWdpc3RyeS5cblx0ICovXG5cdHJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKGRlZmF1bHRDb25maWd1cmF0aW9uczogSUNvbmZpZ3VyYXRpb25EZWZhdWx0c1tdKTogdm9pZDtcblxuXHQvKipcblx0ICogRGVyZWdpc3RlciBtdWx0aXBsZSBkZWZhdWx0IGNvbmZpZ3VyYXRpb25zIGZyb20gdGhlIHJlZ2lzdHJ5LlxuXHQgKi9cblx0ZGVyZWdpc3RlckRlZmF1bHRDb25maWd1cmF0aW9ucyhkZWZhdWx0Q29uZmlndXJhdGlvbnM6IElDb25maWd1cmF0aW9uRGVmYXVsdHNbXSk6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIEJ1bGsgdXBkYXRlIG9mIHRoZSBjb25maWd1cmF0aW9uIHJlZ2lzdHJ5IChkZWZhdWx0IGFuZCBjb25maWd1cmF0aW9ucywgcmVtb3ZlIGFuZCBhZGQpXG5cdCAqIEBwYXJhbSBkZWx0YVxuXHQgKi9cblx0ZGVsdGFDb25maWd1cmF0aW9uKGRlbHRhOiBJQ29uZmlndXJhdGlvbkRlbHRhKTogdm9pZDtcblxuXHQvKipcblx0ICogUmV0dXJuIHRoZSByZWdpc3RlcmVkIGRlZmF1bHQgY29uZmlndXJhdGlvbnNcblx0ICovXG5cdGdldFJlZ2lzdGVyZWREZWZhdWx0Q29uZmlndXJhdGlvbnMoKTogSUNvbmZpZ3VyYXRpb25EZWZhdWx0c1tdO1xuXG5cdC8qKlxuXHQgKiBSZXR1cm4gdGhlIHJlZ2lzdGVyZWQgY29uZmlndXJhdGlvbiBkZWZhdWx0cyBvdmVycmlkZXNcblx0ICovXG5cdGdldENvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlcygpOiBNYXA8c3RyaW5nLCBJQ29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZVZhbHVlPjtcblxuXHQvKipcblx0ICogU2lnbmFsIHRoYXQgdGhlIHNjaGVtYSBvZiBhIGNvbmZpZ3VyYXRpb24gc2V0dGluZyBoYXMgY2hhbmdlcy4gSXQgaXMgY3VycmVudGx5IG9ubHkgc3VwcG9ydGVkIHRvIGNoYW5nZSBlbnVtZXJhdGlvbiB2YWx1ZXMuXG5cdCAqIFByb3BlcnR5IG9yIGRlZmF1bHQgdmFsdWUgY2hhbmdlcyBhcmUgbm90IGFsbG93ZWQuXG5cdCAqL1xuXHRub3RpZnlDb25maWd1cmF0aW9uU2NoZW1hVXBkYXRlZCguLi5jb25maWd1cmF0aW9uczogSUNvbmZpZ3VyYXRpb25Ob2RlW10pOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBFdmVudCB0aGF0IGZpcmVzIHdoZW5ldmVyIGEgY29uZmlndXJhdGlvbiBoYXMgYmVlblxuXHQgKiByZWdpc3RlcmVkLlxuXHQgKi9cblx0cmVhZG9ubHkgb25EaWRTY2hlbWFDaGFuZ2U6IEV2ZW50PHZvaWQ+O1xuXG5cdC8qKlxuXHQgKiBFdmVudCB0aGF0IGZpcmVzIHdoZW5ldmVyIGEgY29uZmlndXJhdGlvbiBoYXMgYmVlblxuXHQgKiByZWdpc3RlcmVkLlxuXHQgKi9cblx0cmVhZG9ubHkgb25EaWRVcGRhdGVDb25maWd1cmF0aW9uOiBFdmVudDx7IHByb3BlcnRpZXM6IFJlYWRvbmx5U2V0PHN0cmluZz47IGRlZmF1bHRzT3ZlcnJpZGVzPzogYm9vbGVhbiB9PjtcblxuXHQvKipcblx0ICogUmV0dXJucyBhbGwgY29uZmlndXJhdGlvbiBub2RlcyBjb250cmlidXRlZCB0byB0aGlzIHJlZ2lzdHJ5LlxuXHQgKi9cblx0Z2V0Q29uZmlndXJhdGlvbnMoKTogSUNvbmZpZ3VyYXRpb25Ob2RlW107XG5cblx0LyoqXG5cdCAqIFJldHVybnMgYWxsIGNvbmZpZ3VyYXRpb25zIHNldHRpbmdzIG9mIGFsbCBjb25maWd1cmF0aW9uIG5vZGVzIGNvbnRyaWJ1dGVkIHRvIHRoaXMgcmVnaXN0cnkuXG5cdCAqL1xuXHRnZXRDb25maWd1cmF0aW9uUHJvcGVydGllcygpOiBJU3RyaW5nRGljdGlvbmFyeTxJUmVnaXN0ZXJlZENvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYT47XG5cblx0LyoqXG5cdCAqIFJldHVybiBhbGwgY29uZmlndXJhdGlvbnMgYnkgcG9saWN5IG5hbWVcblx0ICovXG5cdGdldFBvbGljeUNvbmZpZ3VyYXRpb25zKCk6IE1hcDxQb2xpY3lOYW1lLCBzdHJpbmc+O1xuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGFsbCBleGNsdWRlZCBjb25maWd1cmF0aW9ucyBzZXR0aW5ncyBvZiBhbGwgY29uZmlndXJhdGlvbiBub2RlcyBjb250cmlidXRlZCB0byB0aGlzIHJlZ2lzdHJ5LlxuXHQgKi9cblx0Z2V0RXhjbHVkZWRDb25maWd1cmF0aW9uUHJvcGVydGllcygpOiBJU3RyaW5nRGljdGlvbmFyeTxJUmVnaXN0ZXJlZENvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYT47XG5cblx0LyoqXG5cdCAqIFJlZ2lzdGVyIHRoZSBpZGVudGlmaWVycyBmb3IgZWRpdG9yIGNvbmZpZ3VyYXRpb25zXG5cdCAqL1xuXHRyZWdpc3Rlck92ZXJyaWRlSWRlbnRpZmllcnMoaWRlbnRpZmllcnM6IHN0cmluZ1tdKTogdm9pZDtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gQ29uZmlndXJhdGlvblNjb3BlIHtcblx0LyoqXG5cdCAqIEFwcGxpY2F0aW9uIHNwZWNpZmljIGNvbmZpZ3VyYXRpb24sIHdoaWNoIGNhbiBiZSBjb25maWd1cmVkIG9ubHkgaW4gZGVmYXVsdCBwcm9maWxlIHVzZXIgc2V0dGluZ3MuXG5cdCAqL1xuXHRBUFBMSUNBVElPTiA9IDEsXG5cdC8qKlxuXHQgKiBNYWNoaW5lIHNwZWNpZmljIGNvbmZpZ3VyYXRpb24sIHdoaWNoIGNhbiBiZSBjb25maWd1cmVkIG9ubHkgaW4gbG9jYWwgYW5kIHJlbW90ZSB1c2VyIHNldHRpbmdzLlxuXHQgKi9cblx0TUFDSElORSxcblx0LyoqXG5cdCAqIEFuIGFwcGxpY2F0aW9uIG1hY2hpbmUgc3BlY2lmaWMgY29uZmlndXJhdGlvbiwgd2hpY2ggY2FuIGJlIGNvbmZpZ3VyZWQgb25seSBpbiBkZWZhdWx0IHByb2ZpbGUgdXNlciBzZXR0aW5ncyBhbmQgcmVtb3RlIHVzZXIgc2V0dGluZ3MuXG5cdCAqL1xuXHRBUFBMSUNBVElPTl9NQUNISU5FLFxuXHQvKipcblx0ICogV2luZG93IHNwZWNpZmljIGNvbmZpZ3VyYXRpb24sIHdoaWNoIGNhbiBiZSBjb25maWd1cmVkIGluIHRoZSB1c2VyIG9yIHdvcmtzcGFjZSBzZXR0aW5ncy5cblx0ICovXG5cdFdJTkRPVyxcblx0LyoqXG5cdCAqIFJlc291cmNlIHNwZWNpZmljIGNvbmZpZ3VyYXRpb24sIHdoaWNoIGNhbiBiZSBjb25maWd1cmVkIGluIHRoZSB1c2VyLCB3b3Jrc3BhY2Ugb3IgZm9sZGVyIHNldHRpbmdzLlxuXHQgKi9cblx0UkVTT1VSQ0UsXG5cdC8qKlxuXHQgKiBSZXNvdXJjZSBzcGVjaWZpYyBjb25maWd1cmF0aW9uIHRoYXQgY2FuIGJlIGNvbmZpZ3VyZWQgaW4gbGFuZ3VhZ2Ugc3BlY2lmaWMgc2V0dGluZ3Ncblx0ICovXG5cdExBTkdVQUdFX09WRVJSSURBQkxFLFxuXHQvKipcblx0ICogTWFjaGluZSBzcGVjaWZpYyBjb25maWd1cmF0aW9uIHRoYXQgY2FuIGFsc28gYmUgY29uZmlndXJlZCBpbiB3b3Jrc3BhY2Ugb3IgZm9sZGVyIHNldHRpbmdzLlxuXHQgKi9cblx0TUFDSElORV9PVkVSUklEQUJMRSxcbn1cblxuXG5leHBvcnQgaW50ZXJmYWNlIElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgZXh0ZW5kcyBJSlNPTlNjaGVtYSB7XG5cblx0c2NvcGU/OiBDb25maWd1cmF0aW9uU2NvcGU7XG5cblx0LyoqXG5cdCAqIFdoZW4gcmVzdHJpY3RlZCwgdmFsdWUgb2YgdGhpcyBjb25maWd1cmF0aW9uIHdpbGwgYmUgcmVhZCBvbmx5IGZyb20gdHJ1c3RlZCBzb3VyY2VzLlxuXHQgKiBGb3IgZWcuLCBJZiB0aGUgd29ya3NwYWNlIGlzIG5vdCB0cnVzdGVkLCB0aGVuIHRoZSB2YWx1ZSBvZiB0aGlzIGNvbmZpZ3VyYXRpb24gaXMgbm90IHJlYWQgZnJvbSB3b3Jrc3BhY2Ugc2V0dGluZ3MgZmlsZS5cblx0ICovXG5cdHJlc3RyaWN0ZWQ/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBXaGVuIGBmYWxzZWAgdGhpcyBwcm9wZXJ0eSBpcyBleGNsdWRlZCBmcm9tIHRoZSByZWdpc3RyeS4gRGVmYXVsdCBpcyB0byBpbmNsdWRlLlxuXHQgKi9cblx0aW5jbHVkZWQ/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBMaXN0IG9mIHRhZ3MgYXNzb2NpYXRlZCB0byB0aGUgcHJvcGVydHkuXG5cdCAqICAtIEEgdGFnIGNhbiBiZSB1c2VkIGZvciBmaWx0ZXJpbmdcblx0ICogIC0gVXNlIGBleHBlcmltZW50YWxgIHRhZyBmb3IgbWFya2luZyB0aGUgc2V0dGluZyBhcyBleHBlcmltZW50YWwuXG5cdCAqICAtIFVzZSBgb25FeFBgIHRhZyBmb3IgbWFya2luZyB0aGF0IHRoZSBkZWZhdWx0IG9mIHRoZSBzZXR0aW5nIGNhbiBiZSBjaGFuZ2VkIGJ5IHJ1bm5pbmcgZXhwZXJpbWVudHMuXG5cdCAqL1xuXHR0YWdzPzogc3RyaW5nW107XG5cblx0LyoqXG5cdCAqIFdoZW4gZW5hYmxlZCB0aGlzIHNldHRpbmcgaXMgaWdub3JlZCBkdXJpbmcgc3luYyBhbmQgdXNlciBjYW4gb3ZlcnJpZGUgdGhpcy5cblx0ICovXG5cdGlnbm9yZVN5bmM/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBXaGVuIGVuYWJsZWQgdGhpcyBzZXR0aW5nIGlzIGlnbm9yZWQgZHVyaW5nIHN5bmMgYW5kIHVzZXIgY2Fubm90IG92ZXJyaWRlIHRoaXMuXG5cdCAqL1xuXHRkaXNhbGxvd1N5bmNJZ25vcmU/OiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBEaXNhbGxvdyBleHRlbnNpb25zIHRvIGNvbnRyaWJ1dGUgY29uZmlndXJhdGlvbiBkZWZhdWx0IHZhbHVlIGZvciB0aGlzIHNldHRpbmcuXG5cdCAqL1xuXHRkaXNhbGxvd0NvbmZpZ3VyYXRpb25EZWZhdWx0PzogYm9vbGVhbjtcblxuXHQvKipcblx0ICogTGFiZWxzIGZvciBlbnVtZXJhdGlvbiBpdGVtc1xuXHQgKi9cblx0ZW51bUl0ZW1MYWJlbHM/OiBzdHJpbmdbXTtcblxuXHQvKipcblx0ICogV2hlbiBzcGVjaWZpZWQsIGNvbnRyb2xzIHRoZSBwcmVzZW50YXRpb24gZm9ybWF0IG9mIHN0cmluZyBzZXR0aW5ncy5cblx0ICogT3RoZXJ3aXNlLCB0aGUgcHJlc2VudGF0aW9uIGZvcm1hdCBkZWZhdWx0cyB0byBgc2luZ2xlbGluZWAuXG5cdCAqL1xuXHRlZGl0UHJlc2VudGF0aW9uPzogRWRpdFByZXNlbnRhdGlvblR5cGVzO1xuXG5cdC8qKlxuXHQgKiBXaGVuIHNwZWNpZmllZCwgZ2l2ZXMgYW4gb3JkZXIgbnVtYmVyIGZvciB0aGUgc2V0dGluZ1xuXHQgKiB3aXRoaW4gdGhlIHNldHRpbmdzIGVkaXRvci4gT3RoZXJ3aXNlLCB0aGUgc2V0dGluZyBpcyBwbGFjZWQgYXQgdGhlIGVuZC5cblx0ICovXG5cdG9yZGVyPzogbnVtYmVyO1xuXG5cdC8qKlxuXHQgKiBXaGVuIHNwZWNpZmllZCwgdGhpcyBzZXR0aW5nJ3MgdmFsdWUgY2FuIGFsd2F5cyBiZSBvdmVyd3JpdHRlbiBieVxuXHQgKiBhIHN5c3RlbS13aWRlIHBvbGljeS5cblx0ICovXG5cdHBvbGljeT86IElQb2xpY3k7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUV4dGVuc2lvbkluZm8ge1xuXHRpZDogc3RyaW5nO1xuXHRkaXNwbGF5TmFtZT86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ29uZmlndXJhdGlvbk5vZGUge1xuXHRpZD86IHN0cmluZztcblx0b3JkZXI/OiBudW1iZXI7XG5cdHR5cGU/OiBzdHJpbmcgfCBzdHJpbmdbXTtcblx0dGl0bGU/OiBzdHJpbmc7XG5cdGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuXHRwcm9wZXJ0aWVzPzogSVN0cmluZ0RpY3Rpb25hcnk8SUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYT47XG5cdGFsbE9mPzogSUNvbmZpZ3VyYXRpb25Ob2RlW107XG5cdHNjb3BlPzogQ29uZmlndXJhdGlvblNjb3BlO1xuXHRleHRlbnNpb25JbmZvPzogSUV4dGVuc2lvbkluZm87XG5cdHJlc3RyaWN0ZWRQcm9wZXJ0aWVzPzogc3RyaW5nW107XG59XG5cbmV4cG9ydCB0eXBlIENvbmZpZ3VyYXRpb25EZWZhdWx0VmFsdWVTb3VyY2UgPSBJRXh0ZW5zaW9uSW5mbyB8IE1hcDxzdHJpbmcsIElFeHRlbnNpb25JbmZvPjtcblxuZXhwb3J0IGludGVyZmFjZSBJQ29uZmlndXJhdGlvbkRlZmF1bHRzIHtcblx0b3ZlcnJpZGVzOiBJU3RyaW5nRGljdGlvbmFyeTxhbnk+O1xuXHRzb3VyY2U/OiBJRXh0ZW5zaW9uSW5mbztcbn1cblxuZXhwb3J0IHR5cGUgSVJlZ2lzdGVyZWRDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgPSBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hICYge1xuXHRkZWZhdWx0RGVmYXVsdFZhbHVlPzogYW55O1xuXHRzb3VyY2U/OiBJRXh0ZW5zaW9uSW5mbzsgLy8gU291cmNlIG9mIHRoZSBQcm9wZXJ0eVxuXHRkZWZhdWx0VmFsdWVTb3VyY2U/OiBDb25maWd1cmF0aW9uRGVmYXVsdFZhbHVlU291cmNlOyAvLyBTb3VyY2Ugb2YgdGhlIERlZmF1bHQgVmFsdWVcbn07XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGUge1xuXHRyZWFkb25seSB2YWx1ZTogYW55O1xuXHRyZWFkb25seSBzb3VyY2U/OiBJRXh0ZW5zaW9uSW5mbzsgIC8vIFNvdXJjZSBvZiB0aGUgZGVmYXVsdCBvdmVycmlkZVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb25maWd1cmF0aW9uRGVmYXVsdE92ZXJyaWRlVmFsdWUge1xuXHRyZWFkb25seSB2YWx1ZTogYW55O1xuXHRyZWFkb25seSBzb3VyY2U/OiBDb25maWd1cmF0aW9uRGVmYXVsdFZhbHVlU291cmNlO1xufVxuXG5leHBvcnQgY29uc3QgYWxsU2V0dGluZ3M6IHsgcHJvcGVydGllczogSVN0cmluZ0RpY3Rpb25hcnk8SUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYT47IHBhdHRlcm5Qcm9wZXJ0aWVzOiBJU3RyaW5nRGljdGlvbmFyeTxJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hPiB9ID0geyBwcm9wZXJ0aWVzOiB7fSwgcGF0dGVyblByb3BlcnRpZXM6IHt9IH07XG5leHBvcnQgY29uc3QgYXBwbGljYXRpb25TZXR0aW5nczogeyBwcm9wZXJ0aWVzOiBJU3RyaW5nRGljdGlvbmFyeTxJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hPjsgcGF0dGVyblByb3BlcnRpZXM6IElTdHJpbmdEaWN0aW9uYXJ5PElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWE+IH0gPSB7IHByb3BlcnRpZXM6IHt9LCBwYXR0ZXJuUHJvcGVydGllczoge30gfTtcbmV4cG9ydCBjb25zdCBhcHBsaWNhdGlvbk1hY2hpbmVTZXR0aW5nczogeyBwcm9wZXJ0aWVzOiBJU3RyaW5nRGljdGlvbmFyeTxJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hPjsgcGF0dGVyblByb3BlcnRpZXM6IElTdHJpbmdEaWN0aW9uYXJ5PElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWE+IH0gPSB7IHByb3BlcnRpZXM6IHt9LCBwYXR0ZXJuUHJvcGVydGllczoge30gfTtcbmV4cG9ydCBjb25zdCBtYWNoaW5lU2V0dGluZ3M6IHsgcHJvcGVydGllczogSVN0cmluZ0RpY3Rpb25hcnk8SUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYT47IHBhdHRlcm5Qcm9wZXJ0aWVzOiBJU3RyaW5nRGljdGlvbmFyeTxJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hPiB9ID0geyBwcm9wZXJ0aWVzOiB7fSwgcGF0dGVyblByb3BlcnRpZXM6IHt9IH07XG5leHBvcnQgY29uc3QgbWFjaGluZU92ZXJyaWRhYmxlU2V0dGluZ3M6IHsgcHJvcGVydGllczogSVN0cmluZ0RpY3Rpb25hcnk8SUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYT47IHBhdHRlcm5Qcm9wZXJ0aWVzOiBJU3RyaW5nRGljdGlvbmFyeTxJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hPiB9ID0geyBwcm9wZXJ0aWVzOiB7fSwgcGF0dGVyblByb3BlcnRpZXM6IHt9IH07XG5leHBvcnQgY29uc3Qgd2luZG93U2V0dGluZ3M6IHsgcHJvcGVydGllczogSVN0cmluZ0RpY3Rpb25hcnk8SUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYT47IHBhdHRlcm5Qcm9wZXJ0aWVzOiBJU3RyaW5nRGljdGlvbmFyeTxJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hPiB9ID0geyBwcm9wZXJ0aWVzOiB7fSwgcGF0dGVyblByb3BlcnRpZXM6IHt9IH07XG5leHBvcnQgY29uc3QgcmVzb3VyY2VTZXR0aW5nczogeyBwcm9wZXJ0aWVzOiBJU3RyaW5nRGljdGlvbmFyeTxJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hPjsgcGF0dGVyblByb3BlcnRpZXM6IElTdHJpbmdEaWN0aW9uYXJ5PElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWE+IH0gPSB7IHByb3BlcnRpZXM6IHt9LCBwYXR0ZXJuUHJvcGVydGllczoge30gfTtcblxuZXhwb3J0IGNvbnN0IHJlc291cmNlTGFuZ3VhZ2VTZXR0aW5nc1NjaGVtYUlkID0gJ3ZzY29kZTovL3NjaGVtYXMvc2V0dGluZ3MvcmVzb3VyY2VMYW5ndWFnZSc7XG5leHBvcnQgY29uc3QgY29uZmlndXJhdGlvbkRlZmF1bHRzU2NoZW1hSWQgPSAndnNjb2RlOi8vc2NoZW1hcy9zZXR0aW5ncy9jb25maWd1cmF0aW9uRGVmYXVsdHMnO1xuXG5jb25zdCBjb250cmlidXRpb25SZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElKU09OQ29udHJpYnV0aW9uUmVnaXN0cnk+KEpTT05FeHRlbnNpb25zLkpTT05Db250cmlidXRpb24pO1xuXG5jbGFzcyBDb25maWd1cmF0aW9uUmVnaXN0cnkgaW1wbGVtZW50cyBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHJlZ2lzdGVyZWRDb25maWd1cmF0aW9uRGVmYXVsdHM6IElDb25maWd1cmF0aW9uRGVmYXVsdHNbXSA9IFtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlczogTWFwPHN0cmluZywgeyBjb25maWd1cmF0aW9uRGVmYXVsdE92ZXJyaWRlczogSUNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGVbXTsgY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZVZhbHVlPzogSUNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGVWYWx1ZSB9Pjtcblx0cHJpdmF0ZSByZWFkb25seSBkZWZhdWx0TGFuZ3VhZ2VDb25maWd1cmF0aW9uT3ZlcnJpZGVzTm9kZTogSUNvbmZpZ3VyYXRpb25Ob2RlO1xuXHRwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25Db250cmlidXRvcnM6IElDb25maWd1cmF0aW9uTm9kZVtdO1xuXHRwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzOiBJU3RyaW5nRGljdGlvbmFyeTxJUmVnaXN0ZXJlZENvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYT47XG5cdHByaXZhdGUgcmVhZG9ubHkgcG9saWN5Q29uZmlndXJhdGlvbnM6IE1hcDxQb2xpY3lOYW1lLCBzdHJpbmc+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGV4Y2x1ZGVkQ29uZmlndXJhdGlvblByb3BlcnRpZXM6IElTdHJpbmdEaWN0aW9uYXJ5PElSZWdpc3RlcmVkQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hPjtcblx0cHJpdmF0ZSByZWFkb25seSByZXNvdXJjZUxhbmd1YWdlU2V0dGluZ3NTY2hlbWE6IElKU09OU2NoZW1hO1xuXHRwcml2YXRlIHJlYWRvbmx5IG92ZXJyaWRlSWRlbnRpZmllcnMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFNjaGVtYUNoYW5nZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkU2NoZW1hQ2hhbmdlOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkU2NoZW1hQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkVXBkYXRlQ29uZmlndXJhdGlvbiA9IG5ldyBFbWl0dGVyPHsgcHJvcGVydGllczogUmVhZG9ubHlTZXQ8c3RyaW5nPjsgZGVmYXVsdHNPdmVycmlkZXM/OiBib29sZWFuIH0+KCk7XG5cdHJlYWRvbmx5IG9uRGlkVXBkYXRlQ29uZmlndXJhdGlvbiA9IHRoaXMuX29uRGlkVXBkYXRlQ29uZmlndXJhdGlvbi5ldmVudDtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHR0aGlzLmNvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlcyA9IG5ldyBNYXAoKTtcblx0XHR0aGlzLmRlZmF1bHRMYW5ndWFnZUNvbmZpZ3VyYXRpb25PdmVycmlkZXNOb2RlID0ge1xuXHRcdFx0aWQ6ICdkZWZhdWx0T3ZlcnJpZGVzJyxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ2RlZmF1bHRMYW5ndWFnZUNvbmZpZ3VyYXRpb25PdmVycmlkZXMudGl0bGUnLCBcIkRlZmF1bHQgTGFuZ3VhZ2UgQ29uZmlndXJhdGlvbiBPdmVycmlkZXNcIiksXG5cdFx0XHRwcm9wZXJ0aWVzOiB7fVxuXHRcdH07XG5cdFx0dGhpcy5jb25maWd1cmF0aW9uQ29udHJpYnV0b3JzID0gW3RoaXMuZGVmYXVsdExhbmd1YWdlQ29uZmlndXJhdGlvbk92ZXJyaWRlc05vZGVdO1xuXHRcdHRoaXMucmVzb3VyY2VMYW5ndWFnZVNldHRpbmdzU2NoZW1hID0ge1xuXHRcdFx0cHJvcGVydGllczoge30sXG5cdFx0XHRwYXR0ZXJuUHJvcGVydGllczoge30sXG5cdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogdHJ1ZSxcblx0XHRcdGFsbG93VHJhaWxpbmdDb21tYXM6IHRydWUsXG5cdFx0XHRhbGxvd0NvbW1lbnRzOiB0cnVlXG5cdFx0fTtcblx0XHR0aGlzLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzID0ge307XG5cdFx0dGhpcy5wb2xpY3lDb25maWd1cmF0aW9ucyA9IG5ldyBNYXA8UG9saWN5TmFtZSwgc3RyaW5nPigpO1xuXHRcdHRoaXMuZXhjbHVkZWRDb25maWd1cmF0aW9uUHJvcGVydGllcyA9IHt9O1xuXG5cdFx0Y29udHJpYnV0aW9uUmVnaXN0cnkucmVnaXN0ZXJTY2hlbWEocmVzb3VyY2VMYW5ndWFnZVNldHRpbmdzU2NoZW1hSWQsIHRoaXMucmVzb3VyY2VMYW5ndWFnZVNldHRpbmdzU2NoZW1hKTtcblx0XHR0aGlzLnJlZ2lzdGVyT3ZlcnJpZGVQcm9wZXJ0eVBhdHRlcm5LZXkoKTtcblx0fVxuXG5cdHB1YmxpYyByZWdpc3RlckNvbmZpZ3VyYXRpb24oY29uZmlndXJhdGlvbjogSUNvbmZpZ3VyYXRpb25Ob2RlLCB2YWxpZGF0ZTogYm9vbGVhbiA9IHRydWUpOiBJQ29uZmlndXJhdGlvbk5vZGUge1xuXHRcdHRoaXMucmVnaXN0ZXJDb25maWd1cmF0aW9ucyhbY29uZmlndXJhdGlvbl0sIHZhbGlkYXRlKTtcblx0XHRyZXR1cm4gY29uZmlndXJhdGlvbjtcblx0fVxuXG5cdHB1YmxpYyByZWdpc3RlckNvbmZpZ3VyYXRpb25zKGNvbmZpZ3VyYXRpb25zOiBJQ29uZmlndXJhdGlvbk5vZGVbXSwgdmFsaWRhdGU6IGJvb2xlYW4gPSB0cnVlKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJvcGVydGllcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdHRoaXMuZG9SZWdpc3RlckNvbmZpZ3VyYXRpb25zKGNvbmZpZ3VyYXRpb25zLCB2YWxpZGF0ZSwgcHJvcGVydGllcyk7XG5cblx0XHRjb250cmlidXRpb25SZWdpc3RyeS5yZWdpc3RlclNjaGVtYShyZXNvdXJjZUxhbmd1YWdlU2V0dGluZ3NTY2hlbWFJZCwgdGhpcy5yZXNvdXJjZUxhbmd1YWdlU2V0dGluZ3NTY2hlbWEpO1xuXHRcdHRoaXMuX29uRGlkU2NoZW1hQ2hhbmdlLmZpcmUoKTtcblx0XHR0aGlzLl9vbkRpZFVwZGF0ZUNvbmZpZ3VyYXRpb24uZmlyZSh7IHByb3BlcnRpZXMgfSk7XG5cdH1cblxuXHRwdWJsaWMgZGVyZWdpc3RlckNvbmZpZ3VyYXRpb25zKGNvbmZpZ3VyYXRpb25zOiBJQ29uZmlndXJhdGlvbk5vZGVbXSk6IHZvaWQge1xuXHRcdGNvbnN0IHByb3BlcnRpZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHR0aGlzLmRvRGVyZWdpc3RlckNvbmZpZ3VyYXRpb25zKGNvbmZpZ3VyYXRpb25zLCBwcm9wZXJ0aWVzKTtcblxuXHRcdGNvbnRyaWJ1dGlvblJlZ2lzdHJ5LnJlZ2lzdGVyU2NoZW1hKHJlc291cmNlTGFuZ3VhZ2VTZXR0aW5nc1NjaGVtYUlkLCB0aGlzLnJlc291cmNlTGFuZ3VhZ2VTZXR0aW5nc1NjaGVtYSk7XG5cdFx0dGhpcy5fb25EaWRTY2hlbWFDaGFuZ2UuZmlyZSgpO1xuXHRcdHRoaXMuX29uRGlkVXBkYXRlQ29uZmlndXJhdGlvbi5maXJlKHsgcHJvcGVydGllcyB9KTtcblx0fVxuXG5cdHB1YmxpYyB1cGRhdGVDb25maWd1cmF0aW9ucyh7IGFkZCwgcmVtb3ZlIH06IHsgYWRkOiBJQ29uZmlndXJhdGlvbk5vZGVbXTsgcmVtb3ZlOiBJQ29uZmlndXJhdGlvbk5vZGVbXSB9KTogdm9pZCB7XG5cdFx0Y29uc3QgcHJvcGVydGllcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdHRoaXMuZG9EZXJlZ2lzdGVyQ29uZmlndXJhdGlvbnMocmVtb3ZlLCBwcm9wZXJ0aWVzKTtcblx0XHR0aGlzLmRvUmVnaXN0ZXJDb25maWd1cmF0aW9ucyhhZGQsIGZhbHNlLCBwcm9wZXJ0aWVzKTtcblxuXHRcdGNvbnRyaWJ1dGlvblJlZ2lzdHJ5LnJlZ2lzdGVyU2NoZW1hKHJlc291cmNlTGFuZ3VhZ2VTZXR0aW5nc1NjaGVtYUlkLCB0aGlzLnJlc291cmNlTGFuZ3VhZ2VTZXR0aW5nc1NjaGVtYSk7XG5cdFx0dGhpcy5fb25EaWRTY2hlbWFDaGFuZ2UuZmlyZSgpO1xuXHRcdHRoaXMuX29uRGlkVXBkYXRlQ29uZmlndXJhdGlvbi5maXJlKHsgcHJvcGVydGllcyB9KTtcblx0fVxuXG5cdHB1YmxpYyByZWdpc3RlckRlZmF1bHRDb25maWd1cmF0aW9ucyhjb25maWd1cmF0aW9uRGVmYXVsdHM6IElDb25maWd1cmF0aW9uRGVmYXVsdHNbXSk6IHZvaWQge1xuXHRcdGNvbnN0IHByb3BlcnRpZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHR0aGlzLmRvUmVnaXN0ZXJEZWZhdWx0Q29uZmlndXJhdGlvbnMoY29uZmlndXJhdGlvbkRlZmF1bHRzLCBwcm9wZXJ0aWVzKTtcblx0XHR0aGlzLl9vbkRpZFNjaGVtYUNoYW5nZS5maXJlKCk7XG5cdFx0dGhpcy5fb25EaWRVcGRhdGVDb25maWd1cmF0aW9uLmZpcmUoeyBwcm9wZXJ0aWVzLCBkZWZhdWx0c092ZXJyaWRlczogdHJ1ZSB9KTtcblx0fVxuXG5cdHByaXZhdGUgZG9SZWdpc3RlckRlZmF1bHRDb25maWd1cmF0aW9ucyhjb25maWd1cmF0aW9uRGVmYXVsdHM6IElDb25maWd1cmF0aW9uRGVmYXVsdHNbXSwgYnVja2V0OiBTZXQ8c3RyaW5nPikge1xuXG5cdFx0dGhpcy5yZWdpc3RlcmVkQ29uZmlndXJhdGlvbkRlZmF1bHRzLnB1c2goLi4uY29uZmlndXJhdGlvbkRlZmF1bHRzKTtcblxuXHRcdGNvbnN0IG92ZXJyaWRlSWRlbnRpZmllcnM6IHN0cmluZ1tdID0gW107XG5cblx0XHRmb3IgKGNvbnN0IHsgb3ZlcnJpZGVzLCBzb3VyY2UgfSBvZiBjb25maWd1cmF0aW9uRGVmYXVsdHMpIHtcblx0XHRcdGZvciAoY29uc3Qga2V5IGluIG92ZXJyaWRlcykge1xuXHRcdFx0XHRidWNrZXQuYWRkKGtleSk7XG5cblx0XHRcdFx0Y29uc3QgY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZXNGb3JLZXkgPSB0aGlzLmNvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlcy5nZXQoa2V5KVxuXHRcdFx0XHRcdD8/IHRoaXMuY29uZmlndXJhdGlvbkRlZmF1bHRzT3ZlcnJpZGVzLnNldChrZXksIHsgY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZXM6IFtdIH0pLmdldChrZXkpITtcblxuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IG92ZXJyaWRlc1trZXldO1xuXHRcdFx0XHRjb25maWd1cmF0aW9uRGVmYXVsdE92ZXJyaWRlc0ZvcktleS5jb25maWd1cmF0aW9uRGVmYXVsdE92ZXJyaWRlcy5wdXNoKHsgdmFsdWUsIHNvdXJjZSB9KTtcblxuXHRcdFx0XHQvLyBDb25maWd1cmF0aW9uIGRlZmF1bHRzIGZvciBPdmVycmlkZSBJZGVudGlmaWVyc1xuXHRcdFx0XHRpZiAoT1ZFUlJJREVfUFJPUEVSVFlfUkVHRVgudGVzdChrZXkpKSB7XG5cdFx0XHRcdFx0Y29uc3QgbmV3RGVmYXVsdE92ZXJyaWRlID0gdGhpcy5tZXJnZURlZmF1bHRDb25maWd1cmF0aW9uc0Zvck92ZXJyaWRlSWRlbnRpZmllcihrZXksIHZhbHVlLCBzb3VyY2UsIGNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGVzRm9yS2V5LmNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGVWYWx1ZSk7XG5cdFx0XHRcdFx0aWYgKCFuZXdEZWZhdWx0T3ZlcnJpZGUpIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGVzRm9yS2V5LmNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGVWYWx1ZSA9IG5ld0RlZmF1bHRPdmVycmlkZTtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZURlZmF1bHRPdmVycmlkZVByb3BlcnR5KGtleSwgbmV3RGVmYXVsdE92ZXJyaWRlLCBzb3VyY2UpO1xuXHRcdFx0XHRcdG92ZXJyaWRlSWRlbnRpZmllcnMucHVzaCguLi5vdmVycmlkZUlkZW50aWZpZXJzRnJvbUtleShrZXkpKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIENvbmZpZ3VyYXRpb24gZGVmYXVsdHMgZm9yIENvbmZpZ3VyYXRpb24gUHJvcGVydGllc1xuXHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBuZXdEZWZhdWx0T3ZlcnJpZGUgPSB0aGlzLm1lcmdlRGVmYXVsdENvbmZpZ3VyYXRpb25zRm9yQ29uZmlndXJhdGlvblByb3BlcnR5KGtleSwgdmFsdWUsIHNvdXJjZSwgY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZXNGb3JLZXkuY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZVZhbHVlKTtcblx0XHRcdFx0XHRpZiAoIW5ld0RlZmF1bHRPdmVycmlkZSkge1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZXNGb3JLZXkuY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZVZhbHVlID0gbmV3RGVmYXVsdE92ZXJyaWRlO1xuXHRcdFx0XHRcdGNvbnN0IHByb3BlcnR5ID0gdGhpcy5jb25maWd1cmF0aW9uUHJvcGVydGllc1trZXldO1xuXHRcdFx0XHRcdGlmIChwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdFx0dGhpcy51cGRhdGVQcm9wZXJ0eURlZmF1bHRWYWx1ZShrZXksIHByb3BlcnR5KTtcblx0XHRcdFx0XHRcdHRoaXMudXBkYXRlU2NoZW1hKGtleSwgcHJvcGVydHkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5kb1JlZ2lzdGVyT3ZlcnJpZGVJZGVudGlmaWVycyhvdmVycmlkZUlkZW50aWZpZXJzKTtcblx0fVxuXG5cdHB1YmxpYyBkZXJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKGRlZmF1bHRDb25maWd1cmF0aW9uczogSUNvbmZpZ3VyYXRpb25EZWZhdWx0c1tdKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJvcGVydGllcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdHRoaXMuZG9EZXJlZ2lzdGVyRGVmYXVsdENvbmZpZ3VyYXRpb25zKGRlZmF1bHRDb25maWd1cmF0aW9ucywgcHJvcGVydGllcyk7XG5cdFx0dGhpcy5fb25EaWRTY2hlbWFDaGFuZ2UuZmlyZSgpO1xuXHRcdHRoaXMuX29uRGlkVXBkYXRlQ29uZmlndXJhdGlvbi5maXJlKHsgcHJvcGVydGllcywgZGVmYXVsdHNPdmVycmlkZXM6IHRydWUgfSk7XG5cdH1cblxuXHRwcml2YXRlIGRvRGVyZWdpc3RlckRlZmF1bHRDb25maWd1cmF0aW9ucyhkZWZhdWx0Q29uZmlndXJhdGlvbnM6IElDb25maWd1cmF0aW9uRGVmYXVsdHNbXSwgYnVja2V0OiBTZXQ8c3RyaW5nPik6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgZGVmYXVsdENvbmZpZ3VyYXRpb24gb2YgZGVmYXVsdENvbmZpZ3VyYXRpb25zKSB7XG5cdFx0XHRjb25zdCBpbmRleCA9IHRoaXMucmVnaXN0ZXJlZENvbmZpZ3VyYXRpb25EZWZhdWx0cy5pbmRleE9mKGRlZmF1bHRDb25maWd1cmF0aW9uKTtcblx0XHRcdGlmIChpbmRleCAhPT0gLTEpIHtcblx0XHRcdFx0dGhpcy5yZWdpc3RlcmVkQ29uZmlndXJhdGlvbkRlZmF1bHRzLnNwbGljZShpbmRleCwgMSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCB7IG92ZXJyaWRlcywgc291cmNlIH0gb2YgZGVmYXVsdENvbmZpZ3VyYXRpb25zKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGtleSBpbiBvdmVycmlkZXMpIHtcblx0XHRcdFx0Y29uc3QgY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZXNGb3JLZXkgPSB0aGlzLmNvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlcy5nZXQoa2V5KTtcblx0XHRcdFx0aWYgKCFjb25maWd1cmF0aW9uRGVmYXVsdE92ZXJyaWRlc0ZvcktleSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgaW5kZXggPSBjb25maWd1cmF0aW9uRGVmYXVsdE92ZXJyaWRlc0ZvcktleS5jb25maWd1cmF0aW9uRGVmYXVsdE92ZXJyaWRlc1xuXHRcdFx0XHRcdC5maW5kSW5kZXgoY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZSA9PiBzb3VyY2UgPyBjb25maWd1cmF0aW9uRGVmYXVsdE92ZXJyaWRlLnNvdXJjZT8uaWQgPT09IHNvdXJjZS5pZCA6IGNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGUudmFsdWUgPT09IG92ZXJyaWRlc1trZXldKTtcblx0XHRcdFx0aWYgKGluZGV4ID09PSAtMSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZXNGb3JLZXkuY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZXMuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdFx0aWYgKGNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGVzRm9yS2V5LmNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGVzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdHRoaXMuY29uZmlndXJhdGlvbkRlZmF1bHRzT3ZlcnJpZGVzLmRlbGV0ZShrZXkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKE9WRVJSSURFX1BST1BFUlRZX1JFR0VYLnRlc3Qoa2V5KSkge1xuXHRcdFx0XHRcdGxldCBjb25maWd1cmF0aW9uRGVmYXVsdE92ZXJyaWRlVmFsdWU6IElDb25maWd1cmF0aW9uRGVmYXVsdE92ZXJyaWRlVmFsdWUgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBjb25maWd1cmF0aW9uRGVmYXVsdE92ZXJyaWRlIG9mIGNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGVzRm9yS2V5LmNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGVzKSB7XG5cdFx0XHRcdFx0XHRjb25maWd1cmF0aW9uRGVmYXVsdE92ZXJyaWRlVmFsdWUgPSB0aGlzLm1lcmdlRGVmYXVsdENvbmZpZ3VyYXRpb25zRm9yT3ZlcnJpZGVJZGVudGlmaWVyKGtleSwgY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZS52YWx1ZSwgY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZS5zb3VyY2UsIGNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGVWYWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChjb25maWd1cmF0aW9uRGVmYXVsdE92ZXJyaWRlVmFsdWUgJiYgIXR5cGVzLmlzRW1wdHlPYmplY3QoY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZVZhbHVlLnZhbHVlKSkge1xuXHRcdFx0XHRcdFx0Y29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZXNGb3JLZXkuY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZVZhbHVlID0gY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZVZhbHVlO1xuXHRcdFx0XHRcdFx0dGhpcy51cGRhdGVEZWZhdWx0T3ZlcnJpZGVQcm9wZXJ0eShrZXksIGNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGVWYWx1ZSwgc291cmNlKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0dGhpcy5jb25maWd1cmF0aW9uRGVmYXVsdHNPdmVycmlkZXMuZGVsZXRlKGtleSk7XG5cdFx0XHRcdFx0XHRkZWxldGUgdGhpcy5jb25maWd1cmF0aW9uUHJvcGVydGllc1trZXldO1xuXHRcdFx0XHRcdFx0ZGVsZXRlIHRoaXMuZGVmYXVsdExhbmd1YWdlQ29uZmlndXJhdGlvbk92ZXJyaWRlc05vZGUucHJvcGVydGllcyFba2V5XTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bGV0IGNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGVWYWx1ZTogSUNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGVWYWx1ZSB8IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IGNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGUgb2YgY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZXNGb3JLZXkuY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZXMpIHtcblx0XHRcdFx0XHRcdGNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGVWYWx1ZSA9IHRoaXMubWVyZ2VEZWZhdWx0Q29uZmlndXJhdGlvbnNGb3JDb25maWd1cmF0aW9uUHJvcGVydHkoa2V5LCBjb25maWd1cmF0aW9uRGVmYXVsdE92ZXJyaWRlLnZhbHVlLCBjb25maWd1cmF0aW9uRGVmYXVsdE92ZXJyaWRlLnNvdXJjZSwgY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZVZhbHVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZXNGb3JLZXkuY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZVZhbHVlID0gY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZVZhbHVlO1xuXHRcdFx0XHRcdGNvbnN0IHByb3BlcnR5ID0gdGhpcy5jb25maWd1cmF0aW9uUHJvcGVydGllc1trZXldO1xuXHRcdFx0XHRcdGlmIChwcm9wZXJ0eSkge1xuXHRcdFx0XHRcdFx0dGhpcy51cGRhdGVQcm9wZXJ0eURlZmF1bHRWYWx1ZShrZXksIHByb3BlcnR5KTtcblx0XHRcdFx0XHRcdHRoaXMudXBkYXRlU2NoZW1hKGtleSwgcHJvcGVydHkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRidWNrZXQuYWRkKGtleSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMudXBkYXRlT3ZlcnJpZGVQcm9wZXJ0eVBhdHRlcm5LZXkoKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlRGVmYXVsdE92ZXJyaWRlUHJvcGVydHkoa2V5OiBzdHJpbmcsIG5ld0RlZmF1bHRPdmVycmlkZTogSUNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGVWYWx1ZSwgc291cmNlOiBJRXh0ZW5zaW9uSW5mbyB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IHByb3BlcnR5OiBJUmVnaXN0ZXJlZENvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSA9IHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0ZGVmYXVsdDogbmV3RGVmYXVsdE92ZXJyaWRlLnZhbHVlLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZGVmYXVsdExhbmd1YWdlQ29uZmlndXJhdGlvbi5kZXNjcmlwdGlvbicsIFwiQ29uZmlndXJlIHNldHRpbmdzIHRvIGJlIG92ZXJyaWRkZW4gZm9yIHRoZSB7MH0gbGFuZ3VhZ2UuXCIsIGdldExhbmd1YWdlVGFnU2V0dGluZ1BsYWluS2V5KGtleSkpLFxuXHRcdFx0JHJlZjogcmVzb3VyY2VMYW5ndWFnZVNldHRpbmdzU2NoZW1hSWQsXG5cdFx0XHRkZWZhdWx0RGVmYXVsdFZhbHVlOiBuZXdEZWZhdWx0T3ZlcnJpZGUudmFsdWUsXG5cdFx0XHRzb3VyY2UsXG5cdFx0XHRkZWZhdWx0VmFsdWVTb3VyY2U6IHNvdXJjZVxuXHRcdH07XG5cdFx0dGhpcy5jb25maWd1cmF0aW9uUHJvcGVydGllc1trZXldID0gcHJvcGVydHk7XG5cdFx0dGhpcy5kZWZhdWx0TGFuZ3VhZ2VDb25maWd1cmF0aW9uT3ZlcnJpZGVzTm9kZS5wcm9wZXJ0aWVzIVtrZXldID0gcHJvcGVydHk7XG5cdH1cblxuXHRwcml2YXRlIG1lcmdlRGVmYXVsdENvbmZpZ3VyYXRpb25zRm9yT3ZlcnJpZGVJZGVudGlmaWVyKG92ZXJyaWRlSWRlbnRpZmllcjogc3RyaW5nLCBjb25maWd1cmF0aW9uVmFsdWVPYmplY3Q6IElTdHJpbmdEaWN0aW9uYXJ5PGFueT4sIHZhbHVlU291cmNlOiBJRXh0ZW5zaW9uSW5mbyB8IHVuZGVmaW5lZCwgZXhpc3RpbmdEZWZhdWx0T3ZlcnJpZGU6IElDb25maWd1cmF0aW9uRGVmYXVsdE92ZXJyaWRlVmFsdWUgfCB1bmRlZmluZWQpOiBJQ29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZVZhbHVlIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBkZWZhdWx0VmFsdWUgPSBleGlzdGluZ0RlZmF1bHRPdmVycmlkZT8udmFsdWUgfHwge307XG5cdFx0Y29uc3Qgc291cmNlID0gZXhpc3RpbmdEZWZhdWx0T3ZlcnJpZGU/LnNvdXJjZSA/PyBuZXcgTWFwPHN0cmluZywgSUV4dGVuc2lvbkluZm8+KCk7XG5cblx0XHQvLyBUaGlzIHNob3VsZCBub3QgaGFwcGVuXG5cdFx0aWYgKCEoc291cmNlIGluc3RhbmNlb2YgTWFwKSkge1xuXHRcdFx0Y29uc29sZS5lcnJvcignb2JqZWN0Q29uZmlndXJhdGlvblNvdXJjZXMgaXMgbm90IGEgTWFwJyk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgcHJvcGVydHlLZXkgb2YgT2JqZWN0LmtleXMoY29uZmlndXJhdGlvblZhbHVlT2JqZWN0KSkge1xuXHRcdFx0Y29uc3QgcHJvcGVydHlEZWZhdWx0VmFsdWUgPSBjb25maWd1cmF0aW9uVmFsdWVPYmplY3RbcHJvcGVydHlLZXldO1xuXG5cdFx0XHRjb25zdCBpc09iamVjdFNldHRpbmcgPSB0eXBlcy5pc09iamVjdChwcm9wZXJ0eURlZmF1bHRWYWx1ZSkgJiZcblx0XHRcdFx0KHR5cGVzLmlzVW5kZWZpbmVkKGRlZmF1bHRWYWx1ZVtwcm9wZXJ0eUtleV0pIHx8IHR5cGVzLmlzT2JqZWN0KGRlZmF1bHRWYWx1ZVtwcm9wZXJ0eUtleV0pKTtcblxuXHRcdFx0Ly8gSWYgdGhlIGRlZmF1bHQgdmFsdWUgaXMgYW4gb2JqZWN0LCBtZXJnZSB0aGUgb2JqZWN0cyBhbmQgc3RvcmUgdGhlIHNvdXJjZSBvZiBlYWNoIGtleXNcblx0XHRcdGlmIChpc09iamVjdFNldHRpbmcpIHtcblx0XHRcdFx0ZGVmYXVsdFZhbHVlW3Byb3BlcnR5S2V5XSA9IHsgLi4uKGRlZmF1bHRWYWx1ZVtwcm9wZXJ0eUtleV0gPz8ge30pLCAuLi5wcm9wZXJ0eURlZmF1bHRWYWx1ZSB9O1xuXHRcdFx0XHQvLyBUcmFjayB0aGUgc291cmNlIG9mIGVhY2ggdmFsdWUgaW4gdGhlIG9iamVjdFxuXHRcdFx0XHRpZiAodmFsdWVTb3VyY2UpIHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IG9iamVjdEtleSBpbiBwcm9wZXJ0eURlZmF1bHRWYWx1ZSkge1xuXHRcdFx0XHRcdFx0c291cmNlLnNldChgJHtwcm9wZXJ0eUtleX0uJHtvYmplY3RLZXl9YCwgdmFsdWVTb3VyY2UpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBQcmltaXRpdmUgdmFsdWVzIGFyZSBvdmVycmlkZGVuXG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0ZGVmYXVsdFZhbHVlW3Byb3BlcnR5S2V5XSA9IHByb3BlcnR5RGVmYXVsdFZhbHVlO1xuXHRcdFx0XHRpZiAodmFsdWVTb3VyY2UpIHtcblx0XHRcdFx0XHRzb3VyY2Uuc2V0KHByb3BlcnR5S2V5LCB2YWx1ZVNvdXJjZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0c291cmNlLmRlbGV0ZShwcm9wZXJ0eUtleSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4geyB2YWx1ZTogZGVmYXVsdFZhbHVlLCBzb3VyY2UgfTtcblx0fVxuXG5cdHByaXZhdGUgbWVyZ2VEZWZhdWx0Q29uZmlndXJhdGlvbnNGb3JDb25maWd1cmF0aW9uUHJvcGVydHkocHJvcGVydHlLZXk6IHN0cmluZywgdmFsdWU6IGFueSwgdmFsdWVzU291cmNlOiBJRXh0ZW5zaW9uSW5mbyB8IHVuZGVmaW5lZCwgZXhpc3RpbmdEZWZhdWx0T3ZlcnJpZGU6IElDb25maWd1cmF0aW9uRGVmYXVsdE92ZXJyaWRlVmFsdWUgfCB1bmRlZmluZWQpOiBJQ29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZVZhbHVlIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBwcm9wZXJ0eSA9IHRoaXMuY29uZmlndXJhdGlvblByb3BlcnRpZXNbcHJvcGVydHlLZXldO1xuXHRcdGNvbnN0IGV4aXN0aW5nRGVmYXVsdFZhbHVlID0gZXhpc3RpbmdEZWZhdWx0T3ZlcnJpZGU/LnZhbHVlID8/IHByb3BlcnR5Py5kZWZhdWx0RGVmYXVsdFZhbHVlO1xuXHRcdGxldCBzb3VyY2U6IENvbmZpZ3VyYXRpb25EZWZhdWx0VmFsdWVTb3VyY2UgfCB1bmRlZmluZWQgPSB2YWx1ZXNTb3VyY2U7XG5cblx0XHRjb25zdCBpc09iamVjdFNldHRpbmcgPSB0eXBlcy5pc09iamVjdCh2YWx1ZSkgJiZcblx0XHRcdChcblx0XHRcdFx0cHJvcGVydHkgIT09IHVuZGVmaW5lZCAmJiBwcm9wZXJ0eS50eXBlID09PSAnb2JqZWN0JyB8fFxuXHRcdFx0XHRwcm9wZXJ0eSA9PT0gdW5kZWZpbmVkICYmICh0eXBlcy5pc1VuZGVmaW5lZChleGlzdGluZ0RlZmF1bHRWYWx1ZSkgfHwgdHlwZXMuaXNPYmplY3QoZXhpc3RpbmdEZWZhdWx0VmFsdWUpKVxuXHRcdFx0KTtcblxuXHRcdC8vIElmIHRoZSBkZWZhdWx0IHZhbHVlIGlzIGFuIG9iamVjdCwgbWVyZ2UgdGhlIG9iamVjdHMgYW5kIHN0b3JlIHRoZSBzb3VyY2Ugb2YgZWFjaCBrZXlzXG5cdFx0aWYgKGlzT2JqZWN0U2V0dGluZykge1xuXHRcdFx0c291cmNlID0gZXhpc3RpbmdEZWZhdWx0T3ZlcnJpZGU/LnNvdXJjZSA/PyBuZXcgTWFwPHN0cmluZywgSUV4dGVuc2lvbkluZm8+KCk7XG5cblx0XHRcdC8vIFRoaXMgc2hvdWxkIG5vdCBoYXBwZW5cblx0XHRcdGlmICghKHNvdXJjZSBpbnN0YW5jZW9mIE1hcCkpIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcignZGVmYXVsdFZhbHVlU291cmNlIGlzIG5vdCBhIE1hcCcpO1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGNvbnN0IG9iamVjdEtleSBpbiB2YWx1ZSkge1xuXHRcdFx0XHRpZiAodmFsdWVzU291cmNlKSB7XG5cdFx0XHRcdFx0c291cmNlLnNldChgJHtwcm9wZXJ0eUtleX0uJHtvYmplY3RLZXl9YCwgdmFsdWVzU291cmNlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0dmFsdWUgPSB7IC4uLih0eXBlcy5pc09iamVjdChleGlzdGluZ0RlZmF1bHRWYWx1ZSkgPyBleGlzdGluZ0RlZmF1bHRWYWx1ZSA6IHt9KSwgLi4udmFsdWUgfTtcblx0XHR9XG5cblx0XHRyZXR1cm4geyB2YWx1ZSwgc291cmNlIH07XG5cdH1cblxuXHRwdWJsaWMgZGVsdGFDb25maWd1cmF0aW9uKGRlbHRhOiBJQ29uZmlndXJhdGlvbkRlbHRhKTogdm9pZCB7XG5cdFx0Ly8gZGVmYXVsdHM6IHJlbW92ZVxuXHRcdGxldCBkZWZhdWx0c092ZXJyaWRlcyA9IGZhbHNlO1xuXHRcdGNvbnN0IHByb3BlcnRpZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHRpZiAoZGVsdGEucmVtb3ZlZERlZmF1bHRzKSB7XG5cdFx0XHR0aGlzLmRvRGVyZWdpc3RlckRlZmF1bHRDb25maWd1cmF0aW9ucyhkZWx0YS5yZW1vdmVkRGVmYXVsdHMsIHByb3BlcnRpZXMpO1xuXHRcdFx0ZGVmYXVsdHNPdmVycmlkZXMgPSB0cnVlO1xuXHRcdH1cblx0XHQvLyBkZWZhdWx0czogYWRkXG5cdFx0aWYgKGRlbHRhLmFkZGVkRGVmYXVsdHMpIHtcblx0XHRcdHRoaXMuZG9SZWdpc3RlckRlZmF1bHRDb25maWd1cmF0aW9ucyhkZWx0YS5hZGRlZERlZmF1bHRzLCBwcm9wZXJ0aWVzKTtcblx0XHRcdGRlZmF1bHRzT3ZlcnJpZGVzID0gdHJ1ZTtcblx0XHR9XG5cdFx0Ly8gY29uZmlndXJhdGlvbnM6IHJlbW92ZVxuXHRcdGlmIChkZWx0YS5yZW1vdmVkQ29uZmlndXJhdGlvbnMpIHtcblx0XHRcdHRoaXMuZG9EZXJlZ2lzdGVyQ29uZmlndXJhdGlvbnMoZGVsdGEucmVtb3ZlZENvbmZpZ3VyYXRpb25zLCBwcm9wZXJ0aWVzKTtcblx0XHR9XG5cdFx0Ly8gY29uZmlndXJhdGlvbnM6IGFkZFxuXHRcdGlmIChkZWx0YS5hZGRlZENvbmZpZ3VyYXRpb25zKSB7XG5cdFx0XHR0aGlzLmRvUmVnaXN0ZXJDb25maWd1cmF0aW9ucyhkZWx0YS5hZGRlZENvbmZpZ3VyYXRpb25zLCBmYWxzZSwgcHJvcGVydGllcyk7XG5cdFx0fVxuXHRcdHRoaXMuX29uRGlkU2NoZW1hQ2hhbmdlLmZpcmUoKTtcblx0XHR0aGlzLl9vbkRpZFVwZGF0ZUNvbmZpZ3VyYXRpb24uZmlyZSh7IHByb3BlcnRpZXMsIGRlZmF1bHRzT3ZlcnJpZGVzIH0pO1xuXHR9XG5cblx0cHVibGljIG5vdGlmeUNvbmZpZ3VyYXRpb25TY2hlbWFVcGRhdGVkKC4uLmNvbmZpZ3VyYXRpb25zOiBJQ29uZmlndXJhdGlvbk5vZGVbXSkge1xuXHRcdHRoaXMuX29uRGlkU2NoZW1hQ2hhbmdlLmZpcmUoKTtcblx0fVxuXG5cdHB1YmxpYyByZWdpc3Rlck92ZXJyaWRlSWRlbnRpZmllcnMob3ZlcnJpZGVJZGVudGlmaWVyczogc3RyaW5nW10pOiB2b2lkIHtcblx0XHR0aGlzLmRvUmVnaXN0ZXJPdmVycmlkZUlkZW50aWZpZXJzKG92ZXJyaWRlSWRlbnRpZmllcnMpO1xuXHRcdHRoaXMuX29uRGlkU2NoZW1hQ2hhbmdlLmZpcmUoKTtcblx0fVxuXG5cdHByaXZhdGUgZG9SZWdpc3Rlck92ZXJyaWRlSWRlbnRpZmllcnMob3ZlcnJpZGVJZGVudGlmaWVyczogc3RyaW5nW10pIHtcblx0XHRmb3IgKGNvbnN0IG92ZXJyaWRlSWRlbnRpZmllciBvZiBvdmVycmlkZUlkZW50aWZpZXJzKSB7XG5cdFx0XHR0aGlzLm92ZXJyaWRlSWRlbnRpZmllcnMuYWRkKG92ZXJyaWRlSWRlbnRpZmllcik7XG5cdFx0fVxuXHRcdHRoaXMudXBkYXRlT3ZlcnJpZGVQcm9wZXJ0eVBhdHRlcm5LZXkoKTtcblx0fVxuXG5cdHByaXZhdGUgZG9SZWdpc3RlckNvbmZpZ3VyYXRpb25zKGNvbmZpZ3VyYXRpb25zOiBJQ29uZmlndXJhdGlvbk5vZGVbXSwgdmFsaWRhdGU6IGJvb2xlYW4sIGJ1Y2tldDogU2V0PHN0cmluZz4pOiB2b2lkIHtcblxuXHRcdGNvbmZpZ3VyYXRpb25zLmZvckVhY2goY29uZmlndXJhdGlvbiA9PiB7XG5cblx0XHRcdHRoaXMudmFsaWRhdGVBbmRSZWdpc3RlclByb3BlcnRpZXMoY29uZmlndXJhdGlvbiwgdmFsaWRhdGUsIGNvbmZpZ3VyYXRpb24uZXh0ZW5zaW9uSW5mbywgY29uZmlndXJhdGlvbi5yZXN0cmljdGVkUHJvcGVydGllcywgdW5kZWZpbmVkLCBidWNrZXQpO1xuXG5cdFx0XHR0aGlzLmNvbmZpZ3VyYXRpb25Db250cmlidXRvcnMucHVzaChjb25maWd1cmF0aW9uKTtcblx0XHRcdHRoaXMucmVnaXN0ZXJKU09OQ29uZmlndXJhdGlvbihjb25maWd1cmF0aW9uKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgZG9EZXJlZ2lzdGVyQ29uZmlndXJhdGlvbnMoY29uZmlndXJhdGlvbnM6IElDb25maWd1cmF0aW9uTm9kZVtdLCBidWNrZXQ6IFNldDxzdHJpbmc+KTogdm9pZCB7XG5cblx0XHRjb25zdCBkZXJlZ2lzdGVyQ29uZmlndXJhdGlvbiA9IChjb25maWd1cmF0aW9uOiBJQ29uZmlndXJhdGlvbk5vZGUpID0+IHtcblx0XHRcdGlmIChjb25maWd1cmF0aW9uLnByb3BlcnRpZXMpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBrZXkgaW4gY29uZmlndXJhdGlvbi5wcm9wZXJ0aWVzKSB7XG5cdFx0XHRcdFx0YnVja2V0LmFkZChrZXkpO1xuXHRcdFx0XHRcdGNvbnN0IHByb3BlcnR5ID0gdGhpcy5jb25maWd1cmF0aW9uUHJvcGVydGllc1trZXldO1xuXHRcdFx0XHRcdGlmIChwcm9wZXJ0eT8ucG9saWN5Py5uYW1lKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnBvbGljeUNvbmZpZ3VyYXRpb25zLmRlbGV0ZShwcm9wZXJ0eS5wb2xpY3kubmFtZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGRlbGV0ZSB0aGlzLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzW2tleV07XG5cdFx0XHRcdFx0dGhpcy5yZW1vdmVGcm9tU2NoZW1hKGtleSwgY29uZmlndXJhdGlvbi5wcm9wZXJ0aWVzW2tleV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjb25maWd1cmF0aW9uLmFsbE9mPy5mb3JFYWNoKG5vZGUgPT4gZGVyZWdpc3RlckNvbmZpZ3VyYXRpb24obm9kZSkpO1xuXHRcdH07XG5cdFx0Zm9yIChjb25zdCBjb25maWd1cmF0aW9uIG9mIGNvbmZpZ3VyYXRpb25zKSB7XG5cdFx0XHRkZXJlZ2lzdGVyQ29uZmlndXJhdGlvbihjb25maWd1cmF0aW9uKTtcblx0XHRcdGNvbnN0IGluZGV4ID0gdGhpcy5jb25maWd1cmF0aW9uQ29udHJpYnV0b3JzLmluZGV4T2YoY29uZmlndXJhdGlvbik7XG5cdFx0XHRpZiAoaW5kZXggIT09IC0xKSB7XG5cdFx0XHRcdHRoaXMuY29uZmlndXJhdGlvbkNvbnRyaWJ1dG9ycy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdmFsaWRhdGVBbmRSZWdpc3RlclByb3BlcnRpZXMoY29uZmlndXJhdGlvbjogSUNvbmZpZ3VyYXRpb25Ob2RlLCB2YWxpZGF0ZTogYm9vbGVhbiA9IHRydWUsIGV4dGVuc2lvbkluZm86IElFeHRlbnNpb25JbmZvIHwgdW5kZWZpbmVkLCByZXN0cmljdGVkUHJvcGVydGllczogc3RyaW5nW10gfCB1bmRlZmluZWQsIHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUgPSBDb25maWd1cmF0aW9uU2NvcGUuV0lORE9XLCBidWNrZXQ6IFNldDxzdHJpbmc+KTogdm9pZCB7XG5cdFx0c2NvcGUgPSB0eXBlcy5pc1VuZGVmaW5lZE9yTnVsbChjb25maWd1cmF0aW9uLnNjb3BlKSA/IHNjb3BlIDogY29uZmlndXJhdGlvbi5zY29wZTtcblx0XHRjb25zdCBwcm9wZXJ0aWVzID0gY29uZmlndXJhdGlvbi5wcm9wZXJ0aWVzO1xuXHRcdGlmIChwcm9wZXJ0aWVzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGtleSBpbiBwcm9wZXJ0aWVzKSB7XG5cdFx0XHRcdGNvbnN0IHByb3BlcnR5OiBJUmVnaXN0ZXJlZENvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSA9IHByb3BlcnRpZXNba2V5XTtcblx0XHRcdFx0aWYgKHZhbGlkYXRlICYmIHZhbGlkYXRlUHJvcGVydHkoa2V5LCBwcm9wZXJ0eSkpIHtcblx0XHRcdFx0XHRkZWxldGUgcHJvcGVydGllc1trZXldO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cHJvcGVydHkuc291cmNlID0gZXh0ZW5zaW9uSW5mbztcblxuXHRcdFx0XHQvLyB1cGRhdGUgZGVmYXVsdCB2YWx1ZVxuXHRcdFx0XHRwcm9wZXJ0eS5kZWZhdWx0RGVmYXVsdFZhbHVlID0gcHJvcGVydGllc1trZXldLmRlZmF1bHQ7XG5cdFx0XHRcdHRoaXMudXBkYXRlUHJvcGVydHlEZWZhdWx0VmFsdWUoa2V5LCBwcm9wZXJ0eSk7XG5cblx0XHRcdFx0Ly8gdXBkYXRlIHNjb3BlXG5cdFx0XHRcdGlmIChPVkVSUklERV9QUk9QRVJUWV9SRUdFWC50ZXN0KGtleSkpIHtcblx0XHRcdFx0XHRwcm9wZXJ0eS5zY29wZSA9IHVuZGVmaW5lZDsgLy8gTm8gc2NvcGUgZm9yIG92ZXJyaWRhYmxlIHByb3BlcnRpZXMgYFske2lkZW50aWZpZXJ9XWBcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRwcm9wZXJ0eS5zY29wZSA9IHR5cGVzLmlzVW5kZWZpbmVkT3JOdWxsKHByb3BlcnR5LnNjb3BlKSA/IHNjb3BlIDogcHJvcGVydHkuc2NvcGU7XG5cdFx0XHRcdFx0cHJvcGVydHkucmVzdHJpY3RlZCA9IHR5cGVzLmlzVW5kZWZpbmVkT3JOdWxsKHByb3BlcnR5LnJlc3RyaWN0ZWQpID8gISFyZXN0cmljdGVkUHJvcGVydGllcz8uaW5jbHVkZXMoa2V5KSA6IHByb3BlcnR5LnJlc3RyaWN0ZWQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBleGNsdWRlZCA9IHByb3BlcnRpZXNba2V5XS5oYXNPd25Qcm9wZXJ0eSgnaW5jbHVkZWQnKSAmJiAhcHJvcGVydGllc1trZXldLmluY2x1ZGVkO1xuXHRcdFx0XHRjb25zdCBwb2xpY3lOYW1lID0gcHJvcGVydGllc1trZXldLnBvbGljeT8ubmFtZTtcblxuXHRcdFx0XHRpZiAoZXhjbHVkZWQpIHtcblx0XHRcdFx0XHR0aGlzLmV4Y2x1ZGVkQ29uZmlndXJhdGlvblByb3BlcnRpZXNba2V5XSA9IHByb3BlcnRpZXNba2V5XTtcblx0XHRcdFx0XHRpZiAocG9saWN5TmFtZSkge1xuXHRcdFx0XHRcdFx0dGhpcy5wb2xpY3lDb25maWd1cmF0aW9ucy5zZXQocG9saWN5TmFtZSwga2V5KTtcblx0XHRcdFx0XHRcdGJ1Y2tldC5hZGQoa2V5KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZGVsZXRlIHByb3BlcnRpZXNba2V5XTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRidWNrZXQuYWRkKGtleSk7XG5cdFx0XHRcdFx0aWYgKHBvbGljeU5hbWUpIHtcblx0XHRcdFx0XHRcdHRoaXMucG9saWN5Q29uZmlndXJhdGlvbnMuc2V0KHBvbGljeU5hbWUsIGtleSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMuY29uZmlndXJhdGlvblByb3BlcnRpZXNba2V5XSA9IHByb3BlcnRpZXNba2V5XTtcblx0XHRcdFx0XHRpZiAoIXByb3BlcnRpZXNba2V5XS5kZXByZWNhdGlvbk1lc3NhZ2UgJiYgcHJvcGVydGllc1trZXldLm1hcmtkb3duRGVwcmVjYXRpb25NZXNzYWdlKSB7XG5cdFx0XHRcdFx0XHQvLyBJZiBub3Qgc2V0LCBkZWZhdWx0IGRlcHJlY2F0aW9uTWVzc2FnZSB0byB0aGUgbWFya2Rvd24gc291cmNlXG5cdFx0XHRcdFx0XHRwcm9wZXJ0aWVzW2tleV0uZGVwcmVjYXRpb25NZXNzYWdlID0gcHJvcGVydGllc1trZXldLm1hcmtkb3duRGVwcmVjYXRpb25NZXNzYWdlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvbnN0IHN1Yk5vZGVzID0gY29uZmlndXJhdGlvbi5hbGxPZjtcblx0XHRpZiAoc3ViTm9kZXMpIHtcblx0XHRcdGZvciAoY29uc3Qgbm9kZSBvZiBzdWJOb2Rlcykge1xuXHRcdFx0XHR0aGlzLnZhbGlkYXRlQW5kUmVnaXN0ZXJQcm9wZXJ0aWVzKG5vZGUsIHZhbGlkYXRlLCBleHRlbnNpb25JbmZvLCByZXN0cmljdGVkUHJvcGVydGllcywgc2NvcGUsIGJ1Y2tldCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0Ly8gVE9ETzogQHNhbmR5MDgxIC0gUmVtb3ZlIHRoaXMgbWV0aG9kIGFuZCBpbmNsdWRlIHJlcXVpcmVkIGluZm8gaW4gZ2V0Q29uZmlndXJhdGlvblByb3BlcnRpZXNcblx0Z2V0Q29uZmlndXJhdGlvbnMoKTogSUNvbmZpZ3VyYXRpb25Ob2RlW10ge1xuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25Db250cmlidXRvcnM7XG5cdH1cblxuXHRnZXRDb25maWd1cmF0aW9uUHJvcGVydGllcygpOiBJU3RyaW5nRGljdGlvbmFyeTxJUmVnaXN0ZXJlZENvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYT4ge1xuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzO1xuXHR9XG5cblx0Z2V0UG9saWN5Q29uZmlndXJhdGlvbnMoKTogTWFwPFBvbGljeU5hbWUsIHN0cmluZz4ge1xuXHRcdHJldHVybiB0aGlzLnBvbGljeUNvbmZpZ3VyYXRpb25zO1xuXHR9XG5cblx0Z2V0RXhjbHVkZWRDb25maWd1cmF0aW9uUHJvcGVydGllcygpOiBJU3RyaW5nRGljdGlvbmFyeTxJUmVnaXN0ZXJlZENvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYT4ge1xuXHRcdHJldHVybiB0aGlzLmV4Y2x1ZGVkQ29uZmlndXJhdGlvblByb3BlcnRpZXM7XG5cdH1cblxuXHRnZXRSZWdpc3RlcmVkRGVmYXVsdENvbmZpZ3VyYXRpb25zKCk6IElDb25maWd1cmF0aW9uRGVmYXVsdHNbXSB7XG5cdFx0cmV0dXJuIFsuLi50aGlzLnJlZ2lzdGVyZWRDb25maWd1cmF0aW9uRGVmYXVsdHNdO1xuXHR9XG5cblx0Z2V0Q29uZmlndXJhdGlvbkRlZmF1bHRzT3ZlcnJpZGVzKCk6IE1hcDxzdHJpbmcsIElDb25maWd1cmF0aW9uRGVmYXVsdE92ZXJyaWRlVmFsdWU+IHtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uRGVmYXVsdHNPdmVycmlkZXMgPSBuZXcgTWFwPHN0cmluZywgSUNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGVWYWx1ZT4oKTtcblx0XHRmb3IgKGNvbnN0IFtrZXksIHZhbHVlXSBvZiB0aGlzLmNvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlcykge1xuXHRcdFx0aWYgKHZhbHVlLmNvbmZpZ3VyYXRpb25EZWZhdWx0T3ZlcnJpZGVWYWx1ZSkge1xuXHRcdFx0XHRjb25maWd1cmF0aW9uRGVmYXVsdHNPdmVycmlkZXMuc2V0KGtleSwgdmFsdWUuY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZVZhbHVlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGNvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlcztcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJKU09OQ29uZmlndXJhdGlvbihjb25maWd1cmF0aW9uOiBJQ29uZmlndXJhdGlvbk5vZGUpIHtcblx0XHRjb25zdCByZWdpc3RlciA9IChjb25maWd1cmF0aW9uOiBJQ29uZmlndXJhdGlvbk5vZGUpID0+IHtcblx0XHRcdGNvbnN0IHByb3BlcnRpZXMgPSBjb25maWd1cmF0aW9uLnByb3BlcnRpZXM7XG5cdFx0XHRpZiAocHJvcGVydGllcykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGtleSBpbiBwcm9wZXJ0aWVzKSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVTY2hlbWEoa2V5LCBwcm9wZXJ0aWVzW2tleV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBzdWJOb2RlcyA9IGNvbmZpZ3VyYXRpb24uYWxsT2Y7XG5cdFx0XHRzdWJOb2Rlcz8uZm9yRWFjaChyZWdpc3Rlcik7XG5cdFx0fTtcblx0XHRyZWdpc3Rlcihjb25maWd1cmF0aW9uKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlU2NoZW1hKGtleTogc3RyaW5nLCBwcm9wZXJ0eTogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSk6IHZvaWQge1xuXHRcdGFsbFNldHRpbmdzLnByb3BlcnRpZXNba2V5XSA9IHByb3BlcnR5O1xuXHRcdHN3aXRjaCAocHJvcGVydHkuc2NvcGUpIHtcblx0XHRcdGNhc2UgQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OOlxuXHRcdFx0XHRhcHBsaWNhdGlvblNldHRpbmdzLnByb3BlcnRpZXNba2V5XSA9IHByb3BlcnR5O1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgQ29uZmlndXJhdGlvblNjb3BlLk1BQ0hJTkU6XG5cdFx0XHRcdG1hY2hpbmVTZXR0aW5ncy5wcm9wZXJ0aWVzW2tleV0gPSBwcm9wZXJ0eTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTl9NQUNISU5FOlxuXHRcdFx0XHRhcHBsaWNhdGlvbk1hY2hpbmVTZXR0aW5ncy5wcm9wZXJ0aWVzW2tleV0gPSBwcm9wZXJ0eTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIENvbmZpZ3VyYXRpb25TY29wZS5NQUNISU5FX09WRVJSSURBQkxFOlxuXHRcdFx0XHRtYWNoaW5lT3ZlcnJpZGFibGVTZXR0aW5ncy5wcm9wZXJ0aWVzW2tleV0gPSBwcm9wZXJ0eTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIENvbmZpZ3VyYXRpb25TY29wZS5XSU5ET1c6XG5cdFx0XHRcdHdpbmRvd1NldHRpbmdzLnByb3BlcnRpZXNba2V5XSA9IHByb3BlcnR5O1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgQ29uZmlndXJhdGlvblNjb3BlLlJFU09VUkNFOlxuXHRcdFx0XHRyZXNvdXJjZVNldHRpbmdzLnByb3BlcnRpZXNba2V5XSA9IHByb3BlcnR5O1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFOlxuXHRcdFx0XHRyZXNvdXJjZVNldHRpbmdzLnByb3BlcnRpZXNba2V5XSA9IHByb3BlcnR5O1xuXHRcdFx0XHR0aGlzLnJlc291cmNlTGFuZ3VhZ2VTZXR0aW5nc1NjaGVtYS5wcm9wZXJ0aWVzIVtrZXldID0gcHJvcGVydHk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVtb3ZlRnJvbVNjaGVtYShrZXk6IHN0cmluZywgcHJvcGVydHk6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEpOiB2b2lkIHtcblx0XHRkZWxldGUgYWxsU2V0dGluZ3MucHJvcGVydGllc1trZXldO1xuXHRcdHN3aXRjaCAocHJvcGVydHkuc2NvcGUpIHtcblx0XHRcdGNhc2UgQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OOlxuXHRcdFx0XHRkZWxldGUgYXBwbGljYXRpb25TZXR0aW5ncy5wcm9wZXJ0aWVzW2tleV07XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBDb25maWd1cmF0aW9uU2NvcGUuTUFDSElORTpcblx0XHRcdFx0ZGVsZXRlIG1hY2hpbmVTZXR0aW5ncy5wcm9wZXJ0aWVzW2tleV07XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT05fTUFDSElORTpcblx0XHRcdFx0ZGVsZXRlIGFwcGxpY2F0aW9uTWFjaGluZVNldHRpbmdzLnByb3BlcnRpZXNba2V5XTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIENvbmZpZ3VyYXRpb25TY29wZS5NQUNISU5FX09WRVJSSURBQkxFOlxuXHRcdFx0XHRkZWxldGUgbWFjaGluZU92ZXJyaWRhYmxlU2V0dGluZ3MucHJvcGVydGllc1trZXldO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgQ29uZmlndXJhdGlvblNjb3BlLldJTkRPVzpcblx0XHRcdFx0ZGVsZXRlIHdpbmRvd1NldHRpbmdzLnByb3BlcnRpZXNba2V5XTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIENvbmZpZ3VyYXRpb25TY29wZS5SRVNPVVJDRTpcblx0XHRcdGNhc2UgQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFOlxuXHRcdFx0XHRkZWxldGUgcmVzb3VyY2VTZXR0aW5ncy5wcm9wZXJ0aWVzW2tleV07XG5cdFx0XHRcdGRlbGV0ZSB0aGlzLnJlc291cmNlTGFuZ3VhZ2VTZXR0aW5nc1NjaGVtYS5wcm9wZXJ0aWVzIVtrZXldO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZU92ZXJyaWRlUHJvcGVydHlQYXR0ZXJuS2V5KCk6IHZvaWQge1xuXHRcdGZvciAoY29uc3Qgb3ZlcnJpZGVJZGVudGlmaWVyIG9mIHRoaXMub3ZlcnJpZGVJZGVudGlmaWVycy52YWx1ZXMoKSkge1xuXHRcdFx0Y29uc3Qgb3ZlcnJpZGVJZGVudGlmaWVyUHJvcGVydHkgPSBgWyR7b3ZlcnJpZGVJZGVudGlmaWVyfV1gO1xuXHRcdFx0Y29uc3QgcmVzb3VyY2VMYW5ndWFnZVByb3BlcnRpZXNTY2hlbWE6IElKU09OU2NoZW1hID0ge1xuXHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnb3ZlcnJpZGVTZXR0aW5ncy5kZWZhdWx0RGVzY3JpcHRpb24nLCBcIkNvbmZpZ3VyZSBlZGl0b3Igc2V0dGluZ3MgdG8gYmUgb3ZlcnJpZGRlbiBmb3IgYSBsYW5ndWFnZS5cIiksXG5cdFx0XHRcdGVycm9yTWVzc2FnZTogbmxzLmxvY2FsaXplKCdvdmVycmlkZVNldHRpbmdzLmVycm9yTWVzc2FnZScsIFwiVGhpcyBzZXR0aW5nIGRvZXMgbm90IHN1cHBvcnQgcGVyLWxhbmd1YWdlIGNvbmZpZ3VyYXRpb24uXCIpLFxuXHRcdFx0XHQkcmVmOiByZXNvdXJjZUxhbmd1YWdlU2V0dGluZ3NTY2hlbWFJZCxcblx0XHRcdH07XG5cdFx0XHR0aGlzLnVwZGF0ZVByb3BlcnR5RGVmYXVsdFZhbHVlKG92ZXJyaWRlSWRlbnRpZmllclByb3BlcnR5LCByZXNvdXJjZUxhbmd1YWdlUHJvcGVydGllc1NjaGVtYSk7XG5cdFx0XHRhbGxTZXR0aW5ncy5wcm9wZXJ0aWVzW292ZXJyaWRlSWRlbnRpZmllclByb3BlcnR5XSA9IHJlc291cmNlTGFuZ3VhZ2VQcm9wZXJ0aWVzU2NoZW1hO1xuXHRcdFx0YXBwbGljYXRpb25TZXR0aW5ncy5wcm9wZXJ0aWVzW292ZXJyaWRlSWRlbnRpZmllclByb3BlcnR5XSA9IHJlc291cmNlTGFuZ3VhZ2VQcm9wZXJ0aWVzU2NoZW1hO1xuXHRcdFx0YXBwbGljYXRpb25NYWNoaW5lU2V0dGluZ3MucHJvcGVydGllc1tvdmVycmlkZUlkZW50aWZpZXJQcm9wZXJ0eV0gPSByZXNvdXJjZUxhbmd1YWdlUHJvcGVydGllc1NjaGVtYTtcblx0XHRcdG1hY2hpbmVTZXR0aW5ncy5wcm9wZXJ0aWVzW292ZXJyaWRlSWRlbnRpZmllclByb3BlcnR5XSA9IHJlc291cmNlTGFuZ3VhZ2VQcm9wZXJ0aWVzU2NoZW1hO1xuXHRcdFx0bWFjaGluZU92ZXJyaWRhYmxlU2V0dGluZ3MucHJvcGVydGllc1tvdmVycmlkZUlkZW50aWZpZXJQcm9wZXJ0eV0gPSByZXNvdXJjZUxhbmd1YWdlUHJvcGVydGllc1NjaGVtYTtcblx0XHRcdHdpbmRvd1NldHRpbmdzLnByb3BlcnRpZXNbb3ZlcnJpZGVJZGVudGlmaWVyUHJvcGVydHldID0gcmVzb3VyY2VMYW5ndWFnZVByb3BlcnRpZXNTY2hlbWE7XG5cdFx0XHRyZXNvdXJjZVNldHRpbmdzLnByb3BlcnRpZXNbb3ZlcnJpZGVJZGVudGlmaWVyUHJvcGVydHldID0gcmVzb3VyY2VMYW5ndWFnZVByb3BlcnRpZXNTY2hlbWE7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlck92ZXJyaWRlUHJvcGVydHlQYXR0ZXJuS2V5KCk6IHZvaWQge1xuXHRcdGNvbnN0IHJlc291cmNlTGFuZ3VhZ2VQcm9wZXJ0aWVzU2NoZW1hOiBJSlNPTlNjaGVtYSA9IHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnb3ZlcnJpZGVTZXR0aW5ncy5kZWZhdWx0RGVzY3JpcHRpb24nLCBcIkNvbmZpZ3VyZSBlZGl0b3Igc2V0dGluZ3MgdG8gYmUgb3ZlcnJpZGRlbiBmb3IgYSBsYW5ndWFnZS5cIiksXG5cdFx0XHRlcnJvck1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnb3ZlcnJpZGVTZXR0aW5ncy5lcnJvck1lc3NhZ2UnLCBcIlRoaXMgc2V0dGluZyBkb2VzIG5vdCBzdXBwb3J0IHBlci1sYW5ndWFnZSBjb25maWd1cmF0aW9uLlwiKSxcblx0XHRcdCRyZWY6IHJlc291cmNlTGFuZ3VhZ2VTZXR0aW5nc1NjaGVtYUlkLFxuXHRcdH07XG5cdFx0YWxsU2V0dGluZ3MucGF0dGVyblByb3BlcnRpZXNbT1ZFUlJJREVfUFJPUEVSVFlfUEFUVEVSTl0gPSByZXNvdXJjZUxhbmd1YWdlUHJvcGVydGllc1NjaGVtYTtcblx0XHRhcHBsaWNhdGlvblNldHRpbmdzLnBhdHRlcm5Qcm9wZXJ0aWVzW09WRVJSSURFX1BST1BFUlRZX1BBVFRFUk5dID0gcmVzb3VyY2VMYW5ndWFnZVByb3BlcnRpZXNTY2hlbWE7XG5cdFx0YXBwbGljYXRpb25NYWNoaW5lU2V0dGluZ3MucGF0dGVyblByb3BlcnRpZXNbT1ZFUlJJREVfUFJPUEVSVFlfUEFUVEVSTl0gPSByZXNvdXJjZUxhbmd1YWdlUHJvcGVydGllc1NjaGVtYTtcblx0XHRtYWNoaW5lU2V0dGluZ3MucGF0dGVyblByb3BlcnRpZXNbT1ZFUlJJREVfUFJPUEVSVFlfUEFUVEVSTl0gPSByZXNvdXJjZUxhbmd1YWdlUHJvcGVydGllc1NjaGVtYTtcblx0XHRtYWNoaW5lT3ZlcnJpZGFibGVTZXR0aW5ncy5wYXR0ZXJuUHJvcGVydGllc1tPVkVSUklERV9QUk9QRVJUWV9QQVRURVJOXSA9IHJlc291cmNlTGFuZ3VhZ2VQcm9wZXJ0aWVzU2NoZW1hO1xuXHRcdHdpbmRvd1NldHRpbmdzLnBhdHRlcm5Qcm9wZXJ0aWVzW09WRVJSSURFX1BST1BFUlRZX1BBVFRFUk5dID0gcmVzb3VyY2VMYW5ndWFnZVByb3BlcnRpZXNTY2hlbWE7XG5cdFx0cmVzb3VyY2VTZXR0aW5ncy5wYXR0ZXJuUHJvcGVydGllc1tPVkVSUklERV9QUk9QRVJUWV9QQVRURVJOXSA9IHJlc291cmNlTGFuZ3VhZ2VQcm9wZXJ0aWVzU2NoZW1hO1xuXHRcdHRoaXMuX29uRGlkU2NoZW1hQ2hhbmdlLmZpcmUoKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlUHJvcGVydHlEZWZhdWx0VmFsdWUoa2V5OiBzdHJpbmcsIHByb3BlcnR5OiBJUmVnaXN0ZXJlZENvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25kZWZhdWx0T3ZlcnJpZGUgPSB0aGlzLmNvbmZpZ3VyYXRpb25EZWZhdWx0c092ZXJyaWRlcy5nZXQoa2V5KT8uY29uZmlndXJhdGlvbkRlZmF1bHRPdmVycmlkZVZhbHVlO1xuXHRcdGxldCBkZWZhdWx0VmFsdWUgPSB1bmRlZmluZWQ7XG5cdFx0bGV0IGRlZmF1bHRTb3VyY2UgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKGNvbmZpZ3VyYXRpb25kZWZhdWx0T3ZlcnJpZGVcblx0XHRcdCYmICghcHJvcGVydHkuZGlzYWxsb3dDb25maWd1cmF0aW9uRGVmYXVsdCB8fCAhY29uZmlndXJhdGlvbmRlZmF1bHRPdmVycmlkZS5zb3VyY2UpIC8vIFByZXZlbnQgb3ZlcnJpZGluZyB0aGUgZGVmYXVsdCB2YWx1ZSBpZiB0aGUgcHJvcGVydHkgaXMgZGlzYWxsb3dlZCB0byBiZSBvdmVycmlkZGVuIGJ5IGNvbmZpZ3VyYXRpb24gZGVmYXVsdHMgZnJvbSBleHRlbnNpb25zXG5cdFx0KSB7XG5cdFx0XHRkZWZhdWx0VmFsdWUgPSBjb25maWd1cmF0aW9uZGVmYXVsdE92ZXJyaWRlLnZhbHVlO1xuXHRcdFx0ZGVmYXVsdFNvdXJjZSA9IGNvbmZpZ3VyYXRpb25kZWZhdWx0T3ZlcnJpZGUuc291cmNlO1xuXHRcdH1cblx0XHRpZiAodHlwZXMuaXNVbmRlZmluZWQoZGVmYXVsdFZhbHVlKSkge1xuXHRcdFx0ZGVmYXVsdFZhbHVlID0gcHJvcGVydHkuZGVmYXVsdERlZmF1bHRWYWx1ZTtcblx0XHRcdGRlZmF1bHRTb3VyY2UgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmICh0eXBlcy5pc1VuZGVmaW5lZChkZWZhdWx0VmFsdWUpKSB7XG5cdFx0XHRkZWZhdWx0VmFsdWUgPSBnZXREZWZhdWx0VmFsdWUocHJvcGVydHkudHlwZSk7XG5cdFx0fVxuXHRcdHByb3BlcnR5LmRlZmF1bHQgPSBkZWZhdWx0VmFsdWU7XG5cdFx0cHJvcGVydHkuZGVmYXVsdFZhbHVlU291cmNlID0gZGVmYXVsdFNvdXJjZTtcblx0fVxufVxuXG5jb25zdCBPVkVSUklERV9JREVOVElGSUVSX1BBVFRFUk4gPSBgXFxcXFsoW15cXFxcXV0rKVxcXFxdYDtcbmNvbnN0IE9WRVJSSURFX0lERU5USUZJRVJfUkVHRVggPSBuZXcgUmVnRXhwKE9WRVJSSURFX0lERU5USUZJRVJfUEFUVEVSTiwgJ2cnKTtcbmV4cG9ydCBjb25zdCBPVkVSUklERV9QUk9QRVJUWV9QQVRURVJOID0gYF4oJHtPVkVSUklERV9JREVOVElGSUVSX1BBVFRFUk59KSskYDtcbmV4cG9ydCBjb25zdCBPVkVSUklERV9QUk9QRVJUWV9SRUdFWCA9IG5ldyBSZWdFeHAoT1ZFUlJJREVfUFJPUEVSVFlfUEFUVEVSTik7XG5cbmV4cG9ydCBmdW5jdGlvbiBvdmVycmlkZUlkZW50aWZpZXJzRnJvbUtleShrZXk6IHN0cmluZyk6IHN0cmluZ1tdIHtcblx0Y29uc3QgaWRlbnRpZmllcnM6IHN0cmluZ1tdID0gW107XG5cdGlmIChPVkVSUklERV9QUk9QRVJUWV9SRUdFWC50ZXN0KGtleSkpIHtcblx0XHRsZXQgbWF0Y2hlcyA9IE9WRVJSSURFX0lERU5USUZJRVJfUkVHRVguZXhlYyhrZXkpO1xuXHRcdHdoaWxlIChtYXRjaGVzPy5sZW5ndGgpIHtcblx0XHRcdGNvbnN0IGlkZW50aWZpZXIgPSBtYXRjaGVzWzFdLnRyaW0oKTtcblx0XHRcdGlmIChpZGVudGlmaWVyKSB7XG5cdFx0XHRcdGlkZW50aWZpZXJzLnB1c2goaWRlbnRpZmllcik7XG5cdFx0XHR9XG5cdFx0XHRtYXRjaGVzID0gT1ZFUlJJREVfSURFTlRJRklFUl9SRUdFWC5leGVjKGtleSk7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBkaXN0aW5jdChpZGVudGlmaWVycyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBrZXlGcm9tT3ZlcnJpZGVJZGVudGlmaWVycyhvdmVycmlkZUlkZW50aWZpZXJzOiBzdHJpbmdbXSk6IHN0cmluZyB7XG5cdHJldHVybiBvdmVycmlkZUlkZW50aWZpZXJzLnJlZHVjZSgocmVzdWx0LCBvdmVycmlkZUlkZW50aWZpZXIpID0+IGAke3Jlc3VsdH1bJHtvdmVycmlkZUlkZW50aWZpZXJ9XWAsICcnKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldERlZmF1bHRWYWx1ZSh0eXBlOiBzdHJpbmcgfCBzdHJpbmdbXSB8IHVuZGVmaW5lZCkge1xuXHRjb25zdCB0ID0gQXJyYXkuaXNBcnJheSh0eXBlKSA/ICg8c3RyaW5nW10+dHlwZSlbMF0gOiA8c3RyaW5nPnR5cGU7XG5cdHN3aXRjaCAodCkge1xuXHRcdGNhc2UgJ2Jvb2xlYW4nOlxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdGNhc2UgJ2ludGVnZXInOlxuXHRcdGNhc2UgJ251bWJlcic6XG5cdFx0XHRyZXR1cm4gMDtcblx0XHRjYXNlICdzdHJpbmcnOlxuXHRcdFx0cmV0dXJuICcnO1xuXHRcdGNhc2UgJ2FycmF5Jzpcblx0XHRcdHJldHVybiBbXTtcblx0XHRjYXNlICdvYmplY3QnOlxuXHRcdFx0cmV0dXJuIHt9O1xuXHRcdGRlZmF1bHQ6XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0fVxufVxuXG5jb25zdCBjb25maWd1cmF0aW9uUmVnaXN0cnkgPSBuZXcgQ29uZmlndXJhdGlvblJlZ2lzdHJ5KCk7XG5SZWdpc3RyeS5hZGQoRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uLCBjb25maWd1cmF0aW9uUmVnaXN0cnkpO1xuXG5leHBvcnQgZnVuY3Rpb24gdmFsaWRhdGVQcm9wZXJ0eShwcm9wZXJ0eTogc3RyaW5nLCBzY2hlbWE6IElSZWdpc3RlcmVkQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hKTogc3RyaW5nIHwgbnVsbCB7XG5cdGlmICghcHJvcGVydHkudHJpbSgpKSB7XG5cdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgnY29uZmlnLnByb3BlcnR5LmVtcHR5JywgXCJDYW5ub3QgcmVnaXN0ZXIgYW4gZW1wdHkgcHJvcGVydHlcIik7XG5cdH1cblx0aWYgKE9WRVJSSURFX1BST1BFUlRZX1JFR0VYLnRlc3QocHJvcGVydHkpKSB7XG5cdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgnY29uZmlnLnByb3BlcnR5Lmxhbmd1YWdlRGVmYXVsdCcsIFwiQ2Fubm90IHJlZ2lzdGVyICd7MH0nLiBUaGlzIG1hdGNoZXMgcHJvcGVydHkgcGF0dGVybiAnXFxcXFxcXFxbLipcXFxcXFxcXF0kJyBmb3IgZGVzY3JpYmluZyBsYW5ndWFnZSBzcGVjaWZpYyBlZGl0b3Igc2V0dGluZ3MuIFVzZSAnY29uZmlndXJhdGlvbkRlZmF1bHRzJyBjb250cmlidXRpb24uXCIsIHByb3BlcnR5KTtcblx0fVxuXHRpZiAoY29uZmlndXJhdGlvblJlZ2lzdHJ5LmdldENvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzKClbcHJvcGVydHldICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdjb25maWcucHJvcGVydHkuZHVwbGljYXRlJywgXCJDYW5ub3QgcmVnaXN0ZXIgJ3swfScuIFRoaXMgcHJvcGVydHkgaXMgYWxyZWFkeSByZWdpc3RlcmVkLlwiLCBwcm9wZXJ0eSk7XG5cdH1cblx0aWYgKHNjaGVtYS5wb2xpY3k/Lm5hbWUgJiYgY29uZmlndXJhdGlvblJlZ2lzdHJ5LmdldFBvbGljeUNvbmZpZ3VyYXRpb25zKCkuZ2V0KHNjaGVtYS5wb2xpY3k/Lm5hbWUpICE9PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdjb25maWcucG9saWN5LmR1cGxpY2F0ZScsIFwiQ2Fubm90IHJlZ2lzdGVyICd7MH0nLiBUaGUgYXNzb2NpYXRlZCBwb2xpY3kgezF9IGlzIGFscmVhZHkgcmVnaXN0ZXJlZCB3aXRoIHsyfS5cIiwgcHJvcGVydHksIHNjaGVtYS5wb2xpY3k/Lm5hbWUsIGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5nZXRQb2xpY3lDb25maWd1cmF0aW9ucygpLmdldChzY2hlbWEucG9saWN5Py5uYW1lKSk7XG5cdH1cblx0cmV0dXJuIG51bGw7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRTY29wZXMoKTogW3N0cmluZywgQ29uZmlndXJhdGlvblNjb3BlIHwgdW5kZWZpbmVkXVtdIHtcblx0Y29uc3Qgc2NvcGVzOiBbc3RyaW5nLCBDb25maWd1cmF0aW9uU2NvcGUgfCB1bmRlZmluZWRdW10gPSBbXTtcblx0Y29uc3QgY29uZmlndXJhdGlvblByb3BlcnRpZXMgPSBjb25maWd1cmF0aW9uUmVnaXN0cnkuZ2V0Q29uZmlndXJhdGlvblByb3BlcnRpZXMoKTtcblx0Zm9yIChjb25zdCBrZXkgb2YgT2JqZWN0LmtleXMoY29uZmlndXJhdGlvblByb3BlcnRpZXMpKSB7XG5cdFx0c2NvcGVzLnB1c2goW2tleSwgY29uZmlndXJhdGlvblByb3BlcnRpZXNba2V5XS5zY29wZV0pO1xuXHR9XG5cdHNjb3Blcy5wdXNoKFsnbGF1bmNoJywgQ29uZmlndXJhdGlvblNjb3BlLlJFU09VUkNFXSk7XG5cdHNjb3Blcy5wdXNoKFsndGFzaycsIENvbmZpZ3VyYXRpb25TY29wZS5SRVNPVVJDRV0pO1xuXHRyZXR1cm4gc2NvcGVzO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0QWxsQ29uZmlndXJhdGlvblByb3BlcnRpZXMoY29uZmlndXJhdGlvbk5vZGU6IElDb25maWd1cmF0aW9uTm9kZVtdKTogSVN0cmluZ0RpY3Rpb25hcnk8SVJlZ2lzdGVyZWRDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWE+IHtcblx0Y29uc3QgcmVzdWx0OiBJU3RyaW5nRGljdGlvbmFyeTxJUmVnaXN0ZXJlZENvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYT4gPSB7fTtcblx0Zm9yIChjb25zdCBjb25maWd1cmF0aW9uIG9mIGNvbmZpZ3VyYXRpb25Ob2RlKSB7XG5cdFx0Y29uc3QgcHJvcGVydGllcyA9IGNvbmZpZ3VyYXRpb24ucHJvcGVydGllcztcblx0XHRpZiAodHlwZXMuaXNPYmplY3QocHJvcGVydGllcykpIHtcblx0XHRcdGZvciAoY29uc3Qga2V5IGluIHByb3BlcnRpZXMpIHtcblx0XHRcdFx0cmVzdWx0W2tleV0gPSBwcm9wZXJ0aWVzW2tleV07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChjb25maWd1cmF0aW9uLmFsbE9mKSB7XG5cdFx0XHRPYmplY3QuYXNzaWduKHJlc3VsdCwgZ2V0QWxsQ29uZmlndXJhdGlvblByb3BlcnRpZXMoY29uZmlndXJhdGlvbi5hbGxPZikpO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcGFyc2VTY29wZShzY29wZTogc3RyaW5nKTogQ29uZmlndXJhdGlvblNjb3BlIHtcblx0c3dpdGNoIChzY29wZSkge1xuXHRcdGNhc2UgJ2FwcGxpY2F0aW9uJzpcblx0XHRcdHJldHVybiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT047XG5cdFx0Y2FzZSAnbWFjaGluZSc6XG5cdFx0XHRyZXR1cm4gQ29uZmlndXJhdGlvblNjb3BlLk1BQ0hJTkU7XG5cdFx0Y2FzZSAncmVzb3VyY2UnOlxuXHRcdFx0cmV0dXJuIENvbmZpZ3VyYXRpb25TY29wZS5SRVNPVVJDRTtcblx0XHRjYXNlICdtYWNoaW5lLW92ZXJyaWRhYmxlJzpcblx0XHRcdHJldHVybiBDb25maWd1cmF0aW9uU2NvcGUuTUFDSElORV9PVkVSUklEQUJMRTtcblx0XHRjYXNlICdsYW5ndWFnZS1vdmVycmlkYWJsZSc6XG5cdFx0XHRyZXR1cm4gQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFO1xuXHRcdGRlZmF1bHQ6XG5cdFx0XHRyZXR1cm4gQ29uZmlndXJhdGlvblNjb3BlLldJTkRPVztcblx0fVxufVxuIl0sCiAg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LFFBQVEsZ0JBQTJCLENBQUM7QUFDakQsU0FBTztBQUNSO0FBRU8sU0FBUyw4QkFBOEIsbUJBQW9HO0FBQ2pKLFFBQU0sU0FBb0UsQ0FBQztBQUMzRSxhQUFXLGlCQUFpQixtQkFBbUI7QUFDOUMsVUFBTSxhQUFhLGNBQWM7QUFDakMsUUFBSSxNQUFNLFNBQVMsVUFBVSxHQUFHO0FBQy9CLGlCQUFXLE9BQU8sWUFBWTtBQUM3QixlQUFPLEdBQUcsSUFBSSxXQUFXLEdBQUc7QUFBQSxNQUM3QjtBQUFBLElBQ0Q7QUFDQSxRQUFJLGNBQWMsT0FBTztBQUN4QixhQUFPLE9BQU8sUUFBUSw4QkFBOEIsY0FBYyxLQUFLLENBQUM7QUFBQSxJQUN6RTtBQUFBLEVBQ0Q7QUFDQSxTQUFPO0FBQ1I7QUFFTyxTQUFTLFdBQVcsT0FBbUM7QUFDN0QsVUFBUSxPQUFPO0FBQUEsSUFDZCxLQUFLO0FBQ0osYUFBTztBQUFBLElBQ1IsS0FBSztBQUNKLGFBQU87QUFBQSxJQUNSLEtBQUs7QUFDSixhQUFPO0FBQUEsSUFDUixLQUFLO0FBQ0osYUFBTztBQUFBLElBQ1IsS0FBSztBQUNKLGFBQU87QUFBQSxJQUNSO0FBQ0MsYUFBTztBQUFBLEVBQ1Q7QUFDRDsiLAogICJuYW1lcyI6IFsiRWRpdFByZXNlbnRhdGlvblR5cGVzIiwgIkNvbmZpZ3VyYXRpb25TY29wZSIsICJjb25maWd1cmF0aW9uIl0KfQo=
