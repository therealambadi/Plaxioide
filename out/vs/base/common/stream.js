import { onUnexpectedError } from "./errors.js";
import { DisposableStore, toDisposable } from "./lifecycle.js";
function isReadable(obj) {
  const candidate = obj;
  if (!candidate) {
    return false;
  }
  return typeof candidate.read === "function";
}
function isReadableStream(obj) {
  const candidate = obj;
  if (!candidate) {
    return false;
  }
  return [candidate.on, candidate.pause, candidate.resume, candidate.destroy].every((fn) => typeof fn === "function");
}
function isReadableBufferedStream(obj) {
  const candidate = obj;
  if (!candidate) {
    return false;
  }
  return isReadableStream(candidate.stream) && Array.isArray(candidate.buffer) && typeof candidate.ended === "boolean";
}
function newWriteableStream(reducer, options) {
  return new WriteableStreamImpl(reducer, options);
}
class WriteableStreamImpl {
  /**
   * @param reducer a function that reduces the buffered data into a single object;
   * 				  because some objects can be complex and non-reducible, we also
   * 				  allow passing the explicit `null` value to skip the reduce step
   * @param options stream options
   */
  constructor(reducer, options) {
    this.reducer = reducer;
    this.options = options;
    this.state = {
      flowing: false,
      ended: false,
      destroyed: false
    };
    this.buffer = {
      data: [],
      error: []
    };
    this.listeners = {
      data: [],
      error: [],
      end: []
    };
    this.pendingWritePromises = [];
  }
  pause() {
    if (this.state.destroyed) {
      return;
    }
    this.state.flowing = false;
  }
  resume() {
    if (this.state.destroyed) {
      return;
    }
    if (!this.state.flowing) {
      this.state.flowing = true;
      this.flowData();
      this.flowErrors();
      this.flowEnd();
    }
  }
  write(data) {
    if (this.state.destroyed) {
      return;
    }
    if (this.state.flowing) {
      this.emitData(data);
    } else {
      this.buffer.data.push(data);
      if (typeof this.options?.highWaterMark === "number" && this.buffer.data.length > this.options.highWaterMark) {
        return new Promise((resolve) => this.pendingWritePromises.push(resolve));
      }
    }
  }
  error(error) {
    if (this.state.destroyed) {
      return;
    }
    if (this.state.flowing) {
      this.emitError(error);
    } else {
      this.buffer.error.push(error);
    }
  }
  end(result) {
    if (this.state.destroyed) {
      return;
    }
    if (typeof result !== "undefined") {
      this.write(result);
    }
    if (this.state.flowing) {
      this.emitEnd();
      this.destroy();
    } else {
      this.state.ended = true;
    }
  }
  emitData(data) {
    this.listeners.data.slice(0).forEach((listener) => listener(data));
  }
  emitError(error) {
    if (this.listeners.error.length === 0) {
      onUnexpectedError(error);
    } else {
      this.listeners.error.slice(0).forEach((listener) => listener(error));
    }
  }
  emitEnd() {
    this.listeners.end.slice(0).forEach((listener) => listener());
  }
  on(event, callback) {
    if (this.state.destroyed) {
      return;
    }
    switch (event) {
      case "data":
        this.listeners.data.push(callback);
        this.resume();
        break;
      case "end":
        this.listeners.end.push(callback);
        if (this.state.flowing && this.flowEnd()) {
          this.destroy();
        }
        break;
      case "error":
        this.listeners.error.push(callback);
        if (this.state.flowing) {
          this.flowErrors();
        }
        break;
    }
  }
  removeListener(event, callback) {
    if (this.state.destroyed) {
      return;
    }
    let listeners = void 0;
    switch (event) {
      case "data":
        listeners = this.listeners.data;
        break;
      case "end":
        listeners = this.listeners.end;
        break;
      case "error":
        listeners = this.listeners.error;
        break;
    }
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    }
  }
  flowData() {
    if (this.buffer.data.length === 0) {
      return;
    }
    if (typeof this.reducer === "function") {
      const fullDataBuffer = this.reducer(this.buffer.data);
      this.emitData(fullDataBuffer);
    } else {
      for (const data of this.buffer.data) {
        this.emitData(data);
      }
    }
    this.buffer.data.length = 0;
    const pendingWritePromises = [...this.pendingWritePromises];
    this.pendingWritePromises.length = 0;
    pendingWritePromises.forEach((pendingWritePromise) => pendingWritePromise());
  }
  flowErrors() {
    if (this.listeners.error.length > 0) {
      for (const error of this.buffer.error) {
        this.emitError(error);
      }
      this.buffer.error.length = 0;
    }
  }
  flowEnd() {
    if (this.state.ended) {
      this.emitEnd();
      return this.listeners.end.length > 0;
    }
    return false;
  }
  destroy() {
    if (!this.state.destroyed) {
      this.state.destroyed = true;
      this.state.ended = true;
      this.buffer.data.length = 0;
      this.buffer.error.length = 0;
      this.listeners.data.length = 0;
      this.listeners.error.length = 0;
      this.listeners.end.length = 0;
      this.pendingWritePromises.length = 0;
    }
  }
}
function consumeReadable(readable, reducer) {
  const chunks = [];
  let chunk;
  while ((chunk = readable.read()) !== null) {
    chunks.push(chunk);
  }
  return reducer(chunks);
}
function peekReadable(readable, reducer, maxChunks) {
  const chunks = [];
  let chunk = void 0;
  while ((chunk = readable.read()) !== null && chunks.length < maxChunks) {
    chunks.push(chunk);
  }
  if (chunk === null && chunks.length > 0) {
    return reducer(chunks);
  }
  return {
    read: () => {
      if (chunks.length > 0) {
        return chunks.shift();
      }
      if (typeof chunk !== "undefined") {
        const lastReadChunk = chunk;
        chunk = void 0;
        return lastReadChunk;
      }
      return readable.read();
    }
  };
}
function consumeStream(stream, reducer) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    listenStream(stream, {
      onData: (chunk) => {
        if (reducer) {
          chunks.push(chunk);
        }
      },
      onError: (error) => {
        if (reducer) {
          reject(error);
        } else {
          resolve(void 0);
        }
      },
      onEnd: () => {
        if (reducer) {
          resolve(reducer(chunks));
        } else {
          resolve(void 0);
        }
      }
    });
  });
}
function listenStream(stream, listener, token) {
  stream.on("error", (error) => {
    if (!token?.isCancellationRequested) {
      listener.onError(error);
    }
  });
  stream.on("end", () => {
    if (!token?.isCancellationRequested) {
      listener.onEnd();
    }
  });
  stream.on("data", (data) => {
    if (!token?.isCancellationRequested) {
      listener.onData(data);
    }
  });
}
function peekStream(stream, maxChunks) {
  return new Promise((resolve, reject) => {
    const streamListeners = new DisposableStore();
    const buffer = [];
    const dataListener = (chunk) => {
      buffer.push(chunk);
      if (buffer.length > maxChunks) {
        streamListeners.dispose();
        stream.pause();
        return resolve({ stream, buffer, ended: false });
      }
    };
    const errorListener = (error) => {
      streamListeners.dispose();
      return reject(error);
    };
    const endListener = () => {
      streamListeners.dispose();
      return resolve({ stream, buffer, ended: true });
    };
    streamListeners.add(toDisposable(() => stream.removeListener("error", errorListener)));
    stream.on("error", errorListener);
    streamListeners.add(toDisposable(() => stream.removeListener("end", endListener)));
    stream.on("end", endListener);
    streamListeners.add(toDisposable(() => stream.removeListener("data", dataListener)));
    stream.on("data", dataListener);
  });
}
function toStream(t, reducer) {
  const stream = newWriteableStream(reducer);
  stream.end(t);
  return stream;
}
function emptyStream() {
  const stream = newWriteableStream(() => {
    throw new Error("not supported");
  });
  stream.end();
  return stream;
}
function toReadable(t) {
  let consumed = false;
  return {
    read: () => {
      if (consumed) {
        return null;
      }
      consumed = true;
      return t;
    }
  };
}
function transform(stream, transformer, reducer) {
  const target = newWriteableStream(reducer);
  listenStream(stream, {
    onData: (data) => target.write(transformer.data(data)),
    onError: (error) => target.error(transformer.error ? transformer.error(error) : error),
    onEnd: () => target.end()
  });
  return target;
}
function prefixedReadable(prefix, readable, reducer) {
  let prefixHandled = false;
  return {
    read: () => {
      const chunk = readable.read();
      if (!prefixHandled) {
        prefixHandled = true;
        if (chunk !== null) {
          return reducer([prefix, chunk]);
        }
        return prefix;
      }
      return chunk;
    }
  };
}
function prefixedStream(prefix, stream, reducer) {
  let prefixHandled = false;
  const target = newWriteableStream(reducer);
  listenStream(stream, {
    onData: (data) => {
      if (!prefixHandled) {
        prefixHandled = true;
        return target.write(reducer([prefix, data]));
      }
      return target.write(data);
    },
    onError: (error) => target.error(error),
    onEnd: () => {
      if (!prefixHandled) {
        prefixHandled = true;
        target.write(prefix);
      }
      target.end();
    }
  });
  return target;
}
export {
  consumeReadable,
  consumeStream,
  emptyStream,
  isReadable,
  isReadableBufferedStream,
  isReadableStream,
  listenStream,
  newWriteableStream,
  peekReadable,
  peekStream,
  prefixedReadable,
  prefixedStream,
  toReadable,
  toStream,
  transform
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9zdHJlYW0udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IG9uVW5leHBlY3RlZEVycm9yIH0gZnJvbSAnLi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuL2xpZmVjeWNsZS5qcyc7XG5cbi8qKlxuICogVGhlIHBheWxvYWQgdGhhdCBmbG93cyBpbiByZWFkYWJsZSBzdHJlYW0gZXZlbnRzLlxuICovXG5leHBvcnQgdHlwZSBSZWFkYWJsZVN0cmVhbUV2ZW50UGF5bG9hZDxUPiA9IFQgfCBFcnJvciB8ICdlbmQnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFJlYWRhYmxlU3RyZWFtRXZlbnRzPFQ+IHtcblxuXHQvKipcblx0ICogVGhlICdkYXRhJyBldmVudCBpcyBlbWl0dGVkIHdoZW5ldmVyIHRoZSBzdHJlYW0gaXNcblx0ICogcmVsaW5xdWlzaGluZyBvd25lcnNoaXAgb2YgYSBjaHVuayBvZiBkYXRhIHRvIGEgY29uc3VtZXIuXG5cdCAqXG5cdCAqIE5PVEU6IFBMRUFTRSBVTkRFUlNUQU5EIFRIQVQgQURESU5HIEEgREFUQSBMSVNURU5FUiBDQU5cblx0ICogVFVSTiBUSEUgU1RSRUFNIElOVE8gRkxPV0lORyBNT0RFLiBJVCBJUyBUSEVSRUZPUiBUSEVcblx0ICogTEFTVCBMSVNURU5FUiBUSEFUIFNIT1VMRCBCRSBBRERFRCBBTkQgTk9UIFRIRSBGSVJTVFxuXHQgKlxuXHQgKiBVc2UgYGxpc3RlblN0cmVhbWAgYXMgYSBoZWxwZXIgbWV0aG9kIHRvIGxpc3RlbiB0b1xuXHQgKiBzdHJlYW0gZXZlbnRzIGluIHRoZSByaWdodCBvcmRlci5cblx0ICovXG5cdG9uKGV2ZW50OiAnZGF0YScsIGNhbGxiYWNrOiAoZGF0YTogVCkgPT4gdm9pZCk6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIEVtaXR0ZWQgd2hlbiBhbnkgZXJyb3Igb2NjdXJzLlxuXHQgKi9cblx0b24oZXZlbnQ6ICdlcnJvcicsIGNhbGxiYWNrOiAoZXJyOiBFcnJvcikgPT4gdm9pZCk6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIFRoZSAnZW5kJyBldmVudCBpcyBlbWl0dGVkIHdoZW4gdGhlcmUgaXMgbm8gbW9yZSBkYXRhXG5cdCAqIHRvIGJlIGNvbnN1bWVkIGZyb20gdGhlIHN0cmVhbS4gVGhlICdlbmQnIGV2ZW50IHdpbGxcblx0ICogbm90IGJlIGVtaXR0ZWQgdW5sZXNzIHRoZSBkYXRhIGlzIGNvbXBsZXRlbHkgY29uc3VtZWQuXG5cdCAqL1xuXHRvbihldmVudDogJ2VuZCcsIGNhbGxiYWNrOiAoKSA9PiB2b2lkKTogdm9pZDtcbn1cblxuLyoqXG4gKiBBIGludGVyZmFjZSB0aGF0IGVtdWxhdGVzIHRoZSBBUEkgc2hhcGUgb2YgYSBub2RlLmpzIHJlYWRhYmxlXG4gKiBzdHJlYW0gZm9yIHVzZSBpbiBuYXRpdmUgYW5kIHdlYiBlbnZpcm9ubWVudHMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUmVhZGFibGVTdHJlYW08VD4gZXh0ZW5kcyBSZWFkYWJsZVN0cmVhbUV2ZW50czxUPiB7XG5cblx0LyoqXG5cdCAqIFN0b3BzIGVtaXR0aW5nIGFueSBldmVudHMgdW50aWwgcmVzdW1lKCkgaXMgY2FsbGVkLlxuXHQgKi9cblx0cGF1c2UoKTogdm9pZDtcblxuXHQvKipcblx0ICogU3RhcnRzIGVtaXR0aW5nIGV2ZW50cyBhZ2FpbiBhZnRlciBwYXVzZSgpIHdhcyBjYWxsZWQuXG5cdCAqL1xuXHRyZXN1bWUoKTogdm9pZDtcblxuXHQvKipcblx0ICogRGVzdHJveXMgdGhlIHN0cmVhbSBhbmQgc3RvcHMgZW1pdHRpbmcgYW55IGV2ZW50LlxuXHQgKi9cblx0ZGVzdHJveSgpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBBbGxvd3MgdG8gcmVtb3ZlIGEgbGlzdGVuZXIgdGhhdCB3YXMgcHJldmlvdXNseSBhZGRlZC5cblx0ICovXG5cdHJlbW92ZUxpc3RlbmVyKGV2ZW50OiBzdHJpbmcsIGNhbGxiYWNrOiBGdW5jdGlvbik6IHZvaWQ7XG59XG5cbi8qKlxuICogQSBpbnRlcmZhY2UgdGhhdCBlbXVsYXRlcyB0aGUgQVBJIHNoYXBlIG9mIGEgbm9kZS5qcyByZWFkYWJsZVxuICogZm9yIHVzZSBpbiBuYXRpdmUgYW5kIHdlYiBlbnZpcm9ubWVudHMuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUmVhZGFibGU8VD4ge1xuXG5cdC8qKlxuXHQgKiBSZWFkIGRhdGEgZnJvbSB0aGUgdW5kZXJseWluZyBzb3VyY2UuIFdpbGwgcmV0dXJuXG5cdCAqIG51bGwgdG8gaW5kaWNhdGUgdGhhdCBubyBtb3JlIGRhdGEgY2FuIGJlIHJlYWQuXG5cdCAqL1xuXHRyZWFkKCk6IFQgfCBudWxsO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNSZWFkYWJsZTxUPihvYmo6IHVua25vd24pOiBvYmogaXMgUmVhZGFibGU8VD4ge1xuXHRjb25zdCBjYW5kaWRhdGUgPSBvYmogYXMgUmVhZGFibGU8VD4gfCB1bmRlZmluZWQ7XG5cdGlmICghY2FuZGlkYXRlKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cmV0dXJuIHR5cGVvZiBjYW5kaWRhdGUucmVhZCA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuLyoqXG4gKiBBIGludGVyZmFjZSB0aGF0IGVtdWxhdGVzIHRoZSBBUEkgc2hhcGUgb2YgYSBub2RlLmpzIHdyaXRlYWJsZVxuICogc3RyZWFtIGZvciB1c2UgaW4gbmF0aXZlIGFuZCB3ZWIgZW52aXJvbm1lbnRzLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIFdyaXRlYWJsZVN0cmVhbTxUPiBleHRlbmRzIFJlYWRhYmxlU3RyZWFtPFQ+IHtcblxuXHQvKipcblx0ICogV3JpdGluZyBkYXRhIHRvIHRoZSBzdHJlYW0gd2lsbCB0cmlnZ2VyIHRoZSBvbignZGF0YScpXG5cdCAqIGV2ZW50IGxpc3RlbmVyIGlmIHRoZSBzdHJlYW0gaXMgZmxvd2luZyBhbmQgYnVmZmVyIHRoZVxuXHQgKiBkYXRhIG90aGVyd2lzZSB1bnRpbCB0aGUgc3RyZWFtIGlzIGZsb3dpbmcuXG5cdCAqXG5cdCAqIElmIGEgYGhpZ2hXYXRlck1hcmtgIGlzIGNvbmZpZ3VyZWQgYW5kIHdyaXRpbmcgdG8gdGhlXG5cdCAqIHN0cmVhbSByZWFjaGVzIHRoaXMgbWFyaywgYSBwcm9taXNlIHdpbGwgYmUgcmV0dXJuZWRcblx0ICogdGhhdCBzaG91bGQgYmUgYXdhaXRlZCBvbiBiZWZvcmUgd3JpdGluZyBtb3JlIGRhdGEuXG5cdCAqIE90aGVyd2lzZSB0aGVyZSBpcyBhIHJpc2sgb2YgYnVmZmVyaW5nIGEgbGFyZ2UgbnVtYmVyXG5cdCAqIG9mIGRhdGEgY2h1bmtzIHdpdGhvdXQgY29uc3VtZXIuXG5cdCAqL1xuXHR3cml0ZShkYXRhOiBUKTogdm9pZCB8IFByb21pc2U8dm9pZD47XG5cblx0LyoqXG5cdCAqIFNpZ25hbHMgYW4gZXJyb3IgdG8gdGhlIGNvbnN1bWVyIG9mIHRoZSBzdHJlYW0gdmlhIHRoZVxuXHQgKiBvbignZXJyb3InKSBoYW5kbGVyIGlmIHRoZSBzdHJlYW0gaXMgZmxvd2luZy5cblx0ICpcblx0ICogTk9URTogY2FsbCBgZW5kYCB0byBzaWduYWwgdGhhdCB0aGUgc3RyZWFtIGhhcyBlbmRlZCxcblx0ICogdGhpcyBET0VTIE5PVCBoYXBwZW4gYXV0b21hdGljYWxseSBmcm9tIGBlcnJvcmAuXG5cdCAqL1xuXHRlcnJvcihlcnJvcjogRXJyb3IpOiB2b2lkO1xuXG5cdC8qKlxuXHQgKiBTaWduYWxzIHRoZSBlbmQgb2YgdGhlIHN0cmVhbSB0byB0aGUgY29uc3VtZXIuIElmIHRoZVxuXHQgKiByZXN1bHQgaXMgcHJvdmlkZWQsIHdpbGwgdHJpZ2dlciB0aGUgb24oJ2RhdGEnKSBldmVudFxuXHQgKiBsaXN0ZW5lciBpZiB0aGUgc3RyZWFtIGlzIGZsb3dpbmcgYW5kIGJ1ZmZlciB0aGUgZGF0YVxuXHQgKiBvdGhlcndpc2UgdW50aWwgdGhlIHN0cmVhbSBpcyBmbG93aW5nLlxuXHQgKi9cblx0ZW5kKHJlc3VsdD86IFQpOiB2b2lkO1xufVxuXG4vKipcbiAqIEEgc3RyZWFtIHRoYXQgaGFzIGEgYnVmZmVyIGFscmVhZHkgcmVhZC4gUmV0dXJucyB0aGUgb3JpZ2luYWwgc3RyZWFtXG4gKiB0aGF0IHdhcyByZWFkIGFzIHdlbGwgYXMgdGhlIGNodW5rcyB0aGF0IGdvdCByZWFkLlxuICpcbiAqIFRoZSBgZW5kZWRgIGZsYWcgaW5kaWNhdGVzIGlmIHRoZSBzdHJlYW0gaGFzIGJlZW4gZnVsbHkgY29uc3VtZWQuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgUmVhZGFibGVCdWZmZXJlZFN0cmVhbTxUPiB7XG5cblx0LyoqXG5cdCAqIFRoZSBvcmlnaW5hbCBzdHJlYW0gdGhhdCBpcyBiZWluZyByZWFkLlxuXHQgKi9cblx0c3RyZWFtOiBSZWFkYWJsZVN0cmVhbTxUPjtcblxuXHQvKipcblx0ICogQW4gYXJyYXkgb2YgY2h1bmtzIGFscmVhZHkgcmVhZCBmcm9tIHRoaXMgc3RyZWFtLlxuXHQgKi9cblx0YnVmZmVyOiBUW107XG5cblx0LyoqXG5cdCAqIFNpZ25hbHMgaWYgdGhlIHN0cmVhbSBoYXMgZW5kZWQgb3Igbm90LiBJZiBub3QsIGNvbnN1bWVyc1xuXHQgKiBzaG91bGQgY29udGludWUgdG8gcmVhZCBmcm9tIHRoZSBzdHJlYW0gdW50aWwgY29uc3VtZWQuXG5cdCAqL1xuXHRlbmRlZDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzUmVhZGFibGVTdHJlYW08VD4ob2JqOiB1bmtub3duKTogb2JqIGlzIFJlYWRhYmxlU3RyZWFtPFQ+IHtcblx0Y29uc3QgY2FuZGlkYXRlID0gb2JqIGFzIFJlYWRhYmxlU3RyZWFtPFQ+IHwgdW5kZWZpbmVkO1xuXHRpZiAoIWNhbmRpZGF0ZSkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHJldHVybiBbY2FuZGlkYXRlLm9uLCBjYW5kaWRhdGUucGF1c2UsIGNhbmRpZGF0ZS5yZXN1bWUsIGNhbmRpZGF0ZS5kZXN0cm95XS5ldmVyeShmbiA9PiB0eXBlb2YgZm4gPT09ICdmdW5jdGlvbicpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNSZWFkYWJsZUJ1ZmZlcmVkU3RyZWFtPFQ+KG9iajogdW5rbm93bik6IG9iaiBpcyBSZWFkYWJsZUJ1ZmZlcmVkU3RyZWFtPFQ+IHtcblx0Y29uc3QgY2FuZGlkYXRlID0gb2JqIGFzIFJlYWRhYmxlQnVmZmVyZWRTdHJlYW08VD4gfCB1bmRlZmluZWQ7XG5cdGlmICghY2FuZGlkYXRlKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0cmV0dXJuIGlzUmVhZGFibGVTdHJlYW0oY2FuZGlkYXRlLnN0cmVhbSkgJiYgQXJyYXkuaXNBcnJheShjYW5kaWRhdGUuYnVmZmVyKSAmJiB0eXBlb2YgY2FuZGlkYXRlLmVuZGVkID09PSAnYm9vbGVhbic7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVJlZHVjZXI8VCwgUiA9IFQ+IHtcblx0KGRhdGE6IFRbXSk6IFI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSURhdGFUcmFuc2Zvcm1lcjxPcmlnaW5hbCwgVHJhbnNmb3JtZWQ+IHtcblx0KGRhdGE6IE9yaWdpbmFsKTogVHJhbnNmb3JtZWQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUVycm9yVHJhbnNmb3JtZXIge1xuXHQoZXJyb3I6IEVycm9yKTogRXJyb3I7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRyYW5zZm9ybWVyPE9yaWdpbmFsLCBUcmFuc2Zvcm1lZD4ge1xuXHRkYXRhOiBJRGF0YVRyYW5zZm9ybWVyPE9yaWdpbmFsLCBUcmFuc2Zvcm1lZD47XG5cdGVycm9yPzogSUVycm9yVHJhbnNmb3JtZXI7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBuZXdXcml0ZWFibGVTdHJlYW08VD4ocmVkdWNlcjogSVJlZHVjZXI8VD4gfCBudWxsLCBvcHRpb25zPzogV3JpdGVhYmxlU3RyZWFtT3B0aW9ucyk6IFdyaXRlYWJsZVN0cmVhbTxUPiB7XG5cdHJldHVybiBuZXcgV3JpdGVhYmxlU3RyZWFtSW1wbDxUPihyZWR1Y2VyLCBvcHRpb25zKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBXcml0ZWFibGVTdHJlYW1PcHRpb25zIHtcblxuXHQvKipcblx0ICogVGhlIG51bWJlciBvZiBvYmplY3RzIHRvIGJ1ZmZlciBiZWZvcmUgV3JpdGVhYmxlU3RyZWFtI3dyaXRlKClcblx0ICogc2lnbmFscyBiYWNrIHRoYXQgdGhlIGJ1ZmZlciBpcyBmdWxsLiBDYW4gYmUgdXNlZCB0byByZWR1Y2Vcblx0ICogdGhlIG1lbW9yeSBwcmVzc3VyZSB3aGVuIHRoZSBzdHJlYW0gaXMgbm90IGZsb3dpbmcuXG5cdCAqL1xuXHRoaWdoV2F0ZXJNYXJrPzogbnVtYmVyO1xufVxuXG5jbGFzcyBXcml0ZWFibGVTdHJlYW1JbXBsPFQ+IGltcGxlbWVudHMgV3JpdGVhYmxlU3RyZWFtPFQ+IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHN0YXRlID0ge1xuXHRcdGZsb3dpbmc6IGZhbHNlLFxuXHRcdGVuZGVkOiBmYWxzZSxcblx0XHRkZXN0cm95ZWQ6IGZhbHNlXG5cdH07XG5cblx0cHJpdmF0ZSByZWFkb25seSBidWZmZXIgPSB7XG5cdFx0ZGF0YTogW10gYXMgVFtdLFxuXHRcdGVycm9yOiBbXSBhcyBFcnJvcltdXG5cdH07XG5cblx0cHJpdmF0ZSByZWFkb25seSBsaXN0ZW5lcnMgPSB7XG5cdFx0ZGF0YTogW10gYXMgeyAoZGF0YTogVCk6IHZvaWQgfVtdLFxuXHRcdGVycm9yOiBbXSBhcyB7IChlcnJvcjogRXJyb3IpOiB2b2lkIH1bXSxcblx0XHRlbmQ6IFtdIGFzIHsgKCk6IHZvaWQgfVtdXG5cdH07XG5cblx0cHJpdmF0ZSByZWFkb25seSBwZW5kaW5nV3JpdGVQcm9taXNlczogRnVuY3Rpb25bXSA9IFtdO1xuXG5cdC8qKlxuXHQgKiBAcGFyYW0gcmVkdWNlciBhIGZ1bmN0aW9uIHRoYXQgcmVkdWNlcyB0aGUgYnVmZmVyZWQgZGF0YSBpbnRvIGEgc2luZ2xlIG9iamVjdDtcblx0ICogXHRcdFx0XHQgIGJlY2F1c2Ugc29tZSBvYmplY3RzIGNhbiBiZSBjb21wbGV4IGFuZCBub24tcmVkdWNpYmxlLCB3ZSBhbHNvXG5cdCAqIFx0XHRcdFx0ICBhbGxvdyBwYXNzaW5nIHRoZSBleHBsaWNpdCBgbnVsbGAgdmFsdWUgdG8gc2tpcCB0aGUgcmVkdWNlIHN0ZXBcblx0ICogQHBhcmFtIG9wdGlvbnMgc3RyZWFtIG9wdGlvbnNcblx0ICovXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVkdWNlcjogSVJlZHVjZXI8VD4gfCBudWxsLCBwcml2YXRlIG9wdGlvbnM/OiBXcml0ZWFibGVTdHJlYW1PcHRpb25zKSB7IH1cblxuXHRwYXVzZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zdGF0ZS5kZXN0cm95ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLnN0YXRlLmZsb3dpbmcgPSBmYWxzZTtcblx0fVxuXG5cdHJlc3VtZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zdGF0ZS5kZXN0cm95ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXRoaXMuc3RhdGUuZmxvd2luZykge1xuXHRcdFx0dGhpcy5zdGF0ZS5mbG93aW5nID0gdHJ1ZTtcblxuXHRcdFx0Ly8gZW1pdCBidWZmZXJlZCBldmVudHNcblx0XHRcdHRoaXMuZmxvd0RhdGEoKTtcblx0XHRcdHRoaXMuZmxvd0Vycm9ycygpO1xuXHRcdFx0dGhpcy5mbG93RW5kKCk7XG5cdFx0fVxuXHR9XG5cblx0d3JpdGUoZGF0YTogVCk6IHZvaWQgfCBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5zdGF0ZS5kZXN0cm95ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBmbG93aW5nOiBkaXJlY3RseSBzZW5kIHRoZSBkYXRhIHRvIGxpc3RlbmVyc1xuXHRcdGlmICh0aGlzLnN0YXRlLmZsb3dpbmcpIHtcblx0XHRcdHRoaXMuZW1pdERhdGEoZGF0YSk7XG5cdFx0fVxuXG5cdFx0Ly8gbm90IHlldCBmbG93aW5nOiBidWZmZXIgZGF0YSB1bnRpbCBmbG93aW5nXG5cdFx0ZWxzZSB7XG5cdFx0XHR0aGlzLmJ1ZmZlci5kYXRhLnB1c2goZGF0YSk7XG5cblx0XHRcdC8vIGhpZ2hXYXRlck1hcms6IGlmIGNvbmZpZ3VyZWQsIHNpZ25hbCBiYWNrIHdoZW4gYnVmZmVyIHJlYWNoZWQgbGltaXRzXG5cdFx0XHRpZiAodHlwZW9mIHRoaXMub3B0aW9ucz8uaGlnaFdhdGVyTWFyayA9PT0gJ251bWJlcicgJiYgdGhpcy5idWZmZXIuZGF0YS5sZW5ndGggPiB0aGlzLm9wdGlvbnMuaGlnaFdhdGVyTWFyaykge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB0aGlzLnBlbmRpbmdXcml0ZVByb21pc2VzLnB1c2gocmVzb2x2ZSkpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGVycm9yKGVycm9yOiBFcnJvcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLnN0YXRlLmRlc3Ryb3llZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIGZsb3dpbmc6IGRpcmVjdGx5IHNlbmQgdGhlIGVycm9yIHRvIGxpc3RlbmVyc1xuXHRcdGlmICh0aGlzLnN0YXRlLmZsb3dpbmcpIHtcblx0XHRcdHRoaXMuZW1pdEVycm9yKGVycm9yKTtcblx0XHR9XG5cblx0XHQvLyBub3QgeWV0IGZsb3dpbmc6IGJ1ZmZlciBlcnJvcnMgdW50aWwgZmxvd2luZ1xuXHRcdGVsc2Uge1xuXHRcdFx0dGhpcy5idWZmZXIuZXJyb3IucHVzaChlcnJvcik7XG5cdFx0fVxuXHR9XG5cblx0ZW5kKHJlc3VsdD86IFQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zdGF0ZS5kZXN0cm95ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBlbmQgd2l0aCBkYXRhIGlmIHByb3ZpZGVkXG5cdFx0aWYgKHR5cGVvZiByZXN1bHQgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHR0aGlzLndyaXRlKHJlc3VsdCk7XG5cdFx0fVxuXG5cdFx0Ly8gZmxvd2luZzogc2VuZCBlbmQgZXZlbnQgdG8gbGlzdGVuZXJzXG5cdFx0aWYgKHRoaXMuc3RhdGUuZmxvd2luZykge1xuXHRcdFx0dGhpcy5lbWl0RW5kKCk7XG5cblx0XHRcdHRoaXMuZGVzdHJveSgpO1xuXHRcdH1cblxuXHRcdC8vIG5vdCB5ZXQgZmxvd2luZzogcmVtZW1iZXIgc3RhdGVcblx0XHRlbHNlIHtcblx0XHRcdHRoaXMuc3RhdGUuZW5kZWQgPSB0cnVlO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZW1pdERhdGEoZGF0YTogVCk6IHZvaWQge1xuXHRcdHRoaXMubGlzdGVuZXJzLmRhdGEuc2xpY2UoMCkuZm9yRWFjaChsaXN0ZW5lciA9PiBsaXN0ZW5lcihkYXRhKSk7IC8vIHNsaWNlIHRvIGF2b2lkIGxpc3RlbmVyIG11dGF0aW9uIGZyb20gZGVsaXZlcmluZyBldmVudFxuXHR9XG5cblx0cHJpdmF0ZSBlbWl0RXJyb3IoZXJyb3I6IEVycm9yKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMubGlzdGVuZXJzLmVycm9yLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyb3IpOyAvLyBub2JvZHkgbGlzdGVuZWQgdG8gdGhpcyBlcnJvciBzbyB3ZSBsb2cgaXQgYXMgdW5leHBlY3RlZFxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmxpc3RlbmVycy5lcnJvci5zbGljZSgwKS5mb3JFYWNoKGxpc3RlbmVyID0+IGxpc3RlbmVyKGVycm9yKSk7IC8vIHNsaWNlIHRvIGF2b2lkIGxpc3RlbmVyIG11dGF0aW9uIGZyb20gZGVsaXZlcmluZyBldmVudFxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZW1pdEVuZCgpOiB2b2lkIHtcblx0XHR0aGlzLmxpc3RlbmVycy5lbmQuc2xpY2UoMCkuZm9yRWFjaChsaXN0ZW5lciA9PiBsaXN0ZW5lcigpKTsgLy8gc2xpY2UgdG8gYXZvaWQgbGlzdGVuZXIgbXV0YXRpb24gZnJvbSBkZWxpdmVyaW5nIGV2ZW50XG5cdH1cblxuXHRvbihldmVudDogJ2RhdGEnLCBjYWxsYmFjazogKGRhdGE6IFQpID0+IHZvaWQpOiB2b2lkO1xuXHRvbihldmVudDogJ2Vycm9yJywgY2FsbGJhY2s6IChlcnI6IEVycm9yKSA9PiB2b2lkKTogdm9pZDtcblx0b24oZXZlbnQ6ICdlbmQnLCBjYWxsYmFjazogKCkgPT4gdm9pZCk6IHZvaWQ7XG5cdG9uKGV2ZW50OiAnZGF0YScgfCAnZXJyb3InIHwgJ2VuZCcsIGNhbGxiYWNrOiAoYXJnMD86IGFueSkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLnN0YXRlLmRlc3Ryb3llZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHN3aXRjaCAoZXZlbnQpIHtcblx0XHRcdGNhc2UgJ2RhdGEnOlxuXHRcdFx0XHR0aGlzLmxpc3RlbmVycy5kYXRhLnB1c2goY2FsbGJhY2spO1xuXG5cdFx0XHRcdC8vIHN3aXRjaCBpbnRvIGZsb3dpbmcgbW9kZSBhcyBzb29uIGFzIHRoZSBmaXJzdCAnZGF0YSdcblx0XHRcdFx0Ly8gbGlzdGVuZXIgaXMgYWRkZWQgYW5kIHdlIGFyZSBub3QgeWV0IGluIGZsb3dpbmcgbW9kZVxuXHRcdFx0XHR0aGlzLnJlc3VtZSgpO1xuXG5cdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRjYXNlICdlbmQnOlxuXHRcdFx0XHR0aGlzLmxpc3RlbmVycy5lbmQucHVzaChjYWxsYmFjayk7XG5cblx0XHRcdFx0Ly8gZW1pdCAnZW5kJyBldmVudCBkaXJlY3RseSBpZiB3ZSBhcmUgZmxvd2luZ1xuXHRcdFx0XHQvLyBhbmQgdGhlIGVuZCBoYXMgYWxyZWFkeSBiZWVuIHJlYWNoZWRcblx0XHRcdFx0Ly9cblx0XHRcdFx0Ly8gZmluaXNoKCkgd2hlbiBpdCB3ZW50IHRocm91Z2hcblx0XHRcdFx0aWYgKHRoaXMuc3RhdGUuZmxvd2luZyAmJiB0aGlzLmZsb3dFbmQoKSkge1xuXHRcdFx0XHRcdHRoaXMuZGVzdHJveSgpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgJ2Vycm9yJzpcblx0XHRcdFx0dGhpcy5saXN0ZW5lcnMuZXJyb3IucHVzaChjYWxsYmFjayk7XG5cblx0XHRcdFx0Ly8gZW1pdCBidWZmZXJlZCAnZXJyb3InIGV2ZW50cyB1bmxlc3MgZG9uZSBhbHJlYWR5XG5cdFx0XHRcdC8vIG5vdyB0aGF0IHdlIGtub3cgdGhhdCB3ZSBoYXZlIGF0IGxlYXN0IG9uZSBsaXN0ZW5lclxuXHRcdFx0XHRpZiAodGhpcy5zdGF0ZS5mbG93aW5nKSB7XG5cdFx0XHRcdFx0dGhpcy5mbG93RXJyb3JzKCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cdH1cblxuXHRyZW1vdmVMaXN0ZW5lcihldmVudDogc3RyaW5nLCBjYWxsYmFjazogRnVuY3Rpb24pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5zdGF0ZS5kZXN0cm95ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgbGlzdGVuZXJzOiB1bmtub3duW10gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRzd2l0Y2ggKGV2ZW50KSB7XG5cdFx0XHRjYXNlICdkYXRhJzpcblx0XHRcdFx0bGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnMuZGF0YTtcblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgJ2VuZCc6XG5cdFx0XHRcdGxpc3RlbmVycyA9IHRoaXMubGlzdGVuZXJzLmVuZDtcblx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdGNhc2UgJ2Vycm9yJzpcblx0XHRcdFx0bGlzdGVuZXJzID0gdGhpcy5saXN0ZW5lcnMuZXJyb3I7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdGlmIChsaXN0ZW5lcnMpIHtcblx0XHRcdGNvbnN0IGluZGV4ID0gbGlzdGVuZXJzLmluZGV4T2YoY2FsbGJhY2spO1xuXHRcdFx0aWYgKGluZGV4ID49IDApIHtcblx0XHRcdFx0bGlzdGVuZXJzLnNwbGljZShpbmRleCwgMSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBmbG93RGF0YSgpOiB2b2lkIHtcblx0XHQvLyBpZiBidWZmZXIgaXMgZW1wdHksIG5vdGhpbmcgdG8gZG9cblx0XHRpZiAodGhpcy5idWZmZXIuZGF0YS5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBpZiBidWZmZXIgZGF0YSBjYW4gYmUgcmVkdWNlZCBpbnRvIGEgc2luZ2xlIG9iamVjdCxcblx0XHQvLyBlbWl0IHRoZSByZWR1Y2VkIGRhdGFcblx0XHRpZiAodHlwZW9mIHRoaXMucmVkdWNlciA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0Y29uc3QgZnVsbERhdGFCdWZmZXIgPSB0aGlzLnJlZHVjZXIodGhpcy5idWZmZXIuZGF0YSk7XG5cblx0XHRcdHRoaXMuZW1pdERhdGEoZnVsbERhdGFCdWZmZXIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBvdGhlcndpc2UgZW1pdCBlYWNoIGJ1ZmZlcmVkIGRhdGEgaW5zdGFuY2UgaW5kaXZpZHVhbGx5XG5cdFx0XHRmb3IgKGNvbnN0IGRhdGEgb2YgdGhpcy5idWZmZXIuZGF0YSkge1xuXHRcdFx0XHR0aGlzLmVtaXREYXRhKGRhdGEpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuYnVmZmVyLmRhdGEubGVuZ3RoID0gMDtcblxuXHRcdC8vIHdoZW4gdGhlIGJ1ZmZlciBpcyBlbXB0eSwgcmVzb2x2ZSBhbGwgcGVuZGluZyB3cml0ZXJzXG5cdFx0Y29uc3QgcGVuZGluZ1dyaXRlUHJvbWlzZXMgPSBbLi4udGhpcy5wZW5kaW5nV3JpdGVQcm9taXNlc107XG5cdFx0dGhpcy5wZW5kaW5nV3JpdGVQcm9taXNlcy5sZW5ndGggPSAwO1xuXHRcdHBlbmRpbmdXcml0ZVByb21pc2VzLmZvckVhY2gocGVuZGluZ1dyaXRlUHJvbWlzZSA9PiBwZW5kaW5nV3JpdGVQcm9taXNlKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBmbG93RXJyb3JzKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmxpc3RlbmVycy5lcnJvci5sZW5ndGggPiAwKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGVycm9yIG9mIHRoaXMuYnVmZmVyLmVycm9yKSB7XG5cdFx0XHRcdHRoaXMuZW1pdEVycm9yKGVycm9yKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5idWZmZXIuZXJyb3IubGVuZ3RoID0gMDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGZsb3dFbmQoKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuc3RhdGUuZW5kZWQpIHtcblx0XHRcdHRoaXMuZW1pdEVuZCgpO1xuXG5cdFx0XHRyZXR1cm4gdGhpcy5saXN0ZW5lcnMuZW5kLmxlbmd0aCA+IDA7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0ZGVzdHJveSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuc3RhdGUuZGVzdHJveWVkKSB7XG5cdFx0XHR0aGlzLnN0YXRlLmRlc3Ryb3llZCA9IHRydWU7XG5cdFx0XHR0aGlzLnN0YXRlLmVuZGVkID0gdHJ1ZTtcblxuXHRcdFx0dGhpcy5idWZmZXIuZGF0YS5sZW5ndGggPSAwO1xuXHRcdFx0dGhpcy5idWZmZXIuZXJyb3IubGVuZ3RoID0gMDtcblxuXHRcdFx0dGhpcy5saXN0ZW5lcnMuZGF0YS5sZW5ndGggPSAwO1xuXHRcdFx0dGhpcy5saXN0ZW5lcnMuZXJyb3IubGVuZ3RoID0gMDtcblx0XHRcdHRoaXMubGlzdGVuZXJzLmVuZC5sZW5ndGggPSAwO1xuXG5cdFx0XHR0aGlzLnBlbmRpbmdXcml0ZVByb21pc2VzLmxlbmd0aCA9IDA7XG5cdFx0fVxuXHR9XG59XG5cbi8qKlxuICogSGVscGVyIHRvIGZ1bGx5IHJlYWQgYSBUIHJlYWRhYmxlIGludG8gYSBULlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29uc3VtZVJlYWRhYmxlPFQ+KHJlYWRhYmxlOiBSZWFkYWJsZTxUPiwgcmVkdWNlcjogSVJlZHVjZXI8VD4pOiBUIHtcblx0Y29uc3QgY2h1bmtzOiBUW10gPSBbXTtcblxuXHRsZXQgY2h1bms6IFQgfCBudWxsO1xuXHR3aGlsZSAoKGNodW5rID0gcmVhZGFibGUucmVhZCgpKSAhPT0gbnVsbCkge1xuXHRcdGNodW5rcy5wdXNoKGNodW5rKTtcblx0fVxuXG5cdHJldHVybiByZWR1Y2VyKGNodW5rcyk7XG59XG5cbi8qKlxuICogSGVscGVyIHRvIHJlYWQgYSBUIHJlYWRhYmxlIHVwIHRvIGEgbWF4aW11bSBvZiBjaHVua3MuIElmIHRoZSBsaW1pdCBpc1xuICogcmVhY2hlZCwgd2lsbCByZXR1cm4gYSByZWFkYWJsZSBpbnN0ZWFkIHRvIGVuc3VyZSBhbGwgZGF0YSBjYW4gc3RpbGxcbiAqIGJlIHJlYWQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwZWVrUmVhZGFibGU8VD4ocmVhZGFibGU6IFJlYWRhYmxlPFQ+LCByZWR1Y2VyOiBJUmVkdWNlcjxUPiwgbWF4Q2h1bmtzOiBudW1iZXIpOiBUIHwgUmVhZGFibGU8VD4ge1xuXHRjb25zdCBjaHVua3M6IFRbXSA9IFtdO1xuXG5cdGxldCBjaHVuazogVCB8IG51bGwgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHdoaWxlICgoY2h1bmsgPSByZWFkYWJsZS5yZWFkKCkpICE9PSBudWxsICYmIGNodW5rcy5sZW5ndGggPCBtYXhDaHVua3MpIHtcblx0XHRjaHVua3MucHVzaChjaHVuayk7XG5cdH1cblxuXHQvLyBJZiB0aGUgbGFzdCBjaHVuayBpcyBudWxsLCBpdCBtZWFucyB3ZSByZWFjaGVkIHRoZSBlbmQgb2Zcblx0Ly8gdGhlIHJlYWRhYmxlIGFuZCByZXR1cm4gYWxsIHRoZSBkYXRhIGF0IG9uY2Vcblx0aWYgKGNodW5rID09PSBudWxsICYmIGNodW5rcy5sZW5ndGggPiAwKSB7XG5cdFx0cmV0dXJuIHJlZHVjZXIoY2h1bmtzKTtcblx0fVxuXG5cdC8vIE90aGVyd2lzZSwgd2Ugc3RpbGwgaGF2ZSBhIGNodW5rLCBpdCBtZWFucyB3ZSByZWFjaGVkIHRoZSBtYXhDaHVua3Ncblx0Ly8gdmFsdWUgYW5kIGFzIHN1Y2ggd2UgcmV0dXJuIGEgbmV3IFJlYWRhYmxlIHRoYXQgZmlyc3QgcmV0dXJuc1xuXHQvLyB0aGUgZXhpc3RpbmcgcmVhZCBjaHVua3MgYW5kIHRoZW4gY29udGludWVzIHdpdGggcmVhZGluZyBmcm9tXG5cdC8vIHRoZSB1bmRlcmx5aW5nIHJlYWRhYmxlLlxuXHRyZXR1cm4ge1xuXHRcdHJlYWQ6ICgpID0+IHtcblxuXHRcdFx0Ly8gRmlyc3QgY29uc3VtZSBjaHVua3MgZnJvbSBvdXIgYXJyYXlcblx0XHRcdGlmIChjaHVua3MubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRyZXR1cm4gY2h1bmtzLnNoaWZ0KCkhO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBUaGVuIGVuc3VyZSB0byByZXR1cm4gb3VyIGxhc3QgcmVhZCBjaHVua1xuXHRcdFx0aWYgKHR5cGVvZiBjaHVuayAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0Y29uc3QgbGFzdFJlYWRDaHVuayA9IGNodW5rO1xuXG5cdFx0XHRcdC8vIGV4cGxpY2l0bHkgdXNlIHVuZGVmaW5lZCBoZXJlIHRvIGluZGljYXRlIHRoYXQgd2UgY29uc3VtZWRcblx0XHRcdFx0Ly8gdGhlIGNodW5rLCB3aGljaCBjb3VsZCBoYXZlIGVpdGhlciBiZWVuIG51bGwgb3IgdmFsdWVkLlxuXHRcdFx0XHRjaHVuayA9IHVuZGVmaW5lZDtcblxuXHRcdFx0XHRyZXR1cm4gbGFzdFJlYWRDaHVuaztcblx0XHRcdH1cblxuXHRcdFx0Ly8gRmluYWxseSBkZWxlZ2F0ZSBiYWNrIHRvIHRoZSBSZWFkYWJsZVxuXHRcdFx0cmV0dXJuIHJlYWRhYmxlLnJlYWQoKTtcblx0XHR9XG5cdH07XG59XG5cbi8qKlxuICogSGVscGVyIHRvIGZ1bGx5IHJlYWQgYSBUIHN0cmVhbSBpbnRvIGEgVCBvciBjb25zdW1pbmdcbiAqIGEgc3RyZWFtIGZ1bGx5LCBhd2FpdGluZyBhbGwgdGhlIGV2ZW50cyB3aXRob3V0IGNhcmluZ1xuICogYWJvdXQgdGhlIGRhdGEuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb25zdW1lU3RyZWFtPFQsIFIgPSBUPihzdHJlYW06IFJlYWRhYmxlU3RyZWFtRXZlbnRzPFQ+LCByZWR1Y2VyOiBJUmVkdWNlcjxULCBSPik6IFByb21pc2U8Uj47XG5leHBvcnQgZnVuY3Rpb24gY29uc3VtZVN0cmVhbShzdHJlYW06IFJlYWRhYmxlU3RyZWFtRXZlbnRzPHVua25vd24+KTogUHJvbWlzZTx1bmRlZmluZWQ+O1xuZXhwb3J0IGZ1bmN0aW9uIGNvbnN1bWVTdHJlYW08VCwgUiA9IFQ+KHN0cmVhbTogUmVhZGFibGVTdHJlYW1FdmVudHM8VD4sIHJlZHVjZXI/OiBJUmVkdWNlcjxULCBSPik6IFByb21pc2U8UiB8IHVuZGVmaW5lZD4ge1xuXHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdGNvbnN0IGNodW5rczogVFtdID0gW107XG5cblx0XHRsaXN0ZW5TdHJlYW0oc3RyZWFtLCB7XG5cdFx0XHRvbkRhdGE6IGNodW5rID0+IHtcblx0XHRcdFx0aWYgKHJlZHVjZXIpIHtcblx0XHRcdFx0XHRjaHVua3MucHVzaChjaHVuayk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRvbkVycm9yOiBlcnJvciA9PiB7XG5cdFx0XHRcdGlmIChyZWR1Y2VyKSB7XG5cdFx0XHRcdFx0cmVqZWN0KGVycm9yKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRvbkVuZDogKCkgPT4ge1xuXHRcdFx0XHRpZiAocmVkdWNlcikge1xuXHRcdFx0XHRcdHJlc29sdmUocmVkdWNlcihjaHVua3MpKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN0cmVhbUxpc3RlbmVyPFQ+IHtcblxuXHQvKipcblx0ICogVGhlICdkYXRhJyBldmVudCBpcyBlbWl0dGVkIHdoZW5ldmVyIHRoZSBzdHJlYW0gaXNcblx0ICogcmVsaW5xdWlzaGluZyBvd25lcnNoaXAgb2YgYSBjaHVuayBvZiBkYXRhIHRvIGEgY29uc3VtZXIuXG5cdCAqL1xuXHRvbkRhdGEoZGF0YTogVCk6IHZvaWQ7XG5cblx0LyoqXG5cdCAqIEVtaXR0ZWQgd2hlbiBhbnkgZXJyb3Igb2NjdXJzLlxuXHQgKi9cblx0b25FcnJvcihlcnI6IEVycm9yKTogdm9pZDtcblxuXHQvKipcblx0ICogVGhlICdlbmQnIGV2ZW50IGlzIGVtaXR0ZWQgd2hlbiB0aGVyZSBpcyBubyBtb3JlIGRhdGFcblx0ICogdG8gYmUgY29uc3VtZWQgZnJvbSB0aGUgc3RyZWFtLiBUaGUgJ2VuZCcgZXZlbnQgd2lsbFxuXHQgKiBub3QgYmUgZW1pdHRlZCB1bmxlc3MgdGhlIGRhdGEgaXMgY29tcGxldGVseSBjb25zdW1lZC5cblx0ICovXG5cdG9uRW5kKCk6IHZvaWQ7XG59XG5cbi8qKlxuICogSGVscGVyIHRvIGxpc3RlbiB0byBhbGwgZXZlbnRzIG9mIGEgVCBzdHJlYW0gaW4gcHJvcGVyIG9yZGVyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gbGlzdGVuU3RyZWFtPFQ+KHN0cmVhbTogUmVhZGFibGVTdHJlYW1FdmVudHM8VD4sIGxpc3RlbmVyOiBJU3RyZWFtTGlzdGVuZXI8VD4sIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiB2b2lkIHtcblxuXHRzdHJlYW0ub24oJ2Vycm9yJywgZXJyb3IgPT4ge1xuXHRcdGlmICghdG9rZW4/LmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRsaXN0ZW5lci5vbkVycm9yKGVycm9yKTtcblx0XHR9XG5cdH0pO1xuXG5cdHN0cmVhbS5vbignZW5kJywgKCkgPT4ge1xuXHRcdGlmICghdG9rZW4/LmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRsaXN0ZW5lci5vbkVuZCgpO1xuXHRcdH1cblx0fSk7XG5cblx0Ly8gQWRkaW5nIHRoZSBgZGF0YWAgbGlzdGVuZXIgd2lsbCB0dXJuIHRoZSBzdHJlYW1cblx0Ly8gaW50byBmbG93aW5nIG1vZGUuIEFzIHN1Y2ggaXQgaXMgaW1wb3J0YW50IHRvXG5cdC8vIGFkZCB0aGlzIGxpc3RlbmVyIGxhc3QgKERPIE5PVCBDSEFOR0UhKVxuXHRzdHJlYW0ub24oJ2RhdGEnLCBkYXRhID0+IHtcblx0XHRpZiAoIXRva2VuPy5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0bGlzdGVuZXIub25EYXRhKGRhdGEpO1xuXHRcdH1cblx0fSk7XG59XG5cbi8qKlxuICogSGVscGVyIHRvIHBlZWsgdXAgdG8gYG1heENodW5rc2AgaW50byBhIHN0cmVhbS4gVGhlIHJldHVybiB0eXBlIHNpZ25hbHMgaWZcbiAqIHRoZSBzdHJlYW0gaGFzIGVuZGVkIG9yIG5vdC4gSWYgbm90LCBjYWxsZXIgbmVlZHMgdG8gYWRkIGEgYGRhdGFgIGxpc3RlbmVyXG4gKiB0byBjb250aW51ZSByZWFkaW5nLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcGVla1N0cmVhbTxUPihzdHJlYW06IFJlYWRhYmxlU3RyZWFtPFQ+LCBtYXhDaHVua3M6IG51bWJlcik6IFByb21pc2U8UmVhZGFibGVCdWZmZXJlZFN0cmVhbTxUPj4ge1xuXHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdGNvbnN0IHN0cmVhbUxpc3RlbmVycyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBidWZmZXI6IFRbXSA9IFtdO1xuXG5cdFx0Ly8gRGF0YSBMaXN0ZW5lclxuXHRcdGNvbnN0IGRhdGFMaXN0ZW5lciA9IChjaHVuazogVCkgPT4ge1xuXG5cdFx0XHQvLyBBZGQgdG8gYnVmZmVyXG5cdFx0XHRidWZmZXIucHVzaChjaHVuayk7XG5cblx0XHRcdC8vIFdlIHJlYWNoZWQgbWF4Q2h1bmtzIGFuZCB0aHVzIG5lZWQgdG8gcmV0dXJuXG5cdFx0XHRpZiAoYnVmZmVyLmxlbmd0aCA+IG1heENodW5rcykge1xuXG5cdFx0XHRcdC8vIERpc3Bvc2UgYW55IGxpc3RlbmVycyBhbmQgZW5zdXJlIHRvIHBhdXNlIHRoZVxuXHRcdFx0XHQvLyBzdHJlYW0gc28gdGhhdCBpdCBjYW4gYmUgY29uc3VtZWQgYWdhaW4gYnkgY2FsbGVyXG5cdFx0XHRcdHN0cmVhbUxpc3RlbmVycy5kaXNwb3NlKCk7XG5cdFx0XHRcdHN0cmVhbS5wYXVzZSgpO1xuXG5cdFx0XHRcdHJldHVybiByZXNvbHZlKHsgc3RyZWFtLCBidWZmZXIsIGVuZGVkOiBmYWxzZSB9KTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly8gRXJyb3IgTGlzdGVuZXJcblx0XHRjb25zdCBlcnJvckxpc3RlbmVyID0gKGVycm9yOiBFcnJvcikgPT4ge1xuXHRcdFx0c3RyZWFtTGlzdGVuZXJzLmRpc3Bvc2UoKTtcblxuXHRcdFx0cmV0dXJuIHJlamVjdChlcnJvcik7XG5cdFx0fTtcblxuXHRcdC8vIEVuZCBMaXN0ZW5lclxuXHRcdGNvbnN0IGVuZExpc3RlbmVyID0gKCkgPT4ge1xuXHRcdFx0c3RyZWFtTGlzdGVuZXJzLmRpc3Bvc2UoKTtcblxuXHRcdFx0cmV0dXJuIHJlc29sdmUoeyBzdHJlYW0sIGJ1ZmZlciwgZW5kZWQ6IHRydWUgfSk7XG5cdFx0fTtcblxuXHRcdHN0cmVhbUxpc3RlbmVycy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHN0cmVhbS5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBlcnJvckxpc3RlbmVyKSkpO1xuXHRcdHN0cmVhbS5vbignZXJyb3InLCBlcnJvckxpc3RlbmVyKTtcblxuXHRcdHN0cmVhbUxpc3RlbmVycy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHN0cmVhbS5yZW1vdmVMaXN0ZW5lcignZW5kJywgZW5kTGlzdGVuZXIpKSk7XG5cdFx0c3RyZWFtLm9uKCdlbmQnLCBlbmRMaXN0ZW5lcik7XG5cblx0XHQvLyBJbXBvcnRhbnQ6IGxlYXZlIHRoZSBgZGF0YWAgbGlzdGVuZXIgbGFzdCBiZWNhdXNlXG5cdFx0Ly8gdGhpcyBjYW4gdHVybiB0aGUgc3RyZWFtIGludG8gZmxvd2luZyBtb2RlIGFuZCB3ZVxuXHRcdC8vIHdhbnQgYGVycm9yYCBldmVudHMgdG8gYmUgcmVjZWl2ZWQgYXMgd2VsbC5cblx0XHRzdHJlYW1MaXN0ZW5lcnMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBzdHJlYW0ucmVtb3ZlTGlzdGVuZXIoJ2RhdGEnLCBkYXRhTGlzdGVuZXIpKSk7XG5cdFx0c3RyZWFtLm9uKCdkYXRhJywgZGF0YUxpc3RlbmVyKTtcblx0fSk7XG59XG5cbi8qKlxuICogSGVscGVyIHRvIGNyZWF0ZSBhIHJlYWRhYmxlIHN0cmVhbSBmcm9tIGFuIGV4aXN0aW5nIFQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b1N0cmVhbTxUPih0OiBULCByZWR1Y2VyOiBJUmVkdWNlcjxUPik6IFJlYWRhYmxlU3RyZWFtPFQ+IHtcblx0Y29uc3Qgc3RyZWFtID0gbmV3V3JpdGVhYmxlU3RyZWFtPFQ+KHJlZHVjZXIpO1xuXG5cdHN0cmVhbS5lbmQodCk7XG5cblx0cmV0dXJuIHN0cmVhbTtcbn1cblxuLyoqXG4gKiBIZWxwZXIgdG8gY3JlYXRlIGFuIGVtcHR5IHN0cmVhbVxuICovXG5leHBvcnQgZnVuY3Rpb24gZW1wdHlTdHJlYW0oKTogUmVhZGFibGVTdHJlYW08bmV2ZXI+IHtcblx0Y29uc3Qgc3RyZWFtID0gbmV3V3JpdGVhYmxlU3RyZWFtPG5ldmVyPigoKSA9PiB7IHRocm93IG5ldyBFcnJvcignbm90IHN1cHBvcnRlZCcpOyB9KTtcblx0c3RyZWFtLmVuZCgpO1xuXG5cdHJldHVybiBzdHJlYW07XG59XG5cbi8qKlxuICogSGVscGVyIHRvIGNvbnZlcnQgYSBUIGludG8gYSBSZWFkYWJsZTxUPi5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvUmVhZGFibGU8VD4odDogVCk6IFJlYWRhYmxlPFQ+IHtcblx0bGV0IGNvbnN1bWVkID0gZmFsc2U7XG5cblx0cmV0dXJuIHtcblx0XHRyZWFkOiAoKSA9PiB7XG5cdFx0XHRpZiAoY29uc3VtZWQpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN1bWVkID0gdHJ1ZTtcblxuXHRcdFx0cmV0dXJuIHQ7XG5cdFx0fVxuXHR9O1xufVxuXG4vKipcbiAqIEhlbHBlciB0byB0cmFuc2Zvcm0gYSByZWFkYWJsZSBzdHJlYW0gaW50byBhbm90aGVyIHN0cmVhbS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRyYW5zZm9ybTxPcmlnaW5hbCwgVHJhbnNmb3JtZWQ+KHN0cmVhbTogUmVhZGFibGVTdHJlYW1FdmVudHM8T3JpZ2luYWw+LCB0cmFuc2Zvcm1lcjogSVRyYW5zZm9ybWVyPE9yaWdpbmFsLCBUcmFuc2Zvcm1lZD4sIHJlZHVjZXI6IElSZWR1Y2VyPFRyYW5zZm9ybWVkPik6IFJlYWRhYmxlU3RyZWFtPFRyYW5zZm9ybWVkPiB7XG5cdGNvbnN0IHRhcmdldCA9IG5ld1dyaXRlYWJsZVN0cmVhbTxUcmFuc2Zvcm1lZD4ocmVkdWNlcik7XG5cblx0bGlzdGVuU3RyZWFtKHN0cmVhbSwge1xuXHRcdG9uRGF0YTogZGF0YSA9PiB0YXJnZXQud3JpdGUodHJhbnNmb3JtZXIuZGF0YShkYXRhKSksXG5cdFx0b25FcnJvcjogZXJyb3IgPT4gdGFyZ2V0LmVycm9yKHRyYW5zZm9ybWVyLmVycm9yID8gdHJhbnNmb3JtZXIuZXJyb3IoZXJyb3IpIDogZXJyb3IpLFxuXHRcdG9uRW5kOiAoKSA9PiB0YXJnZXQuZW5kKClcblx0fSk7XG5cblx0cmV0dXJuIHRhcmdldDtcbn1cblxuLyoqXG4gKiBIZWxwZXIgdG8gdGFrZSBhbiBleGlzdGluZyByZWFkYWJsZSB0aGF0IHdpbGxcbiAqIGhhdmUgYSBwcmVmaXggaW5qZWN0ZWQgdG8gdGhlIGJlZ2lubmluZy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByZWZpeGVkUmVhZGFibGU8VD4ocHJlZml4OiBULCByZWFkYWJsZTogUmVhZGFibGU8VD4sIHJlZHVjZXI6IElSZWR1Y2VyPFQ+KTogUmVhZGFibGU8VD4ge1xuXHRsZXQgcHJlZml4SGFuZGxlZCA9IGZhbHNlO1xuXG5cdHJldHVybiB7XG5cdFx0cmVhZDogKCkgPT4ge1xuXHRcdFx0Y29uc3QgY2h1bmsgPSByZWFkYWJsZS5yZWFkKCk7XG5cblx0XHRcdC8vIEhhbmRsZSBwcmVmaXggb25seSBvbmNlXG5cdFx0XHRpZiAoIXByZWZpeEhhbmRsZWQpIHtcblx0XHRcdFx0cHJlZml4SGFuZGxlZCA9IHRydWU7XG5cblx0XHRcdFx0Ly8gSWYgd2UgaGF2ZSBhbHNvIGEgcmVhZC1yZXN1bHQsIG1ha2Vcblx0XHRcdFx0Ly8gc3VyZSB0byByZWR1Y2UgaXQgdG8gYSBzaW5nbGUgcmVzdWx0XG5cdFx0XHRcdGlmIChjaHVuayAhPT0gbnVsbCkge1xuXHRcdFx0XHRcdHJldHVybiByZWR1Y2VyKFtwcmVmaXgsIGNodW5rXSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBPdGhlcndpc2UsIGp1c3QgcmV0dXJuIHByZWZpeCBkaXJlY3RseVxuXHRcdFx0XHRyZXR1cm4gcHJlZml4O1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gY2h1bms7XG5cdFx0fVxuXHR9O1xufVxuXG4vKipcbiAqIEhlbHBlciB0byB0YWtlIGFuIGV4aXN0aW5nIHN0cmVhbSB0aGF0IHdpbGxcbiAqIGhhdmUgYSBwcmVmaXggaW5qZWN0ZWQgdG8gdGhlIGJlZ2lubmluZy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHByZWZpeGVkU3RyZWFtPFQ+KHByZWZpeDogVCwgc3RyZWFtOiBSZWFkYWJsZVN0cmVhbTxUPiwgcmVkdWNlcjogSVJlZHVjZXI8VD4pOiBSZWFkYWJsZVN0cmVhbTxUPiB7XG5cdGxldCBwcmVmaXhIYW5kbGVkID0gZmFsc2U7XG5cblx0Y29uc3QgdGFyZ2V0ID0gbmV3V3JpdGVhYmxlU3RyZWFtPFQ+KHJlZHVjZXIpO1xuXG5cdGxpc3RlblN0cmVhbShzdHJlYW0sIHtcblx0XHRvbkRhdGE6IGRhdGEgPT4ge1xuXG5cdFx0XHQvLyBIYW5kbGUgcHJlZml4IG9ubHkgb25jZVxuXHRcdFx0aWYgKCFwcmVmaXhIYW5kbGVkKSB7XG5cdFx0XHRcdHByZWZpeEhhbmRsZWQgPSB0cnVlO1xuXG5cdFx0XHRcdHJldHVybiB0YXJnZXQud3JpdGUocmVkdWNlcihbcHJlZml4LCBkYXRhXSkpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdGFyZ2V0LndyaXRlKGRhdGEpO1xuXHRcdH0sXG5cdFx0b25FcnJvcjogZXJyb3IgPT4gdGFyZ2V0LmVycm9yKGVycm9yKSxcblx0XHRvbkVuZDogKCkgPT4ge1xuXG5cdFx0XHQvLyBIYW5kbGUgcHJlZml4IG9ubHkgb25jZVxuXHRcdFx0aWYgKCFwcmVmaXhIYW5kbGVkKSB7XG5cdFx0XHRcdHByZWZpeEhhbmRsZWQgPSB0cnVlO1xuXG5cdFx0XHRcdHRhcmdldC53cml0ZShwcmVmaXgpO1xuXHRcdFx0fVxuXG5cdFx0XHR0YXJnZXQuZW5kKCk7XG5cdFx0fVxuXHR9KTtcblxuXHRyZXR1cm4gdGFyZ2V0O1xufVxuIl0sCiAgIm1hcHBpbmdzIjog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
