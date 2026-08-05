import assert from "assert";
import { URI } from "../../../../base/common/uri.js";
import * as types from "../../common/extHostTypes.js";
import { isWindows } from "../../../../base/common/platform.js";
import { assertType } from "../../../../base/common/types.js";
import { Mimes } from "../../../../base/common/mime.js";
import { MarshalledId } from "../../../../base/common/marshallingIds.js";
import { CancellationError } from "../../../../base/common/errors.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
function assertToJSON(a, expected) {
  const raw = JSON.stringify(a);
  const actual = JSON.parse(raw);
  assert.deepStrictEqual(actual, expected);
}
suite("ExtHostTypes", function() {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("URI, toJSON", function() {
    const uri = URI.parse("file:///path/test.file");
    assert.deepStrictEqual(uri.toJSON(), {
      $mid: MarshalledId.Uri,
      scheme: "file",
      path: "/path/test.file"
    });
    assert.ok(uri.fsPath);
    assert.deepStrictEqual(uri.toJSON(), {
      $mid: MarshalledId.Uri,
      scheme: "file",
      path: "/path/test.file",
      fsPath: "/path/test.file".replace(/\//g, isWindows ? "\\" : "/"),
      _sep: isWindows ? 1 : void 0
    });
    assert.ok(uri.toString());
    assert.deepStrictEqual(uri.toJSON(), {
      $mid: MarshalledId.Uri,
      scheme: "file",
      path: "/path/test.file",
      fsPath: "/path/test.file".replace(/\//g, isWindows ? "\\" : "/"),
      _sep: isWindows ? 1 : void 0,
      external: "file:///path/test.file"
    });
  });
  test("Disposable", () => {
    let count = 0;
    const d = new types.Disposable(() => {
      count += 1;
      return 12;
    });
    d.dispose();
    assert.strictEqual(count, 1);
    d.dispose();
    assert.strictEqual(count, 1);
    types.Disposable.from(void 0, { dispose() {
      count += 1;
    } }).dispose();
    assert.strictEqual(count, 2);
    assert.throws(() => {
      new types.Disposable(() => {
        throw new Error();
      }).dispose();
    });
    new types.Disposable(void 0).dispose();
  });
  test("Position", () => {
    assert.throws(() => new types.Position(-1, 0));
    assert.throws(() => new types.Position(0, -1));
    const pos = new types.Position(0, 0);
    assert.throws(() => pos.line = -1);
    assert.throws(() => pos.character = -1);
    assert.throws(() => pos.line = 12);
    const { line, character } = pos.toJSON();
    assert.strictEqual(line, 0);
    assert.strictEqual(character, 0);
  });
  test("Position, toJSON", function() {
    const pos = new types.Position(4, 2);
    assertToJSON(pos, { line: 4, character: 2 });
  });
  test("Position, isBefore(OrEqual)?", function() {
    const p1 = new types.Position(1, 3);
    const p2 = new types.Position(1, 2);
    const p3 = new types.Position(0, 4);
    assert.ok(p1.isBeforeOrEqual(p1));
    assert.ok(!p1.isBefore(p1));
    assert.ok(p2.isBefore(p1));
    assert.ok(p3.isBefore(p2));
  });
  test("Position, isAfter(OrEqual)?", function() {
    const p1 = new types.Position(1, 3);
    const p2 = new types.Position(1, 2);
    const p3 = new types.Position(0, 4);
    assert.ok(p1.isAfterOrEqual(p1));
    assert.ok(!p1.isAfter(p1));
    assert.ok(p1.isAfter(p2));
    assert.ok(p2.isAfter(p3));
    assert.ok(p1.isAfter(p3));
  });
  test("Position, compareTo", function() {
    const p1 = new types.Position(1, 3);
    const p2 = new types.Position(1, 2);
    const p3 = new types.Position(0, 4);
    assert.strictEqual(p1.compareTo(p1), 0);
    assert.strictEqual(p2.compareTo(p1), -1);
    assert.strictEqual(p1.compareTo(p2), 1);
    assert.strictEqual(p2.compareTo(p3), 1);
    assert.strictEqual(p1.compareTo(p3), 1);
  });
  test("Position, translate", function() {
    const p1 = new types.Position(1, 3);
    assert.ok(p1.translate() === p1);
    assert.ok(p1.translate({}) === p1);
    assert.ok(p1.translate(0, 0) === p1);
    assert.ok(p1.translate(0) === p1);
    assert.ok(p1.translate(void 0, 0) === p1);
    assert.ok(p1.translate(void 0) === p1);
    let res = p1.translate(-1);
    assert.strictEqual(res.line, 0);
    assert.strictEqual(res.character, 3);
    res = p1.translate({ lineDelta: -1 });
    assert.strictEqual(res.line, 0);
    assert.strictEqual(res.character, 3);
    res = p1.translate(void 0, -1);
    assert.strictEqual(res.line, 1);
    assert.strictEqual(res.character, 2);
    res = p1.translate({ characterDelta: -1 });
    assert.strictEqual(res.line, 1);
    assert.strictEqual(res.character, 2);
    res = p1.translate(11);
    assert.strictEqual(res.line, 12);
    assert.strictEqual(res.character, 3);
    assert.throws(() => p1.translate(null));
    assert.throws(() => p1.translate(null, null));
    assert.throws(() => p1.translate(-2));
    assert.throws(() => p1.translate({ lineDelta: -2 }));
    assert.throws(() => p1.translate(-2, null));
    assert.throws(() => p1.translate(0, -4));
  });
  test("Position, with", function() {
    const p1 = new types.Position(1, 3);
    assert.ok(p1.with() === p1);
    assert.ok(p1.with(1) === p1);
    assert.ok(p1.with(void 0, 3) === p1);
    assert.ok(p1.with(1, 3) === p1);
    assert.ok(p1.with(void 0) === p1);
    assert.ok(p1.with({ line: 1 }) === p1);
    assert.ok(p1.with({ character: 3 }) === p1);
    assert.ok(p1.with({ line: 1, character: 3 }) === p1);
    const p2 = p1.with({ line: 0, character: 11 });
    assert.strictEqual(p2.line, 0);
    assert.strictEqual(p2.character, 11);
    assert.throws(() => p1.with(null));
    assert.throws(() => p1.with(-9));
    assert.throws(() => p1.with(0, -9));
    assert.throws(() => p1.with({ line: -1 }));
    assert.throws(() => p1.with({ character: -1 }));
  });
  test("Range", () => {
    assert.throws(() => new types.Range(-1, 0, 0, 0));
    assert.throws(() => new types.Range(0, -1, 0, 0));
    assert.throws(() => new types.Range(new types.Position(0, 0), void 0));
    assert.throws(() => new types.Range(new types.Position(0, 0), null));
    assert.throws(() => new types.Range(void 0, new types.Position(0, 0)));
    assert.throws(() => new types.Range(null, new types.Position(0, 0)));
    const range = new types.Range(1, 0, 0, 0);
    assert.throws(() => {
      range.start = null;
    });
    assert.throws(() => {
      range.start = new types.Position(0, 3);
    });
  });
  test("Range, toJSON", function() {
    const range = new types.Range(1, 2, 3, 4);
    assertToJSON(range, [{ line: 1, character: 2 }, { line: 3, character: 4 }]);
  });
  test("Range, sorting", function() {
    let range = new types.Range(1, 0, 0, 0);
    assert.strictEqual(range.start.line, 0);
    assert.strictEqual(range.end.line, 1);
    range = new types.Range(0, 0, 1, 0);
    assert.strictEqual(range.start.line, 0);
    assert.strictEqual(range.end.line, 1);
  });
  test("Range, isEmpty|isSingleLine", function() {
    let range = new types.Range(1, 0, 0, 0);
    assert.ok(!range.isEmpty);
    assert.ok(!range.isSingleLine);
    range = new types.Range(1, 1, 1, 1);
    assert.ok(range.isEmpty);
    assert.ok(range.isSingleLine);
    range = new types.Range(0, 1, 0, 11);
    assert.ok(!range.isEmpty);
    assert.ok(range.isSingleLine);
    range = new types.Range(0, 0, 1, 1);
    assert.ok(!range.isEmpty);
    assert.ok(!range.isSingleLine);
  });
  test("Range, contains", function() {
    const range = new types.Range(1, 1, 2, 11);
    assert.ok(range.contains(range.start));
    assert.ok(range.contains(range.end));
    assert.ok(range.contains(range));
    assert.ok(!range.contains(new types.Range(1, 0, 2, 11)));
    assert.ok(!range.contains(new types.Range(0, 1, 2, 11)));
    assert.ok(!range.contains(new types.Range(1, 1, 2, 12)));
    assert.ok(!range.contains(new types.Range(1, 1, 3, 11)));
  });
  test("Range, contains (no instanceof)", function() {
    const range = new types.Range(1, 1, 2, 11);
    const startLike = { line: range.start.line, character: range.start.character };
    const endLike = { line: range.end.line, character: range.end.character };
    const rangeLike = { start: startLike, end: endLike };
    assert.ok(range.contains(startLike));
    assert.ok(range.contains(endLike));
    assert.ok(range.contains(rangeLike));
  });
  test("Range, intersection", function() {
    const range = new types.Range(1, 1, 2, 11);
    let res;
    res = range.intersection(range);
    assert.strictEqual(res.start.line, 1);
    assert.strictEqual(res.start.character, 1);
    assert.strictEqual(res.end.line, 2);
    assert.strictEqual(res.end.character, 11);
    res = range.intersection(new types.Range(2, 12, 4, 0));
    assert.strictEqual(res, void 0);
    res = range.intersection(new types.Range(0, 0, 1, 0));
    assert.strictEqual(res, void 0);
    res = range.intersection(new types.Range(0, 0, 1, 1));
    assert.ok(res.isEmpty);
    assert.strictEqual(res.start.line, 1);
    assert.strictEqual(res.start.character, 1);
    res = range.intersection(new types.Range(2, 11, 61, 1));
    assert.ok(res.isEmpty);
    assert.strictEqual(res.start.line, 2);
    assert.strictEqual(res.start.character, 11);
    assert.throws(() => range.intersection(null));
    assert.throws(() => range.intersection(void 0));
  });
  test("Range, union", function() {
    let ran1 = new types.Range(0, 0, 5, 5);
    assert.ok(ran1.union(new types.Range(0, 0, 1, 1)) === ran1);
    let res;
    res = ran1.union(new types.Range(2, 2, 9, 9));
    assert.ok(res.start === ran1.start);
    assert.strictEqual(res.end.line, 9);
    assert.strictEqual(res.end.character, 9);
    ran1 = new types.Range(2, 1, 5, 3);
    res = ran1.union(new types.Range(1, 0, 4, 2));
    assert.ok(res.end === ran1.end);
    assert.strictEqual(res.start.line, 1);
    assert.strictEqual(res.start.character, 0);
  });
  test("Range, with", function() {
    const range = new types.Range(1, 1, 2, 11);
    assert.ok(range.with(range.start) === range);
    assert.ok(range.with(void 0, range.end) === range);
    assert.ok(range.with(range.start, range.end) === range);
    assert.ok(range.with(new types.Position(1, 1)) === range);
    assert.ok(range.with(void 0, new types.Position(2, 11)) === range);
    assert.ok(range.with() === range);
    assert.ok(range.with({ start: range.start }) === range);
    assert.ok(range.with({ start: new types.Position(1, 1) }) === range);
    assert.ok(range.with({ end: range.end }) === range);
    assert.ok(range.with({ end: new types.Position(2, 11) }) === range);
    let res = range.with(void 0, new types.Position(9, 8));
    assert.strictEqual(res.end.line, 9);
    assert.strictEqual(res.end.character, 8);
    assert.strictEqual(res.start.line, 1);
    assert.strictEqual(res.start.character, 1);
    res = range.with({ end: new types.Position(9, 8) });
    assert.strictEqual(res.end.line, 9);
    assert.strictEqual(res.end.character, 8);
    assert.strictEqual(res.start.line, 1);
    assert.strictEqual(res.start.character, 1);
    res = range.with({ end: new types.Position(9, 8), start: new types.Position(2, 3) });
    assert.strictEqual(res.end.line, 9);
    assert.strictEqual(res.end.character, 8);
    assert.strictEqual(res.start.line, 2);
    assert.strictEqual(res.start.character, 3);
    assert.throws(() => range.with(null));
    assert.throws(() => range.with(void 0, null));
  });
  test("TextEdit", () => {
    const range = new types.Range(1, 1, 2, 11);
    let edit = new types.TextEdit(range, void 0);
    assert.strictEqual(edit.newText, "");
    assertToJSON(edit, { range: [{ line: 1, character: 1 }, { line: 2, character: 11 }], newText: "" });
    edit = new types.TextEdit(range, null);
    assert.strictEqual(edit.newText, "");
    edit = new types.TextEdit(range, "");
    assert.strictEqual(edit.newText, "");
  });
  test("WorkspaceEdit", () => {
    const a = URI.file("a.ts");
    const b = URI.file("b.ts");
    const edit = new types.WorkspaceEdit();
    assert.ok(!edit.has(a));
    edit.set(a, [types.TextEdit.insert(new types.Position(0, 0), "fff")]);
    assert.ok(edit.has(a));
    assert.strictEqual(edit.size, 1);
    assertToJSON(edit, [[a.toJSON(), [{ range: [{ line: 0, character: 0 }, { line: 0, character: 0 }], newText: "fff" }]]]);
    edit.insert(b, new types.Position(1, 1), "fff");
    edit.delete(b, new types.Range(0, 0, 0, 0));
    assert.ok(edit.has(b));
    assert.strictEqual(edit.size, 2);
    assertToJSON(edit, [
      [a.toJSON(), [{ range: [{ line: 0, character: 0 }, { line: 0, character: 0 }], newText: "fff" }]],
      [b.toJSON(), [{ range: [{ line: 1, character: 1 }, { line: 1, character: 1 }], newText: "fff" }, { range: [{ line: 0, character: 0 }, { line: 0, character: 0 }], newText: "" }]]
    ]);
    edit.set(b, void 0);
    assert.ok(!edit.has(b));
    assert.strictEqual(edit.size, 1);
    edit.set(b, [types.TextEdit.insert(new types.Position(0, 0), "ffff")]);
    assert.strictEqual(edit.get(b).length, 1);
  });
  test("WorkspaceEdit - keep order of text and file changes", function() {
    const edit = new types.WorkspaceEdit();
    edit.replace(URI.parse("foo:a"), new types.Range(1, 1, 1, 1), "foo");
    edit.renameFile(URI.parse("foo:a"), URI.parse("foo:b"));
    edit.replace(URI.parse("foo:a"), new types.Range(2, 1, 2, 1), "bar");
    edit.replace(URI.parse("foo:b"), new types.Range(3, 1, 3, 1), "bazz");
    const all = edit._allEntries();
    assert.strictEqual(all.length, 4);
    const [first, second, third, fourth] = all;
    assertType(first._type === types.FileEditType.Text);
    assert.strictEqual(first.uri.toString(), "foo:a");
    assertType(second._type === types.FileEditType.File);
    assert.strictEqual(second.from.toString(), "foo:a");
    assert.strictEqual(second.to.toString(), "foo:b");
    assertType(third._type === types.FileEditType.Text);
    assert.strictEqual(third.uri.toString(), "foo:a");
    assertType(fourth._type === types.FileEditType.Text);
    assert.strictEqual(fourth.uri.toString(), "foo:b");
  });
  test("WorkspaceEdit - two edits for one resource", function() {
    const edit = new types.WorkspaceEdit();
    const uri = URI.parse("foo:bar");
    edit.insert(uri, new types.Position(0, 0), "Hello");
    edit.insert(uri, new types.Position(0, 0), "Foo");
    assert.strictEqual(edit._allEntries().length, 2);
    const [first, second] = edit._allEntries();
    assertType(first._type === types.FileEditType.Text);
    assertType(second._type === types.FileEditType.Text);
    assert.strictEqual(first.edit.newText, "Hello");
    assert.strictEqual(second.edit.newText, "Foo");
  });
  test("WorkspaceEdit - set with metadata accepts undefined", function() {
    const edit = new types.WorkspaceEdit();
    const uri = URI.parse("foo:bar");
    edit.set(uri, [
      [types.TextEdit.insert(new types.Position(0, 0), "Hello"), { needsConfirmation: true, label: "foo" }],
      [types.TextEdit.insert(new types.Position(0, 0), "Hello"), void 0]
    ]);
    const all = edit._allEntries();
    assert.strictEqual(all.length, 2);
    const [first, second] = all;
    assert.ok(first.metadata);
    assert.ok(!second.metadata);
  });
  test("DocumentLink", () => {
    assert.throws(() => new types.DocumentLink(null, null));
    assert.throws(() => new types.DocumentLink(new types.Range(1, 1, 1, 1), null));
  });
  test("toJSON & stringify", function() {
    assertToJSON(new types.Selection(3, 4, 2, 1), { start: { line: 2, character: 1 }, end: { line: 3, character: 4 }, anchor: { line: 3, character: 4 }, active: { line: 2, character: 1 } });
    assertToJSON(new types.Location(URI.file("u.ts"), new types.Position(3, 4)), { uri: URI.parse("file:///u.ts").toJSON(), range: [{ line: 3, character: 4 }, { line: 3, character: 4 }] });
    assertToJSON(new types.Location(URI.file("u.ts"), new types.Range(1, 2, 3, 4)), { uri: URI.parse("file:///u.ts").toJSON(), range: [{ line: 1, character: 2 }, { line: 3, character: 4 }] });
    const diag = new types.Diagnostic(new types.Range(0, 1, 2, 3), "hello");
    assertToJSON(diag, { severity: "Error", message: "hello", range: [{ line: 0, character: 1 }, { line: 2, character: 3 }] });
    diag.source = "me";
    assertToJSON(diag, { severity: "Error", message: "hello", range: [{ line: 0, character: 1 }, { line: 2, character: 3 }], source: "me" });
    assertToJSON(new types.DocumentHighlight(new types.Range(2, 3, 4, 5)), { range: [{ line: 2, character: 3 }, { line: 4, character: 5 }], kind: "Text" });
    assertToJSON(new types.DocumentHighlight(new types.Range(2, 3, 4, 5), types.DocumentHighlightKind.Read), { range: [{ line: 2, character: 3 }, { line: 4, character: 5 }], kind: "Read" });
    assertToJSON(new types.SymbolInformation("test", types.SymbolKind.Boolean, new types.Range(0, 1, 2, 3)), {
      name: "test",
      kind: "Boolean",
      location: {
        range: [{ line: 0, character: 1 }, { line: 2, character: 3 }]
      }
    });
    assertToJSON(new types.CodeLens(new types.Range(7, 8, 9, 10)), { range: [{ line: 7, character: 8 }, { line: 9, character: 10 }] });
    assertToJSON(new types.CodeLens(new types.Range(7, 8, 9, 10), { command: "id", title: "title" }), {
      range: [{ line: 7, character: 8 }, { line: 9, character: 10 }],
      command: { command: "id", title: "title" }
    });
    assertToJSON(new types.CompletionItem("complete"), { label: "complete" });
    const item = new types.CompletionItem("complete");
    item.kind = types.CompletionItemKind.Interface;
    assertToJSON(item, { label: "complete", kind: "Interface" });
  });
  test("SymbolInformation, old ctor", function() {
    const info = new types.SymbolInformation("foo", types.SymbolKind.Array, new types.Range(1, 1, 2, 3));
    assert.ok(info.location instanceof types.Location);
    assert.strictEqual(info.location.uri, void 0);
  });
  test("SnippetString, builder-methods", function() {
    let string;
    string = new types.SnippetString();
    assert.strictEqual(string.appendText("I need $ and $").value, "I need \\$ and \\$");
    string = new types.SnippetString();
    assert.strictEqual(string.appendText("I need \\$").value, "I need \\\\\\$");
    string = new types.SnippetString();
    string.appendPlaceholder("fo$o}");
    assert.strictEqual(string.value, "${1:fo\\$o\\}}");
    string = new types.SnippetString();
    string.appendText("foo").appendTabstop(0).appendText("bar");
    assert.strictEqual(string.value, "foo$0bar");
    string = new types.SnippetString();
    string.appendText("foo").appendTabstop().appendText("bar");
    assert.strictEqual(string.value, "foo$1bar");
    string = new types.SnippetString();
    string.appendText("foo").appendTabstop(42).appendText("bar");
    assert.strictEqual(string.value, "foo$42bar");
    string = new types.SnippetString();
    string.appendText("foo").appendPlaceholder("farboo").appendText("bar");
    assert.strictEqual(string.value, "foo${1:farboo}bar");
    string = new types.SnippetString();
    string.appendText("foo").appendPlaceholder("far$boo").appendText("bar");
    assert.strictEqual(string.value, "foo${1:far\\$boo}bar");
    string = new types.SnippetString();
    string.appendText("foo").appendPlaceholder((b) => b.appendText("abc").appendPlaceholder("nested")).appendText("bar");
    assert.strictEqual(string.value, "foo${1:abc${2:nested}}bar");
    string = new types.SnippetString();
    string.appendVariable("foo");
    assert.strictEqual(string.value, "${foo}");
    string = new types.SnippetString();
    string.appendText("foo").appendVariable("TM_SELECTED_TEXT").appendText("bar");
    assert.strictEqual(string.value, "foo${TM_SELECTED_TEXT}bar");
    string = new types.SnippetString();
    string.appendVariable("BAR", (b) => b.appendPlaceholder("ops"));
    assert.strictEqual(string.value, "${BAR:${1:ops}}");
    string = new types.SnippetString();
    string.appendVariable("BAR", (b) => {
    });
    assert.strictEqual(string.value, "${BAR}");
    string = new types.SnippetString();
    string.appendChoice(["b", "a", "r"]);
    assert.strictEqual(string.value, "${1|b,a,r|}");
    string = new types.SnippetString();
    string.appendChoice(["b,1", "a,2", "r,3"]);
    assert.strictEqual(string.value, "${1|b\\,1,a\\,2,r\\,3|}");
    string = new types.SnippetString();
    string.appendChoice(["b", "a", "r"], 0);
    assert.strictEqual(string.value, "${0|b,a,r|}");
    string = new types.SnippetString();
    string.appendText("foo").appendChoice(["far", "boo"]).appendText("bar");
    assert.strictEqual(string.value, "foo${1|far,boo|}bar");
    string = new types.SnippetString();
    string.appendText("foo").appendChoice(["far", "$boo"]).appendText("bar");
    assert.strictEqual(string.value, "foo${1|far,$boo|}bar");
    string = new types.SnippetString();
    string.appendText("foo").appendPlaceholder("farboo").appendChoice(["far", "boo"]).appendText("bar");
    assert.strictEqual(string.value, "foo${1:farboo}${2|far,boo|}bar");
  });
  test("Snippet choices are incorrectly escaped/applied #180132", function() {
    {
      const s = new types.SnippetString();
      s.appendChoice(["aaa$aaa"]);
      s.appendText("bbb$bbb");
      assert.strictEqual(s.value, "${1|aaa$aaa|}bbb\\$bbb");
    }
    {
      const s = new types.SnippetString();
      s.appendChoice(["aaa,aaa"]);
      s.appendText("bbb$bbb");
      assert.strictEqual(s.value, "${1|aaa\\,aaa|}bbb\\$bbb");
    }
    {
      const s = new types.SnippetString();
      s.appendChoice(["aaa|aaa"]);
      s.appendText("bbb$bbb");
      assert.strictEqual(s.value, "${1|aaa\\|aaa|}bbb\\$bbb");
    }
    {
      const s = new types.SnippetString();
      s.appendChoice(["aaa\\aaa"]);
      s.appendText("bbb$bbb");
      assert.strictEqual(s.value, "${1|aaa\\\\aaa|}bbb\\$bbb");
    }
  });
  test("instanceof doesn't work for FileSystemError #49386", function() {
    const error = types.FileSystemError.Unavailable("foo");
    assert.ok(error instanceof Error);
    assert.ok(error instanceof types.FileSystemError);
  });
  test("CancellationError", function() {
    const err = new CancellationError();
    assert.strictEqual(err.name, "Canceled");
    assert.strictEqual(err.message, "Canceled");
  });
  test("CodeActionKind contains", () => {
    assert.ok(types.CodeActionKind.RefactorExtract.contains(types.CodeActionKind.RefactorExtract));
    assert.ok(types.CodeActionKind.RefactorExtract.contains(types.CodeActionKind.RefactorExtract.append("other")));
    assert.ok(!types.CodeActionKind.RefactorExtract.contains(types.CodeActionKind.Refactor));
    assert.ok(!types.CodeActionKind.RefactorExtract.contains(types.CodeActionKind.Refactor.append("other")));
    assert.ok(!types.CodeActionKind.RefactorExtract.contains(types.CodeActionKind.Empty.append("other").append("refactor")));
    assert.ok(!types.CodeActionKind.RefactorExtract.contains(types.CodeActionKind.Empty.append("refactory")));
  });
  test("CodeActionKind intersects", () => {
    assert.ok(types.CodeActionKind.RefactorExtract.intersects(types.CodeActionKind.RefactorExtract));
    assert.ok(types.CodeActionKind.RefactorExtract.intersects(types.CodeActionKind.Refactor));
    assert.ok(types.CodeActionKind.RefactorExtract.intersects(types.CodeActionKind.RefactorExtract.append("other")));
    assert.ok(!types.CodeActionKind.RefactorExtract.intersects(types.CodeActionKind.Refactor.append("other")));
    assert.ok(!types.CodeActionKind.RefactorExtract.intersects(types.CodeActionKind.Empty.append("other").append("refactor")));
    assert.ok(!types.CodeActionKind.RefactorExtract.intersects(types.CodeActionKind.Empty.append("refactory")));
  });
  function toArr(uint32Arr) {
    const r = [];
    for (let i = 0, len = uint32Arr.length; i < len; i++) {
      r[i] = uint32Arr[i];
    }
    return r;
  }
  test("SemanticTokensBuilder simple", () => {
    const builder = new types.SemanticTokensBuilder();
    builder.push(1, 0, 5, 1, 1);
    builder.push(1, 10, 4, 2, 2);
    builder.push(2, 2, 3, 2, 2);
    assert.deepStrictEqual(toArr(builder.build().data), [
      1,
      0,
      5,
      1,
      1,
      0,
      10,
      4,
      2,
      2,
      1,
      2,
      3,
      2,
      2
    ]);
  });
  test("SemanticTokensBuilder no modifier", () => {
    const builder = new types.SemanticTokensBuilder();
    builder.push(1, 0, 5, 1);
    builder.push(1, 10, 4, 2);
    builder.push(2, 2, 3, 2);
    assert.deepStrictEqual(toArr(builder.build().data), [
      1,
      0,
      5,
      1,
      0,
      0,
      10,
      4,
      2,
      0,
      1,
      2,
      3,
      2,
      0
    ]);
  });
  test("SemanticTokensBuilder out of order 1", () => {
    const builder = new types.SemanticTokensBuilder();
    builder.push(2, 0, 5, 1, 1);
    builder.push(2, 10, 1, 2, 2);
    builder.push(2, 15, 2, 3, 3);
    builder.push(1, 0, 4, 4, 4);
    assert.deepStrictEqual(toArr(builder.build().data), [
      1,
      0,
      4,
      4,
      4,
      1,
      0,
      5,
      1,
      1,
      0,
      10,
      1,
      2,
      2,
      0,
      5,
      2,
      3,
      3
    ]);
  });
  test("SemanticTokensBuilder out of order 2", () => {
    const builder = new types.SemanticTokensBuilder();
    builder.push(2, 10, 5, 1, 1);
    builder.push(2, 2, 4, 2, 2);
    assert.deepStrictEqual(toArr(builder.build().data), [
      2,
      2,
      4,
      2,
      2,
      0,
      8,
      5,
      1,
      1
    ]);
  });
  test("SemanticTokensBuilder with legend", () => {
    const legend = new types.SemanticTokensLegend(
      ["aType", "bType", "cType", "dType"],
      ["mod0", "mod1", "mod2", "mod3", "mod4", "mod5"]
    );
    const builder = new types.SemanticTokensBuilder(legend);
    builder.push(new types.Range(1, 0, 1, 5), "bType");
    builder.push(new types.Range(2, 0, 2, 4), "cType", ["mod0", "mod5"]);
    builder.push(new types.Range(3, 0, 3, 3), "dType", ["mod2", "mod4"]);
    assert.deepStrictEqual(toArr(builder.build().data), [
      1,
      0,
      5,
      1,
      0,
      1,
      0,
      4,
      2,
      1 | 1 << 5,
      1,
      0,
      3,
      3,
      1 << 2 | 1 << 4
    ]);
  });
  test("Markdown codeblock rendering is swapped #111604", function() {
    const md = new types.MarkdownString().appendCodeblock('<img src=0 onerror="alert(1)">', "html");
    assert.deepStrictEqual(md.value, '\n```html\n<img src=0 onerror="alert(1)">\n```\n');
  });
  test("NotebookCellOutputItem - factories", function() {
    assert.throws(() => {
      new types.NotebookCellOutputItem(new Uint8Array(), "invalid");
    });
    let item = types.NotebookCellOutputItem.error(new Error());
    assert.strictEqual(item.mime, "application/vnd.code.notebook.error");
    item = types.NotebookCellOutputItem.error({ name: "Hello" });
    assert.strictEqual(item.mime, "application/vnd.code.notebook.error");
    item = types.NotebookCellOutputItem.json(1);
    assert.strictEqual(item.mime, "text/x-json");
    assert.deepStrictEqual(item.data, new TextEncoder().encode(JSON.stringify(1)));
    item = types.NotebookCellOutputItem.json(1, "foo/bar");
    assert.strictEqual(item.mime, "foo/bar");
    assert.deepStrictEqual(item.data, new TextEncoder().encode(JSON.stringify(1)));
    item = types.NotebookCellOutputItem.json(true);
    assert.strictEqual(item.mime, "text/x-json");
    assert.deepStrictEqual(item.data, new TextEncoder().encode(JSON.stringify(true)));
    item = types.NotebookCellOutputItem.json([true, 1, "ddd"]);
    assert.strictEqual(item.mime, "text/x-json");
    assert.deepStrictEqual(item.data, new TextEncoder().encode(JSON.stringify([true, 1, "ddd"], void 0, "	")));
    item = types.NotebookCellOutputItem.text("H\u0119\u0142l\xF6");
    assert.strictEqual(item.mime, Mimes.text);
    assert.deepStrictEqual(item.data, new TextEncoder().encode("H\u0119\u0142l\xF6"));
    item = types.NotebookCellOutputItem.text("H\u0119\u0142l\xF6", "foo/bar");
    assert.strictEqual(item.mime, "foo/bar");
    assert.deepStrictEqual(item.data, new TextEncoder().encode("H\u0119\u0142l\xF6"));
  });
  test("FileDecoration#validate", function() {
    assert.ok(types.FileDecoration.validate({ badge: "u" }));
    assert.ok(types.FileDecoration.validate({ badge: "\xFC" }));
    assert.ok(types.FileDecoration.validate({ badge: "1" }));
    assert.ok(types.FileDecoration.validate({ badge: "\xE3\xE3" }));
    assert.ok(types.FileDecoration.validate({ badge: "\u{1F44B}" }));
    assert.ok(types.FileDecoration.validate({ badge: "\u{1F44B}\u{1F44B}" }));
    assert.ok(types.FileDecoration.validate({ badge: "\u{1F469}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F467}" }));
    assert.ok(types.FileDecoration.validate({ badge: "\u0BAA\u0BCB" }));
    assert.throws(() => types.FileDecoration.validate({ badge: "hel" }));
    assert.throws(() => types.FileDecoration.validate({ badge: "\u{1F44B}\u{1F44B}\u{1F44B}" }));
    assert.throws(() => types.FileDecoration.validate({ badge: "\u0BAA\u0BC1\u0BA9\u0BCD\u0B9A\u0BBF\u0BB0\u0BBF\u0BAA\u0BCD\u0BAA\u0BCB\u0B9F\u0BC1" }));
    assert.throws(() => types.FileDecoration.validate({ badge: "\xE3\xE3\xE3" }));
  });
  test("No longer possible to set content on LanguageModelChatMessage", function() {
    const m = types.LanguageModelChatMessage.Assistant("");
    m.content = [new types.LanguageModelToolCallPart("toolCall.call.callId", "toolCall.tool.name", "toolCall.call.parameters")];
    assert.equal(m.content.length, 1);
    assert.equal(m.content2?.length, 1);
    m.content2 = ["foo"];
    assert.equal(m.content.length, 1);
    assert.ok(m.content[0] instanceof types.LanguageModelTextPart);
    assert.equal(m.content2?.length, 1);
    assert.ok(typeof m.content2[0] === "string");
  });
  test("runtime stable, type-def changed", function() {
    const m = new types.LanguageModelChatMessage(types.LanguageModelChatMessageRole.User, []);
    assert.deepStrictEqual(m.content, []);
    m.content = "Hello";
    assert.deepStrictEqual(m.content, [new types.LanguageModelTextPart("Hello")]);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9leHRIb3N0VHlwZXMudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgKiBhcyB0eXBlcyBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdFR5cGVzLmpzJztcbmltcG9ydCB7IGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGFzc2VydFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBNaW1lcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21pbWUuanMnO1xuaW1wb3J0IHsgTWFyc2hhbGxlZElkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFyc2hhbGxpbmdJZHMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbmZ1bmN0aW9uIGFzc2VydFRvSlNPTihhOiBhbnksIGV4cGVjdGVkOiBhbnkpIHtcblx0Y29uc3QgcmF3ID0gSlNPTi5zdHJpbmdpZnkoYSk7XG5cdGNvbnN0IGFjdHVhbCA9IEpTT04ucGFyc2UocmF3KTtcblx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcbn1cblxuc3VpdGUoJ0V4dEhvc3RUeXBlcycsIGZ1bmN0aW9uICgpIHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdVUkksIHRvSlNPTicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZSgnZmlsZTovLy9wYXRoL3Rlc3QuZmlsZScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodXJpLnRvSlNPTigpLCB7XG5cdFx0XHQkbWlkOiBNYXJzaGFsbGVkSWQuVXJpLFxuXHRcdFx0c2NoZW1lOiAnZmlsZScsXG5cdFx0XHRwYXRoOiAnL3BhdGgvdGVzdC5maWxlJ1xuXHRcdH0pO1xuXG5cdFx0YXNzZXJ0Lm9rKHVyaS5mc1BhdGgpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodXJpLnRvSlNPTigpLCB7XG5cdFx0XHQkbWlkOiBNYXJzaGFsbGVkSWQuVXJpLFxuXHRcdFx0c2NoZW1lOiAnZmlsZScsXG5cdFx0XHRwYXRoOiAnL3BhdGgvdGVzdC5maWxlJyxcblx0XHRcdGZzUGF0aDogJy9wYXRoL3Rlc3QuZmlsZScucmVwbGFjZSgvXFwvL2csIGlzV2luZG93cyA/ICdcXFxcJyA6ICcvJyksXG5cdFx0XHRfc2VwOiBpc1dpbmRvd3MgPyAxIDogdW5kZWZpbmVkLFxuXHRcdH0pO1xuXG5cdFx0YXNzZXJ0Lm9rKHVyaS50b1N0cmluZygpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHVyaS50b0pTT04oKSwge1xuXHRcdFx0JG1pZDogTWFyc2hhbGxlZElkLlVyaSxcblx0XHRcdHNjaGVtZTogJ2ZpbGUnLFxuXHRcdFx0cGF0aDogJy9wYXRoL3Rlc3QuZmlsZScsXG5cdFx0XHRmc1BhdGg6ICcvcGF0aC90ZXN0LmZpbGUnLnJlcGxhY2UoL1xcLy9nLCBpc1dpbmRvd3MgPyAnXFxcXCcgOiAnLycpLFxuXHRcdFx0X3NlcDogaXNXaW5kb3dzID8gMSA6IHVuZGVmaW5lZCxcblx0XHRcdGV4dGVybmFsOiAnZmlsZTovLy9wYXRoL3Rlc3QuZmlsZSdcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRGlzcG9zYWJsZScsICgpID0+IHtcblxuXHRcdGxldCBjb3VudCA9IDA7XG5cdFx0Y29uc3QgZCA9IG5ldyB0eXBlcy5EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGNvdW50ICs9IDE7XG5cdFx0XHRyZXR1cm4gMTI7XG5cdFx0fSk7XG5cdFx0ZC5kaXNwb3NlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCAxKTtcblxuXHRcdGQuZGlzcG9zZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb3VudCwgMSk7XG5cblx0XHR0eXBlcy5EaXNwb3NhYmxlLmZyb20odW5kZWZpbmVkISwgeyBkaXNwb3NlKCkgeyBjb3VudCArPSAxOyB9IH0pLmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDIpO1xuXG5cblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdG5ldyB0eXBlcy5EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCk7XG5cdFx0XHR9KS5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cblx0XHRuZXcgdHlwZXMuRGlzcG9zYWJsZSh1bmRlZmluZWQhKS5kaXNwb3NlKCk7XG5cblx0fSk7XG5cblx0dGVzdCgnUG9zaXRpb24nLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBuZXcgdHlwZXMuUG9zaXRpb24oLTEsIDApKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IG5ldyB0eXBlcy5Qb3NpdGlvbigwLCAtMSkpO1xuXG5cdFx0Y29uc3QgcG9zID0gbmV3IHR5cGVzLlBvc2l0aW9uKDAsIDApO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gKHBvcyBhcyBhbnkpLmxpbmUgPSAtMSk7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiAocG9zIGFzIGFueSkuY2hhcmFjdGVyID0gLTEpO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gKHBvcyBhcyBhbnkpLmxpbmUgPSAxMik7XG5cblx0XHRjb25zdCB7IGxpbmUsIGNoYXJhY3RlciB9ID0gcG9zLnRvSlNPTigpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hhcmFjdGVyLCAwKTtcblx0fSk7XG5cblx0dGVzdCgnUG9zaXRpb24sIHRvSlNPTicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBwb3MgPSBuZXcgdHlwZXMuUG9zaXRpb24oNCwgMik7XG5cdFx0YXNzZXJ0VG9KU09OKHBvcywgeyBsaW5lOiA0LCBjaGFyYWN0ZXI6IDIgfSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Bvc2l0aW9uLCBpc0JlZm9yZShPckVxdWFsKT8nLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcDEgPSBuZXcgdHlwZXMuUG9zaXRpb24oMSwgMyk7XG5cdFx0Y29uc3QgcDIgPSBuZXcgdHlwZXMuUG9zaXRpb24oMSwgMik7XG5cdFx0Y29uc3QgcDMgPSBuZXcgdHlwZXMuUG9zaXRpb24oMCwgNCk7XG5cblx0XHRhc3NlcnQub2socDEuaXNCZWZvcmVPckVxdWFsKHAxKSk7XG5cdFx0YXNzZXJ0Lm9rKCFwMS5pc0JlZm9yZShwMSkpO1xuXHRcdGFzc2VydC5vayhwMi5pc0JlZm9yZShwMSkpO1xuXHRcdGFzc2VydC5vayhwMy5pc0JlZm9yZShwMikpO1xuXHR9KTtcblxuXHR0ZXN0KCdQb3NpdGlvbiwgaXNBZnRlcihPckVxdWFsKT8nLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcDEgPSBuZXcgdHlwZXMuUG9zaXRpb24oMSwgMyk7XG5cdFx0Y29uc3QgcDIgPSBuZXcgdHlwZXMuUG9zaXRpb24oMSwgMik7XG5cdFx0Y29uc3QgcDMgPSBuZXcgdHlwZXMuUG9zaXRpb24oMCwgNCk7XG5cblx0XHRhc3NlcnQub2socDEuaXNBZnRlck9yRXF1YWwocDEpKTtcblx0XHRhc3NlcnQub2soIXAxLmlzQWZ0ZXIocDEpKTtcblx0XHRhc3NlcnQub2socDEuaXNBZnRlcihwMikpO1xuXHRcdGFzc2VydC5vayhwMi5pc0FmdGVyKHAzKSk7XG5cdFx0YXNzZXJ0Lm9rKHAxLmlzQWZ0ZXIocDMpKTtcblx0fSk7XG5cblx0dGVzdCgnUG9zaXRpb24sIGNvbXBhcmVUbycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBwMSA9IG5ldyB0eXBlcy5Qb3NpdGlvbigxLCAzKTtcblx0XHRjb25zdCBwMiA9IG5ldyB0eXBlcy5Qb3NpdGlvbigxLCAyKTtcblx0XHRjb25zdCBwMyA9IG5ldyB0eXBlcy5Qb3NpdGlvbigwLCA0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwMS5jb21wYXJlVG8ocDEpLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocDIuY29tcGFyZVRvKHAxKSwgLTEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwMS5jb21wYXJlVG8ocDIpLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocDIuY29tcGFyZVRvKHAzKSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHAxLmNvbXBhcmVUbyhwMyksIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdQb3NpdGlvbiwgdHJhbnNsYXRlJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHAxID0gbmV3IHR5cGVzLlBvc2l0aW9uKDEsIDMpO1xuXG5cdFx0YXNzZXJ0Lm9rKHAxLnRyYW5zbGF0ZSgpID09PSBwMSk7XG5cdFx0YXNzZXJ0Lm9rKHAxLnRyYW5zbGF0ZSh7fSkgPT09IHAxKTtcblx0XHRhc3NlcnQub2socDEudHJhbnNsYXRlKDAsIDApID09PSBwMSk7XG5cdFx0YXNzZXJ0Lm9rKHAxLnRyYW5zbGF0ZSgwKSA9PT0gcDEpO1xuXHRcdGFzc2VydC5vayhwMS50cmFuc2xhdGUodW5kZWZpbmVkLCAwKSA9PT0gcDEpO1xuXHRcdGFzc2VydC5vayhwMS50cmFuc2xhdGUodW5kZWZpbmVkKSA9PT0gcDEpO1xuXG5cdFx0bGV0IHJlcyA9IHAxLnRyYW5zbGF0ZSgtMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5saW5lLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLmNoYXJhY3RlciwgMyk7XG5cblx0XHRyZXMgPSBwMS50cmFuc2xhdGUoeyBsaW5lRGVsdGE6IC0xIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMubGluZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5jaGFyYWN0ZXIsIDMpO1xuXG5cdFx0cmVzID0gcDEudHJhbnNsYXRlKHVuZGVmaW5lZCwgLTEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMubGluZSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5jaGFyYWN0ZXIsIDIpO1xuXG5cdFx0cmVzID0gcDEudHJhbnNsYXRlKHsgY2hhcmFjdGVyRGVsdGE6IC0xIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMubGluZSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5jaGFyYWN0ZXIsIDIpO1xuXG5cdFx0cmVzID0gcDEudHJhbnNsYXRlKDExKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLmxpbmUsIDEyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLmNoYXJhY3RlciwgMyk7XG5cblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHAxLnRyYW5zbGF0ZShudWxsISkpO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gcDEudHJhbnNsYXRlKG51bGwhLCBudWxsISkpO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gcDEudHJhbnNsYXRlKC0yKSk7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBwMS50cmFuc2xhdGUoeyBsaW5lRGVsdGE6IC0yIH0pKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHAxLnRyYW5zbGF0ZSgtMiwgbnVsbCEpKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHAxLnRyYW5zbGF0ZSgwLCAtNCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdQb3NpdGlvbiwgd2l0aCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBwMSA9IG5ldyB0eXBlcy5Qb3NpdGlvbigxLCAzKTtcblxuXHRcdGFzc2VydC5vayhwMS53aXRoKCkgPT09IHAxKTtcblx0XHRhc3NlcnQub2socDEud2l0aCgxKSA9PT0gcDEpO1xuXHRcdGFzc2VydC5vayhwMS53aXRoKHVuZGVmaW5lZCwgMykgPT09IHAxKTtcblx0XHRhc3NlcnQub2socDEud2l0aCgxLCAzKSA9PT0gcDEpO1xuXHRcdGFzc2VydC5vayhwMS53aXRoKHVuZGVmaW5lZCkgPT09IHAxKTtcblx0XHRhc3NlcnQub2socDEud2l0aCh7IGxpbmU6IDEgfSkgPT09IHAxKTtcblx0XHRhc3NlcnQub2socDEud2l0aCh7IGNoYXJhY3RlcjogMyB9KSA9PT0gcDEpO1xuXHRcdGFzc2VydC5vayhwMS53aXRoKHsgbGluZTogMSwgY2hhcmFjdGVyOiAzIH0pID09PSBwMSk7XG5cblx0XHRjb25zdCBwMiA9IHAxLndpdGgoeyBsaW5lOiAwLCBjaGFyYWN0ZXI6IDExIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwMi5saW5lLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocDIuY2hhcmFjdGVyLCAxMSk7XG5cblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHAxLndpdGgobnVsbCEpKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHAxLndpdGgoLTkpKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHAxLndpdGgoMCwgLTkpKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHAxLndpdGgoeyBsaW5lOiAtMSB9KSk7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBwMS53aXRoKHsgY2hhcmFjdGVyOiAtMSB9KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1JhbmdlJywgKCkgPT4ge1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gbmV3IHR5cGVzLlJhbmdlKC0xLCAwLCAwLCAwKSk7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBuZXcgdHlwZXMuUmFuZ2UoMCwgLTEsIDAsIDApKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IG5ldyB0eXBlcy5SYW5nZShuZXcgdHlwZXMuUG9zaXRpb24oMCwgMCksIHVuZGVmaW5lZCEpKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IG5ldyB0eXBlcy5SYW5nZShuZXcgdHlwZXMuUG9zaXRpb24oMCwgMCksIG51bGwhKSk7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBuZXcgdHlwZXMuUmFuZ2UodW5kZWZpbmVkISwgbmV3IHR5cGVzLlBvc2l0aW9uKDAsIDApKSk7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBuZXcgdHlwZXMuUmFuZ2UobnVsbCEsIG5ldyB0eXBlcy5Qb3NpdGlvbigwLCAwKSkpO1xuXG5cdFx0Y29uc3QgcmFuZ2UgPSBuZXcgdHlwZXMuUmFuZ2UoMSwgMCwgMCwgMCk7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7IChyYW5nZSBhcyBhbnkpLnN0YXJ0ID0gbnVsbDsgfSk7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7IChyYW5nZSBhcyBhbnkpLnN0YXJ0ID0gbmV3IHR5cGVzLlBvc2l0aW9uKDAsIDMpOyB9KTtcblx0fSk7XG5cblx0dGVzdCgnUmFuZ2UsIHRvSlNPTicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHJhbmdlID0gbmV3IHR5cGVzLlJhbmdlKDEsIDIsIDMsIDQpO1xuXHRcdGFzc2VydFRvSlNPTihyYW5nZSwgW3sgbGluZTogMSwgY2hhcmFjdGVyOiAyIH0sIHsgbGluZTogMywgY2hhcmFjdGVyOiA0IH1dKTtcblx0fSk7XG5cblx0dGVzdCgnUmFuZ2UsIHNvcnRpbmcnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Ly8gc29ydHMgc3RhcnQvZW5kXG5cdFx0bGV0IHJhbmdlID0gbmV3IHR5cGVzLlJhbmdlKDEsIDAsIDAsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZS5zdGFydC5saW5lLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmFuZ2UuZW5kLmxpbmUsIDEpO1xuXG5cdFx0cmFuZ2UgPSBuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlLnN0YXJ0LmxpbmUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZS5lbmQubGluZSwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1JhbmdlLCBpc0VtcHR5fGlzU2luZ2xlTGluZScsIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgcmFuZ2UgPSBuZXcgdHlwZXMuUmFuZ2UoMSwgMCwgMCwgMCk7XG5cdFx0YXNzZXJ0Lm9rKCFyYW5nZS5pc0VtcHR5KTtcblx0XHRhc3NlcnQub2soIXJhbmdlLmlzU2luZ2xlTGluZSk7XG5cblx0XHRyYW5nZSA9IG5ldyB0eXBlcy5SYW5nZSgxLCAxLCAxLCAxKTtcblx0XHRhc3NlcnQub2socmFuZ2UuaXNFbXB0eSk7XG5cdFx0YXNzZXJ0Lm9rKHJhbmdlLmlzU2luZ2xlTGluZSk7XG5cblx0XHRyYW5nZSA9IG5ldyB0eXBlcy5SYW5nZSgwLCAxLCAwLCAxMSk7XG5cdFx0YXNzZXJ0Lm9rKCFyYW5nZS5pc0VtcHR5KTtcblx0XHRhc3NlcnQub2socmFuZ2UuaXNTaW5nbGVMaW5lKTtcblxuXHRcdHJhbmdlID0gbmV3IHR5cGVzLlJhbmdlKDAsIDAsIDEsIDEpO1xuXHRcdGFzc2VydC5vayghcmFuZ2UuaXNFbXB0eSk7XG5cdFx0YXNzZXJ0Lm9rKCFyYW5nZS5pc1NpbmdsZUxpbmUpO1xuXHR9KTtcblxuXHR0ZXN0KCdSYW5nZSwgY29udGFpbnMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmFuZ2UgPSBuZXcgdHlwZXMuUmFuZ2UoMSwgMSwgMiwgMTEpO1xuXG5cdFx0YXNzZXJ0Lm9rKHJhbmdlLmNvbnRhaW5zKHJhbmdlLnN0YXJ0KSk7XG5cdFx0YXNzZXJ0Lm9rKHJhbmdlLmNvbnRhaW5zKHJhbmdlLmVuZCkpO1xuXHRcdGFzc2VydC5vayhyYW5nZS5jb250YWlucyhyYW5nZSkpO1xuXG5cdFx0YXNzZXJ0Lm9rKCFyYW5nZS5jb250YWlucyhuZXcgdHlwZXMuUmFuZ2UoMSwgMCwgMiwgMTEpKSk7XG5cdFx0YXNzZXJ0Lm9rKCFyYW5nZS5jb250YWlucyhuZXcgdHlwZXMuUmFuZ2UoMCwgMSwgMiwgMTEpKSk7XG5cdFx0YXNzZXJ0Lm9rKCFyYW5nZS5jb250YWlucyhuZXcgdHlwZXMuUmFuZ2UoMSwgMSwgMiwgMTIpKSk7XG5cdFx0YXNzZXJ0Lm9rKCFyYW5nZS5jb250YWlucyhuZXcgdHlwZXMuUmFuZ2UoMSwgMSwgMywgMTEpKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1JhbmdlLCBjb250YWlucyAobm8gaW5zdGFuY2VvZiknLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmFuZ2UgPSBuZXcgdHlwZXMuUmFuZ2UoMSwgMSwgMiwgMTEpO1xuXG5cdFx0Y29uc3Qgc3RhcnRMaWtlID0geyBsaW5lOiByYW5nZS5zdGFydC5saW5lLCBjaGFyYWN0ZXI6IHJhbmdlLnN0YXJ0LmNoYXJhY3RlciB9O1xuXHRcdGNvbnN0IGVuZExpa2UgPSB7IGxpbmU6IHJhbmdlLmVuZC5saW5lLCBjaGFyYWN0ZXI6IHJhbmdlLmVuZC5jaGFyYWN0ZXIgfTtcblx0XHRjb25zdCByYW5nZUxpa2UgPSB7IHN0YXJ0OiBzdGFydExpa2UsIGVuZDogZW5kTGlrZSB9O1xuXG5cdFx0YXNzZXJ0Lm9rKHJhbmdlLmNvbnRhaW5zKCg8dHlwZXMuUG9zaXRpb24+c3RhcnRMaWtlKSkpO1xuXHRcdGFzc2VydC5vayhyYW5nZS5jb250YWlucygoPHR5cGVzLlBvc2l0aW9uPmVuZExpa2UpKSk7XG5cdFx0YXNzZXJ0Lm9rKHJhbmdlLmNvbnRhaW5zKCg8dHlwZXMuUmFuZ2U+cmFuZ2VMaWtlKSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdSYW5nZSwgaW50ZXJzZWN0aW9uJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJhbmdlID0gbmV3IHR5cGVzLlJhbmdlKDEsIDEsIDIsIDExKTtcblx0XHRsZXQgcmVzOiB0eXBlcy5SYW5nZTtcblxuXHRcdHJlcyA9IHJhbmdlLmludGVyc2VjdGlvbihyYW5nZSkhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMuc3RhcnQubGluZSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5zdGFydC5jaGFyYWN0ZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMuZW5kLmxpbmUsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMuZW5kLmNoYXJhY3RlciwgMTEpO1xuXG5cdFx0cmVzID0gcmFuZ2UuaW50ZXJzZWN0aW9uKG5ldyB0eXBlcy5SYW5nZSgyLCAxMiwgNCwgMCkpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLCB1bmRlZmluZWQpO1xuXG5cdFx0cmVzID0gcmFuZ2UuaW50ZXJzZWN0aW9uKG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAxLCAwKSkhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMsIHVuZGVmaW5lZCk7XG5cblx0XHRyZXMgPSByYW5nZS5pbnRlcnNlY3Rpb24obmV3IHR5cGVzLlJhbmdlKDAsIDAsIDEsIDEpKSE7XG5cdFx0YXNzZXJ0Lm9rKHJlcy5pc0VtcHR5KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLnN0YXJ0LmxpbmUsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMuc3RhcnQuY2hhcmFjdGVyLCAxKTtcblxuXHRcdHJlcyA9IHJhbmdlLmludGVyc2VjdGlvbihuZXcgdHlwZXMuUmFuZ2UoMiwgMTEsIDYxLCAxKSkhO1xuXHRcdGFzc2VydC5vayhyZXMuaXNFbXB0eSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5zdGFydC5saW5lLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLnN0YXJ0LmNoYXJhY3RlciwgMTEpO1xuXG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiByYW5nZS5pbnRlcnNlY3Rpb24obnVsbCEpKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHJhbmdlLmludGVyc2VjdGlvbih1bmRlZmluZWQhKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1JhbmdlLCB1bmlvbicsIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgcmFuMSA9IG5ldyB0eXBlcy5SYW5nZSgwLCAwLCA1LCA1KTtcblx0XHRhc3NlcnQub2socmFuMS51bmlvbihuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMSwgMSkpID09PSByYW4xKTtcblxuXHRcdGxldCByZXM6IHR5cGVzLlJhbmdlO1xuXHRcdHJlcyA9IHJhbjEudW5pb24obmV3IHR5cGVzLlJhbmdlKDIsIDIsIDksIDkpKTtcblx0XHRhc3NlcnQub2socmVzLnN0YXJ0ID09PSByYW4xLnN0YXJ0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLmVuZC5saW5lLCA5KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLmVuZC5jaGFyYWN0ZXIsIDkpO1xuXG5cdFx0cmFuMSA9IG5ldyB0eXBlcy5SYW5nZSgyLCAxLCA1LCAzKTtcblx0XHRyZXMgPSByYW4xLnVuaW9uKG5ldyB0eXBlcy5SYW5nZSgxLCAwLCA0LCAyKSk7XG5cdFx0YXNzZXJ0Lm9rKHJlcy5lbmQgPT09IHJhbjEuZW5kKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLnN0YXJ0LmxpbmUsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMuc3RhcnQuY2hhcmFjdGVyLCAwKTtcblx0fSk7XG5cblx0dGVzdCgnUmFuZ2UsIHdpdGgnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmFuZ2UgPSBuZXcgdHlwZXMuUmFuZ2UoMSwgMSwgMiwgMTEpO1xuXG5cdFx0YXNzZXJ0Lm9rKHJhbmdlLndpdGgocmFuZ2Uuc3RhcnQpID09PSByYW5nZSk7XG5cdFx0YXNzZXJ0Lm9rKHJhbmdlLndpdGgodW5kZWZpbmVkLCByYW5nZS5lbmQpID09PSByYW5nZSk7XG5cdFx0YXNzZXJ0Lm9rKHJhbmdlLndpdGgocmFuZ2Uuc3RhcnQsIHJhbmdlLmVuZCkgPT09IHJhbmdlKTtcblx0XHRhc3NlcnQub2socmFuZ2Uud2l0aChuZXcgdHlwZXMuUG9zaXRpb24oMSwgMSkpID09PSByYW5nZSk7XG5cdFx0YXNzZXJ0Lm9rKHJhbmdlLndpdGgodW5kZWZpbmVkLCBuZXcgdHlwZXMuUG9zaXRpb24oMiwgMTEpKSA9PT0gcmFuZ2UpO1xuXHRcdGFzc2VydC5vayhyYW5nZS53aXRoKCkgPT09IHJhbmdlKTtcblx0XHRhc3NlcnQub2socmFuZ2Uud2l0aCh7IHN0YXJ0OiByYW5nZS5zdGFydCB9KSA9PT0gcmFuZ2UpO1xuXHRcdGFzc2VydC5vayhyYW5nZS53aXRoKHsgc3RhcnQ6IG5ldyB0eXBlcy5Qb3NpdGlvbigxLCAxKSB9KSA9PT0gcmFuZ2UpO1xuXHRcdGFzc2VydC5vayhyYW5nZS53aXRoKHsgZW5kOiByYW5nZS5lbmQgfSkgPT09IHJhbmdlKTtcblx0XHRhc3NlcnQub2socmFuZ2Uud2l0aCh7IGVuZDogbmV3IHR5cGVzLlBvc2l0aW9uKDIsIDExKSB9KSA9PT0gcmFuZ2UpO1xuXG5cdFx0bGV0IHJlcyA9IHJhbmdlLndpdGgodW5kZWZpbmVkLCBuZXcgdHlwZXMuUG9zaXRpb24oOSwgOCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMuZW5kLmxpbmUsIDkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMuZW5kLmNoYXJhY3RlciwgOCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5zdGFydC5saW5lLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLnN0YXJ0LmNoYXJhY3RlciwgMSk7XG5cblx0XHRyZXMgPSByYW5nZS53aXRoKHsgZW5kOiBuZXcgdHlwZXMuUG9zaXRpb24oOSwgOCkgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5lbmQubGluZSwgOSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5lbmQuY2hhcmFjdGVyLCA4KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLnN0YXJ0LmxpbmUsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMuc3RhcnQuY2hhcmFjdGVyLCAxKTtcblxuXHRcdHJlcyA9IHJhbmdlLndpdGgoeyBlbmQ6IG5ldyB0eXBlcy5Qb3NpdGlvbig5LCA4KSwgc3RhcnQ6IG5ldyB0eXBlcy5Qb3NpdGlvbigyLCAzKSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLmVuZC5saW5lLCA5KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLmVuZC5jaGFyYWN0ZXIsIDgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMuc3RhcnQubGluZSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5zdGFydC5jaGFyYWN0ZXIsIDMpO1xuXG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiByYW5nZS53aXRoKG51bGwhKSk7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiByYW5nZS53aXRoKHVuZGVmaW5lZCwgbnVsbCEpKTtcblx0fSk7XG5cblx0dGVzdCgnVGV4dEVkaXQnLCAoKSA9PiB7XG5cblx0XHRjb25zdCByYW5nZSA9IG5ldyB0eXBlcy5SYW5nZSgxLCAxLCAyLCAxMSk7XG5cdFx0bGV0IGVkaXQgPSBuZXcgdHlwZXMuVGV4dEVkaXQocmFuZ2UsIHVuZGVmaW5lZCEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0Lm5ld1RleHQsICcnKTtcblx0XHRhc3NlcnRUb0pTT04oZWRpdCwgeyByYW5nZTogW3sgbGluZTogMSwgY2hhcmFjdGVyOiAxIH0sIHsgbGluZTogMiwgY2hhcmFjdGVyOiAxMSB9XSwgbmV3VGV4dDogJycgfSk7XG5cblx0XHRlZGl0ID0gbmV3IHR5cGVzLlRleHRFZGl0KHJhbmdlLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdC5uZXdUZXh0LCAnJyk7XG5cblx0XHRlZGl0ID0gbmV3IHR5cGVzLlRleHRFZGl0KHJhbmdlLCAnJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXQubmV3VGV4dCwgJycpO1xuXHR9KTtcblxuXHR0ZXN0KCdXb3Jrc3BhY2VFZGl0JywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgYSA9IFVSSS5maWxlKCdhLnRzJyk7XG5cdFx0Y29uc3QgYiA9IFVSSS5maWxlKCdiLnRzJyk7XG5cblx0XHRjb25zdCBlZGl0ID0gbmV3IHR5cGVzLldvcmtzcGFjZUVkaXQoKTtcblx0XHRhc3NlcnQub2soIWVkaXQuaGFzKGEpKTtcblxuXHRcdGVkaXQuc2V0KGEsIFt0eXBlcy5UZXh0RWRpdC5pbnNlcnQobmV3IHR5cGVzLlBvc2l0aW9uKDAsIDApLCAnZmZmJyldKTtcblx0XHRhc3NlcnQub2soZWRpdC5oYXMoYSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0LnNpemUsIDEpO1xuXHRcdGFzc2VydFRvSlNPTihlZGl0LCBbW2EudG9KU09OKCksIFt7IHJhbmdlOiBbeyBsaW5lOiAwLCBjaGFyYWN0ZXI6IDAgfSwgeyBsaW5lOiAwLCBjaGFyYWN0ZXI6IDAgfV0sIG5ld1RleHQ6ICdmZmYnIH1dXV0pO1xuXG5cdFx0ZWRpdC5pbnNlcnQoYiwgbmV3IHR5cGVzLlBvc2l0aW9uKDEsIDEpLCAnZmZmJyk7XG5cdFx0ZWRpdC5kZWxldGUoYiwgbmV3IHR5cGVzLlJhbmdlKDAsIDAsIDAsIDApKTtcblx0XHRhc3NlcnQub2soZWRpdC5oYXMoYikpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0LnNpemUsIDIpO1xuXHRcdGFzc2VydFRvSlNPTihlZGl0LCBbXG5cdFx0XHRbYS50b0pTT04oKSwgW3sgcmFuZ2U6IFt7IGxpbmU6IDAsIGNoYXJhY3RlcjogMCB9LCB7IGxpbmU6IDAsIGNoYXJhY3RlcjogMCB9XSwgbmV3VGV4dDogJ2ZmZicgfV1dLFxuXHRcdFx0W2IudG9KU09OKCksIFt7IHJhbmdlOiBbeyBsaW5lOiAxLCBjaGFyYWN0ZXI6IDEgfSwgeyBsaW5lOiAxLCBjaGFyYWN0ZXI6IDEgfV0sIG5ld1RleHQ6ICdmZmYnIH0sIHsgcmFuZ2U6IFt7IGxpbmU6IDAsIGNoYXJhY3RlcjogMCB9LCB7IGxpbmU6IDAsIGNoYXJhY3RlcjogMCB9XSwgbmV3VGV4dDogJycgfV1dXG5cdFx0XSk7XG5cblx0XHRlZGl0LnNldChiLCB1bmRlZmluZWQhKTtcblx0XHRhc3NlcnQub2soIWVkaXQuaGFzKGIpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdC5zaXplLCAxKTtcblxuXHRcdGVkaXQuc2V0KGIsIFt0eXBlcy5UZXh0RWRpdC5pbnNlcnQobmV3IHR5cGVzLlBvc2l0aW9uKDAsIDApLCAnZmZmZicpXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXQuZ2V0KGIpLmxlbmd0aCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1dvcmtzcGFjZUVkaXQgLSBrZWVwIG9yZGVyIG9mIHRleHQgYW5kIGZpbGUgY2hhbmdlcycsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGVkaXQgPSBuZXcgdHlwZXMuV29ya3NwYWNlRWRpdCgpO1xuXHRcdGVkaXQucmVwbGFjZShVUkkucGFyc2UoJ2ZvbzphJyksIG5ldyB0eXBlcy5SYW5nZSgxLCAxLCAxLCAxKSwgJ2ZvbycpO1xuXHRcdGVkaXQucmVuYW1lRmlsZShVUkkucGFyc2UoJ2ZvbzphJyksIFVSSS5wYXJzZSgnZm9vOmInKSk7XG5cdFx0ZWRpdC5yZXBsYWNlKFVSSS5wYXJzZSgnZm9vOmEnKSwgbmV3IHR5cGVzLlJhbmdlKDIsIDEsIDIsIDEpLCAnYmFyJyk7XG5cdFx0ZWRpdC5yZXBsYWNlKFVSSS5wYXJzZSgnZm9vOmInKSwgbmV3IHR5cGVzLlJhbmdlKDMsIDEsIDMsIDEpLCAnYmF6eicpO1xuXG5cdFx0Y29uc3QgYWxsID0gZWRpdC5fYWxsRW50cmllcygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhbGwubGVuZ3RoLCA0KTtcblxuXHRcdGNvbnN0IFtmaXJzdCwgc2Vjb25kLCB0aGlyZCwgZm91cnRoXSA9IGFsbDtcblx0XHRhc3NlcnRUeXBlKGZpcnN0Ll90eXBlID09PSB0eXBlcy5GaWxlRWRpdFR5cGUuVGV4dCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnVyaS50b1N0cmluZygpLCAnZm9vOmEnKTtcblxuXHRcdGFzc2VydFR5cGUoc2Vjb25kLl90eXBlID09PSB0eXBlcy5GaWxlRWRpdFR5cGUuRmlsZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlY29uZC5mcm9tIS50b1N0cmluZygpLCAnZm9vOmEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vjb25kLnRvIS50b1N0cmluZygpLCAnZm9vOmInKTtcblxuXHRcdGFzc2VydFR5cGUodGhpcmQuX3R5cGUgPT09IHR5cGVzLkZpbGVFZGl0VHlwZS5UZXh0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhpcmQudXJpLnRvU3RyaW5nKCksICdmb286YScpO1xuXG5cdFx0YXNzZXJ0VHlwZShmb3VydGguX3R5cGUgPT09IHR5cGVzLkZpbGVFZGl0VHlwZS5UZXh0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91cnRoLnVyaS50b1N0cmluZygpLCAnZm9vOmInKTtcblx0fSk7XG5cblx0dGVzdCgnV29ya3NwYWNlRWRpdCAtIHR3byBlZGl0cyBmb3Igb25lIHJlc291cmNlJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGVkaXQgPSBuZXcgdHlwZXMuV29ya3NwYWNlRWRpdCgpO1xuXHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZSgnZm9vOmJhcicpO1xuXHRcdGVkaXQuaW5zZXJ0KHVyaSwgbmV3IHR5cGVzLlBvc2l0aW9uKDAsIDApLCAnSGVsbG8nKTtcblx0XHRlZGl0Lmluc2VydCh1cmksIG5ldyB0eXBlcy5Qb3NpdGlvbigwLCAwKSwgJ0ZvbycpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXQuX2FsbEVudHJpZXMoKS5sZW5ndGgsIDIpO1xuXHRcdGNvbnN0IFtmaXJzdCwgc2Vjb25kXSA9IGVkaXQuX2FsbEVudHJpZXMoKTtcblxuXHRcdGFzc2VydFR5cGUoZmlyc3QuX3R5cGUgPT09IHR5cGVzLkZpbGVFZGl0VHlwZS5UZXh0KTtcblx0XHRhc3NlcnRUeXBlKHNlY29uZC5fdHlwZSA9PT0gdHlwZXMuRmlsZUVkaXRUeXBlLlRleHQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5lZGl0Lm5ld1RleHQsICdIZWxsbycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmQuZWRpdC5uZXdUZXh0LCAnRm9vJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ1dvcmtzcGFjZUVkaXQgLSBzZXQgd2l0aCBtZXRhZGF0YSBhY2NlcHRzIHVuZGVmaW5lZCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBlZGl0ID0gbmV3IHR5cGVzLldvcmtzcGFjZUVkaXQoKTtcblx0XHRjb25zdCB1cmkgPSBVUkkucGFyc2UoJ2ZvbzpiYXInKTtcblxuXHRcdGVkaXQuc2V0KHVyaSwgW1xuXHRcdFx0W3R5cGVzLlRleHRFZGl0Lmluc2VydChuZXcgdHlwZXMuUG9zaXRpb24oMCwgMCksICdIZWxsbycpLCB7IG5lZWRzQ29uZmlybWF0aW9uOiB0cnVlLCBsYWJlbDogJ2ZvbycgfV0sXG5cdFx0XHRbdHlwZXMuVGV4dEVkaXQuaW5zZXJ0KG5ldyB0eXBlcy5Qb3NpdGlvbigwLCAwKSwgJ0hlbGxvJyksIHVuZGVmaW5lZF0sXG5cdFx0XSk7XG5cblx0XHRjb25zdCBhbGwgPSBlZGl0Ll9hbGxFbnRyaWVzKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFsbC5sZW5ndGgsIDIpO1xuXHRcdGNvbnN0IFtmaXJzdCwgc2Vjb25kXSA9IGFsbDtcblx0XHRhc3NlcnQub2soZmlyc3QubWV0YWRhdGEpO1xuXHRcdGFzc2VydC5vayghc2Vjb25kLm1ldGFkYXRhKTtcblx0fSk7XG5cblx0dGVzdCgnRG9jdW1lbnRMaW5rJywgKCkgPT4ge1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gbmV3IHR5cGVzLkRvY3VtZW50TGluayhudWxsISwgbnVsbCEpKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IG5ldyB0eXBlcy5Eb2N1bWVudExpbmsobmV3IHR5cGVzLlJhbmdlKDEsIDEsIDEsIDEpLCBudWxsISkpO1xuXHR9KTtcblxuXHR0ZXN0KCd0b0pTT04gJiBzdHJpbmdpZnknLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRhc3NlcnRUb0pTT04obmV3IHR5cGVzLlNlbGVjdGlvbigzLCA0LCAyLCAxKSwgeyBzdGFydDogeyBsaW5lOiAyLCBjaGFyYWN0ZXI6IDEgfSwgZW5kOiB7IGxpbmU6IDMsIGNoYXJhY3RlcjogNCB9LCBhbmNob3I6IHsgbGluZTogMywgY2hhcmFjdGVyOiA0IH0sIGFjdGl2ZTogeyBsaW5lOiAyLCBjaGFyYWN0ZXI6IDEgfSB9KTtcblxuXHRcdGFzc2VydFRvSlNPTihuZXcgdHlwZXMuTG9jYXRpb24oVVJJLmZpbGUoJ3UudHMnKSwgbmV3IHR5cGVzLlBvc2l0aW9uKDMsIDQpKSwgeyB1cmk6IFVSSS5wYXJzZSgnZmlsZTovLy91LnRzJykudG9KU09OKCksIHJhbmdlOiBbeyBsaW5lOiAzLCBjaGFyYWN0ZXI6IDQgfSwgeyBsaW5lOiAzLCBjaGFyYWN0ZXI6IDQgfV0gfSk7XG5cdFx0YXNzZXJ0VG9KU09OKG5ldyB0eXBlcy5Mb2NhdGlvbihVUkkuZmlsZSgndS50cycpLCBuZXcgdHlwZXMuUmFuZ2UoMSwgMiwgMywgNCkpLCB7IHVyaTogVVJJLnBhcnNlKCdmaWxlOi8vL3UudHMnKS50b0pTT04oKSwgcmFuZ2U6IFt7IGxpbmU6IDEsIGNoYXJhY3RlcjogMiB9LCB7IGxpbmU6IDMsIGNoYXJhY3RlcjogNCB9XSB9KTtcblxuXHRcdGNvbnN0IGRpYWcgPSBuZXcgdHlwZXMuRGlhZ25vc3RpYyhuZXcgdHlwZXMuUmFuZ2UoMCwgMSwgMiwgMyksICdoZWxsbycpO1xuXHRcdGFzc2VydFRvSlNPTihkaWFnLCB7IHNldmVyaXR5OiAnRXJyb3InLCBtZXNzYWdlOiAnaGVsbG8nLCByYW5nZTogW3sgbGluZTogMCwgY2hhcmFjdGVyOiAxIH0sIHsgbGluZTogMiwgY2hhcmFjdGVyOiAzIH1dIH0pO1xuXHRcdGRpYWcuc291cmNlID0gJ21lJztcblx0XHRhc3NlcnRUb0pTT04oZGlhZywgeyBzZXZlcml0eTogJ0Vycm9yJywgbWVzc2FnZTogJ2hlbGxvJywgcmFuZ2U6IFt7IGxpbmU6IDAsIGNoYXJhY3RlcjogMSB9LCB7IGxpbmU6IDIsIGNoYXJhY3RlcjogMyB9XSwgc291cmNlOiAnbWUnIH0pO1xuXG5cdFx0YXNzZXJ0VG9KU09OKG5ldyB0eXBlcy5Eb2N1bWVudEhpZ2hsaWdodChuZXcgdHlwZXMuUmFuZ2UoMiwgMywgNCwgNSkpLCB7IHJhbmdlOiBbeyBsaW5lOiAyLCBjaGFyYWN0ZXI6IDMgfSwgeyBsaW5lOiA0LCBjaGFyYWN0ZXI6IDUgfV0sIGtpbmQ6ICdUZXh0JyB9KTtcblx0XHRhc3NlcnRUb0pTT04obmV3IHR5cGVzLkRvY3VtZW50SGlnaGxpZ2h0KG5ldyB0eXBlcy5SYW5nZSgyLCAzLCA0LCA1KSwgdHlwZXMuRG9jdW1lbnRIaWdobGlnaHRLaW5kLlJlYWQpLCB7IHJhbmdlOiBbeyBsaW5lOiAyLCBjaGFyYWN0ZXI6IDMgfSwgeyBsaW5lOiA0LCBjaGFyYWN0ZXI6IDUgfV0sIGtpbmQ6ICdSZWFkJyB9KTtcblxuXHRcdGFzc2VydFRvSlNPTihuZXcgdHlwZXMuU3ltYm9sSW5mb3JtYXRpb24oJ3Rlc3QnLCB0eXBlcy5TeW1ib2xLaW5kLkJvb2xlYW4sIG5ldyB0eXBlcy5SYW5nZSgwLCAxLCAyLCAzKSksIHtcblx0XHRcdG5hbWU6ICd0ZXN0Jyxcblx0XHRcdGtpbmQ6ICdCb29sZWFuJyxcblx0XHRcdGxvY2F0aW9uOiB7XG5cdFx0XHRcdHJhbmdlOiBbeyBsaW5lOiAwLCBjaGFyYWN0ZXI6IDEgfSwgeyBsaW5lOiAyLCBjaGFyYWN0ZXI6IDMgfV1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGFzc2VydFRvSlNPTihuZXcgdHlwZXMuQ29kZUxlbnMobmV3IHR5cGVzLlJhbmdlKDcsIDgsIDksIDEwKSksIHsgcmFuZ2U6IFt7IGxpbmU6IDcsIGNoYXJhY3RlcjogOCB9LCB7IGxpbmU6IDksIGNoYXJhY3RlcjogMTAgfV0gfSk7XG5cdFx0YXNzZXJ0VG9KU09OKG5ldyB0eXBlcy5Db2RlTGVucyhuZXcgdHlwZXMuUmFuZ2UoNywgOCwgOSwgMTApLCB7IGNvbW1hbmQ6ICdpZCcsIHRpdGxlOiAndGl0bGUnIH0pLCB7XG5cdFx0XHRyYW5nZTogW3sgbGluZTogNywgY2hhcmFjdGVyOiA4IH0sIHsgbGluZTogOSwgY2hhcmFjdGVyOiAxMCB9XSxcblx0XHRcdGNvbW1hbmQ6IHsgY29tbWFuZDogJ2lkJywgdGl0bGU6ICd0aXRsZScgfVxuXHRcdH0pO1xuXG5cdFx0YXNzZXJ0VG9KU09OKG5ldyB0eXBlcy5Db21wbGV0aW9uSXRlbSgnY29tcGxldGUnKSwgeyBsYWJlbDogJ2NvbXBsZXRlJyB9KTtcblxuXHRcdGNvbnN0IGl0ZW0gPSBuZXcgdHlwZXMuQ29tcGxldGlvbkl0ZW0oJ2NvbXBsZXRlJyk7XG5cdFx0aXRlbS5raW5kID0gdHlwZXMuQ29tcGxldGlvbkl0ZW1LaW5kLkludGVyZmFjZTtcblx0XHRhc3NlcnRUb0pTT04oaXRlbSwgeyBsYWJlbDogJ2NvbXBsZXRlJywga2luZDogJ0ludGVyZmFjZScgfSk7XG5cblx0fSk7XG5cblx0dGVzdCgnU3ltYm9sSW5mb3JtYXRpb24sIG9sZCBjdG9yJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgaW5mbyA9IG5ldyB0eXBlcy5TeW1ib2xJbmZvcm1hdGlvbignZm9vJywgdHlwZXMuU3ltYm9sS2luZC5BcnJheSwgbmV3IHR5cGVzLlJhbmdlKDEsIDEsIDIsIDMpKTtcblx0XHRhc3NlcnQub2soaW5mby5sb2NhdGlvbiBpbnN0YW5jZW9mIHR5cGVzLkxvY2F0aW9uKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5mby5sb2NhdGlvbi51cmksIHVuZGVmaW5lZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NuaXBwZXRTdHJpbmcsIGJ1aWxkZXItbWV0aG9kcycsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGxldCBzdHJpbmc6IHR5cGVzLlNuaXBwZXRTdHJpbmc7XG5cblx0XHRzdHJpbmcgPSBuZXcgdHlwZXMuU25pcHBldFN0cmluZygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHJpbmcuYXBwZW5kVGV4dCgnSSBuZWVkICQgYW5kICQnKS52YWx1ZSwgJ0kgbmVlZCBcXFxcJCBhbmQgXFxcXCQnKTtcblxuXHRcdHN0cmluZyA9IG5ldyB0eXBlcy5TbmlwcGV0U3RyaW5nKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0cmluZy5hcHBlbmRUZXh0KCdJIG5lZWQgXFxcXCQnKS52YWx1ZSwgJ0kgbmVlZCBcXFxcXFxcXFxcXFwkJyk7XG5cblx0XHRzdHJpbmcgPSBuZXcgdHlwZXMuU25pcHBldFN0cmluZygpO1xuXHRcdHN0cmluZy5hcHBlbmRQbGFjZWhvbGRlcignZm8kb30nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RyaW5nLnZhbHVlLCAnJHsxOmZvXFxcXCRvXFxcXH19Jyk7XG5cblx0XHRzdHJpbmcgPSBuZXcgdHlwZXMuU25pcHBldFN0cmluZygpO1xuXHRcdHN0cmluZy5hcHBlbmRUZXh0KCdmb28nKS5hcHBlbmRUYWJzdG9wKDApLmFwcGVuZFRleHQoJ2JhcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHJpbmcudmFsdWUsICdmb28kMGJhcicpO1xuXG5cdFx0c3RyaW5nID0gbmV3IHR5cGVzLlNuaXBwZXRTdHJpbmcoKTtcblx0XHRzdHJpbmcuYXBwZW5kVGV4dCgnZm9vJykuYXBwZW5kVGFic3RvcCgpLmFwcGVuZFRleHQoJ2JhcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHJpbmcudmFsdWUsICdmb28kMWJhcicpO1xuXG5cdFx0c3RyaW5nID0gbmV3IHR5cGVzLlNuaXBwZXRTdHJpbmcoKTtcblx0XHRzdHJpbmcuYXBwZW5kVGV4dCgnZm9vJykuYXBwZW5kVGFic3RvcCg0MikuYXBwZW5kVGV4dCgnYmFyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0cmluZy52YWx1ZSwgJ2ZvbyQ0MmJhcicpO1xuXG5cdFx0c3RyaW5nID0gbmV3IHR5cGVzLlNuaXBwZXRTdHJpbmcoKTtcblx0XHRzdHJpbmcuYXBwZW5kVGV4dCgnZm9vJykuYXBwZW5kUGxhY2Vob2xkZXIoJ2ZhcmJvbycpLmFwcGVuZFRleHQoJ2JhcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHJpbmcudmFsdWUsICdmb28kezE6ZmFyYm9vfWJhcicpO1xuXG5cdFx0c3RyaW5nID0gbmV3IHR5cGVzLlNuaXBwZXRTdHJpbmcoKTtcblx0XHRzdHJpbmcuYXBwZW5kVGV4dCgnZm9vJykuYXBwZW5kUGxhY2Vob2xkZXIoJ2ZhciRib28nKS5hcHBlbmRUZXh0KCdiYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RyaW5nLnZhbHVlLCAnZm9vJHsxOmZhclxcXFwkYm9vfWJhcicpO1xuXG5cdFx0c3RyaW5nID0gbmV3IHR5cGVzLlNuaXBwZXRTdHJpbmcoKTtcblx0XHRzdHJpbmcuYXBwZW5kVGV4dCgnZm9vJykuYXBwZW5kUGxhY2Vob2xkZXIoYiA9PiBiLmFwcGVuZFRleHQoJ2FiYycpLmFwcGVuZFBsYWNlaG9sZGVyKCduZXN0ZWQnKSkuYXBwZW5kVGV4dCgnYmFyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0cmluZy52YWx1ZSwgJ2ZvbyR7MTphYmMkezI6bmVzdGVkfX1iYXInKTtcblxuXHRcdHN0cmluZyA9IG5ldyB0eXBlcy5TbmlwcGV0U3RyaW5nKCk7XG5cdFx0c3RyaW5nLmFwcGVuZFZhcmlhYmxlKCdmb28nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RyaW5nLnZhbHVlLCAnJHtmb299Jyk7XG5cblx0XHRzdHJpbmcgPSBuZXcgdHlwZXMuU25pcHBldFN0cmluZygpO1xuXHRcdHN0cmluZy5hcHBlbmRUZXh0KCdmb28nKS5hcHBlbmRWYXJpYWJsZSgnVE1fU0VMRUNURURfVEVYVCcpLmFwcGVuZFRleHQoJ2JhcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHJpbmcudmFsdWUsICdmb28ke1RNX1NFTEVDVEVEX1RFWFR9YmFyJyk7XG5cblx0XHRzdHJpbmcgPSBuZXcgdHlwZXMuU25pcHBldFN0cmluZygpO1xuXHRcdHN0cmluZy5hcHBlbmRWYXJpYWJsZSgnQkFSJywgYiA9PiBiLmFwcGVuZFBsYWNlaG9sZGVyKCdvcHMnKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0cmluZy52YWx1ZSwgJyR7QkFSOiR7MTpvcHN9fScpO1xuXG5cdFx0c3RyaW5nID0gbmV3IHR5cGVzLlNuaXBwZXRTdHJpbmcoKTtcblx0XHRzdHJpbmcuYXBwZW5kVmFyaWFibGUoJ0JBUicsIGIgPT4geyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RyaW5nLnZhbHVlLCAnJHtCQVJ9Jyk7XG5cblx0XHRzdHJpbmcgPSBuZXcgdHlwZXMuU25pcHBldFN0cmluZygpO1xuXHRcdHN0cmluZy5hcHBlbmRDaG9pY2UoWydiJywgJ2EnLCAnciddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RyaW5nLnZhbHVlLCAnJHsxfGIsYSxyfH0nKTtcblxuXHRcdHN0cmluZyA9IG5ldyB0eXBlcy5TbmlwcGV0U3RyaW5nKCk7XG5cdFx0c3RyaW5nLmFwcGVuZENob2ljZShbJ2IsMScsICdhLDInLCAnciwzJ10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHJpbmcudmFsdWUsICckezF8YlxcXFwsMSxhXFxcXCwyLHJcXFxcLDN8fScpO1xuXG5cdFx0c3RyaW5nID0gbmV3IHR5cGVzLlNuaXBwZXRTdHJpbmcoKTtcblx0XHRzdHJpbmcuYXBwZW5kQ2hvaWNlKFsnYicsICdhJywgJ3InXSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0cmluZy52YWx1ZSwgJyR7MHxiLGEscnx9Jyk7XG5cblx0XHRzdHJpbmcgPSBuZXcgdHlwZXMuU25pcHBldFN0cmluZygpO1xuXHRcdHN0cmluZy5hcHBlbmRUZXh0KCdmb28nKS5hcHBlbmRDaG9pY2UoWydmYXInLCAnYm9vJ10pLmFwcGVuZFRleHQoJ2JhcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHJpbmcudmFsdWUsICdmb28kezF8ZmFyLGJvb3x9YmFyJyk7XG5cblx0XHRzdHJpbmcgPSBuZXcgdHlwZXMuU25pcHBldFN0cmluZygpO1xuXHRcdHN0cmluZy5hcHBlbmRUZXh0KCdmb28nKS5hcHBlbmRDaG9pY2UoWydmYXInLCAnJGJvbyddKS5hcHBlbmRUZXh0KCdiYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RyaW5nLnZhbHVlLCAnZm9vJHsxfGZhciwkYm9vfH1iYXInKTtcblxuXHRcdHN0cmluZyA9IG5ldyB0eXBlcy5TbmlwcGV0U3RyaW5nKCk7XG5cdFx0c3RyaW5nLmFwcGVuZFRleHQoJ2ZvbycpLmFwcGVuZFBsYWNlaG9sZGVyKCdmYXJib28nKS5hcHBlbmRDaG9pY2UoWydmYXInLCAnYm9vJ10pLmFwcGVuZFRleHQoJ2JhcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHJpbmcudmFsdWUsICdmb28kezE6ZmFyYm9vfSR7MnxmYXIsYm9vfH1iYXInKTtcblx0fSk7XG5cblx0dGVzdCgnU25pcHBldCBjaG9pY2VzIGFyZSBpbmNvcnJlY3RseSBlc2NhcGVkL2FwcGxpZWQgIzE4MDEzMicsIGZ1bmN0aW9uICgpIHtcblx0XHR7XG5cdFx0XHRjb25zdCBzID0gbmV3IHR5cGVzLlNuaXBwZXRTdHJpbmcoKTtcblx0XHRcdHMuYXBwZW5kQ2hvaWNlKFtcImFhYSRhYWFcIl0pO1xuXHRcdFx0cy5hcHBlbmRUZXh0KFwiYmJiJGJiYlwiKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzLnZhbHVlLCAnJHsxfGFhYSRhYWF8fWJiYlxcXFwkYmJiJyk7XG5cdFx0fVxuXHRcdHtcblx0XHRcdGNvbnN0IHMgPSBuZXcgdHlwZXMuU25pcHBldFN0cmluZygpO1xuXHRcdFx0cy5hcHBlbmRDaG9pY2UoW1wiYWFhLGFhYVwiXSk7XG5cdFx0XHRzLmFwcGVuZFRleHQoXCJiYmIkYmJiXCIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHMudmFsdWUsICckezF8YWFhXFxcXCxhYWF8fWJiYlxcXFwkYmJiJyk7XG5cdFx0fVxuXHRcdHtcblx0XHRcdGNvbnN0IHMgPSBuZXcgdHlwZXMuU25pcHBldFN0cmluZygpO1xuXHRcdFx0cy5hcHBlbmRDaG9pY2UoW1wiYWFhfGFhYVwiXSk7XG5cdFx0XHRzLmFwcGVuZFRleHQoXCJiYmIkYmJiXCIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHMudmFsdWUsICckezF8YWFhXFxcXHxhYWF8fWJiYlxcXFwkYmJiJyk7XG5cdFx0fVxuXHRcdHtcblx0XHRcdGNvbnN0IHMgPSBuZXcgdHlwZXMuU25pcHBldFN0cmluZygpO1xuXHRcdFx0cy5hcHBlbmRDaG9pY2UoW1wiYWFhXFxcXGFhYVwiXSk7XG5cdFx0XHRzLmFwcGVuZFRleHQoXCJiYmIkYmJiXCIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHMudmFsdWUsICckezF8YWFhXFxcXFxcXFxhYWF8fWJiYlxcXFwkYmJiJyk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdpbnN0YW5jZW9mIGRvZXNuXFwndCB3b3JrIGZvciBGaWxlU3lzdGVtRXJyb3IgIzQ5Mzg2JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGVycm9yID0gdHlwZXMuRmlsZVN5c3RlbUVycm9yLlVuYXZhaWxhYmxlKCdmb28nKTtcblx0XHRhc3NlcnQub2soZXJyb3IgaW5zdGFuY2VvZiBFcnJvcik7XG5cdFx0YXNzZXJ0Lm9rKGVycm9yIGluc3RhbmNlb2YgdHlwZXMuRmlsZVN5c3RlbUVycm9yKTtcblx0fSk7XG5cblx0dGVzdCgnQ2FuY2VsbGF0aW9uRXJyb3InLCBmdW5jdGlvbiAoKSB7XG5cdFx0Ly8gVGhlIENhbmNlbGxhdGlvbkVycm9yLXR5cGUgaXMgdXNlZCBpbnRlcm5hbGx5IGFuZCBleHBvcnRlZCBhcyBBUEkuIE1ha2Ugc3VyZSB0aGF0IGF0XG5cdFx0Ly8gaXRzIG5hbWUgYW5kIG1lc3NhZ2UgYXJlIGBDYW5jZWxlZGBcblx0XHRjb25zdCBlcnIgPSBuZXcgQ2FuY2VsbGF0aW9uRXJyb3IoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXJyLm5hbWUsICdDYW5jZWxlZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlcnIubWVzc2FnZSwgJ0NhbmNlbGVkJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0NvZGVBY3Rpb25LaW5kIGNvbnRhaW5zJywgKCkgPT4ge1xuXHRcdGFzc2VydC5vayh0eXBlcy5Db2RlQWN0aW9uS2luZC5SZWZhY3RvckV4dHJhY3QuY29udGFpbnModHlwZXMuQ29kZUFjdGlvbktpbmQuUmVmYWN0b3JFeHRyYWN0KSk7XG5cdFx0YXNzZXJ0Lm9rKHR5cGVzLkNvZGVBY3Rpb25LaW5kLlJlZmFjdG9yRXh0cmFjdC5jb250YWlucyh0eXBlcy5Db2RlQWN0aW9uS2luZC5SZWZhY3RvckV4dHJhY3QuYXBwZW5kKCdvdGhlcicpKSk7XG5cblx0XHRhc3NlcnQub2soIXR5cGVzLkNvZGVBY3Rpb25LaW5kLlJlZmFjdG9yRXh0cmFjdC5jb250YWlucyh0eXBlcy5Db2RlQWN0aW9uS2luZC5SZWZhY3RvcikpO1xuXHRcdGFzc2VydC5vayghdHlwZXMuQ29kZUFjdGlvbktpbmQuUmVmYWN0b3JFeHRyYWN0LmNvbnRhaW5zKHR5cGVzLkNvZGVBY3Rpb25LaW5kLlJlZmFjdG9yLmFwcGVuZCgnb3RoZXInKSkpO1xuXHRcdGFzc2VydC5vayghdHlwZXMuQ29kZUFjdGlvbktpbmQuUmVmYWN0b3JFeHRyYWN0LmNvbnRhaW5zKHR5cGVzLkNvZGVBY3Rpb25LaW5kLkVtcHR5LmFwcGVuZCgnb3RoZXInKS5hcHBlbmQoJ3JlZmFjdG9yJykpKTtcblx0XHRhc3NlcnQub2soIXR5cGVzLkNvZGVBY3Rpb25LaW5kLlJlZmFjdG9yRXh0cmFjdC5jb250YWlucyh0eXBlcy5Db2RlQWN0aW9uS2luZC5FbXB0eS5hcHBlbmQoJ3JlZmFjdG9yeScpKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0NvZGVBY3Rpb25LaW5kIGludGVyc2VjdHMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0Lm9rKHR5cGVzLkNvZGVBY3Rpb25LaW5kLlJlZmFjdG9yRXh0cmFjdC5pbnRlcnNlY3RzKHR5cGVzLkNvZGVBY3Rpb25LaW5kLlJlZmFjdG9yRXh0cmFjdCkpO1xuXHRcdGFzc2VydC5vayh0eXBlcy5Db2RlQWN0aW9uS2luZC5SZWZhY3RvckV4dHJhY3QuaW50ZXJzZWN0cyh0eXBlcy5Db2RlQWN0aW9uS2luZC5SZWZhY3RvcikpO1xuXHRcdGFzc2VydC5vayh0eXBlcy5Db2RlQWN0aW9uS2luZC5SZWZhY3RvckV4dHJhY3QuaW50ZXJzZWN0cyh0eXBlcy5Db2RlQWN0aW9uS2luZC5SZWZhY3RvckV4dHJhY3QuYXBwZW5kKCdvdGhlcicpKSk7XG5cblx0XHRhc3NlcnQub2soIXR5cGVzLkNvZGVBY3Rpb25LaW5kLlJlZmFjdG9yRXh0cmFjdC5pbnRlcnNlY3RzKHR5cGVzLkNvZGVBY3Rpb25LaW5kLlJlZmFjdG9yLmFwcGVuZCgnb3RoZXInKSkpO1xuXHRcdGFzc2VydC5vayghdHlwZXMuQ29kZUFjdGlvbktpbmQuUmVmYWN0b3JFeHRyYWN0LmludGVyc2VjdHModHlwZXMuQ29kZUFjdGlvbktpbmQuRW1wdHkuYXBwZW5kKCdvdGhlcicpLmFwcGVuZCgncmVmYWN0b3InKSkpO1xuXHRcdGFzc2VydC5vayghdHlwZXMuQ29kZUFjdGlvbktpbmQuUmVmYWN0b3JFeHRyYWN0LmludGVyc2VjdHModHlwZXMuQ29kZUFjdGlvbktpbmQuRW1wdHkuYXBwZW5kKCdyZWZhY3RvcnknKSkpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiB0b0Fycih1aW50MzJBcnI6IFVpbnQzMkFycmF5KTogbnVtYmVyW10ge1xuXHRcdGNvbnN0IHIgPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gdWludDMyQXJyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRyW2ldID0gdWludDMyQXJyW2ldO1xuXHRcdH1cblx0XHRyZXR1cm4gcjtcblx0fVxuXG5cdHRlc3QoJ1NlbWFudGljVG9rZW5zQnVpbGRlciBzaW1wbGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyB0eXBlcy5TZW1hbnRpY1Rva2Vuc0J1aWxkZXIoKTtcblx0XHRidWlsZGVyLnB1c2goMSwgMCwgNSwgMSwgMSk7XG5cdFx0YnVpbGRlci5wdXNoKDEsIDEwLCA0LCAyLCAyKTtcblx0XHRidWlsZGVyLnB1c2goMiwgMiwgMywgMiwgMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b0FycihidWlsZGVyLmJ1aWxkKCkuZGF0YSksIFtcblx0XHRcdDEsIDAsIDUsIDEsIDEsXG5cdFx0XHQwLCAxMCwgNCwgMiwgMixcblx0XHRcdDEsIDIsIDMsIDIsIDJcblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgnU2VtYW50aWNUb2tlbnNCdWlsZGVyIG5vIG1vZGlmaWVyJywgKCkgPT4ge1xuXHRcdGNvbnN0IGJ1aWxkZXIgPSBuZXcgdHlwZXMuU2VtYW50aWNUb2tlbnNCdWlsZGVyKCk7XG5cdFx0YnVpbGRlci5wdXNoKDEsIDAsIDUsIDEpO1xuXHRcdGJ1aWxkZXIucHVzaCgxLCAxMCwgNCwgMik7XG5cdFx0YnVpbGRlci5wdXNoKDIsIDIsIDMsIDIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9BcnIoYnVpbGRlci5idWlsZCgpLmRhdGEpLCBbXG5cdFx0XHQxLCAwLCA1LCAxLCAwLFxuXHRcdFx0MCwgMTAsIDQsIDIsIDAsXG5cdFx0XHQxLCAyLCAzLCAyLCAwXG5cdFx0XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NlbWFudGljVG9rZW5zQnVpbGRlciBvdXQgb2Ygb3JkZXIgMScsICgpID0+IHtcblx0XHRjb25zdCBidWlsZGVyID0gbmV3IHR5cGVzLlNlbWFudGljVG9rZW5zQnVpbGRlcigpO1xuXHRcdGJ1aWxkZXIucHVzaCgyLCAwLCA1LCAxLCAxKTtcblx0XHRidWlsZGVyLnB1c2goMiwgMTAsIDEsIDIsIDIpO1xuXHRcdGJ1aWxkZXIucHVzaCgyLCAxNSwgMiwgMywgMyk7XG5cdFx0YnVpbGRlci5wdXNoKDEsIDAsIDQsIDQsIDQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9BcnIoYnVpbGRlci5idWlsZCgpLmRhdGEpLCBbXG5cdFx0XHQxLCAwLCA0LCA0LCA0LFxuXHRcdFx0MSwgMCwgNSwgMSwgMSxcblx0XHRcdDAsIDEwLCAxLCAyLCAyLFxuXHRcdFx0MCwgNSwgMiwgMywgM1xuXHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdTZW1hbnRpY1Rva2Vuc0J1aWxkZXIgb3V0IG9mIG9yZGVyIDInLCAoKSA9PiB7XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyB0eXBlcy5TZW1hbnRpY1Rva2Vuc0J1aWxkZXIoKTtcblx0XHRidWlsZGVyLnB1c2goMiwgMTAsIDUsIDEsIDEpO1xuXHRcdGJ1aWxkZXIucHVzaCgyLCAyLCA0LCAyLCAyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyKGJ1aWxkZXIuYnVpbGQoKS5kYXRhKSwgW1xuXHRcdFx0MiwgMiwgNCwgMiwgMixcblx0XHRcdDAsIDgsIDUsIDEsIDFcblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgnU2VtYW50aWNUb2tlbnNCdWlsZGVyIHdpdGggbGVnZW5kJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxlZ2VuZCA9IG5ldyB0eXBlcy5TZW1hbnRpY1Rva2Vuc0xlZ2VuZChcblx0XHRcdFsnYVR5cGUnLCAnYlR5cGUnLCAnY1R5cGUnLCAnZFR5cGUnXSxcblx0XHRcdFsnbW9kMCcsICdtb2QxJywgJ21vZDInLCAnbW9kMycsICdtb2Q0JywgJ21vZDUnXVxuXHRcdCk7XG5cdFx0Y29uc3QgYnVpbGRlciA9IG5ldyB0eXBlcy5TZW1hbnRpY1Rva2Vuc0J1aWxkZXIobGVnZW5kKTtcblx0XHRidWlsZGVyLnB1c2gobmV3IHR5cGVzLlJhbmdlKDEsIDAsIDEsIDUpLCAnYlR5cGUnKTtcblx0XHRidWlsZGVyLnB1c2gobmV3IHR5cGVzLlJhbmdlKDIsIDAsIDIsIDQpLCAnY1R5cGUnLCBbJ21vZDAnLCAnbW9kNSddKTtcblx0XHRidWlsZGVyLnB1c2gobmV3IHR5cGVzLlJhbmdlKDMsIDAsIDMsIDMpLCAnZFR5cGUnLCBbJ21vZDInLCAnbW9kNCddKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvQXJyKGJ1aWxkZXIuYnVpbGQoKS5kYXRhKSwgW1xuXHRcdFx0MSwgMCwgNSwgMSwgMCxcblx0XHRcdDEsIDAsIDQsIDIsIDEgfCAoMSA8PCA1KSxcblx0XHRcdDEsIDAsIDMsIDMsICgxIDw8IDIpIHwgKDEgPDwgNClcblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgnTWFya2Rvd24gY29kZWJsb2NrIHJlbmRlcmluZyBpcyBzd2FwcGVkICMxMTE2MDQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbWQgPSBuZXcgdHlwZXMuTWFya2Rvd25TdHJpbmcoKS5hcHBlbmRDb2RlYmxvY2soJzxpbWcgc3JjPTAgb25lcnJvcj1cImFsZXJ0KDEpXCI+JywgJ2h0bWwnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1kLnZhbHVlLCAnXFxuYGBgaHRtbFxcbjxpbWcgc3JjPTAgb25lcnJvcj1cImFsZXJ0KDEpXCI+XFxuYGBgXFxuJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ05vdGVib29rQ2VsbE91dHB1dEl0ZW0gLSBmYWN0b3JpZXMnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdC8vIGludmFsaWQgbWltZSB0eXBlXG5cdFx0XHRuZXcgdHlwZXMuTm90ZWJvb2tDZWxsT3V0cHV0SXRlbShuZXcgVWludDhBcnJheSgpLCAnaW52YWxpZCcpO1xuXHRcdH0pO1xuXG5cdFx0Ly8gLS0tIGVyclxuXG5cdFx0bGV0IGl0ZW0gPSB0eXBlcy5Ob3RlYm9va0NlbGxPdXRwdXRJdGVtLmVycm9yKG5ldyBFcnJvcigpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS5taW1lLCAnYXBwbGljYXRpb24vdm5kLmNvZGUubm90ZWJvb2suZXJyb3InKTtcblx0XHRpdGVtID0gdHlwZXMuTm90ZWJvb2tDZWxsT3V0cHV0SXRlbS5lcnJvcih7IG5hbWU6ICdIZWxsbycgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0ubWltZSwgJ2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLmVycm9yJyk7XG5cblx0XHQvLyAtLS0gSlNPTlxuXG5cdFx0aXRlbSA9IHR5cGVzLk5vdGVib29rQ2VsbE91dHB1dEl0ZW0uanNvbigxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXRlbS5taW1lLCAndGV4dC94LWpzb24nKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGl0ZW0uZGF0YSwgbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKEpTT04uc3RyaW5naWZ5KDEpKSk7XG5cblx0XHRpdGVtID0gdHlwZXMuTm90ZWJvb2tDZWxsT3V0cHV0SXRlbS5qc29uKDEsICdmb28vYmFyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0ubWltZSwgJ2Zvby9iYXInKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGl0ZW0uZGF0YSwgbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKEpTT04uc3RyaW5naWZ5KDEpKSk7XG5cblx0XHRpdGVtID0gdHlwZXMuTm90ZWJvb2tDZWxsT3V0cHV0SXRlbS5qc29uKHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVtLm1pbWUsICd0ZXh0L3gtanNvbicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaXRlbS5kYXRhLCBuZXcgVGV4dEVuY29kZXIoKS5lbmNvZGUoSlNPTi5zdHJpbmdpZnkodHJ1ZSkpKTtcblxuXHRcdGl0ZW0gPSB0eXBlcy5Ob3RlYm9va0NlbGxPdXRwdXRJdGVtLmpzb24oW3RydWUsIDEsICdkZGQnXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0ubWltZSwgJ3RleHQveC1qc29uJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChpdGVtLmRhdGEsIG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZShKU09OLnN0cmluZ2lmeShbdHJ1ZSwgMSwgJ2RkZCddLCB1bmRlZmluZWQsICdcXHQnKSkpO1xuXG5cdFx0Ly8gLS0tIHRleHRcblxuXHRcdGl0ZW0gPSB0eXBlcy5Ob3RlYm9va0NlbGxPdXRwdXRJdGVtLnRleHQoJ0hcdTAxMTlcdTAxNDJsXHUwMEY2Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0ubWltZSwgTWltZXMudGV4dCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChpdGVtLmRhdGEsIG5ldyBUZXh0RW5jb2RlcigpLmVuY29kZSgnSFx1MDExOVx1MDE0MmxcdTAwRjYnKSk7XG5cblx0XHRpdGVtID0gdHlwZXMuTm90ZWJvb2tDZWxsT3V0cHV0SXRlbS50ZXh0KCdIXHUwMTE5XHUwMTQybFx1MDBGNicsICdmb28vYmFyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGl0ZW0ubWltZSwgJ2Zvby9iYXInKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGl0ZW0uZGF0YSwgbmV3IFRleHRFbmNvZGVyKCkuZW5jb2RlKCdIXHUwMTE5XHUwMTQybFx1MDBGNicpKTtcblx0fSk7XG5cblx0dGVzdCgnRmlsZURlY29yYXRpb24jdmFsaWRhdGUnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRhc3NlcnQub2sodHlwZXMuRmlsZURlY29yYXRpb24udmFsaWRhdGUoeyBiYWRnZTogJ3UnIH0pKTtcblx0XHRhc3NlcnQub2sodHlwZXMuRmlsZURlY29yYXRpb24udmFsaWRhdGUoeyBiYWRnZTogJ1x1MDBGQycgfSkpO1xuXHRcdGFzc2VydC5vayh0eXBlcy5GaWxlRGVjb3JhdGlvbi52YWxpZGF0ZSh7IGJhZGdlOiAnMScgfSkpO1xuXHRcdGFzc2VydC5vayh0eXBlcy5GaWxlRGVjb3JhdGlvbi52YWxpZGF0ZSh7IGJhZGdlOiAnXHUwMEUzXHUwMEUzJyB9KSk7XG5cdFx0YXNzZXJ0Lm9rKHR5cGVzLkZpbGVEZWNvcmF0aW9uLnZhbGlkYXRlKHsgYmFkZ2U6ICdcdUQ4M0RcdURDNEInIH0pKTtcblx0XHRhc3NlcnQub2sodHlwZXMuRmlsZURlY29yYXRpb24udmFsaWRhdGUoeyBiYWRnZTogJ1x1RDgzRFx1REM0Qlx1RDgzRFx1REM0QicgfSkpO1xuXHRcdGFzc2VydC5vayh0eXBlcy5GaWxlRGVjb3JhdGlvbi52YWxpZGF0ZSh7IGJhZGdlOiAnXHVEODNEXHVEQzY5XHUyMDBEXHVEODNEXHVEQzY5XHUyMDBEXHVEODNEXHVEQzY3XHUyMDBEXHVEODNEXHVEQzY3JyB9KSk7XG5cdFx0YXNzZXJ0Lm9rKHR5cGVzLkZpbGVEZWNvcmF0aW9uLnZhbGlkYXRlKHsgYmFkZ2U6ICdcdTBCQUFcdTBCQ0InIH0pKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHR5cGVzLkZpbGVEZWNvcmF0aW9uLnZhbGlkYXRlKHsgYmFkZ2U6ICdoZWwnIH0pKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHR5cGVzLkZpbGVEZWNvcmF0aW9uLnZhbGlkYXRlKHsgYmFkZ2U6ICdcdUQ4M0RcdURDNEJcdUQ4M0RcdURDNEJcdUQ4M0RcdURDNEInIH0pKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHR5cGVzLkZpbGVEZWNvcmF0aW9uLnZhbGlkYXRlKHsgYmFkZ2U6ICdcdTBCQUFcdTBCQzFcdTBCQTlcdTBCQ0RcdTBCOUFcdTBCQkZcdTBCQjBcdTBCQkZcdTBCQUFcdTBCQ0RcdTBCQUFcdTBCQ0JcdTBCOUZcdTBCQzEnIH0pKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHR5cGVzLkZpbGVEZWNvcmF0aW9uLnZhbGlkYXRlKHsgYmFkZ2U6ICdcdTAwRTNcdTAwRTNcdTAwRTMnIH0pKTtcblx0fSk7XG5cblx0dGVzdCgnTm8gbG9uZ2VyIHBvc3NpYmxlIHRvIHNldCBjb250ZW50IG9uIExhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBtID0gdHlwZXMuTGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlLkFzc2lzdGFudCgnJyk7XG5cdFx0bS5jb250ZW50ID0gW25ldyB0eXBlcy5MYW5ndWFnZU1vZGVsVG9vbENhbGxQYXJ0KCd0b29sQ2FsbC5jYWxsLmNhbGxJZCcsICd0b29sQ2FsbC50b29sLm5hbWUnLCAndG9vbENhbGwuY2FsbC5wYXJhbWV0ZXJzJyldO1xuXG5cdFx0YXNzZXJ0LmVxdWFsKG0uY29udGVudC5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5lcXVhbChtLmNvbnRlbnQyPy5sZW5ndGgsIDEpO1xuXG5cblx0XHRtLmNvbnRlbnQyID0gWydmb28nXTtcblx0XHRhc3NlcnQuZXF1YWwobS5jb250ZW50Lmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0Lm9rKG0uY29udGVudFswXSBpbnN0YW5jZW9mIHR5cGVzLkxhbmd1YWdlTW9kZWxUZXh0UGFydCk7XG5cblx0XHRhc3NlcnQuZXF1YWwobS5jb250ZW50Mj8ubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQub2sodHlwZW9mIG0uY29udGVudDJbMF0gPT09ICdzdHJpbmcnKTtcblx0fSk7XG5cblx0dGVzdCgncnVudGltZSBzdGFibGUsIHR5cGUtZGVmIGNoYW5nZWQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Ly8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8yMzE5Mzhcblx0XHRjb25zdCBtID0gbmV3IHR5cGVzLkxhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZSh0eXBlcy5MYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2VSb2xlLlVzZXIsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0uY29udGVudCwgW10pO1xuXHRcdG0uY29udGVudCA9ICdIZWxsbyc7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLmNvbnRlbnQsIFtuZXcgdHlwZXMuTGFuZ3VhZ2VNb2RlbFRleHRQYXJ0KCdIZWxsbycpXSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxXQUFXO0FBQ3BCLFlBQVksV0FBVztBQUN2QixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGFBQWE7QUFDdEIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUywrQ0FBK0M7QUFFeEQsU0FBUyxhQUFhLEdBQVEsVUFBZTtBQUM1QyxRQUFNLE1BQU0sS0FBSyxVQUFVLENBQUM7QUFDNUIsUUFBTSxTQUFTLEtBQUssTUFBTSxHQUFHO0FBQzdCLFNBQU8sZ0JBQWdCLFFBQVEsUUFBUTtBQUN4QztBQUVBLE1BQU0sZ0JBQWdCLFdBQVk7QUFFakMsMENBQXdDO0FBRXhDLE9BQUssZUFBZSxXQUFZO0FBRS9CLFVBQU0sTUFBTSxJQUFJLE1BQU0sd0JBQXdCO0FBQzlDLFdBQU8sZ0JBQWdCLElBQUksT0FBTyxHQUFHO0FBQUEsTUFDcEMsTUFBTSxhQUFhO0FBQUEsTUFDbkIsUUFBUTtBQUFBLE1BQ1IsTUFBTTtBQUFBLElBQ1AsQ0FBQztBQUVELFdBQU8sR0FBRyxJQUFJLE1BQU07QUFDcEIsV0FBTyxnQkFBZ0IsSUFBSSxPQUFPLEdBQUc7QUFBQSxNQUNwQyxNQUFNLGFBQWE7QUFBQSxNQUNuQixRQUFRO0FBQUEsTUFDUixNQUFNO0FBQUEsTUFDTixRQUFRLGtCQUFrQixRQUFRLE9BQU8sWUFBWSxPQUFPLEdBQUc7QUFBQSxNQUMvRCxNQUFNLFlBQVksSUFBSTtBQUFBLElBQ3ZCLENBQUM7QUFFRCxXQUFP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
