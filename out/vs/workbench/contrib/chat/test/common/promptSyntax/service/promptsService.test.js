import assert from "assert";
import { createURI } from "../testUtils/createUri.js";
import { URI } from "../../../../../../../base/common/uri.js";
import { Range } from "../../../../../../../editor/common/core/range.js";
import { assertDefined } from "../../../../../../../base/common/types.js";
import { waitRandom } from "../../../../../../../base/test/common/testUtils.js";
import { IFileService } from "../../../../../../../platform/files/common/files.js";
import { FileService } from "../../../../../../../platform/files/common/fileService.js";
import { createTextModel } from "../../../../../../../editor/test/common/testTextModel.js";
import { ILogService, NullLogService } from "../../../../../../../platform/log/common/log.js";
import { PromptsService } from "../../../../common/promptSyntax/service/promptsService.js";
import { TextModelPromptParser } from "../../../../common/promptSyntax/parsers/textModelPromptParser.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../../base/test/common/utils.js";
import { IConfigurationService } from "../../../../../../../platform/configuration/common/configuration.js";
import { TestInstantiationService } from "../../../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { TestConfigurationService } from "../../../../../../../platform/configuration/test/common/testConfigurationService.js";
class ExpectedLink {
  constructor(uri, fullRange, linkRange) {
    this.uri = uri;
    this.fullRange = fullRange;
    this.linkRange = linkRange;
  }
  /**
   * Assert a provided link has the same properties as this object.
   */
  assertEqual(link) {
    assert.strictEqual(
      link.type,
      "file",
      "Link must have correct type."
    );
    assert.strictEqual(
      link.uri.toString(),
      this.uri.toString(),
      "Link must have correct URI."
    );
    assert(
      this.fullRange.equalsRange(link.range),
      `Full range must be '${this.fullRange}', got '${link.range}'.`
    );
    assertDefined(
      link.linkRange,
      "Link must have a link range."
    );
    assert(
      this.linkRange.equalsRange(link.linkRange),
      `Link range must be '${this.linkRange}', got '${link.linkRange}'.`
    );
  }
}
const assertLinks = (links, expectedLinks) => {
  for (let i = 0; i < links.length; i++) {
    try {
      expectedLinks[i].assertEqual(links[i]);
    } catch (error) {
      throw new Error(`link#${i}: ${error}`);
    }
  }
  assert.strictEqual(
    links.length,
    expectedLinks.length,
    `Links count must be correct.`
  );
};
suite("PromptsService", () => {
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  let service;
  let instantiationService;
  setup(async () => {
    instantiationService = disposables.add(new TestInstantiationService());
    instantiationService.stub(ILogService, new NullLogService());
    instantiationService.stub(IConfigurationService, new TestConfigurationService());
    instantiationService.stub(IFileService, disposables.add(instantiationService.createInstance(FileService)));
    service = disposables.add(instantiationService.createInstance(PromptsService));
  });
  suite("\u2022 getParserFor", () => {
    test("\u2022 provides cached parser instance", async () => {
      const langId = "fooLang";
      const model1 = disposables.add(createTextModel(
        "test1\n	#file:./file.md\n\n\n   [bin file](/root/tmp.bin)	\n",
        langId,
        void 0,
        createURI("/Users/vscode/repos/test/file1.txt")
      ));
      const parser1 = service.getSyntaxParserFor(model1);
      assert.strictEqual(
        parser1.uri.toString(),
        model1.uri.toString(),
        "Must create parser1 with the correct URI."
      );
      assert(
        !parser1.disposed,
        "Parser1 must not be disposed."
      );
      assert(
        parser1 instanceof TextModelPromptParser,
        "Parser1 must be an instance of TextModelPromptParser."
      );
      await parser1.settled();
      assertLinks(
        parser1.allReferences,
        [
          new ExpectedLink(
            createURI("/Users/vscode/repos/test/file.md"),
            new Range(2, 2, 2, 2 + 15),
            new Range(2, 8, 2, 8 + 9)
          ),
          new ExpectedLink(
            createURI("/root/tmp.bin"),
            new Range(5, 4, 5, 4 + 25),
            new Range(5, 15, 5, 15 + 13)
          )
        ]
      );
      await waitRandom(5);
      const parser1_1 = service.getSyntaxParserFor(model1);
      assert.strictEqual(
        parser1,
        parser1_1,
        "Must return the same parser object."
      );
      assert.strictEqual(
        parser1_1.uri.toString(),
        model1.uri.toString(),
        "Must create parser1_1 with the correct URI."
      );
      const model2 = disposables.add(createTextModel(
        "some text #file:/absolute/path.txt  	\ntest-text2",
        langId,
        void 0,
        createURI("/Users/vscode/repos/test/some-folder/file.md")
      ));
      await waitRandom(5);
      const parser2 = service.getSyntaxParserFor(model2);
      assert.strictEqual(
        parser2.uri.toString(),
        model2.uri.toString(),
        "Must create parser2 with the correct URI."
      );
      assert(
        !parser2.disposed,
        "Parser2 must not be disposed."
      );
      assert(
        parser2 instanceof TextModelPromptParser,
        "Parser2 must be an instance of TextModelPromptParser."
      );
      assert(
        !parser2.disposed,
        "Parser2 must not be disposed."
      );
      assert(
        !parser1.disposed,
        "Parser1 must not be disposed."
      );
      assert(
        !parser1_1.disposed,
        "Parser1_1 must not be disposed."
      );
      await parser2.settled();
      assert.notStrictEqual(
        parser1.uri.toString(),
        parser2.uri.toString(),
        "Parser2 must have its own URI."
      );
      assertLinks(
        parser2.allReferences,
        [
          new ExpectedLink(
            createURI("/absolute/path.txt"),
            new Range(1, 11, 1, 11 + 24),
            new Range(1, 17, 1, 17 + 18)
          )
        ]
      );
      await parser1_1.settled();
      assertLinks(
        parser1_1.allReferences,
        [
          new ExpectedLink(
            createURI("/Users/vscode/repos/test/file.md"),
            new Range(2, 2, 2, 2 + 15),
            new Range(2, 8, 2, 8 + 9)
          ),
          new ExpectedLink(
            createURI("/root/tmp.bin"),
            new Range(5, 4, 5, 4 + 25),
            new Range(5, 15, 5, 15 + 13)
          )
        ]
      );
      await waitRandom(5);
      parser1.dispose();
      assert(
        parser1.disposed,
        "Parser1 must be disposed."
      );
      assert(
        parser1_1.disposed,
        "Parser1_1 must be disposed."
      );
      assert(
        !parser2.disposed,
        "Parser2 must not be disposed."
      );
      const parser1_2 = service.getSyntaxParserFor(model1);
      assert(
        !parser1_2.disposed,
        "Parser1_2 must not be disposed."
      );
      assert.notStrictEqual(
        parser1_2,
        parser1,
        "Must create a new parser object for the model1."
      );
      assert.strictEqual(
        parser1_2.uri.toString(),
        model1.uri.toString(),
        "Must create parser1_2 with the correct URI."
      );
      await parser1_2.settled();
      assertLinks(
        parser1_2.allReferences,
        [
          new ExpectedLink(
            createURI("/Users/vscode/repos/test/file.md"),
            new Range(2, 2, 2, 2 + 15),
            new Range(2, 8, 2, 8 + 9)
          ),
          new ExpectedLink(
            createURI("/root/tmp.bin"),
            new Range(5, 4, 5, 4 + 25),
            new Range(5, 15, 5, 15 + 13)
          )
        ]
      );
      await waitRandom(5);
      model2.dispose();
      assert(
        parser2.disposed,
        "Parser2 must be disposed."
      );
      assert(
        !parser1_2.disposed,
        "Parser1_2 must not be disposed."
      );
      const model2_1 = disposables.add(createTextModel(
        "some text #file:/absolute/path.txt  \n [caption](.copilot/prompts/test.prompt.md)	\n	\n more text",
        langId,
        void 0,
        createURI("/Users/vscode/repos/test/some-folder/file.md")
      ));
      const parser2_1 = service.getSyntaxParserFor(model2_1);
      assert(
        !parser2_1.disposed,
        "Parser2_1 must not be disposed."
      );
      assert.notStrictEqual(
        parser2_1,
        parser2,
        "Parser2_1 must be a new object."
      );
      assert.strictEqual(
        parser2_1.uri.toString(),
        model2.uri.toString(),
        "Must create parser2_1 with the correct URI."
      );
      await parser2_1.settled();
      assertLinks(
        parser2_1.allReferences,
        [
          // the first link didn't change
          new ExpectedLink(
            createURI("/absolute/path.txt"),
            new Range(1, 11, 1, 11 + 24),
            new Range(1, 17, 1, 17 + 18)
          ),
          // the second link is new
          new ExpectedLink(
            createURI("/Users/vscode/repos/test/some-folder/.copilot/prompts/test.prompt.md"),
            new Range(2, 2, 2, 2 + 42),
            new Range(2, 12, 2, 12 + 31)
          )
        ]
      );
    });
    test("\u2022 auto-updated on model changes", async () => {
      const langId = "bazLang";
      const model = disposables.add(createTextModel(
        " 	 #file:../file.md\ntest1\n	\n  [another file](/Users/root/tmp/file2.txt)	\n",
        langId,
        void 0,
        createURI("/repos/test/file1.txt")
      ));
      const parser = service.getSyntaxParserFor(model);
      assert(
        !parser.disposed,
        "Parser must not be disposed."
      );
      assert(
        parser instanceof TextModelPromptParser,
        "Parser must be an instance of TextModelPromptParser."
      );
      await parser.settled();
      assertLinks(
        parser.allReferences,
        [
          new ExpectedLink(
            createURI("/repos/file.md"),
            new Range(1, 4, 1, 4 + 16),
            new Range(1, 10, 1, 10 + 10)
          ),
          new ExpectedLink(
            createURI("/Users/root/tmp/file2.txt"),
            new Range(4, 3, 4, 3 + 41),
            new Range(4, 18, 4, 18 + 25)
          )
        ]
      );
      model.applyEdits([
        {
          range: new Range(4, 18, 4, 18 + 25),
          text: "/Users/root/tmp/file3.txt"
        }
      ]);
      await parser.settled();
      assertLinks(
        parser.allReferences,
        [
          // link1 didn't change
          new ExpectedLink(
            createURI("/repos/file.md"),
            new Range(1, 4, 1, 4 + 16),
            new Range(1, 10, 1, 10 + 10)
          ),
          // link2 changed in the file name only
          new ExpectedLink(
            createURI("/Users/root/tmp/file3.txt"),
            new Range(4, 3, 4, 3 + 41),
            new Range(4, 18, 4, 18 + 25)
          )
        ]
      );
    });
    test("\u2022 throws if disposed model provided", async function() {
      const model = disposables.add(createTextModel(
        "test1\ntest2\n\ntest3	\n",
        "barLang",
        void 0,
        URI.parse("./github/prompts/file.prompt.md")
      ));
      model.dispose();
      assert.throws(() => {
        service.getSyntaxParserFor(model);
      }, "Cannot create a prompt parser for a disposed model.");
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL3Byb21wdFN5bnRheC9zZXJ2aWNlL3Byb21wdHNTZXJ2aWNlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBjcmVhdGVVUkkgfSBmcm9tICcuLi90ZXN0VXRpbHMvY3JlYXRlVXJpLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBhc3NlcnREZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgd2FpdFJhbmRvbSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdGVzdFV0aWxzLmpzJztcbmltcG9ydCB7IElQcm9tcHRzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9wcm9tcHRTeW50YXgvc2VydmljZS90eXBlcy5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSVByb21wdEZpbGVSZWZlcmVuY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vcHJvbXB0U3ludGF4L3BhcnNlcnMvdHlwZXMuanMnO1xuaW1wb3J0IHsgRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgY3JlYXRlVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL3Rlc3QvY29tbW9uL3Rlc3RUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UsIE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgUHJvbXB0c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vcHJvbXB0U3ludGF4L3NlcnZpY2UvcHJvbXB0c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGV4dE1vZGVsUHJvbXB0UGFyc2VyIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3Byb21wdFN5bnRheC9wYXJzZXJzL3RleHRNb2RlbFByb21wdFBhcnNlci5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuXG4vKipcbiAqIEhlbHBlciBjbGFzcyB0byBhc3NlcnQgdGhlIHByb3BlcnRpZXMgb2YgYSBsaW5rLlxuICovXG5jbGFzcyBFeHBlY3RlZExpbmsge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgdXJpOiBVUkksXG5cdFx0cHVibGljIHJlYWRvbmx5IGZ1bGxSYW5nZTogUmFuZ2UsXG5cdFx0cHVibGljIHJlYWRvbmx5IGxpbmtSYW5nZTogUmFuZ2UsXG5cdCkgeyB9XG5cblx0LyoqXG5cdCAqIEFzc2VydCBhIHByb3ZpZGVkIGxpbmsgaGFzIHRoZSBzYW1lIHByb3BlcnRpZXMgYXMgdGhpcyBvYmplY3QuXG5cdCAqL1xuXHRwdWJsaWMgYXNzZXJ0RXF1YWwobGluazogSVByb21wdEZpbGVSZWZlcmVuY2UpIHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRsaW5rLnR5cGUsXG5cdFx0XHQnZmlsZScsXG5cdFx0XHQnTGluayBtdXN0IGhhdmUgY29ycmVjdCB0eXBlLicsXG5cdFx0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdGxpbmsudXJpLnRvU3RyaW5nKCksXG5cdFx0XHR0aGlzLnVyaS50b1N0cmluZygpLFxuXHRcdFx0J0xpbmsgbXVzdCBoYXZlIGNvcnJlY3QgVVJJLicsXG5cdFx0KTtcblxuXHRcdGFzc2VydChcblx0XHRcdHRoaXMuZnVsbFJhbmdlLmVxdWFsc1JhbmdlKGxpbmsucmFuZ2UpLFxuXHRcdFx0YEZ1bGwgcmFuZ2UgbXVzdCBiZSAnJHt0aGlzLmZ1bGxSYW5nZX0nLCBnb3QgJyR7bGluay5yYW5nZX0nLmAsXG5cdFx0KTtcblxuXHRcdGFzc2VydERlZmluZWQoXG5cdFx0XHRsaW5rLmxpbmtSYW5nZSxcblx0XHRcdCdMaW5rIG11c3QgaGF2ZSBhIGxpbmsgcmFuZ2UuJyxcblx0XHQpO1xuXG5cdFx0YXNzZXJ0KFxuXHRcdFx0dGhpcy5saW5rUmFuZ2UuZXF1YWxzUmFuZ2UobGluay5saW5rUmFuZ2UpLFxuXHRcdFx0YExpbmsgcmFuZ2UgbXVzdCBiZSAnJHt0aGlzLmxpbmtSYW5nZX0nLCBnb3QgJyR7bGluay5saW5rUmFuZ2V9Jy5gLFxuXHRcdCk7XG5cdH1cbn1cblxuLyoqXG4gKiBBc3NlcnRzIHRoYXQgcHJvdmlkZWQgbGlua3MgYXJlIGVxdWFsIHRvIHRoZSBleHBlY3RlZCBsaW5rcy5cbiAqIEBwYXJhbSBsaW5rcyBMaW5rcyB0byBhc3NlcnQuXG4gKiBAcGFyYW0gZXhwZWN0ZWRMaW5rcyBFeHBlY3RlZCBsaW5rcyB0byBjb21wYXJlIGFnYWluc3QuXG4gKi9cbmNvbnN0IGFzc2VydExpbmtzID0gKFxuXHRsaW5rczogcmVhZG9ubHkgSVByb21wdEZpbGVSZWZlcmVuY2VbXSxcblx0ZXhwZWN0ZWRMaW5rczogcmVhZG9ubHkgRXhwZWN0ZWRMaW5rW10sXG4pID0+IHtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsaW5rcy5sZW5ndGg7IGkrKykge1xuXHRcdHRyeSB7XG5cdFx0XHRleHBlY3RlZExpbmtzW2ldLmFzc2VydEVxdWFsKGxpbmtzW2ldKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBsaW5rIyR7aX06ICR7ZXJyb3J9YCk7XG5cdFx0fVxuXHR9XG5cblx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdGxpbmtzLmxlbmd0aCxcblx0XHRleHBlY3RlZExpbmtzLmxlbmd0aCxcblx0XHRgTGlua3MgY291bnQgbXVzdCBiZSBjb3JyZWN0LmAsXG5cdCk7XG59O1xuXG5zdWl0ZSgnUHJvbXB0c1NlcnZpY2UnLCAoKSA9PiB7XG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0bGV0IHNlcnZpY2U6IElQcm9tcHRzU2VydmljZTtcblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UoKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTG9nU2VydmljZSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUZpbGVTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRmlsZVNlcnZpY2UpKSk7XG5cblx0XHRzZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFByb21wdHNTZXJ2aWNlKSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdcdTIwMjIgZ2V0UGFyc2VyRm9yJywgKCkgPT4ge1xuXHRcdHRlc3QoJ1x1MjAyMiBwcm92aWRlcyBjYWNoZWQgcGFyc2VyIGluc3RhbmNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbGFuZ0lkID0gJ2Zvb0xhbmcnO1xuXG5cdFx0XHQvKipcblx0XHRcdCAqIENyZWF0ZSBhIHRleHQgbW9kZWwsIGdldCBhIHBhcnNlciBmb3IgaXQsIGFuZCBwZXJmb3JtIGJhc2ljIGFzc2VydGlvbnMuXG5cdFx0XHQgKi9cblxuXHRcdFx0Y29uc3QgbW9kZWwxID0gZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFx0J3Rlc3QxXFxuXFx0I2ZpbGU6Li9maWxlLm1kXFxuXFxuXFxuICAgW2JpbiBmaWxlXSgvcm9vdC90bXAuYmluKVxcdFxcbicsXG5cdFx0XHRcdGxhbmdJZCxcblx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy92c2NvZGUvcmVwb3MvdGVzdC9maWxlMS50eHQnKSxcblx0XHRcdCkpO1xuXG5cdFx0XHRjb25zdCBwYXJzZXIxID0gc2VydmljZS5nZXRTeW50YXhQYXJzZXJGb3IobW9kZWwxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdFx0cGFyc2VyMS51cmkudG9TdHJpbmcoKSxcblx0XHRcdFx0bW9kZWwxLnVyaS50b1N0cmluZygpLFxuXHRcdFx0XHQnTXVzdCBjcmVhdGUgcGFyc2VyMSB3aXRoIHRoZSBjb3JyZWN0IFVSSS4nLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHQhcGFyc2VyMS5kaXNwb3NlZCxcblx0XHRcdFx0J1BhcnNlcjEgbXVzdCBub3QgYmUgZGlzcG9zZWQuJyxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0cGFyc2VyMSBpbnN0YW5jZW9mIFRleHRNb2RlbFByb21wdFBhcnNlcixcblx0XHRcdFx0J1BhcnNlcjEgbXVzdCBiZSBhbiBpbnN0YW5jZSBvZiBUZXh0TW9kZWxQcm9tcHRQYXJzZXIuJyxcblx0XHRcdCk7XG5cblx0XHRcdC8qKlxuXHRcdFx0ICogVmFsaWRhdGUgdGhhdCBhbGwgbGlua3Mgb2YgdGhlIG1vZGVsIGFyZSBjb3JyZWN0bHkgcGFyc2VkLlxuXHRcdFx0ICovXG5cblx0XHRcdGF3YWl0IHBhcnNlcjEuc2V0dGxlZCgpO1xuXHRcdFx0YXNzZXJ0TGlua3MoXG5cdFx0XHRcdHBhcnNlcjEuYWxsUmVmZXJlbmNlcyxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdG5ldyBFeHBlY3RlZExpbmsoXG5cdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy92c2NvZGUvcmVwb3MvdGVzdC9maWxlLm1kJyksXG5cdFx0XHRcdFx0XHRuZXcgUmFuZ2UoMiwgMiwgMiwgMiArIDE1KSxcblx0XHRcdFx0XHRcdG5ldyBSYW5nZSgyLCA4LCAyLCA4ICsgOSksXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRuZXcgRXhwZWN0ZWRMaW5rKFxuXHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvcm9vdC90bXAuYmluJyksXG5cdFx0XHRcdFx0XHRuZXcgUmFuZ2UoNSwgNCwgNSwgNCArIDI1KSxcblx0XHRcdFx0XHRcdG5ldyBSYW5nZSg1LCAxNSwgNSwgMTUgKyAxMyksXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0XSxcblx0XHRcdCk7XG5cblx0XHRcdC8vIHdhaXQgZm9yIHNvbWUgcmFuZG9tIGFtb3VudCBvZiB0aW1lXG5cdFx0XHRhd2FpdCB3YWl0UmFuZG9tKDUpO1xuXG5cdFx0XHQvKipcblx0XHRcdCAqIE5leHQsIGdldCBwYXJzZXIgZm9yIHRoZSBzYW1lIGV4YWN0IG1vZGVsIGFuZFxuXHRcdFx0ICogdmFsaWRhdGUgdGhhdCB0aGUgc2FtZSBjYWNoZWQgb2JqZWN0IGlzIHJldHVybmVkLlxuXHRcdFx0ICovXG5cblx0XHRcdC8vIGdldCB0aGUgc2FtZSBwYXJzZXIgYWdhaW4sIHRoZSBjYWxsIG11c3QgcmV0dXJuIHRoZSBzYW1lIG9iamVjdFxuXHRcdFx0Y29uc3QgcGFyc2VyMV8xID0gc2VydmljZS5nZXRTeW50YXhQYXJzZXJGb3IobW9kZWwxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdFx0cGFyc2VyMSxcblx0XHRcdFx0cGFyc2VyMV8xLFxuXHRcdFx0XHQnTXVzdCByZXR1cm4gdGhlIHNhbWUgcGFyc2VyIG9iamVjdC4nLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0XHRwYXJzZXIxXzEudXJpLnRvU3RyaW5nKCksXG5cdFx0XHRcdG1vZGVsMS51cmkudG9TdHJpbmcoKSxcblx0XHRcdFx0J011c3QgY3JlYXRlIHBhcnNlcjFfMSB3aXRoIHRoZSBjb3JyZWN0IFVSSS4nLFxuXHRcdFx0KTtcblxuXHRcdFx0LyoqXG5cdFx0XHQgKiBHZXQgcGFyc2VyIGZvciBhIGRpZmZlcmVudCBtb2RlbCBhbmQgcGVyZm9ybSBiYXNpYyBhc3NlcnRpb25zLlxuXHRcdFx0ICovXG5cblx0XHRcdGNvbnN0IG1vZGVsMiA9IGRpc3Bvc2FibGVzLmFkZChjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRcdCdzb21lIHRleHQgI2ZpbGU6L2Fic29sdXRlL3BhdGgudHh0ICBcXHRcXG50ZXN0LXRleHQyJyxcblx0XHRcdFx0bGFuZ0lkLFxuXHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL3ZzY29kZS9yZXBvcy90ZXN0L3NvbWUtZm9sZGVyL2ZpbGUubWQnKSxcblx0XHRcdCkpO1xuXG5cdFx0XHQvLyB3YWl0IGZvciBzb21lIHJhbmRvbSBhbW91bnQgb2YgdGltZVxuXHRcdFx0YXdhaXQgd2FpdFJhbmRvbSg1KTtcblxuXHRcdFx0Y29uc3QgcGFyc2VyMiA9IHNlcnZpY2UuZ2V0U3ludGF4UGFyc2VyRm9yKG1vZGVsMik7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdFx0cGFyc2VyMi51cmkudG9TdHJpbmcoKSxcblx0XHRcdFx0bW9kZWwyLnVyaS50b1N0cmluZygpLFxuXHRcdFx0XHQnTXVzdCBjcmVhdGUgcGFyc2VyMiB3aXRoIHRoZSBjb3JyZWN0IFVSSS4nLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHQhcGFyc2VyMi5kaXNwb3NlZCxcblx0XHRcdFx0J1BhcnNlcjIgbXVzdCBub3QgYmUgZGlzcG9zZWQuJyxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0cGFyc2VyMiBpbnN0YW5jZW9mIFRleHRNb2RlbFByb21wdFBhcnNlcixcblx0XHRcdFx0J1BhcnNlcjIgbXVzdCBiZSBhbiBpbnN0YW5jZSBvZiBUZXh0TW9kZWxQcm9tcHRQYXJzZXIuJyxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydChcblx0XHRcdFx0IXBhcnNlcjIuZGlzcG9zZWQsXG5cdFx0XHRcdCdQYXJzZXIyIG11c3Qgbm90IGJlIGRpc3Bvc2VkLicsXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdCFwYXJzZXIxLmRpc3Bvc2VkLFxuXHRcdFx0XHQnUGFyc2VyMSBtdXN0IG5vdCBiZSBkaXNwb3NlZC4nLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHQhcGFyc2VyMV8xLmRpc3Bvc2VkLFxuXHRcdFx0XHQnUGFyc2VyMV8xIG11c3Qgbm90IGJlIGRpc3Bvc2VkLicsXG5cdFx0XHQpO1xuXG5cdFx0XHQvKipcblx0XHRcdCAqIFZhbGlkYXRlIHRoYXQgYWxsIGxpbmtzIG9mIHRoZSBtb2RlbCAyIGFyZSBjb3JyZWN0bHkgcGFyc2VkLlxuXHRcdFx0ICovXG5cblx0XHRcdGF3YWl0IHBhcnNlcjIuc2V0dGxlZCgpO1xuXG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoXG5cdFx0XHRcdHBhcnNlcjEudXJpLnRvU3RyaW5nKCksXG5cdFx0XHRcdHBhcnNlcjIudXJpLnRvU3RyaW5nKCksXG5cdFx0XHRcdCdQYXJzZXIyIG11c3QgaGF2ZSBpdHMgb3duIFVSSS4nLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0TGlua3MoXG5cdFx0XHRcdHBhcnNlcjIuYWxsUmVmZXJlbmNlcyxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdG5ldyBFeHBlY3RlZExpbmsoXG5cdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9hYnNvbHV0ZS9wYXRoLnR4dCcpLFxuXHRcdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDExLCAxLCAxMSArIDI0KSxcblx0XHRcdFx0XHRcdG5ldyBSYW5nZSgxLCAxNywgMSwgMTcgKyAxOCksXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0XSxcblx0XHRcdCk7XG5cblx0XHRcdC8qKlxuXHRcdFx0ICogVmFsaWRhdGUgdGhlIGZpcnN0IHBhcnNlciB3YXMgbm90IGFmZmVjdGVkIGJ5IHRoZSBwcmVzZW5jZVxuXHRcdFx0ICogb2YgdGhlIHNlY29uZCBwYXJzZXIuXG5cdFx0XHQgKi9cblxuXHRcdFx0YXdhaXQgcGFyc2VyMV8xLnNldHRsZWQoKTtcblxuXHRcdFx0Ly8gcGFyc2VyMV8xIGhhcyB0aGUgc2FtZSBleGFjdCBsaW5rcyBhcyBiZWZvcmVcblx0XHRcdGFzc2VydExpbmtzKFxuXHRcdFx0XHRwYXJzZXIxXzEuYWxsUmVmZXJlbmNlcyxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdG5ldyBFeHBlY3RlZExpbmsoXG5cdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9Vc2Vycy92c2NvZGUvcmVwb3MvdGVzdC9maWxlLm1kJyksXG5cdFx0XHRcdFx0XHRuZXcgUmFuZ2UoMiwgMiwgMiwgMiArIDE1KSxcblx0XHRcdFx0XHRcdG5ldyBSYW5nZSgyLCA4LCAyLCA4ICsgOSksXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRuZXcgRXhwZWN0ZWRMaW5rKFxuXHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvcm9vdC90bXAuYmluJyksXG5cdFx0XHRcdFx0XHRuZXcgUmFuZ2UoNSwgNCwgNSwgNCArIDI1KSxcblx0XHRcdFx0XHRcdG5ldyBSYW5nZSg1LCAxNSwgNSwgMTUgKyAxMyksXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0XSxcblx0XHRcdCk7XG5cblx0XHRcdC8vIHdhaXQgZm9yIHNvbWUgcmFuZG9tIGFtb3VudCBvZiB0aW1lXG5cdFx0XHRhd2FpdCB3YWl0UmFuZG9tKDUpO1xuXG5cdFx0XHQvKipcblx0XHRcdCAqIERpc3Bvc2UgdGhlIGZpcnN0IHBhcnNlciwgcGVyZm9ybSBiYXNpYyB2YWxpZGF0aW9ucywgYW5kIGNvbmZpcm1cblx0XHRcdCAqIHRoYXQgdGhlIHNlY29uZCBwYXJzZXIgaXMgbm90IGFmZmVjdGVkIGJ5IHRoZSBkaXNwb3NhbCBvZiB0aGUgZmlyc3Qgb25lLlxuXHRcdFx0ICovXG5cdFx0XHRwYXJzZXIxLmRpc3Bvc2UoKTtcblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRwYXJzZXIxLmRpc3Bvc2VkLFxuXHRcdFx0XHQnUGFyc2VyMSBtdXN0IGJlIGRpc3Bvc2VkLicsXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdHBhcnNlcjFfMS5kaXNwb3NlZCxcblx0XHRcdFx0J1BhcnNlcjFfMSBtdXN0IGJlIGRpc3Bvc2VkLicsXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdCFwYXJzZXIyLmRpc3Bvc2VkLFxuXHRcdFx0XHQnUGFyc2VyMiBtdXN0IG5vdCBiZSBkaXNwb3NlZC4nLFxuXHRcdFx0KTtcblxuXG5cdFx0XHQvKipcblx0XHRcdCAqIEdldCBwYXJzZXIgZm9yIHRoZSBmaXJzdCBtb2RlbCBhZ2Fpbi4gQ29uZmlybSB0aGF0IHdlIGdldFxuXHRcdFx0ICogYSBuZXcgbm9uLWRpc3Bvc2VkIHBhcnNlciBvYmplY3QgYmFjayB3aXRoIGNvcnJlY3QgcHJvcGVydGllcy5cblx0XHRcdCAqL1xuXG5cdFx0XHRjb25zdCBwYXJzZXIxXzIgPSBzZXJ2aWNlLmdldFN5bnRheFBhcnNlckZvcihtb2RlbDEpO1xuXG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdCFwYXJzZXIxXzIuZGlzcG9zZWQsXG5cdFx0XHRcdCdQYXJzZXIxXzIgbXVzdCBub3QgYmUgZGlzcG9zZWQuJyxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChcblx0XHRcdFx0cGFyc2VyMV8yLFxuXHRcdFx0XHRwYXJzZXIxLFxuXHRcdFx0XHQnTXVzdCBjcmVhdGUgYSBuZXcgcGFyc2VyIG9iamVjdCBmb3IgdGhlIG1vZGVsMS4nLFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0XHRwYXJzZXIxXzIudXJpLnRvU3RyaW5nKCksXG5cdFx0XHRcdG1vZGVsMS51cmkudG9TdHJpbmcoKSxcblx0XHRcdFx0J011c3QgY3JlYXRlIHBhcnNlcjFfMiB3aXRoIHRoZSBjb3JyZWN0IFVSSS4nLFxuXHRcdFx0KTtcblxuXHRcdFx0LyoqXG5cdFx0XHQgKiBWYWxpZGF0ZSB0aGF0IHRoZSBjb250ZW50cyBvZiB0aGUgc2Vjb25kIHBhcnNlciBkaWQgbm90IGNoYW5nZS5cblx0XHRcdCAqL1xuXG5cdFx0XHRhd2FpdCBwYXJzZXIxXzIuc2V0dGxlZCgpO1xuXG5cdFx0XHQvLyBwYXJzZXIxXzIgbXVzdCBoYXZlIHRoZSBzYW1lIGV4YWN0IGxpbmtzIGFzIGJlZm9yZVxuXHRcdFx0YXNzZXJ0TGlua3MoXG5cdFx0XHRcdHBhcnNlcjFfMi5hbGxSZWZlcmVuY2VzLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0bmV3IEV4cGVjdGVkTGluayhcblx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL3ZzY29kZS9yZXBvcy90ZXN0L2ZpbGUubWQnKSxcblx0XHRcdFx0XHRcdG5ldyBSYW5nZSgyLCAyLCAyLCAyICsgMTUpLFxuXHRcdFx0XHRcdFx0bmV3IFJhbmdlKDIsIDgsIDIsIDggKyA5KSxcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdG5ldyBFeHBlY3RlZExpbmsoXG5cdFx0XHRcdFx0XHRjcmVhdGVVUkkoJy9yb290L3RtcC5iaW4nKSxcblx0XHRcdFx0XHRcdG5ldyBSYW5nZSg1LCA0LCA1LCA0ICsgMjUpLFxuXHRcdFx0XHRcdFx0bmV3IFJhbmdlKDUsIDE1LCA1LCAxNSArIDEzKSxcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRdLFxuXHRcdFx0KTtcblxuXHRcdFx0Ly8gd2FpdCBmb3Igc29tZSByYW5kb20gYW1vdW50IG9mIHRpbWVcblx0XHRcdGF3YWl0IHdhaXRSYW5kb20oNSk7XG5cblx0XHRcdC8qKlxuXHRcdFx0ICogVGhpcyB0aW1lIGRpc3Bvc2UgbW9kZWwgb2YgdGhlIHNlY29uZCBwYXJzZXIgaW5zdGVhZCBvZlxuXHRcdFx0ICogdGhlIHBhcnNlciBpdHNlbGYuIFZhbGlkYXRlIHRoYXQgdGhlIHBhcnNlciBpcyBkaXNwb3NlZCB0b28sIGJ1dFxuXHRcdFx0ICogdGhlIG5ld2x5IGNyZWF0ZWQgZmlyc3QgcGFyc2VyIGlzIG5vdCBhZmZlY3RlZC5cblx0XHRcdCAqL1xuXG5cdFx0XHQvLyBkaXNwb3NlIHRoZSBgbW9kZWxgIG9mIHRoZSBzZWNvbmQgcGFyc2VyIG5vd1xuXHRcdFx0bW9kZWwyLmRpc3Bvc2UoKTtcblxuXHRcdFx0Ly8gYXNzZXJ0IHRoYXQgdGhlIHBhcnNlciBpcyBhbHNvIGRpc3Bvc2VkXG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdHBhcnNlcjIuZGlzcG9zZWQsXG5cdFx0XHRcdCdQYXJzZXIyIG11c3QgYmUgZGlzcG9zZWQuJyxcblx0XHRcdCk7XG5cblx0XHRcdC8vIHNhbml0eSBjaGVjayB0aGF0IHRoZSBvdGhlciBwYXJzZXIgaXMgbm90IGFmZmVjdGVkXG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdCFwYXJzZXIxXzIuZGlzcG9zZWQsXG5cdFx0XHRcdCdQYXJzZXIxXzIgbXVzdCBub3QgYmUgZGlzcG9zZWQuJyxcblx0XHRcdCk7XG5cblx0XHRcdC8qKlxuXHRcdFx0ICogQ3JlYXRlIGEgbmV3IHNlY29uZCBwYXJzZXIgd2l0aCBuZXcgbW9kZWwgLSB3ZSBjYW5ub3QgdXNlXG5cdFx0XHQgKiB0aGUgb2xkIG9uZSBiZWNhdXNlIGl0IHdhcyBkaXNwb3NlZC4gVGhpcyBuZXcgbW9kZWwgYWxzbyBoYXNcblx0XHRcdCAqIGEgZGlmZmVyZW50IHNlY29uZCBsaW5rLlxuXHRcdFx0ICovXG5cblx0XHRcdC8vIHdlIGNhbm5vdCB1c2UgdGhlIHNhbWUgbW9kZWwgc2luY2UgaXQgd2FzIGFscmVhZHkgZGlzcG9zZWRcblx0XHRcdGNvbnN0IG1vZGVsMl8xID0gZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFx0J3NvbWUgdGV4dCAjZmlsZTovYWJzb2x1dGUvcGF0aC50eHQgIFxcbiBbY2FwdGlvbl0oLmNvcGlsb3QvcHJvbXB0cy90ZXN0LnByb21wdC5tZClcXHRcXG5cXHRcXG4gbW9yZSB0ZXh0Jyxcblx0XHRcdFx0bGFuZ0lkLFxuXHRcdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL3ZzY29kZS9yZXBvcy90ZXN0L3NvbWUtZm9sZGVyL2ZpbGUubWQnKSxcblx0XHRcdCkpO1xuXHRcdFx0Y29uc3QgcGFyc2VyMl8xID0gc2VydmljZS5nZXRTeW50YXhQYXJzZXJGb3IobW9kZWwyXzEpO1xuXG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdCFwYXJzZXIyXzEuZGlzcG9zZWQsXG5cdFx0XHRcdCdQYXJzZXIyXzEgbXVzdCBub3QgYmUgZGlzcG9zZWQuJyxcblx0XHRcdCk7XG5cblx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChcblx0XHRcdFx0cGFyc2VyMl8xLFxuXHRcdFx0XHRwYXJzZXIyLFxuXHRcdFx0XHQnUGFyc2VyMl8xIG11c3QgYmUgYSBuZXcgb2JqZWN0LicsXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRcdHBhcnNlcjJfMS51cmkudG9TdHJpbmcoKSxcblx0XHRcdFx0bW9kZWwyLnVyaS50b1N0cmluZygpLFxuXHRcdFx0XHQnTXVzdCBjcmVhdGUgcGFyc2VyMl8xIHdpdGggdGhlIGNvcnJlY3QgVVJJLicsXG5cdFx0XHQpO1xuXG5cdFx0XHQvKipcblx0XHRcdCAqIFZhbGlkYXRlIHRoYXQgbmV3IG1vZGVsMiBjb250ZW50cyBhcmUgcGFyc2VkIGNvcnJlY3RseS5cblx0XHRcdCAqL1xuXG5cdFx0XHRhd2FpdCBwYXJzZXIyXzEuc2V0dGxlZCgpO1xuXG5cdFx0XHQvLyBwYXJzZXIyXzEgbXVzdCBoYXZlIDIgbGlua3Mgbm93XG5cdFx0XHRhc3NlcnRMaW5rcyhcblx0XHRcdFx0cGFyc2VyMl8xLmFsbFJlZmVyZW5jZXMsXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQvLyB0aGUgZmlyc3QgbGluayBkaWRuJ3QgY2hhbmdlXG5cdFx0XHRcdFx0bmV3IEV4cGVjdGVkTGluayhcblx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL2Fic29sdXRlL3BhdGgudHh0JyksXG5cdFx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMTEsIDEsIDExICsgMjQpLFxuXHRcdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDE3LCAxLCAxNyArIDE4KSxcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdC8vIHRoZSBzZWNvbmQgbGluayBpcyBuZXdcblx0XHRcdFx0XHRuZXcgRXhwZWN0ZWRMaW5rKFxuXHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvVXNlcnMvdnNjb2RlL3JlcG9zL3Rlc3Qvc29tZS1mb2xkZXIvLmNvcGlsb3QvcHJvbXB0cy90ZXN0LnByb21wdC5tZCcpLFxuXHRcdFx0XHRcdFx0bmV3IFJhbmdlKDIsIDIsIDIsIDIgKyA0MiksXG5cdFx0XHRcdFx0XHRuZXcgUmFuZ2UoMiwgMTIsIDIsIDEyICsgMzEpLFxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdF0sXG5cdFx0XHQpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnXHUyMDIyIGF1dG8tdXBkYXRlZCBvbiBtb2RlbCBjaGFuZ2VzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbGFuZ0lkID0gJ2JhekxhbmcnO1xuXG5cdFx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChjcmVhdGVUZXh0TW9kZWwoXG5cdFx0XHRcdCcgXFx0ICNmaWxlOi4uL2ZpbGUubWRcXG50ZXN0MVxcblxcdFxcbiAgW2Fub3RoZXIgZmlsZV0oL1VzZXJzL3Jvb3QvdG1wL2ZpbGUyLnR4dClcXHRcXG4nLFxuXHRcdFx0XHRsYW5nSWQsXG5cdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0Y3JlYXRlVVJJKCcvcmVwb3MvdGVzdC9maWxlMS50eHQnKSxcblx0XHRcdCkpO1xuXG5cdFx0XHRjb25zdCBwYXJzZXIgPSBzZXJ2aWNlLmdldFN5bnRheFBhcnNlckZvcihtb2RlbCk7XG5cblx0XHRcdC8vIHNhbml0eSBjaGVja3Ncblx0XHRcdGFzc2VydChcblx0XHRcdFx0IXBhcnNlci5kaXNwb3NlZCxcblx0XHRcdFx0J1BhcnNlciBtdXN0IG5vdCBiZSBkaXNwb3NlZC4nLFxuXHRcdFx0KTtcblx0XHRcdGFzc2VydChcblx0XHRcdFx0cGFyc2VyIGluc3RhbmNlb2YgVGV4dE1vZGVsUHJvbXB0UGFyc2VyLFxuXHRcdFx0XHQnUGFyc2VyIG11c3QgYmUgYW4gaW5zdGFuY2Ugb2YgVGV4dE1vZGVsUHJvbXB0UGFyc2VyLicsXG5cdFx0XHQpO1xuXG5cdFx0XHRhd2FpdCBwYXJzZXIuc2V0dGxlZCgpO1xuXG5cdFx0XHRhc3NlcnRMaW5rcyhcblx0XHRcdFx0cGFyc2VyLmFsbFJlZmVyZW5jZXMsXG5cdFx0XHRcdFtcblx0XHRcdFx0XHRuZXcgRXhwZWN0ZWRMaW5rKFxuXHRcdFx0XHRcdFx0Y3JlYXRlVVJJKCcvcmVwb3MvZmlsZS5tZCcpLFxuXHRcdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDQsIDEsIDQgKyAxNiksXG5cdFx0XHRcdFx0XHRuZXcgUmFuZ2UoMSwgMTAsIDEsIDEwICsgMTApLFxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0bmV3IEV4cGVjdGVkTGluayhcblx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL3Jvb3QvdG1wL2ZpbGUyLnR4dCcpLFxuXHRcdFx0XHRcdFx0bmV3IFJhbmdlKDQsIDMsIDQsIDMgKyA0MSksXG5cdFx0XHRcdFx0XHRuZXcgUmFuZ2UoNCwgMTgsIDQsIDE4ICsgMjUpLFxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdF0sXG5cdFx0XHQpO1xuXG5cdFx0XHRtb2RlbC5hcHBseUVkaXRzKFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoNCwgMTgsIDQsIDE4ICsgMjUpLFxuXHRcdFx0XHRcdHRleHQ6ICcvVXNlcnMvcm9vdC90bXAvZmlsZTMudHh0Jyxcblx0XHRcdFx0fSxcblx0XHRcdF0pO1xuXG5cdFx0XHRhd2FpdCBwYXJzZXIuc2V0dGxlZCgpO1xuXG5cdFx0XHRhc3NlcnRMaW5rcyhcblx0XHRcdFx0cGFyc2VyLmFsbFJlZmVyZW5jZXMsXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQvLyBsaW5rMSBkaWRuJ3QgY2hhbmdlXG5cdFx0XHRcdFx0bmV3IEV4cGVjdGVkTGluayhcblx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL3JlcG9zL2ZpbGUubWQnKSxcblx0XHRcdFx0XHRcdG5ldyBSYW5nZSgxLCA0LCAxLCA0ICsgMTYpLFxuXHRcdFx0XHRcdFx0bmV3IFJhbmdlKDEsIDEwLCAxLCAxMCArIDEwKSxcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdC8vIGxpbmsyIGNoYW5nZWQgaW4gdGhlIGZpbGUgbmFtZSBvbmx5XG5cdFx0XHRcdFx0bmV3IEV4cGVjdGVkTGluayhcblx0XHRcdFx0XHRcdGNyZWF0ZVVSSSgnL1VzZXJzL3Jvb3QvdG1wL2ZpbGUzLnR4dCcpLFxuXHRcdFx0XHRcdFx0bmV3IFJhbmdlKDQsIDMsIDQsIDMgKyA0MSksXG5cdFx0XHRcdFx0XHRuZXcgUmFuZ2UoNCwgMTgsIDQsIDE4ICsgMjUpLFxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdF0sXG5cdFx0XHQpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnXHUyMDIyIHRocm93cyBpZiBkaXNwb3NlZCBtb2RlbCBwcm92aWRlZCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFx0J3Rlc3QxXFxudGVzdDJcXG5cXG50ZXN0M1xcdFxcbicsXG5cdFx0XHRcdCdiYXJMYW5nJyxcblx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHRVUkkucGFyc2UoJy4vZ2l0aHViL3Byb21wdHMvZmlsZS5wcm9tcHQubWQnKSxcblx0XHRcdCkpO1xuXG5cdFx0XHQvLyBkaXNwb3NlIHRoZSBtb2RlbCBiZWZvcmUgdXNpbmcgaXRcblx0XHRcdG1vZGVsLmRpc3Bvc2UoKTtcblxuXHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdHNlcnZpY2UuZ2V0U3ludGF4UGFyc2VyRm9yKG1vZGVsKTtcblx0XHRcdH0sICdDYW5ub3QgY3JlYXRlIGEgcHJvbXB0IHBhcnNlciBmb3IgYSBkaXNwb3NlZCBtb2RlbC4nKTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLFdBQVc7QUFDcEIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsa0JBQWtCO0FBRTNCLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsYUFBYSxzQkFBc0I7QUFDNUMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxnQ0FBZ0M7QUFLekMsTUFBTSxhQUFhO0FBQUEsRUFDbEIsWUFDaUIsS0FDQSxXQUNBLFdBQ2Y7QUFIZTtBQUNBO0FBQ0E7QUFBQSxFQUNiO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLRyxZQUFZLE1BQTRCO0FBQzlDLFdBQU87QUFBQSxNQUNOLEtBQUs7QUFBQSxNQUNMO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFFQSxXQUFPO0FBQUEsTUFDTixLQUFLLElBQUksU0FBUztBQUFBLE1BQ2xCLEtBQUssSUFBSSxTQUFTO0FBQUEsTUFDbEI7QUFBQSxJQUNEO0FBRUE7QUFBQSxNQUNDLEtBQUssVUFBVSxZQUFZLEtBQUssS0FBSztBQUFBLE1BQ3JDLHVCQUF1QixLQUFLLFNBQVMsV0FBVyxLQUFLLEtBQUs7QUFBQSxJQUMzRDtBQUVBO0FBQUEsTUFDQyxLQUFLO0FBQUEsTUFDTDtBQUFBLElBQ0Q7QUFF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LE9BQU87QUFBQSxRQUNQO0FBQUEsVUFDQyxJQUFJO0FBQUEsWUFDSCxVQUFVLGdCQUFnQjtBQUFBLFlBQzFCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxJQUFJLEVBQUU7QUFBQSxZQUN6QixJQUFJLE1BQU0sR0FBRyxJQUFJLEdBQUcsS0FBSyxFQUFFO0FBQUEsVUFDNUI7QUFBQSxVQUNBLElBQUk7QUFBQSxZQUNILFVBQVUsMkJBQTJCO0FBQUEsWUFDckMsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLElBQUksRUFBRTtBQUFBLFlBQ3pCLElBQUksTUFBTSxHQUFHLElBQUksR0FBRyxLQUFLLEVBQUU7QUFBQSxVQUM1QjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBRUEsWUFBTSxXQUFXO0FBQUEsUUFDaEI7QUFBQSxVQUNDLE9BQU8sSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLEtBQUssRUFBRTtBQUFBLFVBQ2xDLE1BQU07QUFBQSxRQUNQO0FBQUEsTUFDRCxDQUFDO0FBRUQsWUFBTSxPQUFPLFFBQVE7QUFFckI7QUFBQSxRQUNDLE9BQU87QUFBQSxRQUNQO0FBQUE7QUFBQSxVQUVDLElBQUk7QUFBQSxZQUNILFVBQVUsZ0JBQWdCO0FBQUEsWUFDMUIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLElBQUksRUFBRTtBQUFBLFlBQ3pCLElBQUksTUFBTSxHQUFHLElBQUksR0FBRyxLQUFLLEVBQUU7QUFBQSxVQUM1QjtBQUFBO0FBQUEsVUFFQSxJQUFJO0FBQUEsWUFDSCxVQUFVLDJCQUEyQjtBQUFBLFlBQ3JDLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxJQUFJLEVBQUU7QUFBQSxZQUN6QixJQUFJLE1BQU0sR0FBRyxJQUFJLEdBQUcsS0FBSyxFQUFFO0FBQUEsVUFDNUI7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUVELFNBQUssNENBQXVDLGlCQUFrQjtBQUM3RCxZQUFNLFFBQVEsWUFBWSxJQUFJO0FBQUEsUUFDN0I7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0EsSUFBSSxNQUFNLGlDQUFpQztBQUFBLE1BQzVDLENBQUM7QUFHRCxZQUFNLFFBQVE7QUFFZCxhQUFPLE9BQU8sTUFBTTtBQUNuQixnQkFBUSxtQkFBbUIsS0FBSztBQUFBLE1BQ2pDLEdBQUcscURBQXFEO0FBQUEsSUFDekQsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
