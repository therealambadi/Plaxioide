import { PreTrie, ExplorerFileNestingTrie, SufTrie } from "../../common/explorerFileNestingTrie.js";
import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
const fakeFilenameAttributes = { dirname: "mydir", basename: "", extname: "" };
suite("SufTrie", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("exactMatches", () => {
    const t = new SufTrie();
    t.add(".npmrc", "MyKey");
    assert.deepStrictEqual(t.get(".npmrc", fakeFilenameAttributes), ["MyKey"]);
    assert.deepStrictEqual(t.get(".npmrcs", fakeFilenameAttributes), []);
    assert.deepStrictEqual(t.get("a.npmrc", fakeFilenameAttributes), []);
  });
  test("starMatches", () => {
    const t = new SufTrie();
    t.add("*.npmrc", "MyKey");
    assert.deepStrictEqual(t.get(".npmrc", fakeFilenameAttributes), ["MyKey"]);
    assert.deepStrictEqual(t.get("npmrc", fakeFilenameAttributes), []);
    assert.deepStrictEqual(t.get(".npmrcs", fakeFilenameAttributes), []);
    assert.deepStrictEqual(t.get("a.npmrc", fakeFilenameAttributes), ["MyKey"]);
    assert.deepStrictEqual(t.get("a.b.c.d.npmrc", fakeFilenameAttributes), ["MyKey"]);
  });
  test("starSubstitutes", () => {
    const t = new SufTrie();
    t.add("*.npmrc", "${capture}.json");
    assert.deepStrictEqual(t.get(".npmrc", fakeFilenameAttributes), [".json"]);
    assert.deepStrictEqual(t.get("npmrc", fakeFilenameAttributes), []);
    assert.deepStrictEqual(t.get(".npmrcs", fakeFilenameAttributes), []);
    assert.deepStrictEqual(t.get("a.npmrc", fakeFilenameAttributes), ["a.json"]);
    assert.deepStrictEqual(t.get("a.b.c.d.npmrc", fakeFilenameAttributes), ["a.b.c.d.json"]);
  });
  test("multiMatches", () => {
    const t = new SufTrie();
    t.add("*.npmrc", "Key1");
    t.add("*.json", "Key2");
    t.add("*d.npmrc", "Key3");
    assert.deepStrictEqual(t.get(".npmrc", fakeFilenameAttributes), ["Key1"]);
    assert.deepStrictEqual(t.get("npmrc", fakeFilenameAttributes), []);
    assert.deepStrictEqual(t.get(".npmrcs", fakeFilenameAttributes), []);
    assert.deepStrictEqual(t.get(".json", fakeFilenameAttributes), ["Key2"]);
    assert.deepStrictEqual(t.get("a.json", fakeFilenameAttributes), ["Key2"]);
    assert.deepStrictEqual(t.get("a.npmrc", fakeFilenameAttributes), ["Key1"]);
    assert.deepStrictEqual(t.get("a.b.c.d.npmrc", fakeFilenameAttributes), ["Key1", "Key3"]);
  });
  test("multiSubstitutes", () => {
    const t = new SufTrie();
    t.add("*.npmrc", "Key1.${capture}.js");
    t.add("*.json", "Key2.${capture}.js");
    t.add("*d.npmrc", "Key3.${capture}.js");
    assert.deepStrictEqual(t.get(".npmrc", fakeFilenameAttributes), ["Key1..js"]);
    assert.deepStrictEqual(t.get("npmrc", fakeFilenameAttributes), []);
    assert.deepStrictEqual(t.get(".npmrcs", fakeFilenameAttributes), []);
    assert.deepStrictEqual(t.get(".json", fakeFilenameAttributes), ["Key2..js"]);
    assert.deepStrictEqual(t.get("a.json", fakeFilenameAttributes), ["Key2.a.js"]);
    assert.deepStrictEqual(t.get("a.npmrc", fakeFilenameAttributes), ["Key1.a.js"]);
    assert.deepStrictEqual(t.get("a.b.cd.npmrc", fakeFilenameAttributes), ["Key1.a.b.cd.js", "Key3.a.b.c.js"]);
    assert.deepStrictEqual(t.get("a.b.c.d.npmrc", fakeFilenameAttributes), ["Key1.a.b.c.d.js", "Key3.a.b.c..js"]);
  });
});
suite("PreTrie", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("exactMatches", () => {
    const t = new PreTrie();
    t.add(".npmrc", "MyKey");
    assert.deepStrictEqual(t.get(".npmrc", fakeFilenameAttributes), ["MyKey"]);
    assert.deepStrictEqual(t.get(".npmrcs", fakeFilenameAttributes), []);
    assert.deepStrictEqual(t.get("a.npmrc", fakeFilenameAttributes), []);
  });
  test("starMatches", () => {
    const t = new PreTrie();
    t.add("*.npmrc", "MyKey");
    assert.deepStrictEqual(t.get(".npmrc", fakeFilenameAttributes), ["MyKey"]);
    assert.deepStrictEqual(t.get("npmrc", fakeFilenameAttributes), []);
    assert.deepStrictEqual(t.get(".npmrcs", fakeFilenameAttributes), []);
    assert.deepStrictEqual(t.get("a.npmrc", fakeFilenameAttributes), ["MyKey"]);
    assert.deepStrictEqual(t.get("a.b.c.d.npmrc", fakeFilenameAttributes), ["MyKey"]);
  });
  test("starSubstitutes", () => {
    const t = new PreTrie();
    t.add("*.npmrc", "${capture}.json");
    assert.deepStrictEqual(t.get(".npmrc", fakeFilenameAttributes), [".json"]);
    assert.deepStrictEqual(t.get("npmrc", fakeFilenameAttributes), []);
    assert.deepStrictEqual(t.get(".npmrcs", fakeFilenameAttributes), []);
    assert.deepStrictEqual(t.get("a.npmrc", fakeFilenameAttributes), ["a.json"]);
    assert.deepStrictEqual(t.get("a.b.c.d.npmrc", fakeFilenameAttributes), ["a.b.c.d.json"]);
  });
  test("multiMatches", () => {
    const t = new PreTrie();
    t.add("*.npmrc", "Key1");
    t.add("*.json", "Key2");
    t.add("*d.npmrc", "Key3");
    assert.deepStrictEqual(t.get(".npmrc", fakeFilenameAttributes), ["Key1"]);
    assert.deepStrictEqual(t.get("npmrc", fakeFilenameAttributes), []);
    assert.deepStrictEqual(t.get(".npmrcs", fakeFilenameAttributes), []);
    assert.deepStrictEqual(t.get(".json", fakeFilenameAttributes), ["Key2"]);
    assert.deepStrictEqual(t.get("a.json", fakeFilenameAttributes), ["Key2"]);
    assert.deepStrictEqual(t.get("a.npmrc", fakeFilenameAttributes), ["Key1"]);
    assert.deepStrictEqual(t.get("a.b.c.d.npmrc", fakeFilenameAttributes), ["Key1", "Key3"]);
  });
  test("multiSubstitutes", () => {
    const t = new PreTrie();
    t.add("*.npmrc", "Key1.${capture}.js");
    t.add("*.json", "Key2.${capture}.js");
    t.add("*d.npmrc", "Key3.${capture}.js");
    assert.deepStrictEqual(t.get(".npmrc", fakeFilenameAttributes), ["Key1..js"]);
    assert.deepStrictEqual(t.get("npmrc", fakeFilenameAttributes), []);
    assert.deepStrictEqual(t.get(".npmrcs", fakeFilenameAttributes), []);
    assert.deepStrictEqual(t.get(".json", fakeFilenameAttributes), ["Key2..js"]);
    assert.deepStrictEqual(t.get("a.json", fakeFilenameAttributes), ["Key2.a.js"]);
    assert.deepStrictEqual(t.get("a.npmrc", fakeFilenameAttributes), ["Key1.a.js"]);
    assert.deepStrictEqual(t.get("a.b.cd.npmrc", fakeFilenameAttributes), ["Key1.a.b.cd.js", "Key3.a.b.c.js"]);
    assert.deepStrictEqual(t.get("a.b.c.d.npmrc", fakeFilenameAttributes), ["Key1.a.b.c.d.js", "Key3.a.b.c..js"]);
  });
  test("emptyMatches", () => {
    const t = new PreTrie();
    t.add("package*json", "package");
    assert.deepStrictEqual(t.get("package.json", fakeFilenameAttributes), ["package"]);
    assert.deepStrictEqual(t.get("packagejson", fakeFilenameAttributes), ["package"]);
    assert.deepStrictEqual(t.get("package-lock.json", fakeFilenameAttributes), ["package"]);
  });
});
suite("StarTrie", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const assertMapEquals = (actual, expected) => {
    const actualStr = [...actual.entries()].map((e) => `${e[0]} => [${[...e[1].keys()].join()}]`);
    const expectedStr = Object.entries(expected).map((e) => `${e[0]}: [${[e[1]].join()}]`);
    const bigMsg = actualStr + "===" + expectedStr;
    assert.strictEqual(actual.size, Object.keys(expected).length, bigMsg);
    for (const parent of actual.keys()) {
      const act = actual.get(parent);
      const exp = expected[parent];
      const str = [...act.keys()].join() + "===" + exp.join();
      const msg = bigMsg + "\n" + str;
      assert(act.size === exp.length, msg);
      for (const child of exp) {
        assert(act.has(child), msg);
      }
    }
  };
  test("does added extension nesting", () => {
    const t = new ExplorerFileNestingTrie([
      ["*", ["${capture}.*"]]
    ]);
    const nesting = t.nest([
      "file",
      "file.json",
      "boop.test",
      "boop.test1",
      "boop.test.1",
      "beep",
      "beep.test1",
      "beep.boop.test1",
      "beep.boop.test2",
      "beep.boop.a"
    ], "mydir");
    assertMapEquals(nesting, {
      "file": ["file.json"],
      "boop.test": ["boop.test.1"],
      "boop.test1": [],
      "beep": ["beep.test1", "beep.boop.test1", "beep.boop.test2", "beep.boop.a"]
    });
  });
  test("does ext specific nesting", () => {
    const t = new ExplorerFileNestingTrie([
      ["*.ts", ["${capture}.js"]],
      ["*.js", ["${capture}.map"]]
    ]);
    const nesting = t.nest([
      "a.ts",
      "a.js",
      "a.jss",
      "ab.js",
      "b.js",
      "b.map",
      "c.ts",
      "c.js",
      "c.map",
      "d.ts",
      "d.map"
    ], "mydir");
    assertMapEquals(nesting, {
      "a.ts": ["a.js"],
      "ab.js": [],
      "a.jss": [],
      "b.js": ["b.map"],
      "c.ts": ["c.js", "c.map"],
      "d.ts": [],
      "d.map": []
    });
  });
  test("handles loops", () => {
    const t = new ExplorerFileNestingTrie([
      ["*.a", ["${capture}.b", "${capture}.c"]],
      ["*.b", ["${capture}.a"]],
      ["*.c", ["${capture}.d"]],
      ["*.aa", ["${capture}.bb"]],
      ["*.bb", ["${capture}.cc", "${capture}.dd"]],
      ["*.cc", ["${capture}.aa"]],
      ["*.dd", ["${capture}.ee"]]
    ]);
    const nesting = t.nest([
      ".a",
      ".b",
      ".c",
      ".d",
      "a.a",
      "a.b",
      "a.d",
      "a.aa",
      "a.bb",
      "a.cc",
      "b.aa",
      "b.bb",
      "c.bb",
      "c.cc",
      "d.aa",
      "d.cc",
      "e.aa",
      "e.bb",
      "e.dd",
      "e.ee",
      "f.aa",
      "f.bb",
      "f.cc",
      "f.dd",
      "f.ee"
    ], "mydir");
    assertMapEquals(nesting, {
      ".a": [],
      ".b": [],
      ".c": [],
      ".d": [],
      "a.a": [],
      "a.b": [],
      "a.d": [],
      "a.aa": [],
      "a.bb": [],
      "a.cc": [],
      "b.aa": ["b.bb"],
      "c.bb": ["c.cc"],
      "d.cc": ["d.aa"],
      "e.aa": ["e.bb", "e.dd", "e.ee"],
      "f.aa": [],
      "f.bb": [],
      "f.cc": [],
      "f.dd": [],
      "f.ee": []
    });
  });
  test("does general bidirectional suffix matching", () => {
    const t = new ExplorerFileNestingTrie([
      ["*-vsdoc.js", ["${capture}.js"]],
      ["*.js", ["${capture}-vscdoc.js"]]
    ]);
    const nesting = t.nest([
      "a-vsdoc.js",
      "a.js",
      "b.js",
      "b-vscdoc.js"
    ], "mydir");
    assertMapEquals(nesting, {
      "a-vsdoc.js": ["a.js"],
      "b.js": ["b-vscdoc.js"]
    });
  });
  test("does general bidirectional prefix matching", () => {
    const t = new ExplorerFileNestingTrie([
      ["vsdoc-*.js", ["${capture}.js"]],
      ["*.js", ["vscdoc-${capture}.js"]]
    ]);
    const nesting = t.nest([
      "vsdoc-a.js",
      "a.js",
      "b.js",
      "vscdoc-b.js"
    ], "mydir");
    assertMapEquals(nesting, {
      "vsdoc-a.js": ["a.js"],
      "b.js": ["vscdoc-b.js"]
    });
  });
  test("does general bidirectional general matching", () => {
    const t = new ExplorerFileNestingTrie([
      ["foo-*-bar.js", ["${capture}.js"]],
      ["*.js", ["bib-${capture}-bap.js"]]
    ]);
    const nesting = t.nest([
      "foo-a-bar.js",
      "a.js",
      "b.js",
      "bib-b-bap.js"
    ], "mydir");
    assertMapEquals(nesting, {
      "foo-a-bar.js": ["a.js"],
      "b.js": ["bib-b-bap.js"]
    });
  });
  test("does extension specific path segment matching", () => {
    const t = new ExplorerFileNestingTrie([
      ["*.js", ["${capture}.*.js"]]
    ]);
    const nesting = t.nest([
      "foo.js",
      "foo.test.js",
      "fooTest.js",
      "bar.js.js"
    ], "mydir");
    assertMapEquals(nesting, {
      "foo.js": ["foo.test.js"],
      "fooTest.js": [],
      "bar.js.js": []
    });
  });
  test("does exact match nesting", () => {
    const t = new ExplorerFileNestingTrie([
      ["package.json", [".npmrc", "npm-shrinkwrap.json", "yarn.lock", ".yarnclean", ".yarnignore", ".yarn-integrity", ".yarnrc"]],
      ["bower.json", [".bowerrc"]]
    ]);
    const nesting = t.nest([
      "package.json",
      ".npmrc",
      "npm-shrinkwrap.json",
      "yarn.lock",
      ".bowerrc"
    ], "mydir");
    assertMapEquals(nesting, {
      "package.json": [
        ".npmrc",
        "npm-shrinkwrap.json",
        "yarn.lock"
      ],
      ".bowerrc": []
    });
  });
  test("eslint test", () => {
    const t = new ExplorerFileNestingTrie([
      [".eslintrc*", [".eslint*"]]
    ]);
    const nesting1 = t.nest([
      ".eslintrc.json",
      ".eslintignore"
    ], "mydir");
    assertMapEquals(nesting1, {
      ".eslintrc.json": [".eslintignore"]
    });
    const nesting2 = t.nest([
      ".eslintrc",
      ".eslintignore"
    ], "mydir");
    assertMapEquals(nesting2, {
      ".eslintrc": [".eslintignore"]
    });
  });
  test("basename expansion", () => {
    const t = new ExplorerFileNestingTrie([
      ["*-vsdoc.js", ["${basename}.doc"]]
    ]);
    const nesting1 = t.nest([
      "boop-vsdoc.js",
      "boop-vsdoc.doc",
      "boop.doc"
    ], "mydir");
    assertMapEquals(nesting1, {
      "boop-vsdoc.js": ["boop-vsdoc.doc"],
      "boop.doc": []
    });
  });
  test("extname expansion", () => {
    const t = new ExplorerFileNestingTrie([
      ["*-vsdoc.js", ["${extname}.doc"]]
    ]);
    const nesting1 = t.nest([
      "boop-vsdoc.js",
      "js.doc",
      "boop.doc"
    ], "mydir");
    assertMapEquals(nesting1, {
      "boop-vsdoc.js": ["js.doc"],
      "boop.doc": []
    });
  });
  test("added segment matcher", () => {
    const t = new ExplorerFileNestingTrie([
      ["*", ["${basename}.*.${extname}"]]
    ]);
    const nesting1 = t.nest([
      "some.file",
      "some.html.file",
      "some.html.nested.file",
      "other.file",
      "some.thing",
      "some.thing.else"
    ], "mydir");
    assertMapEquals(nesting1, {
      "some.file": ["some.html.file", "some.html.nested.file"],
      "other.file": [],
      "some.thing": [],
      "some.thing.else": []
    });
  });
  test("added segment matcher (old format)", () => {
    const t = new ExplorerFileNestingTrie([
      ["*", ["$(basename).*.$(extname)"]]
    ]);
    const nesting1 = t.nest([
      "some.file",
      "some.html.file",
      "some.html.nested.file",
      "other.file",
      "some.thing",
      "some.thing.else"
    ], "mydir");
    assertMapEquals(nesting1, {
      "some.file": ["some.html.file", "some.html.nested.file"],
      "other.file": [],
      "some.thing": [],
      "some.thing.else": []
    });
  });
  test("dirname matching", () => {
    const t = new ExplorerFileNestingTrie([
      ["index.ts", ["${dirname}.ts"]]
    ]);
    const nesting1 = t.nest([
      "otherFile.ts",
      "MyComponent.ts",
      "index.ts"
    ], "MyComponent");
    assertMapEquals(nesting1, {
      "index.ts": ["MyComponent.ts"],
      "otherFile.ts": []
    });
  });
  test.skip("is fast", () => {
    const bigNester = new ExplorerFileNestingTrie([
      ["*", ["${capture}.*"]],
      ["*.js", ["${capture}.*.js", "${capture}.map"]],
      ["*.jsx", ["${capture}.js"]],
      ["*.ts", ["${capture}.js", "${capture}.*.ts"]],
      ["*.tsx", ["${capture}.js"]],
      ["*.css", ["${capture}.*.css", "${capture}.map"]],
      ["*.html", ["${capture}.*.html"]],
      ["*.htm", ["${capture}.*.htm"]],
      ["*.less", ["${capture}.*.less", "${capture}.css"]],
      ["*.scss", ["${capture}.*.scss", "${capture}.css"]],
      ["*.sass", ["${capture}.css"]],
      ["*.styl", ["${capture}.css"]],
      ["*.coffee", ["${capture}.*.coffee", "${capture}.js"]],
      ["*.iced", ["${capture}.*.iced", "${capture}.js"]],
      ["*.config", ["${capture}.*.config"]],
      ["*.cs", ["${capture}.*.cs", "${capture}.cs.d.ts"]],
      ["*.vb", ["${capture}.*.vb"]],
      ["*.json", ["${capture}.*.json"]],
      ["*.md", ["${capture}.html"]],
      ["*.mdown", ["${capture}.html"]],
      ["*.markdown", ["${capture}.html"]],
      ["*.mdwn", ["${capture}.html"]],
      ["*.svg", ["${capture}.svgz"]],
      ["*.a", ["${capture}.b"]],
      ["*.b", ["${capture}.a"]],
      ["*.resx", ["${capture}.designer.cs"]],
      ["package.json", [".npmrc", "npm-shrinkwrap.json", "yarn.lock", ".yarnclean", ".yarnignore", ".yarn-integrity", ".yarnrc"]],
      ["bower.json", [".bowerrc"]],
      ["*-vsdoc.js", ["${capture}.js"]],
      ["*.tt", ["${capture}.*"]]
    ]);
    const bigFiles = Array.from({ length: 5e4 / 6 }).map((_, i) => [
      "file" + i + ".js",
      "file" + i + ".map",
      "file" + i + ".css",
      "file" + i + ".ts",
      "file" + i + ".d.ts",
      "file" + i + ".jsx"
    ]).flat();
    const start = performance.now();
    bigNester.nest(bigFiles, "mydir");
    const end = performance.now();
    assert(end - start < 1e3, "too slow..." + (end - start));
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy90ZXN0L2Jyb3dzZXIvZXhwbG9yZXJGaWxlTmVzdGluZ1RyaWUudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgeyBQcmVUcmllLCBFeHBsb3JlckZpbGVOZXN0aW5nVHJpZSwgU3VmVHJpZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHBsb3JlckZpbGVOZXN0aW5nVHJpZS5qcyc7XG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcblxuY29uc3QgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyA9IHsgZGlybmFtZTogJ215ZGlyJywgYmFzZW5hbWU6ICcnLCBleHRuYW1lOiAnJyB9O1xuXG5zdWl0ZSgnU3VmVHJpZScsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnZXhhY3RNYXRjaGVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHQgPSBuZXcgU3VmVHJpZSgpO1xuXHRcdHQuYWRkKCcubnBtcmMnLCAnTXlLZXknKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCcubnBtcmMnLCBmYWtlRmlsZW5hbWVBdHRyaWJ1dGVzKSwgWydNeUtleSddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCcubnBtcmNzJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCdhLm5wbXJjJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnc3Rhck1hdGNoZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgdCA9IG5ldyBTdWZUcmllKCk7XG5cdFx0dC5hZGQoJyoubnBtcmMnLCAnTXlLZXknKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCcubnBtcmMnLCBmYWtlRmlsZW5hbWVBdHRyaWJ1dGVzKSwgWydNeUtleSddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCducG1yYycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnLm5wbXJjcycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnYS5ucG1yYycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbJ015S2V5J10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5nZXQoJ2EuYi5jLmQubnBtcmMnLCBmYWtlRmlsZW5hbWVBdHRyaWJ1dGVzKSwgWydNeUtleSddKTtcblx0fSk7XG5cblx0dGVzdCgnc3RhclN1YnN0aXR1dGVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHQgPSBuZXcgU3VmVHJpZSgpO1xuXHRcdHQuYWRkKCcqLm5wbXJjJywgJyR7Y2FwdHVyZX0uanNvbicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5nZXQoJy5ucG1yYycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbJy5qc29uJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5nZXQoJ25wbXJjJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCcubnBtcmNzJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCdhLm5wbXJjJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFsnYS5qc29uJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5nZXQoJ2EuYi5jLmQubnBtcmMnLCBmYWtlRmlsZW5hbWVBdHRyaWJ1dGVzKSwgWydhLmIuYy5kLmpzb24nXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpTWF0Y2hlcycsICgpID0+IHtcblx0XHRjb25zdCB0ID0gbmV3IFN1ZlRyaWUoKTtcblx0XHR0LmFkZCgnKi5ucG1yYycsICdLZXkxJyk7XG5cdFx0dC5hZGQoJyouanNvbicsICdLZXkyJyk7XG5cdFx0dC5hZGQoJypkLm5wbXJjJywgJ0tleTMnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCcubnBtcmMnLCBmYWtlRmlsZW5hbWVBdHRyaWJ1dGVzKSwgWydLZXkxJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5nZXQoJ25wbXJjJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCcubnBtcmNzJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCcuanNvbicsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbJ0tleTInXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnYS5qc29uJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFsnS2V5MiddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCdhLm5wbXJjJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFsnS2V5MSddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCdhLmIuYy5kLm5wbXJjJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFsnS2V5MScsICdLZXkzJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdtdWx0aVN1YnN0aXR1dGVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHQgPSBuZXcgU3VmVHJpZSgpO1xuXHRcdHQuYWRkKCcqLm5wbXJjJywgJ0tleTEuJHtjYXB0dXJlfS5qcycpO1xuXHRcdHQuYWRkKCcqLmpzb24nLCAnS2V5Mi4ke2NhcHR1cmV9LmpzJyk7XG5cdFx0dC5hZGQoJypkLm5wbXJjJywgJ0tleTMuJHtjYXB0dXJlfS5qcycpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5nZXQoJy5ucG1yYycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbJ0tleTEuLmpzJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5nZXQoJ25wbXJjJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCcubnBtcmNzJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCcuanNvbicsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbJ0tleTIuLmpzJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5nZXQoJ2EuanNvbicsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbJ0tleTIuYS5qcyddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCdhLm5wbXJjJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFsnS2V5MS5hLmpzJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5nZXQoJ2EuYi5jZC5ucG1yYycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbJ0tleTEuYS5iLmNkLmpzJywgJ0tleTMuYS5iLmMuanMnXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnYS5iLmMuZC5ucG1yYycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbJ0tleTEuYS5iLmMuZC5qcycsICdLZXkzLmEuYi5jLi5qcyddKTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ1ByZVRyaWUnLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2V4YWN0TWF0Y2hlcycsICgpID0+IHtcblx0XHRjb25zdCB0ID0gbmV3IFByZVRyaWUoKTtcblx0XHR0LmFkZCgnLm5wbXJjJywgJ015S2V5Jyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnLm5wbXJjJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFsnTXlLZXknXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnLm5wbXJjcycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnYS5ucG1yYycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N0YXJNYXRjaGVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHQgPSBuZXcgUHJlVHJpZSgpO1xuXHRcdHQuYWRkKCcqLm5wbXJjJywgJ015S2V5Jyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnLm5wbXJjJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFsnTXlLZXknXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnbnBtcmMnLCBmYWtlRmlsZW5hbWVBdHRyaWJ1dGVzKSwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5nZXQoJy5ucG1yY3MnLCBmYWtlRmlsZW5hbWVBdHRyaWJ1dGVzKSwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5nZXQoJ2EubnBtcmMnLCBmYWtlRmlsZW5hbWVBdHRyaWJ1dGVzKSwgWydNeUtleSddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCdhLmIuYy5kLm5wbXJjJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFsnTXlLZXknXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N0YXJTdWJzdGl0dXRlcycsICgpID0+IHtcblx0XHRjb25zdCB0ID0gbmV3IFByZVRyaWUoKTtcblx0XHR0LmFkZCgnKi5ucG1yYycsICcke2NhcHR1cmV9Lmpzb24nKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCcubnBtcmMnLCBmYWtlRmlsZW5hbWVBdHRyaWJ1dGVzKSwgWycuanNvbiddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCducG1yYycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnLm5wbXJjcycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnYS5ucG1yYycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbJ2EuanNvbiddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCdhLmIuYy5kLm5wbXJjJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFsnYS5iLmMuZC5qc29uJ10pO1xuXHR9KTtcblxuXHR0ZXN0KCdtdWx0aU1hdGNoZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgdCA9IG5ldyBQcmVUcmllKCk7XG5cdFx0dC5hZGQoJyoubnBtcmMnLCAnS2V5MScpO1xuXHRcdHQuYWRkKCcqLmpzb24nLCAnS2V5MicpO1xuXHRcdHQuYWRkKCcqZC5ucG1yYycsICdLZXkzJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnLm5wbXJjJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFsnS2V5MSddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCducG1yYycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnLm5wbXJjcycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnLmpzb24nLCBmYWtlRmlsZW5hbWVBdHRyaWJ1dGVzKSwgWydLZXkyJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5nZXQoJ2EuanNvbicsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbJ0tleTInXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnYS5ucG1yYycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbJ0tleTEnXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnYS5iLmMuZC5ucG1yYycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbJ0tleTEnLCAnS2V5MyddKTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGlTdWJzdGl0dXRlcycsICgpID0+IHtcblx0XHRjb25zdCB0ID0gbmV3IFByZVRyaWUoKTtcblx0XHR0LmFkZCgnKi5ucG1yYycsICdLZXkxLiR7Y2FwdHVyZX0uanMnKTtcblx0XHR0LmFkZCgnKi5qc29uJywgJ0tleTIuJHtjYXB0dXJlfS5qcycpO1xuXHRcdHQuYWRkKCcqZC5ucG1yYycsICdLZXkzLiR7Y2FwdHVyZX0uanMnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCcubnBtcmMnLCBmYWtlRmlsZW5hbWVBdHRyaWJ1dGVzKSwgWydLZXkxLi5qcyddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCducG1yYycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnLm5wbXJjcycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnLmpzb24nLCBmYWtlRmlsZW5hbWVBdHRyaWJ1dGVzKSwgWydLZXkyLi5qcyddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCdhLmpzb24nLCBmYWtlRmlsZW5hbWVBdHRyaWJ1dGVzKSwgWydLZXkyLmEuanMnXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgnYS5ucG1yYycsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbJ0tleTEuYS5qcyddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHQuZ2V0KCdhLmIuY2QubnBtcmMnLCBmYWtlRmlsZW5hbWVBdHRyaWJ1dGVzKSwgWydLZXkxLmEuYi5jZC5qcycsICdLZXkzLmEuYi5jLmpzJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5nZXQoJ2EuYi5jLmQubnBtcmMnLCBmYWtlRmlsZW5hbWVBdHRyaWJ1dGVzKSwgWydLZXkxLmEuYi5jLmQuanMnLCAnS2V5My5hLmIuYy4uanMnXSk7XG5cdH0pO1xuXG5cblx0dGVzdCgnZW1wdHlNYXRjaGVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHQgPSBuZXcgUHJlVHJpZSgpO1xuXHRcdHQuYWRkKCdwYWNrYWdlKmpzb24nLCAncGFja2FnZScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5nZXQoJ3BhY2thZ2UuanNvbicsIGZha2VGaWxlbmFtZUF0dHJpYnV0ZXMpLCBbJ3BhY2thZ2UnXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0LmdldCgncGFja2FnZWpzb24nLCBmYWtlRmlsZW5hbWVBdHRyaWJ1dGVzKSwgWydwYWNrYWdlJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodC5nZXQoJ3BhY2thZ2UtbG9jay5qc29uJywgZmFrZUZpbGVuYW1lQXR0cmlidXRlcyksIFsncGFja2FnZSddKTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ1N0YXJUcmllJywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRjb25zdCBhc3NlcnRNYXBFcXVhbHMgPSAoYWN0dWFsOiBNYXA8c3RyaW5nLCBTZXQ8c3RyaW5nPj4sIGV4cGVjdGVkOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmdbXT4pID0+IHtcblx0XHRjb25zdCBhY3R1YWxTdHIgPSBbLi4uYWN0dWFsLmVudHJpZXMoKV0ubWFwKGUgPT4gYCR7ZVswXX0gPT4gWyR7Wy4uLmVbMV0ua2V5cygpXS5qb2luKCl9XWApO1xuXHRcdGNvbnN0IGV4cGVjdGVkU3RyID0gT2JqZWN0LmVudHJpZXMoZXhwZWN0ZWQpLm1hcChlID0+IGAke2VbMF19OiBbJHtbZVsxXV0uam9pbigpfV1gKTtcblx0XHRjb25zdCBiaWdNc2cgPSBhY3R1YWxTdHIgKyAnPT09JyArIGV4cGVjdGVkU3RyO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuc2l6ZSwgT2JqZWN0LmtleXMoZXhwZWN0ZWQpLmxlbmd0aCwgYmlnTXNnKTtcblx0XHRmb3IgKGNvbnN0IHBhcmVudCBvZiBhY3R1YWwua2V5cygpKSB7XG5cdFx0XHRjb25zdCBhY3QgPSBhY3R1YWwuZ2V0KHBhcmVudCkhO1xuXHRcdFx0Y29uc3QgZXhwID0gZXhwZWN0ZWRbcGFyZW50XTtcblx0XHRcdGNvbnN0IHN0ciA9IFsuLi5hY3Qua2V5cygpXS5qb2luKCkgKyAnPT09JyArIGV4cC5qb2luKCk7XG5cdFx0XHRjb25zdCBtc2cgPSBiaWdNc2cgKyAnXFxuJyArIHN0cjtcblx0XHRcdGFzc2VydChhY3Quc2l6ZSA9PT0gZXhwLmxlbmd0aCwgbXNnKTtcblx0XHRcdGZvciAoY29uc3QgY2hpbGQgb2YgZXhwKSB7XG5cdFx0XHRcdGFzc2VydChhY3QuaGFzKGNoaWxkKSwgbXNnKTtcblx0XHRcdH1cblx0XHR9XG5cdH07XG5cblx0dGVzdCgnZG9lcyBhZGRlZCBleHRlbnNpb24gbmVzdGluZycsICgpID0+IHtcblx0XHRjb25zdCB0ID0gbmV3IEV4cGxvcmVyRmlsZU5lc3RpbmdUcmllKFtcblx0XHRcdFsnKicsIFsnJHtjYXB0dXJlfS4qJ11dLFxuXHRcdF0pO1xuXHRcdGNvbnN0IG5lc3RpbmcgPSB0Lm5lc3QoW1xuXHRcdFx0J2ZpbGUnLFxuXHRcdFx0J2ZpbGUuanNvbicsXG5cdFx0XHQnYm9vcC50ZXN0Jyxcblx0XHRcdCdib29wLnRlc3QxJyxcblx0XHRcdCdib29wLnRlc3QuMScsXG5cdFx0XHQnYmVlcCcsXG5cdFx0XHQnYmVlcC50ZXN0MScsXG5cdFx0XHQnYmVlcC5ib29wLnRlc3QxJyxcblx0XHRcdCdiZWVwLmJvb3AudGVzdDInLFxuXHRcdFx0J2JlZXAuYm9vcC5hJyxcblx0XHRdLCAnbXlkaXInKTtcblx0XHRhc3NlcnRNYXBFcXVhbHMobmVzdGluZywge1xuXHRcdFx0J2ZpbGUnOiBbJ2ZpbGUuanNvbiddLFxuXHRcdFx0J2Jvb3AudGVzdCc6IFsnYm9vcC50ZXN0LjEnXSxcblx0XHRcdCdib29wLnRlc3QxJzogW10sXG5cdFx0XHQnYmVlcCc6IFsnYmVlcC50ZXN0MScsICdiZWVwLmJvb3AudGVzdDEnLCAnYmVlcC5ib29wLnRlc3QyJywgJ2JlZXAuYm9vcC5hJ11cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBleHQgc3BlY2lmaWMgbmVzdGluZycsICgpID0+IHtcblx0XHRjb25zdCB0ID0gbmV3IEV4cGxvcmVyRmlsZU5lc3RpbmdUcmllKFtcblx0XHRcdFsnKi50cycsIFsnJHtjYXB0dXJlfS5qcyddXSxcblx0XHRcdFsnKi5qcycsIFsnJHtjYXB0dXJlfS5tYXAnXV0sXG5cdFx0XSk7XG5cdFx0Y29uc3QgbmVzdGluZyA9IHQubmVzdChbXG5cdFx0XHQnYS50cycsXG5cdFx0XHQnYS5qcycsXG5cdFx0XHQnYS5qc3MnLFxuXHRcdFx0J2FiLmpzJyxcblx0XHRcdCdiLmpzJyxcblx0XHRcdCdiLm1hcCcsXG5cdFx0XHQnYy50cycsXG5cdFx0XHQnYy5qcycsXG5cdFx0XHQnYy5tYXAnLFxuXHRcdFx0J2QudHMnLFxuXHRcdFx0J2QubWFwJyxcblx0XHRdLCAnbXlkaXInKTtcblx0XHRhc3NlcnRNYXBFcXVhbHMobmVzdGluZywge1xuXHRcdFx0J2EudHMnOiBbJ2EuanMnXSxcblx0XHRcdCdhYi5qcyc6IFtdLFxuXHRcdFx0J2EuanNzJzogW10sXG5cdFx0XHQnYi5qcyc6IFsnYi5tYXAnXSxcblx0XHRcdCdjLnRzJzogWydjLmpzJywgJ2MubWFwJ10sXG5cdFx0XHQnZC50cyc6IFtdLFxuXHRcdFx0J2QubWFwJzogW10sXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2hhbmRsZXMgbG9vcHMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgdCA9IG5ldyBFeHBsb3JlckZpbGVOZXN0aW5nVHJpZShbXG5cdFx0XHRbJyouYScsIFsnJHtjYXB0dXJlfS5iJywgJyR7Y2FwdHVyZX0uYyddXSxcblx0XHRcdFsnKi5iJywgWycke2NhcHR1cmV9LmEnXV0sXG5cdFx0XHRbJyouYycsIFsnJHtjYXB0dXJlfS5kJ11dLFxuXG5cdFx0XHRbJyouYWEnLCBbJyR7Y2FwdHVyZX0uYmInXV0sXG5cdFx0XHRbJyouYmInLCBbJyR7Y2FwdHVyZX0uY2MnLCAnJHtjYXB0dXJlfS5kZCddXSxcblx0XHRcdFsnKi5jYycsIFsnJHtjYXB0dXJlfS5hYSddXSxcblx0XHRcdFsnKi5kZCcsIFsnJHtjYXB0dXJlfS5lZSddXSxcblx0XHRdKTtcblx0XHRjb25zdCBuZXN0aW5nID0gdC5uZXN0KFtcblx0XHRcdCcuYScsICcuYicsICcuYycsICcuZCcsXG5cdFx0XHQnYS5hJywgJ2EuYicsICdhLmQnLFxuXHRcdFx0J2EuYWEnLCAnYS5iYicsICdhLmNjJyxcblx0XHRcdCdiLmFhJywgJ2IuYmInLFxuXHRcdFx0J2MuYmInLCAnYy5jYycsXG5cdFx0XHQnZC5hYScsICdkLmNjJyxcblx0XHRcdCdlLmFhJywgJ2UuYmInLCAnZS5kZCcsICdlLmVlJyxcblx0XHRcdCdmLmFhJywgJ2YuYmInLCAnZi5jYycsICdmLmRkJywgJ2YuZWUnLFxuXHRcdF0sICdteWRpcicpO1xuXG5cdFx0YXNzZXJ0TWFwRXF1YWxzKG5lc3RpbmcsIHtcblx0XHRcdCcuYSc6IFtdLCAnLmInOiBbXSwgJy5jJzogW10sICcuZCc6IFtdLFxuXHRcdFx0J2EuYSc6IFtdLCAnYS5iJzogW10sICdhLmQnOiBbXSxcblx0XHRcdCdhLmFhJzogW10sICdhLmJiJzogW10sICdhLmNjJzogW10sXG5cdFx0XHQnYi5hYSc6IFsnYi5iYiddLFxuXHRcdFx0J2MuYmInOiBbJ2MuY2MnXSxcblx0XHRcdCdkLmNjJzogWydkLmFhJ10sXG5cdFx0XHQnZS5hYSc6IFsnZS5iYicsICdlLmRkJywgJ2UuZWUnXSxcblx0XHRcdCdmLmFhJzogW10sICdmLmJiJzogW10sICdmLmNjJzogW10sICdmLmRkJzogW10sICdmLmVlJzogW11cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBnZW5lcmFsIGJpZGlyZWN0aW9uYWwgc3VmZml4IG1hdGNoaW5nJywgKCkgPT4ge1xuXHRcdGNvbnN0IHQgPSBuZXcgRXhwbG9yZXJGaWxlTmVzdGluZ1RyaWUoW1xuXHRcdFx0WycqLXZzZG9jLmpzJywgWycke2NhcHR1cmV9LmpzJ11dLFxuXHRcdFx0WycqLmpzJywgWycke2NhcHR1cmV9LXZzY2RvYy5qcyddXSxcblx0XHRdKTtcblxuXHRcdGNvbnN0IG5lc3RpbmcgPSB0Lm5lc3QoW1xuXHRcdFx0J2EtdnNkb2MuanMnLFxuXHRcdFx0J2EuanMnLFxuXHRcdFx0J2IuanMnLFxuXHRcdFx0J2ItdnNjZG9jLmpzJyxcblx0XHRdLCAnbXlkaXInKTtcblxuXHRcdGFzc2VydE1hcEVxdWFscyhuZXN0aW5nLCB7XG5cdFx0XHQnYS12c2RvYy5qcyc6IFsnYS5qcyddLFxuXHRcdFx0J2IuanMnOiBbJ2ItdnNjZG9jLmpzJ10sXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgZ2VuZXJhbCBiaWRpcmVjdGlvbmFsIHByZWZpeCBtYXRjaGluZycsICgpID0+IHtcblx0XHRjb25zdCB0ID0gbmV3IEV4cGxvcmVyRmlsZU5lc3RpbmdUcmllKFtcblx0XHRcdFsndnNkb2MtKi5qcycsIFsnJHtjYXB0dXJlfS5qcyddXSxcblx0XHRcdFsnKi5qcycsIFsndnNjZG9jLSR7Y2FwdHVyZX0uanMnXV0sXG5cdFx0XSk7XG5cblx0XHRjb25zdCBuZXN0aW5nID0gdC5uZXN0KFtcblx0XHRcdCd2c2RvYy1hLmpzJyxcblx0XHRcdCdhLmpzJyxcblx0XHRcdCdiLmpzJyxcblx0XHRcdCd2c2Nkb2MtYi5qcycsXG5cdFx0XSwgJ215ZGlyJyk7XG5cblx0XHRhc3NlcnRNYXBFcXVhbHMobmVzdGluZywge1xuXHRcdFx0J3ZzZG9jLWEuanMnOiBbJ2EuanMnXSxcblx0XHRcdCdiLmpzJzogWyd2c2Nkb2MtYi5qcyddLFxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdkb2VzIGdlbmVyYWwgYmlkaXJlY3Rpb25hbCBnZW5lcmFsIG1hdGNoaW5nJywgKCkgPT4ge1xuXHRcdGNvbnN0IHQgPSBuZXcgRXhwbG9yZXJGaWxlTmVzdGluZ1RyaWUoW1xuXHRcdFx0Wydmb28tKi1iYXIuanMnLCBbJyR7Y2FwdHVyZX0uanMnXV0sXG5cdFx0XHRbJyouanMnLCBbJ2JpYi0ke2NhcHR1cmV9LWJhcC5qcyddXSxcblx0XHRdKTtcblxuXHRcdGNvbnN0IG5lc3RpbmcgPSB0Lm5lc3QoW1xuXHRcdFx0J2Zvby1hLWJhci5qcycsXG5cdFx0XHQnYS5qcycsXG5cdFx0XHQnYi5qcycsXG5cdFx0XHQnYmliLWItYmFwLmpzJyxcblx0XHRdLCAnbXlkaXInKTtcblxuXHRcdGFzc2VydE1hcEVxdWFscyhuZXN0aW5nLCB7XG5cdFx0XHQnZm9vLWEtYmFyLmpzJzogWydhLmpzJ10sXG5cdFx0XHQnYi5qcyc6IFsnYmliLWItYmFwLmpzJ10sXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgZXh0ZW5zaW9uIHNwZWNpZmljIHBhdGggc2VnbWVudCBtYXRjaGluZycsICgpID0+IHtcblx0XHRjb25zdCB0ID0gbmV3IEV4cGxvcmVyRmlsZU5lc3RpbmdUcmllKFtcblx0XHRcdFsnKi5qcycsIFsnJHtjYXB0dXJlfS4qLmpzJ11dLFxuXHRcdF0pO1xuXG5cdFx0Y29uc3QgbmVzdGluZyA9IHQubmVzdChbXG5cdFx0XHQnZm9vLmpzJyxcblx0XHRcdCdmb28udGVzdC5qcycsXG5cdFx0XHQnZm9vVGVzdC5qcycsXG5cdFx0XHQnYmFyLmpzLmpzJyxcblx0XHRdLCAnbXlkaXInKTtcblxuXHRcdGFzc2VydE1hcEVxdWFscyhuZXN0aW5nLCB7XG5cdFx0XHQnZm9vLmpzJzogWydmb28udGVzdC5qcyddLFxuXHRcdFx0J2Zvb1Rlc3QuanMnOiBbXSxcblx0XHRcdCdiYXIuanMuanMnOiBbXSxcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZG9lcyBleGFjdCBtYXRjaCBuZXN0aW5nJywgKCkgPT4ge1xuXHRcdGNvbnN0IHQgPSBuZXcgRXhwbG9yZXJGaWxlTmVzdGluZ1RyaWUoW1xuXHRcdFx0WydwYWNrYWdlLmpzb24nLCBbJy5ucG1yYycsICducG0tc2hyaW5rd3JhcC5qc29uJywgJ3lhcm4ubG9jaycsICcueWFybmNsZWFuJywgJy55YXJuaWdub3JlJywgJy55YXJuLWludGVncml0eScsICcueWFybnJjJ11dLFxuXHRcdFx0Wydib3dlci5qc29uJywgWycuYm93ZXJyYyddXSxcblx0XHRdKTtcblxuXHRcdGNvbnN0IG5lc3RpbmcgPSB0Lm5lc3QoW1xuXHRcdFx0J3BhY2thZ2UuanNvbicsXG5cdFx0XHQnLm5wbXJjJywgJ25wbS1zaHJpbmt3cmFwLmpzb24nLCAneWFybi5sb2NrJyxcblx0XHRcdCcuYm93ZXJyYycsXG5cdFx0XSwgJ215ZGlyJyk7XG5cblx0XHRhc3NlcnRNYXBFcXVhbHMobmVzdGluZywge1xuXHRcdFx0J3BhY2thZ2UuanNvbic6IFtcblx0XHRcdFx0Jy5ucG1yYycsICducG0tc2hyaW5rd3JhcC5qc29uJywgJ3lhcm4ubG9jayddLFxuXHRcdFx0Jy5ib3dlcnJjJzogW10sXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VzbGludCB0ZXN0JywgKCkgPT4ge1xuXHRcdGNvbnN0IHQgPSBuZXcgRXhwbG9yZXJGaWxlTmVzdGluZ1RyaWUoW1xuXHRcdFx0WycuZXNsaW50cmMqJywgWycuZXNsaW50KiddXSxcblx0XHRdKTtcblxuXHRcdGNvbnN0IG5lc3RpbmcxID0gdC5uZXN0KFtcblx0XHRcdCcuZXNsaW50cmMuanNvbicsXG5cdFx0XHQnLmVzbGludGlnbm9yZScsXG5cdFx0XSwgJ215ZGlyJyk7XG5cblx0XHRhc3NlcnRNYXBFcXVhbHMobmVzdGluZzEsIHtcblx0XHRcdCcuZXNsaW50cmMuanNvbic6IFsnLmVzbGludGlnbm9yZSddLFxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgbmVzdGluZzIgPSB0Lm5lc3QoW1xuXHRcdFx0Jy5lc2xpbnRyYycsXG5cdFx0XHQnLmVzbGludGlnbm9yZScsXG5cdFx0XSwgJ215ZGlyJyk7XG5cblx0XHRhc3NlcnRNYXBFcXVhbHMobmVzdGluZzIsIHtcblx0XHRcdCcuZXNsaW50cmMnOiBbJy5lc2xpbnRpZ25vcmUnXSxcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnYmFzZW5hbWUgZXhwYW5zaW9uJywgKCkgPT4ge1xuXHRcdGNvbnN0IHQgPSBuZXcgRXhwbG9yZXJGaWxlTmVzdGluZ1RyaWUoW1xuXHRcdFx0WycqLXZzZG9jLmpzJywgWycke2Jhc2VuYW1lfS5kb2MnXV0sXG5cdFx0XSk7XG5cblx0XHRjb25zdCBuZXN0aW5nMSA9IHQubmVzdChbXG5cdFx0XHQnYm9vcC12c2RvYy5qcycsXG5cdFx0XHQnYm9vcC12c2RvYy5kb2MnLFxuXHRcdFx0J2Jvb3AuZG9jJyxcblx0XHRdLCAnbXlkaXInKTtcblxuXHRcdGFzc2VydE1hcEVxdWFscyhuZXN0aW5nMSwge1xuXHRcdFx0J2Jvb3AtdnNkb2MuanMnOiBbJ2Jvb3AtdnNkb2MuZG9jJ10sXG5cdFx0XHQnYm9vcC5kb2MnOiBbXSxcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZXh0bmFtZSBleHBhbnNpb24nLCAoKSA9PiB7XG5cdFx0Y29uc3QgdCA9IG5ldyBFeHBsb3JlckZpbGVOZXN0aW5nVHJpZShbXG5cdFx0XHRbJyotdnNkb2MuanMnLCBbJyR7ZXh0bmFtZX0uZG9jJ11dLFxuXHRcdF0pO1xuXG5cdFx0Y29uc3QgbmVzdGluZzEgPSB0Lm5lc3QoW1xuXHRcdFx0J2Jvb3AtdnNkb2MuanMnLFxuXHRcdFx0J2pzLmRvYycsXG5cdFx0XHQnYm9vcC5kb2MnLFxuXHRcdF0sICdteWRpcicpO1xuXG5cdFx0YXNzZXJ0TWFwRXF1YWxzKG5lc3RpbmcxLCB7XG5cdFx0XHQnYm9vcC12c2RvYy5qcyc6IFsnanMuZG9jJ10sXG5cdFx0XHQnYm9vcC5kb2MnOiBbXSxcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnYWRkZWQgc2VnbWVudCBtYXRjaGVyJywgKCkgPT4ge1xuXHRcdGNvbnN0IHQgPSBuZXcgRXhwbG9yZXJGaWxlTmVzdGluZ1RyaWUoW1xuXHRcdFx0WycqJywgWycke2Jhc2VuYW1lfS4qLiR7ZXh0bmFtZX0nXV0sXG5cdFx0XSk7XG5cblx0XHRjb25zdCBuZXN0aW5nMSA9IHQubmVzdChbXG5cdFx0XHQnc29tZS5maWxlJyxcblx0XHRcdCdzb21lLmh0bWwuZmlsZScsXG5cdFx0XHQnc29tZS5odG1sLm5lc3RlZC5maWxlJyxcblx0XHRcdCdvdGhlci5maWxlJyxcblx0XHRcdCdzb21lLnRoaW5nJyxcblx0XHRcdCdzb21lLnRoaW5nLmVsc2UnLFxuXHRcdF0sICdteWRpcicpO1xuXG5cdFx0YXNzZXJ0TWFwRXF1YWxzKG5lc3RpbmcxLCB7XG5cdFx0XHQnc29tZS5maWxlJzogWydzb21lLmh0bWwuZmlsZScsICdzb21lLmh0bWwubmVzdGVkLmZpbGUnXSxcblx0XHRcdCdvdGhlci5maWxlJzogW10sXG5cdFx0XHQnc29tZS50aGluZyc6IFtdLFxuXHRcdFx0J3NvbWUudGhpbmcuZWxzZSc6IFtdLFxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdhZGRlZCBzZWdtZW50IG1hdGNoZXIgKG9sZCBmb3JtYXQpJywgKCkgPT4ge1xuXHRcdGNvbnN0IHQgPSBuZXcgRXhwbG9yZXJGaWxlTmVzdGluZ1RyaWUoW1xuXHRcdFx0WycqJywgWyckKGJhc2VuYW1lKS4qLiQoZXh0bmFtZSknXV0sXG5cdFx0XSk7XG5cblx0XHRjb25zdCBuZXN0aW5nMSA9IHQubmVzdChbXG5cdFx0XHQnc29tZS5maWxlJyxcblx0XHRcdCdzb21lLmh0bWwuZmlsZScsXG5cdFx0XHQnc29tZS5odG1sLm5lc3RlZC5maWxlJyxcblx0XHRcdCdvdGhlci5maWxlJyxcblx0XHRcdCdzb21lLnRoaW5nJyxcblx0XHRcdCdzb21lLnRoaW5nLmVsc2UnLFxuXHRcdF0sICdteWRpcicpO1xuXG5cdFx0YXNzZXJ0TWFwRXF1YWxzKG5lc3RpbmcxLCB7XG5cdFx0XHQnc29tZS5maWxlJzogWydzb21lLmh0bWwuZmlsZScsICdzb21lLmh0bWwubmVzdGVkLmZpbGUnXSxcblx0XHRcdCdvdGhlci5maWxlJzogW10sXG5cdFx0XHQnc29tZS50aGluZyc6IFtdLFxuXHRcdFx0J3NvbWUudGhpbmcuZWxzZSc6IFtdLFxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdkaXJuYW1lIG1hdGNoaW5nJywgKCkgPT4ge1xuXHRcdGNvbnN0IHQgPSBuZXcgRXhwbG9yZXJGaWxlTmVzdGluZ1RyaWUoW1xuXHRcdFx0WydpbmRleC50cycsIFsnJHtkaXJuYW1lfS50cyddXSxcblx0XHRdKTtcblxuXHRcdGNvbnN0IG5lc3RpbmcxID0gdC5uZXN0KFtcblx0XHRcdCdvdGhlckZpbGUudHMnLFxuXHRcdFx0J015Q29tcG9uZW50LnRzJyxcblx0XHRcdCdpbmRleC50cycsXG5cdFx0XSwgJ015Q29tcG9uZW50Jyk7XG5cblx0XHRhc3NlcnRNYXBFcXVhbHMobmVzdGluZzEsIHtcblx0XHRcdCdpbmRleC50cyc6IFsnTXlDb21wb25lbnQudHMnXSxcblx0XHRcdCdvdGhlckZpbGUudHMnOiBbXSxcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdC5za2lwKCdpcyBmYXN0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGJpZ05lc3RlciA9IG5ldyBFeHBsb3JlckZpbGVOZXN0aW5nVHJpZShbXG5cdFx0XHRbJyonLCBbJyR7Y2FwdHVyZX0uKiddXSxcblx0XHRcdFsnKi5qcycsIFsnJHtjYXB0dXJlfS4qLmpzJywgJyR7Y2FwdHVyZX0ubWFwJ11dLFxuXHRcdFx0WycqLmpzeCcsIFsnJHtjYXB0dXJlfS5qcyddXSxcblx0XHRcdFsnKi50cycsIFsnJHtjYXB0dXJlfS5qcycsICcke2NhcHR1cmV9LioudHMnXV0sXG5cdFx0XHRbJyoudHN4JywgWycke2NhcHR1cmV9LmpzJ11dLFxuXHRcdFx0WycqLmNzcycsIFsnJHtjYXB0dXJlfS4qLmNzcycsICcke2NhcHR1cmV9Lm1hcCddXSxcblx0XHRcdFsnKi5odG1sJywgWycke2NhcHR1cmV9LiouaHRtbCddXSxcblx0XHRcdFsnKi5odG0nLCBbJyR7Y2FwdHVyZX0uKi5odG0nXV0sXG5cdFx0XHRbJyoubGVzcycsIFsnJHtjYXB0dXJlfS4qLmxlc3MnLCAnJHtjYXB0dXJlfS5jc3MnXV0sXG5cdFx0XHRbJyouc2NzcycsIFsnJHtjYXB0dXJlfS4qLnNjc3MnLCAnJHtjYXB0dXJlfS5jc3MnXV0sXG5cdFx0XHRbJyouc2FzcycsIFsnJHtjYXB0dXJlfS5jc3MnXV0sXG5cdFx0XHRbJyouc3R5bCcsIFsnJHtjYXB0dXJlfS5jc3MnXV0sXG5cdFx0XHRbJyouY29mZmVlJywgWycke2NhcHR1cmV9LiouY29mZmVlJywgJyR7Y2FwdHVyZX0uanMnXV0sXG5cdFx0XHRbJyouaWNlZCcsIFsnJHtjYXB0dXJlfS4qLmljZWQnLCAnJHtjYXB0dXJlfS5qcyddXSxcblx0XHRcdFsnKi5jb25maWcnLCBbJyR7Y2FwdHVyZX0uKi5jb25maWcnXV0sXG5cdFx0XHRbJyouY3MnLCBbJyR7Y2FwdHVyZX0uKi5jcycsICcke2NhcHR1cmV9LmNzLmQudHMnXV0sXG5cdFx0XHRbJyoudmInLCBbJyR7Y2FwdHVyZX0uKi52YiddXSxcblx0XHRcdFsnKi5qc29uJywgWycke2NhcHR1cmV9LiouanNvbiddXSxcblx0XHRcdFsnKi5tZCcsIFsnJHtjYXB0dXJlfS5odG1sJ11dLFxuXHRcdFx0WycqLm1kb3duJywgWycke2NhcHR1cmV9Lmh0bWwnXV0sXG5cdFx0XHRbJyoubWFya2Rvd24nLCBbJyR7Y2FwdHVyZX0uaHRtbCddXSxcblx0XHRcdFsnKi5tZHduJywgWycke2NhcHR1cmV9Lmh0bWwnXV0sXG5cdFx0XHRbJyouc3ZnJywgWycke2NhcHR1cmV9LnN2Z3onXV0sXG5cdFx0XHRbJyouYScsIFsnJHtjYXB0dXJlfS5iJ11dLFxuXHRcdFx0WycqLmInLCBbJyR7Y2FwdHVyZX0uYSddXSxcblx0XHRcdFsnKi5yZXN4JywgWycke2NhcHR1cmV9LmRlc2lnbmVyLmNzJ11dLFxuXHRcdFx0WydwYWNrYWdlLmpzb24nLCBbJy5ucG1yYycsICducG0tc2hyaW5rd3JhcC5qc29uJywgJ3lhcm4ubG9jaycsICcueWFybmNsZWFuJywgJy55YXJuaWdub3JlJywgJy55YXJuLWludGVncml0eScsICcueWFybnJjJ11dLFxuXHRcdFx0Wydib3dlci5qc29uJywgWycuYm93ZXJyYyddXSxcblx0XHRcdFsnKi12c2RvYy5qcycsIFsnJHtjYXB0dXJlfS5qcyddXSxcblx0XHRcdFsnKi50dCcsIFsnJHtjYXB0dXJlfS4qJ11dXG5cdFx0XSk7XG5cblx0XHRjb25zdCBiaWdGaWxlcyA9IEFycmF5LmZyb20oeyBsZW5ndGg6IDUwMDAwIC8gNiB9KS5tYXAoKF8sIGkpID0+IFtcblx0XHRcdCdmaWxlJyArIGkgKyAnLmpzJyxcblx0XHRcdCdmaWxlJyArIGkgKyAnLm1hcCcsXG5cdFx0XHQnZmlsZScgKyBpICsgJy5jc3MnLFxuXHRcdFx0J2ZpbGUnICsgaSArICcudHMnLFxuXHRcdFx0J2ZpbGUnICsgaSArICcuZC50cycsXG5cdFx0XHQnZmlsZScgKyBpICsgJy5qc3gnLFxuXHRcdF0pLmZsYXQoKTtcblxuXHRcdGNvbnN0IHN0YXJ0ID0gcGVyZm9ybWFuY2Uubm93KCk7XG5cdFx0Ly8gY29uc3QgX2JpZ1Jlc3VsdCA9XG5cdFx0YmlnTmVzdGVyLm5lc3QoYmlnRmlsZXMsICdteWRpcicpO1xuXHRcdGNvbnN0IGVuZCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuXHRcdGFzc2VydChlbmQgLSBzdGFydCA8IDEwMDAsICd0b28gc2xvdy4uLicgKyAoZW5kIC0gc3RhcnQpKTtcblx0XHQvLyBjb25zb2xlLmxvZyhiaWdSZXN1bHQpXG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFJQSxTQUFTLFNBQVMseUJBQXlCLGVBQWU7QUFDMUQsT0FBTyxZQUFZO0FBQ25CLFNBQVMsK0NBQStDO0FBRXhELE1BQU0seUJBQXlCLEVBQUUsU0FBUyxTQUFTLFVBQVUsSUFBSSxTQUFTLEdBQUc7QUFFN0UsTUFBTSxXQUFXLE1BQU07QUFDdEIsMENBQXdDO0FBRXhDLE9BQUssZ0JBQWdCLE1BQU07QUFDMUIsVUFBTSxJQUFJLElBQUksUUFBUTtBQUN0QixNQUFFLElBQUksVUFBVSxPQUFPO0FBQ3ZCLFdBQU8sZ0JBQWdCLEVBQUUsSUFBSSxVQUFVLHNCQUFzQixHQUFHLENBQUMsT0FBTyxDQUFDO0FBQ3pFLFdBQU8sZ0JBQWdCLEVBQUUsSUFBSSxXQUFXLHNCQUFzQixHQUFHLENBQUMsQ0FBQztBQUNuRSxXQUFPLGdCQUFnQixFQUFFLElBQUksV0FBVyxzQkFBc0IsR0FBRyxDQUFDLENBQUM7QUFBQSxFQUNwRSxDQUFDO0FBRUQsT0FBSyxlQUFlLE1BQU07QUFDekIsVUFBTSxJQUFJLElBQUksUUFB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
