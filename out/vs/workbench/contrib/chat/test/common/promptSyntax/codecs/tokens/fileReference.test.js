import assert from "assert";
import { randomInt } from "../../../../../../../../base/common/numbers.js";
import { Range } from "../../../../../../../../editor/common/core/range.js";
import { assertDefined } from "../../../../../../../../base/common/types.js";
import { BaseToken } from "../../../../../../../../editor/common/codecs/baseToken.js";
import { PromptToken } from "../../../../../common/promptSyntax/codecs/tokens/promptToken.js";
import { FileReference } from "../../../../../common/promptSyntax/codecs/tokens/fileReference.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../../../base/test/common/utils.js";
import { PromptVariable, PromptVariableWithData } from "../../../../../common/promptSyntax/codecs/tokens/promptVariable.js";
suite("FileReference", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("\u2022 linkRange", () => {
    const lineNumber = randomInt(100, 1);
    const columnStartNumber = randomInt(100, 1);
    const path = `/temp/test/file-${randomInt(Number.MAX_SAFE_INTEGER)}.txt`;
    const columnEndNumber = columnStartNumber + path.length;
    const range = new Range(
      lineNumber,
      columnStartNumber,
      lineNumber,
      columnEndNumber
    );
    const fileReference = new FileReference(range, path);
    const { linkRange } = fileReference;
    assertDefined(
      linkRange,
      "The link range must be defined."
    );
    const expectedLinkRange = new Range(
      lineNumber,
      columnStartNumber + "#file:".length,
      lineNumber,
      columnStartNumber + path.length
    );
    assert(
      expectedLinkRange.equalsRange(linkRange),
      `Expected link range to be ${expectedLinkRange}, got ${linkRange}.`
    );
  });
  test("\u2022 path", () => {
    const lineNumber = randomInt(100, 1);
    const columnStartNumber = randomInt(100, 1);
    const link = `/temp/test/file-${randomInt(Number.MAX_SAFE_INTEGER)}.txt`;
    const columnEndNumber = columnStartNumber + link.length;
    const range = new Range(
      lineNumber,
      columnStartNumber,
      lineNumber,
      columnEndNumber
    );
    const fileReference = new FileReference(range, link);
    assert.strictEqual(
      fileReference.path,
      link,
      "Must return the correct link path."
    );
  });
  test("\u2022 extends `PromptVariableWithData` and others", () => {
    const lineNumber = randomInt(100, 1);
    const columnStartNumber = randomInt(100, 1);
    const link = `/temp/test/file-${randomInt(Number.MAX_SAFE_INTEGER)}.txt`;
    const columnEndNumber = columnStartNumber + link.length;
    const range = new Range(
      lineNumber,
      columnStartNumber,
      lineNumber,
      columnEndNumber
    );
    const fileReference = new FileReference(range, link);
    assert(
      fileReference instanceof PromptVariableWithData,
      "Must extend `PromptVariableWithData`."
    );
    assert(
      fileReference instanceof PromptVariable,
      "Must extend `PromptVariable`."
    );
    assert(
      fileReference instanceof PromptToken,
      "Must extend `PromptToken`."
    );
    assert(
      fileReference instanceof BaseToken,
      "Must extend `BaseToken`."
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL3Byb21wdFN5bnRheC9jb2RlY3MvdG9rZW5zL2ZpbGVSZWZlcmVuY2UudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IHJhbmRvbUludCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL251bWJlcnMuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgYXNzZXJ0RGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IEJhc2VUb2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29kZWNzL2Jhc2VUb2tlbi5qcyc7XG5pbXBvcnQgeyBQcm9tcHRUb2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9wcm9tcHRTeW50YXgvY29kZWNzL3Rva2Vucy9wcm9tcHRUb2tlbi5qcyc7XG5pbXBvcnQgeyBGaWxlUmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vY29tbW9uL3Byb21wdFN5bnRheC9jb2RlY3MvdG9rZW5zL2ZpbGVSZWZlcmVuY2UuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBQcm9tcHRWYXJpYWJsZSwgUHJvbXB0VmFyaWFibGVXaXRoRGF0YSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9wcm9tcHRTeW50YXgvY29kZWNzL3Rva2Vucy9wcm9tcHRWYXJpYWJsZS5qcyc7XG5cbnN1aXRlKCdGaWxlUmVmZXJlbmNlJywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdcdTIwMjIgbGlua1JhbmdlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpbmVOdW1iZXIgPSByYW5kb21JbnQoMTAwLCAxKTtcblx0XHRjb25zdCBjb2x1bW5TdGFydE51bWJlciA9IHJhbmRvbUludCgxMDAsIDEpO1xuXHRcdGNvbnN0IHBhdGggPSBgL3RlbXAvdGVzdC9maWxlLSR7cmFuZG9tSW50KE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKX0udHh0YDtcblx0XHRjb25zdCBjb2x1bW5FbmROdW1iZXIgPSBjb2x1bW5TdGFydE51bWJlciArIHBhdGgubGVuZ3RoO1xuXG5cdFx0Y29uc3QgcmFuZ2UgPSBuZXcgUmFuZ2UoXG5cdFx0XHRsaW5lTnVtYmVyLFxuXHRcdFx0Y29sdW1uU3RhcnROdW1iZXIsXG5cdFx0XHRsaW5lTnVtYmVyLFxuXHRcdFx0Y29sdW1uRW5kTnVtYmVyLFxuXHRcdCk7XG5cdFx0Y29uc3QgZmlsZVJlZmVyZW5jZSA9IG5ldyBGaWxlUmVmZXJlbmNlKHJhbmdlLCBwYXRoKTtcblx0XHRjb25zdCB7IGxpbmtSYW5nZSB9ID0gZmlsZVJlZmVyZW5jZTtcblxuXHRcdGFzc2VydERlZmluZWQoXG5cdFx0XHRsaW5rUmFuZ2UsXG5cdFx0XHQnVGhlIGxpbmsgcmFuZ2UgbXVzdCBiZSBkZWZpbmVkLicsXG5cdFx0KTtcblxuXHRcdGNvbnN0IGV4cGVjdGVkTGlua1JhbmdlID0gbmV3IFJhbmdlKFxuXHRcdFx0bGluZU51bWJlcixcblx0XHRcdGNvbHVtblN0YXJ0TnVtYmVyICsgJyNmaWxlOicubGVuZ3RoLFxuXHRcdFx0bGluZU51bWJlcixcblx0XHRcdGNvbHVtblN0YXJ0TnVtYmVyICsgcGF0aC5sZW5ndGgsXG5cdFx0KTtcblx0XHRhc3NlcnQoXG5cdFx0XHRleHBlY3RlZExpbmtSYW5nZS5lcXVhbHNSYW5nZShsaW5rUmFuZ2UpLFxuXHRcdFx0YEV4cGVjdGVkIGxpbmsgcmFuZ2UgdG8gYmUgJHtleHBlY3RlZExpbmtSYW5nZX0sIGdvdCAke2xpbmtSYW5nZX0uYCxcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdcdTIwMjIgcGF0aCcsICgpID0+IHtcblx0XHRjb25zdCBsaW5lTnVtYmVyID0gcmFuZG9tSW50KDEwMCwgMSk7XG5cdFx0Y29uc3QgY29sdW1uU3RhcnROdW1iZXIgPSByYW5kb21JbnQoMTAwLCAxKTtcblx0XHRjb25zdCBsaW5rID0gYC90ZW1wL3Rlc3QvZmlsZS0ke3JhbmRvbUludChOdW1iZXIuTUFYX1NBRkVfSU5URUdFUil9LnR4dGA7XG5cdFx0Y29uc3QgY29sdW1uRW5kTnVtYmVyID0gY29sdW1uU3RhcnROdW1iZXIgKyBsaW5rLmxlbmd0aDtcblxuXHRcdGNvbnN0IHJhbmdlID0gbmV3IFJhbmdlKFxuXHRcdFx0bGluZU51bWJlcixcblx0XHRcdGNvbHVtblN0YXJ0TnVtYmVyLFxuXHRcdFx0bGluZU51bWJlcixcblx0XHRcdGNvbHVtbkVuZE51bWJlcixcblx0XHQpO1xuXHRcdGNvbnN0IGZpbGVSZWZlcmVuY2UgPSBuZXcgRmlsZVJlZmVyZW5jZShyYW5nZSwgbGluayk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRmaWxlUmVmZXJlbmNlLnBhdGgsXG5cdFx0XHRsaW5rLFxuXHRcdFx0J011c3QgcmV0dXJuIHRoZSBjb3JyZWN0IGxpbmsgcGF0aC4nLFxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiBleHRlbmRzIGBQcm9tcHRWYXJpYWJsZVdpdGhEYXRhYCBhbmQgb3RoZXJzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpbmVOdW1iZXIgPSByYW5kb21JbnQoMTAwLCAxKTtcblx0XHRjb25zdCBjb2x1bW5TdGFydE51bWJlciA9IHJhbmRvbUludCgxMDAsIDEpO1xuXHRcdGNvbnN0IGxpbmsgPSBgL3RlbXAvdGVzdC9maWxlLSR7cmFuZG9tSW50KE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKX0udHh0YDtcblx0XHRjb25zdCBjb2x1bW5FbmROdW1iZXIgPSBjb2x1bW5TdGFydE51bWJlciArIGxpbmsubGVuZ3RoO1xuXG5cdFx0Y29uc3QgcmFuZ2UgPSBuZXcgUmFuZ2UoXG5cdFx0XHRsaW5lTnVtYmVyLFxuXHRcdFx0Y29sdW1uU3RhcnROdW1iZXIsXG5cdFx0XHRsaW5lTnVtYmVyLFxuXHRcdFx0Y29sdW1uRW5kTnVtYmVyLFxuXHRcdCk7XG5cdFx0Y29uc3QgZmlsZVJlZmVyZW5jZSA9IG5ldyBGaWxlUmVmZXJlbmNlKHJhbmdlLCBsaW5rKTtcblxuXHRcdGFzc2VydChcblx0XHRcdGZpbGVSZWZlcmVuY2UgaW5zdGFuY2VvZiBQcm9tcHRWYXJpYWJsZVdpdGhEYXRhLFxuXHRcdFx0J011c3QgZXh0ZW5kIGBQcm9tcHRWYXJpYWJsZVdpdGhEYXRhYC4nLFxuXHRcdCk7XG5cblx0XHRhc3NlcnQoXG5cdFx0XHRmaWxlUmVmZXJlbmNlIGluc3RhbmNlb2YgUHJvbXB0VmFyaWFibGUsXG5cdFx0XHQnTXVzdCBleHRlbmQgYFByb21wdFZhcmlhYmxlYC4nLFxuXHRcdCk7XG5cblx0XHRhc3NlcnQoXG5cdFx0XHRmaWxlUmVmZXJlbmNlIGluc3RhbmNlb2YgUHJvbXB0VG9rZW4sXG5cdFx0XHQnTXVzdCBleHRlbmQgYFByb21wdFRva2VuYC4nLFxuXHRcdCk7XG5cblx0XHRhc3NlcnQoXG5cdFx0XHRmaWxlUmVmZXJlbmNlIGluc3RhbmNlb2YgQmFzZVRva2VuLFxuXHRcdFx0J011c3QgZXh0ZW5kIGBCYXNlVG9rZW5gLicsXG5cdFx0KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGFBQWE7QUFDdEIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxnQkFBZ0IsOEJBQThCO0FBRXZELE1BQU0saUJBQWlCLE1BQU07QUFDNUIsMENBQXdDO0FBRXhDLE9BQUssb0JBQWUsTUFBTTtBQUN6QixVQUFNLGFBQWEsVUFBVSxLQUFLLENBQUM7QUFDbkMsVUFBTSxvQkFBb0IsVUFBVSxLQUFLLENBQUM7QUFDMUMsVUFBTSxPQUFPLG1CQUFtQixVQUFVLE9BQU8sZ0JBQWdCLENBQUM7QUFDbEUsVUFBTSxrQkFBa0Isb0JBQW9CLEtBQUs7QUFFakQsVUFBTSxRQUFRLElBQUk7QUFBQSxNQUNqQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFDQSxVQUFNLGdCQUFnQixJQUFJLGNBQWMsT0FBTyxJQUFJO0FBQ25ELFVBQU0sRUFBRSxVQUFVLElBQUk7QUFFdEI7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFFQSxVQUFNLG9CQUFvQixJQUFJO0FBQUEsTUFDN0I7QUFBQSxNQUNBLG9CQUFvQixTQUFTO0FBQUEsTUFDN0I7QUFBQSxNQUNBLG9CQUFvQixLQUFLO0FBQUEsSUFDMUI7QUFDQTtBQUFBLE1BQ0Msa0JBQWtCLFlBQVksU0FBUztBQUFBLE1BQ3ZDLDZCQUE2QixpQkFBaUIsU0FBUyxTQUFTO0FBQUEsSUFDakU7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLGVBQVUsTUFBTTtBQUNwQixVQUFNLGFBQWEsVUFBVSxLQUFLLENBQUM7QUFDbkMsVUFBTSxvQkFBb0IsVUFBVSxLQUFLLENBQUM7QUFDMUMsVUFBTSxPQUFPLG1CQUFtQixVQUFVLE9BQU8sZ0JBQWdCLENBQUM7QUFDbEUsVUFBTSxrQkFBa0Isb0JBQW9CLEtBQUs7QUFFakQsVUFBTSxRQUFRLElBQUk7QUFBQSxNQUNqQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFDQSxVQUFNLGdCQUFnQixJQUFJLGNBQWMsT0FBTyxJQUFJO0FBRW5ELFdBQU87QUFBQSxNQUNOLGNBQWM7QUFBQSxNQUNkO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHNEQUFpRCxNQUFNO0FBQzNELFVBQU0sYUFBYSxVQUFVLEtBQUssQ0FBQztBQUNuQyxVQUFNLG9CQUFvQixVQUFVLEtBQUssQ0FBQztBQUMxQyxVQUFNLE9BQU8sbUJBQW1CLFVBQVUsT0FBTyxnQkFBZ0IsQ0FBQztBQUNsRSxVQUFNLGtCQUFrQixvQkFBb0IsS0FBSztBQUVqRCxVQUFNLFFBQVEsSUFBSTtBQUFBLE1BQ2pCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUNBLFVBQU0sZ0JBQWdCLElBQUksY0FBYyxPQUFPLElBQUk7QUFFbkQ7QUFBQSxNQUNDLHlCQUF5QjtBQUFBLE1BQ3pCO0FBQUEsSUFDRDtBQUVBO0FBQUEsTUFDQyx5QkFBeUI7QUFBQSxNQUN6QjtBQUFBLElBQ0Q7QUFFQTtBQUFBLE1BQ0MseUJBQXlCO0FBQUEsTUFDekI7QUFBQSxJQUNEO0FBRUE7QUFBQSxNQUNDLHlCQUF5QjtBQUFBLE1BQ3pCO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
