import { BaseObservable, TransactionImpl } from "./base.js";
import { getLogger } from "./logging/logging.js";
class LazyObservableValue extends BaseObservable {
  constructor(_debugNameData, initialValue, _equalityComparator) {
    super();
    this._debugNameData = _debugNameData;
    this._equalityComparator = _equalityComparator;
    this._isUpToDate = true;
    this._deltas = [];
    this._updateCounter = 0;
    this._value = initialValue;
  }
  get debugName() {
    return this._debugNameData.getDebugName(this) ?? "LazyObservableValue";
  }
  get() {
    this._update();
    return this._value;
  }
  _update() {
    if (this._isUpToDate) {
      return;
    }
    this._isUpToDate = true;
    if (this._deltas.length > 0) {
      for (const change of this._deltas) {
        getLogger()?.handleObservableUpdated(this, { change, didChange: true, oldValue: "(unknown)", newValue: this._value, hadValue: true });
        for (const observer of this._observers) {
          observer.handleChange(this, change);
        }
      }
      this._deltas.length = 0;
    } else {
      getLogger()?.handleObservableUpdated(this, { change: void 0, didChange: true, oldValue: "(unknown)", newValue: this._value, hadValue: true });
      for (const observer of this._observers) {
        observer.handleChange(this, void 0);
      }
    }
  }
  _beginUpdate() {
    this._updateCounter++;
    if (this._updateCounter === 1) {
      for (const observer of this._observers) {
        observer.beginUpdate(this);
      }
    }
  }
  _endUpdate() {
    this._updateCounter--;
    if (this._updateCounter === 0) {
      this._update();
      const observers = [...this._observers];
      for (const r of observers) {
        r.endUpdate(this);
      }
    }
  }
  addObserver(observer) {
    const shouldCallBeginUpdate = !this._observers.has(observer) && this._updateCounter > 0;
    super.addObserver(observer);
    if (shouldCallBeginUpdate) {
      observer.beginUpdate(this);
    }
  }
  removeObserver(observer) {
    const shouldCallEndUpdate = this._observers.has(observer) && this._updateCounter > 0;
    super.removeObserver(observer);
    if (shouldCallEndUpdate) {
      observer.endUpdate(this);
    }
  }
  set(value, tx, change) {
    if (change === void 0 && this._equalityComparator(this._value, value)) {
      return;
    }
    let _tx;
    if (!tx) {
      tx = _tx = new TransactionImpl(() => {
      }, () => `Setting ${this.debugName}`);
    }
    try {
      this._isUpToDate = false;
      this._setValue(value);
      if (change !== void 0) {
        this._deltas.push(change);
      }
      tx.updateObserver({
        beginUpdate: () => this._beginUpdate(),
        endUpdate: () => this._endUpdate(),
        handleChange: (observable, change2) => {
        },
        handlePossibleChange: (observable) => {
        }
      }, this);
      if (this._updateCounter > 1) {
        for (const observer of this._observers) {
          observer.handlePossibleChange(this);
        }
      }
    } finally {
      if (_tx) {
        _tx.finish();
      }
    }
  }
  toString() {
    return `${this.debugName}: ${this._value}`;
  }
  _setValue(newValue) {
    this._value = newValue;
  }
}
export {
  LazyObservableValue
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlSW50ZXJuYWwvbGF6eU9ic2VydmFibGVWYWx1ZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEVxdWFsaXR5Q29tcGFyZXIgfSBmcm9tICcuL2NvbW1vbkZhY2FkZS9kZXBzLmpzJztcbmltcG9ydCB7IEJhc2VPYnNlcnZhYmxlLCBJT2JzZXJ2ZXIsIElTZXR0YWJsZU9ic2VydmFibGUsIElUcmFuc2FjdGlvbiwgVHJhbnNhY3Rpb25JbXBsIH0gZnJvbSAnLi9iYXNlLmpzJztcbmltcG9ydCB7IERlYnVnTmFtZURhdGEgfSBmcm9tICcuL2RlYnVnTmFtZS5qcyc7XG5pbXBvcnQgeyBnZXRMb2dnZXIgfSBmcm9tICcuL2xvZ2dpbmcvbG9nZ2luZy5qcyc7XG5cbi8qKlxuICogSG9sZHMgb2ZmIHVwZGF0aW5nIG9ic2VydmVycyB1bnRpbCB0aGUgdmFsdWUgaXMgYWN0dWFsbHkgcmVhZC5cbiovXG5leHBvcnQgY2xhc3MgTGF6eU9ic2VydmFibGVWYWx1ZTxULCBUQ2hhbmdlID0gdm9pZD5cblx0ZXh0ZW5kcyBCYXNlT2JzZXJ2YWJsZTxULCBUQ2hhbmdlPlxuXHRpbXBsZW1lbnRzIElTZXR0YWJsZU9ic2VydmFibGU8VCwgVENoYW5nZT4ge1xuXHRwcm90ZWN0ZWQgX3ZhbHVlOiBUO1xuXHRwcml2YXRlIF9pc1VwVG9EYXRlID0gdHJ1ZTtcblx0cHJpdmF0ZSByZWFkb25seSBfZGVsdGFzOiBUQ2hhbmdlW10gPSBbXTtcblxuXHRnZXQgZGVidWdOYW1lKCkge1xuXHRcdHJldHVybiB0aGlzLl9kZWJ1Z05hbWVEYXRhLmdldERlYnVnTmFtZSh0aGlzKSA/PyAnTGF6eU9ic2VydmFibGVWYWx1ZSc7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kZWJ1Z05hbWVEYXRhOiBEZWJ1Z05hbWVEYXRhLFxuXHRcdGluaXRpYWxWYWx1ZTogVCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lcXVhbGl0eUNvbXBhcmF0b3I6IEVxdWFsaXR5Q29tcGFyZXI8VD4sXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fdmFsdWUgPSBpbml0aWFsVmFsdWU7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZ2V0KCk6IFQge1xuXHRcdHRoaXMuX3VwZGF0ZSgpO1xuXHRcdHJldHVybiB0aGlzLl92YWx1ZTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNVcFRvRGF0ZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9pc1VwVG9EYXRlID0gdHJ1ZTtcblxuXHRcdGlmICh0aGlzLl9kZWx0YXMubGVuZ3RoID4gMCkge1xuXHRcdFx0Zm9yIChjb25zdCBjaGFuZ2Ugb2YgdGhpcy5fZGVsdGFzKSB7XG5cdFx0XHRcdGdldExvZ2dlcigpPy5oYW5kbGVPYnNlcnZhYmxlVXBkYXRlZCh0aGlzLCB7IGNoYW5nZSwgZGlkQ2hhbmdlOiB0cnVlLCBvbGRWYWx1ZTogJyh1bmtub3duKScsIG5ld1ZhbHVlOiB0aGlzLl92YWx1ZSwgaGFkVmFsdWU6IHRydWUgfSk7XG5cdFx0XHRcdGZvciAoY29uc3Qgb2JzZXJ2ZXIgb2YgdGhpcy5fb2JzZXJ2ZXJzKSB7XG5cdFx0XHRcdFx0b2JzZXJ2ZXIuaGFuZGxlQ2hhbmdlKHRoaXMsIGNoYW5nZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHRoaXMuX2RlbHRhcy5sZW5ndGggPSAwO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRnZXRMb2dnZXIoKT8uaGFuZGxlT2JzZXJ2YWJsZVVwZGF0ZWQodGhpcywgeyBjaGFuZ2U6IHVuZGVmaW5lZCwgZGlkQ2hhbmdlOiB0cnVlLCBvbGRWYWx1ZTogJyh1bmtub3duKScsIG5ld1ZhbHVlOiB0aGlzLl92YWx1ZSwgaGFkVmFsdWU6IHRydWUgfSk7XG5cdFx0XHRmb3IgKGNvbnN0IG9ic2VydmVyIG9mIHRoaXMuX29ic2VydmVycykge1xuXHRcdFx0XHRvYnNlcnZlci5oYW5kbGVDaGFuZ2UodGhpcywgdW5kZWZpbmVkKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVDb3VudGVyID0gMDtcblxuXHRwcml2YXRlIF9iZWdpblVwZGF0ZSgpOiB2b2lkIHtcblx0XHR0aGlzLl91cGRhdGVDb3VudGVyKys7XG5cdFx0aWYgKHRoaXMuX3VwZGF0ZUNvdW50ZXIgPT09IDEpIHtcblx0XHRcdGZvciAoY29uc3Qgb2JzZXJ2ZXIgb2YgdGhpcy5fb2JzZXJ2ZXJzKSB7XG5cdFx0XHRcdG9ic2VydmVyLmJlZ2luVXBkYXRlKHRoaXMpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2VuZFVwZGF0ZSgpOiB2b2lkIHtcblx0XHR0aGlzLl91cGRhdGVDb3VudGVyLS07XG5cdFx0aWYgKHRoaXMuX3VwZGF0ZUNvdW50ZXIgPT09IDApIHtcblx0XHRcdHRoaXMuX3VwZGF0ZSgpO1xuXG5cdFx0XHQvLyBFbmQgdXBkYXRlIGNvdWxkIGNoYW5nZSB0aGUgb2JzZXJ2ZXIgbGlzdC5cblx0XHRcdGNvbnN0IG9ic2VydmVycyA9IFsuLi50aGlzLl9vYnNlcnZlcnNdO1xuXHRcdFx0Zm9yIChjb25zdCByIG9mIG9ic2VydmVycykge1xuXHRcdFx0XHRyLmVuZFVwZGF0ZSh0aGlzKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgYWRkT2JzZXJ2ZXIob2JzZXJ2ZXI6IElPYnNlcnZlcik6IHZvaWQge1xuXHRcdGNvbnN0IHNob3VsZENhbGxCZWdpblVwZGF0ZSA9ICF0aGlzLl9vYnNlcnZlcnMuaGFzKG9ic2VydmVyKSAmJiB0aGlzLl91cGRhdGVDb3VudGVyID4gMDtcblx0XHRzdXBlci5hZGRPYnNlcnZlcihvYnNlcnZlcik7XG5cblx0XHRpZiAoc2hvdWxkQ2FsbEJlZ2luVXBkYXRlKSB7XG5cdFx0XHRvYnNlcnZlci5iZWdpblVwZGF0ZSh0aGlzKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgcmVtb3ZlT2JzZXJ2ZXIob2JzZXJ2ZXI6IElPYnNlcnZlcik6IHZvaWQge1xuXHRcdGNvbnN0IHNob3VsZENhbGxFbmRVcGRhdGUgPSB0aGlzLl9vYnNlcnZlcnMuaGFzKG9ic2VydmVyKSAmJiB0aGlzLl91cGRhdGVDb3VudGVyID4gMDtcblx0XHRzdXBlci5yZW1vdmVPYnNlcnZlcihvYnNlcnZlcik7XG5cblx0XHRpZiAoc2hvdWxkQ2FsbEVuZFVwZGF0ZSkge1xuXHRcdFx0Ly8gQ2FsbGluZyBlbmQgdXBkYXRlIGFmdGVyIHJlbW92aW5nIHRoZSBvYnNlcnZlciBtYWtlcyBzdXJlIGVuZFVwZGF0ZSBjYW5ub3QgYmUgY2FsbGVkIHR3aWNlIGhlcmUuXG5cdFx0XHRvYnNlcnZlci5lbmRVcGRhdGUodGhpcyk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIHNldCh2YWx1ZTogVCwgdHg6IElUcmFuc2FjdGlvbiB8IHVuZGVmaW5lZCwgY2hhbmdlOiBUQ2hhbmdlKTogdm9pZCB7XG5cdFx0aWYgKGNoYW5nZSA9PT0gdW5kZWZpbmVkICYmIHRoaXMuX2VxdWFsaXR5Q29tcGFyYXRvcih0aGlzLl92YWx1ZSwgdmFsdWUpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IF90eDogVHJhbnNhY3Rpb25JbXBsIHwgdW5kZWZpbmVkO1xuXHRcdGlmICghdHgpIHtcblx0XHRcdHR4ID0gX3R4ID0gbmV3IFRyYW5zYWN0aW9uSW1wbCgoKSA9PiB7IH0sICgpID0+IGBTZXR0aW5nICR7dGhpcy5kZWJ1Z05hbWV9YCk7XG5cdFx0fVxuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLl9pc1VwVG9EYXRlID0gZmFsc2U7XG5cdFx0XHR0aGlzLl9zZXRWYWx1ZSh2YWx1ZSk7XG5cdFx0XHRpZiAoY2hhbmdlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpcy5fZGVsdGFzLnB1c2goY2hhbmdlKTtcblx0XHRcdH1cblxuXHRcdFx0dHgudXBkYXRlT2JzZXJ2ZXIoe1xuXHRcdFx0XHRiZWdpblVwZGF0ZTogKCkgPT4gdGhpcy5fYmVnaW5VcGRhdGUoKSxcblx0XHRcdFx0ZW5kVXBkYXRlOiAoKSA9PiB0aGlzLl9lbmRVcGRhdGUoKSxcblx0XHRcdFx0aGFuZGxlQ2hhbmdlOiAob2JzZXJ2YWJsZSwgY2hhbmdlKSA9PiB7IH0sXG5cdFx0XHRcdGhhbmRsZVBvc3NpYmxlQ2hhbmdlOiAob2JzZXJ2YWJsZSkgPT4geyB9LFxuXHRcdFx0fSwgdGhpcyk7XG5cblx0XHRcdGlmICh0aGlzLl91cGRhdGVDb3VudGVyID4gMSkge1xuXHRcdFx0XHQvLyBXZSBhbHJlYWR5IHN0YXJ0ZWQgYmVnaW4vZW5kIHVwZGF0ZSwgc28gd2UgbmVlZCB0byBtYW51YWxseSBjYWxsIGhhbmRsZVBvc3NpYmxlQ2hhbmdlXG5cdFx0XHRcdGZvciAoY29uc3Qgb2JzZXJ2ZXIgb2YgdGhpcy5fb2JzZXJ2ZXJzKSB7XG5cdFx0XHRcdFx0b2JzZXJ2ZXIuaGFuZGxlUG9zc2libGVDaGFuZ2UodGhpcyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRpZiAoX3R4KSB7XG5cdFx0XHRcdF90eC5maW5pc2goKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSB0b1N0cmluZygpOiBzdHJpbmcge1xuXHRcdHJldHVybiBgJHt0aGlzLmRlYnVnTmFtZX06ICR7dGhpcy5fdmFsdWV9YDtcblx0fVxuXG5cdHByb3RlY3RlZCBfc2V0VmFsdWUobmV3VmFsdWU6IFQpOiB2b2lkIHtcblx0XHR0aGlzLl92YWx1ZSA9IG5ld1ZhbHVlO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFTLGdCQUE4RCx1QkFBdUI7QUFFOUYsU0FBUyxpQkFBaUI7QUFLbkIsTUFBTSw0QkFDSixlQUNtQztBQUFBLEVBUzNDLFlBQ2tCLGdCQUNqQixjQUNpQixxQkFDaEI7QUFDRCxVQUFNO0FBSlc7QUFFQTtBQVZsQixTQUFRLGNBQWM7QUFDdEIsU0FBaUIsVUFBcUIsQ0FBQztBQTBDdkMsU0FBUSxpQkFBaUI7QUE5QnhCLFNBQUssU0FBUztBQUFBLEVBQ2Y7QUFBQSxFQVhBLElBQUksWUFBWTtBQUNmLFdBQU8sS0FBSyxlQUFlLGFBQWEsSUFBSSxLQUFLO0FBQUEsRUFDbEQ7QUFBQSxFQVdnQixNQUFTO0FBQ3hCLFNBQUssUUFBUTtBQUNiLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQSxFQUVRLFVBQWdCO0FBQ3ZCLFFBQUksS0FBSyxhQUFhO0FBQ3JCO0FBQUEsSUFDRDtBQUNBLFNBQUssY0FBYztBQUVuQixRQUFJLEtBQUssUUFBUSxTQUFTLEdBQUc7QUFDNUIsaUJBQVcsVUFBVSxLQUFLLFNBQVM7QUFDbEMsa0JBQVUsR0FBRyx3QkFBd0IsTUFBTSxFQUFFLFFBQVEsV0FBVyxNQUFNLFVBQVUsYUFBYSxVQUFVLEtBQUssUUFBUSxVQUFVLEtBQUssQ0FBQztBQUNwSSxtQkFBVyxZQUFZLEtBQUssWUFBWTtBQUN2QyxtQkFBUyxhQUFhLE1BQU0sTUFBTTtBQUFBLFFBQ25DO0FBQUEsTUFDRDtBQUNBLFdBQUssUUFBUSxTQUFTO0FBQUEsSUFDdkIsT0FBTztBQUNO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
