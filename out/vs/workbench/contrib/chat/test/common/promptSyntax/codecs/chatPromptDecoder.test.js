import { Range } from "../../../../../../../editor/common/core/range.js";
import { newWriteableStream } from "../../../../../../../base/common/stream.js";
import { TestDecoder } from "../../../../../../../editor/test/common/utils/testDecoder.js";
import { FileReference } from "../../../../common/promptSyntax/codecs/tokens/fileReference.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../../base/test/common/utils.js";
import { MarkdownLink } from "../../../../../../../editor/common/codecs/markdownCodec/tokens/markdownLink.js";
import { ChatPromptDecoder } from "../../../../common/promptSyntax/codecs/chatPromptDecoder.js";
class TestChatPromptDecoder extends TestDecoder {
  constructor() {
    const stream = newWriteableStream(null);
    const decoder = new ChatPromptDecoder(stream);
    super(stream, decoder);
  }
}
suite("ChatPromptDecoder", () => {
  const testDisposables = ensureNoDisposablesAreLeakedInTestSuite();
  test("\u2022 produces expected tokens", async () => {
    const test2 = testDisposables.add(
      new TestChatPromptDecoder()
    );
    const contents = [
      "",
      "haalo!",
      " message \u{1F47E} message #file:./path/to/file1.md",
      "",
      "## Heading Title",
      " 	#file:a/b/c/filename2.md	\u{1F596}	#file:other-file.md",
      " [#file:reference.md](./reference.md)some text #file:/some/file/with/absolute/path.md",
      "text text #file: another text"
    ];
    await test2.run(
      contents,
      [
        new FileReference(
          new Range(3, 21, 3, 21 + 24),
          "./path/to/file1.md"
        ),
        new FileReference(
          new Range(6, 3, 6, 3 + 24),
          "a/b/c/filename2.md"
        ),
        new FileReference(
          new Range(6, 31, 6, 31 + 19),
          "other-file.md"
        ),
        new MarkdownLink(
          7,
          2,
          "[#file:reference.md]",
          "(./reference.md)"
        ),
        new FileReference(
          new Range(7, 48, 7, 48 + 38),
          "/some/file/with/absolute/path.md"
        ),
        new FileReference(
          new Range(8, 11, 8, 11 + 6),
          ""
        )
      ]
    );
  });
});
export {
  TestChatPromptDecoder
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL3Byb21wdFN5bnRheC9jb2RlY3MvY2hhdFByb21wdERlY29kZXIudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IG5ld1dyaXRlYWJsZVN0cmVhbSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmVhbS5qcyc7XG5pbXBvcnQgeyBUZXN0RGVjb2RlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci90ZXN0L2NvbW1vbi91dGlscy90ZXN0RGVjb2Rlci5qcyc7XG5pbXBvcnQgeyBGaWxlUmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3Byb21wdFN5bnRheC9jb2RlY3MvdG9rZW5zL2ZpbGVSZWZlcmVuY2UuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBNYXJrZG93bkxpbmsgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvZGVjcy9tYXJrZG93bkNvZGVjL3Rva2Vucy9tYXJrZG93bkxpbmsuanMnO1xuaW1wb3J0IHsgQ2hhdFByb21wdERlY29kZXIsIFRDaGF0UHJvbXB0VG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vcHJvbXB0U3ludGF4L2NvZGVjcy9jaGF0UHJvbXB0RGVjb2Rlci5qcyc7XG5cbi8qKlxuICogQSByZXVzYWJsZSB0ZXN0IHV0aWxpdHkgdGhhdCBhc3NlcnRzIHRoYXQgYSBgQ2hhdFByb21wdERlY29kZXJgIGluc3RhbmNlXG4gKiBjb3JyZWN0bHkgZGVjb2RlcyBgaW5wdXREYXRhYCBpbnRvIGEgc3RyZWFtIG9mIGBUQ2hhdFByb21wdFRva2VuYCB0b2tlbnMuXG4gKlxuICogIyMgRXhhbXBsZXNcbiAqXG4gKiBgYGB0eXBlc2NyaXB0XG4gKiAvLyBjcmVhdGUgYSBuZXcgdGVzdCB1dGlsaXR5IGluc3RhbmNlXG4gKiBjb25zdCB0ZXN0ID0gdGVzdERpc3Bvc2FibGVzLmFkZChuZXcgVGVzdENoYXRQcm9tcHREZWNvZGVyKCkpO1xuICpcbiAqIC8vIHJ1biB0aGUgdGVzdFxuICogYXdhaXQgdGVzdC5ydW4oXG4gKiAgICcgaGVsbG8gI2ZpbGU6Li9zb21lLWZpbGUubWQgd29ybGRcXG4nLFxuICogICBbXG4gKiAgICAgbmV3IEZpbGVSZWZlcmVuY2UoXG4gKiAgICAgICBuZXcgUmFuZ2UoMSwgOCwgMSwgMjgpLFxuICogICAgICAgJy4vc29tZS1maWxlLm1kJyxcbiAqICAgICApLFxuICogICBdXG4gKiApO1xuICovXG5leHBvcnQgY2xhc3MgVGVzdENoYXRQcm9tcHREZWNvZGVyIGV4dGVuZHMgVGVzdERlY29kZXI8VENoYXRQcm9tcHRUb2tlbiwgQ2hhdFByb21wdERlY29kZXI+IHtcblx0Y29uc3RydWN0b3IoXG5cdCkge1xuXHRcdGNvbnN0IHN0cmVhbSA9IG5ld1dyaXRlYWJsZVN0cmVhbTxWU0J1ZmZlcj4obnVsbCk7XG5cdFx0Y29uc3QgZGVjb2RlciA9IG5ldyBDaGF0UHJvbXB0RGVjb2RlcihzdHJlYW0pO1xuXG5cdFx0c3VwZXIoc3RyZWFtLCBkZWNvZGVyKTtcblx0fVxufVxuXG5zdWl0ZSgnQ2hhdFByb21wdERlY29kZXInLCAoKSA9PiB7XG5cdGNvbnN0IHRlc3REaXNwb3NhYmxlcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ1x1MjAyMiBwcm9kdWNlcyBleHBlY3RlZCB0b2tlbnMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgdGVzdCA9IHRlc3REaXNwb3NhYmxlcy5hZGQoXG5cdFx0XHRuZXcgVGVzdENoYXRQcm9tcHREZWNvZGVyKCksXG5cdFx0KTtcblxuXHRcdGNvbnN0IGNvbnRlbnRzID0gW1xuXHRcdFx0JycsXG5cdFx0XHQnaGFhbG8hJyxcblx0XHRcdCcgbWVzc2FnZSBcdUQ4M0RcdURDN0UgbWVzc2FnZSAjZmlsZTouL3BhdGgvdG8vZmlsZTEubWQnLFxuXHRcdFx0JycsXG5cdFx0XHQnIyMgSGVhZGluZyBUaXRsZScsXG5cdFx0XHQnIFxcdCNmaWxlOmEvYi9jL2ZpbGVuYW1lMi5tZFxcdFx1RDgzRFx1REQ5NlxcdCNmaWxlOm90aGVyLWZpbGUubWQnLFxuXHRcdFx0JyBbI2ZpbGU6cmVmZXJlbmNlLm1kXSguL3JlZmVyZW5jZS5tZClzb21lIHRleHQgI2ZpbGU6L3NvbWUvZmlsZS93aXRoL2Fic29sdXRlL3BhdGgubWQnLFxuXHRcdFx0J3RleHQgdGV4dCAjZmlsZTogYW5vdGhlciB0ZXh0Jyxcblx0XHRdO1xuXG5cdFx0YXdhaXQgdGVzdC5ydW4oXG5cdFx0XHRjb250ZW50cyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IEZpbGVSZWZlcmVuY2UoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDMsIDIxLCAzLCAyMSArIDI0KSxcblx0XHRcdFx0XHQnLi9wYXRoL3RvL2ZpbGUxLm1kJyxcblx0XHRcdFx0KSxcblx0XHRcdFx0bmV3IEZpbGVSZWZlcmVuY2UoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDYsIDMsIDYsIDMgKyAyNCksXG5cdFx0XHRcdFx0J2EvYi9jL2ZpbGVuYW1lMi5tZCcsXG5cdFx0XHRcdCksXG5cdFx0XHRcdG5ldyBGaWxlUmVmZXJlbmNlKFxuXHRcdFx0XHRcdG5ldyBSYW5nZSg2LCAzMSwgNiwgMzEgKyAxOSksXG5cdFx0XHRcdFx0J290aGVyLWZpbGUubWQnLFxuXHRcdFx0XHQpLFxuXHRcdFx0XHRuZXcgTWFya2Rvd25MaW5rKFxuXHRcdFx0XHRcdDcsXG5cdFx0XHRcdFx0Mixcblx0XHRcdFx0XHQnWyNmaWxlOnJlZmVyZW5jZS5tZF0nLFxuXHRcdFx0XHRcdCcoLi9yZWZlcmVuY2UubWQpJyxcblx0XHRcdFx0KSxcblx0XHRcdFx0bmV3IEZpbGVSZWZlcmVuY2UoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDcsIDQ4LCA3LCA0OCArIDM4KSxcblx0XHRcdFx0XHQnL3NvbWUvZmlsZS93aXRoL2Fic29sdXRlL3BhdGgubWQnLFxuXHRcdFx0XHQpLFxuXHRcdFx0XHRuZXcgRmlsZVJlZmVyZW5jZShcblx0XHRcdFx0XHRuZXcgUmFuZ2UoOCwgMTEsIDgsIDExICsgNiksXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdCksXG5cdFx0XHRdLFxuXHRcdCk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFTLGFBQWE7QUFDdEIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyx5QkFBMkM7QUF1QjdDLE1BQU0sOEJBQThCLFlBQWlEO0FBQUEsRUFDM0YsY0FDRTtBQUNELFVBQU0sU0FBUyxtQkFBNkIsSUFBSTtBQUNoRCxVQUFNLFVBQVUsSUFBSSxrQkFBa0IsTUFBTTtBQUU1QyxVQUFNLFFBQVEsT0FBTztBQUFBLEVBQ3RCO0FBQ0Q7QUFFQSxNQUFNLHFCQUFxQixNQUFNO0FBQ2hDLFFBQU0sa0JBQWtCLHdDQUF3QztBQUVoRSxPQUFLLG1DQUE4QixZQUFZO0FBQzlDLFVBQU1BLFFBQU8sZ0JBQWdCO0FBQUEsTUFDNUIsSUFBSSxzQkFBc0I7QUFBQSxJQUMzQjtBQUVBLFVBQU0sV0FBVztBQUFBLE1BQ2hCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFFQSxVQUFNQSxNQUFLO0FBQUEsTUFDVjtBQUFBLE1BQ0E7QUFBQSxRQUNDLElBQUk7QUFBQSxVQUNILElBQUksTUFBTSxHQUFHLElBQUksR0FBRyxLQUFLLEVBQUU7QUFBQSxVQUMzQjtBQUFBLFFBQ0Q7QUFBQSxRQUNBLElBQUk7QUFBQSxVQUNILElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxJQUFJLEVBQUU7QUFBQSxVQUN6QjtBQUFBLFFBQ0Q7QUFBQSxRQUNBLElBQUk7QUFBQSxVQUNILElBQUksTUFBTSxHQUFHLElBQUksR0FBRyxLQUFLLEVBQUU7QUFBQSxVQUMzQjtBQUFBLFFBQ0Q7QUFBQSxRQUNBLElBQUk7QUFBQSxVQUNIO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsUUFDRDtBQUFBLFFBQ0EsSUFBSTtBQUFBLFVBQ0gsSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLEtBQUssRUFBRTtBQUFBLFVBQzNCO0FBQUEsUUFDRDtBQUFBLFFBQ0EsSUFBSTtBQUFBLFVBQ0gsSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLEtBQUssQ0FBQztBQUFBLFVBQzFCO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRCxDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFsidGVzdCJdCn0K
