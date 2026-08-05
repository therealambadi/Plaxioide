import { GlobalIdleValue } from "../../../base/common/async.js";
import { illegalState } from "../../../base/common/errors.js";
import { dispose, isDisposable, toDisposable } from "../../../base/common/lifecycle.js";
import { SyncDescriptor } from "./descriptors.js";
import { Graph } from "./graph.js";
import { IInstantiationService, _util } from "./instantiation.js";
import { ServiceCollection } from "./serviceCollection.js";
import { LinkedList } from "../../../base/common/linkedList.js";
const _enableAllTracing = false;
class CyclicDependencyError extends Error {
  constructor(graph) {
    super("cyclic dependency between services");
    this.message = graph.findCycleSlow() ?? `UNABLE to detect cycle, dumping graph: 
${graph.toString()}`;
  }
}
class InstantiationService {
  constructor(_services = new ServiceCollection(), _strict = false, _parent, _enableTracing = _enableAllTracing) {
    this._services = _services;
    this._strict = _strict;
    this._parent = _parent;
    this._enableTracing = _enableTracing;
    this._isDisposed = false;
    this._servicesToMaybeDispose = /* @__PURE__ */ new Set();
    this._children = /* @__PURE__ */ new Set();
    this._activeInstantiations = /* @__PURE__ */ new Set();
    this._services.set(IInstantiationService, this);
    this._globalGraph = _enableTracing ? _parent?._globalGraph ?? new Graph((e) => e) : void 0;
  }
  dispose() {
    if (!this._isDisposed) {
      this._isDisposed = true;
      dispose(this._children);
      this._children.clear();
      for (const candidate of this._servicesToMaybeDispose) {
        if (isDisposable(candidate)) {
          candidate.dispose();
        }
      }
      this._servicesToMaybeDispose.clear();
    }
  }
  _throwIfDisposed() {
    if (this._isDisposed) {
      throw new Error("InstantiationService has been disposed");
    }
  }
  createChild(services, store) {
    this._throwIfDisposed();
    const that = this;
    const result = new class extends InstantiationService {
      dispose() {
        that._children.delete(result);
        super.dispose();
      }
    }(services, this._strict, this, this._enableTracing);
    this._children.add(result);
    store?.add(result);
    return result;
  }
  invokeFunction(fn, ...args) {
    this._throwIfDisposed();
    const _trace = Trace.traceInvocation(this._enableTracing, fn);
    let _done = false;
    try {
      const accessor = {
        get: (id) => {
          if (_done) {
            throw illegalState("service accessor is only valid during the invocation of its target method");
          }
          const result = this._getOrCreateServiceInstance(id, _trace);
          if (!result) {
            throw new Error(`[invokeFunction] unknown service '${id}'`);
          }
          return result;
        }
      };
      return fn(accessor, ...args);
    } finally {
      _done = true;
      _trace.stop();
    }
  }
  createInstance(ctorOrDescriptor, ...rest) {
    this._throwIfDisposed();
    let _trace;
    let result;
    if (ctorOrDescriptor instanceof SyncDescriptor) {
      _trace = Trace.traceCreation(this._enableTracing, ctorOrDescriptor.ctor);
      result = this._createInstance(ctorOrDescriptor.ctor, ctorOrDescriptor.staticArguments.concat(rest), _trace);
    } else {
      _trace = Trace.traceCreation(this._enableTracing, ctorOrDescriptor);
      result = this._createInstance(ctorOrDescriptor, rest, _trace);
    }
    _trace.stop();
    return result;
  }
  _createInstance(ctor, args = [], _trace) {
    const serviceDependencies = _util.getServiceDependencies(ctor).sort((a, b) => a.index - b.index);
    const serviceArgs = [];
    for (const dependency of serviceDependencies) {
      const service = this._getOrCreateServiceInstance(dependency.id, _trace);
      if (!service) {
        this._throwIfStrict(`[createInstance] ${ctor.name} depends on UNKNOWN service ${dependency.id}.`, false);
      }
      serviceArgs.push(service);
    }
    const firstServiceArgPos = serviceDependencies.length > 0 ? serviceDependencies[0].index : args.length;
    if (args.length !== firstServiceArgPos) {
      console.trace(`[createInstance] First service dependency of ${ctor.name} at position ${firstServiceArgPos + 1} conflicts with ${args.length} static arguments`);
      const delta = firstServiceArgPos - args.length;
      if (delta > 0) {
        args = args.concat(new Array(delta));
      } else {
        args = args.slice(0, firstServiceArgPos);
      }
    }
    return Reflect.construct(ctor, args.concat(serviceArgs));
  }
  _setCreatedServiceInstance(id, instance) {
    if (this._services.get(id) instanceof SyncDescriptor) {
      this._services.set(id, instance);
    } else if (this._parent) {
      this._parent._setCreatedServiceInstance(id, instance);
    } else {
      throw new Error("illegalState - setting UNKNOWN service instance");
    }
  }
  _getServiceInstanceOrDescriptor(id) {
    const instanceOrDesc = this._services.get(id);
    if (!instanceOrDesc && this._parent) {
      return this._parent._getServiceInstanceOrDescriptor(id);
    } else {
      return instanceOrDesc;
    }
  }
  _getOrCreateServiceInstance(id, _trace) {
    if (this._globalGraph && this._globalGraphImplicitDependency) {
      this._globalGraph.insertEdge(this._globalGraphImplicitDependency, String(id));
    }
    const thing = this._getServiceInstanceOrDescriptor(id);
    if (thing instanceof SyncDescriptor) {
      return this._safeCreateAndCacheServiceInstance(id, thing, _trace.branch(id, true));
    } else {
      _trace.branch(id, false);
      return thing;
    }
  }
  _safeCreateAndCacheServiceInstance(id, desc, _trace) {
    if (this._activeInstantiations.has(id)) {
      throw new Error(`illegal state - RECURSIVELY instantiating service '${id}'`);
    }
    this._activeInstantiations.add(id);
    try {
      return this._createAndCacheServiceInstance(id, desc, _trace);
    } finally {
      this._activeInstantiations.delete(id);
    }
  }
  _createAndCacheServiceInstance(id, desc, _trace) {
    const graph = new Graph((data) => data.id.toString());
    let cycleCount = 0;
    const stack = [{ id, desc, _trace }];
    const seen = /* @__PURE__ */ new Set();
    while (stack.length) {
      const item = stack.pop();
      if (seen.has(String(item.id))) {
        continue;
      }
      seen.add(String(item.id));
      graph.lookupOrInsertNode(item);
      if (cycleCount++ > 1e3) {
        throw new CyclicDependencyError(graph);
      }
      for (const dependency of _util.getServiceDependencies(item.desc.ctor)) {
        const instanceOrDesc = this._getServiceInstanceOrDescriptor(dependency.id);
        if (!instanceOrDesc) {
          this._throwIfStrict(`[createInstance] ${id} depends on ${dependency.id} which is NOT registered.`, true);
        }
        this._globalGraph?.insertEdge(String(item.id), String(dependency.id));
        if (instanceOrDesc instanceof SyncDescriptor) {
          const d = { id: dependency.id, desc: instanceOrDesc, _trace: item._trace.branch(dependency.id, true) };
          graph.insertEdge(item, d);
          stack.push(d);
        }
      }
    }
    while (true) {
      const roots = graph.roots();
      if (roots.length === 0) {
        if (!graph.isEmpty()) {
          throw new CyclicDependencyError(graph);
        }
        break;
      }
      for (const { data } of roots) {
        const instanceOrDesc = this._getServiceInstanceOrDescriptor(data.id);
        if (instanceOrDesc instanceof SyncDescriptor) {
          const instance = this._createServiceInstanceWithOwner(data.id, data.desc.ctor, data.desc.staticArguments, data.desc.supportsDelayedInstantiation, data._trace);
          this._setCreatedServiceInstance(data.id, instance);
        }
        graph.removeNode(data);
      }
    }
    return this._getServiceInstanceOrDescriptor(id);
  }
  _createServiceInstanceWithOwner(id, ctor, args = [], supportsDelayedInstantiation, _trace) {
    if (this._services.get(id) instanceof SyncDescriptor) {
      return this._createServiceInstance(id, ctor, args, supportsDelayedInstantiation, _trace, this._servicesToMaybeDispose);
    } else if (this._parent) {
      return this._parent._createServiceInstanceWithOwner(id, ctor, args, supportsDelayedInstantiation, _trace);
    } else {
      throw new Error(`illegalState - creating UNKNOWN service instance ${ctor.name}`);
    }
  }
  _createServiceInstance(id, ctor, args = [], supportsDelayedInstantiation, _trace, disposeBucket) {
    if (!supportsDelayedInstantiation) {
      const result = this._createInstance(ctor, args, _trace);
      disposeBucket.add(result);
      return result;
    } else {
      const child = new InstantiationService(void 0, this._strict, this, this._enableTracing);
      child._globalGraphImplicitDependency = String(id);
      const earlyListeners = /* @__PURE__ */ new Map();
      const idle = new GlobalIdleValue(() => {
        const result = child._createInstance(ctor, args, _trace);
        for (const [key, values] of earlyListeners) {
          const candidate = result[key];
          if (typeof candidate === "function") {
            for (const value of values) {
              value.disposable = candidate.apply(result, value.listener);
            }
          }
        }
        earlyListeners.clear();
        disposeBucket.add(result);
        return result;
      });
      return new Proxy(/* @__PURE__ */ Object.create(null), {
        get(target, key) {
          if (!idle.isInitialized) {
            if (typeof key === "string" && (key.startsWith("onDid") || key.startsWith("onWill"))) {
              let list = earlyListeners.get(key);
              if (!list) {
                list = new LinkedList();
                earlyListeners.set(key, list);
              }
              const event = (callback, thisArg, disposables) => {
                if (idle.isInitialized) {
                  return idle.value[key](callback, thisArg, disposables);
                } else {
                  const entry = { listener: [callback, thisArg, disposables], disposable: void 0 };
                  const rm = list.push(entry);
                  const result = toDisposable(() => {
                    rm();
                    entry.disposable?.dispose();
                  });
                  return result;
                }
              };
              return event;
            }
          }
          if (key in target) {
            return target[key];
          }
          const obj = idle.value;
          let prop = obj[key];
          if (typeof prop !== "function") {
            return prop;
          }
          prop = prop.bind(obj);
          target[key] = prop;
          return prop;
        },
        set(_target, p, value) {
          idle.value[p] = value;
          return true;
        },
        getPrototypeOf(_target) {
          return ctor.prototype;
        }
      });
    }
  }
  _throwIfStrict(msg, printWarning) {
    if (printWarning) {
      console.warn(msg);
    }
    if (this._strict) {
      throw new Error(msg);
    }
  }
}
var TraceType = /* @__PURE__ */ ((TraceType2) => {
  TraceType2[TraceType2["None"] = 0] = "None";
  TraceType2[TraceType2["Creation"] = 1] = "Creation";
  TraceType2[TraceType2["Invocation"] = 2] = "Invocation";
  TraceType2[TraceType2["Branch"] = 3] = "Branch";
  return TraceType2;
})(TraceType || {});
const _Trace = class _Trace {
  constructor(type, name) {
    this.type = type;
    this.name = name;
    this._start = Date.now();
    this._dep = [];
  }
  static traceInvocation(_enableTracing, ctor) {
    return !_enableTracing ? _Trace._None : new _Trace(2 /* Invocation */, ctor.name || new Error().stack.split("\n").slice(3, 4).join("\n"));
  }
  static traceCreation(_enableTracing, ctor) {
    return !_enableTracing ? _Trace._None : new _Trace(1 /* Creation */, ctor.name);
  }
  branch(id, first) {
    const child = new _Trace(3 /* Branch */, id.toString());
    this._dep.push([id, first, child]);
    return child;
  }
  stop() {
    const dur = Date.now() - this._start;
    _Trace._totals += dur;
    let causedCreation = false;
    function printChild(n, trace) {
      const res = [];
      const prefix = new Array(n + 1).join("	");
      for (const [id, first, child] of trace._dep) {
        if (first && child) {
          causedCreation = true;
          res.push(`${prefix}CREATES -> ${id}`);
          const nested = printChild(n + 1, child);
          if (nested) {
            res.push(nested);
          }
        } else {
          res.push(`${prefix}uses -> ${id}`);
        }
      }
      return res.join("\n");
    }
    const lines = [
      `${this.type === 1 /* Creation */ ? "CREATE" : "CALL"} ${this.name}`,
      `${printChild(1, this)}`,
      `DONE, took ${dur.toFixed(2)}ms (grand total ${_Trace._totals.toFixed(2)}ms)`
    ];
    if (dur > 2 || causedCreation) {
      _Trace.all.add(lines.join("\n"));
    }
  }
};
_Trace.all = /* @__PURE__ */ new Set();
_Trace._None = new class extends _Trace {
  constructor() {
    super(0 /* None */, null);
  }
  stop() {
  }
  branch() {
    return this;
  }
}();
_Trace._totals = 0;
let Trace = _Trace;
export {
  InstantiationService,
  Trace
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEdsb2JhbElkbGVWYWx1ZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgaWxsZWdhbFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgZGlzcG9zZSwgSURpc3Bvc2FibGUsIGlzRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yLCBTeW5jRGVzY3JpcHRvcjAgfSBmcm9tICcuL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IEdyYXBoIH0gZnJvbSAnLi9ncmFwaC5qcyc7XG5pbXBvcnQgeyBHZXRMZWFkaW5nTm9uU2VydmljZUFyZ3MsIElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZUlkZW50aWZpZXIsIFNlcnZpY2VzQWNjZXNzb3IsIF91dGlsIH0gZnJvbSAnLi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi9zZXJ2aWNlQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBMaW5rZWRMaXN0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlua2VkTGlzdC5qcyc7XG5cbi8vIFRSQUNJTkdcbmNvbnN0IF9lbmFibGVBbGxUcmFjaW5nID0gZmFsc2Vcblx0Ly8gfHwgXCJUUlVFXCIgLy8gRE8gTk9UIENIRUNLIElOIVxuXHQ7XG5cbmNsYXNzIEN5Y2xpY0RlcGVuZGVuY3lFcnJvciBleHRlbmRzIEVycm9yIHtcblx0Y29uc3RydWN0b3IoZ3JhcGg6IEdyYXBoPGFueT4pIHtcblx0XHRzdXBlcignY3ljbGljIGRlcGVuZGVuY3kgYmV0d2VlbiBzZXJ2aWNlcycpO1xuXHRcdHRoaXMubWVzc2FnZSA9IGdyYXBoLmZpbmRDeWNsZVNsb3coKSA/PyBgVU5BQkxFIHRvIGRldGVjdCBjeWNsZSwgZHVtcGluZyBncmFwaDogXFxuJHtncmFwaC50b1N0cmluZygpfWA7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEluc3RhbnRpYXRpb25TZXJ2aWNlIGltcGxlbWVudHMgSUluc3RhbnRpYXRpb25TZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRyZWFkb25seSBfZ2xvYmFsR3JhcGg/OiBHcmFwaDxzdHJpbmc+O1xuXHRwcml2YXRlIF9nbG9iYWxHcmFwaEltcGxpY2l0RGVwZW5kZW5jeT86IHN0cmluZztcblxuXHRwcml2YXRlIF9pc0Rpc3Bvc2VkID0gZmFsc2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3NlcnZpY2VzVG9NYXliZURpc3Bvc2UgPSBuZXcgU2V0PGFueT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfY2hpbGRyZW4gPSBuZXcgU2V0PEluc3RhbnRpYXRpb25TZXJ2aWNlPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3NlcnZpY2VzOiBTZXJ2aWNlQ29sbGVjdGlvbiA9IG5ldyBTZXJ2aWNlQ29sbGVjdGlvbigpLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3N0cmljdDogYm9vbGVhbiA9IGZhbHNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3BhcmVudD86IEluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VuYWJsZVRyYWNpbmc6IGJvb2xlYW4gPSBfZW5hYmxlQWxsVHJhY2luZ1xuXHQpIHtcblxuXHRcdHRoaXMuX3NlcnZpY2VzLnNldChJSW5zdGFudGlhdGlvblNlcnZpY2UsIHRoaXMpO1xuXHRcdHRoaXMuX2dsb2JhbEdyYXBoID0gX2VuYWJsZVRyYWNpbmcgPyBfcGFyZW50Py5fZ2xvYmFsR3JhcGggPz8gbmV3IEdyYXBoKGUgPT4gZSkgOiB1bmRlZmluZWQ7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGlmICghdGhpcy5faXNEaXNwb3NlZCkge1xuXHRcdFx0dGhpcy5faXNEaXNwb3NlZCA9IHRydWU7XG5cdFx0XHQvLyBkaXNwb3NlIGFsbCBjaGlsZCBzZXJ2aWNlc1xuXHRcdFx0ZGlzcG9zZSh0aGlzLl9jaGlsZHJlbik7XG5cdFx0XHR0aGlzLl9jaGlsZHJlbi5jbGVhcigpO1xuXG5cdFx0XHQvLyBkaXNwb3NlIGFsbCBzZXJ2aWNlcyBjcmVhdGVkIGJ5IHRoaXMgc2VydmljZVxuXHRcdFx0Zm9yIChjb25zdCBjYW5kaWRhdGUgb2YgdGhpcy5fc2VydmljZXNUb01heWJlRGlzcG9zZSkge1xuXHRcdFx0XHRpZiAoaXNEaXNwb3NhYmxlKGNhbmRpZGF0ZSkpIHtcblx0XHRcdFx0XHRjYW5kaWRhdGUuZGlzcG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9zZXJ2aWNlc1RvTWF5YmVEaXNwb3NlLmNsZWFyKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfdGhyb3dJZkRpc3Bvc2VkKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0luc3RhbnRpYXRpb25TZXJ2aWNlIGhhcyBiZWVuIGRpc3Bvc2VkJyk7XG5cdFx0fVxuXHR9XG5cblx0Y3JlYXRlQ2hpbGQoc2VydmljZXM6IFNlcnZpY2VDb2xsZWN0aW9uLCBzdG9yZT86IERpc3Bvc2FibGVTdG9yZSk6IElJbnN0YW50aWF0aW9uU2VydmljZSB7XG5cdFx0dGhpcy5fdGhyb3dJZkRpc3Bvc2VkKCk7XG5cblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRjb25zdCByZXN1bHQgPSBuZXcgY2xhc3MgZXh0ZW5kcyBJbnN0YW50aWF0aW9uU2VydmljZSB7XG5cdFx0XHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdFx0XHR0aGF0Ll9jaGlsZHJlbi5kZWxldGUocmVzdWx0KTtcblx0XHRcdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH0oc2VydmljZXMsIHRoaXMuX3N0cmljdCwgdGhpcywgdGhpcy5fZW5hYmxlVHJhY2luZyk7XG5cdFx0dGhpcy5fY2hpbGRyZW4uYWRkKHJlc3VsdCk7XG5cblx0XHRzdG9yZT8uYWRkKHJlc3VsdCk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGludm9rZUZ1bmN0aW9uPFIsIFRTIGV4dGVuZHMgYW55W10gPSBbXT4oZm46IChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogVFMpID0+IFIsIC4uLmFyZ3M6IFRTKTogUiB7XG5cdFx0dGhpcy5fdGhyb3dJZkRpc3Bvc2VkKCk7XG5cblx0XHRjb25zdCBfdHJhY2UgPSBUcmFjZS50cmFjZUludm9jYXRpb24odGhpcy5fZW5hYmxlVHJhY2luZywgZm4pO1xuXHRcdGxldCBfZG9uZSA9IGZhbHNlO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciA9IHtcblx0XHRcdFx0Z2V0OiA8VD4oaWQ6IFNlcnZpY2VJZGVudGlmaWVyPFQ+KSA9PiB7XG5cblx0XHRcdFx0XHRpZiAoX2RvbmUpIHtcblx0XHRcdFx0XHRcdHRocm93IGlsbGVnYWxTdGF0ZSgnc2VydmljZSBhY2Nlc3NvciBpcyBvbmx5IHZhbGlkIGR1cmluZyB0aGUgaW52b2NhdGlvbiBvZiBpdHMgdGFyZ2V0IG1ldGhvZCcpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuX2dldE9yQ3JlYXRlU2VydmljZUluc3RhbmNlKGlkLCBfdHJhY2UpO1xuXHRcdFx0XHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFtpbnZva2VGdW5jdGlvbl0gdW5rbm93biBzZXJ2aWNlICcke2lkfSdgKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHRcdHJldHVybiBmbihhY2Nlc3NvciwgLi4uYXJncyk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdF9kb25lID0gdHJ1ZTtcblx0XHRcdF90cmFjZS5zdG9wKCk7XG5cdFx0fVxuXHR9XG5cblx0Y3JlYXRlSW5zdGFuY2U8VD4oZGVzY3JpcHRvcjogU3luY0Rlc2NyaXB0b3IwPFQ+KTogVDtcblx0Y3JlYXRlSW5zdGFuY2U8Q3RvciBleHRlbmRzIG5ldyAoLi4uYXJnczogYW55W10pID0+IHVua25vd24sIFIgZXh0ZW5kcyBJbnN0YW5jZVR5cGU8Q3Rvcj4+KGN0b3I6IEN0b3IsIC4uLmFyZ3M6IEdldExlYWRpbmdOb25TZXJ2aWNlQXJnczxDb25zdHJ1Y3RvclBhcmFtZXRlcnM8Q3Rvcj4+KTogUjtcblx0Y3JlYXRlSW5zdGFuY2UoY3Rvck9yRGVzY3JpcHRvcjogYW55IHwgU3luY0Rlc2NyaXB0b3I8YW55PiwgLi4ucmVzdDogYW55W10pOiB1bmtub3duIHtcblx0XHR0aGlzLl90aHJvd0lmRGlzcG9zZWQoKTtcblxuXHRcdGxldCBfdHJhY2U6IFRyYWNlO1xuXHRcdGxldCByZXN1bHQ6IGFueTtcblx0XHRpZiAoY3Rvck9yRGVzY3JpcHRvciBpbnN0YW5jZW9mIFN5bmNEZXNjcmlwdG9yKSB7XG5cdFx0XHRfdHJhY2UgPSBUcmFjZS50cmFjZUNyZWF0aW9uKHRoaXMuX2VuYWJsZVRyYWNpbmcsIGN0b3JPckRlc2NyaXB0b3IuY3Rvcik7XG5cdFx0XHRyZXN1bHQgPSB0aGlzLl9jcmVhdGVJbnN0YW5jZShjdG9yT3JEZXNjcmlwdG9yLmN0b3IsIGN0b3JPckRlc2NyaXB0b3Iuc3RhdGljQXJndW1lbnRzLmNvbmNhdChyZXN0KSwgX3RyYWNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0X3RyYWNlID0gVHJhY2UudHJhY2VDcmVhdGlvbih0aGlzLl9lbmFibGVUcmFjaW5nLCBjdG9yT3JEZXNjcmlwdG9yKTtcblx0XHRcdHJlc3VsdCA9IHRoaXMuX2NyZWF0ZUluc3RhbmNlKGN0b3JPckRlc2NyaXB0b3IsIHJlc3QsIF90cmFjZSk7XG5cdFx0fVxuXHRcdF90cmFjZS5zdG9wKCk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZUluc3RhbmNlPFQ+KGN0b3I6IGFueSwgYXJnczogYW55W10gPSBbXSwgX3RyYWNlOiBUcmFjZSk6IFQge1xuXG5cdFx0Ly8gYXJndW1lbnRzIGRlZmluZWQgYnkgc2VydmljZSBkZWNvcmF0b3JzXG5cdFx0Y29uc3Qgc2VydmljZURlcGVuZGVuY2llcyA9IF91dGlsLmdldFNlcnZpY2VEZXBlbmRlbmNpZXMoY3Rvcikuc29ydCgoYSwgYikgPT4gYS5pbmRleCAtIGIuaW5kZXgpO1xuXHRcdGNvbnN0IHNlcnZpY2VBcmdzOiBhbnlbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgZGVwZW5kZW5jeSBvZiBzZXJ2aWNlRGVwZW5kZW5jaWVzKSB7XG5cdFx0XHRjb25zdCBzZXJ2aWNlID0gdGhpcy5fZ2V0T3JDcmVhdGVTZXJ2aWNlSW5zdGFuY2UoZGVwZW5kZW5jeS5pZCwgX3RyYWNlKTtcblx0XHRcdGlmICghc2VydmljZSkge1xuXHRcdFx0XHR0aGlzLl90aHJvd0lmU3RyaWN0KGBbY3JlYXRlSW5zdGFuY2VdICR7Y3Rvci5uYW1lfSBkZXBlbmRzIG9uIFVOS05PV04gc2VydmljZSAke2RlcGVuZGVuY3kuaWR9LmAsIGZhbHNlKTtcblx0XHRcdH1cblx0XHRcdHNlcnZpY2VBcmdzLnB1c2goc2VydmljZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmlyc3RTZXJ2aWNlQXJnUG9zID0gc2VydmljZURlcGVuZGVuY2llcy5sZW5ndGggPiAwID8gc2VydmljZURlcGVuZGVuY2llc1swXS5pbmRleCA6IGFyZ3MubGVuZ3RoO1xuXG5cdFx0Ly8gY2hlY2sgZm9yIGFyZ3VtZW50IG1pc21hdGNoZXMsIGFkanVzdCBzdGF0aWMgYXJncyBpZiBuZWVkZWRcblx0XHRpZiAoYXJncy5sZW5ndGggIT09IGZpcnN0U2VydmljZUFyZ1Bvcykge1xuXHRcdFx0Y29uc29sZS50cmFjZShgW2NyZWF0ZUluc3RhbmNlXSBGaXJzdCBzZXJ2aWNlIGRlcGVuZGVuY3kgb2YgJHtjdG9yLm5hbWV9IGF0IHBvc2l0aW9uICR7Zmlyc3RTZXJ2aWNlQXJnUG9zICsgMX0gY29uZmxpY3RzIHdpdGggJHthcmdzLmxlbmd0aH0gc3RhdGljIGFyZ3VtZW50c2ApO1xuXG5cdFx0XHRjb25zdCBkZWx0YSA9IGZpcnN0U2VydmljZUFyZ1BvcyAtIGFyZ3MubGVuZ3RoO1xuXHRcdFx0aWYgKGRlbHRhID4gMCkge1xuXHRcdFx0XHRhcmdzID0gYXJncy5jb25jYXQobmV3IEFycmF5KGRlbHRhKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhcmdzID0gYXJncy5zbGljZSgwLCBmaXJzdFNlcnZpY2VBcmdQb3MpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIG5vdyBjcmVhdGUgdGhlIGluc3RhbmNlXG5cdFx0cmV0dXJuIFJlZmxlY3QuY29uc3RydWN0PGFueSwgVD4oY3RvciwgYXJncy5jb25jYXQoc2VydmljZUFyZ3MpKTtcblx0fVxuXG5cdHByaXZhdGUgX3NldENyZWF0ZWRTZXJ2aWNlSW5zdGFuY2U8VD4oaWQ6IFNlcnZpY2VJZGVudGlmaWVyPFQ+LCBpbnN0YW5jZTogVCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9zZXJ2aWNlcy5nZXQoaWQpIGluc3RhbmNlb2YgU3luY0Rlc2NyaXB0b3IpIHtcblx0XHRcdHRoaXMuX3NlcnZpY2VzLnNldChpZCwgaW5zdGFuY2UpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5fcGFyZW50KSB7XG5cdFx0XHR0aGlzLl9wYXJlbnQuX3NldENyZWF0ZWRTZXJ2aWNlSW5zdGFuY2UoaWQsIGluc3RhbmNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdpbGxlZ2FsU3RhdGUgLSBzZXR0aW5nIFVOS05PV04gc2VydmljZSBpbnN0YW5jZScpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2dldFNlcnZpY2VJbnN0YW5jZU9yRGVzY3JpcHRvcjxUPihpZDogU2VydmljZUlkZW50aWZpZXI8VD4pOiBUIHwgU3luY0Rlc2NyaXB0b3I8VD4ge1xuXHRcdGNvbnN0IGluc3RhbmNlT3JEZXNjID0gdGhpcy5fc2VydmljZXMuZ2V0KGlkKTtcblx0XHRpZiAoIWluc3RhbmNlT3JEZXNjICYmIHRoaXMuX3BhcmVudCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3BhcmVudC5fZ2V0U2VydmljZUluc3RhbmNlT3JEZXNjcmlwdG9yKGlkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIGluc3RhbmNlT3JEZXNjO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBfZ2V0T3JDcmVhdGVTZXJ2aWNlSW5zdGFuY2U8VD4oaWQ6IFNlcnZpY2VJZGVudGlmaWVyPFQ+LCBfdHJhY2U6IFRyYWNlKTogVCB7XG5cdFx0aWYgKHRoaXMuX2dsb2JhbEdyYXBoICYmIHRoaXMuX2dsb2JhbEdyYXBoSW1wbGljaXREZXBlbmRlbmN5KSB7XG5cdFx0XHR0aGlzLl9nbG9iYWxHcmFwaC5pbnNlcnRFZGdlKHRoaXMuX2dsb2JhbEdyYXBoSW1wbGljaXREZXBlbmRlbmN5LCBTdHJpbmcoaWQpKTtcblx0XHR9XG5cdFx0Y29uc3QgdGhpbmcgPSB0aGlzLl9nZXRTZXJ2aWNlSW5zdGFuY2VPckRlc2NyaXB0b3IoaWQpO1xuXHRcdGlmICh0aGluZyBpbnN0YW5jZW9mIFN5bmNEZXNjcmlwdG9yKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fc2FmZUNyZWF0ZUFuZENhY2hlU2VydmljZUluc3RhbmNlKGlkLCB0aGluZywgX3RyYWNlLmJyYW5jaChpZCwgdHJ1ZSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRfdHJhY2UuYnJhbmNoKGlkLCBmYWxzZSk7XG5cdFx0XHRyZXR1cm4gdGhpbmc7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYWN0aXZlSW5zdGFudGlhdGlvbnMgPSBuZXcgU2V0PFNlcnZpY2VJZGVudGlmaWVyPGFueT4+KCk7XG5cblxuXHRwcml2YXRlIF9zYWZlQ3JlYXRlQW5kQ2FjaGVTZXJ2aWNlSW5zdGFuY2U8VD4oaWQ6IFNlcnZpY2VJZGVudGlmaWVyPFQ+LCBkZXNjOiBTeW5jRGVzY3JpcHRvcjxUPiwgX3RyYWNlOiBUcmFjZSk6IFQge1xuXHRcdGlmICh0aGlzLl9hY3RpdmVJbnN0YW50aWF0aW9ucy5oYXMoaWQpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYGlsbGVnYWwgc3RhdGUgLSBSRUNVUlNJVkVMWSBpbnN0YW50aWF0aW5nIHNlcnZpY2UgJyR7aWR9J2ApO1xuXHRcdH1cblx0XHR0aGlzLl9hY3RpdmVJbnN0YW50aWF0aW9ucy5hZGQoaWQpO1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlQW5kQ2FjaGVTZXJ2aWNlSW5zdGFuY2UoaWQsIGRlc2MsIF90cmFjZSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuX2FjdGl2ZUluc3RhbnRpYXRpb25zLmRlbGV0ZShpZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlQW5kQ2FjaGVTZXJ2aWNlSW5zdGFuY2U8VD4oaWQ6IFNlcnZpY2VJZGVudGlmaWVyPFQ+LCBkZXNjOiBTeW5jRGVzY3JpcHRvcjxUPiwgX3RyYWNlOiBUcmFjZSk6IFQge1xuXG5cdFx0dHlwZSBUcmlwbGUgPSB7IGlkOiBTZXJ2aWNlSWRlbnRpZmllcjxhbnk+OyBkZXNjOiBTeW5jRGVzY3JpcHRvcjxhbnk+OyBfdHJhY2U6IFRyYWNlIH07XG5cdFx0Y29uc3QgZ3JhcGggPSBuZXcgR3JhcGg8VHJpcGxlPihkYXRhID0+IGRhdGEuaWQudG9TdHJpbmcoKSk7XG5cblx0XHRsZXQgY3ljbGVDb3VudCA9IDA7XG5cdFx0Y29uc3Qgc3RhY2sgPSBbeyBpZCwgZGVzYywgX3RyYWNlIH1dO1xuXHRcdGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHR3aGlsZSAoc3RhY2subGVuZ3RoKSB7XG5cdFx0XHRjb25zdCBpdGVtID0gc3RhY2sucG9wKCkhO1xuXG5cdFx0XHRpZiAoc2Vlbi5oYXMoU3RyaW5nKGl0ZW0uaWQpKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdHNlZW4uYWRkKFN0cmluZyhpdGVtLmlkKSk7XG5cblx0XHRcdGdyYXBoLmxvb2t1cE9ySW5zZXJ0Tm9kZShpdGVtKTtcblxuXHRcdFx0Ly8gYSB3ZWFrIGJ1dCB3b3JraW5nIGhldXJpc3RpYyBmb3IgY3ljbGUgY2hlY2tzXG5cdFx0XHRpZiAoY3ljbGVDb3VudCsrID4gMTAwMCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgQ3ljbGljRGVwZW5kZW5jeUVycm9yKGdyYXBoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gY2hlY2sgYWxsIGRlcGVuZGVuY2llcyBmb3IgZXhpc3RlbmNlIGFuZCBpZiB0aGV5IG5lZWQgdG8gYmUgY3JlYXRlZCBmaXJzdFxuXHRcdFx0Zm9yIChjb25zdCBkZXBlbmRlbmN5IG9mIF91dGlsLmdldFNlcnZpY2VEZXBlbmRlbmNpZXMoaXRlbS5kZXNjLmN0b3IpKSB7XG5cblx0XHRcdFx0Y29uc3QgaW5zdGFuY2VPckRlc2MgPSB0aGlzLl9nZXRTZXJ2aWNlSW5zdGFuY2VPckRlc2NyaXB0b3IoZGVwZW5kZW5jeS5pZCk7XG5cdFx0XHRcdGlmICghaW5zdGFuY2VPckRlc2MpIHtcblx0XHRcdFx0XHR0aGlzLl90aHJvd0lmU3RyaWN0KGBbY3JlYXRlSW5zdGFuY2VdICR7aWR9IGRlcGVuZHMgb24gJHtkZXBlbmRlbmN5LmlkfSB3aGljaCBpcyBOT1QgcmVnaXN0ZXJlZC5gLCB0cnVlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIHRha2Ugbm90ZSBvZiBhbGwgc2VydmljZSBkZXBlbmRlbmNpZXNcblx0XHRcdFx0dGhpcy5fZ2xvYmFsR3JhcGg/Lmluc2VydEVkZ2UoU3RyaW5nKGl0ZW0uaWQpLCBTdHJpbmcoZGVwZW5kZW5jeS5pZCkpO1xuXG5cdFx0XHRcdGlmIChpbnN0YW5jZU9yRGVzYyBpbnN0YW5jZW9mIFN5bmNEZXNjcmlwdG9yKSB7XG5cdFx0XHRcdFx0Y29uc3QgZCA9IHsgaWQ6IGRlcGVuZGVuY3kuaWQsIGRlc2M6IGluc3RhbmNlT3JEZXNjLCBfdHJhY2U6IGl0ZW0uX3RyYWNlLmJyYW5jaChkZXBlbmRlbmN5LmlkLCB0cnVlKSB9O1xuXHRcdFx0XHRcdGdyYXBoLmluc2VydEVkZ2UoaXRlbSwgZCk7XG5cdFx0XHRcdFx0c3RhY2sucHVzaChkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHdoaWxlICh0cnVlKSB7XG5cdFx0XHRjb25zdCByb290cyA9IGdyYXBoLnJvb3RzKCk7XG5cblx0XHRcdC8vIGlmIHRoZXJlIGlzIG5vIG1vcmUgcm9vdHMgYnV0IHN0aWxsXG5cdFx0XHQvLyBub2RlcyBpbiB0aGUgZ3JhcGggd2UgaGF2ZSBhIGN5Y2xlXG5cdFx0XHRpZiAocm9vdHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdGlmICghZ3JhcGguaXNFbXB0eSgpKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEN5Y2xpY0RlcGVuZGVuY3lFcnJvcihncmFwaCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3QgeyBkYXRhIH0gb2Ygcm9vdHMpIHtcblx0XHRcdFx0Ly8gUmVwZWF0IHRoZSBjaGVjayBmb3IgdGhpcyBzdGlsbCBiZWluZyBhIHNlcnZpY2Ugc3luYyBkZXNjcmlwdG9yLiBUaGF0J3MgYmVjYXVzZVxuXHRcdFx0XHQvLyBpbnN0YW50aWF0aW5nIGEgZGVwZW5kZW5jeSBtaWdodCBoYXZlIHNpZGUtZWZmZWN0IGFuZCByZWN1cnNpdmVseSB0cmlnZ2VyIGluc3RhbnRpYXRpb25cblx0XHRcdFx0Ly8gc28gdGhhdCBzb21lIGRlcGVuZGVuY2llcyBhcmUgbm93IGZ1bGxmaWxsZWQgYWxyZWFkeS5cblx0XHRcdFx0Y29uc3QgaW5zdGFuY2VPckRlc2MgPSB0aGlzLl9nZXRTZXJ2aWNlSW5zdGFuY2VPckRlc2NyaXB0b3IoZGF0YS5pZCk7XG5cdFx0XHRcdGlmIChpbnN0YW5jZU9yRGVzYyBpbnN0YW5jZW9mIFN5bmNEZXNjcmlwdG9yKSB7XG5cdFx0XHRcdFx0Ly8gY3JlYXRlIGluc3RhbmNlIGFuZCBvdmVyd3JpdGUgdGhlIHNlcnZpY2UgY29sbGVjdGlvbnNcblx0XHRcdFx0XHRjb25zdCBpbnN0YW5jZSA9IHRoaXMuX2NyZWF0ZVNlcnZpY2VJbnN0YW5jZVdpdGhPd25lcihkYXRhLmlkLCBkYXRhLmRlc2MuY3RvciwgZGF0YS5kZXNjLnN0YXRpY0FyZ3VtZW50cywgZGF0YS5kZXNjLnN1cHBvcnRzRGVsYXllZEluc3RhbnRpYXRpb24sIGRhdGEuX3RyYWNlKTtcblx0XHRcdFx0XHR0aGlzLl9zZXRDcmVhdGVkU2VydmljZUluc3RhbmNlKGRhdGEuaWQsIGluc3RhbmNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRncmFwaC5yZW1vdmVOb2RlKGRhdGEpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gPFQ+dGhpcy5fZ2V0U2VydmljZUluc3RhbmNlT3JEZXNjcmlwdG9yKGlkKTtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZVNlcnZpY2VJbnN0YW5jZVdpdGhPd25lcjxUPihpZDogU2VydmljZUlkZW50aWZpZXI8VD4sIGN0b3I6IGFueSwgYXJnczogYW55W10gPSBbXSwgc3VwcG9ydHNEZWxheWVkSW5zdGFudGlhdGlvbjogYm9vbGVhbiwgX3RyYWNlOiBUcmFjZSk6IFQge1xuXHRcdGlmICh0aGlzLl9zZXJ2aWNlcy5nZXQoaWQpIGluc3RhbmNlb2YgU3luY0Rlc2NyaXB0b3IpIHtcblx0XHRcdHJldHVybiB0aGlzLl9jcmVhdGVTZXJ2aWNlSW5zdGFuY2UoaWQsIGN0b3IsIGFyZ3MsIHN1cHBvcnRzRGVsYXllZEluc3RhbnRpYXRpb24sIF90cmFjZSwgdGhpcy5fc2VydmljZXNUb01heWJlRGlzcG9zZSk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9wYXJlbnQpIHtcblx0XHRcdHJldHVybiB0aGlzLl9wYXJlbnQuX2NyZWF0ZVNlcnZpY2VJbnN0YW5jZVdpdGhPd25lcihpZCwgY3RvciwgYXJncywgc3VwcG9ydHNEZWxheWVkSW5zdGFudGlhdGlvbiwgX3RyYWNlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBpbGxlZ2FsU3RhdGUgLSBjcmVhdGluZyBVTktOT1dOIHNlcnZpY2UgaW5zdGFuY2UgJHtjdG9yLm5hbWV9YCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlU2VydmljZUluc3RhbmNlPFQ+KGlkOiBTZXJ2aWNlSWRlbnRpZmllcjxUPiwgY3RvcjogYW55LCBhcmdzOiBhbnlbXSA9IFtdLCBzdXBwb3J0c0RlbGF5ZWRJbnN0YW50aWF0aW9uOiBib29sZWFuLCBfdHJhY2U6IFRyYWNlLCBkaXNwb3NlQnVja2V0OiBTZXQ8YW55Pik6IFQge1xuXHRcdGlmICghc3VwcG9ydHNEZWxheWVkSW5zdGFudGlhdGlvbikge1xuXHRcdFx0Ly8gZWFnZXIgaW5zdGFudGlhdGlvblxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fY3JlYXRlSW5zdGFuY2U8VD4oY3RvciwgYXJncywgX3RyYWNlKTtcblx0XHRcdGRpc3Bvc2VCdWNrZXQuYWRkKHJlc3VsdCk7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGNoaWxkID0gbmV3IEluc3RhbnRpYXRpb25TZXJ2aWNlKHVuZGVmaW5lZCwgdGhpcy5fc3RyaWN0LCB0aGlzLCB0aGlzLl9lbmFibGVUcmFjaW5nKTtcblx0XHRcdGNoaWxkLl9nbG9iYWxHcmFwaEltcGxpY2l0RGVwZW5kZW5jeSA9IFN0cmluZyhpZCk7XG5cblx0XHRcdHR5cGUgRWFyeUxpc3RlbmVyRGF0YSA9IHtcblx0XHRcdFx0bGlzdGVuZXI6IFBhcmFtZXRlcnM8RXZlbnQ8YW55Pj47XG5cdFx0XHRcdGRpc3Bvc2FibGU/OiBJRGlzcG9zYWJsZTtcblx0XHRcdH07XG5cblx0XHRcdC8vIFJldHVybiBhIHByb3h5IG9iamVjdCB0aGF0J3MgYmFja2VkIGJ5IGFuIGlkbGUgdmFsdWUuIFRoYXRcblx0XHRcdC8vIHN0cmF0ZWd5IGlzIHRvIGluc3RhbnRpYXRlIHNlcnZpY2VzIGluIG91ciBpZGxlIHRpbWUgb3Igd2hlbiBhY3R1YWxseVxuXHRcdFx0Ly8gbmVlZGVkIGJ1dCBub3Qgd2hlbiBpbmplY3RlZCBpbnRvIGEgY29uc3VtZXJcblxuXHRcdFx0Ly8gcmV0dXJuIFwiZW1wdHkgZXZlbnRzXCIgd2hlbiB0aGUgc2VydmljZSBpc24ndCBpbnN0YW50aWF0ZWQgeWV0XG5cdFx0XHRjb25zdCBlYXJseUxpc3RlbmVycyA9IG5ldyBNYXA8c3RyaW5nLCBMaW5rZWRMaXN0PEVhcnlMaXN0ZW5lckRhdGE+PigpO1xuXG5cdFx0XHRjb25zdCBpZGxlID0gbmV3IEdsb2JhbElkbGVWYWx1ZTxhbnk+KCgpID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gY2hpbGQuX2NyZWF0ZUluc3RhbmNlPFQ+KGN0b3IsIGFyZ3MsIF90cmFjZSk7XG5cblx0XHRcdFx0Ly8gZWFybHkgbGlzdGVuZXJzIHRoYXQgd2Uga2VwdCBhcmUgbm93IGJlaW5nIHN1YnNjcmliZWQgdG9cblx0XHRcdFx0Ly8gdGhlIHJlYWwgc2VydmljZVxuXHRcdFx0XHRmb3IgKGNvbnN0IFtrZXksIHZhbHVlc10gb2YgZWFybHlMaXN0ZW5lcnMpIHtcblx0XHRcdFx0XHRjb25zdCBjYW5kaWRhdGUgPSA8RXZlbnQ8YW55Pj4oPGFueT5yZXN1bHQpW2tleV07XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBjYW5kaWRhdGUgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgdmFsdWUgb2YgdmFsdWVzKSB7XG5cdFx0XHRcdFx0XHRcdHZhbHVlLmRpc3Bvc2FibGUgPSBjYW5kaWRhdGUuYXBwbHkocmVzdWx0LCB2YWx1ZS5saXN0ZW5lcik7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGVhcmx5TGlzdGVuZXJzLmNsZWFyKCk7XG5cdFx0XHRcdGRpc3Bvc2VCdWNrZXQuYWRkKHJlc3VsdCk7XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiA8VD5uZXcgUHJveHkoT2JqZWN0LmNyZWF0ZShudWxsKSwge1xuXHRcdFx0XHRnZXQodGFyZ2V0OiBhbnksIGtleTogUHJvcGVydHlLZXkpOiB1bmtub3duIHtcblxuXHRcdFx0XHRcdGlmICghaWRsZS5pc0luaXRpYWxpemVkKSB7XG5cdFx0XHRcdFx0XHQvLyBsb29rcyBsaWtlIGFuIGV2ZW50XG5cdFx0XHRcdFx0XHRpZiAodHlwZW9mIGtleSA9PT0gJ3N0cmluZycgJiYgKGtleS5zdGFydHNXaXRoKCdvbkRpZCcpIHx8IGtleS5zdGFydHNXaXRoKCdvbldpbGwnKSkpIHtcblx0XHRcdFx0XHRcdFx0bGV0IGxpc3QgPSBlYXJseUxpc3RlbmVycy5nZXQoa2V5KTtcblx0XHRcdFx0XHRcdFx0aWYgKCFsaXN0KSB7XG5cdFx0XHRcdFx0XHRcdFx0bGlzdCA9IG5ldyBMaW5rZWRMaXN0KCk7XG5cdFx0XHRcdFx0XHRcdFx0ZWFybHlMaXN0ZW5lcnMuc2V0KGtleSwgbGlzdCk7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0Y29uc3QgZXZlbnQ6IEV2ZW50PGFueT4gPSAoY2FsbGJhY2ssIHRoaXNBcmcsIGRpc3Bvc2FibGVzKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGlkbGUuaXNJbml0aWFsaXplZCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGlkbGUudmFsdWVba2V5XShjYWxsYmFjaywgdGhpc0FyZywgZGlzcG9zYWJsZXMpO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBlbnRyeTogRWFyeUxpc3RlbmVyRGF0YSA9IHsgbGlzdGVuZXI6IFtjYWxsYmFjaywgdGhpc0FyZywgZGlzcG9zYWJsZXNdLCBkaXNwb3NhYmxlOiB1bmRlZmluZWQgfTtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IHJtID0gbGlzdC5wdXNoKGVudHJ5KTtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHJtKCk7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGVudHJ5LmRpc3Bvc2FibGU/LmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRcdHJldHVybiBldmVudDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyB2YWx1ZSBhbHJlYWR5IGV4aXN0c1xuXHRcdFx0XHRcdGlmIChrZXkgaW4gdGFyZ2V0KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGFyZ2V0W2tleV07XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Ly8gY3JlYXRlIHZhbHVlXG5cdFx0XHRcdFx0Y29uc3Qgb2JqID0gaWRsZS52YWx1ZTtcblx0XHRcdFx0XHRsZXQgcHJvcCA9IG9ialtrZXldO1xuXHRcdFx0XHRcdGlmICh0eXBlb2YgcHJvcCAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHByb3A7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHByb3AgPSBwcm9wLmJpbmQob2JqKTtcblx0XHRcdFx0XHR0YXJnZXRba2V5XSA9IHByb3A7XG5cdFx0XHRcdFx0cmV0dXJuIHByb3A7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHNldChfdGFyZ2V0OiBULCBwOiBQcm9wZXJ0eUtleSwgdmFsdWU6IGFueSk6IGJvb2xlYW4ge1xuXHRcdFx0XHRcdGlkbGUudmFsdWVbcF0gPSB2YWx1ZTtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fSxcblx0XHRcdFx0Z2V0UHJvdG90eXBlT2YoX3RhcmdldDogVCkge1xuXHRcdFx0XHRcdHJldHVybiBjdG9yLnByb3RvdHlwZTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfdGhyb3dJZlN0cmljdChtc2c6IHN0cmluZywgcHJpbnRXYXJuaW5nOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHByaW50V2FybmluZykge1xuXHRcdFx0Y29uc29sZS53YXJuKG1zZyk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9zdHJpY3QpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihtc2cpO1xuXHRcdH1cblx0fVxufVxuXG4vLyNyZWdpb24gLS0gdHJhY2luZyAtLS1cblxuY29uc3QgZW51bSBUcmFjZVR5cGUge1xuXHROb25lID0gMCxcblx0Q3JlYXRpb24gPSAxLFxuXHRJbnZvY2F0aW9uID0gMixcblx0QnJhbmNoID0gMyxcbn1cblxuZXhwb3J0IGNsYXNzIFRyYWNlIHtcblxuXHRzdGF0aWMgYWxsID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX05vbmUgPSBuZXcgY2xhc3MgZXh0ZW5kcyBUcmFjZSB7XG5cdFx0Y29uc3RydWN0b3IoKSB7IHN1cGVyKFRyYWNlVHlwZS5Ob25lLCBudWxsKTsgfVxuXHRcdG92ZXJyaWRlIHN0b3AoKSB7IH1cblx0XHRvdmVycmlkZSBicmFuY2goKSB7IHJldHVybiB0aGlzOyB9XG5cdH07XG5cblx0c3RhdGljIHRyYWNlSW52b2NhdGlvbihfZW5hYmxlVHJhY2luZzogYm9vbGVhbiwgY3RvcjogYW55KTogVHJhY2Uge1xuXHRcdHJldHVybiAhX2VuYWJsZVRyYWNpbmcgPyBUcmFjZS5fTm9uZSA6IG5ldyBUcmFjZShUcmFjZVR5cGUuSW52b2NhdGlvbiwgY3Rvci5uYW1lIHx8IG5ldyBFcnJvcigpLnN0YWNrIS5zcGxpdCgnXFxuJykuc2xpY2UoMywgNCkuam9pbignXFxuJykpO1xuXHR9XG5cblx0c3RhdGljIHRyYWNlQ3JlYXRpb24oX2VuYWJsZVRyYWNpbmc6IGJvb2xlYW4sIGN0b3I6IGFueSk6IFRyYWNlIHtcblx0XHRyZXR1cm4gIV9lbmFibGVUcmFjaW5nID8gVHJhY2UuX05vbmUgOiBuZXcgVHJhY2UoVHJhY2VUeXBlLkNyZWF0aW9uLCBjdG9yLm5hbWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3RvdGFsczogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSByZWFkb25seSBfc3RhcnQ6IG51bWJlciA9IERhdGUubm93KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlcDogW1NlcnZpY2VJZGVudGlmaWVyPGFueT4sIGJvb2xlYW4sIFRyYWNlP11bXSA9IFtdO1xuXG5cdHByaXZhdGUgY29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgdHlwZTogVHJhY2VUeXBlLFxuXHRcdHJlYWRvbmx5IG5hbWU6IHN0cmluZyB8IG51bGxcblx0KSB7IH1cblxuXHRicmFuY2goaWQ6IFNlcnZpY2VJZGVudGlmaWVyPGFueT4sIGZpcnN0OiBib29sZWFuKTogVHJhY2Uge1xuXHRcdGNvbnN0IGNoaWxkID0gbmV3IFRyYWNlKFRyYWNlVHlwZS5CcmFuY2gsIGlkLnRvU3RyaW5nKCkpO1xuXHRcdHRoaXMuX2RlcC5wdXNoKFtpZCwgZmlyc3QsIGNoaWxkXSk7XG5cdFx0cmV0dXJuIGNoaWxkO1xuXHR9XG5cblx0c3RvcCgpIHtcblx0XHRjb25zdCBkdXIgPSBEYXRlLm5vdygpIC0gdGhpcy5fc3RhcnQ7XG5cdFx0VHJhY2UuX3RvdGFscyArPSBkdXI7XG5cblx0XHRsZXQgY2F1c2VkQ3JlYXRpb24gPSBmYWxzZTtcblxuXHRcdGZ1bmN0aW9uIHByaW50Q2hpbGQobjogbnVtYmVyLCB0cmFjZTogVHJhY2UpIHtcblx0XHRcdGNvbnN0IHJlczogc3RyaW5nW10gPSBbXTtcblx0XHRcdGNvbnN0IHByZWZpeCA9IG5ldyBBcnJheShuICsgMSkuam9pbignXFx0Jyk7XG5cdFx0XHRmb3IgKGNvbnN0IFtpZCwgZmlyc3QsIGNoaWxkXSBvZiB0cmFjZS5fZGVwKSB7XG5cdFx0XHRcdGlmIChmaXJzdCAmJiBjaGlsZCkge1xuXHRcdFx0XHRcdGNhdXNlZENyZWF0aW9uID0gdHJ1ZTtcblx0XHRcdFx0XHRyZXMucHVzaChgJHtwcmVmaXh9Q1JFQVRFUyAtPiAke2lkfWApO1xuXHRcdFx0XHRcdGNvbnN0IG5lc3RlZCA9IHByaW50Q2hpbGQobiArIDEsIGNoaWxkKTtcblx0XHRcdFx0XHRpZiAobmVzdGVkKSB7XG5cdFx0XHRcdFx0XHRyZXMucHVzaChuZXN0ZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXMucHVzaChgJHtwcmVmaXh9dXNlcyAtPiAke2lkfWApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzLmpvaW4oJ1xcbicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxpbmVzID0gW1xuXHRcdFx0YCR7dGhpcy50eXBlID09PSBUcmFjZVR5cGUuQ3JlYXRpb24gPyAnQ1JFQVRFJyA6ICdDQUxMJ30gJHt0aGlzLm5hbWV9YCxcblx0XHRcdGAke3ByaW50Q2hpbGQoMSwgdGhpcyl9YCxcblx0XHRcdGBET05FLCB0b29rICR7ZHVyLnRvRml4ZWQoMil9bXMgKGdyYW5kIHRvdGFsICR7VHJhY2UuX3RvdGFscy50b0ZpeGVkKDIpfW1zKWBcblx0XHRdO1xuXG5cdFx0aWYgKGR1ciA+IDIgfHwgY2F1c2VkQ3JlYXRpb24pIHtcblx0XHRcdFRyYWNlLmFsbC5hZGQobGluZXMuam9pbignXFxuJykpO1xuXHRcdH1cblx0fVxufVxuXG4vLyNlbmRyZWdpb25cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsdUJBQXVCO0FBRWhDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQTBCLFNBQXNCLGNBQWMsb0JBQW9CO0FBQ2xGLFNBQVMsc0JBQXVDO0FBQ2hELFNBQVMsYUFBYTtBQUN0QixTQUFtQyx1QkFBNEQsYUFBYTtBQUM1RyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGtCQUFrQjtBQUczQixNQUFNLG9CQUFvQjtBQUkxQixNQUFNLDhCQUE4QixNQUFNO0FBQUEsRUFDekMsWUFBWSxPQUFtQjtBQUM5QixVQUFNLG9DQUFvQztBQUMxQyxTQUFLLFVBQVUsTUFBTSxjQUFjLEtBQUs7QUFBQSxFQUE0QyxNQUFNLFNBQVMsQ0FBQztBQUFBLEVBQ3JHO0FBQ0Q7QUFFTyxNQUFNLHFCQUFzRDtBQUFBLEVBV2xFLFlBQ2tCLFlBQStCLElBQUksa0JBQWtCLEdBQ3JELFVBQW1CLE9BQ25CLFNBQ0EsaUJBQTBCLG1CQUMxQztBQUpnQjtBQUNBO0FBQ0E7QUFDQTtBQVJsQixTQUFRLGNBQWM7QUFDdEIsU0FBaUIsMEJBQTBCLG9CQUFJLElBQVM7QUFDeEQsU0FBaUIsWUFBWSxvQkFBSSxJQUEwQjtBQWdLM0QsU0FBaUIsd0JBQXdCLG9CQUFJLElBQTRCO0FBdkp4RSxTQUFLLFVBQVUsSUFBSSx1QkFBdUIsSUFBSTtBQUM5QyxTQUFLLGVBQWUsaUJBQWlCLFNBQVMsZ0JB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
