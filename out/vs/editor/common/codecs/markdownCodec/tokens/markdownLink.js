import { MarkdownToken } from "./markdownToken.js";
import { Range } from "../../../core/range.js";
import { assert } from "../../../../../base/common/assert.js";
class MarkdownLink extends MarkdownToken {
  constructor(lineNumber, columnNumber, caption, reference) {
    assert(
      !isNaN(lineNumber),
      `The line number must not be a NaN.`
    );
    assert(
      lineNumber > 0,
      `The line number must be >= 1, got "${lineNumber}".`
    );
    assert(
      columnNumber > 0,
      `The column number must be >= 1, got "${columnNumber}".`
    );
    assert(
      caption[0] === "[" && caption[caption.length - 1] === "]",
      `The caption must be enclosed in square brackets, got "${caption}".`
    );
    assert(
      reference[0] === "(" && reference[reference.length - 1] === ")",
      `The reference must be enclosed in parentheses, got "${reference}".`
    );
    super(
      new Range(
        lineNumber,
        columnNumber,
        lineNumber,
        columnNumber + caption.length + reference.length
      )
    );
    this.caption = caption;
    this.reference = reference;
    try {
      new URL(this.path);
      this.isURL = true;
    } catch {
      this.isURL = false;
    }
  }
  get text() {
    return `${this.caption}${this.reference}`;
  }
  /**
   * Returns the `reference` part of the link without enclosing parentheses.
   */
  get path() {
    return this.reference.slice(1, this.reference.length - 1);
  }
  /**
   * Check if this token is equal to another one.
   */
  equals(other) {
    if (!super.sameRange(other.range)) {
      return false;
    }
    if (!(other instanceof MarkdownLink)) {
      return false;
    }
    return this.text === other.text;
  }
  /**
   * Get the range of the `link part` of the token.
   */
  get linkRange() {
    if (this.path.length === 0) {
      return void 0;
    }
    const { range } = this;
    const startColumn = range.startColumn + this.caption.length + 1;
    const endColumn = startColumn + this.path.length;
    return new Range(
      range.startLineNumber,
      startColumn,
      range.endLineNumber,
      endColumn
    );
  }
  /**
   * Returns a string representation of the token.
   */
  toString() {
    return `md-link("${this.text}")${this.range}`;
  }
}
export {
  MarkdownLink
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL2NvZGVjcy9tYXJrZG93bkNvZGVjL3Rva2Vucy9tYXJrZG93bkxpbmsudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBCYXNlVG9rZW4gfSBmcm9tICcuLi8uLi9iYXNlVG9rZW4uanMnO1xuaW1wb3J0IHsgTWFya2Rvd25Ub2tlbiB9IGZyb20gJy4vbWFya2Rvd25Ub2tlbi5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UsIFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBhc3NlcnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3NlcnQuanMnO1xuXG4vKipcbiAqIEEgdG9rZW4gdGhhdCByZXByZXNlbnQgYSBgbWFya2Rvd24gbGlua2Agd2l0aCBhIGByYW5nZWAuIFRoZSBgcmFuZ2VgXG4gKiB2YWx1ZSByZWZsZWN0cyB0aGUgcG9zaXRpb24gb2YgdGhlIHRva2VuIGluIHRoZSBvcmlnaW5hbCBkYXRhLlxuICovXG5leHBvcnQgY2xhc3MgTWFya2Rvd25MaW5rIGV4dGVuZHMgTWFya2Rvd25Ub2tlbiB7XG5cdC8qKlxuXHQgKiBDaGVjayBpZiB0aGlzIGBtYXJrZG93biBsaW5rYCBwb2ludHMgdG8gYSB2YWxpZCBVUkwgYWRkcmVzcy5cblx0ICovXG5cdHB1YmxpYyByZWFkb25seSBpc1VSTDogYm9vbGVhbjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHQvKipcblx0XHQgKiBUaGUgc3RhcnRpbmcgbGluZSBudW1iZXIgb2YgdGhlIGxpbmsgKDEtYmFzZWQgaW5kZXhpbmcpLlxuXHRcdCAqL1xuXHRcdGxpbmVOdW1iZXI6IG51bWJlcixcblx0XHQvKipcblx0XHQgKiBUaGUgc3RhcnRpbmcgY29sdW1uIG51bWJlciBvZiB0aGUgbGluayAoMS1iYXNlZCBpbmRleGluZykuXG5cdFx0ICovXG5cdFx0Y29sdW1uTnVtYmVyOiBudW1iZXIsXG5cdFx0LyoqXG5cdFx0ICogVGhlIGNhcHRpb24gb2YgdGhlIG9yaWdpbmFsIGxpbmssIGluY2x1ZGluZyB0aGUgc3F1YXJlIGJyYWNrZXRzLlxuXHRcdCAqL1xuXHRcdHB1YmxpYyByZWFkb25seSBjYXB0aW9uOiBzdHJpbmcsXG5cdFx0LyoqXG5cdFx0ICogVGhlIHJlZmVyZW5jZSBvZiB0aGUgb3JpZ2luYWwgbGluaywgaW5jbHVkaW5nIHRoZSBwYXJlbnRoZXNlcy5cblx0XHQgKi9cblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVmZXJlbmNlOiBzdHJpbmcsXG5cdCkge1xuXHRcdGFzc2VydChcblx0XHRcdCFpc05hTihsaW5lTnVtYmVyKSxcblx0XHRcdGBUaGUgbGluZSBudW1iZXIgbXVzdCBub3QgYmUgYSBOYU4uYCxcblx0XHQpO1xuXG5cdFx0YXNzZXJ0KFxuXHRcdFx0bGluZU51bWJlciA+IDAsXG5cdFx0XHRgVGhlIGxpbmUgbnVtYmVyIG11c3QgYmUgPj0gMSwgZ290IFwiJHtsaW5lTnVtYmVyfVwiLmAsXG5cdFx0KTtcblxuXHRcdGFzc2VydChcblx0XHRcdGNvbHVtbk51bWJlciA+IDAsXG5cdFx0XHRgVGhlIGNvbHVtbiBudW1iZXIgbXVzdCBiZSA+PSAxLCBnb3QgXCIke2NvbHVtbk51bWJlcn1cIi5gLFxuXHRcdCk7XG5cblx0XHRhc3NlcnQoXG5cdFx0XHRjYXB0aW9uWzBdID09PSAnWycgJiYgY2FwdGlvbltjYXB0aW9uLmxlbmd0aCAtIDFdID09PSAnXScsXG5cdFx0XHRgVGhlIGNhcHRpb24gbXVzdCBiZSBlbmNsb3NlZCBpbiBzcXVhcmUgYnJhY2tldHMsIGdvdCBcIiR7Y2FwdGlvbn1cIi5gLFxuXHRcdCk7XG5cblx0XHRhc3NlcnQoXG5cdFx0XHRyZWZlcmVuY2VbMF0gPT09ICcoJyAmJiByZWZlcmVuY2VbcmVmZXJlbmNlLmxlbmd0aCAtIDFdID09PSAnKScsXG5cdFx0XHRgVGhlIHJlZmVyZW5jZSBtdXN0IGJlIGVuY2xvc2VkIGluIHBhcmVudGhlc2VzLCBnb3QgXCIke3JlZmVyZW5jZX1cIi5gLFxuXHRcdCk7XG5cblx0XHRzdXBlcihcblx0XHRcdG5ldyBSYW5nZShcblx0XHRcdFx0bGluZU51bWJlcixcblx0XHRcdFx0Y29sdW1uTnVtYmVyLFxuXHRcdFx0XHRsaW5lTnVtYmVyLFxuXHRcdFx0XHRjb2x1bW5OdW1iZXIgKyBjYXB0aW9uLmxlbmd0aCArIHJlZmVyZW5jZS5sZW5ndGgsXG5cdFx0XHQpLFxuXHRcdCk7XG5cblx0XHQvLyBzZXQgdXAgdGhlIGBpc1VSTGAgZmxhZyBiYXNlZCBvbiB0aGUgY3VycmVudFxuXHRcdHRyeSB7XG5cdFx0XHRuZXcgVVJMKHRoaXMucGF0aCk7XG5cdFx0XHR0aGlzLmlzVVJMID0gdHJ1ZTtcblx0XHR9IGNhdGNoIHtcblx0XHRcdHRoaXMuaXNVUkwgPSBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZ2V0IHRleHQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYCR7dGhpcy5jYXB0aW9ufSR7dGhpcy5yZWZlcmVuY2V9YDtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRoZSBgcmVmZXJlbmNlYCBwYXJ0IG9mIHRoZSBsaW5rIHdpdGhvdXQgZW5jbG9zaW5nIHBhcmVudGhlc2VzLlxuXHQgKi9cblx0cHVibGljIGdldCBwYXRoKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMucmVmZXJlbmNlLnNsaWNlKDEsIHRoaXMucmVmZXJlbmNlLmxlbmd0aCAtIDEpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENoZWNrIGlmIHRoaXMgdG9rZW4gaXMgZXF1YWwgdG8gYW5vdGhlciBvbmUuXG5cdCAqL1xuXHRwdWJsaWMgb3ZlcnJpZGUgZXF1YWxzPFQgZXh0ZW5kcyBCYXNlVG9rZW4+KG90aGVyOiBUKTogYm9vbGVhbiB7XG5cdFx0aWYgKCFzdXBlci5zYW1lUmFuZ2Uob3RoZXIucmFuZ2UpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKCEob3RoZXIgaW5zdGFuY2VvZiBNYXJrZG93bkxpbmspKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMudGV4dCA9PT0gb3RoZXIudGV4dDtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXQgdGhlIHJhbmdlIG9mIHRoZSBgbGluayBwYXJ0YCBvZiB0aGUgdG9rZW4uXG5cdCAqL1xuXHRwdWJsaWMgZ2V0IGxpbmtSYW5nZSgpOiBJUmFuZ2UgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLnBhdGgubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IHsgcmFuZ2UgfSA9IHRoaXM7XG5cblx0XHQvLyBub3RlISAnKzEnIGZvciBvcGVubmluZyBgKGAgb2YgdGhlIGxpbmtcblx0XHRjb25zdCBzdGFydENvbHVtbiA9IHJhbmdlLnN0YXJ0Q29sdW1uICsgdGhpcy5jYXB0aW9uLmxlbmd0aCArIDE7XG5cdFx0Y29uc3QgZW5kQ29sdW1uID0gc3RhcnRDb2x1bW4gKyB0aGlzLnBhdGgubGVuZ3RoO1xuXG5cdFx0cmV0dXJuIG5ldyBSYW5nZShcblx0XHRcdHJhbmdlLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdHN0YXJ0Q29sdW1uLFxuXHRcdFx0cmFuZ2UuZW5kTGluZU51bWJlcixcblx0XHRcdGVuZENvbHVtbixcblx0XHQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgYSBzdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIHRva2VuLlxuXHQgKi9cblx0cHVibGljIG92ZXJyaWRlIHRvU3RyaW5nKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGBtZC1saW5rKFwiJHt0aGlzLnRleHR9XCIpJHt0aGlzLnJhbmdlfWA7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLFNBQVMscUJBQXFCO0FBQzlCLFNBQWlCLGFBQWE7QUFDOUIsU0FBUyxjQUFjO0FBTWhCLE1BQU0scUJBQXFCLGNBQWM7QUFBQSxFQU0vQyxZQUlDLFlBSUEsY0FJZ0IsU0FJQSxXQUNmO0FBQ0Q7QUFBQSxNQUNDLENBQUMsTUFBTSxVQUFVO0FBQUEsTUFDakI7QUFBQSxJQUNEO0FBRUE7QUFBQSxNQUNDLGFBQWE7QUFBQSxNQUNiLHNDQUFzQyxVQUFVO0FBQUEsSUFDakQ7QUFFQTtBQUFBLE1BQ0MsZUFBZTtBQUFBLE1BQ2Ysd0NBQXdDLFlBQVk7QUFBQSxJQUNyRDtBQUVBO0FBQUEsTUFDQyxRQUFRLENBQUMsTUFBTSxPQUFPLFFBQVEsUUFBUSxTQUFTLENBQUMsTUFBTTtBQUFBLE1BQ3RELHlEQUF5RCxPQUFPO0FBQUEsSUFDakU7QUFFQTtBQUFBLE1BQ0MsVUFBVSxDQUFDLE1BQU0sT0FBTyxVQUFVLFVBQVUsU0FBUyxDQUFDLE1BQU07QUFBQSxNQUM1RCx1REFBdUQsU0FBUztBQUFBLElBQ2pFO0FBRUE7QUFBQSxNQUNDLElBQUk7QUFBQSxRQUNIO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBLGVBQWUsUUFBUSxTQUFTLFVBQVU7QUFBQSxNQUMzQztBQUFBLElBQ0Q7QUF0Q2dCO0FBSUE7QUFxQ2hCLFFBQUk7QUFDSCxVQUFJLElBQUksS0FBSyxJQUFJO0FBQ2pCLFdBQUssUUFBUTtBQUFBLElBQ2QsUUFBUTtBQUNQLFdBQUssUUFBUTtBQUFBLElBQ2Q7QUFBQSxFQUNEO0FBQUEsRUFFQSxJQUFvQixPQUFlO0FBQ2xDLFdBQU8sR0FBRyxLQUFLLE9BQU8sR0FBRyxLQUFLLFNBQVM7QUFBQSxFQUN4QztBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS0EsSUFBVyxPQUFlO0FBQ3pCLFdBQU8sS0FBSyxVQUFVLE1BQU0sR0FBRyxLQUFLLFVBQVUsU0FBUyxDQUFDO0FBQUEsRUFDekQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtnQixPQUE0QixPQUFtQjtBQUM5RCxRQUFJLENBQUMsTUFBTSxVQUFVLE1BQU0sS0FBSyxHQUFHO0FBQ2xDLGFBQU87QUFBQSxJQUNSO0FBRUEsUUFBSSxFQUFFLGlCQUFpQixlQUFlO0FBQ3JDLGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTyxLQUFLLFNBQVMsTUFBTTtBQUFBLEVBQzVCO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLQSxJQUFXLFlBQWdDO0FBQzFDLFFBQUksS0FBSyxLQUFLLFdBQVcsR0FBRztBQUMzQixhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sRUFBRSxNQUFNLElBQUk7QUFHbEIsVUFBTSxjQUFjLE1BQU0sY0FBYyxLQUFLLFFBQVEsU0FBUztBQUM5RCxVQUFNLFlBQVksY0FBYyxLQUFLLEtBQUs7QUFFMUMsV0FBTyxJQUFJO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTjtBQUFBLE1BQ0EsTUFBTTtBQUFBLE1BQ047QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS2dCLFdBQW1CO0FBQ2xDLFdBQU8sWUFBWSxLQUFLLElBQUksS0FBSyxLQUFLLEtBQUs7QUFBQSxFQUM1QztBQUNEOyIsCiAgIm5hbWVzIjogW10KfQo=
