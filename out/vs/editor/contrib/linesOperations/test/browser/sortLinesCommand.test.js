import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Selection } from "../../../../common/core/selection.js";
import { SortLinesCommand } from "../../browser/sortLinesCommand.js";
import { testCommand } from "../../../../test/browser/testCommand.js";
function testSortLinesAscendingCommand(lines, selection, expectedLines, expectedSelection) {
  testCommand(lines, null, selection, (accessor, sel) => new SortLinesCommand(sel, false), expectedLines, expectedSelection);
}
function testSortLinesDescendingCommand(lines, selection, expectedLines, expectedSelection) {
  testCommand(lines, null, selection, (accessor, sel) => new SortLinesCommand(sel, true), expectedLines, expectedSelection);
}
suite("Editor Contrib - Sort Lines Command", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("no op unless at least two lines selected 1", function() {
    testSortLinesAscendingCommand(
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
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 3, 1, 1)
    );
  });
  test("no op unless at least two lines selected 2", function() {
    testSortLinesAscendingCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 3, 2, 1),
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 3, 2, 1)
    );
  });
  test("sorting two lines ascending", function() {
    testSortLinesAscendingCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(3, 3, 4, 2),
      [
        "first",
        "second line",
        "fourth line",
        "third line",
        "fifth"
      ],
      new Selection(3, 3, 4, 1)
    );
  });
  test("sorting first 4 lines ascending", function() {
    testSortLinesAscendingCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 5, 1),
      [
        "first",
        "fourth line",
        "second line",
        "third line",
        "fifth"
      ],
      new Selection(1, 1, 5, 1)
    );
  });
  test("sorting all lines ascending", function() {
    testSortLinesAscendingCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 5, 6),
      [
        "fifth",
        "first",
        "fourth line",
        "second line",
        "third line"
      ],
      new Selection(1, 1, 5, 11)
    );
  });
  test("sorting first 4 lines descending", function() {
    testSortLinesDescendingCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 5, 1),
      [
        "third line",
        "second line",
        "fourth line",
        "first",
        "fifth"
      ],
      new Selection(1, 1, 5, 1)
    );
  });
  test("sorting all lines descending", function() {
    testSortLinesDescendingCommand(
      [
        "first",
        "second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 5, 6),
      [
        "third line",
        "second line",
        "fourth line",
        "first",
        "fifth"
      ],
      new Selection(1, 1, 5, 6)
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9saW5lc09wZXJhdGlvbnMvdGVzdC9icm93c2VyL3NvcnRMaW5lc0NvbW1hbmQudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCB7IFNvcnRMaW5lc0NvbW1hbmQgfSBmcm9tICcuLi8uLi9icm93c2VyL3NvcnRMaW5lc0NvbW1hbmQuanMnO1xuaW1wb3J0IHsgdGVzdENvbW1hbmQgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvdGVzdENvbW1hbmQuanMnO1xuXG5mdW5jdGlvbiB0ZXN0U29ydExpbmVzQXNjZW5kaW5nQ29tbWFuZChsaW5lczogc3RyaW5nW10sIHNlbGVjdGlvbjogU2VsZWN0aW9uLCBleHBlY3RlZExpbmVzOiBzdHJpbmdbXSwgZXhwZWN0ZWRTZWxlY3Rpb246IFNlbGVjdGlvbik6IHZvaWQge1xuXHR0ZXN0Q29tbWFuZChsaW5lcywgbnVsbCwgc2VsZWN0aW9uLCAoYWNjZXNzb3IsIHNlbCkgPT4gbmV3IFNvcnRMaW5lc0NvbW1hbmQoc2VsLCBmYWxzZSksIGV4cGVjdGVkTGluZXMsIGV4cGVjdGVkU2VsZWN0aW9uKTtcbn1cblxuZnVuY3Rpb24gdGVzdFNvcnRMaW5lc0Rlc2NlbmRpbmdDb21tYW5kKGxpbmVzOiBzdHJpbmdbXSwgc2VsZWN0aW9uOiBTZWxlY3Rpb24sIGV4cGVjdGVkTGluZXM6IHN0cmluZ1tdLCBleHBlY3RlZFNlbGVjdGlvbjogU2VsZWN0aW9uKTogdm9pZCB7XG5cdHRlc3RDb21tYW5kKGxpbmVzLCBudWxsLCBzZWxlY3Rpb24sIChhY2Nlc3Nvciwgc2VsKSA9PiBuZXcgU29ydExpbmVzQ29tbWFuZChzZWwsIHRydWUpLCBleHBlY3RlZExpbmVzLCBleHBlY3RlZFNlbGVjdGlvbik7XG59XG5cbnN1aXRlKCdFZGl0b3IgQ29udHJpYiAtIFNvcnQgTGluZXMgQ29tbWFuZCcsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdubyBvcCB1bmxlc3MgYXQgbGVhc3QgdHdvIGxpbmVzIHNlbGVjdGVkIDEnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdFNvcnRMaW5lc0FzY2VuZGluZ0NvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMywgMSwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMywgMSwgMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdubyBvcCB1bmxlc3MgYXQgbGVhc3QgdHdvIGxpbmVzIHNlbGVjdGVkIDInLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdFNvcnRMaW5lc0FzY2VuZGluZ0NvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMywgMiwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMywgMiwgMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdzb3J0aW5nIHR3byBsaW5lcyBhc2NlbmRpbmcnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdFNvcnRMaW5lc0FzY2VuZGluZ0NvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMywgMywgNCwgMiksXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMywgMywgNCwgMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdzb3J0aW5nIGZpcnN0IDQgbGluZXMgYXNjZW5kaW5nJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RTb3J0TGluZXNBc2NlbmRpbmdDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDUsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDUsIDEpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnc29ydGluZyBhbGwgbGluZXMgYXNjZW5kaW5nJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RTb3J0TGluZXNBc2NlbmRpbmdDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDUsIDYpLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlmdGgnLFxuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCA1LCAxMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdzb3J0aW5nIGZpcnN0IDQgbGluZXMgZGVzY2VuZGluZycsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0U29ydExpbmVzRGVzY2VuZGluZ0NvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgNSwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgNSwgMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdzb3J0aW5nIGFsbCBsaW5lcyBkZXNjZW5kaW5nJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RTb3J0TGluZXNEZXNjZW5kaW5nQ29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCA1LCA2KSxcblx0XHRcdFtcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnZmlmdGgnLFxuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgNSwgNilcblx0XHQpO1xuXHR9KTtcbn0pO1xuIl0s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
