import { Range } from "../../../../../../../editor/common/core/range.js";
import { newWriteableStream } from "../../../../../../../base/common/stream.js";
import { TestDecoder } from "../../../../../../../editor/test/common/utils/testDecoder.js";
import { ChatPromptCodec } from "../../../../common/promptSyntax/codecs/chatPromptCodec.js";
import { FileReference } from "../../../../common/promptSyntax/codecs/tokens/fileReference.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../../base/test/common/utils.js";
class TestChatPromptCodec extends TestDecoder {
  constructor() {
    const stream = newWriteableStream(null);
    const decoder = ChatPromptCodec.decode(stream);
    super(stream, decoder);
  }
}
suite("ChatPromptCodec", () => {
  const testDisposables = ensureNoDisposablesAreLeakedInTestSuite();
  test("\u2022 produces expected tokens", async () => {
    const test2 = testDisposables.add(new TestChatPromptCodec());
    await test2.run(
      "#file:/etc/hosts some text	\n  for #file:./README.md	 testing\n \u2714 purposes\n#file:LICENSE.md \u270C 	#file:.gitignore\n\n\n	   #file:/Users/legomushroom/repos/vscode   \n\nsomething #file:	somewhere\n",
      [
        new FileReference(
          new Range(1, 1, 1, 1 + 16),
          "/etc/hosts"
        ),
        new FileReference(
          new Range(2, 7, 2, 7 + 17),
          "./README.md"
        ),
        new FileReference(
          new Range(4, 1, 4, 1 + 16),
          "LICENSE.md"
        ),
        new FileReference(
          new Range(4, 21, 4, 21 + 16),
          ".gitignore"
        ),
        new FileReference(
          new Range(7, 5, 7, 5 + 38),
          "/Users/legomushroom/repos/vscode"
        ),
        new FileReference(
          new Range(9, 11, 9, 11 + 6),
          ""
        )
      ]
    );
  });
});
export {
  TestChatPromptCodec
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL3Byb21wdFN5bnRheC9jb2RlY3MvY2hhdFByb21wdENvZGVjLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBuZXdXcml0ZWFibGVTdHJlYW0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJlYW0uanMnO1xuaW1wb3J0IHsgVGVzdERlY29kZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvdGVzdC9jb21tb24vdXRpbHMvdGVzdERlY29kZXIuanMnO1xuaW1wb3J0IHsgQ2hhdFByb21wdENvZGVjIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3Byb21wdFN5bnRheC9jb2RlY3MvY2hhdFByb21wdENvZGVjLmpzJztcbmltcG9ydCB7IEZpbGVSZWZlcmVuY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vcHJvbXB0U3ludGF4L2NvZGVjcy90b2tlbnMvZmlsZVJlZmVyZW5jZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IENoYXRQcm9tcHREZWNvZGVyLCBUQ2hhdFByb21wdFRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3Byb21wdFN5bnRheC9jb2RlY3MvY2hhdFByb21wdERlY29kZXIuanMnO1xuXG4vKipcbiAqIEEgcmV1c2FibGUgdGVzdCB1dGlsaXR5IHRoYXQgYXNzZXJ0cyB0aGF0IGEgYENoYXRQcm9tcHREZWNvZGVyYCBpbnN0YW5jZVxuICogY29ycmVjdGx5IGRlY29kZXMgYGlucHV0RGF0YWAgaW50byBhIHN0cmVhbSBvZiBgVENoYXRQcm9tcHRUb2tlbmAgdG9rZW5zLlxuICpcbiAqICMjIEV4YW1wbGVzXG4gKlxuICogYGBgdHlwZXNjcmlwdFxuICogLy8gY3JlYXRlIGEgbmV3IHRlc3QgdXRpbGl0eSBpbnN0YW5jZVxuICogY29uc3QgdGVzdCA9IHRlc3REaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RDaGF0UHJvbXB0Q29kZWMoKSk7XG4gKlxuICogLy8gcnVuIHRoZSB0ZXN0XG4gKiBhd2FpdCB0ZXN0LnJ1bihcbiAqICAgJyBoZWxsbyAjZmlsZTouL3NvbWUtZmlsZS5tZCB3b3JsZFxcbicsXG4gKiAgIFtcbiAqICAgICBuZXcgRmlsZVJlZmVyZW5jZShcbiAqICAgICAgIG5ldyBSYW5nZSgxLCA4LCAxLCAyOCksXG4gKiAgICAgICAnLi9zb21lLWZpbGUubWQnLFxuICogICAgICksXG4gKiAgIF1cbiAqICk7XG4gKi9cbmV4cG9ydCBjbGFzcyBUZXN0Q2hhdFByb21wdENvZGVjIGV4dGVuZHMgVGVzdERlY29kZXI8VENoYXRQcm9tcHRUb2tlbiwgQ2hhdFByb21wdERlY29kZXI+IHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0Y29uc3Qgc3RyZWFtID0gbmV3V3JpdGVhYmxlU3RyZWFtPFZTQnVmZmVyPihudWxsKTtcblx0XHRjb25zdCBkZWNvZGVyID0gQ2hhdFByb21wdENvZGVjLmRlY29kZShzdHJlYW0pO1xuXG5cdFx0c3VwZXIoc3RyZWFtLCBkZWNvZGVyKTtcblx0fVxufVxuXG5zdWl0ZSgnQ2hhdFByb21wdENvZGVjJywgKCkgPT4ge1xuXHRjb25zdCB0ZXN0RGlzcG9zYWJsZXMgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdcdTIwMjIgcHJvZHVjZXMgZXhwZWN0ZWQgdG9rZW5zJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHRlc3QgPSB0ZXN0RGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0Q2hhdFByb21wdENvZGVjKCkpO1xuXG5cdFx0YXdhaXQgdGVzdC5ydW4oXG5cdFx0XHQnI2ZpbGU6L2V0Yy9ob3N0cyBzb21lIHRleHRcXHRcXG4gIGZvciAjZmlsZTouL1JFQURNRS5tZFxcdCB0ZXN0aW5nXFxuIFx1MjcxNCBwdXJwb3Nlc1xcbiNmaWxlOkxJQ0VOU0UubWQgXHUyNzBDIFxcdCNmaWxlOi5naXRpZ25vcmVcXG5cXG5cXG5cXHQgICAjZmlsZTovVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZSAgIFxcblxcbnNvbWV0aGluZyAjZmlsZTpcXHRzb21ld2hlcmVcXG4nLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgRmlsZVJlZmVyZW5jZShcblx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgMSArIDE2KSxcblx0XHRcdFx0XHQnL2V0Yy9ob3N0cycsXG5cdFx0XHRcdCksXG5cdFx0XHRcdG5ldyBGaWxlUmVmZXJlbmNlKFxuXHRcdFx0XHRcdG5ldyBSYW5nZSgyLCA3LCAyLCA3ICsgMTcpLFxuXHRcdFx0XHRcdCcuL1JFQURNRS5tZCcsXG5cdFx0XHRcdCksXG5cdFx0XHRcdG5ldyBGaWxlUmVmZXJlbmNlKFxuXHRcdFx0XHRcdG5ldyBSYW5nZSg0LCAxLCA0LCAxICsgMTYpLFxuXHRcdFx0XHRcdCdMSUNFTlNFLm1kJyxcblx0XHRcdFx0KSxcblx0XHRcdFx0bmV3IEZpbGVSZWZlcmVuY2UoXG5cdFx0XHRcdFx0bmV3IFJhbmdlKDQsIDIxLCA0LCAyMSArIDE2KSxcblx0XHRcdFx0XHQnLmdpdGlnbm9yZScsXG5cdFx0XHRcdCksXG5cdFx0XHRcdG5ldyBGaWxlUmVmZXJlbmNlKFxuXHRcdFx0XHRcdG5ldyBSYW5nZSg3LCA1LCA3LCA1ICsgMzgpLFxuXHRcdFx0XHRcdCcvVXNlcnMvbGVnb211c2hyb29tL3JlcG9zL3ZzY29kZScsXG5cdFx0XHRcdCksXG5cdFx0XHRcdG5ldyBGaWxlUmVmZXJlbmNlKFxuXHRcdFx0XHRcdG5ldyBSYW5nZSg5LCAxMSwgOSwgMTEgKyA2KSxcblx0XHRcdFx0XHQnJyxcblx0XHRcdFx0KSxcblx0XHRcdF0sXG5cdFx0KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLFNBQVMsYUFBYTtBQUN0QixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLCtDQUErQztBQXdCakQsTUFBTSw0QkFBNEIsWUFBaUQ7QUFBQSxFQUN6RixjQUFjO0FBQ2IsVUFBTSxTQUFTLG1CQUE2QixJQUFJO0FBQ2hELFVBQU0sVUFBVSxnQkFBZ0IsT0FBTyxNQUFNO0FBRTdDLFVBQU0sUUFBUSxPQUFPO0FBQUEsRUFDdEI7QUFDRDtBQUVBLE1BQU0sbUJBQW1CLE1BQU07QUFDOUIsUUFBTSxrQkFBa0Isd0NBQXdDO0FBRWhFLE9BQUssbUNBQThCLFlBQVk7QUFDOUMsVUFBTUEsUUFBTyxnQkFBZ0IsSUFBSSxJQUFJLG9CQUFvQixDQUFDO0FBRTFELFVBQU1BLE1BQUs7QUFBQSxNQUNWO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSTtBQUFBLFVBQ0gsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLElBQUksRUFBRTtBQUFBLFVBQ3pCO0FBQUEsUUFDRDtBQUFBLFFBQ0EsSUFBSTtBQUFBLFVBQ0gsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLElBQUksRUFBRTtBQUFBLFVBQ3pCO0FBQUEsUUFDRDtBQUFBLFFBQ0EsSUFBSTtBQUFBLFVBQ0gsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLElBQUksRUFBRTtBQUFBLFVBQ3pCO0FBQUEsUUFDRDtBQUFBLFFBQ0EsSUFBSTtBQUFBLFVBQ0gsSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLEtBQUssRUFBRTtBQUFBLFVBQzNCO0FBQUEsUUFDRDtBQUFBLFFBQ0EsSUFBSTtBQUFBLFVBQ0gsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLElBQUksRUFBRTtBQUFBLFVBQ3pCO0FBQUEsUUFDRDtBQUFBLFFBQ0EsSUFBSTtBQUFBLFVBQ0gsSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLEtBQUssQ0FBQztBQUFBLFVBQzFCO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRCxDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFsidGVzdCJdCn0K
