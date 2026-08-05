class Lazy {
  constructor(executor) {
    this.executor = executor;
    this._didRun = false;
  }
  /**
   * True if the lazy value has been resolved.
   */
  get hasValue() {
    return this._didRun;
  }
  /**
   * Get the wrapped value.
   *
   * This will force evaluation of the lazy value if it has not been resolved yet. Lazy values are only
   * resolved once. `getValue` will re-throw exceptions that are hit while resolving the value
   */
  get value() {
    if (!this._didRun) {
      try {
        this._value = this.executor();
      } catch (err) {
        this._error = err;
      } finally {
        this._didRun = true;
      }
    }
    if (this._error) {
      throw this._error;
    }
    return this._value;
  }
  /**
   * Get the wrapped value without forcing evaluation.
   */
  get rawValue() {
    return this._value;
  }
}
export {
  Lazy
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9sYXp5LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZXhwb3J0IGNsYXNzIExhenk8VD4ge1xuXG5cdHByaXZhdGUgX2RpZFJ1bjogYm9vbGVhbiA9IGZhbHNlO1xuXHRwcml2YXRlIF92YWx1ZT86IFQ7XG5cdHByaXZhdGUgX2Vycm9yOiBFcnJvciB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGV4ZWN1dG9yOiAoKSA9PiBULFxuXHQpIHsgfVxuXG5cdC8qKlxuXHQgKiBUcnVlIGlmIHRoZSBsYXp5IHZhbHVlIGhhcyBiZWVuIHJlc29sdmVkLlxuXHQgKi9cblx0Z2V0IGhhc1ZhbHVlKCkgeyByZXR1cm4gdGhpcy5fZGlkUnVuOyB9XG5cblx0LyoqXG5cdCAqIEdldCB0aGUgd3JhcHBlZCB2YWx1ZS5cblx0ICpcblx0ICogVGhpcyB3aWxsIGZvcmNlIGV2YWx1YXRpb24gb2YgdGhlIGxhenkgdmFsdWUgaWYgaXQgaGFzIG5vdCBiZWVuIHJlc29sdmVkIHlldC4gTGF6eSB2YWx1ZXMgYXJlIG9ubHlcblx0ICogcmVzb2x2ZWQgb25jZS4gYGdldFZhbHVlYCB3aWxsIHJlLXRocm93IGV4Y2VwdGlvbnMgdGhhdCBhcmUgaGl0IHdoaWxlIHJlc29sdmluZyB0aGUgdmFsdWVcblx0ICovXG5cdGdldCB2YWx1ZSgpOiBUIHtcblx0XHRpZiAoIXRoaXMuX2RpZFJ1bikge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhpcy5fdmFsdWUgPSB0aGlzLmV4ZWN1dG9yKCk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0dGhpcy5fZXJyb3IgPSBlcnI7XG5cdFx0XHR9IGZpbmFsbHkge1xuXHRcdFx0XHR0aGlzLl9kaWRSdW4gPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAodGhpcy5fZXJyb3IpIHtcblx0XHRcdHRocm93IHRoaXMuX2Vycm9yO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fdmFsdWUhO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldCB0aGUgd3JhcHBlZCB2YWx1ZSB3aXRob3V0IGZvcmNpbmcgZXZhbHVhdGlvbi5cblx0ICovXG5cdGdldCByYXdWYWx1ZSgpOiBUIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX3ZhbHVlOyB9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLTyxNQUFNLEtBQVE7QUFBQSxFQU1wQixZQUNrQixVQUNoQjtBQURnQjtBQUxsQixTQUFRLFVBQW1CO0FBQUEsRUFNdkI7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtKLElBQUksV0FBVztBQUFFLFdBQU8sS0FBSztBQUFBLEVBQVM7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQVF0QyxJQUFJLFFBQVc7QUFDZCxRQUFJLENBQUMsS0FBSyxTQUFTO0FBQ2xCLFVBQUk7QUFDSCxhQUFLLFNBQVMsS0FBSyxTQUFTO0FBQUEsTUFDN0IsU0FBUyxLQUFLO0FBQ2IsYUFBSyxTQUFTO0FBQUEsTUFDZixVQUFFO0FBQ0QsYUFBSyxVQUFVO0FBQUEsTUFDaEI7QUFBQSxJQUNEO0FBQ0EsUUFBSSxLQUFLLFFBQVE7QUFDaEIsWUFBTSxLQUFLO0FBQUEsSUFDWjtBQUNBLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtBLElBQUksV0FBMEI7QUFBRSxXQUFPLEtBQUs7QUFBQSxFQUFRO0FBQ3JEOyIsCiAgIm5hbWVzIjogW10KfQo=
