import { assert } from "../assert.js";
import { Emitter } from "../event.js";
import { DeferredPromise } from "../async.js";
import { AsyncDecoder } from "./asyncDecoder.js";
import { ObservableDisposable } from "../observableDisposable.js";
class BaseDecoder extends ObservableDisposable {
  /**
   * @param stream The input stream to decode.
   */
  constructor(stream) {
    super();
    this.stream = stream;
    /**
     * Private attribute to track if the stream has ended.
     */
    this._ended = false;
    this._onData = this._register(new Emitter());
    this._onEnd = this._register(new Emitter());
    this._onError = this._register(new Emitter());
    /**
     * A store of currently registered event listeners.
     */
    this._listeners = /* @__PURE__ */ new Map();
    /**
     * Private attribute to track if the stream has started.
     */
    this.started = false;
    /**
     * Promise that resolves when the stream has ended, either by
     * receiving the `end` event or by a disposal, but not when
     * the `error` event is received alone.
     */
    this.settledPromise = new DeferredPromise();
    this.tryOnStreamData = this.tryOnStreamData.bind(this);
    this.onStreamError = this.onStreamError.bind(this);
    this.onStreamEnd = this.onStreamEnd.bind(this);
  }
  /**
   * Promise that resolves when the stream has ended, either by
   * receiving the `end` event or by a disposal, but not when
   * the `error` event is received alone.
   *
   * @throws If the stream was not yet started to prevent this
   * 		   promise to block the consumer calls indefinitely.
   */
  get settled() {
    assert(
      this.started,
      [
        "Cannot get `settled` promise of a stream that has not been started.",
        "Please call `start()` first."
      ].join(" ")
    );
    return this.settledPromise.p;
  }
  /**
   * Start receiving data from the stream.
   * @throws if the decoder stream has already ended.
   */
  start() {
    assert(
      !this._ended,
      "Cannot start stream that has already ended."
    );
    assert(
      !this.disposed,
      "Cannot start stream that has already disposed."
    );
    if (this.started) {
      return this;
    }
    this.started = true;
    this.stream.on("data", this.tryOnStreamData);
    this.stream.on("error", this.onStreamError);
    this.stream.on("end", this.onStreamEnd);
    if (this.stream instanceof BaseDecoder) {
      this.stream.start();
    }
    return this;
  }
  /**
   * Check if the decoder has been ended hence has
   * no more data to produce.
   */
  get ended() {
    return this._ended;
  }
  /**
   * Automatically catch and dispatch errors thrown inside `onStreamData`.
   */
  tryOnStreamData(data) {
    try {
      this.onStreamData(data);
    } catch (error) {
      this.onStreamError(error);
    }
  }
  on(event, callback) {
    if (event === "data") {
      return this.onData(callback);
    }
    if (event === "error") {
      return this.onError(callback);
    }
    if (event === "end") {
      return this.onEnd(callback);
    }
    throw new Error(`Invalid event name: ${event}`);
  }
  /**
   * Add listener for the `data` event.
   * @throws if the decoder stream has already ended.
   */
  onData(callback) {
    assert(
      !this.ended,
      "Cannot subscribe to the `data` event because the decoder stream has already ended."
    );
    let currentListeners = this._listeners.get("data");
    if (!currentListeners) {
      currentListeners = /* @__PURE__ */ new Map();
      this._listeners.set("data", currentListeners);
    }
    currentListeners.set(callback, this._onData.event(callback));
  }
  /**
   * Add listener for the `error` event.
   * @throws if the decoder stream has already ended.
   */
  onError(callback) {
    assert(
      !this.ended,
      "Cannot subscribe to the `error` event because the decoder stream has already ended."
    );
    let currentListeners = this._listeners.get("error");
    if (!currentListeners) {
      currentListeners = /* @__PURE__ */ new Map();
      this._listeners.set("error", currentListeners);
    }
    currentListeners.set(callback, this._onError.event(callback));
  }
  /**
   * Add listener for the `end` event.
   * @throws if the decoder stream has already ended.
   */
  onEnd(callback) {
    assert(
      !this.ended,
      "Cannot subscribe to the `end` event because the decoder stream has already ended."
    );
    let currentListeners = this._listeners.get("end");
    if (!currentListeners) {
      currentListeners = /* @__PURE__ */ new Map();
      this._listeners.set("end", currentListeners);
    }
    currentListeners.set(callback, this._onEnd.event(callback));
  }
  /**
   * Remove all existing event listeners.
   */
  removeAllListeners() {
    this.stream.removeListener("data", this.tryOnStreamData);
    this.stream.removeListener("error", this.onStreamError);
    this.stream.removeListener("end", this.onStreamEnd);
    for (const [name, listeners] of this._listeners.entries()) {
      this._listeners.delete(name);
      for (const [listener, disposable] of listeners) {
        disposable.dispose();
        listeners.delete(listener);
      }
    }
  }
  /**
   * Pauses the stream.
   */
  pause() {
    this.stream.pause();
  }
  /**
   * Resumes the stream if it has been paused.
   * @throws if the decoder stream has already ended.
   */
  resume() {
    assert(
      !this.ended,
      "Cannot resume the stream because it has already ended."
    );
    this.stream.resume();
  }
  /**
   * Destroys(disposes) the stream.
   */
  destroy() {
    this.dispose();
  }
  /**
   * Removes a priorly-registered event listener for a specified event.
   *
   * Note!
   *  - the callback function must be the same as the one that was used when
   * 	  registering the event listener as it is used as an identifier to
   *    remove the listener
   *  - this method is idempotent and results in no-op if the listener is
   *    not found, therefore passing incorrect `callback` function may
   *    result in silent unexpected behaviour
   */
  removeListener(event, callback) {
    for (const [nameName, listeners] of this._listeners.entries()) {
      if (nameName !== event) {
        continue;
      }
      for (const [listener, disposable] of listeners) {
        if (listener !== callback) {
          continue;
        }
        disposable.dispose();
        listeners.delete(listener);
      }
    }
  }
  /**
   * This method is called when the input stream ends.
   */
  onStreamEnd() {
    if (this._ended) {
      return;
    }
    this._ended = true;
    this._onEnd.fire();
    this.settledPromise.complete();
  }
  /**
   * This method is called when the input stream emits an error.
   * We re-emit the error here by default, but subclasses can
   * override this method to handle the error differently.
   */
  onStreamError(error) {
    this._onError.fire(error);
  }
  /**
   * Consume all messages from the stream, blocking until the stream finishes.
   * @throws if the decoder stream has already ended.
   */
  async consumeAll() {
    assert(
      !this._ended,
      "Cannot consume all messages of the stream that has already ended."
    );
    const messages = [];
    for await (const maybeMessage of this) {
      if (maybeMessage === null) {
        break;
      }
      messages.push(maybeMessage);
    }
    return messages;
  }
  /**
   * Async iterator interface for the decoder.
   * @throws if the decoder stream has already ended.
   */
  [Symbol.asyncIterator]() {
    assert(
      !this._ended,
      "Cannot iterate on messages of the stream that has already ended."
    );
    const asyncDecoder = this._register(new AsyncDecoder(this));
    return asyncDecoder[Symbol.asyncIterator]();
  }
  dispose() {
    if (this.disposed) {
      return;
    }
    this.onStreamEnd();
    this.stream.destroy();
    this.removeAllListeners();
    super.dispose();
  }
}
export {
  BaseDecoder
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9jb2RlY3MvYmFzZURlY29kZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBhc3NlcnQgfSBmcm9tICcuLi9hc3NlcnQuanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uL2V2ZW50LmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFJlYWRhYmxlU3RyZWFtIH0gZnJvbSAnLi4vc3RyZWFtLmpzJztcbmltcG9ydCB7IERlZmVycmVkUHJvbWlzZSB9IGZyb20gJy4uL2FzeW5jLmpzJztcbmltcG9ydCB7IEFzeW5jRGVjb2RlciB9IGZyb20gJy4vYXN5bmNEZWNvZGVyLmpzJztcbmltcG9ydCB7IE9ic2VydmFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vb2JzZXJ2YWJsZURpc3Bvc2FibGUuanMnO1xuXG4vKipcbiAqIEV2ZW50IG5hbWVzIG9mIHtAbGluayBSZWFkYWJsZVN0cmVhbX0gc3RyZWFtLlxuICovXG5leHBvcnQgdHlwZSBUU3RyZWFtTGlzdGVuZXJOYW1lcyA9ICdkYXRhJyB8ICdlcnJvcicgfCAnZW5kJztcblxuLyoqXG4gKiBCYXNlIGRlY29kZXIgY2xhc3MgdGhhdCBjYW4gYmUgdXNlZCB0byBjb252ZXJ0IHN0cmVhbSBtZXNzYWdlcyBkYXRhIHR5cGVcbiAqIGZyb20gb25lIHR5cGUgdG8gYW5vdGhlci4gRm9yIGluc3RhbmNlLCBhIHN0cmVhbSBvZiBiaW5hcnkgZGF0YSBjYW4gYmVcbiAqIFwiZGVjb2RlZFwiIGludG8gYSBzdHJlYW0gb2Ygd2VsbCBkZWZpbmVkIG9iamVjdHMuXG4gKiBJbnRlbmRlZCB0byBiZSBhIHBhcnQgb2YgXCJjb2RlY1wiIGltcGxlbWVudGF0aW9uIHJhdGhlciB0aGFuIHVzZWQgZGlyZWN0bHkuXG4gKi9cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBCYXNlRGVjb2Rlcjxcblx0VCBleHRlbmRzIE5vbk51bGxhYmxlPHVua25vd24+LFxuXHRLIGV4dGVuZHMgTm9uTnVsbGFibGU8dW5rbm93bj4gPSBOb25OdWxsYWJsZTx1bmtub3duPixcbj4gZXh0ZW5kcyBPYnNlcnZhYmxlRGlzcG9zYWJsZSBpbXBsZW1lbnRzIFJlYWRhYmxlU3RyZWFtPFQ+IHtcblx0LyoqXG5cdCAqIFByaXZhdGUgYXR0cmlidXRlIHRvIHRyYWNrIGlmIHRoZSBzdHJlYW0gaGFzIGVuZGVkLlxuXHQgKi9cblx0cHJpdmF0ZSBfZW5kZWQgPSBmYWxzZTtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGF0YSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPFQ+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkVuZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkVycm9yID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8RXJyb3I+KCkpO1xuXG5cdC8qKlxuXHQgKiBBIHN0b3JlIG9mIGN1cnJlbnRseSByZWdpc3RlcmVkIGV2ZW50IGxpc3RlbmVycy5cblx0ICovXG5cdHByaXZhdGUgcmVhZG9ubHkgX2xpc3RlbmVyczogTWFwPFRTdHJlYW1MaXN0ZW5lck5hbWVzLCBNYXA8RnVuY3Rpb24sIElEaXNwb3NhYmxlPj4gPSBuZXcgTWFwKCk7XG5cblx0LyoqXG5cdCAqIFRoaXMgbWV0aG9kIGlzIGNhbGxlZCB3aGVuIGEgbmV3IGluY29taW5nIGRhdGFcblx0ICogaXMgcmVjZWl2ZWQgZnJvbSB0aGUgaW5wdXQgc3RyZWFtLlxuXHQgKi9cblx0cHJvdGVjdGVkIGFic3RyYWN0IG9uU3RyZWFtRGF0YShkYXRhOiBLKTogdm9pZDtcblxuXHQvKipcblx0ICogQHBhcmFtIHN0cmVhbSBUaGUgaW5wdXQgc3RyZWFtIHRvIGRlY29kZS5cblx0ICovXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByb3RlY3RlZCByZWFkb25seSBzdHJlYW06IFJlYWRhYmxlU3RyZWFtPEs+LFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy50cnlPblN0cmVhbURhdGEgPSB0aGlzLnRyeU9uU3RyZWFtRGF0YS5iaW5kKHRoaXMpO1xuXHRcdHRoaXMub25TdHJlYW1FcnJvciA9IHRoaXMub25TdHJlYW1FcnJvci5iaW5kKHRoaXMpO1xuXHRcdHRoaXMub25TdHJlYW1FbmQgPSB0aGlzLm9uU3RyZWFtRW5kLmJpbmQodGhpcyk7XG5cdH1cblxuXHQvKipcblx0ICogUHJpdmF0ZSBhdHRyaWJ1dGUgdG8gdHJhY2sgaWYgdGhlIHN0cmVhbSBoYXMgc3RhcnRlZC5cblx0ICovXG5cdHByaXZhdGUgc3RhcnRlZCA9IGZhbHNlO1xuXG5cdC8qKlxuXHQgKiBQcm9taXNlIHRoYXQgcmVzb2x2ZXMgd2hlbiB0aGUgc3RyZWFtIGhhcyBlbmRlZCwgZWl0aGVyIGJ5XG5cdCAqIHJlY2VpdmluZyB0aGUgYGVuZGAgZXZlbnQgb3IgYnkgYSBkaXNwb3NhbCwgYnV0IG5vdCB3aGVuXG5cdCAqIHRoZSBgZXJyb3JgIGV2ZW50IGlzIHJlY2VpdmVkIGFsb25lLlxuXHQgKi9cblx0cHJpdmF0ZSBzZXR0bGVkUHJvbWlzZSA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblxuXHQvKipcblx0ICogUHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gdGhlIHN0cmVhbSBoYXMgZW5kZWQsIGVpdGhlciBieVxuXHQgKiByZWNlaXZpbmcgdGhlIGBlbmRgIGV2ZW50IG9yIGJ5IGEgZGlzcG9zYWwsIGJ1dCBub3Qgd2hlblxuXHQgKiB0aGUgYGVycm9yYCBldmVudCBpcyByZWNlaXZlZCBhbG9uZS5cblx0ICpcblx0ICogQHRocm93cyBJZiB0aGUgc3RyZWFtIHdhcyBub3QgeWV0IHN0YXJ0ZWQgdG8gcHJldmVudCB0aGlzXG5cdCAqIFx0XHQgICBwcm9taXNlIHRvIGJsb2NrIHRoZSBjb25zdW1lciBjYWxscyBpbmRlZmluaXRlbHkuXG5cdCAqL1xuXHRwdWJsaWMgZ2V0IHNldHRsZWQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gaWYgdGhlIHN0cmVhbSBoYXMgbm90IHN0YXJ0ZWQgeWV0LCB0aGUgcHJvbWlzZSBtaWdodFxuXHRcdC8vIGJsb2NrIHRoZSBjb25zdW1lciBjYWxscyBpbmRlZmluaXRlbHkgaWYgdGhleSBmb3JnZXRcblx0XHQvLyB0byBjYWxsIHRoZSBgc3RhcnQoKWAgbWV0aG9kLCBvciBpZiB0aGUgY2FsbCBoYXBwZW5zXG5cdFx0Ly8gYWZ0ZXIgYXdhaXQgb24gdGhlIGBzZXR0bGVkYCBwcm9taXNlOyB0byBmb3JiaWQgdGhpc1xuXHRcdC8vIGNvbmZ1c2lvbiwgd2UgcmVxdWlyZSB0aGUgc3RyZWFtIHRvIGJlIHN0YXJ0ZWQgZmlyc3Rcblx0XHRhc3NlcnQoXG5cdFx0XHR0aGlzLnN0YXJ0ZWQsXG5cdFx0XHRbXG5cdFx0XHRcdCdDYW5ub3QgZ2V0IGBzZXR0bGVkYCBwcm9taXNlIG9mIGEgc3RyZWFtIHRoYXQgaGFzIG5vdCBiZWVuIHN0YXJ0ZWQuJyxcblx0XHRcdFx0J1BsZWFzZSBjYWxsIGBzdGFydCgpYCBmaXJzdC4nLFxuXHRcdFx0XS5qb2luKCcgJyksXG5cdFx0KTtcblxuXHRcdHJldHVybiB0aGlzLnNldHRsZWRQcm9taXNlLnA7XG5cdH1cblxuXHQvKipcblx0ICogU3RhcnQgcmVjZWl2aW5nIGRhdGEgZnJvbSB0aGUgc3RyZWFtLlxuXHQgKiBAdGhyb3dzIGlmIHRoZSBkZWNvZGVyIHN0cmVhbSBoYXMgYWxyZWFkeSBlbmRlZC5cblx0ICovXG5cdHB1YmxpYyBzdGFydCgpOiB0aGlzIHtcblx0XHRhc3NlcnQoXG5cdFx0XHQhdGhpcy5fZW5kZWQsXG5cdFx0XHQnQ2Fubm90IHN0YXJ0IHN0cmVhbSB0aGF0IGhhcyBhbHJlYWR5IGVuZGVkLicsXG5cdFx0KTtcblx0XHRhc3NlcnQoXG5cdFx0XHQhdGhpcy5kaXNwb3NlZCxcblx0XHRcdCdDYW5ub3Qgc3RhcnQgc3RyZWFtIHRoYXQgaGFzIGFscmVhZHkgZGlzcG9zZWQuJyxcblx0XHQpO1xuXG5cdFx0Ly8gaWYgYWxyZWFkeSBzdGFydGVkLCBub3RoaW5nIHRvIGRvXG5cdFx0aWYgKHRoaXMuc3RhcnRlZCkge1xuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXHRcdHRoaXMuc3RhcnRlZCA9IHRydWU7XG5cblx0XHR0aGlzLnN0cmVhbS5vbignZGF0YScsIHRoaXMudHJ5T25TdHJlYW1EYXRhKTtcblx0XHR0aGlzLnN0cmVhbS5vbignZXJyb3InLCB0aGlzLm9uU3RyZWFtRXJyb3IpO1xuXHRcdHRoaXMuc3RyZWFtLm9uKCdlbmQnLCB0aGlzLm9uU3RyZWFtRW5kKTtcblxuXHRcdC8vIHRoaXMgYWxsb3dzIHRvIGNvbXBvc2UgZGVjb2RlcnMgdG9nZXRoZXIsIC0gaWYgYSBkZWNvZGVyXG5cdFx0Ly8gaW5zdGFuY2UgaXMgcGFzc2VkIGFzIGEgcmVhZGFibGUgc3RyZWFtIHRvIHRoaXMgZGVjb2Rlcixcblx0XHQvLyB0aGVuIHdlIG5lZWQgdG8gY2FsbCBgc3RhcnRgIG9uIGl0IHRvb1xuXHRcdGlmICh0aGlzLnN0cmVhbSBpbnN0YW5jZW9mIEJhc2VEZWNvZGVyKSB7XG5cdFx0XHR0aGlzLnN0cmVhbS5zdGFydCgpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0LyoqXG5cdCAqIENoZWNrIGlmIHRoZSBkZWNvZGVyIGhhcyBiZWVuIGVuZGVkIGhlbmNlIGhhc1xuXHQgKiBubyBtb3JlIGRhdGEgdG8gcHJvZHVjZS5cblx0ICovXG5cdHB1YmxpYyBnZXQgZW5kZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2VuZGVkO1xuXHR9XG5cblx0LyoqXG5cdCAqIEF1dG9tYXRpY2FsbHkgY2F0Y2ggYW5kIGRpc3BhdGNoIGVycm9ycyB0aHJvd24gaW5zaWRlIGBvblN0cmVhbURhdGFgLlxuXHQgKi9cblx0cHJpdmF0ZSB0cnlPblN0cmVhbURhdGEoZGF0YTogSyk6IHZvaWQge1xuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLm9uU3RyZWFtRGF0YShkYXRhKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhpcy5vblN0cmVhbUVycm9yKGVycm9yKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgb24oZXZlbnQ6ICdkYXRhJywgY2FsbGJhY2s6IChkYXRhOiBUKSA9PiB2b2lkKTogdm9pZDtcblx0cHVibGljIG9uKGV2ZW50OiAnZXJyb3InLCBjYWxsYmFjazogKGVycjogRXJyb3IpID0+IHZvaWQpOiB2b2lkO1xuXHRwdWJsaWMgb24oZXZlbnQ6ICdlbmQnLCBjYWxsYmFjazogKCkgPT4gdm9pZCk6IHZvaWQ7XG5cdHB1YmxpYyBvbihldmVudDogVFN0cmVhbUxpc3RlbmVyTmFtZXMsIGNhbGxiYWNrOiB1bmtub3duKTogdm9pZCB7XG5cdFx0aWYgKGV2ZW50ID09PSAnZGF0YScpIHtcblx0XHRcdHJldHVybiB0aGlzLm9uRGF0YShjYWxsYmFjayBhcyAoZGF0YTogVCkgPT4gdm9pZCk7XG5cdFx0fVxuXG5cdFx0aWYgKGV2ZW50ID09PSAnZXJyb3InKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5vbkVycm9yKGNhbGxiYWNrIGFzIChlcnJvcjogRXJyb3IpID0+IHZvaWQpO1xuXHRcdH1cblxuXHRcdGlmIChldmVudCA9PT0gJ2VuZCcpIHtcblx0XHRcdHJldHVybiB0aGlzLm9uRW5kKGNhbGxiYWNrIGFzICgpID0+IHZvaWQpO1xuXHRcdH1cblxuXHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBldmVudCBuYW1lOiAke2V2ZW50fWApO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFkZCBsaXN0ZW5lciBmb3IgdGhlIGBkYXRhYCBldmVudC5cblx0ICogQHRocm93cyBpZiB0aGUgZGVjb2RlciBzdHJlYW0gaGFzIGFscmVhZHkgZW5kZWQuXG5cdCAqL1xuXHRwdWJsaWMgb25EYXRhKGNhbGxiYWNrOiAoZGF0YTogVCkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGFzc2VydChcblx0XHRcdCF0aGlzLmVuZGVkLFxuXHRcdFx0J0Nhbm5vdCBzdWJzY3JpYmUgdG8gdGhlIGBkYXRhYCBldmVudCBiZWNhdXNlIHRoZSBkZWNvZGVyIHN0cmVhbSBoYXMgYWxyZWFkeSBlbmRlZC4nLFxuXHRcdCk7XG5cblx0XHRsZXQgY3VycmVudExpc3RlbmVycyA9IHRoaXMuX2xpc3RlbmVycy5nZXQoJ2RhdGEnKTtcblxuXHRcdGlmICghY3VycmVudExpc3RlbmVycykge1xuXHRcdFx0Y3VycmVudExpc3RlbmVycyA9IG5ldyBNYXAoKTtcblx0XHRcdHRoaXMuX2xpc3RlbmVycy5zZXQoJ2RhdGEnLCBjdXJyZW50TGlzdGVuZXJzKTtcblx0XHR9XG5cblx0XHRjdXJyZW50TGlzdGVuZXJzLnNldChjYWxsYmFjaywgdGhpcy5fb25EYXRhLmV2ZW50KGNhbGxiYWNrKSk7XG5cdH1cblxuXHQvKipcblx0ICogQWRkIGxpc3RlbmVyIGZvciB0aGUgYGVycm9yYCBldmVudC5cblx0ICogQHRocm93cyBpZiB0aGUgZGVjb2RlciBzdHJlYW0gaGFzIGFscmVhZHkgZW5kZWQuXG5cdCAqL1xuXHRwdWJsaWMgb25FcnJvcihjYWxsYmFjazogKGVycm9yOiBFcnJvcikgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGFzc2VydChcblx0XHRcdCF0aGlzLmVuZGVkLFxuXHRcdFx0J0Nhbm5vdCBzdWJzY3JpYmUgdG8gdGhlIGBlcnJvcmAgZXZlbnQgYmVjYXVzZSB0aGUgZGVjb2RlciBzdHJlYW0gaGFzIGFscmVhZHkgZW5kZWQuJyxcblx0XHQpO1xuXG5cdFx0bGV0IGN1cnJlbnRMaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnMuZ2V0KCdlcnJvcicpO1xuXG5cdFx0aWYgKCFjdXJyZW50TGlzdGVuZXJzKSB7XG5cdFx0XHRjdXJyZW50TGlzdGVuZXJzID0gbmV3IE1hcCgpO1xuXHRcdFx0dGhpcy5fbGlzdGVuZXJzLnNldCgnZXJyb3InLCBjdXJyZW50TGlzdGVuZXJzKTtcblx0XHR9XG5cblx0XHRjdXJyZW50TGlzdGVuZXJzLnNldChjYWxsYmFjaywgdGhpcy5fb25FcnJvci5ldmVudChjYWxsYmFjaykpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFkZCBsaXN0ZW5lciBmb3IgdGhlIGBlbmRgIGV2ZW50LlxuXHQgKiBAdGhyb3dzIGlmIHRoZSBkZWNvZGVyIHN0cmVhbSBoYXMgYWxyZWFkeSBlbmRlZC5cblx0ICovXG5cdHB1YmxpYyBvbkVuZChjYWxsYmFjazogKCkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGFzc2VydChcblx0XHRcdCF0aGlzLmVuZGVkLFxuXHRcdFx0J0Nhbm5vdCBzdWJzY3JpYmUgdG8gdGhlIGBlbmRgIGV2ZW50IGJlY2F1c2UgdGhlIGRlY29kZXIgc3RyZWFtIGhhcyBhbHJlYWR5IGVuZGVkLicsXG5cdFx0KTtcblxuXHRcdGxldCBjdXJyZW50TGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzLmdldCgnZW5kJyk7XG5cblx0XHRpZiAoIWN1cnJlbnRMaXN0ZW5lcnMpIHtcblx0XHRcdGN1cnJlbnRMaXN0ZW5lcnMgPSBuZXcgTWFwKCk7XG5cdFx0XHR0aGlzLl9saXN0ZW5lcnMuc2V0KCdlbmQnLCBjdXJyZW50TGlzdGVuZXJzKTtcblx0XHR9XG5cblx0XHRjdXJyZW50TGlzdGVuZXJzLnNldChjYWxsYmFjaywgdGhpcy5fb25FbmQuZXZlbnQoY2FsbGJhY2spKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZW1vdmUgYWxsIGV4aXN0aW5nIGV2ZW50IGxpc3RlbmVycy5cblx0ICovXG5cdHB1YmxpYyByZW1vdmVBbGxMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0Ly8gcmVtb3ZlIGxpc3RlbmVycyBzZXQgdXAgYnkgdGhpcyBjbGFzc1xuXHRcdHRoaXMuc3RyZWFtLnJlbW92ZUxpc3RlbmVyKCdkYXRhJywgdGhpcy50cnlPblN0cmVhbURhdGEpO1xuXHRcdHRoaXMuc3RyZWFtLnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIHRoaXMub25TdHJlYW1FcnJvcik7XG5cdFx0dGhpcy5zdHJlYW0ucmVtb3ZlTGlzdGVuZXIoJ2VuZCcsIHRoaXMub25TdHJlYW1FbmQpO1xuXG5cdFx0Ly8gcmVtb3ZlIGxpc3RlbmVycyBzZXQgdXAgYnkgZXh0ZXJuYWwgY29uc3VtZXJzXG5cdFx0Zm9yIChjb25zdCBbbmFtZSwgbGlzdGVuZXJzXSBvZiB0aGlzLl9saXN0ZW5lcnMuZW50cmllcygpKSB7XG5cdFx0XHR0aGlzLl9saXN0ZW5lcnMuZGVsZXRlKG5hbWUpO1xuXHRcdFx0Zm9yIChjb25zdCBbbGlzdGVuZXIsIGRpc3Bvc2FibGVdIG9mIGxpc3RlbmVycykge1xuXHRcdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdFx0bGlzdGVuZXJzLmRlbGV0ZShsaXN0ZW5lcik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIFBhdXNlcyB0aGUgc3RyZWFtLlxuXHQgKi9cblx0cHVibGljIHBhdXNlKCk6IHZvaWQge1xuXHRcdHRoaXMuc3RyZWFtLnBhdXNlKCk7XG5cdH1cblxuXHQvKipcblx0ICogUmVzdW1lcyB0aGUgc3RyZWFtIGlmIGl0IGhhcyBiZWVuIHBhdXNlZC5cblx0ICogQHRocm93cyBpZiB0aGUgZGVjb2RlciBzdHJlYW0gaGFzIGFscmVhZHkgZW5kZWQuXG5cdCAqL1xuXHRwdWJsaWMgcmVzdW1lKCk6IHZvaWQge1xuXHRcdGFzc2VydChcblx0XHRcdCF0aGlzLmVuZGVkLFxuXHRcdFx0J0Nhbm5vdCByZXN1bWUgdGhlIHN0cmVhbSBiZWNhdXNlIGl0IGhhcyBhbHJlYWR5IGVuZGVkLicsXG5cdFx0KTtcblxuXHRcdHRoaXMuc3RyZWFtLnJlc3VtZSgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIERlc3Ryb3lzKGRpc3Bvc2VzKSB0aGUgc3RyZWFtLlxuXHQgKi9cblx0cHVibGljIGRlc3Ryb3koKTogdm9pZCB7XG5cdFx0dGhpcy5kaXNwb3NlKCk7XG5cdH1cblxuXHQvKipcblx0ICogUmVtb3ZlcyBhIHByaW9ybHktcmVnaXN0ZXJlZCBldmVudCBsaXN0ZW5lciBmb3IgYSBzcGVjaWZpZWQgZXZlbnQuXG5cdCAqXG5cdCAqIE5vdGUhXG5cdCAqICAtIHRoZSBjYWxsYmFjayBmdW5jdGlvbiBtdXN0IGJlIHRoZSBzYW1lIGFzIHRoZSBvbmUgdGhhdCB3YXMgdXNlZCB3aGVuXG5cdCAqIFx0ICByZWdpc3RlcmluZyB0aGUgZXZlbnQgbGlzdGVuZXIgYXMgaXQgaXMgdXNlZCBhcyBhbiBpZGVudGlmaWVyIHRvXG5cdCAqICAgIHJlbW92ZSB0aGUgbGlzdGVuZXJcblx0ICogIC0gdGhpcyBtZXRob2QgaXMgaWRlbXBvdGVudCBhbmQgcmVzdWx0cyBpbiBuby1vcCBpZiB0aGUgbGlzdGVuZXIgaXNcblx0ICogICAgbm90IGZvdW5kLCB0aGVyZWZvcmUgcGFzc2luZyBpbmNvcnJlY3QgYGNhbGxiYWNrYCBmdW5jdGlvbiBtYXlcblx0ICogICAgcmVzdWx0IGluIHNpbGVudCB1bmV4cGVjdGVkIGJlaGF2aW91clxuXHQgKi9cblx0cHVibGljIHJlbW92ZUxpc3RlbmVyKGV2ZW50OiBzdHJpbmcsIGNhbGxiYWNrOiBGdW5jdGlvbik6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgW25hbWVOYW1lLCBsaXN0ZW5lcnNdIG9mIHRoaXMuX2xpc3RlbmVycy5lbnRyaWVzKCkpIHtcblx0XHRcdGlmIChuYW1lTmFtZSAhPT0gZXZlbnQpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3QgW2xpc3RlbmVyLCBkaXNwb3NhYmxlXSBvZiBsaXN0ZW5lcnMpIHtcblx0XHRcdFx0aWYgKGxpc3RlbmVyICE9PSBjYWxsYmFjaykge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdGxpc3RlbmVycy5kZWxldGUobGlzdGVuZXIpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBUaGlzIG1ldGhvZCBpcyBjYWxsZWQgd2hlbiB0aGUgaW5wdXQgc3RyZWFtIGVuZHMuXG5cdCAqL1xuXHRwcm90ZWN0ZWQgb25TdHJlYW1FbmQoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX2VuZGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fZW5kZWQgPSB0cnVlO1xuXHRcdHRoaXMuX29uRW5kLmZpcmUoKTtcblx0XHR0aGlzLnNldHRsZWRQcm9taXNlLmNvbXBsZXRlKCk7XG5cdH1cblxuXHQvKipcblx0ICogVGhpcyBtZXRob2QgaXMgY2FsbGVkIHdoZW4gdGhlIGlucHV0IHN0cmVhbSBlbWl0cyBhbiBlcnJvci5cblx0ICogV2UgcmUtZW1pdCB0aGUgZXJyb3IgaGVyZSBieSBkZWZhdWx0LCBidXQgc3ViY2xhc3NlcyBjYW5cblx0ICogb3ZlcnJpZGUgdGhpcyBtZXRob2QgdG8gaGFuZGxlIHRoZSBlcnJvciBkaWZmZXJlbnRseS5cblx0ICovXG5cdHByb3RlY3RlZCBvblN0cmVhbUVycm9yKGVycm9yOiBFcnJvcik6IHZvaWQge1xuXHRcdHRoaXMuX29uRXJyb3IuZmlyZShlcnJvcik7XG5cdH1cblxuXHQvKipcblx0ICogQ29uc3VtZSBhbGwgbWVzc2FnZXMgZnJvbSB0aGUgc3RyZWFtLCBibG9ja2luZyB1bnRpbCB0aGUgc3RyZWFtIGZpbmlzaGVzLlxuXHQgKiBAdGhyb3dzIGlmIHRoZSBkZWNvZGVyIHN0cmVhbSBoYXMgYWxyZWFkeSBlbmRlZC5cblx0ICovXG5cdHB1YmxpYyBhc3luYyBjb25zdW1lQWxsKCk6IFByb21pc2U8VFtdPiB7XG5cdFx0YXNzZXJ0KFxuXHRcdFx0IXRoaXMuX2VuZGVkLFxuXHRcdFx0J0Nhbm5vdCBjb25zdW1lIGFsbCBtZXNzYWdlcyBvZiB0aGUgc3RyZWFtIHRoYXQgaGFzIGFscmVhZHkgZW5kZWQuJyxcblx0XHQpO1xuXG5cdFx0Y29uc3QgbWVzc2FnZXMgPSBbXTtcblxuXHRcdGZvciBhd2FpdCAoY29uc3QgbWF5YmVNZXNzYWdlIG9mIHRoaXMpIHtcblx0XHRcdGlmIChtYXliZU1lc3NhZ2UgPT09IG51bGwpIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdG1lc3NhZ2VzLnB1c2gobWF5YmVNZXNzYWdlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbWVzc2FnZXM7XG5cdH1cblxuXHQvKipcblx0ICogQXN5bmMgaXRlcmF0b3IgaW50ZXJmYWNlIGZvciB0aGUgZGVjb2Rlci5cblx0ICogQHRocm93cyBpZiB0aGUgZGVjb2RlciBzdHJlYW0gaGFzIGFscmVhZHkgZW5kZWQuXG5cdCAqL1xuXHRbU3ltYm9sLmFzeW5jSXRlcmF0b3JdKCk6IEFzeW5jSXRlcmF0b3I8VCB8IG51bGw+IHtcblx0XHRhc3NlcnQoXG5cdFx0XHQhdGhpcy5fZW5kZWQsXG5cdFx0XHQnQ2Fubm90IGl0ZXJhdGUgb24gbWVzc2FnZXMgb2YgdGhlIHN0cmVhbSB0aGF0IGhhcyBhbHJlYWR5IGVuZGVkLicsXG5cdFx0KTtcblxuXHRcdGNvbnN0IGFzeW5jRGVjb2RlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBBc3luY0RlY29kZXIodGhpcykpO1xuXG5cdFx0cmV0dXJuIGFzeW5jRGVjb2RlcltTeW1ib2wuYXN5bmNJdGVyYXRvcl0oKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmRpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5vblN0cmVhbUVuZCgpO1xuXG5cdFx0dGhpcy5zdHJlYW0uZGVzdHJveSgpO1xuXHRcdHRoaXMucmVtb3ZlQWxsTGlzdGVuZXJzKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGNBQWM7QUFDdkIsU0FBUyxlQUFlO0FBR3hCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsNEJBQTRCO0FBYTlCLE1BQWUsb0JBR1oscUJBQWtEO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUF3QjNELFlBQ29CLFFBQ2xCO0FBQ0QsVUFBTTtBQUZhO0FBckJwQjtBQUFBO0FBQUE7QUFBQSxTQUFRLFNBQVM7QUFFakIsU0FBbUIsVUFBVSxLQUFLLFVBQVUsSUFBSSxRQUFXLENBQUM7QUFDNUQsU0FBaUIsU0FBUyxLQUFLLFVBQVUsSUFBSSxRQUFjLENBQUM7QUFDNUQsU0FBaUIsV0FBVyxLQUFLLFVBQVUsSUFBSSxRQUFlLENBQUM7QUFLL0Q7QUFBQTtBQUFBO0FBQUEsU0FBaUIsYUFBb0Usb0JBQUksSUFBSTtBQXdCN0Y7QUFBQTtBQUFBO0FBQUEsU0FBUSxVQUFVO0FBT2xCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxTQUFRLGlCQUFpQixJQUFJLGdCQUFzQjtBQWZsRCxTQUFLLGtCQUFrQixLQUFLLGdCQUFnQixLQUFLLElBQUk7QUFDckQsU0FBSyxnQkFBZ0IsS0FBSyxjQUFjLEtBQUssSUFBSTtBQUNqRCxTQUFLLGNBQWMsS0FBSyxZQUFZLEtBQUssSUFBSTtBQUFBLEVBQzlDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBc0JBLElBQVcsVUFBeUI7QUFNbkM7QUFBQSxNQUNDLEtBQUs7QUFBQSxNQUNMO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxNQUNELEVBQUUsS0FBSyxHQUFHO0FB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
