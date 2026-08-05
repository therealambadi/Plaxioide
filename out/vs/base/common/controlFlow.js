import { BugIndicatingError } from "./errors.js";
class ReentrancyBarrier {
  constructor() {
    this._isOccupied = false;
  }
  /**
   * Calls `runner` if the barrier is not occupied.
   * During the call, the barrier becomes occupied.
   */
  runExclusivelyOrSkip(runner) {
    if (this._isOccupied) {
      return;
    }
    this._isOccupied = true;
    try {
      runner();
    } finally {
      this._isOccupied = false;
    }
  }
  /**
   * Calls `runner`. If the barrier is occupied, throws an error.
   * During the call, the barrier becomes active.
   */
  runExclusivelyOrThrow(runner) {
    if (this._isOccupied) {
      throw new BugIndicatingError(`ReentrancyBarrier: reentrant call detected!`);
    }
    this._isOccupied = true;
    try {
      runner();
    } finally {
      this._isOccupied = false;
    }
  }
  /**
   * Indicates if some runner occupies this barrier.
  */
  get isOccupied() {
    return this._isOccupied;
  }
  makeExclusiveOrSkip(fn) {
    return (...args) => {
      if (this._isOccupied) {
        return;
      }
      this._isOccupied = true;
      try {
        return fn(...args);
      } finally {
        this._isOccupied = false;
      }
    };
  }
}
export {
  ReentrancyBarrier
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9jb250cm9sRmxvdy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgeyBCdWdJbmRpY2F0aW5nRXJyb3IgfSBmcm9tICcuL2Vycm9ycy5qcyc7XG5cbi8qXG4gKiBUaGlzIGZpbGUgY29udGFpbnMgaGVscGVyIGNsYXNzZXMgdG8gbWFuYWdlIGNvbnRyb2wgZmxvdy5cbiovXG5cbi8qKlxuICogUHJldmVudHMgY29kZSBmcm9tIGJlaW5nIHJlLWVudHJhbnQuXG4qL1xuZXhwb3J0IGNsYXNzIFJlZW50cmFuY3lCYXJyaWVyIHtcblx0cHJpdmF0ZSBfaXNPY2N1cGllZCA9IGZhbHNlO1xuXG5cdC8qKlxuXHQgKiBDYWxscyBgcnVubmVyYCBpZiB0aGUgYmFycmllciBpcyBub3Qgb2NjdXBpZWQuXG5cdCAqIER1cmluZyB0aGUgY2FsbCwgdGhlIGJhcnJpZXIgYmVjb21lcyBvY2N1cGllZC5cblx0ICovXG5cdHB1YmxpYyBydW5FeGNsdXNpdmVseU9yU2tpcChydW5uZXI6ICgpID0+IHZvaWQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5faXNPY2N1cGllZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9pc09jY3VwaWVkID0gdHJ1ZTtcblx0XHR0cnkge1xuXHRcdFx0cnVubmVyKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHRoaXMuX2lzT2NjdXBpZWQgPSBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ2FsbHMgYHJ1bm5lcmAuIElmIHRoZSBiYXJyaWVyIGlzIG9jY3VwaWVkLCB0aHJvd3MgYW4gZXJyb3IuXG5cdCAqIER1cmluZyB0aGUgY2FsbCwgdGhlIGJhcnJpZXIgYmVjb21lcyBhY3RpdmUuXG5cdCAqL1xuXHRwdWJsaWMgcnVuRXhjbHVzaXZlbHlPclRocm93KHJ1bm5lcjogKCkgPT4gdm9pZCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9pc09jY3VwaWVkKSB7XG5cdFx0XHR0aHJvdyBuZXcgQnVnSW5kaWNhdGluZ0Vycm9yKGBSZWVudHJhbmN5QmFycmllcjogcmVlbnRyYW50IGNhbGwgZGV0ZWN0ZWQhYCk7XG5cdFx0fVxuXHRcdHRoaXMuX2lzT2NjdXBpZWQgPSB0cnVlO1xuXHRcdHRyeSB7XG5cdFx0XHRydW5uZXIoKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5faXNPY2N1cGllZCA9IGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBJbmRpY2F0ZXMgaWYgc29tZSBydW5uZXIgb2NjdXBpZXMgdGhpcyBiYXJyaWVyLlxuXHQqL1xuXHRwdWJsaWMgZ2V0IGlzT2NjdXBpZWQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2lzT2NjdXBpZWQ7XG5cdH1cblxuXHRwdWJsaWMgbWFrZUV4Y2x1c2l2ZU9yU2tpcDxURnVuY3Rpb24gZXh0ZW5kcyBGdW5jdGlvbj4oZm46IFRGdW5jdGlvbik6IFRGdW5jdGlvbiB7XG5cdFx0cmV0dXJuICgoLi4uYXJnczogYW55W10pID0+IHtcblx0XHRcdGlmICh0aGlzLl9pc09jY3VwaWVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2lzT2NjdXBpZWQgPSB0cnVlO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmV0dXJuIGZuKC4uLmFyZ3MpO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0dGhpcy5faXNPY2N1cGllZCA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH0pIGFzIGFueTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBSUEsU0FBUywwQkFBMEI7QUFTNUIsTUFBTSxrQkFBa0I7QUFBQSxFQUF4QjtBQUNOLFNBQVEsY0FBYztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU1mLHFCQUFxQixRQUEwQjtBQUNyRCxRQUFJLEtBQUssYUFBYTtBQUNyQjtBQUFBLElBQ0Q7QUFDQSxTQUFLLGNBQWM7QUFDbkIsUUFBSTtBQUNILGFBQU87QUFBQSxJQUNSLFVBQUU7QUFDRCxXQUFLLGNBQWM7QUFBQSxJQUNwQjtBQUFBLEVBQ0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTU8sc0JBQXNCLFFBQTBCO0FBQ3RELFFBQUksS0FBSyxhQUFhO0FBQ3JCLFlBQU0sSUFBSSxtQkFBbUIsNkNBQTZDO0FBQUEsSUFDM0U7QUFDQSxTQUFLLGNBQWM7QUFDbkIsUUFBSTtBQUNILGFBQU87QUFBQSxJQUNSLFVBQUU7QUFDRCxXQUFLLGNBQWM7QUFBQSxJQUNwQjtBQUFBLEVBQ0Q7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtBLElBQVcsYUFBYTtBQUN2QixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFTyxvQkFBZ0QsSUFBMEI7QUFDaEYsV0FBUSxJQUFJLFNBQWdCO0FBQzNCLFVBQUksS0FBSyxhQUFhO0FBQ3JCO0FBQUEsTUFDRDtBQUNBLFdBQUssY0FBYztBQUNuQixVQUFJO0FBQ0gsZUFBTyxHQUFHLEdBQUcsSUFBSTtBQUFBLE1BQ2xCLFVBQUU7QUFDRCxhQUFLLGNBQWM7QUFBQSxNQUNwQjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0Q7IiwKICAibmFtZXMiOiBbXQp9Cg==
