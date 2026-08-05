import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Position } from "../../../../common/core/position.js";
import { ILanguageConfigurationService } from "../../../../common/languages/languageConfigurationRegistry.js";
import { deserializePipePositions, serializePipePositions, testRepeatedActionAndExtractPositions } from "../../../wordOperations/test/browser/wordTestUtils.js";
import { CursorWordPartLeft, CursorWordPartLeftSelect, CursorWordPartRight, CursorWordPartRightSelect, DeleteWordPartLeft, DeleteWordPartRight } from "../../browser/wordPartOperations.js";
import { StaticServiceAccessor } from "./utils.js";
import { TestLanguageConfigurationService } from "../../../../test/common/modes/testLanguageConfigurationService.js";
suite("WordPartOperations", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const _deleteWordPartLeft = new DeleteWordPartLeft();
  const _deleteWordPartRight = new DeleteWordPartRight();
  const _cursorWordPartLeft = new CursorWordPartLeft();
  const _cursorWordPartLeftSelect = new CursorWordPartLeftSelect();
  const _cursorWordPartRight = new CursorWordPartRight();
  const _cursorWordPartRightSelect = new CursorWordPartRightSelect();
  const serviceAccessor = new StaticServiceAccessor().withService(
    ILanguageConfigurationService,
    new TestLanguageConfigurationService()
  );
  function runEditorCommand(editor, command) {
    command.runEditorCommand(serviceAccessor, editor, null);
  }
  function cursorWordPartLeft(editor, inSelectionmode = false) {
    runEditorCommand(editor, inSelectionmode ? _cursorWordPartLeftSelect : _cursorWordPartLeft);
  }
  function cursorWordPartRight(editor, inSelectionmode = false) {
    runEditorCommand(editor, inSelectionmode ? _cursorWordPartRightSelect : _cursorWordPartRight);
  }
  function deleteWordPartLeft(editor) {
    runEditorCommand(editor, _deleteWordPartLeft);
  }
  function deleteWordPartRight(editor) {
    runEditorCommand(editor, _deleteWordPartRight);
  }
  test("cursorWordPartLeft - basic", () => {
    const EXPECTED = [
      "|start| |line|",
      "|this|Is|A|Camel|Case|Var|  |this_|is_|a_|snake_|case_|var| |THIS_|IS_|CAPS_|SNAKE| |this_|IS|Mixed|Use|",
      "|end| |line"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1e3, 1e3),
      (ed) => cursorWordPartLeft(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 1))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordPartLeft - issue #53899: whitespace", () => {
    const EXPECTED = "|myvar| |=| |'|demonstration|     |of| |selection| |with| |space|'";
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1e3, 1e3),
      (ed) => cursorWordPartLeft(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 1))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordPartLeft - issue #53899: underscores", () => {
    const EXPECTED = "|myvar| |=| |'|demonstration_____|of| |selection| |with| |space|'";
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1e3, 1e3),
      (ed) => cursorWordPartLeft(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 1))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordPartRight - basic", () => {
    const EXPECTED = [
      "start| |line|",
      "|this|Is|A|Camel|Case|Var|  |this|_is|_a|_snake|_case|_var| |THIS|_IS|_CAPS|_SNAKE| |this|_IS|Mixed|Use|",
      "|end| |line|"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => cursorWordPartRight(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(3, 9))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordPartRight - issue #53899: whitespace", () => {
    const EXPECTED = "myvar| |=| |'|demonstration|     |of| |selection| |with| |space|'|";
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => cursorWordPartRight(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 52))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordPartRight - issue #53899: underscores", () => {
    const EXPECTED = "myvar| |=| |'|demonstration|_____of| |selection| |with| |space|'|";
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => cursorWordPartRight(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 52))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("cursorWordPartRight - issue #53899: second case", () => {
    const EXPECTED = [
      ";| |--| |1|",
      "|;|        |--| |2|",
      "|;|    |#|3|",
      "|;|   |#|4|"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => cursorWordPartRight(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(4, 7))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("issue #93239 - cursorWordPartRight", () => {
    const EXPECTED = [
      "foo|_bar|"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => cursorWordPartRight(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 8))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("issue #93239 - cursorWordPartLeft", () => {
    const EXPECTED = [
      "|foo_|bar"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 8),
      (ed) => cursorWordPartLeft(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 1))
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("deleteWordPartLeft - basic", () => {
    const EXPECTED = "|   |/*| |Just| |some| |text| |a|+=| |3| |+|5|-|3| |*/|  |this|Is|A|Camel|Case|Var|  |this_|is_|a_|snake_|case_|var| |THIS_|IS_|CAPS_|SNAKE| |this_|IS|Mixed|Use";
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1e3),
      (ed) => deleteWordPartLeft(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getValue().length === 0
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test("deleteWordPartRight - basic", () => {
    const EXPECTED = "   |/*| |Just| |some| |text| |a|+=| |3| |+|5|-|3| |*/|  |this|Is|A|Camel|Case|Var|  |this|_is|_a|_snake|_case|_var| |THIS|_IS|_CAPS|_SNAKE| |this|_IS|Mixed|Use|";
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => deleteWordPartRight(ed),
      (ed) => new Position(1, text.length - ed.getValue().length + 1),
      (ed) => ed.getValue().length === 0
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test('issue #158667: cursorWordPartLeft stops at "-" even when "-" is not in word separators', () => {
    const EXPECTED = [
      "|this-|is-|a-|kebab-|case-|var| |THIS-|IS-|CAPS-|KEBAB| |this-|IS|Mixed|Use"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1e3, 1e3),
      (ed) => cursorWordPartLeft(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 1)),
      { wordSeparators: "!\"#&'()*+,./:;<=>?@[\\]^`{|}\xB7" }
      // default characters sans '$-%~' plus '·'
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test('issue #158667: cursorWordPartRight stops at "-" even when "-" is not in word separators', () => {
    const EXPECTED = [
      "this|-is|-a|-kebab|-case|-var| |THIS|-IS|-CAPS|-KEBAB| |this|-IS|Mixed|Use|"
    ].join("\n");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => cursorWordPartRight(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getPosition().equals(new Position(1, 60)),
      { wordSeparators: "!\"#&'()*+,./:;<=>?@[\\]^`{|}\xB7" }
      // default characters sans '$-%~' plus '·'
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test('issue #158667: deleteWordPartLeft stops at "-" even when "-" is not in word separators', () => {
    const EXPECTED = [
      "|this-|is-|a-|kebab-|case-|var| |THIS-|IS-|CAPS-|KEBAB| |this-|IS|Mixed|Use"
    ].join(" ");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1e3, 1e3),
      (ed) => deleteWordPartLeft(ed),
      (ed) => ed.getPosition(),
      (ed) => ed.getValue().length === 0,
      { wordSeparators: "!\"#&'()*+,./:;<=>?@[\\]^`{|}\xB7" }
      // default characters sans '$-%~' plus '·'
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
  test('issue #158667: deleteWordPartRight stops at "-" even when "-" is not in word separators', () => {
    const EXPECTED = [
      "this|-is|-a|-kebab|-case|-var| |THIS|-IS|-CAPS|-KEBAB| |this|-IS|Mixed|Use|"
    ].join(" ");
    const [text] = deserializePipePositions(EXPECTED);
    const actualStops = testRepeatedActionAndExtractPositions(
      text,
      new Position(1, 1),
      (ed) => deleteWordPartRight(ed),
      (ed) => new Position(1, text.length - ed.getValue().length + 1),
      (ed) => ed.getValue().length === 0,
      { wordSeparators: "!\"#&'()*+,./:;<=>?@[\\]^`{|}\xB7" }
      // default characters sans '$-%~' plus '·'
    );
    const actual = serializePipePositions(text, actualStops);
    assert.deepStrictEqual(actual, EXPECTED);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi93b3JkUGFydE9wZXJhdGlvbnMvdGVzdC9icm93c2VyL3dvcmRQYXJ0T3BlcmF0aW9ucy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JDb21tYW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGRlc2VyaWFsaXplUGlwZVBvc2l0aW9ucywgc2VyaWFsaXplUGlwZVBvc2l0aW9ucywgdGVzdFJlcGVhdGVkQWN0aW9uQW5kRXh0cmFjdFBvc2l0aW9ucyB9IGZyb20gJy4uLy4uLy4uL3dvcmRPcGVyYXRpb25zL3Rlc3QvYnJvd3Nlci93b3JkVGVzdFV0aWxzLmpzJztcbmltcG9ydCB7IEN1cnNvcldvcmRQYXJ0TGVmdCwgQ3Vyc29yV29yZFBhcnRMZWZ0U2VsZWN0LCBDdXJzb3JXb3JkUGFydFJpZ2h0LCBDdXJzb3JXb3JkUGFydFJpZ2h0U2VsZWN0LCBEZWxldGVXb3JkUGFydExlZnQsIERlbGV0ZVdvcmRQYXJ0UmlnaHQgfSBmcm9tICcuLi8uLi9icm93c2VyL3dvcmRQYXJ0T3BlcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBTdGF0aWNTZXJ2aWNlQWNjZXNzb3IgfSBmcm9tICcuL3V0aWxzLmpzJztcbmltcG9ydCB7IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vbW9kZXMvdGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuXG5zdWl0ZSgnV29yZFBhcnRPcGVyYXRpb25zJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGNvbnN0IF9kZWxldGVXb3JkUGFydExlZnQgPSBuZXcgRGVsZXRlV29yZFBhcnRMZWZ0KCk7XG5cdGNvbnN0IF9kZWxldGVXb3JkUGFydFJpZ2h0ID0gbmV3IERlbGV0ZVdvcmRQYXJ0UmlnaHQoKTtcblx0Y29uc3QgX2N1cnNvcldvcmRQYXJ0TGVmdCA9IG5ldyBDdXJzb3JXb3JkUGFydExlZnQoKTtcblx0Y29uc3QgX2N1cnNvcldvcmRQYXJ0TGVmdFNlbGVjdCA9IG5ldyBDdXJzb3JXb3JkUGFydExlZnRTZWxlY3QoKTtcblx0Y29uc3QgX2N1cnNvcldvcmRQYXJ0UmlnaHQgPSBuZXcgQ3Vyc29yV29yZFBhcnRSaWdodCgpO1xuXHRjb25zdCBfY3Vyc29yV29yZFBhcnRSaWdodFNlbGVjdCA9IG5ldyBDdXJzb3JXb3JkUGFydFJpZ2h0U2VsZWN0KCk7XG5cblx0Y29uc3Qgc2VydmljZUFjY2Vzc29yID0gbmV3IFN0YXRpY1NlcnZpY2VBY2Nlc3NvcigpLndpdGhTZXJ2aWNlKFxuXHRcdElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpXG5cdCk7XG5cblx0ZnVuY3Rpb24gcnVuRWRpdG9yQ29tbWFuZChlZGl0b3I6IElDb2RlRWRpdG9yLCBjb21tYW5kOiBFZGl0b3JDb21tYW5kKTogdm9pZCB7XG5cdFx0Y29tbWFuZC5ydW5FZGl0b3JDb21tYW5kKHNlcnZpY2VBY2Nlc3NvciwgZWRpdG9yLCBudWxsKTtcblx0fVxuXHRmdW5jdGlvbiBjdXJzb3JXb3JkUGFydExlZnQoZWRpdG9yOiBJQ29kZUVkaXRvciwgaW5TZWxlY3Rpb25tb2RlOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHRydW5FZGl0b3JDb21tYW5kKGVkaXRvciwgaW5TZWxlY3Rpb25tb2RlID8gX2N1cnNvcldvcmRQYXJ0TGVmdFNlbGVjdCA6IF9jdXJzb3JXb3JkUGFydExlZnQpO1xuXHR9XG5cdGZ1bmN0aW9uIGN1cnNvcldvcmRQYXJ0UmlnaHQoZWRpdG9yOiBJQ29kZUVkaXRvciwgaW5TZWxlY3Rpb25tb2RlOiBib29sZWFuID0gZmFsc2UpOiB2b2lkIHtcblx0XHRydW5FZGl0b3JDb21tYW5kKGVkaXRvciwgaW5TZWxlY3Rpb25tb2RlID8gX2N1cnNvcldvcmRQYXJ0UmlnaHRTZWxlY3QgOiBfY3Vyc29yV29yZFBhcnRSaWdodCk7XG5cdH1cblx0ZnVuY3Rpb24gZGVsZXRlV29yZFBhcnRMZWZ0KGVkaXRvcjogSUNvZGVFZGl0b3IpOiB2b2lkIHtcblx0XHRydW5FZGl0b3JDb21tYW5kKGVkaXRvciwgX2RlbGV0ZVdvcmRQYXJ0TGVmdCk7XG5cdH1cblx0ZnVuY3Rpb24gZGVsZXRlV29yZFBhcnRSaWdodChlZGl0b3I6IElDb2RlRWRpdG9yKTogdm9pZCB7XG5cdFx0cnVuRWRpdG9yQ29tbWFuZChlZGl0b3IsIF9kZWxldGVXb3JkUGFydFJpZ2h0KTtcblx0fVxuXG5cdHRlc3QoJ2N1cnNvcldvcmRQYXJ0TGVmdCAtIGJhc2ljJywgKCkgPT4ge1xuXHRcdGNvbnN0IEVYUEVDVEVEID0gW1xuXHRcdFx0J3xzdGFydHwgfGxpbmV8Jyxcblx0XHRcdCd8dGhpc3xJc3xBfENhbWVsfENhc2V8VmFyfCAgfHRoaXNffGlzX3xhX3xzbmFrZV98Y2FzZV98dmFyfCB8VEhJU198SVNffENBUFNffFNOQUtFfCB8dGhpc198SVN8TWl4ZWR8VXNlfCcsXG5cdFx0XHQnfGVuZHwgfGxpbmUnXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBbdGV4dCxdID0gZGVzZXJpYWxpemVQaXBlUG9zaXRpb25zKEVYUEVDVEVEKTtcblx0XHRjb25zdCBhY3R1YWxTdG9wcyA9IHRlc3RSZXBlYXRlZEFjdGlvbkFuZEV4dHJhY3RQb3NpdGlvbnMoXG5cdFx0XHR0ZXh0LFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEwMDAsIDEwMDApLFxuXHRcdFx0ZWQgPT4gY3Vyc29yV29yZFBhcnRMZWZ0KGVkKSxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEuZXF1YWxzKG5ldyBQb3NpdGlvbigxLCAxKSlcblx0XHQpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHNlcmlhbGl6ZVBpcGVQb3NpdGlvbnModGV4dCwgYWN0dWFsU3RvcHMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBFWFBFQ1RFRCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2N1cnNvcldvcmRQYXJ0TGVmdCAtIGlzc3VlICM1Mzg5OTogd2hpdGVzcGFjZScsICgpID0+IHtcblx0XHRjb25zdCBFWFBFQ1RFRCA9ICd8bXl2YXJ8IHw9fCB8XFwnfGRlbW9uc3RyYXRpb258ICAgICB8b2Z8IHxzZWxlY3Rpb258IHx3aXRofCB8c3BhY2V8XFwnJztcblx0XHRjb25zdCBbdGV4dCxdID0gZGVzZXJpYWxpemVQaXBlUG9zaXRpb25zKEVYUEVDVEVEKTtcblx0XHRjb25zdCBhY3R1YWxTdG9wcyA9IHRlc3RSZXBlYXRlZEFjdGlvbkFuZEV4dHJhY3RQb3NpdGlvbnMoXG5cdFx0XHR0ZXh0LFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEwMDAsIDEwMDApLFxuXHRcdFx0ZWQgPT4gY3Vyc29yV29yZFBhcnRMZWZ0KGVkKSxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEuZXF1YWxzKG5ldyBQb3NpdGlvbigxLCAxKSlcblx0XHQpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHNlcmlhbGl6ZVBpcGVQb3NpdGlvbnModGV4dCwgYWN0dWFsU3RvcHMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBFWFBFQ1RFRCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2N1cnNvcldvcmRQYXJ0TGVmdCAtIGlzc3VlICM1Mzg5OTogdW5kZXJzY29yZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgRVhQRUNURUQgPSAnfG15dmFyfCB8PXwgfFxcJ3xkZW1vbnN0cmF0aW9uX19fX198b2Z8IHxzZWxlY3Rpb258IHx3aXRofCB8c3BhY2V8XFwnJztcblx0XHRjb25zdCBbdGV4dCxdID0gZGVzZXJpYWxpemVQaXBlUG9zaXRpb25zKEVYUEVDVEVEKTtcblx0XHRjb25zdCBhY3R1YWxTdG9wcyA9IHRlc3RSZXBlYXRlZEFjdGlvbkFuZEV4dHJhY3RQb3NpdGlvbnMoXG5cdFx0XHR0ZXh0LFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEwMDAsIDEwMDApLFxuXHRcdFx0ZWQgPT4gY3Vyc29yV29yZFBhcnRMZWZ0KGVkKSxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEuZXF1YWxzKG5ldyBQb3NpdGlvbigxLCAxKSlcblx0XHQpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHNlcmlhbGl6ZVBpcGVQb3NpdGlvbnModGV4dCwgYWN0dWFsU3RvcHMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBFWFBFQ1RFRCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2N1cnNvcldvcmRQYXJ0UmlnaHQgLSBiYXNpYycsICgpID0+IHtcblx0XHRjb25zdCBFWFBFQ1RFRCA9IFtcblx0XHRcdCdzdGFydHwgfGxpbmV8Jyxcblx0XHRcdCd8dGhpc3xJc3xBfENhbWVsfENhc2V8VmFyfCAgfHRoaXN8X2lzfF9hfF9zbmFrZXxfY2FzZXxfdmFyfCB8VEhJU3xfSVN8X0NBUFN8X1NOQUtFfCB8dGhpc3xfSVN8TWl4ZWR8VXNlfCcsXG5cdFx0XHQnfGVuZHwgfGxpbmV8J1xuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgW3RleHQsXSA9IGRlc2VyaWFsaXplUGlwZVBvc2l0aW9ucyhFWFBFQ1RFRCk7XG5cdFx0Y29uc3QgYWN0dWFsU3RvcHMgPSB0ZXN0UmVwZWF0ZWRBY3Rpb25BbmRFeHRyYWN0UG9zaXRpb25zKFxuXHRcdFx0dGV4dCxcblx0XHRcdG5ldyBQb3NpdGlvbigxLCAxKSxcblx0XHRcdGVkID0+IGN1cnNvcldvcmRQYXJ0UmlnaHQoZWQpLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEsXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpIS5lcXVhbHMobmV3IFBvc2l0aW9uKDMsIDkpKVxuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG5cblx0dGVzdCgnY3Vyc29yV29yZFBhcnRSaWdodCAtIGlzc3VlICM1Mzg5OTogd2hpdGVzcGFjZScsICgpID0+IHtcblx0XHRjb25zdCBFWFBFQ1RFRCA9ICdteXZhcnwgfD18IHxcXCd8ZGVtb25zdHJhdGlvbnwgICAgIHxvZnwgfHNlbGVjdGlvbnwgfHdpdGh8IHxzcGFjZXxcXCd8Jztcblx0XHRjb25zdCBbdGV4dCxdID0gZGVzZXJpYWxpemVQaXBlUG9zaXRpb25zKEVYUEVDVEVEKTtcblx0XHRjb25zdCBhY3R1YWxTdG9wcyA9IHRlc3RSZXBlYXRlZEFjdGlvbkFuZEV4dHJhY3RQb3NpdGlvbnMoXG5cdFx0XHR0ZXh0LFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEsIDEpLFxuXHRcdFx0ZWQgPT4gY3Vyc29yV29yZFBhcnRSaWdodChlZCksXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpISxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLmVxdWFscyhuZXcgUG9zaXRpb24oMSwgNTIpKVxuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG5cblx0dGVzdCgnY3Vyc29yV29yZFBhcnRSaWdodCAtIGlzc3VlICM1Mzg5OTogdW5kZXJzY29yZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgRVhQRUNURUQgPSAnbXl2YXJ8IHw9fCB8XFwnfGRlbW9uc3RyYXRpb258X19fX19vZnwgfHNlbGVjdGlvbnwgfHdpdGh8IHxzcGFjZXxcXCd8Jztcblx0XHRjb25zdCBbdGV4dCxdID0gZGVzZXJpYWxpemVQaXBlUG9zaXRpb25zKEVYUEVDVEVEKTtcblx0XHRjb25zdCBhY3R1YWxTdG9wcyA9IHRlc3RSZXBlYXRlZEFjdGlvbkFuZEV4dHJhY3RQb3NpdGlvbnMoXG5cdFx0XHR0ZXh0LFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEsIDEpLFxuXHRcdFx0ZWQgPT4gY3Vyc29yV29yZFBhcnRSaWdodChlZCksXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpISxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLmVxdWFscyhuZXcgUG9zaXRpb24oMSwgNTIpKVxuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG5cblx0dGVzdCgnY3Vyc29yV29yZFBhcnRSaWdodCAtIGlzc3VlICM1Mzg5OTogc2Vjb25kIGNhc2UnLCAoKSA9PiB7XG5cdFx0Y29uc3QgRVhQRUNURUQgPSBbXG5cdFx0XHQnO3wgfC0tfCB8MXwnLFxuXHRcdFx0J3w7fCAgICAgICAgfC0tfCB8MnwnLFxuXHRcdFx0J3w7fCAgICB8I3wzfCcsXG5cdFx0XHQnfDt8ICAgfCN8NHwnXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBbdGV4dCxdID0gZGVzZXJpYWxpemVQaXBlUG9zaXRpb25zKEVYUEVDVEVEKTtcblx0XHRjb25zdCBhY3R1YWxTdG9wcyA9IHRlc3RSZXBlYXRlZEFjdGlvbkFuZEV4dHJhY3RQb3NpdGlvbnMoXG5cdFx0XHR0ZXh0LFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEsIDEpLFxuXHRcdFx0ZWQgPT4gY3Vyc29yV29yZFBhcnRSaWdodChlZCksXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpISxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLmVxdWFscyhuZXcgUG9zaXRpb24oNCwgNykpXG5cdFx0KTtcblx0XHRjb25zdCBhY3R1YWwgPSBzZXJpYWxpemVQaXBlUG9zaXRpb25zKHRleHQsIGFjdHVhbFN0b3BzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgRVhQRUNURUQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjOTMyMzkgLSBjdXJzb3JXb3JkUGFydFJpZ2h0JywgKCkgPT4ge1xuXHRcdGNvbnN0IEVYUEVDVEVEID0gW1xuXHRcdFx0J2Zvb3xfYmFyfCcsXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBbdGV4dCxdID0gZGVzZXJpYWxpemVQaXBlUG9zaXRpb25zKEVYUEVDVEVEKTtcblx0XHRjb25zdCBhY3R1YWxTdG9wcyA9IHRlc3RSZXBlYXRlZEFjdGlvbkFuZEV4dHJhY3RQb3NpdGlvbnMoXG5cdFx0XHR0ZXh0LFxuXHRcdFx0bmV3IFBvc2l0aW9uKDEsIDEpLFxuXHRcdFx0ZWQgPT4gY3Vyc29yV29yZFBhcnRSaWdodChlZCksXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpISxcblx0XHRcdGVkID0+IGVkLmdldFBvc2l0aW9uKCkhLmVxdWFscyhuZXcgUG9zaXRpb24oMSwgOCkpXG5cdFx0KTtcblx0XHRjb25zdCBhY3R1YWwgPSBzZXJpYWxpemVQaXBlUG9zaXRpb25zKHRleHQsIGFjdHVhbFN0b3BzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgRVhQRUNURUQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjOTMyMzkgLSBjdXJzb3JXb3JkUGFydExlZnQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgRVhQRUNURUQgPSBbXG5cdFx0XHQnfGZvb198YmFyJyxcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IFt0ZXh0LF0gPSBkZXNlcmlhbGl6ZVBpcGVQb3NpdGlvbnMoRVhQRUNURUQpO1xuXHRcdGNvbnN0IGFjdHVhbFN0b3BzID0gdGVzdFJlcGVhdGVkQWN0aW9uQW5kRXh0cmFjdFBvc2l0aW9ucyhcblx0XHRcdHRleHQsXG5cdFx0XHRuZXcgUG9zaXRpb24oMSwgOCksXG5cdFx0XHRlZCA9PiBjdXJzb3JXb3JkUGFydExlZnQoZWQpLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEsXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpIS5lcXVhbHMobmV3IFBvc2l0aW9uKDEsIDEpKVxuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlV29yZFBhcnRMZWZ0IC0gYmFzaWMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgRVhQRUNURUQgPSAnfCAgIHwvKnwgfEp1c3R8IHxzb21lfCB8dGV4dHwgfGF8Kz18IHwzfCB8K3w1fC18M3wgfCovfCAgfHRoaXN8SXN8QXxDYW1lbHxDYXNlfFZhcnwgIHx0aGlzX3xpc198YV98c25ha2VffGNhc2VffHZhcnwgfFRISVNffElTX3xDQVBTX3xTTkFLRXwgfHRoaXNffElTfE1peGVkfFVzZSc7XG5cdFx0Y29uc3QgW3RleHQsXSA9IGRlc2VyaWFsaXplUGlwZVBvc2l0aW9ucyhFWFBFQ1RFRCk7XG5cdFx0Y29uc3QgYWN0dWFsU3RvcHMgPSB0ZXN0UmVwZWF0ZWRBY3Rpb25BbmRFeHRyYWN0UG9zaXRpb25zKFxuXHRcdFx0dGV4dCxcblx0XHRcdG5ldyBQb3NpdGlvbigxLCAxMDAwKSxcblx0XHRcdGVkID0+IGRlbGV0ZVdvcmRQYXJ0TGVmdChlZCksXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpISxcblx0XHRcdGVkID0+IGVkLmdldFZhbHVlKCkubGVuZ3RoID09PSAwXG5cdFx0KTtcblx0XHRjb25zdCBhY3R1YWwgPSBzZXJpYWxpemVQaXBlUG9zaXRpb25zKHRleHQsIGFjdHVhbFN0b3BzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgRVhQRUNURUQpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGVXb3JkUGFydFJpZ2h0IC0gYmFzaWMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgRVhQRUNURUQgPSAnICAgfC8qfCB8SnVzdHwgfHNvbWV8IHx0ZXh0fCB8YXwrPXwgfDN8IHwrfDV8LXwzfCB8Ki98ICB8dGhpc3xJc3xBfENhbWVsfENhc2V8VmFyfCAgfHRoaXN8X2lzfF9hfF9zbmFrZXxfY2FzZXxfdmFyfCB8VEhJU3xfSVN8X0NBUFN8X1NOQUtFfCB8dGhpc3xfSVN8TWl4ZWR8VXNlfCc7XG5cdFx0Y29uc3QgW3RleHQsXSA9IGRlc2VyaWFsaXplUGlwZVBvc2l0aW9ucyhFWFBFQ1RFRCk7XG5cdFx0Y29uc3QgYWN0dWFsU3RvcHMgPSB0ZXN0UmVwZWF0ZWRBY3Rpb25BbmRFeHRyYWN0UG9zaXRpb25zKFxuXHRcdFx0dGV4dCxcblx0XHRcdG5ldyBQb3NpdGlvbigxLCAxKSxcblx0XHRcdGVkID0+IGRlbGV0ZVdvcmRQYXJ0UmlnaHQoZWQpLFxuXHRcdFx0ZWQgPT4gbmV3IFBvc2l0aW9uKDEsIHRleHQubGVuZ3RoIC0gZWQuZ2V0VmFsdWUoKS5sZW5ndGggKyAxKSxcblx0XHRcdGVkID0+IGVkLmdldFZhbHVlKCkubGVuZ3RoID09PSAwXG5cdFx0KTtcblx0XHRjb25zdCBhY3R1YWwgPSBzZXJpYWxpemVQaXBlUG9zaXRpb25zKHRleHQsIGFjdHVhbFN0b3BzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgRVhQRUNURUQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTU4NjY3OiBjdXJzb3JXb3JkUGFydExlZnQgc3RvcHMgYXQgXCItXCIgZXZlbiB3aGVuIFwiLVwiIGlzIG5vdCBpbiB3b3JkIHNlcGFyYXRvcnMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgRVhQRUNURUQgPSBbXG5cdFx0XHQnfHRoaXMtfGlzLXxhLXxrZWJhYi18Y2FzZS18dmFyfCB8VEhJUy18SVMtfENBUFMtfEtFQkFCfCB8dGhpcy18SVN8TWl4ZWR8VXNlJyxcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IFt0ZXh0LF0gPSBkZXNlcmlhbGl6ZVBpcGVQb3NpdGlvbnMoRVhQRUNURUQpO1xuXHRcdGNvbnN0IGFjdHVhbFN0b3BzID0gdGVzdFJlcGVhdGVkQWN0aW9uQW5kRXh0cmFjdFBvc2l0aW9ucyhcblx0XHRcdHRleHQsXG5cdFx0XHRuZXcgUG9zaXRpb24oMTAwMCwgMTAwMCksXG5cdFx0XHRlZCA9PiBjdXJzb3JXb3JkUGFydExlZnQoZWQpLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEsXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpIS5lcXVhbHMobmV3IFBvc2l0aW9uKDEsIDEpKSxcblx0XHRcdHsgd29yZFNlcGFyYXRvcnM6IFwiIVxcXCIjJicoKSorLC4vOjs8PT4/QFtcXFxcXV5ge3x9XHUwMEI3XCIgfSAvLyBkZWZhdWx0IGNoYXJhY3RlcnMgc2FucyAnJC0lficgcGx1cyAnXHUwMEI3J1xuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE1ODY2NzogY3Vyc29yV29yZFBhcnRSaWdodCBzdG9wcyBhdCBcIi1cIiBldmVuIHdoZW4gXCItXCIgaXMgbm90IGluIHdvcmQgc2VwYXJhdG9ycycsICgpID0+IHtcblx0XHRjb25zdCBFWFBFQ1RFRCA9IFtcblx0XHRcdCd0aGlzfC1pc3wtYXwta2ViYWJ8LWNhc2V8LXZhcnwgfFRISVN8LUlTfC1DQVBTfC1LRUJBQnwgfHRoaXN8LUlTfE1peGVkfFVzZXwnLFxuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgW3RleHQsXSA9IGRlc2VyaWFsaXplUGlwZVBvc2l0aW9ucyhFWFBFQ1RFRCk7XG5cdFx0Y29uc3QgYWN0dWFsU3RvcHMgPSB0ZXN0UmVwZWF0ZWRBY3Rpb25BbmRFeHRyYWN0UG9zaXRpb25zKFxuXHRcdFx0dGV4dCxcblx0XHRcdG5ldyBQb3NpdGlvbigxLCAxKSxcblx0XHRcdGVkID0+IGN1cnNvcldvcmRQYXJ0UmlnaHQoZWQpLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEsXG5cdFx0XHRlZCA9PiBlZC5nZXRQb3NpdGlvbigpIS5lcXVhbHMobmV3IFBvc2l0aW9uKDEsIDYwKSksXG5cdFx0XHR7IHdvcmRTZXBhcmF0b3JzOiBcIiFcXFwiIyYnKCkqKywuLzo7PD0+P0BbXFxcXF1eYHt8fVx1MDBCN1wiIH0gLy8gZGVmYXVsdCBjaGFyYWN0ZXJzIHNhbnMgJyQtJX4nIHBsdXMgJ1x1MDBCNydcblx0XHQpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHNlcmlhbGl6ZVBpcGVQb3NpdGlvbnModGV4dCwgYWN0dWFsU3RvcHMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBFWFBFQ1RFRCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxNTg2Njc6IGRlbGV0ZVdvcmRQYXJ0TGVmdCBzdG9wcyBhdCBcIi1cIiBldmVuIHdoZW4gXCItXCIgaXMgbm90IGluIHdvcmQgc2VwYXJhdG9ycycsICgpID0+IHtcblx0XHRjb25zdCBFWFBFQ1RFRCA9IFtcblx0XHRcdCd8dGhpcy18aXMtfGEtfGtlYmFiLXxjYXNlLXx2YXJ8IHxUSElTLXxJUy18Q0FQUy18S0VCQUJ8IHx0aGlzLXxJU3xNaXhlZHxVc2UnLFxuXHRcdF0uam9pbignICcpO1xuXHRcdGNvbnN0IFt0ZXh0LF0gPSBkZXNlcmlhbGl6ZVBpcGVQb3NpdGlvbnMoRVhQRUNURUQpO1xuXHRcdGNvbnN0IGFjdHVhbFN0b3BzID0gdGVzdFJlcGVhdGVkQWN0aW9uQW5kRXh0cmFjdFBvc2l0aW9ucyhcblx0XHRcdHRleHQsXG5cdFx0XHRuZXcgUG9zaXRpb24oMTAwMCwgMTAwMCksXG5cdFx0XHRlZCA9PiBkZWxldGVXb3JkUGFydExlZnQoZWQpLFxuXHRcdFx0ZWQgPT4gZWQuZ2V0UG9zaXRpb24oKSEsXG5cdFx0XHRlZCA9PiBlZC5nZXRWYWx1ZSgpLmxlbmd0aCA9PT0gMCxcblx0XHRcdHsgd29yZFNlcGFyYXRvcnM6IFwiIVxcXCIjJicoKSorLC4vOjs8PT4/QFtcXFxcXV5ge3x9XHUwMEI3XCIgfSAvLyBkZWZhdWx0IGNoYXJhY3RlcnMgc2FucyAnJC0lficgcGx1cyAnXHUwMEI3J1xuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE1ODY2NzogZGVsZXRlV29yZFBhcnRSaWdodCBzdG9wcyBhdCBcIi1cIiBldmVuIHdoZW4gXCItXCIgaXMgbm90IGluIHdvcmQgc2VwYXJhdG9ycycsICgpID0+IHtcblx0XHRjb25zdCBFWFBFQ1RFRCA9IFtcblx0XHRcdCd0aGlzfC1pc3wtYXwta2ViYWJ8LWNhc2V8LXZhcnwgfFRISVN8LUlTfC1DQVBTfC1LRUJBQnwgfHRoaXN8LUlTfE1peGVkfFVzZXwnLFxuXHRcdF0uam9pbignICcpO1xuXHRcdGNvbnN0IFt0ZXh0LF0gPSBkZXNlcmlhbGl6ZVBpcGVQb3NpdGlvbnMoRVhQRUNURUQpO1xuXHRcdGNvbnN0IGFjdHVhbFN0b3BzID0gdGVzdFJlcGVhdGVkQWN0aW9uQW5kRXh0cmFjdFBvc2l0aW9ucyhcblx0XHRcdHRleHQsXG5cdFx0XHRuZXcgUG9zaXRpb24oMSwgMSksXG5cdFx0XHRlZCA9PiBkZWxldGVXb3JkUGFydFJpZ2h0KGVkKSxcblx0XHRcdGVkID0+IG5ldyBQb3NpdGlvbigxLCB0ZXh0Lmxlbmd0aCAtIGVkLmdldFZhbHVlKCkubGVuZ3RoICsgMSksXG5cdFx0XHRlZCA9PiBlZC5nZXRWYWx1ZSgpLmxlbmd0aCA9PT0gMCxcblx0XHRcdHsgd29yZFNlcGFyYXRvcnM6IFwiIVxcXCIjJicoKSorLC4vOjs8PT4/QFtcXFxcXV5ge3x9XHUwMEI3XCIgfSAvLyBkZWZhdWx0IGNoYXJhY3RlcnMgc2FucyAnJC0lficgcGx1cyAnXHUwMEI3J1xuXHRcdCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gc2VyaWFsaXplUGlwZVBvc2l0aW9ucyh0ZXh0LCBhY3R1YWxTdG9wcyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIEVYUEVDVEVEKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLCtDQUErQztBQUd4RCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHFDQUFxQztBQUM5QyxTQUFTLDBCQUEwQix3QkFBd0IsNkNBQTZDO0FBQ3hHLFNBQVMsb0JBQW9CLDBCQUEwQixxQkFBcUIsMkJBQTJCLG9CQUFvQiwyQkFBMkI7QUFDdEosU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx3Q0FBd0M7QUFFakQsTUFBTSxzQkFBc0IsTUFBTTtBQUVqQywwQ0FBd0M7QUFFeEMsUUFBTSxzQkFBc0IsSUFBSSxtQkFBbUI7QUFDbkQsUUFBTSx1QkFBdUIsSUFBSSxvQkFBb0I7QUFDckQsUUFBTSxzQkFBc0IsSUFBSSxtQkFBbUI7QUFDbkQsUUFBTSw0QkFBNEIsSUFBSSx5QkFBeUI7QUFDL0QsUUFBTSx1QkFBdUIsSUFBSSxvQkFBb0I7QUFDckQsUUFBTSw2QkFBNkIsSUFBSSwwQkFBMEI7QUFFakUsUUFBTSxrQkFBa0IsSUFBSSxzQkFBc0IsRUFBRTtBQUFBLElBQ25EO0FBQUEsSUFDQSxJQUFJLGlDQUFpQztBQUFBLEVBQ3RDO0FBRUEsV0FBUyxpQkFBaUIsUUFBcUIsU0FBOEI7QUFDNUUsWUFBUSxpQkFBaUIsaUJBQWlCLFFBQVEsSUFBSTtBQUFBLEVBQ3ZEO0FBQ0EsV0FBUyxtQkFBbUIsUUFBcUIsa0JBQTJCLE9BQWE7QUFDeEYscUJBQWlCLFFBQVEsa0JBQWtCLDRCQUE0QixtQkFBbUI7QUFBQSxFQUMzRjtBQUNBLFdBQVMsb0JBQW9CLFFBQXFCLGtCQUEyQixPQUFhO0FBQ3pGLHFCQUFpQixRQUFRLGtCQUFrQiw2QkFBNkIsb0JBQW9CO0FBQUEsRUFDN0Y7QUFDQSxXQUFTLG1CQUFtQixRQUEyQjtBQUN0RCxxQkFBaUIsUUFBUSxtQkFBbUI7QUFBQSxFQUM3QztBQUNBLFdBQVMsb0JBQW9C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TUFDbkI7QUFBQSxNQUNBLElBQUksU0FBUyxHQUFHLENBQUM7QUFBQSxNQUNqQixRQUFNLG9CQUFvQixFQUFFO0FBQUEsTUFDNUIsUUFBTSxHQUFHLFlBQVk7QUFBQSxNQUNyQixRQUFNLEdBQUcsWUFBWSxFQUFHLE9BQU8sSUFBSSxTQUFTLEdBQUcsRUFBRSxDQUFDO0FBQUEsTUFDbEQsRUFBRSxnQkFBZ0Isb0NBQWlDO0FBQUE7QUFBQSxJQUNwRDtBQUNBLFVBQU0sU0FBUyx1QkFBdUIsTUFBTSxXQUFXO0FBQ3ZELFdBQU8sZ0JBQWdCLFFBQVEsUUFBUTtBQUFBLEVBQ3hDLENBQUM7QUFFRCxPQUFLLDBGQUEwRixNQUFNO0FBQ3BHLFVBQU0sV0FBVztBQUFBLE1BQ2hCO0FBQUEsSUFDRCxFQUFFLEtBQUssR0FBRztBQUNWLFVBQU0sQ0FBQyxJQUFLLElBQUkseUJBQXlCLFFBQVE7QUFDakQsVUFBTSxjQUFjO0FBQUEsTUFDbkI7QUFBQSxNQUNBLElBQUksU0FBUyxLQUFNLEdBQUk7QUFBQSxNQUN2QixRQUFNLG1CQUFtQixFQUFFO0FBQUEsTUFDM0IsUUFBTSxHQUFHLFlBQVk7QUFBQSxNQUNyQixRQUFNLEdBQUcsU0FBUyxFQUFFLFdBQVc7QUFBQSxNQUMvQixFQUFFLGdCQUFnQixvQ0FBaUM7QUFBQTtBQUFBLElBQ3BEO0FBQ0EsVUFBTSxTQUFTLHVCQUF1QixNQUFNLFdBQVc7QUFDdkQsV0FBTyxnQkFBZ0IsUUFBUSxRQUFRO0FBQUEsRUFDeEMsQ0FBQztBQUVELE9BQUssMkZBQTJGLE1BQU07QUFDckcsVUFBTSxXQUFXO0FBQUEsTUFDaEI7QUFBQSxJQUNELEVBQUUsS0FBSyxHQUFHO0FBQ1YsVUFBTSxDQUFDLElBQUssSUFBSSx5QkFBeUIsUUFBUTtBQUNqRCxVQUFNLGNBQWM7QUFBQSxNQUNuQjtBQUFBLE1BQ0EsSUFBSSxTQUFTLEdBQUcsQ0FBQztBQUFBLE1BQ2pCLFFBQU0sb0JBQW9CLEVBQUU7QUFBQSxNQUM1QixRQUFNLElBQUksU0FBUyxHQUFHLEtBQUssU0FBUyxHQUFHLFNBQVMsRUFBRSxTQUFTLENBQUM7QUFBQSxNQUM1RCxRQUFNLEdBQUcsU0FBUyxFQUFFLFdBQVc7QUFBQSxNQUMvQixFQUFFLGdCQUFnQixvQ0FBaUM7QUFBQTtBQUFBLElBQ3BEO0FBQ0EsVUFBTSxTQUFTLHVCQUF1QixNQUFNLFdBQVc7QUFDdkQsV0FBTyxnQkFBZ0IsUUFBUSxRQUFRO0FBQUEsRUFDeEMsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
