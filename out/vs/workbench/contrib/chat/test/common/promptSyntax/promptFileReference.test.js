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
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import assert from "assert";
import { URI } from "../../../../../../base/common/uri.js";
import { Schemas } from "../../../../../../base/common/network.js";
import { extUri } from "../../../../../../base/common/resources.js";
import { isWindows } from "../../../../../../base/common/platform.js";
import { Range } from "../../../../../../editor/common/core/range.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { MockFilesystem } from "./testUtils/mockFilesystem.js";
import { IFileService } from "../../../../../../platform/files/common/files.js";
import { FileService } from "../../../../../../platform/files/common/fileService.js";
import { NullPolicyService } from "../../../../../../platform/policy/common/policy.js";
import { ILogService, NullLogService } from "../../../../../../platform/log/common/log.js";
import { FileReference } from "../../../common/promptSyntax/codecs/tokens/fileReference.js";
import { FilePromptParser } from "../../../common/promptSyntax/parsers/filePromptParser.js";
import { waitRandom, randomBoolean } from "../../../../../../base/test/common/testUtils.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
import { IConfigurationService } from "../../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { ConfigurationService } from "../../../../../../platform/configuration/common/configurationService.js";
import { InMemoryFileSystemProvider } from "../../../../../../platform/files/common/inMemoryFilesystemProvider.js";
import { TestInstantiationService } from "../../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { NotPromptFile, RecursiveReference, OpenFailed, FolderReference } from "../../../common/promptFileReferenceErrors.js";
class ExpectedReference {
  constructor(dirname, lineToken, errorCondition) {
    this.lineToken = lineToken;
    this.errorCondition = errorCondition;
    this.uri = extUri.resolvePath(dirname, lineToken.path);
  }
  /**
   * String representation of the expected reference.
   */
  toString() {
    return `file-prompt:${this.uri.path}`;
  }
}
let TestPromptFileReference = class extends Disposable {
  constructor(fileStructure, rootFileUri, expectedReferences, fileService, initService) {
    super();
    this.fileStructure = fileStructure;
    this.rootFileUri = rootFileUri;
    this.expectedReferences = expectedReferences;
    this.fileService = fileService;
    this.initService = initService;
    const fileSystemProvider = this._register(new InMemoryFileSystemProvider());
    this._register(this.fileService.registerProvider(Schemas.file, fileSystemProvider));
  }
  /**
   * Run the test.
   */
  async run() {
    await this.initService.createInstance(MockFilesystem, this.fileStructure).mock();
    if (randomBoolean()) {
      await waitRandom(5);
    }
    const rootReference = this._register(
      this.initService.createInstance(
        FilePromptParser,
        this.rootFileUri,
        []
      )
    ).start();
    await rootReference.allSettled();
    const resolvedReferences = rootReference.allReferences;
    for (let i = 0; i < this.expectedReferences.length; i++) {
      const expectedReference = this.expectedReferences[i];
      const resolvedReference = resolvedReferences[i];
      assert(
        resolvedReference && resolvedReference.uri.toString() === expectedReference.uri.toString(),
        [
          `Expected ${i}th resolved reference URI to be '${expectedReference.uri}'`,
          `got '${resolvedReference?.uri}'.`
        ].join(", ")
      );
      if (expectedReference.errorCondition === void 0) {
        assert(
          resolvedReference.errorCondition === void 0,
          [
            `Expected ${i}th error condition to be 'undefined'`,
            `got '${resolvedReference.errorCondition}'.`
          ].join(", ")
        );
        continue;
      }
      assert(
        expectedReference.errorCondition.equal(resolvedReference.errorCondition),
        [
          `Expected ${i}th error condition to be '${expectedReference.errorCondition}'`,
          `got '${resolvedReference.errorCondition}'.`
        ].join(", ")
      );
    }
    assert.strictEqual(
      resolvedReferences.length,
      this.expectedReferences.length,
      [
        `
Expected(${this.expectedReferences.length}): [
 ${this.expectedReferences.join("\n ")}
]`,
        `Received(${resolvedReferences.length}): [
 ${resolvedReferences.join("\n ")}
]`
      ].join("\n")
    );
  }
};
TestPromptFileReference = __decorateClass([
  __decorateParam(3, IFileService),
  __decorateParam(4, IInstantiationService)
], TestPromptFileReference);
const createTestFileReference = (filePath, lineNumber, startColumnNumber) => {
  const range = new Range(
    lineNumber,
    startColumnNumber,
    lineNumber,
    startColumnNumber + `#file:${filePath}`.length
  );
  return new FileReference(range, filePath);
};
suite("PromptFileReference (Unix)", function() {
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
    instantiationService.stub(IFileService, nullFileService);
    instantiationService.stub(ILogService, nullLogService);
    instantiationService.stub(IConfigurationService, nullConfigService);
  });
  test("\u2022 resolves nested file references", async function() {
    if (isWindows) {
      this.skip();
    }
    const rootFolderName = "resolves-nested-file-references";
    const rootFolder = `/${rootFolderName}`;
    const rootUri = URI.file(rootFolder);
    const test2 = testDisposables.add(instantiationService.createInstance(
      TestPromptFileReference,
      /**
       * The file structure to be created on the disk for the test.
       */
      [{
        name: rootFolderName,
        children: [
          {
            name: "file1.prompt.md",
            contents: "## Some Header\nsome contents\n "
          },
          {
            name: "file2.prompt.md",
            contents: "## Files\n	- this file #file:folder1/file3.prompt.md \n	- also this [file4.prompt.md](./folder1/some-other-folder/file4.prompt.md) please!\n "
          },
          {
            name: "folder1",
            children: [
              {
                name: "file3.prompt.md",
                contents: `
[](./some-other-folder/non-existing-folder)
	- some seemingly random #file:${rootFolder}/folder1/some-other-folder/yetAnotherFolder\u{1F92D}/another-file.prompt.md contents
 some more	 content`
              },
              {
                name: "some-other-folder",
                children: [
                  {
                    name: "file4.prompt.md",
                    contents: "this file has a non-existing #file:./some-non-existing/file.prompt.md		reference\n\n\nand some\n non-prompt #file:./some-non-prompt-file.md		 	[](../../folder1/)	"
                  },
                  {
                    name: "file.txt",
                    contents: "contents of a non-prompt-snippet file"
                  },
                  {
                    name: "yetAnotherFolder\u{1F92D}",
                    children: [
                      {
                        name: "another-file.prompt.md",
                        contents: `[](${rootFolder}/folder1/some-other-folder)
another-file.prompt.md contents	 [#file:file.txt](../file.txt)`
                      },
                      {
                        name: "one_more_file_just_in_case.prompt.md",
                        contents: "one_more_file_just_in_case.prompt.md contents"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }],
      /**
       * The root file path to start the resolve process from.
       */
      URI.file(`/${rootFolderName}/file2.prompt.md`),
      /**
       * The expected references to be resolved.
       */
      [
        new ExpectedReference(
          rootUri,
          createTestFileReference("folder1/file3.prompt.md", 2, 14)
        ),
        new ExpectedReference(
          URI.joinPath(rootUri, "./folder1"),
          createTestFileReference(
            `./some-other-folder/non-existing-folder`,
            2,
            1
          ),
          new OpenFailed(
            URI.joinPath(rootUri, "./folder1/some-other-folder/non-existing-folder"),
            "Reference to non-existing file cannot be opened."
          )
        ),
        new ExpectedReference(
          URI.joinPath(rootUri, "./folder1"),
          createTestFileReference(
            `/${rootFolderName}/folder1/some-other-folder/yetAnotherFolder\u{1F92D}/another-file.prompt.md`,
            3,
            26
          )
        ),
        new ExpectedReference(
          URI.joinPath(rootUri, "./folder1/some-other-folder"),
          createTestFileReference(".", 1, 1),
          new FolderReference(
            URI.joinPath(rootUri, "./folder1/some-other-folder"),
            "This folder is not a prompt file!"
          )
        ),
        new ExpectedReference(
          URI.joinPath(rootUri, "./folder1/some-other-folder/yetAnotherFolder\u{1F92D}"),
          createTestFileReference("../file.txt", 2, 35),
          new NotPromptFile(
            URI.joinPath(rootUri, "./folder1/some-other-folder/file.txt"),
            "Ughh oh, that is not a prompt file!"
          )
        ),
        new ExpectedReference(
          rootUri,
          createTestFileReference("./folder1/some-other-folder/file4.prompt.md", 3, 14)
        ),
        new ExpectedReference(
          URI.joinPath(rootUri, "./folder1/some-other-folder"),
          createTestFileReference("./some-non-existing/file.prompt.md", 1, 30),
          new OpenFailed(
            URI.joinPath(rootUri, "./folder1/some-other-folder/some-non-existing/file.prompt.md"),
            "Failed to open non-existring prompt snippets file"
          )
        ),
        new ExpectedReference(
          URI.joinPath(rootUri, "./folder1/some-other-folder"),
          createTestFileReference("./some-non-prompt-file.md", 5, 13),
          new OpenFailed(
            URI.joinPath(rootUri, "./folder1/some-other-folder/some-non-prompt-file.md"),
            "Oh no!"
          )
        ),
        new ExpectedReference(
          URI.joinPath(rootUri, "./some-other-folder/folder1"),
          createTestFileReference("../../folder1", 5, 48),
          new FolderReference(
            URI.joinPath(rootUri, "./folder1"),
            "Uggh ohh!"
          )
        )
      ]
    ));
    await test2.run();
  });
  test("\u2022 does not fall into infinite reference recursion", async function() {
    if (isWindows) {
      this.skip();
    }
    const rootFolderName = "infinite-recursion";
    const rootFolder = `/${rootFolderName}`;
    const rootUri = URI.file(rootFolder);
    const test2 = testDisposables.add(instantiationService.createInstance(
      TestPromptFileReference,
      /**
       * The file structure to be created on the disk for the test.
       */
      [{
        name: rootFolderName,
        children: [
          {
            name: "file1.md",
            contents: "## Some Header\nsome contents\n "
          },
          {
            name: "file2.prompt.md",
            contents: `## Files
	- this file #file:folder1/file3.prompt.md 
	- also this #file:./folder1/some-other-folder/file4.prompt.md

#file:${rootFolder}/folder1/some-other-folder/file5.prompt.md	 please!
	[some (snippet!) #name))](./file1.md)`
          },
          {
            name: "folder1",
            children: [
              {
                name: "file3.prompt.md",
                contents: `

	- some seemingly random [another-file.prompt.md](${rootFolder}/folder1/some-other-folder/yetAnotherFolder\u{1F92D}/another-file.prompt.md) contents
 some more	 content`
              },
              {
                name: "some-other-folder",
                children: [
                  {
                    name: "file4.prompt.md",
                    contents: "this file has a non-existing #file:../some-non-existing/file.prompt.md		reference"
                  },
                  {
                    name: "file5.prompt.md",
                    contents: "this file has a relative recursive #file:../../file2.prompt.md\nreference\n "
                  },
                  {
                    name: "yetAnotherFolder\u{1F92D}",
                    children: [
                      {
                        name: "another-file.prompt.md",
                        // absolute path with recursion
                        contents: `some test goes	
here #file:${rootFolder}/file2.prompt.md`
                      },
                      {
                        name: "one_more_file_just_in_case.prompt.md",
                        contents: "one_more_file_just_in_case.prompt.md contents"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      }],
      /**
       * The root file path to start the resolve process from.
       */
      URI.file(`/${rootFolderName}/file2.prompt.md`),
      /**
       * The expected references to be resolved.
       */
      [
        new ExpectedReference(
          rootUri,
          createTestFileReference("folder1/file3.prompt.md", 2, 9)
        ),
        new ExpectedReference(
          URI.joinPath(rootUri, "./folder1"),
          createTestFileReference(
            `${rootFolder}/folder1/some-other-folder/yetAnotherFolder\u{1F92D}/another-file.prompt.md`,
            3,
            23
          )
        ),
        /**
         * This reference should be resolved with a recursive
         * reference error condition. (the absolute reference case)
         */
        new ExpectedReference(
          URI.joinPath(rootUri, "./folder1/some-other-folder/yetAnotherFolder\u{1F92D}"),
          createTestFileReference(`${rootFolder}/file2.prompt.md`, 2, 6),
          new RecursiveReference(
            URI.joinPath(rootUri, "./file2.prompt.md"),
            [
              "/infinite-recursion/file2.prompt.md",
              "/infinite-recursion/folder1/file3.prompt.md",
              "/infinite-recursion/folder1/some-other-folder/yetAnotherFolder\u{1F92D}/another-file.prompt.md",
              "/infinite-recursion/file2.prompt.md"
            ]
          )
        ),
        new ExpectedReference(
          rootUri,
          createTestFileReference("./folder1/some-other-folder/file4.prompt.md", 3, 14),
          void 0
        ),
        new ExpectedReference(
          URI.joinPath(rootUri, "./folder1/some-other-folder"),
          createTestFileReference("../some-non-existing/file.prompt.md", 1, 30),
          new OpenFailed(
            URI.joinPath(rootUri, "./folder1/some-non-existing/file.prompt.md"),
            "Uggh ohh!"
          )
        ),
        new ExpectedReference(
          rootUri,
          createTestFileReference(
            `${rootFolder}/folder1/some-other-folder/file5.prompt.md`,
            5,
            1
          ),
          void 0
        ),
        /**
         * This reference should be resolved with a recursive
         * reference error condition. (the relative reference case)
         */
        new ExpectedReference(
          URI.joinPath(rootUri, "./folder1/some-other-folder"),
          createTestFileReference("../../file2.prompt.md", 1, 36),
          new RecursiveReference(
            URI.joinPath(rootUri, "./file2.prompt.md"),
            [
              "/infinite-recursion/file2.prompt.md",
              "/infinite-recursion/folder1/some-other-folder/file5.prompt.md",
              "/infinite-recursion/file2.prompt.md"
            ]
          )
        ),
        new ExpectedReference(
          rootUri,
          createTestFileReference("./file1.md", 6, 2),
          new NotPromptFile(
            URI.joinPath(rootUri, "./file1.md"),
            "Uggh oh!"
          )
        )
      ]
    ));
    await test2.run();
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL3Byb21wdFN5bnRheC9wcm9tcHRGaWxlUmVmZXJlbmNlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgZXh0VXJpIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSU1vY2tGb2xkZXIsIE1vY2tGaWxlc3lzdGVtIH0gZnJvbSAnLi90ZXN0VXRpbHMvbW9ja0ZpbGVzeXN0ZW0uanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElQcm9tcHRSZWZlcmVuY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vcHJvbXB0U3ludGF4L3BhcnNlcnMvdHlwZXMuanMnO1xuaW1wb3J0IHsgRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTnVsbFBvbGljeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9wb2xpY3kvY29tbW9uL3BvbGljeS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSwgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBURXJyb3JDb25kaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vcHJvbXB0U3ludGF4L3BhcnNlcnMvYmFzZVByb21wdFBhcnNlci5qcyc7XG5pbXBvcnQgeyBGaWxlUmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3Byb21wdFN5bnRheC9jb2RlY3MvdG9rZW5zL2ZpbGVSZWZlcmVuY2UuanMnO1xuaW1wb3J0IHsgRmlsZVByb21wdFBhcnNlciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9wcm9tcHRTeW50YXgvcGFyc2Vycy9maWxlUHJvbXB0UGFyc2VyLmpzJztcbmltcG9ydCB7IHdhaXRSYW5kb20sIHJhbmRvbUJvb2xlYW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3Rlc3RVdGlscy5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IEluTWVtb3J5RmlsZVN5c3RlbVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2luTWVtb3J5RmlsZXN5c3RlbVByb3ZpZGVyLmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IE5vdFByb21wdEZpbGUsIFJlY3Vyc2l2ZVJlZmVyZW5jZSwgT3BlbkZhaWxlZCwgRm9sZGVyUmVmZXJlbmNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3Byb21wdEZpbGVSZWZlcmVuY2VFcnJvcnMuanMnO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBmaWxlIHJlZmVyZW5jZSB3aXRoIGFuIGV4cGVjdGVkXG4gKiBlcnJvciBjb25kaXRpb24gdmFsdWUgZm9yIHRlc3RpbmcgcHVycG9zZXMuXG4gKi9cbmNsYXNzIEV4cGVjdGVkUmVmZXJlbmNlIHtcblx0LyoqXG5cdCAqIFVSSSBjb21wb25lbnQgb2YgdGhlIGV4cGVjdGVkIHJlZmVyZW5jZS5cblx0ICovXG5cdHB1YmxpYyByZWFkb25seSB1cmk6IFVSSTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRkaXJuYW1lOiBVUkksXG5cdFx0cHVibGljIHJlYWRvbmx5IGxpbmVUb2tlbjogRmlsZVJlZmVyZW5jZSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgZXJyb3JDb25kaXRpb24/OiBURXJyb3JDb25kaXRpb24sXG5cdCkge1xuXHRcdHRoaXMudXJpID0gZXh0VXJpLnJlc29sdmVQYXRoKGRpcm5hbWUsIGxpbmVUb2tlbi5wYXRoKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBTdHJpbmcgcmVwcmVzZW50YXRpb24gb2YgdGhlIGV4cGVjdGVkIHJlZmVyZW5jZS5cblx0ICovXG5cdHB1YmxpYyB0b1N0cmluZygpOiBzdHJpbmcge1xuXHRcdHJldHVybiBgZmlsZS1wcm9tcHQ6JHt0aGlzLnVyaS5wYXRofWA7XG5cdH1cbn1cblxuLyoqXG4gKiBBIHJldXNhYmxlIHRlc3QgdXRpbGl0eSB0byB0ZXN0IHRoZSBgUHJvbXB0RmlsZVJlZmVyZW5jZWAgY2xhc3MuXG4gKi9cbmNsYXNzIFRlc3RQcm9tcHRGaWxlUmVmZXJlbmNlIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZmlsZVN0cnVjdHVyZTogSU1vY2tGb2xkZXJbXSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IHJvb3RGaWxlVXJpOiBVUkksXG5cdFx0cHJpdmF0ZSByZWFkb25seSBleHBlY3RlZFJlZmVyZW5jZXM6IEV4cGVjdGVkUmVmZXJlbmNlW10sXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluaXRTZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHQvLyBjcmVhdGUgaW4tbWVtb3J5IGZpbGUgc3lzdGVtXG5cdFx0Y29uc3QgZmlsZVN5c3RlbVByb3ZpZGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEluTWVtb3J5RmlsZVN5c3RlbVByb3ZpZGVyKCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuZmlsZVNlcnZpY2UucmVnaXN0ZXJQcm92aWRlcihTY2hlbWFzLmZpbGUsIGZpbGVTeXN0ZW1Qcm92aWRlcikpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJ1biB0aGUgdGVzdC5cblx0ICovXG5cdHB1YmxpYyBhc3luYyBydW4oKSB7XG5cdFx0Ly8gY3JlYXRlIHRoZSBmaWxlcyBzdHJ1Y3R1cmUgb24gdGhlIGRpc2tcblx0XHRhd2FpdCAodGhpcy5pbml0U2VydmljZS5jcmVhdGVJbnN0YW5jZShNb2NrRmlsZXN5c3RlbSwgdGhpcy5maWxlU3RydWN0dXJlKSkubW9jaygpO1xuXG5cdFx0Ly8gcmFuZG9tbHkgdGVzdCB3aXRoIGFuZCB3aXRob3V0IGRlbGF5IHRvIGVuc3VyZSB0aGF0IHRoZSBmaWxlXG5cdFx0Ly8gcmVmZXJlbmNlIHJlc29sdXRpb24gaXMgbm90IHN1c2NlcHRpYmxlIHRvIHJhY2UgY29uZGl0aW9uc1xuXHRcdGlmIChyYW5kb21Cb29sZWFuKCkpIHtcblx0XHRcdGF3YWl0IHdhaXRSYW5kb20oNSk7XG5cdFx0fVxuXG5cdFx0Ly8gc3RhcnQgcmVzb2x2aW5nIHJlZmVyZW5jZXMgZm9yIHRoZSBzcGVjaWZpZWQgcm9vdCBmaWxlXG5cdFx0Y29uc3Qgcm9vdFJlZmVyZW5jZSA9IHRoaXMuX3JlZ2lzdGVyKFxuXHRcdFx0dGhpcy5pbml0U2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFx0RmlsZVByb21wdFBhcnNlcixcblx0XHRcdFx0dGhpcy5yb290RmlsZVVyaSxcblx0XHRcdFx0W10sXG5cdFx0XHQpLFxuXHRcdCkuc3RhcnQoKTtcblxuXHRcdC8vIHdhaXQgdW50aWwgZW50aXJlIHByb21wdHMgdHJlZSBpcyByZXNvbHZlZFxuXHRcdGF3YWl0IHJvb3RSZWZlcmVuY2UuYWxsU2V0dGxlZCgpO1xuXG5cdFx0Ly8gcmVzb2x2ZSB0aGUgcm9vdCBmaWxlIHJlZmVyZW5jZSBpbmNsdWRpbmcgYWxsIG5lc3RlZCByZWZlcmVuY2VzXG5cdFx0Y29uc3QgcmVzb2x2ZWRSZWZlcmVuY2VzOiByZWFkb25seSAoSVByb21wdFJlZmVyZW5jZSB8IHVuZGVmaW5lZClbXSA9IHJvb3RSZWZlcmVuY2UuYWxsUmVmZXJlbmNlcztcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5leHBlY3RlZFJlZmVyZW5jZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IGV4cGVjdGVkUmVmZXJlbmNlID0gdGhpcy5leHBlY3RlZFJlZmVyZW5jZXNbaV07XG5cdFx0XHRjb25zdCByZXNvbHZlZFJlZmVyZW5jZSA9IHJlc29sdmVkUmVmZXJlbmNlc1tpXTtcblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHQocmVzb2x2ZWRSZWZlcmVuY2UpICYmXG5cdFx0XHRcdChyZXNvbHZlZFJlZmVyZW5jZS51cmkudG9TdHJpbmcoKSA9PT0gZXhwZWN0ZWRSZWZlcmVuY2UudXJpLnRvU3RyaW5nKCkpLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0YEV4cGVjdGVkICR7aX10aCByZXNvbHZlZCByZWZlcmVuY2UgVVJJIHRvIGJlICcke2V4cGVjdGVkUmVmZXJlbmNlLnVyaX0nYCxcblx0XHRcdFx0XHRgZ290ICcke3Jlc29sdmVkUmVmZXJlbmNlPy51cml9Jy5gLFxuXHRcdFx0XHRdLmpvaW4oJywgJyksXG5cdFx0XHQpO1xuXG5cdFx0XHRpZiAoZXhwZWN0ZWRSZWZlcmVuY2UuZXJyb3JDb25kaXRpb24gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRhc3NlcnQoXG5cdFx0XHRcdFx0cmVzb2x2ZWRSZWZlcmVuY2UuZXJyb3JDb25kaXRpb24gPT09IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRgRXhwZWN0ZWQgJHtpfXRoIGVycm9yIGNvbmRpdGlvbiB0byBiZSAndW5kZWZpbmVkJ2AsXG5cdFx0XHRcdFx0XHRgZ290ICcke3Jlc29sdmVkUmVmZXJlbmNlLmVycm9yQ29uZGl0aW9ufScuYCxcblx0XHRcdFx0XHRdLmpvaW4oJywgJyksXG5cdFx0XHRcdCk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdGV4cGVjdGVkUmVmZXJlbmNlLmVycm9yQ29uZGl0aW9uLmVxdWFsKHJlc29sdmVkUmVmZXJlbmNlLmVycm9yQ29uZGl0aW9uKSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdGBFeHBlY3RlZCAke2l9dGggZXJyb3IgY29uZGl0aW9uIHRvIGJlICcke2V4cGVjdGVkUmVmZXJlbmNlLmVycm9yQ29uZGl0aW9ufSdgLFxuXHRcdFx0XHRcdGBnb3QgJyR7cmVzb2x2ZWRSZWZlcmVuY2UuZXJyb3JDb25kaXRpb259Jy5gLFxuXHRcdFx0XHRdLmpvaW4oJywgJyksXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHJlc29sdmVkUmVmZXJlbmNlcy5sZW5ndGgsXG5cdFx0XHR0aGlzLmV4cGVjdGVkUmVmZXJlbmNlcy5sZW5ndGgsXG5cdFx0XHRbXG5cdFx0XHRcdGBcXG5FeHBlY3RlZCgke3RoaXMuZXhwZWN0ZWRSZWZlcmVuY2VzLmxlbmd0aH0pOiBbXFxuICR7dGhpcy5leHBlY3RlZFJlZmVyZW5jZXMuam9pbignXFxuICcpfVxcbl1gLFxuXHRcdFx0XHRgUmVjZWl2ZWQoJHtyZXNvbHZlZFJlZmVyZW5jZXMubGVuZ3RofSk6IFtcXG4gJHtyZXNvbHZlZFJlZmVyZW5jZXMuam9pbignXFxuICcpfVxcbl1gLFxuXHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdCk7XG5cdH1cbn1cblxuLyoqXG4gKiBDcmVhdGUgZXhwZWN0ZWQgZmlsZSByZWZlcmVuY2UgZm9yIHRlc3RpbmcgcHVycG9zZXMuXG4gKlxuICogTm90ZSEgVGhpcyB1dGlsaXR5IGFsc28gdXNlIGZvciBgbWFya2Rvd24gbGlua3NgIGF0IHRoZSBtb21lbnQuXG4gKlxuICogQHBhcmFtIGZpbGVQYXRoIFRoZSBleHBlY3RlZCBwYXRoIG9mIHRoZSBmaWxlIHJlZmVyZW5jZSAod2l0aG91dCB0aGUgYCNmaWxlOmAgcHJlZml4KS5cbiAqIEBwYXJhbSBsaW5lTnVtYmVyIFRoZSBleHBlY3RlZCBsaW5lIG51bWJlciBvZiB0aGUgZmlsZSByZWZlcmVuY2UuXG4gKiBAcGFyYW0gc3RhcnRDb2x1bW5OdW1iZXIgVGhlIGV4cGVjdGVkIHN0YXJ0IGNvbHVtbiBudW1iZXIgb2YgdGhlIGZpbGUgcmVmZXJlbmNlLlxuICovXG5jb25zdCBjcmVhdGVUZXN0RmlsZVJlZmVyZW5jZSA9IChcblx0ZmlsZVBhdGg6IHN0cmluZyxcblx0bGluZU51bWJlcjogbnVtYmVyLFxuXHRzdGFydENvbHVtbk51bWJlcjogbnVtYmVyLFxuKTogRmlsZVJlZmVyZW5jZSA9PiB7XG5cdGNvbnN0IHJhbmdlID0gbmV3IFJhbmdlKFxuXHRcdGxpbmVOdW1iZXIsXG5cdFx0c3RhcnRDb2x1bW5OdW1iZXIsXG5cdFx0bGluZU51bWJlcixcblx0XHRzdGFydENvbHVtbk51bWJlciArIGAjZmlsZToke2ZpbGVQYXRofWAubGVuZ3RoLFxuXHQpO1xuXG5cdHJldHVybiBuZXcgRmlsZVJlZmVyZW5jZShyYW5nZSwgZmlsZVBhdGgpO1xufTtcblxuc3VpdGUoJ1Byb21wdEZpbGVSZWZlcmVuY2UgKFVuaXgpJywgZnVuY3Rpb24gKCkge1xuXHRjb25zdCB0ZXN0RGlzcG9zYWJsZXMgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRsZXQgaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZTtcblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IG51bGxQb2xpY3lTZXJ2aWNlID0gbmV3IE51bGxQb2xpY3lTZXJ2aWNlKCk7XG5cdFx0Y29uc3QgbnVsbExvZ1NlcnZpY2UgPSB0ZXN0RGlzcG9zYWJsZXMuYWRkKG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblx0XHRjb25zdCBudWxsRmlsZVNlcnZpY2UgPSB0ZXN0RGlzcG9zYWJsZXMuYWRkKG5ldyBGaWxlU2VydmljZShudWxsTG9nU2VydmljZSkpO1xuXHRcdGNvbnN0IG51bGxDb25maWdTZXJ2aWNlID0gdGVzdERpc3Bvc2FibGVzLmFkZChuZXcgQ29uZmlndXJhdGlvblNlcnZpY2UoXG5cdFx0XHRVUkkuZmlsZSgnL2NvbmZpZy5qc29uJyksXG5cdFx0XHRudWxsRmlsZVNlcnZpY2UsXG5cdFx0XHRudWxsUG9saWN5U2VydmljZSxcblx0XHRcdG51bGxMb2dTZXJ2aWNlLFxuXHRcdCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gdGVzdERpc3Bvc2FibGVzLmFkZChuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKCkpO1xuXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRmlsZVNlcnZpY2UsIG51bGxGaWxlU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTG9nU2VydmljZSwgbnVsbExvZ1NlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBudWxsQ29uZmlnU2VydmljZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiByZXNvbHZlcyBuZXN0ZWQgZmlsZSByZWZlcmVuY2VzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdHRoaXMuc2tpcCgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJvb3RGb2xkZXJOYW1lID0gJ3Jlc29sdmVzLW5lc3RlZC1maWxlLXJlZmVyZW5jZXMnO1xuXHRcdGNvbnN0IHJvb3RGb2xkZXIgPSBgLyR7cm9vdEZvbGRlck5hbWV9YDtcblx0XHRjb25zdCByb290VXJpID0gVVJJLmZpbGUocm9vdEZvbGRlcik7XG5cblx0XHRjb25zdCB0ZXN0ID0gdGVzdERpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0UHJvbXB0RmlsZVJlZmVyZW5jZSxcblx0XHRcdC8qKlxuXHRcdFx0ICogVGhlIGZpbGUgc3RydWN0dXJlIHRvIGJlIGNyZWF0ZWQgb24gdGhlIGRpc2sgZm9yIHRoZSB0ZXN0LlxuXHRcdFx0ICovXG5cdFx0XHRbe1xuXHRcdFx0XHRuYW1lOiByb290Rm9sZGVyTmFtZSxcblx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRuYW1lOiAnZmlsZTEucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnIyMgU29tZSBIZWFkZXJcXG5zb21lIGNvbnRlbnRzXFxuICcsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRuYW1lOiAnZmlsZTIucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnIyMgRmlsZXNcXG5cXHQtIHRoaXMgZmlsZSAjZmlsZTpmb2xkZXIxL2ZpbGUzLnByb21wdC5tZCBcXG5cXHQtIGFsc28gdGhpcyBbZmlsZTQucHJvbXB0Lm1kXSguL2ZvbGRlcjEvc29tZS1vdGhlci1mb2xkZXIvZmlsZTQucHJvbXB0Lm1kKSBwbGVhc2UhXFxuICcsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRuYW1lOiAnZm9sZGVyMScsXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0bmFtZTogJ2ZpbGUzLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6IGBcXG5bXSguL3NvbWUtb3RoZXItZm9sZGVyL25vbi1leGlzdGluZy1mb2xkZXIpXFxuXFx0LSBzb21lIHNlZW1pbmdseSByYW5kb20gI2ZpbGU6JHtyb290Rm9sZGVyfS9mb2xkZXIxL3NvbWUtb3RoZXItZm9sZGVyL3lldEFub3RoZXJGb2xkZXJcdUQ4M0VcdUREMkQvYW5vdGhlci1maWxlLnByb21wdC5tZCBjb250ZW50c1xcbiBzb21lIG1vcmVcXHQgY29udGVudGAsXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnc29tZS1vdGhlci1mb2xkZXInLFxuXHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdmaWxlNC5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ3RoaXMgZmlsZSBoYXMgYSBub24tZXhpc3RpbmcgI2ZpbGU6Li9zb21lLW5vbi1leGlzdGluZy9maWxlLnByb21wdC5tZFxcdFxcdHJlZmVyZW5jZVxcblxcblxcbmFuZCBzb21lXFxuIG5vbi1wcm9tcHQgI2ZpbGU6Li9zb21lLW5vbi1wcm9tcHQtZmlsZS5tZFxcdFxcdCBcXHRbXSguLi8uLi9mb2xkZXIxLylcXHQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ2ZpbGUudHh0Jyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdjb250ZW50cyBvZiBhIG5vbi1wcm9tcHQtc25pcHBldCBmaWxlJyxcblx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICd5ZXRBbm90aGVyRm9sZGVyXHVEODNFXHVERDJEJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y2hpbGRyZW46IFtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnYW5vdGhlci1maWxlLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogYFtdKCR7cm9vdEZvbGRlcn0vZm9sZGVyMS9zb21lLW90aGVyLWZvbGRlcilcXG5hbm90aGVyLWZpbGUucHJvbXB0Lm1kIGNvbnRlbnRzXFx0IFsjZmlsZTpmaWxlLnR4dF0oLi4vZmlsZS50eHQpYCxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdvbmVfbW9yZV9maWxlX2p1c3RfaW5fY2FzZS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICdvbmVfbW9yZV9maWxlX2p1c3RfaW5fY2FzZS5wcm9tcHQubWQgY29udGVudHMnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdF0sXG5cdFx0XHR9XSxcblx0XHRcdC8qKlxuXHRcdFx0ICogVGhlIHJvb3QgZmlsZSBwYXRoIHRvIHN0YXJ0IHRoZSByZXNvbHZlIHByb2Nlc3MgZnJvbS5cblx0XHRcdCAqL1xuXHRcdFx0VVJJLmZpbGUoYC8ke3Jvb3RGb2xkZXJOYW1lfS9maWxlMi5wcm9tcHQubWRgKSxcblx0XHRcdC8qKlxuXHRcdFx0ICogVGhlIGV4cGVjdGVkIHJlZmVyZW5jZXMgdG8gYmUgcmVzb2x2ZWQuXG5cdFx0XHQgKi9cblx0XHRcdFtcblx0XHRcdFx0bmV3IEV4cGVjdGVkUmVmZXJlbmNlKFxuXHRcdFx0XHRcdHJvb3RVcmksXG5cdFx0XHRcdFx0Y3JlYXRlVGVzdEZpbGVSZWZlcmVuY2UoJ2ZvbGRlcjEvZmlsZTMucHJvbXB0Lm1kJywgMiwgMTQpLFxuXHRcdFx0XHQpLFxuXHRcdFx0XHRuZXcgRXhwZWN0ZWRSZWZlcmVuY2UoXG5cdFx0XHRcdFx0VVJJLmpvaW5QYXRoKHJvb3RVcmksICcuL2ZvbGRlcjEnKSxcblx0XHRcdFx0XHRjcmVhdGVUZXN0RmlsZVJlZmVyZW5jZShcblx0XHRcdFx0XHRcdGAuL3NvbWUtb3RoZXItZm9sZGVyL25vbi1leGlzdGluZy1mb2xkZXJgLFxuXHRcdFx0XHRcdFx0Mixcblx0XHRcdFx0XHRcdDEsXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRuZXcgT3BlbkZhaWxlZChcblx0XHRcdFx0XHRcdFVSSS5qb2luUGF0aChyb290VXJpLCAnLi9mb2xkZXIxL3NvbWUtb3RoZXItZm9sZGVyL25vbi1leGlzdGluZy1mb2xkZXInKSxcblx0XHRcdFx0XHRcdCdSZWZlcmVuY2UgdG8gbm9uLWV4aXN0aW5nIGZpbGUgY2Fubm90IGJlIG9wZW5lZC4nLFxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdCksXG5cdFx0XHRcdG5ldyBFeHBlY3RlZFJlZmVyZW5jZShcblx0XHRcdFx0XHRVUkkuam9pblBhdGgocm9vdFVyaSwgJy4vZm9sZGVyMScpLFxuXHRcdFx0XHRcdGNyZWF0ZVRlc3RGaWxlUmVmZXJlbmNlKFxuXHRcdFx0XHRcdFx0YC8ke3Jvb3RGb2xkZXJOYW1lfS9mb2xkZXIxL3NvbWUtb3RoZXItZm9sZGVyL3lldEFub3RoZXJGb2xkZXJcdUQ4M0VcdUREMkQvYW5vdGhlci1maWxlLnByb21wdC5tZGAsXG5cdFx0XHRcdFx0XHQzLFxuXHRcdFx0XHRcdFx0MjYsXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0KSxcblx0XHRcdFx0bmV3IEV4cGVjdGVkUmVmZXJlbmNlKFxuXHRcdFx0XHRcdFVSSS5qb2luUGF0aChyb290VXJpLCAnLi9mb2xkZXIxL3NvbWUtb3RoZXItZm9sZGVyJyksXG5cdFx0XHRcdFx0Y3JlYXRlVGVzdEZpbGVSZWZlcmVuY2UoJy4nLCAxLCAxKSxcblx0XHRcdFx0XHRuZXcgRm9sZGVyUmVmZXJlbmNlKFxuXHRcdFx0XHRcdFx0VVJJLmpvaW5QYXRoKHJvb3RVcmksICcuL2ZvbGRlcjEvc29tZS1vdGhlci1mb2xkZXInKSxcblx0XHRcdFx0XHRcdCdUaGlzIGZvbGRlciBpcyBub3QgYSBwcm9tcHQgZmlsZSEnLFxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdCksXG5cdFx0XHRcdG5ldyBFeHBlY3RlZFJlZmVyZW5jZShcblx0XHRcdFx0XHRVUkkuam9pblBhdGgocm9vdFVyaSwgJy4vZm9sZGVyMS9zb21lLW90aGVyLWZvbGRlci95ZXRBbm90aGVyRm9sZGVyXHVEODNFXHVERDJEJyksXG5cdFx0XHRcdFx0Y3JlYXRlVGVzdEZpbGVSZWZlcmVuY2UoJy4uL2ZpbGUudHh0JywgMiwgMzUpLFxuXHRcdFx0XHRcdG5ldyBOb3RQcm9tcHRGaWxlKFxuXHRcdFx0XHRcdFx0VVJJLmpvaW5QYXRoKHJvb3RVcmksICcuL2ZvbGRlcjEvc29tZS1vdGhlci1mb2xkZXIvZmlsZS50eHQnKSxcblx0XHRcdFx0XHRcdCdVZ2hoIG9oLCB0aGF0IGlzIG5vdCBhIHByb21wdCBmaWxlIScsXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0KSxcblx0XHRcdFx0bmV3IEV4cGVjdGVkUmVmZXJlbmNlKFxuXHRcdFx0XHRcdHJvb3RVcmksXG5cdFx0XHRcdFx0Y3JlYXRlVGVzdEZpbGVSZWZlcmVuY2UoJy4vZm9sZGVyMS9zb21lLW90aGVyLWZvbGRlci9maWxlNC5wcm9tcHQubWQnLCAzLCAxNCksXG5cdFx0XHRcdCksXG5cdFx0XHRcdG5ldyBFeHBlY3RlZFJlZmVyZW5jZShcblx0XHRcdFx0XHRVUkkuam9pblBhdGgocm9vdFVyaSwgJy4vZm9sZGVyMS9zb21lLW90aGVyLWZvbGRlcicpLFxuXHRcdFx0XHRcdGNyZWF0ZVRlc3RGaWxlUmVmZXJlbmNlKCcuL3NvbWUtbm9uLWV4aXN0aW5nL2ZpbGUucHJvbXB0Lm1kJywgMSwgMzApLFxuXHRcdFx0XHRcdG5ldyBPcGVuRmFpbGVkKFxuXHRcdFx0XHRcdFx0VVJJLmpvaW5QYXRoKHJvb3RVcmksICcuL2ZvbGRlcjEvc29tZS1vdGhlci1mb2xkZXIvc29tZS1ub24tZXhpc3RpbmcvZmlsZS5wcm9tcHQubWQnKSxcblx0XHRcdFx0XHRcdCdGYWlsZWQgdG8gb3BlbiBub24tZXhpc3RyaW5nIHByb21wdCBzbmlwcGV0cyBmaWxlJyxcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHQpLFxuXHRcdFx0XHRuZXcgRXhwZWN0ZWRSZWZlcmVuY2UoXG5cdFx0XHRcdFx0VVJJLmpvaW5QYXRoKHJvb3RVcmksICcuL2ZvbGRlcjEvc29tZS1vdGhlci1mb2xkZXInKSxcblx0XHRcdFx0XHRjcmVhdGVUZXN0RmlsZVJlZmVyZW5jZSgnLi9zb21lLW5vbi1wcm9tcHQtZmlsZS5tZCcsIDUsIDEzKSxcblx0XHRcdFx0XHRuZXcgT3BlbkZhaWxlZChcblx0XHRcdFx0XHRcdFVSSS5qb2luUGF0aChyb290VXJpLCAnLi9mb2xkZXIxL3NvbWUtb3RoZXItZm9sZGVyL3NvbWUtbm9uLXByb21wdC1maWxlLm1kJyksXG5cdFx0XHRcdFx0XHQnT2ggbm8hJyxcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHQpLFxuXHRcdFx0XHRuZXcgRXhwZWN0ZWRSZWZlcmVuY2UoXG5cdFx0XHRcdFx0VVJJLmpvaW5QYXRoKHJvb3RVcmksICcuL3NvbWUtb3RoZXItZm9sZGVyL2ZvbGRlcjEnKSxcblx0XHRcdFx0XHRjcmVhdGVUZXN0RmlsZVJlZmVyZW5jZSgnLi4vLi4vZm9sZGVyMScsIDUsIDQ4KSxcblx0XHRcdFx0XHRuZXcgRm9sZGVyUmVmZXJlbmNlKFxuXHRcdFx0XHRcdFx0VVJJLmpvaW5QYXRoKHJvb3RVcmksICcuL2ZvbGRlcjEnKSxcblx0XHRcdFx0XHRcdCdVZ2doIG9oaCEnLFxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdCksXG5cdFx0XHRdXG5cdFx0KSk7XG5cblx0XHRhd2FpdCB0ZXN0LnJ1bigpO1xuXHR9KTtcblxuXHR0ZXN0KCdcdTIwMjIgZG9lcyBub3QgZmFsbCBpbnRvIGluZmluaXRlIHJlZmVyZW5jZSByZWN1cnNpb24nLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0aWYgKGlzV2luZG93cykge1xuXHRcdFx0dGhpcy5za2lwKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgcm9vdEZvbGRlck5hbWUgPSAnaW5maW5pdGUtcmVjdXJzaW9uJztcblx0XHRjb25zdCByb290Rm9sZGVyID0gYC8ke3Jvb3RGb2xkZXJOYW1lfWA7XG5cdFx0Y29uc3Qgcm9vdFVyaSA9IFVSSS5maWxlKHJvb3RGb2xkZXIpO1xuXG5cdFx0Y29uc3QgdGVzdCA9IHRlc3REaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFByb21wdEZpbGVSZWZlcmVuY2UsXG5cdFx0XHQvKipcblx0XHRcdCAqIFRoZSBmaWxlIHN0cnVjdHVyZSB0byBiZSBjcmVhdGVkIG9uIHRoZSBkaXNrIGZvciB0aGUgdGVzdC5cblx0XHRcdCAqL1xuXHRcdFx0W3tcblx0XHRcdFx0bmFtZTogcm9vdEZvbGRlck5hbWUsXG5cdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bmFtZTogJ2ZpbGUxLm1kJyxcblx0XHRcdFx0XHRcdGNvbnRlbnRzOiAnIyMgU29tZSBIZWFkZXJcXG5zb21lIGNvbnRlbnRzXFxuICcsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRuYW1lOiAnZmlsZTIucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdGNvbnRlbnRzOiBgIyMgRmlsZXNcXG5cXHQtIHRoaXMgZmlsZSAjZmlsZTpmb2xkZXIxL2ZpbGUzLnByb21wdC5tZCBcXG5cXHQtIGFsc28gdGhpcyAjZmlsZTouL2ZvbGRlcjEvc29tZS1vdGhlci1mb2xkZXIvZmlsZTQucHJvbXB0Lm1kXFxuXFxuI2ZpbGU6JHtyb290Rm9sZGVyfS9mb2xkZXIxL3NvbWUtb3RoZXItZm9sZGVyL2ZpbGU1LnByb21wdC5tZFxcdCBwbGVhc2UhXFxuXFx0W3NvbWUgKHNuaXBwZXQhKSAjbmFtZSkpXSguL2ZpbGUxLm1kKWAsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRuYW1lOiAnZm9sZGVyMScsXG5cdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0bmFtZTogJ2ZpbGUzLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6IGBcXG5cXG5cXHQtIHNvbWUgc2VlbWluZ2x5IHJhbmRvbSBbYW5vdGhlci1maWxlLnByb21wdC5tZF0oJHtyb290Rm9sZGVyfS9mb2xkZXIxL3NvbWUtb3RoZXItZm9sZGVyL3lldEFub3RoZXJGb2xkZXJcdUQ4M0VcdUREMkQvYW5vdGhlci1maWxlLnByb21wdC5tZCkgY29udGVudHNcXG4gc29tZSBtb3JlXFx0IGNvbnRlbnRgLFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0bmFtZTogJ3NvbWUtb3RoZXItZm9sZGVyJyxcblx0XHRcdFx0XHRcdFx0XHRjaGlsZHJlbjogW1xuXHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAnZmlsZTQucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6ICd0aGlzIGZpbGUgaGFzIGEgbm9uLWV4aXN0aW5nICNmaWxlOi4uL3NvbWUtbm9uLWV4aXN0aW5nL2ZpbGUucHJvbXB0Lm1kXFx0XFx0cmVmZXJlbmNlJyxcblx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdG5hbWU6ICdmaWxlNS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ3RoaXMgZmlsZSBoYXMgYSByZWxhdGl2ZSByZWN1cnNpdmUgI2ZpbGU6Li4vLi4vZmlsZTIucHJvbXB0Lm1kXFxucmVmZXJlbmNlXFxuICcsXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiAneWV0QW5vdGhlckZvbGRlclx1RDgzRVx1REQyRCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNoaWxkcmVuOiBbXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ2Fub3RoZXItZmlsZS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Ly8gYWJzb2x1dGUgcGF0aCB3aXRoIHJlY3Vyc2lvblxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29udGVudHM6IGBzb21lIHRlc3QgZ29lc1xcdFxcbmhlcmUgI2ZpbGU6JHtyb290Rm9sZGVyfS9maWxlMi5wcm9tcHQubWRgLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0bmFtZTogJ29uZV9tb3JlX2ZpbGVfanVzdF9pbl9jYXNlLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHRjb250ZW50czogJ29uZV9tb3JlX2ZpbGVfanVzdF9pbl9jYXNlLnByb21wdC5tZCBjb250ZW50cycsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSxcblx0XHRcdH1dLFxuXHRcdFx0LyoqXG5cdFx0XHQgKiBUaGUgcm9vdCBmaWxlIHBhdGggdG8gc3RhcnQgdGhlIHJlc29sdmUgcHJvY2VzcyBmcm9tLlxuXHRcdFx0ICovXG5cdFx0XHRVUkkuZmlsZShgLyR7cm9vdEZvbGRlck5hbWV9L2ZpbGUyLnByb21wdC5tZGApLFxuXHRcdFx0LyoqXG5cdFx0XHQgKiBUaGUgZXhwZWN0ZWQgcmVmZXJlbmNlcyB0byBiZSByZXNvbHZlZC5cblx0XHRcdCAqL1xuXHRcdFx0W1xuXHRcdFx0XHRuZXcgRXhwZWN0ZWRSZWZlcmVuY2UoXG5cdFx0XHRcdFx0cm9vdFVyaSxcblx0XHRcdFx0XHRjcmVhdGVUZXN0RmlsZVJlZmVyZW5jZSgnZm9sZGVyMS9maWxlMy5wcm9tcHQubWQnLCAyLCA5KSxcblx0XHRcdFx0KSxcblx0XHRcdFx0bmV3IEV4cGVjdGVkUmVmZXJlbmNlKFxuXHRcdFx0XHRcdFVSSS5qb2luUGF0aChyb290VXJpLCAnLi9mb2xkZXIxJyksXG5cdFx0XHRcdFx0Y3JlYXRlVGVzdEZpbGVSZWZlcmVuY2UoXG5cdFx0XHRcdFx0XHRgJHtyb290Rm9sZGVyfS9mb2xkZXIxL3NvbWUtb3RoZXItZm9sZGVyL3lldEFub3RoZXJGb2xkZXJcdUQ4M0VcdUREMkQvYW5vdGhlci1maWxlLnByb21wdC5tZGAsXG5cdFx0XHRcdFx0XHQzLFxuXHRcdFx0XHRcdFx0MjMsXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0KSxcblx0XHRcdFx0LyoqXG5cdFx0XHRcdCAqIFRoaXMgcmVmZXJlbmNlIHNob3VsZCBiZSByZXNvbHZlZCB3aXRoIGEgcmVjdXJzaXZlXG5cdFx0XHRcdCAqIHJlZmVyZW5jZSBlcnJvciBjb25kaXRpb24uICh0aGUgYWJzb2x1dGUgcmVmZXJlbmNlIGNhc2UpXG5cdFx0XHRcdCAqL1xuXHRcdFx0XHRuZXcgRXhwZWN0ZWRSZWZlcmVuY2UoXG5cdFx0XHRcdFx0VVJJLmpvaW5QYXRoKHJvb3RVcmksICcuL2ZvbGRlcjEvc29tZS1vdGhlci1mb2xkZXIveWV0QW5vdGhlckZvbGRlclx1RDgzRVx1REQyRCcpLFxuXHRcdFx0XHRcdGNyZWF0ZVRlc3RGaWxlUmVmZXJlbmNlKGAke3Jvb3RGb2xkZXJ9L2ZpbGUyLnByb21wdC5tZGAsIDIsIDYpLFxuXHRcdFx0XHRcdG5ldyBSZWN1cnNpdmVSZWZlcmVuY2UoXG5cdFx0XHRcdFx0XHRVUkkuam9pblBhdGgocm9vdFVyaSwgJy4vZmlsZTIucHJvbXB0Lm1kJyksXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdCcvaW5maW5pdGUtcmVjdXJzaW9uL2ZpbGUyLnByb21wdC5tZCcsXG5cdFx0XHRcdFx0XHRcdCcvaW5maW5pdGUtcmVjdXJzaW9uL2ZvbGRlcjEvZmlsZTMucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9pbmZpbml0ZS1yZWN1cnNpb24vZm9sZGVyMS9zb21lLW90aGVyLWZvbGRlci95ZXRBbm90aGVyRm9sZGVyXHVEODNFXHVERDJEL2Fub3RoZXItZmlsZS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL2luZmluaXRlLXJlY3Vyc2lvbi9maWxlMi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHQpLFxuXHRcdFx0XHRuZXcgRXhwZWN0ZWRSZWZlcmVuY2UoXG5cdFx0XHRcdFx0cm9vdFVyaSxcblx0XHRcdFx0XHRjcmVhdGVUZXN0RmlsZVJlZmVyZW5jZSgnLi9mb2xkZXIxL3NvbWUtb3RoZXItZm9sZGVyL2ZpbGU0LnByb21wdC5tZCcsIDMsIDE0KSxcblx0XHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdCksXG5cdFx0XHRcdG5ldyBFeHBlY3RlZFJlZmVyZW5jZShcblx0XHRcdFx0XHRVUkkuam9pblBhdGgocm9vdFVyaSwgJy4vZm9sZGVyMS9zb21lLW90aGVyLWZvbGRlcicpLFxuXHRcdFx0XHRcdGNyZWF0ZVRlc3RGaWxlUmVmZXJlbmNlKCcuLi9zb21lLW5vbi1leGlzdGluZy9maWxlLnByb21wdC5tZCcsIDEsIDMwKSxcblx0XHRcdFx0XHRuZXcgT3BlbkZhaWxlZChcblx0XHRcdFx0XHRcdFVSSS5qb2luUGF0aChyb290VXJpLCAnLi9mb2xkZXIxL3NvbWUtbm9uLWV4aXN0aW5nL2ZpbGUucHJvbXB0Lm1kJyksXG5cdFx0XHRcdFx0XHQnVWdnaCBvaGghJyxcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHQpLFxuXHRcdFx0XHRuZXcgRXhwZWN0ZWRSZWZlcmVuY2UoXG5cdFx0XHRcdFx0cm9vdFVyaSxcblx0XHRcdFx0XHRjcmVhdGVUZXN0RmlsZVJlZmVyZW5jZShcblx0XHRcdFx0XHRcdGAke3Jvb3RGb2xkZXJ9L2ZvbGRlcjEvc29tZS1vdGhlci1mb2xkZXIvZmlsZTUucHJvbXB0Lm1kYCxcblx0XHRcdFx0XHRcdDUsXG5cdFx0XHRcdFx0XHQxLFxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHQpLFxuXHRcdFx0XHQvKipcblx0XHRcdFx0ICogVGhpcyByZWZlcmVuY2Ugc2hvdWxkIGJlIHJlc29sdmVkIHdpdGggYSByZWN1cnNpdmVcblx0XHRcdFx0ICogcmVmZXJlbmNlIGVycm9yIGNvbmRpdGlvbi4gKHRoZSByZWxhdGl2ZSByZWZlcmVuY2UgY2FzZSlcblx0XHRcdFx0ICovXG5cdFx0XHRcdG5ldyBFeHBlY3RlZFJlZmVyZW5jZShcblx0XHRcdFx0XHRVUkkuam9pblBhdGgocm9vdFVyaSwgJy4vZm9sZGVyMS9zb21lLW90aGVyLWZvbGRlcicpLFxuXHRcdFx0XHRcdGNyZWF0ZVRlc3RGaWxlUmVmZXJlbmNlKCcuLi8uLi9maWxlMi5wcm9tcHQubWQnLCAxLCAzNiksXG5cdFx0XHRcdFx0bmV3IFJlY3Vyc2l2ZVJlZmVyZW5jZShcblx0XHRcdFx0XHRcdFVSSS5qb2luUGF0aChyb290VXJpLCAnLi9maWxlMi5wcm9tcHQubWQnKSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0Jy9pbmZpbml0ZS1yZWN1cnNpb24vZmlsZTIucHJvbXB0Lm1kJyxcblx0XHRcdFx0XHRcdFx0Jy9pbmZpbml0ZS1yZWN1cnNpb24vZm9sZGVyMS9zb21lLW90aGVyLWZvbGRlci9maWxlNS5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XHQnL2luZmluaXRlLXJlY3Vyc2lvbi9maWxlMi5wcm9tcHQubWQnLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHQpLFxuXHRcdFx0XHRuZXcgRXhwZWN0ZWRSZWZlcmVuY2UoXG5cdFx0XHRcdFx0cm9vdFVyaSxcblx0XHRcdFx0XHRjcmVhdGVUZXN0RmlsZVJlZmVyZW5jZSgnLi9maWxlMS5tZCcsIDYsIDIpLFxuXHRcdFx0XHRcdG5ldyBOb3RQcm9tcHRGaWxlKFxuXHRcdFx0XHRcdFx0VVJJLmpvaW5QYXRoKHJvb3RVcmksICcuL2ZpbGUxLm1kJyksXG5cdFx0XHRcdFx0XHQnVWdnaCBvaCEnLFxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdCksXG5cdFx0XHRdXG5cdFx0KSk7XG5cblx0XHRhd2FpdCB0ZXN0LnJ1bigpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGNBQWM7QUFDdkIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQXNCLHNCQUFzQjtBQUM1QyxTQUFTLG9CQUFvQjtBQUU3QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGFBQWEsc0JBQXNCO0FBRTVDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsWUFBWSxxQkFBcUI7QUFDMUMsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxlQUFlLG9CQUFvQixZQUFZLHVCQUF1QjtBQU0vRSxNQUFNLGtCQUFrQjtBQUFBLEVBTXZCLFlBQ0MsU0FDZ0IsV0FDQSxnQkFDZjtBQUZlO0FBQ0E7QUFFaEIsU0FBSyxNQUFNLE9BQU8sWUFBWSxTQUFTLFVBQVUsSUFBSTtBQUFBLEVBQ3REO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLTyxXQUFtQjtBQUN6QixXQUFPLGVBQWUsS0FBSyxJQUFJLElBQUk7QUFBQSxFQUNwQztB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LFNBQVMsV0FBVztBQUFBLFVBQ2pDO0FBQUEsWUFDQyxHQUFHLFVBQVU7QUFBQSxZQUNiO0FBQUEsWUFDQTtBQUFBLFVBQ0Q7QUFBQSxRQUNEO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxRQUtBLElBQUk7QUFBQSxVQUNILElBQUksU0FBUyxTQUFTLHVEQUFnRDtBQUFBLFVBQ3RFLHdCQUF3QixHQUFHLFVBQVUsb0JBQW9CLEdBQUcsQ0FBQztBQUFBLFVBQzdELElBQUk7QUFBQSxZQUNILElBQUksU0FBUyxTQUFTLG1CQUFtQjtBQUFBLFlBQ3pDO0FBQUEsY0FDQztBQUFBLGNBQ0E7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLFlBQ0Q7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLFFBQ0EsSUFBSTtBQUFBLFVBQ0g7QUFBQSxVQUNBLHdCQUF3QiwrQ0FBK0MsR0FBRyxFQUFFO0FBQUEsVUFDNUU7QUFBQSxRQUNEO0FBQUEsUUFDQSxJQUFJO0FBQUEsVUFDSCxJQUFJLFNBQVMsU0FBUyw2QkFBNkI7QUFBQSxVQUNuRCx3QkFBd0IsdUNBQXVDLEdBQUcsRUFBRTtBQUFBLFVBQ3BFLElBQUk7QUFBQSxZQUNILElBQUksU0FBUyxTQUFTLDRDQUE0QztBQUFBLFlBQ2xFO0FBQUEsVUFDRDtBQUFBLFFBQ0Q7QUFBQSxRQUNBLElBQUk7QUFBQSxVQUNIO0FBQUEsVUFDQTtBQUFBLFlBQ0MsR0FBRyxVQUFVO0FBQUEsWUFDYjtBQUFBLFlBQ0E7QUFBQSxVQUNEO0FBQUEsVUFDQTtBQUFBLFFBQ0Q7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLFFBS0EsSUFBSTtBQUFBLFVBQ0gsSUFBSSxTQUFTLFNBQVMsNkJBQTZCO0FBQUEsVUFDbkQsd0JBQXdCLHlCQUF5QixHQUFHLEVBQUU7QUFBQSxVQUN0RCxJQUFJO0FBQUEsWUFDSCxJQUFJLFNBQVMsU0FBUyxtQkFBbUI7QUFBQSxZQUN6QztBQUFBLGNBQ0M7QUFBQSxjQUNBO0FBQUEsY0FDQTtBQUFBLFlBQ0Q7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLFFBQ0EsSUFBSTtBQUFBLFVBQ0g7QUFBQSxVQUNBLHdCQUF3QixjQUFjLEdBQUcsQ0FBQztBQUFBLFVBQzFDLElBQUk7QUFBQSxZQUNILElBQUksU0FBUyxTQUFTLFlBQVk7QUFBQSxZQUNsQztBQUFBLFVBQ0Q7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUVELFVBQU1BLE1BQUssSUFBSTtBQUFBLEVBQ2hCLENBQUM7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJ0ZXN0Il0KfQo=
