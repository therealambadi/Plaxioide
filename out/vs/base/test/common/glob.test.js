import assert from "assert";
import * as glob from "../../common/glob.js";
import { sep } from "../../common/path.js";
import { isLinux, isMacintosh, isWindows } from "../../common/platform.js";
import { URI } from "../../common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "./utils.js";
suite("Glob", () => {
  function assertGlobMatch(pattern, input) {
    assert(glob.match(pattern, input), `${JSON.stringify(pattern)} should match ${input}`);
    assert(glob.match(pattern, nativeSep(input)), `${pattern} should match ${nativeSep(input)}`);
  }
  function assertNoGlobMatch(pattern, input) {
    assert(!glob.match(pattern, input), `${pattern} should not match ${input}`);
    assert(!glob.match(pattern, nativeSep(input)), `${pattern} should not match ${nativeSep(input)}`);
  }
  test("simple", () => {
    let p = "node_modules";
    assertGlobMatch(p, "node_modules");
    assertNoGlobMatch(p, "node_module");
    assertNoGlobMatch(p, "/node_modules");
    assertNoGlobMatch(p, "test/node_modules");
    p = "test.txt";
    assertGlobMatch(p, "test.txt");
    assertNoGlobMatch(p, "test?txt");
    assertNoGlobMatch(p, "/text.txt");
    assertNoGlobMatch(p, "test/test.txt");
    p = "test(.txt";
    assertGlobMatch(p, "test(.txt");
    assertNoGlobMatch(p, "test?txt");
    p = "qunit";
    assertGlobMatch(p, "qunit");
    assertNoGlobMatch(p, "qunit.css");
    assertNoGlobMatch(p, "test/qunit");
    p = "/DNXConsoleApp/**/*.cs";
    assertGlobMatch(p, "/DNXConsoleApp/Program.cs");
    assertGlobMatch(p, "/DNXConsoleApp/foo/Program.cs");
    p = "C:/DNXConsoleApp/**/*.cs";
    assertGlobMatch(p, "C:\\DNXConsoleApp\\Program.cs");
    assertGlobMatch(p, "C:\\DNXConsoleApp\\foo\\Program.cs");
    p = "*";
    assertGlobMatch(p, "");
  });
  test("dot hidden", function() {
    let p = ".*";
    assertGlobMatch(p, ".git");
    assertGlobMatch(p, ".hidden.txt");
    assertNoGlobMatch(p, "git");
    assertNoGlobMatch(p, "hidden.txt");
    assertNoGlobMatch(p, "path/.git");
    assertNoGlobMatch(p, "path/.hidden.txt");
    p = "**/.*";
    assertGlobMatch(p, ".git");
    assertGlobMatch(p, "/.git");
    assertGlobMatch(p, ".hidden.txt");
    assertNoGlobMatch(p, "git");
    assertNoGlobMatch(p, "hidden.txt");
    assertGlobMatch(p, "path/.git");
    assertGlobMatch(p, "path/.hidden.txt");
    assertGlobMatch(p, "/path/.git");
    assertGlobMatch(p, "/path/.hidden.txt");
    assertNoGlobMatch(p, "path/git");
    assertNoGlobMatch(p, "pat.h/hidden.txt");
    p = "._*";
    assertGlobMatch(p, "._git");
    assertGlobMatch(p, "._hidden.txt");
    assertNoGlobMatch(p, "git");
    assertNoGlobMatch(p, "hidden.txt");
    assertNoGlobMatch(p, "path/._git");
    assertNoGlobMatch(p, "path/._hidden.txt");
    p = "**/._*";
    assertGlobMatch(p, "._git");
    assertGlobMatch(p, "._hidden.txt");
    assertNoGlobMatch(p, "git");
    assertNoGlobMatch(p, "hidden._txt");
    assertGlobMatch(p, "path/._git");
    assertGlobMatch(p, "path/._hidden.txt");
    assertGlobMatch(p, "/path/._git");
    assertGlobMatch(p, "/path/._hidden.txt");
    assertNoGlobMatch(p, "path/git");
    assertNoGlobMatch(p, "pat.h/hidden._txt");
  });
  test("file pattern", function() {
    let p = "*.js";
    assertGlobMatch(p, "foo.js");
    assertNoGlobMatch(p, "folder/foo.js");
    assertNoGlobMatch(p, "/node_modules/foo.js");
    assertNoGlobMatch(p, "foo.jss");
    assertNoGlobMatch(p, "some.js/test");
    p = "html.*";
    assertGlobMatch(p, "html.js");
    assertGlobMatch(p, "html.txt");
    assertNoGlobMatch(p, "htm.txt");
    p = "*.*";
    assertGlobMatch(p, "html.js");
    assertGlobMatch(p, "html.txt");
    assertGlobMatch(p, "htm.txt");
    assertNoGlobMatch(p, "folder/foo.js");
    assertNoGlobMatch(p, "/node_modules/foo.js");
    p = "node_modules/test/*.js";
    assertGlobMatch(p, "node_modules/test/foo.js");
    assertNoGlobMatch(p, "folder/foo.js");
    assertNoGlobMatch(p, "/node_module/test/foo.js");
    assertNoGlobMatch(p, "foo.jss");
    assertNoGlobMatch(p, "some.js/test");
  });
  test("star", () => {
    let p = "node*modules";
    assertGlobMatch(p, "node_modules");
    assertGlobMatch(p, "node_super_modules");
    assertNoGlobMatch(p, "node_module");
    assertNoGlobMatch(p, "/node_modules");
    assertNoGlobMatch(p, "test/node_modules");
    p = "*";
    assertGlobMatch(p, "html.js");
    assertGlobMatch(p, "html.txt");
    assertGlobMatch(p, "htm.txt");
    assertNoGlobMatch(p, "folder/foo.js");
    assertNoGlobMatch(p, "/node_modules/foo.js");
  });
  test("file / folder match", function() {
    const p = "**/node_modules/**";
    assertGlobMatch(p, "node_modules");
    assertGlobMatch(p, "node_modules/");
    assertGlobMatch(p, "a/node_modules");
    assertGlobMatch(p, "a/node_modules/");
    assertGlobMatch(p, "node_modules/foo");
    assertGlobMatch(p, "foo/node_modules/foo/bar");
    assertGlobMatch(p, "/node_modules");
    assertGlobMatch(p, "/node_modules/");
    assertGlobMatch(p, "/a/node_modules");
    assertGlobMatch(p, "/a/node_modules/");
    assertGlobMatch(p, "/node_modules/foo");
    assertGlobMatch(p, "/foo/node_modules/foo/bar");
  });
  test("questionmark", () => {
    let p = "node?modules";
    assertGlobMatch(p, "node_modules");
    assertNoGlobMatch(p, "node_super_modules");
    assertNoGlobMatch(p, "node_module");
    assertNoGlobMatch(p, "/node_modules");
    assertNoGlobMatch(p, "test/node_modules");
    p = "?";
    assertGlobMatch(p, "h");
    assertNoGlobMatch(p, "html.txt");
    assertNoGlobMatch(p, "htm.txt");
    assertNoGlobMatch(p, "folder/foo.js");
    assertNoGlobMatch(p, "/node_modules/foo.js");
  });
  test("globstar", () => {
    let p = "**/*.js";
    assertGlobMatch(p, "foo.js");
    assertGlobMatch(p, "/foo.js");
    assertGlobMatch(p, "folder/foo.js");
    assertGlobMatch(p, "/node_modules/foo.js");
    assertNoGlobMatch(p, "foo.jss");
    assertNoGlobMatch(p, "some.js/test");
    assertNoGlobMatch(p, "/some.js/test");
    assertNoGlobMatch(p, "\\some.js\\test");
    p = "**/project.json";
    assertGlobMatch(p, "project.json");
    assertGlobMatch(p, "/project.json");
    assertGlobMatch(p, "some/folder/project.json");
    assertGlobMatch(p, "/some/folder/project.json");
    assertNoGlobMatch(p, "some/folder/file_project.json");
    assertNoGlobMatch(p, "some/folder/fileproject.json");
    assertNoGlobMatch(p, "some/rrproject.json");
    assertNoGlobMatch(p, "some\\rrproject.json");
    p = "test/**";
    assertGlobMatch(p, "test");
    assertGlobMatch(p, "test/foo");
    assertGlobMatch(p, "test/foo/");
    assertGlobMatch(p, "test/foo.js");
    assertGlobMatch(p, "test/other/foo.js");
    assertNoGlobMatch(p, "est/other/foo.js");
    p = "**";
    assertGlobMatch(p, "/");
    assertGlobMatch(p, "foo.js");
    assertGlobMatch(p, "folder/foo.js");
    assertGlobMatch(p, "folder/foo/");
    assertGlobMatch(p, "/node_modules/foo.js");
    assertGlobMatch(p, "foo.jss");
    assertGlobMatch(p, "some.js/test");
    p = "test/**/*.js";
    assertGlobMatch(p, "test/foo.js");
    assertGlobMatch(p, "test/other/foo.js");
    assertGlobMatch(p, "test/other/more/foo.js");
    assertNoGlobMatch(p, "test/foo.ts");
    assertNoGlobMatch(p, "test/other/foo.ts");
    assertNoGlobMatch(p, "test/other/more/foo.ts");
    p = "**/**/*.js";
    assertGlobMatch(p, "foo.js");
    assertGlobMatch(p, "/foo.js");
    assertGlobMatch(p, "folder/foo.js");
    assertGlobMatch(p, "/node_modules/foo.js");
    assertNoGlobMatch(p, "foo.jss");
    assertNoGlobMatch(p, "some.js/test");
    p = "**/node_modules/**/*.js";
    assertNoGlobMatch(p, "foo.js");
    assertNoGlobMatch(p, "folder/foo.js");
    assertGlobMatch(p, "node_modules/foo.js");
    assertGlobMatch(p, "/node_modules/foo.js");
    assertGlobMatch(p, "node_modules/some/folder/foo.js");
    assertGlobMatch(p, "/node_modules/some/folder/foo.js");
    assertNoGlobMatch(p, "node_modules/some/folder/foo.ts");
    assertNoGlobMatch(p, "foo.jss");
    assertNoGlobMatch(p, "some.js/test");
    p = "{**/node_modules/**,**/.git/**,**/bower_components/**}";
    assertGlobMatch(p, "node_modules");
    assertGlobMatch(p, "/node_modules");
    assertGlobMatch(p, "/node_modules/more");
    assertGlobMatch(p, "some/test/node_modules");
    assertGlobMatch(p, "some\\test\\node_modules");
    assertGlobMatch(p, "/some/test/node_modules");
    assertGlobMatch(p, "\\some\\test\\node_modules");
    assertGlobMatch(p, "C:\\\\some\\test\\node_modules");
    assertGlobMatch(p, "C:\\\\some\\test\\node_modules\\more");
    assertGlobMatch(p, "bower_components");
    assertGlobMatch(p, "bower_components/more");
    assertGlobMatch(p, "/bower_components");
    assertGlobMatch(p, "some/test/bower_components");
    assertGlobMatch(p, "some\\test\\bower_components");
    assertGlobMatch(p, "/some/test/bower_components");
    assertGlobMatch(p, "\\some\\test\\bower_components");
    assertGlobMatch(p, "C:\\\\some\\test\\bower_components");
    assertGlobMatch(p, "C:\\\\some\\test\\bower_components\\more");
    assertGlobMatch(p, ".git");
    assertGlobMatch(p, "/.git");
    assertGlobMatch(p, "some/test/.git");
    assertGlobMatch(p, "some\\test\\.git");
    assertGlobMatch(p, "/some/test/.git");
    assertGlobMatch(p, "\\some\\test\\.git");
    assertGlobMatch(p, "C:\\\\some\\test\\.git");
    assertNoGlobMatch(p, "tempting");
    assertNoGlobMatch(p, "/tempting");
    assertNoGlobMatch(p, "some/test/tempting");
    assertNoGlobMatch(p, "some\\test\\tempting");
    assertNoGlobMatch(p, "/some/test/tempting");
    assertNoGlobMatch(p, "\\some\\test\\tempting");
    assertNoGlobMatch(p, "C:\\\\some\\test\\tempting");
    p = "{**/package.json,**/project.json}";
    assertGlobMatch(p, "package.json");
    assertGlobMatch(p, "/package.json");
    assertNoGlobMatch(p, "xpackage.json");
    assertNoGlobMatch(p, "/xpackage.json");
  });
  test("issue 41724", function() {
    let p = "some/**/*.js";
    assertGlobMatch(p, "some/foo.js");
    assertGlobMatch(p, "some/folder/foo.js");
    assertNoGlobMatch(p, "something/foo.js");
    assertNoGlobMatch(p, "something/folder/foo.js");
    p = "some/**/*";
    assertGlobMatch(p, "some/foo.js");
    assertGlobMatch(p, "some/folder/foo.js");
    assertNoGlobMatch(p, "something/foo.js");
    assertNoGlobMatch(p, "something/folder/foo.js");
  });
  test("brace expansion", function() {
    let p = "*.{html,js}";
    assertGlobMatch(p, "foo.js");
    assertGlobMatch(p, "foo.html");
    assertNoGlobMatch(p, "folder/foo.js");
    assertNoGlobMatch(p, "/node_modules/foo.js");
    assertNoGlobMatch(p, "foo.jss");
    assertNoGlobMatch(p, "some.js/test");
    p = "*.{html}";
    assertGlobMatch(p, "foo.html");
    assertNoGlobMatch(p, "foo.js");
    assertNoGlobMatch(p, "folder/foo.js");
    assertNoGlobMatch(p, "/node_modules/foo.js");
    assertNoGlobMatch(p, "foo.jss");
    assertNoGlobMatch(p, "some.js/test");
    p = "{node_modules,testing}";
    assertGlobMatch(p, "node_modules");
    assertGlobMatch(p, "testing");
    assertNoGlobMatch(p, "node_module");
    assertNoGlobMatch(p, "dtesting");
    p = "**/{foo,bar}";
    assertGlobMatch(p, "foo");
    assertGlobMatch(p, "bar");
    assertGlobMatch(p, "test/foo");
    assertGlobMatch(p, "test/bar");
    assertGlobMatch(p, "other/more/foo");
    assertGlobMatch(p, "other/more/bar");
    assertGlobMatch(p, "/foo");
    assertGlobMatch(p, "/bar");
    assertGlobMatch(p, "/test/foo");
    assertGlobMatch(p, "/test/bar");
    assertGlobMatch(p, "/other/more/foo");
    assertGlobMatch(p, "/other/more/bar");
    p = "{foo,bar}/**";
    assertGlobMatch(p, "foo");
    assertGlobMatch(p, "bar");
    assertGlobMatch(p, "bar/");
    assertGlobMatch(p, "foo/test");
    assertGlobMatch(p, "bar/test");
    assertGlobMatch(p, "bar/test/");
    assertGlobMatch(p, "foo/other/more");
    assertGlobMatch(p, "bar/other/more");
    assertGlobMatch(p, "bar/other/more/");
    p = "{**/*.d.ts,**/*.js}";
    assertGlobMatch(p, "foo.js");
    assertGlobMatch(p, "testing/foo.js");
    assertGlobMatch(p, "testing\\foo.js");
    assertGlobMatch(p, "/testing/foo.js");
    assertGlobMatch(p, "\\testing\\foo.js");
    assertGlobMatch(p, "C:\\testing\\foo.js");
    assertGlobMatch(p, "foo.d.ts");
    assertGlobMatch(p, "testing/foo.d.ts");
    assertGlobMatch(p, "testing\\foo.d.ts");
    assertGlobMatch(p, "/testing/foo.d.ts");
    assertGlobMatch(p, "\\testing\\foo.d.ts");
    assertGlobMatch(p, "C:\\testing\\foo.d.ts");
    assertNoGlobMatch(p, "foo.d");
    assertNoGlobMatch(p, "testing/foo.d");
    assertNoGlobMatch(p, "testing\\foo.d");
    assertNoGlobMatch(p, "/testing/foo.d");
    assertNoGlobMatch(p, "\\testing\\foo.d");
    assertNoGlobMatch(p, "C:\\testing\\foo.d");
    p = "{**/*.d.ts,**/*.js,path/simple.jgs}";
    assertGlobMatch(p, "foo.js");
    assertGlobMatch(p, "testing/foo.js");
    assertGlobMatch(p, "testing\\foo.js");
    assertGlobMatch(p, "/testing/foo.js");
    assertGlobMatch(p, "path/simple.jgs");
    assertNoGlobMatch(p, "/path/simple.jgs");
    assertGlobMatch(p, "\\testing\\foo.js");
    assertGlobMatch(p, "C:\\testing\\foo.js");
    p = "{**/*.d.ts,**/*.js,foo.[0-9]}";
    assertGlobMatch(p, "foo.5");
    assertGlobMatch(p, "foo.8");
    assertNoGlobMatch(p, "bar.5");
    assertNoGlobMatch(p, "foo.f");
    assertGlobMatch(p, "foo.js");
    p = "prefix/{**/*.d.ts,**/*.js,foo.[0-9]}";
    assertGlobMatch(p, "prefix/foo.5");
    assertGlobMatch(p, "prefix/foo.8");
    assertNoGlobMatch(p, "prefix/bar.5");
    assertNoGlobMatch(p, "prefix/foo.f");
    assertGlobMatch(p, "prefix/foo.js");
  });
  test("expression support (single)", function() {
    const siblings = ["test.html", "test.txt", "test.ts", "test.js"];
    const hasSibling = (name) => siblings.indexOf(name) !== -1;
    let expression = {
      "**/*.js": {
        when: "$(basename).ts"
      }
    };
    assert.strictEqual("**/*.js", glob.match(expression, "test.js", hasSibling));
    assert.strictEqual(glob.match(expression, "test.js", () => false), null);
    assert.strictEqual(glob.match(expression, "test.js", (name) => name === "te.ts"), null);
    assert.strictEqual(glob.match(expression, "test.js"), null);
    expression = {
      "**/*.js": {
        when: ""
      }
    };
    assert.strictEqual(glob.match(expression, "test.js", hasSibling), null);
    expression = {
      "**/*.js": {}
    };
    assert.strictEqual("**/*.js", glob.match(expression, "test.js", hasSibling));
    expression = {};
    assert.strictEqual(glob.match(expression, "test.js", hasSibling), null);
  });
  test("expression support (multiple)", function() {
    const siblings = ["test.html", "test.txt", "test.ts", "test.js"];
    const hasSibling = (name) => siblings.indexOf(name) !== -1;
    const expression = {
      "**/*.js": { when: "$(basename).ts" },
      "**/*.as": true,
      "**/*.foo": false,
      "**/*.bananas": { bananas: true }
    };
    assert.strictEqual("**/*.js", glob.match(expression, "test.js", hasSibling));
    assert.strictEqual("**/*.as", glob.match(expression, "test.as", hasSibling));
    assert.strictEqual("**/*.bananas", glob.match(expression, "test.bananas", hasSibling));
    assert.strictEqual("**/*.bananas", glob.match(expression, "test.bananas"));
    assert.strictEqual(glob.match(expression, "test.foo", hasSibling), null);
  });
  test("brackets", () => {
    let p = "foo.[0-9]";
    assertGlobMatch(p, "foo.5");
    assertGlobMatch(p, "foo.8");
    assertNoGlobMatch(p, "bar.5");
    assertNoGlobMatch(p, "foo.f");
    p = "foo.[^0-9]";
    assertNoGlobMatch(p, "foo.5");
    assertNoGlobMatch(p, "foo.8");
    assertNoGlobMatch(p, "bar.5");
    assertGlobMatch(p, "foo.f");
    p = "foo.[!0-9]";
    assertNoGlobMatch(p, "foo.5");
    assertNoGlobMatch(p, "foo.8");
    assertNoGlobMatch(p, "bar.5");
    assertGlobMatch(p, "foo.f");
    p = "foo.[0!^*?]";
    assertNoGlobMatch(p, "foo.5");
    assertNoGlobMatch(p, "foo.8");
    assertGlobMatch(p, "foo.0");
    assertGlobMatch(p, "foo.!");
    assertGlobMatch(p, "foo.^");
    assertGlobMatch(p, "foo.*");
    assertGlobMatch(p, "foo.?");
    p = "foo[/]bar";
    assertNoGlobMatch(p, "foo/bar");
    p = "foo.[[]";
    assertGlobMatch(p, "foo.[");
    p = "foo.[]]";
    assertGlobMatch(p, "foo.]");
    p = "foo.[][!]";
    assertGlobMatch(p, "foo.]");
    assertGlobMatch(p, "foo.[");
    assertGlobMatch(p, "foo.!");
    p = "foo.[]-]";
    assertGlobMatch(p, "foo.]");
    assertGlobMatch(p, "foo.-");
  });
  test("full path", function() {
    assertGlobMatch("testing/this/foo.txt", "testing/this/foo.txt");
  });
  test("ending path", function() {
    assertGlobMatch("**/testing/this/foo.txt", "some/path/testing/this/foo.txt");
  });
  test("prefix agnostic", function() {
    let p = "**/*.js";
    assertGlobMatch(p, "foo.js");
    assertGlobMatch(p, "/foo.js");
    assertGlobMatch(p, "\\foo.js");
    assertGlobMatch(p, "testing/foo.js");
    assertGlobMatch(p, "testing\\foo.js");
    assertGlobMatch(p, "/testing/foo.js");
    assertGlobMatch(p, "\\testing\\foo.js");
    assertGlobMatch(p, "C:\\testing\\foo.js");
    assertNoGlobMatch(p, "foo.ts");
    assertNoGlobMatch(p, "testing/foo.ts");
    assertNoGlobMatch(p, "testing\\foo.ts");
    assertNoGlobMatch(p, "/testing/foo.ts");
    assertNoGlobMatch(p, "\\testing\\foo.ts");
    assertNoGlobMatch(p, "C:\\testing\\foo.ts");
    assertNoGlobMatch(p, "foo.js.txt");
    assertNoGlobMatch(p, "testing/foo.js.txt");
    assertNoGlobMatch(p, "testing\\foo.js.txt");
    assertNoGlobMatch(p, "/testing/foo.js.txt");
    assertNoGlobMatch(p, "\\testing\\foo.js.txt");
    assertNoGlobMatch(p, "C:\\testing\\foo.js.txt");
    assertNoGlobMatch(p, "testing.js/foo");
    assertNoGlobMatch(p, "testing.js\\foo");
    assertNoGlobMatch(p, "/testing.js/foo");
    assertNoGlobMatch(p, "\\testing.js\\foo");
    assertNoGlobMatch(p, "C:\\testing.js\\foo");
    p = "**/foo.js";
    assertGlobMatch(p, "foo.js");
    assertGlobMatch(p, "/foo.js");
    assertGlobMatch(p, "\\foo.js");
    assertGlobMatch(p, "testing/foo.js");
    assertGlobMatch(p, "testing\\foo.js");
    assertGlobMatch(p, "/testing/foo.js");
    assertGlobMatch(p, "\\testing\\foo.js");
    assertGlobMatch(p, "C:\\testing\\foo.js");
  });
  test("cached properly", function() {
    const p = "**/*.js";
    assertGlobMatch(p, "foo.js");
    assertGlobMatch(p, "testing/foo.js");
    assertGlobMatch(p, "testing\\foo.js");
    assertGlobMatch(p, "/testing/foo.js");
    assertGlobMatch(p, "\\testing\\foo.js");
    assertGlobMatch(p, "C:\\testing\\foo.js");
    assertNoGlobMatch(p, "foo.ts");
    assertNoGlobMatch(p, "testing/foo.ts");
    assertNoGlobMatch(p, "testing\\foo.ts");
    assertNoGlobMatch(p, "/testing/foo.ts");
    assertNoGlobMatch(p, "\\testing\\foo.ts");
    assertNoGlobMatch(p, "C:\\testing\\foo.ts");
    assertNoGlobMatch(p, "foo.js.txt");
    assertNoGlobMatch(p, "testing/foo.js.txt");
    assertNoGlobMatch(p, "testing\\foo.js.txt");
    assertNoGlobMatch(p, "/testing/foo.js.txt");
    assertNoGlobMatch(p, "\\testing\\foo.js.txt");
    assertNoGlobMatch(p, "C:\\testing\\foo.js.txt");
    assertNoGlobMatch(p, "testing.js/foo");
    assertNoGlobMatch(p, "testing.js\\foo");
    assertNoGlobMatch(p, "/testing.js/foo");
    assertNoGlobMatch(p, "\\testing.js\\foo");
    assertNoGlobMatch(p, "C:\\testing.js\\foo");
    assertGlobMatch(p, "foo.js");
    assertGlobMatch(p, "testing/foo.js");
    assertGlobMatch(p, "testing\\foo.js");
    assertGlobMatch(p, "/testing/foo.js");
    assertGlobMatch(p, "\\testing\\foo.js");
    assertGlobMatch(p, "C:\\testing\\foo.js");
    assertNoGlobMatch(p, "foo.ts");
    assertNoGlobMatch(p, "testing/foo.ts");
    assertNoGlobMatch(p, "testing\\foo.ts");
    assertNoGlobMatch(p, "/testing/foo.ts");
    assertNoGlobMatch(p, "\\testing\\foo.ts");
    assertNoGlobMatch(p, "C:\\testing\\foo.ts");
    assertNoGlobMatch(p, "foo.js.txt");
    assertNoGlobMatch(p, "testing/foo.js.txt");
    assertNoGlobMatch(p, "testing\\foo.js.txt");
    assertNoGlobMatch(p, "/testing/foo.js.txt");
    assertNoGlobMatch(p, "\\testing\\foo.js.txt");
    assertNoGlobMatch(p, "C:\\testing\\foo.js.txt");
    assertNoGlobMatch(p, "testing.js/foo");
    assertNoGlobMatch(p, "testing.js\\foo");
    assertNoGlobMatch(p, "/testing.js/foo");
    assertNoGlobMatch(p, "\\testing.js\\foo");
    assertNoGlobMatch(p, "C:\\testing.js\\foo");
  });
  test("invalid glob", function() {
    const p = "**/*(.js";
    assertNoGlobMatch(p, "foo.js");
  });
  test("split glob aware", function() {
    assert.deepStrictEqual(glob.splitGlobAware("foo,bar", ","), ["foo", "bar"]);
    assert.deepStrictEqual(glob.splitGlobAware("foo", ","), ["foo"]);
    assert.deepStrictEqual(glob.splitGlobAware("{foo,bar}", ","), ["{foo,bar}"]);
    assert.deepStrictEqual(glob.splitGlobAware("foo,bar,{foo,bar}", ","), ["foo", "bar", "{foo,bar}"]);
    assert.deepStrictEqual(glob.splitGlobAware("{foo,bar},foo,bar,{foo,bar}", ","), ["{foo,bar}", "foo", "bar", "{foo,bar}"]);
    assert.deepStrictEqual(glob.splitGlobAware("[foo,bar]", ","), ["[foo,bar]"]);
    assert.deepStrictEqual(glob.splitGlobAware("foo,bar,[foo,bar]", ","), ["foo", "bar", "[foo,bar]"]);
    assert.deepStrictEqual(glob.splitGlobAware("[foo,bar],foo,bar,[foo,bar]", ","), ["[foo,bar]", "foo", "bar", "[foo,bar]"]);
  });
  test("expression with disabled glob", function() {
    const expr = { "**/*.js": false };
    assert.strictEqual(glob.match(expr, "foo.js"), null);
  });
  test("expression with two non-trivia globs", function() {
    const expr = {
      "**/*.j?": true,
      "**/*.t?": true
    };
    assert.strictEqual(glob.match(expr, "foo.js"), "**/*.j?");
    assert.strictEqual(glob.match(expr, "foo.as"), null);
  });
  test("expression with non-trivia glob (issue 144458)", function() {
    const pattern = "**/p*";
    assert.strictEqual(glob.match(pattern, "foo/barp"), false);
    assert.strictEqual(glob.match(pattern, "foo/bar/ap"), false);
    assert.strictEqual(glob.match(pattern, "ap"), false);
    assert.strictEqual(glob.match(pattern, "foo/barp1"), false);
    assert.strictEqual(glob.match(pattern, "foo/bar/ap1"), false);
    assert.strictEqual(glob.match(pattern, "ap1"), false);
    assert.strictEqual(glob.match(pattern, "/foo/barp"), false);
    assert.strictEqual(glob.match(pattern, "/foo/bar/ap"), false);
    assert.strictEqual(glob.match(pattern, "/ap"), false);
    assert.strictEqual(glob.match(pattern, "/foo/barp1"), false);
    assert.strictEqual(glob.match(pattern, "/foo/bar/ap1"), false);
    assert.strictEqual(glob.match(pattern, "/ap1"), false);
    assert.strictEqual(glob.match(pattern, "foo/pbar"), true);
    assert.strictEqual(glob.match(pattern, "/foo/pbar"), true);
    assert.strictEqual(glob.match(pattern, "foo/bar/pa"), true);
    assert.strictEqual(glob.match(pattern, "/p"), true);
  });
  test("expression with empty glob", function() {
    const expr = { "": true };
    assert.strictEqual(glob.match(expr, "foo.js"), null);
  });
  test("expression with other falsy value", function() {
    const expr = { "**/*.js": 0 };
    assert.strictEqual(glob.match(expr, "foo.js"), "**/*.js");
  });
  test("expression with two basename globs", function() {
    const expr = {
      "**/bar": true,
      "**/baz": true
    };
    assert.strictEqual(glob.match(expr, "bar"), "**/bar");
    assert.strictEqual(glob.match(expr, "foo"), null);
    assert.strictEqual(glob.match(expr, "foo/bar"), "**/bar");
    assert.strictEqual(glob.match(expr, "foo\\bar"), "**/bar");
    assert.strictEqual(glob.match(expr, "foo/foo"), null);
  });
  test("expression with two basename globs and a siblings expression", function() {
    const expr = {
      "**/bar": true,
      "**/baz": true,
      "**/*.js": { when: "$(basename).ts" }
    };
    const siblings = ["foo.ts", "foo.js", "foo", "bar"];
    const hasSibling = (name) => siblings.indexOf(name) !== -1;
    assert.strictEqual(glob.match(expr, "bar", hasSibling), "**/bar");
    assert.strictEqual(glob.match(expr, "foo", hasSibling), null);
    assert.strictEqual(glob.match(expr, "foo/bar", hasSibling), "**/bar");
    if (isWindows) {
      assert.strictEqual(glob.match(expr, "foo\\bar", hasSibling), "**/bar");
    }
    assert.strictEqual(glob.match(expr, "foo/foo", hasSibling), null);
    assert.strictEqual(glob.match(expr, "foo.js", hasSibling), "**/*.js");
    assert.strictEqual(glob.match(expr, "bar.js", hasSibling), null);
  });
  test("expression with multipe basename globs", function() {
    const expr = {
      "**/bar": true,
      "{**/baz,**/foo}": true
    };
    assert.strictEqual(glob.match(expr, "bar"), "**/bar");
    assert.strictEqual(glob.match(expr, "foo"), "{**/baz,**/foo}");
    assert.strictEqual(glob.match(expr, "baz"), "{**/baz,**/foo}");
    assert.strictEqual(glob.match(expr, "abc"), null);
  });
  test("falsy expression/pattern", function() {
    assert.strictEqual(glob.match(null, "foo"), false);
    assert.strictEqual(glob.match("", "foo"), false);
    assert.strictEqual(glob.parse(null)("foo"), false);
    assert.strictEqual(glob.parse("")("foo"), false);
  });
  test("falsy path", function() {
    assert.strictEqual(glob.parse("foo")(null), false);
    assert.strictEqual(glob.parse("foo")(""), false);
    assert.strictEqual(glob.parse("**/*.j?")(null), false);
    assert.strictEqual(glob.parse("**/*.j?")(""), false);
    assert.strictEqual(glob.parse("**/*.foo")(null), false);
    assert.strictEqual(glob.parse("**/*.foo")(""), false);
    assert.strictEqual(glob.parse("**/foo")(null), false);
    assert.strictEqual(glob.parse("**/foo")(""), false);
    assert.strictEqual(glob.parse("{**/baz,**/foo}")(null), false);
    assert.strictEqual(glob.parse("{**/baz,**/foo}")(""), false);
    assert.strictEqual(glob.parse("{**/*.baz,**/*.foo}")(null), false);
    assert.strictEqual(glob.parse("{**/*.baz,**/*.foo}")(""), false);
  });
  test("expression/pattern basename", function() {
    assert.strictEqual(glob.parse("**/foo")("bar/baz", "baz"), false);
    assert.strictEqual(glob.parse("**/foo")("bar/foo", "foo"), true);
    assert.strictEqual(glob.parse("{**/baz,**/foo}")("baz/bar", "bar"), false);
    assert.strictEqual(glob.parse("{**/baz,**/foo}")("baz/foo", "foo"), true);
    const expr = { "**/*.js": { when: "$(basename).ts" } };
    const siblings = ["foo.ts", "foo.js"];
    const hasSibling = (name) => siblings.indexOf(name) !== -1;
    assert.strictEqual(glob.parse(expr)("bar/baz.js", "baz.js", hasSibling), null);
    assert.strictEqual(glob.parse(expr)("bar/foo.js", "foo.js", hasSibling), "**/*.js");
  });
  test("expression/pattern basename terms", function() {
    assert.deepStrictEqual(glob.getBasenameTerms(glob.parse("**/*.foo")), []);
    assert.deepStrictEqual(glob.getBasenameTerms(glob.parse("**/foo")), ["foo"]);
    assert.deepStrictEqual(glob.getBasenameTerms(glob.parse("**/foo/")), ["foo"]);
    assert.deepStrictEqual(glob.getBasenameTerms(glob.parse("{**/baz,**/foo}")), ["baz", "foo"]);
    assert.deepStrictEqual(glob.getBasenameTerms(glob.parse("{**/baz/,**/foo/}")), ["baz", "foo"]);
    assert.deepStrictEqual(glob.getBasenameTerms(glob.parse({
      "**/foo": true,
      "{**/bar,**/baz}": true,
      "{**/bar2/,**/baz2/}": true,
      "**/bulb": false
    })), ["foo", "bar", "baz", "bar2", "baz2"]);
    assert.deepStrictEqual(glob.getBasenameTerms(glob.parse({
      "**/foo": { when: "$(basename).zip" },
      "**/bar": true
    })), ["bar"]);
  });
  test("expression/pattern optimization for basenames", function() {
    assert.deepStrictEqual(glob.getBasenameTerms(glob.parse("**/foo/**")), []);
    assert.deepStrictEqual(glob.getBasenameTerms(glob.parse("**/foo/**", { trimForExclusions: true })), ["foo"]);
    testOptimizationForBasenames("**/*.foo/**", [], [["baz/bar.foo/bar/baz", true]]);
    testOptimizationForBasenames("**/foo/**", ["foo"], [["bar/foo", true], ["bar/foo/baz", false]]);
    testOptimizationForBasenames("{**/baz/**,**/foo/**}", ["baz", "foo"], [["bar/baz", true], ["bar/foo", true]]);
    testOptimizationForBasenames({
      "**/foo/**": true,
      "{**/bar/**,**/baz/**}": true,
      "**/bulb/**": false
    }, ["foo", "bar", "baz"], [
      ["bar/foo", "**/foo/**"],
      ["foo/bar", "{**/bar/**,**/baz/**}"],
      ["bar/nope", null]
    ]);
    const siblings = ["baz", "baz.zip", "nope"];
    const hasSibling = (name) => siblings.indexOf(name) !== -1;
    testOptimizationForBasenames({
      "**/foo/**": { when: "$(basename).zip" },
      "**/bar/**": true
    }, ["bar"], [
      ["bar/foo", null],
      ["bar/foo/baz", null],
      ["bar/foo/nope", null],
      ["foo/bar", "**/bar/**"]
    ], [
      null,
      hasSibling,
      hasSibling
    ]);
  });
  function testOptimizationForBasenames(pattern, basenameTerms, matches, siblingsFns = []) {
    const parsed = glob.parse(pattern, { trimForExclusions: true });
    assert.deepStrictEqual(glob.getBasenameTerms(parsed), basenameTerms);
    matches.forEach(([text, result], i) => {
      assert.strictEqual(parsed(text, null, siblingsFns[i]), result);
    });
  }
  test("trailing slash", function() {
    assert.strictEqual(glob.parse("**/foo/")("bar/baz", "baz"), false);
    assert.strictEqual(glob.parse("**/foo/")("bar/foo", "foo"), true);
    assert.strictEqual(glob.parse("**/*.foo/")("bar/file.baz", "file.baz"), false);
    assert.strictEqual(glob.parse("**/*.foo/")("bar/file.foo", "file.foo"), true);
    assert.strictEqual(glob.parse("{**/foo/,**/abc/}")("bar/baz", "baz"), false);
    assert.strictEqual(glob.parse("{**/foo/,**/abc/}")("bar/foo", "foo"), true);
    assert.strictEqual(glob.parse("{**/foo/,**/abc/}")("bar/abc", "abc"), true);
    assert.strictEqual(glob.parse("{**/foo/,**/abc/}", { trimForExclusions: true })("bar/baz", "baz"), false);
    assert.strictEqual(glob.parse("{**/foo/,**/abc/}", { trimForExclusions: true })("bar/foo", "foo"), true);
    assert.strictEqual(glob.parse("{**/foo/,**/abc/}", { trimForExclusions: true })("bar/abc", "abc"), true);
  });
  test("expression/pattern path", function() {
    assert.strictEqual(glob.parse("**/foo/bar")(nativeSep("foo/baz"), "baz"), false);
    assert.strictEqual(glob.parse("**/foo/bar")(nativeSep("foo/bar"), "bar"), true);
    assert.strictEqual(glob.parse("**/foo/bar")(nativeSep("bar/foo/bar"), "bar"), true);
    assert.strictEqual(glob.parse("**/foo/bar/**")(nativeSep("bar/foo/bar"), "bar"), true);
    assert.strictEqual(glob.parse("**/foo/bar/**")(nativeSep("bar/foo/bar/baz"), "baz"), true);
    assert.strictEqual(glob.parse("**/foo/bar/**", { trimForExclusions: true })(nativeSep("bar/foo/bar"), "bar"), true);
    assert.strictEqual(glob.parse("**/foo/bar/**", { trimForExclusions: true })(nativeSep("bar/foo/bar/baz"), "baz"), false);
    assert.strictEqual(glob.parse("foo/bar")(nativeSep("foo/baz"), "baz"), false);
    assert.strictEqual(glob.parse("foo/bar")(nativeSep("foo/bar"), "bar"), true);
    assert.strictEqual(glob.parse("foo/bar/baz")(nativeSep("foo/bar/baz"), "baz"), true);
    assert.strictEqual(glob.parse("foo/bar")(nativeSep("bar/foo/bar"), "bar"), false);
    assert.strictEqual(glob.parse("foo/bar/**")(nativeSep("foo/bar/baz"), "baz"), true);
    assert.strictEqual(glob.parse("foo/bar/**", { trimForExclusions: true })(nativeSep("foo/bar"), "bar"), true);
    assert.strictEqual(glob.parse("foo/bar/**", { trimForExclusions: true })(nativeSep("foo/bar/baz"), "baz"), false);
  });
  test("expression/pattern paths", function() {
    assert.deepStrictEqual(glob.getPathTerms(glob.parse("**/*.foo")), []);
    assert.deepStrictEqual(glob.getPathTerms(glob.parse("**/foo")), []);
    assert.deepStrictEqual(glob.getPathTerms(glob.parse("**/foo/bar")), ["*/foo/bar"]);
    assert.deepStrictEqual(glob.getPathTerms(glob.parse("**/foo/bar/")), ["*/foo/bar"]);
    const parsed = glob.parse({
      "**/foo/bar": true,
      "**/foo2/bar2": true,
      // Not supported
      // '{**/bar/foo,**/baz/foo}': true,
      // '{**/bar2/foo/,**/baz2/foo/}': true,
      "**/bulb": true,
      "**/bulb2": true,
      "**/bulb/foo": false
    });
    assert.deepStrictEqual(glob.getPathTerms(parsed), ["*/foo/bar", "*/foo2/bar2"]);
    assert.deepStrictEqual(glob.getBasenameTerms(parsed), ["bulb", "bulb2"]);
    assert.deepStrictEqual(glob.getPathTerms(glob.parse({
      "**/foo/bar": { when: "$(basename).zip" },
      "**/bar/foo": true,
      "**/bar2/foo2": true
    })), ["*/bar/foo", "*/bar2/foo2"]);
  });
  test("expression/pattern optimization for paths", function() {
    assert.deepStrictEqual(glob.getPathTerms(glob.parse("**/foo/bar/**")), []);
    assert.deepStrictEqual(glob.getPathTerms(glob.parse("**/foo/bar/**", { trimForExclusions: true })), ["*/foo/bar"]);
    testOptimizationForPaths("**/*.foo/bar/**", [], [[nativeSep("baz/bar.foo/bar/baz"), true]]);
    testOptimizationForPaths("**/foo/bar/**", ["*/foo/bar"], [[nativeSep("bar/foo/bar"), true], [nativeSep("bar/foo/bar/baz"), false]]);
    testOptimizationForPaths({
      "**/foo/bar/**": true,
      // Not supported
      // '{**/bar/bar/**,**/baz/bar/**}': true,
      "**/bulb/bar/**": false
    }, ["*/foo/bar"], [
      [nativeSep("bar/foo/bar"), "**/foo/bar/**"],
      // Not supported
      // [nativeSep('foo/bar/bar'), '{**/bar/bar/**,**/baz/bar/**}'],
      [nativeSep("/foo/bar/nope"), null]
    ]);
    const siblings = ["baz", "baz.zip", "nope"];
    const hasSibling = (name) => siblings.indexOf(name) !== -1;
    testOptimizationForPaths({
      "**/foo/123/**": { when: "$(basename).zip" },
      "**/bar/123/**": true
    }, ["*/bar/123"], [
      [nativeSep("bar/foo/123"), null],
      [nativeSep("bar/foo/123/baz"), null],
      [nativeSep("bar/foo/123/nope"), null],
      [nativeSep("foo/bar/123"), "**/bar/123/**"]
    ], [
      null,
      hasSibling,
      hasSibling
    ]);
  });
  function testOptimizationForPaths(pattern, pathTerms, matches, siblingsFns = []) {
    const parsed = glob.parse(pattern, { trimForExclusions: true });
    assert.deepStrictEqual(glob.getPathTerms(parsed), pathTerms);
    matches.forEach(([text, result], i) => {
      assert.strictEqual(parsed(text, null, siblingsFns[i]), result);
    });
  }
  function nativeSep(slashPath) {
    return slashPath.replace(/\//g, sep);
  }
  test("relative pattern - glob star", function() {
    if (isWindows) {
      const p = { base: "C:\\DNXConsoleApp\\foo", pattern: "**/*.cs" };
      assertGlobMatch(p, "C:\\DNXConsoleApp\\foo\\Program.cs");
      assertGlobMatch(p, "C:\\DNXConsoleApp\\foo\\bar\\Program.cs");
      assertNoGlobMatch(p, "C:\\DNXConsoleApp\\foo\\Program.ts");
      assertNoGlobMatch(p, "C:\\DNXConsoleApp\\Program.cs");
      assertNoGlobMatch(p, "C:\\other\\DNXConsoleApp\\foo\\Program.ts");
    } else {
      const p = { base: "/DNXConsoleApp/foo", pattern: "**/*.cs" };
      assertGlobMatch(p, "/DNXConsoleApp/foo/Program.cs");
      assertGlobMatch(p, "/DNXConsoleApp/foo/bar/Program.cs");
      assertNoGlobMatch(p, "/DNXConsoleApp/foo/Program.ts");
      assertNoGlobMatch(p, "/DNXConsoleApp/Program.cs");
      assertNoGlobMatch(p, "/other/DNXConsoleApp/foo/Program.ts");
    }
  });
  test("relative pattern - single star", function() {
    if (isWindows) {
      const p = { base: "C:\\DNXConsoleApp\\foo", pattern: "*.cs" };
      assertGlobMatch(p, "C:\\DNXConsoleApp\\foo\\Program.cs");
      assertNoGlobMatch(p, "C:\\DNXConsoleApp\\foo\\bar\\Program.cs");
      assertNoGlobMatch(p, "C:\\DNXConsoleApp\\foo\\Program.ts");
      assertNoGlobMatch(p, "C:\\DNXConsoleApp\\Program.cs");
      assertNoGlobMatch(p, "C:\\other\\DNXConsoleApp\\foo\\Program.ts");
    } else {
      const p = { base: "/DNXConsoleApp/foo", pattern: "*.cs" };
      assertGlobMatch(p, "/DNXConsoleApp/foo/Program.cs");
      assertNoGlobMatch(p, "/DNXConsoleApp/foo/bar/Program.cs");
      assertNoGlobMatch(p, "/DNXConsoleApp/foo/Program.ts");
      assertNoGlobMatch(p, "/DNXConsoleApp/Program.cs");
      assertNoGlobMatch(p, "/other/DNXConsoleApp/foo/Program.ts");
    }
  });
  test("relative pattern - single star with path", function() {
    if (isWindows) {
      const p = { base: "C:\\DNXConsoleApp\\foo", pattern: "something/*.cs" };
      assertGlobMatch(p, "C:\\DNXConsoleApp\\foo\\something\\Program.cs");
      assertNoGlobMatch(p, "C:\\DNXConsoleApp\\foo\\Program.cs");
    } else {
      const p = { base: "/DNXConsoleApp/foo", pattern: "something/*.cs" };
      assertGlobMatch(p, "/DNXConsoleApp/foo/something/Program.cs");
      assertNoGlobMatch(p, "/DNXConsoleApp/foo/Program.cs");
    }
  });
  test("relative pattern - single star alone", function() {
    if (isWindows) {
      const p = { base: "C:\\DNXConsoleApp\\foo\\something\\Program.cs", pattern: "*" };
      assertGlobMatch(p, "C:\\DNXConsoleApp\\foo\\something\\Program.cs");
      assertNoGlobMatch(p, "C:\\DNXConsoleApp\\foo\\Program.cs");
    } else {
      const p = { base: "/DNXConsoleApp/foo/something/Program.cs", pattern: "*" };
      assertGlobMatch(p, "/DNXConsoleApp/foo/something/Program.cs");
      assertNoGlobMatch(p, "/DNXConsoleApp/foo/Program.cs");
    }
  });
  test("relative pattern - ignores case on macOS/Windows", function() {
    if (isWindows) {
      const p = { base: "C:\\DNXConsoleApp\\foo", pattern: "something/*.cs" };
      assertGlobMatch(p, "C:\\DNXConsoleApp\\foo\\something\\Program.cs".toLowerCase());
    } else if (isMacintosh) {
      const p = { base: "/DNXConsoleApp/foo", pattern: "something/*.cs" };
      assertGlobMatch(p, "/DNXConsoleApp/foo/something/Program.cs".toLowerCase());
    } else if (isLinux) {
      const p = { base: "/DNXConsoleApp/foo", pattern: "something/*.cs" };
      assertNoGlobMatch(p, "/DNXConsoleApp/foo/something/Program.cs".toLowerCase());
    }
  });
  test("relative pattern - trailing slash / backslash (#162498)", function() {
    if (isWindows) {
      let p = { base: "C:\\", pattern: "foo.cs" };
      assertGlobMatch(p, "C:\\foo.cs");
      p = { base: "C:\\bar\\", pattern: "foo.cs" };
      assertGlobMatch(p, "C:\\bar\\foo.cs");
    } else {
      let p = { base: "/", pattern: "foo.cs" };
      assertGlobMatch(p, "/foo.cs");
      p = { base: "/bar/", pattern: "foo.cs" };
      assertGlobMatch(p, "/bar/foo.cs");
    }
  });
  test('pattern with "base" does not explode - #36081', function() {
    assert.ok(glob.match({ "base": true }, "base"));
  });
  test("relative pattern - #57475", function() {
    if (isWindows) {
      const p = { base: "C:\\DNXConsoleApp\\foo", pattern: "styles/style.css" };
      assertGlobMatch(p, "C:\\DNXConsoleApp\\foo\\styles\\style.css");
      assertNoGlobMatch(p, "C:\\DNXConsoleApp\\foo\\Program.cs");
    } else {
      const p = { base: "/DNXConsoleApp/foo", pattern: "styles/style.css" };
      assertGlobMatch(p, "/DNXConsoleApp/foo/styles/style.css");
      assertNoGlobMatch(p, "/DNXConsoleApp/foo/Program.cs");
    }
  });
  test("URI match", () => {
    const p = "scheme:/**/*.md";
    assertGlobMatch(p, URI.file("super/duper/long/some/file.md").with({ scheme: "scheme" }).toString());
  });
  test("expression fails when siblings use promises (https://github.com/microsoft/vscode/issues/146294)", async function() {
    const siblings = ["test.html", "test.txt", "test.ts"];
    const hasSibling = (name) => Promise.resolve(siblings.indexOf(name) !== -1);
    const expression = {
      "**/test.js": { when: "$(basename).js" },
      "**/*.js": { when: "$(basename).ts" }
    };
    const parsedExpression = glob.parse(expression);
    assert.strictEqual("**/*.js", await parsedExpression("test.js", void 0, hasSibling));
  });
  test("patternsEquals", () => {
    assert.ok(glob.patternsEquals(["a"], ["a"]));
    assert.ok(!glob.patternsEquals(["a"], ["b"]));
    assert.ok(glob.patternsEquals(["a", "b", "c"], ["a", "b", "c"]));
    assert.ok(!glob.patternsEquals(["1", "2"], ["1", "3"]));
    assert.ok(glob.patternsEquals([{ base: "a", pattern: "*" }, "b", "c"], [{ base: "a", pattern: "*" }, "b", "c"]));
    assert.ok(glob.patternsEquals(void 0, void 0));
    assert.ok(!glob.patternsEquals(void 0, ["b"]));
    assert.ok(!glob.patternsEquals(["a"], void 0));
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvY29tbW9uL2dsb2IudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCAqIGFzIGdsb2IgZnJvbSAnLi4vLi4vY29tbW9uL2dsb2IuanMnO1xuaW1wb3J0IHsgc2VwIH0gZnJvbSAnLi4vLi4vY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgaXNMaW51eCwgaXNNYWNpbnRvc2gsIGlzV2luZG93cyB9IGZyb20gJy4uLy4uL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4vdXRpbHMuanMnO1xuXG5zdWl0ZSgnR2xvYicsICgpID0+IHtcblxuXHQvLyB0ZXN0KCdwZXJmJywgKCkgPT4ge1xuXG5cdC8vIFx0bGV0IHBhdHRlcm5zID0gW1xuXHQvLyBcdFx0J3sqKi8qLmNzLCoqLyouanNvbiwqKi8qLmNzcHJvaiwqKi8qLnNsbn0nLFxuXHQvLyBcdFx0J3sqKi8qLmNzLCoqLyouY3Nwcm9qLCoqLyouc2xufScsXG5cdC8vIFx0XHQneyoqLyoudHMsKiovKi50c3gsKiovKi5qcywqKi8qLmpzeCwqKi8qLmVzNiwqKi8qLm1qcywqKi8qLmNqc30nLFxuXHQvLyBcdFx0JyoqLyouZ28nLFxuXHQvLyBcdFx0J3sqKi8qLnBzLCoqLyoucHMxfScsXG5cdC8vIFx0XHQneyoqLyouYywqKi8qLmNwcCwqKi8qLmh9Jyxcblx0Ly8gXHRcdCd7KiovKi5mc3gsKiovKi5mc2ksKiovKi5mcywqKi8qLm1sLCoqLyoubWxpfScsXG5cdC8vIFx0XHQneyoqLyouanMsKiovKi5qc3gsKiovKi5lczYsKiovKi5tanMsKiovKi5janN9Jyxcblx0Ly8gXHRcdCd7KiovKi50cywqKi8qLnRzeH0nLFxuXHQvLyBcdFx0J3sqKi8qLnBocH0nLFxuXHQvLyBcdFx0J3sqKi8qLnBocH0nLFxuXHQvLyBcdFx0J3sqKi8qLnBocH0nLFxuXHQvLyBcdFx0J3sqKi8qLnBocH0nLFxuXHQvLyBcdFx0J3sqKi8qLnB5fScsXG5cdC8vIFx0XHQneyoqLyoucHl9Jyxcblx0Ly8gXHRcdCd7KiovKi5weX0nLFxuXHQvLyBcdFx0J3sqKi8qLnJzLCoqLyoucnNsaWJ9Jyxcblx0Ly8gXHRcdCd7KiovKi5jcHAsKiovKi5jYywqKi8qLmh9Jyxcblx0Ly8gXHRcdCd7KiovKi5tZH0nLFxuXHQvLyBcdFx0J3sqKi8qLm1kfScsXG5cdC8vIFx0XHQneyoqLyoubWR9J1xuXHQvLyBcdF07XG5cblx0Ly8gXHRsZXQgcGF0aHMgPSBbXG5cdC8vIFx0XHQnL0ROWENvbnNvbGVBcHAvUHJvZ3JhbS5jcycsXG5cdC8vIFx0XHQnQzpcXFxcRE5YQ29uc29sZUFwcFxcXFxmb29cXFxcUHJvZ3JhbS5jcycsXG5cdC8vIFx0XHQndGVzdC9xdW5pdCcsXG5cdC8vIFx0XHQndGVzdC90ZXN0LnR4dCcsXG5cdC8vIFx0XHQndGVzdC9ub2RlX21vZHVsZXMnLFxuXHQvLyBcdFx0Jy5oaWRkZW4udHh0Jyxcblx0Ly8gXHRcdCcvbm9kZV9tb2R1bGUvdGVzdC9mb28uanMnXG5cdC8vIFx0XTtcblxuXHQvLyBcdGxldCByZXN1bHRzID0gMDtcblx0Ly8gXHRsZXQgYyA9IDEwMDA7XG5cdC8vIFx0Y29uc29sZS5wcm9maWxlKCdnbG9iLm1hdGNoJyk7XG5cdC8vIFx0d2hpbGUgKGMtLSA+IDApIHtcblx0Ly8gXHRcdGZvciAobGV0IHBhdGggb2YgcGF0aHMpIHtcblx0Ly8gXHRcdFx0Zm9yIChsZXQgcGF0dGVybiBvZiBwYXR0ZXJucykge1xuXHQvLyBcdFx0XHRcdGxldCByID0gZ2xvYi5tYXRjaChwYXR0ZXJuLCBwYXRoKTtcblx0Ly8gXHRcdFx0XHRpZiAocikge1xuXHQvLyBcdFx0XHRcdFx0cmVzdWx0cyArPSA0Mjtcblx0Ly8gXHRcdFx0XHR9XG5cdC8vIFx0XHRcdH1cblx0Ly8gXHRcdH1cblx0Ly8gXHR9XG5cdC8vIFx0Y29uc29sZS5wcm9maWxlRW5kKCk7XG5cdC8vIH0pO1xuXG5cdGZ1bmN0aW9uIGFzc2VydEdsb2JNYXRjaChwYXR0ZXJuOiBzdHJpbmcgfCBnbG9iLklSZWxhdGl2ZVBhdHRlcm4sIGlucHV0OiBzdHJpbmcpIHtcblx0XHRhc3NlcnQoZ2xvYi5tYXRjaChwYXR0ZXJuLCBpbnB1dCksIGAke0pTT04uc3RyaW5naWZ5KHBhdHRlcm4pfSBzaG91bGQgbWF0Y2ggJHtpbnB1dH1gKTtcblx0XHRhc3NlcnQoZ2xvYi5tYXRjaChwYXR0ZXJuLCBuYXRpdmVTZXAoaW5wdXQpKSwgYCR7cGF0dGVybn0gc2hvdWxkIG1hdGNoICR7bmF0aXZlU2VwKGlucHV0KX1gKTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFzc2VydE5vR2xvYk1hdGNoKHBhdHRlcm46IHN0cmluZyB8IGdsb2IuSVJlbGF0aXZlUGF0dGVybiwgaW5wdXQ6IHN0cmluZykge1xuXHRcdGFzc2VydCghZ2xvYi5tYXRjaChwYXR0ZXJuLCBpbnB1dCksIGAke3BhdHRlcm59IHNob3VsZCBub3QgbWF0Y2ggJHtpbnB1dH1gKTtcblx0XHRhc3NlcnQoIWdsb2IubWF0Y2gocGF0dGVybiwgbmF0aXZlU2VwKGlucHV0KSksIGAke3BhdHRlcm59IHNob3VsZCBub3QgbWF0Y2ggJHtuYXRpdmVTZXAoaW5wdXQpfWApO1xuXHR9XG5cblx0dGVzdCgnc2ltcGxlJywgKCkgPT4ge1xuXHRcdGxldCBwID0gJ25vZGVfbW9kdWxlcyc7XG5cblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ25vZGVfbW9kdWxlcycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdub2RlX21vZHVsZScpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICcvbm9kZV9tb2R1bGVzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3Rlc3Qvbm9kZV9tb2R1bGVzJyk7XG5cblx0XHRwID0gJ3Rlc3QudHh0Jztcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ3Rlc3QudHh0Jyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3Rlc3Q/dHh0Jyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJy90ZXh0LnR4dCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICd0ZXN0L3Rlc3QudHh0Jyk7XG5cblx0XHRwID0gJ3Rlc3QoLnR4dCc7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICd0ZXN0KC50eHQnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAndGVzdD90eHQnKTtcblxuXHRcdHAgPSAncXVuaXQnO1xuXG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdxdW5pdCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdxdW5pdC5jc3MnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAndGVzdC9xdW5pdCcpO1xuXG5cdFx0Ly8gQWJzb2x1dGVcblxuXHRcdHAgPSAnL0ROWENvbnNvbGVBcHAvKiovKi5jcyc7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcvRE5YQ29uc29sZUFwcC9Qcm9ncmFtLmNzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcvRE5YQ29uc29sZUFwcC9mb28vUHJvZ3JhbS5jcycpO1xuXG5cdFx0cCA9ICdDOi9ETlhDb25zb2xlQXBwLyoqLyouY3MnO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnQzpcXFxcRE5YQ29uc29sZUFwcFxcXFxQcm9ncmFtLmNzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdDOlxcXFxETlhDb25zb2xlQXBwXFxcXGZvb1xcXFxQcm9ncmFtLmNzJyk7XG5cblx0XHRwID0gJyonO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RvdCBoaWRkZW4nLCBmdW5jdGlvbiAoKSB7XG5cdFx0bGV0IHAgPSAnLionO1xuXG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcuZ2l0Jyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcuaGlkZGVuLnR4dCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdnaXQnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnaGlkZGVuLnR4dCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdwYXRoLy5naXQnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAncGF0aC8uaGlkZGVuLnR4dCcpO1xuXG5cdFx0cCA9ICcqKi8uKic7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcuZ2l0Jyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcvLmdpdCcpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnLmhpZGRlbi50eHQnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnZ2l0Jyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ2hpZGRlbi50eHQnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ3BhdGgvLmdpdCcpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAncGF0aC8uaGlkZGVuLnR4dCcpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnL3BhdGgvLmdpdCcpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnL3BhdGgvLmhpZGRlbi50eHQnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAncGF0aC9naXQnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAncGF0LmgvaGlkZGVuLnR4dCcpO1xuXG5cdFx0cCA9ICcuXyonO1xuXG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcuX2dpdCcpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnLl9oaWRkZW4udHh0Jyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ2dpdCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdoaWRkZW4udHh0Jyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3BhdGgvLl9naXQnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAncGF0aC8uX2hpZGRlbi50eHQnKTtcblxuXHRcdHAgPSAnKiovLl8qJztcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy5fZ2l0Jyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcuX2hpZGRlbi50eHQnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnZ2l0Jyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ2hpZGRlbi5fdHh0Jyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdwYXRoLy5fZ2l0Jyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdwYXRoLy5faGlkZGVuLnR4dCcpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnL3BhdGgvLl9naXQnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy9wYXRoLy5faGlkZGVuLnR4dCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdwYXRoL2dpdCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdwYXQuaC9oaWRkZW4uX3R4dCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdmaWxlIHBhdHRlcm4nLCBmdW5jdGlvbiAoKSB7XG5cdFx0bGV0IHAgPSAnKi5qcyc7XG5cblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2Zvby5qcycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdmb2xkZXIvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJy9ub2RlX21vZHVsZXMvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ2Zvby5qc3MnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnc29tZS5qcy90ZXN0Jyk7XG5cblx0XHRwID0gJ2h0bWwuKic7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdodG1sLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdodG1sLnR4dCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdodG0udHh0Jyk7XG5cblx0XHRwID0gJyouKic7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdodG1sLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdodG1sLnR4dCcpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnaHRtLnR4dCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdmb2xkZXIvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJy9ub2RlX21vZHVsZXMvZm9vLmpzJyk7XG5cblx0XHRwID0gJ25vZGVfbW9kdWxlcy90ZXN0LyouanMnO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnbm9kZV9tb2R1bGVzL3Rlc3QvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ2ZvbGRlci9mb28uanMnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnL25vZGVfbW9kdWxlL3Rlc3QvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ2Zvby5qc3MnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnc29tZS5qcy90ZXN0Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N0YXInLCAoKSA9PiB7XG5cdFx0bGV0IHAgPSAnbm9kZSptb2R1bGVzJztcblxuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnbm9kZV9tb2R1bGVzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdub2RlX3N1cGVyX21vZHVsZXMnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnbm9kZV9tb2R1bGUnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnL25vZGVfbW9kdWxlcycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICd0ZXN0L25vZGVfbW9kdWxlcycpO1xuXG5cdFx0cCA9ICcqJztcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2h0bWwuanMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2h0bWwudHh0Jyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdodG0udHh0Jyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ2ZvbGRlci9mb28uanMnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnL25vZGVfbW9kdWxlcy9mb28uanMnKTtcblx0fSk7XG5cblx0dGVzdCgnZmlsZSAvIGZvbGRlciBtYXRjaCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBwID0gJyoqL25vZGVfbW9kdWxlcy8qKic7XG5cblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ25vZGVfbW9kdWxlcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnbm9kZV9tb2R1bGVzLycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnYS9ub2RlX21vZHVsZXMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2Evbm9kZV9tb2R1bGVzLycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnbm9kZV9tb2R1bGVzL2ZvbycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnZm9vL25vZGVfbW9kdWxlcy9mb28vYmFyJyk7XG5cblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy9ub2RlX21vZHVsZXMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy9ub2RlX21vZHVsZXMvJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcvYS9ub2RlX21vZHVsZXMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy9hL25vZGVfbW9kdWxlcy8nKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy9ub2RlX21vZHVsZXMvZm9vJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcvZm9vL25vZGVfbW9kdWxlcy9mb28vYmFyJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3F1ZXN0aW9ubWFyaycsICgpID0+IHtcblx0XHRsZXQgcCA9ICdub2RlP21vZHVsZXMnO1xuXG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdub2RlX21vZHVsZXMnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnbm9kZV9zdXBlcl9tb2R1bGVzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ25vZGVfbW9kdWxlJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJy9ub2RlX21vZHVsZXMnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAndGVzdC9ub2RlX21vZHVsZXMnKTtcblxuXHRcdHAgPSAnPyc7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdoJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ2h0bWwudHh0Jyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ2h0bS50eHQnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnZm9sZGVyL2Zvby5qcycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICcvbm9kZV9tb2R1bGVzL2Zvby5qcycpO1xuXHR9KTtcblxuXHR0ZXN0KCdnbG9ic3RhcicsICgpID0+IHtcblx0XHRsZXQgcCA9ICcqKi8qLmpzJztcblxuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdmb2xkZXIvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcvbm9kZV9tb2R1bGVzL2Zvby5qcycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdmb28uanNzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3NvbWUuanMvdGVzdCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICcvc29tZS5qcy90ZXN0Jyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ1xcXFxzb21lLmpzXFxcXHRlc3QnKTtcblxuXHRcdHAgPSAnKiovcHJvamVjdC5qc29uJztcblxuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAncHJvamVjdC5qc29uJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcvcHJvamVjdC5qc29uJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdzb21lL2ZvbGRlci9wcm9qZWN0Lmpzb24nKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy9zb21lL2ZvbGRlci9wcm9qZWN0Lmpzb24nKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnc29tZS9mb2xkZXIvZmlsZV9wcm9qZWN0Lmpzb24nKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnc29tZS9mb2xkZXIvZmlsZXByb2plY3QuanNvbicpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdzb21lL3JycHJvamVjdC5qc29uJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3NvbWVcXFxccnJwcm9qZWN0Lmpzb24nKTtcblxuXHRcdHAgPSAndGVzdC8qKic7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICd0ZXN0Jyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICd0ZXN0L2ZvbycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAndGVzdC9mb28vJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICd0ZXN0L2Zvby5qcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAndGVzdC9vdGhlci9mb28uanMnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnZXN0L290aGVyL2Zvby5qcycpO1xuXG5cdFx0cCA9ICcqKic7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcvJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdmb28uanMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2ZvbGRlci9mb28uanMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2ZvbGRlci9mb28vJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcvbm9kZV9tb2R1bGVzL2Zvby5qcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnZm9vLmpzcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnc29tZS5qcy90ZXN0Jyk7XG5cblx0XHRwID0gJ3Rlc3QvKiovKi5qcyc7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICd0ZXN0L2Zvby5qcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAndGVzdC9vdGhlci9mb28uanMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ3Rlc3Qvb3RoZXIvbW9yZS9mb28uanMnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAndGVzdC9mb28udHMnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAndGVzdC9vdGhlci9mb28udHMnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAndGVzdC9vdGhlci9tb3JlL2Zvby50cycpO1xuXG5cdFx0cCA9ICcqKi8qKi8qLmpzJztcblxuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdmb2xkZXIvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcvbm9kZV9tb2R1bGVzL2Zvby5qcycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdmb28uanNzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3NvbWUuanMvdGVzdCcpO1xuXG5cdFx0cCA9ICcqKi9ub2RlX21vZHVsZXMvKiovKi5qcyc7XG5cblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnZm9vLmpzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ2ZvbGRlci9mb28uanMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ25vZGVfbW9kdWxlcy9mb28uanMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy9ub2RlX21vZHVsZXMvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdub2RlX21vZHVsZXMvc29tZS9mb2xkZXIvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcvbm9kZV9tb2R1bGVzL3NvbWUvZm9sZGVyL2Zvby5qcycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdub2RlX21vZHVsZXMvc29tZS9mb2xkZXIvZm9vLnRzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ2Zvby5qc3MnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnc29tZS5qcy90ZXN0Jyk7XG5cblx0XHRwID0gJ3sqKi9ub2RlX21vZHVsZXMvKiosKiovLmdpdC8qKiwqKi9ib3dlcl9jb21wb25lbnRzLyoqfSc7XG5cblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ25vZGVfbW9kdWxlcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnL25vZGVfbW9kdWxlcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnL25vZGVfbW9kdWxlcy9tb3JlJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdzb21lL3Rlc3Qvbm9kZV9tb2R1bGVzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdzb21lXFxcXHRlc3RcXFxcbm9kZV9tb2R1bGVzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcvc29tZS90ZXN0L25vZGVfbW9kdWxlcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnXFxcXHNvbWVcXFxcdGVzdFxcXFxub2RlX21vZHVsZXMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ0M6XFxcXFxcXFxzb21lXFxcXHRlc3RcXFxcbm9kZV9tb2R1bGVzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdDOlxcXFxcXFxcc29tZVxcXFx0ZXN0XFxcXG5vZGVfbW9kdWxlc1xcXFxtb3JlJyk7XG5cblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2Jvd2VyX2NvbXBvbmVudHMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2Jvd2VyX2NvbXBvbmVudHMvbW9yZScpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnL2Jvd2VyX2NvbXBvbmVudHMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ3NvbWUvdGVzdC9ib3dlcl9jb21wb25lbnRzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdzb21lXFxcXHRlc3RcXFxcYm93ZXJfY29tcG9uZW50cycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnL3NvbWUvdGVzdC9ib3dlcl9jb21wb25lbnRzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdcXFxcc29tZVxcXFx0ZXN0XFxcXGJvd2VyX2NvbXBvbmVudHMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ0M6XFxcXFxcXFxzb21lXFxcXHRlc3RcXFxcYm93ZXJfY29tcG9uZW50cycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnQzpcXFxcXFxcXHNvbWVcXFxcdGVzdFxcXFxib3dlcl9jb21wb25lbnRzXFxcXG1vcmUnKTtcblxuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnLmdpdCcpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnLy5naXQnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ3NvbWUvdGVzdC8uZ2l0Jyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdzb21lXFxcXHRlc3RcXFxcLmdpdCcpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnL3NvbWUvdGVzdC8uZ2l0Jyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdcXFxcc29tZVxcXFx0ZXN0XFxcXC5naXQnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ0M6XFxcXFxcXFxzb21lXFxcXHRlc3RcXFxcLmdpdCcpO1xuXG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3RlbXB0aW5nJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJy90ZW1wdGluZycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdzb21lL3Rlc3QvdGVtcHRpbmcnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnc29tZVxcXFx0ZXN0XFxcXHRlbXB0aW5nJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJy9zb21lL3Rlc3QvdGVtcHRpbmcnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnXFxcXHNvbWVcXFxcdGVzdFxcXFx0ZW1wdGluZycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdDOlxcXFxcXFxcc29tZVxcXFx0ZXN0XFxcXHRlbXB0aW5nJyk7XG5cblx0XHRwID0gJ3sqKi9wYWNrYWdlLmpzb24sKiovcHJvamVjdC5qc29ufSc7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdwYWNrYWdlLmpzb24nKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy9wYWNrYWdlLmpzb24nKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAneHBhY2thZ2UuanNvbicpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICcveHBhY2thZ2UuanNvbicpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSA0MTcyNCcsIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgcCA9ICdzb21lLyoqLyouanMnO1xuXG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdzb21lL2Zvby5qcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnc29tZS9mb2xkZXIvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3NvbWV0aGluZy9mb28uanMnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnc29tZXRoaW5nL2ZvbGRlci9mb28uanMnKTtcblxuXHRcdHAgPSAnc29tZS8qKi8qJztcblxuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnc29tZS9mb28uanMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ3NvbWUvZm9sZGVyL2Zvby5qcycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdzb21ldGhpbmcvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3NvbWV0aGluZy9mb2xkZXIvZm9vLmpzJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2JyYWNlIGV4cGFuc2lvbicsIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgcCA9ICcqLntodG1sLGpzfSc7XG5cblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2Zvby5qcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnZm9vLmh0bWwnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnZm9sZGVyL2Zvby5qcycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICcvbm9kZV9tb2R1bGVzL2Zvby5qcycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdmb28uanNzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3NvbWUuanMvdGVzdCcpO1xuXG5cdFx0cCA9ICcqLntodG1sfSc7XG5cblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2Zvby5odG1sJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ2Zvby5qcycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdmb2xkZXIvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJy9ub2RlX21vZHVsZXMvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ2Zvby5qc3MnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnc29tZS5qcy90ZXN0Jyk7XG5cblx0XHRwID0gJ3tub2RlX21vZHVsZXMsdGVzdGluZ30nO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnbm9kZV9tb2R1bGVzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICd0ZXN0aW5nJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ25vZGVfbW9kdWxlJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ2R0ZXN0aW5nJyk7XG5cblx0XHRwID0gJyoqL3tmb28sYmFyfSc7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdmb28nKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2JhcicpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAndGVzdC9mb28nKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ3Rlc3QvYmFyJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdvdGhlci9tb3JlL2ZvbycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnb3RoZXIvbW9yZS9iYXInKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy9mb28nKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy9iYXInKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy90ZXN0L2ZvbycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnL3Rlc3QvYmFyJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcvb3RoZXIvbW9yZS9mb28nKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy9vdGhlci9tb3JlL2JhcicpO1xuXG5cdFx0cCA9ICd7Zm9vLGJhcn0vKionO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnZm9vJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdiYXInKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2Jhci8nKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2Zvby90ZXN0Jyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdiYXIvdGVzdCcpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnYmFyL3Rlc3QvJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdmb28vb3RoZXIvbW9yZScpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnYmFyL290aGVyL21vcmUnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2Jhci9vdGhlci9tb3JlLycpO1xuXG5cdFx0cCA9ICd7KiovKi5kLnRzLCoqLyouanN9JztcblxuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICd0ZXN0aW5nL2Zvby5qcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAndGVzdGluZ1xcXFxmb28uanMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy90ZXN0aW5nL2Zvby5qcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnXFxcXHRlc3RpbmdcXFxcZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdDOlxcXFx0ZXN0aW5nXFxcXGZvby5qcycpO1xuXG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdmb28uZC50cycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAndGVzdGluZy9mb28uZC50cycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAndGVzdGluZ1xcXFxmb28uZC50cycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnL3Rlc3RpbmcvZm9vLmQudHMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ1xcXFx0ZXN0aW5nXFxcXGZvby5kLnRzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdDOlxcXFx0ZXN0aW5nXFxcXGZvby5kLnRzJyk7XG5cblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnZm9vLmQnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAndGVzdGluZy9mb28uZCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICd0ZXN0aW5nXFxcXGZvby5kJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJy90ZXN0aW5nL2Zvby5kJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ1xcXFx0ZXN0aW5nXFxcXGZvby5kJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ0M6XFxcXHRlc3RpbmdcXFxcZm9vLmQnKTtcblxuXHRcdHAgPSAneyoqLyouZC50cywqKi8qLmpzLHBhdGgvc2ltcGxlLmpnc30nO1xuXG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdmb28uanMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ3Rlc3RpbmcvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICd0ZXN0aW5nXFxcXGZvby5qcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnL3Rlc3RpbmcvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdwYXRoL3NpbXBsZS5qZ3MnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnL3BhdGgvc2ltcGxlLmpncycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnXFxcXHRlc3RpbmdcXFxcZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdDOlxcXFx0ZXN0aW5nXFxcXGZvby5qcycpO1xuXG5cdFx0cCA9ICd7KiovKi5kLnRzLCoqLyouanMsZm9vLlswLTldfSc7XG5cblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2Zvby41Jyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdmb28uOCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdiYXIuNScpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdmb28uZicpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnZm9vLmpzJyk7XG5cblx0XHRwID0gJ3ByZWZpeC97KiovKi5kLnRzLCoqLyouanMsZm9vLlswLTldfSc7XG5cblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ3ByZWZpeC9mb28uNScpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAncHJlZml4L2Zvby44Jyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3ByZWZpeC9iYXIuNScpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdwcmVmaXgvZm9vLmYnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ3ByZWZpeC9mb28uanMnKTtcblx0fSk7XG5cblx0dGVzdCgnZXhwcmVzc2lvbiBzdXBwb3J0IChzaW5nbGUpJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHNpYmxpbmdzID0gWyd0ZXN0Lmh0bWwnLCAndGVzdC50eHQnLCAndGVzdC50cycsICd0ZXN0LmpzJ107XG5cdFx0Y29uc3QgaGFzU2libGluZyA9IChuYW1lOiBzdHJpbmcpID0+IHNpYmxpbmdzLmluZGV4T2YobmFtZSkgIT09IC0xO1xuXG5cdFx0Ly8geyBcIioqLyouanNcIjogeyBcIndoZW5cIjogXCIkKGJhc2VuYW1lKS50c1wiIH0gfVxuXHRcdGxldCBleHByZXNzaW9uOiBnbG9iLklFeHByZXNzaW9uID0ge1xuXHRcdFx0JyoqLyouanMnOiB7XG5cdFx0XHRcdHdoZW46ICckKGJhc2VuYW1lKS50cydcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCcqKi8qLmpzJywgZ2xvYi5tYXRjaChleHByZXNzaW9uLCAndGVzdC5qcycsIGhhc1NpYmxpbmcpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5tYXRjaChleHByZXNzaW9uLCAndGVzdC5qcycsICgpID0+IGZhbHNlKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2goZXhwcmVzc2lvbiwgJ3Rlc3QuanMnLCBuYW1lID0+IG5hbWUgPT09ICd0ZS50cycpLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5tYXRjaChleHByZXNzaW9uLCAndGVzdC5qcycpLCBudWxsKTtcblxuXHRcdGV4cHJlc3Npb24gPSB7XG5cdFx0XHQnKiovKi5qcyc6IHtcblx0XHRcdFx0d2hlbjogJydcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2goZXhwcmVzc2lvbiwgJ3Rlc3QuanMnLCBoYXNTaWJsaW5nKSwgbnVsbCk7XG5cblx0XHRleHByZXNzaW9uID0ge1xuXHRcdFx0JyoqLyouanMnOiB7XG5cdFx0XHR9IGFzIGFueVxuXHRcdH07XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJyoqLyouanMnLCBnbG9iLm1hdGNoKGV4cHJlc3Npb24sICd0ZXN0LmpzJywgaGFzU2libGluZykpO1xuXG5cdFx0ZXhwcmVzc2lvbiA9IHt9O1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2goZXhwcmVzc2lvbiwgJ3Rlc3QuanMnLCBoYXNTaWJsaW5nKSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V4cHJlc3Npb24gc3VwcG9ydCAobXVsdGlwbGUpJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHNpYmxpbmdzID0gWyd0ZXN0Lmh0bWwnLCAndGVzdC50eHQnLCAndGVzdC50cycsICd0ZXN0LmpzJ107XG5cdFx0Y29uc3QgaGFzU2libGluZyA9IChuYW1lOiBzdHJpbmcpID0+IHNpYmxpbmdzLmluZGV4T2YobmFtZSkgIT09IC0xO1xuXG5cdFx0Ly8geyBcIioqLyouanNcIjogeyBcIndoZW5cIjogXCIkKGJhc2VuYW1lKS50c1wiIH0gfVxuXHRcdGNvbnN0IGV4cHJlc3Npb246IGdsb2IuSUV4cHJlc3Npb24gPSB7XG5cdFx0XHQnKiovKi5qcyc6IHsgd2hlbjogJyQoYmFzZW5hbWUpLnRzJyB9LFxuXHRcdFx0JyoqLyouYXMnOiB0cnVlLFxuXHRcdFx0JyoqLyouZm9vJzogZmFsc2UsXG5cdFx0XHQnKiovKi5iYW5hbmFzJzogeyBiYW5hbmFzOiB0cnVlIH0gYXMgYW55XG5cdFx0fTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgnKiovKi5qcycsIGdsb2IubWF0Y2goZXhwcmVzc2lvbiwgJ3Rlc3QuanMnLCBoYXNTaWJsaW5nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCcqKi8qLmFzJywgZ2xvYi5tYXRjaChleHByZXNzaW9uLCAndGVzdC5hcycsIGhhc1NpYmxpbmcpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJyoqLyouYmFuYW5hcycsIGdsb2IubWF0Y2goZXhwcmVzc2lvbiwgJ3Rlc3QuYmFuYW5hcycsIGhhc1NpYmxpbmcpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJyoqLyouYmFuYW5hcycsIGdsb2IubWF0Y2goZXhwcmVzc2lvbiwgJ3Rlc3QuYmFuYW5hcycpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5tYXRjaChleHByZXNzaW9uLCAndGVzdC5mb28nLCBoYXNTaWJsaW5nKSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2JyYWNrZXRzJywgKCkgPT4ge1xuXHRcdGxldCBwID0gJ2Zvby5bMC05XSc7XG5cblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2Zvby41Jyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdmb28uOCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdiYXIuNScpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdmb28uZicpO1xuXG5cdFx0cCA9ICdmb28uW14wLTldJztcblxuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdmb28uNScpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdmb28uOCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdiYXIuNScpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnZm9vLmYnKTtcblxuXHRcdHAgPSAnZm9vLlshMC05XSc7XG5cblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnZm9vLjUnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnZm9vLjgnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnYmFyLjUnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2Zvby5mJyk7XG5cblx0XHRwID0gJ2Zvby5bMCFeKj9dJztcblxuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdmb28uNScpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdmb28uOCcpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnZm9vLjAnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2Zvby4hJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdmb28uXicpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnZm9vLionKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2Zvby4/Jyk7XG5cblx0XHRwID0gJ2Zvb1svXWJhcic7XG5cblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnZm9vL2JhcicpO1xuXG5cdFx0cCA9ICdmb28uW1tdJztcblxuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnZm9vLlsnKTtcblxuXHRcdHAgPSAnZm9vLltdXSc7XG5cblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2Zvby5dJyk7XG5cblx0XHRwID0gJ2Zvby5bXVshXSc7XG5cblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ2Zvby5dJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdmb28uWycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnZm9vLiEnKTtcblxuXHRcdHAgPSAnZm9vLltdLV0nO1xuXG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdmb28uXScpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnZm9vLi0nKTtcblx0fSk7XG5cblx0dGVzdCgnZnVsbCBwYXRoJywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydEdsb2JNYXRjaCgndGVzdGluZy90aGlzL2Zvby50eHQnLCAndGVzdGluZy90aGlzL2Zvby50eHQnKTtcblx0fSk7XG5cblx0dGVzdCgnZW5kaW5nIHBhdGgnLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKCcqKi90ZXN0aW5nL3RoaXMvZm9vLnR4dCcsICdzb21lL3BhdGgvdGVzdGluZy90aGlzL2Zvby50eHQnKTtcblx0fSk7XG5cblx0dGVzdCgncHJlZml4IGFnbm9zdGljJywgZnVuY3Rpb24gKCkge1xuXHRcdGxldCBwID0gJyoqLyouanMnO1xuXG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdmb28uanMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy9mb28uanMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ1xcXFxmb28uanMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ3Rlc3RpbmcvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICd0ZXN0aW5nXFxcXGZvby5qcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnL3Rlc3RpbmcvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdcXFxcdGVzdGluZ1xcXFxmb28uanMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ0M6XFxcXHRlc3RpbmdcXFxcZm9vLmpzJyk7XG5cblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnZm9vLnRzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3Rlc3RpbmcvZm9vLnRzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3Rlc3RpbmdcXFxcZm9vLnRzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJy90ZXN0aW5nL2Zvby50cycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdcXFxcdGVzdGluZ1xcXFxmb28udHMnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnQzpcXFxcdGVzdGluZ1xcXFxmb28udHMnKTtcblxuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdmb28uanMudHh0Jyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3Rlc3RpbmcvZm9vLmpzLnR4dCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICd0ZXN0aW5nXFxcXGZvby5qcy50eHQnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnL3Rlc3RpbmcvZm9vLmpzLnR4dCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdcXFxcdGVzdGluZ1xcXFxmb28uanMudHh0Jyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ0M6XFxcXHRlc3RpbmdcXFxcZm9vLmpzLnR4dCcpO1xuXG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3Rlc3RpbmcuanMvZm9vJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3Rlc3RpbmcuanNcXFxcZm9vJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJy90ZXN0aW5nLmpzL2ZvbycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdcXFxcdGVzdGluZy5qc1xcXFxmb28nKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnQzpcXFxcdGVzdGluZy5qc1xcXFxmb28nKTtcblxuXHRcdHAgPSAnKiovZm9vLmpzJztcblxuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdcXFxcZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICd0ZXN0aW5nL2Zvby5qcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAndGVzdGluZ1xcXFxmb28uanMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy90ZXN0aW5nL2Zvby5qcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnXFxcXHRlc3RpbmdcXFxcZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdDOlxcXFx0ZXN0aW5nXFxcXGZvby5qcycpO1xuXHR9KTtcblxuXHR0ZXN0KCdjYWNoZWQgcHJvcGVybHknLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcCA9ICcqKi8qLmpzJztcblxuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICd0ZXN0aW5nL2Zvby5qcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAndGVzdGluZ1xcXFxmb28uanMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy90ZXN0aW5nL2Zvby5qcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnXFxcXHRlc3RpbmdcXFxcZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdDOlxcXFx0ZXN0aW5nXFxcXGZvby5qcycpO1xuXG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ2Zvby50cycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICd0ZXN0aW5nL2Zvby50cycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICd0ZXN0aW5nXFxcXGZvby50cycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICcvdGVzdGluZy9mb28udHMnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnXFxcXHRlc3RpbmdcXFxcZm9vLnRzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ0M6XFxcXHRlc3RpbmdcXFxcZm9vLnRzJyk7XG5cblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnZm9vLmpzLnR4dCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICd0ZXN0aW5nL2Zvby5qcy50eHQnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAndGVzdGluZ1xcXFxmb28uanMudHh0Jyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJy90ZXN0aW5nL2Zvby5qcy50eHQnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnXFxcXHRlc3RpbmdcXFxcZm9vLmpzLnR4dCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdDOlxcXFx0ZXN0aW5nXFxcXGZvby5qcy50eHQnKTtcblxuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICd0ZXN0aW5nLmpzL2ZvbycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICd0ZXN0aW5nLmpzXFxcXGZvbycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICcvdGVzdGluZy5qcy9mb28nKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnXFxcXHRlc3RpbmcuanNcXFxcZm9vJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ0M6XFxcXHRlc3RpbmcuanNcXFxcZm9vJyk7XG5cblx0XHQvLyBSdW4gYWdhaW4gYW5kIG1ha2Ugc3VyZSB0aGUgcmVnZXggYXJlIHByb3Blcmx5IHJldXNlZFxuXG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdmb28uanMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ3Rlc3RpbmcvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICd0ZXN0aW5nXFxcXGZvby5qcycpO1xuXHRcdGFzc2VydEdsb2JNYXRjaChwLCAnL3Rlc3RpbmcvZm9vLmpzJyk7XG5cdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdcXFxcdGVzdGluZ1xcXFxmb28uanMnKTtcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ0M6XFxcXHRlc3RpbmdcXFxcZm9vLmpzJyk7XG5cblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnZm9vLnRzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3Rlc3RpbmcvZm9vLnRzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3Rlc3RpbmdcXFxcZm9vLnRzJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJy90ZXN0aW5nL2Zvby50cycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdcXFxcdGVzdGluZ1xcXFxmb28udHMnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnQzpcXFxcdGVzdGluZ1xcXFxmb28udHMnKTtcblxuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdmb28uanMudHh0Jyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3Rlc3RpbmcvZm9vLmpzLnR4dCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICd0ZXN0aW5nXFxcXGZvby5qcy50eHQnKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnL3Rlc3RpbmcvZm9vLmpzLnR4dCcpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdcXFxcdGVzdGluZ1xcXFxmb28uanMudHh0Jyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ0M6XFxcXHRlc3RpbmdcXFxcZm9vLmpzLnR4dCcpO1xuXG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3Rlc3RpbmcuanMvZm9vJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ3Rlc3RpbmcuanNcXFxcZm9vJyk7XG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJy90ZXN0aW5nLmpzL2ZvbycpO1xuXHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdcXFxcdGVzdGluZy5qc1xcXFxmb28nKTtcblx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnQzpcXFxcdGVzdGluZy5qc1xcXFxmb28nKTtcblx0fSk7XG5cblx0dGVzdCgnaW52YWxpZCBnbG9iJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHAgPSAnKiovKiguanMnO1xuXG5cdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ2Zvby5qcycpO1xuXHR9KTtcblxuXHR0ZXN0KCdzcGxpdCBnbG9iIGF3YXJlJywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2xvYi5zcGxpdEdsb2JBd2FyZSgnZm9vLGJhcicsICcsJyksIFsnZm9vJywgJ2JhciddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdsb2Iuc3BsaXRHbG9iQXdhcmUoJ2ZvbycsICcsJyksIFsnZm9vJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2xvYi5zcGxpdEdsb2JBd2FyZSgne2ZvbyxiYXJ9JywgJywnKSwgWyd7Zm9vLGJhcn0nXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnbG9iLnNwbGl0R2xvYkF3YXJlKCdmb28sYmFyLHtmb28sYmFyfScsICcsJyksIFsnZm9vJywgJ2JhcicsICd7Zm9vLGJhcn0nXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnbG9iLnNwbGl0R2xvYkF3YXJlKCd7Zm9vLGJhcn0sZm9vLGJhcix7Zm9vLGJhcn0nLCAnLCcpLCBbJ3tmb28sYmFyfScsICdmb28nLCAnYmFyJywgJ3tmb28sYmFyfSddKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2xvYi5zcGxpdEdsb2JBd2FyZSgnW2ZvbyxiYXJdJywgJywnKSwgWydbZm9vLGJhcl0nXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnbG9iLnNwbGl0R2xvYkF3YXJlKCdmb28sYmFyLFtmb28sYmFyXScsICcsJyksIFsnZm9vJywgJ2JhcicsICdbZm9vLGJhcl0nXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnbG9iLnNwbGl0R2xvYkF3YXJlKCdbZm9vLGJhcl0sZm9vLGJhcixbZm9vLGJhcl0nLCAnLCcpLCBbJ1tmb28sYmFyXScsICdmb28nLCAnYmFyJywgJ1tmb28sYmFyXSddKTtcblx0fSk7XG5cblx0dGVzdCgnZXhwcmVzc2lvbiB3aXRoIGRpc2FibGVkIGdsb2InLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZXhwciA9IHsgJyoqLyouanMnOiBmYWxzZSB9O1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2goZXhwciwgJ2Zvby5qcycpLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnZXhwcmVzc2lvbiB3aXRoIHR3byBub24tdHJpdmlhIGdsb2JzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGV4cHIgPSB7XG5cdFx0XHQnKiovKi5qPyc6IHRydWUsXG5cdFx0XHQnKiovKi50Pyc6IHRydWVcblx0XHR9O1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2goZXhwciwgJ2Zvby5qcycpLCAnKiovKi5qPycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLm1hdGNoKGV4cHIsICdmb28uYXMnKSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V4cHJlc3Npb24gd2l0aCBub24tdHJpdmlhIGdsb2IgKGlzc3VlIDE0NDQ1OCknLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcGF0dGVybiA9ICcqKi9wKic7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5tYXRjaChwYXR0ZXJuLCAnZm9vL2JhcnAnKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLm1hdGNoKHBhdHRlcm4sICdmb28vYmFyL2FwJyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5tYXRjaChwYXR0ZXJuLCAnYXAnKSwgZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2gocGF0dGVybiwgJ2Zvby9iYXJwMScpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2gocGF0dGVybiwgJ2Zvby9iYXIvYXAxJyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5tYXRjaChwYXR0ZXJuLCAnYXAxJyksIGZhbHNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLm1hdGNoKHBhdHRlcm4sICcvZm9vL2JhcnAnKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLm1hdGNoKHBhdHRlcm4sICcvZm9vL2Jhci9hcCcpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2gocGF0dGVybiwgJy9hcCcpLCBmYWxzZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5tYXRjaChwYXR0ZXJuLCAnL2Zvby9iYXJwMScpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2gocGF0dGVybiwgJy9mb28vYmFyL2FwMScpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2gocGF0dGVybiwgJy9hcDEnKSwgZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2gocGF0dGVybiwgJ2Zvby9wYmFyJyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLm1hdGNoKHBhdHRlcm4sICcvZm9vL3BiYXInKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2gocGF0dGVybiwgJ2Zvby9iYXIvcGEnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2gocGF0dGVybiwgJy9wJyksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdleHByZXNzaW9uIHdpdGggZW1wdHkgZ2xvYicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBleHByID0geyAnJzogdHJ1ZSB9O1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2goZXhwciwgJ2Zvby5qcycpLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnZXhwcmVzc2lvbiB3aXRoIG90aGVyIGZhbHN5IHZhbHVlJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGV4cHIgPSB7ICcqKi8qLmpzJzogMCB9IGFzIGFueTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLm1hdGNoKGV4cHIsICdmb28uanMnKSwgJyoqLyouanMnKTtcblx0fSk7XG5cblx0dGVzdCgnZXhwcmVzc2lvbiB3aXRoIHR3byBiYXNlbmFtZSBnbG9icycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBleHByID0ge1xuXHRcdFx0JyoqL2Jhcic6IHRydWUsXG5cdFx0XHQnKiovYmF6JzogdHJ1ZVxuXHRcdH07XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5tYXRjaChleHByLCAnYmFyJyksICcqKi9iYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5tYXRjaChleHByLCAnZm9vJyksIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLm1hdGNoKGV4cHIsICdmb28vYmFyJyksICcqKi9iYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5tYXRjaChleHByLCAnZm9vXFxcXGJhcicpLCAnKiovYmFyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2goZXhwciwgJ2Zvby9mb28nKSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V4cHJlc3Npb24gd2l0aCB0d28gYmFzZW5hbWUgZ2xvYnMgYW5kIGEgc2libGluZ3MgZXhwcmVzc2lvbicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBleHByID0ge1xuXHRcdFx0JyoqL2Jhcic6IHRydWUsXG5cdFx0XHQnKiovYmF6JzogdHJ1ZSxcblx0XHRcdCcqKi8qLmpzJzogeyB3aGVuOiAnJChiYXNlbmFtZSkudHMnIH1cblx0XHR9O1xuXG5cdFx0Y29uc3Qgc2libGluZ3MgPSBbJ2Zvby50cycsICdmb28uanMnLCAnZm9vJywgJ2JhciddO1xuXHRcdGNvbnN0IGhhc1NpYmxpbmcgPSAobmFtZTogc3RyaW5nKSA9PiBzaWJsaW5ncy5pbmRleE9mKG5hbWUpICE9PSAtMTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLm1hdGNoKGV4cHIsICdiYXInLCBoYXNTaWJsaW5nKSwgJyoqL2JhcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLm1hdGNoKGV4cHIsICdmb28nLCBoYXNTaWJsaW5nKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2goZXhwciwgJ2Zvby9iYXInLCBoYXNTaWJsaW5nKSwgJyoqL2JhcicpO1xuXHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdC8vIGJhY2tzbGFzaCBpcyBhIHZhbGlkIGZpbGUgbmFtZSBjaGFyYWN0ZXIgb24gcG9zaXhcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLm1hdGNoKGV4cHIsICdmb29cXFxcYmFyJywgaGFzU2libGluZyksICcqKi9iYXInKTtcblx0XHR9XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2goZXhwciwgJ2Zvby9mb28nLCBoYXNTaWJsaW5nKSwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2goZXhwciwgJ2Zvby5qcycsIGhhc1NpYmxpbmcpLCAnKiovKi5qcycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLm1hdGNoKGV4cHIsICdiYXIuanMnLCBoYXNTaWJsaW5nKSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V4cHJlc3Npb24gd2l0aCBtdWx0aXBlIGJhc2VuYW1lIGdsb2JzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGV4cHIgPSB7XG5cdFx0XHQnKiovYmFyJzogdHJ1ZSxcblx0XHRcdCd7KiovYmF6LCoqL2Zvb30nOiB0cnVlXG5cdFx0fTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLm1hdGNoKGV4cHIsICdiYXInKSwgJyoqL2JhcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLm1hdGNoKGV4cHIsICdmb28nKSwgJ3sqKi9iYXosKiovZm9vfScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLm1hdGNoKGV4cHIsICdiYXonKSwgJ3sqKi9iYXosKiovZm9vfScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLm1hdGNoKGV4cHIsICdhYmMnKSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZhbHN5IGV4cHJlc3Npb24vcGF0dGVybicsIGZ1bmN0aW9uICgpIHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5tYXRjaChudWxsISwgJ2ZvbycpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IubWF0Y2goJycsICdmb28nKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLnBhcnNlKG51bGwhKSgnZm9vJyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5wYXJzZSgnJykoJ2ZvbycpLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZhbHN5IHBhdGgnLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IucGFyc2UoJ2ZvbycpKG51bGwhKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLnBhcnNlKCdmb28nKSgnJyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5wYXJzZSgnKiovKi5qPycpKG51bGwhKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLnBhcnNlKCcqKi8qLmo/JykoJycpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IucGFyc2UoJyoqLyouZm9vJykobnVsbCEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IucGFyc2UoJyoqLyouZm9vJykoJycpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IucGFyc2UoJyoqL2ZvbycpKG51bGwhKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLnBhcnNlKCcqKi9mb28nKSgnJyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5wYXJzZSgneyoqL2JheiwqKi9mb299JykobnVsbCEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IucGFyc2UoJ3sqKi9iYXosKiovZm9vfScpKCcnKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLnBhcnNlKCd7KiovKi5iYXosKiovKi5mb299JykobnVsbCEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IucGFyc2UoJ3sqKi8qLmJheiwqKi8qLmZvb30nKSgnJyksIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnZXhwcmVzc2lvbi9wYXR0ZXJuIGJhc2VuYW1lJywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLnBhcnNlKCcqKi9mb28nKSgnYmFyL2JheicsICdiYXonKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLnBhcnNlKCcqKi9mb28nKSgnYmFyL2ZvbycsICdmb28nKSwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5wYXJzZSgneyoqL2JheiwqKi9mb299JykoJ2Jhei9iYXInLCAnYmFyJyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5wYXJzZSgneyoqL2JheiwqKi9mb299JykoJ2Jhei9mb28nLCAnZm9vJyksIHRydWUpO1xuXG5cdFx0Y29uc3QgZXhwciA9IHsgJyoqLyouanMnOiB7IHdoZW46ICckKGJhc2VuYW1lKS50cycgfSB9O1xuXHRcdGNvbnN0IHNpYmxpbmdzID0gWydmb28udHMnLCAnZm9vLmpzJ107XG5cdFx0Y29uc3QgaGFzU2libGluZyA9IChuYW1lOiBzdHJpbmcpID0+IHNpYmxpbmdzLmluZGV4T2YobmFtZSkgIT09IC0xO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IucGFyc2UoZXhwcikoJ2Jhci9iYXouanMnLCAnYmF6LmpzJywgaGFzU2libGluZyksIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLnBhcnNlKGV4cHIpKCdiYXIvZm9vLmpzJywgJ2Zvby5qcycsIGhhc1NpYmxpbmcpLCAnKiovKi5qcycpO1xuXHR9KTtcblxuXHR0ZXN0KCdleHByZXNzaW9uL3BhdHRlcm4gYmFzZW5hbWUgdGVybXMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnbG9iLmdldEJhc2VuYW1lVGVybXMoZ2xvYi5wYXJzZSgnKiovKi5mb28nKSksIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdsb2IuZ2V0QmFzZW5hbWVUZXJtcyhnbG9iLnBhcnNlKCcqKi9mb28nKSksIFsnZm9vJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2xvYi5nZXRCYXNlbmFtZVRlcm1zKGdsb2IucGFyc2UoJyoqL2Zvby8nKSksIFsnZm9vJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2xvYi5nZXRCYXNlbmFtZVRlcm1zKGdsb2IucGFyc2UoJ3sqKi9iYXosKiovZm9vfScpKSwgWydiYXonLCAnZm9vJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2xvYi5nZXRCYXNlbmFtZVRlcm1zKGdsb2IucGFyc2UoJ3sqKi9iYXovLCoqL2Zvby99JykpLCBbJ2JheicsICdmb28nXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdsb2IuZ2V0QmFzZW5hbWVUZXJtcyhnbG9iLnBhcnNlKHtcblx0XHRcdCcqKi9mb28nOiB0cnVlLFxuXHRcdFx0J3sqKi9iYXIsKiovYmF6fSc6IHRydWUsXG5cdFx0XHQneyoqL2JhcjIvLCoqL2JhejIvfSc6IHRydWUsXG5cdFx0XHQnKiovYnVsYic6IGZhbHNlXG5cdFx0fSkpLCBbJ2ZvbycsICdiYXInLCAnYmF6JywgJ2JhcjInLCAnYmF6MiddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdsb2IuZ2V0QmFzZW5hbWVUZXJtcyhnbG9iLnBhcnNlKHtcblx0XHRcdCcqKi9mb28nOiB7IHdoZW46ICckKGJhc2VuYW1lKS56aXAnIH0sXG5cdFx0XHQnKiovYmFyJzogdHJ1ZVxuXHRcdH0pKSwgWydiYXInXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V4cHJlc3Npb24vcGF0dGVybiBvcHRpbWl6YXRpb24gZm9yIGJhc2VuYW1lcycsIGZ1bmN0aW9uICgpIHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdsb2IuZ2V0QmFzZW5hbWVUZXJtcyhnbG9iLnBhcnNlKCcqKi9mb28vKionKSksIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdsb2IuZ2V0QmFzZW5hbWVUZXJtcyhnbG9iLnBhcnNlKCcqKi9mb28vKionLCB7IHRyaW1Gb3JFeGNsdXNpb25zOiB0cnVlIH0pKSwgWydmb28nXSk7XG5cblx0XHR0ZXN0T3B0aW1pemF0aW9uRm9yQmFzZW5hbWVzKCcqKi8qLmZvby8qKicsIFtdLCBbWydiYXovYmFyLmZvby9iYXIvYmF6JywgdHJ1ZV1dKTtcblx0XHR0ZXN0T3B0aW1pemF0aW9uRm9yQmFzZW5hbWVzKCcqKi9mb28vKionLCBbJ2ZvbyddLCBbWydiYXIvZm9vJywgdHJ1ZV0sIFsnYmFyL2Zvby9iYXonLCBmYWxzZV1dKTtcblx0XHR0ZXN0T3B0aW1pemF0aW9uRm9yQmFzZW5hbWVzKCd7KiovYmF6LyoqLCoqL2Zvby8qKn0nLCBbJ2JheicsICdmb28nXSwgW1snYmFyL2JheicsIHRydWVdLCBbJ2Jhci9mb28nLCB0cnVlXV0pO1xuXG5cdFx0dGVzdE9wdGltaXphdGlvbkZvckJhc2VuYW1lcyh7XG5cdFx0XHQnKiovZm9vLyoqJzogdHJ1ZSxcblx0XHRcdCd7KiovYmFyLyoqLCoqL2Jhei8qKn0nOiB0cnVlLFxuXHRcdFx0JyoqL2J1bGIvKionOiBmYWxzZVxuXHRcdH0sIFsnZm9vJywgJ2JhcicsICdiYXonXSwgW1xuXHRcdFx0WydiYXIvZm9vJywgJyoqL2Zvby8qKiddLFxuXHRcdFx0Wydmb28vYmFyJywgJ3sqKi9iYXIvKiosKiovYmF6LyoqfSddLFxuXHRcdFx0WydiYXIvbm9wZScsIG51bGwhXVxuXHRcdF0pO1xuXG5cdFx0Y29uc3Qgc2libGluZ3MgPSBbJ2JheicsICdiYXouemlwJywgJ25vcGUnXTtcblx0XHRjb25zdCBoYXNTaWJsaW5nID0gKG5hbWU6IHN0cmluZykgPT4gc2libGluZ3MuaW5kZXhPZihuYW1lKSAhPT0gLTE7XG5cdFx0dGVzdE9wdGltaXphdGlvbkZvckJhc2VuYW1lcyh7XG5cdFx0XHQnKiovZm9vLyoqJzogeyB3aGVuOiAnJChiYXNlbmFtZSkuemlwJyB9LFxuXHRcdFx0JyoqL2Jhci8qKic6IHRydWVcblx0XHR9LCBbJ2JhciddLCBbXG5cdFx0XHRbJ2Jhci9mb28nLCBudWxsIV0sXG5cdFx0XHRbJ2Jhci9mb28vYmF6JywgbnVsbCFdLFxuXHRcdFx0WydiYXIvZm9vL25vcGUnLCBudWxsIV0sXG5cdFx0XHRbJ2Zvby9iYXInLCAnKiovYmFyLyoqJ10sXG5cdFx0XSwgW1xuXHRcdFx0bnVsbCEsXG5cdFx0XHRoYXNTaWJsaW5nLFxuXHRcdFx0aGFzU2libGluZ1xuXHRcdF0pO1xuXHR9KTtcblxuXHRmdW5jdGlvbiB0ZXN0T3B0aW1pemF0aW9uRm9yQmFzZW5hbWVzKHBhdHRlcm46IHN0cmluZyB8IGdsb2IuSUV4cHJlc3Npb24sIGJhc2VuYW1lVGVybXM6IHN0cmluZ1tdLCBtYXRjaGVzOiBbc3RyaW5nLCBzdHJpbmcgfCBib29sZWFuXVtdLCBzaWJsaW5nc0ZuczogKChuYW1lOiBzdHJpbmcpID0+IGJvb2xlYW4pW10gPSBbXSkge1xuXHRcdGNvbnN0IHBhcnNlZCA9IGdsb2IucGFyc2UoPGdsb2IuSUV4cHJlc3Npb24+cGF0dGVybiwgeyB0cmltRm9yRXhjbHVzaW9uczogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdsb2IuZ2V0QmFzZW5hbWVUZXJtcyhwYXJzZWQpLCBiYXNlbmFtZVRlcm1zKTtcblx0XHRtYXRjaGVzLmZvckVhY2goKFt0ZXh0LCByZXN1bHRdLCBpKSA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFyc2VkKHRleHQsIG51bGwhLCBzaWJsaW5nc0Zuc1tpXSksIHJlc3VsdCk7XG5cdFx0fSk7XG5cdH1cblxuXHR0ZXN0KCd0cmFpbGluZyBzbGFzaCcsIGZ1bmN0aW9uICgpIHtcblx0XHQvLyBUZXN0aW5nIGV4aXN0aW5nIChtb3JlIG9yIGxlc3MgaW50dWl0aXZlKSBiZWhhdmlvclxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLnBhcnNlKCcqKi9mb28vJykoJ2Jhci9iYXonLCAnYmF6JyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5wYXJzZSgnKiovZm9vLycpKCdiYXIvZm9vJywgJ2ZvbycpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5wYXJzZSgnKiovKi5mb28vJykoJ2Jhci9maWxlLmJheicsICdmaWxlLmJheicpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IucGFyc2UoJyoqLyouZm9vLycpKCdiYXIvZmlsZS5mb28nLCAnZmlsZS5mb28nKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IucGFyc2UoJ3sqKi9mb28vLCoqL2FiYy99JykoJ2Jhci9iYXonLCAnYmF6JyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5wYXJzZSgneyoqL2Zvby8sKiovYWJjL30nKSgnYmFyL2ZvbycsICdmb28nKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IucGFyc2UoJ3sqKi9mb28vLCoqL2FiYy99JykoJ2Jhci9hYmMnLCAnYWJjJyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLnBhcnNlKCd7KiovZm9vLywqKi9hYmMvfScsIHsgdHJpbUZvckV4Y2x1c2lvbnM6IHRydWUgfSkoJ2Jhci9iYXonLCAnYmF6JyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5wYXJzZSgneyoqL2Zvby8sKiovYWJjL30nLCB7IHRyaW1Gb3JFeGNsdXNpb25zOiB0cnVlIH0pKCdiYXIvZm9vJywgJ2ZvbycpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5wYXJzZSgneyoqL2Zvby8sKiovYWJjL30nLCB7IHRyaW1Gb3JFeGNsdXNpb25zOiB0cnVlIH0pKCdiYXIvYWJjJywgJ2FiYycpLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnZXhwcmVzc2lvbi9wYXR0ZXJuIHBhdGgnLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IucGFyc2UoJyoqL2Zvby9iYXInKShuYXRpdmVTZXAoJ2Zvby9iYXonKSwgJ2JheicpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IucGFyc2UoJyoqL2Zvby9iYXInKShuYXRpdmVTZXAoJ2Zvby9iYXInKSwgJ2JhcicpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5wYXJzZSgnKiovZm9vL2JhcicpKG5hdGl2ZVNlcCgnYmFyL2Zvby9iYXInKSwgJ2JhcicpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5wYXJzZSgnKiovZm9vL2Jhci8qKicpKG5hdGl2ZVNlcCgnYmFyL2Zvby9iYXInKSwgJ2JhcicpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5wYXJzZSgnKiovZm9vL2Jhci8qKicpKG5hdGl2ZVNlcCgnYmFyL2Zvby9iYXIvYmF6JyksICdiYXonKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IucGFyc2UoJyoqL2Zvby9iYXIvKionLCB7IHRyaW1Gb3JFeGNsdXNpb25zOiB0cnVlIH0pKG5hdGl2ZVNlcCgnYmFyL2Zvby9iYXInKSwgJ2JhcicpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5wYXJzZSgnKiovZm9vL2Jhci8qKicsIHsgdHJpbUZvckV4Y2x1c2lvbnM6IHRydWUgfSkobmF0aXZlU2VwKCdiYXIvZm9vL2Jhci9iYXonKSwgJ2JheicpLCBmYWxzZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5wYXJzZSgnZm9vL2JhcicpKG5hdGl2ZVNlcCgnZm9vL2JheicpLCAnYmF6JyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5wYXJzZSgnZm9vL2JhcicpKG5hdGl2ZVNlcCgnZm9vL2JhcicpLCAnYmFyJyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLnBhcnNlKCdmb28vYmFyL2JheicpKG5hdGl2ZVNlcCgnZm9vL2Jhci9iYXonKSwgJ2JheicpLCB0cnVlKTsgLy8gIzE1NDI0XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2IucGFyc2UoJ2Zvby9iYXInKShuYXRpdmVTZXAoJ2Jhci9mb28vYmFyJyksICdiYXInKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLnBhcnNlKCdmb28vYmFyLyoqJykobmF0aXZlU2VwKCdmb28vYmFyL2JheicpLCAnYmF6JyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnbG9iLnBhcnNlKCdmb28vYmFyLyoqJywgeyB0cmltRm9yRXhjbHVzaW9uczogdHJ1ZSB9KShuYXRpdmVTZXAoJ2Zvby9iYXInKSwgJ2JhcicpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2xvYi5wYXJzZSgnZm9vL2Jhci8qKicsIHsgdHJpbUZvckV4Y2x1c2lvbnM6IHRydWUgfSkobmF0aXZlU2VwKCdmb28vYmFyL2JheicpLCAnYmF6JyksIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnZXhwcmVzc2lvbi9wYXR0ZXJuIHBhdGhzJywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2xvYi5nZXRQYXRoVGVybXMoZ2xvYi5wYXJzZSgnKiovKi5mb28nKSksIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdsb2IuZ2V0UGF0aFRlcm1zKGdsb2IucGFyc2UoJyoqL2ZvbycpKSwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2xvYi5nZXRQYXRoVGVybXMoZ2xvYi5wYXJzZSgnKiovZm9vL2JhcicpKSwgWycqL2Zvby9iYXInXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnbG9iLmdldFBhdGhUZXJtcyhnbG9iLnBhcnNlKCcqKi9mb28vYmFyLycpKSwgWycqL2Zvby9iYXInXSk7XG5cdFx0Ly8gTm90IHN1cHBvcnRlZFxuXHRcdC8vIGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2xvYi5nZXRQYXRoVGVybXMoZ2xvYi5wYXJzZSgneyoqL2Jhei9iYXIsKiovZm9vL2JhciwqKi9iYXJ9JykpLCBbJyovYmF6L2JhcicsICcqL2Zvby9iYXInXSk7XG5cdFx0Ly8gYXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnbG9iLmdldFBhdGhUZXJtcyhnbG9iLnBhcnNlKCd7KiovYmF6L2Jhci8sKiovZm9vL2Jhci8sKiovYmFyL30nKSksIFsnKi9iYXovYmFyJywgJyovZm9vL2JhciddKTtcblxuXHRcdGNvbnN0IHBhcnNlZCA9IGdsb2IucGFyc2Uoe1xuXHRcdFx0JyoqL2Zvby9iYXInOiB0cnVlLFxuXHRcdFx0JyoqL2ZvbzIvYmFyMic6IHRydWUsXG5cdFx0XHQvLyBOb3Qgc3VwcG9ydGVkXG5cdFx0XHQvLyAneyoqL2Jhci9mb28sKiovYmF6L2Zvb30nOiB0cnVlLFxuXHRcdFx0Ly8gJ3sqKi9iYXIyL2Zvby8sKiovYmF6Mi9mb28vfSc6IHRydWUsXG5cdFx0XHQnKiovYnVsYic6IHRydWUsXG5cdFx0XHQnKiovYnVsYjInOiB0cnVlLFxuXHRcdFx0JyoqL2J1bGIvZm9vJzogZmFsc2Vcblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdsb2IuZ2V0UGF0aFRlcm1zKHBhcnNlZCksIFsnKi9mb28vYmFyJywgJyovZm9vMi9iYXIyJ10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2xvYi5nZXRCYXNlbmFtZVRlcm1zKHBhcnNlZCksIFsnYnVsYicsICdidWxiMiddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdsb2IuZ2V0UGF0aFRlcm1zKGdsb2IucGFyc2Uoe1xuXHRcdFx0JyoqL2Zvby9iYXInOiB7IHdoZW46ICckKGJhc2VuYW1lKS56aXAnIH0sXG5cdFx0XHQnKiovYmFyL2Zvbyc6IHRydWUsXG5cdFx0XHQnKiovYmFyMi9mb28yJzogdHJ1ZVxuXHRcdH0pKSwgWycqL2Jhci9mb28nLCAnKi9iYXIyL2ZvbzInXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V4cHJlc3Npb24vcGF0dGVybiBvcHRpbWl6YXRpb24gZm9yIHBhdGhzJywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2xvYi5nZXRQYXRoVGVybXMoZ2xvYi5wYXJzZSgnKiovZm9vL2Jhci8qKicpKSwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2xvYi5nZXRQYXRoVGVybXMoZ2xvYi5wYXJzZSgnKiovZm9vL2Jhci8qKicsIHsgdHJpbUZvckV4Y2x1c2lvbnM6IHRydWUgfSkpLCBbJyovZm9vL2JhciddKTtcblxuXHRcdHRlc3RPcHRpbWl6YXRpb25Gb3JQYXRocygnKiovKi5mb28vYmFyLyoqJywgW10sIFtbbmF0aXZlU2VwKCdiYXovYmFyLmZvby9iYXIvYmF6JyksIHRydWVdXSk7XG5cdFx0dGVzdE9wdGltaXphdGlvbkZvclBhdGhzKCcqKi9mb28vYmFyLyoqJywgWycqL2Zvby9iYXInXSwgW1tuYXRpdmVTZXAoJ2Jhci9mb28vYmFyJyksIHRydWVdLCBbbmF0aXZlU2VwKCdiYXIvZm9vL2Jhci9iYXonKSwgZmFsc2VdXSk7XG5cdFx0Ly8gTm90IHN1cHBvcnRlZFxuXHRcdC8vIHRlc3RPcHRpbWl6YXRpb25Gb3JQYXRocygneyoqL2Jhei9iYXIvKiosKiovZm9vL2Jhci8qKn0nLCBbJyovYmF6L2JhcicsICcqL2Zvby9iYXInXSwgW1tuYXRpdmVTZXAoJ2Jhci9iYXovYmFyJyksIHRydWVdLCBbbmF0aXZlU2VwKCdiYXIvZm9vL2JhcicpLCB0cnVlXV0pO1xuXG5cdFx0dGVzdE9wdGltaXphdGlvbkZvclBhdGhzKHtcblx0XHRcdCcqKi9mb28vYmFyLyoqJzogdHJ1ZSxcblx0XHRcdC8vIE5vdCBzdXBwb3J0ZWRcblx0XHRcdC8vICd7KiovYmFyL2Jhci8qKiwqKi9iYXovYmFyLyoqfSc6IHRydWUsXG5cdFx0XHQnKiovYnVsYi9iYXIvKionOiBmYWxzZVxuXHRcdH0sIFsnKi9mb28vYmFyJ10sIFtcblx0XHRcdFtuYXRpdmVTZXAoJ2Jhci9mb28vYmFyJyksICcqKi9mb28vYmFyLyoqJ10sXG5cdFx0XHQvLyBOb3Qgc3VwcG9ydGVkXG5cdFx0XHQvLyBbbmF0aXZlU2VwKCdmb28vYmFyL2JhcicpLCAneyoqL2Jhci9iYXIvKiosKiovYmF6L2Jhci8qKn0nXSxcblx0XHRcdFtuYXRpdmVTZXAoJy9mb28vYmFyL25vcGUnKSwgbnVsbCFdXG5cdFx0XSk7XG5cblx0XHRjb25zdCBzaWJsaW5ncyA9IFsnYmF6JywgJ2Jhei56aXAnLCAnbm9wZSddO1xuXHRcdGNvbnN0IGhhc1NpYmxpbmcgPSAobmFtZTogc3RyaW5nKSA9PiBzaWJsaW5ncy5pbmRleE9mKG5hbWUpICE9PSAtMTtcblx0XHR0ZXN0T3B0aW1pemF0aW9uRm9yUGF0aHMoe1xuXHRcdFx0JyoqL2Zvby8xMjMvKionOiB7IHdoZW46ICckKGJhc2VuYW1lKS56aXAnIH0sXG5cdFx0XHQnKiovYmFyLzEyMy8qKic6IHRydWVcblx0XHR9LCBbJyovYmFyLzEyMyddLCBbXG5cdFx0XHRbbmF0aXZlU2VwKCdiYXIvZm9vLzEyMycpLCBudWxsIV0sXG5cdFx0XHRbbmF0aXZlU2VwKCdiYXIvZm9vLzEyMy9iYXonKSwgbnVsbCFdLFxuXHRcdFx0W25hdGl2ZVNlcCgnYmFyL2Zvby8xMjMvbm9wZScpLCBudWxsIV0sXG5cdFx0XHRbbmF0aXZlU2VwKCdmb28vYmFyLzEyMycpLCAnKiovYmFyLzEyMy8qKiddLFxuXHRcdF0sIFtcblx0XHRcdG51bGwhLFxuXHRcdFx0aGFzU2libGluZyxcblx0XHRcdGhhc1NpYmxpbmdcblx0XHRdKTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gdGVzdE9wdGltaXphdGlvbkZvclBhdGhzKHBhdHRlcm46IHN0cmluZyB8IGdsb2IuSUV4cHJlc3Npb24sIHBhdGhUZXJtczogc3RyaW5nW10sIG1hdGNoZXM6IFtzdHJpbmcsIHN0cmluZyB8IGJvb2xlYW5dW10sIHNpYmxpbmdzRm5zOiAoKG5hbWU6IHN0cmluZykgPT4gYm9vbGVhbilbXSA9IFtdKSB7XG5cdFx0Y29uc3QgcGFyc2VkID0gZ2xvYi5wYXJzZSg8Z2xvYi5JRXhwcmVzc2lvbj5wYXR0ZXJuLCB7IHRyaW1Gb3JFeGNsdXNpb25zOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2xvYi5nZXRQYXRoVGVybXMocGFyc2VkKSwgcGF0aFRlcm1zKTtcblx0XHRtYXRjaGVzLmZvckVhY2goKFt0ZXh0LCByZXN1bHRdLCBpKSA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFyc2VkKHRleHQsIG51bGwhLCBzaWJsaW5nc0Zuc1tpXSksIHJlc3VsdCk7XG5cdFx0fSk7XG5cdH1cblxuXHRmdW5jdGlvbiBuYXRpdmVTZXAoc2xhc2hQYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdHJldHVybiBzbGFzaFBhdGgucmVwbGFjZSgvXFwvL2csIHNlcCk7XG5cdH1cblxuXHR0ZXN0KCdyZWxhdGl2ZSBwYXR0ZXJuIC0gZ2xvYiBzdGFyJywgZnVuY3Rpb24gKCkge1xuXHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdGNvbnN0IHA6IGdsb2IuSVJlbGF0aXZlUGF0dGVybiA9IHsgYmFzZTogJ0M6XFxcXEROWENvbnNvbGVBcHBcXFxcZm9vJywgcGF0dGVybjogJyoqLyouY3MnIH07XG5cdFx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ0M6XFxcXEROWENvbnNvbGVBcHBcXFxcZm9vXFxcXFByb2dyYW0uY3MnKTtcblx0XHRcdGFzc2VydEdsb2JNYXRjaChwLCAnQzpcXFxcRE5YQ29uc29sZUFwcFxcXFxmb29cXFxcYmFyXFxcXFByb2dyYW0uY3MnKTtcblx0XHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdDOlxcXFxETlhDb25zb2xlQXBwXFxcXGZvb1xcXFxQcm9ncmFtLnRzJyk7XG5cdFx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnQzpcXFxcRE5YQ29uc29sZUFwcFxcXFxQcm9ncmFtLmNzJyk7XG5cdFx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnQzpcXFxcb3RoZXJcXFxcRE5YQ29uc29sZUFwcFxcXFxmb29cXFxcUHJvZ3JhbS50cycpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBwOiBnbG9iLklSZWxhdGl2ZVBhdHRlcm4gPSB7IGJhc2U6ICcvRE5YQ29uc29sZUFwcC9mb28nLCBwYXR0ZXJuOiAnKiovKi5jcycgfTtcblx0XHRcdGFzc2VydEdsb2JNYXRjaChwLCAnL0ROWENvbnNvbGVBcHAvZm9vL1Byb2dyYW0uY3MnKTtcblx0XHRcdGFzc2VydEdsb2JNYXRjaChwLCAnL0ROWENvbnNvbGVBcHAvZm9vL2Jhci9Qcm9ncmFtLmNzJyk7XG5cdFx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnL0ROWENvbnNvbGVBcHAvZm9vL1Byb2dyYW0udHMnKTtcblx0XHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICcvRE5YQ29uc29sZUFwcC9Qcm9ncmFtLmNzJyk7XG5cdFx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnL290aGVyL0ROWENvbnNvbGVBcHAvZm9vL1Byb2dyYW0udHMnKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbGF0aXZlIHBhdHRlcm4gLSBzaW5nbGUgc3RhcicsIGZ1bmN0aW9uICgpIHtcblx0XHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0XHRjb25zdCBwOiBnbG9iLklSZWxhdGl2ZVBhdHRlcm4gPSB7IGJhc2U6ICdDOlxcXFxETlhDb25zb2xlQXBwXFxcXGZvbycsIHBhdHRlcm46ICcqLmNzJyB9O1xuXHRcdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdDOlxcXFxETlhDb25zb2xlQXBwXFxcXGZvb1xcXFxQcm9ncmFtLmNzJyk7XG5cdFx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnQzpcXFxcRE5YQ29uc29sZUFwcFxcXFxmb29cXFxcYmFyXFxcXFByb2dyYW0uY3MnKTtcblx0XHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdDOlxcXFxETlhDb25zb2xlQXBwXFxcXGZvb1xcXFxQcm9ncmFtLnRzJyk7XG5cdFx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnQzpcXFxcRE5YQ29uc29sZUFwcFxcXFxQcm9ncmFtLmNzJyk7XG5cdFx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnQzpcXFxcb3RoZXJcXFxcRE5YQ29uc29sZUFwcFxcXFxmb29cXFxcUHJvZ3JhbS50cycpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBwOiBnbG9iLklSZWxhdGl2ZVBhdHRlcm4gPSB7IGJhc2U6ICcvRE5YQ29uc29sZUFwcC9mb28nLCBwYXR0ZXJuOiAnKi5jcycgfTtcblx0XHRcdGFzc2VydEdsb2JNYXRjaChwLCAnL0ROWENvbnNvbGVBcHAvZm9vL1Byb2dyYW0uY3MnKTtcblx0XHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICcvRE5YQ29uc29sZUFwcC9mb28vYmFyL1Byb2dyYW0uY3MnKTtcblx0XHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICcvRE5YQ29uc29sZUFwcC9mb28vUHJvZ3JhbS50cycpO1xuXHRcdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJy9ETlhDb25zb2xlQXBwL1Byb2dyYW0uY3MnKTtcblx0XHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICcvb3RoZXIvRE5YQ29uc29sZUFwcC9mb28vUHJvZ3JhbS50cycpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgncmVsYXRpdmUgcGF0dGVybiAtIHNpbmdsZSBzdGFyIHdpdGggcGF0aCcsIGZ1bmN0aW9uICgpIHtcblx0XHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0XHRjb25zdCBwOiBnbG9iLklSZWxhdGl2ZVBhdHRlcm4gPSB7IGJhc2U6ICdDOlxcXFxETlhDb25zb2xlQXBwXFxcXGZvbycsIHBhdHRlcm46ICdzb21ldGhpbmcvKi5jcycgfTtcblx0XHRcdGFzc2VydEdsb2JNYXRjaChwLCAnQzpcXFxcRE5YQ29uc29sZUFwcFxcXFxmb29cXFxcc29tZXRoaW5nXFxcXFByb2dyYW0uY3MnKTtcblx0XHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICdDOlxcXFxETlhDb25zb2xlQXBwXFxcXGZvb1xcXFxQcm9ncmFtLmNzJyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IHA6IGdsb2IuSVJlbGF0aXZlUGF0dGVybiA9IHsgYmFzZTogJy9ETlhDb25zb2xlQXBwL2ZvbycsIHBhdHRlcm46ICdzb21ldGhpbmcvKi5jcycgfTtcblx0XHRcdGFzc2VydEdsb2JNYXRjaChwLCAnL0ROWENvbnNvbGVBcHAvZm9vL3NvbWV0aGluZy9Qcm9ncmFtLmNzJyk7XG5cdFx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnL0ROWENvbnNvbGVBcHAvZm9vL1Byb2dyYW0uY3MnKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbGF0aXZlIHBhdHRlcm4gLSBzaW5nbGUgc3RhciBhbG9uZScsIGZ1bmN0aW9uICgpIHtcblx0XHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0XHRjb25zdCBwOiBnbG9iLklSZWxhdGl2ZVBhdHRlcm4gPSB7IGJhc2U6ICdDOlxcXFxETlhDb25zb2xlQXBwXFxcXGZvb1xcXFxzb21ldGhpbmdcXFxcUHJvZ3JhbS5jcycsIHBhdHRlcm46ICcqJyB9O1xuXHRcdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdDOlxcXFxETlhDb25zb2xlQXBwXFxcXGZvb1xcXFxzb21ldGhpbmdcXFxcUHJvZ3JhbS5jcycpO1xuXHRcdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJ0M6XFxcXEROWENvbnNvbGVBcHBcXFxcZm9vXFxcXFByb2dyYW0uY3MnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgcDogZ2xvYi5JUmVsYXRpdmVQYXR0ZXJuID0geyBiYXNlOiAnL0ROWENvbnNvbGVBcHAvZm9vL3NvbWV0aGluZy9Qcm9ncmFtLmNzJywgcGF0dGVybjogJyonIH07XG5cdFx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy9ETlhDb25zb2xlQXBwL2Zvby9zb21ldGhpbmcvUHJvZ3JhbS5jcycpO1xuXHRcdFx0YXNzZXJ0Tm9HbG9iTWF0Y2gocCwgJy9ETlhDb25zb2xlQXBwL2Zvby9Qcm9ncmFtLmNzJyk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdyZWxhdGl2ZSBwYXR0ZXJuIC0gaWdub3JlcyBjYXNlIG9uIG1hY09TL1dpbmRvd3MnLCBmdW5jdGlvbiAoKSB7XG5cdFx0aWYgKGlzV2luZG93cykge1xuXHRcdFx0Y29uc3QgcDogZ2xvYi5JUmVsYXRpdmVQYXR0ZXJuID0geyBiYXNlOiAnQzpcXFxcRE5YQ29uc29sZUFwcFxcXFxmb28nLCBwYXR0ZXJuOiAnc29tZXRoaW5nLyouY3MnIH07XG5cdFx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ0M6XFxcXEROWENvbnNvbGVBcHBcXFxcZm9vXFxcXHNvbWV0aGluZ1xcXFxQcm9ncmFtLmNzJy50b0xvd2VyQ2FzZSgpKTtcblx0XHR9IGVsc2UgaWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0XHRjb25zdCBwOiBnbG9iLklSZWxhdGl2ZVBhdHRlcm4gPSB7IGJhc2U6ICcvRE5YQ29uc29sZUFwcC9mb28nLCBwYXR0ZXJuOiAnc29tZXRoaW5nLyouY3MnIH07XG5cdFx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy9ETlhDb25zb2xlQXBwL2Zvby9zb21ldGhpbmcvUHJvZ3JhbS5jcycudG9Mb3dlckNhc2UoKSk7XG5cdFx0fSBlbHNlIGlmIChpc0xpbnV4KSB7XG5cdFx0XHRjb25zdCBwOiBnbG9iLklSZWxhdGl2ZVBhdHRlcm4gPSB7IGJhc2U6ICcvRE5YQ29uc29sZUFwcC9mb28nLCBwYXR0ZXJuOiAnc29tZXRoaW5nLyouY3MnIH07XG5cdFx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnL0ROWENvbnNvbGVBcHAvZm9vL3NvbWV0aGluZy9Qcm9ncmFtLmNzJy50b0xvd2VyQ2FzZSgpKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbGF0aXZlIHBhdHRlcm4gLSB0cmFpbGluZyBzbGFzaCAvIGJhY2tzbGFzaCAoIzE2MjQ5OCknLCBmdW5jdGlvbiAoKSB7XG5cdFx0aWYgKGlzV2luZG93cykge1xuXHRcdFx0bGV0IHA6IGdsb2IuSVJlbGF0aXZlUGF0dGVybiA9IHsgYmFzZTogJ0M6XFxcXCcsIHBhdHRlcm46ICdmb28uY3MnIH07XG5cdFx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ0M6XFxcXGZvby5jcycpO1xuXG5cdFx0XHRwID0geyBiYXNlOiAnQzpcXFxcYmFyXFxcXCcsIHBhdHRlcm46ICdmb28uY3MnIH07XG5cdFx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJ0M6XFxcXGJhclxcXFxmb28uY3MnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bGV0IHA6IGdsb2IuSVJlbGF0aXZlUGF0dGVybiA9IHsgYmFzZTogJy8nLCBwYXR0ZXJuOiAnZm9vLmNzJyB9O1xuXHRcdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICcvZm9vLmNzJyk7XG5cblx0XHRcdHAgPSB7IGJhc2U6ICcvYmFyLycsIHBhdHRlcm46ICdmb28uY3MnIH07XG5cdFx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgJy9iYXIvZm9vLmNzJyk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdwYXR0ZXJuIHdpdGggXCJiYXNlXCIgZG9lcyBub3QgZXhwbG9kZSAtICMzNjA4MScsIGZ1bmN0aW9uICgpIHtcblx0XHRhc3NlcnQub2soZ2xvYi5tYXRjaCh7ICdiYXNlJzogdHJ1ZSB9LCAnYmFzZScpKTtcblx0fSk7XG5cblx0dGVzdCgncmVsYXRpdmUgcGF0dGVybiAtICM1NzQ3NScsIGZ1bmN0aW9uICgpIHtcblx0XHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0XHRjb25zdCBwOiBnbG9iLklSZWxhdGl2ZVBhdHRlcm4gPSB7IGJhc2U6ICdDOlxcXFxETlhDb25zb2xlQXBwXFxcXGZvbycsIHBhdHRlcm46ICdzdHlsZXMvc3R5bGUuY3NzJyB9O1xuXHRcdFx0YXNzZXJ0R2xvYk1hdGNoKHAsICdDOlxcXFxETlhDb25zb2xlQXBwXFxcXGZvb1xcXFxzdHlsZXNcXFxcc3R5bGUuY3NzJyk7XG5cdFx0XHRhc3NlcnROb0dsb2JNYXRjaChwLCAnQzpcXFxcRE5YQ29uc29sZUFwcFxcXFxmb29cXFxcUHJvZ3JhbS5jcycpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBwOiBnbG9iLklSZWxhdGl2ZVBhdHRlcm4gPSB7IGJhc2U6ICcvRE5YQ29uc29sZUFwcC9mb28nLCBwYXR0ZXJuOiAnc3R5bGVzL3N0eWxlLmNzcycgfTtcblx0XHRcdGFzc2VydEdsb2JNYXRjaChwLCAnL0ROWENvbnNvbGVBcHAvZm9vL3N0eWxlcy9zdHlsZS5jc3MnKTtcblx0XHRcdGFzc2VydE5vR2xvYk1hdGNoKHAsICcvRE5YQ29uc29sZUFwcC9mb28vUHJvZ3JhbS5jcycpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnVVJJIG1hdGNoJywgKCkgPT4ge1xuXHRcdGNvbnN0IHAgPSAnc2NoZW1lOi8qKi8qLm1kJztcblx0XHRhc3NlcnRHbG9iTWF0Y2gocCwgVVJJLmZpbGUoJ3N1cGVyL2R1cGVyL2xvbmcvc29tZS9maWxlLm1kJykud2l0aCh7IHNjaGVtZTogJ3NjaGVtZScgfSkudG9TdHJpbmcoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V4cHJlc3Npb24gZmFpbHMgd2hlbiBzaWJsaW5ncyB1c2UgcHJvbWlzZXMgKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNDYyOTQpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHNpYmxpbmdzID0gWyd0ZXN0Lmh0bWwnLCAndGVzdC50eHQnLCAndGVzdC50cyddO1xuXHRcdGNvbnN0IGhhc1NpYmxpbmcgPSAobmFtZTogc3RyaW5nKSA9PiBQcm9taXNlLnJlc29sdmUoc2libGluZ3MuaW5kZXhPZihuYW1lKSAhPT0gLTEpO1xuXG5cdFx0Ly8geyBcIioqLyouanNcIjogeyBcIndoZW5cIjogXCIkKGJhc2VuYW1lKS50c1wiIH0gfVxuXHRcdGNvbnN0IGV4cHJlc3Npb246IGdsb2IuSUV4cHJlc3Npb24gPSB7XG5cdFx0XHQnKiovdGVzdC5qcyc6IHsgd2hlbjogJyQoYmFzZW5hbWUpLmpzJyB9LFxuXHRcdFx0JyoqLyouanMnOiB7IHdoZW46ICckKGJhc2VuYW1lKS50cycgfVxuXHRcdH07XG5cblx0XHRjb25zdCBwYXJzZWRFeHByZXNzaW9uID0gZ2xvYi5wYXJzZShleHByZXNzaW9uKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgnKiovKi5qcycsIGF3YWl0IHBhcnNlZEV4cHJlc3Npb24oJ3Rlc3QuanMnLCB1bmRlZmluZWQsIGhhc1NpYmxpbmcpKTtcblx0fSk7XG5cblx0dGVzdCgncGF0dGVybnNFcXVhbHMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0Lm9rKGdsb2IucGF0dGVybnNFcXVhbHMoWydhJ10sIFsnYSddKSk7XG5cdFx0YXNzZXJ0Lm9rKCFnbG9iLnBhdHRlcm5zRXF1YWxzKFsnYSddLCBbJ2InXSkpO1xuXG5cdFx0YXNzZXJ0Lm9rKGdsb2IucGF0dGVybnNFcXVhbHMoWydhJywgJ2InLCAnYyddLCBbJ2EnLCAnYicsICdjJ10pKTtcblx0XHRhc3NlcnQub2soIWdsb2IucGF0dGVybnNFcXVhbHMoWycxJywgJzInXSwgWycxJywgJzMnXSkpO1xuXG5cdFx0YXNzZXJ0Lm9rKGdsb2IucGF0dGVybnNFcXVhbHMoW3sgYmFzZTogJ2EnLCBwYXR0ZXJuOiAnKicgfSwgJ2InLCAnYyddLCBbeyBiYXNlOiAnYScsIHBhdHRlcm46ICcqJyB9LCAnYicsICdjJ10pKTtcblxuXHRcdGFzc2VydC5vayhnbG9iLnBhdHRlcm5zRXF1YWxzKHVuZGVmaW5lZCwgdW5kZWZpbmVkKSk7XG5cdFx0YXNzZXJ0Lm9rKCFnbG9iLnBhdHRlcm5zRXF1YWxzKHVuZGVmaW5lZCwgWydiJ10pKTtcblx0XHRhc3NlcnQub2soIWdsb2IucGF0dGVybnNFcXVhbHMoWydhJ10sIHVuZGVmaW5lZCkpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFlBQVksVUFBVTtBQUN0QixTQUFTLFdBQVc7QUFDcEIsU0FBUyxTQUFTLGFBQWEsaUJBQWlCO0FBQ2hELFNBQVMsV0FBVztBQUNwQixTQUFTLCtDQUErQztBQUV4RCxNQUFNLFFBQVEsTUFBTTtBQXNEbkIsV0FBUyxnQkFBZ0IsU0FBeUMsT0FBZTtBQUNoRixXQUFPLEtBQUssTUFBTSxTQUFTLEtBQUssR0FBRyxHQUFHLEtBQUssVUFBVSxPQUFPLENBQUMsaUJBQWlCLEtBQUssRUFBRTtBQUNyRixXQUFPLEtBQUssTUFBTSxTQUFTLFVBQVUsS0FBSyxDQUFDLEdBQUcsR0FBRyxPQUFPLGlCQUFpQixVQUFVLEtBQUssQ0FBQyxFQUFFO0FBQUEsRUFDNUY7QUFFQSxXQUFTLGtCQUFrQixTQUF5QyxPQUFlO0FBQ2xGLFdB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
