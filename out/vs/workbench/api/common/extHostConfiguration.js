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
import { mixin, deepClone } from "../../../base/common/objects.js";
import { Emitter } from "../../../base/common/event.js";
import { IExtHostWorkspace } from "./extHostWorkspace.js";
import { MainContext } from "./extHost.protocol.js";
import { ConfigurationTarget as ExtHostConfigurationTarget } from "./extHostTypes.js";
import { ConfigurationTarget } from "../../../platform/configuration/common/configuration.js";
import { Configuration, ConfigurationChangeEvent } from "../../../platform/configuration/common/configurationModels.js";
import { ConfigurationScope, OVERRIDE_PROPERTY_REGEX } from "../../../platform/configuration/common/configurationRegistry.js";
import { isObject } from "../../../base/common/types.js";
import { Barrier } from "../../../base/common/async.js";
import { createDecorator } from "../../../platform/instantiation/common/instantiation.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { URI } from "../../../base/common/uri.js";
function lookUp(tree, key) {
  if (key) {
    const parts = key.split(".");
    let node = tree;
    for (let i = 0; node && i < parts.length; i++) {
      node = node[parts[i]];
    }
    return node;
  }
}
function isUri(thing) {
  return thing instanceof URI;
}
function isResourceLanguage(thing) {
  return thing && thing.uri instanceof URI && (thing.languageId && typeof thing.languageId === "string");
}
function isLanguage(thing) {
  return thing && !thing.uri && (thing.languageId && typeof thing.languageId === "string");
}
function isWorkspaceFolder(thing) {
  return thing && thing.uri instanceof URI && (!thing.name || typeof thing.name === "string") && (!thing.index || typeof thing.index === "number");
}
function scopeToOverrides(scope) {
  if (isUri(scope)) {
    return { resource: scope };
  }
  if (isResourceLanguage(scope)) {
    return { resource: scope.uri, overrideIdentifier: scope.languageId };
  }
  if (isLanguage(scope)) {
    return { overrideIdentifier: scope.languageId };
  }
  if (isWorkspaceFolder(scope)) {
    return { resource: scope.uri };
  }
  if (scope === null) {
    return { resource: null };
  }
  return void 0;
}
let ExtHostConfiguration = class {
  constructor(extHostRpc, extHostWorkspace, logService) {
    this._proxy = extHostRpc.getProxy(MainContext.MainThreadConfiguration);
    this._extHostWorkspace = extHostWorkspace;
    this._logService = logService;
    this._barrier = new Barrier();
    this._actual = null;
  }
  getConfigProvider() {
    return this._barrier.wait().then((_) => this._actual);
  }
  $initializeConfiguration(data) {
    this._actual = new ExtHostConfigProvider(this._proxy, this._extHostWorkspace, data, this._logService);
    this._barrier.open();
  }
  $acceptConfigurationChanged(data, change) {
    this.getConfigProvider().then((provider) => provider.$acceptConfigurationChanged(data, change));
  }
};
ExtHostConfiguration = __decorateClass([
  __decorateParam(0, IExtHostRpcService),
  __decorateParam(1, IExtHostWorkspace),
  __decorateParam(2, ILogService)
], ExtHostConfiguration);
class ExtHostConfigProvider {
  constructor(proxy, extHostWorkspace, data, logService) {
    this._onDidChangeConfiguration = new Emitter();
    this._proxy = proxy;
    this._logService = logService;
    this._extHostWorkspace = extHostWorkspace;
    this._configuration = Configuration.parse(data, logService);
    this._configurationScopes = this._toMap(data.configurationScopes);
  }
  get onDidChangeConfiguration() {
    return this._onDidChangeConfiguration && this._onDidChangeConfiguration.event;
  }
  $acceptConfigurationChanged(data, change) {
    const previous = { data: this._configuration.toData(), workspace: this._extHostWorkspace.workspace };
    this._configuration = Configuration.parse(data, this._logService);
    this._configurationScopes = this._toMap(data.configurationScopes);
    this._onDidChangeConfiguration.fire(this._toConfigurationChangeEvent(change, previous));
  }
  getConfiguration(section, scope, extensionDescription) {
    const overrides = scopeToOverrides(scope) || {};
    const config = this._toReadonlyValue(this._configuration.getValue(section, overrides, this._extHostWorkspace.workspace));
    if (section) {
      this._validateConfigurationAccess(section, overrides, extensionDescription?.identifier);
    }
    function parseConfigurationTarget(arg) {
      if (arg === void 0 || arg === null) {
        return null;
      }
      if (typeof arg === "boolean") {
        return arg ? ConfigurationTarget.USER : ConfigurationTarget.WORKSPACE;
      }
      switch (arg) {
        case ExtHostConfigurationTarget.Global:
          return ConfigurationTarget.USER;
        case ExtHostConfigurationTarget.Workspace:
          return ConfigurationTarget.WORKSPACE;
        case ExtHostConfigurationTarget.WorkspaceFolder:
          return ConfigurationTarget.WORKSPACE_FOLDER;
      }
    }
    const result = {
      has(key) {
        return typeof lookUp(config, key) !== "undefined";
      },
      get: (key, defaultValue) => {
        this._validateConfigurationAccess(section ? `${section}.${key}` : key, overrides, extensionDescription?.identifier);
        let result2 = lookUp(config, key);
        if (typeof result2 === "undefined") {
          result2 = defaultValue;
        } else {
          let clonedConfig = void 0;
          const cloneOnWriteProxy = (target, accessor) => {
            if (isObject(target)) {
              let clonedTarget = void 0;
              const cloneTarget = () => {
                clonedConfig = clonedConfig ? clonedConfig : deepClone(config);
                clonedTarget = clonedTarget ? clonedTarget : lookUp(clonedConfig, accessor);
              };
              return new Proxy(target, {
                get: (target2, property) => {
                  if (typeof property === "string" && property.toLowerCase() === "tojson") {
                    cloneTarget();
                    return () => clonedTarget;
                  }
                  if (clonedConfig) {
                    clonedTarget = clonedTarget ? clonedTarget : lookUp(clonedConfig, accessor);
                    return clonedTarget[property];
                  }
                  const result3 = target2[property];
                  if (typeof property === "string") {
                    return cloneOnWriteProxy(result3, `${accessor}.${property}`);
                  }
                  return result3;
                },
                set: (_target, property, value) => {
                  cloneTarget();
                  if (clonedTarget) {
                    clonedTarget[property] = value;
                  }
                  return true;
                },
                deleteProperty: (_target, property) => {
                  cloneTarget();
                  if (clonedTarget) {
                    delete clonedTarget[property];
                  }
                  return true;
                },
                defineProperty: (_target, property, descriptor) => {
                  cloneTarget();
                  if (clonedTarget) {
                    Object.defineProperty(clonedTarget, property, descriptor);
                  }
                  return true;
                }
              });
            }
            if (Array.isArray(target)) {
              return deepClone(target);
            }
            return target;
          };
          result2 = cloneOnWriteProxy(result2, key);
        }
        return result2;
      },
      update: (key, value, extHostConfigurationTarget, scopeToLanguage) => {
        key = section ? `${section}.${key}` : key;
        const target = parseConfigurationTarget(extHostConfigurationTarget);
        if (value !== void 0) {
          return this._proxy.$updateConfigurationOption(target, key, value, overrides, scopeToLanguage);
        } else {
          return this._proxy.$removeConfigurationOption(target, key, overrides, scopeToLanguage);
        }
      },
      inspect: (key) => {
        key = section ? `${section}.${key}` : key;
        const config2 = this._configuration.inspect(key, overrides, this._extHostWorkspace.workspace);
        if (config2) {
          return {
            key,
            defaultValue: deepClone(config2.policy?.value ?? config2.default?.value),
            globalLocalValue: deepClone(config2.userLocal?.value),
            globalRemoteValue: deepClone(config2.userRemote?.value),
            globalValue: deepClone(config2.user?.value ?? config2.application?.value),
            workspaceValue: deepClone(config2.workspace?.value),
            workspaceFolderValue: deepClone(config2.workspaceFolder?.value),
            defaultLanguageValue: deepClone(config2.default?.override),
            globalLocalLanguageValue: deepClone(config2.userLocal?.override),
            globalRemoteLanguageValue: deepClone(config2.userRemote?.override),
            globalLanguageValue: deepClone(config2.user?.override ?? config2.application?.override),
            workspaceLanguageValue: deepClone(config2.workspace?.override),
            workspaceFolderLanguageValue: deepClone(config2.workspaceFolder?.override),
            languageIds: deepClone(config2.overrideIdentifiers)
          };
        }
        return void 0;
      }
    };
    if (typeof config === "object") {
      mixin(result, config, false);
    }
    return Object.freeze(result);
  }
  _toReadonlyValue(result) {
    const readonlyProxy = (target) => {
      return isObject(target) ? new Proxy(target, {
        get: (target2, property) => readonlyProxy(target2[property]),
        set: (_target, property, _value) => {
          throw new Error(`TypeError: Cannot assign to read only property '${String(property)}' of object`);
        },
        deleteProperty: (_target, property) => {
          throw new Error(`TypeError: Cannot delete read only property '${String(property)}' of object`);
        },
        defineProperty: (_target, property) => {
          throw new Error(`TypeError: Cannot define property '${String(property)}' for a readonly object`);
        },
        setPrototypeOf: (_target) => {
          throw new Error(`TypeError: Cannot set prototype for a readonly object`);
        },
        isExtensible: () => false,
        preventExtensions: () => true
      }) : target;
    };
    return readonlyProxy(result);
  }
  _validateConfigurationAccess(key, overrides, extensionId) {
    const scope = OVERRIDE_PROPERTY_REGEX.test(key) ? ConfigurationScope.RESOURCE : this._configurationScopes.get(key);
    const extensionIdText = extensionId ? `[${extensionId.value}] ` : "";
    if (ConfigurationScope.RESOURCE === scope) {
      if (typeof overrides?.resource === "undefined") {
        this._logService.warn(`${extensionIdText}Accessing a resource scoped configuration without providing a resource is not expected. To get the effective value for '${key}', provide the URI of a resource or 'null' for any resource.`);
      }
      return;
    }
    if (ConfigurationScope.WINDOW === scope) {
      if (overrides?.resource) {
        this._logService.warn(`${extensionIdText}Accessing a window scoped configuration for a resource is not expected. To associate '${key}' to a resource, define its scope to 'resource' in configuration contributions in 'package.json'.`);
      }
      return;
    }
  }
  _toConfigurationChangeEvent(change, previous) {
    const event = new ConfigurationChangeEvent(change, previous, this._configuration, this._extHostWorkspace.workspace, this._logService);
    return Object.freeze({
      affectsConfiguration: (section, scope) => event.affectsConfiguration(section, scopeToOverrides(scope))
    });
  }
  _toMap(scopes) {
    return scopes.reduce((result, scope) => {
      result.set(scope[0], scope[1]);
      return result;
    }, /* @__PURE__ */ new Map());
  }
}
const IExtHostConfiguration = createDecorator("IExtHostConfiguration");
export {
  ExtHostConfigProvider,
  ExtHostConfiguration,
  IExtHostConfiguration
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0Q29uZmlndXJhdGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IG1peGluLCBkZWVwQ2xvbmUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCB7IEV2ZW50LCBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHR5cGUgKiBhcyB2c2NvZGUgZnJvbSAndnNjb2RlJztcbmltcG9ydCB7IEV4dEhvc3RXb3Jrc3BhY2UsIElFeHRIb3N0V29ya3NwYWNlIH0gZnJvbSAnLi9leHRIb3N0V29ya3NwYWNlLmpzJztcbmltcG9ydCB7IEV4dEhvc3RDb25maWd1cmF0aW9uU2hhcGUsIE1haW5UaHJlYWRDb25maWd1cmF0aW9uU2hhcGUsIElDb25maWd1cmF0aW9uSW5pdERhdGEsIE1haW5Db250ZXh0IH0gZnJvbSAnLi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25UYXJnZXQgYXMgRXh0SG9zdENvbmZpZ3VyYXRpb25UYXJnZXQgfSBmcm9tICcuL2V4dEhvc3RUeXBlcy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uVGFyZ2V0LCBJQ29uZmlndXJhdGlvbkNoYW5nZSwgSUNvbmZpZ3VyYXRpb25EYXRhLCBJQ29uZmlndXJhdGlvbk92ZXJyaWRlcyB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbiwgQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbk1vZGVscy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uU2NvcGUsIE9WRVJSSURFX1BST1BFUlRZX1JFR0VYIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGlzT2JqZWN0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciwgSUV4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBCYXJyaWVyIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdFJwY1NlcnZpY2UgfSBmcm9tICcuL2V4dEhvc3RScGNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgV29ya3NwYWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcblxuZnVuY3Rpb24gbG9va1VwKHRyZWU6IGFueSwga2V5OiBzdHJpbmcpIHtcblx0aWYgKGtleSkge1xuXHRcdGNvbnN0IHBhcnRzID0ga2V5LnNwbGl0KCcuJyk7XG5cdFx0bGV0IG5vZGUgPSB0cmVlO1xuXHRcdGZvciAobGV0IGkgPSAwOyBub2RlICYmIGkgPCBwYXJ0cy5sZW5ndGg7IGkrKykge1xuXHRcdFx0bm9kZSA9IG5vZGVbcGFydHNbaV1dO1xuXHRcdH1cblx0XHRyZXR1cm4gbm9kZTtcblx0fVxufVxuXG5leHBvcnQgdHlwZSBDb25maWd1cmF0aW9uSW5zcGVjdDxUPiA9IHtcblx0a2V5OiBzdHJpbmc7XG5cblx0ZGVmYXVsdFZhbHVlPzogVDtcblx0Z2xvYmFsTG9jYWxWYWx1ZT86IFQ7XG5cdGdsb2JhbFJlbW90ZVZhbHVlPzogVDtcblx0Z2xvYmFsVmFsdWU/OiBUO1xuXHR3b3Jrc3BhY2VWYWx1ZT86IFQ7XG5cdHdvcmtzcGFjZUZvbGRlclZhbHVlPzogVDtcblxuXHRkZWZhdWx0TGFuZ3VhZ2VWYWx1ZT86IFQ7XG5cdGdsb2JhbExvY2FsTGFuZ3VhZ2VWYWx1ZT86IFQ7XG5cdGdsb2JhbFJlbW90ZUxhbmd1YWdlVmFsdWU/OiBUO1xuXHRnbG9iYWxMYW5ndWFnZVZhbHVlPzogVDtcblx0d29ya3NwYWNlTGFuZ3VhZ2VWYWx1ZT86IFQ7XG5cdHdvcmtzcGFjZUZvbGRlckxhbmd1YWdlVmFsdWU/OiBUO1xuXG5cdGxhbmd1YWdlSWRzPzogc3RyaW5nW107XG59O1xuXG5mdW5jdGlvbiBpc1VyaSh0aGluZzogYW55KTogdGhpbmcgaXMgdnNjb2RlLlVyaSB7XG5cdHJldHVybiB0aGluZyBpbnN0YW5jZW9mIFVSSTtcbn1cblxuZnVuY3Rpb24gaXNSZXNvdXJjZUxhbmd1YWdlKHRoaW5nOiBhbnkpOiB0aGluZyBpcyB7IHVyaTogVVJJOyBsYW5ndWFnZUlkOiBzdHJpbmcgfSB7XG5cdHJldHVybiB0aGluZ1xuXHRcdCYmIHRoaW5nLnVyaSBpbnN0YW5jZW9mIFVSSVxuXHRcdCYmICh0aGluZy5sYW5ndWFnZUlkICYmIHR5cGVvZiB0aGluZy5sYW5ndWFnZUlkID09PSAnc3RyaW5nJyk7XG59XG5cbmZ1bmN0aW9uIGlzTGFuZ3VhZ2UodGhpbmc6IGFueSk6IHRoaW5nIGlzIHsgbGFuZ3VhZ2VJZDogc3RyaW5nIH0ge1xuXHRyZXR1cm4gdGhpbmdcblx0XHQmJiAhdGhpbmcudXJpXG5cdFx0JiYgKHRoaW5nLmxhbmd1YWdlSWQgJiYgdHlwZW9mIHRoaW5nLmxhbmd1YWdlSWQgPT09ICdzdHJpbmcnKTtcbn1cblxuZnVuY3Rpb24gaXNXb3Jrc3BhY2VGb2xkZXIodGhpbmc6IGFueSk6IHRoaW5nIGlzIHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXIge1xuXHRyZXR1cm4gdGhpbmdcblx0XHQmJiB0aGluZy51cmkgaW5zdGFuY2VvZiBVUklcblx0XHQmJiAoIXRoaW5nLm5hbWUgfHwgdHlwZW9mIHRoaW5nLm5hbWUgPT09ICdzdHJpbmcnKVxuXHRcdCYmICghdGhpbmcuaW5kZXggfHwgdHlwZW9mIHRoaW5nLmluZGV4ID09PSAnbnVtYmVyJyk7XG59XG5cbmZ1bmN0aW9uIHNjb3BlVG9PdmVycmlkZXMoc2NvcGU6IHZzY29kZS5Db25maWd1cmF0aW9uU2NvcGUgfCB1bmRlZmluZWQgfCBudWxsKTogSUNvbmZpZ3VyYXRpb25PdmVycmlkZXMgfCB1bmRlZmluZWQge1xuXHRpZiAoaXNVcmkoc2NvcGUpKSB7XG5cdFx0cmV0dXJuIHsgcmVzb3VyY2U6IHNjb3BlIH07XG5cdH1cblx0aWYgKGlzUmVzb3VyY2VMYW5ndWFnZShzY29wZSkpIHtcblx0XHRyZXR1cm4geyByZXNvdXJjZTogc2NvcGUudXJpLCBvdmVycmlkZUlkZW50aWZpZXI6IHNjb3BlLmxhbmd1YWdlSWQgfTtcblx0fVxuXHRpZiAoaXNMYW5ndWFnZShzY29wZSkpIHtcblx0XHRyZXR1cm4geyBvdmVycmlkZUlkZW50aWZpZXI6IHNjb3BlLmxhbmd1YWdlSWQgfTtcblx0fVxuXHRpZiAoaXNXb3Jrc3BhY2VGb2xkZXIoc2NvcGUpKSB7XG5cdFx0cmV0dXJuIHsgcmVzb3VyY2U6IHNjb3BlLnVyaSB9O1xuXHR9XG5cdGlmIChzY29wZSA9PT0gbnVsbCkge1xuXHRcdHJldHVybiB7IHJlc291cmNlOiBudWxsIH07XG5cdH1cblx0cmV0dXJuIHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGNsYXNzIEV4dEhvc3RDb25maWd1cmF0aW9uIGltcGxlbWVudHMgRXh0SG9zdENvbmZpZ3VyYXRpb25TaGFwZSB7XG5cblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBNYWluVGhyZWFkQ29uZmlndXJhdGlvblNoYXBlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZTtcblx0cHJpdmF0ZSByZWFkb25seSBfZXh0SG9zdFdvcmtzcGFjZTogRXh0SG9zdFdvcmtzcGFjZTtcblx0cHJpdmF0ZSByZWFkb25seSBfYmFycmllcjogQmFycmllcjtcblx0cHJpdmF0ZSBfYWN0dWFsOiBFeHRIb3N0Q29uZmlnUHJvdmlkZXIgfCBudWxsO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0SG9zdFJwY1NlcnZpY2UgZXh0SG9zdFJwYzogSUV4dEhvc3RScGNTZXJ2aWNlLFxuXHRcdEBJRXh0SG9zdFdvcmtzcGFjZSBleHRIb3N0V29ya3NwYWNlOiBJRXh0SG9zdFdvcmtzcGFjZSxcblx0XHRASUxvZ1NlcnZpY2UgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuX3Byb3h5ID0gZXh0SG9zdFJwYy5nZXRQcm94eShNYWluQ29udGV4dC5NYWluVGhyZWFkQ29uZmlndXJhdGlvbik7XG5cdFx0dGhpcy5fZXh0SG9zdFdvcmtzcGFjZSA9IGV4dEhvc3RXb3Jrc3BhY2U7XG5cdFx0dGhpcy5fbG9nU2VydmljZSA9IGxvZ1NlcnZpY2U7XG5cdFx0dGhpcy5fYmFycmllciA9IG5ldyBCYXJyaWVyKCk7XG5cdFx0dGhpcy5fYWN0dWFsID0gbnVsbDtcblx0fVxuXG5cdHB1YmxpYyBnZXRDb25maWdQcm92aWRlcigpOiBQcm9taXNlPEV4dEhvc3RDb25maWdQcm92aWRlcj4ge1xuXHRcdHJldHVybiB0aGlzLl9iYXJyaWVyLndhaXQoKS50aGVuKF8gPT4gdGhpcy5fYWN0dWFsISk7XG5cdH1cblxuXHQkaW5pdGlhbGl6ZUNvbmZpZ3VyYXRpb24oZGF0YTogSUNvbmZpZ3VyYXRpb25Jbml0RGF0YSk6IHZvaWQge1xuXHRcdHRoaXMuX2FjdHVhbCA9IG5ldyBFeHRIb3N0Q29uZmlnUHJvdmlkZXIodGhpcy5fcHJveHksIHRoaXMuX2V4dEhvc3RXb3Jrc3BhY2UsIGRhdGEsIHRoaXMuX2xvZ1NlcnZpY2UpO1xuXHRcdHRoaXMuX2JhcnJpZXIub3BlbigpO1xuXHR9XG5cblx0JGFjY2VwdENvbmZpZ3VyYXRpb25DaGFuZ2VkKGRhdGE6IElDb25maWd1cmF0aW9uSW5pdERhdGEsIGNoYW5nZTogSUNvbmZpZ3VyYXRpb25DaGFuZ2UpOiB2b2lkIHtcblx0XHR0aGlzLmdldENvbmZpZ1Byb3ZpZGVyKCkudGhlbihwcm92aWRlciA9PiBwcm92aWRlci4kYWNjZXB0Q29uZmlndXJhdGlvbkNoYW5nZWQoZGF0YSwgY2hhbmdlKSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4dEhvc3RDb25maWdQcm92aWRlciB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uID0gbmV3IEVtaXR0ZXI8dnNjb2RlLkNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudD4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcHJveHk6IE1haW5UaHJlYWRDb25maWd1cmF0aW9uU2hhcGU7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2V4dEhvc3RXb3Jrc3BhY2U6IEV4dEhvc3RXb3Jrc3BhY2U7XG5cdHByaXZhdGUgX2NvbmZpZ3VyYXRpb25TY29wZXM6IE1hcDxzdHJpbmcsIENvbmZpZ3VyYXRpb25TY29wZSB8IHVuZGVmaW5lZD47XG5cdHByaXZhdGUgX2NvbmZpZ3VyYXRpb246IENvbmZpZ3VyYXRpb247XG5cdHByaXZhdGUgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlO1xuXG5cdGNvbnN0cnVjdG9yKHByb3h5OiBNYWluVGhyZWFkQ29uZmlndXJhdGlvblNoYXBlLCBleHRIb3N0V29ya3NwYWNlOiBFeHRIb3N0V29ya3NwYWNlLCBkYXRhOiBJQ29uZmlndXJhdGlvbkluaXREYXRhLCBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSkge1xuXHRcdHRoaXMuX3Byb3h5ID0gcHJveHk7XG5cdFx0dGhpcy5fbG9nU2VydmljZSA9IGxvZ1NlcnZpY2U7XG5cdFx0dGhpcy5fZXh0SG9zdFdvcmtzcGFjZSA9IGV4dEhvc3RXb3Jrc3BhY2U7XG5cdFx0dGhpcy5fY29uZmlndXJhdGlvbiA9IENvbmZpZ3VyYXRpb24ucGFyc2UoZGF0YSwgbG9nU2VydmljZSk7XG5cdFx0dGhpcy5fY29uZmlndXJhdGlvblNjb3BlcyA9IHRoaXMuX3RvTWFwKGRhdGEuY29uZmlndXJhdGlvblNjb3Blcyk7XG5cdH1cblxuXHRnZXQgb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKCk6IEV2ZW50PHZzY29kZS5Db25maWd1cmF0aW9uQ2hhbmdlRXZlbnQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uICYmIHRoaXMuX29uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbi5ldmVudDtcblx0fVxuXG5cdCRhY2NlcHRDb25maWd1cmF0aW9uQ2hhbmdlZChkYXRhOiBJQ29uZmlndXJhdGlvbkluaXREYXRhLCBjaGFuZ2U6IElDb25maWd1cmF0aW9uQ2hhbmdlKSB7XG5cdFx0Y29uc3QgcHJldmlvdXMgPSB7IGRhdGE6IHRoaXMuX2NvbmZpZ3VyYXRpb24udG9EYXRhKCksIHdvcmtzcGFjZTogdGhpcy5fZXh0SG9zdFdvcmtzcGFjZS53b3Jrc3BhY2UgfTtcblx0XHR0aGlzLl9jb25maWd1cmF0aW9uID0gQ29uZmlndXJhdGlvbi5wYXJzZShkYXRhLCB0aGlzLl9sb2dTZXJ2aWNlKTtcblx0XHR0aGlzLl9jb25maWd1cmF0aW9uU2NvcGVzID0gdGhpcy5fdG9NYXAoZGF0YS5jb25maWd1cmF0aW9uU2NvcGVzKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24uZmlyZSh0aGlzLl90b0NvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudChjaGFuZ2UsIHByZXZpb3VzKSk7XG5cdH1cblxuXHRnZXRDb25maWd1cmF0aW9uKHNlY3Rpb24/OiBzdHJpbmcsIHNjb3BlPzogdnNjb2RlLkNvbmZpZ3VyYXRpb25TY29wZSB8IG51bGwsIGV4dGVuc2lvbkRlc2NyaXB0aW9uPzogSUV4dGVuc2lvbkRlc2NyaXB0aW9uKTogdnNjb2RlLldvcmtzcGFjZUNvbmZpZ3VyYXRpb24ge1xuXHRcdGNvbnN0IG92ZXJyaWRlcyA9IHNjb3BlVG9PdmVycmlkZXMoc2NvcGUpIHx8IHt9O1xuXHRcdGNvbnN0IGNvbmZpZyA9IHRoaXMuX3RvUmVhZG9ubHlWYWx1ZSh0aGlzLl9jb25maWd1cmF0aW9uLmdldFZhbHVlKHNlY3Rpb24sIG92ZXJyaWRlcywgdGhpcy5fZXh0SG9zdFdvcmtzcGFjZS53b3Jrc3BhY2UpKTtcblxuXHRcdGlmIChzZWN0aW9uKSB7XG5cdFx0XHR0aGlzLl92YWxpZGF0ZUNvbmZpZ3VyYXRpb25BY2Nlc3Moc2VjdGlvbiwgb3ZlcnJpZGVzLCBleHRlbnNpb25EZXNjcmlwdGlvbj8uaWRlbnRpZmllcik7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gcGFyc2VDb25maWd1cmF0aW9uVGFyZ2V0KGFyZzogYm9vbGVhbiB8IEV4dEhvc3RDb25maWd1cmF0aW9uVGFyZ2V0KTogQ29uZmlndXJhdGlvblRhcmdldCB8IG51bGwge1xuXHRcdFx0aWYgKGFyZyA9PT0gdW5kZWZpbmVkIHx8IGFyZyA9PT0gbnVsbCkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHRcdGlmICh0eXBlb2YgYXJnID09PSAnYm9vbGVhbicpIHtcblx0XHRcdFx0cmV0dXJuIGFyZyA/IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUiA6IENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFO1xuXHRcdFx0fVxuXG5cdFx0XHRzd2l0Y2ggKGFyZykge1xuXHRcdFx0XHRjYXNlIEV4dEhvc3RDb25maWd1cmF0aW9uVGFyZ2V0Lkdsb2JhbDogcmV0dXJuIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUjtcblx0XHRcdFx0Y2FzZSBFeHRIb3N0Q29uZmlndXJhdGlvblRhcmdldC5Xb3Jrc3BhY2U6IHJldHVybiBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRTtcblx0XHRcdFx0Y2FzZSBFeHRIb3N0Q29uZmlndXJhdGlvblRhcmdldC5Xb3Jrc3BhY2VGb2xkZXI6IHJldHVybiBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRV9GT0xERVI7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0OiB2c2NvZGUuV29ya3NwYWNlQ29uZmlndXJhdGlvbiA9IHtcblx0XHRcdGhhcyhrZXk6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdFx0XHRyZXR1cm4gdHlwZW9mIGxvb2tVcChjb25maWcsIGtleSkgIT09ICd1bmRlZmluZWQnO1xuXHRcdFx0fSxcblx0XHRcdGdldDogPFQ+KGtleTogc3RyaW5nLCBkZWZhdWx0VmFsdWU/OiBUKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3ZhbGlkYXRlQ29uZmlndXJhdGlvbkFjY2VzcyhzZWN0aW9uID8gYCR7c2VjdGlvbn0uJHtrZXl9YCA6IGtleSwgb3ZlcnJpZGVzLCBleHRlbnNpb25EZXNjcmlwdGlvbj8uaWRlbnRpZmllcik7XG5cdFx0XHRcdGxldCByZXN1bHQgPSBsb29rVXAoY29uZmlnLCBrZXkpO1xuXHRcdFx0XHRpZiAodHlwZW9mIHJlc3VsdCA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0XHRyZXN1bHQgPSBkZWZhdWx0VmFsdWU7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bGV0IGNsb25lZENvbmZpZzogYW55IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdGNvbnN0IGNsb25lT25Xcml0ZVByb3h5ID0gKHRhcmdldDogYW55LCBhY2Nlc3Nvcjogc3RyaW5nKTogYW55ID0+IHtcblx0XHRcdFx0XHRcdGlmIChpc09iamVjdCh0YXJnZXQpKSB7XG5cdFx0XHRcdFx0XHRcdGxldCBjbG9uZWRUYXJnZXQ6IGFueSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRcdFx0Y29uc3QgY2xvbmVUYXJnZXQgPSAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0Y2xvbmVkQ29uZmlnID0gY2xvbmVkQ29uZmlnID8gY2xvbmVkQ29uZmlnIDogZGVlcENsb25lKGNvbmZpZyk7XG5cdFx0XHRcdFx0XHRcdFx0Y2xvbmVkVGFyZ2V0ID0gY2xvbmVkVGFyZ2V0ID8gY2xvbmVkVGFyZ2V0IDogbG9va1VwKGNsb25lZENvbmZpZywgYWNjZXNzb3IpO1xuXHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gbmV3IFByb3h5KHRhcmdldCwge1xuXHRcdFx0XHRcdFx0XHRcdGdldDogKHRhcmdldDogYW55LCBwcm9wZXJ0eTogUHJvcGVydHlLZXkpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRcdGlmICh0eXBlb2YgcHJvcGVydHkgPT09ICdzdHJpbmcnICYmIHByb3BlcnR5LnRvTG93ZXJDYXNlKCkgPT09ICd0b2pzb24nKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNsb25lVGFyZ2V0KCk7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiAoKSA9PiBjbG9uZWRUYXJnZXQ7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoY2xvbmVkQ29uZmlnKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNsb25lZFRhcmdldCA9IGNsb25lZFRhcmdldCA/IGNsb25lZFRhcmdldCA6IGxvb2tVcChjbG9uZWRDb25maWcsIGFjY2Vzc29yKTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGNsb25lZFRhcmdldFtwcm9wZXJ0eV07XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSB0YXJnZXRbcHJvcGVydHldO1xuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKHR5cGVvZiBwcm9wZXJ0eSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGNsb25lT25Xcml0ZVByb3h5KHJlc3VsdCwgYCR7YWNjZXNzb3J9LiR7cHJvcGVydHl9YCk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0c2V0OiAoX3RhcmdldDogYW55LCBwcm9wZXJ0eTogUHJvcGVydHlLZXksIHZhbHVlOiBhbnkpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRcdGNsb25lVGFyZ2V0KCk7XG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAoY2xvbmVkVGFyZ2V0KSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNsb25lZFRhcmdldFtwcm9wZXJ0eV0gPSB2YWx1ZTtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0ZGVsZXRlUHJvcGVydHk6IChfdGFyZ2V0OiBhbnksIHByb3BlcnR5OiBQcm9wZXJ0eUtleSkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdFx0Y2xvbmVUYXJnZXQoKTtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChjbG9uZWRUYXJnZXQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0ZGVsZXRlIGNsb25lZFRhcmdldFtwcm9wZXJ0eV07XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdGRlZmluZVByb3BlcnR5OiAoX3RhcmdldDogYW55LCBwcm9wZXJ0eTogUHJvcGVydHlLZXksIGRlc2NyaXB0b3I6IGFueSkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdFx0Y2xvbmVUYXJnZXQoKTtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChjbG9uZWRUYXJnZXQpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KGNsb25lZFRhcmdldCwgcHJvcGVydHksIGRlc2NyaXB0b3IpO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KHRhcmdldCkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGRlZXBDbG9uZSh0YXJnZXQpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIHRhcmdldDtcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdHJlc3VsdCA9IGNsb25lT25Xcml0ZVByb3h5KHJlc3VsdCwga2V5KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fSxcblx0XHRcdHVwZGF0ZTogKGtleTogc3RyaW5nLCB2YWx1ZTogYW55LCBleHRIb3N0Q29uZmlndXJhdGlvblRhcmdldDogRXh0SG9zdENvbmZpZ3VyYXRpb25UYXJnZXQgfCBib29sZWFuLCBzY29wZVRvTGFuZ3VhZ2U/OiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdGtleSA9IHNlY3Rpb24gPyBgJHtzZWN0aW9ufS4ke2tleX1gIDoga2V5O1xuXHRcdFx0XHRjb25zdCB0YXJnZXQgPSBwYXJzZUNvbmZpZ3VyYXRpb25UYXJnZXQoZXh0SG9zdENvbmZpZ3VyYXRpb25UYXJnZXQpO1xuXHRcdFx0XHRpZiAodmFsdWUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLl9wcm94eS4kdXBkYXRlQ29uZmlndXJhdGlvbk9wdGlvbih0YXJnZXQsIGtleSwgdmFsdWUsIG92ZXJyaWRlcywgc2NvcGVUb0xhbmd1YWdlKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJHJlbW92ZUNvbmZpZ3VyYXRpb25PcHRpb24odGFyZ2V0LCBrZXksIG92ZXJyaWRlcywgc2NvcGVUb0xhbmd1YWdlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGluc3BlY3Q6IDxUPihrZXk6IHN0cmluZyk6IENvbmZpZ3VyYXRpb25JbnNwZWN0PFQ+IHwgdW5kZWZpbmVkID0+IHtcblx0XHRcdFx0a2V5ID0gc2VjdGlvbiA/IGAke3NlY3Rpb259LiR7a2V5fWAgOiBrZXk7XG5cdFx0XHRcdGNvbnN0IGNvbmZpZyA9IHRoaXMuX2NvbmZpZ3VyYXRpb24uaW5zcGVjdDxUPihrZXksIG92ZXJyaWRlcywgdGhpcy5fZXh0SG9zdFdvcmtzcGFjZS53b3Jrc3BhY2UpO1xuXHRcdFx0XHRpZiAoY29uZmlnKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGtleSxcblxuXHRcdFx0XHRcdFx0ZGVmYXVsdFZhbHVlOiBkZWVwQ2xvbmUoY29uZmlnLnBvbGljeT8udmFsdWUgPz8gY29uZmlnLmRlZmF1bHQ/LnZhbHVlKSxcblx0XHRcdFx0XHRcdGdsb2JhbExvY2FsVmFsdWU6IGRlZXBDbG9uZShjb25maWcudXNlckxvY2FsPy52YWx1ZSksXG5cdFx0XHRcdFx0XHRnbG9iYWxSZW1vdGVWYWx1ZTogZGVlcENsb25lKGNvbmZpZy51c2VyUmVtb3RlPy52YWx1ZSksXG5cdFx0XHRcdFx0XHRnbG9iYWxWYWx1ZTogZGVlcENsb25lKGNvbmZpZy51c2VyPy52YWx1ZSA/PyBjb25maWcuYXBwbGljYXRpb24/LnZhbHVlKSxcblx0XHRcdFx0XHRcdHdvcmtzcGFjZVZhbHVlOiBkZWVwQ2xvbmUoY29uZmlnLndvcmtzcGFjZT8udmFsdWUpLFxuXHRcdFx0XHRcdFx0d29ya3NwYWNlRm9sZGVyVmFsdWU6IGRlZXBDbG9uZShjb25maWcud29ya3NwYWNlRm9sZGVyPy52YWx1ZSksXG5cblx0XHRcdFx0XHRcdGRlZmF1bHRMYW5ndWFnZVZhbHVlOiBkZWVwQ2xvbmUoY29uZmlnLmRlZmF1bHQ/Lm92ZXJyaWRlKSxcblx0XHRcdFx0XHRcdGdsb2JhbExvY2FsTGFuZ3VhZ2VWYWx1ZTogZGVlcENsb25lKGNvbmZpZy51c2VyTG9jYWw/Lm92ZXJyaWRlKSxcblx0XHRcdFx0XHRcdGdsb2JhbFJlbW90ZUxhbmd1YWdlVmFsdWU6IGRlZXBDbG9uZShjb25maWcudXNlclJlbW90ZT8ub3ZlcnJpZGUpLFxuXHRcdFx0XHRcdFx0Z2xvYmFsTGFuZ3VhZ2VWYWx1ZTogZGVlcENsb25lKGNvbmZpZy51c2VyPy5vdmVycmlkZSA/PyBjb25maWcuYXBwbGljYXRpb24/Lm92ZXJyaWRlKSxcblx0XHRcdFx0XHRcdHdvcmtzcGFjZUxhbmd1YWdlVmFsdWU6IGRlZXBDbG9uZShjb25maWcud29ya3NwYWNlPy5vdmVycmlkZSksXG5cdFx0XHRcdFx0XHR3b3Jrc3BhY2VGb2xkZXJMYW5ndWFnZVZhbHVlOiBkZWVwQ2xvbmUoY29uZmlnLndvcmtzcGFjZUZvbGRlcj8ub3ZlcnJpZGUpLFxuXG5cdFx0XHRcdFx0XHRsYW5ndWFnZUlkczogZGVlcENsb25lKGNvbmZpZy5vdmVycmlkZUlkZW50aWZpZXJzKVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0aWYgKHR5cGVvZiBjb25maWcgPT09ICdvYmplY3QnKSB7XG5cdFx0XHRtaXhpbihyZXN1bHQsIGNvbmZpZywgZmFsc2UpO1xuXHRcdH1cblxuXHRcdHJldHVybiBPYmplY3QuZnJlZXplKHJlc3VsdCk7XG5cdH1cblxuXHRwcml2YXRlIF90b1JlYWRvbmx5VmFsdWUocmVzdWx0OiBhbnkpOiBhbnkge1xuXHRcdGNvbnN0IHJlYWRvbmx5UHJveHkgPSAodGFyZ2V0OiBhbnkpOiBhbnkgPT4ge1xuXHRcdFx0cmV0dXJuIGlzT2JqZWN0KHRhcmdldCkgP1xuXHRcdFx0XHRuZXcgUHJveHkodGFyZ2V0LCB7XG5cdFx0XHRcdFx0Z2V0OiAodGFyZ2V0OiBhbnksIHByb3BlcnR5OiBQcm9wZXJ0eUtleSkgPT4gcmVhZG9ubHlQcm94eSh0YXJnZXRbcHJvcGVydHldKSxcblx0XHRcdFx0XHRzZXQ6IChfdGFyZ2V0OiBhbnksIHByb3BlcnR5OiBQcm9wZXJ0eUtleSwgX3ZhbHVlOiBhbnkpID0+IHsgdGhyb3cgbmV3IEVycm9yKGBUeXBlRXJyb3I6IENhbm5vdCBhc3NpZ24gdG8gcmVhZCBvbmx5IHByb3BlcnR5ICcke1N0cmluZyhwcm9wZXJ0eSl9JyBvZiBvYmplY3RgKTsgfSxcblx0XHRcdFx0XHRkZWxldGVQcm9wZXJ0eTogKF90YXJnZXQ6IGFueSwgcHJvcGVydHk6IFByb3BlcnR5S2V5KSA9PiB7IHRocm93IG5ldyBFcnJvcihgVHlwZUVycm9yOiBDYW5ub3QgZGVsZXRlIHJlYWQgb25seSBwcm9wZXJ0eSAnJHtTdHJpbmcocHJvcGVydHkpfScgb2Ygb2JqZWN0YCk7IH0sXG5cdFx0XHRcdFx0ZGVmaW5lUHJvcGVydHk6IChfdGFyZ2V0OiBhbnksIHByb3BlcnR5OiBQcm9wZXJ0eUtleSkgPT4geyB0aHJvdyBuZXcgRXJyb3IoYFR5cGVFcnJvcjogQ2Fubm90IGRlZmluZSBwcm9wZXJ0eSAnJHtTdHJpbmcocHJvcGVydHkpfScgZm9yIGEgcmVhZG9ubHkgb2JqZWN0YCk7IH0sXG5cdFx0XHRcdFx0c2V0UHJvdG90eXBlT2Y6IChfdGFyZ2V0OiBhbnkpID0+IHsgdGhyb3cgbmV3IEVycm9yKGBUeXBlRXJyb3I6IENhbm5vdCBzZXQgcHJvdG90eXBlIGZvciBhIHJlYWRvbmx5IG9iamVjdGApOyB9LFxuXHRcdFx0XHRcdGlzRXh0ZW5zaWJsZTogKCkgPT4gZmFsc2UsXG5cdFx0XHRcdFx0cHJldmVudEV4dGVuc2lvbnM6ICgpID0+IHRydWVcblx0XHRcdFx0fSkgOiB0YXJnZXQ7XG5cdFx0fTtcblx0XHRyZXR1cm4gcmVhZG9ubHlQcm94eShyZXN1bHQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdmFsaWRhdGVDb25maWd1cmF0aW9uQWNjZXNzKGtleTogc3RyaW5nLCBvdmVycmlkZXM/OiBJQ29uZmlndXJhdGlvbk92ZXJyaWRlcywgZXh0ZW5zaW9uSWQ/OiBFeHRlbnNpb25JZGVudGlmaWVyKTogdm9pZCB7XG5cdFx0Y29uc3Qgc2NvcGUgPSBPVkVSUklERV9QUk9QRVJUWV9SRUdFWC50ZXN0KGtleSkgPyBDb25maWd1cmF0aW9uU2NvcGUuUkVTT1VSQ0UgOiB0aGlzLl9jb25maWd1cmF0aW9uU2NvcGVzLmdldChrZXkpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbklkVGV4dCA9IGV4dGVuc2lvbklkID8gYFske2V4dGVuc2lvbklkLnZhbHVlfV0gYCA6ICcnO1xuXHRcdGlmIChDb25maWd1cmF0aW9uU2NvcGUuUkVTT1VSQ0UgPT09IHNjb3BlKSB7XG5cdFx0XHRpZiAodHlwZW9mIG92ZXJyaWRlcz8ucmVzb3VyY2UgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybihgJHtleHRlbnNpb25JZFRleHR9QWNjZXNzaW5nIGEgcmVzb3VyY2Ugc2NvcGVkIGNvbmZpZ3VyYXRpb24gd2l0aG91dCBwcm92aWRpbmcgYSByZXNvdXJjZSBpcyBub3QgZXhwZWN0ZWQuIFRvIGdldCB0aGUgZWZmZWN0aXZlIHZhbHVlIGZvciAnJHtrZXl9JywgcHJvdmlkZSB0aGUgVVJJIG9mIGEgcmVzb3VyY2Ugb3IgJ251bGwnIGZvciBhbnkgcmVzb3VyY2UuYCk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChDb25maWd1cmF0aW9uU2NvcGUuV0lORE9XID09PSBzY29wZSkge1xuXHRcdFx0aWYgKG92ZXJyaWRlcz8ucmVzb3VyY2UpIHtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS53YXJuKGAke2V4dGVuc2lvbklkVGV4dH1BY2Nlc3NpbmcgYSB3aW5kb3cgc2NvcGVkIGNvbmZpZ3VyYXRpb24gZm9yIGEgcmVzb3VyY2UgaXMgbm90IGV4cGVjdGVkLiBUbyBhc3NvY2lhdGUgJyR7a2V5fScgdG8gYSByZXNvdXJjZSwgZGVmaW5lIGl0cyBzY29wZSB0byAncmVzb3VyY2UnIGluIGNvbmZpZ3VyYXRpb24gY29udHJpYnV0aW9ucyBpbiAncGFja2FnZS5qc29uJy5gKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF90b0NvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudChjaGFuZ2U6IElDb25maWd1cmF0aW9uQ2hhbmdlLCBwcmV2aW91czogeyBkYXRhOiBJQ29uZmlndXJhdGlvbkRhdGE7IHdvcmtzcGFjZTogV29ya3NwYWNlIHwgdW5kZWZpbmVkIH0pOiB2c2NvZGUuQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50IHtcblx0XHRjb25zdCBldmVudCA9IG5ldyBDb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQoY2hhbmdlLCBwcmV2aW91cywgdGhpcy5fY29uZmlndXJhdGlvbiwgdGhpcy5fZXh0SG9zdFdvcmtzcGFjZS53b3Jrc3BhY2UsIHRoaXMuX2xvZ1NlcnZpY2UpO1xuXHRcdHJldHVybiBPYmplY3QuZnJlZXplKHtcblx0XHRcdGFmZmVjdHNDb25maWd1cmF0aW9uOiAoc2VjdGlvbjogc3RyaW5nLCBzY29wZT86IHZzY29kZS5Db25maWd1cmF0aW9uU2NvcGUpID0+IGV2ZW50LmFmZmVjdHNDb25maWd1cmF0aW9uKHNlY3Rpb24sIHNjb3BlVG9PdmVycmlkZXMoc2NvcGUpKVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfdG9NYXAoc2NvcGVzOiBbc3RyaW5nLCBDb25maWd1cmF0aW9uU2NvcGUgfCB1bmRlZmluZWRdW10pOiBNYXA8c3RyaW5nLCBDb25maWd1cmF0aW9uU2NvcGUgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gc2NvcGVzLnJlZHVjZSgocmVzdWx0LCBzY29wZSkgPT4geyByZXN1bHQuc2V0KHNjb3BlWzBdLCBzY29wZVsxXSk7IHJldHVybiByZXN1bHQ7IH0sIG5ldyBNYXA8c3RyaW5nLCBDb25maWd1cmF0aW9uU2NvcGUgfCB1bmRlZmluZWQ+KCkpO1xuXHR9XG5cbn1cblxuZXhwb3J0IGNvbnN0IElFeHRIb3N0Q29uZmlndXJhdGlvbiA9IGNyZWF0ZURlY29yYXRvcjxJRXh0SG9zdENvbmZpZ3VyYXRpb24+KCdJRXh0SG9zdENvbmZpZ3VyYXRpb24nKTtcbmV4cG9ydCBpbnRlcmZhY2UgSUV4dEhvc3RDb25maWd1cmF0aW9uIGV4dGVuZHMgRXh0SG9zdENvbmZpZ3VyYXRpb24geyB9XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsT0FBTyxpQkFBaUI7QUFDakMsU0FBZ0IsZUFBZTtBQUUvQixTQUEyQix5QkFBeUI7QUFDcEQsU0FBMEYsbUJBQW1CO0FBQzdHLFNBQVMsdUJBQXVCLGtDQUFrQztBQUNsRSxTQUFTLDJCQUE4RjtBQUN2RyxTQUFTLGVBQWUsZ0NBQWdDO0FBQ3hELFNBQVMsb0JBQW9CLCtCQUErQjtBQUM1RCxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLGVBQWU7QUFDeEIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxtQkFBbUI7QUFFNUIsU0FBUyxXQUFXO0FBRXBCLFNBQVMsT0FBTyxNQUFXLEtBQWE7QUFDdkMsTUFBSSxLQUFLO0FBQ1IsVUFBTSxRQUFRLElBQUksTUFBTSxHQUFHO0FBQzNCLFFBQUksT0FBTztBQUNYLGFBQVMsSUFBSSxHQUFHLFFBQVEsSUFBSSxNQUFNLFFBQVEsS0FBSztBQUM5QyxhQUFPLEtBQUssTUFBTSxDQUFDLENBQUM7QUFBQSxJQUNyQjtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUFzQkEsU0FBUyxNQUFNLE9BQWlDO0FBQy9DLFNBQU8saUJBQWlCO0FBQ3pCO0FBRUEsU0FBUyxtQkFBbUIsT0FBdUQ7QUFDbEYsU0FBTyxTQUNILE1BQU0sZUFBZSxRQUNwQixNQUFNLGNBQWMsT0FBTyxNQUFNLGVBQWU7QUFDdEQ7QUFFQSxTQUFTLFdBQVcsT0FBNkM7QUFDaEUsU0FBTyxTQUNILENBQUMsTUFBTSxRQUNOLE1BQU0sY0FBYyxPQUFPLE1BQU0sZUFBZTtBQUN0RDtBQUVBLFNBQVMsa0JBQWtCLE9BQTZDO0FBQ3ZFLFNBQU8sU0FDSCxNQUFNLGVBQWUsUUFDcEIsQ0FBQyxNQUFNLFFBQVEsT0FBTyxNQUFNLFNBQVMsY0FDckMsQ0FBQyxNQUFNLFNBQVMsT0FBTyxNQUFNLFVBQVU7QUFDN0M7QUFFQSxTQUFTLGlCQUFpQixPQUEwRjtBQUNuSCxNQUFJLE1BQU0sS0FBSyxHQUFHO0FBQ2pCLFdBQU8sRUFBRSxVQUFVLE1BQU07QUFBQSxFQUMxQjtBQUNBLE1BQUksbUJBQW1CLEtBQUssR0FBRztBQUM5QixXQUFPLEVBQUUsVUFBVSxNQUFNLEtBQUssb0JBQW9CLE1BQU0sV0FBVztBQUFBLEVBQ3BFO0FBQ0EsTUFBSSxXQUFXLEtBQUssR0FBRztBQUN0QixXQUFPLEVBQUUsb0JBQW9CLE1BQU0sV0FBVztBQUFBLEVBQy9DO0FBQ0EsTUFBSSxrQkFBa0IsS0FBSyxHQUFHO0FBQzdCLFdBQU8sRUFBRSxVQUFVLE1BQU0sSUFBSTtBQUFBLEVBQzlCO0FBQ0EsTUFBSSxVQUFVLE1BQU07QUFDbkIsV0FBTyxFQUFFLFVBQVUsS0FBSztBQUFBLEVBQ3pCO0FBQ0EsU0FBTztBQUNSO0FBRU8sSUFBTSx1QkFBTixNQUFnRTtBQUFBLEVBVXRFLFlBQ3FCLFlBQ0Qsa0JBQ04sWUFDWjtBQUNELFNBQUssU0FBUyxXQUFXLFNBQVMsWUFBWSx1QkFBdUI7QUFDckUsU0FBSyxvQkFBb0I7QUFDekIsU0FBSyxjQUFjO0FBQ25CLFNBQUssV0FBVyxJQUFJLFFBQVE7QUFDNUIsU0FBSyxVQUFVO0FBQUEsRUFDaEI7QUFBQSxFQUVPLG9CQUFvRDtBQUMxRCxXQUFPLEtBQUssU0FBUyxLQUFLLEVBQUUsS0FBSyxPQUFLLEtBQUssT0FBUTtBQUFBLEVBQ3BEO0FBQUEsRUFFQSx5QkFBeUIsTUFBb0M7QUFDNUQsU0FBSyxVQUFVLElBQUksc0JBQXNCLEtBQUssUUFBUSxLQUFLLG1CQUFtQixNQUFNLEtBQUssV0FBVztBQUNwRyxTQUFLLFNBQVMsS0FBSztBQUFBLEVBQ3BCO0FBQUEsRUFFQSw0QkFBNEIsTUFBOEIsUUFBb0M7QUFDN0YsU0FBSyxrQkFBa0IsRUFBRSxLQUFLLGNBQVksU0FBUyw0QkFBNEIsTUFBTSxNQUFNLENBQUM7QUFBQSxFQUM3RjtBQUNEO0FBbENhLHVCQUFOO0FBQUEsRUFXSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FiVTtBQW9DTixNQUFNLHNCQUFzQjtBQUFBLEVBU2xDLFlBQVksT0FBcUMsa0JBQW9DLE1BQThCLFlBQXlCO0FBUDVJLFNBQWlCLDRCQUE0QixJQUFJLFFBQXlDO0FBUXpGLFNBQUssU0FBUztBQUNkLFNBQUssY0FBYztBQUNuQixTQUFLLG9CQUFvQjtBQUN6QixTQUFLLGlCQUFpQixjQUFjLE1BQU0sTUFBTSxVQUFVO0FBQzFELFNBQUssdUJBQXVCLEtBQUssT0FBTyxLQUFLLG1CQUFtQjtBQUFBLEVBQ2pFO0FBQUEsRUFFQSxJQUFJLDJCQUFtRTtBQUN0RSxXQUFPLEtBQUssNkJBQTZCLEtBQUssMEJBQTBCO0FBQUEsRUFDekU7QUFBQSxFQUVBLDRCQUE0QixNQUE4QixRQUE4QjtBQUN2RixVQUFNLFdBQVcsRUFBRSxNQUFNLEtBQUssZUFBZSxPQUFPLEdBQUcsV0FBVyxLQUFLLGtCQUFrQixVQUFVO0FBQ25HLFNBQUssaUJBQWlCLGNBQWMsTUFBTSxNQUFNLEtBQUssV0FBVztBQUNoRSxTQUFLLHVCQUF1QixLQUFLLE9BQU8sS0FBSyxtQkFBbUI7QUFDaEUsU0FBSywwQkFBMEIsS0FBSyxLQUFLLDRCQUE0QixRQUFRLFFBQVEsQ0FBQztBQUFBLEVBQ3ZGO0FBQUEsRUFFQSxpQkFBaUIsU0FBa0IsT0FBMEMsc0JBQTZFO0FBQ3pKLFVBQU0sWUFBWSxpQkFBaUIsS0FBSyxLQUFLLENBQUM7QUFDOUMsVUFBTSxTQUFTLEtBQUssaUJBQWlCLEtBQUssZUFBZSxTQUFTLFNBQVMsV0FBVyxLQUFLLGtCQUFrQixTQUFTLENBQUM7QUFFdkgsUUFBSSxTQUFTO0FBQ1osV0FBSyw2QkFBNkIsU0FBUyxXQUFXLHNCQUFzQixVQUFVO0FBQUEsSUFDdkY7QUFFQSxhQUFTLHlCQUF5QixLQUF1RTtBQUN4RyxVQUFJLFFBQVEsVUFBYSxRQUFRLE1BQU07QUFDdEMsZUFBTztBQUFBLE1BQ1I7QUFDQSxVQUFJLE9BQU8sUUFBUSxXQUFXO0FBQzdCLGVBQU8sTUFBTSxvQkFBb0IsT0FBTyxvQkFBb0I7QUFBQSxNQUM3RDtBQUVBLGNBQVEsS0FBSztBQUFBLFFBQ1osS0FBSywyQkFBMkI7QUFBUSxpQkFBTyxvQkFBb0I7QUFBQSxRQUNuRSxLQUFLLDJCQUEyQjtBQUFXLGlCQUFPLG9CQUFvQjtBQUFBLFFBQ3RFLEtBQUssMkJBQTJCO0FBQWlCLGlCQUFPLG9CQUFvQjtBQUFBLE1BQzdFO0FBQUEsSUFDRDtBQUVBLFVBQU0sU0FBd0M7QUFBQSxNQUM3QyxJQUFJLEtBQXNCO0FBQ3pCLGVBQU8sT0FBTyxPQUFPLFFBQVEsR0FBRyxNQUFNO0FBQUEsTUFDdkM7QUFBQSxNQUNBLEtBQUssQ0FBSSxLQUFhLGlCQUFxQjtBQUMxQyxhQUFLLDZCQUE2QixVQUFVLEdBQUcsT0FBTyxJQUFJLEdBQUcsS0FBSyxLQUFLLFdBQVcsc0JBQXNCLFVBQVU7QUFDbEgsWUFBSUEsVUFBUyxPQUFPLFFBQVEsR0FBRztBQUMvQixZQUFJLE9BQU9BLFlBQVcsYUFBYTtBQUNsQyxVQUFBQSxVQUFTO0FBQUEsUUFDVixPQUFPO0FBQ04sY0FBSSxlQUFnQztBQUNwQyxnQkFBTSxvQkFBb0IsQ0FBQyxRQUFhLGFBQTBCO0FBQ2pFLGdCQUFJLFNBQVMsTUFBTSxHQUFHO0FBQ3JCLGtCQUFJLGVBQWdDO0FBQ3BDLG9CQUFNLGNBQWMsTUFBTTtBQUN6QiwrQkFBZSxlQUFlLGVBQWUsVUFBVSxNQUFNO0FBQzdELCtCQUFlLGVBQWUsZUFBZSxPQUFPLGNBQWMsUUFBUTtBQUFBLGNBQzNFO0FBQ0EscUJBQU8sSUFBSSxNQUFNLFFBQVE7QUFBQSxnQkFDeEIsS0FBSyxDQUFDQyxTQUFhLGFBQTBCO0FBQzVDLHNCQUFJLE9BQU8sYUFBYSxZQUFZLFNBQVMsWUFBWSxNQUFNLFVBQVU7QUFDeEUsZ0NBQVk7QUFDWiwyQkFBTyxNQUFNO0FBQUEsa0JBQ2Q7QUFDQSxzQkFBSSxjQUFjO0FBQ2pCLG1DQUFlLGVBQWUsZUFBZSxPQUFPLGNBQWMsUUFBUTtBQUMxRSwyQkFBTyxhQUFhLFFBQVE7QUFBQSxrQkFDN0I7QUFDQSx3QkFBTUQsVUFBU0MsUUFBTyxRQUFRO0FBQzlCLHNCQUFJLE9BQU8sYUFBYSxVQUFVO0FBQ2pDLDJCQUFPLGtCQUFrQkQsU0FBUSxHQUFHLFFBQVEsSUFBSSxRQUFRLEVBQUU7QUFBQSxrQkFDM0Q7QUFDQSx5QkFBT0E7QUFBQSxnQkFDUjtBQUFBLGdCQUNBLEtBQUssQ0FBQyxTQUFjLFVBQXVCLFVBQWU7QUFDekQsOEJBQVk7QUFDWixzQkFBSSxjQUFjO0FBQ2pCLGlDQUFhLFFBQVEsSUFBSTtBQUFBLGtCQUMxQjtBQUNBLHlCQUFPO0FBQUEsZ0JBQ1I7QUFBQSxnQkFDQSxnQkFBZ0IsQ0FBQyxTQUFjLGFBQTBCO0FBQ3hELDhCQUFZO0FBQ1osc0JBQUksY0FBYztBQUNqQiwyQkFBTyxhQUFhLFFBQVE7QUFBQSxrQkFDN0I7QUFDQSx5QkFBTztBQUFBLGdCQUNSO0FBQUEsZ0JBQ0EsZ0JBQWdCLENBQUMsU0FBYyxVQUF1QixlQUFvQjtBQUN6RSw4QkFBWTtBQUNaLHNCQUFJLGNBQWM7QUFDakIsMkJBQU8sZUFBZSxjQUFjLFVBQVUsVUFBVTtBQUFBLGtCQUN6RDtBQUNBLHlCQUFPO0FBQUEsZ0JBQ1I7QUFBQSxjQUNELENBQUM7QUFBQSxZQUNGO0FBQ0EsZ0JBQUksTUFBTSxRQUFRLE1BQU0sR0FBRztBQUMxQixxQkFBTyxVQUFVLE1BQU07QUFBQSxZQUN4QjtBQUNBLG1CQUFPO0FBQUEsVUFDUjtBQUNBLFVBQUFBLFVBQVMsa0JBQWtCQSxTQUFRLEdBQUc7QUFBQSxRQUN2QztBQUNBLGVBQU9BO0FBQUEsTUFDUjtBQUFBLE1BQ0EsUUFBUSxDQUFDLEtBQWEsT0FBWSw0QkFBa0Usb0JBQThCO0FBQ2pJLGNBQU0sVUFBVSxHQUFHLE9BQU8sSUFBSSxHQUFHLEtBQUs7QUFDdEMsY0FBTSxTQUFTLHlCQUF5QiwwQkFBMEI7QUFDbEUsWUFBSSxVQUFVLFFBQVc7QUFDeEIsaUJBQU8sS0FBSyxPQUFPLDJCQUEyQixRQUFRLEtBQUssT0FBTyxXQUFXLGVBQWU7QUFBQSxRQUM3RixPQUFPO0FBQ04saUJBQU8sS0FBSyxPQUFPLDJCQUEyQixRQUFRLEtBQUssV0FBVyxlQUFlO0FBQUEsUUFDdEY7QUFBQSxNQUNEO0FBQUEsTUFDQSxTQUFTLENBQUksUUFBcUQ7QUFDakUsY0FBTSxVQUFVLEdBQUcsT0FBTyxJQUFJLEdBQUcsS0FBSztBQUN0QyxjQUFNRSxVQUFTLEtBQUssZUFBZSxRQUFXLEtBQUssV0FBVyxLQUFLLGtCQUFrQixTQUFTO0FBQzlGLFlBQUlBLFNBQVE7QUFDWCxpQkFBTztBQUFBLFlBQ047QUFBQSxZQUVBLGNBQWMsVUFBVUEsUUFBTyxRQUFRLFNBQVNBLFFBQU8sU0FBUyxLQUFLO0FBQUEsWUFDckUsa0JBQWtCLFVBQVVBLFFBQU8sV0FBVyxLQUFLO0FBQUEsWUFDbkQsbUJBQW1CLFVBQVVBLFFBQU8sWUFBWSxLQUFLO0FBQUEsWUFDckQsYUFBYSxVQUFVQSxRQUFPLE1BQU0sU0FBU0EsUUFBTyxhQUFhLEtBQUs7QUFBQSxZQUN0RSxnQkFBZ0IsVUFBVUEsUUFBTyxXQUFXLEtBQUs7QUFBQSxZQUNqRCxzQkFBc0IsVUFBVUEsUUFBTyxpQkFBaUIsS0FBSztBQUFBLFlBRTdELHNCQUFzQixVQUFVQSxRQUFPLFNBQVMsUUFBUTtBQUFBLFlBQ3hELDBCQUEwQixVQUFVQSxRQUFPLFdBQVcsUUFBUTtBQUFBLFlBQzlELDJCQUEyQixVQUFVQSxRQUFPLFlBQVksUUFBUTtBQUFBLFlBQ2hFLHFCQUFxQixVQUFVQSxRQUFPLE1BQU0sWUFBWUEsUUFBTyxhQUFhLFFBQVE7QUFBQSxZQUNwRix3QkFBd0IsVUFBVUEsUUFBTyxXQUFXLFFBQVE7QUFBQSxZQUM1RCw4QkFBOEIsVUFBVUEsUUFBTyxpQkFBaUIsUUFBUTtBQUFBLFlBRXhFLGFBQWEsVUFBVUEsUUFBTyxtQkFBbUI7QUFBQSxVQUNsRDtBQUFBLFFBQ0Q7QUFDQSxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFFQSxRQUFJLE9BQU8sV0FBVyxVQUFVO0FBQy9CLFlBQU0sUUFBUSxRQUFRLEtBQUs7QUFBQSxJQUM1QjtBQUVBLFdBQU8sT0FBTyxPQUFPLE1BQU07QUFBQSxFQUM1QjtBQUFBLEVBRVEsaUJBQWlCLFFBQWtCO0FBQzFDLFVBQU0sZ0JBQWdCLENBQUMsV0FBcUI7QUFDM0MsYUFBTyxTQUFTLE1BQU0sSUFDckIsSUFBSSxNQUFNLFFBQVE7QUFBQSxRQUNqQixLQUFLLENBQUNELFNBQWEsYUFBMEIsY0FBY0EsUUFBTyxRQUFRLENBQUM7QUFBQSxRQUMzRSxLQUFLLENBQUMsU0FBYyxVQUF1QixXQUFnQjtBQUFFLGdCQUFNLElBQUksTUFBTSxtREFBbUQsT0FBTyxRQUFRLENBQUMsYUFBYTtBQUFBLFFBQUc7QUFBQSxRQUNoSyxnQkFBZ0IsQ0FBQyxTQUFjLGFBQTBCO0FBQUUsZ0JBQU0sSUFBSSxNQUFNLGdEQUFnRCxPQUFPLFFBQVEsQ0FBQyxhQUFhO0FBQUEsUUFBRztBQUFBLFFBQzNKLGdCQUFnQixDQUFDLFNBQWMsYUFBMEI7QUFBRSxnQkFBTSxJQUFJLE1BQU0sc0NBQXNDLE9BQU8sUUFBUSxDQUFDLHlCQUF5QjtBQUFBLFFBQUc7QUFBQSxRQUM3SixnQkFBZ0IsQ0FBQyxZQUFpQjtBQUFFLGdCQUFNLElBQUksTUFBTSx1REFBdUQ7QUFBQSxRQUFHO0FBQUEsUUFDOUcsY0FBYyxNQUFNO0FBQUEsUUFDcEIsbUJBQW1CLE1BQU07QUFBQSxNQUMxQixDQUFDLElBQUk7QUFBQSxJQUNQO0FBQ0EsV0FBTyxjQUFjLE1BQU07QUFBQSxFQUM1QjtBQUFBLEVBRVEsNkJBQTZCLEtBQWEsV0FBcUMsYUFBeUM7QUFDL0gsVUFBTSxRQUFRLHdCQUF3QixLQUFLLEdBQUcsSUFBSSxtQkFBbUIsV0FBVyxLQUFLLHFCQUFxQixJQUFJLEdBQUc7QUFDakgsVUFBTSxrQkFBa0IsY0FBYyxJQUFJLFlBQVksS0FBSyxPQUFPO0FBQ2xFLFFBQUksbUJBQW1CLGFBQWEsT0FBTztBQUMxQyxVQUFJLE9BQU8sV0FBVyxhQUFhLGFBQWE7QUFDL0MsYUFBSyxZQUFZLEtBQUssR0FBRyxlQUFlLDJIQUEySCxHQUFHLDhEQUE4RDtBQUFBLE1BQ3JPO0FBQ0E7QUFBQSxJQUNEO0FBQ0EsUUFBSSxtQkFBbUIsV0FBVyxPQUFPO0FBQ3hDLFVBQUksV0FBVyxVQUFVO0FBQ3hCLGFBQUssWUFBWSxLQUFLLEdBQUcsZUFBZSx5RkFBeUYsR0FBRyxtR0FBbUc7QUFBQSxNQUN4TztBQUNBO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLDRCQUE0QixRQUE4QixVQUEyRztBQUM1SyxVQUFNLFFBQVEsSUFBSSx5QkFBeUIsUUFBUSxVQUFVLEtBQUssZ0JBQWdCLEtBQUssa0JBQWtCLFdBQVcsS0FBSyxXQUFXO0FBQ3BJLFdBQU8sT0FBTyxPQUFPO0FBQUEsTUFDcEIsc0JBQXNCLENBQUMsU0FBaUIsVUFBc0MsTUFBTSxxQkFBcUIsU0FBUyxpQkFBaUIsS0FBSyxDQUFDO0FBQUEsSUFDMUksQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVRLE9BQU8sUUFBaUc7QUFDL0csV0FBTyxPQUFPLE9BQU8sQ0FBQyxRQUFRLFVBQVU7QUFBRSxhQUFPLElBQUksTUFBTSxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUM7QUFBRyxhQUFPO0FBQUEsSUFBUSxHQUFHLG9CQUFJLElBQTRDLENBQUM7QUFBQSxFQUM5STtBQUVEO0FBRU8sTUFBTSx3QkFBd0IsZ0JBQXVDLHVCQUF1QjsiLAogICJuYW1lcyI6IFsicmVzdWx0IiwgInRhcmdldCIsICJjb25maWciXQp9Cg==
