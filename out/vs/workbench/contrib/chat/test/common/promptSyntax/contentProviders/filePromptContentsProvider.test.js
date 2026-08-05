import assert from "assert";
import { URI } from "../../../../../../../base/common/uri.js";
import { VSBuffer } from "../../../../../../../base/common/buffer.js";
import { Schemas } from "../../../../../../../base/common/network.js";
import { randomInt } from "../../../../../../../base/common/numbers.js";
import { assertDefined } from "../../../../../../../base/common/types.js";
import { wait } from "../../../../../../../base/test/common/testUtils.js";
import { IFileService } from "../../../../../../../platform/files/common/files.js";
import { FileService } from "../../../../../../../platform/files/common/fileService.js";
import { NullPolicyService } from "../../../../../../../platform/policy/common/policy.js";
import { Line } from "../../../../../../../editor/common/codecs/linesCodec/tokens/line.js";
import { ILogService, NullLogService } from "../../../../../../../platform/log/common/log.js";
import { LinesDecoder } from "../../../../../../../editor/common/codecs/linesCodec/linesDecoder.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../../base/test/common/utils.js";
import { IConfigurationService } from "../../../../../../../platform/configuration/common/configuration.js";
import { ConfigurationService } from "../../../../../../../platform/configuration/common/configurationService.js";
import { InMemoryFileSystemProvider } from "../../../../../../../platform/files/common/inMemoryFilesystemProvider.js";
import { FilePromptContentProvider } from "../../../../common/promptSyntax/contentProviders/filePromptContentsProvider.js";
import { TestInstantiationService } from "../../../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
suite("FilePromptContentsProvider", function() {
  const testDisposables = ensureNoDisposablesAreLeakedInTestSuite();
  let instantiationService;
  setup(async () => {
    const nullPolicyService = new NullPolicyService();
    const nullLogService = testDisposables.add(new NullLogService());
    const nullFileService = testDisposables.add(new FileService(nullLogService));
    const nullConfigService = testDisposables.add(new ConfigurationService(
      URI.file("/config.json"),
      nullFileService,
      nullPolicyService,
      nullLogService
    ));
    instantiationService = testDisposables.add(new TestInstantiationService());
    const fileSystemProvider = testDisposables.add(new InMemoryFileSystemProvider());
    testDisposables.add(nullFileService.registerProvider(Schemas.file, fileSystemProvider));
    instantiationService.stub(IFileService, nullFileService);
    instantiationService.stub(ILogService, nullLogService);
    instantiationService.stub(IConfigurationService, nullConfigService);
  });
  test("provides contents of a file", async function() {
    const fileService = instantiationService.get(IFileService);
    const fileName = `file-${randomInt(1e4)}.prompt.md`;
    const fileUri = URI.file(`/${fileName}`);
    if (await fileService.exists(fileUri)) {
      await fileService.del(fileUri);
    }
    await fileService.writeFile(fileUri, VSBuffer.fromString("Hello, world!"));
    await wait(5);
    const contentsProvider = testDisposables.add(instantiationService.createInstance(
      FilePromptContentProvider,
      fileUri
    ));
    let streamOrError;
    testDisposables.add(contentsProvider.onContentChanged((event) => {
      streamOrError = event;
    }));
    contentsProvider.start();
    await wait(25);
    assertDefined(
      streamOrError,
      "The `streamOrError` must be defined."
    );
    assert(
      !(streamOrError instanceof Error),
      `Provider must produce a byte stream, got '${streamOrError}'.`
    );
    const stream = new LinesDecoder(streamOrError);
    const receivedLines = await stream.consumeAll();
    assert.strictEqual(
      receivedLines.length,
      1,
      "Must read the correct number of lines from the provider."
    );
    const expectedLine = new Line(1, "Hello, world!");
    const receivedLine = receivedLines[0];
    assert(
      receivedLine.equals(expectedLine),
      `Expected to receive '${expectedLine}', got '${receivedLine}'.`
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL3Byb21wdFN5bnRheC9jb250ZW50UHJvdmlkZXJzL2ZpbGVQcm9tcHRDb250ZW50c1Byb3ZpZGVyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgcmFuZG9tSW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbnVtYmVycy5qcyc7XG5pbXBvcnQgeyBhc3NlcnREZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgd2FpdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdGVzdFV0aWxzLmpzJztcbmltcG9ydCB7IFJlYWRhYmxlU3RyZWFtIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyZWFtLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBOdWxsUG9saWN5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3BvbGljeS9jb21tb24vcG9saWN5LmpzJztcbmltcG9ydCB7IExpbmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvZGVjcy9saW5lc0NvZGVjL3Rva2Vucy9saW5lLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlLCBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IExpbmVzRGVjb2RlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29kZWNzL2xpbmVzQ29kZWMvbGluZXNEZWNvZGVyLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IEluTWVtb3J5RmlsZVN5c3RlbVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2luTWVtb3J5RmlsZXN5c3RlbVByb3ZpZGVyLmpzJztcbmltcG9ydCB7IEZpbGVQcm9tcHRDb250ZW50UHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vcHJvbXB0U3ludGF4L2NvbnRlbnRQcm92aWRlcnMvZmlsZVByb21wdENvbnRlbnRzUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuXG5zdWl0ZSgnRmlsZVByb21wdENvbnRlbnRzUHJvdmlkZXInLCBmdW5jdGlvbiAoKSB7XG5cdGNvbnN0IHRlc3REaXNwb3NhYmxlcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRzZXR1cChhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbnVsbFBvbGljeVNlcnZpY2UgPSBuZXcgTnVsbFBvbGljeVNlcnZpY2UoKTtcblx0XHRjb25zdCBudWxsTG9nU2VydmljZSA9IHRlc3REaXNwb3NhYmxlcy5hZGQobmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHRcdGNvbnN0IG51bGxGaWxlU2VydmljZSA9IHRlc3REaXNwb3NhYmxlcy5hZGQobmV3IEZpbGVTZXJ2aWNlKG51bGxMb2dTZXJ2aWNlKSk7XG5cdFx0Y29uc3QgbnVsbENvbmZpZ1NlcnZpY2UgPSB0ZXN0RGlzcG9zYWJsZXMuYWRkKG5ldyBDb25maWd1cmF0aW9uU2VydmljZShcblx0XHRcdFVSSS5maWxlKCcvY29uZmlnLmpzb24nKSxcblx0XHRcdG51bGxGaWxlU2VydmljZSxcblx0XHRcdG51bGxQb2xpY3lTZXJ2aWNlLFxuXHRcdFx0bnVsbExvZ1NlcnZpY2UsXG5cdFx0KSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSB0ZXN0RGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UoKSk7XG5cblx0XHRjb25zdCBmaWxlU3lzdGVtUHJvdmlkZXIgPSB0ZXN0RGlzcG9zYWJsZXMuYWRkKG5ldyBJbk1lbW9yeUZpbGVTeXN0ZW1Qcm92aWRlcigpKTtcblx0XHR0ZXN0RGlzcG9zYWJsZXMuYWRkKG51bGxGaWxlU2VydmljZS5yZWdpc3RlclByb3ZpZGVyKFNjaGVtYXMuZmlsZSwgZmlsZVN5c3RlbVByb3ZpZGVyKSk7XG5cblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElGaWxlU2VydmljZSwgbnVsbEZpbGVTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElMb2dTZXJ2aWNlLCBudWxsTG9nU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29uZmlndXJhdGlvblNlcnZpY2UsIG51bGxDb25maWdTZXJ2aWNlKTtcblx0fSk7XG5cblx0dGVzdCgncHJvdmlkZXMgY29udGVudHMgb2YgYSBmaWxlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSk7XG5cblx0XHRjb25zdCBmaWxlTmFtZSA9IGBmaWxlLSR7cmFuZG9tSW50KDEwMDAwKX0ucHJvbXB0Lm1kYDtcblx0XHRjb25zdCBmaWxlVXJpID0gVVJJLmZpbGUoYC8ke2ZpbGVOYW1lfWApO1xuXG5cdFx0aWYgKGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhmaWxlVXJpKSkge1xuXHRcdFx0YXdhaXQgZmlsZVNlcnZpY2UuZGVsKGZpbGVVcmkpO1xuXHRcdH1cblx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUoZmlsZVVyaSwgVlNCdWZmZXIuZnJvbVN0cmluZygnSGVsbG8sIHdvcmxkIScpKTtcblx0XHRhd2FpdCB3YWl0KDUpO1xuXG5cdFx0Y29uc3QgY29udGVudHNQcm92aWRlciA9IHRlc3REaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRGaWxlUHJvbXB0Q29udGVudFByb3ZpZGVyLFxuXHRcdFx0ZmlsZVVyaSxcblx0XHQpKTtcblxuXHRcdGxldCBzdHJlYW1PckVycm9yOiBSZWFkYWJsZVN0cmVhbTxWU0J1ZmZlcj4gfCBFcnJvciB8IHVuZGVmaW5lZDtcblx0XHR0ZXN0RGlzcG9zYWJsZXMuYWRkKGNvbnRlbnRzUHJvdmlkZXIub25Db250ZW50Q2hhbmdlZCgoZXZlbnQpID0+IHtcblx0XHRcdHN0cmVhbU9yRXJyb3IgPSBldmVudDtcblx0XHR9KSk7XG5cdFx0Y29udGVudHNQcm92aWRlci5zdGFydCgpO1xuXG5cdFx0YXdhaXQgd2FpdCgyNSk7XG5cblx0XHRhc3NlcnREZWZpbmVkKFxuXHRcdFx0c3RyZWFtT3JFcnJvcixcblx0XHRcdCdUaGUgYHN0cmVhbU9yRXJyb3JgIG11c3QgYmUgZGVmaW5lZC4nLFxuXHRcdCk7XG5cblx0XHRhc3NlcnQoXG5cdFx0XHQhKHN0cmVhbU9yRXJyb3IgaW5zdGFuY2VvZiBFcnJvciksXG5cdFx0XHRgUHJvdmlkZXIgbXVzdCBwcm9kdWNlIGEgYnl0ZSBzdHJlYW0sIGdvdCAnJHtzdHJlYW1PckVycm9yfScuYCxcblx0XHQpO1xuXG5cdFx0Y29uc3Qgc3RyZWFtID0gbmV3IExpbmVzRGVjb2RlcihzdHJlYW1PckVycm9yKTtcblxuXHRcdGNvbnN0IHJlY2VpdmVkTGluZXMgPSBhd2FpdCBzdHJlYW0uY29uc3VtZUFsbCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHJlY2VpdmVkTGluZXMubGVuZ3RoLFxuXHRcdFx0MSxcblx0XHRcdCdNdXN0IHJlYWQgdGhlIGNvcnJlY3QgbnVtYmVyIG9mIGxpbmVzIGZyb20gdGhlIHByb3ZpZGVyLicsXG5cdFx0KTtcblxuXHRcdGNvbnN0IGV4cGVjdGVkTGluZSA9IG5ldyBMaW5lKDEsICdIZWxsbywgd29ybGQhJyk7XG5cdFx0Y29uc3QgcmVjZWl2ZWRMaW5lID0gcmVjZWl2ZWRMaW5lc1swXTtcblx0XHRhc3NlcnQoXG5cdFx0XHRyZWNlaXZlZExpbmUuZXF1YWxzKGV4cGVjdGVkTGluZSksXG5cdFx0XHRgRXhwZWN0ZWQgdG8gcmVjZWl2ZSAnJHtleHBlY3RlZExpbmV9JywgZ290ICcke3JlY2VpdmVkTGluZX0nLmAsXG5cdFx0KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLFdBQVc7QUFDcEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsWUFBWTtBQUVyQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLFlBQVk7QUFDckIsU0FBUyxhQUFhLHNCQUFzQjtBQUM1QyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLCtDQUErQztBQUN4RCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLGlDQUFpQztBQUMxQyxTQUFTLGdDQUFnQztBQUV6QyxNQUFNLDhCQUE4QixXQUFZO0FBQy9DLFFBQU0sa0JBQWtCLHdDQUF3QztBQUVoRSxNQUFJO0FBQ0osUUFBTSxZQUFZO0FBQ2pCLFVBQU0sb0JBQW9CLElBQUksa0JBQWtCO0FBQ2hELFVBQU0saUJBQWlCLGdCQUFnQixJQUFJLElBQUksZUFBZSxDQUFDO0FBQy9ELFVBQU0sa0JBQWtCLGdCQUFnQixJQUFJLElBQUksWUFBWSxjQUFjLENBQUM7QUFDM0UsVUFBTSxvQkFBb0IsZ0JBQWdCLElBQUksSUFBSTtBQUFBLE1BQ2pELElBQUksS0FBSyxjQUFjO0FBQUEsTUFDdkI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsQ0FBQztBQUNELDJCQUF1QixnQkFBZ0IsSUFBSSxJQUFJLHlCQUF5QixDQUFDO0FBRXpFLFVBQU0scUJBQXFCLGdCQUFnQixJQUFJLElBQUksMkJBQTJCLENBQUM7QUFDL0Usb0JBQWdCLElBQUksZ0JBQWdCLGlCQUFpQixRQUFRLE1BQU0sa0JBQWtCLENBQUM7QUFFdEYseUJBQXFCLEtBQUssY0FBYyxlQUFlO0FBQ3ZELHlCQUFxQixLQUFLLGFBQWEsY0FBYztBQUNyRCx5QkFBcUIsS0FBSyx1QkFBdUIsaUJBQWlCO0FBQUEsRUFDbkUsQ0FBQztBQUVELE9BQUssK0JBQStCLGlCQUFrQjtBQUNyRCxVQUFNLGNBQWMscUJBQXFCLElBQUksWUFBWTtBQUV6RCxVQUFNLFdBQVcsUUFBUSxVQUFVLEdBQUssQ0FBQztBQUN6QyxVQUFNLFVBQVUsSUFBSSxLQUFLLElBQUksUUFBUSxFQUFFO0FBRXZDLFFBQUksTUFBTSxZQUFZLE9BQU8sT0FBTyxHQUFHO0FBQ3RDLFlBQU0sWUFBWSxJQUFJLE9BQU87QUFBQSxJQUM5QjtBQUNBLFVBQU0sWUFBWSxVQUFVLFNBQVMsU0FBUyxXQUFXLGVBQWUsQ0FBQztBQUN6RSxVQUFNLEtBQUssQ0FBQztBQUVaLFVBQU0sbUJBQW1CLGdCQUFnQixJQUFJLHFCQUFxQjtBQUFBLE1BQ2pFO0FBQUEsTUFDQTtBQUFBLElBQ0QsQ0FBQztBQUVELFFBQUk7QUFDSixvQkFBZ0IsSUFBSSxpQkFBaUIsaUJBQWlCLENBQUMsVUFBVTtBQUNoRSxzQkFBZ0I7QUFBQSxJQUNqQixDQUFDLENBQUM7QUFDRixxQkFBaUIsTUFBTTtBQUV2QixVQUFNLEtBQUssRUFBRTtBQUViO0FBQUEsTUFDQztBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBRUE7QUFBQSxNQUNDLEVBQUUseUJBQXlCO0FBQUEsTUFDM0IsNkNBQTZDLGFBQWE7QUFBQSxJQUMzRDtBQUVBLFVBQU0sU0FBUyxJQUFJLGFBQWEsYUFBYTtBQUU3QyxVQUFNLGdCQUFnQixNQUFNLE9BQU8sV0FBVztBQUM5QyxXQUFPO0FBQUEsTUFDTixjQUFjO0FBQUEsTUFDZDtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBRUEsVUFBTSxlQUFlLElBQUksS0FBSyxHQUFHLGVBQWU7QUFDaEQsVUFBTSxlQUFlLGNBQWMsQ0FBQztBQUNwQztBQUFBLE1BQ0MsYUFBYSxPQUFPLFlBQVk7QUFBQSxNQUNoQyx3QkFBd0IsWUFBWSxXQUFXLFlBQVk7QUFBQSxJQUM1RDtBQUFBLEVBQ0QsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
