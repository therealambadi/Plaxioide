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
import { PauseableEmitter } from "../../../base/common/event.js";
import { Iterable } from "../../../base/common/iterator.js";
import { Disposable, MutableDisposable } from "../../../base/common/lifecycle.js";
import { MarshalledId } from "../../../base/common/marshallingIds.js";
import { cloneAndChange, distinct } from "../../../base/common/objects.js";
import { TernarySearchTree } from "../../../base/common/ternarySearchTree.js";
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { CommandsRegistry } from "../../commands/common/commands.js";
import { ConfigurationTarget, IConfigurationService } from "../../configuration/common/configuration.js";
import { IContextKeyService, RawContextKey } from "../common/contextkey.js";
const KEYBINDING_CONTEXT_ATTR = "data-keybinding-context";
class Context {
  constructor(id, parent) {
    this._id = id;
    this._parent = parent;
    this._value = /* @__PURE__ */ Object.create(null);
    this._value["_contextId"] = id;
  }
  get value() {
    return { ...this._value };
  }
  setValue(key, value) {
    if (this._value[key] !== value) {
      this._value[key] = value;
      return true;
    }
    return false;
  }
  removeValue(key) {
    if (key in this._value) {
      delete this._value[key];
      return true;
    }
    return false;
  }
  getValue(key) {
    const ret = this._value[key];
    if (typeof ret === "undefined" && this._parent) {
      return this._parent.getValue(key);
    }
    return ret;
  }
  updateParent(parent) {
    this._parent = parent;
  }
  collectAllValues() {
    let result = this._parent ? this._parent.collectAllValues() : /* @__PURE__ */ Object.create(null);
    result = { ...result, ...this._value };
    delete result["_contextId"];
    return result;
  }
}
const _NullContext = class _NullContext extends Context {
  constructor() {
    super(-1, null);
  }
  setValue(key, value) {
    return false;
  }
  removeValue(key) {
    return false;
  }
  getValue(key) {
    return void 0;
  }
  collectAllValues() {
    return /* @__PURE__ */ Object.create(null);
  }
};
_NullContext.INSTANCE = new _NullContext();
let NullContext = _NullContext;
const _ConfigAwareContextValuesContainer = class _ConfigAwareContextValuesContainer extends Context {
  constructor(id, _configurationService, emitter) {
    super(id, null);
    this._configurationService = _configurationService;
    this._values = TernarySearchTree.forConfigKeys();
    this._listener = this._configurationService.onDidChangeConfiguration((event) => {
      if (event.source === ConfigurationTarget.DEFAULT) {
        const allKeys = Array.from(this._values, ([k]) => k);
        this._values.clear();
        emitter.fire(new ArrayContextKeyChangeEvent(allKeys));
      } else {
        const changedKeys = [];
        for (const configKey of event.affectedKeys) {
          const contextKey = `config.${configKey}`;
          const cachedItems = this._values.findSuperstr(contextKey);
          if (cachedItems !== void 0) {
            changedKeys.push(...Iterable.map(cachedItems, ([key]) => key));
            this._values.deleteSuperstr(contextKey);
          }
          if (this._values.has(contextKey)) {
            changedKeys.push(contextKey);
            this._values.delete(contextKey);
          }
        }
        emitter.fire(new ArrayContextKeyChangeEvent(changedKeys));
      }
    });
  }
  dispose() {
    this._listener.dispose();
  }
  getValue(key) {
    if (key.indexOf(_ConfigAwareContextValuesContainer._keyPrefix) !== 0) {
      return super.getValue(key);
    }
    if (this._values.has(key)) {
      return this._values.get(key);
    }
    const configKey = key.substr(_ConfigAwareContextValuesContainer._keyPrefix.length);
    const configValue = this._configurationService.getValue(configKey);
    let value = void 0;
    switch (typeof configValue) {
      case "number":
      case "boolean":
      case "string":
        value = configValue;
        break;
      default:
        if (Array.isArray(configValue)) {
          value = JSON.stringify(configValue);
        } else {
          value = configValue;
        }
    }
    this._values.set(key, value);
    return value;
  }
  setValue(key, value) {
    return super.setValue(key, value);
  }
  removeValue(key) {
    return super.removeValue(key);
  }
  collectAllValues() {
    const result = /* @__PURE__ */ Object.create(null);
    this._values.forEach((value, index) => result[index] = value);
    return { ...result, ...super.collectAllValues() };
  }
};
_ConfigAwareContextValuesContainer._keyPrefix = "config.";
let ConfigAwareContextValuesContainer = _ConfigAwareContextValuesContainer;
class ContextKey {
  constructor(service, key, defaultValue) {
    this._service = service;
    this._key = key;
    this._defaultValue = defaultValue;
    this.reset();
  }
  set(value) {
    this._service.setContext(this._key, value);
  }
  reset() {
    if (typeof this._defaultValue === "undefined") {
      this._service.removeContext(this._key);
    } else {
      this._service.setContext(this._key, this._defaultValue);
    }
  }
  get() {
    return this._service.getContextKeyValue(this._key);
  }
}
class SimpleContextKeyChangeEvent {
  constructor(key) {
    this.key = key;
  }
  affectsSome(keys) {
    return keys.has(this.key);
  }
  allKeysContainedIn(keys) {
    return this.affectsSome(keys);
  }
}
class ArrayContextKeyChangeEvent {
  constructor(keys) {
    this.keys = keys;
  }
  affectsSome(keys) {
    for (const key of this.keys) {
      if (keys.has(key)) {
        return true;
      }
    }
    return false;
  }
  allKeysContainedIn(keys) {
    return this.keys.every((key) => keys.has(key));
  }
}
class CompositeContextKeyChangeEvent {
  constructor(events) {
    this.events = events;
  }
  affectsSome(keys) {
    for (const e of this.events) {
      if (e.affectsSome(keys)) {
        return true;
      }
    }
    return false;
  }
  allKeysContainedIn(keys) {
    return this.events.every((evt) => evt.allKeysContainedIn(keys));
  }
}
function allEventKeysInContext(event, context) {
  return event.allKeysContainedIn(new Set(Object.keys(context)));
}
class AbstractContextKeyService extends Disposable {
  constructor(myContextId) {
    super();
    this._onDidChangeContext = this._register(new PauseableEmitter({ merge: (input) => new CompositeContextKeyChangeEvent(input) }));
    this.onDidChangeContext = this._onDidChangeContext.event;
    this._isDisposed = false;
    this._myContextId = myContextId;
  }
  get contextId() {
    return this._myContextId;
  }
  createKey(key, defaultValue) {
    if (this._isDisposed) {
      throw new Error(`AbstractContextKeyService has been disposed`);
    }
    return new ContextKey(this, key, defaultValue);
  }
  bufferChangeEvents(callback) {
    this._onDidChangeContext.pause();
    try {
      callback();
    } finally {
      this._onDidChangeContext.resume();
    }
  }
  createScoped(domNode) {
    if (this._isDisposed) {
      throw new Error(`AbstractContextKeyService has been disposed`);
    }
    return new ScopedContextKeyService(this, domNode);
  }
  createOverlay(overlay = Iterable.empty()) {
    if (this._isDisposed) {
      throw new Error(`AbstractContextKeyService has been disposed`);
    }
    return new OverlayContextKeyService(this, overlay);
  }
  contextMatchesRules(rules) {
    if (this._isDisposed) {
      throw new Error(`AbstractContextKeyService has been disposed`);
    }
    const context = this.getContextValuesContainer(this._myContextId);
    const result = rules ? rules.evaluate(context) : true;
    return result;
  }
  getContextKeyValue(key) {
    if (this._isDisposed) {
      return void 0;
    }
    return this.getContextValuesContainer(this._myContextId).getValue(key);
  }
  setContext(key, value) {
    if (this._isDisposed) {
      return;
    }
    const myContext = this.getContextValuesContainer(this._myContextId);
    if (!myContext) {
      return;
    }
    if (myContext.setValue(key, value)) {
      this._onDidChangeContext.fire(new SimpleContextKeyChangeEvent(key));
    }
  }
  removeContext(key) {
    if (this._isDisposed) {
      return;
    }
    if (this.getContextValuesContainer(this._myContextId).removeValue(key)) {
      this._onDidChangeContext.fire(new SimpleContextKeyChangeEvent(key));
    }
  }
  getContext(target) {
    if (this._isDisposed) {
      return NullContext.INSTANCE;
    }
    return this.getContextValuesContainer(findContextAttr(target));
  }
  dispose() {
    super.dispose();
    this._isDisposed = true;
  }
}
let ContextKeyService = class extends AbstractContextKeyService {
  constructor(configurationService) {
    super(0);
    this._contexts = /* @__PURE__ */ new Map();
    this._lastContextId = 0;
    const myContext = this._register(new ConfigAwareContextValuesContainer(this._myContextId, configurationService, this._onDidChangeContext));
    this._contexts.set(this._myContextId, myContext);
  }
  getContextValuesContainer(contextId) {
    if (this._isDisposed) {
      return NullContext.INSTANCE;
    }
    return this._contexts.get(contextId) || NullContext.INSTANCE;
  }
  createChildContext(parentContextId = this._myContextId) {
    if (this._isDisposed) {
      throw new Error(`ContextKeyService has been disposed`);
    }
    const id = ++this._lastContextId;
    this._contexts.set(id, new Context(id, this.getContextValuesContainer(parentContextId)));
    return id;
  }
  disposeContext(contextId) {
    if (!this._isDisposed) {
      this._contexts.delete(contextId);
    }
  }
  updateParent(_parentContextKeyService) {
    throw new Error("Cannot update parent of root ContextKeyService");
  }
};
ContextKeyService = __decorateClass([
  __decorateParam(0, IConfigurationService)
], ContextKeyService);
class ScopedContextKeyService extends AbstractContextKeyService {
  constructor(parent, domNode) {
    super(parent.createChildContext());
    this._parentChangeListener = this._register(new MutableDisposable());
    this._parent = parent;
    this._updateParentChangeListener();
    this._domNode = domNode;
    if (this._domNode.hasAttribute(KEYBINDING_CONTEXT_ATTR)) {
      let extraInfo = "";
      if (this._domNode.classList) {
        extraInfo = Array.from(this._domNode.classList.values()).join(", ");
      }
      console.error(`Element already has context attribute${extraInfo ? ": " + extraInfo : ""}`);
    }
    this._domNode.setAttribute(KEYBINDING_CONTEXT_ATTR, String(this._myContextId));
  }
  _updateParentChangeListener() {
    this._parentChangeListener.value = this._parent.onDidChangeContext((e) => {
      const thisContainer = this._parent.getContextValuesContainer(this._myContextId);
      const thisContextValues = thisContainer.value;
      if (!allEventKeysInContext(e, thisContextValues)) {
        this._onDidChangeContext.fire(e);
      }
    });
  }
  dispose() {
    if (this._isDisposed) {
      return;
    }
    this._parent.disposeContext(this._myContextId);
    this._domNode.removeAttribute(KEYBINDING_CONTEXT_ATTR);
    super.dispose();
  }
  getContextValuesContainer(contextId) {
    if (this._isDisposed) {
      return NullContext.INSTANCE;
    }
    return this._parent.getContextValuesContainer(contextId);
  }
  createChildContext(parentContextId = this._myContextId) {
    if (this._isDisposed) {
      throw new Error(`ScopedContextKeyService has been disposed`);
    }
    return this._parent.createChildContext(parentContextId);
  }
  disposeContext(contextId) {
    if (this._isDisposed) {
      return;
    }
    this._parent.disposeContext(contextId);
  }
  updateParent(parentContextKeyService) {
    if (this._parent === parentContextKeyService) {
      return;
    }
    const thisContainer = this._parent.getContextValuesContainer(this._myContextId);
    const oldAllValues = thisContainer.collectAllValues();
    this._parent = parentContextKeyService;
    this._updateParentChangeListener();
    const newParentContainer = this._parent.getContextValuesContainer(this._parent.contextId);
    thisContainer.updateParent(newParentContainer);
    const newAllValues = thisContainer.collectAllValues();
    const allValuesDiff = {
      ...distinct(oldAllValues, newAllValues),
      ...distinct(newAllValues, oldAllValues)
    };
    const changedKeys = Object.keys(allValuesDiff);
    this._onDidChangeContext.fire(new ArrayContextKeyChangeEvent(changedKeys));
  }
}
class OverlayContext {
  constructor(parent, overlay) {
    this.parent = parent;
    this.overlay = overlay;
  }
  getValue(key) {
    return this.overlay.has(key) ? this.overlay.get(key) : this.parent.getValue(key);
  }
}
class OverlayContextKeyService {
  constructor(parent, overlay) {
    this.parent = parent;
    this.overlay = new Map(overlay);
  }
  get contextId() {
    return this.parent.contextId;
  }
  get onDidChangeContext() {
    return this.parent.onDidChangeContext;
  }
  bufferChangeEvents(callback) {
    this.parent.bufferChangeEvents(callback);
  }
  createKey() {
    throw new Error("Not supported.");
  }
  getContext(target) {
    return new OverlayContext(this.parent.getContext(target), this.overlay);
  }
  getContextValuesContainer(contextId) {
    const parentContext = this.parent.getContextValuesContainer(contextId);
    return new OverlayContext(parentContext, this.overlay);
  }
  contextMatchesRules(rules) {
    const context = this.getContextValuesContainer(this.contextId);
    const result = rules ? rules.evaluate(context) : true;
    return result;
  }
  getContextKeyValue(key) {
    return this.overlay.has(key) ? this.overlay.get(key) : this.parent.getContextKeyValue(key);
  }
  createScoped() {
    throw new Error("Not supported.");
  }
  createOverlay(overlay = Iterable.empty()) {
    return new OverlayContextKeyService(this, overlay);
  }
  updateParent() {
    throw new Error("Not supported.");
  }
}
function findContextAttr(domNode) {
  while (domNode) {
    if (domNode.hasAttribute(KEYBINDING_CONTEXT_ATTR)) {
      const attr = domNode.getAttribute(KEYBINDING_CONTEXT_ATTR);
      if (attr) {
        return parseInt(attr, 10);
      }
      return NaN;
    }
    domNode = domNode.parentElement;
  }
  return 0;
}
function setContext(accessor, contextKey, contextValue) {
  const contextKeyService = accessor.get(IContextKeyService);
  contextKeyService.createKey(String(contextKey), stringifyURIs(contextValue));
}
function stringifyURIs(contextValue) {
  return cloneAndChange(contextValue, (obj) => {
    if (typeof obj === "object" && obj.$mid === MarshalledId.Uri) {
      return URI.revive(obj).toString();
    }
    if (obj instanceof URI) {
      return obj.toString();
    }
    return void 0;
  });
}
CommandsRegistry.registerCommand("_setContext", setContext);
CommandsRegistry.registerCommand({
  id: "getContextKeyInfo",
  handler() {
    return [...RawContextKey.all()].sort((a, b) => a.key.localeCompare(b.key));
  },
  metadata: {
    description: localize("getContextKeyInfo", "A command that returns information about context keys"),
    args: []
  }
});
CommandsRegistry.registerCommand("_generateContextKeyInfo", function() {
  const result = [];
  const seen = /* @__PURE__ */ new Set();
  for (const info of RawContextKey.all()) {
    if (!seen.has(info.key)) {
      seen.add(info.key);
      result.push(info);
    }
  }
  result.sort((a, b) => a.key.localeCompare(b.key));
  console.log(JSON.stringify(result, void 0, 2));
});
export {
  AbstractContextKeyService,
  Context,
  ContextKeyService,
  setContext
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9jb250ZXh0a2V5L2Jyb3dzZXIvY29udGV4dEtleVNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCwgUGF1c2VhYmxlRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IE1hcnNoYWxsZWRPYmplY3QgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZy5qcyc7XG5pbXBvcnQgeyBNYXJzaGFsbGVkSWQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZ0lkcy5qcyc7XG5pbXBvcnQgeyBjbG9uZUFuZENoYW5nZSwgZGlzdGluY3QgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCB7IFRlcm5hcnlTZWFyY2hUcmVlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdGVybmFyeVNlYXJjaFRyZWUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENvbW1hbmRzUmVnaXN0cnkgfSBmcm9tICcuLi8uLi9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblRhcmdldCwgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwcmVzc2lvbiwgQ29udGV4dEtleUluZm8sIENvbnRleHRLZXlWYWx1ZSwgSUNvbnRleHQsIElDb250ZXh0S2V5LCBJQ29udGV4dEtleUNoYW5nZUV2ZW50LCBJQ29udGV4dEtleVNlcnZpY2UsIElDb250ZXh0S2V5U2VydmljZVRhcmdldCwgSVJlYWRhYmxlU2V0LCBJU2NvcGVkQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5cbmNvbnN0IEtFWUJJTkRJTkdfQ09OVEVYVF9BVFRSID0gJ2RhdGEta2V5YmluZGluZy1jb250ZXh0JztcblxuZXhwb3J0IGNsYXNzIENvbnRleHQgaW1wbGVtZW50cyBJQ29udGV4dCB7XG5cblx0cHJvdGVjdGVkIF9wYXJlbnQ6IENvbnRleHQgfCBudWxsO1xuXHRwcm90ZWN0ZWQgX3ZhbHVlOiBSZWNvcmQ8c3RyaW5nLCBhbnk+O1xuXHRwcm90ZWN0ZWQgX2lkOiBudW1iZXI7XG5cblx0Y29uc3RydWN0b3IoaWQ6IG51bWJlciwgcGFyZW50OiBDb250ZXh0IHwgbnVsbCkge1xuXHRcdHRoaXMuX2lkID0gaWQ7XG5cdFx0dGhpcy5fcGFyZW50ID0gcGFyZW50O1xuXHRcdHRoaXMuX3ZhbHVlID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHR0aGlzLl92YWx1ZVsnX2NvbnRleHRJZCddID0gaWQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHZhbHVlKCk6IFJlY29yZDxzdHJpbmcsIGFueT4ge1xuXHRcdHJldHVybiB7IC4uLnRoaXMuX3ZhbHVlIH07XG5cdH1cblxuXHRwdWJsaWMgc2V0VmFsdWUoa2V5OiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBib29sZWFuIHtcblx0XHQvLyBjb25zb2xlLmxvZygnU0VUICcgKyBrZXkgKyAnID0gJyArIHZhbHVlICsgJyBPTiAnICsgdGhpcy5faWQpO1xuXHRcdGlmICh0aGlzLl92YWx1ZVtrZXldICE9PSB2YWx1ZSkge1xuXHRcdFx0dGhpcy5fdmFsdWVba2V5XSA9IHZhbHVlO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHB1YmxpYyByZW1vdmVWYWx1ZShrZXk6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdC8vIGNvbnNvbGUubG9nKCdSRU1PVkUgJyArIGtleSArICcgRlJPTSAnICsgdGhpcy5faWQpO1xuXHRcdGlmIChrZXkgaW4gdGhpcy5fdmFsdWUpIHtcblx0XHRcdGRlbGV0ZSB0aGlzLl92YWx1ZVtrZXldO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHB1YmxpYyBnZXRWYWx1ZTxUPihrZXk6IHN0cmluZyk6IFQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHJldCA9IHRoaXMuX3ZhbHVlW2tleV07XG5cdFx0aWYgKHR5cGVvZiByZXQgPT09ICd1bmRlZmluZWQnICYmIHRoaXMuX3BhcmVudCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3BhcmVudC5nZXRWYWx1ZTxUPihrZXkpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmV0O1xuXHR9XG5cblx0cHVibGljIHVwZGF0ZVBhcmVudChwYXJlbnQ6IENvbnRleHQpOiB2b2lkIHtcblx0XHR0aGlzLl9wYXJlbnQgPSBwYXJlbnQ7XG5cdH1cblxuXHRwdWJsaWMgY29sbGVjdEFsbFZhbHVlcygpOiBSZWNvcmQ8c3RyaW5nLCBhbnk+IHtcblx0XHRsZXQgcmVzdWx0ID0gdGhpcy5fcGFyZW50ID8gdGhpcy5fcGFyZW50LmNvbGxlY3RBbGxWYWx1ZXMoKSA6IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0cmVzdWx0ID0geyAuLi5yZXN1bHQsIC4uLnRoaXMuX3ZhbHVlIH07XG5cdFx0ZGVsZXRlIHJlc3VsdFsnX2NvbnRleHRJZCddO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuY2xhc3MgTnVsbENvbnRleHQgZXh0ZW5kcyBDb250ZXh0IHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSU5TVEFOQ0UgPSBuZXcgTnVsbENvbnRleHQoKTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcigtMSwgbnVsbCk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgc2V0VmFsdWUoa2V5OiBzdHJpbmcsIHZhbHVlOiBhbnkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgcmVtb3ZlVmFsdWUoa2V5OiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZ2V0VmFsdWU8VD4oa2V5OiBzdHJpbmcpOiBUIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0b3ZlcnJpZGUgY29sbGVjdEFsbFZhbHVlcygpOiB7IFtrZXk6IHN0cmluZ106IGFueSB9IHtcblx0XHRyZXR1cm4gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0fVxufVxuXG5jbGFzcyBDb25maWdBd2FyZUNvbnRleHRWYWx1ZXNDb250YWluZXIgZXh0ZW5kcyBDb250ZXh0IHtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX2tleVByZWZpeCA9ICdjb25maWcuJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IF92YWx1ZXMgPSBUZXJuYXJ5U2VhcmNoVHJlZS5mb3JDb25maWdLZXlzPGFueT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfbGlzdGVuZXI6IElEaXNwb3NhYmxlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGlkOiBudW1iZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRlbWl0dGVyOiBFbWl0dGVyPElDb250ZXh0S2V5Q2hhbmdlRXZlbnQ+XG5cdCkge1xuXHRcdHN1cGVyKGlkLCBudWxsKTtcblxuXHRcdHRoaXMuX2xpc3RlbmVyID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGV2ZW50ID0+IHtcblx0XHRcdGlmIChldmVudC5zb3VyY2UgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuREVGQVVMVCkge1xuXHRcdFx0XHQvLyBuZXcgc2V0dGluZywgcmVzZXQgZXZlcnl0aGluZ1xuXHRcdFx0XHRjb25zdCBhbGxLZXlzID0gQXJyYXkuZnJvbSh0aGlzLl92YWx1ZXMsIChba10pID0+IGspO1xuXHRcdFx0XHR0aGlzLl92YWx1ZXMuY2xlYXIoKTtcblx0XHRcdFx0ZW1pdHRlci5maXJlKG5ldyBBcnJheUNvbnRleHRLZXlDaGFuZ2VFdmVudChhbGxLZXlzKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBjaGFuZ2VkS2V5czogc3RyaW5nW10gPSBbXTtcblx0XHRcdFx0Zm9yIChjb25zdCBjb25maWdLZXkgb2YgZXZlbnQuYWZmZWN0ZWRLZXlzKSB7XG5cdFx0XHRcdFx0Y29uc3QgY29udGV4dEtleSA9IGBjb25maWcuJHtjb25maWdLZXl9YDtcblxuXHRcdFx0XHRcdGNvbnN0IGNhY2hlZEl0ZW1zID0gdGhpcy5fdmFsdWVzLmZpbmRTdXBlcnN0cihjb250ZXh0S2V5KTtcblx0XHRcdFx0XHRpZiAoY2FjaGVkSXRlbXMgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdFx0Y2hhbmdlZEtleXMucHVzaCguLi5JdGVyYWJsZS5tYXAoY2FjaGVkSXRlbXMsIChba2V5XSkgPT4ga2V5KSk7XG5cdFx0XHRcdFx0XHR0aGlzLl92YWx1ZXMuZGVsZXRlU3VwZXJzdHIoY29udGV4dEtleSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHRoaXMuX3ZhbHVlcy5oYXMoY29udGV4dEtleSkpIHtcblx0XHRcdFx0XHRcdGNoYW5nZWRLZXlzLnB1c2goY29udGV4dEtleSk7XG5cdFx0XHRcdFx0XHR0aGlzLl92YWx1ZXMuZGVsZXRlKGNvbnRleHRLZXkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGVtaXR0ZXIuZmlyZShuZXcgQXJyYXlDb250ZXh0S2V5Q2hhbmdlRXZlbnQoY2hhbmdlZEtleXMpKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fbGlzdGVuZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0VmFsdWUoa2V5OiBzdHJpbmcpOiBhbnkge1xuXG5cdFx0aWYgKGtleS5pbmRleE9mKENvbmZpZ0F3YXJlQ29udGV4dFZhbHVlc0NvbnRhaW5lci5fa2V5UHJlZml4KSAhPT0gMCkge1xuXHRcdFx0cmV0dXJuIHN1cGVyLmdldFZhbHVlKGtleSk7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX3ZhbHVlcy5oYXMoa2V5KSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3ZhbHVlcy5nZXQoa2V5KTtcblx0XHR9XG5cblx0XHRjb25zdCBjb25maWdLZXkgPSBrZXkuc3Vic3RyKENvbmZpZ0F3YXJlQ29udGV4dFZhbHVlc0NvbnRhaW5lci5fa2V5UHJlZml4Lmxlbmd0aCk7XG5cdFx0Y29uc3QgY29uZmlnVmFsdWUgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShjb25maWdLZXkpO1xuXHRcdGxldCB2YWx1ZTogYW55ID0gdW5kZWZpbmVkO1xuXHRcdHN3aXRjaCAodHlwZW9mIGNvbmZpZ1ZhbHVlKSB7XG5cdFx0XHRjYXNlICdudW1iZXInOlxuXHRcdFx0Y2FzZSAnYm9vbGVhbic6XG5cdFx0XHRjYXNlICdzdHJpbmcnOlxuXHRcdFx0XHR2YWx1ZSA9IGNvbmZpZ1ZhbHVlO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KGNvbmZpZ1ZhbHVlKSkge1xuXHRcdFx0XHRcdHZhbHVlID0gSlNPTi5zdHJpbmdpZnkoY29uZmlnVmFsdWUpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHZhbHVlID0gY29uZmlnVmFsdWU7XG5cdFx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl92YWx1ZXMuc2V0KGtleSwgdmFsdWUpO1xuXHRcdHJldHVybiB2YWx1ZTtcblx0fVxuXG5cdG92ZXJyaWRlIHNldFZhbHVlKGtleTogc3RyaW5nLCB2YWx1ZTogYW55KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHN1cGVyLnNldFZhbHVlKGtleSwgdmFsdWUpO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVtb3ZlVmFsdWUoa2V5OiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gc3VwZXIucmVtb3ZlVmFsdWUoa2V5KTtcblx0fVxuXG5cdG92ZXJyaWRlIGNvbGxlY3RBbGxWYWx1ZXMoKTogeyBba2V5OiBzdHJpbmddOiBhbnkgfSB7XG5cdFx0Y29uc3QgcmVzdWx0OiB7IFtrZXk6IHN0cmluZ106IGFueSB9ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHR0aGlzLl92YWx1ZXMuZm9yRWFjaCgodmFsdWUsIGluZGV4KSA9PiByZXN1bHRbaW5kZXhdID0gdmFsdWUpO1xuXHRcdHJldHVybiB7IC4uLnJlc3VsdCwgLi4uc3VwZXIuY29sbGVjdEFsbFZhbHVlcygpIH07XG5cdH1cbn1cblxuY2xhc3MgQ29udGV4dEtleTxUIGV4dGVuZHMgQ29udGV4dEtleVZhbHVlPiBpbXBsZW1lbnRzIElDb250ZXh0S2V5PFQ+IHtcblxuXHRwcml2YXRlIF9zZXJ2aWNlOiBBYnN0cmFjdENvbnRleHRLZXlTZXJ2aWNlO1xuXHRwcml2YXRlIF9rZXk6IHN0cmluZztcblx0cHJpdmF0ZSBfZGVmYXVsdFZhbHVlOiBUIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKHNlcnZpY2U6IEFic3RyYWN0Q29udGV4dEtleVNlcnZpY2UsIGtleTogc3RyaW5nLCBkZWZhdWx0VmFsdWU6IFQgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl9zZXJ2aWNlID0gc2VydmljZTtcblx0XHR0aGlzLl9rZXkgPSBrZXk7XG5cdFx0dGhpcy5fZGVmYXVsdFZhbHVlID0gZGVmYXVsdFZhbHVlO1xuXHRcdHRoaXMucmVzZXQoKTtcblx0fVxuXG5cdHB1YmxpYyBzZXQodmFsdWU6IFQpOiB2b2lkIHtcblx0XHR0aGlzLl9zZXJ2aWNlLnNldENvbnRleHQodGhpcy5fa2V5LCB2YWx1ZSk7XG5cdH1cblxuXHRwdWJsaWMgcmVzZXQoKTogdm9pZCB7XG5cdFx0aWYgKHR5cGVvZiB0aGlzLl9kZWZhdWx0VmFsdWUgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHR0aGlzLl9zZXJ2aWNlLnJlbW92ZUNvbnRleHQodGhpcy5fa2V5KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fc2VydmljZS5zZXRDb250ZXh0KHRoaXMuX2tleSwgdGhpcy5fZGVmYXVsdFZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgZ2V0KCk6IFQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9zZXJ2aWNlLmdldENvbnRleHRLZXlWYWx1ZTxUPih0aGlzLl9rZXkpO1xuXHR9XG59XG5cbmNsYXNzIFNpbXBsZUNvbnRleHRLZXlDaGFuZ2VFdmVudCBpbXBsZW1lbnRzIElDb250ZXh0S2V5Q2hhbmdlRXZlbnQge1xuXHRjb25zdHJ1Y3RvcihyZWFkb25seSBrZXk6IHN0cmluZykgeyB9XG5cdGFmZmVjdHNTb21lKGtleXM6IElSZWFkYWJsZVNldDxzdHJpbmc+KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGtleXMuaGFzKHRoaXMua2V5KTtcblx0fVxuXHRhbGxLZXlzQ29udGFpbmVkSW4oa2V5czogSVJlYWRhYmxlU2V0PHN0cmluZz4pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5hZmZlY3RzU29tZShrZXlzKTtcblx0fVxufVxuXG5jbGFzcyBBcnJheUNvbnRleHRLZXlDaGFuZ2VFdmVudCBpbXBsZW1lbnRzIElDb250ZXh0S2V5Q2hhbmdlRXZlbnQge1xuXHRjb25zdHJ1Y3RvcihyZWFkb25seSBrZXlzOiBzdHJpbmdbXSkgeyB9XG5cdGFmZmVjdHNTb21lKGtleXM6IElSZWFkYWJsZVNldDxzdHJpbmc+KTogYm9vbGVhbiB7XG5cdFx0Zm9yIChjb25zdCBrZXkgb2YgdGhpcy5rZXlzKSB7XG5cdFx0XHRpZiAoa2V5cy5oYXMoa2V5KSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdGFsbEtleXNDb250YWluZWRJbihrZXlzOiBJUmVhZGFibGVTZXQ8c3RyaW5nPik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmtleXMuZXZlcnkoa2V5ID0+IGtleXMuaGFzKGtleSkpO1xuXHR9XG59XG5cbmNsYXNzIENvbXBvc2l0ZUNvbnRleHRLZXlDaGFuZ2VFdmVudCBpbXBsZW1lbnRzIElDb250ZXh0S2V5Q2hhbmdlRXZlbnQge1xuXHRjb25zdHJ1Y3RvcihyZWFkb25seSBldmVudHM6IElDb250ZXh0S2V5Q2hhbmdlRXZlbnRbXSkgeyB9XG5cdGFmZmVjdHNTb21lKGtleXM6IElSZWFkYWJsZVNldDxzdHJpbmc+KTogYm9vbGVhbiB7XG5cdFx0Zm9yIChjb25zdCBlIG9mIHRoaXMuZXZlbnRzKSB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzU29tZShrZXlzKSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdGFsbEtleXNDb250YWluZWRJbihrZXlzOiBJUmVhZGFibGVTZXQ8c3RyaW5nPik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmV2ZW50cy5ldmVyeShldnQgPT4gZXZ0LmFsbEtleXNDb250YWluZWRJbihrZXlzKSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gYWxsRXZlbnRLZXlzSW5Db250ZXh0KGV2ZW50OiBJQ29udGV4dEtleUNoYW5nZUV2ZW50LCBjb250ZXh0OiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogYm9vbGVhbiB7XG5cdHJldHVybiBldmVudC5hbGxLZXlzQ29udGFpbmVkSW4obmV3IFNldChPYmplY3Qua2V5cyhjb250ZXh0KSkpO1xufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RDb250ZXh0S2V5U2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJQ29udGV4dEtleVNlcnZpY2Uge1xuXHRkZWNsYXJlIF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcm90ZWN0ZWQgX2lzRGlzcG9zZWQ6IGJvb2xlYW47XG5cdHByb3RlY3RlZCBfbXlDb250ZXh0SWQ6IG51bWJlcjtcblxuXHRwcm90ZWN0ZWQgX29uRGlkQ2hhbmdlQ29udGV4dCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBQYXVzZWFibGVFbWl0dGVyPElDb250ZXh0S2V5Q2hhbmdlRXZlbnQ+KHsgbWVyZ2U6IGlucHV0ID0+IG5ldyBDb21wb3NpdGVDb250ZXh0S2V5Q2hhbmdlRXZlbnQoaW5wdXQpIH0pKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VDb250ZXh0ID0gdGhpcy5fb25EaWRDaGFuZ2VDb250ZXh0LmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKG15Q29udGV4dElkOiBudW1iZXIpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX2lzRGlzcG9zZWQgPSBmYWxzZTtcblx0XHR0aGlzLl9teUNvbnRleHRJZCA9IG15Q29udGV4dElkO1xuXHR9XG5cblx0cHVibGljIGdldCBjb250ZXh0SWQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fbXlDb250ZXh0SWQ7XG5cdH1cblxuXHRwdWJsaWMgY3JlYXRlS2V5PFQgZXh0ZW5kcyBDb250ZXh0S2V5VmFsdWU+KGtleTogc3RyaW5nLCBkZWZhdWx0VmFsdWU6IFQgfCB1bmRlZmluZWQpOiBJQ29udGV4dEtleTxUPiB7XG5cdFx0aWYgKHRoaXMuX2lzRGlzcG9zZWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgQWJzdHJhY3RDb250ZXh0S2V5U2VydmljZSBoYXMgYmVlbiBkaXNwb3NlZGApO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IENvbnRleHRLZXkodGhpcywga2V5LCBkZWZhdWx0VmFsdWUpO1xuXHR9XG5cblxuXHRidWZmZXJDaGFuZ2VFdmVudHMoY2FsbGJhY2s6IEZ1bmN0aW9uKTogdm9pZCB7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZXh0LnBhdXNlKCk7XG5cdFx0dHJ5IHtcblx0XHRcdGNhbGxiYWNrKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGV4dC5yZXN1bWUoKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgY3JlYXRlU2NvcGVkKGRvbU5vZGU6IElDb250ZXh0S2V5U2VydmljZVRhcmdldCk6IElTY29wZWRDb250ZXh0S2V5U2VydmljZSB7XG5cdFx0aWYgKHRoaXMuX2lzRGlzcG9zZWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgQWJzdHJhY3RDb250ZXh0S2V5U2VydmljZSBoYXMgYmVlbiBkaXNwb3NlZGApO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IFNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKHRoaXMsIGRvbU5vZGUpO1xuXHR9XG5cblx0Y3JlYXRlT3ZlcmxheShvdmVybGF5OiBJdGVyYWJsZTxbc3RyaW5nLCBhbnldPiA9IEl0ZXJhYmxlLmVtcHR5KCkpOiBJQ29udGV4dEtleVNlcnZpY2Uge1xuXHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYEFic3RyYWN0Q29udGV4dEtleVNlcnZpY2UgaGFzIGJlZW4gZGlzcG9zZWRgKTtcblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBPdmVybGF5Q29udGV4dEtleVNlcnZpY2UodGhpcywgb3ZlcmxheSk7XG5cdH1cblxuXHRwdWJsaWMgY29udGV4dE1hdGNoZXNSdWxlcyhydWxlczogQ29udGV4dEtleUV4cHJlc3Npb24gfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBBYnN0cmFjdENvbnRleHRLZXlTZXJ2aWNlIGhhcyBiZWVuIGRpc3Bvc2VkYCk7XG5cdFx0fVxuXHRcdGNvbnN0IGNvbnRleHQgPSB0aGlzLmdldENvbnRleHRWYWx1ZXNDb250YWluZXIodGhpcy5fbXlDb250ZXh0SWQpO1xuXHRcdGNvbnN0IHJlc3VsdCA9IChydWxlcyA/IHJ1bGVzLmV2YWx1YXRlKGNvbnRleHQpIDogdHJ1ZSk7XG5cdFx0Ly8gY29uc29sZS5ncm91cChydWxlcy5zZXJpYWxpemUoKSArICcgLT4gJyArIHJlc3VsdCk7XG5cdFx0Ly8gcnVsZXMua2V5cygpLmZvckVhY2goa2V5ID0+IHsgY29uc29sZS5sb2coa2V5LCBjdHhba2V5XSk7IH0pO1xuXHRcdC8vIGNvbnNvbGUuZ3JvdXBFbmQoKTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIGdldENvbnRleHRLZXlWYWx1ZTxUPihrZXk6IHN0cmluZyk6IFQgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5nZXRDb250ZXh0VmFsdWVzQ29udGFpbmVyKHRoaXMuX215Q29udGV4dElkKS5nZXRWYWx1ZTxUPihrZXkpO1xuXHR9XG5cblx0cHVibGljIHNldENvbnRleHQoa2V5OiBzdHJpbmcsIHZhbHVlOiBhbnkpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBteUNvbnRleHQgPSB0aGlzLmdldENvbnRleHRWYWx1ZXNDb250YWluZXIodGhpcy5fbXlDb250ZXh0SWQpO1xuXHRcdGlmICghbXlDb250ZXh0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChteUNvbnRleHQuc2V0VmFsdWUoa2V5LCB2YWx1ZSkpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGV4dC5maXJlKG5ldyBTaW1wbGVDb250ZXh0S2V5Q2hhbmdlRXZlbnQoa2V5KSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHJlbW92ZUNvbnRleHQoa2V5OiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5nZXRDb250ZXh0VmFsdWVzQ29udGFpbmVyKHRoaXMuX215Q29udGV4dElkKS5yZW1vdmVWYWx1ZShrZXkpKSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbnRleHQuZmlyZShuZXcgU2ltcGxlQ29udGV4dEtleUNoYW5nZUV2ZW50KGtleSkpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXRDb250ZXh0KHRhcmdldDogSUNvbnRleHRLZXlTZXJ2aWNlVGFyZ2V0IHwgbnVsbCk6IElDb250ZXh0IHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuIE51bGxDb250ZXh0LklOU1RBTkNFO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5nZXRDb250ZXh0VmFsdWVzQ29udGFpbmVyKGZpbmRDb250ZXh0QXR0cih0YXJnZXQpKTtcblx0fVxuXG5cdHB1YmxpYyBhYnN0cmFjdCBnZXRDb250ZXh0VmFsdWVzQ29udGFpbmVyKGNvbnRleHRJZDogbnVtYmVyKTogQ29udGV4dDtcblx0cHVibGljIGFic3RyYWN0IGNyZWF0ZUNoaWxkQ29udGV4dChwYXJlbnRDb250ZXh0SWQ/OiBudW1iZXIpOiBudW1iZXI7XG5cdHB1YmxpYyBhYnN0cmFjdCBkaXNwb3NlQ29udGV4dChjb250ZXh0SWQ6IG51bWJlcik6IHZvaWQ7XG5cdHB1YmxpYyBhYnN0cmFjdCB1cGRhdGVQYXJlbnQocGFyZW50Q29udGV4dEtleVNlcnZpY2U/OiBJQ29udGV4dEtleVNlcnZpY2UpOiB2b2lkO1xuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9pc0Rpc3Bvc2VkID0gdHJ1ZTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ29udGV4dEtleVNlcnZpY2UgZXh0ZW5kcyBBYnN0cmFjdENvbnRleHRLZXlTZXJ2aWNlIGltcGxlbWVudHMgSUNvbnRleHRLZXlTZXJ2aWNlIHtcblxuXHRwcml2YXRlIF9sYXN0Q29udGV4dElkOiBudW1iZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRzID0gbmV3IE1hcDxudW1iZXIsIENvbnRleHQ+KCk7XG5cblx0Y29uc3RydWN0b3IoQElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSB7XG5cdFx0c3VwZXIoMCk7XG5cdFx0dGhpcy5fbGFzdENvbnRleHRJZCA9IDA7XG5cblx0XHRjb25zdCBteUNvbnRleHQgPSB0aGlzLl9yZWdpc3RlcihuZXcgQ29uZmlnQXdhcmVDb250ZXh0VmFsdWVzQ29udGFpbmVyKHRoaXMuX215Q29udGV4dElkLCBjb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy5fb25EaWRDaGFuZ2VDb250ZXh0KSk7XG5cdFx0dGhpcy5fY29udGV4dHMuc2V0KHRoaXMuX215Q29udGV4dElkLCBteUNvbnRleHQpO1xuXG5cdFx0Ly8gVW5jb21tZW50IHRoaXMgdG8gc2VlIHRoZSBjb250ZXh0cyBjb250aW51b3VzbHkgbG9nZ2VkXG5cdFx0Ly8gbGV0IGxhc3RMb2dnZWRWYWx1ZTogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cdFx0Ly8gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuXHRcdC8vIFx0bGV0IHZhbHVlcyA9IE9iamVjdC5rZXlzKHRoaXMuX2NvbnRleHRzKS5tYXAoKGtleSkgPT4gdGhpcy5fY29udGV4dHNba2V5XSk7XG5cdFx0Ly8gXHRsZXQgbG9nVmFsdWUgPSB2YWx1ZXMubWFwKHYgPT4gSlNPTi5zdHJpbmdpZnkodi5fdmFsdWUsIG51bGwsICdcXHQnKSkuam9pbignXFxuJyk7XG5cdFx0Ly8gXHRpZiAobGFzdExvZ2dlZFZhbHVlICE9PSBsb2dWYWx1ZSkge1xuXHRcdC8vIFx0XHRsYXN0TG9nZ2VkVmFsdWUgPSBsb2dWYWx1ZTtcblx0XHQvLyBcdFx0Y29uc29sZS5sb2cobGFzdExvZ2dlZFZhbHVlKTtcblx0XHQvLyBcdH1cblx0XHQvLyB9LCAyMDAwKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRDb250ZXh0VmFsdWVzQ29udGFpbmVyKGNvbnRleHRJZDogbnVtYmVyKTogQ29udGV4dCB7XG5cdFx0aWYgKHRoaXMuX2lzRGlzcG9zZWQpIHtcblx0XHRcdHJldHVybiBOdWxsQ29udGV4dC5JTlNUQU5DRTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2NvbnRleHRzLmdldChjb250ZXh0SWQpIHx8IE51bGxDb250ZXh0LklOU1RBTkNFO1xuXHR9XG5cblx0cHVibGljIGNyZWF0ZUNoaWxkQ29udGV4dChwYXJlbnRDb250ZXh0SWQ6IG51bWJlciA9IHRoaXMuX215Q29udGV4dElkKTogbnVtYmVyIHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDb250ZXh0S2V5U2VydmljZSBoYXMgYmVlbiBkaXNwb3NlZGApO1xuXHRcdH1cblx0XHRjb25zdCBpZCA9ICgrK3RoaXMuX2xhc3RDb250ZXh0SWQpO1xuXHRcdHRoaXMuX2NvbnRleHRzLnNldChpZCwgbmV3IENvbnRleHQoaWQsIHRoaXMuZ2V0Q29udGV4dFZhbHVlc0NvbnRhaW5lcihwYXJlbnRDb250ZXh0SWQpKSk7XG5cdFx0cmV0dXJuIGlkO1xuXHR9XG5cblx0cHVibGljIGRpc3Bvc2VDb250ZXh0KGNvbnRleHRJZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHR0aGlzLl9jb250ZXh0cy5kZWxldGUoY29udGV4dElkKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgdXBkYXRlUGFyZW50KF9wYXJlbnRDb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlKTogdm9pZCB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgdXBkYXRlIHBhcmVudCBvZiByb290IENvbnRleHRLZXlTZXJ2aWNlJyk7XG5cdH1cbn1cblxuY2xhc3MgU2NvcGVkQ29udGV4dEtleVNlcnZpY2UgZXh0ZW5kcyBBYnN0cmFjdENvbnRleHRLZXlTZXJ2aWNlIHtcblxuXHRwcml2YXRlIF9wYXJlbnQ6IEFic3RyYWN0Q29udGV4dEtleVNlcnZpY2U7XG5cdHByaXZhdGUgX2RvbU5vZGU6IElDb250ZXh0S2V5U2VydmljZVRhcmdldDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9wYXJlbnRDaGFuZ2VMaXN0ZW5lciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblxuXHRjb25zdHJ1Y3RvcihwYXJlbnQ6IEFic3RyYWN0Q29udGV4dEtleVNlcnZpY2UsIGRvbU5vZGU6IElDb250ZXh0S2V5U2VydmljZVRhcmdldCkge1xuXHRcdHN1cGVyKHBhcmVudC5jcmVhdGVDaGlsZENvbnRleHQoKSk7XG5cdFx0dGhpcy5fcGFyZW50ID0gcGFyZW50O1xuXHRcdHRoaXMuX3VwZGF0ZVBhcmVudENoYW5nZUxpc3RlbmVyKCk7XG5cblx0XHR0aGlzLl9kb21Ob2RlID0gZG9tTm9kZTtcblx0XHRpZiAodGhpcy5fZG9tTm9kZS5oYXNBdHRyaWJ1dGUoS0VZQklORElOR19DT05URVhUX0FUVFIpKSB7XG5cdFx0XHRsZXQgZXh0cmFJbmZvID0gJyc7XG5cdFx0XHRpZiAoKHRoaXMuX2RvbU5vZGUgYXMgSFRNTEVsZW1lbnQpLmNsYXNzTGlzdCkge1xuXHRcdFx0XHRleHRyYUluZm8gPSBBcnJheS5mcm9tKCh0aGlzLl9kb21Ob2RlIGFzIEhUTUxFbGVtZW50KS5jbGFzc0xpc3QudmFsdWVzKCkpLmpvaW4oJywgJyk7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnNvbGUuZXJyb3IoYEVsZW1lbnQgYWxyZWFkeSBoYXMgY29udGV4dCBhdHRyaWJ1dGUke2V4dHJhSW5mbyA/ICc6ICcgKyBleHRyYUluZm8gOiAnJ31gKTtcblx0XHR9XG5cdFx0dGhpcy5fZG9tTm9kZS5zZXRBdHRyaWJ1dGUoS0VZQklORElOR19DT05URVhUX0FUVFIsIFN0cmluZyh0aGlzLl9teUNvbnRleHRJZCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlUGFyZW50Q2hhbmdlTGlzdGVuZXIoKTogdm9pZCB7XG5cdFx0Ly8gRm9yd2FyZCBwYXJlbnQgZXZlbnRzIHRvIHRoaXMgbGlzdGVuZXIuIFBhcmVudCB3aWxsIGNoYW5nZS5cblx0XHR0aGlzLl9wYXJlbnRDaGFuZ2VMaXN0ZW5lci52YWx1ZSA9IHRoaXMuX3BhcmVudC5vbkRpZENoYW5nZUNvbnRleHQoZSA9PiB7XG5cdFx0XHRjb25zdCB0aGlzQ29udGFpbmVyID0gdGhpcy5fcGFyZW50LmdldENvbnRleHRWYWx1ZXNDb250YWluZXIodGhpcy5fbXlDb250ZXh0SWQpO1xuXHRcdFx0Y29uc3QgdGhpc0NvbnRleHRWYWx1ZXMgPSB0aGlzQ29udGFpbmVyLnZhbHVlO1xuXG5cdFx0XHRpZiAoIWFsbEV2ZW50S2V5c0luQ29udGV4dChlLCB0aGlzQ29udGV4dFZhbHVlcykpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZXh0LmZpcmUoZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3BhcmVudC5kaXNwb3NlQ29udGV4dCh0aGlzLl9teUNvbnRleHRJZCk7XG5cdFx0dGhpcy5fZG9tTm9kZS5yZW1vdmVBdHRyaWJ1dGUoS0VZQklORElOR19DT05URVhUX0FUVFIpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRDb250ZXh0VmFsdWVzQ29udGFpbmVyKGNvbnRleHRJZDogbnVtYmVyKTogQ29udGV4dCB7XG5cdFx0aWYgKHRoaXMuX2lzRGlzcG9zZWQpIHtcblx0XHRcdHJldHVybiBOdWxsQ29udGV4dC5JTlNUQU5DRTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3BhcmVudC5nZXRDb250ZXh0VmFsdWVzQ29udGFpbmVyKGNvbnRleHRJZCk7XG5cdH1cblxuXHRwdWJsaWMgY3JlYXRlQ2hpbGRDb250ZXh0KHBhcmVudENvbnRleHRJZDogbnVtYmVyID0gdGhpcy5fbXlDb250ZXh0SWQpOiBudW1iZXIge1xuXHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFNjb3BlZENvbnRleHRLZXlTZXJ2aWNlIGhhcyBiZWVuIGRpc3Bvc2VkYCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9wYXJlbnQuY3JlYXRlQ2hpbGRDb250ZXh0KHBhcmVudENvbnRleHRJZCk7XG5cdH1cblxuXHRwdWJsaWMgZGlzcG9zZUNvbnRleHQoY29udGV4dElkOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9wYXJlbnQuZGlzcG9zZUNvbnRleHQoY29udGV4dElkKTtcblx0fVxuXG5cdHB1YmxpYyB1cGRhdGVQYXJlbnQocGFyZW50Q29udGV4dEtleVNlcnZpY2U6IEFic3RyYWN0Q29udGV4dEtleVNlcnZpY2UpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fcGFyZW50ID09PSBwYXJlbnRDb250ZXh0S2V5U2VydmljZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRoaXNDb250YWluZXIgPSB0aGlzLl9wYXJlbnQuZ2V0Q29udGV4dFZhbHVlc0NvbnRhaW5lcih0aGlzLl9teUNvbnRleHRJZCk7XG5cdFx0Y29uc3Qgb2xkQWxsVmFsdWVzID0gdGhpc0NvbnRhaW5lci5jb2xsZWN0QWxsVmFsdWVzKCk7XG5cdFx0dGhpcy5fcGFyZW50ID0gcGFyZW50Q29udGV4dEtleVNlcnZpY2U7XG5cdFx0dGhpcy5fdXBkYXRlUGFyZW50Q2hhbmdlTGlzdGVuZXIoKTtcblx0XHRjb25zdCBuZXdQYXJlbnRDb250YWluZXIgPSB0aGlzLl9wYXJlbnQuZ2V0Q29udGV4dFZhbHVlc0NvbnRhaW5lcih0aGlzLl9wYXJlbnQuY29udGV4dElkKTtcblx0XHR0aGlzQ29udGFpbmVyLnVwZGF0ZVBhcmVudChuZXdQYXJlbnRDb250YWluZXIpO1xuXG5cdFx0Y29uc3QgbmV3QWxsVmFsdWVzID0gdGhpc0NvbnRhaW5lci5jb2xsZWN0QWxsVmFsdWVzKCk7XG5cdFx0Y29uc3QgYWxsVmFsdWVzRGlmZiA9IHtcblx0XHRcdC4uLmRpc3RpbmN0KG9sZEFsbFZhbHVlcywgbmV3QWxsVmFsdWVzKSxcblx0XHRcdC4uLmRpc3RpbmN0KG5ld0FsbFZhbHVlcywgb2xkQWxsVmFsdWVzKVxuXHRcdH07XG5cdFx0Y29uc3QgY2hhbmdlZEtleXMgPSBPYmplY3Qua2V5cyhhbGxWYWx1ZXNEaWZmKTtcblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGV4dC5maXJlKG5ldyBBcnJheUNvbnRleHRLZXlDaGFuZ2VFdmVudChjaGFuZ2VkS2V5cykpO1xuXHR9XG59XG5cbmNsYXNzIE92ZXJsYXlDb250ZXh0IGltcGxlbWVudHMgSUNvbnRleHQge1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcGFyZW50OiBJQ29udGV4dCwgcHJpdmF0ZSBvdmVybGF5OiBSZWFkb25seU1hcDxzdHJpbmcsIGFueT4pIHsgfVxuXG5cdGdldFZhbHVlPFQgZXh0ZW5kcyBDb250ZXh0S2V5VmFsdWU+KGtleTogc3RyaW5nKTogVCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMub3ZlcmxheS5oYXMoa2V5KSA/IHRoaXMub3ZlcmxheS5nZXQoa2V5KSA6IHRoaXMucGFyZW50LmdldFZhbHVlPFQ+KGtleSk7XG5cdH1cbn1cblxuY2xhc3MgT3ZlcmxheUNvbnRleHRLZXlTZXJ2aWNlIGltcGxlbWVudHMgSUNvbnRleHRLZXlTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBvdmVybGF5OiBNYXA8c3RyaW5nLCBhbnk+O1xuXG5cdGdldCBjb250ZXh0SWQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5wYXJlbnQuY29udGV4dElkO1xuXHR9XG5cblx0Z2V0IG9uRGlkQ2hhbmdlQ29udGV4dCgpOiBFdmVudDxJQ29udGV4dEtleUNoYW5nZUV2ZW50PiB7XG5cdFx0cmV0dXJuIHRoaXMucGFyZW50Lm9uRGlkQ2hhbmdlQ29udGV4dDtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcGFyZW50OiBBYnN0cmFjdENvbnRleHRLZXlTZXJ2aWNlIHwgT3ZlcmxheUNvbnRleHRLZXlTZXJ2aWNlLCBvdmVybGF5OiBJdGVyYWJsZTxbc3RyaW5nLCBhbnldPikge1xuXHRcdHRoaXMub3ZlcmxheSA9IG5ldyBNYXAob3ZlcmxheSk7XG5cdH1cblxuXHRidWZmZXJDaGFuZ2VFdmVudHMoY2FsbGJhY2s6IEZ1bmN0aW9uKTogdm9pZCB7XG5cdFx0dGhpcy5wYXJlbnQuYnVmZmVyQ2hhbmdlRXZlbnRzKGNhbGxiYWNrKTtcblx0fVxuXG5cdGNyZWF0ZUtleTxUIGV4dGVuZHMgQ29udGV4dEtleVZhbHVlPigpOiBJQ29udGV4dEtleTxUPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdOb3Qgc3VwcG9ydGVkLicpO1xuXHR9XG5cblx0Z2V0Q29udGV4dCh0YXJnZXQ6IElDb250ZXh0S2V5U2VydmljZVRhcmdldCB8IG51bGwpOiBJQ29udGV4dCB7XG5cdFx0cmV0dXJuIG5ldyBPdmVybGF5Q29udGV4dCh0aGlzLnBhcmVudC5nZXRDb250ZXh0KHRhcmdldCksIHRoaXMub3ZlcmxheSk7XG5cdH1cblxuXHRnZXRDb250ZXh0VmFsdWVzQ29udGFpbmVyKGNvbnRleHRJZDogbnVtYmVyKTogSUNvbnRleHQge1xuXHRcdGNvbnN0IHBhcmVudENvbnRleHQgPSB0aGlzLnBhcmVudC5nZXRDb250ZXh0VmFsdWVzQ29udGFpbmVyKGNvbnRleHRJZCk7XG5cdFx0cmV0dXJuIG5ldyBPdmVybGF5Q29udGV4dChwYXJlbnRDb250ZXh0LCB0aGlzLm92ZXJsYXkpO1xuXHR9XG5cblx0Y29udGV4dE1hdGNoZXNSdWxlcyhydWxlczogQ29udGV4dEtleUV4cHJlc3Npb24gfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0XHRjb25zdCBjb250ZXh0ID0gdGhpcy5nZXRDb250ZXh0VmFsdWVzQ29udGFpbmVyKHRoaXMuY29udGV4dElkKTtcblx0XHRjb25zdCByZXN1bHQgPSAocnVsZXMgPyBydWxlcy5ldmFsdWF0ZShjb250ZXh0KSA6IHRydWUpO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRnZXRDb250ZXh0S2V5VmFsdWU8VD4oa2V5OiBzdHJpbmcpOiBUIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5vdmVybGF5LmhhcyhrZXkpID8gdGhpcy5vdmVybGF5LmdldChrZXkpIDogdGhpcy5wYXJlbnQuZ2V0Q29udGV4dEtleVZhbHVlKGtleSk7XG5cdH1cblxuXHRjcmVhdGVTY29wZWQoKTogSVNjb3BlZENvbnRleHRLZXlTZXJ2aWNlIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ05vdCBzdXBwb3J0ZWQuJyk7XG5cdH1cblxuXHRjcmVhdGVPdmVybGF5KG92ZXJsYXk6IEl0ZXJhYmxlPFtzdHJpbmcsIGFueV0+ID0gSXRlcmFibGUuZW1wdHkoKSk6IElDb250ZXh0S2V5U2VydmljZSB7XG5cdFx0cmV0dXJuIG5ldyBPdmVybGF5Q29udGV4dEtleVNlcnZpY2UodGhpcywgb3ZlcmxheSk7XG5cdH1cblxuXHR1cGRhdGVQYXJlbnQoKTogdm9pZCB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdOb3Qgc3VwcG9ydGVkLicpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGZpbmRDb250ZXh0QXR0cihkb21Ob2RlOiBJQ29udGV4dEtleVNlcnZpY2VUYXJnZXQgfCBudWxsKTogbnVtYmVyIHtcblx0d2hpbGUgKGRvbU5vZGUpIHtcblx0XHRpZiAoZG9tTm9kZS5oYXNBdHRyaWJ1dGUoS0VZQklORElOR19DT05URVhUX0FUVFIpKSB7XG5cdFx0XHRjb25zdCBhdHRyID0gZG9tTm9kZS5nZXRBdHRyaWJ1dGUoS0VZQklORElOR19DT05URVhUX0FUVFIpO1xuXHRcdFx0aWYgKGF0dHIpIHtcblx0XHRcdFx0cmV0dXJuIHBhcnNlSW50KGF0dHIsIDEwKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBOYU47XG5cdFx0fVxuXHRcdGRvbU5vZGUgPSBkb21Ob2RlLnBhcmVudEVsZW1lbnQ7XG5cdH1cblx0cmV0dXJuIDA7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXRDb250ZXh0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjb250ZXh0S2V5OiBhbnksIGNvbnRleHRWYWx1ZTogYW55KSB7XG5cdGNvbnN0IGNvbnRleHRLZXlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb250ZXh0S2V5U2VydmljZSk7XG5cdGNvbnRleHRLZXlTZXJ2aWNlLmNyZWF0ZUtleShTdHJpbmcoY29udGV4dEtleSksIHN0cmluZ2lmeVVSSXMoY29udGV4dFZhbHVlKSk7XG59XG5cbmZ1bmN0aW9uIHN0cmluZ2lmeVVSSXMoY29udGV4dFZhbHVlOiBhbnkpOiBhbnkge1xuXHRyZXR1cm4gY2xvbmVBbmRDaGFuZ2UoY29udGV4dFZhbHVlLCAob2JqKSA9PiB7XG5cdFx0aWYgKHR5cGVvZiBvYmogPT09ICdvYmplY3QnICYmICg8TWFyc2hhbGxlZE9iamVjdD5vYmopLiRtaWQgPT09IE1hcnNoYWxsZWRJZC5VcmkpIHtcblx0XHRcdHJldHVybiBVUkkucmV2aXZlKG9iaikudG9TdHJpbmcoKTtcblx0XHR9XG5cdFx0aWYgKG9iaiBpbnN0YW5jZW9mIFVSSSkge1xuXHRcdFx0cmV0dXJuIG9iai50b1N0cmluZygpO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9KTtcbn1cblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ19zZXRDb250ZXh0Jywgc2V0Q29udGV4dCk7XG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0aWQ6ICdnZXRDb250ZXh0S2V5SW5mbycsXG5cdGhhbmRsZXIoKSB7XG5cdFx0cmV0dXJuIFsuLi5SYXdDb250ZXh0S2V5LmFsbCgpXS5zb3J0KChhLCBiKSA9PiBhLmtleS5sb2NhbGVDb21wYXJlKGIua2V5KSk7XG5cdH0sXG5cdG1ldGFkYXRhOiB7XG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdnZXRDb250ZXh0S2V5SW5mbycsIFwiQSBjb21tYW5kIHRoYXQgcmV0dXJucyBpbmZvcm1hdGlvbiBhYm91dCBjb250ZXh0IGtleXNcIiksXG5cdFx0YXJnczogW11cblx0fVxufSk7XG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdfZ2VuZXJhdGVDb250ZXh0S2V5SW5mbycsIGZ1bmN0aW9uICgpIHtcblx0Y29uc3QgcmVzdWx0OiBDb250ZXh0S2V5SW5mb1tdID0gW107XG5cdGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0Zm9yIChjb25zdCBpbmZvIG9mIFJhd0NvbnRleHRLZXkuYWxsKCkpIHtcblx0XHRpZiAoIXNlZW4uaGFzKGluZm8ua2V5KSkge1xuXHRcdFx0c2Vlbi5hZGQoaW5mby5rZXkpO1xuXHRcdFx0cmVzdWx0LnB1c2goaW5mbyk7XG5cdFx0fVxuXHR9XG5cdHJlc3VsdC5zb3J0KChhLCBiKSA9PiBhLmtleS5sb2NhbGVDb21wYXJlKGIua2V5KSk7XG5cdGNvbnNvbGUubG9nKEpTT04uc3RyaW5naWZ5KHJlc3VsdCwgdW5kZWZpbmVkLCAyKSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBeUIsd0JBQXdCO0FBQ2pELFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsWUFBeUIseUJBQXlCO0FBRTNELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZ0JBQWdCLGdCQUFnQjtBQUN6QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLFdBQVc7QUFDcEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxxQkFBcUIsNkJBQTZCO0FBQzNELFNBQStHLG9CQUFzRixxQkFBcUI7QUFHMU4sTUFBTSwwQkFBMEI7QUFFekIsTUFBTSxRQUE0QjtBQUFBLEVBTXhDLFlBQVksSUFBWSxRQUF3QjtBQUMvQyxTQUFLLE1BQU07QUFDWCxTQUFLLFVBQVU7QUFDZixTQUFLLFNBQVMsdUJBQU8sT0FBTyxJQUFJO0FBQ2hDLFNBQUssT0FBTyxZQUFZLElBQUk7QUFBQSxFQUM3QjtBQUFBLEVBRUEsSUFBVyxRQUE2QjtBQUN2QyxXQUFPLEVBQUUsR0FBRyxLQUFLLE9BQU87QUFBQSxFQUN6QjtBQUFBLEVBRU8sU0FBUyxLQUFhLE9BQXFCO0FBRWpELFFBQUksS0FBSyxPQUFPLEdBQUcsTUFBTSxPQUFPO0FBQy9CLFdBQUssT0FBTyxHQUFHLElBQUk7QUFDbkIsYUFBTztBQUFBLElBQ1I7QUFD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LE9BQU8sUUFBUSxhQUFhLHVCQUF1QjtBQUN6RCxVQUFJLE1BQU07QUFDVCxlQUFPLFNBQVMsTUFBTSxFQUFFO0FBQUEsTUFDekI7QUFDQSxhQUFPO0FBQUEsSUFDUjtBQUNBLGNBQVUsUUFBUTtBQUFBLEVBQ25CO0FBQ0EsU0FBTztBQUNSO0FBRU8sU0FBUyxXQUFXLFVBQTRCLFlBQWlCLGNBQW1CO0FBQzFGLFFBQU0sb0JBQW9CLFNBQVMsSUFBSSxrQkFBa0I7QUFDekQsb0JBQWtCLFVBQVUsT0FBTyxVQUFVLEdBQUcsY0FBYyxZQUFZLENBQUM7QUFDNUU7QUFFQSxTQUFTLGNBQWMsY0FBd0I7QUFDOUMsU0FBTyxlQUFlLGNBQWMsQ0FBQyxRQUFRO0FBQzVDLFFBQUksT0FBTyxRQUFRLFlBQStCLElBQUssU0FBUyxhQUFhLEtBQUs7QUFDakYsYUFBTyxJQUFJLE9BQU8sR0FBRyxFQUFFLFNBQVM7QUFBQSxJQUNqQztBQUNBLFFBQUksZUFBZSxLQUFLO0FBQ3ZCLGFBQU8sSUFBSSxTQUFTO0FBQUEsSUFDckI7QUFDQSxXQUFPO0FBQUEsRUFDUixDQUFDO0FBQ0Y7QUFFQSxpQkFBaUIsZ0JBQWdCLGVBQWUsVUFBVTtBQUUxRCxpQkFBaUIsZ0JBQWdCO0FBQUEsRUFDaEMsSUFBSTtBQUFBLEVBQ0osVUFBVTtBQUNULFdBQU8sQ0FBQyxHQUFHLGNBQWMsSUFBSSxDQUFDLEVBQUUsS0FBSyxDQUFDLEdBQUcsTUFBTSxFQUFFLElBQUksY0FBYyxFQUFFLEdBQUcsQ0FBQztBQUFBLEVBQzFFO0FBQUEsRUFDQSxVQUFVO0FBQUEsSUFDVCxhQUFhLFNBQVMscUJBQXFCLHVEQUF1RDtBQUFBLElBQ2xHLE1BQU0sQ0FBQztBQUFBLEVBQ1I7QUFDRCxDQUFDO0FBRUQsaUJBQWlCLGdCQUFnQiwyQkFBMkIsV0FBWTtBQUN2RSxRQUFNLFNBQTJCLENBQUM7QUFDbEMsUUFBTSxPQUFPLG9CQUFJLElBQVk7QUFDN0IsYUFBVyxRQUFRLGNBQWMsSUFBSSxHQUFHO0FBQ3ZDLFFBQUksQ0FBQyxLQUFLLElBQUksS0FBSyxHQUFHLEdBQUc7QUFDeEIsV0FBSyxJQUFJLEtBQUssR0FBRztBQUNqQixhQUFPLEtBQUssSUFBSTtBQUFBLElBQ2pCO0FBQUEsRUFDRDtBQUNBLFNBQU8sS0FBSyxDQUFDLEdBQUcsTUFBTSxFQUFFLElBQUksY0FBYyxFQUFFLEdBQUcsQ0FBQztBQUNoRCxVQUFRLElBQUksS0FBSyxVQUFVLFFBQVEsUUFBVyxDQUFDLENBQUM7QUFDakQsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
