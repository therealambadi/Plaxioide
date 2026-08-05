import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Selection } from "../../../../common/core/selection.js";
import { ILanguageService } from "../../../../common/languages/language.js";
import { ILanguageConfigurationService } from "../../../../common/languages/languageConfigurationRegistry.js";
import { BlockCommentCommand } from "../../browser/blockCommentCommand.js";
import { testCommand } from "../../../../test/browser/testCommand.js";
function _testCommentCommand(lines, selection, commandFactory, expectedLines, expectedSelection) {
  const languageId = "commentMode";
  const prepare = (accessor, disposables) => {
    const languageConfigurationService = accessor.get(ILanguageConfigurationService);
    const languageService = accessor.get(ILanguageService);
    disposables.add(languageService.registerLanguage({ id: languageId }));
    disposables.add(languageConfigurationService.register(languageId, {
      comments: { lineComment: "!@#", blockComment: ["<0", "0>"] }
    }));
  };
  testCommand(lines, languageId, selection, commandFactory, expectedLines, expectedSelection, void 0, prepare);
}
function testBlockCommentCommand(lines, selection, expectedLines, expectedSelection) {
  _testCommentCommand(lines, selection, (accessor, sel) => new BlockCommentCommand(sel, true, accessor.get(ILanguageConfigurationService)), expectedLines, expectedSelection);
}
suite("Editor Contrib - Block Comment Command", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("empty selection wraps itself", function() {
    testBlockCommentCommand(
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 3, 1, 3),
      [
        "fi<0  0>rst",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 6, 1, 6)
    );
  });
  test("invisible selection ignored", function() {
    testBlockCommentCommand(
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 1, 1, 1),
      [
        "<0 first",
        " 0>	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 4, 2, 1)
    );
  });
  test("bug9511", () => {
    testBlockCommentCommand(
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 6, 1, 1),
      [
        "<0 first 0>",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 4, 1, 9)
    );
    testBlockCommentCommand(
      [
        "<0first0>",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 8, 1, 3),
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 1, 6)
    );
  });
  test("one line selection", function() {
    testBlockCommentCommand(
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 6, 1, 3),
      [
        "fi<0 rst 0>",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 6, 1, 9)
    );
  });
  test("one line selection toggle", function() {
    testBlockCommentCommand(
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 6, 1, 3),
      [
        "fi<0 rst 0>",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 6, 1, 9)
    );
    testBlockCommentCommand(
      [
        "fi<0rst0>",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 8, 1, 5),
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 3, 1, 6)
    );
    testBlockCommentCommand(
      [
        "<0 first 0>",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 10, 1, 1),
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 1, 6)
    );
    testBlockCommentCommand(
      [
        "<0 first0>",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 9, 1, 1),
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 1, 6)
    );
    testBlockCommentCommand(
      [
        "<0first 0>",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 9, 1, 1),
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 1, 6)
    );
    testBlockCommentCommand(
      [
        "fi<0rst0>",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 8, 1, 5),
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 3, 1, 6)
    );
  });
  test("multi line selection", function() {
    testBlockCommentCommand(
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 4, 1, 1),
      [
        "<0 first",
        "	se 0>cond line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 4, 2, 4)
    );
  });
  test("multi line selection toggle", function() {
    testBlockCommentCommand(
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 4, 1, 1),
      [
        "<0 first",
        "	se 0>cond line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 4, 2, 4)
    );
    testBlockCommentCommand(
      [
        "<0first",
        "	se0>cond line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 4, 1, 3),
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 2, 4)
    );
    testBlockCommentCommand(
      [
        "<0 first",
        "	se0>cond line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 4, 1, 3),
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 2, 4)
    );
    testBlockCommentCommand(
      [
        "<0first",
        "	se 0>cond line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 4, 1, 3),
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 2, 4)
    );
    testBlockCommentCommand(
      [
        "<0 first",
        "	se 0>cond line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 4, 1, 3),
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 2, 4)
    );
  });
  test("fuzzy removes", function() {
    testBlockCommentCommand(
      [
        "asd <0 qwe",
        "asd 0> qwe"
      ],
      new Selection(2, 5, 1, 7),
      [
        "asd qwe",
        "asd qwe"
      ],
      new Selection(1, 5, 2, 4)
    );
    testBlockCommentCommand(
      [
        "asd <0 qwe",
        "asd 0> qwe"
      ],
      new Selection(2, 5, 1, 6),
      [
        "asd qwe",
        "asd qwe"
      ],
      new Selection(1, 5, 2, 4)
    );
    testBlockCommentCommand(
      [
        "asd <0 qwe",
        "asd 0> qwe"
      ],
      new Selection(2, 5, 1, 5),
      [
        "asd qwe",
        "asd qwe"
      ],
      new Selection(1, 5, 2, 4)
    );
    testBlockCommentCommand(
      [
        "asd <0 qwe",
        "asd 0> qwe"
      ],
      new Selection(2, 5, 1, 11),
      [
        "asd qwe",
        "asd qwe"
      ],
      new Selection(1, 5, 2, 4)
    );
    testBlockCommentCommand(
      [
        "asd <0 qwe",
        "asd 0> qwe"
      ],
      new Selection(2, 1, 1, 11),
      [
        "asd qwe",
        "asd qwe"
      ],
      new Selection(1, 5, 2, 4)
    );
    testBlockCommentCommand(
      [
        "asd <0 qwe",
        "asd 0> qwe"
      ],
      new Selection(2, 7, 1, 11),
      [
        "asd qwe",
        "asd qwe"
      ],
      new Selection(1, 5, 2, 4)
    );
  });
  test("bug #30358", function() {
    testBlockCommentCommand(
      [
        "<0 start 0> middle end"
      ],
      new Selection(1, 20, 1, 23),
      [
        "<0 start 0> middle <0 end 0>"
      ],
      new Selection(1, 23, 1, 26)
    );
    testBlockCommentCommand(
      [
        "<0 start 0> middle <0 end 0>"
      ],
      new Selection(1, 13, 1, 19),
      [
        "<0 start 0> <0 middle 0> <0 end 0>"
      ],
      new Selection(1, 16, 1, 22)
    );
  });
  test("issue #34618", function() {
    testBlockCommentCommand(
      [
        "<0  0> middle end"
      ],
      new Selection(1, 4, 1, 4),
      [
        " middle end"
      ],
      new Selection(1, 1, 1, 1)
    );
  });
  test("insertSpace false", () => {
    function testLineCommentCommand(lines, selection, expectedLines, expectedSelection) {
      _testCommentCommand(lines, selection, (accessor, sel) => new BlockCommentCommand(sel, false, accessor.get(ILanguageConfigurationService)), expectedLines, expectedSelection);
    }
    testLineCommentCommand(
      [
        "some text"
      ],
      new Selection(1, 1, 1, 5),
      [
        "<0some0> text"
      ],
      new Selection(1, 3, 1, 7)
    );
  });
  test("insertSpace false does not remove space", () => {
    function testLineCommentCommand(lines, selection, expectedLines, expectedSelection) {
      _testCommentCommand(lines, selection, (accessor, sel) => new BlockCommentCommand(sel, false, accessor.get(ILanguageConfigurationService)), expectedLines, expectedSelection);
    }
    testLineCommentCommand(
      [
        "<0 some 0> text"
      ],
      new Selection(1, 4, 1, 8),
      [
        " some  text"
      ],
      new Selection(1, 1, 1, 7)
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9jb21tZW50L3Rlc3QvYnJvd3Nlci9ibG9ja0NvbW1lbnRDb21tYW5kLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUNvbW1hbmQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yQ29tbW9uLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBCbG9ja0NvbW1lbnRDb21tYW5kIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9ibG9ja0NvbW1lbnRDb21tYW5kLmpzJztcbmltcG9ydCB7IHRlc3RDb21tYW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3Rlc3RDb21tYW5kLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcblxuZnVuY3Rpb24gX3Rlc3RDb21tZW50Q29tbWFuZChsaW5lczogc3RyaW5nW10sIHNlbGVjdGlvbjogU2VsZWN0aW9uLCBjb21tYW5kRmFjdG9yeTogKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBzZWxlY3Rpb246IFNlbGVjdGlvbikgPT4gSUNvbW1hbmQsIGV4cGVjdGVkTGluZXM6IHN0cmluZ1tdLCBleHBlY3RlZFNlbGVjdGlvbjogU2VsZWN0aW9uKTogdm9pZCB7XG5cdGNvbnN0IGxhbmd1YWdlSWQgPSAnY29tbWVudE1vZGUnO1xuXHRjb25zdCBwcmVwYXJlID0gKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlKSA9PiB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZVNlcnZpY2UpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiBsYW5ndWFnZUlkIH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5yZWdpc3RlcihsYW5ndWFnZUlkLCB7XG5cdFx0XHRjb21tZW50czogeyBsaW5lQ29tbWVudDogJyFAIycsIGJsb2NrQ29tbWVudDogWyc8MCcsICcwPiddIH1cblx0XHR9KSk7XG5cdH07XG5cdHRlc3RDb21tYW5kKGxpbmVzLCBsYW5ndWFnZUlkLCBzZWxlY3Rpb24sIGNvbW1hbmRGYWN0b3J5LCBleHBlY3RlZExpbmVzLCBleHBlY3RlZFNlbGVjdGlvbiwgdW5kZWZpbmVkLCBwcmVwYXJlKTtcbn1cblxuZnVuY3Rpb24gdGVzdEJsb2NrQ29tbWVudENvbW1hbmQobGluZXM6IHN0cmluZ1tdLCBzZWxlY3Rpb246IFNlbGVjdGlvbiwgZXhwZWN0ZWRMaW5lczogc3RyaW5nW10sIGV4cGVjdGVkU2VsZWN0aW9uOiBTZWxlY3Rpb24pOiB2b2lkIHtcblx0X3Rlc3RDb21tZW50Q29tbWFuZChsaW5lcywgc2VsZWN0aW9uLCAoYWNjZXNzb3IsIHNlbCkgPT4gbmV3IEJsb2NrQ29tbWVudENvbW1hbmQoc2VsLCB0cnVlLCBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpKSwgZXhwZWN0ZWRMaW5lcywgZXhwZWN0ZWRTZWxlY3Rpb24pO1xufVxuXG5zdWl0ZSgnRWRpdG9yIENvbnRyaWIgLSBCbG9jayBDb21tZW50IENvbW1hbmQnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnZW1wdHkgc2VsZWN0aW9uIHdyYXBzIGl0c2VsZicsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0QmxvY2tDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J1xcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKSxcblx0XHRcdFtcblx0XHRcdFx0J2ZpPDAgIDA+cnN0Jyxcblx0XHRcdFx0J1xcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCA2LCAxLCA2KVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ludmlzaWJsZSBzZWxlY3Rpb24gaWdub3JlZCcsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0QmxvY2tDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J1xcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxLCAxLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0JzwwIGZpcnN0Jyxcblx0XHRcdFx0JyAwPlxcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCA0LCAyLCAxKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2J1Zzk1MTEnLCAoKSA9PiB7XG5cdFx0dGVzdEJsb2NrQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNiwgMSwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCc8MCBmaXJzdCAwPicsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgOSlcblx0XHQpO1xuXG5cdFx0dGVzdEJsb2NrQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCc8MGZpcnN0MD4nLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDgsIDEsIDMpLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDYpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnb25lIGxpbmUgc2VsZWN0aW9uJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RCbG9ja0NvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDMpLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmk8MCByc3QgMD4nLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDkpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnb25lIGxpbmUgc2VsZWN0aW9uIHRvZ2dsZScsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0QmxvY2tDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J1xcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCA2LCAxLCAzKSxcblx0XHRcdFtcblx0XHRcdFx0J2ZpPDAgcnN0IDA+Jyxcblx0XHRcdFx0J1xcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCA2LCAxLCA5KVxuXHRcdCk7XG5cblx0XHR0ZXN0QmxvY2tDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpPDByc3QwPicsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgOCwgMSwgNSksXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMywgMSwgNilcblx0XHQpO1xuXG5cdFx0dGVzdEJsb2NrQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCc8MCBmaXJzdCAwPicsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMTAsIDEsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDYpXG5cdFx0KTtcblxuXHRcdHRlc3RCbG9ja0NvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnPDAgZmlyc3QwPicsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgOSwgMSwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNilcblx0XHQpO1xuXG5cdFx0dGVzdEJsb2NrQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCc8MGZpcnN0IDA+Jyxcblx0XHRcdFx0J1xcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCA5LCAxLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J1xcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCA2KVxuXHRcdCk7XG5cblx0XHR0ZXN0QmxvY2tDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpPDByc3QwPicsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgOCwgMSwgNSksXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMywgMSwgNilcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtdWx0aSBsaW5lIHNlbGVjdGlvbicsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0QmxvY2tDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J1xcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCA0LCAxLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0JzwwIGZpcnN0Jyxcblx0XHRcdFx0J1xcdHNlIDA+Y29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCA0LCAyLCA0KVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpIGxpbmUgc2VsZWN0aW9uIHRvZ2dsZScsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0QmxvY2tDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J1xcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCA0LCAxLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0JzwwIGZpcnN0Jyxcblx0XHRcdFx0J1xcdHNlIDA+Y29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCA0LCAyLCA0KVxuXHRcdCk7XG5cblx0XHR0ZXN0QmxvY2tDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0JzwwZmlyc3QnLFxuXHRcdFx0XHQnXFx0c2UwPmNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgNCwgMSwgMyksXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMiwgNClcblx0XHQpO1xuXG5cdFx0dGVzdEJsb2NrQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCc8MCBmaXJzdCcsXG5cdFx0XHRcdCdcXHRzZTA+Y29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCA0LCAxLCAzKSxcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J1xcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAyLCA0KVxuXHRcdCk7XG5cblx0XHR0ZXN0QmxvY2tDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0JzwwZmlyc3QnLFxuXHRcdFx0XHQnXFx0c2UgMD5jb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDQsIDEsIDMpLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDIsIDQpXG5cdFx0KTtcblxuXHRcdHRlc3RCbG9ja0NvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnPDAgZmlyc3QnLFxuXHRcdFx0XHQnXFx0c2UgMD5jb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDQsIDEsIDMpLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDIsIDQpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZnV6enkgcmVtb3ZlcycsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0QmxvY2tDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2FzZCA8MCBxd2UnLFxuXHRcdFx0XHQnYXNkIDA+IHF3ZSdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDUsIDEsIDcpLFxuXHRcdFx0W1xuXHRcdFx0XHQnYXNkIHF3ZScsXG5cdFx0XHRcdCdhc2QgcXdlJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNSwgMiwgNClcblx0XHQpO1xuXG5cdFx0dGVzdEJsb2NrQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdhc2QgPDAgcXdlJyxcblx0XHRcdFx0J2FzZCAwPiBxd2UnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCA1LCAxLCA2KSxcblx0XHRcdFtcblx0XHRcdFx0J2FzZCBxd2UnLFxuXHRcdFx0XHQnYXNkIHF3ZSdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDUsIDIsIDQpXG5cdFx0KTtcblxuXHRcdHRlc3RCbG9ja0NvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnYXNkIDwwIHF3ZScsXG5cdFx0XHRcdCdhc2QgMD4gcXdlJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgNSwgMSwgNSksXG5cdFx0XHRbXG5cdFx0XHRcdCdhc2QgcXdlJyxcblx0XHRcdFx0J2FzZCBxd2UnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCA1LCAyLCA0KVxuXHRcdCk7XG5cblx0XHR0ZXN0QmxvY2tDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2FzZCA8MCBxd2UnLFxuXHRcdFx0XHQnYXNkIDA+IHF3ZSdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDUsIDEsIDExKSxcblx0XHRcdFtcblx0XHRcdFx0J2FzZCBxd2UnLFxuXHRcdFx0XHQnYXNkIHF3ZSdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDUsIDIsIDQpXG5cdFx0KTtcblxuXHRcdHRlc3RCbG9ja0NvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnYXNkIDwwIHF3ZScsXG5cdFx0XHRcdCdhc2QgMD4gcXdlJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMSwgMSwgMTEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnYXNkIHF3ZScsXG5cdFx0XHRcdCdhc2QgcXdlJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNSwgMiwgNClcblx0XHQpO1xuXG5cdFx0dGVzdEJsb2NrQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdhc2QgPDAgcXdlJyxcblx0XHRcdFx0J2FzZCAwPiBxd2UnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCA3LCAxLCAxMSksXG5cdFx0XHRbXG5cdFx0XHRcdCdhc2QgcXdlJyxcblx0XHRcdFx0J2FzZCBxd2UnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCA1LCAyLCA0KVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2J1ZyAjMzAzNTgnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdEJsb2NrQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCc8MCBzdGFydCAwPiBtaWRkbGUgZW5kJyxcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDIwLCAxLCAyMyksXG5cdFx0XHRbXG5cdFx0XHRcdCc8MCBzdGFydCAwPiBtaWRkbGUgPDAgZW5kIDA+J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMjMsIDEsIDI2KVxuXHRcdCk7XG5cblx0XHR0ZXN0QmxvY2tDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0JzwwIHN0YXJ0IDA+IG1pZGRsZSA8MCBlbmQgMD4nXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxMywgMSwgMTkpLFxuXHRcdFx0W1xuXHRcdFx0XHQnPDAgc3RhcnQgMD4gPDAgbWlkZGxlIDA+IDwwIGVuZCAwPidcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDE2LCAxLCAyMilcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMzQ2MTgnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdEJsb2NrQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCc8MCAgMD4gbWlkZGxlIGVuZCcsXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCA0LCAxLCA0KSxcblx0XHRcdFtcblx0XHRcdFx0JyBtaWRkbGUgZW5kJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbnNlcnRTcGFjZSBmYWxzZScsICgpID0+IHtcblx0XHRmdW5jdGlvbiB0ZXN0TGluZUNvbW1lbnRDb21tYW5kKGxpbmVzOiBzdHJpbmdbXSwgc2VsZWN0aW9uOiBTZWxlY3Rpb24sIGV4cGVjdGVkTGluZXM6IHN0cmluZ1tdLCBleHBlY3RlZFNlbGVjdGlvbjogU2VsZWN0aW9uKTogdm9pZCB7XG5cdFx0XHRfdGVzdENvbW1lbnRDb21tYW5kKGxpbmVzLCBzZWxlY3Rpb24sIChhY2Nlc3Nvciwgc2VsKSA9PiBuZXcgQmxvY2tDb21tZW50Q29tbWFuZChzZWwsIGZhbHNlLCBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpKSwgZXhwZWN0ZWRMaW5lcywgZXhwZWN0ZWRTZWxlY3Rpb24pO1xuXHRcdH1cblxuXHRcdHRlc3RMaW5lQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdzb21lIHRleHQnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCA1KSxcblx0XHRcdFtcblx0XHRcdFx0Jzwwc29tZTA+IHRleHQnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAzLCAxLCA3KVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydFNwYWNlIGZhbHNlIGRvZXMgbm90IHJlbW92ZSBzcGFjZScsICgpID0+IHtcblx0XHRmdW5jdGlvbiB0ZXN0TGluZUNvbW1lbnRDb21tYW5kKGxpbmVzOiBzdHJpbmdbXSwgc2VsZWN0aW9uOiBTZWxlY3Rpb24sIGV4cGVjdGVkTGluZXM6IHN0cmluZ1tdLCBleHBlY3RlZFNlbGVjdGlvbjogU2VsZWN0aW9uKTogdm9pZCB7XG5cdFx0XHRfdGVzdENvbW1lbnRDb21tYW5kKGxpbmVzLCBzZWxlY3Rpb24sIChhY2Nlc3Nvciwgc2VsKSA9PiBuZXcgQmxvY2tDb21tZW50Q29tbWFuZChzZWwsIGZhbHNlLCBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpKSwgZXhwZWN0ZWRMaW5lcywgZXhwZWN0ZWRTZWxlY3Rpb24pO1xuXHRcdH1cblxuXHRcdHRlc3RMaW5lQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCc8MCBzb21lIDA+IHRleHQnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCA0LCAxLCA4KSxcblx0XHRcdFtcblx0XHRcdFx0JyBzb21lICB0ZXh0J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgNylcblx0XHQpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxpQkFBaUI7QUFFMUIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxtQkFBbUI7QUFHNUIsU0FBUyxvQkFBb0IsT0FBaUIsV0FBc0IsZ0JBQWdGLGVBQXlCLG1CQUFvQztBQUNoTixRQUFNLGFBQWE7QUFDbkIsUUFBTSxVQUFVLENBQUMsVUFBNEIsZ0JBQWlDO0FBQzdFLFVBQU0sK0JBQStCLFNBQVMsSUFBSSw2QkFBNkI7QUFDL0UsVUFBTSxrQkFBa0IsU0FBUyxJQUFJLGdCQUFnQjtBQUNyRCxnQkFBWSxJQUFJLGdCQUFnQixpQkFBaUIsRUFBRSxJQUFJLFdBQVcsQ0FBQyxDQUFDO0FBQ3BFLGdCQUFZLElBQUksNkJBQTZCLFNBQVMsWUFBWTtBQUFBLE1BQ2pFLFVBQVUsRUFBRSxhQUFhLE9BQU8sY0FBYyxDQUFDLE1BQU0sSUFBSSxFQUFFO0FBQUEsSUFDNUQsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUNBLGNBQVksT0FBTyxZQUFZLFdBQVcsZ0JBQWdCLGVBQWUsbUJBQW1CLFFBQVcsT0FBTztBQUMvRztBQUVBLFNBQVMsd0JBQXdCLE9BQWlCLFdBQXNCLGVBQXlCLG1CQUFvQztBQUNwSSxzQkFBb0IsT0FBTyxXQUFXLENBQUMsVUFBVSxRQUFRLElBQUksb0JBQW9CLEtBQUssTUFBTSxTQUFTLElBQUksNkJBQTZCLENBQUMsR0FBRyxlQUFlLGlCQUFpQjtBQUMzSztBQUVBLE1BQU0sMENBQTBDLE1BQU07QUFFckQsMENBQXdDO0FBRXhDLE9BQUssZ0NBQWdDLFdBQVk7QUFDaEQ7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSywrQkFBK0IsV0FBWTtBQUMvQztBQUFBLE1BQ0M7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDeEI7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsSUFDekI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLFdBQVcsTUFBTTtBQUNyQjtBQUFBLE1BQ0M7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDeEI7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsSUFDekI7QUFFQTtBQUFBLE1BQ0M7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDeEI7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsSUFDekI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHNCQUFzQixXQUFZO0FBQ3RDO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUN4QjtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxJQUN6QjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssNkJBQTZCLFdBQVk7QUFDN0M7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBRUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBRUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQztBQUFBLE1BQ3pCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBRUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBRUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBRUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyx3QkFBd0IsV0FBWTtBQUN4QztBQUFBLE1BQ0M7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDeEI7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsSUFDekI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLCtCQUErQixXQUFZO0FBQy9DO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUN4QjtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxJQUN6QjtBQUVBO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUN4QjtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxJQUN6QjtBQUVBO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUN4QjtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxJQUN6QjtBQUVBO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUN4QjtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxJQUN6QjtBQUVBO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUN4QjtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxJQUN6QjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssaUJBQWlCLFdBQVk7QUFDakM7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBRUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBRUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBRUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLE1BQ3pCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBRUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLE1BQ3pCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBRUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsRUFBRTtBQUFBLE1BQ3pCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxjQUFjLFdBQVk7QUFDOUI7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDMUI7QUFBQSxRQUNDO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFBQSxJQUMzQjtBQUVBO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLE1BQzFCO0FBQUEsUUFDQztBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsSUFDM0I7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLGdCQUFnQixXQUFZO0FBQ2hDO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsSUFDekI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHFCQUFxQixNQUFNO0FBQy9CLGFBQVMsdUJBQXVCLE9BQWlCLFdBQXNCLGVBQXlCLG1CQUFvQztBQUNuSSwwQkFBb0IsT0FBTyxXQUFXLENBQUMsVUFBVSxRQUFRLElBQUksb0JBQW9CLEtBQUssT0FBTyxTQUFTLElBQUksNkJBQTZCLENBQUMsR0FBRyxlQUFlLGlCQUFpQjtBQUFBLElBQzVLO0FBRUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDeEI7QUFBQSxRQUNDO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxJQUN6QjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssMkNBQTJDLE1BQU07QUFDckQsYUFBUyx1QkFBdUIsT0FBaUIsV0FBc0IsZUFBeUIsbUJBQW9DO0FBQ25JLDBCQUFvQixPQUFPLFdBQVcsQ0FBQyxVQUFVLFFBQVEsSUFBSSxvQkFBb0IsS0FBSyxPQUFPLFNBQVMsSUFBSSw2QkFBNkIsQ0FBQyxHQUFHLGVBQWUsaUJBQWlCO0FBQUEsSUFDNUs7QUFFQTtBQUFBLE1BQ0M7QUFBQSxRQUNDO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUN4QjtBQUFBLFFBQ0M7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBQUEsRUFDRCxDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
