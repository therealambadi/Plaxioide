import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Selection } from "../../../../common/core/selection.js";
import { CopyLinesCommand } from "../../browser/copyLinesCommand.js";
import { DuplicateSelectionAction } from "../../browser/linesOperations.js";
import { withTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
import { testCommand } from "../../../../test/browser/testCommand.js";
function testCopyLinesDownCommand(lines, selection, expectedLines, expectedSelection) {
  testCommand(lines, null, selection, (accessor, sel) => new CopyLinesCommand(sel, true), expectedLines, expectedSelection);
}
function testCopyLinesUpCommand(lines, selection, expectedLines, expectedSelection) {
  testCommand(lines, null, selection, (accessor, sel) => new CopyLinesCommand(sel, false), expectedLines, expectedSelection);
}
suite("Editor Contrib - Copy Lines Command", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("copy first line down", function() {
    testCopyLinesDownCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 3, 1, 1),
      [
        "first",
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 3, 2, 1)
    );
  });
  test("copy first line up", function() {
    testCopyLinesUpCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 3, 1, 1),
      [
        "first",
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 3, 1, 1)
    );
  });
  test("copy last line down", function() {
    testCopyLinesDownCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(5, 3, 5, 1),
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth",
        "fifth"
      ],
      new Selection(6, 3, 6, 1)
    );
  });
  test("copy last line up", function() {
    testCopyLinesUpCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(5, 3, 5, 1),
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth",
        "fifth"
      ],
      new Selection(5, 3, 5, 1)
    );
  });
  test("issue #1322: copy line up", function() {
    testCopyLinesUpCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(3, 11, 3, 11),
      [
        "first",
        "second line",
        "third line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(3, 11, 3, 11)
    );
  });
  test("issue #1322: copy last line up", function() {
    testCopyLinesUpCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(5, 6, 5, 6),
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth",
        "fifth"
      ],
      new Selection(5, 6, 5, 6)
    );
  });
  test("copy many lines up", function() {
    testCopyLinesUpCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(4, 3, 2, 1),
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(4, 3, 2, 1)
    );
  });
  test("ignore empty selection", function() {
    testCopyLinesUpCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 1, 1, 1),
      [
        "first",
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 1, 1, 1)
    );
  });
});
suite("Editor Contrib - Duplicate Selection", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const duplicateSelectionAction = new DuplicateSelectionAction();
  function testDuplicateSelectionAction(lines, selections, expectedLines, expectedSelections) {
    withTestCodeEditor(lines.join("\n"), {}, (editor) => {
      editor.setSelections(selections);
      duplicateSelectionAction.run(null, editor, {});
      assert.deepStrictEqual(editor.getValue(), expectedLines.join("\n"));
      assert.deepStrictEqual(editor.getSelections().map((s) => s.toString()), expectedSelections.map((s) => s.toString()));
    });
  }
  test("empty selection", function() {
    testDuplicateSelectionAction(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      [new Selection(2, 2, 2, 2), new Selection(3, 2, 3, 2)],
      [
        "first",
        "second line",
        "second line",
        "third line",
        "third line",
        "fourth line",
        "fifth"
      ],
      [new Selection(3, 2, 3, 2), new Selection(5, 2, 5, 2)]
    );
  });
  test("with selection", function() {
    testDuplicateSelectionAction(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      [new Selection(2, 1, 2, 4), new Selection(3, 1, 3, 4)],
      [
        "first",
        "secsecond line",
        "thithird line",
        "fourth line",
        "fifth"
      ],
      [new Selection(2, 4, 2, 7), new Selection(3, 4, 3, 7)]
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9saW5lc09wZXJhdGlvbnMvdGVzdC9icm93c2VyL2NvcHlMaW5lc0NvbW1hbmQudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IENvcHlMaW5lc0NvbW1hbmQgfSBmcm9tICcuLi8uLi9icm93c2VyL2NvcHlMaW5lc0NvbW1hbmQuanMnO1xuaW1wb3J0IHsgRHVwbGljYXRlU2VsZWN0aW9uQWN0aW9uIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9saW5lc09wZXJhdGlvbnMuanMnO1xuaW1wb3J0IHsgd2l0aFRlc3RDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3Rlc3RDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IHRlc3RDb21tYW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3Rlc3RDb21tYW5kLmpzJztcblxuZnVuY3Rpb24gdGVzdENvcHlMaW5lc0Rvd25Db21tYW5kKGxpbmVzOiBzdHJpbmdbXSwgc2VsZWN0aW9uOiBTZWxlY3Rpb24sIGV4cGVjdGVkTGluZXM6IHN0cmluZ1tdLCBleHBlY3RlZFNlbGVjdGlvbjogU2VsZWN0aW9uKTogdm9pZCB7XG5cdHRlc3RDb21tYW5kKGxpbmVzLCBudWxsLCBzZWxlY3Rpb24sIChhY2Nlc3Nvciwgc2VsKSA9PiBuZXcgQ29weUxpbmVzQ29tbWFuZChzZWwsIHRydWUpLCBleHBlY3RlZExpbmVzLCBleHBlY3RlZFNlbGVjdGlvbik7XG59XG5cbmZ1bmN0aW9uIHRlc3RDb3B5TGluZXNVcENvbW1hbmQobGluZXM6IHN0cmluZ1tdLCBzZWxlY3Rpb246IFNlbGVjdGlvbiwgZXhwZWN0ZWRMaW5lczogc3RyaW5nW10sIGV4cGVjdGVkU2VsZWN0aW9uOiBTZWxlY3Rpb24pOiB2b2lkIHtcblx0dGVzdENvbW1hbmQobGluZXMsIG51bGwsIHNlbGVjdGlvbiwgKGFjY2Vzc29yLCBzZWwpID0+IG5ldyBDb3B5TGluZXNDb21tYW5kKHNlbCwgZmFsc2UpLCBleHBlY3RlZExpbmVzLCBleHBlY3RlZFNlbGVjdGlvbik7XG59XG5cbnN1aXRlKCdFZGl0b3IgQ29udHJpYiAtIENvcHkgTGluZXMgQ29tbWFuZCcsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdjb3B5IGZpcnN0IGxpbmUgZG93bicsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0Q29weUxpbmVzRG93bkNvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMywgMSwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMywgMiwgMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdjb3B5IGZpcnN0IGxpbmUgdXAnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdENvcHlMaW5lc1VwQ29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAzLCAxLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAzLCAxLCAxKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvcHkgbGFzdCBsaW5lIGRvd24nLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdENvcHlMaW5lc0Rvd25Db21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDUsIDMsIDUsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCcsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDYsIDMsIDYsIDEpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnY29weSBsYXN0IGxpbmUgdXAnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdENvcHlMaW5lc1VwQ29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig1LCAzLCA1LCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig1LCAzLCA1LCAxKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMzIyOiBjb3B5IGxpbmUgdXAnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdENvcHlMaW5lc1VwQ29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigzLCAxMSwgMywgMTEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMywgMTEsIDMsIDExKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMzIyOiBjb3B5IGxhc3QgbGluZSB1cCcsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0Q29weUxpbmVzVXBDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDUsIDYsIDUsIDYpLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCcsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDUsIDYsIDUsIDYpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnY29weSBtYW55IGxpbmVzIHVwJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RDb3B5TGluZXNVcENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgMywgMiwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig0LCAzLCAyLCAxKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lnbm9yZSBlbXB0eSBzZWxlY3Rpb24nLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdENvcHlMaW5lc1VwQ29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxLCAxLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxLCAxLCAxKVxuXHRcdCk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdFZGl0b3IgQ29udHJpYiAtIER1cGxpY2F0ZSBTZWxlY3Rpb24nLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0Y29uc3QgZHVwbGljYXRlU2VsZWN0aW9uQWN0aW9uID0gbmV3IER1cGxpY2F0ZVNlbGVjdGlvbkFjdGlvbigpO1xuXG5cdGZ1bmN0aW9uIHRlc3REdXBsaWNhdGVTZWxlY3Rpb25BY3Rpb24obGluZXM6IHN0cmluZ1tdLCBzZWxlY3Rpb25zOiBTZWxlY3Rpb25bXSwgZXhwZWN0ZWRMaW5lczogc3RyaW5nW10sIGV4cGVjdGVkU2VsZWN0aW9uczogU2VsZWN0aW9uW10pOiB2b2lkIHtcblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobGluZXMuam9pbignXFxuJyksIHt9LCAoZWRpdG9yKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9ucyhzZWxlY3Rpb25zKTtcblx0XHRcdGR1cGxpY2F0ZVNlbGVjdGlvbkFjdGlvbi5ydW4obnVsbCEsIGVkaXRvciwge30pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0b3IuZ2V0VmFsdWUoKSwgZXhwZWN0ZWRMaW5lcy5qb2luKCdcXG4nKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRvci5nZXRTZWxlY3Rpb25zKCkhLm1hcChzID0+IHMudG9TdHJpbmcoKSksIGV4cGVjdGVkU2VsZWN0aW9ucy5tYXAocyA9PiBzLnRvU3RyaW5nKCkpKTtcblx0XHR9KTtcblx0fVxuXG5cdHRlc3QoJ2VtcHR5IHNlbGVjdGlvbicsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0RHVwbGljYXRlU2VsZWN0aW9uQWN0aW9uKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRbbmV3IFNlbGVjdGlvbigyLCAyLCAyLCAyKSwgbmV3IFNlbGVjdGlvbigzLCAyLCAzLCAyKV0sXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0W25ldyBTZWxlY3Rpb24oMywgMiwgMywgMiksIG5ldyBTZWxlY3Rpb24oNSwgMiwgNSwgMildXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnd2l0aCBzZWxlY3Rpb24nLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdER1cGxpY2F0ZVNlbGVjdGlvbkFjdGlvbihcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0W25ldyBTZWxlY3Rpb24oMiwgMSwgMiwgNCksIG5ldyBTZWxlY3Rpb24oMywgMSwgMywgNCldLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpdGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRbbmV3IFNlbGVjdGlvbigyLCA0LCAyLCA3KSwgbmV3IFNlbGVjdGlvbigzLCA0LCAzLCA3KV1cblx0XHQpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsbUJBQW1CO0FBRTVCLFNBQVMseUJBQXlCLE9BQWlCLFdBQXNCLGVBQXlCLG1CQUFvQztBQUNySSxjQUFZLE9BQU8sTUFBTSxXQUFXLENBQUMsVUFBVSxRQUFRLElBQUksaUJBQWlCLEtBQUssSUFBSSxHQUFHLGVBQWUsaUJBQWlCO0FBQ3pIO0FBRUEsU0FBUyx1QkFBdUIsT0FBaUIsV0FBc0IsZUFBeUIsbUJBQW9DO0FBQ25JLGNBQVksT0FBTyxNQUFNLFdBQVcsQ0FBQyxVQUFVLFFB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
