import assert from "assert";
import { randomInt } from "../../../../../../../../base/common/numbers.js";
import { Range } from "../../../../../../../../editor/common/core/range.js";
import { assertDefined } from "../../../../../../../../base/common/types.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../../../base/test/common/utils.js";
import { MarkdownLink } from "../../../../../../../../editor/common/codecs/markdownCodec/tokens/markdownLink.js";
import { BaseToken } from "../../../../../../../../editor/common/codecs/baseToken.js";
import { MarkdownToken } from "../../../../../../../../editor/common/codecs/markdownCodec/tokens/markdownToken.js";
suite("FileReference", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("`linkRange`", () => {
    const lineNumber = randomInt(100, 1);
    const columnStartNumber = randomInt(100, 1);
    const caption = `[link-caption-${randomInt(Number.MAX_SAFE_INTEGER)}]`;
    const link = `(/temp/test/file-${randomInt(Number.MAX_SAFE_INTEGER)}.md)`;
    const markdownLink = new MarkdownLink(
      lineNumber,
      columnStartNumber,
      caption,
      link
    );
    const { linkRange } = markdownLink;
    assertDefined(
      linkRange,
      "The link range must be defined."
    );
    const expectedLinkRange = new Range(
      lineNumber,
      // `+1` for the openning `(` character of the link
      columnStartNumber + caption.length + 1,
      lineNumber,
      // `+1` for the openning `(` character of the link, and
      // `-2` for the enclosing `()` part of the link
      columnStartNumber + caption.length + 1 + link.length - 2
    );
    assert(
      expectedLinkRange.equalsRange(linkRange),
      `Expected link range to be ${expectedLinkRange}, got ${linkRange}.`
    );
  });
  test("`path`", () => {
    const lineNumber = randomInt(100, 1);
    const columnStartNumber = randomInt(100, 1);
    const caption = `[link-caption-${randomInt(Number.MAX_SAFE_INTEGER)}]`;
    const rawLink = `/temp/test/file-${randomInt(Number.MAX_SAFE_INTEGER)}.md`;
    const link = `(${rawLink})`;
    const markdownLink = new MarkdownLink(
      lineNumber,
      columnStartNumber,
      caption,
      link
    );
    const { path } = markdownLink;
    assert.strictEqual(
      path,
      rawLink,
      "Must return the correct link value."
    );
  });
  test("extends `MarkdownToken`", () => {
    const lineNumber = randomInt(100, 1);
    const columnStartNumber = randomInt(100, 1);
    const caption = `[link-caption-${randomInt(Number.MAX_SAFE_INTEGER)}]`;
    const rawLink = `/temp/test/file-${randomInt(Number.MAX_SAFE_INTEGER)}.md`;
    const link = `(${rawLink})`;
    const markdownLink = new MarkdownLink(
      lineNumber,
      columnStartNumber,
      caption,
      link
    );
    assert(
      markdownLink instanceof MarkdownToken,
      "Must extend `MarkdownToken`."
    );
    assert(
      markdownLink instanceof BaseToken,
      "Must extend `BaseToken`."
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL3Byb21wdFN5bnRheC9jb2RlY3MvdG9rZW5zL21hcmtkb3duTGluay50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgcmFuZG9tSW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbnVtYmVycy5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBhc3NlcnREZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBNYXJrZG93bkxpbmsgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvZGVjcy9tYXJrZG93bkNvZGVjL3Rva2Vucy9tYXJrZG93bkxpbmsuanMnO1xuaW1wb3J0IHsgQmFzZVRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb2RlY3MvYmFzZVRva2VuLmpzJztcbmltcG9ydCB7IE1hcmtkb3duVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvZGVjcy9tYXJrZG93bkNvZGVjL3Rva2Vucy9tYXJrZG93blRva2VuLmpzJztcblxuc3VpdGUoJ0ZpbGVSZWZlcmVuY2UnLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2BsaW5rUmFuZ2VgJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpbmVOdW1iZXIgPSByYW5kb21JbnQoMTAwLCAxKTtcblx0XHRjb25zdCBjb2x1bW5TdGFydE51bWJlciA9IHJhbmRvbUludCgxMDAsIDEpO1xuXHRcdGNvbnN0IGNhcHRpb24gPSBgW2xpbmstY2FwdGlvbi0ke3JhbmRvbUludChOdW1iZXIuTUFYX1NBRkVfSU5URUdFUil9XWA7XG5cdFx0Y29uc3QgbGluayA9IGAoL3RlbXAvdGVzdC9maWxlLSR7cmFuZG9tSW50KE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKX0ubWQpYDtcblxuXHRcdGNvbnN0IG1hcmtkb3duTGluayA9IG5ldyBNYXJrZG93bkxpbmsoXG5cdFx0XHRsaW5lTnVtYmVyLFxuXHRcdFx0Y29sdW1uU3RhcnROdW1iZXIsXG5cdFx0XHRjYXB0aW9uLFxuXHRcdFx0bGluayxcblx0XHQpO1xuXHRcdGNvbnN0IHsgbGlua1JhbmdlIH0gPSBtYXJrZG93bkxpbms7XG5cblx0XHRhc3NlcnREZWZpbmVkKFxuXHRcdFx0bGlua1JhbmdlLFxuXHRcdFx0J1RoZSBsaW5rIHJhbmdlIG11c3QgYmUgZGVmaW5lZC4nLFxuXHRcdCk7XG5cblx0XHRjb25zdCBleHBlY3RlZExpbmtSYW5nZSA9IG5ldyBSYW5nZShcblx0XHRcdGxpbmVOdW1iZXIsXG5cdFx0XHQvLyBgKzFgIGZvciB0aGUgb3Blbm5pbmcgYChgIGNoYXJhY3RlciBvZiB0aGUgbGlua1xuXHRcdFx0Y29sdW1uU3RhcnROdW1iZXIgKyBjYXB0aW9uLmxlbmd0aCArIDEsXG5cdFx0XHRsaW5lTnVtYmVyLFxuXHRcdFx0Ly8gYCsxYCBmb3IgdGhlIG9wZW5uaW5nIGAoYCBjaGFyYWN0ZXIgb2YgdGhlIGxpbmssIGFuZFxuXHRcdFx0Ly8gYC0yYCBmb3IgdGhlIGVuY2xvc2luZyBgKClgIHBhcnQgb2YgdGhlIGxpbmtcblx0XHRcdGNvbHVtblN0YXJ0TnVtYmVyICsgY2FwdGlvbi5sZW5ndGggKyAxICsgbGluay5sZW5ndGggLSAyLFxuXHRcdCk7XG5cdFx0YXNzZXJ0KFxuXHRcdFx0ZXhwZWN0ZWRMaW5rUmFuZ2UuZXF1YWxzUmFuZ2UobGlua1JhbmdlKSxcblx0XHRcdGBFeHBlY3RlZCBsaW5rIHJhbmdlIHRvIGJlICR7ZXhwZWN0ZWRMaW5rUmFuZ2V9LCBnb3QgJHtsaW5rUmFuZ2V9LmAsXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnYHBhdGhgJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpbmVOdW1iZXIgPSByYW5kb21JbnQoMTAwLCAxKTtcblx0XHRjb25zdCBjb2x1bW5TdGFydE51bWJlciA9IHJhbmRvbUludCgxMDAsIDEpO1xuXHRcdGNvbnN0IGNhcHRpb24gPSBgW2xpbmstY2FwdGlvbi0ke3JhbmRvbUludChOdW1iZXIuTUFYX1NBRkVfSU5URUdFUil9XWA7XG5cdFx0Y29uc3QgcmF3TGluayA9IGAvdGVtcC90ZXN0L2ZpbGUtJHtyYW5kb21JbnQoTnVtYmVyLk1BWF9TQUZFX0lOVEVHRVIpfS5tZGA7XG5cdFx0Y29uc3QgbGluayA9IGAoJHtyYXdMaW5rfSlgO1xuXG5cdFx0Y29uc3QgbWFya2Rvd25MaW5rID0gbmV3IE1hcmtkb3duTGluayhcblx0XHRcdGxpbmVOdW1iZXIsXG5cdFx0XHRjb2x1bW5TdGFydE51bWJlcixcblx0XHRcdGNhcHRpb24sXG5cdFx0XHRsaW5rLFxuXHRcdCk7XG5cdFx0Y29uc3QgeyBwYXRoIH0gPSBtYXJrZG93bkxpbms7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRwYXRoLFxuXHRcdFx0cmF3TGluayxcblx0XHRcdCdNdXN0IHJldHVybiB0aGUgY29ycmVjdCBsaW5rIHZhbHVlLicsXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZXh0ZW5kcyBgTWFya2Rvd25Ub2tlbmAnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGluZU51bWJlciA9IHJhbmRvbUludCgxMDAsIDEpO1xuXHRcdGNvbnN0IGNvbHVtblN0YXJ0TnVtYmVyID0gcmFuZG9tSW50KDEwMCwgMSk7XG5cdFx0Y29uc3QgY2FwdGlvbiA9IGBbbGluay1jYXB0aW9uLSR7cmFuZG9tSW50KE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKX1dYDtcblx0XHRjb25zdCByYXdMaW5rID0gYC90ZW1wL3Rlc3QvZmlsZS0ke3JhbmRvbUludChOdW1iZXIuTUFYX1NBRkVfSU5URUdFUil9Lm1kYDtcblx0XHRjb25zdCBsaW5rID0gYCgke3Jhd0xpbmt9KWA7XG5cblx0XHRjb25zdCBtYXJrZG93bkxpbmsgPSBuZXcgTWFya2Rvd25MaW5rKFxuXHRcdFx0bGluZU51bWJlcixcblx0XHRcdGNvbHVtblN0YXJ0TnVtYmVyLFxuXHRcdFx0Y2FwdGlvbixcblx0XHRcdGxpbmssXG5cdFx0KTtcblxuXHRcdGFzc2VydChcblx0XHRcdG1hcmtkb3duTGluayBpbnN0YW5jZW9mIE1hcmtkb3duVG9rZW4sXG5cdFx0XHQnTXVzdCBleHRlbmQgYE1hcmtkb3duVG9rZW5gLicsXG5cdFx0KTtcblxuXHRcdGFzc2VydChcblx0XHRcdG1hcmtkb3duTGluayBpbnN0YW5jZW9mIEJhc2VUb2tlbixcblx0XHRcdCdNdXN0IGV4dGVuZCBgQmFzZVRva2VuYC4nLFxuXHRcdCk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMscUJBQXFCO0FBRTlCLE1BQU0saUJBQWlCLE1BQU07QUFDNUIsMENBQXdDO0FBRXhDLE9BQUssZUFBZSxNQUFNO0FBQ3pCLFVBQU0sYUFBYSxVQUFVLEtBQUssQ0FBQztBQUNuQyxVQUFNLG9CQUFvQixVQUFVLEtBQUssQ0FBQztBQUMxQyxVQUFNLFVBQVUsaUJBQWlCLFVBQVUsT0FBTyxnQkFBZ0IsQ0FBQztBQUNuRSxVQUFNLE9BQU8sb0JBQW9CLFVBQVUsT0FBTyxnQkFBZ0IsQ0FBQztBQUVuRSxVQUFNLGVBQWUsSUFBSTtBQUFBLE1BQ3hCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUNBLFVBQU0sRUFBRSxVQUFVLElBQUk7QUFFdEI7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFFQSxVQUFNLG9CQUFvQixJQUFJO0FBQUEsTUFDN0I7QUFBQTtBQUFBLE1BRUEsb0JBQW9CLFFBQVEsU0FBUztBQUFBLE1BQ3JDO0FBQUE7QUFBQTtBQUFBLE1BR0Esb0JBQW9CLFFBQVEsU0FBUyxJQUFJLEtBQUssU0FBUztBQUFBLElBQ3hEO0FBQ0E7QUFBQSxNQUNDLGtCQUFrQixZQUFZLFNBQVM7QUFBQSxNQUN2Qyw2QkFBNkIsaUJBQWlCLFNBQVMsU0FBUztBQUFBLElBQ2pFO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxVQUFVLE1BQU07QUFDcEIsVUFBTSxhQUFhLFVBQVUsS0FBSyxDQUFDO0FBQ25DLFVBQU0sb0JBQW9CLFVBQVUsS0FBSyxDQUFDO0FBQzFDLFVBQU0sVUFBVSxpQkFBaUIsVUFBVSxPQUFPLGdCQUFnQixDQUFDO0FBQ25FLFVBQU0sVUFBVSxtQkFBbUIsVUFBVSxPQUFPLGdCQUFnQixDQUFDO0FBQ3JFLFVBQU0sT0FBTyxJQUFJLE9BQU87QUFFeEIsVUFBTSxlQUFlLElBQUk7QUFBQSxNQUN4QjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFDQSxVQUFNLEVBQUUsS0FBSyxJQUFJO0FBRWpCLFdBQU87QUFBQSxNQUNOO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSywyQkFBMkIsTUFBTTtBQUNyQyxVQUFNLGFBQWEsVUFBVSxLQUFLLENBQUM7QUFDbkMsVUFBTSxvQkFBb0IsVUFBVSxLQUFLLENBQUM7QUFDMUMsVUFBTSxVQUFVLGlCQUFpQixVQUFVLE9BQU8sZ0JBQWdCLENBQUM7QUFDbkUsVUFBTSxVQUFVLG1CQUFtQixVQUFVLE9BQU8sZ0JBQWdCLENBQUM7QUFDckUsVUFBTSxPQUFPLElBQUksT0FBTztBQUV4QixVQUFNLGVBQWUsSUFBSTtBQUFBLE1BQ3hCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUVBO0FBQUEsTUFDQyx3QkFBd0I7QUFBQSxNQUN4QjtBQUFBLElBQ0Q7QUFFQTtBQUFBLE1BQ0Msd0JBQXdCO0FBQUEsTUFDeEI7QUFBQSxJQUNEO0FBQUEsRUFDRCxDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
