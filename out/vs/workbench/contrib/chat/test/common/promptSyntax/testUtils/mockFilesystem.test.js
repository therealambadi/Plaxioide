import assert from "assert";
import { MockFilesystem } from "./mockFilesystem.js";
import { URI } from "../../../../../../../base/common/uri.js";
import { Schemas } from "../../../../../../../base/common/network.js";
import { assertDefined } from "../../../../../../../base/common/types.js";
import { FileService } from "../../../../../../../platform/files/common/fileService.js";
import { ILogService, NullLogService } from "../../../../../../../platform/log/common/log.js";
import { IFileService } from "../../../../../../../platform/files/common/files.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../../base/test/common/utils.js";
import { InMemoryFileSystemProvider } from "../../../../../../../platform/files/common/inMemoryFilesystemProvider.js";
import { TestInstantiationService } from "../../../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
const validateFile = async (filePath, expectedFile, fileService) => {
  let readFile;
  try {
    readFile = await fileService.resolve(URI.file(filePath));
  } catch (error) {
    throw new Error(`Failed to read file '${filePath}': ${error}.`);
  }
  assert.strictEqual(
    readFile.name,
    expectedFile.name,
    `File '${filePath}' must have correct 'name'.`
  );
  assert.deepStrictEqual(
    readFile.resource,
    expectedFile.resource,
    `File '${filePath}' must have correct 'URI'.`
  );
  assert.strictEqual(
    readFile.isFile,
    expectedFile.isFile,
    `File '${filePath}' must have correct 'isFile' value.`
  );
  assert.strictEqual(
    readFile.isDirectory,
    expectedFile.isDirectory,
    `File '${filePath}' must have correct 'isDirectory' value.`
  );
  assert.strictEqual(
    readFile.isSymbolicLink,
    expectedFile.isSymbolicLink,
    `File '${filePath}' must have correct 'isSymbolicLink' value.`
  );
  assert.strictEqual(
    readFile.children,
    void 0,
    `File '${filePath}' must not have children.`
  );
  const fileContents = await fileService.readFile(readFile.resource);
  assert.strictEqual(
    fileContents.value.toString(),
    expectedFile.contents,
    `File '${expectedFile.resource.fsPath}' must have correct contents.`
  );
};
const validateFolder = async (folderPath, expectedFolder, fileService) => {
  let readFolder;
  try {
    readFolder = await fileService.resolve(URI.file(folderPath));
  } catch (error) {
    throw new Error(`Failed to read folder '${folderPath}': ${error}.`);
  }
  assert.strictEqual(
    readFolder.name,
    expectedFolder.name,
    `Folder '${folderPath}' must have correct 'name'.`
  );
  assert.deepStrictEqual(
    readFolder.resource,
    expectedFolder.resource,
    `Folder '${folderPath}' must have correct 'URI'.`
  );
  assert.strictEqual(
    readFolder.isFile,
    expectedFolder.isFile,
    `Folder '${folderPath}' must have correct 'isFile' value.`
  );
  assert.strictEqual(
    readFolder.isDirectory,
    expectedFolder.isDirectory,
    `Folder '${folderPath}' must have correct 'isDirectory' value.`
  );
  assert.strictEqual(
    readFolder.isSymbolicLink,
    expectedFolder.isSymbolicLink,
    `Folder '${folderPath}' must have correct 'isSymbolicLink' value.`
  );
  assertDefined(
    readFolder.children,
    `Folder '${folderPath}' must have children.`
  );
  assert.strictEqual(
    readFolder.children.length,
    expectedFolder.children.length,
    `Folder '${folderPath}' must have correct number of children.`
  );
  for (const expectedChild of expectedFolder.children) {
    const childPath = URI.joinPath(expectedFolder.resource, expectedChild.name).fsPath;
    if ("children" in expectedChild) {
      await validateFolder(
        childPath,
        expectedChild,
        fileService
      );
      continue;
    }
    await validateFile(
      childPath,
      expectedChild,
      fileService
    );
  }
};
suite("MockFilesystem", () => {
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  let initService;
  let fileService;
  setup(async () => {
    initService = disposables.add(new TestInstantiationService());
    initService.stub(ILogService, new NullLogService());
    fileService = disposables.add(initService.createInstance(FileService));
    const fileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
    disposables.add(fileService.registerProvider(Schemas.file, fileSystemProvider));
    initService.stub(IFileService, fileService);
  });
  test("\u2022 mocks file structure", async () => {
    const mockFilesystem = initService.createInstance(MockFilesystem, [
      {
        name: "/root/folder",
        children: [
          {
            name: "file.txt",
            contents: "contents"
          },
          {
            name: "Subfolder",
            children: [
              {
                name: "test.ts",
                contents: "other contents"
              },
              {
                name: "file.test.ts",
                contents: "hello test"
              },
              {
                name: ".file-2.TEST.ts",
                contents: "test hello"
              }
            ]
          }
        ]
      }
    ]);
    await mockFilesystem.mock();
    await validateFolder(
      "/root/folder",
      {
        resource: URI.file("/root/folder"),
        name: "folder",
        isFile: false,
        isDirectory: true,
        isSymbolicLink: false,
        children: [
          {
            resource: URI.file("/root/folder/file.txt"),
            name: "file.txt",
            isFile: true,
            isDirectory: false,
            isSymbolicLink: false,
            contents: "contents"
          },
          {
            resource: URI.file("/root/folder/Subfolder"),
            name: "Subfolder",
            isFile: false,
            isDirectory: true,
            isSymbolicLink: false,
            children: [
              {
                resource: URI.file("/root/folder/Subfolder/test.ts"),
                name: "test.ts",
                isFile: true,
                isDirectory: false,
                isSymbolicLink: false,
                contents: "other contents"
              },
              {
                resource: URI.file("/root/folder/Subfolder/file.test.ts"),
                name: "file.test.ts",
                isFile: true,
                isDirectory: false,
                isSymbolicLink: false,
                contents: "hello test"
              },
              {
                resource: URI.file("/root/folder/Subfolder/.file-2.TEST.ts"),
                name: ".file-2.TEST.ts",
                isFile: true,
                isDirectory: false,
                isSymbolicLink: false,
                contents: "test hello"
              }
            ]
          }
        ]
      },
      fileService
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL3Byb21wdFN5bnRheC90ZXN0VXRpbHMvbW9ja0ZpbGVzeXN0ZW0udGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IE1vY2tGaWxlc3lzdGVtIH0gZnJvbSAnLi9tb2NrRmlsZXN5c3RlbS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgYXNzZXJ0RGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlLCBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSwgSUZpbGVTdGF0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSW5NZW1vcnlGaWxlU3lzdGVtUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vaW5NZW1vcnlGaWxlc3lzdGVtUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuXG4vKipcbiAqIEJhc2UgYXR0cmlidXRlIGZvciBhbiBleHBlY3RlZCBmaWxlc3lzdGVtIG5vZGUgKGEgZmlsZSBvciBhIGZvbGRlcikuXG4gKi9cbmludGVyZmFjZSBJRXhwZWN0ZWRGaWxlc3lzdGVtTm9kZSBleHRlbmRzIFBpY2s8XG5cdElGaWxlU3RhdCxcblx0J3Jlc291cmNlJyB8ICduYW1lJyB8ICdpc0ZpbGUnIHwgJ2lzRGlyZWN0b3J5JyB8ICdpc1N5bWJvbGljTGluaydcbj4geyB9XG5cbi8qKlxuICogUmVwcmVzZW50cyBhbiBleHBlY3RlZCBgZmlsZWAgaW5mby5cbiAqL1xuaW50ZXJmYWNlIElFeHBlY3RlZEZpbGUgZXh0ZW5kcyBJRXhwZWN0ZWRGaWxlc3lzdGVtTm9kZSB7XG5cdC8qKlxuXHQgKiBFeHBlY3RlZCBmaWxlIGNvbnRlbnRzLlxuXHQgKi9cblx0Y29udGVudHM6IHN0cmluZztcbn1cblxuLyoqXG4gKiBSZXByZXNlbnRzIGFuIGV4cGVjdGVkIGBmb2xkZXJgIGluZm8uXG4gKi9cbmludGVyZmFjZSBJRXhwZWN0ZWRGb2xkZXIgZXh0ZW5kcyBJRXhwZWN0ZWRGaWxlc3lzdGVtTm9kZSB7XG5cdC8qKlxuXHQgKiBFeHBlY3RlZCBmb2xkZXIgY2hpbGRyZW4uXG5cdCAqL1xuXHRjaGlsZHJlbjogKElFeHBlY3RlZEZvbGRlciB8IElFeHBlY3RlZEZpbGUpW107XG59XG5cbi8qKlxuICogVmFsaWRhdGVzIHRoYXQgZmlsZSBhdCB7QGxpbmsgZmlsZVBhdGh9IGhhcyBleHBlY3RlZCBhdHRyaWJ1dGVzLlxuICovXG5jb25zdCB2YWxpZGF0ZUZpbGUgPSBhc3luYyAoXG5cdGZpbGVQYXRoOiBzdHJpbmcsXG5cdGV4cGVjdGVkRmlsZTogSUV4cGVjdGVkRmlsZSxcblx0ZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcbikgPT4ge1xuXHRsZXQgcmVhZEZpbGU6IElGaWxlU3RhdCB8IHVuZGVmaW5lZDtcblx0dHJ5IHtcblx0XHRyZWFkRmlsZSA9IGF3YWl0IGZpbGVTZXJ2aWNlLnJlc29sdmUoVVJJLmZpbGUoZmlsZVBhdGgpKTtcblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byByZWFkIGZpbGUgJyR7ZmlsZVBhdGh9JzogJHtlcnJvcn0uYCk7XG5cdH1cblxuXHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0cmVhZEZpbGUubmFtZSxcblx0XHRleHBlY3RlZEZpbGUubmFtZSxcblx0XHRgRmlsZSAnJHtmaWxlUGF0aH0nIG11c3QgaGF2ZSBjb3JyZWN0ICduYW1lJy5gLFxuXHQpO1xuXG5cdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0cmVhZEZpbGUucmVzb3VyY2UsXG5cdFx0ZXhwZWN0ZWRGaWxlLnJlc291cmNlLFxuXHRcdGBGaWxlICcke2ZpbGVQYXRofScgbXVzdCBoYXZlIGNvcnJlY3QgJ1VSSScuYCxcblx0KTtcblxuXHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0cmVhZEZpbGUuaXNGaWxlLFxuXHRcdGV4cGVjdGVkRmlsZS5pc0ZpbGUsXG5cdFx0YEZpbGUgJyR7ZmlsZVBhdGh9JyBtdXN0IGhhdmUgY29ycmVjdCAnaXNGaWxlJyB2YWx1ZS5gLFxuXHQpO1xuXG5cdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRyZWFkRmlsZS5pc0RpcmVjdG9yeSxcblx0XHRleHBlY3RlZEZpbGUuaXNEaXJlY3RvcnksXG5cdFx0YEZpbGUgJyR7ZmlsZVBhdGh9JyBtdXN0IGhhdmUgY29ycmVjdCAnaXNEaXJlY3RvcnknIHZhbHVlLmAsXG5cdCk7XG5cblx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdHJlYWRGaWxlLmlzU3ltYm9saWNMaW5rLFxuXHRcdGV4cGVjdGVkRmlsZS5pc1N5bWJvbGljTGluayxcblx0XHRgRmlsZSAnJHtmaWxlUGF0aH0nIG11c3QgaGF2ZSBjb3JyZWN0ICdpc1N5bWJvbGljTGluaycgdmFsdWUuYCxcblx0KTtcblxuXHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0cmVhZEZpbGUuY2hpbGRyZW4sXG5cdFx0dW5kZWZpbmVkLFxuXHRcdGBGaWxlICcke2ZpbGVQYXRofScgbXVzdCBub3QgaGF2ZSBjaGlsZHJlbi5gLFxuXHQpO1xuXG5cdGNvbnN0IGZpbGVDb250ZW50cyA9IGF3YWl0IGZpbGVTZXJ2aWNlLnJlYWRGaWxlKHJlYWRGaWxlLnJlc291cmNlKTtcblx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdGZpbGVDb250ZW50cy52YWx1ZS50b1N0cmluZygpLFxuXHRcdGV4cGVjdGVkRmlsZS5jb250ZW50cyxcblx0XHRgRmlsZSAnJHtleHBlY3RlZEZpbGUucmVzb3VyY2UuZnNQYXRofScgbXVzdCBoYXZlIGNvcnJlY3QgY29udGVudHMuYCxcblx0KTtcbn07XG5cbi8qKlxuICogVmFsaWRhdGVzIHRoYXQgZm9sZGVyIGF0IHtAbGluayBmb2xkZXJQYXRofSBoYXMgZXhwZWN0ZWQgYXR0cmlidXRlcy5cbiAqL1xuY29uc3QgdmFsaWRhdGVGb2xkZXIgPSBhc3luYyAoXG5cdGZvbGRlclBhdGg6IHN0cmluZyxcblx0ZXhwZWN0ZWRGb2xkZXI6IElFeHBlY3RlZEZvbGRlcixcblx0ZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcbikgPT4ge1xuXHRsZXQgcmVhZEZvbGRlcjogSUZpbGVTdGF0IHwgdW5kZWZpbmVkO1xuXHR0cnkge1xuXHRcdHJlYWRGb2xkZXIgPSBhd2FpdCBmaWxlU2VydmljZS5yZXNvbHZlKFVSSS5maWxlKGZvbGRlclBhdGgpKTtcblx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byByZWFkIGZvbGRlciAnJHtmb2xkZXJQYXRofSc6ICR7ZXJyb3J9LmApO1xuXHR9XG5cblx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdHJlYWRGb2xkZXIubmFtZSxcblx0XHRleHBlY3RlZEZvbGRlci5uYW1lLFxuXHRcdGBGb2xkZXIgJyR7Zm9sZGVyUGF0aH0nIG11c3QgaGF2ZSBjb3JyZWN0ICduYW1lJy5gLFxuXHQpO1xuXG5cdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0cmVhZEZvbGRlci5yZXNvdXJjZSxcblx0XHRleHBlY3RlZEZvbGRlci5yZXNvdXJjZSxcblx0XHRgRm9sZGVyICcke2ZvbGRlclBhdGh9JyBtdXN0IGhhdmUgY29ycmVjdCAnVVJJJy5gLFxuXHQpO1xuXG5cdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRyZWFkRm9sZGVyLmlzRmlsZSxcblx0XHRleHBlY3RlZEZvbGRlci5pc0ZpbGUsXG5cdFx0YEZvbGRlciAnJHtmb2xkZXJQYXRofScgbXVzdCBoYXZlIGNvcnJlY3QgJ2lzRmlsZScgdmFsdWUuYCxcblx0KTtcblxuXHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0cmVhZEZvbGRlci5pc0RpcmVjdG9yeSxcblx0XHRleHBlY3RlZEZvbGRlci5pc0RpcmVjdG9yeSxcblx0XHRgRm9sZGVyICcke2ZvbGRlclBhdGh9JyBtdXN0IGhhdmUgY29ycmVjdCAnaXNEaXJlY3RvcnknIHZhbHVlLmAsXG5cdCk7XG5cblx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdHJlYWRGb2xkZXIuaXNTeW1ib2xpY0xpbmssXG5cdFx0ZXhwZWN0ZWRGb2xkZXIuaXNTeW1ib2xpY0xpbmssXG5cdFx0YEZvbGRlciAnJHtmb2xkZXJQYXRofScgbXVzdCBoYXZlIGNvcnJlY3QgJ2lzU3ltYm9saWNMaW5rJyB2YWx1ZS5gLFxuXHQpO1xuXG5cdGFzc2VydERlZmluZWQoXG5cdFx0cmVhZEZvbGRlci5jaGlsZHJlbixcblx0XHRgRm9sZGVyICcke2ZvbGRlclBhdGh9JyBtdXN0IGhhdmUgY2hpbGRyZW4uYCxcblx0KTtcblxuXHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0cmVhZEZvbGRlci5jaGlsZHJlbi5sZW5ndGgsXG5cdFx0ZXhwZWN0ZWRGb2xkZXIuY2hpbGRyZW4ubGVuZ3RoLFxuXHRcdGBGb2xkZXIgJyR7Zm9sZGVyUGF0aH0nIG11c3QgaGF2ZSBjb3JyZWN0IG51bWJlciBvZiBjaGlsZHJlbi5gLFxuXHQpO1xuXG5cdGZvciAoY29uc3QgZXhwZWN0ZWRDaGlsZCBvZiBleHBlY3RlZEZvbGRlci5jaGlsZHJlbikge1xuXHRcdGNvbnN0IGNoaWxkUGF0aCA9IFVSSS5qb2luUGF0aChleHBlY3RlZEZvbGRlci5yZXNvdXJjZSwgZXhwZWN0ZWRDaGlsZC5uYW1lKS5mc1BhdGg7XG5cblx0XHRpZiAoJ2NoaWxkcmVuJyBpbiBleHBlY3RlZENoaWxkKSB7XG5cdFx0XHRhd2FpdCB2YWxpZGF0ZUZvbGRlcihcblx0XHRcdFx0Y2hpbGRQYXRoLFxuXHRcdFx0XHRleHBlY3RlZENoaWxkLFxuXHRcdFx0XHRmaWxlU2VydmljZSxcblx0XHRcdCk7XG5cblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdGF3YWl0IHZhbGlkYXRlRmlsZShcblx0XHRcdGNoaWxkUGF0aCxcblx0XHRcdGV4cGVjdGVkQ2hpbGQsXG5cdFx0XHRmaWxlU2VydmljZSxcblx0XHQpO1xuXHR9XG59O1xuXG5zdWl0ZSgnTW9ja0ZpbGVzeXN0ZW0nLCAoKSA9PiB7XG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0bGV0IGluaXRTZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdGxldCBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlO1xuXHRzZXR1cChhc3luYyAoKSA9PiB7XG5cdFx0aW5pdFNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSgpKTtcblx0XHRpbml0U2VydmljZS5zdHViKElMb2dTZXJ2aWNlLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSk7XG5cblx0XHRmaWxlU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChpbml0U2VydmljZS5jcmVhdGVJbnN0YW5jZShGaWxlU2VydmljZSkpO1xuXHRcdGNvbnN0IGZpbGVTeXN0ZW1Qcm92aWRlciA9IGRpc3Bvc2FibGVzLmFkZChuZXcgSW5NZW1vcnlGaWxlU3lzdGVtUHJvdmlkZXIoKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGZpbGVTZXJ2aWNlLnJlZ2lzdGVyUHJvdmlkZXIoU2NoZW1hcy5maWxlLCBmaWxlU3lzdGVtUHJvdmlkZXIpKTtcblxuXHRcdGluaXRTZXJ2aWNlLnN0dWIoSUZpbGVTZXJ2aWNlLCBmaWxlU2VydmljZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiBtb2NrcyBmaWxlIHN0cnVjdHVyZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBtb2NrRmlsZXN5c3RlbSA9IGluaXRTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1vY2tGaWxlc3lzdGVtLCBbXG5cdFx0XHR7XG5cdFx0XHRcdG5hbWU6ICcvcm9vdC9mb2xkZXInLFxuXHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG5hbWU6ICdmaWxlLnR4dCcsXG5cdFx0XHRcdFx0XHRjb250ZW50czogJ2NvbnRlbnRzJyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdG5hbWU6ICdTdWJmb2xkZXInLFxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICd0ZXN0LnRzJyxcblx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ290aGVyIGNvbnRlbnRzJyxcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdmaWxlLnRlc3QudHMnLFxuXHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnaGVsbG8gdGVzdCcsXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnLmZpbGUtMi5URVNULnRzJyxcblx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ3Rlc3QgaGVsbG8nLFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdF0pO1xuXG5cdFx0YXdhaXQgbW9ja0ZpbGVzeXN0ZW0ubW9jaygpO1xuXG5cdFx0LyoqXG5cdFx0ICogVmFsaWRhdGUgZmlsZXMgYW5kIGZvbGRlcnMgbmV4dC5cblx0XHQgKi9cblxuXHRcdGF3YWl0IHZhbGlkYXRlRm9sZGVyKFxuXHRcdFx0Jy9yb290L2ZvbGRlcicsXG5cdFx0XHR7XG5cdFx0XHRcdHJlc291cmNlOiBVUkkuZmlsZSgnL3Jvb3QvZm9sZGVyJyksXG5cdFx0XHRcdG5hbWU6ICdmb2xkZXInLFxuXHRcdFx0XHRpc0ZpbGU6IGZhbHNlLFxuXHRcdFx0XHRpc0RpcmVjdG9yeTogdHJ1ZSxcblx0XHRcdFx0aXNTeW1ib2xpY0xpbms6IGZhbHNlLFxuXHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHJlc291cmNlOiBVUkkuZmlsZSgnL3Jvb3QvZm9sZGVyL2ZpbGUudHh0JyksXG5cdFx0XHRcdFx0XHRuYW1lOiAnZmlsZS50eHQnLFxuXHRcdFx0XHRcdFx0aXNGaWxlOiB0cnVlLFxuXHRcdFx0XHRcdFx0aXNEaXJlY3Rvcnk6IGZhbHNlLFxuXHRcdFx0XHRcdFx0aXNTeW1ib2xpY0xpbms6IGZhbHNlLFxuXHRcdFx0XHRcdFx0Y29udGVudHM6ICdjb250ZW50cycsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRyZXNvdXJjZTogVVJJLmZpbGUoJy9yb290L2ZvbGRlci9TdWJmb2xkZXInKSxcblx0XHRcdFx0XHRcdG5hbWU6ICdTdWJmb2xkZXInLFxuXHRcdFx0XHRcdFx0aXNGaWxlOiBmYWxzZSxcblx0XHRcdFx0XHRcdGlzRGlyZWN0b3J5OiB0cnVlLFxuXHRcdFx0XHRcdFx0aXNTeW1ib2xpY0xpbms6IGZhbHNlLFxuXHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdHJlc291cmNlOiBVUkkuZmlsZSgnL3Jvb3QvZm9sZGVyL1N1YmZvbGRlci90ZXN0LnRzJyksXG5cdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3Rlc3QudHMnLFxuXHRcdFx0XHRcdFx0XHRcdGlzRmlsZTogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRpc0RpcmVjdG9yeTogZmFsc2UsXG5cdFx0XHRcdFx0XHRcdFx0aXNTeW1ib2xpY0xpbms6IGZhbHNlLFxuXHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnb3RoZXIgY29udGVudHMnLFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0cmVzb3VyY2U6IFVSSS5maWxlKCcvcm9vdC9mb2xkZXIvU3ViZm9sZGVyL2ZpbGUudGVzdC50cycpLFxuXHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdmaWxlLnRlc3QudHMnLFxuXHRcdFx0XHRcdFx0XHRcdGlzRmlsZTogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRpc0RpcmVjdG9yeTogZmFsc2UsXG5cdFx0XHRcdFx0XHRcdFx0aXNTeW1ib2xpY0xpbms6IGZhbHNlLFxuXHRcdFx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnaGVsbG8gdGVzdCcsXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRyZXNvdXJjZTogVVJJLmZpbGUoJy9yb290L2ZvbGRlci9TdWJmb2xkZXIvLmZpbGUtMi5URVNULnRzJyksXG5cdFx0XHRcdFx0XHRcdFx0bmFtZTogJy5maWxlLTIuVEVTVC50cycsXG5cdFx0XHRcdFx0XHRcdFx0aXNGaWxlOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHRcdGlzRGlyZWN0b3J5OiBmYWxzZSxcblx0XHRcdFx0XHRcdFx0XHRpc1N5bWJvbGljTGluazogZmFsc2UsXG5cdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICd0ZXN0IGhlbGxvJyxcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0fSxcblx0XHRcdGZpbGVTZXJ2aWNlLFxuXHRcdCk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsZUFBZTtBQUN4QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGFBQWEsc0JBQXNCO0FBQzVDLFNBQVMsb0JBQStCO0FBQ3hDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsZ0NBQWdDO0FBaUN6QyxNQUFNLGVBQWUsT0FDcEIsVUFDQSxjQUNBLGdCQUNJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFDSCxlQUFXLE1BQU0sWUFBWSxRQUFRLElBQUksS0FBSyxRQUFRLENBQUM7QUFBQSxF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
