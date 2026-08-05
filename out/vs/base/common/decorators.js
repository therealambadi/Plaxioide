function createDecorator(mapFn) {
  return (_target, key, descriptor) => {
    let fnKey = null;
    let fn = null;
    if (typeof descriptor.value === "function") {
      fnKey = "value";
      fn = descriptor.value;
    } else if (typeof descriptor.get === "function") {
      fnKey = "get";
      fn = descriptor.get;
    }
    if (!fn || typeof key === "symbol") {
      throw new Error("not supported");
    }
    descriptor[fnKey] = mapFn(fn, key);
  };
}
function memoize(_target, key, descriptor) {
  let fnKey = null;
  let fn = null;
  if (typeof descriptor.value === "function") {
    fnKey = "value";
    fn = descriptor.value;
    if (fn.length !== 0) {
      console.warn("Memoize should only be used in functions with zero parameters");
    }
  } else if (typeof descriptor.get === "function") {
    fnKey = "get";
    fn = descriptor.get;
  }
  if (!fn) {
    throw new Error("not supported");
  }
  const memoizeKey = `$memoize$${key}`;
  descriptor[fnKey] = function(...args) {
    if (!this.hasOwnProperty(memoizeKey)) {
      Object.defineProperty(this, memoizeKey, {
        configurable: false,
        enumerable: false,
        writable: false,
        value: fn.apply(this, args)
      });
    }
    return this[memoizeKey];
  };
}
function debounce(delay, reducer, initialValueProvider) {
  return createDecorator((fn, key) => {
    const timerKey = `$debounce$${key}`;
    const resultKey = `$debounce$result$${key}`;
    return function(...args) {
      if (!this[resultKey]) {
        this[resultKey] = initialValueProvider ? initialValueProvider() : void 0;
      }
      clearTimeout(this[timerKey]);
      if (reducer) {
        this[resultKey] = reducer(this[resultKey], ...args);
        args = [this[resultKey]];
      }
      this[timerKey] = setTimeout(() => {
        fn.apply(this, args);
        this[resultKey] = initialValueProvider ? initialValueProvider() : void 0;
      }, delay);
    };
  });
}
function throttle(delay, reducer, initialValueProvider) {
  return createDecorator((fn, key) => {
    const timerKey = `$throttle$timer$${key}`;
    const resultKey = `$throttle$result$${key}`;
    const lastRunKey = `$throttle$lastRun$${key}`;
    const pendingKey = `$throttle$pending$${key}`;
    return function(...args) {
      if (!this[resultKey]) {
        this[resultKey] = initialValueProvider ? initialValueProvider() : void 0;
      }
      if (this[lastRunKey] === null || this[lastRunKey] === void 0) {
        this[lastRunKey] = -Number.MAX_VALUE;
      }
      if (reducer) {
        this[resultKey] = reducer(this[resultKey], ...args);
      }
      if (this[pendingKey]) {
        return;
      }
      const nextTime = this[lastRunKey] + delay;
      if (nextTime <= Date.now()) {
        this[lastRunKey] = Date.now();
        fn.apply(this, [this[resultKey]]);
        this[resultKey] = initialValueProvider ? initialValueProvider() : void 0;
      } else {
        this[pendingKey] = true;
        this[timerKey] = setTimeout(() => {
          this[pendingKey] = false;
          this[lastRunKey] = Date.now();
          fn.apply(this, [this[resultKey]]);
          this[resultKey] = initialValueProvider ? initialValueProvider() : void 0;
        }, nextTime - Date.now());
      }
    };
  });
}
import { cancelPreviousCalls } from "./decorators/cancelPreviousCalls.js";
export {
  cancelPreviousCalls,
  debounce,
  memoize,
  throttle
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9kZWNvcmF0b3JzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gY3JlYXRlRGVjb3JhdG9yKG1hcEZuOiAoZm46IEZ1bmN0aW9uLCBrZXk6IHN0cmluZykgPT4gRnVuY3Rpb24pOiBNZXRob2REZWNvcmF0b3Ige1xuXHRyZXR1cm4gKF90YXJnZXQ6IE9iamVjdCwga2V5OiBzdHJpbmcgfCBzeW1ib2wsIGRlc2NyaXB0b3I6IFR5cGVkUHJvcGVydHlEZXNjcmlwdG9yPGFueT4pID0+IHtcblx0XHRsZXQgZm5LZXk6ICd2YWx1ZScgfCAnZ2V0JyB8IG51bGwgPSBudWxsO1xuXHRcdGxldCBmbjogRnVuY3Rpb24gfCBudWxsID0gbnVsbDtcblxuXHRcdGlmICh0eXBlb2YgZGVzY3JpcHRvci52YWx1ZSA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0Zm5LZXkgPSAndmFsdWUnO1xuXHRcdFx0Zm4gPSBkZXNjcmlwdG9yLnZhbHVlO1xuXHRcdH0gZWxzZSBpZiAodHlwZW9mIGRlc2NyaXB0b3IuZ2V0ID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRmbktleSA9ICdnZXQnO1xuXHRcdFx0Zm4gPSBkZXNjcmlwdG9yLmdldDtcblx0XHR9XG5cblx0XHRpZiAoIWZuIHx8IHR5cGVvZiBrZXkgPT09ICdzeW1ib2wnKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ25vdCBzdXBwb3J0ZWQnKTtcblx0XHR9XG5cblx0XHRkZXNjcmlwdG9yW2ZuS2V5IV0gPSBtYXBGbihmbiwga2V5KTtcblx0fTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1lbW9pemUoX3RhcmdldDogT2JqZWN0LCBrZXk6IHN0cmluZywgZGVzY3JpcHRvcjogUHJvcGVydHlEZXNjcmlwdG9yKSB7XG5cdGxldCBmbktleTogJ3ZhbHVlJyB8ICdnZXQnIHwgbnVsbCA9IG51bGw7XG5cdGxldCBmbjogRnVuY3Rpb24gfCBudWxsID0gbnVsbDtcblxuXHRpZiAodHlwZW9mIGRlc2NyaXB0b3IudmFsdWUgPT09ICdmdW5jdGlvbicpIHtcblx0XHRmbktleSA9ICd2YWx1ZSc7XG5cdFx0Zm4gPSBkZXNjcmlwdG9yLnZhbHVlO1xuXG5cdFx0aWYgKGZuIS5sZW5ndGggIT09IDApIHtcblx0XHRcdGNvbnNvbGUud2FybignTWVtb2l6ZSBzaG91bGQgb25seSBiZSB1c2VkIGluIGZ1bmN0aW9ucyB3aXRoIHplcm8gcGFyYW1ldGVycycpO1xuXHRcdH1cblx0fSBlbHNlIGlmICh0eXBlb2YgZGVzY3JpcHRvci5nZXQgPT09ICdmdW5jdGlvbicpIHtcblx0XHRmbktleSA9ICdnZXQnO1xuXHRcdGZuID0gZGVzY3JpcHRvci5nZXQ7XG5cdH1cblxuXHRpZiAoIWZuKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdub3Qgc3VwcG9ydGVkJyk7XG5cdH1cblxuXHRjb25zdCBtZW1vaXplS2V5ID0gYCRtZW1vaXplJCR7a2V5fWA7XG5cdGRlc2NyaXB0b3JbZm5LZXkhXSA9IGZ1bmN0aW9uICguLi5hcmdzOiBhbnlbXSkge1xuXHRcdGlmICghdGhpcy5oYXNPd25Qcm9wZXJ0eShtZW1vaXplS2V5KSkge1xuXHRcdFx0T2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIG1lbW9pemVLZXksIHtcblx0XHRcdFx0Y29uZmlndXJhYmxlOiBmYWxzZSxcblx0XHRcdFx0ZW51bWVyYWJsZTogZmFsc2UsXG5cdFx0XHRcdHdyaXRhYmxlOiBmYWxzZSxcblx0XHRcdFx0dmFsdWU6IGZuLmFwcGx5KHRoaXMsIGFyZ3MpXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0cmV0dXJuICh0aGlzIGFzIGFueSlbbWVtb2l6ZUtleV07XG5cdH07XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSURlYm91bmNlUmVkdWNlcjxUPiB7XG5cdChwcmV2aW91c1ZhbHVlOiBULCAuLi5hcmdzOiBhbnlbXSk6IFQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZWJvdW5jZTxUPihkZWxheTogbnVtYmVyLCByZWR1Y2VyPzogSURlYm91bmNlUmVkdWNlcjxUPiwgaW5pdGlhbFZhbHVlUHJvdmlkZXI/OiAoKSA9PiBUKSB7XG5cdHJldHVybiBjcmVhdGVEZWNvcmF0b3IoKGZuLCBrZXkpID0+IHtcblx0XHRjb25zdCB0aW1lcktleSA9IGAkZGVib3VuY2UkJHtrZXl9YDtcblx0XHRjb25zdCByZXN1bHRLZXkgPSBgJGRlYm91bmNlJHJlc3VsdCQke2tleX1gO1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uICh0aGlzOiBhbnksIC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0XHRpZiAoIXRoaXNbcmVzdWx0S2V5XSkge1xuXHRcdFx0XHR0aGlzW3Jlc3VsdEtleV0gPSBpbml0aWFsVmFsdWVQcm92aWRlciA/IGluaXRpYWxWYWx1ZVByb3ZpZGVyKCkgOiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cblx0XHRcdGNsZWFyVGltZW91dCh0aGlzW3RpbWVyS2V5XSk7XG5cblx0XHRcdGlmIChyZWR1Y2VyKSB7XG5cdFx0XHRcdHRoaXNbcmVzdWx0S2V5XSA9IHJlZHVjZXIodGhpc1tyZXN1bHRLZXldLCAuLi5hcmdzKTtcblx0XHRcdFx0YXJncyA9IFt0aGlzW3Jlc3VsdEtleV1dO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzW3RpbWVyS2V5XSA9IHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRmbi5hcHBseSh0aGlzLCBhcmdzKTtcblx0XHRcdFx0dGhpc1tyZXN1bHRLZXldID0gaW5pdGlhbFZhbHVlUHJvdmlkZXIgPyBpbml0aWFsVmFsdWVQcm92aWRlcigpIDogdW5kZWZpbmVkO1xuXHRcdFx0fSwgZGVsYXkpO1xuXHRcdH07XG5cdH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGhyb3R0bGU8VD4oZGVsYXk6IG51bWJlciwgcmVkdWNlcj86IElEZWJvdW5jZVJlZHVjZXI8VD4sIGluaXRpYWxWYWx1ZVByb3ZpZGVyPzogKCkgPT4gVCkge1xuXHRyZXR1cm4gY3JlYXRlRGVjb3JhdG9yKChmbiwga2V5KSA9PiB7XG5cdFx0Y29uc3QgdGltZXJLZXkgPSBgJHRocm90dGxlJHRpbWVyJCR7a2V5fWA7XG5cdFx0Y29uc3QgcmVzdWx0S2V5ID0gYCR0aHJvdHRsZSRyZXN1bHQkJHtrZXl9YDtcblx0XHRjb25zdCBsYXN0UnVuS2V5ID0gYCR0aHJvdHRsZSRsYXN0UnVuJCR7a2V5fWA7XG5cdFx0Y29uc3QgcGVuZGluZ0tleSA9IGAkdGhyb3R0bGUkcGVuZGluZyQke2tleX1gO1xuXG5cdFx0cmV0dXJuIGZ1bmN0aW9uICh0aGlzOiBhbnksIC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0XHRpZiAoIXRoaXNbcmVzdWx0S2V5XSkge1xuXHRcdFx0XHR0aGlzW3Jlc3VsdEtleV0gPSBpbml0aWFsVmFsdWVQcm92aWRlciA/IGluaXRpYWxWYWx1ZVByb3ZpZGVyKCkgOiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpc1tsYXN0UnVuS2V5XSA9PT0gbnVsbCB8fCB0aGlzW2xhc3RSdW5LZXldID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpc1tsYXN0UnVuS2V5XSA9IC1OdW1iZXIuTUFYX1ZBTFVFO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocmVkdWNlcikge1xuXHRcdFx0XHR0aGlzW3Jlc3VsdEtleV0gPSByZWR1Y2VyKHRoaXNbcmVzdWx0S2V5XSwgLi4uYXJncyk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzW3BlbmRpbmdLZXldKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbmV4dFRpbWUgPSB0aGlzW2xhc3RSdW5LZXldICsgZGVsYXk7XG5cdFx0XHRpZiAobmV4dFRpbWUgPD0gRGF0ZS5ub3coKSkge1xuXHRcdFx0XHR0aGlzW2xhc3RSdW5LZXldID0gRGF0ZS5ub3coKTtcblx0XHRcdFx0Zm4uYXBwbHkodGhpcywgW3RoaXNbcmVzdWx0S2V5XV0pO1xuXHRcdFx0XHR0aGlzW3Jlc3VsdEtleV0gPSBpbml0aWFsVmFsdWVQcm92aWRlciA/IGluaXRpYWxWYWx1ZVByb3ZpZGVyKCkgOiB1bmRlZmluZWQ7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzW3BlbmRpbmdLZXldID0gdHJ1ZTtcblx0XHRcdFx0dGhpc1t0aW1lcktleV0gPSBzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0XHR0aGlzW3BlbmRpbmdLZXldID0gZmFsc2U7XG5cdFx0XHRcdFx0dGhpc1tsYXN0UnVuS2V5XSA9IERhdGUubm93KCk7XG5cdFx0XHRcdFx0Zm4uYXBwbHkodGhpcywgW3RoaXNbcmVzdWx0S2V5XV0pO1xuXHRcdFx0XHRcdHRoaXNbcmVzdWx0S2V5XSA9IGluaXRpYWxWYWx1ZVByb3ZpZGVyID8gaW5pdGlhbFZhbHVlUHJvdmlkZXIoKSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0fSwgbmV4dFRpbWUgLSBEYXRlLm5vdygpKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9KTtcbn1cblxuZXhwb3J0IHsgY2FuY2VsUHJldmlvdXNDYWxscyB9IGZyb20gJy4vZGVjb3JhdG9ycy9jYW5jZWxQcmV2aW91c0NhbGxzLmpzJztcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZ0JBQWdCLE9BQWlF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
