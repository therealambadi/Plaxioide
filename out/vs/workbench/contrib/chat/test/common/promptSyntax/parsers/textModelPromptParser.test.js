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
import { createURI } from "../testUtils/createUri.js";
import { Schemas } from "../../../../../../../base/common/network.js";
import { ExpectedReference } from "../testUtils/expectedReference.js";
import { Disposable } from "../../../../../../../base/common/lifecycle.js";
import { OpenFailed } from "../../../../common/promptFileReferenceErrors.js";
import { IFileService } from "../../../../../../../platform/files/common/files.js";
import { randomBoolean } from "../../../../../../../base/test/common/testUtils.js";
import { FileService } from "../../../../../../../platform/files/common/fileService.js";
import { createTextModel } from "../../../../../../../editor/test/common/testTextModel.js";
import { ILogService, NullLogService } from "../../../../../../../platform/log/common/log.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../../base/test/common/utils.js";
import { TextModelPromptParser } from "../../../../common/promptSyntax/parsers/textModelPromptParser.js";
import { IInstantiationService } from "../../../../../../../platform/instantiation/common/instantiation.js";
import { InMemoryFileSystemProvider } from "../../../../../../../platform/files/common/inMemoryFilesystemProvider.js";
import { TestInstantiationService } from "../../../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { assertDefined } from "../../../../../../../base/common/types.js";
let TextModelPromptParserTest = class extends Disposable {
  constructor(uri, initialContents, fileService, initService) {
    super();
    const fileSystemProvider = this._register(new InMemoryFileSystemProvider());
    this._register(fileService.registerProvider(Schemas.file, fileSystemProvider));
    const lineEnding = randomBoolean() ? "\r\n" : "\n";
    this.model = this._register(
      createTextModel(
        initialContents.join(lineEnding),
        "fooLang",
        void 0,
        uri
      )
    );
    this.parser = this._register(
      initService.createInstance(TextModelPromptParser, this.model, [])
    ).start();
  }
  /**
   * Validate the current state of the parser.
   */
  async validateReferences(expectedReferences) {
    await this.parser.allSettled();
    const { references } = this.parser;
    for (let i = 0; i < expectedReferences.length; i++) {
      const reference = references[i];
      assertDefined(
        reference,
        `Expected reference #${i} be ${expectedReferences[i]}, got 'undefined'.`
      );
      expectedReferences[i].validateEqual(reference);
    }
    assert.strictEqual(
      expectedReferences.length,
      references.length,
      `[${this.model.uri}] Unexpected number of references.`
    );
  }
};
TextModelPromptParserTest = __decorateClass([
  __decorateParam(2, IFileService),
  __decorateParam(3, IInstantiationService)
], TextModelPromptParserTest);
suite("TextModelPromptParser", () => {
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  let instantiationService;
  setup(async () => {
    instantiationService = disposables.add(new TestInstantiationService());
    instantiationService.stub(ILogService, new NullLogService());
    instantiationService.stub(IFileService, disposables.add(instantiationService.createInstance(FileService)));
  });
  const createTest = (uri, initialContents) => {
    return disposables.add(
      instantiationService.createInstance(
        TextModelPromptParserTest,
        uri,
        initialContents
      )
    );
  };
  test("core logic #1", async () => {
    const test2 = createTest(
      createURI("/foo/bar.md"),
      [
        /* 01 */
        "The quick brown fox tries #file:/abs/path/to/file.md online yoga for the first time.",
        /* 02 */
        "Maria discovered a stray turtle roaming in her kitchen.",
        /* 03 */
        "Why did the robot write a poem about existential dread?",
        /* 04 */
        "Sundays are made for two things: pancakes and procrastination.",
        /* 05 */
        "Sometimes, the best code is the one you never have to write.",
        /* 06 */
        "A lone kangaroo once hopped into the local cafe, seeking free Wi-Fi.",
        /* 07 */
        "Critical #file:./folder/binary.file thinking is like coffee; best served strong [md link](/etc/hosts/random-file.txt) and without sugar.",
        /* 08 */
        "Music is the mind\u2019s way of doodling in the air.",
        /* 09 */
        "Stargazing is just turning your eyes into cosmic explorers.",
        /* 10 */
        "Never trust a balloon salesman who hates birthdays.",
        /* 11 */
        "Running backward can be surprisingly enlightening.",
        /* 12 */
        "There\u2019s an art to whispering loudly."
      ]
    );
    await test2.validateReferences([
      new ExpectedReference({
        uri: createURI("/abs/path/to/file.md"),
        text: "#file:/abs/path/to/file.md",
        path: "/abs/path/to/file.md",
        startLine: 1,
        startColumn: 27,
        pathStartColumn: 33,
        childrenOrError: new OpenFailed(createURI("/abs/path/to/file.md"), "File not found.")
      }),
      new ExpectedReference({
        uri: createURI("/foo/folder/binary.file"),
        text: "#file:./folder/binary.file",
        path: "./folder/binary.file",
        startLine: 7,
        startColumn: 10,
        pathStartColumn: 16,
        childrenOrError: new OpenFailed(createURI("/foo/folder/binary.file"), "File not found.")
      }),
      new ExpectedReference({
        uri: createURI("/etc/hosts/random-file.txt"),
        text: "[md link](/etc/hosts/random-file.txt)",
        path: "/etc/hosts/random-file.txt",
        startLine: 7,
        startColumn: 81,
        pathStartColumn: 91,
        childrenOrError: new OpenFailed(createURI("/etc/hosts/random-file.txt"), "File not found.")
      })
    ]);
  });
  test("core logic #2", async () => {
    const test2 = createTest(
      createURI("/absolute/folder/and/a/filename.txt"),
      [
        /* 01 */
        "The penguin wore sunglasses but never left the iceberg.",
        /* 02 */
        "I once saw a cloud that looked like an antique teapot.",
        /* 03 */
        "Midnight snacks are the secret to eternal [link text](./foo-bar-baz/another-file.ts) happiness.",
        /* 04 */
        "A stray sock in the hallway is a sign of chaotic creativity.",
        /* 05 */
        "Dogs dream in colorful squeaks and belly rubs.",
        /* 06 */
        "Never [caption](../../../c/file_name.prompt.md)	 underestimate the power of a well-timed nap.",
        /* 07 */
        "The cactus on my desk has a thriving Instagram account.",
        /* 08 */
        "In an alternate universe, pigeons deliver sushi by drone.",
        /* 09 */
        "Lunar rainbows only appear when you sing in falsetto.",
        /* 10 */
        "Carrots have secret telepathic abilities, but only on Tuesdays.",
        /* 11 */
        "Sometimes, the best advice comes 		#file:../../main.rs	#file:./somefolder/../samefile.jpeg	from a talking dishwasher.",
        /* 12 */
        "Paper airplanes believe they can fly until proven otherwise.",
        /* 13 */
        "A library without stories is just a room full of silent trees.",
        /* 14 */
        "The invisible cat meows only when it sees a postman.",
        /* 15 */
        "Code reviews are like detective novels without the plot twists."
      ]
    );
    await test2.validateReferences([
      new ExpectedReference({
        uri: createURI("/absolute/folder/and/a/foo-bar-baz/another-file.ts"),
        text: "[link text](./foo-bar-baz/another-file.ts)",
        path: "./foo-bar-baz/another-file.ts",
        startLine: 3,
        startColumn: 43,
        pathStartColumn: 55,
        childrenOrError: new OpenFailed(createURI("/absolute/folder/and/a/foo-bar-baz/another-file.ts"), "File not found.")
      }),
      new ExpectedReference({
        uri: createURI("/absolute/c/file_name.prompt.md"),
        text: "[caption](../../../c/file_name.prompt.md)",
        path: "../../../c/file_name.prompt.md",
        startLine: 6,
        startColumn: 7,
        pathStartColumn: 17,
        childrenOrError: new OpenFailed(createURI("/absolute/c/file_name.prompt.md"), "File not found.")
      }),
      new ExpectedReference({
        uri: createURI("/absolute/folder/main.rs"),
        text: "#file:../../main.rs",
        path: "../../main.rs",
        startLine: 11,
        startColumn: 36,
        pathStartColumn: 42,
        childrenOrError: new OpenFailed(createURI("/absolute/folder/main.rs"), "File not found.")
      }),
      new ExpectedReference({
        uri: createURI("/absolute/folder/and/a/samefile.jpeg"),
        text: "#file:./somefolder/../samefile.jpeg",
        path: "./somefolder/../samefile.jpeg",
        startLine: 11,
        startColumn: 56,
        pathStartColumn: 62,
        childrenOrError: new OpenFailed(createURI("/absolute/folder/and/a/samefile.jpeg"), "File not found.")
      })
    ]);
  });
  test("gets disposed with the model", async () => {
    const test2 = createTest(
      createURI("/some/path/file.prompt.md"),
      [
        "line1",
        "line2",
        "line3"
      ]
    );
    await test2.validateReferences([]);
    test2.model.dispose();
    assert(
      test2.parser.disposed,
      "The parser should be disposed with its model."
    );
  });
  test("toString() implementation", async () => {
    const modelUri = createURI("/Users/legomushroom/repos/prompt-snippets/README.md");
    const test2 = createTest(
      modelUri,
      [
        "line1",
        "line2",
        "line3"
      ]
    );
    assert.strictEqual(
      test2.parser.toString(),
      `text-model-prompt:${modelUri.path}`,
      "The parser should provide correct `toString()` implementation."
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL3Byb21wdFN5bnRheC9wYXJzZXJzL3RleHRNb2RlbFByb21wdFBhcnNlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgY3JlYXRlVVJJIH0gZnJvbSAnLi4vdGVzdFV0aWxzL2NyZWF0ZVVyaS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgRXhwZWN0ZWRSZWZlcmVuY2UgfSBmcm9tICcuLi90ZXN0VXRpbHMvZXhwZWN0ZWRSZWZlcmVuY2UuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBPcGVuRmFpbGVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3Byb21wdEZpbGVSZWZlcmVuY2VFcnJvcnMuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IHJhbmRvbUJvb2xlYW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3Rlc3RVdGlscy5qcyc7XG5pbXBvcnQgeyBGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvdGVzdC9jb21tb24vdGVzdFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSwgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFRleHRNb2RlbFByb21wdFBhcnNlciB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9wcm9tcHRTeW50YXgvcGFyc2Vycy90ZXh0TW9kZWxQcm9tcHRQYXJzZXIuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJbk1lbW9yeUZpbGVTeXN0ZW1Qcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9pbk1lbW9yeUZpbGVzeXN0ZW1Qcm92aWRlci5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBhc3NlcnREZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuXG4vKipcbiAqIFRlc3QgaGVscGVyIHRvIHJ1biB1bml0IHRlc3RzIGZvciB0aGUge0BsaW5rIFRleHRNb2RlbFByb21wdFBhcnNlcn1cbiAqIGNsYXNzIHVzaW5nIGRpZmZlcmVudCB0ZXN0IGlucHV0IHBhcmFtZXRlcnNcbiAqL1xuY2xhc3MgVGV4dE1vZGVsUHJvbXB0UGFyc2VyVGVzdCBleHRlbmRzIERpc3Bvc2FibGUge1xuXHQvKipcblx0ICogVW5kZXJseWluZyB0ZXh0IG1vZGVsIG9mIHRoZSBwYXJzZXIuXG5cdCAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgbW9kZWw6IElUZXh0TW9kZWw7XG5cblx0LyoqXG5cdCAqIFRoZSBwYXJzZXIgaW5zdGFuY2UuXG5cdCAqL1xuXHRwdWJsaWMgcmVhZG9ubHkgcGFyc2VyOiBUZXh0TW9kZWxQcm9tcHRQYXJzZXI7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0dXJpOiBVUkksXG5cdFx0aW5pdGlhbENvbnRlbnRzOiBzdHJpbmdbXSxcblx0XHRASUZpbGVTZXJ2aWNlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbml0U2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Ly8gY3JlYXRlIGluLW1lbW9yeSBmaWxlIHN5c3RlbSBmb3IgdGhpcyB0ZXN0IGluc3RhbmNlXG5cdFx0Y29uc3QgZmlsZVN5c3RlbVByb3ZpZGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEluTWVtb3J5RmlsZVN5c3RlbVByb3ZpZGVyKCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGZpbGVTZXJ2aWNlLnJlZ2lzdGVyUHJvdmlkZXIoU2NoZW1hcy5maWxlLCBmaWxlU3lzdGVtUHJvdmlkZXIpKTtcblxuXHRcdC8vIGJvdGggbGluZSBlbmRpbmdzIHNob3VsZCB5aWVsZCB0aGUgc2FtZSByZXN1bHRzXG5cdFx0Y29uc3QgbGluZUVuZGluZyA9IChyYW5kb21Cb29sZWFuKCkpID8gJ1xcclxcbicgOiAnXFxuJztcblxuXHRcdC8vIGNyZWF0ZSB0aGUgdW5kZXJseWluZyBtb2RlbFxuXHRcdHRoaXMubW9kZWwgPSB0aGlzLl9yZWdpc3Rlcihcblx0XHRcdGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFx0aW5pdGlhbENvbnRlbnRzLmpvaW4obGluZUVuZGluZyksXG5cdFx0XHRcdCdmb29MYW5nJyxcblx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHR1cmksXG5cdFx0XHQpLFxuXHRcdCk7XG5cblx0XHQvLyBjcmVhdGUgdGhlIHBhcnNlciBpbnN0YW5jZVxuXHRcdHRoaXMucGFyc2VyID0gdGhpcy5fcmVnaXN0ZXIoXG5cdFx0XHRpbml0U2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0TW9kZWxQcm9tcHRQYXJzZXIsIHRoaXMubW9kZWwsIFtdKSxcblx0XHQpLnN0YXJ0KCk7XG5cdH1cblxuXHQvKipcblx0ICogVmFsaWRhdGUgdGhlIGN1cnJlbnQgc3RhdGUgb2YgdGhlIHBhcnNlci5cblx0ICovXG5cdHB1YmxpYyBhc3luYyB2YWxpZGF0ZVJlZmVyZW5jZXMoXG5cdFx0ZXhwZWN0ZWRSZWZlcmVuY2VzOiByZWFkb25seSBFeHBlY3RlZFJlZmVyZW5jZVtdLFxuXHQpIHtcblx0XHRhd2FpdCB0aGlzLnBhcnNlci5hbGxTZXR0bGVkKCk7XG5cblx0XHRjb25zdCB7IHJlZmVyZW5jZXMgfSA9IHRoaXMucGFyc2VyO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZXhwZWN0ZWRSZWZlcmVuY2VzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCByZWZlcmVuY2UgPSByZWZlcmVuY2VzW2ldO1xuXG5cdFx0XHRhc3NlcnREZWZpbmVkKFxuXHRcdFx0XHRyZWZlcmVuY2UsXG5cdFx0XHRcdGBFeHBlY3RlZCByZWZlcmVuY2UgIyR7aX0gYmUgJHtleHBlY3RlZFJlZmVyZW5jZXNbaV19LCBnb3QgJ3VuZGVmaW5lZCcuYCxcblx0XHRcdCk7XG5cblx0XHRcdGV4cGVjdGVkUmVmZXJlbmNlc1tpXS52YWxpZGF0ZUVxdWFsKHJlZmVyZW5jZSk7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFxuXHRcdFx0ZXhwZWN0ZWRSZWZlcmVuY2VzLmxlbmd0aCxcblx0XHRcdHJlZmVyZW5jZXMubGVuZ3RoLFxuXHRcdFx0YFske3RoaXMubW9kZWwudXJpfV0gVW5leHBlY3RlZCBudW1iZXIgb2YgcmVmZXJlbmNlcy5gLFxuXHRcdCk7XG5cdH1cbn1cblxuc3VpdGUoJ1RleHRNb2RlbFByb21wdFBhcnNlcicsICgpID0+IHtcblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRsZXQgaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZTtcblxuXHRzZXR1cChhc3luYyAoKSA9PiB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSgpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElMb2dTZXJ2aWNlLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRmlsZVNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShGaWxlU2VydmljZSkpKTtcblx0fSk7XG5cblx0LyoqXG5cdCAqIENyZWF0ZSBhIG5ldyB0ZXN0IGluc3RhbmNlIHdpdGggcHJvdmlkZWQgaW5wdXQgcGFyYW1ldGVycy5cblx0ICovXG5cdGNvbnN0IGNyZWF0ZVRlc3QgPSAoXG5cdFx0dXJpOiBVUkksXG5cdFx0aW5pdGlhbENvbnRlbnRzOiBzdHJpbmdbXSxcblx0KTogVGV4dE1vZGVsUHJvbXB0UGFyc2VyVGVzdCA9PiB7XG5cdFx0cmV0dXJuIGRpc3Bvc2FibGVzLmFkZChcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRUZXh0TW9kZWxQcm9tcHRQYXJzZXJUZXN0LFxuXHRcdFx0XHR1cmksXG5cdFx0XHRcdGluaXRpYWxDb250ZW50cyxcblx0XHRcdCksXG5cdFx0KTtcblx0fTtcblxuXHR0ZXN0KCdjb3JlIGxvZ2ljICMxJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHRlc3QgPSBjcmVhdGVUZXN0KFxuXHRcdFx0Y3JlYXRlVVJJKCcvZm9vL2Jhci5tZCcpLFxuXHRcdFx0W1xuXHRcdFx0XHQvKiAwMSAqL1wiVGhlIHF1aWNrIGJyb3duIGZveCB0cmllcyAjZmlsZTovYWJzL3BhdGgvdG8vZmlsZS5tZCBvbmxpbmUgeW9nYSBmb3IgdGhlIGZpcnN0IHRpbWUuXCIsXG5cdFx0XHRcdC8qIDAyICovXCJNYXJpYSBkaXNjb3ZlcmVkIGEgc3RyYXkgdHVydGxlIHJvYW1pbmcgaW4gaGVyIGtpdGNoZW4uXCIsXG5cdFx0XHRcdC8qIDAzICovXCJXaHkgZGlkIHRoZSByb2JvdCB3cml0ZSBhIHBvZW0gYWJvdXQgZXhpc3RlbnRpYWwgZHJlYWQ/XCIsXG5cdFx0XHRcdC8qIDA0ICovXCJTdW5kYXlzIGFyZSBtYWRlIGZvciB0d28gdGhpbmdzOiBwYW5jYWtlcyBhbmQgcHJvY3Jhc3RpbmF0aW9uLlwiLFxuXHRcdFx0XHQvKiAwNSAqL1wiU29tZXRpbWVzLCB0aGUgYmVzdCBjb2RlIGlzIHRoZSBvbmUgeW91IG5ldmVyIGhhdmUgdG8gd3JpdGUuXCIsXG5cdFx0XHRcdC8qIDA2ICovXCJBIGxvbmUga2FuZ2Fyb28gb25jZSBob3BwZWQgaW50byB0aGUgbG9jYWwgY2FmZSwgc2Vla2luZyBmcmVlIFdpLUZpLlwiLFxuXHRcdFx0XHQvKiAwNyAqL1wiQ3JpdGljYWwgI2ZpbGU6Li9mb2xkZXIvYmluYXJ5LmZpbGUgdGhpbmtpbmcgaXMgbGlrZSBjb2ZmZWU7IGJlc3Qgc2VydmVkIHN0cm9uZyBbbWQgbGlua10oL2V0Yy9ob3N0cy9yYW5kb20tZmlsZS50eHQpIGFuZCB3aXRob3V0IHN1Z2FyLlwiLFxuXHRcdFx0XHQvKiAwOCAqL1wiTXVzaWMgaXMgdGhlIG1pbmRcdTIwMTlzIHdheSBvZiBkb29kbGluZyBpbiB0aGUgYWlyLlwiLFxuXHRcdFx0XHQvKiAwOSAqL1wiU3RhcmdhemluZyBpcyBqdXN0IHR1cm5pbmcgeW91ciBleWVzIGludG8gY29zbWljIGV4cGxvcmVycy5cIixcblx0XHRcdFx0LyogMTAgKi9cIk5ldmVyIHRydXN0IGEgYmFsbG9vbiBzYWxlc21hbiB3aG8gaGF0ZXMgYmlydGhkYXlzLlwiLFxuXHRcdFx0XHQvKiAxMSAqL1wiUnVubmluZyBiYWNrd2FyZCBjYW4gYmUgc3VycHJpc2luZ2x5IGVubGlnaHRlbmluZy5cIixcblx0XHRcdFx0LyogMTIgKi9cIlRoZXJlXHUyMDE5cyBhbiBhcnQgdG8gd2hpc3BlcmluZyBsb3VkbHkuXCIsXG5cdFx0XHRdLFxuXHRcdCk7XG5cblx0XHRhd2FpdCB0ZXN0LnZhbGlkYXRlUmVmZXJlbmNlcyhbXG5cdFx0XHRuZXcgRXhwZWN0ZWRSZWZlcmVuY2Uoe1xuXHRcdFx0XHR1cmk6IGNyZWF0ZVVSSSgnL2Ficy9wYXRoL3RvL2ZpbGUubWQnKSxcblx0XHRcdFx0dGV4dDogJyNmaWxlOi9hYnMvcGF0aC90by9maWxlLm1kJyxcblx0XHRcdFx0cGF0aDogJy9hYnMvcGF0aC90by9maWxlLm1kJyxcblx0XHRcdFx0c3RhcnRMaW5lOiAxLFxuXHRcdFx0XHRzdGFydENvbHVtbjogMjcsXG5cdFx0XHRcdHBhdGhTdGFydENvbHVtbjogMzMsXG5cdFx0XHRcdGNoaWxkcmVuT3JFcnJvcjogbmV3IE9wZW5GYWlsZWQoY3JlYXRlVVJJKCcvYWJzL3BhdGgvdG8vZmlsZS5tZCcpLCAnRmlsZSBub3QgZm91bmQuJyksXG5cdFx0XHR9KSxcblx0XHRcdG5ldyBFeHBlY3RlZFJlZmVyZW5jZSh7XG5cdFx0XHRcdHVyaTogY3JlYXRlVVJJKCcvZm9vL2ZvbGRlci9iaW5hcnkuZmlsZScpLFxuXHRcdFx0XHR0ZXh0OiAnI2ZpbGU6Li9mb2xkZXIvYmluYXJ5LmZpbGUnLFxuXHRcdFx0XHRwYXRoOiAnLi9mb2xkZXIvYmluYXJ5LmZpbGUnLFxuXHRcdFx0XHRzdGFydExpbmU6IDcsXG5cdFx0XHRcdHN0YXJ0Q29sdW1uOiAxMCxcblx0XHRcdFx0cGF0aFN0YXJ0Q29sdW1uOiAxNixcblx0XHRcdFx0Y2hpbGRyZW5PckVycm9yOiBuZXcgT3BlbkZhaWxlZChjcmVhdGVVUkkoJy9mb28vZm9sZGVyL2JpbmFyeS5maWxlJyksICdGaWxlIG5vdCBmb3VuZC4nKSxcblx0XHRcdH0pLFxuXHRcdFx0bmV3IEV4cGVjdGVkUmVmZXJlbmNlKHtcblx0XHRcdFx0dXJpOiBjcmVhdGVVUkkoJy9ldGMvaG9zdHMvcmFuZG9tLWZpbGUudHh0JyksXG5cdFx0XHRcdHRleHQ6ICdbbWQgbGlua10oL2V0Yy9ob3N0cy9yYW5kb20tZmlsZS50eHQpJyxcblx0XHRcdFx0cGF0aDogJy9ldGMvaG9zdHMvcmFuZG9tLWZpbGUudHh0Jyxcblx0XHRcdFx0c3RhcnRMaW5lOiA3LFxuXHRcdFx0XHRzdGFydENvbHVtbjogODEsXG5cdFx0XHRcdHBhdGhTdGFydENvbHVtbjogOTEsXG5cdFx0XHRcdGNoaWxkcmVuT3JFcnJvcjogbmV3IE9wZW5GYWlsZWQoY3JlYXRlVVJJKCcvZXRjL2hvc3RzL3JhbmRvbS1maWxlLnR4dCcpLCAnRmlsZSBub3QgZm91bmQuJyksXG5cdFx0XHR9KSxcblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgnY29yZSBsb2dpYyAjMicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB0ZXN0ID0gY3JlYXRlVGVzdChcblx0XHRcdGNyZWF0ZVVSSSgnL2Fic29sdXRlL2ZvbGRlci9hbmQvYS9maWxlbmFtZS50eHQnKSxcblx0XHRcdFtcblx0XHRcdFx0LyogMDEgKi9cIlRoZSBwZW5ndWluIHdvcmUgc3VuZ2xhc3NlcyBidXQgbmV2ZXIgbGVmdCB0aGUgaWNlYmVyZy5cIixcblx0XHRcdFx0LyogMDIgKi9cIkkgb25jZSBzYXcgYSBjbG91ZCB0aGF0IGxvb2tlZCBsaWtlIGFuIGFudGlxdWUgdGVhcG90LlwiLFxuXHRcdFx0XHQvKiAwMyAqL1wiTWlkbmlnaHQgc25hY2tzIGFyZSB0aGUgc2VjcmV0IHRvIGV0ZXJuYWwgW2xpbmsgdGV4dF0oLi9mb28tYmFyLWJhei9hbm90aGVyLWZpbGUudHMpIGhhcHBpbmVzcy5cIixcblx0XHRcdFx0LyogMDQgKi9cIkEgc3RyYXkgc29jayBpbiB0aGUgaGFsbHdheSBpcyBhIHNpZ24gb2YgY2hhb3RpYyBjcmVhdGl2aXR5LlwiLFxuXHRcdFx0XHQvKiAwNSAqL1wiRG9ncyBkcmVhbSBpbiBjb2xvcmZ1bCBzcXVlYWtzIGFuZCBiZWxseSBydWJzLlwiLFxuXHRcdFx0XHQvKiAwNiAqL1wiTmV2ZXIgW2NhcHRpb25dKC4uLy4uLy4uL2MvZmlsZV9uYW1lLnByb21wdC5tZClcXHQgdW5kZXJlc3RpbWF0ZSB0aGUgcG93ZXIgb2YgYSB3ZWxsLXRpbWVkIG5hcC5cIixcblx0XHRcdFx0LyogMDcgKi9cIlRoZSBjYWN0dXMgb24gbXkgZGVzayBoYXMgYSB0aHJpdmluZyBJbnN0YWdyYW0gYWNjb3VudC5cIixcblx0XHRcdFx0LyogMDggKi9cIkluIGFuIGFsdGVybmF0ZSB1bml2ZXJzZSwgcGlnZW9ucyBkZWxpdmVyIHN1c2hpIGJ5IGRyb25lLlwiLFxuXHRcdFx0XHQvKiAwOSAqL1wiTHVuYXIgcmFpbmJvd3Mgb25seSBhcHBlYXIgd2hlbiB5b3Ugc2luZyBpbiBmYWxzZXR0by5cIixcblx0XHRcdFx0LyogMTAgKi9cIkNhcnJvdHMgaGF2ZSBzZWNyZXQgdGVsZXBhdGhpYyBhYmlsaXRpZXMsIGJ1dCBvbmx5IG9uIFR1ZXNkYXlzLlwiLFxuXHRcdFx0XHQvKiAxMSAqL1wiU29tZXRpbWVzLCB0aGUgYmVzdCBhZHZpY2UgY29tZXMgXFx0XFx0I2ZpbGU6Li4vLi4vbWFpbi5yc1xcdCNmaWxlOi4vc29tZWZvbGRlci8uLi9zYW1lZmlsZS5qcGVnXFx0ZnJvbSBhIHRhbGtpbmcgZGlzaHdhc2hlci5cIixcblx0XHRcdFx0LyogMTIgKi9cIlBhcGVyIGFpcnBsYW5lcyBiZWxpZXZlIHRoZXkgY2FuIGZseSB1bnRpbCBwcm92ZW4gb3RoZXJ3aXNlLlwiLFxuXHRcdFx0XHQvKiAxMyAqL1wiQSBsaWJyYXJ5IHdpdGhvdXQgc3RvcmllcyBpcyBqdXN0IGEgcm9vbSBmdWxsIG9mIHNpbGVudCB0cmVlcy5cIixcblx0XHRcdFx0LyogMTQgKi9cIlRoZSBpbnZpc2libGUgY2F0IG1lb3dzIG9ubHkgd2hlbiBpdCBzZWVzIGEgcG9zdG1hbi5cIixcblx0XHRcdFx0LyogMTUgKi9cIkNvZGUgcmV2aWV3cyBhcmUgbGlrZSBkZXRlY3RpdmUgbm92ZWxzIHdpdGhvdXQgdGhlIHBsb3QgdHdpc3RzLlwiXG5cdFx0XHRdLFxuXHRcdCk7XG5cblx0XHRhd2FpdCB0ZXN0LnZhbGlkYXRlUmVmZXJlbmNlcyhbXG5cdFx0XHRuZXcgRXhwZWN0ZWRSZWZlcmVuY2Uoe1xuXHRcdFx0XHR1cmk6IGNyZWF0ZVVSSSgnL2Fic29sdXRlL2ZvbGRlci9hbmQvYS9mb28tYmFyLWJhei9hbm90aGVyLWZpbGUudHMnKSxcblx0XHRcdFx0dGV4dDogJ1tsaW5rIHRleHRdKC4vZm9vLWJhci1iYXovYW5vdGhlci1maWxlLnRzKScsXG5cdFx0XHRcdHBhdGg6ICcuL2Zvby1iYXItYmF6L2Fub3RoZXItZmlsZS50cycsXG5cdFx0XHRcdHN0YXJ0TGluZTogMyxcblx0XHRcdFx0c3RhcnRDb2x1bW46IDQzLFxuXHRcdFx0XHRwYXRoU3RhcnRDb2x1bW46IDU1LFxuXHRcdFx0XHRjaGlsZHJlbk9yRXJyb3I6IG5ldyBPcGVuRmFpbGVkKGNyZWF0ZVVSSSgnL2Fic29sdXRlL2ZvbGRlci9hbmQvYS9mb28tYmFyLWJhei9hbm90aGVyLWZpbGUudHMnKSwgJ0ZpbGUgbm90IGZvdW5kLicpLFxuXHRcdFx0fSksXG5cdFx0XHRuZXcgRXhwZWN0ZWRSZWZlcmVuY2Uoe1xuXHRcdFx0XHR1cmk6IGNyZWF0ZVVSSSgnL2Fic29sdXRlL2MvZmlsZV9uYW1lLnByb21wdC5tZCcpLFxuXHRcdFx0XHR0ZXh0OiAnW2NhcHRpb25dKC4uLy4uLy4uL2MvZmlsZV9uYW1lLnByb21wdC5tZCknLFxuXHRcdFx0XHRwYXRoOiAnLi4vLi4vLi4vYy9maWxlX25hbWUucHJvbXB0Lm1kJyxcblx0XHRcdFx0c3RhcnRMaW5lOiA2LFxuXHRcdFx0XHRzdGFydENvbHVtbjogNyxcblx0XHRcdFx0cGF0aFN0YXJ0Q29sdW1uOiAxNyxcblx0XHRcdFx0Y2hpbGRyZW5PckVycm9yOiBuZXcgT3BlbkZhaWxlZChjcmVhdGVVUkkoJy9hYnNvbHV0ZS9jL2ZpbGVfbmFtZS5wcm9tcHQubWQnKSwgJ0ZpbGUgbm90IGZvdW5kLicpLFxuXHRcdFx0fSksXG5cdFx0XHRuZXcgRXhwZWN0ZWRSZWZlcmVuY2Uoe1xuXHRcdFx0XHR1cmk6IGNyZWF0ZVVSSSgnL2Fic29sdXRlL2ZvbGRlci9tYWluLnJzJyksXG5cdFx0XHRcdHRleHQ6ICcjZmlsZTouLi8uLi9tYWluLnJzJyxcblx0XHRcdFx0cGF0aDogJy4uLy4uL21haW4ucnMnLFxuXHRcdFx0XHRzdGFydExpbmU6IDExLFxuXHRcdFx0XHRzdGFydENvbHVtbjogMzYsXG5cdFx0XHRcdHBhdGhTdGFydENvbHVtbjogNDIsXG5cdFx0XHRcdGNoaWxkcmVuT3JFcnJvcjogbmV3IE9wZW5GYWlsZWQoY3JlYXRlVVJJKCcvYWJzb2x1dGUvZm9sZGVyL21haW4ucnMnKSwgJ0ZpbGUgbm90IGZvdW5kLicpLFxuXHRcdFx0fSksXG5cdFx0XHRuZXcgRXhwZWN0ZWRSZWZlcmVuY2Uoe1xuXHRcdFx0XHR1cmk6IGNyZWF0ZVVSSSgnL2Fic29sdXRlL2ZvbGRlci9hbmQvYS9zYW1lZmlsZS5qcGVnJyksXG5cdFx0XHRcdHRleHQ6ICcjZmlsZTouL3NvbWVmb2xkZXIvLi4vc2FtZWZpbGUuanBlZycsXG5cdFx0XHRcdHBhdGg6ICcuL3NvbWVmb2xkZXIvLi4vc2FtZWZpbGUuanBlZycsXG5cdFx0XHRcdHN0YXJ0TGluZTogMTEsXG5cdFx0XHRcdHN0YXJ0Q29sdW1uOiA1Nixcblx0XHRcdFx0cGF0aFN0YXJ0Q29sdW1uOiA2Mixcblx0XHRcdFx0Y2hpbGRyZW5PckVycm9yOiBuZXcgT3BlbkZhaWxlZChjcmVhdGVVUkkoJy9hYnNvbHV0ZS9mb2xkZXIvYW5kL2Evc2FtZWZpbGUuanBlZycpLCAnRmlsZSBub3QgZm91bmQuJyksXG5cdFx0XHR9KSxcblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgnZ2V0cyBkaXNwb3NlZCB3aXRoIHRoZSBtb2RlbCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB0ZXN0ID0gY3JlYXRlVGVzdChcblx0XHRcdGNyZWF0ZVVSSSgnL3NvbWUvcGF0aC9maWxlLnByb21wdC5tZCcpLFxuXHRcdFx0W1xuXHRcdFx0XHQnbGluZTEnLFxuXHRcdFx0XHQnbGluZTInLFxuXHRcdFx0XHQnbGluZTMnLFxuXHRcdFx0XSxcblx0XHQpO1xuXG5cdFx0Ly8gbm8gcmVmZXJlbmNlcyBpbiB0aGUgbW9kZWwgY29udGVudHNcblx0XHRhd2FpdCB0ZXN0LnZhbGlkYXRlUmVmZXJlbmNlcyhbXSk7XG5cblx0XHR0ZXN0Lm1vZGVsLmRpc3Bvc2UoKTtcblxuXHRcdGFzc2VydChcblx0XHRcdHRlc3QucGFyc2VyLmRpc3Bvc2VkLFxuXHRcdFx0J1RoZSBwYXJzZXIgc2hvdWxkIGJlIGRpc3Bvc2VkIHdpdGggaXRzIG1vZGVsLicsXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgndG9TdHJpbmcoKSBpbXBsZW1lbnRhdGlvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBtb2RlbFVyaSA9IGNyZWF0ZVVSSSgnL1VzZXJzL2xlZ29tdXNocm9vbS9yZXBvcy9wcm9tcHQtc25pcHBldHMvUkVBRE1FLm1kJyk7XG5cdFx0Y29uc3QgdGVzdCA9IGNyZWF0ZVRlc3QoXG5cdFx0XHRtb2RlbFVyaSxcblx0XHRcdFtcblx0XHRcdFx0J2xpbmUxJyxcblx0XHRcdFx0J2xpbmUyJyxcblx0XHRcdFx0J2xpbmUzJyxcblx0XHRcdF0sXG5cdFx0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHRlc3QucGFyc2VyLnRvU3RyaW5nKCksXG5cdFx0XHRgdGV4dC1tb2RlbC1wcm9tcHQ6JHttb2RlbFVyaS5wYXRofWAsXG5cdFx0XHQnVGhlIHBhcnNlciBzaG91bGQgcHJvdmlkZSBjb3JyZWN0IGB0b1N0cmluZygpYCBpbXBsZW1lbnRhdGlvbi4nLFxuXHRcdCk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGlCQUFpQjtBQUUxQixTQUFTLGVBQWU7QUFDeEIsU0FBUyx5QkFBeUI7QUFFbEMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxhQUFhLHNCQUFzQjtBQUM1QyxTQUFTLCtDQUErQztBQUN4RCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHFCQUFxQjtBQU05QixJQUFNLDRCQUFOLGNBQXdDLFdB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
