import { AutorunObserver, AutorunState } from "../../autorun.js";
import { ObservableValue } from "../../base.js";
import { Derived, DerivedState } from "../../derived.js";
import { formatValue } from "../consoleObservableLogger.js";
import { registerDebugChannel } from "./debuggerRpc.js";
import { deepAssign, deepAssignDeleteNulls, getFirstStackFrameOutsideOf, Throttler } from "./utils.js";
import { isDefined } from "../../../types.js";
import { FromEventObservable } from "../../utils.js";
import { BugIndicatingError, onUnexpectedError } from "../../../errors.js";
const _DevToolsLogger = class _DevToolsLogger {
  constructor() {
    this._declarationId = 0;
    this._instanceId = 0;
    this._declarations = /* @__PURE__ */ new Map();
    this._instanceInfos = /* @__PURE__ */ new WeakMap();
    this._aliveInstances = /* @__PURE__ */ new Map();
    this._activeTransactions = /* @__PURE__ */ new Set();
    this._channel = registerDebugChannel("observableDevTools", () => {
      return {
        notifications: {
          setDeclarationIdFilter: (declarationIds) => {
          },
          logObservableValue: (observableId) => {
            console.log("logObservableValue", observableId);
          },
          flushUpdates: () => {
            this._flushUpdates();
          },
          resetUpdates: () => {
            this._pendingChanges = null;
            this._channel.api.notifications.handleChange(this._fullState, true);
          }
        },
        requests: {
          getDeclarations: () => {
            const result = {};
            for (const decl of this._declarations.values()) {
              result[decl.id] = decl;
            }
            return { decls: result };
          },
          getSummarizedInstances: () => {
            return null;
          },
          getObservableValueInfo: (instanceId) => {
            const obs = this._aliveInstances.get(instanceId);
            return {
              observers: [...obs.debugGetObservers()].map((d) => this._formatObserver(d)).filter(isDefined)
            };
          },
          getDerivedInfo: (instanceId) => {
            const d = this._aliveInstances.get(instanceId);
            return {
              dependencies: [...d.debugGetState().dependencies].map((d2) => this._formatObservable(d2)).filter(isDefined),
              observers: [...d.debugGetObservers()].map((d2) => this._formatObserver(d2)).filter(isDefined)
            };
          },
          getAutorunInfo: (instanceId) => {
            const obs = this._aliveInstances.get(instanceId);
            return {
              dependencies: [...obs.debugGetState().dependencies].map((d) => this._formatObservable(d)).filter(isDefined)
            };
          },
          getTransactionState: () => {
            return this.getTransactionState();
          },
          setValue: (instanceId, jsonValue) => {
            const obs = this._aliveInstances.get(instanceId);
            if (obs instanceof Derived) {
              obs.debugSetValue(jsonValue);
            } else if (obs instanceof ObservableValue) {
              obs.debugSetValue(jsonValue);
            } else if (obs instanceof FromEventObservable) {
              obs.debugSetValue(jsonValue);
            } else {
              throw new BugIndicatingError("Observable is not supported");
            }
            const observers = [...obs.debugGetObservers()];
            for (const d of observers) {
              d.beginUpdate(obs);
            }
            for (const d of observers) {
              d.handleChange(obs, void 0);
            }
            for (const d of observers) {
              d.endUpdate(obs);
            }
          },
          getValue: (instanceId) => {
            const obs = this._aliveInstances.get(instanceId);
            if (obs instanceof Derived) {
              return formatValue(obs.debugGetState().value, 200);
            } else if (obs instanceof ObservableValue) {
              return formatValue(obs.debugGetState().value, 200);
            }
            return void 0;
          }
        }
      };
    });
    this._pendingChanges = null;
    this._changeThrottler = new Throttler();
    this._fullState = {};
    this._flushUpdates = () => {
      if (this._pendingChanges !== null) {
        this._channel.api.notifications.handleChange(this._pendingChanges, false);
        this._pendingChanges = null;
      }
    };
  }
  static getInstance() {
    if (_DevToolsLogger._instance === void 0) {
      _DevToolsLogger._instance = new _DevToolsLogger();
    }
    return _DevToolsLogger._instance;
  }
  getTransactionState() {
    const affected = [];
    const txs = [...this._activeTransactions];
    if (txs.length === 0) {
      return void 0;
    }
    const observerQueue = txs.flatMap((t) => t.debugGetUpdatingObservers() ?? []).map((o) => o.observer);
    const processedObservers = /* @__PURE__ */ new Set();
    while (observerQueue.length > 0) {
      const observer = observerQueue.shift();
      if (processedObservers.has(observer)) {
        continue;
      }
      processedObservers.add(observer);
      const state = this._getInfo(observer, (d) => {
        if (!processedObservers.has(d)) {
          observerQueue.push(d);
        }
      });
      if (state) {
        affected.push(state);
      }
    }
    return { names: txs.map((t) => t.getDebugName() ?? "tx"), affected };
  }
  _getObservableInfo(observable) {
    const info = this._instanceInfos.get(observable);
    if (!info) {
      onUnexpectedError(new BugIndicatingError("No info found"));
      return void 0;
    }
    return info;
  }
  _getAutorunInfo(autorun) {
    const info = this._instanceInfos.get(autorun);
    if (!info) {
      onUnexpectedError(new BugIndicatingError("No info found"));
      return void 0;
    }
    return info;
  }
  _getInfo(observer, queue) {
    if (observer instanceof Derived) {
      const observersToUpdate = [...observer.debugGetObservers()];
      for (const o of observersToUpdate) {
        queue(o);
      }
      const info = this._getObservableInfo(observer);
      if (!info) {
        return;
      }
      const observerState = observer.debugGetState();
      const base = { name: observer.debugName, instanceId: info.instanceId, updateCount: observerState.updateCount };
      const changedDependencies = [...info.changedObservables].map((o) => this._instanceInfos.get(o)?.instanceId).filter(isDefined);
      if (observerState.isComputing) {
        return { ...base, type: "observable/derived", state: "updating", changedDependencies, initialComputation: false };
      }
      switch (observerState.state) {
        case DerivedState.initial:
          return { ...base, type: "observable/derived", state: "noValue" };
        case DerivedState.upToDate:
          return { ...base, type: "observable/derived", state: "upToDate" };
        case DerivedState.stale:
          return { ...base, type: "observable/derived", state: "stale", changedDependencies };
        case DerivedState.dependenciesMightHaveChanged:
          return { ...base, type: "observable/derived", state: "possiblyStale" };
      }
    } else if (observer instanceof AutorunObserver) {
      const info = this._getAutorunInfo(observer);
      if (!info) {
        return void 0;
      }
      const base = { name: observer.debugName, instanceId: info.instanceId, updateCount: info.updateCount };
      const changedDependencies = [...info.changedObservables].map((o) => this._instanceInfos.get(o).instanceId);
      if (observer.debugGetState().isRunning) {
        return { ...base, type: "autorun", state: "updating", changedDependencies };
      }
      switch (observer.debugGetState().state) {
        case AutorunState.upToDate:
          return { ...base, type: "autorun", state: "upToDate" };
        case AutorunState.stale:
          return { ...base, type: "autorun", state: "stale", changedDependencies };
        case AutorunState.dependenciesMightHaveChanged:
          return { ...base, type: "autorun", state: "possiblyStale" };
      }
    }
    return void 0;
  }
  _formatObservable(obs) {
    const info = this._getObservableInfo(obs);
    if (!info) {
      return void 0;
    }
    return { name: obs.debugName, instanceId: info.instanceId };
  }
  _formatObserver(obs) {
    if (obs instanceof Derived) {
      return { name: obs.toString(), instanceId: this._getObservableInfo(obs)?.instanceId };
    }
    const autorunInfo = this._getAutorunInfo(obs);
    if (autorunInfo) {
      return { name: obs.toString(), instanceId: autorunInfo.instanceId };
    }
    return void 0;
  }
  _handleChange(update) {
    deepAssignDeleteNulls(this._fullState, update);
    if (this._pendingChanges === null) {
      this._pendingChanges = update;
    } else {
      deepAssign(this._pendingChanges, update);
    }
    this._changeThrottler.throttle(this._flushUpdates, 10);
  }
  _getDeclarationId(type) {
    let shallow = true;
    let loc;
    const Err = Error;
    while (true) {
      const l = Err.stackTraceLimit;
      Err.stackTraceLimit = shallow ? 6 : 20;
      const stack = new Error().stack;
      Err.stackTraceLimit = l;
      let result = getFirstStackFrameOutsideOf(stack, /[/\\]observableInternal[/\\]|\.observe|[/\\]util(s)?\./);
      if (!shallow && !result) {
        result = getFirstStackFrameOutsideOf(stack, /[/\\]observableInternal[/\\]|\.observe/);
      }
      if (result) {
        loc = result;
        break;
      }
      if (!shallow) {
        console.error("Could not find location for declaration", new Error().stack);
        loc = { fileName: "unknown", line: 0, column: 0, id: "unknown" };
        break;
      }
      shallow = false;
    }
    let decInfo = this._declarations.get(loc.id);
    if (decInfo === void 0) {
      decInfo = {
        id: this._declarationId++,
        type,
        url: loc.fileName,
        line: loc.line,
        column: loc.column
      };
      this._declarations.set(loc.id, decInfo);
      this._handleChange({ decls: { [decInfo.id]: decInfo } });
    }
    return decInfo.id;
  }
  handleObservableCreated(observable) {
    const declarationId = this._getDeclarationId("observable/value");
    const info = {
      declarationId,
      instanceId: this._instanceId++,
      listenerCount: 0,
      lastValue: void 0,
      updateCount: 0,
      changedObservables: /* @__PURE__ */ new Set()
    };
    this._instanceInfos.set(observable, info);
  }
  handleOnListenerCountChanged(observable, newCount) {
    const info = this._getObservableInfo(observable);
    if (!info) {
      return;
    }
    if (info.listenerCount === 0 && newCount > 0) {
      const type = observable instanceof Derived ? "observable/derived" : "observable/value";
      this._aliveInstances.set(info.instanceId, observable);
      this._handleChange({
        instances: {
          [info.instanceId]: {
            instanceId: info.instanceId,
            declarationId: info.declarationId,
            formattedValue: info.lastValue,
            type,
            name: observable.debugName
          }
        }
      });
    } else if (info.listenerCount > 0 && newCount === 0) {
      this._handleChange({
        instances: { [info.instanceId]: null }
      });
      this._aliveInstances.delete(info.instanceId);
    }
    info.listenerCount = newCount;
  }
  handleObservableUpdated(observable, changeInfo) {
    if (observable instanceof Derived) {
      this._handleDerivedRecomputed(observable, changeInfo);
      return;
    }
    const info = this._getObservableInfo(observable);
    if (info) {
      if (changeInfo.didChange) {
        info.lastValue = formatValue(changeInfo.newValue, 30);
        if (info.listenerCount > 0) {
          this._handleChange({
            instances: { [info.instanceId]: { formattedValue: info.lastValue } }
          });
        }
      }
    }
  }
  handleAutorunCreated(autorun) {
    const declarationId = this._getDeclarationId("autorun");
    const info = {
      declarationId,
      instanceId: this._instanceId++,
      updateCount: 0,
      changedObservables: /* @__PURE__ */ new Set()
    };
    this._instanceInfos.set(autorun, info);
    this._aliveInstances.set(info.instanceId, autorun);
    if (info) {
      this._handleChange({
        instances: {
          [info.instanceId]: {
            instanceId: info.instanceId,
            declarationId: info.declarationId,
            runCount: 0,
            type: "autorun",
            name: autorun.debugName
          }
        }
      });
    }
  }
  handleAutorunDisposed(autorun) {
    const info = this._getAutorunInfo(autorun);
    if (!info) {
      return;
    }
    this._handleChange({
      instances: { [info.instanceId]: null }
    });
    this._instanceInfos.delete(autorun);
    this._aliveInstances.delete(info.instanceId);
  }
  handleAutorunDependencyChanged(autorun, observable, change) {
    const info = this._getAutorunInfo(autorun);
    if (!info) {
      return;
    }
    info.changedObservables.add(observable);
  }
  handleAutorunStarted(autorun) {
  }
  handleAutorunFinished(autorun) {
    const info = this._getAutorunInfo(autorun);
    if (!info) {
      return;
    }
    info.changedObservables.clear();
    info.updateCount++;
    this._handleChange({
      instances: { [info.instanceId]: { runCount: info.updateCount } }
    });
  }
  handleDerivedDependencyChanged(derived, observable, change) {
    const info = this._getObservableInfo(derived);
    if (info) {
      info.changedObservables.add(observable);
    }
  }
  _handleDerivedRecomputed(observable, changeInfo) {
    const info = this._getObservableInfo(observable);
    if (!info) {
      return;
    }
    const formattedValue = formatValue(changeInfo.newValue, 30);
    info.updateCount++;
    info.changedObservables.clear();
    info.lastValue = formattedValue;
    if (info.listenerCount > 0) {
      this._handleChange({
        instances: { [info.instanceId]: { formattedValue, recomputationCount: info.updateCount } }
      });
    }
  }
  handleDerivedCleared(observable) {
    const info = this._getObservableInfo(observable);
    if (!info) {
      return;
    }
    info.lastValue = void 0;
    info.changedObservables.clear();
    if (info.listenerCount > 0) {
      this._handleChange({
        instances: {
          [info.instanceId]: {
            formattedValue: void 0
          }
        }
      });
    }
  }
  handleBeginTransaction(transaction) {
    this._activeTransactions.add(transaction);
  }
  handleEndTransaction(transaction) {
    this._activeTransactions.delete(transaction);
  }
};
_DevToolsLogger._instance = void 0;
let DevToolsLogger = _DevToolsLogger;
export {
  DevToolsLogger
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlSW50ZXJuYWwvbG9nZ2luZy9kZWJ1Z2dlci9kZXZUb29sc0xvZ2dlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEF1dG9ydW5PYnNlcnZlciwgQXV0b3J1blN0YXRlIH0gZnJvbSAnLi4vLi4vYXV0b3J1bi5qcyc7XG5pbXBvcnQgeyBCYXNlT2JzZXJ2YWJsZSwgSU9ic2VydmFibGUsIElPYnNlcnZlciwgT2JzZXJ2YWJsZVZhbHVlLCBUcmFuc2FjdGlvbkltcGwgfSBmcm9tICcuLi8uLi9iYXNlLmpzJztcbmltcG9ydCB7IERlcml2ZWQsIERlcml2ZWRTdGF0ZSB9IGZyb20gJy4uLy4uL2Rlcml2ZWQuanMnO1xuaW1wb3J0IHsgSUNoYW5nZUluZm9ybWF0aW9uLCBJT2JzZXJ2YWJsZUxvZ2dlciB9IGZyb20gJy4uL2xvZ2dpbmcuanMnO1xuaW1wb3J0IHsgZm9ybWF0VmFsdWUgfSBmcm9tICcuLi9jb25zb2xlT2JzZXJ2YWJsZUxvZ2dlci5qcyc7XG5pbXBvcnQgeyBPYnNEZWJ1Z2dlckFwaSwgSU9ic0RlY2xhcmF0aW9uLCBPYnNJbnN0YW5jZUlkLCBPYnNTdGF0ZVVwZGF0ZSwgSVRyYW5zYWN0aW9uU3RhdGUsIE9ic2VydmVySW5zdGFuY2VTdGF0ZSB9IGZyb20gJy4vZGVidWdnZXJBcGkuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJEZWJ1Z0NoYW5uZWwgfSBmcm9tICcuL2RlYnVnZ2VyUnBjLmpzJztcbmltcG9ydCB7IGRlZXBBc3NpZ24sIGRlZXBBc3NpZ25EZWxldGVOdWxscywgZ2V0Rmlyc3RTdGFja0ZyYW1lT3V0c2lkZU9mLCBJTG9jYXRpb24sIFRocm90dGxlciB9IGZyb20gJy4vdXRpbHMuanMnO1xuaW1wb3J0IHsgaXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vdHlwZXMuanMnO1xuaW1wb3J0IHsgRnJvbUV2ZW50T2JzZXJ2YWJsZSB9IGZyb20gJy4uLy4uL3V0aWxzLmpzJztcbmltcG9ydCB7IEJ1Z0luZGljYXRpbmdFcnJvciwgb25VbmV4cGVjdGVkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi9lcnJvcnMuanMnO1xuXG5pbnRlcmZhY2UgSUluc3RhbmNlSW5mbyB7XG5cdGRlY2xhcmF0aW9uSWQ6IG51bWJlcjtcblx0aW5zdGFuY2VJZDogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgSU9ic2VydmFibGVJbmZvIGV4dGVuZHMgSUluc3RhbmNlSW5mbyB7XG5cdGxpc3RlbmVyQ291bnQ6IG51bWJlcjtcblx0bGFzdFZhbHVlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHVwZGF0ZUNvdW50OiBudW1iZXI7XG5cdGNoYW5nZWRPYnNlcnZhYmxlczogU2V0PElPYnNlcnZhYmxlPGFueT4+O1xufVxuXG5pbnRlcmZhY2UgSUF1dG9ydW5JbmZvIGV4dGVuZHMgSUluc3RhbmNlSW5mbyB7XG5cdHVwZGF0ZUNvdW50OiBudW1iZXI7XG5cdGNoYW5nZWRPYnNlcnZhYmxlczogU2V0PElPYnNlcnZhYmxlPGFueT4+O1xufVxuXG5leHBvcnQgY2xhc3MgRGV2VG9vbHNMb2dnZXIgaW1wbGVtZW50cyBJT2JzZXJ2YWJsZUxvZ2dlciB7XG5cdHByaXZhdGUgc3RhdGljIF9pbnN0YW5jZTogRGV2VG9vbHNMb2dnZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHB1YmxpYyBzdGF0aWMgZ2V0SW5zdGFuY2UoKTogRGV2VG9vbHNMb2dnZXIge1xuXHRcdGlmIChEZXZUb29sc0xvZ2dlci5faW5zdGFuY2UgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0RGV2VG9vbHNMb2dnZXIuX2luc3RhbmNlID0gbmV3IERldlRvb2xzTG9nZ2VyKCk7XG5cdFx0fVxuXHRcdHJldHVybiBEZXZUb29sc0xvZ2dlci5faW5zdGFuY2U7XG5cdH1cblxuXHRwcml2YXRlIF9kZWNsYXJhdGlvbklkID0gMDtcblx0cHJpdmF0ZSBfaW5zdGFuY2VJZCA9IDA7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGVjbGFyYXRpb25zID0gbmV3IE1hcDwvKiBkZWNsYXJhdGlvbklkICsgdHlwZSAqL3N0cmluZywgSU9ic0RlY2xhcmF0aW9uPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW5jZUluZm9zID0gbmV3IFdlYWtNYXA8b2JqZWN0LCBJT2JzZXJ2YWJsZUluZm8gfCBJQXV0b3J1bkluZm8+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2FsaXZlSW5zdGFuY2VzID0gbmV3IE1hcDxPYnNJbnN0YW5jZUlkLCBJT2JzZXJ2YWJsZTxhbnk+IHwgQXV0b3J1bk9ic2VydmVyPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hY3RpdmVUcmFuc2FjdGlvbnMgPSBuZXcgU2V0PFRyYW5zYWN0aW9uSW1wbD4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jaGFubmVsID0gcmVnaXN0ZXJEZWJ1Z0NoYW5uZWw8T2JzRGVidWdnZXJBcGk+KCdvYnNlcnZhYmxlRGV2VG9vbHMnLCAoKSA9PiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG5vdGlmaWNhdGlvbnM6IHtcblx0XHRcdFx0c2V0RGVjbGFyYXRpb25JZEZpbHRlcjogZGVjbGFyYXRpb25JZHMgPT4ge1xuXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGxvZ09ic2VydmFibGVWYWx1ZTogKG9ic2VydmFibGVJZCkgPT4ge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKCdsb2dPYnNlcnZhYmxlVmFsdWUnLCBvYnNlcnZhYmxlSWQpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRmbHVzaFVwZGF0ZXM6ICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9mbHVzaFVwZGF0ZXMoKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0cmVzZXRVcGRhdGVzOiAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fcGVuZGluZ0NoYW5nZXMgPSBudWxsO1xuXHRcdFx0XHRcdHRoaXMuX2NoYW5uZWwuYXBpLm5vdGlmaWNhdGlvbnMuaGFuZGxlQ2hhbmdlKHRoaXMuX2Z1bGxTdGF0ZSwgdHJ1ZSk7XG5cdFx0XHRcdH0sXG5cdFx0XHR9LFxuXHRcdFx0cmVxdWVzdHM6IHtcblx0XHRcdFx0Z2V0RGVjbGFyYXRpb25zOiAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgcmVzdWx0OiBSZWNvcmQ8c3RyaW5nLCBJT2JzRGVjbGFyYXRpb24+ID0ge307XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBkZWNsIG9mIHRoaXMuX2RlY2xhcmF0aW9ucy52YWx1ZXMoKSkge1xuXHRcdFx0XHRcdFx0cmVzdWx0W2RlY2wuaWRdID0gZGVjbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHsgZGVjbHM6IHJlc3VsdCB9O1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRnZXRTdW1tYXJpemVkSW5zdGFuY2VzOiAoKSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGwhO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRnZXRPYnNlcnZhYmxlVmFsdWVJbmZvOiBpbnN0YW5jZUlkID0+IHtcblx0XHRcdFx0XHRjb25zdCBvYnMgPSB0aGlzLl9hbGl2ZUluc3RhbmNlcy5nZXQoaW5zdGFuY2VJZCkgYXMgQmFzZU9ic2VydmFibGU8YW55Pjtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0b2JzZXJ2ZXJzOiBbLi4ub2JzLmRlYnVnR2V0T2JzZXJ2ZXJzKCldLm1hcChkID0+IHRoaXMuX2Zvcm1hdE9ic2VydmVyKGQpKS5maWx0ZXIoaXNEZWZpbmVkKSxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRnZXREZXJpdmVkSW5mbzogaW5zdGFuY2VJZCA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgZCA9IHRoaXMuX2FsaXZlSW5zdGFuY2VzLmdldChpbnN0YW5jZUlkKSBhcyBEZXJpdmVkPGFueT47XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGRlcGVuZGVuY2llczogWy4uLmQuZGVidWdHZXRTdGF0ZSgpLmRlcGVuZGVuY2llc10ubWFwKGQgPT4gdGhpcy5fZm9ybWF0T2JzZXJ2YWJsZShkKSkuZmlsdGVyKGlzRGVmaW5lZCksXG5cdFx0XHRcdFx0XHRvYnNlcnZlcnM6IFsuLi5kLmRlYnVnR2V0T2JzZXJ2ZXJzKCldLm1hcChkID0+IHRoaXMuX2Zvcm1hdE9ic2VydmVyKGQpKS5maWx0ZXIoaXNEZWZpbmVkKSxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRnZXRBdXRvcnVuSW5mbzogaW5zdGFuY2VJZCA9PiB7XG5cdFx0XHRcdFx0Y29uc3Qgb2JzID0gdGhpcy5fYWxpdmVJbnN0YW5jZXMuZ2V0KGluc3RhbmNlSWQpIGFzIEF1dG9ydW5PYnNlcnZlcjtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0ZGVwZW5kZW5jaWVzOiBbLi4ub2JzLmRlYnVnR2V0U3RhdGUoKS5kZXBlbmRlbmNpZXNdLm1hcChkID0+IHRoaXMuX2Zvcm1hdE9ic2VydmFibGUoZCkpLmZpbHRlcihpc0RlZmluZWQpLFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldFRyYW5zYWN0aW9uU3RhdGU6ICgpID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5nZXRUcmFuc2FjdGlvblN0YXRlKCk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHNldFZhbHVlOiAoaW5zdGFuY2VJZCwganNvblZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3Qgb2JzID0gdGhpcy5fYWxpdmVJbnN0YW5jZXMuZ2V0KGluc3RhbmNlSWQpIGFzIEJhc2VPYnNlcnZhYmxlPGFueT47XG5cblx0XHRcdFx0XHRpZiAob2JzIGluc3RhbmNlb2YgRGVyaXZlZCkge1xuXHRcdFx0XHRcdFx0b2JzLmRlYnVnU2V0VmFsdWUoanNvblZhbHVlKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKG9icyBpbnN0YW5jZW9mIE9ic2VydmFibGVWYWx1ZSkge1xuXHRcdFx0XHRcdFx0b2JzLmRlYnVnU2V0VmFsdWUoanNvblZhbHVlKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKG9icyBpbnN0YW5jZW9mIEZyb21FdmVudE9ic2VydmFibGUpIHtcblx0XHRcdFx0XHRcdG9icy5kZWJ1Z1NldFZhbHVlKGpzb25WYWx1ZSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBCdWdJbmRpY2F0aW5nRXJyb3IoJ09ic2VydmFibGUgaXMgbm90IHN1cHBvcnRlZCcpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IG9ic2VydmVycyA9IFsuLi5vYnMuZGVidWdHZXRPYnNlcnZlcnMoKV07XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBkIG9mIG9ic2VydmVycykge1xuXHRcdFx0XHRcdFx0ZC5iZWdpblVwZGF0ZShvYnMpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRmb3IgKGNvbnN0IGQgb2Ygb2JzZXJ2ZXJzKSB7XG5cdFx0XHRcdFx0XHRkLmhhbmRsZUNoYW5nZShvYnMsIHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGZvciAoY29uc3QgZCBvZiBvYnNlcnZlcnMpIHtcblx0XHRcdFx0XHRcdGQuZW5kVXBkYXRlKG9icyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRnZXRWYWx1ZTogaW5zdGFuY2VJZCA9PiB7XG5cdFx0XHRcdFx0Y29uc3Qgb2JzID0gdGhpcy5fYWxpdmVJbnN0YW5jZXMuZ2V0KGluc3RhbmNlSWQpIGFzIEJhc2VPYnNlcnZhYmxlPGFueT47XG5cdFx0XHRcdFx0aWYgKG9icyBpbnN0YW5jZW9mIERlcml2ZWQpIHtcblx0XHRcdFx0XHRcdHJldHVybiBmb3JtYXRWYWx1ZShvYnMuZGVidWdHZXRTdGF0ZSgpLnZhbHVlLCAyMDApO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAob2JzIGluc3RhbmNlb2YgT2JzZXJ2YWJsZVZhbHVlKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZm9ybWF0VmFsdWUob2JzLmRlYnVnR2V0U3RhdGUoKS52YWx1ZSwgMjAwKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0fSk7XG5cblx0cHJpdmF0ZSBnZXRUcmFuc2FjdGlvblN0YXRlKCk6IElUcmFuc2FjdGlvblN0YXRlIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBhZmZlY3RlZDogT2JzZXJ2ZXJJbnN0YW5jZVN0YXRlW10gPSBbXTtcblx0XHRjb25zdCB0eHMgPSBbLi4udGhpcy5fYWN0aXZlVHJhbnNhY3Rpb25zXTtcblx0XHRpZiAodHhzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3Qgb2JzZXJ2ZXJRdWV1ZSA9IHR4cy5mbGF0TWFwKHQgPT4gdC5kZWJ1Z0dldFVwZGF0aW5nT2JzZXJ2ZXJzKCkgPz8gW10pLm1hcChvID0+IG8ub2JzZXJ2ZXIpO1xuXHRcdGNvbnN0IHByb2Nlc3NlZE9ic2VydmVycyA9IG5ldyBTZXQ8SU9ic2VydmVyPigpO1xuXHRcdHdoaWxlIChvYnNlcnZlclF1ZXVlLmxlbmd0aCA+IDApIHtcblx0XHRcdGNvbnN0IG9ic2VydmVyID0gb2JzZXJ2ZXJRdWV1ZS5zaGlmdCgpITtcblx0XHRcdGlmIChwcm9jZXNzZWRPYnNlcnZlcnMuaGFzKG9ic2VydmVyKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdHByb2Nlc3NlZE9ic2VydmVycy5hZGQob2JzZXJ2ZXIpO1xuXG5cdFx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuX2dldEluZm8ob2JzZXJ2ZXIsIGQgPT4ge1xuXHRcdFx0XHRpZiAoIXByb2Nlc3NlZE9ic2VydmVycy5oYXMoZCkpIHtcblx0XHRcdFx0XHRvYnNlcnZlclF1ZXVlLnB1c2goZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAoc3RhdGUpIHtcblx0XHRcdFx0YWZmZWN0ZWQucHVzaChzdGF0ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHsgbmFtZXM6IHR4cy5tYXAodCA9PiB0LmdldERlYnVnTmFtZSgpID8/ICd0eCcpLCBhZmZlY3RlZCB9O1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0T2JzZXJ2YWJsZUluZm8ob2JzZXJ2YWJsZTogSU9ic2VydmFibGU8YW55Pik6IElPYnNlcnZhYmxlSW5mbyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgaW5mbyA9IHRoaXMuX2luc3RhbmNlSW5mb3MuZ2V0KG9ic2VydmFibGUpO1xuXHRcdGlmICghaW5mbykge1xuXHRcdFx0b25VbmV4cGVjdGVkRXJyb3IobmV3IEJ1Z0luZGljYXRpbmdFcnJvcignTm8gaW5mbyBmb3VuZCcpKTtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiBpbmZvIGFzIElPYnNlcnZhYmxlSW5mbztcblx0fVxuXG5cdHByaXZhdGUgX2dldEF1dG9ydW5JbmZvKGF1dG9ydW46IEF1dG9ydW5PYnNlcnZlcik6IElBdXRvcnVuSW5mbyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgaW5mbyA9IHRoaXMuX2luc3RhbmNlSW5mb3MuZ2V0KGF1dG9ydW4pO1xuXHRcdGlmICghaW5mbykge1xuXHRcdFx0b25VbmV4cGVjdGVkRXJyb3IobmV3IEJ1Z0luZGljYXRpbmdFcnJvcignTm8gaW5mbyBmb3VuZCcpKTtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiBpbmZvIGFzIElBdXRvcnVuSW5mbztcblx0fVxuXG5cdHByaXZhdGUgX2dldEluZm8ob2JzZXJ2ZXI6IElPYnNlcnZlciwgcXVldWU6IChvYnNlcnZlcjogSU9ic2VydmVyKSA9PiB2b2lkKTogT2JzZXJ2ZXJJbnN0YW5jZVN0YXRlIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAob2JzZXJ2ZXIgaW5zdGFuY2VvZiBEZXJpdmVkKSB7XG5cdFx0XHRjb25zdCBvYnNlcnZlcnNUb1VwZGF0ZSA9IFsuLi5vYnNlcnZlci5kZWJ1Z0dldE9ic2VydmVycygpXTtcblx0XHRcdGZvciAoY29uc3QgbyBvZiBvYnNlcnZlcnNUb1VwZGF0ZSkge1xuXHRcdFx0XHRxdWV1ZShvKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgaW5mbyA9IHRoaXMuX2dldE9ic2VydmFibGVJbmZvKG9ic2VydmVyKTtcblx0XHRcdGlmICghaW5mbykgeyByZXR1cm47IH1cblxuXHRcdFx0Y29uc3Qgb2JzZXJ2ZXJTdGF0ZSA9IG9ic2VydmVyLmRlYnVnR2V0U3RhdGUoKTtcblxuXHRcdFx0Y29uc3QgYmFzZSA9IHsgbmFtZTogb2JzZXJ2ZXIuZGVidWdOYW1lLCBpbnN0YW5jZUlkOiBpbmZvLmluc3RhbmNlSWQsIHVwZGF0ZUNvdW50OiBvYnNlcnZlclN0YXRlLnVwZGF0ZUNvdW50IH07XG5cdFx0XHRjb25zdCBjaGFuZ2VkRGVwZW5kZW5jaWVzID0gWy4uLmluZm8uY2hhbmdlZE9ic2VydmFibGVzXS5tYXAobyA9PiB0aGlzLl9pbnN0YW5jZUluZm9zLmdldChvKT8uaW5zdGFuY2VJZCkuZmlsdGVyKGlzRGVmaW5lZCk7XG5cdFx0XHRpZiAob2JzZXJ2ZXJTdGF0ZS5pc0NvbXB1dGluZykge1xuXHRcdFx0XHRyZXR1cm4geyAuLi5iYXNlLCB0eXBlOiAnb2JzZXJ2YWJsZS9kZXJpdmVkJywgc3RhdGU6ICd1cGRhdGluZycsIGNoYW5nZWREZXBlbmRlbmNpZXMsIGluaXRpYWxDb21wdXRhdGlvbjogZmFsc2UgfTtcblx0XHRcdH1cblx0XHRcdHN3aXRjaCAob2JzZXJ2ZXJTdGF0ZS5zdGF0ZSkge1xuXHRcdFx0XHRjYXNlIERlcml2ZWRTdGF0ZS5pbml0aWFsOlxuXHRcdFx0XHRcdHJldHVybiB7IC4uLmJhc2UsIHR5cGU6ICdvYnNlcnZhYmxlL2Rlcml2ZWQnLCBzdGF0ZTogJ25vVmFsdWUnIH07XG5cdFx0XHRcdGNhc2UgRGVyaXZlZFN0YXRlLnVwVG9EYXRlOlxuXHRcdFx0XHRcdHJldHVybiB7IC4uLmJhc2UsIHR5cGU6ICdvYnNlcnZhYmxlL2Rlcml2ZWQnLCBzdGF0ZTogJ3VwVG9EYXRlJyB9O1xuXHRcdFx0XHRjYXNlIERlcml2ZWRTdGF0ZS5zdGFsZTpcblx0XHRcdFx0XHRyZXR1cm4geyAuLi5iYXNlLCB0eXBlOiAnb2JzZXJ2YWJsZS9kZXJpdmVkJywgc3RhdGU6ICdzdGFsZScsIGNoYW5nZWREZXBlbmRlbmNpZXMgfTtcblx0XHRcdFx0Y2FzZSBEZXJpdmVkU3RhdGUuZGVwZW5kZW5jaWVzTWlnaHRIYXZlQ2hhbmdlZDpcblx0XHRcdFx0XHRyZXR1cm4geyAuLi5iYXNlLCB0eXBlOiAnb2JzZXJ2YWJsZS9kZXJpdmVkJywgc3RhdGU6ICdwb3NzaWJseVN0YWxlJyB9O1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAob2JzZXJ2ZXIgaW5zdGFuY2VvZiBBdXRvcnVuT2JzZXJ2ZXIpIHtcblx0XHRcdGNvbnN0IGluZm8gPSB0aGlzLl9nZXRBdXRvcnVuSW5mbyhvYnNlcnZlcik7XG5cdFx0XHRpZiAoIWluZm8pIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXG5cdFx0XHRjb25zdCBiYXNlID0geyBuYW1lOiBvYnNlcnZlci5kZWJ1Z05hbWUsIGluc3RhbmNlSWQ6IGluZm8uaW5zdGFuY2VJZCwgdXBkYXRlQ291bnQ6IGluZm8udXBkYXRlQ291bnQgfTtcblx0XHRcdGNvbnN0IGNoYW5nZWREZXBlbmRlbmNpZXMgPSBbLi4uaW5mby5jaGFuZ2VkT2JzZXJ2YWJsZXNdLm1hcChvID0+IHRoaXMuX2luc3RhbmNlSW5mb3MuZ2V0KG8pIS5pbnN0YW5jZUlkKTtcblx0XHRcdGlmIChvYnNlcnZlci5kZWJ1Z0dldFN0YXRlKCkuaXNSdW5uaW5nKSB7XG5cdFx0XHRcdHJldHVybiB7IC4uLmJhc2UsIHR5cGU6ICdhdXRvcnVuJywgc3RhdGU6ICd1cGRhdGluZycsIGNoYW5nZWREZXBlbmRlbmNpZXMgfTtcblx0XHRcdH1cblx0XHRcdHN3aXRjaCAob2JzZXJ2ZXIuZGVidWdHZXRTdGF0ZSgpLnN0YXRlKSB7XG5cdFx0XHRcdGNhc2UgQXV0b3J1blN0YXRlLnVwVG9EYXRlOlxuXHRcdFx0XHRcdHJldHVybiB7IC4uLmJhc2UsIHR5cGU6ICdhdXRvcnVuJywgc3RhdGU6ICd1cFRvRGF0ZScgfTtcblx0XHRcdFx0Y2FzZSBBdXRvcnVuU3RhdGUuc3RhbGU6XG5cdFx0XHRcdFx0cmV0dXJuIHsgLi4uYmFzZSwgdHlwZTogJ2F1dG9ydW4nLCBzdGF0ZTogJ3N0YWxlJywgY2hhbmdlZERlcGVuZGVuY2llcyB9O1xuXHRcdFx0XHRjYXNlIEF1dG9ydW5TdGF0ZS5kZXBlbmRlbmNpZXNNaWdodEhhdmVDaGFuZ2VkOlxuXHRcdFx0XHRcdHJldHVybiB7IC4uLmJhc2UsIHR5cGU6ICdhdXRvcnVuJywgc3RhdGU6ICdwb3NzaWJseVN0YWxlJyB9O1xuXHRcdFx0fVxuXG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9mb3JtYXRPYnNlcnZhYmxlKG9iczogSU9ic2VydmFibGU8YW55Pik6IHsgbmFtZTogc3RyaW5nOyBpbnN0YW5jZUlkOiBPYnNJbnN0YW5jZUlkIH0gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGluZm8gPSB0aGlzLl9nZXRPYnNlcnZhYmxlSW5mbyhvYnMpO1xuXHRcdGlmICghaW5mbykgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdFx0cmV0dXJuIHsgbmFtZTogb2JzLmRlYnVnTmFtZSwgaW5zdGFuY2VJZDogaW5mby5pbnN0YW5jZUlkIH07XG5cdH1cblxuXHRwcml2YXRlIF9mb3JtYXRPYnNlcnZlcihvYnM6IElPYnNlcnZlcik6IHsgbmFtZTogc3RyaW5nOyBpbnN0YW5jZUlkOiBPYnNJbnN0YW5jZUlkIH0gfCB1bmRlZmluZWQge1xuXHRcdGlmIChvYnMgaW5zdGFuY2VvZiBEZXJpdmVkKSB7XG5cdFx0XHRyZXR1cm4geyBuYW1lOiBvYnMudG9TdHJpbmcoKSwgaW5zdGFuY2VJZDogdGhpcy5fZ2V0T2JzZXJ2YWJsZUluZm8ob2JzKT8uaW5zdGFuY2VJZCEgfTtcblx0XHR9XG5cdFx0Y29uc3QgYXV0b3J1bkluZm8gPSB0aGlzLl9nZXRBdXRvcnVuSW5mbyhvYnMgYXMgQXV0b3J1bk9ic2VydmVyKTtcblx0XHRpZiAoYXV0b3J1bkluZm8pIHtcblx0XHRcdHJldHVybiB7IG5hbWU6IG9icy50b1N0cmluZygpLCBpbnN0YW5jZUlkOiBhdXRvcnVuSW5mby5pbnN0YW5jZUlkIH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgY29uc3RydWN0b3IoKSB7IH1cblxuXHRwcml2YXRlIF9wZW5kaW5nQ2hhbmdlczogT2JzU3RhdGVVcGRhdGUgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSByZWFkb25seSBfY2hhbmdlVGhyb3R0bGVyID0gbmV3IFRocm90dGxlcigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2Z1bGxTdGF0ZSA9IHt9O1xuXG5cdHByaXZhdGUgX2hhbmRsZUNoYW5nZSh1cGRhdGU6IE9ic1N0YXRlVXBkYXRlKTogdm9pZCB7XG5cdFx0ZGVlcEFzc2lnbkRlbGV0ZU51bGxzKHRoaXMuX2Z1bGxTdGF0ZSwgdXBkYXRlKTtcblxuXHRcdGlmICh0aGlzLl9wZW5kaW5nQ2hhbmdlcyA9PT0gbnVsbCkge1xuXHRcdFx0dGhpcy5fcGVuZGluZ0NoYW5nZXMgPSB1cGRhdGU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRlZXBBc3NpZ24odGhpcy5fcGVuZGluZ0NoYW5nZXMsIHVwZGF0ZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fY2hhbmdlVGhyb3R0bGVyLnRocm90dGxlKHRoaXMuX2ZsdXNoVXBkYXRlcywgMTApO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZmx1c2hVcGRhdGVzID0gKCkgPT4ge1xuXHRcdGlmICh0aGlzLl9wZW5kaW5nQ2hhbmdlcyAhPT0gbnVsbCkge1xuXHRcdFx0dGhpcy5fY2hhbm5lbC5hcGkubm90aWZpY2F0aW9ucy5oYW5kbGVDaGFuZ2UodGhpcy5fcGVuZGluZ0NoYW5nZXMsIGZhbHNlKTtcblx0XHRcdHRoaXMuX3BlbmRpbmdDaGFuZ2VzID0gbnVsbDtcblx0XHR9XG5cdH07XG5cblx0cHJpdmF0ZSBfZ2V0RGVjbGFyYXRpb25JZCh0eXBlOiBJT2JzRGVjbGFyYXRpb25bJ3R5cGUnXSk6IG51bWJlciB7XG5cblx0XHRsZXQgc2hhbGxvdyA9IHRydWU7XG5cdFx0bGV0IGxvYyE6IElMb2NhdGlvbjtcblxuXHRcdGNvbnN0IEVyciA9IEVycm9yIGFzIGFueSBhcyB7IHN0YWNrVHJhY2VMaW1pdDogbnVtYmVyIH07IC8vIEZvciB0aGUgbW9uYWNvIGVkaXRvciBjaGVja3MsIHdoaWNoIGRvbid0IGhhdmUgdGhlIG5vZGVqcyB0eXBlcy5cblxuXHRcdHdoaWxlICh0cnVlKSB7XG5cdFx0XHRjb25zdCBsID0gRXJyLnN0YWNrVHJhY2VMaW1pdDtcblx0XHRcdEVyci5zdGFja1RyYWNlTGltaXQgPSBzaGFsbG93ID8gNiA6IDIwO1xuXHRcdFx0Y29uc3Qgc3RhY2sgPSBuZXcgRXJyb3IoKS5zdGFjayE7XG5cdFx0XHRFcnIuc3RhY2tUcmFjZUxpbWl0ID0gbDtcblxuXHRcdFx0bGV0IHJlc3VsdCA9IGdldEZpcnN0U3RhY2tGcmFtZU91dHNpZGVPZihzdGFjaywgL1svXFxcXF1vYnNlcnZhYmxlSW50ZXJuYWxbL1xcXFxdfFxcLm9ic2VydmV8Wy9cXFxcXXV0aWwocyk/XFwuLyk7XG5cblx0XHRcdGlmICghc2hhbGxvdyAmJiAhcmVzdWx0KSB7XG5cdFx0XHRcdHJlc3VsdCA9IGdldEZpcnN0U3RhY2tGcmFtZU91dHNpZGVPZihzdGFjaywgL1svXFxcXF1vYnNlcnZhYmxlSW50ZXJuYWxbL1xcXFxdfFxcLm9ic2VydmUvKSE7XG5cdFx0XHR9XG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdGxvYyA9IHJlc3VsdDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIXNoYWxsb3cpIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcignQ291bGQgbm90IGZpbmQgbG9jYXRpb24gZm9yIGRlY2xhcmF0aW9uJywgbmV3IEVycm9yKCkuc3RhY2spO1xuXHRcdFx0XHRsb2MgPSB7IGZpbGVOYW1lOiAndW5rbm93bicsIGxpbmU6IDAsIGNvbHVtbjogMCwgaWQ6ICd1bmtub3duJyB9O1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdHNoYWxsb3cgPSBmYWxzZTtcblx0XHR9XG5cblx0XHRsZXQgZGVjSW5mbyA9IHRoaXMuX2RlY2xhcmF0aW9ucy5nZXQobG9jLmlkKTtcblx0XHRpZiAoZGVjSW5mbyA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRkZWNJbmZvID0ge1xuXHRcdFx0XHRpZDogdGhpcy5fZGVjbGFyYXRpb25JZCsrLFxuXHRcdFx0XHR0eXBlLFxuXHRcdFx0XHR1cmw6IGxvYy5maWxlTmFtZSxcblx0XHRcdFx0bGluZTogbG9jLmxpbmUsXG5cdFx0XHRcdGNvbHVtbjogbG9jLmNvbHVtbixcblx0XHRcdH07XG5cdFx0XHR0aGlzLl9kZWNsYXJhdGlvbnMuc2V0KGxvYy5pZCwgZGVjSW5mbyk7XG5cblx0XHRcdHRoaXMuX2hhbmRsZUNoYW5nZSh7IGRlY2xzOiB7IFtkZWNJbmZvLmlkXTogZGVjSW5mbyB9IH0pO1xuXHRcdH1cblx0XHRyZXR1cm4gZGVjSW5mby5pZDtcblx0fVxuXG5cdGhhbmRsZU9ic2VydmFibGVDcmVhdGVkKG9ic2VydmFibGU6IElPYnNlcnZhYmxlPGFueT4pOiB2b2lkIHtcblx0XHRjb25zdCBkZWNsYXJhdGlvbklkID0gdGhpcy5fZ2V0RGVjbGFyYXRpb25JZCgnb2JzZXJ2YWJsZS92YWx1ZScpO1xuXG5cdFx0Y29uc3QgaW5mbzogSU9ic2VydmFibGVJbmZvID0ge1xuXHRcdFx0ZGVjbGFyYXRpb25JZCxcblx0XHRcdGluc3RhbmNlSWQ6IHRoaXMuX2luc3RhbmNlSWQrKyxcblx0XHRcdGxpc3RlbmVyQ291bnQ6IDAsXG5cdFx0XHRsYXN0VmFsdWU6IHVuZGVmaW5lZCxcblx0XHRcdHVwZGF0ZUNvdW50OiAwLFxuXHRcdFx0Y2hhbmdlZE9ic2VydmFibGVzOiBuZXcgU2V0KCksXG5cdFx0fTtcblx0XHR0aGlzLl9pbnN0YW5jZUluZm9zLnNldChvYnNlcnZhYmxlLCBpbmZvKTtcblx0fVxuXG5cdGhhbmRsZU9uTGlzdGVuZXJDb3VudENoYW5nZWQob2JzZXJ2YWJsZTogSU9ic2VydmFibGU8YW55PiwgbmV3Q291bnQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IGluZm8gPSB0aGlzLl9nZXRPYnNlcnZhYmxlSW5mbyhvYnNlcnZhYmxlKTtcblx0XHRpZiAoIWluZm8pIHsgcmV0dXJuOyB9XG5cblx0XHRpZiAoaW5mby5saXN0ZW5lckNvdW50ID09PSAwICYmIG5ld0NvdW50ID4gMCkge1xuXHRcdFx0Y29uc3QgdHlwZTogSU9ic0RlY2xhcmF0aW9uWyd0eXBlJ10gPVxuXHRcdFx0XHRvYnNlcnZhYmxlIGluc3RhbmNlb2YgRGVyaXZlZCA/ICdvYnNlcnZhYmxlL2Rlcml2ZWQnIDogJ29ic2VydmFibGUvdmFsdWUnO1xuXHRcdFx0dGhpcy5fYWxpdmVJbnN0YW5jZXMuc2V0KGluZm8uaW5zdGFuY2VJZCwgb2JzZXJ2YWJsZSk7XG5cdFx0XHR0aGlzLl9oYW5kbGVDaGFuZ2Uoe1xuXHRcdFx0XHRpbnN0YW5jZXM6IHtcblx0XHRcdFx0XHRbaW5mby5pbnN0YW5jZUlkXToge1xuXHRcdFx0XHRcdFx0aW5zdGFuY2VJZDogaW5mby5pbnN0YW5jZUlkLFxuXHRcdFx0XHRcdFx0ZGVjbGFyYXRpb25JZDogaW5mby5kZWNsYXJhdGlvbklkLFxuXHRcdFx0XHRcdFx0Zm9ybWF0dGVkVmFsdWU6IGluZm8ubGFzdFZhbHVlLFxuXHRcdFx0XHRcdFx0dHlwZSxcblx0XHRcdFx0XHRcdG5hbWU6IG9ic2VydmFibGUuZGVidWdOYW1lLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIGlmIChpbmZvLmxpc3RlbmVyQ291bnQgPiAwICYmIG5ld0NvdW50ID09PSAwKSB7XG5cdFx0XHR0aGlzLl9oYW5kbGVDaGFuZ2Uoe1xuXHRcdFx0XHRpbnN0YW5jZXM6IHsgW2luZm8uaW5zdGFuY2VJZF06IG51bGwgfVxuXHRcdFx0fSk7XG5cdFx0XHR0aGlzLl9hbGl2ZUluc3RhbmNlcy5kZWxldGUoaW5mby5pbnN0YW5jZUlkKTtcblx0XHR9XG5cdFx0aW5mby5saXN0ZW5lckNvdW50ID0gbmV3Q291bnQ7XG5cdH1cblxuXHRoYW5kbGVPYnNlcnZhYmxlVXBkYXRlZChvYnNlcnZhYmxlOiBJT2JzZXJ2YWJsZTxhbnk+LCBjaGFuZ2VJbmZvOiBJQ2hhbmdlSW5mb3JtYXRpb24pOiB2b2lkIHtcblx0XHRpZiAob2JzZXJ2YWJsZSBpbnN0YW5jZW9mIERlcml2ZWQpIHtcblx0XHRcdHRoaXMuX2hhbmRsZURlcml2ZWRSZWNvbXB1dGVkKG9ic2VydmFibGUsIGNoYW5nZUluZm8pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluZm8gPSB0aGlzLl9nZXRPYnNlcnZhYmxlSW5mbyhvYnNlcnZhYmxlKTtcblx0XHRpZiAoaW5mbykge1xuXHRcdFx0aWYgKGNoYW5nZUluZm8uZGlkQ2hhbmdlKSB7XG5cdFx0XHRcdGluZm8ubGFzdFZhbHVlID0gZm9ybWF0VmFsdWUoY2hhbmdlSW5mby5uZXdWYWx1ZSwgMzApO1xuXHRcdFx0XHRpZiAoaW5mby5saXN0ZW5lckNvdW50ID4gMCkge1xuXHRcdFx0XHRcdHRoaXMuX2hhbmRsZUNoYW5nZSh7XG5cdFx0XHRcdFx0XHRpbnN0YW5jZXM6IHsgW2luZm8uaW5zdGFuY2VJZF06IHsgZm9ybWF0dGVkVmFsdWU6IGluZm8ubGFzdFZhbHVlIH0gfVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aGFuZGxlQXV0b3J1bkNyZWF0ZWQoYXV0b3J1bjogQXV0b3J1bk9ic2VydmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgZGVjbGFyYXRpb25JZCA9IHRoaXMuX2dldERlY2xhcmF0aW9uSWQoJ2F1dG9ydW4nKTtcblx0XHRjb25zdCBpbmZvOiBJQXV0b3J1bkluZm8gPSB7XG5cdFx0XHRkZWNsYXJhdGlvbklkLFxuXHRcdFx0aW5zdGFuY2VJZDogdGhpcy5faW5zdGFuY2VJZCsrLFxuXHRcdFx0dXBkYXRlQ291bnQ6IDAsXG5cdFx0XHRjaGFuZ2VkT2JzZXJ2YWJsZXM6IG5ldyBTZXQoKSxcblx0XHR9O1xuXHRcdHRoaXMuX2luc3RhbmNlSW5mb3Muc2V0KGF1dG9ydW4sIGluZm8pO1xuXHRcdHRoaXMuX2FsaXZlSW5zdGFuY2VzLnNldChpbmZvLmluc3RhbmNlSWQsIGF1dG9ydW4pO1xuXHRcdGlmIChpbmZvKSB7XG5cdFx0XHR0aGlzLl9oYW5kbGVDaGFuZ2Uoe1xuXHRcdFx0XHRpbnN0YW5jZXM6IHtcblx0XHRcdFx0XHRbaW5mby5pbnN0YW5jZUlkXToge1xuXHRcdFx0XHRcdFx0aW5zdGFuY2VJZDogaW5mby5pbnN0YW5jZUlkLFxuXHRcdFx0XHRcdFx0ZGVjbGFyYXRpb25JZDogaW5mby5kZWNsYXJhdGlvbklkLFxuXHRcdFx0XHRcdFx0cnVuQ291bnQ6IDAsXG5cdFx0XHRcdFx0XHR0eXBlOiAnYXV0b3J1bicsXG5cdFx0XHRcdFx0XHRuYW1lOiBhdXRvcnVuLmRlYnVnTmFtZSxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXHRoYW5kbGVBdXRvcnVuRGlzcG9zZWQoYXV0b3J1bjogQXV0b3J1bk9ic2VydmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgaW5mbyA9IHRoaXMuX2dldEF1dG9ydW5JbmZvKGF1dG9ydW4pO1xuXHRcdGlmICghaW5mbykgeyByZXR1cm47IH1cblxuXHRcdHRoaXMuX2hhbmRsZUNoYW5nZSh7XG5cdFx0XHRpbnN0YW5jZXM6IHsgW2luZm8uaW5zdGFuY2VJZF06IG51bGwgfVxuXHRcdH0pO1xuXHRcdHRoaXMuX2luc3RhbmNlSW5mb3MuZGVsZXRlKGF1dG9ydW4pO1xuXHRcdHRoaXMuX2FsaXZlSW5zdGFuY2VzLmRlbGV0ZShpbmZvLmluc3RhbmNlSWQpO1xuXHR9XG5cdGhhbmRsZUF1dG9ydW5EZXBlbmRlbmN5Q2hhbmdlZChhdXRvcnVuOiBBdXRvcnVuT2JzZXJ2ZXIsIG9ic2VydmFibGU6IElPYnNlcnZhYmxlPGFueT4sIGNoYW5nZTogdW5rbm93bik6IHZvaWQge1xuXHRcdGNvbnN0IGluZm8gPSB0aGlzLl9nZXRBdXRvcnVuSW5mbyhhdXRvcnVuKTtcblx0XHRpZiAoIWluZm8pIHsgcmV0dXJuOyB9XG5cblx0XHRpbmZvLmNoYW5nZWRPYnNlcnZhYmxlcy5hZGQob2JzZXJ2YWJsZSk7XG5cdH1cblx0aGFuZGxlQXV0b3J1blN0YXJ0ZWQoYXV0b3J1bjogQXV0b3J1bk9ic2VydmVyKTogdm9pZCB7XG5cblx0fVxuXHRoYW5kbGVBdXRvcnVuRmluaXNoZWQoYXV0b3J1bjogQXV0b3J1bk9ic2VydmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgaW5mbyA9IHRoaXMuX2dldEF1dG9ydW5JbmZvKGF1dG9ydW4pO1xuXHRcdGlmICghaW5mbykgeyByZXR1cm47IH1cblxuXHRcdGluZm8uY2hhbmdlZE9ic2VydmFibGVzLmNsZWFyKCk7XG5cdFx0aW5mby51cGRhdGVDb3VudCsrO1xuXHRcdHRoaXMuX2hhbmRsZUNoYW5nZSh7XG5cdFx0XHRpbnN0YW5jZXM6IHsgW2luZm8uaW5zdGFuY2VJZF06IHsgcnVuQ291bnQ6IGluZm8udXBkYXRlQ291bnQgfSB9XG5cdFx0fSk7XG5cdH1cblxuXHRoYW5kbGVEZXJpdmVkRGVwZW5kZW5jeUNoYW5nZWQoZGVyaXZlZDogRGVyaXZlZDxhbnk+LCBvYnNlcnZhYmxlOiBJT2JzZXJ2YWJsZTxhbnk+LCBjaGFuZ2U6IHVua25vd24pOiB2b2lkIHtcblx0XHRjb25zdCBpbmZvID0gdGhpcy5fZ2V0T2JzZXJ2YWJsZUluZm8oZGVyaXZlZCk7XG5cdFx0aWYgKGluZm8pIHtcblx0XHRcdGluZm8uY2hhbmdlZE9ic2VydmFibGVzLmFkZChvYnNlcnZhYmxlKTtcblx0XHR9XG5cdH1cblx0X2hhbmRsZURlcml2ZWRSZWNvbXB1dGVkKG9ic2VydmFibGU6IERlcml2ZWQ8YW55PiwgY2hhbmdlSW5mbzogSUNoYW5nZUluZm9ybWF0aW9uKTogdm9pZCB7XG5cdFx0Y29uc3QgaW5mbyA9IHRoaXMuX2dldE9ic2VydmFibGVJbmZvKG9ic2VydmFibGUpO1xuXHRcdGlmICghaW5mbykgeyByZXR1cm47IH1cblxuXHRcdGNvbnN0IGZvcm1hdHRlZFZhbHVlID0gZm9ybWF0VmFsdWUoY2hhbmdlSW5mby5uZXdWYWx1ZSwgMzApO1xuXHRcdGluZm8udXBkYXRlQ291bnQrKztcblx0XHRpbmZvLmNoYW5nZWRPYnNlcnZhYmxlcy5jbGVhcigpO1xuXG5cdFx0aW5mby5sYXN0VmFsdWUgPSBmb3JtYXR0ZWRWYWx1ZTtcblx0XHRpZiAoaW5mby5saXN0ZW5lckNvdW50ID4gMCkge1xuXHRcdFx0dGhpcy5faGFuZGxlQ2hhbmdlKHtcblx0XHRcdFx0aW5zdGFuY2VzOiB7IFtpbmZvLmluc3RhbmNlSWRdOiB7IGZvcm1hdHRlZFZhbHVlOiBmb3JtYXR0ZWRWYWx1ZSwgcmVjb21wdXRhdGlvbkNvdW50OiBpbmZvLnVwZGF0ZUNvdW50IH0gfVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cdGhhbmRsZURlcml2ZWRDbGVhcmVkKG9ic2VydmFibGU6IERlcml2ZWQ8YW55Pik6IHZvaWQge1xuXHRcdGNvbnN0IGluZm8gPSB0aGlzLl9nZXRPYnNlcnZhYmxlSW5mbyhvYnNlcnZhYmxlKTtcblx0XHRpZiAoIWluZm8pIHsgcmV0dXJuOyB9XG5cblx0XHRpbmZvLmxhc3RWYWx1ZSA9IHVuZGVmaW5lZDtcblx0XHRpbmZvLmNoYW5nZWRPYnNlcnZhYmxlcy5jbGVhcigpO1xuXHRcdGlmIChpbmZvLmxpc3RlbmVyQ291bnQgPiAwKSB7XG5cdFx0XHR0aGlzLl9oYW5kbGVDaGFuZ2Uoe1xuXHRcdFx0XHRpbnN0YW5jZXM6IHtcblx0XHRcdFx0XHRbaW5mby5pbnN0YW5jZUlkXToge1xuXHRcdFx0XHRcdFx0Zm9ybWF0dGVkVmFsdWU6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXHRoYW5kbGVCZWdpblRyYW5zYWN0aW9uKHRyYW5zYWN0aW9uOiBUcmFuc2FjdGlvbkltcGwpOiB2b2lkIHtcblx0XHR0aGlzLl9hY3RpdmVUcmFuc2FjdGlvbnMuYWRkKHRyYW5zYWN0aW9uKTtcblx0fVxuXHRoYW5kbGVFbmRUcmFuc2FjdGlvbih0cmFuc2FjdGlvbjogVHJhbnNhY3Rpb25JbXBsKTogdm9pZCB7XG5cdFx0dGhpcy5fYWN0aXZlVHJhbnNhY3Rpb25zLmRlbGV0ZSh0cmFuc2FjdGlvbik7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsaUJBQWlCLG9CQUFvQjtBQUM5QyxTQUFpRCx1QkFBd0M7QUFDekYsU0FBUyxTQUFTLG9CQUFvQjtBQUV0QyxTQUFTLG1CQUFtQjtBQUU1QixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLFlBQVksdUJBQXVCLDZCQUF3QyxpQkFBaUI7QUFDckcsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxvQkFBb0IseUJBQXlCO0FBbUIvQyxNQUFNLGtCQUFOLE1BQU0sZ0JBQTRDO0FBQUEsRUEyTmhELGNBQWM7QUFsTnRCLFNBQVEsaUJBQWlCO0FBQ3pCLFNBQVEsY0FBYztBQUV0QixTQUFpQixnQkFBZ0Isb0JBQUksSUFBdUQ7QUFDNUYsU0FBaUIsaUJBQWlCLG9CQUFJ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
