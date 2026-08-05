import { BaseToken } from "../../baseToken.js";
import { assert } from "../../../../../base/common/assert.js";
import { Range } from "../../../../../editor/common/core/range.js";
class Line extends BaseToken {
  constructor(lineNumber, text) {
    assert(
      !isNaN(lineNumber),
      `The line number must not be a NaN.`
    );
    assert(
      lineNumber > 0,
      `The line number must be >= 1, got "${lineNumber}".`
    );
    super(
      new Range(
        lineNumber,
        1,
        lineNumber,
        text.length + 1
      )
    );
    this.text = text;
  }
  /**
   * Check if this token is equal to another one.
   */
  equals(other) {
    if (!super.equals(other)) {
      return false;
    }
    if (!(other instanceof Line)) {
      return false;
    }
    return this.text === other.text;
  }
  /**
   * Returns a string representation of the token.
   */
  toString() {
    return `line("${this.text}")${this.range}`;
  }
}
export {
  Line
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL2NvZGVjcy9saW5lc0NvZGVjL3Rva2Vucy9saW5lLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQmFzZVRva2VuIH0gZnJvbSAnLi4vLi4vYmFzZVRva2VuLmpzJztcbmltcG9ydCB7IGFzc2VydCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Fzc2VydC5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5cbi8qKlxuICogVG9rZW4gcmVwcmVzZW50aW5nIGEgbGluZSBvZiB0ZXh0IHdpdGggYSBgcmFuZ2VgIHdoaWNoXG4gKiByZWZsZWN0cyB0aGUgbGluZSdzIHBvc2l0aW9uIGluIHRoZSBvcmlnaW5hbCBkYXRhLlxuICovXG5leHBvcnQgY2xhc3MgTGluZSBleHRlbmRzIEJhc2VUb2tlbiB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdC8vIHRoZSBsaW5lIGluZGV4XG5cdFx0Ly8gTm90ZSEgMS1iYXNlZCBpbmRleGluZ1xuXHRcdGxpbmVOdW1iZXI6IG51bWJlcixcblx0XHQvLyB0aGUgbGluZSBjb250ZW50c1xuXHRcdHB1YmxpYyByZWFkb25seSB0ZXh0OiBzdHJpbmcsXG5cdCkge1xuXHRcdGFzc2VydChcblx0XHRcdCFpc05hTihsaW5lTnVtYmVyKSxcblx0XHRcdGBUaGUgbGluZSBudW1iZXIgbXVzdCBub3QgYmUgYSBOYU4uYCxcblx0XHQpO1xuXG5cdFx0YXNzZXJ0KFxuXHRcdFx0bGluZU51bWJlciA+IDAsXG5cdFx0XHRgVGhlIGxpbmUgbnVtYmVyIG11c3QgYmUgPj0gMSwgZ290IFwiJHtsaW5lTnVtYmVyfVwiLmAsXG5cdFx0KTtcblxuXHRcdHN1cGVyKFxuXHRcdFx0bmV3IFJhbmdlKFxuXHRcdFx0XHRsaW5lTnVtYmVyLFxuXHRcdFx0XHQxLFxuXHRcdFx0XHRsaW5lTnVtYmVyLFxuXHRcdFx0XHR0ZXh0Lmxlbmd0aCArIDEsXG5cdFx0XHQpLFxuXHRcdCk7XG5cdH1cblxuXHQvKipcblx0ICogQ2hlY2sgaWYgdGhpcyB0b2tlbiBpcyBlcXVhbCB0byBhbm90aGVyIG9uZS5cblx0ICovXG5cdHB1YmxpYyBvdmVycmlkZSBlcXVhbHM8VCBleHRlbmRzIEJhc2VUb2tlbj4ob3RoZXI6IFQpOiBib29sZWFuIHtcblx0XHRpZiAoIXN1cGVyLmVxdWFscyhvdGhlcikpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRpZiAoIShvdGhlciBpbnN0YW5jZW9mIExpbmUpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMudGV4dCA9PT0gb3RoZXIudGV4dDtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIHRoZSB0b2tlbi5cblx0ICovXG5cdHB1YmxpYyBvdmVycmlkZSB0b1N0cmluZygpOiBzdHJpbmcge1xuXHRcdHJldHVybiBgbGluZShcIiR7dGhpcy50ZXh0fVwiKSR7dGhpcy5yYW5nZX1gO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGNBQWM7QUFDdkIsU0FBUyxhQUFhO0FBTWYsTUFBTSxhQUFhLFVBQVU7QUFBQSxFQUNuQyxZQUdDLFlBRWdCLE1BQ2Y7QUFDRDtBQUFBLE1BQ0MsQ0FBQyxNQUFNLFVBQVU7QUFBQSxNQUNqQjtBQUFBLElBQ0Q7QUFFQTtBQUFBLE1BQ0MsYUFBYTtBQUFBLE1BQ2Isc0NBQXNDLFVBQVU7QUFBQSxJQUNqRDtBQUVBO0FBQUEsTUFDQyxJQUFJO0FBQUEsUUFDSDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQSxLQUFLLFNBQVM7QUFBQSxNQUNmO0FBQUEsSUFDRDtBQW5CZ0I7QUFBQSxFQW9CakI7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtnQixPQUE0QixPQUFtQjtBQUM5RCxRQUFJLENBQUMsTUFBTSxPQUFPLEtBQUssR0FBRztBQUN6QixhQUFPO0FBQUEsSUFDUjtBQUVBLFFBQUksRUFBRSxpQkFBaUIsT0FBTztBQUM3QixhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU8sS0FBSyxTQUFTLE1BQU07QUFBQSxFQUM1QjtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS2dCLFdBQW1CO0FBQ2xDLFdBQU8sU0FBUyxLQUFLLElBQUksS0FBSyxLQUFLLEtBQUs7QUFBQSxFQUN6QztBQUNEOyIsCiAgIm5hbWVzIjogW10KfQo=
