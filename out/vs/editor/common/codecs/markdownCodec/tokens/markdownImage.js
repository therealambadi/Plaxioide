import { MarkdownToken } from "./markdownToken.js";
import { Range } from "../../../core/range.js";
import { assert } from "../../../../../base/common/assert.js";
class MarkdownImage extends MarkdownToken {
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
      caption[0] === "!",
      `The caption must start with '!' character, got "${caption}".`
    );
    assert(
      caption[1] === "[" && caption[caption.length - 1] === "]",
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
    if (!(other instanceof MarkdownImage)) {
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
    return `md-image("${this.text}")${this.range}`;
  }
}
export {
  MarkdownImage
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL2NvZGVjcy9tYXJrZG93bkNvZGVjL3Rva2Vucy9tYXJrZG93bkltYWdlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQmFzZVRva2VuIH0gZnJvbSAnLi4vLi4vYmFzZVRva2VuLmpzJztcbmltcG9ydCB7IE1hcmtkb3duVG9rZW4gfSBmcm9tICcuL21hcmtkb3duVG9rZW4uanMnO1xuaW1wb3J0IHsgSVJhbmdlLCBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgYXNzZXJ0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXNzZXJ0LmpzJztcblxuLyoqXG4gKiBBIHRva2VuIHRoYXQgcmVwcmVzZW50IGEgYG1hcmtkb3duIGltYWdlYCB3aXRoIGEgYHJhbmdlYC4gVGhlIGByYW5nZWBcbiAqIHZhbHVlIHJlZmxlY3RzIHRoZSBwb3NpdGlvbiBvZiB0aGUgdG9rZW4gaW4gdGhlIG9yaWdpbmFsIGRhdGEuXG4gKi9cbmV4cG9ydCBjbGFzcyBNYXJrZG93bkltYWdlIGV4dGVuZHMgTWFya2Rvd25Ub2tlbiB7XG5cdC8qKlxuXHQgKiBDaGVjayBpZiB0aGlzIGBtYXJrZG93biBpbWFnZSBsaW5rYCBwb2ludHMgdG8gYSB2YWxpZCBVUkwgYWRkcmVzcy5cblx0ICovXG5cdHB1YmxpYyByZWFkb25seSBpc1VSTDogYm9vbGVhbjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHQvKipcblx0XHQgKiBUaGUgc3RhcnRpbmcgbGluZSBudW1iZXIgb2YgdGhlIGltYWdlICgxLWJhc2VkIGluZGV4aW5nKS5cblx0XHQgKi9cblx0XHRsaW5lTnVtYmVyOiBudW1iZXIsXG5cdFx0LyoqXG5cdFx0ICogVGhlIHN0YXJ0aW5nIGNvbHVtbiBudW1iZXIgb2YgdGhlIGltYWdlICgxLWJhc2VkIGluZGV4aW5nKS5cblx0XHQgKi9cblx0XHRjb2x1bW5OdW1iZXI6IG51bWJlcixcblx0XHQvKipcblx0XHQgKiBUaGUgY2FwdGlvbiBvZiB0aGUgaW1hZ2UsIGluY2x1ZGluZyB0aGUgYCFgIGFuZCBgc3F1YXJlIGJyYWNrZXRzYC5cblx0XHQgKi9cblx0XHRwcml2YXRlIHJlYWRvbmx5IGNhcHRpb246IHN0cmluZyxcblx0XHQvKipcblx0XHQgKiBUaGUgcmVmZXJlbmNlIG9mIHRoZSBpbWFnZSwgaW5jbHVkaW5nIHRoZSBwYXJlbnRoZXNlcy5cblx0XHQgKi9cblx0XHRwcml2YXRlIHJlYWRvbmx5IHJlZmVyZW5jZTogc3RyaW5nLFxuXHQpIHtcblx0XHRhc3NlcnQoXG5cdFx0XHQhaXNOYU4obGluZU51bWJlciksXG5cdFx0XHRgVGhlIGxpbmUgbnVtYmVyIG11c3Qgbm90IGJlIGEgTmFOLmAsXG5cdFx0KTtcblxuXHRcdGFzc2VydChcblx0XHRcdGxpbmVOdW1iZXIgPiAwLFxuXHRcdFx0YFRoZSBsaW5lIG51bWJlciBtdXN0IGJlID49IDEsIGdvdCBcIiR7bGluZU51bWJlcn1cIi5gLFxuXHRcdCk7XG5cblx0XHRhc3NlcnQoXG5cdFx0XHRjb2x1bW5OdW1iZXIgPiAwLFxuXHRcdFx0YFRoZSBjb2x1bW4gbnVtYmVyIG11c3QgYmUgPj0gMSwgZ290IFwiJHtjb2x1bW5OdW1iZXJ9XCIuYCxcblx0XHQpO1xuXG5cdFx0YXNzZXJ0KFxuXHRcdFx0Y2FwdGlvblswXSA9PT0gJyEnLFxuXHRcdFx0YFRoZSBjYXB0aW9uIG11c3Qgc3RhcnQgd2l0aCAnIScgY2hhcmFjdGVyLCBnb3QgXCIke2NhcHRpb259XCIuYCxcblx0XHQpO1xuXG5cdFx0YXNzZXJ0KFxuXHRcdFx0Y2FwdGlvblsxXSA9PT0gJ1snICYmIGNhcHRpb25bY2FwdGlvbi5sZW5ndGggLSAxXSA9PT0gJ10nLFxuXHRcdFx0YFRoZSBjYXB0aW9uIG11c3QgYmUgZW5jbG9zZWQgaW4gc3F1YXJlIGJyYWNrZXRzLCBnb3QgXCIke2NhcHRpb259XCIuYCxcblx0XHQpO1xuXG5cdFx0YXNzZXJ0KFxuXHRcdFx0cmVmZXJlbmNlWzBdID09PSAnKCcgJiYgcmVmZXJlbmNlW3JlZmVyZW5jZS5sZW5ndGggLSAxXSA9PT0gJyknLFxuXHRcdFx0YFRoZSByZWZlcmVuY2UgbXVzdCBiZSBlbmNsb3NlZCBpbiBwYXJlbnRoZXNlcywgZ290IFwiJHtyZWZlcmVuY2V9XCIuYCxcblx0XHQpO1xuXG5cdFx0c3VwZXIoXG5cdFx0XHRuZXcgUmFuZ2UoXG5cdFx0XHRcdGxpbmVOdW1iZXIsXG5cdFx0XHRcdGNvbHVtbk51bWJlcixcblx0XHRcdFx0bGluZU51bWJlcixcblx0XHRcdFx0Y29sdW1uTnVtYmVyICsgY2FwdGlvbi5sZW5ndGggKyByZWZlcmVuY2UubGVuZ3RoLFxuXHRcdFx0KSxcblx0XHQpO1xuXG5cdFx0Ly8gc2V0IHVwIHRoZSBgaXNVUkxgIGZsYWcgYmFzZWQgb24gdGhlIGN1cnJlbnRcblx0XHR0cnkge1xuXHRcdFx0bmV3IFVSTCh0aGlzLnBhdGgpO1xuXHRcdFx0dGhpcy5pc1VSTCA9IHRydWU7XG5cdFx0fSBjYXRjaCB7XG5cdFx0XHR0aGlzLmlzVVJMID0gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGdldCB0ZXh0KCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGAke3RoaXMuY2FwdGlvbn0ke3RoaXMucmVmZXJlbmNlfWA7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgYHJlZmVyZW5jZWAgcGFydCBvZiB0aGUgbGluayB3aXRob3V0IGVuY2xvc2luZyBwYXJlbnRoZXNlcy5cblx0ICovXG5cdHB1YmxpYyBnZXQgcGF0aCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLnJlZmVyZW5jZS5zbGljZSgxLCB0aGlzLnJlZmVyZW5jZS5sZW5ndGggLSAxKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDaGVjayBpZiB0aGlzIHRva2VuIGlzIGVxdWFsIHRvIGFub3RoZXIgb25lLlxuXHQgKi9cblx0cHVibGljIG92ZXJyaWRlIGVxdWFsczxUIGV4dGVuZHMgQmFzZVRva2VuPihvdGhlcjogVCk6IGJvb2xlYW4ge1xuXHRcdGlmICghc3VwZXIuc2FtZVJhbmdlKG90aGVyLnJhbmdlKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGlmICghKG90aGVyIGluc3RhbmNlb2YgTWFya2Rvd25JbWFnZSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy50ZXh0ID09PSBvdGhlci50ZXh0O1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldCB0aGUgcmFuZ2Ugb2YgdGhlIGBsaW5rIHBhcnRgIG9mIHRoZSB0b2tlbi5cblx0ICovXG5cdHB1YmxpYyBnZXQgbGlua1JhbmdlKCk6IElSYW5nZSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMucGF0aC5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyByYW5nZSB9ID0gdGhpcztcblxuXHRcdC8vIG5vdGUhICcrMScgZm9yIG9wZW5uaW5nIGAoYCBvZiB0aGUgbGlua1xuXHRcdGNvbnN0IHN0YXJ0Q29sdW1uID0gcmFuZ2Uuc3RhcnRDb2x1bW4gKyB0aGlzLmNhcHRpb24ubGVuZ3RoICsgMTtcblx0XHRjb25zdCBlbmRDb2x1bW4gPSBzdGFydENvbHVtbiArIHRoaXMucGF0aC5sZW5ndGg7XG5cblx0XHRyZXR1cm4gbmV3IFJhbmdlKFxuXHRcdFx0cmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0c3RhcnRDb2x1bW4sXG5cdFx0XHRyYW5nZS5lbmRMaW5lTnVtYmVyLFxuXHRcdFx0ZW5kQ29sdW1uLFxuXHRcdCk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyBhIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiB0aGUgdG9rZW4uXG5cdCAqL1xuXHRwdWJsaWMgb3ZlcnJpZGUgdG9TdHJpbmcoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gYG1kLWltYWdlKFwiJHt0aGlzLnRleHR9XCIpJHt0aGlzLnJhbmdlfWA7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLFNBQVMscUJBQXFCO0FBQzlCLFNBQWlCLGFBQWE7QUFDOUIsU0FBUyxjQUFjO0FBTWhCLE1BQU0sc0JBQXNCLGNBQWM7QUFBQSxFQU1oRCxZQUlDLFlBSUEsY0FJaUIsU0FJQSxXQUNoQjtBQUNEO0FBQUEsTUFDQyxDQUFDLE1BQU0sVUFBVTtBQUFBLE1BQ2pCO0FBQUEsSUFDRDtBQUVBO0FBQUEsTUFDQyxhQUFhO0FBQUEsTUFDYixzQ0FBc0MsVUFBVTtBQUFBLElBQ2pEO0FBRUE7QUFBQSxNQUNDLGVBQWU7QUFBQSxNQUNmLHdDQUF3QyxZQUFZO0FBQUEsSUFDckQ7QUFFQTtBQUFBLE1BQ0MsUUFBUSxDQUFDLE1BQU07QUFBQSxNQUNmLG1EQUFtRCxPQUFPO0FBQUEsSUFDM0Q7QUFFQTtBQUFBLE1BQ0MsUUFBUSxDQUFDLE1BQU0sT0FBTyxRQUFRLFFBQVEsU0FBUyxDQUFDLE1BQU07QUFBQSxNQUN0RCx5REFBeUQsT0FBTztBQUFBLElBQ2pFO0FBRUE7QUFBQSxNQUNDLFVBQVUsQ0FBQyxNQUFNLE9BQU8sVUFBVSxVQUFVLFNBQVMsQ0FBQyxNQUFNO0FBQUEsTUFDNUQsdURBQXVELFNBQVM7QUFBQSxJQUNqRTtBQUVBO0FBQUEsTUFDQyxJQUFJO0FBQUEsUUFDSDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQSxlQUFlLFFBQVEsU0FBUyxVQUFVO0FBQUEsTUFDM0M7QUFBQSxJQUNEO0FBM0NpQjtBQUlBO0FBMENqQixRQUFJO0FBQ0gsVUFBSSxJQUFJLEtBQUssSUFBSTtBQUNqQixXQUFLLFFBQVE7QUFBQSxJQUNkLFFBQVE7QUFDUCxXQUFLLFFBQVE7QUFBQSxJQUNkO0FBQUEsRUFDRDtBQUFBLEVBRUEsSUFBb0IsT0FBZTtBQUNsQyxXQUFPLEdBQUcsS0FBSyxPQUFPLEdBQUcsS0FBSyxTQUFTO0FBQUEsRUFDeEM7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtBLElBQVcsT0FBZTtBQUN6QixXQUFPLEtBQUssVUFBVSxNQUFNLEdBQUcsS0FBSyxVQUFVLFNBQVMsQ0FBQztBQUFBLEVBQ3pEO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLZ0IsT0FBNEIsT0FBbUI7QUFDOUQsUUFBSSxDQUFDLE1BQU0sVUFBVSxNQUFNLEtBQUssR0FBRztBQUNsQyxhQUFPO0FBQUEsSUFDUjtBQUVBLFFBQUksRUFBRSxpQkFBaUIsZ0JBQWdCO0FBQ3RDLGFBQU87QUFBQSxJQUNSO0FBRUEsV0FBTyxLQUFLLFNBQVMsTUFBTTtBQUFBLEVBQzVCO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLQSxJQUFXLFlBQWdDO0FBQzFDLFFBQUksS0FBSyxLQUFLLFdBQVcsR0FBRztBQUMzQixhQUFPO0FBQUEsSUFDUjtBQUVBLFVBQU0sRUFBRSxNQUFNLElBQUk7QUFHbEIsVUFBTSxjQUFjLE1BQU0sY0FBYyxLQUFLLFFBQVEsU0FBUztBQUM5RCxVQUFNLFlBQVksY0FBYyxLQUFLLEtBQUs7QUFFMUMsV0FBTyxJQUFJO0FBQUEsTUFDVixNQUFNO0FBQUEsTUFDTjtBQUFBLE1BQ0EsTUFBTTtBQUFBLE1BQ047QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS2dCLFdBQW1CO0FBQ2xDLFdBQU8sYUFBYSxLQUFLLElBQUksS0FBSyxLQUFLLEtBQUs7QUFBQSxFQUM3QztBQUNEOyIsCiAgIm5hbWVzIjogW10KfQo=
