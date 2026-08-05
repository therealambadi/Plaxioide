import assert from "assert";
import { shuffle } from "../../common/arrays.js";
import { randomPath } from "../../common/extpath.js";
import { StopWatch } from "../../common/stopwatch.js";
import { ConfigKeysIterator, PathIterator, StringIterator, TernarySearchTree, UriIterator } from "../../common/ternarySearchTree.js";
import { URI } from "../../common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "./utils.js";
suite("Ternary Search Tree", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("PathIterator", () => {
    const iter = new PathIterator();
    iter.reset("file:///usr/bin/file.txt");
    assert.strictEqual(iter.value(), "file:");
    assert.strictEqual(iter.hasNext(), true);
    assert.strictEqual(iter.cmp("file:"), 0);
    assert.ok(iter.cmp("a") < 0);
    assert.ok(iter.cmp("aile:") < 0);
    assert.ok(iter.cmp("z") > 0);
    assert.ok(iter.cmp("zile:") > 0);
    iter.next();
    assert.strictEqual(iter.value(), "usr");
    assert.strictEqual(iter.hasNext(), true);
    iter.next();
    assert.strictEqual(iter.value(), "bin");
    assert.strictEqual(iter.hasNext(), true);
    iter.next();
    assert.strictEqual(iter.value(), "file.txt");
    assert.strictEqual(iter.hasNext(), false);
    iter.next();
    assert.strictEqual(iter.value(), "");
    assert.strictEqual(iter.hasNext(), false);
    iter.next();
    assert.strictEqual(iter.value(), "");
    assert.strictEqual(iter.hasNext(), false);
    iter.reset("/foo/bar/");
    assert.strictEqual(iter.value(), "foo");
    assert.strictEqual(iter.hasNext(), true);
    iter.next();
    assert.strictEqual(iter.value(), "bar");
    assert.strictEqual(iter.hasNext(), false);
  });
  test("URIIterator", function() {
    const iter = new UriIterator(() => false, () => false);
    iter.reset(URI.parse("file:///usr/bin/file.txt"));
    assert.strictEqual(iter.value(), "file");
    assert.strictEqual(iter.cmp("file"), 0);
    assert.strictEqual(iter.hasNext(), true);
    iter.next();
    assert.strictEqual(iter.value(), "usr");
    assert.strictEqual(iter.hasNext(), true);
    iter.next();
    assert.strictEqual(iter.value(), "bin");
    assert.strictEqual(iter.hasNext(), true);
    iter.next();
    assert.strictEqual(iter.value(), "file.txt");
    assert.strictEqual(iter.hasNext(), false);
    iter.reset(URI.parse("file://share/usr/bin/file.txt?foo"));
    assert.strictEqual(iter.value(), "file");
    assert.strictEqual(iter.cmp("file"), 0);
    assert.strictEqual(iter.hasNext(), true);
    iter.next();
    assert.strictEqual(iter.value(), "share");
    assert.strictEqual(iter.cmp("SHARe"), 0);
    assert.strictEqual(iter.hasNext(), true);
    iter.next();
    assert.strictEqual(iter.value(), "usr");
    assert.strictEqual(iter.hasNext(), true);
    iter.next();
    assert.strictEqual(iter.value(), "bin");
    assert.strictEqual(iter.hasNext(), true);
    iter.next();
    assert.strictEqual(iter.value(), "file.txt");
    assert.strictEqual(iter.hasNext(), true);
    iter.next();
    assert.strictEqual(iter.value(), "foo");
    assert.strictEqual(iter.cmp("z") > 0, true);
    assert.strictEqual(iter.cmp("a") < 0, true);
    assert.strictEqual(iter.hasNext(), false);
  });
  test("URIIterator - ignore query/fragment", function() {
    const iter = new UriIterator(() => false, () => true);
    iter.reset(URI.parse("file:///usr/bin/file.txt"));
    assert.strictEqual(iter.value(), "file");
    assert.strictEqual(iter.cmp("file"), 0);
    assert.strictEqual(iter.hasNext(), true);
    iter.next();
    assert.strictEqual(iter.value(), "usr");
    assert.strictEqual(iter.hasNext(), true);
    iter.next();
    assert.strictEqual(iter.value(), "bin");
    assert.strictEqual(iter.hasNext(), true);
    iter.next();
    assert.strictEqual(iter.value(), "file.txt");
    assert.strictEqual(iter.hasNext(), false);
    iter.reset(URI.parse("file://share/usr/bin/file.txt?foo"));
    assert.strictEqual(iter.value(), "file");
    assert.strictEqual(iter.cmp("file"), 0);
    assert.strictEqual(iter.hasNext(), true);
    iter.next();
    assert.strictEqual(iter.value(), "share");
    assert.strictEqual(iter.cmp("SHARe"), 0);
    assert.strictEqual(iter.hasNext(), true);
    iter.next();
    assert.strictEqual(iter.value(), "usr");
    assert.strictEqual(iter.hasNext(), true);
    iter.next();
    assert.strictEqual(iter.value(), "bin");
    assert.strictEqual(iter.hasNext(), true);
    iter.next();
    assert.strictEqual(iter.value(), "file.txt");
    assert.strictEqual(iter.hasNext(), false);
  });
  function assertTstDfs(trie, ...elements) {
    assert.ok(trie._isBalanced(), "TST is not balanced");
    let i = 0;
    for (const [key, value] of trie) {
      const expected = elements[i++];
      assert.ok(expected);
      assert.strictEqual(key, expected[0]);
      assert.strictEqual(value, expected[1]);
    }
    assert.strictEqual(i, elements.length);
    const map = /* @__PURE__ */ new Map();
    for (const [key, value] of elements) {
      map.set(key, value);
    }
    map.forEach((value, key) => {
      assert.strictEqual(trie.get(key), value);
    });
    let forEachCount = 0;
    trie.forEach((element, key) => {
      assert.strictEqual(element, map.get(key));
      forEachCount++;
    });
    assert.strictEqual(map.size, forEachCount);
    let iterCount = 0;
    for (const [key, value] of trie) {
      assert.strictEqual(value, map.get(key));
      iterCount++;
    }
    assert.strictEqual(map.size, iterCount);
  }
  test("TernarySearchTree - set", function() {
    let trie = TernarySearchTree.forStrings();
    trie.set("foobar", 1);
    trie.set("foobaz", 2);
    assertTstDfs(trie, ["foobar", 1], ["foobaz", 2]);
    trie = TernarySearchTree.forStrings();
    trie.set("foobar", 1);
    trie.set("fooba", 2);
    assertTstDfs(trie, ["fooba", 2], ["foobar", 1]);
    trie = TernarySearchTree.forStrings();
    trie.set("foo", 1);
    trie.set("foo", 2);
    assertTstDfs(trie, ["foo", 2]);
    trie = TernarySearchTree.forStrings();
    trie.set("foo", 1);
    trie.set("foobar", 2);
    trie.set("bar", 3);
    trie.set("foob", 4);
    trie.set("bazz", 5);
    assertTstDfs(
      trie,
      ["bar", 3],
      ["bazz", 5],
      ["foo", 1],
      ["foob", 4],
      ["foobar", 2]
    );
  });
  test("TernarySearchTree - set w/ undefined", function() {
    const trie = TernarySearchTree.forStrings();
    trie.set("foobar", void 0);
    trie.set("foobaz", 2);
    assert.strictEqual(trie.get("foobar"), void 0);
    assert.strictEqual(trie.get("foobaz"), 2);
    assert.strictEqual(trie.get("NOT HERE"), void 0);
    assert.ok(trie.has("foobaz"));
    assert.ok(trie.has("foobar"));
    assert.ok(!trie.has("NOT HERE"));
    assertTstDfs(trie, ["foobar", void 0], ["foobaz", 2]);
    const oldValue = trie.set("foobar", 3);
    assert.strictEqual(oldValue, void 0);
    assert.strictEqual(trie.get("foobar"), 3);
  });
  test("TernarySearchTree - findLongestMatch", function() {
    const trie = TernarySearchTree.forStrings();
    trie.set("foo", 1);
    trie.set("foobar", 2);
    trie.set("foobaz", 3);
    assertTstDfs(trie, ["foo", 1], ["foobar", 2], ["foobaz", 3]);
    assert.strictEqual(trie.findSubstr("f"), void 0);
    assert.strictEqual(trie.findSubstr("z"), void 0);
    assert.strictEqual(trie.findSubstr("foo"), 1);
    assert.strictEqual(trie.findSubstr("foo\xF6"), 1);
    assert.strictEqual(trie.findSubstr("fooba"), 1);
    assert.strictEqual(trie.findSubstr("foobarr"), 2);
    assert.strictEqual(trie.findSubstr("foobazrr"), 3);
  });
  test("TernarySearchTree - basics", function() {
    const trie = new TernarySearchTree(new StringIterator());
    trie.set("foo", 1);
    trie.set("bar", 2);
    trie.set("foobar", 3);
    assertTstDfs(trie, ["bar", 2], ["foo", 1], ["foobar", 3]);
    assert.strictEqual(trie.get("foo"), 1);
    assert.strictEqual(trie.get("bar"), 2);
    assert.strictEqual(trie.get("foobar"), 3);
    assert.strictEqual(trie.get("foobaz"), void 0);
    assert.strictEqual(trie.get("foobarr"), void 0);
    assert.strictEqual(trie.findSubstr("fo"), void 0);
    assert.strictEqual(trie.findSubstr("foo"), 1);
    assert.strictEqual(trie.findSubstr("foooo"), 1);
    trie.delete("foobar");
    trie.delete("bar");
    assert.strictEqual(trie.get("foobar"), void 0);
    assert.strictEqual(trie.get("bar"), void 0);
    trie.set("foobar", 17);
    trie.set("barr", 18);
    assert.strictEqual(trie.get("foobar"), 17);
    assert.strictEqual(trie.get("barr"), 18);
    assert.strictEqual(trie.get("bar"), void 0);
  });
  test("TernarySearchTree - delete & cleanup", function() {
    let trie = new TernarySearchTree(new StringIterator());
    trie.set("foo", 1);
    trie.set("foobar", 2);
    trie.set("bar", 3);
    assertTstDfs(trie, ["bar", 3], ["foo", 1], ["foobar", 2]);
    trie.delete("foo");
    assertTstDfs(trie, ["bar", 3], ["foobar", 2]);
    trie.delete("foobar");
    assertTstDfs(trie, ["bar", 3]);
    trie = new TernarySearchTree(new StringIterator());
    trie.set("foo", 1);
    trie.set("foobar", 2);
    trie.set("bar", 3);
    trie.set("foobarbaz", 4);
    trie.deleteSuperstr("foo");
    assertTstDfs(trie, ["bar", 3], ["foo", 1]);
    trie = new TernarySearchTree(new StringIterator());
    trie.set("foo", 1);
    trie.set("foobar", 2);
    trie.set("bar", 3);
    trie.set("foobarbaz", 4);
    trie.deleteSuperstr("fo");
    assertTstDfs(trie, ["bar", 3]);
  });
  test("TernarySearchTree (PathSegments) - basics", function() {
    const trie = new TernarySearchTree(new PathIterator());
    trie.set("/user/foo/bar", 1);
    trie.set("/user/foo", 2);
    trie.set("/user/foo/flip/flop", 3);
    assert.strictEqual(trie.get("/user/foo/bar"), 1);
    assert.strictEqual(trie.get("/user/foo"), 2);
    assert.strictEqual(trie.get("/user//foo"), 2);
    assert.strictEqual(trie.get("/user\\foo"), 2);
    assert.strictEqual(trie.get("/user/foo/flip/flop"), 3);
    assert.strictEqual(trie.findSubstr("/user/bar"), void 0);
    assert.strictEqual(trie.findSubstr("/user/foo"), 2);
    assert.strictEqual(trie.findSubstr("\\user\\foo"), 2);
    assert.strictEqual(trie.findSubstr("/user//foo"), 2);
    assert.strictEqual(trie.findSubstr("/user/foo/ba"), 2);
    assert.strictEqual(trie.findSubstr("/user/foo/far/boo"), 2);
    assert.strictEqual(trie.findSubstr("/user/foo/bar"), 1);
    assert.strictEqual(trie.findSubstr("/user/foo/bar/far/boo"), 1);
  });
  test("TernarySearchTree - (AVL) set", function() {
    {
      const trie = new TernarySearchTree(new PathIterator());
      trie.set("/fileA", 1);
      trie.set("/fileB", 2);
      trie.set("/fileC", 3);
      assertTstDfs(trie, ["/fileA", 1], ["/fileB", 2], ["/fileC", 3]);
    }
    {
      const trie = new TernarySearchTree(new PathIterator());
      trie.set("/foo/fileA", 1);
      trie.set("/foo/fileB", 2);
      trie.set("/foo/fileC", 3);
      assertTstDfs(trie, ["/foo/fileA", 1], ["/foo/fileB", 2], ["/foo/fileC", 3]);
    }
    {
      const trie = new TernarySearchTree(new PathIterator());
      trie.set("/fileC", 3);
      trie.set("/fileB", 2);
      trie.set("/fileA", 1);
      assertTstDfs(trie, ["/fileA", 1], ["/fileB", 2], ["/fileC", 3]);
    }
    {
      const trie = new TernarySearchTree(new PathIterator());
      trie.set("/mid/fileC", 3);
      trie.set("/mid/fileB", 2);
      trie.set("/mid/fileA", 1);
      assertTstDfs(trie, ["/mid/fileA", 1], ["/mid/fileB", 2], ["/mid/fileC", 3]);
    }
    {
      const trie = new TernarySearchTree(new PathIterator());
      trie.set("/fileD", 7);
      trie.set("/fileB", 2);
      trie.set("/fileG", 42);
      trie.set("/fileF", 24);
      trie.set("/fileZ", 73);
      trie.set("/fileE", 15);
      assertTstDfs(trie, ["/fileB", 2], ["/fileD", 7], ["/fileE", 15], ["/fileF", 24], ["/fileG", 42], ["/fileZ", 73]);
    }
    {
      const trie = new TernarySearchTree(new PathIterator());
      trie.set("/fileJ", 42);
      trie.set("/fileZ", 73);
      trie.set("/fileE", 15);
      trie.set("/fileB", 2);
      trie.set("/fileF", 7);
      trie.set("/fileG", 1);
      assertTstDfs(trie, ["/fileB", 2], ["/fileE", 15], ["/fileF", 7], ["/fileG", 1], ["/fileJ", 42], ["/fileZ", 73]);
    }
  });
  test("TernarySearchTree - (BST) delete", function() {
    const trie = new TernarySearchTree(new StringIterator());
    trie.set("d", 1);
    assertTstDfs(trie, ["d", 1]);
    trie.delete("d");
    assertTstDfs(trie);
    trie.clear();
    trie.set("d", 1);
    trie.set("b", 1);
    trie.set("f", 1);
    assertTstDfs(trie, ["b", 1], ["d", 1], ["f", 1]);
    trie.delete("d");
    assertTstDfs(trie, ["b", 1], ["f", 1]);
    trie.clear();
    trie.set("d", 1);
    trie.set("b", 1);
    trie.set("f", 1);
    trie.set("e", 1);
    assertTstDfs(trie, ["b", 1], ["d", 1], ["e", 1], ["f", 1]);
    trie.delete("f");
    assertTstDfs(trie, ["b", 1], ["d", 1], ["e", 1]);
  });
  test("TernarySearchTree - (AVL) delete", function() {
    const trie = new TernarySearchTree(new StringIterator());
    trie.clear();
    trie.set("d", 1);
    trie.set("b", 1);
    trie.set("f", 1);
    trie.set("e", 1);
    trie.set("z", 1);
    assertTstDfs(trie, ["b", 1], ["d", 1], ["e", 1], ["f", 1], ["z", 1]);
    trie.delete("b");
    assertTstDfs(trie, ["d", 1], ["e", 1], ["f", 1], ["z", 1]);
    trie.clear();
    trie.set("d", 1);
    trie.set("c", 1);
    trie.set("f", 1);
    trie.set("a", 1);
    trie.set("b", 1);
    assertTstDfs(trie, ["a", 1], ["b", 1], ["c", 1], ["d", 1], ["f", 1]);
    trie.delete("f");
    assertTstDfs(trie, ["a", 1], ["b", 1], ["c", 1], ["d", 1]);
    trie.clear();
    trie.set("a", 1);
    trie.set("ad", 1);
    trie.set("ab", 1);
    trie.set("af", 1);
    trie.set("ae", 1);
    trie.set("az", 1);
    assertTstDfs(trie, ["a", 1], ["ab", 1], ["ad", 1], ["ae", 1], ["af", 1], ["az", 1]);
    trie.delete("ab");
    assertTstDfs(trie, ["a", 1], ["ad", 1], ["ae", 1], ["af", 1], ["az", 1]);
    trie.delete("a");
    assertTstDfs(trie, ["ad", 1], ["ae", 1], ["af", 1], ["az", 1]);
  });
  test("TernarySearchTree: Cannot read property '1' of undefined #138284", function() {
    const keys = [
      URI.parse("fake-fs:/C"),
      URI.parse("fake-fs:/A"),
      URI.parse("fake-fs:/D"),
      URI.parse("fake-fs:/B")
    ];
    const tst = TernarySearchTree.forUris();
    for (const item of keys) {
      tst.set(item, true);
    }
    assert.ok(tst._isBalanced());
    tst.delete(keys[0]);
    assert.ok(tst._isBalanced());
  });
  test("TernarySearchTree: Cannot read property '1' of undefined #138284 (simple)", function() {
    const keys = ["C", "A", "D", "B"];
    const tst = TernarySearchTree.forStrings();
    for (const item of keys) {
      tst.set(item, true);
    }
    assertTstDfs(tst, ["A", true], ["B", true], ["C", true], ["D", true]);
    tst.delete(keys[0]);
    assertTstDfs(tst, ["A", true], ["B", true], ["D", true]);
    {
      const tst2 = TernarySearchTree.forStrings();
      tst2.set("C", true);
      tst2.set("A", true);
      tst2.set("B", true);
      assertTstDfs(tst2, ["A", true], ["B", true], ["C", true]);
    }
  });
  test("TernarySearchTree: Cannot read property '1' of undefined #138284 (random)", function() {
    for (let round = 10; round >= 0; round--) {
      const keys = [];
      for (let i = 0; i < 100; i++) {
        keys.push(URI.from({ scheme: "fake-fs", path: randomPath(void 0, void 0, 10) }));
      }
      const tst = TernarySearchTree.forUris();
      try {
        for (const item of keys) {
          tst.set(item, true);
          assert.ok(tst._isBalanced(), `SET${item}|${keys.map(String).join()}`);
        }
        for (const item of keys) {
          tst.delete(item);
          assert.ok(tst._isBalanced(), `DEL${item}|${keys.map(String).join()}`);
        }
      } catch (err) {
        assert.ok(false, `FAILED with keys: ${keys.map(String).join()}`);
      }
    }
  });
  test("TernarySearchTree: Cannot read properties of undefined (reading 'length'): #161618 (simple)", function() {
    const raw = "config.debug.toolBarLocation,floating,config.editor.renderControlCharacters,true,config.editor.renderWhitespace,selection,config.files.autoSave,off,config.git.enabled,true,config.notebook.globalToolbar,true,config.terminal.integrated.tabs.enabled,true,config.terminal.integrated.tabs.showActions,singleTerminalOrNarrow,config.terminal.integrated.tabs.showActiveTerminal,singleTerminalOrNarrow,config.workbench.activityBar.visible,true,config.workbench.experimental.settingsProfiles.enabled,true,config.workbench.layoutControl.type,both,config.workbench.sideBar.location,left,config.workbench.statusBar.visible,true";
    const array = raw.split(",");
    const tuples = [];
    for (let i = 0; i < array.length; i += 2) {
      tuples.push([array[i], array[i + 1]]);
    }
    const map = TernarySearchTree.forConfigKeys();
    map.fill(tuples);
    assert.strictEqual([...map].join(), raw);
    assert.ok(map.has("config.editor.renderWhitespace"));
    const len = [...map].length;
    map.delete("config.editor.renderWhitespace");
    assert.ok(map._isBalanced());
    assert.strictEqual([...map].length, len - 1);
  });
  test("TernarySearchTree: Cannot read properties of undefined (reading 'length'): #161618 (random)", function() {
    const raw = "config.debug.toolBarLocation,floating,config.editor.renderControlCharacters,true,config.editor.renderWhitespace,selection,config.files.autoSave,off,config.git.enabled,true,config.notebook.globalToolbar,true,config.terminal.integrated.tabs.enabled,true,config.terminal.integrated.tabs.showActions,singleTerminalOrNarrow,config.terminal.integrated.tabs.showActiveTerminal,singleTerminalOrNarrow,config.workbench.activityBar.visible,true,config.workbench.experimental.settingsProfiles.enabled,true,config.workbench.layoutControl.type,both,config.workbench.sideBar.location,left,config.workbench.statusBar.visible,true";
    const array = raw.split(",");
    const tuples = [];
    for (let i = 0; i < array.length; i += 2) {
      tuples.push([array[i], array[i + 1]]);
    }
    for (let round = 100; round >= 0; round--) {
      shuffle(tuples);
      const map = TernarySearchTree.forConfigKeys();
      map.fill(tuples);
      assert.strictEqual([...map].join(), raw);
      assert.ok(map.has("config.editor.renderWhitespace"));
      const len = [...map].length;
      map.delete("config.editor.renderWhitespace");
      assert.ok(map._isBalanced());
      assert.strictEqual([...map].length, len - 1);
    }
  });
  test("TernarySearchTree (PathSegments) - lookup", function() {
    const map = new TernarySearchTree(new PathIterator());
    map.set("/user/foo/bar", 1);
    map.set("/user/foo", 2);
    map.set("/user/foo/flip/flop", 3);
    assert.strictEqual(map.get("/foo"), void 0);
    assert.strictEqual(map.get("/user"), void 0);
    assert.strictEqual(map.get("/user/foo"), 2);
    assert.strictEqual(map.get("/user/foo/bar"), 1);
    assert.strictEqual(map.get("/user/foo/bar/boo"), void 0);
  });
  test("TernarySearchTree (PathSegments) - superstr", function() {
    const map = new TernarySearchTree(new PathIterator());
    map.set("/user/foo/bar", 1);
    map.set("/user/foo", 2);
    map.set("/user/foo/flip/flop", 3);
    map.set("/usr/foo", 4);
    let item;
    let iter = map.findSuperstr("/user");
    item = iter.next();
    assert.strictEqual(item.value[1], 2);
    assert.strictEqual(item.done, false);
    item = iter.next();
    assert.strictEqual(item.value[1], 1);
    assert.strictEqual(item.done, false);
    item = iter.next();
    assert.strictEqual(item.value[1], 3);
    assert.strictEqual(item.done, false);
    item = iter.next();
    assert.strictEqual(item.value, void 0);
    assert.strictEqual(item.done, true);
    iter = map.findSuperstr("/usr");
    item = iter.next();
    assert.strictEqual(item.value[1], 4);
    assert.strictEqual(item.done, false);
    item = iter.next();
    assert.strictEqual(item.value, void 0);
    assert.strictEqual(item.done, true);
    assert.strictEqual(map.findSuperstr("/not"), void 0);
    assert.strictEqual(map.findSuperstr("/us"), void 0);
    assert.strictEqual(map.findSuperstr("/usrr"), void 0);
    assert.strictEqual(map.findSuperstr("/userr"), void 0);
  });
  test("TernarySearchTree (PathSegments) - delete_superstr", function() {
    const map = new TernarySearchTree(new PathIterator());
    map.set("/user/foo/bar", 1);
    map.set("/user/foo", 2);
    map.set("/user/foo/flip/flop", 3);
    map.set("/usr/foo", 4);
    assertTstDfs(
      map,
      ["/user/foo", 2],
      ["/user/foo/bar", 1],
      ["/user/foo/flip/flop", 3],
      ["/usr/foo", 4]
    );
    map.deleteSuperstr("/user/fo");
    assertTstDfs(
      map,
      ["/user/foo", 2],
      ["/user/foo/bar", 1],
      ["/user/foo/flip/flop", 3],
      ["/usr/foo", 4]
    );
    map.set("/user/foo/bar", 1);
    map.set("/user/foo", 2);
    map.set("/user/foo/flip/flop", 3);
    map.set("/usr/foo", 4);
    map.deleteSuperstr("/user/foo");
    assertTstDfs(
      map,
      ["/user/foo", 2],
      ["/usr/foo", 4]
    );
  });
  test("TernarySearchTree (URI) - basics", function() {
    const trie = new TernarySearchTree(new UriIterator(() => false, () => false));
    trie.set(URI.file("/user/foo/bar"), 1);
    trie.set(URI.file("/user/foo"), 2);
    trie.set(URI.file("/user/foo/flip/flop"), 3);
    assert.strictEqual(trie.get(URI.file("/user/foo/bar")), 1);
    assert.strictEqual(trie.get(URI.file("/user/foo")), 2);
    assert.strictEqual(trie.get(URI.file("/user/foo/flip/flop")), 3);
    assert.strictEqual(trie.findSubstr(URI.file("/user/bar")), void 0);
    assert.strictEqual(trie.findSubstr(URI.file("/user/foo")), 2);
    assert.strictEqual(trie.findSubstr(URI.file("/user/foo/ba")), 2);
    assert.strictEqual(trie.findSubstr(URI.file("/user/foo/far/boo")), 2);
    assert.strictEqual(trie.findSubstr(URI.file("/user/foo/bar")), 1);
    assert.strictEqual(trie.findSubstr(URI.file("/user/foo/bar/far/boo")), 1);
  });
  test("TernarySearchTree (URI) - query parameters", function() {
    const trie = new TernarySearchTree(new UriIterator(() => false, () => true));
    const root = URI.parse("memfs:/?param=1");
    trie.set(root, 1);
    assert.strictEqual(trie.get(URI.parse("memfs:/?param=1")), 1);
    assert.strictEqual(trie.findSubstr(URI.parse("memfs:/?param=1")), 1);
    assert.strictEqual(trie.findSubstr(URI.parse("memfs:/aaa?param=1")), 1);
  });
  test("TernarySearchTree (URI) - lookup", function() {
    const map = new TernarySearchTree(new UriIterator(() => false, () => false));
    map.set(URI.parse("http://foo.bar/user/foo/bar"), 1);
    map.set(URI.parse("http://foo.bar/user/foo?query"), 2);
    map.set(URI.parse("http://foo.bar/user/foo?QUERY"), 3);
    map.set(URI.parse("http://foo.bar/user/foo/flip/flop"), 3);
    assert.strictEqual(map.get(URI.parse("http://foo.bar/foo")), void 0);
    assert.strictEqual(map.get(URI.parse("http://foo.bar/user")), void 0);
    assert.strictEqual(map.get(URI.parse("http://foo.bar/user/foo/bar")), 1);
    assert.strictEqual(map.get(URI.parse("http://foo.bar/user/foo?query")), 2);
    assert.strictEqual(map.get(URI.parse("http://foo.bar/user/foo?Query")), void 0);
    assert.strictEqual(map.get(URI.parse("http://foo.bar/user/foo?QUERY")), 3);
    assert.strictEqual(map.get(URI.parse("http://foo.bar/user/foo/bar/boo")), void 0);
  });
  test("TernarySearchTree (URI) - lookup, casing", function() {
    const map = new TernarySearchTree(new UriIterator((uri) => /^https?$/.test(uri.scheme), () => false));
    map.set(URI.parse("http://foo.bar/user/foo/bar"), 1);
    assert.strictEqual(map.get(URI.parse("http://foo.bar/USER/foo/bar")), 1);
    map.set(URI.parse("foo://foo.bar/user/foo/bar"), 1);
    assert.strictEqual(map.get(URI.parse("foo://foo.bar/USER/foo/bar")), void 0);
  });
  test("TernarySearchTree (URI) - superstr", function() {
    const map = new TernarySearchTree(new UriIterator(() => false, () => false));
    map.set(URI.file("/user/foo/bar"), 1);
    map.set(URI.file("/user/foo"), 2);
    map.set(URI.file("/user/foo/flip/flop"), 3);
    map.set(URI.file("/usr/foo"), 4);
    let item;
    let iter = map.findSuperstr(URI.file("/user"));
    item = iter.next();
    assert.strictEqual(item.value[1], 2);
    assert.strictEqual(item.done, false);
    item = iter.next();
    assert.strictEqual(item.value[1], 1);
    assert.strictEqual(item.done, false);
    item = iter.next();
    assert.strictEqual(item.value[1], 3);
    assert.strictEqual(item.done, false);
    item = iter.next();
    assert.strictEqual(item.value, void 0);
    assert.strictEqual(item.done, true);
    iter = map.findSuperstr(URI.file("/usr"));
    item = iter.next();
    assert.strictEqual(item.value[1], 4);
    assert.strictEqual(item.done, false);
    item = iter.next();
    assert.strictEqual(item.value, void 0);
    assert.strictEqual(item.done, true);
    iter = map.findSuperstr(URI.file("/"));
    item = iter.next();
    assert.strictEqual(item.value[1], 2);
    assert.strictEqual(item.done, false);
    item = iter.next();
    assert.strictEqual(item.value[1], 1);
    assert.strictEqual(item.done, false);
    item = iter.next();
    assert.strictEqual(item.value[1], 3);
    assert.strictEqual(item.done, false);
    item = iter.next();
    assert.strictEqual(item.value[1], 4);
    assert.strictEqual(item.done, false);
    item = iter.next();
    assert.strictEqual(item.value, void 0);
    assert.strictEqual(item.done, true);
    assert.strictEqual(map.findSuperstr(URI.file("/not")), void 0);
    assert.strictEqual(map.findSuperstr(URI.file("/us")), void 0);
    assert.strictEqual(map.findSuperstr(URI.file("/usrr")), void 0);
    assert.strictEqual(map.findSuperstr(URI.file("/userr")), void 0);
  });
  test("TernarySearchTree (ConfigKeySegments) - basics", function() {
    const trie = new TernarySearchTree(new ConfigKeysIterator());
    trie.set("config.foo.bar", 1);
    trie.set("config.foo", 2);
    trie.set("config.foo.flip.flop", 3);
    assert.strictEqual(trie.get("config.foo.bar"), 1);
    assert.strictEqual(trie.get("config.foo"), 2);
    assert.strictEqual(trie.get("config.foo.flip.flop"), 3);
    assert.strictEqual(trie.findSubstr("config.bar"), void 0);
    assert.strictEqual(trie.findSubstr("config.foo"), 2);
    assert.strictEqual(trie.findSubstr("config.foo.ba"), 2);
    assert.strictEqual(trie.findSubstr("config.foo.far.boo"), 2);
    assert.strictEqual(trie.findSubstr("config.foo.bar"), 1);
    assert.strictEqual(trie.findSubstr("config.foo.bar.far.boo"), 1);
  });
  test("TernarySearchTree (ConfigKeySegments) - lookup", function() {
    const map = new TernarySearchTree(new ConfigKeysIterator());
    map.set("config.foo.bar", 1);
    map.set("config.foo", 2);
    map.set("config.foo.flip.flop", 3);
    assert.strictEqual(map.get("foo"), void 0);
    assert.strictEqual(map.get("config"), void 0);
    assert.strictEqual(map.get("config.foo"), 2);
    assert.strictEqual(map.get("config.foo.bar"), 1);
    assert.strictEqual(map.get("config.foo.bar.boo"), void 0);
  });
  test("TernarySearchTree (ConfigKeySegments) - superstr", function() {
    const map = new TernarySearchTree(new ConfigKeysIterator());
    map.set("config.foo.bar", 1);
    map.set("config.foo", 2);
    map.set("config.foo.flip.flop", 3);
    map.set("boo", 4);
    let item;
    const iter = map.findSuperstr("config");
    item = iter.next();
    assert.strictEqual(item.value[1], 2);
    assert.strictEqual(item.done, false);
    item = iter.next();
    assert.strictEqual(item.value[1], 1);
    assert.strictEqual(item.done, false);
    item = iter.next();
    assert.strictEqual(item.value[1], 3);
    assert.strictEqual(item.done, false);
    item = iter.next();
    assert.strictEqual(item.value, void 0);
    assert.strictEqual(item.done, true);
    assert.strictEqual(map.findSuperstr("foo"), void 0);
    assert.strictEqual(map.findSuperstr("config.foo.no"), void 0);
    assert.strictEqual(map.findSuperstr("config.foop"), void 0);
  });
  test("TernarySearchTree (ConfigKeySegments) - delete_superstr", function() {
    const map = new TernarySearchTree(new ConfigKeysIterator());
    map.set("config.foo.bar", 1);
    map.set("config.foo", 2);
    map.set("config.foo.flip.flop", 3);
    map.set("boo", 4);
    assertTstDfs(
      map,
      ["boo", 4],
      ["config.foo", 2],
      ["config.foo.bar", 1],
      ["config.foo.flip.flop", 3]
    );
    map.deleteSuperstr("config.fo");
    assertTstDfs(
      map,
      ["boo", 4],
      ["config.foo", 2],
      ["config.foo.bar", 1],
      ["config.foo.flip.flop", 3]
    );
    map.set("config.foo.bar", 1);
    map.set("config.foo", 2);
    map.set("config.foo.flip.flop", 3);
    map.set("config.boo", 4);
    map.deleteSuperstr("config.foo");
    assertTstDfs(
      map,
      ["boo", 4],
      ["config.foo", 2]
    );
  });
  test("TST, fill", function() {
    const tst = TernarySearchTree.forStrings();
    const keys = ["foo", "bar", "bang", "bazz"];
    Object.freeze(keys);
    tst.fill(true, keys);
    for (const key of keys) {
      assert.ok(tst.get(key), key);
    }
  });
});
suite.skip("TST, perf", function() {
  function createRandomUris(n) {
    const uris = [];
    function randomWord() {
      let result = "";
      const length = 4 + Math.floor(Math.random() * 4);
      for (let i = 0; i < length; i++) {
        result += (Math.random() * 26 + 65).toString(36);
      }
      return result;
    }
    const words = [];
    for (let i = 0; i < 1e4; i++) {
      words.push(randomWord());
    }
    for (let i = 0; i < n; i++) {
      let len = 4 + Math.floor(Math.random() * 4);
      const segments = [];
      for (; len >= 0; len--) {
        segments.push(words[Math.floor(Math.random() * words.length)]);
      }
      uris.push(URI.from({ scheme: "file", path: segments.join("/") }));
    }
    return uris;
  }
  let tree;
  let sampleUris = [];
  let candidates = [];
  suiteSetup(() => {
    const len = 5e4;
    sampleUris = createRandomUris(len);
    candidates = [...sampleUris.slice(0, len / 2), ...createRandomUris(len / 2)];
    shuffle(candidates);
  });
  setup(() => {
    tree = TernarySearchTree.forUris();
    for (const uri of sampleUris) {
      tree.set(uri, true);
    }
  });
  const _profile = false;
  function perfTest(name, callback) {
    test(name, function() {
      if (_profile) {
        console.profile(name);
      }
      const sw = new StopWatch();
      callback();
      console.log(name, sw.elapsed());
      if (_profile) {
        console.profileEnd();
      }
    });
  }
  perfTest("TST, clear", function() {
    tree.clear();
  });
  perfTest("TST, insert", function() {
    const insertTree = TernarySearchTree.forUris();
    for (const uri of sampleUris) {
      insertTree.set(uri, true);
    }
  });
  perfTest("TST, lookup", function() {
    let match = 0;
    for (const candidate of candidates) {
      if (tree.has(candidate)) {
        match += 1;
      }
    }
    assert.strictEqual(match, sampleUris.length / 2);
  });
  perfTest("TST, substr", function() {
    let match = 0;
    for (const candidate of candidates) {
      if (tree.findSubstr(candidate)) {
        match += 1;
      }
    }
    assert.strictEqual(match, sampleUris.length / 2);
  });
  perfTest("TST, superstr", function() {
    for (const candidate of candidates) {
      tree.findSuperstr(candidate);
    }
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvY29tbW9uL3Rlcm5hcnlTZWFyY2h0cmVlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBzaHVmZmxlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyByYW5kb21QYXRoIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dHBhdGguanMnO1xuaW1wb3J0IHsgU3RvcFdhdGNoIH0gZnJvbSAnLi4vLi4vY29tbW9uL3N0b3B3YXRjaC5qcyc7XG5pbXBvcnQgeyBDb25maWdLZXlzSXRlcmF0b3IsIFBhdGhJdGVyYXRvciwgU3RyaW5nSXRlcmF0b3IsIFRlcm5hcnlTZWFyY2hUcmVlLCBVcmlJdGVyYXRvciB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXJuYXJ5U2VhcmNoVHJlZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4vdXRpbHMuanMnO1xuXG5zdWl0ZSgnVGVybmFyeSBTZWFyY2ggVHJlZScsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdQYXRoSXRlcmF0b3InLCAoKSA9PiB7XG5cdFx0Y29uc3QgaXRlciA9IG5ldyBQYXRoSXRlcmF0b3IoKTtcblx0XHRpdGVyLnJlc2V0KCdmaWxlOi8vL3Vzci9iaW4vZmlsZS50eHQnKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLnZhbHVlKCksICdmaWxlOicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLmhhc05leHQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZXIuY21wKCdmaWxlOicpLCAwKTtcblx0XHRhc3NlcnQub2soaXRlci5jbXAoJ2EnKSA8IDApO1xuXHRcdGFzc2VydC5vayhpdGVyLmNtcCgnYWlsZTonKSA8IDApO1xuXHRcdGFzc2VydC5vayhpdGVyLmNtcCgneicpID4gMCk7XG5cdFx0YXNzZXJ0Lm9rKGl0ZXIuY21wKCd6aWxlOicpID4gMCk7XG5cblx0XHRpdGVyLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci52YWx1ZSgpLCAndXNyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZXIuaGFzTmV4dCgpLCB0cnVlKTtcblxuXHRcdGl0ZXIubmV4dCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLnZhbHVlKCksICdiaW4nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci5oYXNOZXh0KCksIHRydWUpO1xuXG5cdFx0aXRlci5uZXh0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZXIudmFsdWUoKSwgJ2ZpbGUudHh0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZXIuaGFzTmV4dCgpLCBmYWxzZSk7XG5cblx0XHRpdGVyLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci52YWx1ZSgpLCAnJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZXIuaGFzTmV4dCgpLCBmYWxzZSk7XG5cdFx0aXRlci5uZXh0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZXIudmFsdWUoKSwgJycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLmhhc05leHQoKSwgZmFsc2UpO1xuXG5cdFx0Ly9cblx0XHRpdGVyLnJlc2V0KCcvZm9vL2Jhci8nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci52YWx1ZSgpLCAnZm9vJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZXIuaGFzTmV4dCgpLCB0cnVlKTtcblxuXHRcdGl0ZXIubmV4dCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLnZhbHVlKCksICdiYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci5oYXNOZXh0KCksIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnVVJJSXRlcmF0b3InLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaXRlciA9IG5ldyBVcmlJdGVyYXRvcigoKSA9PiBmYWxzZSwgKCkgPT4gZmFsc2UpO1xuXHRcdGl0ZXIucmVzZXQoVVJJLnBhcnNlKCdmaWxlOi8vL3Vzci9iaW4vZmlsZS50eHQnKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci52YWx1ZSgpLCAnZmlsZScpO1xuXHRcdC8vIGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLmNtcCgnRklMRScpLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci5jbXAoJ2ZpbGUnKSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZXIuaGFzTmV4dCgpLCB0cnVlKTtcblx0XHRpdGVyLm5leHQoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLnZhbHVlKCksICd1c3InKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci5oYXNOZXh0KCksIHRydWUpO1xuXHRcdGl0ZXIubmV4dCgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZXIudmFsdWUoKSwgJ2JpbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLmhhc05leHQoKSwgdHJ1ZSk7XG5cdFx0aXRlci5uZXh0KCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci52YWx1ZSgpLCAnZmlsZS50eHQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci5oYXNOZXh0KCksIGZhbHNlKTtcblxuXG5cdFx0aXRlci5yZXNldChVUkkucGFyc2UoJ2ZpbGU6Ly9zaGFyZS91c3IvYmluL2ZpbGUudHh0P2ZvbycpKTtcblxuXHRcdC8vIHNjaGVtZVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLnZhbHVlKCksICdmaWxlJyk7XG5cdFx0Ly8gYXNzZXJ0LnN0cmljdEVxdWFsKGl0ZXIuY21wKCdGSUxFJyksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLmNtcCgnZmlsZScpLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci5oYXNOZXh0KCksIHRydWUpO1xuXHRcdGl0ZXIubmV4dCgpO1xuXG5cdFx0Ly8gYXV0aG9yaXR5XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZXIudmFsdWUoKSwgJ3NoYXJlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZXIuY21wKCdTSEFSZScpLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci5oYXNOZXh0KCksIHRydWUpO1xuXHRcdGl0ZXIubmV4dCgpO1xuXG5cdFx0Ly8gcGF0aFxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLnZhbHVlKCksICd1c3InKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci5oYXNOZXh0KCksIHRydWUpO1xuXHRcdGl0ZXIubmV4dCgpO1xuXG5cdFx0Ly8gcGF0aFxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLnZhbHVlKCksICdiaW4nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci5oYXNOZXh0KCksIHRydWUpO1xuXHRcdGl0ZXIubmV4dCgpO1xuXG5cdFx0Ly8gcGF0aFxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLnZhbHVlKCksICdmaWxlLnR4dCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLmhhc05leHQoKSwgdHJ1ZSk7XG5cdFx0aXRlci5uZXh0KCk7XG5cblx0XHQvLyBxdWVyeVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLnZhbHVlKCksICdmb28nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci5jbXAoJ3onKSA+IDAsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLmNtcCgnYScpIDwgMCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZXIuaGFzTmV4dCgpLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1VSSUl0ZXJhdG9yIC0gaWdub3JlIHF1ZXJ5L2ZyYWdtZW50JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGl0ZXIgPSBuZXcgVXJpSXRlcmF0b3IoKCkgPT4gZmFsc2UsICgpID0+IHRydWUpO1xuXHRcdGl0ZXIucmVzZXQoVVJJLnBhcnNlKCdmaWxlOi8vL3Vzci9iaW4vZmlsZS50eHQnKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci52YWx1ZSgpLCAnZmlsZScpO1xuXHRcdC8vIGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLmNtcCgnRklMRScpLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci5jbXAoJ2ZpbGUnKSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZXIuaGFzTmV4dCgpLCB0cnVlKTtcblx0XHRpdGVyLm5leHQoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLnZhbHVlKCksICd1c3InKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci5oYXNOZXh0KCksIHRydWUpO1xuXHRcdGl0ZXIubmV4dCgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZXIudmFsdWUoKSwgJ2JpbicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLmhhc05leHQoKSwgdHJ1ZSk7XG5cdFx0aXRlci5uZXh0KCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci52YWx1ZSgpLCAnZmlsZS50eHQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci5oYXNOZXh0KCksIGZhbHNlKTtcblxuXG5cdFx0aXRlci5yZXNldChVUkkucGFyc2UoJ2ZpbGU6Ly9zaGFyZS91c3IvYmluL2ZpbGUudHh0P2ZvbycpKTtcblxuXHRcdC8vIHNjaGVtZVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLnZhbHVlKCksICdmaWxlJyk7XG5cdFx0Ly8gYXNzZXJ0LnN0cmljdEVxdWFsKGl0ZXIuY21wKCdGSUxFJyksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLmNtcCgnZmlsZScpLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci5oYXNOZXh0KCksIHRydWUpO1xuXHRcdGl0ZXIubmV4dCgpO1xuXG5cdFx0Ly8gYXV0aG9yaXR5XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZXIudmFsdWUoKSwgJ3NoYXJlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZXIuY21wKCdTSEFSZScpLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci5oYXNOZXh0KCksIHRydWUpO1xuXHRcdGl0ZXIubmV4dCgpO1xuXG5cdFx0Ly8gcGF0aFxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLnZhbHVlKCksICd1c3InKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci5oYXNOZXh0KCksIHRydWUpO1xuXHRcdGl0ZXIubmV4dCgpO1xuXG5cdFx0Ly8gcGF0aFxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLnZhbHVlKCksICdiaW4nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlci5oYXNOZXh0KCksIHRydWUpO1xuXHRcdGl0ZXIubmV4dCgpO1xuXG5cdFx0Ly8gcGF0aFxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLnZhbHVlKCksICdmaWxlLnR4dCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVyLmhhc05leHQoKSwgZmFsc2UpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBhc3NlcnRUc3REZnM8RT4odHJpZTogVGVybmFyeVNlYXJjaFRyZWU8c3RyaW5nLCBFPiwgLi4uZWxlbWVudHM6IFtzdHJpbmcsIEVdW10pIHtcblxuXHRcdGFzc2VydC5vayh0cmllLl9pc0JhbGFuY2VkKCksICdUU1QgaXMgbm90IGJhbGFuY2VkJyk7XG5cblx0XHRsZXQgaSA9IDA7XG5cdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgdHJpZSkge1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWQgPSBlbGVtZW50c1tpKytdO1xuXHRcdFx0YXNzZXJ0Lm9rKGV4cGVjdGVkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChrZXksIGV4cGVjdGVkWzBdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZSwgZXhwZWN0ZWRbMV0pO1xuXHRcdH1cblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpLCBlbGVtZW50cy5sZW5ndGgpO1xuXG5cdFx0Y29uc3QgbWFwID0gbmV3IE1hcDxzdHJpbmcsIEU+KCk7XG5cdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgZWxlbWVudHMpIHtcblx0XHRcdG1hcC5zZXQoa2V5LCB2YWx1ZSk7XG5cdFx0fVxuXHRcdG1hcC5mb3JFYWNoKCh2YWx1ZSwga2V5KSA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5nZXQoa2V5KSwgdmFsdWUpO1xuXHRcdH0pO1xuXG5cdFx0Ly8gZm9yRWFjaFxuXHRcdGxldCBmb3JFYWNoQ291bnQgPSAwO1xuXHRcdHRyaWUuZm9yRWFjaCgoZWxlbWVudCwga2V5KSA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWxlbWVudCwgbWFwLmdldChrZXkpKTtcblx0XHRcdGZvckVhY2hDb3VudCsrO1xuXHRcdH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXAuc2l6ZSwgZm9yRWFjaENvdW50KTtcblxuXHRcdC8vIGl0ZXJhdG9yXG5cdFx0bGV0IGl0ZXJDb3VudCA9IDA7XG5cdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgdHJpZSkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLCBtYXAuZ2V0KGtleSkpO1xuXHRcdFx0aXRlckNvdW50Kys7XG5cdFx0fVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXAuc2l6ZSwgaXRlckNvdW50KTtcblxuXHR9XG5cblx0dGVzdCgnVGVybmFyeVNlYXJjaFRyZWUgLSBzZXQnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRsZXQgdHJpZSA9IFRlcm5hcnlTZWFyY2hUcmVlLmZvclN0cmluZ3M8bnVtYmVyPigpO1xuXHRcdHRyaWUuc2V0KCdmb29iYXInLCAxKTtcblx0XHR0cmllLnNldCgnZm9vYmF6JywgMik7XG5cblx0XHRhc3NlcnRUc3REZnModHJpZSwgWydmb29iYXInLCAxXSwgWydmb29iYXonLCAyXSk7IC8vIGxvbmdlclxuXG5cdFx0dHJpZSA9IFRlcm5hcnlTZWFyY2hUcmVlLmZvclN0cmluZ3M8bnVtYmVyPigpO1xuXHRcdHRyaWUuc2V0KCdmb29iYXInLCAxKTtcblx0XHR0cmllLnNldCgnZm9vYmEnLCAyKTtcblx0XHRhc3NlcnRUc3REZnModHJpZSwgWydmb29iYScsIDJdLCBbJ2Zvb2JhcicsIDFdKTsgLy8gc2hvcnRlclxuXG5cdFx0dHJpZSA9IFRlcm5hcnlTZWFyY2hUcmVlLmZvclN0cmluZ3M8bnVtYmVyPigpO1xuXHRcdHRyaWUuc2V0KCdmb28nLCAxKTtcblx0XHR0cmllLnNldCgnZm9vJywgMik7XG5cdFx0YXNzZXJ0VHN0RGZzKHRyaWUsIFsnZm9vJywgMl0pO1xuXG5cdFx0dHJpZSA9IFRlcm5hcnlTZWFyY2hUcmVlLmZvclN0cmluZ3M8bnVtYmVyPigpO1xuXHRcdHRyaWUuc2V0KCdmb28nLCAxKTtcblx0XHR0cmllLnNldCgnZm9vYmFyJywgMik7XG5cdFx0dHJpZS5zZXQoJ2JhcicsIDMpO1xuXHRcdHRyaWUuc2V0KCdmb29iJywgNCk7XG5cdFx0dHJpZS5zZXQoJ2JhenonLCA1KTtcblxuXHRcdGFzc2VydFRzdERmcyh0cmllLFxuXHRcdFx0WydiYXInLCAzXSxcblx0XHRcdFsnYmF6eicsIDVdLFxuXHRcdFx0Wydmb28nLCAxXSxcblx0XHRcdFsnZm9vYicsIDRdLFxuXHRcdFx0Wydmb29iYXInLCAyXSxcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXJuYXJ5U2VhcmNoVHJlZSAtIHNldCB3LyB1bmRlZmluZWQnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCB0cmllID0gVGVybmFyeVNlYXJjaFRyZWUuZm9yU3RyaW5nczxhbnk+KCk7XG5cdFx0dHJpZS5zZXQoJ2Zvb2JhcicsIHVuZGVmaW5lZCk7XG5cdFx0dHJpZS5zZXQoJ2Zvb2JheicsIDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyaWUuZ2V0KCdmb29iYXInKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5nZXQoJ2Zvb2JheicpLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5nZXQoJ05PVCBIRVJFJyksIHVuZGVmaW5lZCk7XG5cblx0XHRhc3NlcnQub2sodHJpZS5oYXMoJ2Zvb2JheicpKTtcblx0XHRhc3NlcnQub2sodHJpZS5oYXMoJ2Zvb2JhcicpKTtcblx0XHRhc3NlcnQub2soIXRyaWUuaGFzKCdOT1QgSEVSRScpKTtcblxuXHRcdGFzc2VydFRzdERmcyh0cmllLCBbJ2Zvb2JhcicsIHVuZGVmaW5lZF0sIFsnZm9vYmF6JywgMl0pOyAvLyBzaG91bGQgY2hlY2sgZm9yIHVuZGVmaW5lZCB2YWx1ZVxuXG5cdFx0Y29uc3Qgb2xkVmFsdWUgPSB0cmllLnNldCgnZm9vYmFyJywgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9sZFZhbHVlLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmdldCgnZm9vYmFyJyksIDMpO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXJuYXJ5U2VhcmNoVHJlZSAtIGZpbmRMb25nZXN0TWF0Y2gnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCB0cmllID0gVGVybmFyeVNlYXJjaFRyZWUuZm9yU3RyaW5nczxudW1iZXI+KCk7XG5cdFx0dHJpZS5zZXQoJ2ZvbycsIDEpO1xuXHRcdHRyaWUuc2V0KCdmb29iYXInLCAyKTtcblx0XHR0cmllLnNldCgnZm9vYmF6JywgMyk7XG5cdFx0YXNzZXJ0VHN0RGZzKHRyaWUsIFsnZm9vJywgMV0sIFsnZm9vYmFyJywgMl0sIFsnZm9vYmF6JywgM10pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyaWUuZmluZFN1YnN0cignZicpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmZpbmRTdWJzdHIoJ3onKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5maW5kU3Vic3RyKCdmb28nKSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyaWUuZmluZFN1YnN0cignZm9vXHUwMEY2JyksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmZpbmRTdWJzdHIoJ2Zvb2JhJyksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmZpbmRTdWJzdHIoJ2Zvb2JhcnInKSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyaWUuZmluZFN1YnN0cignZm9vYmF6cnInKSwgMyk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Rlcm5hcnlTZWFyY2hUcmVlIC0gYmFzaWNzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHRyaWUgPSBuZXcgVGVybmFyeVNlYXJjaFRyZWU8c3RyaW5nLCBudW1iZXI+KG5ldyBTdHJpbmdJdGVyYXRvcigpKTtcblxuXHRcdHRyaWUuc2V0KCdmb28nLCAxKTtcblx0XHR0cmllLnNldCgnYmFyJywgMik7XG5cdFx0dHJpZS5zZXQoJ2Zvb2JhcicsIDMpO1xuXHRcdGFzc2VydFRzdERmcyh0cmllLCBbJ2JhcicsIDJdLCBbJ2ZvbycsIDFdLCBbJ2Zvb2JhcicsIDNdKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmdldCgnZm9vJyksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmdldCgnYmFyJyksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmdldCgnZm9vYmFyJyksIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmdldCgnZm9vYmF6JyksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyaWUuZ2V0KCdmb29iYXJyJyksIHVuZGVmaW5lZCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5maW5kU3Vic3RyKCdmbycpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmZpbmRTdWJzdHIoJ2ZvbycpLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5maW5kU3Vic3RyKCdmb29vbycpLCAxKTtcblxuXG5cdFx0dHJpZS5kZWxldGUoJ2Zvb2JhcicpO1xuXHRcdHRyaWUuZGVsZXRlKCdiYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5nZXQoJ2Zvb2JhcicpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmdldCgnYmFyJyksIHVuZGVmaW5lZCk7XG5cblx0XHR0cmllLnNldCgnZm9vYmFyJywgMTcpO1xuXHRcdHRyaWUuc2V0KCdiYXJyJywgMTgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmdldCgnZm9vYmFyJyksIDE3KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5nZXQoJ2JhcnInKSwgMTgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmdldCgnYmFyJyksIHVuZGVmaW5lZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Rlcm5hcnlTZWFyY2hUcmVlIC0gZGVsZXRlICYgY2xlYW51cCcsIGZ1bmN0aW9uICgpIHtcblx0XHQvLyBub3JtYWwgZGVsZXRlXG5cdFx0bGV0IHRyaWUgPSBuZXcgVGVybmFyeVNlYXJjaFRyZWU8c3RyaW5nLCBudW1iZXI+KG5ldyBTdHJpbmdJdGVyYXRvcigpKTtcblx0XHR0cmllLnNldCgnZm9vJywgMSk7XG5cdFx0dHJpZS5zZXQoJ2Zvb2JhcicsIDIpO1xuXHRcdHRyaWUuc2V0KCdiYXInLCAzKTtcblx0XHRhc3NlcnRUc3REZnModHJpZSwgWydiYXInLCAzXSwgWydmb28nLCAxXSwgWydmb29iYXInLCAyXSk7XG5cdFx0dHJpZS5kZWxldGUoJ2ZvbycpO1xuXHRcdGFzc2VydFRzdERmcyh0cmllLCBbJ2JhcicsIDNdLCBbJ2Zvb2JhcicsIDJdKTtcblx0XHR0cmllLmRlbGV0ZSgnZm9vYmFyJyk7XG5cdFx0YXNzZXJ0VHN0RGZzKHRyaWUsIFsnYmFyJywgM10pO1xuXG5cdFx0Ly8gc3VwZXJzdHItZGVsZXRlXG5cdFx0dHJpZSA9IG5ldyBUZXJuYXJ5U2VhcmNoVHJlZTxzdHJpbmcsIG51bWJlcj4obmV3IFN0cmluZ0l0ZXJhdG9yKCkpO1xuXHRcdHRyaWUuc2V0KCdmb28nLCAxKTtcblx0XHR0cmllLnNldCgnZm9vYmFyJywgMik7XG5cdFx0dHJpZS5zZXQoJ2JhcicsIDMpO1xuXHRcdHRyaWUuc2V0KCdmb29iYXJiYXonLCA0KTtcblx0XHR0cmllLmRlbGV0ZVN1cGVyc3RyKCdmb28nKTtcblx0XHRhc3NlcnRUc3REZnModHJpZSwgWydiYXInLCAzXSwgWydmb28nLCAxXSk7XG5cblx0XHR0cmllID0gbmV3IFRlcm5hcnlTZWFyY2hUcmVlPHN0cmluZywgbnVtYmVyPihuZXcgU3RyaW5nSXRlcmF0b3IoKSk7XG5cdFx0dHJpZS5zZXQoJ2ZvbycsIDEpO1xuXHRcdHRyaWUuc2V0KCdmb29iYXInLCAyKTtcblx0XHR0cmllLnNldCgnYmFyJywgMyk7XG5cdFx0dHJpZS5zZXQoJ2Zvb2JhcmJheicsIDQpO1xuXHRcdHRyaWUuZGVsZXRlU3VwZXJzdHIoJ2ZvJyk7XG5cdFx0YXNzZXJ0VHN0RGZzKHRyaWUsIFsnYmFyJywgM10pO1xuXG5cdFx0Ly8gdHJpZSA9IG5ldyBUZXJuYXJ5U2VhcmNoVHJlZTxzdHJpbmcsIG51bWJlcj4obmV3IFN0cmluZ0l0ZXJhdG9yKCkpO1xuXHRcdC8vIHRyaWUuc2V0KCdmb28nLCAxKTtcblx0XHQvLyB0cmllLnNldCgnZm9vYmFyJywgMik7XG5cdFx0Ly8gdHJpZS5zZXQoJ2JhcicsIDMpO1xuXHRcdC8vIHRyaWUuZGVsZXRlU3VwZXJTdHIoJ2YnKTtcblx0XHQvLyBhc3NlcnRUZXJuYXJ5U2VhcmNoVHJlZSh0cmllLCBbJ2JhcicsIDNdKTtcblx0fSk7XG5cblx0dGVzdCgnVGVybmFyeVNlYXJjaFRyZWUgKFBhdGhTZWdtZW50cykgLSBiYXNpY3MnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdHJpZSA9IG5ldyBUZXJuYXJ5U2VhcmNoVHJlZTxzdHJpbmcsIG51bWJlcj4obmV3IFBhdGhJdGVyYXRvcigpKTtcblxuXHRcdHRyaWUuc2V0KCcvdXNlci9mb28vYmFyJywgMSk7XG5cdFx0dHJpZS5zZXQoJy91c2VyL2ZvbycsIDIpO1xuXHRcdHRyaWUuc2V0KCcvdXNlci9mb28vZmxpcC9mbG9wJywgMyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5nZXQoJy91c2VyL2Zvby9iYXInKSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyaWUuZ2V0KCcvdXNlci9mb28nKSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyaWUuZ2V0KCcvdXNlci8vZm9vJyksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmdldCgnL3VzZXJcXFxcZm9vJyksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmdldCgnL3VzZXIvZm9vL2ZsaXAvZmxvcCcpLCAzKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmZpbmRTdWJzdHIoJy91c2VyL2JhcicpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmZpbmRTdWJzdHIoJy91c2VyL2ZvbycpLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5maW5kU3Vic3RyKCdcXFxcdXNlclxcXFxmb28nKSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyaWUuZmluZFN1YnN0cignL3VzZXIvL2ZvbycpLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5maW5kU3Vic3RyKCcvdXNlci9mb28vYmEnKSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyaWUuZmluZFN1YnN0cignL3VzZXIvZm9vL2Zhci9ib28nKSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyaWUuZmluZFN1YnN0cignL3VzZXIvZm9vL2JhcicpLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5maW5kU3Vic3RyKCcvdXNlci9mb28vYmFyL2Zhci9ib28nKSwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Rlcm5hcnlTZWFyY2hUcmVlIC0gKEFWTCkgc2V0JywgZnVuY3Rpb24gKCkge1xuXHRcdHtcblx0XHRcdC8vIHJvdGF0ZSBsZWZ0XG5cdFx0XHRjb25zdCB0cmllID0gbmV3IFRlcm5hcnlTZWFyY2hUcmVlPHN0cmluZywgbnVtYmVyPihuZXcgUGF0aEl0ZXJhdG9yKCkpO1xuXHRcdFx0dHJpZS5zZXQoJy9maWxlQScsIDEpO1xuXHRcdFx0dHJpZS5zZXQoJy9maWxlQicsIDIpO1xuXHRcdFx0dHJpZS5zZXQoJy9maWxlQycsIDMpO1xuXHRcdFx0YXNzZXJ0VHN0RGZzKHRyaWUsIFsnL2ZpbGVBJywgMV0sIFsnL2ZpbGVCJywgMl0sIFsnL2ZpbGVDJywgM10pO1xuXHRcdH1cblxuXHRcdHtcblx0XHRcdC8vIHJvdGF0ZSBsZWZ0IChpbnNpZGUgbWlkZGxlKVxuXHRcdFx0Y29uc3QgdHJpZSA9IG5ldyBUZXJuYXJ5U2VhcmNoVHJlZTxzdHJpbmcsIG51bWJlcj4obmV3IFBhdGhJdGVyYXRvcigpKTtcblx0XHRcdHRyaWUuc2V0KCcvZm9vL2ZpbGVBJywgMSk7XG5cdFx0XHR0cmllLnNldCgnL2Zvby9maWxlQicsIDIpO1xuXHRcdFx0dHJpZS5zZXQoJy9mb28vZmlsZUMnLCAzKTtcblx0XHRcdGFzc2VydFRzdERmcyh0cmllLCBbJy9mb28vZmlsZUEnLCAxXSwgWycvZm9vL2ZpbGVCJywgMl0sIFsnL2Zvby9maWxlQycsIDNdKTtcblx0XHR9XG5cblx0XHR7XG5cdFx0XHQvLyByb3RhdGUgcmlnaHRcblx0XHRcdGNvbnN0IHRyaWUgPSBuZXcgVGVybmFyeVNlYXJjaFRyZWU8c3RyaW5nLCBudW1iZXI+KG5ldyBQYXRoSXRlcmF0b3IoKSk7XG5cdFx0XHR0cmllLnNldCgnL2ZpbGVDJywgMyk7XG5cdFx0XHR0cmllLnNldCgnL2ZpbGVCJywgMik7XG5cdFx0XHR0cmllLnNldCgnL2ZpbGVBJywgMSk7XG5cdFx0XHRhc3NlcnRUc3REZnModHJpZSwgWycvZmlsZUEnLCAxXSwgWycvZmlsZUInLCAyXSwgWycvZmlsZUMnLCAzXSk7XG5cdFx0fVxuXG5cdFx0e1xuXHRcdFx0Ly8gcm90YXRlIHJpZ2h0IChpbnNpZGUgbWlkZGxlKVxuXHRcdFx0Y29uc3QgdHJpZSA9IG5ldyBUZXJuYXJ5U2VhcmNoVHJlZTxzdHJpbmcsIG51bWJlcj4obmV3IFBhdGhJdGVyYXRvcigpKTtcblx0XHRcdHRyaWUuc2V0KCcvbWlkL2ZpbGVDJywgMyk7XG5cdFx0XHR0cmllLnNldCgnL21pZC9maWxlQicsIDIpO1xuXHRcdFx0dHJpZS5zZXQoJy9taWQvZmlsZUEnLCAxKTtcblx0XHRcdGFzc2VydFRzdERmcyh0cmllLCBbJy9taWQvZmlsZUEnLCAxXSwgWycvbWlkL2ZpbGVCJywgMl0sIFsnL21pZC9maWxlQycsIDNdKTtcblx0XHR9XG5cblx0XHR7XG5cdFx0XHQvLyByb3RhdGUgcmlnaHQsIGxlZnRcblx0XHRcdGNvbnN0IHRyaWUgPSBuZXcgVGVybmFyeVNlYXJjaFRyZWU8c3RyaW5nLCBudW1iZXI+KG5ldyBQYXRoSXRlcmF0b3IoKSk7XG5cdFx0XHR0cmllLnNldCgnL2ZpbGVEJywgNyk7XG5cdFx0XHR0cmllLnNldCgnL2ZpbGVCJywgMik7XG5cdFx0XHR0cmllLnNldCgnL2ZpbGVHJywgNDIpO1xuXHRcdFx0dHJpZS5zZXQoJy9maWxlRicsIDI0KTtcblx0XHRcdHRyaWUuc2V0KCcvZmlsZVonLCA3Myk7XG5cdFx0XHR0cmllLnNldCgnL2ZpbGVFJywgMTUpO1xuXHRcdFx0YXNzZXJ0VHN0RGZzKHRyaWUsIFsnL2ZpbGVCJywgMl0sIFsnL2ZpbGVEJywgN10sIFsnL2ZpbGVFJywgMTVdLCBbJy9maWxlRicsIDI0XSwgWycvZmlsZUcnLCA0Ml0sIFsnL2ZpbGVaJywgNzNdKTtcblx0XHR9XG5cblx0XHR7XG5cdFx0XHQvLyByb3RhdGUgbGVmdCwgcmlnaHRcblx0XHRcdGNvbnN0IHRyaWUgPSBuZXcgVGVybmFyeVNlYXJjaFRyZWU8c3RyaW5nLCBudW1iZXI+KG5ldyBQYXRoSXRlcmF0b3IoKSk7XG5cdFx0XHR0cmllLnNldCgnL2ZpbGVKJywgNDIpO1xuXHRcdFx0dHJpZS5zZXQoJy9maWxlWicsIDczKTtcblx0XHRcdHRyaWUuc2V0KCcvZmlsZUUnLCAxNSk7XG5cdFx0XHR0cmllLnNldCgnL2ZpbGVCJywgMik7XG5cdFx0XHR0cmllLnNldCgnL2ZpbGVGJywgNyk7XG5cdFx0XHR0cmllLnNldCgnL2ZpbGVHJywgMSk7XG5cdFx0XHRhc3NlcnRUc3REZnModHJpZSwgWycvZmlsZUInLCAyXSwgWycvZmlsZUUnLCAxNV0sIFsnL2ZpbGVGJywgN10sIFsnL2ZpbGVHJywgMV0sIFsnL2ZpbGVKJywgNDJdLCBbJy9maWxlWicsIDczXSk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdUZXJuYXJ5U2VhcmNoVHJlZSAtIChCU1QpIGRlbGV0ZScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHRyaWUgPSBuZXcgVGVybmFyeVNlYXJjaFRyZWU8c3RyaW5nLCBudW1iZXI+KG5ldyBTdHJpbmdJdGVyYXRvcigpKTtcblxuXHRcdC8vIGRlbGV0ZSByb290XG5cdFx0dHJpZS5zZXQoJ2QnLCAxKTtcblx0XHRhc3NlcnRUc3REZnModHJpZSwgWydkJywgMV0pO1xuXHRcdHRyaWUuZGVsZXRlKCdkJyk7XG5cdFx0YXNzZXJ0VHN0RGZzKHRyaWUpO1xuXG5cdFx0Ly8gZGVsZXRlIG5vZGUgd2l0aCB0d28gZWxlbWVudFxuXHRcdHRyaWUuY2xlYXIoKTtcblx0XHR0cmllLnNldCgnZCcsIDEpO1xuXHRcdHRyaWUuc2V0KCdiJywgMSk7XG5cdFx0dHJpZS5zZXQoJ2YnLCAxKTtcblx0XHRhc3NlcnRUc3REZnModHJpZSwgWydiJywgMV0sIFsnZCcsIDFdLCBbJ2YnLCAxXSk7XG5cdFx0dHJpZS5kZWxldGUoJ2QnKTtcblx0XHRhc3NlcnRUc3REZnModHJpZSwgWydiJywgMV0sIFsnZicsIDFdKTtcblxuXHRcdC8vIHNpbmdsZSBjaGlsZCBub2RlXG5cdFx0dHJpZS5jbGVhcigpO1xuXHRcdHRyaWUuc2V0KCdkJywgMSk7XG5cdFx0dHJpZS5zZXQoJ2InLCAxKTtcblx0XHR0cmllLnNldCgnZicsIDEpO1xuXHRcdHRyaWUuc2V0KCdlJywgMSk7XG5cdFx0YXNzZXJ0VHN0RGZzKHRyaWUsIFsnYicsIDFdLCBbJ2QnLCAxXSwgWydlJywgMV0sIFsnZicsIDFdKTtcblx0XHR0cmllLmRlbGV0ZSgnZicpO1xuXHRcdGFzc2VydFRzdERmcyh0cmllLCBbJ2InLCAxXSwgWydkJywgMV0sIFsnZScsIDFdKTtcblx0fSk7XG5cblx0dGVzdCgnVGVybmFyeVNlYXJjaFRyZWUgLSAoQVZMKSBkZWxldGUnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCB0cmllID0gbmV3IFRlcm5hcnlTZWFyY2hUcmVlPHN0cmluZywgbnVtYmVyPihuZXcgU3RyaW5nSXRlcmF0b3IoKSk7XG5cblx0XHR0cmllLmNsZWFyKCk7XG5cdFx0dHJpZS5zZXQoJ2QnLCAxKTtcblx0XHR0cmllLnNldCgnYicsIDEpO1xuXHRcdHRyaWUuc2V0KCdmJywgMSk7XG5cdFx0dHJpZS5zZXQoJ2UnLCAxKTtcblx0XHR0cmllLnNldCgneicsIDEpO1xuXHRcdGFzc2VydFRzdERmcyh0cmllLCBbJ2InLCAxXSwgWydkJywgMV0sIFsnZScsIDFdLCBbJ2YnLCAxXSwgWyd6JywgMV0pO1xuXG5cdFx0Ly8gcmlnaHQsIHJpZ2h0XG5cdFx0dHJpZS5kZWxldGUoJ2InKTtcblx0XHRhc3NlcnRUc3REZnModHJpZSwgWydkJywgMV0sIFsnZScsIDFdLCBbJ2YnLCAxXSwgWyd6JywgMV0pO1xuXG5cdFx0dHJpZS5jbGVhcigpO1xuXHRcdHRyaWUuc2V0KCdkJywgMSk7XG5cdFx0dHJpZS5zZXQoJ2MnLCAxKTtcblx0XHR0cmllLnNldCgnZicsIDEpO1xuXHRcdHRyaWUuc2V0KCdhJywgMSk7XG5cdFx0dHJpZS5zZXQoJ2InLCAxKTtcblx0XHRhc3NlcnRUc3REZnModHJpZSwgWydhJywgMV0sIFsnYicsIDFdLCBbJ2MnLCAxXSwgWydkJywgMV0sIFsnZicsIDFdKTtcblxuXHRcdC8vIGxlZnQsIGxlZnRcblx0XHR0cmllLmRlbGV0ZSgnZicpO1xuXHRcdGFzc2VydFRzdERmcyh0cmllLCBbJ2EnLCAxXSwgWydiJywgMV0sIFsnYycsIDFdLCBbJ2QnLCAxXSk7XG5cblx0XHQvLyBtaWRcblx0XHR0cmllLmNsZWFyKCk7XG5cdFx0dHJpZS5zZXQoJ2EnLCAxKTtcblx0XHR0cmllLnNldCgnYWQnLCAxKTtcblx0XHR0cmllLnNldCgnYWInLCAxKTtcblx0XHR0cmllLnNldCgnYWYnLCAxKTtcblx0XHR0cmllLnNldCgnYWUnLCAxKTtcblx0XHR0cmllLnNldCgnYXonLCAxKTtcblx0XHRhc3NlcnRUc3REZnModHJpZSwgWydhJywgMV0sIFsnYWInLCAxXSwgWydhZCcsIDFdLCBbJ2FlJywgMV0sIFsnYWYnLCAxXSwgWydheicsIDFdKTtcblxuXHRcdHRyaWUuZGVsZXRlKCdhYicpO1xuXHRcdGFzc2VydFRzdERmcyh0cmllLCBbJ2EnLCAxXSwgWydhZCcsIDFdLCBbJ2FlJywgMV0sIFsnYWYnLCAxXSwgWydheicsIDFdKTtcblxuXHRcdHRyaWUuZGVsZXRlKCdhJyk7XG5cdFx0YXNzZXJ0VHN0RGZzKHRyaWUsIFsnYWQnLCAxXSwgWydhZScsIDFdLCBbJ2FmJywgMV0sIFsnYXonLCAxXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Rlcm5hcnlTZWFyY2hUcmVlOiBDYW5ub3QgcmVhZCBwcm9wZXJ0eSBcXCcxXFwnIG9mIHVuZGVmaW5lZCAjMTM4Mjg0JywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3Qga2V5cyA9IFtcblx0XHRcdFVSSS5wYXJzZSgnZmFrZS1mczovQycpLFxuXHRcdFx0VVJJLnBhcnNlKCdmYWtlLWZzOi9BJyksXG5cdFx0XHRVUkkucGFyc2UoJ2Zha2UtZnM6L0QnKSxcblx0XHRcdFVSSS5wYXJzZSgnZmFrZS1mczovQicpLFxuXHRcdF07XG5cblx0XHRjb25zdCB0c3QgPSBUZXJuYXJ5U2VhcmNoVHJlZS5mb3JVcmlzPGJvb2xlYW4+KCk7XG5cblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2Yga2V5cykge1xuXHRcdFx0dHN0LnNldChpdGVtLCB0cnVlKTtcblx0XHR9XG5cblx0XHRhc3NlcnQub2sodHN0Ll9pc0JhbGFuY2VkKCkpO1xuXHRcdHRzdC5kZWxldGUoa2V5c1swXSk7XG5cdFx0YXNzZXJ0Lm9rKHRzdC5faXNCYWxhbmNlZCgpKTtcblx0fSk7XG5cblx0dGVzdCgnVGVybmFyeVNlYXJjaFRyZWU6IENhbm5vdCByZWFkIHByb3BlcnR5IFxcJzFcXCcgb2YgdW5kZWZpbmVkICMxMzgyODQgKHNpbXBsZSknLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBrZXlzID0gWydDJywgJ0EnLCAnRCcsICdCJyxdO1xuXHRcdGNvbnN0IHRzdCA9IFRlcm5hcnlTZWFyY2hUcmVlLmZvclN0cmluZ3M8Ym9vbGVhbj4oKTtcblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2Yga2V5cykge1xuXHRcdFx0dHN0LnNldChpdGVtLCB0cnVlKTtcblx0XHR9XG5cdFx0YXNzZXJ0VHN0RGZzKHRzdCwgWydBJywgdHJ1ZV0sIFsnQicsIHRydWVdLCBbJ0MnLCB0cnVlXSwgWydEJywgdHJ1ZV0pO1xuXG5cdFx0dHN0LmRlbGV0ZShrZXlzWzBdKTtcblx0XHRhc3NlcnRUc3REZnModHN0LCBbJ0EnLCB0cnVlXSwgWydCJywgdHJ1ZV0sIFsnRCcsIHRydWVdKTtcblxuXHRcdHtcblx0XHRcdGNvbnN0IHRzdCA9IFRlcm5hcnlTZWFyY2hUcmVlLmZvclN0cmluZ3M8Ym9vbGVhbj4oKTtcblx0XHRcdHRzdC5zZXQoJ0MnLCB0cnVlKTtcblx0XHRcdHRzdC5zZXQoJ0EnLCB0cnVlKTtcblx0XHRcdHRzdC5zZXQoJ0InLCB0cnVlKTtcblx0XHRcdGFzc2VydFRzdERmcyh0c3QsIFsnQScsIHRydWVdLCBbJ0InLCB0cnVlXSwgWydDJywgdHJ1ZV0pO1xuXHRcdH1cblxuXHR9KTtcblxuXHR0ZXN0KCdUZXJuYXJ5U2VhcmNoVHJlZTogQ2Fubm90IHJlYWQgcHJvcGVydHkgXFwnMVxcJyBvZiB1bmRlZmluZWQgIzEzODI4NCAocmFuZG9tKScsIGZ1bmN0aW9uICgpIHtcblx0XHRmb3IgKGxldCByb3VuZCA9IDEwOyByb3VuZCA+PSAwOyByb3VuZC0tKSB7XG5cdFx0XHRjb25zdCBrZXlzOiBVUklbXSA9IFtdO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAxMDA7IGkrKykge1xuXHRcdFx0XHRrZXlzLnB1c2goVVJJLmZyb20oeyBzY2hlbWU6ICdmYWtlLWZzJywgcGF0aDogcmFuZG9tUGF0aCh1bmRlZmluZWQsIHVuZGVmaW5lZCwgMTApIH0pKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHRzdCA9IFRlcm5hcnlTZWFyY2hUcmVlLmZvclVyaXM8Ym9vbGVhbj4oKTtcblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Zm9yIChjb25zdCBpdGVtIG9mIGtleXMpIHtcblx0XHRcdFx0XHR0c3Quc2V0KGl0ZW0sIHRydWUpO1xuXHRcdFx0XHRcdGFzc2VydC5vayh0c3QuX2lzQmFsYW5jZWQoKSwgYFNFVCR7aXRlbX18JHtrZXlzLm1hcChTdHJpbmcpLmpvaW4oKX1gKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGZvciAoY29uc3QgaXRlbSBvZiBrZXlzKSB7XG5cdFx0XHRcdFx0dHN0LmRlbGV0ZShpdGVtKTtcblx0XHRcdFx0XHRhc3NlcnQub2sodHN0Ll9pc0JhbGFuY2VkKCksIGBERUwke2l0ZW19fCR7a2V5cy5tYXAoU3RyaW5nKS5qb2luKCl9YCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRhc3NlcnQub2soZmFsc2UsIGBGQUlMRUQgd2l0aCBrZXlzOiAke2tleXMubWFwKFN0cmluZykuam9pbigpfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnVGVybmFyeVNlYXJjaFRyZWU6IENhbm5vdCByZWFkIHByb3BlcnRpZXMgb2YgdW5kZWZpbmVkIChyZWFkaW5nIFxcJ2xlbmd0aFxcJyk6ICMxNjE2MTggKHNpbXBsZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmF3ID0gJ2NvbmZpZy5kZWJ1Zy50b29sQmFyTG9jYXRpb24sZmxvYXRpbmcsY29uZmlnLmVkaXRvci5yZW5kZXJDb250cm9sQ2hhcmFjdGVycyx0cnVlLGNvbmZpZy5lZGl0b3IucmVuZGVyV2hpdGVzcGFjZSxzZWxlY3Rpb24sY29uZmlnLmZpbGVzLmF1dG9TYXZlLG9mZixjb25maWcuZ2l0LmVuYWJsZWQsdHJ1ZSxjb25maWcubm90ZWJvb2suZ2xvYmFsVG9vbGJhcix0cnVlLGNvbmZpZy50ZXJtaW5hbC5pbnRlZ3JhdGVkLnRhYnMuZW5hYmxlZCx0cnVlLGNvbmZpZy50ZXJtaW5hbC5pbnRlZ3JhdGVkLnRhYnMuc2hvd0FjdGlvbnMsc2luZ2xlVGVybWluYWxPck5hcnJvdyxjb25maWcudGVybWluYWwuaW50ZWdyYXRlZC50YWJzLnNob3dBY3RpdmVUZXJtaW5hbCxzaW5nbGVUZXJtaW5hbE9yTmFycm93LGNvbmZpZy53b3JrYmVuY2guYWN0aXZpdHlCYXIudmlzaWJsZSx0cnVlLGNvbmZpZy53b3JrYmVuY2guZXhwZXJpbWVudGFsLnNldHRpbmdzUHJvZmlsZXMuZW5hYmxlZCx0cnVlLGNvbmZpZy53b3JrYmVuY2gubGF5b3V0Q29udHJvbC50eXBlLGJvdGgsY29uZmlnLndvcmtiZW5jaC5zaWRlQmFyLmxvY2F0aW9uLGxlZnQsY29uZmlnLndvcmtiZW5jaC5zdGF0dXNCYXIudmlzaWJsZSx0cnVlJztcblx0XHRjb25zdCBhcnJheSA9IHJhdy5zcGxpdCgnLCcpO1xuXHRcdGNvbnN0IHR1cGxlczogW3N0cmluZywgc3RyaW5nXVtdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkgKz0gMikge1xuXHRcdFx0dHVwbGVzLnB1c2goW2FycmF5W2ldLCBhcnJheVtpICsgMV1dKTtcblx0XHR9XG5cblx0XHRjb25zdCBtYXAgPSBUZXJuYXJ5U2VhcmNoVHJlZS5mb3JDb25maWdLZXlzPHN0cmluZz4oKTtcblx0XHRtYXAuZmlsbCh0dXBsZXMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFsuLi5tYXBdLmpvaW4oKSwgcmF3KTtcblx0XHRhc3NlcnQub2sobWFwLmhhcygnY29uZmlnLmVkaXRvci5yZW5kZXJXaGl0ZXNwYWNlJykpO1xuXG5cdFx0Y29uc3QgbGVuID0gWy4uLm1hcF0ubGVuZ3RoO1xuXHRcdG1hcC5kZWxldGUoJ2NvbmZpZy5lZGl0b3IucmVuZGVyV2hpdGVzcGFjZScpO1xuXHRcdGFzc2VydC5vayhtYXAuX2lzQmFsYW5jZWQoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFsuLi5tYXBdLmxlbmd0aCwgbGVuIC0gMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Rlcm5hcnlTZWFyY2hUcmVlOiBDYW5ub3QgcmVhZCBwcm9wZXJ0aWVzIG9mIHVuZGVmaW5lZCAocmVhZGluZyBcXCdsZW5ndGhcXCcpOiAjMTYxNjE4IChyYW5kb20pJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJhdyA9ICdjb25maWcuZGVidWcudG9vbEJhckxvY2F0aW9uLGZsb2F0aW5nLGNvbmZpZy5lZGl0b3IucmVuZGVyQ29udHJvbENoYXJhY3RlcnMsdHJ1ZSxjb25maWcuZWRpdG9yLnJlbmRlcldoaXRlc3BhY2Usc2VsZWN0aW9uLGNvbmZpZy5maWxlcy5hdXRvU2F2ZSxvZmYsY29uZmlnLmdpdC5lbmFibGVkLHRydWUsY29uZmlnLm5vdGVib29rLmdsb2JhbFRvb2xiYXIsdHJ1ZSxjb25maWcudGVybWluYWwuaW50ZWdyYXRlZC50YWJzLmVuYWJsZWQsdHJ1ZSxjb25maWcudGVybWluYWwuaW50ZWdyYXRlZC50YWJzLnNob3dBY3Rpb25zLHNpbmdsZVRlcm1pbmFsT3JOYXJyb3csY29uZmlnLnRlcm1pbmFsLmludGVncmF0ZWQudGFicy5zaG93QWN0aXZlVGVybWluYWwsc2luZ2xlVGVybWluYWxPck5hcnJvdyxjb25maWcud29ya2JlbmNoLmFjdGl2aXR5QmFyLnZpc2libGUsdHJ1ZSxjb25maWcud29ya2JlbmNoLmV4cGVyaW1lbnRhbC5zZXR0aW5nc1Byb2ZpbGVzLmVuYWJsZWQsdHJ1ZSxjb25maWcud29ya2JlbmNoLmxheW91dENvbnRyb2wudHlwZSxib3RoLGNvbmZpZy53b3JrYmVuY2guc2lkZUJhci5sb2NhdGlvbixsZWZ0LGNvbmZpZy53b3JrYmVuY2guc3RhdHVzQmFyLnZpc2libGUsdHJ1ZSc7XG5cdFx0Y29uc3QgYXJyYXkgPSByYXcuc3BsaXQoJywnKTtcblx0XHRjb25zdCB0dXBsZXM6IFtzdHJpbmcsIHN0cmluZ11bXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgYXJyYXkubGVuZ3RoOyBpICs9IDIpIHtcblx0XHRcdHR1cGxlcy5wdXNoKFthcnJheVtpXSwgYXJyYXlbaSArIDFdXSk7XG5cdFx0fVxuXG5cdFx0Zm9yIChsZXQgcm91bmQgPSAxMDA7IHJvdW5kID49IDA7IHJvdW5kLS0pIHtcblx0XHRcdHNodWZmbGUodHVwbGVzKTtcblx0XHRcdGNvbnN0IG1hcCA9IFRlcm5hcnlTZWFyY2hUcmVlLmZvckNvbmZpZ0tleXM8c3RyaW5nPigpO1xuXHRcdFx0bWFwLmZpbGwodHVwbGVzKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKFsuLi5tYXBdLmpvaW4oKSwgcmF3KTtcblx0XHRcdGFzc2VydC5vayhtYXAuaGFzKCdjb25maWcuZWRpdG9yLnJlbmRlcldoaXRlc3BhY2UnKSk7XG5cblx0XHRcdGNvbnN0IGxlbiA9IFsuLi5tYXBdLmxlbmd0aDtcblx0XHRcdG1hcC5kZWxldGUoJ2NvbmZpZy5lZGl0b3IucmVuZGVyV2hpdGVzcGFjZScpO1xuXHRcdFx0YXNzZXJ0Lm9rKG1hcC5faXNCYWxhbmNlZCgpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChbLi4ubWFwXS5sZW5ndGgsIGxlbiAtIDEpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnVGVybmFyeVNlYXJjaFRyZWUgKFBhdGhTZWdtZW50cykgLSBsb29rdXAnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBtYXAgPSBuZXcgVGVybmFyeVNlYXJjaFRyZWU8c3RyaW5nLCBudW1iZXI+KG5ldyBQYXRoSXRlcmF0b3IoKSk7XG5cdFx0bWFwLnNldCgnL3VzZXIvZm9vL2JhcicsIDEpO1xuXHRcdG1hcC5zZXQoJy91c2VyL2ZvbycsIDIpO1xuXHRcdG1hcC5zZXQoJy91c2VyL2Zvby9mbGlwL2Zsb3AnLCAzKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXAuZ2V0KCcvZm9vJyksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hcC5nZXQoJy91c2VyJyksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hcC5nZXQoJy91c2VyL2ZvbycpLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFwLmdldCgnL3VzZXIvZm9vL2JhcicpLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFwLmdldCgnL3VzZXIvZm9vL2Jhci9ib28nKSwgdW5kZWZpbmVkKTtcblx0fSk7XG5cblx0dGVzdCgnVGVybmFyeVNlYXJjaFRyZWUgKFBhdGhTZWdtZW50cykgLSBzdXBlcnN0cicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IG1hcCA9IG5ldyBUZXJuYXJ5U2VhcmNoVHJlZTxzdHJpbmcsIG51bWJlcj4obmV3IFBhdGhJdGVyYXRvcigpKTtcblx0XHRtYXAuc2V0KCcvdXNlci9mb28vYmFyJywgMSk7XG5cdFx0bWFwLnNldCgnL3VzZXIvZm9vJywgMik7XG5cdFx0bWFwLnNldCgnL3VzZXIvZm9vL2ZsaXAvZmxvcCcsIDMpO1xuXHRcdG1hcC5zZXQoJy91c3IvZm9vJywgNCk7XG5cblx0XHRsZXQgaXRlbTogSXRlcmF0b3JSZXN1bHQ8W3N0cmluZywgbnVtYmVyXT47XG5cdFx0bGV0IGl0ZXIgPSBtYXAuZmluZFN1cGVyc3RyKCcvdXNlcicpO1xuXG5cdFx0aXRlbSA9IGl0ZXIhLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS52YWx1ZVsxXSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0uZG9uZSwgZmFsc2UpO1xuXHRcdGl0ZW0gPSBpdGVyIS5uZXh0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0udmFsdWVbMV0sIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVtLmRvbmUsIGZhbHNlKTtcblx0XHRpdGVtID0gaXRlciEubmV4dCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVtLnZhbHVlWzFdLCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS5kb25lLCBmYWxzZSk7XG5cdFx0aXRlbSA9IGl0ZXIhLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS52YWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS5kb25lLCB0cnVlKTtcblxuXHRcdGl0ZXIgPSBtYXAuZmluZFN1cGVyc3RyKCcvdXNyJyk7XG5cdFx0aXRlbSA9IGl0ZXIhLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS52YWx1ZVsxXSwgNCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0uZG9uZSwgZmFsc2UpO1xuXG5cdFx0aXRlbSA9IGl0ZXIhLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS52YWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS5kb25lLCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXAuZmluZFN1cGVyc3RyKCcvbm90JyksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hcC5maW5kU3VwZXJzdHIoJy91cycpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXAuZmluZFN1cGVyc3RyKCcvdXNycicpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXAuZmluZFN1cGVyc3RyKCcvdXNlcnInKSwgdW5kZWZpbmVkKTtcblx0fSk7XG5cblxuXHR0ZXN0KCdUZXJuYXJ5U2VhcmNoVHJlZSAoUGF0aFNlZ21lbnRzKSAtIGRlbGV0ZV9zdXBlcnN0cicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IG1hcCA9IG5ldyBUZXJuYXJ5U2VhcmNoVHJlZTxzdHJpbmcsIG51bWJlcj4obmV3IFBhdGhJdGVyYXRvcigpKTtcblx0XHRtYXAuc2V0KCcvdXNlci9mb28vYmFyJywgMSk7XG5cdFx0bWFwLnNldCgnL3VzZXIvZm9vJywgMik7XG5cdFx0bWFwLnNldCgnL3VzZXIvZm9vL2ZsaXAvZmxvcCcsIDMpO1xuXHRcdG1hcC5zZXQoJy91c3IvZm9vJywgNCk7XG5cblx0XHRhc3NlcnRUc3REZnMobWFwLFxuXHRcdFx0WycvdXNlci9mb28nLCAyXSxcblx0XHRcdFsnL3VzZXIvZm9vL2JhcicsIDFdLFxuXHRcdFx0WycvdXNlci9mb28vZmxpcC9mbG9wJywgM10sXG5cdFx0XHRbJy91c3IvZm9vJywgNF0sXG5cdFx0KTtcblxuXHRcdC8vIG5vdCBhIHNlZ21lbnRcblx0XHRtYXAuZGVsZXRlU3VwZXJzdHIoJy91c2VyL2ZvJyk7XG5cdFx0YXNzZXJ0VHN0RGZzKG1hcCxcblx0XHRcdFsnL3VzZXIvZm9vJywgMl0sXG5cdFx0XHRbJy91c2VyL2Zvby9iYXInLCAxXSxcblx0XHRcdFsnL3VzZXIvZm9vL2ZsaXAvZmxvcCcsIDNdLFxuXHRcdFx0WycvdXNyL2ZvbycsIDRdLFxuXHRcdCk7XG5cblx0XHQvLyBkZWxldGUgYSBzZWdtZW50XG5cdFx0bWFwLnNldCgnL3VzZXIvZm9vL2JhcicsIDEpO1xuXHRcdG1hcC5zZXQoJy91c2VyL2ZvbycsIDIpO1xuXHRcdG1hcC5zZXQoJy91c2VyL2Zvby9mbGlwL2Zsb3AnLCAzKTtcblx0XHRtYXAuc2V0KCcvdXNyL2ZvbycsIDQpO1xuXHRcdG1hcC5kZWxldGVTdXBlcnN0cignL3VzZXIvZm9vJyk7XG5cdFx0YXNzZXJ0VHN0RGZzKG1hcCxcblx0XHRcdFsnL3VzZXIvZm9vJywgMl0sXG5cdFx0XHRbJy91c3IvZm9vJywgNF0sXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnVGVybmFyeVNlYXJjaFRyZWUgKFVSSSkgLSBiYXNpY3MnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdHJpZSA9IG5ldyBUZXJuYXJ5U2VhcmNoVHJlZTxVUkksIG51bWJlcj4obmV3IFVyaUl0ZXJhdG9yKCgpID0+IGZhbHNlLCAoKSA9PiBmYWxzZSkpO1xuXG5cdFx0dHJpZS5zZXQoVVJJLmZpbGUoJy91c2VyL2Zvby9iYXInKSwgMSk7XG5cdFx0dHJpZS5zZXQoVVJJLmZpbGUoJy91c2VyL2ZvbycpLCAyKTtcblx0XHR0cmllLnNldChVUkkuZmlsZSgnL3VzZXIvZm9vL2ZsaXAvZmxvcCcpLCAzKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmdldChVUkkuZmlsZSgnL3VzZXIvZm9vL2JhcicpKSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyaWUuZ2V0KFVSSS5maWxlKCcvdXNlci9mb28nKSksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmdldChVUkkuZmlsZSgnL3VzZXIvZm9vL2ZsaXAvZmxvcCcpKSwgMyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5maW5kU3Vic3RyKFVSSS5maWxlKCcvdXNlci9iYXInKSksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyaWUuZmluZFN1YnN0cihVUkkuZmlsZSgnL3VzZXIvZm9vJykpLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5maW5kU3Vic3RyKFVSSS5maWxlKCcvdXNlci9mb28vYmEnKSksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmZpbmRTdWJzdHIoVVJJLmZpbGUoJy91c2VyL2Zvby9mYXIvYm9vJykpLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5maW5kU3Vic3RyKFVSSS5maWxlKCcvdXNlci9mb28vYmFyJykpLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5maW5kU3Vic3RyKFVSSS5maWxlKCcvdXNlci9mb28vYmFyL2Zhci9ib28nKSksIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXJuYXJ5U2VhcmNoVHJlZSAoVVJJKSAtIHF1ZXJ5IHBhcmFtZXRlcnMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdHJpZSA9IG5ldyBUZXJuYXJ5U2VhcmNoVHJlZTxVUkksIG51bWJlcj4obmV3IFVyaUl0ZXJhdG9yKCgpID0+IGZhbHNlLCAoKSA9PiB0cnVlKSk7XG5cdFx0Y29uc3Qgcm9vdCA9IFVSSS5wYXJzZSgnbWVtZnM6Lz9wYXJhbT0xJyk7XG5cdFx0dHJpZS5zZXQocm9vdCwgMSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5nZXQoVVJJLnBhcnNlKCdtZW1mczovP3BhcmFtPTEnKSksIDEpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyaWUuZmluZFN1YnN0cihVUkkucGFyc2UoJ21lbWZzOi8/cGFyYW09MScpKSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyaWUuZmluZFN1YnN0cihVUkkucGFyc2UoJ21lbWZzOi9hYWE/cGFyYW09MScpKSwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Rlcm5hcnlTZWFyY2hUcmVlIChVUkkpIC0gbG9va3VwJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgbWFwID0gbmV3IFRlcm5hcnlTZWFyY2hUcmVlPFVSSSwgbnVtYmVyPihuZXcgVXJpSXRlcmF0b3IoKCkgPT4gZmFsc2UsICgpID0+IGZhbHNlKSk7XG5cdFx0bWFwLnNldChVUkkucGFyc2UoJ2h0dHA6Ly9mb28uYmFyL3VzZXIvZm9vL2JhcicpLCAxKTtcblx0XHRtYXAuc2V0KFVSSS5wYXJzZSgnaHR0cDovL2Zvby5iYXIvdXNlci9mb28/cXVlcnknKSwgMik7XG5cdFx0bWFwLnNldChVUkkucGFyc2UoJ2h0dHA6Ly9mb28uYmFyL3VzZXIvZm9vP1FVRVJZJyksIDMpO1xuXHRcdG1hcC5zZXQoVVJJLnBhcnNlKCdodHRwOi8vZm9vLmJhci91c2VyL2Zvby9mbGlwL2Zsb3AnKSwgMyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFwLmdldChVUkkucGFyc2UoJ2h0dHA6Ly9mb28uYmFyL2ZvbycpKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFwLmdldChVUkkucGFyc2UoJ2h0dHA6Ly9mb28uYmFyL3VzZXInKSksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hcC5nZXQoVVJJLnBhcnNlKCdodHRwOi8vZm9vLmJhci91c2VyL2Zvby9iYXInKSksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXAuZ2V0KFVSSS5wYXJzZSgnaHR0cDovL2Zvby5iYXIvdXNlci9mb28/cXVlcnknKSksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXAuZ2V0KFVSSS5wYXJzZSgnaHR0cDovL2Zvby5iYXIvdXNlci9mb28/UXVlcnknKSksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hcC5nZXQoVVJJLnBhcnNlKCdodHRwOi8vZm9vLmJhci91c2VyL2Zvbz9RVUVSWScpKSwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hcC5nZXQoVVJJLnBhcnNlKCdodHRwOi8vZm9vLmJhci91c2VyL2Zvby9iYXIvYm9vJykpLCB1bmRlZmluZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXJuYXJ5U2VhcmNoVHJlZSAoVVJJKSAtIGxvb2t1cCwgY2FzaW5nJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgbWFwID0gbmV3IFRlcm5hcnlTZWFyY2hUcmVlPFVSSSwgbnVtYmVyPihuZXcgVXJpSXRlcmF0b3IodXJpID0+IC9eaHR0cHM/JC8udGVzdCh1cmkuc2NoZW1lKSwgKCkgPT4gZmFsc2UpKTtcblx0XHRtYXAuc2V0KFVSSS5wYXJzZSgnaHR0cDovL2Zvby5iYXIvdXNlci9mb28vYmFyJyksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXAuZ2V0KFVSSS5wYXJzZSgnaHR0cDovL2Zvby5iYXIvVVNFUi9mb28vYmFyJykpLCAxKTtcblxuXHRcdG1hcC5zZXQoVVJJLnBhcnNlKCdmb286Ly9mb28uYmFyL3VzZXIvZm9vL2JhcicpLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFwLmdldChVUkkucGFyc2UoJ2ZvbzovL2Zvby5iYXIvVVNFUi9mb28vYmFyJykpLCB1bmRlZmluZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXJuYXJ5U2VhcmNoVHJlZSAoVVJJKSAtIHN1cGVyc3RyJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgbWFwID0gbmV3IFRlcm5hcnlTZWFyY2hUcmVlPFVSSSwgbnVtYmVyPihuZXcgVXJpSXRlcmF0b3IoKCkgPT4gZmFsc2UsICgpID0+IGZhbHNlKSk7XG5cdFx0bWFwLnNldChVUkkuZmlsZSgnL3VzZXIvZm9vL2JhcicpLCAxKTtcblx0XHRtYXAuc2V0KFVSSS5maWxlKCcvdXNlci9mb28nKSwgMik7XG5cdFx0bWFwLnNldChVUkkuZmlsZSgnL3VzZXIvZm9vL2ZsaXAvZmxvcCcpLCAzKTtcblx0XHRtYXAuc2V0KFVSSS5maWxlKCcvdXNyL2ZvbycpLCA0KTtcblxuXHRcdGxldCBpdGVtOiBJdGVyYXRvclJlc3VsdDxbVVJJLCBudW1iZXJdPjtcblx0XHRsZXQgaXRlciA9IG1hcC5maW5kU3VwZXJzdHIoVVJJLmZpbGUoJy91c2VyJykpITtcblxuXHRcdGl0ZW0gPSBpdGVyLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS52YWx1ZVsxXSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0uZG9uZSwgZmFsc2UpO1xuXHRcdGl0ZW0gPSBpdGVyLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS52YWx1ZVsxXSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0uZG9uZSwgZmFsc2UpO1xuXHRcdGl0ZW0gPSBpdGVyLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS52YWx1ZVsxXSwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0uZG9uZSwgZmFsc2UpO1xuXHRcdGl0ZW0gPSBpdGVyLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS52YWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS5kb25lLCB0cnVlKTtcblxuXHRcdGl0ZXIgPSBtYXAuZmluZFN1cGVyc3RyKFVSSS5maWxlKCcvdXNyJykpITtcblx0XHRpdGVtID0gaXRlci5uZXh0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0udmFsdWVbMV0sIDQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVtLmRvbmUsIGZhbHNlKTtcblxuXHRcdGl0ZW0gPSBpdGVyLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS52YWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS5kb25lLCB0cnVlKTtcblxuXHRcdGl0ZXIgPSBtYXAuZmluZFN1cGVyc3RyKFVSSS5maWxlKCcvJykpITtcblx0XHRpdGVtID0gaXRlci5uZXh0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0udmFsdWVbMV0sIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVtLmRvbmUsIGZhbHNlKTtcblx0XHRpdGVtID0gaXRlci5uZXh0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0udmFsdWVbMV0sIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVtLmRvbmUsIGZhbHNlKTtcblx0XHRpdGVtID0gaXRlci5uZXh0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0udmFsdWVbMV0sIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVtLmRvbmUsIGZhbHNlKTtcblx0XHRpdGVtID0gaXRlci5uZXh0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0udmFsdWVbMV0sIDQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVtLmRvbmUsIGZhbHNlKTtcblx0XHRpdGVtID0gaXRlci5uZXh0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0udmFsdWUsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0uZG9uZSwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFwLmZpbmRTdXBlcnN0cihVUkkuZmlsZSgnL25vdCcpKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFwLmZpbmRTdXBlcnN0cihVUkkuZmlsZSgnL3VzJykpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXAuZmluZFN1cGVyc3RyKFVSSS5maWxlKCcvdXNycicpKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFwLmZpbmRTdXBlcnN0cihVUkkuZmlsZSgnL3VzZXJyJykpLCB1bmRlZmluZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXJuYXJ5U2VhcmNoVHJlZSAoQ29uZmlnS2V5U2VnbWVudHMpIC0gYmFzaWNzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHRyaWUgPSBuZXcgVGVybmFyeVNlYXJjaFRyZWU8c3RyaW5nLCBudW1iZXI+KG5ldyBDb25maWdLZXlzSXRlcmF0b3IoKSk7XG5cblx0XHR0cmllLnNldCgnY29uZmlnLmZvby5iYXInLCAxKTtcblx0XHR0cmllLnNldCgnY29uZmlnLmZvbycsIDIpO1xuXHRcdHRyaWUuc2V0KCdjb25maWcuZm9vLmZsaXAuZmxvcCcsIDMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyaWUuZ2V0KCdjb25maWcuZm9vLmJhcicpLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5nZXQoJ2NvbmZpZy5mb28nKSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyaWUuZ2V0KCdjb25maWcuZm9vLmZsaXAuZmxvcCcpLCAzKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmZpbmRTdWJzdHIoJ2NvbmZpZy5iYXInKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJpZS5maW5kU3Vic3RyKCdjb25maWcuZm9vJyksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmZpbmRTdWJzdHIoJ2NvbmZpZy5mb28uYmEnKSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyaWUuZmluZFN1YnN0cignY29uZmlnLmZvby5mYXIuYm9vJyksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmZpbmRTdWJzdHIoJ2NvbmZpZy5mb28uYmFyJyksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmllLmZpbmRTdWJzdHIoJ2NvbmZpZy5mb28uYmFyLmZhci5ib28nKSwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Rlcm5hcnlTZWFyY2hUcmVlIChDb25maWdLZXlTZWdtZW50cykgLSBsb29rdXAnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBtYXAgPSBuZXcgVGVybmFyeVNlYXJjaFRyZWU8c3RyaW5nLCBudW1iZXI+KG5ldyBDb25maWdLZXlzSXRlcmF0b3IoKSk7XG5cdFx0bWFwLnNldCgnY29uZmlnLmZvby5iYXInLCAxKTtcblx0XHRtYXAuc2V0KCdjb25maWcuZm9vJywgMik7XG5cdFx0bWFwLnNldCgnY29uZmlnLmZvby5mbGlwLmZsb3AnLCAzKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXAuZ2V0KCdmb28nKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFwLmdldCgnY29uZmlnJyksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hcC5nZXQoJ2NvbmZpZy5mb28nKSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hcC5nZXQoJ2NvbmZpZy5mb28uYmFyJyksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXAuZ2V0KCdjb25maWcuZm9vLmJhci5ib28nKSwgdW5kZWZpbmVkKTtcblx0fSk7XG5cblx0dGVzdCgnVGVybmFyeVNlYXJjaFRyZWUgKENvbmZpZ0tleVNlZ21lbnRzKSAtIHN1cGVyc3RyJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgbWFwID0gbmV3IFRlcm5hcnlTZWFyY2hUcmVlPHN0cmluZywgbnVtYmVyPihuZXcgQ29uZmlnS2V5c0l0ZXJhdG9yKCkpO1xuXHRcdG1hcC5zZXQoJ2NvbmZpZy5mb28uYmFyJywgMSk7XG5cdFx0bWFwLnNldCgnY29uZmlnLmZvbycsIDIpO1xuXHRcdG1hcC5zZXQoJ2NvbmZpZy5mb28uZmxpcC5mbG9wJywgMyk7XG5cdFx0bWFwLnNldCgnYm9vJywgNCk7XG5cblx0XHRsZXQgaXRlbTogSXRlcmF0b3JSZXN1bHQ8W3N0cmluZywgbnVtYmVyXT47XG5cdFx0Y29uc3QgaXRlciA9IG1hcC5maW5kU3VwZXJzdHIoJ2NvbmZpZycpO1xuXG5cdFx0aXRlbSA9IGl0ZXIhLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS52YWx1ZVsxXSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0uZG9uZSwgZmFsc2UpO1xuXHRcdGl0ZW0gPSBpdGVyIS5uZXh0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0udmFsdWVbMV0sIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVtLmRvbmUsIGZhbHNlKTtcblx0XHRpdGVtID0gaXRlciEubmV4dCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVtLnZhbHVlWzFdLCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS5kb25lLCBmYWxzZSk7XG5cdFx0aXRlbSA9IGl0ZXIhLm5leHQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS52YWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS5kb25lLCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXAuZmluZFN1cGVyc3RyKCdmb28nKSwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFwLmZpbmRTdXBlcnN0cignY29uZmlnLmZvby5ubycpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXAuZmluZFN1cGVyc3RyKCdjb25maWcuZm9vcCcpLCB1bmRlZmluZWQpO1xuXHR9KTtcblxuXG5cdHRlc3QoJ1Rlcm5hcnlTZWFyY2hUcmVlIChDb25maWdLZXlTZWdtZW50cykgLSBkZWxldGVfc3VwZXJzdHInLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBtYXAgPSBuZXcgVGVybmFyeVNlYXJjaFRyZWU8c3RyaW5nLCBudW1iZXI+KG5ldyBDb25maWdLZXlzSXRlcmF0b3IoKSk7XG5cdFx0bWFwLnNldCgnY29uZmlnLmZvby5iYXInLCAxKTtcblx0XHRtYXAuc2V0KCdjb25maWcuZm9vJywgMik7XG5cdFx0bWFwLnNldCgnY29uZmlnLmZvby5mbGlwLmZsb3AnLCAzKTtcblx0XHRtYXAuc2V0KCdib28nLCA0KTtcblxuXHRcdGFzc2VydFRzdERmcyhtYXAsXG5cdFx0XHRbJ2JvbycsIDRdLFxuXHRcdFx0Wydjb25maWcuZm9vJywgMl0sXG5cdFx0XHRbJ2NvbmZpZy5mb28uYmFyJywgMV0sXG5cdFx0XHRbJ2NvbmZpZy5mb28uZmxpcC5mbG9wJywgM10sXG5cdFx0KTtcblxuXHRcdC8vIG5vdCBhIHNlZ21lbnRcblx0XHRtYXAuZGVsZXRlU3VwZXJzdHIoJ2NvbmZpZy5mbycpO1xuXHRcdGFzc2VydFRzdERmcyhtYXAsXG5cdFx0XHRbJ2JvbycsIDRdLFxuXHRcdFx0Wydjb25maWcuZm9vJywgMl0sXG5cdFx0XHRbJ2NvbmZpZy5mb28uYmFyJywgMV0sXG5cdFx0XHRbJ2NvbmZpZy5mb28uZmxpcC5mbG9wJywgM10sXG5cdFx0KTtcblxuXHRcdC8vIGRlbGV0ZSBhIHNlZ21lbnRcblx0XHRtYXAuc2V0KCdjb25maWcuZm9vLmJhcicsIDEpO1xuXHRcdG1hcC5zZXQoJ2NvbmZpZy5mb28nLCAyKTtcblx0XHRtYXAuc2V0KCdjb25maWcuZm9vLmZsaXAuZmxvcCcsIDMpO1xuXHRcdG1hcC5zZXQoJ2NvbmZpZy5ib28nLCA0KTtcblx0XHRtYXAuZGVsZXRlU3VwZXJzdHIoJ2NvbmZpZy5mb28nKTtcblx0XHRhc3NlcnRUc3REZnMobWFwLFxuXHRcdFx0Wydib28nLCA0XSxcblx0XHRcdFsnY29uZmlnLmZvbycsIDJdLFxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RTVCwgZmlsbCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0c3QgPSBUZXJuYXJ5U2VhcmNoVHJlZS5mb3JTdHJpbmdzKCk7XG5cblx0XHRjb25zdCBrZXlzID0gWydmb28nLCAnYmFyJywgJ2JhbmcnLCAnYmF6eiddO1xuXHRcdE9iamVjdC5mcmVlemUoa2V5cyk7XG5cdFx0dHN0LmZpbGwodHJ1ZSwga2V5cyk7XG5cblx0XHRmb3IgKGNvbnN0IGtleSBvZiBrZXlzKSB7XG5cdFx0XHRhc3NlcnQub2sodHN0LmdldChrZXkpLCBrZXkpO1xuXHRcdH1cblx0fSk7XG59KTtcblxuXG5zdWl0ZS5za2lwKCdUU1QsIHBlcmYnLCBmdW5jdGlvbiAoKSB7XG5cblx0ZnVuY3Rpb24gY3JlYXRlUmFuZG9tVXJpcyhuOiBudW1iZXIpOiBVUklbXSB7XG5cdFx0Y29uc3QgdXJpczogVVJJW10gPSBbXTtcblx0XHRmdW5jdGlvbiByYW5kb21Xb3JkKCk6IHN0cmluZyB7XG5cdFx0XHRsZXQgcmVzdWx0ID0gJyc7XG5cdFx0XHRjb25zdCBsZW5ndGggPSA0ICsgTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogNCk7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdHJlc3VsdCArPSAoTWF0aC5yYW5kb20oKSAqIDI2ICsgNjUpLnRvU3RyaW5nKDM2KTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXG5cdFx0Ly8gZ2VuZXJhdGUgMTAwMDAgcmFuZG9tIHdvcmRzXG5cdFx0Y29uc3Qgd29yZHM6IHN0cmluZ1tdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAxMDAwMDsgaSsrKSB7XG5cdFx0XHR3b3Jkcy5wdXNoKHJhbmRvbVdvcmQoKSk7XG5cdFx0fVxuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBuOyBpKyspIHtcblxuXHRcdFx0bGV0IGxlbiA9IDQgKyBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiA0KTtcblxuXHRcdFx0Y29uc3Qgc2VnbWVudHM6IHN0cmluZ1tdID0gW107XG5cdFx0XHRmb3IgKDsgbGVuID49IDA7IGxlbi0tKSB7XG5cdFx0XHRcdHNlZ21lbnRzLnB1c2god29yZHNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogd29yZHMubGVuZ3RoKV0pO1xuXHRcdFx0fVxuXG5cdFx0XHR1cmlzLnB1c2goVVJJLmZyb20oeyBzY2hlbWU6ICdmaWxlJywgcGF0aDogc2VnbWVudHMuam9pbignLycpIH0pKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdXJpcztcblx0fVxuXG5cdGxldCB0cmVlOiBUZXJuYXJ5U2VhcmNoVHJlZTxVUkksIGJvb2xlYW4+O1xuXHRsZXQgc2FtcGxlVXJpczogVVJJW10gPSBbXTtcblx0bGV0IGNhbmRpZGF0ZXM6IFVSSVtdID0gW107XG5cblx0c3VpdGVTZXR1cCgoKSA9PiB7XG5cdFx0Y29uc3QgbGVuID0gNTBfMDAwO1xuXHRcdHNhbXBsZVVyaXMgPSBjcmVhdGVSYW5kb21VcmlzKGxlbik7XG5cdFx0Y2FuZGlkYXRlcyA9IFsuLi5zYW1wbGVVcmlzLnNsaWNlKDAsIGxlbiAvIDIpLCAuLi5jcmVhdGVSYW5kb21VcmlzKGxlbiAvIDIpXTtcblx0XHRzaHVmZmxlKGNhbmRpZGF0ZXMpO1xuXHR9KTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0dHJlZSA9IFRlcm5hcnlTZWFyY2hUcmVlLmZvclVyaXMoKTtcblx0XHRmb3IgKGNvbnN0IHVyaSBvZiBzYW1wbGVVcmlzKSB7XG5cdFx0XHR0cmVlLnNldCh1cmksIHRydWUpO1xuXHRcdH1cblx0fSk7XG5cblx0Y29uc3QgX3Byb2ZpbGUgPSBmYWxzZTtcblxuXHRmdW5jdGlvbiBwZXJmVGVzdChuYW1lOiBzdHJpbmcsIGNhbGxiYWNrOiBGdW5jdGlvbikge1xuXHRcdHRlc3QobmFtZSwgZnVuY3Rpb24gKCkge1xuXHRcdFx0aWYgKF9wcm9maWxlKSB7IGNvbnNvbGUucHJvZmlsZShuYW1lKTsgfVxuXHRcdFx0Y29uc3Qgc3cgPSBuZXcgU3RvcFdhdGNoKCk7XG5cdFx0XHRjYWxsYmFjaygpO1xuXHRcdFx0Y29uc29sZS5sb2cobmFtZSwgc3cuZWxhcHNlZCgpKTtcblx0XHRcdGlmIChfcHJvZmlsZSkgeyBjb25zb2xlLnByb2ZpbGVFbmQoKTsgfVxuXHRcdH0pO1xuXHR9XG5cblx0cGVyZlRlc3QoJ1RTVCwgY2xlYXInLCBmdW5jdGlvbiAoKSB7XG5cdFx0dHJlZS5jbGVhcigpO1xuXHR9KTtcblxuXHRwZXJmVGVzdCgnVFNULCBpbnNlcnQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaW5zZXJ0VHJlZSA9IFRlcm5hcnlTZWFyY2hUcmVlLmZvclVyaXMoKTtcblx0XHRmb3IgKGNvbnN0IHVyaSBvZiBzYW1wbGVVcmlzKSB7XG5cdFx0XHRpbnNlcnRUcmVlLnNldCh1cmksIHRydWUpO1xuXHRcdH1cblx0fSk7XG5cblx0cGVyZlRlc3QoJ1RTVCwgbG9va3VwJywgZnVuY3Rpb24gKCkge1xuXHRcdGxldCBtYXRjaCA9IDA7XG5cdFx0Zm9yIChjb25zdCBjYW5kaWRhdGUgb2YgY2FuZGlkYXRlcykge1xuXHRcdFx0aWYgKHRyZWUuaGFzKGNhbmRpZGF0ZSkpIHtcblx0XHRcdFx0bWF0Y2ggKz0gMTtcblx0XHRcdH1cblx0XHR9XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hdGNoLCBzYW1wbGVVcmlzLmxlbmd0aCAvIDIpO1xuXHR9KTtcblxuXHRwZXJmVGVzdCgnVFNULCBzdWJzdHInLCBmdW5jdGlvbiAoKSB7XG5cdFx0bGV0IG1hdGNoID0gMDtcblx0XHRmb3IgKGNvbnN0IGNhbmRpZGF0ZSBvZiBjYW5kaWRhdGVzKSB7XG5cdFx0XHRpZiAodHJlZS5maW5kU3Vic3RyKGNhbmRpZGF0ZSkpIHtcblx0XHRcdFx0bWF0Y2ggKz0gMTtcblx0XHRcdH1cblx0XHR9XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hdGNoLCBzYW1wbGVVcmlzLmxlbmd0aCAvIDIpO1xuXHR9KTtcblxuXHRwZXJmVGVzdCgnVFNULCBzdXBlcnN0cicsIGZ1bmN0aW9uICgpIHtcblx0XHRmb3IgKGNvbnN0IGNhbmRpZGF0ZSBvZiBjYW5kaWRhdGVzKSB7XG5cdFx0XHR0cmVlLmZpbmRTdXBlcnN0cihjYW5kaWRhdGUpO1xuXHRcdH1cblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxvQkFBb0IsY0FBYyxnQkFBZ0IsbUJBQW1CLG1CQUFtQjtBQUNqRyxTQUFTLFdBQVc7QUFDcEIsU0FBUywrQ0FBK0M7QUFFeEQsTUFBTSx1QkFBdUIsTUFBTTtBQUVsQywwQ0FBd0M7QUFFeEMsT0FBSyxnQkFBZ0IsTUFBTTtBQUMxQixVQUFNLE9BQU8sSUFBSSxhQUFhO0FBQzlCLFNBQUssTUFBTSwwQkFBMEI7QUFFckMsV0FBTyxZQUFZLEtBQUssTUFBTSxHQUFHLE9BQU87QUFDeEMsV0FBTyxZQUFZLEtBQUssUUFBUSxHQUFHLElBQUk7QUFDdkMsV0FBTyxZQUFZLEtBQUssSUFBSSxPQUFPLEdBQUcsQ0FBQztBQUN2QyxXQUFPLEdBQUcsS0FBSyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQzNCLFdBQU8sR0FBRyxLQUFLLElBQUksT0FBTyxJQUFJLENBQUM7QUFDL0IsV0FBTyxHQUFHLEtBQUssSUFBSSxHQUFHLElBQUksQ0FBQztBQUMzQixXQUFPLEdBQUcsS0FBSyxJQUFJLE9BQU8sSUFBSSxDQUFDO0FBRS9CLFNBQUssS0FBSztBQUNWLFdBQU8sWUFBWSxLQUFLLE1BQU0sR0FBRyxLQUFLO0FBQ3RDLFdBQU8sWUFBWSxLQUFLLFFBQVEsR0FBRyxJQUFJO0FBRXZDLFNBQUssS0FBSztBQUNWLFdBQU8sWUFBWSxLQUFLLE1BQU0sR0FBRyxLQUFLO0FBQ3RDLFdBQU8sWUFBWSxLQUFLLFFBQVEsR0FBRyxJQUFJO0FBRXZDLFNBQUssS0FBSztBQUNWLFdBQU8sWUFBWSxLQUFLLE1BQU0sR0FBRyxVQUFVO0FBQzNDLFdBQU8sWUFBWSxLQUFLLFFBQVEsR0FBRyxLQUFLO0FBRXhDLFNBQUssS0FBSztBQUNWLFdBQU8sWUFBWSxLQUFLLE1BQU0sR0FBRyxFQUFFO0FBQ25DLFdBQU8sWUFBWSxLQUFLLFFBQVEsR0FBRyxLQUFLO0FBQ3hDLFNBQUssS0FBSztBQUNWLFdBQU8sWUFBWSxLQUFLLE1BQU0sR0FBRyxFQUFFO0FBQ25DLFdBQU8sWUFBWSxLQUFLLFFBQVEsR0FBRyxLQUFLO0FBR3hDLFNBQUssTUFBTSxXQUFXO0FBQ3RCLFdBQU8sWUFBWSxLQUFLLE1BQU0sR0FBRyxLQUFLO0FBQ3RDLFdBQU8sWUFBWSxLQUFLLFFBQVEsR0FBRyxJQUFJO0FBRXZDLFNBQUssS0FBSztBQUNWLFdBQU8sWUFBWSxLQUFLLE1BQU0sR0FBRyxLQUFLO0FBQ3RDLFdBQU8sWUFBWSxLQUFLLFFBQVEsR0FBRyxLQUFLO0FBQUEsRUFDekMsQ0FBQztBQUVELE9BQUssZUFBZSxXQUFZO0FBQy9CLFVBQU0sT0FBTyxJQUFJLFlBQVksTUFBTSxPQUFPLE1BQU0sS0FBSztBQUNyRCxTQUFLLE1BQU0sSUFBSSxNQUFNLDBCQUEwQixDQUFDO0FBRWhELFdBQU8sWUFBWSxLQUFLLE1BQU0sR0FBRyxNQUFNO0FBRXZDLFdBQU8sWUFBWSxLQUFLLElBQUksTUFBTSxHQUFHLENBQUM7QUFDdEMsV0FBTyxZQUFZLEtBQUssUUFBUSxHQUFHLElBQUk7QUFDdkMsU0FBSyxLQUFLO0FBRVYsV0FBTyxZQUFZLEtBQUssTUFBTSxHQUFHLEtBQUs7QUFDdEMsV0FBTyxZQUFZLEtBQUssUUFBUSxHQUFHLElBQUk7QUFDdkMsU0FBSyxLQUFLO0FBRVYsV0FBTyxZQUFZLEtBQUssTUFBTSxHQUFHLEtBQUs7QUFDdEMsV0FBTyxZQUFZLEtBQUssUUFBUSxHQUFHLElBQUk7QUFDdkMsU0FBSyxLQUFLO0FBRVYsV0FBTyxZQUFZLEtBQUssTUFBTSxHQUFHLFVBQVU7QUFDM0MsV0FBTyxZQUFZLEtBQUssUUFBUSxHQUFHLEtBQUs7QUFHeEMsU0FBSyxNQUFNLElBQUksTUFBTSxtQ0FBbUMsQ0FBQztBQUd6RCxXQUFPLFlBQVksS0FBSyxNQUFNLEdBQUcsTUFBTTtBQUV2QyxXQUFPLFlBQVksS0FBSyxJQUFJLE1BQU0sR0FBRyxDQUFDO0FBQ3RDLFdBQU8sWUFBWSxLQUFLLFFBQVEsR0FBRyxJQUFJO0FBQ3ZDLFNBQUssS0FBSztBQUdWLFdBQU8sWUFBWSxLQUFLLE1BQU0sR0FBRyxPQUFPO0FBQ3hDLFdBQU8sWUFBWSxLQUFLLElBQUksT0FBTyxHQUFHLENBQUM7QUFDdkMsV0FBTyxZQUFZLEtBQUssUUFBUSxHQUFHLElBQUk7QUFDdkMsU0FBSyxLQUFLO0FBR1YsV0FBTyxZQUFZLEtBQUssTUFBTSxHQUFHLEtBQUs7QUFDdEMsV0FBTyxZQUFZLEtBQUssUUFBUSxHQUFHLElBQUk7QUFDdkMsU0FBSyxLQUFLO0FBR1YsV0FBTyxZQUFZLEtBQUssTUFBTSxHQUFHLEtBQUs7QUFDdEMsV0FBTyxZQUFZLEtBQUssUUFBUSxHQUFHLElBQUk7QUFDdkMsU0FBSyxLQUFLO0FBR1YsV0FBTyxZQUFZLEtBQUssTUFBTSxHQUFHLFVBQVU7QUFDM0MsV0FBTyxZQUFZLEtBQUssUUFBUSxHQUFHLElBQUk7QUFDdkMsU0FBSyxLQUFLO0FBR1YsV0FBTyxZQUFZLEtBQUssTUFBTSxHQUFHLEtBQUs7QUFDdEMsV0FBTyxZQUFZLEtBQUssSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJO0FBQzFDLFdBQU8sWUFBWSxLQUFLLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSTtBQUMxQyxXQUFPLFlBQVksS0FBSyxRQUFRLEdBQUcsS0FBSztBQUFBLEVBQ3pDLENBQUM7QUFFRCxPQUFLLHVDQUF1QyxXQUFZO0FBQ3ZELFVBQU0sT0FBTyxJQUFJLFlBQVksTUFBTSxPQUFPLE1BQU0sSUFBSTtBQUNwRCxTQUFLLE1BQU0sSUFBSSxNQUFNLDBCQUEwQixDQUFDO0FBRWhELFdBQU8sWUFBWSxLQUFLLE1BQU0sR0FBRyxNQUFNO0FBRXZDLFdBQU8sWUFBWSxLQUFLLElBQUksTUFBTSxHQUFHLENBQUM7QUFDdEMsV0FBTyxZQUFZLEtBQUssUUFBUSxHQUFHLElBQUk7QUFDdkMsU0FBSyxLQUFLO0FBRVYsV0FBTyxZQUFZLEtBQUssTUFBTSxHQUFHLEtBQUs7QUFDdEMsV0FBTyxZQUFZLEtBQUssUUFBUSxHQUFHLElBQUk7QUFDdkMsU0FBSyxLQUFLO0FBRVYsV0FBTyxZQUFZLEtBQUssTUFBTSxHQUFHLEtBQUs7QUFDdEMsV0FBTyxZQUFZLEtBQUssUUFBUSxHQUFHLElBQUk7QUFDdkMsU0FBSyxLQUFLO0FBRVYsV0FBTyxZQUFZLEtBQUssTUFBTSxHQUFHLFVBQVU7QUFDM0MsV0FBTyxZQUFZLEtBQUssUUFBUSxHQUFHLEtBQUs7QUFHeEMsU0FBSyxNQUFNLElBQUksTUFBTSxtQ0FBbUMsQ0FBQztBQUd6RCxXQUFPLFlBQVksS0FBSyxNQUFNLEdBQUcsTUFBTTtBQUV2QyxXQUFPLFlBQVksS0FBSyxJQUFJLE1BQU0sR0FBRyxDQUFDO0FBQ3RDLFdBQU8sWUFBWSxLQUFLLFFBQVEsR0FBRyxJQUFJO0FBQ3ZDLFNBQUssS0FBSztBQUdWLFdBQU8sWUFBWSxLQUFLLE1BQU0sR0FBRyxPQUFPO0FBQ3hDLFdBQU8sWUFBWSxLQUFLLElBQUksT0FBTyxHQUFHLENBQUM7QUFDdkMsV0FBTyxZQUFZLEtBQUssUUFBUSxHQUFHLElBQUk7QUFDdkMsU0FBSyxLQUFLO0FBR1YsV0FBTyxZQUFZLEtBQUssTUFBTSxHQUFHLEtBQUs7QUFDdEMsV0FBTyxZQUFZLEtBQUssUUFBUSxHQUFHLElBQUk7QUFDdkMsU0FBSyxLQUFLO0FBR1YsV0FBTyxZQUFZLEtBQUssTUFBTSxHQUFHLEtBQUs7QUFDdEMsV0FBTyxZQUFZLEtBQUssUUFBUSxHQUFHLElBQUk7QUFDdkMsU0FBSyxLQUFLO0FBR1YsV0FBTyxZQUFZLEtBQUssTUFBTSxHQUFHLFVBQVU7QUFDM0MsV0FBTyxZQUFZLEtBQUssUUFBUSxHQUFHLEtBQUs7QUFBQSxFQUN6QyxDQUFDO0FBRUQsV0FBUyxhQUFnQixTQUF1QyxVQUF5QjtBQUV4RixXQUFPLEdBQUcsS0FBSyxZQUFZLEdBQUcscUJBQXFCO0FBRW5ELFFBQUksSUFBSTtBQUNSLGVBQVcsQ0FBQyxLQUFLLEtBQUssS0FBSyxNQUFNO0FBQ2hDLFlBQU0sV0FBVyxTQUFTLEdBQUc7QUFDN0IsYUFBTyxHQUFHLFFBQVE7QUFDbEIsYUFBTyxZQUFZLEtBQUssU0FBUyxDQUFDLENBQUM7QUFDbkMsYUFBTyxZQUFZLE9BQU8sU0FBUyxDQUFDLENBQUM7QUFBQSxJQUN0QztBQUVBLFdBQU8sWUFBWSxHQUFHLFNBQVMsTUFBTTtBQUVyQyxVQUFNLE1BQU0sb0JBQUksSUFBZTtBQUMvQixlQUFXLENBQUMsS0FBSyxLQUFLLEtBQUssVUFBVTtBQUNwQyxVQUFJLElBQUksS0FBSyxLQUFLO0FBQUEsSUFDbkI7QUFDQSxRQUFJLFFBQVEsQ0FBQyxPQUFPLFFBQVE7QUFDM0IsYUFBTyxZQUFZLEtBQUssSUFBSSxHQUFHLEdBQUcsS0FBSztBQUFBLElBQ3hDLENBQUM7QUFHRCxRQUFJLGVBQWU7QUFDbkIsU0FBSyxRQUFRLENBQUMsU0FBUyxRQUFRO0FBQzlCLGFBQU8sWUFBWSxTQUFTLElBQUksSUFBSSxHQUFHLENBQUM7QUFDeEM7QUFBQSxJQUNELENBQUM7QUFDRCxXQUFPLFlBQVksSUFBSSxNQUFNLFlBQVk7QUFHekMsUUFBSSxZQUFZO0FBQ2hCLGVBQVcsQ0FBQyxLQUFLLEtBQUssS0FBSyxNQUFNO0FBQ2hDLGFBQU8sWUFBWSxPQUFPLElBQUksSUFBSSxHQUFHLENBQUM7QUFDdEM7QUFBQSxJQUNEO0FBQ0EsV0FBTyxZQUFZLElBQUksTUFBTSxTQUFTO0FBQUEsRUFFdkM7QUFFQSxPQUFLLDJCQUEyQixXQUFZO0FBRTNDLFFBQUksT0FBTyxrQkFBa0IsV0FBbUI7QUFDaEQsU0FBSyxJQUFJLFVBQVUsQ0FBQztBQUNwQixTQUFLLElBQUksVUFBVSxDQUFDO0FBRXBCLGlCQUFhLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBRS9DLFdBQU8sa0JBQWtCLFdBQW1CO0FBQzVDLFNBQUssSUFBSSxVQUFVLENBQUM7QUFDcEIsU0FBSyxJQUFJLFNBQVMsQ0FBQztBQUNuQixpQkFBYSxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUU5QyxXQUFPLGtCQUFrQixXQUFtQjtBQUM1QyxTQUFLLElBQUksT0FBTyxDQUFDO0FBQ2pCLFNBQUssSUFBSSxPQUFPLENBQUM7QUFDakIsaUJBQWEsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBRTdCLFdBQU8sa0JBQWtCLFdBQW1CO0FBQzVDLFNBQUssSUFBSSxPQUFPLENBQUM7QUFDakIsU0FBSyxJQUFJLFVBQVUsQ0FBQztBQUNwQixTQUFLLElBQUksT0FBTyxDQUFDO0FBQ2pCLFNBQUssSUFBSSxRQUFRLENBQUM7QUFDbEIsU0FBSyxJQUFJLFFBQVEsQ0FBQztBQUVsQjtBQUFBLE1BQWE7QUFBQSxNQUNaLENBQUMsT0FBTyxDQUFDO0FBQUEsTUFDVCxDQUFDLFFBQVEsQ0FBQztBQUFBLE1BQ1YsQ0FBQyxPQUFPLENBQUM7QUFBQSxNQUNULENBQUMsUUFBUSxDQUFDO0FBQUEsTUFDVixDQUFDLFVBQVUsQ0FBQztBQUFBLElBQ2I7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHdDQUF3QyxXQUFZO0FBRXhELFVBQU0sT0FBTyxrQkFBa0IsV0FBZ0I7QUFDL0MsU0FBSyxJQUFJLFVBQVUsTUFBUztBQUM1QixTQUFLLElBQUksVUFBVSxDQUFDO0FBRXBCLFdBQU8sWUFBWSxLQUFLLElBQUksUUFBUSxHQUFHLE1BQVM7QUFDaEQsV0FBTyxZQUFZLEtBQUssSUFBSSxRQUFRLEdBQUcsQ0FBQztBQUN4QyxXQUFPLFlBQVksS0FBSyxJQUFJLFVBQVUsR0FBRyxNQUFTO0FBRWxELFdBQU8sR0FBRyxLQUFLLElBQUksUUFBUSxDQUFDO0FBQzVCLFdBQU8sR0FBRyxLQUFLLElBQUksUUFBUSxDQUFDO0FBQzVCLFdBQU8sR0FBRyxDQUFDLEtBQUssSUFBSSxVQUFVLENBQUM7QUFFL0IsaUJBQWEsTUFBTSxDQUFDLFVBQVUsTUFBUyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7QUFFdkQsVUFBTSxXQUFXLEtBQUssSUFBSSxVQUFVLENBQUM7QUFDckMsV0FBTyxZQUFZLFVBQVUsTUFBUztBQUN0QyxXQUFPLFlBQVksS0FBSyxJQUFJLFFBQVEsR0FBRyxDQUFDO0FBQUEsRUFDekMsQ0FBQztBQUVELE9BQUssd0NBQXdDLFdBQVk7QUFFeEQsVUFBTSxPQUFPLGtCQUFrQixXQUFtQjtBQUNsRCxTQUFLLElBQUksT0FBTyxDQUFDO0FBQ2pCLFNBQUssSUFBSSxVQUFVLENBQUM7QUFDcEIsU0FBSyxJQUFJLFVBQVUsQ0FBQztBQUNwQixpQkFBYSxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBRTNELFdBQU8sWUFBWSxLQUFLLFdBQVcsR0FBRyxHQUFHLE1BQVM7QUFDbEQsV0FBTyxZQUFZLEtBQUssV0FBVyxHQUFHLEdBQUcsTUFBUztBQUNsRCxXQUFPLFlBQVksS0FBSyxXQUFXLEtBQUssR0FBRyxDQUFDO0FBQzVDLFdBQU8sWUFBWSxLQUFLLFdBQVcsU0FBTSxHQUFHLENBQUM7QUFDN0MsV0FBTyxZQUFZLEtBQUssV0FBVyxPQUFPLEdBQUcsQ0FBQztBQUM5QyxXQUFPLFlBQVksS0FBSyxXQUFXLFNBQVMsR0FBRyxDQUFDO0FBQ2hELFdBQU8sWUFBWSxLQUFLLFdBQVcsVUFBVSxHQUFHLENBQUM7QUFBQSxFQUNsRCxDQUFDO0FBRUQsT0FBSyw4QkFBOEIsV0FBWTtBQUM5QyxVQUFNLE9BQU8sSUFBSSxrQkFBa0MsSUFBSSxlQUFlLENBQUM7QUFFdkUsU0FBSyxJQUFJLE9BQU8sQ0FBQztBQUNqQixTQUFLLElBQUksT0FBTyxDQUFDO0FBQ2pCLFNBQUssSUFBSSxVQUFVLENBQUM7QUFDcEIsaUJBQWEsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQztBQUV4RCxXQUFPLFlBQVksS0FBSyxJQUFJLEtBQUssR0FBRyxDQUFDO0FBQ3JDLFdBQU8sWUFBWSxLQUFLLElBQUksS0FBSyxHQUFHLENBQUM7QUFDckMsV0FBTyxZQUFZLEtBQUssSUFBSSxRQUFRLEdBQUcsQ0FBQztBQUN4QyxXQUFPLFlBQVksS0FBSyxJQUFJLFFBQVEsR0FBRyxNQUFTO0FBQ2hELFdBQU8sWUFBWSxLQUFLLElBQUksU0FBUyxHQUFHLE1BQVM7QUFFakQsV0FBTyxZQUFZLEtBQUssV0FBVyxJQUFJLEdBQUcsTUFBUztBQUNuRCxXQUFPLFlBQVksS0FBSyxXQUFXLEtBQUssR0FBRyxDQUFDO0FBQzVDLFdBQU8sWUFBWSxLQUFLLFdBQVcsT0FBTyxHQUFHLENBQUM7QUFHOUMsU0FBSyxPQUFPLFFBQVE7QUFDcEIsU0FBSyxPQUFPLEtBQUs7QUFDakIsV0FBTyxZQUFZLEtBQUssSUFBSSxRQUFRLEdBQUcsTUFBUztBQUNoRCxXQUFPLFlBQVksS0FBSyxJQUFJLEtBQUssR0FBRyxNQUFTO0FBRTdDLFNBQUssSUFBSSxVQUFVLEVBQUU7QUFDckIsU0FBSyxJQUFJLFFBQVEsRUFBRTtBQUNuQixXQUFPLFlBQVksS0FBSyxJQUFJLFFBQVEsR0FBRyxFQUFFO0FBQ3pDLFdBQU8sWUFBWSxLQUFLLElBQUksTUFBTSxHQUFHLEVBQUU7QUFDdkMsV0FBTyxZQUFZLEtBQUssSUFBSSxLQUFLLEdBQUcsTUFBUztBQUFBLEVBQzlDLENBQUM7QUFFRCxPQUFLLHdDQUF3QyxXQUFZO0FBRXhELFFBQUksT0FBTyxJQUFJLGtCQUFrQyxJQUFJLGVBQWUsQ0FBQztBQUNyRSxTQUFLLElBQUksT0FBTyxDQUFDO0FBQ2pCLFNBQUssSUFBSSxVQUFVLENBQUM7QUFDcEIsU0FBSyxJQUFJLE9BQU8sQ0FBQztBQUNqQixpQkFBYSxNQUFNLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQ3hELFNBQUssT0FBTyxLQUFLO0FBQ2pCLGlCQUFhLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0FBQzVDLFNBQUssT0FBTyxRQUFRO0FBQ3BCLGlCQUFhLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUc3QixXQUFPLElBQUksa0JBQWtDLElBQUksZUFBZSxDQUFDO0FBQ2pFLFNBQUssSUFBSSxPQUFPLENBQUM7QUFDakIsU0FBSyxJQUFJLFVBQVUsQ0FBQztBQUNwQixTQUFLLElBQUksT0FBTyxDQUFDO0FBQ2pCLFNBQUssSUFBSSxhQUFhLENBQUM7QUFDdkIsU0FBSyxlQUFlLEtBQUs7QUFDekIsaUJBQWEsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7QUFFekMsV0FBTyxJQUFJLGtCQUFrQyxJQUFJLGVBQWUsQ0FBQztBQUNqRSxTQUFLLElBQUksT0FBTyxDQUFDO0FBQ2pCLFNBQUssSUFBSSxVQUFVLENBQUM7QUFDcEIsU0FBSyxJQUFJLE9BQU8sQ0FBQztBQUNqQixTQUFLLElBQUksYUFBYSxDQUFDO0FBQ3ZCLFNBQUssZUFBZSxJQUFJO0FBQ3hCLGlCQUFhLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUFBLEVBUTlCLENBQUM7QUFFRCxPQUFLLDZDQUE2QyxXQUFZO0FBQzdELFVBQU0sT0FBTyxJQUFJLGtCQUFrQyxJQUFJLGFBQWEsQ0FBQztBQUVyRSxTQUFLLElBQUksaUJBQWlCLENBQUM7QUFDM0IsU0FBSyxJQUFJLGFBQWEsQ0FBQztBQUN2QixTQUFLLElBQUksdUJBQXVCLENBQUM7QUFFakMsV0FBTyxZQUFZLEtBQUssSUFBSSxlQUFlLEdBQUcsQ0FBQztBQUMvQyxXQUFPLFlBQVksS0FBSyxJQUFJLFdBQVcsR0FBRyxDQUFDO0FBQzNDLFdBQU8sWUFBWSxLQUFLLElBQUksWUFBWSxHQUFHLENBQUM7QUFDNUMsV0FBTyxZQUFZLEtBQUssSUFBSSxZQUFZLEdBQUcsQ0FBQztBQUM1QyxXQUFPLFlBQVksS0FBSyxJQUFJLHFCQUFxQixHQUFHLENBQUM7QUFFckQsV0FBTyxZQUFZLEtBQUssV0FBVyxXQUFXLEdBQUcsTUFBUztBQUMxRCxXQUFPLFlBQVksS0FBSyxXQUFXLFdBQVcsR0FBRyxDQUFDO0FBQ2xELFdBQU8sWUFBWSxLQUFLLFdBQVcsYUFBYSxHQUFHLENBQUM7QUFDcEQsV0FBTyxZQUFZLEtBQUssV0FBVyxZQUFZLEdBQUcsQ0FBQztBQUNuRCxXQUFPLFlBQVksS0FBSyxXQUFXLGNBQWMsR0FBRyxDQUFDO0FBQ3JELFdBQU8sWUFBWSxLQUFLLFdBQVcsbUJBQW1CLEdBQUcsQ0FBQztBQUMxRCxXQUFPLFlBQVksS0FBSyxXQUFXLGVBQWUsR0FBRyxDQUFDO0FBQ3RELFdBQU8sWUFBWSxLQUFLLFdBQVcsdUJBQXVCLEdBQUcsQ0FBQztBQUFBLEVBQy9ELENBQUM7QUFFRCxPQUFLLGlDQUFpQyxXQUFZO0FBQ2pEO0FBRUMsWUFBTSxPQUFPLElBQUksa0JBQWtDLElBQUksYUFBYSxDQUFDO0FBQ3JFLFdBQUssSUFBSSxVQUFVLENBQUM7QUFDcEIsV0FBSyxJQUFJLFVBQVUsQ0FBQztBQUNwQixXQUFLLElBQUksVUFBVSxDQUFDO0FBQ3BCLG1CQUFhLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7QUFBQSxJQUMvRDtBQUVBO0FBRUMsWUFBTSxPQUFPLElBQUksa0JBQWtDLElBQUksYUFBYSxDQUFDO0FBQ3JFLFdBQUssSUFBSSxjQUFjLENBQUM7QUFDeEIsV0FBSyxJQUFJLGNBQWMsQ0FBQztBQUN4QixXQUFLLElBQUksY0FBYyxDQUFDO0FBQ3hCLG1CQUFhLE1BQU0sQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7QUFBQSxJQUMzRTtBQUVBO0FBRUMsWUFBTSxPQUFPLElBQUksa0JBQWtDLElBQUksYUFBYSxDQUFDO0FBQ3JFLFdBQUssSUFBSSxVQUFVLENBQUM7QUFDcEIsV0FBSyxJQUFJLFVBQVUsQ0FBQztBQUNwQixXQUFLLElBQUksVUFBVSxDQUFDO0FBQ3BCLG1CQUFhLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLENBQUM7QUFBQSxJQUMvRDtBQUVBO0FBRUMsWUFBTSxPQUFPLElBQUksa0JBQWtDLElBQUksYUFBYSxDQUFDO0FBQ3JFLFdBQUssSUFBSSxjQUFjLENBQUM7QUFDeEIsV0FBSyxJQUFJLGNBQWMsQ0FBQztBQUN4QixXQUFLLElBQUksY0FBYyxDQUFDO0FBQ3hCLG1CQUFhLE1BQU0sQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLENBQUM7QUFBQSxJQUMzRTtBQUVBO0FBRUMsWUFBTSxPQUFPLElBQUksa0JBQWtDLElBQUksYUFBYSxDQUFDO0FBQ3JFLFdBQUssSUFBSSxVQUFVLENBQUM7QUFDcEIsV0FBSyxJQUFJLFVBQVUsQ0FBQztBQUNwQixXQUFLLElBQUksVUFBVSxFQUFFO0FBQ3JCLFdBQUssSUFBSSxVQUFVLEVBQUU7QUFDckIsV0FBSyxJQUFJLFVBQVUsRUFBRTtBQUNyQixXQUFLLElBQUksVUFBVSxFQUFFO0FBQ3JCLG1CQUFhLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxVQUFVLEVBQUUsR0FBRyxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUM7QUFBQSxJQUNoSDtBQUVBO0FBRUMsWUFBTSxPQUFPLElBQUksa0JBQWtDLElBQUksYUFBYSxDQUFDO0FBQ3JFLFdBQUssSUFBSSxVQUFVLEVBQUU7QUFDckIsV0FBSyxJQUFJLFVBQVUsRUFBRTtBQUNyQixXQUFLLElBQUksVUFBVSxFQUFFO0FBQ3JCLFdBQUssSUFBSSxVQUFVLENBQUM7QUFDcEIsV0FBSyxJQUFJLFVBQVUsQ0FBQztBQUNwQixXQUFLLElBQUksVUFBVSxDQUFDO0FBQ3BCLG1CQUFhLE1BQU0sQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxHQUFHLENBQUMsVUFBVSxFQUFFLENBQUM7QUFBQSxJQUMvRztBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssb0NBQW9DLFdBQVk7QUFFcEQsVUFBTSxPQUFPLElBQUksa0JBQWtDLElBQUksZUFBZSxDQUFDO0FBR3ZFLFNBQUssSUFBSSxLQUFLLENBQUM7QUFDZixpQkFBYSxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDM0IsU0FBSyxPQUFPLEdBQUc7QUFDZixpQkFBYSxJQUFJO0FBR2pCLFNBQUssTUFBTTtBQUNYLFNBQUssSUFBSSxLQUFLLENBQUM7QUFDZixTQUFLLElBQUksS0FBSyxDQUFDO0FBQ2YsU0FBSyxJQUFJLEtBQUssQ0FBQztBQUNmLGlCQUFhLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7QUFDL0MsU0FBSyxPQUFPLEdBQUc7QUFDZixpQkFBYSxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUdyQyxTQUFLLE1BQU07QUFDWCxTQUFLLElBQUksS0FBSyxDQUFDO0FBQ2YsU0FBSyxJQUFJLEtBQUssQ0FBQztBQUNmLFNBQUssSUFBSSxLQUFLLENBQUM7QUFDZixTQUFLLElBQUksS0FBSyxDQUFDO0FBQ2YsaUJBQWEsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ3pELFNBQUssT0FBTyxHQUFHO0FBQ2YsaUJBQWEsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUFBLEVBQ2hELENBQUM7QUFFRCxPQUFLLG9DQUFvQyxXQUFZO0FBRXBELFVBQU0sT0FBTyxJQUFJLGtCQUFrQyxJQUFJLGVBQWUsQ0FBQztBQUV2RSxTQUFLLE1BQU07QUFDWCxTQUFLLElBQUksS0FBSyxDQUFDO0FBQ2YsU0FBSyxJQUFJLEtBQUssQ0FBQztBQUNmLFNBQUssSUFBSSxLQUFLLENBQUM7QUFDZixTQUFLLElBQUksS0FBSyxDQUFDO0FBQ2YsU0FBSyxJQUFJLEtBQUssQ0FBQztBQUNmLGlCQUFhLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBR25FLFNBQUssT0FBTyxHQUFHO0FBQ2YsaUJBQWEsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBRXpELFNBQUssTUFBTTtBQUNYLFNBQUssSUFBSSxLQUFLLENBQUM7QUFDZixTQUFLLElBQUksS0FBSyxDQUFDO0FBQ2YsU0FBSyxJQUFJLEtBQUssQ0FBQztBQUNmLFNBQUssSUFBSSxLQUFLLENBQUM7QUFDZixTQUFLLElBQUksS0FBSyxDQUFDO0FBQ2YsaUJBQWEsTUFBTSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7QUFHbkUsU0FBSyxPQUFPLEdBQUc7QUFDZixpQkFBYSxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUM7QUFHekQsU0FBSyxNQUFNO0FBQ1gsU0FBSyxJQUFJLEtBQUssQ0FBQztBQUNmLFNBQUssSUFBSSxNQUFNLENBQUM7QUFDaEIsU0FBSyxJQUFJLE1BQU0sQ0FBQztBQUNoQixTQUFLLElBQUksTUFBTSxDQUFDO0FBQ2hCLFNBQUssSUFBSSxNQUFNLENBQUM7QUFDaEIsU0FBSyxJQUFJLE1BQU0sQ0FBQztBQUNoQixpQkFBYSxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBRWxGLFNBQUssT0FBTyxJQUFJO0FBQ2hCLGlCQUFhLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBRXZFLFNBQUssT0FBTyxHQUFHO0FBQ2YsaUJBQWEsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQUEsRUFDOUQsQ0FBQztBQUVELE9BQUssb0VBQXNFLFdBQVk7QUFFdEYsVUFBTSxPQUFPO0FBQUEsTUFDWixJQUFJLE1BQU0sWUFBWTtBQUFBLE1BQ3RCLElBQUksTUFBTSxZQUFZO0FBQUEsTUFDdEIsSUFBSSxNQUFNLFlBQVk7QUFBQSxNQUN0QixJQUFJLE1BQU0sWUFBWTtBQUFBLElBQ3ZCO0FBRUEsVUFBTSxNQUFNLGtCQUFrQixRQUFpQjtBQUUvQyxlQUFXLFFBQVEsTUFBTTtBQUN4QixVQUFJLElBQUksTUFBTSxJQUFJO0FBQUEsSUFDbkI7QUFFQSxXQUFPLEdBQUcsSUFBSSxZQUFZLENBQUM7QUFDM0IsUUFBSSxPQUFPLEtBQUssQ0FBQyxDQUFDO0FBQ2xCLFdBQU8sR0FBRyxJQUFJLFlBQVksQ0FBQztBQUFBLEVBQzVCLENBQUM7QUFFRCxPQUFLLDZFQUErRSxXQUFZO0FBRS9GLFVBQU0sT0FBTyxDQUFDLEtBQUssS0FBSyxLQUFLLEdBQUk7QUFDakMsVUFBTSxNQUFNLGtCQUFrQixXQUFvQjtBQUNsRCxlQUFXLFFBQVEsTUFBTTtBQUN4QixVQUFJLElBQUksTUFBTSxJQUFJO0FBQUEsSUFDbkI7QUFDQSxpQkFBYSxLQUFLLENBQUMsS0FBSyxJQUFJLEdBQUcsQ0FBQyxLQUFLLElBQUksR0FBRyxDQUFDLEtBQUssSUFBSSxHQUFHLENBQUMsS0FBSyxJQUFJLENBQUM7QUFFcEUsUUFBSSxPQUFPLEtBQUssQ0FBQyxDQUFDO0FBQ2xCLGlCQUFhLEtBQUssQ0FBQyxLQUFLLElBQUksR0FBRyxDQUFDLEtBQUssSUFBSSxHQUFHLENBQUMsS0FBSyxJQUFJLENBQUM7QUFFdkQ7QUFDQyxZQUFNQSxPQUFNLGtCQUFrQixXQUFvQjtBQUNsRCxNQUFBQSxLQUFJLElBQUksS0FBSyxJQUFJO0FBQ2pCLE1BQUFBLEtBQUksSUFBSSxLQUFLLElBQUk7QUFDakIsTUFBQUEsS0FBSSxJQUFJLEtBQUssSUFBSTtBQUNqQixtQkFBYUEsTUFBSyxDQUFDLEtBQUssSUFBSSxHQUFHLENBQUMsS0FBSyxJQUFJLEdBQUcsQ0FBQyxLQUFLLElBQUksQ0FBQztBQUFBLElBQ3hEO0FBQUEsRUFFRCxDQUFDO0FBRUQsT0FBSyw2RUFBK0UsV0FBWTtBQUMvRixhQUFTLFFBQVEsSUFBSSxTQUFTLEdBQUcsU0FBUztBQUN6QyxZQUFNLE9BQWMsQ0FBQztBQUNyQixlQUFTLElBQUksR0FBRyxJQUFJLEtBQUssS0FBSztBQUM3QixhQUFLLEtBQUssSUFBSSxLQUFLLEVBQUUsUUFBUSxXQUFXLE1BQU0sV0FBVyxRQUFXLFFBQVcsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUFBLE1BQ3RGO0FBQ0EsWUFBTSxNQUFNLGtCQUFrQixRQUFpQjtBQUUvQyxVQUFJO0FBQ0gsbUJBQVcsUUFBUSxNQUFNO0FBQ3hCLGNBQUksSUFBSSxNQUFNLElBQUk7QUFDbEIsaUJBQU8sR0FBRyxJQUFJLFlBQVksR0FBRyxNQUFNLElBQUksSUFBSSxLQUFLLElBQUksTUFBTSxFQUFFLEtBQUssQ0FBQyxFQUFFO0FBQUEsUUFDckU7QUFFQSxtQkFBVyxRQUFRLE1BQU07QUFDeEIsY0FBSSxPQUFPLElBQUk7QUFDZixpQkFBTyxHQUFHLElBQUksWUFBWSxHQUFHLE1BQU0sSUFBSSxJQUFJLEtBQUssSUFBSSxNQUFNLEVBQUUsS0FBSyxDQUFDLEVBQUU7QUFBQSxRQUNyRTtBQUFBLE1BQ0QsU0FBUyxLQUFLO0FBQ2IsZUFBTyxHQUFHLE9BQU8scUJBQXFCLEtBQUssSUFBSSxNQUFNLEVBQUUsS0FBSyxDQUFDLEVBQUU7QUFBQSxNQUNoRTtBQUFBLElBQ0Q7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLCtGQUFpRyxXQUFZO0FBQ2pILFVBQU0sTUFBTTtBQUNaLFVBQU0sUUFBUSxJQUFJLE1BQU0sR0FBRztBQUMzQixVQUFNLFNBQTZCLENBQUM7QUFDcEMsYUFBUyxJQUFJLEdBQUcsSUFBSSxNQUFNLFFBQVEsS0FBSyxHQUFHO0FBQ3pDLGFBQU8sS0FBSyxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQU0sSUFBSSxDQUFDLENBQUMsQ0FBQztBQUFBLElBQ3JDO0FBRUEsVUFBTSxNQUFNLGtCQUFrQixjQUFzQjtBQUNwRCxRQUFJLEtBQUssTUFBTTtBQUVmLFdBQU8sWUFBWSxDQUFDLEdBQUcsR0FBRyxFQUFFLEtBQUssR0FBRyxHQUFHO0FBQ3ZDLFdBQU8sR0FBRyxJQUFJLElBQUksZ0NBQWdDLENBQUM7QUFFbkQsVUFBTSxNQUFNLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFDckIsUUFBSSxPQUFPLGdDQUFnQztBQUMzQyxXQUFPLEdBQUcsSUFBSSxZQUFZLENBQUM7QUFDM0IsV0FBTyxZQUFZLENBQUMsR0FBRyxHQUFHLEVBQUUsUUFBUSxNQUFNLENBQUM7QUFBQSxFQUM1QyxDQUFDO0FBRUQsT0FBSywrRkFBaUcsV0FBWTtBQUNqSCxVQUFNLE1BQU07QUFDWixVQUFNLFFBQVEsSUFBSSxNQUFNLEdBQUc7QUFDM0IsVUFBTSxTQUE2QixDQUFDO0FBQ3BDLGFBQVMsSUFBSSxHQUFHLElBQUksTUFBTSxRQUFRLEtBQUssR0FBRztBQUN6QyxhQUFPLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUM7QUFBQSxJQUNyQztBQUVBLGFBQVMsUUFBUSxLQUFLLFNBQVMsR0FBRyxTQUFTO0FBQzFDLGNBQVEsTUFBTTtBQUNkLFlBQU0sTUFBTSxrQkFBa0IsY0FBc0I7QUFDcEQsVUFBSSxLQUFLLE1BQU07QUFFZixhQUFPLFlBQVksQ0FBQyxHQUFHLEdBQUcsRUFBRSxLQUFLLEdBQUcsR0FBRztBQUN2QyxhQUFPLEdBQUcsSUFBSSxJQUFJLGdDQUFnQyxDQUFDO0FBRW5ELFlBQU0sTUFBTSxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQ3JCLFVBQUksT0FBTyxnQ0FBZ0M7QUFDM0MsYUFBTyxHQUFHLElBQUksWUFBWSxDQUFDO0FBQzNCLGFBQU8sWUFBWSxDQUFDLEdBQUcsR0FBRyxFQUFFLFFBQVEsTUFBTSxDQUFDO0FBQUEsSUFDNUM7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDZDQUE2QyxXQUFZO0FBRTdELFVBQU0sTUFBTSxJQUFJLGtCQUFrQyxJQUFJLGFBQWEsQ0FBQztBQUNwRSxRQUFJLElBQUksaUJBQWlCLENBQUM7QUFDMUIsUUFBSSxJQUFJLGFBQWEsQ0FBQztBQUN0QixRQUFJLElBQUksdUJBQXVCLENBQUM7QUFFaEMsV0FBTyxZQUFZLElBQUksSUFBSSxNQUFNLEdBQUcsTUFBUztBQUM3QyxXQUFPLFlBQVksSUFBSSxJQUFJLE9BQU8sR0FBRyxNQUFTO0FBQzlDLFdBQU8sWUFBWSxJQUFJLElBQUksV0FBVyxHQUFHLENBQUM7QUFDMUMsV0FBTyxZQUFZLElBQUksSUFBSSxlQUFlLEdBQUcsQ0FBQztBQUM5QyxXQUFPLFlBQVksSUFBSSxJQUFJLG1CQUFtQixHQUFHLE1BQVM7QUFBQSxFQUMzRCxDQUFDO0FBRUQsT0FBSywrQ0FBK0MsV0FBWTtBQUUvRCxVQUFNLE1BQU0sSUFBSSxrQkFBa0MsSUFBSSxhQUFhLENBQUM7QUFDcEUsUUFBSSxJQUFJLGlCQUFpQixDQUFDO0FBQzFCLFFBQUksSUFBSSxhQUFhLENBQUM7QUFDdEIsUUFBSSxJQUFJLHVCQUF1QixDQUFDO0FBQ2hDLFFBQUksSUFBSSxZQUFZLENBQUM7QUFFckIsUUFBSTtBQUNKLFFBQUksT0FBTyxJQUFJLGFBQWEsT0FBTztBQUVuQyxXQUFPLEtBQU0sS0FBSztBQUNsQixXQUFPLFlBQVksS0FBSyxNQUFNLENBQUMsR0FBRyxDQUFDO0FBQ25DLFdBQU8sWUFBWSxLQUFLLE1BQU0sS0FBSztBQUNuQyxXQUFPLEtBQU0sS0FBSztBQUNsQixXQUFPLFlBQVksS0FBSyxNQUFNLENBQUMsR0FBRyxDQUFDO0FBQ25DLFdBQU8sWUFBWSxLQUFLLE1BQU0sS0FBSztBQUNuQyxXQUFPLEtBQU0sS0FBSztBQUNsQixXQUFPLFlBQVksS0FBSyxNQUFNLENBQUMsR0FBRyxDQUFDO0FBQ25DLFdBQU8sWUFBWSxLQUFLLE1BQU0sS0FBSztBQUNuQyxXQUFPLEtBQU0sS0FBSztBQUNsQixXQUFPLFlBQVksS0FBSyxPQUFPLE1BQVM7QUFDeEMsV0FBTyxZQUFZLEtBQUssTUFBTSxJQUFJO0FBRWxDLFdBQU8sSUFBSSxhQUFhLE1BQU07QUFDOUIsV0FBTyxLQUFNLEtBQUs7QUFDbEIsV0FBTyxZQUFZLEtBQUssTUFBTSxDQUFDLEdBQUcsQ0FBQztBQUNuQyxXQUFPLFlBQVksS0FBSyxNQUFNLEtBQUs7QUFFbkMsV0FBTyxLQUFNLEtBQUs7QUFDbEIsV0FBTyxZQUFZLEtBQUssT0FBTyxNQUFTO0FBQ3hDLFdBQU8sWUFBWSxLQUFLLE1BQU0sSUFBSTtBQUVsQyxXQUFPLFlBQVksSUFBSSxhQUFhLE1BQU0sR0FBRyxNQUFTO0FBQ3RELFdBQU8sWUFBWSxJQUFJLGFBQWEsS0FBSyxHQUFHLE1BQVM7QUFDckQsV0FBTyxZQUFZLElBQUksYUFBYSxPQUFPLEdBQUcsTUFBUztBQUN2RCxXQUFPLFlBQVksSUFBSSxhQUFhLFFBQVEsR0FBRyxNQUFTO0FBQUEsRUFDekQsQ0FBQztBQUdELE9BQUssc0RBQXNELFdBQVk7QUFFdEUsVUFBTSxNQUFNLElBQUksa0JBQWtDLElBQUksYUFBYSxDQUFDO0FBQ3BFLFFBQUksSUFBSSxpQkFBaUIsQ0FBQztBQUMxQixRQUFJLElBQUksYUFBYSxDQUFDO0FBQ3RCLFFBQUksSUFBSSx1QkFBdUIsQ0FBQztBQUNoQyxRQUFJLElBQUksWUFBWSxDQUFDO0FBRXJCO0FBQUEsTUFBYTtBQUFBLE1BQ1osQ0FBQyxhQUFhLENBQUM7QUFBQSxNQUNmLENBQUMsaUJBQWlCLENBQUM7QUFBQSxNQUNuQixDQUFDLHVCQUF1QixDQUFDO0FBQUEsTUFDekIsQ0FBQyxZQUFZLENBQUM7QUFBQSxJQUNmO0FBR0EsUUFBSSxlQUFlLFVBQVU7QUFDN0I7QUFBQSxNQUFhO0FBQUEsTUFDWixDQUFDLGFBQWEsQ0FBQztBQUFBLE1BQ2YsQ0FBQyxpQkFBaUIsQ0FBQztBQUFBLE1BQ25CLENBQUMsdUJBQXVCLENBQUM7QUFBQSxNQUN6QixDQUFDLFlBQVksQ0FBQztBQUFBLElBQ2Y7QUFHQSxRQUFJLElBQUksaUJBQWlCLENBQUM7QUFDMUIsUUFBSSxJQUFJLGFBQWEsQ0FBQztBQUN0QixRQUFJLElBQUksdUJBQXVCLENBQUM7QUFDaEMsUUFBSSxJQUFJLFlBQVksQ0FBQztBQUNyQixRQUFJLGVBQWUsV0FBVztBQUM5QjtBQUFBLE1BQWE7QUFBQSxNQUNaLENBQUMsYUFBYSxDQUFDO0FBQUEsTUFDZixDQUFDLFlBQVksQ0FBQztBQUFBLElBQ2Y7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLG9DQUFvQyxXQUFZO0FBQ3BELFVBQU0sT0FBTyxJQUFJLGtCQUErQixJQUFJLFlBQVksTUFBTSxPQUFPLE1BQU0sS0FBSyxDQUFDO0FBRXpGLFNBQUssSUFBSSxJQUFJLEtBQUssZUFBZSxHQUFHLENBQUM7QUFDckMsU0FBSyxJQUFJLElBQUksS0FBSyxXQUFXLEdBQUcsQ0FBQztBQUNqQyxTQUFLLElBQUksSUFBSSxLQUFLLHFCQUFxQixHQUFHLENBQUM7QUFFM0MsV0FBTyxZQUFZLEtBQUssSUFBSSxJQUFJLEtBQUssZUFBZSxDQUFDLEdBQUcsQ0FBQztBQUN6RCxXQUFPLFlBQVksS0FBSyxJQUFJLElBQUksS0FBSyxXQUFXLENBQUMsR0FBRyxDQUFDO0FBQ3JELFdBQU8sWUFBWSxLQUFLLElBQUksSUFBSSxLQUFLLHFCQUFxQixDQUFDLEdBQUcsQ0FBQztBQUUvRCxXQUFPLFlBQVksS0FBSyxXQUFXLElBQUksS0FBSyxXQUFXLENBQUMsR0FBRyxNQUFTO0FBQ3BFLFdBQU8sWUFBWSxLQUFLLFdBQVcsSUFBSSxLQUFLLFdBQVcsQ0FBQyxHQUFHLENBQUM7QUFDNUQsV0FBTyxZQUFZLEtBQUssV0FBVyxJQUFJLEtBQUssY0FBYyxDQUFDLEdBQUcsQ0FBQztBQUMvRCxXQUFPLFlBQVksS0FBSyxXQUFXLElBQUksS0FBSyxtQkFBbUIsQ0FBQyxHQUFHLENBQUM7QUFDcEUsV0FBTyxZQUFZLEtBQUssV0FBVyxJQUFJLEtBQUssZUFBZSxDQUFDLEdBQUcsQ0FBQztBQUNoRSxXQUFPLFlBQVksS0FBSyxXQUFXLElBQUksS0FBSyx1QkFBdUIsQ0FBQyxHQUFHLENBQUM7QUFBQSxFQUN6RSxDQUFDO0FBRUQsT0FBSyw4Q0FBOEMsV0FBWTtBQUM5RCxVQUFNLE9BQU8sSUFBSSxrQkFBK0IsSUFBSSxZQUFZLE1BQU0sT0FBTyxNQUFNLElBQUksQ0FBQztBQUN4RixVQUFNLE9BQU8sSUFBSSxNQUFNLGlCQUFpQjtBQUN4QyxTQUFLLElBQUksTUFBTSxDQUFDO0FBRWhCLFdBQU8sWUFBWSxLQUFLLElBQUksSUFBSSxNQUFNLGlCQUFpQixDQUFDLEdBQUcsQ0FBQztBQUU1RCxXQUFPLFlBQVksS0FBSyxXQUFXLElBQUksTUFBTSxpQkFBaUIsQ0FBQyxHQUFHLENBQUM7QUFDbkUsV0FBTyxZQUFZLEtBQUssV0FBVyxJQUFJLE1BQU0sb0JBQW9CLENBQUMsR0FBRyxDQUFDO0FBQUEsRUFDdkUsQ0FBQztBQUVELE9BQUssb0NBQW9DLFdBQVk7QUFFcEQsVUFBTSxNQUFNLElBQUksa0JBQStCLElBQUksWUFBWSxNQUFNLE9BQU8sTUFBTSxLQUFLLENBQUM7QUFDeEYsUUFBSSxJQUFJLElBQUksTUFBTSw2QkFBNkIsR0FBRyxDQUFDO0FBQ25ELFFBQUksSUFBSSxJQUFJLE1BQU0sK0JBQStCLEdBQUcsQ0FBQztBQUNyRCxRQUFJLElBQUksSUFBSSxNQUFNLCtCQUErQixHQUFHLENBQUM7QUFDckQsUUFBSSxJQUFJLElBQUksTUFBTSxtQ0FBbUMsR0FBRyxDQUFDO0FBRXpELFdBQU8sWUFBWSxJQUFJLElBQUksSUFBSSxNQUFNLG9CQUFvQixDQUFDLEdBQUcsTUFBUztBQUN0RSxXQUFPLFlBQVksSUFBSSxJQUFJLElBQUksTUFBTSxxQkFBcUIsQ0FBQyxHQUFHLE1BQVM7QUFDdkUsV0FBTyxZQUFZLElBQUksSUFBSSxJQUFJLE1BQU0sNkJBQTZCLENBQUMsR0FBRyxDQUFDO0FBQ3ZFLFdBQU8sWUFBWSxJQUFJLElBQUksSUFBSSxNQUFNLCtCQUErQixDQUFDLEdBQUcsQ0FBQztBQUN6RSxXQUFPLFlBQVksSUFBSSxJQUFJLElBQUksTUFBTSwrQkFBK0IsQ0FBQyxHQUFHLE1BQVM7QUFDakYsV0FBTyxZQUFZLElBQUksSUFBSSxJQUFJLE1BQU0sK0JBQStCLENBQUMsR0FBRyxDQUFDO0FBQ3pFLFdBQU8sWUFBWSxJQUFJLElBQUksSUFBSSxNQUFNLGlDQUFpQyxDQUFDLEdBQUcsTUFBUztBQUFBLEVBQ3BGLENBQUM7QUFFRCxPQUFLLDRDQUE0QyxXQUFZO0FBRTVELFVBQU0sTUFBTSxJQUFJLGtCQUErQixJQUFJLFlBQVksU0FBTyxXQUFXLEtBQUssSUFBSSxNQUFNLEdBQUcsTUFBTSxLQUFLLENBQUM7QUFDL0csUUFBSSxJQUFJLElBQUksTUFBTSw2QkFBNkIsR0FBRyxDQUFDO0FBQ25ELFdBQU8sWUFBWSxJQUFJLElBQUksSUFBSSxNQUFNLDZCQUE2QixDQUFDLEdBQUcsQ0FBQztBQUV2RSxRQUFJLElBQUksSUFBSSxNQUFNLDRCQUE0QixHQUFHLENBQUM7QUFDbEQsV0FBTyxZQUFZLElBQUksSUFBSSxJQUFJLE1BQU0sNEJBQTRCLENBQUMsR0FBRyxNQUFTO0FBQUEsRUFDL0UsQ0FBQztBQUVELE9BQUssc0NBQXNDLFdBQVk7QUFFdEQsVUFBTSxNQUFNLElBQUksa0JBQStCLElBQUksWUFBWSxNQUFNLE9BQU8sTUFBTSxLQUFLLENBQUM7QUFDeEYsUUFBSSxJQUFJLElBQUksS0FBSyxlQUFlLEdBQUcsQ0FBQztBQUNwQyxRQUFJLElBQUksSUFBSSxLQUFLLFdBQVcsR0FBRyxDQUFDO0FBQ2hDLFFBQUksSUFBSSxJQUFJLEtBQUsscUJBQXFCLEdBQUcsQ0FBQztBQUMxQyxRQUFJLElBQUksSUFBSSxLQUFLLFVBQVUsR0FBRyxDQUFDO0FBRS9CLFFBQUk7QUFDSixRQUFJLE9BQU8sSUFBSSxhQUFhLElBQUksS0FBSyxPQUFPLENBQUM7QUFFN0MsV0FBTyxLQUFLLEtBQUs7QUFDakIsV0FBTyxZQUFZLEtBQUssTUFBTSxDQUFDLEdBQUcsQ0FBQztBQUNuQyxXQUFPLFlBQVksS0FBSyxNQUFNLEtBQUs7QUFDbkMsV0FBTyxLQUFLLEtBQUs7QUFDakIsV0FBTyxZQUFZLEtBQUssTUFBTSxDQUFDLEdBQUcsQ0FBQztBQUNuQyxXQUFPLFlBQVksS0FBSyxNQUFNLEtBQUs7QUFDbkMsV0FBTyxLQUFLLEtBQUs7QUFDakIsV0FBTyxZQUFZLEtBQUssTUFBTSxDQUFDLEdBQUcsQ0FBQztBQUNuQyxXQUFPLFlBQVksS0FBSyxNQUFNLEtBQUs7QUFDbkMsV0FBTyxLQUFLLEtBQUs7QUFDakIsV0FBTyxZQUFZLEtBQUssT0FBTyxNQUFTO0FBQ3hDLFdBQU8sWUFBWSxLQUFLLE1BQU0sSUFBSTtBQUVsQyxXQUFPLElBQUksYUFBYSxJQUFJLEtBQUssTUFBTSxDQUFDO0FBQ3hDLFdBQU8sS0FBSyxLQUFLO0FBQ2pCLFdBQU8sWUFBWSxLQUFLLE1BQU0sQ0FBQyxHQUFHLENBQUM7QUFDbkMsV0FBTyxZQUFZLEtBQUssTUFBTSxLQUFLO0FBRW5DLFdBQU8sS0FBSyxLQUFLO0FBQ2pCLFdBQU8sWUFBWSxLQUFLLE9BQU8sTUFBUztBQUN4QyxXQUFPLFlBQVksS0FBSyxNQUFNLElBQUk7QUFFbEMsV0FBTyxJQUFJLGFBQWEsSUFBSSxLQUFLLEdBQUcsQ0FBQztBQUNyQyxXQUFPLEtBQUssS0FBSztBQUNqQixXQUFPLFlBQVksS0FBSyxNQUFNLENBQUMsR0FBRyxDQUFDO0FBQ25DLFdBQU8sWUFBWSxLQUFLLE1BQU0sS0FBSztBQUNuQyxXQUFPLEtBQUssS0FBSztBQUNqQixXQUFPLFlBQVksS0FBSyxNQUFNLENBQUMsR0FBRyxDQUFDO0FBQ25DLFdBQU8sWUFBWSxLQUFLLE1BQU0sS0FBSztBQUNuQyxXQUFPLEtBQUssS0FBSztBQUNqQixXQUFPLFlBQVksS0FBSyxNQUFNLENBQUMsR0FBRyxDQUFDO0FBQ25DLFdBQU8sWUFBWSxLQUFLLE1BQU0sS0FBSztBQUNuQyxXQUFPLEtBQUssS0FBSztBQUNqQixXQUFPLFlBQVksS0FBSyxNQUFNLENBQUMsR0FBRyxDQUFDO0FBQ25DLFdBQU8sWUFBWSxLQUFLLE1BQU0sS0FBSztBQUNuQyxXQUFPLEtBQUssS0FBSztBQUNqQixXQUFPLFlBQVksS0FBSyxPQUFPLE1BQVM7QUFDeEMsV0FBTyxZQUFZLEtBQUssTUFBTSxJQUFJO0FBRWxDLFdBQU8sWUFBWSxJQUFJLGFBQWEsSUFBSSxLQUFLLE1BQU0sQ0FBQyxHQUFHLE1BQVM7QUFDaEUsV0FBTyxZQUFZLElBQUksYUFBYSxJQUFJLEtBQUssS0FBSyxDQUFDLEdBQUcsTUFBUztBQUMvRCxXQUFPLFlBQVksSUFBSSxhQUFhLElBQUksS0FBSyxPQUFPLENBQUMsR0FBRyxNQUFTO0FBQ2pFLFdBQU8sWUFBWSxJQUFJLGFBQWEsSUFBSSxLQUFLLFFBQVEsQ0FBQyxHQUFHLE1BQVM7QUFBQSxFQUNuRSxDQUFDO0FBRUQsT0FBSyxrREFBa0QsV0FBWTtBQUNsRSxVQUFNLE9BQU8sSUFBSSxrQkFBa0MsSUFBSSxtQkFBbUIsQ0FBQztBQUUzRSxTQUFLLElBQUksa0JBQWtCLENBQUM7QUFDNUIsU0FBSyxJQUFJLGNBQWMsQ0FBQztBQUN4QixTQUFLLElBQUksd0JBQXdCLENBQUM7QUFFbEMsV0FBTyxZQUFZLEtBQUssSUFBSSxnQkFBZ0IsR0FBRyxDQUFDO0FBQ2hELFdBQU8sWUFBWSxLQUFLLElBQUksWUFBWSxHQUFHLENBQUM7QUFDNUMsV0FBTyxZQUFZLEtBQUssSUFBSSxzQkFBc0IsR0FBRyxDQUFDO0FBRXRELFdBQU8sWUFBWSxLQUFLLFdBQVcsWUFBWSxHQUFHLE1BQVM7QUFDM0QsV0FBTyxZQUFZLEtBQUssV0FBVyxZQUFZLEdBQUcsQ0FBQztBQUNuRCxXQUFPLFlBQVksS0FBSyxXQUFXLGVBQWUsR0FBRyxDQUFDO0FBQ3RELFdBQU8sWUFBWSxLQUFLLFdBQVcsb0JBQW9CLEdBQUcsQ0FBQztBQUMzRCxXQUFPLFlBQVksS0FBSyxXQUFXLGdCQUFnQixHQUFHLENBQUM7QUFDdkQsV0FBTyxZQUFZLEtBQUssV0FBVyx3QkFBd0IsR0FBRyxDQUFDO0FBQUEsRUFDaEUsQ0FBQztBQUVELE9BQUssa0RBQWtELFdBQVk7QUFFbEUsVUFBTSxNQUFNLElBQUksa0JBQWtDLElBQUksbUJBQW1CLENBQUM7QUFDMUUsUUFBSSxJQUFJLGtCQUFrQixDQUFDO0FBQzNCLFFBQUksSUFBSSxjQUFjLENBQUM7QUFDdkIsUUFBSSxJQUFJLHdCQUF3QixDQUFDO0FBRWpDLFdBQU8sWUFBWSxJQUFJLElBQUksS0FBSyxHQUFHLE1BQVM7QUFDNUMsV0FBTyxZQUFZLElBQUksSUFBSSxRQUFRLEdBQUcsTUFBUztBQUMvQyxXQUFPLFlBQVksSUFBSSxJQUFJLFlBQVksR0FBRyxDQUFDO0FBQzNDLFdBQU8sWUFBWSxJQUFJLElBQUksZ0JBQWdCLEdBQUcsQ0FBQztBQUMvQyxXQUFPLFlBQVksSUFBSSxJQUFJLG9CQUFvQixHQUFHLE1BQVM7QUFBQSxFQUM1RCxDQUFDO0FBRUQsT0FBSyxvREFBb0QsV0FBWTtBQUVwRSxVQUFNLE1BQU0sSUFBSSxrQkFBa0MsSUFBSSxtQkFBbUIsQ0FBQztBQUMxRSxRQUFJLElBQUksa0JBQWtCLENBQUM7QUFDM0IsUUFBSSxJQUFJLGNBQWMsQ0FBQztBQUN2QixRQUFJLElBQUksd0JBQXdCLENBQUM7QUFDakMsUUFBSSxJQUFJLE9BQU8sQ0FBQztBQUVoQixRQUFJO0FBQ0osVUFBTSxPQUFPLElBQUksYUFBYSxRQUFRO0FBRXRDLFdBQU8sS0FBTSxLQUFLO0FBQ2xCLFdBQU8sWUFBWSxLQUFLLE1BQU0sQ0FBQyxHQUFHLENBQUM7QUFDbkMsV0FBTyxZQUFZLEtBQUssTUFBTSxLQUFLO0FBQ25DLFdBQU8sS0FBTSxLQUFLO0FBQ2xCLFdBQU8sWUFBWSxLQUFLLE1BQU0sQ0FBQyxHQUFHLENBQUM7QUFDbkMsV0FBTyxZQUFZLEtBQUssTUFBTSxLQUFLO0FBQ25DLFdBQU8sS0FBTSxLQUFLO0FBQ2xCLFdBQU8sWUFBWSxLQUFLLE1BQU0sQ0FBQyxHQUFHLENBQUM7QUFDbkMsV0FBTyxZQUFZLEtBQUssTUFBTSxLQUFLO0FBQ25DLFdBQU8sS0FBTSxLQUFLO0FBQ2xCLFdBQU8sWUFBWSxLQUFLLE9BQU8sTUFBUztBQUN4QyxXQUFPLFlBQVksS0FBSyxNQUFNLElBQUk7QUFFbEMsV0FBTyxZQUFZLElBQUksYUFBYSxLQUFLLEdBQUcsTUFBUztBQUNyRCxXQUFPLFlBQVksSUFBSSxhQUFhLGVBQWUsR0FBRyxNQUFTO0FBQy9ELFdBQU8sWUFBWSxJQUFJLGFBQWEsYUFBYSxHQUFHLE1BQVM7QUFBQSxFQUM5RCxDQUFDO0FBR0QsT0FBSywyREFBMkQsV0FBWTtBQUUzRSxVQUFNLE1BQU0sSUFBSSxrQkFBa0MsSUFBSSxtQkFBbUIsQ0FBQztBQUMxRSxRQUFJLElBQUksa0JBQWtCLENBQUM7QUFDM0IsUUFBSSxJQUFJLGNBQWMsQ0FBQztBQUN2QixRQUFJLElBQUksd0JBQXdCLENBQUM7QUFDakMsUUFBSSxJQUFJLE9BQU8sQ0FBQztBQUVoQjtBQUFBLE1BQWE7QUFBQSxNQUNaLENBQUMsT0FBTyxDQUFDO0FBQUEsTUFDVCxDQUFDLGNBQWMsQ0FBQztBQUFBLE1BQ2hCLENBQUMsa0JBQWtCLENBQUM7QUFBQSxNQUNwQixDQUFDLHdCQUF3QixDQUFDO0FBQUEsSUFDM0I7QUFHQSxRQUFJLGVBQWUsV0FBVztBQUM5QjtBQUFBLE1BQWE7QUFBQSxNQUNaLENBQUMsT0FBTyxDQUFDO0FBQUEsTUFDVCxDQUFDLGNBQWMsQ0FBQztBQUFBLE1BQ2hCLENBQUMsa0JBQWtCLENBQUM7QUFBQSxNQUNwQixDQUFDLHdCQUF3QixDQUFDO0FBQUEsSUFDM0I7QUFHQSxRQUFJLElBQUksa0JBQWtCLENBQUM7QUFDM0IsUUFBSSxJQUFJLGNBQWMsQ0FBQztBQUN2QixRQUFJLElBQUksd0JBQXdCLENBQUM7QUFDakMsUUFBSSxJQUFJLGNBQWMsQ0FBQztBQUN2QixRQUFJLGVBQWUsWUFBWTtBQUMvQjtBQUFBLE1BQWE7QUFBQSxNQUNaLENBQUMsT0FBTyxDQUFDO0FBQUEsTUFDVCxDQUFDLGNBQWMsQ0FBQztBQUFBLElBQ2pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxhQUFhLFdBQVk7QUFDN0IsVUFBTSxNQUFNLGtCQUFrQixXQUFXO0FBRXpDLFVBQU0sT0FBTyxDQUFDLE9BQU8sT0FBTyxRQUFRLE1BQU07QUFDMUMsV0FBTyxPQUFPLElBQUk7QUFDbEIsUUFBSSxLQUFLLE1BQU0sSUFBSTtBQUVuQixlQUFXLE9BQU8sTUFBTTtBQUN2QixhQUFPLEdBQUcsSUFBSSxJQUFJLEdBQUcsR0FBRyxHQUFHO0FBQUEsSUFDNUI7QUFBQSxFQUNELENBQUM7QUFDRixDQUFDO0FBR0QsTUFBTSxLQUFLLGFBQWEsV0FBWTtBQUVuQyxXQUFTLGlCQUFpQixHQUFrQjtBQUMzQyxVQUFNLE9BQWMsQ0FBQztBQUNyQixhQUFTLGFBQXFCO0FBQzdCLFVBQUksU0FBUztBQUNiLFlBQU0sU0FBUyxJQUFJLEtBQUssTUFBTSxLQUFLLE9BQU8sSUFBSSxDQUFDO0FBQy9DLGVBQVMsSUFBSSxHQUFHLElBQUksUUFBUSxLQUFLO0FBQ2hDLG1CQUFXLEtBQUssT0FBTyxJQUFJLEtBQUssSUFBSSxTQUFTLEVBQUU7QUFBQSxNQUNoRDtBQUNBLGFBQU87QUFBQSxJQUNSO0FBR0EsVUFBTSxRQUFrQixDQUFDO0FBQ3pCLGFBQVMsSUFBSSxHQUFHLElBQUksS0FBTyxLQUFLO0FBQy9CLFlBQU0sS0FBSyxXQUFXLENBQUM7QUFBQSxJQUN4QjtBQUVBLGFBQVMsSUFBSSxHQUFHLElBQUksR0FBRyxLQUFLO0FBRTNCLFVBQUksTUFBTSxJQUFJLEtBQUssTUFBTSxLQUFLLE9BQU8sSUFBSSxDQUFDO0FBRTFDLFlBQU0sV0FBcUIsQ0FBQztBQUM1QixhQUFPLE9BQU8sR0FBRyxPQUFPO0FBQ3ZCLGlCQUFTLEtBQUssTUFBTSxLQUFLLE1BQU0sS0FBSyxPQUFPLElBQUksTUFBTSxNQUFNLENBQUMsQ0FBQztBQUFBLE1BQzlEO0FBRUEsV0FBSyxLQUFLLElBQUksS0FBSyxFQUFFLFFBQVEsUUFBUSxNQUFNLFNBQVMsS0FBSyxHQUFHLEVBQUUsQ0FBQyxDQUFDO0FBQUEsSUFDakU7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUVBLE1BQUk7QUFDSixNQUFJLGFBQW9CLENBQUM7QUFDekIsTUFBSSxhQUFvQixDQUFDO0FBRXpCLGFBQVcsTUFBTTtBQUNoQixVQUFNLE1BQU07QUFDWixpQkFBYSxpQkFBaUIsR0FBRztBQUNqQyxpQkFBYSxDQUFDLEdBQUcsV0FBVyxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsR0FBRyxpQkFBaUIsTUFBTSxDQUFDLENBQUM7QUFDM0UsWUFBUSxVQUFVO0FBQUEsRUFDbkIsQ0FBQztBQUVELFFBQU0sTUFBTTtBQUNYLFdBQU8sa0JBQWtCLFFBQVE7QUFDakMsZUFBVyxPQUFPLFlBQVk7QUFDN0IsV0FBSyxJQUFJLEtBQUssSUFBSTtBQUFBLElBQ25CO0FBQUEsRUFDRCxDQUFDO0FBRUQsUUFBTSxXQUFXO0FBRWpCLFdBQVMsU0FBUyxNQUFjLFVBQW9CO0FBQ25ELFNBQUssTUFBTSxXQUFZO0FBQ3RCLFVBQUksVUFBVTtBQUFFLGdCQUFRLFFBQVEsSUFBSTtBQUFBLE1BQUc7QUFDdkMsWUFBTSxLQUFLLElBQUksVUFBVTtBQUN6QixlQUFTO0FBQ1QsY0FBUSxJQUFJLE1BQU0sR0FBRyxRQUFRLENBQUM7QUFDOUIsVUFBSSxVQUFVO0FBQUUsZ0JBQVEsV0FBVztBQUFBLE1BQUc7QUFBQSxJQUN2QyxDQUFDO0FBQUEsRUFDRjtBQUVBLFdBQVMsY0FBYyxXQUFZO0FBQ2xDLFNBQUssTUFBTTtBQUFBLEVBQ1osQ0FBQztBQUVELFdBQVMsZUFBZSxXQUFZO0FBQ25DLFVBQU0sYUFBYSxrQkFBa0IsUUFBUTtBQUM3QyxlQUFXLE9BQU8sWUFBWTtBQUM3QixpQkFBVyxJQUFJLEtBQUssSUFBSTtBQUFBLElBQ3pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsV0FBUyxlQUFlLFdBQVk7QUFDbkMsUUFBSSxRQUFRO0FBQ1osZUFBVyxhQUFhLFlBQVk7QUFDbkMsVUFBSSxLQUFLLElBQUksU0FBUyxHQUFHO0FBQ3hCLGlCQUFTO0FBQUEsTUFDVjtBQUFBLElBQ0Q7QUFDQSxXQUFPLFlBQVksT0FBTyxXQUFXLFNBQVMsQ0FBQztBQUFBLEVBQ2hELENBQUM7QUFFRCxXQUFTLGVBQWUsV0FBWTtBQUNuQyxRQUFJLFFBQVE7QUFDWixlQUFXLGFBQWEsWUFBWTtBQUNuQyxVQUFJLEtBQUssV0FBVyxTQUFTLEdBQUc7QUFDL0IsaUJBQVM7QUFBQSxNQUNWO0FBQUEsSUFDRDtBQUNBLFdBQU8sWUFBWSxPQUFPLFdBQVcsU0FBUyxDQUFDO0FBQUEsRUFDaEQsQ0FBQztBQUVELFdBQVMsaUJBQWlCLFdBQVk7QUFDckMsZUFBVyxhQUFhLFlBQVk7QUFDbkMsV0FBSyxhQUFhLFNBQVM7QUFBQSxJQUM1QjtBQUFBLEVBQ0QsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbInRzdCJdCn0K
