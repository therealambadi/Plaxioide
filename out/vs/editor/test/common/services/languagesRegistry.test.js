import assert from "assert";
import { URI } from "../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { LanguagesRegistry } from "../../../common/services/languagesRegistry.js";
suite("LanguagesRegistry", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("output language does not have a name", () => {
    const registry = new LanguagesRegistry(false);
    registry._registerLanguages([{
      id: "outputLangId",
      extensions: [],
      aliases: [],
      mimetypes: ["outputLanguageMimeType"]
    }]);
    assert.deepStrictEqual(registry.getSortedRegisteredLanguageNames(), []);
    registry.dispose();
  });
  test("language with alias does have a name", () => {
    const registry = new LanguagesRegistry(false);
    registry._registerLanguages([{
      id: "langId",
      extensions: [],
      aliases: ["LangName"],
      mimetypes: ["bla"]
    }]);
    assert.deepStrictEqual(registry.getSortedRegisteredLanguageNames(), [{ languageName: "LangName", languageId: "langId" }]);
    assert.deepStrictEqual(registry.getLanguageName("langId"), "LangName");
    registry.dispose();
  });
  test("language without alias gets a name", () => {
    const registry = new LanguagesRegistry(false);
    registry._registerLanguages([{
      id: "langId",
      extensions: [],
      mimetypes: ["bla"]
    }]);
    assert.deepStrictEqual(registry.getSortedRegisteredLanguageNames(), [{ languageName: "langId", languageId: "langId" }]);
    assert.deepStrictEqual(registry.getLanguageName("langId"), "langId");
    registry.dispose();
  });
  test("bug #4360: f# not shown in status bar", () => {
    const registry = new LanguagesRegistry(false);
    registry._registerLanguages([{
      id: "langId",
      extensions: [".ext1"],
      aliases: ["LangName"],
      mimetypes: ["bla"]
    }]);
    registry._registerLanguages([{
      id: "langId",
      extensions: [".ext2"],
      aliases: [],
      mimetypes: ["bla"]
    }]);
    assert.deepStrictEqual(registry.getSortedRegisteredLanguageNames(), [{ languageName: "LangName", languageId: "langId" }]);
    assert.deepStrictEqual(registry.getLanguageName("langId"), "LangName");
    registry.dispose();
  });
  test("issue #5278: Extension cannot override language name anymore", () => {
    const registry = new LanguagesRegistry(false);
    registry._registerLanguages([{
      id: "langId",
      extensions: [".ext1"],
      aliases: ["LangName"],
      mimetypes: ["bla"]
    }]);
    registry._registerLanguages([{
      id: "langId",
      extensions: [".ext2"],
      aliases: ["BetterLanguageName"],
      mimetypes: ["bla"]
    }]);
    assert.deepStrictEqual(registry.getSortedRegisteredLanguageNames(), [{ languageName: "BetterLanguageName", languageId: "langId" }]);
    assert.deepStrictEqual(registry.getLanguageName("langId"), "BetterLanguageName");
    registry.dispose();
  });
  test("mimetypes are generated if necessary", () => {
    const registry = new LanguagesRegistry(false);
    registry._registerLanguages([{
      id: "langId"
    }]);
    assert.deepStrictEqual(registry.getMimeType("langId"), "text/x-langId");
    registry.dispose();
  });
  test("first mimetype wins", () => {
    const registry = new LanguagesRegistry(false);
    registry._registerLanguages([{
      id: "langId",
      mimetypes: ["text/langId", "text/langId2"]
    }]);
    assert.deepStrictEqual(registry.getMimeType("langId"), "text/langId");
    registry.dispose();
  });
  test("first mimetype wins 2", () => {
    const registry = new LanguagesRegistry(false);
    registry._registerLanguages([{
      id: "langId"
    }]);
    registry._registerLanguages([{
      id: "langId",
      mimetypes: ["text/langId"]
    }]);
    assert.deepStrictEqual(registry.getMimeType("langId"), "text/x-langId");
    registry.dispose();
  });
  test("aliases", () => {
    const registry = new LanguagesRegistry(false);
    registry._registerLanguages([{
      id: "a"
    }]);
    assert.deepStrictEqual(registry.getSortedRegisteredLanguageNames(), [{ languageName: "a", languageId: "a" }]);
    assert.deepStrictEqual(registry.getLanguageIdByLanguageName("a"), "a");
    assert.deepStrictEqual(registry.getLanguageName("a"), "a");
    registry._registerLanguages([{
      id: "a",
      aliases: ["A1", "A2"]
    }]);
    assert.deepStrictEqual(registry.getSortedRegisteredLanguageNames(), [{ languageName: "A1", languageId: "a" }]);
    assert.deepStrictEqual(registry.getLanguageIdByLanguageName("a"), "a");
    assert.deepStrictEqual(registry.getLanguageIdByLanguageName("a1"), "a");
    assert.deepStrictEqual(registry.getLanguageIdByLanguageName("a2"), "a");
    assert.deepStrictEqual(registry.getLanguageName("a"), "A1");
    registry._registerLanguages([{
      id: "a",
      aliases: ["A3", "A4"]
    }]);
    assert.deepStrictEqual(registry.getSortedRegisteredLanguageNames(), [{ languageName: "A3", languageId: "a" }]);
    assert.deepStrictEqual(registry.getLanguageIdByLanguageName("a"), "a");
    assert.deepStrictEqual(registry.getLanguageIdByLanguageName("a1"), "a");
    assert.deepStrictEqual(registry.getLanguageIdByLanguageName("a2"), "a");
    assert.deepStrictEqual(registry.getLanguageIdByLanguageName("a3"), "a");
    assert.deepStrictEqual(registry.getLanguageIdByLanguageName("a4"), "a");
    assert.deepStrictEqual(registry.getLanguageName("a"), "A3");
    registry.dispose();
  });
  test("empty aliases array means no alias", () => {
    const registry = new LanguagesRegistry(false);
    registry._registerLanguages([{
      id: "a"
    }]);
    assert.deepStrictEqual(registry.getSortedRegisteredLanguageNames(), [{ languageName: "a", languageId: "a" }]);
    assert.deepStrictEqual(registry.getLanguageIdByLanguageName("a"), "a");
    assert.deepStrictEqual(registry.getLanguageName("a"), "a");
    registry._registerLanguages([{
      id: "b",
      aliases: []
    }]);
    assert.deepStrictEqual(registry.getSortedRegisteredLanguageNames(), [{ languageName: "a", languageId: "a" }]);
    assert.deepStrictEqual(registry.getLanguageIdByLanguageName("a"), "a");
    assert.deepStrictEqual(registry.getLanguageIdByLanguageName("b"), "b");
    assert.deepStrictEqual(registry.getLanguageName("a"), "a");
    assert.deepStrictEqual(registry.getLanguageName("b"), null);
    registry.dispose();
  });
  test("extensions", () => {
    const registry = new LanguagesRegistry(false);
    registry._registerLanguages([{
      id: "a",
      aliases: ["aName"],
      extensions: ["aExt"]
    }]);
    assert.deepStrictEqual(registry.getExtensions("a"), ["aExt"]);
    registry._registerLanguages([{
      id: "a",
      extensions: ["aExt2"]
    }]);
    assert.deepStrictEqual(registry.getExtensions("a"), ["aExt", "aExt2"]);
    registry.dispose();
  });
  test("extensions of primary language registration come first", () => {
    const registry = new LanguagesRegistry(false);
    registry._registerLanguages([{
      id: "a",
      extensions: ["aExt3"]
    }]);
    assert.deepStrictEqual(registry.getExtensions("a")[0], "aExt3");
    registry._registerLanguages([{
      id: "a",
      configuration: URI.file("conf.json"),
      extensions: ["aExt"]
    }]);
    assert.deepStrictEqual(registry.getExtensions("a")[0], "aExt");
    registry._registerLanguages([{
      id: "a",
      extensions: ["aExt2"]
    }]);
    assert.deepStrictEqual(registry.getExtensions("a")[0], "aExt");
    registry.dispose();
  });
  test("filenames", () => {
    const registry = new LanguagesRegistry(false);
    registry._registerLanguages([{
      id: "a",
      aliases: ["aName"],
      filenames: ["aFilename"]
    }]);
    assert.deepStrictEqual(registry.getFilenames("a"), ["aFilename"]);
    registry._registerLanguages([{
      id: "a",
      filenames: ["aFilename2"]
    }]);
    assert.deepStrictEqual(registry.getFilenames("a"), ["aFilename", "aFilename2"]);
    registry.dispose();
  });
  test("configuration", () => {
    const registry = new LanguagesRegistry(false);
    registry._registerLanguages([{
      id: "a",
      aliases: ["aName"],
      configuration: URI.file("/path/to/aFilename")
    }]);
    assert.deepStrictEqual(registry.getConfigurationFiles("a"), [URI.file("/path/to/aFilename")]);
    assert.deepStrictEqual(registry.getConfigurationFiles("aname"), []);
    assert.deepStrictEqual(registry.getConfigurationFiles("aName"), []);
    registry._registerLanguages([{
      id: "a",
      configuration: URI.file("/path/to/aFilename2")
    }]);
    assert.deepStrictEqual(registry.getConfigurationFiles("a"), [URI.file("/path/to/aFilename"), URI.file("/path/to/aFilename2")]);
    assert.deepStrictEqual(registry.getConfigurationFiles("aname"), []);
    assert.deepStrictEqual(registry.getConfigurationFiles("aName"), []);
    registry.dispose();
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VzUmVnaXN0cnkudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IExhbmd1YWdlc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlc1JlZ2lzdHJ5LmpzJztcblxuc3VpdGUoJ0xhbmd1YWdlc1JlZ2lzdHJ5JywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ291dHB1dCBsYW5ndWFnZSBkb2VzIG5vdCBoYXZlIGEgbmFtZScsICgpID0+IHtcblx0XHRjb25zdCByZWdpc3RyeSA9IG5ldyBMYW5ndWFnZXNSZWdpc3RyeShmYWxzZSk7XG5cblx0XHRyZWdpc3RyeS5fcmVnaXN0ZXJMYW5ndWFnZXMoW3tcblx0XHRcdGlkOiAnb3V0cHV0TGFuZ0lkJyxcblx0XHRcdGV4dGVuc2lvbnM6IFtdLFxuXHRcdFx0YWxpYXNlczogW10sXG5cdFx0XHRtaW1ldHlwZXM6IFsnb3V0cHV0TGFuZ3VhZ2VNaW1lVHlwZSddLFxuXHRcdH1dKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0U29ydGVkUmVnaXN0ZXJlZExhbmd1YWdlTmFtZXMoKSwgW10pO1xuXG5cdFx0cmVnaXN0cnkuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdsYW5ndWFnZSB3aXRoIGFsaWFzIGRvZXMgaGF2ZSBhIG5hbWUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcmVnaXN0cnkgPSBuZXcgTGFuZ3VhZ2VzUmVnaXN0cnkoZmFsc2UpO1xuXG5cdFx0cmVnaXN0cnkuX3JlZ2lzdGVyTGFuZ3VhZ2VzKFt7XG5cdFx0XHRpZDogJ2xhbmdJZCcsXG5cdFx0XHRleHRlbnNpb25zOiBbXSxcblx0XHRcdGFsaWFzZXM6IFsnTGFuZ05hbWUnXSxcblx0XHRcdG1pbWV0eXBlczogWydibGEnXSxcblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZ2lzdHJ5LmdldFNvcnRlZFJlZ2lzdGVyZWRMYW5ndWFnZU5hbWVzKCksIFt7IGxhbmd1YWdlTmFtZTogJ0xhbmdOYW1lJywgbGFuZ3VhZ2VJZDogJ2xhbmdJZCcgfV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0TGFuZ3VhZ2VOYW1lKCdsYW5nSWQnKSwgJ0xhbmdOYW1lJyk7XG5cblx0XHRyZWdpc3RyeS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xhbmd1YWdlIHdpdGhvdXQgYWxpYXMgZ2V0cyBhIG5hbWUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcmVnaXN0cnkgPSBuZXcgTGFuZ3VhZ2VzUmVnaXN0cnkoZmFsc2UpO1xuXG5cdFx0cmVnaXN0cnkuX3JlZ2lzdGVyTGFuZ3VhZ2VzKFt7XG5cdFx0XHRpZDogJ2xhbmdJZCcsXG5cdFx0XHRleHRlbnNpb25zOiBbXSxcblx0XHRcdG1pbWV0eXBlczogWydibGEnXSxcblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZ2lzdHJ5LmdldFNvcnRlZFJlZ2lzdGVyZWRMYW5ndWFnZU5hbWVzKCksIFt7IGxhbmd1YWdlTmFtZTogJ2xhbmdJZCcsIGxhbmd1YWdlSWQ6ICdsYW5nSWQnIH1dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZ2lzdHJ5LmdldExhbmd1YWdlTmFtZSgnbGFuZ0lkJyksICdsYW5nSWQnKTtcblxuXHRcdHJlZ2lzdHJ5LmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnYnVnICM0MzYwOiBmIyBub3Qgc2hvd24gaW4gc3RhdHVzIGJhcicsICgpID0+IHtcblx0XHRjb25zdCByZWdpc3RyeSA9IG5ldyBMYW5ndWFnZXNSZWdpc3RyeShmYWxzZSk7XG5cblx0XHRyZWdpc3RyeS5fcmVnaXN0ZXJMYW5ndWFnZXMoW3tcblx0XHRcdGlkOiAnbGFuZ0lkJyxcblx0XHRcdGV4dGVuc2lvbnM6IFsnLmV4dDEnXSxcblx0XHRcdGFsaWFzZXM6IFsnTGFuZ05hbWUnXSxcblx0XHRcdG1pbWV0eXBlczogWydibGEnXSxcblx0XHR9XSk7XG5cblx0XHRyZWdpc3RyeS5fcmVnaXN0ZXJMYW5ndWFnZXMoW3tcblx0XHRcdGlkOiAnbGFuZ0lkJyxcblx0XHRcdGV4dGVuc2lvbnM6IFsnLmV4dDInXSxcblx0XHRcdGFsaWFzZXM6IFtdLFxuXHRcdFx0bWltZXR5cGVzOiBbJ2JsYSddLFxuXHRcdH1dKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0U29ydGVkUmVnaXN0ZXJlZExhbmd1YWdlTmFtZXMoKSwgW3sgbGFuZ3VhZ2VOYW1lOiAnTGFuZ05hbWUnLCBsYW5ndWFnZUlkOiAnbGFuZ0lkJyB9XSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWdpc3RyeS5nZXRMYW5ndWFnZU5hbWUoJ2xhbmdJZCcpLCAnTGFuZ05hbWUnKTtcblxuXHRcdHJlZ2lzdHJ5LmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzUyNzg6IEV4dGVuc2lvbiBjYW5ub3Qgb3ZlcnJpZGUgbGFuZ3VhZ2UgbmFtZSBhbnltb3JlJywgKCkgPT4ge1xuXHRcdGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IExhbmd1YWdlc1JlZ2lzdHJ5KGZhbHNlKTtcblxuXHRcdHJlZ2lzdHJ5Ll9yZWdpc3Rlckxhbmd1YWdlcyhbe1xuXHRcdFx0aWQ6ICdsYW5nSWQnLFxuXHRcdFx0ZXh0ZW5zaW9uczogWycuZXh0MSddLFxuXHRcdFx0YWxpYXNlczogWydMYW5nTmFtZSddLFxuXHRcdFx0bWltZXR5cGVzOiBbJ2JsYSddLFxuXHRcdH1dKTtcblxuXHRcdHJlZ2lzdHJ5Ll9yZWdpc3Rlckxhbmd1YWdlcyhbe1xuXHRcdFx0aWQ6ICdsYW5nSWQnLFxuXHRcdFx0ZXh0ZW5zaW9uczogWycuZXh0MiddLFxuXHRcdFx0YWxpYXNlczogWydCZXR0ZXJMYW5ndWFnZU5hbWUnXSxcblx0XHRcdG1pbWV0eXBlczogWydibGEnXSxcblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZ2lzdHJ5LmdldFNvcnRlZFJlZ2lzdGVyZWRMYW5ndWFnZU5hbWVzKCksIFt7IGxhbmd1YWdlTmFtZTogJ0JldHRlckxhbmd1YWdlTmFtZScsIGxhbmd1YWdlSWQ6ICdsYW5nSWQnIH1dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZ2lzdHJ5LmdldExhbmd1YWdlTmFtZSgnbGFuZ0lkJyksICdCZXR0ZXJMYW5ndWFnZU5hbWUnKTtcblxuXHRcdHJlZ2lzdHJ5LmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnbWltZXR5cGVzIGFyZSBnZW5lcmF0ZWQgaWYgbmVjZXNzYXJ5JywgKCkgPT4ge1xuXHRcdGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IExhbmd1YWdlc1JlZ2lzdHJ5KGZhbHNlKTtcblxuXHRcdHJlZ2lzdHJ5Ll9yZWdpc3Rlckxhbmd1YWdlcyhbe1xuXHRcdFx0aWQ6ICdsYW5nSWQnXG5cdFx0fV0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWdpc3RyeS5nZXRNaW1lVHlwZSgnbGFuZ0lkJyksICd0ZXh0L3gtbGFuZ0lkJyk7XG5cblx0XHRyZWdpc3RyeS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpcnN0IG1pbWV0eXBlIHdpbnMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcmVnaXN0cnkgPSBuZXcgTGFuZ3VhZ2VzUmVnaXN0cnkoZmFsc2UpO1xuXG5cdFx0cmVnaXN0cnkuX3JlZ2lzdGVyTGFuZ3VhZ2VzKFt7XG5cdFx0XHRpZDogJ2xhbmdJZCcsXG5cdFx0XHRtaW1ldHlwZXM6IFsndGV4dC9sYW5nSWQnLCAndGV4dC9sYW5nSWQyJ11cblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZ2lzdHJ5LmdldE1pbWVUeXBlKCdsYW5nSWQnKSwgJ3RleHQvbGFuZ0lkJyk7XG5cblx0XHRyZWdpc3RyeS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpcnN0IG1pbWV0eXBlIHdpbnMgMicsICgpID0+IHtcblx0XHRjb25zdCByZWdpc3RyeSA9IG5ldyBMYW5ndWFnZXNSZWdpc3RyeShmYWxzZSk7XG5cblx0XHRyZWdpc3RyeS5fcmVnaXN0ZXJMYW5ndWFnZXMoW3tcblx0XHRcdGlkOiAnbGFuZ0lkJ1xuXHRcdH1dKTtcblxuXHRcdHJlZ2lzdHJ5Ll9yZWdpc3Rlckxhbmd1YWdlcyhbe1xuXHRcdFx0aWQ6ICdsYW5nSWQnLFxuXHRcdFx0bWltZXR5cGVzOiBbJ3RleHQvbGFuZ0lkJ11cblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZ2lzdHJ5LmdldE1pbWVUeXBlKCdsYW5nSWQnKSwgJ3RleHQveC1sYW5nSWQnKTtcblxuXHRcdHJlZ2lzdHJ5LmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnYWxpYXNlcycsICgpID0+IHtcblx0XHRjb25zdCByZWdpc3RyeSA9IG5ldyBMYW5ndWFnZXNSZWdpc3RyeShmYWxzZSk7XG5cblx0XHRyZWdpc3RyeS5fcmVnaXN0ZXJMYW5ndWFnZXMoW3tcblx0XHRcdGlkOiAnYSdcblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZ2lzdHJ5LmdldFNvcnRlZFJlZ2lzdGVyZWRMYW5ndWFnZU5hbWVzKCksIFt7IGxhbmd1YWdlTmFtZTogJ2EnLCBsYW5ndWFnZUlkOiAnYScgfV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0TGFuZ3VhZ2VJZEJ5TGFuZ3VhZ2VOYW1lKCdhJyksICdhJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWdpc3RyeS5nZXRMYW5ndWFnZU5hbWUoJ2EnKSwgJ2EnKTtcblxuXHRcdHJlZ2lzdHJ5Ll9yZWdpc3Rlckxhbmd1YWdlcyhbe1xuXHRcdFx0aWQ6ICdhJyxcblx0XHRcdGFsaWFzZXM6IFsnQTEnLCAnQTInXVxuXHRcdH1dKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0U29ydGVkUmVnaXN0ZXJlZExhbmd1YWdlTmFtZXMoKSwgW3sgbGFuZ3VhZ2VOYW1lOiAnQTEnLCBsYW5ndWFnZUlkOiAnYScgfV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0TGFuZ3VhZ2VJZEJ5TGFuZ3VhZ2VOYW1lKCdhJyksICdhJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWdpc3RyeS5nZXRMYW5ndWFnZUlkQnlMYW5ndWFnZU5hbWUoJ2ExJyksICdhJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWdpc3RyeS5nZXRMYW5ndWFnZUlkQnlMYW5ndWFnZU5hbWUoJ2EyJyksICdhJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWdpc3RyeS5nZXRMYW5ndWFnZU5hbWUoJ2EnKSwgJ0ExJyk7XG5cblx0XHRyZWdpc3RyeS5fcmVnaXN0ZXJMYW5ndWFnZXMoW3tcblx0XHRcdGlkOiAnYScsXG5cdFx0XHRhbGlhc2VzOiBbJ0EzJywgJ0E0J11cblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZ2lzdHJ5LmdldFNvcnRlZFJlZ2lzdGVyZWRMYW5ndWFnZU5hbWVzKCksIFt7IGxhbmd1YWdlTmFtZTogJ0EzJywgbGFuZ3VhZ2VJZDogJ2EnIH1dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZ2lzdHJ5LmdldExhbmd1YWdlSWRCeUxhbmd1YWdlTmFtZSgnYScpLCAnYScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0TGFuZ3VhZ2VJZEJ5TGFuZ3VhZ2VOYW1lKCdhMScpLCAnYScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0TGFuZ3VhZ2VJZEJ5TGFuZ3VhZ2VOYW1lKCdhMicpLCAnYScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0TGFuZ3VhZ2VJZEJ5TGFuZ3VhZ2VOYW1lKCdhMycpLCAnYScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0TGFuZ3VhZ2VJZEJ5TGFuZ3VhZ2VOYW1lKCdhNCcpLCAnYScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0TGFuZ3VhZ2VOYW1lKCdhJyksICdBMycpO1xuXG5cdFx0cmVnaXN0cnkuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdlbXB0eSBhbGlhc2VzIGFycmF5IG1lYW5zIG5vIGFsaWFzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IExhbmd1YWdlc1JlZ2lzdHJ5KGZhbHNlKTtcblxuXHRcdHJlZ2lzdHJ5Ll9yZWdpc3Rlckxhbmd1YWdlcyhbe1xuXHRcdFx0aWQ6ICdhJ1xuXHRcdH1dKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0U29ydGVkUmVnaXN0ZXJlZExhbmd1YWdlTmFtZXMoKSwgW3sgbGFuZ3VhZ2VOYW1lOiAnYScsIGxhbmd1YWdlSWQ6ICdhJyB9XSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWdpc3RyeS5nZXRMYW5ndWFnZUlkQnlMYW5ndWFnZU5hbWUoJ2EnKSwgJ2EnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZ2lzdHJ5LmdldExhbmd1YWdlTmFtZSgnYScpLCAnYScpO1xuXG5cdFx0cmVnaXN0cnkuX3JlZ2lzdGVyTGFuZ3VhZ2VzKFt7XG5cdFx0XHRpZDogJ2InLFxuXHRcdFx0YWxpYXNlczogW11cblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZ2lzdHJ5LmdldFNvcnRlZFJlZ2lzdGVyZWRMYW5ndWFnZU5hbWVzKCksIFt7IGxhbmd1YWdlTmFtZTogJ2EnLCBsYW5ndWFnZUlkOiAnYScgfV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0TGFuZ3VhZ2VJZEJ5TGFuZ3VhZ2VOYW1lKCdhJyksICdhJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWdpc3RyeS5nZXRMYW5ndWFnZUlkQnlMYW5ndWFnZU5hbWUoJ2InKSwgJ2InKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZ2lzdHJ5LmdldExhbmd1YWdlTmFtZSgnYScpLCAnYScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0TGFuZ3VhZ2VOYW1lKCdiJyksIG51bGwpO1xuXG5cdFx0cmVnaXN0cnkuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdleHRlbnNpb25zJywgKCkgPT4ge1xuXHRcdGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IExhbmd1YWdlc1JlZ2lzdHJ5KGZhbHNlKTtcblxuXHRcdHJlZ2lzdHJ5Ll9yZWdpc3Rlckxhbmd1YWdlcyhbe1xuXHRcdFx0aWQ6ICdhJyxcblx0XHRcdGFsaWFzZXM6IFsnYU5hbWUnXSxcblx0XHRcdGV4dGVuc2lvbnM6IFsnYUV4dCddXG5cdFx0fV0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWdpc3RyeS5nZXRFeHRlbnNpb25zKCdhJyksIFsnYUV4dCddKTtcblxuXHRcdHJlZ2lzdHJ5Ll9yZWdpc3Rlckxhbmd1YWdlcyhbe1xuXHRcdFx0aWQ6ICdhJyxcblx0XHRcdGV4dGVuc2lvbnM6IFsnYUV4dDInXVxuXHRcdH1dKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0RXh0ZW5zaW9ucygnYScpLCBbJ2FFeHQnLCAnYUV4dDInXSk7XG5cblx0XHRyZWdpc3RyeS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V4dGVuc2lvbnMgb2YgcHJpbWFyeSBsYW5ndWFnZSByZWdpc3RyYXRpb24gY29tZSBmaXJzdCcsICgpID0+IHtcblx0XHRjb25zdCByZWdpc3RyeSA9IG5ldyBMYW5ndWFnZXNSZWdpc3RyeShmYWxzZSk7XG5cblx0XHRyZWdpc3RyeS5fcmVnaXN0ZXJMYW5ndWFnZXMoW3tcblx0XHRcdGlkOiAnYScsXG5cdFx0XHRleHRlbnNpb25zOiBbJ2FFeHQzJ11cblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZ2lzdHJ5LmdldEV4dGVuc2lvbnMoJ2EnKVswXSwgJ2FFeHQzJyk7XG5cblx0XHRyZWdpc3RyeS5fcmVnaXN0ZXJMYW5ndWFnZXMoW3tcblx0XHRcdGlkOiAnYScsXG5cdFx0XHRjb25maWd1cmF0aW9uOiBVUkkuZmlsZSgnY29uZi5qc29uJyksXG5cdFx0XHRleHRlbnNpb25zOiBbJ2FFeHQnXVxuXHRcdH1dKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0RXh0ZW5zaW9ucygnYScpWzBdLCAnYUV4dCcpO1xuXG5cdFx0cmVnaXN0cnkuX3JlZ2lzdGVyTGFuZ3VhZ2VzKFt7XG5cdFx0XHRpZDogJ2EnLFxuXHRcdFx0ZXh0ZW5zaW9uczogWydhRXh0MiddXG5cdFx0fV0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWdpc3RyeS5nZXRFeHRlbnNpb25zKCdhJylbMF0sICdhRXh0Jyk7XG5cblx0XHRyZWdpc3RyeS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpbGVuYW1lcycsICgpID0+IHtcblx0XHRjb25zdCByZWdpc3RyeSA9IG5ldyBMYW5ndWFnZXNSZWdpc3RyeShmYWxzZSk7XG5cblx0XHRyZWdpc3RyeS5fcmVnaXN0ZXJMYW5ndWFnZXMoW3tcblx0XHRcdGlkOiAnYScsXG5cdFx0XHRhbGlhc2VzOiBbJ2FOYW1lJ10sXG5cdFx0XHRmaWxlbmFtZXM6IFsnYUZpbGVuYW1lJ11cblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZ2lzdHJ5LmdldEZpbGVuYW1lcygnYScpLCBbJ2FGaWxlbmFtZSddKTtcblxuXHRcdHJlZ2lzdHJ5Ll9yZWdpc3Rlckxhbmd1YWdlcyhbe1xuXHRcdFx0aWQ6ICdhJyxcblx0XHRcdGZpbGVuYW1lczogWydhRmlsZW5hbWUyJ11cblx0XHR9XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZ2lzdHJ5LmdldEZpbGVuYW1lcygnYScpLCBbJ2FGaWxlbmFtZScsICdhRmlsZW5hbWUyJ10pO1xuXG5cdFx0cmVnaXN0cnkuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25maWd1cmF0aW9uJywgKCkgPT4ge1xuXHRcdGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IExhbmd1YWdlc1JlZ2lzdHJ5KGZhbHNlKTtcblxuXHRcdHJlZ2lzdHJ5Ll9yZWdpc3Rlckxhbmd1YWdlcyhbe1xuXHRcdFx0aWQ6ICdhJyxcblx0XHRcdGFsaWFzZXM6IFsnYU5hbWUnXSxcblx0XHRcdGNvbmZpZ3VyYXRpb246IFVSSS5maWxlKCcvcGF0aC90by9hRmlsZW5hbWUnKVxuXHRcdH1dKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0Q29uZmlndXJhdGlvbkZpbGVzKCdhJyksIFtVUkkuZmlsZSgnL3BhdGgvdG8vYUZpbGVuYW1lJyldKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZ2lzdHJ5LmdldENvbmZpZ3VyYXRpb25GaWxlcygnYW5hbWUnKSwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0Q29uZmlndXJhdGlvbkZpbGVzKCdhTmFtZScpLCBbXSk7XG5cblx0XHRyZWdpc3RyeS5fcmVnaXN0ZXJMYW5ndWFnZXMoW3tcblx0XHRcdGlkOiAnYScsXG5cdFx0XHRjb25maWd1cmF0aW9uOiBVUkkuZmlsZSgnL3BhdGgvdG8vYUZpbGVuYW1lMicpXG5cdFx0fV0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWdpc3RyeS5nZXRDb25maWd1cmF0aW9uRmlsZXMoJ2EnKSwgW1VSSS5maWxlKCcvcGF0aC90by9hRmlsZW5hbWUnKSwgVVJJLmZpbGUoJy9wYXRoL3RvL2FGaWxlbmFtZTInKV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVnaXN0cnkuZ2V0Q29uZmlndXJhdGlvbkZpbGVzKCdhbmFtZScpLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWdpc3RyeS5nZXRDb25maWd1cmF0aW9uRmlsZXMoJ2FOYW1lJyksIFtdKTtcblxuXHRcdHJlZ2lzdHJ5LmRpc3Bvc2UoKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLFdBQVc7QUFDcEIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyx5QkFBeUI7QUFFbEMsTUFBTSxxQkFBcUIsTUFBTTtBQUVoQywwQ0FBd0M7QUFFeEMsT0FBSyx3Q0FBd0MsTUFBTTtBQUNsRCxVQUFN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
