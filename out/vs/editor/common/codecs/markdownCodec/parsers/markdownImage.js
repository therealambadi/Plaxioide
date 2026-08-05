var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
import { MarkdownLink } from "../tokens/markdownLink.js";
import { MarkdownImage } from "../tokens/markdownImage.js";
import { LeftBracket } from "../../simpleCodec/tokens/brackets.js";
import { assertNotConsumed, ParserBase } from "../../simpleCodec/parserBase.js";
import { PartialMarkdownLinkCaption } from "./markdownLink.js";
class PartialMarkdownImage extends ParserBase {
  constructor(token) {
    super([token]);
  }
  /**
   * Get all currently available tokens of the `markdown link` sequence.
   */
  get tokens() {
    const linkTokens = this.markdownLinkParser?.tokens ?? [];
    return [
      ...this.currentTokens,
      ...linkTokens
    ];
  }
  accept(token) {
    if (!this.markdownLinkParser) {
      if (token instanceof LeftBracket) {
        this.markdownLinkParser = new PartialMarkdownLinkCaption(token);
        return {
          result: "success",
          nextParser: this,
          wasTokenConsumed: true
        };
      }
      return {
        result: "failure",
        wasTokenConsumed: false
      };
    }
    const acceptResult = this.markdownLinkParser.accept(token);
    const { result, wasTokenConsumed } = acceptResult;
    if (result === "success") {
      const { nextParser } = acceptResult;
      if (nextParser instanceof MarkdownLink) {
        this.isConsumed = true;
        const firstToken = this.currentTokens[0];
        return {
          result,
          wasTokenConsumed,
          nextParser: new MarkdownImage(
            firstToken.range.startLineNumber,
            firstToken.range.startColumn,
            `${firstToken.text}${nextParser.caption}`,
            nextParser.reference
          )
        };
      }
      this.markdownLinkParser = nextParser;
      return {
        result,
        wasTokenConsumed,
        nextParser: this
      };
    }
    this.isConsumed = true;
    return acceptResult;
  }
}
__decorateClass([
  assertNotConsumed
], PartialMarkdownImage.prototype, "accept", 1);
export {
  PartialMarkdownImage
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL2NvZGVjcy9tYXJrZG93bkNvZGVjL3BhcnNlcnMvbWFya2Rvd25JbWFnZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IE1hcmtkb3duTGluayB9IGZyb20gJy4uL3Rva2Vucy9tYXJrZG93bkxpbmsuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25JbWFnZSB9IGZyb20gJy4uL3Rva2Vucy9tYXJrZG93bkltYWdlLmpzJztcbmltcG9ydCB7IFRTaW1wbGVUb2tlbiB9IGZyb20gJy4uLy4uL3NpbXBsZUNvZGVjL3NpbXBsZURlY29kZXIuanMnO1xuaW1wb3J0IHsgTGVmdEJyYWNrZXQgfSBmcm9tICcuLi8uLi9zaW1wbGVDb2RlYy90b2tlbnMvYnJhY2tldHMuanMnO1xuaW1wb3J0IHsgRXhjbGFtYXRpb25NYXJrIH0gZnJvbSAnLi4vLi4vc2ltcGxlQ29kZWMvdG9rZW5zL2V4Y2xhbWF0aW9uTWFyay5qcyc7XG5pbXBvcnQgeyBhc3NlcnROb3RDb25zdW1lZCwgUGFyc2VyQmFzZSwgVEFjY2VwdFRva2VuUmVzdWx0IH0gZnJvbSAnLi4vLi4vc2ltcGxlQ29kZWMvcGFyc2VyQmFzZS5qcyc7XG5pbXBvcnQgeyBNYXJrZG93bkxpbmtDYXB0aW9uLCBQYXJ0aWFsTWFya2Rvd25MaW5rLCBQYXJ0aWFsTWFya2Rvd25MaW5rQ2FwdGlvbiB9IGZyb20gJy4vbWFya2Rvd25MaW5rLmpzJztcblxuLyoqXG4gKiBUaGUgcGFyc2VyIHJlc3BvbnNpYmxlIGZvciBwYXJzaW5nIHRoZSBgbWFya2Rvd24gaW1hZ2VgIHNlcXVlbmNlIG9mIGNoYXJhY3RlcnMuXG4gKiBFLmcuLCBgIVthbHQgdGV4dF0oLi9wYXRoL3RvL2ltYWdlLmpwZWcpYCBzeW50YXguXG4gKi9cbmV4cG9ydCBjbGFzcyBQYXJ0aWFsTWFya2Rvd25JbWFnZSBleHRlbmRzIFBhcnNlckJhc2U8VFNpbXBsZVRva2VuLCBQYXJ0aWFsTWFya2Rvd25JbWFnZSB8IE1hcmtkb3duSW1hZ2U+IHtcblx0LyoqXG5cdCAqIEN1cnJlbnQgYWN0aXZlIHBhcnNlciBpbnN0YW5jZSwgaWYgaW4gdGhlIG1vZGUgb2YgYWN0aXZlbHkgcGFyc2luZyB0aGUgbWFya2Rvd24gbGluayBzZXF1ZW5jZS5cblx0ICovXG5cdHByaXZhdGUgbWFya2Rvd25MaW5rUGFyc2VyOiBQYXJ0aWFsTWFya2Rvd25MaW5rQ2FwdGlvbiB8IE1hcmtkb3duTGlua0NhcHRpb24gfCBQYXJ0aWFsTWFya2Rvd25MaW5rIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKHRva2VuOiBFeGNsYW1hdGlvbk1hcmspIHtcblx0XHRzdXBlcihbdG9rZW5dKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXQgYWxsIGN1cnJlbnRseSBhdmFpbGFibGUgdG9rZW5zIG9mIHRoZSBgbWFya2Rvd24gbGlua2Agc2VxdWVuY2UuXG5cdCAqL1xuXHRwdWJsaWMgb3ZlcnJpZGUgZ2V0IHRva2VucygpOiByZWFkb25seSBUU2ltcGxlVG9rZW5bXSB7XG5cdFx0Y29uc3QgbGlua1Rva2VucyA9IHRoaXMubWFya2Rvd25MaW5rUGFyc2VyPy50b2tlbnMgPz8gW107XG5cblx0XHRyZXR1cm4gW1xuXHRcdFx0Li4udGhpcy5jdXJyZW50VG9rZW5zLFxuXHRcdFx0Li4ubGlua1Rva2Vucyxcblx0XHRdO1xuXHR9XG5cblx0QGFzc2VydE5vdENvbnN1bWVkXG5cdHB1YmxpYyBhY2NlcHQodG9rZW46IFRTaW1wbGVUb2tlbik6IFRBY2NlcHRUb2tlblJlc3VsdDxQYXJ0aWFsTWFya2Rvd25JbWFnZSB8IE1hcmtkb3duSW1hZ2U+IHtcblx0XHQvLyBvbiB0aGUgZmlyc3QgY2FsbCB3ZSBleHBlY3QgYSBjaGFyYWN0ZXIgdGhhdCBiZWdpbnMgYG1hcmtkb3duIGxpbmtgIHNlcXVlbmNlXG5cdFx0Ly8gaGVuY2Ugd2UgaW5pdGlhdGUgdGhlIG1hcmtkb3duIGxpbmsgcGFyc2luZyBwcm9jZXNzLCBvdGhlcndpc2Ugd2UgZmFpbFxuXHRcdGlmICghdGhpcy5tYXJrZG93bkxpbmtQYXJzZXIpIHtcblx0XHRcdGlmICh0b2tlbiBpbnN0YW5jZW9mIExlZnRCcmFja2V0KSB7XG5cdFx0XHRcdHRoaXMubWFya2Rvd25MaW5rUGFyc2VyID0gbmV3IFBhcnRpYWxNYXJrZG93bkxpbmtDYXB0aW9uKHRva2VuKTtcblxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHJlc3VsdDogJ3N1Y2Nlc3MnLFxuXHRcdFx0XHRcdG5leHRQYXJzZXI6IHRoaXMsXG5cdFx0XHRcdFx0d2FzVG9rZW5Db25zdW1lZDogdHJ1ZSxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0cmVzdWx0OiAnZmFpbHVyZScsXG5cdFx0XHRcdHdhc1Rva2VuQ29uc3VtZWQ6IGZhbHNlLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHQvLyBoYW5kbGUgc3Vic2VxdWVudCB0b2tlbnMgbmV4dFxuXG5cdFx0Y29uc3QgYWNjZXB0UmVzdWx0ID0gdGhpcy5tYXJrZG93bkxpbmtQYXJzZXIuYWNjZXB0KHRva2VuKTtcblx0XHRjb25zdCB7IHJlc3VsdCwgd2FzVG9rZW5Db25zdW1lZCB9ID0gYWNjZXB0UmVzdWx0O1xuXG5cdFx0aWYgKHJlc3VsdCA9PT0gJ3N1Y2Nlc3MnKSB7XG5cdFx0XHRjb25zdCB7IG5leHRQYXJzZXIgfSA9IGFjY2VwdFJlc3VsdDtcblxuXHRcdFx0Ly8gaWYgZnVsbCBtYXJrZG93biBsaW5rIHdhcyBwYXJzZWQgb3V0LCB0aGUgcHJvY2VzcyBjb21wbGV0ZXNcblx0XHRcdGlmIChuZXh0UGFyc2VyIGluc3RhbmNlb2YgTWFya2Rvd25MaW5rKSB7XG5cdFx0XHRcdHRoaXMuaXNDb25zdW1lZCA9IHRydWU7XG5cblx0XHRcdFx0Y29uc3QgZmlyc3RUb2tlbiA9IHRoaXMuY3VycmVudFRva2Vuc1swXTtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRyZXN1bHQsXG5cdFx0XHRcdFx0d2FzVG9rZW5Db25zdW1lZCxcblx0XHRcdFx0XHRuZXh0UGFyc2VyOiBuZXcgTWFya2Rvd25JbWFnZShcblx0XHRcdFx0XHRcdGZpcnN0VG9rZW4ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdFx0Zmlyc3RUb2tlbi5yYW5nZS5zdGFydENvbHVtbixcblx0XHRcdFx0XHRcdGAke2ZpcnN0VG9rZW4udGV4dH0ke25leHRQYXJzZXIuY2FwdGlvbn1gLFxuXHRcdFx0XHRcdFx0bmV4dFBhcnNlci5yZWZlcmVuY2UsXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gb3RoZXJ3aXNlIHNhdmUgbmV3IGxpbmsgcGFyc2VyIHJlZmVyZW5jZSBhbmQgY29udGludWVcblx0XHRcdHRoaXMubWFya2Rvd25MaW5rUGFyc2VyID0gbmV4dFBhcnNlcjtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHJlc3VsdCxcblx0XHRcdFx0d2FzVG9rZW5Db25zdW1lZCxcblx0XHRcdFx0bmV4dFBhcnNlcjogdGhpcyxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0Ly8gcmV0dXJuIHRoZSBmYWlsdXJlIHJlc3VsdFxuXHRcdHRoaXMuaXNDb25zdW1lZCA9IHRydWU7XG5cdFx0cmV0dXJuIGFjY2VwdFJlc3VsdDtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7OztBQUtBLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMscUJBQXFCO0FBRTlCLFNBQVMsbUJBQW1CO0FBRTVCLFNBQVMsbUJBQW1CLGtCQUFzQztBQUNsRSxTQUFtRCxrQ0FBa0M7QUFNOUUsTUFBTSw2QkFBNkIsV0FBK0Q7QUFBQSxFQU14RyxZQUFZLE9BQXdCO0FBQ25DLFVBQU0sQ0FBQyxLQUFLLENBQUM7QUFBQSxFQUNkO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLQSxJQUFvQixTQUFrQztBQUNyRCxVQUFNLGFBQWEsS0FBSyxvQkFBb0IsVUFBVSxDQUFDO0FBRXZELFdBQU87QUFBQSxNQUNOLEdBQUcsS0FBSztBQUFBLE1BQ1IsR0FBRztBQUFBLElBQ0o7QUFBQSxFQUNEO0FBQUEsRUFHTyxPQUFPLE9BQStFO0FBRzVGLFFBQUksQ0FBQyxLQUFLLG9CQUFvQjtBQUM3QixVQUFJLGlCQUFpQixhQUFhO0FBQ2pDLGFBQUsscUJBQXFCLElBQUksMkJBQTJCLEtBQUs7QUFFOUQsZUFBTztBQUFBLFVBQ04sUUFBUTtBQUFBLFVBQ1IsWUFBWTtBQUFBLFVBQ1osa0JBQWtCO0FBQUEsUUFDbkI7QUFBQSxNQUNEO0FBRUEsYUFBTztBQUFBLFFBQ04sUUFBUTtBQUFBLFFBQ1Isa0JBQWtCO0FBQUEsTUFDbkI7QUFBQSxJQUNEO0FBSUEsVUFBTSxlQUFlLEtBQUssbUJBQW1CLE9BQU8sS0FBSztBQUN6RCxVQUFNLEVBQUUsUUFBUSxpQkFBaUIsSUFBSTtBQUVyQyxRQUFJLFdBQVcsV0FBVztBQUN6QixZQUFNLEVBQUUsV0FBVyxJQUFJO0FBR3ZCLFVBQUksc0JBQXNCLGNBQWM7QUFDdkMsYUFBSyxhQUFhO0FBRWxCLGNBQU0sYUFBYSxLQUFLLGNBQWMsQ0FBQztBQUN2QyxlQUFPO0FBQUEsVUFDTjtBQUFBLFVBQ0E7QUFBQSxVQUNBLFlBQVksSUFBSTtBQUFBLFlBQ2YsV0FBVyxNQUFNO0FBQUEsWUFDakIsV0FBVyxNQUFNO0FBQUEsWUFDakIsR0FBRyxXQUFXLElBQUksR0FBRyxXQUFXLE9BQU87QUFBQSxZQUN2QyxXQUFXO0FBQUEsVUFDWjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBR0EsV0FBSyxxQkFBcUI7QUFDMUIsYUFBTztBQUFBLFFBQ047QUFBQSxRQUNBO0FBQUEsUUFDQSxZQUFZO0FBQUEsTUFDYjtBQUFBLElBQ0Q7QUFHQSxTQUFLLGFBQWE7QUFDbEIsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQTFEUTtBQUFBLEVBRE47QUFBQSxHQXRCVyxxQkF1Qkw7IiwKICAibmFtZXMiOiBbXQp9Cg==
