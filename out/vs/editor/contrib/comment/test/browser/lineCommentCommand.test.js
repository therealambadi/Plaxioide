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
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Selection } from "../../../../common/core/selection.js";
import { ColorId, MetadataConsts } from "../../../../common/encodedTokenAttributes.js";
import { EncodedTokenizationResult, TokenizationRegistry } from "../../../../common/languages.js";
import { ILanguageService } from "../../../../common/languages/language.js";
import { ILanguageConfigurationService } from "../../../../common/languages/languageConfigurationRegistry.js";
import { NullState } from "../../../../common/languages/nullTokenize.js";
import { LineCommentCommand, Type } from "../../browser/lineCommentCommand.js";
import { testCommand } from "../../../../test/browser/testCommand.js";
import { TestLanguageConfigurationService } from "../../../../test/common/modes/testLanguageConfigurationService.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
function createTestCommandHelper(commentsConfig, commandFactory) {
  return (lines, selection, expectedLines, expectedSelection) => {
    const languageId = "commentMode";
    const prepare = (accessor, disposables) => {
      const languageConfigurationService = accessor.get(ILanguageConfigurationService);
      const languageService = accessor.get(ILanguageService);
      disposables.add(languageService.registerLanguage({ id: languageId }));
      disposables.add(languageConfigurationService.register(languageId, {
        comments: commentsConfig
      }));
    };
    testCommand(lines, languageId, selection, commandFactory, expectedLines, expectedSelection, false, prepare);
  };
}
suite("Editor Contrib - Line Comment Command", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const testLineCommentCommand = createTestCommandHelper(
    { lineComment: "!@#", blockComment: ["<!@#", "#@!>"] },
    (accessor, sel) => new LineCommentCommand(accessor.get(ILanguageConfigurationService), sel, 4, Type.Toggle, true, true)
  );
  const testAddLineCommentCommand = createTestCommandHelper(
    { lineComment: "!@#", blockComment: ["<!@#", "#@!>"] },
    (accessor, sel) => new LineCommentCommand(accessor.get(ILanguageConfigurationService), sel, 4, Type.ForceAdd, true, true)
  );
  test("comment single line", function() {
    testLineCommentCommand(
      [
        "some text",
        "	some more text"
      ],
      new Selection(1, 1, 1, 1),
      [
        "!@# some text",
        "	some more text"
      ],
      new Selection(1, 5, 1, 5)
    );
  });
  test("case insensitive", function() {
    const testLineCommentCommand2 = createTestCommandHelper(
      { lineComment: "rem" },
      (accessor, sel) => new LineCommentCommand(accessor.get(ILanguageConfigurationService), sel, 4, Type.Toggle, true, true)
    );
    testLineCommentCommand2(
      [
        "REM some text"
      ],
      new Selection(1, 1, 1, 1),
      [
        "some text"
      ],
      new Selection(1, 1, 1, 1)
    );
  });
  function createSimpleModel(lines) {
    return {
      getLineContent: (lineNumber) => {
        return lines[lineNumber - 1];
      }
    };
  }
  function createBasicLinePreflightData(commentTokens) {
    return commentTokens.map((commentString) => {
      const r = {
        ignore: false,
        commentStr: commentString,
        commentStrOffset: 0,
        commentStrLength: commentString.length
      };
      return r;
    });
  }
  test("_analyzeLines", () => {
    const disposable = new DisposableStore();
    let r;
    r = LineCommentCommand._analyzeLines(Type.Toggle, true, createSimpleModel([
      "		",
      "    ",
      "    c",
      "		d"
    ]), createBasicLinePreflightData(["//", "rem", "!@#", "!@#"]), 1, true, false, disposable.add(new TestLanguageConfigurationService()));
    if (!r.supported) {
      throw new Error(`unexpected`);
    }
    assert.strictEqual(r.shouldRemoveComments, false);
    assert.strictEqual(r.lines[0].commentStr, "//");
    assert.strictEqual(r.lines[1].commentStr, "rem");
    assert.strictEqual(r.lines[2].commentStr, "!@#");
    assert.strictEqual(r.lines[3].commentStr, "!@#");
    assert.strictEqual(r.lines[0].ignore, true);
    assert.strictEqual(r.lines[1].ignore, true);
    assert.strictEqual(r.lines[2].ignore, false);
    assert.strictEqual(r.lines[3].ignore, false);
    assert.strictEqual(r.lines[0].commentStrOffset, 2);
    assert.strictEqual(r.lines[1].commentStrOffset, 4);
    assert.strictEqual(r.lines[2].commentStrOffset, 4);
    assert.strictEqual(r.lines[3].commentStrOffset, 2);
    r = LineCommentCommand._analyzeLines(Type.Toggle, true, createSimpleModel([
      "		",
      "    rem ",
      "    !@# c",
      "		!@#d"
    ]), createBasicLinePreflightData(["//", "rem", "!@#", "!@#"]), 1, true, false, disposable.add(new TestLanguageConfigurationService()));
    if (!r.supported) {
      throw new Error(`unexpected`);
    }
    assert.strictEqual(r.shouldRemoveComments, true);
    assert.strictEqual(r.lines[0].commentStr, "//");
    assert.strictEqual(r.lines[1].commentStr, "rem");
    assert.strictEqual(r.lines[2].commentStr, "!@#");
    assert.strictEqual(r.lines[3].commentStr, "!@#");
    assert.strictEqual(r.lines[0].ignore, true);
    assert.strictEqual(r.lines[1].ignore, false);
    assert.strictEqual(r.lines[2].ignore, false);
    assert.strictEqual(r.lines[3].ignore, false);
    assert.strictEqual(r.lines[0].commentStrOffset, 2);
    assert.strictEqual(r.lines[1].commentStrOffset, 4);
    assert.strictEqual(r.lines[2].commentStrOffset, 4);
    assert.strictEqual(r.lines[3].commentStrOffset, 2);
    assert.strictEqual(r.lines[0].commentStrLength, 2);
    assert.strictEqual(r.lines[1].commentStrLength, 4);
    assert.strictEqual(r.lines[2].commentStrLength, 4);
    assert.strictEqual(r.lines[3].commentStrLength, 3);
    disposable.dispose();
  });
  test("_normalizeInsertionPoint", () => {
    const runTest = (mixedArr, tabSize, expected, testName) => {
      const model = createSimpleModel(mixedArr.filter((item, idx) => idx % 2 === 0));
      const offsets = mixedArr.filter((item, idx) => idx % 2 === 1).map((offset) => {
        return {
          commentStrOffset: offset,
          ignore: false
        };
      });
      LineCommentCommand._normalizeInsertionPoint(model, offsets, 1, tabSize);
      const actual = offsets.map((item) => item.commentStrOffset);
      assert.deepStrictEqual(actual, expected, testName);
    };
    runTest([
      "  XX",
      2,
      "    YY",
      4
    ], 4, [0, 0], "Bug 16696");
    runTest([
      "			XX",
      3,
      "    	YY",
      5,
      "        ZZ",
      8,
      "		TT",
      2
    ], 4, [2, 5, 8, 2], "Test1");
    runTest([
      "			   XX",
      6,
      "    				YY",
      8,
      "        ZZ",
      8,
      "		    TT",
      6
    ], 4, [2, 5, 8, 2], "Test2");
    runTest([
      "		",
      2,
      "			",
      3,
      "				",
      4,
      "			",
      3
    ], 4, [2, 2, 2, 2], "Test3");
    runTest([
      "		",
      2,
      "			",
      3,
      "				",
      4,
      "			",
      3,
      "    ",
      4
    ], 2, [2, 2, 2, 2, 4], "Test4");
    runTest([
      "		",
      2,
      "			",
      3,
      "				",
      4,
      "			",
      3,
      "    ",
      4
    ], 4, [1, 1, 1, 1, 4], "Test5");
    runTest([
      " 	",
      2,
      "  	",
      3,
      "   	",
      4,
      "    ",
      4,
      "	",
      1
    ], 4, [2, 3, 4, 4, 1], "Test6");
    runTest([
      " 		",
      3,
      "  		",
      4,
      "   		",
      5,
      "    	",
      5,
      "	",
      1
    ], 4, [2, 3, 4, 4, 1], "Test7");
    runTest([
      "	",
      1,
      "    ",
      4
    ], 4, [1, 4], "Test8:4");
    runTest([
      "	",
      1,
      "   ",
      3
    ], 4, [0, 0], "Test8:3");
    runTest([
      "	",
      1,
      "  ",
      2
    ], 4, [0, 0], "Test8:2");
    runTest([
      "	",
      1,
      " ",
      1
    ], 4, [0, 0], "Test8:1");
    runTest([
      "	",
      1,
      "",
      0
    ], 4, [0, 0], "Test8:0");
  });
  test("detects indentation", function() {
    testLineCommentCommand(
      [
        "	some text",
        "	some more text"
      ],
      new Selection(2, 2, 1, 1),
      [
        "	!@# some text",
        "	!@# some more text"
      ],
      new Selection(2, 2, 1, 1)
    );
  });
  test("detects mixed indentation", function() {
    testLineCommentCommand(
      [
        "	some text",
        "    some more text"
      ],
      new Selection(2, 2, 1, 1),
      [
        "	!@# some text",
        "    !@# some more text"
      ],
      new Selection(2, 2, 1, 1)
    );
  });
  test("ignores whitespace lines", function() {
    testLineCommentCommand(
      [
        "	some text",
        "	   ",
        "",
        "	some more text"
      ],
      new Selection(4, 2, 1, 1),
      [
        "	!@# some text",
        "	   ",
        "",
        "	!@# some more text"
      ],
      new Selection(4, 2, 1, 1)
    );
  });
  test("removes its own", function() {
    testLineCommentCommand(
      [
        "	!@# some text",
        "	   ",
        "		!@# some more text"
      ],
      new Selection(3, 2, 1, 1),
      [
        "	some text",
        "	   ",
        "		some more text"
      ],
      new Selection(3, 2, 1, 1)
    );
  });
  test("works in only whitespace", function() {
    testLineCommentCommand(
      [
        "	    ",
        "	",
        "		some more text"
      ],
      new Selection(3, 1, 1, 1),
      [
        "	!@#     ",
        "	!@# ",
        "		some more text"
      ],
      new Selection(3, 1, 1, 1)
    );
  });
  test("bug 9697 - whitespace before comment token", function() {
    testLineCommentCommand(
      [
        "	 !@#first",
        "	second line"
      ],
      new Selection(1, 1, 1, 1),
      [
        "	 first",
        "	second line"
      ],
      new Selection(1, 1, 1, 1)
    );
  });
  test("bug 10162 - line comment before caret", function() {
    testLineCommentCommand(
      [
        "first!@#",
        "	second line"
      ],
      new Selection(1, 1, 1, 1),
      [
        "!@# first!@#",
        "	second line"
      ],
      new Selection(1, 5, 1, 5)
    );
  });
  test("comment single line - leading whitespace", function() {
    testLineCommentCommand(
      [
        "first!@#",
        "	second line"
      ],
      new Selection(2, 3, 2, 1),
      [
        "first!@#",
        "	!@# second line"
      ],
      new Selection(2, 7, 2, 1)
    );
  });
  test("ignores invisible selection", function() {
    testLineCommentCommand(
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 1, 1, 1),
      [
        "!@# first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 1, 1, 5)
    );
  });
  test("multiple lines", function() {
    testLineCommentCommand(
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 4, 1, 1),
      [
        "!@# first",
        "!@# 	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 8, 1, 5)
    );
  });
  test("multiple modes on multiple lines", function() {
    testLineCommentCommand(
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(4, 4, 3, 1),
      [
        "first",
        "	second line",
        "!@# third line",
        "!@# fourth line",
        "fifth"
      ],
      new Selection(4, 8, 3, 5)
    );
  });
  test("toggle single line", function() {
    testLineCommentCommand(
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 1, 1),
      [
        "!@# first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 5, 1, 5)
    );
    testLineCommentCommand(
      [
        "!@# first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 4, 1, 4),
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 1, 1)
    );
  });
  test("toggle multiple lines", function() {
    testLineCommentCommand(
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 4, 1, 1),
      [
        "!@# first",
        "!@# 	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 8, 1, 5)
    );
    testLineCommentCommand(
      [
        "!@# first",
        "!@# 	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 7, 1, 4),
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 3, 1, 1)
    );
  });
  test("issue #5964: Ctrl+/ to create comment when cursor is at the beginning of the line puts the cursor in a strange position", () => {
    testLineCommentCommand(
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 1, 1),
      [
        "!@# first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 5, 1, 5)
    );
  });
  test("issue #35673: Comment hotkeys throws the cursor before the comment", () => {
    testLineCommentCommand(
      [
        "first",
        "",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 1, 2, 1),
      [
        "first",
        "!@# ",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 5, 2, 5)
    );
    testLineCommentCommand(
      [
        "first",
        "	",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 2, 2, 2),
      [
        "first",
        "	!@# ",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 6, 2, 6)
    );
  });
  test('issue #2837 "Add Line Comment" fault when blank lines involved', function() {
    testAddLineCommentCommand(
      [
        '    if displayName == "":',
        "        displayName = groupName",
        '    description = getAttr(attributes, "description")',
        '    mailAddress = getAttr(attributes, "mail")',
        "",
        '    print "||Group name|%s|" % displayName',
        '    print "||Description|%s|" % description',
        '    print "||Email address|[mailto:%s]|" % mailAddress`'
      ],
      new Selection(1, 1, 8, 56),
      [
        '    !@# if displayName == "":',
        "    !@#     displayName = groupName",
        '    !@# description = getAttr(attributes, "description")',
        '    !@# mailAddress = getAttr(attributes, "mail")',
        "",
        '    !@# print "||Group name|%s|" % displayName',
        '    !@# print "||Description|%s|" % description',
        '    !@# print "||Email address|[mailto:%s]|" % mailAddress`'
      ],
      new Selection(1, 1, 8, 60)
    );
  });
  test("issue #47004: Toggle comments shouldn't move cursor", () => {
    testAddLineCommentCommand(
      [
        "    A line",
        "    Another line"
      ],
      new Selection(2, 7, 1, 1),
      [
        "    !@# A line",
        "    !@# Another line"
      ],
      new Selection(2, 11, 1, 1)
    );
  });
  test("insertSpace false", () => {
    const testLineCommentCommand2 = createTestCommandHelper(
      { lineComment: "!@#" },
      (accessor, sel) => new LineCommentCommand(accessor.get(ILanguageConfigurationService), sel, 4, Type.Toggle, false, true)
    );
    testLineCommentCommand2(
      [
        "some text"
      ],
      new Selection(1, 1, 1, 1),
      [
        "!@#some text"
      ],
      new Selection(1, 4, 1, 4)
    );
  });
  test("insertSpace false does not remove space", () => {
    const testLineCommentCommand2 = createTestCommandHelper(
      { lineComment: "!@#" },
      (accessor, sel) => new LineCommentCommand(accessor.get(ILanguageConfigurationService), sel, 4, Type.Toggle, false, true)
    );
    testLineCommentCommand2(
      [
        "!@#    some text"
      ],
      new Selection(1, 1, 1, 1),
      [
        "    some text"
      ],
      new Selection(1, 1, 1, 1)
    );
  });
});
suite("ignoreEmptyLines false", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const testLineCommentCommand = createTestCommandHelper(
    { lineComment: "!@#", blockComment: ["<!@#", "#@!>"] },
    (accessor, sel) => new LineCommentCommand(accessor.get(ILanguageConfigurationService), sel, 4, Type.Toggle, true, false)
  );
  test("does not ignore whitespace lines", () => {
    testLineCommentCommand(
      [
        "	some text",
        "	   ",
        "",
        "	some more text"
      ],
      new Selection(4, 2, 1, 1),
      [
        "!@# 	some text",
        "!@# 	   ",
        "!@# ",
        "!@# 	some more text"
      ],
      new Selection(4, 6, 1, 5)
    );
  });
  test("removes its own", function() {
    testLineCommentCommand(
      [
        "	!@# some text",
        "	   ",
        "		!@# some more text"
      ],
      new Selection(3, 2, 1, 1),
      [
        "	some text",
        "	   ",
        "		some more text"
      ],
      new Selection(3, 2, 1, 1)
    );
  });
  test("works in only whitespace", function() {
    testLineCommentCommand(
      [
        "	    ",
        "	",
        "		some more text"
      ],
      new Selection(3, 1, 1, 1),
      [
        "	!@#     ",
        "	!@# ",
        "		some more text"
      ],
      new Selection(3, 1, 1, 1)
    );
  });
  test("comments single line", function() {
    testLineCommentCommand(
      [
        "some text",
        "	some more text"
      ],
      new Selection(1, 1, 1, 1),
      [
        "!@# some text",
        "	some more text"
      ],
      new Selection(1, 5, 1, 5)
    );
  });
  test("detects indentation", function() {
    testLineCommentCommand(
      [
        "	some text",
        "	some more text"
      ],
      new Selection(2, 2, 1, 1),
      [
        "	!@# some text",
        "	!@# some more text"
      ],
      new Selection(2, 2, 1, 1)
    );
  });
});
suite("Editor Contrib - Line Comment As Block Comment", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const testLineCommentCommand = createTestCommandHelper(
    { lineComment: "", blockComment: ["(", ")"] },
    (accessor, sel) => new LineCommentCommand(accessor.get(ILanguageConfigurationService), sel, 4, Type.Toggle, true, true)
  );
  test("fall back to block comment command", function() {
    testLineCommentCommand(
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 1, 1),
      [
        "( first )",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 3, 1, 3)
    );
  });
  test("fall back to block comment command - toggle", function() {
    testLineCommentCommand(
      [
        "(first)",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 7, 1, 2),
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 6, 1, 1)
    );
  });
  test("bug 9513 - expand single line to uncomment auto block", function() {
    testLineCommentCommand(
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 1, 1, 1),
      [
        "( first )",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 3, 1, 3)
    );
  });
  test("bug 9691 - always expand selection to line boundaries", function() {
    testLineCommentCommand(
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(3, 2, 1, 3),
      [
        "( first",
        "	second line",
        "third line )",
        "fourth line",
        "fifth"
      ],
      new Selection(3, 2, 1, 5)
    );
    testLineCommentCommand(
      [
        "(first",
        "	second line",
        "third line)",
        "fourth line",
        "fifth"
      ],
      new Selection(3, 11, 1, 2),
      [
        "first",
        "	second line",
        "third line",
        "fourth line",
        "fifth"
      ],
      new Selection(3, 11, 1, 1)
    );
  });
});
suite("Editor Contrib - Line Comment As Block Comment 2", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const testLineCommentCommand = createTestCommandHelper(
    { lineComment: null, blockComment: ["<!@#", "#@!>"] },
    (accessor, sel) => new LineCommentCommand(accessor.get(ILanguageConfigurationService), sel, 4, Type.Toggle, true, true)
  );
  test("no selection => uses indentation", function() {
    testLineCommentCommand(
      [
        "		first	    ",
        "		second line",
        "	third line",
        "fourth line",
        "		<!@#fifth#@!>		"
      ],
      new Selection(1, 1, 1, 1),
      [
        "		<!@# first	     #@!>",
        "		second line",
        "	third line",
        "fourth line",
        "		<!@#fifth#@!>		"
      ],
      new Selection(1, 1, 1, 1)
    );
    testLineCommentCommand(
      [
        "		<!@#first	    #@!>",
        "		second line",
        "	third line",
        "fourth line",
        "		<!@#fifth#@!>		"
      ],
      new Selection(1, 1, 1, 1),
      [
        "		first	   ",
        "		second line",
        "	third line",
        "fourth line",
        "		<!@#fifth#@!>		"
      ],
      new Selection(1, 1, 1, 1)
    );
  });
  test("can remove", function() {
    testLineCommentCommand(
      [
        "		first	    ",
        "		second line",
        "	third line",
        "fourth line",
        "		<!@#fifth#@!>		"
      ],
      new Selection(5, 1, 5, 1),
      [
        "		first	    ",
        "		second line",
        "	third line",
        "fourth line",
        "		fifth		"
      ],
      new Selection(5, 1, 5, 1)
    );
    testLineCommentCommand(
      [
        "		first	    ",
        "		second line",
        "	third line",
        "fourth line",
        "		<!@#fifth#@!>		"
      ],
      new Selection(5, 3, 5, 3),
      [
        "		first	    ",
        "		second line",
        "	third line",
        "fourth line",
        "		fifth		"
      ],
      new Selection(5, 3, 5, 3)
    );
    testLineCommentCommand(
      [
        "		first	    ",
        "		second line",
        "	third line",
        "fourth line",
        "		<!@#fifth#@!>		"
      ],
      new Selection(5, 4, 5, 4),
      [
        "		first	    ",
        "		second line",
        "	third line",
        "fourth line",
        "		fifth		"
      ],
      new Selection(5, 3, 5, 3)
    );
    testLineCommentCommand(
      [
        "		first	    ",
        "		second line",
        "	third line",
        "fourth line",
        "		<!@#fifth#@!>		"
      ],
      new Selection(5, 16, 5, 3),
      [
        "		first	    ",
        "		second line",
        "	third line",
        "fourth line",
        "		fifth		"
      ],
      new Selection(5, 8, 5, 3)
    );
    testLineCommentCommand(
      [
        "		first	    ",
        "		second line",
        "	third line",
        "fourth line",
        "		<!@#fifth#@!>		"
      ],
      new Selection(5, 12, 5, 7),
      [
        "		first	    ",
        "		second line",
        "	third line",
        "fourth line",
        "		fifth		"
      ],
      new Selection(5, 8, 5, 3)
    );
    testLineCommentCommand(
      [
        "		first	    ",
        "		second line",
        "	third line",
        "fourth line",
        "		<!@#fifth#@!>		"
      ],
      new Selection(5, 18, 5, 18),
      [
        "		first	    ",
        "		second line",
        "	third line",
        "fourth line",
        "		fifth		"
      ],
      new Selection(5, 10, 5, 10)
    );
  });
  test("issue #993: Remove comment does not work consistently in HTML", () => {
    testLineCommentCommand(
      [
        "     asd qwe",
        "     asd qwe",
        ""
      ],
      new Selection(1, 1, 3, 1),
      [
        "     <!@# asd qwe",
        "     asd qwe #@!>",
        ""
      ],
      new Selection(1, 1, 3, 1)
    );
    testLineCommentCommand(
      [
        "     <!@#asd qwe",
        "     asd qwe#@!>",
        ""
      ],
      new Selection(1, 1, 3, 1),
      [
        "     asd qwe",
        "     asd qwe",
        ""
      ],
      new Selection(1, 1, 3, 1)
    );
  });
});
suite("Editor Contrib - Line Comment in mixed modes", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const OUTER_LANGUAGE_ID = "outerMode";
  const INNER_LANGUAGE_ID = "innerMode";
  let OuterMode = class extends Disposable {
    constructor(commentsConfig, languageService, languageConfigurationService) {
      super();
      this.languageId = OUTER_LANGUAGE_ID;
      this._register(languageService.registerLanguage({ id: this.languageId }));
      this._register(languageConfigurationService.register(this.languageId, {
        comments: commentsConfig
      }));
      this._register(TokenizationRegistry.register(this.languageId, {
        getInitialState: () => NullState,
        tokenize: () => {
          throw new Error("not implemented");
        },
        tokenizeEncoded: (line, hasEOL, state) => {
          const languageId = /^  /.test(line) ? INNER_LANGUAGE_ID : OUTER_LANGUAGE_ID;
          const encodedLanguageId = languageService.languageIdCodec.encodeLanguageId(languageId);
          const tokens = new Uint32Array(1 << 1);
          tokens[0 << 1] = 0;
          tokens[(0 << 1) + 1] = ColorId.DefaultForeground << MetadataConsts.FOREGROUND_OFFSET | encodedLanguageId << MetadataConsts.LANGUAGEID_OFFSET;
          return new EncodedTokenizationResult(tokens, state);
        }
      }));
    }
  };
  OuterMode = __decorateClass([
    __decorateParam(1, ILanguageService),
    __decorateParam(2, ILanguageConfigurationService)
  ], OuterMode);
  let InnerMode = class extends Disposable {
    constructor(commentsConfig, languageService, languageConfigurationService) {
      super();
      this.languageId = INNER_LANGUAGE_ID;
      this._register(languageService.registerLanguage({ id: this.languageId }));
      this._register(languageConfigurationService.register(this.languageId, {
        comments: commentsConfig
      }));
    }
  };
  InnerMode = __decorateClass([
    __decorateParam(1, ILanguageService),
    __decorateParam(2, ILanguageConfigurationService)
  ], InnerMode);
  function testLineCommentCommand(lines, selection, expectedLines, expectedSelection) {
    const setup = (accessor, disposables) => {
      const instantiationService = accessor.get(IInstantiationService);
      disposables.add(instantiationService.createInstance(OuterMode, { lineComment: "//", blockComment: ["/*", "*/"] }));
      disposables.add(instantiationService.createInstance(InnerMode, { lineComment: null, blockComment: ["{/*", "*/}"] }));
    };
    testCommand(
      lines,
      OUTER_LANGUAGE_ID,
      selection,
      (accessor, sel) => new LineCommentCommand(accessor.get(ILanguageConfigurationService), sel, 4, Type.Toggle, true, true),
      expectedLines,
      expectedSelection,
      true,
      setup
    );
  }
  test("issue #24047 (part 1): Commenting code in JSX files", () => {
    testLineCommentCommand(
      [
        "import React from 'react';",
        "const Loader = () => (",
        "  <div>",
        "    Loading...",
        "  </div>",
        ");",
        "export default Loader;"
      ],
      new Selection(1, 1, 7, 22),
      [
        "// import React from 'react';",
        "// const Loader = () => (",
        "//   <div>",
        "//     Loading...",
        "//   </div>",
        "// );",
        "// export default Loader;"
      ],
      new Selection(1, 4, 7, 25)
    );
  });
  test("issue #24047 (part 2): Commenting code in JSX files", () => {
    testLineCommentCommand(
      [
        "import React from 'react';",
        "const Loader = () => (",
        "  <div>",
        "    Loading...",
        "  </div>",
        ");",
        "export default Loader;"
      ],
      new Selection(3, 4, 3, 4),
      [
        "import React from 'react';",
        "const Loader = () => (",
        "  {/* <div> */}",
        "    Loading...",
        "  </div>",
        ");",
        "export default Loader;"
      ],
      new Selection(3, 8, 3, 8)
    );
  });
  test("issue #36173: Commenting code in JSX tag body", () => {
    testLineCommentCommand(
      [
        "<div>",
        "  {123}",
        "</div>"
      ],
      new Selection(2, 4, 2, 4),
      [
        "<div>",
        "  {/* {123} */}",
        "</div>"
      ],
      new Selection(2, 8, 2, 8)
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9jb21tZW50L3Rlc3QvYnJvd3Nlci9saW5lQ29tbWVudENvbW1hbmQudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgQ29sb3JJZCwgTWV0YWRhdGFDb25zdHMgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZW5jb2RlZFRva2VuQXR0cmlidXRlcy5qcyc7XG5pbXBvcnQgeyBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0LCBJU3RhdGUsIFRva2VuaXphdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBDb21tZW50UnVsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBOdWxsU3RhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL251bGxUb2tlbml6ZS5qcyc7XG5pbXBvcnQgeyBJTGluZVByZWZsaWdodERhdGEsIElQcmVmbGlnaHREYXRhLCBJU2ltcGxlTW9kZWwsIExpbmVDb21tZW50Q29tbWFuZCwgVHlwZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvbGluZUNvbW1lbnRDb21tYW5kLmpzJztcbmltcG9ydCB7IHRlc3RDb21tYW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3Rlc3RDb21tYW5kLmpzJztcbmltcG9ydCB7IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vbW9kZXMvdGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5cbmZ1bmN0aW9uIGNyZWF0ZVRlc3RDb21tYW5kSGVscGVyKGNvbW1lbnRzQ29uZmlnOiBDb21tZW50UnVsZSwgY29tbWFuZEZhY3Rvcnk6IChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgc2VsZWN0aW9uOiBTZWxlY3Rpb24pID0+IElDb21tYW5kKTogKGxpbmVzOiBzdHJpbmdbXSwgc2VsZWN0aW9uOiBTZWxlY3Rpb24sIGV4cGVjdGVkTGluZXM6IHN0cmluZ1tdLCBleHBlY3RlZFNlbGVjdGlvbjogU2VsZWN0aW9uKSA9PiB2b2lkIHtcblx0cmV0dXJuIChsaW5lczogc3RyaW5nW10sIHNlbGVjdGlvbjogU2VsZWN0aW9uLCBleHBlY3RlZExpbmVzOiBzdHJpbmdbXSwgZXhwZWN0ZWRTZWxlY3Rpb246IFNlbGVjdGlvbikgPT4ge1xuXHRcdGNvbnN0IGxhbmd1YWdlSWQgPSAnY29tbWVudE1vZGUnO1xuXHRcdGNvbnN0IHByZXBhcmUgPSAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpID0+IHtcblx0XHRcdGNvbnN0IGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgbGFuZ3VhZ2VTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZVNlcnZpY2UpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZS5yZWdpc3Rlckxhbmd1YWdlKHsgaWQ6IGxhbmd1YWdlSWQgfSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIobGFuZ3VhZ2VJZCwge1xuXHRcdFx0XHRjb21tZW50czogY29tbWVudHNDb25maWdcblx0XHRcdH0pKTtcblx0XHR9O1xuXHRcdHRlc3RDb21tYW5kKGxpbmVzLCBsYW5ndWFnZUlkLCBzZWxlY3Rpb24sIGNvbW1hbmRGYWN0b3J5LCBleHBlY3RlZExpbmVzLCBleHBlY3RlZFNlbGVjdGlvbiwgZmFsc2UsIHByZXBhcmUpO1xuXHR9O1xufVxuXG5zdWl0ZSgnRWRpdG9yIENvbnRyaWIgLSBMaW5lIENvbW1lbnQgQ29tbWFuZCcsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRjb25zdCB0ZXN0TGluZUNvbW1lbnRDb21tYW5kID0gY3JlYXRlVGVzdENvbW1hbmRIZWxwZXIoXG5cdFx0eyBsaW5lQ29tbWVudDogJyFAIycsIGJsb2NrQ29tbWVudDogWyc8IUAjJywgJyNAIT4nXSB9LFxuXHRcdChhY2Nlc3Nvciwgc2VsKSA9PiBuZXcgTGluZUNvbW1lbnRDb21tYW5kKGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSksIHNlbCwgNCwgVHlwZS5Ub2dnbGUsIHRydWUsIHRydWUpXG5cdCk7XG5cblx0Y29uc3QgdGVzdEFkZExpbmVDb21tZW50Q29tbWFuZCA9IGNyZWF0ZVRlc3RDb21tYW5kSGVscGVyKFxuXHRcdHsgbGluZUNvbW1lbnQ6ICchQCMnLCBibG9ja0NvbW1lbnQ6IFsnPCFAIycsICcjQCE+J10gfSxcblx0XHQoYWNjZXNzb3IsIHNlbCkgPT4gbmV3IExpbmVDb21tZW50Q29tbWFuZChhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpLCBzZWwsIDQsIFR5cGUuRm9yY2VBZGQsIHRydWUsIHRydWUpXG5cdCk7XG5cblx0dGVzdCgnY29tbWVudCBzaW5nbGUgbGluZScsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnc29tZSB0ZXh0Jyxcblx0XHRcdFx0J1xcdHNvbWUgbW9yZSB0ZXh0J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCchQCMgc29tZSB0ZXh0Jyxcblx0XHRcdFx0J1xcdHNvbWUgbW9yZSB0ZXh0J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNSwgMSwgNSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdjYXNlIGluc2Vuc2l0aXZlJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHRlc3RMaW5lQ29tbWVudENvbW1hbmQgPSBjcmVhdGVUZXN0Q29tbWFuZEhlbHBlcihcblx0XHRcdHsgbGluZUNvbW1lbnQ6ICdyZW0nIH0sXG5cdFx0XHQoYWNjZXNzb3IsIHNlbCkgPT4gbmV3IExpbmVDb21tZW50Q29tbWFuZChhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpLCBzZWwsIDQsIFR5cGUuVG9nZ2xlLCB0cnVlLCB0cnVlKVxuXHRcdCk7XG5cblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnUkVNIHNvbWUgdGV4dCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnc29tZSB0ZXh0J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSlcblx0XHQpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBjcmVhdGVTaW1wbGVNb2RlbChsaW5lczogc3RyaW5nW10pOiBJU2ltcGxlTW9kZWwge1xuXHRcdHJldHVybiB7XG5cdFx0XHRnZXRMaW5lQ29udGVudDogKGxpbmVOdW1iZXI6IG51bWJlcikgPT4ge1xuXHRcdFx0XHRyZXR1cm4gbGluZXNbbGluZU51bWJlciAtIDFdO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRmdW5jdGlvbiBjcmVhdGVCYXNpY0xpbmVQcmVmbGlnaHREYXRhKGNvbW1lbnRUb2tlbnM6IHN0cmluZ1tdKTogSUxpbmVQcmVmbGlnaHREYXRhW10ge1xuXHRcdHJldHVybiBjb21tZW50VG9rZW5zLm1hcCgoY29tbWVudFN0cmluZykgPT4ge1xuXHRcdFx0Y29uc3QgcjogSUxpbmVQcmVmbGlnaHREYXRhID0ge1xuXHRcdFx0XHRpZ25vcmU6IGZhbHNlLFxuXHRcdFx0XHRjb21tZW50U3RyOiBjb21tZW50U3RyaW5nLFxuXHRcdFx0XHRjb21tZW50U3RyT2Zmc2V0OiAwLFxuXHRcdFx0XHRjb21tZW50U3RyTGVuZ3RoOiBjb21tZW50U3RyaW5nLmxlbmd0aFxuXHRcdFx0fTtcblx0XHRcdHJldHVybiByO1xuXHRcdH0pO1xuXHR9XG5cblx0dGVzdCgnX2FuYWx5emVMaW5lcycsICgpID0+IHtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGxldCByOiBJUHJlZmxpZ2h0RGF0YTtcblxuXHRcdHIgPSBMaW5lQ29tbWVudENvbW1hbmQuX2FuYWx5emVMaW5lcyhUeXBlLlRvZ2dsZSwgdHJ1ZSwgY3JlYXRlU2ltcGxlTW9kZWwoW1xuXHRcdFx0J1xcdFxcdCcsXG5cdFx0XHQnICAgICcsXG5cdFx0XHQnICAgIGMnLFxuXHRcdFx0J1xcdFxcdGQnXG5cdFx0XSksIGNyZWF0ZUJhc2ljTGluZVByZWZsaWdodERhdGEoWycvLycsICdyZW0nLCAnIUAjJywgJyFAIyddKSwgMSwgdHJ1ZSwgZmFsc2UsIGRpc3Bvc2FibGUuYWRkKG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpKSk7XG5cdFx0aWYgKCFyLnN1cHBvcnRlZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGB1bmV4cGVjdGVkYCk7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHIuc2hvdWxkUmVtb3ZlQ29tbWVudHMsIGZhbHNlKTtcblxuXHRcdC8vIERvZXMgbm90IGNoYW5nZSBgY29tbWVudFN0cmBcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoci5saW5lc1swXS5jb21tZW50U3RyLCAnLy8nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoci5saW5lc1sxXS5jb21tZW50U3RyLCAncmVtJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHIubGluZXNbMl0uY29tbWVudFN0ciwgJyFAIycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyLmxpbmVzWzNdLmNvbW1lbnRTdHIsICchQCMnKTtcblxuXHRcdC8vIEZpbGxzIGluIGBpc1doaXRlc3BhY2VgXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHIubGluZXNbMF0uaWdub3JlLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoci5saW5lc1sxXS5pZ25vcmUsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyLmxpbmVzWzJdLmlnbm9yZSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyLmxpbmVzWzNdLmlnbm9yZSwgZmFsc2UpO1xuXG5cdFx0Ly8gRmlsbHMgaW4gYGNvbW1lbnRTdHJPZmZzZXRgXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHIubGluZXNbMF0uY29tbWVudFN0ck9mZnNldCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHIubGluZXNbMV0uY29tbWVudFN0ck9mZnNldCwgNCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHIubGluZXNbMl0uY29tbWVudFN0ck9mZnNldCwgNCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHIubGluZXNbM10uY29tbWVudFN0ck9mZnNldCwgMik7XG5cblxuXHRcdHIgPSBMaW5lQ29tbWVudENvbW1hbmQuX2FuYWx5emVMaW5lcyhUeXBlLlRvZ2dsZSwgdHJ1ZSwgY3JlYXRlU2ltcGxlTW9kZWwoW1xuXHRcdFx0J1xcdFxcdCcsXG5cdFx0XHQnICAgIHJlbSAnLFxuXHRcdFx0JyAgICAhQCMgYycsXG5cdFx0XHQnXFx0XFx0IUAjZCdcblx0XHRdKSwgY3JlYXRlQmFzaWNMaW5lUHJlZmxpZ2h0RGF0YShbJy8vJywgJ3JlbScsICchQCMnLCAnIUAjJ10pLCAxLCB0cnVlLCBmYWxzZSwgZGlzcG9zYWJsZS5hZGQobmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpKTtcblx0XHRpZiAoIXIuc3VwcG9ydGVkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYHVuZXhwZWN0ZWRgKTtcblx0XHR9XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoci5zaG91bGRSZW1vdmVDb21tZW50cywgdHJ1ZSk7XG5cblx0XHQvLyBEb2VzIG5vdCBjaGFuZ2UgYGNvbW1lbnRTdHJgXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHIubGluZXNbMF0uY29tbWVudFN0ciwgJy8vJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHIubGluZXNbMV0uY29tbWVudFN0ciwgJ3JlbScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyLmxpbmVzWzJdLmNvbW1lbnRTdHIsICchQCMnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoci5saW5lc1szXS5jb21tZW50U3RyLCAnIUAjJyk7XG5cblx0XHQvLyBGaWxscyBpbiBgaXNXaGl0ZXNwYWNlYFxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyLmxpbmVzWzBdLmlnbm9yZSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHIubGluZXNbMV0uaWdub3JlLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHIubGluZXNbMl0uaWdub3JlLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHIubGluZXNbM10uaWdub3JlLCBmYWxzZSk7XG5cblx0XHQvLyBGaWxscyBpbiBgY29tbWVudFN0ck9mZnNldGBcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoci5saW5lc1swXS5jb21tZW50U3RyT2Zmc2V0LCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoci5saW5lc1sxXS5jb21tZW50U3RyT2Zmc2V0LCA0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoci5saW5lc1syXS5jb21tZW50U3RyT2Zmc2V0LCA0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoci5saW5lc1szXS5jb21tZW50U3RyT2Zmc2V0LCAyKTtcblxuXHRcdC8vIEZpbGxzIGluIGBjb21tZW50U3RyTGVuZ3RoYFxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyLmxpbmVzWzBdLmNvbW1lbnRTdHJMZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyLmxpbmVzWzFdLmNvbW1lbnRTdHJMZW5ndGgsIDQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyLmxpbmVzWzJdLmNvbW1lbnRTdHJMZW5ndGgsIDQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyLmxpbmVzWzNdLmNvbW1lbnRTdHJMZW5ndGgsIDMpO1xuXG5cdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ19ub3JtYWxpemVJbnNlcnRpb25Qb2ludCcsICgpID0+IHtcblxuXHRcdGNvbnN0IHJ1blRlc3QgPSAobWl4ZWRBcnI6IGFueVtdLCB0YWJTaXplOiBudW1iZXIsIGV4cGVjdGVkOiBudW1iZXJbXSwgdGVzdE5hbWU6IHN0cmluZykgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVTaW1wbGVNb2RlbChtaXhlZEFyci5maWx0ZXIoKGl0ZW0sIGlkeCkgPT4gaWR4ICUgMiA9PT0gMCkpO1xuXHRcdFx0Y29uc3Qgb2Zmc2V0cyA9IG1peGVkQXJyLmZpbHRlcigoaXRlbSwgaWR4KSA9PiBpZHggJSAyID09PSAxKS5tYXAob2Zmc2V0ID0+IHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRjb21tZW50U3RyT2Zmc2V0OiBvZmZzZXQsXG5cdFx0XHRcdFx0aWdub3JlOiBmYWxzZVxuXHRcdFx0XHR9O1xuXHRcdFx0fSk7XG5cdFx0XHRMaW5lQ29tbWVudENvbW1hbmQuX25vcm1hbGl6ZUluc2VydGlvblBvaW50KG1vZGVsLCBvZmZzZXRzLCAxLCB0YWJTaXplKTtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IG9mZnNldHMubWFwKGl0ZW0gPT4gaXRlbS5jb21tZW50U3RyT2Zmc2V0KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgdGVzdE5hbWUpO1xuXHRcdH07XG5cblx0XHQvLyBCdWcgMTY2OTY6W2NvbW1lbnRdIGNvbW1lbnRzIG5vdCBhbGlnbmVkIGluIHRoaXMgY2FzZVxuXHRcdHJ1blRlc3QoW1xuXHRcdFx0JyAgWFgnLCAyLFxuXHRcdFx0JyAgICBZWScsIDRcblx0XHRdLCA0LCBbMCwgMF0sICdCdWcgMTY2OTYnKTtcblxuXHRcdHJ1blRlc3QoW1xuXHRcdFx0J1xcdFxcdFxcdFhYJywgMyxcblx0XHRcdCcgICAgXFx0WVknLCA1LFxuXHRcdFx0JyAgICAgICAgWlonLCA4LFxuXHRcdFx0J1xcdFxcdFRUJywgMlxuXHRcdF0sIDQsIFsyLCA1LCA4LCAyXSwgJ1Rlc3QxJyk7XG5cblx0XHRydW5UZXN0KFtcblx0XHRcdCdcXHRcXHRcXHQgICBYWCcsIDYsXG5cdFx0XHQnICAgIFxcdFxcdFxcdFxcdFlZJywgOCxcblx0XHRcdCcgICAgICAgIFpaJywgOCxcblx0XHRcdCdcXHRcXHQgICAgVFQnLCA2XG5cdFx0XSwgNCwgWzIsIDUsIDgsIDJdLCAnVGVzdDInKTtcblxuXHRcdHJ1blRlc3QoW1xuXHRcdFx0J1xcdFxcdCcsIDIsXG5cdFx0XHQnXFx0XFx0XFx0JywgMyxcblx0XHRcdCdcXHRcXHRcXHRcXHQnLCA0LFxuXHRcdFx0J1xcdFxcdFxcdCcsIDNcblx0XHRdLCA0LCBbMiwgMiwgMiwgMl0sICdUZXN0MycpO1xuXG5cdFx0cnVuVGVzdChbXG5cdFx0XHQnXFx0XFx0JywgMixcblx0XHRcdCdcXHRcXHRcXHQnLCAzLFxuXHRcdFx0J1xcdFxcdFxcdFxcdCcsIDQsXG5cdFx0XHQnXFx0XFx0XFx0JywgMyxcblx0XHRcdCcgICAgJywgNFxuXHRcdF0sIDIsIFsyLCAyLCAyLCAyLCA0XSwgJ1Rlc3Q0Jyk7XG5cblx0XHRydW5UZXN0KFtcblx0XHRcdCdcXHRcXHQnLCAyLFxuXHRcdFx0J1xcdFxcdFxcdCcsIDMsXG5cdFx0XHQnXFx0XFx0XFx0XFx0JywgNCxcblx0XHRcdCdcXHRcXHRcXHQnLCAzLFxuXHRcdFx0JyAgICAnLCA0XG5cdFx0XSwgNCwgWzEsIDEsIDEsIDEsIDRdLCAnVGVzdDUnKTtcblxuXHRcdHJ1blRlc3QoW1xuXHRcdFx0JyBcXHQnLCAyLFxuXHRcdFx0JyAgXFx0JywgMyxcblx0XHRcdCcgICBcXHQnLCA0LFxuXHRcdFx0JyAgICAnLCA0LFxuXHRcdFx0J1xcdCcsIDFcblx0XHRdLCA0LCBbMiwgMywgNCwgNCwgMV0sICdUZXN0NicpO1xuXG5cdFx0cnVuVGVzdChbXG5cdFx0XHQnIFxcdFxcdCcsIDMsXG5cdFx0XHQnICBcXHRcXHQnLCA0LFxuXHRcdFx0JyAgIFxcdFxcdCcsIDUsXG5cdFx0XHQnICAgIFxcdCcsIDUsXG5cdFx0XHQnXFx0JywgMVxuXHRcdF0sIDQsIFsyLCAzLCA0LCA0LCAxXSwgJ1Rlc3Q3Jyk7XG5cblx0XHRydW5UZXN0KFtcblx0XHRcdCdcXHQnLCAxLFxuXHRcdFx0JyAgICAnLCA0XG5cdFx0XSwgNCwgWzEsIDRdLCAnVGVzdDg6NCcpO1xuXHRcdHJ1blRlc3QoW1xuXHRcdFx0J1xcdCcsIDEsXG5cdFx0XHQnICAgJywgM1xuXHRcdF0sIDQsIFswLCAwXSwgJ1Rlc3Q4OjMnKTtcblx0XHRydW5UZXN0KFtcblx0XHRcdCdcXHQnLCAxLFxuXHRcdFx0JyAgJywgMlxuXHRcdF0sIDQsIFswLCAwXSwgJ1Rlc3Q4OjInKTtcblx0XHRydW5UZXN0KFtcblx0XHRcdCdcXHQnLCAxLFxuXHRcdFx0JyAnLCAxXG5cdFx0XSwgNCwgWzAsIDBdLCAnVGVzdDg6MScpO1xuXHRcdHJ1blRlc3QoW1xuXHRcdFx0J1xcdCcsIDEsXG5cdFx0XHQnJywgMFxuXHRcdF0sIDQsIFswLCAwXSwgJ1Rlc3Q4OjAnKTtcblx0fSk7XG5cblx0dGVzdCgnZGV0ZWN0cyBpbmRlbnRhdGlvbicsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnXFx0c29tZSB0ZXh0Jyxcblx0XHRcdFx0J1xcdHNvbWUgbW9yZSB0ZXh0J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMiwgMSwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHQhQCMgc29tZSB0ZXh0Jyxcblx0XHRcdFx0J1xcdCFAIyBzb21lIG1vcmUgdGV4dCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDIsIDEsIDEpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZGV0ZWN0cyBtaXhlZCBpbmRlbnRhdGlvbicsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnXFx0c29tZSB0ZXh0Jyxcblx0XHRcdFx0JyAgICBzb21lIG1vcmUgdGV4dCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDIsIDEsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnXFx0IUAjIHNvbWUgdGV4dCcsXG5cdFx0XHRcdCcgICAgIUAjIHNvbWUgbW9yZSB0ZXh0J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMiwgMSwgMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpZ25vcmVzIHdoaXRlc3BhY2UgbGluZXMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdExpbmVDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J1xcdHNvbWUgdGV4dCcsXG5cdFx0XHRcdCdcXHQgICAnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0J1xcdHNvbWUgbW9yZSB0ZXh0J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgMiwgMSwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHQhQCMgc29tZSB0ZXh0Jyxcblx0XHRcdFx0J1xcdCAgICcsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnXFx0IUAjIHNvbWUgbW9yZSB0ZXh0J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oNCwgMiwgMSwgMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZW1vdmVzIGl0cyBvd24nLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdExpbmVDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J1xcdCFAIyBzb21lIHRleHQnLFxuXHRcdFx0XHQnXFx0ICAgJyxcblx0XHRcdFx0J1xcdFxcdCFAIyBzb21lIG1vcmUgdGV4dCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDIsIDEsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnXFx0c29tZSB0ZXh0Jyxcblx0XHRcdFx0J1xcdCAgICcsXG5cdFx0XHRcdCdcXHRcXHRzb21lIG1vcmUgdGV4dCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDIsIDEsIDEpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnd29ya3MgaW4gb25seSB3aGl0ZXNwYWNlJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RMaW5lQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHQgICAgJyxcblx0XHRcdFx0J1xcdCcsXG5cdFx0XHRcdCdcXHRcXHRzb21lIG1vcmUgdGV4dCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDEsIDEsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnXFx0IUAjICAgICAnLFxuXHRcdFx0XHQnXFx0IUAjICcsXG5cdFx0XHRcdCdcXHRcXHRzb21lIG1vcmUgdGV4dCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDEsIDEsIDEpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnYnVnIDk2OTcgLSB3aGl0ZXNwYWNlIGJlZm9yZSBjb21tZW50IHRva2VuJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RMaW5lQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHQgIUAjZmlyc3QnLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J1xcdCBmaXJzdCcsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZSdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnYnVnIDEwMTYyIC0gbGluZSBjb21tZW50IGJlZm9yZSBjYXJldCcsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QhQCMnLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0JyFAIyBmaXJzdCFAIycsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZSdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnY29tbWVudCBzaW5nbGUgbGluZSAtIGxlYWRpbmcgd2hpdGVzcGFjZScsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QhQCMnLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCAzLCAyLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0IUAjJyxcblx0XHRcdFx0J1xcdCFAIyBzZWNvbmQgbGluZSdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDcsIDIsIDEpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaWdub3JlcyBpbnZpc2libGUgc2VsZWN0aW9uJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RMaW5lQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMSwgMSwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCchQCMgZmlyc3QnLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDEsIDEsIDUpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGlwbGUgbGluZXMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdExpbmVDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J1xcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCA0LCAxLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0JyFAIyBmaXJzdCcsXG5cdFx0XHRcdCchQCMgXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDgsIDEsIDUpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGlwbGUgbW9kZXMgb24gbXVsdGlwbGUgbGluZXMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdExpbmVDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J1xcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig0LCA0LCAzLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J1xcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0JyFAIyB0aGlyZCBsaW5lJyxcblx0XHRcdFx0JyFAIyBmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDQsIDgsIDMsIDUpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgndG9nZ2xlIHNpbmdsZSBsaW5lJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RMaW5lQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCchQCMgZmlyc3QnLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpXG5cdFx0KTtcblxuXHRcdHRlc3RMaW5lQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCchQCMgZmlyc3QnLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgndG9nZ2xlIG11bHRpcGxlIGxpbmVzJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RMaW5lQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgNCwgMSwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCchQCMgZmlyc3QnLFxuXHRcdFx0XHQnIUAjIFxcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCA4LCAxLCA1KVxuXHRcdCk7XG5cblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnIUAjIGZpcnN0Jyxcblx0XHRcdFx0JyFAIyBcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgNywgMSwgNCksXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgMywgMSwgMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNTk2NDogQ3RybCsvIHRvIGNyZWF0ZSBjb21tZW50IHdoZW4gY3Vyc29yIGlzIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIGxpbmUgcHV0cyB0aGUgY3Vyc29yIGluIGEgc3RyYW5nZSBwb3NpdGlvbicsICgpID0+IHtcblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnIUAjIGZpcnN0Jyxcblx0XHRcdFx0J1xcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCA1LCAxLCA1KVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMzNTY3MzogQ29tbWVudCBob3RrZXlzIHRocm93cyB0aGUgY3Vyc29yIGJlZm9yZSB0aGUgY29tbWVudCcsICgpID0+IHtcblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0J1xcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCAxLCAyLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0JyFAIyAnLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDUsIDIsIDUpXG5cdFx0KTtcblxuXHRcdHRlc3RMaW5lQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdcXHQnLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDIsIDIsIDIpLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnXFx0IUAjICcsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgNiwgMiwgNilcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMjgzNyBcIkFkZCBMaW5lIENvbW1lbnRcIiBmYXVsdCB3aGVuIGJsYW5rIGxpbmVzIGludm9sdmVkJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RBZGRMaW5lQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCcgICAgaWYgZGlzcGxheU5hbWUgPT0gXCJcIjonLFxuXHRcdFx0XHQnICAgICAgICBkaXNwbGF5TmFtZSA9IGdyb3VwTmFtZScsXG5cdFx0XHRcdCcgICAgZGVzY3JpcHRpb24gPSBnZXRBdHRyKGF0dHJpYnV0ZXMsIFwiZGVzY3JpcHRpb25cIiknLFxuXHRcdFx0XHQnICAgIG1haWxBZGRyZXNzID0gZ2V0QXR0cihhdHRyaWJ1dGVzLCBcIm1haWxcIiknLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0JyAgICBwcmludCBcInx8R3JvdXAgbmFtZXwlc3xcIiAlIGRpc3BsYXlOYW1lJyxcblx0XHRcdFx0JyAgICBwcmludCBcInx8RGVzY3JpcHRpb258JXN8XCIgJSBkZXNjcmlwdGlvbicsXG5cdFx0XHRcdCcgICAgcHJpbnQgXCJ8fEVtYWlsIGFkZHJlc3N8W21haWx0bzolc118XCIgJSBtYWlsQWRkcmVzc2AnLFxuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgOCwgNTYpLFxuXHRcdFx0W1xuXHRcdFx0XHQnICAgICFAIyBpZiBkaXNwbGF5TmFtZSA9PSBcIlwiOicsXG5cdFx0XHRcdCcgICAgIUAjICAgICBkaXNwbGF5TmFtZSA9IGdyb3VwTmFtZScsXG5cdFx0XHRcdCcgICAgIUAjIGRlc2NyaXB0aW9uID0gZ2V0QXR0cihhdHRyaWJ1dGVzLCBcImRlc2NyaXB0aW9uXCIpJyxcblx0XHRcdFx0JyAgICAhQCMgbWFpbEFkZHJlc3MgPSBnZXRBdHRyKGF0dHJpYnV0ZXMsIFwibWFpbFwiKScsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnICAgICFAIyBwcmludCBcInx8R3JvdXAgbmFtZXwlc3xcIiAlIGRpc3BsYXlOYW1lJyxcblx0XHRcdFx0JyAgICAhQCMgcHJpbnQgXCJ8fERlc2NyaXB0aW9ufCVzfFwiICUgZGVzY3JpcHRpb24nLFxuXHRcdFx0XHQnICAgICFAIyBwcmludCBcInx8RW1haWwgYWRkcmVzc3xbbWFpbHRvOiVzXXxcIiAlIG1haWxBZGRyZXNzYCcsXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCA4LCA2MClcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNDcwMDQ6IFRvZ2dsZSBjb21tZW50cyBzaG91bGRuXFwndCBtb3ZlIGN1cnNvcicsICgpID0+IHtcblx0XHR0ZXN0QWRkTGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnICAgIEEgbGluZScsXG5cdFx0XHRcdCcgICAgQW5vdGhlciBsaW5lJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgNywgMSwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCcgICAgIUAjIEEgbGluZScsXG5cdFx0XHRcdCcgICAgIUAjIEFub3RoZXIgbGluZSdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDExLCAxLCAxKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luc2VydFNwYWNlIGZhbHNlJywgKCkgPT4ge1xuXHRcdGNvbnN0IHRlc3RMaW5lQ29tbWVudENvbW1hbmQgPSBjcmVhdGVUZXN0Q29tbWFuZEhlbHBlcihcblx0XHRcdHsgbGluZUNvbW1lbnQ6ICchQCMnIH0sXG5cdFx0XHQoYWNjZXNzb3IsIHNlbCkgPT4gbmV3IExpbmVDb21tZW50Q29tbWFuZChhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpLCBzZWwsIDQsIFR5cGUuVG9nZ2xlLCBmYWxzZSwgdHJ1ZSlcblx0XHQpO1xuXG5cdFx0dGVzdExpbmVDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J3NvbWUgdGV4dCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnIUAjc29tZSB0ZXh0J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNClcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbnNlcnRTcGFjZSBmYWxzZSBkb2VzIG5vdCByZW1vdmUgc3BhY2UnLCAoKSA9PiB7XG5cdFx0Y29uc3QgdGVzdExpbmVDb21tZW50Q29tbWFuZCA9IGNyZWF0ZVRlc3RDb21tYW5kSGVscGVyKFxuXHRcdFx0eyBsaW5lQ29tbWVudDogJyFAIycgfSxcblx0XHRcdChhY2Nlc3Nvciwgc2VsKSA9PiBuZXcgTGluZUNvbW1lbnRDb21tYW5kKGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSksIHNlbCwgNCwgVHlwZS5Ub2dnbGUsIGZhbHNlLCB0cnVlKVxuXHRcdCk7XG5cblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnIUAjICAgIHNvbWUgdGV4dCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnICAgIHNvbWUgdGV4dCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpXG5cdFx0KTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ2lnbm9yZUVtcHR5TGluZXMgZmFsc2UnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0Y29uc3QgdGVzdExpbmVDb21tZW50Q29tbWFuZCA9IGNyZWF0ZVRlc3RDb21tYW5kSGVscGVyKFxuXHRcdHsgbGluZUNvbW1lbnQ6ICchQCMnLCBibG9ja0NvbW1lbnQ6IFsnPCFAIycsICcjQCE+J10gfSxcblx0XHQoYWNjZXNzb3IsIHNlbCkgPT4gbmV3IExpbmVDb21tZW50Q29tbWFuZChhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpLCBzZWwsIDQsIFR5cGUuVG9nZ2xlLCB0cnVlLCBmYWxzZSlcblx0KTtcblxuXHR0ZXN0KCdkb2VzIG5vdCBpZ25vcmUgd2hpdGVzcGFjZSBsaW5lcycsICgpID0+IHtcblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnXFx0c29tZSB0ZXh0Jyxcblx0XHRcdFx0J1xcdCAgICcsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnXFx0c29tZSBtb3JlIHRleHQnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig0LCAyLCAxLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0JyFAIyBcXHRzb21lIHRleHQnLFxuXHRcdFx0XHQnIUAjIFxcdCAgICcsXG5cdFx0XHRcdCchQCMgJyxcblx0XHRcdFx0JyFAIyBcXHRzb21lIG1vcmUgdGV4dCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDQsIDYsIDEsIDUpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVtb3ZlcyBpdHMgb3duJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RMaW5lQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHQhQCMgc29tZSB0ZXh0Jyxcblx0XHRcdFx0J1xcdCAgICcsXG5cdFx0XHRcdCdcXHRcXHQhQCMgc29tZSBtb3JlIHRleHQnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigzLCAyLCAxLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J1xcdHNvbWUgdGV4dCcsXG5cdFx0XHRcdCdcXHQgICAnLFxuXHRcdFx0XHQnXFx0XFx0c29tZSBtb3JlIHRleHQnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigzLCAyLCAxLCAxKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dvcmtzIGluIG9ubHkgd2hpdGVzcGFjZScsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnXFx0ICAgICcsXG5cdFx0XHRcdCdcXHQnLFxuXHRcdFx0XHQnXFx0XFx0c29tZSBtb3JlIHRleHQnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigzLCAxLCAxLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J1xcdCFAIyAgICAgJyxcblx0XHRcdFx0J1xcdCFAIyAnLFxuXHRcdFx0XHQnXFx0XFx0c29tZSBtb3JlIHRleHQnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigzLCAxLCAxLCAxKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbW1lbnRzIHNpbmdsZSBsaW5lJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RMaW5lQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdzb21lIHRleHQnLFxuXHRcdFx0XHQnXFx0c29tZSBtb3JlIHRleHQnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0JyFAIyBzb21lIHRleHQnLFxuXHRcdFx0XHQnXFx0c29tZSBtb3JlIHRleHQnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCA1LCAxLCA1KVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RldGVjdHMgaW5kZW50YXRpb24nLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdExpbmVDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J1xcdHNvbWUgdGV4dCcsXG5cdFx0XHRcdCdcXHRzb21lIG1vcmUgdGV4dCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDIsIDEsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnXFx0IUAjIHNvbWUgdGV4dCcsXG5cdFx0XHRcdCdcXHQhQCMgc29tZSBtb3JlIHRleHQnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCAyLCAxLCAxKVxuXHRcdCk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdFZGl0b3IgQ29udHJpYiAtIExpbmUgQ29tbWVudCBBcyBCbG9jayBDb21tZW50JywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGNvbnN0IHRlc3RMaW5lQ29tbWVudENvbW1hbmQgPSBjcmVhdGVUZXN0Q29tbWFuZEhlbHBlcihcblx0XHR7IGxpbmVDb21tZW50OiAnJywgYmxvY2tDb21tZW50OiBbJygnLCAnKSddIH0sXG5cdFx0KGFjY2Vzc29yLCBzZWwpID0+IG5ldyBMaW5lQ29tbWVudENvbW1hbmQoYWNjZXNzb3IuZ2V0KElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSwgc2VsLCA0LCBUeXBlLlRvZ2dsZSwgdHJ1ZSwgdHJ1ZSlcblx0KTtcblxuXHR0ZXN0KCdmYWxsIGJhY2sgdG8gYmxvY2sgY29tbWVudCBjb21tYW5kJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RMaW5lQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCcoIGZpcnN0ICknLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDMsIDEsIDMpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZmFsbCBiYWNrIHRvIGJsb2NrIGNvbW1lbnQgY29tbWFuZCAtIHRvZ2dsZScsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnKGZpcnN0KScsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNywgMSwgMiksXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNiwgMSwgMSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdidWcgOTUxMyAtIGV4cGFuZCBzaW5nbGUgbGluZSB0byB1bmNvbW1lbnQgYXV0byBibG9jaycsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnKCBmaXJzdCApJyxcblx0XHRcdFx0J1xcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2J1ZyA5NjkxIC0gYWx3YXlzIGV4cGFuZCBzZWxlY3Rpb24gdG8gbGluZSBib3VuZGFyaWVzJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RMaW5lQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMywgMiwgMSwgMyksXG5cdFx0XHRbXG5cdFx0XHRcdCcoIGZpcnN0Jyxcblx0XHRcdFx0J1xcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUgKScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDIsIDEsIDUpXG5cdFx0KTtcblxuXHRcdHRlc3RMaW5lQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCcoZmlyc3QnLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQndGhpcmQgbGluZSknLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigzLCAxMSwgMSwgMiksXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMywgMTEsIDEsIDEpXG5cdFx0KTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ0VkaXRvciBDb250cmliIC0gTGluZSBDb21tZW50IEFzIEJsb2NrIENvbW1lbnQgMicsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRjb25zdCB0ZXN0TGluZUNvbW1lbnRDb21tYW5kID0gY3JlYXRlVGVzdENvbW1hbmRIZWxwZXIoXG5cdFx0eyBsaW5lQ29tbWVudDogbnVsbCwgYmxvY2tDb21tZW50OiBbJzwhQCMnLCAnI0AhPiddIH0sXG5cdFx0KGFjY2Vzc29yLCBzZWwpID0+IG5ldyBMaW5lQ29tbWVudENvbW1hbmQoYWNjZXNzb3IuZ2V0KElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSwgc2VsLCA0LCBUeXBlLlRvZ2dsZSwgdHJ1ZSwgdHJ1ZSlcblx0KTtcblxuXHR0ZXN0KCdubyBzZWxlY3Rpb24gPT4gdXNlcyBpbmRlbnRhdGlvbicsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnXFx0XFx0Zmlyc3RcXHQgICAgJyxcblx0XHRcdFx0J1xcdFxcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J1xcdHRoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnXFx0XFx0PCFAI2ZpZnRoI0AhPlxcdFxcdCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDEsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnXFx0XFx0PCFAIyBmaXJzdFxcdCAgICAgI0AhPicsXG5cdFx0XHRcdCdcXHRcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCdcXHR0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J1xcdFxcdDwhQCNmaWZ0aCNAIT5cXHRcXHQnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKVxuXHRcdCk7XG5cblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnXFx0XFx0PCFAI2ZpcnN0XFx0ICAgICNAIT4nLFxuXHRcdFx0XHQnXFx0XFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQnXFx0dGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdcXHRcXHQ8IUAjZmlmdGgjQCE+XFx0XFx0J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMSwgMSksXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHRcXHRmaXJzdFxcdCAgICcsXG5cdFx0XHRcdCdcXHRcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCdcXHR0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J1xcdFxcdDwhQCNmaWZ0aCNAIT5cXHRcXHQnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAxLCAxKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NhbiByZW1vdmUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdExpbmVDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J1xcdFxcdGZpcnN0XFx0ICAgICcsXG5cdFx0XHRcdCdcXHRcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCdcXHR0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J1xcdFxcdDwhQCNmaWZ0aCNAIT5cXHRcXHQnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig1LCAxLCA1LCAxKSxcblx0XHRcdFtcblx0XHRcdFx0J1xcdFxcdGZpcnN0XFx0ICAgICcsXG5cdFx0XHRcdCdcXHRcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCdcXHR0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J1xcdFxcdGZpZnRoXFx0XFx0J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oNSwgMSwgNSwgMSlcblx0XHQpO1xuXG5cdFx0dGVzdExpbmVDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J1xcdFxcdGZpcnN0XFx0ICAgICcsXG5cdFx0XHRcdCdcXHRcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCdcXHR0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J1xcdFxcdDwhQCNmaWZ0aCNAIT5cXHRcXHQnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig1LCAzLCA1LCAzKSxcblx0XHRcdFtcblx0XHRcdFx0J1xcdFxcdGZpcnN0XFx0ICAgICcsXG5cdFx0XHRcdCdcXHRcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCdcXHR0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J1xcdFxcdGZpZnRoXFx0XFx0J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oNSwgMywgNSwgMylcblx0XHQpO1xuXG5cdFx0dGVzdExpbmVDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J1xcdFxcdGZpcnN0XFx0ICAgICcsXG5cdFx0XHRcdCdcXHRcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCdcXHR0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J1xcdFxcdDwhQCNmaWZ0aCNAIT5cXHRcXHQnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig1LCA0LCA1LCA0KSxcblx0XHRcdFtcblx0XHRcdFx0J1xcdFxcdGZpcnN0XFx0ICAgICcsXG5cdFx0XHRcdCdcXHRcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCdcXHR0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J1xcdFxcdGZpZnRoXFx0XFx0J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oNSwgMywgNSwgMylcblx0XHQpO1xuXG5cdFx0dGVzdExpbmVDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J1xcdFxcdGZpcnN0XFx0ICAgICcsXG5cdFx0XHRcdCdcXHRcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCdcXHR0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J1xcdFxcdDwhQCNmaWZ0aCNAIT5cXHRcXHQnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig1LCAxNiwgNSwgMyksXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHRcXHRmaXJzdFxcdCAgICAnLFxuXHRcdFx0XHQnXFx0XFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQnXFx0dGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdcXHRcXHRmaWZ0aFxcdFxcdCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDUsIDgsIDUsIDMpXG5cdFx0KTtcblxuXHRcdHRlc3RMaW5lQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHRcXHRmaXJzdFxcdCAgICAnLFxuXHRcdFx0XHQnXFx0XFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQnXFx0dGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdcXHRcXHQ8IUAjZmlmdGgjQCE+XFx0XFx0J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oNSwgMTIsIDUsIDcpLFxuXHRcdFx0W1xuXHRcdFx0XHQnXFx0XFx0Zmlyc3RcXHQgICAgJyxcblx0XHRcdFx0J1xcdFxcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J1xcdHRoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnXFx0XFx0ZmlmdGhcXHRcXHQnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbig1LCA4LCA1LCAzKVxuXHRcdCk7XG5cblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnXFx0XFx0Zmlyc3RcXHQgICAgJyxcblx0XHRcdFx0J1xcdFxcdHNlY29uZCBsaW5lJyxcblx0XHRcdFx0J1xcdHRoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnXFx0XFx0PCFAI2ZpZnRoI0AhPlxcdFxcdCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDUsIDE4LCA1LCAxOCksXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHRcXHRmaXJzdFxcdCAgICAnLFxuXHRcdFx0XHQnXFx0XFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQnXFx0dGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdcXHRcXHRmaWZ0aFxcdFxcdCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDUsIDEwLCA1LCAxMClcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjOTkzOiBSZW1vdmUgY29tbWVudCBkb2VzIG5vdCB3b3JrIGNvbnNpc3RlbnRseSBpbiBIVE1MJywgKCkgPT4ge1xuXHRcdHRlc3RMaW5lQ29tbWVudENvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCcgICAgIGFzZCBxd2UnLFxuXHRcdFx0XHQnICAgICBhc2QgcXdlJyxcblx0XHRcdFx0Jydcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDEsIDMsIDEpLFxuXHRcdFx0W1xuXHRcdFx0XHQnICAgICA8IUAjIGFzZCBxd2UnLFxuXHRcdFx0XHQnICAgICBhc2QgcXdlICNAIT4nLFxuXHRcdFx0XHQnJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMywgMSlcblx0XHQpO1xuXG5cdFx0dGVzdExpbmVDb21tZW50Q29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0JyAgICAgPCFAI2FzZCBxd2UnLFxuXHRcdFx0XHQnICAgICBhc2QgcXdlI0AhPicsXG5cdFx0XHRcdCcnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAxLCAzLCAxKSxcblx0XHRcdFtcblx0XHRcdFx0JyAgICAgYXNkIHF3ZScsXG5cdFx0XHRcdCcgICAgIGFzZCBxd2UnLFxuXHRcdFx0XHQnJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgMywgMSlcblx0XHQpO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgnRWRpdG9yIENvbnRyaWIgLSBMaW5lIENvbW1lbnQgaW4gbWl4ZWQgbW9kZXMnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0Y29uc3QgT1VURVJfTEFOR1VBR0VfSUQgPSAnb3V0ZXJNb2RlJztcblx0Y29uc3QgSU5ORVJfTEFOR1VBR0VfSUQgPSAnaW5uZXJNb2RlJztcblxuXHRjbGFzcyBPdXRlck1vZGUgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0XHRwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlSWQgPSBPVVRFUl9MQU5HVUFHRV9JRDtcblx0XHRjb25zdHJ1Y3Rvcihcblx0XHRcdGNvbW1lbnRzQ29uZmlnOiBDb21tZW50UnVsZSxcblx0XHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRcdEBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZVxuXHRcdCkge1xuXHRcdFx0c3VwZXIoKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGxhbmd1YWdlU2VydmljZS5yZWdpc3Rlckxhbmd1YWdlKHsgaWQ6IHRoaXMubGFuZ3VhZ2VJZCB9KSk7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnJlZ2lzdGVyKHRoaXMubGFuZ3VhZ2VJZCwge1xuXHRcdFx0XHRjb21tZW50czogY29tbWVudHNDb25maWdcblx0XHRcdH0pKTtcblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoVG9rZW5pemF0aW9uUmVnaXN0cnkucmVnaXN0ZXIodGhpcy5sYW5ndWFnZUlkLCB7XG5cdFx0XHRcdGdldEluaXRpYWxTdGF0ZTogKCk6IElTdGF0ZSA9PiBOdWxsU3RhdGUsXG5cdFx0XHRcdHRva2VuaXplOiAoKSA9PiB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0dG9rZW5pemVFbmNvZGVkOiAobGluZTogc3RyaW5nLCBoYXNFT0w6IGJvb2xlYW4sIHN0YXRlOiBJU3RhdGUpOiBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0ID0+IHtcblx0XHRcdFx0XHRjb25zdCBsYW5ndWFnZUlkID0gKC9eICAvLnRlc3QobGluZSkgPyBJTk5FUl9MQU5HVUFHRV9JRCA6IE9VVEVSX0xBTkdVQUdFX0lEKTtcblx0XHRcdFx0XHRjb25zdCBlbmNvZGVkTGFuZ3VhZ2VJZCA9IGxhbmd1YWdlU2VydmljZS5sYW5ndWFnZUlkQ29kZWMuZW5jb2RlTGFuZ3VhZ2VJZChsYW5ndWFnZUlkKTtcblxuXHRcdFx0XHRcdGNvbnN0IHRva2VucyA9IG5ldyBVaW50MzJBcnJheSgxIDw8IDEpO1xuXHRcdFx0XHRcdHRva2Vuc1soMCA8PCAxKV0gPSAwO1xuXHRcdFx0XHRcdHRva2Vuc1soMCA8PCAxKSArIDFdID0gKFxuXHRcdFx0XHRcdFx0KENvbG9ySWQuRGVmYXVsdEZvcmVncm91bmQgPDwgTWV0YWRhdGFDb25zdHMuRk9SRUdST1VORF9PRkZTRVQpXG5cdFx0XHRcdFx0XHR8IChlbmNvZGVkTGFuZ3VhZ2VJZCA8PCBNZXRhZGF0YUNvbnN0cy5MQU5HVUFHRUlEX09GRlNFVClcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdHJldHVybiBuZXcgRW5jb2RlZFRva2VuaXphdGlvblJlc3VsdCh0b2tlbnMsIHN0YXRlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH1cblx0fVxuXG5cdGNsYXNzIElubmVyTW9kZSBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRcdHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VJZCA9IElOTkVSX0xBTkdVQUdFX0lEO1xuXHRcdGNvbnN0cnVjdG9yKFxuXHRcdFx0Y29tbWVudHNDb25maWc6IENvbW1lbnRSdWxlLFxuXHRcdFx0QElMYW5ndWFnZVNlcnZpY2UgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdFx0QElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdFx0KSB7XG5cdFx0XHRzdXBlcigpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIobGFuZ3VhZ2VTZXJ2aWNlLnJlZ2lzdGVyTGFuZ3VhZ2UoeyBpZDogdGhpcy5sYW5ndWFnZUlkIH0pKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIodGhpcy5sYW5ndWFnZUlkLCB7XG5cdFx0XHRcdGNvbW1lbnRzOiBjb21tZW50c0NvbmZpZ1xuXHRcdFx0fSkpO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHRlc3RMaW5lQ29tbWVudENvbW1hbmQobGluZXM6IHN0cmluZ1tdLCBzZWxlY3Rpb246IFNlbGVjdGlvbiwgZXhwZWN0ZWRMaW5lczogc3RyaW5nW10sIGV4cGVjdGVkU2VsZWN0aW9uOiBTZWxlY3Rpb24pOiB2b2lkIHtcblxuXHRcdGNvbnN0IHNldHVwID0gKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlKSA9PiB7XG5cdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE91dGVyTW9kZSwgeyBsaW5lQ29tbWVudDogJy8vJywgYmxvY2tDb21tZW50OiBbJy8qJywgJyovJ10gfSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKElubmVyTW9kZSwgeyBsaW5lQ29tbWVudDogbnVsbCwgYmxvY2tDb21tZW50OiBbJ3svKicsICcqL30nXSB9KSk7XG5cdFx0fTtcblxuXHRcdHRlc3RDb21tYW5kKFxuXHRcdFx0bGluZXMsXG5cdFx0XHRPVVRFUl9MQU5HVUFHRV9JRCxcblx0XHRcdHNlbGVjdGlvbixcblx0XHRcdChhY2Nlc3Nvciwgc2VsKSA9PiBuZXcgTGluZUNvbW1lbnRDb21tYW5kKGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSksIHNlbCwgNCwgVHlwZS5Ub2dnbGUsIHRydWUsIHRydWUpLFxuXHRcdFx0ZXhwZWN0ZWRMaW5lcyxcblx0XHRcdGV4cGVjdGVkU2VsZWN0aW9uLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdHNldHVwXG5cdFx0KTtcblx0fVxuXG5cdHRlc3QoJ2lzc3VlICMyNDA0NyAocGFydCAxKTogQ29tbWVudGluZyBjb2RlIGluIEpTWCBmaWxlcycsICgpID0+IHtcblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnaW1wb3J0IFJlYWN0IGZyb20gXFwncmVhY3RcXCc7Jyxcblx0XHRcdFx0J2NvbnN0IExvYWRlciA9ICgpID0+ICgnLFxuXHRcdFx0XHQnICA8ZGl2PicsXG5cdFx0XHRcdCcgICAgTG9hZGluZy4uLicsXG5cdFx0XHRcdCcgIDwvZGl2PicsXG5cdFx0XHRcdCcpOycsXG5cdFx0XHRcdCdleHBvcnQgZGVmYXVsdCBMb2FkZXI7J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgMSwgNywgMjIpLFxuXHRcdFx0W1xuXHRcdFx0XHQnLy8gaW1wb3J0IFJlYWN0IGZyb20gXFwncmVhY3RcXCc7Jyxcblx0XHRcdFx0Jy8vIGNvbnN0IExvYWRlciA9ICgpID0+ICgnLFxuXHRcdFx0XHQnLy8gICA8ZGl2PicsXG5cdFx0XHRcdCcvLyAgICAgTG9hZGluZy4uLicsXG5cdFx0XHRcdCcvLyAgIDwvZGl2PicsXG5cdFx0XHRcdCcvLyApOycsXG5cdFx0XHRcdCcvLyBleHBvcnQgZGVmYXVsdCBMb2FkZXI7J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNCwgNywgMjUpLFxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyNDA0NyAocGFydCAyKTogQ29tbWVudGluZyBjb2RlIGluIEpTWCBmaWxlcycsICgpID0+IHtcblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnaW1wb3J0IFJlYWN0IGZyb20gXFwncmVhY3RcXCc7Jyxcblx0XHRcdFx0J2NvbnN0IExvYWRlciA9ICgpID0+ICgnLFxuXHRcdFx0XHQnICA8ZGl2PicsXG5cdFx0XHRcdCcgICAgTG9hZGluZy4uLicsXG5cdFx0XHRcdCcgIDwvZGl2PicsXG5cdFx0XHRcdCcpOycsXG5cdFx0XHRcdCdleHBvcnQgZGVmYXVsdCBMb2FkZXI7J1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMywgNCwgMywgNCksXG5cdFx0XHRbXG5cdFx0XHRcdCdpbXBvcnQgUmVhY3QgZnJvbSBcXCdyZWFjdFxcJzsnLFxuXHRcdFx0XHQnY29uc3QgTG9hZGVyID0gKCkgPT4gKCcsXG5cdFx0XHRcdCcgIHsvKiA8ZGl2PiAqL30nLFxuXHRcdFx0XHQnICAgIExvYWRpbmcuLi4nLFxuXHRcdFx0XHQnICA8L2Rpdj4nLFxuXHRcdFx0XHQnKTsnLFxuXHRcdFx0XHQnZXhwb3J0IGRlZmF1bHQgTG9hZGVyOydcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDMsIDgsIDMsIDgpLFxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMzNjE3MzogQ29tbWVudGluZyBjb2RlIGluIEpTWCB0YWcgYm9keScsICgpID0+IHtcblx0XHR0ZXN0TGluZUNvbW1lbnRDb21tYW5kKFxuXHRcdFx0W1xuXHRcdFx0XHQnPGRpdj4nLFxuXHRcdFx0XHQnICB7MTIzfScsXG5cdFx0XHRcdCc8L2Rpdj4nLFxuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMiwgNCwgMiwgNCksXG5cdFx0XHRbXG5cdFx0XHRcdCc8ZGl2PicsXG5cdFx0XHRcdCcgIHsvKiB7MTIzfSAqL30nLFxuXHRcdFx0XHQnPC9kaXY+Jyxcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDgsIDIsIDgpLFxuXHRcdCk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLFlBQVksdUJBQXVCO0FBQzVDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsaUJBQWlCO0FBRTFCLFNBQVMsU0FBUyxzQkFBc0I7QUFDeEMsU0FBUywyQkFBbUMsNEJBQTRCO0FBQ3hFLFNBQVMsd0JBQXdCO0FBRWpDLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQTJELG9CQUFvQixZQUFZO0FBQzNGLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsd0NBQXdDO0FBQ2pELFNBQVMsNkJBQStDO0FBRXhELFNBQVMsd0JBQXdCLGdCQUE2QixnQkFBd0w7QUFDclAsU0FBTyxDQUFDLE9BQWlCLFdBQXNCLGVBQXlCLHNCQUFpQztBQUN4RyxVQUFNLGFBQWE7QUFDbkIsVUFBTSxVQUFVLENBQUMs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TUFBVTtBQUFBLE1BQ1Y7QUFBQSxNQUFZO0FBQUEsTUFDWjtBQUFBLE1BQVU7QUFBQSxNQUNWO0FBQUEsTUFBUTtBQUFBLElBQ1QsR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsT0FBTztBQUU5QixZQUFRO0FBQUEsTUFDUDtBQUFBLE1BQVE7QUFBQSxNQUNSO0FBQUEsTUFBVTtBQUFBLE1BQ1Y7QUFBQSxNQUFZO0FBQUEsTUFDWjtBQUFBLE1BQVU7QUFBQSxNQUNWO0FBQUEsTUFBUTtBQUFBLElBQ1QsR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsT0FBTztBQUU5QixZQUFRO0FBQUEsTUFDUDtBQUFBLE1BQU87QUFBQSxNQUNQO0FBQUEsTUFBUTtBQUFBLE1BQ1I7QUFBQSxNQUFTO0FBQUEsTUFDVDtBQUFBLE1BQVE7QUFBQSxNQUNSO0FBQUEsTUFBTTtBQUFBLElBQ1AsR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsT0FBTztBQUU5QixZQUFRO0FBQUEsTUFDUDtBQUFBLE1BQVM7QUFBQSxNQUNUO0FBQUEsTUFBVTtBQUFBLE1BQ1Y7QUFBQSxNQUFXO0FBQUEsTUFDWDtBQUFBLE1BQVU7QUFBQSxNQUNWO0FBQUEsTUFBTTtBQUFBLElBQ1AsR0FBRyxHQUFHLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLEdBQUcsT0FBTztBQUU5QixZQUFRO0FBQUEsTUFDUDtBQUFBLE1BQU07QUFBQSxNQUNOO0FBQUEsTUFBUTtBQUFBLElBQ1QsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsU0FBUztBQUN2QixZQUFRO0FBQUEsTUFDUDtBQUFBLE1BQU07QUFBQSxNQUNOO0FBQUEsTUFBTztBQUFBLElBQ1IsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLEdBQUcsU0FBUztBQUN2QixZQUFRO0FBQUEsTUFDUDtBQUFBLE1BQU07QUFBQSxNQUNOO0FBQUEsTUFBTTtBQUFBLElBQ1AsR0FBRyxHQUFH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R0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBRUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSywySEFBMkgsTUFBTTtBQUNySTtBQUFBLE1BQ0M7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDeEI7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsSUFDekI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHNFQUFzRSxNQUFNO0FBQ2hGO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDeEI7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBRUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUN4QjtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsSUFDekI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLGtFQUFrRSxXQUFZO0FBQ2xGO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxNQUN6QjtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxJQUMxQjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssdURBQXdELE1BQU07QUFDbEU7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQztBQUFBLElBQzFCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxxQkFBcUIsTUFBTTtBQUMvQixVQUFNQSwwQkFBeUI7QUFBQSxNQUM5QixFQUFFLGFBQWEsTUFBTTtBQUFBLE1BQ3JCLENBQUMsVUFBVSxRQUFRLElBQUksbUJBQW1CLFNBQVMsSUFBSSw2QkFBNkIsR0FBRyxLQUFLLEdBQUcsS0FBSyxRQUFRLE9BQU8sSUFBSTtBQUFBLElBQ3hIO0FBRUEsSUFBQUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDeEI7QUFBQSxRQUNDO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxJQUN6QjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssMkNBQTJDLE1BQU07QUFDckQsVUFBTUEsMEJBQXlCO0FBQUEsTUFDOUIsRUFBRSxhQUFhLE1BQU07QUFBQSxNQUNyQixDQUFDLFVBQVUsUUFBUSxJQUFJLG1CQUFtQixTQUFTLElBQUksNkJBQTZCLEdBQUcsS0FBSyxHQUFHLEtBQUssUUFBUSxPQUFPLElBQUk7QUFBQSxJQUN4SDtBQUVBLElBQUFBO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsSUFDekI7QUFBQSxFQUNELENBQUM7QUFDRixDQUFDO0FBRUQsTUFBTSwwQkFBMEIsTUFBTTtBQUVyQywwQ0FBd0M7QUFFeEMsUUFBTSx5QkFBeUI7QUFBQSxJQUM5QixFQUFFLGFBQWEsT0FBTyxjQUFjLENBQUMsUUFBUSxNQUFNLEVBQUU7QUFBQSxJQUNyRCxDQUFDLFVBQVUsUUFBUSxJQUFJLG1CQUFtQixTQUFTLElBQUksNkJBQTZCLEdBQUcsS0FBSyxHQUFHLEtBQUssUUFBUSxNQUFNLEtBQUs7QUFBQSxFQUN4SDtBQUVBLE9BQUssb0NBQW9DLE1BQU07QUFDOUM7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDeEI7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxJQUN6QjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssbUJBQW1CLFdBQVk7QUFDbkM7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUN4QjtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsSUFDekI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDRCQUE0QixXQUFZO0FBQzVDO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDeEI7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyx3QkFBd0IsV0FBWTtBQUN4QztBQUFBLE1BQ0M7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDeEI7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsSUFDekI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLHVCQUF1QixXQUFZO0FBQ3ZDO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUN4QjtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxJQUN6QjtBQUFBLEVBQ0QsQ0FBQztBQUNGLENBQUM7QUFFRCxNQUFNLGtEQUFrRCxNQUFNO0FBRTdELDBDQUF3QztBQUV4QyxRQUFNLHlCQUF5QjtBQUFBLElBQzlCLEVBQUUsYUFBYSxJQUFJLGNBQWMsQ0FBQyxLQUFLLEdBQUcsRUFBRTtBQUFBLElBQzVDLENBQUMsVUFBVSxRQUFRLElBQUksbUJBQW1CLFNBQVMsSUFBSSw2QkFBNkIsR0FBRyxLQUFLLEdBQUcsS0FBSyxRQUFRLE1BQU0sSUFBSTtBQUFBLEVBQ3ZIO0FBRUEsT0FBSyxzQ0FBc0MsV0FBWTtBQUN0RDtBQUFBLE1BQ0M7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDeEI7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsSUFDekI7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLCtDQUErQyxXQUFZO0FBQy9EO0FBQUEsTUFDQztBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUN4QjtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxJQUN6QjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUsseURBQXlELFdBQVk7QUFDekU7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyx5REFBeUQsV0FBWTtBQUN6RTtBQUFBLE1BQ0M7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDeEI7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsSUFDekI7QUFFQTtBQUFBLE1BQ0M7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDO0FBQUEsTUFDekI7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLElBQUksVUFBVSxHQUFHLElBQUksR0FBRyxDQUFDO0FBQUEsSUFDMUI7QUFBQSxFQUNELENBQUM7QUFDRixDQUFDO0FBRUQsTUFBTSxvREFBb0QsTUFBTTtBQUUvRCwwQ0FBd0M7QUFFeEMsUUFBTSx5QkFBeUI7QUFBQSxJQUM5QixFQUFFLGFBQWEsTUFBTSxjQUFjLENBQUMsUUFBUSxNQUFNLEVBQUU7QUFBQSxJQUNwRCxDQUFDLFVBQVUsUUFBUSxJQUFJLG1CQUFtQixTQUFTLElBQUksNkJBQTZCLEdBQUcsS0FBSyxHQUFHLEtBQUssUUFBUSxNQUFNLElBQUk7QUFBQSxFQUN2SDtBQUVBLE9BQUssb0NBQW9DLFdBQVk7QUFDcEQ7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBRUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxjQUFjLFdBQVk7QUFDOUI7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBRUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBRUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBRUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQztBQUFBLE1BQ3pCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBRUE7QUFBQSxNQUNDO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxJQUFJLEdBQUcsQ0FBQztBQUFBLE1BQ3pCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFB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Q0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUN4QjtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLElBQ3pCO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxpREFBaUQsTUFBTTtBQUMzRDtBQUFBLE1BQ0M7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxJQUFJLFVBQVUsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3hCO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsSUFBSSxVQUFVLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxJQUN6QjtBQUFBLEVBQ0QsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbInRlc3RMaW5lQ29tbWVudENvbW1hbmQiXQp9Cg==
